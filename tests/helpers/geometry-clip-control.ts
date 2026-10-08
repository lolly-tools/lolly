// SPDX-License-Identifier: MPL-2.0
/** Comparison-only whole-pair substitution; the live engine never imports this control. */
import type { Cubic } from '../../engine/src/geom/bezier.ts';
import type { CLIP_COUNTS, Intersection } from '../../engine/src/geom/intersect.ts';
import type { GeometryClipLimits } from '../../packages/node-shell/src/geometry-clipping.ts';
export type ClipProbe = (
  a: Cubic,
  b: Cubic,
  tol: number,
  limits: GeometryClipLimits,
  counts: typeof CLIP_COUNTS
) => Intersection[];
export let clipProbe: ClipProbe | undefined;
export function setClipProbe(probe: ClipProbe | undefined): void {
  clipProbe = probe;
}
