// SPDX-License-Identifier: MPL-2.0
/**
 * color-namer.ts - deterministic, human-readable colour NAMING for the brand
 * generator. When a user picks a colour we show a friendly auto-name ("Deep
 * Ocean Blue", "Pale Amber", "Muted Slate", "Warm Grey", "Near Black", "Off
 * White") before it's added to the brand; they can rename it later.
 *
 * Pure + DOM-free → the same hex always yields the same name (unit-tested in
 * color-namer.test.ts). The only dependency is the engine's colour authority:
 * we convert hex→OKLCH with `hexToOklch` and reason in that perceptual space so
 * "lightness" and "muted/vivid" match what a human sees, not raw sRGB bytes.
 *
 * Structure of a name (title-case, ≤3 words):
 *   • near-neutral (very low chroma)  → a grey-scale name by lightness, with an
 *     optional Warm/Cool temperature   ("Near Black" · "Charcoal" · "Cool Slate
 *     Grey" · "Warm Grey" · "Silver" · "Off White" · "White").
 *   • chromatic → a base hue name from a curated OKLCH hue table (nearest
 *     circular hue) with ONE qualifier: a lightness word (Deep/Dark/Light/Pale)
 *     when it's off-mid, otherwise a chroma word (Muted/Vivid) when notable
 *     ("Deep Blue" · "Pale Amber" · "Vivid Red" · "Teal").
 */

import { hexToOklch } from '@lolly/engine';

/**
 * Curated hue anchors, name + centre hue in OKLCH degrees. Centres are
 * calibrated from real sRGB primaries/secondaries in OKLCH (e.g. #ff0000≈29°,
 * #0000ff≈264°, #00ff00≈143°), not the HSL wheel - OKLCH hue is perceptually
 * spaced, so these are where each name actually reads true. A colour is named by
 * the nearest anchor via circular hue distance.
 */
const HUES: ReadonlyArray<{ name: string; h: number }> = [
  { name: 'Rose', h: 8 },
  { name: 'Red', h: 29 },
  { name: 'Orange', h: 55 },
  { name: 'Amber', h: 82 },
  { name: 'Yellow', h: 107 },
  { name: 'Lime', h: 130 },
  { name: 'Green', h: 150 },
  { name: 'Emerald', h: 170 },
  { name: 'Teal', h: 190 },
  { name: 'Cyan', h: 208 },
  { name: 'Sky', h: 230 },
  { name: 'Blue', h: 260 },
  { name: 'Indigo', h: 282 },
  { name: 'Violet', h: 298 },
  { name: 'Purple', h: 320 },
  { name: 'Magenta', h: 335 },
  { name: 'Pink', h: 350 },
];

// Chroma cutoffs in OKLCH C units (0 → grey; sRGB primaries reach ~0.26–0.32).
const NEUTRAL_C = 0.037; // below this the colour reads as a grey (catches tinted UI greys)
const TEMP_C = 0.012;    // above this a "grey" leans warm/cool
const MUTED_C = 0.06;    // a chromatic colour this desaturated reads "Muted"
const VIVID_C = 0.19;    // this saturated reads "Vivid"

/** Shortest distance between two hue angles (degrees), 0–180. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
}

/** Nearest curated hue name for an OKLCH hue angle. */
function baseHueName(h: number): string {
  let best = HUES[0]!;
  let bestD = Infinity;
  for (const entry of HUES) {
    const d = hueDistance(h, entry.h);
    if (d < bestD) { bestD = d; best = entry; }
  }
  return best.name;
}

/** Lightness qualifier for a chromatic colour (empty for the mid band). */
function lightnessWord(l: number): string {
  if (l < 0.28) return 'Deep';
  if (l < 0.45) return 'Dark';
  if (l <= 0.72) return '';
  if (l <= 0.86) return 'Light';
  return 'Pale';
}

/** Warm/cool lean for a near-neutral, from its faint hue (empty when unclear). */
function temperatureWord(h: number): string {
  if (h >= 20 && h <= 135) return 'Warm';   // reds · oranges · ambers · yellows
  if (h >= 195 && h <= 320) return 'Cool';  // cyans · blues · indigos · violets
  return '';
}

/** Grey-scale base name by lightness. The mid greys accept a temperature word. */
function neutralName(l: number, c: number, h: number): string {
  if (l < 0.12) return 'Near Black';
  // Bands that read as a plain grey and can take a Warm/Cool prefix.
  let base: string;
  let temperable: boolean;
  if (l < 0.26) { base = 'Charcoal'; temperable = true; }
  else if (l < 0.45) { base = 'Slate Grey'; temperable = true; }
  else if (l < 0.60) { base = 'Grey'; temperable = true; }
  else if (l < 0.75) { base = 'Silver'; temperable = true; }
  else if (l < 0.90) { base = 'Off White'; temperable = false; }
  else { base = 'White'; temperable = false; }
  const temp = temperable && c > TEMP_C ? temperatureWord(h) : '';
  return temp ? `${temp} ${base}` : base;
}

/**
 * Friendly, deterministic, title-case name for a colour.
 * @param hex  `#rgb` / `#rrggbb` / `#rrggbbaa` (the leading `#` is optional).
 * @returns e.g. "Deep Blue", "Pale Amber", "Muted Teal", "Warm Grey",
 *          "Near Black", "Off White". Never empty - unparseable input → "Grey".
 */
export function nameColor(hex: string): string {
  const o = hexToOklch(hex);
  if (!o) return 'Grey';
  const { l, c, h } = o;

  // Near-neutral: name by lightness (grey scale), not hue.
  if (c < NEUTRAL_C) return neutralName(l, c, h);

  // Chromatic: base hue + a single qualifier. A lightness word wins when the
  // colour is off-mid; otherwise fall back to a chroma word when it's notable.
  const base = baseHueName(h);
  const light = lightnessWord(l);
  if (light) return `${light} ${base}`;
  if (c < MUTED_C) return `Muted ${base}`;
  if (c > VIVID_C) return `Vivid ${base}`;
  return base;
}
