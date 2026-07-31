// SPDX-License-Identifier: MPL-2.0
/**
 * Design-file → Layout Studio boxes (pure mapper).
 *
 * The counterpart to the free-canvas editor: the web shell walks a sanitized
 * Figma/Penpot/SVG DOM into normalized `DesignNode`s (geometry in world px +
 * decoration), and this module turns those into the flat `boxes` rows the editor
 * edits — so an imported design is fully re-editable and re-exportable in every
 * Lolly format.
 *
 * PURE and DOM-free: no `document`, no imports from shells/ or tools/, no
 * brand-specific network/asset logic. The shell does all DOM/getBBox/getCTM work
 * and asset storage; this module only does the maths and field defaulting, so the
 * mapping is unit-testable and identical everywhere the engine runs.
 *
 * Field defaults mirror tools/layout-studio (its addKinds seeds + field defaults),
 * and the colour/weight guards mirror its hooks.js — the imported box looks exactly
 * like a natively-authored one. The editor's font select is a closed vocabulary, so
 * every imported font remaps onto it (monospace family names → the mono family).
 * WHICH families those are is brand data, not engine knowledge: the shell threads a
 * `DesignMapOptions` (from the target tool's manifest — its font select values and
 * addKinds seed colours) through `finalizeBoxes`/`nodeToBox`; the built-in defaults
 * below mirror the neutral blank-brand (brands/lolly-start) layout-studio fork.
 */

import { cornerRadii, roundedRectPath } from './css-box.ts';

/** A 2-D affine matrix (SVG/CSS convention: [a c e / b d f]). */
interface Matrix { a: number; b: number; c: number; d: number; e: number; f: number; }

/** Per-kind non-geometry seed. */
interface KindSeed {
  bg: string;
  fg?: string;
  fontSize?: number;
  valign?: string;
  lineHeight?: number;
  fit?: string;
}

/** A colour-run in a box's markdown text. */
interface ColorRun { text: string; color?: string; }

/**
 * The font vocabulary imported text maps onto — the target editor tool's font
 * select wire values. Every field is optional; anything unset keeps the neutral
 * defaults (DEFAULT_FONTS below).
 */
export interface DesignMapFonts {
  /** Family every non-monospace import maps to. */
  defaultFamily?: string;
  /** Family monospace family names map to. */
  monoFamily?: string;
  /** Heaviest 100-step weight the mono family ships (its variable axis ceiling). */
  monoMaxWeight?: number;
  /** Families the shell can actually resolve (its manifest wire values + installed
   *  user fonts). A case-insensitive match passes through verbatim (canonical casing
   *  from this list) instead of bucketing. */
  knownFamilies?: string[];
}

/** Seed colours for imported boxes — the target tool's addKinds seed values. */
export interface DesignMapSeedColors {
  /** `box` kind default fill (when the node has no explicit fill). */
  boxBg?: string;
  /** `text` kind default ink (when the node has no usable fg). */
  textFg?: string;
  /** `image` kind default backing fill. */
  imageBg?: string;
}

/**
 * Brand options a shell threads into the mappers, sourced from the ACTIVE
 * profile's target tool manifest (its font select + addKinds seeds) so the
 * engine itself stays brand-free.
 */
export interface DesignMapOptions {
  fonts?: DesignMapFonts;
  seedColors?: DesignMapSeedColors;
}

// Neutral defaults — mirror brands/lolly-start/tools/layout-studio (the blank
// brand's font select values and addKinds seed colours), NOT any real brand's.
const DEFAULT_FONTS: Required<Omit<DesignMapFonts, 'knownFamilies'>> = {
  defaultFamily: 'sans',
  monoFamily: 'mono',
  monoMaxWeight: 800,
};

/** The flattened text-style info parsed out of a Penpot content tree. */
interface PenpotContentInfo {
  text: string;
  fontSize: number | null;
  fontWeight: number | null;
  fontFamily: string;
  fg: string;
  textAlign: string;
  lineHeight: number | null;
}

/**
 * A normalized design node — the intermediate the shell produces (SVG path) or the
 * Penpot/Figma parsers below emit, and the sole input to `nodeToBox`. Every field is
 * optional and loosely typed because it comes from parsed design-file JSON.
 */
interface DesignNode {
  kind?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  rot?: unknown;
  opacity?: unknown;
  shape?: string;
  radius?: unknown;
  fill?: unknown;
  grad?: unknown;
  fontFamily?: unknown;
  fontWeight?: unknown;
  textAlign?: unknown;
  fontSize?: unknown;
  lineHeight?: unknown;
  text?: unknown;
  fg?: unknown;
  image?: unknown;
  fit?: string;
  blend?: string;
  group?: unknown;
  pad?: unknown;
  shadow?: string;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  blur?: number;
  bgBlur?: number;
  stroke?: string;
  strokeW?: number;
  strokeDash?: string;
  /** Authored dash length in px (Penpot `strokeDash`). 0 = unset, use the
   *  width-proportional synthesis the editor has always used. */
  strokeDashLen?: number;
  /** Authored gap length in px (Penpot `strokeGap`). 0 = unset. */
  strokeGapLen?: number;
  _fillImageId?: string;
  _fillFlip?: string;
  _imageHash?: string | null;
  _vectorPath?: string;
  _vectorFill?: string;
  _vectorGradient?: unknown;
  _vectorStroke?: PenpotStrokeInfo | null;
  _vectorSize?: { w: number; h: number; x?: number; y?: number };
}

/** A full Layout Studio box row (every field present and defaulted). */
interface Box {
  id: string;
  kind: 'box' | 'text' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  shape: string;
  radius: number;
  bg: string;
  grad: string;
  opacity: number;
  image: unknown;
  fit: string;
  blend: string;
  text: string;
  fg: string;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  valign: string;
  weight: string;
  font: string;
  lineHeight: number;
  group: string;
  clip: string;
  pad: number;
  shadow: string;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  blur: number;
  stroke: string;
  strokeW: number;
  strokeDash: string;
  strokeDashLen: number;
  strokeGapLen: number;
  bgBlur: number;
}

// ── small numeric helpers (mirrors of tools/layout-studio/hooks.js) ──────────
function num(v: unknown, d: number): number;
function num(v: unknown, d: number | undefined): number | undefined;
function num(v: unknown, d: number | undefined): number | undefined {
  const x = typeof v === 'number' ? v : parseFloat(v as string);
  return isFinite(x) ? x : d;
}
function clamp(v: number, a: number, b: number): number { return v < a ? a : (v > b ? b : v); }
function round1(v: number): number { return Math.round(v * 10) / 10; }
function round2(v: number): number { return Math.round(v * 100) / 100; }

/** Safe property read: `o[k]` only when `o` is a non-null object, else undefined. */
function get(o: unknown, k: string): unknown {
  return (o != null && typeof o === 'object') ? (o as Record<string, unknown>)[k] : undefined;
}

/**
 * Colour guard — identical to tools/layout-studio/hooks.js safeColor. Only lets a
 * value through if it's unambiguously a CSS colour (hex / rgb(a) / hsl(a) / a bare
 * name); anything else (which could smuggle a `;` into a style="" attribute) falls
 * back. Imported fills flow through here before they ever reach the editor/output.
 * @param {*} v
 * @param {string} fallback
 * @returns {string}
 */
export function safeColor(v: unknown, fallback: string): string {
  const s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // named colour (e.g. "transparent", "tomato")
  return fallback;
}

/**
 * Decompose a 2-D affine matrix into translation, scale and rotation.
 * (SVG/CSS matrix convention: [a c e / b d f]; a point (x,y) maps to
 * (a·x + c·y + e, b·x + d·y + f).) Skew is folded into the scale/rotation.
 * @param {{a:number,b:number,c:number,d:number,e:number,f:number}} m
 * @returns {{tx:number,ty:number,sx:number,sy:number,rot:number}} rot in degrees.
 */
export function decomposeMatrix(
  m: Partial<Matrix> | null | undefined,
): { tx: number; ty: number; sx: number; sy: number; rot: number } {
  const a = num(m && m.a, 1), b = num(m && m.b, 0);
  const c = num(m && m.c, 0), d = num(m && m.d, 1);
  const e = num(m && m.e, 0), f = num(m && m.f, 0);
  const rot = Math.atan2(b, a) * 180 / Math.PI;
  const sx = Math.hypot(a, b);
  const sy = sx === 0 ? Math.hypot(c, d) : (a * d - b * c) / sx;
  return { tx: e, ty: f, sx, sy, rot };
}

/**
 * Turn a local (unrotated) bounding box + its cumulative transform matrix (CTM)
 * into a top-left box rect plus a rotation about its centre. Transforms the bbox
 * CENTRE by the matrix, scales the size by |sx|/|sy|, and takes the rotation from
 * the decomposition — the common Figma/Penpot case of axis-aligned + rotation.
 * (Skew is approximated as rotation.)
 * @param {{x:number,y:number,width:number,height:number}} bbox local bbox.
 * @param {{a:number,b:number,c:number,d:number,e:number,f:number}} m the CTM.
 * @returns {{x:number,y:number,w:number,h:number,rot:number}} world rect + rot (deg).
 */
export function boxGeomFromBBox(
  bbox: { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | null | undefined,
  m: Partial<Matrix> | null | undefined,
): { x: number; y: number; w: number; h: number; rot: number } {
  const bx = num(bbox && bbox.x, 0), by = num(bbox && bbox.y, 0);
  const bw = num(bbox && bbox.width, 0), bh = num(bbox && bbox.height, 0);
  const a = num(m && m.a, 1), b = num(m && m.b, 0);
  const c = num(m && m.c, 0), d = num(m && m.d, 1);
  const e = num(m && m.e, 0), f = num(m && m.f, 0);
  const lx = bx + bw / 2, ly = by + bh / 2;      // local centre
  const cx = a * lx + c * ly + e;                 // world centre
  const cy = b * lx + d * ly + f;
  const dec = decomposeMatrix({ a, b, c, d, e, f });
  const w = bw * Math.abs(dec.sx);
  const h = bh * Math.abs(dec.sy);
  return { x: cx - w / 2, y: cy - h / 2, w, h, rot: dec.rot };
}

/**
 * Snap an arbitrary font weight onto the variable font's 100-step axis.
 * Mono cuts rarely ship a Black, so the mono family is capped at its declared
 * `monoMaxWeight` (default 800) — matching tools/layout-studio/hooks.js weightOf
 * so the browser render and the static-TTF vector export agree.
 * @param {number|string} weight
 * @param {string} [font] a font-select wire value (see mapFontFamily).
 * @param {DesignMapFonts} [fonts] the brand's font vocabulary (neutral default).
 * @returns {string} '100'..'900'
 */
export function mapWeight(weight: number | string | undefined, font?: string, fonts?: DesignMapFonts): string {
  let w = clamp(Math.round(num(weight, 700) / 100) * 100, 100, 900);
  const monoFamily = (fonts && fonts.monoFamily) ?? DEFAULT_FONTS.monoFamily;
  const monoMax = (fonts && fonts.monoMaxWeight) ?? DEFAULT_FONTS.monoMaxWeight;
  if (String(font) === monoFamily && w > monoMax) w = monoMax;
  return String(w);
}

/**
 * Remap any imported font family onto the editor's two-family vocabulary.
 * A family listed in `fonts.knownFamilies` (matched case-insensitively) passes
 * through verbatim with the list's canonical casing — the shell can resolve it,
 * so no bucketing is needed. Otherwise: monospace family names
 * (mono/console/courier/menlo/…code) → the mono family; everything else → the
 * default family.
 * @param {string} family raw family string.
 * @param {DesignMapFonts} [fonts] the brand's font vocabulary (neutral default).
 * @returns {string} a font-select wire value.
 */
export function mapFontFamily(family: unknown, fonts?: DesignMapFonts): string {
  const fam = String(family == null ? '' : family).trim();
  const hit = fonts?.knownFamilies?.find((k) => k.toLowerCase() === fam.toLowerCase());
  if (hit) return hit;
  return /mono|consol|courier|menlo|code/i.test(String(family == null ? '' : family))
    ? ((fonts && fonts.monoFamily) ?? DEFAULT_FONTS.monoFamily)
    : ((fonts && fonts.defaultFamily) ?? DEFAULT_FONTS.defaultFamily);
}

/**
 * Normalize a text-align value onto the box model's three options.
 * @param {string} a
 * @returns {'left'|'center'|'right'}
 */
export function mapAlign(a: unknown): 'left' | 'center' | 'right' {
  const s = String(a == null ? '' : a).trim().toLowerCase();
  if (s === 'center' || s === 'centre' || s === 'middle') return 'center';
  if (s === 'right' || s === 'end') return 'right';
  return 'left';
}

/**
 * Build a box's markdown-subset text from coloured runs. A run whose colour differs from
 * the box's default `fg` is wrapped `{#rrggbb|…}` — hooks.js richText parses that back into
 * a coloured <span>, and the vector export reads the run colour from computed style. `*`/`_`
 * in run text are escaped so imported literals don't accidentally italicise, and a colour
 * wrap never spans a newline (colour runs are per-line, exactly like bold/italic).
 * @param {Array<{text:string,color?:string}>} runs
 * @param {string} defaultHex the box fg (runs of this colour stay unwrapped).
 * @returns {string}
 */
export function colorRunsToText(runs: ReadonlyArray<ColorRun>, defaultHex: string): string {
  const def = String(defaultHex == null ? '' : defaultHex).toLowerCase();
  const flat: Array<{ text: string; color: string }> = [];
  for (const r of (Array.isArray(runs) ? runs : [])) {
    if (!r || r.text == null) continue;
    const col = (r.color && /^#[0-9a-fA-F]{3,8}$/.test(r.color)) ? String(r.color).toLowerCase() : '';
    const parts = String(r.text).split('\n');
    parts.forEach((p, idx) => {
      if (idx > 0) flat.push({ text: '\n', color: '' });   // newline: never inside a colour wrap
      if (p) flat.push({ text: p, color: col });
    });
  }
  const merged: Array<{ text: string; color: string }> = [];
  for (const r of flat) {
    const last = merged[merged.length - 1];
    if (last && last.color === r.color && last.text !== '\n' && r.text !== '\n') last.text += r.text;
    else merged.push({ text: r.text, color: r.color });
  }
  const esc = (t: string): string => t.replace(/([*_])/g, '\\$1');
  return merged.map((r) => {
    if (r.text === '\n') return '\n';
    const t = esc(r.text);
    return (r.color && r.color !== def) ? '{' + r.color + '|' + t + '}' : t;
  }).join('');
}

// Per-kind non-geometry seeds. Colours mirror the NEUTRAL (lolly-start)
// layout-studio addKinds; a branded shell overrides them via seedColors.
const SEED: Record<'box' | 'text' | 'image', KindSeed> = {
  box: { bg: '#4f84ba' },
  text: { bg: '', fg: '#0e1217', fontSize: 64, valign: 'top', lineHeight: 1.12 },
  image: { bg: '#e1e5ea', fit: 'contain' },
};
const SHAPES: Record<string, number> = { rect: 1, rounded: 1, pill: 1, ellipse: 1 };
const FITS: Record<string, number> = { contain: 1, cover: 1, fill: 1 };
const BLENDS: Record<string, number> = {
  normal: 1, multiply: 1, screen: 1, overlay: 1, darken: 1, lighten: 1,
  'color-dodge': 1, 'color-burn': 1, 'hard-light': 1, 'soft-light': 1,
  difference: 1, exclusion: 1, hue: 1, saturation: 1, color: 1, luminosity: 1,
};

function has(o: unknown, k: string): boolean { return o != null && Object.hasOwn(o, k); }

/**
 * Turn one normalized DesignNode into a full Layout Studio box row — every field
 * present and defaulted (mirroring the addKinds seeds + field defaults), with the
 * font/weight/align/colour remaps applied. `kind` drives which fields carry
 * meaning, but all fields are emitted so the row is self-describing.
 * @param {object} node the DesignNode.
 * @param {{id:string, fonts?:object, seedColors?:object}} opts assigned id
 *   (permanent within this import) + the brand's DesignMapOptions.
 * @returns {object} a box row.
 */
export function nodeToBox(
  node: DesignNode | null | undefined,
  opts: ({ id?: unknown } & DesignMapOptions) | null | undefined,
): Box {
  const n: DesignNode = node || {};
  const o = opts || {};
  const id = o.id != null ? String(o.id) : '';
  const kind: 'box' | 'text' | 'image' = n.kind === 'text' ? 'text' : (n.kind === 'image' ? 'image' : 'box');
  const seed = SEED[kind];
  const sc = o.seedColors || {};
  const seedBg = kind === 'box' ? (sc.boxBg ?? seed.bg)
    : kind === 'image' ? (sc.imageBg ?? seed.bg)
    : seed.bg; // text seed bg is transparent under every brand

  // geometry
  const x = Math.round(num(n.x, 0));
  const y = Math.round(num(n.y, 0));
  const w = Math.max(1, Math.round(num(n.w, 1)));
  const h = Math.max(1, Math.round(num(n.h, 1)));
  const rot = round1(num(n.rot, 0));
  const opacity = clamp(Math.round(num(n.opacity, 100)), 0, 100);

  // shape + radius (fidelity: honour the node, fall back to plain rect)
  const shape = SHAPES[n.shape as string] ? (n.shape as string) : (num(n.radius, 0) > 0 ? 'rounded' : 'rect');
  const radius = Math.max(0, Math.round(num(n.radius, shape === 'rounded' ? 16 : 0)));

  // fill: honour an explicit fill (incl. '' = none); otherwise the kind's seed bg
  const bg = has(n, 'fill') ? safeColor(n.fill, '') : seedBg;

  // typography
  const font = mapFontFamily(n.fontFamily, o.fonts);
  const weight = mapWeight(n.fontWeight as number | string | undefined, font, o.fonts);
  const align = mapAlign(n.textAlign);
  const fontSize = Math.max(1, Math.round(num(n.fontSize, kind === 'text' ? 64 : 48)));
  const lineHeight = num(n.lineHeight, seed.lineHeight != null ? seed.lineHeight : 1.12);

  // image ref: keep the WHOLE resolved AssetRef (id + object-URL + meta), not just the id.
  // resolveAssetRefs only runs at createRuntime — NOT on setInput — so an id-only ref
  // committed by the importer would render a broken <img> (no url until a reload re-resolves
  // it). Carrying the full ref matches what the image picker (pickImage) commits. A raw
  // data-URI string has no `.id`, so it's guarded to null and can't reach the resolver.
  const img = n.image;
  const image = (img && typeof img === 'object' && (img as { id?: unknown }).id != null && (img as { id?: unknown }).id !== '')
    ? img : null;
  const fit = FITS[n.fit as string] ? (n.fit as string) : (seed.fit || 'contain');

  return {
    id,
    kind,
    x, y, w, h, rot,
    shape,
    radius,
    bg,
    grad: n.grad != null ? String(n.grad) : '',
    opacity,
    image,
    fit,
    blend: BLENDS[n.blend as string] ? (n.blend as string) : 'normal',
    text: n.text != null ? String(n.text) : '',
    fg: safeColor(n.fg, sc.textFg ?? SEED.text.fg!),
    fontSize,
    align,
    valign: kind === 'text' ? (seed.valign || 'top') : 'middle',
    weight,
    font,
    lineHeight,
    group: n.group != null && n.group !== '' ? String(n.group) : '',
    clip: '',
    pad: Math.max(0, Math.round(num(n.pad, 8))),
    shadow: n.shadow || 'none',
    shadowColor: n.shadowColor ? safeColor(n.shadowColor, '#00000055') : '#00000055',
    shadowX: Math.round(num(n.shadowX, 0)),
    shadowY: Math.round(num(n.shadowY, 0)),
    shadowBlur: Math.round(num(n.shadowBlur, 10)),
    blur: clamp(round1(num(n.blur, 0)), 0, 300),
    stroke: n.stroke ? safeColor(n.stroke, '') : '',
    strokeW: Math.max(0, num(n.strokeW, 0) ?? 0),
    strokeDash: n.strokeDash === 'dashed' || n.strokeDash === 'dotted' ? n.strokeDash : '',
    // Authored dash/gap lengths (Penpot 2.17 PR #9765). Numbers, never strings, so
    // the compact blocks URL form is untouched — it cannot carry a comma or a tilde.
    // 0 keeps the editor's width-proportional synthesis, so an unauthored row is
    // byte-identical to what it produced before these fields existed.
    strokeDashLen: Math.max(0, round2(num(n.strokeDashLen, 0))),
    strokeGapLen: Math.max(0, round2(num(n.strokeGapLen, 0))),
    // Backdrop blur (frosted glass) — CSS backdrop-filter, same 0..300 clamp and
    // 1-decimal rounding as `blur`. 0 is off, so a row without the field renders
    // byte-identically to one from before the field existed.
    bgBlur: clamp(round1(num(n.bgBlur, 0)), 0, 300),
  };
}

/**
 * Map an ordered list of DesignNodes to boxes with unique, sequential ids
 * (`${prefix}${i}`), skipping nulls and degenerate non-text nodes (w<1 || h<1).
 * Input order is preserved (= paint order, back-to-front).
 * @param {object[]} nodes
 * @param {{prefix?:string, fonts?:object, seedColors?:object}} [opts] id prefix
 *   + the brand's DesignMapOptions (threaded into every nodeToBox).
 * @returns {object[]} box rows.
 */
export function finalizeBoxes(
  nodes: ReadonlyArray<DesignNode | null | undefined> | null | undefined,
  opts?: ({ prefix?: unknown } & DesignMapOptions) | null,
): Box[] {
  const prefix = (opts && opts.prefix != null) ? String(opts.prefix) : 'n';
  const list = Array.isArray(nodes) ? nodes : [];
  const out: Box[] = [];
  for (const node of list) {
    if (node == null) continue;
    const kind = node.kind === 'text' ? 'text' : (node.kind === 'image' ? 'image' : 'box');
    // Skip only a true zero-area point; a thin rule/divider (one dimension < 1) is kept
    // and clamped to 1px by nodeToBox, so imported hairlines don't silently vanish.
    if (kind !== 'text' && num(node.w, 0) < 1 && num(node.h, 0) < 1) continue; // degenerate
    out.push(nodeToBox(node, { id: prefix + out.length, fonts: opts?.fonts, seedColors: opts?.seedColors }));
  }
  return out;
}

// ── Penpot text content ──────────────────────────────────────────────────────
// Penpot stores rich text as a small tree (root → paragraph-set → paragraph → leaf).
// Keys arrive either keyworded (":font-size") or plain ("font-size") depending on
// the exporter, and every value is a string. We accept both key styles.
function camelKey(k: string): string { return k.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase()); }
function pget(o: unknown, k: string): unknown {
  if (o == null) return undefined;
  const obj = o as Record<string, unknown>;
  if (obj[k] !== undefined) return obj[k];
  if (obj[':' + k] !== undefined) return obj[':' + k];
  const ck = camelKey(k);                       // binfile-v3 JSON uses camelCase (fontSize, fillColor…)
  if (ck !== k && obj[ck] !== undefined) return obj[ck];
  return undefined;
}
function pkids(o: unknown): unknown[] {
  const c = pget(o, 'children');
  return Array.isArray(c) ? (c as unknown[]) : [];
}
function isLeaf(n: unknown): boolean { return n != null && pget(n, 'text') !== undefined; }
function numOrNull(v: unknown): number | null { const x = parseFloat(v as string); return isFinite(x) ? x : null; }
// A Penpot text leaf's colour: leaf :fill-color, else its first :fills[].fill-color.
function penpotLeafColor(leaf: unknown): string {
  const fc = pget(leaf, 'fill-color');
  if (fc != null) return String(fc);
  const fills = pget(leaf, 'fills');
  if (Array.isArray(fills) && (fills as unknown[])[0]) {
    const ffc = pget((fills as unknown[])[0], 'fill-color');
    if (ffc != null) return String(ffc);
  }
  return '';
}

/**
 * Flatten a Penpot text-content tree into the box's single-style text fields.
 * Leaf text is concatenated within a paragraph; paragraphs join with '\n'. The
 * first non-empty leaf's font-size / weight / colour / line-height become the
 * box's values, and the first paragraph's text-align is taken.
 * @param {string|object} contentJson the penpot:content value (JSON string or object).
 * @returns {{text:string,fontSize:number|null,fontWeight:number|null,fg:string,textAlign:string,lineHeight:number|null}}
 */
export function parsePenpotContent(contentJson: unknown): PenpotContentInfo {
  const empty: PenpotContentInfo = { text: '', fontSize: null, fontWeight: null, fontFamily: '', fg: '', textAlign: 'left', lineHeight: null };
  let root: unknown = contentJson;
  if (typeof contentJson === 'string') {
    try { root = JSON.parse(contentJson); } catch { return empty; }
  }
  if (!root || typeof root !== 'object') return empty;

  const runs: ColorRun[] = [];        // {text, color} across the whole content (paragraphs joined by '\n')
  let firstStyle: unknown = null;
  let firstAlign: string | null = null;
  let paraCount = 0;

  function collectParagraph(p: unknown): void {
    if (firstAlign == null) {
      const al = pget(p, 'text-align');
      if (al != null) firstAlign = String(al);
    }
    const leaves: unknown[] = [];
    (function gather(node: unknown): void {
      if (isLeaf(node)) { leaves.push(node); return; }
      pkids(node).forEach(gather);
    })(p);
    if (!leaves.length && isLeaf(p)) leaves.push(p);
    if (paraCount > 0) runs.push({ text: '\n', color: '' });
    paraCount++;
    for (const lf of leaves) {
      const leafText = pget(lf, 'text');
      const t = String(leafText != null ? leafText : '');
      runs.push({ text: t, color: penpotLeafColor(lf) });
      if (!firstStyle && t !== '') firstStyle = lf;
    }
  }

  (function walk(n: unknown): void {
    if (n == null || typeof n !== 'object') return;
    const type = pget(n, 'type');
    const children = pkids(n);
    if (type === 'paragraph' || (type == null && children.some(isLeaf))) {
      collectParagraph(n);
      return;
    }
    if (isLeaf(n) && !children.length) { collectParagraph(n); return; }
    children.forEach(walk);
  })(root);

  const fg = firstStyle ? penpotLeafColor(firstStyle) : '';

  let fontFamily = '';
  if (firstStyle) {
    const ff = pget(firstStyle, 'font-family');
    if (ff != null) fontFamily = String(ff);
  }

  return {
    text: colorRunsToText(runs, fg),
    fontSize: firstStyle ? numOrNull(pget(firstStyle, 'font-size')) : null,
    fontWeight: firstStyle ? numOrNull(pget(firstStyle, 'font-weight')) : null,
    fontFamily,
    fg,
    textAlign: firstAlign != null ? firstAlign : 'left',
    lineHeight: firstStyle ? numOrNull(pget(firstStyle, 'line-height')) : null,
  };
}

/** One distinct font used by a Penpot content tree, with how many styled runs use it. */
export interface PenpotFontUsage {
  fontId: string;
  fontFamily: string;
  fontVariantId: string;
  fontWeight: number;
  fontStyle: string;
  runs: number;
}

/**
 * Tally every font a Penpot text-content tree references. Walks the same tree as
 * parsePenpotContent, visiting EVERY style-carrying node — Penpot writes the full
 * font set on paragraphs AND leaves alike — and dedupes entries by
 * `fontId|fontVariantId|fontStyle` while counting the nodes (`runs`), so one
 * font never yields two entries. The engine stays brand- and provider-free: a
 * `fontId` is returned verbatim (the shell decides what e.g. a `gfont-` prefix
 * means). Every Penpot value is a string; `fontWeight` is parsed to a number
 * (400 when unreadable).
 * @param {string|object} contentJson the shape's `content` (JSON string or object).
 * @returns {PenpotFontUsage[]} in first-seen order.
 */
export function collectPenpotFontUsage(contentJson: unknown): PenpotFontUsage[] {
  let root: unknown = contentJson;
  if (typeof contentJson === 'string') {
    try { root = JSON.parse(contentJson); } catch { return []; }
  }
  if (!root || typeof root !== 'object') return [];
  const byKey = new Map<string, PenpotFontUsage>();
  (function walk(n: unknown): void {
    if (n == null || typeof n !== 'object') return;
    const fid = pget(n, 'font-id');
    if (fid !== undefined) {
      const fontId = String(fid);
      const fontVariantId = String(pget(n, 'font-variant-id') ?? '');
      const fontStyle = String(pget(n, 'font-style') ?? 'normal');
      const key = `${fontId}|${fontVariantId}|${fontStyle}`;
      const cur = byKey.get(key);
      if (cur) {
        cur.runs++;
      } else {
        const w = Number(pget(n, 'font-weight'));
        byKey.set(key, {
          fontId,
          fontFamily: String(pget(n, 'font-family') ?? ''),
          fontVariantId,
          fontWeight: Number.isFinite(w) ? w : 400,
          fontStyle,
          runs: 1,
        });
      }
    }
    pkids(n).forEach(walk);
  })(root);
  return [...byKey.values()];
}

// ── Penpot binfile-v3 shape → DesignNode ─────────────────────────────────────
// The current Penpot `.penpot` export is a ZIP of per-shape JSON (camelCase). Unlike
// the SVG path, geometry is authoritative DATA: `selrect` is the axis-aligned,
// pre-rotation rect and `rotation` is degrees about the centre — exactly the box
// model — so no DOM/getBBox measurement is needed. Image fills are returned with a
// `_fillImageId` marker the shell resolves to bytes (it owns the zip + asset store).

interface PenpotFill {
  fillColor?: unknown;
  fillOpacity?: unknown;
  fillImage?: { id?: unknown; keepAspectRatio?: unknown } | null;
  fillColorGradient?: PenpotGradient | null;
}
interface PenpotGradient {
  type?: unknown;
  stops?: unknown[];
  startX?: unknown;
  startY?: unknown;
  endX?: unknown;
  endY?: unknown;
}
interface PenpotShape {
  id?: unknown;
  type?: unknown;
  selrect?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  rotation?: unknown;
  opacity?: unknown;
  fills?: unknown;
  strokes?: unknown;
  content?: unknown;
  transform?: unknown;
  flipX?: unknown;
  flipY?: unknown;
  r1?: unknown;
  r2?: unknown;
  r3?: unknown;
  r4?: unknown;
  shadow?: unknown;
  blur?: unknown;
  backgroundBlur?: unknown;
  hidden?: unknown;
  shapes?: unknown;
  maskedGroup?: unknown;
  exports?: unknown;
  componentRoot?: unknown;
  mainInstance?: unknown;
}

// Cap mirrors gradient-spec.ts MAX_GRADIENT_STOPS (kept literal: design-map must
// not import the render-side module — the spec string is the only coupling).
const MAX_PENPOT_GRADIENT_STOPS = 12;

/**
 * Map a Penpot gradient fill to a Lolly gradient-spec string (gradient-spec.ts
 * grammar: `<kind>[.<space>]_<angle>_<hex>-<pos>_…`), or '' when unusable.
 * Interpolation is pinned to `.srgb` — Penpot ramps in sRGB, and Lolly's OKLab
 * default would visibly shift the mid-ramp. The angle comes from the gradient
 * vector in PIXEL space (start/end are fractions of the shape box, so aspect
 * matters); stop positions keep their authored offsets — CSS spans the full box
 * while Penpot endpoints can be inset, an accepted approximation for v1. Stop
 * alpha folds `stop.opacity × fillOpacity` into an 8-digit hex.
 * @param {object} g the fill's `fillColorGradient`.
 * @param {number} w,h the shape box in px.
 * @param {number} fillOpacity the owning fill's opacity 0..1.
 * @returns {string}
 */
export function penpotGradientToSpec(g: unknown, w: number, h: number, fillOpacity: number): string {
  const grad = (g && typeof g === 'object') ? (g as PenpotGradient) : null;
  const stops = grad && Array.isArray(grad.stops) ? grad.stops : [];
  if (!grad || stops.length < 2) return '';
  const kind = String(grad.type || '') === 'radial' ? 'rad' : 'lin';
  const dx = (num(grad.endX, 1) - num(grad.startX, 0)) * Math.max(1, w);
  const dy = (num(grad.endY, 1) - num(grad.startY, 0)) * Math.max(1, h);
  // CSS angle: 0° points up, clockwise; the vector points toward the last stop.
  const angle = kind === 'rad' ? 0 : Math.round(((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360);
  const parts: string[] = [];
  const fo = clamp(fillOpacity, 0, 1);
  for (const raw of stops.slice(0, MAX_PENPOT_GRADIENT_STOPS)) {
    const st = (raw && typeof raw === 'object') ? raw as { color?: unknown; opacity?: unknown; offset?: unknown } : null;
    const hex6 = safeColor(String(st?.color ?? ''), '');
    if (!hex6) return ''; // one unreadable stop → no gradient (flat-fill degrade)
    const a = Math.round(clamp(num(st?.opacity, 1), 0, 1) * fo * 255);
    const hex = (hex6.replace(/^#/, '') + (a < 255 ? a.toString(16).padStart(2, '0') : '')).toLowerCase();
    const pos = clamp(Math.round(num(st?.offset, 0) * 100), 0, 100);
    parts.push(`${hex}-${pos}`);
  }
  return `${kind}.srgb_${angle}_${parts.join('_')}`;
}

/**
 * True when a Penpot shape's `transform` matrix is non-identity — i.e. rotation /
 * flip / skew have been BAKED into the shape's path `content` (which Penpot writes
 * page-space-final). e/f are ignored: they carry ~1e-9 float noise, never real
 * translation, and translation wouldn't change the double-transform question anyway.
 * @param {*} t the shape's `transform`.
 * @returns {boolean}
 */
export function penpotTransformBaked(t: unknown): boolean {
  if (!t || typeof t !== 'object') return false;
  const m = t as { a?: unknown; b?: unknown; c?: unknown; d?: unknown };
  return Math.abs(num(m.a, 1) - 1) + Math.abs(num(m.b, 0)) + Math.abs(num(m.c, 0)) + Math.abs(num(m.d, 1) - 1) > 1e-3;
}

/**
 * Loose bounding box of an absolute-command SVG path `d`: scans every coordinate
 * pair, so cubic CONTROL points can bulge the box slightly — a deliberately cheap
 * contract that's sufficient for a placement rect (parseSvgPath/pathBounds is the
 * exact-but-heavier one). Returns null unless the commands are only M/L/C/Z
 * (relative/arc commands would need real interpretation) with ≥1 finite pair.
 * @param {string} d absolute path data.
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function pathDBounds(d: string): { x: number; y: number; w: number; h: number } | null {
  const s = String(d ?? '');
  const NUM_RE = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
  // Strip numbers first so exponent e/E can't read as a command letter.
  const cmds = s.replace(NUM_RE, ' ').match(/[A-Za-z]/g) || [];
  if (!cmds.length || cmds.some((c) => c !== 'M' && c !== 'L' && c !== 'C' && c !== 'Z')) return null;
  const nums = s.match(NUM_RE) || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const px = parseFloat(nums[i]!), py = parseFloat(nums[i + 1]!);
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Mirror a Penpot gradient's endpoints for a flipped shape. Penpot stores start/end
 * as fractions of the UNFLIPPED shape box and renders the gradient through the flip
 * transform; consumers here emit unflipped geometry, so the endpoints must mirror
 * instead (x → 1−x under flipX, y → 1−y under flipY; stops untouched). Returns the
 * input object itself when there is no flip.
 * @param {*} g the fill's `fillColorGradient`.
 * @param {boolean} flipX,flipY the shape's flip flags.
 * @returns {*}
 */
export function mirrorPenpotGradient(g: unknown, flipX: boolean, flipY: boolean): unknown {
  if ((!flipX && !flipY) || !g || typeof g !== 'object') return g;
  const grad = g as PenpotGradient;
  const out: PenpotGradient = { ...grad };
  if (flipX) { out.startX = 1 - num(grad.startX, 0); out.endX = 1 - num(grad.endX, 1); }
  if (flipY) { out.startY = 1 - num(grad.startY, 0); out.endY = 1 - num(grad.endY, 1); }
  return out;
}

/**
 * Path data for a rect with four independent corner radii — a thin adapter over the
 * one existing rounded-corner implementation (css-box.ts): cornerRadii applies the
 * CSS §5.5 overlap clamp, roundedRectPath emits the four-arc path, so the clamp and
 * arc conventions stay shared with the HTML→SVG export walker.
 * @param {number} x,y,w,h the rect.
 * @param {number[]} r `[tl, tr, br, bl]` corner radii in px.
 * @returns {string}
 */
export function penpotRoundedRectD(x: number, y: number, w: number, h: number, r: [number, number, number, number]): string {
  const px = (v: number): string => `${Math.max(0, num(v, 0))}px`;
  const radii = cornerRadii({ topLeft: px(r[0]), topRight: px(r[1]), bottomRight: px(r[2]), bottomLeft: px(r[3]) }, w, h);
  return roundedRectPath(x, y, w, h, radii);
}

// Per-corner radii, r1=top-left r2=top-right r3=bottom-right r4=bottom-left with
// r2–r4 defaulting to r1 (Penpot omits them for uniform corners). Returns null when
// all four are equal — the caller keeps its byte-identical rx/'rounded' fast path —
// else the FLIP-PERMUTED [tl,tr,br,bl]: consumers emit unflipped geometry, and a
// mirrored rect shows its corners swapped (flipX left↔right, flipY top↔bottom).
function penpotUnequalCorners(sh: PenpotShape): [number, number, number, number] | null {
  const r1 = num(sh.r1, 0);
  const r2 = num(sh.r2, r1), r3 = num(sh.r3, r1), r4 = num(sh.r4, r1);
  if (r1 === r2 && r1 === r3 && r1 === r4) return null;
  let c: [number, number, number, number] = [r1, r2, r3, r4];
  if (sh.flipX === true) c = [c[1], c[0], c[3], c[2]];
  if (sh.flipY === true) c = [c[3], c[2], c[1], c[0]];
  return c;
}

/**
 * Normalize a Penpot shape's `content` into SVG path data. binfile-v3 writes paths
 * as a ready `d` string (absolute M/L/C/Z, page-space coords); older/other exporters
 * store a segment-object array `[{command:'move-to',params:{x,y}},…]` — both forms
 * come out as one `d`. Anything else (text content trees, svg-raw wrappers) is ''.
 * @param {*} content
 * @returns {string}
 */
export function penpotPathContentToD(content: unknown): string {
  if (typeof content === 'string') {
    const d = content.trim();
    return /^[Mm]/.test(d) ? d : '';
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const seg of content) {
      const cmd = String(pget(seg, 'command') ?? '').replace(/^:/, '');
      const p = pget(seg, 'params');
      const n = (k: string): number => num(pget(p, k), 0);
      if (cmd === 'move-to') parts.push(`M${n('x')},${n('y')}`);
      else if (cmd === 'line-to') parts.push(`L${n('x')},${n('y')}`);
      else if (cmd === 'curve-to') parts.push(`C${n('c1x')},${n('c1y')},${n('c2x')},${n('c2y')},${n('x')},${n('y')}`);
      else if (cmd === 'close-path') parts.push('Z');
      else return ''; // unknown segment command → the whole path is unusable
    }
    return parts.length && parts[0]!.startsWith('M') ? parts.join('') : '';
  }
  return '';
}

// Path data safe to embed in a double-quoted SVG attribute: must look like path data
// (starts M/m) and keeps only path-grammar characters — no quotes/brackets can survive.
function safePathD(v: unknown): string {
  const s = String(v == null ? '' : v).trim();
  return /^[Mm]/.test(s) ? s.replace(/[^-+0-9eE.,\sA-Za-z]/g, '') : '';
}

/** One Penpot stroke reduced to what our render paths can carry. */
export interface PenpotStrokeInfo {
  color: string;
  width: number;
  opacity?: number;
  /** 'solid' | 'dashed' | 'dotted' | 'mixed' — never 'none' (those are skipped). */
  style?: string;
  /** Authored dash length in px, when the source set one (Penpot `strokeDash`). */
  dash?: number;
  /** Authored gap length in px (Penpot `strokeGap`). */
  gap?: number;
  capStart?: string;
  capEnd?: string;
}

// Stroke keys arrive camelCase in binfile-v3, kebab or ":kebab" from other exporters,
// so every optional key is read through pget's three spellings.
function strokeStyleOf(st: unknown): string {
  const s = String(pget(st, 'stroke-style') ?? 'solid').replace(/^:/, '').trim().toLowerCase();
  return s || 'solid';
}
// A finite number >= 0 (Penpot's `decode_optional`: 0 IS a legal authored value), else
// undefined. Absence is NOT zero — it means "use the renderer's width-derived default".
function strokeLen(st: unknown, key: string): number | undefined {
  const v = pget(st, key);
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isFinite(n) && n >= 0 ? n : undefined;
}

// Topmost usable stroke (last entry wins, like fills). strokeAlignment is NOT modelled:
// SVG only has centre strokes, so inner/outer are approximated as centre downstream.
// `strokeStyle: "none"` entries are SKIPPED, matching Penpot's renderer
// (`(when-not (= style :none) ...)`); the search continues under them, so a "none"
// laid over a real stroke reveals the one below instead of painting solid.
function topPenpotStroke(sh: PenpotShape): PenpotStrokeInfo | null {
  const list = Array.isArray(sh.strokes) ? sh.strokes : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const st = list[i];
    if (!st || typeof st !== 'object') continue;
    const style = strokeStyleOf(st);
    if (style === 'none') continue;
    const width = num(get(st, 'strokeWidth'), 0);
    const color = safeColor(get(st, 'strokeColor'), '');
    if (width > 0 && color) {
      const out: PenpotStrokeInfo = {
        color, width,
        opacity: clamp(num(get(st, 'strokeOpacity'), 1), 0, 1),
        style,
      };
      const d = strokeLen(st, 'stroke-dash'); if (d !== undefined) out.dash = d;
      const g = strokeLen(st, 'stroke-gap'); if (g !== undefined) out.gap = g;
      const cs = pget(st, 'stroke-cap-start'); if (cs != null) out.capStart = String(cs).replace(/^:/, '');
      const ce = pget(st, 'stroke-cap-end'); if (ce != null) out.capEnd = String(ce).replace(/^:/, '');
      return out;
    }
  }
  return null;
}

// Penpot's `calculate-dasharray` (frontend/src/app/main/ui/shapes/attrs.cljs), w = width:
//   mixed  → "w+5,w+5,w+1,w+5"
//   dotted → "0,w+5"          (zero-length dash; needs a round/square cap to paint)
//   dashed → "dash,gap", each falling back to w+10 when the source authored neither
// The authored numbers are absolute px, NOT proportional to the width.
export function penpotDashArray(style: string, w: number, dash?: number, gap?: number): string {
  const s = String(style || 'solid');
  if (s === 'dashed') {
    const d = (dash != null && dash > 0) ? dash : w + 10;
    const g = (gap != null && gap > 0) ? gap : w + 10;
    return `${round2(d)},${round2(g)}`;
  }
  if (s === 'dotted') return `0,${round2(w + 5)}`;
  if (s === 'mixed') return `${round2(w + 5)},${round2(w + 5)},${round2(w + 1)},${round2(w + 5)}`;
  return '';
}

// A Set, not an object literal: the value is source-controlled and `OBJ['constructor']`
// is truthy on any plain object.
const SVG_LINECAPS = new Set(['butt', 'round', 'square']);
// SVG stroke-linecap for a baked Penpot stroke. Dotted is a ZERO-length dash, which the
// default butt cap paints as nothing at all, so dotted defaults to `round` (what Penpot's
// own exports carry) rather than leaving the renderer's default to erase the stroke.
function penpotLineCap(st: PenpotStrokeInfo): string {
  const raw = String(st.capStart ?? st.capEnd ?? '');
  if (SVG_LINECAPS.has(raw)) return raw;
  return st.style === 'dotted' ? 'round' : '';
}

/**
 * Render a Penpot `fillColorGradient` as a native SVG gradient def (NOT the Lolly
 * grad-spec route — SVG keeps the exact endpoints and has no stop cap). Coordinates
 * are objectBoundingBox fractions, exactly Penpot's start/end encoding; a radial
 * approximates its radius as the start→end distance. Stop alpha folds
 * `stop.opacity × fillOpacity` into stop-opacity. Returns '' when unusable.
 * @param {object} g the fill's `fillColorGradient`.
 * @param {string} id the def's element id (caller-unique within one SVG).
 * @param {number} fillOpacity the owning fill's opacity 0..1.
 * @returns {string}
 */
export function penpotGradientSvgDef(g: unknown, id: string, fillOpacity: number): string {
  const grad = (g && typeof g === 'object') ? (g as PenpotGradient) : null;
  const stops = grad && Array.isArray(grad.stops) ? grad.stops : [];
  if (!grad || stops.length < 2) return '';
  const fo = clamp(num(fillOpacity, 1), 0, 1);
  const stopEls: string[] = [];
  for (const raw of stops) {
    const st = (raw && typeof raw === 'object') ? raw as { color?: unknown; opacity?: unknown; offset?: unknown } : null;
    const c = safeColor(String(st?.color ?? ''), '');
    if (!c) return '';
    const so = Math.round(clamp(num(st?.opacity, 1), 0, 1) * fo * 1000) / 1000;
    const off = clamp(num(st?.offset, 0), 0, 1);
    stopEls.push(`<stop offset="${off}" stop-color="${c}"${so < 1 ? ` stop-opacity="${so}"` : ''}/>`);
  }
  const sx = num(grad.startX, 0), sy = num(grad.startY, 0);
  const ex = num(grad.endX, 1), ey = num(grad.endY, 1);
  if (String(grad.type || '') === 'radial') {
    const r = Math.max(0.001, Math.hypot(ex - sx, ey - sy));
    return `<radialGradient id="${id}" gradientUnits="objectBoundingBox" cx="${sx}" cy="${sy}" r="${r}">${stopEls.join('')}</radialGradient>`;
  }
  return `<linearGradient id="${id}" gradientUnits="objectBoundingBox" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}">${stopEls.join('')}</linearGradient>`;
}

// A shape whose FIRST visible drop-shadow exists can't flatten losslessly (the baked
// SVG has no filter), so it falls back to the per-shape import where applyPenpotShadow
// still works.
function hasVisibleShadow(sh: PenpotShape): boolean {
  const list = Array.isArray(sh.shadow) ? sh.shadow : [];
  return list.some((e) => e && typeof e === 'object' && get(e, 'hidden') !== true);
}

// Bound on shapes serialized into one flattened group SVG (the deck's biggest
// component grid is ~1850 paths; this is headroom, not a target).
const MAX_VECTOR_GROUP_SHAPES = 4000;

/**
 * Serialize a Penpot `group` subtree into ONE standalone SVG string — the flattening
 * that turns a 500-path illustration into a single image box. viewBox = the group's
 * selrect in PAGE space (path `content` coords are absolute page coords, so no
 * re-basing is needed). Succeeds only when EVERY visible descendant is pure vector:
 * `path`/`bool` with usable content, or `circle`/`rect` with solid/gradient fills;
 * text, image fills, shadows, or unknown types return '' so mixed groups fall
 * through to the per-shape import. Child z-order follows each container's `shapes`
 * array (paint order, back-to-front). A `maskedGroup` wraps its non-mask children in
 * a <clipPath> built from the FIRST child (Penpot's mask slot) — the mask silhouette
 * itself never paints. The ROOT group's own opacity/rotation are NOT baked: the
 * caller carries them on the image box (nested group opacity IS baked, as <g opacity>).
 * @param {object} group the group shape.
 * @param {(id: string) => object|undefined} lookup shape-id → parsed shape json.
 * @returns {string} the SVG markup, or '' when the subtree isn't fully bakeable.
 */
export function penpotGroupToSvg(group: unknown, lookup: (id: string) => unknown): string {
  if (!group || typeof group !== 'object') return '';
  const g = group as PenpotShape;
  if (String(g.type || '') !== 'group') return '';
  const selRaw = (g.selrect && typeof g.selrect === 'object') ? g.selrect : g;
  const sel = selRaw as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  const vx = num(sel.x, num(g.x, 0)), vy = num(sel.y, num(g.y, 0));
  const vw = num(sel.width, num(g.width, 0)), vh = num(sel.height, num(g.height, 0));
  if (!(vw > 0) || !(vh > 0)) return '';

  let seq = 0;
  let count = 0;
  const defs: string[] = [];

  // Paint attributes for one leaf (or null = unbakeable). Gradient fills become defs;
  // fill-opacity stays on the element so strokes keep their own alpha.
  const paint = (sh: PenpotShape): string | null => {
    const fills: PenpotFill[] = Array.isArray(sh.fills) ? (sh.fills as PenpotFill[]) : [];
    if (fills.some((f) => f && f.fillImage && f.fillImage.id != null)) return null;
    const gradFill = [...fills].reverse().find((f) =>
      f && f.fillColorGradient && Array.isArray(f.fillColorGradient.stops) && f.fillColorGradient.stops.length >= 2) || null;
    const topFill: PenpotFill | null = fills.length ? (fills[fills.length - 1] ?? null) : null;
    let fill = 'none', fillOp = '';
    if (gradFill) {
      const id = `pg${seq++}`;
      // A flipped shape is emitted unflipped, so its gradient endpoints mirror.
      const def = penpotGradientSvgDef(
        mirrorPenpotGradient(gradFill.fillColorGradient, sh.flipX === true, sh.flipY === true),
        id, num(gradFill.fillOpacity, 1));
      if (!def) return null;
      defs.push(def);
      fill = `url(#${id})`;
    } else if (topFill && topFill.fillColor != null) {
      const c = safeColor(topFill.fillColor, '');
      if (!c) return null;
      fill = c;
      const fo = clamp(num(topFill.fillOpacity, 1), 0, 1);
      if (fo < 1) fillOp = ` fill-opacity="${fo}"`;
    }
    const st = topPenpotStroke(sh);
    // Style rides into the SVG verbatim: unlike the CSS-border path, real SVG can carry
    // Penpot's exact dash pattern, so dashed/dotted/mixed no longer bake solid. A
    // `strokeStyle:"none"` entry never reaches here (topPenpotStroke skips it), so it
    // emits no stroke attributes at all.
    const dashAttr = st ? penpotDashArray(String(st.style || 'solid'), st.width, st.dash, st.gap) : '';
    const capAttr = st ? penpotLineCap(st) : '';
    const stroke = st
      ? ` stroke="${st.color}" stroke-width="${st.width}"`
        + (st.opacity != null && st.opacity < 1 ? ` stroke-opacity="${st.opacity}"` : '')
        + (dashAttr ? ` stroke-dasharray="${dashAttr}"` : '')
        + (capAttr ? ` stroke-linecap="${capAttr}"` : '')
      : '';
    const op = clamp(num(sh.opacity, 1), 0, 1);
    return ` fill="${fill}"${fillOp}${stroke}${op < 1 ? ` opacity="${op}"` : ''}`;
  };

  // selrect is pre-rotation, so circle/rect leaves re-apply their rotation about the
  // centre. Path content is already page-space-final, so paths never get a transform.
  const rotAttr = (sh: PenpotShape, cx: number, cy: number): string => {
    const r = num(sh.rotation, 0);
    return r ? ` transform="rotate(${round1(r)} ${cx} ${cy})"` : '';
  };

  const leaf = (sh: PenpotShape, type: string): string | null => {
    if (hasVisibleShadow(sh)) return null;
    // Background blur reads what is painted BEHIND the group, which a standalone
    // flattened SVG has no primitive for (and no access to). Bail like a shadow does,
    // so the subtree falls to the per-shape import where bgBlur still reaches a box
    // instead of being flattened silently away.
    if (penpotBackgroundBlurPx(sh) > 0) return null;
    const p = paint(sh);
    if (p == null) return null;
    const sr = ((sh.selrect && typeof sh.selrect === 'object') ? sh.selrect : sh) as
      { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
    const x = num(sr.x, 0), y = num(sr.y, 0), w = num(sr.width, 0), h = num(sr.height, 0);
    // Layer blur bakes as a real feGaussianBlur def (Penpot value = stdDeviation, 1:1).
    // userSpaceOnUse with an explicit 3σ+8 region (export.ts's convention): selrect is
    // page-space here, and the default/percentage regions would clip the big glows.
    // Inside a maskedGroup the blurred leaf stays under the <g clip-path> — blur then
    // clip, matching Penpot's mask semantics.
    const bv = ((): number => {
      const b = sh.blur;
      if (!b || typeof b !== 'object') return 0;
      if (get(b, 'hidden') === true) return 0;
      if (String(get(b, 'type') || '') !== 'layer-blur') return 0;
      const v = num(get(b, 'value'), 0);
      return v > 0 ? v : 0;
    })();
    let filterAttr = '';
    if (bv > 0) {
      const pad = bv * 3 + 8;
      const fid = `pb${seq++}`;
      defs.push(`<filter id="${fid}" filterUnits="userSpaceOnUse" x="${x - pad}" y="${y - pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${round1(bv)}"/></filter>`);
      filterAttr = ` filter="url(#${fid})"`;
    }
    if (type === 'path' || type === 'bool') {
      const d = safePathD(penpotPathContentToD(sh.content));
      return d ? `<path d="${d}"${p}${filterAttr}/>` : null;
    }
    if (type === 'circle') {
      return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"${p}${rotAttr(sh, x + w / 2, y + h / 2)}${filterAttr}/>`;
    }
    if (type === 'rect') {
      // Unequal corner radii can't ride <rect rx>; bake the four-corner path
      // (flip-permuted). Equal corners keep the byte-identical <rect> emission.
      const corners = penpotUnequalCorners(sh);
      if (corners) {
        return `<path d="${penpotRoundedRectD(x, y, w, h, corners)}"${p}${rotAttr(sh, x + w / 2, y + h / 2)}${filterAttr}/>`;
      }
      const r1 = num(sh.r1, 0);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${r1 > 0 ? ` rx="${r1}"` : ''}${p}${rotAttr(sh, x + w / 2, y + h / 2)}${filterAttr}/>`;
    }
    return null;
  };

  const serializeGroup = (sh: PenpotShape, isRoot: boolean): string | null => {
    const ids = Array.isArray(sh.shapes) ? sh.shapes : [];
    const masked = sh.maskedGroup === true;
    const parts: string[] = [];
    let clip = '';
    for (let i = 0; i < ids.length; i++) {
      const child = lookup(String(ids[i]));
      if (!child || typeof child !== 'object') return null; // dangling ref → bail
      const cs = child as PenpotShape;
      if (cs.hidden === true) continue;
      if (++count > MAX_VECTOR_GROUP_SHAPES) return null;
      const ctype = String(cs.type || '');
      // The mask slot must be a plain shape: <clipPath> ignores <g> children.
      if (masked && i === 0 && ctype === 'group') return null;
      const frag = ctype === 'group' ? serializeGroup(cs, false) : leaf(cs, ctype);
      if (frag == null) return null;
      if (masked && i === 0) { clip = frag; continue; }
      parts.push(frag);
    }
    if (!parts.length) return isRoot ? null : '';
    const op = clamp(num(sh.opacity, 1), 0, 1);
    const opAttr = (!isRoot && op < 1) ? ` opacity="${op}"` : '';
    if (masked && clip) {
      const cid = `pc${seq++}`;
      defs.push(`<clipPath id="${cid}">${clip}</clipPath>`);
      return `<g clip-path="url(#${cid})"${opAttr}>${parts.join('')}</g>`;
    }
    return opAttr ? `<g${opAttr}>${parts.join('')}</g>` : parts.join('');
  };

  const body = serializeGroup(g, true);
  if (!body) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" ` +
    `width="${Math.max(1, Math.round(vw))}" height="${Math.max(1, Math.round(vh))}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') + body + `</svg>`;
}

/**
 * Map one Penpot binfile-v3 shape object to a DesignNode (or null to skip).
 * @param {object} shape a parsed `<shape-id>.json`.
 * @returns {object|null}
 */
export function penpotShapeToNode(shape: unknown): DesignNode | null {
  if (!shape || typeof shape !== 'object') return null;
  const sh = shape as PenpotShape;
  // The all-zeros root frame is the infinite-canvas origin (size ~0.01), not a shape.
  if (sh.id === '00000000-0000-0000-0000-000000000000') return null;
  const type = String(sh.type || '');
  const selRaw = (sh.selrect && typeof sh.selrect === 'object') ? sh.selrect : sh;
  const sel = selRaw as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  const x = num(sel.x, num(sh.x, 0));
  const y = num(sel.y, num(sh.y, 0));
  const w = num(sel.width, num(sh.width, 0));
  const h = num(sel.height, num(sh.height, 0));
  const rot = num(sh.rotation, 0);
  const shapeOp = num(sh.opacity, 1);
  const fills: PenpotFill[] = Array.isArray(sh.fills) ? (sh.fills as PenpotFill[]) : [];

  // Text — rich content tree (reuse the shared parser; it handles camelCase keys).
  if (type === 'text' && sh.content) {
    const info = parsePenpotContent(sh.content);
    const node: DesignNode = { kind: 'text', x, y, w, h, rot, text: info.text, textAlign: info.textAlign,
      opacity: clamp(Math.round(shapeOp * 100), 0, 100) };
    if (info.fg) node.fg = info.fg;
    if (info.fontSize) node.fontSize = info.fontSize;
    if (info.fontWeight) node.fontWeight = info.fontWeight;
    if (info.fontFamily) node.fontFamily = info.fontFamily;
    if (info.lineHeight) node.lineHeight = info.lineHeight;
    applyPenpotShadow(sh, node);
    applyPenpotBlur(sh, node);
    return node;
  }

  // Image fill → image node (the shell loads the bytes via _fillImageId).
  const imgFill = fills.find((f) => f && f.fillImage && f.fillImage.id != null);
  if (imgFill) {
    const node: DesignNode = {
      kind: 'image', x, y, w, h, rot,
      _fillImageId: String(imgFill.fillImage!.id),
      opacity: clamp(Math.round(shapeOp * num(imgFill.fillOpacity, 1) * 100), 0, 100),
      fit: imgFill.fillImage!.keepAspectRatio === false ? 'fill' : 'cover',
    };
    // Flip flags mirror the PIXELS, not the box — a transient marker the shell's
    // media loader consumes (boxes have no mirror field; geometry is unaffected).
    const flip = (sh.flipX === true ? 'x' : '') + (sh.flipY === true ? 'y' : '');
    if (flip) node._fillFlip = flip;
    applyPenpotStroke(sh, node);
    applyPenpotShadow(sh, node);
    applyPenpotBlur(sh, node);
    applyPenpotBackgroundBlur(sh, node);
    return node;
  }

  const topFill: PenpotFill | null = fills.length ? (fills[fills.length - 1] ?? null) : null; // last fill = topmost
  const gradFill = [...fills].reverse().find((f) =>
    f && f.fillColorGradient && Array.isArray(f.fillColorGradient.stops) && f.fillColorGradient.stops.length >= 2) || null;

  // Vector outline — `path`/`bool` carry ready SVG path data in `content`. The shell
  // bakes it into a standalone SVG asset (storeFigVector plumbing, same as a Figma
  // VECTOR); `_vectorSize` carries the PAGE-SPACE origin because Penpot path coords
  // are absolute page coords — the Figma delta, whose vectors are shape-local.
  if (type === 'path' || type === 'bool') {
    const d = penpotPathContentToD(sh.content);
    if (d) {
      const gradFirst = gradFill ? ((gradFill.fillColorGradient!.stops![0] ?? null) as { color?: unknown } | null) : null;
      // Penpot path `content` is page-space-FINAL: when the shape's transform is
      // non-identity (rotation/flip baked in), placing the baked SVG on the
      // pre-rotation selrect AND re-applying `rot` transforms it twice — so the
      // node rect becomes the content's own bbox with rot 0. Identity transforms
      // keep the byte-identical selrect + rot route (bbox ≡ selrect there anyway,
      // and paths whose bounds we can't scan fall back to it too).
      const bb = penpotTransformBaked(sh.transform) ? pathDBounds(d) : null;
      const bx = bb ? bb.x : x, by = bb ? bb.y : y;
      const bw = bb ? Math.max(1, bb.w) : w, bh = bb ? Math.max(1, bb.h) : h;
      const node: DesignNode = {
        // Explicit fill:'' — the baked SVG is transparent outside its outline, so the
        // image box must not seed a backing colour behind it (nodeToBox seedBg).
        kind: 'image', x: bx, y: by, w: bw, h: bh, rot: bb ? 0 : rot, fit: 'fill', fill: '',
        _vectorPath: d,
        // Gradient degrades to its first stop when the bake can't emit the def;
        // fill-less paths (stroke-only lines/arrows) stay unfilled, not black.
        _vectorFill: gradFirst ? (safeColor(String(gradFirst.color ?? ''), '') || 'none')
          : (topFill && topFill.fillColor != null) ? String(topFill.fillColor) : 'none',
        _vectorGradient: gradFill ? gradFill.fillColorGradient : null,
        _vectorStroke: topPenpotStroke(sh),
        _vectorSize: { w: bw, h: bh, x: bx, y: by },
        // fillOpacity folds into node opacity (uniform over the one fill this branch bakes).
        opacity: clamp(Math.round(shapeOp * num((gradFill ?? topFill)?.fillOpacity, 1) * 100), 0, 100),
      };
      applyPenpotShadow(sh, node);
      // CSS filter blur on the image box = post-composite layer blur — the right
      // semantics for a baked vector; never baked into the standalone path SVG.
      applyPenpotBlur(sh, node);
      return node;
    }
  }

  // Solid-fill shapes (rect / frame / circle …) → box. A `path`/`bool` with no usable
  // `content` still degrades to its selrect box here.
  const node: DesignNode = {
    kind: 'box', x, y, w, h, rot,
    fill: (topFill && topFill.fillColor != null) ? String(topFill.fillColor) : '',
    opacity: clamp(Math.round(shapeOp * num(topFill && topFill.fillOpacity, 1) * 100), 0, 100),
  };
  // Gradient fill → the Lolly grad spec (topmost gradient wins). The flat `fill`
  // degrades to the FIRST stop so an old engine — or a box kind without a grad
  // field — paints a plausible solid instead of transparent. Stop alpha already
  // folds the fill's own opacity, so node opacity carries the shape's alone.
  if (gradFill) {
    // The box paints unflipped, so a flipped shape's gradient endpoints mirror.
    const spec = penpotGradientToSpec(
      mirrorPenpotGradient(gradFill.fillColorGradient, sh.flipX === true, sh.flipY === true),
      w, h, num(gradFill.fillOpacity, 1));
    if (spec) {
      node.grad = spec;
      const first = (gradFill.fillColorGradient!.stops![0] ?? null) as { color?: unknown } | null;
      node.fill = safeColor(String(first?.color ?? ''), '') || node.fill;
      node.opacity = clamp(Math.round(shapeOp * 100), 0, 100);
    }
  }
  if (type === 'circle') node.shape = 'ellipse';
  // Per-corner radii: equal corners keep the byte-identical 'rounded' box; unequal
  // corners have no box-field encoding (radius is one number), so the rect routes
  // through the EXISTING vector bake as a four-corner rounded-rect path in selrect
  // space, keeping rot. Stroke rides _vectorStroke (no CSS-border inflation).
  const corners = type !== 'circle' ? penpotUnequalCorners(sh) : null;
  if (corners) {
    const gradFirst = gradFill ? ((gradFill.fillColorGradient!.stops![0] ?? null) as { color?: unknown } | null) : null;
    const vnode: DesignNode = {
      kind: 'image', x, y, w, h, rot, fit: 'fill', fill: '',
      _vectorPath: penpotRoundedRectD(x, y, w, h, corners),
      _vectorFill: gradFirst ? (safeColor(String(gradFirst.color ?? ''), '') || 'none')
        : (topFill && topFill.fillColor != null) ? String(topFill.fillColor) : 'none',
      _vectorGradient: gradFill
        ? mirrorPenpotGradient(gradFill.fillColorGradient, sh.flipX === true, sh.flipY === true) : null,
      _vectorStroke: topPenpotStroke(sh),
      _vectorSize: { w, h, x, y },
      opacity: clamp(Math.round(shapeOp * num((gradFill ?? topFill)?.fillOpacity, 1) * 100), 0, 100),
    };
    applyPenpotShadow(sh, vnode);
    applyPenpotBlur(sh, vnode);
    return vnode;
  }
  const r1 = num(sh.r1, 0);
  if (r1 > 0) { node.shape = 'rounded'; node.radius = r1; }
  applyPenpotStroke(sh, node);
  applyPenpotShadow(sh, node);
  applyPenpotBlur(sh, node);
  applyPenpotBackgroundBlur(sh, node);
  return node;
}

// Topmost stroke → the box stroke fields (rendered as a CSS border by the editor
// tools). Path/bool shapes never reach here — their stroke rides the baked SVG
// (_vectorStroke). A CSS border on box-sizing:border-box is an INSIDE stroke, so
// center/outer alignments pre-inflate the rect to land the painted edge where the
// source authored it (Penpot defaults to center when the field is absent).
function applyPenpotStroke(sh: PenpotShape, node: DesignNode): void {
  const list = Array.isArray(sh.strokes) ? sh.strokes : [];
  // Topmost usable entry, searching downwards past `strokeStyle: "none"` rows — Penpot
  // paints nothing for those (`(when-not (= style :none) ...)`), where we used to paint
  // them as a solid border because a width and a colour were still present.
  let st: unknown = null;
  let style = 'solid';
  for (let i = list.length - 1; i >= 0; i--) {
    const cand = list[i];
    if (!cand || typeof cand !== 'object') continue;
    const s = strokeStyleOf(cand);
    if (s === 'none') continue;
    if (!(num(get(cand, 'strokeWidth'), 0) > 0)) continue;
    if (!safeColor(String(get(cand, 'strokeColor') ?? ''), '')) continue;
    st = cand; style = s; break;
  }
  if (!st) return;
  const sw = num(get(st, 'strokeWidth'), 0);
  const col6 = safeColor(String(get(st, 'strokeColor') ?? ''), '');
  const a = Math.round(clamp(num(get(st, 'strokeOpacity'), 1), 0, 1) * 255);
  const full = hexLong(col6);
  node.stroke = full + (a < 255 && /^#[0-9a-fA-F]{6}$/.test(full) ? a.toString(16).padStart(2, '0') : '');
  node.strokeW = Math.round(sw * 100) / 100;
  // `mixed` has no CSS border keyword of its own; dashed is the nearest thing, and it
  // used to fall through to solid silently.
  node.strokeDash = (style === 'dashed' || style === 'mixed') ? 'dashed' : (style === 'dotted' ? 'dotted' : '');
  if (style === 'dashed') {
    // Penpot's own fallback when the user never touched the inputs is width + 10 for
    // BOTH, so the importer fills both rather than letting a half-authored pair reach
    // the hook. An authored 0 clamps to unset for v1 (Penpot's dash=0 render is a
    // fixture question, and SVG treats an all-zero dasharray as no dashing at all).
    const d = strokeLen(st, 'stroke-dash');
    const g = strokeLen(st, 'stroke-gap');
    node.strokeDashLen = round2((d != null && d > 0) ? d : sw + 10);
    node.strokeGapLen = round2((g != null && g > 0) ? g : sw + 10);
  }
  const alignment = String(get(st, 'strokeAlignment') || 'center');
  const inflate = alignment === 'outer' ? sw : (alignment === 'inner' ? 0 : sw / 2);
  if (inflate > 0) {
    node.x = num(node.x, 0) - inflate; node.y = num(node.y, 0) - inflate;
    node.w = num(node.w, 0) + 2 * inflate; node.h = num(node.h, 0) + 2 * inflate;
    if (node.shape === 'rounded') node.radius = num(node.radius, 0) + inflate;
  }
}

// Expand #rgb/#rgba shorthand to full length so an alpha suffix can append without
// producing a malformed 5/7-digit hex; non-hex colours pass through unchanged.
function hexLong(c: string): string {
  const m = /^#([0-9a-fA-F]{3,4})$/.exec(c);
  if (!m) return c;
  return '#' + m[1]!.split('').map((ch) => ch + ch).join('');
}

// First visible drop-shadow → the box shadow fields. The target select follows the
// node kind (text-shadow for text, alpha-silhouette drop-shadow for images, else the
// box outline). Colour opacity folds into an 8-digit hex; `spread` has no box-model
// counterpart and is dropped; inner-shadow and a degenerate 0/0/0 entry stay 'none'.
function applyPenpotShadow(sh: PenpotShape, node: DesignNode): void {
  const list = Array.isArray(sh.shadow) ? sh.shadow : [];
  const s = list.find((e) => e && typeof e === 'object'
    && String(get(e, 'style') || 'drop-shadow') === 'drop-shadow' && get(e, 'hidden') !== true) as
    { color?: { color?: unknown; opacity?: unknown } | null; offsetX?: unknown; offsetY?: unknown; blur?: unknown } | undefined;
  if (!s) return;
  const x = Math.round(num(s.offsetX, 0)), y = Math.round(num(s.offsetY, 0)), blur = Math.round(num(s.blur, 0));
  if (!x && !y && !blur) return;
  const hex6 = hexLong(safeColor(String(s.color?.color ?? ''), '#000000'));
  const a = Math.round(clamp(num(s.color?.opacity, 1), 0, 1) * 255);
  node.shadow = node.kind === 'text' ? 'text' : (node.kind === 'image' ? 'content' : 'box');
  node.shadowColor = hex6 + (a < 255 && /^#[0-9a-fA-F]{6}$/.test(hex6) ? a.toString(16).padStart(2, '0') : '');
  node.shadowX = x; node.shadowY = y; node.shadowBlur = blur;
}

// Penpot layer blur → box blur. Penpot renders layer-blur as feGaussianBlur with
// stdDeviation = value (frontend filters.cljs) and CSS blur(N) is stdDeviation N,
// so value maps to blur(<value>px) 1:1. Background blur is a SEPARATE attribute
// (`backgroundBlur`) since Penpot 2.17 — see penpotBackgroundBlurPx below; it never
// reaches node.blur, not even in its legacy `blur: {type:'background-blur'}` form.
function applyPenpotBlur(sh: PenpotShape, node: DesignNode): void {
  const b = sh.blur;
  if (!b || typeof b !== 'object') return;
  if (get(b, 'hidden') === true) return;
  if (String(get(b, 'type') || '') !== 'layer-blur') return;
  const v = num(get(b, 'value'), 0);
  if (v > 0) node.blur = v;
}

// The one radius conversion for background blur, so the importer, the group-flatten
// bail and the shell's warn all agree.
//
// Penpot 2.17 (PR #10034) moved background blur onto its own shape attribute:
//   backgroundBlur: { id, type: 'background-blur', value, hidden }
// a SIBLING of `blur` — a shape may legally carry both. Pre-2.17 files instead carry
// `blur: { type: 'background-blur' }`, and no Penpot migration rewrites them, so that
// legacy form is accepted here and treated as background blur, never as layer blur.
//
// Radius: Penpot's shipping renderer is Skia, which converts the authored radius with
// SkBlurMask::ConvertRadiusToSigma — sigma = 0.57735 * value + 0.5 — while CSS
// `backdrop-filter: blur(R)` is a Gaussian of sigma R/2. Equating the two gives
// R = 2 * (0.57735 * value + 0.5) = 1.1547 * value + 1. This is an APPROXIMATION: it
// matches the sigma, not Penpot's clipping/tiling behaviour, and the constant is
// pinned by a test so a future fixture comparison can move it deliberately. (Penpot's
// own SVG `value/2` filter is dead code — their shape->filters never emits it.)
const BG_BLUR_SIGMA_A = 1.1547;
const BG_BLUR_SIGMA_B = 1;

/**
 * Visible background-blur radius of a Penpot shape, already converted to the CSS
 * `backdrop-filter: blur(Npx)` radius our box field carries. 0 when the shape has
 * none, has it hidden, or authored it at 0.
 * @param {object} sh a parsed Penpot shape.
 * @returns {number} px radius for `bgBlur`, or 0.
 */
export function penpotBackgroundBlurPx(sh: unknown): number {
  // Own attribute first; fall back to the legacy in-`blur` form.
  const own = get(sh, 'backgroundBlur');
  const legacy = get(sh, 'blur');
  const entry = (own && typeof own === 'object') ? own
    : ((legacy && typeof legacy === 'object'
      && String(get(legacy, 'type') || '') === 'background-blur') ? legacy : null);
  if (!entry) return 0;
  if (get(entry, 'hidden') === true) return 0;
  // The own attribute's type is checked too: a hand-edited/unknown type is not
  // silently rendered as a backdrop blur.
  if (entry === own && String(get(entry, 'type') || 'background-blur') !== 'background-blur') return 0;
  const v = num(get(entry, 'value'), 0);
  if (!(v > 0)) return 0;
  return clamp(round1(v * BG_BLUR_SIGMA_A + BG_BLUR_SIGMA_B), 0, 300);
}

// Background blur → the box `bgBlur` field (CSS backdrop-filter). v1 carries it only
// on nodes whose painted region IS the box rect — a plain box and an image-fill box.
// Text shapes (Penpot masks the blur to the glyphs) and baked vector art (the frost
// would become a rectangle behind an arbitrary outline) drop it; the shell warns once
// per import batch so the loss is never silent.
function applyPenpotBackgroundBlur(sh: PenpotShape, node: DesignNode): void {
  const px = penpotBackgroundBlurPx(sh);
  if (px > 0) node.bgBlur = px;
}

// ── Penpot export marks ──────────────────────────────────────────────────────
// Penpot's "mark for export" data rides each shape as an `exports` array of
// {type, suffix, scale} entries. The walk below is pure tree/tally work (no
// provider or storage knowledge), so it lives here beside the other Penpot
// mappers; the shell decides how each entry becomes a stored asset.

/** One normalized entry from a shape's `exports` array. */
export interface PenpotExportEntry {
  type: 'png' | 'jpeg' | 'svg';
  scale: number;
  suffix: string;
}

/** One export-marked shape with its deduped, normalized entries. */
export interface PenpotExportMark {
  shape: PenpotShape;
  entries: PenpotExportEntry[];
}

// Normalize one shape's raw `exports` array: explicit === type comparisons (an
// object-keyed whitelist would answer true for prototype keys), scale clamped to
// 0.1..8 (default 1 — a scale of 0 clamps to 0.1, it does not default), suffix
// stringified with null/undefined → ''. Entries dedupe by type|scale|suffix
// (the wild identical-duplicate case). Unknown types drop SILENTLY here — the
// shell scans the raw array itself when it wants to warn about them.
function normalizePenpotExports(raw: unknown): PenpotExportEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PenpotExportEntry[] = [];
  const seen = new Set<string>();
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const t = String(get(e, 'type') ?? '');
    const type = t === 'png' ? 'png' : t === 'jpeg' ? 'jpeg' : t === 'svg' ? 'svg' : null;
    if (!type) continue;
    const scale = clamp(num(get(e, 'scale'), 1), 0.1, 8);
    const suffixRaw = get(e, 'suffix');
    const suffix = suffixRaw == null ? '' : String(suffixRaw);
    const key = `${type}|${scale}|${suffix}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type, scale, suffix });
  }
  return out;
}

/**
 * Collect every export-marked shape on one Penpot page, in paint order (DFS from
 * the root frame along each container's `shapes` array; unreachable orphans
 * follow in map order). Pruned wholesale, subtree included: `hidden` shapes
 * (hidden hides the whole subtree in Penpot) and component MASTER boards
 * (componentRoot + mainInstance) — a master subtree is a definition, not
 * content, so a mark on the master OR on any of its descendants yields nothing.
 * @param {object} shapesById shape-id → parsed `<shape-id>.json` for one page.
 * @returns {PenpotExportMark[]} kept marks with normalized, deduped entries.
 */
export function collectPenpotExportMarks(shapesById: Record<string, unknown>): PenpotExportMark[] {
  const out: PenpotExportMark[] = [];
  const seen = new Set<string>();
  // Consume a pruned subtree so the orphan sweep can't revisit its descendants.
  const markSubtreeSeen = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const s = shapesById[id];
    const kids = (s && typeof s === 'object' && Array.isArray((s as PenpotShape).shapes))
      ? (s as PenpotShape).shapes as unknown[] : [];
    for (const k of kids) markSubtreeSeen(String(k));
  };
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const s = shapesById[id];
    if (!s || typeof s !== 'object') return;
    const sh = s as PenpotShape;
    const kids = Array.isArray(sh.shapes) ? sh.shapes as unknown[] : [];
    if (sh.hidden === true || (sh.componentRoot === true && sh.mainInstance === true)) {
      for (const k of kids) markSubtreeSeen(String(k));
      return;
    }
    const entries = normalizePenpotExports(sh.exports);
    if (entries.length) out.push({ shape: sh, entries });
    for (const k of kids) visit(String(k));
  };
  visit('00000000-0000-0000-0000-000000000000');
  for (const id of Object.keys(shapesById)) visit(id);
  return out;
}

// ── Penpot prototype flow → scene order + per-scene enter transitions ────────
//
// Observed serialization (tests/fixtures/penpot-kitchen-sink.penpot, a genuine
// Penpot 2.17.1-RC4 export — pinned in tests/penpot-kitchen-sink.test.ts):
//
//   shape.interactions = [{
//     eventType: 'click', actionType: 'navigate',
//     destination: '<shape id>', positionRelativeTo: '<shape id>',
//     preserveScroll: false,
//     animation: { animationType: 'dissolve', duration: 300, easing: 'linear' },
//   }]
//   page.flows = { '<id>': { id, name: 'Flow 1', startingFrame: '<frame id>' } }
//
// Two corrections against the inference that shipped in the plan: the action is
// `navigate`, NOT `navigate-to` (both are accepted below — a Penpot version that
// writes the hyphenated form still reads), and the starting frame lives on the
// PAGE record's `flows` map, not on the shape.

/** One board's authored entrance, in sequence-studio's shipped vocabulary. */
export interface PenpotSceneTransition {
  /** A `TRANSITIONS` key: 'fade' | 'slide-left'|'slide-right'|'slide-up'|'slide-down' | 'none'. */
  enter: string;
  /** The authored duration in ms, clamped to the timeline's 100..3000 range. Absent for a cut. */
  enterMs?: number;
}

/** The result of walking a page's prototype graph. */
export interface PenpotFlowOrder {
  /** Every input board id, in flow order (identical to the input when `hasFlow` is false). */
  ordered: string[];
  /** boardId → the entrance authored on the edge INTO it. Only boards entered via an edge appear. */
  transitions: Record<string, PenpotSceneTransition>;
  /** Whether any usable navigate edge was found — false means callers keep the reading-order path. */
  hasFlow: boolean;
}

// The timeline's own bounds (bridge/sequence-plan.ts MIN/MAX_TRANSITION_MS),
// restated here rather than imported: the engine may not depend on a shell.
const FLOW_MIN_MS = 100;
const FLOW_MAX_MS = 3000;

/**
 * Map one Penpot `animation` object onto sequence-studio's per-box `enter`/`enterMs`.
 *
 * | Penpot `animationType` | enter |
 * |---|---|
 * | `dissolve` | `fade` |
 * | `slide` / `push` + `direction` | `slide-<direction>` |
 * | missing / anything else | `none` (a hard cut — no motion is invented) |
 *
 * `direction` maps through UNCHANGED because both vocabularies name the direction
 * the incoming content TRAVELS: Penpot's push-right moves boards rightwards (the
 * new one starting off-screen left), and lolly's `slide-right` is labelled "Slide
 * from left" for exactly that reason. A slide with no recognised direction is a
 * cut, not a guess. `way: 'in'|'out'` is ignored in v1 — exit transitions are not
 * modelled, so an out-slide still reads as the incoming board's entrance.
 * @param {unknown} animation the interaction's nested `animation` object.
 * @returns {PenpotSceneTransition} always a valid entrance; `{enter:'none'}` when unmapped.
 */
export function penpotAnimationToTransition(animation: unknown): PenpotSceneTransition {
  const type = String(get(animation, 'animationType') ?? '').toLowerCase();
  let enter = 'none';
  if (type === 'dissolve') enter = 'fade';
  else if (type === 'slide' || type === 'push') {
    const dir = String(get(animation, 'direction') ?? '').toLowerCase();
    if (dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down') enter = 'slide-' + dir;
  }
  if (enter === 'none') return { enter: 'none' };
  const ms = num(get(animation, 'duration'), undefined);
  return ms === undefined
    ? { enter }
    : { enter, enterMs: Math.round(clamp(ms, FLOW_MIN_MS, FLOW_MAX_MS)) };
}

/**
 * Order a page's top-level boards by its authored prototype flow, and collect the
 * entrance transition each board is navigated to with.
 *
 * The graph: every `navigate` interaction on any shape INSIDE a board is an edge
 * from that board to the board owning the interaction's `destination` (a nested
 * destination frame resolves up to its top-level board). Self-edges, edges to
 * shapes outside the given board list, and non-navigate actions are dropped.
 *
 * The walk, deterministic end to end:
 *  - **Start** = the first `flows[].startingFrame` that is a known board; else the
 *    first board (in the given reading order) with out-edges and no in-edges; else
 *    the first board with any edge; else the first board.
 *  - **Chain**: follow the first authored, unvisited successor of the current board.
 *  - **Branches**: first authored edge wins; the other targets are picked up later
 *    by the reading-order sweep (and their own chains are then followed).
 *  - **Cycles**: the visited set ends a chain when every successor is already placed.
 *  - **Orphans / unreachable boards**: appended in reading order at the point the
 *    walk stalls, each continuing the walk from there.
 *
 * With no usable edges `hasFlow` is false and `ordered` is the input order copied,
 * so a zero-interaction file is byte-identical to the reading-order path.
 * @param {string[]} boardIds top-level board ids in READING order (the fallback + tie-break).
 * @param {Record<string, unknown>} shapesById shape-id → parsed shape json for one page.
 * @param {{flows?: unknown}} [page] the page record, for its `flows` starting frames.
 * @returns {PenpotFlowOrder}
 */
export function penpotFlowOrder(
  boardIds: string[],
  shapesById: Record<string, unknown>,
  page?: { flows?: unknown } | null,
): PenpotFlowOrder {
  const order = boardIds.map((id) => String(id));
  const boards = new Set(order);
  const empty = (): PenpotFlowOrder => ({ ordered: [...order], transitions: {}, hasFlow: false });
  if (order.length < 2) return empty();

  // shape id → the top-level board that owns it (a board owns itself). Cycle-guarded:
  // a malformed file whose `shapes` arrays loop must not hang the import.
  const owner = new Map<string, string>();
  for (const bid of order) {
    const stack = [bid];
    while (stack.length) {
      const id = stack.pop()!;
      if (owner.has(id)) continue;
      owner.set(id, bid);
      const kids = get(shapesById[id], 'shapes');
      if (Array.isArray(kids)) for (const k of kids) stack.push(String(k));
    }
  }

  // Edges in authored order: boards in reading order, shapes in the owner walk's
  // map order, interactions in array order.
  const edges = new Map<string, Array<{ to: string; anim: PenpotSceneTransition }>>();
  let edgeCount = 0;
  for (const [sid, bid] of owner) {
    const list = get(shapesById[sid], 'interactions');
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      const action = String(get(it, 'actionType') ?? '').toLowerCase();
      if (action !== 'navigate' && action !== 'navigate-to') continue;
      const dest = get(it, 'destination');
      if (typeof dest !== 'string' || !dest) continue;
      const to = owner.get(dest) ?? (boards.has(dest) ? dest : undefined);
      if (!to || to === bid) continue;
      const from = edges.get(bid) ?? [];
      if (!edges.has(bid)) edges.set(bid, from);
      from.push({ to, anim: penpotAnimationToTransition(get(it, 'animation')) });
      edgeCount++;
    }
  }
  if (!edgeCount) return empty();

  const inDeg = new Map<string, number>();
  for (const [, outs] of edges) for (const e of outs) inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);

  // Start: authored flow first — the page record is the file's own answer.
  let start = '';
  const flows = get(page, 'flows');
  const flowList: unknown[] = Array.isArray(flows) ? flows : (flows && typeof flows === 'object' ? Object.values(flows as Record<string, unknown>) : []);
  for (const f of flowList) {
    const sf = get(f, 'startingFrame');
    const bid = typeof sf === 'string' ? (owner.get(sf) ?? '') : '';
    if (bid && boards.has(bid)) { start = bid; break; }
  }
  if (!start) start = order.find((b) => (edges.get(b)?.length ?? 0) > 0 && !(inDeg.get(b) ?? 0)) ?? '';
  if (!start) start = order.find((b) => (edges.get(b)?.length ?? 0) > 0 || inDeg.has(b)) ?? order[0]!;

  const ordered: string[] = [];
  const transitions: Record<string, PenpotSceneTransition> = {};
  const placed = new Set<string>();
  let cursor: string | undefined = start;
  while (ordered.length < order.length) {
    if (cursor === undefined || placed.has(cursor)) {
      cursor = order.find((b) => !placed.has(b));
      if (cursor === undefined) break;
    }
    ordered.push(cursor);
    placed.add(cursor);
    const next: { to: string; anim: PenpotSceneTransition } | undefined =
      (edges.get(cursor) ?? []).find((e) => !placed.has(e.to));
    if (next) {
      // Only a real entrance is recorded — a cut leaves the scene's own default alone.
      if (next.anim.enter !== 'none') transitions[next.to] = next.anim;
      cursor = next.to;
    } else cursor = undefined;
  }
  return { ordered, transitions, hasFlow: true };
}

// ── Figma .fig (Kiwi) document → DesignNodes ─────────────────────────────────
// A .fig decodes to a flat `nodeChanges` list forming a tree via `parentIndex.guid`.
// Geometry is a parent-RELATIVE 2×3 `transform` {m00,m01,m02,m10,m11,m12} + `size`
// {x:w,y:h}. We accumulate transforms down the tree to an absolute matrix, then reuse
// boxGeomFromBBox on the node's local (0,0,w,h) box — the same maths as the SVG path.
// The shell owns Kiwi decode + zstd + image bytes; this stays pure and testable.

interface FigTransform { m00?: unknown; m01?: unknown; m02?: unknown; m10?: unknown; m11?: unknown; m12?: unknown; }
interface FigGuid { sessionID?: unknown; localID?: unknown; }
interface FigTextData { characters?: unknown; characterStyleIDs?: unknown; styleOverrideTable?: unknown; }
interface FigNode {
  type?: unknown;
  size?: { x?: unknown; y?: unknown } | null;
  opacity?: unknown;
  visible?: unknown;
  fillPaints?: unknown;
  strokePaints?: unknown;
  strokeWeight?: unknown;
  fillGeometry?: unknown;
  fontSize?: unknown;
  fontName?: { style?: unknown; family?: unknown } | null;
  textAlignHorizontal?: unknown;
  lineHeight?: unknown;
  cornerRadius?: unknown;
  name?: unknown;
  textData?: FigTextData | null;
  transform?: FigTransform | null;
  guid?: FigGuid | null;
  parentIndex?: { guid?: FigGuid | null } | null;
  internalOnly?: unknown;
}
type FigBlobs = ReadonlyArray<{ bytes?: Uint8Array } | null | undefined> | null | undefined;

// Figma transform → SVG/CSS matrix {a,b,c,d,e,f}. (x,y) → (m00·x+m01·y+m02, m10·x+m11·y+m12).
function figMatrix(node: FigNode | null | undefined): Matrix {
  const t: FigTransform = (node && node.transform) || {};
  return { a: num(t.m00, 1), b: num(t.m10, 0), c: num(t.m01, 0), d: num(t.m11, 1), e: num(t.m02, 0), f: num(t.m12, 0) };
}
// Compose two 2×3 affines: P (parent) ∘ C (child).
function matMul(P: Matrix, C: Matrix): Matrix {
  return {
    a: P.a * C.a + P.c * C.b,
    b: P.b * C.a + P.d * C.b,
    c: P.a * C.c + P.c * C.d,
    d: P.b * C.c + P.d * C.d,
    e: P.a * C.e + P.c * C.f + P.e,
    f: P.b * C.e + P.d * C.f + P.f,
  };
}
function fig255(v: unknown): number { return clamp(Math.round(num(v, 0) * 255), 0, 255); }
function figColorHex(c: unknown): string {
  if (!c) return '';
  const h = (v: unknown): string => fig255(v).toString(16).padStart(2, '0');
  return '#' + h(get(c, 'r')) + h(get(c, 'g')) + h(get(c, 'b'));
}
// Figma weight names → the variable-font 100-step axis. Specific-before-general so
// "SemiBold"/"ExtraBold" don't match the bare "Bold" rule first.
const FIG_WEIGHTS: Array<[RegExp, number]> = [
  [/thin|hairline/i, 100], [/(extra|ultra)[\s-]*light/i, 200], [/light/i, 300],
  [/(semi|demi)[\s-]*bold/i, 600], [/(extra|ultra)[\s-]*bold/i, 800], [/black|heavy/i, 900],
  [/bold/i, 700], [/medium/i, 500], [/regular|normal|book/i, 400],
];
function figWeight(style: unknown): number {
  const s = String(style || '');
  for (const [re, w] of FIG_WEIGHTS) if (re.test(s)) return w;
  return 400;
}
function figAlign(a: unknown): string {
  const s = String(a || '').toUpperCase();
  if (s === 'CENTER') return 'center';
  if (s === 'RIGHT') return 'right';
  return 'left'; // LEFT / JUSTIFIED / omitted (Figma drops it when LEFT)
}
// Figma lineHeight {value, units: PERCENT|PIXELS|RAW/AUTO} → a unitless ratio (box model).
function figLineHeight(lh: unknown, fontSize: unknown): number | null {
  const l = lh as { value?: unknown; units?: unknown } | null | undefined;
  if (!l || l.value == null) return null;
  const v = num(l.value, 0);
  if (l.units === 'PERCENT') return v / 100;
  if (l.units === 'PIXELS' || l.units === 'RAW') { const fs = num(fontSize, 0); return fs > 0 ? v / fs : null; }
  return null; // AUTO / unknown → let nodeToBox default it
}
function figImageHash(paint: unknown): string | null {
  const img = paint && (get(paint, 'image') || get(paint, 'imageRef') || paint);
  const h = img && (get(img, 'hash') || get(img, 'imageRef') || get(img, 'imageHash'));
  if (typeof h === 'string') return h;
  if (Array.isArray(h)) return (h as unknown[]).map((b) => ((b as number) & 0xff).toString(16).padStart(2, '0')).join('');
  return null;
}

const VISUAL_FIG: Record<string, number> = {
  FRAME: 1, RECTANGLE: 1, ROUNDED_RECTANGLE: 1, ELLIPSE: 1, TEXT: 1, VECTOR: 1,
  LINE: 1, REGULAR_POLYGON: 1, STAR: 1, BOOLEAN_OPERATION: 1, SECTION: 1,
};

/**
 * Decode a Figma vector "commands" blob into an SVG path `d`. Command tags: 0 = close (Z),
 * 1 = move (M, 2 floats), 2 = line (L, 2f), 3 = quad (Q, 4f), 4 = cubic (C, 6f); coords are
 * float32 LE in the shape's local space. Lets a VECTOR import as its real outline instead of
 * a bounding rectangle (the shell rasterises the path). Malformed tail bytes just stop it.
 * @param {Uint8Array|number[]} bytes
 * @returns {string} SVG path data (empty if undecodable).
 */
export function decodeFigVectorPath(bytes: Uint8Array | number[] | null | undefined): string {
  const b = bytes instanceof Uint8Array ? bytes : (bytes && bytes.length ? Uint8Array.from(bytes) : null);
  if (!b || !b.length) return '';
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let off = 0; let d = '';
  const f = (): number => { const v = dv.getFloat32(off, true); off += 4; return Math.round(v * 100) / 100; };
  const room = (n: number): boolean => off + n * 4 <= b.length;
  const NF: Record<number, number> = { 0: 0, 1: 2, 2: 2, 3: 4, 4: 6 };
  const LT: Record<number, string> = { 0: 'Z', 1: 'M', 2: 'L', 3: 'Q', 4: 'C' };
  while (off < b.length) {
    const tag = dv.getUint8(off); off += 1;
    const nf = NF[tag];
    if (nf == null) break;                 // unknown tag → stop (partial path is still useful)
    if (!room(nf)) break;
    d += LT[tag]!;
    for (let k = 0; k < nf; k++) d += (k ? ' ' : '') + f();
    d += ' ';
  }
  return d.trim();
}

// Figma per-character text colour: `characterStyleIDs` maps each char index to a
// `styleOverrideTable` entry whose fillPaints override the node's base fill. Runs that
// differ from baseFg become `{#hex|…}` wraps; a '\n' never carries a colour.
function figmaTextRuns(node: FigNode, baseFg: string): string {
  const td: FigTextData = node.textData || {};
  const chars = String(td.characters != null ? td.characters : (node.name || ''));
  const ids = Array.isArray(td.characterStyleIDs) ? (td.characterStyleIDs as unknown[]) : null;
  const tbl: Record<string, string> = {};
  for (const s of (Array.isArray(td.styleOverrideTable) ? (td.styleOverrideTable as unknown[]) : [])) {
    const c = s && get(get(s, 'fillPaints'), '0') && get(get(get(s, 'fillPaints'), '0'), 'color');
    const styleID = get(s, 'styleID');
    if (s && styleID != null && c) tbl[String(styleID)] = figColorHex(c);
  }
  if (!ids || !ids.length || !Object.keys(tbl).length) return chars; // single colour → plain
  const arr = [...chars];
  const runs: ColorRun[] = arr.map((ch, k) => ({ text: ch, color: ch === '\n' ? '' : (tbl[String(ids[k])] || baseFg) }));
  return colorRunsToText(runs, baseFg);
}

function figmaNode(node: FigNode, abs: Matrix, blobs: FigBlobs): DesignNode | null {
  const type = String(node.type || '');
  const size = node.size;
  if (!VISUAL_FIG[type] || !size) return null;
  const geom = boxGeomFromBBox({ x: 0, y: 0, width: num(size.x, 0), height: num(size.y, 0) }, abs);
  const base = { x: geom.x, y: geom.y, w: geom.w, h: geom.h, rot: geom.rot };
  const nodeOp = num(node.opacity, 1);
  const fills = Array.isArray(node.fillPaints) ? (node.fillPaints as unknown[]).filter((p) => p && get(p, 'visible') !== false) : [];
  const paint = fills.length ? (fills[fills.length - 1] ?? null) : null; // topmost visible fill

  if (type === 'TEXT') {
    const baseFg = paint && get(paint, 'color') ? figColorHex(get(paint, 'color')) : '#000000';
    return {
      kind: 'text', ...base,
      text: figmaTextRuns(node, baseFg),
      fg: baseFg,
      fontSize: num(node.fontSize, undefined),
      fontWeight: figWeight(node.fontName && node.fontName.style),
      fontFamily: (node.fontName && node.fontName.family) || '',
      textAlign: figAlign(node.textAlignHorizontal),
      lineHeight: figLineHeight(node.lineHeight, num(node.fontSize, 16)) || undefined,
      opacity: clamp(Math.round(nodeOp * 100), 0, 100),
    };
  }
  if (paint && get(paint, 'type') === 'IMAGE') {
    return { kind: 'image', ...base, _imageHash: figImageHash(paint), fit: 'cover',
      opacity: clamp(Math.round(nodeOp * num(get(paint, 'opacity'), 1) * 100), 0, 100) };
  }
  // VECTOR (custom path): reconstruct the real outline from fillGeometry so it doesn't
  // degrade to a rectangle. The shell rasterises `_vectorPath` into a data-URI SVG image
  // placed at the node's rect (fit:'fill', local viewBox = _vectorSize).
  if (type === 'VECTOR' && blobs && Array.isArray(node.fillGeometry) && (node.fillGeometry as unknown[]).length) {
    const d = (node.fillGeometry as unknown[]).map((g) => {
      const cb = get(g, 'commandsBlob');
      const entry = (g && cb != null && blobs) ? blobs[cb as number] : null;
      const blob = entry ? entry.bytes : null;
      return blob ? decodeFigVectorPath(blob) : '';
    }).filter(Boolean).join(' ');
    if (d) {
      // Stroke: Figma tessellates it separately, but strokeAlign CENTER + a solid stroke
      // paint is exactly a plain SVG stroke on the fill path — so render it that way
      // (faithful for centre strokes; inside/outside are approximated as centre).
      const sp = Array.isArray(node.strokePaints)
        ? (node.strokePaints as unknown[]).find((p) => p && get(p, 'visible') !== false && get(p, 'type') === 'SOLID' && get(p, 'color')) : null;
      const sw = num(node.strokeWeight, 0);
      return {
        kind: 'image', ...base, fit: 'fill',
        _vectorPath: d,
        _vectorFill: (paint && get(paint, 'type') === 'SOLID' && get(paint, 'color')) ? figColorHex(get(paint, 'color')) : 'none',
        _vectorStroke: (sp && sw > 0) ? { color: figColorHex(get(sp, 'color')), width: sw } : null,
        _vectorSize: { w: num(size.x, 0), h: num(size.y, 0) },
        opacity: clamp(Math.round(nodeOp * num(paint && get(paint, 'opacity'), 1) * 100), 0, 100),
      };
    }
  }
  const dn: DesignNode = { kind: 'box', ...base,
    fill: (paint && get(paint, 'type') === 'SOLID' && get(paint, 'color')) ? figColorHex(get(paint, 'color')) : '',
    opacity: clamp(Math.round(nodeOp * num(paint && get(paint, 'opacity'), 1) * 100), 0, 100) };
  if (type === 'ELLIPSE') dn.shape = 'ellipse';
  else if (type === 'ROUNDED_RECTANGLE') { dn.shape = 'rounded'; dn.radius = num(node.cornerRadius, 12); }
  else { const cr = num(node.cornerRadius, 0); if (cr > 0) { dn.shape = 'rounded'; dn.radius = cr; } }
  return dn;
}

/**
 * Walk a decoded Figma document (its `nodeChanges` array) into DesignNodes. Skips the
 * document/canvas containers and Figma's internal scratch canvas; imports the first real
 * page's tree, accumulating parent transforms to absolute geometry. Image fills come back
 * with an `_imageHash` marker the shell resolves from the .fig's bundled images.
 * @param {object[]} nodeChanges
 * @param {Array<{bytes:Uint8Array}>} [blobs] the document's blob table (for vector paths).
 * @returns {object[]} DesignNodes (feed to finalizeBoxes after resolving images/vectors).
 */
/**
 * One frame/board of a design file, split out as a self-contained scene: its nodes
 * shifted to the frame's own origin, sized to the frame's crop. Produced by
 * `figmaNodesToScenes` (and the shell's per-board Penpot walk) so a sequence editor
 * can turn every frame into a timed scene.
 */
export interface DesignFrameScene {
  name: string;
  width: number;
  height: number;
  nodes: DesignNode[];
}

export function figmaNodesToNodes(nodeChanges: unknown, blobs?: FigBlobs): DesignNode[] {
  const list: FigNode[] = Array.isArray(nodeChanges) ? (nodeChanges as FigNode[]) : [];
  const key = (g: FigGuid | null | undefined): string => (g ? String(g.sessionID) + ':' + String(g.localID) : '');
  const kids: Record<string, FigNode[]> = {};
  for (const n of list) {
    if (n && n.parentIndex && n.parentIndex.guid) {
      const p = key(n.parentIndex.guid);
      (kids[p] || (kids[p] = [])).push(n);
    }
  }
  const canvases = list.filter((n) => n && n.type === 'CANVAS' && !n.internalOnly && n.name !== 'Internal Only Canvas');
  const page = canvases[0] || list.find((n) => n && n.type === 'CANVAS');
  if (!page) return [];

  const out: DesignNode[] = [];
  const visit = (node: FigNode | null | undefined, pabs: Matrix): void => {
    if (!node || node.visible === false) return;
    const abs = matMul(pabs, figMatrix(node));
    const dn = figmaNode(node, abs, blobs);
    if (dn) out.push(dn);
    const cs = kids[key(node.guid)];
    if (cs) for (const c of cs) visit(c, abs);
  };
  const pageAbs = figMatrix(page);
  for (const c of (kids[key(page.guid)] || [])) visit(c, pageAbs);
  return out;
}

// Translate nodes so their union starts at (0,0); returns the union size. The
// engine twin of the shell's shiftToOrigin (design-import.ts) for loose shapes
// that belong to no frame.
function shiftNodesToOrigin(nodes: DesignNode[]): { width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const x = num(n.x, 0), y = num(n.y, 0);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + num(n.w, 0)); maxY = Math.max(maxY, y + num(n.h, 0));
  }
  if (!isFinite(minX)) return { width: 1080, height: 1080 };
  for (const n of nodes) { n.x = num(n.x, 0) - minX; n.y = num(n.y, 0) - minY; }
  return { width: Math.max(1, Math.round(maxX - minX)), height: Math.max(1, Math.round(maxY - minY)) };
}

/**
 * Order frames the way a person reads a storyboard: rows top-to-bottom, then
 * left-to-right within a row. Design canvases store children in Z/creation
 * order (Penpot's root `shapes`, Figma's canvas children), so a deck imported
 * in that order plays backwards or shuffled — spatial order is what the frames'
 * layout actually says. Rows are clustered by vertical overlap of frame
 * centres (tolerance = half the median frame height), so slight hand-placed
 * jitter doesn't split a row. Pure + stable for equal positions.
 * @param {T[]} items
 * @param {(t: T) => {x:number,y:number,w:number,h:number}} rect
 * @returns {T[]} a new sorted array.
 */
export function readingOrder<T>(items: T[], rect: (t: T) => { x: number; y: number; w: number; h: number }): T[] {
  if (items.length < 2) return [...items];
  const heights = items.map((t) => rect(t).h).sort((a, b) => a - b);
  const tol = Math.max(1, (heights[Math.floor(heights.length / 2)] ?? 0) / 2);
  const byY = [...items].sort((a, b) => (rect(a).y + rect(a).h / 2) - (rect(b).y + rect(b).h / 2));
  const rows: T[][] = [];
  let rowYc = -Infinity;
  for (const t of byY) {
    const yc = rect(t).y + rect(t).h / 2;
    if (!rows.length || yc - rowYc > tol) { rows.push([t]); rowYc = yc; }
    else {
      const row = rows[rows.length - 1]!;
      row.push(t);
      // Running row centre so a gently descending row doesn't drift past tol.
      rowYc = row.reduce((s, r) => s + rect(r).y + rect(r).h / 2, 0) / row.length;
    }
  }
  return rows.flatMap((row) => row.sort((a, b) => rect(a).x - rect(b).x));
}

// Container types whose top-level instances read as "one frame = one scene".
// SECTION is Figma's slide/grouping container; a top-level COMPONENT/INSTANCE is
// how many deck files store their slides.
const FIG_FRAME_TYPES = new Set(['FRAME', 'SECTION', 'COMPONENT', 'INSTANCE', 'SYMBOL']);

/**
 * Walk a decoded Figma document into per-frame scenes: every top-level frame on
 * every real page becomes one `DesignFrameScene` (nodes shifted to the frame's
 * origin, size = the frame's crop — content overflowing the frame stays put and
 * is cropped at render, matching Figma). Loose top-level shapes on a page are
 * collected into one extra scene per page. Same node production as
 * `figmaNodesToNodes` (image fills come back with `_imageHash` markers), so the
 * shell resolves media identically for both walks.
 * @param {object[]} nodeChanges
 * @param {Array<{bytes:Uint8Array}>} [blobs]
 * @returns {DesignFrameScene[]} in page order, frames before the page's loose scene.
 */
export function figmaNodesToScenes(nodeChanges: unknown, blobs?: FigBlobs): DesignFrameScene[] {
  const list: FigNode[] = Array.isArray(nodeChanges) ? (nodeChanges as FigNode[]) : [];
  const key = (g: FigGuid | null | undefined): string => (g ? String(g.sessionID) + ':' + String(g.localID) : '');
  const kids: Record<string, FigNode[]> = {};
  for (const n of list) {
    if (n && n.parentIndex && n.parentIndex.guid) {
      const p = key(n.parentIndex.guid);
      (kids[p] || (kids[p] = [])).push(n);
    }
  }
  const canvases = list.filter((n) => n && n.type === 'CANVAS' && !n.internalOnly && n.name !== 'Internal Only Canvas');

  const scenes: DesignFrameScene[] = [];
  for (const page of canvases) {
    const pageAbs = figMatrix(page);
    const collect = (root: FigNode, into: DesignNode[]): void => {
      const visit = (node: FigNode | null | undefined, pabs: Matrix): void => {
        if (!node || node.visible === false) return;
        const abs = matMul(pabs, figMatrix(node));
        const dn = figmaNode(node, abs, blobs);
        if (dn) into.push(dn);
        const cs = kids[key(node.guid)];
        if (cs) for (const c of cs) visit(c, abs);
      };
      visit(root, pageAbs);
    };

    const loose: DesignNode[] = [];
    const framed: Array<{ scene: DesignFrameScene; at: { x: number; y: number; w: number; h: number } }> = [];
    for (const child of (kids[key(page.guid)] || [])) {
      if (!child || child.visible === false) continue;
      const type = String(child.type || '');
      if (FIG_FRAME_TYPES.has(type) && child.size) {
        const nodes: DesignNode[] = [];
        collect(child, nodes);
        if (!nodes.length) continue;
        // The scene's crop window is the container's own absolute geometry —
        // computed directly (not read off nodes[0]) because a COMPONENT/INSTANCE
        // container isn't a visual node and emits no box of its own.
        const geom = boxGeomFromBBox(
          { x: 0, y: 0, width: num(child.size.x, 0), height: num(child.size.y, 0) },
          matMul(pageAbs, figMatrix(child)),
        );
        for (const n of nodes) { n.x = num(n.x, 0) - geom.x; n.y = num(n.y, 0) - geom.y; }
        framed.push({
          at: { x: geom.x, y: geom.y, w: geom.w, h: geom.h },
          scene: {
            name: String(child.name || '') || `Frame ${framed.length + 1}`,
            width: Math.max(1, Math.round(geom.w)) || 1080,
            height: Math.max(1, Math.round(geom.h)) || 1080,
            nodes,
          },
        });
      } else {
        collect(child, loose);
      }
    }
    // Frames play in READING order (rows top-to-bottom, then left-to-right) —
    // canvas child order is Z/creation order, which plays a deck backwards.
    scenes.push(...readingOrder(framed, (f) => f.at).map((f) => f.scene));
    // Loose shapes only make a scene when the page has NO frames (the whole page
    // is the artwork). Next to frames they're scratch content around the boards,
    // and a union-bounds scene of scratch is noise.
    if (loose.length && !framed.length) {
      const { width, height } = shiftNodesToOrigin(loose);
      scenes.push({ name: String(page.name || '') || 'Page', width, height, nodes: loose });
    }
  }
  return scenes;
}
