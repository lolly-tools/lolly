/**
 * sequence-plan — the pure planner behind deterministic sequence export
 * (Fable timeline, phase 3 §0.0's "DESIGN REQUIREMENT added by the spike").
 *
 * Run with: node --test tests/sequence-plan.test.ts
 *
 * The compositor's executor is browser-only (WebCodecs, canvas) and Playwright's
 * bundled Chromium has no proprietary codecs, so the planner is where the whole
 * correctness surface has to be pinned down instead — activity windows, junction
 * crossfade alpha, source-time mapping, the frame grid, error normalisation and the
 * silent-truncation guard. Everything here runs headlessly under jsdom.
 *
 * The parity block at the end is the load-bearing one: it runs the REAL
 * views/sequence-clock.ts (the preview the user scrubs) against the planner over a
 * dense time sweep. Preview-vs-export drift is the plan's own stated risk, so it is
 * asserted rather than commented.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import {
  DEFAULT_TRANSITION_MS, MAX_SPEED, MAX_TIME_MS, MIN_SPEED,
  MAX_TRANSITION_MS, MIN_TRANSITION_MS, SEQ_ERROR_CODES, TRUNCATION_TOLERANCE_FRAMES,
  activeFrameWindow, activeSpanTimestamps, crossfadeExtensions, crossfadeJunctions, endOf, frameTimestamps,
  layerKind, parseSequenceStage, readLayer, reconcileDecoded, rotationOf, sequenceDrawPlan,
  sequenceError, toCodedError,
  type PlanItem, type SeqLayer,
} from '../shells/web/src/bridge/sequence-plan.ts';
import { recTransition } from '../shells/web/src/lib/transitions.ts';
import {
  isActiveAt, readTiming, transitionAt,
} from '../shells/web/src/views/sequence-clock.ts';

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

/** A synthetic layer for plan tests — no DOM needed beyond a placeholder element. */
function fakeLayer(over: Partial<SeqLayer> & { idx: number }): SeqLayer {
  return {
    el: doc.createElement('div'),
    startMs: 0, durMs: 1000, clipInMs: 0, speed: 1, mute: false,
    enter: null, enterMs: DEFAULT_TRANSITION_MS, exit: null, exitMs: DEFAULT_TRANSITION_MS,
    lane: 'seq', kind: 'static',
    rect: { x: 0, y: 0, w: 100, h: 100, rot: 0 },
    opacity: 1, blend: '', radius: '', clipPath: '', openEnded: false,
    ...over,
  };
}

// ── 1. parseSequenceStage ───────────────────────────────────────────────────

test('parseSequenceStage returns null when nothing is timed', () => {
  assert.equal(parseSequenceStage(stageOf(boxHtml(), null)), null);
  // A composition with nothing timed emits NEITHER marker — the all-or-nothing rule.
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
  // hides the video — so the class, not the tag, is what survives into the export.
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

// ── 2. sequenceDrawPlan — activity ──────────────────────────────────────────

const at = (layers: SeqLayer[], t: number, total = 7000): number[] =>
  sequenceDrawPlan(layers, t, total).map((p) => p.layer.idx);

test('activity is half-open [start, start + dur)', () => {
  const l = [fakeLayer({ idx: 0, startMs: 1000, durMs: 500 })];
  assert.deepEqual(at(l, 999), []);
  assert.deepEqual(at(l, 1000), [0]);            // inclusive head
  assert.deepEqual(at(l, 1499.999), [0]);
  assert.deepEqual(at(l, 1500), []);             // exclusive tail — the clean cut
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

// ── 3. sequenceDrawPlan — transitions ───────────────────────────────────────

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
  assert.equal(SEQ_ERROR_CODES.length, 6);
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
  // 1000 ms handover into a 200 ms clip kept A alive 800 ms past the END of B —
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
  // zero-size box — so a video kept only for its audio (opacity 0) decoded nothing
  // and failed the WHOLE export. Nothing asked ⇒ nothing concluded.
  const r = reconcileDecoded({ expectedSec: 3, decodedFrames: 0, lastTsSec: 0, fps: 30, requestedFrames: 0 });
  assert.deepEqual(r, { ok: true, shortfallSec: 0 });
  // The milder version: one skipped frame at the head of a fade (alpha exactly 0).
  const oneSkipped = reconcileDecoded({ expectedSec: 3, decodedFrames: 89, lastTsSec: 3 - 1 / 30, fps: 30, requestedFrames: 89 });
  assert.deepEqual(oneSkipped, { ok: true, shortfallSec: 0 });
});

test('regression: a low-frame-rate source is not "truncated"', () => {
  // Reported: the tolerance is in span frames but lastSourceSec is a PTS, which lags
  // the request by up to one SOURCE frame — 83 ms on a 12 fps screen recording
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
  // them past a 2 s source, 60 answered — a complete decode.
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
