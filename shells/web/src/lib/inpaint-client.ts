// SPDX-License-Identifier: MPL-2.0
/**
 * Retouch client (plan 124 WP-E) - the main-thread face of the inpaint worker.
 * One run per call: the frame and mask buffers TRANSFER to the worker (hand it
 * copies if you need yours after), progress streams back, and the worker is
 * torn down when the run settles - a fill is a one-shot job, not a session, so
 * holding a warm thread would only pin the buffers.
 */

import type { InpaintFrame } from '@lolly/engine';
import type { InpaintWorkerReply } from './inpaint-worker.ts';

export interface InpaintRun {
  done: Promise<InpaintFrame>;
  abort(): void;
}

export function runInpaint(
  frame: InpaintFrame,
  mask: Uint8Array,
  opts: { radius?: number; onProgress?: (filled: number, total: number) => void } = {},
): InpaintRun {
  const worker = new Worker(new URL('./inpaint-worker.ts', import.meta.url), { type: 'module' });
  let settled = false;
  let rejectRun: (e: unknown) => void = () => {};
  const finish = (): void => { settled = true; worker.terminate(); };
  const done = new Promise<InpaintFrame>((resolve, reject) => {
    rejectRun = reject;
    worker.onmessage = (e: MessageEvent<InpaintWorkerReply>): void => {
      const { progress, result, error } = e.data;
      if (progress) { opts.onProgress?.(progress.filled, progress.total); return; }
      finish();
      if (error || !result) reject(new Error(error ?? 'inpaint failed'));
      else resolve(result);
    };
    worker.onerror = (): void => { finish(); reject(new Error('inpaint worker error')); };
    worker.postMessage(
      { id: 1, width: frame.width, height: frame.height, data: frame.data, mask, radius: opts.radius },
      [frame.data.buffer, mask.buffer],
    );
  });
  return {
    done,
    abort(): void {
      // Cooperative-only in-worker is impossible for a tight sync loop, so an
      // abort simply terminates the thread; the promise settles as an error the
      // dialog treats as silence.
      if (settled) return;
      finish();
      rejectRun(new DOMException('aborted', 'AbortError'));
    },
  };
}
