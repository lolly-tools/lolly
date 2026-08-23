// SPDX-License-Identifier: MPL-2.0
/**
 * docx-read.ts: PARSE an unzipped .docx part map into `doc-model.ts` blocks.
 *
 * The document twin of `pptx-read.ts`, and the read half that `docx.ts` (the
 * writer) never had. It produces CONTENT, not geometry: headings, paragraphs,
 * lists, tables, links, images and footnotes, which `doc-md.ts` then serialises
 * to GFM markdown or to the HTML an editor ingests. Re-flowing a Word document
 * into a brand template needs meaning; patching one in place would need position,
 * and that is a different model.
 *
 * ── DESIGN CONTRACT (identical to pptx-read.ts) ──────────────────────────────
 *  • The CALLER inflates the zip and hands over a `Record<path, Uint8Array|string>`
 *    (fflate in the shells, a fixture map in tests). The `PK` magic-byte sniff and
 *    the zip caps belong to the caller.
 *  • The engine is XML-library-free, so an XML parser is INJECTED:
 *    `parseXml:(s:string)=>Document`. The web shell passes the native DOMParser;
 *    Node shells and tests pass a jsdom-backed one. No DOM library is imported and
 *    `document`/`window`/`fetch` are never touched.
 *  • Traversal is namespace-AGNOSTIC: elements match on their LOCAL name ("pStyle",
 *    not "w:pStyle"), so a namespace-aware and a prefix-preserving parser behave
 *    the same.
 *
 * ── STRUCTURE OF A .docx (only the parts read here) ──────────────────────────
 *   • word/document.xml - `w:body` holds `w:p` (paragraph) and `w:tbl` (table) in
 *     reading order. A paragraph's `w:pPr` carries its style reference
 *     (`w:pStyle`), its numbering membership (`w:numPr` = `w:ilvl` + `w:numId`)
 *     and sometimes a direct `w:outlineLvl`. Text lives in `w:r/w:t`; a run's
 *     `w:rPr` carries `w:b`, `w:i`, `w:u`, `w:strike`. `xml:space="preserve"` is
 *     what keeps a `w:t`'s leading/trailing spaces (without it they are dropped
 *     per ECMA-376, which is exactly what the attribute is for).
 *   • word/styles.xml - styleId to heading level. A style is a heading when its
 *     id or `w:name` reads "Heading N", or when its `w:pPr/w:outlineLvl` says so.
 *     `w:basedOn` is chased ONE hop, which covers the "MyHeading based on
 *     Heading2" case without opening a cycle-walk.
 *   • word/numbering.xml - `w:num` (by numId) points at a `w:abstractNum`, whose
 *     `w:lvl` for each `w:ilvl` carries `w:numFmt`: "bullet" is an unordered list,
 *     anything else that counts (decimal, lowerLetter, upperRoman, ...) is ordered.
 *   • word/_rels/document.xml.rels - `r:id` to a target: a hyperlink's URL
 *     (TargetMode="External") or an image's media part path.
 *   • word/footnotes.xml, word/endnotes.xml - note bodies by `w:id`. The
 *     separator pseudo-notes (id 0 and -1) are not content.
 *
 * ── DEFERRED, explicitly (documented so it is not mistaken for a bug) ─────────
 *   • OMML equations (`m:oMath`): no maths renderer exists downstream.
 *   • `w:drawing` beyond a picture: text boxes, shapes, charts and SmartArt are
 *     skipped, not flattened. Only a `a:blip` embed becomes an image block.
 *   • Fields (`w:fldSimple`, `w:instrText`): the CACHED result text is emitted,
 *     the field instruction is not. A table of contents therefore reads as the
 *     text Word last computed.
 *   • Section and page geometry (`w:sectPr`), headers/footers, columns, tab stops.
 *   • Comments. Track changes resolve to the ACCEPTED text: `w:ins` is unwrapped,
 *     `w:del` content is dropped.
 *   • A cell holds inlines, so a NESTED table flattens into its parent cell's text
 *     and an image inside a cell is emitted as an image block after the table.
 *
 * ── SECURITY (a hostile document is the threat model) ────────────────────────
 * Mirrors `xlsx-import.ts`'s regime. Every part is size-capped BEFORE decode; a
 * macro-enabled file (`word/vbaProject.bin`) is refused with a clear Error rather
 * than silently read; paragraph, block, run, inline, table row/column/cell,
 * footnote, media and style counts are all hard-capped, and the result reports
 * `truncated` when a cap bit. Recursion (nested tables, nested inline wrappers,
 * content controls) is depth-capped, and every descendant search is bounded by a
 * visit counter. A malformed or hostile XML part NEVER throws: whatever parsed is
 * returned and the rest is skipped. Entity expansion (billion laughs) is the
 * injected parser's responsibility, as in pptx-read.
 */

import type { DocBlock, DocInline, DocListItem, DocMedia, DocTableCell } from './doc-model.ts';

// ─── public surface ──────────────────────────────────────────────────────────

/** An unzipped OOXML part map. Values are raw bytes or already-decoded text. */
export type DocxParts = Record<string, Uint8Array | string>;

/** DOMParser-shaped adapter injected by the host (web: native; tests: jsdom). */
export type XmlParser = (xml: string) => Document;

/** What {@link readDocx} returns: blocks in reading order plus the media parts
 *  the image blocks cite, so a caller can materialise files or catalog assets. */
export interface DocxReadResult {
  blocks: DocBlock[];
  media: DocMedia[];
  /** true when a cap cut the document short (see the caps below). */
  truncated: boolean;
}

// ─── hardening caps ──────────────────────────────────────────────────────────

const MAX_PART_BYTES = 24 * 1024 * 1024; // skip decoding a part bigger than this
const MAX_PART_CHARS = 16 * 1024 * 1024;
const MAX_PARAGRAPHS = 20_000; // ~600 pages of prose; a runaway backstop
const MAX_BLOCKS = 20_000;
const MAX_RUNS_PER_PARA = 4_000;
const MAX_INLINES_PER_PARA = 8_000;
const MAX_TABLE_ROWS = 2_000;
const MAX_TABLE_COLS = 512;
const MAX_TABLE_CELLS = 100_000; // across the whole document
const MAX_TABLE_DEPTH = 8;
const MAX_INLINE_DEPTH = 16;
const MAX_LIST_LEVEL = 8; // Word defines nine outline levels (0..8)
const MAX_FOOTNOTES = 5_000;
const MAX_MEDIA = 2_000;
const MAX_STYLES = 5_000;
const MAX_TEXT_LEN = 200_000; // per w:t clamp
const MAX_DFS_VISITS = 200_000; // bound any descendant search
const MAX_RELS = 100_000;

// Node type constant (avoids depending on the DOM `Node` value namespace).
const ELEMENT_NODE = 1;

// ─── low-level, namespace-agnostic DOM helpers (on the INJECTED doc) ─────────

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

function firstChildByLocal(el: Element | null, local: string): Element | null {
  if (!el) return null;
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (isElement(n) && elemLocal(n as unknown as Element) === local) return n as unknown as Element;
  }
  return null;
}

function childrenByLocal(el: Element | null, local: string): Element[] {
  return el ? childElements(el).filter((c) => elemLocal(c) === local) : [];
}

/** First descendant (DFS, visit-bounded) whose local name matches. */
function descendantByLocal(root: Element, local: string): Element | null {
  let visits = 0;
  const stack: Element[] = [root];
  while (stack.length) {
    const el = stack.pop() as Element;
    if (++visits > MAX_DFS_VISITS) return null;
    if (el !== root && elemLocal(el) === local) return el;
    const kids = el.childNodes;
    for (let i = kids.length - 1; i >= 0; i--) {
      const n = kids[i];
      if (isElement(n)) stack.push(n as unknown as Element);
    }
  }
  return null;
}

/** Attribute value by LOCAL name (handles namespaced attrs like `r:id`, `xml:space`). */
function attrByLocal(el: Element | null, local: string): string | null {
  if (!el) return null;
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

/** The `w:val` of an element, the way WordprocessingML states nearly every value. */
const valOf = (el: Element | null): string | null => attrByLocal(el, 'val');

function textOf(el: Element | null): string {
  if (!el) return '';
  const t = el.textContent ?? '';
  return t.length > MAX_TEXT_LEN ? t.slice(0, MAX_TEXT_LEN) : t;
}

function toInt(v: string | null, def: number): number {
  if (v == null) return def;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

/**
 * A WordprocessingML toggle: PRESENT means on unless its `w:val` says otherwise.
 * `<w:b/>` is bold; `<w:b w:val="0"/>` (or "false"/"off") is explicitly not bold,
 * which is how a run opts out of a style's bold.
 */
function onOff(el: Element | null): boolean {
  if (!el) return false;
  const v = valOf(el);
  if (v == null) return true;
  const s = v.trim().toLowerCase();
  return !(s === '0' || s === 'false' || s === 'off' || s === 'none');
}

// ─── part access + decode ────────────────────────────────────────────────────

interface PartStore {
  get(path: string): string | null;
  has(path: string): boolean;
}

function makeStore(parts: DocxParts): PartStore {
  // Case-insensitive index: OOXML paths are consistent-case in practice, a
  // re-zipped or hostile archive need not be.
  const lower = new Map<string, string>();
  for (const k of Object.keys(parts)) {
    if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), k);
  }
  const raw = (path: string): Uint8Array | string | undefined => {
    const direct = parts[path];
    if (direct !== undefined) return direct;
    const real = lower.get(path.toLowerCase());
    return real !== undefined ? parts[real] : undefined;
  };
  return {
    has: (path) => raw(path) !== undefined,
    get(path: string): string | null {
      const v = raw(path);
      if (v === undefined) return null;
      if (typeof v === 'string') return v.length > MAX_PART_CHARS ? null : v;
      if (!(v instanceof Uint8Array) || v.byteLength > MAX_PART_BYTES) return null;
      try {
        return new TextDecoder('utf-8').decode(v);
      } catch {
        return null;
      }
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
  // Browsers and jsdom both surface an XML syntax error as a <parsererror> root.
  if (elemLocal(root) === 'parsererror') return null;
  return doc;
}

// ─── relationships ───────────────────────────────────────────────────────────

interface Rel {
  target: string; // resolved part path, or the external URL untouched
  external: boolean;
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

function parseRels(store: PartStore, parseXml: XmlParser): Map<string, Rel> {
  const byId = new Map<string, Rel>();
  const doc = parsePart(store, 'word/_rels/document.xml.rels', parseXml);
  if (!doc?.documentElement) return byId;
  for (const rel of childElements(doc.documentElement)) {
    if (elemLocal(rel) !== 'Relationship') continue;
    const id = attrByLocal(rel, 'Id') || '';
    const target = attrByLocal(rel, 'Target') || '';
    const external = (attrByLocal(rel, 'TargetMode') || '').toLowerCase() === 'external';
    if (id) {
      byId.set(id, { external, target: external ? target : resolveTarget('word', target) });
    }
    if (byId.size > MAX_RELS) break;
  }
  return byId;
}

// ─── styles: styleId to heading level ────────────────────────────────────────

interface StyleInfo {
  /** lowercased styleId to heading level 1..6. */
  levels: Map<string, number>;
  /** lowercased styleIds that mean "block quote". */
  quotes: Set<string>;
}

/** "Heading 3" / "heading3" / "Heading3" to 3; anything else to null. */
function headingFromName(name: string): number | null {
  const m = /^heading\s*([1-9])$/i.exec(name.trim());
  if (!m?.[1]) return null;
  return Math.min(6, Number.parseInt(m[1], 10));
}

/** `w:outlineLvl` is 0-based (0 = Heading 1) and runs 0..8; clamp to the six
 *  levels a markdown or HTML heading can express. */
function levelFromOutline(v: string | null): number | null {
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0 || n > 8) return null;
  return Math.min(6, n + 1);
}

function readStyles(store: PartStore, parseXml: XmlParser): StyleInfo {
  const levels = new Map<string, number>();
  const quotes = new Set<string>();
  const doc = parsePart(store, 'word/styles.xml', parseXml);
  if (!doc?.documentElement) return { levels, quotes };
  // styleId to its w:basedOn parent, for the single inheritance hop below.
  const basedOn = new Map<string, string>();
  let seen = 0;
  for (const st of childrenByLocal(doc.documentElement, 'style')) {
    if (++seen > MAX_STYLES) break;
    const type = attrByLocal(st, 'type') || 'paragraph';
    if (type !== 'paragraph') continue;
    const id = (attrByLocal(st, 'styleId') || '').toLowerCase();
    if (!id) continue;
    const name = (valOf(firstChildByLocal(st, 'name')) || '').toLowerCase();
    const pPr = firstChildByLocal(st, 'pPr');
    const level =
      headingFromName(id) ??
      headingFromName(name) ??
      levelFromOutline(valOf(firstChildByLocal(pPr, 'outlineLvl')));
    const base = (valOf(firstChildByLocal(st, 'basedOn')) || '').toLowerCase();
    if (level != null) levels.set(id, level);
    else if (base) basedOn.set(id, base);
    if (/^(intense)?quote$/.test(id) || /^(intense )?quote$/.test(name)) quotes.add(id);
  }
  // ONE hop: a style based on Heading2 is a heading 2. Deeper chains are rare and
  // a full walk would need cycle detection for a hostile styles part.
  for (const [id, base] of basedOn) {
    const lv = levels.get(base);
    if (lv != null) levels.set(id, lv);
    else if (quotes.has(base)) quotes.add(id);
  }
  return { levels, quotes };
}

// ─── numbering: numId + ilvl to ordered/unordered ────────────────────────────

/** A numbering format counts unless it is a bullet or explicitly nothing. */
const isOrderedFmt = (fmt: string): boolean => {
  const f = fmt.trim().toLowerCase();
  return f !== '' && f !== 'bullet' && f !== 'none';
};

function readNumbering(store: PartStore, parseXml: XmlParser): Map<string, Map<number, boolean>> {
  const byNumId = new Map<string, Map<number, boolean>>();
  const doc = parsePart(store, 'word/numbering.xml', parseXml);
  if (!doc?.documentElement) return byNumId;
  const abstract = new Map<string, Map<number, boolean>>();
  for (const an of childrenByLocal(doc.documentElement, 'abstractNum')) {
    const id = attrByLocal(an, 'abstractNumId');
    if (!id) continue;
    const lvls = new Map<number, boolean>();
    for (const lvl of childrenByLocal(an, 'lvl')) {
      const ilvl = toInt(attrByLocal(lvl, 'ilvl'), 0);
      lvls.set(ilvl, isOrderedFmt(valOf(firstChildByLocal(lvl, 'numFmt')) ?? ''));
      if (lvls.size > MAX_LIST_LEVEL + 1) break;
    }
    abstract.set(id, lvls);
    if (abstract.size > MAX_STYLES) break;
  }
  for (const num of childrenByLocal(doc.documentElement, 'num')) {
    const numId = attrByLocal(num, 'numId');
    const absId = valOf(firstChildByLocal(num, 'abstractNumId'));
    if (!numId || absId == null) continue;
    const lvls = abstract.get(absId);
    if (lvls) byNumId.set(numId, lvls);
    if (byNumId.size > MAX_STYLES) break;
  }
  return byNumId;
}

// ─── parse context ───────────────────────────────────────────────────────────

interface FoundImage {
  ref: string;
  alt: string;
}

interface Ctx {
  store: PartStore;
  parseXml: XmlParser;
  rels: Map<string, Rel>;
  styles: StyleInfo;
  numbering: Map<string, Map<number, boolean>>;
  blocks: DocBlock[];
  media: DocMedia[];
  mediaByPath: Map<string, string>;
  /** "f12"/"e3" to the sequential id printed in the output. */
  noteIds: Map<string, string>;
  noteOrder: Array<{ key: string; id: string }>;
  paraCount: number;
  cellCount: number;
  truncated: boolean;
  /** The list block currently accepting items, so consecutive numbered
   *  paragraphs merge instead of emitting one list per line. */
  openList: { ordered: boolean; items: DocListItem[] } | null;
}

function pushBlock(ctx: Ctx, block: DocBlock): void {
  if (ctx.blocks.length >= MAX_BLOCKS) {
    ctx.truncated = true;
    return;
  }
  ctx.blocks.push(block);
}

function closeList(ctx: Ctx): void {
  ctx.openList = null;
}

/** Register a media part once and return the stable name an image block cites.
 *  Matches deckToMarkdown's naming so both readers hand callers the same shape. */
function mediaRef(ctx: Ctx, path: string): string | null {
  const seen = ctx.mediaByPath.get(path);
  if (seen) return seen;
  if (ctx.media.length >= MAX_MEDIA) {
    ctx.truncated = true;
    return null;
  }
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(path);
  const ext = m?.[1] ? m[1].toLowerCase() : 'bin';
  const name = `media/${ctx.media.length + 1}.${ext}`;
  ctx.mediaByPath.set(path, name);
  ctx.media.push({ path, name });
  return name;
}

// ─── inline reading ──────────────────────────────────────────────────────────

/** A `w:t`'s text. Without `xml:space="preserve"` the surrounding whitespace is
 *  not content (ECMA-376), which is precisely what the attribute exists to say. */
function runText(el: Element): string {
  const raw = textOf(el);
  return attrByLocal(el, 'space') === 'preserve' ? raw : raw.replace(/^\s+|\s+$/g, '');
}

/** Wrap a run's inlines in the marks its `w:rPr` declares, innermost first. */
function wrapMarks(kids: DocInline[], rPr: Element | null): DocInline[] {
  if (!rPr || !kids.length) return kids;
  let node = kids;
  if (onOff(firstChildByLocal(rPr, 'strike')) || onOff(firstChildByLocal(rPr, 'dstrike'))) {
    node = [{ type: 'strike', inlines: node }];
  }
  const u = firstChildByLocal(rPr, 'u');
  if (u && onOff(u)) node = [{ type: 'underline', inlines: node }];
  if (onOff(firstChildByLocal(rPr, 'i'))) node = [{ type: 'em', inlines: node }];
  if (onOff(firstChildByLocal(rPr, 'b'))) node = [{ type: 'strong', inlines: node }];
  return node;
}

/** The sequential id for a footnote/endnote reference, assigned on FIRST use so
 *  the printed ids run 1, 2, 3 in reading order whatever the producer's ids were. */
function noteRefId(ctx: Ctx, kind: 'f' | 'e', rawId: string | null): string | null {
  if (rawId == null) return null;
  const n = Number.parseInt(rawId, 10);
  // ids 0 and -1 are the separator pseudo-notes, not content.
  if (!Number.isFinite(n) || n <= 0) return null;
  const key = `${kind}${n}`;
  const seen = ctx.noteIds.get(key);
  if (seen) return seen;
  if (ctx.noteOrder.length >= MAX_FOOTNOTES) {
    ctx.truncated = true;
    return null;
  }
  const id = String(ctx.noteOrder.length + 1);
  ctx.noteIds.set(key, id);
  ctx.noteOrder.push({ key, id });
  return id;
}

/** The image a `w:drawing` (or a legacy `w:pict`) embeds, or null when the
 *  drawing carries no picture (a text box, a chart, a shape). */
function readImage(el: Element, ctx: Ctx): FoundImage | null {
  const blip = descendantByLocal(el, 'blip');
  // Legacy VML pictures reference through v:imagedata instead of a:blip.
  const embed = blip ? attrByLocal(blip, 'embed') : attrByLocal(descendantByLocal(el, 'imagedata'), 'id');
  if (!embed) return null;
  const rel = ctx.rels.get(embed);
  if (!rel || rel.external || !rel.target) return null;
  const ref = mediaRef(ctx, rel.target);
  if (!ref) return null;
  const docPr = descendantByLocal(el, 'docPr');
  const alt = (attrByLocal(docPr, 'descr') || attrByLocal(docPr, 'name') || '').slice(0, 1000);
  return { ref, alt };
}

function readRun(r: Element, ctx: Ctx, images: FoundImage[], out: DocInline[]): void {
  const rPr = firstChildByLocal(r, 'rPr');
  const kids: DocInline[] = [];
  let seen = 0;
  for (const child of childElements(r)) {
    if (++seen > MAX_RUNS_PER_PARA) break;
    switch (elemLocal(child)) {
      case 't':
        kids.push({ type: 'text', text: runText(child) });
        break;
      case 'br':
      case 'cr':
        kids.push({ type: 'br' });
        break;
      case 'tab':
        kids.push({ type: 'text', text: '\t' });
        break;
      case 'noBreakHyphen':
        kids.push({ type: 'text', text: '-' });
        break;
      case 'drawing':
      case 'pict':
      case 'object': {
        const img = readImage(child, ctx);
        if (img) images.push(img);
        break;
      }
      case 'footnoteReference': {
        const id = noteRefId(ctx, 'f', attrByLocal(child, 'id'));
        if (id) kids.push({ type: 'footnoteRef', id });
        break;
      }
      case 'endnoteReference': {
        const id = noteRefId(ctx, 'e', attrByLocal(child, 'id'));
        if (id) kids.push({ type: 'footnoteRef', id });
        break;
      }
      default:
        // rPr, instrText, fldChar, delText, sym, softHyphen: not content here.
        break;
    }
  }
  if (!kids.length) return;
  for (const node of wrapMarks(kids, rPr)) out.push(node);
}

/**
 * Collect the inline content of a paragraph-like container. Track changes are
 * resolved here: `w:ins` is unwrapped (the insertion is accepted text) and
 * `w:del` is skipped entirely (the deletion is gone).
 */
function collectInlines(
  el: Element,
  ctx: Ctx,
  depth: number,
  images: FoundImage[],
  out: DocInline[],
): void {
  if (depth > MAX_INLINE_DEPTH) return;
  for (const child of childElements(el)) {
    if (out.length >= MAX_INLINES_PER_PARA) {
      ctx.truncated = true;
      return;
    }
    switch (elemLocal(child)) {
      case 'r':
        readRun(child, ctx, images, out);
        break;
      case 'hyperlink': {
        const inner: DocInline[] = [];
        collectInlines(child, ctx, depth + 1, images, inner);
        if (!inner.length) break;
        const rid = attrByLocal(child, 'id');
        const rel = rid ? ctx.rels.get(rid) : undefined;
        const anchor = attrByLocal(child, 'anchor');
        const href = rel?.target ? rel.target : anchor ? `#${anchor}` : '';
        if (href) out.push({ type: 'link', href, inlines: inner });
        else for (const n of inner) out.push(n);
        break;
      }
      case 'sdt': {
        // A content control wraps real content; its sdtContent is the document.
        const inner = firstChildByLocal(child, 'sdtContent');
        if (inner) collectInlines(inner, ctx, depth + 1, images, out);
        break;
      }
      case 'ins':
      case 'smartTag':
      case 'fldSimple':
      case 'bdo':
      case 'dir':
        collectInlines(child, ctx, depth + 1, images, out);
        break;
      case 'del':
        // Deleted text is not part of the accepted document.
        break;
      default:
        // pPr, bookmarkStart/End, proofErr, commentRangeStart/End, oMath: skipped.
        break;
    }
  }
}

// ─── paragraphs ──────────────────────────────────────────────────────────────

/** True when the inlines carry any text a reader would see. */
function hasText(nodes: DocInline[]): boolean {
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        if (n.text.trim().length) return true;
        break;
      case 'code':
        if (n.text.trim().length) return true;
        break;
      case 'footnoteRef':
        return true;
      case 'strong':
      case 'em':
      case 'underline':
      case 'strike':
      case 'link':
        if (hasText(n.inlines)) return true;
        break;
      default:
        break;
    }
  }
  return false;
}

/** `w:numPr` membership: the list this paragraph belongs to, if any. */
function readNumPr(pPr: Element | null): { numId: string; ilvl: number } | null {
  const numPr = firstChildByLocal(pPr, 'numPr');
  if (!numPr) return null;
  const numId = valOf(firstChildByLocal(numPr, 'numId'));
  if (numId == null || numId === '0') return null; // numId 0 removes numbering
  const ilvl = toInt(valOf(firstChildByLocal(numPr, 'ilvl')), 0);
  return { numId, ilvl: Math.max(0, Math.min(MAX_LIST_LEVEL, ilvl)) };
}

function headingLevel(styleId: string | null, pPr: Element | null, ctx: Ctx): number {
  if (styleId) {
    const byStyle = ctx.styles.levels.get(styleId.toLowerCase());
    if (byStyle) return byStyle;
    const direct = headingFromName(styleId);
    if (direct) return direct;
  }
  // A paragraph may state its outline level directly, without a heading style.
  return levelFromOutline(valOf(firstChildByLocal(pPr, 'outlineLvl'))) ?? 0;
}

function readParagraph(p: Element, ctx: Ctx, depth: number): void {
  if (ctx.paraCount >= MAX_PARAGRAPHS) {
    ctx.truncated = true;
    return;
  }
  ctx.paraCount++;

  const pPr = firstChildByLocal(p, 'pPr');
  const images: FoundImage[] = [];
  const inlines: DocInline[] = [];
  collectInlines(p, ctx, depth, images, inlines);

  const styleId = valOf(firstChildByLocal(pPr, 'pStyle'));
  const level = headingLevel(styleId, pPr, ctx);
  const num = level > 0 ? null : readNumPr(pPr); // a numbered heading stays a heading
  const text = hasText(inlines);

  if (num && text) {
    const lvls = ctx.numbering.get(num.numId);
    const ordered = lvls?.get(num.ilvl) ?? lvls?.get(0) ?? false;
    if (ctx.openList && ctx.openList.ordered === ordered) {
      ctx.openList.items.push({ level: num.ilvl, inlines });
    } else {
      const items: DocListItem[] = [{ level: num.ilvl, inlines }];
      ctx.openList = { ordered, items };
      pushBlock(ctx, { type: 'list', ordered, items });
    }
  } else if (text) {
    closeList(ctx);
    if (level > 0) pushBlock(ctx, { type: 'heading', level, inlines });
    else if (styleId && ctx.styles.quotes.has(styleId.toLowerCase())) {
      pushBlock(ctx, { type: 'quote', inlines });
    } else pushBlock(ctx, { type: 'para', inlines });
  }

  // An inline picture becomes its own block, after the text it sat with.
  if (images.length) {
    closeList(ctx);
    for (const img of images) pushBlock(ctx, { type: 'image', ref: img.ref, alt: img.alt });
  }
}

// ─── tables ──────────────────────────────────────────────────────────────────

/** A cell's inlines: its paragraphs joined by hard breaks. A nested table
 *  flattens into the same run of inlines (the model holds no nested blocks);
 *  pictures are handed to `images` for emission after the table. */
function cellInlines(tc: Element, ctx: Ctx, depth: number, images: FoundImage[]): DocInline[] {
  const out: DocInline[] = [];
  let first = true;
  for (const child of childElements(tc)) {
    const name = elemLocal(child);
    if (name === 'p') {
      if (ctx.paraCount >= MAX_PARAGRAPHS) {
        ctx.truncated = true;
        break;
      }
      ctx.paraCount++;
      if (!first) out.push({ type: 'br' });
      first = false;
      collectInlines(child, ctx, 0, images, out);
    } else if (name === 'tbl' && depth < MAX_TABLE_DEPTH) {
      for (const tr of childrenByLocal(child, 'tr')) {
        for (const inner of childrenByLocal(tr, 'tc')) {
          if (!first) out.push({ type: 'br' });
          first = false;
          for (const n of cellInlines(inner, ctx, depth + 1, images)) out.push(n);
        }
      }
    }
  }
  return out;
}

/** A header row is declared (`w:tblHeader`, "repeat as header row") or reads as
 *  one: every run carrying text is bold. Word marks the first case rarely, so
 *  without the second nearly every real table would print a header of blanks. */
function looksLikeHeaderRow(tr: Element): boolean {
  if (firstChildByLocal(firstChildByLocal(tr, 'trPr'), 'tblHeader')) return true;
  let sawText = false;
  for (const tc of childrenByLocal(tr, 'tc')) {
    for (const p of childrenByLocal(tc, 'p')) {
      for (const r of childrenByLocal(p, 'r')) {
        const t = childrenByLocal(r, 't').map(textOf).join('');
        if (!t.trim()) continue;
        sawText = true;
        if (!onOff(firstChildByLocal(firstChildByLocal(r, 'rPr'), 'b'))) return false;
      }
    }
  }
  return sawText;
}

function readTable(tbl: Element, ctx: Ctx, depth: number): void {
  const images: FoundImage[] = [];
  const rows: DocTableCell[][] = [];
  let spans = false;
  let firstRow: DocTableCell[] | null = null;
  // Column index to the cell a vertical merge started in, so a continuation row
  // grows THAT cell's rowspan. Word emits the continuation cells, so counting
  // gridSpan along the row keeps the column index aligned.
  const openMerge = new Map<number, DocTableCell>();

  const trs = childrenByLocal(tbl, 'tr').slice(0, MAX_TABLE_ROWS);
  for (const tr of trs) {
    const cells: DocTableCell[] = [];
    let col = 0;
    for (const tc of childrenByLocal(tr, 'tc')) {
      if (col >= MAX_TABLE_COLS) break;
      if (ctx.cellCount >= MAX_TABLE_CELLS) {
        ctx.truncated = true;
        break;
      }
      ctx.cellCount++;
      const tcPr = firstChildByLocal(tc, 'tcPr');
      const span = Math.max(1, Math.min(MAX_TABLE_COLS, toInt(valOf(firstChildByLocal(tcPr, 'gridSpan')), 1)));
      const vMerge = firstChildByLocal(tcPr, 'vMerge');
      const vMergeVal = vMerge ? (valOf(vMerge) || 'continue').toLowerCase() : null;

      if (vMerge && vMergeVal !== 'restart') {
        const open = openMerge.get(col);
        if (open) {
          open.rowspan = (open.rowspan ?? 1) + 1;
          spans = true;
        }
        col += span;
        continue; // a continuation cell is the cell above, not a new one
      }

      const cell: DocTableCell = { inlines: cellInlines(tc, ctx, depth, images) };
      if (span > 1) {
        cell.colspan = span;
        spans = true;
      }
      cells.push(cell);
      if (vMergeVal === 'restart') openMerge.set(col, cell);
      else openMerge.delete(col);
      col += span;
    }
    if (!cells.length) continue; // a row of pure continuations adds nothing
    if (firstRow === null) firstRow = cells;
    rows.push(cells);
  }

  if (rows.length) {
    let header: DocTableCell[] | undefined;
    const firstTr = trs[0];
    if (rows.length > 1 && firstTr && rows[0] === firstRow && looksLikeHeaderRow(firstTr)) {
      header = rows.shift();
    }
    const block: DocBlock = { type: 'table', rows };
    if (header) block.header = header;
    if (spans) block.htmlSpans = true;
    closeList(ctx);
    pushBlock(ctx, block);
  }

  // Cells hold inlines, so a picture inside one is emitted after the table.
  for (const img of images) pushBlock(ctx, { type: 'image', ref: img.ref, alt: img.alt });
}

// ─── body walk ───────────────────────────────────────────────────────────────

function walkBody(el: Element, ctx: Ctx, depth: number): void {
  if (depth > MAX_TABLE_DEPTH) return;
  for (const child of childElements(el)) {
    if (ctx.truncated && ctx.paraCount >= MAX_PARAGRAPHS) return;
    try {
      switch (elemLocal(child)) {
        case 'p':
          readParagraph(child, ctx, 0);
          break;
        case 'tbl':
          readTable(child, ctx, depth + 1);
          break;
        case 'sdt': {
          const inner = firstChildByLocal(child, 'sdtContent');
          if (inner) walkBody(inner, ctx, depth + 1);
          break;
        }
        default:
          // sectPr, bookmarks, proofErr: no content of their own.
          break;
      }
    } catch {
      // A malformed paragraph or table never sinks the document.
    }
  }
}

// ─── footnotes and endnotes ──────────────────────────────────────────────────

function collectNotes(
  ctx: Ctx,
  path: string,
  local: string,
  kind: 'f' | 'e',
  into: Map<string, Element>,
): void {
  const doc = parsePart(ctx.store, path, ctx.parseXml);
  if (!doc?.documentElement) return;
  for (const note of childrenByLocal(doc.documentElement, local)) {
    const type = (attrByLocal(note, 'type') || '').toLowerCase();
    // separator / continuationSeparator / continuationNotice are furniture.
    if (type && type !== 'normal') continue;
    const id = attrByLocal(note, 'id');
    if (id == null) continue;
    const n = Number.parseInt(id, 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    into.set(`${kind}${n}`, note);
    if (into.size > MAX_FOOTNOTES) return;
  }
}

function appendNotes(ctx: Ctx): void {
  if (!ctx.noteOrder.length) return;
  const notes = new Map<string, Element>();
  try {
    collectNotes(ctx, 'word/footnotes.xml', 'footnote', 'f', notes);
    collectNotes(ctx, 'word/endnotes.xml', 'endnote', 'e', notes);
  } catch {
    // An unreadable notes part leaves the references pointing at empty bodies.
  }
  for (const { key, id } of ctx.noteOrder) {
    const el = notes.get(key);
    const inlines: DocInline[] = [];
    if (el) {
      const images: FoundImage[] = [];
      let first = true;
      for (const p of childrenByLocal(el, 'p')) {
        if (!first) inlines.push({ type: 'br' });
        first = false;
        collectInlines(p, ctx, 0, images, inlines);
        if (inlines.length >= MAX_INLINES_PER_PARA) break;
      }
    }
    pushBlock(ctx, { type: 'footnote', id, inlines });
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Detect a Word part map by the presence of `word/document.xml`. The `PK`
 * zip-magic sniff belongs to the CALLER (before inflation); this operates on the
 * already-unzipped map, mirroring {@link isPptx} for routing.
 */
export function isDocx(parts: DocxParts): boolean {
  if (!parts || typeof parts !== 'object') return false;
  const direct = parts['word/document.xml'];
  if (direct !== undefined) return typeof direct === 'string' ? direct.length > 0 : direct.byteLength > 0;
  for (const k of Object.keys(parts)) {
    if (k.toLowerCase() === 'word/document.xml') {
      const raw = parts[k];
      if (raw === undefined) return false;
      return typeof raw === 'string' ? raw.length > 0 : raw.byteLength > 0;
    }
  }
  return false;
}

/**
 * Parse an unzipped .docx part map into `doc-model.ts` blocks.
 *
 * Never throws on content: a malformed, oversized or hostile part yields
 * whatever parsed and the rest is skipped. The ONE refusal is a macro-enabled
 * document, which carries executable content alongside the text.
 *
 * @param parts    the unzipped part map (the caller owns unzip + the zip caps).
 * @param parseXml the injected XML parser (web: DOMParser; Node: jsdom).
 * @throws if the document is macro-enabled (`word/vbaProject.bin` present).
 */
export function readDocx(parts: DocxParts, parseXml: XmlParser): DocxReadResult {
  const empty: DocxReadResult = { blocks: [], media: [], truncated: false };
  if (!parts || typeof parts !== 'object' || typeof parseXml !== 'function') return empty;

  const store = makeStore(parts);

  // A macro-enabled document (.docm) ships a VBA project; refuse it rather than
  // quietly reading a file that also carries executable content.
  if (store.has('word/vbaProject.bin')) {
    throw new Error('This document is macro-enabled (.docm) - save it as a plain .docx.');
  }

  const ctx: Ctx = {
    store,
    parseXml,
    rels: new Map(),
    styles: { levels: new Map(), quotes: new Set() },
    numbering: new Map(),
    blocks: [],
    media: [],
    mediaByPath: new Map(),
    noteIds: new Map(),
    noteOrder: [],
    paraCount: 0,
    cellCount: 0,
    truncated: false,
    openList: null,
  };

  try {
    ctx.rels = parseRels(store, parseXml);
  } catch {
    /* no rels: links and images degrade to plain text */
  }
  try {
    ctx.styles = readStyles(store, parseXml);
  } catch {
    /* no styles: headings fall back to the pStyle name match */
  }
  try {
    ctx.numbering = readNumbering(store, parseXml);
  } catch {
    /* no numbering: lists default to unordered */
  }

  try {
    const doc = parsePart(store, 'word/document.xml', parseXml);
    const body = doc?.documentElement ? descendantByLocal(doc.documentElement, 'body') : null;
    if (body) walkBody(body, ctx, 0);
  } catch {
    /* a broken document part yields the blocks read so far */
  }

  try {
    appendNotes(ctx);
  } catch {
    /* notes are additive; their absence is not a failure */
  }

  return { blocks: ctx.blocks, media: ctx.media, truncated: ctx.truncated };
}
