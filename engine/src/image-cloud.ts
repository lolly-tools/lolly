// SPDX-License-Identifier: MPL-2.0
/**
 * An image's colours as a point cloud in OKLCH, plus what the distribution says.
 *
 * The input is decoded RGBA — the shell owns the decoder, this owns the maths, the
 * same split as `audio-analyse.ts`. So the web shell and the CLI read identical
 * numbers off one file, and none of this needs a DOM to test.
 *
 * ## The honesty problem, and how it is handled
 *
 * RGBA bytes do not say which space they are in. An untagged JPEG is sRGB *by
 * convention*, not by fact, and a browser that drew a Display-P3 photo into an
 * sRGB canvas has already thrown the wide colours away before this function sees
 * a byte. So `space` is REQUIRED to be passed by the caller and is echoed back on
 * the result: every number here is "given these bytes are in that space", and a
 * caller that guessed has to say so in its own UI rather than having this module
 * quietly launder the guess into a fact.
 *
 * Getting it wrong is not subtle. The same bytes read as Display-P3 rather than
 * sRGB carry up to ~25% more chroma in the reds and greens, which moves every
 * gamut statistic below.
 *
 * ## Why buckets rather than pixels
 *
 * A 12-megapixel photo has at most ~16.7M distinct colours and usually far fewer,
 * but plotting even 100k points is pointless: past a few thousand the cloud is
 * solid and the extra work is invisible. Colours are quantised into a 32³ RGB
 * grid, counted, and the heaviest buckets returned — so the plot shows where the
 * image's mass actually is. `unique` is counted separately at FULL 8-bit
 * precision, because "how many colours are in this image" is a question about the
 * image, not about our grid.
 */

import { oklchGamut, inGamut } from './gamut.ts';
import { linearToSrgb, srgbToLinear, linearSrgbToOklab } from './brand-derive.ts';
import { linearP3ToLinearSrgb } from './gamut-source.ts';
import type { GamutName } from './gamut.ts';

/** Which space the RGBA bytes are encoded in. The two a canvas can produce. */
export type CloudSpace = 'srgb' | 'display-p3';

/** One bucket of the image's colour, as OKLCH plus how much of the image it is. */
export interface CloudPoint {
  l: number;
  c: number;
  h: number;
  /** Sampled pixels in this bucket. Relative to `sampled`, not to the image. */
  n: number;
  /** The bucket centre as an sRGB hex — for painting a point, never for reading a
   *  value back out of (it is gamut-mapped when the source space is wider). */
  hex: string;
}

export interface ImageCloud {
  /** Echoed back: every number below is conditional on this. */
  space: CloudSpace;
  points: CloudPoint[];
  /** Pixels actually looked at. Fewer than the image when `stride` > 1. */
  sampled: number;
  /** Fully transparent pixels, skipped. A PNG's padding is not its colour. */
  transparent: number;
  /** Distinct 8-bit RGB values among the sampled pixels, exact up to `UNIQUE_CAP`. */
  unique: number;
  /** True when `unique` hit the cap and is therefore a floor, not a count. */
  uniqueCapped: boolean;
  /** Share of sampled pixels (0–1) whose colour needs each gamut. Sums to ~1. */
  coverage: Record<Exclude<GamutName, 'none'> | 'none', number>;
  /**
   * Share of pixels sitting on a channel extreme (0 or 255).
   *
   * The tell for an image that has ALREADY been clipped — by an export, a phone's
   * processing, a previous gamut map. Those colours were somewhere else before,
   * and no amount of plotting recovers where.
   */
  clipped: number;
  /** Share within `nearEdge` of the source space's own boundary, so at risk from
   *  any further conversion. */
  atRisk: number;
  /** The busiest 30° hue sector, or null for an image with no chroma to speak of. */
  dominantHue: { h: number; share: number } | null;
  /** Mean chroma over sampled non-transparent pixels. */
  meanChroma: number;
}

export interface ImageCloudOpts {
  /** REQUIRED — see the honesty note above. */
  space: CloudSpace;
  /** Take every Nth pixel. Default picks a stride that samples ~200k pixels. */
  stride?: number;
  /** Most points to return, heaviest first. Default 3000. */
  maxPoints?: number;
  /** How close to the boundary counts as `atRisk`, in chroma. Default 0.02. */
  nearEdge?: number;
}

/** Past this many distinct colours, counting exactly costs more than it says. */
export const UNIQUE_CAP = 300_000;
/** Bits per channel in the quantisation grid: 5 → 32³ = 32,768 buckets. */
const GRID_BITS = 5;
const GRID = 1 << GRID_BITS;
const DEFAULT_SAMPLE_TARGET = 200_000;

/** Chroma below this is a grey as far as "which hue is this image" goes. */
const HUE_CHROMA_FLOOR = 0.02;

/**
 * Half an 8-bit code value at the top of the linear range, and the tolerance the
 * gamut classification is done at.
 *
 * The first draft of this feature printed "7.4% of this image is beyond sRGB"
 * about a test file with nothing beyond sRGB in it. The cause is worth writing
 * down, because the obvious fix is the wrong one.
 *
 * An sRGB colour carried through an 8-bit Display-P3 encoding comes back with its
 * linear channels a fraction OUTSIDE the unit cube — pure blue returned 1.003.
 * That is a rounding error of a third of a percent. But near the sRGB cusp the
 * chroma ceiling falls away steeply with lightness, so measured as chroma the
 * same error reads as 0.048 — eight times what an honest slop would be, and far
 * too large to absorb without also swallowing real out-of-gamut colours.
 *
 * So the tolerance goes where the error actually is: the CUBE. A channel within
 * half a code value of a rail is on the rail. Applied to classification only —
 * a point keeps its measured colour for the plot, because the error is invisible
 * there and snapping the plotted value would be inventing data.
 */
const LIN_SLOP = 1 - srgbToLinear(254 / 255);

export function imageColorCloud(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts: ImageCloudOpts,
): ImageCloud {
  const space = opts.space;
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  const total = w * h;
  const stride = opts.stride && opts.stride > 0
    ? Math.floor(opts.stride)
    : Math.max(1, Math.floor(total / DEFAULT_SAMPLE_TARGET));
  const maxPoints = opts.maxPoints && opts.maxPoints > 0 ? Math.floor(opts.maxPoints) : 3000;
  const nearEdge = opts.nearEdge ?? 0.02;

  const counts = new Map<number, number>();
  const uniq = new Set<number>();
  let sampled = 0, transparent = 0, clipped = 0;
  // Hue is BINNED into twelve 30° sectors rather than averaged. A mean of angles
  // is meaningless on a circle — 350° and 10° average to 180°, the opposite hue —
  // and the question ("which family of colour is this image") is answered by the
  // busiest sector anyway, which needs no circular statistics at all.
  const hueBins = new Float64Array(12);
  let chromaSum = 0, atRisk = 0;
  const cover = { srgb: 0, p3: 0, rec2020: 0, none: 0 };

  for (let i = 0; i < total; i += stride) {
    const o = i * 4;
    const a = data[o + 3] ?? 255;
    if (a === 0) { transparent++; continue; }
    const r = data[o] ?? 0, g = data[o + 1] ?? 0, b = data[o + 2] ?? 0;
    sampled++;
    if (uniq.size < UNIQUE_CAP) uniq.add((r << 16) | (g << 8) | b);
    if (r === 0 || r === 255 || g === 0 || g === 255 || b === 0 || b === 255) clipped++;

    const key = ((r >> (8 - GRID_BITS)) << (GRID_BITS * 2))
      | ((g >> (8 - GRID_BITS)) << GRID_BITS)
      | (b >> (8 - GRID_BITS));
    counts.set(key, (counts.get(key) ?? 0) + 1);

    const { l, c, hue, lin } = toOklch(r, g, b, space);
    chromaSum += c;
    if (c >= HUE_CHROMA_FLOOR) hueBins[Math.floor((((hue % 360) + 360) % 360) / 30)]! += 1;
    // Classified at the sample's own precision — see LIN_SLOP. A colour is only
    // "beyond sRGB" if it is beyond it by more than the 8 bits could have got
    // wrong on the way in.
    const snapped = snapToCube(lin);
    cover[snapped ? oklchOf(snapped).gamut : oklchGamut(l, c, hue)] += 1;
    // "At risk" is measured against the space the bytes are IN — the next
    // conversion is the one out of it. Measuring against sRGB for P3 bytes would
    // report most of a vivid photo as at risk, which is true of a conversion
    // nobody asked for.
    const own = space === 'display-p3' ? 'p3' : 'srgb';
    if (inGamut(l, c, hue, own) && !inGamut(l, c + nearEdge, hue, own)) atRisk++;
  }

  const points: CloudPoint[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPoints)
    .map(([key, n]) => {
      // The bucket's CENTRE, not its corner: a corner biases every point of the
      // cloud toward black by half a bucket, which is visible on a dark image.
      const step = 256 / GRID;
      const half = step / 2;
      const r = Math.min(255, Math.round(((key >> (GRID_BITS * 2)) & (GRID - 1)) * step + half));
      const g = Math.min(255, Math.round(((key >> GRID_BITS) & (GRID - 1)) * step + half));
      const b = Math.min(255, Math.round((key & (GRID - 1)) * step + half));
      const { l, c, hue } = toOklch(r, g, b, space);
      return { l, c, h: hue, n, hex: hexOf(r, g, b, space) };
    });

  let dominantHue: ImageCloud['dominantHue'] = null;
  let bestBin = -1, bestN = 0;
  for (let i = 0; i < hueBins.length; i++) {
    if (hueBins[i]! > bestN) { bestN = hueBins[i]!; bestBin = i; }
  }
  if (bestBin >= 0 && bestN > 0) {
    dominantHue = { h: bestBin * 30 + 15, share: bestN / Math.max(1, sampled) };
  }

  const per = (n: number): number => (sampled ? n / sampled : 0);
  return {
    space,
    points,
    sampled,
    transparent,
    unique: uniq.size,
    uniqueCapped: uniq.size >= UNIQUE_CAP,
    coverage: {
      srgb: per(cover.srgb), p3: per(cover.p3),
      rec2020: per(cover.rec2020), none: per(cover.none),
    },
    clipped: per(clipped),
    atRisk: per(atRisk),
    dominantHue,
    meanChroma: sampled ? chromaSum / sampled : 0,
  };
}

/**
 * A linear sRGB triple with any channel within {@link LIN_SLOP} of a rail pulled
 * onto it, or null when nothing needed moving (the overwhelmingly common case,
 * and worth short-circuiting: this runs per sampled pixel).
 */
function snapToCube(lin: [number, number, number]): [number, number, number] | null {
  let hit = false;
  const out: [number, number, number] = [lin[0], lin[1], lin[2]];
  for (let i = 0; i < 3; i++) {
    const v = out[i]!;
    if (v > 1 && v <= 1 + LIN_SLOP) { out[i] = 1; hit = true; }
    else if (v < 0 && v >= -LIN_SLOP) { out[i] = 0; hit = true; }
  }
  return hit ? out : null;
}

/** Linear sRGB → the gamut it needs. */
function oklchOf(lin: [number, number, number]): { gamut: GamutName } {
  const [l, A, B] = linearSrgbToOklab(lin[0], lin[1], lin[2]);
  const c = Math.hypot(A, B);
  const hue = c < 1e-9 ? 0 : (((Math.atan2(B, A) * 180) / Math.PI) + 360) % 360;
  return { gamut: oklchGamut(l, c, hue) };
}

/** 8-bit channels in `space` → OKLCH, with the linear sRGB it came through. */
function toOklch(r: number, g: number, b: number, space: CloudSpace):
{ l: number; c: number; hue: number; lin: [number, number, number] } {
  let lr = srgbToLinear(r / 255), lg = srgbToLinear(g / 255), lb = srgbToLinear(b / 255);
  // Display-P3 shares sRGB's transfer curve, so only the primaries differ — the
  // decode above is right for both and only this rotation is conditional.
  if (space === 'display-p3') [lr, lg, lb] = linearP3ToLinearSrgb(lr, lg, lb);
  const [l, A, B] = linearSrgbToOklab(lr, lg, lb);
  const c = Math.hypot(A, B);
  const hue = c < 1e-9 ? 0 : (((Math.atan2(B, A) * 180) / Math.PI) + 360) % 360;
  return { l, c, hue, lin: [lr, lg, lb] };
}

/** A point's paint colour, gamut-mapped into sRGB when the source is wider. */
function hexOf(r: number, g: number, b: number, space: CloudSpace): string {
  if (space === 'srgb') return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  const [lr, lg, lb] = linearP3ToLinearSrgb(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  const ch = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255).toString(16).padStart(2, '0');
  return `#${ch(lr)}${ch(lg)}${ch(lb)}`;
}
