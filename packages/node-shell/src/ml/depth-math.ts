// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free maths of on-device monocular depth: the two resamplers, the
 * channel packing, the min-max normalisation, and the pre/post pair that turn a
 * source frame into the model's square input and its raw head back into a
 * work-size 0..1 map.
 *
 * SPLIT OUT of shells/web/src/lib/depth-worker.ts (2026-09-03, plans/183 WS2),
 * which keeps importing and re-exporting every symbol below, so
 * lib/depth-worker.test.ts and the worker path are unchanged. The split exists
 * because the Node depth runner (packages/node-shell/src/ml/depth.ts) needs the
 * exact same numbers and cannot import depth-worker.ts: that file pulls in
 * lib/ort.ts, which is onnxruntime-web plus OffscreenCanvas.
 *
 * Unlike matte and OCR, nothing here ever needed a canvas - the resampling is
 * plain arithmetic - so this module is the whole runner minus the ORT call.
 */

import {
  DEPTH_MAX_WORK_EDGE, planWorkSize,
  type DepthFrame, type DepthMap, type DepthModelSpec, type DepthOpts,
} from './depth-models.ts';


/**
 * Resample RGBA `src` (sw×sh) to dw×dh. Box-averages the source rectangle each
 * destination pixel covers, so the big downscales this path actually performs
 * (a 4000px photo → 2048 work → 518 model input) are properly filtered rather
 * than aliased; when a scale is >= 1 the box collapses to one sample, i.e.
 * nearest-neighbour, which only happens for fixtures smaller than the input.
 */
export function resampleRgba(
  src: ArrayLike<number>, sw: number, sh: number, dw: number, dh: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const xr = sw / dw, yr = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * yr);
    const y1 = Math.max(y0 + 1, Math.min(sh, Math.ceil((y + 1) * yr)));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * xr);
      const x1 = Math.max(x0 + 1, Math.min(sw, Math.ceil((x + 1) * xr)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * 4;
          r += src[i] as number; g += src[i + 1] as number; b += src[i + 2] as number; a += src[i + 3] as number;
          n++;
        }
      }
      const o = (y * dw + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
  }
  return out;
}

/** Bilinear resample of a single-channel float field. Used the other way round
 *  from resampleRgba - the model's 518² map back UP to the work size - where a
 *  box filter would leave visible blocks in the displacement. */
export function resampleFloat(
  src: ArrayLike<number>, sw: number, sh: number, dw: number, dh: number,
): Float32Array {
  const out = new Float32Array(dw * dh);
  if (sw < 1 || sh < 1) return out;
  const xr = sw > 1 && dw > 1 ? (sw - 1) / (dw - 1) : 0;
  const yr = sh > 1 && dh > 1 ? (sh - 1) / (dh - 1) : 0;
  for (let y = 0; y < dh; y++) {
    const fy = y * yr, y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = x * xr, x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), wx = fx - x0;
      const a = src[y0 * sw + x0] as number, b = src[y0 * sw + x1] as number;
      const c = src[y1 * sw + x0] as number, d = src[y1 * sw + x1] as number;
      out[y * dw + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy;
    }
  }
  return out;
}

/** RGBA (0..255) at w×h → NCHW [1,3,h,w] float32, normalized per the spec:
 *  (pixel/255 − mean)/std, RGB planes, alpha dropped. */
export function packNchwNormalized(
  rgba: ArrayLike<number>, w: number, h: number, spec: DepthModelSpec,
): Float32Array {
  const total = w * h;
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

/**
 * Raw single-channel model output → a 0..1 map where 1 is NEAREST.
 *
 * Depth Anything's head is relative INVERSE depth (disparity) on an arbitrary
 * scale that shifts per image, so min-max is the only normalisation available -
 * there is no absolute reference to anchor to. A flat field (max === min, e.g.
 * a solid colour) yields all-zeros rather than a divide-by-zero NaN, and NaN /
 * Infinity in the raw are skipped so one bad value cannot collapse the whole map.
 */
export function normaliseDepth(raw: ArrayLike<number>, count: number): Float32Array {
  const out = new Float32Array(count);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < count; i++) {
    const v = raw[i] as number;
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  if (!(span > 1e-9)) return out;
  for (let i = 0; i < count; i++) {
    const v = raw[i] as number;
    out[i] = Number.isFinite(v) ? (v - min) / span : 0;
  }
  return out;
}

/** Everything preprocessDepth produces that postprocessDepth needs. */
export interface DepthPre {
  /** Work-size dimensions (source capped to opts.maxEdge). */
  workW: number;
  workH: number;
  /** NCHW [1,3,edge,edge] float32, normalized per the spec - the model input. */
  input: Float32Array;
  /** Model square edge (spec.inputSize[0]). */
  edge: number;
}

/** Source frame → the model's normalized NCHW input, keeping the work size the
 *  map is handed back at. Two resamples on purpose: source → work (the iOS memory
 *  cap, and the size the render and the export actually use), then work → the
 *  model square. */
export function preprocessDepth(frame: DepthFrame, spec: DepthModelSpec, opts: DepthOpts = {}): DepthPre {
  const edge = spec.inputSize[0];
  const { width: workW, height: workH } = planWorkSize(frame.width, frame.height, opts.maxEdge ?? DEPTH_MAX_WORK_EDGE);
  const work = workW === frame.width && workH === frame.height
    ? frame.data
    : resampleRgba(frame.data, frame.width, frame.height, workW, workH);
  // 'stretch': the square is filled ignoring aspect. Letterboxing would put a
  // black border into the field, and that border becomes fake far-depth that
  // drags the min-max normalisation with it.
  const square = resampleRgba(work, workW, workH, edge, edge);
  return { workW, workH, input: packNchwNormalized(square, edge, edge, spec), edge };
}

/** The model's raw output → the finished work-size 0..1 depth map. */
export function postprocessDepth(raw: ArrayLike<number>, pre: DepthPre): DepthMap {
  const { edge, workW, workH } = pre;
  const normalised = normaliseDepth(raw, edge * edge);
  const data = edge === workW && edge === workH
    ? normalised
    : resampleFloat(normalised, edge, edge, workW, workH);
  return { width: workW, height: workH, data };
}
