// SPDX-License-Identifier: MPL-2.0
/**
 * Cubic Bézier kernel - the geometric substrate for boolean operations, offsetting
 * and stroke outlining.
 *
 * ## Why cubics only
 *
 * Every path that reaches the engine is already normalised to moves, lines and cubics
 * (`PathSegment` in svg-path.ts - arcs and quadratics are converted at parse time).
 * So a geometry layer here needs exactly one curve type, and a line is just a cubic
 * whose control points are collinear. That single fact removes most of the case
 * analysis that makes boolean geometry libraries large.
 *
 * ## Why not flatten
 *
 * The cheap way to intersect two curves is to chop both into hundreds of line
 * segments and intersect those. It is also wrong in a way that cannot be fixed
 * downstream: the output coordinates are no longer ON the input curves, every
 * subsequent operation compounds the error, and a shape that has been through two
 * booleans is visibly polygonal at print resolution. Everything here keeps full
 * cubic precision and produces parameters (`t`) on the original curves, so a result
 * point is computed FROM the curve rather than approximated near it.
 *
 * Flattening still appears in this file - `flattenCubic` - but only where a caller
 * genuinely wants a polyline (a preview, a test oracle), never inside the geometry.
 */

/** A cubic Bézier as its four control points, flattened: [x0,y0, x1,y1, x2,y2, x3,y3].
 *  A tuple rather than an object because these are allocated in tight loops during
 *  subdivision, and the shape is fixed and well known. */
export type Cubic = [number, number, number, number, number, number, number, number];

export interface Pt { x: number; y: number }

/** A straight line as a degenerate cubic, control points spaced along it in thirds.
 *  Spacing matters: evenly spaced controls make `t` the arc-length parameter, so a
 *  line and a curve can be compared and split with one code path. */
export function lineToCubic(x0: number, y0: number, x1: number, y1: number): Cubic {
  return [x0, y0, x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + (2 * (x1 - x0)) / 3, y0 + (2 * (y1 - y0)) / 3, x1, y1];
}

/** Point on the curve at `t`, by de Casteljau - not by expanding the polynomial.
 *  The expanded form loses precision near t=1 for curves far from the origin. */
export function evalCubic(c: Cubic, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, d = 3 * mt * t * t, e = t * t * t;
  return {
    x: a * c[0] + b * c[2] + d * c[4] + e * c[6],
    y: a * c[1] + b * c[3] + d * c[5] + e * c[7],
  };
}

/** Tangent (first derivative) at `t`. Zero-length at a cusp or a coincident control
 *  point, which callers testing direction must handle. */
export function tangentAt(c: Cubic, t: number): Pt {
  const mt = 1 - t;
  const a = 3 * mt * mt, b = 6 * mt * t, d = 3 * t * t;
  return {
    x: a * (c[2] - c[0]) + b * (c[4] - c[2]) + d * (c[6] - c[4]),
    y: a * (c[3] - c[1]) + b * (c[5] - c[3]) + d * (c[7] - c[5]),
  };
}

/** Split at `t` into two cubics that together are exactly the original. */
export function splitCubic(c: Cubic, t: number): [Cubic, Cubic] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = c;
  const ax = x0 + (x1 - x0) * t, ay = y0 + (y1 - y0) * t;
  const bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t;
  const cx = x2 + (x3 - x2) * t, cy = y2 + (y3 - y2) * t;
  const dx = ax + (bx - ax) * t, dy = ay + (by - ay) * t;
  const ex = bx + (cx - bx) * t, ey = by + (cy - by) * t;
  const fx = dx + (ex - dx) * t, fy = dy + (ey - dy) * t;
  return [
    [x0, y0, ax, ay, dx, dy, fx, fy],
    [fx, fy, ex, ey, cx, cy, x3, y3],
  ];
}

/** The piece of `c` between `t0` and `t1`, as a cubic in its own right. */
export function subCubic(c: Cubic, t0: number, t1: number): Cubic {
  if (t0 === 0 && t1 === 1) return [...c] as Cubic;
  if (t0 > t1) return subCubic(c, t1, t0);
  const right = t0 > 0 ? splitCubic(c, t0)[1] : c;
  if (t1 >= 1) return [...right] as Cubic;
  // Re-parameterise t1 into the remaining piece's own domain.
  const t = t0 > 0 ? (t1 - t0) / (1 - t0) : t1;
  return splitCubic(right, t)[0];
}

/** Real roots in (0,1) of the quadratic a·t² + b·t + c. Used for the derivative's
 *  zeros, which is where a curve's extrema are. */
function quadRoots01(a: number, b: number, c: number): number[] {
  const out: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) {
      const t = -c / b;
      if (t > 0 && t < 1) out.push(t);
    }
    return out;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return out;
  const s = Math.sqrt(disc);
  for (const t of [(-b + s) / (2 * a), (-b - s) / (2 * a)]) if (t > 0 && t < 1) out.push(t);
  return out;
}

/** The `t` values where the curve turns in x or y - its extrema. */
export function extremaCubic(c: Cubic): number[] {
  const ts: number[] = [];
  for (const off of [0, 1]) {
    const p0 = c[off]!, p1 = c[2 + off]!, p2 = c[4 + off]!, p3 = c[6 + off]!;
    // d/dt of the cubic, as a quadratic in t.
    ts.push(...quadRoots01(
      3 * (-p0 + 3 * p1 - 3 * p2 + p3),
      6 * (p0 - 2 * p1 + p2),
      3 * (p1 - p0),
    ));
  }
  return ts.sort((a, b) => a - b);
}

export interface Box { x0: number; y0: number; x1: number; y1: number }

/**
 * TIGHT bounding box - the curve's actual extent, not its control hull.
 *
 * The hull is cheaper and is what most code reaches for, but it can be several times
 * too large for a curve with far-flung controls, and every wasted box overlap costs
 * an intersection subdivision. Tight boxes are the single biggest lever on how fast
 * the intersection search converges.
 */
export function boundsCubic(c: Cubic): Box {
  let x0 = Math.min(c[0], c[6]), x1 = Math.max(c[0], c[6]);
  let y0 = Math.min(c[1], c[7]), y1 = Math.max(c[1], c[7]);
  for (const t of extremaCubic(c)) {
    const p = evalCubic(c, t);
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** Control-hull box: looser, but no roots to solve. Used as a pre-filter. */
export function hullBounds(c: Cubic): Box {
  return {
    x0: Math.min(c[0], c[2], c[4], c[6]), x1: Math.max(c[0], c[2], c[4], c[6]),
    y0: Math.min(c[1], c[3], c[5], c[7]), y1: Math.max(c[1], c[3], c[5], c[7]),
  };
}

export function boxesOverlap(a: Box, b: Box, eps = 0): boolean {
  return a.x0 - eps <= b.x1 && b.x0 - eps <= a.x1 && a.y0 - eps <= b.y1 && b.y0 - eps <= a.y1;
}

/** How far the control points stray from the chord, as a distance. Zero means the
 *  curve is exactly a straight line, which lets the intersector take an exact path. */
export function flatnessCubic(c: Cubic): number {
  const dx = c[6] - c[0], dy = c[7] - c[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) {
    // Degenerate chord: measure from the start point instead, or a loop reads as flat.
    return Math.max(Math.hypot(c[2] - c[0], c[3] - c[1]), Math.hypot(c[4] - c[0], c[5] - c[1]));
  }
  const d1 = Math.abs((c[2] - c[0]) * dy - (c[3] - c[1]) * dx) / len;
  const d2 = Math.abs((c[4] - c[0]) * dy - (c[5] - c[1]) * dx) / len;
  return Math.max(d1, d2);
}

/** Approximate length, by recursive subdivision until each piece is near-straight.
 *  Exact arc length has no closed form for a cubic; this is a bounded approximation
 *  and is documented as one. */
export function lengthCubic(c: Cubic, tol = 0.01, depth = 0): number {
  if (depth > 20 || flatnessCubic(c) <= tol) return Math.hypot(c[6] - c[0], c[7] - c[1]);
  const [a, b] = splitCubic(c, 0.5);
  return lengthCubic(a, tol, depth + 1) + lengthCubic(b, tol, depth + 1);
}

/**
 * Polyline approximation to a tolerance.
 *
 * Deliberately NOT used by the geometry in this directory - it exists for callers who
 * genuinely want a polyline (a preview, a format with no curves, a brute-force test
 * oracle). Using it inside an intersector or a boolean is the shortcut this whole
 * module exists to avoid.
 */
export function flattenCubic(c: Cubic, tol = 0.1): Pt[] {
  const out: Pt[] = [{ x: c[0], y: c[1] }];
  const rec = (q: Cubic, depth: number): void => {
    if (depth > 24 || flatnessCubic(q) <= tol) { out.push({ x: q[6], y: q[7] }); return; }
    const [a, b] = splitCubic(q, 0.5);
    rec(a, depth + 1); rec(b, depth + 1);
  };
  rec(c, 0);
  return out;
}

/** True when every control point lies on the chord, to `tol` - the curve IS a line
 *  and can be handled by exact algebra rather than by iteration. */
export function isLineCubic(c: Cubic, tol = 1e-9): boolean {
  return flatnessCubic(c) <= tol;
}

// ── nearest point: a polynomial root problem, not a search ────────────────────

/**
 * Scratch buffers for the root solve, one set per recursion level.
 *
 * A polynomial here is a `Float64Array` of ascending coefficients - `co[i]` multiplies
 * t^i - plus a length, because the working degree drops as leading terms are trimmed.
 * Ascending is the order the recursion wants: differentiating then only walks the tail.
 *
 * They are module-level and reused because `nearestOnCubic` runs per curve per frame in
 * the editor's hit testing and per measured sample inside offsetting, and allocating a
 * dozen short-lived arrays per call was measurably the largest single cost of the solve.
 * Safe to share only because the recursion descends one level at a time and nothing here
 * is async or reentrant - a level never sees another level's buffer.
 */
const CO_BUF: Float64Array[] = [];
const KN_BUF: Float64Array[] = [];
for (let i = 0; i <= 6; i++) { CO_BUF.push(new Float64Array(6)); KN_BUF.push(new Float64Array(16)); }
/** Where `nearestOnCubic` collects its candidate parameters: at most five roots, four
 *  critical points and the two endpoints, so sixteen is room to spare. */
const NEAREST_OUT = new Float64Array(16);

/** Horner, so no power of t is formed explicitly. */
function polyEval(co: Float64Array, n: number, t: number): number {
  let v = 0;
  for (let i = n; i >= 0; i--) v = v * t + co[i]!;
  return v;
}

/** Value AND slope from one Horner sweep - the derivative falls out of the same partial
 *  products, so a Newton step costs one traversal rather than two and needs no separate
 *  derivative array. The slope lands in a module-level slot because returning a pair would
 *  allocate on a path that runs tens of times per call. */
let EV_SLOPE = 0;
function polyEvalD(co: Float64Array, n: number, t: number): number {
  let v = co[n]!, dv = 0;
  for (let i = n - 1; i >= 0; i--) { dv = dv * t + v; v = v * t + co[i]!; }
  EV_SLOPE = dv;
  return v;
}

/**
 * The one root a bracket with a sign change is guaranteed to contain, to machine
 * precision.
 *
 * Newton where Newton behaves, bisection where it does not: the step is taken only if it
 * lands strictly inside the live bracket, and a bisection is forced periodically so a
 * stalled iteration still halves the interval - which is what makes the iteration count
 * bounded rather than hopeful. The first guess is false position rather than the midpoint,
 * because the bracket comes from consecutive critical points and f is monotone across it,
 * so the secant is usually already close. This is the same bracket-then-polish discipline
 * `cubicRoots01` uses in intersect.ts; the difference is only that above degree 3 there is
 * no closed form to start from, so the bracket comes from the isolation below rather than
 * from Cardano.
 */
function rootInBracket(
  co: Float64Array, n: number, lo: number, hi: number, flo: number, fhi: number, fTol: number,
): number {
  let a = lo, b = hi, fa = flo, fb = fhi;
  let t = a + ((b - a) * fa) / (fa - fb);
  if (!(t > a && t < b)) t = (a + b) / 2;
  for (let i = 0; i < 80; i++) {
    const f = polyEvalD(co, n, t);
    // Two exits, and both are needed. `f === 0` and the bracket collapsing cover a simple
    // root; `|f| <= fTol` covers a double one, where f grazes zero over a wide interval and
    // Newton's convergence degrades to linear. Past the noise floor of EVALUATING the
    // polynomial there is nothing left to learn, and for the distance question every t in
    // that interval answers the same.
    if (f === 0 || Math.abs(f) <= fTol) return t;
    if ((f < 0) === (fa < 0)) { a = t; fa = f; } else { b = t; fb = f; }
    // Absolute, because the domain is [0,1]: a few ulps of 1 is below anything a caller can
    // use and stops the loop spinning on the last bit.
    if (b - a <= 4e-16) break;
    const df = EV_SLOPE;
    let next = df !== 0 ? t - f / df : Number.NaN;
    if (!(next > a && next < b)) next = a + ((b - a) * fa) / (fa - fb);
    // Newton converges from ONE side, so the bracket stops shrinking even as `t` lands on
    // the root - which is why the safeguard is a schedule and not a stall detector. It only
    // starts after Newton has had its eight quadratic steps (interrupting it earlier
    // measurably costs iterations by throwing away a converged guess), and from then on
    // every other step halves the interval, so the bracket-width exit is always reached.
    if ((i >= 8 && (i & 1) === 0) || !(next > a && next < b)) next = (a + b) / 2;
    if (next === t) break;
    t = next;
  }
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Every sign-changing root in [0,1] of the polynomial in `co[0..len-1]`, written into
 * `out` and counted by the return value. With `withCritical`, the isolating knots - the
 * derivative's own roots - are appended too; with `minimaOnly`, roots where the sign falls
 * through zero are located but not refined. Both flags are for the top-level call only,
 * and both are explained where they are used below.
 *
 * ## Why no root can be missed
 *
 * Between two consecutive SIGN-CHANGING zeros of f' the derivative keeps one sign, so f is
 * monotone there and has at most one root, which a sign change at the ends detects. Zeros
 * of f' that do not change sign need not be knots at all, for the same reason: f stays
 * monotone across them. So isolating f's roots by f's critical points is complete rather
 * than lucky - and the argument repeats one level down, isolating f''s roots by f'''s, until
 * the derivative is a quadratic and its roots are closed-form. Three levels of that solve a
 * quintic with no grid, no starting guess and nothing to tune. A sample-and-refine search
 * can only ever bracket features wider than its own step, which is precisely the defect
 * this replaced and which no sample count fixed.
 *
 * offset.ts isolates ITS quintic (dκ/dt) differently - Bernstein form plus Descartes'
 * rule, subdividing until one sign change is left. That is equally complete and it is the
 * better shape when the answer only has to be good to ~1e-7, which is all a split point
 * needs. It is the worse shape for this job, where the answer is a measured distance and has to be
 * exact: Descartes converges linearly, so machine precision costs ~50 subdivisions of a
 * six-coefficient array. It also lives one layer up and cannot be imported down without a
 * cycle. Two isolators, two different precision requirements, on purpose.
 *
 * The one root a sign change cannot see is one of EVEN multiplicity, where f touches zero
 * and turns back. That root is always also a sign-changing root of f' (write f = (t-r)²g:
 * f' ~ 2(t-r)g(r) near r), so `withCritical` at the top level catches every one of them.
 *
 * Trimming the leading coefficients is what removes the need for a degenerate special
 * case. A quadratic dressed as a cubic, repeated control points, an exactly straight
 * curve: each makes the top coefficients vanish, the polynomial genuinely drops degree, and
 * a solver that assumed the stated degree would divide by ~0. Because |t| <= 1 over the
 * domain, discarding a term at 1e-14 of the largest moves the value by no more than that,
 * which is below the noise floor of having formed the coefficients at all.
 */
function rootsIn01(
  co: Float64Array, len: number, depth: number, out: Float64Array,
  withCritical = false, minimaOnly = false,
): number {
  let scale = 0;
  for (let i = 0; i < len; i++) { const a = Math.abs(co[i]!); if (a > scale) scale = a; }
  if (!(scale > 0) || !Number.isFinite(scale)) return 0;   // identically zero, or not finite
  let n = len - 1;
  while (n > 0 && Math.abs(co[n]!) <= scale * 1e-14) n--;
  if (n < 1) return 0;                                     // a nonzero constant has no root
  // The noise floor of evaluating this polynomial: `scale` bounds every coefficient and
  // |t| <= 1, so a value this small is indistinguishable from zero however it was reached.
  const fTol = scale * 8e-16;
  if (n === 1) {
    const t = -co[0]! / co[1]!;
    if (t >= 0 && t <= 1) { out[0] = t; return 1; }
    return 0;
  }
  if (n === 2) {
    // Closed form, so the recursion bottoms out two levels earlier than it otherwise
    // would. Written in the cancellation-avoiding form: -b - sign(b)·sqrt(disc) keeps the
    // large root accurate, and the small one comes from the product of the roots rather
    // than from a subtraction of two nearly equal numbers.
    const cc = co[0]!, bb = co[1]!, aa = co[2]!;
    const disc = bb * bb - 4 * aa * cc;
    if (disc < 0) return 0;
    const s = Math.sqrt(disc);
    const r1 = (-bb - (bb < 0 ? -s : s)) / 2;
    const t1 = r1 / aa;
    const t2 = r1 !== 0 ? cc / r1 : t1;
    const lo = Math.min(t1, t2), hi = Math.max(t1, t2);
    let count = 0;
    if (lo >= 0 && lo <= 1) out[count++] = lo;
    if (hi > lo && hi >= 0 && hi <= 1) out[count++] = hi;
    return count;
  }

  // The derivative goes into the next level's buffer, which that level is then free to
  // trim in place. Newton does not need a copy of it: `polyEvalD` gets the slope out of
  // the same sweep as the value.
  const dc = CO_BUF[depth + 1]!;
  for (let i = 1; i <= n; i++) dc[i - 1] = co[i]! * i;
  const knots = KN_BUF[depth]!;
  const nk = rootsIn01(dc, n, depth + 1, knots);

  let count = 0;
  let pt = 0, pf = polyEval(co, n, 0);
  if (pf === 0) out[count++] = 0;
  // Knots arrive ascending (each level emits its brackets left to right), so this walks
  // the domain in order and every root comes out ascending too.
  for (let i = 0; i <= nk; i++) {
    const k = i < nk ? knots[i]! : 1;
    if (k <= pt) { pt = k; continue; }                     // duplicate or out-of-order knot
    const f = polyEval(co, n, k);
    if (f === 0) out[count++] = k;
    // Rising through zero is a MINIMUM of the objective this polynomial differentiates;
    // falling through it is a maximum. `minimaOnly` locates the maxima but does not refine
    // them - worth about an eighth of the brackets, measured - and is only ever set by the
    // one caller that wants the smallest distance. It must stay off inside the recursion,
    // where the roots are isolating knots and every one of them is needed.
    else if (pf < 0 && f > 0) out[count++] = rootInBracket(co, n, pt, k, pf, f, fTol);
    else if (pf > 0 && f < 0 && !minimaOnly) out[count++] = rootInBracket(co, n, pt, k, pf, f, fTol);
    pt = k; pf = f;
  }
  if (withCritical) for (let i = 0; i < nk; i++) out[count++] = knots[i]!;
  return count;
}

/**
 * Nearest point on the curve to an arbitrary point: its parameter, position and
 * distance.
 *
 * Wanted by three callers that look unrelated and are not: a pen tool's hit testing
 * and "insert node here", snapping, and - the reason it lives in the kernel rather
 * than in a UI - measuring the true error of an approximate offset curve, which is
 * how Stage 3 decides where to subdivide. Also the retain test in offset.ts, which
 * decides which contours of an offset are material at all, so a wrong answer here does
 * not degrade a result, it deletes or invents whole shapes.
 *
 * ## Solved, not searched
 *
 * The nearest point satisfies `(C(t) - P) · C'(t) = 0` - the vector to the point is
 * perpendicular to the tangent. C is cubic and C' quadratic, so that condition is a
 * QUINTIC in t with coefficients in closed form from the control points and P. So this
 * is a root-finding problem with an exact statement, and the answer is the best of every
 * real root in [0,1] together with both endpoints (which are frequently the answer and
 * are not roots of anything).
 *
 * The previous implementation sampled a grid, picked the best sample and Newton-refined
 * from there. That chooses a BASIN, and on a curve whose branches pass close to one
 * another it refines the wrong one and returns the grid's answer as if it had converged.
 * Measured, on `[158.5518,54.1091, 110.9633,109.922, 83.2758,14.6683, 117.2366,72.005]`
 * and (115.0318, 68.3539): 4.287e-1 at 24 samples and still 4.287e-1 at 200, against a
 * true 5.140e-6. Solving the quintic removes the basin choice, and with it the parameter
 * that was supposed to control it.
 *
 * @param _samples Deprecated and ignored, kept only so existing positional calls still
 *   compile. There is no sample grid any more, so there is nothing for it to size.
 */
export function nearestOnCubic(c: Cubic, px: number, py: number, _samples?: number): { t: number; point: Pt; distance: number } {
  // C(t) - P and C'(t) in the power basis. Bernstein → power is exact (integer
  // combinations of the controls), and the products below are then plain dot products.
  const ax = -c[0] + 3 * c[2] - 3 * c[4] + c[6], ay = -c[1] + 3 * c[3] - 3 * c[5] + c[7];
  const bx = 3 * c[0] - 6 * c[2] + 3 * c[4], by = 3 * c[1] - 6 * c[3] + 3 * c[5];
  const dx = -3 * c[0] + 3 * c[2], dy = -3 * c[1] + 3 * c[3];
  const fx = c[0] - px, fy = c[1] - py;
  const AA = ax * ax + ay * ay, AB = ax * bx + ay * by, AD = ax * dx + ay * dy, AF = ax * fx + ay * fy;
  const BB = bx * bx + by * by, BD = bx * dx + by * dy, BF = bx * fx + by * fy;
  const DD = dx * dx + dy * dy, DF = dx * fx + dy * fy;
  // (A t³ + B t² + D t + F) · (3A t² + 2B t + D), gathered by power of t, ascending.
  const q = CO_BUF[0]!;
  q[0] = DF; q[1] = DD + 2 * BF; q[2] = 3 * (BD + AF); q[3] = 4 * AD + 2 * BB; q[4] = 5 * AB; q[5] = 3 * AA;
  const cand = NEAREST_OUT;
  const n = rootsIn01(q, 6, 0, cand, true, true);

  // Both endpoints join the candidate list. They are genuinely the answer a great deal of
  // the time and are not roots of anything, so the root solve alone would miss them - the
  // classic omission in this algorithm - and having them there also means a curve whose
  // quintic degenerated to nothing (every control point coincident) still returns a real
  // point rather than Infinity.
  cand[n] = 0; cand[n + 1] = 1;
  let bestT = 0, bestD2 = Infinity, bestP: Pt = { x: c[0], y: c[1] };
  for (let i = 0; i <= n + 1; i++) {
    let t = cand[i]!;
    if (!(t >= 0)) t = 0; else if (t > 1) t = 1;
    const p = evalCubic(c, t);
    const d2 = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d2 < bestD2) { bestD2 = d2; bestT = t; bestP = p; }
  }
  return { t: bestT, point: bestP, distance: Math.sqrt(bestD2) };
}

/** Signed area enclosed by the curve and the chord closing it, by Green's theorem.
 *  Exact for a cubic - no sampling. Used for winding and orientation. */
export function signedAreaCubic(c: Cubic): number {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = c;
  return (
    x0 * (-2 * y1 - y2 + 3 * y3) +
    x1 * (2 * y0 - y2 - y3) +
    x2 * (y0 + y1 - 2 * y3) +
    x3 * (-3 * y0 + y1 + 2 * y2)
  ) * 0.15;   // 3/20
}
