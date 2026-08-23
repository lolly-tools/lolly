// SPDX-License-Identifier: MPL-2.0
/**
 * pptx-read.ts: PARSE an unzipped .pptx part map into a read-model.
 *
 * This is the read half of the PPTX story (`pptx.ts` is the mature *builder*).
 * It mirrors `pdf-map.ts`: a pure, DOM-free interpreter that turns an already-
 * unzipped OOXML part map into positioned nodes the rest of the platform can
 * rebrand / re-author. See plans/49-fable-new-potential-pptx.md track E1.
 *
 * ── DESIGN CONTRACT ──────────────────────────────────────────────────────────
 * • The CALLER inflates the zip and hands us a `Record<path, Uint8Array|string>`
 *   (fflate in the shells; a fixture map in tests). Zip inflation + the `PK`
 *   magic-byte sniff live in the caller, not here.
 * • The engine is XML-library-free, so we ACCEPT AN INJECTED PARSER
 *   `parseXml:(s:string)=>Document`, exactly the way the runtime injects the
 *   host bridge. The web shell passes the native `DOMParser`; Node shells / tests
 *   pass one built from jsdom or @xmldom. We import NO DOM library and never
 *   touch `document`/`window`/`fetch`.
 * • Traversal is namespace-AGNOSTIC: we match on an element's *local* name
 *   ("srgbClr", not "a:srgbClr") so the same walk works whether the injected
 *   parser is namespace-aware (jsdom) or prefix-preserving.
 *
 * ── SECURITY (a hostile zip is the threat model, same as PDF) ─────────────────
 * Every part is size-capped before parsing; slide/node/paragraph/run/table
 * counts are capped; group-shape recursion is depth-capped; a malformed or
 * hostile part NEVER throws: we return what parsed and skip the rest. XML
 * entity-expansion (billion-laughs) is the injected parser's responsibility, but
 * we additionally bound every DFS by a visited-node counter so a pathologically
 * deep/wide tree can't hang us.
 *
 * ── COVERAGE (this is a correct SPIKE, not the whole cathedral) ───────────────
 * Covered (the common case, well): slide size; the theme's 12-slot clrScheme +
 * major/minor fonts; per-slide spTree walk producing text boxes (runs with
 * bold/italic/underline/size/font + colour with schemeClr-vs-literal provenance),
 * shapes (prstGeom + solid fill/line with provenance), pictures (r:embed → media
 * path via slide rels), tables (cell text), grouped shapes (flattened), and
 * speaker notes (best-effort). schemeClr colours are resolved through the theme
 * (with the DEFAULT clrMap bg1→lt1/tx1→dk1/bg2→lt2/tx2→dk2) while preserving the
 * original slot name.
 *
 * Also covered: the TEXT CASCADE. A run's size/bold/italic/underline/font/colour
 * resolves through paragraph `pPr/defRPr` → the shape's own `lstStyle` → the
 * slide layout's matching placeholder → the slide master's matching placeholder
 * and its `txStyles` → `presentation.xml`'s `defaultTextStyle`, per outline
 * level, filling only what the slide left undefined. An explicit off (`b="0"`)
 * is a value, not an absence: it stops inheritance for that field. Placeholders
 * match slide → layout → master by `idx` first, then by type with `title` and
 * `ctrTitle` unified, which also resolves the TYPE of an idx-only slide
 * placeholder.
 *
 * DEFERRED, explicitly (documented so it isn't mistaken for a bug):
 *   • Inheritance beyond run text properties: a placeholder's geometry, fill,
 *     line and bullet formatting are still read from the slide only, so a shape
 *     that states none of them reports none.
 *   • Group-shape child-offset transforms (grpSp chOff/chExt): children are
 *     flattened with their own xfrm as-authored; the group's coordinate remap is
 *     not composed.
 *   • gradFill / pattFill / blipFill-as-shape-fill, prstClr named colours,
 *     lumMod/lumOff tint-shade transforms on colours, custGeom→SVG paths,
 *     charts / SmartArt / OLE internals (surfaced as `unknown` nodes),
 *     animations. clrMapOvr per-slide overrides are ignored (default map used).
 */

// ─── public read-model ───────────────────────────────────────────────────────

/** An unzipped OOXML part map. Values are raw bytes or already-decoded text. */
export type PptxParts = Record<string, Uint8Array | string>;

/** DOMParser-shaped adapter injected by the host (web: native; tests: jsdom). */
export type XmlParser = (xml: string) => Document;

/**
 * A colour with its PROVENANCE preserved: this is what makes token-aware
 * rebranding possible ("this fill *was* accent1"). A schemeClr keeps its slot
 * name AND carries the theme-resolved hex; a literal srgbClr carries only a hex.
 */
export type PptxReadColor =
  | { scheme: string; hex?: string } // schemeClr provenance; hex = theme-resolved (undefined for phClr)
  | { hex: string }; // literal srgbClr / sysClr

export interface PptxReadRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** point size (OOXML `sz` is hundredths of a point → /100). */
  sizePt?: number;
  /** explicit `a:latin` typeface override on the run. */
  font?: string;
  color?: PptxReadColor;
}

export interface PptxReadPara {
  runs: PptxReadRun[];
  /** outline level from `a:pPr@lvl` (0 = top). Absent means 0. */
  lvl?: number;
}

/**
 * A shape's placeholder binding, read from `p:nvSpPr/p:nvPr/p:ph` on the SLIDE
 * itself. `type` tells a consumer which box is the title/subtitle/body and which
 * is furniture (`ftr`, `sldNum`, `dt`); `idx` is the layout slot number. A slide
 * placeholder that states only `idx` takes its `type` from the matching layout
 * or master placeholder; with no layout part to read it falls back to `body`,
 * which is what ECMA-376 says an untyped `ph` means. A shape with no `ph`
 * element at all reports nothing here.
 */
export interface PptxPlaceholder {
  /** `title`, `ctrTitle`, `subTitle`, `body`, `ftr`, `sldNum`, `dt`, `pic`, ... */
  type?: string;
  idx?: number;
}

interface NodeBox {
  xEmu: number;
  yEmu: number;
  cxEmu: number;
  cyEmu: number;
  /** rotation in DEGREES clockwise (OOXML stores 60000ths of a degree). */
  rot?: number;
}

export interface PptxTextNode extends NodeBox {
  type: 'text';
  paras: PptxReadPara[];
  geom?: string;
  fill?: PptxReadColor;
  ph?: PptxPlaceholder;
}
export interface PptxShapeNode extends NodeBox {
  type: 'shape';
  geom?: string;
  fill?: PptxReadColor;
  line?: PptxReadColor;
  /** outline width in POINTS from `a:ln@w` (OOXML stores EMU; 12700 = 1pt). */
  lineWidthPt?: number;
  ph?: PptxPlaceholder;
}
export interface PptxPicNode extends NodeBox {
  type: 'pic';
  /** the `r:embed` relationship id on the blip. */
  embed?: string;
  /** the media part path the rel resolves to (e.g. "ppt/media/image1.png"). */
  media?: string;
}
export interface PptxTableNode extends NodeBox {
  type: 'table';
  /** cell text, row-major; styling is deferred. */
  rows: string[][];
}
export interface PptxUnknownNode extends NodeBox {
  type: 'unknown';
  /** best-effort tag hint (local element name or graphicData uri). */
  tag?: string;
}

export type PptxReadNode =
  | PptxTextNode
  | PptxShapeNode
  | PptxPicNode
  | PptxTableNode
  | PptxUnknownNode;

export interface PptxReadSlide {
  index: number;
  nodes: PptxReadNode[];
  notes?: string;
}

export interface PptxReadTheme {
  /** slot → bare uppercase RRGGBB (matches pptx.ts theme convention). */
  colors: Record<string, string>;
  majorFont?: string;
  minorFont?: string;
}

export interface PptxDeckRead {
  widthEmu: number;
  heightEmu: number;
  theme: PptxReadTheme;
  slides: PptxReadSlide[];
}

// ─── hardening caps ──────────────────────────────────────────────────────────

const MAX_PART_BYTES = 24 * 1024 * 1024; // skip parsing a part bigger than this
const MAX_PART_CHARS = 16 * 1024 * 1024;
const MAX_SLIDES = 2000;
const MAX_NODES_PER_SLIDE = 8000;
const MAX_GROUP_DEPTH = 16;
const MAX_PARAS = 4000;
const MAX_RUNS_PER_PARA = 4000;
const MAX_TABLE_ROWS = 2000;
const MAX_TABLE_COLS = 512;
const MAX_TEXT_LEN = 200_000; // per run/cell text clamp
const MAX_DFS_VISITS = 200_000; // bound any descendant search
const MAX_PH_TYPE_LEN = 64; // a ph type is a short enum value; clamp a hostile one
const MAX_PH_IDX = 1_000_000;
const MAX_OUTLINE_LVL = 8; // OOXML allows nine outline levels (0..8)
const LVL_COUNT = MAX_OUTLINE_LVL + 1;
const MAX_PH_PER_PART = 2000; // a real layout/master carries under 40
const MAX_STYLE_PARTS = 256; // distinct layout+master parts parsed per deck
const EMU_PER_PT = 12700;
const MAX_COORD = 1e11; // EMU magnitude clamp (slide width is ~1.2e7)
const DEFAULT_W_EMU = 12_192_000; // 13.333in, 16:9 default
const DEFAULT_H_EMU = 6_858_000; // 7.5in

// Node type constant (avoids depending on the DOM `Node` value namespace).
const ELEMENT_NODE = 1;

// ─── low-level, namespace-agnostic DOM helpers (operate on the INJECTED doc) ──

/** Local (prefix-free) name of an element/attr node. */
function localName(nodeName: string | null, localHint: string | null): string {
  const raw = localHint || nodeName || '';
  const i = raw.indexOf(':');
  return i >= 0 ? raw.slice(i + 1) : raw;
}

function elemLocal(el: Element): string {
  return localName(el.nodeName, (el as { localName?: string | null }).localName ?? null);
}

function isElement(n: Node | null | undefined): n is Element {
  return n != null && n.nodeType === ELEMENT_NODE;
}

function childElements(el: Element): Element[] {
  const out: Element[] = [];
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (isElement(n)) out.push(n as unknown as Element);
  }
  return out;
}

function firstChildByLocal(el: Element, local: string): Element | null {
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (isElement(n) && elemLocal(n as unknown as Element) === local) return n as unknown as Element;
  }
  return null;
}

function childrenByLocal(el: Element, local: string): Element[] {
  return childElements(el).filter((c) => elemLocal(c) === local);
}

/** First descendant (DFS, bounded) whose local name matches. */
function descendantByLocal(root: Element, local: string): Element | null {
  let visits = 0;
  const stack: Element[] = [root];
  while (stack.length) {
    const el = stack.pop() as Element;
    if (++visits > MAX_DFS_VISITS) return null;
    if (el !== root && elemLocal(el) === local) return el;
    const kids = el.childNodes;
    // push in reverse so DFS keeps document order-ish (order doesn't matter here)
    for (let i = kids.length - 1; i >= 0; i--) {
      const n = kids[i];
      if (isElement(n)) stack.push(n as unknown as Element);
    }
  }
  return null;
}

/** Attribute value by LOCAL name (handles namespaced attrs like `r:embed`). */
function attrByLocal(el: Element, local: string): string | null {
  // Fast path: plain (unprefixed) attribute.
  const direct = el.getAttribute(local);
  if (direct != null) return direct;
  const attrs = el.attributes;
  if (!attrs) return null;
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i] as Attr;
    if (localName(a.name, (a as { localName?: string | null }).localName ?? null) === local) return a.value;
  }
  return null;
}

function textOf(el: Element | null): string {
  if (!el) return '';
  const t = el.textContent ?? '';
  return t.length > MAX_TEXT_LEN ? t.slice(0, MAX_TEXT_LEN) : t;
}

// ─── value coercion ──────────────────────────────────────────────────────────

function toInt(v: string | null, def = 0): number {
  if (v == null) return def;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(-MAX_COORD, Math.min(MAX_COORD, n));
}

function truthy(v: string | null): boolean {
  return v === '1' || v === 'true' || v === 'on';
}

/** Normalise any colour string to bare uppercase RRGGBB. */
function normHex(v: string | null): string | undefined {
  if (!v) return undefined;
  const hex = v.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length < 6) return undefined;
  return hex.slice(0, 6);
}

// ─── part access + decode ────────────────────────────────────────────────────

interface PartStore {
  get(path: string): string | null;
  keys(): string[];
}

function makeStore(parts: PptxParts): PartStore {
  // Build a case-insensitive index once (OOXML paths are consistent-case in
  // practice, but a hostile/rezipped archive may not be).
  const lower = new Map<string, string>();
  const keys: string[] = [];
  for (const k of Object.keys(parts)) {
    keys.push(k);
    if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), k);
  }
  const decode = (raw: Uint8Array | string): string | null => {
    if (typeof raw === 'string') return raw.length > MAX_PART_CHARS ? null : raw;
    if (raw.byteLength > MAX_PART_BYTES) return null;
    try {
      return new TextDecoder('utf-8').decode(raw);
    } catch {
      return null;
    }
  };
  return {
    keys: () => keys,
    get(path: string): string | null {
      let raw = parts[path];
      if (raw === undefined) {
        const real = lower.get(path.toLowerCase());
        if (real === undefined) return null;
        raw = parts[real];
      }
      if (raw === undefined) return null;
      return decode(raw);
    },
  };
}

/** Parse a part to a Document, or null on missing/oversized/malformed. */
function parsePart(store: PartStore, path: string, parseXml: XmlParser): Document | null {
  const xml = store.get(path);
  if (xml == null || xml.length === 0) return null;
  let doc: Document;
  try {
    doc = parseXml(xml);
  } catch {
    return null;
  }
  const root = doc?.documentElement;
  if (!root) return null;
  // Both browsers and jsdom surface XML syntax errors as a <parsererror> root.
  if (elemLocal(root) === 'parsererror') return null;
  return doc;
}

// ─── path resolution for relationships ───────────────────────────────────────

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}
function baseOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}

/** Resolve a relationship Target (possibly `../`-relative) against a base dir. */
function resolveTarget(baseDir: string, target: string): string {
  if (!target) return target;
  if (target.startsWith('/')) return target.slice(1); // package-absolute
  const segs = (baseDir ? baseDir.split('/') : []).concat(target.split('/'));
  const out: string[] = [];
  for (const s of segs) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out.join('/');
}

interface Rel {
  id: string;
  type: string;
  target: string; // resolved absolute part path (or external URL untouched)
  external: boolean;
}

/** The rels part for `partPath` is `<dir>/_rels/<base>.rels`. */
function relsPathFor(partPath: string): string {
  const dir = dirOf(partPath);
  const base = baseOf(partPath);
  return (dir ? `${dir}/` : '') + `_rels/${base}.rels`;
}

function parseRels(store: PartStore, partPath: string, parseXml: XmlParser): Rel[] {
  const doc = parsePart(store, relsPathFor(partPath), parseXml);
  if (!doc?.documentElement) return [];
  const baseDir = dirOf(partPath);
  const out: Rel[] = [];
  for (const rel of childElements(doc.documentElement)) {
    if (elemLocal(rel) !== 'Relationship') continue;
    const id = attrByLocal(rel, 'Id') || '';
    const type = attrByLocal(rel, 'Type') || '';
    const target = attrByLocal(rel, 'Target') || '';
    const mode = attrByLocal(rel, 'TargetMode') || '';
    const external = mode.toLowerCase() === 'external';
    out.push({ id, type, external, target: external ? target : resolveTarget(baseDir, target) });
    if (out.length > 100_000) break;
  }
  return out;
}

// ─── colour resolution ───────────────────────────────────────────────────────

// Default clrMap: how the master maps the placeholder slots (bg/tx) to the
// theme's dk/lt slots. Per-slide clrMapOvr is DEFERRED: the default is assumed.
function schemeSlotToThemeKey(slot: string): string {
  switch (slot) {
    case 'bg1':
      return 'lt1';
    case 'tx1':
      return 'dk1';
    case 'bg2':
      return 'lt2';
    case 'tx2':
      return 'dk2';
    default:
      return slot; // accent1..6, hlink, folHlink, dk1/lt1/dk2/lt2, phClr
  }
}

function resolveScheme(slot: string, theme: PptxReadTheme): PptxReadColor {
  const hex = theme.colors[schemeSlotToThemeKey(slot)];
  return hex ? { scheme: slot, hex } : { scheme: slot };
}

/**
 * Read the colour inside a container element (a `solidFill`, or a clrScheme
 * slot). Recognises srgbClr / schemeClr / sysClr. lumMod/lumOff transforms are
 * read as provenance-only (not applied; deferred). gradFill/pattFill/prstClr →
 * undefined (deferred).
 */
function readColor(container: Element | null, theme: PptxReadTheme): PptxReadColor | undefined {
  if (!container) return undefined;
  for (const c of childElements(container)) {
    const ln = elemLocal(c);
    if (ln === 'srgbClr') {
      const hex = normHex(attrByLocal(c, 'val'));
      if (hex) return { hex };
    } else if (ln === 'schemeClr') {
      const slot = attrByLocal(c, 'val');
      if (slot) return resolveScheme(slot, theme);
    } else if (ln === 'sysClr') {
      const hex = normHex(attrByLocal(c, 'lastClr') || attrByLocal(c, 'val'));
      if (hex) return { hex };
    }
  }
  return undefined;
}

// ─── theme ───────────────────────────────────────────────────────────────────

const THEME_SLOTS = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
];

function pickThemePart(store: PartStore): string | null {
  if (store.get('ppt/theme/theme1.xml') != null) return 'ppt/theme/theme1.xml';
  const themes = store
    .keys()
    .filter((k) => /^ppt\/theme\/theme\d+\.xml$/i.test(k))
    .sort();
  return themes[0] ?? null;
}

function readTheme(store: PartStore, parseXml: XmlParser): PptxReadTheme {
  const theme: PptxReadTheme = { colors: {} };
  const path = pickThemePart(store);
  if (!path) return theme;
  const doc = parsePart(store, path, parseXml);
  if (!doc?.documentElement) return theme;
  const root = doc.documentElement;

  const clrScheme = descendantByLocal(root, 'clrScheme');
  if (clrScheme) {
    for (const slotEl of childElements(clrScheme)) {
      const slot = elemLocal(slotEl);
      if (!THEME_SLOTS.includes(slot)) continue;
      // slot element wraps a single srgbClr/sysClr
      for (const c of childElements(slotEl)) {
        const ln = elemLocal(c);
        const hex =
          ln === 'srgbClr'
            ? normHex(attrByLocal(c, 'val'))
            : ln === 'sysClr'
              ? normHex(attrByLocal(c, 'lastClr') || attrByLocal(c, 'val'))
              : undefined;
        if (hex) {
          theme.colors[slot] = hex;
          break;
        }
      }
    }
  }

  const fontScheme = descendantByLocal(root, 'fontScheme');
  if (fontScheme) {
    const major = firstChildByLocal(fontScheme, 'majorFont');
    const minor = firstChildByLocal(fontScheme, 'minorFont');
    const majorLatin = major ? firstChildByLocal(major, 'latin') : null;
    const minorLatin = minor ? firstChildByLocal(minor, 'latin') : null;
    const mj = majorLatin ? attrByLocal(majorLatin, 'typeface') : null;
    const mn = minorLatin ? attrByLocal(minorLatin, 'typeface') : null;
    if (mj) theme.majorFont = mj;
    if (mn) theme.minorFont = mn;
  }
  return theme;
}

// ─── geometry ────────────────────────────────────────────────────────────────

/** Read an `xfrm` that is a direct child of `container` (spPr for sp/pic; the
 *  graphicFrame itself for tables; there it's `p:xfrm`, same local name). */
function readXfrm(container: Element | null): NodeBox {
  const box: NodeBox = { xEmu: 0, yEmu: 0, cxEmu: 0, cyEmu: 0 };
  if (!container) return box;
  const xfrm = firstChildByLocal(container, 'xfrm');
  if (!xfrm) return box;
  const off = firstChildByLocal(xfrm, 'off');
  const ext = firstChildByLocal(xfrm, 'ext');
  if (off) {
    box.xEmu = toInt(attrByLocal(off, 'x'));
    box.yEmu = toInt(attrByLocal(off, 'y'));
  }
  if (ext) {
    box.cxEmu = toInt(attrByLocal(ext, 'cx'));
    box.cyEmu = toInt(attrByLocal(ext, 'cy'));
  }
  const rot = attrByLocal(xfrm, 'rot');
  if (rot) {
    const deg = toInt(rot) / 60000;
    if (deg) box.rot = deg;
  }
  return box;
}

// ─── shape / text ────────────────────────────────────────────────────────────

/**
 * Run properties as ONE cascade layer states them. `false` on a boolean is an
 * explicit off (`b="0"`) which stops inheritance for that field; `undefined` is
 * absence, which lets the next layer speak.
 */
interface RunProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  sizePt?: number;
  font?: string;
  color?: PptxReadColor;
}

/** Read an `a:rPr`/`a:defRPr`/`a:endParaRPr` element into a cascade layer. */
function readRunProps(rPr: Element | null, theme: PptxReadTheme): RunProps {
  const out: RunProps = {};
  if (!rPr) return out;
  const b = attrByLocal(rPr, 'b');
  if (b) out.bold = truthy(b);
  const i = attrByLocal(rPr, 'i');
  if (i) out.italic = truthy(i);
  const u = attrByLocal(rPr, 'u');
  if (u) out.underline = u !== 'none';
  const sz = attrByLocal(rPr, 'sz');
  if (sz) {
    const pt = toInt(sz) / 100;
    if (pt > 0) out.sizePt = pt;
  }
  const latin = firstChildByLocal(rPr, 'latin');
  const face = latin ? attrByLocal(latin, 'typeface') : null;
  if (face) out.font = face;
  const color = readColor(firstChildByLocal(rPr, 'solidFill'), theme);
  if (color) out.color = color;
  return out;
}

/** Fill `out`'s undefined fields from `layer`. Fields already stated stay put. */
function inheritInto(out: RunProps, layer: RunProps | undefined): void {
  if (!layer) return;
  if (out.bold === undefined && layer.bold !== undefined) out.bold = layer.bold;
  if (out.italic === undefined && layer.italic !== undefined) out.italic = layer.italic;
  if (out.underline === undefined && layer.underline !== undefined) out.underline = layer.underline;
  if (out.sizePt === undefined && layer.sizePt !== undefined) out.sizePt = layer.sizePt;
  if (out.font === undefined && layer.font !== undefined) out.font = layer.font;
  if (out.color === undefined && layer.color !== undefined) out.color = layer.color;
}

/** Cascade layers indexed by outline level (0..8); a hole means "silent here". */
type Levels = (RunProps | undefined)[];

/** Read `a:lvl1pPr`..`a:lvl9pPr` under an lstStyle / txStyles kind / defaultTextStyle. */
function readLevels(container: Element | null, theme: PptxReadTheme): Levels | undefined {
  if (!container) return undefined;
  let out: Levels | undefined;
  for (const el of childElements(container)) {
    const m = /^lvl([1-9])pPr$/.exec(elemLocal(el));
    if (!m?.[1]) continue;
    const defRPr = firstChildByLocal(el, 'defRPr');
    if (!defRPr) continue;
    if (!out) out = new Array<RunProps | undefined>(LVL_COUNT);
    out[Number.parseInt(m[1], 10) - 1] = readRunProps(defRPr, theme);
  }
  return out;
}

/** One placeholder of a layout or master, with its per-level text styles. */
interface PhStyle {
  type?: string;
  idx?: number;
  lvls?: Levels;
}

/** A parsed slideLayout or slideMaster part, reduced to what the cascade needs. */
interface PhLayer {
  phs: PhStyle[];
  /** master only: `p:txStyles` by kind. */
  titleStyle?: Levels;
  bodyStyle?: Levels;
  otherStyle?: Levels;
  /** layout only: the master part path its rels point at. */
  masterPath?: string;
}

/** The layers a slide's shapes resolve through, above the shape's own state. */
interface Cascade {
  layout?: PhLayer;
  master?: PhLayer;
  defaults?: Levels;
}

/**
 * `title` and `ctrTitle` are the same slot; an absent type means `body`. Used on
 * both sides of a placeholder match so the two spellings unify.
 */
function phKind(type: string | undefined): string {
  if (!type) return 'body';
  return type === 'ctrTitle' ? 'title' : type;
}

/** Match a slide placeholder against a layer's: `idx` first, then kind. */
function matchPh(layer: PhLayer | undefined, ph: PptxPlaceholder | undefined): PhStyle | undefined {
  if (!layer || !ph) return undefined;
  if (ph.idx !== undefined) {
    const byIdx = layer.phs.find((p) => p.idx === ph.idx);
    if (byIdx) return byIdx;
  }
  const want = phKind(ph.type);
  return layer.phs.find((p) => phKind(p.type) === want);
}

/** The master txStyles kind that governs a placeholder of this type. */
function txStyleFor(master: PhLayer | undefined, type: string | undefined): Levels | undefined {
  if (!master) return undefined;
  const kind = phKind(type);
  if (kind === 'title') return master.titleStyle;
  if (kind === 'body' || kind === 'subTitle') return master.bodyStyle;
  return master.otherStyle;
}

function readRun(r: Element, theme: PptxReadTheme, inherit?: RunProps): PptxReadRun | null {
  const t = firstChildByLocal(r, 't');
  const text = textOf(t);
  const props = readRunProps(firstChildByLocal(r, 'rPr'), theme);
  inheritInto(props, inherit);
  const run: PptxReadRun = { text };
  // An explicit-off resolves to `false` here and stays off the model, which is
  // the same shape a run with nothing to say has always had.
  if (props.bold) run.bold = true;
  if (props.italic) run.italic = true;
  if (props.underline) run.underline = true;
  if (props.sizePt) run.sizePt = props.sizePt;
  if (props.font) run.font = props.font;
  if (props.color) run.color = props.color;
  // Keep the run if it carries text OR any styling worth preserving.
  if (text.length > 0 || run.bold || run.italic || run.underline || run.sizePt || run.color || run.font) return run;
  return null;
}

function readTxBody(
  txBody: Element | null,
  theme: PptxReadTheme,
  inherit?: (lvl: number) => RunProps | undefined,
): PptxReadPara[] {
  const paras: PptxReadPara[] = [];
  if (!txBody) return paras;
  const pEls = childrenByLocal(txBody, 'p');
  for (const pEl of pEls) {
    if (paras.length >= MAX_PARAS) break;
    const para: PptxReadPara = { runs: [] };
    const pPr = firstChildByLocal(pEl, 'pPr');
    const rawLvl = pPr ? attrByLocal(pPr, 'lvl') : null;
    if (rawLvl != null) {
      const n = Number.parseInt(rawLvl, 10);
      if (Number.isFinite(n) && n > 0) para.lvl = Math.min(n, MAX_OUTLINE_LVL);
    }
    // Paragraph-level defaults sit between the run's own rPr and the shape's.
    let runInherit = inherit ? inherit(para.lvl ?? 0) : undefined;
    const pDefRPr = pPr ? firstChildByLocal(pPr, 'defRPr') : null;
    if (pDefRPr) {
      const pProps = readRunProps(pDefRPr, theme);
      inheritInto(pProps, runInherit);
      runInherit = pProps;
    }
    const runs = para.runs;
    for (const child of childElements(pEl)) {
      if (runs.length >= MAX_RUNS_PER_PARA) break;
      const ln = elemLocal(child);
      if (ln === 'r') {
        const run = readRun(child, theme, runInherit);
        if (run) runs.push(run);
      } else if (ln === 'br') {
        runs.push({ text: '\n' });
      } else if (ln === 'fld') {
        // a field (slide number, date, etc.): capture its cached text best-effort
        const text = textOf(firstChildByLocal(child, 't'));
        if (text) runs.push({ text });
      }
    }
    paras.push(para);
  }
  return paras;
}

function paraHasText(paras: PptxReadPara[]): boolean {
  for (const p of paras) for (const r of p.runs) if (r.text.trim().length > 0) return true;
  return false;
}

/**
 * Read `p:nvSpPr/p:nvPr/p:ph` off a shape. A `ph` element with no `type`
 * attribute means `body` per ECMA-376, which is how PowerPoint writes an
 * idx-only content placeholder; `explicitType` records that the fallback was
 * used so the cascade may replace it with the layout's real type.
 */
function readPlaceholder(sp: Element): { ph: PptxPlaceholder; explicitType: boolean } | undefined {
  const nvSpPr = firstChildByLocal(sp, 'nvSpPr');
  const nvPr = nvSpPr ? firstChildByLocal(nvSpPr, 'nvPr') : null;
  const ph = nvPr ? firstChildByLocal(nvPr, 'ph') : null;
  if (!ph) return undefined;
  const rawType = attrByLocal(ph, 'type');
  const out: PptxPlaceholder = { type: rawType ? rawType.slice(0, MAX_PH_TYPE_LEN) : 'body' };
  const rawIdx = attrByLocal(ph, 'idx');
  if (rawIdx != null) {
    const idx = Number.parseInt(rawIdx, 10);
    if (Number.isFinite(idx) && idx >= 0) out.idx = Math.min(idx, MAX_PH_IDX);
  }
  return { ph: out, explicitType: !!rawType };
}

function readSp(sp: Element, theme: PptxReadTheme, cascade?: Cascade): PptxReadNode {
  const spPr = firstChildByLocal(sp, 'spPr');
  const box = readXfrm(spPr);
  let geom: string | undefined;
  let fill: PptxReadColor | undefined;
  let line: PptxReadColor | undefined;
  let lineWidthPt: number | undefined;
  if (spPr) {
    const prstGeom = firstChildByLocal(spPr, 'prstGeom');
    geom = (prstGeom && attrByLocal(prstGeom, 'prst')) || undefined;
    fill = readColor(firstChildByLocal(spPr, 'solidFill'), theme);
    const ln = firstChildByLocal(spPr, 'ln');
    if (ln) {
      line = readColor(firstChildByLocal(ln, 'solidFill'), theme);
      const w = attrByLocal(ln, 'w');
      if (w) {
        const pt = toInt(w) / EMU_PER_PT;
        if (pt > 0) lineWidthPt = pt;
      }
    }
  }

  const read = readPlaceholder(sp);
  let ph = read?.ph;
  const layoutPh = matchPh(cascade?.layout, ph);
  const masterPh = matchPh(cascade?.master, ph);
  if (ph && read && !read.explicitType) {
    const resolved = layoutPh?.type ?? masterPh?.type;
    if (resolved) ph = { ...ph, type: resolved };
  }

  const txBody = firstChildByLocal(sp, 'txBody');
  const shapeLvls = readLevels(txBody ? firstChildByLocal(txBody, 'lstStyle') : null, theme);
  // Master txStyles govern placeholders only; a plain text box takes the
  // presentation's defaultTextStyle and nothing else.
  const layers = [shapeLvls, layoutPh?.lvls, masterPh?.lvls, ph ? txStyleFor(cascade?.master, ph.type) : undefined, cascade?.defaults].filter(
    (l): l is Levels => !!l,
  );
  let inherit: ((lvl: number) => RunProps | undefined) | undefined;
  if (layers.length) {
    const cache: (RunProps | undefined)[] = new Array<RunProps | undefined>(LVL_COUNT);
    inherit = (lvl: number): RunProps | undefined => {
      const at = lvl >= 0 && lvl < LVL_COUNT ? lvl : 0;
      let hit = cache[at];
      if (!hit) {
        hit = {};
        for (const l of layers) inheritInto(hit, l[at]);
        cache[at] = hit;
      }
      return hit;
    };
  }

  const paras = readTxBody(txBody, theme, inherit);
  if (paraHasText(paras)) {
    const node: PptxTextNode = { type: 'text', ...box, paras };
    if (geom) node.geom = geom;
    if (fill) node.fill = fill;
    if (ph) node.ph = ph;
    return node;
  }
  const node: PptxShapeNode = { type: 'shape', ...box };
  if (geom) node.geom = geom;
  if (fill) node.fill = fill;
  if (line) node.line = line;
  if (lineWidthPt) node.lineWidthPt = lineWidthPt;
  if (ph) node.ph = ph;
  return node;
}

/**
 * Parse a slideLayout or slideMaster part down to its placeholders' text styles.
 * Both are attacker-controlled parts: the placeholder count is capped, every
 * level read is bounded to nine, and a missing or malformed part yields null,
 * which degrades the slide to the no-cascade read.
 */
function readPhLayer(store: PartStore, path: string, parseXml: XmlParser, theme: PptxReadTheme): PhLayer | null {
  const doc = parsePart(store, path, parseXml);
  const root = doc?.documentElement;
  if (!root) return null;
  const layer: PhLayer = { phs: [] };
  const spTree = descendantByLocal(root, 'spTree');
  if (spTree) {
    for (const sp of childrenByLocal(spTree, 'sp')) {
      if (layer.phs.length >= MAX_PH_PER_PART) break;
      const read = readPlaceholder(sp);
      if (!read) continue;
      const txBody = firstChildByLocal(sp, 'txBody');
      const entry: PhStyle = { type: read.ph.type, idx: read.ph.idx };
      const lvls = readLevels(txBody ? firstChildByLocal(txBody, 'lstStyle') : null, theme);
      if (lvls) entry.lvls = lvls;
      layer.phs.push(entry);
    }
  }
  const txStyles = firstChildByLocal(root, 'txStyles');
  if (txStyles) {
    layer.titleStyle = readLevels(firstChildByLocal(txStyles, 'titleStyle'), theme);
    layer.bodyStyle = readLevels(firstChildByLocal(txStyles, 'bodyStyle'), theme);
    layer.otherStyle = readLevels(firstChildByLocal(txStyles, 'otherStyle'), theme);
  }
  const masterRel = parseRels(store, path, parseXml).find((r) => /slideMaster$/i.test(r.type) && !r.external);
  if (masterRel?.target) layer.masterPath = masterRel.target;
  return layer;
}

function readPic(pic: Element, slideRelsById: Map<string, Rel>): PptxPicNode {
  const spPr = firstChildByLocal(pic, 'spPr');
  const box = readXfrm(spPr);
  const node: PptxPicNode = { type: 'pic', ...box };
  const blipFill = firstChildByLocal(pic, 'blipFill');
  const blip = blipFill ? firstChildByLocal(blipFill, 'blip') : null;
  const embed = blip ? attrByLocal(blip, 'embed') || attrByLocal(blip, 'link') : null;
  if (embed) {
    node.embed = embed;
    const rel = slideRelsById.get(embed);
    if (rel && !rel.external) node.media = rel.target;
  }
  return node;
}

function readGraphicFrame(gf: Element, theme: PptxReadTheme): PptxReadNode {
  // graphicFrame carries its xfrm directly (p:xfrm), not under spPr.
  const box = readXfrm(gf);
  const graphic = firstChildByLocal(gf, 'graphic');
  const gData = graphic ? firstChildByLocal(graphic, 'graphicData') : null;
  const tbl = gData ? firstChildByLocal(gData, 'tbl') : null;
  if (tbl) {
    const rows: string[][] = [];
    for (const tr of childrenByLocal(tbl, 'tr')) {
      if (rows.length >= MAX_TABLE_ROWS) break;
      const cells: string[] = [];
      for (const tc of childrenByLocal(tr, 'tc')) {
        if (cells.length >= MAX_TABLE_COLS) break;
        const paras = readTxBody(firstChildByLocal(tc, 'txBody'), theme);
        cells.push(paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n'));
      }
      rows.push(cells);
    }
    return { type: 'table', ...box, rows };
  }
  const uri = gData ? attrByLocal(gData, 'uri') : null;
  const node: PptxUnknownNode = { type: 'unknown', ...box };
  if (uri) node.tag = uri;
  return node;
}

// Walk an spTree (or grpSp) appending nodes. Depth-capped for nested groups;
// a per-slide counter caps total node count.
function walkTree(
  tree: Element,
  theme: PptxReadTheme,
  slideRelsById: Map<string, Rel>,
  out: PptxReadNode[],
  depth: number,
  cascade?: Cascade,
): void {
  if (depth > MAX_GROUP_DEPTH) return;
  for (const child of childElements(tree)) {
    if (out.length >= MAX_NODES_PER_SLIDE) return;
    const ln = elemLocal(child);
    try {
      switch (ln) {
        case 'sp':
          out.push(readSp(child, theme, cascade));
          break;
        case 'cxnSp': // connector: a shape with geom + line, no text
          out.push(readSp(child, theme, cascade));
          break;
        case 'pic':
          out.push(readPic(child, slideRelsById));
          break;
        case 'graphicFrame':
          out.push(readGraphicFrame(child, theme));
          break;
        case 'grpSp':
          // NOTE: group child-offset transform (chOff/chExt) is DEFERRED.
          // Children keep their own authored xfrm.
          walkTree(child, theme, slideRelsById, out, depth + 1, cascade);
          break;
        case 'nvGrpSpPr':
        case 'grpSpPr':
          break; // group's own metadata, skip
        default:
          break; // unrecognised structural child, ignore silently
      }
    } catch {
      // A malformed shape never sinks the slide.
    }
  }
}

// ─── notes ───────────────────────────────────────────────────────────────────

function readNotes(store: PartStore, notesPath: string, parseXml: XmlParser): string | undefined {
  const doc = parsePart(store, notesPath, parseXml);
  if (!doc?.documentElement) return undefined;
  const spTree = descendantByLocal(doc.documentElement, 'spTree');
  if (!spTree) return undefined;
  // Prefer the body placeholder; fall back to all text on the notes slide.
  let bodyText: string | null = null;
  const allParts: string[] = [];
  for (const sp of childrenByLocal(spTree, 'sp')) {
    const nvSpPr = firstChildByLocal(sp, 'nvSpPr');
    const nvPr = nvSpPr ? firstChildByLocal(nvSpPr, 'nvPr') : null;
    const ph = nvPr ? firstChildByLocal(nvPr, 'ph') : null;
    const phType = ph ? attrByLocal(ph, 'type') : null;
    const paras = readTxBody(firstChildByLocal(sp, 'txBody'), { colors: {} });
    const text = paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n').trim();
    if (phType === 'body' && bodyText == null) bodyText = text;
    else if (phType !== 'sldNum' && phType !== 'dt' && text) allParts.push(text);
  }
  const result = (bodyText && bodyText.length ? bodyText : allParts.join('\n')).trim();
  return result.length ? result : undefined;
}

// ─── slide ordering ──────────────────────────────────────────────────────────

function slidePathsInOrder(store: PartStore, parseXml: XmlParser): string[] {
  const pres = parsePart(store, 'ppt/presentation.xml', parseXml);
  const rels = parseRels(store, 'ppt/presentation.xml', parseXml);
  const byId = new Map<string, Rel>(rels.map((r) => [r.id, r]));
  const ordered: string[] = [];
  if (pres?.documentElement) {
    const sldIdLst = descendantByLocal(pres.documentElement, 'sldIdLst');
    if (sldIdLst) {
      for (const sldId of childrenByLocal(sldIdLst, 'sldId')) {
        // A p:sldId carries a numeric `id` (the slide id, not a rel) plus the
        // relationship reference in the namespaced `r:id` attribute; that's the
        // one that resolves to the slide part.
        const relId = readRid(sldId);
        const rel = relId ? byId.get(relId) : undefined;
        if (rel && !rel.external && rel.target) ordered.push(rel.target);
        if (ordered.length >= MAX_SLIDES) break;
      }
    }
  }
  if (ordered.length) return ordered;
  // Fallback: numeric sort of the slide parts.
  return store
    .keys()
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => slideNum(a) - slideNum(b))
    .slice(0, MAX_SLIDES);
}

/** Read the relationship reference (`r:id`) from an element, skipping any plain
 *  `id` attribute (which on sldId is the numeric slide id, not a rel). */
function readRid(el: Element): string | null {
  const attrs = el.attributes;
  if (attrs) {
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i] as Attr;
      const full = a.name || '';
      if (full === 'r:id' || (full.endsWith(':id') && full !== 'id')) return a.value;
    }
  }
  return null;
}

function slideNum(path: string): number {
  const m = /slide(\d+)\.xml$/i.exec(path);
  return m?.[1] ? Number.parseInt(m[1], 10) : 0;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Two node tops within this many EMU are the same row. 114300 EMU is 0.125 in,
 * half a line at 18 pt, the same half-line discipline `pdf-text.ts` applies to
 * PDF runs.
 */
const ROW_TOLERANCE_EMU = 114_300;

/**
 * Sort nodes into READING ORDER: rows top to bottom, then left to right inside
 * a row. Two-column slides come back column by column within each band rather
 * than interleaved, which is what a markdown serialiser needs.
 *
 * Banding is a single pass, not a comparator, so the result is a total order and
 * never depends on the engine's sort implementation. The stored node order is
 * spTree order (the authored z-order some consumers rely on), so this returns a
 * NEW array and mutates nothing. Pure and total: garbage in yields an empty or
 * best-effort array, never a throw.
 */
export function readingOrder(nodes: PptxReadNode[]): PptxReadNode[] {
  if (!Array.isArray(nodes)) return [];
  const coord = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const items: { node: PptxReadNode; i: number; x: number; y: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node == null || typeof node !== 'object') continue;
    items.push({ node, i, x: coord(node.xEmu), y: coord(node.yEmu) });
  }
  // Stable by y, ties by authored order.
  items.sort((a, b) => a.y - b.y || a.i - b.i);
  const out: PptxReadNode[] = [];
  let band: typeof items = [];
  let bandTop = 0;
  const flush = (): void => {
    band.sort((a, b) => a.x - b.x || a.i - b.i);
    for (const it of band) out.push(it.node);
    band = [];
  };
  for (const it of items) {
    if (band.length && it.y - bandTop > ROW_TOLERANCE_EMU) flush();
    if (!band.length) bandTop = it.y;
    band.push(it);
  }
  flush();
  return out;
}

/**
 * Detect a PowerPoint part map by the presence of `ppt/presentation.xml`.
 * The `PK` zip-magic sniff belongs to the CALLER (before inflation); this
 * operates on the already-unzipped map for `design-import.ts` routing.
 */
export function isPptx(parts: PptxParts): boolean {
  if (!parts || typeof parts !== 'object') return false;
  const v = parts['ppt/presentation.xml'];
  if (v !== undefined) return typeof v === 'string' ? v.length > 0 : v.byteLength > 0;
  // case-insensitive fallback
  for (const k of Object.keys(parts)) {
    if (k.toLowerCase() === 'ppt/presentation.xml') {
      const raw = parts[k];
      if (raw === undefined) return false;
      return typeof raw === 'string' ? raw.length > 0 : raw.byteLength > 0;
    }
  }
  return false;
}

/** A raster media part of a .pptx that pixel-domain detection can read. */
export interface PptxMediaImage {
  /** The zip part path, e.g. "ppt/media/image3.png". */
  path: string;
  /** The decode MIME the shell hands createImageBitmap. */
  mime: 'image/png' | 'image/jpeg';
}

/**
 * Enumerate the raster image parts of an unzipped .pptx that carry pixels a
 * watermark detector can read: `ppt/media/*.{png,jpg,jpeg}`. Vector / metafile
 * media (`.svg`/`.emf`/`.wmf`) hold no pixel mark by construction and are
 * omitted, as is every non-media part (docProps thumbnails, XML, rels, …).
 * Deterministic (sorted by path) and capped at `max` so a deck carrying
 * hundreds of images bounds a caller's decode work. Pure + DOM-free: the shell
 * owns the unzip (fflate) and the pixel decode (canvas); this only names the
 * parts worth decoding. Empty parts are skipped (nothing to decode; the
 * detector no-ops on them anyway).
 */
export function pptxMediaImages(parts: PptxParts, max = 64): PptxMediaImage[] {
  const out: PptxMediaImage[] = [];
  if (!parts || typeof parts !== 'object' || !(max > 0)) return out;
  for (const path of Object.keys(parts).sort()) {
    const m = /^ppt\/media\/[^/]+\.(png|jpe?g)$/i.exec(path);
    if (!m) continue;
    const raw = parts[path];
    if (raw === undefined || (typeof raw === 'string' ? raw.length === 0 : raw.byteLength === 0)) continue;
    out.push({ path, mime: /png/i.test(m[1]!) ? 'image/png' : 'image/jpeg' });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Parse an unzipped .pptx part map into a read-model. Never throws: a malformed
 * or hostile part yields whatever parsed and skips the rest.
 */
export function readPptx(parts: PptxParts, parseXml: XmlParser): PptxDeckRead {
  const deck: PptxDeckRead = {
    widthEmu: DEFAULT_W_EMU,
    heightEmu: DEFAULT_H_EMU,
    theme: { colors: {} },
    slides: [],
  };
  if (!parts || typeof parts !== 'object' || typeof parseXml !== 'function') return deck;

  const store = makeStore(parts);

  try {
    deck.theme = readTheme(store, parseXml);
  } catch {
    /* keep empty theme */
  }

  // slide size + the deck-wide default text style (the cascade's last layer)
  let defaults: Levels | undefined;
  try {
    const pres = parsePart(store, 'ppt/presentation.xml', parseXml);
    if (pres?.documentElement) {
      const sldSz = descendantByLocal(pres.documentElement, 'sldSz');
      if (sldSz) {
        const cx = toInt(attrByLocal(sldSz, 'cx'), 0);
        const cy = toInt(attrByLocal(sldSz, 'cy'), 0);
        if (cx > 0) deck.widthEmu = cx;
        if (cy > 0) deck.heightEmu = cy;
      }
      defaults = readLevels(descendantByLocal(pres.documentElement, 'defaultTextStyle'), deck.theme);
    }
  } catch {
    /* keep default size */
  }

  // Layout/master parts are parsed ONCE each per call, however many slides
  // share them, and the number of distinct parts is capped.
  const layerCache = new Map<string, PhLayer | null>();
  const getLayer = (path: string | undefined): PhLayer | undefined => {
    if (!path) return undefined;
    const cached = layerCache.get(path);
    if (cached !== undefined) return cached ?? undefined;
    if (layerCache.size >= MAX_STYLE_PARTS) return undefined;
    let layer: PhLayer | null = null;
    try {
      layer = readPhLayer(store, path, parseXml, deck.theme);
    } catch {
      layer = null;
    }
    layerCache.set(path, layer);
    return layer ?? undefined;
  };

  let slidePaths: string[] = [];
  try {
    slidePaths = slidePathsInOrder(store, parseXml);
  } catch {
    slidePaths = [];
  }

  for (let i = 0; i < slidePaths.length && i < MAX_SLIDES; i++) {
    const path = slidePaths[i];
    if (path === undefined) continue;
    const slide: PptxReadSlide = { index: i, nodes: [] };
    try {
      const doc = parsePart(store, path, parseXml);
      if (doc?.documentElement) {
        // slide rels (pic embeds + notes link)
        const rels = parseRels(store, path, parseXml);
        const relsById = new Map<string, Rel>(rels.map((r) => [r.id, r]));
        // layout → master cascade for this slide's placeholders
        const layoutRel = rels.find((r) => /slideLayout$/i.test(r.type) && !r.external);
        const layout = getLayer(layoutRel?.target);
        const master = getLayer(layout?.masterPath);
        const cascade: Cascade | undefined = layout || master || defaults ? { layout, master, defaults } : undefined;
        const spTree = descendantByLocal(doc.documentElement, 'spTree');
        if (spTree) walkTree(spTree, deck.theme, relsById, slide.nodes, 0, cascade);
        // notes
        const notesRel = rels.find((r) => /notesSlide$/i.test(r.type) && !r.external);
        if (notesRel) {
          const notes = readNotes(store, notesRel.target, parseXml);
          if (notes) slide.notes = notes;
        }
      }
    } catch {
      /* a broken slide yields an empty node list, not a crash */
    }
    deck.slides.push(slide);
  }

  return deck;
}
