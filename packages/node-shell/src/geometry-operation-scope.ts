// SPDX-License-Identifier: MPL-2.0
/** Shells load modules before creating a synchronous, explicitly disposed operation owner. */
import { GeometryOperationError, type GeometryOperations } from '../../../engine/src/geom/operations.ts';
import type { createGeometryClipping } from './geometry-clipping.ts';
import type { createGeometryFitting } from './geometry-fitting.ts';
import { GeometryKernelError } from './geometry-kernel-contract.ts';

export function createGeometryOperationScope(modules: {
  clipping?: Awaited<ReturnType<typeof createGeometryClipping>>;
  fitting?: Awaited<ReturnType<typeof createGeometryFitting>>;
}) {
  const clipping = modules.clipping, fitting = modules.fitting;
  let clip: ReturnType<NonNullable<typeof clipping>['createClipWorkspace']> | undefined;
  let fit: ReturnType<NonNullable<typeof fitting>['createOffsetFitWorkspace']> | undefined;
  let disposed = false, clipCalls = 0, fitCalls = 0;
  function invoke<T>(run: () => T): T {
    if (disposed) throw new GeometryOperationError('invalid-argument', 'This geometry operation has been disposed.');
    try { return run(); }
    catch (error) {
      if (error instanceof GeometryKernelError) throw new GeometryOperationError(error.code, error.message);
      throw error;
    }
  }
  const operations: GeometryOperations = Object.freeze({
    ...(clipping ? { clipping: (...args: Parameters<NonNullable<GeometryOperations['clipping']>>) => invoke(() => {
      clip ??= clipping.createClipWorkspace(); clipCalls++; return clip.intersect(...args);
    }) } : {}),
    ...(fitting ? { fitting: (...args: Parameters<NonNullable<GeometryOperations['fitting']>>) => invoke(() => {
      fit ??= fitting.createOffsetFitWorkspace(); fitCalls++; return fit.fit(...args);
    }) } : {}),
  });
  return {
    operations,
    stats: () => ({ clipCalls, fitCalls, disposed }),
    dispose: () => { if (!disposed) { disposed = true; clip?.dispose(); fit?.dispose(); clip = undefined; fit = undefined; } },
  };
}
