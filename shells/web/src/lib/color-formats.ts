// SPDX-License-Identifier: MPL-2.0
/**
 * Colour-format bridge - read and write one colour in Hex / RGB / RGBA / OKLCH /
 * CMYK, always round-tripping through a canonical sRGB hex.
 *
 * The brand editor's swatch popover lets a user set a swatch from ANY of these
 * spaces and extrapolates the rest (Andy: "set the CMYK, Hex, RGBA or LCH values
 * … and extrapolate the RGB or hex"). Everything funnels to a `#rrggbb`(`aa`)
 * hex, which is what the DTCG doc stores and every picker/export already reads.
 *
 * "LCH" in this app means OKLCH - the perceptual space the tokens, the wizard and
 * the colour field all speak (brand.json `$value`s are `oklch()` strings). All
 * conversions defer to the engine's colour authority (rgbToCmyk / cmykToRgbApprox
 * / hexToOklch / oklchToHex / colorToHex); this module only parses/formats the
 * human-facing text around them. Pure + DOM-free → unit-tested (color-formats.test.ts).
 */

import { colorToHex, rgbToCmyk, cmykToRgbApprox, hexToOklch, oklchToHex, formatOklch } from '@lolly/engine';
import { clamp } from '@lolly/engine';

export type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'oklch' | 'cmyk';

/**
 * How a swatch's `$value` is WRITTEN into the tokens document - distinct from
 * ColorFormat (the popover's set-by-value text row). `lch` (= OKLCH, the app's
 * perceptual default and what derived brands ship) unless the swatch already
 * carries another notation the user chose. CMYK is deliberately absent: the
 * engine can't parse it in `$value`, so a CMYK-entered colour stores its sRGB
 * form here and pins the exact inks as a print substitute instead.
 */
export type StorageFormat = 'lch' | 'hex' | 'rgb' | 'hsl';

export const STORAGE_FORMATS: ReadonlyArray<{ id: StorageFormat; label: string }> = [
  { id: 'lch', label: 'LCH' },
  { id: 'hex', label: 'Hex' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsl', label: 'HSL' },
];

export interface Rgba { r: number; g: number; b: number; a: number }
const h2 = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
/** All the numbers in a string, in order (tolerant of commas/labels/parens/%). */
const nums = (s: string): number[] => (s.match(/-?\d*\.?\d+/g) ?? []).map(Number).filter(n => !Number.isNaN(n));

/** #rgb / #rgba / #rrggbb / #rrggbbaa (with or without the leading #) → channels. */
export function hexToRgba(hex: string): Rgba | null {
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

/** Channels → `#rrggbb`, or `#rrggbbaa` when `a < 1`. */
export function rgbaToHex(r: number, g: number, b: number, a = 1): string {
  const base = `#${h2(r)}${h2(g)}${h2(b)}`;
  return a >= 1 ? base : base + h2(a * 255);
}

const fmtNum = (n: number, dp: number): string => {
  const s = n.toFixed(dp);
  return dp > 0 ? s.replace(/\.?0+$/, '') : s; // trim trailing zeros for the perceptual axes
};

// ── sRGB ↔ HSL ────────────────────────────────────────────────────────────────
// The one space the engine doesn't already carry a converter for (it speaks
// OKLCH/CMYK/hex). Standard sRGB↔HSL, UI units: h 0–360, s/l 0–100, r/g/b 0–255.
// Exposed for the picker's HSL slider mode; pure so color-formats.test.ts covers it.

/** sRGB (0–255) → HSL (h 0–360, s/l 0–100). Grey → h 0, s 0. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = clamp(r, 0, 255) / 255, gn = clamp(g, 0, 255) / 255, bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

/** HSL (h 0–360, s/l 0–100) → sRGB (0–255, rounded). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360 / 360, sn = clamp(s, 0, 100) / 100, ln = clamp(l, 0, 100) / 100;
  if (sn === 0) { const v = Math.round(ln * 255); return [v, v, v]; }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue = (t: number): number => {
    let tn = t; if (tn < 0) tn += 1; if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return [hue(hn + 1 / 3), hue(hn), hue(hn - 1 / 3)].map(v => Math.round(v * 255)) as [number, number, number];
}

/**
 * Render `hex` (#rrggbb or #rrggbbaa) as the given format's editable text.
 * Non-hex/unset input yields '' (the caller shows a placeholder).
 */
export function formatColor(fmt: ColorFormat, hex: string): string {
  const rgba = hexToRgba(hex);
  if (!rgba) return '';
  const { r, g, b, a } = rgba;
  const hex6 = rgbaToHex(r, g, b, 1);
  switch (fmt) {
    case 'hex': return (a < 1 ? rgbaToHex(r, g, b, a) : hex6).toUpperCase();
    case 'rgb': return `${r}, ${g}, ${b}`;
    case 'rgba': return `${r}, ${g}, ${b}, ${fmtNum(a, 3)}`;
    case 'hsl': {
      const [h, s, l] = rgbToHsl(r, g, b);
      return `${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%`;
    }
    case 'oklch': {
      const o = hexToOklch(hex6);
      if (!o) return '';
      const base = `${fmtNum(o.l * 100, 1)}% ${fmtNum(o.c, 4)} ${fmtNum(o.h, 1)}`;
      return a < 1 ? `${base} / ${fmtNum(a, 3)}` : base;
    }
    case 'cmyk': {
      const [c, m, y, k] = rgbToCmyk(r / 255, g / 255, b / 255);
      return [c, m, y, k].map(v => Math.round(v * 100)).join(', ');
    }
  }
}

/**
 * Serialise a canonical hex (#rrggbb/#rrggbbaa) into the string form a swatch's
 * `$value` stores. Every emitted form is one the engine's colorToHex parses back
 * (comma-form rgb()/hsl() - its splitter doesn't take space-separated channels),
 * so a doc round-trips whatever notation the user picked. Unparseable input
 * falls through verbatim rather than eating the value.
 */
export function serializeColor(hex: string, fmt: StorageFormat): string {
  const rgba = hexToRgba(hex);
  if (!rgba) return hex;
  const { r, g, b, a } = rgba;
  switch (fmt) {
    case 'hex': return a < 1 ? rgbaToHex(r, g, b, a) : rgbaToHex(r, g, b, 1);
    case 'rgb': return a < 1 ? `rgba(${r}, ${g}, ${b}, ${fmtNum(a, 3)})` : `rgb(${r}, ${g}, ${b})`;
    case 'hsl': {
      const [h, s, l] = rgbToHsl(r, g, b);
      const base = `${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%`;
      return a < 1 ? `hsla(${base}, ${fmtNum(a, 3)})` : `hsl(${base})`;
    }
    case 'lch': {
      const o = hexToOklch(hex);
      return o ? formatOklch(o) : hex; // formatOklch keeps `/ alpha` when < 1
    }
  }
}

/**
 * The storage notation a stored `$value` is already written in - seeds the
 * popover's "Stored as" toggle so editing respects the user's earlier choice.
 * Anything unrecognised (aliases, idents, DTCG objects) reports the app default,
 * `lch`.
 */
export function storageFormatOf(raw: unknown): StorageFormat {
  if (typeof raw !== 'string') return 'lch';
  const s = raw.trim().toLowerCase();
  if (s.startsWith('#')) return 'hex';
  if (/^rgba?\(/.test(s)) return 'rgb';
  if (/^hsla?\(/.test(s)) return 'hsl';
  return 'lch';
}

/**
 * Parse a format's text back to a canonical hex (#rrggbb, or #rrggbbaa when an
 * alpha < 1 is given). Returns null on anything unparseable so the caller can
 * hold the last good value. Number entry is forgiving: commas, spaces, `rgb(...)`
 * / `oklch(...)` wrappers and `%` signs are all tolerated - only the numbers matter.
 */
export function parseColor(fmt: ColorFormat, text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  switch (fmt) {
    case 'hex': {
      const hex = colorToHex(t.startsWith('#') ? t : `#${t}`);
      return hex ?? colorToHex(t) ?? null; // also accept a bare named/functional colour
    }
    case 'rgb': {
      const [r, g, b] = nums(t);
      return r === undefined || g === undefined || b === undefined ? null
        : rgbaToHex(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), 1);
    }
    case 'rgba': {
      const [r, g, b, a] = nums(t);
      if (r === undefined || g === undefined || b === undefined) return null;
      const alpha = a === undefined ? 1 : clamp(a, 0, 1);
      return rgbaToHex(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), alpha);
    }
    case 'hsl': {
      const [h, s, l] = nums(t);
      if (h === undefined || s === undefined || l === undefined) return null;
      const [r, g, b] = hslToRgb(h, clamp(s, 0, 100), clamp(l, 0, 100));
      return rgbaToHex(r, g, b, 1);
    }
    case 'oklch': {
      // L (percent) C H [/ A] - reconstruct the canonical oklch() the engine
      // parses; a 4th number is the alpha (0–1) and yields a hex8.
      const [l, c, h, a] = nums(t);
      if (l === undefined || c === undefined || h === undefined) return null;
      return oklchToHex({ l: clamp(l, 0, 100) / 100, c: Math.max(0, c), h, alpha: a === undefined ? undefined : clamp(a, 0, 1) });
    }
    case 'cmyk': {
      const [c, m, y, k] = nums(t);
      if (c === undefined || m === undefined || y === undefined || k === undefined) return null;
      const [r, g, b] = cmykToRgbApprox([c, m, y, k].map(v => clamp(v, 0, 100) / 100) as [number, number, number, number]);
      return rgbaToHex(r * 255, g * 255, b * 255, 1);
    }
  }
}
