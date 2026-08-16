// SPDX-License-Identifier: MPL-2.0
/**
 * Offsetting: moving a path a fixed distance sideways. This is what an inset/outset,
 * a shadow ramp, and (through stroke.ts) an outlined stroke are all built from.
 *
 * ## The offset of a cubic is not a cubic
 *
 * It is not a Bézier of any degree: the exact offset of a cubic is an algebraic curve
 * of degree 10, so no amount of cleverness produces it in the form the rest of the
 * engine speaks. The only real question is how the approximation is CONTROLLED, and
 * the whole difference between a usable offset and a decorative one lives there.
 *
 * 1. **Split at the curvature features first.** An offset is well behaved only on a
 *    piece whose curvature is monotone and whose concavity does not flip, so the source
 *    is cut at its curvature extrema, its inflections, and any cusp before anything is
 *    approximated. Those parameters come from exact polynomials in `t`: the curvature
 *    numerator is a quadratic, and its extrema are the roots of a quintic, not found by
 *    walking the curve looking for where it seems to change.
 * 2. **Approximate each piece.** Its endpoints are exact (a point plus `distance` along
 *    its unit normal) and so are the tangent DIRECTIONS there, since an offset is
 *    parallel to its source by definition. Only the two handle lengths are unknown, and
 *    `fit.ts` determines them in closed form by matching the piece's signed area and
 *    first moment to the EXACT offset's. See `offsetSource`, which hands the fitter the
 *    real offset as a sampleable curve rather than a point cloud taken off a guess at it.
 * 3. **Measure the true error, then re-split.** Walk the source's parameter, compute the
 *    exact offset point there, and ask `nearestOnCubic` how far the APPROXIMATION is from
 *    it. That direction, not its opposite, for the reason `offsetError` explains: asking
 *    how far the source is from a sample of the approximation is fooled wherever the
 *    offset folds. The walk's step is not a fixed grid, it is refined until consecutive
 *    exact offset points bracket the trace to within `tol`, because a curvature spike is
 *    a feature narrower than any fixed grid, and a piece straddling one would otherwise
 *    be accepted with the whole feature hidden between two samples. This is the only
 *    sampling in the module, and it is measurement of a curve that has already been
 *    computed, not a substitute for computing one. A piece outside `tol` is split at the
 *    source parameter where it missed worst, and both halves are re-fitted, so every
 *    piece in the output has been checked against the real offset, not merely produced
 *    by a formula that usually works.
 *
 * ## Sign convention (stroke.ts depends on this)
 *
 * `offsetCubic` is the primitive, and one curve has no inside: there, a positive
 * distance moves the curve to the LEFT of its direction of travel, the quarter turn
 * `(-Ty, Tx)` of the unit tangent.
 *
 * A closed contour does have an inside, so there a positive distance means OUTWARD:
 * `offsetPath(p, 5)` grows a shape and `offsetPath(p, -5)` shrinks it, whichever way
 * round the author happened to draw it. That flips the primitive's sign for loops
 * running counter-clockwise (positive signed area in a y-up frame), because the left of
 * a counter-clockwise loop is its interior. `offsetPath` makes the decision ONCE for a
 * whole path, from its largest contour, so a hole (wound the other way) closes in as
 * the outline pushes out, instead of both boundaries marching the same direction across
 * the page. Open contours keep the primitive's meaning: positive is left of travel.
 *
 * `offsetSweep` is the raw trace with no region decided and no outward normalisation, so
 * it keeps the primitive's meaning on a closed contour too. It exists because a caller
 * that has to ADD two sweeps (`strokeToPath`) must not let either one collapse its
 * winding into a region first, and because a self-crossing centreline has no inside for
 * the outward/inward decision to be made against.
 *
 * ## Why boolean.ts is a prerequisite, not a nicety
 *
 * An inward offset of anything concave crosses itself. The tempting fix is to detect
 * and trim each loop locally, which works until two parts of the path that are not
 * neighbours collide, and then it quietly emits a shape with a knot in it. So the joins
 * here never trim: an inward corner is connected straight across, deliberately leaving
 * the loop, and `selfUnion` resolves the whole thing at once as a planar region. Of
 * that region, the material that is genuinely `distance` from the source is what
 * survives, which is what `resolveLoops` explains, and the part every offset
 * implementation gets wrong first.
 */
import {
  type Cubic, type Pt, boundsCubic, evalCubic, tangentAt, splitCubic, subCubic,
  nearestOnCubic, lineToCubic, isLineCubic,
} from './bezier.ts';
import { cubicRoots01, intersectLineCubic } from './intersect.ts';
import {
  type Contour, type GeomPath, closeContour, contourArea, reverseContour, compactPath,
  pathBounds, JOIN_EPS,
} from './path.ts';
import { selfUnion, windingNumber } from './boolean.ts';
import { type ParamCurveFit, fitToCubics, quadratureMoments } from './fit.ts';

export type JoinStyle = 'miter' | 'round' | 'bevel';

export interface OffsetOptions {
  join?: JoinStyle;
  miterLimit?: number;
  tol?: number;
}

/** Fitting tolerance, in the caller's units (CSS px throughout Lolly). A hundredth of a
 *  pixel is finer than any raster device resolves and finer than `toSvgPathData` prints,
 *  so at this tolerance the approximation is exact as far as the output can express. */
const DEFAULT_TOL = 0.01;
/** SVG's default, and matching it is the point: a stroke outlined here and the same
 *  stroke rendered by a browser should mitre identically. */
const DEFAULT_MITER_LIMIT = 4;
/** Each level doubles the piece count, and a curvature-monotone piece that still misses
 *  by more than `tol` after eight halvings is degenerate (|distance| past the radius of
 *  curvature), where more subdivision buys nothing. */
const MAX_OFFSET_DEPTH = 8;
const MAX_FIT_DEPTH = 16;
const MAX_FIT_ITERATIONS = 8;
/** Cap on what `fitToCubics` may spend on ONE curvature-monotone piece. Past it the
 *  fitter degrades that range to chords, which `offsetError` then rejects, so the cap
 *  hands the range back to the splitter here instead of letting a pathological piece
 *  consume the whole output. */
const MAX_FIT_SEGMENTS = 32;
/** Where the error measurement STARTS. It refines from here wherever the exact offset
 *  trace is still coarser than `tol` between neighbours, so this is a floor and not the
 *  resolution: a fixed grid of any size misses a curvature spike narrower than its step,
 *  and near a cusp that step would have to be ~1e-7 to see the feature at all. */
const ERROR_SAMPLES = 12;
/** Caps on the refinement. The depth reaches a 1e-7-wide feature from a 1/12 grid; the
 *  sample budget is what keeps a pathological piece from spending the depth everywhere,
 *  and running out only costs a split that could have been better placed. */
const MAX_ERROR_DEPTH = 20;
const ERROR_BUDGET = 512;
/** How many of a resolved contour's curves may be probed before it is judged. One is
 *  almost always enough; the rest are for the case where the longest curve is a mitre
 *  spike or a cap, which is real output but is not AT the offset distance. */
const PROBE_CURVES = 6;
/** Shortest span worth treating as its own piece. A curvature extremum at t = 1e-6 is
 *  real but splitting there yields a sliver whose tangents are numerical noise. */
const MIN_SPAN = 1e-4;

// ── one curve ─────────────────────────────────────────────────────────────────

/**
 * Offset a single cubic: subdivided at its curvature features, fitted, and re-split
 * until every piece is within `tol` of the true offset.
 *
 * No joins and no cleanup - the pieces are returned as they come, and a source cusp
 * shows up as a genuine gap between consecutive pieces, because that gap IS the
 * geometry. `offsetContour` is where gaps become joins.
 */
export function offsetCubic(c: Cubic, distance: number, tol = DEFAULT_TOL): Cubic[] {
  return offsetPieces(c, distance, tol).map((p) => p.curve);
}

/**
 * One offset piece, with the direction THE SOURCE travels in at each of its ends.
 *
 * Those directions are not recoverable from the piece itself, and the joins need them.
 * An offset's own tangent is `(1 − d·κ)·C'`, so wherever |distance| exceeds the radius of
 * curvature the piece arrives at its end running BACKWARDS along the source - genuinely,
 * that is the fold. Reading "which way did the path turn" off the piece there inverts
 * every question `joinPieces` asks: the side test picks the wrong side, and a round join at
 * a cusp sweeps its cap through the spike instead of over it. Null where the piece is
 * interior to a fitted run, since consecutive pieces of a run meet and never take a join.
 */
interface OffsetPiece { curve: Cubic; dirStart: Pt | null; dirEnd: Pt | null }

function offsetPieces(c: Cubic, distance: number, tol: number): OffsetPiece[] {
  // A curve with a coordinate that is not a number has no normal, so every step below
  // would spread the NaN through the output instead of stopping at it. Dropped rather
  // than returned, which is what `booleanPath` and `strokeToPath` do with the same input.
  if (!isFiniteCubic(c)) return [];
  // A non-finite distance is a caller's bug rather than a geometric request, so the curve
  // comes back untouched instead of vanishing or turning into NaN coordinates - same
  // answer the contour and path entry points give.
  if (!Number.isFinite(distance) || Math.abs(distance) < 1e-12) {
    return [{ curve: [...c] as Cubic, dirStart: unitTangent(c, 0), dirEnd: unitTangent(c, 1) }];
  }
  const limit = Math.max(tol, 1e-9);
  const out: OffsetPiece[] = [];
  for (const [t0, t1] of featureSpans(c)) {
    offsetSpan(subCubic(c, t0, t1), distance, limit, 0, out);
  }
  return out;
}

/** Attach the span's source directions to the run the fitter produced for it. */
function pushRun(src: Cubic, fitted: Cubic[], out: OffsetPiece[]): void {
  for (let i = 0; i < fitted.length; i++) {
    out.push({
      curve: fitted[i]!,
      dirStart: i === 0 ? unitTangent(src, 0) : null,
      dirEnd: i === fitted.length - 1 ? unitTangent(src, 1) : null,
    });
  }
}

/**
 * Fit one piece, and re-split it until the measurement agrees.
 *
 * ## Two error metrics, and which one gets to say yes
 *
 * `fitToCubics` has its own metric (normal-ray casting escalating to an arc-length
 * correspondence, with every local maximum of a 20-sample grid refined by golden
 * section), and it decides where the fitter subdivides. `offsetError` below is the one
 * that decides whether the RESULT is delivered. Acceptance requires both: a chain has
 * to satisfy each metric, so whichever is stricter on a given piece is the one that
 * governs, and neither can quietly accept what the other would reject.
 *
 * This is not redundant caution. The two metrics are strict in different places, and
 * both failure modes are real. The fitter's grid is fixed at 20 samples per candidate
 * range, so a curvature spike narrower than a twentieth of the range falls between its
 * brackets, and its refined maximum never sees it. That is the exact failure
 * `offsetError`'s sagitta-refined walk was built to close, where the delivered error
 * stuck at 0.07 however small `tol` got. Conversely, the fitter measures along the
 * source's NORMAL and rejects a candidate the ray misses, which bounds Fréchet
 * distance, while `offsetError` asks only for the nearest point on the chain, a weaker
 * question that a badly ordered curve can pass. Using either metric alone loses a
 * guarantee that shipped output depends on.
 */
function offsetSpan(src: Cubic, d: number, tol: number, depth: number, out: OffsetPiece[]): void {
  // A piece with no normal at an end has collapsed to a point: there is no offset of it,
  // and the fitter would hand back a degenerate chord rather than nothing.
  if (!unitTangent(src, 0) || !unitTangent(src, 1)) return;
  // A straight piece is not fitted at all: its offset is the same piece translated along
  // one normal, which is exact arithmetic. Routing it through the fitter instead costs
  // nothing in accuracy but everything in EXACTNESS: the fit places control points via
  // cos/sin of the chord angle, so a vertical edge picks up a ~1e-16 lateral error, and
  // two squares grown until their offsets touch stop touching. `selfUnion` then reads a
  // tangency as a near miss, and the two shapes fail to merge. This is checked against
  // the same gate as any other piece, so a source that is only nearly straight cannot
  // slip through.
  const straight = isLineCubic(src) ? translateCubic(src, d) : null;
  if (straight && offsetError(src, [straight], d, tol).error <= tol) { pushRun(src, [straight], out); return; }
  const fitted = fitToCubics(offsetSource(src, d), { tol, maxSegments: MAX_FIT_SEGMENTS });
  if (!fitted.length) return;
  if (depth >= MAX_OFFSET_DEPTH) { pushRun(src, fitted, out); return; }
  const worst = offsetError(src, fitted, d, tol);
  if (worst.error <= tol) { pushRun(src, fitted, out); return; }
  // Split where it missed worst, in the SOURCE's parameter - that is the position the
  // next fit's endpoint has to be exact at, and halving instead would keep re-cutting
  // the well-behaved side of an asymmetric piece.
  const t = worst.t > MIN_SPAN && worst.t < 1 - MIN_SPAN ? worst.t : 0.5;
  const [a, b] = splitCubic(src, t);
  offsetSpan(a, d, tol, depth + 1, out);
  offsetSpan(b, d, tol, depth + 1, out);
}

/**
 * The exact offset of one cubic, as a curve `fit.ts` can fit.
 *
 * This is the reason offsetting uses the moment fit rather than a least-squares pass over
 * sampled points: the offset is an ANALYTIC source, not a point cloud. Its position is a
 * source point plus `d` along an exact normal, and its derivative is exact too -
 *
 *     O(t) = C(t) + d·N(t)   with N the left normal of the unit tangent
 *     O'(t) = (1 − d·κ(t))·C'(t)
 *
 * because N' = −κ·|C'|·T (Frenet) and C' = |C'|·T, so the two collapse to one scalar
 * multiple of the source's own derivative. Nothing is finite-differenced and nothing is
 * inferred from neighbouring samples, so the fitter's end tangents and its quadrature are
 * fed the real curve. The sign of that scalar carries the geometry: past the local radius
 * of curvature it goes negative, which is the offset genuinely running backwards through
 * a fold, and `breaks()` reports where it crosses zero.
 *
 * κ = A/|C'|³ with A = x'y'' − y'x''. Below a vanishing |C'| the ratio is numerical noise
 * rather than curvature, so the position falls back to `unitTangent`'s control-leg normal
 * and the derivative is reported as zero - a source cusp, which is what it is, and which
 * `fit.ts` handles by probing inside the range.
 */
function offsetSource(c: Cubic, d: number): ParamCurveFit {
  const sample = (t: number): { x: number; y: number; dx: number; dy: number } => {
    const p = evalCubic(c, t);
    const d1 = tangentAt(c, t);
    const s = Math.hypot(d1.x, d1.y);
    if (s > 1e-12) {
      const d2 = secondDeriv(c, t);
      const k = 1 - (d * (d1.x * d2.y - d1.y * d2.x)) / (s * s * s);
      return { x: p.x - (d * d1.y) / s, y: p.y + (d * d1.x) / s, dx: k * d1.x, dy: k * d1.y };
    }
    const tan = unitTangent(c, t);
    if (!tan) return { x: p.x, y: p.y, dx: 0, dy: 0 };
    return { x: p.x - d * tan.y, y: p.y + d * tan.x, dx: 0, dy: 0 };
  };
  return {
    sample,
    // No closed form exists for an offset's area or moment - the curve is algebraic of
    // degree 10 - so this is the case `quadratureMoments` is documented for. Gauss-Legendre
    // over a smooth integrand, not a polyline of the shape.
    momentIntegrals: (t0, t1) => quadratureMoments(sample, t0, t1),
    breaks: () => offsetBreaks(c, d),
  };
}

/** Every control point moved `d` along the chord's left normal - the exact offset of a
 *  straight piece, and the identity `t` is preserved so a caller measuring against it
 *  compares like with like. Null when the chord has no direction. */
function translateCubic(c: Cubic, d: number): Cubic | null {
  const dx = c[6] - c[0], dy = c[7] - c[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-12)) return null;
  const nx = (-d * dy) / len, ny = (d * dx) / len;
  return [c[0] + nx, c[1] + ny, c[2] + nx, c[3] + ny, c[4] + nx, c[5] + ny, c[6] + nx, c[7] + ny];
}

/**
 * Where the fitter must cut rather than try to span: the source's own curvature
 * features, and the parameters at which the OFFSET has a cusp.
 *
 * The second set is the one only this file can supply. Where the offset distance
 * equals the local radius of curvature, the offset's derivative vanishes and its
 * tangent reverses: this is the point of the swallowtail an inward offset makes, and no
 * single cubic spans it. A fitter left to discover it by bisection converges on it only
 * in the limit, emitting a wall of segments along the way. Splitting AT it costs one
 * extra piece, and the two pieces meet at the same point, so `buildOffset` welds them
 * and no join is invented.
 */
function offsetBreaks(c: Cubic, d: number): number[] {
  const out = featureCuts(c);
  for (const t of offsetCuspParams(c, d)) out.push(t);
  return out.sort((a, b) => a - b);
}

/**
 * How far the approximation is from the true offset, at its worst, and at which source
 * parameter.
 *
 * The only sampling in this file, and it is measurement rather than construction: every
 * point measured is computed exactly (`offsetPoint` is a point of the source plus `d`
 * along an exact normal), and `nearestOnCubic` answers exactly. Nothing here stands in
 * for geometry that should have been solved.
 *
 * `approx` is the whole CHAIN the fitter returned for the piece, measured against the
 * nearest of its curves. Per-curve measurement would need each one's source parameter
 * range, which the fitter does not report, and the chain-wide question is the one that
 * matters anyway: every point of the true offset has to be covered by SOMETHING.
 *
 * The direction of the measurement is the part worth keeping. The obvious test (sample
 * the approximation and check it is |d| from the source) is fooled wherever the offset
 * FOLDS, which is anywhere |distance| exceeds the local radius of curvature: a point
 * that cuts straight across the swallowtail is still exactly |d| from some other part of
 * the source, so a badly wrong curve passes. Asking instead how far the approximation is
 * from a point that must lie ON it cannot be fooled that way, and it hands back the
 * source parameter to split at, rather than one inferred from a nearest-point search.
 *
 * ## Why the step is refined rather than fixed
 *
 * A fixed grid only measures where it looks, and the places an offset goes wrong are
 * narrower than any grid worth paying for. Near a cusp the tangent whips round inside a
 * window of ~1e-7 in `t`, so the exact offset trace travels several units between two
 * neighbours of a 12-point grid: the piece is accepted, and the DELIVERED error stays
 * at 0.07 however small `tol` gets. That is the one failure mode that would make a
 * tolerance argument meaningless. So an interval is subdivided until the exact offset
 * points at its ends and its middle are collinear to within `tol`, which is the
 * condition under which nothing can be hiding between them, and the samples land where
 * the trace actually moves rather than at even spacing.
 * Refining the measurement grid is not flattening: no output coordinate comes from it.
 */
function offsetError(src: Cubic, approx: Cubic[], d: number, tol: number): { error: number; t: number } {
  const worst = { error: 0, t: 0.5 };
  let budget = ERROR_BUDGET;
  const measure = (u: number): Pt | null => {
    const want = offsetPoint(src, u, d);
    if (!want) return null;
    if (u > 0 && u < 1) {
      const e = nearestOnChain(approx, want);
      if (e > worst.error) { worst.error = e; worst.t = u; }
    }
    return want;
  };
  const refine = (u0: number, u1: number, w0: Pt | null, w1: Pt | null, depth: number): void => {
    if (budget <= 0 || depth >= MAX_ERROR_DEPTH) return;
    budget--;
    const um = (u0 + u1) / 2;
    const wm = measure(um);
    if (!w0 || !w1 || !wm || sagitta(w0, wm, w1) <= tol) return;
    refine(u0, um, w0, wm, depth + 1);
    refine(um, u1, wm, w1, depth + 1);
  };
  let prev = measure(0);
  for (let i = 1; i <= ERROR_SAMPLES; i++) {
    const u = i / ERROR_SAMPLES;
    const here = measure(u);
    refine(u - 1 / ERROR_SAMPLES, u, prev, here, 0);
    prev = here;
  }
  return worst;
}

/** Nearest distance from a point to a chain of fitted pieces. The box test runs first,
 *  because this runs once per measured sample against every piece of the chain, and a
 *  chain the fitter split fifteen ways would otherwise cost fifteen quintic solves per
 *  sample.
 *
 *  This used to run with a raised sample count, because the probe bracketed its answer
 *  on a grid, and 24 samples over a piece spanning a whole curvature feature stopped
 *  resolving the basins: the wrong one got refined, and the measurement over-reported,
 *  costing a split that was not needed. `nearestOnCubic` now solves the quintic
 *  outright, so there is no grid to size, and the over-reporting it was compensating
 *  for is gone. */
function nearestOnChain(chain: Cubic[], p: Pt): number {
  let best = Infinity;
  for (const k of chain) {
    const b = boundsCubic(k);
    const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1), dy = Math.max(b.y0 - p.y, 0, p.y - b.y1);
    if (Math.hypot(dx, dy) >= best) continue;
    const e = nearestOnCubic(k, p.x, p.y).distance;
    if (e < best) best = e;
  }
  return best;
}

/** How far `m` stands off the chord `a`→`b`. Zero says the three are collinear, which is
 *  what licenses treating the run between them as resolved. */
function sagitta(a: Pt, m: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return Math.hypot(m.x - a.x, m.y - a.y);
  return Math.abs((m.x - a.x) * dy - (m.y - a.y) * dx) / len;
}

function isFiniteCubic(c: Cubic): boolean {
  for (let i = 0; i < 8; i++) if (!Number.isFinite(c[i]!)) return false;
  return true;
}

/** The exact offset point at `t`: on the curve, plus `d` along the left normal. */
function offsetPoint(c: Cubic, t: number, d: number): Pt | null {
  const tan = unitTangent(c, t);
  if (!tan) return null;
  const p = evalCubic(c, t);
  return { x: p.x - d * tan.y, y: p.y + d * tan.x };
}

/** Unit tangent, with the fallbacks a vanishing derivative needs. `tangentAt` returns
 *  zero at a coincident control pair and at a cusp, and a zero normal would put the
 *  offset endpoint on top of the source. */
function unitTangent(c: Cubic, t: number): Pt | null {
  const d = tangentAt(c, t);
  const len = Math.hypot(d.x, d.y);
  if (len > 1e-12) return { x: d.x / len, y: d.y / len };
  const legs: [number, number][] = t < 0.5
    ? [[c[4] - c[0], c[5] - c[1]], [c[6] - c[0], c[7] - c[1]]]
    : [[c[6] - c[2], c[7] - c[3]], [c[6] - c[0], c[7] - c[1]]];
  for (const [dx, dy] of legs) {
    const l = Math.hypot(dx, dy);
    if (l > 1e-12) return { x: dx / l, y: dy / l };
  }
  return null;
}

// ── curvature features ────────────────────────────────────────────────────────

/**
 * A parameter worth cutting at, and whether it is a closed-form root.
 *
 * The distinction matters. Inflections and cusps come out of a quadratic and a cubic
 * solved exactly; curvature extrema come out of a quintic isolated by bisection to
 * ~1e-7. Those cluster on the same feature (at a cusp the curvature numerator, its
 * derivative, and the speed all vanish together), and the cluster has to collapse to
 * one cut. Taking the bisected one loses nothing at a curvature extremum, but it is
 * fatal at a cusp: cutting 5e-8 short of a tangent reversal leaves the reversal INSIDE
 * a piece, so the two offset ends land on the same point instead of 2|d| apart, no gap
 * appears, no join is inserted, and the fitted piece runs straight through the cusp
 * point.
 */
interface Feature { t: number; exact: boolean }

/** Consecutive [t0,t1] spans between the curve's curvature features. */
function featureSpans(c: Cubic): [number, number][] {
  const spans: [number, number][] = [];
  let prev = 0;
  for (const t of featureCuts(c)) { spans.push([prev, t]); prev = t; }
  spans.push([prev, 1]);
  return spans;
}

/** The curvature features, with each cluster collapsed to one cut. */
function featureCuts(c: Cubic): number[] {
  const feats = featureParams(c)
    .filter((f) => f.t > MIN_SPAN && f.t < 1 - MIN_SPAN)
    .sort((a, b) => a.t - b.t);
  const cuts: number[] = [];
  for (let i = 0; i < feats.length;) {
    let j = i;
    while (j + 1 < feats.length && feats[j + 1]!.t - feats[i]!.t <= MIN_SPAN) j++;
    const cluster = feats.slice(i, j + 1);
    const at = (cluster.find((f) => f.exact) ?? cluster[0]!).t;
    if (!cuts.length || at - cuts[cuts.length - 1]! > MIN_SPAN / 2) cuts.push(at);
    i = j + 1;
  }
  return cuts;
}

/**
 * Where the offset cusps: |C'|³ = d·A, i.e. `distance` equals the local radius of
 * curvature.
 *
 * Squaring both sides clears the half power and leaves a polynomial, D³ − d²A², of
 * degree 12 in `t`, with D = |C'|² and A the curvature numerator, both already exact
 * polynomials.
 * Squaring also admits the roots of |C'|³ = −d·A, which are the points where the offset
 * runs at DOUBLE speed rather than stalling, so each root is checked against the unsquared
 * condition: a genuine one has 1 − dκ ≈ 0 and a spurious one has it at ≈ 2, which is not a
 * margin any root-isolation error can cross.
 */
function offsetCuspParams(c: Cubic, d: number): number[] {
  if (isLineCubic(c) || !Number.isFinite(d) || d === 0) return [];
  const px2 = 3 * (-c[0] + 3 * c[2] - 3 * c[4] + c[6]);
  const px1 = 2 * (3 * c[0] - 6 * c[2] + 3 * c[4]);
  const px0 = -3 * c[0] + 3 * c[2];
  const py2 = 3 * (-c[1] + 3 * c[3] - 3 * c[5] + c[7]);
  const py1 = 2 * (3 * c[1] - 6 * c[3] + 3 * c[5]);
  const py0 = -3 * c[1] + 3 * c[3];

  const a = [px0 * py1 - px1 * py0, 2 * (px0 * py2 - px2 * py0), px1 * py2 - px2 * py1];
  const dPoly = [
    px0 * px0 + py0 * py0,
    2 * (px1 * px0 + py1 * py0),
    px1 * px1 + 2 * px2 * px0 + py1 * py1 + 2 * py2 * py0,
    2 * (px2 * px1 + py2 * py1),
    px2 * px2 + py2 * py2,
  ];
  const cuspPoly = polySub(polyMul(polyMul(dPoly, dPoly), dPoly), polyScale(polyMul(a, a), d * d));

  const out: number[] = [];
  for (const t of rootsInUnit(cuspPoly)) {
    if (!(t > MIN_SPAN) || !(t < 1 - MIN_SPAN)) continue;
    const speed2 = ((((dPoly[4]! * t + dPoly[3]!) * t + dPoly[2]!) * t + dPoly[1]!) * t + dPoly[0]!);
    if (!(speed2 > 0)) continue;
    const num = (a[2]! * t + a[1]!) * t + a[0]!;
    if (Math.abs(1 - (d * num) / (speed2 * Math.sqrt(speed2))) < 0.5) out.push(t);
  }
  return out;
}

/**
 * Curvature extrema, inflections and cusps, from exact polynomials in `t`.
 *
 * κ = A / D^(3/2) where A = x'y'' − y'x'' and D = |C'|². For a cubic A is a QUADRATIC
 * (the t³ terms of the two products are identical and cancel) and D is a quartic, which
 * makes dκ/dt = 0 the quintic 2A'D − 3AD' = 0. Inflections are the roots of A itself:
 * the offset bulges to the other side across one, and a single cubic cannot follow that.
 */
function featureParams(c: Cubic): Feature[] {
  if (isLineCubic(c)) return [];      // an offset line is a translated line, exactly
  const px2 = 3 * (-c[0] + 3 * c[2] - 3 * c[4] + c[6]);
  const px1 = 2 * (3 * c[0] - 6 * c[2] + 3 * c[4]);
  const px0 = -3 * c[0] + 3 * c[2];
  const py2 = 3 * (-c[1] + 3 * c[3] - 3 * c[5] + c[7]);
  const py1 = 2 * (3 * c[1] - 6 * c[3] + 3 * c[5]);
  const py0 = -3 * c[1] + 3 * c[3];

  const a2 = px1 * py2 - px2 * py1;
  const a1 = 2 * (px0 * py2 - px2 * py0);
  const a0 = px0 * py1 - px1 * py0;

  const d4 = px2 * px2 + py2 * py2;
  const d3 = 2 * (px2 * px1 + py2 * py1);
  const d2 = px1 * px1 + 2 * px2 * px0 + py1 * py1 + 2 * py2 * py0;
  const d1 = 2 * (px1 * px0 + py1 * py0);
  const d0 = px0 * px0 + py0 * py0;

  const ts: Feature[] = [];
  for (const t of cubicRoots01(0, a2, a1, a0)) ts.push({ t, exact: true });
  for (const t of rootsInUnit(polySub(
    polyScale(polyMul([a1, 2 * a2], [d0, d1, d2, d3, d4]), 2),
    polyScale(polyMul([a0, a1, a2], [d1, 2 * d2, 3 * d3, 4 * d4]), 3),
  ))) ts.push({ t, exact: false });

  // A cusp is a zero of D, and D is a sum of squares - so it is a MINIMUM of D, and the
  // stationary points of D are the only places to look. Comparing against the control
  // legs keeps the test scale-free: 3·max leg length bounds |C'| for a cubic.
  const speedScale = 3 * Math.max(
    Math.hypot(c[2] - c[0], c[3] - c[1]),
    Math.hypot(c[4] - c[2], c[5] - c[3]),
    Math.hypot(c[6] - c[4], c[7] - c[5]),
    1e-12,
  );
  for (const t of cubicRoots01(4 * d4, 3 * d3, 2 * d2, d1)) {
    const speed = Math.sqrt(Math.max(0, (((d4 * t + d3) * t + d2) * t + d1) * t + d0));
    if (speed < 1e-6 * speedScale) ts.push({ t, exact: true });
  }
  return ts;
}

function polyMul(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j]! += a[i]! * b[j]!;
  return out;
}

function polyScale(a: number[], k: number): number[] {
  return a.map((v) => v * k);
}

function polySub(a: number[], b: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push((a[i] ?? 0) - (b[i] ?? 0));
  return out;
}

/**
 * Roots in (0,1) of a polynomial of any degree, by Bernstein subdivision.
 *
 * In Bernstein form the number of sign changes in the coefficients bounds the number of
 * roots in the interval (Descartes, via the variation-diminishing property), so a
 * subinterval with none can be discarded outright and the rest bisected. Unlike an
 * intersection, a split location does not need root-solver precision. Cutting a
 * fraction of a percent off a curvature extremum costs nothing, because the error
 * measurement downstream is what certifies the result, so bisection is the right trade
 * here, and Cardano-style closed forms do not exist above quartic anyway.
 */
function rootsInUnit(poly: number[]): number[] {
  let scale = 0;
  for (const v of poly) scale = Math.max(scale, Math.abs(v));
  if (!(scale > 0) || !Number.isFinite(scale)) return [];
  const a = poly.map((v) => v / scale);
  let deg = a.length - 1;
  while (deg > 0 && Math.abs(a[deg]!) < 1e-12) deg--;
  if (deg === 0) return [];
  const out: number[] = [];
  isolateRoots(bernsteinFromPower(a.slice(0, deg + 1)), 0, 1, 0, out);
  return out;
}

function bernsteinFromPower(a: number[]): number[] {
  const n = a.length - 1;
  const rows: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const row = [1];
    for (let k = 1; k <= i; k++) row.push((row[k - 1]! * (i - k + 1)) / k);
    rows.push(row);
  }
  const out: number[] = [];
  for (let k = 0; k <= n; k++) {
    let s = 0;
    for (let i = 0; i <= k; i++) s += (rows[k]![i]! / rows[n]![i]!) * a[i]!;
    out.push(s);
  }
  return out;
}

function isolateRoots(b: number[], t0: number, t1: number, depth: number, out: number[]): void {
  let changes = 0, prev = 0;
  for (const v of b) {
    if (v === 0) continue;
    const s = v > 0 ? 1 : -1;
    if (prev !== 0 && s !== prev) changes++;
    prev = s;
  }
  if (changes === 0) return;
  if (depth >= 40 || (changes === 1 && t1 - t0 < 1e-7)) { out.push((t0 + t1) / 2); return; }
  const [lo, hi] = splitBernstein(b);
  const mid = (t0 + t1) / 2;
  isolateRoots(lo, t0, mid, depth + 1, out);
  isolateRoots(hi, mid, t1, depth + 1, out);
}

/** de Casteljau at 0.5 on the coefficients, giving both halves' Bernstein forms. */
function splitBernstein(b: number[]): [number[], number[]] {
  const rows: number[][] = [b.slice()];
  for (let lvl = 1; lvl < b.length; lvl++) {
    const prev = rows[lvl - 1]!;
    const row: number[] = [];
    for (let i = 0; i + 1 < prev.length; i++) row.push((prev[i]! + prev[i + 1]!) / 2);
    rows.push(row);
  }
  return [rows.map((r) => r[0]!), rows.map((r) => r[r.length - 1]!).reverse()];
}

// ── contours and paths ────────────────────────────────────────────────────────

/**
 * Offset one contour.
 *
 * Closed: a closed result with the input's orientation, self-intersections resolved,
 * and a positive distance meaning outward. It can come back as several contours (an
 * inward offset splits a waisted shape in two, and an outward one closes the mouth of
 * a C into a hole), or as nothing at all, when an inward offset exceeds the shape's
 * inradius.
 *
 * Open: the one-sided offset, positive to the left of travel, returned open.
 */
export function offsetContour(c: Contour, distance: number, opts: OffsetOptions = {}): GeomPath {
  const src = finiteContour(c);
  if (!src) return [];
  if (!Number.isFinite(distance) || Math.abs(distance) < 1e-12) return [src];

  if (!src.closed) {
    const curves = buildOffset(src, distance, opts);
    return curves.length ? [{ curves, closed: false }] : [];
  }
  // The wrap back to the start is part of the shape whether or not it was stored as a
  // curve, and an implicit edge has no side to push out. `pathFromSubPaths` produces the
  // implicit form for every `Z` the SVG parser sees, so this is the shape most real
  // input arrives in. Without this step, the closing edge would be replaced by a single
  // join between the last and first offset pieces, which cuts that corner off the shape.
  const cc = closeContour(src);
  const area = contourArea(cc);
  const curves = buildOffset(cc, distance * outwardSign(area), opts);
  if (!curves.length) return [];
  return resolveLoops([{ curves, closed: true }], [cc], distance, area > 0);
}

/**
 * Offset every contour of a path together.
 *
 * The sign is resolved ONCE, from the largest contour, and the whole result goes
 * through a single `selfUnion`. This is not just tidiness: growing two shapes until
 * they touch has to merge them, and growing an outline towards its own hole has to
 * consume the hole. Per-contour cleanup cannot see either case.
 */
export function offsetPath(p: GeomPath, distance: number, opts: OffsetOptions = {}): GeomPath {
  const src = p.map(finiteContour).filter((c): c is Contour => c !== null);
  if (!src.length) return [];
  if (!Number.isFinite(distance) || Math.abs(distance) < 1e-12) return src;

  const closed = src.filter((c) => c.closed).map(closeContour);
  const open = src.filter((c) => !c.closed);
  const out: GeomPath = [];

  if (closed.length) {
    let ref = 0, biggest = 0;
    for (const c of closed) {
      const a = contourArea(c);
      if (Math.abs(a) > biggest) { biggest = Math.abs(a); ref = a; }
    }
    const signed = distance * outwardSign(ref);
    const loops: GeomPath = [];
    for (const c of closed) {
      const curves = buildOffset(c, signed, opts);
      if (curves.length) loops.push({ curves, closed: true });
    }
    if (loops.length) out.push(...resolveLoops(loops, closed, distance, ref > 0));
  }
  for (const c of open) {
    const curves = buildOffset(c, distance, opts);
    if (curves.length) out.push({ curves, closed: false });
  }
  return out;
}

/**
 * The RAW offset trace on the left of travel: joined, but with no region decided and no
 * outward normalisation. Positive `distance` means left of travel for a closed contour
 * just as for an open one, which is not what `offsetContour` means by it.
 *
 * The trace is the boundary of the strip the normal segment sweeps as it slides along
 * the contour (the offset pieces, the join fans where the strip opens, and the fans'
 * radii where it closes), so its winding number counts how many times the sweep
 * covered a point. That is the quantity a caller combining several sweeps needs, and it
 * is exactly what `offsetContour` spends: it collapses the winding into one region on
 * the way out, which is the right answer for "inset this shape" and the wrong one for
 * "what does this stroke paint", where the two sides' sweeps have to be added together
 * before either can be judged. A centreline that crosses itself has no inside for
 * `offsetContour` to normalise against, so for `strokeToPath` that collapse is not
 * merely lossy, it is undefined.
 */
export function offsetSweep(c: Contour, distance: number, opts: OffsetOptions = {}): Contour | null {
  const src = finiteContour(c);
  if (!src || !Number.isFinite(distance)) return null;
  if (Math.abs(distance) < 1e-12) return src;
  const cc = src.closed ? closeContour(src) : src;
  const curves = buildOffset(cc, distance, opts);
  return curves.length ? { curves, closed: cc.closed } : null;
}

/** The left normal points INTO a counter-clockwise (positive-area) loop, so growing one
 *  means offsetting to the right. */
function outwardSign(area: number): number {
  return area > 0 ? -1 : 1;
}

/**
 * Turn the raw offset loops into the region they describe.
 *
 * `selfUnion` resolves the crossings, but resolving is not the whole job: under the
 * nonzero rule a region wound −1 is filled just as a region wound +1 is, and an inward
 * offset produces exactly that. The straight connector across a concave corner leaves a
 * flap wound against the body, and an offset deeper than the shape's inradius turns the
 * whole interior inside out. Nonzero keeps both, so shrinking a 100pt square by 60
 * would come back as a shape instead of as nothing.
 *
 * ## Why the survivors are not chosen by winding
 *
 * The tempting test is to keep the loops wound the way the source ran, on the
 * reasoning that over-erosion inverts the shape. It holds for a POLYGON and fails for
 * every curve: eroding a counter-clockwise circle of r=50 by 51 maps the point at
 * angle θ to the point of radius 1 at angle θ+π, which sweeps counter-clockwise too.
 * Handedness is preserved, the inside-out disc reads as material, and `offsetPath`
 * grows a spurious shape exactly where it owes the caller nothing. A smooth fold is
 * not an inversion.
 *
 * So the survivors are chosen by MEASUREMENT against the source instead, which is what
 * the offset distance means in the first place: a point belongs to an erosion when it
 * is inside the source and no nearer than |distance| to its boundary, and to a
 * dilation when it is inside the source or no farther than |distance| from it.
 * `nearestOnCubic` answers that exactly on the original curves, so no epsilon and no
 * winding argument is involved, and the polygon and the circle are decided by the same
 * rule. "Exactly" is the word that matters, and it was not always true: while the
 * probe bracketed its answer on a sample grid, it could report a distance orders of
 * magnitude too large on a contour that passes close to another part of itself, and
 * this test would then delete material that belongs in the output or keep a fold that
 * does not. It solves the quintic now.
 *
 * A contour is kept as soon as ONE probe of the material beside it lands in that set.
 * Asking for all of them would throw away correct output, because a mitred join and a
 * bevelled one deliberately do not sit at |distance|: a mitre reaches out to
 * `miterLimit` times it, and SVG asks for that spike.
 */
function resolveLoops(raw: GeomPath, src: GeomPath, distance: number, wantCcw: boolean): GeomPath {
  const resolved = compactPath(selfUnion(raw));
  const probes = regionProber(resolved);
  const kept = resolved.filter((c) => probes(c).some(
    (p) => isOffsetMaterial(src, p.left, distance),
  ));
  return matchOrientation(kept, wantCcw);
}

/** Is `p` in the set the offset was asked for - the source eroded by |distance|, or
 *  dilated by it? Morphology, evaluated on the source curves themselves. */
function isOffsetMaterial(src: GeomPath, p: Pt, distance: number): boolean {
  // No tolerance is added to the comparison, and that is deliberate. The probe does not
  // sit ON the boundary, it sits half a face-thickness inside it, and the normal it
  // stepped along points away from the nearest source point. So on a face that is
  // genuinely eroded material, the step ITSELF is the margin, and it beats the fitting
  // error for any face thicker than one. Allowing a tolerance instead would re-admit
  // what this test exists to remove: at exactly the radius of curvature the collapsing
  // arcs of a rounded rectangle leave four knots of boundary 0.008 short of the
  // distance, which is inside any slack worth writing down and is not material.
  const slack = Math.max(Math.abs(distance), 1) * 1e-9;
  const want = Math.abs(distance);
  const inside = () => windingNumber(src, p.x, p.y) !== 0;
  const near = () => distanceToPath(src, p.x, p.y);
  return distance > 0 ? inside() || near() <= want + slack : inside() && near() >= want - slack;
}

/**
 * Nearest distance from a point to any curve of a path.
 *
 * Every curve whose bounding box is already farther away than the best answer so far is
 * skipped. This matters because this runs once per probe against the whole source: the
 * box test costs a subtraction, and `nearestOnCubic` costs a quintic root solve.
 */
export function distanceToPath(p: GeomPath, x: number, y: number): number {
  let best = Infinity;
  for (const c of p) {
    for (const k of c.curves) {
      const b = boundsCubic(k);
      const dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1);
      if (Math.hypot(dx, dy) >= best) continue;
      const d = nearestOnCubic(k, x, y).distance;
      if (d < best) best = d;
    }
  }
  return best;
}

export interface SideProbes {
  /** Inside the region this contour bounds - `selfUnion` orients every contour it
   *  returns with the filled side on its left. */
  left: Pt;
  right: Pt;
}

/**
 * A probe for one resolved path: given one of its contours, find points immediately
 * either side of it, one candidate curve at a time, longest first.
 *
 * Built for the whole path rather than per contour, because the reach, the curve list,
 * and their boxes are properties of the path. Recomputing them for each contour is what
 * turns judging a 68-contour offset into quadratic work.
 *
 * How far to step is the whole difficulty. A bbox-scaled epsilon (the obvious answer,
 * and the one boolean.ts's header rejects) gets it wrong two ways: on a region thinner
 * than the step, the probe lands outside the very contour it came from and correct
 * geometry is deleted, and because the step comes from an axis-aligned box, the verdict
 * depends on how the input was ROTATED. A 200×20 rectangle inset by 9.95 kept its
 * 0.1-thick ribbon axis-aligned and lost it at 45°.
 *
 * So the step is not chosen, it is measured: cast the normal at the curve's midpoint,
 * intersect it with the region exactly, and go half way to the nearest crossing. On the
 * thin ribbon that is 0.05, and on a wide body it is a wide step, which is the same
 * rule in both cases (half the available room), and it is a property of the geometry
 * rather than of the axes it happens to be drawn against.
 */
export function regionProber(region: GeomPath): (c: Contour, limit?: number) => SideProbes[] {
  const box = pathBounds(region);
  const curves = region.flatMap((c) => c.curves).map((k) => ({ k, box: boundsCubic(k) }));
  const reach = box ? Math.hypot(box.x1 - box.x0, box.y1 - box.y0) : 0;
  // The ray starts ON the boundary, so the contact at its own origin is not a crossing.
  const skip = reach * 1e-9;

  /** Distance from `m` along a unit direction to the first curve of the region it meets. */
  const firstCrossing = (m: Pt, dx: number, dy: number): number | null => {
    const x1 = m.x + dx * reach, y1 = m.y + dy * reach;
    const lo = { x: Math.min(m.x, x1), y: Math.min(m.y, y1) };
    const hi = { x: Math.max(m.x, x1), y: Math.max(m.y, y1) };
    let best: number | null = null;
    for (const { k, box: b } of curves) {
      if (b.x1 < lo.x || b.x0 > hi.x || b.y1 < lo.y || b.y0 > hi.y) continue;
      for (const hit of intersectLineCubic(m.x, m.y, x1, y1, k)) {
        const at = hit.t1 * reach;
        if (at <= skip) continue;
        if (best === null || at < best) best = at;
      }
    }
    return best;
  };

  return (c: Contour, limit = PROBE_CURVES): SideProbes[] => {
    if (!(reach > 0)) return [];
    const order = [...c.curves]
      .map((k, i) => ({ k, i, span: Math.hypot(k[6] - k[0], k[7] - k[1]) }))
      .sort((a, b) => b.span - a.span || a.i - b.i)
      .slice(0, limit);

    const out: SideProbes[] = [];
    for (const { k } of order) {
      const tan = unitTangent(k, 0.5);
      if (!tan) continue;
      const m = evalCubic(k, 0.5);
      const nx = -tan.y, ny = tan.x;
      const hl = firstCrossing(m, nx, ny);
      const hr = firstCrossing(m, -nx, -ny);
      // The nearer of the two bounds BOTH steps: a step that stays inside the thinner side
      // cannot escape the wider one either, and one length for both keeps the pair
      // symmetric about the point they are judging.
      const room = hl === null ? hr : hr === null ? Math.min(hl, reach) : Math.min(hl, hr);
      if (room === null || !(room > 0)) continue;
      const s = room / 2;
      out.push({
        left: { x: m.x + nx * s, y: m.y + ny * s },
        right: { x: m.x - nx * s, y: m.y - ny * s },
      });
    }
    return out;
  };
}

/** A copy with the unusable curves gone, or null when nothing usable is left.
 *
 *  Every entry point runs it, because a coordinate that is not a number reaches the
 *  normal, the fit, and the boolean pass alike, and comes out the far end as NaN
 *  control points. `offsetPath` on a curve ending at Infinity used to emit exactly
 *  that. A curve dropped from the middle of a contour leaves a gap, which is the one
 *  thing this module already handles everywhere: gaps become joins. */
function finiteContour(c: Contour): Contour | null {
  const curves = c.curves.filter(isFiniteCubic).map((k) => [...k] as Cubic);
  return curves.length ? { curves, closed: c.closed } : null;
}

/**
 * Offset every curve of a contour and join the pieces up.
 *
 * Gaps are treated uniformly wherever they appear, which is what makes a cusp inside a
 * single cubic behave like a corner between two: consecutive offset pieces either meet
 * (weld them, or the contour would drift apart at machine precision) or they do not,
 * and then a join goes in. The corner to pivot the join around is the shared source
 * point where that is known, and the midpoint of the two offset ends otherwise. That
 * midpoint is exact for a cusp, where the normal reverses and the two ends sit
 * diametrically opposite it.
 */
function buildOffset(c: Contour, d: number, opts: OffsetOptions): Cubic[] {
  const tol = opts.tol ?? DEFAULT_TOL;
  const join = opts.join ?? 'miter';
  const miterLimit = opts.miterLimit ?? DEFAULT_MITER_LIMIT;

  const seq: OffsetPiece[] = [];
  const corners: (Pt | null)[] = [];
  for (const k of c.curves) {
    const pieces = offsetPieces(k, d, tol);
    for (let i = 0; i < pieces.length; i++) {
      seq.push(pieces[i]!);
      corners.push(i === pieces.length - 1 ? { x: k[6], y: k[7] } : null);
    }
  }
  if (!seq.length) return [];

  const out: Cubic[] = [];
  for (let i = 0; i < seq.length; i++) {
    const cur = seq[i]!;
    out.push(cur.curve);
    const last = i === seq.length - 1;
    if (last && !c.closed) break;
    const next = seq[last ? 0 : i + 1]!;
    const a: Pt = { x: cur.curve[6], y: cur.curve[7] };
    const b: Pt = { x: next.curve[0], y: next.curve[1] };
    if (Math.hypot(b.x - a.x, b.y - a.y) <= JOIN_EPS) {
      next.curve[0] = a.x; next.curve[1] = a.y;
      continue;
    }
    const pivot = corners[i] ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // The source's directions, not the offset pieces' own - see `OffsetPiece`.
    const t0 = cur.dirEnd ?? endTangent(cur.curve);
    const t1 = next.dirStart ?? startTangent(next.curve);
    out.push(...joinPieces(a, b, pivot, t0, t1, d, join, miterLimit));
  }
  return out;
}

/**
 * Fill the gap between two offset pieces.
 *
 * The offset side only opens up where the path turns AWAY from it. A turn TOWARDS it
 * makes the two pieces overlap instead, and what goes between them there is not
 * cosmetic: it decides whether the fold can be recognised later. Both offset endpoints
 * sit exactly |d| from the pivot, so `a → pivot → b` is the pair of radii of the very
 * fan a round join sweeps the other way round. With them in place the trace follows
 * the boundary of the strip the moving normal sweeps, and its winding counts how many
 * times material was swept over, which is what `resolveLoops` reads.
 *
 * A chord straight across the corner instead cuts through that strip. It works while
 * the offset is shallower than the corner's feature size, and fails silently past it:
 * the chord then passes on the far side of the region, the fold comes back wound +1
 * rather than against the body, and eroding a shape past its inradius returns an
 * inside-out copy of it instead of nothing. Trimming the two pieces against each other
 * here is the other tempting answer, and it is worse: it is a local decision about
 * geometry that is not actually local.
 */
function joinPieces(
  a: Pt, b: Pt, pivot: Pt, t0: Pt | null, t1: Pt | null,
  d: number, style: JoinStyle, miterLimit: number,
): Cubic[] {
  const bevel = () => [lineToCubic(a.x, a.y, b.x, b.y)];
  const viaPivot = () => [lineToCubic(a.x, a.y, pivot.x, pivot.y), lineToCubic(pivot.x, pivot.y, b.x, b.y)];
  if (!t0 || !t1) return bevel();
  const cross = t0.x * t1.y - t0.y * t1.x;
  // A tangent REVERSAL (a cusp inside one source curve, or a spike between two) has
  // cross ≈ 0 with the tangents opposed, so "which way did it turn" has no answer, and
  // the side test below cannot be asked. It is not a degenerate case to be shrugged
  // off, though: the true offset jumps 2|d| straight across the cusp point, and the
  // gap left behind is a half turn that a round join has to actually round. Bevelling
  // it draws a chord THROUGH the cusp, which sits at distance 0 from a source that was
  // asked for |d|: the one place an offset can be wrong by its whole distance.
  const reversal = Math.abs(cross) < 1e-9 && t0.x * t1.x + t0.y * t1.y < 0;
  if (!reversal) {
    if (Math.abs(cross) < 1e-12) return bevel();
    if (d * cross >= 0) return viaPivot();
  }

  if (style === 'bevel') return bevel();
  if (style === 'round') return arcJoin(a, b, pivot, t0);
  // A half turn's mitre point is at infinity, so SVG's limit disqualifies it before it
  // can be computed.
  if (reversal) return bevel();

  const s = ((b.x - a.x) * t1.y - (b.y - a.y) * t1.x) / cross;
  if (!(s > 0) || !Number.isFinite(s)) return bevel();
  const m: Pt = { x: a.x + t0.x * s, y: a.y + t0.y * s };
  // SVG's rule: past the limit the mitre becomes a bevel, so a near-tangential corner
  // does not fire a spike across the page.
  if (Math.hypot(m.x - pivot.x, m.y - pivot.y) > miterLimit * Math.abs(d)) return bevel();
  return [lineToCubic(a.x, a.y, m.x, m.y), lineToCubic(m.x, m.y, b.x, b.y)];
}

/** Circular arc from `a` to `b` about `pivot`, as cubics. `heading` is the direction the
 *  incoming piece was travelling in, and settles which way round the arc goes. */
function arcJoin(a: Pt, b: Pt, pivot: Pt, heading: Pt | null): Cubic[] {
  const r0 = Math.hypot(a.x - pivot.x, a.y - pivot.y);
  const r1 = Math.hypot(b.x - pivot.x, b.y - pivot.y);
  const r = (r0 + r1) / 2;
  if (r < 1e-12) return [lineToCubic(a.x, a.y, b.x, b.y)];
  const from = Math.atan2(a.y - pivot.y, a.x - pivot.x);
  let sweep = Math.atan2(b.y - pivot.y, b.x - pivot.x) - from;
  while (sweep <= -Math.PI) sweep += 2 * Math.PI;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  // A half turn is the one case where the endpoints do not say which way round: both
  // arcs are equally short, and the normalisation above has to pick one blind. The
  // answer is not in the endpoints at all: the arc has to leave `a` tangentially, so it
  // turns the way (a − pivot) × heading points. At a cusp, picking wrong sends the cap
  // through the spike instead of over it.
  if (heading && Math.abs(sweep) > Math.PI - 1e-6) {
    const turn = (a.x - pivot.x) * heading.y - (a.y - pivot.y) * heading.x;
    if (turn !== 0) sweep = turn > 0 ? Math.abs(sweep) : -Math.abs(sweep);
  }

  // A cubic tracks a circular arc to within 0.02% of the radius over a quadrant and
  // degrades fast past it, so anything wider is split. k = 4/3·tan(θ/4) is the handle
  // length that makes the arc's midpoint exact; it carries the sweep's sign with it.
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: Cubic[] = [];
  for (let i = 0; i < n; i++) {
    const s = from + step * i, e = s + step;
    const sx = pivot.x + r * Math.cos(s), sy = pivot.y + r * Math.sin(s);
    const ex = pivot.x + r * Math.cos(e), ey = pivot.y + r * Math.sin(e);
    out.push([
      sx, sy,
      sx - k * r * Math.sin(s), sy + k * r * Math.cos(s),
      ex + k * r * Math.sin(e), ey - k * r * Math.cos(e),
      ex, ey,
    ]);
  }
  // Pin the ends: the two radii are not exactly equal, and a contour whose curves do not
  // meet is not a contour.
  const first = out[0]!, last = out[out.length - 1]!;
  first[0] = a.x; first[1] = a.y;
  last[6] = b.x; last[7] = b.y;
  return out;
}

function endTangent(c: Cubic): Pt | null {
  return unitTangent(c, 1);
}

function startTangent(c: Cubic): Pt | null {
  return unitTangent(c, 0);
}

/** Give the result the input's handedness. Every contour flips together: which way a
 *  hole runs relative to its outer boundary is what makes the path fillable, so
 *  reversing one alone would turn a hole into a second body. */
function matchOrientation(p: GeomPath, wantCcw: boolean): GeomPath {
  let area = 0, biggest = 0;
  for (const c of p) {
    const a = contourArea(c);
    if (Math.abs(a) > biggest) { biggest = Math.abs(a); area = a; }
  }
  if (biggest === 0 || (area > 0) === wantCcw) return p;
  return p.map(reverseContour);
}

// ── curve fitting ─────────────────────────────────────────────────────────────

/**
 * Fit a chain of cubics through a point sequence with prescribed end tangents, using
 * Schneider's algorithm (Graphics Gems, 1990).
 *
 * Least-squares for the two handle lengths, with the endpoints and tangent directions
 * held fixed, then Newton-Raphson reparameterisation (chord length is only a guess at
 * where each point sits on the curve, and refitting against improved parameters is
 * what turns a mediocre fit into an exact one), then a recursive split at the worst
 * point when neither is enough.
 *
 * Both tangents are in the DIRECTION OF TRAVEL: `start` leaves the first point, `end`
 * arrives at the last. Schneider's formulation wants the end one reversed; that
 * happens inside, because a caller holding a path has the forward tangent, not its
 * negation.
 *
 * ## This is the fitter for NOISY input, and offsetting no longer uses it
 *
 * ⚠️ Not dead code, and not redundant with `fit.ts`. The two fitters take different
 * inputs, and neither substitutes for the other:
 *
 * - **`fitToCubics` (fit.ts) takes a CURVE**: something with an exact position and
 *   derivative at any `t`, and exactly computable area and moment integrals. Given
 *   that, matching those two invariants beats least squares outright: closed form
 *   instead of iteration, O(n⁻⁶) convergence, and a cusp penalty that keeps the result
 *   smooth rather than merely close. An exact offset is such a curve, so `offsetSpan`
 *   uses it.
 * - **`fitCubic` (here) takes POINTS**, and asks nothing about where they came from.
 *   The moment method cannot do that: its invariants are integrals over an
 *   authoritative source, and over a digitiser's or a mouse drag's samples they
 *   measure the noise as faithfully as the shape. Levien flags exactly this case as a
 *   caveat. So a pen tool's freehand input (the Stage 4 caller the geometry plan
 *   names) needs a least-squares fitter, and this is it.
 *
 * Removing either one loses a capability the other cannot supply.
 */
export function fitCubic(points: Pt[], tangents: { start: Pt; end: Pt }, tol = DEFAULT_TOL): Cubic[] {
  const pts = dedupePoints(points);
  if (pts.length < 2) return [];
  const first = normalise(tangents.start) ?? direction(pts[0]!, pts[1]!);
  const back = normalise({ x: -tangents.end.x, y: -tangents.end.y })
    ?? direction(pts[pts.length - 1]!, pts[pts.length - 2]!);
  if (!first || !back) return [];
  return fitRecursive(pts, first, back, Math.max(tol, 1e-9), 0);
}

function fitRecursive(pts: Pt[], t0: Pt, t1: Pt, tol: number, depth: number): Cubic[] {
  if (pts.length === 2) {
    // Two points say nothing about the interior, so Wu & Barsky's heuristic stands in:
    // handles a third of the chord along the given tangents.
    const a = pts[0]!, b = pts[1]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) / 3;
    return [[a.x, a.y, a.x + t0.x * l, a.y + t0.y * l, b.x + t1.x * l, b.y + t1.y * l, b.x, b.y]];
  }

  let u = chordParams(pts);
  let curve = bezierWithTangents(pts, u, t0, t1);
  let worst = fitError(pts, u, curve);

  // Schneider gates the reparameterisation on the first fit already being close. That
  // gate never fires on a curve whose speed varies along it, because chord length is
  // then a poor guess at the parameters and the first fit is nowhere near. So the
  // fitter splits a shape it could have matched exactly (points taken off a single
  // cubic come back as a dozen). Iterate first, always, and stop the moment it stalls,
  // keeping whichever fit was better.
  for (let i = 0; i < MAX_FIT_ITERATIONS && worst.error > tol; i++) {
    const nu = reparameterise(pts, u, curve);
    const nc = bezierWithTangents(pts, nu, t0, t1);
    const ne = fitError(pts, nu, nc);
    if (!(ne.error < worst.error)) break;
    u = nu; curve = nc; worst = ne;
  }
  if (worst.error <= tol) return [curve];
  if (depth >= MAX_FIT_DEPTH) return [curve];

  const at = Math.min(pts.length - 2, Math.max(1, worst.index));
  const centre = centreTangent(pts, at);
  if (!centre) return [curve];
  return [
    ...fitRecursive(pts.slice(0, at + 1), t0, centre, tol, depth + 1),
    ...fitRecursive(pts.slice(at), { x: -centre.x, y: -centre.y }, t1, tol, depth + 1),
  ];
}

/**
 * The least-squares core: endpoints and tangent directions fixed, two handle lengths
 * free. Shared by `fitCubic` and the offset approximation, which is the whole reason
 * an offset piece lands on the true offset rather than merely near it: the same
 * two-unknown solve, given exact data instead of sampled data.
 *
 * `t1` points BACKWARD from the last point (Schneider's convention).
 */
function bezierWithTangents(pts: Pt[], u: number[], t0: Pt, t1: Pt): Cubic {
  const n = pts.length;
  const first = pts[0]!, last = pts[n - 1]!;
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < n; i++) {
    const t = u[i]!, mt = 1 - t;
    const b0 = mt * mt * mt, b1 = 3 * mt * mt * t, b2 = 3 * mt * t * t, b3 = t * t * t;
    const a0x = t0.x * b1, a0y = t0.y * b1;
    const a1x = t1.x * b2, a1y = t1.y * b2;
    c00 += a0x * a0x + a0y * a0y;
    c01 += a0x * a1x + a0y * a1y;
    c11 += a1x * a1x + a1y * a1y;
    const rx = pts[i]!.x - (first.x * (b0 + b1) + last.x * (b2 + b3));
    const ry = pts[i]!.y - (first.y * (b0 + b1) + last.y * (b2 + b3));
    x0 += a0x * rx + a0y * ry;
    x1 += a1x * rx + a1y * ry;
  }
  const det = c00 * c11 - c01 * c01;
  const chord = Math.hypot(last.x - first.x, last.y - first.y);
  let l0 = 0, l1 = 0;
  if (Math.abs(det) > 1e-18) {
    l0 = (c11 * x0 - c01 * x1) / det;
    l1 = (c00 * x1 - c01 * x0) / det;
  }
  // A negative handle turns the piece inside out and a vanishing one puts a cusp at the
  // endpoint, both of which look like a defect rather than a slightly loose fit. The
  // heuristic fallback is exact for a straight run, which is where the solve degenerates.
  const floor = 1e-6 * Math.max(chord, 1e-9);
  if (!(l0 > floor) || !(l1 > floor)) { l0 = chord / 3; l1 = chord / 3; }
  return [
    first.x, first.y,
    first.x + t0.x * l0, first.y + t0.y * l0,
    last.x + t1.x * l1, last.y + t1.y * l1,
    last.x, last.y,
  ];
}

/** Worst distance between a point and the curve AT ITS ASSUMED PARAMETER - not the
 *  nearest point on the curve. That is the quantity the reparameterisation reduces, so
 *  measuring anything else would report progress the next iteration cannot make. */
function fitError(pts: Pt[], u: number[], curve: Cubic): { error: number; index: number } {
  let error = 0, index = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = evalCubic(curve, u[i]!);
    const d = Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y);
    if (d > error) { error = d; index = i; }
  }
  return { error, index };
}

/** Newton on f(u) = (C(u) − P)·C'(u), whose roots are the parameters where the curve is
 *  closest to each point. */
function reparameterise(pts: Pt[], u: number[], curve: Cubic): number[] {
  return u.map((t, i) => {
    const p = evalCubic(curve, t), d1 = tangentAt(curve, t), d2 = secondDeriv(curve, t);
    const dx = p.x - pts[i]!.x, dy = p.y - pts[i]!.y;
    const num = dx * d1.x + dy * d1.y;
    const den = d1.x * d1.x + d1.y * d1.y + dx * d2.x + dy * d2.y;
    if (Math.abs(den) < 1e-14) return t;
    return Math.min(1, Math.max(0, t - num / den));
  });
}

function secondDeriv(c: Cubic, t: number): Pt {
  const mt = 1 - t;
  return {
    x: 6 * mt * (c[4] - 2 * c[2] + c[0]) + 6 * t * (c[6] - 2 * c[4] + c[2]),
    y: 6 * mt * (c[5] - 2 * c[3] + c[1]) + 6 * t * (c[7] - 2 * c[5] + c[3]),
  };
}

/** Tangent at an interior point, pointing BACKWARD, as the average of its two chords. */
function centreTangent(pts: Pt[], i: number): Pt | null {
  const prev = pts[i - 1]!, at = pts[i]!, next = pts[i + 1]!;
  return normalise({
    x: (prev.x - at.x + at.x - next.x) / 2,
    y: (prev.y - at.y + at.y - next.y) / 2,
  }) ?? direction(at, prev);
}

/** Cumulative chord length, normalised - the standard first guess at where each point
 *  sits on the curve, and a good one whenever the points are reasonably even. */
function chordParams(pts: Pt[]): number[] {
  const u = [0];
  for (let i = 1; i < pts.length; i++) {
    u.push(u[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  }
  const total = u[u.length - 1]!;
  if (!(total > 0)) return pts.map((_, i) => i / Math.max(1, pts.length - 1));
  return u.map((v) => v / total);
}

/** Consecutive duplicates give a zero-length chord, which makes the parameterisation
 * degenerate - and a freehand drag that pauses produces runs of them. */
function dedupePoints(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-12) out.push({ x: p.x, y: p.y });
  }
  return out;
}

function normalise(v: Pt): Pt | null {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-12 ? { x: v.x / l, y: v.y / l } : null;
}

function direction(from: Pt, to: Pt): Pt | null {
  return normalise({ x: to.x - from.x, y: to.y - from.y });
}
