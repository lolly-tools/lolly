// SPDX-License-Identifier: MPL-2.0
/**
 * Global brand color palette.
 * Every color-picker input in the platform shows these swatches.
 * Edit this file to change the swatches everywhere at once.
 *
 * These are the neutral STARTER system's resolved light-theme values
 * (plans/archive/brand-token-contract.md section 4/section 5), gamut-mapped OKLCH → sRGB hex:
 *   - Primary ramp: hue 250, nine steps 1 (darkest) → 9 (lightest), chroma a
 *     bell over L anchored at the starter primary oklch(60% 0.10 250) (step 5).
 *   - Neutral ramp: the same hue at C ≤ 0.02 - greys tinted toward the primary.
 *   - Spectrum: the six fixed infographic hues (blue 250, teal 190, violet 300,
 *     amber 75, rose 355, green 145), each nudged ±8° toward the primary hue,
 *     at C ~0.12 / L ~0.65.
 * Deliberately unbranded: this file is only the offline/tokenless fallback - 
 * the picker sources swatches from host.tokens first, so a real brand replaces
 * these by installing its own tokens (bridge/tokens.ts installUserTokens).
 *
 * cmyk: [C, M, Y, K] as integer percentages 0–100.
 * null = not yet specified; export falls back to generic RGB→CMYK conversion.
 * spot: a named spot/Pantone lock, when the brand editor's swatch is locked to
 * one. Independent of `cmyk` - a swatch may carry either, both, or neither;
 * `cmyk` is the process-colour fallback used for preview/non-PDF export/the PDF
 * Separation tint-transform's alternate space whether or not a spot is set too.
 * group: optional bucket override for the Platform view's grouping - 
 *   'spectrum'   = the secondary / infographics palette (NOT a brand colour);
 *   a family name (e.g. 'Neutral') pins the swatch into that tint ramp.
 *   Omit for brand colours; numbered labels ("Primary 5") auto-group by family.
 */
import type { SpotColor } from '@lolly-tools/core/host-v1';

export interface PaletteEntry {
  hex: string;
  label: string;
  /** [C, M, Y, K] integer percentages 0-100; null → generic RGB→CMYK fallback. */
  cmyk: readonly [number, number, number, number] | null;
  /** Named spot/Pantone lock, when present - independent of `cmyk` (see above). A
   *  tactile finish (foil, emboss, varnish) rides the same lock as `finish`. */
  spot?: SpotColor | null;
  /** Platform-view grouping override ('spectrum' or a tint-ramp family name). */
  group?: string;
  /** The design token this swatch came from, when it came from one. Absent on the
   *  starter fallback below; the Assets swatch details sheet reads this field. */
  token?: PaletteToken;
}

/** What a resolved colour token knows beyond the hex the palette paints with. */
export interface PaletteToken {
  /** Canonical reference, e.g. '{color.brand.jungle}'. */
  ref: string;
  /** The DTCG path, e.g. 'color.brand.jungle'. */
  path: string;
  /** The colour as authored, before the sRGB fallback - may be wider than `hex`. */
  css?: string;
  description?: string;
  /** Per-target values the brand authored (a CSS space, or `icc:<digest>:<intent>`). */
  faces?: Record<string, string | number[]>;
}

export const PALETTE: readonly PaletteEntry[] = [
  { hex: 'transparent', label: 'Transparent', cmyk: null },

  // Brand anchors - the starter primary (its ramp's step 5) plus true black &
  // white, the only entries with measured ink (pure K / no ink); everything
  // else falls back to the generic RGB→CMYK conversion by design.
  { hex: '#4f84ba', label: 'Primary',    cmyk: null },
  { hex: '#ffffff', label: 'White',      cmyk: [0, 0, 0, 0] },
  { hex: '#000000', label: 'Black',      cmyk: [0, 0, 0, 100] },

  // Primary ramp - hue 250, 1 darkest → 9 lightest.
  { hex: '#001226', label: 'Primary 1',  cmyk: null },
  { hex: '#082a49', label: 'Primary 2',  cmyk: null },
  { hex: '#19446d', label: 'Primary 3',  cmyk: null },
  { hex: '#336699', label: 'Primary 4',  cmyk: null },
  { hex: '#4f84ba', label: 'Primary 5',  cmyk: null },
  { hex: '#80afe1', label: 'Primary 6',  cmyk: null },
  { hex: '#a9cff6', label: 'Primary 7',  cmyk: null },
  { hex: '#d1e7ff', label: 'Primary 8',  cmyk: null },
  { hex: '#eef6ff', label: 'Primary 9',  cmyk: null },

  // Neutral ramp - the primary hue at low chroma (C ≤ 0.02), so the greys read
  // as part of the same system. Black & White bookend it as its true end-points
  // (both also live in the brand block above), so Neutral 1 / Neutral 9 aren't
  // misread as pure black/white.
  { hex: '#000000', label: 'Black',      cmyk: [0, 0, 0, 100], group: 'Neutral' },
  { hex: '#0e1217', label: 'Neutral 1',  cmyk: null },
  { hex: '#242a30', label: 'Neutral 2',  cmyk: null },
  { hex: '#3c434b', label: 'Neutral 3',  cmyk: null },
  { hex: '#5c646d', label: 'Neutral 4',  cmyk: null },
  { hex: '#7e8791', label: 'Neutral 5',  cmyk: null },
  { hex: '#a3acb5', label: 'Neutral 6',  cmyk: null },
  { hex: '#c5cbd2', label: 'Neutral 7',  cmyk: null },
  { hex: '#e1e5ea', label: 'Neutral 8',  cmyk: null },
  { hex: '#f3f5f8', label: 'Neutral 9',  cmyk: null },
  { hex: '#ffffff', label: 'White',      cmyk: [0, 0, 0, 0], group: 'Neutral' },

  // Spectrum - the secondary / infographics palette. NOT brand colours: it
  // expands the colour wheel for charts & data viz without replacing them.
  { hex: '#5194d5', label: 'Blue',       cmyk: null, group: 'spectrum' },
  { hex: '#00a3a7', label: 'Teal',       cmyk: null, group: 'spectrum' },
  { hex: '#9181d2', label: 'Violet',     cmyk: null, group: 'spectrum' },
  { hex: '#b28727', label: 'Amber',      cmyk: null, group: 'spectrum' },
  { hex: '#c36f9d', label: 'Rose',       cmyk: null, group: 'spectrum' },
  { hex: '#4da46b', label: 'Green',      cmyk: null, group: 'spectrum' },
];
