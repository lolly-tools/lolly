// SPDX-License-Identifier: MPL-2.0
/**
 * The smaller copy of a picture a thumbnail render takes (bridge/export-shared.ts
 * `thumbnailPictures`), made off the page's main thread.
 *
 * The picture is decoded at its smaller size with createImageBitmap, drawn on a
 * canvas, encoded again (JPEG stays JPEG at quality 0.9, anything else becomes PNG)
 * and handed back as a data URL. In a worker (bridge/thumb-downscale.worker.ts) the
 * canvas is an OffscreenCanvas; on the main thread it is a canvas element, as it
 * always was. Both run the same browser decoder, scaler and encoders on the same
 * input, so they give the same pixels (bridge/thumb-downscale.browser.test.ts
 * compares them).
 *
 * The worker is used where the browser has Worker, OffscreenCanvas and
 * createImageBitmap. Elsewhere, or when the worker cannot start, answers with an
 * error or runs past its time limit (after two failures it is set aside for the
 * visit), the picture is made on the main thread, one at a time with a turn of the
 * event loop between, so a render with many pictures does not hold the page in one
 * piece.
 */
import type { ThumbDownscaleReply, ThumbDownscaleRequest } from './thumb-downscale-protocol.ts';

/** The encoder a downscaled copy takes: JPEG stays JPEG, the rest become PNG. */
export function thumbOutputType(sourceType: string): 'image/jpeg' | 'image/png' {
  return sourceType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
}

/** The quality a JPEG copy is encoded at (PNG has none). */
export const THUMB_JPEG_QUALITY = 0.9;

/** The main-thread path: what thumbnailPictures always did, for one picture. */
export async function downscaleOnMainThread(blob: Blob, width: number, height: number): Promise<string> {
  const bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL(thumbOutputType(blob.type), THUMB_JPEG_QUALITY);
}

export interface DownscaleWorker {
  onmessage: ((event: MessageEvent) => unknown) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  postMessage(message: ThumbDownscaleRequest): void;
  terminate(): void;
}

export interface DownscalerOptions {
  createWorker(): DownscaleWorker;
  /** Whether this browser can make the copy in a worker. */
  workerCapable(): boolean;
  /** The main-thread path. */
  inRealm(blob: Blob, width: number, height: number): Promise<string>;
  /** Yield to the page before a main-thread copy. */
  yieldToPage(): Promise<void>;
  /** Time limit for one copy in the worker. */
  budgetMs?: number;
}

/** Failures after which the worker is set aside for the rest of the visit. */
const MAX_FAILURES = 2;

export function createThumbDownscaler(o: DownscalerOptions) {
  let worker: DownscaleWorker | null = null;
  let failures = 0;
  let sequence = 0;
  let mainLane: Promise<unknown> = Promise.resolve();
  const pending = new Map<number, { resolve(url: string): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const stats = { worker: 0, inRealm: 0 };

  function retire(error: Error): void {
    failures++;
    worker?.terminate();
    worker = null;
    for (const [id, job] of pending) { clearTimeout(job.timer); pending.delete(id); job.reject(error); }
  }

  function start(): DownscaleWorker {
    if (worker) return worker;
    let created: DownscaleWorker;
    try { created = o.createWorker(); } catch (error) { failures++; throw error; }
    created.onmessage = event => {
      const data = event.data as ThumbDownscaleReply;
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      clearTimeout(job.timer);
      if (data.ok) job.resolve(data.dataUrl);
      else job.reject(new Error(data.error));
    };
    created.onerror = event => { event.preventDefault?.(); retire(new Error(event.message || 'The picture worker stopped.')); };
    worker = created;
    return created;
  }

  function post(blob: Blob, width: number, height: number): Promise<string> {
    const current = start();
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => retire(new Error('The picture worker ran past its time limit.')), o.budgetMs ?? 15_000);
      (timer as { unref?: () => void }).unref?.();
      pending.set(id, { resolve, reject, timer });
      try { current.postMessage({ id, blob, width, height }); }
      catch (error) { pending.delete(id); clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); }
    });
  }

  /** One copy on the main thread, after the copies before it and a turn of the event loop. */
  function inRealm(blob: Blob, width: number, height: number): Promise<string> {
    const run = mainLane.then(async () => {
      await o.yieldToPage();
      stats.inRealm++;
      return o.inRealm(blob, width, height);
    });
    mainLane = run.catch(() => undefined);
    return run;
  }

  /** A data URL of `blob` at width x height. Rejects when the picture cannot be decoded. */
  async function downscale(blob: Blob, width: number, height: number): Promise<string> {
    if (failures < MAX_FAILURES && o.workerCapable()) {
      try { const url = await post(blob, width, height); stats.worker++; return url; }
      catch { /* made on the main thread below */ }
    }
    return inRealm(blob, width, height);
  }

  return { downscale, stats, dispose: () => { worker?.terminate(); worker = null; } };
}

let shared: ReturnType<typeof createThumbDownscaler> | null = null;

/** The page's downscaler. */
export function thumbDownscaler(): ReturnType<typeof createThumbDownscaler> {
  shared ??= createThumbDownscaler({
    createWorker: () => new Worker(new URL('./thumb-downscale.worker.ts', import.meta.url), { type: 'module' }),
    workerCapable: () => typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function',
    inRealm: downscaleOnMainThread,
    yieldToPage: () => new Promise<void>(resolve => { setTimeout(resolve, 0); }),
  });
  return shared;
}
