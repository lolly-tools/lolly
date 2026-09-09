import { clamp } from '@lolly/engine';
// SPDX-License-Identifier: MPL-2.0
/**
 * Palette-wheel geometry - the pure OKLCH↔polar mapping the wheel plots and drags
 * through. Split out of palette-wheel.ts (which imports CSS) so it stays DOM- and
 * CSS-free and can be unit-tested under `node --test` (palette-wheel.test.ts).
 *
 * The disc is an OKLCH hue/chroma plane: angle = hue (0° straight up, clockwise),
 * distance from the centre = chroma (desaturated at the middle, vivid at the rim).
 * Lightness is not positional ON THE DISC - it rides in the dot's own colour.
 *
 * Neutrals are the exception: they come off the disc and plot on a lightness rail
 * beside it (railY / isNeutral, below), because a grey has no hue to plot by.
 */

// Disc geometry, in % of the square box. The rim is where the highest in-gamut
// chroma lands; a small inner floor keeps the least-saturated colours off the
// exact centre so they're still clickable. CMAX is a practical sRGB chroma
// ceiling - colours past it (rare) just pin to the rim.
export const WHEEL_R = 41;
export const WHEEL_R_IN = 4;
export const WHEEL_CMAX = 0.33;
const DEG = Math.PI / 180;

/** OKLCH → dot position (x,y in % of the box). angle=hue, radius=chroma. */
export function oklchWheelXY(o: { l: number; c: number; h: number }): { x: number; y: number } {
  const rad = WHEEL_R_IN + clamp(o.c / WHEEL_CMAX, 0, 1) * (WHEEL_R - WHEEL_R_IN);
  return { x: 50 + rad * Math.sin(o.h * DEG), y: 50 - rad * Math.cos(o.h * DEG) };
}

/** Dot position (x,y in % of the box) → { c, h }. Inverse of oklchWheelXY. */
export function wheelXYToChromaHue(x: number, y: number): { c: number; h: number } {
  const dx = x - 50, dy = y - 50;
  const rad = Math.hypot(dx, dy);
  const c = clamp((rad - WHEEL_R_IN) / (WHEEL_R - WHEEL_R_IN), 0, 1) * WHEEL_CMAX;
  let h = Math.atan2(dx, -dy) / DEG;
  if (h < 0) h += 360;
  return { c, h };
}

// ── The neutral rail ─────────────────────────────────────────────────────────
// Greys do not belong on a hue wheel. A neutral has c ≈ 0, so the polar mapping
// above collapses every one of them onto the centre - a stack of dots piled in
// the hub, at an angle their (undefined) hue picked at random. Worse, the one
// axis that actually separates them - lightness - isn't positional on the disc
// at all.
//
// So they come off the disc entirely and plot on a rail beside it, ordered by
// the axis that means something for a grey: light at the top, dark at the
// bottom. The disc stays purely chromatic; the rail gives lightness the
// positional axis it never had.

/** Below this OKLCH chroma a colour is a neutral, and rides the rail. */
export const WHEEL_NEUTRAL_C = 0.02;
/** Rail padding, in % of the rail's box - keeps l=0 and l=1 dots off the ends. */
const RAIL_PAD = 6;

/** Is this a grey (or near-grey), i.e. a rail dot rather than a disc dot? */
export function isNeutral(o: { c: number }): boolean {
  return o.c < WHEEL_NEUTRAL_C;
}

/** OKLCH lightness → rail position (y in % of the rail's box). White at the top. */
export function railY(l: number): number {
  return RAIL_PAD + (1 - clamp(l, 0, 1)) * (100 - 2 * RAIL_PAD);
}

/** Rail position (y in % of the rail's box) → lightness. Inverse of railY. */
export function railYToL(y: number): number {
  return clamp(1 - (y - RAIL_PAD) / (100 - 2 * RAIL_PAD), 0, 1);
}
