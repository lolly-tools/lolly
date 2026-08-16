// SPDX-License-Identifier: MPL-2.0
/**
 * Boolean operations on regions bounded by cubic Béziers - union, intersection,
 * difference, exclusive-or - and the winding-number test they are all decided by.
 *
 * ## The method
 *
 * 1. Each operand is resolved against itself first (`selfUnion`). That leaves a
 *    canonical path: contours that neither overlap nor self-cross, oriented so the
 *    filled region lies to the LEFT of the direction of travel. Everything downstream
 *    may assume it, which is what removes most of the case analysis.
 * 2. Every curve of A is split at its intersections with B and vice versa, with
 *    `subCubic`, so each piece is still exactly the original curve over a sub-range
 *    rather than an approximation of it. No polyline is ever built.
 * 3. Each piece is decided by what is filled immediately to its LEFT and to its RIGHT.
 *    It belongs to the result exactly when those two answers differ - that is the
 *    definition of a boundary - and it is emitted pointing so the kept side is on the
 *    left.
 * 4. The survivors are chained back into closed loops by shared endpoints.
 *
 * ## Why both sides, rather than "is the midpoint inside the other path"
 *
 * A one-sided test needs a point strictly inside the region beside the piece, and the
 * only way to name one is to step off the curve by some epsilon - a guess that fails on
 * thin geometry and on any piece shorter than the guess. Both sides can be had exactly
 * instead. Cast a ray from the piece's midpoint M: every curve that does NOT pass
 * through M contributes an unambiguous crossing, and the curves that DO pass through M
 * (the piece's own, plus any coincident copy) contribute to one side and not to the
 * other, decided by the sign of the ray direction crossed with the tangent. One cast
 * therefore yields the winding on both sides of M without any point being nudged.
 *
 * The same fact is why tangency is harmless. A curve that touches another without
 * crossing it is split at the contact, and each resulting piece is decided at its own
 * midpoint, nowhere near that contact. The winding is never evaluated where it is
 * ambiguous, so a touch cannot toggle it.
 *
 * ## Where two boundaries coincide
 *
 * Shared boundary is the case that quietly breaks implementations of this, because
 * there is no isolated crossing to find and an intersector asked for one answers with
 * a scatter of points along the shared run. It is handled in two places and neither is
 * optional: `pairSplits` recognises the overlap before splitting and cuts both curves
 * at the true ends of the run, so the pieces line up; `dedupeEdges` then decides the
 * shared piece once, by whether the two survivors run the same way.
 *
 * ## Orientation convention
 *
 * Positive `contourArea` is counter-clockwise in a y-up frame, and a counter-clockwise
 * outer contour has its interior on the LEFT. Every edge this module emits is oriented
 * that way, so an outer boundary comes out counter-clockwise and a hole clockwise. The
 * rule is frame-agnostic: feed it y-down SVG coordinates and every sign mirrors
 * together, so the results stay correct and simply read as clockwise on screen.
 *
 * ## Bounded work
 *
 * Untrusted path data is ordinary input here (an imported SVG, a pasted glyph), so
 * splitting, projection, contact search and ray casting are all metered against one budget.
 * An operation that exhausts it ABANDONS the result, because a partial classification is
 * worse than no attempt: the edges past the cap are answered "outside everything" and the
 * walk chains that into confetti. The budget sits above what a legitimately large path
 * costs (measured: a stroked 400-curve wiggle spends a quarter of it), so exhausting it
 * means the input really is pathological.
 *
 * What it abandons TO is the part that has to be honest. A union can be handed back exactly:
 * both operands are canonical and interior-left, so concatenating them adds their windings
 * and the nonzero region really is A∪B. No other operator has such an alternative, and
 * substituting the answer a disjoint pair would give is not a degradation but a wrong
 * answer wearing a successful one's clothes - a difference silently returns the whole first
 * operand, an intersection silently returns nothing, and the caller has no way to tell. So
 * those three throw `GeomLimitError` instead. `selfUnion` is the exception and hands back
 * the unresolved path, which is a real approximation of its own answer: the input already
 * fills nearly the region its resolved form would under the nonzero rule.
 *
 * What the budget does not cover is the time one `intersectCubics` call spends. Its own caps
 * bound it, but a near-tangential pair - two curves of the same shape a hair apart, where a
 * fat-line clip cannot make progress and the search falls back to bisection - costs
 * thousands of times what an ordinary pair does, and a thousand curves mutually shadowing
 * each other therefore take seconds, most of it inside Stage 1.
 *
 * Nothing here logs: engine core has no logger. The one thing it throws is
 * `GeomLimitError`, and only where the alternative would be a confidently wrong answer.
 */
import {
  type Box, type Cubic, boundsCubic, evalCubic, hullBounds, isLineCubic, nearestOnCubic,
  splitCubic, subCubic, tangentAt,
} from './bezier.ts';
import { EPS, intersectCubics, intersectLineCubic } from './intersect.ts';
import {
  type Contour, type GeomPath, JOIN_EPS, closeContour, compactPath, contourArea, pathBounds,
  reverseContour,
} from './path.ts';

export type BooleanOp = 'union' | 'intersection' | 'difference' | 'xor';
export type FillRule = 'nonzero' | 'evenodd';

/**
 * The operands are too big, or too pathological, to be answered within bounded work.
 *
 * Its own class so a caller can tell "I cannot answer this" apart from "the answer is
 * empty", which is the distinction the old disjoint-answer fallback destroyed: an
 * intersection that returned `[]` and an intersection that gave up looked identical.
 */
export class GeomLimitError extends Error {
  readonly op: BooleanOp;
  constructor(op: BooleanOp, detail: string) {
    super(`geom: ${op} exceeds bounded work (${detail})`);
    this.name = 'GeomLimitError';
    this.op = op;
  }
}

export interface BooleanOptions {
  /** Positional tolerance handed to the intersector. */
  tol?: number;
  /**
   * How to read the OPERANDS' own interiors. It does not describe the result: a
   * boolean's output is non-overlapping, so both rules read it identically.
   */
  fillRule?: FillRule;
}

// ── ceilings ──────────────────────────────────────────────────────────────────
// Untrusted path data is ordinary input here (an imported SVG, a pasted glyph), and every
// one of these loops is superlinear in the curve count. Each cap is sized above what real
// geometry of that size costs and below where the time becomes unreasonable, and hitting one
// yields a valid best-effort path rather than a partial one - a cap that truncates the work
// mid-classification produces confetti, which is worse than not having tried.

/** Curves per operand beyond which the pairwise pass is skipped entirely. */
const MAX_CURVES = 8000;
/** Split parameters honoured across one operation. Sized by what it costs to be WRONG
 *  rather than by what it costs to be slow: an operation that runs out of splits leaves
 *  crossings uncut, and pieces that straddle a crossing are classified at a midpoint on the
 *  wrong side of it - a thousand overlapping squares came back as 130 contours instead of
 *  one. The work budget below is the real governor of time, and it bails out safely, so this
 *  one only has to be above the count real geometry needs. */
const MAX_SPLITS = 120_000;
/** Box-overlap tests during the intersection sweep. */
const MAX_PAIRS = 4_000_000;
/**
 * Abstract units of work: 1 per curve examined, 8 per root solve, 32 per nearest-point
 * projection - which really is that much dearer, and charging it honestly is the only way
 * the cap bounds TIME rather than just iteration counts.
 *
 * Sized against what the algorithm legitimately costs, not against a round number. Ray
 * casting is inherently quadratic in the curve count (every edge asks about every curve),
 * and measured, a stroked 400-curve wiggle - an ordinary shape, a signature or a glyph run - * spends 5.6e7 of these. A cap below that does not make such a path slow, it makes it WRONG:
 * the classification answers 0/0 for every edge past the cap and the walk chains the result
 * into confetti. So the cap sits well above the legitimate cost of a path of about a
 * thousand curves, and anything past it takes the bail-out below instead of a wrong answer.
 */
const MAX_WORK = 200_000_000;
/** Subdivision nodes one pair may spend proving whether it touches. Contact search only
 *  runs on pairs the intersector found nothing in, and it prunes on an exact bound, so
 *  the cap is a backstop for pairs that shadow each other without ever meeting. */
const MAX_CONTACT_NODES = 300;
/** Parameter width the contact search isolates a bracket down to before the minimiser
 *  takes over. Coarse deliberately: subdivision proves where a contact ISN'T and is cheap
 *  at this resolution, while pinning down where it IS wants a minimiser. */
const CONTACT_SEED = 1 / 64;
/** Distinct brackets one pair may report. Two cubics touch tangentially at most a handful
 *  of times; more than this is a near-coincident pair, which `overlapRun` owns. */
const MAX_CONTACT_LEAVES = 24;

/** Parameter distance from a curve end within which a ray hit counts as hitting the
 *  shared vertex - which would be counted once per adjoining curve. */
const T_GUARD = 1e-7;

interface Budget { splits: number; pairs: number; work: number }

function newBudget(): Budget {
  return { splits: MAX_SPLITS, pairs: MAX_PAIRS, work: MAX_WORK };
}

/** The caller's tolerance, or the default when it is not a usable number.
 *
 *  A NaN tolerance is not a loose one, it is a poisoned one: `weld` becomes NaN, every
 *  comparison against it is false, and the operation returns empty with nothing to say it
 *  was skipped. An infinite one welds the whole plane into a point. Both come out of
 *  arithmetic on an unset dimension upstream, so they are conditioned here rather than
 *  trusted. */
function usableTol(tol: number | undefined): number {
  return typeof tol === 'number' && Number.isFinite(tol) && tol > 0 ? tol : EPS;
}

// ── public surface ────────────────────────────────────────────────────────────

/**
 * Combine two paths. Open contours are closed first, because the alternative is
 * silently discarding geometry the caller passed in.
 *
 * Throws `GeomLimitError` for an intersection, difference or xor that cannot be answered
 * within bounded work - see `abandon` for why those three have nothing honest to return.
 */
export function booleanPath(a: GeomPath, b: GeomPath, op: BooleanOp, opts: BooleanOptions = {}): GeomPath {
  const tol = usableTol(opts.tol);
  const A = selfUnion(a, opts);
  const B = selfUnion(b, opts);
  if (!A.length || !B.length) return withEmptyOperand(A, B, op);

  const boxA = pathBounds(A), boxB = pathBounds(B);
  if (!boxA || !boxB) return withEmptyOperand(A, B, op);
  const span = Math.max(boxA.x1 - boxA.x0, boxA.y1 - boxA.y0, boxB.x1 - boxB.x0, boxB.y1 - boxB.y0, 1);
  const weld = Math.max(tol, JOIN_EPS) * span;
  const near = weld * 1e-2;

  // Disjoint boxes mean disjoint regions, which settles every operator without any
  // geometry at all. Worth the two comparisons: it is the common case when a boolean
  // is applied across a whole document.
  if (boxA.x1 + weld < boxB.x0 || boxB.x1 + weld < boxA.x0
   || boxA.y1 + weld < boxB.y0 || boxB.y1 + weld < boxA.y0) return disjointResult(A, B, op);

  const idxA = buildIndex(A), idxB = buildIndex(B);
  // Over the ceiling the pairwise pass is not attempted at all.
  if (idxA.curves.length > MAX_CURVES || idxB.curves.length > MAX_CURVES) {
    return abandon(A, B, op, `${idxA.curves.length}+${idxB.curves.length} curves over the ${MAX_CURVES} ceiling`);
  }

  const budget = newBudget();
  const splitsA: number[][] = idxA.curves.map(() => []);
  const splitsB: number[][] = idxB.curves.map(() => []);
  crossSplits(idxA.curves, idxB.curves, splitsA, splitsB, tol, weld, budget);

  const edges: Cubic[] = [
    ...splitIntoEdges(idxA.curves, splitsA, weld),
    ...splitIntoEdges(idxB.curves, splitsB, weld),
  ];

  const kept: Cubic[] = [];
  for (const e of edges) {
    const m = evalCubic(e, 0.5);
    const ref = midTangent(e);
    // Always A then B, never "own then other": difference is the one operator that
    // cares which operand is which, and a piece of B classified as if it were a piece
    // of A turns A−B silently into a union.
    const wa = sideWindings(idxA, m.x, m.y, ref.x, ref.y, near, budget);
    const wb = sideWindings(idxB, m.x, m.y, ref.x, ref.y, near, budget);
    // Both operands are canonical after `selfUnion`, so their interiors are described
    // by the nonzero rule whatever rule the caller's raw input needed.
    const left = combine(wa.left !== 0, wb.left !== 0, op);
    const right = combine(wa.right !== 0, wb.right !== 0, op);
    if (left === right) continue;          // interior to the result, or outside it
    kept.push(left ? e : reverseCubic(e));
  }

  // Out of budget means some edges were classified and the rest were answered 0/0, and
  // chaining those together is confetti - a worse answer than not having attempted the
  // operation.
  if (budget.work <= 0) return abandon(A, B, op, 'the work budget ran out mid-classification');
  return compactPath(walkLoops(dedupeEdges(kept, weld), weld));
}

export function unionPath(a: GeomPath, b: GeomPath, opts?: BooleanOptions): GeomPath {
  return booleanPath(a, b, 'union', opts);
}

export function intersectPath(a: GeomPath, b: GeomPath, opts?: BooleanOptions): GeomPath {
  return booleanPath(a, b, 'intersection', opts);
}

/**
 * A minus B.
 *
 * Classified directly, not as "intersect A with a reversed B". That shortcut only
 * inverts an operand cleanly while its winding is ±1 everywhere, and it stops being
 * true the moment B has nested contours wound the same way - the reversal then turns a
 * doubly-wound region into a doubly-wound one of the other sign rather than into a
 * hole. Asking what is filled either side of a piece does not care how B is wound.
 */
export function differencePath(a: GeomPath, b: GeomPath, opts?: BooleanOptions): GeomPath {
  return booleanPath(a, b, 'difference', opts);
}

export function xorPath(a: GeomPath, b: GeomPath, opts?: BooleanOptions): GeomPath {
  return booleanPath(a, b, 'xor', opts);
}

/**
 * Resolve a path against itself: self-intersections become real vertices, overlapping
 * material collapses, and every contour comes back oriented interior-left.
 *
 * Both a public entry point (Stage 3's inward offsets always produce self-overlap, and
 * this is what removes it) and the preprocessing step `booleanPath` runs on each
 * operand - the pairwise pass is only simple because it can assume canonical inputs.
 */
export function selfUnion(p: GeomPath, opts: BooleanOptions = {}): GeomPath {
  const tol = usableTol(opts.tol);
  const rule = opts.fillRule ?? 'nonzero';
  const path = normalise(p);
  if (!path.length) return [];

  const idx = buildIndex(path);
  const box = idx.box;
  if (!box || !idx.curves.length) return [];
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0, 1);
  const weld = Math.max(tol, JOIN_EPS) * span;
  const near = weld * 1e-2;
  if (idx.curves.length > MAX_CURVES) return path;   // best effort: leave it alone

  const budget = newBudget();
  const splits: number[][] = idx.curves.map(() => []);
  selfSplits(idx.curves, splits, tol, weld, budget);

  // A single contour that never crosses itself is already canonical apart from its
  // direction, and returning it untouched keeps the caller's exact control points - // which the split/classify/walk round trip would only reproduce approximately. The
  // direction is settled by the same side test the general path uses rather than by a
  // signed area, so one deeply concave curve cannot flip it.
  //
  // "Never crosses itself" is not the same as "has no split parameters": a contour that
  // TOUCHES itself at a vertex has none, because the contact sits exactly where two
  // curves already end and an endpoint is correctly not an intersection. Such a contour
  // still bounds two regions, wound oppositely under nonzero, and handing it back
  // untouched leaves the two cancelling - so it goes the long way round instead.
  if (path.length === 1 && !splits.some((s) => s.length) && !selfTouching(path[0]!, weld)) {
    const only = path[0]!;
    const probe = only.curves[0]!;
    const m = evalCubic(probe, 0.5);
    const ref = midTangent(probe);
    const w = sideWindings(idx, m.x, m.y, ref.x, ref.y, near, budget);
    return [filled(w.left, rule) ? only : reverseContour(only)];
  }

  const kept: Cubic[] = [];
  for (const c of splitIntoEdges(idx.curves, splits, weld)) {
    const m = evalCubic(c, 0.5);
    const ref = midTangent(c);
    const w = sideWindings(idx, m.x, m.y, ref.x, ref.y, near, budget);
    const left = filled(w.left, rule), right = filled(w.right, rule);
    if (left === right) continue;
    kept.push(left ? c : reverseCubic(c));
  }
  // Same bail-out as `booleanPath`, and here the fallback is barely a compromise: the
  // unresolved path fills nearly the region its resolved form would under the nonzero rule,
  // which is what a caller self-unioning an offset or a stroke outline started from.
  if (budget.work <= 0) return path;
  return compactPath(walkLoops(dedupeEdges(kept, weld), weld));
}

/**
 * Signed number of times the path wraps around the point, counter-clockwise positive
 * in a y-up frame.
 *
 * Counted algebraically: a ray is cast from the point and every curve's crossings with
 * it are the roots of that curve's signed distance to the ray line, solved in closed
 * form by `intersectLineCubic`. Nothing is flattened, so the count is the true one and
 * not the count of a polyline that happens to resemble the path.
 *
 * The ray direction is chosen to avoid passing through a curve endpoint (which would
 * be counted once per adjoining curve), grazing a curve tangentially (where the
 * crossing has no side), or running along a straight curve (whose distance polynomial
 * is then identically zero, so it reports no roots at all and would vanish from the
 * count). Any of those retries with a rotated direction rather than guessing.
 *
 * A point exactly ON the path has no defined winding; the value returned there counts
 * the touching curve, which is stable but arbitrary.
 */
export function windingNumber(p: GeomPath, x: number, y: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const idx = buildIndex(normalise(p));
  const box = idx.box;
  if (!box || !idx.curves.length) return 0;
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0, 1);
  const near = Math.max(EPS, JOIN_EPS) * span * 1e-2;
  const budget = newBudget();
  let last = 0;
  for (const d of RAY_DIRS) {
    const cast = castRay(idx, x, y, d[0], d[1], null, near, budget);
    if (cast.ok) return cast.far;
    last = cast.far;
    if (budget.work <= 0) return last;
  }
  // Every direction defeated. `last` is a prefix sum - the curves the failing cast never
  // reached are simply missing from it - so the fallback is a cast that visits all of them.
  const d = RAY_DIRS[0]!;
  const cast = castRay(idx, x, y, d[0], d[1], null, near, budget, true);
  return cast.ok || budget.work > 0 ? cast.far : last;
}

export function pointInPath(p: GeomPath, x: number, y: number, rule: FillRule = 'nonzero'): boolean {
  return filled(windingNumber(p, x, y), rule);
}

// ── region algebra ────────────────────────────────────────────────────────────

function filled(w: number, rule: FillRule): boolean {
  // Every crossing is ±1, so the parity of the winding number and the parity of the
  // crossing count are the same thing - even-odd needs no separate tally.
  return rule === 'evenodd' ? (Math.abs(w) & 1) === 1 : w !== 0;
}

function combine(a: boolean, b: boolean, op: BooleanOp): boolean {
  switch (op) {
    case 'union': return a || b;
    case 'intersection': return a && b;
    case 'difference': return a && !b;
    default: return a !== b;
  }
}

function withEmptyOperand(a: GeomPath, b: GeomPath, op: BooleanOp): GeomPath {
  if (!a.length && !b.length) return [];
  if (!a.length) return op === 'union' || op === 'xor' ? b : [];
  return op === 'intersection' ? [] : a;
}

/** Boxes proved apart: union is concatenation, intersection is empty. */
function disjointResult(a: GeomPath, b: GeomPath, op: BooleanOp): GeomPath {
  switch (op) {
    case 'union': case 'xor': return [...a, ...b];
    case 'intersection': return [];
    default: return a;
  }
}

/**
 * Give up on an operation that cannot be done within bounded work.
 *
 * A union has an exact way out and takes it: both operands are canonical and interior-left,
 * so the concatenation's nonzero region IS A∪B. The one thing it gives up is canonical
 * FORM - the contours overlap where the operands did, so the result no longer reads the
 * same under both fill rules.
 *
 * The other three have no such alternative. Handing back what a disjoint pair would give
 * makes a difference return the whole of A and an intersection return nothing, both of
 * which are valid paths, both of which are silently wrong, and neither of which the caller
 * can distinguish from the real answer. Being told is strictly more useful.
 */
function abandon(a: GeomPath, b: GeomPath, op: BooleanOp, detail: string): GeomPath {
  if (op === 'union') return [...a, ...b];
  throw new GeomLimitError(op, detail);
}

// ── input conditioning ────────────────────────────────────────────────────────

function isFiniteCubic(c: Cubic): boolean {
  for (let i = 0; i < 8; i++) if (!Number.isFinite(c[i]!)) return false;
  return true;
}

/** How far a curve reaches from its start - a chord-and-hull measure, no roots. */
function extent(c: Cubic): number {
  return Math.max(
    Math.hypot(c[2] - c[0], c[3] - c[1]),
    Math.hypot(c[4] - c[0], c[5] - c[1]),
    Math.hypot(c[6] - c[0], c[7] - c[1]),
  );
}

/** Close every contour, drop curves that are points, drop coordinates that are not
 *  numbers. Booleans are defined on regions and an open or NaN-bearing contour bounds
 *  none, so this is the point where malformed input stops being a hazard. */
function normalise(p: GeomPath): GeomPath {
  const out: GeomPath = [];
  for (const contour of p) {
    const curves = contour.curves.filter((c) => isFiniteCubic(c) && extent(c) > 1e-12);
    if (!curves.length) continue;
    const closed = closeContour({ curves, closed: true });
    if (closed.curves.length) out.push(closed);
  }
  return out;
}

/**
 * Does a contour come back to a point it has already been to?
 *
 * Every vertex of a contour that bounds one region appears exactly once as the start of a
 * curve, so a repeat is a contact - a figure of eight pinched at a point, or a slit cut in
 * and retraced back out. Both need resolving and neither leaves a split parameter behind
 * to notice it by, which is why this is asked separately rather than inferred.
 */
function selfTouching(c: Contour, weld: number): boolean {
  const cell = Math.max(weld * 4, 1e-12);
  const seen = new Map<string, { x: number; y: number }[]>();
  for (const k of c.curves) {
    const cx = Math.round(k[0] / cell), cy = Math.round(k[1] / cell);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (const p of seen.get(`${cx + ox},${cy + oy}`) ?? []) {
          if (Math.hypot(p.x - k[0], p.y - k[1]) <= weld) return true;
        }
      }
    }
    const key = `${cx},${cy}`;
    const bucket = seen.get(key);
    if (bucket) bucket.push({ x: k[0], y: k[1] }); else seen.set(key, [{ x: k[0], y: k[1] }]);
  }
  return false;
}

interface IndexedCurve { c: Cubic; box: Box }
interface CurveIndex { curves: IndexedCurve[]; box: Box | null }

function buildIndex(p: GeomPath): CurveIndex {
  const curves: IndexedCurve[] = [];
  let box: Box | null = null;
  for (const contour of p) {
    for (const c of contour.curves) {
      const b = boundsCubic(c);
      curves.push({ c, box: b });
      box = box ? {
        x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0),
        x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1),
      } : b;
    }
  }
  return { curves, box };
}

const reverseCubic = (k: Cubic): Cubic => [k[6], k[7], k[4], k[5], k[2], k[3], k[0], k[1]];

/** Direction at the midpoint, falling back to the chord - a cubic's derivative
 *  vanishes at a cusp, and a zero reference vector would make every side test
 *  meaningless rather than merely imprecise. */
function midTangent(c: Cubic): { x: number; y: number } {
  const t = tangentAt(c, 0.5);
  if (Math.hypot(t.x, t.y) > 1e-12) return t;
  const dx = c[6] - c[0], dy = c[7] - c[1];
  if (Math.hypot(dx, dy) > 1e-12) return { x: dx, y: dy };
  return { x: 1, y: 0 };
}

// ── splitting ─────────────────────────────────────────────────────────────────

/**
 * Every pair of curves whose boxes overlap, by sweep-and-prune along x rather than by
 * testing all n·m. A page-sized path carries thousands of curves, and the quadratic
 * scan is the difference between milliseconds and minutes - which on untrusted input is
 * the difference between a slow render and a hang.
 *
 * Both lists are visited in x0 order; each curve is tested only against the curves
 * still reaching the sweep line, so a pair is visited exactly once and only when its
 * x-ranges genuinely overlap.
 */
function sweepPairs(
  a: IndexedCurve[], b: IndexedCurve[], self: boolean, budget: Budget,
  visit: (i: number, j: number) => void,
): void {
  const byStart = (list: IndexedCurve[]) =>
    list.map((_, i) => i).sort((p, q) => list[p]!.box.x0 - list[q]!.box.x0);
  const prune = (active: number[], list: IndexedCurve[], x: number): void => {
    let w = 0;
    for (let r = 0; r < active.length; r++) {
      const i = active[r]!;
      if (list[i]!.box.x1 >= x) active[w++] = i;
    }
    active.length = w;
  };
  const yHit = (p: Box, q: Box) => p.y1 >= q.y0 && q.y1 >= p.y0;

  if (self) {
    const order = byStart(a);
    const active: number[] = [];
    for (const i of order) {
      const box = a[i]!.box;
      prune(active, a, box.x0);
      for (const j of active) {
        if (budget.pairs-- <= 0) return;
        if (yHit(box, a[j]!.box)) visit(Math.min(i, j), Math.max(i, j));
        if (budget.splits <= 0) return;
      }
      active.push(i);
    }
    return;
  }

  const ao = byStart(a), bo = byStart(b);
  const activeA: number[] = [], activeB: number[] = [];
  let ai = 0, bi = 0;
  while (ai < ao.length || bi < bo.length) {
    const ax = ai < ao.length ? a[ao[ai]!]!.box.x0 : Infinity;
    const bx = bi < bo.length ? b[bo[bi]!]!.box.x0 : Infinity;
    if (ax <= bx) {
      const i = ao[ai++]!;
      const box = a[i]!.box;
      prune(activeB, b, box.x0);
      for (const j of activeB) {
        if (budget.pairs-- <= 0) return;
        if (yHit(box, b[j]!.box)) visit(i, j);
        if (budget.splits <= 0) return;
      }
      activeA.push(i);
    } else {
      const j = bo[bi++]!;
      const box = b[j]!.box;
      prune(activeA, a, box.x0);
      for (const i of activeA) {
        if (budget.pairs-- <= 0) return;
        if (yHit(a[i]!.box, box)) visit(i, j);
        if (budget.splits <= 0) return;
      }
      activeB.push(j);
    }
  }
}

function addSplit(splits: number[][], index: number, t: number, budget: Budget): void {
  // A parameter at either end names a point the curve already ends at, so recording it
  // would only manufacture a zero-length piece. This is also what keeps the shared
  // endpoint of two consecutive segments from reading as an intersection: the hit is
  // reported at t=1 on one and t=0 on the other, and both are dropped here.
  if (!(t > 1e-9 && t < 1 - 1e-9)) return;
  if (budget.splits-- <= 0) return;
  splits[index]!.push(t);
}

/**
 * Two straight, collinear, partially overlapping pieces.
 *
 * The general intersector reports nothing for them - two parallel segments have no
 * determinant to solve - so without this they would never be split at the ends of
 * their shared run, the pieces of A and B would not line up, and the overlap would
 * survive twice in the output. Two rectangles sharing an edge is the everyday case.
 */
function collinearSplits(a: Cubic, b: Cubic, weld: number, budget: Budget): { ta: number[]; tb: number[] } | null {
  const dx = a[6] - a[0], dy = a[7] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < weld) return null;
  const nx = -dy / len, ny = dx / len;
  for (let i = 0; i < 8; i += 2) {
    if (Math.abs(nx * (b[i]! - a[0]) + ny * (b[i + 1]! - a[1])) > weld) return null;
  }
  const proj = (x: number, y: number) => ((x - a[0]) * dx + (y - a[1]) * dy) / (len * len);
  const u0 = proj(b[0], b[1]), u1 = proj(b[6], b[7]);
  const lo = Math.max(0, Math.min(u0, u1)), hi = Math.min(1, Math.max(u0, u1));
  if (hi - lo < weld / len) return null;
  const ta: number[] = [], tb: number[] = [];
  for (const u of [lo, hi]) {
    const px = a[0] + dx * u, py = a[1] + dy * u;
    budget.work -= 64;
    // The parameter, not the projection: a straight cubic may be unevenly
    // parameterised, and splitting at the wrong t would move the coordinate.
    ta.push(nearestOnCubic(a, px, py).t);
    tb.push(nearestOnCubic(b, px, py).t);
  }
  return { ta, tb };
}

/**
 * The two parameters where one cubic crosses ITSELF, in closed form.
 *
 * P(t1) = P(t2) with t1 ≠ t2 divides through by (t1 − t2) to leave
 * A(t1² + t1t2 + t2²) + B(t1 + t2) + C = 0 in both coordinates - two equations that are
 * linear in (s² − q) and s, where s = t1 + t2 and q = t1t2. So the loop parameters are
 * a 2×2 solve and one quadratic, with nothing iterated. A cubic loop is not exotic:
 * inward offsets and freehand fits produce them constantly, and an unresolved one makes
 * a whole contour's winding wrong.
 */
function selfIntersectCubic(c: Cubic): [number, number] | null {
  const ax = -c[0] + 3 * c[2] - 3 * c[4] + c[6];
  const bx = 3 * c[0] - 6 * c[2] + 3 * c[4];
  const cx = -3 * c[0] + 3 * c[2];
  const ay = -c[1] + 3 * c[3] - 3 * c[5] + c[7];
  const by = 3 * c[1] - 6 * c[3] + 3 * c[5];
  const cy = -3 * c[1] + 3 * c[3];
  const det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-12) return null;
  const m = (bx * cy - cx * by) / det;     // m = s² − q
  const s = (ay * cx - ax * cy) / det;
  const q = s * s - m;
  const disc = s * s - 4 * q;
  if (disc <= 0) return null;
  const r = Math.sqrt(disc);
  const t1 = (s - r) / 2, t2 = (s + r) / 2;
  if (!(t1 > 1e-9 && t2 < 1 - 1e-9 && t2 - t1 > 1e-9)) return null;
  return [t1, t2];
}

/**
 * Where one pair of curves needs cutting.
 *
 * Coincident curves are the trap here. They have no isolated crossing, and the
 * intersector - whose whole job is to find isolated crossings - answers a shared run
 * with a scatter of points along it. Splitting at those cuts A and B at slightly
 * different parameters, the pieces stop matching, the coincidence test no longer
 * recognises them, and the overlap survives twice in the output. So:
 *
 * - curves that already coincide end to end are skipped outright; their pieces line up
 *   as they are and there is nothing to cut;
 * - curves that share only PART of their length are recognised by `overlapRun` before the
 *   intersector is asked anything, because asking it for isolated crossings that do not
 *   exist is what makes the search grind;
 * - otherwise the reported hits are bracketed and `continuesAsSameCurve` asks whether the
 *   two curves are the same curve over that bracket. That is a proof rather than a guess
 *   about how many hits look suspicious, and a genuine pair of crossings fails it (the
 *   pieces between two crossings bound a lens, they are not equal). The cuts then come
 *   from `overlapSplits`, NOT from the scatter's own extremes, which sit wherever the
 *   subdivision happened to stop;
 * - two straight pieces overlapping along a line report nothing at all, since parallel
 *   segments have no determinant to solve, and are handled by `collinearSplits`;
 * - curves that TOUCH without crossing report nothing either, and are handled by
 *   `contactSplits`.
 */
function pairSplits(ci: Cubic, cj: Cubic, tol: number, weld: number, budget: Budget): { a: number[]; b: number[] } | null {
  budget.work -= 4;
  if (coincidence(ci, cj, weld) !== 0) return null;
  const run = overlapRun(ci, cj, weld, budget);
  if (run) return run;

  const hits = intersectCubics(ci, cj, tol);
  if (!hits.length) {
    if (isLineCubic(ci, weld) && isLineCubic(cj, weld)) {
      const co = collinearSplits(ci, cj, weld, budget);
      if (co) return { a: co.ta, b: co.tb };
    }
    return contactSplits(ci, cj, weld, budget);
  }
  if (hits.length >= 2) {
    let a0 = 1, a1 = 0, b0 = 1, b1 = 0;
    for (const h of hits) {
      a0 = Math.min(a0, h.t1); a1 = Math.max(a1, h.t1);
      b0 = Math.min(b0, h.t2); b1 = Math.max(b1, h.t2);
    }
    // Two cubics meet at most nine times, so more hits than that is a scatter whatever
    // the sub-ranges say.
    if (hits.length > 9 || continuesAsSameCurve(ci, a0, a1, cj, b0, b1, weld) !== 0) {
      return overlapSplits(ci, cj, weld, budget);
    }
  }
  return { a: hits.map((h) => h.t1), b: hits.map((h) => h.t2) };
}

/**
 * A run of boundary shared by two curves that are NOT the same curve end to end - one is
 * a sub-range of the other, or the two overlap over part of their length.
 *
 * A run can only begin and end where one of the four endpoints falls, so each endpoint is
 * projected onto the other curve; two or more of them landing on it bracket a candidate
 * run, and the sub-ranges that run spans are then compared for identity. The comparison is
 * a proof rather than a heuristic - a degree-three difference that vanishes at four
 * parameters is identically zero - so a genuine crossing cannot be mistaken for an
 * overlap: the pieces between two crossings bound a lens and are not equal.
 *
 * Asked BEFORE the intersector, which is the whole point. Asking for isolated crossings
 * between curves that share a run is asking for something that does not exist, and the
 * search spends its entire budget failing: an arch against a sub-range of ITSELF took
 * sixteen seconds. That composition is not exotic. It is what an offset does every time
 * its result is combined again, which is most of Stage 3.
 */
function overlapRun(ci: Cubic, cj: Cubic, weld: number, budget: Budget): { a: number[]; b: number[] } | null {
  const ends: [number, number][] = [];
  const hi = hullBounds(ci), hj = hullBounds(cj);
  for (const t of [0, 1]) {
    const p = evalCubic(ci, t);
    if (!inflated(hj, p.x, p.y, weld)) continue;
    budget.work -= 32;
    const n = nearestOnCubic(cj, p.x, p.y);
    if (n.distance <= weld) ends.push([t, n.t]);
  }
  for (const t of [0, 1]) {
    const p = evalCubic(cj, t);
    if (!inflated(hi, p.x, p.y, weld)) continue;
    budget.work -= 32;
    const n = nearestOnCubic(ci, p.x, p.y);
    if (n.distance <= weld) ends.push([n.t, t]);
  }
  if (ends.length < 2) return null;

  let a0 = 1, a1 = 0, b0 = 1, b1 = 0;
  for (const [s, t] of ends) {
    a0 = Math.min(a0, s); a1 = Math.max(a1, s);
    b0 = Math.min(b0, t); b1 = Math.max(b1, t);
  }
  const sa = subCubic(ci, a0, a1), sb = subCubic(cj, b0, b1);
  if (extent(sa) <= weld || extent(sb) <= weld) return null;
  if (coincidence(sa, sb, weld) === 0) return null;
  return { a: [a0, a1], b: [b0, b1] };
}

/** Is the point inside a box grown by `pad`? A cheap reject before a projection. */
function inflated(b: Box, x: number, y: number, pad: number): boolean {
  return x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad;
}

/**
 * Where two curves TOUCH without crossing.
 *
 * A tangency is the one contact the intersector cannot close on. A fat-line clip barely
 * shrinks the domain there, so it falls back to bisection, and bisecting a ten-unit chord
 * down to a 1e-9 box needs more levels than its depth cap allows - it reports nothing at
 * all for two circles that meet at a point. As an INTERSECTION answer that is defensible;
 * there is no crossing. As input to a boolean it is fatal, because a piece is only
 * classified correctly when its midpoint is somewhere the answer is unambiguous, and
 * immediately either side of an external tangency one disc is filled and the other is
 * not. A tangency landing at the midpoint of an arc therefore decides that arc at the one
 * parameter where the winding has no value, and the arc is deleted from both operands.
 *
 * Two steps, and the split between them is the whole design. Subdivision ISOLATES: a
 * sub-pair whose TIGHT boxes lie further apart than the weld radius provably contains no
 * contact and is discarded outright, so what survives is a proof of where a contact can
 * be, not a guess. Minimisation PINS: within a surviving bracket the contact is the
 * parameter where the gap between the curves is least, found by golden section on the
 * exact gap.
 *
 * Subdividing all the way down instead - the obvious single-step version - cannot locate a
 * tangency at all, and this is worth stating precisely because the failure looks like
 * rounding rather than like a wrong method. Two curves tangent to second order stay within
 * the weld radius over a parameter neighbourhood of √(weld/Δκ), which for a weld of 1e-5 on
 * page-sized arches is a fiftieth of the curve. Every box pair in that neighbourhood
 * qualifies, so the recursion reports a scatter of contacts spread across it, each one a
 * cut that misses the touch point by enough to leave a visible sliver - and it burns its
 * node budget subdividing a region it can never resolve. The gap MINIMUM is at the contact
 * and nowhere else, and because the gap is quadratic there it pins down to about the
 * square root of double precision: a contact located to ~1e-9 rather than to ~1e-2.
 *
 * A contact that turns out to sit on a curve's endpoint - two curves of one contour meeting
 * at their shared vertex, which is not an intersection at all - converges onto that
 * endpoint, where `addSplit` then correctly refuses to cut.
 */
function contactSplits(ci: Cubic, cj: Cubic, weld: number, budget: Budget): { a: number[]; b: number[] } | null {
  const leaves: [number, number][] = [];
  let nodes = MAX_CONTACT_NODES;
  const rec = (p: Cubic, s0: number, s1: number, q: Cubic, t0: number, t1: number): void => {
    if (nodes-- <= 0 || leaves.length >= MAX_CONTACT_LEAVES || budget.work <= 0) return;
    budget.work -= 1;
    const bp = boundsCubic(p), bq = boundsCubic(q);
    const dx = Math.max(bp.x0 - bq.x1, bq.x0 - bp.x1, 0);
    const dy = Math.max(bp.y0 - bq.y1, bq.y0 - bp.y1, 0);
    if (Math.hypot(dx, dy) > weld) return;
    if (s1 - s0 <= CONTACT_SEED && t1 - t0 <= CONTACT_SEED) { leaves.push([s0, s1]); return; }
    if (s1 - s0 >= t1 - t0) {
      const [lo, hi] = splitCubic(p, 0.5), m = (s0 + s1) / 2;
      rec(lo, s0, m, q, t0, t1);
      rec(hi, m, s1, q, t0, t1);
    } else {
      const [lo, hi] = splitCubic(q, 0.5), m = (t0 + t1) / 2;
      rec(p, s0, s1, lo, t0, m);
      rec(p, s0, s1, hi, m, t1);
    }
  };
  rec(ci, 0, 1, cj, 0, 1);
  if (!leaves.length) return null;

  // One bracket at a time, deliberately not merged with its neighbours. A touch landing on a
  // subdivision boundary survives in both, and each of the two minimises to that shared
  // boundary EXACTLY - the same parameter twice, which `splitIntoEdges` collapses. Merging
  // them into one wide bracket first would be the tidier-looking choice and is unsound:
  // golden section needs the gap unimodal, and a bracket holding two contacts is where it
  // settles between them instead of on either.
  const a: number[] = [], b: number[] = [];
  for (const [s0, s1] of leaves) {
    const pin = pinContact(ci, cj, s0, s1, weld, budget);
    if (!pin) continue;
    a.push(pin[0]); b.push(pin[1]);
  }
  return a.length ? { a, b } : null;
}

/**
 * The parameters of least gap within one bracket, by golden section.
 *
 * Golden section rather than Newton because the contact this is asked about is a DOUBLE
 * root: the gap's derivative and the Jacobian of every stationarity condition vanish
 * together there, so every quadratically convergent method is singular at the answer.
 * Bracketed minimisation has no such trouble - it only needs the gap to be unimodal on the
 * bracket, which the box pruning has already established by leaving one contact in it - and
 * it converges on a boundary minimum just as happily as on an interior one, which is the
 * shared-vertex case.
 *
 * The gap is measured between points computed FROM the curves, and the parameter that comes
 * back addresses the originals. Nothing is flattened and no polyline stands in for either
 * curve.
 */
function pinContact(
  ci: Cubic, cj: Cubic, s0: number, s1: number, weld: number, budget: Budget,
): [number, number] | null {
  const gap = (s: number): { d: number; t: number } => {
    const p = evalCubic(ci, s);
    const n = nearestOnCubic(cj, p.x, p.y);
    return { d: n.distance, t: n.t };
  };
  const R = 0.6180339887498949;
  let lo = s0, hi = s1;
  let c = hi - R * (hi - lo), d = lo + R * (hi - lo);
  let fc = gap(c), fd = gap(d);
  let best = fc.d <= fd.d ? { s: c, ...fc } : { s: d, ...fd };
  for (const s of [s0, s1]) {
    const g = gap(s);
    if (g.d < best.d) best = { s, ...g };
  }
  for (let i = 0; i < 90 && hi - lo > 1e-12; i++) {
    if (budget.work <= 0) break;
    budget.work -= 32;
    if (fc.d <= fd.d) {
      hi = d; d = c; fd = fc; c = hi - R * (hi - lo); fc = gap(c);
    } else {
      lo = c; c = d; fc = fd; d = lo + R * (hi - lo); fd = gap(d);
    }
    const near = fc.d <= fd.d ? { s: c, ...fc } : { s: d, ...fd };
    if (near.d < best.d) best = near;
  }
  return best.d <= weld ? [best.s, best.t] : null;
}

/**
 * The ends of a shared run between two curves already known to overlap.
 *
 * A run can only end where one of the four endpoints falls, so each endpoint is
 * projected onto the other curve and kept when it actually lands on it. That is a root
 * find, not a search: the parameter comes back from `nearestOnCubic`, so the cut lands
 * on the curve rather than near it. Taking the extremes of the intersector's reported
 * points instead would put the cut wherever its subdivision happened to stop, and the
 * two curves would then be cut at different places - the overlap would survive twice.
 */
function overlapSplits(ci: Cubic, cj: Cubic, weld: number, budget: Budget): { a: number[]; b: number[] } {
  const a: number[] = [], b: number[] = [];
  budget.work -= 256;
  for (const t of [0, 1]) {
    const p = evalCubic(ci, t);
    const n = nearestOnCubic(cj, p.x, p.y);
    if (n.distance <= weld) b.push(n.t);
  }
  for (const t of [0, 1]) {
    const p = evalCubic(cj, t);
    const n = nearestOnCubic(ci, p.x, p.y);
    if (n.distance <= weld) a.push(n.t);
  }
  return { a, b };
}

function selfSplits(curves: IndexedCurve[], splits: number[][], tol: number, weld: number, budget: Budget): void {
  for (let i = 0; i < curves.length; i++) {
    const loop = selfIntersectCubic(curves[i]!.c);
    if (loop) { addSplit(splits, i, loop[0], budget); addSplit(splits, i, loop[1], budget); }
  }
  sweepPairs(curves, curves, true, budget, (i, j) => {
    const found = pairSplits(curves[i]!.c, curves[j]!.c, tol, weld, budget);
    if (!found) return;
    for (const t of found.a) addSplit(splits, i, t, budget);
    for (const t of found.b) addSplit(splits, j, t, budget);
  });
}

function crossSplits(
  a: IndexedCurve[], b: IndexedCurve[], splitsA: number[][], splitsB: number[][],
  tol: number, weld: number, budget: Budget,
): void {
  sweepPairs(a, b, false, budget, (i, j) => {
    const found = pairSplits(a[i]!.c, b[j]!.c, tol, weld, budget);
    if (!found) return;
    for (const t of found.a) addSplit(splitsA, i, t, budget);
    for (const t of found.b) addSplit(splitsB, j, t, budget);
  });
}

/**
 * Cut each curve at its recorded parameters with `subCubic`, so every piece is the
 * original curve restricted to a sub-range.
 *
 * A cut is dropped when the PIECE it would open is degenerate - extent below the weld
 * radius - rather than when its position is close to the previous cut's. Several sources
 * report the same contact at slightly different parameters (a tangency is a double root
 * and comes back as two roots a whisker apart; a scatter along a shared run reports a
 * handful), and cutting at each of them would leave sub-weld slivers that then have to be
 * dropped, leaving a gap for the walk to bridge. Merging by the piece's extent collapses
 * those to one cut, so the two real pieces meet exactly.
 *
 * Measuring the piece rather than the distance between the two cut POINTS is what keeps a
 * self-crossing curve intact. Its two loop parameters name the same point, so a
 * position test calls the second one a duplicate and drops it - and then the loop is
 * never separated from the rest of the curve, nothing closes, and the walk hands back two
 * dangling chains. The piece between those parameters is a whole lobe: its endpoints
 * coincide and its extent is large, which is exactly the distinction this test makes.
 */
function splitIntoEdges(curves: IndexedCurve[], splits: number[][], weld: number): Cubic[] {
  const out: Cubic[] = [];
  for (let i = 0; i < curves.length; i++) {
    const ts = splits[i]!;
    const c = curves[i]!.c;
    if (!ts.length) { if (extent(c) > weld) out.push(c); continue; }
    const cuts: number[] = [0];
    for (const t of ts.slice().sort((p, q) => p - q)) {
      const prev = cuts[cuts.length - 1]!;
      if (t - prev <= 1e-9) continue;
      if (extent(subCubic(c, prev, t)) <= weld) continue;
      cuts.push(t);
    }
    const prev = cuts[cuts.length - 1]!;
    if (cuts.length === 1 || (1 - prev > 1e-9 && extent(subCubic(c, prev, 1)) > weld)) cuts.push(1);
    else cuts[cuts.length - 1] = 1;
    for (let k = 1; k < cuts.length; k++) {
      const piece = subCubic(c, cuts[k - 1]!, cuts[k]!);
      if (extent(piece) > weld) out.push(piece);
    }
  }
  return out;
}

// ── winding by ray cast ───────────────────────────────────────────────────────

/** Ray directions tried in order. The axis-aligned pair first, because the box
 *  pre-filter culls hardest along an axis; then a golden-angle spread, whose successive
 *  directions share no rational relationship, so a degeneracy that defeats one rarely
 *  defeats the next. */
const RAY_DIRS: readonly (readonly [number, number])[] = buildRayDirs();

function buildRayDirs(): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [[1, 0], [0, 1]];
  for (let k = 1; k <= 10; k++) {
    const a = k * 2.399963229728653;
    out.push([Math.cos(a), Math.sin(a)]);
  }
  return out;
}

/** Directions usable for a side test at a piece whose tangent is (rx, ry). A ray
 *  parallel to that tangent cannot tell the two sides apart - the crossing at the
 *  query point becomes a double root - so those are excluded up front. */
function rayDirections(rx: number, ry: number): (readonly [number, number])[] {
  const mag = Math.hypot(rx, ry);
  if (mag < 1e-12) return RAY_DIRS.slice();
  const out = RAY_DIRS.filter((d) => Math.abs(d[0] * ry - d[1] * rx) >= 0.25 * mag);
  return out.length ? out : RAY_DIRS.slice();
}

interface Cast {
  /** Winding contributed by curves that do not pass through the query point. */
  far: number;
  /** Signed count of the curves that DO, taken relative to the reference direction. */
  net: number;
  /** False when this direction hit a degeneracy another direction may avoid. */
  ok: boolean;
}

function reachFrom(idx: CurveIndex, px: number, py: number): number {
  const b = idx.box;
  if (!b) return 1;
  const diag = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
  const dx = Math.max(b.x0 - px, px - b.x1, 0), dy = Math.max(b.y0 - py, py - b.y1, 0);
  return 2 * (diag + Math.hypot(dx, dy)) + 1;
}

/**
 * One ray cast. `ref` non-null asks for the two-sided form: curves passing through the
 * query point are separated out as the "near bundle" instead of being counted, because
 * they are precisely the curves whose contribution differs between the two sides.
 */
function castRay(
  idx: CurveIndex, px: number, py: number, ux: number, uy: number,
  ref: { x: number; y: number } | null, near: number, budget: Budget, complete = false,
): Cast {
  const reach = reachFrom(idx, px, py);
  const qx = px + ux * reach, qy = py + uy * reach;
  const rx0 = Math.min(px, qx) - near, rx1 = Math.max(px, qx) + near;
  const ry0 = Math.min(py, qy) - near, ry1 = Math.max(py, qy) + near;
  const nx = -uy, ny = ux;
  // The ray's own origin sits ON the curve being classified, so its hit lands at exactly
  // u = 0 - and lands a couple of ULPS the wrong side of it once the coordinates are large.
  // At x ≈ 1e7 one ulp is 1.9e-9, so an absolute 1e-9 rejects that hit as off the end of
  // the ray, the curve vanishes from the count, the edge is classified 0/0 and deleted, and
  // the operation returns non-closed geometry. Two overlapping unit squares placed at 1e7
  // came back with half their area. The tolerance is a position, so it has to be measured
  // against the positions in play: 64 ulps of the largest coordinate the cast touches, and
  // never below the module's own same-point radius.
  const hitTol = Math.max(
    near,
    64 * Number.EPSILON * Math.max(Math.abs(px), Math.abs(py), Math.abs(qx), Math.abs(qy), 1),
  );
  let far = 0, net = 0, ok = true;

  for (const ic of idx.curves) {
    if (budget.work <= 0) return { far, net, ok: false };
    budget.work -= 1;
    const b = ic.box;
    if (b.x1 < rx0 || b.x0 > rx1 || b.y1 < ry0 || b.y0 > ry1) continue;
    const c = ic.c;
    // A curve lying ALONG the ray has an identically zero distance polynomial, so the
    // root solve reports nothing and the curve would silently vanish from the count.
    // Direction-dependent, so another direction fixes it.
    if (Math.abs(nx * (c[0] - px) + ny * (c[1] - py)) < near
     && Math.abs(nx * (c[2] - px) + ny * (c[3] - py)) < near
     && Math.abs(nx * (c[4] - px) + ny * (c[5] - py)) < near
     && Math.abs(nx * (c[6] - px) + ny * (c[7] - py)) < near) {
      ok = false;
      if (!complete) return { far, net, ok };
      continue;
    }

    budget.work -= 8;
    for (const hit of intersectLineCubic(px, py, qx, qy, c, hitTol)) {
      const t = hit.t2;
      const s = hit.t1 * reach;
      const tg = tangentAt(c, t);
      if (s <= near && ref) {
        // Through the query point. Which side it lands on is decided later from the
        // sign of (ray × reference); here only its direction relative to the reference
        // matters, which is the sign of the dot product - continuous in the angle, so a
        // bundle member that is merely SKEW to the reference (a split this operation
        // failed to make) still lands on the side it mostly lies on. Answering 0 there
        // would drop a real boundary through the query point, making both sides agree
        // and deleting the edge.
        net += Math.sign(tg.x * ref.x + tg.y * ref.y);
        continue;
      }
      const mag = Math.hypot(tg.x, tg.y);
      const cr = ux * tg.y - uy * tg.x;
      // Three degeneracies a rotated ray does avoid: a hit at a curve end would be counted
      // once per adjoining curve, a tangential graze has no side at all, and a hit just
      // outside the bundle radius cannot be told from one inside it.
      const sideless = mag < 1e-12 || Math.abs(cr) < 1e-6 * mag;
      if (sideless || t < T_GUARD || t > 1 - T_GUARD || (ref !== null && s <= near * 32)) {
        ok = false;
        if (!complete) return { far, net, ok };
        // A completing pass has no retry left, so each hit is counted on the only evidence
        // there is. A hit with no side at all cannot be, and is dropped. A shared vertex is
        // reported twice, at t≈1 on one adjoining curve and t≈0 on the other, so counting
        // only the t≈0 report counts the vertex exactly once rather than twice or never.
        if (sideless || t > 1 - T_GUARD) continue;
      }
      far += cr > 0 ? 1 : -1;
    }
  }
  return { far, net, ok };
}

/**
 * Winding number immediately left and immediately right of a point on a curve, without
 * moving the point.
 *
 * With g = ray × reference: a curve through the query point whose tangent agrees with
 * the reference contributes its crossing to the left side when g > 0 and to the right
 * side when g < 0, and a curve running the other way contributes with the opposite
 * sign. The two sides therefore always differ by the bundle's net direction count,
 * which is the exact statement of "crossing a boundary changes the winding by one".
 */
function sideWindings(
  idx: CurveIndex, px: number, py: number, rx: number, ry: number, near: number, budget: Budget,
): { left: number; right: number } {
  const dirs = rayDirections(rx, ry);
  const sidesOf = (d: readonly [number, number], cast: Cast) => {
    const g = d[0] * ry - d[1] * rx;
    return g > 0
      ? { left: cast.far + cast.net, right: cast.far }
      : { left: cast.far, right: cast.far - cast.net };
  };
  let last: { left: number; right: number } | null = null;
  for (const d of dirs) {
    const cast = castRay(idx, px, py, d[0], d[1], { x: rx, y: ry }, near, budget);
    if (cast.ok) return sidesOf(d, cast);
    last = sidesOf(d, cast);
    if (budget.work <= 0) return last;
  }
  // Every direction defeated. A cast that bails the moment it meets a degeneracy leaves
  // `far` a PREFIX SUM over however many curves it happened to visit first, which is not a
  // worse answer but no answer at all - the curves past the bail contribute nothing, so a
  // point deep inside a shape comes back outside it. One more cast then, forbidden to bail,
  // so the count is at least taken over the whole path.
  const d = dirs[0]!;
  const cast = castRay(idx, px, py, d[0], d[1], { x: rx, y: ry }, near, budget, true);
  return cast.ok || budget.work > 0 ? sidesOf(d, cast) : last ?? { left: 0, right: 0 };
}

// ── coincidence ───────────────────────────────────────────────────────────────

/**
 * Are two pieces the same curve, and do they run the same way?
 *
 * Degree three means a difference polynomial with four roots is identically zero, so
 * agreement at four parameters is a proof of identity rather than a sample of it - * which is why the parameters are fixed and there is no subdivision here. Returns 1 for
 * same direction, -1 for opposed, 0 for different curves.
 */
function coincidence(a: Cubic, b: Cubic, weld: number): 0 | 1 | -1 {
  let fwd = true, rev = true;
  for (const t of [0, 1 / 3, 2 / 3, 1]) {
    const p = evalCubic(a, t);
    if (fwd) {
      const q = evalCubic(b, t);
      if (Math.abs(p.x - q.x) > weld || Math.abs(p.y - q.y) > weld) fwd = false;
    }
    if (rev) {
      const q = evalCubic(b, 1 - t);
      if (Math.abs(p.x - q.x) > weld || Math.abs(p.y - q.y) > weld) rev = false;
    }
    if (!fwd && !rev) return 0;
  }
  return fwd ? 1 : -1;
}

/**
 * Do two curves share a stretch of BOUNDARY over the bracket a scatter of hits spans, or
 * do they merely touch inside it?
 *
 * This cannot be decided by how wide the bracket is. A tangency is a double root, and the
 * solver reports it as two roots a whisker apart - but how wide a whisker depends on the
 * curvature difference at the contact and on the root polish, and for two circles meeting
 * at a point it comes out at 7.7e-6 against a weld radius of 4e-6. Comparing the bracket's
 * extent to the weld radius is therefore a magnitude race, and losing it is not a rounding
 * error: the contact is called an overlap, `overlapSplits` finds no endpoint of either curve
 * on the other and cuts nothing, the tangency stays interior to a piece, and that piece is
 * then classified at the one parameter where the winding has no value. Two tangent circles
 * came back with every operator wrong by a whole lobe.
 *
 * What distinguishes the two cases is not size but analytic continuation. Sharing boundary
 * means agreeing on an INTERVAL, and two cubics that agree on an interval are the same cubic
 * - the affine map between their parameters that holds on the bracket holds everywhere. So
 * the bracket is used only to FIND that map, and the agreement is then tested across the
 * whole of `ci`, at the parameters of `cj` the map sends it to. A shared run passes, because
 * the map really is exact and extending it costs nothing. A tangency fails by an enormous
 * margin: its bracket is a millionth of the curve, so the map magnifies by a million and
 * asks about `cj` far outside its own domain, where two curves that merely kissed have long
 * since parted. Returns 1 for the same direction, -1 for opposed, 0 for different curves.
 */
function continuesAsSameCurve(
  ci: Cubic, a0: number, a1: number, cj: Cubic, b0: number, b1: number, weld: number,
): 0 | 1 | -1 {
  const da = a1 - a0, db = b1 - b0;
  if (!(da > 0) || !(db > 0)) return 0;
  for (const dir of [1, -1] as const) {
    let same = true;
    for (const t of [0, 1 / 3, 2 / 3, 1]) {
      const f = (t - a0) / da;
      const u = dir === 1 ? b0 + f * db : b1 - f * db;
      const p = evalCubic(ci, t), q = evalCubic(cj, u);
      // A wildly extrapolated parameter can overflow to a non-finite coordinate, and every
      // comparison against NaN is false - which would read as agreement.
      if (!Number.isFinite(q.x) || !Number.isFinite(q.y)
       || Math.abs(p.x - q.x) > weld || Math.abs(p.y - q.y) > weld) { same = false; break; }
    }
    if (same) return dir;
  }
  return 0;
}

/**
 * Decide overlapping material once.
 *
 * Where the two operands share a stretch of boundary there is no isolated crossing to
 * find, and the side test keeps BOTH copies whenever it keeps either - they describe
 * the same boundary from each path's point of view. So the survivors are matched up
 * afterwards by direction: two kept pieces running the same way are one edge and
 * collapse to a single copy (this is what makes a union keep one and an intersection
 * keep same-direction overlaps); two running opposite ways enclose nothing between them
 * and both go (which is what drops a shared edge from a difference and from an xor).
 *
 * ## Edges too short to have a direction
 *
 * The verdict above turns entirely on DIRECTION, and an edge shorter than the radius its
 * ends are known to has none. Both tests are run at the weld radius: `coincidence` asks
 * whether two edges agree to within it, and every endpoint in the edge set was placed by a
 * projection or a root solve that is only trustworthy to it. So for an edge whose whole
 * extent is a weld radius or two, "the same curve, running the other way" and "the same
 * curve, running the same way" are the same measurement, and the answer is whichever the
 * rounding fell out as. Such a pair is therefore left alone rather than resolved on a coin
 * toss.
 *
 * Leaving it alone is the safe way to be wrong, and the two directions are not symmetric
 * here. A duplicate weld-scale sliver that survives is a spur the walk steps over: it is
 * shorter than the radius `walkLoops` joins edges at, so both copies chain from and to the
 * same vertex and one of them is simply never taken. An annihilated sliver that was the only
 * link between a vertex and the rest of its curve is a BREAK, and the walk cannot step over
 * that: the chain dead-ends, everything past it is abandoned, and the abandoned part is not
 * a sliver - measured on a three-cubic self-crossing chain stroked at 4, deleting one
 * 1.0e-5-long edge cost an 87-unit lobe out of a 1047-unit outline and turned 3 contours
 * into 7. The lobe is not misplaced in that output, it is gone.
 *
 * This is the same trap `continuesAsSameCurve` was written for, in a different room: a
 * comparison at some tolerance says nothing about geometry the size of that tolerance, and
 * the way out is to notice when the evidence is vacuous rather than to tighten or loosen the
 * tolerance. The bar is two weld radii because an edge carries that uncertainty once at each
 * end; nothing here is being asked to resolve finer than the operands were given.
 */
function dedupeEdges(edges: Cubic[], weld: number): Cubic[] {
  const cell = Math.max(weld * 4, 1e-12);
  const buckets = new Map<string, number[]>();
  const mids = edges.map((e) => evalCubic(e, 0.5));
  // Precomputed because the guard below sits in the innermost loop, which is quadratic in a
  // bucket's occupancy.
  const spans = edges.map(extent);
  const dead = new Uint8Array(edges.length);
  for (let i = 0; i < edges.length; i++) {
    const m = mids[i]!;
    const key = `${Math.round(m.x / cell)},${Math.round(m.y / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i); else buckets.set(key, [i]);
  }
  for (let i = 0; i < edges.length; i++) {
    if (dead[i]) continue;
    const m = mids[i]!;
    const cx = Math.round(m.x / cell), cy = Math.round(m.y / cell);
    for (let ox = -1; ox <= 1 && !dead[i]; ox++) {
      for (let oy = -1; oy <= 1 && !dead[i]; oy++) {
        for (const j of buckets.get(`${cx + ox},${cy + oy}`) ?? []) {
          if (j <= i || dead[j]) continue;
          if (spans[i]! <= 2 * weld || spans[j]! <= 2 * weld) continue;
          const rel = coincidence(edges[i]!, edges[j]!, weld);
          if (rel === 0) continue;
          dead[j] = 1;
          if (rel === -1) { dead[i] = 1; break; }
        }
      }
    }
  }
  return edges.filter((_, i) => !dead[i]);
}

// ── walking the survivors into loops ──────────────────────────────────────────

/**
 * Chain the kept pieces back into closed contours by shared endpoints.
 *
 * At an ordinary crossing exactly one kept piece leaves each vertex, so the chain is
 * forced and no choice arises. Choices only appear where more than two boundary strands
 * meet - a shape touching itself at a point, or coincident material - and there the
 * next edge is the first one clockwise from the reverse of the incoming direction. That
 * is the standard face traversal for "keep the region on your left", and it is what
 * separates a self-touching outline into two loops instead of one loop that crosses
 * itself.
 */
function walkLoops(edges: Cubic[], weld: number): GeomPath {
  if (!edges.length) return [];
  const cell = Math.max(weld * 4, 1e-12);
  const key = (x: number, y: number) => `${Math.round(x / cell)},${Math.round(y / cell)}`;
  const buckets = new Map<string, number[]>();
  edges.forEach((e, i) => {
    const k = key(e[0], e[1]);
    const bucket = buckets.get(k);
    if (bucket) bucket.push(i); else buckets.set(k, [i]);
  });

  const used = new Uint8Array(edges.length);
  const out: GeomPath = [];

  const candidatesAt = (x: number, y: number): number[] => {
    const cx = Math.round(x / cell), cy = Math.round(y / cell);
    const found: number[] = [];
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (const i of buckets.get(`${cx + ox},${cy + oy}`) ?? []) {
          if (used[i]) continue;
          const e = edges[i]!;
          if (Math.hypot(e[0] - x, e[1] - y) <= weld) found.push(i);
        }
      }
    }
    return found;
  };

  for (let seed = 0; seed < edges.length; seed++) {
    if (used[seed]) continue;
    const curves: Cubic[] = [];
    const start = edges[seed]!;
    const sx = start[0], sy = start[1];
    let cur = seed;
    let joined = false;
    for (let guard = 0; guard <= edges.length; guard++) {
      used[cur] = 1;
      const e = edges[cur]!;
      curves.push(e);
      const ex = e[6], ey = e[7];
      if (Math.hypot(ex - sx, ey - sy) <= weld) { joined = true; break; }   // loop complete
      const options = candidatesAt(ex, ey);
      if (!options.length) break;                            // dead end: nothing continues
      cur = options.length === 1 ? options[0]! : pickTurn(edges, e, options);
    }
    if (!curves.length) continue;
    // A chain that came back to its start is a region and is emitted as one. A chain that
    // ran out of edges is not, and what to do with it depends on whether it still bounds
    // anything. One that nearly closed does: the classification lost an edge to numerical
    // trouble, and marking it closed leaves a hairline join, which is the least damaging
    // repair - inventing a straight edge across the gap is not.
    //
    // One that bounds no measurable area does not, and must be dropped here, because
    // nothing downstream can: `compactPath` asks whether a contour has bbox EXTENT, which a
    // sliver has, rather than whether it encloses area, which a sliver does not. A single
    // kept edge with no continuation would otherwise survive as a one-curve zero-area
    // subpath, and the count of those depends on the tolerance the operands were resolved
    // at, not on the operands - one stroked wiggle came back as 1 contour at one tolerance
    // and 21 at a finer one, the outline plus one sliver per input curve. Output complexity
    // has to follow the input's.
    if (!joined && Math.abs(contourArea({ curves, closed: true })) <= weld * chainSpan(curves)) continue;
    out.push({ curves, closed: true });
  }
  return out;
}

/** A length proxy for a chain: enough to turn the weld radius into an area, so the test
 *  that uses it scales with the geometry instead of fixing an absolute floor. */
function chainSpan(curves: Cubic[]): number {
  let s = 0;
  for (const k of curves) s += extent(k);
  return s;
}

/** First candidate clockwise from the reverse of the incoming direction. */
function pickTurn(edges: Cubic[], incoming: Cubic, options: number[]): number {
  const din = endTangent(incoming);
  const back = Math.atan2(-din.y, -din.x);
  let best = options[0]!, bestDelta = Infinity;
  for (const i of options) {
    const d = startTangent(edges[i]!);
    let delta = back - Math.atan2(d.y, d.x);
    delta -= Math.floor(delta / (Math.PI * 2)) * (Math.PI * 2);
    // Zero means turning straight back the way we came; that is a spur and is only
    // taken when nothing else is on offer.
    if (delta <= 1e-12) delta = Math.PI * 2;
    if (delta < bestDelta) { bestDelta = delta; best = i; }
  }
  return best;
}

function startTangent(c: Cubic): { x: number; y: number } {
  const t = tangentAt(c, 0);
  if (Math.hypot(t.x, t.y) > 1e-12) return t;
  return { x: c[6] - c[0], y: c[7] - c[1] };
}

function endTangent(c: Cubic): { x: number; y: number } {
  const t = tangentAt(c, 1);
  if (Math.hypot(t.x, t.y) > 1e-12) return t;
  return { x: c[6] - c[0], y: c[7] - c[1] };
}
