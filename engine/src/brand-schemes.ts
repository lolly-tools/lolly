// SPDX-License-Identifier: MPL-2.0
/**
 * Brand scheme accents — a pure, deterministic accent-colour generator for the
 * Lolly brand generator's harmony picker.
 *
 * Given a brand's primary colour it produces the ACCENT members of a classic
 * colour-harmony scheme (complement, adjacent, triad, tetrad, plus the "free"
 * variants the picker offers). Every accent holds the primary's OKLCH lightness
 * and chroma and only rotates the hue — so the accents read as siblings of the
 * brand colour, never louder or quieter than it — then is emitted through
 * brand-derive's gamut-mapped `oklchToHex`, so the returned `hex` is always a
 * real sRGB colour (out-of-gamut requests degrade to the nearest same-hue,
 * same-lightness colour rather than clipping channels).
 *
 * Pure: no Date, no Math.random, no IO — same input, byte-identical output. The
 * OKLCH conversion math lives in brand-derive.ts (the engine's single source of
 * truth); this module only decides which hue rotations each scheme applies.
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
 *  the normalised hue (degrees, [0,360)) — the same as `oklch.h`, surfaced for
 *  callers that sort/group swatches by hue without re-reading the OKLCH. */
export interface AccentCandidate {
  hex: string;
  oklch: Oklch;
  hue: number;
}

// ─── Scheme table ─────────────────────────────────────────────────────────────

// Hue rotations (degrees) from the primary hue for each scheme's ACCENTS — the
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

// A neutral mid-blue OKLCH — the fallback primary when the input hex won't parse,
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
