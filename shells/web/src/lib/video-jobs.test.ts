// SPDX-License-Identifier: MPL-2.0
/**
 * WP-G - streaming on-device video processing (lib/video-jobs.ts).
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/video-jobs.test.ts
 *
 * jsdom with a real origin so the i18n chain the module pulls in never trips on
 * about:blank. No real codecs exist under node, so the pipeline is driven with a
 * SYNTHETIC frame source (a fake decoder/encoder pair injected through the deps).
 *
 * What is pinned:
 *   - the frame loop: decode → op → encode, progress reported, cancellation stops
 *     the loop between frames,
 *   - the matte temporal smoother: EMA smooths a steady shot, a luma-histogram
 *     scene cut resets it,
 *   - even-dimension crop rounding + the pure crop,
 *   - the provenance branch per op (matte/crop → plain edit, upscale → genAI
 *     partial) and the source carried as an ingredient,
 *   - the saved record: type/format/animated/aiGenerated per op.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const {
  runFramePipeline, MatteAlphaSmoother, lumaHistogram, histogramDelta, SCENE_CUT_THRESHOLD,
  evenFloor, roundCropRect, cropFrame, videoProvenanceFor, runVideoJob, transcodeVideo, matteOutputFrames,
  lutCreditText, lutCreditParameters,
  extrapolateEstimate, scaledEvenDims, MATTE_MAX_OUTPUT_FRAMES,
  resizeFrameRGBA, makeChromaKeyOp, CHROMA_DEFAULT_KEY, clampMatteLongEdge, MATTE_MAX_INPUT_LONG_EDGE,
  alphaVideoWriter, pickAlphaVideoCodec, MATTE_WEBM_BITRATE,
} = await import('./video-jobs.ts');
const { COMPOSITE_SOURCE_TYPE } = await import('@lolly/engine');

type Frame = { data: Uint8ClampedArray; width: number; height: number; timestampUs: number; durationUs: number };

/** A synthetic reader yielding `n` solid-colour frames. */
function fakeReader(n: number, width = 4, height = 4, fill = 128): {
  width: number; height: number; fps: number; frameCount: number;
  read(): AsyncGenerator<Frame, void, unknown>; close(): void; closed: boolean;
} {
  const state = { closed: false };
  return {
    width, height, fps: 12, frameCount: n, closed: false,
    async *read() {
      for (let i = 0; i < n; i++) {
        const data = new Uint8ClampedArray(width * height * 4).fill(fill);
        for (let p = 3; p < data.length; p += 4) data[p] = 255;
        yield { data, width, height, timestampUs: Math.round((i / 12) * 1e6), durationUs: Math.round(1e6 / 12) };
      }
    },
    close() { state.closed = true; (this as { closed: boolean }).closed = true; },
  };
}

/** A synthetic writer collecting frames. */
function fakeWriter(format = 'mp4'): {
  frames: Frame[]; aborted: boolean;
  write(f: Frame): void; finalize(): Promise<{ blob: Blob; format: string; width: number; height: number }>; abort(): void;
} {
  const frames: Frame[] = [];
  const w = {
    frames, aborted: false,
    write(f: Frame) { frames.push(f); },
    async finalize() { const f = frames[0]; return { blob: new Blob(['x']), format, width: f?.width ?? 0, height: f?.height ?? 0 }; },
    abort() { w.aborted = true; },
  };
  return w;
}

// ── the frame loop ────────────────────────────────────────────────────────────

test('pipeline: every frame flows decode → op → encode, progress reported', async () => {
  const reader = fakeReader(5);
  const writer = fakeWriter();
  const seen: Array<[number, number]> = [];
  const res = await runFramePipeline(reader, (f) => f, writer, { onProgress: (d, t) => seen.push([d, t]) });
  assert.equal(res.cancelled, false);
  assert.equal(writer.frames.length, 5);
  assert.deepEqual(seen, [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5]]);
  assert.ok(res.result && res.result.format === 'mp4');
});

test('pipeline: the op transforms each frame (identity vs a real change)', async () => {
  const reader = fakeReader(3);
  const writer = fakeWriter();
  await runFramePipeline(reader, (f) => ({ ...f, width: 2, height: 2, data: new Uint8ClampedArray(2 * 2 * 4) }), writer);
  assert.ok(writer.frames.every((f) => f.width === 2 && f.height === 2));
});

test('pipeline: cancellation stops the loop between frames and aborts the writer', async () => {
  const reader = fakeReader(10);
  const writer = fakeWriter();
  let done = 0;
  const res = await runFramePipeline(reader, (f) => f, writer, {
    onProgress: () => { done++; },
    isCancelled: () => done >= 2, // cancel AFTER the 2nd frame's progress
  });
  assert.equal(res.cancelled, true);
  assert.equal(res.result, undefined);
  assert.equal(writer.frames.length, 2); // 3rd iteration's cancel check fires before the op
  assert.equal(writer.aborted, true);
});

// ── matte temporal smoother (EMA + scene-cut) ──────────────────────────────────

test('lumaHistogram + histogramDelta: identical frames → 0, black vs white → 1', () => {
  const black = new Uint8ClampedArray(16 * 4); // all 0 rgb
  for (let i = 3; i < black.length; i += 4) black[i] = 255;
  const white = new Uint8ClampedArray(16 * 4).fill(255);
  const hb = lumaHistogram(black);
  const hw = lumaHistogram(white);
  assert.equal(histogramDelta(hb, hb), 0);
  assert.ok(Math.abs(histogramDelta(hb, hw) - 1) < 1e-9);
  assert.ok(histogramDelta(hb, hw) > SCENE_CUT_THRESHOLD);
});

test('MatteAlphaSmoother: EMA smooths a steady shot (new = 0.6·prev + 0.4·cur)', () => {
  const s = new MatteAlphaSmoother();
  // Frame 1: RGB 128, alpha 200. First frame is a cut → alpha untouched.
  const f1 = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
  f1.data.fill(128); for (let i = 3; i < f1.data.length; i += 4) f1.data[i] = 200;
  s.apply(f1);
  assert.equal(s.lastWasCut, true);
  assert.equal(f1.data[3], 200);
  // Frame 2: SAME rgb (128 → identical histogram, not a cut), alpha 100 → blend.
  const f2 = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
  f2.data.fill(128); for (let i = 3; i < f2.data.length; i += 4) f2.data[i] = 100;
  s.apply(f2);
  assert.equal(s.lastWasCut, false);
  assert.equal(f2.data[3], Math.round(0.6 * 200 + 0.4 * 100)); // 160
});

test('MatteAlphaSmoother: a scene cut (luma jump) resets the EMA - alpha unblended', () => {
  const s = new MatteAlphaSmoother();
  const black = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
  for (let i = 3; i < black.data.length; i += 4) black.data[i] = 220; // rgb 0, alpha 220
  s.apply(black);
  const white = { data: new Uint8ClampedArray(4 * 4 * 4).fill(255), width: 4, height: 4 };
  for (let i = 3; i < white.data.length; i += 4) white.data[i] = 80; // rgb 255, alpha 80
  s.apply(white);
  assert.equal(s.lastWasCut, true);
  assert.equal(white.data[3], 80); // used as-is, no blend across the cut
});

// ── even-dimension crop rounding ───────────────────────────────────────────────

test('evenFloor: rounds down to an even value ≥ 2', () => {
  assert.equal(evenFloor(11), 10);
  assert.equal(evenFloor(10), 10);
  assert.equal(evenFloor(1), 2);
  assert.equal(evenFloor(0), 2);
  assert.equal(evenFloor(3), 2);
});

test('roundCropRect: even offsets + even lengths, clamped inside the frame', () => {
  const r = roundCropRect({ x: 3, y: 5, w: 101, h: 51 }, 200, 100);
  assert.equal(r.x % 2, 0);
  assert.equal(r.y % 2, 0);
  assert.equal(r.w % 2, 0);
  assert.equal(r.h % 2, 0);
  assert.ok(r.x + r.w <= 200 && r.y + r.h <= 100);
  // An oversized rect is clamped to the frame.
  const full = roundCropRect({ x: 0, y: 0, w: 999, h: 999 }, 640, 360);
  assert.deepEqual(full, { x: 0, y: 0, w: 640, h: 360 });
});

test('cropFrame: copies the rect out into a smaller RGBA buffer', () => {
  // 4×2 frame, distinct rows; crop the bottom-left 2×2.
  const f = { data: new Uint8ClampedArray(4 * 2 * 4), width: 4, height: 2, timestampUs: 0, durationUs: 1 };
  for (let i = 0; i < f.data.length; i += 4) { f.data[i] = i; f.data[i + 3] = 255; }
  const out = cropFrame(f as never, { x: 0, y: 0, w: 2, h: 2 });
  assert.equal(out.width, 2);
  assert.equal(out.height, 2);
  assert.equal(out.data.length, 2 * 2 * 4);
  assert.equal(out.data[0], f.data[0]); // top-left pixel preserved
});

// ── provenance branches ────────────────────────────────────────────────────────

test('videoProvenanceFor: matte = plain c2pa.edited, no aiGenerated', () => {
  const p = videoProvenanceFor('matte', { model: 'U²-Net lite (fast)', version: 'u2netp' });
  assert.equal(p.tool, 'Remove background');
  assert.equal(p.actions[0]!.action, 'c2pa.edited');
  assert.equal(p.actions[0]!.digitalSourceType, undefined);
  assert.match(p.actions[0]!.description!, /Background removed with U²-Net lite \(fast\) u2netp/);
  assert.equal(p.aiGenerated, undefined);
});

test('videoProvenanceFor: crop = plain c2pa.cropped, no aiGenerated', () => {
  const p = videoProvenanceFor('crop');
  assert.equal(p.tool, 'Crop');
  assert.equal(p.actions[0]!.action, 'c2pa.cropped');
  assert.equal(p.aiGenerated, undefined);
});

test('videoProvenanceFor: upscale = genAI partial with the composite source type', () => {
  const p = videoProvenanceFor('upscale', { model: 'Real-ESRGAN', version: 'v3', scale: 4 });
  assert.equal(p.tool, 'Upscale');
  assert.equal(p.actions[0]!.digitalSourceType, COMPOSITE_SOURCE_TYPE);
  assert.equal(p.aiGenerated, 'partial');
  assert.match(p.actions[0]!.description!, /Upscaled 4× with Real-ESRGAN v3/);
});

test('videoProvenanceFor: grade = colour_adjustments, no aiGenerated, no credit params by default', () => {
  const p = videoProvenanceFor('grade', { lutLabel: 'Muted chrome' });
  assert.equal(p.tool, 'Colour grade');
  assert.equal(p.actions[0]!.action, 'c2pa.color_adjustments');
  assert.equal(p.actions[0]!.description, 'Colour graded - Muted chrome');
  assert.equal(p.actions[0]!.parameters, undefined);   // a CC0/anonymous look carries none
  assert.equal(p.aiGenerated, undefined);
});

test('videoProvenanceFor: a credited LUT names its author + rights owner in description AND parameters', () => {
  const credit = {
    name: 'SUSE7 S-Log3 (Heavy)', author: 'Peter Chamalian',
    role: 'Director of Photography & Editor', org: 'SUSE',
    copyright: '© 2025 SUSE', license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', created: '2025-09',
  };
  const p = videoProvenanceFor('grade', { lutLabel: credit.name, lutCredit: credit });
  // Human-readable: author + affiliation + licence, appended to the look name.
  assert.equal(
    p.actions[0]!.description,
    'Colour graded - SUSE7 S-Log3 (Heavy) by Peter Chamalian, SUSE · CC BY 4.0',
  );
  // Machine-readable: the full record under a Lolly-namespaced key. Author (Peter)
  // and copyright owner (SUSE) are distinct fields.
  const lut = (p.actions[0]!.parameters as Record<string, Record<string, string>>)['com.lolly.lut']!;
  assert.equal(lut.creator, 'Peter Chamalian');
  assert.equal(lut.organization, 'SUSE');
  assert.equal(lut.copyright, '© 2025 SUSE');
  assert.equal(lut.license, 'CC BY 4.0');
  assert.equal(lut.created, '2025-09');
});

test('lutCreditText / lutCreditParameters: omit optional fields cleanly', () => {
  const bare = { name: 'X', author: 'A', license: 'CC0' };
  assert.equal(lutCreditText(bare), 'by A · CC0');   // no org → author alone
  const params = lutCreditParameters(bare)['com.lolly.lut'];
  assert.equal(params.creator, 'A');
  assert.equal(params.license, 'CC0');
  assert.equal('organization' in params, false);
  assert.equal('copyright' in params, false);
  assert.equal('role' in params, false);
});

// ── runVideoJob end-to-end with fakes (record + stamp branch) ──────────────────

function fakeHost() {
  const uploaded: Array<Record<string, unknown>> = [];
  const host = {
    log() {},
    matte: {
      isAvailable: () => true,
      models: () => [{ id: 'u2netp', name: 'U²-Net lite (fast)', version: 'u2netp' }],
      run: async (frame: { width: number; height: number; data: Uint8ClampedArray }) => ({
        width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.data),
      }),
    },
    upscale: {
      isAvailable: () => true,
      models: () => [{ id: 'realesr-general-x4v3', name: 'Real-ESRGAN general', version: 'v3', scale: 4 }],
      run: async (frame: { width: number; height: number; data: Uint8ClampedArray }) => ({
        width: frame.width * 4, height: frame.height * 4, data: new Uint8ClampedArray(frame.width * 4 * frame.height * 4 * 4),
      }),
    },
    assets: {
      _uploadUserAsset: async (rec: Record<string, unknown>) => { uploaded.push(rec); },
      get: async (id: string) => ({ id, type: 'video', url: `blob:${id}`, format: 'x' }),
    },
  };
  return { host, uploaded };
}

function baseDeps(stampCapture: { calls: Array<{ format: string; o: Record<string, unknown> }> }, ingredient: unknown | null, writer: ReturnType<typeof fakeWriter>) {
  return {
    fetchBytes: async () => ({ blob: new Blob(['src']), bytes: new Uint8Array([1, 2, 3]) }),
    openReader: async () => fakeReader(3),
    openMatteWriter: () => writer,
    openVideoWriter: async () => writer,
    decodeAudio: async () => null,
    extractIngredient: () => ingredient,
    stamp: async (_h: unknown, blob: Blob, format: string, o: Record<string, unknown>) => { stampCapture.calls.push({ format, o }); return blob; },
  };
}

test('runVideoJob matte: raster+animated record, plain-edit stamp, source ingredient carried', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('webp');
  const ref = await runVideoJob(host as never, {
    op: 'matte', source: { id: 'user/video/clip', type: 'video', url: 'blob:clip', format: 'mp4' } as never, sourceName: 'clip.mp4',
    matte: { model: 'u2netp', format: 'webp', fps: 12, longEdge: 720 },
  }, {}, baseDeps(cap, { marker: 'ingredient' }, writer) as never);
  assert.ok(ref);
  const rec = uploaded[0]!;
  assert.equal(rec.type, 'raster');
  assert.equal(rec.format, 'webp');
  assert.equal((rec.meta as Record<string, unknown>).animated, true);
  assert.equal(rec.aiGenerated, undefined);
  // No 'renders' tag on a catalog-initiated job.
  assert.equal((rec.meta as { tags?: unknown }).tags, undefined);
  // Container-level stamp: plain edit + the source as an ingredient.
  const stamp = cap.calls[0]!;
  assert.equal(stamp.format, 'webp');
  assert.equal((stamp.o.actions as Array<{ action: string }>)[0]!.action, 'c2pa.edited');
  assert.deepEqual(stamp.o.ingredients, [{ marker: 'ingredient' }]);
});

test('runVideoJob crop: video record, c2pa.cropped stamp', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  await runVideoJob(host as never, {
    op: 'crop', source: { id: 'c', type: 'video', url: 'blob:c', format: 'mp4' } as never, sourceName: 'c.mp4',
    crop: { rect: { x: 0, y: 0, w: 4, h: 4 }, fps: 30, bitrate: 8_000_000 },
  }, {}, baseDeps(cap, null, writer) as never);
  const rec = uploaded[0]!;
  assert.equal(rec.type, 'video');
  assert.equal(rec.aiGenerated, undefined);
  assert.equal((cap.calls[0]!.o.actions as Array<{ action: string }>)[0]!.action, 'c2pa.cropped');
  // No ingredient when the source carries no credential.
  assert.equal(cap.calls[0]!.o.ingredients, undefined);
});

test('runVideoJob upscale: aiGenerated partial + composite source type stamp', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  await runVideoJob(host as never, {
    op: 'upscale', source: { id: 'u', type: 'video', url: 'blob:u', format: 'mp4' } as never, sourceName: 'u.mp4',
    upscale: { model: 'realesr-general-x4v3', fps: 30, bitrate: 12_000_000 },
  }, {}, baseDeps(cap, null, writer) as never);
  const rec = uploaded[0]!;
  assert.equal(rec.type, 'video');
  assert.equal(rec.aiGenerated, 'partial');
  const action = (cap.calls[0]!.o.actions as Array<{ digitalSourceType?: string }>)[0]!;
  assert.equal(action.digitalSourceType, COMPOSITE_SOURCE_TYPE);
});

test('runVideoJob: a cancel before any output resolves null and saves nothing', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('webp');
  const ref = await runVideoJob(host as never, {
    op: 'matte', source: { id: 'x', type: 'video', url: 'blob:x', format: 'mp4' } as never, sourceName: 'x.mp4',
    matte: { model: 'u2netp', format: 'webp', fps: 12, longEdge: 720 },
  }, { isCancelled: () => true }, baseDeps(cap, null, writer) as never);
  assert.equal(ref, null);
  assert.equal(uploaded.length, 0);
  assert.equal(cap.calls.length, 0);
});

test('transcodeVideo honours the requested container, fps and bitrate without saving a catalogue copy', async () => {
  const reader = fakeReader(3, 5, 7);
  const writer = fakeWriter('webm');
  let plan: Record<string, unknown> | undefined;
  const out = await transcodeVideo('blob:clip', { format: 'webm', fps: 24, bitrate: 3_500_000 }, {}, {
    fetchBytes: async () => ({ blob: new Blob(['src']), bytes: new Uint8Array([1, 2, 3]) }),
    openReader: async (_blob, fps) => { assert.equal(fps, 24); return reader; },
    openVideoWriter: async (p) => { plan = p as unknown as Record<string, unknown>; return writer; },
    hasAudio: async () => false,
    decodeAudio: async () => null,
  });
  assert.equal(out?.format, 'webm');
  assert.equal(out?.fps, 12, 'the decoder-resolved cadence is reported for provenance');
  assert.equal(out?.bitrate, 3_500_000);
  assert.equal(plan?.format, 'webm');
  assert.equal(plan?.bitrate, 3_500_000);
  assert.equal(plan?.width, 4, 'odd dimensions are made encoder-safe');
  assert.equal(plan?.height, 6);
});

test('transcodeVideo rejects a writer that returns a different container', async () => {
  await assert.rejects(() => transcodeVideo('blob:clip', { format: 'webm', fps: 0, bitrate: 2_000_000 }, {}, {
    fetchBytes: async () => ({ blob: new Blob(['src']), bytes: new Uint8Array([1, 2, 3]) }),
    openReader: async () => fakeReader(1),
    openVideoWriter: async () => fakeWriter('mp4'),
    hasAudio: async () => false,
    decodeAudio: async () => null,
  }), /MP4 instead of WEBM/);
});

test('transcodeVideo refuses to silently mute a source whose audio cannot be preserved', async () => {
  await assert.rejects(() => transcodeVideo('blob:clip', { format: 'mp4', fps: 0 }, {}, {
    fetchBytes: async () => ({ blob: new Blob(['src']), bytes: new Uint8Array([1, 2, 3]) }),
    openReader: async () => fakeReader(1),
    openVideoWriter: async () => fakeWriter('mp4'),
    hasAudio: async () => true,
    decodeAudio: async () => null,
  }), /stopped instead of making a muted file/);
});

// ── caps + estimate helpers ────────────────────────────────────────────────────

test('matteOutputFrames: fps × duration, clamped to the in-memory cap', () => {
  assert.equal(matteOutputFrames(10, 12), 120);
  assert.ok(matteOutputFrames(10_000, 12) === MATTE_MAX_OUTPUT_FRAMES);
});

test('extrapolateEstimate + scaledEvenDims', () => {
  const est = extrapolateEstimate({ perFrameMs: 100, sampleFrameBytes: 1000 }, 300);
  assert.equal(est.totalMs, 30000);
  assert.equal(est.totalBytes, 300000);
  const d = scaledEvenDims(1920, 1080, 720);
  assert.equal(Math.max(d.width, d.height), 720);
  assert.equal(d.width % 2, 0);
  assert.equal(d.height % 2, 0);
});

// ── colour-range (chroma) key: destination resolution + model-free background removal ─

/** An RGBA frame filled with one colour, fully opaque. */
function solidRGBA(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
  return data;
}

// The per-pixel keying MATH (key/far/soft-edge, OKLab perceptual distance, spill,
// determinism) is owned by the engine module and pinned in engine/src/chroma-key.test.ts.
// Here we pin only how the PIPELINE uses it: scale-then-key, and the model-free run.

test('clampMatteLongEdge: feeds the chosen resolution but never upscales past the source or the matte cap', () => {
  assert.equal(clampMatteLongEdge(1080, 1920), 1080, 'fits under the source → the request wins');
  assert.equal(clampMatteLongEdge(1080, 720), 720, 'clamped down to the source (no upscaling)');
  assert.equal(clampMatteLongEdge(720, 4000), 720, 'a huge source leaves the request intact');
  assert.equal(clampMatteLongEdge(3000, 4000), MATTE_MAX_INPUT_LONG_EDGE, 'capped at the matte input ceiling');
  assert.equal(clampMatteLongEdge(720, 0), 720, 'an unknown source falls back to the request');
});

test('resizeFrameRGBA: downscales to the target dims and never aliases the source buffer', () => {
  const src = { data: solidRGBA(8, 8, 10, 20, 30), width: 8, height: 8 };
  const out = resizeFrameRGBA(src, 4, 4);
  assert.equal(out.width, 4);
  assert.equal(out.height, 4);
  assert.equal(out.data.length, 4 * 4 * 4);
  // A same-size resize returns a COPY, so mutating it can't corrupt the reader's frame.
  const copy = resizeFrameRGBA(src, 8, 8);
  assert.notEqual(copy.data, src.data);
  copy.data[0] = 250;
  assert.equal(src.data[0], 10, 'the source is untouched');
});

test('makeChromaKeyOp: scales to the destination long edge AND removes a flat background', async () => {
  const op = makeChromaKeyOp({ keyColor: CHROMA_DEFAULT_KEY, tolerance: 0.12, softness: 0.1, spill: 0 }, 4);
  const frame = { data: solidRGBA(8, 8, 0, 177, 64), width: 8, height: 8, timestampUs: 0, durationUs: 1000 };
  const out = await op(frame as never);
  assert.equal(Math.max(out.width, out.height), 4, 'the destination-resolution long edge is honoured');
  // The whole frame was the key colour → every pixel keys out.
  let maxAlpha = 0;
  for (let i = 3; i < out.data.length; i += 4) maxAlpha = Math.max(maxAlpha, out.data[i]!);
  assert.equal(maxAlpha, 0, 'a flat key-coloured frame becomes fully transparent');
});

test('videoProvenanceFor: matte via colour key = plain c2pa.edited, no model name, no aiGenerated', () => {
  const p = videoProvenanceFor('matte', { method: 'chroma' });
  assert.equal(p.tool, 'Remove background');
  assert.equal(p.actions[0]!.action, 'c2pa.edited');
  assert.match(p.actions[0]!.description ?? '', /colour key/i);
  assert.equal(p.aiGenerated, undefined);
});

test('runVideoJob matte via chroma: model-free, plain colour-key stamp, source content credential carried', async () => {
  const { host, uploaded } = fakeHost();
  // Prove the chroma path never touches the model: make the model throw if called.
  (host.matte as { run: unknown }).run = async () => { throw new Error('the model must not run for a colour key'); };
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('webp');
  // The source video carries a Content Credential; it MUST survive as an ingredient.
  const ref = await runVideoJob(host as never, {
    op: 'matte', source: { id: 'user/video/clip', type: 'video', url: 'blob:clip', format: 'mp4' } as never, sourceName: 'clip.mp4',
    matte: { model: 'u2netp', format: 'webp', fps: 12, longEdge: 720, method: 'chroma', chroma: { keyColor: { r: 255, g: 255, b: 255 }, tolerance: 0.12, softness: 0.1, spill: 0.5 } },
  }, {}, baseDeps(cap, { marker: 'source-credential' }, writer) as never);
  assert.ok(ref, 'the job completed without the model');
  const rec = uploaded[0]!;
  assert.equal(rec.type, 'raster');
  assert.equal(rec.format, 'webp');
  assert.equal((rec.meta as Record<string, unknown>).animated, true);
  assert.equal(rec.aiGenerated, undefined, 'a colour key is not AI-generated');
  const stamp = cap.calls[0]!;
  assert.match((stamp.o.actions as Array<{ description?: string }>)[0]!.description ?? '', /colour key/i);
  assert.deepEqual(stamp.o.ingredients, [{ marker: 'source-credential' }], 'the source video Content Credential is preserved as an ingredient');
});

// ── grade + trim + the range window (plans/130) ────────────────────────────────
//
// The LUT/grain MATHS belong to the engine (engine/src/grade.test.ts pins the
// sampling, the tetrahedral interpolation and the darkroom-identical grain). What
// is pinned here is how the PIPELINE uses them: one parse per job, a per-frame
// seed, the audio windowed before it reaches the writer, and the range reaching
// the reader seam at all.

const {
  makeGradeOp, sliceAudio, videoJobRefusal, videoJobIds,
} = await import('./video-jobs.ts');

/** A 2-point 3D LUT that maps EVERY input colour to pure blue - degenerate on
 *  purpose, so the assertion is about the LUT being read and applied, not about
 *  which interpolation weights fell out. */
const FLAT_BLUE_CUBE = ['TITLE "Flat blue"', 'LUT_3D_SIZE 2', ...Array.from({ length: 8 }, () => '0.0 0.0 1.0')].join('\n');

/** A decoded-audio stand-in: `sec` seconds of a ramp, one channel. */
function fakeAudioBuffer(sec: number, sampleRate = 1000): {
  length: number; numberOfChannels: number; sampleRate: number; getChannelData(): Float32Array;
} {
  const length = Math.round(sec * sampleRate);
  const chan = new Float32Array(length);
  for (let i = 0; i < length; i++) chan[i] = i;
  return { length, numberOfChannels: 1, sampleRate, getChannelData: () => chan };
}

/** The grade params with everything off - each test turns on only what it pins. */
function gradeParams(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { cubeText: '', lutIntensity: 1, grain: 0, grainSize: 2, vignette: 0, seed: 1, fps: 30, bitrate: 8_000_000, ...over };
}

test('runVideoJob grade: the LUT recolours every frame, the audio rides along, and the stamp names the look', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const plans: Array<{ width: number; height: number; audio?: unknown }> = [];
  const audio = fakeAudioBuffer(4);
  const deps = {
    ...baseDeps(cap, null, writer),
    decodeAudio: async () => audio,
    openVideoWriter: async (plan: { width: number; height: number; audio?: unknown }) => { plans.push(plan); return writer; },
  };
  const ref = await runVideoJob(host as never, {
    op: 'grade', source: { id: 'g', type: 'video', url: 'blob:g', format: 'mp4' } as never, sourceName: 'clip.mp4',
    grade: gradeParams({ cubeText: FLAT_BLUE_CUBE, lutLabel: 'Flat blue' }),
  } as never, {}, deps as never);

  assert.ok(ref);
  // Every source frame was solid mid-grey; the LUT maps it to blue, alpha untouched.
  const out = writer.frames[0]!.data;
  assert.ok(out[0]! <= 4 && out[1]! <= 4, 'red/green pulled to zero by the LUT');
  assert.ok(out[2]! >= 250, 'blue pushed to full by the LUT');
  assert.equal(out[3], 255, 'alpha is never a colour channel');
  // Grade keeps the source dimensions and the source sound.
  assert.equal(plans[0]!.width, 4);
  assert.equal(plans[0]!.audio, audio, 'the whole track reaches the writer when there is no range');
  const rec = uploaded[0]!;
  assert.equal(rec.type, 'video');
  assert.equal(rec.aiGenerated, undefined, 'a colour grade invents nothing');
  assert.match(rec.id as string, /^user\/video\/\d+-clip-graded\.mp4$/);
  const stamp = cap.calls[0]!;
  const action = (stamp.o.actions as Array<{ action: string; description?: string }>)[0]!;
  assert.equal(action.action, 'c2pa.color_adjustments');
  assert.match(action.description ?? '', /Flat blue/);
});

test('runVideoJob grade: grain with no LUT still changes the pixels, and the noise MOVES frame to frame', async () => {
  const { host } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const deps = { ...baseDeps(cap, null, writer), openReader: async () => fakeReader(2, 8, 8, 128) };
  await runVideoJob(host as never, {
    op: 'grade', source: { id: 'g2', type: 'video', url: 'blob:g2', format: 'mp4' } as never, sourceName: 'g2.mp4',
    grade: gradeParams({ cubeText: '', grain: 1, grainSize: 2, seed: 7 }),
  } as never, {}, deps as never);

  const [a, b] = [writer.frames[0]!.data, writer.frames[1]!.data];
  const rgb = (d: Uint8ClampedArray): number[] => [...d].filter((_, i) => i % 4 !== 3);
  assert.ok(rgb(a).some((v) => v !== 128), 'grain moved the flat frame off 128');
  assert.notDeepEqual(rgb(a), rgb(b), 'the grain seed advances per frame - a fixed lattice would read as dirt on the lens');
});

test('runVideoJob trim: pixels pass through untouched, the range reaches the reader AND the audio slice', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const plans: Array<{ audio?: { length: number } | null }> = [];
  let seenRange: unknown = 'never called';
  const deps = {
    ...baseDeps(cap, null, writer),
    openReader: async (_blob: Blob, _fps: number, range?: unknown) => { seenRange = range; return fakeReader(3); },
    decodeAudio: async () => fakeAudioBuffer(10),
    openVideoWriter: async (plan: { audio?: { length: number } | null }) => { plans.push(plan); return writer; },
  };
  const ref = await runVideoJob(host as never, {
    op: 'trim', source: { id: 'tr', type: 'video', url: 'blob:tr', format: 'mp4' } as never, sourceName: 'talk.mp4',
    trim: { fps: 0, bitrate: 8_000_000 }, range: { startSec: 2, endSec: 5 },
  } as never, {}, deps as never);

  assert.ok(ref);
  assert.deepEqual(seenRange, { startSec: 2, endSec: 5 }, 'the reader decides the window; the loop never re-times frames');
  assert.equal(writer.frames[0]!.data[0], 128, 'a trim is the identity op - no pixel is touched');
  assert.equal(plans[0]!.audio!.length, 3000, '3 seconds of a 1kHz track, sliced before the muxer sees it');
  const rec = uploaded[0]!;
  assert.match(rec.id as string, /^user\/video\/\d+-talk-trimmed\.mp4$/);
  const action = (cap.calls[0]!.o.actions as Array<{ action: string; description?: string }>)[0]!;
  assert.equal(action.action, 'c2pa.edited');
  assert.match(action.description ?? '', /Trimmed/);
});

test('videoJobIds: grade and trim get their own kind + label', () => {
  assert.match(videoJobIds('grade', 'my clip.mp4', 'mp4', 1700).id, /^user\/video\/1700-my-clip-graded\.mp4$/);
  assert.equal(videoJobIds('grade', 'my clip.mp4', 'mp4', 1700).name, 'Graded my clip');
  assert.match(videoJobIds('trim', 'my clip.mp4', 'mp4', 1700).id, /^user\/video\/1700-my-clip-trimmed\.mp4$/);
  assert.equal(videoJobIds('trim', 'my clip.mp4', 'mp4', 1700).name, 'Trimmed my clip');
});

test('sliceAudio: a windowed VIEW of each channel, clamped to the buffer, identity for a full range', () => {
  const rate = 100;
  const total = 1000; // 10 seconds
  const chan = new Float32Array(total);
  for (let i = 0; i < total; i++) chan[i] = i;
  const buf = { length: total, numberOfChannels: 1, sampleRate: rate, getChannelData: () => chan };

  const mid = sliceAudio(buf, 2, 5);
  assert.equal(mid.length, 300);
  assert.equal(mid.sampleRate, rate);
  assert.equal(mid.numberOfChannels, 1);
  assert.equal(mid.getChannelData(0).length, 300);
  assert.equal(mid.getChannelData(0)[0], 200, 'the window starts at startSec × sampleRate');
  assert.equal(mid.getChannelData(0)[299], 499);
  assert.equal(mid.getChannelData(0).buffer, chan.buffer, 'a view, not a copy - a 2-minute stereo track is windowed for free');

  const past = sliceAudio(buf, 8, 99);
  assert.equal(past.length, 200, 'a window running past the end simply stops at the end');
  assert.equal(past.getChannelData(0)[0], 800);

  assert.equal(sliceAudio(buf, 0, 10), buf, 'a full range returns the ORIGINAL buffer');
  assert.equal(sliceAudio(buf, 0, 999), buf, 'so does one clamped back to full');
});

test('videoJobRefusal: the duration cap measures the SELECTED window, not the whole source', () => {
  const long = { longEdge: 1280, durationSec: 200, bytes: 1024 };
  assert.equal(videoJobRefusal('trim', long, { startSec: 10, endSec: 40 }), null, '30s out of a 200s source is an ordinary job');
  assert.match(videoJobRefusal('trim', long, { startSec: 0, endSec: 200 }) ?? '', /too long/i);
  assert.match(videoJobRefusal('grade', long, { startSec: 0, endSec: 500 }) ?? '', /too long/i, 'the window is clamped to the source before it is measured');
  // Nonsense windows are refused before anything is decoded.
  assert.ok(videoJobRefusal('trim', long, { startSec: 5, endSec: 5 }), 'an empty window');
  assert.ok(videoJobRefusal('trim', long, { startSec: 9, endSec: 4 }), 'end before start');
  assert.ok(videoJobRefusal('trim', long, { startSec: -1, endSec: 4 }), 'a negative start');
  assert.ok(videoJobRefusal('trim', long, { startSec: 0, endSec: Number.NaN }), 'a non-finite edge');
  assert.ok(videoJobRefusal('trim', long, { startSec: 500, endSec: 520 }), 'a window entirely past the end of the source');
  // Without a range every existing verdict is unchanged.
  assert.match(videoJobRefusal('crop', long) ?? '', /too long/i);
  assert.equal(videoJobRefusal('crop', { longEdge: 1280, durationSec: 10, bytes: 1024 }), null);
  assert.ok(videoJobRefusal('crop', { longEdge: 1280, durationSec: 0, bytes: 1024 }), 'an unreadable length');
  assert.ok(videoJobRefusal('upscale', { longEdge: 4000, durationSec: 10, bytes: 1024 }), 'the per-op long-edge cap still applies');
});

test('makeGradeOp: a malformed LUT throws when the op is BUILT, not part-way through the clip', () => {
  assert.throws(() => makeGradeOp(gradeParams({ cubeText: 'this is not a LUT at all' }) as never));
  // An empty look is legal: no LUT stage, nothing thrown.
  assert.doesNotThrow(() => makeGradeOp(gradeParams() as never));
});

test('runVideoJob crop with a range: the credential records BOTH edits (crop + trim)', async () => {
  const { host } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const deps = {
    ...baseDeps(cap, null, writer),
    decodeAudio: async () => null,
    openVideoWriter: async () => writer,
  };
  const ref = await runVideoJob(host as never, {
    op: 'crop', source: { id: 'cw', type: 'video', url: 'blob:cw', format: 'mp4' } as never, sourceName: 'window.mp4',
    crop: { rect: { x: 0, y: 0, w: 2, h: 2 }, fps: 30, bitrate: 8_000_000 }, range: { startSec: 1, endSec: 3 },
  } as never, {}, deps as never);

  assert.ok(ref);
  const actions = cap.calls[0]!.o.actions as Array<{ action: string; description?: string }>;
  assert.equal(actions[0]!.action, 'c2pa.cropped', 'the op itself comes first');
  assert.equal(actions[1]!.action, 'c2pa.edited', 'and the window it composed with is the second action');
  assert.match(actions[1]!.description ?? '', /Trimmed/);
});

// ── what reaches the encoder: even dims, the source's own rate, a windowed decode ─
//
// The three things a fake reader can pin about the WRITER PLAN, none of which a
// real codec is needed for: the dimensions are encodable, the frame rate is the
// one the source already had, and the audio handed over is the window rather than
// the whole track. The decoders behind those numbers (mediabunny's frame reader
// and mediabunnyAudioRange) stay browser-smoke-only.

/** A reader a test can dial: odd dims for the even snap, a resolved rate for the
 *  fps plan, and the SOURCE duration the audio fallback gate reads. */
function dialledReader(over: {
  width?: number; height?: number; fps?: number; frames?: number; sourceDurationSec?: number;
} = {}): Record<string, unknown> {
  const width = over.width ?? 4;
  const height = over.height ?? 4;
  const n = over.frames ?? 2;
  return {
    width, height, fps: over.fps ?? 12, frameCount: n,
    ...(over.sourceDurationSec === undefined ? {} : { sourceDurationSec: over.sourceDurationSec }),
    async *read(): AsyncGenerator<Frame, void, unknown> {
      for (let i = 0; i < n; i++) {
        const data = new Uint8ClampedArray(width * height * 4).fill(128);
        for (let p = 3; p < data.length; p += 4) data[p] = 255;
        yield { data, width, height, timestampUs: i * 1000, durationUs: 1000 };
      }
    },
    close(): void { /* nothing to release */ },
  };
}

/** fakeHost with a host.log that keeps what it was told - the only way a DROPPED
 *  audio track is visible to anyone. */
function loggingHost(): { host: unknown; uploaded: Array<Record<string, unknown>>; logs: Array<{ level: string; msg: string }> } {
  const made = fakeHost();
  const logs: Array<{ level: string; msg: string }> = [];
  (made.host as { log: unknown }).log = (level: string, msg: string): void => { logs.push({ level, msg }); };
  return { host: made.host, uploaded: made.uploaded, logs };
}

test('runVideoJob grade + trim: an odd-dimension source is snapped to even before the encoder sees it', async () => {
  for (const op of ['grade', 'trim'] as const) {
    const { host } = fakeHost();
    const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
    const writer = fakeWriter('mp4');
    const plans: Array<{ width: number; height: number }> = [];
    const deps = {
      ...baseDeps(cap, null, writer),
      // 873×481: what an anamorphic PAR or a window-sized screen recording resolves to.
      openReader: async () => dialledReader({ width: 873, height: 481 }),
      openVideoWriter: async (plan: { width: number; height: number }) => { plans.push(plan); return writer; },
    };
    await runVideoJob(host as never, {
      op,
      source: { id: 'odd', type: 'video', url: 'blob:odd', format: 'mp4' } as never,
      sourceName: 'anamorphic.mp4',
      ...(op === 'grade' ? { grade: gradeParams() } : { trim: { fps: 0, bitrate: 8_000_000 } }),
    } as never, {}, deps as never);

    assert.equal(plans[0]!.width, 872, `${op}: an odd width never reaches the encoder (4:2:0 rejects it)`);
    assert.equal(plans[0]!.height, 480, `${op}: nor an odd height`);
  }
});

test('runVideoJob grade: fps 0 asks the reader for the source rate, and the writer plans at exactly that', async () => {
  const { host } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const plans: Array<{ fps: number }> = [];
  let askedFps = -1;
  const deps = {
    ...baseDeps(cap, null, writer),
    openReader: async (_blob: Blob, fps: number) => { askedFps = fps; return dialledReader({ fps: 50 }); },
    openVideoWriter: async (plan: { fps: number }) => { plans.push(plan); return writer; },
  };
  await runVideoJob(host as never, {
    op: 'grade', source: { id: 'r', type: 'video', url: 'blob:r', format: 'mp4' } as never, sourceName: 'fast.mp4',
    grade: gradeParams({ fps: 0 }),
  } as never, {}, deps as never);

  assert.equal(askedFps, 0, "0 is the reader's 'keep the source rate' contract - the same one trim passes");
  assert.equal(plans[0]!.fps, 50, 'a colour look re-times nothing: a 50fps clip is encoded at 50, not resampled to 30');
});

test('runVideoJob with a range: only the WINDOW of the audio is decoded, never the whole track', async () => {
  const { host } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const plans: Array<{ audio?: { length: number } | null }> = [];
  let wholeDecodes = 0;
  let seenRange: unknown = 'never called';
  const deps = {
    ...baseDeps(cap, null, writer),
    // 45 minutes of source behind a 3-second selection - the case the duration cap
    // now admits, and the one a whole-file decode would spend a gigabyte of PCM on.
    openReader: async () => dialledReader({ sourceDurationSec: 2700 }),
    decodeAudio: async () => { wholeDecodes++; return fakeAudioBuffer(2700); },
    decodeAudioRange: async (_blob: Blob, range: { startSec: number; endSec: number }) => {
      seenRange = range;
      return fakeAudioBuffer(range.endSec - range.startSec);
    },
    openVideoWriter: async (plan: { audio?: { length: number } | null }) => { plans.push(plan); return writer; },
  };
  await runVideoJob(host as never, {
    op: 'trim', source: { id: 'lo', type: 'video', url: 'blob:lo', format: 'mp4' } as never, sourceName: 'long.mp4',
    trim: { fps: 0, bitrate: 8_000_000 }, range: { startSec: 100, endSec: 103 },
  } as never, {}, deps as never);

  assert.deepEqual(seenRange, { startSec: 100, endSec: 103 }, 'the window reaches the audio decoder, not just the frame reader');
  assert.equal(wholeDecodes, 0, 'a 45-minute track is never decoded whole to keep 3 seconds of it');
  assert.equal(plans[0]!.audio!.length, 3000, '3 seconds at 1kHz - the window is what the muxer is handed');
});

test('runVideoJob: a declined window decode falls back to the whole track while the source is short enough', async () => {
  const { host, logs } = loggingHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const plans: Array<{ audio?: { length: number } | null }> = [];
  let wholeDecodes = 0;
  const deps = {
    ...baseDeps(cap, null, writer),
    openReader: async () => dialledReader({ sourceDurationSec: 30 }),
    decodeAudio: async () => { wholeDecodes++; return fakeAudioBuffer(30); },
    decodeAudioRange: async () => null,
    openVideoWriter: async (plan: { audio?: { length: number } | null }) => { plans.push(plan); return writer; },
  };
  await runVideoJob(host as never, {
    op: 'trim', source: { id: 'sh', type: 'video', url: 'blob:sh', format: 'mp4' } as never, sourceName: 'short.mp4',
    trim: { fps: 0, bitrate: 8_000_000 }, range: { startSec: 2, endSec: 5 },
  } as never, {}, deps as never);

  assert.equal(wholeDecodes, 1, '30 seconds is what a no-range job decodes anyway - no reason to lose the sound');
  assert.equal(plans[0]!.audio!.length, 3000, 'and the fallback still windows what it decoded');
  assert.deepEqual(logs.filter((l) => l.level === 'warn'), [], 'nothing was dropped, so nothing is warned about');
});

test('runVideoJob: a declined window decode on a long source drops the sound, visibly in the log', async () => {
  const { host, logs } = loggingHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const plans: Array<{ audio?: unknown }> = [];
  let wholeDecodes = 0;
  const deps = {
    ...baseDeps(cap, null, writer),
    openReader: async () => dialledReader({ sourceDurationSec: 2700 }),
    decodeAudio: async () => { wholeDecodes++; return fakeAudioBuffer(2700); },
    decodeAudioRange: async () => null,
    openVideoWriter: async (plan: { audio?: unknown }) => { plans.push(plan); return writer; },
  };
  const ref = await runVideoJob(host as never, {
    op: 'trim', source: { id: 'lo2', type: 'video', url: 'blob:lo2', format: 'mp4' } as never, sourceName: 'long.mp4',
    trim: { fps: 0, bitrate: 8_000_000 }, range: { startSec: 100, endSec: 103 },
  } as never, {}, deps as never);

  assert.ok(ref, 'the job still finishes - the picture is the edit the user asked for');
  assert.equal(wholeDecodes, 0, 'the gigabyte of PCM is never allocated');
  assert.equal(plans[0]!.audio, null, 'the clip ships mute rather than risking the tab');
  const warn = logs.find((l) => l.level === 'warn');
  assert.ok(warn, 'and a dropped track is never silent about being dropped');
  assert.match(warn!.msg, /no sound/i);
});

// ── WP-G: transparent WebM that keeps its sound (plan 153) ─────────────────────
//
// The matte's one output that carries alpha AND audio AND a container credential in
// one file: alpha VP9/AV1 in WebM via mediabunny (CanvasSource alpha:'keep' +
// AudioBufferSource). No real codec exists under node, so the writer's WIRING is
// pinned through an injected fake mediabunny (the alpha config, the first-frame
// handling, the audio guard); the capability gate is pinned through a stubbed
// VideoEncoder; the driver is pinned through the openAlphaVideoWriter dep seam.

/** Replace jsdom's unimplemented getContext('2d') with a minimal stub - the writer
 *  only round-trips RGBA through createImageData/putImageData, none of which jsdom has.
 *  Returns a restore fn. */
function stubCanvas2d(): () => void {
  const proto = (globalThis.window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  const orig = proto.getContext;
  proto.getContext = function getContext(): unknown {
    return {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: (): void => { /* no-op: the pixels reach the encoder in a real browser */ },
    };
  };
  return () => { proto.getContext = orig; };
}

/** A fake of the mediabunny surface alphaVideoWriter drives, recording every wiring
 *  decision (the alpha config, track declarations, adds, lifecycle). */
function fakeAlphaMb(): { mb: unknown; calls: {
  canvasCfg: { codec?: string; bitrate?: number; alpha?: string } | null;
  audioCfg: { codec?: string; bitrate?: number } | null;
  videoTracks: number; audioTracks: number;
  videoAdds: Array<{ ts: number; dur?: number }>; audioAdds: unknown[];
  started: boolean; finalized: boolean; canceled: boolean; isMkv: boolean;
} } {
  const calls = {
    canvasCfg: null as { codec?: string; bitrate?: number; alpha?: string } | null,
    audioCfg: null as { codec?: string; bitrate?: number } | null,
    videoTracks: 0, audioTracks: 0,
    videoAdds: [] as Array<{ ts: number; dur?: number }>, audioAdds: [] as unknown[],
    started: false, finalized: false, canceled: false, isMkv: false,
  };
  const mb = {
    BufferTarget: class { buffer = new ArrayBuffer(8); },
    WebMOutputFormat: class {},
    MkvOutputFormat: class { constructor() { calls.isMkv = true; } },
    CanvasSource: class {
      constructor(_canvas: unknown, cfg: { codec: string; bitrate: number; alpha: string }) { calls.canvasCfg = cfg; }
      async add(ts: number, dur?: number): Promise<void> { calls.videoAdds.push({ ts, dur }); }
    },
    AudioBufferSource: class {
      constructor(cfg: { codec: string; bitrate: number }) { calls.audioCfg = cfg; }
      async add(buf: unknown): Promise<void> { calls.audioAdds.push(buf); }
    },
    Output: class {
      constructor(_o: unknown) {}
      addVideoTrack(): void { calls.videoTracks++; }
      addAudioTrack(): void { calls.audioTracks++; }
      async start(): Promise<void> { calls.started = true; }
      async finalize(): Promise<void> { calls.finalized = true; }
      async cancel(): Promise<void> { calls.canceled = true; }
    },
  };
  return { mb, calls };
}

/** One frame's worth of RGBA at a given alpha - the writer's `write` input. */
function alphaFrame(alpha: number, w = 4, h = 4, ts = 0): Frame {
  const data = new Uint8ClampedArray(w * h * 4).fill(200);
  for (let i = 3; i < data.length; i += 4) data[i] = alpha;
  return { data, width: w, height: h, timestampUs: ts, durationUs: Math.round(1e6 / 12) };
}

/** Swap in a VideoEncoder whose isConfigSupported answers per `fn`; returns a restore. */
function stubVideoEncoder(fn: ((c: { codec: string; alpha?: string }) => { supported?: boolean; config?: { alpha?: string } }) | null): () => void {
  const g = globalThis as { VideoEncoder?: unknown };
  const saved = g.VideoEncoder;
  const had = 'VideoEncoder' in g;
  if (fn === null) delete g.VideoEncoder;
  else g.VideoEncoder = { isConfigSupported: async (c: { codec: string; alpha?: string }) => fn(c) };
  return () => { if (had) g.VideoEncoder = saved; else delete g.VideoEncoder; };
}

test('pickAlphaVideoCodec: refuses without an encoder, on supported:false, and on silently-discarded alpha; offers VP9 where confirmed', async () => {
  // Older Firefox: no VideoEncoder global at all.
  let restore = stubVideoEncoder(null);
  assert.equal(await pickAlphaVideoCodec(640, 360, 12, MATTE_WEBM_BITRATE), null, 'no encoder → no alpha');
  restore();
  // Safari-shaped: the codec is not supported for alpha.
  restore = stubVideoEncoder(() => ({ supported: false }));
  assert.equal(await pickAlphaVideoCodec(640, 360, 12, MATTE_WEBM_BITRATE), null, 'unsupported → refused');
  restore();
  // Supports the codec but normalises alpha away → would encode an OPAQUE video, refuse.
  restore = stubVideoEncoder(() => ({ supported: true, config: { alpha: 'discard' } }));
  assert.equal(await pickAlphaVideoCodec(640, 360, 12, MATTE_WEBM_BITRATE), null, 'alpha dropped → refused');
  restore();
  // Chromium: VP9 alpha confirmed (echoes the requested alpha back).
  restore = stubVideoEncoder((c) => ({ supported: c.codec.startsWith('vp09'), config: { alpha: c.alpha } }));
  assert.deepEqual(await pickAlphaVideoCodec(640, 360, 12, MATTE_WEBM_BITRATE), { codec: 'vp09.00.10.08', muxCodec: 'vp9' });
  restore();
});

test('alphaVideoWriter: marks the track transparent (alpha:keep) even when frame 0 is fully opaque', async () => {
  const restoreCanvas = stubCanvas2d();
  try {
    const { mb, calls } = fakeAlphaMb();
    const writer = await alphaVideoWriter({ fps: 12, bitrate: MATTE_WEBM_BITRATE, codec: 'vp9', audio: null }, async () => mb as never);
    // A fully-opaque frame 0 (every alpha = 255). The track must STILL be transparent:
    // WebM marks it from frame 0's alpha side data, which alpha:'keep' guarantees.
    await writer.write(alphaFrame(255));
    const res = await writer.finalize();
    assert.equal(calls.canvasCfg!.alpha, 'keep', 'the encoder keeps alpha, so an opaque frame 0 still carries alpha side data');
    assert.equal(calls.canvasCfg!.codec, 'vp9', 'the chosen mediabunny codec is used');
    assert.equal(calls.videoTracks, 1);
    assert.equal(calls.videoAdds.length, 1, 'the opaque frame 0 went through the encoder, not skipped');
    assert.equal(calls.started, true);
    assert.equal(calls.finalized, true);
    assert.equal(res.format, 'webm');
    assert.equal(res.width, 4);
    assert.equal(res.height, 4);
  } finally { restoreCanvas(); }
});

test('alphaVideoWriter: audio present adds an Opus track; audio absent produces a valid file with none (no null crash)', async () => {
  const restoreCanvas = stubCanvas2d();
  try {
    // Present: a whole-file AudioBuffer becomes one Opus track.
    const withA = fakeAlphaMb();
    const w1 = await alphaVideoWriter({ fps: 12, bitrate: MATTE_WEBM_BITRATE, codec: 'vp9', audio: fakeAudioBuffer(2) }, async () => withA.mb as never);
    await w1.write(alphaFrame(128));
    await w1.finalize();
    assert.equal(withA.calls.audioTracks, 1, 'sound → one audio track');
    assert.equal(withA.calls.audioCfg!.codec, 'opus', 'WebM/Matroska carry Opus');
    assert.equal(withA.calls.audioAdds.length, 1, 'the whole buffer is added once');

    // Absent (null): no audio track, and finalize must NOT crash on a missing track.
    const noA = fakeAlphaMb();
    const w2 = await alphaVideoWriter({ fps: 12, bitrate: MATTE_WEBM_BITRATE, codec: 'vp9', audio: null }, async () => noA.mb as never);
    await w2.write(alphaFrame(255));
    const r2 = await w2.finalize();
    assert.equal(noA.calls.audioTracks, 0, 'no sound → no audio track');
    assert.equal(noA.calls.audioAdds.length, 0);
    assert.ok(r2.blob, 'a matte with no audio still produces a valid file');

    // Zero-length audio is the same as absent (the ~:994 videoEncodeWriter guard).
    const zeroA = fakeAlphaMb();
    const w3 = await alphaVideoWriter({ fps: 12, bitrate: MATTE_WEBM_BITRATE, codec: 'vp9', audio: fakeAudioBuffer(0) }, async () => zeroA.mb as never);
    await w3.write(alphaFrame(255));
    await w3.finalize();
    assert.equal(zeroA.calls.audioTracks, 0, 'an empty track is never declared');
  } finally { restoreCanvas(); }
});

test('runVideoJob matte webm: a VIDEO record, source audio kept, container C2PA, gated on alpha encode', async () => {
  const restore = stubVideoEncoder((c) => ({ supported: c.codec.startsWith('vp09'), config: { alpha: c.alpha } }));
  try {
    const { host, uploaded } = fakeHost();
    const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
    const writer = fakeWriter('webm');
    const plans: Array<{ codec: string; bitrate: number; audio?: unknown }> = [];
    const audio = fakeAudioBuffer(3);
    const deps = {
      ...baseDeps(cap, { marker: 'ingredient' }, writer),
      decodeAudio: async () => audio,
      openAlphaVideoWriter: async (plan: { codec: string; bitrate: number; audio?: unknown }) => { plans.push(plan); return writer; },
    };
    const ref = await runVideoJob(host as never, {
      op: 'matte', source: { id: 'user/video/clip', type: 'video', url: 'blob:clip', format: 'mp4' } as never, sourceName: 'clip.mp4',
      matte: { model: 'u2netp', format: 'webm', fps: 12, longEdge: 720 },
    }, {}, deps as never);

    assert.ok(ref);
    assert.equal(plans[0]!.codec, 'vp9', 'the driver probes pickAlphaVideoCodec at the encode resolution and passes the pick');
    assert.equal(plans[0]!.bitrate, MATTE_WEBM_BITRATE);
    assert.equal(plans[0]!.audio, audio, 'the whole-file source audio rides into the transparent video');
    const rec = uploaded[0]!;
    assert.equal(rec.type, 'video', 'a transparent WebM is a VIDEO, not an animated raster');
    assert.equal(rec.format, 'webm');
    assert.equal((rec.meta as Record<string, unknown>).animated, undefined, 'not an animated-image record');
    assert.equal(rec.aiGenerated, undefined, 'background removal invents nothing');
    const stamp = cap.calls[0]!;
    assert.equal(stamp.format, 'webm', 'container C2PA is placed for the webm container (placeWebm)');
    assert.equal((stamp.o.actions as Array<{ action: string }>)[0]!.action, 'c2pa.edited');
    assert.deepEqual(stamp.o.ingredients, [{ marker: 'ingredient' }], 'the source credential is carried as an ingredient');
  } finally { restore(); }
});

test('runVideoJob matte webm with no source audio: still a valid transparent video, audio null, no crash', async () => {
  const restore = stubVideoEncoder((c) => ({ supported: c.codec.startsWith('vp09'), config: { alpha: c.alpha } }));
  try {
    const { host, uploaded } = fakeHost();
    const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
    const writer = fakeWriter('webm');
    const plans: Array<{ audio?: unknown }> = [];
    const deps = {
      ...baseDeps(cap, null, writer),
      decodeAudio: async () => null, // the source has no audio track
      openAlphaVideoWriter: async (plan: { audio?: unknown }) => { plans.push(plan); return writer; },
    };
    const ref = await runVideoJob(host as never, {
      op: 'matte', source: { id: 'mute', type: 'video', url: 'blob:mute', format: 'mp4' } as never, sourceName: 'mute.mp4',
      matte: { model: 'u2netp', format: 'webm', fps: 12, longEdge: 720 },
    }, {}, deps as never);

    assert.ok(ref);
    assert.equal(plans[0]!.audio, null, 'no sound to carry');
    assert.equal(uploaded[0]!.type, 'video');
    assert.equal(uploaded[0]!.format, 'webm');
  } finally { restore(); }
});

test('runVideoJob matte webm: refuses (throws) where this browser cannot encode alpha', async () => {
  const restore = stubVideoEncoder(null); // no VideoEncoder → alpha never encodes
  try {
    const { host, uploaded } = fakeHost();
    const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
    const writer = fakeWriter('webm');
    let openedAlpha = false;
    const deps = {
      ...baseDeps(cap, null, writer),
      openAlphaVideoWriter: async () => { openedAlpha = true; return writer; },
    };
    await assert.rejects(
      runVideoJob(host as never, {
        op: 'matte', source: { id: 'x', type: 'video', url: 'blob:x', format: 'mp4' } as never, sourceName: 'x.mp4',
        matte: { model: 'u2netp', format: 'webm', fps: 12, longEdge: 720 },
      }, {}, deps as never),
      /transparent video/i,
    );
    assert.equal(openedAlpha, false, 'the writer is never built when alpha will not encode');
    assert.equal(uploaded.length, 0, 'and nothing is saved');
  } finally { restore(); }
});
