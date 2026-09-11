// SPDX-License-Identifier: MPL-2.0
/**
 * hdr-image.ts - turn an SDR RGBA buffer into a lossless HDR PNG (Rec.2100 PQ,
 * cICP 9/16/0/1) that WebKit paints ABOVE SDR white on an HDR display.
 *
 * WebKit has no live HDR canvas (no `configureHighDynamicRange`), but Safari
 * renders a cICP PNG in EDR - verified on an iPad Pro tandem OLED, 2026-08-25
 * (plan 154 WP-5). The maths is the engine's deep pipeline, so web and any other
 * caller read identical pixels:
 *
 *   fromU8Srgb  →  lightness-gated exposure into the display's headroom
 *               →  Rec.2100 PQ (pqEncodeFrame)  →  16-bit (pqToU16)  →  packPng.
 *
 * DOM-free except for the optional Blob URL. The exposure lifts the LIGHT end of
 * the image into headroom while darks hold at SDR luminance - the honest "the top
 * of the lightness axis now glows" treatment, not a flat gain that would wash the
 * whole field. The knobs mirror the stills-HDR dials and are meant to be tuned.
 */
import {
  fromU8Srgb, pqEncodeFrame, pqToU16, packPng, HDR_PQ_CICP,
} from '@lolly/engine';
import type { DeepFrame, PixelSpace } from '@lolly/engine';

/** A job posted to hdr-image.worker.ts. `rgba` is a transferred ArrayBuffer (the
 *  RGBA bytes); the worker returns {@link HdrResult}. */
export interface HdrJob {
  id: number;
  rgba: ArrayBuffer;
  width: number;
  height: number;
  space: PixelSpace;
  depth: 8 | 16;
  exp?: HdrExposure;
}
/** The worker's reply: `png` is a transferred ArrayBuffer of the finished PNG. */
export interface HdrResult { id: number; png: ArrayBuffer; }

export interface HdrExposure {
  /** Nits the brightest content reaches - the headroom ceiling. Default 1000. */
  peakNits?: number;
  /** SDR reference white in nits (BT.2408 diffuse white). Default 203. */
  sdrWhiteNits?: number;
  /** Luma at/below which a pixel keeps SDR luminance (darks hold). Default 0.5. */
  kneeLo?: number;
  /** Luma at/above which a pixel rides all the way to `peakNits`. Default 1. */
  kneeHi?: number;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smooth 0→1 ramp between `lo` and `hi` (Hermite), so the exposure has no seam. */
function smoothstep(lo: number, hi: number, x: number): number {
  if (hi <= lo) return x >= hi ? 1 : 0;
  const t = clamp01((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
}

/** The lightness-gated exposure, in place on a LINEAR RGBA buffer: darks hold, the
 *  light end rides toward `maxGain`. Shared by the PQ (image) and extended-linear
 *  (WebGL) paths so the two cannot drift. Alpha (i+3) is left untouched. */
function applyExposure(d: Float32Array, maxGain: number, kneeLo: number, kneeHi: number): void {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0, g = d[i + 1] ?? 0, b = d[i + 2] ?? 0;
    // Rec.709 luma is a fine "how light" gate here - we do not need exact Y.
    const gain = 1 + (maxGain - 1) * smoothstep(kneeLo, kneeHi, 0.2126 * r + 0.7152 * g + 0.0722 * b);
    d[i] = r * gain; d[i + 1] = g * gain; d[i + 2] = b * gain;
  }
}

/**
 * The exposed slice as EXTENDED-range LINEAR float RGBA - the source texture for a
 * WebGL RGBA16F HDR drawing buffer (Tier A, plan 154 WP-5). Same exposure as
 * {@link hdrPngBytes}, but LINEAR and unbounded above 1.0 (= above SDR white). The
 * transfer encode is left to the shader so it can be toggled against whichever the
 * `configureHighDynamicRange` drawing buffer actually wants (linear vs sRGB-encoded)
 * - the one thing that needs a real HDR display to pin down. `space` names the
 * linear primaries; the WebGL canvas is set to the matching `drawingBufferColorSpace`.
 */
export function hdrExposedLinearRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  space: PixelSpace,
  exp: HdrExposure = {},
): Float32Array {
  const white = exp.sdrWhiteNits ?? 203;
  const maxGain = Math.max(1, (exp.peakNits ?? 1000) / white);
  const frame: DeepFrame = { ...fromU8Srgb(rgba, width, height), space };
  applyExposure(frame.data, maxGain, exp.kneeLo ?? 0.5, exp.kneeHi ?? 1);
  const d = frame.data;
  const out = new Float32Array(d.length);
  out.set(d);
  for (let i = 3; i < out.length; i += 4) out[i] = clamp01(out[i] ?? 1); // clamp alpha only
  return out;
}

/**
 * Bytes of a 16-bit Rec.2100-PQ cICP PNG built from an SDR RGBA buffer.
 *
 * `space` is the LINEAR space the bytes decode to once the transfer is undone.
 * `fromU8Srgb` undoes the sRGB transfer, which Display-P3 SHARES, so the linear
 * numbers are correct for either primaries - pass `'display-p3-linear'` to keep a
 * wide-gamut source wide (Rec.2100 contains P3), `'srgb-linear'` for an sRGB one.
 */
export function hdrPngBytes(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  space: PixelSpace,
  exp: HdrExposure = {},
  depth: 8 | 16 = 16,
): Uint8Array {
  const white = exp.sdrWhiteNits ?? 203;
  const maxGain = Math.max(1, (exp.peakNits ?? 1000) / white);
  const kneeLo = exp.kneeLo ?? 0.5;
  const kneeHi = exp.kneeHi ?? 1;

  // The bytes are relabelled to `space` because fromU8Srgb only undoes the
  // (shared) transfer; the primaries are the caller's to declare.
  const frame: DeepFrame = { ...fromU8Srgb(rgba, width, height), space };
  applyExposure(frame.data, maxGain, kneeLo, kneeHi);
  const pq = pqEncodeFrame(frame, white);
  if (depth === 16) {
    return packPng(pqToU16(pq), { width, height, channels: 4, depth: 16, cicp: HDR_PQ_CICP });
  }
  // 8-bit is ~half the bytes to deflate - the fast path for a LIVE preview. PQ
  // bands slightly in the shadows at 8 bits, invisible in a bright gradient field,
  // and it still glows (the iPad proof JPEGs were 8-bit). Exports keep 16.
  const src = pq.data;
  const u8 = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i++) u8[i] = Math.round(clamp01(src[i] ?? 0) * 255);
  return packPng(u8, { width, height, channels: 4, depth: 8, cicp: HDR_PQ_CICP });
}

/** A Blob URL for {@link hdrPngBytes}. The caller owns it - revoke it when it is
 *  replaced or the element goes away (`URL.revokeObjectURL`). */
export function hdrPngUrl(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  space: PixelSpace,
  exp?: HdrExposure,
  depth: 8 | 16 = 16,
): string {
  // `as BlobPart`: packPng returns Uint8Array<ArrayBufferLike>, which the Blob
  // constructor's lib types reject - the same cast the export bridges use.
  return URL.createObjectURL(new Blob([hdrPngBytes(rgba, width, height, space, exp, depth) as BlobPart], { type: 'image/png' }));
}
