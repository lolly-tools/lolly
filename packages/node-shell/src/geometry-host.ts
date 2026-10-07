// SPDX-License-Identifier: MPL-2.0
/** Long-lived hosts release selected numerical workspaces after every synchronous call. */
import { makeGeomApi } from '../../../engine/src/geom-api.ts';
import type { GeomAPI, GeomPathResult } from '@lolly-tools/core/host-v1';
import { createGeometryOperationScope } from './geometry-operation-scope.ts';

export type GeometryBackend = 'typescript' | 'wasm-clipping' | 'wasm-host-fitting' | 'wasm-host-norm-clipping' | 'wasm-host-norm-fitting' | 'wasm-host-curves' | 'wasm-host-norm-curves';
export type GeometryTarget = 'node-v8' | 'chromium' | 'firefox' | 'webkit' | 'tauri-macos';
/** Callers supply an explicitly qualified target; this function does not detect or activate a platform. */
export function geometryBackendForTarget(target: unknown): GeometryBackend {
  if (target === 'node-v8' || target === 'chromium') return 'wasm-host-curves';
  if (target === 'firefox' || target === 'webkit' || target === 'tauri-macos') return 'wasm-host-norm-curves';
  return 'typescript';
}
const backends = new WeakMap<GeomAPI, GeometryBackend>();
export function geometryBackendOf(api?: GeomAPI): GeometryBackend { return api ? backends.get(api) ?? 'typescript' : 'typescript'; }
export function isGeometryBackend(value: unknown): value is GeometryBackend { return value === 'typescript' || value === 'wasm-clipping' || value === 'wasm-host-fitting' || value === 'wasm-host-norm-clipping' || value === 'wasm-host-norm-fitting' || value === 'wasm-host-curves' || value === 'wasm-host-norm-curves'; }
export function geometryBackendModules(backend: GeometryBackend) {
  if (!isGeometryBackend(backend)) throw Error('Unknown geometry backend.');
  return Object.freeze({ norm: backend === 'wasm-host-norm-clipping' || backend === 'wasm-host-norm-fitting' || backend === 'wasm-host-norm-curves', fitting: backend === 'wasm-host-fitting' || backend === 'wasm-host-norm-fitting' || backend === 'wasm-host-curves' || backend === 'wasm-host-norm-curves', curvesOnly: backend === 'wasm-host-curves' || backend === 'wasm-host-norm-curves' });
}

export function createGeometryHost(modules: Parameters<typeof createGeometryOperationScope>[0] = {}, operations: 'all' | 'curves' = 'all') {
  if (operations !== 'all' && operations !== 'curves') throw Error('Unknown geometry operation selection.');
  if (operations === 'curves' && (!modules.clipping || !modules.fitting)) throw Error('Curve selection requires matching clipping and fitting modules.');
  if (modules.fitting && !modules.clipping) throw Error('Host fitting selection requires the clipping module.');
  const norm = modules.clipping?.stats().mathBackend === 'host-norm';
  if (modules.fitting && modules.fitting.stats().mathBackend !== (norm ? 'host-norm' : 'host')) throw Error('Host fitting selection requires host maths matching the clipping module.');
  const selected = Object.freeze({ ...modules });
  const backend: GeometryBackend = operations === 'curves' ? norm ? 'wasm-host-norm-curves' : 'wasm-host-curves' : norm ? selected.fitting ? 'wasm-host-norm-fitting' : 'wasm-host-norm-clipping' : selected.fitting ? 'wasm-host-fitting' : selected.clipping ? 'wasm-clipping' : 'typescript';
  let disposed = false, calls = 0, clipCalls = 0, fitCalls = 0, typeScriptCalls = 0;
  const base = makeGeomApi();
  function run(operation: (api: GeomAPI) => GeomPathResult, boolean = false): GeomPathResult {
    if (disposed) return { ok: false, code: 'invalid-argument', message: 'geom: This geometry host has been disposed.' };
    calls++;
    if (operations === 'curves' && boolean) { typeScriptCalls++; return operation(base); }
    const owner = createGeometryOperationScope(selected);
    try { return operation(makeGeomApi(owner.operations)); }
    finally { owner.dispose(); const stats = owner.stats(); clipCalls += stats.clipCalls; fitCalls += stats.fitCalls; }
  }
  const api: GeomAPI = {
    ...base,
    union: (...args) => run(api => api.union(...args), true),
    intersect: (...args) => run(api => api.intersect(...args), true),
    difference: (...args) => run(api => api.difference(...args), true),
    xor: (...args) => run(api => api.xor(...args), true),
    selfUnion: (...args) => run(api => api.selfUnion(...args), true),
    offset: (...args) => run(api => api.offset(...args)),
    stroke: (...args) => run(api => api.stroke(...args)),
  };
  backends.set(api, backend);
  return { api, backend, stats: () => ({ calls, typeScriptCalls, clipCalls, fitCalls, disposed, operations, clipping: selected.clipping?.stats(), fitting: selected.fitting?.stats() }), dispose: () => { disposed = true; } };
}
