// SPDX-License-Identifier: MPL-2.0
/**
 * Brand scheme accents. A pure, deterministic accent-colour generator for the
 * Lolly brand generator's harmony picker.
 *
 * Given a brand's primary colour, this produces the ACCENT members of a
 * classic colour-harmony scheme (complement, adjacent, triad, tetrad, plus the
 * "free" variants the picker offers). Every accent keeps the primary's OKLCH
 * lightness and chroma and rotates only the hue, so each accent matches the
 * brand colour's intensity exactly, not brighter or duller. Each accent is
 * then emitted through brand-derive's gamut-mapped `oklchToHex`, so the
 * returned `hex` is always a real sRGB colour (an out-of-gamut request
 * degrades to the nearest same-hue, same-lightness colour rather than
 * clipping channels).
 *
 * Pure: no Date, no Math.random, no IO. Same input always gives byte-identical
 * output. The OKLCH conversion math lives in brand-derive.ts (the engine's
 * single source of truth); this module only decides which hue rotations each
 * scheme applies.
 */

import { hexToOklch, oklchToHex } from './brand-derive.ts';
import type { Oklch } from './brand-derive.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The harmony schemes the brand generator offers. `count` is the TOTAL colour
 *  count (primary included); the accents returned are `count - 1`. */
export type SchemeKind =
  | 'complement'
  | 'adjacent-3'
  | 'triad-3'
  | 'tetrad-4'
  | 'free-2'
  | 'free-3'
  | 'free-4';

/** One generated accent: its final sRGB hex, the OKLCH it was emitted from, and
 *  the normalised hue (degrees, [0,360)) - the same as `oklch.h`, surfaced for
 *  callers that sort/group swatches by hue without re-reading the OKLCH. */
export interface AccentCandidate {
  hex: string;
  oklch: Oklch;
  hue: number;
}

// ─── Scheme table ─────────────────────────────────────────────────────────────

// Hue rotations (degrees) from the primary hue for each scheme's ACCENTS - the
// primary itself is never listed here (it's the 0° member, returned by neither).
// So `rotations.length === count - 1` for every scheme.
const SCHEME_ROTATIONS: Record<SchemeKind, readonly number[]> = {
  complement: [180],
  'adjacent-3': [-30, 30],
  'triad-3': [120, 240],
  'tetrad-4': [90, 180, 270],
  'free-2': [180],
  'free-3': [120, 240],
  'free-4': [90, 180, 270],
};

/** The schemes in picker order, each with a human label and its TOTAL colour
 *  count (primary + accents). Consumers render this list; they never hardcode
 *  the set. */
export const SCHEME_KINDS: ReadonlyArray<{ id: SchemeKind; label: string; count: number }> = [
  { id: 'complement', label: 'Complementary', count: 2 },
  { id: 'adjacent-3', label: 'Adjacent', count: 3 },
  { id: 'triad-3', label: 'Triad', count: 3 },
  { id: 'tetrad-4', label: 'Tetrad', count: 4 },
  { id: 'free-2', label: 'Free (2)', count: 2 },
  { id: 'free-3', label: 'Free (3)', count: 3 },
  { id: 'free-4', label: 'Free (4)', count: 4 },
];

// A neutral mid-blue OKLCH - the fallback primary when the input hex won't parse,
// so the generator always yields a usable set instead of throwing.
const FALLBACK_PRIMARY: Oklch = { l: 0.62, c: 0.11, h: 250 };

const normHue = (h: number): number => ((h % 360) + 360) % 360;

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generate the ACCENT colours (primary EXCLUDED) for `scheme`, seeded from
 * `primaryHex`. Each accent keeps the primary's L and C and rotates only the
 * hue by the scheme's offsets, normalised to [0,360), then is emitted through
 * `oklchToHex` (gamut-safe). Returns `SCHEME_KINDS.count - 1` candidates.
 *
 * An unparseable `primaryHex` falls back to a neutral mid-blue primary rather
 * than throwing, so the picker always has something to show.
 */
export function generateSchemeAccents(primaryHex: string, scheme: SchemeKind): AccentCandidate[] {
  const primary = hexToOklch(primaryHex) ?? FALLBACK_PRIMARY;
  const rotations = SCHEME_ROTATIONS[scheme] ?? [];
  return rotations.map(delta => {
    const hue = normHue(primary.h + delta);
    const oklch: Oklch = { l: primary.l, c: primary.c, h: hue };
    return { hex: oklchToHex(oklch), oklch, hue };
  });
}

// ─── Parametric hue rotation ────────────────────────────────────────────────

/**
 * Rotate an OKLCH colour's hue by `degrees` while HOLDING its lightness and
 * chroma fixed, then emit through `oklchToHex`, the same gamut-mapped path
 * `generateSchemeAccents` uses. Keeping L and C untouched (instead of
 * pre-clipping chroma to the new hue's ceiling) keeps saturated colours near
 * full strength at the sRGB corners. The emitted hex degrades only where the
 * hue genuinely cannot carry the chroma, via CSS Color 4 gamut mapping, never
 * a flat channel clip.
 *
 * Pure. An unparseable `hex` falls back to the neutral mid-blue primary. The
 * degrees are taken mod 360 (via `normHue`), so a 0° or ±360° rotation is a
 * true identity (hexToOklch → oklchToHex is bit-perfect for an in-gamut colour).
 */
export function rotateHue(hex: string, degrees: number): string {
  return oklchToHex(rotateOklchHue(hexToOklch(hex) ?? FALLBACK_PRIMARY, degrees));
}

/** The fixed-L, fixed-C hue rotation, as an OKLCH (shared by rotateHue, the
 *  parametric analogous generator, and rotateRampHue). Chroma is left intact;
 *  `oklchToHex` performs the gamut mapping at emit time, matching
 *  `generateSchemeAccents`. */
function rotateOklchHue(o: Oklch, degrees: number): Oklch {
  return { l: o.l, c: o.c, h: normHue(o.h + degrees) };
}

/** Params for {@link generateAnalogous}: how many accents, and the hue step
 *  between each (degrees). */
export interface AnalogousParams {
  /** Number of ACCENTS to produce (primary excluded). Clamped to ≥ 0. */
  count: number;
  /** Hue step in degrees between consecutive accents (and from the primary to
   *  the first). Typically small (analogous ⇒ neighbours on the wheel). */
  angle: number;
}

/**
 * A TRUE parametric analogous generator - distinct from the fixed `adjacent-3`
 * scheme (which is hardwired to ±30°). Produces `count` accents at evenly
 * spaced hues: primary + angle, primary + 2·angle, … primary + count·angle,
 * each holding the primary's L and C (gamut-mapped at emit time by
 * `oklchToHex`). So consecutive accent hues always differ by exactly `angle`
 * (mod 360).
 *
 * An unparseable `primaryHex` falls back to the neutral mid-blue primary.
 */
export function generateAnalogous(primaryHex: string, params: AnalogousParams): AccentCandidate[] {
  const primary = hexToOklch(primaryHex) ?? FALLBACK_PRIMARY;
  const count = Math.max(0, Math.floor(params.count));
  const out: AccentCandidate[] = [];
  for (let i = 1; i <= count; i++) {
    const oklch = rotateOklchHue(primary, params.angle * i);
    out.push({ hex: oklchToHex(oklch), oklch, hue: oklch.h });
  }
  return out;
}

/**
 * Apply the same fixed-L, gamut-clipped-C hue rotation across a whole ramp's
 * stops. Rotating every stop by the SAME `degrees` moves the whole ramp around
 * the hue wheel without changing its lightness/chroma structure. Returns a new
 * hex array; unparseable stops fall back to the neutral primary.
 */
export function rotateRampHue(stops: readonly string[], degrees: number): string[] {
  return stops.map(stop => rotateHue(stop, degrees));
}
