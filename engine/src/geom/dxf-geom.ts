// SPDX-License-Identifier: MPL-2.0
/**
 * Plane geometry for the DXF importer: affine maps, the arbitrary-axis rule for entities that
 * sit in their own plane, arcs and bulges as cubic Beziers, and NURBS sampling.
 *
 * Everything here is pure and DOM-free. Curves stay curves: an affine map of a cubic's control
 * points is an affine map of the curve, so block insertion with any scale or rotation keeps arcs
 * exact. Only a rational or high-degree spline is sampled, because a cubic cannot hold it exactly.
 */
import type { PathSegment, SubPath } from '../svg-path.ts';

/** x' = a x + c y + e, y' = b x + d y + f. */
export type Mat = [a: number, b: number, c: number, d: number, e: number, f: number];
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** The map that applies `n` first, then `m`. */
export function matMul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export function matApply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
export function matTranslate(x: number, y: number): Mat { return [1, 0, 0, 1, x, y]; }
export function matScale(sx: number, sy: number): Mat { return [sx, 0, 0, sy, 0, 0]; }
export function matRotate(radians: number): Mat {
  const c = Math.cos(radians), s = Math.sin(radians);
  return [c, s, -s, c, 0, 0];
}

/**
 * The plane of an entity that has an extrusion direction (DXF "arbitrary axis algorithm"):
 * the 2x2 part of the map from the entity's own x and y to world x and y, and the world x and y
 * that one unit of its own z adds. Only the drawing's plan view matters here, so world z is dropped.
 */
export function planeOf(n: readonly [number, number, number] | undefined): { m: Mat; z: [number, number] } {
  if (!n) return { m: IDENTITY, z: [0, 0] };
  const len = Math.hypot(n[0], n[1], n[2]);
  if (!(len > 1e-12)) return { m: IDENTITY, z: [0, 0] };
  const nx = n[0] / len, ny = n[1] / len, nz = n[2] / len;
  // Ax = Y x N when N is near Z, else Z x N.
  let ax: number, ay: number, az: number;
  if (Math.abs(nx) < 1 / 64 && Math.abs(ny) < 1 / 64) { ax = nz; ay = 0; az = -nx; }
  else { ax = -ny; ay = nx; az = 0; }
  const al = Math.hypot(ax, ay, az) || 1;
  ax /= al; ay /= al; az /= al;
  // Ay = N x Ax
  const bx = ny * az - nz * ay, by = nz * ax - nx * az;
  return { m: [ax, ay, bx, by, 0, 0], z: [nx, ny] };
}

export function seg(op: 'M' | 'L', x: number, y: number): PathSegment { return { op, x, y }; }

/** Cubic segments for an elliptical arc: centre, radii, axis rotation, start angle and signed sweep (radians). */
export function arcSegments(cx: number, cy: number, rx: number, ry: number, rot: number, a0: number, sweep: number): PathSegment[] {
  const out: PathSegment[] = [];
  const parts = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
  const step = sweep / parts;
  const k = (4 / 3) * Math.tan(step / 4);
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const pt = (x: number, y: number): [number, number] => [cx + cr * x - sr * y, cy + sr * x + cr * y];
  for (let i = 0; i < parts; i++) {
    const s = a0 + step * i, e = s + step;
    const cs = Math.cos(s), sn = Math.sin(s), ce = Math.cos(e), se = Math.sin(e);
    const [x1, y1] = pt(rx * (cs - k * sn), ry * (sn + k * cs));
    const [x2, y2] = pt(rx * (ce + k * se), ry * (se - k * ce));
    const [x, y] = pt(rx * ce, ry * se);
    out.push({ op: 'C', x1, y1, x2, y2, x, y });
  }
  return out;
}

/** A polyline vertex (x, y) with the bulge of the segment that leaves that vertex. */
export interface BulgeVertex { x: number; y: number; bulge: number }

/** Segments from (x0, y0) to (x1, y1) for a DXF bulge (tan of a quarter of the included angle). */
export function bulgeSegments(x0: number, y0: number, x1: number, y1: number, bulge: number): PathSegment[] {
  const dx = x1 - x0, dy = y1 - y0, chord = Math.hypot(dx, dy);
  if (!Number.isFinite(bulge) || Math.abs(bulge) < 1e-9 || !(chord > 1e-12)) return [seg('L', x1, y1)];
  const theta = 4 * Math.atan(bulge);
  const d = (chord / 2) * (1 - bulge * bulge) / (2 * bulge);
  const mx = (x0 + x1) / 2 - (dy / chord) * d, my = (y0 + y1) / 2 + (dx / chord) * d;
  const r = Math.hypot(x0 - mx, y0 - my);
  const arc = arcSegments(mx, my, r, r, 0, Math.atan2(y0 - my, x0 - mx), theta);
  // Land exactly on the stated end point.
  const last = arc[arc.length - 1];
  if (last && last.op === 'C') { last.x = x1; last.y = y1; }
  return arc;
}

/** A polyline with bulges as one subpath. */
export function polylineSubPath(verts: readonly BulgeVertex[], closed: boolean): SubPath {
  const segments: PathSegment[] = [];
  const first = verts[0];
  if (!first) return { segments, closed };
  segments.push(seg('M', first.x, first.y));
  const count = closed ? verts.length : verts.length - 1;
  for (let i = 0; i < count; i++) {
    const a = verts[i]!, b = verts[(i + 1) % verts.length]!;
    if (closed && i === verts.length - 1 && Math.abs(a.bulge) < 1e-9) break;
    segments.push(...bulgeSegments(a.x, a.y, b.x, b.y, a.bulge));
  }
  return { segments, closed };
}

/** Apply a map to every point of a subpath. */
export function mapSubPath(sp: SubPath, m: Mat): SubPath {
  const segments = sp.segments.map((s): PathSegment => {
    if (s.op === 'C') {
      const [x1, y1] = matApply(m, s.x1, s.y1), [x2, y2] = matApply(m, s.x2, s.y2), [x, y] = matApply(m, s.x, s.y);
      return { op: 'C', x1, y1, x2, y2, x, y };
    }
    const [x, y] = matApply(m, s.x, s.y);
    return { op: s.op, x, y };
  });
  return { segments, closed: sp.closed };
}

/** Bounds of the segment end points and control points. */
export function subPathBounds(sp: SubPath): [number, number, number, number] | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const s of sp.segments) {
    add(s.x, s.y);
    if (s.op === 'C') { add(s.x1, s.y1); add(s.x2, s.y2); }
  }
  return x0 <= x1 ? [x0, y0, x1, y1] : null;
}

/** A uniform Catmull-Rom curve through the points, as cubics (open or closed). */
export function catmullRomSubPath(pts: ReadonlyArray<readonly [number, number]>, closed: boolean): SubPath {
  const n = pts.length;
  const segments: PathSegment[] = [];
  if (n < 2) return { segments, closed };
  segments.push(seg('M', pts[0]![0], pts[0]![1]));
  const at = (i: number) => pts[closed ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i))]!;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    segments.push({
      op: 'C',
      x1: p1[0] + (p2[0] - p0[0]) / 6, y1: p1[1] + (p2[1] - p0[1]) / 6,
      x2: p2[0] - (p3[0] - p1[0]) / 6, y2: p2[1] - (p3[1] - p1[1]) / 6,
      x: p2[0], y: p2[1],
    });
  }
  return { segments, closed };
}

export interface NurbsInput {
  degree: number;
  /** Control points with weights. */
  points: ReadonlyArray<readonly [number, number, number]>;
  knots: readonly number[];
}

/** Whether the knot vector and degree describe a usable curve for the control points. */
export function nurbsValid(s: NurbsInput): boolean {
  const n = s.points.length;
  if (!Number.isInteger(s.degree) || s.degree < 1 || s.degree > 10 || n < s.degree + 1) return false;
  if (s.knots.length !== n + s.degree + 1) return false;
  for (let i = 1; i < s.knots.length; i++) if (!(s.knots[i]! >= s.knots[i - 1]!)) return false;
  return s.knots[n]! > s.knots[s.degree]!;
}

/** Sample a rational B-spline into points. Throws nothing; returns [] for an invalid input. */
export function sampleNurbs(s: NurbsInput, samples: number): Array<[number, number]> {
  if (!nurbsValid(s)) return [];
  const p = s.degree, n = s.points.length, U = s.knots;
  const t0 = U[p]!, t1 = U[n]!;
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i === samples ? t1 : t0 + ((t1 - t0) * i) / samples;
    // Find the knot span with U[k] <= t < U[k+1].
    let k = p;
    while (k < n - 1 && t >= U[k + 1]!) k++;
    // de Boor in homogeneous coordinates.
    const d: Array<[number, number, number]> = [];
    for (let j = 0; j <= p; j++) {
      const c = s.points[k - p + j]!;
      const w = c[2] > 0 ? c[2] : 1;
      d.push([c[0] * w, c[1] * w, w]);
    }
    for (let r = 1; r <= p; r++) {
      for (let j = p; j >= r; j--) {
        const lo = U[k - p + j]!, hi = U[k + 1 + j - r]!;
        const a = hi - lo > 1e-14 ? (t - lo) / (hi - lo) : 0;
        const prev = d[j - 1]!, cur = d[j]!;
        d[j] = [(1 - a) * prev[0] + a * cur[0], (1 - a) * prev[1] + a * cur[1], (1 - a) * prev[2] + a * cur[2]];
      }
    }
    const last = d[p]!;
    if (!(last[2] > 1e-14)) continue;
    out.push([last[0] / last[2], last[1] / last[2]]);
  }
  return out;
}

export function polylineFromPoints(pts: ReadonlyArray<readonly [number, number]>, closed: boolean): SubPath {
  const segments: PathSegment[] = [];
  for (let i = 0; i < pts.length; i++) segments.push(seg(i === 0 ? 'M' : 'L', pts[i]![0], pts[i]![1]));
  return { segments, closed };
}
