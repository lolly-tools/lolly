// SPDX-License-Identifier: MPL-2.0
/**
 * Playful "rendering…" lines for the Progress panel. Kept short (≲ 42 chars) so each
 * fits one Panel line at the narrow (cols < 80) breakpoint, and plain-text only - NO
 * width-2 emoji (the panel is a fixed-width grid; an emoji would drift the border).
 */
export const QUIPS: readonly string[] = [
  'Teaching pixels to behave…',
  'Folding vectors into a tidy zip…',
  'Coaxing the geeko off the canvas…',
  'Outlining every last glyph…',
  'Bribing Handlebars to cooperate…',
  'Stacking bytes like tiny bricks…',
  'Tightening the kerning, just because…',
  'Rounding the corners nice and clean…',
  'Persuading paths to close politely…',
  'Snapping shapes to the grid…',
  'Letting the ink dry a moment…',
  'Zipping it all up, hold tight…',
  'Counting the colours twice…',
  'Straightening every stray anchor…',
  'Whispering to the render loop…',
  'Packing your files with care…',
  'Aligning things to the pixel…',
  'Sweeping up leftover whitespace…',
  'Giving the layout one last look…',
  'Almost there - buffing the edges…',
];

/** Deterministic rotation by tick index - `QUIPS[i % QUIPS.length]`. Progress.tsx bumps
 *  `i` on a timer so the line cycles without re-randomising on every React re-render. */
export function quipAt(i: number): string {
  const n = QUIPS.length;
  return QUIPS[((i % n) + n) % n]!;
}
