// SPDX-License-Identifier: MPL-2.0
/**
 * WP-E/WP-H: the lossless-trim FAST PATH wired into runVideoJob (lib/video-jobs.ts).
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/lossless-trim-wire.test.ts
 *
 * The engine (lib/lossless-trim.ts) is proven byte-lossless in its own suite; there are
 * no real codecs under node, so what is pinned HERE is the branch/wiring only, through
 * the `losslessTrim` dep seam a fake records:
 *   - a keyframe-aligned trim takes the fast path: the packet copy's blob is saved, the
 *     transcode writer is never opened, and the C2PA stamp is the SAME `c2pa.edited`
 *     the transcode trim records (finish() signs both),
 *   - a mid-GOP trim (losslessTrim returns null) falls back to the transcode trim
 *     UNCHANGED - the writer runs and encodes every frame,
 *   - exactBounds is on by default (the fast path keeps the exact bounds, so an
 *     off-keyframe cut falls back) and off only when the user opts into snapping,
 *   - a genuine cancel (losslessTrim throws AbortError) resolves null and saves nothing,
 *     matching the transcode path's cancel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { runVideoJob } = await import('./video-jobs.ts');
import type { LosslessTrimCtx, LosslessTrimResult } from './lossless-trim.ts';

type Frame = { data: Uint8ClampedArray; width: number; height: number; timestampUs: number; durationUs: number };

/** A synthetic reader yielding `n` solid-colour frames (mirror of video-jobs.test.ts). */
function fakeReader(n: number, width = 4, height = 4) {
  return {
    width, height, fps: 12, frameCount: n, closed: false,
    async *read(): AsyncGenerator<Frame, void, unknown> {
      for (let i = 0; i < n; i++) {
        const data = new Uint8ClampedArray(width * height * 4).fill(128);
        for (let p = 3; p < data.length; p += 4) data[p] = 255;
        yield { data, width, height, timestampUs: Math.round((i / 12) * 1e6), durationUs: Math.round(1e6 / 12) };
      }
    },
    close() { (this as { closed: boolean }).closed = true; },
  };
}

/** A synthetic writer collecting frames. */
function fakeWriter(format = 'mp4') {
  const frames: Frame[] = [];
  const w = {
    frames, aborted: false, opened: false,
    write(f: Frame) { frames.push(f); },
    async finalize() { const f = frames[0]; return { blob: new Blob(['enc']), format, width: f?.width ?? 0, height: f?.height ?? 0 }; },
    abort() { w.aborted = true; },
  };
  return w;
}

function fakeHost() {
  const uploaded: Array<Record<string, unknown>> = [];
  const host = {
    log() {},
    assets: {
      _uploadUserAsset: async (rec: Record<string, unknown>) => { uploaded.push(rec); },
      get: async (id: string) => ({ id, type: 'video', url: `blob:${id}`, format: 'x' }),
    },
  };
  return { host, uploaded };
}

/** A lossless-trim result for a WebM packet copy. */
function fakeTrimResult(inSec: number, outSec: number, snapped = false): LosslessTrimResult {
  return {
    blob: new Blob(['copied']), container: 'webm', ext: 'webm', mime: 'video/webm',
    videoCodec: 'vp9', audioCodec: 'opus', droppedTracks: 0,
    requestedInSec: inSec, requestedOutSec: outSec,
    snappedInSec: snapped ? 0.2 : inSec, snappedOutSec: outSec, snapped,
    durationSec: outSec - (snapped ? 0.2 : inSec),
  };
}

const SRC = { id: 'tr', type: 'video', url: 'blob:tr', format: 'webm' } as never;

function baseDeps(writer: ReturnType<typeof fakeWriter>, cap: { calls: Array<{ format: string; o: Record<string, unknown> }> }) {
  return {
    fetchBytes: async () => ({ blob: new Blob(['src']), bytes: new Uint8Array([1, 2, 3]) }),
    openReader: async () => fakeReader(3),
    openVideoWriter: async () => { writer.opened = true; return writer; },
    decodeAudio: async () => null,
    extractIngredient: () => ({ marker: 'src-cred' }),
    stamp: async (_h: unknown, blob: Blob, format: string, o: Record<string, unknown>) => { cap.calls.push({ format, o }); return blob; },
  };
}

// ── fast path taken on a keyframe-aligned cut ──────────────────────────────────

test('runVideoJob trim: a keyframe-aligned cut takes the lossless fast path, never re-encodes', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  let seenCtx: LosslessTrimCtx | null = null;
  const deps = {
    ...baseDeps(writer, cap),
    losslessTrim: async (_b: Blob, inSec: number, outSec: number, ctx: LosslessTrimCtx) => {
      seenCtx = ctx;
      return fakeTrimResult(inSec, outSec); // aligned → a result
    },
  };
  const ref = await runVideoJob(host as never, {
    op: 'trim', source: SRC, sourceName: 'talk.webm',
    trim: { fps: 0, bitrate: 8_000_000 }, range: { startSec: 0.2, endSec: 0.6 },
  } as never, {}, deps as never);

  assert.ok(ref, 'the fast path saved a derived asset');
  assert.equal(writer.opened, false, 'the transcode writer was never opened - no re-encode');
  assert.equal(writer.frames.length, 0, 'not a single frame was decoded/encoded');
  // exactBounds defaults ON (no snap opt-in), so an off-keyframe cut would have fallen back.
  assert.equal((seenCtx as unknown as LosslessTrimCtx).exactBounds, true, 'exactBounds is on by default');

  const rec = uploaded[0]!;
  assert.equal(rec.format, 'webm', 'the packet-copy container is saved, not a transcode');
  assert.match(rec.id as string, /^user\/video\/\d+-talk-trimmed\.webm$/);
  assert.equal(rec.width, 4); assert.equal(rec.height, 4);
  // The C2PA credential is the exact transcode-trim stamp: reused verbatim, not a new one.
  const stamp = cap.calls[0]!;
  assert.equal(stamp.format, 'webm');
  const action = (stamp.o.actions as Array<{ action: string; description?: string }>)[0]!;
  assert.equal(action.action, 'c2pa.edited');
  assert.match(action.description ?? '', /Trimmed/);
  assert.deepEqual(stamp.o.ingredients, [{ marker: 'src-cred' }], 'the source video is carried as an ingredient, same as the transcode path');
});

// ── fall back to the transcode trim on a mid-GOP cut ───────────────────────────

test('runVideoJob trim: a mid-GOP cut (losslessTrim → null) falls back to the transcode trim unchanged', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const deps = {
    ...baseDeps(writer, cap),
    losslessTrim: async () => null, // not keyframe-alignable → fall back
  };
  const ref = await runVideoJob(host as never, {
    op: 'trim', source: SRC, sourceName: 'talk.webm',
    trim: { fps: 0, bitrate: 8_000_000 }, range: { startSec: 0.28, endSec: 0.6 },
  } as never, {}, deps as never);

  assert.ok(ref, 'the transcode fallback saved a derived asset');
  assert.equal(writer.opened, true, 'the transcode writer ran');
  assert.equal(writer.frames.length, 3, 'every frame was decoded and re-encoded');
  const rec = uploaded[0]!;
  assert.equal(rec.format, 'mp4', 'the transcode writer output format, not the packet copy');
  // Same credential either way.
  const action = (cap.calls[0]!.o.actions as Array<{ action: string; description?: string }>)[0]!;
  assert.equal(action.action, 'c2pa.edited');
  assert.match(action.description ?? '', /Trimmed/);
});

// ── the snap opt-in flips exactBounds off ──────────────────────────────────────

test('runVideoJob trim: snapToKeyframe passes exactBounds:false so a mid-GOP cut snaps losslessly', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  let seenExact: boolean | undefined = undefined;
  const deps = {
    ...baseDeps(writer, cap),
    losslessTrim: async (_b: Blob, inSec: number, outSec: number, ctx: LosslessTrimCtx) => {
      seenExact = ctx.exactBounds;
      return fakeTrimResult(inSec, outSec, true); // the engine snapped back to a keyframe
    },
  };
  const ref = await runVideoJob(host as never, {
    op: 'trim', source: SRC, sourceName: 'talk.webm',
    trim: { fps: 0, bitrate: 8_000_000, snapToKeyframe: true }, range: { startSec: 0.28, endSec: 0.6 },
  } as never, {}, deps as never);

  assert.ok(ref);
  assert.equal(seenExact, false, 'snapToKeyframe → exactBounds off, so losslessTrim may snap');
  assert.equal(writer.opened, false, 'the snapped cut still copies packets, never re-encodes');
  assert.equal(uploaded[0]!.format, 'webm');
});

// ── a genuine cancel resolves null, saves nothing ──────────────────────────────

test('runVideoJob trim: a cancel from losslessTrim resolves null and saves nothing (matches transcode cancel)', async () => {
  const { host, uploaded } = fakeHost();
  const cap = { calls: [] as Array<{ format: string; o: Record<string, unknown> }> };
  const writer = fakeWriter('mp4');
  const abort = () => { const e = new Error('cancelled'); e.name = 'AbortError'; return e; };
  const deps = {
    ...baseDeps(writer, cap),
    losslessTrim: async () => { throw abort(); },
  };
  const ref = await runVideoJob(host as never, {
    op: 'trim', source: SRC, sourceName: 'talk.webm',
    trim: { fps: 0, bitrate: 8_000_000 }, range: { startSec: 0.2, endSec: 0.6 },
  } as never, { isCancelled: () => true }, deps as never);

  assert.equal(ref, null, 'a cancelled fast path resolves null, exactly like a cancelled transcode');
  assert.equal(uploaded.length, 0, 'nothing was saved');
  assert.equal(writer.opened, false, 'the transcode path was not started after the cancel');
});
