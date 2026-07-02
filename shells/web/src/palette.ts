// SPDX-License-Identifier: MPL-2.0
/**
 * Global brand color palette.
 * Every color-picker input in the platform shows these swatches.
 * Edit this file to change the swatches everywhere at once.
 *
 * cmyk: [C, M, Y, K] as integer percentages 0–100.
 * null = not yet specified; export falls back to generic RGB→CMYK conversion.
 * group: optional bucket override for the Platform view's grouping —
 *   'spectrum'   = the secondary / infographics palette (NOT a brand colour);
 *   a family name (e.g. 'Fog') pins the swatch into that tint ramp.
 *   Omit for brand colours; numbered labels ("Jungle 1") auto-group by family.
 */
export interface PaletteEntry {
  hex: string;
  label: string;
  /** [C, M, Y, K] integer percentages 0-100; null → generic RGB→CMYK fallback. */
  cmyk: readonly [number, number, number, number] | null;
  /** Platform-view grouping override ('spectrum' or a tint-ramp family name). */
  group?: string;
}

export const PALETTE: readonly PaletteEntry[] = [
  { hex: 'transparent', label: 'Transparent', cmyk: null },

  // Brand colours — the primary SUSE palette. Black & White are brand neutrals.
  { hex: '#0c322c', label: 'Pine',       cmyk: [65, 0, 35, 85] },
  { hex: '#30ba78', label: 'Jungle',     cmyk: [70, 0, 65, 0] },
  { hex: '#90ebcd', label: 'Mint',       cmyk: [40, 0, 30, 0] },
  { hex: '#fe7c3f', label: 'Persimmon',  cmyk: [0, 60, 80, 0] },
  { hex: '#192072', label: 'Midnight',   cmyk: [100, 85, 0, 30] },
  { hex: '#2453ff', label: 'Waterhole',  cmyk: [90, 50, 0, 0] },
  { hex: '#efefef', label: 'Fog',        cmyk: [0, 0, 0, 7] },
  { hex: '#ffffff', label: 'White',      cmyk: [0, 0, 0, 0] },
  { hex: '#000000', label: 'Black',      cmyk: [0, 0, 0, 100] },

  { hex: '#0c322c', label: 'Jungle 1',   cmyk: null },
  { hex: '#025937', label: 'Jungle 2',   cmyk: null },
  { hex: '#008657', label: 'Jungle 3',   cmyk: null },
  { hex: '#30ba78', label: 'Jungle 4',   cmyk: null },
  { hex: '#42d29f', label: 'Jungle 5',   cmyk: null },
  { hex: '#83e1be', label: 'Jungle 6',   cmyk: null },
  { hex: '#c0efde', label: 'Jungle 7',   cmyk: null },
  { hex: '#eafaf4', label: 'Jungle 8',   cmyk: null },

  { hex: '#0c322c', label: 'Pine 1',     cmyk: null },
  { hex: '#01564a', label: 'Pine 2',     cmyk: null },
  { hex: '#008878', label: 'Pine 3',     cmyk: null },
  { hex: '#00bda7', label: 'Pine 4',     cmyk: null },
  { hex: '#38d5b4', label: 'Pine 5',     cmyk: null },
  { hex: '#90ebcd', label: 'Pine 6',     cmyk: null },
  { hex: '#bff1ea', label: 'Pine 7',     cmyk: null },
  { hex: '#eafaf8', label: 'Pine 8',     cmyk: null },

  { hex: '#47190d', label: 'Persimmon 1', cmyk: null },
  { hex: '#8e2810', label: 'Persimmon 2', cmyk: null },
  { hex: '#bd3314', label: 'Persimmon 3', cmyk: null },
  { hex: '#ff5a2b', label: 'Persimmon 4', cmyk: null },
  { hex: '#fe7c3f', label: 'Persimmon 5', cmyk: null },
  { hex: '#ffb184', label: 'Persimmon 6', cmyk: null },
  { hex: '#ffd3bd', label: 'Persimmon 7', cmyk: null },
  { hex: '#ffefe9', label: 'Persimmon 8', cmyk: null },

  { hex: '#0a112b', label: 'Blue 1',     cmyk: null },
  { hex: '#192072', label: 'Blue 2',     cmyk: null },
  { hex: '#0b41b7', label: 'Blue 3',     cmyk: null },
  { hex: '#2453ff', label: 'Blue 4',     cmyk: null },
  { hex: '#3c8eef', label: 'Blue 5',     cmyk: null },
  { hex: '#81aefc', label: 'Blue 6',     cmyk: null },
  { hex: '#c8dafc', label: 'Blue 7',     cmyk: null },
  { hex: '#e6edfe', label: 'Blue 8',     cmyk: null },

  // Spectrum — the secondary / infographics palette. NOT brand colours: it
  // expands the colour wheel for charts & data viz without replacing them.
  { hex: '#00bda7', label: 'Teal',       cmyk: null, group: 'spectrum' },
  { hex: '#a1ef8b', label: 'Lime',       cmyk: null, group: 'spectrum' },
  { hex: '#7dc6e2', label: 'Sky',        cmyk: null, group: 'spectrum' },
  { hex: '#e8c1f7', label: 'Lilac',      cmyk: null, group: 'spectrum' },
  { hex: '#5d4f99', label: 'Amethyst',   cmyk: null, group: 'spectrum' },
  { hex: '#f9cabf', label: 'Peach',      cmyk: null, group: 'spectrum' },
  { hex: '#fcb244', label: 'Marigold',   cmyk: null, group: 'spectrum' },
  { hex: '#bd3314', label: 'Rust',       cmyk: null, group: 'spectrum' },

  // Black & White bookend the Fog grayscale ramp as its true end-points (both
  // also live in the brand block above, like Pine repeats as a ramp endpoint),
  // so the ramp reads cleanly and Fog 1 / Fog 8 aren't misread as pure black/white.
  { hex: '#000000', label: 'Black',      cmyk: [0, 0, 0, 100], group: 'Fog' },
  { hex: '#1d1d1d', label: 'Fog 1',      cmyk: null },
  { hex: '#3e3e3e', label: 'Fog 2',      cmyk: null },
  { hex: '#525252', label: 'Fog 3',      cmyk: null },
  { hex: '#6f6f6f', label: 'Fog 4',      cmyk: null },
  { hex: '#999999', label: 'Fog 5',      cmyk: null },
  { hex: '#bababa', label: 'Fog 6',      cmyk: null },
  { hex: '#dcdbdc', label: 'Fog 7',      cmyk: null },
  { hex: '#efefef', label: 'Fog 8',      cmyk: null },
  { hex: '#ffffff', label: 'White',      cmyk: [0, 0, 0, 0], group: 'Fog' },
];
