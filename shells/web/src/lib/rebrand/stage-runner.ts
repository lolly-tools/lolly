// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation STAGE RUNNER: the main-thread half of the stage worker
 * (plan 274 section 9, "Work scheduling"; the Codex review section 5, "Schedule
 * work around the person").
 *
 * WHAT IT PROMISES
 * - A registered stage function runs in a shell-owned worker, one disposable
 *   worker per run, and resolves a StageEnvelopeV1 tagged with the project id,
 *   the plan revision and the algorithm version the run was asked for.
 * - Progress arrives as StageProgressV1: counts and a sentence, never a percentage.
 * - Cancellation rejects with StageCancelledError. The runner posts a cancel and
 *   gives the stage a bounded grace (CANCEL_GRACE.ms, 200 by default, the number
 *   plan 274 asks acknowledgement to arrive inside). A stage that stops inside the
 *   grace rejects with `acknowledged`; one that does not gets its worker killed and
 *   rejects with `terminated`.
 * - A run always reaches a terminal state. A progress or acknowledgement tagged
 *   for another project or revision is dropped, but a terminal reply that does
 *   not match fails the run with StaleReplyError rather than leaving it pending,
 *   and a worker that says nothing for REPLY_BUDGET.ms is ended with
 *   StageStalledError. A pending promise here would hold the one heavy slot for
 *   the life of the page.
 * - `isStale` lets a view drop a settled envelope whose revision the person has
 *   since moved past.
 * - With no Worker in the realm (node tests, the CLI), the same stage runs in
 *   place through the same envelope and the same cancellation semantics. Nothing
 *   in that realm can kill a running function, so an uncooperative stage there is
 *   abandoned rather than terminated, and the error records that.
 *
 * THE HEAVY SLOT RULE (the one the Codex review calls out)
 * "Do not have a parent rebrand job hold the heavy slot while awaiting an OCR
 * child job that needs the same slot." Of the two ways out, this runner takes the
 * first: THE PARENT OWNS THE SLOT AND RUNS ITS INTERNAL STAGES DIRECTLY. A caller
 * claims the slot once with `withHeavySlot` and passes the token it gets into
 * every `runStage` underneath it; a call carrying a token runs at once and never
 * queues.
 *
 * A `runStage` that forgets the token while a slot is held ADOPTS the held slot
 * rather than queueing behind it. Queueing would be a deadlock: the parent is
 * awaiting the child, the child is waiting for the slot the parent holds, and
 * lib/jobs.ts has no timeout, so the slot every other heavy path in the shell
 * shares would be gone for the life of the page. Adoption trades that for the
 * possibility that an unrelated stage started elsewhere runs beside the
 * renovation instead of after it, which is the smaller harm and is recoverable.
 * A stage started with no slot held claims one of its own, which is correct for
 * work started on its own. stage-runner.test.ts pins all three directions.
 *
 * WHERE A STAGE IS REGISTERED
 * In stages.ts, which the worker entry loads and which this file reaches through
 * a dynamic import for the in-realm fallback. `registerStage` is re-exported
 * here for tests and for a stage registered at runtime, and a registration made
 * on the main thread reaches the main thread alone; the worker has its own
 * module graph and its own registry.
 */
import type { DecodeBudgetV1, ProjectStageV1, StageEnvelopeV1, StageProgressV1 } from '@lolly-tools/core';
import { cancelJob, startJob, type JobHandle } from '../jobs.ts';
import {
  ECHO_STAGE,
  StageCancelledError,
  StageStalledError,
  StaleReplyError,
  UnknownStageError,
  hasStage,
  isStageCancelled,
  isTerminalReply,
  registerStage,
  runRegisteredStage,
  stageNames,
  stampProgress,
  type StageFnV1,
  type StageRunCtxV1,
  type StageWorkerReplyV1,
  type StageWorkerRequestV1,
} from './stage-core.ts';

export {
  ECHO_STAGE,
  StageCancelledError,
  StageStalledError,
  StaleReplyError,
  UnknownStageError,
  hasStage,
  isStageCancelled,
  registerStage,
  stageNames,
  type StageFnV1,
  type StageRunCtxV1,
};

/**
 * How long a cancelled stage has to stop before its worker is killed. Mutable so
 * a test can pin it low, the HOOK_BUDGET_MS pattern from engine/src/runtime.ts.
 * The 200 ms default is the acknowledgement target in plan 274 section 9.
 */
export const CANCEL_GRACE = { ms: 200 };

/**
 * How long a worker may say nothing at all before it is ended. Every reply for
 * the run resets it, including a progress message, so a stage that reports
 * between slides never meets it; a worker that died before installing its loop,
 * or a stage that never settles, does. Mutable for the same reason as above.
 */
export const REPLY_BUDGET = { ms: 120_000 };

// ---------------------------------------------------------------------------
// The worker handle
// ---------------------------------------------------------------------------

/** The part of a Worker this runner uses, so a test can supply a fake one. */
export interface StageWorkerLikeV1 {
  postMessage(message: StageWorkerRequestV1, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: { data: StageWorkerReplyV1 }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

let workerFactory: (() => StageWorkerLikeV1) | null = null;

/** Test-only: supply a fake worker, or pass null to go back to the real one. */
export function setStageWorkerFactoryForTest(factory: (() => StageWorkerLikeV1) | null): void {
  workerFactory = factory;
}

function createStageWorker(): StageWorkerLikeV1 | null {
  if (workerFactory) return workerFactory();
  if (typeof Worker === 'undefined') return null;
  // The literal URL stays inline so Vite emits the worker as its own chunk, and
  // nothing in this module imports that entry, so its stages stay out of here.
  const worker = new Worker(new URL('./stage-worker.ts', import.meta.url), { type: 'module' });
  // A thin adapter rather than a cast: the DOM Worker's onmessage takes a
  // MessageEvent, and the runner only ever reads its data.
  let onmessage: StageWorkerLikeV1['onmessage'] = null;
  let onerror: StageWorkerLikeV1['onerror'] = null;
  return {
    postMessage: (message, transfer) => worker.postMessage(message, transfer ?? []),
    terminate: () => worker.terminate(),
    get onmessage() { return onmessage; },
    set onmessage(fn) {
      onmessage = fn;
      worker.onmessage = fn ? (event: MessageEvent) => fn({ data: event.data as StageWorkerReplyV1 }) : null;
    },
    get onerror() { return onerror; },
    set onerror(fn) {
      onerror = fn;
      worker.onerror = fn ? (event: ErrorEvent) => fn(event) : null;
    },
  };
}

/**
 * Load the registrations for the in-realm fallback. The worker entry loads
 * stages.ts itself; this is the one place the main thread needs them, and a
 * dynamic import keeps the stage code out of the main chunk until a realm
 * without Worker asks for it.
 */
let stagesLoaded: Promise<unknown> | null = null;
function ensureStagesLoaded(): Promise<unknown> {
  stagesLoaded ??= import('./stages.ts');
  return stagesLoaded;
}

// ---------------------------------------------------------------------------
// The heavy slot
// ---------------------------------------------------------------------------

/**
 * What a stage needs from the slot its caller holds: the job id, whether a
 * cancel arrived, somewhere to report progress, and the signal that carries the
 * person's cancel down to the work.
 */
export interface HeavySlotTokenV1 extends Pick<JobHandle, 'id' | 'cancelled' | 'progress'> {
  /** Aborts when the job holding the slot is cancelled. */
  readonly signal: AbortSignal;
}

/** The slot a `withHeavySlot` call is holding right now, innermost last. */
const heldSlots: HeavySlotTokenV1[] = [];

function currentSlot(): HeavySlotTokenV1 | undefined {
  return heldSlots.length > 0 ? heldSlots[heldSlots.length - 1] : undefined;
}

/**
 * Claim the single heavy slot once and run `work` under it. Every `runStage`
 * inside `work` should take the token, so no stage underneath queues for a slot
 * the caller is holding; one that forgets adopts the same slot rather than
 * deadlocking against it.
 *
 * `title` is shown in the global progress toast, so a caller passes a
 * `t()`-localized string. The job is cancellable: cancelling it aborts the
 * signal on the token, which is how a cancel from the toast reaches the stages.
 */
export async function withHeavySlot<T>(
  title: string,
  work: (slot: HeavySlotTokenV1) => Promise<T> | T,
): Promise<T> {
  const controller = new AbortController();
  const handle = startJob({ title, heavy: true, cancel: () => { controller.abort(); } });
  try {
    await handle.started;
    if (handle.cancelled) throw new StageCancelledError('The work was cancelled before it started.', { acknowledged: true });
    const token: HeavySlotTokenV1 = {
      id: handle.id,
      get cancelled() { return handle.cancelled; },
      progress: (done, total, note) => { handle.progress(done, total, note); },
      signal: controller.signal,
    };
    heldSlots.push(token);
    try {
      const value = await work(token);
      handle.finish();
      return value;
    } finally {
      const at = heldSlots.indexOf(token);
      if (at >= 0) heldSlots.splice(at, 1);
    }
  } catch (err) {
    // A cancellation is not a failure: record it as one and the toast shows a
    // red error for work the person stopped on purpose.
    if (isStageCancelled(err)) cancelJob(handle.id);
    else handle.fail(err);
    throw err;
  } finally {
    handle.settle();
  }
}

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------

export interface StageTagV1 { projectId: string; planRevision?: number }

/**
 * Whether a settled result belongs to work the view has moved past. A different
 * project is always stale. An envelope carrying no revision (ingest, census) is
 * not bound to one, so it is never stale on revision grounds. An envelope that
 * names a revision is stale when the view names a different one AND when the
 * view names none at all, because a view with no plan has discarded the plan the
 * result was computed against.
 */
export function isStale(envelope: StageTagV1, current: StageTagV1): boolean {
  if (envelope.projectId !== current.projectId) return true;
  if (envelope.planRevision === undefined) return false;
  if (current.planRevision === undefined) return true;
  return envelope.planRevision !== current.planRevision;
}

// ---------------------------------------------------------------------------
// runStage
// ---------------------------------------------------------------------------

export interface RunStageOptsV1<I = unknown> {
  projectId: string;
  planRevision?: number;
  stage: ProjectStageV1;
  /** Registered stage name. Defaults to the stage. */
  name?: string;
  algorithmVersion: string;
  input: I;
  /** Buffers whose ownership moves to the worker. Never pass bytes a caller still reads. */
  transfer?: Transferable[];
  budget: DecodeBudgetV1;
  signal?: AbortSignal;
  onProgress?: (progress: StageProgressV1) => void;
  /** A slot the caller already holds. With one, this call runs at once instead of queueing. */
  slot?: HeavySlotTokenV1;
  /**
   * What the global progress toast calls this work. Required, and a
   * `t()`-localized string: the toast shows it to the person in their language.
   * It is read only when this call claims a slot of its own.
   */
  title: string;
  /** Claim the heavy slot when no token was passed. Default true. */
  heavy?: boolean;
  /**
   * Run without a job of its own when no slot is held: nothing on the job toast, and no
   * wait in the heavy queue. For a stage whose caller shows its own progress (the
   * Proposed pane's Updating pill) and whose work is small next to a read. Under a held
   * slot it changes nothing: the stage adopts the slot as ever.
   */
  quiet?: boolean;
}

type RawProgress = { message: string; done?: number; total?: number };

/** Somewhere a progress report can land besides the caller's callback. */
type ProgressSink = Pick<JobHandle, 'progress'>;

/** Request ids are per realm and only ever compared against the reply of the same run. */
let requestSeq = 0;

function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  // A browser timer is a number; a node timer carries unref(). Narrow, never cast.
  const t: unknown = timer;
  if (typeof t === 'object' && t !== null && 'unref' in t) {
    const { unref } = t as { unref?: unknown };
    if (typeof unref === 'function') unref.call(t);
  }
}

function cancelGraceMs(): number {
  return Math.max(0, CANCEL_GRACE.ms);
}

function replyBudgetMs(): number {
  const ms = REPLY_BUDGET.ms;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/** One signal that aborts when either source does, plus the way to unwire it. */
function linkSignals(a: AbortSignal | undefined, b: AbortSignal | undefined): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onAbort = (): void => { controller.abort(); };
  const sources = [a, b].filter((s): s is AbortSignal => s !== undefined);
  if (sources.some((s) => s.aborted)) controller.abort();
  else for (const s of sources) s.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => { for (const s of sources) s.removeEventListener('abort', onAbort); },
  };
}

/** Rebuild a named error the worker flattened to a message. */
function errorFromReply(data: StageWorkerReplyV1): Error {
  const message = data.error ?? 'The stage could not finish.';
  if (data.errorName === 'UnknownStageError') return new UnknownStageError(data.errorStageName ?? '');
  const err = new Error(message);
  if (data.errorName) err.name = data.errorName;
  return err;
}

/** Run the stage in a worker, resolving its raw result. */
function runInWorker(
  worker: StageWorkerLikeV1,
  opts: RunStageOptsV1,
  name: string,
  signal: AbortSignal | undefined,
  report: (raw: RawProgress) => void,
): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const id = ++requestSeq;
    let settled = false;
    let acknowledged = false;
    let cancelling = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const clearIdle = (): void => {
      if (idleTimer !== undefined) clearTimeout(idleTimer);
      idleTimer = undefined;
    };

    const armIdle = (): void => {
      clearIdle();
      const ms = replyBudgetMs();
      if (ms <= 0 || cancelling) return;
      idleTimer = setTimeout(() => { failWith(new StageStalledError(ms)); }, ms);
      unrefTimer(idleTimer);
    };

    const cleanup = (): void => {
      settled = true;
      if (graceTimer !== undefined) clearTimeout(graceTimer);
      clearIdle();
      signal?.removeEventListener('abort', onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      // One disposable worker per run, so disposal is part of settling either way.
      try { worker.terminate(); } catch { /* a worker already gone needs nothing */ }
    };
    const succeed = (value: unknown): void => { if (settled) return; cleanup(); resolve(value); };
    const failWith = (err: unknown): void => { if (settled) return; cleanup(); reject(err); };

    function onAbort(): void {
      if (settled) return;
      cancelling = true;
      clearIdle();   // the grace governs from here
      try { worker.postMessage({ id, type: 'cancel' }); } catch { /* a worker already gone needs nothing */ }
      graceTimer = setTimeout(() => {
        failWith(new StageCancelledError(
          'The stage did not stop when it was cancelled, so its worker was ended.',
          { acknowledged, terminated: true },
        ));
      }, cancelGraceMs());
      unrefTimer(graceTimer);
    }

    worker.onerror = () => { failWith(new Error('The local stage worker could not finish.')); };
    worker.onmessage = ({ data }): void => {
      if (!data || data.id !== id) return;
      // A reply for this run means the worker is alive, whatever it says.
      armIdle();
      if (data.projectId !== opts.projectId || data.planRevision !== opts.planRevision) {
        // A progress or acknowledgement for another project or revision is
        // nothing to act on. A TERMINAL one is: it is the only answer this run
        // will get, so it fails the run instead of leaving it pending forever.
        if (isTerminalReply(data)) failWith(new StaleReplyError(data.projectId, data.planRevision));
        return;
      }
      if (data.cancelAck) { acknowledged = true; return; }
      if (data.progress) { report(data.progress); return; }
      if (data.cancelled) {
        failWith(new StageCancelledError('The stage was cancelled.', { acknowledged: true, terminated: false }));
        return;
      }
      if (data.error !== undefined) { failWith(errorFromReply(data)); return; }
      succeed(data.result);
    };

    if (signal?.aborted) {
      failWith(new StageCancelledError('The stage was cancelled before it started.', { acknowledged: true }));
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    const request: StageWorkerRequestV1 = {
      id,
      type: 'run',
      projectId: opts.projectId,
      ...(opts.planRevision === undefined ? {} : { planRevision: opts.planRevision }),
      stage: opts.stage,
      name,
      algorithmVersion: opts.algorithmVersion,
      budget: opts.budget,
      input: opts.input,
    };
    try {
      worker.postMessage(request, opts.transfer);
      armIdle();
    } catch {
      failWith(new Error('The stage input could not be sent to the worker.'));
    }
  });
}

/**
 * Run the stage in this realm. Same envelope and same cancellation semantics as
 * the worker path; the one difference is that nothing here can end a function
 * that ignores the cancel, so after the grace the result is abandoned and the
 * error says the stage never acknowledged.
 */
function runInRealm(
  opts: RunStageOptsV1,
  name: string,
  signal: AbortSignal | undefined,
  report: (raw: RawProgress) => void,
): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const state = { cancelled: false };
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      settled = true;
      if (graceTimer !== undefined) clearTimeout(graceTimer);
      signal?.removeEventListener('abort', onAbort);
    };
    const succeed = (value: unknown): void => { if (settled) return; cleanup(); resolve(value); };
    const failWith = (err: unknown): void => { if (settled) return; cleanup(); reject(err); };

    function onAbort(): void {
      if (settled) return;
      state.cancelled = true;
      graceTimer = setTimeout(() => {
        failWith(new StageCancelledError(
          'The stage did not stop when it was cancelled, so its result was abandoned.',
          { acknowledged: false, terminated: false },
        ));
      }, cancelGraceMs());
      unrefTimer(graceTimer);
    }

    const ctx: StageRunCtxV1 = {
      budget: opts.budget,
      get cancelled() { return state.cancelled; },
      throwIfCancelled(): void {
        if (state.cancelled) throw new StageCancelledError('The stage was cancelled.', { acknowledged: true });
      },
      progress(message: string, done?: number, total?: number): void {
        if (settled) return;
        report({ message, ...(done === undefined ? {} : { done }), ...(total === undefined ? {} : { total }) });
      },
    };

    if (signal?.aborted) {
      reject(new StageCancelledError('The stage was cancelled before it started.', { acknowledged: true }));
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    void (async (): Promise<void> => {
      try {
        await ensureStagesLoaded();
        const result = await runRegisteredStage(name, opts.input, ctx);
        if (state.cancelled) {
          failWith(new StageCancelledError('The stage was cancelled.', { acknowledged: true, terminated: false }));
          return;
        }
        succeed(result);
      } catch (err) {
        if (isStageCancelled(err)) {
          failWith(new StageCancelledError('The stage was cancelled.', { acknowledged: true, terminated: false }));
          return;
        }
        failWith(err);
      }
    })();
  });
}

function envelopeOf<O>(opts: RunStageOptsV1, result: O): StageEnvelopeV1<O> {
  return {
    projectId: opts.projectId,
    ...(opts.planRevision === undefined ? {} : { planRevision: opts.planRevision }),
    stage: opts.stage,
    algorithmVersion: opts.algorithmVersion,
    result,
  };
}

/**
 * Run one registered stage and resolve its envelope.
 *
 * With `slot`, or while a `withHeavySlot` call is holding one, the stage runs at
 * once under that slot. With no slot held anywhere, it claims one from
 * lib/jobs.ts and waits its turn, so a stage started on its own still serialises
 * against other heavy work.
 */
export async function runStage<I = unknown, O = unknown>(opts: RunStageOptsV1<I>): Promise<StageEnvelopeV1<O>> {
  const name = opts.name ?? opts.stage;
  const base = opts as RunStageOptsV1;

  const execute = async (signal: AbortSignal | undefined, report: (raw: RawProgress) => void): Promise<unknown> => {
    const worker = createStageWorker();
    return worker
      ? await runInWorker(worker, base, name, signal, report)
      : await runInRealm(base, name, signal, report);
  };

  const emit = (raw: RawProgress, sink?: ProgressSink): void => {
    const progress = stampProgress(base, raw);
    opts.onProgress?.(progress);
    sink?.progress(progress.done ?? 0, progress.total ?? 0, progress.message);
  };

  const slot = opts.slot ?? currentSlot();
  if (slot) {
    // The caller's own signal and the slot's cancel are one channel here.
    const linked = linkSignals(opts.signal, slot.signal);
    try {
      if (slot.cancelled || linked.signal.aborted) {
        throw new StageCancelledError('The stage was cancelled before it started.', { acknowledged: true });
      }
      const result = await execute(linked.signal, (raw) => { emit(raw, slot); });
      return envelopeOf<O>(base, result as O);
    } finally {
      linked.dispose();
    }
  }

  if (opts.quiet) {
    if (opts.signal?.aborted) {
      throw new StageCancelledError('The stage was cancelled before it started.', { acknowledged: true });
    }
    const result = await execute(opts.signal, (raw) => { emit(raw); });
    return envelopeOf<O>(base, result as O);
  }

  // A slot of this call's own. The job registry's cancel and the caller's signal
  // are the same channel, so cancelling the toast cancels the stage.
  const controller = new AbortController();
  const onOuterAbort = (): void => { controller.abort(); };
  if (opts.signal?.aborted) {
    throw new StageCancelledError('The stage was cancelled before it started.', { acknowledged: true });
  }
  const handle = startJob({ title: opts.title, heavy: opts.heavy !== false, cancel: () => { controller.abort(); } });
  opts.signal?.addEventListener('abort', onOuterAbort, { once: true });
  try {
    await handle.started;
    if (handle.cancelled) {
      throw new StageCancelledError('The stage was cancelled before it started.', { acknowledged: true });
    }
    const value = await execute(controller.signal, (raw) => { emit(raw, handle); });
    handle.finish();
    return envelopeOf<O>(base, value as O);
  } catch (err) {
    // A cancellation is recorded as a cancellation, so the toast does not show a
    // red failure for work the person stopped.
    if (isStageCancelled(err)) cancelJob(handle.id);
    else handle.fail(err);
    throw err;
  } finally {
    opts.signal?.removeEventListener('abort', onOuterAbort);
    handle.settle();
  }
}
