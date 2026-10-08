// SPDX-License-Identifier: MPL-2.0
/** Node geometry selection loads bytes without requiring a graphics device. */
import { createGeometryHost, isGeometryBackend, type GeometryBackend } from './geometry-host.ts';
import { loadGeometryClipping } from './geometry-clipping-node.ts';
import { loadGeometryFitting } from './geometry-fitting-node.ts';

// One compiled pair per process: every host shares it, and each call owns its workspaces.
let kernels: Promise<{ clipping: Awaited<ReturnType<typeof loadGeometryClipping>>; fitting: Awaited<ReturnType<typeof loadGeometryFitting>> }> | undefined;
function loadKernels() {
  kernels ??= Promise.all([loadGeometryClipping(), loadGeometryFitting()])
    .then(([clipping, fitting]) => ({ clipping, fitting }))
    .catch((error: unknown) => { kernels = undefined; throw error; });
  return kernels;
}

/** An explicit selection: loading failures and kernel refusals stay visible. */
export async function loadNodeGeometryHost(backend: GeometryBackend = 'typescript') {
  if (!isGeometryBackend(backend)) throw Error('Unknown geometry backend.');
  if (backend === 'typescript') return createGeometryHost();
  return createGeometryHost(await loadKernels());
}

/**
 * The default: the portable kernels when they load, otherwise the TypeScript
 * reference. Both return the same bits, so the fallback changes speed only;
 * `loadError` reports why the kernels were not used.
 */
export async function loadDefaultNodeGeometryHost() {
  try { return { ...createGeometryHost(await loadKernels(), { strict: false }), loadError: undefined }; }
  catch (error) { return { ...createGeometryHost(), loadError: error instanceof Error ? error.message : String(error) }; }
}
