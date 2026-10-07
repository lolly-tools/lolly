// SPDX-License-Identifier: MPL-2.0
/** Comparison-only complete-operation substitution; the live engine never imports this control. */
import type { Cubic } from '../../engine/src/geom/bezier.ts';
import type { GeometryOffsetPiece } from '../../packages/node-shell/src/geometry-fitting.ts';
export type OffsetFitProbe = (src: Cubic, distance: number, tol: number) => GeometryOffsetPiece[];
export let offsetFitProbe: OffsetFitProbe | undefined;
export function setOffsetFitProbe(probe: OffsetFitProbe | undefined): void {
  offsetFitProbe = probe;
}
let reference: OffsetFitProbe | undefined;
export function setOffsetFitReference(fn: OffsetFitProbe): void {
  reference = fn;
}
export function getOffsetFitReference(): OffsetFitProbe {
  if (!reference) throw new Error('The offset fitting comparison seam was not compiled.');
  return reference;
}
