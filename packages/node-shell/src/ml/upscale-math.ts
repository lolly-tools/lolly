// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free maths of `host.upscale`: tile sizing, the target-geometry plan,
 * the denoise blend, the plane-major to RGBA crop, and the memory estimate.
 *
 * SPLIT OUT of shells/web/src/lib/upscaler.ts (2026-09-03, plans/183 WS2),
 * which keeps importing every symbol below, so the web runner is unchanged. The
 * split exists because the Node upscaler (packages/node-shell/src/ml/upscale.ts)
 * has to tile identically and cannot import upscaler.ts: that file pulls in
 * lib/ort.ts, which is onnxruntime-web plus OffscreenCanvas.
 *
 * The device figures the web reads from `navigator.deviceMemory` and Node reads
 * from `os.totalmem()` are passed IN rather than probed here, so this module has
 * no host knowledge at all and the two shells pick the same tile edge for the
 * same amount of RAM.
 */

import type { UpscaleModelInfo, UpscaleOpts } from '@lolly-tools/core/host-v1';

/** Pre-scale pad per side, cropped back off after the model's own multiple. */
export const TILE_OVERLAP = 16;

/** Canvas dimension ceiling the browsers cap at (the Node path honours it too so
 *  a run that would be refused in the app is refused in the terminal). */
export const ABS_MAX_EDGE = 16384;
/** Absurd-ask guard independent of RAM. */
export const ABS_MAX_PIXELS = 40_000_000;

export function clamp255(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : v;
}

/** True when any pixel is non-opaque (so the RGB-only model needs the alpha split). */
export function hasAlpha(data: ArrayLike<number>): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return true;
  return false;
}

/** Pre-scale tile edge from a rough device-capability estimate - the memory
 *  lever. A tile allocates ~tile²·3·4 bytes in AND ~(tile·scale)²·3·4 out. */
export function tileEdgeFor(backend: 'webgpu' | 'wasm' | 'cpu', memoryGb: number): number {
  const gb = memoryGb > 0 ? memoryGb : 4;
  let edge = gb >= 8 ? 512 : gb >= 4 ? 384 : gb >= 2 ? 256 : 192;
  // WebGPU keeps intermediates GPU-side; the CPU/wasm kernels hold them in the
  // heap, so be a touch more conservative there on low-RAM devices.
  if (backend !== 'webgpu' && gb < 4) edge = Math.min(edge, 256);
  return edge;
}

/** Blend two plane-major float outputs of equal size: base*(1-w) + wdn*w.
 *  Real-ESRGAN's dni convention (net_a=general detail, net_b=wdn denoised) with
 *  the general net's weight = 1-denoise, so `denoise` in (0,1] slides from
 *  full detail (0) toward full denoise (1). */
export function blendPlanes(base: Float32Array, wdn: Float32Array, denoise: number): Float32Array {
  const out = new Float32Array(base.length);
  const a = 1 - denoise;
  for (let i = 0; i < out.length; i++) out[i] = (base[i] as number) * a + (wdn[i] as number) * denoise;
  return out;
}

/** Copy a cropped window of a plane-major float output into a straight-alpha
 *  RGBA buffer (alpha 255). `srcW/srcH` describe the full plane; the window is
 *  [cropX,cropY]..+[cropW,cropH]. */
export function planesToRgba(
  planes: ArrayLike<number>, srcW: number, srcH: number,
  cropX: number, cropY: number, cropW: number, cropH: number,
): Uint8ClampedArray<ArrayBuffer> {
  const page = srcW * srcH;
  const d = new Uint8ClampedArray(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const sy = cropY + y;
    for (let x = 0; x < cropW; x++) {
      const sIdx = sy * srcW + (cropX + x);
      const o = (y * cropW + x) * 4;
      d[o] = clamp255((planes[sIdx] as number) * 255);
      d[o + 1] = clamp255((planes[sIdx + page] as number) * 255);
      d[o + 2] = clamp255((planes[sIdx + 2 * page] as number) * 255);
      d[o + 3] = 255;
    }
  }
  return d;
}

export interface Target {
  outW: number;
  outH: number;
  finalW: number;
  finalH: number;
  downscale: boolean;
}

/** Native output is always w·nativeScale (the models are fixed multiples). The
 *  FINAL size is trimmed to `opts.scale` and `opts.targetMaxEdge`, whichever is
 *  smaller, by a single downscale after inference. */
export function planTarget(w: number, h: number, nativeScale: number, opts: UpscaleOpts): Target {
  const outW = w * nativeScale, outH = h * nativeScale;
  const maxSrcEdge = Math.max(w, h);
  const desiredScale = opts.scale ?? nativeScale;
  let finalEdge = maxSrcEdge * desiredScale;
  if (opts.targetMaxEdge && opts.targetMaxEdge > 0) finalEdge = Math.min(finalEdge, opts.targetMaxEdge);
  const nativeEdge = maxSrcEdge * nativeScale;
  if (finalEdge >= nativeEdge) return { outW, outH, finalW: outW, finalH: outH, downscale: false };
  const ratio = finalEdge / nativeEdge;
  return {
    outW, outH,
    finalW: Math.max(1, Math.round(outW * ratio)),
    finalH: Math.max(1, Math.round(outH * ratio)),
    downscale: true,
  };
}

/** Rough peak working set. The runner ALWAYS builds a native (w·scale × h·scale)
 *  output plus, when the source has alpha, a native alpha plane and native RGBA
 *  readouts, BEFORE the single downscale to the final size - so peak is dominated
 *  by the NATIVE intermediate, not the trimmed final. */
export function estimatePeakBytes(
  srcW: number, srcH: number, nativePixels: number, finalPixels: number,
  model: UpscaleModelInfo, backend: 'webgpu' | 'wasm' | 'cpu', memoryGb: number,
): number {
  const inBytes = srcW * srcH * 4;
  const nativeBytes = nativePixels * 4;
  const finalBytes = finalPixels * 4;
  const T = tileEdgeFor(backend, memoryGb);
  const tileBytes = (T * T * 3 * 4) + (T * model.scale) * (T * model.scale) * 3 * 4; // in + out float tile
  // native RGB buffer + native alpha buffer + a native RGBA readout (~3×), plus
  // the final downscaled copy, resident weights and a couple of tile tensors.
  return inBytes + nativeBytes * 3 + finalBytes + model.approxBytes + tileBytes * 2;
}

/** One tile of the plan: the core rectangle plus the padded window fed to the
 *  model. Shared so the two runners cut the image the same way. */
export interface TilePlan {
  cx: number; cy: number; cw: number; ch: number;
  px0: number; py0: number; pw: number; ph: number;
}

/** Every tile for a w×h source at tile edge `T`, in row-major order. */
export function planTiles(w: number, h: number, T: number): TilePlan[] {
  const out: TilePlan[] = [];
  const tilesX = Math.max(1, Math.ceil(w / T));
  const tilesY = Math.max(1, Math.ceil(h / T));
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const cx = tx * T, cy = ty * T;
      const cw = Math.min(T, w - cx), ch = Math.min(T, h - cy);
      const px0 = Math.max(0, cx - TILE_OVERLAP), py0 = Math.max(0, cy - TILE_OVERLAP);
      const px1 = Math.min(w, cx + cw + TILE_OVERLAP), py1 = Math.min(h, cy + ch + TILE_OVERLAP);
      out.push({ cx, cy, cw, ch, px0, py0, pw: px1 - px0, ph: py1 - py0 });
    }
  }
  return out;
}
