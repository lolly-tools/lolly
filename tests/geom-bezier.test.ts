// SPDX-License-Identifier: MPL-2.0
/**
 * `nearestOnCubic` - closest point on a cubic to an arbitrary point.
 *
 * ## Why this has a file of its own
 *
 * It is not a leaf utility. It is the probe `offset.ts` uses to decide which contours of an
 * offset are material at all, the probe `stroke.ts` uses to decide which contours bound
 * paint, the way `boolean.ts` locates the ends of a shared run, and the editor's hit test.
 * A wrong answer here does not blur a result, it deletes or invents whole shapes.
 *
 * It also shipped wrong, in a way its tests could not see. The implementation sampled a
 * grid of `samples` parameters, took the best one and Newton-refined from there - which
 * picks a BASIN. On a curve whose branches pass close to one another it refined the wrong
 * basin and returned the grid's answer looking fully converged: on
 * `[158.5518,54.1091, 110.9633,109.922, 83.2758,14.6683, 117.2366,72.005]` at
 * (115.0318, 68.3539) it reported 4.287e-1 at 24 samples and STILL 4.287e-1 at 200, against
 * a true 5.140e-6. Wrong by a factor of 83,000, stable across an order of magnitude of
 * refinement, and with no signal of failure.
 *
 * ## How these are checked
 *
 * Three oracles, and the third is the one whose absence let the defect live:
 *
 * 1. **Definitional** - the returned `t` is in [0,1], the returned point is `evalCubic` at
 *    that `t` exactly, and the returned distance is the distance between that point and the
 *    query. A result that fails these is not a wrong answer, it is an incoherent one.
 * 2. **Analytic** - cases with a known closed-form answer: a point on the curve, a point
 *    off an endpoint, a straight cubic, a query at a control point.
 * 3. **Randomised, against an independent slow oracle** - thousands of (curve, point) pairs
 *    including self-intersecting, near-cusp and degenerate curves, each answered separately
 *    by bracketing the squared distance on a dense grid and golden-section-refining EVERY
 *    local minimum. That oracle picks no basin, so it cannot make the mistake under test,
 *    and it is the same construction `tests/geom-fit.test.ts` uses for its own measurements.
 *
 * Every assertion about the answer's quality is stated as "no worse than the oracle", never
 * "equal to a recorded number". A recorded number is what a basin-picking search passes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Cubic, evalCubic, lineToCubic, nearestOnCubic, tangentAt,
} from '../engine/src/geom/bezier.ts';

// ── the independent oracle ────────────────────────────────────────────────────

const GOLDEN = 0.6180339887498949;

/**
 * Distance from a point to one cubic, by bracketing on a grid and then refining EVERY local
 * minimum by golden section.
 *
 * Slow and approximate, which is exactly what an oracle should be: it shares no code and no
 * idea with the implementation. Refining every local minimum rather than the best one is
 * the whole point - that is the step whose absence was the defect.
 */
function oracleDistance(c: Cubic, px: number, py: number, n = 512): number {
  const f = (t: number): number => {
    const p = evalCubic(c, t);
    return (p.x - px) ** 2 + (p.y - py) ** 2;
  };
  const vals: number[] = [];
  for (let i = 0; i <= n; i++) vals.push(f(i / n));
  let best = Infinity;
  for (let i = 0; i <= n; i++) {
    const v = vals[i]!;
    if (i > 0 && vals[i - 1]! < v) continue;
    if (i < n && vals[i + 1]! < v) continue;
    let lo = Math.max(0, (i - 1) / n), hi = Math.min(1, (i + 1) / n);
    let x1 = hi - GOLDEN * (hi - lo), x2 = lo + GOLDEN * (hi - lo);
    let f1 = f(x1), f2 = f(x2);
    for (let k = 0; k < 60; k++) {
      if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - GOLDEN * (hi - lo); f1 = f(x1); }
      else { lo = x1; x1 = x2; f1 = f2; x2 = lo + GOLDEN * (hi - lo); f2 = f(x2); }
    }
    const v2 = Math.min(f1, f2);
    if (v2 < best) best = v2;
  }
  return Math.sqrt(best);
}

/** Oracle 1: the answer has to be internally consistent before its value means anything. */
function assertCoherent(c: Cubic, px: number, py: number, label: string): { t: number; distance: number } {
  const got = nearestOnCubic(c, px, py);
  assert.ok(Number.isFinite(got.t), `${label}: t is ${got.t}`);
  assert.ok(Number.isFinite(got.distance), `${label}: distance is ${got.distance}`);
  assert.ok(Number.isFinite(got.point.x) && Number.isFinite(got.point.y), `${label}: point is not finite`);
  assert.ok(got.t >= 0 && got.t <= 1, `${label}: t = ${got.t} is outside [0,1]`);
  const at = evalCubic(c, got.t);
  assert.ok(Math.hypot(at.x - got.point.x, at.y - got.point.y) === 0,
    `${label}: returned point is not evalCubic at the returned t`);
  const d = Math.hypot(at.x - px, at.y - py);
  assert.ok(Math.abs(d - got.distance) <= 1e-9 * Math.max(1, d),
    `${label}: distance ${got.distance} does not match the returned point's ${d}`);
  return got;
}

// ── the recorded counterexample ───────────────────────────────────────────────

test('the loop-shaped counterexample: right answer, and independent of any sample count', () => {
  const loopish: Cubic = [158.5518, 54.1091, 110.9633, 109.922, 83.2758, 14.6683, 117.2366, 72.005];
  const px = 115.03178392553899, py = 68.35394304497076;

  // Brute force, no search at all, as an upper bound a correct answer must be at or under.
  let brute = Infinity;
  for (let i = 0; i <= 400000; i++) {
    const p = evalCubic(loopish, i / 400000);
    brute = Math.min(brute, (p.x - px) ** 2 + (p.y - py) ** 2);
  }
  brute = Math.sqrt(brute);

  const got = assertCoherent(loopish, px, py, 'counterexample');
  assert.ok(got.distance <= brute,
    `${got.distance.toExponential(4)} is worse than a 400k-sample scan's ${brute.toExponential(4)}`);
  assert.ok(got.distance < 6e-6,
    `expected the true ~5.14e-6, got ${got.distance.toExponential(4)} - the old basin-picking answer was 4.287e-1`);

  // The point of the fix. The old implementation reported 4.287e-1 at samples=24 AND at
  // samples=200, so a test that only checked one sample count would have looked fine at
  // 2000. The parameter is now inert, and this is the assertion that says so: every value
  // of it, including absurd ones, must give the identical answer.
  for (const n of [1, 2, 3, 24, 200, 2000, 0, -5, Number.NaN]) {
    const alt = nearestOnCubic(loopish, px, py, n);
    assert.equal(alt.t, got.t, `samples=${n} changed the parameter - it must be ignored`);
    assert.equal(alt.distance, got.distance, `samples=${n} changed the distance - it must be ignored`);
  }
});

// ── randomised, against the oracle ────────────────────────────────────────────

/** A deterministic LCG, so a failure is reproducible from the seed alone. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Curve families, chosen for the shapes that break a basin search rather than for variety.
 * A curve that passes close to itself is the trigger, so three of the six families produce
 * one deliberately.
 */
function curveFamily(kind: number, r: () => number): Cubic {
  const c = () => r() * 200 - 100;
  switch (kind) {
    case 0: return [c(), c(), c(), c(), c(), c(), c(), c()];                      // unconstrained
    case 1: {                                                                    // near-closed loop
      const x0 = c(), y0 = c();
      return [x0, y0, c(), c(), c(), c(), x0 + r() * 2 - 1, y0 + r() * 2 - 1];
    }
    case 2: {                                                                    // cusp: handles on the ends
      const x0 = c(), y0 = c(), x3 = c(), y3 = c();
      return [x0, y0, x3, y3, x0, y0, x3, y3];
    }
    case 3: {                                                                    // straight, non-monotone
      const x0 = c(), y0 = c(), dx = c(), dy = c();
      return [x0, y0, x0 + dx * 0.7, y0 + dy * 0.7, x0 + dx * 0.2, y0 + dy * 0.2, x0 + dx, y0 + dy];
    }
    case 4: {                                                                    // tight loop back to the start
      const x0 = c(), y0 = c();
      return [x0, y0, x0 + c(), y0 + c(), x0 - c(), y0 - c(), x0 + r() * 0.01, y0 + r() * 0.01];
    }
    default: {                                                                   // two branches a hair apart
      const x0 = c(), y0 = c(), a = r() * Math.PI * 2, L = 40 + r() * 120;
      const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
      const g = r() * 0.4 - 0.2;
      return [
        x0, y0,
        x0 + ux * L + nx * 60, y0 + uy * L + ny * 60,
        x0 + ux * L - nx * (60 - g), y0 + uy * L - ny * (60 - g),
        x0 + ux * 2, y0 + uy * 2,
      ];
    }
  }
}

test('randomised: never worse than the golden-section oracle, over every awkward curve family', () => {
  const r = rng(20260727);
  let worst = 0, worstAt = '';
  let cases = 0;
  for (let i = 0; i < 3600; i++) {
    const c = curveFamily(i % 6, r);
    // Three kinds of query: anywhere in the neighbourhood, exactly on the curve, and a
    // hair off the curve - the last is where a basin search is most confidently wrong,
    // because the true distance is tiny and the wrong basin's is not.
    const on = evalCubic(c, r());
    const queries: [number, number][] = [
      [r() * 300 - 150, r() * 300 - 150],
      [on.x, on.y],
      [on.x + (r() - 0.5) * 1e-5, on.y + (r() - 0.5) * 1e-5],
      [c[2]!, c[3]!],
      [c[4]!, c[5]!],
    ];
    for (const [px, py] of queries) {
      cases++;
      const got = assertCoherent(c, px, py, `family ${i % 6} case ${i}`);
      const want = oracleDistance(c, px, py);
      // The oracle brackets on a grid, so it can only ever be an upper bound. Anything
      // above it by more than rounding means a missed root, which is the whole defect.
      // Measured against the curve's own extent, because the quantity that is allowed to be
      // rounding is a length and 1e-13 means something different on a 3-unit curve and a
      // 300-unit one.
      const scale = Math.max(1, ...c.map(Math.abs));
      const excess = (got.distance - want) / scale;
      if (excess > worst) {
        worst = excess;
        worstAt = `${JSON.stringify(c)} @ (${px},${py}): got ${got.distance.toExponential(6)}, oracle ${want.toExponential(6)}`;
      }
    }
  }
  assert.ok(cases >= 18000, `expected a few thousand cases, ran ${cases}`);
  // 7.6e-10 as measured, and the worst case is a genuine conditioning limit rather than a
  // slack solver: it is the cusp family, where the quintic has a near-TRIPLE root, so double
  // precision pins the parameter to about (1e-16)^(1/3) ≈ 3e-6 however it is solved. On the
  // family that produces it the distance in question is 1.5e-7 to begin with. Every other
  // family lands at 1e-13 relative or below. The failure this guards against is 1e-1.
  assert.ok(worst <= 1e-8, `worst relative excess over the oracle was ${worst.toExponential(4)} at ${worstAt}`);
});

test('randomised: a point ON the curve comes back at distance zero, to the curve scale', () => {
  const r = rng(4242);
  let worst = 0;
  for (let i = 0; i < 1200; i++) {
    const c = curveFamily(i % 6, r);
    const t = r();
    const p = evalCubic(c, t);
    const got = assertCoherent(c, p.x, p.y, `on-curve case ${i}`);
    const scale = Math.max(1, Math.abs(c[0]!), Math.abs(c[6]!), Math.abs(c[1]!), Math.abs(c[7]!));
    worst = Math.max(worst, got.distance / scale);
  }
  // Not the PARAMETER, deliberately: a curve that passes through the same point twice has
  // two right answers and neither is more correct. The distance is the testable claim.
  assert.ok(worst <= 1e-9, `worst relative distance for a point on the curve was ${worst.toExponential(4)}`);
});

// ── endpoints, which are the answer more often than roots are ─────────────────

test('an endpoint is returned when an endpoint is the answer', () => {
  const arch: Cubic = [0, 0, 30, 40, 70, 40, 100, 0];
  // Off the start, off the end, and far below the middle where the arch curves away.
  const before = assertCoherent(arch, -500, -500, 'far before the start');
  assert.equal(before.t, 0);
  const after = assertCoherent(arch, 600, -500, 'far past the end');
  assert.equal(after.t, 1);

  // The trap this replaced: Newton from a mid-curve bracket, clamped into [0,1], strands at
  // the far END of the arch. So check the near endpoint wins on both sides, not just one.
  for (const [px, py, wantT] of [[-1, 0.5, 0], [101, 0.5, 1], [-0.001, 0, 0], [100.001, 0, 1]] as const) {
    const got = assertCoherent(arch, px, py, `endpoint case (${px},${py})`);
    assert.equal(got.t, wantT, `(${px},${py}) should answer t=${wantT}, got ${got.t}`);
  }
});

test('a query far outside the curve still lands on the nearest endpoint, not a stationary point', () => {
  const s: Cubic = [0, 0, 100, 0, 0, 100, 100, 100];
  for (const [px, py] of [[-1e6, -1e6], [1e6, 1e6], [-1e6, 1e6], [1e6, -1e6]] as const) {
    const got = assertCoherent(s, px, py, `far field (${px},${py})`);
    const want = oracleDistance(s, px, py);
    assert.ok(got.distance <= want + 1e-6 * Math.max(1, want),
      `far field: ${got.distance} vs oracle ${want}`);
  }
});

// ── degenerate curves, without a special case each ────────────────────────────

test('degenerate cubics: a point, a straight line, a cusp, and repeated controls', () => {
  const cases: Array<[string, Cubic]> = [
    ['every control point coincident', [7, 9, 7, 9, 7, 9, 7, 9]],
    ['both handles on the start point', [0, 0, 0, 0, 0, 0, 100, 0]],
    ['both handles on the end point', [0, 0, 100, 0, 100, 0, 100, 0]],
    ['handles swapped end for end: a cusp', [0, 0, 100, 0, 0, 0, 100, 0]],
    ['exactly straight, evenly parameterised', lineToCubic(0, 0, 100, 50)],
    ['exactly straight, non-monotone', [0, 0, 70, 0, 20, 0, 100, 0]],
    ['a quadratic dressed as a cubic', [0, 0, 100 / 3, 200 / 3, 200 / 3, 200 / 3, 100, 0]],
    ['zero-length with stray handles', [5, 5, 40, -20, -30, 60, 5, 5]],
  ];
  for (const [label, c] of cases) {
    for (const [px, py] of [[0, 0], [50, 25], [-40, 90], [7, 9], [1e5, -1e5]] as const) {
      const got = assertCoherent(c, px, py, `${label} @ (${px},${py})`);
      const want = oracleDistance(c, px, py);
      assert.ok(got.distance <= want + 1e-7 * Math.max(1, want),
        `${label} @ (${px},${py}): ${got.distance} vs oracle ${want}`);
    }
  }
});

test('a query at the cusp of a cusped cubic answers the cusp', () => {
  // Handles crossed, so the curve runs out to x=100·(something) and comes back through a
  // point where the tangent vanishes. At a cusp the squared-distance derivative has a
  // double root, which a sign-change bracket alone cannot see - the critical points have to
  // be candidates in their own right, and this is the case that says they are.
  const cusped: Cubic = [0, 0, 100, 0, 0, 0, 100, 0];
  let cuspT = 0;
  for (let i = 0; i <= 100000; i++) {
    const t = i / 100000;
    const d = tangentAt(cusped, t);
    if (Math.hypot(d.x, d.y) < Math.hypot(tangentAt(cusped, cuspT).x, tangentAt(cusped, cuspT).y)) cuspT = t;
  }
  const cusp = evalCubic(cusped, cuspT);
  const got = assertCoherent(cusped, cusp.x, cusp.y, 'query at the cusp');
  assert.ok(got.distance < 1e-6, `distance at the cusp was ${got.distance.toExponential(4)}`);
});

test('a curve that touches the query point tangentially is not missed', () => {
  // A symmetric arch and a point on its apex: the squared distance has a minimum there
  // with a vanishing first AND second derivative contribution, so the quintic has a root
  // of even multiplicity. Bracketing by sign change cannot see it.
  const arch: Cubic = [0, 0, 25, 75, 75, 75, 100, 0];
  const apex = evalCubic(arch, 0.5);
  for (const dy of [0, 1e-12, 1e-9, 1e-6, 1e-3]) {
    const got = assertCoherent(arch, apex.x, apex.y + dy, `tangential contact +${dy}`);
    assert.ok(got.distance <= dy + 1e-9,
      `apex offset by ${dy} answered ${got.distance.toExponential(4)}`);
  }
});

// ── the property offset.ts and stroke.ts actually rely on ─────────────────────

test('the probe never over-reports, which is what the retain tests depend on', () => {
  // `isOffsetMaterial` and `keptContours` both compare this distance against |distance| or
  // r with no tolerance beyond a rounding guard. An over-report deletes material that
  // belongs in the output; an under-report keeps a fold that does not. So the property is
  // two-sided, and the only way to state it is against an independent measurement.
  const r = rng(99991);
  let overs = 0, unders = 0, worstOver = 0, worstUnder = 0;
  for (let i = 0; i < 1500; i++) {
    const c = curveFamily(i % 6, r);
    const px = r() * 300 - 150, py = r() * 300 - 150;
    const got = nearestOnCubic(c, px, py).distance;
    const want = oracleDistance(c, px, py);
    const rel = (got - want) / Math.max(1e-6, want);
    if (rel > 1e-9) { overs++; worstOver = Math.max(worstOver, rel); }
    // Under-reporting below the oracle is expected and correct - the oracle brackets on a
    // grid and cannot beat its own resolution - but only by rounding, never by a margin.
    if (rel < -1e-6) { unders++; worstUnder = Math.min(worstUnder, rel); }
  }
  assert.equal(overs, 0, `${overs} over-reports, worst relative ${worstOver.toExponential(3)}`);
  assert.equal(unders, 0, `${unders} results below the oracle by more than rounding, worst ${worstUnder.toExponential(3)}`);
});
