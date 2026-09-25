// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation stage CORE: the registry, the message protocol, the named
 * errors and the worker message loop, shared by both realms (plan 274 section 9,
 * "Work scheduling"; the Codex review section 5, "Schedule work around the
 * person": keep census, plan and compile pure and run them in a shell-owned
 * worker).
 *
 * THE THREE FILES AND WHY THEY ARE THREE
 * - stage-core.ts (this file) holds everything both realms need. The main thread
 *   imports it; the worker entry imports it. It registers no stage of its own,
 *   so importing it pulls no stage code into the main bundle.
 * - stages.ts holds the registrations. A new stage adds one import there for its
 *   side effect. The worker entry imports it; the runner's in-realm fallback
 *   reaches it through a dynamic import, so census, plan and compile stay out of
 *   the main chunk until a realm without Worker actually needs them.
 * - stage-worker.ts is the worker entry and nothing else. Nothing on the main
 *   thread imports it, which is what keeps the registry one Map per realm from
 *   turning into a surprise: a registration made on the main thread reaches the
 *   main thread alone.
 *
 * This is the pattern the repo already uses for hooks: engine's
 * hook-worker-core.ts beside bridge/hook-worker.worker.ts.
 *
 * NO DOM HERE. No document, no window, no ImageBitmap. A stage gets its input,
 * its budget and a context that reports progress and answers whether a cancel
 * arrived; everything else is the caller's problem.
 */
import type { DecodeBudgetV1, ProjectStageV1, StageProgressV1 } from '@lolly-tools/core';

// ---------------------------------------------------------------------------
// The named errors
// ---------------------------------------------------------------------------

export interface StageCancelledInfoV1 {
  /** The stage observed the cancel and stopped on its own. */
  acknowledged?: boolean;
  /** The worker was killed because it did not stop inside the grace. */
  terminated?: boolean;
}

/** The named error every cancelled stage rejects with, in either realm. */
export class StageCancelledError extends Error {
  readonly acknowledged: boolean;
  readonly terminated: boolean;
  constructor(message = 'The stage was cancelled.', info: StageCancelledInfoV1 = {}) {
    super(message);
    this.name = 'StageCancelledError';
    this.acknowledged = info.acknowledged === true;
    this.terminated = info.terminated === true;
  }
}

/** True for a cancellation raised in either realm, including one that crossed a message. */
export function isStageCancelled(err: unknown): boolean {
  return err instanceof StageCancelledError || (err instanceof Error && err.name === 'StageCancelledError');
}

/** Raised when a name has no registered stage function. */
export class UnknownStageError extends Error {
  readonly stageName: string;
  constructor(name: string) {
    super(`No stage is registered under the name "${name}".`);
    this.name = 'UnknownStageError';
    this.stageName = name;
  }
}

/**
 * Raised when a terminal reply arrives tagged for another project or another
 * plan revision. Dropping such a reply in silence would leave the run pending
 * for the life of the page with the heavy slot held, so the run fails instead
 * and the caller can recognise the reason.
 */
export class StaleReplyError extends Error {
  readonly projectId: string;
  readonly planRevision: number | undefined;
  constructor(projectId: string, planRevision: number | undefined) {
    super('The stage answered for work the view has moved past.');
    this.name = 'StaleReplyError';
    this.projectId = projectId;
    this.planRevision = planRevision;
  }
}

/** Raised when a worker says nothing at all for longer than the reply budget. */
export class StageStalledError extends Error {
  readonly quietMs: number;
  constructor(quietMs: number) {
    super('The stage stopped reporting, so its worker was ended.');
    this.name = 'StageStalledError';
    this.quietMs = quietMs;
  }
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/** What a stage function gets besides its input. */
export interface StageRunCtxV1 {
  readonly budget: DecodeBudgetV1;
  /** True once a cancel arrived. Poll it between slides. */
  readonly cancelled: boolean;
  /** Throws StageCancelledError when a cancel arrived. Call it between units of work. */
  throwIfCancelled(): void;
  /** Counts and a sentence, never an invented percentage. */
  progress(message: string, done?: number, total?: number): void;
}

export type StageFnV1<I = unknown, O = unknown> = (input: I, ctx: StageRunCtxV1) => Promise<O> | O;

const registry = new Map<string, StageFnV1>();

/**
 * Register a stage function under a name, IN THE CALLING REALM ONLY.
 *
 * A worker has its own module graph, so a call made on the main thread is
 * invisible to the worker that runs the work. A real stage therefore registers
 * from stages.ts, which both realms load; this function is what stages.ts and
 * the tests call. Registering the same name again replaces it.
 */
export function registerStage<I, O>(name: string, fn: StageFnV1<I, O>): void {
  registry.set(name, fn as StageFnV1);
}

/** Whether this realm holds a registration under the name. */
export function hasStage(name: string): boolean { return registry.has(name); }

/** The names this realm holds, sorted. */
export function stageNames(): string[] { return [...registry.keys()].sort(); }

/** Run a registered stage in the current realm. Used by the worker and by the runner's fallback. */
export async function runRegisteredStage(name: string, input: unknown, ctx: StageRunCtxV1): Promise<unknown> {
  const fn = registry.get(name);
  if (!fn) throw new UnknownStageError(name);
  return await fn(input, ctx);
}

/**
 * The one built-in: hand back what was given, after one progress message. It is
 * what the runner's own tests drive, so the message path is exercised without a
 * real stage, and it is the reference for the form a stage function takes. The
 * name lives here; the registration lives in stages.ts with every other one.
 */
export const ECHO_STAGE = 'echo';

export const echoStage: StageFnV1<unknown, unknown> = (input, ctx) => {
  ctx.throwIfCancelled();
  ctx.progress('Echoing the input', 1, 1);
  return input;
};

/** Test-only: drop every registration and put the built-in back. */
export function __resetStagesForTest(): void {
  registry.clear();
  registerStage<unknown, unknown>(ECHO_STAGE, echoStage);
}

// ---------------------------------------------------------------------------
// The message protocol
// ---------------------------------------------------------------------------

/**
 * Every request carries the project id and the plan revision it was made for, and
 * every reply echoes them back, so the runner can drop a reply that belongs to
 * another project or an older revision before it ever reaches a view.
 */
export interface StageRunRequestV1 {
  id: number;
  type: 'run';
  projectId: string;
  planRevision?: number;
  stage: ProjectStageV1;
  /** Registered stage name. The runner defaults it to the stage. */
  name: string;
  algorithmVersion: string;
  budget: DecodeBudgetV1;
  input: unknown;
}

export interface StageCancelRequestV1 { id: number; type: 'cancel' }

export type StageWorkerRequestV1 = StageRunRequestV1 | StageCancelRequestV1;

export interface StageWorkerReplyV1 {
  id: number;
  projectId: string;
  planRevision?: number;
  /** Counts and a sentence; the runner stamps the project and stage onto it. */
  progress?: { message: string; done?: number; total?: number };
  /** Sent the moment a cancel was observed, before the stage has stopped. */
  cancelAck?: true;
  /** Terminal: the stage stopped because it was cancelled. */
  cancelled?: true;
  /** Terminal: the stage finished. */
  result?: unknown;
  /** Terminal: a real failure, flattened to a message. */
  error?: string;
  /** The failure's error name, so the runner can rebuild a named error. */
  errorName?: string;
  /** The stage name an UnknownStageError named. */
  errorStageName?: string;
}

/** Whether a reply ends its run. A progress or an acknowledgement does not. */
export function isTerminalReply(reply: StageWorkerReplyV1): boolean {
  return reply.cancelled === true || reply.error !== undefined || 'result' in reply;
}

// ---------------------------------------------------------------------------
// The worker message loop
// ---------------------------------------------------------------------------

/** The part of a worker global this loop uses. Structural, so no DOM types are needed. */
export interface StageWorkerScopeV1 {
  addEventListener(type: 'message', listener: (event: { data: StageWorkerRequestV1 }) => void): void;
  postMessage(message: StageWorkerReplyV1): void;
}

/** The worker global, or null in a window or under node. */
export function workerScope(): StageWorkerScopeV1 | null {
  const g = globalThis as Partial<StageWorkerScopeV1> & {
    WorkerGlobalScope?: unknown;
    document?: unknown;
  };
  if (g.WorkerGlobalScope === undefined) return null;
  if (g.document !== undefined) return null;
  const { postMessage, addEventListener } = g;
  if (typeof postMessage !== 'function' || typeof addEventListener !== 'function') return null;
  // Bound wrappers, so the scope object carries only the two members the worker
  // entry uses and no cast has to vouch for the rest of the global.
  return {
    addEventListener: (type, listener) => addEventListener.call(globalThis, type, listener),
    postMessage: (message) => postMessage.call(globalThis, message),
  };
}

function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'The stage could not finish.';
}

/** The fields a failure travels by, so a named error survives the message boundary. */
function errorFields(err: unknown): { error: string; errorName?: string; errorStageName?: string } {
  const error = errorText(err);
  if (!(err instanceof Error)) return { error };
  const name = err.name;
  if (err instanceof UnknownStageError) return { error, errorName: name, errorStageName: err.stageName };
  return { error, errorName: name };
}

/** Wire one scope up. Exported so a test can drive the loop over a fake scope. */
export function installStageWorker(scope: StageWorkerScopeV1): void {
  const live = new Map<number, { cancelled: boolean; projectId: string; planRevision?: number }>();

  scope.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'cancel') {
      const state = live.get(msg.id);
      if (!state) return;
      state.cancelled = true;
      // Acknowledge at once: the runner's grace measures the time to this reply.
      scope.postMessage({
        id: msg.id,
        projectId: state.projectId,
        ...(state.planRevision === undefined ? {} : { planRevision: state.planRevision }),
        cancelAck: true,
      });
      return;
    }

    if (msg.type !== 'run') return;
    const { id, projectId, planRevision } = msg;
    const state = { cancelled: false, projectId, ...(planRevision === undefined ? {} : { planRevision }) };
    live.set(id, state);

    const ctx: StageRunCtxV1 = {
      budget: msg.budget,
      get cancelled() { return state.cancelled; },
      throwIfCancelled(): void {
        if (state.cancelled) throw new StageCancelledError('The stage was cancelled.', { acknowledged: true });
      },
      progress(message: string, done?: number, total?: number): void {
        const p: { message: string; done?: number; total?: number } = { message };
        if (done !== undefined) p.done = done;
        if (total !== undefined) p.total = total;
        scope.postMessage({ id, projectId, ...(planRevision === undefined ? {} : { planRevision }), progress: p });
      },
    };

    void (async (): Promise<void> => {
      const tag = { id, projectId, ...(planRevision === undefined ? {} : { planRevision }) };
      try {
        const result = await runRegisteredStage(msg.name, msg.input, ctx);
        if (state.cancelled) scope.postMessage({ ...tag, cancelled: true });
        else scope.postMessage({ ...tag, result });
      } catch (err) {
        if (isStageCancelled(err)) scope.postMessage({ ...tag, cancelled: true });
        else scope.postMessage({ ...tag, ...errorFields(err) });
      } finally {
        live.delete(id);
      }
    })();
  });
}

/**
 * A stage progress record, stamped with the project and stage the runner asked
 * for. Kept here beside the protocol so both realms agree on the record's fields.
 */
export function stampProgress(
  req: { projectId: string; planRevision?: number; stage: ProjectStageV1 },
  raw: { message: string; done?: number; total?: number },
): StageProgressV1 {
  return {
    projectId: req.projectId,
    ...(req.planRevision === undefined ? {} : { planRevision: req.planRevision }),
    stage: req.stage,
    message: raw.message,
    ...(raw.done === undefined ? {} : { done: raw.done }),
    ...(raw.total === undefined ? {} : { total: raw.total }),
  };
}
