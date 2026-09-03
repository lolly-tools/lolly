// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free maths of `host.matte`: letterbox geometry, per-model
 * normalization, and the output activation.
 *
 * SPLIT OUT of shells/web/src/lib/matter.ts (2026-09-03, plans/183 WS2), which
 * keeps importing and re-exporting every symbol below, so its unit tests
 * (lib/matter.test.ts) and the worker path are unchanged. The split exists
 * because the Node matte runner (packages/node-shell/src/ml/matte.ts) needs the
 * exact same numbers and cannot import matter.ts: that file pulls in lib/ort.ts,
 * which is onnxruntime-web plus OffscreenCanvas.
 *
 * Only the RESIZE differs between the two shells (canvas there, sharp here); the
 * geometry that places the content inside the model square, the mean/std applied
 * to each channel, and the activation that turns a raw head into 0..1 alpha are
 * one implementation.
 */

import type { MatteModelSpec } from './matte-models.ts';

export interface LetterboxPlan {
  /** Model input square edge (spec.inputSize is [H,W], H===W for this roster). */
  edge: number;
  /** Scale applied to the source content to fit the square. */
  scale: number;
  /** Top-left of the content inside the square, in model px. */
  offsetX: number;
  offsetY: number;
  /** Content size inside the square, in model px. */
  contentW: number;
  contentH: number;
}

/** Fit a srcW×srcH image into a square `edge` preserving aspect, centered. */
export function planLetterbox(srcW: number, srcH: number, edge: number): LetterboxPlan {
  const scale = Math.min(edge / srcW, edge / srcH);
  const contentW = Math.max(1, Math.round(srcW * scale));
  const contentH = Math.max(1, Math.round(srcH * scale));
  return {
    edge, scale,
    offsetX: Math.floor((edge - contentW) / 2),
    offsetY: Math.floor((edge - contentH) / 2),
    contentW, contentH,
  };
}

/** RGBA (0..255) at `edge`×`edge` → NCHW [1,3,edge,edge] float32, normalized
 *  per the model spec: (pixel/255 − mean)/std, RGB planes, alpha dropped. */
export function packNchwNormalized(rgba: ArrayLike<number>, edge: number, spec: MatteModelSpec): Float32Array {
  const total = edge * edge;
  const out = new Float32Array(total * 3);
  const [mr, mg, mb] = spec.mean;
  const [sr, sg, sb] = spec.std;
  const page = total, twoPage = 2 * total;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    out[i] = ((rgba[idx] as number) / 255 - mr) / sr;
    out[i + page] = ((rgba[idx + 1] as number) / 255 - mg) / sg;
    out[i + twoPage] = ((rgba[idx + 2] as number) / 255 - mb) / sb;
  }
  return out;
}

/** Single-channel model output → 0..1 mask (edge×edge) via the spec activation. */
export function activateMask(raw: ArrayLike<number>, count: number, activation: 'minmax' | 'sigmoid'): Float32Array {
  const out = new Float32Array(count);
  if (activation === 'sigmoid') {
    for (let i = 0; i < count; i++) out[i] = 1 / (1 + Math.exp(-(raw[i] as number)));
    return out;
  }
  // minmax: the head is already bounded; stretch to 0..1 (rembg parity).
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < count; i++) { const v = raw[i] as number; if (v < min) min = v; if (v > max) max = v; }
  const span = max - min;
  if (!(span > 1e-6)) { out.fill(0); return out; }
  for (let i = 0; i < count; i++) out[i] = ((raw[i] as number) - min) / span;
  return out;
}

/** The unpadded, work-sized 0..255 mask: activate, crop the letterbox content
 *  rect, and hand back a single-channel field the caller scales to work size.
 *  Kept here (rather than in either runner) because the offset arithmetic is the
 *  part that goes wrong silently. */
export function unpadMask(maskEdge: ArrayLike<number>, plan: LetterboxPlan): Uint8ClampedArray {
  const { edge, offsetX, offsetY, contentW, contentH } = plan;
  const out = new Uint8ClampedArray(contentW * contentH);
  for (let y = 0; y < contentH; y++) {
    for (let x = 0; x < contentW; x++) {
      const v = maskEdge[(offsetY + y) * edge + (offsetX + x)] as number;
      out[y * contentW + x] = Math.round(Math.min(1, Math.max(0, v)) * 255);
    }
  }
  return out;
}
