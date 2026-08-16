// SPDX-License-Identifier: MPL-2.0
/**
 * One colour, fully described. This connects css-color.ts (which already
 * parses and converts 14 CSS Color 4 spaces) and gamut.ts (which knows what a
 * display can actually show).
 *
 * Both modules existed already, but nothing combined them. A caller holding a
 * colour could convert it anywhere but could not answer the two questions that
 * decide whether it is usable: **is it inside sRGB, and if not, what will it
 * become?** Every surface that asked ended up flattening to a hex first, which
 * discards exactly the colours worth asking about: a `color(display-p3 1 0 0)`
 * becomes `#ff0000` and the answer comes out wrong.
 *
 * `describeColor` keeps the authored value intact: the OKLCH here is UNCLAMPED,
 * so a P3 red reports chroma 0.32 rather than sRGB red's 0.26, and `gamut` says
 * `'p3'` rather than `'srgb'`. The clamped form is offered alongside as
 * `srgbHex`, clearly labelled as the fallback rather than the value.
 *
 * Pure and deterministic: no Date, no Math.random, no IO.
 */

import { parseColor, convertColor, formatColor, colorToSrgb } from './css-color.ts';
import type { CssColor, ColorSpaceTag } from './css-color.ts';
import { oklchToHex, contrastRatio } from './brand-derive.ts';
import type { Oklch } from './brand-derive.ts';
import { oklchGamut, maxChroma } from './gamut.ts';
import type { GamutName } from './gamut.ts';

/** The spaces a description writes the colour out in, in the order shown. */
export const NOTATION_SPACES: readonly ColorSpaceTag[] = [
  'oklch', 'oklab', 'srgb', 'display-p3', 'rec2020', 'lab', 'lch', 'hsl', 'xyz-d65',
];

export interface ColorNotation {
  space: ColorSpaceTag;
  /** The colour written in this space, e.g. `oklch(62.79% 0.2577 29.23)`. */
  css: string;
  /** Whether this space can hold the colour without clamping. A notation whose
   * space is too narrow is still emitted - CSS would clamp it, and seeing the
   * clamped numbers is the point - but it must be labelled. */
  exact: boolean;
}

export interface ColorDescription {
  /** The input, trimmed, exactly as authored. */
  input: string;
  /** The parsed colour in its authored space. */
  parsed: CssColor;
  /** OKLCH, UNCLAMPED - the authored colour, not a displayable approximation. */
  oklch: Oklch;
  /** The narrowest display gamut that holds it, or 'none'. */
  gamut: GamutName;
  /** True when the colour survives sRGB untouched. */
  inSrgb: boolean;
  /** The nearest sRGB colour - what actually renders on an ordinary screen.
   *  A FALLBACK, not the value; equals the colour itself when `inSrgb`. */
  srgbHex: string;
  /** How much chroma sRGB has left at this lightness and hue. Negative when the
   *  colour is already outside and is being mapped down to render. */
  headroom: number;
  /** The sRGB and Display-P3 chroma ceilings at this lightness and hue. */
  ceiling: { srgb: number; p3: number; rec2020: number };
  /** The colour written out in every space in {@link NOTATION_SPACES}. */
  notations: ColorNotation[];
  /** Alpha 0–1, as authored. */
  alpha: number;
}

/** Spaces whose components are bounded to 0–1; the perceptual and XYZ spaces
 *  are unbounded and describe every colour exactly. `hsl`/`hwb` are sRGB in
 *  polar form, so they are bounded by sRGB even though their numbers are not. */
const BOUNDED = new Set<ColorSpaceTag>([
  'srgb', 'srgb-linear', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'hsl', 'hwb',
]);

/**
 * Can this space hold the colour without clamping?
 *
 * Judged on the CONVERTED components rather than by classifying the colour and
 * comparing gamuts. Both would be nearly right, but only this one can't
 * disagree with the numbers printed beside it - the matrix chain and the
 * classifier differ by ~1e-3 near a boundary, which is enough to render a
 * component as `-0.005` while a label calls it exact.
 */
function fitsSpace(c: CssColor, space: ColorSpaceTag): boolean {
  if (!BOUNDED.has(space)) return true;
  const conv = convertColor(c, space);
  const parts = space === 'hsl' || space === 'hwb'
    // Only the two percentage components are bounded; hue wraps freely.
    ? [conv.components[1] / 100, conv.components[2] / 100]
    : conv.components;
  const SLACK = 1e-4; // absorbs the conversion chain's own rounding
  return parts.every(v => v >= -SLACK && v <= 1 + SLACK);
}

/**
 * Describe any CSS colour: hex, a named colour, `rgb()`, `hsl()`, `hwb()`,
 * `lab()`, `lch()`, `oklab()`, `oklch()`, or `color(<space> …)` in any of the
 * spaces css-color.ts supports. Returns null only when the string cannot be
 * parsed at all.
 */
export function describeColor(input: string): ColorDescription | null {
  const trimmed = String(input ?? '').trim();
  const parsed = parseColor(trimmed);
  if (!parsed) return null;

  const [L, a, b] = convertColor(parsed, 'oklab').components;
  const c = Math.hypot(a, b);
  const h = c < 1e-7 ? 0 : ((((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360;
  const oklch: Oklch = { l: L, c, h };

  const gamut = oklchGamut(L, c, h);
  const ceiling = {
    srgb: maxChroma(L, h, 'srgb'),
    p3: maxChroma(L, h, 'p3'),
    rec2020: maxChroma(L, h, 'rec2020'),
  };

  // The sRGB fallback comes from css-color's own mapper (which routes through
  // the same CSS Color 4 section 14.2 chroma reduction) rather than a second path.
  const srgb = colorToSrgb(parsed);
  const byte = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  const srgbHex = `#${byte(srgb[0])}${byte(srgb[1])}${byte(srgb[2])}`;

  const notations: ColorNotation[] = NOTATION_SPACES.map(space => ({
    space,
    css: formatColor(convertColor(parsed, space)),
    exact: fitsSpace(parsed, space),
  }));

  return {
    input: trimmed,
    parsed,
    oklch,
    gamut,
    inSrgb: gamut === 'srgb',
    srgbHex,
    headroom: ceiling.srgb - c,
    ceiling,
    notations,
    alpha: parsed.alpha,
  };
}

// ─── Readability against the extremes ─────────────────────────────────────────

/** The highest WCAG 2.1 level a contrast ratio reaches. */
export type WcagLevel = 'AAA' | 'AA' | 'fail';

export interface ContrastVerdict {
  /** Whichever of black or white this colour contrasts with more. */
  against: '#000000' | '#ffffff';
  /** The winning ratio (WCAG 2.1, 1–21) - see the floor noted below. */
  ratio: number;
  /** The level the winning pair reaches for BODY text (4.5 = AA, 7 = AAA). */
  level: WcagLevel;
  /** …and for large text - ≥18.66px bold or ≥24px (3 = AA, 4.5 = AAA). */
  largeLevel: WcagLevel;
  /** Both sides, so a report can show the pair rather than only the winner. */
  onBlack: number;
  onWhite: number;
}

/**
 * The lowest ratio {@link contrastVsExtremes} can possibly return: √21 ≈ 4.583.
 *
 * WCAG's ratio is `(L₁+0.05)/(L₂+0.05)`, so a colour's ratios against black and
 * white multiply to exactly 21 whatever its luminance. Taking the better of the
 * two therefore bottoms out where they meet, at √21 - and that is ABOVE the 4.5
 * body-text AA threshold.
 */
export const EXTREMES_CONTRAST_FLOOR = Math.sqrt(21);

const levelFor = (ratio: number, large: boolean): WcagLevel => {
  const [aa, aaa] = large ? [3, 4.5] : [4.5, 7];
  return ratio >= aaa ? 'AAA' : ratio >= aa ? 'AA' : 'fail';
};

/**
 * Score a colour against black AND white, reporting the better of the two - the
 * same question a swatch answers when it picks its own label colour.
 *
 * **Read the result knowing the floor.** Because the two ratios always multiply
 * to 21 (see {@link EXTREMES_CONTRAST_FLOOR}), every colour clears body-text AA
 * against one extreme or the other, and `level` is therefore never `'fail'`
 * here. That is not a bug and not a reason to trust a colour blindly: it means
 * the informative parts of this verdict are *which* extreme wins and whether it
 * reaches **AAA** - not whether it "passes". A verdict against a real brand
 * surface (plain `contrastRatio`) is what can actually fail, and is the number
 * to enforce with.
 *
 * Measured on the colour that RENDERS (`srgbHex`), since a reader cannot read
 * text against a colour their screen can't show.
 */
export function contrastVsExtremes(color: string): ContrastVerdict | null {
  const d = describeColor(color);
  if (!d) return null;
  const hex = d.srgbHex;
  const onBlack = contrastRatio(hex, '#000000');
  const onWhite = contrastRatio(hex, '#ffffff');
  const ratio = Math.max(onBlack, onWhite);
  return {
    against: onBlack >= onWhite ? '#000000' : '#ffffff',
    ratio,
    level: levelFor(ratio, false),
    largeLevel: levelFor(ratio, true),
    onBlack,
    onWhite,
  };
}

/** The WCAG level a ratio reaches, for callers scoring against their own
 *  surfaces (where `'fail'` is a real outcome). */
export function wcagLevel(ratio: number, opts: { large?: boolean } = {}): WcagLevel {
  return levelFor(ratio, !!opts.large);
}

/** OKLCH → hex, gamut-mapped. Re-exported so a caller describing colours does
 *  not need a second engine import to render one. */
export { oklchToHex };
