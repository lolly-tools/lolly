// SPDX-License-Identifier: MPL-2.0
/** Read only by the comparison build's injected hook, never by the production engine. */
import type { castRay } from '../../engine/src/geom/ray-cast.ts';
export let rayProbe: typeof castRay | undefined;
export function setRayProbe(probe: typeof castRay | undefined): void {
  rayProbe = probe;
}
