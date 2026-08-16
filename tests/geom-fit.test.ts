// SPDX-License-Identifier: MPL-2.0
/**
 * The moment-matching cubic fitter (engine/src/geom/fit.ts).
 *
 * ## How these are checked
 *
 * Four oracles, in order of strength:
 *
 * 1. **Identity** - a cubic fed in through `cubicAsSource` must come back out as the
 *    same cubic, in one segment. Moment matching pins area and x-moment, and an exact
 *    cubic satisfies both by construction, so the answer is analytic and there is no
 *    tolerance to argue about. One wrong sign anywhere in the frame rotation, the
 *    quartic, or the arm recovery breaks it.
 * 2. **Analytic invariants** - `momentIntegrals` against `signedAreaCubic` from
 *    bezier.ts, the numeric quadrature against the closed form, and additivity of the
 *    underlying path integrals across a split. Independent of the fit entirely.
 * 3. **Independent distance** - a dense-bracket-plus-golden-section point-to-path
 *    distance (`pathDistance`) against dense samples of the TRUE source. Never
 *    `fitError`: the module's own metric samples twenty points per range, so using it to
 *    check the module would be asking the implementation whether it agrees with itself.
 *    And never `nearestOnCubic` either - see `pathDistance`, which exists because that
 *    one silently returns a sample-grid answer on a curve that passes close to itself.
 *    A one-sided nearest distance is a lower bound on the Fréchet distance the fitter
 *    budgets, so exceeding `tol` here means exceeding it there.
 * 4. **Geometric cusp detection** - dense derivative sampling for a direction reversal
 *    or a vanishing speed. Distance tolerance says nothing about angle, so a fit can
 *    pass oracle 3 and still be visibly bumpy; that is the failure this file is most
 *    interested in.
 *
 * Sources that are genuinely not cubics - exact circular arcs, exact offsets built from
 * the source curve's own normal, logarithmic spirals - are constructed here rather than
 * approximated, because a fitter checked against an approximation measures the
 * approximation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Cubic, type Pt, evalCubic, tangentAt, subCubic, lineToCubic, isLineCubic,
  signedAreaCubic, nearestOnCubic,
} from '../engine/src/geom/bezier.ts';
import {
  type ParamCurveFit, cubicAsSource, quadratureMoments, fitCubicMoment, fitToCubics,
  fitError, simplifyCubics,
} from '../engine/src/geom/fit.ts';

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b} (within ${eps})`);

/** Largest control-point displacement between two cubics, as a fraction of the chord - 
 *  so the same threshold means the same thing at any coordinate scale. */
function relCoordError(want: Cubic, got: Cubic): number {
  const chord = Math.hypot(want[6] - want[0], want[7] - want[1]) || 1;
  let worst = 0;
  for (let i = 0; i < 8; i++) worst = Math.max(worst, Math.abs(want[i]! - got[i]!));
  return worst / chord;
}

/** Second derivative. bezier.ts exposes only the first, and an exact offset needs the
 *  derivative of the unit normal, which needs this. */
function accelCubic(c: Cubic, t: number): Pt {
  const mt = 1 - t;
  return {
    x: 6 * mt * (c[4] - 2 * c[2] + c[0]) + 6 * t * (c[6] - 2 * c[4] + c[2]),
    y: 6 * mt * (c[5] - 2 * c[3] + c[1]) + 6 * t * (c[7] - 2 * c[5] + c[3]),
  };
}

/** Smallest radius of curvature along a cubic. An offset further than this from the
 *  curve cusps, and a cusped source is a different test from a cusped FIT. */
function minRadiusCubic(c: Cubic, n = 2000): number {
  let r = Infinity;
  for (let i = 0; i <= n; i++) {
    const t = i / n, d1 = tangentAt(c, t), d2 = accelCubic(c, t);
    const s = Math.hypot(d1.x, d1.y);
    const k = Math.abs(d1.x * d2.y - d1.y * d2.x) / (s * s * s);
    if (k > 1e-12) r = Math.min(r, 1 / k);
  }
  return r;
}

// ── sources that have no Bézier form ──────────────────────────────────────────

/** An exact circular arc. Position and derivative are closed form; the moments are not,
 *  so it takes the quadrature fallback - which is the path an offset source takes too. */
function arcSource(r: number, a0: number, a1: number, cx = 0, cy = 0): ParamCurveFit {
  const sweep = a1 - a0;
  const sample = (t: number) => {
    const th = a0 + t * sweep;
    return {
      x: cx + r * Math.cos(th), y: cy + r * Math.sin(th),
      dx: -r * Math.sin(th) * sweep, dy: r * Math.cos(th) * sweep,
    };
  };
  return { sample, momentIntegrals: (t0, t1) => quadratureMoments(sample, t0, t1) };
}

/**
 * The exact offset of a cubic - Stage 3's actual input, and the reason the fitter exists.
 *
 * The offset point comes from the source curve's own unit normal and the offset tangent
 * from that normal's derivative, so nothing here is an approximation of an offset: it IS
 * the offset, evaluated wherever the fitter asks.
 */
function offsetSource(c: Cubic, dist: number): ParamCurveFit {
  const sample = (t: number) => {
    const p = evalCubic(c, t), d1 = tangentAt(c, t), d2 = accelCubic(c, t);
    const s = Math.hypot(d1.x, d1.y);
    const speedRate = (d1.x * d2.x + d1.y * d2.y) / s;
    // n = (y', -x')/s, so n' = ((y'', -x'')·s - (y', -x')·s') / s².
    const nx = d1.y / s, ny = -d1.x / s;
    const dnx = (d2.y * s - d1.y * speedRate) / (s * s);
    const dny = (-d2.x * s + d1.x * speedRate) / (s * s);
    return { x: p.x + dist * nx, y: p.y + dist * ny, dx: d1.x + dist * dnx, dy: d1.y + dist * dny };
  };
  return { sample, momentIntegrals: (t0, t1) => quadratureMoments(sample, t0, t1) };
}

/** A logarithmic spiral: curvature varies by orders of magnitude and there is no
 *  inflection anywhere, which is what makes it usable as a cusp fixture - any reversal
 *  of turning direction in the output came from the fit, not from the source. */
function spiralSource(a: number, b: number, th0: number, th1: number): ParamCurveFit {
  const sweep = th1 - th0;
  const sample = (t: number) => {
    const th = th0 + t * sweep, r = a * Math.exp(b * th), dr = b * r;
    return {
      x: r * Math.cos(th), y: r * Math.sin(th),
      dx: (dr * Math.cos(th) - r * Math.sin(th)) * sweep,
      dy: (dr * Math.sin(th) + r * Math.cos(th)) * sweep,
    };
  };
  return { sample, momentIntegrals: (t0, t1) => quadratureMoments(sample, t0, t1) };
}

/** Two straight runs meeting at a right angle at t=0.5. `sample(0.5)` returns the second
 *  branch, so the first range asks for a tangent at a parameter whose derivative belongs
 *  to its neighbour - the case the endpoint probe exists for. */
function cornerSource(declareBreak: boolean): ParamCurveFit {
  const sample = (t: number) => (t < 0.5
    ? { x: 200 * t, y: 0, dx: 200, dy: 0 }
    : { x: 100, y: 240 * (t - 0.5), dx: 0, dy: 240 });
  const src: ParamCurveFit = { sample, momentIntegrals: (t0, t1) => quadratureMoments(sample, t0, t1) };
  if (declareBreak) src.breaks = () => [0.5];
  return src;
}

/** A source no cubic can track: a ripple whose period is far below any span the fitter
 *  can reach within its segment budget. */
function rippleSource(freq: number): ParamCurveFit {
  const sample = (t: number) => ({
    x: 400 * t, y: 60 * Math.sin(freq * t), dx: 400, dy: 60 * freq * Math.cos(freq * t),
  });
  return { sample, momentIntegrals: (t0, t1) => quadratureMoments(sample, t0, t1) };
}

// ── oracles ───────────────────────────────────────────────────────────────────

const GOLDEN = 0.6180339887498949;

/**
 * Distance from a point to one cubic, by bracketing on a grid and then refining EVERY
 * local minimum by golden section.
 *
 * Not `nearestOnCubic`, and the difference is not academic. That one takes the single
 * best grid sample and Newton-refines from there, which picks a basin - so on a curve
 * whose two branches pass close to each other it converges inside the wrong one and
 * returns the wrong answer with no signal that it did. Measured, on the loop-shaped
 * candidate `[158.5518,54.1091, 110.9633,109.922, 83.2758,14.6683, 117.2366,72.005]` and
 * the point (115.03178392553899, 68.35394304497076): `nearestOnCubic` reports 4.287e-1 at
 * samples=24 **and still at samples=200**, against a true 5.140e-6 - five orders of
 * magnitude, and stable enough under refinement to look like a converged answer. An
 * oracle that does that turns a fitter's genuine sub-tolerance result into a fabricated
 * 22×-over-tolerance "violation", which is exactly what it did while this file was being
 * written. Refining every local minimum removes the basin choice entirely.
 */
function pointToCubic(c: Cubic, px: number, py: number, n = 96): number {
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
    for (let k = 0; k < 40; k++) {
      if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - GOLDEN * (hi - lo); f1 = f(x1); }
      else { lo = x1; x1 = x2; f1 = f2; x2 = lo + GOLDEN * (hi - lo); f2 = f(x2); }
    }
    const v2 = Math.min(f1, f2);
    if (v2 < best) best = v2;
  }
  return Math.sqrt(best);
}

/** Distance from a point to a whole polycubic path - the minimum over segments, because
 *  a source point may be nearest to a neighbouring one. */
function pathDistance(segs: Cubic[], px: number, py: number): number {
  let best = Infinity;
  for (const seg of segs) {
    const d = pointToCubic(seg, px, py);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Oracle 3: the largest distance from any point of the TRUE source to the fitted output.
 *
 * One-sided, so it is a lower bound on the Fréchet distance the fitter budgets against - 
 * which is what makes `>= tol` here a real breach rather than a metric disagreement.
 */
function denseError(src: ParamCurveFit, segs: Cubic[], n = 2000): number {
  let worst = 0;
  for (let i = 0; i <= n; i++) {
    const s = src.sample(i / n);
    const best = pathDistance(segs, s.x, s.y);
    if (best > worst) worst = best;
  }
  return worst;
}

/** A run of joined cubics as a source, parameterised uniformly across the segments - 
 *  the same construction `simplifyCubics` puts its input through, rebuilt here so the
 *  oracle can ask the input path for a point at a parameter. */
function polyPathSource(curves: Cubic[]): ParamCurveFit {
  const n = curves.length;
  const sample = (t: number) => {
    const scaled = Math.min(Math.max(t, 0), 1) * n;
    let i = Math.floor(scaled);
    if (i >= n) i = n - 1;
    const c = curves[i]!, u = scaled - i;
    const p = evalCubic(c, u), d = tangentAt(c, u);
    return { x: p.x, y: p.y, dx: d.x * n, dy: d.y * n };
  };
  return { sample, momentIntegrals: (t0, t1) => quadratureMoments(sample, t0, t1) };
}

/** Two-sided Hausdorff distance between two polycubic paths. Weaker than Fréchet, so it
 *  is a LOWER bound on what the fitter promises - a breach here is unambiguous. */
function pathHausdorff(a: Cubic[], b: Cubic[], per = 60): number {
  let worst = 0;
  for (const [from, to] of [[a, b], [b, a]] as const) {
    for (const c of from) {
      for (let i = 0; i <= per; i++) {
        const p = evalCubic(c, i / per);
        const d = pathDistance(to, p.x, p.y);
        if (d > worst) worst = d;
      }
    }
  }
  return worst;
}

/** N exact circular arcs covering `sweep`, joined G1 and each the standard 4/3·tan(θ/4)
 *  cubic. THE arc handle length is tan(θ/**4**) - tan(θ/2) is a scalloped shape that is
 *  not a circle at all, which is the trap the closed-loop tests below pin. */
function arcCircleCurves(n: number, r = 100, sweep = 2 * Math.PI): Cubic[] {
  const th = sweep / n, k = (4 / 3) * Math.tan(th / 4) * r;
  const out: Cubic[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * th, b = a + th;
    const p0 = { x: r * Math.cos(a), y: r * Math.sin(a) };
    const p3 = { x: r * Math.cos(b), y: r * Math.sin(b) };
    out.push([
      p0.x, p0.y,
      p0.x - k * Math.sin(a), p0.y + k * Math.cos(a),
      p3.x + k * Math.sin(b), p3.y - k * Math.cos(b),
      p3.x, p3.y,
    ]);
  }
  return out;
}

/**
 * Oracle 4: cusp detection by dense derivative sampling.
 *
 * `minCos` is the worst agreement between consecutive tangents - a cusp turns the
 * direction through 180°, so it reads about −1. `speedRatio` is the smallest |C'(t)|
 * relative to the chord, which a cusp drives to zero. `turnSigns` counts the distinct
 * signs of the turning, so 2 means the curve changed which way it bends.
 *
 * Midpoint sampling, and a power-of-two count, so the grid steps OVER a cusp sitting at
 * a round parameter instead of landing on it. Landing on it reads speed exactly zero,
 * skips both neighbouring comparisons, and the reversal disappears - which is how a cusp
 * fixture can quietly certify a detector that cannot see cusps.
 */
function cuspStats(c: Cubic, n = 512): { minCos: number; speedRatio: number; turnSigns: number } {
  let minCos = 1, minSpeed = Infinity;
  const signs = new Set<number>();
  const chord = Math.hypot(c[6] - c[0], c[7] - c[1]);
  let prev: Pt | null = null;
  for (let i = 0; i < n; i++) {
    const d = tangentAt(c, (i + 0.5) / n);
    const s = Math.hypot(d.x, d.y);
    if (s < minSpeed) minSpeed = s;
    if (prev) {
      const pl = Math.hypot(prev.x, prev.y);
      if (pl > 0 && s > 0) {
        minCos = Math.min(minCos, (prev.x * d.x + prev.y * d.y) / (pl * s));
        const cross = prev.x * d.y - prev.y * d.x;
        if (Math.abs(cross) > 1e-9 * pl * s) signs.add(Math.sign(cross));
      }
    }
    prev = d;
  }
  return { minCos, speedRatio: minSpeed / (chord || 1), turnSigns: signs.size };
}

/** Deterministic LCG. Random fixtures are worth more than hand-picked ones here - the
 *  quartic has four branches and a handful of curves will not visit them all - but a
 *  test that fails on a different curve each run is not a test. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function armRatios(c: Cubic): [number, number] {
  const chord = Math.hypot(c[6] - c[0], c[7] - c[1]);
  if (!(chord > 0)) return [Infinity, Infinity];
  return [
    Math.hypot(c[2] - c[0], c[3] - c[1]) / chord,
    Math.hypot(c[4] - c[6], c[5] - c[7]) / chord,
  ];
}

const FIXTURES: Cubic[] = [
  [0, 0, 0, 300, 100, 300, 100, 0],          // symmetric arch
  [0, 50, 40, -60, 60, 160, 100, 50],        // S, two inflections
  [0, 0, 10, 120, 90, -40, 100, 60],         // asymmetric
  [0, 0, 200, 100, -100, 100, 100, 0],       // a loop
  [-30, 12, 210, -80, -40, 190, 160, 140],   // long arms, controls crossed
];

// ── oracle self-checks ────────────────────────────────────────────────────────

test('the cusp detector fires on a cubic that really cusps, and not on ones that do not', () => {
  // Hodograph through the origin at t=0.5: x'(0.5)=0 needs x2 = x1 - 100, y'(0.5)=0
  // needs y2 = y1. A fit that met its distance tolerance and looked like this would be
  // the failure test 5 exists to catch, so the detector has to see it.
  const cusped: Cubic = [0, 0, 150, 80, 50, 80, 100, 0];
  const st = cuspStats(cusped);
  assert.ok(st.minCos < -0.9, `a cusp must reverse the tangent, got minCos ${st.minCos}`);
  assert.ok(st.speedRatio < 0.02, `a cusp must collapse the speed, got ${st.speedRatio}`);

  // A hair away from the cusp: no reversal, but the speed still nearly vanishes.
  const nearCusp = cuspStats([0, 0, 150, 80, 50, 82, 100, 0]);
  assert.ok(nearCusp.speedRatio < 0.02, `near-cusp speed ${nearCusp.speedRatio}`);

  // A loop is not a cusp - the detector must not conflate them, or test 5 would reject
  // perfectly good output.
  for (const c of [[0, 0, 30, 60, 70, 60, 100, 0], [0, 0, 200, 100, -100, 100, 100, 0]] as Cubic[]) {
    const s = cuspStats(c);
    assert.ok(s.minCos > 0.999, `a smooth curve read as reversing: ${s.minCos}`);
    assert.ok(s.speedRatio > 0.5, `a smooth curve read as stalling: ${s.speedRatio}`);
  }
});

test('oracle and nearestOnCubic agree on a curve that passes close to itself', () => {
  // This test used to assert the OPPOSITE of its last block: that `nearestOnCubic` was
  // wrong here by five orders of magnitude, unimproved by sampling, and therefore that the
  // suite needed its own oracle. That was true when it was written, and the counterexample
  // is what got the primitive fixed - `nearestOnCubic` now solves the quintic
  // `(C(t) - P) . C'(t) = 0` instead of picking a basin off a sample grid.
  //
  // Both halves are kept: brute force vs the refined oracle still guards the oracle the
  // simplify suite rests on (a basin-picking search would start manufacturing violations),
  // and the same point now pins the primitive's own correctness, at every sample count,
  // so a regression to grid-picking fails here rather than silently degrading offsetting's
  // morphology retain test.
  const loopish: Cubic = [158.5518, 54.1091, 110.9633, 109.922, 83.2758, 14.6683, 117.2366, 72.005];
  const px = 115.03178392553899, py = 68.35394304497076;
  // Brute force, no search at all: the answer this point actually has.
  let brute = Infinity;
  for (let i = 0; i <= 200000; i++) {
    const p = evalCubic(loopish, i / 200000);
    brute = Math.min(brute, (p.x - px) ** 2 + (p.y - py) ** 2);
  }
  brute = Math.sqrt(brute);
  assert.ok(brute < 1e-5, `brute force says ${brute.toExponential(3)}`);
  // A grid cannot beat its own resolution, so brute force is an upper bound the refined
  // oracle must be at or under - never above it, which would mean it missed the basin.
  const refined = pointToCubic(loopish, px, py);
  assert.ok(refined <= brute, `oracle ${refined.toExponential(4)} worse than brute ${brute.toExponential(4)}`);
  assert.ok(brute - refined < 1e-5, `oracle and brute force disagree: ${refined.toExponential(4)} vs ${brute.toExponential(4)}`);
  // The primitive itself, at the sample counts that used to make no difference (it reported
  // 4.287e-1 at both 24 and 200 against a true 5.14e-6). Sample-count independence is the
  // property, not just closeness: a root solve does not care, a grid search does.
  for (const n of [24, 200]) {
    const got = nearestOnCubic(loopish, px, py, n);
    assert.ok(
      Math.abs(got.distance - brute) < 1e-5,
      `nearestOnCubic(samples=${n}) says ${got.distance.toExponential(4)}, brute force ${brute.toExponential(4)}`,
    );
    // The returned address must describe the returned point, or a caller that splits at `t`
    // cuts somewhere else - the defect class that produced the chord-parameter bug.
    assert.ok(got.t >= 0 && got.t <= 1, `t out of range: ${got.t}`);
    const at = evalCubic(loopish, got.t);
    assert.ok(
      Math.hypot(at.x - got.point.x, at.y - got.point.y) < 1e-9,
      'returned point is not evalCubic(t)',
    );
  }
});

// ── 1. identity ───────────────────────────────────────────────────────────────

test('fitting a cubic to ITSELF returns that cubic, analytically', () => {
  for (const c of FIXTURES) {
    const got = fitCubicMoment(cubicAsSource(c), 0, 1);
    assert.ok(got, `refused its own exact solution for ${JSON.stringify(c)}`);
    const e = relCoordError(c, got);
    assert.ok(e < 1e-9, `identity off by ${e.toExponential(3)} of the chord for ${JSON.stringify(c)}`);
  }
});

test('identity is scale-invariant — the whole solve normalises by the chord', () => {
  for (const scale of [1, 100, 10000]) {
    for (const c of FIXTURES) {
      const s = c.map((v) => v * scale) as Cubic;
      const got = fitCubicMoment(cubicAsSource(s), 0, 1);
      assert.ok(got, `refused at scale ${scale}`);
      const e = relCoordError(s, got);
      assert.ok(e < 1e-9, `scale ${scale}: identity off by ${e.toExponential(3)} of the chord`);
    }
  }
});

test('identity holds on a SUBRANGE, against subCubic', () => {
  // The frame, the moments and the error metric are all parameterised on [t0,t1]; a
  // range that is not the whole curve is what the subdivision passes actually ask for.
  for (const c of FIXTURES) {
    for (const [a, b] of [[0.2, 0.75], [0, 0.3], [0.6, 1], [0.45, 0.55]] as const) {
      const want = subCubic(c, a, b);
      const got = fitCubicMoment(cubicAsSource(c), a, b);
      assert.ok(got, `refused subrange [${a},${b}]`);
      const e = relCoordError(want, got);
      assert.ok(e < 1e-9, `subrange [${a},${b}] off by ${e.toExponential(3)} of the chord`);
    }
  }
});

test('an exact cubic source needs exactly ONE segment', () => {
  for (const c of FIXTURES) {
    for (const optimise of [false, true]) {
      const segs = fitToCubics(cubicAsSource(c), { tol: 1e-3, optimise });
      assert.equal(segs.length, 1, `optimise=${optimise}: split a curve that is already the answer into ${segs.length}`);
      assert.ok(relCoordError(c, segs[0]!) < 1e-9, 'the single segment is not the source curve');
    }
  }
});

test('identity over 300 random cubics, at realistic arm lengths', () => {
  // Controls within one chord of their own endpoint: the shape a pen tool or an SVG
  // path produces. `fitCubicMoment` refuses arms beyond four chords by design, so
  // uniformly random control nets would be measuring the refusal, not the solve.
  const rnd = lcg(20260726);
  const errs: number[] = [];
  let refused = 0;
  for (let i = 0; i < 300; i++) {
    const ex = 100 + rnd() * 200, ey = (rnd() * 2 - 1) * 100;
    const chord = Math.hypot(ex, ey);
    const c: Cubic = [
      0, 0,
      (rnd() * 2 - 1) * chord, (rnd() * 2 - 1) * chord,
      ex + (rnd() * 2 - 1) * chord, ey + (rnd() * 2 - 1) * chord,
      ex, ey,
    ];
    const got = fitCubicMoment(cubicAsSource(c), 0, 1);
    if (!got) { refused++; continue; }
    errs.push(relCoordError(c, got));
    assert.equal(fitToCubics(cubicAsSource(c), { tol: chord * 1e-6 }).length, 1,
      `an exact cubic took more than one segment: ${JSON.stringify(c)}`);
  }
  assert.equal(refused, 0, `${refused} of 300 realistic cubics were refused outright`);
  errs.sort((a, b) => a - b);
  const median = errs[errs.length >> 1]!, max = errs[errs.length - 1]!;
  assert.ok(median < 1e-13, `median identity error ${median.toExponential(3)}`);
  assert.ok(max < 1e-9, `worst identity error ${max.toExponential(3)} of the chord`);
});

test('fitError of a curve against ITSELF is zero', () => {
  // The check that catches an arc-length correspondence built with a different
  // quadrature rule from the one the candidate's own arc length uses: the mismatch
  // offsets the pairing and puts a floor under every measured error, and nothing else
  // in this file would notice, because every error would still be small.
  const rnd = lcg(31337);
  let worst = 0;
  for (let i = 0; i < 200; i++) {
    const c = [0, 0, 0, 0, 0, 0, 0, 0] as Cubic;
    for (let j = 0; j < 8; j++) c[j] = (rnd() * 2 - 1) * 100;
    const scale = Math.max(...[2, 4, 6].map((o) => Math.hypot(c[o]! - c[0]!, c[o + 1]! - c[1]!))) || 1;
    worst = Math.max(worst, fitError(cubicAsSource(c), c, 0, 1) / scale);
  }
  assert.ok(worst < 1e-12, `a curve measured against itself reads ${worst.toExponential(3)} of its size`);
  // And on a spicy range, which is the branch that takes the arc-length metric.
  const arch: Cubic = [0, 0, 0, 300, 100, 300, 100, 0];
  near(fitError(cubicAsSource(arch), subCubic(arch, 0.1, 0.9), 0.1, 0.9), 0, 1e-9);
});

// ── 2. analytic moments ───────────────────────────────────────────────────────

/**
 * Chord length of a range - the scale both invariants are measured in.
 *
 * Residuals go against chord² for an area and chord³ for a moment, because those are the
 * units the fit consumes (`area/chord²` and `moment/chord³`). A relative threshold is
 * wrong here: the loop fixture's lobes cancel its moment to exactly zero, and dividing by
 * that quantity, or floored against 1, compares a number in units of 1e7 against 1.
 */
function rangeChord(src: ParamCurveFit, t0: number, t1: number): number {
  const a = src.sample(t0), b = src.sample(t1);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

test('momentIntegrals.area IS signedAreaCubic of the same piece', () => {
  // The free cross-check the module documents. It catches every sign in the raw
  // integrals and the chord subtraction, and an offset source cannot use it, so it has
  // to be spent here.
  for (const c of FIXTURES) {
    const src = cubicAsSource(c);
    for (const [t0, t1] of [[0, 1], [0, 0.4], [0.3, 0.9], [0.5, 1], [0.62, 0.63]] as const) {
      const piece = subCubic(c, t0, t1);
      const want = signedAreaCubic(piece);
      const got = src.momentIntegrals(t0, t1).area;
      const chord = rangeChord(src, t0, t1);
      assert.ok(Math.abs(got - want) < 1e-11 * chord * chord,
        `area over [${t0},${t1}] ${got} vs signedAreaCubic ${want}`);
    }
  }
});

test('the quadrature fallback agrees with the closed form to rounding', () => {
  // 16-point Gauss-Legendre is exact to degree 31 and a cubic's moment integrands are
  // degree 8, so for a cubic source the "numeric" path is not an approximation at all.
  // That is what licenses using it for sources whose integrals have no closed form.
  for (const c of FIXTURES) {
    const src = cubicAsSource(c);
    for (const [t0, t1] of [[0, 1], [0.2, 0.85], [0, 0.11], [0.7, 1]] as const) {
      const exact = src.momentIntegrals(t0, t1);
      const quad = quadratureMoments((t) => src.sample(t), t0, t1);
      const chord = rangeChord(src, t0, t1);
      assert.ok(Math.abs(quad.area - exact.area) < 1e-10 * chord * chord,
        `quadrature area ${quad.area} vs analytic ${exact.area}`);
      assert.ok(Math.abs(quad.moment - exact.moment) < 1e-10 * chord ** 3,
        `quadrature moment ${quad.moment} vs analytic ${exact.moment}`);
    }
  }
});

test('area is additive across a split, once the closing chords are accounted for', () => {
  // The naive form - area(0,1) = area(0,a) + area(a,1) - is FALSE, and has to be: each
  // range closes its own region with its own chord, so the whole-curve region also
  // contains the triangle on the three points. Asserting the naive form instead would
  // demand the module abandon the chord frame its callers consume.
  const chordIntegral = (s: Pt, e: Pt) => (e.x - s.x) * (s.y + e.y) / 2;
  for (const c of FIXTURES) {
    const src = cubicAsSource(c);
    for (const a of [0.37, 0.5, 0.05, 0.94]) {
      const p0 = evalCubic(c, 0), pa = evalCubic(c, a), p1 = evalCubic(c, 1);
      const triangle = chordIntegral(p0, pa) + chordIntegral(pa, p1) - chordIntegral(p0, p1);
      const whole = src.momentIntegrals(0, 1).area;
      const parts = src.momentIntegrals(0, a).area + src.momentIntegrals(a, 1).area;
      const chord = rangeChord(src, 0, 1);
      assert.ok(Math.abs(whole - parts - triangle) < 1e-11 * chord * chord,
        `split at ${a}: whole ${whole}, parts ${parts}, triangle ${triangle}`);
    }
  }
});

test('the first moment is additive too, on a fixture where the frames line up', () => {
  // `moment` is a projection onto the chord direction, so it is only recoverable back to
  // the raw path integral when the chord does not rotate. This S passes through (0,0),
  // (50,0) and (100,0), so all three ranges share the +x chord direction AND have y=0 at
  // both ends, which zeroes every chord correction: `area` is then the raw ∫y dx and
  // `moment` the raw ∫xy dx shifted to the start point. Both raw integrals are path
  // integrals and must add exactly.
  const s: Cubic = [0, 0, 100 / 3, 100, 200 / 3, -100, 100, 0];
  const mid = evalCubic(s, 0.5);
  near(mid.x, 50, 1e-12); near(mid.y, 0, 1e-12);

  const src = cubicAsSource(s);
  const rawXY = (t0: number, t1: number) => {
    const m = src.momentIntegrals(t0, t1);
    return m.moment + evalCubic(s, t0).x * m.area;
  };
  const area = (t0: number, t1: number) => src.momentIntegrals(t0, t1).area;

  near(area(0, 1), area(0, 0.5) + area(0.5, 1), 1e-9);
  const whole = rawXY(0, 1);
  assert.ok(Math.abs(whole - (rawXY(0, 0.5) + rawXY(0.5, 1))) < 1e-11 * Math.abs(whole),
    `∫xy dx does not add across the split: ${whole} vs ${rawXY(0, 0.5) + rawXY(0.5, 1)}`);
  assert.ok(Math.abs(whole) > 1, 'the fixture must have a moment worth adding');
});

// ── 3. convergence on sources that are not cubics ─────────────────────────────

const CONVERGENCE_TOLS = [0.15, 0.05, 0.01, 0.001];

/** A curve whose offset stays cusp-free: 20 units is half its smallest radius of
 *  curvature, so the offset is a smooth curve and any cusp in the output is the fit's. */
const OFFSET_BASE: Cubic = [0, 0, 60, 200, 200, -80, 260, 60];

const CONVERGENCE_CASES: [string, ParamCurveFit][] = [
  ['a 150° circular arc, r=100', arcSource(100, 0.3, 0.3 + (150 * Math.PI) / 180)],
  ['the exact +20 offset of a cubic', offsetSource(OFFSET_BASE, 20)],
  ['the exact -20 offset of a cubic', offsetSource(OFFSET_BASE, -20)],
];

test('the offset fixture is genuinely smooth — a cusped source would be a different test', () => {
  const r = minRadiusCubic(OFFSET_BASE);
  assert.ok(r > 20 * 2, `offsetting by 20 needs a radius of curvature well over 20, got ${r.toFixed(2)}`);
  for (const dist of [20, -20]) {
    const src = offsetSource(OFFSET_BASE, dist);
    for (let i = 0; i <= 400; i++) {
      const s = src.sample(i / 400);
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), 'the offset source itself is not finite');
      assert.ok(Math.hypot(s.dx, s.dy) > 1e-6, `the offset source cusps at t=${i / 400}`);
    }
    // The analytic derivative is what the fit reads end tangents from; a wrong one would
    // quietly bias every fit and nothing else here would say so.
    for (let i = 1; i < 20; i++) {
      const t = i / 20, h = 1e-6;
      const a = src.sample(t - h), b = src.sample(t + h), m = src.sample(t);
      const fdx = (b.x - a.x) / (2 * h), fdy = (b.y - a.y) / (2 * h);
      assert.ok(Math.hypot(fdx - m.dx, fdy - m.dy) < 1e-6 * Math.hypot(m.dx, m.dy),
        `the offset source's analytic derivative disagrees with a finite difference at t=${t}`);
    }
  }
});

for (const [name, src] of CONVERGENCE_CASES) {
  /**
   * A regression guard on the defect that made this red when it was written, because the
   * same pattern recurs: `curveDist` took the max over twenty fixed interior samples, and a
   * max over a fixed grid bounds nothing - the peak is exactly what falls between samples.
   * On the +20 offset at tol=1e-3 the true peak sat at grid index 10.49, so the metric read
   * 9.93894e-4 against a real 1.01440e-3 and accepted a range that missed the budget by
   * 2.06%. Every accepted range under-reported, by 0.5% to 2%.
   *
   * The grid now only brackets; each local maximum is refined by golden section on the real
   * error function. Every local maximum, not just the largest sample, because the largest
   * sample need not sit on the largest lobe.
   *
   * Measuring achieved error INDEPENDENTLY here is what made that visible: the fitter
   * believed it had met the tolerance, so any assertion phrased in terms of the fitter's own
   * error metric would have agreed with it and passed.
   */
  test(`${name}: the achieved error is within tolerance, measured independently`, () => {
    const over: string[] = [];
    for (const tol of CONVERGENCE_TOLS) {
      const segs = fitToCubics(src, { tol });
      assert.ok(segs.length > 0, 'no output at all');
      const err = denseError(src, segs);
      if (err > tol) over.push(`tol=${tol}: ${err.toExponential(4)} (${(err / tol).toFixed(4)}× the budget, ${segs.length} segments)`);
    }
    assert.deepEqual(over, [], `the fit exceeds the tolerance it was given — ${over.join('; ')}`);
  });

  test(`${name}: the segment count grows far more slowly than 1/tol`, (t) => {
    const counts = CONVERGENCE_TOLS.map((tol) => fitToCubics(src, { tol }).length);
    const span = CONVERGENCE_TOLS[0]! / CONVERGENCE_TOLS[3]!;   // 150× tighter
    const growth = counts[3]! / counts[0]!;
    // n ∝ tol^(-1/p): p=1 is the linear cost of chopping into lines, p=2 is a
    // Tiller-Hanson construction, p=4 a least-squares fit, p=6 the claim here.
    const order = growth > 1 ? Math.log(span) / Math.log(growth) : Infinity;
    t.diagnostic(`${name}: segments ${counts.join(', ')} over tol ${CONVERGENCE_TOLS.join(', ')} → ×${growth.toFixed(2)} for ×${span} tolerance, order ${order.toFixed(2)}`);
    for (let i = 1; i < counts.length; i++) {
      assert.ok(counts[i]! >= counts[i - 1]!, `a tighter tolerance used FEWER segments: ${counts.join(',')}`);
    }
    assert.ok(growth < span / 10, `${growth.toFixed(2)}× the segments for ${span}× the tolerance is not high-order convergence`);
    assert.ok(order >= 4, `implied convergence order ${order.toFixed(2)} from counts ${counts.join(',')}`);
  });
}

test('output segments chain end to start, with no gap to leave a hole in a contour', () => {
  for (const [, src] of CONVERGENCE_CASES) {
    for (const tol of [0.15, 0.01]) {
      const segs = fitToCubics(src, { tol });
      for (let i = 1; i < segs.length; i++) {
        near(segs[i]![0], segs[i - 1]![6], 0);
        near(segs[i]![1], segs[i - 1]![7], 0);
      }
      // The ends are pinned to the source, not merely near it.
      const a = src.sample(0), b = src.sample(1);
      near(segs[0]![0], a.x, 1e-9); near(segs[0]![1], a.y, 1e-9);
      near(segs[segs.length - 1]![6], b.x, 1e-9); near(segs[segs.length - 1]![7], b.y, 1e-9);
    }
  }
});

test('optimise never costs more segments than plain bisection', () => {
  for (const [name, src] of CONVERGENCE_CASES) {
    for (const tol of CONVERGENCE_TOLS) {
      const plain = fitToCubics(src, { tol }).length;
      const greedy = fitToCubics(src, { tol, optimise: true }).length;
      assert.ok(greedy <= plain, `${name} at tol=${tol}: optimise gave ${greedy} segments against ${plain}`);
    }
  }
});

// ── 4. circle accuracy ────────────────────────────────────────────────────────

/** The classical control arm for a circular arc: 4/3·tan(θ/4), 0.5522847… at 90°. */
const CLASSICAL_K = (4 / 3) * Math.tan(Math.PI / 8);

test('a quarter circle fits one cubic, at the classical control arm', () => {
  for (const r of [1, 50, 1000]) {
    for (const a0 of [0, 0.7, -2.1]) {
      const got = fitCubicMoment(arcSource(r, a0, a0 + Math.PI / 2), 0, 1);
      assert.ok(got, `no fit for a quarter circle at r=${r}`);
      // The endpoints are on the true arc by construction, so the chord is exact.
      near(Math.hypot(got[6] - got[0], got[7] - got[1]), r * Math.SQRT2, 1e-9 * r);
      const [arm0, arm1] = armRatios(got);
      const armFraction = arm0 * Math.SQRT2;   // arms are reported against the chord
      near(arm0, arm1, 1e-12);
      assert.ok(Math.abs(armFraction - CLASSICAL_K) / CLASSICAL_K < 2e-3,
        `arm ${armFraction.toFixed(12)}·r against the classical ${CLASSICAL_K.toFixed(12)}·r`);
    }
  }
});

test('the fitted quarter circle is at least as round as the classical cubic', () => {
  // Measured against the CLASSICAL CUBIC's own radial deviation, not against a true
  // circle: no cubic is a circle, and 2.7e-4·r of that gap belongs to the curve family
  // rather than to the fit. Checking against π/2 instead would fail correct code.
  const r = 1;
  const fitted = fitCubicMoment(arcSource(r, 0, Math.PI / 2), 0, 1)!;
  const classical: Cubic = [r, 0, r, CLASSICAL_K * r, CLASSICAL_K * r, r, 0, r];
  const radial = (c: Cubic) => {
    let worst = 0;
    for (let i = 0; i <= 4000; i++) {
      const p = evalCubic(c, i / 4000);
      worst = Math.max(worst, Math.abs(Math.hypot(p.x, p.y) - r));
    }
    return worst;
  };
  const ef = radial(fitted), ec = radial(classical);
  assert.ok(ef <= ec, `moment fit deviates ${ef.toExponential(4)}·r, classical ${ec.toExponential(4)}·r`);
  assert.ok(ef < 3e-4, `a 90° cubic should land near 2.7e-4·r, got ${ef.toExponential(4)}`);
});

test('a whole circle takes four cubics, at the four-cubic circle accuracy', () => {
  const r = 150;
  const segs = fitToCubics(arcSource(r, 0, 2 * Math.PI), { tol: 1 });
  assert.equal(segs.length, 4, `expected the classical four, got ${segs.length}`);
  let worst = 0;
  for (const s of segs) {
    for (let i = 0; i <= 500; i++) {
      const p = evalCubic(s, i / 500);
      worst = Math.max(worst, Math.abs(Math.hypot(p.x, p.y) - r));
    }
  }
  assert.ok(worst / r < 3e-4, `radial error ${(worst / r).toExponential(3)}·r on a four-cubic circle`);
});

// ── 5. cusp regression ────────────────────────────────────────────────────────

/**
 * The "bumps" case: a source whose curvature varies enough that matching area and moment
 * wants one long control arm and one short. That fit can meet the distance tolerance and
 * still be visibly wrong, because Fréchet distance bounds position and says nothing about
 * angle - better subdivision makes it worse, not better.
 *
 * Every source here is inflection-free (a logarithmic spiral, and offsets of a single
 * arch taken well inside its radius of curvature), so a reversal of turning direction in
 * the output cannot have come from the source.
 */
const BUMP_CASES: [string, ParamCurveFit][] = [
  ['a logarithmic spiral over 7 radians', spiralSource(10, 0.22, 1, 8)],
  ['a tighter logarithmic spiral', spiralSource(4, 0.35, 0, 7)],
  ['the +18 offset of a high-curvature arch', offsetSource([0, 0, 10, 220, 250, 220, 260, 0], 18)],
  ['the -18 offset of a high-curvature arch', offsetSource([0, 0, 10, 220, 250, 220, 260, 0], -18)],
];

for (const [name, src] of BUMP_CASES) {
  test(`${name}: the fit meets its tolerance without cusping`, (t) => {
    let worstArm = 0, worstCos = 1, worstSpeed = Infinity;
    for (const tol of [2, 1, 0.5, 0.1, 0.01]) {
      const segs = fitToCubics(src, { tol });
      assert.ok(segs.length > 0);
      // A cusp-free output that misses the source is not a pass - the two have to hold
      // together, or "no cusp" is satisfied by any straight line.
      const err = denseError(src, segs, 1500);
      assert.ok(err <= tol, `tol=${tol}: achieved ${err.toExponential(3)} with ${segs.length} segments`);

      for (const seg of segs) {
        for (const v of seg) assert.ok(Number.isFinite(v), `non-finite coordinate at tol=${tol}`);
        const [a0, a1] = armRatios(seg);
        worstArm = Math.max(worstArm, a0, a1);
        assert.ok(a0 < 1 && a1 < 1,
          `tol=${tol}: control arm ${Math.max(a0, a1).toFixed(4)} of the chord — the bump the penalty exists to prevent`);

        const st = cuspStats(seg);
        worstCos = Math.min(worstCos, st.minCos);
        worstSpeed = Math.min(worstSpeed, st.speedRatio);
        assert.ok(st.minCos > 0.99,
          `tol=${tol}: the tangent turns ${(Math.acos(Math.max(-1, st.minCos)) * 180 / Math.PI).toFixed(1)}° between adjacent samples — a reversal, not a curve`);
        assert.ok(st.speedRatio > 0.05,
          `tol=${tol}: |C'| falls to ${st.speedRatio.toExponential(2)} of the chord — that is a cusp forming`);
        assert.equal(st.turnSigns, 1,
          `tol=${tol}: the output bends both ways inside one segment, fitted to a source that never does`);
      }
    }
    t.diagnostic(`${name}: worst arm ${worstArm.toFixed(4)} chords, worst tangent agreement ${worstCos.toFixed(6)}, worst speed ${worstSpeed.toFixed(3)} chords`);
  });
}

// ── 6. degeneracy ─────────────────────────────────────────────────────────────

test('a zero-length range has no fit to return', () => {
  // The whole normalisation divides by the chord, so there is no frame and nothing
  // truthful to answer with.
  for (const c of FIXTURES) {
    assert.equal(fitCubicMoment(cubicAsSource(c), 0.5, 0.5), null);
    assert.equal(fitCubicMoment(cubicAsSource(c), 0, 0), null);
  }
});

test('a source that never moves yields one degenerate segment, not a hang', () => {
  const point: ParamCurveFit = {
    sample: () => ({ x: 42, y: -7, dx: 0, dy: 0 }),
    momentIntegrals: () => ({ area: 0, moment: 0 }),
  };
  const segs = fitToCubics(point, { tol: 0.1 });
  assert.equal(segs.length, 1);
  for (const v of segs[0]!) assert.ok(Number.isFinite(v));
  assert.deepEqual([...segs[0]!], [42, -7, 42, -7, 42, -7, 42, -7]);
});

test('a straight source comes back straight, in one segment', () => {
  // Every trig term vanishes and the quartic degenerates to nothing, so this is the
  // branch that has to fall through to controls at the thirds. Anything else would put
  // a bend in a line, or bunch its parameterisation so a later split lands elsewhere.
  const line = lineToCubic(10, 20, 210, 140);
  const segs = fitToCubics(cubicAsSource(line), { tol: 0.01 });
  assert.equal(segs.length, 1);
  assert.ok(isLineCubic(segs[0]!), `the fit of a line is not straight: ${JSON.stringify(segs[0])}`);
  for (let i = 0; i < 8; i++) near(segs[0]![i]!, line[i]!, 1e-9);

  // And a line short enough that the chord is inside the tolerance still comes back.
  const tiny = fitToCubics(cubicAsSource(lineToCubic(0, 0, 0.02, 0.01)), { tol: 0.1 });
  assert.equal(tiny.length, 1);
  for (const v of tiny[0]!) assert.ok(Number.isFinite(v));
});

test('a declared cusp is split at, not fitted across', () => {
  const segs = fitToCubics(cornerSource(true), { tol: 0.01 });
  assert.equal(segs.length, 2, `a right-angle corner needs exactly two segments, got ${segs.length}`);
  near(segs[0]![6], 100, 1e-9); near(segs[0]![7], 0, 1e-9);
  near(segs[1]![0], 100, 1e-9); near(segs[1]![1], 0, 1e-9);
  for (const s of segs) assert.ok(isLineCubic(s), 'each arm of the corner is straight');
});

test('an UNDECLARED corner is still not fitted across', () => {
  // `sample` has no side argument, so at t=0.5 the source hands back the second arm's
  // tangent to a range that ends there. Without the endpoint probe the first range is
  // fitted to a tangent belonging to its neighbour and subdivides towards the corner
  // forever - the symptom is a segment count in double figures for a two-line path.
  const segs = fitToCubics(cornerSource(false), { tol: 0.01 });
  assert.ok(segs.length <= 4, `a two-line corner took ${segs.length} segments`);
  const err = denseError(cornerSource(false), segs, 1200);
  assert.ok(err <= 0.01, `achieved ${err.toExponential(3)} against tol 0.01`);
});

test('breaks() is sanitised — endpoints, duplicates and junk cannot start a loop', () => {
  // A break reported AT a range endpoint splits into the same range and recurses.
  const sample = (t: number) => ({ x: 200 * t, y: 40 * Math.sin(3 * t), dx: 200, dy: 120 * Math.cos(3 * t) });
  const src: ParamCurveFit = {
    sample,
    momentIntegrals: (t0, t1) => quadratureMoments(sample, t0, t1),
    breaks: () => [0, 1, 0.5, Number.NaN, -3, 2, 0.5, 0.5],
  };
  const started = process.hrtime.bigint();
  const segs = fitToCubics(src, { tol: 0.01 });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 2000, `took ${ms.toFixed(0)}ms on eight junk breaks`);
  assert.ok(segs.length > 0 && segs.length < 64);
  for (const s of segs) for (const v of s) assert.ok(Number.isFinite(v));
});

test('maxSegments is a hard cap, and the output stays continuous under it', () => {
  const src = rippleSource(120);
  for (const cap of [1, 2, 5, 33, 128]) {
    const segs = fitToCubics(src, { tol: 1e-9, maxSegments: cap });
    assert.ok(segs.length <= cap, `cap ${cap} produced ${segs.length} segments`);
    assert.ok(segs.length > 0, `cap ${cap} produced nothing — a hole in the contour`);
    for (let i = 1; i < segs.length; i++) {
      near(segs[i]![0], segs[i - 1]![6], 0);
      near(segs[i]![1], segs[i - 1]![7], 0);
    }
    for (const s of segs) for (const v of s) assert.ok(Number.isFinite(v), `cap ${cap} produced a non-finite coordinate`);
  }
});

test('a source no cubic can track returns in bounded time', () => {
  for (const [freq, tol, cap] of [[120, 1e-9, 512], [400, 1e-12, 512], [40, 1e-6, 200]] as const) {
    const started = process.hrtime.bigint();
    const segs = fitToCubics(rippleSource(freq), { tol, maxSegments: cap });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(ms < 2000, `freq=${freq} tol=${tol} took ${ms.toFixed(0)}ms`);
    assert.ok(segs.length <= cap);
    for (const s of segs) for (const v of s) assert.ok(Number.isFinite(v));
  }
  // The greedy pass runs a root search whose every evaluation is a whole fit, so it is
  // the path most able to spend unbounded time.
  const started = process.hrtime.bigint();
  fitToCubics(rippleSource(120), { tol: 1e-9, maxSegments: 256, optimise: true });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 2000, `the greedy pass took ${ms.toFixed(0)}ms`);
});

test('nonsense options fall back rather than producing nothing', () => {
  const src = cubicAsSource(FIXTURES[2]!);
  for (const opts of [{ tol: 0 }, { tol: -5 }, { maxSegments: 0 }, { maxSegments: -3 }, {}]) {
    const segs = fitToCubics(src, opts);
    assert.ok(segs.length > 0, `${JSON.stringify(opts)} produced no output`);
    for (const s of segs) for (const v of s) assert.ok(Number.isFinite(v));
  }
});

test('every path in this file produces finite coordinates', () => {
  const all: ParamCurveFit[] = [
    ...FIXTURES.map(cubicAsSource),
    ...CONVERGENCE_CASES.map(([, s]) => s),
    ...BUMP_CASES.map(([, s]) => s),
    cornerSource(true), cornerSource(false), rippleSource(17),
    arcSource(80, 0, 2 * Math.PI), arcSource(0.001, 0, 1.2),
    offsetSource(lineToCubic(0, 0, 100, 0), 25),
  ];
  for (const [i, src] of all.entries()) {
    for (const tol of [1, 0.05, 0.0005]) {
      const segs = fitToCubics(src, { tol, maxSegments: 128 });
      for (const s of segs) {
        for (const v of s) assert.ok(Number.isFinite(v), `source ${i} at tol=${tol} produced ${v}`);
      }
    }
  }
});

// ── simplification ────────────────────────────────────────────────────────────

test('simplifyCubics undoes an over-split path without moving it', () => {
  // An eight-piece rounded rect chopped into thirty-two must come back as eight: the
  // corners are real and have to survive, the straights are one segment each.
  const r = 40, k = 0.5522847498307936;
  const rect: Cubic[] = [
    lineToCubic(r, 0, 200 - r, 0),
    [200 - r, 0, 200 - r + k * r, 0, 200, r - k * r, 200, r],
    lineToCubic(200, r, 200, 100 - r),
    [200, 100 - r, 200, 100 - r + k * r, 200 - r + k * r, 100, 200 - r, 100],
    lineToCubic(200 - r, 100, r, 100),
    [r, 100, r - k * r, 100, 0, 100 - r + k * r, 0, 100 - r],
    lineToCubic(0, 100 - r, 0, r),
    [0, r, 0, r - k * r, r - k * r, 0, r, 0],
  ];
  const over = rect.flatMap((c) => [0, 1, 2, 3].map((i) => subCubic(c, i / 4, (i + 1) / 4)));
  assert.equal(over.length, 32);

  const simplified = simplifyCubics(over, 0.01);
  assert.equal(simplified.length, 8, `expected the original eight, got ${simplified.length}`);
  let worst = 0;
  for (const c of over) {
    for (let i = 0; i <= 40; i++) {
      const p = evalCubic(c, i / 40);
      worst = Math.max(worst, pathDistance(simplified, p.x, p.y));
    }
  }
  assert.ok(worst < 1e-6, `simplification moved the path by ${worst.toExponential(3)}`);
});

test('simplifyCubics returns the input when it cannot do better', () => {
  // The guard that keeps it from being a lossy no-op: fitting moves points off the input
  // curves, so paying that cost for no reduction is never worth it.
  const one: Cubic[] = [[0, 0, 30, 100, 70, 100, 100, 0]];
  assert.deepEqual(simplifyCubics(one, 0.01), one);
  assert.deepEqual(simplifyCubics([], 0.01), []);
  const corners = [
    lineToCubic(0, 0, 100, 0), lineToCubic(100, 0, 100, 100), lineToCubic(100, 100, 0, 100),
  ];
  assert.equal(simplifyCubics(corners, 0.01).length, 3, 'a triangle has no redundant segment to remove');
});

/**
 * The closed loop that got reported as a defect, and was not one.
 *
 * A 16-arc circle of r=100 reduces to the 4-segment kappa circle the moment the tolerance
 * reaches what that circle can actually achieve - measured, by the independent oracle, at
 * 0.026843. Not at 2, and not "fifty times the achievable error": the acceptance threshold
 * sits at 0.02685, four digits above the achievable error, and every count in between is a
 * genuine improvement rather than conservatism.
 *
 * The report that said otherwise was built on a fixture whose arc handles were
 * 4/3·tan(π/n)·r - tan of θ/2 rather than θ/4, twice the correct length. That is a
 * 16-lobed scalloped shape sitting 1.959 units outside a circle of the same radius, and no
 * 4-segment path can be within 0.5 of it. The test below pins both halves of that.
 */
test('simplifyCubics reduces an exact-arc circle as soon as the tolerance is achievable', () => {
  const circle = arcCircleCurves(16);
  const src = polyPathSource(circle);

  // What four segments can actually do, measured against the source, not asserted.
  const four = simplifyCubics(circle, 0.1);
  assert.equal(four.length, 4, 'a circle needs four cubics, not sixteen');
  const fourErr = pathHausdorff(circle, four);
  near(fourErr, 0.026843, 5e-5);

  // And it is taken up the moment it fits: rejected a hair below, accepted a hair above.
  assert.equal(simplifyCubics(circle, 0.0265).length, 8, 'below the achievable error, four must be refused');
  assert.equal(simplifyCubics(circle, 0.027).length, 4, 'just above it, four must be taken');

  // Tighter than four can manage, and the eight it falls back to is honest too.
  const eight = simplifyCubics(circle, 0.01);
  assert.equal(eight.length, 8);
  assert.ok(pathHausdorff(circle, eight) <= 0.01, 'the eight-segment result must meet its own tolerance');

  // Nothing it returns at any tolerance may exceed that tolerance.
  for (const tol of [0.01, 0.03, 0.1, 0.5, 2, 10]) {
    const out = simplifyCubics(circle, tol);
    if (out.length >= circle.length) continue;
    const err = denseError(src, out, 800);
    assert.ok(err <= tol, `tol=${tol} produced ${out.length} segments at error ${err.toExponential(4)}`);
  }
});

test('a scalloped "circle" with tan(θ/2) handles is not a circle, and is refused as one', () => {
  // The reporter's fixture, verbatim in shape: handles at 4/3·tan(π/n)·r.
  const n = 16, r = 100, k = (4 / 3) * Math.tan(Math.PI / n) * r;
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return { x: r * Math.cos(a), y: r * Math.sin(a), tx: -Math.sin(a) * k, ty: Math.cos(a) * k };
  });
  const scalloped: Cubic[] = nodes.map((p, i) => {
    const q = nodes[(i + 1) % n]!;
    return [p.x, p.y, p.x + p.tx, p.y + p.ty, q.x - q.tx, q.y - q.ty, q.x, q.y];
  });

  // It bulges 1.96 units outside the circle through its own nodes.
  const truth = arcCircleCurves(96);
  let bulge = 0;
  for (const c of scalloped) {
    for (let i = 0; i <= 40; i++) {
      const p = evalCubic(c, i / 40);
      bulge = Math.max(bulge, pathDistance(truth, p.x, p.y));
    }
  }
  near(bulge, 1.959116, 1e-3);

  // So refusing to shorten it at tol=0.5 is arithmetic, not timidity: the lobes alone are
  // four times that budget.
  assert.equal(simplifyCubics(scalloped, 0.5).length, n, 'a 1.96-unit scallop cannot be fitted to 0.5');

  // And once the tolerance covers the lobes it does reduce, always inside the budget.
  const src = polyPathSource(scalloped);
  for (const tol of [1.5, 2, 3]) {
    const out = simplifyCubics(scalloped, tol);
    assert.ok(out.length < n, `tol=${tol} should have shortened, got ${out.length}`);
    const err = denseError(src, out, 800);
    assert.ok(err <= tol, `tol=${tol} produced error ${err.toFixed(6)}`);
  }
});

/**
 * The reported symptom's other half: an 8-arc semicircle collapsing to one cubic at
 * tol=10. It is correct - one cubic over 180° of r=100 is 1.825 units off, which is
 * comfortably inside a 10-unit budget - and the same power-of-two ladder as the full
 * circle explains the counts, because `simplifyCubics` subdivides the parameter domain by
 * bisection.
 */
test('an over-split semicircle walks the bisection ladder, each rung inside its tolerance', () => {
  const semi = arcCircleCurves(8, 100, Math.PI);
  const src = polyPathSource(semi);
  const seen = new Map<number, number>();
  for (const tol of [0.001, 0.01, 0.1, 1, 3, 10, 30]) {
    const out = simplifyCubics(semi, tol);
    if (out.length < semi.length) {
      const err = denseError(src, out, 800);
      assert.ok(err <= tol, `tol=${tol} produced ${out.length} segments at error ${err.toExponential(4)}`);
      seen.set(out.length, err);
    }
  }
  // Counts reachable by bisecting a symmetric domain, and nothing between them.
  assert.deepEqual([...seen.keys()].sort((a, b) => a - b), [1, 2, 4]);
  near(seen.get(2)!, 0.026843, 5e-5);
  near(seen.get(1)!, 1.825223, 5e-4);
});

test('simplifyCubics never returns a path outside the tolerance it was given', () => {
  // The serious version of the reported concern. Randomised G1 polycubics, over-split so
  // there is something to remove, checked with the two-sided Hausdorff oracle - which is
  // weaker than the Fréchet distance the fitter budgets, so any excess is unambiguous.
  const rnd = lcg(20260726);
  let checked = 0, worstRatio = 0, worstDesc = '';
  for (let trial = 0; trial < 10; trial++) {
    const nodes = 2 + Math.floor(rnd() * 4);
    const curves: Cubic[] = [];
    let px = rnd() * 200, py = rnd() * 200;
    let hx = (rnd() - 0.5) * 120, hy = (rnd() - 0.5) * 120;
    for (let i = 0; i < nodes; i++) {
      const qx = rnd() * 200, qy = rnd() * 200;
      const gx = (rnd() - 0.5) * 120, gy = (rnd() - 0.5) * 120;
      // Handle shared across the joint, so the path is G1 and has no declared break.
      curves.push([px, py, px + hx, py + hy, qx - gx, qy - gy, qx, qy]);
      px = qx; py = qy; hx = gx; hy = gy;
    }
    let dense = curves;
    for (let k = 0; k < 2; k++) {
      dense = dense.flatMap((c) => [subCubic(c, 0, 0.5), subCubic(c, 0.5, 1)]);
    }
    for (const tol of [0.05, 2]) {
      const out = simplifyCubics(dense, tol);
      if (out.length >= dense.length) continue;
      checked++;
      const err = pathHausdorff(dense, out, 30);
      const ratio = err / tol;
      if (ratio > worstRatio) { worstRatio = ratio; worstDesc = `trial ${trial}, tol=${tol}, ${dense.length}->${out.length}, err=${err.toExponential(4)}`; }
      assert.ok(ratio <= 1, `over tolerance: trial ${trial}, tol=${tol}, ${dense.length}->${out.length} at ${err.toExponential(4)}`);
    }
  }
  assert.ok(checked >= 10, `expected the sweep to actually shorten things, only ${checked} did`);
  // The worst case must also USE most of its budget - a suite where everything comes back
  // at 1% of tolerance is not evidence the metric is tight, only that nothing was merged.
  assert.ok(worstRatio > 0.5, `nothing came close to its budget (worst ${worstRatio.toFixed(3)}: ${worstDesc})`);
});
