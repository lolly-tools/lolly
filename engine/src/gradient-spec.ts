// SPDX-License-Identifier: MPL-2.0
/**
 * The Lolly gradient spec: one terse, URL-safe string that describes a gradient,
 * and the CSS it bakes down to.
 *
 * A gradient must survive the same round trip as every other input: typed in
 * an editor, written into a block row, encoded into a shareable URL, decoded by
 * the CLI, and rendered identically headless. So it is a STRING, not an object.
 * The parse/format pair lives here so the tool hooks (through `host.color`), the
 * web shell's on-canvas editor, and the tests all agree on one grammar.
 *
 *   lin_90_30ba78-0_efefef-100          linear, 90°, two stops
 *   rad_0_0c322c-0_30ba78-60_ffffff-100 radial from the centre, three stops
 *   con_45_ff0000-0_0000ff-100          conic, starting at 45°
 *   lin.srgb_90_000000-0_ffffff-100     …interpolated in sRGB instead of OKLab
 *   lin.oklch.longer_90_f00-0_0f0-100   …the long way round the hue circle
 *
 * Grammar: `<kind>[.<space>[.<hue>]]_<angle>_<colour>-<pos>_…`
 *
 * Every separator (`_`, `-`, `.`) is a character `encodeURIComponent` leaves
 * alone, so a spec costs the same in a URL as it does here: no percent-escaping,
 * unlike the `,`/`~` the compact block encoder reserves for its own row and field
 * splits. Colours are written without the leading `#` for the same reason (the
 * convention colour fields already use in URLs); parsing accepts it either way,
 * along with named colours and `transparent`.
 *
 * ── Why bake, instead of emitting `linear-gradient(in oklab, …)` ──
 *
 * Only the browser would honour it. An SVG `<linearGradient>` and a PDF
 * axial shading interpolate sRGB with no space to choose, so a CSS-space gradient
 * would render one way on screen and another in every exported vector file. The
 * spec is therefore interpolated HERE (css-color.ts#gradientStops, adaptive: extra
 * stops only where sRGB would visibly diverge) and emitted as an ordinary
 * `linear-gradient(…)` with plain sRGB stops. One value, three renderers, no new
 * syntax for the export walkers to learn.
 *
 * Pure and deterministic: no DOM, no IO. Every entry point returns null (never
 * throws) on unreadable input, because a spec can arrive from a hand-edited URL.
 */

import { parseColor, colorToHexString, gradientStops, isNamedColor } from './css-color.ts';
import type { ColorSpaceTag, ColorStop, HueDirection } from './css-color.ts';

/** The gradient shapes a spec can describe (CSS has a primitive for each). */
export const GRADIENT_KINDS = ['linear', 'radial', 'conic'] as const;
export type GradientKind = (typeof GRADIENT_KINDS)[number];

/** The interpolation space a spec uses when it names none. */
export const DEFAULT_GRADIENT_SPACE: ColorSpaceTag = 'oklab';

/**
 * Upper bound on stops per spec. This is not a UI preference: a hand-edited URL is
 * untrusted input, and each stop drives an adaptive subdivision, so the work per
 * render has to be bounded. Extra stops are dropped, not an error.
 */
export const MAX_GRADIENT_STOPS = 12;

/** One authored stop: the colour exactly as written, and its position in percent. */
export interface GradientSpecStop {
  /** The colour as authored - hex (`#rrggbb`/`#rrggbbaa`), a CSS colour name, or
   *  `transparent`. Kept verbatim so a round trip is lossless. */
  color: string;
  /** Position along the gradient, 0–100. */
  pos: number;
}

export interface GradientSpec {
  kind: GradientKind;
  /** Degrees. The gradient line's direction for `linear` (CSS convention: 0 = to
   *  top, 90 = to right), the `from` angle for `conic`, unused for `radial`. */
  angle: number;
  stops: GradientSpecStop[];
  /** Interpolation space. */
  space: ColorSpaceTag;
  /** Hue travel, for a polar interpolation space. */
  hue?: HueDirection;
}

const KIND_TOKENS: Readonly<Record<string, GradientKind>> = {
  lin: 'linear', linear: 'linear',
  rad: 'radial', radial: 'radial',
  con: 'conic', conic: 'conic',
};
const KIND_SHORT: Readonly<Record<GradientKind, string>> = {
  linear: 'lin', radial: 'rad', conic: 'con',
};

// The interpolation spaces a spec can name. Deliberately a subset of
// ColorSpaceTag: these are the ones that differ *usefully* for a gradient, and
// keeping the list closed means a typo reads as "unknown" rather than silently
// picking a space nobody meant.
const SPACE_TOKENS: Readonly<Record<string, ColorSpaceTag>> = {
  oklab: 'oklab', oklch: 'oklch', lab: 'lab', lch: 'lch',
  srgb: 'srgb', 'srgb-linear': 'srgb-linear', hsl: 'hsl',
};
const HUE_TOKENS: Readonly<Record<string, HueDirection>> = {
  shorter: 'shorter', longer: 'longer', increasing: 'increasing', decreasing: 'decreasing',
};

const normAngle = (n: number): number => ((n % 360) + 360) % 360;
const clampPos = (n: number): number => Math.min(100, Math.max(0, n));

// A stop colour, normalised for output: hex loses its `#`, an ident stays a word.
// Anything unreadable is dropped by the caller, so this never has to guess.
const wireColor = (c: string): string => (c.startsWith('#') ? c.slice(1) : c);

// The authored form of a wire colour: bare hex regains its `#`, idents don't.
//
// Names are checked FIRST, so a colour keyword can never be misread as hex. In
// practice no CSS colour name is also a valid hex string (a name needs a letter
// outside a–f), and there is a test pinning that. The precedence is free, though,
// so the grammar doesn't depend on that coincidence holding.
function readColor(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (isNamedColor(s) || s.toLowerCase() === 'transparent') return s.toLowerCase();
  const withHash = /^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ? `#${s}` : s;
  return parseColor(withHash) ? withHash.toLowerCase() : null;
}

/**
 * Parse a gradient spec string. Returns null for an empty/unreadable spec or one
 * with fewer than two usable stops. A gradient needs two colours to be a
 * gradient, and a caller with null should fall back to a flat fill rather than
 * paint something half-specified.
 *
 * Lenient about what it accepts (an `@` between colour and position, a leading
 * `#`, a missing angle, unpositioned stops, upper case) and strict about what
 * {@link formatGradientSpec} writes back.
 */
export function parseGradientSpec(input: string | null | undefined): GradientSpec | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  const parts = s.split('_').filter(p => p.length > 0);
  if (parts.length < 2) return null;

  // Head: kind[.space[.hue]]
  const head = parts[0]!.toLowerCase().split('.');
  const kind = Object.hasOwn(KIND_TOKENS, head[0] ?? '') ? KIND_TOKENS[head[0]!]! : null;
  if (!kind) return null;
  let space = DEFAULT_GRADIENT_SPACE;
  let hue: HueDirection | undefined;
  for (const tok of head.slice(1)) {
    if (Object.hasOwn(SPACE_TOKENS, tok)) space = SPACE_TOKENS[tok]!;
    else if (Object.hasOwn(HUE_TOKENS, tok)) hue = HUE_TOKENS[tok]!;
    else return null;                       // an unreadable modifier is not a guess
  }

  // The angle slot is positional but optional-in-practice: a spec pasted without
  // one still describes a gradient, so a non-numeric second part is treated as the
  // first stop rather than failing the whole value.
  let rest = parts.slice(1);
  let angle = kind === 'linear' ? 180 : 0;   // CSS default: `to bottom` / from 0deg
  if (rest.length && /^[+-]?\d+(?:\.\d+)?$/.test(rest[0]!)) {
    angle = normAngle(parseFloat(rest[0]!));
    rest = rest.slice(1);
  }

  const stops: GradientSpecStop[] = [];
  for (const tok of rest) {
    if (stops.length >= MAX_GRADIENT_STOPS) break;
    // `colour-pos`, `colour@pos`, or a bare colour. Split on the LAST separator so
    // a hyphenated name (`light-blue` is not a CSS colour, but be safe) survives.
    const at = Math.max(tok.lastIndexOf('-'), tok.lastIndexOf('@'));
    const hasPos = at > 0 && /^\d+(?:\.\d+)?$/.test(tok.slice(at + 1));
    const color = readColor(hasPos ? tok.slice(0, at) : tok);
    if (!color) continue;                    // skip the unreadable stop, keep the rest
    stops.push({ color, pos: hasPos ? clampPos(parseFloat(tok.slice(at + 1))) : Number.NaN });
  }
  if (stops.length < 2) return null;

  // Unpositioned stops spread evenly between their positioned neighbours. This is
  // the same rule CSS applies, so a hand-written `lin_90_red_blue` behaves as expected.
  spreadPositions(stops);
  return { kind, angle, stops, space, ...(hue ? { hue } : {}) };
}

// Fill in NaN positions: the ends anchor to 0/100, and each interior run is spread
// evenly between the positioned stops that bracket it. Then enforce monotonicity
// the way CSS does: a position smaller than the one before it clamps UP to it,
// which is how a hard-edged stop is written.
function spreadPositions(stops: GradientSpecStop[]): void {
  const last = stops.length - 1;
  if (Number.isNaN(stops[0]!.pos)) stops[0]!.pos = 0;
  if (Number.isNaN(stops[last]!.pos)) stops[last]!.pos = 100;
  let i = 0;
  while (i <= last) {
    if (!Number.isNaN(stops[i]!.pos)) { i++; continue; }
    let j = i;
    while (j <= last && Number.isNaN(stops[j]!.pos)) j++;
    const from = stops[i - 1]!.pos;
    const to = stops[j]!.pos;
    for (let k = i; k < j; k++) stops[k]!.pos = from + ((to - from) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  for (let k = 1; k <= last; k++) stops[k]!.pos = Math.max(stops[k]!.pos, stops[k - 1]!.pos);
}

/** Serialise back to the canonical spec string (round-trips through parse). */
export function formatGradientSpec(g: GradientSpec): string {
  const mods = [
    g.space !== DEFAULT_GRADIENT_SPACE ? g.space : '',
    g.hue && g.hue !== 'shorter' ? g.hue : '',
  ].filter(Boolean).join('.');
  const head = KIND_SHORT[g.kind] + (mods ? `.${mods}` : '');
  const num = (n: number): string => String(Math.round(n * 100) / 100);
  const stops = g.stops.map(s => `${wireColor(s.color)}-${num(clampPos(s.pos))}`);
  return [head, num(normAngle(g.angle)), ...stops].join('_');
}

/**
 * The spec's stops, baked for a flat sRGB renderer (see the module header). Useful
 * on its own for a caller that wants the stop list rather than a CSS string, for
 * example an SVG `<linearGradient>` builder.
 */
export function gradientSpecStops(g: GradientSpec): ColorStop[] {
  const authored: ColorStop[] = [];
  for (const s of g.stops) {
    const c = parseColor(s.color);
    if (c) authored.push({ color: c, pos: clampPos(s.pos) });
  }
  if (authored.length < 2) return authored;
  return gradientStops(authored, { space: g.space, hue: g.hue });
}

/**
 * The spec as a CSS gradient value: `linear-gradient(…)` / `radial-gradient(…)` /
 * `conic-gradient(…)` with baked sRGB stops, ready for a `background-image`.
 * Returns null when the spec can't be read, so a caller can fall back to a flat
 * fill.
 *
 * Every form emitted here is one the export walkers already understand
 * (buildLinearGradientEl / parseRadialGradient / parseConicGradient), which is the
 * whole point of baking rather than emitting `in oklab`.
 */
export function gradientSpecToCss(input: string | GradientSpec | null | undefined): string | null {
  const g = typeof input === 'string' || input == null ? parseGradientSpec(input as string) : input;
  if (!g) return null;
  const baked = gradientSpecStops(g);
  if (baked.length < 2) return null;
  const stops = baked
    .map(s => `${colorToHexString(s.color)} ${Math.round(s.pos * 100) / 100}%`)
    .join(', ');
  switch (g.kind) {
    case 'radial':
      // An ellipse filling the box, so the sweep reaches every corner. These are
      // the shape/size keywords the radial walker resolves.
      return `radial-gradient(ellipse farthest-corner at 50% 50%, ${stops})`;
    case 'conic':
      return `conic-gradient(from ${Math.round(normAngle(g.angle) * 100) / 100}deg at 50% 50%, ${stops})`;
    default:
      return `linear-gradient(${Math.round(normAngle(g.angle) * 100) / 100}deg, ${stops})`;
  }
}
