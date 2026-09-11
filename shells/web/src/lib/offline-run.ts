// SPDX-License-Identifier: MPL-2.0
/**
 * The live "Available offline" download run (plans/124 section 9, WP-F).
 *
 * A tiny module-level owner for the ONE download run the Profile view's
 * "Available offline" section can have in flight: the job handle, its
 * AbortController, the last progress line, and the set of mounted views
 * painting that line. DOM-free and i18n-free (every string is passed in by the
 * caller), so it unit-tests headless.
 *
 * WHY IT LIVES OUTSIDE THE VIEW
 * The run used to be a mount-closure local: the AbortController was created in
 * views/profile.ts and the view's _cleanup aborted it. That pinned the user to
 * /profile for what can be a multi-gigabyte sweep - navigating away cancelled
 * the download (resumable, so nothing already fetched was lost, but the run
 * stopped). Hoisting the run's identity to module scope is what lets it OUTLIVE
 * the view: the global job toast (lib/job-toast.ts) shows and cancels it after
 * navigation, and a Profile view mounted mid-run reads offlineRunActive() to
 * paint its controls busy instead of offering a second, concurrent sweep over
 * the same buckets.
 *
 * NOT HEAVY - deliberately. These are DOWNLOADS: bytes off the network into a
 * cache. They run no wasm inference and hold no decoded frames, so they must
 * never take (or wait for) the single serial slot lib/jobs.ts reserves for
 * model work. A user removing a background should not queue behind a 3 GB
 * catalogue fetch, and the fetch should not queue behind the matte. Hence
 * `heavy: false` on every job started here.
 *
 * ONE RUN AT A TIME is still enforced, but by this module rather than by the
 * job queue: beginOfflineRun() returns null while another run is live, which is
 * how a re-entering view (whose own re-entrancy flag is fresh per mount) is
 * stopped from starting a duplicate.
 */
import { startJob, cancelJob, type JobHandle } from './jobs.ts';

/**
 * One progress line: what is downloading, and how far it has got.
 * `total: null` means the phase cannot know its end yet (indeterminate).
 * `unit` says how to READ the numbers - a part's fetch counts BYTES, the tools
 * sweep counts ITEMS. The bar is the same either way; only the text differs.
 */
export interface OfflineRunLine {
  label: string;
  loaded: number;
  total: number | null;
  unit: 'bytes' | 'items';
}

/** A mounted view painting the run. Both callbacks are optional. */
export interface OfflineRunView {
  onProgress?(line: OfflineRunLine): void;
  /** The run reached a terminal state - repaint from storage, drop busy state. */
  onEnd?(): void;
}

/** The driver's surface, handed back by {@link beginOfflineRun}. */
export interface OfflineRunHandle {
  /** Pass to every fetch in the run - aborted when the job is cancelled. */
  readonly signal: AbortSignal;
  /** True once cancellation was requested (the toast's ✕ or an in-view Cancel). */
  readonly cancelled: boolean;
  /** Publish one line to the job and to every subscribed view. */
  report(line: OfflineRunLine): void;
  /**
   * End the run: settle the job, release the module slot, tell the views.
   * `error` (a caller-composed, already-localized message) fails the job
   * instead of finishing it. Idempotent, and a no-op once superseded.
   */
  end(error?: string): void;
}

interface LiveRun {
  job: JobHandle;
  controller: AbortController;
  last: OfflineRunLine | null;
}

let live: LiveRun | null = null;
const views = new Set<OfflineRunView>();

/** Is a download run in flight? A (re)mounting view paints busy off this. */
export function offlineRunActive(): boolean {
  return live !== null;
}

/**
 * The live run's last published line, or null. Read this right after
 * subscribing - {@link subscribeOfflineRun} fires ON CHANGE only, the same
 * contract lib/jobs.ts's subscribe() states.
 */
export function offlineRunLine(): OfflineRunLine | null {
  return live?.last ?? null;
}

/** Subscribe a mounted view to the run. Returns an unsubscribe fn. */
export function subscribeOfflineRun(view: OfflineRunView): () => void {
  views.add(view);
  return () => { views.delete(view); };
}

/** Request cancellation of the live run (the in-view Cancel button). Routed
 *  through cancelJob so the registry, the toast and the fetches agree. */
export function cancelOfflineRun(): void {
  if (live) cancelJob(live.job.id);
}

/**
 * Register a run and get its handle, or null when one is already in flight.
 * `title` is a caller-localized string shown in the job toast.
 */
export function beginOfflineRun(title: string): OfflineRunHandle | null {
  if (live) return null;
  const controller = new AbortController();
  // heavy: false - see the file header. A download must not contend for the
  // serial slot the model-inference jobs share.
  const job = startJob({ title, heavy: false, cancel: () => controller.abort() });
  const run: LiveRun = { job, controller, last: null };
  live = run;

  const fanOut = (fn: (v: OfflineRunView) => void): void => {
    for (const v of [...views]) {
      try { fn(v); } catch { /* a detached view must never break the run */ }
    }
  };

  return {
    signal: controller.signal,
    get cancelled() { return job.cancelled; },
    report(line: OfflineRunLine): void {
      if (live !== run) return;
      run.last = line;
      job.progress(line.loaded, line.total ?? 0, line.label);
      fanOut(v => v.onProgress?.(line));
    },
    end(error?: string): void {
      if (live !== run) return;
      live = null;
      // A cancelled job is already terminal; finish()/fail() no-op there.
      if (error) job.fail(error); else job.finish();
      fanOut(v => v.onEnd?.());
    },
  };
}

/** Test-only: forget the live run and every subscriber. */
export function __resetOfflineRunForTest(): void {
  live = null;
  views.clear();
}
