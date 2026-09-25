// SPDX-License-Identifier: MPL-2.0
/**
 * Stage 1 of the renovation journey for a PDF (plan 274 section 3.1, the pdf
 * and flattened adapters): the file's bytes in, a `SourceDeckV1` out. Each page
 * is a slide at the 96 dpi reference.
 *
 * The page walk is `../pdf-read.ts`, the same walk the web shell's PDF import
 * uses, so both surfaces read one set of numbers. This adapter reads the
 * interpreter's nodes, not the reconstructed prose (`PageText` drops position
 * and font), and turns them into source objects:
 *
 *   - text runs joined into lines become `text` objects, one paragraph each,
 *     whose runs keep their own size, font and colour (`editable`), with a word
 *     space between two runs where the engine's `pdfWordBreak` finds one (the
 *     rule pdf-text and Unpack use); text shown in an invisible render mode is
 *     carried hidden;
 *   - image XObjects become `pic` objects, their decoded bytes stored once per
 *     distinct content hash through the caller's sink (`raster-preserved`; an
 *     image whose soft mask could not be composited is `approximate`, and one
 *     that could not be decoded is `unavailable` with its reason);
 *   - vector marks clustered by `findVectorArtwork` become `vector` objects
 *     holding their own SVG, drawn from the cluster's nodes alone so a caption
 *     beside a logo is not carried twice (`approximate`, because the SVG is drawn
 *     from the interpreter's model of the paths). The object's box is the SVG's
 *     own frame: the mark with a 2 pt margin, kept inside the page;
 *   - a filled rectangle or ellipse outside every cluster becomes a `shape`
 *     (`editable`), and a lone path outside every cluster its own `vector`;
 *   - the first paint of the page, when it is an opaque rectangle covering the
 *     page, is the slide's ground colour rather than an object.
 *
 * A clipping path that cuts a picture or a shape is read, not ignored. A picture
 * keeps the box it is drawn in and records the part that shows as `clip`; a
 * rectangle cut by a rectangle is the rectangle that shows. A cut that is not a
 * plain rectangle, or a graphics-state soft mask, makes the object `approximate`
 * with a warning naming it. A paint clipped away entirely puts nothing down and
 * is not an object.
 *
 * Content painted inside a marked-content `/Artifact` span with subtype
 * `Header` or `Footer` has `origin: 'pdf-artifact'`, and a footer's text also
 * states `placeholder: 'ftr'`, because the document said so. A page is flattened
 * (plan 274 section 6) when it is a scan in fact: the engine reads it as scanned
 * (no visible text, and an image covering at least half of it) and it paints
 * next to nothing else (at most two other items, over at most 5% of the page).
 * Its largest picture becomes its only object. A searchable scan's invisible
 * text layer becomes that picture's OCR evidence (`text-found`, model
 * `pdf-text-layer`); without one, OCR is `not-run`. The slide states the same
 * reading as `SlideSourceV1.ocr`, which the flattened reconstruction keeps
 * until a recogniser of its own reads a region. A page with a large photo
 * beside vector art (outlined lettering, panels, a logo) is read as an editable
 * page, not flattened.
 *
 * Identity is positional and deterministic: a slide is `page<N>`, and an object
 * is `<slide id>.<z>` where z is its place in paint order. Fingerprints follow
 * the pptx adapter: kind, an 8 px grid over the box (so placement counts) and
 * the object's own material. A vector's material is relative to its own corner,
 * so only the grid carries where it is: the same mark at the same place on two
 * pages has one fingerprint, and moved elsewhere it has another.
 *
 * Every cap is a `SourceWarning`, never a silent drop: pages past `maxPages`,
 * objects past `maxObjectsPerPage`, a page over the content budget (its own
 * streams and every form, glyph procedure and ToUnicode map it decodes), the
 * interpreter's own node ceiling and work budgets, a resource dictionary the
 * bounded walk refused, pictures over the byte or pixel budget, an SVG over the
 * contract's size, inline pictures the interpreter skips, and a fill it could
 * not paint.
 *
 * Reading order is the structure tree's where a tagged document states one for
 * most of the page's text. Otherwise it is geometric: bands of 12 px top to
 * bottom, left to right inside a band, and column by column where the page's
 * text splits at a gutter no line crosses (the engine's own column test in
 * engine/src/pdf-text.ts, with its thresholds).
 *
 * Known limits, stated rather than hidden:
 *
 *   - Page `/Rotate` and the CropBox are not applied; the MediaBox is the slide,
 *     and a slide warning says when either would have changed what shows.
 *   - An artifact span or an invisible render mode inside a form XObject is not
 *     seen (see `markPdfArtifactSpans` and `markPdfInvisibleText`).
 *   - A line is one paragraph. Paragraphs and bullets are not rebuilt.
 *   - Without the web shell's decoders the walk paints an axial or radial
 *     gradient with `pdfShadingOf` and `pdfPatternOf` (`../pdf-read.ts`). A
 *     function-based shading that varies, and a gradient read onto a filled
 *     rectangle, keep one flat colour with a warning naming the object; a
 *     constant one is its colour, exactly. A fill that needs the web's
 *     PostScript calculator, a Separation or DeviceN tint, or more function
 *     work than the walk allows is not painted, and a page warning counts each
 *     paint of it (a shading only listed in the resources counts nothing).
 *
 * DOM-free and browser-safe, like the pptx adapter: pdf-lib parses, the image
 * codec is injected (the pure `NODE_PDF_IMAGE_CODEC` by default), and hashing
 * goes through the engine's Web Crypto `sha256Hex`.
 */

import { PDFArray, PDFHexString, PDFString } from 'pdf-lib';
import type { PDFDocument, PDFRawStream } from 'pdf-lib';
import { sha256Hex, bytesToHex } from '../../../../engine/src/bytes.ts';
import { PDF_MAP_MAX_PAGE_NODES, type PdfNode } from '../../../../engine/src/pdf-map.ts';
import { pdfNodesToSvg, windowPdfSvg, pdfNodeExtent, type PdfExtent } from '../../../../engine/src/pdf-svg.ts';
import { findVectorArtwork } from '../../../../engine/src/pdf-artwork.ts';
import type {
  BoxV1,
  FidelityReasonV1,
  FidelityV1,
  OcrEvidenceV1,
  SlideSourceV1,
  SourceColorV1,
  SourceDeckV1,
  SourceObjectKindV1,
  SourceObjectV1,
  SourceRunV1,
  SourceWarningV1,
} from '@lolly-tools/core';
import { REBRAND_REFERENCE_DPI } from '@lolly-tools/core';
import type { SlideOcrV1 } from '@lolly-tools/core/rebrand-v1';
import type { MediaSinkV1 } from './source-pptx.ts';
import {
  loadPdfDocument,
  interpretPdfDocPage,
  makePdfWalk,
  decodePdfImage,
  describePdfImageIssue,
  pdfTextLines,
  pdfLineRunTexts,
  pdfPageScanned,
  readPdfStructOrder,
  NODE_PDF_IMAGE_CODEC,
  PdfPageTooLargeError,
  PDF_READ_RESOURCE_BUDGET,
  PDF_VECTOR_PAD,
  type PdfArtifactKind,
  type PdfImageCodec,
  type PdfImageDesc,
  type PdfImageIssue,
  type PdfInterpretedPage,
  type PdfResourceDecoders,
  type PdfTextLine,
} from '../pdf-read.ts';

/** Reference px per PDF point: 96 dpi over 72 points an inch. */
const PX_PER_PT = REBRAND_REFERENCE_DPI / 72;

/** The limits a read honours. Each one reached is reported as a warning. */
export interface SourcePdfCapsV1 {
  /** Pages read; the rest are counted in a `slides-truncated` warning. Default 400. */
  maxPages?: number;
  /** Objects kept per page, in paint order. Default 2000. */
  maxObjectsPerPage?: number;
  /** A picture's stored or decoded size past which it is not stored. Default 64 MiB. */
  maxMediaBytes?: number;
  /** A picture's pixel count past which it is not decoded. Default 40 million. */
  maxImagePixels?: number;
  /**
   * A page's decoded content past which the page is not read: its own streams
   * plus every form, Type3 glyph procedure and ToUnicode map the walk decodes.
   * Default 16 MiB of characters.
   */
  maxContentChars?: number;
}

export const SOURCE_PDF_DEFAULT_CAPS: Required<SourcePdfCapsV1> = {
  maxPages: 400,
  maxObjectsPerPage: 2000,
  maxMediaBytes: 64 * 1024 * 1024,
  maxImagePixels: 40_000_000,
  maxContentChars: 16 * 1024 * 1024,
};

/** The contract's ceiling on one object's SVG text. */
const MAX_VECTOR_CHARS = 4 * 1024 * 1024;

/** A flattened page paints at most this many items besides its picture and ground... */
const FLATTEN_MAX_OTHERS = 2;
/** ...over at most this fraction of the page. */
const FLATTEN_MAX_OTHER_AREA = 0.05;
/**
 * A paint whose centre lies within this share of the page from an edge is template
 * furniture (a footer bar, a corner logo, a page number), which a picture of a slide
 * placed on a template page carries around it. Plan 275 WP2: the Self Assessment
 * Explainer's page 7 is one picture of a slide over 93% of the page with four footer
 * bars, a logo and its page number round it, and the cover test that counted those
 * six paints, and read the page number as the page's own text, missed it.
 */
const FLATTEN_EDGE_BAND = 0.1;
/** The contract's ceiling on OCR lines for one object. */
const MAX_OCR_LINES = 4096;

export interface SourcePdfOptsV1 {
  /** `sha256:<hex>` of the source bytes. The caller hashes the file it read. */
  hash: string;
  /** Separates two imports of the same bytes. */
  instanceId: string;
  /** The file name the person chose, when there is one. */
  name?: string;
  /** Size of the source file in bytes, when the caller knows it. */
  bytes?: number;
  /** Where pictures go: called at most once per distinct byte sequence. */
  sink: MediaSinkV1;
  /** Parser identity, recorded for replay. */
  reader: { name: string; version: string };
  /** The same as `caps.maxMediaBytes`, for parity with `sourceDeckFromPptx`. */
  maxMediaBytes?: number;
  caps?: SourcePdfCapsV1;
  /** Called with `done` 0 once the page count is known, and again after each page. */
  onSlide?: (done: number, total: number) => void;
  /** Checked between pages. An aborted signal stops the read with the signal's own reason. */
  signal?: AbortSignal;
  /** Pixel work. Defaults to the pure codec, which decodes no JPEG. */
  codec?: PdfImageCodec;
  /** Shading, pattern and soft-mask decoders a shell can add to the walk. */
  decoders?: PdfResourceDecoders;
}

// ─── small helpers ───────────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;
const px = (pt: number): number => round2((Number.isFinite(pt) ? pt : 0) * PX_PER_PT);
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

function boxOf(x: number, y: number, w: number, h: number, rot = 0): BoxV1 {
  return { x: px(x), y: px(y), w: px(w), h: px(h), rot: Math.abs(rot) < 0.5 ? 0 : round2(rot) };
}

/** A colour as the interpreter reported it, when it is a hex; opacity 0..100 becomes alpha. */
function colorOf(value: string | undefined, opacity?: number): SourceColorV1 | undefined {
  const s = String(value ?? '').trim();
  let hex: string | undefined;
  let alpha: number | undefined;
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  if (short) hex = `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  else if (/^#[0-9a-fA-F]{6}$/.test(s)) hex = s;
  else if (/^#[0-9a-fA-F]{8}$/.test(s)) { hex = s.slice(0, 7); alpha = parseInt(s.slice(7), 16) / 255; }
  if (!hex) return undefined;
  const out: SourceColorV1 = { hex: hex.toLowerCase() };
  const a = (alpha ?? 1) * (typeof opacity === 'number' ? Math.max(0, Math.min(100, opacity)) / 100 : 1);
  if (a < 1) out.alpha = round2(a);
  return out;
}

/**
 * The pptx adapter's fingerprint: kind, an 8 px grid over the box and the
 * material. The grid covers x and y as well as w and h, so placement counts.
 * Identity is the id, never this.
 */
async function fingerprintOf(kind: SourceObjectKindV1, box: BoxV1, content: string): Promise<string> {
  const grid = (n: number): number => Math.round(n / 8) * 8;
  const material = `${kind}|${grid(box.x)},${grid(box.y)},${grid(box.w)},${grid(box.h)}|${content}`;
  return `${kind}:${(await sha256Hex(new TextEncoder().encode(material))).slice(0, 16)}`;
}

/**
 * A vector node's own material with its coordinates made relative to an origin,
 * so the material says what the mark is and not where it is. Where it is enters
 * the fingerprint once, through the geometry grid.
 */
function vectorMaterial(members: PdfNode[], ox: number, oy: number): string {
  const r1 = (n: number): string => String(Math.round(n * 10) / 10);
  const relPath = (d: string): string => {
    let k = 0;
    return d.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (num) => {
      const v = Number(num) - (k++ % 2 === 0 ? ox : oy);
      return r1(v);
    });
  };
  return members.map((m) => [
    m.kind, m.shape ?? '', m.fill ?? '', m._vectorFill ?? '',
    m._vectorStroke ? `${m._vectorStroke.color}/${m._vectorStroke.width}` : '',
    m._vectorPath ? relPath(m._vectorPath) : `${r1(m.x - ox)},${r1(m.y - oy)},${r1(m.w)},${r1(m.h)}`,
  ].join(',')).join(';');
}

function isRaster(n: PdfNode): boolean {
  return n.kind === 'image' && !!n._imageXObject && !n._vectorPath;
}

/**
 * A filled primitive the interpreter modelled as a box (`re f`, an ellipse). A
 * box at zero opacity paints nothing (an office exporter's empty text frame is
 * one), so it is not an object and nothing is lost by leaving it out.
 */
function isShapeBox(n: PdfNode): boolean {
  const fill = colorOf(n.fill, n.opacity);
  return n.kind === 'box' && !!fill && (fill.alpha ?? 1) > 0;
}

/** A path that puts ink down: a visible fill or a stroke, at some opacity. */
function isVectorPath(n: PdfNode): boolean {
  if (!n._vectorPath || (n.opacity ?? 100) <= 0) return false;
  const fill = n._vectorFill && n._vectorFill !== 'none';
  return !!(fill || n._vectorStroke || n._gradient);
}

// ─── clipping ────────────────────────────────────────────────────────────────

interface ClipBounds extends PdfExtent {
  /** True when the path is one axis-aligned rectangle, so its bounds are its outline. */
  rect: boolean;
  /** The path's points when it is straight lines only (`M`, `L`, `Z`), else empty. */
  points: Array<[number, number]>;
}

const EDGE_EPS = 0.01;

/**
 * The bounds of a clip path the interpreter serialised (absolute `M`, `L`, `C`
 * and `Z`, top-left y-down points), and whether it is a plain rectangle. Null
 * when it cannot be scanned.
 */
function clipBounds(d: string): ClipBounds | null {
  if (!d || d.length > 1_000_000 || /[^MLCZ0-9eE.,+\s-]/.test(d)) return null;
  const nums = [...d.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)].map((m) => Number(m[0]));
  if (nums.length < 2 || nums.length % 2 || nums.some((n) => !Number.isFinite(n))) return null;
  const xs = nums.filter((_, k) => k % 2 === 0);
  const ys = nums.filter((_, k) => k % 2 === 1);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const straight = /^\s*M[^MC]*$/.test(d);
  let rect = straight;
  if (rect) {
    const corners = new Set<string>();
    for (let k = 0; k < xs.length; k++) {
      const onX = Math.abs(xs[k]! - x0) < EDGE_EPS ? 'l' : Math.abs(xs[k]! - x1) < EDGE_EPS ? 'r' : '';
      const onY = Math.abs(ys[k]! - y0) < EDGE_EPS ? 't' : Math.abs(ys[k]! - y1) < EDGE_EPS ? 'b' : '';
      if (!onX || !onY) { rect = false; break; }
      corners.add(onX + onY);
    }
    rect = rect && corners.size === 4;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rect, points: straight ? xs.map((x, k) => [x, ys[k]!]) : [] };
}

/**
 * True when a straight clip traces the node's own turned frame, which is how a
 * writer bounds a turned picture: it cuts nothing. The node's corners are turned
 * about its centre the way the serialiser turns it (clockwise, y down).
 */
function tracesFrame(k: ClipBounds, n: PdfNode): boolean {
  if (k.points.length < 4) return false;
  const rad = ((n.rot ?? 0) * Math.PI) / 180;
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const corners = [[n.x, n.y], [n.x + n.w, n.y], [n.x + n.w, n.y + n.h], [n.x, n.y + n.h]].map(([x, y]) => [
    cx + (x! - cx) * Math.cos(rad) - (y! - cy) * Math.sin(rad),
    cy + (x! - cx) * Math.sin(rad) + (y! - cy) * Math.cos(rad),
  ]);
  const near = (a: number[], b: number[]): boolean => Math.abs(a[0]! - b[0]!) < 0.5 && Math.abs(a[1]! - b[1]!) < 0.5;
  return k.points.every((p) => corners.some((c) => near(p, c))) && corners.every((c) => k.points.some((p) => near(p, c)));
}

interface ClipRead {
  /** The part of the node's box that shows, or null when nothing does. */
  visible: PdfExtent | null;
  /** True when some clip removes part of the node. */
  cut: boolean;
  /** True when every clip that cuts is a plain rectangle and the node is upright. */
  exact: boolean;
}

/**
 * How a node's clip stack cuts what it paints. A clip that holds all of it cuts
 * nothing. A node turned by a quarter turn or a half turn still paints an
 * axis-aligned box, so a rectangle clip cuts it exactly; another turn does not.
 */
function clipRead(n: PdfNode): ClipRead {
  const rot = n.rot ?? 0;
  const quarter = ((Math.round(rot / 90) % 4) + 4) % 4;
  const square = Math.abs(rot - Math.round(rot / 90) * 90) < 0.5;
  let box: PdfExtent = { x: n.x, y: n.y, w: n.w, h: n.h };
  if (square && quarter % 2 === 1) {
    // A quarter turn about the centre swaps the box's width and height.
    box = { x: n.x + (n.w - n.h) / 2, y: n.y + (n.h - n.w) / 2, w: n.h, h: n.w };
  } else if (!square) {
    const rad = (rot * Math.PI) / 180;
    const w = Math.abs(n.w * Math.cos(rad)) + Math.abs(n.h * Math.sin(rad));
    const h = Math.abs(n.w * Math.sin(rad)) + Math.abs(n.h * Math.cos(rad));
    box = { x: n.x + (n.w - w) / 2, y: n.y + (n.h - h) / 2, w, h };
  }
  let cut = false;
  let exact = true;
  const upright = square;
  for (const c of n._clips ?? []) {
    const k = clipBounds(c.d);
    if (!k) { cut = true; exact = false; continue; }
    const holds = k.x <= box.x + EDGE_EPS && k.y <= box.y + EDGE_EPS
      && k.x + k.w >= box.x + box.w - EDGE_EPS && k.y + k.h >= box.y + box.h - EDGE_EPS;
    if ((holds && k.rect) || tracesFrame(k, n)) continue;
    cut = true;
    if (!k.rect || !upright) exact = false;
    const x0 = Math.max(box.x, k.x);
    const y0 = Math.max(box.y, k.y);
    const x1 = Math.min(box.x + box.w, k.x + k.w);
    const y1 = Math.min(box.y + box.h, k.y + k.h);
    if (!(x1 - x0 > 0) || !(y1 - y0 > 0)) return { visible: null, cut: true, exact };
    box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  return { visible: box, cut, exact };
}

// ─── reading order ───────────────────────────────────────────────────────────

/** engine/src/pdf-text.ts: a gutter is this many body sizes wide... */
const GUTTER_SIZES = 1.8;
/** ...each column holds this many lines... */
const MIN_COLUMN_LINES = 4;
/** ...whose median width fills this fraction of the column... */
const MIN_COLUMN_FILL = 0.25;
/** ...and a page splits into no more than this many columns. */
const MAX_COLUMNS = 4;
/** The structure tree is followed when it ranks at least this share of the text objects. */
const MIN_TAGGED_SHARE = 0.6;

const idCmp = (a: SourceObjectV1, b: SourceObjectV1): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Column cuts in px, or none when the page's text does not split believably. */
function columnCuts(texts: SourceObjectV1[]): number[] {
  if (texts.length < MIN_COLUMN_LINES * 2) return [];
  const body = median(texts.map((o) => (o.text?.paras[0]?.runs[0]?.sizePt ?? 12) * PX_PER_PT));
  const spans = texts.map((o) => [o.box.x, o.box.x + Math.max(1, o.box.w)] as const).sort((a, b) => a[0] - b[0]);
  const cuts: Array<{ x: number; gap: number }> = [];
  let reach = spans[0]![1];
  for (const [x0, x1] of spans) {
    const gap = x0 - reach;
    if (gap >= body * GUTTER_SIZES) cuts.push({ x: (reach + x0) / 2, gap });
    reach = Math.max(reach, x1);
  }
  const kept = cuts.slice(0, MAX_COLUMNS - 1);
  if (!kept.length) return [];
  const xs = kept.map((c) => c.x);
  const widest = Math.max(...kept.map((c) => c.gap));
  const cols: SourceObjectV1[][] = Array.from({ length: xs.length + 1 }, () => []);
  for (const o of texts) cols[xs.filter((x) => o.box.x >= x).length]!.push(o);
  const believable = cols.every((col) => {
    if (col.length < MIN_COLUMN_LINES) return false;
    const left = Math.min(...col.map((o) => o.box.x));
    const width = Math.max(...col.map((o) => o.box.x + o.box.w)) - left;
    // A column of prose is wider than the gutter beside it; a column of table cells is not.
    if (width <= 0 || width <= widest) return false;
    return median(col.map((o) => o.box.w / width)) >= MIN_COLUMN_FILL;
  });
  return believable ? xs : [];
}

/**
 * The page's reading order. Geometric first (12 px bands, then x), then column
 * by column between items that cross a gutter, then, when the structure tree
 * ranks most of the text, the ranked text objects take the text places of that
 * order in the tree's own sequence.
 */
function readingOrderOf(objects: SourceObjectV1[], ranks: Map<string, number>): SourceObjectV1[] {
  const band = (o: SourceObjectV1): number => Math.round((o.box.y + o.box.h / 2) / 12);
  const geometric = [...objects].sort((a, b) => band(a) - band(b) || a.box.x - b.box.x || idCmp(a, b));
  const texts = objects.filter((o) => o.kind === 'text' && !o.hidden && o.box.rot === 0);

  let order = geometric;
  const cuts = columnCuts(texts);
  if (cuts.length) {
    const columnOf = (o: SourceObjectV1): number => {
      const crosses = cuts.some((x) => o.box.x < x && o.box.x + o.box.w > x);
      return crosses ? -1 : cuts.filter((x) => o.box.x >= x).length;
    };
    order = [];
    let section: SourceObjectV1[] = [];
    const flush = (): void => {
      order.push(...section.map((o, k) => ({ o, k, c: columnOf(o) })).sort((a, b) => a.c - b.c || a.k - b.k).map((e) => e.o));
      section = [];
    };
    for (const o of geometric) {
      if (columnOf(o) < 0) { flush(); order.push(o); } else section.push(o);
    }
    flush();
  }

  const ranked = texts.filter((o) => ranks.has(o.id));
  if (texts.length && ranked.length / texts.length >= MIN_TAGGED_SHARE) {
    const slots: number[] = [];
    order.forEach((o, i) => { if (ranks.has(o.id)) slots.push(i); });
    const inTreeOrder = [...ranked].sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)! || idCmp(a, b));
    order = [...order];
    slots.forEach((slot, k) => { order[slot] = inTreeOrder[k]!; });
  }
  return order;
}

// ─── the page's own diagnostics ──────────────────────────────────────────────

/** A fill the interpreter could not paint at all. */
const FILL_NOT_PAINTED = /^(pattern\.unsupported|shading\.unsupported|shading\.sh\.unclipped|pattern\.tiling\.raster\.skipped|pattern\.smasked\.skipped)\b/;
/** Rungs that lost nothing. */
const FILL_EXACT = /^(pattern\.tiling\.collapsed|shading\.type1\.(flat|axialised))\b/;
const WORK_BUDGET = /^(content|smask)\.budget\.exhausted\b/;
const RESOURCES_REFUSED = /^resources\.(cycle|budget\.exhausted)\b/;

/**
 * The page's warnings from its diagnostics. `painted` holds what the
 * interpreter said while it painted, one code for each paint it dropped or
 * simplified; `decoded` holds what the resource walk said while it decoded the
 * page's resources, every one the page lists, painted or not. Fills are counted
 * from `painted` alone: a shading or pattern that is listed and never used lost
 * nothing, and one that is used is reported again at its paint. A simplified
 * gradient that reaches an object is stated on that object (`shapeObject`).
 */
function diagWarnings(slideId: string, painted: string[], decoded: string[]): SourceWarningV1[] {
  const out: SourceWarningV1[] = [];
  const dropped = painted.filter((m) => FILL_NOT_PAINTED.test(m)).length;
  if (dropped) {
    out.push({
      code: 'media-skipped',
      message: `${dropped} gradient or pattern ${plural(dropped, 'fill', 'fills')} on ${slideId} could not be read and ${plural(dropped, 'was', 'were')} not painted, so what ${plural(dropped, 'it fills is', 'they fill is')} missing from the page.`,
      count: dropped,
    });
  }
  const approximated = painted.filter((m) => /^(shading|pattern)\./.test(m) && !FILL_NOT_PAINTED.test(m) && !FILL_EXACT.test(m)).length;
  if (approximated) {
    out.push({
      code: 'gradient-flattened',
      message: `${approximated} gradient or pattern ${plural(approximated, 'fill', 'fills')} on ${slideId} could not be reproduced exactly and ${plural(approximated, 'was', 'were')} simplified to a flat colour or a plainer gradient.`,
      count: approximated,
    });
  }
  const budgets = [...new Set([...painted, ...decoded].filter((m) => WORK_BUDGET.test(m)))];
  if (budgets.length) {
    out.push({
      code: 'nodes-truncated',
      message: `${slideId} ran past the interpreter's work budget (${budgets.join(', ')}), so content after that point is missing.`,
    });
  }
  const refused = [...new Set([...painted, ...decoded].filter((m) => RESOURCES_REFUSED.test(m)))];
  if (refused.length) {
    out.push({
      code: 'nodes-truncated',
      message: `Part of the resources of ${slideId} was not read (a resource dictionary that refers back to itself, or more than ${PDF_READ_RESOURCE_BUDGET} of them), so fonts, pictures or forms named there may be missing.`,
    });
  }
  return out;
}

/** The PDF trailer's permanent identifier, which survives revisions of one document. */
function trailerId(doc: PDFDocument): string | undefined {
  try {
    const ids = doc.context.lookup(doc.context.trailerInfo.ID);
    if (!(ids instanceof PDFArray) || !ids.size()) return undefined;
    const first = doc.context.lookup(ids.get(0));
    const bytes = first instanceof PDFHexString || first instanceof PDFString ? first.asBytes() : undefined;
    return bytes?.length ? `pdf-id:${bytesToHex(bytes)}` : undefined;
  } catch {
    return undefined;
  }
}

/** One macrotask, so the host can run a queued event (a cancel click) and paint. */
function yieldToHost(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
const YIELD_EVERY_MS = 12;

interface MediaResult {
  ref?: string;
  mime?: string;
  hash?: string;
  width: number;
  height: number;
  reason?: FidelityReasonV1;
  /** Why the image is missing or carried opaque, in plain words. */
  issue?: string;
  /** The soft mask could not be composited, so the stored picture is opaque. */
  opaque?: boolean;
}

/** One object waiting for its id: built once the page's paint order is settled. */
interface Unit {
  z: number;
  /** The structure tree's rank for a text object, when the page is tagged. */
  rank?: number;
  build: (id: string) => Promise<{ object: SourceObjectV1; warnings: SourceWarningV1[] }>;
}

// ─── the adapter ─────────────────────────────────────────────────────────────

/**
 * Read a PDF into the stage-1 source model. Every picture goes through
 * `opts.sink` once per distinct byte sequence, so the same logo on every page is
 * one asset ref.
 */
export async function sourceDeckFromPdf(bytes: Uint8Array, opts: SourcePdfOptsV1): Promise<SourceDeckV1> {
  opts.signal?.throwIfAborted();
  const caps: Required<SourcePdfCapsV1> = {
    ...SOURCE_PDF_DEFAULT_CAPS,
    ...(opts.maxMediaBytes !== undefined ? { maxMediaBytes: opts.maxMediaBytes } : {}),
    ...Object.fromEntries(Object.entries(opts.caps ?? {}).filter(([, v]) => typeof v === 'number')),
  };
  const codec = opts.codec ?? NODE_PDF_IMAGE_CODEC;
  let doc: PDFDocument;
  try {
    doc = await loadPdfDocument(bytes);
  } catch (err) {
    throw new Error(`This PDF could not be read. It may be encrypted or damaged. (${String((err as Error)?.message ?? err)})`);
  }
  await yieldToHost();
  opts.signal?.throwIfAborted();
  let lastYield = Date.now();

  let pageCount = 0;
  try { pageCount = doc.getPageCount(); } catch { pageCount = 0; }
  const total = Math.min(pageCount, Math.max(0, Math.floor(caps.maxPages)));
  const deckWarnings: SourceWarningV1[] = [];
  if (pageCount > total) {
    deckWarnings.push({
      code: 'slides-truncated',
      message: `This PDF has ${pageCount} pages; the first ${total} were read.`,
      count: pageCount - total,
    });
  }

  const byStream = new Map<PDFRawStream, MediaResult>();
  const byHash = new Map<string, string>();
  const store = async (desc: PdfImageDesc | undefined): Promise<MediaResult> => {
    if (!desc) return { width: 0, height: 0, reason: 'media-missing', issue: 'the page names an image the document does not hold' };
    const cached = byStream.get(desc.stream);
    if (cached) return cached;
    let result: MediaResult = { width: desc.width, height: desc.height };
    let raw = 0;
    try { raw = desc.stream.getContents().length; } catch { raw = 0; }
    if (desc.width * desc.height > caps.maxImagePixels) {
      result = { ...result, reason: 'media-too-large', issue: `${desc.width} by ${desc.height} pixels is over the ${caps.maxImagePixels} pixel limit` };
    } else if (raw > caps.maxMediaBytes) {
      result = { ...result, reason: 'media-too-large', issue: `${raw} bytes is over the ${caps.maxMediaBytes} byte limit` };
    } else {
      // The decode inflates no further than the declared width, height and
      // components need (see pdfFlateSamples), so the pixel cap above bounds it.
      const issues: PdfImageIssue[] = [];
      const decoded = await decodePdfImage(desc, codec, (issue) => issues.push(issue));
      const opaque = issues.some((i) => i.code === 'smask-undecodable');
      if (!decoded) {
        result = { ...result, reason: 'unsupported-media-format', issue: issues.map(describePdfImageIssue).join(' ') || 'the image could not be decoded' };
      } else if (decoded.bytes.byteLength > caps.maxMediaBytes) {
        result = { ...result, reason: 'media-too-large', issue: `${decoded.bytes.byteLength} bytes is over the ${caps.maxMediaBytes} byte limit` };
      } else {
        const hash = await sha256Hex(decoded.bytes);
        let ref = byHash.get(hash);
        if (!ref) {
          ref = await opts.sink(decoded.bytes, decoded.mime, hash);
          byHash.set(hash, ref);
        }
        result = { ...result, ref, mime: decoded.mime, hash };
        if (opaque) { result.opaque = true; result.issue = describePdfImageIssue({ code: 'smask-undecodable' }); }
      }
    }
    byStream.set(desc.stream, result);
    return result;
  };

  const fontRuns = new Map<string, number>();
  const slides: SlideSourceV1[] = [];
  opts.onSlide?.(0, total);

  for (let index = 0; index < total; index++) {
    if (Date.now() - lastYield >= YIELD_EVERY_MS) {
      await yieldToHost();
      lastYield = Date.now();
    }
    opts.signal?.throwIfAborted();
    const slideId = `page${index + 1}`;
    const warnings: SourceWarningV1[] = [];
    const diag: string[] = [];
    /** What the resource walk said while decoding, kept apart from what the interpreter said while painting. */
    const decodeDiag: string[] = [];

    let page: PdfInterpretedPage | null = null;
    let widthPt = 612;
    let heightPt = 792;
    try {
      const pdfPage = doc.getPage(index);
      const mb = pdfPage.getMediaBox();
      if (mb.width > 0 && mb.height > 0) { widthPt = mb.width; heightPt = mb.height; }
      const rotation = ((Math.round(pdfPage.getRotation().angle) % 360) + 360) % 360;
      if (rotation) {
        warnings.push({
          code: 'group-transform-approximated',
          message: `${slideId} is shown turned ${rotation} degrees, and that turn was not applied: its objects are placed as the page is stored, not as it is shown.`,
        });
      }
      const cb = pdfPage.getCropBox();
      if (Math.abs(cb.x - mb.x) > 0.5 || Math.abs(cb.y - mb.y) > 0.5 || Math.abs(cb.width - mb.width) > 0.5 || Math.abs(cb.height - mb.height) > 0.5) {
        warnings.push({
          code: 'group-transform-approximated',
          message: `${slideId} shows only part of its page (a crop box of ${round2(cb.width)} by ${round2(cb.height)} points); the whole page was read, so content outside the shown part is included.`,
        });
      }
    } catch { /* US Letter stands in for a page box that cannot be read */ }
    try {
      page = interpretPdfDocPage(doc, index, {
        diag: (m) => diag.push(m),
        artifacts: true,
        invisibleText: true,
        maxContentChars: caps.maxContentChars,
        walk: (ctx, images) => makePdfWalk(ctx, images, (m) => decodeDiag.push(m), opts.decoders ?? {}, { bounded: true }),
      });
    } catch (err) {
      warnings.push(err instanceof PdfPageTooLargeError
        ? { code: 'part-too-large', message: `${slideId} was not read: ${err.message}`, count: err.chars }
        : { code: 'media-skipped', message: `${slideId} could not be read (${String((err as Error)?.message ?? err)}), so it holds no objects.` });
    }

    const slide: SlideSourceV1 = {
      id: slideId,
      index,
      width: px(widthPt) || 816,
      height: px(heightPt) || 1056,
      background: {},
      objects: [],
      readingOrder: [],
      warnings,
      origin: { kind: 'pdf' },
    };

    let ranks = new Map<string, number>();
    if (page) {
      const struct = new Map<number, number>();
      if (page.nodes.some((n) => n.kind === 'text' && typeof n.mcid === 'number')) {
        let k = 0;
        for (const element of readPdfStructOrder(doc, index)) {
          for (const mcid of element.mcids) if (!struct.has(mcid)) struct.set(mcid, k++);
        }
      }
      const built = await readPage(page, slideId, store, caps, fontRuns, struct);
      ranks = built.ranks;
      slide.width = px(page.width) || slide.width;
      slide.height = px(page.height) || slide.height;
      slide.objects = built.objects;
      slide.warnings.push(...built.warnings);
      if (built.background) slide.background.color = built.background;
      if (built.flattened) slide.origin.flattened = true;
      if (built.ocr) slide.ocr = built.ocr;
      if (page.truncated) {
        slide.warnings.push({
          code: 'nodes-truncated',
          message: `${slideId} paints ${PDF_MAP_MAX_PAGE_NODES} items or more; the interpreter stops there, so content after that point may be missing.`,
        });
      }
      if (page.inlineImages) {
        slide.warnings.push({
          code: 'media-skipped',
          message: `${slideId} draws ${page.inlineImages} inline ${plural(page.inlineImages, 'picture', 'pictures')}, which this reader skips, so ${plural(page.inlineImages, 'it is', 'they are')} missing.`,
          count: page.inlineImages,
        });
      }
      slide.warnings.push(...diagWarnings(slideId, diag, decodeDiag));
    }

    const order = readingOrderOf(slide.objects, ranks);
    order.forEach((object, i) => { object.readingIndex = i; });
    slide.readingOrder = order.map((object) => object.id);
    slides.push(slide);
    opts.onSlide?.(slides.length, total);
  }

  const source: SourceDeckV1['source'] = {
    kind: 'pdf',
    hash: opts.hash,
    lineageId: trailerId(doc) ?? opts.hash,
    instanceId: opts.instanceId,
    pageCount: slides.length,
  };
  if (opts.name) source.name = opts.name;
  if (typeof opts.bytes === 'number') source.bytes = opts.bytes;
  try {
    const title = doc.getTitle();
    if (title?.trim()) source.title = title.trim().slice(0, 4096);
  } catch { /* an unreadable info dictionary names no title */ }

  return {
    version: 1,
    source,
    slides,
    fonts: [...fontRuns.entries()]
      .map(([family, runs]) => ({ family, provenance: 'literal' as const, runs }))
      .sort((a, b) => b.runs - a.runs || (a.family < b.family ? -1 : a.family > b.family ? 1 : 0)),
    warnings: deckWarnings,
    reader: { ...opts.reader },
  };
}

// ─── one page ────────────────────────────────────────────────────────────────

interface PageRead {
  objects: SourceObjectV1[];
  warnings: SourceWarningV1[];
  background?: SourceColorV1;
  flattened: boolean;
  /** On a flattened page: whether recognition ran over it, from the page's own text layer or not at all. */
  ocr?: SlideOcrV1;
  /** Structure-tree rank by object id, for the text objects the tree names. */
  ranks: Map<string, number>;
}

/** An object's cut by clips or a soft mask, stated as a warning that names it. */
function cutWarning(id: string, what: string, mask: boolean): SourceWarningV1 {
  return {
    code: 'group-transform-approximated',
    message: mask
      ? `${what} ${id} is painted through a soft mask, which was not carried: it is read as if unmasked.`
      : `${what} ${id} is cut by a clipping path that is not a plain rectangle: it carries the bounds of the cut, not its outline.`,
    objectIds: [id],
  };
}

async function readPage(
  page: PdfInterpretedPage,
  slideId: string,
  store: (desc: PdfImageDesc | undefined) => Promise<MediaResult>,
  caps: Required<SourcePdfCapsV1>,
  fontRuns: Map<string, number>,
  struct: Map<number, number>,
): Promise<PageRead> {
  const { nodes, width, height } = page;
  const artifacts = page.artifacts ?? [];
  const invisible = page.invisible ?? [];
  const pageArea = Math.max(1, width * height);
  const warnings: SourceWarningV1[] = [];

  // The ground: the first paint, an opaque rectangle over (nearly) the whole page, uncut.
  let background: SourceColorV1 | undefined;
  let groundIndex = -1;
  const first = nodes[0];
  if (first && first.kind === 'box' && (first.shape ?? 'rect') === 'rect' && !first._gradient && !first._softMask
    && (first.opacity ?? 100) >= 100 && (first.w * first.h) / pageArea >= 0.98 && !clipRead(first).cut) {
    const color = colorOf(first.fill);
    if (color && color.alpha === undefined) { background = color; groundIndex = 0; }
  }

  // Flattened: a scan in fact. The engine calls the page scanned once its
  // invisible text layer is set aside, a real picture covers half of it, and it
  // paints next to nothing else.
  let cover = -1;
  let coverArea = 0;
  nodes.forEach((n, i) => {
    if (!isRaster(n)) return;
    const area = n.w * n.h;
    if (area > coverArea) { coverArea = area; cover = i; }
  });
  const others = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n, i }) => i !== cover && i !== groundIndex && !invisible[i] && paints(n));
  const othersArea = others.reduce((sum, { n }) => sum + Math.max(0, n.w) * Math.max(0, n.h), 0);
  // Paints in the edge band are the template's furniture, not the page's content:
  // they neither count against the picture nor make its page read as text.
  const atEdge = (n: PdfNode): boolean => {
    const cx = (n.x + n.w / 2) / Math.max(1, width);
    const cy = (n.y + n.h / 2) / Math.max(1, height);
    return cx < FLATTEN_EDGE_BAND || cx > 1 - FLATTEN_EDGE_BAND || cy < FLATTEN_EDGE_BAND || cy > 1 - FLATTEN_EDGE_BAND;
  };
  const furniture = new Set(others.filter(({ n }) => atEdge(n)).map(({ i }) => i));
  const inner = others.filter(({ i }) => !furniture.has(i));
  const flattened = cover >= 0 && coverArea / pageArea >= 0.5
    && inner.length <= FLATTEN_MAX_OTHERS && othersArea / pageArea <= FLATTEN_MAX_OTHER_AREA
    && pdfPageScanned(nodes.filter((_, i) => !invisible[i] && !furniture.has(i)), width, height);

  const units: Unit[] = [];
  const picUnit = (i: number, ocr: OcrEvidenceV1 | undefined): Unit => ({
    z: i,
    build: async (id) => {
      const n = nodes[i]!;
      const desc = page.imageStreams.get(n._imageXObject ?? '');
      const media = await store(desc);
      const box = boxOf(n.x, n.y, n.w, n.h, n.rot);
      let fidelity: FidelityV1;
      const own: SourceWarningV1[] = [];
      const object: SourceObjectV1 = { id, fingerprint: '', kind: 'pic', box, origin: artifacts[i] ? 'pdf-artifact' : 'slide', fidelity: { state: 'editable' } };
      const clip = clipRead(n);
      if (clip.cut && clip.visible) object.clip = boxOf(clip.visible.x, clip.visible.y, clip.visible.w, clip.visible.h);
      const cutApprox = (clip.cut && !clip.exact) || !!n._softMask;
      if (media.ref) {
        object.media = media.ref;
        if (media.mime) object.mediaMime = media.mime;
        fidelity = media.opaque || cutApprox ? { state: 'approximate', reason: 'reader-approximation' } : { state: 'raster-preserved' };
        if (clip.cut && !clip.exact) own.push(cutWarning(id, 'The picture', false));
        if (n._softMask) own.push(cutWarning(id, 'The picture', true));
      } else {
        fidelity = { state: 'unavailable', reason: media.reason ?? 'media-missing' };
        own.push({ code: 'media-skipped', message: `The picture ${id} was not stored: ${media.issue ?? media.reason ?? 'media-missing'}.`, objectIds: [id] });
      }
      if (media.width > 0 && media.height > 0) object.raster = { width: media.width, height: media.height };
      if (ocr) object.ocr = ocr;
      object.fidelity = fidelity;
      object.fingerprint = await fingerprintOf('pic', box, media.hash ?? `${n._imageXObject ?? ''}|${media.reason ?? ''}`);
      return { object, warnings: own };
    },
  });

  let pageOcr: PageRead['ocr'];
  if (flattened) {
    const layer = ocrLayer(nodes, invisible, nodes[cover]!);
    // The slide states the same reading its picture carries: the page's own text
    // layer when it has one (a searchable scan), otherwise `not-run`.
    // Only a reading names its model, as the slide OCR type and schema require.
    if (layer.state === 'text-found' || layer.state === 'no-text-found') {
      pageOcr = layer.model ? { state: layer.state, model: layer.model } : { state: layer.state };
    } else {
      pageOcr = { state: layer.state };
    }
    units.push(picUnit(cover, layer));
    if (others.length) {
      warnings.push({
        code: 'nodes-truncated',
        message: `${slideId} is read as one picture; ${others.length} other painted ${plural(others.length, 'item was', 'items were')} not carried as objects of their own.`,
        count: others.length,
      });
    }
  } else {
    // Text lines, the invisible ones carried hidden.
    const rankOf = (line: PdfTextLine): number | undefined => {
      let best: number | undefined;
      for (const run of line.runs) {
        const mcid = nodes[run.nodeIndex]?.mcid;
        const r = typeof mcid === 'number' ? struct.get(mcid) : undefined;
        if (r !== undefined && (best === undefined || r < best)) best = r;
      }
      return best;
    };
    for (const line of pdfTextLines(nodes, artifacts)) {
      const unit: Unit = { z: line.firstNode, build: async (id) => textObject(id, line, fontRuns) };
      const rank = rankOf(line);
      if (rank !== undefined) unit.rank = rank;
      units.push(unit);
    }
    // Pictures, unless clipped away entirely.
    nodes.forEach((n, i) => { if (isRaster(n) && clipRead(n).visible) units.push(picUnit(i, undefined)); });
    // Vector marks, then what no mark claimed.
    const claimed = new Set<number>();
    if (groundIndex >= 0) claimed.add(groundIndex);
    for (const mark of findVectorArtwork(nodes, { width, height })) {
      const members = mark.indices.filter((i) => !claimed.has(i));
      if (!members.length) continue;
      for (const i of members) claimed.add(i);
      const extent = { x: mark.rect.x, y: mark.rect.y, w: mark.rect.w, h: mark.rect.h };
      const fill = mark.fills[0];
      units.push({ z: Math.min(...members), build: async (id) => vectorObject(id, nodes, members, extent, width, height, artifacts, fill) });
    }
    nodes.forEach((n, i) => {
      if (claimed.has(i)) return;
      if (isShapeBox(n)) {
        const clip = clipRead(n);
        if (clip.visible) units.push({ z: i, build: async (id) => shapeObject(id, n, artifacts[i], clip) });
      } else if (isVectorPath(n)) {
        const e = pdfNodeExtent(n) ?? { x: n.x, y: n.y, w: n.w, h: n.h };
        units.push({ z: i, build: async (id) => vectorObject(id, nodes, [i], e, width, height, artifacts, undefined) });
      }
    });
  }

  units.sort((a, b) => a.z - b.z);
  const cap = Math.max(0, Math.floor(caps.maxObjectsPerPage));
  if (units.length > cap) {
    warnings.push({
      code: 'nodes-truncated',
      message: `${slideId} holds ${units.length} objects; the first ${cap} in paint order were kept.`,
      count: units.length - cap,
    });
    units.length = cap;
  }
  const objects: SourceObjectV1[] = [];
  const ranks = new Map<string, number>();
  for (const [z, unit] of units.entries()) {
    const { object, warnings: own } = await unit.build(`${slideId}.${z}`);
    objects.push(object);
    warnings.push(...own);
    if (unit.rank !== undefined) ranks.set(object.id, unit.rank);
  }
  const out: PageRead = { objects, warnings, flattened, ranks };
  if (pageOcr) out.ocr = pageOcr;
  if (background) out.background = background;
  return out;
}

/** True when a node puts something on the page. */
function paints(n: PdfNode): boolean {
  if (n.kind === 'text') return !!n.text?.trim();
  return isRaster(n) || isShapeBox(n) || isVectorPath(n);
}

/**
 * A flattened page's OCR evidence. A searchable scan carries its recognised
 * words as invisible text over the picture; those lines are the document's own
 * text layer, read and not guessed, so each line's confidence is 1 and the model
 * names the layer. A page without one has OCR `not-run`.
 */
function ocrLayer(nodes: PdfNode[], invisible: boolean[], picture: PdfNode): OcrEvidenceV1 {
  const layer = nodes.filter((n, i) => invisible[i] && n.kind === 'text');
  const lines = pdfTextLines(layer).slice(0, MAX_OCR_LINES);
  if (!lines.length) return { state: 'not-run' };
  const text = lines.map((line) => pdfLineRunTexts(line).join('').slice(0, 65536));
  const areaPx = Math.max(1, px(picture.w) * px(picture.h));
  const chars = text.reduce((sum, t) => sum + t.replace(/\s/g, '').length, 0);
  return {
    state: 'text-found',
    model: 'pdf-text-layer',
    lines: lines.map((line, k) => ({ text: text[k]!, confidence: 1, box: boxOf(line.x, line.y, line.w, line.h, line.rot) })),
    textDensity: round2(chars / (areaPx / 1000)),
  };
}

async function textObject(
  id: string,
  line: PdfTextLine,
  fontRuns: Map<string, number>,
): Promise<{ object: SourceObjectV1; warnings: SourceWarningV1[] }> {
  const runs: SourceRunV1[] = [];
  // A PDF positions words rather than spelling the space between them, and the
  // interpreter trims a run's trailing space. `pdfLineRunTexts` puts the space
  // back where pdf-text and Unpack would: the engine's `pdfWordBreak` over the
  // gap past the previous run's measured ink (`PdfNode.lineInk`), or a break the
  // document spelled with a trailing space glyph (`PdfNode.spaceAfter`).
  const texts = pdfLineRunTexts(line);
  for (const [k, run] of line.runs.entries()) {
    const item: SourceRunV1 = { text: texts[k] ?? run.text, sizePt: round2(run.size) };
    if (run.bold) item.bold = true;
    if (run.italic) item.italic = true;
    if (run.font) {
      item.font = run.font.slice(0, 256);
      item.fontProvenance = 'literal';
      fontRuns.set(item.font, (fontRuns.get(item.font) ?? 0) + 1);
    }
    const color = colorOf(run.color, run.opacity);
    if (color) item.color = color;
    runs.push(item);
  }
  const box = boxOf(line.x, line.y, line.w, line.h, line.rot);
  const object: SourceObjectV1 = {
    id,
    fingerprint: '',
    kind: 'text',
    box,
    origin: line.artifact ? 'pdf-artifact' : 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs }] },
  };
  if (line.artifact === 'Footer') object.placeholder = 'ftr';
  if (line.runs.every((r) => r.opacity <= 0)) object.hidden = true;
  object.fingerprint = await fingerprintOf('text', box, runs.map((r) => r.text).join(''));
  return { object, warnings: [] };
}

async function shapeObject(
  id: string,
  n: PdfNode,
  artifact: PdfArtifactKind | undefined,
  clip: ClipRead,
): Promise<{ object: SourceObjectV1; warnings: SourceWarningV1[] }> {
  const geom = n.shape === 'ellipse' ? 'ellipse' : (n.radius ?? 0) > 0 ? 'roundRect' : 'rect';
  // A rectangle cut by rectangles is the rectangle that shows. Any other cut keeps
  // the shape's own box and records the part that shows.
  const exactCut = clip.cut && clip.exact && geom === 'rect' && clip.visible;
  const shown = exactCut ? clip.visible! : { x: n.x, y: n.y, w: n.w, h: n.h };
  const box = boxOf(shown.x, shown.y, shown.w, shown.h, n.rot);
  const object: SourceObjectV1 = { id, fingerprint: '', kind: 'shape', box, origin: artifact ? 'pdf-artifact' : 'slide', fidelity: { state: 'editable' }, geom };
  if (clip.cut && !exactCut && clip.visible) object.clip = boxOf(clip.visible.x, clip.visible.y, clip.visible.w, clip.visible.h);
  const fill = colorOf(n.fill, n.opacity);
  if (fill) object.fill = fill;
  const warnings: SourceWarningV1[] = [];
  if (n._gradient) {
    object.fidelity = { state: 'approximate', reason: 'reader-approximation' };
    warnings.push({ code: 'gradient-flattened', message: `A gradient on ${id} was read as one flat colour.`, objectIds: [id] });
  }
  if (clip.cut && !exactCut) {
    object.fidelity = { state: 'approximate', reason: 'reader-approximation' };
    warnings.push(clip.exact
      ? {
        code: 'group-transform-approximated',
        message: `The ${geom} ${id} is cut by a rectangle; it keeps its own box and states the part that shows as its clip.`,
        objectIds: [id],
      }
      : cutWarning(id, 'The shape', false));
  }
  if (n._softMask) {
    object.fidelity = { state: 'approximate', reason: 'reader-approximation' };
    warnings.push(cutWarning(id, 'The shape', true));
  }
  object.fingerprint = await fingerprintOf('shape', box, `${geom}|${fill?.hex ?? ''}:${fill?.alpha ?? ''}`);
  return { object, warnings };
}

async function vectorObject(
  id: string,
  nodes: PdfNode[],
  indices: number[],
  extent: PdfExtent,
  width: number,
  height: number,
  artifacts: ReadonlyArray<PdfArtifactKind | undefined>,
  markFill: string | undefined,
): Promise<{ object: SourceObjectV1; warnings: SourceWarningV1[] }> {
  const members = indices.map((i) => nodes[i]!);
  // One frame for both: the SVG is windowed to it and the box is it, so a stage
  // that fits the SVG into the box neither scales nor shifts the mark.
  const x = round2(Math.max(0, extent.x - PDF_VECTOR_PAD));
  const y = round2(Math.max(0, extent.y - PDF_VECTOR_PAD));
  const w = round2(Math.max(1, Math.min(width - x, extent.w + PDF_VECTOR_PAD * 2)));
  const h = round2(Math.max(1, Math.min(height - y, extent.h + PDF_VECTOR_PAD * 2)));
  const box = boxOf(x, y, w, h);
  const allArtifact = indices.every((i) => artifacts[i]);
  const object: SourceObjectV1 = {
    id, fingerprint: '', kind: 'vector', box,
    origin: allArtifact ? 'pdf-artifact' : 'slide',
    fidelity: { state: 'approximate', reason: 'reader-approximation' },
  };
  const warnings: SourceWarningV1[] = [];
  // Def ids are plain counters, and an object's SVG is inlined beside others on
  // export, where ids do not scope: the object id keeps them apart.
  const idPrefix = id.replace(/[^A-Za-z0-9]/g, '_');
  let svg = '';
  let reason: FidelityReasonV1 | undefined;
  try {
    svg = windowPdfSvg(pdfNodesToSvg(members, { width, height, images: {}, idPrefix }), { x, y, width: w, height: h });
  } catch (err) {
    reason = 'reader-approximation';
    warnings.push({ code: 'media-skipped', message: `The vector art ${id} could not be drawn (${String((err as Error)?.message ?? err)}).`, objectIds: [id] });
  }
  if (svg.length > MAX_VECTOR_CHARS) {
    reason = 'cap-reached';
    warnings.push({ code: 'part-too-large', message: `The vector art ${id} is ${svg.length} characters of SVG, over the ${MAX_VECTOR_CHARS} limit, so it was not carried.`, objectIds: [id] });
    svg = '';
  }
  if (svg) object.vector = svg;
  else object.fidelity = { state: 'unavailable', reason: reason ?? 'reader-approximation' };
  const fill = colorOf(markFill ?? members.find((m) => m._vectorFill && m._vectorFill !== 'none')?._vectorFill ?? members[0]?.fill);
  if (fill) object.fill = fill;
  const stroke = members.find((m) => m._vectorStroke)?._vectorStroke;
  if (stroke) {
    const color = colorOf(stroke.color);
    object.line = { widthPt: round2(stroke.width) };
    if (color) object.line.color = color;
  }
  object.fingerprint = await fingerprintOf('vector', box, vectorMaterial(members, extent.x, extent.y));
  return { object, warnings };
}
