// SPDX-License-Identifier: MPL-2.0
/** Exact cubic offset points and source directions, including vanishing-tangent fallbacks. */
import { type Cubic, evalCubic, type Pt, tangentAt } from './bezier.ts';
import * as pmath from './portable-math.ts';

/** The exact offset point at `t`: on the curve, plus `d` along the left normal. */
export function offsetPoint(c: Cubic, t: number, d: number): Pt | null {
  const tan = unitTangent(c, t);
  if (!tan) return null;
  const p = evalCubic(c, t);
  return { x: p.x - d * tan.y, y: p.y + d * tan.x };
}

/** Unit tangent, with the fallbacks a vanishing derivative needs. `tangentAt` returns
 *  zero at a coincident control pair and at a cusp, and a zero normal would put the
 *  offset endpoint on top of the source. */
export function unitTangent(c: Cubic, t: number): Pt | null {
  const d = tangentAt(c, t);
  const len = pmath.hypot(d.x, d.y);
  if (len > 1e-12) return { x: d.x / len, y: d.y / len };
  const legs: [number, number][] =
    t < 0.5
      ? [
          [c[4] - c[0], c[5] - c[1]],
          [c[6] - c[0], c[7] - c[1]],
        ]
      : [
          [c[6] - c[2], c[7] - c[3]],
          [c[6] - c[0], c[7] - c[1]],
        ];
  for (const [dx, dy] of legs) {
    const l = pmath.hypot(dx, dy);
    if (l > 1e-12) return { x: dx / l, y: dy / l };
  }
  return null;
}
