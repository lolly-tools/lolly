// SPDX-License-Identifier: MPL-2.0
/**
 * The frame a path box is drawn in, fitted to its curve: one rule for the pen tool and
 * for every caller that writes a path row from absolute geometry (plan 291 W5).
 *
 * Moved unchanged from shells/web/src/views/free-canvas-pen.ts, which imports and
 * re-exports these names, so the pen tool and an agent's `$points`/`$d` agree about
 * where a path's frame is because they run the same function.
 *
 * Three coordinate spaces meet here:
 *   - BOX-LOCAL: pixels inside an unrotated box frame, `0..w` by `0..h`. This is the space
 *     the Design renderer lowers in (`pathHtmlFor` scales the stored fractions by the
 *     rounded `w`/`h`), so it is the space every fit has to agree with.
 *   - NORMALISED: the stored form, fractions of the frame, legally outside `[0,1]`.
 *     `scaleAuthored(p, 1 / w, 1 / h)` goes there and `scaleAuthored(p, w, h)` comes back.
 *   - ABSOLUTE: canvas pixels. `authoredFromSubPaths` keeps a parsed SVG `d` there, and
 *     `refitAuthoredFrame` against the identity frame turns it into a box.
 *
 * Pure and DOM-free: engine geometry only.
 */
import type { Cubic } from './bezier.ts';
import { type GeomPath, pathBounds } from './path.ts';
import {
  type AuthoredPath, type HyperbezierSolution, type Node,
  hyperbezierCubics, solveHyperbezier, toCubics,
} from './spline.ts';
import type { SubPath } from '../svg-path.ts';
import * as pmath from './portable-math.ts';

/** A path box's frame as the renderer sees it: the same rounding `boxCss` and
 *  `pathHtmlFor` apply (whole-pixel x/y, w/h of at least 1), plus its turn in degrees. */
export interface AuthoredFrame { x: number; y: number; w: number; h: number; rot: number }

/**
 * A refitted frame and the same contours re-expressed in it (still box-local px).
 *
 * `paths` is in the NEW frame's local space, so a caller normalises it against
 * `frame.w`/`frame.h` and writes `frame.x`/`y`/`w`/`h` alongside: the two halves are one
 * answer and using one without the other moves the shape.
 */
export interface AuthoredRefit { frame: AuthoredFrame; paths: AuthoredPath[] }

/** An authored path lowered to cubics, with the hyperbezier solution when there is one. */
export interface LoweredAuthored { cubics: Cubic[]; solution: HyperbezierSolution | null }

/**
 * Every node of a path scaled by `sx` on x and `sy` on y, handles included, because a
 * handle scales on the axis it points along. `scaleAuthored(p, w, h)` is stored
 * fractions to box-local px (what `pathHtmlFor` does term for term) and
 * `scaleAuthored(p, 1 / w, 1 / h)` is the way back.
 */
export function scaleAuthored(p: AuthoredPath, sx: number, sy: number): AuthoredPath {
  return { ...p, nodes: p.nodes.map((n) => scaleNode(n, sx, sy)) };
}

function scaleNode(n: Node, sx: number, sy: number): Node {
  const out: Node = { x: n.x * sx, y: n.y * sy };
  if (n.hInX !== undefined) out.hInX = n.hInX * sx;
  if (n.hInY !== undefined) out.hInY = n.hInY * sy;
  if (n.hOutX !== undefined) out.hOutX = n.hOutX * sx;
  if (n.hOutY !== undefined) out.hOutY = n.hOutY * sy;
  if (n.continuity !== undefined) out.continuity = n.continuity;
  return out;
}

/**
 * Lower an authored path to cubics, keeping the hyperbezier solution.
 *
 * `toCubics` takes a `warm` solution but discards the one it computes, which is exactly
 * wrong for a drag: re-converging a 40-node solve from the chord-bend guess on every
 * pointermove is an O(n) Newton run per frame, where reusing the previous frame's answer
 * converges in one or two steps. So this calls the two halves itself and hands the
 * solution back for the next frame.
 *
 * A kind that cannot be lowered returns no cubics rather than throwing: a pen tool that
 * renders nothing is recoverable, one that throws out of a pointermove is not.
 */
export function lowerAuthored(p: AuthoredPath, warm?: HyperbezierSolution | null): LoweredAuthored {
  if (p.nodes.length < 2) return { cubics: [], solution: null };
  if (p.kind === 'hyperbezier') {
    const solution = solveHyperbezier(p.nodes, p.closed, warm ?? undefined);
    return { cubics: hyperbezierCubics(p.nodes, p.closed, solution), solution };
  }
  try {
    return { cubics: toCubics(p), solution: null };
  } catch {
    return { cubics: [], solution: null };
  }
}

/**
 * Refit a path box's frame to its curve, keeping the RENDERED shape exactly where it is.
 *
 * ## The invariant
 *
 * The frame equals the LOWERED curve's tight bounding box, over EVERY contour. That is the
 * single claim the rest of the editor reads: selection chrome, marquee hit-testing,
 * align/distribute, group bounds and the export bbox all address `x`/`y`/`w`/`h`, and the
 * renderer sizes the shape's viewBox from the frame. So a frame that is too small clips the curve
 * and a frame that is too big makes every one of those features address empty space.
 *
 * `pathBounds` is the TIGHT bbox, taken from the derivative's roots, and that is
 * deliberate: a smooth node's handle legitimately sits outside the frame without the
 * curve following it there, so fitting the CONTROL HULL instead would make every curved
 * shape's box visibly too big. Handles outside `[0,1]` stay legal; the curve never leaves the frame.
 *
 * ## Rotation
 *
 * `w`/`h` describe the UNROTATED frame and `rot` spins it about its own centre, so changing
 * `w`/`h` moves the centre of rotation and a naive refit makes a rotated shape jump. The
 * compensation is exact: with `R` the rotation, `c`/`c'` the old/new half-sizes and `b` the
 * bbox origin in old local px, the new frame origin is
 *
 *     (x', y') = (x, y) + (I - R)(c - c') + R b
 *
 * which is "solve `localToFrame(fr, l) === localToFrame(fr', l - b)` for `fr'`".
 *
 * ## Rounding, and why the offset is solved rather than assumed
 *
 * The renderer rounds `x`/`y` and forces `w`/`h` to `Math.max(1, round(v))`, so it reads a
 * rounded frame and normalising against the unrounded bbox would be off by up to half a
 * pixel per side. Since a refit runs on EVERY edit, that error would accumulate. So the
 * frame is rounded FIRST and the local offset is then back-solved from the rounded
 * numbers: the shape is unmoved to floating point regardless of how the rounding fell,
 * and the only residue left is the wire format's six decimals of a fraction. The frame is
 * consequently tight to within half a pixel, and the second refit of an unchanged shape
 * is a fixed point.
 *
 * ## A degenerate axis
 *
 * A straight horizontal line has a zero-height bbox, as does any all-collinear path.
 * `w`/`h` clamp up to 1 (the renderer divides by them), and on such an axis the curve is
 * CENTRED in the pixel it was given rather than pinned to the frame's leading edge. No
 * division by an extent ever happens, so a degenerate axis cannot produce a `NaN`.
 *
 * Returns null when there is no curve to fit (fewer than two nodes, an unlowerable kind,
 * a non-finite bound): the caller's answer to that is to leave the frame alone.
 */
export function refitAuthoredFrame(paths: AuthoredPath[], fr: AuthoredFrame, warm?: HyperbezierSolution | null): AuthoredRefit | null {
  const geom: GeomPath = [];
  for (let i = 0; i < paths.length; i++) {
    // Only the first contour is the one being edited, so it is the only one the warm start
    // belongs to; handing a 40-node solution to a 4-node hole would be worse than nothing.
    const low = lowerAuthored(paths[i]!, i === 0 ? warm : null);
    if (low.cubics.length) geom.push({ curves: low.cubics, closed: paths[i]!.closed });
  }
  if (!geom.length) return null;
  const bb = pathBounds(geom);
  if (!bb || ![bb.x0, bb.y0, bb.x1, bb.y1].every((v) => Number.isFinite(v))) return null;

  const ew = bb.x1 - bb.x0, eh = bb.y1 - bb.y0;
  const w = Math.max(1, Math.round(ew));
  const h = Math.max(1, Math.round(eh));
  // The bbox origin's offset inside the new frame: zero, except on an axis whose
  // extent is under a pixel and was therefore clamped up to 1 (see the degenerate note).
  const ox = ew < 1 ? (w - ew) / 2 : 0;
  const oy = eh < 1 ? (h - eh) / 2 : 0;
  const bx = bb.x0 - ox, by = bb.y0 - oy;

  const r = (fr.rot * Math.PI) / 180;
  const cs = fr.rot ? pmath.cos(r) : 1, sn = fr.rot ? pmath.sin(r) : 0;
  // (I - R)(c - c'): how far the centre of rotation travels when the frame resizes.
  const kx = fr.w / 2 - w / 2, ky = fr.h / 2 - h / 2;
  const gx = kx - (kx * cs - ky * sn), gy = ky - (kx * sn + ky * cs);
  const x = Math.round(fr.x + gx + (bx * cs - by * sn));
  const y = Math.round(fr.y + gy + (bx * sn + by * cs));
  // The offset the ROUNDED frame actually implies, with R inverse = [[c, s], [-s, c]].
  const vx = x - fr.x - gx, vy = y - fr.y - gy;
  const offX = vx * cs + vy * sn;
  const offY = -vx * sn + vy * cs;

  return {
    frame: { x, y, w, h, rot: fr.rot },
    // Handles are OFFSETS from their node, so a frame translation never touches one.
    paths: paths.map((p) => ({ ...p, nodes: p.nodes.map((n) => ({ ...n, x: n.x - offX, y: n.y - offY })) })),
  };
}

/** Two coordinates closer than this are one point when a closed subpath repeats its start. */
const SAME_POINT = 1e-9;

/**
 * Parsed SVG subpaths (`parseSvgPath`, absolute px) to authored paths, still in absolute px.
 *
 * A subpath of only straight segments becomes kind `line`, which stores no handles; any
 * curve makes the whole subpath kind `cubic`, with handles only on its `C` segments (a
 * straight segment inside it keeps none, so it stays straight and stores nothing). A
 * closed subpath that repeats its start before `Z` has that last node collapsed into the
 * first, carrying its incoming handle, because `Z` adds no segment of its own and the
 * repeat would otherwise be a zero-length edge and a duplicate node. The repeat stays when
 * collapsing it would leave two nodes, because a closed two-node path draws no closing
 * segment and its curve would be lost. Subpaths that end up
 * with fewer than two nodes are dropped.
 */
export function authoredFromSubPaths(subs: SubPath[]): AuthoredPath[] {
  const out: AuthoredPath[] = [];
  for (const sub of subs) {
    const first = sub.segments[0];
    if (first?.op !== 'M') continue;
    const rest = sub.segments.slice(1);
    const allLines = rest.every((s) => s.op !== 'C');
    const nodes: Node[] = [{ x: first.x, y: first.y }];
    for (const seg of rest) {
      const prev = nodes[nodes.length - 1]!;
      if (seg.op === 'C') {
        const oX = seg.x1 - prev.x, oY = seg.y1 - prev.y;
        const iX = seg.x2 - seg.x, iY = seg.y2 - seg.y;
        if (oX || oY) { prev.hOutX = oX; prev.hOutY = oY; }
        const n: Node = { x: seg.x, y: seg.y };
        if (iX || iY) { n.hInX = iX; n.hInY = iY; }
        nodes.push(n);
      } else {
        nodes.push({ x: seg.x, y: seg.y });
      }
    }
    const last = nodes[nodes.length - 1]!;
    const head = nodes[0]!;
    // Collapse only when three nodes remain: the closing segment is then the wrap from the
    // last node to the first, which spline.ts draws only for three or more nodes. With
    // two left (a leaf, a D shape, a two-arc loop) the wrap and its curve would be lost.
    if (sub.closed && nodes.length > 3 && Math.abs(last.x - head.x) < SAME_POINT && Math.abs(last.y - head.y) < SAME_POINT) {
      nodes.pop();
      if (last.hInX !== undefined) { head.hInX = last.hInX; head.hInY = last.hInY; }
    }
    if (nodes.length >= 2) out.push({ kind: allLines ? 'line' : 'cubic', closed: sub.closed, nodes });
  }
  return out;
}
