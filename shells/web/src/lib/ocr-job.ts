// SPDX-License-Identifier: MPL-2.0
/**
 * On-device OCR ("Read text") run as a background JOB (plans/124 section 9, WP-F;
 * the reader itself is plans/125).
 *
 * The exact sibling of lib/matte-job.ts and lib/upscale-job.ts: the caller decodes
 * the pixels while its surface is still on screen, hands the frame here, and stops
 * waiting. The model download, the detect pass and the recognise pass then happen
 * on the WP-F serial heavy queue, so the global candy-stripe toast
 * (lib/job-toast.ts) owns progress and cancel, and a read survives the modal
 * closing or the user navigating away. One heavy job at a time is deliberate
 * (lib/jobs.ts): two wasm inference runs in one tab is the OOM the queue exists
 * to prevent.
 *
 * WHY THE FRAME COMES IN ALREADY DECODED
 * The same reason the matte job takes one: decoding needs the source's URL to
 * still be resolvable and is the cheap part, while the run is the long one. It
 * also keeps this module free of asset/DOM plumbing, so the whole tail unit-tests
 * with a synthetic frame and a stub `host.ocr`.
 *
 * THIS JOB PRODUCES NO ASSET AND NO PROVENANCE
 * Unlike matte/upscale, OCR writes no pixels and no file - it returns text. The
 * caller decides what to do with it (paint a panel, copy it, persist an AI-signals
 * verdict onto the asset's meta). So there is no stamp, no `_uploadUserAsset`, and
 * nothing here to keep byte-identical beyond the OcrResult itself.
 *
 * WHAT CANCEL DOES
 * A real abort: `host.ocr.run` takes an `AbortSignal` and the worker drops the
 * request (lib/ocr-wasm-api.ts). A cancel DURING the one-time model download still
 * rejects promptly, but the download itself completes in the background and is
 * cached - so the next read starts warm rather than re-fetching.
 */

import { startJob, type JobHandle } from './jobs.ts';
import { t } from '../i18n.ts';
import type { HostV1, OcrFrame, OcrOpts, OcrProgress, OcrResult } from '@lolly-tools/core/host-v1';

/** The host surface this job touches: `ocr` plus `log`. Every web host satisfies it. */
export type OcrJobHost = HostV1;

export interface OcrJobRequest {
  /** The decoded source, RGBA (what `getImageData` yields). CONSUMED by the run -
   *  `host.ocr.run` transfers the buffer to the worker, so do not reuse it after. */
  frame: OcrFrame;
  /** Run options minus the two the job owns itself (`signal`, `onProgress`). */
  opts?: Omit<OcrOpts, 'signal' | 'onProgress'>;
}

/** What the driver reports back while it works, and how it learns it should stop. */
export interface OcrJobCtx {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  /** `total <= 0` means indeterminate, exactly as lib/jobs.ts defines it. */
  onProgress?: (done: number, total: number, note?: string) => void;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * OcrProgress → the job's (done, total, note).
 *
 * Three phases, and only two of them can ever quote a number: the FIRST-RUN model
 * download reports bytes (so the toast says "Downloading the model…" with a real
 * percentage instead of looking hung on a multi-MB fetch), and the recognise pass
 * reports box-of-boxes. Detection is one forward pass with nothing in between, so
 * it reports the indeterminate 0/0 form and the toast pulses rather than lying.
 */
export function reportOcrProgress(ctx: OcrJobCtx, p: OcrProgress): void {
  if (!ctx.onProgress) return;
  const note = p.phase === 'download' ? t('Downloading the model…')
    : p.phase === 'detect' ? t('Finding text…')
    : t('Reading text…');
  const frac = p.fraction ?? (p.phase === 'download' && p.total ? (p.loaded ?? 0) / p.total : null);
  if (frac == null) { ctx.onProgress(0, 0, note); return; }
  ctx.onProgress(Math.round(clamp01(frac) * 100), 100, note);
}

/**
 * Run one read end-to-end. Resolves the OcrResult, or null when the run was
 * cancelled (a cancel is not a failure). Rejects with whatever the reader threw
 * for a real failure, so the caller keeps its own honest message.
 */
export async function runOcrJob(
  host: OcrJobHost, req: OcrJobRequest, ctx: OcrJobCtx = {},
): Promise<OcrResult | null> {
  const ocr = host.ocr;
  if (!ocr) throw new Error('ocr is not available on this shell');
  ctx.onProgress?.(0, 0, t('Reading text…'));
  const result = await ocr.run(req.frame, {
    ...(req.opts ?? {}),
    ...(ctx.signal ? { signal: ctx.signal } : {}),
    onProgress: (p) => reportOcrProgress(ctx, p),
  });
  // A cancel that landed while the last reply was in flight: the caller asked for
  // this to not happen, so nothing is handed back.
  if (ctx.isCancelled?.()) return null;
  return result;
}

/**
 * Drive one read through a WP-F job (serial heavy queue + global toast + desktop
 * notification). Returns the JobHandle immediately; the work runs in the
 * background and survives the surface that started it going away.
 * `onComplete` fires with the result so a still-live surface can paint it - the
 * caller is responsible for checking that it IS still live before touching the DOM.
 * `onSettled` fires on EVERY terminal path (done, failed, and cancelled from the
 * toast), which is what a caller that put a button into a "Reading…" state needs:
 * a cancel calls neither onComplete nor onError, so without it that button would
 * stay disabled for as long as its surface lives.
 */
export function startOcrJob(
  host: OcrJobHost, req: OcrJobRequest,
  hooks: {
    onComplete?: (result: OcrResult) => void;
    onError?: (err: unknown) => void;
    onSettled?: () => void;
  } = {},
): JobHandle {
  const controller = new AbortController();
  const job = startJob({ title: t('Reading text'), cancel: () => controller.abort() });
  void (async (): Promise<void> => {
    await job.started;
    if (job.cancelled) return;
    try {
      const result = await runOcrJob(host, req, {
        signal: controller.signal,
        isCancelled: () => job.cancelled,
        onProgress: (done, total, note) => job.progress(done, total, note),
      });
      if (job.cancelled) return;
      if (result) { job.finish(result); hooks.onComplete?.(result); }
      else job.finish();
    } catch (err) {
      // A cancel is not a failure: cancelJob() has already put the job in its
      // terminal state, and an abort surfaces here as an AbortError.
      if (job.cancelled || (err as Error | null)?.name === 'AbortError') return;
      host.log('error', 'Read text failed', { error: String(err) });
      job.fail(err);
      hooks.onError?.(err);
    } finally {
      // Every terminal path, cancel included - a caller's "Reading…" button gets
      // its label back whatever happened. A throwing hook must not strand the job.
      try { hooks.onSettled?.(); } catch { /* a hook must never break the driver */ }
    }
  })();
  return job;
}
