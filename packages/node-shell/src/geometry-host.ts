// SPDX-License-Identifier: MPL-2.0
/** Long-lived hosts release numerical workspaces after every synchronous call. */
import { makeGeomApi } from '../../../engine/src/geom-api.ts';
import type { GeomAPI, GeomPathResult } from '@lolly-tools/core/host-v1';
import { createGeometryOperationScope } from './geometry-operation-scope.ts';

/**
 * `typescript` is the engine reference. `wasm-portable` runs clipping and fitting in
 * the import-free kernels, which compute the same bits: both use V8's two-argument
 * norm and one compiled portable scalar maths, so neither depends on the host engine.
 */
export type GeometryBackend = 'typescript' | 'wasm-portable';
/** The geometry answer revision. A change to either implementation's arithmetic is a new revision. */
export const GEOMETRY_REVISION = 'geom-portable-v1';
const backends = new WeakMap<GeomAPI, GeometryBackend>();
export function geometryBackendOf(api?: GeomAPI): GeometryBackend { return api ? backends.get(api) ?? 'typescript' : 'typescript'; }
export function isGeometryBackend(value: unknown): value is GeometryBackend { return value === 'typescript' || value === 'wasm-portable'; }

export function createGeometryHost(modules: Parameters<typeof createGeometryOperationScope>[0] = {}) {
  if (Boolean(modules.clipping) !== Boolean(modules.fitting)) throw Error('Portable geometry requires both the clipping and fitting modules.');
  if (modules.fitting && modules.fitting.stats().mathBackend !== 'portable') throw Error('Portable geometry requires the import-free fitting module.');
  const selected = Object.freeze({ ...modules });
  const backend: GeometryBackend = selected.clipping ? 'wasm-portable' : 'typescript';
  let disposed = false, calls = 0, clipCalls = 0, fitCalls = 0;
  const base = makeGeomApi();
  function run(operation: (api: GeomAPI) => GeomPathResult): GeomPathResult {
    if (disposed) return { ok: false, code: 'invalid-argument', message: 'geom: This geometry host has been disposed.' };
    calls++;
    const owner = createGeometryOperationScope(selected);
    try { return operation(makeGeomApi(owner.operations)); }
    finally { owner.dispose(); const stats = owner.stats(); clipCalls += stats.clipCalls; fitCalls += stats.fitCalls; }
  }
  const api: GeomAPI = {
    ...base,
    union: (...args) => run(api => api.union(...args)),
    intersect: (...args) => run(api => api.intersect(...args)),
    difference: (...args) => run(api => api.difference(...args)),
    xor: (...args) => run(api => api.xor(...args)),
    selfUnion: (...args) => run(api => api.selfUnion(...args)),
    offset: (...args) => run(api => api.offset(...args)),
    stroke: (...args) => run(api => api.stroke(...args)),
  };
  backends.set(api, backend);
  return { api, backend, stats: () => ({ calls, clipCalls, fitCalls, disposed, clipping: selected.clipping?.stats(), fitting: selected.fitting?.stats() }), dispose: () => { disposed = true; } };
}
