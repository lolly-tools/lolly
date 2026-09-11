// SPDX-License-Identifier: MPL-2.0
/** File conversion codecs shared by the workbench and library entry points. */
import { sfntKind, convertFontContainer, imageDimensions, sniffAnimatedRaster, parseDimension, toCssPx, gzip, gunzip, sniffContainer, encodeBmp, packTiff, joinPageText } from '@lolly/engine';
import { DEFAULT_IMAGE_OPTIONS, resizedDimensions, type ImageConversionOptions } from './file-conversion.ts';
import { sourceToGrid, gridToTarget } from '@lolly/engine';
import { convertImageInWorker } from './image-convert-worker.ts';
export interface Target { id: string; label: string; ext: string; mime: string; render?: boolean; }

// The raster matrix the shell export bridge (host.export.render) produces from a
// rasterised source - the "amazing rendering engine" reused here so a converted file
// reaches the whole matrix, not just its sibling container. Both an SVG and a raster
// source rasterise to a <canvas> first (sourceToCanvas), then ride this path; the
// engine owns the per-format encoders (png/jpg/webp/avif/tiff/bmp) plus the pdf/ico
// wrappers. `render:true` routes through the bounded canvas encoder below.
const R = (id: string, label: string, ext: string, mime: string): Target => ({ id, label, ext, mime, render: true });
const RASTER_OUT: Target[] = [
  R('png', 'PNG (.png)', 'png', 'image/png'),
  R('jpeg', 'JPEG (.jpg)', 'jpg', 'image/jpeg'),
  R('webp', 'WebP (.webp)', 'webp', 'image/webp'),
  R('avif', 'AVIF (.avif)', 'avif', 'image/avif'),
  R('tiff', 'TIFF (.tiff)', 'tiff', 'image/tiff'),
  R('bmp', 'BMP (.bmp)', 'bmp', 'image/bmp'),
  R('pdf', 'PDF (.pdf)', 'pdf', 'application/pdf'),
  R('ico', 'Icon (.ico)', 'ico', 'image/x-icon'),
];

/** The on-device targets each source kind can produce (the source format is filtered out by the caller). */
export function targetsFor(kind: string): Target[] {
  switch (kind) {
    case 'ttf': case 'otf': case 'woff':
      return [
        { id: 'ttf', label: 'TrueType (.ttf)', ext: 'ttf', mime: 'font/ttf' },
        { id: 'otf', label: 'OpenType (.otf)', ext: 'otf', mime: 'font/otf' },
        { id: 'woff', label: 'Web font (.woff)', ext: 'woff', mime: 'font/woff' },
      ];
    // An SVG reaches its compressed sibling AND the whole raster matrix (the engine
    // rasterises it at its intrinsic size). We do NOT offer vector→vector transcoding
    // (svg→eps/dxf/emf/wmf): the engine's vector writers walk a rendered tool canvas,
    // not arbitrary source SVG, so those would misconvert - a follow-on (plans/84).
    case 'svg': case 'svgz':
      return [
        kind === 'svg'
          ? { id: 'svgz', label: 'Compressed SVG (.svgz)', ext: 'svgz', mime: 'image/svg+xml' }
          : { id: 'svg', label: 'SVG (.svg)', ext: 'svg', mime: 'image/svg+xml' },
        ...RASTER_OUT,
      ];
    // A raster can re-encode to any raster + wrap into PDF/ICO, but cannot become true vector.
    case 'raster': return RASTER_OUT;
    // Tabular data - every data format converts to every other (grid round-trip). The
    // caller drops the source format. An .xlsx converts from its FIRST sheet.
    case 'xlsx': case 'csv': case 'tsv': case 'json':
      return DATA_OUT;
    // Documents give up their CONTENT as Markdown (plans/139): a deck through the
    // engine's read-model → deck-studio dialect, a Word file through docx-read, a
    // PDF through its text layer. Lossy by design - this is the re-flow path, not
    // the keep-the-design one (host.pptx.rebrand owns that).
    case 'pdf':
      return [MD_OUT, { id: 'pdf-clean', label: 'PDF · remove descriptive metadata', ext: 'pdf', mime: 'application/pdf' }, { id: 'pdf-optimize', label: 'PDF · structural compression', ext: 'pdf', mime: 'application/pdf' }];
    case 'pptx': case 'docx':
      return [MD_OUT];
    default: return [];
  }
}

/** Markdown out. A deck/document carrying images downloads as a zip instead (the
 *  markdown at the root plus its `media/` files) - see markdownDownload. */
const MD_OUT: Target = { id: 'md', label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown' };

/** Pages read for a pdf → markdown conversion (a 500-page manual must not queue
 *  500 page interpretations from one drop). */
const MAX_PDF_PAGES = 200;

/** The data-conversion targets (grid round-trip). */
const DATA_OUT: Target[] = [
  { id: 'csv', label: 'CSV (.csv)', ext: 'csv', mime: 'text/csv' },
  { id: 'xlsx', label: 'Excel (.xlsx)', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { id: 'json', label: 'JSON (.json)', ext: 'json', mime: 'application/json' },
  { id: 'tsv', label: 'TSV (.tsv)', ext: 'tsv', mime: 'text/tab-separated-values' },
];

export function detectKind(bytes: Uint8Array, file: File): string {
  const k = sfntKind(bytes);
  if (k) return k;                                          // ttf/otf/woff/woff2
  // Tabular data - an .xlsx is a zip (workbook inside), csv/tsv/json are text. Checked
  // before svgz/raster: an .xlsx's PK-zip and a .json's braces must not fall through.
  if (/\.xlsx$/i.test(file.name)
    || (sniffContainer(bytes) === 'zip' && /application\/vnd\.openxmlformats-officedocument\.spreadsheetml/.test(file.type))) return 'xlsx';
  // The other two OOXML packages, by the same declared-name-first rule. A file whose
  // name says nothing is sniffed from its part map instead - see sniffOfficeZip.
  if (/\.pptx$/i.test(file.name) || /officedocument\.presentationml/.test(file.type)) return 'pptx';
  if (/\.docx$/i.test(file.name) || /officedocument\.wordprocessingml/.test(file.type)) return 'docx';
  if (/\.tsv$/i.test(file.name)) return 'tsv';
  if (sniffContainer(bytes) === 'gzip' || /\.svgz$/i.test(file.name)) return 'svgz';
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 256));
  if (head.startsWith('%PDF-') || /\.pdf$/i.test(file.name) || file.type === 'application/pdf') return 'pdf';
  if (/<svg[\s>]/i.test(head) || /^\s*<\?xml/.test(head) || /\.svg$/i.test(file.name)) return 'svg';
  if (/\.csv$/i.test(file.name) || /^text\/csv/.test(file.type)) return 'csv';
  if (/\.json$/i.test(file.name) || (/^application\/json/.test(file.type) && /^\s*[[{]/.test(head))) return 'json';
  if (/^image\//.test(file.type) || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name)) return 'raster';
  // A video for the AV column. The kind is a coarse gate; the real capability check is
  // probeVideo (mediabunny), which refuses anything the copy engines cannot read.
  if (/^video\//.test(file.type) || /\.(mp4|m4v|mov|qt|mkv|webm)$/i.test(file.name)) return 'video';
  return 'unknown';
}

/** An unnamed zip: the PART MAP says which office package it is, so ask the engine's
 *  own sniffers over a capped unzip. 'unknown' for any other archive. */
export async function sniffOfficeZip(bytes: Uint8Array): Promise<string> {
  try {
    const [{ inflatePptx }, { isPptx, isDocx }] = await Promise.all([
      import('../bridge/pptx.ts'),
      import('@lolly/engine'),
    ]);
    const parts = await inflatePptx(bytes);
    if (isPptx(parts)) return 'pptx';
    if (isDocx(parts)) return 'docx';
  } catch { /* unreadable or over the caps - not a package we convert */ }
  return 'unknown';
}

export async function convert(bytes: Uint8Array, kind: string, target: Target, file: File, options = DEFAULT_IMAGE_OPTIONS, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  // Fonts - a pure container swap (engine codecs), never a render.
  if (kind === 'ttf' || kind === 'otf' || kind === 'woff') {
    return new Blob([convertFontContainer(bytes, target.id) as BlobPart], { type: target.mime });
  }
  // SVG⇄SVGZ - exact-byte gzip, no render (keeps the credential + outlined text intact).
  if (kind === 'svg' && target.id === 'svgz') return new Blob([gzip(bytes) as BlobPart], { type: target.mime });
  if (kind === 'svgz' && target.id === 'svg') return new Blob([gunzip(bytes) as BlobPart], { type: target.mime });
  // Tabular data - decode the source to a ragged grid (row 0 = header), re-encode to
  // the target. Pure byte/text work, no canvas. An .xlsx reads its first sheet.
  if (kind === 'xlsx' || kind === 'csv' || kind === 'tsv' || kind === 'json') {
    const grid = sourceToGrid(kind, bytes);
    return new Blob([gridToTarget(grid, target.id) as BlobPart], { type: target.mime });
  }
  // Documents → Markdown. The office packages go through the shared extractor (lazy:
  // it pulls fflate + the engine readers); a document that carried images comes back
  // as a zip of the markdown plus its media/ files, which the caller names .zip.
  if (kind === 'pptx' || kind === 'docx') {
    const { officeToMarkdown, markdownDownload } = await import('../lib/office-text.ts');
    const content = await officeToMarkdown(bytes, file.name);
    return markdownDownload(content, kind === 'pptx' ? 'deck.md' : 'doc.md');
  }
  // A PDF's text layer, page by page, through the SAME engine emitter the Unpack
  // view's "Markdown" download uses. pdf-import pulls pdf-lib in at module scope, so
  // it is imported here and nowhere else in this view.
  if (kind === 'pdf') {
    if (target.id === 'pdf-clean' || target.id === 'pdf-optimize') {
      const { runPdfFileOperation } = await import('../../../../packages/node-shell/src/pdf-file-operation.ts');
      return new Blob([await runPdfFileOperation(bytes, target.id, signal) as BlobPart], { type: 'application/pdf' });
    }
    const { openPdfFile } = await import('../views/pdf-import.ts');
    const handle = await openPdfFile(file);
    const toText = handle.pageToText;
    if (!toText) throw new Error('That PDF has no readable text layer.');
    if (handle.pageCount > MAX_PDF_PAGES) throw new Error('This converter reads up to 200 PDF pages. Split the document first; no pages have been silently dropped.');
    const count = handle.pageCount;
    const pages = Array.from({ length: count }, (_, i) => toText.call(handle, i));
    return new Blob([joinPageText(pages, { markdown: true })], { type: target.mime });
  }
  // Everything else: rasterise the source to a canvas, then encode that canvas straight
  // to the target with the engine's own codecs. We hold the pixels already, so there is
  // no reason to DOM-serialise them back through the tool-export path (dom-to-image
  // stalls on a detached node anyway) - this is faster and never hangs.
  if (target.render) {
    if (sniffAnimatedRaster(bytes, { name: file.name, mime: file.type })) throw new Error('This is an animated image. Still-image conversion would lose its animation, so it has not been converted.');
    if (kind === 'raster' && ['png', 'jpeg', 'webp', 'avif'].includes(target.id) && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
      const dimensions = imageDimensions(bytes, file.type);
      if (dimensions) resizedDimensions(dimensions.w, dimensions.h, options.maxEdge);
      return convertImageInWorker(file, target.mime, options, signal);
    }
    if (options.targetBytes) throw new Error('Target-size optimization requires a still JPEG, PNG, WebP or AVIF input and an available background image encoder.');
    const canvas = await sourceToCanvas(kind, bytes, file, options, target.id === 'jpeg');
    try { return await encodeFromCanvas(canvas, target, options.quality); }
    finally { canvas.width = canvas.height = 1; }
  }
  throw new Error('That conversion is not supported.');
}

// ── tabular data conversion (grid round-trip) ────────────────────────────────

/** Decode a data source to a ragged grid (row 0 = header). xlsx→first sheet;
 *  csv/tsv→parseTableText; json→array-of-objects (keys become the header) or
 *  array-of-arrays. Throws a user-ready message on an unreadable source. Exported
 *  for the co-located round-trip test. */
export { sourceToGrid, gridToTarget } from '@lolly/engine';

/** Decode the source (SVG markup or a raster file) into a <canvas> at its intrinsic
 *  size. A canvas is a node the export bridge rasterises reliably - passing a bare
 *  <svg>/<img> root to dom-to-image can hang on its foreignObject image load. */
async function sourceToCanvas(kind: string, bytes: Uint8Array, file: File, options: ImageConversionOptions, flatten: boolean): Promise<HTMLCanvasElement> {
  const isSvg = kind === 'svg' || kind === 'svgz';
  const raw = kind === 'svgz' ? gunzip(bytes) : bytes;
  const mime = isSvg ? 'image/svg+xml' : (file.type || 'image/png');
  // Intrinsic size - an SVG may lack width/height, so fall back to its viewBox, then a
  // square default. A raster's natural size is authoritative.
  let width = 512, height = 512;
  const dimensions = !isSvg ? imageDimensions(bytes, mime) : null;
  if (dimensions) resizedDimensions(dimensions.w, dimensions.h);
  if (isSvg) {
    const svg = new DOMParser().parseFromString(new TextDecoder().decode(raw), 'image/svg+xml').documentElement;
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
    const physicalWidth = parseDimension(svg.getAttribute('width'));
    const physicalHeight = parseDimension(svg.getAttribute('height'));
    width = physicalWidth ? toCssPx(physicalWidth) : (vb.length === 4 ? vb[2]! : 0) || 512;
    height = physicalHeight ? toCssPx(physicalHeight) : (vb.length === 4 ? vb[3]! : 0) || 512;
    resizedDimensions(width, height);
  }
  const objUrl = URL.createObjectURL(new Blob([raw as BlobPart], { type: mime }));
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Could not decode that file.'));
      im.src = objUrl;
    });
    if (!isSvg) { width = img.naturalWidth || width; height = img.naturalHeight || height; }
    const canvas = document.createElement('canvas');
    const size = resizedDimensions(width, height, options.maxEdge);
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get a canvas to render onto.');
    ctx.imageSmoothingQuality = 'high';
    if (flatten) { ctx.fillStyle = options.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

/** Encode a rasterised canvas straight to the target format. png/jpeg/webp/avif ride
 *  the browser's own `canvas.toBlob`; bmp/tiff use the engine writers on the raw RGBA;
 *  pdf wraps the image (jsPDF); ico wraps a ≤256px PNG. */
async function encodeFromCanvas(canvas: HTMLCanvasElement, target: Target, quality = 0.92): Promise<Blob> {
  switch (target.id) {
    case 'png':  return canvasBlob(canvas, 'image/png');
    case 'jpeg': return canvasBlob(canvas, 'image/jpeg', quality);
    case 'webp': return canvasBlob(canvas, 'image/webp', quality);
    case 'avif': return canvasBlob(canvas, 'image/avif', quality);
    case 'bmp':  return new Blob([encodeBmp(rgbaOf(canvas), canvas.width, canvas.height) as BlobPart], { type: 'image/bmp' });
    case 'tiff': return new Blob([packTiff(rgbaOf(canvas), { width: canvas.width, height: canvas.height, samplesPerPixel: 4, dpi: 96 }) as BlobPart], { type: 'image/tiff' });
    case 'pdf':  return imageToPdf(canvas);
    case 'ico':  return canvasToIco(canvas);
    default:     throw new Error('That conversion is not supported.');
  }
}

/** The canvas's interleaved top-down RGBA, as a plain Uint8Array the engine writers take. */
function rgbaOf(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read the rendered pixels.');
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
}

/** Promise wrapper over canvas.toBlob. When the browser can't encode the requested
 *  type it doesn't return null - the HTML spec makes it silently fall back to PNG - so
 *  we compare the RESULTING type and reject a mismatch rather than hand back a PNG
 *  wearing an .avif name (e.g. AVIF encode on an engine that lacks it). */
function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b && b.size > 0 && b.type === mime)
        ? resolve(b)
        : reject(new Error(`This browser can’t encode ${mime.replace('image/', '').toUpperCase()}.`)),
      mime, quality,
    );
  });
}

/** One image, one page, sized to the pixels (points). PNG so transparency survives. */
async function imageToPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: [canvas.width, canvas.height], orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pw, ph);
  return doc.output('blob');
}

/** ICO wrapping a PNG payload (modern icons allow PNG), downscaled to ≤256px. */
async function canvasToIco(canvas: HTMLCanvasElement): Promise<Blob> {
  const long = Math.max(canvas.width, canvas.height);
  const scale = Math.min(1, 256 / long);
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d')?.drawImage(canvas, 0, 0, w, h);
  const png = new Uint8Array(await (await canvasBlob(c, 'image/png')).arrayBuffer());
  const out = new Uint8Array(22 + png.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(2, 1, true);              // type: icon
  dv.setUint16(4, 1, true);              // one image
  out[6] = w >= 256 ? 0 : w;             // width  (0 encodes 256)
  out[7] = h >= 256 ? 0 : h;             // height
  dv.setUint16(10, 1, true);             // colour planes
  dv.setUint16(12, 32, true);            // bits per pixel
  dv.setUint32(14, png.length, true);    // payload size
  dv.setUint32(18, 22, true);            // payload offset
  out.set(png, 22);
  return new Blob([out as BlobPart], { type: 'image/x-icon' });
}
