// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-plan - the pure planner behind deterministic sequence export
 * (Fable timeline, phase 3 section 0.0's "DESIGN REQUIREMENT added by the spike").
 *
 * Run with: node --test tests/sequence-plan.test.ts
 *
 * The compositor's executor is browser-only (WebCodecs, canvas) and Playwright's
 * bundled Chromium has no proprietary codecs, so the planner is where the whole
 * correctness surface has to be pinned down instead - activity windows, junction
 * crossfade alpha, source-time mapping, the frame grid, error normalisation and the
 * silent-truncation guard. Everything here runs headlessly under jsdom.
 *
 * The parity block at the end is the essential one: it runs the REAL
 * views/sequence-clock.ts (the preview the user scrubs) against the planner over a
 * dense time sweep. Preview-vs-export drift is the plan's own stated risk, so it is
 * asserted rather than commented.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import {
  DEFAULT_TRANSITION_MS, EMPTY_KF_TRACK, MAX_SPEED, MAX_TIME_MS, MIN_SPEED,
  MAX_TRANSITION_MS, MIN_TRANSITION_MS, SEQ_ERROR_CODES, TRUNCATION_TOLERANCE_FRAMES,
  activeFrameWindow, activeSpanTimestamps, audioCrossfades, crossfadeExtensions, crossfadeJunctions, duckSpansFor, endOf, frameTimestamps,
  layerKind, normalizeFrameScene, parseSequenceStage, readLayer, reconcileDecoded, rotationOf, sequenceDrawPlan,
  sequenceError, toCodedError,
  boxesTilt, camerasMove, composeFilter, foldKfPose, kfTrackOf, ownsLayerFx, planCameraView,
  readDepthZ, readTiltDeg, REST_TRANSITION, splitFilterBlur, stageCameras,
  splitActive, splitAnimatingAt,
  type PlanItem, type SeqLayer, type SeqPlanEnv,
} from '../shells/web/src/bridge/sequence-plan.ts';
import { recTransition, holdPose, withHold } from '../shells/web/src/lib/transitions.ts';
import {
  applyTimeToElements, authoredStyleOf, borrowAuthoredPose, createAuthoredStore,
  isActiveAt, readTiming, transitionAt, withAuthoredDom,
  type ApplyCtx,
} from '../shells/web/src/views/sequence-clock.ts';
// The session form of the applier - a live per-frame writer, which is what the
// export-time read/restore seam at the end of this file exists to stand down.
// `sequencePoseOf` is the same applier's published fold, which the editor chrome reads
// back rather than re-evaluating (plans/104 section 6.5).
import { applySplitUnits, clearSplitUnits, createSequenceTime, sequencePoseOf } from '../shells/web/src/bridge/sequence-dom.ts';
// …and the pure map from that pose to the rect the selection outline is drawn on.
import { posedRect } from '../shells/web/src/views/free-canvas-math.ts';
import {
  DEFAULT_PERSPECTIVE, KF_CLAMPS, KF_EFF_MAX, KF_Z_FIELD_CLAMP,
  dofBlur, evaluateKf, kfMatrix3dCss, projectLayer,
  type KfMatrix3,
} from '@lolly/engine';

/** The at-rest transition, as the fold's own callers pass it. */
const REST = REST_TRANSITION;

// ── DOM helpers ─────────────────────────────────────────────────────────────

const dom = new JSDOM('<!doctype html><body></body>');
const doc = dom.window.document as Document;

/** Build a stage from raw box HTML. `seq` false omits the sequence markers. */
function stageOf(boxesHtml: string, seqMs: number | string | null = 7000): HTMLElement {
  const wrap = doc.createElement('div');
  const attrs = seqMs === null ? '' : ` data-sequence data-seq-ms="${seqMs}"`;
  wrap.innerHTML = `<div class="artboard"${attrs}>${boxesHtml}</div>`;
  return wrap;
}

/** The exact box markup sequence-studio's hooks emit, parameterised. */
function boxHtml(o: {
  style?: string; time?: string; inner?: string;
} = {}): string {
  const style = o.style ?? 'left:0px;top:0px;width:1920px;height:1080px;';
  return `<div class="lolly-box" style="${style}" ${o.time ?? ''}>${o.inner ?? ''}</div>`;
}

function layerFrom(html: string, totalMs = 7000): SeqLayer {
  const wrap = doc.createElement('div');
  wrap.innerHTML = html;
  return readLayer(wrap.firstElementChild as HTMLElement, 0, totalMs);
}

/** A synthetic layer for plan tests - no DOM needed beyond a placeholder element. */
function fakeLayer(over: Partial<SeqLayer> & { idx: number }): SeqLayer {
  return {
    el: doc.createElement('div'),
    startMs: 0, durMs: 1000, clipInMs: 0, speed: 1, mute: false, gain: 1, pan: 0, duck: 1, pitch: 0, varispeed: false, fx: '',
    enter: null, enterMs: DEFAULT_TRANSITION_MS, exit: null, exitMs: DEFAULT_TRANSITION_MS,
    enterEase: '', exitEase: '',
    split: '', splitStaggerMs: 0, splitOrder: '', splitUnits: 0, splitSeed: 0,
    hold: '', holdRate: 1,
    lane: 'seq', kind: 'static',
    rect: { x: 0, y: 0, w: 100, h: 100, rot: 0 },
    opacity: 1, blend: '', radius: '', clipPath: '', openEnded: false, frameScene: false,
    z: 0, rx: 0, ry: 0, kf: EMPTY_KF_TRACK, blur: 0, shadowFilter: '',
    ...over,
  };
}

// ── 1. parseSequenceStage ───────────────────────────────────────────────────

test('parseSequenceStage returns null when nothing is timed', () => {
  assert.equal(parseSequenceStage(stageOf(boxHtml(), null)), null);
  // A composition with nothing timed emits NEITHER marker - the all-or-nothing rule.
  const bare = doc.createElement('div');
  bare.innerHTML = '<div class="artboard"><div class="lolly-box"></div></div>';
  assert.equal(parseSequenceStage(bare), null);
});

test('parseSequenceStage accepts the stage node itself, not just a descendant', () => {
  const wrap = stageOf(boxHtml({ time: 'data-t-start="0" data-t-dur="1000"' }));
  const artboard = wrap.querySelector('.artboard') as HTMLElement;
  const viaWrapper = parseSequenceStage(wrap);
  const viaStage = parseSequenceStage(artboard);
  assert.ok(viaWrapper && viaStage);
  assert.equal(viaWrapper.totalMs, 7000);
  assert.equal(viaStage.totalMs, 7000);
  assert.equal(viaStage.layers.length, 1);
});

test('parseSequenceStage keeps DOM order as z order', () => {
  const stage = parseSequenceStage(stageOf(
    boxHtml({ time: 'data-t-start="0" data-t-dur="1000"' })
    + boxHtml({ time: 'data-t-start="1000" data-t-dur="1000"' })
    + boxHtml({ time: 'data-t-start="2000" data-t-dur="1000"' }),
  ));
  assert.ok(stage);
  assert.deepEqual(stage.layers.map((l) => l.idx), [0, 1, 2]);
  assert.deepEqual(stage.layers.map((l) => l.startMs), [0, 1000, 2000]);
});

// ── frames-as-scenes (Design, plan 92) ────────────────────────
//
// A "Design" doc times whole FRAME PAGES ([data-pdf-page] carrying data-t-*) end to
// end, rather than individual .lolly-box clips. The planner must treat each timed
// frame page as ONE full-frame scene layer - photographed whole, gated so exactly one
// shows at the playhead - and must NOT double-count the .lolly-box children inside it.

/** A `.lolly-frames` stage of N timed frame pages, each `durMs` long, back to back. */
function framesStage(count: number, durMs: number, seqMs: number): HTMLElement {
  const wrap = doc.createElement('div');
  let pages = '';
  for (let i = 0; i < count; i++) {
    const start = i * durMs;
    // Each page carries a .lolly-box child (a real Design doc always does) precisely to
    // prove those children are NOT enumerated as their own open-ended layers.
    pages += `<div class="lolly-frame-page" data-pdf-page data-t-lane="seq" data-t-start="${start}" data-t-dur="${durMs}" `
      + `style="position:absolute;left:0px;top:0px;width:1080px;height:1080px;background:#ffffff;overflow:hidden;">`
      + `<div class="lolly-box" style="left:40px;top:40px;width:200px;height:80px;background:#123456;"></div>`
      + `</div>`;
  }
  wrap.innerHTML = `<div class="lolly-frames" data-sequence data-seq-ms="${seqMs}">${pages}</div>`;
  return wrap;
}

test('a timed 3-frame stage plans exactly one frame-scene layer per window', () => {
  const stage = parseSequenceStage(framesStage(3, 3000, 9000));
  assert.ok(stage);
  // Three scene layers - the frame PAGES - and nothing else: the .lolly-box children
  // are part of each frame's picture, never separate open-ended layers stacked on top.
  assert.equal(stage.layers.length, 3);
  assert.deepEqual(stage.layers.map((l) => l.startMs), [0, 3000, 6000]);
  assert.deepEqual(stage.layers.map((l) => l.durMs), [3000, 3000, 3000]);
  // A frame page is a STATIC scene (photographed whole), not classified by a child.
  assert.deepEqual(stage.layers.map((l) => l.kind), ['static', 'static', 'static']);
  assert.deepEqual(stage.layers.map((l) => l.rect.w), [1080, 1080, 1080]);

  // Exactly ONE frame is drawn at each window's midpoint, and it is the right one.
  const activeAt = (t: number): number[] =>
    sequenceDrawPlan(stage.layers, t, stage.totalMs).map((p: PlanItem) => p.layer.idx);
  assert.deepEqual(activeAt(1500), [0]); // frame 1 in [0, 3000)
  assert.deepEqual(activeAt(4500), [1]); // frame 2 in [3000, 6000)
  assert.deepEqual(activeAt(7500), [2]); // frame 3 in [6000, 9000)
});

test('an object-clip stage still plans as .lolly-box layers (frames branch is inert)', () => {
  // No [data-pdf-page] anywhere → the enumeration falls through to .lolly-box exactly
  // as before: three timed clips, kept in DOM (z) order, none dropped.
  const stage = parseSequenceStage(stageOf(
    boxHtml({ time: 'data-t-lane="seq" data-t-start="0" data-t-dur="3000"' })
    + boxHtml({ time: 'data-t-lane="seq" data-t-start="3000" data-t-dur="3000"' })
    + boxHtml({ time: 'data-t-lane="seq" data-t-start="6000" data-t-dur="3000"' }),
    9000,
  ));
  assert.ok(stage);
  assert.equal(stage.layers.length, 3);
  assert.deepEqual(stage.layers.map((l) => l.startMs), [0, 3000, 6000]);
  const activeAt = (t: number): number[] =>
    sequenceDrawPlan(stage.layers, t, stage.totalMs).map((p: PlanItem) => p.layer.idx);
  assert.deepEqual(activeAt(1500), [0]);
  assert.deepEqual(activeAt(4500), [1]);
  assert.deepEqual(activeAt(7500), [2]);
});

test('scenery (no data-t-start, no lane) spans the whole sequence', () => {
  const l = layerFrom(boxHtml(), 7000);
  assert.equal(l.startMs, 0);
  assert.equal(l.durMs, 7000);
  assert.equal(l.openEnded, true);
  assert.equal(l.lane, '');
  assert.equal(endOf(l), 7000);
});

test('a box with data-t-lane but no start starts at 0 and runs to the end', () => {
  const l = layerFrom(boxHtml({ time: 'data-t-lane="seq"' }), 5000);
  assert.equal(l.lane, 'seq');
  assert.equal(l.startMs, 0);
  assert.equal(l.durMs, 5000);
  assert.equal(l.openEnded, true);
});

test('an open-ended box in an untimed stage has zero duration, not NaN', () => {
  const l = layerFrom(boxHtml(), 0);
  assert.equal(l.durMs, 0);
  assert.ok(Number.isFinite(l.durMs));
});

test('every timing attribute is read as the hook stamps it', () => {
  const l = layerFrom(boxHtml({
    time: 'data-t-start="1200" data-t-dur="2400" data-clip-in="500" data-t-speed="2"'
      + ' data-t-enter="rise" data-t-enter-ms="450" data-t-exit="fade" data-t-exit-ms="300"'
      + ' data-t-mute="1" data-t-lane="seq"',
  }));
  assert.deepEqual(
    {
      startMs: l.startMs, durMs: l.durMs, clipInMs: l.clipInMs, speed: l.speed,
      enter: l.enter, enterMs: l.enterMs, exit: l.exit, exitMs: l.exitMs,
      mute: l.mute, lane: l.lane, openEnded: l.openEnded,
    },
    {
      startMs: 1200, durMs: 2400, clipInMs: 500, speed: 2,
      enter: 'rise', enterMs: 450, exit: 'fade', exitMs: 300,
      mute: true, lane: 'seq', openEnded: false,
    },
  );
});

test('hostile attributes clamp to the phase-1 ranges and never produce NaN', () => {
  const l = layerFrom(boxHtml({
    time: 'data-t-start="-500" data-t-dur="banana" data-clip-in="-9" data-t-speed="99"'
      + ' data-t-enter="constructor" data-t-enter-ms="1e9" data-t-exit="toString" data-t-exit-ms="0"'
      + ' data-t-mute="yes" data-t-lane="SEQ"',
  }), 4000);
  assert.equal(l.startMs, 0);                    // negative start clamps
  assert.equal(l.durMs, 4000);                   // 'banana' dur == open-ended
  assert.equal(l.clipInMs, 0);
  assert.equal(l.speed, MAX_SPEED);
  // Object.prototype keys must NOT pass as transition kinds (isTransitionKind is
  // hasOwnProperty-based; a bare lookup would let 'constructor' through).
  assert.equal(l.enter, null);
  assert.equal(l.exit, null);
  assert.equal(l.enterMs, MAX_TRANSITION_MS);
  assert.equal(l.exitMs, MIN_TRANSITION_MS);
  assert.equal(l.mute, false);                   // only the literal "1" mutes
  assert.equal(l.lane, '');                      // only the literal "seq" is the lane
  for (const v of [l.startMs, l.durMs, l.clipInMs, l.speed, l.enterMs, l.exitMs]) {
    assert.ok(Number.isFinite(v), `${v} must be finite`);
  }
});

test('Infinity / NaN / empty attribute values fall back rather than propagate', () => {
  const l = layerFrom(boxHtml({
    time: 'data-t-start="Infinity" data-t-dur="NaN" data-clip-in="" data-t-speed="-Infinity"',
  }), 3000);
  assert.equal(l.startMs, 0);                    // Infinity is not a number we accept
  assert.equal(l.durMs, 3000);                   // 'NaN' dur == open-ended
  assert.equal(l.clipInMs, 0);
  assert.equal(l.speed, 1);                      // ...and neither is -Infinity
  // A finite but out-of-range rate DOES clamp, rather than falling back.
  assert.equal(layerFrom(boxHtml({ time: 'data-t-speed="0.01"' })).speed, MIN_SPEED);
});

test('missing attributes give the documented defaults', () => {
  const l = layerFrom(boxHtml({ time: 'data-t-start="100" data-t-dur="900" data-t-enter="pop"' }));
  assert.equal(l.speed, 1);
  assert.equal(l.clipInMs, 0);
  assert.equal(l.enterMs, DEFAULT_TRANSITION_MS);
  assert.equal(l.exit, null);
  assert.equal(l.mute, false);
});

test('geometry comes off the inline style, rotation included', () => {
  const l = layerFrom(boxHtml({
    style: 'left:120px;top:812.5px;width:900px;height:132px;transform:rotate(-4.5deg);'
      + 'opacity:0.8;mix-blend-mode:multiply;border-radius:9999px;clip-path:circle(40%);',
  }));
  assert.deepEqual(l.rect, { x: 120, y: 812.5, w: 900, h: 132, rot: -4.5 });
  assert.equal(l.opacity, 0.8);
  assert.equal(l.blend, 'multiply');
  assert.equal(l.radius, '9999px');
  assert.equal(l.clipPath, 'circle(40%)');
});

test('absent / unparseable geometry is zero, never NaN', () => {
  const l = layerFrom('<div class="lolly-box" style="left:auto;width:calc(100% - 2px);"></div>');
  assert.deepEqual(l.rect, { x: 0, y: 0, w: 0, h: 0, rot: 0 });
  assert.equal(l.opacity, 1);
  assert.equal(l.blend, '');
});

test('rotationOf reads only the rotate term', () => {
  assert.equal(rotationOf('rotate(12deg)'), 12);
  assert.equal(rotationOf('translate(10px, 4px) rotate(-7.25deg) scale(1.2)'), -7.25);
  assert.equal(rotationOf('scale(2)'), 0);
  assert.equal(rotationOf(''), 0);
  assert.equal(rotationOf('rotate(1turn)'), 0);      // not degrees → not ours
});

test('kind is resolved from the box media child', () => {
  assert.equal(layerKind(layerFrom(boxHtml()).el), 'static');
  assert.equal(layerKind(layerFrom(boxHtml({
    inner: '<video class="lolly-box-img lolly-box-video" src="a.mp4"></video>',
  })).el), 'video');
  assert.equal(layerKind(layerFrom(boxHtml({
    inner: '<div class="lolly-box-img lolly-box-lottie" data-lottie-src="a.json"></div>',
  })).el), 'lottie');
  assert.equal(layerKind(layerFrom(boxHtml({
    inner: '<div class="lolly-box-audio" data-audio-src="a.mp3"></div>',
  })).el), 'audio');
  assert.equal(layerKind(layerFrom(boxHtml({ inner: '<img class="lolly-box-img" src="a.png">' })).el), 'static');
});

test('a video frozen to a still by snapshotMotion is still a video layer', () => {
  // snapshotMotion copies the <video>'s className onto the <img> it inserts and
  // hides the video - so the class, not the tag, is what survives into the export.
  const el = layerFrom(boxHtml({
    inner: '<img class="lolly-box-img lolly-box-video" src="data:image/png;base64,">'
      + '<video class="lolly-box-img lolly-box-video" style="display:none"></video>',
  })).el;
  assert.equal(layerKind(el), 'video');
});

test('an audio box outranks any other marker it happens to carry', () => {
  const el = layerFrom(boxHtml({
    inner: '<div class="lolly-box-audio" data-audio-src="a.mp3"></div><img class="lolly-box-img" src="x.png">',
  })).el;
  assert.equal(layerKind(el), 'audio');
});

test('a hostile data-seq-ms cannot make the sequence infinite', () => {
  assert.equal(parseSequenceStage(stageOf(boxHtml(), 'Infinity'))?.totalMs, 0);
  assert.equal(parseSequenceStage(stageOf(boxHtml(), '-1'))?.totalMs, 0);
  assert.equal(parseSequenceStage(stageOf(boxHtml(), 'nope'))?.totalMs, 0);
  assert.equal(parseSequenceStage(stageOf(boxHtml(), 9e12))?.totalMs, MAX_TIME_MS);
});

// ── 2. sequenceDrawPlan - activity ──────────────────────────────────────────

const at = (layers: SeqLayer[], t: number, total = 7000): number[] =>
  sequenceDrawPlan(layers, t, total).map((p) => p.layer.idx);

test('activity is half-open [start, start + dur)', () => {
  const l = [fakeLayer({ idx: 0, startMs: 1000, durMs: 500 })];
  assert.deepEqual(at(l, 999), []);
  assert.deepEqual(at(l, 1000), [0]);            // inclusive head
  assert.deepEqual(at(l, 1499.999), [0]);
  assert.deepEqual(at(l, 1500), []);             // exclusive tail - the clean cut
});

test('a struck-through (ignored) layer never draws - plans/174', () => {
  // readLayer reads the marker off the DOM...
  const struck = layerFrom('<div data-t-start="0" data-t-dur="4000" data-t-ignored="1"></div>');
  assert.equal(struck.ignored, true);
  assert.equal(layerFrom('<div data-t-start="0" data-t-dur="4000"></div>').ignored, false);
  // ...and the plan drops it, even squarely inside its own window.
  const kept = fakeLayer({ idx: 0, startMs: 0, durMs: 4000 });
  const ignored = fakeLayer({ idx: 1, startMs: 0, durMs: 4000, ignored: true });
  assert.deepEqual(at([kept, ignored], 1000), [0]);
});

test('two gapless clips never both appear on a plain cut', () => {
  const layers = [
    fakeLayer({ idx: 0, startMs: 0, durMs: 2000 }),
    fakeLayer({ idx: 1, startMs: 2000, durMs: 2000 }),
  ];
  assert.deepEqual(at(layers, 1999), [0]);
  assert.deepEqual(at(layers, 2000), [1]);
});

test('z order is preserved regardless of start times', () => {
  const layers = [
    fakeLayer({ idx: 0, startMs: 500, durMs: 5000 }),
    fakeLayer({ idx: 1, startMs: 0, durMs: 5000 }),
    fakeLayer({ idx: 2, startMs: 250, durMs: 5000 }),
  ];
  assert.deepEqual(at(layers, 1000), [0, 1, 2]);
});

test('a zero-length or negative-length layer is simply never drawn', () => {
  const layers = [
    fakeLayer({ idx: 0, startMs: 1000, durMs: 0 }),
    fakeLayer({ idx: 1, startMs: 1000, durMs: -500 }),
  ];
  for (const t of [0, 999, 1000, 1001, 5000]) assert.deepEqual(at(layers, t), []);
});

test('scenery is active for the whole span and re-derives against the caller totalMs', () => {
  const scenery = fakeLayer({ idx: 0, lane: '', openEnded: true, durMs: 7000 });
  assert.deepEqual(at([scenery], 0), [0]);
  assert.deepEqual(at([scenery], 6999.9), [0]);
  assert.deepEqual(at([scenery], 7000), []);
  // Told the sequence is now 3 s, the same layer ends at 3 s.
  assert.deepEqual(at([scenery], 4000, 3000), []);
  assert.deepEqual(at([scenery], 2999, 3000), [0]);
});

test('an untimed composition (totalMs 0) draws nothing rather than everything', () => {
  const scenery = fakeLayer({ idx: 0, lane: '', openEnded: true, durMs: 0 });
  assert.deepEqual(at([scenery], 0, 0), []);
});

test('a non-finite playhead is treated as 0 rather than emptying the frame', () => {
  const l = [fakeLayer({ idx: 0, startMs: 0, durMs: 1000 })];
  assert.deepEqual(sequenceDrawPlan(l, Number.NaN, 7000).map((p) => p.layer.idx), [0]);
  assert.deepEqual(sequenceDrawPlan(l, 0, Number.NaN).map((p) => p.layer.idx), [0]);
});

// ── 3. sequenceDrawPlan - transitions ───────────────────────────────────────

const only = (layers: SeqLayer[], t: number, total = 7000) => {
  const plan = sequenceDrawPlan(layers, t, total);
  assert.equal(plan.length, 1, `expected exactly one active layer at ${t}`);
  return plan[0]!;
};

test('a fade-in starts at zero alpha and settles at the authored opacity', () => {
  const l = [fakeLayer({ idx: 0, startMs: 0, durMs: 2000, enter: 'fade', enterMs: 500, opacity: 0.8 })];
  assert.equal(only(l, 0).alpha, 0);                       // p = 0 → nothing yet
  assert.ok(only(l, 150).alpha > 0 && only(l, 150).alpha < 0.8);
  // recTransition's fade alpha reaches 1 at p = 0.6, i.e. 300 ms into a 500 ms enter.
  assert.equal(only(l, 300).alpha, 0.8);
  assert.equal(only(l, 1000).alpha, 0.8);                  // at rest
});

test('a fade-out reaches zero exactly at the tail', () => {
  const l = [fakeLayer({ idx: 0, startMs: 0, durMs: 1000, exit: 'fade', exitMs: 400 })];
  assert.equal(only(l, 599).alpha, 1);                     // outside the exit window
  assert.ok(only(l, 800).alpha < 1);
  assert.ok(only(l, 999.9).alpha < 0.01);
  assert.deepEqual(at(l, 1000), []);                       // and then it is gone
});

test('an open-ended box never runs its exit (its end is not stable)', () => {
  // Parity with sequence-clock: `dur == null` suppresses the exit entirely.
  const l = [fakeLayer({ idx: 0, openEnded: true, startMs: 0, durMs: 7000, exit: 'fade', exitMs: 400 })];
  assert.equal(only(l, 6999).alpha, 1);
});

test('geometry offsets are recTransition\'s, composed with the authored rotation', () => {
  const layer = fakeLayer({
    idx: 0, startMs: 0, durMs: 2000, enter: 'swoop', enterMs: 500,
    rect: { x: 10, y: 20, w: 300, h: 200, rot: -4 },
  });
  const item = only([layer], 200);
  const off = recTransition('swoop', 200 / 500, 300, 200);
  assert.equal(item.dx, off.dx);
  assert.equal(item.dy, off.dy);
  assert.equal(item.scale, off.sc);
  assert.equal(item.rot, -4 + off.rot);          // authored + animation
  assert.equal(item.alpha, off.alpha);
});

test('the transition further from rest wins when enter and exit overlap', () => {
  // A 300 ms clip with a 400 ms enter and a 400 ms exit: both windows cover the whole
  // clip, so the pick flips at the crossover exactly as the clock's transitionAt does.
  const layer = fakeLayer({ idx: 0, startMs: 0, durMs: 300, enter: 'rise', enterMs: 400, exit: 'drop', exitMs: 400 });
  const early = only([layer], 20);
  const late = only([layer], 280);
  // 'rise' pushes DOWN from below (dy > 0); 'drop' pushes up (dy < 0).
  assert.ok(early.dy > 0, 'the entrance owns the head of the clip');
  assert.ok(late.dy < 0, 'the exit owns the tail of the clip');
});

test('an audio layer is planned but never animated', () => {
  const l = [fakeLayer({ idx: 0, kind: 'audio', startMs: 0, durMs: 1000, enter: 'fade', enterMs: 500 })];
  const item = only(l, 0);
  assert.equal(item.alpha, 1);                   // no entrance alpha ramp
  assert.deepEqual([item.dx, item.dy, item.scale, item.rot], [0, 0, 1, 0]);
  assert.equal(item.sourceSec, 0);               // ...but the mix still gets its time
});

// ── 4. source-time mapping ──────────────────────────────────────────────────

test('sourceSec is clipIn + local x speed, and null for statics', () => {
  const video = fakeLayer({ idx: 0, kind: 'video', startMs: 1000, durMs: 4000, clipInMs: 2500, speed: 2 });
  assert.equal(only([video], 1000).sourceSec, 2.5);
  assert.equal(only([video], 2000).sourceSec, 2.5 + 2);       // 1 s of timeline @2x
  assert.equal(only([video], 3000).sourceSec, 2.5 + 4);
  const slow = fakeLayer({ idx: 0, kind: 'video', startMs: 0, durMs: 4000, speed: 0.5 });
  assert.equal(only([slow], 2000).sourceSec, 1);
  assert.equal(only([fakeLayer({ idx: 0, kind: 'static', durMs: 1000 })], 0).sourceSec, null);
  assert.equal(only([fakeLayer({ idx: 0, kind: 'lottie', durMs: 1000, clipInMs: 250 })], 500).sourceSec, 0.75);
});

// ── 5. junction crossfades ──────────────────────────────────────────────────

const xfadePair = (aExitMs = 600, bEnterMs = 600): SeqLayer[] => [
  fakeLayer({ idx: 0, lane: 'seq', startMs: 0, durMs: 2000, exit: 'fade', exitMs: aExitMs }),
  fakeLayer({ idx: 1, lane: 'seq', startMs: 2000, durMs: 2000, enter: 'fade', enterMs: bEnterMs }),
];

test('a fade/fade junction between gapless seq clips is derived, not stored', () => {
  const layers = xfadePair();
  assert.deepEqual(crossfadeJunctions(layers), [{ aIdx: 0, bIdx: 1, ms: 600 }]);
  assert.deepEqual([...crossfadeExtensions(layers)], [[0, 600]]);
});

test('the crossfade length is min(A.exitMs, B.enterMs)', () => {
  assert.equal(crossfadeJunctions(xfadePair(300, 900))[0]?.ms, 300);
  assert.equal(crossfadeJunctions(xfadePair(900, 300))[0]?.ms, 300);
});

test('no junction without fade on BOTH sides, or across a gap', () => {
  const noExit = xfadePair();
  noExit[0]!.exit = null;
  assert.deepEqual(crossfadeJunctions(noExit), []);
  const wrongKind = xfadePair();
  wrongKind[0]!.exit = 'pop';
  assert.deepEqual(crossfadeJunctions(wrongKind), []);
  const gapped = xfadePair();
  gapped[1]!.startMs = 2500;                     // a 500 ms gap: a cut, not a handover
  assert.deepEqual(crossfadeJunctions(gapped), []);
  const overlay = xfadePair();
  overlay[1]!.lane = '';                         // overlays are not seq-lane neighbours
  assert.deepEqual(crossfadeJunctions(overlay), []);
});

test('a 1 ms rounding wobble at the seam still counts as gapless', () => {
  const layers = xfadePair();
  layers[1]!.startMs = 2001;
  assert.equal(crossfadeJunctions(layers).length, 1);
});

test('the outgoing clip stays alive past the cut for the handover', () => {
  const layers = xfadePair();
  assert.deepEqual(at(layers, 1999), [0]);
  assert.deepEqual(at(layers, 2000), [0, 1]);              // BOTH, at the cut
  assert.deepEqual(at(layers, 2599), [0, 1]);
  assert.deepEqual(at(layers, 2600), [1]);                 // handover complete
});

test('the two alphas cross at the midpoint of the handover', () => {
  const layers = xfadePair();
  const mid = sequenceDrawPlan(layers, 2300, 7000);        // 300 ms into a 600 ms fade
  assert.equal(mid.length, 2);
  const a = mid[0]!;
  const b = mid[1]!;
  assert.ok(Math.abs(a.alpha - b.alpha) < 1e-9, `alphas must be equal at the midpoint (${a.alpha} vs ${b.alpha})`);
  assert.ok(a.alpha > 0 && a.alpha < 1);
  // Monotonic handover: A falls, B rises, and the frame is never empty.
  let prevA = Number.POSITIVE_INFINITY;
  let prevB = Number.NEGATIVE_INFINITY;
  for (let t = 2000; t < 2600; t += 25) {
    const plan = sequenceDrawPlan(layers, t, 7000);
    assert.equal(plan.length, 2, `both clips must be live at ${t}`);
    const pa = plan[0]!;
    const pb = plan[1]!;
    assert.ok(pa.alpha <= prevA + 1e-12, `A must not brighten at ${t}`);
    assert.ok(pb.alpha >= prevB - 1e-12, `B must not dim at ${t}`);
    assert.ok(pa.alpha + pb.alpha >= 1, `the frame must never dip to black at ${t}`);
    prevA = pa.alpha;
    prevB = pb.alpha;
  }
  // The endpoints: A at rest as the cut lands, gone by the end of the handover.
  assert.equal(sequenceDrawPlan(layers, 2000, 7000)[0]!.alpha, 1);
  assert.equal(sequenceDrawPlan(layers, 2000, 7000)[1]!.alpha, 0);
  assert.ok(sequenceDrawPlan(layers, 2599.9, 7000)[0]!.alpha < 0.01);
  assert.equal(sequenceDrawPlan(layers, 2599.9, 7000)[1]!.alpha, 1);
});

test('a crossfading outgoing clip does not ALSO fade out before the cut', () => {
  // Its exit is deferred into the handover; fading twice would dip to black at the seam.
  const layers = xfadePair();
  assert.equal(sequenceDrawPlan(layers, 1700, 7000)[0]!.alpha, 1);
  const plain = xfadePair();
  plain[1]!.enter = null;                        // no handover → the ordinary tail fade
  assert.ok(sequenceDrawPlan(plain, 1700, 7000)[0]!.alpha < 1);
});

test('B\'s entrance is shortened to the handover length so the alphas can cross', () => {
  const layers = xfadePair(400, 1200);           // handover = 400 ms
  const mid = sequenceDrawPlan(layers, 2200, 7000);
  assert.equal(mid.length, 2);
  assert.ok(Math.abs(mid[0]!.alpha - mid[1]!.alpha) < 1e-9);
  assert.deepEqual(at(layers, 2400), [1]);
  assert.equal(sequenceDrawPlan(layers, 2400, 7000)[0]!.alpha, 1);   // B fully arrived
});

test('a chain of three crossfading clips hands over twice', () => {
  const layers = [
    fakeLayer({ idx: 0, lane: 'seq', startMs: 0, durMs: 2000, exit: 'fade', exitMs: 500 }),
    fakeLayer({ idx: 1, lane: 'seq', startMs: 2000, durMs: 2000, enter: 'fade', enterMs: 500, exit: 'fade', exitMs: 500 }),
    fakeLayer({ idx: 2, lane: 'seq', startMs: 4000, durMs: 2000, enter: 'fade', enterMs: 500 }),
  ];
  assert.equal(crossfadeJunctions(layers).length, 2);
  assert.deepEqual(at(layers, 2100), [0, 1]);
  assert.deepEqual(at(layers, 3000), [1]);
  assert.deepEqual(at(layers, 4100), [1, 2]);
});

test('a crossfading video keeps decoding through its tail', () => {
  const layers = xfadePair();
  layers[0]!.kind = 'video';
  const tail = sequenceDrawPlan(layers, 2300, 7000)[0]!;
  assert.equal(tail.sourceSec, 2.3);             // past its nominal 2 s end, as it must be
});

// ── 6. the frame grid ───────────────────────────────────────────────────────

test('frameTimestamps lays an exact n/fps grid', () => {
  assert.deepEqual(frameTimestamps(1000, 4), [0, 250, 500, 750]);
  for (const fps of [24, 25, 30, 60]) {
    const ts = frameTimestamps(10_000, fps);
    assert.equal(ts.length, 10 * fps);
    assert.equal(ts[0], 0);
    // Whole seconds must land EXACTLY, not 999.9999999999999.
    for (let s = 1; s < 10; s++) assert.equal(ts[s * fps], s * 1000);
    assert.equal(ts[ts.length - 1], ((10 * fps - 1) * 1000) / fps);
  }
});

test('frameTimestamps is strictly ascending and never overruns the sequence', () => {
  const ts = frameTimestamps(2500, 30);
  assert.equal(ts.length, 75);
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i]! > ts[i - 1]!);
  assert.ok(ts[ts.length - 1]! < 2500);
});

test('frameTimestamps refuses nonsense instead of allocating forever', () => {
  assert.deepEqual(frameTimestamps(0, 30), []);
  assert.deepEqual(frameTimestamps(-1000, 30), []);
  assert.deepEqual(frameTimestamps(Number.NaN, 30), []);
  assert.deepEqual(frameTimestamps(Number.POSITIVE_INFINITY, 30), []);
  assert.deepEqual(frameTimestamps(1000, 0), []);
  assert.deepEqual(frameTimestamps(1000, -30), []);
  assert.deepEqual(frameTimestamps(1000, Number.NaN), []);
});

test('activeSpanTimestamps is the layer\'s own monotonic source-time list', () => {
  const layer = fakeLayer({ idx: 0, kind: 'video', startMs: 1000, durMs: 1000, clipInMs: 500, speed: 1 });
  const ts = activeSpanTimestamps(layer, 10, 3000);
  assert.deepEqual(ts, [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4]);
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i]! > ts[i - 1]!, 'monotonic');
  // Every entry is inside the source span the clip declares.
  const spanEnd = (layer.clipInMs + layer.durMs * layer.speed) / 1000;
  for (const t of ts) assert.ok(t >= layer.clipInMs / 1000 && t < spanEnd);
});

test('activeSpanTimestamps follows speed and covers a crossfade tail', () => {
  const layer = fakeLayer({ idx: 0, kind: 'video', startMs: 0, durMs: 1000, speed: 2 });
  assert.deepEqual(activeSpanTimestamps(layer, 10, 2000), [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8]);
  const withTail = activeSpanTimestamps(layer, 10, 2000, 300);
  assert.equal(withTail.length, 13);
  assert.equal(withTail[12], 2.4);
});

test('activeSpanTimestamps has nothing to decode for a static layer', () => {
  assert.deepEqual(activeSpanTimestamps(fakeLayer({ idx: 0, kind: 'static' }), 30, 5000), []);
});

test('one plan-derived source time matches its activeSpanTimestamps entry', () => {
  // The two must agree or the decoder is asked for frames the compositor never draws.
  const layer = fakeLayer({ idx: 0, kind: 'video', startMs: 400, durMs: 900, clipInMs: 100, speed: 1.5 });
  const ts = activeSpanTimestamps(layer, 25, 3000);
  const grid = frameTimestamps(3000, 25).filter((t) => t >= 400 && t < 1300);
  assert.equal(ts.length, grid.length);
  grid.forEach((t, i) => {
    assert.equal(sequenceDrawPlan([layer], t, 3000)[0]!.sourceSec, ts[i]);
  });
});

// ── 7. toCodedError ─────────────────────────────────────────────────────────

test('mediabunny typed errors map to their codes', () => {
  const unsupported = Object.assign(new Error('Input has an unsupported format'), { name: 'UnsupportedInputFormatError' });
  assert.deepEqual(toCodedError(unsupported), { code: 'SEQ_UNSUPPORTED_MEDIA', message: 'Input has an unsupported format' });
  const disposed = Object.assign(new Error('Input disposed'), { name: 'InputDisposedError' });
  assert.equal(toCodedError(disposed).code, 'SEQ_ABORTED');
});

test('WebCodecs DOMExceptions map by name, without instanceof', () => {
  // DOMException does not exist in Node, so the shapes are duck-typed exactly as a
  // browser would present them.
  const domEx = (name: string, message: string): unknown => ({ name, message, constructor: { name: 'DOMException' } });
  assert.equal(toCodedError(domEx('NotSupportedError', 'codec unsupported')).code, 'SEQ_NO_CODEC');
  assert.equal(toCodedError(domEx('AbortError', 'The operation was aborted')).code, 'SEQ_ABORTED');
  assert.equal(toCodedError(domEx('EncodingError', 'Encoding error')).code, 'SEQ_DECODE_FAILED');
  assert.equal(toCodedError(domEx('QuotaExceededError', 'out of memory')).code, 'SEQ_TOO_HEAVY');
  assert.equal(toCodedError(domEx('InvalidStateError', 'Decoder is closed')).code, 'SEQ_DECODE_FAILED');
});

test('plain Errors are read for meaning, defaulting to SEQ_DECODE_FAILED', () => {
  assert.equal(toCodedError(new Error('File appears truncated')).code, 'SEQ_TRUNCATED');
  assert.equal(toCodedError(new Error('Unexpected end of stream')).code, 'SEQ_TRUNCATED');
  assert.equal(toCodedError(new Error('This track cannot be decoded.')).code, 'SEQ_NO_CODEC');
  assert.equal(toCodedError(new Error('Render cancelled by the user')).code, 'SEQ_ABORTED');
  assert.equal(toCodedError(new Error('Array buffer allocation failed')).code, 'SEQ_TOO_HEAVY');
  assert.equal(toCodedError(new Error('something went sideways')).code, 'SEQ_DECODE_FAILED');
  assert.equal(toCodedError(new Error('something went sideways')).message, 'something went sideways');
});

test('a thrown string, a thrown null and a thrown number all normalise', () => {
  assert.deepEqual(toCodedError('boom'), { code: 'SEQ_DECODE_FAILED', message: 'boom' });
  assert.deepEqual(toCodedError(null), { code: 'SEQ_DECODE_FAILED', message: 'Unknown error' });
  assert.deepEqual(toCodedError(undefined), { code: 'SEQ_DECODE_FAILED', message: 'Unknown error' });
  assert.deepEqual(toCodedError(42), { code: 'SEQ_DECODE_FAILED', message: '42' });
  assert.equal(toCodedError({}).code, 'SEQ_DECODE_FAILED');
});

test('an already-coded error survives a round trip unchanged', () => {
  const e = sequenceError('SEQ_TOO_HEAVY', '18,000 frames is beyond the ceiling');
  assert.deepEqual(toCodedError(e), { code: 'SEQ_TOO_HEAVY', message: '18,000 frames is beyond the ceiling' });
  // ...including a bare object that merely claims a code.
  assert.equal(toCodedError({ code: 'SEQ_TRUNCATED', message: 'short' }).code, 'SEQ_TRUNCATED');
  // ...but a code we do not publish is not honoured.
  assert.equal(toCodedError({ code: 'SEQ_MADE_UP', message: 'nope' }).code, 'SEQ_DECODE_FAILED');
});

test('every published code is reachable and the list is frozen', () => {
  // 7 since plans/104 P2: `SEQ_TILT_UNSUPPORTED` - a tilted camera composites by
  // CAPTURING the live DOM, and dom-to-image cannot photograph a playing <video>, so
  // that one combination refuses with a visible notice instead of exporting a frozen
  // frame under the whole move (section 6.4).
  assert.equal(SEQ_ERROR_CODES.length, 7);
  assert.ok(Object.isFrozen(SEQ_ERROR_CODES));
  for (const code of SEQ_ERROR_CODES) {
    assert.equal(toCodedError(sequenceError(code, 'x')).code, code);
  }
});

// ── 8. reconcileDecoded ─────────────────────────────────────────────────────

test('an exact decode reconciles', () => {
  const r = reconcileDecoded({ expectedSec: 3, decodedFrames: 90, lastTsSec: 3 - 1 / 30, fps: 30 });
  assert.deepEqual(r, { ok: true, shortfallSec: 0 });
});

test('one frame short is tolerated', () => {
  const r = reconcileDecoded({ expectedSec: 3, decodedFrames: 89, lastTsSec: 3 - 2 / 30, fps: 30 });
  assert.ok(r.ok);
  assert.ok(r.shortfallSec > 0 && r.shortfallSec <= TRUNCATION_TOLERANCE_FRAMES / 30);
});

test('three frames short is truncation', () => {
  const r = reconcileDecoded({ expectedSec: 3, decodedFrames: 87, lastTsSec: 3 - 4 / 30, fps: 30 });
  assert.equal(r.ok, false);
  assert.ok(r.shortfallSec > TRUNCATION_TOLERANCE_FRAMES / 30);
});

test('a badly truncated file is caught by either signal alone', () => {
  // Half the file decoded cleanly, no error thrown: only the arithmetic sees it.
  const byBoth = reconcileDecoded({ expectedSec: 3, decodedFrames: 45, lastTsSec: 1.5, fps: 30 });
  assert.equal(byBoth.ok, false);
  assert.ok(Math.abs(byBoth.shortfallSec - 1.5) < 1e-9);   // the worse of the two signals
  // Reached the end but dropped packets on the way.
  const byCount = reconcileDecoded({ expectedSec: 3, decodedFrames: 40, lastTsSec: 3 - 1 / 30, fps: 30 });
  assert.equal(byCount.ok, false);
  // Full frame count but the timestamps stop early (a decode that stalled and repeated).
  const byTs = reconcileDecoded({ expectedSec: 3, decodedFrames: 90, lastTsSec: 2, fps: 30 });
  assert.equal(byTs.ok, false);
});

test('nothing decoded at all is the worst possible shortfall, not a pass', () => {
  const r = reconcileDecoded({ expectedSec: 5, decodedFrames: 0, lastTsSec: 0, fps: 30 });
  assert.equal(r.ok, false);
  assert.ok(Math.abs(r.shortfallSec - 5) < 1e-9);
});

test('a zero-length or unknown expectation cannot fail', () => {
  assert.deepEqual(reconcileDecoded({ expectedSec: 0, decodedFrames: 0, lastTsSec: 0, fps: 30 }), { ok: true, shortfallSec: 0 });
  assert.deepEqual(reconcileDecoded({ expectedSec: Number.NaN, decodedFrames: 5, lastTsSec: 1, fps: 30 }), { ok: true, shortfallSec: 0 });
});

test('a nonsense fps falls back rather than dividing by zero', () => {
  const r = reconcileDecoded({ expectedSec: 3, decodedFrames: 90, lastTsSec: 3 - 1 / 30, fps: 0 });
  assert.ok(r.ok);
  assert.ok(Number.isFinite(r.shortfallSec));
  const bad = reconcileDecoded({ expectedSec: 3, decodedFrames: Number.NaN, lastTsSec: Number.NaN, fps: Number.NaN });
  assert.equal(bad.ok, false);
  assert.ok(Number.isFinite(bad.shortfallSec));
});

test('a decode that overruns the stated duration is not a shortfall', () => {
  const r = reconcileDecoded({ expectedSec: 3, decodedFrames: 120, lastTsSec: 3.9, fps: 30 });
  assert.deepEqual(r, { ok: true, shortfallSec: 0 });
});

// ── 9. PARITY with the live preview (views/sequence-clock.ts) ───────────────
//
// The planner deliberately does not import the clock (bridge must not depend on
// views), so the guarantee that they agree is asserted here against the real module.

test('planner activity matches the clock over a dense sweep', () => {
  const html = boxHtml({ time: 'data-t-start="0" data-t-dur="2000" data-t-exit="drop" data-t-exit-ms="500" data-t-lane="seq"' })
    + boxHtml({ time: 'data-t-start="2000" data-t-dur="2500" data-t-enter="rise" data-t-enter-ms="450" data-t-lane="seq"' })
    + boxHtml({ style: 'left:120px;top:812px;width:900px;height:132px;', time: 'data-t-start="4600" data-t-dur="2400" data-t-enter="pop" data-t-enter-ms="450" data-t-exit="fade" data-t-exit-ms="300"' })
    + boxHtml();   // scenery
  const stage = parseSequenceStage(stageOf(html, 7000));
  assert.ok(stage);
  const els = [...(stage.layers.map((l) => l.el))];
  for (let t = 0; t <= 7000; t += 37) {
    const planned = new Set(sequenceDrawPlan(stage.layers, t, stage.totalMs).map((p) => p.layer.idx));
    els.forEach((el, i) => {
      const timing = readTiming(el);
      // Scenery carries no data-t-* at all: the clock leaves it alone (always on
      // screen), which the planner expresses as an open-ended box.
      const scenery = stage.layers[i]!.openEnded && stage.layers[i]!.lane === '';
      const live = scenery ? t < stage.totalMs : isActiveAt(timing, t, stage.totalMs);
      assert.equal(planned.has(i), live, `layer ${i} at ${t}ms`);
    });
  }
});

test('planner alpha and transform match the clock frame for frame', () => {
  const html = boxHtml({
    style: 'left:10px;top:20px;width:640px;height:360px;transform:rotate(-6deg);opacity:0.9;',
    time: 'data-t-start="500" data-t-dur="3000" data-t-enter="swoop" data-t-enter-ms="600" data-t-exit="tilt" data-t-exit-ms="400"',
  });
  const stage = parseSequenceStage(stageOf(html, 7000));
  assert.ok(stage);
  const layer = stage.layers[0]!;
  const timing = readTiming(layer.el);
  for (let t = 500; t < 3500; t += 13) {
    const item: PlanItem | undefined = sequenceDrawPlan(stage.layers, t, stage.totalMs)[0];
    if (!item) { assert.fail(`nothing planned at ${t}`); return; }
    const tr = transitionAt(timing, t, stage.totalMs);
    const off = tr ? recTransition(tr.kind, tr.p, 640, 360) : { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 };
    assert.equal(item.dx, off.dx, `dx at ${t}`);
    assert.equal(item.dy, off.dy, `dy at ${t}`);
    assert.equal(item.scale, off.sc, `scale at ${t}`);
    assert.equal(item.rot, -6 + off.rot, `rot at ${t}`);
    assert.ok(Math.abs(item.alpha - 0.9 * off.alpha) < 1e-12, `alpha at ${t}`);
  }
});

// ── 10. triage regressions (phase-3 adversarial review, 2026-07-27) ──────────
//
// One test per CONFIRMED defect, written from the reviewer's own failing input so
// the fix is pinned to the thing that was actually wrong rather than to its shape.

test('regression: a crossfade never outlives the clip it hands over to', () => {
  // Reported: `ms = min(a.exitMs, b.enterMs)` is bounded by neither clip, so a
  // 1000 ms handover into a 200 ms clip kept A alive 800 ms past the END of B - 
  // and recTransition's alpha holds at exactly 1.0 for the first 40% of a fade, so
  // A came back at FULL opacity on top of whatever followed.
  const layers = [
    fakeLayer({ idx: 0, lane: 'seq', startMs: 0, durMs: 1000, exit: 'fade', exitMs: 1000 }),
    fakeLayer({ idx: 1, lane: 'seq', startMs: 1000, durMs: 200, enter: 'fade', enterMs: 1000 }),
    fakeLayer({ idx: 2, lane: 'seq', startMs: 1200, durMs: 2000 }),
  ];
  assert.deepEqual(crossfadeJunctions(layers), [{ aIdx: 0, bIdx: 1, ms: 200 }]);
  // A is gone the instant B is: no clip is ever on screen over a later one.
  assert.deepEqual(at(layers, 1150, 3200), [0, 1]);
  assert.deepEqual(at(layers, 1200, 3200), [2]);
  assert.deepEqual(at(layers, 1250, 3200), [2]);
  assert.deepEqual(at(layers, 1900, 3200), [2]);
});

test('regression: the handover is clamped to B, not to A\'s appetite', () => {
  for (const bDur of [50, 100, 400, 5000]) {
    const layers = [
      fakeLayer({ idx: 0, lane: 'seq', startMs: 0, durMs: 1000, exit: 'fade', exitMs: 800 }),
      fakeLayer({ idx: 1, lane: 'seq', startMs: 1000, durMs: bDur, enter: 'fade', enterMs: 800 }),
    ];
    const j = crossfadeJunctions(layers)[0];
    assert.equal(j?.ms, Math.min(800, bDur), `B is ${bDur}ms long`);
    // A's last live instant is never past B's own end.
    const total = 1000 + bDur;
    assert.deepEqual(at(layers, total - 1, total), bDur >= 800 ? [1] : [0, 1]);
    assert.deepEqual(at(layers, total, total), []);
  }
});

test('activeFrameWindow answers first/last/span from ONE grid', () => {
  const layer = fakeLayer({ idx: 0, kind: 'video', startMs: 1000, durMs: 1000, clipInMs: 500 });
  const grid = frameTimestamps(3000, 10);
  const win = activeFrameWindow(layer, grid);
  assert.equal(win.first, 10);
  assert.equal(win.last, 19);
  assert.deepEqual(win.span, activeSpanTimestamps(layer, 10, 3000));
  assert.equal(win.span.length, win.last - win.first + 1);
});

test('regression: a CAPPED grid caps the decode span with it', () => {
  // Reported: gif/apng clamp the frame count to maxVideoFrames() but the span was
  // still built from the uncapped grid, so `reconcileProviders` expected 30 s of
  // decode from a 20 s render and threw SEQ_TRUNCATED after the whole file had
  // already been encoded. The window is now the only source of both numbers.
  const layer = fakeLayer({ idx: 0, kind: 'video', startMs: 0, durMs: 30_000 });
  const full = frameTimestamps(30_000, 30);
  assert.equal(full.length, 900);
  const capped = full.slice(0, 600);
  const win = activeFrameWindow(layer, capped);
  assert.equal(win.first, 0);
  assert.equal(win.last, 599);
  assert.equal(win.span.length, 600);
  assert.ok(Math.abs((win.span[599] as number) - 599 / 30) < 1e-9);
  // And the uncapped window is still the whole thing, so nothing else moved.
  assert.equal(activeFrameWindow(layer, full).span.length, 900);
});

test('activeFrameWindow gives a static layer a window but nothing to decode', () => {
  const win = activeFrameWindow(fakeLayer({ idx: 0, kind: 'static', startMs: 0, durMs: 1000 }), frameTimestamps(2000, 10));
  assert.equal(win.first, 0);
  assert.equal(win.last, 9);
  assert.deepEqual(win.span, []);
  const never = activeFrameWindow(fakeLayer({ idx: 0, startMs: 5000, durMs: 1000 }), frameTimestamps(2000, 10));
  assert.deepEqual(never, { first: -1, last: -1, span: [] });
});

test('regression: a layer the executor never drew is not "truncated"', () => {
  // Reported: `decoded` counts DRAWS, and drawItem returns early for alpha <= 0 or a
  // zero-size box - so a video kept only for its audio (opacity 0) decoded nothing
  // and failed the WHOLE export. Nothing asked ⇒ nothing concluded.
  const r = reconcileDecoded({ expectedSec: 3, decodedFrames: 0, lastTsSec: 0, fps: 30, requestedFrames: 0 });
  assert.deepEqual(r, { ok: true, shortfallSec: 0 });
  // The milder version: one skipped frame at the head of a fade (alpha exactly 0).
  const oneSkipped = reconcileDecoded({ expectedSec: 3, decodedFrames: 89, lastTsSec: 3 - 1 / 30, fps: 30, requestedFrames: 89 });
  assert.deepEqual(oneSkipped, { ok: true, shortfallSec: 0 });
});

test('regression: a low-frame-rate source is not "truncated"', () => {
  // Reported: the tolerance is in span frames but lastSourceSec is a PTS, which lags
  // the request by up to one SOURCE frame - 83 ms on a 12 fps screen recording
  // against a 67 ms tolerance. A complete export died after encoding every frame.
  const twelveFps = reconcileDecoded({
    expectedSec: 2, decodedFrames: 60, lastTsSec: 2 - 1 / 12, fps: 30,
    requestedFrames: 60, sourceFrameSec: 1 / 12,
  });
  assert.ok(twelveFps.ok, `12 fps source reported ${twelveFps.shortfallSec}s short`);
  // And the same signal under slow motion, where the span is sampled FASTER than
  // the source runs: speed 0.25 at 30 fps out samples the source at 120 fps.
  const slowMo = reconcileDecoded({
    expectedSec: 0.5, decodedFrames: 60, lastTsSec: 0.4667, fps: 120,
    requestedFrames: 60, sourceFrameSec: 1 / 30,
  });
  assert.ok(slowMo.ok, `0.25x clip reported ${slowMo.shortfallSec}s short`);
});

test('regression: requests past the source\'s own end are not evidence', () => {
  // Reported: a clip trimmed to (or past) the end of its media, and every crossfade
  // tail, deliberately request source times that cannot exist. 78 requests, 18 of
  // them past a 2 s source, 60 answered - a complete decode.
  const overTrimmed = reconcileDecoded({
    expectedSec: 2, decodedFrames: 60, lastTsSec: 2 - 1 / 30, fps: 30,
    requestedFrames: 78, unreachableFrames: 18, sourceFrameSec: 1 / 30,
  });
  assert.ok(overTrimmed.ok, `over-trimmed clip reported ${overTrimmed.shortfallSec}s short`);
});

test('the truncation guard still fires with every new field supplied', () => {
  // The point of all four corrections above is to stop FALSE positives; a genuinely
  // half-written file must still be caught by exactly the same call shape.
  const half = reconcileDecoded({
    expectedSec: 3, decodedFrames: 45, lastTsSec: 1.5, fps: 30,
    requestedFrames: 90, unreachableFrames: 0, sourceFrameSec: 1 / 30,
  });
  assert.equal(half.ok, false);
  assert.ok(half.shortfallSec > 1.4);
  // Dropped packets while still reaching the end: the count signal alone.
  const holes = reconcileDecoded({
    expectedSec: 3, decodedFrames: 60, lastTsSec: 3 - 1 / 30, fps: 30,
    requestedFrames: 90, unreachableFrames: 0, sourceFrameSec: 1 / 30,
  });
  assert.equal(holes.ok, false);
  assert.ok(Math.abs(holes.shortfallSec - 1) < 1e-9);
});

// ── 11. authored easing ─────────────────────────────────────────────────────
//
// The ease is a per-PHASE string read straight off the box and handed to
// recTransition, which governs GEOMETRY only (alpha keeps its own ramp - see
// lib/transitions.ts). It is deliberately NOT validated on the way in: the curve
// module is the single validator, so a junk value means the same thing to the
// planner as it does to the clock, which is "the preset's own curve".

test('readLayer carries the authored curves verbatim, and \'\' when there are none', () => {
  const eased = layerFrom(boxHtml({
    time: 'data-t-start="0" data-t-dur="1000" data-t-enter="rise" data-t-enter-ease="overshoot"'
      + ' data-t-exit="fade" data-t-exit-ease="cubic-bezier(0.2,0,0.8,1)"',
  }));
  assert.equal(eased.enterEase, 'overshoot');
  assert.equal(eased.exitEase, 'cubic-bezier(0.2,0,0.8,1)');
  const bare = layerFrom(boxHtml({ time: 'data-t-start="0" data-t-dur="1000" data-t-enter="rise"' }));
  assert.equal(bare.enterEase, '');
  assert.equal(bare.exitEase, '');
});

test('the plan applies the curve of the phase that WON, not of the kind', () => {
  // Enter and exit name the same kind with DIFFERENT curves, so a planner that picked
  // the ease off the kind (or off `enterEase` always) would be indistinguishable from
  // a correct one until exactly here.
  const layers = [fakeLayer({
    idx: 0, startMs: 0, durMs: 1000, rect: { x: 0, y: 0, w: 640, h: 360, rot: 0 },
    enter: 'rise', enterMs: 400, enterEase: 'linear',
    exit: 'rise', exitMs: 400, exitEase: 'overshoot',
  })];
  const head = sequenceDrawPlan(layers, 100, 1000)[0]!;
  const tail = sequenceDrawPlan(layers, 900, 1000)[0]!;
  assert.equal(head.dy, recTransition('rise', 0.25, 640, 360, 'linear').dy);
  assert.equal(tail.dy, recTransition('rise', 0.25, 640, 360, 'overshoot').dy);
  assert.notEqual(head.dy, tail.dy, 'the two curves really do differ at the same progress');
});

test('an unauthored or junk curve plans exactly what it planned before the control existed', () => {
  // Only the DRAWN state: `item.layer` echoes the authored string back, so comparing
  // whole plan items would only ever prove that junk is spelled differently.
  const drawn = (ease: string): Omit<PlanItem, 'layer'> => {
    const { layer: _layer, ...rest } = sequenceDrawPlan([fakeLayer({
      idx: 0, startMs: 0, durMs: 1000, rect: { x: 0, y: 0, w: 640, h: 360, rot: 0 },
      enter: 'pop', enterMs: 400, enterEase: ease,
    })], 100, 1000)[0]!;
    return rest;
  };
  const bare = drawn('');
  for (const junk of ['wobble', 'cubic-bezier(0,0,1)', 'cubic-bezier(2,0,1,1)', 'constructor', 'toString']) {
    assert.deepEqual(drawn(junk), bare, junk);
  }
  // And it is the kind's OWN default curve, not a generic one: pop is easeOutBack.
  assert.equal(bare.scale, recTransition('pop', 0.25, 640, 360).sc);
});

test('the crossfade tail keeps the curve the AUTHOR wrote, not the junction\'s kind', () => {
  // At a junction the outgoing kind is 'fade', derived from the two neighbours rather
  // than read off either field - but the curve still belongs to A's authored exit.
  const layers = [
    fakeLayer({ idx: 0, lane: 'seq', startMs: 0, durMs: 1000, rect: { x: 0, y: 0, w: 640, h: 360, rot: 0 }, exit: 'fade', exitMs: 400, exitEase: 'overshoot' }),
    fakeLayer({ idx: 1, lane: 'seq', startMs: 1000, durMs: 1000, enter: 'fade', enterMs: 400 }),
  ];
  const tail = sequenceDrawPlan(layers, 1100, 2000).find((i) => i.layer.idx === 0)!;
  const expect = recTransition('fade', 0.75, 640, 360, 'overshoot');
  assert.equal(tail.dx, expect.dx);
  assert.ok(Math.abs(tail.alpha - expect.alpha) < 1e-12, 'alpha is the fade\'s own ramp, curve or no curve');
});

test('PARITY: an authored curve moves the planner and the clock the SAME way', () => {
  // The essential one. The preview the user scrubs and the file that gets rendered
  // read the ease from the same attributes through two different modules; a drift here
  // is exactly the class of bug this whole file exists to make impossible.
  for (const [enterEase, exitEase] of [['', ''], ['linear', 'linear'], ['overshoot', 'anticipate'], ['cubic-bezier(0.2,1.4,0.6,1)', 'wobble']]) {
    const html = boxHtml({
      style: 'left:10px;top:20px;width:640px;height:360px;transform:rotate(-6deg);opacity:0.9;',
      time: 'data-t-start="500" data-t-dur="3000" data-t-enter="swoop" data-t-enter-ms="600"'
        + ` data-t-exit="tilt" data-t-exit-ms="400" data-t-enter-ease="${enterEase}" data-t-exit-ease="${exitEase}"`,
    });
    const stage = parseSequenceStage(stageOf(html, 7000));
    assert.ok(stage);
    const timing = readTiming(stage.layers[0]!.el);
    assert.equal(timing.enterEase, enterEase, 'both readers see the same authored string');
    assert.equal(stage.layers[0]!.enterEase, enterEase);
    for (let t = 500; t < 3500; t += 13) {
      const item: PlanItem | undefined = sequenceDrawPlan(stage.layers, t, stage.totalMs)[0];
      if (!item) { assert.fail(`nothing planned at ${t}`); return; }
      const tr = transitionAt(timing, t, stage.totalMs);
      const off = tr ? recTransition(tr.kind, tr.p, 640, 360, tr.ease) : { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 };
      assert.equal(item.dx, off.dx, `dx at ${t} (${enterEase}/${exitEase})`);
      assert.equal(item.dy, off.dy, `dy at ${t} (${enterEase}/${exitEase})`);
      assert.equal(item.scale, off.sc, `scale at ${t} (${enterEase}/${exitEase})`);
      assert.equal(item.rot, -6 + off.rot, `rot at ${t} (${enterEase}/${exitEase})`);
      assert.ok(Math.abs(item.alpha - 0.9 * off.alpha) < 1e-12, `alpha at ${t}`);
    }
  }
});

test('PARITY: and an authored curve is not a no-op in either of them', () => {
  // The sweep above passes vacuously if the ease never reaches recTransition at all.
  const at = (ease: string): { plan: number; clock: number } => {
    const html = boxHtml({
      style: 'left:0px;top:0px;width:640px;height:360px;',
      time: `data-t-start="0" data-t-dur="3000" data-t-enter="rise" data-t-enter-ms="600" data-t-enter-ease="${ease}"`,
    });
    const stage = parseSequenceStage(stageOf(html, 7000))!;
    const timing = readTiming(stage.layers[0]!.el);
    const tr = transitionAt(timing, 150, 7000)!;
    return {
      plan: sequenceDrawPlan(stage.layers, 150, 7000)[0]!.dy,
      clock: recTransition(tr.kind, tr.p, 640, 360, tr.ease).dy,
    };
  };
  const bare = at('');
  const linear = at('linear');
  assert.equal(bare.plan, bare.clock);
  assert.equal(linear.plan, linear.clock);
  assert.notEqual(linear.plan, bare.plan, 'the authored curve really did change the geometry');
});

// ── ISSUE 1: frames-as-scenes slideshow normalises every slide to the viewport ──
//
// A "Design" frames slideshow places its pages side by side on the pasteboard
// (x = 0, 1120, 2240 …). The video output is one slide wide, so without normalising
// the draw rect, slides 2..N land off-canvas and only slide 1 ever appears. The pure
// planner's job is: (a) a timed [data-pdf-page] page reads back frameScene=true, a
// plain .lolly-box reads false; (b) normalizeFrameScene re-anchors a frameScene
// layer's draw rect to (0,0,nativeW,nativeH) and leaves a .lolly-box untouched.

/** A [data-pdf-page] frames stage: three side-by-side pages, each timed to its window. */
function framesStageOf(): HTMLElement {
  const wrap = doc.createElement('div');
  const page = (id: string, x: number, start: number): string =>
    `<div class="lolly-box" data-pdf-page data-t-start="${start}" data-t-dur="2000" ` +
    `style="left:${x}px;top:0px;width:1080px;height:1080px;"></div>`;
  wrap.innerHTML =
    `<div class="artboard" data-sequence data-seq-ms="6000">` +
    page('s1', 0, 0) + page('s2', 1120, 2000) + page('s3', 2240, 4000) +
    `</div>`;
  return wrap;
}

test('frames stage: each timed [data-pdf-page] is a frameScene layer', () => {
  const stage = parseSequenceStage(framesStageOf())!;
  assert.equal(stage.layers.length, 3);
  for (const l of stage.layers) {
    assert.equal(l.frameScene, true, 'a [data-pdf-page] page is a frameScene');
    assert.equal(l.kind, 'static', 'a frame page is photographed whole → static');
  }
  // The authored x/y are still read verbatim - the committed geometry is untouched.
  assert.deepEqual(stage.layers.map((l) => l.rect.x), [0, 1120, 2240]);
});

test('object-clip .lolly-box is NOT a frameScene', () => {
  const stage = parseSequenceStage(stageOf(boxHtml({ time: 'data-t-start="0" data-t-dur="2000"' }), 6000))!;
  assert.equal(stage.layers[0]!.frameScene, false);
});

test('normalizeFrameScene re-anchors a frame page to (0,0,nativeW,nativeH)', () => {
  const stage = parseSequenceStage(framesStageOf())!;
  const nativeW = stage.layers[0]!.rect.w;   // 1080 - the first frame's own size
  const nativeH = stage.layers[0]!.rect.h;
  for (const l of stage.layers) {
    const n = normalizeFrameScene(l, nativeW, nativeH);
    assert.equal(n.rect.x, 0, 'slide re-anchored to the output origin');
    assert.equal(n.rect.y, 0);
    assert.equal(n.rect.w, nativeW, 'slide fills the viewport width');
    assert.equal(n.rect.h, nativeH, 'slide fills the viewport height');
    assert.equal(n.rect.rot, 0);
  }
  // Frames-mode output size is the first frame's box, not the side-by-side strip.
  assert.equal(stage.layers.some((l) => l.frameScene), true);
});

test('normalizeFrameScene contain-fits a DIFFERENT-sized artboard (letterbox, never stretch)', () => {
  // plans/141 WP-C: artboards stay freely mixed-size; the format resolves them at
  // export time. A 1080×1080 square slide into a 1920×1080 output frame scales to
  // 1080×1080 (s = min(1920/1080, 1080/1080) = 1) centred horizontally - pillarboxed,
  // aspect kept. A portrait 540×1080 slide scales the same way. Nothing stretches.
  const stage = parseSequenceStage(framesStageOf())!;
  const l = stage.layers[0]!;                  // 1080×1080 square
  const n = normalizeFrameScene(l, 1920, 1080);
  assert.equal(n.rect.w, 1080, 'aspect kept - width scales by the limiting axis');
  assert.equal(n.rect.h, 1080);
  assert.equal(n.rect.x, 420, 'centred in the wider output frame: (1920−1080)/2');
  assert.equal(n.rect.y, 0);
  // Downscale case: the same slide into a smaller 960×540 frame.
  const d = normalizeFrameScene(l, 960, 540);
  assert.equal(d.rect.w, 540, 's = min(960/1080, 540/1080) = 0.5');
  assert.equal(d.rect.h, 540);
  assert.equal(d.rect.x, 210, '(960−540)/2');
  assert.equal(d.rect.y, 0);
});

test('normalizeFrameScene leaves an object-clip .lolly-box untouched', () => {
  const stage = parseSequenceStage(stageOf(
    boxHtml({ style: 'left:320px;top:180px;width:640px;height:360px;', time: 'data-t-start="0" data-t-dur="2000"' }),
    6000,
  ))!;
  const l = stage.layers[0]!;
  const n = normalizeFrameScene(l, 640, 360);
  assert.equal(n, l, 'a non-frameScene layer is returned verbatim (same reference)');
  assert.equal(n.rect.x, 320);
  assert.equal(n.rect.y, 180);
});

test('normalized slides gate one-at-a-time across the sequence', () => {
  const stage = parseSequenceStage(framesStageOf())!;
  // Exactly one slide is active in each window (gating is by time, unaffected by the
  // spatial normalisation - so with the off-canvas anchor gone, every slide shows).
  for (const [t, wantIdx] of [[500, 0], [2500, 1], [4500, 2]] as const) {
    const active = sequenceDrawPlan(stage.layers, t, 6000);
    assert.equal(active.length, 1, `one slide active at t=${t}`);
    assert.equal(active[0]!.layer.idx, wantIdx);
  }
});

// ── plans/104 - depth, keyframes, and the two evaluators ────────────────────
//
// The feature adds two attributes (`data-t-z`, `data-t-kf`) that BOTH readers have
// to read the same way, a fold (section 4.1) that both have to compose in the same order,
// and a paint order (section 4.2) that both have to resolve to the same sequence. Everything
// below exists because the alternative is a preview that disagrees with the file.
//
// The floor under all of it: a document that authors NEITHER attribute must come out
// of both paths exactly as it did before any of this existed. That is asserted first.

/** A [data-sequence] stage sized like a real artboard, so the projection has a centre. */
function depthStage(boxesHtml: string, seqMs = 4000): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.innerHTML = `<div class="artboard" data-sequence data-seq-ms="${seqMs}"`
    + ` style="width:1920px;height:1080px;">${boxesHtml}</div>`;
  return wrap;
}

/** One box, with geometry the two readers both take off the inline style. */
function depthBox(o: {
  left?: number; top?: number; w?: number; h?: number;
  style?: string; time?: string; inner?: string;
} = {}): string {
  const style = `left:${o.left ?? 200}px;top:${o.top ?? 100}px;`
    + `width:${o.w ?? 640}px;height:${o.h ?? 360}px;${o.style ?? ''}`;
  return `<div class="lolly-box" style="${style}" ${o.time ?? ''}>${o.inner ?? ''}</div>`;
}

/** The stage size both evaluators are told about. Same numbers, two shapes. */
const STAGE = { w: 1920, h: 1080 };
const PLAN_ENV: SeqPlanEnv = { stageW: STAGE.w, stageH: STAGE.h };
const applyCtx = (seqMs: number): ApplyCtx => ({
  seqMs, store: createAuthoredStore(), stage: () => ({ ...STAGE }),
});

/** The DOM path's own quantum for transforms (`n3` in sequence-dom.ts). */
const n3 = (v: number): number => Math.round(v * 1000) / 1000;
/** …and for opacity (composeOpacity). */
const n4 = (v: number): number => Math.round(v * 10000) / 10000;

/**
 * The numbers the applier actually WROTE, read back off the element.
 *
 * `composeTransform` emits `translate(dx,dy) <authored> rotate(anim) scale(sc)`, and
 * the authored transform is rotate-only by the planner's own contract, so summing
 * every rotate term recovers exactly the planner's `rect.rot + fold.rot`.
 */
function written(el: HTMLElement): { dx: number; dy: number; sc: number; rot: number; alpha: number } {
  const t = el.style.transform || '';
  const tr = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/.exec(t);
  const sc = /scale\(\s*(-?[\d.]+)\s*\)/.exec(t);
  let rot = 0;
  for (const m of t.matchAll(/rotate\(\s*(-?[\d.]+)deg\s*\)/g)) rot += parseFloat(m[1] as string);
  const op = el.style.opacity;
  return {
    dx: tr ? parseFloat(tr[1] as string) : 0,
    dy: tr ? parseFloat(tr[2] as string) : 0,
    sc: sc ? parseFloat(sc[1] as string) : 1,
    rot,
    alpha: op === '' || op == null ? 1 : parseFloat(op),
  };
}

// ── the byte-identity floor ────────────────────────────────────────────────

test('DEPTH FLOOR: a document with no z and no kf writes not one new property', () => {
  const html = depthBox({
    style: 'transform:rotate(-6deg);opacity:0.9;filter:blur(4px) drop-shadow(0px 2px 10px #00000055);',
    time: 'data-t-start="0" data-t-dur="2000" data-t-enter="rise" data-t-enter-ms="600"',
  });
  const node = depthStage(html);
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const ctx = applyCtx(4000);
  for (const t of [0, 120, 300, 900, 1900]) applyTimeToElements([el], t, ctx);
  // The two new per-frame properties are the whole of what plans/104 adds to the
  // surface, and neither may appear on a stage that authors no depth.
  assert.equal(el.style.filter, 'blur(4px) drop-shadow(0px 2px 10px #00000055)',
    'the authored filter is left spelled exactly as the hook wrote it');
  assert.equal(el.style.zIndex, '', 'no z-index is invented');
  // And the plan's own numbers are the transition\'s, untouched by the fold.
  const stage = parseSequenceStage(node)!;
  const layer = stage.layers[0] as SeqLayer;
  assert.equal(layer.z, 0);
  assert.equal(layer.kf.length, 0);
  assert.equal(layer.blur, 4, 'the authored blur is read, not invented');
  assert.equal(layer.shadowFilter, 'drop-shadow(0px 2px 10px #00000055)');
  for (const t of [0, 120, 300, 900, 1900]) {
    const withEnv = sequenceDrawPlan(stage.layers, t, 4000, PLAN_ENV)[0] as PlanItem;
    const without = sequenceDrawPlan(stage.layers, t, 4000)[0] as PlanItem;
    assert.deepEqual(withEnv, without, `a camera-ready env changes nothing at t=${t}`);
    const tr = transitionAt(readTiming(el), t, 4000);
    const off = tr ? recTransition(tr.kind, tr.p, 640, 360, tr.ease) : { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 };
    // Exact equality, not a tolerance: the projection must not round-trip these
    // through `W/2 + (cx + dx − W/2)`, which is identity in ℝ and not in IEEE-754.
    assert.equal(withEnv.dx, off.dx, `dx at ${t}`);
    assert.equal(withEnv.dy, off.dy, `dy at ${t}`);
    assert.equal(withEnv.scale, off.sc, `scale at ${t}`);
    assert.equal(withEnv.rot, -6 + off.rot, `rot at ${t}`);
    assert.equal(withEnv.blur, 4, 'total blur is the authored blur and nothing else');
    assert.equal(withEnv.resolvedZ, 0);
  }
});

test('DEPTH FLOOR: the fold at eff = 1 is the transition offset EXACTLY, not within epsilon', () => {
  // The naive `projectLayer` answer for this case is 0.10000000000002274. A document
  // that uses no depth may not move by that much, so the fold short-circuits - and
  // this is the assertion that says so out loud.
  const view = planCameraView(PLAN_ENV, 0);
  const fold = foldKfPose({
    view, cx: 10, cy: 7, tr: { dx: 0.1, dy: -0.3, sc: 1, alpha: 1, rot: 0 },
    pose: {}, zField: 0, authoredBlur: 0,
  });
  assert.equal(fold.dx, 0.1);
  assert.equal(fold.dy, -0.3);
  assert.equal(fold.scale, 1);
  assert.equal(fold.z, 0);
  // …and it really is the same number the engine would have produced, to a hair.
  const proj = projectLayer(view, { bx: 10, by: 7, dxT: 0.1, dyT: -0.3, z: 0 });
  assert.ok(Math.abs(proj.dx - fold.dx) < 1e-9 && proj.dx !== fold.dx,
    'the short-circuit agrees with projectLayer while being the exact value');
});

// ── the readers ────────────────────────────────────────────────────────────

test('both readers read data-t-z through the ENGINE clamp, not a re-typed one', () => {
  const [lo, hi] = KF_Z_FIELD_CLAMP;
  for (const [raw, want] of [['0', 0], ['140', 140], ['-140', -140], ['99999', hi], ['-99999', lo], ['', 0], ['nope', 0], ['Infinity', 0]] as const) {
    const node = depthStage(depthBox({ time: `data-t-start="0" data-t-dur="1000" data-t-z="${raw}"` }));
    const el = node.querySelector('.lolly-box') as HTMLElement;
    assert.equal(readTiming(el).z, want, `clock z for "${raw}"`);
    assert.equal((parseSequenceStage(node)!.layers[0] as SeqLayer).z, want, `plan z for "${raw}"`);
  }
  assert.equal(readDepthZ('99999'), hi);
  assert.equal(hi, 900, 'the field clamp is still the plan\'s 900 - if this moves, the engine moved it');
});

test('both readers read data-t-rx / data-t-ry through ONE readTiltDeg (P2.1)', () => {
  // The audio/camera-marker precedent, restated for the tilt: a reader added to one
  // evaluator only is precisely the "the two evaluators enumerate different scenes"
  // defect. Same function, same band, same answer to the same junk.
  for (const [raw, want] of [
    ['0', 0], ['-40', -40], ['12.5', 12.5], ['999', 75], ['-999', -75],
    ['', 0], ['nope', 0], ['Infinity', 0], ['NaN', 0],
  ] as const) {
    const node = depthStage(depthBox({ time: `data-t-start="0" data-t-dur="1000" data-t-rx="${raw}" data-t-ry="${raw}"` }));
    const el = node.querySelector('.lolly-box') as HTMLElement;
    assert.equal(readTiming(el).rx, want, `clock rx for "${raw}"`);
    assert.equal(readTiming(el).ry, want, `clock ry for "${raw}"`);
    const layer = parseSequenceStage(node)!.layers[0] as SeqLayer;
    assert.equal(layer.rx, want, `plan rx for "${raw}"`);
    assert.equal(layer.ry, want, `plan ry for "${raw}"`);
  }
  // The FIELD clamp is deliberately tighter than the kf WIRE clamp, exactly as z's is:
  // a hand-authored link past the control range is held, not honoured.
  assert.equal(readTiltDeg('180'), 75);
  assert.deepEqual(KF_CLAMPS.rx, [-180, 180], 'the wire is still the wider number');
});

test('boxesTilt is the export gate\'s box half - coarse, exact-non-zero, film-wide', () => {
  // Null when nothing tilts: the byte-identity floor, and what keeps every existing
  // document on the canvas compositor.
  assert.equal(boxesTilt(null), null);
  assert.equal(boxesTilt([]), null);
  assert.equal(boxesTilt([fakeLayer({ idx: 0 })]), null);
  assert.equal(boxesTilt([fakeLayer({ idx: 0, z: 220, kf: kfTrackOf('t0_x0*t1000_x40') })]), null,
    'depth and a position track are not a tilt');

  // A BASE FIELD triggers it, and reports itself as the scene pose (atMs null).
  assert.deepEqual(boxesTilt([fakeLayer({ idx: 0 }), fakeLayer({ idx: 1, rx: -40 })]),
    { ch: 'rx', deg: -40, atMs: null });
  assert.deepEqual(boxesTilt([fakeLayer({ idx: 0, ry: 25 })]), { ch: 'ry', deg: 25, atMs: null });

  // A KEY triggers it too, at absolute film time - the layer's start plus the key's own.
  assert.deepEqual(boxesTilt([fakeLayer({ idx: 0, startMs: 1500, kf: kfTrackOf('t0_x0*t800_rx-8') })]),
    { ch: 'rx', deg: -8, atMs: 2300 });
  // …and a track that only ever says ZERO is not a tilt: gating on "has an rx channel"
  // would move every settled tumble onto the ten-times-slower tier for nothing.
  assert.equal(boxesTilt([fakeLayer({ idx: 0, kf: kfTrackOf('t0_rx0*t800_rx0') })]), null);

  // The projection's own exclusions apply: an audio bed and a camera marker paint
  // nothing, and a camera's own tilt is `camerasTilt`'s answer, not this one's.
  assert.equal(boxesTilt([fakeLayer({ idx: 0, kind: 'audio', rx: -40 })]), null);
  assert.equal(boxesTilt([fakeLayer({ idx: 0, kind: 'camera', kf: kfTrackOf('t0_rx-40') })]), null);
  assert.equal(boxesTilt([fakeLayer({ idx: 0, frameScene: true, rx: -40 })]), null, 'a frame page is out of scope');
});

test('PARITY: a tilted box writes the SAME matrix in the applier and the planner (P2.1)', () => {
  // The whole reason `foldKfPose` is one function: a box tilt reaches the preview
  // through `composeTransform`'s `matrix3d` and the export through `PlanItem.m3`, and
  // if those are ever two matrices the file and the picture disagree.
  //
  // Three cases, and each of them is a latch that was inert before P2.1: a base field
  // with no depth, no track and no camera (which nothing on the stage would otherwise
  // measure); a keyed tilt (which reaches the fold on `kf.length` but used to be
  // dropped there); and the two together, where the KEY replaces the FIELD.
  for (const [what, time, t] of [
    ['a base field alone', 'data-t-rx="-40" data-t-ry="25"', 0],
    ['a keyed tilt', 'data-t-start="0" data-t-dur="2000" data-t-kf="t0_rx-40*t2000_rx-40"', 500],
    ['a key over a field', 'data-t-start="0" data-t-dur="2000" data-t-rx="-12" data-t-ry="25"'
      + ' data-t-kf="t0_rx-40*t2000_rx-40"', 500],
  ] as const) {
    const node = depthStage(depthBox({ time }));
    const el = node.querySelector('.lolly-box') as HTMLElement;
    applyTimeToElements([el], t, applyCtx(4000));
    const written = el.style.transform;
    const stage = parseSequenceStage(node)!;
    const item = sequenceDrawPlan(stage.layers, t, 4000, PLAN_ENV)[0] as PlanItem;
    assert.ok(item.m3, `${what}: the planner must hand the executor a homography`);
    assert.ok(written.startsWith(kfMatrix3dCss(item.m3 as KfMatrix3)),
      `${what}: the applier wrote ${written}, the planner planned ${kfMatrix3dCss(item.m3 as KfMatrix3)}`);
    // The matrix REPLACES the leading translate; it never rides beside one.
    assert.ok(!/translate\(/.test(written), `${what}: no translate beside the matrix (${written})`);
    // And the pose the editor chrome reads back knows it is looking at a trapezoid.
    assert.equal(sequencePoseOf(el)?.tilted, true, `${what}: the published pose is flagged tilted`);
  }
});

test('PARITY: the fold\'s flat short-circuit must not swallow a box tilt', () => {
  // `flat` is an IEEE byte-identity path that takes the transition offset straight
  // through and throws the homography away. Under a parked camera a box tilt leaves
  // `proj.scale` at exactly 1 and the camera at the origin, so every other clause of
  // that test is true - only `!boxTilted` stops it, and this is the assertion that
  // fails if the clause is ever dropped as redundant.
  const view = planCameraView(PLAN_ENV, 0);
  const flat = foldKfPose({
    view, cx: 520, cy: 280, tr: REST, pose: {}, zField: 0, authoredBlur: 0, boxW: 640, boxH: 360,
  });
  assert.equal(flat.m3, null, 'precondition: an untilted box on a parked camera is flat');
  const tilted = foldKfPose({
    view, cx: 520, cy: 280, tr: REST, pose: {}, zField: 0, rxField: -40, authoredBlur: 0,
    boxW: 640, boxH: 360,
  });
  assert.ok(tilted.m3, 'a tilted box takes the homography path even with the camera parked');
  // …and a keyed rx REPLACES the field, exactly as a keyed z replaces the depth field.
  const keyed = foldKfPose({
    view, cx: 520, cy: 280, tr: REST, pose: { rx: 0 }, zField: 0, rxField: -40, authoredBlur: 0,
    boxW: 640, boxH: 360,
  });
  assert.equal(keyed.m3, null, 'a keyed 0 flattens an authored tilt for its segment');
});

test('both readers parse data-t-kf through ONE cache, junk and all', () => {
  const track = 't0_z0_x-40*t1000_eo_z140_x0';
  const node = depthStage(depthBox({ time: `data-t-start="0" data-t-dur="2000" data-t-kf="${track}"` }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const fromClock = readTiming(el).kf;
  const fromPlan = (parseSequenceStage(node)!.layers[0] as SeqLayer).kf;
  assert.equal(fromClock.length, 2);
  // The SAME frozen array, not merely an equal one: that is what lets the engine
  // memoise the per-track channel index instead of rebuilding it on both sides.
  assert.equal(fromClock, fromPlan);
  assert.equal(fromClock, kfTrackOf(track));
  // Junk is skipped, never thrown, and an attribute that parses to nothing reads as
  // "not keyframed" rather than as a broken track.
  for (const junk of ['', '   ', 'wobble', '"><img src=x>', 'constructor', '*_*_*']) {
    const j = depthStage(depthBox({ time: `data-t-start="0" data-t-dur="1000" data-t-kf="${junk}"` }));
    const jel = j.querySelector('.lolly-box') as HTMLElement;
    assert.equal(readTiming(jel).kf.length, 0, `junk "${junk}"`);
    assert.equal((parseSequenceStage(j)!.layers[0] as SeqLayer).kf.length, 0, `junk "${junk}"`);
  }
});

test('splitFilterBlur takes the authored blur apart and composeFilter puts it back', () => {
  assert.deepEqual(splitFilterBlur('blur(4.5px) drop-shadow(0px 21px 46px #00000055)'),
    { blur: 4.5, rest: 'drop-shadow(0px 21px 46px #00000055)' });
  assert.deepEqual(splitFilterBlur('drop-shadow(0px 2px 10px #00000055)'),
    { blur: 0, rest: 'drop-shadow(0px 2px 10px #00000055)' });
  assert.deepEqual(splitFilterBlur(''), { blur: 0, rest: '' });
  assert.deepEqual(splitFilterBlur('none'), { blur: 0, rest: '' });
  assert.equal(composeFilter(4.5, 'drop-shadow(0px 21px 46px #00000055)'),
    'blur(4.5px) drop-shadow(0px 21px 46px #00000055)');
  assert.equal(composeFilter(0, 'drop-shadow(0px 21px 46px #00000055)'),
    'drop-shadow(0px 21px 46px #00000055)', 'a zero blur leaves no blur() behind');
  assert.equal(composeFilter(0, ''), '');
});

// ── section 4.1: the fold, and the reading that gets it wrong ─────────────────────

test('section 4.1 FOLD: a transition offset on a LIFTED layer is scaled by eff, not added beside it', () => {
  // The defect this exists to catch: adding the camera displacement to an UNSCALED
  // transition offset, which makes a slide enter land short on a lifted layer.
  const time = 'data-t-start="0" data-t-dur="2000" data-t-enter="slide-left" data-t-enter-ms="800"'
    + ' data-t-z="220" data-t-kf="t0_x-120*t2000_el_x40"';
  const node = depthStage(depthBox({ time }));
  const stage = parseSequenceStage(node)!;
  const layer = stage.layers[0] as SeqLayer;
  const t = 300;                                  // mid-enter, so dxT is non-zero
  const item = sequenceDrawPlan(stage.layers, t, 4000, PLAN_ENV)[0] as PlanItem;
  const timing = readTiming(layer.el);
  const tr = transitionAt(timing, t, 4000)!;
  const off = recTransition(tr.kind, tr.p, 640, 360, tr.ease);
  const pose = evaluateKf(layer.kf, t);
  assert.ok(off.dx !== 0, 'the transition really is mid-flight');
  assert.ok((pose.x ?? 0) !== 0, 'the keyframe really does offset');
  // The engine's own answer, with BOTH offsets inside the projection.
  const view = planCameraView(PLAN_ENV, t);
  const proj = projectLayer(view, {
    bx: 200 + 320, by: 100 + 180, dxT: off.dx, dyT: off.dy, dxK: pose.x ?? 0, dyK: pose.y ?? 0, z: 220,
  });
  assert.equal(item.dx, proj.dx);
  assert.equal(item.dy, proj.dy);
  assert.equal(item.scale, off.sc * proj.scale, 'eff multiplies the transition scale');
  assert.equal(item.resolvedZ, 220);
  // …and it is emphatically NOT the naive sum.
  assert.notEqual(n3(item.dx), n3(off.dx + (pose.x ?? 0)));
  assert.ok(proj.scale > 1.2, 'a 220px lift at P = 1200 is a real magnification');
});

test('section 4.1 FOLD: the same scene FLAT is exactly the naive sum - the fold is not a no-op', () => {
  // The companion. Same box, same transition, same track, z = 0: now the projection
  // is an identity and the two readings coincide, which is what proves the previous
  // test was measuring the projection rather than an arithmetic slip.
  const time = 'data-t-start="0" data-t-dur="2000" data-t-enter="slide-left" data-t-enter-ms="800"'
    + ' data-t-kf="t0_x-120*t2000_el_x40"';
  const node = depthStage(depthBox({ time }));
  const stage = parseSequenceStage(node)!;
  const layer = stage.layers[0] as SeqLayer;
  const t = 300;
  const item = sequenceDrawPlan(stage.layers, t, 4000, PLAN_ENV)[0] as PlanItem;
  const tr = transitionAt(readTiming(layer.el), t, 4000)!;
  const off = recTransition(tr.kind, tr.p, 640, 360, tr.ease);
  const pose = evaluateKf(layer.kf, t);
  assert.equal(item.dx, off.dx + (pose.x as number));
  assert.equal(item.scale, off.sc, 'eff is exactly 1 on the flat board');
  assert.equal(item.resolvedZ, 0);
});

test('section 5.2 CHANNELS: s multiplies, r adds, o multiplies, b adds over the authored blur, z replaces the field', () => {
  const time = 'data-t-start="0" data-t-dur="2000" data-t-z="60"'
    + ' data-t-kf="t0_eh_s1.5_r30_o0.5_b3_z-40*t2000_s1.5_r30_o0.5_b3_z-40"';
  const node = depthStage(depthBox({
    style: 'transform:rotate(-6deg);opacity:0.8;filter:blur(2px);', time,
  }));
  const stage = parseSequenceStage(node)!;
  const item = sequenceDrawPlan(stage.layers, 500, 4000, PLAN_ENV)[0] as PlanItem;
  const view = planCameraView(PLAN_ENV, 500);
  const eff = projectLayer(view, { bx: 520, by: 280, z: -40 }).scale;
  assert.equal(item.resolvedZ, -40, 'a keyed z REPLACES the box\'s own field');
  assert.equal(item.scale, 1.5 * eff);
  assert.equal(item.rot, -6 + 30);
  assert.ok(Math.abs(item.alpha - 0.8 * 0.5) < 1e-12);
  assert.equal(item.blur, 2 + 3, 'b is additive over the authored blur');
});

// ── section 4.2: paint order is depth order ───────────────────────────────────────

test('section 4.2 Z-ORDER: crossing z curves swap the paint order, and tie on DOM order', () => {
  const a = depthBox({ left: 0, time: 'data-t-start="0" data-t-dur="4000" data-t-kf="t0_el_z0*t1000_el_z200"' });
  const b = depthBox({ left: 700, time: 'data-t-start="0" data-t-dur="4000" data-t-kf="t0_el_z200*t1000_el_z0"' });
  const stage = parseSequenceStage(depthStage(a + b))!;
  const order = (t: number): number[] =>
    sequenceDrawPlan(stage.layers, t, 4000, PLAN_ENV).map((i) => i.layer.idx);
  assert.deepEqual(order(0), [0, 1], 'A at z 0 paints under B at z 200');
  assert.deepEqual(order(1000), [1, 0], 'the curves crossed - so does the paint order');
  // Exactly at the crossing both resolve to 100; the stable sort keeps DOM order.
  const mid = sequenceDrawPlan(stage.layers, 500, 4000, PLAN_ENV);
  assert.equal(mid[0]!.resolvedZ, mid[1]!.resolvedZ);
  assert.deepEqual(mid.map((i) => i.layer.idx), [0, 1]);
});

test('section 4.2 Z-ORDER: an unlifted stage is not re-ordered at all', () => {
  const a = depthBox({ time: 'data-t-start="0" data-t-dur="4000" data-t-kf="t0_x0*t1000_x80"' });
  const b = depthBox({ left: 700, time: 'data-t-start="0" data-t-dur="4000"' });
  const stage = parseSequenceStage(depthStage(a + b))!;
  for (const t of [0, 500, 1000, 3000]) {
    assert.deepEqual(sequenceDrawPlan(stage.layers, t, 4000, PLAN_ENV).map((i) => i.layer.idx), [0, 1], `t=${t}`);
  }
});

test('section 4.2 Z-ORDER: the DOM expresses the same order as z-index, and only when lifted', () => {
  const a = depthBox({ left: 0, time: 'data-t-start="0" data-t-dur="4000" data-t-kf="t0_el_z0*t1000_el_z200"' });
  const b = depthBox({ left: 700, time: 'data-t-start="0" data-t-dur="4000" data-t-kf="t0_el_z200*t1000_el_z0"' });
  const node = depthStage(a + b);
  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(4000);
  applyTimeToElements(els, 0, ctx);
  assert.deepEqual(els.map((e) => e.style.zIndex), ['1', '2'], 'A (z 0) under B (z 200)');
  applyTimeToElements(els, 1000, ctx);
  assert.deepEqual(els.map((e) => e.style.zIndex), ['2', '1'], 'the order swapped with the curves');
  // Restoring hands the authored `auto` back - the write is reversible like every other.
  ctx.store.restoreAll();
  assert.deepEqual(els.map((e) => e.style.zIndex), ['', '']);
});

test('section 4.2 Z-ORDER: the DOM ranks the SAME SET the planner sorts - flat boxes included', () => {
  // THE COUNTER-EXAMPLE THAT FORCED THIS. In CSS a positioned box with an integer
  // `z-index` paints in a HIGHER stacking level than every `auto` sibling, so ranking
  // only the boxes the fold touched means "everything lifted floats above everything
  // flat" - which is the opposite of a depth sort the moment a box is SUNKEN. A flat
  // box (DOM idx 0) and a `z: -200` one (idx 1): the planner paints the sunken one
  // FIRST, and a projecting-only rank painted it last.
  const flat = depthBox({ left: 0, time: 'data-t-start="0" data-t-dur="4000"' });
  const sunk = depthBox({ left: 700, time: 'data-t-start="0" data-t-dur="4000" data-t-z="-200"' });
  const node = depthStage(flat + sunk);
  const stage = parseSequenceStage(node)!;
  const plan = sequenceDrawPlan(stage.layers, 0, 4000, PLAN_ENV);
  assert.deepEqual(plan.map((i) => i.layer.idx), [1, 0], 'the planner paints the SUNKEN box first');
  assert.deepEqual(plan.map((i) => i.resolvedZ), [-200, 0]);

  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(4000);
  applyTimeToElements(els, 0, ctx);
  // The rank IS the plan's order: rank 1 paints lowest, and the plan's first item is
  // the lowest. Read the DOM back as an order and compare the two directly, so this
  // cannot pass on a coincidence of numbers.
  const byRank = els
    .map((e, i) => ({ i, z: parseInt(e.style.zIndex || '0', 10) }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((r) => r.i);
  assert.deepEqual(byRank, plan.map((i) => i.layer.idx), 'DOM paint order === plan paint order');
  assert.deepEqual(els.map((e) => e.style.zIndex), ['2', '1'],
    'and the flat box is RANKED, not left on `auto` above everything');

  // Three boxes, flat / sunken / flat - the case where a subset rank re-orders two
  // boxes that never authored anything at all.
  const three = depthStage(
    depthBox({ left: 0, time: 'data-t-start="0" data-t-dur="4000"' })
    + depthBox({ left: 700, time: 'data-t-start="0" data-t-dur="4000" data-t-z="-100"' })
    + depthBox({ left: 1300, time: 'data-t-start="0" data-t-dur="4000"' }),
  );
  const plan3 = sequenceDrawPlan(parseSequenceStage(three)!.layers, 0, 4000, PLAN_ENV);
  const els3 = [...three.querySelectorAll<HTMLElement>('.lolly-box')];
  applyTimeToElements(els3, 0, applyCtx(4000));
  const byRank3 = els3
    .map((e, i) => ({ i, z: parseInt(e.style.zIndex || '0', 10) }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((r) => r.i);
  assert.deepEqual(byRank3, plan3.map((i) => i.layer.idx));
});

test('section 4.2 Z-ORDER: a foreign writer owns the slot - a dragged box keeps its hoist', () => {
  // free-canvas hoists the box under a gesture to `z-index: 9999` straight on the
  // element, with no model write and no repaint. The rank pass must not fight it: the
  // inline value is not the one we last wrote, so the slot is not ours to move.
  const a = depthBox({ left: 0, time: 'data-t-start="0" data-t-dur="4000" data-t-z="100"' });
  const b = depthBox({ left: 700, time: 'data-t-start="0" data-t-dur="4000" data-t-z="-100"' });
  const node = depthStage(a + b);
  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(4000);
  applyTimeToElements(els, 0, ctx);
  assert.deepEqual(els.map((e) => e.style.zIndex), ['2', '1']);
  els[0]!.style.zIndex = '9999';                   // the gesture takes the slot
  applyTimeToElements(els, 100, ctx);
  assert.equal(els[0]!.style.zIndex, '9999', 'the hoist survives the next frame');
  assert.equal(els[1]!.style.zIndex, '1', 'and every other box is still ranked');
});

test('the projection anchor follows a LIVE gesture, not the pre-drag centre', () => {
  // `applyLiveRect` moves a box during a drag by writing `left`/`top` onto the element
  // - no model write, no repaint. `left`/`top` are never part of the composed surface,
  // so the inline value is always the authored one and must be re-read every frame.
  const node = depthStage(depthBox({ left: 200, time: 'data-t-start="0" data-t-dur="4000" data-t-z="300"' }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const ctx = applyCtx(4000);
  applyTimeToElements([el], 0, ctx);
  const before = written(el).dx;
  el.style.left = '900px';                          // the gesture drags it
  applyTimeToElements([el], 0, ctx);
  const after = written(el).dx;
  assert.notEqual(after, before, 'the parallax offset moved with the pointer');
  // …and it is exactly the offset the planner computes for the box where it now is.
  const stage = parseSequenceStage(node)!;
  const item = sequenceDrawPlan(stage.layers, 0, 4000, PLAN_ENV)[0] as PlanItem;
  assert.equal(after, n3(item.dx));
});

test('section 4.2 Z-ORDER: a track that never lifts anything grows no z-index', () => {
  const node = depthStage(depthBox({ time: 'data-t-start="0" data-t-dur="4000" data-t-kf="t0_x0_o1*t1000_x80_o0.4"' }));
  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(4000);
  for (const t of [0, 500, 1000]) applyTimeToElements(els, t, ctx);
  assert.equal(els[0]!.style.zIndex, '');
  assert.ok(els[0]!.style.transform.includes('translate'), 'the track really is moving it');
});

// ── section 5.4: the exclusions ───────────────────────────────────────────────────

test('section 5.4 EXCLUSIONS: an audio bed carrying z and kf is still never posed', () => {
  const html = depthBox({
    time: 'data-t-start="0" data-t-dur="2000" data-t-z="300" data-t-kf="t0_x-200_z300*t2000_x200"',
    inner: '<div class="lolly-box-audio" data-audio-src="x.mp3"></div>',
  });
  const node = depthStage(html);
  const stage = parseSequenceStage(node)!;
  assert.equal(stage.layers[0]!.kind, 'audio');
  const item = sequenceDrawPlan(stage.layers, 500, 4000, PLAN_ENV)[0] as PlanItem;
  assert.equal(item.dx, 0);
  assert.equal(item.dy, 0);
  assert.equal(item.scale, 1);
  assert.equal(item.resolvedZ, 0, 'excluded from the depth sort as well as the pose');
  const el = node.querySelector('.lolly-box') as HTMLElement;
  applyTimeToElements([el], 500, applyCtx(4000));
  assert.equal(el.style.transform, '', 'no transform');
  assert.equal(el.style.filter, '', 'no filter');
  assert.equal(el.style.zIndex, '', 'no z-index');
});

test('section 5.4 EXCLUSIONS: a camera marker is its own kind, contributes no pose and no source', () => {
  const html = depthBox({
    time: 'data-t-start="0" data-t-dur="2000" data-t-z="200" data-t-kf="t0_x-200_z200*t2000_x200"',
    inner: '<div class="lolly-box-cam" data-cam="1" data-export-hide aria-hidden="true"></div>',
  });
  const node = depthStage(html);
  const el = node.querySelector('.lolly-box') as HTMLElement;
  assert.equal(layerKind(el), 'camera');
  const stage = parseSequenceStage(node)!;
  const item = sequenceDrawPlan(stage.layers, 500, 4000, PLAN_ENV)[0] as PlanItem;
  assert.equal(item.sourceSec, null, 'a camera is a pose over time, not a source');
  assert.equal(item.dx, 0);
  assert.equal(item.scale, 1);
  assert.equal(item.resolvedZ, 0);
  // …and nothing to decode: a camera must never open a provider.
  assert.deepEqual(activeFrameWindow(stage.layers[0] as SeqLayer, [0, 250, 500, 750]).span, []);
  applyTimeToElements([el], 500, applyCtx(4000));
  assert.equal(el.style.transform, '');
  assert.equal(el.style.filter, '');
  assert.equal(el.style.zIndex, '');
});

test('section 5.4 EXCLUSIONS: a frame page is out of scope for the projection, transitions and all', () => {
  const wrap = doc.createElement('div');
  wrap.innerHTML = '<div class="artboard" data-sequence data-seq-ms="4000" style="width:1080px;height:1080px;">'
    + '<div class="lolly-box" data-pdf-page data-t-start="0" data-t-dur="2000" data-t-z="240"'
    + ' data-t-kf="t0_x-200_z240*t2000_x200" data-t-enter="fade" data-t-enter-ms="400"'
    + ' style="left:0px;top:0px;width:1080px;height:1080px;"></div></div>';
  const stage = parseSequenceStage(wrap)!;
  assert.equal(stage.layers[0]!.frameScene, true);
  const item = sequenceDrawPlan(stage.layers, 800, 4000, PLAN_ENV)[0] as PlanItem;
  assert.equal(item.dx, 0, 'the kf x never reaches a frame page');
  assert.equal(item.scale, 1, 'nor does the lift');
  assert.equal(item.resolvedZ, 0);
  const el = wrap.querySelector('.lolly-box') as HTMLElement;
  const ctx = applyCtx(4000);
  applyTimeToElements([el], 200, ctx);           // mid-fade: the transition still applies
  assert.ok(Number(el.style.opacity) < 1, 'a frame page keeps its ordinary transitions');
  assert.equal(el.style.transform, '', 'but is never posed');
  assert.equal(el.style.zIndex, '');
});

test('section 5.4 EXCLUSIONS: a FRAMES document is out of depth scope whole - in both evaluators', () => {
  // Not only its pages. A frames-as-scenes slideshow lays its slides side by side on
  // the pasteboard, so the exporter sizes its output to the FIRST TIMED FRAME's box
  // while the applier measures the artboard - two different W's, and the projection's
  // principal point is W/2. Both readers therefore refuse the whole document rather
  // than one of them guessing the other's number (section 5.4: "camera + kf apply only to
  // boxes on a [data-sequence] stage; frame pages are excluded").
  const wrap = doc.createElement('div');
  wrap.innerHTML = '<div class="artboard" data-sequence data-seq-ms="4000" style="width:3240px;height:1080px;">'
    + '<div class="lolly-box" data-pdf-page data-t-start="0" data-t-dur="2000"'
    + ' style="left:0px;top:0px;width:1080px;height:1080px;"></div>'
    + '<div class="lolly-box" data-t-start="0" data-t-dur="4000" data-t-z="240"'
    + ' data-t-kf="t0_x0*t2000_x120" style="left:100px;top:100px;width:400px;height:300px;"></div>'
    + '</div>';
  // The planner never even SEES the ordinary box: on a frames document the scene
  // layers ARE the pages, and a `.lolly-box` belongs to the frame's own picture.
  const stage = parseSequenceStage(wrap)!;
  assert.deepEqual(stage.layers.map((l) => l.frameScene), [true],
    'the frame page is the only layer the exporter draws');
  // Which is exactly why the DOM applier - whose element list is every `[data-t-start]`
  // on the stage, boxes included - must not pose that box either. Posed in the preview
  // and baked flat into the frame's plate is the divergence this gate closes.
  const els = [...wrap.querySelectorAll<HTMLElement>('.lolly-box')];
  applyTimeToElements(els, 1000, applyCtx(4000));
  assert.equal(els[1]!.style.transform, '', 'the box on a frames stage is never posed');
  assert.equal(els[1]!.style.zIndex, '');
  assert.equal(els[1]!.style.filter, '');
});

// ── section 4.4: depth of field is a SCREEN-space number ──────────────────────────

test('section 4.4 DOF: the blur the viewer sees is the engine\'s number - not eff² of it', () => {
  // `dofBlur` already carries `eff(z)·eff(f)` and is defined as "px at stage-native
  // scale", i.e. what the viewer sees. But BOTH executors apply `PlanItem.blur` in the
  // LAYER's own space and then magnify by `item.scale` - the canvas blurs a
  // plate-resolution scratch and draws it under `ctx.scale(item.scale)`; CSS applies
  // `filter` before `transform`. So the DOF term has to be divided by the projection's
  // own eff on the way in, or it lands squared (up to 100× at the guard).
  const cams = [{ base: { a: 0.6, f: 0, p: 1200, z: 0 } }];
  const env: SeqPlanEnv = { ...PLAN_ENV, cameras: cams };
  const node = depthStage(depthBox({ left: 200, time: 'data-t-start="0" data-t-dur="4000" data-t-z="400"' }));
  const stage = parseSequenceStage(node)!;
  const item = sequenceDrawPlan(stage.layers, 0, 4000, env)[0] as PlanItem;
  const eff = projectLayer(planCameraView(env, 0), { bx: 0, by: 0, z: 400 }).scale;
  assert.ok(eff > 1.4, `the fixture really is magnified (eff ${eff})`);
  const want = dofBlur({ a: 0.6, f: 0, p: 1200, z: 0 }, 400);
  assert.ok(want > 0, 'and really is out of focus');
  // The number a viewer measures is `PlanItem.blur × item.scale` (both executors), and
  // it must equal the engine's screen-space figure.
  assert.ok(Math.abs(item.blur * item.scale - want) < 1e-9,
    `screen blur ${item.blur * item.scale} should be ${want}`);
  assert.ok(Math.abs(item.blur - want) > 1e-6, 'which is NOT the raw term (the vacuity guard)');
  // The authored blur is a layer-space number and keeps its eff magnification - that
  // is what a CSS `filter: blur()` under a `transform: scale()` has always done.
  const withAuthored = sequenceDrawPlan(
    parseSequenceStage(depthStage(depthBox({
      left: 200, style: 'filter:blur(4px);',
      time: 'data-t-start="0" data-t-dur="4000" data-t-z="400"',
    })))!.layers, 0, 4000, env,
  )[0] as PlanItem;
  assert.ok(Math.abs(withAuthored.blur - (item.blur + 4)) < 1e-9,
    'the authored term is added raw; only the DOF term is un-scaled');
});

// ── section 5.5: the planner owns the blur ────────────────────────────────────────

test('section 5.5 BLUR: the DOM rewrites only the blur term, keeps the shadow, and restores both', () => {
  const node = depthStage(depthBox({
    style: 'filter:blur(2px) drop-shadow(0px 21px 46px #00000055);',
    time: 'data-t-start="0" data-t-dur="2000" data-t-z="140" data-t-kf="t0_eh_b6*t2000_b6"',
  }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  // The stage is parsed BEFORE the applier touches it, and that ordering is the
  // point: `readLayer` reads the authored blur off the LIVE element, so parsing a
  // stage the playhead has already posed would read a composed filter as if it were
  // authored and blur it twice (2 + 6 → 8, then 8 + 6 → 14). That is the export-time
  // read/restore seam plan section 6 point 0 exists to close - pinned here so a future edit
  // that removes the restore trips a test rather than shipping a soft picture.
  const stage = parseSequenceStage(node)!;
  const ctx = applyCtx(4000);
  applyTimeToElements([el], 500, ctx);
  assert.equal(el.style.filter, 'blur(8px) drop-shadow(0px 21px 46px #00000055)',
    'authored 2 + keyframed 6, blur first so the shadow follows the blurred silhouette');
  // The planner reached the same total.
  assert.equal((sequenceDrawPlan(stage.layers, 500, 4000, PLAN_ENV)[0] as PlanItem).blur, 8);
  assert.equal(parseSequenceStage(node)!.layers[0]!.blur, 8,
    'and a re-parse of the POSED stage reads 8 as authored - the seam, demonstrated');
  ctx.store.restoreAll();
  assert.equal(el.style.filter, 'blur(2px) drop-shadow(0px 21px 46px #00000055)');
});

// ── the essential one: DOM writes == plan numbers, with kf active ────────

test('PARITY: with keyframes and a lift active, the applier writes exactly what the planner planned', () => {
  const cases: { name: string; style: string; time: string }[] = [
    {
      name: 'lifted + full pose + a transition',
      style: 'transform:rotate(-6deg);opacity:0.9;filter:blur(2px);',
      time: 'data-t-start="200" data-t-dur="3000" data-t-enter="slide" data-t-enter-ms="700"'
        + ' data-t-exit="rise" data-t-exit-ms="500" data-t-z="180"'
        + ' data-t-kf="t0_x-120_y40_s0.8_r-12_o0.4_b0*t1200_eo_x60_y-30_s1.15_r18_o1_b5*t2600_ei_x0_y0_s1_r0_o0.6_b0"',
    },
    {
      name: 'sunken, sparse channels, a hold and a custom bezier',
      style: 'opacity:0.75;',
      time: 'data-t-start="0" data-t-dur="3000" data-t-z="-220"'
        + ' data-t-kf="t0_eh_x-80*t900_eb(0.32)(0)(0.67)(1)_x0_z-40*t2400_x120_o0.3"',
    },
    {
      name: 'a z curve that crosses the surface',
      style: 'transform:rotate(11deg);',
      time: 'data-t-start="0" data-t-dur="3000" data-t-z="0"'
        + ' data-t-kf="t0_ev_z-300_s1*t1500_ea_z300_s1.4*t3000_el_z0_s1"',
    },
  ];
  for (const c of cases) {
    const node = depthStage(depthBox({ style: c.style, time: c.time }));
    const el = node.querySelector('.lolly-box') as HTMLElement;
    const stage = parseSequenceStage(node)!;
    const ctx = applyCtx(4000);
    let posed = 0;
    for (let t = 0; t < 3400; t += 17) {
      const item = sequenceDrawPlan(stage.layers, t, 4000, PLAN_ENV)[0];
      applyTimeToElements([el], t, ctx);
      if (!item) {
        assert.equal(el.classList.contains('seq-off'), true, `${c.name}: off screen at ${t}`);
        continue;
      }
      posed++;
      const w = written(el);
      const authoredRot = stage.layers[0]!.rect.rot;
      assert.equal(w.dx, n3(item.dx), `${c.name}: dx at ${t}`);
      assert.equal(w.dy, n3(item.dy), `${c.name}: dy at ${t}`);
      assert.equal(w.sc, n3(item.scale), `${c.name}: scale at ${t}`);
      assert.equal(w.rot, n3(item.rot - authoredRot) + authoredRot, `${c.name}: rot at ${t}`);
      assert.equal(w.alpha, n4(item.alpha), `${c.name}: alpha at ${t}`);
      const total = Math.round(item.blur * 1000) / 1000;
      const wantFilter = total === stage.layers[0]!.blur
        ? (stage.layers[0]!.blur ? `blur(${stage.layers[0]!.blur}px)` : '')
        : (total > 0 ? `blur(${total}px)` : '');
      assert.equal(el.style.filter, wantFilter, `${c.name}: filter at ${t}`);
    }
    assert.ok(posed > 100, `${c.name}: the sweep actually posed the box`);
  }
});

test('PARITY: and the keyframe track is not a no-op in either evaluator', () => {
  // The vacuity guard, the shape the ease sweep above it already uses: if `kf` never
  // reached the fold at all, every assertion in the parity sweep would hold trivially.
  const time = 'data-t-start="0" data-t-dur="3000" data-t-z="180"';
  const bare = depthStage(depthBox({ time }));
  const keyed = depthStage(depthBox({ time: `${time} data-t-kf="t0_x-90_s0.7*t3000_el_x90_s1.3"` }));
  const at = (node: HTMLElement): { plan: PlanItem; dom: ReturnType<typeof written> } => {
    const el = node.querySelector('.lolly-box') as HTMLElement;
    const stage = parseSequenceStage(node)!;
    applyTimeToElements([el], 1000, applyCtx(4000));
    return { plan: sequenceDrawPlan(stage.layers, 1000, 4000, PLAN_ENV)[0] as PlanItem, dom: written(el) };
  };
  const a = at(bare);
  const b = at(keyed);
  assert.notEqual(n3(a.plan.dx), n3(b.plan.dx), 'the track really did move the planner');
  assert.notEqual(a.dom.dx, b.dom.dx, 'and the applier');
  assert.notEqual(n3(a.plan.scale), n3(b.plan.scale));
  // The lift itself is not a no-op either - eff is a real magnification at 180px.
  assert.ok(a.plan.scale > 1.15, 'a 180px lift magnifies');
  assert.ok(a.plan.scale < KF_EFF_MAX);
});

test('PARITY: the behind-camera guard ramps the same alpha on both sides', () => {
  // z past 0.8P is the guard band (section 4.5): eff freezes, alpha ramps to 0. The wire
  // clamp is wide enough for a camera dolly, so a hand-edited URL can reach it.
  const node = depthStage(depthBox({ time: 'data-t-start="0" data-t-dur="3000" data-t-kf="t0_el_z900*t3000_el_z1180"' }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const stage = parseSequenceStage(node)!;
  const ctx = applyCtx(4000);
  let sawRamp = false;
  for (let t = 0; t < 3000; t += 25) {
    const item = sequenceDrawPlan(stage.layers, t, 4000, PLAN_ENV)[0] as PlanItem;
    applyTimeToElements([el], t, ctx);
    assert.equal(written(el).alpha, n4(item.alpha), `alpha at ${t}`);
    assert.ok(item.scale <= KF_EFF_MAX, `eff is held at the clamp at ${t}`);
    if (item.alpha > 0 && item.alpha < 1) sawRamp = true;
  }
  assert.ok(sawRamp, 'the sweep really did cross the guard band');
});

test('section 4.2 Z-ORDER: a z curve returning to the board takes its z-index with it', () => {
  // The stale-rank case. Ranks are written while the layers are lifted; once every
  // curve is back at 0 the paint order is DOM order again, and a frozen rank from the
  // lifted part of the move would quietly keep the wrong one.
  const a = depthBox({ left: 0, time: 'data-t-start="0" data-t-dur="4000" data-t-kf="t0_el_z0*t1000_el_z200*t2000_el_z0"' });
  const b = depthBox({ left: 700, time: 'data-t-start="0" data-t-dur="4000" data-t-kf="t0_el_z200*t1000_el_z0*t2000_el_z0"' });
  const node = depthStage(a + b);
  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(4000);
  applyTimeToElements(els, 0, ctx);
  assert.deepEqual(els.map((e) => e.style.zIndex), ['1', '2']);
  applyTimeToElements(els, 2000, ctx);
  assert.deepEqual(els.map((e) => e.style.zIndex), ['', ''], 'flat again → auto again');
  // …and the plan agrees: nothing lifted, nothing re-ordered.
  const stage = parseSequenceStage(node)!;
  assert.deepEqual(sequenceDrawPlan(stage.layers, 2000, 4000, PLAN_ENV).map((i) => i.layer.idx), [0, 1]);
});

// ── section 6 POINT 0: the export-time read/restore seam ──────────────────────────
//
// `renderSequence` parses and photographs the LIVE artboard, and the preview clock has
// been writing on it. Every geometry read `readLayer` takes is an AUTHORED read - the
// rotation off `style.transform`, the opacity off `style.opacity`, the blur off
// `style.filter` - so with the playhead parked mid-keyframe those reads come back
// pre-posed, and the export then poses them again. The playhead can be parked anywhere
// when an export starts; that is what makes this the seam and not an edge case.

/** A box carrying no authored transform, so a composed `rotate()` IS the first one. */
const SEAM_TIME = 'data-t-start="0" data-t-dur="3000" data-t-z="180"'
  + ' data-t-kf="t0_x-120_y40_s0.8_r-12_o0.5_b0*t3000_el_x120_y-40_s1.2_r18_o1_b6"';
const SEAM_STYLE = 'opacity:0.9;filter:blur(2px) drop-shadow(0px 2px 10px #00000055);';

test('section 6 POINT 0: a parse of a POSED stage reads the applier\'s composition as authored', () => {
  // The defect, stated as a test so the fix below has something to be the fix OF.
  const pristine = parseSequenceStage(depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME })))!.layers[0]!;
  const node = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const session = createSequenceTime(node);
  session.apply(1500);
  const naive = parseSequenceStage(node)!.layers[0]!;
  assert.notEqual(naive.rect.rot, pristine.rect.rot, 'the keyframed rotation read as the authored one');
  assert.notEqual(naive.opacity, pristine.opacity, 'the composed alpha read as the authored opacity');
  assert.notEqual(naive.blur, pristine.blur, 'the composed blur read as the authored blur');
  session.restore();
});

test('section 6 POINT 0: withAuthoredDom hands an export the authored stage, mid-keyframe or not', async () => {
  const pristine = parseSequenceStage(depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME })))!.layers[0]!;
  const node = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const session = createSequenceTime(node);
  // Parked ANYWHERE - the sweep is the test. Every one of these is a frame the user
  // could have left the playhead on when they pressed Export.
  for (const t of [0, 240, 750, 1500, 2100, 2999]) {
    session.apply(t);
    const posed = { transform: el.style.transform, opacity: el.style.opacity, filter: el.style.filter };
    const seen = await withAuthoredDom(node, () => parseSequenceStage(node)!.layers[0]!);
    assert.equal(seen.rect.rot, pristine.rect.rot, `rot at ${t}`);
    assert.equal(seen.rect.x, pristine.rect.x, `x at ${t}`);
    assert.equal(seen.rect.y, pristine.rect.y, `y at ${t}`);
    assert.equal(seen.opacity, pristine.opacity, `opacity at ${t}`);
    assert.equal(seen.blur, pristine.blur, `blur at ${t}`);
    assert.equal(seen.shadowFilter, pristine.shadowFilter, `shadow at ${t}`);
    // …and the editor is handed back the frame it was showing, not frame 0.
    assert.equal(el.style.transform, posed.transform, `transform restored at ${t}`);
    assert.equal(el.style.opacity, posed.opacity, `opacity restored at ${t}`);
    assert.equal(el.style.filter, posed.filter, `filter restored at ${t}`);
  }
  session.restore();
});

test('section 6 POINT 0: the writer stays stood down for the WHOLE scope, not just the parse', async () => {
  // A plate capture is a sequence of awaits. An rAF tick landing between two of them
  // would re-pose the stage half way through the shoot, and the export would ship two
  // layers photographed at different playhead positions.
  const node = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const session = createSequenceTime(node);
  session.apply(1500);
  let inside: { transform: string; filter: string } | null = null;
  await withAuthoredDom(node, async () => {
    session.apply(2400);                       // the tick that used to land mid-shoot
    await Promise.resolve();
    session.apply(600);
    inside = { transform: el.style.transform, filter: el.style.filter };
  });
  assert.deepEqual(inside, { transform: '', filter: 'blur(2px) drop-shadow(0px 2px 10px #00000055)' },
    'nothing the clock asked for reached the DOM while the scope was held');
  // On the way out it re-asserts the LATEST time it was asked for, not the one it was
  // suspended at - a clock that kept running catches up rather than jumping back.
  const at600 = el.style.transform;
  session.apply(600);
  assert.equal(el.style.transform, at600, 'resumed at t=600, the last frame requested');
  session.restore();
});

test('section 6 POINT 0: nested scopes compose, and a throw still restores', async () => {
  const node = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const session = createSequenceTime(node);
  session.apply(1500);
  const posed = el.style.opacity;
  await withAuthoredDom(node, async () => {
    await withAuthoredDom(node, async () => {
      assert.equal(el.style.opacity, '0.9', 'authored, two scopes deep');
    });
    assert.equal(el.style.opacity, '0.9', 'the OUTER scope still holds it down');
  });
  assert.equal(el.style.opacity, posed);
  await assert.rejects(withAuthoredDom(node, () => { throw new Error('export failed'); }), /export failed/);
  assert.equal(el.style.opacity, posed, 'a failed export leaves the editor where the user left it');
  session.restore();
});

test('section 6 POINT 0: a CONTACT SHEET opens its own session on an authored stage', async () => {
  // `renderSequenceCuts` creates a second `createSequenceTime` on the SAME root the
  // preview clock is posing, and `AuthoredStore.get()` captures whatever is on the
  // element at first touch. Without the scope, every one of the N stills carries the
  // frame the user happened to be parked on, baked in - the module's own "cut 2 would
  // re-capture what cut 1 wrote" comment, one level up.
  const node = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const clock = createSequenceTime(node);
  clock.apply(1500);                                // the playhead, parked mid-keyframe
  const parked = el.style.transform;
  assert.ok(parked.includes('translate'), 'the clock really has posed it');

  // What renderSequenceCuts does, in the order it does it.
  const shots: string[] = [];
  await withAuthoredDom(node, () => {
    const session = createSequenceTime(node);
    try {
      for (const t of [500, 1500, 2500]) { session.apply(t); shots.push(el.style.transform); }
    } finally { session.restore(); }
  });
  // The reference: the same three cuts taken on a stage nobody ever played.
  const clean = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const cleanEl = clean.querySelector('.lolly-box') as HTMLElement;
  const ref = createSequenceTime(clean);
  const want: string[] = [];
  for (const t of [500, 1500, 2500]) { ref.apply(t); want.push(cleanEl.style.transform); }
  ref.restore();
  assert.deepEqual(shots, want, 'each cut is the frame it asks for, not that frame ON the parked one');
  assert.equal(el.style.transform, parked, 'and the editor is handed its playhead back');
  clock.restore();
});

test('section 6 POINT 0: a LIVE TAKE holds the scope from start to stop', async () => {
  // `driveSequenceTime` (renderLive) is the same shape with no `fn` to wrap: its
  // authored window opens at start() and closes at stop(), because a clock tick landing
  // between two of its frames would re-pose the stage mid-recording.
  const { driveSequenceTime } = await import('../shells/web/src/bridge/sequence-dom.ts');
  const node = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const clock = createSequenceTime(node);
  clock.apply(1500);
  const parked = el.style.transform;

  let now = 0;
  const pending: (() => void)[] = [];
  const drive = driveSequenceTime(node, {
    durationMs: 3000,
    fps: 2,
    now: () => now,
    schedule: (fn) => { pending.push(fn); return () => { /* never cancelled here */ }; },
  });
  drive.start();
  const first = el.style.transform;
  clock.apply(2400);                                // the tick that used to land mid-take
  assert.equal(el.style.transform, first, 'the preview clock cannot reach the stage during a take');
  now = 500;
  pending.shift()?.();
  const half = el.style.transform;
  drive.stop();

  // Every frame of the take is the frame a never-played stage would have produced…
  const clean = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const cleanEl = clean.querySelector('.lolly-box') as HTMLElement;
  const ref = createSequenceTime(clean);
  ref.apply(0);
  assert.equal(first, cleanEl.style.transform, 't=0 of the take');
  ref.apply(500);
  assert.equal(half, cleanEl.style.transform, 't=500 of the take');
  assert.notEqual(half, parked, 'and the take really moved off where the playhead was');
  // …and on stop the editor is handed back the LATEST frame its clock asked for, the
  // same catch-up `withAuthoredDom` gives an export.
  ref.apply(2400);
  assert.equal(el.style.transform, cleanEl.style.transform, 'the preview resumes at t=2400');
  ref.restore();
  clock.restore();
});

test('section 6 POINT 0 FLOOR: a document with no live writer takes the identical path', async () => {
  // No clock, no session - a CLI render, a headless test, an export of a stage nobody
  // ever played. The scope must be transparent, down to the parse being the same one.
  const node = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const before = el.getAttribute('style');
  const direct = parseSequenceStage(node)!.layers[0]!;
  const scoped = await withAuthoredDom(node, () => parseSequenceStage(node)!.layers[0]!);
  assert.equal(scoped.rect.rot, direct.rect.rot);
  assert.equal(scoped.opacity, direct.opacity);
  assert.equal(scoped.blur, direct.blur);
  assert.equal(el.getAttribute('style'), before, 'not one declaration rewritten');
  assert.equal(authoredStyleOf(el), null, 'and nothing claims to be composing over it');
});

test('section 6 POINT 0 FLOOR: a clean document parses the same posed or not', async () => {
  // The byte-identity floor for the seam itself: no z, no kf, no transition running.
  // The applier writes nothing, so the scope has nothing to hand back and the parse is
  // the parse it always was.
  const html = depthBox({
    style: 'transform:rotate(-6deg);opacity:0.9;filter:blur(4px);',
    time: 'data-t-start="0" data-t-dur="3000"',
  });
  const pristine = parseSequenceStage(depthStage(html))!.layers[0]!;
  const node = depthStage(html);
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const before = el.getAttribute('style');
  const session = createSequenceTime(node);
  session.apply(1500);
  assert.equal(el.getAttribute('style'), before, 'a clean document is never written to at all');
  const seen = await withAuthoredDom(node, () => parseSequenceStage(node)!.layers[0]!);
  assert.equal(seen.rect.rot, pristine.rect.rot);
  assert.equal(seen.opacity, pristine.opacity);
  assert.equal(seen.blur, pristine.blur);
  assert.equal(el.getAttribute('style'), before);
  session.restore();
});

test('section 6.5: a thumbnail sees the authored pose, mid-keyframe exactly as at rest', () => {
  // `authoredStyleOf` is what clip-thumbs photographs through (it cannot import this
  // module - see the seam note there). At rest it answers null and the shot changes
  // nothing; mid-keyframe it answers the SAME authored values, which is the whole of
  // "a shot mid-keyframe equals a shot at rest".
  const node = depthStage(depthBox({ style: SEAM_STYLE, time: SEAM_TIME }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const session = createSequenceTime(node);
  assert.equal(authoredStyleOf(el), null, 'nothing composed yet: nothing to neutralise');
  const poses: string[] = [];
  for (const t of [0, 900, 1500, 2600]) {
    session.apply(t);
    const authored = authoredStyleOf(el);
    assert.ok(authored, `a writer claims the box at ${t}`);
    poses.push(JSON.stringify(authored));
  }
  assert.equal(new Set(poses).size, 1, 'every playhead position yields ONE authored pose');
  assert.deepEqual(JSON.parse(poses[0] as string), {
    transform: '', opacity: '0.9', filter: 'blur(2px) drop-shadow(0px 2px 10px #00000055)',
    // The layout pair joined the surface with the `w`/`h` channels (plans/104 section 5.2 P1):
    // a photographer neutralising on a CLONE has to know the AUTHORED size, or a shot
    // taken mid-size-tween re-wraps its text at the tweened width.
    zIndex: '', width: '640px', height: '360px', written: true,
  });
  // And the in-place borrow (the vector twin's path) puts them on the element itself.
  session.apply(1500);
  const posed = el.style.filter;
  const release = borrowAuthoredPose(el);
  assert.equal(el.style.filter, 'blur(2px) drop-shadow(0px 2px 10px #00000055)');
  assert.equal(el.style.opacity, '0.9');
  release();
  assert.equal(el.style.filter, posed, 'and the playhead\'s frame is put straight back');
  session.restore();
});

// ── P1a: real cameras, and the w/h channels ─────────────────────────────────
//
// P0 shipped the projection with the camera set permanently empty - every stage ran
// at the DEFAULT camera, which is an identity for a flat board and a magnifier for a
// lifted one. P1 fills it in from the stage's own `camera` boxes, and the tests below
// are the ones that would have caught each way that can go wrong: a camera derived
// differently by the two evaluators, a cut resolved on the wrong side of a butt joint,
// an ownership predicate that never hears the camera moved, and a size tween whose
// centre the two paths disagree about.

/** A camera box: an ordinary `.lolly-box` carrying the marker div the hooks emit. */
function camBox(time: string): string {
  return depthBox({
    time,
    inner: '<div class="lolly-box-cam" data-cam="1" data-export-hide aria-hidden="true"></div>',
  });
}

test('section 5.4 CAMERAS: derived from the stage\'s own layers, with butted half-open windows', () => {
  const node = depthStage(
    camBox('data-t-start="0" data-t-dur="1000" data-t-kf="t0_x-100"')
    + camBox('data-t-start="1000" data-t-dur="1000" data-t-z="-300" data-t-kf="t0_x300"')
    + depthBox({ time: 'data-t-start="0" data-t-dur="4000"' }),
  );
  const stage = parseSequenceStage(node)!;
  const cams = stageCameras(stage.layers);
  assert.equal(cams.length, 2, 'one clip per camera box, content boxes excluded');
  assert.deepEqual({ start: cams[0]!.start, end: cams[0]!.end }, { start: 0, end: 1000 });
  assert.deepEqual({ start: cams[1]!.start, end: cams[1]!.end }, { start: 1000, end: 2000 });
  assert.equal(cams[0]!.base, null, 'no z field authored: nothing but the track');
  assert.deepEqual(cams[1]!.base, { z: -300 }, 'the z FIELD is the scene-default dolly');

  // CUTS, not blends: the butt joint at 1000 belongs to the SECOND clip, because the
  // window is half-open [start, end) exactly like a clip's own activity window.
  assert.equal(planCameraView({ ...PLAN_ENV, cameras: cams }, 999).x, -100);
  assert.equal(planCameraView({ ...PLAN_ENV, cameras: cams }, 1000).x, 300);
  // …and past every window there is no camera covering t at all, which resolves to the
  // DEFAULT camera - never a literal identity, and never the last one that was on.
  const after = planCameraView({ ...PLAN_ENV, cameras: cams }, 3000);
  assert.equal(after.x, 0);
  assert.equal(after.z, 0);
  assert.equal(after.p, DEFAULT_PERSPECTIVE);
});

test('section 5.4 CAMERAS: an untimed camera is "Always on" and covers every t', () => {
  const node = depthStage(camBox('data-t-kf="t0_z-600"'));
  const cams = stageCameras(parseSequenceStage(node)!.layers);
  assert.equal(cams.length, 1);
  assert.equal(cams[0]!.end, null, 'no authored duration: it never ends');
  for (const t of [0, 500, 3999, 999_999]) {
    assert.equal(planCameraView({ ...PLAN_ENV, cameras: cams }, t).z, -600, `t=${t}`);
  }
});

test('section 5.4 CAMERAS: BOTH evaluators derive the same camera from the same stage', () => {
  // The audio precedent, restated for the camera: this only works because the applier
  // detects `[data-cam]` for itself rather than being handed a list. A dolly to
  // camZ = -600 magnifies a FLAT box (eff = 1200/(1200+600)... no - camZ negative pulls
  // the camera toward the surface, so eff > 1), which is exactly what makes it visible
  // to a parity assertion at all.
  const html = camBox('data-t-kf="t0_z-600"') + depthBox({ time: 'data-t-start="0" data-t-dur="4000"' });
  const node = depthStage(html);
  const stage = parseSequenceStage(node)!;
  const cams = stageCameras(stage.layers);
  const env: SeqPlanEnv = { ...PLAN_ENV, cameras: cams };
  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(4000);
  applyTimeToElements(els, 500, ctx);

  const plan = sequenceDrawPlan(stage.layers, 500, 4000, env);
  const item = plan.find((p) => p.layer.kind !== 'camera') as PlanItem;
  assert.ok(item.scale > 1, `a dolly toward the board magnifies a flat box (got ${item.scale})`);
  const w = written(els[1] as HTMLElement);
  assert.equal(w.sc, n3(item.scale), 'scale');
  assert.equal(w.dx, n3(item.dx), 'dx');
  assert.equal(w.dy, n3(item.dy), 'dy');
  // …and the camera marker itself stays untouched, exactly as an audio bed does.
  assert.equal((els[0] as HTMLElement).style.transform, '');
});

test('section 5.4 CAMERAS: the SESSION finds the "Always on" camera - not just a hand-fed list', () => {
  // THE TEST THE OLD PARITY BLOCK COULD NOT FAIL. Every assertion above hands the
  // applier `querySelectorAll('.lolly-box')` - the PLANNER's element set - and so never
  // exercises `createSequenceTime`'s own selector, which was `[data-t-start]` alone.
  // section 5.4's headline scene camera is UNTIMED ("the first depth interaction auto-creates
  // ONE untimed camera box"), the hooks emit no `data-t-start` for a scenery box, and
  // the marker is a child div - so the one box whose whole job is to move everything
  // else was invisible to the preview. The camera-pan drag, the wheel dolly and all
  // five presets committed to the model and then did nothing on screen, while the
  // export panned correctly: 240 px of divergence on the fixture below.
  const node = depthStage(
    camBox('data-t-kf="t0_x-200*t2000_el_x200"')
    + depthBox({ time: 'data-t-start="0" data-t-dur="4000" data-t-z="200"' }),
  );
  const stage = parseSequenceStage(node)!;
  const cams = stageCameras(stage.layers);
  assert.equal(cams.length, 1, 'the planner sees it (it always did)');
  const el = node.querySelectorAll<HTMLElement>('.lolly-box')[1] as HTMLElement;

  const session = createSequenceTime(node);
  try {
    for (const t of [0, 500, 1200, 2000, 3000]) {
      session.apply(t);
      const item = sequenceDrawPlan(stage.layers, t, 4000, { ...PLAN_ENV, cameras: cams })
        .find((p) => p.layer.kind !== 'camera') as PlanItem;
      const w = written(el);
      assert.equal(w.dx, n3(item.dx), `dx at ${t}`);
      assert.equal(w.dy, n3(item.dy), `dy at ${t}`);
      assert.equal(w.sc, n3(item.scale), `scale at ${t}`);
      assert.ok(Math.abs(item.dx) > 1, `the fixture really pans at ${t}`);
    }
  } finally { session.restore(); }
  assert.equal(el.style.transform, '', 'and the session hands the box back');
});

test('section 5.5 BACKGROUND PLANE: the preview projects it, and it never takes a rank', () => {
  // "Both paths project the bg through the same projectLayer … Golden: pan moves the
  // bg." The export photographs the stage with every `.lolly-box` and timed frame page
  // hidden and projects THAT plate; the preview's applier only ever touched elements
  // with timing, so anything else the stage paints - the bound-path connector layer - 
  // sat frozen while the composition slid across it. A flat colour artboard is
  // projection-invariant, which is what made this invisible until a document had
  // connectors.
  const plane = '<div class="lolly-conn-wrap" style="left:0px;top:0px;width:1920px;height:1080px;">'
    + '<svg width="1920" height="1080"></svg></div>';
  const node = depthStage(
    plane
    + camBox('data-t-kf="t0_x0*t2000_el_x-240"')
    + depthBox({ time: 'data-t-start="0" data-t-dur="4000" data-t-z="-200"' }),
  );
  const stage = parseSequenceStage(node)!;
  const cams = stageCameras(stage.layers);
  const planeEl = node.querySelector('.lolly-conn-wrap') as HTMLElement;
  const sunken = node.querySelectorAll<HTMLElement>('.lolly-box')[1] as HTMLElement;

  const session = createSequenceTime(node);
  try {
    for (const t of [0, 800, 1600, 2400]) {
      session.apply(t);
      // The worker's own bg draw, restated: `projectLayer` at the stage centre, z = 0.
      const view = planCameraView({ ...PLAN_ENV, cameras: cams }, t);
      const proj = projectLayer(view, { bx: view.w / 2, by: view.h / 2, z: 0 });
      const w = written(planeEl);
      assert.equal(w.dx, n3(proj.dx), `bg dx at ${t}`);
      assert.equal(w.dy, n3(proj.dy), `bg dy at ${t}`);
      assert.equal(w.sc, n3(proj.scale), `bg scale at ${t}`);
      // …and it is BELOW every layer, always. The compositor draws the bg before the
      // first item, so a SUNKEN box (which ranks first among the layers) must still
      // paint above it - a rank on the plane would put the connector artwork over it
      // in the preview and under it in the export.
      assert.equal(planeEl.style.zIndex, '', 'the plane takes no rank');
      assert.ok(sunken.style.zIndex !== '', 'while the sunken box does');
    }
    assert.notEqual(written(planeEl).dx, 0, 'the fixture really pans the bg');
  } finally { session.restore(); }
  assert.equal(planeEl.style.transform, '', 'and the plane is handed back too');
  assert.equal(planeEl.style.zIndex, '');
});

test('section 4.1 FOLD under a REAL camera: transition offsets are INSIDE the projection', () => {
  // The naive wrong reading adds the camera displacement to an UNSCALED transition
  // offset, so a slide enter on a lifted layer lands short. Both evaluators are forced
  // through the fold here, with a camera that pans AND dollies while a transition runs.
  const html = camBox('data-t-kf="t0_x-120_y40_z-400*t2000_el_x120_y-40_z-200"')
    + depthBox({
      style: 'transform:rotate(-6deg);opacity:0.9;',
      time: 'data-t-start="0" data-t-dur="3000" data-t-z="180"'
        + ' data-t-enter="swoop" data-t-enter-ms="800" data-t-kf="t0_s1_o1*t2000_eo_s1.4_o0.5"',
    });
  const node = depthStage(html);
  const stage = parseSequenceStage(node)!;
  const env: SeqPlanEnv = { ...PLAN_ENV, cameras: stageCameras(stage.layers) };
  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(4000);
  let moved = 0;
  for (let t = 0; t < 2600; t += 37) {
    applyTimeToElements(els, t, ctx);
    const item = sequenceDrawPlan(stage.layers, t, 4000, env)
      .find((p) => p.layer.kind !== 'camera') as PlanItem;
    const w = written(els[1] as HTMLElement);
    assert.equal(w.dx, n3(item.dx), `dx at ${t}`);
    assert.equal(w.dy, n3(item.dy), `dy at ${t}`);
    assert.equal(w.sc, n3(item.scale), `scale at ${t}`);
    // `written()` re-sums the rotate terms in float, so this one compares at the
    // quantum rather than by identity - the other four are single values.
    assert.ok(Math.abs(w.rot - n3(item.rot)) < 1e-3, `rot at ${t}`);
    assert.equal(w.alpha, n4(item.alpha), `alpha at ${t}`);
    if (item.dx !== 0) moved++;
  }
  assert.ok(moved > 40, 'the fixture really is moving - otherwise this proves nothing');
});

// ── section 6.5 / section 9.15: the pose the EDITOR CHROME reads back ────────────
//
// The reported bug: a box under a keyframe scale rendered at its posed geometry while
// free-canvas drew the selection outline and all eight resize handles at the AUTHORED
// rect: editing controls over empty canvas, and the one drag entry point that never
// goes through the hit-test. Section 6.5's rule is that chrome projects through the SAME
// fold the render used, so the applier publishes what it wrote and the chrome maps the
// model rect through it. These two assertions are that seam: the published pose IS the
// written transform, and `posedRect` turns it into the rect the user is looking at.

test('section 9.15: the applier publishes the pose it wrote, and drops it on restore', () => {
  const node = depthStage(
    camBox('data-t-start="0" data-t-dur="3000" data-t-kf="t0_x-120_z-400*t2000_el_x120_z-200"')
    + depthBox({
      time: 'data-t-start="0" data-t-dur="2000"'
        + ' data-t-kf="t0_s1_x0_y0*t2000_eo_s1.6_x140_y-60"',
    }),
  );
  const el = [...node.querySelectorAll<HTMLElement>('.lolly-box')][1] as HTMLElement;
  const ctx = applyCtx(4000);
  let offset = 0;
  for (let t = 0; t < 2000; t += 53) {
    applyTimeToElements([...node.querySelectorAll<HTMLElement>('.lolly-box')], t, ctx);
    const p = sequencePoseOf(el);
    assert.ok(p, `a posed box answers at t=${t}`);
    // Identical at the applier's own quantum to what it put in the inline transform:
    // one number, published and written from the same fold, so the chrome cannot be
    // reading a second evaluation of the same track.
    const w = written(el);
    assert.equal(n3(p.dx), w.dx, `dx at ${t}`);
    assert.equal(n3(p.dy), w.dy, `dy at ${t}`);
    assert.equal(n3(p.sc), w.sc, `sc at ${t}`);
    assert.ok(Math.abs(n3(p.rot) - w.rot) < 1e-3, `rot at ${t}`);
    assert.equal(p.sized, false, 'this track keys no size');
    assert.equal(p.tilted, false, 'and rides no tilted camera');
    // The chrome the OLD code drew (the authored rect) against the one it draws now.
    const authored = { x: 200, y: 100, w: 640, h: 360, rot: 0 };
    const posed = posedRect(authored, p);
    assert.equal(posed.w, 640 * p.sc, 'the outline grows with the box');
    assert.equal(posed.x + posed.w / 2, 200 + 320 + p.dx, 'and stays centred on it');
    if (Math.hypot(posed.x - authored.x, posed.y - authored.y) > 1) offset++;
  }
  assert.ok(offset > 25, 'the fixture really does move the chrome - otherwise this proves nothing');

  // Past the clip's out-point the applier hands the authored styles back, and the pose
  // goes with them: "no entry" and "not posed" have to be the same answer, or the
  // chrome would keep drawing at a pose the DOM no longer holds.
  applyTimeToElements([...node.querySelectorAll<HTMLElement>('.lolly-box')], 3500, ctx);
  assert.equal(sequencePoseOf(el), null, 'a box off the playhead publishes nothing');
  const rest = { x: 200, y: 100, w: 640, h: 360, rot: 0 };
  assert.equal(posedRect(rest, sequencePoseOf(el)), rest, 'so the chrome is placed from the model');
});

test('section 9.15: standing down for an export takes the published pose with it', () => {
  const node = depthStage(depthBox({
    time: 'data-t-start="0" data-t-dur="2000" data-t-kf="t0_s1*t2000_s1.6"',
  }));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const session = createSequenceTime(node);
  session.apply(1000);
  assert.ok(sequencePoseOf(el), 'posed while the clock is driving');
  // `withAuthoredDom` is what an export wraps itself in - every live writer hands its
  // writes back for the duration. An editor asking mid-export must not be told the box
  // is still posed, because it demonstrably is not.
  withAuthoredDom(node, () => {
    assert.equal(sequencePoseOf(el), null, 'the pose comes off with the styles that expressed it');
  });
  session.restore();
});

test('camerasMove: the P1 ownership question, answered once for the whole render', () => {
  assert.equal(camerasMove(null), false);
  assert.equal(camerasMove([]), false);
  // A camera parked at the documented default moves nothing, so a flat layer keeps its
  // plate-baked filter - the byte-identity floor survives an inert camera box.
  assert.equal(camerasMove([{ start: 0, end: null, base: null, track: null }]), false);
  assert.equal(camerasMove([{ base: { z: -1 } }]), true, 'a dolly');
  assert.equal(camerasMove([{ base: { a: 0.4 } }]), true, 'an aperture: DOF varies with it');
  assert.equal(camerasMove([{ base: { p: DEFAULT_PERSPECTIVE } }]), false, 'the default p is not a move');
  assert.equal(camerasMove([{ base: { p: 800 } }]), true, 'but any other p changes eff for lifted layers');
  assert.equal(camerasMove([{ track: kfTrackOf('t0_x0*t1000_x40') }]), true, 'any track at all');

  // …and the predicate it exists to feed: a FLAT box with no depth of its own becomes
  // compositor-owned the moment a camera moves, because a plate is shot once for the
  // whole render and cannot carry a filter that changes every frame.
  const flat = parseSequenceStage(depthStage(depthBox({
    style: 'filter:drop-shadow(0px 2px 10px #00000055);',
    time: 'data-t-start="0" data-t-dur="2000"',
  })))!.layers[0] as SeqLayer;
  assert.equal(ownsLayerFx(flat), false, 'pre-104 vocabulary: its plate keeps the shadow');
  assert.equal(ownsLayerFx(flat, true), true, 'under a moving camera the compositor owns it');
});

test('section 5.2 w/h: a keyed size REPLACES the box\'s own, and both paths move the centre with it', () => {
  const track = 't0_el_w640_h360*t2000_el_w1280_h360';
  const node = depthStage(depthBox({ time: `data-t-start="0" data-t-dur="3000" data-t-kf="${track}"` }));
  const stage = parseSequenceStage(node)!;
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const ctx = applyCtx(4000);

  const at0 = sequenceDrawPlan(stage.layers, 0, 4000, PLAN_ENV)[0] as PlanItem;
  assert.deepEqual({ w: at0.w, h: at0.h, sized: at0.sized }, { w: 640, h: 360, sized: true });
  const mid = sequenceDrawPlan(stage.layers, 1000, 4000, PLAN_ENV)[0] as PlanItem;
  assert.equal(mid.w, 960, 'linear across the segment');
  assert.equal(mid.h, 360);

  // THE LAYOUT WRITE, and it is the only one the applier ever issues.
  applyTimeToElements([el], 1000, ctx);
  assert.equal(el.style.width, '960px');
  assert.equal(el.style.height, '360px');

  // The centre moved with the growth - a box grows from its top-left in BOTH paths - 
  // and with no camera the projection is still an exact identity, so nothing else did.
  assert.equal(mid.dx, 0, 'no camera: the fold short-circuits and the offset stays zero');
  assert.equal(mid.scale, 1);
  assert.equal(el.style.transform, '', 'and no transform is written for a pure size tween');
});

test('section 5.2 w/h: the projection anchors on the RESOLVED centre, not the authored one', () => {
  // With a camera panning, a stretched box's centre is `left + w/2` at the size of the
  // moment. Getting that wrong is invisible at rest and a drift under a pan, so it is
  // asserted against the engine's own fold rather than against a remembered number.
  // The camera needs a DOLLY as well as a pan: at eff = 1 the projected offset is
  // exactly `-camX` whatever the centre is, so a pan alone could not tell a right
  // anchor from a wrong one. This is the kind of test that has to be built from the
  // formula rather than from a screenshot.
  const view = { ...planCameraView({ ...PLAN_ENV, cameras: [{ base: { x: 200, z: -400 } }] }, 0) };
  const base = { tr: REST, pose: {}, zField: 0, authoredBlur: 0, cx: 520, cy: 280, view };
  const flatFold = foldKfPose({ ...base, boxW: 640, boxH: 360 });
  const grown = foldKfPose({ ...base, boxW: 640, boxH: 360, pose: { w: 1280 } });
  const direct = projectLayer(view, { bx: 520 + (1280 - 640) / 2, by: 280, z: 0 });
  assert.equal(grown.dx, direct.dx, 'the fold uses the resolved centre, verbatim');
  assert.equal(grown.w, 1280);
  assert.ok(grown.dx !== flatFold.dx, 'and that is a different number from the authored one');
});

test('section 5.2 w/h: the layout write is REVERSIBLE, and an unsized document never issues one', () => {
  const sized = depthStage(depthBox({
    time: 'data-t-start="0" data-t-dur="3000" data-t-kf="t0_w640*t2000_w1280"',
  }));
  const el = sized.querySelector('.lolly-box') as HTMLElement;
  const session = createSequenceTime(sized);
  session.apply(1000);
  assert.equal(el.style.width, '960px');
  session.restore();
  assert.equal(el.style.width, '640px', 'the AUTHORED declaration comes back, verbatim');
  assert.equal(el.style.height, '360px');

  // A track that keys everything BUT the size writes no width at all - the reflow is
  // gated on `sized`, so the exception stays an exception.
  const other = depthStage(depthBox({
    time: 'data-t-start="0" data-t-dur="3000" data-t-z="200" data-t-kf="t0_x0_s1_o1_b0*t2000_x80_s1.3_o0.4_b6"',
  }));
  const el2 = other.querySelector('.lolly-box') as HTMLElement;
  const before = el2.getAttribute('style');
  const ctx = applyCtx(4000);
  for (const t of [0, 400, 1200, 2500]) applyTimeToElements([el2], t, ctx);
  assert.equal(el2.style.width, '640px', 'untouched');
  assert.equal(el2.style.height, '360px');
  ctx.store.restoreAll();
  // DECLARATION-identical, not byte-identical: writing through CSSStyleDeclaration
  // re-serialises the whole attribute, which is the applier's own stated contract.
  const decls = (v: string | null): string[] =>
    (v ?? '').split(';').map((d) => d.replace(/\s+/g, '')).filter(Boolean).sort();
  assert.deepEqual(decls(el2.getAttribute('style')), decls(before),
    'and the whole declaration set is handed back');
});

test('section 5.2 w/h: a size key round-trips the wire, and clamps rather than sizing a plate to NaN', () => {
  assert.equal(kfTrackOf('t0_w1280.5_h720.25')[0]?.v.w, 1280.5);
  assert.equal(kfTrackOf('t0_w1280.5_h720.25')[0]?.v.h, 720.25);
  assert.equal(kfTrackOf('t0_w-40')[0]?.v.w, 0, 'a size is never negative');
  assert.equal(kfTrackOf('t0_w999999')[0]?.v.w, KF_CLAMPS.w[1], 'and never past the wire clamp');
  // A zero-sized BOX has no size to replace, so a `w` token on it is inert rather than
  // a division by nothing - `boxW > 0` is the gate.
  const fold = foldKfPose({
    view: planCameraView(PLAN_ENV, 0), cx: 0, cy: 0, tr: REST,
    pose: { w: 400 }, zField: 0, authoredBlur: 0, boxW: 0, boxH: 0,
  });
  assert.deepEqual({ w: fold.w, h: fold.h, sized: fold.sized }, { w: 0, h: 0, sized: false });
});

// ── split text animation (plans/175 WP-A) ────────────────────────────────────
//
// The hook wraps a split box's text in `.lly-u` unit spans and stamps
// `data-t-split`/`data-t-stagger`/`data-t-split-order`; the units then carry the
// enter/exit while the box stays at rest. What has to hold, on both evaluators:
// the parse reads the same facts, the whole-box transition is suppressed on
// exactly the frames the units animate, junction crossfades never form around a
// split layer, and the live-raster window predicate agrees with the DOM applier.

function splitBoxHtml(units: number, time: string, order = ''): string {
  const spans = Array.from({ length: units }, (_, i) =>
    `<span class="lly-u" aria-hidden="true">u${i}</span>`).join(' ');
  const ord = order ? ` data-t-split-order="${order}"` : '';
  return `<div class="lolly-box" data-box-id="b1" style="left:0px;top:0px;width:600px;height:200px;" ${time} data-t-split="word" data-t-stagger="100"${ord}>`
    + `<div class="lolly-box-text"><span class="lly-split" role="text" aria-label="x">${spans}</span></div></div>`;
}

test('split: readLayer and readTiming read the same tier/gap/order, and count units', () => {
  const node = stageOf(splitBoxHtml(3, 'data-t-start="0" data-t-dur="3000" data-t-enter="rise" data-t-enter-ms="400"', 'reverse'));
  const stage = parseSequenceStage(node)!;
  const layer = stage.layers[0] as SeqLayer;
  assert.equal(layer.split, 'word');
  assert.equal(layer.splitStaggerMs, 100);
  assert.equal(layer.splitOrder, 'reverse');
  assert.equal(layer.splitUnits, 3);
  assert.ok(splitActive(layer));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const timing = readTiming(el);
  assert.equal(timing.split, layer.split);
  assert.equal(timing.stagger, layer.splitStaggerMs);
  assert.equal(timing.splitOrder, layer.splitOrder);
});

test('split: junk tier/order values read as not-split', () => {
  const html = `<div class="lolly-box" style="left:0px;top:0px;width:600px;height:200px;" data-t-start="0" data-t-dur="3000" data-t-split="constructor" data-t-split-order="valueOf"></div>`;
  const stage = parseSequenceStage(stageOf(html))!;
  const layer = stage.layers[0] as SeqLayer;
  assert.equal(layer.split, '');
  assert.equal(layer.splitOrder, '');
  assert.ok(!splitActive(layer));
});

test('split: the whole-box transition is SUPPRESSED while units carry it', () => {
  const time = 'data-t-start="0" data-t-dur="3000" data-t-enter="rise" data-t-enter-ms="400"';
  const split = parseSequenceStage(stageOf(splitBoxHtml(3, time)))!;
  const plain = parseSequenceStage(stageOf(boxHtml({ time })))!;
  const t = 100; // mid-enter for both
  const splitItem = sequenceDrawPlan(split.layers, t, 3000)[0] as PlanItem;
  const plainItem = sequenceDrawPlan(plain.layers, t, 3000)[0] as PlanItem;
  assert.notEqual(plainItem.dy, 0, 'the un-split twin really is mid-rise');
  assert.ok(plainItem.alpha < 1);
  assert.equal(splitItem.dy, 0, 'the split box is at rest - its units animate instead');
  assert.equal(splitItem.alpha, 1);
});

test('split: splitAnimatingAt opens the enter window to stagger×(n−1)+enterMs', () => {
  const stage = parseSequenceStage(stageOf(splitBoxHtml(3, 'data-t-start="0" data-t-dur="3000" data-t-enter="rise" data-t-enter-ms="400"')))!;
  const layer = stage.layers[0] as SeqLayer;
  assert.ok(splitAnimatingAt(layer, 0, 3000));
  assert.ok(splitAnimatingAt(layer, 599, 3000), 'window = 2×100 + 400');
  assert.ok(!splitAnimatingAt(layer, 600, 3000));
  assert.ok(!splitAnimatingAt(layer, 1500, 3000), 'the steady middle is one at-rest shot');
});

test('split: the CUT tier (no authored kind) still opens a stagger window - the typewriter', () => {
  const stage = parseSequenceStage(stageOf(splitBoxHtml(3, 'data-t-start="0" data-t-dur="3000"')))!;
  const layer = stage.layers[0] as SeqLayer;
  assert.equal(layer.enter, null);
  assert.ok(splitAnimatingAt(layer, 100, 3000), 'window = 2×100 with no kind');
  assert.ok(!splitAnimatingAt(layer, 250, 3000));
  // …and the exit side needs an authored kind: absent means no exit window at all.
  assert.ok(!splitAnimatingAt(layer, 2950, 3000));
});

test('split: a split layer never forms a junction crossfade', () => {
  const a = boxHtml({ time: 'data-t-start="0" data-t-dur="1000" data-t-lane="seq" data-t-exit="fade" data-t-exit-ms="400"' });
  const b = splitBoxHtml(3, 'data-t-start="1000" data-t-dur="1000" data-t-lane="seq" data-t-enter="fade" data-t-enter-ms="400"');
  const stage = parseSequenceStage(stageOf(a + b))!;
  assert.deepEqual(crossfadeJunctions(stage.layers), [], 'split kills the junction');
  // The same pair WITHOUT the split forms one - so the assertion above is not vacuous.
  const b2 = boxHtml({ time: 'data-t-start="1000" data-t-dur="1000" data-t-lane="seq" data-t-enter="fade" data-t-enter-ms="400"' });
  const stage2 = parseSequenceStage(stageOf(a + b2))!;
  assert.equal(crossfadeJunctions(stage2.layers).length, 1);
});

test('split: applySplitUnits drives the spans, steps the cut tier, and clears at rest', () => {
  // Cut tier: no authored kind, stagger 100, 3 units.
  const node = stageOf(splitBoxHtml(3, 'data-t-start="0" data-t-dur="3000"'));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const timing = readTiming(el);
  const spans = [...el.querySelectorAll<HTMLElement>('.lly-u')];

  assert.equal(applySplitUnits(el, timing, 150, 7000), 'animating');
  // A unit that has cut in is AT REST and carries no style at all - only the
  // still-hidden unit holds a write. That is the cheapest correct steady state.
  assert.deepEqual(spans.map((s) => s.style.opacity), ['', '', '0'],
    'at 150ms with a 100ms gap: units 0 and 1 have cut in, unit 2 has not');
  assert.deepEqual(spans.map((s) => s.style.transform), ['', '', ''], 'a cut never transforms');

  assert.equal(applySplitUnits(el, timing, 1000, 7000), 'rest');
  assert.deepEqual(spans.map((s) => s.style.opacity), ['', '', ''], 'rest hands the spans back clean');
});

test('split: an animated kind moves each unit through its own offset ramp', () => {
  const node = stageOf(splitBoxHtml(3, 'data-t-start="0" data-t-dur="3000" data-t-enter="rise" data-t-enter-ms="400"'));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const timing = readTiming(el);
  const spans = [...el.querySelectorAll<HTMLElement>('.lly-u')];
  assert.equal(applySplitUnits(el, timing, 200, 7000), 'animating');
  // Unit 0 is half way up its rise; unit 2 (offset 200) has not started - fully out.
  assert.match(spans[0]!.style.transform, /translate\(/);
  assert.equal(spans[2]!.style.opacity, '0');
  const dy0 = parseFloat(/translate\(0px, (-?[\d.]+)px\)/.exec(spans[0]!.style.transform)?.[1] ?? 'NaN');
  const dy1 = parseFloat(/translate\(0px, (-?[\d.]+)px\)/.exec(spans[1]!.style.transform)?.[1] ?? 'NaN');
  assert.ok(dy1 > dy0, 'the later unit is further from rest than the earlier one');
  // clearSplitUnits is the export teardown - it must strip everything it wrote.
  clearSplitUnits(el);
  assert.deepEqual(spans.map((s) => s.style.opacity + s.style.transform), ['', '', '']);
});

test('split: a single unit falls back to the whole-box path - null, not a phantom split', () => {
  const node = stageOf(splitBoxHtml(1, 'data-t-start="0" data-t-dur="3000" data-t-enter="rise" data-t-enter-ms="400"'));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  assert.equal(applySplitUnits(el, readTiming(el), 100, 7000), null);
  // …and the planner agrees: one unit is not an active split.
  const stage = parseSequenceStage(node)!;
  assert.ok(!splitActive(stage.layers[0] as SeqLayer));
  const item = sequenceDrawPlan(stage.layers, 100, 3000)[0] as PlanItem;
  assert.notEqual(item.dy, 0, 'the whole-box rise runs instead');
});

test('split: reverse order deals the LAST unit first', () => {
  const node = stageOf(splitBoxHtml(3, 'data-t-start="0" data-t-dur="3000"', 'reverse'));
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const timing = readTiming(el);
  const spans = [...el.querySelectorAll<HTMLElement>('.lly-u')];
  assert.equal(applySplitUnits(el, timing, 150, 7000), 'animating');
  assert.deepEqual(spans.map((s) => s.style.opacity), ['0', '', ''],
    'reverse: units 2 and 1 have cut in (at rest, no style), unit 0 has not');
});

test('split: the DOM applier suppresses the whole-box transition too - both sides agree', () => {
  const node = stageOf(splitBoxHtml(3, 'data-t-start="0" data-t-dur="3000" data-t-enter="rise" data-t-enter-ms="400"'));
  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(3000);
  applyTimeToElements(els, 100, ctx);
  const el = els[0]!;
  assert.equal(el.style.transform, '', 'no whole-box transform mid-enter');
  assert.equal(el.style.opacity, '', 'no whole-box alpha either');
  const spans = [...el.querySelectorAll<HTMLElement>('.lly-u')];
  assert.notEqual(spans[0]!.style.transform, '', 'the units carry the rise');
  // Standing the writer down for an export hands the units back at rest with the box.
  ctx.store.restoreAll();
  assert.deepEqual(spans.map((s) => s.style.opacity + s.style.transform), ['', '', '']);
});

// ── hold effects (plans/175 WP-B) ────────────────────────────────────────────
//
// The while-on-screen looping pose, composed with the transition offset in BOTH
// evaluators through the same withHold. What must hold: the two readers see the
// same kind/rate, the plan's numbers ARE holdPose's, the DOM applier writes the
// same pose, and an unauthored box is byte-identical to before the field existed.

test('hold: both readers parse the kind and rate; junk reads as still', () => {
  const html = boxHtml({ time: 'data-t-start="0" data-t-dur="4000" data-t-hold="pulse" data-t-hold-rate="2"' });
  const node = stageOf(html);
  const layer = parseSequenceStage(node)!.layers[0] as SeqLayer;
  assert.equal(layer.hold, 'pulse');
  assert.equal(layer.holdRate, 2);
  const el = node.querySelector('.lolly-box') as HTMLElement;
  const timing = readTiming(el);
  assert.equal(timing.hold, layer.hold);
  assert.equal(timing.holdRate, layer.holdRate);
  const junk = parseSequenceStage(stageOf(boxHtml({ time: 'data-t-start="0" data-t-dur="4000" data-t-hold="constructor" data-t-hold-rate="1e9"' })))!;
  assert.equal((junk.layers[0] as SeqLayer).hold, '', 'prototype keys are not hold kinds');
});

test('hold: the plan composes holdPose over the transition offset - mid-life AND mid-enter', () => {
  const stage = parseSequenceStage(stageOf(boxHtml({
    style: 'left:0px;top:0px;width:320px;height:180px;',
    time: 'data-t-start="0" data-t-dur="4000" data-t-enter="rise" data-t-enter-ms="400" data-t-hold="bob" data-t-hold-rate="1"',
  })))!;
  // Mid-life (t=1250, past the enter): the pose IS holdPose alone over rest.
  const midItem = sequenceDrawPlan(stage.layers, 1250, 4000)[0] as PlanItem;
  const midHold = holdPose('bob', 1250, 1, 320, 180);
  assert.equal(midItem.dy, midHold.dy, 'the loop is live in the steady middle');
  assert.equal(midItem.alpha, 1);
  // Mid-enter (t=200): transition ⊕ hold, exactly withHold's composition.
  const enterItem = sequenceDrawPlan(stage.layers, 200, 4000)[0] as PlanItem;
  const tr = recTransition('rise', 0.5, 320, 180, '');
  const expected = withHold(tr, holdPose('bob', 200, 1, 320, 180));
  assert.equal(enterItem.dy, expected.dy, 'continuous through the enter - no pop at the seam');
  assert.equal(enterItem.alpha, expected.alpha);
});

test('hold: the DOM applier writes the same pose the plan computes', () => {
  const node = stageOf(boxHtml({
    style: 'left:0px;top:0px;width:320px;height:180px;',
    time: 'data-t-start="0" data-t-dur="4000" data-t-hold="sway" data-t-hold-rate="1"',
  }));
  const els = [...node.querySelectorAll<HTMLElement>('.lolly-box')];
  const ctx = applyCtx(4000);
  applyTimeToElements(els, 250, ctx);
  const el = els[0]!;
  const pose = holdPose('sway', 250, 1, 0, 0); // jsdom measures 0x0; sway ignores the box anyway
  assert.match(el.style.transform, /rotate\(/, 'the sway is a live rotate');
  assert.ok(el.style.transform.includes(`rotate(${Math.round(pose.rot * 1000) / 1000}deg)`),
    `the applier writes holdPose's own number: ${el.style.transform}`);
  // Standing the writer down hands the authored styles back, hold included.
  ctx.store.restoreAll();
  assert.equal(el.style.transform, '');
});

test('hold: a split box pulses whole-box while its units carry the enter', () => {
  const node = stageOf(splitBoxHtml(3, 'data-t-start="0" data-t-dur="3000" data-t-enter="rise" data-t-enter-ms="400" data-t-hold="pulse" data-t-hold-rate="1"'));
  const stage = parseSequenceStage(node)!;
  const item = sequenceDrawPlan(stage.layers, 100, 3000)[0] as PlanItem;
  const hold = holdPose('pulse', 100, 1, 600, 200);
  assert.equal(item.dy, 0, 'the whole-box transition stays suppressed (units carry it)');
  assert.equal(item.scale, hold.sc, 'while the hold still breathes the box');
});

test('hold: an unauthored box takes exactly the pre-hold path', () => {
  const time = 'data-t-start="0" data-t-dur="4000" data-t-enter="rise" data-t-enter-ms="400"';
  const stage = parseSequenceStage(stageOf(boxHtml({ time })))!;
  assert.equal((stage.layers[0] as SeqLayer).hold, '');
  const item = sequenceDrawPlan(stage.layers, 200, 4000)[0] as PlanItem;
  const off = recTransition('rise', 0.5, 1920, 1080, '');
  assert.equal(item.dy, off.dy, 'byte-identical numbers with no hold authored');
});

// ── plans/165 WP-4: the audio half of junction crossfades ────────────────────────

test('audioCrossfades mirrors the junction: A gains a tail, B a shortened head', () => {
  const a = fakeLayer({ idx: 0, lane: 'seq', kind: 'video', startMs: 0, durMs: 1000, exit: 'fade', exitMs: 400, openEnded: false });
  const b = fakeLayer({ idx: 1, lane: 'seq', kind: 'video', startMs: 1000, durMs: 1000, enter: 'fade', enterMs: 600, openEnded: false });
  const m = audioCrossfades([a, b]);
  assert.deepEqual(m.get(0), { tailSec: 0.4 }, 'A keeps playing 400ms past the cut');
  assert.deepEqual(m.get(1), { headSec: 0.4 }, 'B fades in over the handover, not its own 600ms');
});

test('a middle clip in a fade chain carries both sides at once', () => {
  const a = fakeLayer({ idx: 0, lane: 'seq', kind: 'video', startMs: 0, durMs: 1000, exit: 'fade', exitMs: 300, openEnded: false });
  const b = fakeLayer({ idx: 1, lane: 'seq', kind: 'video', startMs: 1000, durMs: 1000, enter: 'fade', enterMs: 500, exit: 'fade', exitMs: 200, openEnded: false });
  const c = fakeLayer({ idx: 2, lane: 'seq', kind: 'video', startMs: 2000, durMs: 1000, enter: 'fade', enterMs: 800, openEnded: false });
  const m = audioCrossfades([a, b, c]);
  assert.deepEqual(m.get(0), { tailSec: 0.3 });
  assert.deepEqual(m.get(1), { headSec: 0.3, tailSec: 0.2 });
  assert.deepEqual(m.get(2), { headSec: 0.2 });
});

test('a hard cut (either side not fade) hands nothing over', () => {
  const a = fakeLayer({ idx: 0, lane: 'seq', kind: 'video', startMs: 0, durMs: 1000, exit: 'rise', exitMs: 400, openEnded: false });
  const b = fakeLayer({ idx: 1, lane: 'seq', kind: 'video', startMs: 1000, durMs: 1000, enter: 'fade', enterMs: 600, openEnded: false });
  assert.equal(audioCrossfades([a, b]).size, 0);
});

// ── plans/165 WP-6 v1: clip-presence duck spans ──────────────────────────────────

test('duckSpansFor: other audible clips overlap in clip-local seconds, self excluded', () => {
  const bed = fakeLayer({ idx: 0, kind: 'audio', startMs: 1000, durMs: 8000 });
  const voice = fakeLayer({ idx: 1, kind: 'audio', startMs: 2000, durMs: 3000 });
  const vid = fakeLayer({ idx: 2, kind: 'video', lane: 'seq', startMs: 8000, durMs: 4000 });
  const spans = duckSpansFor([bed, voice, vid], bed);
  // voice: 2s..5s absolute → 1s..4s local; vid: 8s..12s absolute clamps to 8s..9s → 7s..8s local.
  assert.deepEqual(spans, [{ from: 1, to: 4 }, { from: 7, to: 8 }]);
});

test('duckSpansFor: muted, ignored and non-media clips duck nothing; a sped clip does', () => {
  const bed = fakeLayer({ idx: 0, kind: 'audio', startMs: 0, durMs: 10000 });
  const others = [
    fakeLayer({ idx: 1, kind: 'audio', startMs: 1000, durMs: 1000, mute: true }),
    fakeLayer({ idx: 2, kind: 'audio', startMs: 2000, durMs: 1000, ignored: true }),
    fakeLayer({ idx: 4, kind: 'text', startMs: 4000, durMs: 1000 } as never),
  ];
  assert.deepEqual(duckSpansFor([bed, ...others], bed), []);
  // A sped-up clip SOUNDS since WP-7 (pitch-preserving stretch), so it ducks.
  const sped = fakeLayer({ idx: 3, kind: 'video', startMs: 3000, durMs: 1000, speed: 2 });
  assert.deepEqual(duckSpansFor([bed, sped], bed), [{ from: 3, to: 4 }]);
});

test('frames mode: a timed audio box INSIDE a timed page is an audio layer of its own', () => {
  // A narration clip lives in its slide's page and only sounds; the page is one still
  // and its visual children are not layers, but the walk that stopped at the page left
  // every narrated export silent (2026-09-03).
  const page = '<div class="lolly-frame-page" data-pdf-page data-t-start="0" data-t-dur="8000" style="left:0;top:0;width:1920px;height:1080px">'
    + '<div class="lolly-box" style="left:0;top:0;width:100px;height:50px">Title</div>'
    + '<div class="lolly-box" data-t-start="400" data-t-dur="5000" data-t-lane="seq" style="left:0;top:0;width:10px;height:10px">'
    + '<div class="lolly-box-audio" data-audio-src="blob:narration" data-narration="1"></div></div></div>';
  const s = parseSequenceStage(stageOf(page, 8000))!;
  assert.deepEqual(s.layers.map((l) => [l.kind, l.startMs, l.durMs]), [['static', 0, 8000], ['audio', 400, 5000]],
    'the page stays a still; the sound inside it is its own audio layer');
  const quiet = '<div class="lolly-frame-page" data-pdf-page data-t-start="0" data-t-dur="8000" style="left:0;top:0;width:1920px;height:1080px">'
    + '<div class="lolly-box" style="left:0;top:0;width:100px;height:50px">Title</div></div>';
  assert.equal(parseSequenceStage(stageOf(quiet, 8000))!.layers.length, 1, 'a page with no sound is still one layer');
});
