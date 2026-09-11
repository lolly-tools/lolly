// SPDX-License-Identifier: MPL-2.0
/**
 * curve-editor.ts - pure geometry + hit-test helpers.
 *
 * The mount function is DOM-driven and verified by hand in the brand studio;
 * these tests pin the coordinate maths the drag relies on (t ⇄ x and value ⇄ y
 * must be exact inverses, or a grabbed point jumps), the hit-test region, the
 * dynamic chroma axis, and the clone/literal helpers.
 *
 * Run with: node --test "shells/web/src/**\/*.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultColorCurve, bakeCurve } from '@lolly/engine';
import type { ColorCurve } from '@lolly/engine';
import {
  PLOT, CHANNEL_RANGE, tToX, xToT, vToY, yToV, nearestPoint, chromaRange,
  cloneCurve, bakedStrip, curveLiterals,
  CHANNEL_STEP, KEY_BIG, stepPointValue, rovingIndex,
} from './curve-editor.ts';

test('tToX ⇄ xToT are exact inverses, and endpoints hit the padding', () => {
  assert.equal(tToX(0), PLOT.pad);
  assert.equal(tToX(1), PLOT.w - PLOT.pad);
  for (const t of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
    assert.ok(Math.abs(xToT(tToX(t)) - t) < 1e-9, `t=${t} round-trips through x`);
  }
  // Out-of-range t clamps (a drag can never push a point off the plot).
  assert.equal(xToT(PLOT.pad - 50), 0);
  assert.equal(xToT(PLOT.w), 1);
});

test('vToY ⇄ yToV invert, with max at the TOP of the plot', () => {
  const r = CHANNEL_RANGE.L; // 0..1
  assert.equal(vToY(r.max, r), PLOT.pad, 'max value sits at the top edge');
  assert.equal(vToY(r.min, r), PLOT.h - PLOT.pad, 'min value sits at the bottom edge');
  for (const v of [0, 0.2, 0.5, 0.8, 1]) {
    assert.ok(Math.abs(yToV(vToY(v, r), r) - v) < 1e-9, `v=${v} round-trips through y`);
  }
  // A hue range (0..360) maps just the same.
  const h = CHANNEL_RANGE.H;
  assert.ok(Math.abs(yToV(vToY(250, h), h) - 250) < 1e-6);
});

test('nearestPoint finds the closest control point within the radius, else -1', () => {
  const r = CHANNEL_RANGE.L;
  const pts = [{ t: 0, v: 0.2 }, { t: 0.5, v: 0.6 }, { t: 1, v: 0.9 }];
  // Right on the middle point.
  const mx = tToX(0.5), my = vToY(0.6, r);
  assert.equal(nearestPoint(pts, mx, my, r, 16), 1);
  // A hair off the first point (within radius).
  assert.equal(nearestPoint(pts, tToX(0) + 3, vToY(0.2, r) + 2, r, 16), 0);
  // Far from every point → miss.
  assert.equal(nearestPoint(pts, tToX(0.5), vToY(0.6, r) + 40, r, 16), -1);
  // Empty set → miss.
  assert.equal(nearestPoint([], mx, my, r, 16), -1);
});

test('chromaRange widens past 0.4 to fit a saturated curve, never clipping a stop', () => {
  const tame: ColorCurve = {
    L: { points: [] }, C: { points: [{ t: 0, v: 0.05 }, { t: 1, v: 0.3 }] }, H: { points: [] },
  };
  assert.deepEqual(chromaRange(tame), { min: 0, max: 0.4 }, 'within 0.4 → the fixed axis');
  const hot: ColorCurve = {
    L: { points: [] }, C: { points: [{ t: 0, v: 0.05 }, { t: 1, v: 0.47 }] }, H: { points: [] },
  };
  const r = chromaRange(hot);
  assert.ok(r.max >= 0.47, 'the axis grows to contain the highest chroma point');
  assert.equal(r.min, 0);
});

test('cloneCurve is a deep copy - mutating the clone never touches the source', () => {
  const src = defaultColorCurve({ l: 0.6, c: 0.12, h: 250 }, 5);
  const copy = cloneCurve(src);
  assert.deepEqual(copy, src);
  copy.L.points[0]!.v = 0.999;
  assert.notEqual(src.L.points[0]!.v, 0.999, 'source is independent');
});

test('bakedStrip equals the engine bake, and curveLiterals emit oklch() strings', () => {
  const curve = defaultColorCurve({ l: 0.6, c: 0.12, h: 250 }, 7);
  assert.deepEqual(bakedStrip(curve, 7), bakeCurve(curve, 7));
  const lits = curveLiterals(curve, 7);
  assert.equal(lits.length, 7);
  assert.ok(lits.every(s => /^oklch\(/.test(s)), 'literals are canonical oklch() strings');
});

// ── Keyboard operability - value stepping + roving focus ────────────────────────
// The mount's keydown handler is DOM-driven and verified by hand; these pin the
// pure helpers it routes through, which is what the "same value-set path as a
// drag" and "←/→ picks the adjacent index" guarantees rest on.

test('stepPointValue moves ONLY the focused point, by exactly the channel step', () => {
  const curve = defaultColorCurve({ l: 0.6, c: 0.12, h: 250 }, 5);
  const before = cloneCurve(curve);
  const i = 2;
  const r = CHANNEL_RANGE.L;
  curve.L.points[i]!.v = stepPointValue(curve.L.points[i]!.v, 'L', 1, false, r);

  assert.ok(
    Math.abs(curve.L.points[i]!.v - (before.L.points[i]!.v + CHANNEL_STEP.L)) < 1e-9,
    'the focused L point rose by exactly one L step',
  );
  curve.L.points.forEach((p, j) => {
    if (j !== i) assert.equal(p.v, before.L.points[j]!.v, `L point ${j} is untouched`);
  });
  assert.deepEqual(curve.C, before.C, 'the other channels never move');
  assert.deepEqual(curve.H, before.H);
});

test('stepPointValue: Shift multiplies the step by KEY_BIG, direction flips the sign', () => {
  const r = CHANNEL_RANGE.C;
  const v = 0.1;
  assert.ok(Math.abs(stepPointValue(v, 'C', 1, true, r) - (v + CHANNEL_STEP.C * KEY_BIG)) < 1e-9);
  assert.ok(Math.abs(stepPointValue(v, 'C', -1, false, r) - (v - CHANNEL_STEP.C)) < 1e-9);
});

test('stepPointValue clamps to the axis range - a curve point never leaves its plot', () => {
  const r = CHANNEL_RANGE.L; // 0..1
  assert.equal(stepPointValue(0.995, 'L', 1, false, r), 1, 'up clamps at max');
  assert.equal(stepPointValue(0.005, 'L', -1, false, r), 0, 'down clamps at min');
});

test('stepPointValue: hue CLAMPS on the bounded curve axis (unlike the cyclic palette nudge)', () => {
  const r = CHANNEL_RANGE.H; // 0..360
  assert.equal(stepPointValue(359, 'H', 1, false, r), 360, 'clamps to 360, does not wrap to 1');
  assert.equal(stepPointValue(1, 'H', -1, false, r), 0, 'clamps to 0, does not wrap to 359');
});

test('rovingIndex picks the adjacent point and clamps at both ends', () => {
  assert.equal(rovingIndex(3, 1, 9), 4, 'right → next');
  assert.equal(rovingIndex(3, -1, 9), 2, 'left → previous');
  assert.equal(rovingIndex(8, 1, 9), 8, 'right at the last point stays put');
  assert.equal(rovingIndex(0, -1, 9), 0, 'left at the first point stays put');
  assert.equal(rovingIndex(0, 1, 0), 0, 'an empty channel is safe');
});
