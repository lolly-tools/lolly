// SPDX-License-Identifier: MPL-2.0
/** Node geometry selection loads bytes without requiring a graphics device. */
import { createGeometryHost, geometryBackendModules, isGeometryBackend, type GeometryBackend } from './geometry-host.ts';
import { loadGeometryClipping } from './geometry-clipping-node.ts';
import { loadGeometryFitting } from './geometry-fitting-node.ts';

export async function loadNodeGeometryHost(backend: GeometryBackend = 'typescript') {
  if (!isGeometryBackend(backend)) throw Error('Unknown geometry backend.');
  if (backend === 'typescript') return createGeometryHost();
  const { norm, fitting: useFitting, curvesOnly } = geometryBackendModules(backend);
  const clipping = await loadGeometryClipping(norm ? 'host-norm' : 'retained');
  const fitting = useFitting ? await loadGeometryFitting(norm ? 'host-norm' : 'host') : undefined;
  return createGeometryHost({ clipping, fitting }, curvesOnly ? 'curves' : 'all');
}
