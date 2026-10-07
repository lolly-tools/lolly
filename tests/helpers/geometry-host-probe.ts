// SPDX-License-Identifier: MPL-2.0
/** Exercise the actual shell installer and worker executor with host-owned selection. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { makeGeomApi } from '../../engine/src/geom-api.ts';
import { CLIP_COUNTS } from '../../engine/src/geom/intersect.ts';
import { installToolApis } from '../../shells/web/src/bridge/tool-apis.ts';
import { geometryBackendOf, loadWebGeometryHost } from '../../shells/web/src/bridge/geometry-host.ts';
import { getWorkerHookExecutor } from '../../shells/web/src/bridge/hook-worker.ts';
import { geometryStageWorkflows } from './geometry-stage-workflows.ts';
import { geometryHostCurve as d, geometryHostTool } from './geometry-host-hooks.ts';
import { baseHost } from './host.ts';
import type { GeometryBackend } from '../../packages/node-shell/src/geometry-host.ts';
import { benchGeometryWithLoader } from './geometry-host-benchmark.ts';
const newHost = (): HostV1 => baseHost({ shell: 'web', capabilities: [] });

export async function probeGeometryHosts(backends: GeometryBackend[] = ['typescript', 'wasm-clipping', 'wasm-host-fitting', 'wasm-host-norm-clipping', 'wasm-host-norm-fitting', 'wasm-host-curves', 'wasm-host-norm-curves']) {
  const zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0])), reference = makeGeomApi();
  const modes = [];
  for (const backend of backends) {
    const host = newHost();
    await Promise.all([installToolApis(host, { geometryBackend: backend }), installToolApis(host, { geometryBackend: backend })]);
    const original = host.geom; await installToolApis(host, { geometryBackend: backend });
    let selectionRefused = false;
    try { await installToolApis(host, { geometryBackend: backend === 'typescript' ? 'wasm-clipping' : 'typescript' }); } catch { selectionRefused = true; }
    const workflows = geometryStageWorkflows().filter(row => row.runWithApi).map(row => {
      Object.assign(CLIP_COUNTS, zero); const expected = row.runWithApi!(reference), expectedCounts = { ...CLIP_COUNTS };
      Object.assign(CLIP_COUNTS, zero); const result = row.runWithApi!(host.geom!), counts = { ...CLIP_COUNTS };
      return { id: row.id, expected, expectedCounts, result, counts };
    });
    const owner = await loadWebGeometryHost(backend);
    for (let repeat = 0; repeat < 3; repeat++) owner.api.stroke(d, 12, { join: 'round', cap: 'round', tolerance: 0.001 });
    owner.dispose(); modes.push({ backend, identity: geometryBackendOf(host.geom), sameApi: original === host.geom, selectionRefused, workflows, ownership: owner.stats() });
  }
  const workers = [], expected = reference.stroke(d, 12, { join: 'round', cap: 'round', tolerance: 0.001 });
  for (const backend of backends.filter(backend => backend !== 'typescript')) for (const strict of [false, true]) {
    const host = newHost(); await installToolApis(host, { geometryBackend: backend });
    const hooks = await getWorkerHookExecutor({ allowInRealmFallback: !strict })(geometryHostTool(`function onInit({host}){const result=host.geom.stroke(${JSON.stringify(d)},12,{join:'round',cap:'round',tolerance:0.001});return {note:JSON.stringify({result,fetchType:typeof fetch})};}`), host);
    try { const patch = await hooks.onInit!({ host, model: [] }); workers.push({ backend, strict, expected, patch }); }
    finally { hooks.dispose?.(); }
  }
  return { modes, workers };
}

const controlLoading = async (blocked: boolean) => { await fetch(`/control?blocked=${Number(blocked)}`); };
export async function probeGeometryLoadingFailure(backend: GeometryBackend = 'wasm-clipping', control = controlLoading) {
  const host = newHost(); let message = '';
  try { await installToolApis(host, { geometryBackend: backend }); } catch (error) { message = String(error); }
  const unpublished = host.geom === undefined;
  await control(false); await installToolApis(host, { geometryBackend: backend });
  return { message, unpublished, recovered: geometryBackendOf(host.geom) };
}

export async function probeGeometryWorkerFailure(backend: GeometryBackend = 'wasm-clipping', control = controlLoading) {
  const host = newHost(), logs: string[] = []; host.log = (_level, message) => { logs.push(message); };
  await installToolApis(host, { geometryBackend: backend }); await control(true); let message = '';
  try {
    const hooks = await getWorkerHookExecutor()(geometryHostTool('function onInit(){return {note:"in realm"};}'), host);
    hooks.dispose?.();
  } catch (error) { message = String(error); }
  finally { await control(false); }
  return { message, fallback: logs.some(message => message.includes('running in-realm')), identity: geometryBackendOf(host.geom) };
}

export async function benchGeometryHosts(reverse = false, backends?: GeometryBackend[]) {
  return benchGeometryWithLoader(loadWebGeometryHost, reverse, backends);
}
