// SPDX-License-Identifier: MPL-2.0
/**
 * The cubic Bézier kernel and intersector (engine/src/geom/).
 *
 * ## How these are checked
 *
 * Three oracles, in order of strength:
 *
 * 1. **Analytic** — cases whose answer is known in closed form (a line through a
 *    symmetric arch, a circle-ish curve against its own axis). Exact expected values.
 * 2. **Residual** — every reported intersection must satisfy the defining property:
 *    evaluating BOTH curves at their reported parameters must give the same point, to
 *    near machine precision. This catches a plausible-looking answer that is merely
 *    close, which is the failure mode a flattening implementation has by construction.
 * 3. **Dense flattening** — an independent brute-force count, by chopping both curves
 *    into thousands of segments. Deliberately the thing this module refuses to do
 *    internally; as an ORACLE it is fine, because a slow approximate reference is
 *    exactly what you want to check a fast exact one against.
 *
 * The residual check is the one that matters. A subdivision-based intersector that
 * stops at a box size of 1e-3 passes a "did you find 2 intersections" test and fails
 * this one.
 *
 * ## Straight is not the same as evenly parameterised
 *
 * The residual oracle above was present, correct, and still missed the worst defect this
 * module has had: the exact line paths returned a fraction along the CHORD where a curve
 * parameter was required, and every reported point was on the line but tens of units from
 * the curve at the parameter reported for it. It missed because every straight fixture in
 * this file was built with `lineToCubic`, which spaces the controls evenly — and for that
 * one family the chord fraction IS the parameter, so the two quantities the code confused
 * were numerically identical in every test.
 *
 * A cubic can be geometrically straight and grossly non-uniformly parameterised, and that
 * is ordinary authored SVG: `M0,0 C0,0 0,0 100,0` is what a pen tool with un-dragged
 * handles emits, and its midpoint is at x=12.5. So the straight fixtures below come in
 * three parameterisations — controls bunched at the start (x = L·t³), bunched at the end
 * (x = L·(1 − (1−t)³)), and doubling back past both ends (non-monotone, so the same point
 * is passed three times) — each with a closed-form parameter to check against, and they
 * are used wherever an evenly spaced one used to be the only coverage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Cubic, evalCubic, splitCubic, subCubic, boundsCubic, extremaCubic,
  lineToCubic, flattenCubic, isLineCubic, signedAreaCubic, lengthCubic, nearestOnCubic,
} from '../engine/src/geom/bezier.ts';
import { toCubics, enforceContinuity } from '../engine/src/geom/spline.ts';
import {
  intersectCubics, intersectSegments, intersectLineCubic, cubicRoots01,
} from '../engine/src/geom/intersect.ts';

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b} (within ${eps})`);

/** Oracle 2: both curves, evaluated at the reported parameters, must agree. */
function assertOnBothCurves(c1: Cubic, c2: Cubic, hits: { t1: number; t2: number; x: number; y: number }[], eps = 1e-6) {
  for (const h of hits) {
    const p1 = evalCubic(c1, h.t1), p2 = evalCubic(c2, h.t2);
    assert.ok(Math.hypot(p1.x - p2.x, p1.y - p2.y) <= eps,
      `curves disagree at the reported parameters: (${p1.x},${p1.y}) vs (${p2.x},${p2.y})`);
    assert.ok(Math.hypot(p1.x - h.x, p1.y - h.y) <= eps,
      'the reported point is not on curve 1');
    assert.ok(h.t1 >= 0 && h.t1 <= 1 && h.t2 >= 0 && h.t2 <= 1, 'parameters must be in [0,1]');
  }
}

/** Oracle 3: brute-force count by dense flattening. Approximate; used only to check
 *  that the exact method finds the same NUMBER of crossings. */
function bruteForceCount(c1: Cubic, c2: Cubic): number {
  const a = flattenCubic(c1, 0.0005), b = flattenCubic(c2, 0.0005);
  const pts: { x: number; y: number }[] = [];
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      const h = intersectSegments(a[i - 1]!.x, a[i - 1]!.y, a[i]!.x, a[i]!.y,
                                  b[j - 1]!.x, b[j - 1]!.y, b[j]!.x, b[j]!.y);
      if (h && !pts.some((p) => Math.hypot(p.x - h.x, p.y - h.y) < 0.01)) pts.push(h);
    }
  }
  return pts.length;
}

// ── straight cubics that are NOT evenly parameterised ─────────────────────────
// Three families, all geometrically identical to the segment (x0,y0)→(x1,y1) and none of
// them uniform. Each carries the closed-form map from chord fraction `u` to its own
// parameter `t`, so a reported parameter can be checked analytically rather than only
// through the residual.

/** Controls resting on the START point: displacement u = t³. `M0,0 C0,0 0,0 100,0`. */
const bunchedStart = (x0: number, y0: number, x1: number, y1: number): Cubic =>
  [x0, y0, x0, y0, x0, y0, x1, y1];
const paramBunchedStart = (u: number) => Math.cbrt(u);

/** Controls resting on the END point: u = 1 − (1−t)³. */
const bunchedEnd = (x0: number, y0: number, x1: number, y1: number): Cubic =>
  [x0, y0, x1, y1, x1, y1, x1, y1];
const paramBunchedEnd = (u: number) => 1 - Math.cbrt(1 - u);

/** Controls placed out of order along the chord (13/12 then −1/12): still exactly
 *  straight, and non-monotone — u = 4.5t³ − 6.75t² + 3.25t reverses between t = 0.4 and
 *  t = 0.596, so points near the middle are passed three times. */
const doublingBack = (x0: number, y0: number, x1: number, y1: number): Cubic => {
  const dx = x1 - x0, dy = y1 - y0;
  return [x0, y0, x0 + dx * (13 / 12), y0 + dy * (13 / 12), x0 - dx / 12, y0 - dy / 12, x1, y1];
};

/** Chord fraction of a point on a straight cubic — the quantity the exact line paths
 *  compute internally, and the one that must NOT be handed back as a parameter. */
function chordFraction(c: Cubic, x: number, y: number): number {
  const dx = c[6] - c[0], dy = c[7] - c[1];
  return ((x - c[0]) * dx + (y - c[1]) * dy) / (dx * dx + dy * dy);
}

/** The property behind the whole family: for every reported hit, the parameter must
 *  reproduce the reported point ON ITS OWN CURVE. Tighter than `assertOnBothCurves`'s
 *  default because both curves here are straight, so the exact algebraic paths run and
 *  there is no iteration tolerance to allow for. */
function assertParamsAreParams(c1: Cubic, c2: Cubic, hits: { t1: number; t2: number; x: number; y: number }[], eps = 1e-9) {
  for (const h of hits) {
    const p1 = evalCubic(c1, h.t1), p2 = evalCubic(c2, h.t2);
    assert.ok(Math.hypot(p1.x - h.x, p1.y - h.y) <= eps,
      `t1=${h.t1} names (${p1.x},${p1.y}) on curve 1, not the reported (${h.x},${h.y})`);
    assert.ok(Math.hypot(p2.x - h.x, p2.y - h.y) <= eps,
      `t2=${h.t2} names (${p2.x},${p2.y}) on curve 2, not the reported (${h.x},${h.y})`);
  }
}

// ── kernel ────────────────────────────────────────────────────────────────────

test('evalCubic hits the endpoints exactly', () => {
  const c: Cubic = [10, 20, 30, 0, 70, 100, 90, 40];
  assert.deepEqual(evalCubic(c, 0), { x: 10, y: 20 });
  assert.deepEqual(evalCubic(c, 1), { x: 90, y: 40 });
});

test('splitCubic reproduces the original on both halves', () => {
  const c: Cubic = [0, 0, 10, 80, 90, -40, 100, 30];
  const [a, b] = splitCubic(c, 0.37);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const left = evalCubic(a, t), whole = evalCubic(c, t * 0.37);
    near(left.x, whole.x, 1e-9); near(left.y, whole.y, 1e-9);
    const right = evalCubic(b, t), whole2 = evalCubic(c, 0.37 + t * 0.63);
    near(right.x, whole2.x, 1e-9); near(right.y, whole2.y, 1e-9);
  }
});

test('subCubic is the original restricted to a range', () => {
  const c: Cubic = [0, 0, 20, 90, 80, -30, 100, 50];
  const s = subCubic(c, 0.25, 0.8);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const a = evalCubic(s, t), b = evalCubic(c, 0.25 + t * 0.55);
    near(a.x, b.x, 1e-9); near(a.y, b.y, 1e-9);
  }
  // Reversed range is the same piece, not an empty one.
  const r = subCubic(c, 0.8, 0.25);
  near(evalCubic(r, 0).x, evalCubic(s, 0).x, 1e-9);
});

test('boundsCubic is TIGHT, not the control hull', () => {
  // Controls fly to y=300; the curve itself only reaches 3/4 of the way up.
  const c: Cubic = [0, 0, 0, 300, 100, 300, 100, 0];
  const b = boundsCubic(c);
  near(b.x0, 0, 1e-9); near(b.x1, 100, 1e-9); near(b.y0, 0, 1e-9);
  near(b.y1, 225, 1e-9);   // exact for this symmetric curve: 3/4 of 300
  // Sampling can only ever be inside the reported box.
  for (let i = 0; i <= 200; i++) {
    const p = evalCubic(c, i / 200);
    assert.ok(p.y <= b.y1 + 1e-9 && p.y >= b.y0 - 1e-9, `sample escaped the box at t=${i / 200}`);
  }
});

test('extremaCubic finds the turning point of a symmetric arch', () => {
  const c: Cubic = [0, 0, 0, 300, 100, 300, 100, 0];
  const ts = extremaCubic(c);
  assert.ok(ts.some((t) => Math.abs(t - 0.5) < 1e-9), `expected an extremum at 0.5, got ${ts}`);
});

test('lineToCubic is recognised as a line, and a real curve is not', () => {
  assert.equal(isLineCubic(lineToCubic(3, 4, 90, 120)), true);
  assert.equal(isLineCubic([0, 0, 10, 40, 90, 40, 100, 0]), false);
  // A hair off straight is still a curve — the threshold must not swallow real bends.
  assert.equal(isLineCubic([0, 0, 33.333, 0.5, 66.667, 0.5, 100, 0]), false);
});

test('signedAreaCubic is exact, checked against a numeric integral', () => {
  // Green's theorem in closed form. The oracle is the same integral computed
  // numerically over the SAME curve — comparing against a true circle instead would
  // be measuring the Bezier approximation of the circle (2.2e-4 here), not the
  // formula, and that mistake makes an exact formula look broken.
  const k = 0.5522847498307936;
  const q: Cubic = [1, 0, 1, k, k, 1, 0, 1];
  let numeric = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) {
    const a = evalCubic(q, i / N), b2 = evalCubic(q, (i + 1) / N);
    numeric += ((a.x + b2.x) / 2) * (b2.y - a.y);
  }
  numeric += ((0 + 1) / 2) * (0 - 1);            // the chord closing the loop
  near(Math.abs(signedAreaCubic(q)), Math.abs(numeric), 1e-9);
  // And it IS close to a true quarter-circle segment, just not equal to it.
  near(Math.abs(signedAreaCubic(q)), Math.PI / 4 - 0.5, 3e-4);
});

test('signedAreaCubic flips sign with direction — the orientation test callers need', () => {
  const c: Cubic = [0, 0, 30, 60, 70, 60, 100, 0];
  const reversed: Cubic = [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];
  near(signedAreaCubic(c), -signedAreaCubic(reversed), 1e-12);
  assert.ok(Math.abs(signedAreaCubic(c)) > 1, 'the fixture should enclose real area');
});

test('lengthCubic matches a straight line exactly, and a quarter-circle closely', () => {
  near(lengthCubic(lineToCubic(0, 0, 30, 40)), 50, 1e-6);
  const k = 0.5522847498307936;
  near(lengthCubic([1, 0, 1, k, k, 1, 0, 1], 1e-4), Math.PI / 2, 1e-3);
});

// ── root solver ───────────────────────────────────────────────────────────────

test('cubicRoots01: three distinct real roots', () => {
  // (t-0.2)(t-0.5)(t-0.9) = t^3 - 1.6t^2 + 0.73t - 0.09
  const r = cubicRoots01(1, -1.6, 0.73, -0.09);
  assert.equal(r.length, 3);
  near(r[0]!, 0.2, 1e-9); near(r[1]!, 0.5, 1e-9); near(r[2]!, 0.9, 1e-9);
});

test('cubicRoots01: a double root is not reported twice', () => {
  // (t-0.4)^2 (t-0.8)
  const r = cubicRoots01(1, -1.6, 0.8, -0.128);
  assert.ok(r.length <= 2, `expected at most 2 distinct roots, got ${r}`);
  assert.ok(r.some((t) => Math.abs(t - 0.4) < 1e-5), `0.4 missing from ${r}`);
  assert.ok(r.some((t) => Math.abs(t - 0.8) < 1e-5), `0.8 missing from ${r}`);
});

test('cubicRoots01: roots outside [0,1] are excluded', () => {
  // (t+1)(t-2)(t-0.5)
  assert.deepEqual(cubicRoots01(1, -1.5, -1.5, 1).map((t) => Math.round(t * 1e6) / 1e6), [0.5]);
});

test('cubicRoots01: degenerate leading coefficients degrade gracefully', () => {
  near(cubicRoots01(0, 1, -0.7, 0.1)[0]!, 0.2, 1e-9);   // quadratic
  near(cubicRoots01(0, 0, 2, -1)[0]!, 0.5, 1e-12);       // linear
  assert.deepEqual(cubicRoots01(0, 0, 0, 5), []);        // no equation at all
});

// ── intersections ─────────────────────────────────────────────────────────────

test('line × line: the obvious crossing, and the parallel non-crossing', () => {
  const hit = intersectSegments(0, 0, 10, 10, 0, 10, 10, 0);
  assert.ok(hit); near(hit.x, 5, 1e-12); near(hit.y, 5, 1e-12);
  near(hit.t1, 0.5, 1e-12); near(hit.t2, 0.5, 1e-12);
  assert.equal(intersectSegments(0, 0, 10, 0, 0, 5, 10, 5), null);
  // Crossing the infinite lines but not the segments.
  assert.equal(intersectSegments(0, 0, 1, 1, 5, 6, 6, 5), null);
});

test('line × line: a straight cubic reports its OWN parameter, not a chord fraction', () => {
  // The defect this whole family exists for. `M0,0 C0,0 0,0 100,0` is straight and its
  // displacement is x = 100·t³, so the crossing at x=50 is at t = cbrt(0.5) = 0.79370…,
  // NOT at the chord fraction 0.5. Reporting 0.5 puts the named point at x=12.5 — a
  // residual of 37.5 against a point the caller was told was on the curve, and every
  // consumer splits with `subCubic(c, t)`, so the split lands 37.5 units out of place.
  const c1 = bunchedStart(0, 0, 100, 0);
  const c2 = lineToCubic(50, -10, 50, 10);
  const hits = intersectCubics(c1, c2);
  assert.equal(hits.length, 1, `expected one crossing, got ${hits.length}`);
  const h = hits[0]!;
  near(h.x, 50, 1e-9); near(h.y, 0, 1e-9);
  near(h.t1, Math.cbrt(0.5), 1e-9);
  near(h.t1, 0.7937005259840998, 1e-9);
  // Stated as a residual too, because that is the form the guard has to hold in for
  // fixtures with no closed form: zero, where the chord fraction would give 37.5.
  const at = evalCubic(c1, h.t1);
  assert.ok(Math.hypot(at.x - h.x, at.y - h.y) <= 1e-9,
    `the reported parameter names (${at.x},${at.y}), not (${h.x},${h.y})`);
  assert.ok(Math.abs(h.t1 - chordFraction(c1, h.x, h.y)) > 0.29,
    'the fixture must discriminate: here the chord fraction and the parameter differ by 0.29');
  // The straight partner is uniform, so its own parameter and chord fraction agree.
  near(h.t2, 0.5, 1e-9);
});

test('line × line: non-uniform on either side, and on both at once', () => {
  // Every combination of the three parameterisations against each other, crossing at a
  // point whose chord fractions are known, so each reported parameter has a closed form.
  const cases = [
    { a: bunchedStart(0, 0, 100, 0), ua: 0.5, ta: paramBunchedStart(0.5) },
    { a: bunchedEnd(0, 0, 100, 0), ua: 0.5, ta: paramBunchedEnd(0.5) },
    { a: lineToCubic(0, 0, 100, 0), ua: 0.5, ta: 0.5 },
  ];
  const partners = [
    { b: bunchedStart(50, -20, 50, 20), ub: 0.5, tb: paramBunchedStart(0.5) },
    { b: bunchedEnd(50, -20, 50, 20), ub: 0.5, tb: paramBunchedEnd(0.5) },
    { b: lineToCubic(50, -20, 50, 20), ub: 0.5, tb: 0.5 },
  ];
  for (const { a, ta } of cases) {
    for (const { b, tb } of partners) {
      const hits = intersectCubics(a, b);
      assert.equal(hits.length, 1, 'one crossing per pair');
      const h = hits[0]!;
      near(h.x, 50, 1e-9); near(h.y, 0, 1e-9);
      near(h.t1, ta, 1e-9); near(h.t2, tb, 1e-9);
      assertParamsAreParams(a, b, hits);
      // And the split a boolean would take from it lands in the same place on both.
      const e1 = splitCubic(a, h.t1)[0], e2 = splitCubic(b, h.t2)[0];
      assert.ok(Math.hypot(e1[6] - e2[6], e1[7] - e2[7]) < 1e-9, 'the splits do not meet');
    }
  }
});

test('line × line: a straight cubic that doubles back is reported at the root asked for', () => {
  // Non-monotone: the segment x=50 is passed three times by this curve, but only one
  // crossing exists as a point, and whichever root is reported must be a root.
  const a = doublingBack(0, 0, 100, 0);
  const hits = intersectCubics(a, lineToCubic(50, -20, 50, 20));
  assert.ok(hits.length >= 1, 'the crossing must be found');
  assertParamsAreParams(a, lineToCubic(50, -20, 50, 20), hits);
  for (const h of hits) near(chordFraction(a, evalCubic(a, h.t1).x, evalCubic(a, h.t1).y), 0.5, 1e-9);
});

test('line × cubic: a horizontal line through a symmetric arch, analytically', () => {
  // The arch peaks at y=225 (t=0.5). A line at y=225 touches exactly once.
  const c: Cubic = [0, 0, 0, 300, 100, 300, 100, 0];
  const two = intersectLineCubic(-50, 100, 150, 100, c);
  assert.equal(two.length, 2, 'a line below the peak must cut it twice');
  assertOnBothCurves(lineToCubic(-50, 100, 150, 100), c, two);
  // Symmetry: the two hits mirror about x=50.
  near((two[0]!.x + two[1]!.x) / 2, 50, 1e-6);

  const above = intersectLineCubic(-50, 260, 150, 260, c);
  assert.equal(above.length, 0, 'a line above the peak must miss entirely');
});

test('line × cubic: the exact tangent point is found, once', () => {
  const c: Cubic = [0, 0, 0, 300, 100, 300, 100, 0];
  const hits = intersectLineCubic(-50, 225, 150, 225, c);
  assert.ok(hits.length >= 1 && hits.length <= 2, `expected a tangency, got ${hits.length}`);
  near(hits[0]!.t2, 0.5, 1e-4);
});

test('line × cubic: a non-uniform straight cubic against a real arch', () => {
  // The same arch as the analytic test above, cut by a straight cubic whose controls rest
  // on its start point. The two crossings are at x = 50 ± 25·sqrt(3)… whatever they are
  // geometrically, the point is that they come back as parameters of THIS curve: chord
  // fraction u maps to cbrt(u), which for the left crossing is 0.53 against 0.15.
  const arch: Cubic = [0, 0, 0, 300, 100, 300, 100, 0];
  for (const [what, line, toParam] of [
    ['bunched at the start', bunchedStart(-50, 100, 150, 100), paramBunchedStart],
    ['bunched at the end', bunchedEnd(-50, 100, 150, 100), paramBunchedEnd],
  ] as const) {
    const hits = intersectCubics(line, arch);
    assert.equal(hits.length, 2, `${what}: a line below the peak must cut it twice`);
    assertParamsAreParams(line, arch, hits);
    for (const h of hits) {
      near(h.t1, toParam(chordFraction(line, h.x, h.y)), 1e-9);
      near(h.y, 100, 1e-9);
    }
    // Symmetry about x=50 survives, which it cannot if the parameters are chord
    // fractions handed back unconverted: the reported POINTS would still be symmetric,
    // and the points evaluated from the reported parameters would not be.
    const p = hits.map((h) => evalCubic(line, h.t1));
    near((p[0]!.x + p[1]!.x) / 2, 50, 1e-6);
    // Reversed roles: the same crossing pair reached with the curve first.
    const back = intersectCubics(arch, line);
    assert.equal(back.length, 2, `${what}: reversed roles must find the same pair`);
    assertParamsAreParams(arch, line, back);
  }
});

test('cubic × cubic: a clean double crossing, verified on both curves', () => {
  const c1: Cubic = [0, 0, 30, 100, 70, 100, 100, 0];
  const c2: Cubic = [0, 80, 30, -20, 70, -20, 100, 80];
  const hits = intersectCubics(c1, c2);
  assert.equal(hits.length, 2, `expected 2 crossings, got ${hits.length}`);
  assertOnBothCurves(c1, c2, hits, 1e-7);
  assert.equal(bruteForceCount(c1, c2), 2, 'the brute-force oracle disagrees');
});

test('cubic × cubic: parameters are exact enough to REBUILD the split', () => {
  // The property a boolean actually depends on: splitting each curve at its reported
  // parameter must put the two new endpoints in the same place. A subdivision
  // intersector that stops at a 1e-3 box passes a count test and fails this.
  const c1: Cubic = [0, 0, 40, 120, 80, -40, 120, 60];
  const c2: Cubic = [10, 90, 60, -30, 60, 110, 110, 10];
  const hits = intersectCubics(c1, c2);
  assert.ok(hits.length > 0);
  for (const h of hits) {
    const e1 = splitCubic(c1, h.t1)[0];
    const e2 = splitCubic(c2, h.t2)[0];
    const d = Math.hypot(e1[6] - e2[6], e1[7] - e2[7]);
    assert.ok(d < 1e-6, `split endpoints ${d} apart — not clean enough to build geometry on`);
  }
});

test('cubic × cubic: an S-curve pair crossing three times', () => {
  const c1: Cubic = [0, 50, 40, -60, 60, 160, 100, 50];
  const c2: Cubic = [0, 40, 40, 150, 60, -70, 100, 60];
  const hits = intersectCubics(c1, c2);
  assert.equal(hits.length, bruteForceCount(c1, c2), 'count disagrees with the brute-force oracle');
  assertOnBothCurves(c1, c2, hits, 1e-6);
});

test('cubic × cubic: curves that miss report nothing', () => {
  assert.deepEqual(intersectCubics([0, 0, 30, 20, 70, 20, 100, 0], [0, 200, 30, 220, 70, 220, 100, 200]), []);
});

test('cubic × cubic: touching only at a shared endpoint', () => {
  // Chained curves share a point — a boolean must see exactly one, at t=1 and t=0,
  // not a cluster from both sides of the join.
  const c1: Cubic = [0, 0, 20, 40, 60, 40, 80, 0];
  const c2: Cubic = [80, 0, 100, -40, 140, -40, 160, 0];
  const hits = intersectCubics(c1, c2);
  assert.equal(hits.length, 1, `expected one shared endpoint, got ${hits.length}`);
  near(hits[0]!.x, 80, 1e-6); near(hits[0]!.y, 0, 1e-6);
});

test('cubic × cubic: a straight-looking cubic takes the exact path and still agrees', () => {
  // Collinear controls: the dispatch should treat this as a line. The answer must be
  // identical to intersecting the equivalent segment.
  const asLine = lineToCubic(0, 0, 100, 100);
  const curve: Cubic = [0, 100, 30, 0, 70, 0, 100, 100];
  const viaCubic = intersectCubics(asLine, curve);
  assert.ok(viaCubic.length >= 1);
  assertOnBothCurves(asLine, curve, viaCubic, 1e-7);
});

test('cubic × cubic: touching at a shared endpoint, with non-uniform straight neighbours', () => {
  // The chained-curve case again, but where the join is between straight cubics whose
  // controls bunch AT the shared point — the parameterisation is at its most extreme
  // exactly where the contact is, so a chord fraction of 1 or 0 happens to be right while
  // anything in between is not. Two of the four combinations put the bunching on the far
  // end instead, where the shared vertex sits at a parameter the chord fraction misses.
  // The two straights must turn a corner at the join: two COLLINEAR segments meeting end
  // to end are parallel, which is the overlap case and not this one.
  for (const [what, c1, c2] of [
    ['both bunched away from the join', bunchedEnd(0, 0, 80, 0), bunchedStart(80, 0, 160, 60)],
    ['both bunched at the join', bunchedStart(0, 0, 80, 0), bunchedEnd(80, 0, 160, 60)],
    ['doubling back into the join', doublingBack(0, 0, 80, 0), bunchedStart(80, 0, 160, 60)],
    ['a straight cubic into a real curve', bunchedStart(0, 0, 80, 0), [80, 0, 100, -40, 140, -40, 160, 0] as Cubic],
    ['a real curve into a straight cubic', [0, 0, 20, 40, 60, 40, 80, 0] as Cubic, bunchedEnd(80, 0, 160, 0)],
  ] as const) {
    const hits = intersectCubics(c1, c2);
    assert.equal(hits.length, 1, `${what}: expected one shared endpoint, got ${hits.length}`);
    const h = hits[0]!;
    near(h.x, 80, 1e-9); near(h.y, 0, 1e-9);
    near(h.t1, 1, 1e-9); near(h.t2, 0, 1e-9);
    assertParamsAreParams(c1, c2, hits);
  }
});

test('cubic × cubic: a straight-looking NON-UNIFORM cubic takes the exact path and still agrees', () => {
  // The evenly spaced version of this test is above and passed throughout the defect.
  // Collinear controls send this down the exact line path, and what that path computes is
  // a chord fraction; the answer must still be identical to the uniform curve's, since the
  // two are the same geometry.
  const curve: Cubic = [0, 100, 30, 0, 70, 0, 100, 100];
  const uniform = intersectCubics(lineToCubic(0, 0, 100, 100), curve);
  assert.ok(uniform.length >= 1);
  for (const [what, line, toParam] of [
    ['bunched at the start', bunchedStart(0, 0, 100, 100), paramBunchedStart],
    ['bunched at the end', bunchedEnd(0, 0, 100, 100), paramBunchedEnd],
  ] as const) {
    const hits = intersectCubics(line, curve);
    assert.equal(hits.length, uniform.length, `${what}: the same geometry must give the same count`);
    assertParamsAreParams(line, curve, hits, 1e-7);
    for (const [i, h] of hits.entries()) {
      // Same POINTS as the uniform curve, different parameters — and the parameters are
      // exactly the uniform ones pushed through this curve's own displacement map.
      near(h.x, uniform[i]!.x, 1e-7); near(h.y, uniform[i]!.y, 1e-7);
      near(h.t2, uniform[i]!.t2, 1e-7);
      near(h.t1, toParam(uniform[i]!.t1), 1e-7);
    }
  }
});

test('a straight cubic of ANY parameterisation reports parameters, not chord fractions', () => {
  // The property, over the whole matrix rather than the one fixture: whatever the partner
  // and whatever the parameterisation, `evalCubic(c, t)` must land on the reported point.
  // This is the guard that catches the next variant of the defect — a fourth exact path,
  // an overlap endpoint, a new dispatch — without a new closed form to derive.
  const straights: [string, Cubic][] = [
    ['bunchedStart', bunchedStart(-10, 30, 130, 30)],
    ['bunchedEnd', bunchedEnd(-10, 30, 130, 30)],
    ['doublingBack', doublingBack(-10, 30, 130, 30)],
    ['uniform', lineToCubic(-10, 30, 130, 30)],
    ['bunchedStart, diagonal', bunchedStart(-20, -20, 140, 140)],
    ['bunchedEnd, diagonal', bunchedEnd(140, 140, -20, -20)],
  ];
  const partners: [string, Cubic][] = [
    ['arch', [0, 0, 30, 100, 70, 100, 100, 0]],
    ['S-curve', [0, 50, 40, -60, 60, 160, 100, 50]],
    ['loop', [20, 0, 120, 120, -20, 120, 80, 0]],
    ['uniform line', lineToCubic(60, -50, 60, 150)],
    ['bunched line', bunchedStart(60, -50, 60, 150)],
    ['bunched line, other end', bunchedEnd(20, 120, 120, 20)],
  ];
  let total = 0;
  for (const [n1, c1] of straights) {
    for (const [n2, c2] of partners) {
      const hits = intersectCubics(c1, c2);
      total += hits.length;
      for (const h of hits) {
        const p1 = evalCubic(c1, h.t1), p2 = evalCubic(c2, h.t2);
        assert.ok(Math.hypot(p1.x - h.x, p1.y - h.y) <= 1e-7,
          `${n1} × ${n2}: t1=${h.t1} names (${p1.x},${p1.y}), reported (${h.x},${h.y})`);
        assert.ok(Math.hypot(p2.x - h.x, p2.y - h.y) <= 1e-7,
          `${n1} × ${n2}: t2=${h.t2} names (${p2.x},${p2.y}), reported (${h.x},${h.y})`);
        assert.ok(h.t1 >= 0 && h.t1 <= 1 && h.t2 >= 0 && h.t2 <= 1, `${n1} × ${n2}: parameter out of range`);
      }
    }
  }
  assert.ok(total >= 20, `the matrix must actually intersect: only ${total} hits found`);
});

test('intersections never take unbounded time on a pathological pair', () => {
  // Near-coincident curves are where a naive clipper spins: the fat line barely
  // clips, so it must fall back to bisection and terminate.
  const c1: Cubic = [0, 0, 30, 60, 70, 60, 100, 0];
  const c2: Cubic = [0, 0.00001, 30, 60.00001, 70, 60.00001, 100, 0.00001];
  const t0 = process.hrtime.bigint();
  const hits = intersectCubics(c1, c2);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 2000, `took ${ms.toFixed(0)}ms — the fallback is not terminating`);
  assert.ok(Array.isArray(hits));
});

test('a self-symmetric pair does not produce duplicate hits', () => {
  const c1: Cubic = [0, 0, 30, 100, 70, 100, 100, 0];
  const c2: Cubic = [50, -40, 20, 60, 80, 60, 50, -40];
  const hits = intersectCubics(c1, c2);
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      assert.ok(Math.hypot(hits[i]!.x - hits[j]!.x, hits[i]!.y - hits[j]!.y) > 1e-6,
        'two reported intersections are the same point');
    }
  }
});

// ── nearest point (pen-tool hit testing, snapping, offset error measurement) ───

test('nearestOnCubic finds an exact point on the curve', () => {
  const c: Cubic = [0, 0, 30, 100, 70, 100, 100, 0];
  // A point ON the curve must come back with distance ~0 at its own parameter.
  const known = evalCubic(c, 0.31);
  const got = nearestOnCubic(c, known.x, known.y);
  near(got.t, 0.31, 1e-6);
  assert.ok(got.distance < 1e-9, `distance ${got.distance} for a point on the curve`);
});

test('nearestOnCubic beats a dense sampling of the same curve', () => {
  // The property that matters: sampling only picks a basin, Newton makes it exact.
  // If refinement were broken this would be equal, not better.
  const c: Cubic = [0, 0, 10, 120, 90, -40, 100, 60];
  for (const [px, py] of [[50, 50], [-20, 10], [120, 90], [50, -30]] as const) {
    const got = nearestOnCubic(c, px, py);
    let coarse = Infinity;
    for (let i = 0; i <= 2000; i++) {
      const p = evalCubic(c, i / 2000);
      coarse = Math.min(coarse, Math.hypot(p.x - px, p.y - py));
    }
    assert.ok(got.distance <= coarse + 1e-9,
      `refined ${got.distance} is worse than a 2000-sample scan ${coarse}`);
  }
});

test('nearestOnCubic clamps to the endpoints rather than running off the curve', () => {
  const c: Cubic = [0, 0, 30, 40, 70, 40, 100, 0];
  const before = nearestOnCubic(c, -500, -500);
  assert.ok(before.t >= 0 && before.t <= 1);
  near(before.point.x, 0, 1e-6); near(before.point.y, 0, 1e-6);
});

// ── the authored-spline seam ──────────────────────────────────────────────────

test('cubic nodes lower to the handles the author placed', () => {
  const cs = toCubics({ kind: 'cubic', closed: false, nodes: [
    { x: 0, y: 0, hOutX: 20, hOutY: 30 },
    { x: 100, y: 0, hInX: -20, hInY: 30 },
  ] });
  assert.equal(cs.length, 1);
  assert.deepEqual(cs[0], [0, 0, 20, 30, 80, 30, 100, 0]);
});

test('a node with no handles gives a straight segment', () => {
  const cs = toCubics({ kind: 'cubic', closed: false, nodes: [{ x: 0, y: 0 }, { x: 90, y: 120 }] });
  assert.ok(isLineCubic(cs[0]!), 'un-dragged handles must draw a straight line');
});

test('closing a path adds the wrap-around segment, and only when closed', () => {
  const nodes = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  assert.equal(toCubics({ kind: 'line', closed: false, nodes }).length, 2);
  assert.equal(toCubics({ kind: 'line', closed: true, nodes }).length, 3);
});

test('catmull-rom passes THROUGH its nodes — that is what makes it interpolating', () => {
  const nodes = [{ x: 0, y: 0 }, { x: 40, y: 80 }, { x: 90, y: 10 }, { x: 140, y: 70 }];
  const cs = toCubics({ kind: 'catmull-rom', closed: false, nodes });
  assert.ok(cs.length >= 2);
  for (const [i, seg] of cs.entries()) {
    near(seg[0], nodes[i]!.x, 1e-9); near(seg[1], nodes[i]!.y, 1e-9);
    near(seg[6], nodes[i + 1]!.x, 1e-9); near(seg[7], nodes[i + 1]!.y, 1e-9);
  }
});

test('centripetal catmull-rom does not cusp on badly spaced points', () => {
  // Uniform (alpha 0) is known to self-intersect here; centripetal is why it defaults.
  const nodes = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 200, y: 0 }, { x: 201, y: 1 }];
  const centripetal = toCubics({ kind: 'catmull-rom', closed: false, nodes, tension: 0.5 });
  for (const seg of centripetal) {
    for (const v of seg) assert.ok(Number.isFinite(v), 'a degenerate spacing produced NaN');
  }
  // The middle segment must not double back on itself.
  const mid = centripetal[1]!;
  assert.ok(mid[2] >= mid[0] - 1e-6, 'the first control ran backwards — that is the cusp');
});

test('a b-spline does NOT pass through its control points', () => {
  const nodes = [{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }, { x: 150, y: 100 }];
  const cs = toCubics({ kind: 'bspline', closed: false, nodes });
  assert.ok(cs.length >= 1);
  assert.ok(Math.hypot(cs[0]![0] - nodes[1]!.x, cs[0]![1] - nodes[1]!.y) > 1,
    'a b-spline that touches its control points is really a catmull-rom');
});

test('spiro is declared but refuses rather than silently drawing something else', () => {
  assert.throws(() => toCubics({ kind: 'spiro', closed: false, nodes: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }),
    /not implemented/);
});

test('enforceContinuity: corner leaves the other handle alone', () => {
  const n = { x: 0, y: 0, hInX: -10, hInY: 0, hOutX: 3, hOutY: 9, continuity: 'corner' as const };
  assert.deepEqual(enforceContinuity(n, 'in'), n);
});

test('enforceContinuity: smooth keeps handles collinear, lengths independent', () => {
  const n = { x: 0, y: 0, hInX: -10, hInY: 0, hOutX: 40, hOutY: 0, continuity: 'smooth' as const };
  const out = enforceContinuity({ ...n, hInX: 0, hInY: -10 }, 'in');
  // The out handle turns to stay opposite, and keeps its own length of 40.
  near(Math.hypot(out.hOutX!, out.hOutY!), 40, 1e-9);
  const dot = (0 * out.hOutX!) + (-10 * out.hOutY!);
  assert.ok(dot < 0, 'handles must point in opposite directions');
});

test('enforceContinuity: symmetric mirrors the length too', () => {
  const n = { x: 0, y: 0, hInX: -10, hInY: 0, hOutX: 40, hOutY: 0, continuity: 'symmetric' as const };
  const out = enforceContinuity(n, 'in');
  near(Math.hypot(out.hOutX!, out.hOutY!), 10, 1e-9);
});

test('a lowered authored path feeds the geometry kernel directly', () => {
  // The seam actually working: author a curve, lower it, intersect it. Nothing in the
  // kernel knows or cares which spline type it came from.
  const a = toCubics({ kind: 'catmull-rom', closed: false,
    nodes: [{ x: 0, y: 50 }, { x: 50, y: 0 }, { x: 100, y: 50 }] });
  const b = toCubics({ kind: 'line', closed: false, nodes: [{ x: 0, y: 20 }, { x: 100, y: 20 }] });
  const hits = a.flatMap((ca) => b.flatMap((cb) => intersectCubics(ca, cb)));
  assert.ok(hits.length > 0, 'the lowered spline must intersect the line');
  for (const h of hits) assert.ok(Math.abs(h.y - 20) < 1e-6, 'a hit must lie on the horizontal line');
});
