// SPDX-License-Identifier: MPL-2.0
/**
 * Hook Worker entry (M2, plans/86-worker-isolation-hooks.md section 13.1) - the
 * browser side of running a tool's hooks.js OFF the main thread.
 *
 * The protocol, the host-proxy policy (co-located / proxied / seeded buckets)
 * and the testable core now live in the engine (`hook-worker-core.ts`), shared
 * with the Node `worker_threads` executor in `@lolly-tools/node-shell`. This
 * file re-exports that surface for the main-thread client and the tests, and
 * adds the one thing only a browser Worker can answer: whether this realm can
 * rasterise (`createImageBitmap` + `OffscreenCanvas`), injected into the core
 * as `raster.canRaster`.
 */
import {
  createHookWorkerCore,
  lockDownAmbientCapabilities,
} from '../../../../engine/src/hook-worker-core.ts';
import type { HookWorkerIn } from '../../../../engine/src/hook-worker-core.ts';

export {
  createHookWorkerCore,
  lockDownAmbientCapabilities,
  workerRpcMethods,
  introspectHost,
  gatherHostSeeds,
  STRICT_AMBIENT_GLOBALS,
  STRICT_NAVIGATOR_PROPERTIES,
  WORKER_HOOK_NAMES,
  IN_REALM_ONLY_HOOK_NAMES,
} from '../../../../engine/src/hook-worker-core.ts';
export type {
  HostShape, HostSeeds, HookInitMsg, HookInvokeMsg, HookHostReplyMsg, HookDisposeMsg, HookWorkerIn,
  WorkerHookName, InRealmOnlyHookName, HookInitDoneMsg, HookInvokeDoneMsg, HookReportMsg,
  HookHostCallMsg, HookLogMsg, HookWorkerOut, HookWorkerPort,
} from '../../../../engine/src/hook-worker-core.ts';

/** Whether this Worker realm can decode/draw a bitmap - the local answer to
 *  `host.raster.canRaster()` (realm-portable by design, the M1 point). */
function browserCanRaster(): boolean {
  const g = globalThis as { createImageBitmap?: unknown; OffscreenCanvas?: unknown; document?: { createElement?: unknown } };
  return typeof g.createImageBitmap === 'function' &&
    (typeof g.OffscreenCanvas === 'function' || (typeof g.document !== 'undefined' && !!g.document.createElement));
}

// ── Wire entry (only inside a real Worker; importing on main is inert) ────────
function inWorkerScope(): boolean {
  const g = globalThis as { WorkerGlobalScope?: unknown; document?: unknown };
  return typeof g.WorkerGlobalScope !== 'undefined' && typeof g.document === 'undefined';
}

if (inWorkerScope()) {
  const post = postMessage as (message: unknown, transfer: Transferable[]) => void;
  const core = createHookWorkerCore({ post: (m, transfer) => post(m, (transfer ?? []) as Transferable[]) }, { canRaster: browserCanRaster });
  let initialized = false;
  addEventListener('message', (e: MessageEvent<HookWorkerIn>) => {
    const msg = e.data;
    if (!initialized && msg.t === 'init') {
      initialized = true;
      try {
        if (msg.strict) lockDownAmbientCapabilities(globalThis as unknown as Record<string, unknown>);
      } catch (error) {
        post({
          t: 'init-done', runId: msg.runId, declared: [], inRealmOnlyDeclared: [],
          compileError: error instanceof Error ? error.message : String(error),
        }, []);
        return;
      }
    }
    core.handle(msg);
  });
}
