// SPDX-License-Identifier: MPL-2.0
/**
 * DOCX (Word / WordprocessingML OOXML) builder. Pure, DOM-free, platform-agnostic.
 *
 * The document twin of `pptx.ts`, and the write half of `docx-read.ts`. A .docx file is a
 * ZIP of XML parts. The format makes the same pitch to Word that PowerPoint gets: hand over
 * real editable text, not a rasterised picture. `writeDocx` takes either the original
 * heading/paragraph block list or the richer `doc-model.ts` {@link DocBlock} shape and emits a
 * minimal, spec-valid WordprocessingML package that opens and stays fully editable in Word,
 * LibreOffice Writer and Google Docs. That triple is the compatibility bar: every part below
 * stays spec-minimal rather than reproducing what Word itself writes.
 *
 * ── THE FIVE ALWAYS-PRESENT PARTS ────────────────────────────────────────────
 *   - `[Content_Types].xml` - declares the .rels + .xml defaults and the main-document
 *     + styles part content types.
 *   - `_rels/.rels` - the package root relationship to word/document.xml (the
 *     `officeDocument` root; without it Word cannot find the body).
 *   - `word/document.xml` - `w:document/w:body`: one `w:p` per block, `w:tbl` per table.
 *     A run is `w:r/w:t`, and every `w:t` carries `xml:space="preserve"` so
 *     leading/trailing spaces survive. Headings reference a `w:pStyle`
 *     ("Heading1".."Heading6"); paragraphs carry none. The body's trailing `w:sectPr`
 *     (page geometry) is required for Word to treat the document as laid out.
 *   - `word/styles.xml` - defines Normal (the document default) + Heading1..6, so a
 *     `pStyle` reference resolves to a visible style (bold, graded sizes) instead of a
 *     dangling id. Quote / TableHeader / Code are appended only when a block needs them.
 *   - `word/_rels/document.xml.rels` - relates the main document to styles.xml, and to
 *     numbering, footnotes, every unique hyperlink target and every image part.
 *
 * ── THE CONDITIONAL PARTS (a document that needs none is byte-identical to the
 *    headings+paragraphs output this writer produced before) ────────────────────
 *   - `word/numbering.xml` - emitted only when a `list` block exists. Exactly two
 *     `w:abstractNum` (bullet, decimal) of nine levels each; numId 1 is the bullet list
 *     and numId 2 the decimal one, and a list paragraph carries `w:numPr` = numId + ilvl.
 *   - `word/footnotes.xml` - emitted only when a `footnote` block exists, and carries the
 *     two separator pseudo-notes (ids -1 and 0) Word expects alongside the real bodies.
 *   - `word/media/*` - emitted only for images, with a `Default Extension` content type
 *     per distinct extension.
 * Each conditional part registers its own content type and relationship; nothing about
 * the five parts above changes when they are absent.
 *
 * Namespace trap (shared with pptx.ts): the .rels CONTAINER namespace is
 * …/package/2006/relationships, NOT the …/officeDocument/… relationship-TYPE base. The main
 * document uses the `w:` WordprocessingML namespace throughout; `r:` (relationships) and
 * `wp:` (wordprocessingDrawing) are declared on `w:document` ONLY when a hyperlink or an
 * image needs them, and the DrawingML `a:`/`pic:` namespaces are declared inline on the
 * elements that use them so the root declaration set stays stable.
 *
 * ── WHAT IS DELIBERATELY NOT EXPRESSED ───────────────────────────────────────
 * A `code` block writes one styled paragraph per line and an inline `code` run writes a
 * monospace run: WordprocessingML has no code construct, so `docx-read.ts` reads both back
 * as ordinary text. Colour, alignment, fonts and sizes are not in the block model at all.
 * A link inside a footnote body flattens to its text, because a note's relationships live in
 * a second rels part (word/_rels/footnotes.xml.rels) this writer does not emit.
 * Returns the finished zip bytes via the shared `storeZip`. No DOM, no deps beyond the
 * named engine primitives.
 */

import type { DocBlock, DocInline, DocTableCell } from './doc-model.ts';
import { storeZip, type ZipStoreEntry } from './zip.ts';

const encoder = new TextEncoder();

// WordprocessingML + OPC namespaces.
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
// DrawingML: the picture markup an inline image needs.
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC_NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';

/** One block of the original (pre-doc-model) block list. A heading carries a `level` (1..6,
 *  clamped); a paragraph ignores it. Still accepted, and still emitted byte-for-byte the way
 *  it always was: `blocks` is a union, so a caller passing this shape needs no change. */
export interface DocxBlock {
  type: 'heading' | 'paragraph';
  /** Heading depth 1..6 → pStyle "Heading1".."Heading6". Out-of-range values clamp. */
  level?: number;
  text: string;
}

/** The bytes behind one `image` block. `name` matches that block's `ref`; `width`/`height`
 *  are natural size in CSS px, sniffed from PNG/GIF/JPEG bytes when omitted. */
export interface DocxMedia {
  name: string;
  bytes: Uint8Array;
  width?: number;
  height?: number;
}

/** The document model `writeDocx` serializes. `title` names the document for callers; it is
 *  currently unused by the emitted parts (there is no docProps part) but kept so callers pass a
 *  document, not a bare block list, and a future core.xml is a purely additive change.
 *  `blocks` accepts either block shape, mixed: a {@link DocxBlock} is normalised to the
 *  equivalent {@link DocBlock} before anything is emitted. */
export interface DocxDoc {
  title?: string;
  blocks: Array<DocxBlock | DocBlock>;
  /** Bytes for the `image` blocks. An image whose `ref` names no entry here is skipped. */
  media?: DocxMedia[];
}

// Nested inline wrappers are bounded the way docx-read.ts bounds them, so a cyclic or
// pathologically deep tree cannot blow the stack.
const MAX_INLINE_DEPTH = 16;

// Strip the chars illegal in XML 1.0's Char production before entity-escaping: the C0
// controls (below U+0020 except tab/LF/CR) plus U+FFFE/U+FFFF. A stray one in user text
// causes a hard parse-fail (Word "unreadable content" repair), so drop it at the single
// chokepoint.
const xmlEsc = (s: string): string =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Clamp a heading level to the 1..6 range Word defines styles for. Non-finite → 1. */
const clampLevel = (n: number | undefined): number =>
  Number.isFinite(n) ? Math.min(6, Math.max(1, Math.trunc(n as number))) : 1;

const clampSpan = (n: number | undefined): number =>
  Number.isFinite(n) ? Math.min(512, Math.max(1, Math.trunc(n as number))) : 1;

// ─── block-shape normalisation ───────────────────────────────────────────────

/** The original shape is discriminated by its `text` string: doc-model's own `heading` and
 *  `para` carry `inlines` instead, and its `code` block is a different type name. */
function isLegacyBlock(b: DocxBlock | DocBlock): b is DocxBlock {
  return (
    (b.type === 'paragraph' || b.type === 'heading') && typeof (b as DocxBlock).text === 'string'
  );
}

function normaliseBlock(b: DocxBlock | DocBlock): DocBlock {
  if (!isLegacyBlock(b)) return b;
  const inlines: DocInline[] = [{ type: 'text', text: b.text ?? '' }];
  return b.type === 'heading'
    ? { type: 'heading', level: clampLevel(b.level), inlines }
    : { type: 'para', inlines };
}

// ─── build context: relationships, media, footnote ids ───────────────────────

interface Ctx {
  /** Relationship XML after rId1 (styles), in the order the ids were handed out. */
  rels: string[];
  nextRel: number;
  hrefRel: Map<string, string>;
  /** media name → its rId, so one image used twice is one part. */
  imageRel: Map<string, string>;
  media: ZipStoreEntry[];
  /** Distinct media extensions, for the [Content_Types] Default entries. */
  exts: Set<string>;
  mediaByName: Map<string, DocxMedia>;
  /** A footnote block's model id → the `w:id` written into footnotes.xml. */
  noteIds: Map<string, number>;
  /** Serial for `wp:docPr`/`pic:cNvPr`, which need a document-unique id. */
  drawings: number;
  needR: boolean;
  needWp: boolean;
  needQuote: boolean;
  needTableHeader: boolean;
  needCode: boolean;
}

function relId(ctx: Ctx): string {
  return `rId${++ctx.nextRel}`;
}

function addRel(ctx: Ctx, type: string, target: string, external: boolean): string {
  const id = relId(ctx);
  ctx.rels.push(
    `<Relationship Id="${id}" Type="${REL}/${type}" Target="${xmlEsc(target)}"` +
      `${external ? ' TargetMode="External"' : ''}/>`,
  );
  return id;
}

// ─── inline runs ─────────────────────────────────────────────────────────────

interface Marks {
  b: boolean;
  i: boolean;
  u: boolean;
  s: boolean;
  code: boolean;
}

const NO_MARKS: Marks = { b: false, i: false, u: false, s: false, code: false };

/**
 * A run's `w:rPr`. `offBold` writes the explicit `<w:b w:val="0"/>` opt-out, which is the only
 * way a plain run inside a bold paragraph style (a heading) can stay plain; Word treats a
 * missing toggle as "inherit", not "off".
 */
function rPrXml(m: Marks, offBold: boolean): string {
  let out = '';
  if (m.b) out += '<w:b/>';
  else if (offBold) out += '<w:b w:val="0"/>';
  if (m.i) out += '<w:i/>';
  if (m.u) out += '<w:u w:val="single"/>';
  if (m.s) out += '<w:strike/>';
  if (m.code) out += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>';
  return out ? `<w:rPr>${out}</w:rPr>` : '';
}

const textRun = (text: string, rPr: string): string =>
  `<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;

/** True when any descendant carries a mark, so a heading knows it mixes styled and plain
 *  runs and must spell the bold opt-out out. */
function hasMark(nodes: DocInline[], depth = 0): boolean {
  if (depth > MAX_INLINE_DEPTH) return false;
  for (const n of nodes) {
    switch (n.type) {
      case 'strong':
      case 'em':
      case 'underline':
      case 'strike':
        return true;
      case 'code':
        return true;
      case 'link':
        if (hasMark(n.inlines, depth + 1)) return true;
        break;
      default:
        break;
    }
  }
  return false;
}

/**
 * Emit paragraph-level inline content: `w:r` runs, and `w:hyperlink` wrappers around the runs
 * of a link. A hyperlink is a paragraph-level element in WordprocessingML, so a nested link
 * flattens into its parent rather than nesting an invalid second `w:hyperlink`.
 */
function inlinesXml(
  nodes: DocInline[],
  ctx: Ctx,
  m: Marks,
  offBold: boolean,
  inLink: boolean,
  depth: number,
): string {
  if (depth > MAX_INLINE_DEPTH) return '';
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        out += textRun(n.text ?? '', rPrXml(m, offBold));
        break;
      case 'code':
        out += textRun(n.text ?? '', rPrXml({ ...m, code: true }, offBold));
        break;
      case 'br':
        out += `<w:r>${rPrXml(m, offBold)}<w:br/></w:r>`;
        break;
      case 'strong':
        out += inlinesXml(n.inlines, ctx, { ...m, b: true }, offBold, inLink, depth + 1);
        break;
      case 'em':
        out += inlinesXml(n.inlines, ctx, { ...m, i: true }, offBold, inLink, depth + 1);
        break;
      case 'underline':
        out += inlinesXml(n.inlines, ctx, { ...m, u: true }, offBold, inLink, depth + 1);
        break;
      case 'strike':
        out += inlinesXml(n.inlines, ctx, { ...m, s: true }, offBold, inLink, depth + 1);
        break;
      case 'footnoteRef': {
        const id = ctx.noteIds.get(String(n.id));
        // A reference to a footnote body no document block declares would point at nothing.
        if (id != null) out += `<w:r>${rPrXml(m, offBold)}<w:footnoteReference w:id="${id}"/></w:r>`;
        break;
      }
      case 'link': {
        const inner = inlinesXml(n.inlines, ctx, m, offBold, true, depth + 1);
        if (!inner) break;
        const href = typeof n.href === 'string' ? n.href : '';
        if (inLink || !href) {
          out += inner;
          break;
        }
        ctx.needR = true;
        if (href.startsWith('#')) {
          // An in-document target is an anchor attribute, not a relationship.
          out += `<w:hyperlink w:anchor="${xmlEsc(href.slice(1))}">${inner}</w:hyperlink>`;
        } else {
          let id = ctx.hrefRel.get(href);
          if (!id) {
            id = addRel(ctx, 'hyperlink', href, true);
            ctx.hrefRel.set(href, id);
          }
          out += `<w:hyperlink r:id="${id}">${inner}</w:hyperlink>`;
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

const paraXml = (pPrInner: string, runs: string): string =>
  `<w:p>${pPrInner ? `<w:pPr>${pPrInner}</w:pPr>` : ''}${runs}</w:p>`;

// ─── images ──────────────────────────────────────────────────────────────────

// 96dpi is the px basis Word assumes for a pasted bitmap; 914400 EMU per inch / 96 = 9525.
const EMU_PER_PX = 9525;
// The printable width of the fixed page geometry below: 8.5in less two 1in margins.
const MAX_IMAGE_EMU = 6.5 * 914400;
// Used when the bytes carry no size this module can read (SVG, WebP, a truncated file).
const FALLBACK_PX = { w: 480, h: 360 };

/** Natural pixel size from the bytes of a PNG, GIF or JPEG, or null for anything else. */
function imagePx(bytes: Uint8Array | undefined): { w: number; h: number } | null {
  if (!bytes || bytes.length < 16) return null;
  const be32 = (o: number): number =>
    ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
  const ok = (w: number, h: number): { w: number; h: number } | null =>
    w > 0 && h > 0 && w < 1e6 && h < 1e6 ? { w, h } : null;

  // PNG: IHDR is required to be the first chunk, so width/height sit at a fixed offset.
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return ok(be32(16), be32(20));
  }
  // GIF: the logical screen descriptor, little-endian.
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return ok(bytes[6]! | (bytes[7]! << 8), bytes[8]! | (bytes[9]! << 8));
  }
  // JPEG: walk the marker chain to the first frame header (SOFn) and read its size.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o + 9 < bytes.length) {
      if (bytes[o] !== 0xff) {
        o++;
        continue;
      }
      const marker = bytes[o + 1]!;
      // Padding, and the standalone markers that carry no length field.
      if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        o += 2;
        continue;
      }
      const len = (bytes[o + 2]! << 8) | bytes[o + 3]!;
      if (len < 2) return null;
      // c4 (DHT), c8 (JPG) and cc (DAC) share the SOF range but are not frame headers.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return ok((bytes[o + 7]! << 8) | bytes[o + 8]!, (bytes[o + 5]! << 8) | bytes[o + 6]!);
      }
      o += 2 + len;
    }
  }
  return null;
}

const extOf = (name: string): string => {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return m?.[1] ? m[1].toLowerCase() : 'png';
};

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
};

/** One `w:p` holding an inline picture, or '' when no bytes back the block's `ref`. */
function imageXml(ref: string, alt: string, ctx: Ctx): string {
  const entry = ctx.mediaByName.get(ref);
  if (!entry) return '';
  let rid = ctx.imageRel.get(ref);
  if (!rid) {
    const ext = extOf(ref);
    const path = `media/image${ctx.media.length + 1}.${ext}`;
    ctx.media.push({ name: `word/${path}`, bytes: entry.bytes });
    ctx.exts.add(ext);
    rid = addRel(ctx, 'image', path, false);
    ctx.imageRel.set(ref, rid);
  }
  ctx.needR = true;
  ctx.needWp = true;

  const nat = imagePx(entry.bytes) ?? FALLBACK_PX;
  const w = Number.isFinite(entry.width) && (entry.width as number) > 0 ? (entry.width as number) : nat.w;
  const h = Number.isFinite(entry.height) && (entry.height as number) > 0 ? (entry.height as number) : nat.h;
  // Natural size, scaled down (never up) so the picture fits the printable width.
  const scale = Math.min(1, MAX_IMAGE_EMU / (w * EMU_PER_PX));
  const cx = Math.max(1, Math.round(w * EMU_PER_PX * scale));
  const cy = Math.max(1, Math.round(h * EMU_PER_PX * scale));

  const id = ++ctx.drawings;
  const name = `Picture ${id}`;
  const descr = xmlEsc(alt ?? '');
  return (
    `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${id}" name="${name}" descr="${descr}"/>` +
    `<a:graphic xmlns:a="${A_NS}"><a:graphicData uri="${PIC_NS}">` +
    `<pic:pic xmlns:pic="${PIC_NS}">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr="${descr}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
}

// ─── tables ──────────────────────────────────────────────────────────────────

const TBL_BORDERS =
  '<w:tblBorders>' +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
    .join('') +
  '</w:tblBorders>';

/** The printable width in twips: the page geometry below, less its margins. */
const CONTENT_TWIPS = 12240 - 1440 - 1440;

interface PendingMerge {
  span: number;
  left: number;
}

/**
 * One `w:tbl`. The model's rows are RAGGED where a cell above spans down: a row simply omits
 * the covered columns. Word needs the covered cell present, so this walks a column cursor per
 * row and inserts a `w:vMerge` continuation cell wherever a merge from an earlier row is still
 * open, which is exactly the shape `docx-read.ts` collapses back into `rowspan`.
 */
function tableXml(
  header: DocTableCell[] | undefined,
  rows: DocTableCell[][],
  ctx: Ctx,
): string {
  const all = header ? [header, ...rows] : rows;
  if (!all.length) return '';
  if (header) ctx.needTableHeader = true;

  const pending = new Map<number, PendingMerge>();
  let cols = 0;
  let body = '';

  for (let r = 0; r < all.length; r++) {
    const row = all[r] ?? [];
    let col = 0;
    let cells = '';
    const emitContinuations = (): void => {
      let open = pending.get(col);
      while (open && open.left > 0) {
        open.left--;
        cells +=
          `<w:tc><w:tcPr>${open.span > 1 ? `<w:gridSpan w:val="${open.span}"/>` : ''}` +
          `<w:vMerge/></w:tcPr><w:p/></w:tc>`;
        col += open.span;
        open = pending.get(col);
      }
    };

    for (const cell of row) {
      emitContinuations();
      const span = clampSpan(cell.colspan);
      const rowspan = clampSpan(cell.rowspan);
      const runs = inlinesXml(cell.inlines ?? [], ctx, NO_MARKS, false, false, 0);
      const pPr = header && r === 0 ? '<w:pStyle w:val="TableHeader"/>' : '';
      const tcPr =
        (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '') +
        (rowspan > 1 ? '<w:vMerge w:val="restart"/>' : '');
      cells += `<w:tc>${tcPr ? `<w:tcPr>${tcPr}</w:tcPr>` : ''}${runs || pPr ? paraXml(pPr, runs) : '<w:p/>'}</w:tc>`;
      if (rowspan > 1) pending.set(col, { span, left: rowspan - 1 });
      else pending.delete(col);
      col += span;
    }
    emitContinuations();
    if (col > cols) cols = col;
    // A row Word can lay out needs at least one cell.
    if (!cells) cells = '<w:tc><w:p/></w:tc>';
    const trPr = header && r === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
    body += `<w:tr>${trPr}${cells}</w:tr>`;
  }

  if (cols < 1) cols = 1;
  const colW = Math.max(1, Math.floor(CONTENT_TWIPS / cols));
  const grid = `<w:tblGrid>${`<w:gridCol w:w="${colW}"/>`.repeat(cols)}</w:tblGrid>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${TBL_BORDERS}</w:tblPr>${grid}${body}</w:tbl>`
  );
}

// ─── body ────────────────────────────────────────────────────────────────────

// Body page geometry: US-Letter (12240x15840 twips) with 1" margins. A body with no trailing
// w:sectPr is technically parseable, but every real producer emits one, and leaving it out
// trips Word's layout heuristics. Keep it fixed so output is deterministic.
const SECT_PR =
  '<w:sectPr>' +
  '<w:pgSz w:w="12240" w:h="15840"/>' +
  '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
  '</w:sectPr>';

// numId 1 is the bullet list, numId 2 the decimal one (see numberingXml below).
const BULLET_NUM_ID = 1;
const DECIMAL_NUM_ID = 2;
const MAX_ILVL = 8; // Word defines nine outline levels (0..8)

function blockXml(block: DocBlock, ctx: Ctx): string {
  switch (block.type) {
    case 'heading': {
      const level = clampLevel(block.level);
      // The Heading styles below are bold, so a plain run in a heading that also holds a
      // styled one needs the explicit opt-out to render plain.
      const offBold = hasMark(block.inlines ?? []);
      return paraXml(
        `<w:pStyle w:val="Heading${level}"/>`,
        inlinesXml(block.inlines ?? [], ctx, NO_MARKS, offBold, false, 0),
      );
    }
    case 'para':
      return paraXml('', inlinesXml(block.inlines ?? [], ctx, NO_MARKS, false, false, 0));
    case 'quote':
      ctx.needQuote = true;
      return paraXml(
        '<w:pStyle w:val="Quote"/>',
        inlinesXml(block.inlines ?? [], ctx, NO_MARKS, false, false, 0),
      );
    case 'code': {
      ctx.needCode = true;
      // WordprocessingML has no code block: one styled paragraph per line is the closest
      // editable equivalent, and `lang` has nowhere to go.
      const lines = String(block.text ?? '').split('\n');
      return lines
        .map((line) => paraXml('<w:pStyle w:val="Code"/>', textRun(line, '')))
        .join('');
    }
    case 'list': {
      const numId = block.ordered ? DECIMAL_NUM_ID : BULLET_NUM_ID;
      return (block.items ?? [])
        .map((item) => {
          const ilvl = Math.max(0, Math.min(MAX_ILVL, Math.trunc(item.level) || 0));
          return paraXml(
            `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`,
            inlinesXml(item.inlines ?? [], ctx, NO_MARKS, false, false, 0),
          );
        })
        .join('');
    }
    case 'table':
      return tableXml(block.header, block.rows ?? [], ctx);
    case 'image':
      return imageXml(String(block.ref ?? ''), String(block.alt ?? ''), ctx);
    case 'footnote':
      // Bodies live in footnotes.xml, not in the flow.
      return '';
    default:
      return '';
  }
}

function documentXml(blocks: DocBlock[], ctx: Ctx): string {
  let paras = '';
  for (const b of blocks) paras += blockXml(b, ctx);
  // An empty body is invalid (Word repairs a bodyless document), so a document with no
  // flow content still emits one empty paragraph before the sectPr.
  if (!paras) paras = '<w:p/>';
  const ns =
    `xmlns:w="${W_NS}"` + (ctx.needR ? ` xmlns:r="${REL}"` : '') + (ctx.needWp ? ` xmlns:wp="${WP_NS}"` : '');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document ${ns}><w:body>${paras}${SECT_PR}</w:body></w:document>`
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

// Heading point sizes (half-points, so 32 = 16pt down to 20 = 10pt at Heading6), each
// bold. Enough that a pStyle reference resolves to a visibly distinct style.
const HEADING_HALF_PT = [32, 28, 26, 24, 22, 20];

function stylesXml(ctx: Ctx): string {
  // docDefaults + Normal give every paragraph a resolved base; each Heading1..6 is a paragraph
  // style based on Normal, so a run inherits the base font and only overrides size/weight.
  let styles =
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>`;
  for (let i = 0; i < HEADING_HALF_PT.length; i++) {
    const lvl = i + 1;
    const sz = HEADING_HALF_PT[i]!;
    styles +=
      `<w:style w:type="paragraph" w:styleId="Heading${lvl}">` +
      `<w:name w:val="heading ${lvl}"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/>` +
      `<w:pPr><w:keepNext/><w:outlineLvl w:val="${i}"/></w:pPr>` +
      `<w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>` +
      `</w:style>`;
  }
  if (ctx.needQuote) {
    styles +=
      `<w:style w:type="paragraph" w:styleId="Quote">` +
      `<w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="29"/>` +
      `<w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>`;
  }
  if (ctx.needTableHeader) {
    // Header emphasis is a STYLE, not a run toggle: docx-read.ts reads run-level bold as a
    // `strong` inline, so bolding the runs would put emphasis into the round-tripped content.
    styles +=
      `<w:style w:type="paragraph" w:styleId="TableHeader">` +
      `<w:name w:val="Table Header"/><w:basedOn w:val="Normal"/>` +
      `<w:rPr><w:b/></w:rPr></w:style>`;
  }
  if (ctx.needCode) {
    styles +=
      `<w:style w:type="paragraph" w:styleId="Code">` +
      `<w:name w:val="HTML Preformatted"/><w:basedOn w:val="Normal"/>` +
      `<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/></w:rPr></w:style>`;
  }
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:styles xmlns:w="${W_NS}">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>` +
    styles +
    `</w:styles>`
  );
}

// ─── numbering ───────────────────────────────────────────────────────────────

// Cycled per depth so nested bullets stay visually distinct without a font reference
// (a Symbol-font bullet renders as a letter wherever that font is missing).
const BULLET_GLYPHS = ['•', '◦', '▪'];

function abstractNum(id: number, ordered: boolean): string {
  let lvls = '';
  for (let i = 0; i <= MAX_ILVL; i++) {
    const text = ordered ? `%${i + 1}.` : BULLET_GLYPHS[i % BULLET_GLYPHS.length]!;
    lvls +=
      `<w:lvl w:ilvl="${i}"><w:start w:val="1"/>` +
      `<w:numFmt w:val="${ordered ? 'decimal' : 'bullet'}"/>` +
      `<w:lvlText w:val="${xmlEsc(text)}"/><w:lvlJc w:val="left"/>` +
      `<w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  }
  return (
    `<w:abstractNum w:abstractNumId="${id}">` +
    `<w:multiLevelType w:val="${ordered ? 'multilevel' : 'hybridMultilevel'}"/>` +
    lvls +
    `</w:abstractNum>`
  );
}

const NUMBERING_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<w:numbering xmlns:w="${W_NS}">` +
  abstractNum(0, false) +
  abstractNum(1, true) +
  `<w:num w:numId="${BULLET_NUM_ID}"><w:abstractNumId w:val="0"/></w:num>` +
  `<w:num w:numId="${DECIMAL_NUM_ID}"><w:abstractNumId w:val="1"/></w:num>` +
  `</w:numbering>`;

// ─── footnotes ───────────────────────────────────────────────────────────────

/** Word expects the two separator pseudo-notes alongside the real bodies; ids -1 and 0 are
 *  reserved for them, so content notes number from 1. */
function footnotesXml(notes: Array<{ id: number; runs: string }>): string {
  const furniture =
    `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
    `<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>`;
  const bodies = notes
    .map((n) => `<w:footnote w:id="${n.id}"><w:p><w:r><w:footnoteRef/></w:r>${n.runs}</w:p></w:footnote>`)
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:footnotes xmlns:w="${W_NS}">${furniture}${bodies}</w:footnotes>`
  );
}

// ─── package parts ───────────────────────────────────────────────────────────

function contentTypesXml(exts: Set<string>, numbering: boolean, footnotes: boolean): string {
  let defaults = '';
  for (const ext of [...exts].sort()) {
    defaults += `<Default Extension="${ext}" ContentType="${MEDIA_TYPES[ext] ?? 'application/octet-stream'}"/>`;
  }
  const wml = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  let overrides = '';
  if (numbering) overrides += `<Override PartName="/word/numbering.xml" ContentType="${wml}.numbering+xml"/>`;
  if (footnotes) overrides += `<Override PartName="/word/footnotes.xml" ContentType="${wml}.footnotes+xml"/>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="${CT_NS}">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    defaults +
    `<Override PartName="/word/document.xml" ContentType="${wml}.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="${wml}.styles+xml"/>` +
    overrides +
    `</Types>`
  );
}

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const documentRels = (extra: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
  extra.join('') +
  `</Relationships>`;

/**
 * Build a valid WordprocessingML .docx (as ZIP bytes) from a document block model.
 *
 * The text stays real and editable: blocks become `w:p`/`w:tbl`, headings reference a
 * "Heading1".."Heading6" `pStyle` defined in `word/styles.xml`, inline marks become run
 * toggles, links become `w:hyperlink`, lists reference the two `word/numbering.xml`
 * definitions, and images become inline `w:drawing` picture parts. Opens in Word,
 * LibreOffice Writer and Google Docs.
 *
 * `blocks` accepts the original `{ type, level?, text }` shape, doc-model's richer
 * {@link DocBlock}, or a mix. A document made only of the original shape emits exactly the
 * five parts it always did, byte for byte.
 *
 * @param doc  `{ title?, blocks, media? }`. An empty `blocks` still yields a valid
 *             one-paragraph doc. `media` supplies the bytes an `image` block's `ref` names.
 * @returns the finished .docx archive bytes.
 */
export function writeDocx(doc: DocxDoc): Uint8Array {
  const raw = Array.isArray(doc?.blocks) ? doc.blocks : [];
  const blocks = raw.filter((b) => b && typeof b === 'object').map(normaliseBlock);

  const ctx: Ctx = {
    rels: [],
    nextRel: 1, // rId1 is styles.xml
    hrefRel: new Map(),
    imageRel: new Map(),
    media: [],
    exts: new Set(),
    mediaByName: new Map(),
    noteIds: new Map(),
    drawings: 0,
    needR: false,
    needWp: false,
    needQuote: false,
    needTableHeader: false,
    needCode: false,
  };
  for (const m of Array.isArray(doc?.media) ? doc.media : []) {
    if (m && typeof m.name === 'string' && m.bytes instanceof Uint8Array) ctx.mediaByName.set(m.name, m);
  }

  const noteBlocks = blocks.filter((b): b is Extract<DocBlock, { type: 'footnote' }> => b.type === 'footnote');
  const hasLists = blocks.some((b) => b.type === 'list');
  // Relationship order is fixed so output is deterministic: styles, then numbering and
  // footnotes, then hyperlinks and images in the order the body reaches them.
  if (hasLists) addRel(ctx, 'numbering', 'numbering.xml', false);
  if (noteBlocks.length) addRel(ctx, 'footnotes', 'footnotes.xml', false);
  noteBlocks.forEach((b, i) => ctx.noteIds.set(String(b.id), i + 1));

  const document = documentXml(blocks, ctx);
  // `inLink` is forced on for a note body: a hyperlink there would resolve through
  // word/_rels/footnotes.xml.rels, a second rels part this writer does not emit, so the link
  // flattens to its own text rather than pointing at a relationship Word cannot find.
  const notes = noteBlocks.map((b, i) => ({
    id: i + 1,
    runs: inlinesXml(b.inlines ?? [], ctx, NO_MARKS, false, true, 0),
  }));

  const str = (s: string): Uint8Array => encoder.encode(s);
  const entries: ZipStoreEntry[] = [
    { name: '[Content_Types].xml', bytes: str(contentTypesXml(ctx.exts, hasLists, notes.length > 0)) },
    { name: '_rels/.rels', bytes: str(ROOT_RELS) },
    { name: 'word/document.xml', bytes: str(document) },
    { name: 'word/styles.xml', bytes: str(stylesXml(ctx)) },
    { name: 'word/_rels/document.xml.rels', bytes: str(documentRels(ctx.rels)) },
  ];
  if (hasLists) entries.push({ name: 'word/numbering.xml', bytes: str(NUMBERING_XML) });
  if (notes.length) entries.push({ name: 'word/footnotes.xml', bytes: str(footnotesXml(notes)) });
  for (const m of ctx.media) entries.push(m);
  return storeZip(entries);
}
