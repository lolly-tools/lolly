// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSITIONS, TRANSITION_KINDS, DEFAULT_TRANSITION,
  isTransitionKind, transitionLabel,
  easeOutCubic, easeOutBack, recTransition,
  EASINGS, easingPoints, easingToWire, cubicBezierAt,
  SPLIT_TIERS, SPLIT_ORDERS, isSplitTier, isSplitOrder,
  splitRanks, splitSeedOf, splitPhaseWindowMs, splitUnitP, MAX_SPLIT_STAGGER_MS,
  HOLD_FX, isHoldFx, holdPose, withHold, MIN_HOLD_RATE, MAX_HOLD_RATE,
} from './transitions.ts';

const W = 320, H = 180;
const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

test('every kind settles to identity at p = 1', () => {
  for (const kind of TRANSITION_KINDS) {
    const t = recTransition(kind, 1, W, H);
    assert.ok(near(t.dx, 0), `${kind} dx=${t.dx}`);
    assert.ok(near(t.dy, 0), `${kind} dy=${t.dy}`);
    assert.ok(near(t.sc, 1), `${kind} sc=${t.sc}`);
    assert.ok(near(t.alpha, 1), `${kind} alpha=${t.alpha}`);
    assert.ok(near(t.rot, 0), `${kind} rot=${t.rot}`);
  }
});

test('every kind returns finite numbers across the whole ramp', () => {
  for (const kind of TRANSITION_KINDS) {
    for (const p of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]) {
      const t = recTransition(kind, p, W, H);
      for (const [k, v] of Object.entries(t)) {
        assert.ok(Number.isFinite(v), `${kind} @${p} ${k}=${v}`);
      }
      assert.ok(t.alpha >= 0 && t.alpha <= 1, `${kind} @${p} alpha out of range: ${t.alpha}`);
      assert.ok(t.sc > 0, `${kind} @${p} non-positive scale: ${t.sc}`);
    }
  }
});

test('at p = 0 every animated kind is fully transparent, and none is a hard cut', () => {
  for (const kind of TRANSITION_KINDS) {
    const t = recTransition(kind, 0, W, H);
    if (kind === 'none') {
      assert.deepEqual(t, { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 });
    } else {
      assert.equal(t.alpha, 0, `${kind} should start invisible`);
    }
  }
});

test('p is clamped to [0,1] - out-of-range progress never overshoots', () => {
  for (const kind of TRANSITION_KINDS) {
    assert.deepEqual(recTransition(kind, -5, W, H), recTransition(kind, 0, W, H), kind);
    assert.deepEqual(recTransition(kind, 12, W, H), recTransition(kind, 1, W, H), kind);
  }
});

test('slide distances scale with the object own size', () => {
  const small = recTransition('slide-left', 0, 100, 100);
  const big = recTransition('slide-left', 0, 1000, 100);
  assert.ok(big.dx > small.dx);
  // rise/drop take their distance from the HEIGHT, slides from the WIDTH.
  assert.equal(recTransition('rise', 0, 100, 200).dy, recTransition('rise', 0, 9999, 200).dy);
});

test('an unknown kind is a safe no-op fade, never a throw', () => {
  const t0 = recTransition('does-not-exist', 0, W, H);
  assert.deepEqual(t0, { dx: 0, dy: 0, sc: 1, alpha: 0, rot: 0 });
  const t1 = recTransition('does-not-exist', 1, W, H);
  assert.deepEqual(t1, { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 });
  // Prototype keys reaching the compositor as a "kind" must behave the same way.
  for (const k of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
    assert.deepEqual(recTransition(k, 1, W, H), t1, k);
  }
});

test('isTransitionKind accepts every registry key', () => {
  for (const kind of TRANSITION_KINDS) assert.equal(isTransitionKind(kind), true, kind);
  assert.equal(isTransitionKind(DEFAULT_TRANSITION), true);
});

test('isTransitionKind rejects prototype keys, non-strings and near-misses', () => {
  for (const bad of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString']) {
    assert.equal(isTransitionKind(bad), false, bad);
  }
  for (const bad of [undefined, null, 0, 1, NaN, true, false, {}, [], ['fade'], new String('fade'), Symbol('fade'), () => 'fade']) {
    assert.equal(isTransitionKind(bad), false, String(typeof bad));
  }
  for (const bad of ['', ' fade', 'FADE', 'slide', 'slide_left', 'Fade']) {
    assert.equal(isTransitionKind(bad), false, JSON.stringify(bad));
  }
});

test('the registry is frozen and its keys stay in sync with the kind list', () => {
  assert.ok(Object.isFrozen(TRANSITIONS));
  assert.deepEqual([...TRANSITION_KINDS], Object.keys(TRANSITIONS));
  for (const kind of TRANSITION_KINDS) assert.equal(typeof TRANSITIONS[kind], 'string');
});

test('the wire values the sidebar stores keep their slots', () => {
  // Slot pins, not an exhaustive list: kinds may be APPENDED, never renamed or reordered.
  assert.equal(TRANSITION_KINDS[0], 'fade');
  assert.equal(TRANSITION_KINDS[5], 'slide-left');
  assert.equal(TRANSITION_KINDS[TRANSITION_KINDS.indexOf('slide-left') + 1], 'slide-right');
  assert.equal(DEFAULT_TRANSITION, 'none');
  assert.ok(TRANSITION_KINDS.includes('none'));
});

test('transitionLabel falls back to the raw value for an unknown kind', () => {
  assert.equal(transitionLabel('fade'), 'Fade');
  assert.equal(transitionLabel('none'), 'Cut (no animation)');
  assert.equal(transitionLabel('constructor'), 'constructor');
  assert.equal(transitionLabel(undefined), '');
  assert.equal(transitionLabel(null), '');
});

test('easeOutCubic is monotonic on [0,1] with 0→0 and 1→1', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  let prev = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const v = easeOutCubic(i / 200);
    assert.ok(v > prev, `not increasing at t=${i / 200}`);
    assert.ok(v >= 0 && v <= 1, `out of range at t=${i / 200}: ${v}`);
    prev = v;
  }
});

test('easeOutBack pins its endpoints and overshoots exactly once', () => {
  assert.ok(near(easeOutBack(0), 0, 1e-12));
  assert.equal(easeOutBack(1), 1);
  // It is deliberately NOT monotonic: it rises past 1, then settles back - that
  // overshoot is what makes `pop` pop. Assert the shape rather than monotonicity.
  let peak = -Infinity, peakAt = 0;
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000;
    const v = easeOutBack(t);
    if (v > peak) { peak = v; peakAt = t; }
  }
  assert.ok(peak > 1, `expected an overshoot, peak=${peak}`);
  assert.ok(peakAt > 0.4 && peakAt < 0.8, `overshoot should sit mid-ramp, at ${peakAt}`);
  // Monotonic up to the peak, monotonic down after it - one hump, no ringing.
  let prev = -Infinity;
  for (let t = 0; t <= peakAt; t += 0.005) { const v = easeOutBack(t); assert.ok(v > prev); prev = v; }
  prev = Infinity;
  for (let t = peakAt + 0.005; t <= 1; t += 0.005) { const v = easeOutBack(t); assert.ok(v < prev); prev = v; }
});

test('only pop and zoom-out ever exceed their resting scale', () => {
  const overshoots = TRANSITION_KINDS.filter((kind) => {
    for (let i = 0; i <= 100; i++) if (recTransition(kind, i / 100, W, H).sc > 1.0000001) return true;
    return false;
  });
  assert.deepEqual(overshoots.sort(), ['pop', 'zoom-out']);
});

// ── authored easing (geometry only) ───────────────────────────────────────────
//
// The contract these pin, in order of how much it would cost to break it:
//   1. an unauthored box renders EXACTLY as it did before the control existed - 
//      this is what keeps the compositor's output stable;
//   2. an authored ease moves geometry and leaves alpha alone, because a fade that
//      tracks a slow curve turns to mud through video compression;
//   3. the wire format is CSS's own, and junk in it falls back rather than throwing.

test('an unauthored ease is byte-identical to the curve every kind was born with', () => {
  for (const kind of TRANSITION_KINDS) {
    for (const p of [0, 0.1, 0.25, 1 / 3, 0.5, 0.75, 0.9, 1]) {
      const before = recTransition(kind, p, 640, 360);
      const after = recTransition(kind, p, 640, 360, undefined);
      assert.deepEqual(after, before, `${kind} @ ${p} - omitting the argument must change nothing`);
      // Junk, an empty string and an out-of-range curve all mean "not authored".
      for (const junk of ['', 'wobble', 'cubic-bezier(2,0,1,1)', 'cubic-bezier(0,0)', null, 42]) {
        assert.deepEqual(recTransition(kind, p, 640, 360, junk), before, `${kind} @ ${p} - ${JSON.stringify(junk)} falls back`);
      }
    }
  }
});

test('an authored ease moves geometry and never touches alpha', () => {
  // A slide, so there is a real dx to watch, and its alpha ramp is the fast one.
  for (const p of [0.2, 0.4, 0.6, 0.8]) {
    const base = recTransition('slide-left', p, 640, 360);
    const eased = recTransition('slide-left', p, 640, 360, 'linear');
    assert.equal(eased.alpha, base.alpha, `alpha is the kind's own ramp at ${p}, not the curve`);
    assert.notEqual(eased.dx, base.dx, `dx follows the authored curve at ${p}`);
  }
  // Linear geometry is the identity on progress, which is checkable in closed form:
  // dx is (1 - p) x its full distance. The tolerance is in PIXELS, not in curve
  // units - the solver's 1e-6 on t is multiplied by a 716px slide, so a tighter
  // bound here would be measuring the iteration count rather than the maths.
  const full = 640 * 0.9 + 140;
  assert.ok(Math.abs(recTransition('slide-left', 0.25, 640, 360, 'linear').dx - 0.75 * full) < 0.01);
  assert.ok(Math.abs(recTransition('slide-left', 0.5, 640, 360, 'linear').dx - 0.5 * full) < 0.01);
});

test('every endpoint is pinned whatever the curve, so nothing lands off its mark', () => {
  for (const ease of [...Object.keys(EASINGS), 'cubic-bezier(0.2,-0.6,0.8,1.6)']) {
    for (const kind of TRANSITION_KINDS) {
      const end = recTransition(kind, 1, 640, 360, ease);
      assert.ok(Math.abs(end.dx) < 1e-6 && Math.abs(end.dy) < 1e-6, `${kind}/${ease} rests at the origin`);
      assert.ok(Math.abs(end.rot) < 1e-6, `${kind}/${ease} rests unrotated`);
      assert.ok(Math.abs(end.sc - 1) < 1e-6, `${kind}/${ease} rests at full size`);
    }
  }
});

test('overshoot curves are allowed to leave the unit interval - that is the point', () => {
  // y outside [0,1] is legal CSS and is the whole overshoot/anticipate family; x
  // outside it is not, because the curve would stop being a function of progress.
  assert.ok(easingPoints('overshoot')![1] > 1, 'overshoot passes its resting value');
  assert.ok(easingPoints('anticipate')![1] < 0, 'anticipate pulls back before it moves');
  assert.equal(easingPoints('cubic-bezier(0,2,1,-1)')![1], 2, 'a y beyond the unit interval is accepted');
  assert.equal(easingPoints('cubic-bezier(-0.1,0,1,1)'), null, 'a negative x is rejected');
  assert.equal(easingPoints('cubic-bezier(0,0,1.2,1)'), null, 'an x past 1 is rejected');
  const mid = cubicBezierAt(0.34, 1.56, 0.64, 1, 0.5);
  assert.ok(mid > 1, 'the overshoot curve really does exceed 1 mid-flight');
});

test('the bezier solver hits its endpoints and stays monotonic in time', () => {
  assert.equal(cubicBezierAt(0.33, 1, 0.68, 1, 0), 0);
  assert.equal(cubicBezierAt(0.33, 1, 0.68, 1, 1), 1);
  // Linear control points are the identity, which is the cheapest possible check
  // that the solver inverts x correctly rather than just returning t.
  for (const x of [0.1, 0.25, 0.5, 0.9]) {
    assert.ok(Math.abs(cubicBezierAt(0, 0, 1, 1, x) - x) < 1e-5, `linear is the identity at ${x}`);
  }
  // A flat spot is where Newton-Raphson diverges; the bisection fallback must cope.
  assert.ok(Number.isFinite(cubicBezierAt(0, 0.5, 1, 0.5, 0.5)));
});

test('the wire format round-trips and canonicalises', () => {
  assert.equal(easingToWire('ease-out'), 'ease-out', 'a preset stays its own name');
  assert.equal(easingToWire('cubic-bezier( 0.1 , 0.2 , 0.3 , 0.4 )'), 'cubic-bezier(0.1,0.2,0.3,0.4)');
  assert.equal(easingToWire('nonsense'), '', 'unparseable means unauthored, not an exception');
});

// ── split text animation (plans/175 WP-A) ────────────────────────────────────

test('the split vocabulary is prototype-safe and rejects junk', () => {
  assert.deepEqual(Object.keys(SPLIT_TIERS), ['word', 'line', 'letter']);
  assert.deepEqual(Object.keys(SPLIT_ORDERS), ['', 'reverse', 'center', 'random']);
  assert.ok(isSplitTier('letter'));
  assert.ok(!isSplitTier('constructor'), 'inherited keys are not tiers');
  assert.ok(!isSplitTier(''));
  assert.ok(isSplitOrder(''));
  assert.ok(!isSplitOrder('toString'));
});

test('splitRanks deals every order as a permutation, deterministically', () => {
  assert.deepEqual(splitRanks('', 4), [0, 1, 2, 3]);
  assert.deepEqual(splitRanks('reverse', 4), [3, 2, 1, 0]);
  // From the centre of 5 units (centre index 2): 2 leads, ties break earlier-first.
  assert.deepEqual(splitRanks('center', 5), [3, 1, 0, 2, 4]);
  const seed = splitSeedOf('box-7', 6);
  const a = splitRanks('random', 6, seed);
  const b = splitRanks('random', 6, seed);
  assert.deepEqual(a, b, 'the same seed deals the same shuffle - preview, export and CLI agree');
  assert.deepEqual([...a].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5], 'still a permutation');
  assert.notDeepEqual(splitRanks('random', 6, splitSeedOf('box-8', 6)), a,
    'a different box deals a different shuffle (with overwhelming likelihood)');
});

test('splitPhaseWindowMs: stagger span plus one unit, clamped against junk', () => {
  assert.equal(splitPhaseWindowMs(100, 5, 400), 800);
  assert.equal(splitPhaseWindowMs(100, 1, 400), 400, 'one unit has no stagger span');
  assert.equal(splitPhaseWindowMs(0, 5, 0), 0, 'no gap, no kind - no window');
  assert.equal(splitPhaseWindowMs(1e9, 3, 0), MAX_SPLIT_STAGGER_MS * 2, 'the wire ceiling holds');
  assert.equal(splitPhaseWindowMs(Number.NaN, 3, Number.NaN), 0);
});

test('splitUnitP: a ramp offset by rank, and a hard step when the phase has no kind', () => {
  // rank 2 at 100ms gap: its 400ms ramp runs over [200, 600].
  assert.equal(splitUnitP(200, 2, 100, 400), 0);
  assert.equal(splitUnitP(400, 2, 100, 400), 0.5);
  assert.equal(splitUnitP(600, 2, 100, 400), 1);
  assert.equal(splitUnitP(0, 0, 100, 400), 0);
  // The cut tier (phaseMs 0): out until the offset passes, then simply there.
  assert.equal(splitUnitP(199, 2, 100, 0), 0);
  assert.equal(splitUnitP(201, 2, 100, 0), 1);
});

// ── hold effects (plans/175 WP-B) ────────────────────────────────────────────

test('every hold kind is AT REST at t = 0 and periodic at its rate', () => {
  for (const kind of Object.keys(HOLD_FX)) {
    const zero = holdPose(kind, 0, 1, 320, 180);
    assert.deepEqual(zero, { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 }, `${kind} starts at rest`);
    // One full cycle at 1 Hz returns to rest (within float noise).
    const cycle = holdPose(kind, 1000, 1, 320, 180);
    for (const [k, v] of Object.entries(cycle)) {
      const rest = (zero as unknown as Record<string, number>)[k]!;
      assert.ok(Math.abs((v as number) - rest) < 1e-9, `${kind} ${k} returns to rest after a cycle: ${v}`);
    }
    // Mid-cycle it is genuinely away from rest.
    const mid = holdPose(kind, 250, 1, 320, 180);
    assert.notDeepEqual(mid, zero, `${kind} actually moves`);
  }
});

test('holdPose clamps its rate and answers junk kinds with rest', () => {
  assert.deepEqual(holdPose('constructor', 250, 1, 320, 180), { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 });
  // A NaN/hostile rate reads as the minimum, never NaN in a pose.
  const hostile = holdPose('pulse', 250, Number.NaN, 320, 180);
  for (const v of Object.values(hostile)) assert.ok(Number.isFinite(v));
  // The rate clamps: 1e9 Hz behaves as MAX_HOLD_RATE exactly.
  assert.deepEqual(holdPose('sway', 333, 1e9, 320, 180), holdPose('sway', 333, MAX_HOLD_RATE, 320, 180));
  assert.deepEqual(holdPose('sway', 333, 0, 320, 180), holdPose('sway', 333, MIN_HOLD_RATE, 320, 180));
  assert.ok(isHoldFx('bob'));
  assert.ok(!isHoldFx('valueOf'), 'prototype keys are not hold kinds');
});

test('flicker only dips alpha (never past its floor); bob scales with the box height', () => {
  for (let ms = 0; ms <= 2000; ms += 50) {
    const a = holdPose('flicker', ms, 2, 320, 180).alpha;
    assert.ok(a >= 0.7 - 1e-9 && a <= 1 + 1e-9, `alpha in range at ${ms}ms: ${a}`);
  }
  const small = holdPose('bob', 250, 1, 100, 40).dy;
  const big = holdPose('bob', 250, 1, 100, 400).dy;
  assert.ok(Math.abs(big) > Math.abs(small), 'a taller box bobs further');
});

test('withHold composes: displacements add, factors multiply, alpha stays clamped', () => {
  const off = { dx: 10, dy: -20, sc: 0.8, alpha: 0.5, rot: 5 };
  const hold = { dx: 0, dy: 6, sc: 1.04, alpha: 0.9, rot: -2 };
  assert.deepEqual(withHold(off, hold), { dx: 10, dy: -14, sc: 0.8 * 1.04, alpha: 0.45, rot: 3 });
  const rest = { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 };
  assert.deepEqual(withHold(off, rest), off, 'a rest hold is the identity');
});
