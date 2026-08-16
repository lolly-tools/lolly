// SPDX-License-Identifier: MPL-2.0
/**
 * The path model the geometry operates on, and its conversions to and from the rest
 * of the engine.
 *
 * ## Why a second path type at all
 *
 * `svg-path.ts` already produces `SubPath[]`, and that is the right shape for a
 * *parser*: an M-led run of segments plus a `closed` flag, each segment carrying only
 * its endpoint because the previous one is implied. It is the wrong shape for
 * *geometry*, where every algorithm wants a curve it can pass directly to
 * `intersectCubics` without first reconstructing where it started. So a `Contour`
 * stores whole cubics: the same information, already joined up.
 *
 * The conversion is lossless in both directions for closed shapes, which is what
 * matters: a boolean's input comes from `parseSvgPath` and its output goes back out as
 * path data, and the round trip must not move a coordinate.
 *
 * ## Closed only, for the operators
 *
 * Booleans are defined on *regions*, and an open contour does not bound one. Open
 * contours are kept in the model (offsetting and stroking both need them: a stroked
 * open path is what Stage 4 exists for) but `booleanPath` closes anything it is given,
 * because otherwise it would silently discard geometry the caller passed in.
 */
import { type Cubic, evalCubic, boundsCubic, type Box, lineToCubic } from './bezier.ts';
import type { PathSegment, SubPath } from '../svg-path.ts';

/** A run of end-to-start connected cubics. `closed` means the last curve's endpoint
 * joins the first curve's start - implicitly, so a closing straight edge is NOT
 *  stored as a curve unless it was authored as one. */
export interface Contour {
  curves: Cubic[];
  closed: boolean;
}

/** A whole path: several contours, holes included. Which contours are holes is decided
 * by winding, not by ordering - see `pointInPath`. */
export type GeomPath = Contour[];

/** Positional tolerance for treating two coordinates as the same point. Deliberately
 *  looser than the intersector's root tolerance: this one answers "did the author mean
 *  these to join", which is a question about drawing, not about algebra. */
export const JOIN_EPS = 1e-7;

export function contourStart(c: Contour): { x: number; y: number } | null {
  const f = c.curves[0];
  return f ? { x: f[0], y: f[1] } : null;
}

export function contourEnd(c: Contour): { x: number; y: number } | null {
  const l = c.curves[c.curves.length - 1];
  return l ? { x: l[6], y: l[7] } : null;
}

/** Close a contour by appending the straight edge back to its start, if there is a
 *  real gap. Marking `closed` alone is enough for the operators (they treat the wrap
 *  as implicit), but an explicit edge is what an offset or a stroke needs to join. */
export function closeContour(c: Contour): Contour {
  const s = contourStart(c), e = contourEnd(c);
  if (!s || !e) return { curves: [...c.curves], closed: true };
  const gap = Math.hypot(e.x - s.x, e.y - s.y);
  if (gap <= JOIN_EPS) return { curves: [...c.curves], closed: true };
  return { curves: [...c.curves, lineToCubic(e.x, e.y, s.x, s.y)], closed: true };
}

/**
 * Signed area of a closed contour. Positive is counter-clockwise in a y-up frame -
 * which in SVG's y-down frame reads as clockwise on screen.
 *
 * Green's theorem, ∮(x dy − y dx)/2, integrated per curve in closed form: for a cubic
 * the integrand is degree 5 in `t` and the antiderivative is the expression below, so
 * this is exact and nothing is sampled.
 *
 * Written out here rather than assembled from `signedAreaCubic` plus each chord's
 * trapezoid. That decomposition is algebraically valid and was what this code used to
 * do, but `signedAreaCubic` returns the curve's bulge over its chord with the sign the
 * OTHER way round from the trapezoid it has to be added to, so the two terms subtract
 * instead of adding. A four-cubic circle of r=10 came back as 85.75 against a true
 * 314.25, and a two- or three-cubic circle (how most rounded shapes and glyph outlines
 * are actually drawn) came back NEGATIVE, which inverted every orientation decision
 * taken from it. Polygons did not show the bug, because a straight curve has no bulge.
 */
export function contourArea(c: Contour): number {
  let a = 0;
  for (const k of c.curves) {
    a += (k[0] * (6 * k[3] + 3 * k[5] + k[7])
        + k[2] * (-6 * k[1] + 3 * k[5] + 3 * k[7])
        + k[4] * (-3 * k[1] - 3 * k[3] + 6 * k[7])
        + k[6] * (-k[1] - 3 * k[3] - 6 * k[5])) / 20;
  }
  // The edge back to the start, whether or not it is stored as a curve: an area needs a
  // closed boundary, and on a contour that already meets itself this term is zero.
  const s = contourStart(c), e = contourEnd(c);
  if (s && e) a += (e.x * s.y - s.x * e.y) / 2;
  return a;
}

/** Reverse a contour's direction. Used to flip a hole, and by `difference`, which is
 *  an intersection with a reversed operand under the nonzero rule. */
export function reverseContour(c: Contour): Contour {
  const curves = c.curves
    .map((k) => [k[6], k[7], k[4], k[5], k[2], k[3], k[0], k[1]] as Cubic)
    .reverse();
  return { curves, closed: c.closed };
}

/** Force a contour to a given orientation, leaving it alone when it already matches. */
export function orientContour(c: Contour, counterClockwise: boolean): Contour {
  const ccw = contourArea(c) > 0;
  return ccw === counterClockwise ? c : reverseContour(c);
}

export function pathBounds(p: GeomPath): Box | null {
  let box: Box | null = null;
  for (const c of p) {
    for (const k of c.curves) {
      const b = boundsCubic(k);
      box = box ? {
        x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0),
        x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1),
      } : b;
    }
  }
  return box;
}

/** Drop contours with no curves, or whose curves are all degenerate points. */
export function compactPath(p: GeomPath): GeomPath {
  return p.filter((c) => c.curves.some((k) => {
    const b = boundsCubic(k);
    return b.x1 - b.x0 > JOIN_EPS || b.y1 - b.y0 > JOIN_EPS;
  }));
}

// ── conversions ───────────────────────────────────────────────────────────────

/** `SubPath[]` (what `parseSvgPath` returns) → contours of whole cubics. */
export function pathFromSubPaths(subs: SubPath[]): GeomPath {
  const out: GeomPath = [];
  for (const sub of subs) {
    const curves: Cubic[] = [];
    let cx = 0, cy = 0, started = false;
    for (const seg of sub.segments) {
      if (seg.op === 'M') { cx = seg.x; cy = seg.y; started = true; continue; }
      if (!started) { cx = 0; cy = 0; started = true; }
      if (seg.op === 'L') {
        curves.push(lineToCubic(cx, cy, seg.x, seg.y));
      } else {
        curves.push([cx, cy, seg.x1, seg.y1, seg.x2, seg.y2, seg.x, seg.y]);
      }
      cx = seg.x; cy = seg.y;
    }
    if (curves.length) out.push({ curves, closed: sub.closed });
  }
  return out;
}

/** Contours → `SubPath[]`, so geometry results can re-enter any existing sink
 *  (the PDF emitter, the EMF emitter) without a new code path. */
export function subPathsFromPath(p: GeomPath): SubPath[] {
  return p.map((c) => {
    const segments: PathSegment[] = [];
    const first = c.curves[0];
    if (!first) return { segments, closed: c.closed };
    segments.push({ op: 'M', x: first[0], y: first[1] });
    for (const k of c.curves) {
      segments.push({ op: 'C', x1: k[2], y1: k[3], x2: k[4], y2: k[5], x: k[6], y: k[7] });
    }
    return { segments, closed: c.closed };
  });
}

/** Round to a sane number of decimals without printing `1.2000000000000002`. */
function num(v: number, dp: number): string {
  const s = v.toFixed(dp);
  return s.replace(/\.?0+$/, '') || '0';
}

/**
 * Contours → SVG path data.
 *
 * Straight pieces are emitted as `L`, not as a cubic with collinear controls: it is the
 * same geometry, and writing four coordinates where two will do is the file bloat the
 * whole no-flattening premise exists to avoid.
 */
export function toSvgPathData(p: GeomPath, dp = 4): string {
  const parts: string[] = [];
  for (const c of p) {
    const first = c.curves[0];
    if (!first) continue;
    parts.push(`M${num(first[0], dp)} ${num(first[1], dp)}`);
    for (const k of c.curves) {
      if (isStraight(k)) {
        parts.push(`L${num(k[6], dp)} ${num(k[7], dp)}`);
      } else {
        parts.push(`C${num(k[2], dp)} ${num(k[3], dp)} ${num(k[4], dp)} ${num(k[5], dp)} ${num(k[6], dp)} ${num(k[7], dp)}`);
      }
    }
    if (c.closed) parts.push('Z');
  }
  return parts.join('');
}

/** Straight AND evenly parameterised - a curve can be geometrically straight while
 *  its controls bunch at one end, and collapsing that to an `L` would change how any
 *  later split lands on it. */
function isStraight(k: Cubic, tol = 1e-9): boolean {
  const dx = k[6] - k[0], dy = k[7] - k[1];
  const len = Math.hypot(dx, dy);
  if (len < tol) return false;
  for (const [px, py, want] of [[k[2], k[3], 1 / 3] as const, [k[4], k[5], 2 / 3] as const]) {
    const p = { x: k[0] + dx * want, y: k[1] + dy * want };
    if (Math.hypot(px - p.x, py - p.y) > tol * Math.max(1, len)) return false;
  }
  return true;
}

/** Point on a contour at (curve index, t) - the coordinate the geometry addresses
 *  everything by. */
export function contourPoint(c: Contour, index: number, t: number): { x: number; y: number } {
  const k = c.curves[Math.min(c.curves.length - 1, Math.max(0, index))]!;
  return evalCubic(k, t);
}
