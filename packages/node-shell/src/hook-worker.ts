// SPDX-License-Identifier: MPL-2.0
/**
 * Node `worker_threads` hook executor - the CLI/TUI/MCP counterpart of the web
 * shell's Worker-isolated executor (shells/web/src/bridge/hook-worker.ts).
 *
 * Same protocol, same proxy policy: the engine's `hook-worker-core.ts` runs
 * inside the thread (hook-worker.thread.ts) and this file is the owning side -
 * it introspects the live host, snapshots the brand token doc, seeds the sync
 * feature-detects a thread cannot compute, services the thread's `host-call`
 * RPCs against THIS mount's host (per-mount authorization from
 * `workerRpcMethods`, so a hook cannot forge a call outside policy), and turns
 * the thread's replies into the `Hooks` object `createRuntime` expects.
 *
 * What a thread isolates, honestly: its own V8 realm (no shared globals with
 * the host process, a hook cannot reach the owner's module graph), an EMPTY
 * `process.env` (the Worker is spawned with `env: {}`), and - in strict mode -
 * `require`, `fetch` and the other ambient channels locked to undefined before
 * hooks.js is compiled. It does not isolate the filesystem or the process
 * object: Node has no per-thread sandbox for those, so a hostile hook in a
 * strict thread can still `import('node:fs')` through a dynamic import. The value here
 * is the same as the web Worker's for first-party tools: a realm boundary, a
 * proxy that is the only route to the host, and a hard watchdog per hook.
 *
 * The node-carrying export hooks (beforeExport/afterExport/exportStill)
 * receive a live DOM Element and must run in-realm, exactly as on the web:
 * they are compiled in this realm and the thread only ever runs
 * onInit/onInput/onFrame/onLevel/exportFile.
 */
import { Worker } from 'node:worker_threads';
import { HOOK_BUDGET_MS, inRealmHookExecutor } from '@lolly/engine';
import { workerRpcMethods, introspectHost, gatherHostSeeds } from '@lolly/engine';
import type { HookExecutor, Hooks } from '@lolly/engine';
import type {
  HostShape, HookWorkerOut, WorkerHookName, HookHostCallMsg, HookInitDoneMsg, HookLogMsg, HookInvokeDoneMsg,
} from '@lolly/engine';
import type { HostV1, TokensAPI } from '@lolly-tools/core/host-v1';

const INIT_TIMEOUT_MS = 5000;

export const NODE_WORKER_HOOK_BUDGET_MS: Readonly<Record<WorkerHookName, number>> = {
  onInit: HOOK_BUDGET_MS.onInit,
  onInput: HOOK_BUDGET_MS.onInput,
  onFrame: 2000,
  onLevel: 2000,
  exportFile: HOOK_BUDGET_MS.exportFile,
};

export class NodeHookIsolationError extends Error {
  readonly code = 'isolation-unavailable';
  constructor(message: string) {
    super(message);
    this.name = 'NodeHookIsolationError';
  }
}

export interface NodeHookExecutorOpts {
  /** Lock ambient channels (process, require, fetch, …) in the thread before
   *  compiling hooks. Default false: the CLI runs first-party catalog tools. */
  strict?: boolean;
  /** Fall back to the in-realm executor when the thread cannot be started or
   *  the hooks cannot compile there. Default true; strict mounts fail closed. */
  allowInRealmFallback?: boolean;
  /** Override the thread entry (tests). */
  threadUrl?: URL;
}

interface Mount {
  host: HostV1;
  allowedRpc: Set<string>;
  worker: Worker;
  invokes: Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void; timer: NodeJS.Timeout; report?: (patch: Record<string, unknown>) => void }>;
}

let runSeq = 0;
let callSeq = 0;

async function snapshotTokens(host: HostV1): Promise<unknown | null> {
  const t = host.tokens as (TokensAPI & { raw?: () => Promise<unknown> }) | undefined;
  if (!t || typeof t.raw !== 'function') return null;
  try { return (await t.raw()) ?? null; } catch { return null; }
}

/** Build the executor. One Worker thread per mount; disposed with the runtime. */
export function createNodeHookExecutor(opts: NodeHookExecutorOpts = {}): HookExecutor {
  const strict = opts.strict === true;
  const allowFallback = !strict && opts.allowInRealmFallback !== false;
  const threadUrl = opts.threadUrl ?? new URL('./hook-worker.thread.ts', import.meta.url);

  const teardown = (mount: Mount, reason: Error): void => {
    for (const p of mount.invokes.values()) { clearTimeout(p.timer); p.reject(reason); }
    mount.invokes.clear();
    mount.worker.removeAllListeners();
    void mount.worker.terminate();
  };

  const dispatchHostCall = async (mount: Mount, m: HookHostCallMsg): Promise<void> => {
    const reply = (ok: boolean, value?: unknown, error?: string): void => {
      try { mount.worker.postMessage({ t: 'host-reply', runId: m.runId, hostCallId: m.hostCallId, ok, value, error }); }
      catch (e) { mount.worker.postMessage({ t: 'host-reply', runId: m.runId, hostCallId: m.hostCallId, ok: false, error: `reply not cloneable: ${(e as Error).message}` }); }
    };
    if (!mount.allowedRpc.has(m.method)) { reply(false, undefined, `host.${m.method} is not permitted from an isolated hook`); return; }
    const dot = m.method.indexOf('.');
    const ns = m.method.slice(0, dot);
    const method = m.method.slice(dot + 1);
    const nsObj = (mount.host as unknown as Record<string, Record<string, unknown>>)[ns];
    const fn = nsObj?.[method];
    if (typeof fn !== 'function') { reply(false, undefined, `no host.${m.method}`); return; }
    try {
      reply(true, await (fn as (...a: unknown[]) => unknown).apply(nsObj, m.args));
    } catch (e) {
      reply(false, undefined, e instanceof Error ? e.message : String(e));
    }
  };

  const mountInThread = async (tool: Parameters<HookExecutor>[0], host: HostV1): Promise<Hooks> => {
    const runId = ++runSeq;
    // execArgv: [] - the thread must not inherit the owner's loader hooks
    // (`--import` registrations): a second thread spawned under a shared
    // customization hook never finishes linking on Node 22, and hooks.js needs
    // nothing from them. Type stripping is a default, not a flag.
    const worker = new Worker(threadUrl, { env: {}, stdout: false, stderr: false, execArgv: [] });
    // A thread must never keep the owning process alive on its own: the CLI
    // exits when the render is written, worker or not.
    worker.unref();
    const mount: Mount = { host, allowedRpc: new Set(), worker, invokes: new Map() };
    const hostShape: HostShape = introspectHost(host);
    mount.allowedRpc = workerRpcMethods(hostShape);
    const tokenDoc = await snapshotTokens(host);

    const initDone = new Promise<HookInitDoneMsg>((resolve, reject) => {
      const timer = setTimeout(() => reject(new NodeHookIsolationError('hook thread init timed out')), INIT_TIMEOUT_MS);
      worker.on('message', (m: HookWorkerOut) => {
        if (m.runId !== runId) return;
        if (m.t === 'init-done') { clearTimeout(timer); resolve(m); return; }
        if (m.t === 'host-call') { void dispatchHostCall(mount, m); return; }
        if (m.t === 'log') { for (const e of (m as HookLogMsg).entries) host.log(e.level as 'info', e.msg, e.ctx as object | undefined); return; }
        if (m.t === 'report') { mount.invokes.get(m.callId)?.report?.(m.patch); return; }
        if (m.t === 'invoke-done') {
          const done = m as HookInvokeDoneMsg;
          const p = mount.invokes.get(done.callId);
          if (!p) return;
          mount.invokes.delete(done.callId);
          clearTimeout(p.timer);
          if (done.ok) p.resolve(done.patch); else p.reject(new Error(done.error ?? 'hook failed'));
        }
      });
      worker.on('error', (err: unknown) => { clearTimeout(timer); const e = new NodeHookIsolationError(`hook thread crashed: ${err instanceof Error ? err.message : String(err)}`); reject(e); teardown(mount, e); });
      worker.on('exit', (code) => { if (code !== 0) teardown(mount, new NodeHookIsolationError(`hook thread exited (${code})`)); });
    });

    worker.postMessage({
      t: 'init', runId,
      hooksSource: tool.hooksSource ?? '',
      tokenDoc, tokenExcluded: [],
      hostShape, seeds: gatherHostSeeds(host),
      shell: host.shell, capabilities: host.capabilities ?? [],
      strict,
    });
    const init = await initDone;
    if (init.compileError) {
      teardown(mount, new Error(init.compileError));
      throw new Error(`hook thread compile error: ${init.compileError}`);
    }
    if (strict && init.inRealmOnlyDeclared.length) {
      const e = new NodeHookIsolationError(`isolated hooks cannot receive live DOM export nodes (${init.inRealmOnlyDeclared.join(', ')})`);
      teardown(mount, e);
      throw e;
    }
    host.log('info', `hooks running in a worker thread (${init.declared.join(', ') || 'none declared'})`, { toolId: tool.manifest.id });

    const invoke = (name: WorkerHookName, ctx: unknown): Promise<unknown> => {
      const callId = ++callSeq;
      const { host: _omit, report, ...rest } = (ctx ?? {}) as Record<string, unknown> & { host?: unknown; report?: (p: Record<string, unknown>) => void };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!mount.invokes.has(callId)) return;
          teardown(mount, new NodeHookIsolationError(`${name} exceeded its ${NODE_WORKER_HOOK_BUDGET_MS[name]}ms isolated execution budget`));
        }, NODE_WORKER_HOOK_BUDGET_MS[name]);
        mount.invokes.set(callId, { resolve, reject, timer, report });
        try {
          worker.postMessage({ t: 'invoke', runId, callId, name, ctx: rest });
        } catch (e) {
          mount.invokes.delete(callId);
          clearTimeout(timer);
          reject(new NodeHookIsolationError(`could not invoke isolated ${name}: ${(e as Error).message}`));
        }
      });
    };
    const has = new Set(init.declared);
    const slot = (name: WorkerHookName) => (has.has(name) ? (ctx: unknown) => invoke(name, ctx) : null);
    // Export hooks that carry a live DOM node run in this realm, as on the web.
    const inRealm = strict ? null : await inRealmHookExecutor(tool, host);
    return {
      onInit: slot('onInit'),
      onInput: slot('onInput'),
      onFrame: slot('onFrame'),
      onLevel: slot('onLevel'),
      exportFile: slot('exportFile'),
      beforeExport: inRealm?.beforeExport ?? null,
      afterExport: inRealm?.afterExport ?? null,
      exportStill: inRealm?.exportStill ?? null,
      dispose: () => {
        try { worker.postMessage({ t: 'dispose', runId }); } catch { /* already gone */ }
        teardown(mount, new NodeHookIsolationError('hook thread mount disposed'));
      },
    } as unknown as Hooks;
  };

  return async (tool, host) => {
    if (!tool.hooksSource) return inRealmHookExecutor(tool, host);
    try {
      return await mountInThread(tool, host);
    } catch (e) {
      if (!allowFallback) {
        if (e instanceof NodeHookIsolationError) throw e;
        throw new NodeHookIsolationError((e as Error).message);
      }
      host.log('warn', `worker-thread hooks unavailable - running in-realm: ${(e as Error).message}`, { toolId: tool.manifest.id });
      return inRealmHookExecutor(tool, host);
    }
  };
}
