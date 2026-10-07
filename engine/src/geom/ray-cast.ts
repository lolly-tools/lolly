// SPDX-License-Identifier: MPL-2.0
/** Ordered cubic ray casting with twin classification and exact work handoffs. */
import { type Box, type Cubic, tangentAt } from './bezier.ts';
import { intersectLineCubic } from './intersect.ts';

export interface IndexedCurve {
  c: Cubic;
  box: Box;
}
export interface CurveIndex {
  curves: IndexedCurve[];
  box: Box | null;
}
/** Twin ranges by source curve index. Other branches of the curve remain separate. */
export type Bundle = Map<number, [number, number][]>;
/** A shared-vertex hit is within this parameter distance of a curve end. */
const T_GUARD = 1e-7;

/** Is the hit at parameter `t` of curve `ci` on one of the bundled ranges? A little slack
 *  in parameter, because a cut placed on a twin falls near, not at, the corresponding point. */
function inBundle(bundle: Bundle, ci: number, t: number): boolean {
  const ranges = bundle.get(ci);
  if (!ranges) return false;
  for (const [t0, t1] of ranges) if (t >= t0 - 1e-6 && t <= t1 + 1e-6) return true;
  return false;
}

export interface Cast {
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
  const dx = Math.max(b.x0 - px, px - b.x1, 0),
    dy = Math.max(b.y0 - py, py - b.y1, 0);
  return 2 * (diag + Math.hypot(dx, dy)) + 1;
}

/**
 * One ray cast. `ref` non-null asks for the two-sided form: curves passing through the
 * query point are separated out as the "near bundle" instead of being counted, because
 * their contributions differ between the two sides.
 */
export function castRay(
  idx: CurveIndex,
  px: number,
  py: number,
  ux: number,
  uy: number,
  ref: { x: number; y: number } | null,
  near: number,
  budget: { work: number },
  complete = false,
  bundle: Bundle | null = null
): Cast {
  // The radius at which a curve running alongside the query point's own is the same
  // boundary: the weld radius, which is what `dedupeEdges` will merge the two at.
  const twin = near * 100;
  const reach = reachFrom(idx, px, py);
  const qx = px + ux * reach,
    qy = py + uy * reach;
  const nx = -uy,
    ny = ux;
  // The ray's own origin sits ON the curve being classified, so its hit is at exactly
  // u = 0 - and may be a couple of ULPS on the wrong side once the coordinates are large.
  // At x ≈ 1e7 one ulp is 1.9e-9, so an absolute 1e-9 rejects that hit as off the end of
  // the ray, the curve vanishes from the count, the edge is classified 0/0 and deleted, and
  // the operation returns non-closed geometry. Two overlapping unit squares placed at 1e7
  // came back with half their area. The tolerance is a position, so it has to be measured
  // against the positions in play: 64 ulps of the largest coordinate the cast touches, and
  // never below the module's own same-point radius.
  const hitTol = Math.max(
    near,
    64 * Number.EPSILON * Math.max(Math.abs(px), Math.abs(py), Math.abs(qx), Math.abs(qy), 1)
  );
  // How far behind its origin the ray looks (see the hit loop), which is also how far the
  // box test must reach: a twin a hair behind the origin was culled by a box padded only
  // by the bundle radius before the ray could see the twin.
  const look = Math.max(hitTol, 4 * twin, near * 32);
  const rx0 = Math.min(px, qx) - look,
    rx1 = Math.max(px, qx) + look;
  const ry0 = Math.min(py, qy) - look,
    ry1 = Math.max(py, qy) + look;
  let far = 0,
    net = 0,
    ok = true;

  for (let ci = 0; ci < idx.curves.length; ci++) {
    const ic = idx.curves[ci]!;
    if (budget.work <= 0) return { far, net, ok: false };
    budget.work -= 1;
    const b = ic.box;
    if (b.x1 < rx0 || b.x0 > rx1 || b.y1 < ry0 || b.y0 > ry1) continue;
    const c = ic.c;
    // A curve lying ALONG the ray has an identically zero distance polynomial, so the
    // root solve reports nothing and the curve would silently vanish from the count.
    // Direction-dependent, so another direction avoids that alignment.
    if (
      Math.abs(nx * (c[0] - px) + ny * (c[1] - py)) < near &&
      Math.abs(nx * (c[2] - px) + ny * (c[3] - py)) < near &&
      Math.abs(nx * (c[4] - px) + ny * (c[5] - py)) < near &&
      Math.abs(nx * (c[6] - px) + ny * (c[7] - py)) < near
    ) {
      ok = false;
      if (!complete) return { far, net, ok };
      continue;
    }

    budget.work -= 8;
    // The ray also looks BEHIND its origin, as far as `look`, so that a twin of the query
    // point's own curve is seen whichever side of it the twin runs on; a hit behind the
    // origin that is not a twin is skipped below.
    // The whole line, not just the ray, so that a hit behind the origin is seen as well.
    // The count and the directions of the roots are the solver's to get right: it isolates
    // them between the derivative's zeros and reports a repeated root once, with the
    // direction the curve crosses in. A check here that the count's parity matched the
    // two ends' sides was tried before that, and was unsound, because a tangency is a
    // genuine even root; with every direction refused by that check, the completing pass counted
    // whatever it had, and a union lost most of one operand.
    const hits = intersectLineCubic(px - ux * reach, py - uy * reach, qx, qy, c, hitTol, false);
    for (const hit of hits) {
      const t = hit.t2;
      const s = (hit.t1 * 2 - 1) * reach;
      if (s < -look) continue;
      const tg = tangentAt(c, t);
      // The distance of the hit from the origin along the ray, whichever side of the origin
      // it lies. The ray is intersected one retry band BEHIND its origin as well as ahead,
      // and a hit behind is judged by the same rule as one ahead: within the bundle radius
      // it is a curve through the point, within the retry band it is a degeneracy another
      // direction may avoid, and beyond that it is skipped, since neither side's own ray
      // crosses that hit. Looking only ahead, the two copies of a shared edge, one on each
      // operand, were decided differently: from one the other lay a hair ahead, from the
      // other it lay a hair behind and was never seen.
      const off = Math.abs(s);
      // A twin of the piece being decided: the same boundary at this resolution, so it is
      // counted as passing through the point wherever within the weld radius it lies. Along
      // the ray that is at most four radii, since the ray leaves the piece's tangent at a
      // sine of at least a quarter.
      if (bundle && ref && off <= 4 * twin && inBundle(bundle, ci, t)) {
        net += Math.sign(tg.x * ref.x + tg.y * ref.y);
        continue;
      }
      // Through the query point. Its side is decided later from the sign of
      // (ray × reference); here only its direction relative to the reference matters, which
      // is the sign of the dot product, continuous in the angle, so a bundle member that is
      // merely SKEW to the reference (a split this operation failed to make) still contributes to
      // the side it mostly lies on. Answering 0 there would drop a real boundary through the
      // query point, making both sides agree and deleting the edge.
      if (ref && off <= near) {
        net += Math.sign(tg.x * ref.x + tg.y * ref.y);
        continue;
      }
      // Which way the curve crosses the ray's line, read from the sign change of its distance
      // to the line at the root rather than from the tangent there: at the apex of a cusp
      // the tangent is a rounding-sized vector pointing anywhere, and a ray through the apex
      // (the bottom of a cusp shape, probed at its midpoint) counted that crossing with a
      // sign of its own, so the bottom read as filled on both sides and was deleted.
      const cr = hit.dir ?? Math.sign(ux * tg.y - uy * tg.x);
      if (s < 0) {
        // Behind the origin by more than the bundle radius: crossed by the forward ray of
        // neither side, so it counts for neither. Within the retry band it is the same
        // uncertainty as a hit just ahead, and another direction is tried, so that the two
        // sides of a twin pair are decided by the same rule whichever is queried.
        if (off <= near * 32 && !complete) {
          ok = false;
          return { far, net, ok };
        }
        continue;
      }
      // Three degeneracies a rotated ray does avoid: a hit at a curve end would be counted
      // once per adjoining curve, a tangential graze has no side at all, and a hit just
      // outside the bundle radius cannot be distinguished from a hit inside the bundle radius.
      const sideless = cr === 0;
      if (sideless || t < T_GUARD || t > 1 - T_GUARD || (ref !== null && off <= near * 32)) {
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
