// SPDX-License-Identifier: MPL-2.0
/**
 * Retouch worker (plan 124 WP-E) - runs the engine's Telea content-aware fill
 * off-thread so a large brush stroke never freezes the dialog. Pure math, no
 * model, no network: the engine module is DOM-free, so the whole run is this
 * one transferable round trip. Same id-keyed protocol as the other workers.
 */

import { healFrame, inpaintTelea, type InpaintFrame } from '@lolly/engine';
import { chooseRemovalFill, countMask } from '@lolly-tools/node-shell/inpaint';
import { loadInpaintKernel } from '../bridge/inpaint-kernel.ts';

/**
 * How a fill is made: `smooth` is Telea's marching fill; `large` is PatchMatch for big
 * regions and Telea for small marks, chosen by mask size; the rest are spot healing.
 */
export type RetouchMethod = 'smooth' | 'content-aware' | 'proximity' | 'texture' | 'large';

export interface InpaintWorkerRequest {
  id: number;
  width: number;
  height: number;
  /** RGBA, transferred in. */
  data: Uint8ClampedArray;
  /** width*height bytes, nonzero = fill, transferred in. */
  mask: Uint8Array;
  radius?: number;
  /** Default `smooth`. */
  method?: RetouchMethod;
  /** Grain seed for `texture`. */
  seed?: number;
}

export interface InpaintWorkerReply {
  id: number;
  progress?: { filled: number; total: number };
  result?: InpaintFrame;
  error?: string;
}

const post = postMessage as (message: unknown, transfer?: Transferable[]) => void;

/** PatchMatch for a large painted area. Straight RGBA in and out; the module runs to the end, so cancel ends the worker. */
async function fillLarge(width: number, height: number, data: Uint8ClampedArray, mask: Uint8Array): Promise<InpaintFrame> {
  const kernel = await loadInpaintKernel();
  return { width, height, data: kernel.fill(data, width, height, mask) };
}

onmessage = async (e: MessageEvent<InpaintWorkerRequest>): Promise<void> => {
  const { id, width, height, data, mask, radius, method = 'smooth', seed } = e.data;
  try {
    if (method === 'large' && chooseRemovalFill(countMask(mask)) === 'patchmatch') {
      const big = await fillLarge(width, height, data, mask);
      post({ id, result: big } satisfies InpaintWorkerReply, [big.data.buffer]);
      return;
    }
    // Small marks under `large` take the same Telea call as `smooth`, so those bytes do not change.
    const out = method === 'smooth' || method === 'large'
      ? inpaintTelea({ width, height, data }, mask, {
        radius,
        onProgress: (filled, total) => post({ id, progress: { filled, total } } satisfies InpaintWorkerReply),
      })
      : healFrame({ width, height, data }, mask, { mode: method, ...(seed !== undefined ? { seed } : {}) });
    post({ id, result: out } satisfies InpaintWorkerReply, [out.data.buffer]);
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) } satisfies InpaintWorkerReply);
  }
};
