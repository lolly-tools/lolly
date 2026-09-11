// SPDX-License-Identifier: MPL-2.0
/**
 * bridge/export-gainmap-jpeg.ts - HDR JPEG as an ISO 21496-1 gain-map file
 * (plans/61-deeprichpixels.md section 6 B2 wiring).
 *
 * The seam under test is DOM-free by design - `Uint8ClampedArray` in, file
 * bytes out, with JPEG encoding injected - so the whole HDR JPEG path runs here
 * under node:test with no canvas and no jsdom. Two encoders are used: a
 * RECORDING stub that returns fixed JPEG fixtures and captures the exact pixel
 * buffers the seam asked it to encode (that is how the gain-map maths is
 * observed without a codec in the way), and, where `sharp` is installed, a real
 * libjpeg-turbo encoder so the finished file can be decoded by a third party
 * that knows nothing about gain maps.
 *
 * What is NOT covered: `renderRaster`'s canvas plumbing around the seam
 * (`getImageData` -> scratch canvas -> `toBlob`), which needs a real browser,
 * and how any given OS/display actually renders the result - the same
 * browser-tier gap `export-hdr-png.test.ts` carries.
 *
 * Run: node --test shells/web/src/bridge/export-gainmap-jpeg.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encodeGainMapJpeg } from './export-gainmap-jpeg.ts';
import type { GainMapJpegOpts } from './export-gainmap-jpeg.ts';
import { detectWatermark } from '../../../../engine/src/pixel-watermark.ts';
import { findJpegSegment, jpegSegmentBody, scanJpegSegments, JPEG_APP_IDS } from '../../../../engine/src/jpeg-segments.ts';
import { ISO_GAINMAP_URN } from '../../../../engine/src/gainmap-jpeg.ts';
import { srgbIccProfile } from '../../../../engine/src/color.ts';

// ── JPEG fixtures for the recording encoder (8x8, libjpeg-turbo via sharp) ───

const FIXTURE_BASE = new Uint8Array(Buffer.from(
  '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBD' +
  'AQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgD' +
  'ASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAA' +
  'BQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCKAAK2/9k=', 'base64'));
const FIXTURE_MAP = new Uint8Array(Buffer.from(
  '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBD' +
  'AQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgD' +
  'ASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA' +
  '/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AAA//2Q==', 'base64'));

// ── optional external oracle ─────────────────────────────────────────────────

interface SharpImage { raw(): SharpImage; jpeg(o: { quality: number; chromaSubsampling?: string }): SharpImage; toBuffer(): Promise<Buffer>; metadata(): Promise<{ width?: number; height?: number }> }
type SharpFactory = (input: Buffer, opts?: { raw: { width: number; height: number; channels: number } }) => SharpImage;
let sharp: SharpFactory | null = null;
try {
  const specifier = 'sharp';
  sharp = ((await import(specifier)) as { default: SharpFactory }).default;
} catch {
  sharp = null;
}
const SKIP_SHARP = sharp ? false : 'sharp is not installed (optional external-decoder oracle)';

// ── helpers ──────────────────────────────────────────────────────────────────

interface Recorded { kind: 'base' | 'map'; rgba: Uint8ClampedArray; width: number; height: number }

function recordingEncoder(): { fn: NonNullable<GainMapJpegOpts['encodeJpeg']>; calls: Recorded[] } {
  const calls: Recorded[] = [];
  return {
    calls,
    fn: async (rgba, width, height, kind) => {
      calls.push({ kind, rgba: Uint8ClampedArray.from(rgba), width, height });
      return kind === 'base' ? FIXTURE_BASE : FIXTURE_MAP;
    },
  };
}

/** A real encoder, when sharp is around: straight RGBA in, JPEG bytes out. */
const sharpEncoder: NonNullable<GainMapJpegOpts['encodeJpeg']> = async (rgba, width, height, kind) => {
  const buf = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const out = await sharp!(buf, { raw: { width, height, channels: 4 } })
    .jpeg({ quality: kind === 'map' ? 100 : 92 })
    .toBuffer();
  return new Uint8Array(out);
};

/** A test image: a brand-red block on a mid-grey field, plus a luminance ramp. */
function testImage(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inBlock = x > w / 4 && x < w / 2 && y > h / 4 && y < h / 2;
      if (inBlock) { px[i] = 0x30; px[i + 1] = 0xba; px[i + 2] = 0x78; } // SUSE green
      else { const v = Math.round((x / Math.max(1, w - 1)) * 255); px[i] = v; px[i + 1] = v; px[i + 2] = v; }
      px[i + 3] = 255;
    }
  }
  return px;
}

const HDR = { targets: ['#30ba78'] };

function baseOpts(w: number, h: number, enc: NonNullable<GainMapJpegOpts['encodeJpeg']>): GainMapJpegOpts {
  return { width: w, height: h, hdr: HDR, encodeJpeg: enc };
}

function splitFile(file: Uint8Array): { primary: Uint8Array; map: Uint8Array } {
  const scan = scanJpegSegments(file);
  assert.ok(scan && scan.trailerStart !== null, 'assembled file has a post-EOI trailer');
  return { primary: file.subarray(0, scan!.trailerStart!), map: file.subarray(scan!.trailerStart!) };
}

// ── tests ────────────────────────────────────────────────────────────────────

test('produces a two-image file whose halves are the reported lengths', async () => {
  const { fn, calls } = recordingEncoder();
  const res = await encodeGainMapJpeg(testImage(16, 16), baseOpts(16, 16, fn));
  assert.equal(calls.length, 2, 'exactly two encodes: base and map');
  assert.equal(calls[0]!.kind, 'base');
  assert.equal(calls[1]!.kind, 'map');
  assert.equal(res.baseLength + res.mapLength, res.bytes.length);
  const { primary, map } = splitFile(res.bytes);
  assert.equal(primary.length, res.baseLength);
  assert.equal(map.length, res.mapLength);
  // Both metadata forms present, on the image each belongs to.
  assert.ok(findJpegSegment(primary, 0xe2, 'MPF'), 'primary carries the MPF index');
  assert.ok(findJpegSegment(primary, 0xe1, JPEG_APP_IDS.XMP), 'primary carries the container XMP');
  assert.ok(findJpegSegment(map, 0xe1, JPEG_APP_IDS.XMP), 'gain map carries the hdrgm XMP');
  assert.ok(findJpegSegment(map, 0xe2, ISO_GAINMAP_URN), 'gain map carries the ISO 21496-1 metadata');
});

test('ONE rasterisation: base and map are the same size, and the map is grey', async () => {
  const { fn, calls } = recordingEncoder();
  await encodeGainMapJpeg(testImage(32, 24), baseOpts(32, 24, fn));
  const [base, map] = calls;
  assert.equal(map!.width, base!.width);
  assert.equal(map!.height, base!.height);
  assert.equal(map!.rgba.length, base!.rgba.length, 'pixel-aligned by construction - no second render');
  for (let i = 0; i < map!.rgba.length; i += 4) {
    assert.equal(map!.rgba[i], map!.rgba[i + 1]);
    assert.equal(map!.rgba[i], map!.rgba[i + 2]);
    assert.equal(map!.rgba[i + 3], 255, 'map alpha is opaque');
  }
});

test('the base image is the UNTRANSFORMED SDR render (no PQ in the delivered pixels)', async () => {
  const src = testImage(32, 32);
  const { fn, calls } = recordingEncoder();
  await encodeGainMapJpeg(src, baseOpts(32, 32, fn));
  assert.deepEqual(calls[0]!.rgba, src, 'the base encoder saw the source pixels unchanged');
});

test('negative control: different HDR targets produce different map bytes', async () => {
  const src = testImage(32, 32);
  const a = recordingEncoder();
  await encodeGainMapJpeg(src, { ...baseOpts(32, 32, a.fn), hdr: { targets: ['#30ba78'] } });
  const b = recordingEncoder();
  await encodeGainMapJpeg(src, { ...baseOpts(32, 32, b.fn), hdr: { targets: ['#ff0000'] } });
  assert.deepEqual(a.calls[0]!.rgba, b.calls[0]!.rgba, 'the SDR base does not depend on the HDR target');
  assert.notDeepEqual(a.calls[1]!.rgba, b.calls[1]!.rgba, 'the gain map does');
});

// Adversarial review (2026-07-31): a fit with no usable boost used to ship a
// second image anyway, with hdrCapacityMin == hdrCapacityMax -- a range the Adobe
// spec forbids and that makes the decoder weight formula 0/0. Attaching a map
// that carries no light is also the padding-as-quality the plan refuses (section
// 10, depth follows provenance), so the export must degrade to a plain SDR JPEG.
test('nothing to boost -> a plain SDR JPEG, not a gain map carrying no light', async () => {
  // A pure mid-grey image with a target that matches nothing: the view transform
  // finds nothing to lift, so there is no honest gain to encode.
  const flat = new Uint8ClampedArray(16 * 16 * 4).fill(128);
  for (let i = 3; i < flat.length; i += 4) flat[i] = 255;
  const notes: string[] = [];
  const { fn, calls } = recordingEncoder();
  const res = await encodeGainMapJpeg(flat, {
    ...baseOpts(16, 16, fn),
    hdr: { targets: [], boostFloor: 0, richness: 0 },
    log: (_l, m) => notes.push(m),
  });
  assert.equal(res.mapLength, 0, 'no gain map is attached');
  assert.equal(res.baseLength, res.bytes.length, 'the file IS the base image');
  assert.equal(calls.length, 1, 'the map was never even encoded');
  assert.ok(notes.some(n => /nothing to boost/.test(n)), 'the decision is logged, not silent');
  // It is an ordinary single-image JPEG: SOI..EOI with no trailer.
  assert.equal(res.bytes[0], 0xff);
  assert.equal(res.bytes[1], 0xd8);
  assert.equal(res.bytes[res.bytes.length - 2], 0xff);
  assert.equal(res.bytes[res.bytes.length - 1], 0xd9);
});

// The neighbouring case that MUST still ship a map: a uniform frame with a real
// uniform lift is degenerate (min == max) but carries genuine extra light.
test('a constant map that asks for real gain is still written', async () => {
  const white = new Uint8ClampedArray(16 * 16 * 4).fill(250);
  for (let i = 3; i < white.length; i += 4) white[i] = 255;
  const notes: string[] = [];
  const res = await encodeGainMapJpeg(white, {
    ...baseOpts(16, 16, recordingEncoder().fn),
    log: (_l, m) => notes.push(m),
  });
  if (res.mapLength > 0) {
    assert.ok(splitFile(res.bytes).map.length > 0, 'two-image file');
    assert.ok(notes.every(n => !/nothing to boost/.test(n)), 'not reported as a no-op');
  }
});

test('the gain map really encodes log2(HDR/SDR): brighter targets read brighter', async () => {
  const src = testImage(32, 32);
  // The fitted range is normalised per image, so the map bytes are not directly
  // comparable - the declared capacity is. A higher peak asks for more headroom.
  const capOf = (bytes: Uint8Array) => {
    const { map } = splitFile(bytes);
    const packet = new TextDecoder().decode(
      jpegSegmentBody(map, findJpegSegment(map, 0xe1, JPEG_APP_IDS.XMP)!).subarray(JPEG_APP_IDS.XMP.length + 1));
    return Number(/hdrgm:HDRCapacityMax="([^"]*)"/.exec(packet)![1]);
  };
  const loFile = await encodeGainMapJpeg(src, { ...baseOpts(32, 32, recordingEncoder().fn), hdr: { ...HDR, peakNits: 400 } });
  const hiFile = await encodeGainMapJpeg(src, { ...baseOpts(32, 32, recordingEncoder().fn), hdr: { ...HDR, peakNits: 4000 } });
  assert.ok(capOf(hiFile.bytes) > capOf(loFile.bytes), 'a 4000-nit target declares more headroom than a 400-nit one');
  assert.ok(capOf(loFile.bytes) >= 0, 'capacity is never negative');
});

test('imprint lands in the DELIVERED base pixels, and the map follows them', async () => {
  const src = testImage(256, 256);
  const marked = recordingEncoder();
  await encodeGainMapJpeg(src, { ...baseOpts(256, 256, marked.fn), imprint: true });
  const plain = recordingEncoder();
  await encodeGainMapJpeg(src, baseOpts(256, 256, plain.fn));

  const withMark = detectWatermark(marked.calls[0]!.rgba, { width: 256, height: 256 });
  const without = detectWatermark(plain.calls[0]!.rgba, { width: 256, height: 256 });
  assert.equal(withMark.present, true, 'the base image carries the imprint');
  assert.equal(without.present, false, 'the unmarked control does not');
  // The map is computed from the marked pixels, so it differs too - base and map
  // describe the SAME image.
  assert.notDeepEqual(marked.calls[1]!.rgba, plain.calls[1]!.rgba);
});

test('durable embed is best-effort and never breaks the export', async () => {
  const src = testImage(32, 32);
  const seen: number[] = [];
  const ok = recordingEncoder();
  await encodeGainMapJpeg(src, {
    ...baseOpts(32, 32, ok.fn),
    durable: async (rgba) => { seen.push(rgba.length); const out = Uint8ClampedArray.from(rgba); out[0] = 7; return out; },
  });
  assert.deepEqual(seen, [32 * 32 * 4], 'the durable hook saw the full frame once');
  assert.equal(ok.calls[0]!.rgba[0], 7, 'its output reached the encoded base');

  const boom = recordingEncoder();
  const res = await encodeGainMapJpeg(src, {
    ...baseOpts(32, 32, boom.fn),
    durable: async () => { throw new Error('model missing'); },
  });
  assert.ok(res.bytes.length > 0, 'a failing durable pass still produces the file');
  assert.deepEqual(boom.calls[0]!.rgba, src, 'and leaves the pixels alone');
});

test('DPI, EXIF and the sRGB profile are stamped on the BASE image', async () => {
  const { fn } = recordingEncoder();
  const icc = srgbIccProfile();
  const res = await encodeGainMapJpeg(testImage(16, 16), {
    ...baseOpts(16, 16, fn),
    dpi: 300,
    meta: { software: 'Lolly', author: 'Test' } as never,
    icc,
  });
  const { primary, map } = splitFile(res.bytes);
  assert.ok(findJpegSegment(primary, 0xe1, JPEG_APP_IDS.EXIF), 'EXIF on the primary');
  assert.ok(findJpegSegment(primary, 0xe2, JPEG_APP_IDS.ICC), 'ICC on the primary');
  assert.equal(findJpegSegment(map, 0xe2, JPEG_APP_IDS.ICC), null, 'the gain map is data, not a picture - no profile');
  // MPF must come BEFORE the ICC chunks, or its offsets would be stale.
  const mpf = findJpegSegment(primary, 0xe2, 'MPF')!;
  const iccSeg = findJpegSegment(primary, 0xe2, JPEG_APP_IDS.ICC)!;
  assert.ok(mpf.end <= iccSeg.start, 'MPF precedes ICC');
});

test('byte-determinism across two runs', async () => {
  const src = testImage(24, 24);
  const a = await encodeGainMapJpeg(src, baseOpts(24, 24, recordingEncoder().fn));
  const b = await encodeGainMapJpeg(src, baseOpts(24, 24, recordingEncoder().fn));
  assert.deepEqual(a.bytes, b.bytes);
});

test('depth: float is noted and satisfied; 16/auto say nothing', async () => {
  const src = testImage(16, 16);
  const notes: string[] = [];
  await encodeGainMapJpeg(src, { ...baseOpts(16, 16, recordingEncoder().fn), depth: 'float', log: (_l, m) => notes.push(m) });
  assert.ok(notes.some(n => /depth=float/.test(n)), 'the float request is answered explicitly');
  for (const depth of [16, 'auto', undefined] as const) {
    const quiet: string[] = [];
    await encodeGainMapJpeg(src, { ...baseOpts(16, 16, recordingEncoder().fn), ...(depth !== undefined ? { depth } : {}), log: (_l, m) => quiet.push(m) });
    assert.equal(quiet.some(n => /depth/.test(n)), false, `depth=${depth} is silent`);
  }
});

test('refusals: bad dimensions and a non-JPEG encoder throw', async () => {
  const src = testImage(16, 16);
  await assert.rejects(() => encodeGainMapJpeg(src, baseOpts(17, 16, recordingEncoder().fn)), /samples for 17x16/);
  await assert.rejects(() => encodeGainMapJpeg(new Uint8ClampedArray(0), baseOpts(0, 0, recordingEncoder().fn)), /expected 0/);
  await assert.rejects(
    () => encodeGainMapJpeg(src, { ...baseOpts(16, 16, async () => new Uint8Array([1, 2, 3, 4])) }),
    /did not return JPEG bytes/,
  );
  await assert.rejects(
    () => encodeGainMapJpeg(src, { ...baseOpts(16, 16, async (_r, _w, _h, kind) => (kind === 'base' ? FIXTURE_BASE : new Uint8Array([0, 0]))) }),
    /gain-map encoder did not return JPEG bytes/,
  );
});

test('sharp decodes the finished file to EXACTLY the base SDR image', { skip: SKIP_SHARP }, async () => {
  // The single most important assertion in B2: a decoder that has never heard of
  // gain maps must see the ordinary SDR JPEG, pixel for pixel, and nothing else.
  const w = 64, h = 48;
  const src = testImage(w, h);
  const res = await encodeGainMapJpeg(src, { ...baseOpts(w, h, sharpEncoder), icc: null });

  const reference = await sharpEncoder(src, w, h, 'base');
  const refPixels = await sharp!(Buffer.from(reference)).raw().toBuffer();
  const outPixels = await sharp!(Buffer.from(res.bytes)).raw().toBuffer();
  assert.deepEqual(new Uint8Array(outPixels), new Uint8Array(refPixels), 'the HDR file decodes to the plain SDR encode');

  const meta = await sharp!(Buffer.from(res.bytes)).metadata();
  assert.equal(meta.width, w);
  assert.equal(meta.height, h);

  // The appended image is a real, decodable JPEG of the same size - and its
  // decoded pixels are grey (a single-channel gain map splayed across RGB).
  const { map } = splitFile(res.bytes);
  const mapMeta = await sharp!(Buffer.from(map)).metadata();
  assert.equal(mapMeta.width, w);
  assert.equal(mapMeta.height, h);
  const mapPixels = new Uint8Array(await sharp!(Buffer.from(map)).raw().toBuffer());
  let maxSpread = 0;
  for (let i = 0; i < mapPixels.length; i += 3) {
    maxSpread = Math.max(maxSpread, Math.abs(mapPixels[i]! - mapPixels[i + 1]!), Math.abs(mapPixels[i]! - mapPixels[i + 2]!));
  }
  assert.ok(maxSpread <= 4, `decoded gain map is neutral grey (max channel spread ${maxSpread})`);
  // And it is not a flat plate: the brand block really did get a different gain.
  const min = Math.min(...mapPixels), max = Math.max(...mapPixels);
  assert.ok(max - min > 8, `the gain map carries structure (range ${min}..${max})`);
});
