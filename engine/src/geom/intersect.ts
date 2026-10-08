// SPDX-License-Identifier: MPL-2.0
/**
 * Curve intersection. Every boolean, offset, and stroke outline in this module depends
 * on this file. If this file is wrong, the whole geometry layer is wrong.
 *
 * ## Three cases, cheapest and most exact first
 *
 * | pair | method | exactness |
 * |---|---|---|
 * | line x line | one determinant | exact |
 * | line x cubic | cubic root solve in the line's frame | exact to root-solver precision |
 * | cubic x cubic | fat-line (Bezier) clipping | converges quadratically to `tol` |
 *
 * A line is not a special case in the data model. It is a cubic with collinear
 * controls. So the code picks a method by testing the geometry, not by checking a type
 * tag, and a curve that happens to be straight gets the exact line method automatically.
 *
 * ## Why fat-line clipping instead of subdivision
 *
 * The obvious method is recursive bisection: split both curves, keep the pairs whose
 * boxes overlap, and stop when the pieces are small. This converges LINEARLY, so
 * pinning an intersection to 1e-9 takes about 30 levels and up to 2^30 pairs in the
 * worst case. Fat-line clipping (Sederberg and Nishita 1990) instead computes, in one
 * step, the parameter interval of curve A that could possibly lie inside the "fat
 * line" bounding curve B, and discards the rest. This converges quadratically, usually
 * 5-8 iterations to full double precision, and it never approximates the curve, only
 * narrows down where it can be. Bisection is kept as a fallback for when clipping
 * cannot make progress: near-tangential contact, where the fat line barely clips
 * anything.
 *
 * ## What is always on
 *
 * The root solve, on every call. `cubicRoots01` isolates its roots between the derivative's
 * zeros instead of using Cardano's formula, reports a repeated root once, and gives each
 * root the sign the cubic changes by there. That sign reaches a caller as `Intersection.dir`
 * on the line paths, and the boolean's ray cast counts a crossing from it rather than from
 * the tangent at the root, which at the apex of a cusp is a rounding-sized vector pointing
 * anywhere. `cubicRoots01` says what the closed form got wrong and where. The line paths
 * have no budget and no second search: what they return is what every caller gets.
 *
 * This is not free of consequence, and the consequence was measured. Over the 1,807,972
 * distinct cubic pairs of 620 real SVGs in this tree (catalog assets, the docs screenshots,
 * the test fixtures, the community tools and the web shell's own artwork), the two builds
 * report a different SET of points on 4,205 pairs that took an exact line path. Every one of
 * those differences is a contact the committed build missed and this one reports: 4,157 of
 * them a shared vertex, 48 of them an interior contact. Zero points are reported by this
 * build that do not lie on both curves, and zero contacts reported by the committed build
 * are lost. The commonest case is a rounded rectangle, whose straight side ends exactly where
 * the corner arc begins: the root is a rounding error outside [0, 1], at -1e-19, and the
 * committed solver found no sign change there, so the vertex was not reported at all.
 *
 * ## What is behind a budget, and why
 *
 * The clip search has one failure of cost, not of correctness. A clip measures how far one
 * curve is from the other's fat line and nothing else, so two curves that agree to high
 * order along a stretch give it nothing to cut: a shape against a copy rounded or rotated by
 * a hair, a C/S pair repeated in one path, or a stroke outline built from either. Bisecting
 * such a pair only doubles the pieces, which still lie along each other, so the search runs
 * for hundreds of thousands of steps. The weekly fuzz soak found one 185-byte path of
 * repeated coincident C/S pairs costing about a second per boolean operation that way; it is
 * kept as `tests/fuzz/regressions/geom-repeated-coincident-cs-pairs.bin`.
 *
 * So `clipIntersect` counts its calls. A pair that passes `CLIP_BUDGET.maxNodes` is
 * abandoned whole, the hits it had already found thrown away, and answered instead by
 * `intersectOverrun`, the search in the second half of this file. A pair is answered by one
 * search or by the other, never partly by each, and which one answers it depends on nothing
 * but the two curves, the order they are given in, and the tolerance.
 *
 * The order matters because the clip search is not symmetric: it clips one curve against the
 * other's fat line and then exchanges their roles, so the two orders cost slightly different
 * numbers of nodes, and a pair right at the budget can go one way in one order and the other
 * way in the other. That was already true of the answers themselves, which have never been
 * symmetric either.
 *
 * What the budget buys, and what it costs, both measured on this tree:
 *
 * - Under the budget nothing moved. Of those 1,807,972 real pairs, 33,870 reached the clip
 *   search and 1,416 crossed the budget; every one of the other 32,454 returns the committed
 *   build's answer, point for point and digit for digit.
 * - Real artwork DOES cross it. Those 1,416 pairs are in about sixty files, the heaviest
 *   being `docs/shots/bs-palette-pane.svg` (196 pairs), `at2-manifest-about-card.svg` (144)
 *   and the `deck-studio` and `stationery` catalog previews. This is not a budget only a
 *   fuzzer reaches.
 * - There is no cost cliff at the line. 16,384 nodes is only 4.5 to 10.3 ms of the committed
 *   build's time, so a pair it answers quickly can still cross, which is the sharpest form of
 *   the concern. Twenty-three pairs engineered to land at exactly 16,385 nodes (two shapes,
 *   ten shifts, both operand orders) cost the committed build 4.5 to 10.3 ms and this build
 *   4.5 to 6.5: every ratio between 0.5x and 1.1x, and not one of them over 10 ms and more
 *   than twice as slow. The reason the cliff is not there is `twinNode`, which decides a
 *   near-copy node from the polynomial of the offset instead of cutting it down.
 *
 * What the budget costs is the other half of that first bullet, and it is a real cost. A pair
 * under the budget keeps the clip search's answer, DEFECTS INCLUDED. On the near-copy families
 * this build is far better than the committed one and measurably worse than a build with no
 * budget at all: over four shards of loops and cusps against near-copies, the committed build
 * is wrong on 2,494 grid judgements, this build on 197 (31 of them wrong only here, nearly all
 * inside a sliver a weld radius wide), and the same search with the budget at zero on 1. The
 * curve is in plans/geom-kernel-notes.md with what each budget costs in time; the number is
 * one line, and it was chosen to keep "under the budget nothing moves" true rather than to
 * make that family come out best.
 *
 * The number itself came from the node counts. Ordinary pairs finish in tens of nodes; over
 * the recorded corpora the p99.9 is 467 to 571, and the heaviest pair of a sweep of circles,
 * ellipses, stars and rounded rectangles takes 7,598. The pairs that cannot be clipped apart
 * take 21,627 and up, to six million. The gap between those two populations is wide and
 * empty, and 16,384 is inside it.
 *
 * ## What the handoff costs, measured
 *
 * A boolean calls this for every pair of curves in its two operands, so one operation can get
 * both kinds of answer. On the families where the committed search is slow, the handoff is
 * what makes them fast:
 *
 * - The four reversed near-coincident loop pairs: 10 to 97 ms against 110 to 3,837.
 * - The 44 slow tangent pairs of the round 3 corpus: 815 ms in total against 184,085, worst
 *   89 ms against 18,018, and not one pair more than twice as slow.
 * - The fuzz reproducer: see `tests/geom-work-budget.test.ts`, which pins it.
 *
 * ## The overrun search has a ceiling of its own
 *
 * Neither search bounds its own recursion, and each has inputs that run away in it. The
 * committed one runs away on a shape against a near-copy of itself, which is what the budget
 * above answers. The overrun search runs away on a curve against a REPARAMETRISED piece of
 * itself, two fits of one arc cut at different places: `twinNode` cannot see such a pair,
 * because it is not a twin at equal parameters, and `sharedRun` answers it only while its
 * ends project onto each other, so at large coordinates the pair falls through to bisection
 * and the pieces still lie along each other at every level. Two overlapping pieces of one
 * cubic 30,000 units long spent 28,235,256 nodes and 47 seconds there.
 *
 * So `overrunClip` counts its calls too, against `OVERRUN_BUDGET.maxNodes`, and stops
 * descending when it passes them. The pair is not abandoned: the stretches already kept go to
 * `scanStalled` as any others, so the answer is a search of less of the pair rather than a
 * different kind of answer. On the 30,000-unit pair above the answer is the same at every
 * ceiling from 32,768 to 524,288 and to none at all: the two ends of the shared run, at
 * (0.4286, 0) and (1, 0.5714). Only the time changes.
 *
 * ## Known limits, measured
 *
 * Two crossings a hundredth of the curve apart at the apex of a cusp against a copy of
 * itself come back as one contact: within a hundredth of the apex the nearest point on the
 * copy jumps between its two branches, no side can be read there, and the two crossings
 * are one zone. The boolean then cuts once, and the lens between the two crossings, a few
 * weld radii wide at most, goes to whichever side the piece is decided on.
 *
 * A feature no wider than one weld radius is below what a boolean at that tolerance can
 * resolve, and this search reports the run rather than the two sides of it. The operation
 * then comes back EMPTY on some of those, where the search before it kept a sliver: 40 rows
 * of a sweep over bars and combs from 0.3 to 3000 weld radii wide, every one of them at 0.3
 * or 1.0. Neither answer is specified at or under the resolution; what IS specified is that
 * the answer stops changing with the tolerance once the feature is a weld radius and a half
 * wide, which it does from 1.5 up.
 *
 * The reparametrised near-copy above is a hole in BOTH searches, not a defect this change
 * introduced, and each build has its own inputs that fall in it. Over 162 rows of that family
 * (three shapes, six sizes, three cut placements, three gaps) the committed build spends
 * 2,379 seconds in total and this one 10.4. This one is faster by more than twice and by more
 * than 10 ms on 103 of the 162, including four rows of 111 to 149 seconds that come back in
 * 5 to 8 ms. It is SLOWER by more than twice and by more than 10 ms on three, and those are
 * worth stating plainly, medians of five alternating readings:
 *
 * | row | committed | this build |
 * |---|---|---|
 * | loop L=30000 cut [0, 0.7] x [0.3, 1] | 14 ms, 31 points | 113 ms, 2 points |
 * | loop L=1 cut [0.1, 0.9] x [0.2, 1], gap 1e-9 | 19 ms, 31 points | 67 ms, 5 points |
 * | loop L=100000 cut [0, 0.7] x [0.3, 1] | 31 ms, 34 points | 84 ms, 2 points |
 *
 * All three reach the overrun ceiling, and all three are pairs where the committed build's
 * fast answer is a scatter of points along a run rather than the run's two ends. The two
 * ceilings bound both directions; neither removes the class.
 * `tests/geom-work-budget.test.ts` pins one input of each kind.
 *
 * ## What "clean" means here
 *
 * Results are parameters on the ORIGINAL curves. The point is then computed FROM the
 * curve, so it lies on the curve to machine precision, not just near it. Nothing here
 * flattens the curve, samples it, or rasterises it.
 */
import {
  type Cubic, type Pt, evalCubic, splitCubic, subCubic, boundsCubic, hullBounds,
  boxesOverlap, isLineCubic, flatnessCubic, nearestOnCubic, tangentAt,
} from './bezier.ts';

/** One intersection: where it is, and its position on each input. */
export interface Intersection {
  /** Parameter on the first curve, 0..1. */
  t1: number;
  /** Parameter on the second curve, 0..1. */
  t2: number;
  x: number;
  y: number;
  /** Set by `intersectLineCubic` only: which way the curve crosses the line, as the sign
   *  change of its signed distance to the line at the root. +1 where the curve passes from
   *  the line's right to its left (the side its normal points to), -1 the other way, 0 where
   *  it touches the line without crossing. A winding count reads the crossing from this
   *  rather than from the tangent at the root, which at a cusp is a rounding-sized vector
   *  pointing anywhere. */
  dir?: number;
}

/** Default positional tolerance, in the caller's units (CSS px throughout Lolly).
 *  A thousandth of a pixel is far below anything a renderer can show and still leaves
 *  headroom above double-precision noise on page-sized coordinates. */
export const EPS = 1e-9;
const T_EPS = 1e-9;

// ── exact: line × line ────────────────────────────────────────────────────────

/** Intersect two segments given by endpoints. Returns null for parallel or
 *  non-overlapping. Parameters are along each segment, 0..1. */
export function intersectSegments(
  ax0: number, ay0: number, ax1: number, ay1: number,
  bx0: number, by0: number, bx1: number, by1: number,
): Intersection | null {
  const rx = ax1 - ax0, ry = ay1 - ay0;
  const sx = bx1 - bx0, sy = by1 - by0;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-14) return null;   // parallel or degenerate
  const qpx = bx0 - ax0, qpy = by0 - ay0;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  if (t < -T_EPS || t > 1 + T_EPS || u < -T_EPS || u > 1 + T_EPS) return null;
  const tc = Math.min(1, Math.max(0, t)), uc = Math.min(1, Math.max(0, u));
  return { t1: tc, t2: uc, x: ax0 + rx * tc, y: ay0 + ry * tc };
}

// ── exact: cubic root solve ───────────────────────────────────────────────────

/**
 * Real roots of a·t³ + b·t² + c·t + d within [0,1].
 *
 * By isolation, not by the closed form. The derivative's roots cut [0, 1] into at most
 * three intervals on which the cubic is monotone, each interval whose end values differ in
 * sign holds exactly one root, and that root is found by Newton steps kept inside the
 * interval, with bisection where a step leaves it. A root the cubic touches without
 * crossing (a double root) sits at a critical point where the value is zero to rounding,
 * and is reported once; a triple root, where both critical points fall together, is one
 * root. So the count of reported roots matches the cubic's sign changes, which is what a
 * winding count needs, and a double root is still there for a caller after a tangency.
 *
 * Cardano's formula was used before this, with a Newton polish, and it was wrong in the
 * two places the geometry visits most: a leading coefficient small against the others (a
 * copy of a symmetric curve nudged by a billionth, against a horizontal line) cancelled
 * catastrophically and returned NO root where the line crossed the curve twice; and a
 * repeated root (any line through the apex of a cusp) put the discriminant within rounding
 * of zero, the branch taken depended on the sign of that rounding, and the polish, dividing
 * a rounding-sized value by a rounding-sized slope, walked one copy of the root a hundredth
 * of the curve away, to a point where the cubic was nowhere near zero. A ray cast then
 * counted that point as a crossing. Isolation has no branch to get wrong and no closed form
 * to cancel, and it is exact to rounding for any coefficients, a leading coefficient of
 * exactly zero included.
 */
export function cubicRoots01(a: number, b: number, c: number, d: number, dirs?: number[]): number[] {
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
  if (!(scale > 0) || !Number.isFinite(scale)) return [];
  // A value this close to zero is zero to rounding: the coefficients carry a few ulps of
  // their own size, and evaluating the cubic at a parameter in [0, 1] adds a few more.
  const tiny = ROOT_SNAP * Number.EPSILON * scale;
  // The cuts: the two ends, plus the derivative's zeros where they fall between them. Four
  // at most, in fixed slots rather than a growing array, because this runs once per curve
  // per ray cast and the allocation showed up in the boolean's profile.
  //
  // The ends carry the parameter slack every root is accepted at: a curve starting exactly
  // on a line has its root a rounding error outside [0, 1], at -1e-19, and isolating over
  // [0, 1] alone found no sign change there. Every end cap of a band against the curve it
  // caps lost its vertex that way.
  const cuts = [-T_EPS, 1 + T_EPS, 0, 0];
  let nc = 2;
  // Critical points, by the stable form of the quadratic formula so that a tiny leading
  // coefficient does not cancel the root that lies in [0, 1].
  const qa = 3 * a, qb = 2 * b, qc = c;
  if (Math.abs(qa) > 1e-300) {
    const disc = qb * qb - 4 * qa * qc;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const q = -0.5 * (qb + (qb < 0 ? -sq : sq));
      const r0 = q !== 0 ? q / qa : -qb / (2 * qa), r1 = q !== 0 ? qc / q : r0;
      if (r0 > -T_EPS && r0 < 1 + T_EPS) cuts[nc++] = r0;
      if (q !== 0 && r1 > -T_EPS && r1 < 1 + T_EPS) cuts[nc++] = r1;
    }
  } else if (Math.abs(qb) > 1e-300) {
    const r = -qc / qb;
    if (r > -T_EPS && r < 1 + T_EPS) cuts[nc++] = r;
  }
  // Insertion sort: four entries at most.
  for (let i = 1; i < nc; i++) {
    const v = cuts[i]!;
    let j = i - 1;
    while (j >= 0 && cuts[j]! > v) { cuts[j + 1] = cuts[j]!; j--; }
    cuts[j + 1] = v;
  }
  const vals = [0, 0, 0, 0];
  for (let i = 0; i < nc; i++) {
    const v = ((a * cuts[i]! + b) * cuts[i]! + c) * cuts[i]! + d;
    vals[i] = Math.abs(v) <= tiny ? 0 : v;
  }
  // Roots in the order they are found: repeated ones first, then the sign changes. Both
  // sequences run left to right, so the merge below sorts four entries at most.
  const out: number[] = [], sg: number[] = [];
  // A critical point where the cubic is zero to rounding is a repeated root. Two of them
  // are a triple root (a cubic has no other way to touch zero twice), reported once, in the
  // middle: a vertical line through the apex of a cusp nudged sideways by a billionth has
  // exactly that, and reporting both critical points counted one crossing as two. The
  // direction of a repeated root is read from the values either side of it: a double root
  // touches without crossing, a triple root crosses.
  for (let i = 0; i < nc; i++) {
    if (vals[i] !== 0) continue;
    let j = i;
    while (j + 1 < nc && vals[j + 1] === 0) j++;
    const before = i > 0 ? vals[i - 1]! : 0, after = j + 1 < nc ? vals[j + 1]! : 0;
    const t = (cuts[i]! + cuts[j]!) / 2;
    if (t >= -T_EPS && t <= 1 + T_EPS) {
      out.push(Math.min(1, Math.max(0, t)));
      sg.push(before < 0 && after > 0 ? 1 : before > 0 && after < 0 ? -1 : 0);
    }
    i = j;
  }
  for (let i = 1; i < nc; i++) {
    const lo = cuts[i - 1]!, hi = cuts[i]!, flo = vals[i - 1]!, fhi = vals[i]!;
    if (flo === 0 || fhi === 0 || (flo < 0) === (fhi < 0)) continue;
    let x0 = lo, x1 = hi, f0 = flo, t = (lo + hi) / 2;
    for (let k = 0; k < 80; k++) {
      const ft = ((a * t + b) * t + c) * t + d;
      if (ft === 0) break;
      if ((ft < 0) === (f0 < 0)) { x0 = t; f0 = ft; } else x1 = t;
      if (x1 - x0 <= 4e-16) break;
      const slope = (3 * a * t + 2 * b) * t + c;
      let next = slope !== 0 ? t - ft / slope : (x0 + x1) / 2;
      if (!(next > x0 && next < x1)) next = (x0 + x1) / 2;
      t = next;
    }
    if (t >= -T_EPS && t <= 1 + T_EPS) { out.push(Math.min(1, Math.max(0, t))); sg.push(fhi > 0 ? 1 : -1); }
  }
  return dedupeRoots(out, sg, dirs);
}

/** Ulps of the largest coefficient within which a value of the cubic counts as zero. */
const ROOT_SNAP = 32;

/** Roots sorted and merged where they fall within 1e-9 of each other. Two crossings that
 *  merge cancel their directions, as the curve comes back to the side it started on.
 *
 *  Sorted by insertion, and the common counts answered before that: a cubic has three roots
 *  at most, this is called once per curve per ray cast, and a comparator sort allocates. */
function dedupeRoots(ts: number[], sg: number[], dirs?: number[]): number[] {
  const n = ts.length;
  if (n === 0) { if (dirs) dirs.length = 0; return ts; }
  if (n === 1) { if (dirs) { dirs.length = 0; dirs.push(sg[0]!); } return ts; }
  for (let i = 1; i < n; i++) {
    const t = ts[i]!, g = sg[i]!;
    let j = i - 1;
    while (j >= 0 && ts[j]! > t) { ts[j + 1] = ts[j]!; sg[j + 1] = sg[j]!; j--; }
    ts[j + 1] = t; sg[j + 1] = g;
  }
  const out: number[] = [];
  const dd: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = ts[i]!;
    if (!out.length || t - out[out.length - 1]! > 1e-9) { out.push(t); dd.push(sg[i]!); }
    else dd[dd.length - 1] = Math.sign(dd[dd.length - 1]! + sg[i]!);
  }
  if (dirs) { dirs.length = 0; for (const v of dd) dirs.push(v); }
  return out;
}

/**
 * Line × cubic, exactly.
 *
 * Rewriting the cubic in the line's own frame turns "where do they meet" into "where
 * is the curve's signed distance to the line zero" - a scalar cubic in `t`, solved in
 * closed form. No iteration, no subdivision, and the roots are the true parameters.
 */
export function intersectLineCubic(
  x0: number, y0: number, x1: number, y1: number, c: Cubic, tol = EPS, clamp = true,
): Intersection[] {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return [];
  // Unit normal: dot with (P - lineStart) gives signed distance.
  const nx = -dy / len, ny = dx / len;
  const dist = (px: number, py: number) => nx * (px - x0) + ny * (py - y0);
  const d0 = dist(c[0], c[1]), d1 = dist(c[2], c[3]), d2 = dist(c[4], c[5]), d3 = dist(c[6], c[7]);
  // Bernstein → power basis for the distance polynomial.
  const A = -d0 + 3 * d1 - 3 * d2 + d3;
  const B = 3 * d0 - 6 * d1 + 3 * d2;
  const C = -3 * d0 + 3 * d1;
  const D = d0;

  const out: Intersection[] = [];
  const dirs: number[] = [];
  const roots = cubicRoots01(A, B, C, D, dirs);
  for (let i = 0; i < roots.length; i++) {
    const t = roots[i]!;
    const p = evalCubic(c, t);
    // Where along the line does it land? Outside the segment is not an intersection.
    const u = ((p.x - x0) * dx + (p.y - y0) * dy) / (len * len);
    if (u < -tol / len || u > 1 + tol / len) continue;
    // A caller that looks a little way past the segment's ends (the boolean's ray cast, which
    // looks behind its origin) needs the fraction as it is, sign and all; a clamped fraction
    // put every hit just behind the origin AT the origin, where it read as a curve through
    // the point.
    out.push({ t1: clamp ? Math.min(1, Math.max(0, u)) : u, t2: t, x: p.x, y: p.y, dir: dirs[i] });
  }
  return out;
}

// ── fat-line clipping: cubic × cubic ──────────────────────────────────────────

/** The fat line of a curve: the line through its endpoints, plus the signed
 *  distances of the two interior controls, widened to bound the whole curve.
 *  A cubic lies entirely within the convex hull of its controls, so the extreme
 *  control distances (scaled by the standard 3/4 factor) bound it. */
function fatLine(c: Cubic): { nx: number; ny: number; c0: number; dMin: number; dMax: number } | null {
  let dx = c[6] - c[0], dy = c[7] - c[1];
  if (Math.hypot(dx, dy) < 1e-12) {
    // Closed or near-closed curve: use the longest control leg for a direction.
    dx = c[4] - c[0]; dy = c[5] - c[1];
    if (Math.hypot(dx, dy) < 1e-12) return null;
  }
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const c0 = nx * c[0] + ny * c[1];
  const d1 = nx * c[2] + ny * c[3] - c0;
  const d2 = nx * c[4] + ny * c[5] - c0;
  // Sederberg's bound: the hull of the distance-Bernstein polygon, tightened by 3/4
  // when both interior distances share a sign, 4/9 otherwise.
  const k = d1 * d2 > 0 ? 3 / 4 : 4 / 9;
  const dMin = k * Math.min(0, d1, d2);
  const dMax = k * Math.max(0, d1, d2);
  return { nx, ny, c0, dMin, dMax };
}

/**
 * Clip `c`'s parameter range to the part that could lie inside `fat`.
 *
 * The distance of `c` from the fat line's axis is itself a cubic in `t`, in Bernstein
 * form. Its convex hull in (t, distance) space bounds it, so intersecting that hull
 * with the horizontal band [dMin, dMax] gives a parameter interval that provably
 * contains every intersection - and usually discards most of the domain in one step.
 */
function clipToFatLine(
  c: Cubic, fat: NonNullable<ReturnType<typeof fatLine>>, cutPad: number, testPad: number,
): [number, number] | null {
  const d = [
    fat.nx * c[0] + fat.ny * c[1] - fat.c0,
    fat.nx * c[2] + fat.ny * c[3] - fat.c0,
    fat.nx * c[4] + fat.ny * c[5] - fat.c0,
    fat.nx * c[6] + fat.ny * c[7] - fat.c0,
  ];
  const pts: Pt[] = d.map((v, i) => ({ x: i / 3, y: v }));

  // Convex hull of four points with monotonically increasing x - the upper and lower
  // chains are enough, and cheaper than a general hull.
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const chain = (sign: number): Pt[] => {
    const h: Pt[] = [];
    for (const p of pts) {
      while (h.length >= 2 && sign * cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    return h;
  };
  const upper = chain(-1), lower = chain(1);

  // Where does a hull chain cross a horizontal level? Those crossings bracket the
  // surviving parameter range.
  const crossings = (h: Pt[], level: number): number[] => {
    const ts: number[] = [];
    for (let i = 1; i < h.length; i++) {
      const a = h[i - 1]!, b = h[i]!;
      if ((a.y - level) * (b.y - level) <= 0 && Math.abs(b.y - a.y) > 1e-18) {
        ts.push(a.x + ((level - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
    }
    return ts;
  };

  // The level the hull chains are CUT at and the level an endpoint is TESTED against are
  // given separately, because the two searches want different ones. The clip search cuts at
  // the bare band and tests a hair outside it, as it always has. The overrun search cuts and
  // tests at the same padded band: at the depths it reaches, the distances it measures carry
  // a few hundred ulps of rounding, and a bare cut threw away ranges that still held a
  // crossing, so two arcs a hair apart lost it.
  const lo = fat.dMin - cutPad, hi = fat.dMax + cutPad;
  const inBand = (v: number) => v >= fat.dMin - testPad && v <= fat.dMax + testPad;
  const ts: number[] = [];
  for (const h of [upper, lower]) { ts.push(...crossings(h, lo), ...crossings(h, hi)); }
  if (inBand(d[0]!)) ts.push(0);
  if (inBand(d[3]!)) ts.push(1);
  if (!ts.length) return null;                    // entirely outside the band
  const t0 = Math.max(0, Math.min(...ts)), t1 = Math.min(1, Math.max(...ts));
  return t1 < t0 ? null : [t0, t1];
}

/** Is the whole of `c` within `pad` of the band of `fat`? By the convex hull property that
 *  holds whenever its four control points do, so it is a proof about the curve rather than
 *  a sample of it. */
function withinFatLine(c: Cubic, fat: NonNullable<ReturnType<typeof fatLine>>, pad: number): boolean {
  const lo = fat.dMin - pad, hi = fat.dMax + pad;
  for (let i = 0; i < 8; i += 2) {
    const d = fat.nx * c[i]! + fat.ny * c[i + 1]! - fat.c0;
    if (!(d >= lo && d <= hi)) return false;
  }
  return true;
}

/** How many times longer than `tol` both pieces must be before a stalled pair is handed to
 *  `scanStalled`. See `atResolutionFloor`. */
const FLOOR_MIN_SIZE = 16;

/**
 * Has a stalled pair of pieces reached the finest detail a fat-line clip can resolve?
 *
 * Asked only after a clip has failed to shrink `c1`. True when both pieces are straight to
 * within `tol`, both are longer than a few `tol`, and each lies within `tol` of the other's
 * fat line. A fat line is no wider than its curve is bent, so the two pieces then run along
 * one line to a few times `tol` over the whole of both. A clip measures distance from that
 * line and nothing else, so it cannot tell where along the pieces a crossing is, and
 * bisecting them does not help: the halves still lie along the same line, the clip still
 * fails, and the number of surviving pairs doubles with every second bisection until the
 * depth cap ends it. Two curves that agree to high order at a shared endpoint (a C/S pair
 * repeated in one path, or the stroke outline built from it) spent 900,000 recursion steps
 * per pair there. Circles a hair apart, which cross at angles near a millionth of a radian,
 * lost their crossings to the depth cap and to the cap on reported hits.
 *
 * So the search stops on such a pair, and the pair's parameter ranges are kept. They are
 * not dropped: two pieces this close can still cross, at an angle too small for the clip
 * to see, and `scanStalled` finds where by asking which side of one curve the other is on.
 *
 * Each condition rules out a case that is NOT a stretch of that kind:
 * - containment both ways, because a stall alone can come from a doubling-back piece whose
 *   control polygon straddles the band while the curve crosses it steeply, and because a
 *   long piece can lie along a short one's line only if the angle between them is tiny;
 * - the size bound, because an ordinary crossing converges to pieces about `tol` long in a
 *   few more clips, and that is cheaper than a scan. It is low because the clip also stalls
 *   on noise: coordinates near 100 are rounded to about 1e-14, so two curves meeting at an
 *   angle of 1e-6 cannot be separated by clipping once the pieces are shorter than about
 *   1e-6. With a bound of a thousand `tol` the search went on bisecting those pieces, into
 *   the caps.
 */
function atResolutionFloor(
  c1: Cubic, c2: Cubic, s1: number, s2: number,
  fat2: NonNullable<ReturnType<typeof fatLine>>, tol: number,
): boolean {
  const minSize = FLOOR_MIN_SIZE * tol;
  if (!(s1 > minSize && s2 > minSize)) return false;
  // Cheapest test first: most stalls are not near the floor, and this one fails for them.
  if (!withinFatLine(c1, fat2, tol)) return false;
  if (flatnessCubic(c1) > tol || flatnessCubic(c2) > tol) return false;
  const fat1 = fatLine(c1);
  return fat1 !== null && withinFatLine(c2, fat1, tol);
}

/** Are the two pieces within `tol` of each other at every equal parameter, forwards or
 *  reversed? The difference of two cubics is a cubic whose controls are the differences of
 *  theirs, and a cubic lies in the convex hull of its controls, so four small differences
 *  bound the whole difference. */
function coincideAtParams(a: Cubic, b: Cubic, tol: number): boolean {
  for (let i = 0; i < 8; i += 2) {
    if (Math.hypot(a[i]! - b[i]!, a[i + 1]! - b[i + 1]!) > tol) return false;
  }
  return true;
}

/**
 * The range of the other caller's curve that is the same curve as this piece of `c1`, at
 * the same parameters or at the reversed ones, within `tol` everywhere. `c1` is the piece
 * of the caller's curve over [lo, hi] (of its second curve when `swap`); the other curve is
 * cut at the same range, and at the mirrored range, and each cut is compared with the piece
 * control point by control point. Null when neither agrees.
 */
function coincidentTwin(search: ClipSearch, swap: boolean, c1: Cubic, lo: number, hi: number, tol: number): [number, number] | null {
  const other = swap ? search.c1 : search.c2;
  if (coincideAtParams(c1, subCubic(other, lo, hi), tol)) return [lo, hi];
  const rev = subCubic(other, 1 - hi, 1 - lo);
  const flipped: Cubic = [rev[6], rev[7], rev[4], rev[5], rev[2], rev[3], rev[0], rev[1]];
  if (coincideAtParams(c1, flipped, tol)) return [1 - hi, 1 - lo];
  return null;
}

/** Newton steps `nearest` may take on the geometric condition after the root solve.
 *
 *  High, because at a cusp this is linear convergence, not quadratic: the slope the step
 *  divides by carries the curvature term, which is what makes the step well conditioned
 *  there, but the step then only shrinks the error by a constant factor each time. The one
 *  case measured needed 24 steps and was converged by 32; twice that is the margin. The loop
 *  stops as soon as a step moves nothing, so an ordinary foot still pays one or two steps.
 *  The cause is in `rootInBracket` in bezier.ts, which exits on a flat polynomial VALUE while
 *  its root is still a long way off in PARAMETER, and the one-line fix there would let this
 *  come back down to four. */
const POLISH_STEPS = 64;
/** A Newton step smaller than this, in parameter, ends the polish: four ulps of a parameter
 *  in [0, 1]. */
const POLISH_STEP_MIN = 4 * Number.EPSILON;
/** Steps in a row that come no nearer than the step before them before the polish stops. */
const POLISH_PATIENCE = 2;

/**
 * The nearest point of `c` to (x, y), polished.
 *
 * `nearestOnCubic` solves the quintic whose roots are the candidate feet and returns the
 * best. Where the curve is nearly stationary, at a cusp or a very tight turn, that quintic is
 * flat around its root and the root it returns can be a long way off in parameter while
 * the polynomial reads as zero: from a point on a copy of a cusp curve a hair from its apex,
 * the foot came back 4e-9 away where the true distance was 8e-11, and the crossing at the
 * apex was refused as not on both curves. Newton on the geometric condition itself, that
 * the offset be perpendicular to the tangent, is well conditioned there because its slope
 * carries the curvature term. A step is kept only while it brings the point nearer.
 */
function nearest(c: Cubic, x: number, y: number): { t: number; point: Pt; distance: number } {
  const n = nearestOnCubic(c, x, y);
  let t = n.t, best = n.distance, bestT = n.t, bestP = n.point, worse = 0, prev = n.distance;
  for (let i = 0; i < POLISH_STEPS; i++) {
    const p = evalCubic(c, t), d1 = tangentAt(c, t);
    const d2 = secondDerivative(c, t);
    const f = (p.x - x) * d1.x + (p.y - y) * d1.y;
    const df = d1.x * d1.x + d1.y * d1.y + (p.x - x) * d2.x + (p.y - y) * d2.y;
    if (!(Math.abs(df) > 0)) break;
    const step = f / df;
    // Converged: a step below a few ulps of the parameter changes nothing the point can
    // show. Tested on the step, not on whether `t` moved, because a well-conditioned foot
    // wanders in its last ulp for ever and every projection paid all the steps.
    if (!(Math.abs(step) > POLISH_STEP_MIN)) break;
    const tn = Math.min(1, Math.max(0, t - step));
    if (tn === t) break;
    const pn = evalCubic(c, tn);
    const dn = Math.hypot(pn.x - x, pn.y - y);
    if (dn < best) { best = dn; bestT = tn; bestP = pn; }
    // Progress is judged against the previous step, not against the best point: at a cusp
    // the first step from the quintic's root can leave the point a long way off and the
    // steps after it then close in geometrically, every one of them nearer than the last but
    // none yet nearer than where it started. Two steps in a row that come no nearer than the
    // one before are a converged foot wandering in its last ulps, or a divergence.
    if (!(dn < prev)) { if (++worse >= POLISH_PATIENCE) break; } else worse = 0;
    prev = dn;
    t = tn;
  }
  return best < n.distance ? { t: bestT, point: bestP, distance: best } : n;
}

/** The second derivative of a cubic at `t`. */
function secondDerivative(c: Cubic, t: number): Pt {
  const mt = 1 - t;
  return {
    x: 6 * (mt * (c[4] - 2 * c[2] + c[0]) + t * (c[6] - 2 * c[4] + c[2])),
    y: 6 * (mt * (c[5] - 2 * c[3] + c[1]) + t * (c[7] - 2 * c[5] + c[3])),
  };
}

/** How far a curve reaches from its start: a chord-and-hull measure, no roots. */
function reach(c: Cubic): number {
  return Math.max(
    Math.hypot(c[2] - c[0], c[3] - c[1]),
    Math.hypot(c[4] - c[0], c[5] - c[1]),
    Math.hypot(c[6] - c[0], c[7] - c[1]),
  );
}

/** Could the point be within `pad` of the curve? Its control box and its fat line both
 *  hold the whole curve, so a point outside either one, by more than `pad`, is not on
 *  it. Two cheap rejects before a projection. */
function mayLieOn(c: Cubic, fat: ReturnType<typeof fatLine>, x: number, y: number, pad: number): boolean {
  const b = hullBounds(c);
  if (x < b.x0 - pad || x > b.x1 + pad || y < b.y0 - pad || y > b.y1 + pad) return false;
  if (!fat) return true;
  const d = fat.nx * x + fat.ny * y - fat.c0;
  return d >= fat.dMin - pad && d <= fat.dMax + pad;
}

/**
 * Two curves that share a run of boundary, answered as the two ends of that run.
 *
 * A run can only begin and end where one of the four endpoints falls, so each endpoint is
 * placed on the other curve: directly when the two curves share that vertex, and
 * otherwise by projection, which is only attempted when the point is inside both the
 * control box and the fat line of the other curve. Two or more placements bracket a
 * candidate run, and the two sub-curves it spans are then compared at four parameters. A
 * cubic difference that vanishes at four parameters is identically zero, so agreement
 * there is a proof that the sub-curves are the same curve, not a sample suggesting it. A
 * pair that merely crosses twice fails it, because the pieces between two crossings
 * enclose a lens.
 *
 * This has to be settled before the clip is asked anything. Clipping looks for isolated
 * crossings and a shared run has none, so the search subdivides the whole run: a curve
 * against the first half of itself took five seconds and returned a scatter of points.
 *
 * Only the two ends of the run are returned. Outside the run the curves can still cross,
 * where one of them loops back over the other, and such a crossing is not reported. The
 * loop `P = [0,0, 150,100, -50,100, 100,0]` passes through (50, 42.857) at t = 0.1727 and
 * again at t = 0.8273, and `P` against its own first half answers only the run from 0 to
 * 0.5, not that point. The clip search did not report it either.
 *
 * The comparison tolerance is `tol`, raised to a small multiple of double precision at
 * the curves' magnitude, because a sub-curve cut from coordinates near 1e6 cannot agree
 * with its twin to 1e-9 whatever the geometry.
 */
function sharedRun(c1: Cubic, c2: Cubic, tol: number): Intersection[] | null {
  let mag = 0;
  for (let i = 0; i < 8; i++) mag = Math.max(mag, Math.abs(c1[i]!), Math.abs(c2[i]!));
  const eps = Math.max(tol, mag * 64 * Number.EPSILON);

  // `onC2[t]` is where end `t` of c1 falls on c2, and `onC1[u]` where end `u` of c2 falls
  // on c1. Shared vertices are placed first, with no projection.
  const onC2: (number | null)[] = [null, null];
  const onC1: (number | null)[] = [null, null];
  let shared = 0;
  for (const t of [0, 1]) {
    for (const u of [0, 1]) {
      if (onC2[t] !== null) continue;
      if (Math.hypot(c1[6 * t]! - c2[6 * u]!, c1[6 * t + 1]! - c2[6 * u + 1]!) <= eps) {
        onC2[t] = u;
        onC1[u] ??= t;
        shared++;
      }
    }
  }
  // The remaining ends are projected only if they can lie on the other curve at all, and
  // only if, together with the shared vertices, they could bound a run: a run needs two
  // distinct points, and the common case (neighbours in one contour, which share exactly
  // one vertex) has just the one.
  const fat1 = fatLine(c1), fat2 = fatLine(c2);
  const try1 = [0, 1].filter((t) => onC2[t] === null && mayLieOn(c2, fat2, c1[6 * t]!, c1[6 * t + 1]!, eps));
  const try2 = [0, 1].filter((u) => onC1[u] === null && mayLieOn(c1, fat1, c2[6 * u]!, c2[6 * u + 1]!, eps));
  if (shared + try1.length + try2.length < 2) return null;
  for (const t of try1) {
    const n = nearestOnCubic(c2, c1[6 * t]!, c1[6 * t + 1]!);
    if (n.distance <= eps) onC2[t] = n.t;
  }
  for (const u of try2) {
    const n = nearestOnCubic(c1, c2[6 * u]!, c2[6 * u + 1]!);
    if (n.distance <= eps) onC1[u] = n.t;
  }
  const ends: [number, number][] = [];
  for (const t of [0, 1]) if (onC2[t] !== null) ends.push([t, onC2[t]!]);
  for (const u of [0, 1]) if (onC1[u] !== null) ends.push([onC1[u]!, u]);
  if (ends.length < 2) return null;

  let a0 = 1, a1 = 0, b0 = 1, b1 = 0;
  for (const [t, u] of ends) {
    a0 = Math.min(a0, t); a1 = Math.max(a1, t);
    b0 = Math.min(b0, u); b1 = Math.max(b1, u);
  }
  if (!(a1 - a0 > T_EPS && b1 - b0 > T_EPS)) return null;
  const s1 = subCubic(c1, a0, a1), s2 = subCubic(c2, b0, b1);
  // A run no longer than the tolerance is a point of contact, and the clip handles those.
  if (reach(s1) <= eps || reach(s2) <= eps) return null;

  for (const dir of [1, -1] as const) {
    let same = true;
    for (const t of [0, 1 / 3, 2 / 3, 1]) {
      const p = evalCubic(s1, t), q = evalCubic(s2, dir === 1 ? t : 1 - t);
      if (Math.abs(p.x - q.x) > eps || Math.abs(p.y - q.y) > eps) { same = false; break; }
    }
    if (!same) continue;
    const start = evalCubic(c1, a0), end = evalCubic(c1, a1);
    return [
      { t1: a0, t2: dir === 1 ? b0 : b1, x: start.x, y: start.y },
      { t1: a1, t2: dir === 1 ? b1 : b0, x: end.x, y: end.y },
    ];
  }
  return null;
}

/** Recursion depth at which the clip search stops refining a pair. */
const MAX_DEPTH = 60;
/** Multiples of the search's rounding pad (64 ulps of the coordinates) that the box test
 *  between two pieces is widened by, covering the rounding that `MAX_DEPTH` levels of
 *  subdivision accumulate. */
const BOX_SLACK = 16;
/** How many times `tol` a point placed on the other curve may lie from the piece it was
 *  placed on and still be kept for the scan. See the point branch of `overrunClip`. */
const POINT_OFF_SLACK = 1000;

/** The sine of the angle below which a point the clip search closes on is left to
 *  `scanStalled` rather than reported. See `shallow`. */
const SHALLOW = 1e-3;

/**
 * Do the caller's curves meet at a shallow angle at (a, b), given in the current order?
 *
 * Where two curves run along each other within `tol`, fat-line clips still cut pieces
 * down, to wherever the two happen to be closest to each other's lines, and each piece
 * that gets down to the tolerance was reported as a hit. Two arcs 1000 units long that
 * touch at one point gave 60 hits spread over the two units where they are that close,
 * and those filled the hit list before the search reached their crossing. A boolean
 * reads more than nine hits as a shared stretch and cuts at none of them. So a point
 * closed on at a shallow angle, or where either curve has no direction, goes to the scan,
 * which reports a crossing once where the side changes and a touch once where it does not.
 */
function shallow(search: ClipSearch, swap: boolean, a: number, b: number): boolean {
  // An end of each curve: a shared vertex, and exact as it stands. Neighbours in a contour
  // meet there, often along one tangent, and scanning every such pair doubled the cost of
  // stroking a path.
  if ((a <= TOUCH || a >= 1 - TOUCH) && (b <= TOUCH || b >= 1 - TOUCH)) return false;
  const d1 = tangentAt(search.c1, swap ? b : a), d2 = tangentAt(search.c2, swap ? a : b);
  const l1 = Math.hypot(d1.x, d1.y), l2 = Math.hypot(d2.x, d2.y);
  // A point where either curve is nearly stationary has no direction to judge the angle
  // by: at the apex of a cusp the tangent is a rounding-sized vector pointing anywhere,
  // and two cusp curves touching at their apexes read as crossing at a wide angle at every
  // one of the pieces the clip closed on there. A hundred and twenty-nine points were
  // reported for that one contact, the hit cap was reached, and the search stopped before
  // it had looked at the two real crossings further along. The threshold is the one the
  // scan reads a side by, and the scan is what such a point goes to.
  const still = FOOT_SPEED * search.size;
  if (!(l1 > still && l2 > still)) return true;
  return Math.abs(d1.x * d2.y - d1.y * d2.x) < SHALLOW * l1 * l2;
}

/** Keep a pair's parameter ranges for `scanStalled`, in the caller's order. */
function stall(
  search: ClipSearch, swap: boolean, t1lo: number, t1hi: number, t2lo: number, t2hi: number,
): void {
  if (search.stalled.length >= SCAN_LIMITS.maxStalledPairs * 4) return;
  if (swap) search.stalled.push(t2lo, t2hi, t1lo, t1hi);
  else search.stalled.push(t1lo, t1hi, t2lo, t2hi);
}

/**
 * The overrun search's own clip: the same alternation of fat-line clips and bisection, with
 * the three ways out of a pair it cannot separate (`twinNode`, `coincidentTwin`,
 * `atResolutionFloor`) and a work ceiling. Reached only past `CLIP_BUDGET`.
 */
function overrunClip(
  c1: Cubic, c2: Cubic, t1lo: number, t1hi: number, t2lo: number, t2hi: number,
  tol: number, depth: number, search: ClipSearch, swap = false,
): void {
  // The ceiling, checked before anything else. Without it one pair of a curve against a
  // reparametrised piece of itself (`OVERRUN_BUDGET` says which) ran to 28 million nodes and
  // 47 seconds. Past it the search stops descending; the stretches it has already kept still
  // go to the scan, so the pair is answered rather than abandoned.
  if (search.nodes >= OVERRUN_BUDGET.maxNodes) { search.over = true; return; }
  search.nodes++;
  const out = search.out;
  // `swap` tracks whether c1/c2 are currently the caller's second/first curve. The
  // recursion exchanges them every step (that alternation is what makes the clipping
  // converge quadratically), and this flag puts the parameters back the right way
  // round on the way out - rather than the results being silently transposed.
  const emit = (t1: number, t2: number, x: number, y: number) =>
    out.push(swap ? { t1: t2, t2: t1, x, y } : { t1, t2, x, y });
  if (out.length > MAX_HITS) return;
  // The box test is padded by the rounding the pieces carry as well as by `tol`: a piece cut
  // from a curve at coordinates near 5e4 through twenty-five levels of subdivision sits a few
  // hundred ulps from where it belongs, and a crossing the clip had converged on to within
  // 1e-8 was refused because the point lay 1.4e-9 outside the other piece's box. A pair let
  // through here on that slack is still measured at `tol` before anything is reported.
  if (!boxesOverlap(hullBounds(c1), hullBounds(c2), tol + BOX_SLACK * search.pad)) return;
  if (depth > MAX_DEPTH) {
    // Out of depth with the pair still unresolved. A shallow crossing gets here: every
    // halving of its pieces costs a clip that fails and a bisection, and a crossing at
    // 7e-6 rad between curves 900 units long needed more halvings than the cap allows
    // before its pieces were short enough to stall. The pair goes to `scanStalled` rather
    // than being dropped. The cap itself stays: a pair that cannot converge, because its
    // coordinates are too large for `tol`, would otherwise double without end.
    stall(search, swap, t1lo, t1hi, t2lo, t2hi);
    return;
  }

  // The finest distance this search can resolve: the tolerance asked for, or the rounding
  // noise of the coordinates when that is coarser. Every test below that asks whether two
  // pieces can still be told apart uses it, and the fat-line band is padded by it, so the
  // clip and the stall agree on what "cannot be separated" means. With the band padded by
  // the noise but the stall still asking for `tol`, pieces at coordinates near 4e5 that were
  // a few noise widths apart could neither be clipped nor stalled, and bisected to the
  // depth cap: 3.5 s for one pair.
  const res = Math.max(tol, search.pad);
  // Both pieces are down to a point: record one intersection.
  const s1 = Math.hypot(c1[6] - c1[0], c1[7] - c1[1]) + flatnessCubic(c1);
  const s2 = Math.hypot(c2[6] - c2[0], c2[7] - c2[1]) + flatnessCubic(c2);
  if (s1 <= res && s2 <= res) {
    const m1 = (t1lo + t1hi) / 2, m2 = (t2lo + t2hi) / 2;
    const p = evalCubic(c1, 0.5), q = evalCubic(c2, 0.5);
    // The box test above is padded by the rounding of deep subdivision, so two pieces can
    // reach this point a few hundred ulps apart without meeting: measured, not assumed. A
    // pair that close but not touching is left to the scan, as a point just off a piece is.
    const apart = Math.hypot(p.x - q.x, p.y - q.y);
    if (apart > res) {
      if (apart <= POINT_OFF_SLACK * tol) stall(search, swap, t1lo, t1hi, t2lo, t2hi);
      return;
    }
    if (shallow(search, swap, m1, m2)) stall(search, swap, t1lo, t1hi, t2lo, t2hi);
    else emit(m1, m2, p.x, p.y);
    return;
  }

  const fat = fatLine(c2);
  if (!fat && s2 <= res) {
    // c2 is down to a point with no direction: a clip whose range ends on a piece's end
    // leaves a range of zero width. There is no fat line to clip with, and bisecting c1
    // down to the tolerance instead costs one level per halving, which a shallow crossing
    // has usually spent already. An arc crossing a near-copy at t = 0.5 lost its crossing
    // to the depth cap that way. So the point is placed on c1 directly.
    const p = evalCubic(c2, 0.5);
    const n = nearestOnCubic(c1, p.x, p.y);
    if (n.distance > tol + s2) {
      // The point is not on this piece of c1, but it can still be within `tol` of c1 a
      // hair past the piece's end: the clip kept one piece and the crossing sits just
      // outside it. A flat curve crossing a near-copy at t = 0.3 lost its crossing that
      // way, with the point 1e-9 past the end. Such a pair goes to the scan, which reads
      // the side on either side of it.
      if (n.distance <= POINT_OFF_SLACK * tol) stall(search, swap, t1lo, t1hi, t2lo, t2hi);
      return;
    }
    const m1 = t1lo + (t1hi - t1lo) * n.t, m2 = (t2lo + t2hi) / 2;
    if (shallow(search, swap, m1, m2)) stall(search, swap, t1lo, t1hi, t2lo, t2hi);
    else emit(m1, m2, n.point.x, n.point.y);
    return;
  }
  // The band is widened by the rounding noise of the distances measured against it, so a
  // clip never discards a range on evidence finer than the coordinates carry. With a fixed
  // 1e-12, a crossing at coordinates near 4000 was clipped away at depth 27: the crossing
  // curve's control distance came out 3e-12 outside the band by rounding alone.
  const clipped = fat ? clipToFatLine(c1, fat, search.pad, search.pad) : [0, 1] as [number, number];
  if (!clipped) return;
  const [lo, hi] = clipped;
  const shrink = hi - lo;

  // A clip that removes less than a fifth of the domain is not making progress -
  // the classic near-tangential case. Bisect the LONGER curve and recurse on both
  // halves; this is what keeps the worst case finite rather than spinning.
  if (shrink > 0.8) {
    // Two pieces that are the same curve to within `tol` at equal parameters, in either
    // direction, cannot be separated by any clip or bisection: the whole of each lies within
    // `tol` of the other. Proved from the control points of their difference (a cubic lies in
    // the hull of its controls), so it is a proof about the pieces, not a sample. Their
    // ranges go to the scan whole, however long they are, which is what keeps a near-copy of
    // a long curve from being cut into a hundred thousand pieces before the scan sees it.
    // A near-copy of the curve is decided from the polynomial of its offset, where the
    // pieces are regular enough for that to be a proof, instead of being cut down until
    // the fat lines part: two loops a hair apart spent a million clip nodes that way.
    if (search.twin !== 0 && twinNode(search, swap, c1, t1lo, t1hi, t2lo, t2hi, tol)) return;
    if (s1 > FLOOR_MIN_SIZE * tol && s2 > FLOOR_MIN_SIZE * tol) {
      const twin = coincidentTwin(search, swap, c1, t1lo, t1hi, tol);
      if (twin) {
        stall(search, swap, t1lo, t1hi, Math.min(t2lo, twin[0]), Math.max(t2hi, twin[1]));
        return;
      }
    }
    // Two pieces that already lie along one line to within `tol` cannot be separated by
    // bisecting them further. Their ranges are kept for `scanStalled`, which finds where
    // along them the curves change sides.
    if (fat && atResolutionFloor(c1, c2, s1, s2, fat, res)) {
      stall(search, swap, t1lo, t1hi, t2lo, t2hi);
      return;
    }
    if (s1 >= s2) {
      const [a, b] = splitCubic(c1, 0.5);
      const mid = (t1lo + t1hi) / 2;
      overrunClip(a, c2, t1lo, mid, t2lo, t2hi, tol, depth + 1, search, swap);
      overrunClip(b, c2, mid, t1hi, t2lo, t2hi, tol, depth + 1, search, swap);
    } else {
      const [a, b] = splitCubic(c2, 0.5);
      const mid = (t2lo + t2hi) / 2;
      overrunClip(c1, a, t1lo, t1hi, t2lo, mid, tol, depth + 1, search, swap);
      overrunClip(c1, b, t1lo, t1hi, mid, t2hi, tol, depth + 1, search, swap);
    }
    return;
  }

  const nc1 = subCubic(c1, lo, hi);
  const nt1lo = t1lo + (t1hi - t1lo) * lo;
  const nt1hi = t1lo + (t1hi - t1lo) * hi;
  // Roles exchange so the next iteration clips the other curve.
  overrunClip(c2, nc1, t2lo, t2hi, nt1lo, nt1hi, tol, depth + 1, search, !swap);
}

// ── the clip search, and the budget it runs under ──────────────────────────

/**
 * Calls to `clipIntersect` one cubic against cubic pair may make before it is abandoned to
 * the overrun search.
 *
 * Exported mutable so a test can lower it and show what the other search answers, as
 * `SCAN_LIMITS` below is and as `HOOK_BUDGET_MS` in runtime.ts is. The default is the
 * contract: raise it and slow pairs come back, lower it and ordinary pairs stop being
 * answered by the search whose answers this file has always promised.
 *
 * The number came from the node counts of the search itself, measured over every corpus and
 * shape family in this tree. Ordinary pairs finish in tens of nodes; over the recorded
 * corpora the p99.9 is 467 to 571 and the heaviest pair of a sweep of circles, ellipses,
 * stars and rounded rectangles takes 7,598. The pairs that cannot be clipped apart take
 * 21,627 and up, to six million. The gap this number sits in is wide and empty.
 */
export const CLIP_BUDGET = { maxNodes: 16384 };

/**
 * Running counts: how many cubic against cubic pairs have reached the clip search, how many
 * of those ran out of budget, how many of those the overrun search then had to stop as well,
 * the nodes each search has spent in all, and the nodes the most recent pair spent in each.
 *
 * Diagnostic only. Nothing in the engine reads them and no answer depends on them; they are
 * how a test tells which search answered a pair, and how the budgets were measured.
 */
export const CLIP_COUNTS = { pairs: 0, overruns: 0, ceilings: 0, nodes: 0, lastNodes: 0, overrunNodes: 0, lastOverrunNodes: 0, maxOverrunNodes: 0 };

/** One pair's budget while the clip search runs on it. */
interface ClipWork {
  /** Calls to `clipIntersect` so far. */
  nodes: number;
  /** The value of `CLIP_BUDGET.maxNodes` this pair started with, so that a change to the
   *  budget partway through a boolean cannot split one pair between two limits. */
  limit: number;
  /** The budget ran out, so this pair's partial hits are thrown away and the overrun search
   *  answers it. */
  over: boolean;
}

/** Cubic × cubic, by alternating fat-line clips with bisection when a clip stalls. */
function clipIntersect(
  c1: Cubic, c2: Cubic, t1lo: number, t1hi: number, t2lo: number, t2hi: number,
  tol: number, depth: number, out: Intersection[], work: ClipWork, swap = false,
): void {
  // Counting the node, and stopping when the count passes the budget, is the only change to
  // this search. Every decision below is the one it has always made, so a pair that finishes
  // inside the budget gets the answer it always got.
  if (work.over) return;
  if (++work.nodes > work.limit) { work.over = true; return; }
  // `swap` tracks whether c1/c2 are currently the caller's second/first curve. The
  // recursion exchanges them every step (that alternation is what makes the clipping
  // converge quadratically), and this flag puts the parameters back the right way
  // round on the way out - rather than the results being silently transposed.
  const emit = (t1: number, t2: number, x: number, y: number) =>
    out.push(swap ? { t1: t2, t2: t1, x, y } : { t1, t2, x, y });
  if (out.length > 128 || depth > 60) return;
  if (!boxesOverlap(hullBounds(c1), hullBounds(c2), tol)) return;

  // Both pieces are down to a point: record one intersection.
  const s1 = Math.hypot(c1[6] - c1[0], c1[7] - c1[1]) + flatnessCubic(c1);
  const s2 = Math.hypot(c2[6] - c2[0], c2[7] - c2[1]) + flatnessCubic(c2);
  if (s1 <= tol && s2 <= tol) {
    const p = evalCubic(c1, 0.5);
    emit((t1lo + t1hi) / 2, (t2lo + t2hi) / 2, p.x, p.y);
    return;
  }

  const fat = fatLine(c2);
  const clipped = fat ? clipToFatLine(c1, fat, 0, 1e-12) : [0, 1] as [number, number];
  if (!clipped) return;
  const [lo, hi] = clipped;
  const shrink = hi - lo;

  // A clip that removes less than a fifth of the domain is not making progress -
  // the classic near-tangential case. Bisect the LONGER curve and recurse on both
  // halves; this is what keeps the worst case finite rather than spinning.
  if (shrink > 0.8) {
    if (s1 >= s2) {
      const [a, b] = splitCubic(c1, 0.5);
      const mid = (t1lo + t1hi) / 2;
      clipIntersect(a, c2, t1lo, mid, t2lo, t2hi, tol, depth + 1, out, work, swap);
      clipIntersect(b, c2, mid, t1hi, t2lo, t2hi, tol, depth + 1, out, work, swap);
    } else {
      const [a, b] = splitCubic(c2, 0.5);
      const mid = (t2lo + t2hi) / 2;
      clipIntersect(c1, a, t1lo, t1hi, t2lo, mid, tol, depth + 1, out, work, swap);
      clipIntersect(c1, b, t1lo, t1hi, mid, t2hi, tol, depth + 1, out, work, swap);
    }
    return;
  }

  const nc1 = subCubic(c1, lo, hi);
  const nt1lo = t1lo + (t1hi - t1lo) * lo;
  const nt1hi = t1lo + (t1hi - t1lo) * hi;
  // Roles exchange so the next iteration clips the other curve.
  clipIntersect(c2, nc1, t2lo, t2hi, nt1lo, nt1hi, tol, depth + 1, out, work, !swap);
}

// ── twin pairs: a curve against a near-copy of itself ─────────────────────────

/** How near, as a share of the pair's size, every control point of one curve must be to
 *  the corresponding one of the other (or of the other reversed) before a pair is tried
 *  as twins. Generous on purpose: `twinNode` measures its own bounds at each node. */
const TWIN_BAND = 1e-4;
/** The cosine of the most a curve may turn over a range `twinNode` treats as regular. */
const TWIN_TURN = 0.5;
/** The most the curvature bound times the square of the twin distance may reach, as a
 *  share of `tol`, for the offset polynomial to bound every contact. See `twinNode`. */
const TWIN_BEND = 0.35;
/** The multiple of `tol` within which the offset polynomial must lie for a point to be a
 *  possible contact: `tol` itself plus the bend allowance, rounded up. */
const TWIN_REACH = 1.5;
/** Subdivisions the run search makes at most: the runs' ends are located to 2^-12 of the
 *  piece's parameter, and the scan's sentinels place them from there. */
const TWIN_RUN_DEPTH = 12;

/** Binomial coefficients up to the degree of the run polynomial. */
const BINOM: number[][] = (() => {
  const rows: number[][] = [[1]];
  for (let n = 1; n <= 10; n++) {
    const prev = rows[n - 1]!, row = [1];
    for (let k = 1; k < n; k++) row.push(prev[k - 1]! + prev[k]!);
    row.push(1);
    rows.push(row);
  }
  return rows;
})();
/** The constant 1 as a Bernstein polynomial of degree 6, for raising a degree-4 one to 10. */
const ONES_6 = [1, 1, 1, 1, 1, 1, 1];

/** The product of two polynomials in Bernstein form, in Bernstein form. */
function bernMul(p: number[], q: number[]): number[] {
  const m = p.length - 1, n = q.length - 1;
  const out: number[] = new Array(m + n + 1).fill(0);
  const bm = BINOM[m]!, bn = BINOM[n]!, bmn = BINOM[m + n]!;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) out[i + j] = out[i + j]! + ((bm[i]! * bn[j]!) / bmn[i + j]!) * p[i]! * q[j]!;
  }
  return out;
}

/** The parameter ranges of [t0, t1] over which a Bernstein polynomial can be at or below
 *  zero, by subdivision: a piece whose coefficients are all positive is positive (the hull
 *  property), one whose coefficients are all at or below zero is a run, and a mixed one is
 *  split until it is one or the other or the depth runs out. Adjacent ranges are merged. */
function bernRuns(c: number[], t0: number, t1: number, depth: number, out: number[]): void {
  let lo = Infinity, hi = -Infinity;
  for (const v of c) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (lo > 0) return;
  if (hi <= 0 || depth >= TWIN_RUN_DEPTH) {
    if (out.length && out[out.length - 1] === t0) out[out.length - 1] = t1;
    else out.push(t0, t1);
    return;
  }
  const n = c.length, left: number[] = new Array(n), right: number[] = new Array(n);
  const w = c.slice();
  left[0] = w[0]!; right[n - 1] = w[n - 1]!;
  for (let k = 1; k < n; k++) {
    for (let i = 0; i < n - k; i++) w[i] = (w[i]! + w[i + 1]!) * 0.5;
    left[k] = w[0]!; right[n - 1 - k] = w[n - 1 - k]!;
  }
  const mid = (t0 + t1) / 2;
  bernRuns(left, t0, mid, depth + 1, out);
  bernRuns(right, mid, t1, depth + 1, out);
}

/**
 * Decide one node of the clip search between a curve and a near-copy of itself from the
 * polynomial of their offset, where that is a proof.
 *
 * Clipping cannot separate two curves a hair apart: the fat line of a piece is as wide as
 * the piece is bent, so the pieces must be cut down until they bend by less than the gap,
 * which for two loops a ten-millionth apart is a hundred thousand pieces and a million
 * nodes, nearly all of them proving that nothing happens there. A near-copy is a different
 * question, and has a direct answer. Let c1 be the piece being clipped and W the other
 * curve (reversed when the copy runs the other way), so that m = W over c1's own range is
 * the matched piece and D = c1 - m their offset, a cubic whose controls are the differences
 * of theirs. The signed distance of c1(s) from the tangent line of W at the matched point is
 * P(s) / |m'(s)| with P = m' x D, a polynomial of degree five. Where the two curves are
 * regular this is within a known amount of the true gap, so a run of the parameter where P
 * stays clear of zero holds no contact, and a run where it does not is handed to the scan.
 *
 * What makes it a proof, node by node:
 *
 * - W is regular over a range R holding both pieces' parameters: every leg of its
 *   derivative's control polygon points within 60 degrees of their mean direction and is
 *   no shorter than the scan's own speed floor. Then any two points of W in R are at least
 *   `vlo` times their parameter distance apart, and the curvature is bounded by
 *   `kappa = 2 max|d'| / vlo^2`, the second derivative's largest control (the legs'
 *   differences over the range's width) over the least speed squared.
 * - A contact of c1(s) with W at u lies within tol of c1(s), which lies within T of m(s),
 *   so |W(u) - W(t)| <= rho = tol + T, u is within rho / vlo of t, and the arc between them
 *   is at most 1.16 rho long (a turn under 60 degrees). The point W(u) is therefore within
 *   0.67 kappa rho^2 of the tangent line at W(t), and c1(s) within that plus tol. With
 *   kappa rho^2 held under 0.35 tol, every contact has |P| / |m'| <= 1.25 tol, and every
 *   run of {|P| <= 1.5 tol |m'|}, found from the Bernstein form of P^2 - (1.5 tol)^2 |m'|^2,
 *   holds every contact of the node. Those runs are stalled for the scan, with the range on
 *   W widened by rho / vlo, and nothing else in the node needs looking at.
 *
 * A node whose range is not regular (it holds a loop's turn, or a cusp's apex, where the
 * speed floor fails) returns false and is clipped and bisected as any other. Its children
 * are regular sooner or later, except the ones holding the apex itself, which the search
 * cuts down to the scan's floor as before; so a copy of a cusp costs the clip tree only
 * around its apex. A crossing between different branches of the curve (a loop against a
 * copy crosses the copy's other branch too) is in a node whose range holds the turn, and
 * is found by the clip as before.
 */
function twinNode(
  search: ClipSearch, swap: boolean, c1: Cubic, t1lo: number, t1hi: number, t2lo: number, t2hi: number, tol: number,
): boolean {
  const twin = search.twin;
  const W = swap ? (twin === 1 ? search.c1 : search.c1r!) : (twin === 1 ? search.c2 : search.c2r!);
  // The other piece's range in W's parameter, and the range both lie in, widened by half.
  const m2lo = twin === 1 ? t2lo : 1 - t2hi, m2hi = twin === 1 ? t2hi : 1 - t2lo;
  const lo0 = Math.min(t1lo, m2lo), hi0 = Math.max(t1hi, m2hi);
  const half = (hi0 - lo0) * 0.5;
  const R0 = Math.max(0, lo0 - half), R1 = Math.min(1, hi0 + half);
  if (!(R1 > R0)) return false;
  // Regularity of W over R, from the control polygon of its derivative there.
  const q = subCubic(W, R0, R1);
  const k = 3 / (R1 - R0);
  const dx0 = (q[2] - q[0]) * k, dy0 = (q[3] - q[1]) * k;
  const dx1 = (q[4] - q[2]) * k, dy1 = (q[5] - q[3]) * k;
  const dx2 = (q[6] - q[4]) * k, dy2 = (q[7] - q[5]) * k;
  let ux = dx0 + dx1 + dx2, uy = dy0 + dy1 + dy2;
  const ul = Math.hypot(ux, uy);
  if (!(ul > 0)) return false;
  ux /= ul; uy /= ul;
  const still = FOOT_SPEED * search.size;
  let vlo = Infinity;
  for (const [dx, dy] of [[dx0, dy0], [dx1, dy1], [dx2, dy2]] as const) {
    const along = dx * ux + dy * uy;
    if (!(along >= TWIN_TURN * Math.hypot(dx, dy)) || along < still) return false;
    if (along < vlo) vlo = along;
  }
  // The second derivative's controls are the legs' differences over the range's width, so
  // the curvature bound carries that width: without it a short range read as a thousand
  // times straighter than it was, and the certificate fired on pieces a tenth of a unit
  // apart where it holds only for pieces a millionth apart.
  const kappa = 2 * Math.max(Math.hypot(dx1 - dx0, dy1 - dy0), Math.hypot(dx2 - dx1, dy2 - dy1)) / ((R1 - R0) * vlo * vlo);
  // The matched piece and the offset, with the most the offset reaches.
  const m = subCubic(W, t1lo, t1hi);
  const dX = [c1[0] - m[0], c1[2] - m[2], c1[4] - m[4], c1[6] - m[6]];
  const dY = [c1[1] - m[1], c1[3] - m[3], c1[5] - m[5], c1[7] - m[7]];
  let T = 0;
  for (let i = 0; i < 4; i++) T = Math.max(T, Math.hypot(dX[i]!, dY[i]!));
  const rho = tol + T;
  if (kappa * rho * rho > TWIN_BEND * tol) return false;
  // P = m' x D and S = |m'|^2 in Bernstein form over the piece's own parameter.
  const eX = [3 * (m[2] - m[0]), 3 * (m[4] - m[2]), 3 * (m[6] - m[4])];
  const eY = [3 * (m[3] - m[1]), 3 * (m[5] - m[3]), 3 * (m[7] - m[5])];
  const pa = bernMul(eX, dY), pb = bernMul(eY, dX);
  const P = pa.map((v, i) => v - pb[i]!);
  const sa = bernMul(eX, eX), sb = bernMul(eY, eY);
  const S = bernMul(sa.map((v, i) => v + sb[i]!), ONES_6);
  const thr2 = (TWIN_REACH * tol) ** 2;
  const pp = bernMul(P, P);
  const Q = pp.map((v, i) => v - thr2 * S[i]!);
  const runs: number[] = [];
  bernRuns(Q, 0, 1, 0, runs);
  const deltaP = rho / vlo;
  for (let i = 0; i < runs.length; i += 2) {
    const r0 = t1lo + (t1hi - t1lo) * runs[i]!, r1 = t1lo + (t1hi - t1lo) * runs[i + 1]!;
    const w0 = Math.max(0, r0 - deltaP), w1 = Math.min(1, r1 + deltaP);
    if (twin === 1) stall(search, swap, r0, r1, w0, w1);
    else stall(search, swap, r0, r1, 1 - w1, 1 - w0);
  }
  return true;
}

/** Merge results that are the same point reached by different subdivisions. */
function dedupe(list: Intersection[], tol: number): Intersection[] {
  const out: Intersection[] = [];
  for (const i of list) {
    if (!out.some((o) => Math.hypot(o.x - i.x, o.y - i.y) <= tol * 8
                      && Math.abs(o.t1 - i.t1) <= 1e-6 + tol
                      && Math.abs(o.t2 - i.t2) <= 1e-6 + tol)) out.push(i);
  }
  return out.sort((a, b) => a.t1 - b.t1);
}

/**
 * Where along a straight cubic's OWN parameterisation does a given chord fraction fall?
 *
 * The exact line paths above take a curve's endpoints and report a fraction along the
 * chord. For a cubic built by `lineToCubic` that fraction IS the parameter, because the
 * controls are evenly spaced. It is easy to assume this holds in general, but it does
 * not. `M0,0 C0,0 0,0 100,0` (handles resting on the start point, which is what a pen
 * tool with un-dragged handles, and much imported SVG, produce) is perfectly straight
 * but grossly non-uniform: its midpoint is at x=12.5, not 50. Returning the chord
 * fraction as `t` in that case gives a point that is on the LINE but nowhere near the
 * curve at that parameter. Every consumer splits with `subCubic(c, t)`, so the split
 * lands in the wrong place and the resulting geometry does not close.
 *
 * So convert it. The along-chord displacement is itself a cubic in `t` (the Bernstein
 * coefficients are just the controls projected onto the chord), so this uses the same
 * closed-form root solve as everything else in this file: exact, not a search.
 */
function chordFractionToParam(c: Cubic, u: number): number {
  const dx = c[6] - c[0], dy = c[7] - c[1];
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-24) return u;                       // degenerate chord: nothing to convert
  const g = [
    0,
    ((c[2] - c[0]) * dx + (c[3] - c[1]) * dy) / l2,
    ((c[4] - c[0]) * dx + (c[5] - c[1]) * dy) / l2,
    1,
  ];
  // Uniformly spaced controls are the overwhelmingly common case; skip the solve.
  if (Math.abs(g[1]! - 1 / 3) < 1e-12 && Math.abs(g[2]! - 2 / 3) < 1e-12) return u;
  const A = -g[0]! + 3 * g[1]! - 3 * g[2]! + g[3]!;
  const B = 3 * g[0]! - 6 * g[1]! + 3 * g[2]!;
  const C = -3 * g[0]! + 3 * g[1]!;
  const D = g[0]! - u;
  const roots = cubicRoots01(A, B, C, D);
  if (!roots.length) return u;
  // A non-monotone straight cubic (controls that double back) genuinely passes the same
  // point more than once; the caller asked about one crossing, so take the root whose
  // displacement is closest to what was asked for.
  let best = roots[0]!, bestErr = Infinity;
  for (const t of roots) {
    const mt = 1 - t;
    const val = mt * mt * mt * g[0]! + 3 * mt * mt * t * g[1]! + 3 * mt * t * t * g[2]! + t * t * t * g[3]!;
    const err = Math.abs(val - u);
    if (err < bestErr) { bestErr = err; best = t; }
  }
  return best;
}

/**
 * Every intersection of two cubics.
 *
 * Dispatches on geometry, not on how the caller labelled the curve: a cubic whose
 * controls are collinear IS a line and takes the exact algebraic path. That path
 * returns a fraction along the chord, which is NOT the curve's parameter unless the
 * controls happen to be evenly spaced, so it is converted back before it leaves here.
 * See `chordFractionToParam`. Getting this wrong reports points tens of units off the
 * curve they claim to lie on.
 *
 * Overlapping (coincident) curves are reported as their two overlap endpoints, not as
 * an infinity of points. That is enough for a boolean operation to split at, and it is
 * accurate: there is no single isolated crossing to report. See `sharedRun`, which also
 * says what it leaves out.
 *
 * Curves that do not share a run but stay within `tol` of each other along a stretch (a
 * shape against a slightly rounded or rotated copy, or two curves that agree to high
 * order where they meet) are searched by the side each point is on rather than by
 * clipping, so a crossing at an angle of a millionth of a radian is still reported. A
 * stretch where the curves touch without crossing is reported once, where they come
 * closest. See `scanStalled`.
 *
 * A shared vertex is reported as that vertex, at parameter 0 or 1 on both curves, including
 * when the two curves agree there so closely that the clip search trims the vertex off the
 * pieces it keeps.
 *
 * Two contacts closer together than `tol` come back as one point: they enclose a lens
 * thinner than the tolerance asked for, and one point is the answer at that tolerance. Past
 * that, nothing is moved. Every hit is reported where it is and lies within `tol` of both
 * curves.
 */
export function intersectCubics(c1: Cubic, c2: Cubic, tol = EPS): Intersection[] {
  if (!boxesOverlap(boundsCubic(c1), boundsCubic(c2), tol)) return [];

  const l1 = isLineCubic(c1, tol), l2 = isLineCubic(c2, tol);
  if (l1 && l2) {
    const hit = intersectSegments(c1[0], c1[1], c1[6], c1[7], c2[0], c2[1], c2[6], c2[7]);
    if (!hit) return [];
    return [{
      ...hit,
      t1: chordFractionToParam(c1, hit.t1),
      t2: chordFractionToParam(c2, hit.t2),
    }];
  }
  if (l1) {
    return dedupe(intersectLineCubic(c1[0], c1[1], c1[6], c1[7], c2, tol)
      .map((i) => ({ ...i, t1: chordFractionToParam(c1, i.t1) })), tol);
  }
  if (l2) {
    // Same call with the roles reversed, then swap the parameters back.
    return dedupe(intersectLineCubic(c2[0], c2[1], c2[6], c2[7], c1, tol)
      .map((i) => ({ t1: i.t2, t2: chordFractionToParam(c2, i.t1), x: i.x, y: i.y })), tol);
  }

  const out: Intersection[] = [];
  const work: ClipWork = { nodes: 0, limit: CLIP_BUDGET.maxNodes, over: false };
  clipIntersect(c1, c2, 0, 1, 0, 1, tol, 0, out, work);
  CLIP_COUNTS.pairs++;
  CLIP_COUNTS.nodes += work.nodes;
  CLIP_COUNTS.lastNodes = work.nodes;
  if (!work.over) return dedupe(out, tol);
  CLIP_COUNTS.overruns++;
  return intersectOverrun(c1, c2, tol);
}

/**
 * Calls to `overrunClip` one pair may make before the overrun search stops descending.
 *
 * Exported mutable beside `CLIP_BUDGET`, and measured the same way. Across every pair in this
 * tree that actually escalates, the heaviest spends 41,271 nodes: 1,416 escalated pairs of
 * 620 real SVGs have a median of 0 and a maximum of 12,552, the fuzz reproducer's four
 * operations peak at 2,987, and the adversarial families of thirty copies of one blob, exact,
 * jittered, fanned and shifted at two scales, peak at 41,271. This ceiling is three times that.
 *
 * The case that needs a ceiling at all is a curve against a REPARAMETRISED piece of itself,
 * two fits of one arc cut at different places. `twinNode` cannot see such a pair, because it
 * is not a twin at equal parameters, and `sharedRun` answers it only while its ends project
 * onto each other, so at large coordinates the pair falls through to bisection and the pieces
 * still lie along each other at every level. Two overlapping pieces of one cubic 30,000 units
 * long spend 28,235,256 nodes and 47 seconds with no ceiling (3 ms at 10,000 units, where
 * `sharedRun` still catches it). At this ceiling the same pair takes about 270 ms.
 *
 * What a pair at the ceiling gets: the stretches `overrunClip` had already kept, scanned as
 * any others. It is not abandoned and it is not a different kind of answer, only a search of
 * less of the pair. On the pair above the answer is the same at every ceiling from 32,768 to
 * 524,288 and at none at all: the two ends of the shared run. `CLIP_COUNTS.ceilings` counts
 * the pairs that reach it, and over all of the artwork and families above it is zero.
 */
export const OVERRUN_BUDGET = { maxNodes: 131072 };

/**
 * One pair, answered without asking a clip to separate curves that lie along each other.
 *
 * Reached only from `intersectCubics`, and only for a pair that spent `CLIP_BUDGET.maxNodes`
 * nodes without finishing. Nothing the clip search found for the pair is carried in: the
 * partial hits are thrown away by the caller, and this search starts from the two whole
 * curves, so the answer is one search's or the other's and never a mixture.
 *
 * Four steps, each with its own notes below:
 *
 * 1. `sharedRun`: two curves that ARE the same curve over a run are answered as the two ends
 *    of that run. This is where the reproducer that prompted the budget is settled, in
 *    microseconds rather than a second.
 * 2. the twin test: whether the two are near-copies of each other at equal parameters or at
 *    reversed ones, which is what lets `twinNode` decide a node from the polynomial of their
 *    offset instead of cutting it down.
 * 3. `overrunClip`: the same fat-line clip, but a pair it cannot separate is kept rather than
 *    bisected for ever, and the descent stops at `OVERRUN_BUDGET`.
 * 4. `scanStalled`: the crossings and touches inside those kept stretches, found by reading
 *    which side of one curve the other is on rather than by clipping.
 *
 * What it promises for the pairs it answers, which is not what the clip search promises:
 *
 * - Every hit lies within `tol` of BOTH curves. A point that cannot be shown to lie on both
 *   is not reported.
 * - One contact per zone where the curves stay within `tol` of each other. Two crossings a
 *   hair apart inside such a zone come back as one point: at this tolerance they are one
 *   contact.
 * - A zone longer than a thousandth of the pair's bounding size reports its two ends as
 *   well, placed where the gap reaches the tolerance, so a boolean can cut both curves where
 *   the shared run begins and ends.
 * - Nothing is moved. A crossing is reported where it is, never folded onto a touch or onto
 *   a vertex beside it.
 */
function intersectOverrun(c1: Cubic, c2: Cubic, tol: number): Intersection[] {
  const run = sharedRun(c1, c2, tol);
  if (run) return run;

  let mag = 0;
  for (let i = 0; i < 8; i++) mag = Math.max(mag, Math.abs(c1[i]!), Math.abs(c2[i]!));
  const b1 = boundsCubic(c1), b2 = boundsCubic(c2);
  const size = Math.max(1, Math.max(b1.x1, b2.x1) - Math.min(b1.x0, b2.x0), Math.max(b1.y1, b2.y1) - Math.min(b1.y0, b2.y0));
  // A near-copy of the curve, at the same parameters or the reversed ones, is searched by
  // `twinNode` rather than by clipping alone. The band here only asks whether that is worth
  // trying; the node decides on its own bounds.
  let twin: 0 | 1 | -1 = coincideAtParams(c1, c2, TWIN_BAND * size) ? 1 : 0;
  let c1r: Cubic | null = null, c2r: Cubic | null = null;
  if (!twin) {
    const rev: Cubic = [c2[6], c2[7], c2[4], c2[5], c2[2], c2[3], c2[0], c2[1]];
    if (coincideAtParams(c1, rev, TWIN_BAND * size)) { twin = -1; c2r = rev; c1r = [c1[6], c1[7], c1[4], c1[5], c1[2], c1[3], c1[0], c1[1]]; }
  }
  const search: ClipSearch = {
    c1, c2, out: [], stalled: [], pad: Math.max(1e-12, mag * 64 * Number.EPSILON), size, twin, c1r, c2r,
    nodes: 0, over: false,
  };
  overrunClip(c1, c2, 0, 1, 0, 1, tol, 0, search);
  CLIP_COUNTS.overrunNodes += search.nodes;
  CLIP_COUNTS.lastOverrunNodes = search.nodes;
  if (search.nodes > CLIP_COUNTS.maxOverrunNodes) CLIP_COUNTS.maxOverrunNodes = search.nodes;
  if (search.over) CLIP_COUNTS.ceilings++;
  if (search.stalled.length) scanStalled(c1, c2, search.stalled, tol, search.out);
  return dedupe(search.out, tol);
}

// ── stalled stretches: which side of c2 is c1 on ──────────────────────────────

/** Hits one search reports at most, from the clip and the scan together. */
const MAX_HITS = 128;
/**
 * Limits of the stalled-stretch scan. Exported mutable so tests can show what a lower
 * limit loses, as `HOOK_BUDGET_MS` is in runtime.ts; the defaults are the contract.
 *
 * `maxStalledPairs` is how many stalled pairs one search keeps, at the floor, at the depth
 * cap and at shallow points together. Past it the rest are dropped. It is high because a
 * dropped pair can hold a touch or a crossing, and keeping one costs little: the clip work
 * that found it is spent either way, it is four numbers, and how many gap samples the scan
 * takes is bounded by `GAP_BUDGET` and each stretch's share, not by the number of pairs. At
 * 2048, an arc 10 units long crossing a near-copy at t = 0.77 and touching it at t = 0.79
 * left 6384 to 6589 stalled pairs, the dropped ones held the touch, and the boolean decided
 * the piece past the crossing at a midpoint where the two sides could not be told apart.
 */
export const SCAN_LIMITS = { maxStalledPairs: 65536 };
/** Gap samples along each stalled piece. */
const SAMPLES_PER_PIECE = 8;
/** Gap samples along one stretch, however many pieces it is made of. */
const MAX_STRETCH_SAMPLES = 2048;
/** Gap samples every stretch may take, however many stretches there are. */
const MIN_STRETCH_SAMPLES = 16;
/** Gap evaluations for one search, refinement included. Past this the scan stops asking and
 *  reports what it has found. */
const GAP_BUDGET = 16384;
/** Steps tried when looking past the end of a stretch for a side that can be read, each
 *  four times the last: enough to reach across the whole curve from the smallest step. */
const LOOK_OUT_STEPS = 30;
/** How close to an end of c2 a stretch has to come for that end to be checked. The check
 *  itself reports the end only when it lies within `tol` of c1. */
const END_NEAR = 1e-3;
/** Parameter slack for "these two ranges touch" and "this range reaches the end". */
const TOUCH = 1e-12;

/** Work state for one cubic × cubic search. */
interface ClipSearch {
  /** The caller's two curves, whole. */
  c1: Cubic;
  c2: Cubic;
  out: Intersection[];
  /** How far outside a fat line's band a control distance may fall and still count as
   *  inside it: the rounding noise of measuring a distance at these coordinates. */
  pad: number;
  /** Pairs stopped at the resolution floor or the depth cap, closed on at a shallow angle,
   *  or closed on at a point just off the other piece, four numbers each: the range on the
   *  caller's first curve, then the range on its second. */
  stalled: number[];
  /** The larger extent of the pair's bounding box, at least 1: what a speed is measured
   *  against when asking whether a point of a curve has a direction. */
  size: number;
  /** Whether the two curves are near-copies of each other at equal parameters (1), at
   *  reversed parameters (-1), or neither (0). See `twinNode`. */
  twin: 0 | 1 | -1;
  /** The two curves reversed, kept only for a reversed twin pair. */
  c1r: Cubic | null;
  c2r: Cubic | null;
  /** Calls to `overrunClip` so far, against `OVERRUN_BUDGET.maxNodes`. */
  nodes: number;
  /** The ceiling was reached, so the search stopped descending. Diagnostic: the answer is
   *  whatever the scan makes of the stretches kept up to that point. */
  over: boolean;
}

/** The state `scanStalled` shares with its helpers. */
interface Scan {
  c1: Cubic;
  c2: Cubic;
  tol: number;
  out: Intersection[];
  /** Below this a gap says nothing about the side. */
  noise: number;
  /** Gap evaluations left. */
  budget: number;
  /** The larger extent of the pair's bounding box, at least 1. */
  size: number;
  /** Samples each stretch may take at first. */
  share: number;
}

/** The signed gap from `c1(t)` to c2, and the parameter `u` of the nearest point on c2. */
interface Gap {
  t: number;
  u: number;
  g: number;
  /** The nearest point is an end of c2, so `g` was measured against the line continuing
   *  c2 past that end. */
  beyond: boolean;
  /** The distance from `c1(t)` to its nearest point on c2. */
  d: number;
  /** The speed of c2 at the nearest point, as a share of the pair's size. */
  sp: number;
  /** The unit left normal of c2 at the nearest point, which `g` was measured along. */
  nx: number;
  ny: number;
  /** +1 or -1: the sign that makes `g` agree with the normal the zone is oriented by. Set
   *  by `orientZone` and `orientTo`; a raw sample has 1. */
  o: number;
  px: number;
  py: number;
  qx: number;
  qy: number;
}

/**
 * Where the two curves cross inside the stretches the clip search stopped on.
 *
 * A stalled pair is two pieces lying along each other to within `tol`, so a clip cannot say
 * where a crossing between them is. The question can still be answered another way: along
 * the stretch, which side of c2 is c1 on? That is the sign of the gap, the distance from a
 * point of c1 to its nearest point on c2, signed by c2's direction of travel. Where the sign
 * flips, c1 crosses c2, however small the angle between them. The direction of travel
 * reverses at a cusp of c2, and the sign with it, so the samples of one zone are oriented
 * against each other first (`orientZone`), and a sign is read only at a proper foot, where
 * the gap accounts for most of the distance (`readable`).
 *
 * 1. Stalled pairs whose parameter rectangles touch, or nearly do, are merged into
 *    stretches, so a crossing on the boundary between two stopped pieces is looked for
 *    once, across it (`stretches`).
 * 2. Each stretch is sampled, a few points per stopped piece, within a share of the budget
 *    that every stretch gets whatever the others cost. A sample whose gap is within
 *    the rounding noise of the coordinates says nothing about the side and is skipped.
 * 3. Every stretch is bracketed by a sample on each side of it where the gap is clearly
 *    above `tol` (`sentinel`), stepping outward four times further each time. That is the
 *    side the curves are on once they have parted. Inside a stretch the gap can be readable
 *    and still say nothing: where two curves meet at zero angle, the gap grows as the cube
 *    of the distance from the crossing, the whole zone about 0.02 wide around it on a curve
 *    100 units long is within `tol`, and the clip closes on single points anywhere in it,
 *    each a stretch of no width with one sample on one side. Stretches that start before
 *    the previous one's right bracket are one zone and are decided together, which also
 *    stops a touch that arrives in many fragments from paying for brackets per fragment.
 *    A bracket that reaches an end of c1 with the curves still in contact makes the zone
 *    run to that end, so the end is checked.
 * 4. A zone with a readable sample in its middle is cut there (`splitZone`), so two
 *    contacts a long way apart are not read as one. A zone whose two ends are both clear of
 *    the contact is then answered by parity (`decideByParity`): ends on opposite sides hold
 *    an odd number of crossings, and the closest approach inside the zone answers them all
 *    at this tolerance; ends on the same side hold a touch when the closest approach is
 *    within `tol`. A zone longer than `RUN_MIN_REL` of the pair's size reports its two ends
 *    as well (`reportRunEnds`).
 * 5. Where the ends cannot be read, each change of sign between consecutive readable samples
 *    is narrowed instead, to the closest approach inside its bracket, and reported there
 *    when that point is within `tol` of both curves and the clip search has not already
 *    reported a crossing inside the same bracket.
 *
 * What sampling can miss is two changes of sign between neighbouring samples. Both pieces
 * of a pair stopped at the floor are straight to `tol` over their whole length, which bounds
 * how much the gap can bend: between two samples it can dip and come back by a few `tol` at
 * most, and by well under `tol` with the usual eight samples to a piece. Two crossings that
 * close are a touch at the requested tolerance. A pair stopped at the depth cap is scanned
 * the same way. It is short but not always that straight, so for it the bound is weaker.
 *
 * The nearest point is taken on the whole of c2. The gap is measured along c2's normal
 * there, so an error in where along c2 that point is changes the gap only to second order.
 * A point past an end of c2 is measured against the line continuing c2 from that end, so a
 * crossing close to the end still has a readable side beyond it, and a sign change that
 * refines to a point past the end is not reported: it is the next curve's crossing.
 *
 * Where a stretch reaches an end of either curve and that end lies on the other curve, the
 * end is reported, as the clip search reports an end it converges on. A stretch that comes
 * within `END_NEAR` of an end of c2 checks that end too. Last, after every
 * stretch has been searched for crossings, each run of samples on one side is searched for
 * a touch (`touchPoint`), and touches that are one stretch of contact are reported once.
 */
function scanStalled(c1: Cubic, c2: Cubic, stalled: number[], tol: number, out: Intersection[]): void {
  let mag = 0;
  for (let i = 0; i < 8; i++) mag = Math.max(mag, Math.abs(c1[i]!), Math.abs(c2[i]!));
  const groups = stretches(stalled);
  // A gap is the difference of two points evaluated from coordinates of this size. The
  // allowance is the one `sharedRun` uses for the same rounding.
  const b1 = boundsCubic(c1), b2 = boundsCubic(c2);
  const scan: Scan = {
    c1, c2, tol, out,
    size: Math.max(1, Math.max(b1.x1, b2.x1) - Math.min(b1.x0, b2.x0), Math.max(b1.y1, b2.y1) - Math.min(b1.y0, b2.y0)),
    noise: mag * 64 * Number.EPSILON,
    budget: GAP_BUDGET,
    // Half the budget samples the stretches, shared between them, so that a touch spread
    // over many stretches cannot leave a crossing elsewhere unsampled.
    share: Math.max(MIN_STRETCH_SAMPLES, Math.floor(GAP_BUDGET / 2 / groups.length)),
  };
  const sides: Gap[][] = [];
  const clear = Math.max(tol, scan.noise);
  const sampled = groups.map((members) => sampleStretch(scan, stalled, members));
  sampled.sort((p, q) => p.a0 - q.a0);
  const zones: Sampled[] = [];
  for (const g of sampled) {
    const cur = zones[zones.length - 1];
    if (cur && g.a0 <= cur.reach) {
      // Starts before the zone's right bracket: the same zone, so the bracket moves out.
      cur.samples.push(...g.samples);
      cur.a1 = Math.max(cur.a1, g.a1);
      cur.b0 = Math.min(cur.b0, g.b0);
      cur.b1 = Math.max(cur.b1, g.b1);
      if (cur.a1 > cur.reach) {
        const r = sentinel(scan, cur.a1, 1);
        if (r) { cur.samples.push(r); cur.reach = r.t; } else cur.reach = 1;
      }
      continue;
    }
    const l = g.a0 > TOUCH ? sentinel(scan, g.a0, -1) : null;
    const r = g.a1 < 1 - TOUCH ? sentinel(scan, g.a1, 1) : null;
    if (l) {
      g.samples.push(l);
      if (l.t === 0 && Math.abs(l.g) <= clear) g.a0 = 0;
    }
    if (r) {
      g.samples.push(r);
      g.reach = r.t;
      if (r.t === 1 && Math.abs(r.g) <= clear) g.a1 = 1;
    } else {
      // At the end of c1 already, or out of budget: nothing after this can be told apart.
      g.reach = 1;
    }
    if (g.b0 <= END_NEAR) g.b0 = 0;
    if (g.b1 >= 1 - END_NEAR) g.b1 = 1;
    zones.push(g);
  }
  // Touches last, so that however many there are, they cannot fill the hit list before a
  // crossing is in it.
  const touches: Gap[] = [];
  for (const g of zones) {
    g.samples.sort((p, q) => p.t - q.t);
    orientZone(scan, g.samples);
    for (const part of splitZone(scan, g)) decideZone(scan, part, sides, touches);
  }
  for (const run of sides) {
    const at = touchPoint(scan, run);
    if (at) touches.push(at);
  }
  touches.sort((p, q) => p.t - q.t);
  let kept: Gap | null = null;
  for (const at of touches) {
    if (kept && oneTouch(scan, kept, at)) {
      if (Math.abs(at.g) < Math.abs(kept.g)) kept = at;
      continue;
    }
    if (kept) report(scan, kept);
    kept = at;
  }
  if (kept) report(scan, kept);
}

/** Report a touch, unless it is a point already reported. */
function report(scan: Scan, at: Gap): void {
  if (scan.out.length > MAX_HITS) return;
  for (const h of scan.out) {
    // A touch at a point already reported, such as a shared end, is that point.
    if (Math.abs(h.t1 - at.t) <= TOUCH_MERGE && Math.abs(h.t2 - at.u) <= TOUCH_MERGE) return;
  }
  scan.out.push({ t1: at.t, t2: at.u, x: at.px, y: at.py });
}

/** Parameter distance within which a touch and another hit are one point. */
const TOUCH_MERGE = 1e-6;
/** Samples between two touches when asking whether they are one. */
const TOUCH_JOIN_SAMPLES = 7;

/**
 * Are two touch points the same touch? They are when c1 stays within `tol` of c2 all the way
 * from one to the other, on the same side. One long touch can arrive as several runs.
 */
function oneTouch(scan: Scan, a: Gap, b: Gap): boolean {
  for (let k = 1; k <= TOUCH_JOIN_SAMPLES; k++) {
    const s = gapAt(scan, a.t + ((b.t - a.t) * k) / (TOUCH_JOIN_SAMPLES + 1));
    // Out of budget: merging keeps the answer short, which is the safer way to be wrong.
    if (!s) return true;
    if (Math.abs(s.g) > scan.tol) return false;
    orientTo(s, a);
    if (readable(scan, s) && readable(scan, a) && (side(s) < 0) !== (side(a) < 0)) return false;
  }
  return true;
}

/** How far apart, in multiples of the smaller side of its parameter rectangle, a stalled
 *  pair may be from another and still join its stretch. */
const STRETCH_REACH = 64;

/**
 * Stalled pairs grouped into stretches, through a sweep in t1 and a union-find.
 *
 * Two pairs join when their parameter rectangles come within `STRETCH_REACH` times the
 * first one's smaller side of each other on both curves. Touching is not enough: where two
 * curves stay within `tol` of each other, clips still discard the pieces that miss each
 * other's lines by less than `tol`, so the pairs of one such stretch lie with gaps between
 * them. Two arcs 1000 units long that touch at one point left 1559 pairs in 620 groups of
 * pairs that touched, and sampling all of them spent the budget before the stretch around
 * their crossing was reached.
 */
function stretches(r: number[]): number[][] {
  const n = r.length / 4;
  const parent = Array.from({ length: n }, (_, i) => i);
  const root = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; }
    return i;
  };
  const order = parent.slice().sort((i, j) => r[4 * i]! - r[4 * j]!);
  for (let k = 0; k < n; k++) {
    const i = order[k]!;
    // The smaller side: a pair closed on at a point has no width on one curve and may span
    // a long piece of the other, and that piece says nothing about where its neighbours are.
    const side = Math.min(r[4 * i + 1]! - r[4 * i]!, r[4 * i + 3]! - r[4 * i + 2]!);
    const reach = TOUCH + STRETCH_REACH * side;
    for (let m = k + 1; m < n; m++) {
      const j = order[m]!;
      // Sorted by where each range starts, so nothing after this one reaches `i`.
      if (r[4 * j]! > r[4 * i + 1]! + reach) break;
      if (r[4 * j + 2]! <= r[4 * i + 3]! + reach && r[4 * i + 2]! <= r[4 * j + 3]! + reach) {
        parent[root(i)] = root(j);
      }
    }
  }
  const groups = new Map<number, number[]>();
  for (const i of order) {
    const g = root(i);
    const list = groups.get(g);
    if (list) list.push(i); else groups.set(g, [i]);
  }
  return [...groups.values()];
}

/** The signed gap oriented by the zone's reference normal. Where c2 has a cusp or a very
 *  tight turn, the direction of travel reverses and with it the left normal, so the raw sign
 *  of `g` flips across the cusp although the sample stays on the same geometric side. The
 *  zone's samples are oriented in order along c1, each normal taken to agree with the last
 *  (`orientZone`), and a sample taken later inside a bracket is oriented to the bracket's
 *  end (`orientTo`). */
const side = (s: Gap): number => s.o * s.g;

/** Orient the samples of a zone, in order along c1: the first readable sample sets the
 *  reference, and each later one flips its sign when its normal opposes the last oriented
 *  normal. Two successive samples whose normals differ by more than a right angle are
 *  either across a cusp, where the flip is the correction wanted, or far apart on a curve
 *  that turns a lot, where the zone has no single side to speak of anyway. */
function orientZone(scan: Scan, samples: Gap[]): void {
  let px = 0, py = 0, o = 1, have = false;
  for (const s of samples) {
    // A sample whose side cannot be read has no normal worth carrying: at a cusp the
    // nearest point jumps between the branches from one sample to the next, and carrying
    // those normals flipped the orientation an odd number of times across the apex, so the
    // two clear ends of the zone read as the same side and a crossing became a touch.
    if (!readable(scan, s)) { s.o = o; continue; }
    if (!have) { s.o = 1; px = s.nx; py = s.ny; o = 1; have = true; continue; }
    // Set against the oriented reference, as `orientTo` does, not toggled from the last
    // sample's sign: toggled, the one flip a cusp calls for was undone at the very next
    // sample, whose raw normal opposes the reference just as the sample before it did, and
    // a crossing at the apex read as a touch.
    const dot = s.nx * px + s.ny * py;
    o = dot < 0 ? -1 : 1;
    s.o = o;
    px = o * s.nx; py = o * s.ny;
  }
}

/** Orient one new sample to agree with an already oriented one. */
function orientTo(s: Gap, ref: Gap): Gap {
  const dot = s.nx * (ref.o * ref.nx) + s.ny * (ref.o * ref.ny);
  s.o = dot < 0 ? -1 : 1;
  return s;
}

/** Can the side of c2 that a sample is on be read? */
const readable = (scan: Scan, s: Gap): boolean => Math.abs(s.g) > scan.noise && Math.abs(s.g) >= FOOT_SHARE * s.d && s.sp >= FOOT_SPEED;
/** The speed of c2 at a foot, as a share of the pair's size, below which the foot lies in the
 *  stationary neighbourhood of a cusp and its normal says nothing: there the nearest point
 *  jumps between the two branches from one sample to the next, the normal flips with it, and
 *  a copy of a cusp curve a hair away read as crossing it at every sample near the apex. A
 *  cubic's speed away from a cusp is of the order of its size. */
const FOOT_SPEED = 1e-3;
/** The share of a sample's distance that its signed gap must account for before the side it
 *  reads is trusted. At a proper foot the two are equal: the offset is along the normal. Where
 *  they differ the foot is not a foot, because the nearest point sits at a cusp or a tight
 *  turn whose tangent has no reliable direction, or the projection did not converge, and the
 *  sign says nothing about which side of the curve the sample is on. */
const FOOT_SHARE = 0.5;

/** One stretch, or a zone of several, with every sample taken in it and around it. */
interface Sampled {
  samples: Gap[];
  /** Parameter range on c1. */
  a0: number;
  a1: number;
  /** Parameter range on c2. */
  b0: number;
  b1: number;
  /** Where on c1 the zone's right bracket is. A stretch that starts before it joins. */
  reach: number;
}

/**
 * Sample one stretch: the ends of its stalled pieces, thinned out evenly when there are more
 * than the stretch's share of samples, then a few samples between each two. Every sample is
 * kept, including those whose side cannot be read.
 */
function sampleStretch(scan: Scan, r: number[], members: number[]): Sampled {
  let a0 = 1, a1 = 0, b0 = 1, b1 = 0;
  const bounds: number[] = [];
  for (const i of members) {
    a0 = Math.min(a0, r[4 * i]!); a1 = Math.max(a1, r[4 * i + 1]!);
    b0 = Math.min(b0, r[4 * i + 2]!); b1 = Math.max(b1, r[4 * i + 3]!);
    bounds.push(r[4 * i]!, r[4 * i + 1]!);
  }
  bounds.sort((p, q) => p - q);
  const cap = Math.min(MAX_STRETCH_SAMPLES, scan.share);
  const step = Math.ceil(bounds.length / cap);
  const knots: number[] = [];
  for (let k = 0; k < bounds.length; k += step) knots.push(bounds[k]!);
  if (knots[knots.length - 1] !== bounds[bounds.length - 1]) knots.push(bounds[bounds.length - 1]!);
  const per = Math.max(1, Math.min(SAMPLES_PER_PIECE, Math.floor(cap / knots.length)));
  const ts: number[] = [knots[0]!];
  let prev = knots[0]!;
  for (const k of knots) {
    if (!(k > prev)) continue;
    for (let s = 1; s <= per; s++) ts.push(s === per ? k : prev + ((k - prev) * s) / per);
    prev = k;
  }
  const samples: Gap[] = [];
  for (const t of ts) {
    const s = gapAt(scan, t);
    if (s) samples.push(s);
  }
  return { samples, a0, a1, b0, b1, reach: a1 };
}

/**
 * The first sample past one end of a stretch, going in direction `dir` along c1, where the
 * gap is clearly above `tol`: the side the curves are on once they have parted. The steps
 * start from the smallest one that moves the parameter, because a pair cut down to a point
 * on c1 has a range of no width, and grow four times each. Stops at an end of c1, and
 * returns the last sample taken if the budget or the steps run out first.
 */
function sentinel(scan: Scan, from: number, dir: -1 | 1): Gap | null {
  const clear = Math.max(scan.tol, scan.noise);
  let last: Gap | null = null;
  for (let k = 0; k <= LOOK_OUT_STEPS; k++) {
    const t = Math.min(1, Math.max(0, from + dir * 4 * Number.EPSILON * 4 ** k));
    const s = gapAt(scan, t);
    if (!s) return last;
    last = s;
    if (Math.abs(s.g) > clear || t === 0 || t === 1) return s;
  }
  return last;
}

/**
 * Decide one zone from its samples, in order along c1: each change of side is refined to a
 * crossing, the samples are split into runs on one side of c2 for `touchPoint`, and the ends
 * the zone reaches are checked.
 */
function decideZone(scan: Scan, g: Sampled, sides: Gap[][], touches: Gap[]): void {
  if (decideByParity(scan, g, touches)) {
    if (g.a0 <= TOUCH) endContact(scan, 1, 0);
    if (g.a1 >= 1 - TOUCH) endContact(scan, 1, 1);
    if (g.b0 <= TOUCH) endContact(scan, 2, 0);
    if (g.b1 >= 1 - TOUCH) endContact(scan, 2, 1);
    return;
  }
  // Runs on one side end at the last readable sample before a change of side and start at
  // the first readable one after it, so the noise around a crossing belongs to neither.
  let last: Gap | null = null;
  let run: Gap[] = [];
  let pending: Gap[] = [];
  for (const s of g.samples) {
    if (!readable(scan, s)) { pending.push(s); continue; }
    if (last && (side(last) < 0) !== (side(s) < 0)) {
      refineCrossing(scan, last, s);
      sides.push(run);
      run = [];
    } else {
      run.push(...pending);
    }
    pending = [];
    run.push(s);
    last = s;
  }
  run.push(...pending);
  sides.push(run);

  if (g.a0 <= TOUCH) endContact(scan, 1, 0);
  if (g.a1 >= 1 - TOUCH) endContact(scan, 1, 1);
  if (g.b0 <= TOUCH) endContact(scan, 2, 0);
  if (g.b1 >= 1 - TOUCH) endContact(scan, 2, 1);
}

/**
 * Cut a zone wherever a sample inside it reads the curves as clearly apart.
 *
 * Stalled pairs are grouped into stretches by how close their parameter rectangles are,
 * and a zone can therefore span two crossings with a stretch of clear separation between
 * them: three crossings a hundredth of the curve apart, with the gap between them reaching a
 * few `tol`, arrived as one zone and were read as one contact. A zone is a run of samples in
 * contact; a sample that is clearly apart inside it ends one zone and starts the next, and
 * serves as the sentinel of both. The ends of c1 and c2 are checked by the part that
 * reaches them.
 */
function splitZone(scan: Scan, g: Sampled): Sampled[] {
  const clear = Math.max(scan.tol, scan.noise);
  const samples = g.samples;
  if (samples.length < 3) return [g];
  const parts: Sampled[] = [];
  let start = 0;
  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i]!;
    if (!(Math.abs(s.g) > clear && readable(scan, s))) continue;
    // Only cut where the samples either side are in contact again: a clear sample between
    // two clear ones is the zone's own margin, not a gap inside it.
    let back = false;
    for (let k = i - 1; k > start; k--) if (Math.abs(samples[k]!.g) <= clear) { back = true; break; }
    if (!back) continue;
    let ahead = false;
    for (let k = i + 1; k < samples.length - 1; k++) if (Math.abs(samples[k]!.g) <= clear) { ahead = true; break; }
    if (!ahead) continue;
    parts.push(subZone(g, samples.slice(start, i + 1), parts.length === 0, false));
    start = i;
  }
  if (!parts.length) return [g];
  parts.push(subZone(g, samples.slice(start), false, true));
  return parts;
}

/** A part of a zone: its own sample run, with the whole zone's ends kept only on the part
 *  that reaches them. */
function subZone(g: Sampled, samples: Gap[], first: boolean, last: boolean): Sampled {
  let b0 = 1, b1 = 0;
  for (const s of samples) { b0 = Math.min(b0, s.u); b1 = Math.max(b1, s.u); }
  return {
    samples,
    a0: first ? g.a0 : samples[0]!.t,
    a1: last ? g.a1 : samples[samples.length - 1]!.t,
    b0: first ? Math.min(g.b0, b0) : b0,
    b1: last ? Math.max(g.b1, b1) : b1,
    reach: last ? g.reach : samples[samples.length - 1]!.t,
  };
}

/**
 * Decide a zone from its two ends, where the curves are clearly apart, and report at most
 * one contact for it: a crossing where the side differs between the ends, a touch where it
 * does not and the curves come within `tol` inside.
 *
 * Inside a zone the two curves are within `tol` of each other, so any two crossings in it
 * enclose a lens thinner than `tol`, and any two touches are one touch, at the tolerance
 * asked for. Reading the side at each sample instead, and reporting a crossing at every
 * change, read the rounding of the gap as crossings: five where a cusp curve crossed a copy
 * of itself once, and two where it crossed once with the copy sampled first, an even count
 * for an odd crossing. The ends of the zone are outside it, where the gap is well above the
 * noise and the side is certain, and their two sides settle the count. The crossing is
 * reported at the closest approach of the two curves inside the zone, narrowed once more
 * around the closest sample, which is where a crossing at a cusp is (the point where a
 * projection-based sign flips can lie a little way from it). Returns false when a zone end
 * is not clearly apart (it reaches an end of c1 in contact, or the budget ran out), and the
 * zone is then decided sample by sample as before.
 */
function decideByParity(scan: Scan, g: Sampled, touches: Gap[]): boolean {
  const { tol, noise } = scan;
  const clear = Math.max(tol, noise);
  const samples = g.samples;
  if (samples.length < 2) return false;
  const first = samples[0]!, last = samples[samples.length - 1]!;
  if (!(Math.abs(first.g) > clear && Math.abs(last.g) > clear)) return false;
  if (!(readable(scan, first) && readable(scan, last))) return false;
  reportRunEnds(scan, samples);
  let best = first;
  for (const s of samples) if (s.d < best.d) best = s;
  let k = samples.indexOf(best);
  const odd = (side(first) < 0) !== (side(last) < 0);
  // A crossing inside a run of samples within `tol` (two curves agreeing to third order at
  // a cusp's apex are within it over a hundredth of the curve): every sample of the run is
  // the closest approach at this tolerance, and the one nearest the run's middle is the
  // stable choice, where the first to reach `tol` moved with every change in how the
  // stretch was sampled. A touch keeps its least gap: that is the contact.
  if (odd && best.d <= tol) {
    let lo = k, hi = k;
    while (lo > 0 && samples[lo - 1]!.d <= tol) lo--;
    while (hi < samples.length - 1 && samples[hi + 1]!.d <= tol) hi++;
    const mid = (samples[lo]!.t + samples[hi]!.t) / 2;
    for (let i = lo; i <= hi; i++) if (Math.abs(samples[i]!.t - mid) < Math.abs(samples[k]!.t - mid)) k = i;
    best = samples[k]!;
  }
  const lo = samples[Math.max(0, k - 1)]!, hi = samples[Math.min(samples.length - 1, k + 1)]!;
  if (odd) {
    if (scan.out.length > MAX_HITS) return true;
    // Where the side changes between two readable samples is where a transversal crossing
    // is, and narrowing that bracket by false position places it as finely as the gap can
    // be read: the crossing of two curves a hair apart is reported at 0.29998, not at the
    // closest sample 0.02 away. Only when the point that comes out is not a meeting point
    // (a cusp, where the sign flips beside the crossing) is the closest approach used.
    let prev: Gap | null = null;
    let at: Gap | null = null;
    let after: Gap | null = null;
    for (const s of samples) {
      if (!readable(scan, s)) continue;
      if (prev && (side(prev) < 0) !== (side(s) < 0)) { at = narrow(scan, prev, s); after = s; break; }
      prev = s;
    }
    if (at && at.d <= tol) best = at;
    const u0 = Math.min(lo.u, hi.u), u1 = Math.max(lo.u, hi.u);
    for (const h of scan.out) {
      if (h.t1 >= lo.t && h.t1 <= hi.t && h.t2 >= u0 && h.t2 <= u1) return true;   // already found
    }
    if (best.d > tol) best = closest(scan, best, lo.t, hi.t) ?? best;
    // The distance search around the narrowed point spans the whole bracket between the two
    // readable samples of opposite sign, not the half the narrowing stopped in: the narrowing
    // stops as soon as the gap is inside the rounding noise, which at coordinates near 1e7 is
    // two hundred times the tolerance, and the crossing can lie in the other half. Two arcs
    // of radius 2e6 a few hundred units apart lost their crossing in one order that way.
    if (best.d > tol && at && prev && after) best = closest(scan, at, Math.min(prev.t, after.t), Math.max(prev.t, after.t)) ?? best;
    if (best.d > tol) return true;
    scan.out.push({ t1: best.t, t2: best.u, x: best.px, y: best.py });
    return true;
  }
  if (best.d > tol) {
    best = closest(scan, best, lo.t, hi.t) ?? best;
    if (best.d > tol) return true;
  }
  touches.push(best);
  return true;
}

/** A stretch of contact at least this fraction of the pair's size long, measured between its
 *  two ends, is reported as a run: its two ends as well as whatever lies inside. */
const RUN_MIN_REL = 1e-3;

/**
 * Report the two ends of a long stretch of contact.
 *
 * Inside a zone the curves are within `tol` of each other, and a zone can be long: two
 * cusp curves a hair apart agree to within `tol` over a hundredth of their length, which
 * on a curve of size 100 is a stretch of three units. To a boolean working at a weld radius
 * of a millionth of that size, such a stretch is a shared run, not a point, and it needs
 * both curves cut where the run begins and ends so that the pieces inside are twins
 * decided alike and the pieces outside meet at the same two points. Reporting one contact
 * somewhere inside instead left each curve cut where its own search happened to close,
 * and the walk that joins the kept pieces found no partner within reach at the far end.
 * The ends are the innermost samples that are still in contact, narrowed no further: they
 * are within `tol` of the other curve by construction.
 */
function reportRunEnds(scan: Scan, samples: Gap[]): void {
  const { tol, out } = scan;
  let lo = -1, hi = -1;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i]!.d <= tol) { if (lo < 0) lo = i; hi = i; }
  }
  if (lo < 0 || hi <= lo) return;
  // The ends are placed where the gap reaches `tol`, between the innermost sample in
  // contact and its neighbour outside, not at the samples themselves: a stretch the twin
  // certificate hands over whole is sampled a few times only, and an end read off a sample
  // was up to an eighth of the run away from where the contact ends.
  const a = lo > 0 ? runEnd(scan, samples[lo - 1]!, samples[lo]!) : samples[lo]!;
  const b = hi < samples.length - 1 ? runEnd(scan, samples[hi + 1]!, samples[hi]!) : samples[hi]!;
  if (Math.hypot(a.px - b.px, a.py - b.py) < RUN_MIN_REL * scan.size) return;
  if (out.length > MAX_HITS - 2) return;
  for (const s of [a, b]) {
    if (!out.some((h) => Math.abs(h.t1 - s.t) <= TOUCH_MERGE && Math.abs(h.t2 - s.u) <= TOUCH_MERGE)) {
      out.push({ t1: s.t, t2: s.u, x: s.px, y: s.py });
    }
  }
}

/** Bisection steps `runEnd` takes on the parameter. */
const RUN_END_STEPS = 40;
/** The share of `tol` a run's end is placed at, so that the point reported is within `tol`
 *  of both curves by a margin and not by the last rounding of the bisection. */
const RUN_END_SHARE = 0.9;

/** Where a stretch of contact ends, between a sample outside it (`outside`, gap above
 *  `tol`) and the innermost sample inside it (`inside`, gap within `tol`): the point nearest
 *  the outer sample whose gap is still within nine tenths of `tol`, by bisection on the
 *  parameter. The sample inside is returned when the budget runs out. */
function runEnd(scan: Scan, outside: Gap, inside: Gap): Gap {
  const limit = scan.tol * RUN_END_SHARE;
  let a = outside.t, b = inside.t, best = inside;
  for (let i = 0; i < RUN_END_STEPS && Math.abs(b - a) > 4 * Number.EPSILON; i++) {
    const s = gapAt(scan, (a + b) / 2);
    if (!s) break;
    if (s.d <= limit) { best = s; b = s.t; } else a = s.t;
  }
  return best;
}

/** The signed gap from `c1(t)` to c2, positive on the left of c2's direction of travel.
 *  Null once the budget is spent, or where c2 has no direction at all. */
function gapAt(scan: Scan, t: number): Gap | null {
  if (scan.budget-- <= 0) return null;
  const { c1, c2 } = scan;
  const p = evalCubic(c1, t);
  const near = nearest(c2, p.x, p.y);
  const u = near.t, q = near.point;
  const beyond = u <= 0 || u >= 1;
  let d = beyond ? endDirection(c2, u <= 0 ? 0 : 1) : tangentAt(c2, u);
  // A cusp, or an end whose handles all sit on it: fall back to the chord.
  if (d.x === 0 && d.y === 0) d = { x: c2[6] - c2[0], y: c2[7] - c2[1] };
  const len = Math.hypot(d.x, d.y);
  if (!(len > 0)) return null;
  const g = (d.x * (p.y - q.y) - d.y * (p.x - q.x)) / len;
  return { t, u, g, beyond, d: near.distance, sp: len / scan.size, nx: -d.y / len, ny: d.x / len, o: 1, px: p.x, py: p.y, qx: q.x, qy: q.y };
}

/** Direction of travel at an end of a curve, toward the first control point that differs
 *  from that end. Zero only when all four control points coincide. */
function endDirection(c: Cubic, end: 0 | 1): Pt {
  if (end === 0) {
    for (let i = 2; i < 8; i += 2) {
      const dx = c[i]! - c[0], dy = c[i + 1]! - c[1];
      if (dx !== 0 || dy !== 0) return { x: dx, y: dy };
    }
  } else {
    for (let i = 4; i >= 0; i -= 2) {
      const dx = c[6] - c[i]!, dy = c[7] - c[i + 1]!;
      if (dx !== 0 || dy !== 0) return { x: dx, y: dy };
    }
  }
  return { x: 0, y: 0 };
}

/**
 * Narrow a change of sign between two readable samples to the crossing, by false position
 * with the Illinois correction (halving the value kept at an end that stays put), so a
 * lopsided gap still closes in from both sides.
 */
function refineCrossing(scan: Scan, lo: Gap, hi: Gap): void {
  const { out, noise, tol } = scan;
  if (out.length > MAX_HITS) return;
  const u0 = Math.min(lo.u, hi.u), u1 = Math.max(lo.u, hi.u);
  for (const h of out) {
    if (h.t1 >= lo.t && h.t1 <= hi.t && h.t2 >= u0 && h.t2 <= u1) return;   // already found
  }
  let a = lo.t, fa = side(lo), b = hi.t, fb = side(hi), stuck = 0;
  let at: Gap | null = null;
  // The closest approach seen inside the bracket, which is where the crossing is reported.
  let best: Gap = lo.d <= hi.d ? lo : hi;
  for (let i = 0; i < 100; i++) {
    let t = (a * fb - b * fa) / (fb - fa);
    if (!(t > a && t < b)) t = (a + b) / 2;
    const s = gapAt(scan, t);
    if (!s) break;
    orientTo(s, lo);
    at = s;
    if (s.d < best.d) best = s;
    if (Math.abs(s.g) <= noise || !readable(scan, s)) break;
    if ((side(s) < 0) === (fa < 0)) {
      a = t; fa = side(s);
      if (stuck === -1) fb /= 2;
      stuck = -1;
    } else {
      b = t; fb = side(s);
      if (stuck === 1) fa /= 2;
      stuck = 1;
    }
    if (b - a <= 4 * Number.EPSILON) break;
  }
  if (!at) return;
  // The side changes where the signed gap changes sign, and that is only where the curves
  // meet when the nearest point was a proper foot all the way in. At a cusp or a tight turn
  // of c2 the nearest point jumps from one branch to the other, the sign flips with it, and
  // the change of sign sits a little way from the meeting point. So the point reported is
  // the closest approach found in the bracket, narrowed once more around it (`closest`),
  // not the last point the sign test visited.
  if (best.d > tol) best = closest(scan, best, a, b) ?? best;
  // The point has to be on both curves. Past an end of c2 the sign was read against the line
  // continuing it, and a crossing found there is not on c2 unless it is within `tol` of that
  // end. And where c1 passes a point of c2's that is equally near two parts of it, the
  // nearest point jumps, the sign can flip with it, and there is no crossing at all.
  if (best.d > tol) return;
  out.push({ t1: best.t, t2: best.u, x: best.px, y: best.py });
}

/**
 * Narrow a change of side between two readable samples to the crossing by false position
 * with the Illinois correction, returning the last point visited (the closest approach seen
 * on the way is not needed here: the caller checks the point against `tol`).
 */
function narrow(scan: Scan, lo: Gap, hi: Gap): Gap | null {
  const { noise } = scan;
  let a = lo.t, fa = side(lo), b = hi.t, fb = side(hi), stuck = 0;
  let at: Gap | null = null, best: Gap = lo.d <= hi.d ? lo : hi;
  for (let i = 0; i < 100; i++) {
    let t = (a * fb - b * fa) / (fb - fa);
    if (!(t > a && t < b)) t = (a + b) / 2;
    const s = gapAt(scan, t);
    if (!s) break;
    orientTo(s, lo);
    at = s;
    if (s.d < best.d) best = s;
    if (Math.abs(s.g) <= noise || !readable(scan, s)) break;
    if ((side(s) < 0) === (fa < 0)) { a = t; fa = side(s); if (stuck === -1) fb /= 2; stuck = -1; }
    else { b = t; fb = side(s); if (stuck === 1) fa /= 2; stuck = 1; }
    if (b - a <= 4 * Number.EPSILON) break;
  }
  if (!at) return null;
  return best.d <= at.d ? best : at;
}

/** Golden-section steps `closest` takes on the distance. */
const CLOSEST_STEPS = 40;

/**
 * The point of c1 nearest to c2 near `from`, by golden section on the distance over the
 * bracket [a, b] narrowed to the neighbourhood of `from`. The distance is continuous where
 * the signed gap is not, so this is what locates a crossing at a cusp.
 */
function closest(scan: Scan, from: Gap, a: number, b: number): Gap | null {
  const R = 0.6180339887498949;
  let lo = Math.max(a, from.t - (b - a) * 0.5), hi = Math.min(b, from.t + (b - a) * 0.5);
  let best = from;
  let c = hi - R * (hi - lo), d = lo + R * (hi - lo);
  let fc = gapAt(scan, c), fd = gapAt(scan, d);
  for (let i = 0; i < CLOSEST_STEPS && fc && fd && hi - lo > 4 * Number.EPSILON; i++) {
    if (fc.d < best.d) best = fc;
    if (fd.d < best.d) best = fd;
    if (fc.d <= fd.d) {
      hi = d; d = c; fd = fc; c = hi - R * (hi - lo); fc = gapAt(scan, c);
    } else {
      lo = c; c = d; fc = fd; d = lo + R * (hi - lo); fd = gapAt(scan, d);
    }
  }
  if (fc && fc.d < best.d) best = fc;
  if (fd && fd.d < best.d) best = fd;
  return best;
}

/** A stretch that runs to an end of one curve: report the end if it lies on the other. */
function endContact(scan: Scan, curve: 1 | 2, end: 0 | 1): void {
  const { c1, c2, out, tol } = scan;
  if (out.length > MAX_HITS) return;
  const own = curve === 1 ? c1 : c2, other = curve === 1 ? c2 : c1;
  const x = own[6 * end]!, y = own[6 * end + 1]!;
  const near = nearest(other, x, y);
  if (near.distance > tol) return;
  // An end of the other curve within `tol` of this end is a shared vertex, and is reported
  // as that end exactly. Where the curves agree to third order there, the projection falls a
  // few billionths along the other curve instead, which no caller reads as its vertex.
  let u = near.t;
  for (const e of [0, 1] as const) {
    if (Math.hypot(other[6 * e]! - x, other[6 * e + 1]! - y) <= tol) u = e;
  }
  out.push(curve === 1
    ? { t1: end, t2: u, x, y }
    : { t1: u, t2: end, x: near.point.x, y: near.point.y });
}

/** Golden-section steps `touchPoint` takes, each a gap evaluation. */
const TOUCH_STEPS = 48;

/**
 * A stretch where c1 comes within `tol` of c2 and goes back without crossing it: the point
 * where the gap is least, to be reported once.
 *
 * A boolean cuts both curves where this function says they meet, then decides each piece by
 * what lies either side of its midpoint. A touch it is not told about stays inside a piece,
 * and when that piece's midpoint falls on the touch it is decided where the two sides cannot
 * be told apart. The boolean has a contact search of its own, but asks it only when this
 * function reports nothing at all, so a touch beside a crossing has to be reported here. A
 * flat curve touching a near-copy at t = 0.25 and crossing it at t = 0.5 lost three eighths
 * of its self-union that way. The clip search used to report such a touch as a scatter of
 * points wherever its pieces converged.
 *
 * `samples` is one run of samples on one side of c2. The least gap must lie inside the run,
 * with a larger one on both sides. A gap that is least at an end of the run is still
 * closing, toward a crossing or a vertex beyond it that the run next to it, another
 * stretch or the clip search answers. Near a shared vertex the stalled pairs form a hundred
 * small stretches of that kind, and reporting each one filled the hit list.
 */
function touchPoint(scan: Scan, samples: Gap[]): Gap | null {
  const { noise, tol } = scan;
  if (samples.length < 3) return null;
  const size = (s: Gap): number => (Math.abs(s.g) <= noise ? 0 : Math.abs(s.g));
  let k = 0;
  for (let i = 1; i < samples.length; i++) if (size(samples[i]!) < size(samples[k]!)) k = i;
  let e = k;
  while (e + 1 < samples.length && size(samples[e + 1]!) === size(samples[k]!)) e++;
  if (k === 0 || e === samples.length - 1) return null;
  // The dip has to be deeper than the noise on both sides, or it is rounding, not a touch.
  // Two samples a hair apart in the noise next to a crossing had gaps that differed by
  // 1e-15, and the second was taken for a least gap inside the run: a false touch 1.8e-5
  // past the crossing, and a second cut there that the boolean could not decide.
  const dip = Math.min(size(samples[0]!), size(samples[samples.length - 1]!)) - size(samples[k]!);
  if (!(dip > noise)) return null;
  // Where the gap is lost in the noise over several samples, the middle of that run.
  k = (k + e) >> 1;
  let best = samples[k]!;
  // Golden section on the size of the gap, between the neighbouring samples. The gap has
  // one sign over the whole run, so its size is as smooth as the gap itself.
  const R = 0.6180339887498949;
  let lo = samples[k - 1]!.t, hi = samples[k + 1]!.t;
  let c = hi - R * (hi - lo), d = lo + R * (hi - lo);
  let fc = gapAt(scan, c), fd = gapAt(scan, d);
  for (let i = 0; i < TOUCH_STEPS && fc && fd && hi - lo > 4 * Number.EPSILON; i++) {
    if (size(fc) < size(best)) best = fc;
    if (size(fd) < size(best)) best = fd;
    if (size(fc) <= size(fd)) {
      hi = d; d = c; fd = fc; c = hi - R * (hi - lo); fc = gapAt(scan, c);
    } else {
      lo = c; c = d; fc = fd; d = lo + R * (hi - lo); fd = gapAt(scan, d);
    }
  }
  if (fc && size(fc) < size(best)) best = fc;
  if (fd && size(fd) < size(best)) best = fd;
  // Measured as a distance, so that a nearest point past an end of c2 counts only when that
  // end is itself within `tol`.
  return Math.hypot(best.px - best.qx, best.py - best.qy) > tol ? null : best;
}
