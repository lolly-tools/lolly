// SPDX-License-Identifier: MPL-2.0
/**
 * One reading of an authored colour as sRGB and opacity, shared by the drawing
 * compiler (`design-draw.ts`) and the Penpot lowering. Moved out of `penpot-file.ts`
 * so a consumer of drawing operations does not load the Penpot writer.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */
import { colorToHex } from './tokens.ts';

/** Null-prototype on purpose: a plain literal would answer `NAMED['constructor']` and
 *  `NAMED['__proto__']` with an inherited non-string, which every caller then treats as
 *  a colour (see the `typeof` guard in {@link parsePenpotColor}). */
const NAMED: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00',
  cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', maroon: '#800000', olive: '#808000', lime: '#00ff00', teal: '#008080', navy: '#000080',
  purple: '#800080', orange: '#ffa500', pink: '#ffc0cb', brown: '#a52a2a', gold: '#ffd700', indigo: '#4b0082',
  violet: '#ee82ee', tomato: '#ff6347', coral: '#ff7f50', salmon: '#fa8072', khaki: '#f0e68c', tan: '#d2b48c',
  beige: '#f5f5dc', ivory: '#fffff0', lavender: '#e6e6fa', crimson: '#dc143c', turquoise: '#40e0d0',
  orchid: '#da70d6', plum: '#dda0dd', chocolate: '#d2691e', sienna: '#a0522d', wheat: '#f5deb3', snow: '#fffafa',
  skyblue: '#87ceeb', steelblue: '#4682b4', slategray: '#708090', slategrey: '#708090', dimgray: '#696969',
  dimgrey: '#696969', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
  whitesmoke: '#f5f5f5', gainsboro: '#dcdcdc', darkblue: '#00008b', darkgreen: '#006400', darkred: '#8b0000',
  royalblue: '#4169e1', dodgerblue: '#1e90ff', deepskyblue: '#00bfff', forestgreen: '#228b22', seagreen: '#2e8b57',
  limegreen: '#32cd32', springgreen: '#00ff7f', hotpink: '#ff69b4', deeppink: '#ff1493', firebrick: '#b22222',
  darkorange: '#ff8c00', orangered: '#ff4500', goldenrod: '#daa520', rebeccapurple: '#663399', mintcream: '#f5fffa',
});

export interface PenpotColor { hex: string; alpha: number }
/**
 * Read a CSS/DTCG colour into Penpot's `#rrggbb` + alpha. Accepts hex (3/4/6/8),
 * rgb[a](), hsl[a](), oklch(), the common named colours, and `var(--x, <fallback>)`
 * - for which it returns the LITERAL fallback, a stale copy of whatever the brand
 * paints today, so a caller holding a live resolver must ask that first and treat
 * this as the last resort (see `boxesToPenpotDoc`'s `color()`). `transparent`,
 * `none`, an alias `{a.b}` or anything unreadable → null, so the caller either
 * resolves it (brand tokens) or drops the paint.
 */
export function parsePenpotColor(input: unknown): PenpotColor | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  const varM = /^var\(\s*--[\w-]+\s*,\s*([\s\S]+)\)$/.exec(s);
  if (varM) s = varM[1]!.trim();
  if (/^var\(/.test(s) || /^\{/.test(s)) return null;
  const lower = s.toLowerCase();
  if (lower === 'transparent' || lower === 'none' || lower === 'currentcolor' || lower === 'inherit') return null;
  const named = NAMED[lower];
  if (typeof named === 'string') return { hex: named, alpha: 1 };
  const hex = colorToHex(s);
  if (!hex || hex === 'transparent') return null;
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m) return null;
  return { hex: `#${m[1]!.toLowerCase()}`, alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
}
