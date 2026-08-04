// SPDX-License-Identifier: MPL-2.0
/**
 * One CSS Color 4 colour value — the engine's single source of truth for
 * parsing, converting, gamut-mapping and serialising colour.
 *
 * The third sibling of units.ts (dimensions → what each format needs) and
 * color.ts (ICC profile bytes / press conditions): this one owns the *value*.
 * Before it, five parsers disagreed about what a colour is — the shells' export
 * walkers each carried a `rgba?(int,int,int)` regex commented "always rgb/rgba
 * from getComputedStyle", which CSS Color 4 makes false: only rgb()/rgba()/hsl()
 * are LEGACY and serialise as `rgb(…)`. lab(), lch(), oklab(), oklch(), hwb()
 * and color() serialise in their own space, so a computed `color-mix(in oklab,
 * …)` (used across the deck tools) or a raw `oklch()` brand token arrived as
 * null and its paint was silently dropped from SVG/PDF/EMF. See
 * plans/60-color-spaces.md §4.
 *
 * Shape follows linebender/color's `DynamicColor` (a CSS-Color-4-faithful Rust
 * crate — read as a design reference, not a dependency): a space tag, three
 * components in that space's own units, alpha, and a bitset of components that
 * were written `none`. Keeping "missing" distinct from zero is what lets CSS's
 * interpolation rule ("a missing hue adopts the other side's hue") stay
 * expressible instead of silently meaning 0deg.
 *
 * Conversion hubs on XYZ D65. Oklab routes through linear sRGB rather than
 * carrying its own XYZ matrices, because brand-derive.ts already owns Ottosson's
 * reference matrices and linear-sRGB ↔ XYZ-D65 is exact — one set of magic
 * numbers instead of two. The gamut-map search is brand-derive's too
 * (`gamutMapOklch`), shared with `oklchToHex`.
 *
 * Pure and deterministic: no DOM, no Date, no Math.random, no IO. Every entry
 * point returns null (never throws) on unreadable input — this parses values
 * from untrusted imported documents, and a caller that gets null must be able to
 * treat it as "no colour" rather than crash a render.
 */

import {
  parseHex, parseComponentToken, parseHueToken, parseAlphaToken,
  linearSrgbToOklab, oklabToLinearSrgb, gamutMapOklch, GAMUT_EPSILON,
} from './brand-derive.ts';

// ─── The value ────────────────────────────────────────────────────────────────

/**
 * A CSS Color 4 colour space. The predefined-RGB spaces plus the polar/opponent
 * ones and the two XYZ whites — i.e. everything `color()` and the colour
 * functions can name, minus the ACES spaces (no format we emit can carry them).
 */
export type ColorSpaceTag =
  | 'srgb' | 'srgb-linear' | 'display-p3' | 'a98-rgb' | 'prophoto-rgb' | 'rec2020'
  | 'hsl' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'xyz-d50' | 'xyz-d65';

/** Bit flags for `CssColor.missing` — a component authored as the `none` keyword. */
export const MISSING_C0 = 1 << 0;
export const MISSING_C1 = 1 << 1;
export const MISSING_C2 = 1 << 2;
export const MISSING_ALPHA = 1 << 3;

/**
 * A parsed colour. `components` are in the space's own canonical units:
 *
 * | space | c0 | c1 | c2 |
 * |---|---|---|---|
 * | srgb, srgb-linear, display-p3, a98-rgb, prophoto-rgb, rec2020 | r 0–1 | g 0–1 | b 0–1 |
 * | hsl | hue deg | sat 0–100 | light 0–100 |
 * | hwb | hue deg | white 0–100 | black 0–100 |
 * | lab | L 0–100 | a | b |
 * | lch | L 0–100 | C | hue deg |
 * | oklab | L 0–1 | a | b |
 * | oklch | L 0–1 | C | hue deg |
 * | xyz-d50, xyz-d65 | X | Y | Z |
 *
 * RGB components are NOT clamped — an out-of-gamut `color(display-p3 1 0 0)`
 * keeps its real coordinates so a wide-gamut format can carry them, and only
 * flattens when a caller asks for sRGB bytes.
 */
export interface CssColor {
  space: ColorSpaceTag;
  components: [number, number, number];
  alpha: number;
  /** Bitset of MISSING_* flags: components authored as `none`. */
  missing: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const normHue = (h: number): number => ((h % 360) + 360) % 360;

type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
const apply3 = (m: Mat3, v: readonly [number, number, number]): [number, number, number] => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

// ─── Named colours ────────────────────────────────────────────────────────────

/**
 * The CSS3 extended named colours as 24-bit sRGB ints. THE table — previously
 * three (a 148-entry copy in the shell's PDF walker, a 12-entry one in the EMF
 * walker, and a name-only membership Set in svg-colors.ts kept in sync by
 * comment). `transparent` is deliberately absent: it is a keyword the parser
 * handles, not a named colour.
 */
export const NAMED_COLORS: Readonly<Record<string, number>> = {
  aliceblue: 0xf0f8ff, antiquewhite: 0xfaebd7, aqua: 0x00ffff, aquamarine: 0x7fffd4,
  azure: 0xf0ffff, beige: 0xf5f5dc, bisque: 0xffe4c4, black: 0x000000,
  blanchedalmond: 0xffebcd, blue: 0x0000ff, blueviolet: 0x8a2be2, brown: 0xa52a2a,
  burlywood: 0xdeb887, cadetblue: 0x5f9ea0, chartreuse: 0x7fff00, chocolate: 0xd2691e,
  coral: 0xff7f50, cornflowerblue: 0x6495ed, cornsilk: 0xfff8dc, crimson: 0xdc143c,
  cyan: 0x00ffff, darkblue: 0x00008b, darkcyan: 0x008b8b, darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9, darkgreen: 0x006400, darkgrey: 0xa9a9a9, darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b, darkolivegreen: 0x556b2f, darkorange: 0xff8c00, darkorchid: 0x9932cc,
  darkred: 0x8b0000, darksalmon: 0xe9967a, darkseagreen: 0x8fbc8f, darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f, darkslategrey: 0x2f4f4f, darkturquoise: 0x00ced1, darkviolet: 0x9400d3,
  deeppink: 0xff1493, deepskyblue: 0x00bfff, dimgray: 0x696969, dimgrey: 0x696969,
  dodgerblue: 0x1e90ff, firebrick: 0xb22222, floralwhite: 0xfffaf0, forestgreen: 0x228b22,
  fuchsia: 0xff00ff, gainsboro: 0xdcdcdc, ghostwhite: 0xf8f8ff, gold: 0xffd700,
  goldenrod: 0xdaa520, gray: 0x808080, green: 0x008000, greenyellow: 0xadff2f,
  grey: 0x808080, honeydew: 0xf0fff0, hotpink: 0xff69b4, indianred: 0xcd5c5c,
  indigo: 0x4b0082, ivory: 0xfffff0, khaki: 0xf0e68c, lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5, lawngreen: 0x7cfc00, lemonchiffon: 0xfffacd, lightblue: 0xadd8e6,
  lightcoral: 0xf08080, lightcyan: 0xe0ffff, lightgoldenrodyellow: 0xfafad2, lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90, lightgrey: 0xd3d3d3, lightpink: 0xffb6c1, lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa, lightskyblue: 0x87cefa, lightslategray: 0x778899, lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de, lightyellow: 0xffffe0, lime: 0x00ff00, limegreen: 0x32cd32,
  linen: 0xfaf0e6, magenta: 0xff00ff, maroon: 0x800000, mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd, mediumorchid: 0xba55d3, mediumpurple: 0x9370db, mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee, mediumspringgreen: 0x00fa9a, mediumturquoise: 0x48d1cc, mediumvioletred: 0xc71585,
  midnightblue: 0x191970, mintcream: 0xf5fffa, mistyrose: 0xffe4e1, moccasin: 0xffe4b5,
  navajowhite: 0xffdead, navy: 0x000080, oldlace: 0xfdf5e6, olive: 0x808000,
  olivedrab: 0x6b8e23, orange: 0xffa500, orangered: 0xff4500, orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa, palegreen: 0x98fb98, paleturquoise: 0xafeeee, palevioletred: 0xdb7093,
  papayawhip: 0xffefd5, peachpuff: 0xffdab9, peru: 0xcd853f, pink: 0xffc0cb,
  plum: 0xdda0dd, powderblue: 0xb0e0e6, purple: 0x800080, rebeccapurple: 0x663399,
  red: 0xff0000, rosybrown: 0xbc8f8f, royalblue: 0x4169e1, saddlebrown: 0x8b4513,
  salmon: 0xfa8072, sandybrown: 0xf4a460, seagreen: 0x2e8b57, seashell: 0xfff5ee,
  sienna: 0xa0522d, silver: 0xc0c0c0, skyblue: 0x87ceeb, slateblue: 0x6a5acd,
  slategray: 0x708090, slategrey: 0x708090, snow: 0xfffafa, springgreen: 0x00ff7f,
  steelblue: 0x4682b4, tan: 0xd2b48c, teal: 0x008080, thistle: 0xd8bfd8,
  tomato: 0xff6347, turquoise: 0x40e0d0, violet: 0xee82ee, wheat: 0xf5deb3,
  white: 0xffffff, whitesmoke: 0xf5f5f5, yellow: 0xffff00, yellowgreen: 0x9acd32,
};

/** Is `name` a real CSS named colour? (Case-insensitive; own-property safe.) */
export function isNamedColor(name: string): boolean {
  return Object.hasOwn(NAMED_COLORS, String(name).toLowerCase());
}

// ─── Transfer functions ───────────────────────────────────────────────────────

// sRGB / Display-P3 share one transfer function (they differ only in primaries).
//
// These are SIGN-PRESERVING, unlike brand-derive's pair: a wide-gamut colour has
// genuinely negative sRGB components (P3 red is [1.0931, -0.2267, -0.1501]) and
// they must survive the encode so the gamut mapper can see how far out the colour
// is. brand-derive's plain versions are correct for its own in-gamut work, so the
// two deliberately co-exist rather than one being "the" version.
const srgbToLinear = (c: number): number => {
  const s = Math.sign(c) || 1;
  const a = Math.abs(c);
  return a <= 0.04045 ? c / 12.92 : s * ((a + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (c: number): number => {
  const s = Math.sign(c) || 1;
  const a = Math.abs(c);
  return a <= 0.0031308 ? c * 12.92 : s * (1.055 * a ** (1 / 2.4) - 0.055);
};

// A98 RGB: a pure 563/256 gamma, sign-preserving.
const A98_GAMMA = 563 / 256;
const a98ToLinear = (c: number): number => (Math.sign(c) || 1) * Math.abs(c) ** A98_GAMMA;
const linearToA98 = (c: number): number => (Math.sign(c) || 1) * Math.abs(c) ** (1 / A98_GAMMA);

// ProPhoto RGB: 1.8 gamma with a linear toe below 16×(1/512).
const prophotoToLinear = (c: number): number => {
  const s = Math.sign(c) || 1;
  const a = Math.abs(c);
  return a <= 16 / 512 ? c / 16 : s * a ** 1.8;
};
const linearToProphoto = (c: number): number => {
  const s = Math.sign(c) || 1;
  const a = Math.abs(c);
  return a >= 1 / 512 ? s * a ** (1 / 1.8) : c * 16;
};

// Rec.2020: the 12-bit-system α/β constants.
const R2020_A = 1.09929682680944;
const R2020_B = 0.018053968510807;
const rec2020ToLinear = (c: number): number => {
  const s = Math.sign(c) || 1;
  const a = Math.abs(c);
  return a < R2020_B * 4.5 ? c / 4.5 : s * ((a + R2020_A - 1) / R2020_A) ** (1 / 0.45);
};
const linearToRec2020 = (c: number): number => {
  const s = Math.sign(c) || 1;
  const a = Math.abs(c);
  return a > R2020_B ? s * (R2020_A * a ** 0.45 - (R2020_A - 1)) : 4.5 * c;
};

// ─── Primary matrices (CSS Color 4 §17 reference values) ──────────────────────

const LIN_SRGB_TO_XYZ65: Mat3 = [
  0.41239079926595934, 0.357584339383878, 0.1804807884018343,
  0.21263900587151027, 0.715168678767756, 0.07219231536073371,
  0.01933081871559182, 0.11919477979462598, 0.9505321522496607,
];
const XYZ65_TO_LIN_SRGB: Mat3 = [
  3.2409699419045226, -1.537383177570094, -0.4986107602930034,
  -0.9692436362808796, 1.8759675015077202, 0.04155505740717559,
  0.05563007969699366, -0.20397695888897652, 1.0569715142428786,
];
const LIN_P3_TO_XYZ65: Mat3 = [
  0.4865709486482162, 0.26566769316909306, 0.1982172852343625,
  0.2289745640697488, 0.6917385218365064, 0.079286914093745,
  0.0, 0.04511338185890264, 1.043944368900976,
];
const XYZ65_TO_LIN_P3: Mat3 = [
  2.493496911941425, -0.9313836179191239, -0.40271078445071684,
  -0.8294889695615747, 1.7626640603183463, 0.023624685841943577,
  0.03584583024378447, -0.07617238926804182, 0.9568845240076872,
];
const LIN_A98_TO_XYZ65: Mat3 = [
  0.5766690429101305, 0.1855582379065463, 0.1882286462349947,
  0.29734497525053605, 0.6273635662554661, 0.07529145207977232,
  0.02703136138641234, 0.07068885253582723, 0.9913375368376388,
];
const XYZ65_TO_LIN_A98: Mat3 = [
  2.0415879038107465, -0.5650069742788596, -0.34473135077832956,
  -0.9692436362808795, 1.8759675015077202, 0.04155505740717557,
  0.013444280632031142, -0.11836239223101838, 1.0151749943912054,
];
const LIN_2020_TO_XYZ65: Mat3 = [
  0.6369580483012914, 0.14461690358620832, 0.1688809751641721,
  0.2627002120112671, 0.6779980715188708, 0.05930171646986196,
  0.0, 0.028072693049087428, 1.060985057710791,
];
const XYZ65_TO_LIN_2020: Mat3 = [
  1.716651187971268, -0.355670783776392, -0.25336628137366,
  -0.666684351832489, 1.616481236634939, 0.0157685458139111,
  0.017639857445311, -0.042770613257809, 0.942103121235474,
];
// ProPhoto's primaries are defined against D50, so its matrix pair lands in XYZ D50.
const LIN_PROPHOTO_TO_XYZ50: Mat3 = [
  0.7977604896723027, 0.13518583717574031, 0.0313493495815248,
  0.2880711282292934, 0.7118432178101014, 0.00008565396060525902,
  0.0, 0.0, 0.8251046025104601,
];
const XYZ50_TO_LIN_PROPHOTO: Mat3 = [
  1.3457989731028281, -0.25558010007997534, -0.05110628506753401,
  -0.5446224939028347, 1.5082327413132781, 0.02053603239147973,
  0.0, 0.0, 1.2119675456389454,
];
// Bradford chromatic adaptation between the two PCS whites.
const XYZ65_TO_XYZ50: Mat3 = [
  1.0479298208405488, 0.022946793341019088, -0.05019222954313557,
  0.029627815688159344, 0.990434484573249, -0.01707382502938514,
  -0.009243058152591178, 0.015055144896577895, 0.7518742899580008,
];
const XYZ50_TO_XYZ65: Mat3 = [
  0.9554734527042182, -0.023098536874261423, 0.0632593086610217,
  -0.028369706963208136, 1.0099954580058226, 0.021041398966943008,
  0.012314001688319899, -0.020507696433477912, 1.3303659366080753,
];

const D50_WHITE = [0.3457 / 0.3585, 1.0, (1.0 - 0.3457 - 0.3585) / 0.3585] as const;

// ─── CIELAB ↔ XYZ D50 ─────────────────────────────────────────────────────────

const LAB_K = 24389 / 27;
const LAB_E = 216 / 24389;

function labToXyz50(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const xr = fx ** 3 > LAB_E ? fx ** 3 : (116 * fx - 16) / LAB_K;
  const yr = L > LAB_K * LAB_E ? fy ** 3 : L / LAB_K;
  const zr = fz ** 3 > LAB_E ? fz ** 3 : (116 * fz - 16) / LAB_K;
  return [xr * D50_WHITE[0], yr * D50_WHITE[1], zr * D50_WHITE[2]];
}

function xyz50ToLab(X: number, Y: number, Z: number): [number, number, number] {
  const f = (t: number): number => (t > LAB_E ? Math.cbrt(t) : (LAB_K * t + 16) / 116);
  const fx = f(X / D50_WHITE[0]);
  const fy = f(Y / D50_WHITE[1]);
  const fz = f(Z / D50_WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// ─── Polar ↔ rectangular ──────────────────────────────────────────────────────

const polarToRect = (L: number, C: number, hDeg: number): [number, number, number] => {
  const hr = (hDeg * Math.PI) / 180;
  return [L, C * Math.cos(hr), C * Math.sin(hr)];
};
/**
 * Chroma below which a colour is achromatic and its hue is numerical noise rather
 * than a choice. Per-space, because the units differ by three orders of magnitude:
 * OKLCH chroma tops out around 0.4, LCH's around 150. A single absolute epsilon
 * sized for OKLab means grey is NEVER detected in Lab units — `#808080` converted
 * to `lch` reported hue 139°, and a white→blue LCH gradient swept through green.
 */
const ACHROMATIC_C: Readonly<Record<string, number>> = { oklch: 1e-4, lch: 0.02 };
const HSL_ACHROMATIC_S = 1e-4;   // hsl/hwb saturation, 0–100

const rectToPolar = (L: number, a: number, b: number, eps = 1e-7): [number, number, number] => {
  const C = Math.hypot(a, b);
  return [L, C, C < eps ? 0 : normHue((Math.atan2(b, a) * 180) / Math.PI)];
};

// ─── hsl / hwb ↔ srgb ─────────────────────────────────────────────────────────

function hslToSrgb(h: number, s: number, l: number): [number, number, number] {
  const hn = normHue(h) / 360;
  const sn = Math.max(0, Math.min(1, s / 100));
  const ln = Math.max(0, Math.min(1, l / 100));
  if (sn === 0) return [ln, ln, ln];
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const ch = (t: number): number => {
    const u = (t + 1) % 1;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [ch(hn + 1 / 3), ch(hn), ch(hn - 1 / 3)];
}

function srgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  // Epsilon, not `=== 0`: white round-tripped through XYZ comes back as
  // [1.0000000000000002, 0.9999999999999997, …], so an exact test misses it and the
  // "grey" would carry a garbage hue derived from 5e-16 of noise.
  if (d < 1e-9) return [0, 0, l * 100];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [normHue(h * 60), s * 100, l * 100];
}

function hwbToSrgb(h: number, w: number, blk: number): [number, number, number] {
  const wn = Math.max(0, Math.min(1, w / 100));
  const bn = Math.max(0, Math.min(1, blk / 100));
  if (wn + bn >= 1) {
    const grey = wn / (wn + bn);
    return [grey, grey, grey];
  }
  const rgb = hslToSrgb(h, 100, 50);
  const scale = 1 - wn - bn;
  return [rgb[0] * scale + wn, rgb[1] * scale + wn, rgb[2] * scale + wn] as [number, number, number];
}

function srgbToHwb(r: number, g: number, b: number): [number, number, number] {
  const [h] = srgbToHsl(r, g, b);
  return [h, Math.min(r, g, b) * 100, (1 - Math.max(r, g, b)) * 100];
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/** Any space → XYZ D65 (the conversion hub). */
function toXyzD65(c: CssColor): [number, number, number] {
  const [c0, c1, c2] = c.components;
  switch (c.space) {
    case 'xyz-d65': return [c0, c1, c2];
    case 'xyz-d50': return apply3(XYZ50_TO_XYZ65, [c0, c1, c2]);
    case 'srgb-linear': return apply3(LIN_SRGB_TO_XYZ65, [c0, c1, c2]);
    case 'srgb':
      return apply3(LIN_SRGB_TO_XYZ65, [srgbToLinear(c0), srgbToLinear(c1), srgbToLinear(c2)]);
    case 'display-p3':
      return apply3(LIN_P3_TO_XYZ65, [srgbToLinear(c0), srgbToLinear(c1), srgbToLinear(c2)]);
    case 'a98-rgb':
      return apply3(LIN_A98_TO_XYZ65, [a98ToLinear(c0), a98ToLinear(c1), a98ToLinear(c2)]);
    case 'rec2020':
      return apply3(LIN_2020_TO_XYZ65,
        [rec2020ToLinear(c0), rec2020ToLinear(c1), rec2020ToLinear(c2)]);
    case 'prophoto-rgb':
      return apply3(XYZ50_TO_XYZ65, apply3(LIN_PROPHOTO_TO_XYZ50,
        [prophotoToLinear(c0), prophotoToLinear(c1), prophotoToLinear(c2)]));
    case 'hsl':
      return apply3(LIN_SRGB_TO_XYZ65, hslToSrgb(c0, c1, c2).map(srgbToLinear) as [number, number, number]);
    case 'hwb':
      return apply3(LIN_SRGB_TO_XYZ65, hwbToSrgb(c0, c1, c2).map(srgbToLinear) as [number, number, number]);
    case 'lab':
      return apply3(XYZ50_TO_XYZ65, labToXyz50(c0, c1, c2));
    case 'lch':
      return apply3(XYZ50_TO_XYZ65, labToXyz50(...polarToRect(c0, c1, c2)));
    case 'oklab':
      return apply3(LIN_SRGB_TO_XYZ65, oklabToLinearSrgb(c0, c1, c2));
    case 'oklch':
      return apply3(LIN_SRGB_TO_XYZ65, oklabToLinearSrgb(...polarToRect(c0, c1, c2)));
  }
}

/** XYZ D65 → any space's components. */
function fromXyzD65(xyz: [number, number, number], space: ColorSpaceTag): [number, number, number] {
  switch (space) {
    case 'xyz-d65': return xyz;
    case 'xyz-d50': return apply3(XYZ65_TO_XYZ50, xyz);
    case 'srgb-linear': return apply3(XYZ65_TO_LIN_SRGB, xyz);
    case 'srgb': return apply3(XYZ65_TO_LIN_SRGB, xyz).map(linearToSrgb) as [number, number, number];
    case 'display-p3': return apply3(XYZ65_TO_LIN_P3, xyz).map(linearToSrgb) as [number, number, number];
    case 'a98-rgb': return apply3(XYZ65_TO_LIN_A98, xyz).map(linearToA98) as [number, number, number];
    case 'rec2020': return apply3(XYZ65_TO_LIN_2020, xyz).map(linearToRec2020) as [number, number, number];
    case 'prophoto-rgb':
      return apply3(XYZ50_TO_LIN_PROPHOTO, apply3(XYZ65_TO_XYZ50, xyz))
        .map(linearToProphoto) as [number, number, number];
    case 'hsl': return srgbToHsl(...(fromXyzD65(xyz, 'srgb')));
    case 'hwb': return srgbToHwb(...(fromXyzD65(xyz, 'srgb')));
    case 'lab': return xyz50ToLab(...apply3(XYZ65_TO_XYZ50, xyz));
    case 'lch': return rectToPolar(...xyz50ToLab(...apply3(XYZ65_TO_XYZ50, xyz)), ACHROMATIC_C.lch);
    case 'oklab': return linearSrgbToOklab(...apply3(XYZ65_TO_LIN_SRGB, xyz));
    case 'oklch': return rectToPolar(...linearSrgbToOklab(...apply3(XYZ65_TO_LIN_SRGB, xyz)), ACHROMATIC_C.oklch);
  }
}

/**
 * Convert to another colour space. Alpha rides along unchanged; `missing` is
 * dropped on any space change, because a component that was `none` in the source
 * space has no counterpart in the target (CSS Color 4 §4.4: missing components
 * behave as zero for conversion). A same-space call is the identity.
 */
export function convertColor(c: CssColor, to: ColorSpaceTag): CssColor {
  if (c.space === to) return c;
  const components = fromXyzD65(toXyzD65(c), to);
  return { space: to, components, alpha: c.alpha, missing: powerlessMissing(to, components) };
}

/**
 * The `missing` bits a freshly converted colour should carry (CSS Color 4 §4.4.1: a
 * component that has become POWERLESS is set to missing). In practice that is the hue
 * of an achromatic colour — grey has no hue, and pretending it has one is what makes
 * `linear-gradient(in oklch, white, green)` swing through pink and orange instead of
 * simply raising the green's chroma. §13.2 then carries the real hue from the other
 * side of the interpolation, which is exactly the behaviour a browser shows.
 */
function powerlessMissing(space: ColorSpaceTag, c: readonly [number, number, number]): number {
  if (space === 'oklch' || space === 'lch') {
    return c[1] < (ACHROMATIC_C[space] ?? 1e-4) ? MISSING_C2 : 0;
  }
  if (space === 'hsl') return c[1] < HSL_ACHROMATIC_S ? MISSING_C0 : 0;
  // hwb is achromatic when white + black cover the whole colour (the grey case its
  // own conversion already collapses).
  if (space === 'hwb') return c[1] + c[2] >= 100 - HSL_ACHROMATIC_S ? MISSING_C0 : 0;
  return 0;
}

// ─── Interpolation (CSS Color 4 §12–13) ───────────────────────────────────────

/** How to travel around the hue circle between two polar colours (§13.4). */
export type HueDirection = 'shorter' | 'longer' | 'increasing' | 'decreasing';

export interface MixOptions {
  /** Interpolation space. Default `oklab` — perceptually even, and the space
   *  `color-mix()` uses when none is named. Pass `srgb` to model what a plain CSS
   *  gradient or an SVG `<linearGradient>` actually does. */
  space?: ColorSpaceTag;
  /** Hue travel for a polar space. Default `shorter`. */
  hue?: HueDirection;
}

// Which component is the hue angle, per space — the one component that must NOT
// be premultiplied and must be lerped as an angle.
const HUE_INDEX: Partial<Record<ColorSpaceTag, number>> = {
  hsl: 0, hwb: 0, lch: 2, oklch: 2,
};

// §13.4 hue fixup: rewrite the two angles so a plain lerp between them travels
// the requested way round the circle.
function fixupHues(ha: number, hb: number, dir: HueDirection): [number, number] {
  let a = normHue(ha);
  let b = normHue(hb);
  const d = b - a;
  switch (dir) {
    case 'longer':
      if (d > 0 && d < 180) b -= 360;
      else if (d > -180 && d <= 0) b += 360;
      break;
    case 'increasing':
      if (b < a) b += 360;
      break;
    case 'decreasing':
      if (a < b) a += 360;
      break;
    default: // shorter
      if (d > 180) b -= 360;
      else if (d < -180) b += 360;
  }
  return [a, b];
}

/**
 * Fill in `c`'s missing components from `other` (§13.2 — "a missing hue adopts the
 * other side's hue"). BOTH are already in the interpolation space, which is the
 * only order that works: the components have to be analogous for the carry to mean
 * anything, and the missing bit that matters most is usually one `convertColor`
 * *produced* — an achromatic colour's hue is powerless (§4.4.1), so a white or grey
 * endpoint has no hue of its own to sweep from.
 *
 * Carrying before converting (the first cut here) made both cases dead: an authored
 * `none` was consumed in the source space, and a powerless hue had not been marked
 * yet. `linear-gradient(in oklch, white, #30ba78)` then swept hue 0→155 and came out
 * pink → tan → olive instead of simply raising the green's chroma.
 */
function carryMissing(c: CssColor, other: CssColor): CssColor {
  if (c.missing === 0) return c;
  const comps: [number, number, number] = [...c.components];
  for (let i = 0; i < 3; i++) {
    if ((c.missing & (1 << i)) !== 0) comps[i] = other.components[i]!;
  }
  const alpha = (c.missing & MISSING_ALPHA) !== 0 ? other.alpha : c.alpha;
  return { space: c.space, components: comps, alpha, missing: 0 };
}

/**
 * Interpolate between two colours at `t` (0 = `a`, 1 = `b`, clamped), the way CSS
 * Color 4 specifies: in the chosen space, with **premultiplied alpha**, and hue
 * travelled per `opts.hue`.
 *
 * The premultiplication is the part that is easy to skip and visibly wrong when
 * you do. `red` → `transparent` unpremultiplied lerps the colour toward
 * transparent's *black* while the alpha falls, so the midpoint is a dark red at
 * 50% — the classic muddy fringe. Premultiplied, the midpoint is plain red at
 * 50%, which is what every browser draws.
 *
 * Alpha itself is linear in `t` regardless of space. When both ends are fully
 * transparent there is nothing to divide back out, so the components fall back to
 * a plain lerp rather than becoming NaN.
 */
export function interpolateColor(a: CssColor, b: CssColor, t: number, opts: MixOptions = {}): CssColor {
  const space = opts.space ?? 'oklab';
  // Convert first (which marks any powerless component), then carry across.
  const a0 = convertColor(a, space);
  const b0 = convertColor(b, space);
  const A = carryMissing(a0, b0);
  const B = carryMissing(b0, a0);
  const hi = HUE_INDEX[space];
  const ca: [number, number, number] = [...A.components];
  const cb: [number, number, number] = [...B.components];
  if (hi != null) {
    const [ha, hb] = fixupHues(ca[hi]!, cb[hi]!, opts.hue ?? 'shorter');
    ca[hi] = ha;
    cb[hi] = hb;
  }

  const k = clamp01(t);
  const lerp = (x: number, y: number): number => x + (y - x) * k;
  const alpha = lerp(A.alpha, B.alpha);
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (i === hi) {
      out[i] = normHue(lerp(ca[i]!, cb[i]!));
    } else if (alpha > 0) {
      out[i] = lerp(ca[i]! * A.alpha, cb[i]! * B.alpha) / alpha;
    } else {
      out[i] = lerp(ca[i]!, cb[i]!);
    }
  }
  return { space, components: out, alpha, missing: 0 };
}

/** ΔEOK between two colours — the perceptual distance §14.2 and §20.2 use. */
export function deltaEOkColor(a: CssColor, b: CssColor): number {
  const la = convertColor(a, 'oklab').components;
  const lb = convertColor(b, 'oklab').components;
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

// ─── Baking a curved gradient into stops a flat renderer draws correctly ──────

/** One gradient stop: a colour at a position in percent (0–100). */
export interface ColorStop {
  color: CssColor;
  pos: number;
}

export interface BakeOptions extends MixOptions {
  /** Max ΔEOK a baked segment may deviate from the true curve. Default 0.01 —
   *  half a JND, i.e. invisible. */
  tolerance?: number;
  /**
   * Recursion cap per input segment. Default 6, which is where the measurement
   * lands: across oklab/oklch/lab/lch/hsl and the hardest pairs (black→white,
   * blue→yellow, navy→gold, translucent ends), depth 6 holds the worst error at
   * 0.012 ΔEOK — under a JND — while emitting at most 15 stops per segment. Depth
   * 7 buys 0.0008 for another stop, so this is the knee, not a round number.
   */
  maxDepth?: number;
}

/**
 * Approximate a gradient interpolated in `opts.space` with stops that a renderer
 * interpolating in **sRGB** draws indistinguishably — by inserting intermediate
 * stops only where the two disagree.
 *
 * This is what makes a smooth gradient portable. CSS `linear-gradient(in oklab,
 * …)` exists, but an SVG `<linearGradient>` and a PDF axial shading have no
 * interpolation-space knob at all: they lerp sRGB, full stop. Baking means one
 * stop list renders the same on screen, in SVG, and in PDF — and none of the
 * export walkers need to learn a new syntax.
 *
 * Subdivision is adaptive: nearly-flat segments (grey → grey) emit nothing extra;
 * a hue-crossing pair (blue → yellow, which sRGB drags through grey) emits
 * several.
 *
 * Every sample is taken from the ORIGINAL segment endpoints at an absolute `t`,
 * never by recursing on the midpoints it just produced. That matters for the hue
 * directions: `longer` applied again to a half-segment would take the long way
 * round *that* half, and the "gradient" would oscillate through the whole wheel
 * once per subdivision. Anchoring on the endpoints applies the direction exactly
 * once, as authored.
 *
 * Input stops are used verbatim as segment endpoints, in the order given.
 */
export function gradientStops(stops: readonly ColorStop[], opts: BakeOptions = {}): ColorStop[] {
  if (stops.length === 0) return [];
  const tolerance = Number.isFinite(opts.tolerance) ? Math.max(0, opts.tolerance!) : 0.01;
  const maxDepth = Number.isFinite(opts.maxDepth) ? Math.max(0, Math.floor(opts.maxDepth!)) : 6;
  const mix: MixOptions = { space: opts.space ?? 'oklab', hue: opts.hue };

  const out: ColorStop[] = [stops[0]!];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    refineSegment(a, b, a.color, b.color, 0, 1, mix, tolerance, maxDepth, out);
    out.push(b);
  }
  return out;
}

// Where inside a span the curve is probed against what the renderer would paint.
// The midpoint alone is NOT enough: CIELAB black→white passes a midpoint check
// (Lab's L=50 lands near sRGB's #777) while being ~0.023 ΔEOK off at 5% — its toe
// is where the two curves actually diverge. Three probes bound the error properly
// for a handful of extra conversions per segment.
const PROBES = [0.25, 0.5, 0.75] as const;

/**
 * Emit whatever intermediate stops the span (t0…t1) of the segment `a`→`b` needs.
 * `ca`/`cb` are the colours already emitted at those two ends — the pair a flat
 * renderer will actually interpolate between — while the intended colours come
 * from `a`/`b` at absolute positions inside the span.
 */
function refineSegment(
  a: ColorStop, b: ColorStop, ca: CssColor, cb: CssColor,
  t0: number, t1: number,
  mix: MixOptions, tol: number, depth: number, out: ColorStop[],
): void {
  if (depth <= 0 || b.pos <= a.pos) return;
  let worst = 0;
  for (const p of PROBES) {
    const curve = interpolateColor(a.color, b.color, t0 + (t1 - t0) * p, mix);
    const flat = interpolateColor(ca, cb, p, { space: 'srgb' });
    worst = Math.max(worst, deltaEOkColor(curve, flat));
    if (worst > tol) break;
  }
  if (worst <= tol) return;

  const tm = (t0 + t1) / 2;
  const curve = interpolateColor(a.color, b.color, tm, mix);
  const mid: ColorStop = { color: curve, pos: a.pos + (b.pos - a.pos) * tm };
  refineSegment(a, b, ca, curve, t0, tm, mix, tol, depth - 1, out);
  out.push(mid);
  refineSegment(a, b, curve, cb, tm, t1, mix, tol, depth - 1, out);
}

// ─── Gamut mapping ────────────────────────────────────────────────────────────

const inSrgb = (rgb: readonly [number, number, number]): boolean =>
  rgb.every(v => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON);

/**
 * Map an sRGB triple into gamut per CSS Color 4 §14.2 (chroma bisection with a
 * local-MINDE clip check). An in-gamut input is returned untouched.
 *
 * The search itself lives in brand-derive.ts#gamutMapOklch — THE engine's one
 * mapper, shared with `oklchToHex`, so a brand token and an exported paint can
 * never disagree about what an out-of-gamut colour becomes. This wrapper only
 * moves an encoded sRGB triple into OKLCH first.
 */
export function gamutMapSrgb(rgb: readonly [number, number, number]): [number, number, number] {
  if (inSrgb(rgb)) return [rgb[0], rgb[1], rgb[2]];
  const [L, C, h] = rectToPolar(
    ...linearSrgbToOklab(srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])),
  );
  return gamutMapOklch(L, C, h);
}

// ─── Output ───────────────────────────────────────────────────────────────────

/**
 * The colour as sRGB components 0–1, gamut-mapped when it started outside sRGB.
 * This is the honest flatten: everything a format can't express perceptually
 * mapped rather than channel-clipped.
 */
export function colorToSrgb(c: CssColor): [number, number, number] {
  return gamutMapSrgb(convertColor(c, 'srgb').components);
}

/** The colour as sRGB bytes plus alpha 0–1 — what the export walkers consume. */
export function colorToSrgb8(c: CssColor): [number, number, number, number] {
  const [r, g, b] = colorToSrgb(c);
  const byte = (v: number): number => Math.round(clamp01(v) * 255);
  return [byte(r), byte(g), byte(b), clamp01(c.alpha)];
}

// toFixed then strip trailing zeros: 62.00 → "62", 0.1100 → "0.11". The `+ 0`
// normalises a negative zero, so a rounded-to-nothing component reads "0".
const fmtNum = (n: number, dp: number): string =>
  (Number(n.toFixed(dp)) + 0).toFixed(dp).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** `#rrggbb` (or `#rrggbbaa` when translucent), gamut-mapped. */
export function colorToHexString(c: CssColor): string {
  const [r, g, b, a] = colorToSrgb8(c);
  const h = (n: number): string => n.toString(16).padStart(2, '0');
  const base = `#${h(r)}${h(g)}${h(b)}`;
  return a >= 1 ? base : base + h(Math.round(a * 255));
}

const RGB_SPACES = new Set<ColorSpaceTag>([
  'srgb', 'srgb-linear', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020',
  'xyz-d50', 'xyz-d65',
]);

/**
 * Serialise back to a CSS Color 4 string, in the colour's OWN space — so a
 * wide-gamut value can be written into an SVG paint rather than flattened at the
 * door. Predefined-RGB and XYZ spaces serialise as `color(<space> …)`; the
 * others use their own function. Components authored as `none` are preserved as
 * `none`, per CSS Color 4 §4.4.
 */
export function formatColor(c: CssColor): string {
  const [c0, c1, c2] = c.components;
  const tok = (v: number, flag: number, dp: number): string =>
    (c.missing & flag) !== 0 ? 'none' : fmtNum(v, dp);
  // A `none` component carries no unit — `none%` is not valid CSS.
  const pct = (v: number, flag: number, dp: number): string =>
    (c.missing & flag) !== 0 ? 'none' : `${fmtNum(v, dp)}%`;
  const alpha = (c.missing & MISSING_ALPHA) !== 0 ? ' / none'
    : c.alpha < 1 ? ` / ${fmtNum(clamp01(c.alpha), 4)}`
    : '';

  if (RGB_SPACES.has(c.space)) {
    const dp = 6;
    return `color(${c.space} ${tok(c0, MISSING_C0, dp)} ${tok(c1, MISSING_C1, dp)} ${tok(c2, MISSING_C2, dp)}${alpha})`;
  }
  switch (c.space) {
    case 'hsl':
      return `hsl(${tok(c0, MISSING_C0, 2)} ${pct(c1, MISSING_C1, 2)} ${pct(c2, MISSING_C2, 2)}${alpha})`;
    case 'hwb':
      return `hwb(${tok(c0, MISSING_C0, 2)} ${pct(c1, MISSING_C1, 2)} ${pct(c2, MISSING_C2, 2)}${alpha})`;
    case 'lab':
      return `lab(${pct(c0, MISSING_C0, 3)} ${tok(c1, MISSING_C1, 3)} ${tok(c2, MISSING_C2, 3)}${alpha})`;
    case 'lch':
      return `lch(${pct(c0, MISSING_C0, 3)} ${tok(c1, MISSING_C1, 3)} ${tok(c2, MISSING_C2, 2)}${alpha})`;
    case 'oklab':
      return `oklab(${pct(c0 * 100, MISSING_C0, 3)} ${tok(c1, MISSING_C1, 5)} ${tok(c2, MISSING_C2, 5)}${alpha})`;
    default: // oklch
      return `oklch(${pct(c0 * 100, MISSING_C0, 3)} ${tok(c1, MISSING_C1, 5)} ${tok(c2, MISSING_C2, 2)}${alpha})`;
  }
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

// `color()`'s predefined space idents → our tags. `srgb-linear` and the two xyz
// aliases included; the ACES spaces are deliberately unsupported (no format we
// emit can carry them, and silently flattening them would be dishonest).
const COLOR_FN_SPACES: Readonly<Record<string, ColorSpaceTag>> = {
  srgb: 'srgb', 'srgb-linear': 'srgb-linear', 'display-p3': 'display-p3',
  'a98-rgb': 'a98-rgb', 'prophoto-rgb': 'prophoto-rgb', rec2020: 'rec2020',
  xyz: 'xyz-d65', 'xyz-d50': 'xyz-d50', 'xyz-d65': 'xyz-d65',
};

// Split a function's argument text into the component tokens and the optional
// slash-alpha. Legacy syntax is comma-separated, modern is whitespace-separated;
// CSS forbids mixing, and so do we — a comma anywhere means every separator must
// be a comma, which is what keeps `rgb(1 2, 3)` from parsing.
function splitArgs(inner: string): { parts: string[]; alpha: string | null } | null {
  const slash = inner.split('/');
  if (slash.length > 2) return null;
  const head = slash[0]!.trim();
  const alpha = slash.length === 2 ? slash[1]!.trim() : null;
  if (head.length === 0) return null;
  if (head.includes(',')) {
    if (alpha != null) return null;                 // legacy commas + slash-alpha: not a thing
    const parts = head.split(',').map(s => s.trim());
    return parts.some(p => p.length === 0 || /\s/.test(p)) ? null : { parts, alpha: null };
  }
  return { parts: head.split(/\s+/), alpha };
}

// A component that may be a number or a percentage of `pctRef`, tracking `none`.
function comp(tok: string, pctRef: number): { v: number; none: boolean } | null {
  const c = parseComponentToken(tok);
  if (!c) return null;
  return { v: c.pct ? (c.n / 100) * pctRef : c.n, none: c.none };
}

function alphaOf(tok: string | null): { v: number; none: boolean } | null {
  if (tok == null) return { v: 1, none: false };
  if (tok.toLowerCase() === 'none') return { v: 0, none: true };
  const a = parseAlphaToken(tok);
  return a == null ? null : { v: a, none: false };
}

function build(
  space: ColorSpaceTag,
  c: ReadonlyArray<{ v: number; none: boolean } | null>,
  a: { v: number; none: boolean } | null,
): CssColor | null {
  if (a == null || c.length !== 3 || c.some(x => x == null)) return null;
  const [c0, c1, c2] = c as [{ v: number; none: boolean }, { v: number; none: boolean }, { v: number; none: boolean }];
  return {
    space,
    components: [c0.v, c1.v, c2.v],
    alpha: a.v,
    missing:
      (c0.none ? MISSING_C0 : 0) | (c1.none ? MISSING_C1 : 0) |
      (c2.none ? MISSING_C2 : 0) | (a.none ? MISSING_ALPHA : 0),
  };
}

/**
 * Parse any CSS Color 4 colour string into a `CssColor`, or null.
 *
 * Accepts: `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`; legacy and modern
 * `rgb()`/`rgba()`/`hsl()`/`hsla()`; `hwb()`, `lab()`, `lch()`, `oklab()`,
 * `oklch()`; `color(<predefined-space> …)`; the CSS3 named colours;
 * `transparent`. Both the comma and the whitespace+slash forms, `none`
 * components, and percentages wherever CSS allows them.
 *
 * Returns null for `currentColor` (its value depends on inherited state the
 * engine can't see — callers resolve it upstream), for `none`/`inherit`/other
 * non-paint keywords, for `color-mix()`/relative syntax (`from`) which a browser
 * has already resolved by the time we read a computed value, and for anything
 * malformed. Null NEVER means "black" — it means "no colour", and callers must
 * treat it that way.
 */
export function parseColor(input: string | null | undefined): CssColor | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (s.length === 0) return null;
  const lower = s.toLowerCase();

  if (lower === 'transparent') {
    return { space: 'srgb', components: [0, 0, 0], alpha: 0, missing: 0 };
  }
  if (s.startsWith('#')) {
    const rgba = parseHex(s);
    return rgba
      ? { space: 'srgb', components: [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255], alpha: rgba[3], missing: 0 }
      : null;
  }

  const fn = /^([a-z][a-z0-9-]*)\(([^()]*)\)$/i.exec(s);
  if (!fn) {
    const named = Object.hasOwn(NAMED_COLORS, lower) ? NAMED_COLORS[lower]! : null;
    return named == null ? null : {
      space: 'srgb',
      components: [((named >> 16) & 255) / 255, ((named >> 8) & 255) / 255, (named & 255) / 255],
      alpha: 1,
      missing: 0,
    };
  }

  const name = fn[1]!.toLowerCase();
  const args = splitArgs(fn[2]!);
  if (!args) return null;
  const { parts } = args;

  // `color()` first: it takes a space ident PLUS three components, so it is the
  // one form whose argument count isn't three.
  if (name === 'color') {
    const spaceTok = parts[0]!.toLowerCase();
    const space = Object.hasOwn(COLOR_FN_SPACES, spaceTok) ? COLOR_FN_SPACES[spaceTok]! : null;
    if (!space || parts.length !== 4) return null;
    const ch = (t: string) => comp(t, 1); // percentages are of 1.0 in color()
    return build(space, [ch(parts[1]!), ch(parts[2]!), ch(parts[3]!)], alphaOf(args.alpha));
  }

  // Legacy rgb()/rgba()/hsl()/hsla() carry alpha as a 4th comma-separated arg.
  let alphaTok = args.alpha;
  if (parts.length === 4 && alphaTok == null &&
      (name === 'rgb' || name === 'rgba' || name === 'hsl' || name === 'hsla')) {
    alphaTok = parts.pop()!;
  }
  if (parts.length !== 3) return null;
  const a = alphaOf(alphaTok);

  switch (name) {
    case 'rgb':
    case 'rgba': {
      // Components are 0–255 or percentages of it; stored as 0–1. CSS allows
      // mixing numbers and percentages in the modern form.
      const ch = (t: string) => {
        const c = parseComponentToken(t);
        return c ? { v: (c.pct ? (c.n / 100) * 255 : c.n) / 255, none: c.none } : null;
      };
      return build('srgb', [ch(parts[0]!), ch(parts[1]!), ch(parts[2]!)], a);
    }
    case 'hsl':
    case 'hsla': {
      const h = hueComp(parts[0]!);
      return build('hsl', [h, comp(parts[1]!, 100), comp(parts[2]!, 100)], a);
    }
    case 'hwb':
      return build('hwb', [hueComp(parts[0]!), comp(parts[1]!, 100), comp(parts[2]!, 100)], a);
    case 'lab':
      // L is 0–100 (percent and bare share the scale); a/b percentages are ±125.
      return build('lab', [comp(parts[0]!, 100), comp(parts[1]!, 125), comp(parts[2]!, 125)], a);
    case 'lch':
      // C 100% = 150 (CSS Color 4 §7.2).
      return build('lch', [comp(parts[0]!, 100), comp(parts[1]!, 150), hueComp(parts[2]!)], a);
    case 'oklab':
      // L is 0–1 (100% = 1); a/b percentages are ±0.4.
      return build('oklab', [comp(parts[0]!, 1), comp(parts[1]!, 0.4), comp(parts[2]!, 0.4)], a);
    case 'oklch':
      // C 100% = 0.4 (CSS Color 4 §7.3).
      return build('oklch', [comp(parts[0]!, 1), comp(parts[1]!, 0.4), hueComp(parts[2]!)], a);
    default:
      return null;
  }
}

// A hue token as a component record (hue has no percentage form).
function hueComp(tok: string): { v: number; none: boolean } | null {
  if (tok.toLowerCase() === 'none') return { v: 0, none: true };
  const h = parseHueToken(tok);
  return h == null ? null : { v: h, none: false };
}

// ─── Finding a colour inside a shorthand ──────────────────────────────────────

// Every colour FUNCTION name, for pulling a colour out of a shorthand value.
// `[^)]*` is deliberate: a computed colour never nests parens, and a greedy
// nested-paren match would swallow the rest of a `box-shadow` list.
const COLOR_FN = 'rgba?|hsla?|hwb|lab|lch|oklab|oklch|color';
const COLOR_TOKEN = new RegExp(`(?:${COLOR_FN})\\([^)]*\\)|#[0-9a-fA-F]{3,8}`, 'i');
const COLOR_TOKEN_OR_IDENT = new RegExp(`(?:${COLOR_FN})\\([^)]*\\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+`, 'i');

/**
 * The colour substring inside a shorthand value (`box-shadow`, `text-shadow`,
 * `drop-shadow()`), or null. Callers strip the returned substring before reading
 * the numeric parts — which is why this has to know every colour function name:
 * an unrecognised `oklch(0.7 0.1 200)` doesn't merely lose its colour, it leaves
 * `0.7 0.1 200` behind to be misread as the offsets.
 *
 * `allowBareIdent` also matches a bare word (a named colour); the caller must
 * strip other keywords (`inset`) first, or the keyword matches instead.
 */
export function findColorToken(text: string, allowBareIdent = false): string | null {
  const m = (allowBareIdent ? COLOR_TOKEN_OR_IDENT : COLOR_TOKEN).exec(String(text));
  return m ? m[0] : null;
}

// ─── Convenience for the export walkers ───────────────────────────────────────

/**
 * Parse straight to sRGB bytes + alpha — the one call the SVG/PDF/EMF walkers
 * want. Null for unparseable input AND for fully transparent colour (every
 * caller treats "alpha 0" as "nothing to paint", so collapsing the two here
 * keeps their `if (rgb)` guards correct).
 */
export function parseColorToSrgb8(input: string | null | undefined): [number, number, number, number] | null {
  const c = parseColor(input);
  if (!c || c.alpha <= 0) return null;
  return colorToSrgb8(c);
}
