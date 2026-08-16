// SPDX-License-Identifier: MPL-2.0
/**
 * Gain maps: the ISO 21496-1 / Adobe "one file, two renditions" math
 * (deeprichpixels plan section 4.2, section 6 B2, section 8 row "gain maps spread beyond JPEG/AVIF").
 *
 * A gain map is a small greyscale image that says, per pixel, how much brighter
 * the HDR rendition is than the SDR one. The SDR rendition is the file every
 * decoder already understands. A gain-map-aware decoder multiplies it back up,
 * scaled by how much headroom the actual display has. That is why it is the only
 * HDR still output that renders as real HDR in Chromium/Safari/Android/iOS today
 * and degrades to a perfect ordinary SDR image everywhere else.
 *
 * This module is **container-agnostic on purpose**: it computes and inverts the
 * map and produces the metadata fields, and knows nothing about JPEG, MPF, XMP
 * or ISO boxes. B2 glues the result into a gain-map JPEG. A later PNG 4e / JXL /
 * AVIF gain map reuses this file unchanged (plan section 8: "the expensive part is
 * container-agnostic by construction"). It is also DOM-free like the rest of the
 * engine, so CLI and browser compute identical bytes.
 *
 * --- Sources (every formula cited at its use site) ---------------------------
 *   - ISO/CIE 21496-1:2025, "Gain map metadata for image conversion" - the
 *     standard the metadata fields below name.
 *   - Adobe Gain Map Specification v1.0 (the informative encode/decode method
 *     ISO 21496-1 formalises), https://helpx.adobe.com/camera-raw/using/gain-map.html
 *   - Google "Ultra HDR Image Format v1.1", the same equations in explicit
 *     pseudo-code: https://developer.android.com/media/platform/hdr-image-format
 *   - libultrahdr (Apache-2.0) gainmapmath.cpp - the reference implementation
 *     whose encode/decode gamma directions this module matches.
 *   - ITU-R BT.2020-2 Table 4 / BT.2100-2 - the luma coefficients used to reduce
 *     a pixel to the single luminance value a single-channel map carries.
 *
 * --- Decisions taken here, and why --------------------------------------------
 *
 * **Single channel (luminance), not RGB.** ISO 21496-1 allows a per-channel
 * (3-channel) gain map. We emit ONE channel. Our HDR rendition comes from
 * {@link hdrViewTransform}. That transform has two parts: a per-pixel *scalar*
 * boost on linear RGB, which one luminance channel reproduces exactly, and the
 * `richness` re-saturation, which is a per-channel chroma change a scalar map
 * CANNOT carry. Richness is on by default (`hdr.ts` defaults it to 0.4, and the
 * export dials leave it there unless an author moves them), so the reconstructed
 * HDR rendition is slightly less saturated than the float transform's. This is
 * measured in the round-trip test. That is the concrete case for a future RGB
 * mode; the trade today is one third of the bytes for exact luminance and
 * approximate chroma. `meta.channels` is `1` so a future RGB mode is an
 * additive change, not a breaking one.
 *
 * **The ratio is computed in ONE space: `rec2020-linear`.** {@link hdrViewTransform}
 * returns `rec2020-linear`; a canvas SDR render arrives as `srgb-linear` from
 * `fromU8Srgb`. Taking the ratio without converting would encode a *gamut* change
 * into the map (a saturated sRGB red has Rec.709 luminance 0.2126 but its raw
 * channels weighted with BT.2020 coefficients give 0.2627, a bogus -0.30 log2
 * "gain" on a pixel that did not change at all). Both sides are converted to
 * `rec2020-linear` before the luminance reduction; `tests/gainmap.test.ts` pins
 * this with that exact counterfactual.
 *
 * **Negative and non-finite inputs (the float-path footgun).** `hdrViewTransform`
 * deliberately does not clamp (plan section 9b post-review: "the float behaviour is the
 * correct one"), so both frames can carry negative channels (out-of-gamut
 * excursions) and a damaged upstream can carry NaN. `log2` of a negative is NaN,
 * which would poison the min/max fit for the whole image. Policy, applied to the
 * *luminance* after reduction and never to the caller's frames:
 *   1. non-finite -> 0 (the `san` idiom shared with hdr.ts and icc-pixels.ts);
 *   2. negative -> 0 (clamped at the offset floor - offsets exist precisely to
 *      keep the ratio defined near zero);
 *   3. a pixel whose base or alternate luminance is still 0 after that has NO
 *      defined ratio. It is assigned the neutral gain (log2 = 0), and EXCLUDED
 *      from the min/max fit so a large black region cannot stretch the range and
 *      steal quantisation resolution from the rest of the image. This is safe
 *      because the decode is multiplicative: with `offsetSdr = 0` a black base
 *      pixel decodes to black whatever the map says.
 *
 * **Offsets default to 0, not the conventional 1/64.** The offsets keep the
 * ratio finite near zero, and the spec default is 1/64. But we do not need them
 * for that (policy 3 above covers it), and they cost real accuracy in our case:
 * the map carries *luminance* gain while the decoder applies it per channel, so
 * a non-zero offset makes the decode exact only for neutrals: a saturated red
 * boosted 2x comes back about 3% dark. With offsets 0 the decode is a pure
 * scalar and is exact for every hue, and the scalar commutes with the primary
 * matrix, so it no longer matters which linear space the decoder applies it in.
 * Both offsets remain options for callers who want the conventional floor, and
 * whatever is used is written into the metadata, so a conformant decoder
 * follows either way.
 */

import { convertSpace, type DeepFrame } from './pixels.ts';

// --- metadata --------------------------------------------------------------------

/**
 * The ISO 21496-1 / Adobe gain-map metadata a container must carry beside the
 * map image. Names follow the Adobe/Ultra HDR XMP vocabulary (`hdrgm:*`). The
 * ISO box spells the same quantities as signed rationals and calls the capacity
 * pair "HDR headroom". The container writer converts; this module does not.
 *
 * All four log2 fields are log2 ratios (0 = no change), NOT linear multipliers.
 */
export interface GainMapMeta {
  /** 1 = single-channel (luminance) map. See the module header for why. */
  channels: 1;
  /** log2 of the smallest gain in the map - `hdrgm:GainMapMin`. */
  gainMapMin: number;
  /** log2 of the largest gain in the map - `hdrgm:GainMapMax`. */
  gainMapMax: number;
  /** Encoding gamma applied to the normalised map value - `hdrgm:Gamma`. > 0. */
  gamma: number;
  /** Constant added to the base (SDR) value before the ratio - `hdrgm:OffsetSDR`. */
  offsetSdr: number;
  /** Constant added to the alternate (HDR) value before the ratio - `hdrgm:OffsetHDR`. */
  offsetHdr: number;
  /** log2 display headroom at/below which the map is not applied - `hdrgm:HDRCapacityMin`. */
  hdrCapacityMin: number;
  /** log2 display headroom at/above which the map is applied in full - `hdrgm:HDRCapacityMax`. */
  hdrCapacityMax: number;
  /** Which rendition the primary image holds. Lolly always writes the SDR one. */
  baseRendition: 'sdr';
  /**
   * `hdrgm:BaseRenditionIsHDR == false` companion: whether the gain is applied
   * in the base image's colour space. True here: the map is a scalar, and with
   * `offsetSdr = 0` a scalar commutes with any primary matrix, so base-space
   * application is exact (see the module header).
   */
  useBaseColorSpace: boolean;
}

/** Diagnostics about the fit. Not spec metadata, but the honest record of what happened. */
export interface GainMapStats {
  /** Pixels whose ratio was undefined (zero base or alternate light after the clamp policy). */
  undefinedPixels: number;
  /** Pixels whose ratio fell outside an explicitly-requested range and was clamped. */
  clampedPixels: number;
  /** Pixels whose input luminance was non-finite before sanitisation. */
  nonFinitePixels: number;
  /** True when the fitted range was degenerate (min == max) and the map is constant. */
  degenerate: boolean;
}

export interface GainMapResult {
  width: number;
  height: number;
  /** Single channel, one byte per pixel, row-major - length = width * height. */
  map: Uint8ClampedArray;
  meta: GainMapMeta;
  stats: GainMapStats;
}

export interface GainMapOptions {
  /** Encoding gamma (`hdrgm:Gamma`). Default 1 (linear in log2 space). Must be > 0. */
  gamma?: number;
  /** Base-side offset. Default 0 - see the module header. */
  offsetSdr?: number;
  /** Alternate-side offset. Default 0 - see the module header. */
  offsetHdr?: number;
  /** Force the low end of the log2 range instead of fitting it to the image. */
  minLog2?: number;
  /** Force the high end of the log2 range instead of fitting it to the image. */
  maxLog2?: number;
}

const DEFAULTS = { gamma: 1, offsetSdr: 0, offsetHdr: 0 } as const;

// --- luminance -------------------------------------------------------------------

/**
 * ITU-R BT.2020-2 Table 4 (and BT.2100-2) non-constant-luminance coefficients.
 * Applied to linear Rec.2020 RGB, which is the ONE space this module reduces in.
 */
const BT2020_LUMA: readonly [number, number, number] = [0.2627, 0.678, 0.0593];

/** Non-finite -> 0. The same idiom and verdict as hdr.ts#san / icc-pixels.ts#san. */
const san = (v: number): number => (Number.isFinite(v) ? v : 0);

/** The colour space every gain ratio in this module is computed in. */
export const GAIN_MAP_SPACE = 'rec2020-linear' as const;

// --- computeGainMap ----------------------------------------------------------

/**
 * Compute the gain map between an SDR rendition and its HDR rendition.
 *
 * Both frames are converted to {@link GAIN_MAP_SPACE} and reduced to BT.2020
 * luminance, then per pixel (Adobe Gain Map spec / Ultra HDR "gain map math"):
 *
 * ```
 *   pixelGain = (hdrY + offsetHdr) / (sdrY + offsetSdr)
 *   logGain   = log2(pixelGain)
 *   t         = clamp((logGain - gainMapMin) / (gainMapMax - gainMapMin), 0, 1)
 *   map       = round(255 * t^gamma)
 * ```
 *
 * `gainMapMin`/`gainMapMax` are fitted over the image unless overridden. The
 * gamma direction matches libultrahdr: `pow(t, gamma)` on encode, `pow(v, 1/gamma)`
 * on decode ({@link applyGainMap}). At the default gamma of 1, both are identity.
 *
 * Neither input frame is mutated. Throws only on a caller mistake (mismatched
 * dimensions, non-positive gamma, negative offsets); pixel damage is handled by
 * the sanitisation policy in the module header, never by throwing mid-export.
 */
export function computeGainMap(sdr: DeepFrame, hdr: DeepFrame, opts: GainMapOptions = {}): GainMapResult {
  const { width, height } = sdr;
  if (hdr.width !== width || hdr.height !== height) {
    throw new Error(`computeGainMap: size mismatch ${width}x${height} vs ${hdr.width}x${hdr.height}`);
  }
  const gamma = opts.gamma ?? DEFAULTS.gamma;
  const offsetSdr = opts.offsetSdr ?? DEFAULTS.offsetSdr;
  const offsetHdr = opts.offsetHdr ?? DEFAULTS.offsetHdr;
  if (!(gamma > 0) || !Number.isFinite(gamma)) throw new Error(`computeGainMap: gamma must be > 0, got ${gamma}`);
  if (!(offsetSdr >= 0) || !(offsetHdr >= 0)) throw new Error('computeGainMap: offsets must be >= 0');

  // The one space the ratio is defined in (see the module header's second
  // decision). convertSpace returns the same object when already there, so this
  // is free for the hdrViewTransform side and one pass for a canvas SDR frame.
  const s = convertSpace(sdr, GAIN_MAP_SPACE).data;
  const h = convertSpace(hdr, GAIN_MAP_SPACE).data;
  const n = width * height;

  const logGain = new Float64Array(n);
  const defined = new Uint8Array(n);
  const stats: GainMapStats = { undefinedPixels: 0, clampedPixels: 0, nonFinitePixels: 0, degenerate: false };

  let fitMin = Number.POSITIVE_INFINITY;
  let fitMax = Number.NEGATIVE_INFINITY;

  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const sr = s[i]!, sg = s[i + 1]!, sb = s[i + 2]!;
    const hr = h[i]!, hg = h[i + 1]!, hb = h[i + 2]!;
    if (!Number.isFinite(sr + sg + sb + hr + hg + hb)) stats.nonFinitePixels++;
    // Reduce to BT.2020 luminance, then apply the sanitisation policy: non-finite
    // -> 0, negative -> 0. Note the clamp is on the LUMINANCE, so an in-gamut
    // pixel with one negative channel keeps its true (positive) luminance.
    let ys = san(sr) * BT2020_LUMA[0] + san(sg) * BT2020_LUMA[1] + san(sb) * BT2020_LUMA[2];
    let yh = san(hr) * BT2020_LUMA[0] + san(hg) * BT2020_LUMA[1] + san(hb) * BT2020_LUMA[2];
    if (!(ys > 0)) ys = 0;
    if (!(yh > 0)) yh = 0;

    const denom = ys + offsetSdr;
    const num = yh + offsetHdr;
    if (denom > 0 && num > 0) {
      const g = Math.log2(num / denom);
      logGain[p] = g;
      defined[p] = 1;
      if (g < fitMin) fitMin = g;
      if (g > fitMax) fitMax = g;
    } else {
      // No defined ratio (policy 3). Neutral gain, excluded from the fit.
      logGain[p] = 0;
      stats.undefinedPixels++;
    }
  }

  // Fitted range, or the caller's override. An all-undefined image (fully black,
  // zero offsets) has no samples at all: fall back to the neutral 0..0 range.
  let min = opts.minLog2 ?? (Number.isFinite(fitMin) ? fitMin : 0);
  let max = opts.maxLog2 ?? (Number.isFinite(fitMax) ? fitMax : 0);
  if (max < min) [min, max] = [max, min];

  const span = max - min;
  // Degenerate but VALID: a flat image (or one whose whole range collapses) has
  // nothing to interpolate. lerp(min, max, t) == min for every t, so the map is
  // constant and no division by zero is needed. 255 is chosen so the map reads
  // as "apply the (single) gain in full".
  stats.degenerate = !(span > 0);

  const map = new Uint8ClampedArray(n);
  if (stats.degenerate) {
    map.fill(255);
  } else {
    const invSpan = 1 / span;
    const identityGamma = gamma === 1;
    for (let p = 0; p < n; p++) {
      const raw = (logGain[p]! - min) * invSpan;
      const t = raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
      if (t !== raw && defined[p] === 1) stats.clampedPixels++;
      const e = identityGamma ? t : t ** gamma;
      map[p] = Math.round(e * 255);
    }
  }

  return {
    width,
    height,
    map,
    meta: {
      channels: 1,
      gainMapMin: min,
      gainMapMax: max,
      gamma,
      offsetSdr,
      offsetHdr,
      // libultrahdr's convention: the base is SDR, so the map starts being
      // applied at zero headroom, and is applied in full at the headroom the
      // brightest gain actually asks for. Clamped at 0 so a map that only ever
      // darkens still declares a non-negative capacity, as the spec requires.
      hdrCapacityMin: 0,
      hdrCapacityMax: Math.max(max, 0),
      baseRendition: 'sdr',
      useBaseColorSpace: true,
    },
    stats,
  };
}

// ─── the decoder side ─────────────────────────────────────────────────────────

/**
 * The display-adaptive weight a decoder applies to the gain (Adobe Gain Map spec
 * / Ultra HDR): 0 on an SDR display, 1 on a display with at least the headroom
 * the map asks for, linear in log2 headroom between.
 *
 * `displayHeadroomLog2` is log2(peak luminance / SDR reference white). For example
 * 0 for an SDR display, log2(1000/203) ~= 2.30 for the 1000-nit target
 * `hdrViewTransform` boosts toward.
 */
export function gainMapWeight(meta: GainMapMeta, displayHeadroomLog2: number): number {
  const lo = meta.hdrCapacityMin;
  const hi = meta.hdrCapacityMax;
  const hr = san(displayHeadroomLog2);
  // Degenerate capacity range (hi == lo): a hard switch at the threshold. An SDR
  // display (hr <= lo) must NEVER get the gain: applying it there would break the
  // "degrades to a perfect SDR image" promise, which is the whole point of the
  // format. Only a display strictly past the threshold takes the full gain.
  if (!(hi > lo)) return hr > lo ? 1 : 0;
  const w = (hr - lo) / (hi - lo);
  return w <= 0 ? 0 : w >= 1 ? 1 : w;
}

export interface ApplyGainMapOptions {
  /**
   * log2 display headroom, fed through {@link gainMapWeight}. Default: full
   * application (weight 1), which reconstructs the HDR rendition the map was
   * computed from: the round-trip case.
   */
  displayHeadroomLog2?: number;
  /** Explicit weight in [0,1], overriding `displayHeadroomLog2`. */
  weight?: number;
}

/**
 * The decoder half: reconstruct the HDR rendition from the SDR one plus the map.
 * Not used by the export path (a real decoder does this on the viewer's device).
 * It exists so the claim "this map means hdr = sdr * 2^gain" is testable, and
 * so a CLI/preview path can show what a viewer will see.
 *
 * Per Adobe/Ultra HDR, with `t` the map value normalised to [0,1]:
 *
 * ```
 *   logRecovery = t^(1/gamma)
 *   logBoost    = gainMapMin * (1 - logRecovery) + gainMapMax * logRecovery
 *   hdr         = (sdr + offsetSdr) * 2^(logBoost * weight) - offsetHdr
 * ```
 *
 * The boost is a scalar applied to each linear channel, so hue is preserved by
 * construction. The returned frame is new and carries the INPUT frame's space:
 * with `offsetSdr = 0` (our default) the scalar commutes with the primary
 * matrix, so applying before or after a space conversion gives identical results.
 * This is pinned by tests. With non-zero offsets, apply in the space the map was
 * computed in ({@link GAIN_MAP_SPACE}) for exactness.
 */
export function applyGainMap(
  sdr: DeepFrame,
  map: Uint8ClampedArray | Uint8Array,
  meta: GainMapMeta,
  opts: ApplyGainMapOptions = {},
): DeepFrame {
  const n = sdr.width * sdr.height;
  if (map.length !== n) {
    throw new Error(`applyGainMap: map length ${map.length} != ${sdr.width}x${sdr.height} (${n})`);
  }
  const weight = opts.weight !== undefined
    ? Math.min(1, Math.max(0, san(opts.weight)))
    : gainMapWeight(meta, opts.displayHeadroomLog2 ?? meta.hdrCapacityMax);

  const src = sdr.data;
  const out = new Float32Array(src.length);
  const invGamma = 1 / meta.gamma;
  const identityGamma = meta.gamma === 1;
  // 256-entry LUT: the map has only 256 possible values, so the pow/exp2 pair
  // runs 256 times instead of once per pixel.
  const boost = new Float64Array(256);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    const lr = identityGamma ? t : t ** invGamma;
    const logBoost = meta.gainMapMin * (1 - lr) + meta.gainMapMax * lr;
    boost[v] = 2 ** (logBoost * weight);
  }

  // Damage in the base frame is sanitised here too (same `san` verdict as the
  // encoder and hdr.ts), so the decoder is total: nothing can turn a NaN base
  // pixel into a NaN HDR pixel further down a pipeline.
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const b = boost[map[p]! & 0xff]!;
    out[i] = (san(src[i]!) + meta.offsetSdr) * b - meta.offsetHdr;
    out[i + 1] = (san(src[i + 1]!) + meta.offsetSdr) * b - meta.offsetHdr;
    out[i + 2] = (san(src[i + 2]!) + meta.offsetSdr) * b - meta.offsetHdr;
    out[i + 3] = san(src[i + 3]!); // alpha is not gained
  }
  return { width: sdr.width, height: sdr.height, data: out, space: sdr.space };
}
