// SPDX-License-Identifier: MPL-2.0
/**
 * The three blend styles the shell offers, and the two hue routes.
 *
 * These are the *user-facing* names for an interpolation space, and they were
 * settled on the canvas gradient panel: **Smooth** (OKLab), **Vivid** (OKLCH),
 * and **sRGB** named plainly rather than editorialised - it is the classic
 * behaviour, and someone matching an existing asset wants it without being told
 * off for asking.
 *
 * They live here because two surfaces now offer the same choice - the canvas
 * gradient panel (`views/free-canvas.ts`) and Colour Lab's blend ramp
 * (`views/color-lab.ts`) - and the whole value of a short vocabulary is that it
 * means the same thing in both places. A third surface (brand gradients) is the
 * obvious next one.
 *
 * Deliberately a subset of the spaces `gradient-spec.ts` can *parse*: a hand-written
 * spec may name `lab`, `lch`, `hsl` or `srgb-linear`, and those still round-trip.
 * These three are the ones that differ usefully enough to be worth a button.
 *
 * No CSS import and no DOM, so it stays testable under `node --test`.
 */

import type { ColorSpaceTag, HueDirection } from '@lolly/engine';

export interface BlendStyle {
  space: ColorSpaceTag;
  /** The label, untranslated - callers pass it through `t()`. */
  label: string;
  /** Why you would pick it, for a title attribute. */
  why: string;
}

export const BLEND_STYLES: readonly BlendStyle[] = [
  { space: 'oklab', label: 'Smooth', why: 'Perceptually even. The default, and the space color-mix() uses when none is named.' },
  { space: 'oklch', label: 'Vivid', why: 'Travels round the hue circle instead of through it, so the middle keeps its chroma.' },
  { space: 'srgb', label: 'sRGB', why: 'What a plain CSS gradient, an SVG <linearGradient> and a PDF shading actually do.' },
];

/** Hue travel only means anything in a polar space. */
export const HUE_ROUTES: ReadonlyArray<{ dir: HueDirection; label: string }> = [
  { dir: 'shorter', label: 'Short' },
  { dir: 'longer', label: 'Long way' },
];

/** Is a hue route applicable to this space? */
export function isPolarSpace(space: ColorSpaceTag): boolean {
  return space === 'oklch' || space === 'lch' || space === 'hsl';
}

/**
 * The `in <space>[ <dir> hue]` fragment for a CSS gradient or `color-mix()`.
 *
 * `shorter` is the CSS default, so it is left off - and a hue route is omitted
 * entirely for a rectangular space, where the browser would reject it.
 */
export function cssInterpolation(space: ColorSpaceTag, hue?: HueDirection): string {
  const route = isPolarSpace(space) && hue && hue !== 'shorter' ? ` ${hue} hue` : '';
  return `in ${space}${route}`;
}
