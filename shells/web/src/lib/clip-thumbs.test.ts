// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for clip-thumbs.ts - the parts that are DOM-free or injectable.
 *
 * WHAT IS COVERED HERE (real logic, real module, no mock theatre):
 *   • frameTimes - midpoint sampling, clamping, degenerate spans
 *   • bucketPeaks - the audiogram normalisation, mono mix, silence
 *   • filmstripKey / peaksKey / withinDecodeBudget - cache identity + the ceiling
 *   • createLru - recency, eviction order, dispose-on-evict/overwrite/clear
 *   • createSeekQueue - the Safari rule: never two seeks in flight; strict order;
 *                       latest-wins supersede; abort skipping
 *   • onIdle - the setTimeout fallback path + cancellation
 *   • filmstrip() - resolves empty (never throws) with no DOM present
 *   • stillKey - url + DEVICE-pixel height identity, width deliberately absent
 *   • stillFrames() - the abort short-circuit (no <img>, no request) and the live-
 *                       element fast path (a decoded <img> is used, never re-fetched)
 *   • svgDataUrl - the Lottie route: viewBox → standalone pixel size, the dropped
 *                       percentage style, the namespace, and the markup ceiling
 *   • nodeKey - the frame-bar raster's identity: LRU namespace, signature +
 *                       device-pixel height, clamping, width deliberately absent
 *   • suspendNodeRasters - the export gate: re-entrant, idempotent release
 *   • nodeStill() - through the `_setNodeRasterer` seam: the process-wide lock held
 *                       across a TIMEOUT (no two shots in the library at once), the
 *                       `.seq-off` borrow + offscreen park + restore, the LEASE handover
 *                       to sequence-dom's applier when the playhead lands on a box
 *                       mid-shot, the post-shot reconciler (onNodeShotSettled), the
 *                       failure memory, the
 *                       detached-box refusal, `nodeRasterPending`, and `drainNodeRasters`
 *
 * WHAT IS **NOT** COVERED - browser-only, must be exercised in phase 2B's
 * browser pass, because node has no media pipeline to fake honestly:
 *   • the pooled probe <video> lifecycle (creation, src reuse, idle teardown,
 *     releaseClipThumbs) and the single-run `withProbe` lock
 *   • waitSeekLanded's real rVFC-vs-`seeked` race and its timeout
 *   • waitMetadata, canvas drawImage/createImageBitmap, CORS tainting
 *   • peaks()'s decodeAudioData path (its pure tail bucketPeaks, its declared-size
 *     gate withinDecodeBudget, and its bounded body read readBounded are tested here;
 *     the decode itself needs a real Web Audio implementation)
 *   • ImageBitmap.close() actually running on eviction (the LRU test proves the
 *     dispose *hook* fires; that it frees GPU memory is a browser fact)
 *   • a still actually DECODING - jsdom has no 2D context and no createImageBitmap,
 *     so the capture always stops at the draw step here. That an image/Lottie/tool
 *     bar ends up with the right picture is a browser fact.
 *   • the dom-to-image shot behind `nodeStill` - there is no rasteriser in node at
 *     all, so what a frame bar's photograph LOOKS like, the `.seq-off` strip/restore
 *     around it, and `disableEmbedFonts` are all browser facts. What IS testable is
 *     the panel's use of it, through the `_setNodeRasterer` seam - see
 *     views/timeline-panel.test.ts.
 * A jsdom stand-in would prove nothing about any of those - every one of them is
 * a real-decoder behaviour. They are listed so the browser pass can script them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  frameTimes,
  bucketPeaks,
  filmstripKey,
  peaksKey,
  windowPeaks,
  withinDecodeBudget,
  createLru,
  createSeekQueue,
  onIdle,
  filmstrip,
  frameAt,
  stillFrames,
  stillKey,
  svgDataUrl,
  readBounded,
  nodeKey,
  nodeShotStyle,
  nodeStill,
  setAuthoredPoseSeam,
  withBorrowedVisibility,
  nodeRastersSuspended,
  nodeRasterFailed,
  nodeRasterPending,
  onNodeShotSettled,
  drainNodeRasters,
  clearClipThumbCache,
  _setNodeRasterer,
  suspendNodeRasters,
  NODE_RASTER_TIMEOUT_MS,
  MAX_AUDIO_DECODE_BYTES,
  MAX_FRAMES,
  MAX_NODE_H,
  MAX_STILL_H,
  MAX_SVG_MARKUP,
  type SeekableEl,
} from './clip-thumbs.ts';

// ── frameTimes ───────────────────────────────────────────────────────────────

test('frameTimes: samples slice midpoints, never the in-point itself', () => {
  const t = frameTimes(0, 4, 4, 10);
  assert.deepEqual(t, [0.5, 1.5, 2.5, 3.5]);
  assert.ok((t[0] ?? 0) > 0, 'first sample must not be the black leader frame');
});

test('frameTimes: honours the clip in-point offset', () => {
  assert.deepEqual(frameTimes(2, 6, 2, 30), [3, 5]);
});

test('frameTimes: a non-finite out-point means "to the end of the media"', () => {
  assert.deepEqual(frameTimes(0, Number.NaN, 2, 8), [2, 6]);
});

test('frameTimes: clamps inside the media and never returns a negative time', () => {
  const t = frameTimes(-5, 100, 3, 6);
  assert.equal(t.length, 3);
  for (const v of t) {
    assert.ok(v >= 0, `negative sample ${v}`);
    assert.ok(v <= 6 - 1 / 60 + 1e-9, `sample ${v} past the last decodable frame`);
  }
});

test('frameTimes: unknown duration + no out-point degenerates to one point, not NaN', () => {
  const t = frameTimes(1.5, Number.NaN, 3);
  assert.deepEqual(t, [1.5, 1.5, 1.5]);
});

test('frameTimes: out-point at or before the in-point does not go backwards', () => {
  const t = frameTimes(5, 3, 3, 20);
  assert.equal(t.length, 3);
  for (const v of t) assert.ok(v >= 5, `sample ${v} preceded the in-point`);
});

test('frameTimes: count is clamped to 1..MAX_FRAMES', () => {
  assert.equal(frameTimes(0, 10, 0, 10).length, 1);
  assert.equal(frameTimes(0, 10, -3, 10).length, 1);
  assert.equal(frameTimes(0, 10, 9999, 10).length, MAX_FRAMES);
  assert.equal(frameTimes(0, 10, Number.NaN, 10).length, 1);
});

// ── bucketPeaks ──────────────────────────────────────────────────────────────

test('bucketPeaks: normalises the loudest bucket to 1 with the 0.04 floor', () => {
  // 64 samples: first half quiet, second half loud (stride 32 hits index 0 and 32).
  const ch = new Float32Array(64);
  ch[0] = 0.1;
  ch[32] = 0.5;
  const out = bucketPeaks([ch], 2);
  assert.equal(out.length, 2);
  assert.ok(Math.abs((out[1] ?? 0) - 1) < 1e-6, 'loudest bucket is 1.0');
  assert.ok(Math.abs((out[0] ?? 0) - 0.2) < 1e-6, 'quiet bucket keeps its relative level');
});

test('bucketPeaks: applies the 0.04 visual floor to near-silent buckets', () => {
  const ch = new Float32Array(64);
  ch[0] = 0.0001;
  ch[32] = 1;
  const out = bucketPeaks([ch], 2);
  assert.ok(Math.abs((out[0] ?? 0) - 0.04) < 1e-7, `floor not applied: ${out[0]}`); // f32 storage

});

test('bucketPeaks: digital silence returns zeros (no synthetic placeholder)', () => {
  const out = bucketPeaks([new Float32Array(128)], 4);
  assert.deepEqual([...out], [0, 0, 0, 0]);
});

test('bucketPeaks: mixes two channels as (L+R)/2 and takes |sample|', () => {
  const l = new Float32Array(32);
  const r = new Float32Array(32);
  l[0] = -1; r[0] = 0; // mono mix -0.5, abs 0.5
  const mono = bucketPeaks([l], 1);
  const stereo = bucketPeaks([l, r], 1);
  assert.equal(mono[0], 1);   // normalised against itself
  assert.equal(stereo[0], 1); // also normalised against itself - the mix is proven below
  // Prove the mix by giving bucket B a level that only differs after mixing.
  const l2 = new Float32Array(64);
  const r2 = new Float32Array(64);
  l2[0] = 1; r2[0] = 1;   // bucket 0 mixes to 1.0
  l2[32] = 1; r2[32] = 0; // bucket 1 mixes to 0.5
  const out = bucketPeaks([l2, r2], 2);
  assert.ok(Math.abs((out[0] ?? 0) - 1) < 1e-6);
  assert.ok(Math.abs((out[1] ?? 0) - 0.5) < 1e-6);
});

test('bucketPeaks: empty/absent PCM yields a zero-filled array of the right length', () => {
  assert.equal(bucketPeaks([], 5).length, 5);
  assert.equal(bucketPeaks([new Float32Array(0)], 5).length, 5);
});

test('bucketPeaks: more buckets than samples still returns exactly `buckets` entries', () => {
  const ch = new Float32Array(4);
  ch[0] = 1;
  assert.equal(bucketPeaks([ch], 16).length, 16);
});

// ── cache keys + the decode ceiling ─────────────────────────────────────────

test('filmstripKey: distinguishes url, in, out, count and height', () => {
  const base = { count: 6, h: 40, clipInSec: 0, clipOutSec: 3 };
  const k = filmstripKey('a.mp4', base);
  assert.notEqual(k, filmstripKey('b.mp4', base));
  assert.notEqual(k, filmstripKey('a.mp4', { ...base, clipInSec: 1 }));
  assert.notEqual(k, filmstripKey('a.mp4', { ...base, clipOutSec: 4 }));
  assert.notEqual(k, filmstripKey('a.mp4', { ...base, count: 7 }));
  assert.notEqual(k, filmstripKey('a.mp4', { ...base, h: 41 }));
  assert.equal(k, filmstripKey('a.mp4', { ...base }));
});

test('filmstripKey: clamped inputs collapse to the same key', () => {
  const a = filmstripKey('a.mp4', { count: 999, h: 9999, clipInSec: -1, clipOutSec: 3 });
  const b = filmstripKey('a.mp4', { count: MAX_FRAMES, h: 240, clipInSec: 0, clipOutSec: 3 });
  assert.equal(a, b);
});

test('peaksKey: namespaced apart from filmstrip keys, and keyed by URL ALONE', () => {
  // Deliberately NOT keyed by bucket count or trim window any more: a track is
  // decoded once into a master envelope and every bar width / trim is re-derived
  // from it. Keying by bucket count would decode the same file again for a bar one
  // pixel wider, and keying by window would re-decode on every trim drag.
  assert.equal(peaksKey('a.mp3'), peaksKey('a.mp3'));
  assert.notEqual(peaksKey('a.mp3'), peaksKey('b.mp3'));
  assert.ok(peaksKey('a.mp3').startsWith('p|'));
  assert.ok(filmstripKey('a.mp3', { count: 1, h: 10, clipInSec: 0, clipOutSec: 1 }).startsWith('f|'));
});

// The bug this fixes: the waveform was computed over the WHOLE file and stretched
// across the bar, so trimming a clip squeezed the same picture rather than showing
// the part that plays - and the two halves of a split clip drew identical waveforms.
test('windowPeaks: a trim window shows THAT part of the track, not the whole thing', () => {
  // Master: silent first half, loud second half, over a 10s track.
  const master = new Float32Array(100);
  for (let i = 50; i < 100; i++) master[i] = 1;

  const firstHalf = windowPeaks(master, 10, 0, 5, 10);
  const secondHalf = windowPeaks(master, 10, 5, 10, 10);
  assert.ok(firstHalf.every(v => v === 0), 'the silent half reads silent');
  assert.ok(secondHalf.every(v => v === 1), 'the loud half reads loud');
  assert.notDeepEqual([...firstHalf], [...secondHalf], 'two halves of a split must differ');

  // The whole track still works and is not the same as either half.
  const whole = windowPeaks(master, 10, 0, 10, 10);
  assert.ok(whole.slice(0, 5).every(v => v === 0) && whole.slice(5).every(v => v === 1));
});

test('windowPeaks: total over nonsense - never throws, always the requested length', () => {
  const m = new Float32Array([0, 0.5, 1]);
  for (const [dur, a, b] of [[0, 0, 1], [10, 5, 5], [10, 8, 2], [10, -5, 999], [Number.NaN, 0, 1]] as const) {
    const out = windowPeaks(m, dur as number, a as number, b as number, 8);
    assert.equal(out.length, 8);
    assert.ok(out.every(v => Number.isFinite(v)), `dur=${dur} ${a}->${b} produced a non-finite peak`);
  }
  assert.equal(windowPeaks(new Float32Array(0), 10, 0, 5, 4).length, 4, 'an empty master is silence, not a crash');
  // A window narrower than one master bucket must still show that bucket's level,
  // not fall through the loop and read as silence.
  assert.ok(windowPeaks(new Float32Array([1, 1, 1]), 3, 1.0, 1.01, 4).every(v => v === 1));
});

test('withinDecodeBudget: refuses oversized audio, allows the ceiling exactly', () => {
  assert.equal(withinDecodeBudget(MAX_AUDIO_DECODE_BYTES), true);
  assert.equal(withinDecodeBudget(MAX_AUDIO_DECODE_BYTES + 1), false);
  assert.equal(withinDecodeBudget(0), true);
  // Unknown length must not block - the post-fetch byteLength check catches it.
  assert.equal(withinDecodeBudget(null), true);
  assert.equal(withinDecodeBudget(Number.NaN), true);
});

// ── LRU ──────────────────────────────────────────────────────────────────────

test('createLru: evicts the least-recently-used and disposes exactly that value', () => {
  const closed: string[] = [];
  const lru = createLru<string>(2, (v) => closed.push(v));
  lru.set('a', 'A');
  lru.set('b', 'B');
  lru.get('a');            // refresh a → b is now oldest
  lru.set('c', 'C');
  assert.deepEqual(closed, ['B']);
  assert.deepEqual(lru.keys(), ['a', 'c']);
  assert.equal(lru.size(), 2);
});

test('createLru: overwriting a key disposes the replaced value only', () => {
  const closed: string[] = [];
  const lru = createLru<string>(4, (v) => closed.push(v));
  lru.set('a', 'A1');
  lru.set('a', 'A2');
  assert.deepEqual(closed, ['A1']);
  assert.equal(lru.get('a'), 'A2');
  assert.equal(lru.size(), 1);
});

test('createLru: re-setting the identical value does not dispose it', () => {
  const closed: string[] = [];
  const lru = createLru<string>(4, (v) => closed.push(v));
  lru.set('a', 'A');
  lru.set('a', 'A');
  assert.deepEqual(closed, []);
});

test('createLru: clear disposes everything it held', () => {
  const closed: string[] = [];
  const lru = createLru<string>(4, (v) => closed.push(v));
  lru.set('a', 'A');
  lru.set('b', 'B');
  lru.clear();
  assert.deepEqual(closed.sort(), ['A', 'B']);
  assert.equal(lru.size(), 0);
});

test('createLru: a throwing disposer cannot break eviction', () => {
  const lru = createLru<string>(1, () => { throw new Error('boom'); });
  lru.set('a', 'A');
  lru.set('b', 'B');
  assert.deepEqual(lru.keys(), ['b']);
});

test('createLru: closes real ImageBitmap-shaped values on eviction', () => {
  // Stands in for ImageBitmap: the only contract the cache relies on is close().
  interface Closable { closed: boolean; close(): void }
  const mk = (): Closable => ({ closed: false, close(): void { this.closed = true; } });
  const a = mk(), b = mk(), c = mk();
  const lru = createLru<Closable[]>(1, (arr) => { for (const bmp of arr) bmp.close(); });
  lru.set('x', [a, b]);
  lru.set('y', [c]);
  assert.equal(a.closed, true);
  assert.equal(b.closed, true);
  assert.equal(c.closed, false);
});

// ── seek queue (the Safari rule) ─────────────────────────────────────────────

/** A fake seekable with a manually-resolved frame confirmation. */
function fakeVideo(): {
  el: SeekableEl;
  seeks: number[];
  concurrent: number;
  maxConcurrent: number;
  waitFrame: (el: SeekableEl, signal?: AbortSignal) => Promise<number | null>;
  land(index?: number): void;
  landed: number;
} {
  const state = {
    el: { currentTime: 0 } as SeekableEl,
    seeks: [] as number[],
    concurrent: 0,
    maxConcurrent: 0,
    landed: 0,
    pendingResolvers: [] as ((v: number | null) => void)[],
    waitFrame: (el: SeekableEl): Promise<number | null> => {
      state.seeks.push(el.currentTime);
      state.concurrent++;
      state.maxConcurrent = Math.max(state.maxConcurrent, state.concurrent);
      return new Promise<number | null>((resolve) => {
        state.pendingResolvers.push((v) => { state.concurrent--; state.landed++; resolve(v); });
      });
    },
    land(): void {
      const r = state.pendingResolvers.shift();
      if (r) r(state.el.currentTime);
    },
  };
  return state as never;
}

test('createSeekQueue: never issues a second seek while one is in flight', async () => {
  const fake = fakeVideo();
  const q = createSeekQueue(fake.el, fake.waitFrame);
  const p1 = q.seek(1);
  const p2 = q.seek(2);
  const p3 = q.seek(3);
  await Promise.resolve();
  assert.equal(fake.seeks.length, 1, 'only the first seek may have been issued');
  assert.equal(q.inFlight(), true);
  assert.equal(q.pending(), 2);

  fake.land();
  assert.equal(await p1, 1);
  await Promise.resolve();
  assert.equal(fake.seeks.length, 2);

  fake.land();
  assert.equal(await p2, 2);
  fake.land();
  assert.equal(await p3, 3);
  assert.equal(fake.maxConcurrent, 1, 'two seeks were in flight at once');
  assert.deepEqual(fake.seeks, [1, 2, 3], 'seeks must land in request order');
  assert.equal(q.inFlight(), false);
});

test('createSeekQueue: supersede is latest-wins for QUEUED requests only', async () => {
  const fake = fakeVideo();
  const q = createSeekQueue(fake.el, fake.waitFrame);
  const first = q.seek(1);                        // starts immediately, uninterruptible
  const stale = q.seek(2, { supersede: true });
  const stale2 = q.seek(3, { supersede: true });
  const latest = q.seek(4, { supersede: true });
  await Promise.resolve();
  assert.equal(q.pending(), 1, 'only the newest supersede request survives');
  assert.equal(await stale, null);
  assert.equal(await stale2, null);

  fake.land();
  assert.equal(await first, 1, 'an in-flight seek is never cancelled');
  await Promise.resolve();
  fake.land();
  assert.equal(await latest, 4);
  assert.deepEqual(fake.seeks, [1, 4]);
});

test('createSeekQueue: an aborted queued seek is skipped without touching the element', async () => {
  const fake = fakeVideo();
  const q = createSeekQueue(fake.el, fake.waitFrame);
  const ctrl = new AbortController();
  const p1 = q.seek(1);
  const p2 = q.seek(2, { signal: ctrl.signal });
  const p3 = q.seek(3);
  await Promise.resolve();
  ctrl.abort();
  fake.land();
  assert.equal(await p1, 1);
  assert.equal(await p2, null, 'aborted seek resolves null');
  await Promise.resolve();
  fake.land();
  assert.equal(await p3, 3);
  assert.deepEqual(fake.seeks, [1, 3], 'the aborted target was never seeked to');
});

test('createSeekQueue: many aborted entries drain without recursion or stalling', async () => {
  const fake = fakeVideo();
  const q = createSeekQueue(fake.el, fake.waitFrame);
  const ctrl = new AbortController();
  ctrl.abort();
  const aborted = Array.from({ length: 5000 }, (_, i) => q.seek(i, { signal: ctrl.signal }));
  const real = q.seek(99);
  assert.deepEqual(await Promise.all(aborted.slice(0, 3)), [null, null, null]);
  await Promise.resolve();
  fake.land();
  assert.equal(await real, 99);
  assert.deepEqual(fake.seeks, [99]);
});

test('createSeekQueue: a rejecting frame-wait resolves null and keeps draining', async () => {
  const el: SeekableEl = { currentTime: 0 };
  let calls = 0;
  const q = createSeekQueue(el, () => {
    calls++;
    return calls === 1 ? Promise.reject(new Error('decoder blew up')) : Promise.resolve(el.currentTime);
  });
  assert.equal(await q.seek(1), null);
  assert.equal(await q.seek(2), 2);
  assert.equal(q.inFlight(), false);
});

test('createSeekQueue: clear() drains the backlog without seeking to it', async () => {
  const fake = fakeVideo();
  const q = createSeekQueue(fake.el, fake.waitFrame);
  const p1 = q.seek(1);
  const p2 = q.seek(2);
  await Promise.resolve();
  q.clear();
  assert.equal(await p2, null);
  fake.land();
  assert.equal(await p1, 1);
  assert.deepEqual(fake.seeks, [1]);
});

// ── idle scheduling ──────────────────────────────────────────────────────────

test('onIdle: runs the callback on the setTimeout fallback path', async () => {
  let ran = false;
  onIdle(() => { ran = true; }, 0);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ran, true);
});

test('onIdle: the returned canceller prevents the callback', async () => {
  let ran = false;
  const cancel = onIdle(() => { ran = true; }, 0);
  cancel();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ran, false);
});

// ── headless failure policy ──────────────────────────────────────────────────

test('filmstrip: resolves empty (never throws) with no DOM available', async () => {
  const out = await filmstrip('video.mp4', { count: 4, h: 40, clipInSec: 0, clipOutSec: 2 });
  assert.deepEqual(out, []);
});

test('filmstrip: an empty url resolves empty', async () => {
  assert.deepEqual(await filmstrip('', { count: 4, h: 40, clipInSec: 0, clipOutSec: 2 }), []);
});

test('filmstrip: an already-aborted signal resolves empty promptly', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  assert.deepEqual(await filmstrip('video.mp4', { count: 4, h: 40, clipInSec: 0, clipOutSec: 2 }, ctrl.signal), []);
});

// ── frameAt (the "Export frame" read path - see views/timeline-panel.test.ts for
// the behavioural, DI-seam-backed coverage of the caller: node has no video decode,
// so what is testable here is the same headless failure policy as filmstrip's) ────

test('frameAt: resolves null (never throws) with no DOM available', async () => {
  assert.equal(await frameAt('video.mp4', 1.5), null);
});

test('frameAt: an empty url resolves null', async () => {
  assert.equal(await frameAt('', 1.5), null);
});

test('frameAt: an already-aborted signal resolves null promptly', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  assert.equal(await frameAt('video.mp4', 1.5, ctrl.signal), null);
});

// ── stills (image / lottie / tool-clip bars) ─────────────────────────────────

test('stillKey: the url AND the device-pixel height are both part of the identity', () => {
  // Two bars of the same asset on a 1× and a 2× display must not share a bitmap.
  assert.notEqual(stillKey('a.png', 34), stillKey('a.png', 68));
  assert.notEqual(stillKey('a.png', 34), stillKey('b.png', 34));
  assert.equal(stillKey('a.png', 34), stillKey('a.png', 34));
  // Width is deliberately NOT in the key: the still is tiled, so one bitmap serves
  // every bar width and a zoom step must not force a re-decode.
  assert.equal(stillKey('a.png', 34).includes('|'), true);
  // Clamped the same way the capture clamps, so an absurd height cannot mint keys.
  assert.equal(stillKey('a.png', 1e6), stillKey('a.png', MAX_STILL_H));
  assert.equal(stillKey('a.png', -4), stillKey('a.png', 8));
  // Distinct from the filmstrip/peaks namespaces - one LRU holds all three.
  assert.notEqual(stillKey('a.mp4', 34).slice(0, 2), peaksKey('a.mp4').slice(0, 2));
});

test('stillFrames: empty url, and no DOM at all, resolve empty rather than throwing', async () => {
  assert.deepEqual(await stillFrames('', { h: 34 }), []);
  assert.deepEqual(await stillFrames('a.png', { h: 34 }), []);
});

/**
 * The minimum platform `stillFrames` needs: a `document`, a 2D context that records
 * what was drawn, and a `createImageBitmap` that reports the canvas it snapshotted.
 * The DRAWING is fake (jsdom has no raster); the SIZING, the source choice and the
 * caching around it are the module's own real code. Installed for one test at a time,
 * so the headless-policy tests above keep testing headlessness.
 */
interface DomProbe { made: string[]; drawn: unknown[] }
async function withDom(fn: (probe: DomProbe) => Promise<void>): Promise<void> {
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  const probe: DomProbe = { made: [], drawn: [] };
  const create = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = ((tag: string) => {
    probe.made.push(String(tag).toLowerCase());
    const el = create(tag);
    if (String(tag).toLowerCase() === 'canvas') {
      (el as HTMLCanvasElement).getContext = (() => ({
        drawImage: (src: unknown) => { probe.drawn.push(src); },
      })) as never;
    }
    return el;
  }) as typeof create;
  const g = globalThis as Record<string, unknown>;
  const hadDoc = Object.hasOwn(g, 'document');
  const hadCib = Object.hasOwn(g, 'createImageBitmap');
  const prevDoc = g.document;
  const prevCib = g.createImageBitmap;
  g.document = dom.window.document;
  g.createImageBitmap = async (cv: HTMLCanvasElement) => ({ width: cv.width, height: cv.height, close(): void { /* fake */ } });
  try {
    await fn(probe);
  } finally {
    if (hadDoc) g.document = prevDoc; else delete g.document;
    if (hadCib) g.createImageBitmap = prevCib; else delete g.createImageBitmap;
  }
}

test('stillFrames: an already-aborted signal does no work at all - no <img>, no request', async () => {
  await withDom(async ({ made, drawn }) => {
    const ctrl = new AbortController();
    ctrl.abort();
    assert.deepEqual(await stillFrames('https://example.test/aborted.png', { h: 34 }, ctrl.signal), []);
    // The abort-on-drag/zoom contract: `share()` defers the run by a microtask, so a
    // caller that aborted in the same tick must not have created an element or fired
    // a media request that nothing will ever consume.
    assert.deepEqual(made.filter((tag) => tag === 'img'), [], 'no <img> was ever created');
    assert.deepEqual(drawn, [], 'nothing was drawn');
  });
});

/** A decoded `<img>`, as the canvas would hand one over. jsdom never loads images. */
function decodedImg(w: number, h: number): HTMLImageElement {
  const img = new JSDOM('<!DOCTYPE html><body><img src="a.png"></body>').window.document.querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'complete', { value: true });
  Object.defineProperty(img, 'naturalWidth', { value: w });
  Object.defineProperty(img, 'naturalHeight', { value: h });
  return img;
}

test('stillFrames: a live, already-decoded <img> is drawn instead of re-fetching the url', async () => {
  await withDom(async ({ made, drawn }) => {
    const img = decodedImg(160, 90);
    const frames = await stillFrames('live-img.png', { h: 34 }, undefined, img);
    assert.equal(frames.length, 1, 'one tile-able bitmap');
    assert.deepEqual(made.filter((tag) => tag === 'img'), [], 'the live element was used, not a fresh <img>');
    assert.equal(drawn[0], img, 'the element on the page is what got drawn');
    // The bitmap is captured at the asset's own aspect, at the requested height.
    assert.equal(frames[0]?.height, 34);
    assert.equal(frames[0]?.width, 60, '160×90 at h=34 is 60 wide');
  });
});

test('stillFrames: a second ask for the same key returns the CACHE-OWNED array, not a re-decode', async () => {
  await withDom(async ({ drawn }) => {
    const img = decodedImg(100, 50);
    const first = await stillFrames('cached.png', { h: 40 }, undefined, img);
    assert.equal(first.length, 1);
    assert.equal(drawn.length, 1);
    const again = await stillFrames('cached.png', { h: 40 }, undefined, img);
    // Same instance: the LRU owns these bitmaps and hands the SAME ones to the next
    // caller, which is exactly why a caller may not close or retain them.
    assert.equal(again, first, 'identical array instance, straight from the cache');
    assert.equal(drawn.length, 1, 'no second draw');
    // A different device-pixel height is a different picture, and does decode again.
    await stillFrames('cached.png', { h: 80 }, undefined, img);
    assert.equal(drawn.length, 2);
  });
});

// ── svgDataUrl (the Lottie route: canvas cannot draw an <svg> element) ───────

const svgOf = (attrs: string, inner = '<rect width="10" height="10"/>'): Element => {
  const d = new JSDOM(`<!DOCTYPE html><body><svg ${attrs}>${inner}</svg></body>`, { contentType: 'text/html' });
  return d.window.document.querySelector('svg') as Element;
};

test('svgDataUrl: takes the pixel size from the viewBox and inlines the markup', () => {
  (globalThis as Record<string, unknown>).XMLSerializer = new JSDOM('').window.XMLSerializer;
  const url = svgDataUrl(svgOf('viewBox="0 0 512 288" style="width:100%;height:100%"'));
  assert.ok(url, 'a sized SVG serialises');
  assert.ok(url.startsWith('data:image/svg+xml;charset=utf-8,'), 'inline data URL, no blob to revoke');
  const markup = decodeURIComponent(url.slice('data:image/svg+xml;charset=utf-8,'.length));
  assert.match(markup, /width="512"/, 'the viewBox drives the standalone width');
  assert.match(markup, /height="288"/);
  assert.ok(!markup.includes('width:100%'), 'the percentage style is dropped - it resolves to 0 standalone');
  assert.match(markup, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, 'a standalone SVG needs its namespace');
});

test('svgDataUrl: falls back to width/height attributes, and declines an unsized SVG', () => {
  (globalThis as Record<string, unknown>).XMLSerializer = new JSDOM('').window.XMLSerializer;
  const sized = svgDataUrl(svgOf('width="120" height="60"'));
  assert.ok(sized && decodeURIComponent(sized).includes('width="120"'));
  assert.equal(svgDataUrl(svgOf('')), null, 'no viewBox and no attributes: nothing to rasterise');
  assert.equal(svgDataUrl(svgOf('viewBox="0 0 0 0"')), null, 'a zero viewBox is not a size');
});

test('svgDataUrl: declines markup past the ceiling instead of building the string', () => {
  (globalThis as Record<string, unknown>).XMLSerializer = new JSDOM('').window.XMLSerializer;
  const fat = `<rect width="1" height="1" id="${'x'.repeat(MAX_SVG_MARKUP + 64)}"/>`;
  assert.equal(svgDataUrl(svgOf('viewBox="0 0 10 10"', fat)), null);
});

// ── readBounded (the audio ceiling has to bound the FETCH, not just the decode) ──

/** A Response-shaped stub that streams `chunks` and records whether it was cancelled. */
function bodyOf(chunks: number[]): { res: { body: { getReader(): ReadableStreamDefaultReader<Uint8Array> }; arrayBuffer(): Promise<ArrayBuffer> }; state: { cancelled: boolean; read: number } } {
  const state = { cancelled: false, read: 0 };
  let i = 0;
  const reader = {
    read: async () => {
      if (i >= chunks.length) return { done: true, value: undefined };
      const n = chunks[i++]!;
      state.read += n;
      return { done: false, value: new Uint8Array(n).fill(7) };
    },
    cancel: async () => { state.cancelled = true; },
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
  return {
    res: {
      body: { getReader: () => reader },
      arrayBuffer: async () => { throw new Error('arrayBuffer() must not be used when a stream is available'); },
    },
    state,
  };
}

test('readBounded: assembles a small body byte-for-byte', async () => {
  const { res } = bodyOf([4, 4, 2]);
  const buf = await readBounded(res, 1000);
  assert.ok(buf, 'a body inside the ceiling comes back whole');
  assert.equal(buf.byteLength, 10);
  assert.deepEqual([...new Uint8Array(buf)], new Array(10).fill(7));
});

test('readBounded: abandons an oversized body mid-stream instead of buffering it', async () => {
  // The failure this pins: a chunked response with no Content-Length used to be read
  // in full by arrayBuffer() and only THEN refused, so the allocation happened anyway.
  const { res, state } = bodyOf([100, 100, 100, 100, 100]);
  assert.equal(await readBounded(res, 250), null, 'oversized bodies resolve null');
  assert.equal(state.cancelled, true, 'the stream is cancelled, not drained');
  assert.equal(state.read, 300, 'stopped at the first chunk past the ceiling, not at the end');
});

test('readBounded: an already-aborted signal stops the read and cancels', async () => {
  const { res, state } = bodyOf([10, 10, 10]);
  assert.equal(await readBounded(res, 1000, { aborted: true }), null);
  assert.equal(state.cancelled, true);
});

test('readBounded: falls back to arrayBuffer() only when there is no stream, and still bounds it', async () => {
  const small = { arrayBuffer: async () => new Uint8Array(8).buffer };
  const big = { arrayBuffer: async () => new Uint8Array(4096).buffer };
  assert.equal((await readBounded(small, 100))?.byteLength, 8);
  assert.equal(await readBounded(big, 100), null);
});

test('readBounded: a throwing stream resolves null rather than rejecting into peaks()', async () => {
  const res = {
    body: { getReader: () => ({ read: async () => { throw new Error('network'); }, cancel: async () => {} }) as unknown as ReadableStreamDefaultReader<Uint8Array> },
    arrayBuffer: async () => new ArrayBuffer(0),
  };
  assert.equal(await readBounded(res, MAX_AUDIO_DECODE_BYTES), null);
});

// REGRESSION: an OPEN-ENDED clip (no authored dur - the default music bed, and any box
// promoted with only a Start) must not collapse its window to zero. The panel used to
// pass `dur ?? 0`, which made to === from; windowPeaks then correctly answered silence,
// so the waveform was still painted but flat at the floor - indistinguishable from no
// waveform. The panel now resolves the length through span(); this pins the arithmetic
// that made the symptom, so a future caller passing a zero-width window is caught here
// rather than by eye.
test('windowPeaks: a zero-width window is silence - which is why callers must resolve open-ended lengths', () => {
  const master = new Float32Array(100).fill(1);
  const collapsed = windowPeaks(master, 10, 0, 0, 16);
  assert.ok(collapsed.every(v => v === 0), 'to === from can only mean silence');

  // The same box, with its length resolved to the sequence end, is a real waveform.
  const resolved = windowPeaks(master, 10, 0, 10, 16);
  assert.ok(resolved.every(v => v === 1), 'a resolved open-ended span reads the whole track');
  assert.notDeepEqual([...collapsed], [...resolved]);
});

// ── node rasters (a frame / card / shape bar photographs its own box) ────────

test('nodeKey: namespaced apart from stills, keyed by signature AND device height', () => {
  // One LRU holds filmstrips, stills, peaks and node rasters, so the prefixes must not
  // collide - a still of a url that happened to equal a signature would otherwise be
  // handed to a frame bar (and vice versa).
  assert.ok(nodeKey('sig', 34).startsWith('n|'));
  assert.notEqual(nodeKey('a.png', 34), stillKey('a.png', 34));
  assert.notEqual(nodeKey('a.png', 34).slice(0, 2), peaksKey('a.png').slice(0, 2));

  assert.equal(nodeKey('sig', 34), nodeKey('sig', 34));
  assert.notEqual(nodeKey('sig', 34), nodeKey('other', 34));
  // 1x vs 2x: a 34px bar on a retina display wants its own, sharper bitmap.
  assert.notEqual(nodeKey('sig', 34), nodeKey('sig', 68));
  // Clamped exactly like the capture clamps, so an absurd height cannot mint keys.
  assert.equal(nodeKey('sig', 4), nodeKey('sig', 8));
  assert.equal(nodeKey('sig', 9999), nodeKey('sig', MAX_NODE_H));
});

test('nodeStill: no signature, no element, or no DOM all resolve empty rather than throwing', async () => {
  assert.deepEqual(await nodeStill('', null, { h: 34 }), []);
  assert.deepEqual(await nodeStill('sig', null, { h: 34 }), []);
});

test('suspendNodeRasters: re-entrant, and the release is idempotent', () => {
  // An export brackets itself with this because dom-to-image's globals are shared; two
  // overlapping exports must not have the FIRST one to finish re-arm the thumbnails.
  assert.equal(nodeRastersSuspended(), false);
  const a = suspendNodeRasters();
  const b = suspendNodeRasters();
  assert.equal(nodeRastersSuspended(), true);
  a();
  a();                                   // a double release must not decrement twice
  assert.equal(nodeRastersSuspended(), true, 'the second holder still has it');
  b();
  assert.equal(nodeRastersSuspended(), false);
});

/**
 * A live box on a jsdom stage, plus the platform pieces a node raster needs. The SHOT
 * is injected (`_setNodeRasterer`), because there is no rasteriser in node - what is
 * exercised here is everything the module does AROUND the shot: the lock, the timeout,
 * the class borrow, the failure memory.
 */
async function withNodeStage(
  fn: (ctx: { doc: Document; box: HTMLElement; started: string[] }) => Promise<void>,
): Promise<void> {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="stage"></div></body>');
  const doc = dom.window.document;
  const box = doc.createElement('div');
  box.className = 'lolly-box';
  doc.getElementById('stage')!.appendChild(box);
  const g = globalThis as Record<string, unknown>;
  const hadDoc = Object.hasOwn(g, 'document');
  const hadCib = Object.hasOwn(g, 'createImageBitmap');
  const prevDoc = g.document;
  const prevCib = g.createImageBitmap;
  g.document = doc;
  g.createImageBitmap = async (cv: { width: number; height: number }) => ({ width: cv.width, height: cv.height, close(): void { /* fake */ } });
  clearClipThumbCache();
  try {
    await fn({ doc: doc as unknown as Document, box, started: [] });
  } finally {
    _setNodeRasterer(null);
    clearClipThumbCache();
    if (hadDoc) g.document = prevDoc; else delete g.document;
    if (hadCib) g.createImageBitmap = prevCib; else delete g.createImageBitmap;
  }
}

const canvasOf = (w: number, h: number): HTMLCanvasElement =>
  ({ width: w, height: h }) as HTMLCanvasElement;

test('nodeStill: the process-wide lock is held until the shot REALLY ends, not until it times out', async () => {
  // The corruption this prevents: dom-to-image-more keeps its options, its url cache
  // and its sandbox <iframe> at MODULE scope and clears them at the end of any call.
  // Releasing the lock on the 1.5s timeout let the next shot start while the timed-out
  // one was still inside the library, so the first one's teardown wiped the second's
  // state - the exact overlap the lock exists to prevent. Nothing about a timeout can
  // cancel the call; all the lock can do is refuse to let anyone else in.
  await withNodeStage(async ({ doc }) => {
    const a = doc.createElement('div');
    const b = doc.createElement('div');
    doc.body.appendChild(a);
    doc.body.appendChild(b);
    let live = 0;
    let peak = 0;
    let releaseSlow!: () => void;
    const slow = new Promise<void>((r) => { releaseSlow = r; });
    _setNodeRasterer(async (el) => {
      live++;
      peak = Math.max(peak, live);
      if (el === a) await slow;           // never finishes inside the timeout
      live--;
      return canvasOf(20, 10);
    });

    const first = nodeStill('sig-a', a as HTMLElement, { h: 10 });
    const second = nodeStill('sig-b', b as HTMLElement, { h: 10 });
    // Time the first one out, exactly as NODE_RASTER_TIMEOUT_MS would.
    await new Promise((r) => setTimeout(r, NODE_RASTER_TIMEOUT_MS + 50));
    assert.deepEqual(await first, [], 'the caller gave up on the shot that overran');
    assert.equal(peak, 1, 'but no second call was ever let into the library beside it');

    releaseSlow();
    assert.equal((await second).length, 1, 'and the queued bar still gets its picture');
    assert.equal(peak, 1);
  });
});

test('nodeStill: an off-playhead box is un-hidden for the shot, parked offscreen, and put back', async () => {
  // A frame outside the playhead window carries `.seq-off` → display:none, and
  // dom-to-image copies that into its clone: without the borrow every frame bar
  // photographs blank. Without the PARK the artboard strobes through each frame it
  // photographs. Both have to be undone whichever way the shot ends.
  await withNodeStage(async ({ box }) => {
    box.classList.add('seq-off');
    const seen: string[] = [];
    _setNodeRasterer(async (el) => {
      seen.push(el.className);
      throw new Error('serialisation blew up');     // the ugliest exit path
    });
    assert.deepEqual(await nodeStill('sig', box, { h: 10 }), []);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.includes('seq-off'), false, 'the shot saw a VISIBLE box');
    assert.equal(seen[0]?.includes('tl-shot'), true, 'parked offscreen while it was');
    assert.equal(box.classList.contains('seq-off'), true, 'and the clock’s class came back');
    assert.equal(box.classList.contains('tl-shot'), false, 'and the park is gone');
  });
});

test('onNodeShotSettled: the clock gets the last word after a shot that borrowed the class', async () => {
  // The restore above is a GUESS taken up to 1.5s earlier - the user may have scrubbed
  // onto that very box meanwhile, and re-adding `.seq-off` would leave the ACTIVE frame
  // invisible until the next seek. So the panel hands the clock's `reapply()` here.
  await withNodeStage(async ({ box }) => {
    let reapplied = 0;
    const off = onNodeShotSettled(() => { reapplied++; });
    try {
      _setNodeRasterer(async () => canvasOf(20, 10));
      box.classList.add('seq-off');
      await nodeStill('sig-1', box, { h: 10 });
      assert.equal(reapplied, 1, 'the clock is asked to re-assert what it believes');

      // A box that was already visible borrowed nothing, so there is nothing to fix.
      box.classList.remove('seq-off');
      await nodeStill('sig-2', box, { h: 10 });
      assert.equal(reapplied, 1);
    } finally { off(); }
    box.classList.add('seq-off');
    await nodeStill('sig-3', box, { h: 10 });
    assert.equal(reapplied, 1, 'and an unregistered reconciler is never called again');
  });
});

// ── the borrow is a LEASE ────────────────────────────────────────────────────
//
// The restore above lands up to NODE_RASTER_TIMEOUT_MS after the borrow, and the playhead
// does not wait for it. These three pin the handover with the REAL applier - a copy of
// the class names here would prove nothing about the module that has to honour them.
const seqDom = await import('../bridge/sequence-dom.ts');

test('clip-thumbs copies sequence-dom’s class + attribute names exactly', () => {
  // Both are literals in clip-thumbs.ts on purpose (importing the applier would drag
  // sequence-plan + transitions into picker.ts's chunk for two strings). This is what
  // makes the copies safe: rename one in sequence-dom and this fails.
  assert.equal(seqDom.OFF_CLASS, 'seq-off');
  assert.equal(seqDom.SHOT_CLASS, 'tl-shot');
  assert.equal(seqDom.BORROW_ATTR, 'data-tl-borrowed');
});

/** A timed box the real applier will recognise - one clip, [0,1000). */
function timed(box: HTMLElement): HTMLElement[] {
  box.setAttribute('data-t-start', '0');
  box.setAttribute('data-t-dur', '1000');
  box.setAttribute('data-t-lane', 'seq');
  return [box];
}

/** Put the applier's playhead at `tMs` over `els`, exactly as the clock's frame does. */
function playheadAt(els: HTMLElement[], tMs: number): void {
  seqDom.applyTimeToElements(els, tMs, { seqMs: 2000, store: seqDom.createAuthoredStore() });
}

/**
 * Wait for the borrow to be taken. `nodeStill` queues behind the process-wide shot lock,
 * so how many microtasks separate the call from the park is an implementation detail - 
 * poll for the state instead of counting ticks.
 */
async function untilParked(box: HTMLElement): Promise<void> {
  for (let i = 0; i < 200 && !box.classList.contains('tl-shot'); i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(box.classList.contains('tl-shot'), true, 'the shot parked the box it borrowed');
}

test('nodeStill: scrubbing onto a box mid-shot un-parks it - the shot never hides the live scene', async () => {
  // The headline bug: the applier removed `seq-off` and believed the scene was on screen,
  // but `tl-shot` (translate(-200vw,-200vw)) was still on the box, so the stage stayed
  // black for the rest of the shot and the scene popped in when it settled.
  await withNodeStage(async ({ box }) => {
    const els = timed(box);
    playheadAt(els, 1500);                       // the box is off screen: photographable
    assert.equal(box.classList.contains('seq-off'), true);

    let release!: () => void;
    const slow = new Promise<void>((r) => { release = r; });
    _setNodeRasterer(async () => { await slow; return canvasOf(20, 10); });
    const shot = nodeStill('sig', box, { h: 10 });
    await untilParked(box);

    playheadAt(els, 200);                        // the user scrubs onto this very box
    assert.equal(box.classList.contains('seq-off'), false, 'live at the playhead');
    assert.equal(box.classList.contains('tl-shot'), false, 'and ON the viewport, immediately');

    release();
    await shot;
    assert.equal(box.classList.contains('seq-off'), false,
      'and the late restore does NOT re-hide the frame the clock took over');
    assert.equal(box.classList.contains('tl-shot'), false);
  });
});

test('nodeStill: a box the clock never touches is restored exactly as before', async () => {
  await withNodeStage(async ({ box }) => {
    const els = timed(box);
    playheadAt(els, 1500);
    _setNodeRasterer(async () => canvasOf(20, 10));
    assert.equal((await nodeStill('sig', box, { h: 10 })).length, 1);
    assert.equal(box.classList.contains('seq-off'), true, 'still hidden, as the clock left it');
    assert.equal(box.classList.contains('tl-shot'), false, 'the park is gone');
    assert.equal(box.hasAttribute('data-tl-borrowed'), false, 'and the lease with it');
  });
});

test('nodeStill: a tick that leaves the box off screen must not re-hide it mid-shot', async () => {
  // Re-adding `seq-off` under a running shot photographs the blank the borrow exists to
  // prevent; the box is parked offscreen, so leaving it un-hidden costs nothing visually.
  await withNodeStage(async ({ box }) => {
    const els = timed(box);
    playheadAt(els, 1500);
    let seen = '';
    let release!: () => void;
    const slow = new Promise<void>((r) => { release = r; });
    _setNodeRasterer(async (el) => { await slow; seen = el.className; return canvasOf(20, 10); });
    const shot = nodeStill('sig', box, { h: 10 });
    await untilParked(box);

    playheadAt(els, 1600);                       // another frame, still past the clip
    assert.equal(box.classList.contains('seq-off'), false, 'the shot keeps what it borrowed');
    assert.equal(box.classList.contains('tl-shot'), true, 'and stays parked, so nothing shows');

    release();
    await shot;
    assert.equal(seen.includes('seq-off'), false, 'the shot photographed a VISIBLE box');
    assert.equal(box.classList.contains('seq-off'), true, 'and the class came back afterwards');
  });
});

test('nodeStill: a shot that comes back with nothing is remembered, not retried forever', async () => {
  // A tainted canvas or a subtree past the time budget fails identically every time.
  // Re-attempting it costs a full uncancellable shot to learn the same thing, and - 
  // because the caller's budget is spent in bar order - costs every bar behind it
  // their turn. An ABORT is different: nothing was learned, so it must stay retryable.
  await withNodeStage(async ({ box }) => {
    let calls = 0;
    _setNodeRasterer(async () => { calls++; return null; });
    assert.deepEqual(await nodeStill('doomed', box, { h: 10 }), []);
    assert.deepEqual(await nodeStill('doomed', box, { h: 10 }), []);
    assert.deepEqual(await nodeStill('doomed', box, { h: 10 }), []);
    assert.equal(calls, 1, 'one attempt, ever');
    assert.equal(nodeRasterFailed(nodeKey('doomed', 10)), true);

    // Same box, new appearance: a different picture is a different question.
    assert.deepEqual(await nodeStill('doomed2', box, { h: 10 }), []);
    assert.equal(calls, 2);
  });
});

test('nodeStill: an ABORTED shot is not remembered as a failure - nothing was learned', async () => {
  await withNodeStage(async ({ box }) => {
    let calls = 0;
    _setNodeRasterer(async () => { calls++; return canvasOf(20, 10); });
    const ctrl = new AbortController();
    ctrl.abort();
    assert.deepEqual(await nodeStill('later', box, { h: 10 }, ctrl.signal), []);
    assert.equal(nodeRasterFailed(nodeKey('later', 10)), false);
    assert.equal((await nodeStill('later', box, { h: 10 })).length, 1, 'the next pass asks again');
    assert.equal(calls, 1);
  });
});

test('nodeStill: a DETACHED box is never photographed - an unstyled blank would be cached as its picture', async () => {
  // A shot can wait a long time behind five others. If the runtime re-rendered the tool
  // meanwhile, `job.box` points at a node that is no longer in the document, whose
  // computed styles are empty - and the blank that comes back would be cached under the
  // signature of the box the user is still looking at.
  await withNodeStage(async ({ box }) => {
    let calls = 0;
    _setNodeRasterer(async () => { calls++; return canvasOf(20, 10); });
    box.remove();
    assert.deepEqual(await nodeStill('gone', box, { h: 10 }), []);
    assert.equal(calls, 0, 'the shot was never taken');
    assert.equal(nodeRasterFailed(nodeKey('gone', 10)), false, 'and it stays retryable');
  });
});

test('nodeRasterPending: a bar already in flight is not a miss - that is what makes the retry chain converge', async () => {
  // The budget is per pass, but the shots are serialised, so a continuation pass fires
  // long before its predecessor's have landed in the cache. Counting those as misses
  // made the retry re-spend its whole budget on bars that were already being taken.
  await withNodeStage(async ({ box }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    _setNodeRasterer(async () => { await held; return canvasOf(20, 10); });
    const key = nodeKey('busy', 10);
    assert.equal(nodeRasterPending(key), false);
    const run = nodeStill('busy', box, { h: 10 });
    await Promise.resolve();
    assert.equal(nodeRasterPending(key), true, 'in flight, so no second budget slot');
    release();
    assert.equal((await run).length, 1);
    assert.equal(nodeRasterPending(key), false);
  });
});

test('drainNodeRasters: an export waits the in-flight shot out, but is never held hostage', async () => {
  // suspendNodeRasters() is a gate on the NEXT shot; it can do nothing about the
  // uncancellable one already inside the library, whose teardown clears the sandbox
  // iframe and url cache out from under the export. So the export drains first - with
  // a bound, because a wedged library call must cost a beat, not the whole export.
  await withNodeStage(async ({ box }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    let finished = false;
    _setNodeRasterer(async () => { await held; finished = true; return canvasOf(20, 10); });
    const run = nodeStill('slow', box, { h: 10 });
    // Let the shot actually reach the library. (A shot that has NOT got that far is
    // covered by the suspend alone: it re-checks the gate after taking the lock and
    // bails without calling anything, so there is nothing for the drain to wait on.)
    await new Promise((r) => setTimeout(r, 0));

    const resume = suspendNodeRasters();
    let drained = false;
    const drain = drainNodeRasters().then(() => { drained = true; });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(drained, false, 'the export is still waiting on the live shot');
    release();
    await drain;
    assert.equal(finished, true, 'and it only proceeded once that shot was really done');
    resume();
    await run;

    // The bound: a shot that never ends does not wedge the next export.
    const stuck = new Promise<HTMLCanvasElement>(() => { /* never */ });
    _setNodeRasterer(() => stuck);
    void nodeStill('wedged', box, { h: 10 });
    await Promise.resolve();
    const t0 = Date.now();
    await drainNodeRasters(30);
    assert.ok(Date.now() - t0 < NODE_RASTER_TIMEOUT_MS, 'bounded, not hostage');
  });
});

// ── the authored-pose seam (plans/104 section 6.5) ────────────────────────────────
//
// A thumbnail is a picture of the CLIP, not of the frame the playhead is parked on.
// The authored values live in the applier's AuthoredStore, which this module cannot
// import (bridge/sequence-dom.ts drags sequence-plan → @lolly/engine behind it, and
// picker.ts loads this chunk for `onIdle` alone) - so they arrive injected, and the
// tests below wire the same two readers the timeline panel wires.

/** The seam as the panel supplies it: the real readers, off the real applier. */
const realPoseSeam = { read: seqDom.authoredStyleOf, borrow: seqDom.borrowAuthoredPose };

/** A box the applier will pose: a keyframed lift over an authored blur + opacity. */
function posable(box: HTMLElement): HTMLElement[] {
  box.setAttribute('style', 'left:0px;top:0px;width:200px;height:100px;'
    + 'opacity:0.8;filter:blur(3px) drop-shadow(0px 2px 10px #00000055);');
  box.setAttribute('data-t-start', '0');
  box.setAttribute('data-t-dur', '2000');
  box.setAttribute('data-t-lane', 'seq');
  box.setAttribute('data-t-z', '160');
  box.setAttribute('data-t-kf', 't0_x-80_s0.7_o0.4_b0*t2000_el_x80_s1.3_o1_b9');
  return [box];
}

test('nodeShotStyle: the same five declarations as ever when nobody is composing', () => {
  const dom = new JSDOM('<!DOCTYPE html><div class="lolly-box" style="opacity:0.8;filter:blur(3px);"></div>');
  const box = dom.window.document.querySelector('.lolly-box') as unknown as HTMLElement;
  // No seam wired at all - a picker-only chunk, a test, a shell with no timeline.
  assert.deepEqual(nodeShotStyle(box, 200, 100, 0.17), {
    transform: 'scale(0.17)', transformOrigin: 'top left',
    width: '200px', height: '100px', left: '0', top: '0', margin: '0',
  });
  // …and wired, but over a box no writer has touched: still nothing to neutralise.
  const off = setAuthoredPoseSeam(realPoseSeam);
  try {
    assert.equal(Object.hasOwn(nodeShotStyle(box, 200, 100, 0.17), 'opacity'), false);
    assert.equal(Object.hasOwn(nodeShotStyle(box, 200, 100, 0.17), 'filter'), false);
  } finally { off(); }
});

test('nodeShotStyle: a shot mid-keyframe carries the SAME style as a shot at rest', () => {
  const dom = new JSDOM('<!DOCTYPE html><body><div class="artboard" data-sequence data-seq-ms="2000"'
    + ' style="width:1920px;height:1080px;"><div class="lolly-box"></div></div></body>');
  const root = dom.window.document.querySelector('.artboard') as unknown as HTMLElement;
  const box = dom.window.document.querySelector('.lolly-box') as unknown as HTMLElement;
  posable(box);
  const session = seqDom.createSequenceTime(root);
  const off = setAuthoredPoseSeam(realPoseSeam);
  try {
    const styles: string[] = [];
    let composedFilter = 0;
    for (const t of [0, 400, 1000, 1600, 1999]) {
      session.apply(t);
      // The live box IS posed - lifted, faded and (past the first diamond) blurred.
      assert.notEqual(box.style.transform, '', `the applier really did pose the box at ${t}`);
      assert.notEqual(box.style.opacity, '0.8', `and compose its opacity at ${t}`);
      if (box.style.filter !== 'blur(3px) drop-shadow(0px 2px 10px #00000055)') composedFilter++;
      styles.push(JSON.stringify(nodeShotStyle(box, 200, 100, 0.17)));
    }
    assert.ok(composedFilter >= 3, 'and rewrote the filter across most of the move');
    assert.equal(new Set(styles).size, 1, 'every playhead position photographs identically');
    assert.deepEqual(JSON.parse(styles[0] as string), {
      transform: 'scale(0.17)', transformOrigin: 'top left',
      width: '200px', height: '100px', left: '0', top: '0', margin: '0',
      opacity: '0.8', filter: 'blur(3px) drop-shadow(0px 2px 10px #00000055)',
    }, 'the AUTHORED opacity and blur, not the composed ones');
  } finally { off(); session.restore(); }
});

test('nodeShotStyle: an authored-less box is photographed at 1 / none, never blank', () => {
  // `opacity: ''` on the clone REMOVES the declaration, dropping it back onto the
  // composed value dom-to-image copied out of getComputedStyle - the opposite of the
  // point. A box with nothing authored means 1 and none, spelled out.
  const dom = new JSDOM('<!DOCTYPE html><body><div class="artboard" data-sequence data-seq-ms="2000"'
    + ' style="width:1920px;height:1080px;"><div class="lolly-box"></div></div></body>');
  const root = dom.window.document.querySelector('.artboard') as unknown as HTMLElement;
  const box = dom.window.document.querySelector('.lolly-box') as unknown as HTMLElement;
  box.setAttribute('style', 'left:0px;top:0px;width:200px;height:100px;');
  box.setAttribute('data-t-start', '0');
  box.setAttribute('data-t-dur', '2000');
  box.setAttribute('data-t-kf', 't0_o0.2_b0*t2000_el_o1_b8');
  const session = seqDom.createSequenceTime(root);
  const off = setAuthoredPoseSeam(realPoseSeam);
  try {
    session.apply(1000);
    const style = nodeShotStyle(box, 200, 100, 0.17);
    assert.equal(style.opacity, '1');
    assert.equal(style.filter, 'none');
  } finally { off(); session.restore(); }
});

test('withBorrowedVisibility: the vector twin reads the authored pose, and gives it back', async () => {
  // The twin walks the LIVE subtree - there is no clone to neutralise on - so the
  // authored values go onto the element itself for the walk. The playhead's own frame
  // is put straight back afterwards, at whatever time the clock has reached by then.
  const dom = new JSDOM('<!DOCTYPE html><body><div class="artboard" data-sequence data-seq-ms="2000"'
    + ' style="width:1920px;height:1080px;"><div class="lolly-box"></div></div></body>');
  const root = dom.window.document.querySelector('.artboard') as unknown as HTMLElement;
  const box = dom.window.document.querySelector('.lolly-box') as unknown as HTMLElement;
  posable(box);
  const session = seqDom.createSequenceTime(root);
  const off = setAuthoredPoseSeam(realPoseSeam);
  try {
    session.apply(1200);
    const posed = { filter: box.style.filter, opacity: box.style.opacity, transform: box.style.transform };
    let seen: { filter: string; opacity: string; transform: string } | null = null;
    await withBorrowedVisibility(box, async () => {
      seen = { filter: box.style.filter, opacity: box.style.opacity, transform: box.style.transform };
    });
    assert.deepEqual(seen, {
      filter: 'blur(3px) drop-shadow(0px 2px 10px #00000055)', opacity: '0.8', transform: '',
    });
    assert.deepEqual(
      { filter: box.style.filter, opacity: box.style.opacity, transform: box.style.transform },
      posed, 'the frame the user is looking at is back');
  } finally { off(); session.restore(); }
});

test('withBorrowedVisibility: with no seam wired it is byte-for-byte the old scope', async () => {
  const dom = new JSDOM('<!DOCTYPE html><body><div class="lolly-box" style="opacity:0.8;"></div></body>');
  const box = dom.window.document.querySelector('.lolly-box') as unknown as HTMLElement;
  const before = box.getAttribute('style');
  await withBorrowedVisibility(box, async () => {
    assert.equal(box.getAttribute('style'), before, 'untouched inside');
  });
  assert.equal(box.getAttribute('style'), before, 'and outside');
});
