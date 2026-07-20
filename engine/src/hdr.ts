// SPDX-License-Identifier: MPL-2.0
/**
 * HDR raster export — brand-colour highlight boost + PQ (SMPTE ST 2084) encoding.
 * Platform-agnostic: pure pixel math, no DOM, no network. The sibling of
 * color.ts — where color.ts owns the *profile* bytes a raster file carries, this
 * owns the *pixel transform* that turns an SDR canvas render into HDR content the
 * profile then describes.
 *
 * ─── What "HDR" means here ────────────────────────────────────────────────────
 * The render canvas is 8-bit sRGB (SDR). An HDR display has headroom *above* SDR
 * reference white (~203 nits, ITU-R BT.2408) up to ~1000+ nits. This transform:
 *
 *   1. Maps every pixel into a BT.2020 / PQ container so the whole image is a
 *      coherent HDR signal. A pixel with gain 1 lands at its normal SDR
 *      appearance (sRGB white → SDR reference white), so non-brand content looks
 *      unchanged on an HDR display and tone-maps back to correct SDR elsewhere.
 *   2. Boosts pixels that match the active brand's colours toward peak luminance
 *      — that's the "glow". The boost is a luminance multiplier on linear RGB, so
 *      it brightens without shifting hue/saturation.
 *
 * The boost is profile-agnostic: callers pass the brand's own colours as
 * `targets` (the engine never hardcodes a brand). Near-white is included by
 * default so white text glows — the request that seeded this feature.
 *
 * ─── Lightness-gated boost ────────────────────────────────────────────────────
 * Mid-lightness-and-above brand colours (white, and mid/light primaries) get the
 * full peak multiplier — white hits the peak and a saturated mid primary isn't far
 * behind (same multiplier; white stays brightest in absolute nits by physics). The
 * multiplier rolls off smoothly for colours *below* mid lightness, so dark
 * primaries (a near-black pine, a deep midnight) are calmed rather than blown out
 * into a different-looking bright colour. The gate is a smoothstep on OKLab
 * lightness between `kneeLo` and `kneeHi`:
 *   `gainFor(L) = 1 + (maxGain − 1)·(boostFloor + (1 − boostFloor)·smoothstep(kneeLo, kneeHi, L))`,
 *   maxGain = peakNits / sdrWhiteNits.
 * The multiplier is applied to linear RGB, so it brightens without shifting hue.
 *
 * The output pixel values are PQ code values; they only render as HDR when the
 * file also carries the Rec.2100-PQ signal (JPEG: the cICP tag inside the ICC
 * profile from color.ts#pqBt2020IccProfile; PNG: a cICP chunk). Without that
 * signal a decoder reads the raw PQ codes as sRGB and the image looks dark — the
 * transform and the signal MUST travel together.
 */

import { parseHex } from './brand-derive.ts';

/**
 * Rec.2100 PQ coding-independent code points, as they appear in the ICC `cicp`
 * tag (JPEG) and the PNG `cICP` chunk. BT.2020 primaries (9), SMPTE ST 2084 / PQ
 * transfer (16), identity/RGB matrix (0, the samples are RGB not YCbCr for the
 * colour-management layer), full-range (1). This is the exact tuple the reference
 * HDR JPEGs that motivated the feature carry.
 */
export const HDR_PQ_CICP = { primaries: 9, transfer: 16, matrix: 0, fullRange: 1 } as const;

// ─── transfer functions ───────────────────────────────────────────────────────

// sRGB EOTF: encoded [0,1] → linear light [0,1]. Mirrors color.ts / brand-derive
// (kept in sync deliberately; it's the standard piecewise IEC 61966-2.1 curve).
const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

// SMPTE ST 2084 (PQ) inverse-EOTF (OETF): absolute luminance normalised to
// [0,1] where 1.0 = 10 000 nits → PQ code value [0,1]. The five constants are
// the ST 2084 magic numbers; do not "simplify".
const PQ_M1 = 2610 / 16384;
const PQ_M2 = (2523 / 4096) * 128;
const PQ_C1 = 3424 / 4096;
const PQ_C2 = (2413 / 4096) * 32;
const PQ_C3 = (2392 / 4096) * 32;

/** Absolute luminance (nits) → PQ code value in [0,1]. Clamps to the PQ range. */
export function pqEncode(nits: number): number {
  const yn = Math.min(1, Math.max(0, nits / 10000));
  if (yn <= 0) return 0;
  const y = yn ** PQ_M1;
  return ((PQ_C1 + PQ_C2 * y) / (1 + PQ_C3 * y)) ** PQ_M2;
}

// ─── colour-space matrices ─────────────────────────────────────────────────────

// Linear Rec.709 (sRGB primaries) → linear Rec.2020, standard published
// coefficients. Applied in linear light, before absolute scaling.
type Row3 = readonly [number, number, number];
const M_709_TO_2020: readonly [Row3, Row3, Row3] = [
  [0.6274038959, 0.3292830384, 0.0433130657],
  [0.0690972894, 0.9195403951, 0.0113623156],
  [0.0163914389, 0.0880132309, 0.8955953302],
];

// Linear sRGB → OKLab (Ottosson's reference matrices — the same constants as
// engine/src/brand-derive.ts#linearSrgbToOklab, kept in sync so the mask's ΔE
// agrees with the engine's deltaEOk). OKLab: perceptual, so the colour-distance
// falloff below feathers naturally along anti-aliased edges.
function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// sRGB byte [0,255] → linear light [0,1], via a 256-entry LUT (the transform runs
// per channel per pixel; the LUT removes the pow from the hot loop).
const LINEAR_LUT = new Float64Array(256);
for (let i = 0; i < 256; i++) LINEAR_LUT[i] = srgbToLinear(i / 255);

// ─── options ────────────────────────────────────────────────────────────────

/** A brand colour whose matching pixels should glow, with resolved OKLab + gain. */
interface ResolvedTarget {
  lab: [number, number, number];
  /** Peak luminance multiplier for a fully-matched pixel of this colour. */
  gain: number;
}

export interface HdrBoostOptions {
  /**
   * Colours to boost, as sRGB hex (`#rgb`…`#rrggbbaa`). Brand-agnostic: the caller
   * passes the active brand's primary palette; the engine never derives them.
   */
  targets: readonly string[];
  /** SDR reference-white luminance in nits (ITU-R BT.2408 diffuse white). Default 203. */
  sdrWhiteNits?: number;
  /** Luminance a fully-matched, fully-light target reaches, in nits (the peak). Default 1000. */
  peakNits?: number;
  /** OKLab L below which a matched colour's boost drops to `boostFloor` (darks stay calm). Default 0.32. */
  kneeLo?: number;
  /** OKLab L above which a matched colour gets the full boost. Default 0.55. */
  kneeHi?: number;
  /** Boost fraction kept below `kneeLo` (0 = dark targets stay at SDR, so dark areas give the bright glow its contrast). Default 0. */
  boostFloor?: number;
  /**
   * Re-saturation applied to boosted pixels so a hard luminance lift keeps the
   * colour's richness instead of washing toward pastel (HDR highlight
   * desaturation). Scales with how hard the pixel is boosted. 0 = pure luminance
   * boost (brights read minty); ~0.3–0.7 keeps brand colours rich. White/greys
   * (no chroma) are unaffected. Default 0.4.
   */
  richness?: number;
  /** OKLab ΔE at/under which a pixel fully matches a target. Default 0.06. */
  innerRadius?: number;
  /** OKLab ΔE at which the match (and boost) reaches zero. Default 0.22. */
  outerRadius?: number;
  /** Also treat near-white pixels as a target so white text glows. Default true. */
  includeWhite?: boolean;
}

const DEFAULTS = {
  sdrWhiteNits: 203,
  peakNits: 1000,
  kneeLo: 0.32,
  kneeHi: 0.55,
  boostFloor: 0,
  richness: 0.4,
  innerRadius: 0.06,
  outerRadius: 0.22,
  includeWhite: true,
} as const;

// Hermite smoothstep, 0→1 as x crosses lo→hi (no banding).
function smoothstep(lo: number, hi: number, x: number): number {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  const t = (x - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
}

// Smooth 1→0 colour-match falloff between inner and outer OKLab ΔE.
function falloff(dE: number, inner: number, outer: number): number {
  return 1 - smoothstep(inner, outer, dE);
}

function resolveTargets(opts: HdrBoostOptions): ResolvedTarget[] {
  const sdrWhiteNits = opts.sdrWhiteNits ?? DEFAULTS.sdrWhiteNits;
  const peakNits = opts.peakNits ?? DEFAULTS.peakNits;
  const kneeLo = opts.kneeLo ?? DEFAULTS.kneeLo;
  const kneeHi = opts.kneeHi ?? DEFAULTS.kneeHi;
  const boostFloor = opts.boostFloor ?? DEFAULTS.boostFloor;
  const maxGain = Math.max(1, peakNits / sdrWhiteNits);

  const hexes = [...opts.targets];
  if (opts.includeWhite ?? DEFAULTS.includeWhite) hexes.push('#ffffff');

  const out: ResolvedTarget[] = [];
  for (const hex of hexes) {
    const rgb = parseHex(hex);
    if (!rgb) continue; // unparseable brand entry: skip rather than throw mid-export
    const lab = linearSrgbToOklab(LINEAR_LUT[rgb[0]]!, LINEAR_LUT[rgb[1]]!, LINEAR_LUT[rgb[2]]!);
    // Bright colours punch to peak; the boost rolls off below mid lightness so
    // dark primaries are calmed (kept dark to give the glow contrast), not blown out.
    const frac = boostFloor + (1 - boostFloor) * smoothstep(kneeLo, kneeHi, lab[0]);
    const gain = 1 + (maxGain - 1) * frac;
    out.push({ lab, gain });
  }
  return out;
}

// ─── the transform ────────────────────────────────────────────────────────────

/**
 * In-place transform of an 8-bit RGBA buffer (canvas `ImageData.data` order) into
 * Rec.2100-PQ code values, boosting pixels that match the brand targets. Alpha is
 * untouched. The result only renders as HDR when the container is tagged
 * Rec.2100-PQ (see HDR_PQ_CICP / color.ts#pqBt2020IccProfile) — see the module
 * header. Returns the same buffer for chaining.
 *
 * Cost is ~3 cbrt + 3 pow per pixel plus a short per-target loop — fine for an
 * export-time pass (not a per-frame path).
 */
export function hdrBoostToPQ<T extends Uint8Array | Uint8ClampedArray>(rgba: T, opts: HdrBoostOptions): T {
  const targets = resolveTargets(opts);
  const sdrWhiteNits = opts.sdrWhiteNits ?? DEFAULTS.sdrWhiteNits;
  const peakNits = opts.peakNits ?? DEFAULTS.peakNits;
  const richness = opts.richness ?? DEFAULTS.richness;
  const inner = opts.innerRadius ?? DEFAULTS.innerRadius;
  const outer = opts.outerRadius ?? DEFAULTS.outerRadius;
  const maxExtra = Math.max(1, peakNits / sdrWhiteNits) - 1; // extra at a full match
  const [m0, m1, m2] = M_709_TO_2020;

  for (let i = 0; i < rgba.length; i += 4) {
    let lr = LINEAR_LUT[rgba[i]!]!;
    let lg = LINEAR_LUT[rgba[i + 1]!]!;
    let lb = LINEAR_LUT[rgba[i + 2]!]!;

    // Strongest matching target sets the gain; 1 (no boost) when nothing matches.
    let extra = 0;
    if (targets.length) {
      const [pl, pa, pb] = linearSrgbToOklab(lr, lg, lb);
      for (const t of targets) {
        const dE = Math.hypot(pl - t.lab[0], pa - t.lab[1], pb - t.lab[2]);
        const contribution = (t.gain - 1) * falloff(dE, inner, outer);
        if (contribution > extra) extra = contribution;
      }
    }

    // Re-saturate in proportion to the boost so the lift keeps its richness
    // rather than washing toward pastel. Luminance-preserving (Rec.709 Y) and
    // hue-preserving; white/greys have no chroma so this is a no-op for them.
    if (richness > 0 && extra > 0 && maxExtra > 0) {
      const sat = 1 + richness * (extra / maxExtra);
      const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
      lr = Math.max(0, y + (lr - y) * sat);
      lg = Math.max(0, y + (lg - y) * sat);
      lb = Math.max(0, y + (lb - y) * sat);
    }

    const scale = (1 + extra) * sdrWhiteNits; // linear[0,1] × this = absolute nits

    // sRGB→2020 in linear light, then absolute-scale, then PQ-encode per channel.
    const r2 = (m0[0] * lr + m0[1] * lg + m0[2] * lb) * scale;
    const g2 = (m1[0] * lr + m1[1] * lg + m1[2] * lb) * scale;
    const b2 = (m2[0] * lr + m2[1] * lg + m2[2] * lb) * scale;

    rgba[i] = Math.round(pqEncode(r2) * 255);
    rgba[i + 1] = Math.round(pqEncode(g2) * 255);
    rgba[i + 2] = Math.round(pqEncode(b2) * 255);
    // rgba[i + 3] (alpha) preserved
  }
  return rgba;
}
