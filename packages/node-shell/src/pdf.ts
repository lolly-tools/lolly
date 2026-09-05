// SPDX-License-Identifier: MPL-2.0
/**
 * PDF capability (host.pdf) - metadata inspection + removal, backed by pdf-lib.
 *
 * Unlike the JPEG/PNG/SVG strippers (dependency-free byte/text surgery that runs
 * inside the sandboxed tool hook), a PDF is a cross-referenced object graph with
 * an xref table and compressed object streams - you can't excise a metadata
 * object without rewriting offsets. So the work lives here in the shell, where a
 * real PDF library is available, and the tool reaches it through `host.pdf`.
 *
 * IMPORTANT: this RE-SAVES the document (pdf-lib re-serialises), so the result is
 * not byte-for-byte and any digital signature is invalidated - the tool's UI says
 * so. Everything runs locally in the browser; nothing is uploaded.
 *
 * pdf-lib is loaded on demand (dynamic import) so it never adds to startup cost -
 * only the first PDF a user opens pulls it in.
 *
 * MOVED here from `shells/web/src/bridge/pdf.ts` (plans/202 WP1.1). Every path in
 * it is DOM-OPTIONAL: analyze and strip are pure pdf-lib, and the compress pass
 * feature-detects a canvas (`hasImageCodec`) and does the structural re-save only
 * when there is none, which is exactly what the node CLI gets. The CLI has always
 * imported this factory, so it lives in the package both shells can import rather
 * than behind a submodule boundary. The web file stays as a re-export shim, and
 * `pdf-redact.ts` (the canvas half) keeps taking PDF_LOAD_OPTS, hasImageCodec,
 * makeCanvas and canvasToJpeg through it unchanged.
 */
import type { PDFDocument as PDFDocumentType, PDFName as PDFNameType } from 'pdf-lib';
import { buildEncryptDictValues, encryptObjectBytes, preparePassword } from '@lolly/engine';
import type {
  PdfAPI, PdfCompressOpts, PdfCompressResult, PdfFinding,
  PdfOrganizeOpts, PdfOrganizeResult, PdfStampOpts, PdfStampResult,
} from '@lolly-tools/core/host-v1';

// Shared with pdf-redact.ts (the web-only rasterise-and-rebuild half of host.pdf).
export const PDF_LOAD_OPTS = { ignoreEncryption: true, updateMetadata: false };

// Info-dictionary keys we report + remove. These are the standard document-info
// entries; PDF/X and tooling sometimes add more, but these cover the leaks.
interface InfoField {
  key: string;
  label: string;
  tone: PdfFinding['tone'];
  get: (d: PDFDocumentType) => string | string[] | undefined;
}

const INFO_FIELDS: InfoField[] = [
  { key: 'Author', label: 'Author', tone: 'warn', get: (d) => d.getAuthor() },
  { key: 'Creator', label: 'Created with', tone: 'warn', get: (d) => d.getCreator() },   // authoring app
  { key: 'Producer', label: 'PDF producer', tone: 'warn', get: (d) => d.getProducer() }, // producing app/lib
  { key: 'Title', label: 'Title', tone: '', get: (d) => d.getTitle() },
  { key: 'Subject', label: 'Subject', tone: '', get: (d) => d.getSubject() },
  { key: 'Keywords', label: 'Keywords', tone: '', get: (d) => d.getKeywords() },
];

function isoDate(d: Date | undefined): string | null {
  try { return d instanceof Date && !Number.isNaN(Number(d)) ? d.toISOString().slice(0, 10) : null; }
  catch { return null; }
}

// A pdf-lib stream object as accessed by the best-effort duck-typing below: either
// exposes a getContents() method or a raw `contents` byte array.
type StreamLike = { getContents?: () => Uint8Array | undefined; contents?: Uint8Array };

// Read the catalog's XMP metadata stream as text, if present. Best-effort: the
// stream is usually an uncompressed XML packet; if it's compressed/odd we still
// detect its presence, we just can't quote from it.
function readXmpText(doc: PDFDocumentType, PDFName: typeof PDFNameType): string | null {
  const ref = doc.catalog.get(PDFName.of('Metadata'));
  if (!ref) return null;
  let stream: unknown;
  try { stream = doc.context.lookup(ref); } catch { return ''; }
  if (!stream) return '';
  try {
    const bytes = typeof (stream as StreamLike).getContents === 'function' ? (stream as StreamLike).getContents!() : (stream as StreamLike).contents;
    return bytes ? new TextDecoder('utf-8').decode(bytes) : '';
  } catch { return ''; }
}

const xmpField = (xmp: string, re: RegExp): string | null => { const m = re.exec(xmp); return m ? m[1]!.replace(/\s+/g, ' ').trim() : null; };

export async function analyzePdf(bytes: Uint8Array): Promise<{ findings: PdfFinding[] }> {
  const { PDFDocument, PDFName } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, PDF_LOAD_OPTS);
  const findings: PdfFinding[] = [];
  const add = (label: string, detail: string | string[] | null | undefined, tone: PdfFinding['tone'] = '') => {
    const d = detail == null ? '' : String(detail).trim();
    if (d) findings.push({ label, detail: d, tone });
  };

  for (const f of INFO_FIELDS) {
    let v: string | string[] | null | undefined;
    try { v = f.get(doc); } catch { v = null; }
    add(f.label, Array.isArray(v) ? v.join(', ') : v, f.tone);
  }
  try { add('Created', isoDate(doc.getCreationDate())); } catch { /* malformed date */ }
  try { add('Modified', isoDate(doc.getModificationDate())); } catch { /* malformed date */ }

  const xmp = readXmpText(doc, PDFName);
  if (xmp != null) {
    const who = xmpField(xmp, /<dc:creator>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i)
      || xmpField(xmp, /<xmp:CreatorTool>([\s\S]*?)<\/xmp:CreatorTool>/i);
    add('XMP metadata', who ? `XMP packet - ${who}` : 'embedded XMP packet', 'warn');
  }

  // Structural findings - what the document CARRIES and DOES, as opposed to what
  // it says about itself. Lazily imported so a caller that only wants Info/XMP
  // doesn't pay for the graph walkers, and defensive: a document too broken to
  // walk structurally must still return its metadata.
  try {
    const { scanPdfStructure } = await import('./pdf-structure.ts');
    findings.push(...scanPdfStructure(doc));
  } catch { /* structural scan unavailable - metadata findings still stand */ }

  return { findings };
}

// A pdf-lib Info dictionary as accessed by the duck-typing below.
type DictLike = { keys(): PDFNameType[]; delete(key: PDFNameType): void };

export async function stripPdf(bytes: Uint8Array): Promise<{ bytes: Uint8Array }> {
  const { PDFDocument, PDFName } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, PDF_LOAD_OPTS);

  // Remove every entry in the Info dictionary (Author, Producer, dates, …).
  const infoRef = doc.context.trailerInfo?.Info;
  if (infoRef) {
    let info: DictLike | null;
    try { info = doc.context.lookup(infoRef) as unknown as DictLike; } catch { info = null; }
    if (info && typeof info.keys === 'function' && typeof info.delete === 'function') {
      for (const key of [...info.keys()]) info.delete(key);
    }
  }
  // Remove the XMP metadata stream from the document catalog.
  try { doc.catalog.delete(PDFName.of('Metadata')); } catch { /* none present */ }

  const out = await doc.save({ updateFieldAppearances: false });
  return { bytes: out };
}

// ─── Compression ──────────────────────────────────────────────────────────────
// Shrinks a PDF where the bytes almost always are: oversized embedded JPEGs. Each
// qualifying image XObject is decoded on a canvas, downsampled and re-encoded, then
// swapped back IN PLACE; the document is re-saved with object streams. Text and
// vector graphics are never touched. No heavy WASM - pdf-lib (already here) plus the
// browser's own canvas. The node CLI has no canvas, so it does the structural pass
// only (object-stream re-save). The result is guaranteed never larger than the input.

interface CompressLevel {
  maxDim: number;
  quality: number;
}

const COMPRESS_LEVELS: Record<'light' | 'balanced' | 'strong', CompressLevel> = {
  light: { maxDim: 2200, quality: 0.82 },
  balanced: { maxDim: 1600, quality: 0.72 },
  strong: { maxDim: 1100, quality: 0.58 },
};
const MIN_IMAGE_BYTES = 12 * 1024; // re-encoding anything tinier isn't worth it

function clampNum(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

interface CompressParams {
  maxDim: number;
  quality: number;
  grayscale: boolean;
}

function compressParams(opts: PdfCompressOpts = {}): CompressParams {
  const base = COMPRESS_LEVELS[opts.level as keyof typeof COMPRESS_LEVELS] || COMPRESS_LEVELS.balanced;
  return {
    maxDim: clampNum(opts.maxDim, 200, 8000, base.maxDim),
    quality: clampNum(opts.imageQuality, 0.2, 0.95, base.quality),
    grayscale: Boolean(opts.grayscale),
  };
}

export type Canvas2D = HTMLCanvasElement | OffscreenCanvas;

// Can this shell decode + re-encode raster images? Needs a real browser canvas;
// the node CLI can't, so it skips the image pass and re-saves structurally only.
// Exported for pdf-redact.ts, which shares the same canvas prerequisites.
export function hasImageCodec(): boolean {
  return typeof createImageBitmap === 'function' &&
    (typeof OffscreenCanvas === 'function' ||
      (typeof document !== 'undefined' && !!document.createElement));
}

export function makeCanvas(w: number, h: number): Canvas2D {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export async function canvasToJpeg(canvas: Canvas2D, quality: number): Promise<Blob | null> {
  if (typeof (canvas as OffscreenCanvas).convertToBlob === 'function') {
    return (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality });
  }
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, 'image/jpeg', quality));
}

interface RecodedJpeg {
  bytes: Uint8Array;
  width: number;
  height: number;
}

// Decode an embedded JPEG, downsample to `maxDim`, re-encode as JPEG at `quality`.
// Returns { bytes, width, height } or null when it can't decode / can't help.
async function recodeJpeg(jpgBytes: Uint8Array, { maxDim, quality, grayscale }: CompressParams): Promise<RecodedJpeg | null> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([jpgBytes as BlobPart], { type: 'image/jpeg' }));
  } catch { return null; } // undecodable here (e.g. CMYK / JPEG2000) - leave it alone
  const iw = bmp.width, ih = bmp.height;
  if (!iw || !ih) { if (bmp.close) bmp.close(); return null; }
  const scale = Math.min(1, maxDim / Math.max(iw, ih));
  const nw = Math.max(1, Math.round(iw * scale));
  const nh = Math.max(1, Math.round(ih * scale));
  const canvas = makeCanvas(nw, nh);
  // Both canvas kinds return a 2D context with the members used here (filter,
  // drawImage); cast to HTMLCanvasElement only to pick a concrete getContext
  // overload - erased at runtime, so the OffscreenCanvas path is unaffected.
  const cx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!cx) { if (bmp.close) bmp.close(); return null; }
  if (grayscale && 'filter' in cx) cx.filter = 'grayscale(1)';
  cx.drawImage(bmp, 0, 0, nw, nh);
  if (bmp.close) bmp.close();
  let blob: Blob | null;
  try { blob = await canvasToJpeg(canvas, quality); } catch { return null; }
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: nw, height: nh };
}

// Direct-name colourspaces a canvas JPEG round-trips faithfully. Anything indirect,
// ICCBased, Indexed or CMYK is skipped (a browser canvas mis-decodes those).
function isSafeColorSpace(cs: unknown): boolean {
  const s = cs ? String(cs) : '';
  return s === '/DeviceRGB' || s === '/DeviceGray';
}

// A pdf-lib image XObject as accessed by the duck-typing below: a raw stream whose
// bytes live in `contents`, with a `dict` we read/write through get/set.
interface RawStreamLike {
  contents?: Uint8Array;
  dict?: {
    get(name: PDFNameType): unknown;
    set(name: PDFNameType, value: unknown): void;
  };
}

export async function compressPdf(bytes: Uint8Array, opts: PdfCompressOpts = {}): Promise<PdfCompressResult> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const before = input.length;
  const params = compressParams(opts);

  const { PDFDocument, PDFName, PDFNumber } = await import('pdf-lib');
  const doc = await PDFDocument.load(input, PDF_LOAD_OPTS);

  let images = 0;
  if (hasImageCodec()) {
    // First pass: an image used as a soft mask (/SMask) or image mask (/Mask) by
    // another image must NOT be recompressed - masks are DeviceGray, and a canvas
    // re-encode would force a 3-channel DeviceRGB JPEG, corrupting the transparency.
    // Collect those target refs ("N G R") so the main pass skips them.
    const maskRefs = new Set<string>();
    for (const [, obj] of doc.context.enumerateIndirectObjects() as unknown as Array<[unknown, RawStreamLike]>) {
      const d = obj?.dict;
      if (!d?.get) continue;
      for (const key of ['SMask', 'Mask']) {
        const ref = String(d.get(PDFName.of(key)) ?? '');
        if (/^\d+ \d+ R$/.test(ref)) maskRefs.add(ref); // a PDFRef; array (colour-key) /Mask ignored
      }
    }

    for (const [ref, obj] of doc.context.enumerateIndirectObjects() as unknown as Array<[unknown, RawStreamLike]>) {
      if (maskRefs.has(String(ref))) continue; // this image masks another - leave it alone
      // Image XObjects are raw streams; content streams, fonts, etc. are skipped.
      if (!(obj.contents instanceof Uint8Array)) continue;
      const dict = obj.dict;
      if (!dict?.get) continue;

      const sub = dict.get(PDFName.of('Subtype'));
      if (!sub || !String(sub).includes('Image')) continue;

      // Only baseline single-filter JPEGs (DCTDecode) in a plain RGB/Gray space, with
      // no soft mask, stencil mask or custom Decode array. Everything else (CMYK JPEG,
      // ICCBased/Indexed, JPX/JBIG2/CCITT, Flate rasters) a browser canvas decodes
      // wrong or not at all - so we leave those images untouched.
      const filter = dict.get(PDFName.of('Filter'));
      if (!filter || String(filter) !== '/DCTDecode') continue;
      if (!isSafeColorSpace(dict.get(PDFName.of('ColorSpace')))) continue;
      if (dict.get(PDFName.of('SMask'))) continue;
      const imageMask = dict.get(PDFName.of('ImageMask'));
      if (imageMask && String(imageMask) === 'true') continue;
      if (dict.get(PDFName.of('Decode'))) continue;

      const jpg = obj.contents!;
      if (jpg.length < MIN_IMAGE_BYTES) continue;

      let res: RecodedJpeg | null;
      try { res = await recodeJpeg(jpg, params); } catch { res = null; }
      if (!res || res.bytes.length >= jpg.length) continue; // keep original unless smaller

      // Swap the bytes IN PLACE on the same indirect object. pdf-lib never garbage
      // collects, so re-embedding under a new ref would orphan (and re-ship) the old
      // image; reusing the ref also updates every page that shares this image at once.
      obj.contents = res.bytes;
      dict.set(PDFName.of('Width'), PDFNumber.of(res.width));
      dict.set(PDFName.of('Height'), PDFNumber.of(res.height));
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      dict.set(PDFName.of('Length'), PDFNumber.of(res.bytes.length));
      images++;
    }
  }

  const out = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });

  // Hard guarantee: never hand back something larger than the input.
  if (out.length < before) return { bytes: out, before, after: out.length, images };
  return { bytes: input, before, after: before, images: 0 };
}

// ─── Page transforms + document signing primitives ──────────────────────────

/** A refusal whose wording remains useful when surfaced verbatim by a hook/CLI. */
function pdfRefusal(message: string): Error {
  const err = new Error(`pdf: ${message}`);
  err.name = 'PdfTransformError';
  return err;
}

async function loadEditablePdf(bytes: Uint8Array): Promise<PDFDocumentType> {
  const { PDFDocument } = await import('pdf-lib');
  let doc: PDFDocumentType;
  try {
    // Deliberately do not set ignoreEncryption. A protected input must not be
    // partially rewritten under the pretence that it was accepted.
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    if (/encrypt|password/i.test(message)) {
      throw pdfRefusal('this PDF is encrypted; unlock it with its password before using this utility');
    }
    throw error;
  }
  try {
    if (doc.getForm().hasXFA()) {
      throw pdfRefusal('XFA forms are not supported because rearranging or flattening them can lose form content');
    }
  } catch (error) {
    if ((error as Error)?.name === 'PdfTransformError') throw error;
    // A malformed AcroForm is not automatically XFA; pdf-lib will still preserve
    // its page objects. Do not turn a failed probe into a false XFA refusal.
  }
  return doc;
}

/**
 * Parse a 1-based page expression. Open-ended ranges are resolved against
 * `pageCount`; descending ranges are useful for reverse order (`5-1`).
 */
export function parsePdfPageExpression(expression: string | undefined, pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw pdfRefusal('the document has no pages');
  const source = String(expression ?? '').trim();
  if (!source) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: number[] = [];
  for (const raw of source.split(',')) {
    const token = raw.trim();
    if (!token) throw pdfRefusal(`invalid page expression "${source}"`);
    const single = /^(\d+)$/.exec(token);
    if (single) {
      const n = Number(single[1]);
      if (n < 1 || n > pageCount) throw pdfRefusal(`page ${n} is outside this ${pageCount}-page document`);
      out.push(n);
      continue;
    }
    const range = /^(\d+)-(\d*)$/.exec(token);
    if (!range) throw pdfRefusal(`invalid page range "${token}"; use values such as 1-3,7,10-`);
    const from = Number(range[1]);
    const to = range[2] ? Number(range[2]) : pageCount;
    if (from < 1 || from > pageCount || to < 1 || to > pageCount) {
      throw pdfRefusal(`range "${token}" is outside this ${pageCount}-page document`);
    }
    const step = from <= to ? 1 : -1;
    for (let n = from; ; n += step) {
      out.push(n);
      if (n === to) break;
    }
  }
  return out;
}

function splitPageGroups(expression: string | undefined, pageCount: number): number[][] {
  const source = String(expression ?? '').trim();
  if (!source) return Array.from({ length: pageCount }, (_, i) => [i + 1]);
  return source.split(',').map(part => parsePdfPageExpression(part.trim(), pageCount));
}

/** Copy the primary document's Info fields onto a newly-created page document. */
async function copyPdfInfo(source: PDFDocumentType, target: PDFDocumentType): Promise<void> {
  const copy = <T>(read: () => T | undefined, write: (value: T) => void): void => {
    try { const value = read(); if (value !== undefined) write(value); } catch { /* malformed source field */ }
  };
  copy(() => source.getTitle(), value => target.setTitle(value));
  copy(() => source.getAuthor(), value => target.setAuthor(value));
  copy(() => source.getSubject(), value => target.setSubject(value));
  copy(() => source.getCreator(), value => target.setCreator(value));
  copy(() => source.getProducer(), value => target.setProducer(value));
  copy(() => source.getCreationDate(), value => target.setCreationDate(value));
  copy(() => source.getModificationDate(), value => target.setModificationDate(value));
  copy(() => source.getKeywords(), value => target.setKeywords(value.split(/\s*,\s*/).filter(Boolean)));
  // pdf-lib's copyPages intentionally does not copy the catalog-level XMP
  // stream. Carry a readable XML packet explicitly; an opaque/compressed packet
  // is left alone rather than guessed at or rewritten as corrupt text.
  try {
    const { PDFName } = await import('pdf-lib');
    const xmp = readXmpText(source, PDFName);
    if (xmp && /^\s*(?:<\?xpacket|<x:xmpmeta|<rdf:RDF)/i.test(xmp)) {
      const stream = target.context.stream(new TextEncoder().encode(xmp), { Type: 'Metadata', Subtype: 'XML' });
      target.catalog.set(PDFName.of('Metadata'), target.context.register(stream));
    }
  } catch { /* no readable XMP packet */ }
}

export async function organizePdf(bytes: Uint8Array, opts: PdfOrganizeOpts): Promise<PdfOrganizeResult> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const operation = opts.operation;
  if (!['reorder', 'rotate', 'extract', 'delete', 'merge', 'split'].includes(operation)) {
    throw pdfRefusal(`unknown page operation "${String(operation)}"`);
  }
  const { PDFDocument, degrees } = await import('pdf-lib');
  let source = await loadEditablePdf(input);
  const extras = [
    ...(opts.extra?.length ? [opts.extra] : []),
    ...(opts.extras ?? []).filter((part) => part?.length),
  ];
  const beforeBytes = input.length + extras.reduce((sum, part) => sum + part.length, 0);

  // Multiple picked PDFs form one virtual document. Every operation then uses
  // the same global, 1-based page numbers that the Pages UI shows. copyPages
  // retains each page's own MediaBox, so portrait, landscape and custom sizes
  // can be freely interleaved without normalising or rasterising them.
  if (extras.length) {
    const combined = await PDFDocument.create();
    await copyPdfInfo(source, combined);
    for (const doc of [source, ...(await Promise.all(extras.map(loadEditablePdf)))]) {
      const copied = await combined.copyPages(doc, doc.getPageIndices());
      copied.forEach((page) => { combined.addPage(page); });
    }
    source = combined;
  }

  const beforePages = source.getPageCount();
  const selected = parsePdfPageExpression(opts.pages, beforePages);
  const save = (doc: PDFDocumentType) => doc.save({ useObjectStreams: true, updateFieldAppearances: false });

  if (operation === 'split') {
    const groups = splitPageGroups(opts.pages, beforePages);
    const files = [];
    let afterBytes = 0;
    for (const group of groups) {
      const doc = await PDFDocument.create();
      await copyPdfInfo(source, doc);
      const pages = await doc.copyPages(source, group.map(n => n - 1));
      pages.forEach((page) => { doc.addPage(page); });
      const part = await save(doc);
      files.push({ bytes: part, pages: group });
      afterBytes += part.length;
    }
    return {
      files, beforePages, afterPages: groups.reduce((n, g) => n + g.length, 0),
      beforeBytes, afterBytes,
      pageOrder: groups.flat(), operations: [`Split into ${files.length} PDF${files.length === 1 ? '' : 's'}`],
    };
  }

  if (operation === 'rotate') {
    const rotation = opts.rotation === 180 || opts.rotation === 270 ? opts.rotation : 90;
    for (const pageNo of new Set(selected)) {
      const page = source.getPage(pageNo - 1);
      const current = ((page.getRotation().angle % 360) + 360) % 360;
      page.setRotation(degrees((current + rotation) % 360));
    }
    const out = await save(source);
    return {
      bytes: out, beforePages, afterPages: beforePages, beforeBytes, afterBytes: out.length,
      pageOrder: Array.from({ length: beforePages }, (_, i) => i + 1),
      operations: [`Rotated ${new Set(selected).size} page${new Set(selected).size === 1 ? '' : 's'} by ${rotation}°`],
    };
  }

  if (operation === 'merge') {
    if (!extras.length) throw pdfRefusal('choose at least two PDFs to merge');
    const out = await save(source);
    return {
      bytes: out, beforePages, afterPages: source.getPageCount(), beforeBytes, afterBytes: out.length,
      pageOrder: Array.from({ length: beforePages }, (_, i) => i + 1),
      operations: [`Merged ${extras.length + 1} PDFs · ${beforePages} pages`],
    };
  }

  let order: number[];
  if (operation === 'delete') {
    const remove = new Set(selected);
    order = Array.from({ length: beforePages }, (_, i) => i + 1).filter(n => !remove.has(n));
    if (!order.length) throw pdfRefusal('delete would leave a document with no pages');
  } else {
    order = selected;
    if (!order.length) throw pdfRefusal(`${operation} selected no pages`);
    if (operation === 'reorder' && !String(opts.pages ?? '').trim()) {
      throw pdfRefusal('give the new page order, for example 3,1-2');
    }
  }

  const output = await PDFDocument.create();
  await copyPdfInfo(source, output);
  const copied = await output.copyPages(source, order.map(n => n - 1));
  copied.forEach((page) => { output.addPage(page); });
  const out = await save(output);
  const verb = operation === 'delete' ? `Deleted ${beforePages - order.length} page${beforePages - order.length === 1 ? '' : 's'}`
    : operation === 'extract' ? `Extracted ${order.length} page${order.length === 1 ? '' : 's'}`
      : `Reordered ${order.length} pages`;
  return {
    bytes: out, beforePages, afterPages: order.length, beforeBytes, afterBytes: out.length,
    pageOrder: order, operations: [verb],
  };
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function stampPdf(bytes: Uint8Array, opts: PdfStampOpts): Promise<PdfStampResult> {
  const doc = await loadEditablePdf(bytes);
  const { StandardFonts, rgb } = await import('pdf-lib');
  let stamps = 0;
  for (const mark of opts.images ?? []) {
    if (!Number.isInteger(mark.page) || mark.page < 1 || mark.page > doc.getPageCount()) {
      throw pdfRefusal(`signature page ${mark.page} is outside this ${doc.getPageCount()}-page document`);
    }
    const image = isPng(mark.bytes) ? await doc.embedPng(mark.bytes)
      : isJpeg(mark.bytes) ? await doc.embedJpg(mark.bytes)
        : null;
    if (!image) throw pdfRefusal('signature image must be PNG or JPEG');
    const page = doc.getPage(mark.page - 1);
    const requestedWidth = Math.max(0.1, Number(mark.width) || 1);
    const requestedHeight = Math.max(0.1, Number(mark.height) || requestedWidth * image.height / image.width);
    const scale = Math.min(1, page.getWidth() / requestedWidth, page.getHeight() / requestedHeight);
    const width = requestedWidth * scale, height = requestedHeight * scale;
    const x = Math.max(0, Math.min(page.getWidth() - width, Number(mark.x) || 0));
    const top = Math.max(0, Math.min(page.getHeight() - height, Number(mark.y) || 0));
    page.drawImage(image, { x, y: page.getHeight() - top - height, width, height });
    stamps++;
  }
  if (opts.texts?.length) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const mark of opts.texts) {
      if (!Number.isInteger(mark.page) || mark.page < 1 || mark.page > doc.getPageCount()) {
        throw pdfRefusal(`text page ${mark.page} is outside this ${doc.getPageCount()}-page document`);
      }
      const page = doc.getPage(mark.page - 1);
      const size = Math.max(0.1, Math.min(72, Number(mark.size) || 10));
      page.drawText(String(mark.text || '').slice(0, 256), {
        x: Math.max(0, Number(mark.x) || 0),
        y: Math.max(0, page.getHeight() - (Number(mark.y) || 0) - size),
        size, font, color: rgb(0.08, 0.08, 0.08),
      });
      stamps++;
    }
  }
  // A visual signature must not leave editable field appearances floating over
  // the stamped page. XFA was refused above; AcroForm fields can be flattened.
  try { doc.getForm().flatten(); } catch { /* no AcroForm, or already flat */ }
  const out = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
  return { bytes: out, pages: doc.getPageCount(), stamps };
}

export async function lockPdf(bytes: Uint8Array, password: string): Promise<{ bytes: Uint8Array }> {
  if (!password) throw pdfRefusal('a non-empty open password is required');
  const { PDFDocument, PDFString, PDFHexString, PDFRawStream, PDFStream, PDFDict, PDFArray } =
    await import('pdf-lib') as any;
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const ctx = doc.context;
  const rnd = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));
  const hex = (b: Uint8Array): string => [...b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  const P = -4;
  const fileKey = rnd(32);
  const vals = await buildEncryptDictValues({
    userPw: preparePassword(password), ownerPw: preparePassword(password), fileKey,
    salts: { uvs: rnd(8), uks: rnd(8), ovs: rnd(8), oks: rnd(8) },
    permsRandom: rnd(4), P, encryptMetadata: true,
  });
  const id = PDFArray.withContext(ctx);
  id.push(PDFHexString.of(hex(rnd(16)))); id.push(PDFHexString.of(hex(rnd(16))));
  const enc = ctx.obj({
    Filter: 'Standard', V: 5, R: 6, Length: 256, P,
    U: PDFHexString.of(hex(vals.U)), O: PDFHexString.of(hex(vals.O)),
    UE: PDFHexString.of(hex(vals.UE)), OE: PDFHexString.of(hex(vals.OE)),
    Perms: PDFHexString.of(hex(vals.Perms)),
    CF: { StdCF: { CFM: 'AESV3', AuthEvent: 'DocOpen', Length: 32 } },
    StmF: 'StdCF', StrF: 'StdCF', EncryptMetadata: true,
  });
  const encString = async (value: any): Promise<any> =>
    PDFHexString.of(hex(await encryptObjectBytes(fileKey, rnd(16), value.asBytes())));
  const walk = async (value: any): Promise<void> => {
    if (value instanceof PDFDict) {
      for (const [key, child] of value.entries()) {
        if (child instanceof PDFString || child instanceof PDFHexString) value.set(key, await encString(child));
        else if (child instanceof PDFDict || child instanceof PDFArray) await walk(child);
      }
    } else if (value instanceof PDFArray) {
      for (let i = 0; i < value.size(); i++) {
        const child = value.get(i);
        if (child instanceof PDFString || child instanceof PDFHexString) value.set(i, await encString(child));
        else if (child instanceof PDFDict || child instanceof PDFArray) await walk(child);
      }
    }
  };
  for (const [ref, value] of ctx.enumerateIndirectObjects()) {
    if (value instanceof PDFStream) {
      const encrypted = await encryptObjectBytes(fileKey, rnd(16), new Uint8Array(value.getContents()));
      await walk(value.dict);
      ctx.assign(ref, PDFRawStream.of(value.dict, encrypted));
    } else if (value instanceof PDFDict || value instanceof PDFArray) await walk(value);
    else if (value instanceof PDFString || value instanceof PDFHexString) ctx.assign(ref, await encString(value));
  }
  ctx.trailerInfo.Encrypt = ctx.register(enc);
  ctx.trailerInfo.ID = id;
  return { bytes: await doc.save({ useObjectStreams: false }) };
}

export function createPdfAPI(): PdfAPI {
  return {
    analyze: (bytes) => analyzePdf(bytes),
    strip: (bytes) => stripPdf(bytes),
    compress: (bytes, opts) => compressPdf(bytes, opts),
    organize: (bytes, opts) => organizePdf(bytes, opts),
    stamp: (bytes, opts) => stampPdf(bytes, opts),
    lock: (bytes, password) => lockPdf(bytes, password),
    // redact (v1.85) is NOT provided here, deliberately: its implementation
    // (pdf-redact.ts) reaches the views/pdf-import renderer and a real canvas,
    // neither of which the node CLI - which imports this same factory - has.
    // The web bridge index wires it in from pdf-redact.ts; on the CLI the
    // method is simply absent, which is exactly what hooks feature-detect
    // (`typeof host.pdf?.redact === 'function'`).
  };
}
