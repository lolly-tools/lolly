// SPDX-License-Identifier: MPL-2.0
/**
 * Worker-thread entry for the Node hook executor (hook-worker.ts). Runs the
 * engine's transport-agnostic core over `parentPort`; the only thread-specific
 * work here is the strict lockdown (ambient channels plus Node's own
 * `process`/`require`) and the local `canRaster` answer, which is false: a
 * thread has no bitmap decoder of its own, so a hook that needs one takes the
 * owner-side `host.raster.decode` RPC instead.
 */
import { parentPort } from 'node:worker_threads';
import { createHookWorkerCore, lockDownAmbientCapabilities } from '@lolly/engine';
import type { HookWorkerIn } from '@lolly/engine';

// `process` itself stays: Node's own message-port and timer internals in the
// thread read it, and hiding it wedges the thread (verified on Node 22). Its
// environment is already empty (the owner spawns with `env: {}`); what a strict
// thread loses here is the CommonJS loader and every ambient network channel.
const NODE_AMBIENT = ['require', 'module'] as const;

if (parentPort) {
  const port = parentPort;
  const core = createHookWorkerCore({ post: (m) => port.postMessage(m) }, { canRaster: () => false });
  let initialized = false;
  port.on('message', (msg: HookWorkerIn) => {
    if (!initialized && msg.t === 'init') {
      initialized = true;
      if (msg.strict) {
        try {
          lockDownAmbientCapabilities(globalThis as unknown as Record<string, unknown>, NODE_AMBIENT);
        } catch (error) {
          port.postMessage({
            t: 'init-done', runId: msg.runId, declared: [], inRealmOnlyDeclared: [],
            compileError: error instanceof Error ? error.message : String(error),
          });
          return;
        }
      }
    }
    core.handle(msg);
  });
}
