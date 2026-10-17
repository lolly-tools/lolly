// SPDX-License-Identifier: MPL-2.0
/**
 * Images to PDF (host.pdf.fromImages): one image per page, never rasterised.
 *
 * A JPEG keeps its own DCT data, so its pixels are not re-encoded. The file is
 * rebuilt from the segments the engine's bounded walker (jpeg-segments.ts)
 * reports, keeping what a decoder needs (JFIF, the ICC
 * profile, the Adobe colour transform, tables, frame and scans) and leaving out
 * Exif, XMP, IPTC, comments, C2PA and anything stored after the main image
 * (gain maps, depth maps, MPF previews). A PDF reader ignores those, and they
 * can carry a location or a device serial. The camera orientation from the Exif
 * block becomes the image's placement matrix, so a portrait phone photo is
 * upright on its page.
 *
 * A PNG goes through pdf-lib's embedPng, which copies the decoded pixels
 * losslessly (alpha becomes a soft mask). Other formats are refused: the Pages
 * tool converts them with host.images first.
 */
import type { PDFDocument as PDFDocumentType, PDFImage } from 'pdf-lib';
import type { PdfImageInput, PdfImagePageSize, PdfImagesOpts, PdfImagesResult } from '@lolly-tools/core/host-v1';
import { jpegSegmentBody, scanJpegSegments } from '@lolly/engine';

/** PDF readers commonly refuse pages larger than 200 inches on a side. */
const MAX_PAGE_PT = 14400;
const MIN_PAGE_PT = 3;
/** Resolution assumed for an image that declares none. */
const DEFAULT_PPI = 96;
/** A decoded PNG is held as 8-bit RGBA while it is embedded. */
const MAX_PNG_PIXELS = 40_000_000;
const MAX_IMAGES = 2000;
const PAPER: Record<Exclude<PdfImagePageSize, 'image'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function refusal(message: string): Error {
  const err = new Error(`pdf: ${message}`);
  err.name = 'PdfTransformError';
  return err;
}

function startsWith(bytes: Uint8Array, text: string): boolean {
  if (bytes.length < text.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[i] !== text.charCodeAt(i)) return false;
  return true;
}

/** A usable resolution, or 0 when the value is missing or implausible. */
function ppi(value: number): number {
  return Number.isFinite(value) && value >= 10 && value <= 10000 ? value : 0;
}

interface ExifFacts { orientation: number; ppiX: number; ppiY: number }

/** Orientation and resolution from IFD0 of an `Exif\0\0` APP1 payload. */
export function readExifFacts(payload: Uint8Array): ExifFacts {
  const facts: ExifFacts = { orientation: 1, ppiX: 0, ppiY: 0 };
  const t = payload.subarray(6);
  const little = t[0] === 0x49 && t[1] === 0x49;
  if (t.length < 8 || (!little && !(t[0] === 0x4d && t[1] === 0x4d))) return facts;
  const u16 = (o: number): number => (o < 0 || o + 2 > t.length ? -1 : little ? t[o]! | (t[o + 1]! << 8) : (t[o]! << 8) | t[o + 1]!);
  const u32 = (o: number): number => (o < 0 || o + 4 > t.length ? -1 : little
    ? (t[o]! | (t[o + 1]! << 8) | (t[o + 2]! << 16)) + t[o + 3]! * 0x1000000
    : t[o]! * 0x1000000 + ((t[o + 1]! << 16) | (t[o + 2]! << 8) | t[o + 3]!));
  if (u16(2) !== 42) return facts;
  const ifd = u32(4);
  const entries = Math.min(512, Math.max(0, u16(ifd)));
  let x = 0, y = 0, unit = 2;
  const rational = (at: number): number => {
    const offset = u32(at), num = u32(offset), den = u32(offset + 4);
    return num > 0 && den > 0 ? num / den : 0;
  };
  for (let k = 0; k < entries; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) break;
    const tag = u16(e), type = u16(e + 2);
    if (tag === 0x0112 && type === 3) facts.orientation = u16(e + 8);
    else if (tag === 0x011a && type === 5) x = rational(e + 8);
    else if (tag === 0x011b && type === 5) y = rational(e + 8);
    else if (tag === 0x0128 && type === 3) unit = u16(e + 8);
  }
  if (!(facts.orientation >= 1 && facts.orientation <= 8)) facts.orientation = 1;
  const scale = unit === 2 ? 1 : unit === 3 ? 2.54 : 0;
  facts.ppiX = ppi(x * scale);
  facts.ppiY = ppi(y * scale);
  return facts;
}

export interface CleanJpeg {
  /** The JPEG as embedded: decoder segments only, ending at the main image's EOI. */
  bytes: Uint8Array;
  width: number;
  height: number;
  /** Exif orientation, 1 to 8. */
  orientation: number;
  ppiX: number;
  ppiY: number;
  /** Exif, XMP, IPTC, comment or other application data was left out. */
  droppedMetadata: boolean;
  /** Another image stored after the main image's end marker was left out. */
  droppedTrailing: boolean;
}

/**
 * Rebuild a JPEG from the segments the walker reports. Scan data after each
 * SOS header is copied byte for byte up to the next segment, which covers the
 * several scans of a progressive file; only marker segments are chosen.
 */
export function cleanJpeg(src: Uint8Array): CleanJpeg {
  const scan = scanJpegSegments(src);
  const segments = scan?.segments ?? [];
  // A walk that stopped anywhere but inside scan data would drop the rest of the image.
  if (!scan || scan.sos === null || (scan.truncated && segments.at(-1)?.marker !== 0xda)) {
    throw refusal('this JPEG is damaged and cannot be placed on a page');
  }
  const keep: Uint8Array[] = [src.subarray(0, 2)];
  let width = 0, height = 0, orientation = 1, droppedMetadata = false;
  let jfifX = 0, jfifY = 0, exifX = 0, exifY = 0;
  segments.forEach((seg, n) => {
    const { marker } = seg;
    const payload = jpegSegmentBody(src, seg);
    let kept = true;
    if (marker === 0xd8) {
      kept = false;
    } else if (marker === 0xe0) {
      if (startsWith(payload, 'JFIF\0') && payload.length >= 12) {
        const unit = payload[7], scale = unit === 1 ? 1 : unit === 2 ? 2.54 : 0;
        jfifX = ppi(((payload[8]! << 8) | payload[9]!) * scale);
        jfifY = ppi(((payload[10]! << 8) | payload[11]!) * scale);
      }
    } else if (marker === 0xe1) {
      if (startsWith(payload, 'Exif\0')) ({ orientation, ppiX: exifX, ppiY: exifY } = readExifFacts(payload));
      kept = false;
    } else if (marker === 0xe2) {
      kept = startsWith(payload, 'ICC_PROFILE\0');
    } else if (marker === 0xee) {
      kept = startsWith(payload, 'Adobe');
    } else if ((marker >= 0xe3 && marker <= 0xef) || marker === 0xfe) {
      kept = false;
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc && payload.length >= 5) {
      height = (payload[1]! << 8) | payload[2]!;
      width = (payload[3]! << 8) | payload[4]!;
    }
    if (kept) keep.push(src.subarray(seg.start, seg.end));
    else if (marker !== 0xd8) droppedMetadata = true;
    if (marker === 0xda) keep.push(src.subarray(seg.end, segments[n + 1]?.start ?? src.length));
  });
  if (!width || !height) throw refusal('this JPEG has no readable image size');
  if (scan.eoi === null) keep.push(new Uint8Array([0xff, 0xd9]));
  const total = keep.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const part of keep) { bytes.set(part, at); at += part.length; }
  // Padding after the end marker is common and not worth reporting; another
  // start-of-image marker means a second picture (a gain map or preview).
  let droppedTrailing = false;
  for (let j = scan.trailerStart ?? src.length; j + 2 < src.length; j++) {
    if (src[j] === 0xff && src[j + 1] === 0xd8 && src[j + 2] === 0xff) { droppedTrailing = true; break; }
  }
  return {
    bytes, width, height, orientation,
    ppiX: jfifX || exifX, ppiY: jfifY || exifY,
    droppedMetadata, droppedTrailing,
  };
}

interface PngFacts { width: number; height: number; ppiX: number; ppiY: number }

export function readPngFacts(bytes: Uint8Array): PngFacts {
  const u32 = (o: number): number => bytes[o]! * 0x1000000 + ((bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!);
  if (!isPng(bytes) || bytes.length < 33 || !startsWith(bytes.subarray(12), 'IHDR')) throw refusal('this PNG is damaged and cannot be placed on a page');
  const facts: PngFacts = { width: u32(16), height: u32(20), ppiX: 0, ppiY: 0 };
  let at = 33;
  for (let n = 0; n < 4096 && at + 12 <= bytes.length; n++) {
    const length = u32(at), type = bytes.subarray(at + 4, at + 8);
    if (startsWith(type, 'IDAT') || startsWith(type, 'IEND')) break;
    if (startsWith(type, 'pHYs') && length === 9 && at + 17 <= bytes.length && bytes[at + 16] === 1) {
      facts.ppiX = ppi(u32(at + 8) * 0.0254);
      facts.ppiY = ppi(u32(at + 12) * 0.0254);
    }
    at += 12 + length;
  }
  if (!facts.width || !facts.height) throw refusal('this PNG has no readable image size');
  return facts;
}

/** The placement matrix for Exif orientation `o` drawing into box (x, y, w, h). */
export function orientationMatrix(o: number, x: number, y: number, w: number, h: number): [number, number, number, number, number, number] {
  switch (o) {
    case 2: return [-w, 0, 0, h, x + w, y];
    case 3: return [-w, 0, 0, -h, x + w, y + h];
    case 4: return [w, 0, 0, -h, x, y + h];
    case 5: return [0, -h, -w, 0, x + w, y + h];
    case 6: return [0, -h, w, 0, x, y + h];
    case 7: return [0, h, w, 0, x, y];
    case 8: return [0, h, -w, 0, x + w, y];
    default: return [w, 0, 0, h, x, y];
  }
}

interface PageLayout { width: number; height: number; box: { x: number; y: number; w: number; h: number } }

/**
 * Page size and image box for an image whose upright size is `w` by `h`
 * points at its own resolution.
 */
export function layoutImagePage(w: number, h: number, pageSize: PdfImagePageSize, margin: number): PageLayout {
  if (pageSize === 'a4' || pageSize === 'letter') {
    let [pw, ph] = PAPER[pageSize];
    if (w > h) [pw, ph] = [ph, pw];
    const m = Math.min(Math.max(0, Number(margin) || 0), 144, pw / 2 - 1, ph / 2 - 1);
    const scale = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h);
    const bw = w * scale, bh = h * scale;
    return { width: pw, height: ph, box: { x: (pw - bw) / 2, y: (ph - bh) / 2, w: bw, h: bh } };
  }
  let scale = 1;
  if (Math.max(w, h) > MAX_PAGE_PT) scale = MAX_PAGE_PT / Math.max(w, h);
  else if (Math.min(w, h) < MIN_PAGE_PT) scale = Math.min(MIN_PAGE_PT / Math.min(w, h), MAX_PAGE_PT / Math.max(w, h));
  const pw = w * scale, ph = h * scale;
  return { width: pw, height: ph, box: { x: 0, y: 0, w: pw, h: ph } };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export async function imagesToPdf(images: PdfImageInput[], opts: PdfImagesOpts = {}): Promise<PdfImagesResult> {
  const list = Array.isArray(images) ? images.filter((image) => image?.bytes?.length) : [];
  if (!list.length) throw refusal('choose at least one PNG or JPEG image');
  if (list.length > MAX_IMAGES) throw refusal(`a PDF can be built from at most ${MAX_IMAGES} images at a time`);
  const pageSize: PdfImagePageSize = opts.pageSize === 'a4' || opts.pageSize === 'letter' ? opts.pageSize : 'image';
  const { PDFDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } = await import('pdf-lib');
  // No producer, creator or dates: the output describes the images only.
  const doc: PDFDocumentType = await PDFDocument.create({ updateMetadata: false });
  let stripped = 0, trailing = 0, turned = 0;
  for (const [index, image] of list.entries()) {
    const input = image.bytes instanceof Uint8Array ? image.bytes : new Uint8Array(image.bytes);
    let embedded: PDFImage, width: number, height: number, orientation = 1, ppiX: number, ppiY: number;
    if (isJpeg(input)) {
      const jpeg = cleanJpeg(input);
      embedded = await doc.embedJpg(jpeg.bytes);
      ({ width, height, orientation, ppiX, ppiY } = jpeg);
      if (jpeg.droppedMetadata) stripped++;
      if (jpeg.droppedTrailing) trailing++;
      if (orientation !== 1) turned++;
    } else if (isPng(input)) {
      const png = readPngFacts(input);
      if (png.width * png.height > MAX_PNG_PIXELS) {
        throw refusal(`image ${index + 1} has ${Math.round(png.width * png.height / 1e6)} million pixels; resize it below 40 million first`);
      }
      embedded = await doc.embedPng(input);
      ({ width, height, ppiX, ppiY } = png);
    } else {
      throw refusal(`image ${index + 1} is not a PNG or JPEG; convert it first`);
    }
    const storedW = width * 72 / (ppiX || ppiY || DEFAULT_PPI);
    const storedH = height * 72 / (ppiY || ppiX || DEFAULT_PPI);
    const sideways = orientation >= 5;
    const layout = layoutImagePage(sideways ? storedH : storedW, sideways ? storedW : storedH, pageSize, Number(opts.margin) || 0);
    const page = doc.addPage([layout.width, layout.height]);
    const name = page.node.newXObject('Im', embedded.ref);
    const { x, y, w, h } = layout.box;
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...orientationMatrix(orientation, x, y, w, h)), drawObject(name), popGraphicsState());
  }
  const bytes = await doc.save({ useObjectStreams: true });
  const notes: string[] = [];
  if (turned) notes.push(`Turned ${plural(turned, 'photo')} upright using the camera orientation.`);
  if (stripped) notes.push(`Left out photo details such as location and camera data from ${plural(stripped, 'image')}.`);
  if (trailing) notes.push(`Left out extra pictures stored after the main image in ${plural(trailing, 'file')}.`);
  return { bytes, pages: list.length, turned, metadataLeftOut: stripped, extraPicturesLeftOut: trailing, notes };
}
