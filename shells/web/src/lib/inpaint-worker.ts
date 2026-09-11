// SPDX-License-Identifier: MPL-2.0
/**
 * Retouch worker (plan 124 WP-E) - runs the engine's Telea content-aware fill
 * off-thread so a large brush stroke never freezes the dialog. Pure math, no
 * model, no network: the engine module is DOM-free, so the whole run is this
 * one transferable round trip. Same id-keyed protocol as the other workers.
 */

import { inpaintTelea, type InpaintFrame } from '@lolly/engine';

export interface InpaintWorkerRequest {
  id: number;
  width: number;
  height: number;
  /** RGBA, transferred in. */
  data: Uint8ClampedArray;
  /** width*height bytes, nonzero = fill, transferred in. */
  mask: Uint8Array;
  radius?: number;
}

export interface InpaintWorkerReply {
  id: number;
  progress?: { filled: number; total: number };
  result?: InpaintFrame;
  error?: string;
}

const post = postMessage as (message: unknown, transfer?: Transferable[]) => void;

onmessage = (e: MessageEvent<InpaintWorkerRequest>): void => {
  const { id, width, height, data, mask, radius } = e.data;
  try {
    const out = inpaintTelea({ width, height, data }, mask, {
      radius,
      onProgress: (filled, total) => post({ id, progress: { filled, total } } satisfies InpaintWorkerReply),
    });
    post({ id, result: out } satisfies InpaintWorkerReply, [out.data.buffer]);
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) } satisfies InpaintWorkerReply);
  }
};
