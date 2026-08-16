// SPDX-License-Identifier: MPL-2.0
/**
 * deep-encode - one place that turns a linear {@link DeepFrame} into finished
 * image bytes at the depth the caller asked for. The four writers it wraps
 * (packExr, packRadiance, packPng) are pure and DOM-free, so this module is too:
 * it is the shared core behind the `host.codec` bridge, called identically by
 * the web shell and the Node CLI so a tool that hands over a float buffer gets
 * byte-identical output on either.
 *
 * The frame contract is the engine's own: RGBA interleaved Float32, LINEAR
 * light, un-premultiplied, unbounded, carrying its `space` (see pixels.ts). The
 * SDR encoders (png16 sRGB, dither8) gamma-encode and clamp to [0,1] at their
 * display-referred boundary; EXR and Radiance keep the unbounded linear values
 * (that is what those formats exist for). Nothing here mutates the input frame.
 */

import { type DeepFrame, convertSpace, linearToSrgb } from './pixels.ts';
import { packExr, type PackExrOptions } from './exr.ts';
import { packRadiance, type PackRadianceOptions } from './radiance.ts';
import { packPng } from './png.ts';

const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v);

/** OpenEXR master (half by default; float for a true float32 master). */
export function encodeExr(frame: DeepFrame, opts: PackExrOptions = {}): Uint8Array {
  return packExr(frame, opts);
}

/** Radiance RGBE (.hdr) master. */
export function encodeRadiance(frame: DeepFrame, opts: PackRadianceOptions = {}): Uint8Array {
  return packRadiance(frame, opts);
}

/**
 * 16-bit sRGB PNG. The frame is converted to sRGB primaries, gamma-encoded and
 * clamped, then written at 16 bits - real per-channel precision (65536 levels),
 * so gradients and grading math that the 8-bit path bands come out smooth. Not
 * an HDR container: HDR PNG is the separate PQ path in the shells. cICP is
 * tagged sRGB (primaries 1, transfer 13) so viewers read it unambiguously.
 */
export function encodePng16(frame: DeepFrame, opts: { dpi?: number; channels?: 3 | 4 } = {}): Uint8Array {
  const f = convertSpace(frame, 'srgb-linear');
  const channels = opts.channels ?? 4;
  const px = f.width * f.height;
  const out = new Uint16Array(px * channels);
  const src = f.data;
  for (let p = 0, s = 0, d = 0; p < px; p++, s += 4, d += channels) {
    out[d] = Math.round(clamp01(linearToSrgb(clamp01(src[s]!))) * 65535);
    out[d + 1] = Math.round(clamp01(linearToSrgb(clamp01(src[s + 1]!))) * 65535);
    out[d + 2] = Math.round(clamp01(linearToSrgb(clamp01(src[s + 2]!))) * 65535);
    if (channels === 4) out[d + 3] = Math.round(clamp01(src[s + 3]!) * 65535);
  }
  return packPng(out, {
    width: f.width, height: f.height, channels, depth: 16,
    cicp: { primaries: 1, transfer: 13, matrix: 0, fullRange: 1 },
    ...(opts.dpi && opts.dpi > 0 ? { dpi: opts.dpi } : {}),
  });
}

/**
 * Error-diffused 8-bit sRGB PNG. When the deliverable must be plain 8-bit but
 * the source is a deep float render, ordered quantisation bands; Floyd–Steinberg
 * diffusion trades that banding for fine dither noise, so an 8-bit export off
 * the float pipeline still reads as smooth. Deterministic (no RNG): the same
 * frame always yields the same bytes. Alpha is quantised, never diffused.
 */
export function encodeDither8(frame: DeepFrame, opts: { dpi?: number; channels?: 3 | 4 } = {}): Uint8Array {
  const f = convertSpace(frame, 'srgb-linear');
  const W = f.width, H = f.height, channels = opts.channels ?? 4;
  const src = f.data;
  // Per-channel error carried to the next pixel + the row below (two rows).
  const errCur = new Float32Array((W + 2) * 3);
  const errNext = new Float32Array((W + 2) * 3);
  const out = new Uint8ClampedArray(W * H * channels);
  for (let y = 0; y < H; y++) {
    errNext.fill(0);
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 4, d = (y * W + x) * channels, e = (x + 1) * 3;
      for (let c = 0; c < 3; c++) {
        const want = linearToSrgb(clamp01(src[s + c]!)) * 255 + errCur[e + c]!;
        const q = clamp01(Math.round(want) / 255) * 255;
        out[d + c] = q;
        const err = want - q;
        // Floyd–Steinberg kernel: 7/16 right, 3/16 down-left, 5/16 down, 1/16 down-right.
        errCur[e + 3 + c] = (errCur[e + 3 + c] ?? 0) + err * (7 / 16);
        errNext[e - 3 + c] = (errNext[e - 3 + c] ?? 0) + err * (3 / 16);
        errNext[e + c] = (errNext[e + c] ?? 0) + err * (5 / 16);
        errNext[e + 3 + c] = (errNext[e + 3 + c] ?? 0) + err * (1 / 16);
      }
      if (channels === 4) out[d + 3] = Math.round(clamp01(src[s + 3]!) * 255);
    }
    errCur.set(errNext);
  }
  return packPng(out, {
    width: W, height: H, channels, depth: 8,
    ...(opts.dpi && opts.dpi > 0 ? { dpi: opts.dpi } : {}),
  });
}
