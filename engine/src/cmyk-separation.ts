// SPDX-License-Identifier: MPL-2.0
/**
 * RGB to CMYK through a press profile: the separation a print export writes.
 *
 * `rgbToCmyk` in color.ts is the device formula (K = 1 - max(r, g, b), no
 * profile). It ignores dot gain and the press's own black, so a mid grey prints
 * about 13 L* lighter than designed on FOGRA39 and a saturated colour's ink
 * build has nothing to do with the condition the file declares. This module
 * builds a separation from a CMYK output profile instead, using the engine's
 * own ICC reader (icc.ts), and keeps the two print conventions the formula
 * gave for free:
 *
 *   - Exact neutrals (r = g = b) separate to K only. Black type and fine rules
 *     stay on one plate, so they cannot misregister, and the black-overprint
 *     rule in the PDF writer (C = M = Y = 0, K at or above 0.99) still fires.
 *     The K value is tone matched through the profile's K-only ramp, so a grey
 *     prints at the lightness it was designed at, not at 1 - v.
 *   - Everything else converts relative colorimetric with black point
 *     compensation (Adobe's BPC, as littleCMS implements it): sRGB black maps
 *     to the press's darkest neutral rather than clipping, so dark colours keep
 *     their separation. Colours inside the press gamut keep their Lab values;
 *     colours outside it take the profile's own clipping.
 *
 * The neutral rule applies BPC against the K-only black (the darkest single-ink
 * grey) and the chromatic rule against the rich black (the darkest four-ink
 * neutral the profile builds). Both map sRGB white to paper (0, 0, 0, 0) and
 * sRGB black to the darkest ink the rule may use.
 *
 * Results are memoised per input triple (bounded) because the PDF and EPS
 * writers convert the same few colours many times. A raster export uses
 * {@link separationLattice}: a 33-per-axis table over encoded sRGB, evaluated
 * by tetrahedral interpolation, so a print-size sheet costs four table reads
 * and a few multiplies per pixel. Exact neutrals lie on the lattice diagonal,
 * which tetrahedral interpolation reads alone, so they stay K only.
 *
 * Pure: no DOM, no IO, no clock. The profile is the caller's; this module never
 * fetches or chooses one.
 */

import type { IccProfile } from './icc.ts';
import { iccResolvedIntent } from './icc-pixels.ts';
import { convertColor, type CssColor } from './css-color.ts';
import { rgbToCmyk, type Cmyk } from './color.ts';

/** sRGB (encoded, each 0-1) to device CMYK (each 0-1). */
export type SeparateRgb = (r: number, g: number, b: number) => Cmyk;

/** How a print export turns RGB into ink. */
export interface CmykSeparation {
  /** Convert one colour. Pure and deterministic for a given separation. */
  readonly separate: SeparateRgb;
  /** `icc` when a press profile drives the conversion, `device` for the formula. */
  readonly method: 'icc' | 'device';
  /** The profile's description, or null for the device formula. */
  readonly profile: string | null;
  /** L* of the darkest K-only grey and of the rich black, for a profile separation; null for the formula. */
  readonly blackPoints: { readonly kOnly: number; readonly rich: number } | null;
}

/** The device formula, wrapped so a caller can hold one type for both routes. */
export const DEVICE_SEPARATION: CmykSeparation = Object.freeze({
  separate: rgbToCmyk,
  method: 'device' as const,
  profile: null,
  blackPoints: null,
});

/** Channels within this of each other are treated as one neutral grey. Half an
 *  8-bit step: a hex grey is exact, an 8-bit tint off by one step is not. */
export const NEUTRAL_EPSILON = 0.5 / 255;

// The K-only ramp is sampled at this many steps and inverted by interpolation.
const RAMP_STEPS = 1024;
// The memo holds at most this many colours before it starts over.
const MEMO_LIMIT = 65536;
// lcms clamps a detected black point to L* 50: anything lighter is not a black.
const MAX_BLACK_L = 50;

const srgb = (r: number, g: number, b: number): CssColor =>
  ({ space: 'srgb', components: [r, g, b], alpha: 1, missing: 0 });
const xyz50 = (x: number, y: number, z: number): CssColor =>
  ({ space: 'xyz-d50', components: [x, y, z], alpha: 1, missing: 0 });

/** CIE Y (white = 1) of a neutral at lightness L*. */
function lightnessToY(L: number): number {
  return convertColor({ space: 'lab', components: [L, 0, 0], alpha: 1, missing: 0 }, 'xyz-d50').components[1];
}

/** D50 white in the same XYZ scale convertColor uses (Y = 1). */
const WHITE_D50 = convertColor(srgb(1, 1, 1), 'xyz-d50').components;

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);

/**
 * A separation driven by a CMYK output profile, or null when the profile cannot
 * drive one (not four-channel CMYK, no usable table in either direction, or a
 * black point that makes no sense). A null answer means "use the device
 * formula and report that", never "guess".
 */
export function iccSeparation(profile: IccProfile): CmykSeparation | null {
  try {
    if (profile?.dataColourSpace !== 'CMYK' || profile.nChannels !== 4) return null;
    const into = iccResolvedIntent(profile, 'fromPcs', 'relative');
    const back = iccResolvedIntent(profile, 'toPcs', 'relative');
    if (!into || !back) return null;
    const toLab = (c: readonly number[]): number | null => profile.toLab(back, c)?.[0] ?? null;

    // Rich black: the darkest neutral the B2A table builds, read back through A2B.
    const richBuild = profile.fromLab(into, [0, 0, 0]);
    const richL = richBuild ? toLab(richBuild) : null;
    // K-only ramp: lightness of 0..100 % K alone, sampled and forced monotone
    // (a running minimum) so the inversion below is well defined on any table.
    const ramp = new Float64Array(RAMP_STEPS + 1);
    for (let i = 0; i <= RAMP_STEPS; i++) {
      const L = toLab([0, 0, 0, i / RAMP_STEPS]);
      if (L === null || !Number.isFinite(L)) return null;
      ramp[i] = i === 0 ? L : Math.min(L, ramp[i - 1]!);
    }
    const kOnlyL = ramp[RAMP_STEPS]!;
    if (richL === null || !Number.isFinite(richL)) return null;
    if (!(kOnlyL < ramp[0]!) || kOnlyL > MAX_BLACK_L) return null;
    const rich = Math.max(0, Math.min(richL, MAX_BLACK_L));

    const yKOnly = lightnessToY(kOnlyL);
    const yRich = lightnessToY(rich);
    const paperL = ramp[0]!;

    /** K that prints a neutral at lightness L (0 at or above paper, 1 at or below the K-only black). */
    const kFor = (L: number): number => {
      if (L >= paperL) return 0;
      if (L <= kOnlyL) return 1;
      let lo = 0, hi = RAMP_STEPS;   // ramp[lo] > L >= ramp[hi]
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ramp[mid]! > L) lo = mid; else hi = mid;
      }
      const a = ramp[lo]!, b = ramp[hi]!;
      const t = a === b ? 0 : (a - L) / (a - b);
      return (lo + t) / RAMP_STEPS;
    };

    const neutral = (v: number): Cmyk => {
      if (v >= 1) return [0, 0, 0, 0];
      if (v <= 0) return [0, 0, 0, 1];
      // BPC on the K-only axis: Y' = Y (1 - Yk) + Yk, then back to L*.
      const y = convertColor(srgb(v, v, v), 'xyz-d50').components[1] / WHITE_D50[1];
      const yMapped = y * (1 - yKOnly) + yKOnly;
      const L = convertColor(xyz50(WHITE_D50[0] * yMapped, WHITE_D50[1] * yMapped, WHITE_D50[2] * yMapped), 'lab').components[0];
      return [0, 0, 0, clamp01(kFor(L))];
    };

    const chromatic = (r: number, g: number, b: number): Cmyk => {
      // BPC in XYZ against a neutral black point: X' = X (1 - Ybp) + Ybp Xw, per channel.
      const [x, y, z] = convertColor(srgb(r, g, b), 'xyz-d50').components;
      const s = 1 - yRich;
      const mapped = xyz50(x * s + yRich * WHITE_D50[0], y * s + yRich * WHITE_D50[1], z * s + yRich * WHITE_D50[2]);
      const [L, A, B] = convertColor(mapped, 'lab').components;
      const ink = profile.fromLab(into, [L, A, B]);
      if (ink?.length !== 4 || !ink.every(Number.isFinite)) return rgbToCmyk(r, g, b);
      return [clamp01(ink[0]!), clamp01(ink[1]!), clamp01(ink[2]!), clamp01(ink[3]!)];
    };

    const memo = new Map<string, Cmyk>();
    const separate: SeparateRgb = (r, g, b) => {
      const R = clamp01(r), G = clamp01(g), B = clamp01(b);
      const key = R + ',' + G + ',' + B;
      const hit = memo.get(key);
      if (hit) return [hit[0], hit[1], hit[2], hit[3]];
      const max = Math.max(R, G, B), min = Math.min(R, G, B);
      const out = max - min <= NEUTRAL_EPSILON ? neutral((R + G + B) / 3) : chromatic(R, G, B);
      if (memo.size >= MEMO_LIMIT) memo.clear();
      memo.set(key, out);
      return [out[0], out[1], out[2], out[3]];
    };

    return Object.freeze({
      separate,
      method: 'icc' as const,
      profile: profile.description || null,
      blackPoints: Object.freeze({ kOnly: kOnlyL, rich }),
    });
  } catch {
    return null;
  }
}

/**
 * A raster evaluator for `sep`: 8-bit sRGB in, 8-bit CMYK out (0 = no ink,
 * 255 = full ink), written into `out` at `at`. The device formula is evaluated
 * directly, as before; a profile separation reads a `size`-per-axis lattice by
 * tetrahedral interpolation (Sakamoto's six-tetrahedron split, as littleCMS and
 * icc-pixels.ts use).
 */
export function separationLattice(
  sep: CmykSeparation,
  size = 33,
): (r8: number, g8: number, b8: number, out: Uint8Array, at: number) => void {
  if (sep.method === 'device') {
    return (r8, g8, b8, out, at) => {
      const [c, m, y, k] = sep.separate(r8 / 255, g8 / 255, b8 / 255);
      out[at] = (c * 255 + 0.5) | 0;
      out[at + 1] = (m * 255 + 0.5) | 0;
      out[at + 2] = (y * 255 + 0.5) | 0;
      out[at + 3] = (k * 255 + 0.5) | 0;
    };
  }
  const n = Math.max(2, Math.min(65, Math.floor(size)));
  const last = n - 1;
  const table = new Float32Array(n * n * n * 4);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        const ink = sep.separate(i / last, j / last, k / last);
        table.set(ink, ((i * n + j) * n + k) * 4);
      }
    }
  }
  const sI = n * n * 4, sJ = n * 4, sK = 4;
  return (r8, g8, b8, out, at) => {
    const fr = (r8 / 255) * last, fg = (g8 / 255) * last, fb = (b8 / 255) * last;
    const i = Math.min(last - 1, fr | 0), j = Math.min(last - 1, fg | 0), k = Math.min(last - 1, fb | 0);
    const dr = fr - i, dg = fg - j, db = fb - k;
    const c0 = i * sI + j * sJ + k * sK;
    // The two corners of every tetrahedron are c000 and c111; the other two
    // follow the order of the fractional parts.
    let a: number, b: number, wa: number, wb: number;
    const w0 = 1 - Math.max(dr, dg, db), w3 = Math.min(dr, dg, db);
    if (dr >= dg) {
      if (dg >= db) { a = c0 + sI; b = c0 + sI + sJ; wa = dr - dg; wb = dg - db; }
      else if (dr >= db) { a = c0 + sI; b = c0 + sI + sK; wa = dr - db; wb = db - dg; }
      else { a = c0 + sK; b = c0 + sI + sK; wa = db - dr; wb = dr - dg; }
    } else {
      if (dr >= db) { a = c0 + sJ; b = c0 + sI + sJ; wa = dg - dr; wb = dr - db; }
      else if (dg >= db) { a = c0 + sJ; b = c0 + sJ + sK; wa = dg - db; wb = db - dr; }
      else { a = c0 + sK; b = c0 + sJ + sK; wa = db - dg; wb = dg - dr; }
    }
    const c1 = c0 + sI + sJ + sK;
    for (let ch = 0; ch < 4; ch++) {
      const v = w0 * table[c0 + ch]! + wa * table[a + ch]! + wb * table[b + ch]! + w3 * table[c1 + ch]!;
      out[at + ch] = (clamp01(v) * 255 + 0.5) | 0;
    }
  };
}
