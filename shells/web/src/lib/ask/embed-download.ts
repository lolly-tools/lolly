// SPDX-License-Identifier: MPL-2.0
/**
 * The Ask "better matching" model download, as a background JOB (plans/124 WP-F).
 *
 * WHAT THIS FIXES. The consent chip in views/ask.ts used to call `downloadAsk()`
 * directly and paint the percentage into its own `<span>`. That made a ~23 MB
 * download a property of a DOM node: leave #/ask and the view is torn down, the
 * only progress readout in the app goes with it, and the fetches carry on with
 * nobody able to see or stop them. Routing it through lib/jobs.ts gives the
 * download a life of its own - the global toast shows it, the ✕ cancels it, and
 * the chip becomes a mirror that is free to disappear.
 *
 * NOT HEAVY, ON PURPOSE. The single heavy slot exists for work that wants the
 * tab's memory: a wasm inference run, a WebCodecs transcode. This is network into
 * the Cache API and holds nothing in memory, so it neither needs the slot nor
 * should be able to take it - a model download must not stall a video job, and
 * waiting behind one for four minutes would be latency bought for nothing.
 *
 * ONE AT A TIME, THOUGH. A re-mounted chip (leave #/ask, come back mid-download)
 * finds the model still uncached and would happily start a SECOND download of the
 * same bytes. `downloadEmbedModel` is therefore attach-or-start: a second caller
 * joins the running job's fan-out and replays its latest progress instead.
 */
import { startJob, type JobHandle } from '../jobs.ts';
import { t } from '../../i18n.ts';
import type { PrecacheManifest } from '../offline-manager.ts';

/** What a mirroring surface (today: the Ask consent chip) wants to hear. */
export interface EmbedDownloadHooks {
  /** Bytes so far / bytes expected. `total` is 0 while the size is unknown. */
  onProgress?: (loaded: number, total: number) => void;
  /** The model is on-device; the next question uses it. */
  onDone?: () => void;
  /** It did not finish. Answers keep working lexically - never fatal. */
  onError?: (err: unknown) => void;
}

/** The download in flight, or null. Module-level: there is only ever one. */
let active: JobHandle | null = null;
const mirrors = new Set<EmbedDownloadHooks>();
let lastProgress: { loaded: number; total: number } | null = null;

/** Is the model download running right now? Lets a freshly mounted chip open in
 *  its downloading state instead of offering a duplicate Download button. */
export function embedDownloadActive(): boolean {
  return active !== null;
}

/** Fan out to every mirror without letting one bad listener break the rest. */
function fanOut(fn: (h: EmbedDownloadHooks) => void): void {
  for (const h of [...mirrors]) {
    try { fn(h); } catch { /* a mirror must never break the download */ }
  }
}

/**
 * Start the ~23 MB embed-model download as a job, or attach to the one already
 * running. `detach` unsubscribes THIS caller's hooks (a view teardown calls it);
 * it does not cancel the download - that is the toast's ✕, or cancelJob(job.id).
 */
export function downloadEmbedModel(
  manifest: PrecacheManifest,
  hooks: EmbedDownloadHooks = {},
): { job: JobHandle; detach: () => void } {
  mirrors.add(hooks);
  const detach = (): void => { mirrors.delete(hooks); };

  if (active) {
    // Replay, so a chip that arrived late shows a real number immediately
    // rather than sitting at nothing until the next chunk lands.
    if (lastProgress) hooks.onProgress?.(lastProgress.loaded, lastProgress.total);
    return { job: active, detach };
  }

  const controller = new AbortController();
  const job = startJob({
    title: t('Downloading the matching model'),
    cancel: () => controller.abort(),
    // See the header: a download is network-bound, not memory-bound. It must not
    // hold the inference slot, and must not queue behind whatever does.
    heavy: false,
  });
  active = job;
  lastProgress = null;

  void (async (): Promise<void> => {
    try {
      const { downloadAsk } = await import('../offline-manager.ts');
      await downloadAsk(manifest, {
        signal: controller.signal,
        onProgress: (p) => {
          // `total` goes null the moment any file arrives without a
          // Content-Length; 0 is what both the toast and the chip read as
          // "unknown", so it is flattened once, here.
          const total = p.total ?? 0;
          lastProgress = { loaded: p.loaded, total };
          // The toast counts in whole MB - the same unit the consent chip
          // quotes the model's size in, so the two never disagree.
          const mb = (n: number): number => Math.round(n / 1024 / 1024);
          job.progress(mb(p.loaded), total > 0 ? mb(total) : 0);
          fanOut((h) => h.onProgress?.(p.loaded, total));
        },
      });
      job.finish();
      fanOut((h) => h.onDone?.());
    } catch (err) {
      job.fail(err);
      fanOut((h) => h.onError?.(err));
    } finally {
      active = null;
      lastProgress = null;
      mirrors.clear();
    }
  })();

  return { job, detach };
}

/** Test-only: forget any in-flight download so the next call starts clean. */
export function __resetEmbedDownloadForTest(): void {
  active = null;
  lastProgress = null;
  mirrors.clear();
}
