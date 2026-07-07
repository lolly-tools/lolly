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
 * SUSE-specific network/asset logic. The shell does all DOM/getBBox/getCTM work
 * and asset storage; this module only does the maths and field defaulting, so the
 * mapping is unit-testable and identical everywhere the engine runs.
 *
 * Field defaults mirror tools/layout-studio (its addKinds seeds + field defaults),
 * and the colour/weight guards mirror its hooks.js — the imported box looks exactly
 * like a natively-authored one. Only SUSE / SUSE Mono fonts exist, so every imported
 * font remaps to one of them (monospace family names → SUSE Mono). That on-brand
 * remap is intended behaviour, not a bug.
 */

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
  _fillImageId?: string;
  _imageHash?: string | null;
  _vectorPath?: string;
  _vectorFill?: string;
  _vectorStroke?: { color: string; width: number } | null;
  _vectorSize?: { w: number; h: number };
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
  font: 'SUSE' | 'SUSE Mono';
  lineHeight: number;
  group: string;
  clip: string;
  pad: number;
  shadow: string;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
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
 * SUSE Sans covers 100–900; SUSE Mono has no Black cut (tops out at 800), so cap it
 * there — matching tools/layout-studio/hooks.js weightOf so the browser render and
 * the static-TTF vector export agree.
 * @param {number|string} weight
 * @param {string} [font] 'SUSE' | 'SUSE Mono'
 * @returns {string} '100'..'900'
 */
export function mapWeight(weight: number | string | undefined, font?: string): string {
  let w = clamp(Math.round(num(weight, 700) / 100) * 100, 100, 900);
  if (String(font) === 'SUSE Mono' && w > 800) w = 800;
  return String(w);
}

/**
 * Remap any imported font family onto the only two that exist. Monospace family
 * names (mono/console/courier/menlo/…code) → 'SUSE Mono'; everything else → 'SUSE'.
 * @param {string} family raw family string.
 * @returns {'SUSE'|'SUSE Mono'}
 */
export function mapFontFamily(family: unknown): 'SUSE' | 'SUSE Mono' {
  return /mono|consol|courier|menlo|code/i.test(String(family == null ? '' : family))
    ? 'SUSE Mono' : 'SUSE';
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

// Per-kind non-geometry seeds (mirror tools/layout-studio/tool.json addKinds).
const SEED: Record<'box' | 'text' | 'image', KindSeed> = {
  box: { bg: '#30BA78' },
  text: { bg: '', fg: '#0c322c', fontSize: 64, valign: 'top', lineHeight: 1.12 },
  image: { bg: '#eef1f0', fit: 'contain' },
};
const SHAPES: Record<string, number> = { rect: 1, rounded: 1, pill: 1, ellipse: 1 };
const FITS: Record<string, number> = { contain: 1, cover: 1, fill: 1 };
const BLENDS: Record<string, number> = {
  normal: 1, multiply: 1, screen: 1, overlay: 1, darken: 1, lighten: 1,
  'color-dodge': 1, 'color-burn': 1, 'hard-light': 1, 'soft-light': 1,
  difference: 1, exclusion: 1, hue: 1, saturation: 1, color: 1, luminosity: 1,
};

function has(o: unknown, k: string): boolean { return o != null && Object.prototype.hasOwnProperty.call(o, k); }

/**
 * Turn one normalized DesignNode into a full Layout Studio box row — every field
 * present and defaulted (mirroring the addKinds seeds + field defaults), with the
 * on-brand font/weight/align/colour remaps applied. `kind` drives which fields
 * carry meaning, but all fields are emitted so the row is self-describing.
 * @param {object} node the DesignNode.
 * @param {{id:string}} opts assigned id (permanent within this import).
 * @returns {object} a box row.
 */
export function nodeToBox(node: DesignNode | null | undefined, opts: { id?: unknown } | null | undefined): Box {
  const n: DesignNode = node || {};
  const o = opts || {};
  const id = o.id != null ? String(o.id) : '';
  const kind: 'box' | 'text' | 'image' = n.kind === 'text' ? 'text' : (n.kind === 'image' ? 'image' : 'box');
  const seed = SEED[kind];

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
  const bg = has(n, 'fill') ? safeColor(n.fill, '') : seed.bg;

  // typography
  const font = mapFontFamily(n.fontFamily);
  const weight = mapWeight(n.fontWeight as number | string | undefined, font);
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
    opacity,
    image,
    fit,
    blend: BLENDS[n.blend as string] ? (n.blend as string) : 'normal',
    text: n.text != null ? String(n.text) : '',
    fg: safeColor(n.fg, '#0c322c'),
    fontSize,
    align,
    valign: kind === 'text' ? (seed.valign || 'top') : 'middle',
    weight,
    font,
    lineHeight,
    group: n.group != null && n.group !== '' ? String(n.group) : '',
    clip: '',
    pad: Math.max(0, Math.round(num(n.pad, 8))),
    shadow: 'none',
    shadowColor: '#00000055',
    shadowX: 0,
    shadowY: 0,
    shadowBlur: 10,
  };
}

/**
 * Map an ordered list of DesignNodes to boxes with unique, sequential ids
 * (`${prefix}${i}`), skipping nulls and degenerate non-text nodes (w<1 || h<1).
 * Input order is preserved (= paint order, back-to-front).
 * @param {object[]} nodes
 * @param {{prefix?:string}} [opts]
 * @returns {object[]} box rows.
 */
export function finalizeBoxes(
  nodes: ReadonlyArray<DesignNode | null | undefined> | null | undefined,
  opts?: { prefix?: unknown } | null,
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
    out.push(nodeToBox(node, { id: prefix + out.length }));
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
  content?: unknown;
  r1?: unknown;
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
    return node;
  }

  // Image fill → image node (the shell loads the bytes via _fillImageId).
  const imgFill = fills.find((f) => f && f.fillImage && f.fillImage.id != null);
  if (imgFill) {
    return {
      kind: 'image', x, y, w, h, rot,
      _fillImageId: String(imgFill.fillImage!.id),
      opacity: clamp(Math.round(shapeOp * num(imgFill.fillOpacity, 1) * 100), 0, 100),
      fit: imgFill.fillImage!.keepAspectRatio === false ? 'fill' : 'cover',
    };
  }

  // Solid-fill shapes (rect / frame / circle / path / bool …) → box. `path`/`bool`
  // lose their exact outline (approximated as their selrect box) — acceptable for v1.
  const topFill: PenpotFill | null = fills.length ? (fills[fills.length - 1] ?? null) : null; // last fill = topmost
  const node: DesignNode = {
    kind: 'box', x, y, w, h, rot,
    fill: (topFill && topFill.fillColor != null) ? String(topFill.fillColor) : '',
    opacity: clamp(Math.round(shapeOp * num(topFill && topFill.fillOpacity, 1) * 100), 0, 100),
  };
  if (type === 'circle') node.shape = 'ellipse';
  const r1 = num(sh.r1, 0);
  if (r1 > 0) { node.shape = 'rounded'; node.radius = r1; }
  return node;
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
