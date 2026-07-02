// SPDX-License-Identifier: MPL-2.0
/**
 * PDF capability (host.pdf) — metadata inspection + removal, backed by pdf-lib.
 *
 * Unlike the JPEG/PNG/SVG strippers (dependency-free byte/text surgery that runs
 * inside the sandboxed tool hook), a PDF is a cross-referenced object graph with
 * an xref table and compressed object streams — you can't excise a metadata
 * object without rewriting offsets. So the work lives here in the shell, where a
 * real PDF library is available, and the tool reaches it through `host.pdf`.
 *
 * IMPORTANT: this RE-SAVES the document (pdf-lib re-serialises), so the result is
 * not byte-for-byte and any digital signature is invalidated — the tool's UI says
 * so. Everything runs locally in the browser; nothing is uploaded.
 *
 * pdf-lib is loaded on demand (dynamic import) so it never adds to startup cost —
 * only the first PDF a user opens pulls it in.
 */
import type {
  PDFDict as PDFDictType,
  PDFDocument as PDFDocumentType,
  PDFName as PDFNameType,
  PDFRawStream as PDFRawStreamType,
  PDFStream as PDFStreamType,
} from 'pdf-lib';
import type { PdfAPI, PdfCompressOpts, PdfCompressResult, PdfFinding } from '../../../../engine/src/bridge/host-v1.ts';

const PDF_LOAD_OPTS = { ignoreEncryption: true, updateMetadata: false };

// Info-dictionary keys we report + remove. These are the standard document-info
// entries; PDF/X and tooling sometimes add more, but these cover the leaks.
interface InfoField {
  label: string;
  tone: PdfFinding['tone'];
  get(d: PDFDocumentType): string | string[] | undefined;
}

const INFO_FIELDS: InfoField[] = [
  { label: 'Author', tone: 'warn', get: (d) => d.getAuthor() },
  { label: 'Created with', tone: 'warn', get: (d) => d.getCreator() },   // authoring app
  { label: 'PDF producer', tone: 'warn', get: (d) => d.getProducer() }, // producing app/lib
  { label: 'Title', tone: '', get: (d) => d.getTitle() },
  { label: 'Subject', tone: '', get: (d) => d.getSubject() },
  { label: 'Keywords', tone: '', get: (d) => d.getKeywords() },
];

function isoDate(d: Date | undefined): string | null {
  try { return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null; }
  catch { return null; }
}

// Read the catalog's XMP metadata stream as text, if present. Best-effort: the
// stream is usually an uncompressed XML packet; if it's compressed/odd we still
// detect its presence, we just can't quote from it.
function readXmpText(doc: PDFDocumentType, PDFName: typeof PDFNameType, PDFStream: typeof PDFStreamType): string | null {
  const ref = doc.catalog.get(PDFName.of('Metadata'));
  if (!ref) return null;
  let stream;
  try { stream = doc.context.lookup(ref); } catch { return ''; }
  if (!stream) return '';
  try {
    const bytes = stream instanceof PDFStream ? stream.getContents() : null;
    return bytes ? new TextDecoder('utf-8').decode(bytes) : '';
  } catch { return ''; }
}

function xmpField(xmp: string, re: RegExp): string | null {
  const m = re.exec(xmp);
  return m ? (m[1] ?? '').replace(/\s+/g, ' ').trim() : null;
}

export async function analyzePdf(bytes: Uint8Array): Promise<{ findings: PdfFinding[] }> {
  const { PDFDocument, PDFName, PDFStream } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, PDF_LOAD_OPTS);
  const findings: PdfFinding[] = [];
  const add = (label: string, detail: string | string[] | null | undefined, tone: PdfFinding['tone'] = '') => {
    const d = detail == null ? '' : String(detail).trim();
    if (d) findings.push({ label, detail: d, tone });
  };

  for (const f of INFO_FIELDS) {
    let v: string | string[] | undefined;
    try { v = f.get(doc); } catch { v = undefined; }
    add(f.label, Array.isArray(v) ? v.join(', ') : v, f.tone);
  }
  try { add('Created', isoDate(doc.getCreationDate())); } catch { /* malformed date */ }
  try { add('Modified', isoDate(doc.getModificationDate())); } catch { /* malformed date */ }

  const xmp = readXmpText(doc, PDFName, PDFStream);
  if (xmp != null) {
    const who = xmpField(xmp, /<dc:creator>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i)
      || xmpField(xmp, /<xmp:CreatorTool>([\s\S]*?)<\/xmp:CreatorTool>/i);
    add('XMP metadata', who ? `XMP packet — ${who}` : 'embedded XMP packet', 'warn');
  }
  return { findings };
}

export async function stripPdf(bytes: Uint8Array): Promise<{ bytes: Uint8Array }> {
  const { PDFDocument, PDFName, PDFDict } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, PDF_LOAD_OPTS);

  // Remove every entry in the Info dictionary (Author, Producer, dates, …).
  const infoRef = doc.context.trailerInfo.Info;
  if (infoRef) {
    let info: PDFDictType | null = null;
    try { info = doc.context.lookup(infoRef, PDFDict); } catch { info = null; }
    if (info) {
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
// vector graphics are never touched. No heavy WASM — pdf-lib (already here) plus the
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
  return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

interface CompressParams {
  maxDim: number;
  quality: number;
  grayscale: boolean;
}

function compressParams(opts: PdfCompressOpts): CompressParams {
  const base = COMPRESS_LEVELS[opts.level ?? 'balanced'] ?? COMPRESS_LEVELS.balanced;
  return {
    maxDim: clampNum(opts.maxDim, 200, 8000, base.maxDim),
    quality: clampNum(opts.imageQuality, 0.2, 0.95, base.quality),
    grayscale: Boolean(opts.grayscale),
  };
}

type Canvas2D = HTMLCanvasElement | OffscreenCanvas;

// Can this shell decode + re-encode raster images? Needs a real browser canvas;
// the node CLI can't, so it skips the image pass and re-saves structurally only.
function hasImageCodec(): boolean {
  return typeof createImageBitmap === 'function' &&
    (typeof OffscreenCanvas === 'function' ||
      (typeof document !== 'undefined' && !!document.createElement));
}

function makeCanvas(w: number, h: number): Canvas2D {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

async function canvasToJpeg(canvas: Canvas2D, quality: number): Promise<Blob | null> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
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
    bmp = await createImageBitmap(new Blob([new Uint8Array(jpgBytes)], { type: 'image/jpeg' }));
  } catch { return null; } // undecodable here (e.g. CMYK / JPEG2000) — leave it alone
  const iw = bmp.width, ih = bmp.height;
  if (!iw || !ih) { bmp.close(); return null; }
  const scale = Math.min(1, maxDim / Math.max(iw, ih));
  const nw = Math.max(1, Math.round(iw * scale));
  const nh = Math.max(1, Math.round(ih * scale));
  const canvas = makeCanvas(nw, nh);
  const cx = canvas.getContext('2d');
  if (!cx) { bmp.close(); return null; }
  if (grayscale && 'filter' in cx) cx.filter = 'grayscale(1)';
  cx.drawImage(bmp, 0, 0, nw, nh);
  bmp.close();
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

// pdf-lib types `contents` readonly (mutation isn't part of its public API), but
// swapping the bytes of an existing stream object in place — rather than
// registering a new one — is exactly how this pass avoids orphaning the old
// image (see the comment at the call site). Object.assign performs the same
// runtime mutation pdf-lib itself does internally, without a type-widening cast.
function setStreamContents(obj: PDFRawStreamType, bytes: Uint8Array): void {
  Object.assign(obj, { contents: bytes });
}

export async function compressPdf(bytes: Uint8Array, opts: PdfCompressOpts = {}): Promise<PdfCompressResult> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const before = input.length;
  const params = compressParams(opts);

  const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = await import('pdf-lib');
  const doc = await PDFDocument.load(input, PDF_LOAD_OPTS);

  let images = 0;
  if (hasImageCodec()) {
    // First pass: an image used as a soft mask (/SMask) or image mask (/Mask) by
    // another image must NOT be recompressed — masks are DeviceGray, and a canvas
    // re-encode would force a 3-channel DeviceRGB JPEG, corrupting the transparency.
    // Collect those target refs ("N G R") so the main pass skips them.
    const maskRefs = new Set<string>();
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const d = obj.dict;
      for (const key of ['SMask', 'Mask']) {
        const ref = String(d.get(PDFName.of(key)) ?? '');
        if (/^\d+ \d+ R$/.test(ref)) maskRefs.add(ref); // a PDFRef; array (colour-key) /Mask ignored
      }
    }

    for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
      if (maskRefs.has(String(ref))) continue; // this image masks another — leave it alone
      // Image XObjects are raw streams; content streams, fonts, etc. are skipped.
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;

      const sub = dict.get(PDFName.of('Subtype'));
      if (!sub || !String(sub).includes('Image')) continue;

      // Only baseline single-filter JPEGs (DCTDecode) in a plain RGB/Gray space, with
      // no soft mask, stencil mask or custom Decode array. Everything else (CMYK JPEG,
      // ICCBased/Indexed, JPX/JBIG2/CCITT, Flate rasters) a browser canvas decodes
      // wrong or not at all — so we leave those images untouched.
      const filter = dict.get(PDFName.of('Filter'));
      if (!filter || String(filter) !== '/DCTDecode') continue;
      if (!isSafeColorSpace(dict.get(PDFName.of('ColorSpace')))) continue;
      if (dict.get(PDFName.of('SMask'))) continue;
      const imageMask = dict.get(PDFName.of('ImageMask'));
      if (imageMask && String(imageMask) === 'true') continue;
      if (dict.get(PDFName.of('Decode'))) continue;

      const jpg = obj.contents;
      if (jpg.length < MIN_IMAGE_BYTES) continue;

      let res: RecodedJpeg | null;
      try { res = await recodeJpeg(jpg, params); } catch { res = null; }
      if (!res || res.bytes.length >= jpg.length) continue; // keep original unless smaller

      // Swap the bytes IN PLACE on the same indirect object. pdf-lib never garbage
      // collects, so re-embedding under a new ref would orphan (and re-ship) the old
      // image; reusing the ref also updates every page that shares this image at once.
      setStreamContents(obj, res.bytes);
      dict.set(PDFName.of('Width'), PDFNumber.of(res.width));
      dict.set(PDFName.of('Height'), PDFNumber.of(res.height));
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      dict.set(PDFName.of('Length'), PDFNumber.of(res.bytes.length));
      images++;
    }
  }

  // A light, non-identifying tool credit. The original author/title are left as-is —
  // metadata scrubbing is the Strip Hidden Data tool's job, not this one's. Producer
  // gets overwritten by any re-saver anyway; this just makes it a clean value.
  try {
    doc.setProducer('Lolly');
    doc.setCreator('lolly.tools');
    doc.setSubject('Compressed with lolly.tools');
  } catch { /* setters are best-effort */ }

  const out = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });

  // Hard guarantee: never hand back something larger than the input.
  if (out.length < before) return { bytes: out, before, after: out.length, images };
  return { bytes: input, before, after: before, images: 0 };
}

export function createPdfAPI(): PdfAPI {
  return {
    analyze: (bytes) => analyzePdf(bytes),
    strip: (bytes) => stripPdf(bytes),
    compress: (bytes, opts) => compressPdf(bytes, opts ?? {}),
  };
}
