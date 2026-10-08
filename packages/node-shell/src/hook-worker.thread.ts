// SPDX-License-Identifier: MPL-2.0
/**
 * Worker-thread entry for the Node hook executor (hook-worker.ts). Runs the
 * engine's transport-agnostic core over `parentPort`; the only thread-specific
 * work here is the strict lockdown (ambient channels plus Node's own
 * `process`/`require`) and the local `canRaster` answer, which is false: a
 * thread has no bitmap decoder of its own, so a hook that needs one takes the
 * owner-side `host.raster.decode` RPC instead.
 */
import { parentPort, workerData } from 'node:worker_threads';
import type { HostV1 } from '@lolly-tools/core/host-v1';
// Load only the worker core so startup does not evaluate the full engine barrel.
import { createHookWorkerCore, lockDownAmbientCapabilities, type HookWorkerIn } from '../../../engine/src/hook-worker-core.ts';

// `process` itself stays: Node's own message-port and timer internals in the
// thread read it, and hiding it wedges the thread (verified on Node 22). Its
// environment is already empty (the owner spawns with `env: {}`); what a strict
// thread loses here is the CommonJS loader and every ambient network channel.
const NODE_AMBIENT = ['require', 'module'] as const;

if (parentPort) {
  const port = parentPort;
  async function prepare() {
    const backend: unknown = workerData?.geometryBackend ?? 'typescript';
    let geom: HostV1['geom'];
    if (backend !== 'typescript') {
      const { loadDefaultNodeGeometryHost, loadNodeGeometryHost } = await import('./geometry-host-node.ts');
      const { isGeometryBackend } = await import('./geometry-host.ts');
      if (!isGeometryBackend(backend)) throw Error('Unknown geometry backend.');
      // An explicit owner selection stays strict here too; the default may use the reference.
      geom = (workerData?.geometryStrict === false ? await loadDefaultNodeGeometryHost() : await loadNodeGeometryHost(backend)).api;
    }
    return createHookWorkerCore({ post: (m) => port.postMessage(m) }, { canRaster: () => false, geom });
  }
  let ready: ReturnType<typeof prepare> | undefined;
  let initialized = false;
  port.on('message', async (msg: HookWorkerIn) => {
    try {
      ready ??= prepare();
      const core = await ready;
      if (!initialized && msg.t === 'init') {
        initialized = true;
        if (msg.strict) lockDownAmbientCapabilities(globalThis as unknown as Record<string, unknown>, NODE_AMBIENT);
      }
      core.handle(msg);
    } catch (error) {
      if (msg.t === 'init') port.postMessage({ t: 'init-done', runId: msg.runId, declared: [], inRealmOnlyDeclared: [], compileError: error instanceof Error ? error.message : String(error) });
    }
  });
}
