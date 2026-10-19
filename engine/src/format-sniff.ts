// SPDX-License-Identifier: MPL-2.0
/**
 * Container identity from bytes, and the requested-format table that decides
 * whether those bytes satisfy a request.
 *
 * This moved here from `packages/node-shell/src/format-sniff.ts` so the export
 * report (`preflight-output.ts`) and every shell read one table. The Node
 * shells keep their refusal (`assertFormatBytes`) and import the detection from
 * this module, so the CLI guard and the report cannot disagree about what a
 * file is.
 *
 * Detection is deliberately conservative. An unrecognised signature returns
 * null, which callers treat as "no opinion", never as a mismatch. Pure: no
 * DOM, no I/O, and only a short prefix scan except for the PNG chunk walk.
 */

import { isJxl } from './jxl.ts';

/** A container identity this module can recognise from bytes alone. */
export type SniffedFormat =
  | 'jxl' | 'png' | 'apng' | 'jpg' | 'gif' | 'webp' | 'avif' | 'heic' | 'tiff' | 'bmp' | 'ico'
  | 'pdf' | 'zip' | 'mp4' | 'webm' | 'exr' | 'hdr' | 'emf' | 'svg' | 'eps' | 'gzip';

const ascii = (b: Uint8Array, at: number, s: string): boolean => {
  if (at + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
};

const bytesAt = (b: Uint8Array, at: number, sig: number[]): boolean => {
  if (at + sig.length > b.length) return false;
  for (let i = 0; i < sig.length; i++) if (b[at + i] !== sig[i]) return false;
  return true;
};

/**
 * True when this PNG carries an `acTL` chunk before its first `IDAT`, the one
 * structural difference between a PNG and an APNG. The chunk table is walked
 * rather than searched, because the four letters can occur inside compressed
 * pixel data.
 */
function isAnimatedPng(b: Uint8Array): boolean {
  let at = 8;
  while (at + 8 <= b.length) {
    const len = (b[at]! << 24 | b[at + 1]! << 16 | b[at + 2]! << 8 | b[at + 3]!) >>> 0;
    if (ascii(b, at + 4, 'acTL')) return true;
    if (ascii(b, at + 4, 'IDAT')) return false;
    at += 12 + len;
    if (len > b.length) return false;
  }
  return false;
}

/** ISO-BMFF major brand at offset 8 (the box after `ftyp`). */
function isoBrand(b: Uint8Array): SniffedFormat | null {
  if (!ascii(b, 4, 'ftyp')) return null;
  const brand = String.fromCharCode(b[8] ?? 0, b[9] ?? 0, b[10] ?? 0, b[11] ?? 0).toLowerCase();
  if (brand === 'avif' || brand === 'avis') return 'avif';
  if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') return 'heic';
  return 'mp4';
}

/** Leading text of the buffer, for the text-based formats. ASCII only. */
function head(b: Uint8Array, n = 1024): string {
  let s = '';
  for (let i = 0; i < Math.min(n, b.length); i++) s += String.fromCharCode(b[i]!);
  return s;
}

/**
 * Identify the container from its bytes, or null when nothing is recognised.
 * Never guesses from a filename, because a name can be wrong.
 */
export function sniffFormat(bytes: Uint8Array): SniffedFormat | null {
  const b = bytes;
  if (isJxl(b)) return 'jxl';
  if (b.length < 4) return null;

  if (bytesAt(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return isAnimatedPng(b) ? 'apng' : 'png';
  if (bytesAt(b, 0, [0xff, 0xd8, 0xff])) return 'jpg';
  if (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) return 'gif';
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'webp';
  if (ascii(b, 0, '%PDF-')) return 'pdf';
  if (bytesAt(b, 0, [0x50, 0x4b, 0x03, 0x04]) || bytesAt(b, 0, [0x50, 0x4b, 0x05, 0x06])) return 'zip';
  if (bytesAt(b, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';
  if (bytesAt(b, 0, [0x76, 0x2f, 0x31, 0x01])) return 'exr';
  if (ascii(b, 0, '#?RADIANCE') || ascii(b, 0, '#?RGBE')) return 'hdr';
  if (bytesAt(b, 0, [0x49, 0x49, 0x2a, 0x00]) || bytesAt(b, 0, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff';
  if (ascii(b, 0, 'BM')) return 'bmp';
  if (bytesAt(b, 0, [0x00, 0x00, 0x01, 0x00])) return 'ico';
  if (bytesAt(b, 0, [0x1f, 0x8b])) return 'gzip';
  // Windows Enhanced Metafile: EMR_HEADER record type 1, with the ' EMF' signature
  // at offset 40. Both are required; the leading 01 00 00 00 alone is far too weak.
  if (bytesAt(b, 0, [0x01, 0x00, 0x00, 0x00]) && ascii(b, 40, ' EMF')) return 'emf';
  const iso = isoBrand(b);
  if (iso) return iso;

  const text = head(b);
  // DOS EPS wraps a PostScript stream in a binary header; the plain form starts %!PS.
  if (bytesAt(b, 0, [0xc5, 0xd0, 0xd3, 0xc6]) || /^%!PS/.test(text)) return 'eps';
  if (/<svg[\s>]/i.test(text)) return 'svg';
  return null;
}

/**
 * Each requested export format, mapped to the sniffed identities that satisfy that request.
 *
 * A format absent from this table is unchecked: data and text formats such as
 * json, csv, ics, vcf, md, txt, html and dxf have no reliable signature. A
 * VARIANT of a container (pdf-cmyk is a PDF, cmyk-tiff is a TIFF, eps-cmyk is
 * an EPS) checks the container only; the colour model is a separate check.
 *
 * The table has a NULL PROTOTYPE on purpose. The key can come from a
 * user-controlled file extension, and an inherited key such as `constructor`
 * is not a format row.
 */
const ACCEPTS: Record<string, readonly SniffedFormat[]> = Object.assign(Object.create(null) as Record<string, readonly SniffedFormat[]>, {
  jxl: ['jxl'], 'jxl-lossless': ['jxl'],
  png: ['png', 'apng'],          // an APNG is a valid PNG; asking for png and getting one is fine
  apng: ['apng'],                // ...but asking for APNG and getting a still is not
  jpg: ['jpg'],
  jpeg: ['jpg'],
  webp: ['webp'],
  'webp-anim': ['webp'],
  avif: ['avif'],
  heic: ['heic'],
  gif: ['gif'],
  tiff: ['tiff'],
  'cmyk-tiff': ['tiff'],
  bmp: ['bmp'],
  ico: ['ico'],
  pdf: ['pdf'],
  'pdf-cmyk': ['pdf'],
  zip: ['zip'],
  pptx: ['zip'],
  mp4: ['mp4'],
  webm: ['webm'],
  exr: ['exr'],
  hdr: ['hdr'],
  emf: ['emf'],
  svg: ['svg'],
  'svg-anim': ['svg'],
  eps: ['eps'],
  'eps-cmyk': ['eps'],
});

/** The sniffed identities that satisfy a requested format, or null when the format has no row. */
export function acceptedFormats(requested: string): readonly SniffedFormat[] | null {
  return ACCEPTS[String(requested).toLowerCase()] ?? null;
}

/**
 * Whether a format NAME describes a sniffed identity. A name with no row is
 * "no opinion" and returns true.
 */
export function formatAllows(name: string, sniffed: SniffedFormat): boolean {
  const want = acceptedFormats(name);
  return !want || want.includes(sniffed);
}

/** Human name for a sniffed identity, for messages. */
export const SNIFFED_FORMAT_LABEL: Readonly<Record<SniffedFormat, string>> = {
  jxl: 'JPEG XL', png: 'PNG', apng: 'animated PNG', jpg: 'JPEG', gif: 'GIF', webp: 'WebP', avif: 'AVIF',
  heic: 'HEIC', tiff: 'TIFF', bmp: 'BMP', ico: 'ICO', pdf: 'PDF', zip: 'ZIP', mp4: 'MP4',
  webm: 'WebM', exr: 'OpenEXR', hdr: 'Radiance HDR', emf: 'EMF', svg: 'SVG',
  eps: 'EPS', gzip: 'gzip',
};
