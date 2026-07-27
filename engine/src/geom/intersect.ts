// SPDX-License-Identifier: MPL-2.0
/**
 * Curve intersection — the operation every boolean, offset and stroke outline is
 * built on, and the one that decides whether the whole geometry layer is clean.
 *
 * ## Three cases, cheapest-exact first
 *
 * | pair | method | exactness |
 * |---|---|---|
 * | line × line | one determinant | exact |
 * | line × cubic | cubic root solve in the line's frame | exact to root-solver precision |
 * | cubic × cubic | fat-line (Bézier) clipping | converges quadratically to `tol` |
 *
 * A line is not a special case in the data model — it is a cubic with collinear
 * controls — so the dispatch is a geometric test rather than a type tag, and a curve
 * that happens to be straight gets the exact path automatically.
 *
 * ## Why fat-line clipping rather than subdivision
 *
 * The obvious approach is recursive bisection: split both curves, keep pairs whose
 * boxes overlap, stop when small. It converges LINEARLY, so pinning an intersection
 * to 1e-9 takes ~30 levels and 2^30 worst-case pairs. Fat-line clipping (Sederberg &
 * Nishita 1990) instead computes, in one step, the parameter interval of curve A that
 * could possibly lie within the "fat line" bounding curve B, and discards the rest.
 * It converges quadratically — usually 5–8 iterations to full double precision — and
 * it never approximates the curve, only brackets it. Bisection remains as the
 * fallback for the case clipping cannot make progress on (near-tangential contact,
 * where the fat line barely clips anything).
 *
 * ## What "clean" means in the output
 *
 * Results are parameters on the ORIGINAL curves. The point is then evaluated FROM the
 * curve, so it lies on it to machine precision rather than near it. Nothing here
 * flattens, samples, or rasterises.
 */
import {
  type Cubic, type Pt, evalCubic, splitCubic, subCubic, boundsCubic, hullBounds,
  boxesOverlap, isLineCubic, flatnessCubic,
} from './bezier.ts';

/** One intersection: where it is, and where it sits on each input. */
export interface Intersection {
  /** Parameter on the first curve, 0..1. */
  t1: number;
  /** Parameter on the second curve, 0..1. */
  t2: number;
  x: number;
  y: number;
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
 * Cardano for the cubic, with a Newton polish on each root. The polish matters more
 * than the formula: Cardano's trigonometric branch loses several digits for the
 * three-real-root case, and two Newton steps recover them at negligible cost.
 */
export function cubicRoots01(a: number, b: number, c: number, d: number): number[] {
  const out: number[] = [];
  const push = (t: number) => {
    if (t >= -T_EPS && t <= 1 + T_EPS) out.push(Math.min(1, Math.max(0, t)));
  };

  if (Math.abs(a) < 1e-12) {
    // Degenerates to a quadratic (or lower). Not a rare path: an axis-aligned line
    // against a curve with a symmetric control net hits it constantly.
    if (Math.abs(b) < 1e-12) {
      if (Math.abs(c) > 1e-12) push(-d / c);
      return dedupeRoots(out);
    }
    const disc = c * c - 4 * b * d;
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    push((-c + s) / (2 * b)); push((-c - s) / (2 * b));
    return dedupeRoots(out);
  }

  // Depressed cubic t = y - b/3a  ⇒  y³ + py + q = 0
  const b1 = b / a, c1 = c / a, d1 = d / a;
  const p = c1 - (b1 * b1) / 3;
  const q = (2 * b1 * b1 * b1) / 27 - (b1 * c1) / 3 + d1;
  const shift = -b1 / 3;
  const disc = (q * q) / 4 + (p * p * p) / 27;

  if (disc > 1e-18) {
    const s = Math.sqrt(disc);
    push(Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s) + shift);
  } else if (disc > -1e-18) {
    // Repeated root(s).
    const u = Math.cbrt(-q / 2);
    push(2 * u + shift); push(-u + shift);
  } else {
    // Three distinct real roots — the trigonometric form.
    const r = Math.sqrt(-(p * p * p) / 27);
    const phi = Math.acos(Math.min(1, Math.max(-1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    for (let k = 0; k < 3; k++) push(m * Math.cos((phi + 2 * Math.PI * k) / 3) + shift);
  }

  // Newton polish against the ORIGINAL coefficients.
  const polished = out.map((t0) => {
    let t = t0;
    for (let i = 0; i < 2; i++) {
      const f = ((a * t + b) * t + c) * t + d;
      const df = (3 * a * t + 2 * b) * t + c;
      if (Math.abs(df) < 1e-14) break;
      const next = t - f / df;
      if (next < -T_EPS || next > 1 + T_EPS) break;
      t = next;
    }
    return Math.min(1, Math.max(0, t));
  });
  return dedupeRoots(polished);
}

function dedupeRoots(ts: number[]): number[] {
  const s = ts.slice().sort((x, y) => x - y);
  const out: number[] = [];
  for (const t of s) if (!out.length || t - out[out.length - 1]! > 1e-9) out.push(t);
  return out;
}

/**
 * Line × cubic, exactly.
 *
 * Rewriting the cubic in the line's own frame turns "where do they meet" into "where
 * is the curve's signed distance to the line zero" — a scalar cubic in `t`, solved in
 * closed form. No iteration, no subdivision, and the roots are the true parameters.
 */
export function intersectLineCubic(
  x0: number, y0: number, x1: number, y1: number, c: Cubic, tol = EPS,
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
  for (const t of cubicRoots01(A, B, C, D)) {
    const p = evalCubic(c, t);
    // Where along the line does it land? Outside the segment is not an intersection.
    const u = ((p.x - x0) * dx + (p.y - y0) * dy) / (len * len);
    if (u < -tol / len || u > 1 + tol / len) continue;
    out.push({ t1: Math.min(1, Math.max(0, u)), t2: t, x: p.x, y: p.y });
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
 * contains every intersection — and usually discards most of the domain in one step.
 */
function clipToFatLine(c: Cubic, fat: NonNullable<ReturnType<typeof fatLine>>): [number, number] | null {
  const d = [
    fat.nx * c[0] + fat.ny * c[1] - fat.c0,
    fat.nx * c[2] + fat.ny * c[3] - fat.c0,
    fat.nx * c[4] + fat.ny * c[5] - fat.c0,
    fat.nx * c[6] + fat.ny * c[7] - fat.c0,
  ];
  const pts: Pt[] = d.map((v, i) => ({ x: i / 3, y: v }));

  // Convex hull of four points with monotonically increasing x — the upper and lower
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

  const inBand = (v: number) => v >= fat.dMin - 1e-12 && v <= fat.dMax + 1e-12;
  const ts: number[] = [];
  for (const h of [upper, lower]) { ts.push(...crossings(h, fat.dMin), ...crossings(h, fat.dMax)); }
  if (inBand(d[0]!)) ts.push(0);
  if (inBand(d[3]!)) ts.push(1);
  if (!ts.length) return null;                    // entirely outside the band
  const lo = Math.max(0, Math.min(...ts)), hi = Math.min(1, Math.max(...ts));
  return hi < lo ? null : [lo, hi];
}

/** Cubic × cubic, by alternating fat-line clips with bisection when a clip stalls. */
function clipIntersect(
  c1: Cubic, c2: Cubic, t1lo: number, t1hi: number, t2lo: number, t2hi: number,
  tol: number, depth: number, out: Intersection[], swap = false,
): void {
  // `swap` tracks whether c1/c2 are currently the caller's second/first curve. The
  // recursion exchanges them every step (that alternation is what makes the clipping
  // converge quadratically), and this flag puts the parameters back the right way
  // round on the way out — rather than the results being silently transposed.
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
  const clipped = fat ? clipToFatLine(c1, fat) : [0, 1] as [number, number];
  if (!clipped) return;
  const [lo, hi] = clipped;
  const shrink = hi - lo;

  // A clip that removes less than a fifth of the domain is not making progress —
  // the classic near-tangential case. Bisect the LONGER curve and recurse on both
  // halves; this is what keeps the worst case finite rather than spinning.
  if (shrink > 0.8) {
    if (s1 >= s2) {
      const [a, b] = splitCubic(c1, 0.5);
      const mid = (t1lo + t1hi) / 2;
      clipIntersect(a, c2, t1lo, mid, t2lo, t2hi, tol, depth + 1, out, swap);
      clipIntersect(b, c2, mid, t1hi, t2lo, t2hi, tol, depth + 1, out, swap);
    } else {
      const [a, b] = splitCubic(c2, 0.5);
      const mid = (t2lo + t2hi) / 2;
      clipIntersect(c1, a, t1lo, t1hi, t2lo, mid, tol, depth + 1, out, swap);
      clipIntersect(c1, b, t1lo, t1hi, mid, t2hi, tol, depth + 1, out, swap);
    }
    return;
  }

  const nc1 = subCubic(c1, lo, hi);
  const nt1lo = t1lo + (t1hi - t1lo) * lo;
  const nt1hi = t1lo + (t1hi - t1lo) * hi;
  // Roles exchange so the next iteration clips the other curve.
  clipIntersect(c2, nc1, t2lo, t2hi, nt1lo, nt1hi, tol, depth + 1, out, !swap);
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
 * controls are evenly spaced — and that equivalence is so convenient it is easy to
 * assume generally. It does not hold. `M0,0 C0,0 0,0 100,0` — handles resting on the
 * start point, which is what a pen tool with un-dragged handles and plenty of imported
 * SVG produce — is perfectly straight and grossly non-uniform: its midpoint is at
 * x=12.5, not 50. Handing the chord fraction back as `t` therefore reports a point that
 * is on the LINE but nowhere near the curve at that parameter, and since every consumer
 * splits with `subCubic(c, t)`, the split lands in the wrong place and the resulting
 * geometry does not close.
 *
 * So convert. The along-chord displacement is itself a cubic in `t` (Bernstein
 * coefficients are just the controls projected onto the chord), so this is the same
 * closed-form root solve as everything else here — exact, not a search.
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
 * controls are collinear IS a line and takes the exact algebraic path. What that path
 * returns is a fraction along the chord, which is NOT the curve's parameter unless the
 * controls happen to be evenly spaced — so it is converted back before it leaves here.
 * See `chordFractionToParam`; getting this wrong reports points tens of units off the
 * curve they claim to lie on.
 *
 * Overlapping (coincident) curves are reported as their two overlap endpoints rather
 * than as an infinity of points — enough for a boolean to split at, and honest about
 * there being no isolated crossing.
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
  clipIntersect(c1, c2, 0, 1, 0, 1, tol, 0, out);
  return dedupe(out, tol);
}
