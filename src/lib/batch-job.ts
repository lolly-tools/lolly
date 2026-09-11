// SPDX-License-Identifier: MPL-2.0
/**
 * A BATCH RENDER as a background job (plans/124 section 9, WP-F).
 *
 * The batch family - "Render folder", "Render selection", a single saved session,
 * a multi-edit download-all, "Export everything" and /pro's own Render button -
 * used to be five view-owned progress toasts around one runner. Each toast was
 * torn down by its view's `_cleanup`, so navigating away hid a run that kept
 * going, and /pro's module-level run lock was cleared only by the runner's own
 * `finally` - a remount then refused new runs with no way back.
 *
 * Both problems have the same fix: the RUN is a job. This module owns
 *   - the job that covers a whole export (row assembly, preflight, render, zip
 *     delivery), so a failure anywhere lands in `job.fail` and shows in the
 *     global toast (lib/job-toast.ts) rather than in a toast the user has left;
 *   - {@link isBatchRunActive}, now keyed to the JOB registry rather than to a
 *     boolean any one view could strand. Finish, fail or cancel - from the run,
 *     from the toast's ✕, from anywhere - and the slot is free.
 *
 * Kept deliberately light (jobs + i18n, no /pro imports) so the views can import
 * it statically and still lazy-load the batch machinery at export time.
 *
 * WHY CANCEL IS COOPERATIVE: there is no AbortController to trip. The runner
 * polls `job.cancelled` between rows (pro/run-overlay.ts), which is why the
 * handle is created with an empty cancel callback - its presence is what marks
 * the job cancellable and puts the ✕ on the toast row. Cancelling stops further
 * renders; whatever already rendered is still delivered, exactly as the run
 * overlay's own Cancel button has always behaved.
 */
import { startJob, activeJobs, type JobHandle } from './jobs.ts';
import { tRaw } from '../i18n.ts';

/**
 * Every batch job started this session. A run counts as ACTIVE only while the
 * registry still lists one of these as queued or running, so a terminal job frees
 * the slot even if the view that started it is long gone.
 */
const batchJobIds = new Set<string>();

/** True while a batch run owns the offscreen stage (queued counts - its turn is booked). */
export function isBatchRunActive(): boolean {
  if (batchJobIds.size === 0) return false;
  return activeJobs().some(j => batchJobIds.has(j.id));
}

/**
 * Start (and register) the job that owns one batch run. The caller drives it:
 * await `started`, poll `cancelled`, report `progress`, then finish/fail. Prefer
 * {@link startBatchExport}, which does that dance; this is for the runner's own
 * un-wrapped path (pro/run-overlay.ts's Retry).
 */
export function startBatchJob(title: string): JobHandle {
  const job = startJob({ title, cancel: () => { /* cooperative - the runner polls job.cancelled */ } });
  batchJobIds.add(job.id);
  return job;
}

/** Drop a settled job from the batch registry. Safe to call more than once. */
export function releaseBatchJob(job: { id: string }): void {
  batchJobIds.delete(job.id);
}

/** What a finished export hands back, read only to name the package out loud. */
export interface BatchExportOutcome {
  /** The delivered zip's filename, when the run packaged one. */
  zipName?: string;
  /** A single bare file's name (the one-session render path). */
  name?: string;
}

/**
 * Run a whole batch export as one background job.
 *
 * `run` gets the job handle to thread into the runner. It may do the slow row
 * assembly and preflight too - anything it throws fails the JOB, which is the
 * only failure surface that survives the initiating view.
 *
 * Returns the handle immediately; the work continues in the background. Two
 * exports started in a row do not race: jobs are heavy, so the second waits its
 * turn in the process-wide serial queue instead of sharing the offscreen stage.
 */
export function startBatchExport(
  title: string,
  run: (job: JobHandle) => Promise<unknown>,
): JobHandle {
  const job = startBatchJob(title);
  void (async (): Promise<void> => {
    try {
      await job.started;
      if (job.cancelled) return;
      const out = await run(job) as BatchExportOutcome | null | undefined;
      if (job.cancelled) return;
      job.finish(out ?? undefined);
      announceDelivered(out);
    } catch (err) {
      // A cancel is not a failure: cancelJob() already put the job in its terminal
      // state, and the runner's abandoned work can surface as anything.
      if (job.cancelled) return;
      job.fail(err);
    } finally {
      releaseBatchJob(job);
    }
  })();
  return job;
}

/**
 * Name the finished package out loud. By the time a big run lands, the view that
 * started it may be gone - the toast carries the "Done" state, and this carries
 * the FILE NAME through the shared body-level live region (a11y.ts), which no
 * view teardown can take away. The bytes themselves reach the user either way:
 * delivery is a browser download (pro/zip.ts saveBlob), which is view-independent.
 *
 * a11y.ts is reached lazily on purpose: /pro imports this module (through
 * pro/run-overlay.ts) and is deliberately kept out of the app shell's graph, so the
 * shared live region is pulled in only when a package is actually delivered.
 */
function announceDelivered(out: BatchExportOutcome | null | undefined): void {
  const name = out?.zipName || out?.name;
  if (!name) return;
  void import('../a11y.ts')
    .then(({ announce }) => { announce(tRaw('{name} ready.', { name })); })
    .catch(() => { /* an announcement must never fail a finished run */ });
}
