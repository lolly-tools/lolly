// SPDX-License-Identifier: MPL-2.0
/**
 * Animated GIF export. Frames are captured sequentially through the shared
 * FrameSource (each a unique animation moment) and encoded via gifenc, with an
 * optional Floyd-Steinberg dither.
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { GifPalette } from 'gifenc';
import { createFrameSource } from './dom.ts';
import { withGifComment } from './metadata.ts';
import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';

interface DitherState {
  out: Uint8Array;
  buf: Float32Array;
  cache: Int16Array;
}

// Allocates the reusable scratch buffers for the Floyd-Steinberg path. Hoisted so
// an animated GIF keeps ONE set of buffers across all frames: the error buffer is
// re-seeded from each frame's pixels, and the nearest-colour cache is carried over
// (the palette is fixed after frame 0, so cached lookups stay correct).
function createDitherState(width: number, height: number): DitherState {
  const n = width * height;
  return {
    out: new Uint8Array(n),
    buf: new Float32Array(n * 3),        // diffused error, may exceed [0,255]
    cache: new Int16Array(32768).fill(-1), // 15-bit (5 bits/channel) nearest cache
  };
}

// Floyd-Steinberg ordered dithering. Quantizes pixels to the given palette while
// propagating quantisation error to neighbouring pixels to reduce colour banding.
// Returns a Uint8Array of palette indices, matching gifenc's writeFrame() layout.
//
// Typed-array reads use `?? 0` only where the index is provably in range (the
// loops are bounded by the buffer sizes) — behaviour is byte-identical.
function ditherFloydSteinberg(data: Uint8ClampedArray, width: number, height: number, palette: GifPalette, state: DitherState): Uint8Array {
  const n = width * height;
  const st = state;
  const out = st.out;

  const buf = st.buf;
  for (let i = 0; i < n; i++) {
    buf[i * 3]     = data[i * 4] ?? 0;
    buf[i * 3 + 1] = data[i * 4 + 1] ?? 0;
    buf[i * 3 + 2] = data[i * 4 + 2] ?? 0;
  }

  const cache = st.cache;
  function nearest(r: number, g: number, b: number): number {
    const key = (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
    const cached = cache[key] ?? -1;
    if (cached >= 0) return cached;
    let best = 0, bestD = Infinity, c = 0;
    for (const pc of palette) {
      const [pr = 0, pg = 0, pb = 0] = pc;
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < bestD) { bestD = d; best = c; }
      c++;
    }
    cache[key] = best;
    return best;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = i * 3;

      const r = Math.round(Math.max(0, Math.min(255, buf[p] ?? 0)));
      const g = Math.round(Math.max(0, Math.min(255, buf[p + 1] ?? 0)));
      const b = Math.round(Math.max(0, Math.min(255, buf[p + 2] ?? 0)));

      const idx = nearest(r, g, b);
      out[i] = idx;

      const [pr = 0, pg = 0, pb = 0] = palette[idx] ?? [];
      const er = r - pr;
      const eg = g - pg;
      const eb = b - pb;

      // Diffuse error: right=7/16, bottom-left=3/16, bottom=5/16, bottom-right=1/16
      if (x + 1 < width) {
        const q = p + 3;
        buf[q] = (buf[q] ?? 0) + er * 0.4375; buf[q + 1] = (buf[q + 1] ?? 0) + eg * 0.4375; buf[q + 2] = (buf[q + 2] ?? 0) + eb * 0.4375;
      }
      if (y + 1 < height) {
        if (x > 0) {
          const q = p + width * 3 - 3;
          buf[q] = (buf[q] ?? 0) + er * 0.1875; buf[q + 1] = (buf[q + 1] ?? 0) + eg * 0.1875; buf[q + 2] = (buf[q + 2] ?? 0) + eb * 0.1875;
        }
        const q0 = p + width * 3;
        buf[q0] = (buf[q0] ?? 0) + er * 0.3125; buf[q0 + 1] = (buf[q0 + 1] ?? 0) + eg * 0.3125; buf[q0 + 2] = (buf[q0 + 2] ?? 0) + eb * 0.3125;
        if (x + 1 < width) {
          const q1 = p + width * 3 + 3;
          buf[q1] = (buf[q1] ?? 0) + er * 0.0625; buf[q1 + 1] = (buf[q1 + 1] ?? 0) + eg * 0.0625; buf[q1 + 2] = (buf[q1 + 2] ?? 0) + eb * 0.0625;
        }
      }
    }
  }

  return out;
}

// Renders the DOM node as an animated GIF.
//
// opts.wait     — seconds before capture starts (default 1)
// opts.duration — clip length in seconds (default 5)
// opts.dither   — Floyd-Steinberg dithering (default false)
async function renderGif(node: HTMLElement, opts: ExportOptions): Promise<Blob> {
  const fps = 15;
  const frameInterval = Math.round(1000 / fps); // 67ms → rounds to 70ms in GIF centiseconds
  const durationMs = (opts.duration ?? 5) * 1000;
  const frameCount = Math.max(1, Math.round(durationMs / frameInterval));
  const dither = Boolean(opts.dither);

  const source = await createFrameSource(node, opts);
  const targetW = source.width, targetH = source.height;

  const offscreen = document.createElement('canvas');
  offscreen.width = targetW;
  offscreen.height = targetH;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) throw new Error('GIF export needs a 2D canvas context');

  try {
    const gif = GIFEncoder();
    let palette: GifPalette | null = null;

    const ditherState = dither ? createDitherState(targetW, targetH) : null;

    const encodeFrame = (pixels: Uint8ClampedArray): Uint8Array => (dither && ditherState && palette)
      ? ditherFloydSteinberg(pixels, targetW, targetH, palette, ditherState)
      : applyPalette(pixels, palette ?? []);

    for (let i = 0; i < frameCount; i++) {
      const canvas = await source.frame();
      offCtx.clearRect(0, 0, targetW, targetH);
      offCtx.drawImage(canvas, 0, 0, targetW, targetH);
      const pixels = offCtx.getImageData(0, 0, targetW, targetH).data;

      if (i === 0) {
        // Build global palette from the first frame; reuse for all subsequent frames.
        palette = quantize(pixels, 256);
        gif.writeFrame(encodeFrame(pixels), targetW, targetH, { palette, delay: frameInterval, repeat: opts.repeat != null ? opts.repeat : 0 });
      } else {
        gif.writeFrame(encodeFrame(pixels), targetW, targetH, { delay: frameInterval });
      }
      opts.onProgress?.(i + 1, frameCount);
    }

    gif.finish();
    let bytes = gif.bytesView();
    if (opts.meta) {
      const credit = [opts.meta.description, opts.meta.contact, opts.meta.source].filter(Boolean).join(' · ');
      bytes = withGifComment(bytes, credit);
    }
    return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  } finally {
    source.dispose();
  }
}

export const gifAdapter: FormatAdapter = {
  formats: ['gif'],
  render(ctx: RenderContext): Promise<Blob> {
    return renderGif(ctx.node, ctx.opts);
  },
};
