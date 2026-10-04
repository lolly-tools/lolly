// SPDX-License-Identifier: MPL-2.0
/**
 * Brand photo looks baked into raster pixels (plan 291 W7).
 *
 * A look is a photo treatment (./photo-treatment.ts) chosen by id and carried in the
 * picture's asset id as `?treatment=<lookId>`. The legacy kinds (greyscale, duotone)
 * are baked into an SVG filter wrapper for catalog photos; this module bakes ANY kind
 * into the RGBA pixels themselves, so every exporter downstream (canvas, raster, SVG,
 * PDF, PPTX) sees an ordinary picture. Two kinds exist only here:
 *
 * - `gradient-map`: Filter's colour treatment (community/filter/hooks.js, the duotone
 *   effect's `applyGradeAndTreat` and `buildToneLut`) ported line for line. Each pixel's
 *   OKLab lightness picks a colour from a 256-entry table of stops interpolated in OKLab,
 *   linearly between the two nearest bins, and the result is blended by `amount`.
 *   A `contrast` and `lightness` grade runs first, with Filter's own curves.
 * - `lut`: a 3D LUT (a catalog .cube) through ./grade.ts `applyLutFrame`, which is
 *   already held byte for byte to Darkroom.
 *
 * A look may carry theme variants (`themes: { dark: {...} }`), merged over the base
 * definition when that theme is active, so one document gets the light grade in light
 * and the dark grade in dark.
 *
 * Determinism. Filter computes OKLab with Math.cbrt and Math.pow, which V8 and
 * JavaScriptCore do not agree on bit for bit. The colour core below uses only add,
 * subtract, multiply and divide (the engine/src/emoji-treatment.ts precedent): the sRGB
 * decode is a table built once from fixed Newton iterations, cube and square roots are
 * fixed Newton iterations, and every table Filter keeps in a Float32Array is a
 * Float32Array here too. So the same photo, look and theme give the same bytes in
 * Chrome, Node, Safari and Tauri. tests/photo-look-drift.test.ts holds the output to
 * Filter's own function within 1/255 per channel.
 */
import { applyLutFrame, type GradeLut } from './grade.ts';
import type { PhotoTreatment, PhotoTreatmentStop, PhotoTreatmentVariant } from './photo-treatment.ts';

/** The pinned arithmetic below. A changed recipe is a new version, never an edit. */
export const PHOTO_LOOK_RECIPE = 'photo-look-v1';

/** Options for one bake. */
export interface PhotoLookOptions {
  /** The theme variant to apply (a key of `look.themes`); absent or unknown is the base look. */
  theme?: string;
  /** The parsed LUT a `lut` look names. The host reads the catalog file; the engine never fetches. */
  lut?: GradeLut;
}

// ── deterministic roots ──────────────────────────────────────────────────────

/** Cube root by Newton iteration: five steps from a quadratic seed after scaling into [0.125, 1] by exact powers of eight (relative error under 3e-16, measured). */
function cubeRoot(value: number): number {
  if (!(value > 0)) return value < 0 ? -cubeRoot(-value) : 0;
  let scale = 1;
  let r = value;
  while (r < 0.125) { r *= 8; scale *= 0.5; }
  while (r > 1) { r /= 8; scale *= 2; }
  let x = 0.4526 + r * (0.8288 - 0.2816 * r);
  x = (2 * x + r / (x * x)) / 3;
  x = (2 * x + r / (x * x)) / 3;
  x = (2 * x + r / (x * x)) / 3;
  x = (2 * x + r / (x * x)) / 3;
  x = (2 * x + r / (x * x)) / 3;
  return x * scale;
}

/** Square root by Newton iteration after scaling into [0.25, 1] by exact powers of four. */
function squareRoot(value: number): number {
  if (!(value > 0)) return 0;
  let scale = 1;
  let r = value;
  while (r < 0.25) { r *= 4; scale *= 0.5; }
  while (r > 1) { r /= 4; scale *= 2; }
  let x = 0.35 + 0.65 * r;
  for (let step = 0; step < 6; step += 1) x = (x + r / x) / 2;
  return x * scale;
}

/** Fifth root by Newton iteration after scaling into [1/32, 1] by exact powers of 32. */
function fifthRoot(value: number): number {
  if (!(value > 0)) return 0;
  let scale = 1;
  let r = value;
  while (r < 1 / 32) { r *= 32; scale *= 0.5; }
  while (r > 1) { r /= 32; scale *= 2; }
  let x = 0.55 + 0.45 * r;
  for (let step = 0; step < 8; step += 1) {
    const x2 = x * x;
    x = (4 * x + r / (x2 * x2)) / 5;
  }
  return x * scale;
}

/** sRGB transfer decode of a 0..1 value: ((c + 0.055) / 1.055)^2.4, as x^2 times the fifth root of x^2. */
function decodeSrgb(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  const x = (c + 0.055) / 1.055;
  const x2 = x * x;
  return x2 * fifthRoot(x2);
}

/** sRGB transfer encode: 1.055 c^(1/2.4) - 0.055, with c^(5/12) as the cube root times its fourth root. */
function encodeSrgb(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  const third = cubeRoot(c);
  return 1.055 * third * squareRoot(squareRoot(third)) - 0.055;
}

let LINEAR_8: Float64Array | null = null;
/** The decode for every 8-bit channel value, built once. */
function linear8(): Float64Array {
  if (LINEAR_8) return LINEAR_8;
  const table = new Float64Array(256);
  for (let v = 0; v < 256; v += 1) table[v] = decodeSrgb(v / 255);
  LINEAR_8 = table;
  return table;
}

// ── OKLab (Bjorn Ottosson's matrices, as Filter writes them) ─────────────────

/** OKLab lightness of a linear sRGB colour. */
function oklabL(r: number, g: number, b: number): number {
  const l = cubeRoot(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = cubeRoot(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cubeRoot(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/** OKLab of an 8-bit sRGB colour. */
function oklab8(r: number, g: number, b: number): [number, number, number] {
  const lin = linear8();
  const lr = lin[r]!, lg = lin[g]!, lb = lin[b]!;
  const l = cubeRoot(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = cubeRoot(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = cubeRoot(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** OKLab to sRGB 0..1, clamped, as Filter's oklabToRgb01. */
function oklabToRgb01(L: number, a: number, b: number): [number, number, number] {
  const l0 = L + 0.3963377774 * a + 0.2158037573 * b;
  const m0 = L - 0.1055613458 * a - 0.0638541728 * b;
  const s0 = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l0 * l0 * l0, m = m0 * m0 * m0, s = s0 * s0 * s0;
  return [
    clamp01(encodeSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp01(encodeSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp01(encodeSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

// ── look definitions ─────────────────────────────────────────────────────────

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

/** An `#rgb`/`#rrggbb` colour as three 8-bit channels, or null. */
export function photoLookHex8(hex: unknown): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  const t = hex.trim();
  const six = HEX6.exec(t)?.[1] ?? HEX3.exec(t)?.[1]?.replace(/./g, (c) => c + c);
  if (!six) return null;
  const n = parseInt(six, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A look's stops as colours with positions 0..1, ascending; an absent position spreads evenly. */
export function photoLookStops(look: Pick<PhotoTreatment, 'stops' | 'shadow' | 'mid' | 'highlight'>): Array<{ color: string; pos: number }> {
  const raw: PhotoTreatmentStop[] = Array.isArray(look.stops) && look.stops.length
    ? look.stops
    : [look.shadow, look.mid, look.highlight].filter((c): c is string => typeof c === 'string' && !!c);
  const n = raw.length;
  return raw.map((s, i) => {
    const color = typeof s === 'string' ? s : s.color;
    const pos = typeof s === 'object' && typeof s.pos === 'number' ? s.pos / 100 : n > 1 ? i / (n - 1) : 0;
    return { color, pos };
  });
}

/** Keys of `look.themes` that the base keeps out of the merge. */
const VARIANT_KEYS = ['stops', 'shadow', 'mid', 'highlight', 'amount', 'contrast', 'lightness', 'lut', 'previewBg'] as const;

/** The look with one theme variant merged over it, without its `themes`. Unknown or absent theme: the base look. */
export function resolvePhotoLook(look: PhotoTreatment, theme?: string | null): PhotoTreatment {
  const { themes, ...base } = look;
  const variant: PhotoTreatmentVariant | undefined = theme && themes && Object.hasOwn(themes, theme) ? themes[theme] : undefined;
  if (!variant) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of VARIANT_KEYS) if (variant[key] !== undefined) out[key] = variant[key];
  return out as unknown as PhotoTreatment;
}

/**
 * Which theme variant of a look a token selection activates: the first key of
 * `look.themes`, in sorted order, that is one of the selection's chosen options (or
 * the theme name itself when a string is given). 'base' when none applies, so a theme
 * switch that leaves a look alone keeps its cached bake.
 */
export function photoLookThemeKey(look: PhotoTreatment, selection?: Readonly<Record<string, string>> | string | null): string {
  if (!look.themes || !selection) return 'base';
  const chosen = new Set(typeof selection === 'string' ? [selection] : Object.values(selection).filter((v) => typeof v === 'string'));
  for (const key of Object.keys(look.themes).sort()) if (chosen.has(key)) return key;
  return 'base';
}

/** Canonical JSON (keys sorted) for hashing. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec).sort().filter((k) => rec[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(rec[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** An 8-hex FNV-1a digest of the look definition (themes included) and the recipe, so an edited look re-bakes. */
export function photoLookDefinitionHash(look: PhotoTreatment): string {
  const text = `${PHOTO_LOOK_RECIPE}|${canonical(look)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The cache key for one baked (picture, look, theme): `user:<base>:<ver>:look:<id>:<defHash>:<themeKey>`
 * for an upload (`user/...`), `library:` for anything else. The theme key is
 * {@link photoLookThemeKey}'s answer, so a look with no variant for a theme shares the base bake.
 */
export function photoLookCacheKey(baseId: string, version: string | number, look: PhotoTreatment, themeKey: string): string {
  const source = baseId.startsWith('user/') ? 'user' : 'library';
  return `${source}:${baseId}:${version}:look:${look.id}:${photoLookDefinitionHash(look)}:${themeKey || 'base'}`;
}

/** Kinds that only a pixel bake reproduces (no SVG filter equivalent). */
export function isRasterPhotoLook(look: Pick<PhotoTreatment, 'kind'> | null | undefined): boolean {
  return look?.kind === 'gradient-map' || look?.kind === 'lut';
}

// ── the bake ─────────────────────────────────────────────────────────────────

/** Filter's 256-entry L to sRGB table (values before the amount blend), from stops interpolated in OKLab. */
export function photoLookToneTable(stops: ReadonlyArray<{ color: string; pos: number }>): Float32Array {
  const labs = stops.map((s) => {
    const c = photoLookHex8(s.color) ?? [0, 0, 0];
    return oklab8(c[0], c[1], c[2]);
  });
  const lut = new Float32Array(768);
  const last = stops.length - 1;
  for (let li = 0; li < 256; li += 1) {
    const L = li / 255;
    let o: readonly [number, number, number];
    if (last < 1) o = labs[0] ?? [0, 0, 0];
    else {
      // Filter's rule for its three stops at 0, 0.5 and 1: below a stop's position is the
      // segment before it, at or above is the segment after. Outside the first and last
      // positions the segment clamps to its end colour.
      let k = 0;
      while (k < last - 1 && L >= stops[k + 1]!.pos) k += 1;
      o = segment(labs, stops, k, L);
    }
    const rgb = oklabToRgb01(o[0], o[1], o[2]);
    lut[li * 3] = rgb[0];
    lut[li * 3 + 1] = rgb[1];
    lut[li * 3 + 2] = rgb[2];
  }
  return lut;
}

/** OKLab interpolation inside segment k (between stops k and k + 1), clamped to the segment. */
function segment(labs: ReadonlyArray<readonly [number, number, number]>, stops: ReadonlyArray<{ pos: number }>, k: number, L: number): [number, number, number] {
  const a = labs[k]!, b = labs[k + 1]!;
  const p0 = stops[k]!.pos, p1 = stops[k + 1]!.pos;
  const span = p1 - p0;
  let u = span > 0 ? (L - p0) / span : 1;
  if (u < 0) u = 0;
  else if (u > 1) u = 1;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

/**
 * The grade before the look, per channel: Filter's contrast curve (an 8-bit table, so
 * Uint8ClampedArray rounding as Filter's), then its lightness (toward white above 0,
 * toward black below), clamped to 0..1. Both act on one channel at a time, so the grade
 * of every 8-bit value is a table: `unit` is the graded 0..1 value and `linear` its
 * decode. Null when the grade is the identity.
 */
function gradeTables(contrast: number, lightness: number): { unit: Float64Array; linear: Float64Array } | null {
  const c = contrast < -100 ? -100 : contrast > 100 ? 100 : contrast;
  const light = (lightness < -100 ? -100 : lightness > 100 ? 100 : lightness) / 100;
  if (!c && !light) return null;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const clut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) clut[v] = c ? cf * (v - 128) + 128 : v;
  const unit = new Float64Array(256);
  const linear = new Float64Array(256);
  for (let v = 0; v < 256; v += 1) {
    let n = clut[v]!;
    if (light > 0) n += (255 - n) * light;
    else if (light < 0) n *= 1 + light;
    unit[v] = clamp01(n / 255);
    linear[v] = decodeSrgb(unit[v]!);
  }
  return { unit, linear };
}

const LCACHE_SIZE = 1 << 16;

/**
 * Bake a look into straight-alpha RGBA pixels, in place. Alpha is left as it is.
 * Throws for a malformed frame, an unknown kind or a `lut` look without `opts.lut`.
 */
export function applyPhotoLook(rgba: Uint8ClampedArray, width: number, height: number, look: PhotoTreatment, opts: PhotoLookOptions = {}): void {
  if (!(rgba instanceof Uint8ClampedArray)) throw new Error('photo look: pixels must be a Uint8ClampedArray');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0 || rgba.length !== width * height * 4)
    throw new Error(`photo look: ${width}x${height} does not match ${rgba.length} bytes of RGBA`);
  const def = resolvePhotoLook(look, opts.theme);
  const amount = typeof def.amount === 'number' && Number.isFinite(def.amount) ? (def.amount < 0 ? 0 : def.amount > 100 ? 100 : def.amount) / 100 : 1;
  const finite = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const grade = gradeTables(finite(def.contrast), finite(def.lightness));
  if (def.kind === 'lut') {
    if (!opts.lut) throw new Error(`photo look ${def.id}: the LUT ${def.lut ?? ''} was not supplied`);
    if (grade) for (let i = 0; i < rgba.length; i += 4) for (let k = 0; k < 3; k += 1) rgba[i + k] = grade.unit[rgba[i + k]!]! * 255;
    if (amount > 0) applyLutFrame(rgba, opts.lut, amount);
    return;
  }
  if (def.kind === 'gradient-map') {
    gradientMap(rgba, def, amount, grade);
    return;
  }
  if (def.kind === 'greyscale' || def.kind === 'duotone') {
    lumaMap(rgba, def, amount, grade);
    return;
  }
  throw new Error(`photo look ${String((def as { id?: unknown }).id)}: unknown kind ${String((def as { kind?: unknown }).kind)}`);
}

/** The OKLab gradient map: Filter's applyGradeAndTreat with hue 0, saturation 1, lightness 0. */
function gradientMap(d: Uint8ClampedArray, def: PhotoTreatment, ta: number, grade: { unit: Float64Array; linear: Float64Array } | null): void {
  const stops = photoLookStops(def);
  if (stops.length < 2) throw new Error(`photo look ${def.id}: a gradient map needs two stops`);
  const tlut = photoLookToneTable(stops);
  const lin = grade ? grade.linear : linear8();
  const unit = grade ? grade.unit : null;
  // A direct-mapped memo of lightness per 24-bit colour; the memo never changes an answer.
  const keys = new Int32Array(LCACHE_SIZE).fill(-1);
  const vals = new Float64Array(LCACHE_SIZE);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const key = (r << 16) | (g << 8) | b;
    const slot = (key ^ (key >>> 13) ^ (key >>> 7)) & (LCACHE_SIZE - 1);
    let Lp: number;
    if (keys[slot] === key) Lp = vals[slot]!;
    else {
      Lp = oklabL(lin[r]!, lin[g]!, lin[b]!);
      keys[slot] = key;
      vals[slot] = Lp;
    }
    const lf = Lp <= 0 ? 0 : Lp >= 1 ? 255 : Lp * 255;
    const i0 = lf | 0, fr = lf - i0, i1 = i0 < 255 ? i0 + 1 : i0, a0 = i0 * 3, a1 = i1 * 3, ifr = 1 - fr;
    const tr = tlut[a0]! * ifr + tlut[a1]! * fr;
    const tg = tlut[a0 + 1]! * ifr + tlut[a1 + 1]! * fr;
    const tb = tlut[a0 + 2]! * ifr + tlut[a1 + 2]! * fr;
    const r01 = unit ? unit[r]! : r / 255, g01 = unit ? unit[g]! : g / 255, b01 = unit ? unit[b]! : b / 255;
    d[i] = (r01 + (tr - r01) * ta) * 255;
    d[i + 1] = (g01 + (tg - g01) * ta) * 255;
    d[i + 2] = (b01 + (tb - b01) * ta) * 255;
  }
}

/**
 * The legacy kinds as pixels, matching their SVG filter: greyscale is the
 * `saturate 0` matrix, duotone is Rec.709 luma through a 2 or 3 entry table, both on
 * sRGB values (`color-interpolation-filters="sRGB"`).
 */
function lumaMap(d: Uint8ClampedArray, def: PhotoTreatment, ta: number, grade: { unit: Float64Array } | null): void {
  const grey = def.kind === 'greyscale';
  const table = grey ? null : [def.shadow ?? '#000000', ...(def.mid ? [def.mid] : []), def.highlight ?? '#ffffff'].map((c) => {
    const v = photoLookHex8(c) ?? [0, 0, 0];
    return [v[0] / 255, v[1] / 255, v[2] / 255] as const;
  });
  const n = table ? table.length - 1 : 0;
  for (let i = 0; i < d.length; i += 4) {
    const r01 = grade ? grade.unit[d[i]!]! : d[i]! / 255;
    const g01 = grade ? grade.unit[d[i + 1]!]! : d[i + 1]! / 255;
    const b01 = grade ? grade.unit[d[i + 2]!]! : d[i + 2]! / 255;
    let tr: number, tg: number, tb: number;
    if (!table) {
      tr = tg = tb = clamp01(0.213 * r01 + 0.715 * g01 + 0.072 * b01);
    } else {
      const y = clamp01(0.2126 * r01 + 0.7152 * g01 + 0.0722 * b01);
      const pos = y * n;
      const k = pos >= n ? n - 1 : pos | 0;
      const u = pos - k;
      const lo = table[k]!, hi = table[k + 1]!;
      tr = lo[0] + (hi[0] - lo[0]) * u;
      tg = lo[1] + (hi[1] - lo[1]) * u;
      tb = lo[2] + (hi[2] - lo[2]) * u;
    }
    if (ta === 1) {
      d[i] = tr * 255;
      d[i + 1] = tg * 255;
      d[i + 2] = tb * 255;
      continue;
    }
    d[i] = (r01 + (tr - r01) * ta) * 255;
    d[i + 1] = (g01 + (tg - g01) * ta) * 255;
    d[i + 2] = (b01 + (tb - b01) * ta) * 255;
  }
}

/**
 * Colours for an SVG `feComponentTransfer` preview of a gradient map: `count` entries
 * sampled at the map colour a grey of that sRGB value takes, after the look's contrast
 * and lightness grade (the same curves as the bake, unrounded between 8-bit values).
 * Within a step of the bake for grey input and close for colour, which is what a picker
 * swatch or CSS preview needs; a bake uses {@link applyPhotoLook}. Pass the look
 * through {@link resolvePhotoLook} first to preview a theme variant.
 */
export function photoLookPreviewTable(look: PhotoTreatment, count = 17): Array<[number, number, number]> {
  const stops = photoLookStops(look);
  if (stops.length < 2) return [];
  const tlut = photoLookToneTable(stops);
  const amount = typeof look.amount === 'number' && Number.isFinite(look.amount) ? (look.amount < 0 ? 0 : look.amount > 100 ? 100 : look.amount) / 100 : 1;
  const finite = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const contrast = Math.max(-100, Math.min(100, finite(look.contrast)));
  const light = Math.max(-100, Math.min(100, finite(look.lightness))) / 100;
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  /** gradeTables' curve for one grey, 0..1 in and out. */
  const graded = (s: number): number => {
    let n = s * 255;
    if (contrast) n = Math.max(0, Math.min(255, cf * (n - 128) + 128));
    if (light > 0) n += (255 - n) * light;
    else if (light < 0) n *= 1 + light;
    return clamp01(n / 255);
  };
  const out: Array<[number, number, number]> = [];
  for (let j = 0; j < count; j += 1) {
    const s = graded(count > 1 ? j / (count - 1) : 0);
    const L = cubeRoot(decodeSrgb(s));
    const lf = L <= 0 ? 0 : L >= 1 ? 255 : L * 255;
    const i0 = lf | 0, fr = lf - i0, i1 = i0 < 255 ? i0 + 1 : i0;
    const pick = (c: number): number => s + ((tlut[i0 * 3 + c]! * (1 - fr) + tlut[i1 * 3 + c]! * fr) - s) * amount;
    out.push([pick(0), pick(1), pick(2)]);
  }
  return out;
}
