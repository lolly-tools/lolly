// SPDX-License-Identifier: MPL-2.0
/** Comparison-only operation owner for a reusable complete verification workspace. */
import type { offsetError } from '../../engine/src/geom/offset-error.ts';
import type { createGeometryKernel } from '../../packages/node-shell/src/geometry-kernel.ts';

export function createOffsetErrorBackend(kernel: Awaited<ReturnType<typeof createGeometryKernel>>) {
  let workspace: ReturnType<typeof kernel.createOffsetErrorWorkspace> | undefined;
  let calls = 0,
    importedCurves = 0;
  const verify: typeof offsetError = (...args) => {
    workspace ??= kernel.createOffsetErrorWorkspace();
    calls++;
    importedCurves += args[1].length;
    return workspace.verify(...args);
  };
  return {
    verify,
    stats: () => ({ calls, importedCurves }),
    dispose: () => {
      workspace?.dispose();
      workspace = undefined;
    },
  };
}
