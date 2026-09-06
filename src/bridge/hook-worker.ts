// SPDX-License-Identifier: MPL-2.0
/**
 * Main-thread client for the hook Worker (hook-worker.worker.ts) - the web
 * shell's Worker-isolated HookExecutor (plans/86-worker-isolation-hooks.md M2).
 *
 * `getWorkerHookExecutor()` returns a `HookExecutor` the mount chokepoint injects
 * into `createRuntime` when a tool opts in. For each mount it:
 *   1. introspects the live host (which methods exist) → the worker builds a
 *      proxy whose ABSENT methods stay absent (hooks' feature-detection survives);
 *   2. snapshots the brand token doc + the sync feature-detect seeds;
 *   3. inits a shared singleton worker with that mount's runId and returns a
 *      dedicated Worker with that mount's runId and returns a `Hooks` object
 *      whose worker-backed slots postMessage a hook invocation and
 *      resolve the patch - which runHook already time-boxes like an async hook.
 * It also SERVICES the worker's `host-call` RPCs against THAT mount's real host
 * (so host.net's per-mount allowlist can't leak across tools), and forwards the
 * worker's batched log lines to host.log.
 *
 * Built-in compatibility mounts may fall back to the in-realm path. Untrusted
 * mounts select strict mode: isolation failure rejects the mount, and a tool
 * declaring a DOM-node export hook is refused rather than compiled in-realm.
 */
import { HOOK_BUDGET_MS, inRealmHookExecutor } from '@lolly/engine';
import type { HookExecutor, Hooks } from '@lolly/engine';
import type { HostV1, TokensAPI } from '@lolly-tools/core/host-v1';
import { getExcludedSwatches } from '../lib/brand-exclusions.ts';
import type {
  HostShape, HostSeeds, HookWorkerOut, WorkerHookName,
  HookHostCallMsg, HookInvokeDoneMsg, HookInitDoneMsg, HookLogMsg,
} from './hook-worker.worker.ts';
import { workerRpcMethods, introspectHost, gatherHostSeeds } from './hook-worker.worker.ts';

/** Backstop for Worker startup. Strict mounts fail closed; compatibility mounts
 * may use the explicitly enabled in-realm fallback. */
const INIT_TIMEOUT_MS = 5000;

/** Per-frame/sample hooks are deliberately outside the engine's async timeout,
 * because the runtime drops overlaps. A Worker still needs a hard watchdog: a
 * synchronous infinite loop cannot yield for overlap control or cancellation. */
export const WORKER_HOOK_BUDGET_MS: Readonly<Record<WorkerHookName, number>> = {
  onInit: HOOK_BUDGET_MS.onInit,
  onInput: HOOK_BUDGET_MS.onInput,
  onFrame: 2000,
  onLevel: 2000,
  exportFile: HOOK_BUDGET_MS.exportFile,
};

let runSeq = 0;
let callSeq = 0;
interface WorkerMount {
  host: HostV1;
  allowedRpc: Set<string>;
}
const mounts = new Map<number, WorkerMount>();
const workers = new Map<number, Worker>();
const initWaiters = new Map<number, { resolve: (m: HookInitDoneMsg) => void; reject: (e: unknown) => void }>();
const invokeWaiters = new Map<string, {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  report?: (patch: Record<string, unknown>) => void;
}>(); // `runId:callId`

/** Terminate one wedged/crashed Worker. Workers are deliberately per-mount: an
 * untrusted hook must not observe another tool's invoke contexts or host replies
 * by installing its own global message listener. */
function resetRun(runId: number, reason: Error): void {
  const doomed = workers.get(runId);
  workers.delete(runId);
  if (doomed) {
    doomed.onmessage = null;
    doomed.onerror = null;
    doomed.terminate();
  }
  for (const [key, pending] of invokeWaiters) {
    if (!key.startsWith(`${runId}:`)) continue;
    clearTimeout(pending.timer);
    pending.reject(reason);
    invokeWaiters.delete(key);
  }
  const init = initWaiters.get(runId);
  if (init) {
    initWaiters.delete(runId);
    init.reject(reason);
  }
  mounts.delete(runId);
}

function createWorker(runId: number): Worker {
  const w = new Worker(new URL('./hook-worker.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<HookWorkerOut>): void => { onMessage(runId, w, e.data); };
  w.onerror = (): void => {
    resetRun(runId, new HookIsolationUnavailableError('hook Worker crashed'));
  };
  workers.set(runId, w);
  return w;
}

function onMessage(boundRunId: number, source: Worker, m: HookWorkerOut): void {
  // A hook can call the Worker-global postMessage itself. It is confined to its
  // own dedicated Worker and cannot impersonate another run.
  if (m.runId !== boundRunId || workers.get(boundRunId) !== source) return;
  if (m.t === 'init-done') { initWaiters.get(m.runId)?.resolve(m); initWaiters.delete(m.runId); return; }
  if (m.t === 'report') { invokeWaiters.get(`${m.runId}:${m.callId}`)?.report?.(m.patch); return; }
  if (m.t === 'invoke-done') {
    const key = `${m.runId}:${(m as HookInvokeDoneMsg).callId}`;
    const p = invokeWaiters.get(key);
    if (!p) return;
    invokeWaiters.delete(key);
    clearTimeout(p.timer);
    if (m.ok) p.resolve(m.patch); else p.reject(new Error(m.error ?? 'hook failed'));
    return;
  }
  if (m.t === 'host-call') { void dispatchHostCall(source, m); return; }
  if (m.t === 'log') { forwardLogs(m); return; }
}

/** Service a worker host-call against the MOUNT's own host (per-mount scoping). */
async function dispatchHostCall(w: Worker, m: HookHostCallMsg): Promise<void> {
  const reply = (ok: boolean, value?: unknown, error?: string): void =>
    w.postMessage({ t: 'host-reply', runId: m.runId, hostCallId: m.hostCallId, ok, value, error });
  const mount = mounts.get(m.runId);
  if (!mount) { reply(false, undefined, 'mount disposed'); return; }
  if (!mount.allowedRpc.has(m.method)) {
    reply(false, undefined, `host.${m.method} is not permitted from an isolated hook`);
    return;
  }
  const host = mount.host;
  const dot = m.method.indexOf('.');
  const ns = m.method.slice(0, dot);
  const method = m.method.slice(dot + 1);
  const nsObj = (host as unknown as Record<string, Record<string, unknown>>)[ns];
  const fn = nsObj?.[method];
  if (typeof fn !== 'function') { reply(false, undefined, `no host.${m.method}`); return; }
  try {
    const value = await (fn as (...a: unknown[]) => unknown).apply(nsObj, m.args);
    reply(true, value);
  } catch (e) {
    reply(false, undefined, e instanceof Error ? e.message : String(e));
  }
}

function forwardLogs(m: HookLogMsg): void {
  const mount = mounts.get(m.runId);
  if (!mount) return;
  for (const e of m.entries) mount.host.log(e.level as 'debug' | 'info' | 'warn' | 'error', e.msg, e.ctx as object | undefined);
}

const introspect = introspectHost;

const STRICT_NAMESPACE_CAPABILITY: Readonly<Record<string, string | readonly string[]>> = {
  ['net']: 'network',
  clipboard: 'clipboard',
  capture: 'capture',
  compose: 'compose',
  media: 'camera',
  recorder: ['camera', 'microphone', 'screen'],
  filesystem: 'filesystem',
};

const STRICT_OMIT_NAMESPACES = new Set([
  // The runtime owns export delivery and supplies the rendered node. Letting an
  // init/input hook call download/file would bypass the shell's user gesture.
  'export',
  // Bound profile values already arrive through the input model. The complete
  // personal profile is not needed by sideloaded hook code.
  'profile',
]);

/** Reduce an isolated untrusted mount's host proxy to declared capabilities.
 * Absence is the policy: feature detection sees no namespace instead of a stub
 * that rejects only after sensitive arguments have crossed the channel. */
export function strictHostShape(shape: HostShape, capabilities: readonly string[]): HostShape {
  const declared = new Set(capabilities);
  const out: HostShape = {};
  for (const [ns, methods] of Object.entries(shape)) {
    if (STRICT_OMIT_NAMESPACES.has(ns)) continue;
    const required = STRICT_NAMESPACE_CAPABILITY[ns];
    if (typeof required === 'string' && !declared.has(required)) continue;
    if (Array.isArray(required) && !required.some(cap => declared.has(cap))) continue;
    const publicMethods = methods.filter(method => !method.startsWith('_'));
    if (publicMethods.length) out[ns] = publicMethods;
  }
  return out;
}

const gatherSeeds = gatherHostSeeds;

/** The raw brand token doc + its exclusion list, snapshotted once per mount so
 *  the worker rebuilds a local TokenSet (sync get/colors/resolve without RPC). */
async function snapshotTokens(host: HostV1): Promise<{ doc: unknown | null; excluded: string[] }> {
  const t = host.tokens as (TokensAPI & { raw?: () => Promise<unknown> }) | undefined;
  if (!t || typeof t.raw !== 'function') return { doc: null, excluded: [] };
  try {
    const doc = (await t.raw()) ?? null;
    return { doc, excluded: doc ? getExcludedSwatches(doc) : [] };
  } catch { return { doc: null, excluded: [] }; }
}

/** Run one hook in the worker: strip the (non-serializable) host from ctx - the
 *  worker supplies its own proxy - and await the patch. */
function invokeInWorker(runId: number, name: WorkerHookName, ctx: unknown): Promise<unknown> {
  if (!mounts.has(runId)) {
    return Promise.reject(new HookIsolationUnavailableError('hook Worker mount is no longer available'));
  }
  const w = workers.get(runId);
  if (!w) {
    return Promise.reject(new HookIsolationUnavailableError('hook Worker is no longer available'));
  }
  const callId = ++callSeq;
  const key = `${runId}:${callId}`;
  const { host: _omit, report, ...rest } = (ctx ?? {}) as Record<string, unknown> & {
    host?: unknown; report?: (patch: Record<string, unknown>) => void;
  };
  // An onFrame ctx carries `frame.data` (a Uint8ClampedArray); it crosses by
  // STRUCTURED CLONE, deliberately NOT a Transferable. media.ts fans ONE shared
  // MediaFrame object to every live subscriber synchronously (media.ts:74-77), so
  // transferring its buffer would neuter it for a second subscriber. Clone is
  // ~0.1ms at the 480px default working edge (≤~1ms at the 1920 cap) - negligible
  // beside the worker's per-frame encode, and it can't corrupt the camera loop.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!invokeWaiters.has(key)) return;
      resetRun(runId, new HookIsolationUnavailableError(
        `${name} exceeded its ${WORKER_HOOK_BUDGET_MS[name]}ms isolated execution budget`,
      ));
    }, WORKER_HOOK_BUDGET_MS[name]);
    invokeWaiters.set(key, { resolve, reject, timer, report });
    try {
      w.postMessage({ t: 'invoke', runId, callId, name, ctx: rest });
    } catch (error) {
      resetRun(runId, new HookIsolationUnavailableError(
        `could not invoke isolated ${name}: ${error instanceof Error ? error.message : String(error)}`,
      ));
    }
  });
}

async function mountInWorker(
  tool: Parameters<HookExecutor>[0],
  host: HostV1,
  allowInRealmExportHooks: boolean,
): Promise<Hooks> {
  const runId = ++runSeq;
  const w = createWorker(runId);
  const { doc, excluded } = await snapshotTokens(host);
  const hostShape = allowInRealmExportHooks
    ? introspect(host)
    : strictHostShape(introspect(host), tool.manifest.capabilities ?? []);
  const initMsg = await new Promise<HookInitDoneMsg>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!initWaiters.has(runId)) return;
      resetRun(runId, new HookIsolationUnavailableError('hook Worker init timed out'));
    }, INIT_TIMEOUT_MS);
    initWaiters.set(runId, {
      resolve: (m) => { clearTimeout(timer); resolve(m); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    w.postMessage({
      t: 'init', runId,
      hooksSource: tool.hooksSource ?? '',
      tokenDoc: doc, tokenExcluded: excluded,
      hostShape, seeds: gatherSeeds(host),
      shell: host.shell, capabilities: host.capabilities ?? [],
      strict: !allowInRealmExportHooks,
    });
    // The same shape is recomputed below after init. It contains method names,
    // not mutable capability values, so this has no time-of-check/use gap.
  });
  // A worker compile error can't run the hooks there - reject so the executor
  // falls back to in-realm (matching in-realm's loud failure), never a silent
  // all-null-slots mount.
  if (initMsg.compileError) {
    resetRun(runId, new Error(`hook worker compile error: ${initMsg.compileError}`));
    throw new Error(`hook worker compile error: ${initMsg.compileError}`);
  }
  if (!allowInRealmExportHooks && initMsg.inRealmOnlyDeclared.length) {
    const error = new HookIsolationUnavailableError(
      `isolated hooks cannot receive live DOM export nodes (${initMsg.inRealmOnlyDeclared.join(', ')})`,
    );
    resetRun(runId, error);
    throw error;
  }
  // Register the mount ONLY after a clean init, so a failed/timed-out init (which
  // falls back to in-realm) never leaks a host into `mounts`.
  mounts.set(runId, { host, allowedRpc: workerRpcMethods(hostShape) });
  host.log('info', `hooks running in a Worker (${initMsg.declared.join(', ') || 'none declared'})`, { toolId: tool.manifest.id });
  const has = new Set(initMsg.declared);
  const slot = (name: WorkerHookName): ((ctx: unknown) => Promise<unknown>) | null =>
    has.has(name) ? (ctx: unknown) => invokeInWorker(runId, name, ctx) : null;

  // The node-carrying export hooks (beforeExport/afterExport/exportStill) receive
  // a live DOM Element and MUST run in-realm - it can't cross the boundary. Always
  // compile in-realm and source them from there: a hooks.js may DEFINE an export
  // hook without declaring it in the manifest (filter-duotone defines beforeExport
  // but lists only onInit/onInput/onFrame), so the manifest is not a reliable
  // signal - the compiled module is. The in-realm compile is cheap (top-level is
  // function definitions); its onInit/onInput/onFrame exist but are never called
  // (those come from the worker). An export hook that reads render state must read
  // it from the DOM (ctx.node), NOT from module vars an isolated interactive hook
  // wrote - those live in the worker closure (see the overlay-export refactor,
  // plans/86 section 18); this split is only sound once that holds.
  const inRealm = allowInRealmExportHooks ? await inRealmHookExecutor(tool, host) : null;

  return {
    onInit: slot('onInit'),
    onInput: slot('onInput'),
    onFrame: slot('onFrame'),
    onLevel: slot('onLevel'),
    exportFile: slot('exportFile'),
    beforeExport: inRealm?.beforeExport ?? null,
    afterExport: inRealm?.afterExport ?? null,
    exportStill: inRealm?.exportStill ?? null,
    // Teardown (runtime.destroy → hooks.dispose): tell the worker to drop this
    // run and release the main-side host reference. Idempotent.
    dispose: () => {
      if (!mounts.has(runId)) return;
      const w = workers.get(runId);
      w?.postMessage({ t: 'dispose', runId });
      resetRun(runId, new HookIsolationUnavailableError('hook Worker mount disposed'));
    },
  } as unknown as Hooks;
}

/**
 * The Worker-isolated executor. Compatibility callers may explicitly retain the
 * historical in-realm fallback. Untrusted callers disable it and fail closed.
 */
export class HookIsolationUnavailableError extends Error {
  readonly code = 'isolation-unavailable';
  constructor(message: string) {
    super(message);
    this.name = 'HookIsolationUnavailableError';
  }
}

export function getWorkerHookExecutor(
  opts: { allowInRealmFallback?: boolean } = {},
): HookExecutor {
  const allowInRealmFallback = opts.allowInRealmFallback !== false;
  return async (tool, host) => {
    if (!tool.hooksSource) return inRealmHookExecutor(tool, host);
    if (typeof Worker === 'undefined') {
      if (allowInRealmFallback) return inRealmHookExecutor(tool, host);
      throw new HookIsolationUnavailableError('hook Worker is unavailable');
    }
    try {
      return await mountInWorker(tool, host, allowInRealmFallback);
    } catch (e) {
      if (!allowInRealmFallback) {
        if (e instanceof HookIsolationUnavailableError) throw e;
        throw new HookIsolationUnavailableError((e as Error).message);
      }
      host.log('warn', `worker hooks unavailable - running in-realm: ${(e as Error).message}`, { toolId: tool.manifest.id });
      return inRealmHookExecutor(tool, host);
    }
  };
}
