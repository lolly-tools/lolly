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
 *     (page geometry) is required for Word to treat the document as laid out: the
 *     caller's `page` (size and margins in twips), else US Letter with 1" margins.
 *   - `word/styles.xml` - defines Normal (the document default) + Heading1..6, so a
 *     `pStyle` reference resolves to a visible style (bold, graded sizes) instead of a
 *     dangling id. Quote / TableHeader / Code are appended only when a block needs them.
 *     The caller's `styles` name the body face and text colour in the docDefaults and the
 *     heading face and colour in Heading1..6; absent, no face or colour is named.
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
 *     per distinct extension. An SVG that comes with a PNG of the same artwork is two
 *     parts, the PNG as the blip and the SVG through the `asvg:svgBlip` extension, the
 *     way Word itself writes one.
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
 * as ordinary text. Colour, alignment, fonts and sizes are not in the block model at all:
 * the document's faces and text colours travel as STYLES (`DocxDoc.styles`, written into
 * the docDefaults and the Heading styles), never as per-run overrides, so a reader who
 * restyles Normal or Heading 1 restyles the whole document.
 * A link inside a footnote body flattens to its text, because a note's relationships live in
 * a second rels part (word/_rels/footnotes.xml.rels) this writer does not emit.
 * Returns the finished zip bytes via the shared `storeZip`. No DOM, no deps beyond the
 * named engine primitives.
 */

import type { DocBlock, DocInline, DocTableCell } from './doc-model.ts';
import { storeZip, type ZipStoreEntry } from './zip.ts';
import { corePropsXml, type OoxmlCoreMeta } from './ooxml-props.ts';

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
  /**
   * For an SVG picture: PNG bytes of the same artwork. The picture is then written the
   * way Word writes one, with the PNG as the blip and the SVG next to that, through the
   * `asvg:svgBlip` extension, so a reader with no SVG support (Google Docs, older Word)
   * shows the PNG and a current one draws the vector. Ignored for any other picture.
   */
  fallback?: Uint8Array;
}

/**
 * The page a document is laid out on, in twips (1440 to the inch). Absent, the page is
 * US Letter with one-inch margins, as before this field existed. `snapDocxPage` turns a
 * measured size into a standard paper size when it is one.
 */
export interface DocxPage {
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
}

/**
 * The document's faces and text colours, written as styles: `bodyFont` and `textColor`
 * into the document defaults (so Normal, lists and tables inherit them), `headingFont`
 * and `headingColor` into Heading 1 to 6. A face is a family name; a colour is `#rrggbb`.
 * Each field is optional, and an absent one writes nothing, so the reader's default
 * applies there.
 */
export interface DocxStyles {
  bodyFont?: string;
  headingFont?: string;
  textColor?: string;
  headingColor?: string;
}

/** The document model `writeDocx` serializes. `title` names the document (dc:title in
 *  docProps/core.xml, unless `meta.title` overrides it).
 *  `blocks` accepts either block shape, mixed: a {@link DocxBlock} is normalised to the
 *  equivalent {@link DocBlock} before anything is emitted. */
export interface DocxDoc {
  title?: string;
  blocks: Array<DocxBlock | DocBlock>;
  /** Bytes for the `image` blocks. An image whose `ref` names no entry here is skipped. */
  media?: DocxMedia[];
  /** docProps/core.xml fields (plans/144 Wave 2 G3) - the same shape pptx writes,
   *  via the shared ooxml-props.ts writer. Absent → 'Lolly' authorship defaults. */
  meta?: OoxmlCoreMeta | null;
  /** dcterms:created/modified timestamp. Defaults to a fixed epoch so output
   *  stays deterministic unless the caller passes a wall clock (pptx precedent). */
  now?: string;
  /** Page size and margins. Absent: US Letter, one-inch margins. */
  page?: DocxPage;
  /** Faces and text colours, as styles. Absent: none named, the reader's defaults apply. */
  styles?: DocxStyles;
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
  /** media name → the rId of its SVG part, for a picture written as a PNG plus its SVG. */
  svgRel: Map<string, string>;
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
  /** The printable width of the page in twips: the page less its left and right margins. */
  contentTwips: number;
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
// 914400 EMU per inch / 1440 twips per inch.
const EMU_PER_TWIP = 635;
// The fixed GUID that marks a blip's SVG companion, as Word and PowerPoint write it (pptx.ts).
const SVG_EXT_URI = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';
const ASVG_NS = 'http://schemas.microsoft.com/office/drawing/2016/SVG/main';
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

/** True when the bytes are a PNG: the only fallback a picture's SVG is written beside. */
const isPng = (b: Uint8Array | undefined): b is Uint8Array =>
  !!b && b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/** Add one media part and its relationship, returning the relationship id. */
function addMedia(ctx: Ctx, bytes: Uint8Array, ext: string): string {
  const path = `media/image${ctx.media.length + 1}.${ext}`;
  ctx.media.push({ name: `word/${path}`, bytes });
  ctx.exts.add(ext);
  return addRel(ctx, 'image', path, false);
}

/** One `w:p` holding an inline picture, or '' when no bytes back the block's `ref`. */
function imageXml(ref: string, alt: string, ctx: Ctx): string {
  const entry = ctx.mediaByName.get(ref);
  if (!entry) return '';
  // An SVG with a PNG of the same artwork is written the way Word writes one: the PNG is
  // the blip every reader draws, the SVG rides the svgBlip extension for readers that
  // draw vectors. The PNG part comes first, so its id is the lower of the two.
  const svgPair = extOf(ref) === 'svg' && isPng(entry.fallback);
  let rid = ctx.imageRel.get(ref);
  let svgRid = ctx.svgRel.get(ref);
  if (!rid) {
    if (svgPair) {
      rid = addMedia(ctx, entry.fallback!, 'png');
      svgRid = addMedia(ctx, entry.bytes, 'svg');
      ctx.svgRel.set(ref, svgRid);
    } else {
      rid = addMedia(ctx, entry.bytes, extOf(ref));
    }
    ctx.imageRel.set(ref, rid);
  }
  ctx.needR = true;
  ctx.needWp = true;

  // The size comes from the vector when there is one: the PNG is drawn larger than the
  // picture shows, for print, and its pixels are not the picture's size.
  const nat = (svgPair ? null : imagePx(entry.bytes)) ?? (svgPair ? imagePx(entry.fallback) : null) ?? FALLBACK_PX;
  const w = Number.isFinite(entry.width) && (entry.width as number) > 0 ? (entry.width as number) : nat.w;
  const h = Number.isFinite(entry.height) && (entry.height as number) > 0 ? (entry.height as number) : nat.h;
  // Natural size, scaled down (never up) so the picture fits the printable width.
  const scale = Math.min(1, (ctx.contentTwips * EMU_PER_TWIP) / (w * EMU_PER_PX));
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
    `<pic:blipFill>${blipXml(rid, svgRid)}<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
}

/** The blip: the raster alone, or the raster with its SVG through the svgBlip extension. */
function blipXml(rid: string, svgRid: string | undefined): string {
  if (!svgRid) return `<a:blip r:embed="${rid}"/>`;
  return (
    `<a:blip r:embed="${rid}"><a:extLst><a:ext uri="${SVG_EXT_URI}">` +
    `<asvg:svgBlip xmlns:asvg="${ASVG_NS}" r:embed="${svgRid}"/></a:ext></a:extLst></a:blip>`
  );
}

// ─── tables ──────────────────────────────────────────────────────────────────

const TBL_BORDERS =
  '<w:tblBorders>' +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
    .join('') +
  '</w:tblBorders>';

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
  const colW = Math.max(1, Math.floor(ctx.contentTwips / cols));
  const grid = `<w:tblGrid>${`<w:gridCol w:w="${colW}"/>`.repeat(cols)}</w:tblGrid>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${TBL_BORDERS}</w:tblPr>${grid}${body}</w:tbl>`
  );
}

// ─── body ────────────────────────────────────────────────────────────────────

// Body page geometry. A body with no trailing w:sectPr is technically parseable, but every
// real producer emits one, and leaving it out trips Word's layout heuristics. With no
// `page`, the page is US Letter (12240x15840 twips) with 1" margins, as it always was.
const LETTER: Required<DocxPage> = {
  width: 12240, height: 15840, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
};
// Word's own page limits: 0.1in to 22in each way.
const MIN_PAGE_TWIPS = 144;
const MAX_PAGE_TWIPS = 31680;
// The space a margin always leaves for text, so a hostile margin cannot leave none.
const MIN_TEXT_TWIPS = 720;
// Where Word puts a header and a footer when it is given no other place: half an inch in.
const HEADER_TWIPS = 720;

const twips = (n: unknown, lo: number, hi: number, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;

/** The page a document is written on, with every value finite, whole and in Word's range. */
function pageOf(page: DocxPage | undefined): Required<DocxPage> {
  if (!page) return LETTER;
  const width = twips(page.width, MIN_PAGE_TWIPS, MAX_PAGE_TWIPS, LETTER.width);
  const height = twips(page.height, MIN_PAGE_TWIPS, MAX_PAGE_TWIPS, LETTER.height);
  const m = page.margin ?? LETTER.margin;
  // Each pair of margins leaves at least MIN_TEXT_TWIPS (or what the page has) between them.
  const room = (size: number): number => Math.max(0, size - Math.min(MIN_TEXT_TWIPS, size));
  const pair = (a: unknown, b: unknown, size: number): [number, number] => {
    const max = room(size);
    let x = twips(a, 0, max, Math.min(1440, max / 2));
    let y = twips(b, 0, max, Math.min(1440, max / 2));
    if (x + y > max) { const k = max / (x + y); x = Math.floor(x * k); y = Math.floor(y * k); }
    return [x, y];
  };
  const [left, right] = pair(m.left, m.right, width);
  const [top, bottom] = pair(m.top, m.bottom, height);
  return { width, height, margin: { top, right, bottom, left } };
}

function sectPrXml(page: Required<DocxPage>): string {
  const { width, height, margin } = page;
  // A landscape page says so, or Word turns it upright when it prints.
  const orient = width > height ? ' w:orient="landscape"' : '';
  return (
    '<w:sectPr>' +
    `<w:pgSz w:w="${width}" w:h="${height}"${orient}/>` +
    `<w:pgMar w:top="${margin.top}" w:right="${margin.right}" w:bottom="${margin.bottom}" w:left="${margin.left}"` +
    ` w:header="${Math.min(HEADER_TWIPS, margin.top)}" w:footer="${Math.min(HEADER_TWIPS, margin.bottom)}" w:gutter="0"/>` +
    '</w:sectPr>'
  );
}

/** Standard paper sizes in millimetres, portrait. Letter, Legal and Tabloid are exact inches. */
const PAPER_MM: ReadonlyArray<readonly [number, number]> = [
  [210, 297], [148, 210], [105, 148], [297, 420], [420, 594], [176, 250], [250, 353],
  [215.9, 279.4], [215.9, 355.6], [279.4, 431.8], [184.15, 266.7],
];
const TWIPS_PER_MM = 1440 / 25.4;
// A measured page within a millimetre of a paper size is that size: a page laid out in
// whole CSS pixels (794 x 1123 for A4) misses the exact twips by a fraction of one.
const SNAP_MM = 1;

/**
 * The page size a measured page stands for, in twips: the standard paper size within a
 * millimetre of it (A4 is 11906 x 16838, US Letter 12240 x 15840), in the same
 * orientation, else the measurement rounded to whole twips. Word and every other reader
 * name a page by its exact size, so A4 written as 11910 twips reads as a custom size.
 */
export function snapDocxPage(width: number, height: number): { width: number; height: number } {
  const wMm = width / TWIPS_PER_MM;
  const hMm = height / TWIPS_PER_MM;
  for (const [a, b] of PAPER_MM) {
    for (const [pw, ph] of [[a, b], [b, a]] as const) {
      if (Math.abs(wMm - pw) <= SNAP_MM && Math.abs(hMm - ph) <= SNAP_MM) {
        return { width: Math.round(pw * TWIPS_PER_MM), height: Math.round(ph * TWIPS_PER_MM) };
      }
    }
  }
  return { width: Math.round(width), height: Math.round(height) };
}

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

function documentXml(blocks: DocBlock[], ctx: Ctx, page: Required<DocxPage>): string {
  let paras = '';
  for (const b of blocks) paras += blockXml(b, ctx);
  // An empty body is invalid (Word repairs a bodyless document), so a document with no
  // flow content still emits one empty paragraph before the sectPr.
  if (!paras) paras = '<w:p/>';
  const ns =
    `xmlns:w="${W_NS}"` + (ctx.needR ? ` xmlns:r="${REL}"` : '') + (ctx.needWp ? ` xmlns:wp="${WP_NS}"` : '');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document ${ns}><w:body>${paras}${sectPrXml(page)}</w:body></w:document>`
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

// Heading point sizes (half-points, so 32 = 16pt down to 20 = 10pt at Heading6), each
// bold. Enough that a pStyle reference resolves to a visibly distinct style.
const HEADING_HALF_PT = [32, 28, 26, 24, 22, 20];

// A family name a style may carry: a plain name, as brand-vars.ts accepts one, so nothing
// a token document says can reach the XML as anything but a name.
const FAMILY_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;
const familyOf = (v: unknown): string | undefined => {
  const name = typeof v === 'string' ? v.trim() : '';
  return FAMILY_RE.test(name) ? name : undefined;
};
const colourOf = (v: unknown): string | undefined => {
  const m = typeof v === 'string' ? /^#?([0-9a-fA-F]{6})$/.exec(v.trim()) : null;
  return m?.[1] ? m[1].toUpperCase() : undefined;
};

/**
 * The face named in every slot Word reads one from: `ascii` and `hAnsi` for Latin text,
 * `eastAsia` for East Asian text and `cs` for complex scripts. One family in all four, as
 * the pptx writer gives one family to latin, ea and cs.
 */
const rFontsXml = (face: string | undefined): string =>
  face ? `<w:rFonts w:ascii="${face}" w:hAnsi="${face}" w:eastAsia="${face}" w:cs="${face}"/>` : '';
const colorXml = (hex: string | undefined): string => (hex ? `<w:color w:val="${hex}"/>` : '');

function stylesXml(ctx: Ctx, look: DocxStyles | undefined): string {
  const bodyFont = familyOf(look?.bodyFont);
  const headingFont = familyOf(look?.headingFont);
  const textColor = colourOf(look?.textColor);
  const headingColor = colourOf(look?.headingColor);
  // docDefaults + Normal give every paragraph a resolved base; each Heading1..6 is a paragraph
  // style based on Normal, so a run inherits the base font and only overrides size and
  // weight, plus the heading face and colour when the document gives them. The children
  // keep CT_RPr's order: rFonts, b, color, sz.
  let styles =
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>`;
  for (let i = 0; i < HEADING_HALF_PT.length; i++) {
    const lvl = i + 1;
    const sz = HEADING_HALF_PT[i]!;
    styles +=
      `<w:style w:type="paragraph" w:styleId="Heading${lvl}">` +
      `<w:name w:val="heading ${lvl}"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/>` +
      `<w:pPr><w:keepNext/><w:outlineLvl w:val="${i}"/></w:pPr>` +
      `<w:rPr>${rFontsXml(headingFont)}<w:b/>${colorXml(headingColor)}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>` +
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
    `<w:docDefaults><w:rPrDefault><w:rPr>${rFontsXml(bodyFont)}${colorXml(textColor)}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>` +
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
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    overrides +
    `</Types>`
  );
}

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
  // Core props ride the PACKAGE relationship namespace (OPC section 8.3.3.2), not the
  // officeDocument one - Word keys the Properties dialog off this exact type.
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
  `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>` +
  `</Relationships>`;

const APP_PROPS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Lolly</Application></Properties>`;

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
 * {@link DocBlock}, or a mix. Every document also carries docProps/core.xml +
 * app.xml (plans/144 Wave 2 G3), fed from `meta`/`now` with 'Lolly' defaults.
 *
 * @param doc  `{ title?, blocks, media?, page?, styles? }`. An empty `blocks` still yields
 *             a valid one-paragraph doc. `media` supplies the bytes an `image` block's `ref`
 *             names. With no `page` and no `styles`, the output is byte-identical to what
 *             this writer produced before either existed.
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
    svgRel: new Map(),
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
    contentTwips: 0,
  };
  const page = pageOf(doc?.page);
  ctx.contentTwips = Math.max(1, page.width - page.margin.left - page.margin.right);
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

  const document = documentXml(blocks, ctx, page);
  // `inLink` is forced on for a note body: a hyperlink there would resolve through
  // word/_rels/footnotes.xml.rels, a second rels part this writer does not emit, so the link
  // flattens to its own text rather than pointing at a relationship Word cannot find.
  const notes = noteBlocks.map((b, i) => ({
    id: i + 1,
    runs: inlinesXml(b.inlines ?? [], ctx, NO_MARKS, false, true, 0),
  }));

  const str = (s: string): Uint8Array => encoder.encode(s);
  const now = doc.now ?? '2026-01-01T00:00:00Z';
  const coreMeta: OoxmlCoreMeta = { ...doc.meta, title: doc.meta?.title ?? doc.title };
  const entries: ZipStoreEntry[] = [
    { name: '[Content_Types].xml', bytes: str(contentTypesXml(ctx.exts, hasLists, notes.length > 0)) },
    { name: '_rels/.rels', bytes: str(ROOT_RELS) },
    { name: 'docProps/core.xml', bytes: str(corePropsXml(coreMeta, now, 'Document')) },
    { name: 'docProps/app.xml', bytes: str(APP_PROPS) },
    { name: 'word/document.xml', bytes: str(document) },
    { name: 'word/styles.xml', bytes: str(stylesXml(ctx, doc?.styles)) },
    { name: 'word/_rels/document.xml.rels', bytes: str(documentRels(ctx.rels)) },
  ];
  if (hasLists) entries.push({ name: 'word/numbering.xml', bytes: str(NUMBERING_XML) });
  if (notes.length) entries.push({ name: 'word/footnotes.xml', bytes: str(footnotesXml(notes)) });
  for (const m of ctx.media) entries.push(m);
  return storeZip(entries);
}
