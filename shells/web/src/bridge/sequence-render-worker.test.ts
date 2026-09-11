// SPDX-License-Identifier: MPL-2.0
/**
 * Worker offload of the sequence compositor (phase 4 Track B) - the headless tier.
 *
 * The pixels and the bytes still belong to the browser tier
 * (tests/sequence-render.browser.test.ts), and phase 3's determinism harness is
 * what pins frame-exactness. What node CAN prove, and what this file asserts, is
 * everything around the offload:
 *
 *   • THE SPLIT RULE - a sequence with no live-raster layer never asks the main
 *     thread for anything (100 % worker-side); one with a lottie layer asks
 *     exactly once per active frame, with at most ONE request in flight, and
 *     releases every image it was handed.
 *   • THE MESSAGE PROTOCOL - `handleStart` driven against a stub port and stub
 *     encoder: start → progress ×N → done, log passthrough, need-live/live
 *     round trips, and a failure that aborts the muxer instead of posting bytes.
 *   • CAPABILITY GATING AND FALLBACK - `supportsWorkerSequenceRender()` is false
 *     the moment any piece is missing, and a NON-coded worker failure is
 *     distinguishable from a coded one (only the former may be retried
 *     in-thread; retrying a SEQ_TRUNCATED would just be slower).
 *   • ABORT TEARDOWN - the abort message reaches the worker, the run rejects
 *     coded, and the thread is terminated rather than leaked.
 *
 *   • DETERMINISM BY CONSTRUCTION - the source guard at the end. The worker path
 *     and the in-thread path cannot drift because there is only ONE compositor:
 *     `drawItem` and the frame loop exist in exactly one file, and both hosts
 *     call `runSequenceJob`.
 *
 * Run directly:  node --test shells/web/src/bridge/sequence-render-worker.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  runSequenceJob,
  handleStart,
  drawItem,
  itemFx,
  createFxPlateBudget,
  releaseFxPlates,
  toJobLayer,
  hydrateJobLayer,
  pcmSourceOf,
  jobTransferables,
  type SeqJob,
  type SeqJobLayer,
  type SeqWorkerOut,
  type SeqWorkerStart,
  type AnyCanvas,
  type AnyCtx,
  isOffloadFailure,
  createRunRegistry,
} from './sequence-render.worker.ts';
import {
  supportsWorkerSequenceRender,
  workerSequenceRenderEnabled,
  abortSequenceWorkerRenders,
  SEQ_ABORT_GRACE_MS,
  renderSequenceInWorker,
  _setSequenceWorkerFactory,
  LIVE_RASTER_QUEUE,
} from './sequence-render.ts';
import {
  EMPTY_KF_TRACK, SequenceError, camerasMove, kfTrackOf, sequenceDrawPlan, sequenceError,
  stageCameras,
  type PlanItem,
} from './sequence-plan.ts';
import {
  _resetBlurPool, _setBlurCanvasFactory, parseDropShadows, spillPad,
} from '../lib/canvas-blur.ts';
import type { EncodePick } from './video-encode-core.ts';

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const strip = (src: string): string => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── stubs ───────────────────────────────────────────────────────────────────

/** A 2D context that records nothing but never throws - the compositor's calls
 *  are proven by the browser tier; here only the CONTROL FLOW around them matters. */
function stubCtx(): AnyCtx & { draws: unknown[] } {
  const draws: unknown[] = [];
  const noop = (): void => {};
  return {
    draws,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    clip: noop, clearRect: noop, setTransform: noop,
    drawImage: (src: unknown) => { draws.push(src); },
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  } as unknown as AnyCtx & { draws: unknown[] };
}

let layerIdx = 0;
function layer(over: Partial<SeqJobLayer> = {}): SeqJobLayer {
  const base = toJobLayer({
    el: null as never,
    idx: layerIdx++,
    startMs: 0, durMs: 1000, clipInMs: 0, speed: 1, mute: false, gain: 1, pan: 0, duck: 1, pitch: 0, varispeed: false, fx: '',
    enter: null, enterMs: 0, exit: null, exitMs: 0, enterEase: '', exitEase: '',
    split: '', splitStaggerMs: 0, splitOrder: '', splitUnits: 0, splitSeed: 0,
    hold: '', holdRate: 1,
    lane: 'seq', kind: 'static',
    rect: { x: 0, y: 0, w: 100, h: 100, rot: 0 },
    opacity: 1, blend: '', radius: '', clipPath: '', openEnded: false, frameScene: false,
    z: 0, rx: 0, ry: 0, kf: EMPTY_KF_TRACK, blur: 0, shadowFilter: '',
  });
  return { ...base, ...over };
}

function job(layers: SeqJobLayer[], frames = 4, fps = 4): SeqJob {
  const grid = Array.from({ length: frames }, (_, i) => (i * 1000) / fps);
  return {
    layers, grid, frameCount: frames, fps, totalMs: (frames * 1000) / fps,
    outW: 100, outH: 100, scale: 1,
    bg: null, plates: layers.map((l) => ({ idx: l.idx, under: null, over: null })), clips: [],
    maxLiveProviders: 3, watchdogMs: 1000,
  };
}

// ── the split rule ──────────────────────────────────────────────────────────

test('split rule: a sequence with no live-raster layer never calls back to the main thread', async () => {
  const j = job([layer(), layer({ kind: 'lottie', needsLiveRaster: false })]);
  let asked = 0;
  const frames: number[] = [];
  await runSequenceJob(j, {} as AnyCanvas, stubCtx(), {
    frame: async (_c, _x, i) => { frames.push(i); },
    lottieAt: async () => { asked++; return null; },
  });
  assert.equal(asked, 0, 'nothing needs the DOM, so the worker runs the whole sequence alone');
  assert.deepEqual(frames, [0, 1, 2, 3], 'and every frame was still composed');
});

test('split rule: a live-raster lottie layer is asked once per active frame, one at a time', async () => {
  const j = job([layer({ kind: 'lottie', needsLiveRaster: true, durMs: 500 })]);
  let inFlight = 0;
  let peak = 0;
  const calls: { frame: number; sourceSec: number }[] = [];
  const released: unknown[] = [];
  const img = { tag: 'raster' } as unknown as CanvasImageSource;
  await runSequenceJob(j, {} as AnyCanvas, stubCtx(), {
    frame: async () => {},
    lottieAt: async (_idx, frame, sourceSec) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight--;
      calls.push({ frame, sourceSec });
      return img;
    },
    releaseLottie: (i) => { released.push(i); },
  });
  // durMs 500 over a 4 fps grid: frames 0 and 1 are inside [0, 500).
  assert.deepEqual(calls.map((c) => c.frame), [0, 1], 'only the frames the layer is live for');
  assert.deepEqual(calls.map((c) => c.sourceSec), [0, 0.25], 'and each with its own source time');
  assert.equal(peak, LIVE_RASTER_QUEUE, 'the queue bound is one outstanding request');
  assert.equal(released.length, 2, 'everything handed over is released, so a transferred bitmap cannot leak');
});

test('split rule: a null answer falls back to the static plate rather than failing the frame', async () => {
  const j = job([layer({ kind: 'lottie', needsLiveRaster: true })]);
  const ctx = stubCtx();
  const plate = { tag: 'under' } as unknown as CanvasImageSource;
  j.plates = [{ idx: j.layers[0]!.idx, under: plate, over: null }];
  await runSequenceJob(j, {} as AnyCanvas, ctx, {
    frame: async () => {},
    lottieAt: async () => null,
    releaseLottie: () => { assert.fail('nothing was handed over'); },
  });
  assert.equal(ctx.draws.length, 4, 'every frame still drew');
  assert.ok(ctx.draws.every((d) => d === plate), 'and drew the static plate');
});

test('the executor aborts between frames when the host says so', async () => {
  const j = job([layer()], 10, 10);
  let done = 0;
  const err = await runSequenceJob(j, {} as AnyCanvas, stubCtx(), {
    frame: async () => { done++; },
    aborted: () => done >= 3,
  }).then(() => null, (e: unknown) => e);
  assert.ok(err instanceof SequenceError, 'a cancel is a coded failure');
  assert.equal((err as SequenceError).code, 'SEQ_ABORTED');
  assert.equal(done, 3, 'and it stops where it was told to, not at the end');
});

test('hydrateJobLayer round-trips every field the planner reads', () => {
  const w = layer({ kind: 'video', speed: 2, clipInMs: 500, blend: 'multiply', objectFit: 'cover' });
  const h = hydrateJobLayer(w);
  for (const k of ['idx', 'startMs', 'durMs', 'clipInMs', 'speed', 'mute', 'enter', 'enterMs',
    'exit', 'exitMs', 'lane', 'kind', 'opacity', 'blend', 'radius', 'clipPath', 'openEnded'] as const) {
    assert.deepEqual((h as never as Record<string, unknown>)[k], (w as never as Record<string, unknown>)[k], k);
  }
  assert.deepEqual(h.rect, w.rect);
  assert.ok(h.el && typeof h.el === 'object', 'the element stand-in is an object, so a defensive read cannot throw');
});

test('a keyframed layer survives structuredClone - the wire is plain data, not a closure', () => {
  // plans/104 section 5.1. The evaluator caches a compiled bezier per ease token and a
  // channel index per track; if either ever leaked into the CACHED FORM the track
  // carries, `postMessage` would throw DataCloneError and worker offload would die
  // silently. This is the assertion that keeps the wire boring.
  const track = kfTrackOf('t0_x-120_z40_o0.4_b2*t1500_eb(0.32)(0)(0.67)(1)_x60_z220_o1_b0*t3000_eh_x0');
  assert.equal(track.length, 3);
  const w = layer({ z: 140, kf: track, blur: 2, shadowFilter: 'drop-shadow(0px 21px 46px #00000055)' });
  const cloned = structuredClone(w);
  assert.deepEqual(cloned.kf, w.kf as never, 'every keyframe crossed intact');
  assert.equal(cloned.z, 140);
  assert.equal(cloned.blur, 2);
  assert.equal(cloned.shadowFilter, 'drop-shadow(0px 21px 46px #00000055)');
  // …and the far side hydrates a usable layer out of it.
  const h = hydrateJobLayer(cloned);
  assert.equal(h.z, 140);
  assert.equal(h.kf.length, 3);
  assert.equal(h.kf[1]?.ease, 'eb(0.32)(0)(0.67)(1)');
  assert.equal(h.kf[0]?.v.x, -120);
  // A job built before the feature existed (or by hand) still hydrates.
  const bare = { ...w } as Partial<SeqJobLayer>;
  delete bare.z; delete bare.kf; delete bare.blur; delete bare.shadowFilter;
  const legacy = hydrateJobLayer(bare as SeqJobLayer);
  assert.equal(legacy.z, 0);
  assert.equal(legacy.kf, EMPTY_KF_TRACK);
  assert.equal(legacy.blur, 0);
  assert.equal(legacy.shadowFilter, '');
});

test('a camera layer contributes zero draws (plans/104 section 5.4)', async () => {
  const ctx = stubCtx();
  const cam = layer({ kind: 'camera', z: 200, kf: kfTrackOf('t0_x-100*t1000_x100') });
  const plan = sequenceDrawPlan([hydrateJobLayer(cam)], 500, 1000, { stageW: 1920, stageH: 1080 });
  assert.equal(plan.length, 1, 'it is still a timeline citizen - the camera IS the pose');
  assert.equal(plan[0]!.dx, 0, 'and it is never posed itself');
  // A real plate would still be a no-op here (`under` is null), so the guard is
  // asserted against a layer that HAS one - the only way to tell the two apart.
  const plate = { under: {} as CanvasImageSource, over: null, provider: null, objectFit: '', objectPosition: '', live: null, first: 0, last: 0, span: [], lastStats: null, srcClaimedSec: 0 };
  for (const item of plan) await drawItem(ctx, item, plate as never, 1);
  assert.deepEqual(ctx.draws, [], 'and it paints nothing at all');
});

// ── the compositor restructure (plans/104 section 5.5) ─────────────────────────────
//
// THE BYTE-IDENTITY FLOOR IS THIS FILE'S FIRST TEST, and it is asserted as a literal call
// sequence rather than as a property, because the promise is literal: a document that
// uses no depth feature must export the bytes it always exported. A clean layer never
// asks for a scratch, never enters a blur lane, and issues save → translate →
// drawImage → restore exactly as it did before any of this existed.

interface CtxOp { op: string; args: number[] }

/** A destination context that records the calls in order (no pixels, no decisions). */
function opCtx(): AnyCtx & { ops: CtxOp[]; names(): string[] } {
  const ops: CtxOp[] = [];
  const rec = (op: string) => (...args: unknown[]): void => {
    ops.push({ op, args: args.map((a) => (typeof a === 'number' ? a : Number.NaN)) });
  };
  return {
    ops,
    names: () => ops.map((o) => o.op),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save: rec('save'), restore: rec('restore'),
    translate: rec('translate'), rotate: rec('rotate'), scale: rec('scale'),
    clip: rec('clip'), clearRect: rec('clearRect'), setTransform: rec('setTransform'),
    drawImage: (_src: unknown, ...rest: unknown[]) => {
      ops.push({ op: 'drawImage', args: rest.map(Number) });
    },
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  } as unknown as AnyCtx & { ops: CtxOp[]; names(): string[] };
}

/** A scratch canvas that records what was drawn on it. Enough for order, not pixels. */
function scratchCanvas(w: number, h: number): { width: number; height: number; ops: CtxOp[]; getContext(): unknown } {
  const ops: CtxOp[] = [];
  const canvas = {
    width: w,
    height: h,
    ops,
    getContext(): unknown {
      const rec = (op: string) => (...args: unknown[]): void => {
        ops.push({ op, args: args.map((a) => (typeof a === 'number' ? a : Number.NaN)) });
      };
      return {
        canvas,
        filter: 'none', fillStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over',
        imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
        save: rec('save'), restore: rec('restore'),
        translate: rec('translate'), rotate: rec('rotate'), scale: rec('scale'),
        clip: rec('clip'), setTransform: rec('setTransform'),
        clearRect: rec('clearRect'), fillRect: rec('fillRect'), putImageData: rec('putImageData'),
        drawImage: (_s: unknown, ...rest: unknown[]) => { ops.push({ op: 'drawImage', args: rest.map(Number) }); },
        getImageData: (_x: number, _y: number, gw: number, gh: number) =>
          ({ data: new Uint8ClampedArray(Math.max(4, gw * gh * 4)), width: gw, height: gh }),
      };
    },
  };
  return canvas;
}

/** Install the recording scratch factory for one test, and hand back what it made. */
function useScratches(): { made: ReturnType<typeof scratchCanvas>[]; done: () => void } {
  const made: ReturnType<typeof scratchCanvas>[] = [];
  _setBlurCanvasFactory((w, h) => {
    const c = scratchCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    made.push(c);
    return c as never;
  });
  return { made, done: () => { _resetBlurPool(); _setBlurCanvasFactory(null); } };
}

/** The minimum `Path2D` the clip stage needs, for a realm that has none. */
class StubPath2D {
  calls: string[] = [];
  arc(): void { this.calls.push('arc'); }
  ellipse(): void { this.calls.push('ellipse'); }
  rect(): void { this.calls.push('rect'); }
  roundRect(): void { this.calls.push('roundRect'); }
  moveTo(): void { this.calls.push('moveTo'); }
  lineTo(): void { this.calls.push('lineTo'); }
  closePath(): void { this.calls.push('closePath'); }
}

/** Awaits inside the try: a synchronous `finally` would take Path2D away mid-draw. */
async function withPath2D<T>(fn: () => Promise<T>): Promise<T> {
  const g = globalThis as { Path2D?: unknown };
  const had = 'Path2D' in g;
  const prev = g.Path2D;
  g.Path2D = StubPath2D;
  try { return await fn(); } finally { if (had) g.Path2D = prev; else delete g.Path2D; }
}

/** One plan item for a single layer at `t`, with the stage the projection anchors on. */
function planOne(w: SeqJobLayer, t = 0): PlanItem {
  const plan = sequenceDrawPlan([hydrateJobLayer(w)], t, 1000, { stageW: 1920, stageH: 1080 });
  assert.equal(plan.length, 1, 'the fixture layer is on screen');
  return plan[0] as PlanItem;
}

const RES = (over: Record<string, unknown> = {}): never => ({
  under: { tag: 'under' } as unknown as CanvasImageSource, over: null, provider: null,
  objectFit: '', objectPosition: '', platePad: 0, live: null,
  first: 0, last: 0, span: [], lastStats: null, srcClaimedSec: 0, ...over,
}) as never;

test('itemFx IS the gate: OWNERSHIP first, then blur × S', () => {
  assert.equal(itemFx(planOne(layer()), 2), null);
  assert.equal(itemFx(planOne(layer({ z: 300, kf: kfTrackOf('t0_o1*t1000_o0.4') })), 2), null,
    'depth and keyframes alone change the numbers, never the gate');
  // THE BYTE-IDENTITY FLOOR. `shadow: content` and an authored `blur` are pre-104
  // vocabulary: on a box with no depth their plate keeps its filter, exactly as it
  // always did, so the compositor must apply NOTHING or the effect lands twice.
  assert.equal(itemFx(planOne(layer({ blur: 3 })), 2), null,
    'a blurred box with no depth: the plate still carries it');
  assert.equal(itemFx(planOne(layer({ shadowFilter: 'drop-shadow(0px 4px 10px #000)' })), 2), null,
    'and so does a shadowed one');
  // Ownership moves the moment the box authors depth - that is when the plate is shot
  // clean, and the two decisions are the same predicate (`ownsLayerFx`).
  const blurred = itemFx(planOne(layer({ blur: 3, z: 60 })), 2);
  assert.equal(blurred?.sigma, 6, 'the blur is authored px × the export scale');
  const shadowed = itemFx(planOne(layer({ shadowFilter: 'drop-shadow(0px 4px 10px #000)', z: 60 })), 2);
  assert.equal(shadowed?.sigma, 0);
  assert.deepEqual(shadowed?.shadows.map((s) => [s.dx, s.dy, s.blur]), [[0, 8, 20]],
    'and the authored shadow is scaled with it - the plate used to scale it for free');
});

test('BYTE-IDENTITY FLOOR: a pre-104 shadow/blur document never enters the restructure', async () => {
  const { made, done } = useScratches();
  try {
    for (const w of [layer({ blur: 4 }), layer({ shadowFilter: 'drop-shadow(0px 12px 24px #0008)' })]) {
      made.length = 0;
      _resetBlurPool();
      const ctx = opCtx();
      await drawItem(ctx, planOne(w), RES(), 1);
      assert.deepEqual(ctx.names(), ['save', 'translate', 'drawImage', 'restore'],
        'the pre-104 call list, for a document that authored no depth at all');
      assert.equal(made.length, 0, 'and no scratch, no lane, no re-created effect');
      assert.deepEqual(ctx.ops[2]?.args, [-50, -50, 100, 100], 'the plate at the box rect, unpadded');
    }
  } finally { done(); }
});

test('BYTE-IDENTITY FLOOR: a clean layer takes today\'s exact path, and asks for no scratch', async () => {
  const { made, done } = useScratches();
  try {
    const ctx = opCtx();
    await drawItem(ctx, planOne(layer()), RES(), 1);
    assert.deepEqual(ctx.names(), ['save', 'translate', 'drawImage', 'restore'],
      'no clip (no radius), no scratch, no composite - the pre-104 call list');
    assert.deepEqual(ctx.ops[1]?.args, [50, 50], 'translate to the box centre');
    assert.deepEqual(ctx.ops[2]?.args, [-50, -50, 100, 100], 'and the plate at the box rect');
    assert.equal(made.length, 0, 'a clean layer never allocates anything');
  } finally { done(); }
});

test('BYTE-IDENTITY FLOOR: the gate is blur + authored filter and NOTHING else', async () => {
  const { made, done } = useScratches();
  try {
    // Everything else a depth document can carry - a z, a keyframe track that moves the
    // box, a resolved depth - still leaves a layer CLEAN as far as the compositor is
    // concerned: those change the numbers, not the pass structure.
    const w = layer({ z: 120, kf: kfTrackOf('t0_x0*t1000_x60') });
    const item = planOne(w, 500);
    assert.notEqual(item.dx, 0, 'the fixture really is being moved');
    assert.equal(item.blur, 0);
    const ctx = opCtx();
    await drawItem(ctx, item, RES(), 1);
    // `scale` is there because a lifted box really is magnified by the projection - 
    // that is a NUMBER changing, which is the feature working. What must not change is
    // the PASS STRUCTURE: still one unclipped draw straight at the destination.
    assert.deepEqual(ctx.names(), ['save', 'translate', 'scale', 'drawImage', 'restore']);
    assert.equal(made.length, 0);
  } finally { done(); }
});

test('a BLURRED layer clips into a padded scratch and composites UNCLIPPED (section 5.5)', async () => {
  const { made, done } = useScratches();
  try {
    const ctx = opCtx();
    // `z` is what moves ownership of the filter to the compositor (`ownsLayerFx`); it
    // is deliberately small enough that eff rounds the layer's own geometry nowhere
    // near a new plate bucket, so the pad arithmetic below is the plain one.
    const item = planOne(layer({ blur: 4, radius: '12px', z: 60 }));
    assert.equal(item.blur, 4, 'the planner owns the whole blur');
    await withPath2D(async () => { await drawItem(ctx, item, RES(), 1); });
    // The destination never clips. That is the whole point: the DOM clips the CONTENT
    // and applies the filter after, so the blur spills softly OUTSIDE the radius.
    assert.ok(!ctx.names().includes('clip'), 'the composite is unclipped');
    // `scale` is the projection magnifying a lifted box - a number changing, not a
    // pass appearing.
    assert.deepEqual(ctx.names(), ['save', 'translate', 'scale', 'drawImage', 'restore']);
    // The clip happened on the scratch instead, inside the pad translate.
    const stage = made[0];
    assert.ok(stage, 'a scratch was taken');
    const kinds = stage.ops.map((o) => o.op);
    assert.ok(kinds.includes('clip'), 'the radius clipped the CONTENT');
    assert.equal(kinds.indexOf('translate') < kinds.indexOf('clip'), true, 'inside the pad offset');
    // …and the scratch is the box plus three sigmas of spill on every side.
    const pad = spillPad(4, []);
    assert.equal(stage.width, 100 + pad * 2);
    assert.equal(stage.height, 100 + pad * 2);
    assert.deepEqual(ctx.ops.find((o) => o.op === 'drawImage')?.args,
      [-50 - pad, -50 - pad, stage.width, stage.height],
      'and it is composited back at its own padded origin, 1:1');
  } finally { done(); }
});

test('clipPath + shadow: the clip shapes the content AND cuts the shadow (CSS order)', async () => {
  const { made, done } = useScratches();
  try {
    const ctx = opCtx();
    const shadow = 'drop-shadow(0px 12px 24px #00000055)';
    const item = planOne(layer({ clipPath: 'circle(40%)', shadowFilter: shadow, z: 60 }));
    await withPath2D(async () => { await drawItem(ctx, item, RES(), 1); });
    // THE TWO CLIP KINDS ARE NOT THE SAME ORDER. `border-radius` clips the element's
    // content and the filter applies after (spill escapes the radius - the test above).
    // `clip-path` applies to the FILTER OUTPUT: Filter Effects renders, filters, THEN
    // clips, so the browser cuts the drop-shadow off at the path. The DOM evaluator
    // writes `filter` on the element and inherits that order for free, so the canvas
    // has to clip at the DESTINATION or preview and export disagree on every
    // clip-path'd blurred box.
    assert.ok(ctx.names().includes('clip'), 'the destination IS clipped, by the clip-path');
    const stage = made[0];
    assert.ok(stage, 'a scratch was taken');
    assert.ok(!stage.ops.some((o) => o.op === 'clip'),
      'and the scratch is not clipped again - the plate already carries the shape');
    const pad = spillPad(0, parseDropShadows(shadow));
    assert.ok(pad > 0);
    assert.equal(stage.width, 100 + pad * 2);
    assert.deepEqual(ctx.ops.find((o) => o.op === 'drawImage')?.args,
      [-50 - pad, -50 - pad, stage.width, stage.height]);
  } finally { done(); }
});

test('a SHADOWED layer with no blur takes the same restructure', async () => {
  const { made, done } = useScratches();
  try {
    const ctx = opCtx();
    const item = planOne(layer({ shadowFilter: 'drop-shadow(0px 21px 46px #00000055)', z: 60 }));
    assert.equal(item.blur, 0);
    await drawItem(ctx, item, RES(), 1);
    assert.equal(made.length > 0, true, 'an authored filter on a DEPTH layer restructures');
    const pad = spillPad(0, parseDropShadows('drop-shadow(0px 21px 46px #00000055)'));
    assert.equal(made[0]?.width, 100 + pad * 2, 'and the spill is the shadow\'s own reach');
  } finally { done(); }
});

// ── the fx-plate cache (plans/104 P3.1, measured failure 1) ─────────────────
//
// The claim is PIXEL IDENTITY, not a cheaper approximation: the filtered picture is
// rendered once and the per-frame `ctx.drawImage` that places it is the identical call
// the uncached path makes. So every assertion below is about the CALL, and the browser
// tier (`tests/lift-flythrough.browser.test.ts`) decodes the two renders and compares
// the pixels themselves.

/**
 * Work done ON scratches, not scratches ALLOCATED - the pool re-uses a canvas across
 * frames (that is what it is for), so a second allocation is not what "the filter ran
 * again" looks like. A recorded op on a scratch is.
 */
const scratchWork = (made: ReturnType<typeof scratchCanvas>[]): number =>
  made.reduce((n, c) => n + c.ops.length, 0);

test('fx cache: without an allowance nothing is retained - the pre-P3.1 path, unchanged', async () => {
  const { made, done } = useScratches();
  try {
    const item = planOne(layer({ shadowFilter: 'drop-shadow(0px 21px 46px #00000055)', z: 60 }));
    const res = RES();                                 // no fxBudget: the cache is absent
    await drawItem(opCtx(), item, res, 1);
    const first = scratchWork(made);
    assert.ok(first > 0, 'the filtered path ran');
    await drawItem(opCtx(), item, res, 1);
    assert.equal((res as { fx?: unknown }).fx ?? null, null, 'nothing was kept');
    assert.ok(scratchWork(made) > first, 'and the second frame re-rendered the filter');
  } finally { done(); }
});

test('fx cache: the second frame re-composites the SAME canvas with the SAME draw', async () => {
  const { made, done } = useScratches();
  try {
    const item = planOne(layer({ shadowFilter: 'drop-shadow(0px 21px 46px #00000055)', z: 60 }));
    const res = RES({ fxBudget: createFxPlateBudget(64 << 20) });
    const a = opCtx();
    await drawItem(a, item, res, 1);
    const rendered = scratchWork(made);
    assert.ok(rendered > 0, 'the first frame rendered the filter');
    const kept = (res as { fx?: { stage: { canvas: unknown }; bytes: number } }).fx;
    assert.ok(kept, 'and kept the result');

    const b = opCtx();
    await drawItem(b, item, res, 1);
    assert.equal(scratchWork(made), rendered, 'the second frame touched no scratch at all');
    // THE WHOLE CLAIM, as a call: same picture, same four numbers, same place.
    const drawA = a.ops.filter((o) => o.op === 'drawImage');
    const drawB = b.ops.filter((o) => o.op === 'drawImage');
    assert.equal(drawB.length, 1, 'one composite, exactly as the uncached frame issued');
    assert.deepEqual(drawB[0]?.args, drawA[drawA.length - 1]?.args);
    assert.deepEqual(b.names(), a.names(), 'and the same call list around it');
    // The transform is written on the DESTINATION, so the cached canvas is free to be
    // drawn under a different one - which is what makes a moving camera cheap.
    const moved = planOne(layer({ shadowFilter: 'drop-shadow(0px 21px 46px #00000055)', z: 60 }));
    const c = opCtx();
    await drawItem(c, moved, res, 1);
    assert.equal(scratchWork(made), rendered, 'still no scratch work');
  } finally { done(); }
});

test('fx cache: the key is the EFFECT - a changed sigma misses, and gives its bytes back', async () => {
  const { made, done } = useScratches();
  try {
    const budget = createFxPlateBudget(64 << 20);
    const res = RES({ fxBudget: budget });
    // A DOF blur under an animated aperture is exactly this: the same layer, a
    // different sigma each frame. It must re-render, and it must not leak.
    await drawItem(opCtx(), planOne(layer({ blur: 4, z: 60 })), res, 1);
    const afterFirst = budget.remaining;
    assert.ok(afterFirst < (64 << 20), 'the first plate was accounted for');
    const madeFirst = scratchWork(made);
    await drawItem(opCtx(), planOne(layer({ blur: 9, z: 60 })), res, 1);
    assert.ok(scratchWork(made) > madeFirst, 'a different blur re-rendered');
    assert.equal(budget.refused, 0, 'and it fitted');
    // One layer, one plate: the old one was released before the new one was taken.
    assert.ok(budget.remaining < (64 << 20), 'the new plate is accounted for');
    assert.ok(budget.remaining <= afterFirst + 1024 * 1024,
      `one layer holds ONE plate (remaining ${budget.remaining} vs ${afterFirst})`);
  } finally { done(); }
});

test('fx cache: a picture that is this frame\'s picture is never cached', async () => {
  const { made, done } = useScratches();
  try {
    const shadow = 'drop-shadow(0px 21px 46px #00000055)';
    const cases: [string, SeqJobLayer, Record<string, unknown>][] = [
      // A decoded frame is composited between a video layer's two plates.
      ['video', layer({ kind: 'video', shadowFilter: shadow, z: 60 }), {}],
      // A lottie layer is re-rasterised off the live player.
      ['lottie', layer({ kind: 'lottie', shadowFilter: shadow, z: 60 }), {}],
      // …and any layer holding a live raster for this frame, whatever its kind.
      ['live raster', layer({ shadowFilter: shadow, z: 60 }), { live: { tag: 'live' } }],
    ];
    for (const [name, w, over] of cases) {
      const res = RES({ fxBudget: createFxPlateBudget(64 << 20), ...over });
      made.length = 0;
      _resetBlurPool();
      await drawItem(opCtx(), planOne(w), res, 1);
      await drawItem(opCtx(), planOne(w), res, 1);
      assert.equal((res as { fx?: unknown }).fx ?? null, null, `${name} must not cache`);
    }
  } finally { done(); }
});

test('fx cache: over the allowance a layer simply pays the filter again, and says so', async () => {
  const { made, done } = useScratches();
  try {
    const budget = createFxPlateBudget(1024);            // one KB: nothing fits
    const item = planOne(layer({ shadowFilter: 'drop-shadow(0px 21px 46px #00000055)', z: 60 }));
    const res = RES({ fxBudget: budget });
    await drawItem(opCtx(), item, res, 1);
    const first = scratchWork(made);
    await drawItem(opCtx(), item, res, 1);
    assert.equal((res as { fx?: unknown }).fx ?? null, null, 'nothing retained');
    assert.ok(scratchWork(made) > first, 'so the filter ran again - correct, just slower');
    assert.equal(budget.refused, 1, 'and the refusal was COUNTED, for the one warn line');
  } finally { done(); }
});

test('fx cache: an allowance that RUNS OUT is counted; one that is OFF is not', async () => {
  const { done } = useScratches();
  try {
    const shadow = 'drop-shadow(0px 21px 46px #00000055)';
    // Room for one plate of this size and not two: the second layer is a CAP, and a cap
    // that nothing counted would be a silent one.
    const probe = createFxPlateBudget(64 << 20);
    const first = RES({ fxBudget: probe });
    await drawItem(opCtx(), planOne(layer({ shadowFilter: shadow, z: 60 })), first, 1);
    const one = (64 << 20) - probe.remaining;
    assert.ok(one > 0);

    const budget = createFxPlateBudget(one);
    const a = RES({ fxBudget: budget });
    const b = RES({ fxBudget: budget });
    await drawItem(opCtx(), planOne(layer({ shadowFilter: shadow, z: 60 })), a, 1);
    assert.equal(budget.remaining, 0, 'the first layer took all of it');
    await drawItem(opCtx(), planOne(layer({ shadowFilter: shadow, z: 60 })), b, 1);
    assert.equal((b as { fx?: unknown }).fx ?? null, null, 'and the second got none');
    assert.equal(budget.refused, 1, 'which is a CAP, and caps are never silent');

    // Turned off is a different thing, and must say nothing at all.
    const offBudget = createFxPlateBudget(0);
    const off = RES({ fxBudget: offBudget });
    await drawItem(opCtx(), planOne(layer({ shadowFilter: shadow, z: 60 })), off, 1);
    assert.equal((off as { fx?: unknown }).fx ?? null, null);
    assert.equal(offBudget.refused, 0, 'an off cache refuses nothing - there is nothing to warn about');
  } finally { done(); }
});

test('fx cache: a render hands every plate back when it ends', async () => {
  const { done } = useScratches();
  try {
    const budget = createFxPlateBudget(64 << 20);
    const res = RES({ fxBudget: budget });
    await drawItem(opCtx(), planOne(layer({ shadowFilter: 'drop-shadow(0px 21px 46px #00000055)', z: 60 })), res, 1);
    assert.ok(budget.remaining < (64 << 20));
    releaseFxPlates([res as never]);
    assert.equal(budget.remaining, 64 << 20, 'the allowance is whole again');
    assert.equal((res as { fx?: unknown }).fx ?? null, null);
  } finally { done(); }
});

test('BYTE-IDENTITY FLOOR: a clean layer never reaches the cache at all', async () => {
  const { made, done } = useScratches();
  try {
    const budget = createFxPlateBudget(64 << 20);
    const res = RES({ fxBudget: budget });
    const ctx = opCtx();
    await drawItem(ctx, planOne(layer()), res, 1);
    assert.deepEqual(ctx.names(), ['save', 'translate', 'drawImage', 'restore']);
    assert.equal(made.length, 0);
    assert.equal((res as { fx?: unknown }).fx ?? null, null);
    assert.equal(budget.remaining, 64 << 20, 'and spent nothing');
    assert.equal(budget.refused, 0, 'and had nothing to warn about');
  } finally { done(); }
});

test('blur scales with the export scale S', async () => {
  const { made, done } = useScratches();
  try {
    const item = planOne(layer({ blur: 4, z: 60 }));
    for (const S of [1, 2, 3]) {
      made.length = 0;
      _resetBlurPool();
      await drawItem(opCtx(), item, RES(), S);
      const pad = spillPad(4 * S, []);
      assert.equal(made[0]?.width, Math.ceil(100 * S) + pad * 2, `S=${S}`);
    }
  } finally { done(); }
});

test('a padded PLATE is drawn back at its own origin, on both paths', async () => {
  const { done } = useScratches();
  try {
    // The plate was captured with a 12px margin, so its origin is (-12,-12) in box
    // space and it is 24px bigger on each axis. Every draw of it has to say so.
    const clean = opCtx();
    await drawItem(clean, planOne(layer()), RES({ platePad: 12 }), 2);
    assert.deepEqual(clean.ops[2]?.args, [-100 - 24, -100 - 24, 200 + 48, 200 + 48],
      'the clean path subtracts the pad and adds twice it, at scale S');
    // …and a blurred layer's scratch is never narrower than the plate it must hold.
    const blurred = opCtx();
    const { made, done: stop } = useScratches();
    try {
      await drawItem(blurred, planOne(layer({ blur: 1, z: 60 })), RES({ platePad: 40 }), 1);
      assert.ok((made[0]?.width ?? 0) >= 100 + 80,
        `scratch ${made[0]?.width} must hold a plate padded by 40 on each side`);
    } finally { stop(); }
  } finally { done(); }
});

test('a filtered layer blurs at the PLATE\'s resolution, not at S', async () => {
  // The budget shoots a lifted layer's plate at `S·eff` precisely so a flown-past layer
  // is not a blown-up S-resolution plate. The filtered path composites through a
  // scratch - and a scratch sized in S px resampled the plate DOWN to S, blurred it
  // there, and let `ctx.scale(item.scale)` blow the result back up, throwing away
  // exactly the resolution that was paid for on exactly the layers (lifted,
  // depth-shadowed) that asked for it.
  const { made, done } = useScratches();
  try {
    // z 400 at P 1200: eff = 1.5, so the plate is bucketed to 1.5 and the layer lands
    // 1.5× its own size.
    const item = planOne(layer({ blur: 4, z: 400 }));
    assert.ok(Math.abs(item.scale - 1.5) < 1e-9, `the fixture is magnified (${item.scale})`);
    await drawItem(opCtx(), item, RES({ plateEff: 1.5 }), 1);
    const pad = spillPad(4 * 1.5, []);
    assert.equal(made[0]?.width, Math.ceil(100 * 1.5) + pad * 2,
      'the scratch is the plate\'s own resolution, and the sigma scaled with it');

    // …and it never asks for MORE than the plate actually holds: with a plate shot at
    // S (no extra bought), the scratch stays at S and the upscale is the transform's.
    made.length = 0;
    _resetBlurPool();
    await drawItem(opCtx(), item, RES(), 1);
    assert.equal(made[0]?.width, 100 + spillPad(4, []) * 2,
      'no plateEff, no extra pixels to keep - the byte-identity path');

    // ONE SIZE PER LAYER PER RENDER. The scratch follows the PLATE, not the frame:
    // sizing it to `min(item.scale, plateEff)` would be the tightest allocation and
    // would resize the pooled canvas on every frame of a moving layer, which is the
    // cost the pool exists to avoid.
    const early = planOne(layer({ blur: 4, z: 400, kf: kfTrackOf('t0_s0.2*t1000_s1') }), 0);
    assert.ok(early.scale < 1, `the fixture is small at t=0 (${early.scale})`);
    made.length = 0;
    _resetBlurPool();
    await drawItem(opCtx(), early, RES({ plateEff: 1.5 }), 1);
    assert.equal(made[0]?.width, Math.ceil(100 * 1.5) + spillPad(4 * 1.5, []) * 2,
      'the same size the layer takes at its widest moment');
  } finally { done(); }
});

test('a filtered layer is composited back at exactly its box rect, whatever the scratch resolution', async () => {
  const { made, done } = useScratches();
  try {
    const ctx = opCtx();
    const item = planOne(layer({ blur: 4, z: 400 }));
    await drawItem(ctx, item, RES({ plateEff: 1.5 }), 1);
    const k = 1.5;
    const pad = spillPad(4 * k, []);
    const stage = made[0];
    assert.ok(stage);
    // The draw happens inside `ctx.scale(item.scale)`, so dividing the scratch's own px
    // by k puts one scratch px on one device px - the content lands at (ox, oy, w, h)
    // with the spill around it, which is what the k = 1 form always did.
    assert.deepEqual(ctx.ops.find((o) => o.op === 'drawImage')?.args,
      [-50 - pad / k, -50 - pad / k, stage.width / k, stage.height / k]);
  } finally { done(); }
});

test('an empty clip draws nothing - and costs no scratch', async () => {
  const { made, done } = useScratches();
  try {
    const ctx = opCtx();
    // `inset(50% 50%)` encloses nothing; parseClipShape reports 'empty'.
    const item = planOne(layer({ blur: 4, clipPath: 'inset(50% 50%)', z: 60 }));
    await withPath2D(async () => { await drawItem(ctx, item, RES(), 1); });
    assert.ok(!ctx.names().includes('drawImage'), 'nothing reached the destination');
    assert.equal(made.length, 0, 'and the empty clip was known before a scratch was taken');
  } finally { done(); }
});

test('DETERMINISM: the executor draws the same job the same way, every run', async () => {
  // Worker and in-thread are the SAME function (the source guard below proves there is
  // only one), so what remains provable here is that the function itself is
  // deterministic - including through the restructured path, which allocates, pools and
  // recycles scratches. A pool that leaked state between runs would show up here.
  const runOnce = async (): Promise<string> => {
    const { done } = useScratches();
    try {
      const ctx = opCtx();
      const j = job([
        layer({ blur: 3, radius: '8px', z: 60 }),
        layer({ shadowFilter: 'drop-shadow(2px 4px 10px #0008)', z: -80 }),
        layer(),
      ], 3, 3);
      await withPath2D(async () => {
        await runSequenceJob(j, {} as AnyCanvas, ctx, { frame: async () => {} });
      });
      return JSON.stringify(ctx.ops);
    } finally { done(); }
  };
  const a = await runOnce();
  const b = await runOnce();
  assert.equal(a, b, 'two runs of one job produce one op stream');
  assert.ok(a.includes('drawImage'), 'and it actually drew something');
});

// ── the message protocol ────────────────────────────────────────────────────

interface StubMux {
  frames: number[];
  audio: number[];
  aborted: number;
  finalized: number;
  addFrame(src: unknown, tsUs: number): Promise<void>;
  addAudio(b: { length: number }): Promise<void>;
  finalize(): Promise<Blob>;
  abort(): Promise<void>;
}

function stubMux(fail?: Error): StubMux {
  const m: StubMux = {
    frames: [], audio: [], aborted: 0, finalized: 0,
    addFrame: async (_s, ts) => { if (fail && m.frames.length === 2) throw fail; m.frames.push(ts); },
    addAudio: async (b) => { m.audio.push(b.length); },
    finalize: async () => { m.finalized++; return new Blob([new Uint8Array([1, 2, 3])], { type: 'video/webm' }); },
    abort: async () => { m.aborted++; },
  };
  return m;
}

const PICK: EncodePick = { container: 'webm', codec: 'vp8', muxCodec: 'V_VP8' };

function startMsg(j: SeqJob, audio: SeqWorkerStart['audio'] = null): SeqWorkerStart {
  return { type: 'start', id: 7, job: j, pick: PICK, bitrate: 1_000_000, audio };
}

function stubPort(): { post(m: SeqWorkerOut, t?: Transferable[]): void; sent: SeqWorkerOut[] } {
  const sent: SeqWorkerOut[] = [];
  return { sent, post: (m) => { sent.push(m); } };
}

test('protocol: start → progress per frame → done, with the muxer finalized once', async () => {
  const mux = stubMux();
  const port = stubPort();
  await handleStart(startMsg(job([layer()])), port, { aborted: () => false, awaitLive: async () => null }, {
    makeCanvas: () => ({ getContext: () => stubCtx() }) as unknown as AnyCanvas,
    makeMux: async () => mux as never,
  });
  const progress = port.sent.filter((m) => m.type === 'progress');
  assert.deepEqual(progress.map((p) => (p as { done: number }).done), [1, 2, 3, 4]);
  assert.deepEqual(mux.frames, [0, 250_000, 500_000, 750_000], 'timestamps are the µs grid');
  assert.equal(mux.finalized, 1);
  assert.equal(mux.aborted, 0);
  const done = port.sent.at(-1);
  assert.equal(done?.type, 'done');
  assert.equal((done as { mime: string }).mime, 'video/webm');
  assert.equal((done as { buffer: ArrayBuffer }).buffer.byteLength, 3);
});

test('protocol: a live-raster layer emits need-live with a fresh token, and the reply is drawn', async () => {
  const port = stubPort();
  const answered: number[] = [];
  await handleStart(
    startMsg(job([layer({ kind: 'lottie', needsLiveRaster: true })], 2, 4)),
    port,
    {
      aborted: () => false,
      awaitLive: async (token) => { answered.push(token); return null; },
    },
    { makeCanvas: () => ({ getContext: () => stubCtx() }) as unknown as AnyCanvas, makeMux: async () => stubMux() as never },
  );
  const needs = port.sent.filter((m) => m.type === 'need-live') as { token: number; frame: number }[];
  assert.deepEqual(needs.map((n) => n.frame), [0, 1]);
  assert.deepEqual(needs.map((n) => n.token), [1, 2], 'tokens are unique so a late reply cannot be mistaken');
  assert.deepEqual(answered, [1, 2], 'and every request was awaited before the frame was drawn');
});

test('protocol: the transferred plates are closed even when SETUP fails', async () => {
  // The plates were TRANSFERRED, so this thread is their only owner. A throw from
  // getContext / createStreamingMux - both of which run before the frame loop - 
  // used to skip the close entirely, stranding ~170 MB of native bitmap memory
  // for a 1080p ten-layer job, once per failed attempt.
  let closed = 0;
  // closeJobBitmaps only closes REAL ImageBitmaps (a canvas plate, on the
  // in-thread path, is not ours to close). Node has no ImageBitmap, so stand one
  // up for the length of this test.
  const g = globalThis as { ImageBitmap?: unknown };
  const had = 'ImageBitmap' in g;
  class FakeBitmap { close(): void { closed++; } }
  g.ImageBitmap = FakeBitmap;
  const bitmap = new FakeBitmap() as unknown as ImageBitmap;
  const j = job([layer()]);
  j.plates = [{ idx: 0, under: bitmap, over: null }];
  const err = await handleStart(startMsg(j), stubPort(), { aborted: () => false, awaitLive: async () => null }, {
    makeCanvas: () => ({ getContext: () => stubCtx() }) as unknown as AnyCanvas,
    makeMux: async () => { throw new Error('no muxer here'); },
  }).then(() => null, (e: unknown) => e);
  if (!had) delete g.ImageBitmap;
  assert.ok(err instanceof Error);
  assert.equal(closed, 1, 'the job\'s bitmaps are released on every exit, not only the happy one');
});

test('isOffloadFailure: an uncoded throw is the offload; a coded verdict is not', () => {
  assert.equal(isOffloadFailure(new Error('the muxer chunk would not load')), true);
  assert.equal(isOffloadFailure(sequenceError('SEQ_TRUNCATED', 'short file')), false);
  const tagged = sequenceError('SEQ_UNSUPPORTED_MEDIA', 'no DOM for the element-seek provider');
  (tagged as unknown as Record<string, unknown>).offload = true;
  assert.equal(isOffloadFailure(tagged), true,
    'the element-seek provider is missing only BECAUSE we are in a worker - that must retry in-thread');
});

test('two OVERLAPPING runs cannot resolve each other\'s live rasters', async () => {
  // The corruption this guards: both runs mint tokens 1, 2, 3… A single-slot
  // worker resolves run 1's waiter with run 2's frame, so run 1 silently
  // composites the WRONG lottie picture - wrong pixels, no error, and the
  // in-run uniqueness the older test asserts is exactly the property that does
  // not hold across runs.
  const reg = createRunRegistry();
  const a = reg.begin(1);
  const b = reg.begin(2);
  const bmA = { id: 'A' } as unknown as ImageBitmap;
  const bmB = { id: 'B' } as unknown as ImageBitmap;

  const gotA = a.awaitLive(1);
  const gotB = b.awaitLive(1);                 // the SAME token number
  assert.equal(reg.deliver(2, 1, bmB), true);
  assert.equal(await gotB, bmB);
  assert.equal(reg.deliver(1, 1, bmA), true);
  assert.equal(await gotA, bmA, 'each run got its own frame');
});

test('aborting one run leaves the other running', async () => {
  const reg = createRunRegistry();
  const a = reg.begin(1);
  const b = reg.begin(2);
  const pending = a.awaitLive(7);
  reg.abort(1);
  assert.equal(await pending, null, 'the cancelled run is unblocked rather than left to its watchdog');
  assert.equal(a.aborted(), true);
  assert.equal(b.aborted(), false, 'a second start must not clear an abort the first run had not yet observed');
  reg.end(1); reg.end(2);
  assert.equal(reg.size(), 0);
});

test('a live raster nobody is waiting for is reported so the caller can close it', () => {
  const reg = createRunRegistry();
  reg.begin(1);
  assert.equal(reg.deliver(1, 99, {} as unknown as ImageBitmap), false, 'unknown token');
  assert.equal(reg.deliver(42, 1, {} as unknown as ImageBitmap), false, 'unknown run');
});

test('protocol: a failure aborts the muxer and posts no bytes', async () => {
  const boom = new Error('encoder exploded');
  const mux = stubMux(boom);
  const port = stubPort();
  const err = await handleStart(startMsg(job([layer()])), port, { aborted: () => false, awaitLive: async () => null }, {
    makeCanvas: () => ({ getContext: () => stubCtx() }) as unknown as AnyCanvas,
    makeMux: async () => mux as never,
  }).then(() => null, (e: unknown) => e);
  assert.equal(err, boom, 'the failure propagates to the worker entry, which codes it');
  assert.equal(mux.aborted, 1, 'the muxer is torn down');
  assert.equal(mux.finalized, 0);
  assert.ok(!port.sent.some((m) => m.type === 'done'), 'and nothing was claimed as output');
});

test('protocol: the mixed PCM is fed through the same addAudio the in-thread path uses', async () => {
  const mux = stubMux();
  const port = stubPort();
  const channels = [new Float32Array(480), new Float32Array(480)];
  await handleStart(
    startMsg(job([layer()]), {
      codec: 'opus', muxCodec: 'A_OPUS', sampleRate: 48_000, numberOfChannels: 2,
      bitrate: 128_000, channels, length: 480,
    }),
    port,
    { aborted: () => false, awaitLive: async () => null },
    { makeCanvas: () => ({ getContext: () => stubCtx() }) as unknown as AnyCanvas, makeMux: async () => mux as never },
  );
  assert.deepEqual(mux.audio, [480]);
});

test('pcmSourceOf presents planar channels as the AudioBuffer slice addAudio reads', () => {
  const a = { codec: '', muxCodec: '', sampleRate: 48_000, numberOfChannels: 2, bitrate: 0, length: 3,
    channels: [Float32Array.of(1, 2, 3)] };
  const p = pcmSourceOf(a);
  assert.equal(p.length, 3);
  assert.equal(p.numberOfChannels, 2);
  assert.deepEqual([...p.getChannelData(0)], [1, 2, 3]);
  assert.deepEqual([...p.getChannelData(1)], [1, 2, 3], 'a mono mix feeds both declared channels');
});

test('jobTransferables lists nothing when the plates are canvases (the in-thread job)', () => {
  const j = job([layer()]);
  j.plates = [{ idx: 0, under: {} as unknown as CanvasImageSource, over: null }];
  assert.deepEqual(jobTransferables(j), [], 'only real ImageBitmaps are transferred');
});

// ── capability gating and fallback ──────────────────────────────────────────

function withGlobals(patch: Record<string, unknown>, fn: () => void): void {
  const g = globalThis as unknown as Record<string, unknown>;
  const had = new Map<string, { present: boolean; value: unknown }>();
  for (const [k, v] of Object.entries(patch)) {
    had.set(k, { present: k in g, value: g[k] });
    if (v === undefined) delete g[k]; else g[k] = v;
  }
  try { fn(); } finally {
    for (const [k, { present, value }] of had) {
      if (present) g[k] = value; else delete g[k];
    }
  }
}

const ALL_PRESENT = {
  Worker: class {},
  OffscreenCanvas: class {},
  VideoEncoder: class {},
  createImageBitmap: (): void => {},
  localStorage: { getItem: (k: string) => (k === 'lolly.workerEncode' ? '1' : null) },
};

test('gating: every capability plus the opt-in flag is required', () => {
  withGlobals(ALL_PRESENT, () => {
    assert.equal(workerSequenceRenderEnabled(), true);
    assert.equal(supportsWorkerSequenceRender(), true);
  });
  for (const missing of ['Worker', 'OffscreenCanvas', 'VideoEncoder', 'createImageBitmap']) {
    withGlobals({ ...ALL_PRESENT, [missing]: undefined }, () => {
      assert.equal(supportsWorkerSequenceRender(), false, `${missing} missing must fall back in-thread`);
    });
  }
  withGlobals({ ...ALL_PRESENT, localStorage: { getItem: () => null } }, () => {
    assert.equal(supportsWorkerSequenceRender(), false, 'the offload is opt-in, so OFF is the default');
  });
  withGlobals({ ...ALL_PRESENT, localStorage: undefined }, () => {
    assert.equal(workerSequenceRenderEnabled(), false, 'no storage at all is not an error');
  });
});

/** A Worker stand-in whose posted messages a test can inspect and answer. */
class FakeWorker {
  static last: FakeWorker | null = null;
  posted: unknown[] = [];
  terminated = 0;
  onmessage: ((e: { data: SeqWorkerOut }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeWorker.last = this; }
  postMessage(m: unknown): void { this.posted.push(m); }
  terminate(): void { this.terminated++; }
  reply(m: SeqWorkerOut): void { this.onmessage?.({ data: m }); }
}

function useFakeWorker(): void {
  FakeWorker.last = null;
  _setSequenceWorkerFactory(() => new FakeWorker() as unknown as Worker);
}

/** Let renderSequenceInWorker's own awaits run so the worker has been spawned. */
const spawned = async (): Promise<FakeWorker> => {
  for (let i = 0; i < 50 && !FakeWorker.last; i++) await new Promise((r) => setTimeout(r, 0));
  assert.ok(FakeWorker.last, 'the client spawned a worker');
  return FakeWorker.last;
};

const emptyIo = { log: (): void => {}, progress: (): void => {} };

test('fallback: a NON-coded worker failure is retryable in-thread; a coded one is not', async () => {
  useFakeWorker();
  const j = job([layer()]);

  const p1 = renderSequenceInWorker(j, PICK, 1000, null, null, emptyIo);
  const w1 = await spawned();
  w1.reply({ type: 'error', id: (w1.posted[0] as { id: number }).id, code: 'SEQ_TRUNCATED', message: 'short file', offload: false });
  const e1 = await p1.then(() => null, (e: unknown) => e);
  assert.ok(e1 instanceof SequenceError, 'a coded verdict crosses the boundary as a SequenceError');
  assert.equal((e1 as SequenceError).code, 'SEQ_TRUNCATED');

  // The SAME worker is reused after a coded verdict - nothing was wrong with it.
  const p2 = renderSequenceInWorker(j, PICK, 1000, null, null, emptyIo);
  await new Promise((r) => setTimeout(r, 0));
  const w2 = FakeWorker.last!;
  assert.equal(w2, w1, 'a coded render failure does not throw the thread away');
  w2.onerror?.();
  const e2 = await p2.then(() => null, (e: unknown) => e);
  assert.ok(e2 instanceof Error && !(e2 instanceof SequenceError),
    'an offload failure is a PLAIN Error - that is what licenses the in-thread retry');
  assert.equal(w2.terminated, 1, 'and the broken worker is not kept around');
  _setSequenceWorkerFactory(null);
});

test('fallback: a coded error the worker TAGGED as an offload failure still retries in-thread', async () => {
  // The case that made the fallback unreachable before `offload` existed:
  // `toCodedError` has no uncoded outcome, so a muxer the worker could not build - 
  // or the element-seek provider it structurally cannot run - arrived as
  // SEQ_DECODE_FAILED / SEQ_UNSUPPORTED_MEDIA and read as the render's verdict.
  useFakeWorker();
  const p = renderSequenceInWorker(job([layer()]), PICK, 1000, null, null, emptyIo);
  const w = await spawned();
  w.reply({
    type: 'error', id: (w.posted[0] as { id: number }).id,
    code: 'SEQ_UNSUPPORTED_MEDIA', message: 'no DOM for the element-seek provider', offload: true,
  });
  const err = await p.then(() => null, (e: unknown) => e);
  assert.ok(err instanceof Error && !(err instanceof SequenceError),
    'a tagged offload failure is a PLAIN Error, so renderSequence retries in-thread');
  assert.match((err as Error).message, /SEQ_UNSUPPORTED_MEDIA/, 'the real code survives in the message');
  assert.equal(w.terminated, 1, 'and the worker that could not do the job is dropped');
  _setSequenceWorkerFactory(null);
});

test('protocol (client): progress, log and done all reach the caller', async () => {
  useFakeWorker();
  const logs: string[] = [];
  const progress: number[] = [];
  const p = renderSequenceInWorker(job([layer()]), PICK, 1000, null, null, {
    log: (_l, m) => logs.push(m),
    progress: (d) => progress.push(d),
  });
  const w = await spawned();
  const id = (w.posted[0] as { id: number; type: string }).id;
  assert.equal((w.posted[0] as { type: string }).type, 'start');
  w.reply({ type: 'log', id, level: 'info', msg: 'hello' });
  w.reply({ type: 'progress', id, done: 1, total: 4 });
  w.reply({ type: 'done', id, buffer: new Uint8Array([9, 9]).buffer, mime: 'video/webm' });
  const blob = await p;
  assert.deepEqual(logs, ['hello']);
  assert.deepEqual(progress, [1]);
  assert.equal(blob.type, 'video/webm');
  assert.equal(blob.size, 2);
  _setSequenceWorkerFactory(null);
});

test('abort teardown: the worker is told, the run rejects coded, and the thread is terminated', async () => {
  useFakeWorker();
  const p = renderSequenceInWorker(job([layer()]), PICK, 1000, null, null, emptyIo);
  const w = await spawned();
  abortSequenceWorkerRenders('user cancelled');
  const err = await p.then(() => null, (e: unknown) => e);
  assert.ok(err instanceof SequenceError);
  assert.equal((err as SequenceError).code, 'SEQ_ABORTED');
  assert.equal((w.posted.at(-1) as { type: string }).type, 'abort', 'the loop is asked to unwind itself');
  // Terminating in the SAME task would mean the worker never even dequeues the
  // abort we just posted, making every cancel a hard kill mid-decode. It is given
  // one grace period to dispose its decoders and abort its muxer, and is then
  // killed regardless - the thread is never leaked.
  assert.equal(w.terminated, 0, 'not killed before it can act on the abort');
  await new Promise((r) => setTimeout(r, SEQ_ABORT_GRACE_MS + 20));
  assert.equal(w.terminated, 1, 'and the thread is not leaked even if it never answers');
  abortSequenceWorkerRenders();                 // idempotent
  assert.equal(w.terminated, 1);

  // A later render spawns a FRESH worker rather than reusing the dead one.
  FakeWorker.last = null;
  const p2 = renderSequenceInWorker(job([layer()]), PICK, 1000, null, null, emptyIo);
  const w2 = await spawned();
  assert.notEqual(w2, w, 'the next run gets a new thread');
  abortSequenceWorkerRenders();
  await p2.catch(() => {});
  _setSequenceWorkerFactory(null);
});

// ── determinism by construction ─────────────────────────────────────────────

test('contract: there is exactly ONE compositor, so the two paths cannot drift', () => {
  const worker = strip(read('./sequence-render.worker.ts'));
  const render = strip(read('./sequence-render.ts'));
  assert.match(worker, /export async function drawItem\(/, 'drawItem lives in the executor');
  assert.ok(!/function drawItem\(/.test(render), 'and nowhere else');
  // The two drawImage calls left in sequence-render.ts both move ALREADY-COMPOSED
  // frames about; neither composes one. The first is the MediaRecorder fallback's
  // replay (a playback pump); the second is P2a's tilt capture blitting one
  // dom-to-image photograph of the live artboard onto the output canvas - the browser
  // did the compositing there, which is the whole point of that tier (a homography has
  // no affine spelling, so `drawItem` could not have drawn it).
  const paints = render.match(/ctx\.drawImage\(/g) ?? [];
  assert.equal(paints.length, 2, 'sequence-render.ts composites nothing; the executor draws');
  assert.match(render, /drawImage\(bitmaps\[i\+\+\]/, 'and the first is the recorder replay');
  assert.match(render, /drawImage\(shot as unknown as CanvasImageSource, 0, 0\)/,
    'and the second is one whole captured frame, placed at the origin - not a layer');
  assert.match(render, /await runSequenceJob\(job, canvas, ctx,/, 'the in-thread path drives the shared executor');
  assert.match(worker, /await runSequenceJob\(job, canvas, ctx,/, 'and so does the worker');
});

test('contract: the executor is DOM-free, so it can actually load in worker scope', () => {
  const worker = strip(read('./sequence-render.worker.ts'));
  for (const banned of [/\bdocument\./, /\bwindow\./, /dom-to-image/, /from '\.\.\/views\//]) {
    assert.ok(!banned.test(worker), `the worker module must not reference ${String(banned)}`);
  }
  // The one document reference allowed is the worker-scope PROBE, which reads
  // `typeof document` to prove it is NOT on the main thread.
  assert.match(worker, /typeof g\.document === 'undefined'/, 'and it guards its own message listener');
});

test('contract: the offload is opt-in behind the same flag as the video-encode worker', () => {
  assert.match(strip(read('./sequence-render.ts')), /localStorage\.getItem\('lolly\.workerEncode'\)/);
  assert.match(strip(read('./video-encode.ts')), /localStorage\.getItem\('lolly\.workerEncode'\)/);
});

// ── P1a: cameras across the wire, and the w/h channels ──────────────────────

test('the CAMERA crosses the wire as a layer, and both threads derive it the same way', () => {
  // plans/104 section 5.4. The cameras are NOT a second field on the job: the executor derives
  // them from the very layers that crossed, using the same `stageCameras` the main
  // thread used over the same `kind`/`z`/`kf`. A second serialisation is a second thing
  // that can disagree, and worker-vs-in-thread sha identity is the property at stake.
  const camWire = layer({
    kind: 'camera', startMs: 0, durMs: 1000, z: -300,
    kf: kfTrackOf('t0_x-100_z-400*t1000_el_x100'),
  });
  const cloned = structuredClone(camWire);
  const cams = stageCameras([hydrateJobLayer(cloned)]);
  assert.equal(cams.length, 1);
  assert.deepEqual({ start: cams[0]!.start, end: cams[0]!.end }, { start: 0, end: 1000 });
  assert.deepEqual(cams[0]!.base, { z: -300 }, 'the z FIELD is the scene-default dolly');
  assert.equal(cams[0]!.track?.length, 2);
  assert.equal(camerasMove(cams), true);

  // …and a content layer under it really is projected by it: a flat box is magnified by
  // a camera that has dollied in, which is the whole of "the camera reaches the plan".
  const box = layer({ kind: 'static', rect: { x: 0, y: 0, w: 100, h: 100, rot: 0 } });
  const layers = [hydrateJobLayer(cloned), hydrateJobLayer(box)];
  const env = { stageW: 1920, stageH: 1080, cameras: stageCameras(layers) };
  const item = sequenceDrawPlan(layers, 0, 1000, env).find((p) => p.layer.kind === 'static') as PlanItem;
  assert.ok(item.scale > 1, `the camera magnifies a flat box (got ${item.scale})`);
});

test('drawItem: `cameraMoves` reaches itemFx, so a flat shadowed layer is compositor-owned', () => {
  // P1 obligation 1, at the third obeying site. Without the parameter a camera-moved
  // flat layer's filter is baked into its plate AND left un-owned by the executor - 
  // correct today only because no camera exists.
  const shadowed = layer({ shadowFilter: 'drop-shadow(0px 12px 24px #00000055)' });
  assert.equal(itemFx(planOne(shadowed), 1), null, 'still: the plate keeps it');
  const fx = itemFx(planOne(shadowed), 1, true);
  assert.ok(fx, 'moving: the compositor owns it');
  assert.equal(fx.shadows.length, 1);
});

test('section 5.2 w/h: the draw is sized by the RESOLVED box, growing from the top-left', async () => {
  const ctx = opCtx();
  const w = layer({
    rect: { x: 40, y: 20, w: 100, h: 100, rot: 0 },
    kf: kfTrackOf('t0_el_w100_h100*t1000_el_w300_h100'),
  });
  const item = planOne(w, 500);
  assert.equal(item.sized, true);
  assert.equal(item.w, 200, 'half way across the segment');
  await drawItem(ctx, item, RES(), 1);
  const translate = ctx.ops.find((o) => o.op === 'translate');
  // The centre is `x + w/2` at the size of the moment: 40 + 100 = 140, not the
  // authored 40 + 50 = 90. A box grows right/down in the reflowed DOM, so it must here.
  assert.deepEqual(translate?.args, [140, 70]);
  const draw = ctx.ops.find((o) => o.op === 'drawImage');
  assert.deepEqual(draw?.args, [-100, -50, 200, 100], 'drawn at the resolved size');
});

test('section 5.2 w/h: a size tween forces a per-frame live re-capture (a plate cannot REFLOW)', async () => {
  // The Lottie machinery, reused: a stretched plate is a stretched picture, while the
  // preview rewraps its text and keeps its border one pixel wide. Parity beats speed,
  // so the layer is re-photographed at the size of the moment - even though it is a
  // STATIC box with no source time at all, which is why `sourceSec` is no longer part
  // of the gate.
  const sized = layer({ kind: 'static', kf: kfTrackOf('t0_el_w100*t1000_el_w400') });
  const asked: { idx: number; frame: number; sourceSec: number }[] = [];
  const io = {
    frame: async (): Promise<void> => {},
    lottieAt: async (idx: number, frame: number, sourceSec: number) => {
      asked.push({ idx, frame, sourceSec }); return null;
    },
  };
  // The FRAME asks, not the wire flag. The main thread does set `needsLiveRaster` on a
  // sized layer (it computed the demands that decided so), but the executor must not
  // depend on that: a job built by hand - or by an older main thread - would otherwise
  // quietly lose the reflow and stretch one plate across the whole tween.
  await runSequenceJob(job([sized]), {} as AnyCanvas, stubCtx(), io);
  assert.equal(asked.length, 4, 'once per active frame, on `item.sized` alone');
  assert.ok(asked.every((a) => a.sourceSec === 0), 'a static box has no source time to offer');

  // …and a layer that keys no size still never goes live, which is the floor.
  asked.length = 0;
  await runSequenceJob(job([layer({ kf: kfTrackOf('t0_x0*t1000_x40') })]), {} as AnyCanvas, stubCtx(), io);
  assert.equal(asked.length, 0);
});

test('section 5.2 w/h: the live re-capture is the picture that gets DRAWN, on every kind', async () => {
  // The other half of the test above, and the half that was missing: asking for the
  // shot, paying for it, and then drawing the authored-size PLATE stretched to the
  // tweened rect is exactly the failure the channel exists to prevent (text scaled
  // instead of rewrapped, a 1 px border four px wide at w×4). The old test's stub
  // returned null, so it proved the request and never the draw.
  const tagOf = (d: unknown): string | undefined => (d as { tag?: string })?.tag;
  const PLATE = { tag: 'plate' } as unknown as CanvasImageSource;
  const OVER = { tag: 'plate-over' } as unknown as CanvasImageSource;
  const LIVE = { tag: 'live' } as unknown as CanvasImageSource;
  const LIVE_OVER = { tag: 'live-over' } as unknown as CanvasImageSource;

  // A STATIC box: a text box that rewraps is `kind: 'static'`, which is the kind the
  // shipped executor read `res.live` for in no branch at all.
  const sized = layer({ kind: 'static', kf: kfTrackOf('t0_el_w100*t1000_el_w400') });
  const one = job([sized]);
  one.plates = [{ idx: sized.idx, under: PLATE, over: null }];
  const ctxA = stubCtx();
  await runSequenceJob(one, {} as AnyCanvas, ctxA, {
    frame: async (): Promise<void> => {},
    lottieAt: async () => LIVE,
  });
  assert.deepEqual(ctxA.draws.map(tagOf), ['live', 'live', 'live', 'live']);

  // …and the static plate is still the FALLBACK for a frame whose shot fails.
  const two = job([layer({ kind: 'static', kf: kfTrackOf('t0_el_w100*t1000_el_w400') })]);
  two.plates = [{ idx: two.layers[0]!.idx, under: PLATE, over: null }];
  const ctxB = stubCtx();
  await runSequenceJob(two, {} as AnyCanvas, ctxB, {
    frame: async (): Promise<void> => {},
    lottieAt: async () => null,
  });
  assert.deepEqual(ctxB.draws.map(tagOf), ['plate', 'plate', 'plate', 'plate']);

  // A VIDEO layer is one box photographed TWICE - opaque with the media hidden, then
  // transparent - because the decoded frame is composited between them. So a size tween
  // has to re-shoot both slots, or the stale `over` ghosts its text over the reflowed
  // copy in `under`.
  const clip = layer({ kind: 'video', kf: kfTrackOf('t0_el_w100*t1000_el_w400') });
  const three = job([clip]);
  three.plates = [{ idx: clip.idx, under: PLATE, over: OVER }];
  const slots: string[] = [];
  const ctxC = stubCtx();
  await runSequenceJob(three, {} as AnyCanvas, ctxC, {
    frame: async (): Promise<void> => {},
    lottieAt: async (_i: number, _f: number, _s: number, slot?: string) => {
      slots.push(slot ?? 'under');
      return slot === 'over' ? LIVE_OVER : LIVE;
    },
  } as never);
  assert.deepEqual(slots.slice(0, 2), ['under', 'over'], 'both plates are re-shot');
  assert.equal(slots.length, 8, 'two slots × four active frames');
  assert.deepEqual(ctxC.draws.map(tagOf).slice(0, 2), ['live', 'live-over']);
});

test('section 5.5 bg: the projected plate is placed by ITS OWN size and the STAGE centre', async () => {
  // The encoder's dimensions are `Math.round(…) & ~1` - forced even for the codecs - 
  // while the plate is `Math.round((native + 2·bgPad)·S)` and every layer above is drawn
  // in native·S space. Deriving the bg draw from `outW` therefore assumed
  // `outW === nativeW·S`, which the even-rounding breaks by up to ~2 px: invisible as a
  // static stretch, a sub-pixel drift of the background AGAINST the layers the moment
  // the camera moves (P1 review, LOW 8).
  const S = 2;
  const nativeW = 101.5;
  const nativeH = 51.5;
  const bgPad = 20;
  const plate = { width: Math.round((nativeW + bgPad * 2) * S), height: Math.round((nativeH + bgPad * 2) * S) };
  assert.equal(plate.width, 283, 'the fixture really is a plate outW cannot express');
  const cam = layer({ kind: 'camera', kf: kfTrackOf('t0_x0*t1000_x-40') });
  const j = job([cam], 2, 2);
  j.bg = plate as unknown as CanvasImageSource;
  j.bgPad = bgPad;
  j.scale = S;
  j.stageW = nativeW;
  j.stageH = nativeH;
  j.outW = Math.round(nativeW * S) & ~1;   // 202, where nativeW·S is 203
  j.outH = Math.round(nativeH * S) & ~1;
  const ctx = opCtx();
  await runSequenceJob(j, {} as AnyCanvas, ctx, { frame: async (): Promise<void> => {} });
  const draw = ctx.ops.find((o) => o.op === 'drawImage');
  assert.ok(draw, 'the background was drawn');
  const cx = (nativeW * S) / 2;
  const cy = (nativeH * S) / 2;
  assert.deepEqual(draw!.args, [-(bgPad * S + cx), -(bgPad * S + cy), plate.width, plate.height]);
  // …and the translate anchors on the STAGE centre, not the canvas's.
  const tr = ctx.ops.find((o) => o.op === 'translate');
  assert.equal(tr!.args[0], cx, 'x anchor is nativeW·S/2, not outW/2');
  assert.equal(tr!.args[1], cy);
});

test('section 5.2 w/h: a clip shape resolves against the TWEENED box, not the authored one', async () => {
  // A `circle(50%)` stops being a circle exactly when the box stops being its authored
  // size, so the percentage has to resolve against the box the browser laid out.
  const ctx = opCtx();
  const w = layer({
    durMs: 2000,
    rect: { x: 0, y: 0, w: 100, h: 100, rot: 0 },
    clipPath: 'circle(50%)',
    kf: kfTrackOf('t0_el_w100_h100*t1000_el_w200_h200'),
  });
  const arcs: number[][] = [];
  class RecordingPath2D {
    arc(...a: number[]): void { arcs.push(a); }
    ellipse(): void {}
    rect(): void {}
    roundRect(): void {}
    moveTo(): void {}
    lineTo(): void {}
    closePath(): void {}
  }
  const g = globalThis as { Path2D?: unknown };
  const had = 'Path2D' in g;
  const prev = g.Path2D;
  g.Path2D = RecordingPath2D;
  try {
    await drawItem(ctx, planOne(w, 1000), RES(), 1);
  } finally {
    if (had) g.Path2D = prev; else delete g.Path2D;
  }
  assert.equal(arcs.length, 1, 'the clip was applied');
  assert.equal(arcs[0]?.[2], 100, 'radius follows the tweened box (50% of 200), not 50');
});
