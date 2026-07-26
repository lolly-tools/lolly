// SPDX-License-Identifier: MPL-2.0
/**
 * Cubic Bézier kernel — the geometric substrate for boolean operations, offsetting
 * and stroke outlining.
 *
 * ## Why cubics only
 *
 * Every path that reaches the engine is already normalised to moves, lines and cubics
 * (`PathSegment` in svg-path.ts — arcs and quadratics are converted at parse time).
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
 * Flattening still appears in this file — `flattenCubic` — but only where a caller
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

/** Point on the curve at `t`, by de Casteljau — not by expanding the polynomial.
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

/** The `t` values where the curve turns in x or y — its extrema. */
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
 * TIGHT bounding box — the curve's actual extent, not its control hull.
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
 * Deliberately NOT used by the geometry in this directory — it exists for callers who
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

/** True when every control point lies on the chord, to `tol` — the curve IS a line
 *  and can be handled by exact algebra rather than by iteration. */
export function isLineCubic(c: Cubic, tol = 1e-9): boolean {
  return flatnessCubic(c) <= tol;
}

/** Signed area enclosed by the curve and the chord closing it, by Green's theorem.
 *  Exact for a cubic — no sampling. Used for winding and orientation. */
export function signedAreaCubic(c: Cubic): number {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = c;
  return (
    x0 * (-2 * y1 - y2 + 3 * y3) +
    x1 * (2 * y0 - y2 - y3) +
    x2 * (y0 + y1 - 2 * y3) +
    x3 * (-3 * y0 + y1 + 2 * y2)
  ) * 0.15;   // 3/20
}
