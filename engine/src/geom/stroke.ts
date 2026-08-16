// SPDX-License-Identifier: MPL-2.0
/**
 * Stroke outlining: the region a stroked path paints, expressed as a fillable path.
 *
 * ## A stroke is one sweep down each side
 *
 * The core idea: the boundary of a stroke is the centreline pushed w/2 to one side,
 * plus the centreline pushed w/2 to the other. Both sides are reached the same way, by
 * REVERSING the contour rather than by negating the distance: `+w/2` to the left of
 * travel, twice. Everything else in this file is bookkeeping on top of that. The only
 * difference between the closed and open cases is what closes the two sides into a
 * loop: nothing (they are already loops), or the caps.
 *
 * Reversal is used instead of a negative distance because `offsetContour` answers a
 * signed distance on a CLOSED contour by deciding outward vs. inward, and that decision
 * is taken from the contour's signed area. That quantity means nothing on a centreline
 * that crosses itself, where there is no inside to be outward of. A stroke never needs
 * that decision: left of travel is a local property and is always defined, and
 * reversing the contour puts the second sweep on the other side, already running the
 * right way to carry the opposite winding. Under the nonzero rule, the band between the
 * two then fills and the middle does not.
 *
 * So the closed case uses `offsetSweep`, which is the raw trace with no region decided,
 * and the open case uses `offsetContour` on an open contour, where a positive distance
 * already means left of travel and no decision is taken either. Joins land on the outer
 * side of every turn, which is the side a join belongs on. The inner side's
 * self-crossing loops are left for the boolean pass, whose job is to remove exactly
 * those.
 *
 * ## Then selfUnion, unconditionally
 *
 * A stroke can self-overlap for three separate reasons: the path crosses itself, w/2
 * exceeds the local radius of curvature (the inner offset folds through itself), or two
 * subpaths' strokes touch. All three only come out as one clean outline after a boolean
 * cleanup, so the pass runs regardless of whether any of them is detected. It is also
 * the step that turns the two sweeps' winding into a region, which is why neither sweep
 * is allowed to decide that on its own: the two have to be added together before either
 * can be judged.
 *
 * ## Then one more check, because the winding alone is not enough
 *
 * Adding the two sweeps assumes a fold REVERSES the folded sweep's handedness, so that
 * where the inner offset turns through itself, its winding cancels the material it
 * wrongly covers. That is true for a corner and false for a curve: the inward sweep of
 * a circle of r=50 at w/2=51 comes back as a circle of radius 1 running the SAME way
 * round, so it cancels the outer sweep instead of itself, and punches a hole through
 * paint that must be solid. An over-wide stroke on a circle came back as an annulus. A
 * square of the same proportions was correct, which is why the bug survived a test
 * suite.
 *
 * The fix is not another winding argument. A stroke paints exactly the points within
 * w/2 of the centreline, so `keptContours` checks that directly: it runs
 * `nearestOnCubic` against the centreline curves, on either side of each resolved
 * contour, and drops any contour with paint on BOTH sides, since that is what a hole
 * through solid paint looks like. Mitres, square caps, and round joins reach past w/2
 * by design, so the verdict is taken from the first probe that finds a boundary at all,
 * not from any single probe.
 *
 * ## Sign convention
 *
 * Same as offset.ts, unchanged: a positive distance goes to the LEFT of the direction
 * of travel on a single curve, on an open contour, and in `offsetSweep`; it means
 * OUTWARD in `offsetContour` on a closed contour. Those are not the same rule (the left
 * of a counter-clockwise loop is its interior, not its outside), and this file only
 * ever uses the first one.
 *
 * Nothing here samples a curve. The only curves this module creates are the cap arcs,
 * and those are circular arcs written directly as cubics.
 */
import { type Cubic, type Pt, lineToCubic } from './bezier.ts';
import { type Contour, type GeomPath, JOIN_EPS, closeContour, pathBounds, reverseContour } from './path.ts';
import {
  type JoinStyle, type OffsetOptions, distanceToPath, offsetContour, offsetSweep, regionProber,
} from './offset.ts';
import { selfUnion } from './boolean.ts';

export type CapStyle = 'butt' | 'round' | 'square';

export interface StrokeOptions {
  cap?: CapStyle;
  join?: JoinStyle;
  miterLimit?: number;
  /** How closely the offset curves must follow the true offset. This is a FITTING
   *  error, not a positional tolerance, so it is passed to the offsetter and not to the
   * boolean pass - "draw me a coarser outline" and "treat points this far apart as the
   *  same point" are different requests, and feeding a fit tolerance to a boolean as if
   *  it were the second one collapses genuine intersections. */
  tol?: number;
}

/**
 * Outline of `p` stroked at `width`, as a path that fills to the same region under the
 * nonzero rule.
 *
 * Zero, negative and NaN widths paint nothing and return an empty path.
 */
export function strokeToPath(p: GeomPath, width: number, opts: StrokeOptions = {}): GeomPath {
  if (!(width > 0)) return [];
  const r = width / 2;
  const cap = opts.cap ?? 'butt';
  // SVG's defaults, pinned here rather than left to whatever the offsetter defaults to:
  // this function's job is to reproduce what a renderer would have painted from the
  // same declaration, so the declaration's defaults are part of the contract.
  const off: OffsetOptions = { join: opts.join ?? 'miter', miterLimit: opts.miterLimit ?? 4, tol: opts.tol };

  const raw: GeomPath = [];
  for (const c of p) {
    if (!c.curves.length) continue;
    if (isPoint(c)) {
      const dot = dotContour(c, r, cap);
      if (dot) raw.push(dot);
      continue;
    }
    if (c.closed) raw.push(...ring(c, r, off));
    else {
      const outline = openOutline(c, r, cap, off);
      if (outline) raw.push(outline);
    }
  }
  if (!raw.length) return [];

  // One pass over every contour rather than one per contour: a stroke is painted as a
  // single region, so where two subpaths' strokes cross each other the outline has to
  // merge there too, and that is only visible to a boolean that can see both.
  //
  // Nonzero is not a default being accepted, it is the rule the ring is built for. Under
  // evenodd the band between the two offsets of a closed contour still fills, but every
  // place a stroke crosses itself would punch a hole instead of merging.
  return keptContours(selfUnion(raw, { fillRule: 'nonzero' }), p, r);
}

/**
 * Drop the contours that bound nothing: the holes a folded inner sweep opens through
 * solid paint.
 *
 * Each contour of a resolved path separates two faces, and `selfUnion` orients it with
 * the filled face on its left. That is a claim about the winding of the sweeps, and it
 * is wrong wherever the inner sweep folded. Whether paint belongs at a point is not a
 * claim about winding, it is the distance to the centreline. So each contour is checked
 * on both sides: paint on one side only is a genuine boundary, paint on both sides is a
 * hole that must not be there, and paint on neither side means the probe landed inside a
 * mitre or a cap, which reach past w/2 by design, so that probe decides nothing and the
 * next candidate is tried.
 *
 * Dropping the contour is enough to close the hole. The material was never missing from
 * the output, only from the winding: the outer boundary is still there and still
 * oriented with its interior on the left, so a stroke wider than the shape comes back
 * as the solid blob it paints.
 */
function keptContours(resolved: GeomPath, centreline: GeomPath, r: number): GeomPath {
  if (resolved.length < 2) return resolved;
  const src = centreline
    .filter((c) => c.curves.length)
    .map((c) => (c.closed ? closeContour(c) : c));
  if (!src.length) return resolved;
  // Nothing is added to w/2 beyond a rounding guard, and the fitting tolerance in
  // particular is not added: a probe stands half a face-thickness off the boundary, so
  // on a hole narrower than that tolerance a generous comparison would read both sides
  // as painted and erase a hole that belongs there. A probe misread the other way is
  // harmless: it makes the pair agree, which decides nothing, and the next candidate is
  // tried.
  const paint = (p: Pt): boolean => distanceToPath(src, p.x, p.y) <= r * (1 + 1e-9);
  const probes = regionProber(resolved);
  return resolved.filter((c) => {
    for (const probe of probes(c)) {
      const left = paint(probe.left), right = paint(probe.right);
      if (left !== right) return true;
      if (left && right) return false;
    }
    return true;
  });
}

// ── the two contour cases ─────────────────────────────────────────────────────

/** A closed contour's stroke: the raw sweep down one side, plus the raw sweep down the
 *  other, reached by reversing the contour rather than by negating the distance.
 *
 *  Reversing is what gives the two loops opposite winding, which is what makes the
 *  middle a hole rather than a filled blob, and it is also the only form that survives
 *  a centreline crossing itself. Asking for `+r` and `−r` instead would be asking
 *  `offsetContour` which side is out, and a self-crossing loop has no answer to that:
 *  the sign would be taken from a signed area that means nothing, and material would go
 *  missing wherever the guess was wrong. Left of travel is a local property and is
 *  always defined. */
function ring(c: Contour, r: number, off: OffsetOptions): GeomPath {
  // The wrap from last point back to first has to be a real edge before it can be
  // offset. `closed` alone is implicit, and an implicit edge has no side to push out.
  const cc = closeContour(c);
  const out: GeomPath = [];
  for (const side of [cc, reverseContour(cc)]) {
    const sweep = offsetSweep(side, r, off);
    if (sweep) out.push(sweep);
  }
  return out;
}

/** An open contour's stroke: forward side, end cap, return side, start cap - one closed
 *  contour, with each cap joining the exact endpoints the offsetter produced so the
 *  result has no gap for the boolean pass to trip over. */
function openOutline(c: Contour, r: number, cap: CapStyle, off: OffsetOptions): Contour | null {
  const fwd = offsetSide(c, r, off);
  const back = offsetSide(reverseContour(c), r, off);
  if (!fwd.length || !back.length) return null;
  const ahead = endDirection(c);
  const behind = startDirection(c);
  if (!ahead || !behind) return null;

  const curves = [
    ...fwd,
    ...capCurves(endPoint(fwd), startPoint(back), ahead, cap),
    ...back,
    // Arriving back at the start, the direction of travel is against the contour.
    ...capCurves(endPoint(back), startPoint(fwd), { x: -behind.x, y: -behind.y }, cap),
  ];
  return { curves, closed: true };
}

/** One side of the stroke, as a single run of curves.
 *
 *  `offsetContour` returns a `GeomPath` because a closed offset can break into several
 * contours. An open one cannot - it has two ends and no way to shed a piece between
 * them - and the pieces come back in travel order, so concatenating them is the whole
 *  of the join. */
function offsetSide(c: Contour, distance: number, off: OffsetOptions): Cubic[] {
  const out: Cubic[] = [];
  for (const part of offsetContour(c, distance, off)) out.push(...part.curves);
  return out;
}

// ── caps ──────────────────────────────────────────────────────────────────────

/**
 * The edge that closes one end of an open stroke, running from `from` (where the
 * outgoing side stopped) across to `to` (where the returning side starts).
 *
 * `dir` is the direction of travel at that end of the contour, and is what tells a
 * round or square cap which way to bulge - in front of the end point rather than back
 * over the stroke it just came along. The cap's radius is taken from the two points
 * themselves rather than from w/2, so the cap meets them exactly even if the offsetter
 * landed a hair off.
 */
function capCurves(from: Pt, to: Pt, dir: Pt, cap: CapStyle): Cubic[] {
  if (cap === 'round') return halfCircle(from, to, dir);
  if (cap === 'square') {
    const r = Math.hypot(to.x - from.x, to.y - from.y) / 2;
    const ex = dir.x * r, ey = dir.y * r;
    const a = { x: from.x + ex, y: from.y + ey };
    const b = { x: to.x + ex, y: to.y + ey };
    return [
      lineToCubic(from.x, from.y, a.x, a.y),
      lineToCubic(a.x, a.y, b.x, b.y),
      lineToCubic(b.x, b.y, to.x, to.y),
    ];
  }
  return [lineToCubic(from.x, from.y, to.x, to.y)];
}

/** Half a circle from `from` to its antipode `to`, bulging towards `dir`. */
function halfCircle(from: Pt, to: Pt, dir: Pt): Cubic[] {
  const cx = (from.x + to.x) / 2, cy = (from.y + to.y) / 2;
  const ux = from.x - cx, uy = from.y - cy;
  const r = Math.hypot(ux, uy);
  if (r < JOIN_EPS) return [lineToCubic(from.x, from.y, to.x, to.y)];
  const ax = ux / r, ay = uy / r;
  // Perpendicular to the cap's diameter. Two of them face opposite ways and both give a
  // valid semicircle; the travel direction picks the one in front of the end point.
  let mx = ay, my = -ax;
  if (mx * dir.x + my * dir.y < 0) { mx = -mx; my = -my; }
  const arcs = [
    quarterArc(cx, cy, r, ax, ay, mx, my),
    quarterArc(cx, cy, r, mx, my, -ax, -ay),
  ];
  // The antipode is `to` up to rounding on the midpoint; writing it back makes the
  // assembled contour exactly closed rather than closed to within an ulp, which is one
  // less near-coincident endpoint for the boolean pass to have to reason about.
  const last = arcs[arcs.length - 1]!;
  last[6] = to.x; last[7] = to.y;
  return arcs;
}

/** 4/3·(√2−1): the control-handle length that fits a quarter circle to fourth order.
 *  Its radial error peaks at 2.7e-4·r, and more to the point it is the same
 *  approximation every font and drawing tool already ships, so a cap drawn here matches
 *  one drawn anywhere else rather than being subtly rounder. */
const KAPPA = 0.5522847498307936;

/** Quarter circle about (cx,cy) from the unit direction `a` to the perpendicular unit
 *  direction `b`. Parameterising as a·cos θ + b·sin θ makes the sense of the sweep a
 *  property of the arguments, so the same helper draws either way round. */
function quarterArc(cx: number, cy: number, r: number, ax: number, ay: number, bx: number, by: number): Cubic {
  const p0x = cx + r * ax, p0y = cy + r * ay;
  const p3x = cx + r * bx, p3y = cy + r * by;
  return [
    p0x, p0y,
    p0x + KAPPA * r * bx, p0y + KAPPA * r * by,
    p3x + KAPPA * r * ax, p3y + KAPPA * r * ay,
    p3x, p3y,
  ];
}

// ── degenerate contours ───────────────────────────────────────────────────────

/** A contour with no extent: a lone moveto, or a run of coincident points. It has no
 * direction, so it cannot be offset at all - the SVG spec makes it a separate case
 *  rather than a limit of the general one, and so does this file. */
function isPoint(c: Contour): boolean {
  const b = pathBounds([c]);
  return !b || (b.x1 - b.x0 <= JOIN_EPS && b.y1 - b.y0 <= JOIN_EPS);
}

/** What a zero-length subpath paints: nothing under a butt cap, since a butt cap has no
 *  extent along a direction that does not exist. Round and square caps still have their
 *  own shape and are drawn as one. */
function dotContour(c: Contour, r: number, cap: CapStyle): Contour | null {
  if (cap === 'butt') return null;
  const k = c.curves[0];
  if (!k) return null;
  const x = k[0], y = k[1];
  if (cap === 'square') {
    // Axis-aligned: there is no travel direction to orient it by, which is also why
    // every renderer draws this one axis-aligned.
    return {
      curves: [
        lineToCubic(x - r, y - r, x + r, y - r),
        lineToCubic(x + r, y - r, x + r, y + r),
        lineToCubic(x + r, y + r, x - r, y + r),
        lineToCubic(x - r, y + r, x - r, y - r),
      ],
      closed: true,
    };
  }
  return {
    curves: [
      quarterArc(x, y, r, 1, 0, 0, 1),
      quarterArc(x, y, r, 0, 1, -1, 0),
      quarterArc(x, y, r, -1, 0, 0, -1),
      quarterArc(x, y, r, 0, -1, 1, 0),
    ],
    closed: true,
  };
}

// ── direction and endpoints ───────────────────────────────────────────────────

function unit(x: number, y: number): Pt | null {
  const l = Math.hypot(x, y);
  return l < 1e-12 ? null : { x: x / l, y: y / l };
}

/** Direction of travel at the end of a contour.
 *
 *  Not `tangentAt(k, 1)`: a cubic's derivative vanishes when its last two control points
 *  coincide, which is routine in authored data and would leave a cap pointing nowhere.
 *  Walking down the control polygon, then back through earlier curves, always finds the
 *  direction as long as the contour has any extent at all. */
function endDirection(c: Contour): Pt | null {
  for (let i = c.curves.length - 1; i >= 0; i--) {
    const k = c.curves[i]!;
    const d = unit(k[6] - k[4], k[7] - k[5]) ?? unit(k[6] - k[2], k[7] - k[3]) ?? unit(k[6] - k[0], k[7] - k[1]);
    if (d) return d;
  }
  return null;
}

function startDirection(c: Contour): Pt | null {
  for (const k of c.curves) {
    const d = unit(k[2] - k[0], k[3] - k[1]) ?? unit(k[4] - k[0], k[5] - k[1]) ?? unit(k[6] - k[0], k[7] - k[1]);
    if (d) return d;
  }
  return null;
}

function startPoint(curves: Cubic[]): Pt {
  const k = curves[0]!;
  return { x: k[0], y: k[1] };
}

function endPoint(curves: Cubic[]): Pt {
  const k = curves[curves.length - 1]!;
  return { x: k[6], y: k[7] };
}
