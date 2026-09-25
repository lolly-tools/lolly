// SPDX-License-Identifier: MPL-2.0
/**
 * Which logo goes on this background (plan 274 section 3.4).
 *
 * Both deck tools already answer this, separately:
 * `community/deck-studio/hooks.js` (`bgIsDark` near 183, `pickLogo` near 167) and
 * `brands/suse/tools/deck-builder/hooks.js` (near 603 and 678). A Design frame
 * seeded from a slide master needs the same answer per frame, so the pair moves
 * here once and the tools can adopt it later.
 *
 * The darkness test is Rec.709 weights over the raw 0-255 channels with a
 * threshold of 140. That is NOT WCAG relative luminance, which linearises first;
 * it is what the shipping decks have used since they were written, and changing
 * it would move the mark on existing decks. `contrastRatio` is re-exported from
 * brand-derive.ts for callers that want the WCAG number, so the maths lives in
 * one place.
 *
 * ONE KNOWN DIVERGENCE, because the two tools disagree with each other: for a
 * colour neither of them can read, deck-studio answers "not dark" and deck-builder
 * answers "dark" (its `relLum` returns 0 for an unreadable string, and its comment
 * near 145 calls that assumption deliberate). This module takes deck-studio's
 * answer, so nothing that was never stated turns into a reverse mark. It also reads
 * more spellings than either tool before giving up: a CSS colour name, a modern
 * space-separated `rgb()` and the other CSS Color 4 functions all resolve through
 * `css-color.ts`, which is what a design-system token can hand over ("rebeccapurple"
 * passes through the token system untouched). A master that wants the question
 * settled without a colour states `dark` on the archetype, and `pickLogoVariant`
 * takes that as the answer.
 *
 * Pure: no DOM, no clock, no network, no filesystem.
 */

import { parseColorToSrgb8 } from './css-color.ts';

export { contrastRatio } from './brand-derive.ts';

/** A background as the deck tools state it: a CSS colour, or a gradient whose first stop decides. */
export interface BackgroundStopV1 { color?: string }
export interface BackgroundGradientV1 { stops?: BackgroundStopV1[] }
export interface BackgroundValueV1 { grad?: BackgroundGradientV1 }
export type BackgroundInputV1 = string | BackgroundValueV1 | null | undefined;

/** The four logo slots a master can offer. Every one is optional. */
export interface LogoSetV1<T = string> {
  onLight?: T;
  onDark?: T;
  monoOnLight?: T;
  monoOnDark?: T;
}

export type LogoVariantNameV1 = 'onLight' | 'onDark' | 'monoOnLight' | 'monoOnDark';

export interface LogoVariantRequestV1<T = string> {
  background: BackgroundInputV1;
  logos: LogoSetV1<T>;
  mono?: boolean;
  /**
   * The answer to "is this dark", stated rather than measured. A slide master states
   * it per archetype, so a gradient stored as its dominant stop still gets the mark
   * its author meant. Left out, the background is measured.
   */
  dark?: boolean;
}

export interface LogoVariantChoiceV1<T = string> {
  variant: LogoVariantNameV1;
  value: T;
  /** What the background test said, so a caller can pick an ink colour from the same answer. */
  dark: boolean;
}

/** The Rec.709 darkness threshold on raw 0-255 channels, as the deck tools wrote it. */
export const BACKGROUND_DARK_THRESHOLD = 140;

/**
 * Parse a background colour to 0-255 channels.
 *
 * The first two branches are the deck tools' own reader, so `#rgb`, `#rrggbb`,
 * `#rrggbbaa`, a bare `0c322c` and legacy `rgb()`/`rgba()` give the numbers those
 * decks have always seen, alpha ignored. Everything else goes to `css-color.ts`,
 * which reads CSS colour names, space-separated `rgb()`, `hsl()`, `oklch()` and the
 * rest, composited against nothing (alpha ignored the same way). Null is what is
 * left, and callers read it as "not stated", never as "light".
 */
export function parseBackgroundRgb(input: string): [number, number, number] | null {
  const raw = String(input ?? '').trim();
  const fn = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(raw);
  if (fn) {
    const r = Number(fn[1]);
    const g = Number(fn[2]);
    const b = Number(fn[3]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return [r, g, b];
  }
  let s = raw.replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
  if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) {
    return [
      Number.parseInt(s.slice(0, 2), 16),
      Number.parseInt(s.slice(2, 4), 16),
      Number.parseInt(s.slice(4, 6), 16),
    ];
  }
  const css = parseColorToSrgb8(raw);
  return css ? [css[0], css[1], css[2]] : null;
}

/**
 * Is this background dark enough to want the reverse mark? A gradient is judged by
 * its first stop, exactly as the decks do. An unreadable colour is false, so the
 * standard mark is the answer when nothing was stated.
 */
export function bgIsDark(bg: BackgroundInputV1): boolean {
  const colour = typeof bg === 'string'
    ? bg
    : bg?.grad?.stops?.[0]?.color;
  if (typeof colour !== 'string') return false;
  const rgb = parseBackgroundRgb(colour);
  if (!rgb) return false;
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < BACKGROUND_DARK_THRESHOLD;
}

/**
 * Pick the logo for a background, with the deck tools' fallback order: the side comes
 * from the background, then mono prefers the mono mark and falls back to the colour
 * one, while colour prefers the colour mark and falls back to mono. No cross-side
 * fallback: a pack with only a light mark gets nothing on a dark frame rather than a
 * mark that disappears into it. A stated `dark` settles the side without measuring.
 */
export function pickLogoVariant<T>(req: LogoVariantRequestV1<T>): LogoVariantChoiceV1<T> | null {
  const dark = typeof req.dark === 'boolean' ? req.dark : bgIsDark(req.background);
  const logos = req.logos || {};
  const colourName: LogoVariantNameV1 = dark ? 'onDark' : 'onLight';
  const monoName: LogoVariantNameV1 = dark ? 'monoOnDark' : 'monoOnLight';
  const order: LogoVariantNameV1[] = req.mono ? [monoName, colourName] : [colourName, monoName];
  for (const name of order) {
    const value = logos[name];
    if (value !== undefined && value !== null) return { variant: name, value, dark };
  }
  return null;
}
