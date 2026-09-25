// SPDX-License-Identifier: MPL-2.0
/**
 * Async job registry - the async-job foundation (plans/124 section 9, WP-F).
 *
 * A tiny, framework-free, DOM-free singleton that models long-running work
 * (video matte/crop/upscale, a big retouch run) as observable JOBS with a
 * lifecycle. It is the contract the global progress toast (lib/job-toast.ts)
 * subscribes to, and the surface WP-G's video pipeline drives from a worker
 * callback. Deliberately no imports: pure state + pub/sub, so it unit-tests
 * headless and can be exercised from any realm.
 *
 * WHY A SERIAL QUEUE
 * A "heavy" job (the default) claims a single process-wide slot: only one runs
 * at a time. wasm inference and a streaming WebCodecs transcode each want most
 * of the tab's address space, so two in flight is the OOM the queue exists to
 * prevent (the same "concurrency 1" rule pro/run-overlay.ts states for a batch
 * render, made global here). A caller marks a cheap job `heavy: false` to opt
 * out and run immediately alongside a heavy one.
 *
 * HOW A CALLER DRIVES ONE (the WP-G contract)
 *   const job = startJob({ title: t('Removing background'), cancel: () => abort() });
 *   try {
 *   await job.started;               // your turn in the serial queue (immediate if idle)
 *   if (job.cancelled) return;       // cancelled while still queued
 *   for (…each frame…) {
 *     if (job.cancelled) return;     // cooperative: poll between frames
 *     job.progress(i, frameCount);   // 0 total ⇒ indeterminate bar
 *   }
 *   job.finish(outputAsset);         // or job.fail(err)
 *   } finally { job.settle(); }
 *
 * `runJob(opts, work)` wraps that await-started / finish / fail dance for the
 * common case; the raw handle stays for a worker-callback driver that reports
 * from outside a single async function.
 *
 * NO PERSISTENCE across reloads in v1 - a job dies with the tab. The toast says
 * so; nothing here writes to storage.
 */

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

/** A job's latest progress. `total <= 0` means indeterminate (no known end). */
export interface JobProgress {
  done: number;
  total: number;
  note?: string;
}

/** A registry record. Read-only to subscribers; the registry owns every write. */
export interface Job {
  readonly id: string;
  readonly title: string;
  /** Heavy jobs share ONE serial slot; light jobs run immediately. Default heavy. */
  readonly heavy: boolean;
  /** Whether a cancel callback was supplied - the toast hides ✕ when it wasn't. */
  readonly cancellable: boolean;
  status: JobStatus;
  /** null until the first progress() call - the toast shows an indeterminate bar. */
  progress: JobProgress | null;
  /** Set by finish() - opaque payload (WP-G: the derived asset). */
  result?: unknown;
  /** Set by fail() - a flattened message, never a raw Error (worker-safe). */
  error?: string;
  readonly createdAt: number;
  /** When it reached a terminal state (done/failed/cancelled). */
  endedAt?: number;
}

/** The lifecycle handle returned by startJob - the driver's whole surface. */
export interface JobHandle {
  readonly id: string;
  /**
   * Resolves when it is this job's turn to run: immediately for a light job or
   * an idle heavy queue, otherwise once the prior heavy job settles. Never
   * rejects - a cancel-before-turn resolves it too, so always check
   * {@link JobHandle.cancelled} after awaiting.
   */
  readonly started: Promise<void>;
  /** True once a cancel was requested. Poll it between frames (cooperative). */
  readonly cancelled: boolean;
  /** Report progress. `total <= 0` ⇒ indeterminate. A no-op after a terminal state. */
  progress(done: number, total: number, note?: string): void;
  /** Mark done and free the heavy slot; preserve cancelled status on late completion. */
  finish(result?: unknown): void;
  /** Mark failed and free the heavy slot; preserve cancelled status on late failure. */
  fail(err: unknown): void;
  /** Release resources after cancelled work has actually stopped. Call from finally. */
  settle(): void;
}

export interface StartJobOpts {
  /** Shown in the toast. Callers pass a `t()`-localized string. */
  title: string;
  /** Invoked (once) by cancelJob(id) - abort the underlying work here. */
  cancel?: () => void;
  /** Serialize this job against other heavy jobs. Default true. */
  heavy?: boolean;
  /** Keep a cancelled active job's slot until finish/fail/settle. Default true. */
  retainSlotOnCancel?: boolean;
}

/** Bound waiting work independently of the single active heavy job. */
export const MAX_QUEUED_HEAVY_JOBS = 32;
export class JobQueueFullError extends Error {
  constructor() { super('Too many jobs are waiting. Wait for one to finish and try again.'); this.name = 'JobQueueFullError'; }
}

/** A change listener - receives an immutable snapshot of every live job. */
export type JobsListener = (jobs: readonly Job[]) => void;

/**
 * How long a terminal job lingers in the list so the toast can show its
 * done/failed state before it disappears. A mutable object (not a bare `let`,
 * which can't be reassigned across a module boundary) so tests can pin it - set
 * `.ms` high to freeze the list, or 0 to prune on the next tick. The
 * HOOK_BUDGET_MS pattern from engine/src/runtime.ts.
 */
export const RETENTION = { ms: 6000 };

// ── Internal state ───────────────────────────────────────────────────────────

interface JobEntry {
  job: Job;
  cancel?: () => void;
  resolveStarted: () => void;
  startedSettled: boolean;
  cancelled: boolean;
  ownsSlot: boolean;
  retainSlotOnCancel: boolean;
  pruneTimer?: ReturnType<typeof setTimeout>;
  /** Set by `dismissJob` on a job still running: it leaves the list as soon as it ends. */
  dismissed?: boolean;
}

const entries: JobEntry[] = [];
const listeners = new Set<JobsListener>();
let seq = 0;

const TERMINAL: ReadonlySet<JobStatus> = new Set<JobStatus>(['done', 'failed', 'cancelled']);
const isTerminal = (s: JobStatus): boolean => TERMINAL.has(s);

/** Emit an immutable snapshot to every subscriber. Never throws out. */
function emit(): void {
  const snap = entries.map(e => e.job);
  Object.freeze(snap);
  for (const l of [...listeners]) {
    try { l(snap); } catch { /* a listener must never break the registry */ }
  }
}

/** Is a heavy job currently occupying the single slot? */
function heavyBusy(): boolean {
  return entries.some(e => e.job.heavy && e.ownsSlot);
}

/**
 * Start the next queued heavy job if the slot is free. Light jobs never wait,
 * so they are already running by the time they reach the list.
 */
function pump(): void {
  if (heavyBusy()) return;
  const next = entries.find(e => e.job.heavy && e.job.status === 'queued');
  if (!next) return;
  next.job.status = 'running';
  next.ownsSlot = true;
  settleStarted(next);
  emit();
}

/** Resolve a job's `started` promise exactly once. */
function settleStarted(e: JobEntry): void {
  if (e.startedSettled) return;
  e.startedSettled = true;
  e.resolveStarted();
}

/** Mark terminal; retained cancellation keeps its slot until the driver settles. */
function terminate(e: JobEntry, status: 'done' | 'failed' | 'cancelled'): void {
  if (isTerminal(e.job.status)) return;
  e.job.status = status;
  e.job.endedAt = Date.now();
  // A queued job that never ran still needs its awaiter released.
  settleStarted(e);
  if (status !== 'cancelled' || !e.retainSlotOnCancel) e.ownsSlot = false;
  if (!e.ownsSlot) scheduleprune(e);
  // A retained cancellation still owns its slot even with a terminal status.
  pump();
  emit();
}

/** A cancellation changes status immediately; resource release follows completion. */
function settle(e: JobEntry): void {
  if (!isTerminal(e.job.status)) terminate(e, 'done');
  if (!e.ownsSlot) return;
  e.ownsSlot = false;
  scheduleprune(e);
  pump();
  emit();
}

/** Drop a terminal job from the list after the retention window. */
function scheduleprune(e: JobEntry): void {
  if (e.pruneTimer) clearTimeout(e.pruneTimer);
  if (e.dismissed) { drop(e); return; }
  const ms = Math.max(0, RETENTION.ms);
  e.pruneTimer = setTimeout(() => {
    const i = entries.indexOf(e);
    if (i >= 0) { entries.splice(i, 1); emit(); }
  }, ms);
  // Don't keep a headless process alive just to prune a finished job.
  (e.pruneTimer as { unref?: () => void }).unref?.();
}

/** Take a job off the list now. */
function drop(e: JobEntry): void {
  if (e.pruneTimer) clearTimeout(e.pruneTimer);
  e.pruneTimer = undefined;
  const i = entries.indexOf(e);
  if (i >= 0) { entries.splice(i, 1); emit(); }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a job and get its lifecycle handle. A heavy job (default) waits its
 * turn in the serial queue - await `handle.started` before doing the work.
 * Throws JobQueueFullError before registration when the pending limit is reached.
 */
export function startJob(opts: StartJobOpts): JobHandle {
  const heavy = opts.heavy !== false;
  if (heavy && heavyBusy() && entries.filter(e => e.job.heavy && e.job.status === 'queued').length >= MAX_QUEUED_HEAVY_JOBS) {
    throw new JobQueueFullError();
  }
  const id = `job-${++seq}`;
  let resolveStarted!: () => void;
  const started = new Promise<void>(res => { resolveStarted = res; });

  const job: Job = {
    id,
    title: String(opts.title ?? ''),
    heavy,
    cancellable: typeof opts.cancel === 'function',
    status: 'queued',
    progress: null,
    createdAt: Date.now(),
  };
  const entry: JobEntry = { job, cancel: opts.cancel, resolveStarted, startedSettled: false, cancelled: false, ownsSlot: false, retainSlotOnCancel: opts.retainSlotOnCancel !== false };
  entries.push(entry);

  // A light job never queues; a heavy job runs now only if the slot is idle.
  if (!heavy) {
    job.status = 'running';
    entry.ownsSlot = true;
    settleStarted(entry);
    emit();
  } else {
    pump();       // starts THIS job iff the slot was free; emits if it did
    if (job.status === 'queued') emit();   // otherwise announce the new queued job
  }

  const handle: JobHandle = {
    id,
    started,
    get cancelled() { return entry.cancelled; },
    progress(done: number, total: number, note?: string): void {
      if (isTerminal(job.status)) return;
      job.progress = { done, total, ...(note ? { note } : {}) };
      emit();
    },
    finish(result?: unknown): void {
      if (isTerminal(job.status)) { settle(entry); return; }
      if (result !== undefined) job.result = result;
      terminate(entry, 'done');
    },
    fail(err: unknown): void {
      if (isTerminal(job.status)) { settle(entry); return; }
      job.error = errText(err);
      terminate(entry, 'failed');
    },
    settle(): void { settle(entry); },
  };
  return handle;
}

/**
 * Request cancellation: fire the job's cancel callback (once) and mark it
 * cancelled. A no-op on an unknown id or an already-terminal job.
 */
export function cancelJob(id: string): void {
  const e = entries.find(x => x.job.id === id);
  if (!e || isTerminal(e.job.status)) return;
  e.cancelled = true;
  terminate(e, 'cancelled');
  if (e.cancel) {
    const cb = e.cancel;
    e.cancel = undefined;   // once only
    try { cb(); } catch { /* a cancel callback must not strand the registry */ }
  }
}

/**
 * Take a finished job off the list before its retention window ends: the view said
 * the outcome itself, so the toast need not say it again. A job still running, or a
 * cancelled one still releasing its slot, leaves as soon as it has finished instead.
 * A no-op on an unknown id. It never cancels: use {@link cancelJob} for that.
 */
export function dismissJob(id: string): void {
  const e = entries.find(x => x.job.id === id);
  if (!e) return;
  e.dismissed = true;
  if (isTerminal(e.job.status) && !e.ownsSlot) drop(e);
}

/**
 * Subscribe to job-list changes. Fires ON CHANGE only (not immediately) - read
 * {@link jobsSnapshot} for the current state right after subscribing. Returns
 * an unsubscribe fn.
 */
export function subscribe(listener: JobsListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The current jobs, newest last, as an immutable snapshot. */
export function jobsSnapshot(): readonly Job[] {
  return Object.freeze(entries.map(e => e.job));
}

/** Jobs still queued or running - what the toast counts as "active". */
export function activeJobs(): readonly Job[] {
  return entries.filter(e => e.job.status === 'queued' || e.job.status === 'running').map(e => e.job);
}

/** Jobs with a booked turn or resources still owned while cancellation settles. */
export function resourceJobs(): readonly Job[] {
  return entries.filter(e => e.job.status === 'queued' || e.ownsSlot).map(e => e.job);
}

/**
 * Convenience driver: start a job, wait its turn, run `work`, then finish with
 * its result (or fail on a throw). Returns the work's result, or undefined if
 * the job was cancelled before its turn. Rethrows a work() error after failing
 * the job, so a caller's own catch still sees it.
 */
export async function runJob<T>(opts: StartJobOpts, work: (handle: JobHandle) => Promise<T> | T): Promise<T | undefined> {
  const handle = startJob({ ...opts, retainSlotOnCancel: true });
  try {
    await handle.started;
    if (handle.cancelled) return undefined;
    const result = await work(handle);
    handle.finish(result);
    return handle.cancelled ? undefined : result;
  } catch (err) {
    handle.fail(err);
    throw err;
  } finally {
    handle.settle();
  }
}

/** Flatten any thrown value to a short message (worker errors arrive as strings). */
// Not `lib/util/errors.ts`'s errText: a job with no error still needs a label, and a
// thrown string is its own message.
function errText(err: unknown): string {
  if (err == null) return 'Failed';
  if (typeof err === 'string') return err;
  const m = (err as { message?: unknown }).message;
  return typeof m === 'string' && m ? m : String(err);
}

/** Test-only: drop every job and listener, and clear pending prune timers. */
export function __resetJobsForTest(): void {
  for (const e of entries) if (e.pruneTimer) clearTimeout(e.pruneTimer);
  entries.length = 0;
  listeners.clear();
  seq = 0;
}
