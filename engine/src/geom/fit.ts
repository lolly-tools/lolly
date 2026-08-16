// SPDX-License-Identifier: MPL-2.0
/**
 * Fitting cubics to a curve that has no Bézier form - an exact offset, a stroke edge,
 * a distorted path. Stage 3 needs this: the offset of a cubic is not a cubic, so the
 * only honest way to emit one is to approximate it and then *measure* the true error.
 *
 * ## The decisive choice: match area and moment, don't least-squares the samples
 *
 * Pin the endpoints and the end tangent *directions* to the source (G1) and a cubic has
 * exactly two degrees of freedom left - the two control-arm lengths. Two scalar
 * constraints therefore determine it outright, with no iteration. Raph Levien's
 * choice of constraints is signed area and the first x-moment of area: both are global
 * (a local wobble cannot hide in them), both are exactly computable from the source by
 * Green's theorem, and the moment is close to orthogonal to the area, so the pair pins
 * the shape rather than measuring the same thing twice. Substituting one into the other
 * collapses the system to a quartic in one arm length, solved in closed form.
 *
 * That is worth the trouble because it converges at O(n⁻⁶): halving a segment divides
 * the error by ~64. A least-squares fit over sampled points manages O(n⁻⁴) at best and
 * a Tiller-Hanson construction O(n⁻²) - "only a constant factor better than subdividing
 * into lines". At O(n⁻⁶) a tenfold tighter tolerance costs well under twice the
 * segments, which is why the output stays small enough to be worth calling vector.
 *
 * ## Sampling the source is not flattening it
 *
 * This file evaluates the source at a few dozen parameters per candidate, and at a few
 * dozen more around each peak of the error. None of those coordinates become output. The control points come from a closed-form solve of two
 * integral invariants; the source is evaluated exactly at whatever `t` is asked for; and
 * the error is measured against the real curve rather than against a polyline of it.
 * Quadrature over a smooth integrand is numerical analysis, not the corner-cutting the
 * kernel refuses - a 16-point Gauss-Legendre rule is exact to rounding for the degree-8
 * integrands a cubic source produces, and is the documented fallback only for sources
 * (offsets) whose integrals have no closed form.
 *
 * ## Fréchet, not Hausdorff
 *
 * The error metric compares points in order - the leash between two walkers, neither
 * allowed to go backwards. Hausdorff distance drops the ordering and therefore calls a
 * sharp zigzag "close" to a straight line, which is exactly the failure mode of a
 * fitted approximation. Fréchet also preserves winding number on filled paths, and this
 * output feeds a self-union, so filled is the case that matters.
 *
 * And it is measured as a maximum that is SEARCHED FOR, not sampled. A max over a fixed
 * grid bounds nothing - the peak is what falls between samples - so accepting a piece on
 * one means the tolerance a caller asked for is not the one they got.
 *
 * ## Distance is not the whole of quality
 *
 * Fréchet distance bounds *position* error and says nothing about *angle* error, so the
 * curve that best minimises it can still be visibly bumpy - one long control arm and one
 * short, a hair away from a cusp. That is not a bug in the optimiser, it is the
 * optimiser succeeding at the stated objective, and better subdivision makes it worse.
 * `armPenalty` is the mitigation: a ReLU multiplier on the measured error above an arm
 * length of 0.65 chords, which both filters and re-ranks candidates. It costs about one
 * extra segment per path.
 */
import { type Cubic, evalCubic, tangentAt, subCubic, lineToCubic } from './bezier.ts';
import { cubicRoots01 } from './intersect.ts';

/** A curve that can be sampled but has no Bézier form - an exact offset, a stroke edge,
 *  a transformed curve. The whole point: fit the REAL curve, not a polyline of it. */
export interface ParamCurveFit {
  /** Position and first derivative at t in [0,1]. */
  sample(t: number): { x: number; y: number; dx: number; dy: number };
  /**
   * Signed area and x-moment of the region under the curve over [t0,t1], by Green's
   * theorem. Analytic where the source can do it; a callers' default is provided.
   *
   * Both are taken in the CHORD FRAME of that range - origin at the point at `t0`,
   * x-axis towards the point at `t1` - because those are the two frame-invariant
   * quantities the fit consumes, and a source computing them analytically can produce
   * them directly. `area` closes the region with the chord; `moment` is that region's
   * first moment about the chord-perpendicular axis through the start point. Both are
   * in the source's own units, unscaled. `quadratureMoments` derives them from the raw
   * ∫y dx, ∫xy dx and ∫y² dx for any source that cannot do better.
   */
  momentIntegrals(t0: number, t1: number): { area: number; moment: number };
  /** Optional: parameters where the curve has a cusp or curvature discontinuity, so the
   *  fitter subdivides there rather than trying to span it. */
  breaks?(): number[];
}

export interface FitOptions { tol?: number; maxSegments?: number; optimise?: boolean }

/** Above this the ReLU penalty starts biting. Well below the ~0.85 where a cubic
 *  actually threatens to cusp, and below the 4/3·(1/3) ≈ 0.44 arm of a circular arc,
 *  so it engages long before anything degenerates. Empirical, and tunable. */
const D_PENALTY_ELBOW = 0.65;
const D_PENALTY_SLOPE = 2.0;

/**
 * `fitCubicMoment` refuses a WINNING candidate whose arms exceed this many chords.
 *
 * Applied to the winner, never used to cull the candidate list: culling first means a
 * source cubic with long arms has its own exact solution removed and then gets a
 * different branch returned as if it were right, which is worse than returning nothing.
 * Deliberately generous, too - a hard exclusion at the 0.85 cusp threshold is the
 * cheaper published variant of the bump fix, and it breaks the property that feeding an
 * exact cubic in returns the same cubic out. Ranking quality is `armPenalty`'s job; this
 * only stops a looped "nemesis" root escaping when there is no tolerance to reject it.
 */
const MAX_ARM_RATIO = 4;

const N_SAMPLE = 20;
/** |cross| > 0.2·|dot| between consecutive tangents is |tan Δθ| > 0.2 - about 11.3° of
 *  turning in one twentieth of the range. */
const SPICY_THRESH = 0.2;

const DEFAULT_TOL = 0.1;
const DEFAULT_MAX_SEGMENTS = 512;
const MAX_DEPTH = 20;

/** 16-point Gauss-Legendre on [-1,1] as (weight, abscissa). Exact for polynomials to
 *  degree 31, so for a cubic source - whose moment integrands are degree 8 - the
 *  "numeric" path is exact to rounding. */
const GL16: readonly (readonly [number, number])[] = [
  [0.1894506104550685, -0.0950125098376374], [0.1894506104550685, 0.0950125098376374],
  [0.1826034150449236, -0.2816035507792589], [0.1826034150449236, 0.2816035507792589],
  [0.1691565193950025, -0.4580167776572274], [0.1691565193950025, 0.4580167776572274],
  [0.1495959888165767, -0.6178762444026438], [0.1495959888165767, 0.6178762444026438],
  [0.1246289712555339, -0.7554044083550030], [0.1246289712555339, 0.7554044083550030],
  [0.0951585116824928, -0.8656312023878318], [0.0951585116824928, 0.8656312023878318],
  [0.0622535239386479, -0.9445750230732326], [0.0622535239386479, 0.9445750230732326],
  [0.0271524594117541, -0.9894009349916499], [0.0271524594117541, 0.9894009349916499],
];

// ── moment integrals ──────────────────────────────────────────────────────────

/** The three raw Green's-theorem integrals along a piece of curve: ∫y dx, ∫x y dx and
 *  ∫y² dx, in the source's own coordinates. Additive along a path, which is what lets a
 *  polycubic source sum them per segment. */
interface RawMoments { a: number; x: number; y: number }

/**
 * Raw integrals → the two chord-frame invariants.
 *
 * Every line here is arithmetic that changes the answer: subtracting the chord closes
 * the region, the two translations move the start point to the origin, and the dot with
 * the chord vector rotates the x-moment into the chord frame. The lone `0.5` on the y
 * line comes from ∬y dA = −½∮y² dx and has no counterpart on the x line; drop it and
 * the fit still converges to smooth-looking curves that are systematically wrong by an
 * amount growing with the curve's distance from the x axis.
 */
function chordFrameMoments(raw: RawMoments, x0: number, y0: number, dx: number, dy: number): { area: number; moment: number } {
  let { a: area, x, y } = raw;
  area -= dx * (y0 + 0.5 * dy);
  const dy3 = dy / 3;
  x -= dx * (x0 * y0 + 0.5 * (x0 * dy + y0 * dx) + dy3 * dx);
  y -= dx * (y0 * y0 + y0 * dy + dy3 * dy);
  x -= x0 * area;
  y = 0.5 * y - y0 * area;
  const chord = Math.hypot(dx, dy);
  return { area, moment: chord > 0 ? (dx * x + dy * y) / chord : 0 };
}

/**
 * The default `momentIntegrals` for a source with no closed form - 16-point
 * Gauss-Legendre over [t0,t1], plus the two endpoint samples that define the chord.
 *
 * A fallback, and named as one: an offset curve's integrals genuinely have no closed
 * form, so quadrature is the correct tool rather than a shortcut. It is not sampling the
 * shape - the integrand is smooth and the rule is exact for polynomials to degree 31.
 */
export function quadratureMoments(
  sample: (t: number) => { x: number; y: number; dx: number; dy: number },
  t0: number,
  t1: number,
): { area: number; moment: number } {
  const mid = 0.5 * (t0 + t1), half = 0.5 * (t1 - t0);
  let a = 0, x = 0, y = 0;
  for (const [w, xi] of GL16) {
    const s = sample(mid + xi * half);
    const wa = w * s.dx * s.y;
    a += wa; x += s.x * wa; y += s.y * wa;
  }
  const s0 = sample(t0), s1 = sample(t1);
  return chordFrameMoments({ a: a * half, x: x * half, y: y * half }, s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
}

/** Raw integrals of one whole cubic, in closed form. The expression is machine-derived
 *  and unreadable by design; it is here so a cubic source never pays for quadrature and
 *  so the quadrature path has an exact oracle to be checked against. */
function rawMomentsCubic(c: Cubic): RawMoments {
  const x0 = c[0], y0 = c[1];
  const x1 = c[2] - x0, y1 = c[3] - y0;
  const x2 = c[4] - x0, y2 = c[5] - y0;
  const x3 = c[6] - x0, y3 = c[7] - y0;

  const r0 = 3 * x1, r1 = 3 * y1;
  const r2 = x2 * y3, r3 = x3 * y2, r4 = x3 * y3;
  const r5 = 27 * y1, r6 = x1 * x2, r7 = 27 * y2, r8 = 45 * r2, r9 = 18 * x3;
  const r10 = x1 * y1, r11 = 30 * x1, r12 = 45 * x3, r13 = x2 * y1, r14 = 45 * r3;
  const r15 = x1 * x1, r16 = 18 * y3, r17 = x2 * x2, r18 = 45 * y3, r19 = x3 * x3;
  const r20 = 30 * y1, r21 = y2 * y2, r22 = y3 * y3, r23 = y1 * y1;

  const a = -r0 * y2 - r0 * y3 + r1 * x2 + r1 * x3 - 6 * r2 + 6 * r3 + 10 * r4;
  // Back to absolute coordinates: the piece was translated to the origin above.
  const lift = x3 * y0;
  const area = a * 0.05 + lift;
  const x = r10 * r9 - r11 * r4 + r12 * r13 + r14 * x2 - r15 * r16 - r15 * r7 - r17 * r18
    + r17 * r5 + r19 * r20 + 105 * r19 * y2 + 280 * r19 * y3 - 105 * r2 * x3
    + r5 * r6 - r6 * r7 - r8 * x1;
  const y = -r10 * r16 - r10 * r7 - r11 * r22 + r12 * r21 + r13 * r7 + r14 * y1 - r18 * x1 * y2
    + r20 * r4 - 27 * r21 * x1 - 105 * r22 * x2 + 140 * r22 * x3 + r23 * r9 + 27 * r23 * x2
    + 105 * r3 * y3 - r8 * y2;

  return {
    a: area,
    x: x * (1 / 840) + x0 * area + 0.5 * x3 * lift,
    y: y * (1 / 420) + y0 * a * 0.1 + y0 * lift,
  };
}

/**
 * Adapter: any existing Cubic as a ParamCurveFit source, with ANALYTIC moment integrals
 * (bezier.ts already has the closed-form signed area; the x-moment is the same kind of
 * closed form). Used for simplification and as the test oracle's control case.
 *
 * The area it returns is the same quantity `signedAreaCubic(subCubic(c, t0, t1))`
 * computes - a free cross-check on the whole moment pipeline, and one worth keeping in
 * the tests, since an offset source cannot use it.
 */
export function cubicAsSource(c: Cubic): ParamCurveFit {
  return {
    sample(t: number) {
      const p = evalCubic(c, t), d = tangentAt(c, t);
      return { x: p.x, y: p.y, dx: d.x, dy: d.y };
    },
    momentIntegrals(t0: number, t1: number) {
      const piece = subCubic(c, t0, t1);
      return chordFrameMoments(rawMomentsCubic(piece), piece[0], piece[1], piece[6] - piece[0], piece[7] - piece[1]);
    },
  };
}

// ── polynomial solvers ────────────────────────────────────────────────────────

/** Sign transfer that respects −0, because the quartic factoring branches on it. */
function copysign(mag: number, sign: number): number {
  const m = Math.abs(mag);
  return sign < 0 || Object.is(sign, -0) ? -m : m;
}

/**
 * Real roots of c0 + c1·x + c2·x², ASCENDING coefficients and unrestricted range.
 *
 * `cubicRoots01` in intersect.ts cannot be reused for the fit's quartic work: its
 * coefficients are descending and it clamps to [0,1], while a control-arm length is a
 * positive number of chords that routinely exceeds 1. Transposing the two conventions
 * yields plausible-looking wrong roots rather than an obvious failure, which is why
 * these live here with the order stated in the name's own comment.
 */
function solveQuadratic(c0: number, c1: number, c2: number): number[] {
  const sc0 = c0 / c2, sc1 = c1 / c2;
  if (!Number.isFinite(sc0) || !Number.isFinite(sc1)) {
    // c2 vanishes: treat as linear.
    const root = -c0 / c1;
    if (Number.isFinite(root)) return [root];
    return c0 === 0 && c1 === 0 ? [0] : [];
  }
  const arg = sc1 * sc1 - 4 * sc0;
  let root1: number;
  if (!Number.isFinite(arg)) {
    root1 = -sc1;
  } else if (arg < 0) {
    return [];
  } else if (arg === 0) {
    return [-0.5 * sc1];
  } else {
    // The stable branch: never subtract two nearly equal quantities.
    root1 = -0.5 * (sc1 + copysign(Math.sqrt(arg), sc1));
  }
  const root2 = sc0 / root1;
  if (!Number.isFinite(root2)) return [root1];
  return root2 > root1 ? [root1, root2] : [root2, root1];
}

/** Real roots of c0 + c1·x + c2·x² + c3·x³, ASCENDING coefficients, unrestricted range.
 *  Blinn's formulation via the depressed discriminant - better conditioned near a double
 *  root than textbook Cardano, which is the case the fit's quartic keeps producing. */
function solveCubic(c0: number, c1: number, c2: number, c3: number): number[] {
  const recip = 1 / c3, third = 1 / 3;
  const s2 = c2 * (third * recip), s1 = c1 * (third * recip), s0 = c0 * recip;
  if (!(Number.isFinite(s0) && Number.isFinite(s1) && Number.isFinite(s2))) {
    return solveQuadratic(c0, c1, c2);
  }
  const d0 = -s2 * s2 + s1;
  const d1 = -s1 * s2 + s0;
  const d2 = s2 * s0 - s1 * s1;
  const disc = 4 * d0 * d2 - d1 * d1;
  const de = -2 * s2 * d0 + d1;
  if (disc < 0) {
    const sq = Math.sqrt(-0.25 * disc), r = -0.5 * de;
    return [Math.cbrt(r + sq) + Math.cbrt(r - sq) - s2];
  }
  if (disc === 0) {
    const t1 = copysign(Math.sqrt(-d0), de);
    return [t1 - s2, -2 * t1 - s2];
  }
  const th = Math.atan2(Math.sqrt(disc), -de) * third;
  const thc = Math.cos(th), ss3 = Math.sin(th) * Math.sqrt(3);
  const t = 2 * Math.sqrt(-d0);
  return [t * thc - s2, t * 0.5 * (-thc + ss3) - s2, t * 0.5 * (-thc - ss3) - s2];
}

/** Dominant root of the depressed cubic x³ + g·x + h. */
function depressedCubicDominant(g: number, h: number): number {
  const q = (-1 / 3) * g, r = 0.5 * h;
  let x: number;
  if (r === 0) {
    x = g > 0 ? 0 : Math.sqrt(-g);
  } else if (r * r < q * q * q) {
    const t = r / Math.sqrt(q * q * q);
    x = -2 * Math.sqrt(q) * copysign(Math.cos(Math.acos(Math.abs(t)) * (1 / 3)), t);
  } else {
    const a = Math.cbrt(-r - copysign(Math.sqrt(r * r - q * q * q), r));
    x = a === 0 ? 0 : a + q / a;
  }
  let f = (x * x + g) * x + h;
  const scale = Math.max(Math.abs(x * x * x), Math.abs(g * x), Math.abs(h));
  if (Math.abs(f) < 2.22045e-16 * scale) return x;
  for (let i = 0; i < 8; i++) {
    const df = 3 * x * x + g;
    if (df === 0) break;
    const nx = x - f / df;
    const nf = (nx * nx + g) * nx + h;
    if (nf === 0) return nx;
    if (Math.abs(nf) >= Math.abs(f)) break;
    x = nx; f = nf;
  }
  return x;
}

/**
 * Factor x⁴ + a·x³ + b·x² + c·x + d into two quadratics x² + α·x + β.
 *
 * Orellana & De Michele (ACM TOMS Algorithm 1010), and the reason the fit does not call
 * a stock quartic root finder. The quartic here routinely has near-double roots - that
 * is what it means geometrically for three of its roots to give visually identical
 * curves - and companion-matrix or naive Cardano solvers lose many digits there, which
 * shows up directly as a worse fit. Factoring keeps the pair intact and, critically,
 * keeps a complex conjugate pair recoverable: its real part is a candidate the caller
 * must not discard.
 *
 * Returns null when the factorisation would need complex coefficients, or overflows.
 */
function factorQuartic(a: number, b: number, c: number, d: number): [[number, number], [number, number]] | null {
  const epsRel = (raw: number, ref: number) => (ref === 0 ? Math.abs(raw) : Math.abs((raw - ref) / ref));
  const epsQ = (a1: number, b1: number, a2: number, b2: number) =>
    epsRel(a1 + a2, a) + epsRel(b1 + a1 * a2 + b2, b) + epsRel(b1 * a2 + a1 * b2, c);
  const epsT = (a1: number, b1: number, a2: number, b2: number) => epsQ(a1, b1, a2, b2) + epsRel(b1 * b2, d);

  const disc = 9 * a * a - 24 * b;
  const s = disc >= 0 ? (-2 * b) / (3 * a + copysign(Math.sqrt(disc), a)) : -0.25 * a;
  const ap = a + 4 * s;
  const bp = b + 3 * s * (a + 2 * s);
  const cp = c + s * (2 * b + s * (3 * a + 4 * s));
  const dp = d + s * (c + s * (b + s * (a + s)));
  const gp = ap * cp - 4 * dp - (1 / 3) * bp * bp;
  const hp = (ap * cp + 8 * dp - (2 / 9) * bp * bp) * (1 / 3) * bp - cp * cp - ap * ap * dp;
  if (!Number.isFinite(gp) || !Number.isFinite(hp)) return null;

  const phi = depressedCubicDominant(gp, hp);
  if (!Number.isFinite(phi)) return null;
  const l1 = a * 0.5;
  const l3 = (1 / 6) * b + 0.5 * phi;
  const delt2 = c - a * l3;
  const d2c1 = (2 / 3) * b - phi - l1 * l1;
  const l2c1 = (0.5 * delt2) / d2c1;
  const l2c2 = (2 * (d - l3 * l3)) / delt2;
  const d2c2 = (0.5 * delt2) / l2c2;

  let d2 = 0, l2 = 0, bestEps = 0;
  const cands: [number, number][] = [[d2c1, l2c1], [d2c2, l2c2], [d2c1, l2c2]];
  for (let i = 0; i < cands.length; i++) {
    const [cd, cl] = cands[i]!;
    const e = epsRel(cd + l1 * l1 + 2 * l3, b) + epsRel(2 * (cd * cl + l1 * l3), c) + epsRel(cd * cl * cl + l3 * l3, d);
    if (i === 0 || e < bestEps) { d2 = cd; l2 = cl; bestEps = e; }
  }

  let a1: number, b1: number, a2: number, b2: number;
  if (d2 < 0) {
    const sq = Math.sqrt(-d2);
    a1 = l1 + sq; b1 = l3 + sq * l2;
    a2 = l1 - sq; b2 = l3 - sq * l2;
    if (Math.abs(b2) < Math.abs(b1)) b2 = d / b1;
    else if (Math.abs(b2) > Math.abs(b1)) b1 = d / b2;
    if (Math.abs(a1) !== Math.abs(a2)) {
      // Recover the larger-magnitude α from the smaller, three ways, and keep whichever
      // reproduces the original coefficients best. The subtraction form is first because
      // it cannot divide by zero.
      const o1 = a1, o2 = a2;
      const alts: [number, number][] = Math.abs(o1) < Math.abs(o2)
        ? [[a - o2, o2], [(c - b1 * o2) / b2, o2], [(b - b2 - b1) / o2, o2]]
        : [[o1, a - o1], [o1, (c - o1 * b2) / b1], [o1, (b - b2 - b1) / o1]];
      let bestQ = 0, has = false;
      for (const [t1, t2] of alts) {
        if (!Number.isFinite(t1) || !Number.isFinite(t2)) continue;
        const e = epsQ(t1, b1, t2, b2);
        if (!has || e < bestQ) { a1 = t1; a2 = t2; bestQ = e; has = true; }
      }
    }
  } else if (d2 === 0) {
    const d3 = d - l3 * l3;
    const sq = Math.sqrt(-d3);
    a1 = l1; b1 = l3 + sq;
    a2 = l1; b2 = l3 - sq;
    if (Math.abs(b1) > Math.abs(b2)) b2 = d / b1;
    else if (Math.abs(b2) > Math.abs(b1)) b1 = d / b2;
  } else {
    // No real roots at all; the general case would need complex coefficients.
    return null;
  }

  let eps = epsT(a1, b1, a2, b2);
  for (let i = 0; i < 8 && eps !== 0; i++) {
    const f0 = b1 * b2 - d;
    const f1 = b1 * a2 + a1 * b2 - c;
    const f2 = b1 + a1 * a2 + b2 - b;
    const f3 = a1 + a2 - a;
    const k1 = a1 - a2;
    const det = b1 * b1 - b1 * (a2 * k1 + 2 * b2) + b2 * (a1 * k1 + b2);
    if (det === 0) break;
    const inv = 1 / det;
    const k2 = b2 - b1;
    const k3 = b1 * a2 - a1 * b2;
    const na1 = a1 - inv * (k1 * f0 + k2 * f1 + k3 * f2 - (b1 * k2 + a1 * k3) * f3);
    const nb1 = b1 - inv * ((a1 * k1 + k2) * f0 - b1 * k1 * f1 - b1 * k2 * f2 - b1 * k3 * f3);
    const na2 = a2 - inv * (-k1 * f0 - k2 * f1 - k3 * f2 + (a2 * k3 + b2 * k2) * f3);
    const nb2 = b2 - inv * (-(a2 * k1 + k2) * f0 + b2 * k1 * f1 + b2 * k2 * f2 + b2 * k3 * f3);
    const ne = epsT(na1, nb1, na2, nb2);
    if (!(ne < eps)) break;
    a1 = na1; b1 = nb1; a2 = na2; b2 = nb2; eps = ne;
  }
  return [[a1, b1], [a2, b2]];
}

// ── the closed-form fit ───────────────────────────────────────────────────────

/** Reduce an angle into (−π, π]. */
function mod2pi(th: number): number {
  const s = th * (0.5 / Math.PI);
  return 2 * Math.PI * (s - Math.round(s));
}

interface Frame {
  sx: number; sy: number; ex: number; ey: number;
  /** Chord direction, and the two end deflections measured from it. */
  th: number; th0: number; th1: number;
  chord: number; chord2: number;
  /** The invariants, scaled to a unit chord. */
  unitArea: number; mx: number;
}

/**
 * Sample an endpoint's position and tangent DIRECTION, from the side the range is on.
 *
 * `dir` is +1 at the start of a range and −1 at its end. `sample` has no side argument,
 * so at a cusp or corner the source returns whichever branch it happens to choose, and
 * for one of the two ranges meeting there that is the WRONG side - a fit is then handed
 * an end tangent belonging to the neighbouring piece and can only fail. A probe a
 * ten-millionth of the range inside settles it: if the two directions disagree by more
 * than about a degree, the endpoint's belongs to the other side and the probe's is used.
 * A smooth source has to turn that far within 1e-7 of the range to false-trigger, by
 * which point no fit was going to succeed anyway.
 *
 * The same probe covers a vanishing derivative - a cusp exactly on the endpoint - where
 * there is no direction to read at all.
 */
function endpointSample(src: ParamCurveFit, t: number, dir: number, span: number): { x: number; y: number; tx: number; ty: number } {
  const s = src.sample(t);
  let tx = s.dx, ty = s.dy;
  const len = Math.hypot(tx, ty);
  let step = span * 1e-7;
  if (len > 1e-12) {
    const probe = src.sample(clamp01(t + dir * step));
    const pl = Math.hypot(probe.dx, probe.dy);
    if (pl > 1e-12) {
      const sin = Math.abs(tx * probe.dy - ty * probe.dx) / (len * pl);
      const cos = (tx * probe.dx + ty * probe.dy) / (len * pl);
      if (cos < 0 || sin > 0.02) { tx = probe.dx; ty = probe.dy; }
    }
    return { x: s.x, y: s.y, tx, ty };
  }
  for (let i = 0; i < 6 && Math.hypot(tx, ty) < 1e-12; i++) {
    const probe = src.sample(clamp01(t + dir * step));
    tx = probe.dx; ty = probe.dy;
    // Still nothing: fall back to the chord to the probe, which at least has a direction.
    if (Math.hypot(tx, ty) < 1e-12) { tx = probe.x - s.x; ty = probe.y - s.y; }
    step *= 8;
  }
  return { x: s.x, y: s.y, tx, ty };
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** The unit-chord frame of [t0,t1] plus the two invariants expressed in it. Null when
 *  the chord is degenerate - the whole normalisation divides by its length. */
function frameFor(src: ParamCurveFit, t0: number, t1: number): Frame | null {
  const span = Math.abs(t1 - t0);
  const start = endpointSample(src, t0, 1, span);
  const end = endpointSample(src, t1, -1, span);
  const dx = end.x - start.x, dy = end.y - start.y;
  const chord2 = dx * dx + dy * dy;
  if (!(chord2 > 0) || !Number.isFinite(chord2)) return null;
  const chord = Math.sqrt(chord2);
  const th = Math.atan2(dy, dx);
  const th0 = mod2pi(Math.atan2(start.ty, start.tx) - th);
  const th1 = mod2pi(th - Math.atan2(end.ty, end.tx));
  const { area, moment } = src.momentIntegrals(t0, t1);
  if (!Number.isFinite(area) || !Number.isFinite(moment)) return null;
  return {
    sx: start.x, sy: start.y, ex: end.x, ey: end.y,
    th, th0, th1, chord, chord2,
    unitArea: area / chord2,
    mx: moment / (chord2 * chord),
  };
}

interface Candidate { c: Cubic; d0: number; d1: number }

/**
 * Every cubic in the unit frame whose area and x-moment match the source's, mapped back
 * into the source's coordinates. Up to four, and they must all be measured: for a
 * C-shaped source three of them are visually near-identical (which is precisely why an
 * iterative fitter gets stuck in local minima) and the fourth is a looped curve whose
 * loop lobe cancels the excess area and moment exactly - a valid solution of both
 * constraints and nothing like the source.
 */
function candidates(f: Frame): Candidate[] {
  const s0 = Math.sin(f.th0), c0 = Math.cos(f.th0);
  const s1 = Math.sin(f.th1), c1 = Math.cos(f.th1);
  const area = f.unitArea, mx = f.mx;

  // The quartic in δ0, from substituting the area relation (linear in δ1) into the
  // moment relation and clearing denominators. Nested exactly as derived, so there is
  // no bracketing to second-guess.
  const a4 = -9 * c0 * (((2 * s1 * c1 * c0 + s0 * (2 * c1 * c1 - 1)) * c0 - 2 * s1 * c1) * c0 - c1 * c1 * s0);
  const a3 = 12 * ((((c1 * (30 * area * c1 - s1) - 15 * area) * c0 + 2 * s0
    - c1 * s0 * (c1 + 30 * area * s1)) * c0
    + c1 * (s1 - 15 * area * c1)) * c0
    - s0 * c1 * c1);
  const a2 = 12 * ((((70 * mx + 15 * area) * s1 * s1 + c1 * (9 * s1 - 70 * c1 * mx - 5 * c1 * area)) * c0
    - 5 * s0 * s1 * (3 * s1 - 4 * c1 * (7 * mx + area))) * c0
    - c1 * (9 * s1 - 70 * c1 * mx - 5 * c1 * area));
  const a1 = 16 * (((12 * s0 - 5 * c0 * (42 * mx - 17 * area)) * s1
    - 70 * c1 * (3 * mx - area) * s0
    - 75 * c0 * c1 * area * area) * s1
    - 75 * c1 * c1 * area * area * s0);
  const a0 = 80 * s1 * (42 * s1 * mx - 25 * area * (s1 - c1 * area));

  // Not only roots: the real part of a complex conjugate pair is kept too.
  const roots: number[] = [];
  const EPS = 1e-12;
  if (Math.abs(a4) > EPS) {
    const quads = factorQuartic(a3 / a4, a2 / a4, a1 / a4, a0 / a4);
    if (quads) {
      for (const [qc1, qc0] of quads) {
        const qr = solveQuadratic(qc0, qc1, 1);
        // A factor with no real roots is not a dead end. These are the "near misses",
        // where the moment residual dips towards zero without crossing - genuine error
        // minima, often better than the real crossings. Dropping them makes the fit
        // error DISCONTINUOUS in the source, so a dragged curve visibly jumps branches.
        if (qr.length === 0) roots.push(-0.5 * qc1);
        else roots.push(...qr);
      }
    }
  } else if (Math.abs(a3) > EPS) {
    roots.push(...solveCubic(a0, a1, a2, a3));
  } else if (Math.abs(a2) > EPS || Math.abs(a1) > EPS || Math.abs(a0) > EPS) {
    roots.push(...solveQuadratic(a0, a1, a2));
  } else {
    return [mapCandidate(f, 1 / 3, 1 / 3)];
  }

  const s01 = s0 * c1 + s1 * c0;
  const out: Candidate[] = [];
  for (const root of roots) {
    if (!Number.isFinite(root)) continue;
    let d0: number, d1: number;
    if (root > 0) {
      d0 = root;
      d1 = (root * s0 - area * (10 / 3)) / (0.5 * root * s01 - s1);
      if (!(d1 > 0)) {
        // Not a clamp to zero: (s1/s01, 0) puts the surviving control point at the
        // INTERSECTION OF THE TWO END TANGENTS. Zeroing one arm and re-solving the
        // other for exact area instead gets the tangent at the zeroed end visibly
        // wrong. Area is no longer matched here; the error metric decides.
        d0 = s1 / s01; d1 = 0;
      }
    } else {
      d0 = 0; d1 = s0 / s01;
    }
    if (!(d0 >= 0) || !(d1 >= 0) || !Number.isFinite(d0) || !Number.isFinite(d1)) continue;
    out.push(mapCandidate(f, d0, d1));
  }
  return out;
}

/** Unit-frame arm lengths → a cubic in the source's coordinates. */
function mapCandidate(f: Frame, d0: number, d1: number): Candidate {
  const cs = Math.cos(f.th) * f.chord, sn = Math.sin(f.th) * f.chord;
  const place = (ux: number, uy: number): [number, number] => [f.sx + cs * ux - sn * uy, f.sy + sn * ux + cs * uy];
  const [p1x, p1y] = place(d0 * Math.cos(f.th0), d0 * Math.sin(f.th0));
  const [p2x, p2y] = place(1 - d1 * Math.cos(f.th1), d1 * Math.sin(f.th1));
  return { c: [f.sx, f.sy, p1x, p1y, p2x, p2y, f.ex, f.ey], d0, d1 };
}

/** ReLU on the arm length, applied as a multiplier to LINEAR error. Flat below the
 *  elbow, so an ordinary fit is untouched. `max` of the two arms rather than a product
 *  or a sum, because a bump is caused by the asymmetry - one bad arm is enough. */
function armPenalty(d: number): number {
  return 1 + Math.max(0, d - D_PENALTY_ELBOW) * D_PENALTY_SLOPE;
}

// ── the error metric ──────────────────────────────────────────────────────────

interface Sample { x: number; y: number; tx: number; ty: number }

interface CurveDist {
  src: ParamCurveFit;
  samples: Sample[];
  /** Source parameter of each sample. A peak between samples is bracketed by its two
   *  neighbours, so the refinement needs the grid, not just the values. */
  ts: number[];
  /** Cumulative source arc length over the sample spans; built lazily, spicy only. */
  arc: ArcTable | null;
  spicy: boolean;
  t0: number;
  t1: number;
  step: number;
}

function curveDist(src: ParamCurveFit, t0: number, t1: number): CurveDist {
  const step = (t1 - t0) / (N_SAMPLE + 1);
  const samples: Sample[] = [];
  const ts: number[] = [];
  let spicy = false;
  let lx = 0, ly = 0, have = false;
  for (let i = 0; i < N_SAMPLE + 2; i++) {
    const t = t0 + i * step;
    const s = src.sample(t);
    if (have) {
      const cross = s.dx * ly - s.dy * lx;
      const dot = s.dx * lx + s.dy * ly;
      if (Math.abs(cross) > SPICY_THRESH * Math.abs(dot)) spicy = true;
    }
    lx = s.dx; ly = s.dy; have = true;
    // The endpoints inform the spicy test but are not error samples: the fit matches
    // them exactly by construction, so measuring them only dilutes the maximum.
    if (i > 0 && i < N_SAMPLE + 1) { samples.push({ x: s.x, y: s.y, tx: s.dx, ty: s.dy }); ts.push(t); }
  }
  return { src, samples, ts, arc: null, spicy, t0, t1, step };
}

// ── finding the peak, not a sample near it ────────────────────────────────────

/**
 * A max over a fixed grid does not bound anything.
 *
 * The peak of the error is exactly what falls between samples: on the +20 offset of a
 * cubic the peak of the accepted range [0.5,0.75] sits at grid index 10.49, and the
 * twenty-sample maximum read 9.93894e-4 against a true 1.01440e-3 - under tolerance, so
 * the range was accepted at 1.0144× the budget it was measured against. Every sampled
 * range in that fit under-reported, by 0.5% to 2%. So the grid only BRACKETS: each local
 * maximum of the sampled sequence is then refined on the real error function.
 *
 * Golden section rather than a parabola through the three points, because the error
 * function of a fit against a source with a curvature extremum is not locally quadratic
 * and a parabola can extrapolate outside the bracket. Twelve reductions of the bracket
 * leave a measured residual under-report of ~2e-8 of the peak, against the 2e-2 it
 * replaces; the value converges quadratically in the bracket width, so further iterations
 * buy nothing a fit decision can see.
 *
 * Refining every local maximum, not only the largest, because the largest SAMPLE need not
 * sit on the largest lobe. A lobe narrower than one grid step could still hide entirely,
 * but a fit that tracks its source closely enough to be a candidate cannot oscillate that
 * fast - the difference of two cubics has a bounded number of extrema, and twenty samples
 * resolve them.
 */
const REFINE_ITERS = 12;
const INV_PHI = 0.6180339887498949;

function refineLobe(f: (t: number) => number, a: number, b: number, acc2: number): number {
  let lo = a, hi = b;
  let x1 = hi - INV_PHI * (hi - lo), x2 = lo + INV_PHI * (hi - lo);
  let f1 = f(x1), f2 = f(x2);
  let best = f1 > f2 ? f1 : f2;
  for (let i = 0; i < REFINE_ITERS; i++) {
    if (!(best <= acc2)) return best;
    if (f1 > f2) {
      hi = x2; x2 = x1; f2 = f1;
      x1 = hi - INV_PHI * (hi - lo); f1 = f(x1);
      if (f1 > best) best = f1;
    } else {
      lo = x1; x1 = x2; f1 = f2;
      x2 = lo + INV_PHI * (hi - lo); f2 = f(x2);
      if (f2 > best) best = f2;
    }
  }
  return best;
}

/** Sampled values → the true maximum. The outer samples' brackets reach to the range
 *  endpoints, where the error is zero by construction, so no lobe is clipped. */
function maxOverLobes(d: CurveDist, errs: number[], base: number, acc2: number, f: (t: number) => number): number {
  let best = base;
  for (let i = 0; i < errs.length; i++) {
    const e = errs[i]!;
    if (i > 0 && errs[i - 1]! > e) continue;
    if (i + 1 < errs.length && errs[i + 1]! > e) continue;
    const v = refineLobe(f, i > 0 ? d.ts[i - 1]! : d.t0, i + 1 < errs.length ? d.ts[i + 1]! : d.t1, acc2);
    if (v > best) best = v;
    if (!(best <= acc2)) return Infinity;
  }
  return best;
}

/** The candidate in power basis, hoisted out of the per-sample loop: the ray condition
 *  (C(t) − p)·T = 0 is a scalar cubic in it. */
interface Poly { p1x: number; p1y: number; p2x: number; p2y: number; p3x: number; p3y: number }

function powerBasis(c: Cubic): Poly {
  return {
    p1x: 3 * (c[2] - c[0]), p1y: 3 * (c[3] - c[1]),
    p2x: 3 * c[4] - 6 * c[2] + 3 * c[0], p2y: 3 * c[5] - 6 * c[3] + 3 * c[1],
    p3x: c[6] - c[0] - 3 * (c[4] - c[2]), p3y: c[7] - c[1] - 3 * (c[5] - c[3]),
  };
}

/**
 * Tiller-Hanson: cast the normal ray at one source sample and measure to where it meets
 * the candidate.
 *
 * A ray that misses REJECTS the candidate - the answer starts above the budget and stays
 * there. Substituting the candidate's endpoints for a missed ray produces a plausible
 * number for a curve that may be nothing like the source, which is exactly how a looped
 * approximation passes an error check it should fail.
 */
function rayErr2(c: Cubic, q: Poly, s: Sample, miss: number): number {
  const k0 = (c[0] - s.x) * s.tx + (c[1] - s.y) * s.ty;
  const k1 = q.p1x * s.tx + q.p1y * s.ty;
  const k2 = q.p2x * s.tx + q.p2y * s.ty;
  const k3 = q.p3x * s.tx + q.p3y * s.ty;
  let best = miss;
  // cubicRoots01 takes DESCENDING coefficients; the cast derives them ascending.
  for (const t of cubicRoots01(k3, k2, k1, k0)) {
    const p = evalCubic(c, t);
    const e = (p.x - s.x) ** 2 + (p.y - s.y) ** 2;
    if (e < best) best = e;
  }
  return best;
}

function evalRay(d: CurveDist, c: Cubic, acc2: number): number {
  const q = powerBasis(c);
  const miss = acc2 + 1;
  const errs: number[] = [];
  let maxErr2 = 0;
  for (const s of d.samples) {
    const e = rayErr2(c, q, s, miss);
    errs.push(e);
    if (e > maxErr2) maxErr2 = e;
    if (maxErr2 > acc2) return Infinity;
  }
  return maxOverLobes(d, errs, maxErr2, acc2, (t) => {
    const s = d.src.sample(t);
    return rayErr2(c, q, { x: s.x, y: s.y, tx: s.dx, ty: s.dy }, miss);
  });
}

const ARC_SPANS = N_SAMPLE + 1;

interface ArcTable { cum: number[]; total: number }

function arcSpan(c: Cubic, a: number, b: number): number {
  const mid = 0.5 * (a + b), half = 0.5 * (b - a);
  let sum = 0;
  for (const [w, xi] of GL16) {
    const d = tangentAt(c, mid + xi * half);
    sum += w * Math.hypot(d.x, d.y);
  }
  return sum * half;
}

/** Cumulative arc length at 16 equal parameter steps. A prefix table rather than
 *  `lengthCubic`: subdivision-to-flatness is not monotone in `t`, so inverting it wobbles,
 *  and Gauss-Legendre on |C'(t)| is both smooth and cheaper. */
function arcTable(c: Cubic): ArcTable {
  const cum = [0];
  let acc = 0;
  for (let i = 0; i < ARC_SPANS; i++) {
    acc += arcSpan(c, i / ARC_SPANS, (i + 1) / ARC_SPANS);
    cum.push(acc);
  }
  return { cum, total: acc };
}

/** The same prefix table for the SOURCE, over the sample spans, so a refined parameter
 *  between two samples has an arc fraction too - a peak the correspondence can only be
 *  evaluated at on the grid is a peak the metric cannot find. */
function srcArcSpan(src: ParamCurveFit, a: number, b: number): number {
  const mid = 0.5 * (a + b), half = 0.5 * (b - a);
  let sum = 0;
  for (const [w, xi] of GL16) {
    const s = src.sample(mid + xi * half);
    sum += w * Math.hypot(s.dx, s.dy);
  }
  return sum * half;
}

/** Gauss-Legendre per span, matching the rule the candidate's own arc length uses. A
 *  cruder rule here (a midpoint sum over the whole range) does converge, but its
 *  disagreement with the candidate's rule offsets the correspondence and puts a floor of
 *  ~1e-5 of the curve's size under every measured error - enough that a curve measured
 *  against ITSELF does not read as zero. */
function srcArcTable(d: CurveDist): ArcTable {
  const cum = [0];
  let acc = 0;
  for (let i = 0; i < ARC_SPANS; i++) {
    acc += srcArcSpan(d.src, d.t0 + i * d.step, d.t0 + (i + 1) * d.step);
    cum.push(acc);
  }
  return { cum, total: acc };
}

/** Parameter at a given arc length: locate the span, then Newton inside it with |C'| as
 *  the derivative, clamped to the span so it cannot escape its bracket. */
function arcInvert(c: Cubic, tab: ArcTable, target: number): number {
  if (!(tab.total > 0)) return 0;
  const s = Math.min(Math.max(target, 0), tab.total);
  let lo = 0, hi = ARC_SPANS;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (tab.cum[m]! <= s) lo = m; else hi = m;
  }
  const h = 1 / ARC_SPANS, tLo = lo * h, tHi = tLo + h;
  const spanLen = tab.cum[lo + 1]! - tab.cum[lo]!;
  let t = spanLen > 0 ? tLo + h * ((s - tab.cum[lo]!) / spanLen) : tLo;
  for (let i = 0; i < 3; i++) {
    const f = tab.cum[lo]! + arcSpan(c, tLo, t) - s;
    const d = tangentAt(c, t);
    const speed = Math.hypot(d.x, d.y);
    if (speed < 1e-12) break;
    const next = Math.min(tHi, Math.max(tLo, t - f / speed));
    if (Math.abs(next - t) < 1e-13) { t = next; break; }
    t = next;
  }
  return Math.min(1, Math.max(0, t));
}

/**
 * The expensive metric: compare source and candidate at equal FRACTIONS of arc length.
 *
 * Normal-ray casting fails on one specific and non-hypothetical shape - a source
 * approximated by a cubic with a loop, where the rays strike only part of the candidate
 * and miss the loop entirely, reporting a small error for a curve that is nothing like
 * the source. Adding samples does not fix it, because the high curvature that makes ray
 * coverage uneven is the same thing that makes the case arise. Arc-length correspondence
 * compares every part of both curves to something, and approximates Fréchet closely when
 * the curves are near each other - which they are, by assumption, during fitting. It
 * costs about 10× the ray metric, hence the spicy gate.
 */
function evalArc(d: CurveDist, c: Cubic, acc2: number): number {
  if (!d.arc) d.arc = srcArcTable(d);
  const srcTab = d.arc;
  const tab = arcTable(c);
  const at = (s: { x: number; y: number }, frac: number): number => {
    const p = evalCubic(c, arcInvert(c, tab, tab.total * frac));
    return (p.x - s.x) ** 2 + (p.y - s.y) ** 2;
  };
  let maxErr2 = 0;
  for (let i = 0; i < d.samples.length; i++) {
    // Sample i ends span i, so its fraction is the prefix through that span.
    const e = at(d.samples[i]!, srcTab.cum[i + 1]! / (srcTab.total || 1));
    if (e > maxErr2) maxErr2 = e;
    if (maxErr2 > acc2) return Infinity;
  }
  return maxErr2;
}

/**
 * Squared error, or Infinity when the candidate is out of budget or a ray missed.
 *
 * The ray metric supplies the peak and the arc metric the loop guard, so the answer is
 * the larger of the two rather than the arc metric alone. Two reasons it has to be this
 * way round: the arc correspondence can only be evaluated where the source's and the
 * candidate's arc-length grids line up, since off a grid boundary `arcInvert` is a Newton
 * solve accurate to ~1e-6 of the curve rather than to rounding - refine it between
 * samples and a curve measured against ITSELF stops reading zero. And a loop, the case
 * the arc metric exists for, is wrong by far more than one grid step's worth of peak, so
 * it does not need a refined maximum to be caught.
 */
function evalDist(d: CurveDist, c: Cubic, acc2: number): number {
  // The ray metric also early-outs most candidates before any inverse-arc-length work.
  const ray = evalRay(d, c, acc2);
  if (!Number.isFinite(ray)) return Infinity;
  if (!d.spicy) return ray;
  const arc = evalArc(d, c, acc2);
  return arc > ray ? arc : ray;
}

/**
 * Frechet-style error of a candidate cubic against the source over [t0,t1], by
 * Tiller-Hanson normal ray casting, escalating to the arc-length metric on "spicy"
 * (high-curvature) pieces.
 *
 * Linear distance, not squared, and NOT penalised for arm length - the penalty is a
 * fitter policy for choosing between candidates, not a property of this pair of curves.
 * Infinity means a normal ray missed the candidate entirely, which is a rejection.
 */
export function fitError(src: ParamCurveFit, c: Cubic, t0: number, t1: number): number {
  const d = curveDist(src, t0, t1);
  return Math.sqrt(evalDist(d, c, Infinity));
}

// ── fitting one segment ───────────────────────────────────────────────────────

/** The chord raised to a cubic, controls at the thirds. */
function chordCubic(sx: number, sy: number, ex: number, ey: number): Cubic {
  return lineToCubic(sx, sy, ex, ey);
}

/**
 * Fit a straight line instead.
 *
 * For short chords, where dividing by the chord length destabilises everything, and for
 * cusps and near-cusps, where the tangents are not worth trusting - note it ignores
 * tangents completely. Seven interior samples, every one of which must be within `tol`
 * of the chord.
 */
function tryFitLine(src: ParamCurveFit, t0: number, t1: number, tol: number, sx: number, sy: number, ex: number, ey: number): { c: Cubic; err: number } | null {
  const acc2 = tol * tol;
  const SHORT_N = 7;
  const dt = (t1 - t0) / (SHORT_N + 1);
  const dx = ex - sx, dy = ey - sy;
  const len2 = dx * dx + dy * dy;
  let maxErr2 = 0;
  for (let i = 0; i < SHORT_N; i++) {
    const p = src.sample(t0 + (i + 1) * dt);
    // Point-to-segment, not point-to-line: a sample past either end must count its
    // distance to the endpoint.
    const u = len2 > 0 ? Math.min(1, Math.max(0, ((p.x - sx) * dx + (p.y - sy) * dy) / len2)) : 0;
    const e = (sx + dx * u - p.x) ** 2 + (sy + dy * u - p.y) ** 2;
    if (e > acc2) return null;
    if (e > maxErr2) maxErr2 = e;
  }
  return { c: chordCubic(sx, sy, ex, ey), err: Math.sqrt(maxErr2) };
}

/** One segment within `tol`, or null so the caller subdivides. `err` is the PENALISED
 *  error, which is what ranks candidates and what the caller compares against `tol`. */
function fitOne(src: ParamCurveFit, t0: number, t1: number, tol: number): { c: Cubic; err: number } | null {
  const f = frameFor(src, t0, t1);
  if (!f) return null;
  const acc2 = tol * tol;
  if (f.chord2 <= acc2) return tryFitLine(src, t0, t1, tol, f.sx, f.sy, f.ex, f.ey);

  const d = curveDist(src, t0, t1);
  let best: Cubic | null = null;
  let bestErr2 = Infinity;
  for (const cand of candidates(f)) {
    const err2 = evalDist(d, cand.c, acc2);
    if (!Number.isFinite(err2)) continue;
    // Squared error, so the linear penalty is squared with it. Applying it unsquared
    // would halve its effect.
    const scale = Math.max(armPenalty(cand.d0), armPenalty(cand.d1)) ** 2;
    const pen = err2 * scale;
    if (pen < acc2 && pen < bestErr2) { best = cand.c; bestErr2 = pen; }
  }
  return best ? { c: best, err: Math.sqrt(bestErr2) } : null;
}

/**
 * Fit ONE cubic across [t0,t1] of the source by matching area and moment. Returns null
 * when no valid fit exists (the moment quadratic has no usable root, or the
 * control-arm ratio exceeds the cusp threshold).
 *
 * No tolerance argument, so the error metric can only rank candidates, not reject them;
 * the arm cap is what stops a looped root escaping when nothing fits well. Callers that
 * need a bound should use `fitToCubics`, which subdivides.
 */
export function fitCubicMoment(src: ParamCurveFit, t0: number, t1: number): Cubic | null {
  const f = frameFor(src, t0, t1);
  if (!f) return null;
  const cands = candidates(f);
  if (!cands.length) return null;
  const d = curveDist(src, t0, t1);
  let best: Candidate | null = null;
  let bestErr = Infinity;
  for (const cand of cands) {
    const err2 = evalDist(d, cand.c, Infinity);
    if (!Number.isFinite(err2)) continue;
    const err = Math.sqrt(err2) * Math.max(armPenalty(cand.d0), armPenalty(cand.d1));
    if (err < bestErr) { best = cand; bestErr = err; }
  }
  if (!best) return null;
  return best.d0 > MAX_ARM_RATIO || best.d1 > MAX_ARM_RATIO ? null : best.c;
}

// ── subdivision ───────────────────────────────────────────────────────────────

/** Declared cusps, cleaned up: finite, strictly inside (0,1), sorted, deduped, and
 *  capped. A break reported AT a range endpoint would be split at, produce the same
 *  range back, and recurse forever. */
function collectBreaks(src: ParamCurveFit): number[] {
  if (!src.breaks) return [];
  const raw = src.breaks();
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const t of raw.slice(0, 256).sort((a, b) => a - b)) {
    if (!Number.isFinite(t) || t <= 1e-9 || t >= 1 - 1e-9) continue;
    if (out.length && t - out[out.length - 1]! < 1e-9) continue;
    out.push(t);
  }
  return out;
}

interface Budget { out: Cubic[]; max: number }

/**
 * Halve until it fits.
 *
 * A worklist rather than recursion, so the segment budget is a HARD cap: every pending
 * range yields at least one output curve, so `out.length + pending + 1` is a lower bound
 * on the final count and splitting is refused once that would exceed the budget. A
 * hostile source then degrades to chords, which keeps the contour continuous - dropping
 * the range instead would leave a hole in the path.
 *
 * Cusps aside, the split point is the parameter midpoint. Levien's measurement is that
 * this costs about 1.5× the optimal number of segments; anything smarter is a large
 * increase in complexity for a curve that usually fits in one or two pieces anyway.
 */
function fitAdaptive(src: ParamCurveFit, t0: number, t1: number, tol: number, b: Budget): void {
  // LIFO, pushing the right half last so the left is processed first and `out` stays in
  // parameter order.
  const pending: { a: number; z: number; depth: number }[] = [{ a: t0, z: t1, depth: 0 }];
  while (pending.length) {
    const { a, z, depth } = pending.pop()!;
    const span = Math.abs(z - a);
    const start = endpointSample(src, a, 1, span);
    const end = endpointSample(src, z, -1, span);
    if ((end.x - start.x) ** 2 + (end.y - start.y) ** 2 <= tol * tol) {
      const line = tryFitLine(src, a, z, tol, start.x, start.y, end.x, end.y);
      if (line) { b.out.push(line.c); continue; }
    }
    const fit = fitOne(src, a, z, tol);
    if (fit) { b.out.push(fit.c); continue; }
    const mid = 0.5 * (a + z);
    if (depth >= MAX_DEPTH || b.out.length + pending.length + 2 > b.max || !(mid > a && mid < z)) {
      b.out.push(chordCubic(start.x, start.y, end.x, end.y));
      continue;
    }
    pending.push({ a: mid, z, depth: depth + 1 });
    pending.push({ a, z: mid, depth: depth + 1 });
  }
}

/**
 * Root of a function that is expensive and possibly discontinuous.
 *
 * ITP (Interpolate/Truncate/Project): bisection's guaranteed bracket with the secant
 * method's speed where the function behaves. Used rather than plain bisection because
 * every evaluation here costs a whole curve fit, and rather than the secant method
 * because the function can jump. k2 is hardwired to 2. Assumes ya < 0 < yb.
 */
function solveItp(f: (x: number) => number, a: number, b: number, eps: number, n0: number, k1: number, ya: number, yb: number): number {
  const n12 = Math.max(0, Math.ceil(Math.log2((b - a) / eps)) - 1);
  let scaledEps = eps * 2 ** (n0 + n12);
  let lo = a, hi = b, ylo = ya, yhi = yb;
  let guard = 0;
  while (hi - lo > 2 * eps && guard++ < 128) {
    const half = 0.5 * (lo + hi);
    const r = scaledEps - 0.5 * (hi - lo);
    const xf = (yhi * lo - ylo * hi) / (yhi - ylo);
    const sigma = half - xf;
    const delta = k1 * (hi - lo) ** 2;
    const xt = delta <= Math.abs(sigma) ? xf + copysign(delta, sigma) : half;
    const x = Math.abs(xt - half) <= r ? xt : half - copysign(r, sigma);
    const y = f(x);
    if (y > 0) { hi = x; yhi = y; } else if (y < 0) { lo = x; ylo = y; } else return x;
    scaledEps *= 0.5;
  }
  return 0.5 * (lo + hi);
}

/**
 * Greedy maximal segments: from the current start, take the longest range that still
 * fits within tolerance, and repeat.
 *
 * This is the first of the two passes in Levien's optimised subdivision, and gives the
 * minimum segment count under an assumption of monotonic error - reasonable for smooth
 * sources, not guaranteed for any. The second pass, which re-equalises the error across
 * the segments so the last one is not left slack, is deliberately not built: it costs
 * roughly 50× a bisecting fit for a gain the source material itself calls "not a
 * significant improvement when most curves can be rendered with one or two cubic
 * segments", which is the offsetting case.
 *
 * Without that second pass the greedy walk can land one segment WORSE than bisection - * it packs the early segments full and the remainder needs its own - so the caller runs
 * both and keeps the shorter. Bisection is the cheap one, so that costs almost nothing.
 */
function fitGreedy(src: ParamCurveFit, t0: number, t1: number, tol: number, b: Budget): void {
  let t = t0;
  let guard = 0;
  while (t < t1 && b.out.length < b.max && guard++ < b.max) {
    const whole = fitOne(src, t, t1, tol);
    if (whole) { b.out.push(whole.c); return; }
    const start = t;
    // Over-tolerance is reported as exactly +tol, so f keeps a usable sign without
    // needing the true error of a hopeless span.
    const f = (x: number): number => {
      const r = fitOne(src, start, x, tol);
      return r ? r.err - tol : tol;
    };
    // Splitting to 1e-6 in parameter space is far below anything that changes the
    // result, and each halving beyond it costs another whole fit.
    const x = solveItp(f, start, t1, 1e-6, 1, 2 / (t1 - start), -tol, tol);
    const seg = fitOne(src, start, x, tol);
    if (!seg || !(x > start) || !(x < t1)) {
      // Non-monotonic, or the search stalled: fall back to bisecting this remainder.
      fitAdaptive(src, start, t1, tol, b);
      return;
    }
    b.out.push(seg.c);
    t = x;
  }
}

/**
 * Fit a whole source curve to a sequence of cubics within tol, subdividing adaptively.
 *
 * `maxSegments` is a hard cap, not a hint - past it the remaining ranges become chords,
 * so a source that can never meet the tolerance yields a rough path rather than hanging.
 * `optimise` buys a slightly shorter path for roughly an order of magnitude more work,
 * and is worth asking for only when the output is being stored rather than redrawn.
 * Segments are returned in parameter order and each starts exactly where the last ended.
 */
export function fitToCubics(src: ParamCurveFit, opts: FitOptions = {}): Cubic[] {
  const tol = opts.tol && opts.tol > 0 ? opts.tol : DEFAULT_TOL;
  const max = opts.maxSegments && opts.maxSegments > 0 ? Math.floor(opts.maxSegments) : DEFAULT_MAX_SEGMENTS;
  const b: Budget = { out: [], max };
  // Declared cusps come first: fitting a smooth cubic across one cannot succeed, and
  // subdividing towards it converges only in the limit.
  const cuts = [0, ...collectBreaks(src), 1];
  for (let i = 0; i + 1 < cuts.length && b.out.length < max; i++) {
    const t0 = cuts[i]!, t1 = cuts[i + 1]!;
    if (!(t1 > t0)) continue;
    if (opts.optimise) {
      const greedy: Budget = { out: [], max: max - b.out.length };
      fitGreedy(src, t0, t1, tol, greedy);
      const plain: Budget = { out: [], max: max - b.out.length };
      fitAdaptive(src, t0, t1, tol, plain);
      b.out.push(...(greedy.out.length && greedy.out.length <= plain.out.length ? greedy.out : plain.out));
    } else {
      fitAdaptive(src, t0, t1, tol, b);
    }
  }
  return b.out;
}

// ── simplification ────────────────────────────────────────────────────────────

/** A run of joined cubics as one source, parameterised uniformly across the segments. */
function polyCubicSource(curves: Cubic[]): ParamCurveFit {
  const n = curves.length;
  const at = (t: number): { i: number; u: number } => {
    const scaled = Math.min(Math.max(t, 0), 1) * n;
    let i = Math.floor(scaled);
    if (i >= n) i = n - 1;
    return { i, u: scaled - i };
  };
  return {
    sample(t: number) {
      const { i, u } = at(t);
      const c = curves[i]!;
      const p = evalCubic(c, u), d = tangentAt(c, u);
      // The derivative is with respect to the GLOBAL parameter, so it scales by n.
      return { x: p.x, y: p.y, dx: d.x * n, dy: d.y * n };
    },
    momentIntegrals(t0: number, t1: number) {
      const a = at(t0), z = at(t1);
      // Raw integrals are path integrals, so they simply add along consecutive pieces.
      const raw: RawMoments = { a: 0, x: 0, y: 0 };
      const add = (c: Cubic, u0: number, u1: number) => {
        if (u1 <= u0) return;
        const m = rawMomentsCubic(subCubic(c, u0, u1));
        raw.a += m.a; raw.x += m.x; raw.y += m.y;
      };
      if (a.i === z.i) {
        add(curves[a.i]!, a.u, z.u);
      } else {
        add(curves[a.i]!, a.u, 1);
        for (let i = a.i + 1; i < z.i; i++) add(curves[i]!, 0, 1);
        add(curves[z.i]!, 0, z.u);
      }
      const s = evalCubic(curves[a.i]!, a.u), e = evalCubic(curves[z.i]!, z.u);
      return chordFrameMoments(raw, s.x, s.y, e.x - s.x, e.y - s.y);
    },
    breaks() {
      // Corners between segments. Fitting a smooth cubic across one is a guaranteed
      // failure that would only be discovered after subdividing towards it.
      const out: number[] = [];
      for (let i = 1; i < n; i++) {
        const a = tangentAt(curves[i - 1]!, 1), b2 = tangentAt(curves[i]!, 0);
        const la = Math.hypot(a.x, a.y), lb = Math.hypot(b2.x, b2.y);
        if (la < 1e-12 || lb < 1e-12) { out.push(i / n); continue; }
        const cos = (a.x * b2.x + a.y * b2.y) / (la * lb);
        const sin = Math.abs(a.x * b2.y - a.y * b2.x) / (la * lb);
        if (cos < 0.9998 || sin > 0.02) out.push(i / n);
      }
      return out;
    },
  };
}

/**
 * Simplify an existing path to within tol. Opt-in ONLY.
 *
 * ⚠️ NEVER apply this to boolean operation output by default. A boolean's output points
 * lie exactly ON its input curves - that is the guarantee the whole geometry layer
 * exists to provide, and the reason nothing in it flattens. Fitting moves those points
 * off the inputs, so a simplified result can no longer be intersected, offset or
 * re-unioned against the shapes it came from without accumulating error. Simplification
 * is a caller's deliberate decision about a FINISHED path, made for file size, and made
 * after the fact.
 *
 * Returns the input unchanged when the fit would not actually use fewer segments. That
 * check doubles as the accuracy guard: the budget is the input count, and a fit that had
 * to degrade any range to a chord can only have done so once its running total already
 * reached the budget, so such a result is never shorter and never returned.
 *
 * ## What `tol` means here, because it is easy to misread as conservatism
 *
 * It is a Fréchet bound, in the input's own units, and it is honoured: a returned path is
 * never further from the input than `tol`. Measured on a 16-arc circle of r=100, the
 * reduction to the 4-segment kappa circle is taken at `tol` = 0.02685 against a true
 * two-sided Hausdorff distance of 0.026843 - four digits of headroom, not fifty times it.
 * The only slack is `armPenalty`, which multiplies the measured error before the
 * comparison, so a candidate with arms past 0.65 chords must beat `tol` by that factor.
 * On the half-circle piece of that same fixture the arms sit at 0.6545 and the factor is
 * 1.009, which moves the 4→2 transition from 1.8252 to 1.8416. That is the whole of it.
 *
 * ## Reachable segment counts are the bisection ladder, not every integer
 *
 * `fitToCubics` without `optimise` halves the PARAMETER domain of the whole run, so the
 * groupings on offer are the binary tree over that domain: a 16-curve input reduces
 * through 8, 4, 2, 1 (mixed counts only where the two halves disagree). A closed loop
 * always spends the first split, because its whole-domain chord is degenerate and no fit
 * can be framed on it. So 16 → 5 is not something a tolerance can ask for, however
 * achievable the error would be. Callers who want the shortest possible path rather than
 * the cheapest acceptable one should call `fitToCubics` with `optimise` directly.
 */
export function simplifyCubics(curves: Cubic[], tol = DEFAULT_TOL): Cubic[] {
  if (curves.length < 2) return curves.slice();
  const fitted = fitToCubics(polyCubicSource(curves), { tol, maxSegments: curves.length });
  if (!fitted.length || fitted.length >= curves.length) return curves.slice();
  return fitted;
}
