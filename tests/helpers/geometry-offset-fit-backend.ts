// SPDX-License-Identifier: MPL-2.0
/** Complete operation ownership and engine admission for qualification bundles only. */

import { unitTangent } from '../../engine/src/geom/offset-source.ts';
import type { createGeometryFitting } from '../../packages/node-shell/src/geometry-fitting.ts';
import type { OffsetFitProbe } from './geometry-offset-fit-control.ts';
export function createOffsetFitBackend(kernel: Awaited<ReturnType<typeof createGeometryFitting>>) {
  let workspace: ReturnType<typeof kernel.createOffsetFitWorkspace> | undefined;
  let calls = 0,
    returnedPieces = 0,
    maxPieces = 0;
  const fit: OffsetFitProbe = (src, distance, tol) => {
    // Preserve engine entry semantics separately from the bounded raw-kernel admission.
    if (src.some((v) => !Number.isFinite(v))) return [];
    if (!Number.isFinite(distance))
      return [{ curve: [...src], dirStart: unitTangent(src, 0), dirEnd: unitTangent(src, 1) }];
    workspace ??= kernel.createOffsetFitWorkspace();
    calls++;
    const result = workspace.fit(src, distance, Math.max(tol, 1e-9));
    returnedPieces += result.length;
    maxPieces = Math.max(maxPieces, result.length);
    return result;
  };
  return {
    fit,
    stats: () => ({ calls, returnedPieces, maxPieces }),
    dispose: () => {
      workspace?.dispose();
      workspace = undefined;
    },
  };
}
