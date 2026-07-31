// SPDX-License-Identifier: MPL-2.0
/**
 * "Did the encoder actually give me the format I asked for?" — the Node shells'
 * output guard.
 *
 * The failure this exists for: `lolly qr-code --export=avif --output=qr.avif` wrote
 * PNG BYTES under an .avif name and exited 0. Headless Chromium ships no AV1 encoder,
 * so the web shell's canvasToBlob silently degrades to PNG; the CLI wrote whatever it
 * was handed. A pipeline downstream then has a file whose extension, whose MIME
 * assumption and whose actual bytes disagree — a plausible-looking wrong file, which
 * is the worst outcome this shell can produce.
 *
 * So: sniff the bytes, compare against what was REQUESTED, and refuse on a mismatch
 * rather than writing. The check is deliberately conservative — an unrecognised
 * signature is "no opinion", never a failure — so it can only ever catch a case where
 * we positively identified a DIFFERENT container.
 *
 * DELIBERATE WORDING of the refusal, same discipline as `deepSourceRefusal` in
 * raster.ts: it must not contain "browser engine", "needs a browser", "requires an",
 * "<svg>", "no built web shell" or "chromium", because shells/cli/src/run.ts
 * pattern-matches those to take a fallback path. An encoder mismatch must fail loudly,
 * never quietly become some other file.
 */

/** A container identity this module can recognise from bytes alone. */
export type SniffedFormat =
  | 'png' | 'apng' | 'jpg' | 'gif' | 'webp' | 'avif' | 'heic' | 'tiff' | 'bmp' | 'ico'
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
 * True when this PNG carries an `acTL` chunk before its first `IDAT` — the one
 * structural difference between a PNG and an APNG. Scans the chunk table properly
 * rather than searching for the four letters anywhere (they can occur inside
 * compressed pixel data).
 */
function isAnimatedPng(b: Uint8Array): boolean {
  let at = 8; // past the signature
  while (at + 8 <= b.length) {
    const len = (b[at]! << 24 | b[at + 1]! << 16 | b[at + 2]! << 8 | b[at + 3]!) >>> 0;
    if (ascii(b, at + 4, 'acTL')) return true;
    if (ascii(b, at + 4, 'IDAT')) return false;
    at += 12 + len; // length + type + data + crc
    if (len > b.length) return false; // corrupt chunk table — stop rather than loop
  }
  return false;
}

/** ISO-BMFF major brand at offset 8 (the box after `ftyp`). */
function isoBrand(b: Uint8Array): SniffedFormat | null {
  if (!ascii(b, 4, 'ftyp')) return null;
  const brand = String.fromCharCode(b[8] ?? 0, b[9] ?? 0, b[10] ?? 0, b[11] ?? 0).toLowerCase();
  if (brand === 'avif' || brand === 'avis') return 'avif';
  if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') return 'heic';
  return 'mp4'; // isom/mp4x/M4V/qt … — everything else in the family
}

/** Leading text of the buffer, for the text-shaped formats. Cheap, ASCII-only. */
function head(b: Uint8Array, n = 1024): string {
  let s = '';
  for (let i = 0; i < Math.min(n, b.length); i++) s += String.fromCharCode(b[i]!);
  return s;
}

/**
 * Identify the container from its bytes, or null when nothing is recognised.
 * Never guesses from a filename — the whole point is that the name can lie.
 */
export function sniffFormat(bytes: Uint8Array): SniffedFormat | null {
  const b = bytes;
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
  // at offset 40. Both are required — the leading 01 00 00 00 alone is far too weak.
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
 * Requested export format → the sniffed identities that legitimately satisfy it.
 *
 * A format absent from this table is unchecked (data/text formats like json, csv, ics,
 * vcf, md, txt, html and dxf have no reliable magic and nothing to confuse them with).
 * Where a request is a VARIANT of a container — pdf-cmyk is a PDF, cmyk-tiff is a TIFF,
 * eps-cmyk is an EPS — the container is what gets checked; the colour model is not
 * something a magic number can speak to.
 */
const ACCEPTS: Record<string, readonly SniffedFormat[]> = {
  png: ['png', 'apng'],          // an APNG is a valid PNG; asking for png and getting one is fine
  apng: ['apng'],                // …but asking for APNG and getting a still is NOT
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
};

/** Thrown when the produced bytes are demonstrably not the requested container. */
export class FormatMismatchError extends Error {
  readonly requested: string;
  readonly produced: SniffedFormat;
  constructor(requested: string, produced: SniffedFormat, message: string) {
    super(message);
    this.name = 'FormatMismatchError';
    this.requested = requested;
    this.produced = produced;
  }
}

/** Human name for a sniffed identity, for the refusal sentence. */
const LABEL: Record<SniffedFormat, string> = {
  png: 'PNG', apng: 'animated PNG', jpg: 'JPEG', gif: 'GIF', webp: 'WebP', avif: 'AVIF',
  heic: 'HEIC', tiff: 'TIFF', bmp: 'BMP', ico: 'ICO', pdf: 'PDF', zip: 'ZIP', mp4: 'MP4',
  webm: 'WebM', exr: 'OpenEXR', hdr: 'Radiance HDR', emf: 'EMF', svg: 'SVG',
  eps: 'EPS', gzip: 'gzip',
};

/**
 * Refuse output whose bytes are a different container from the one requested.
 *
 * Conservative on purpose, in both directions:
 *   • an unknown request (no ACCEPTS row) is never checked;
 *   • an unrecognised signature is never a failure — "no opinion" is not "wrong".
 * Only a positive identification of a DIFFERENT container throws.
 *
 * Call it after the bytes are final and BEFORE anything is written.
 */
export function assertFormatBytes(requested: string, bytes: Uint8Array): void {
  const want = ACCEPTS[requested.toLowerCase()];
  if (!want) return;
  const got = sniffFormat(bytes);
  if (!got || want.includes(got)) return;
  throw new FormatMismatchError(
    requested, got,
    `the encoder returned ${LABEL[got]} bytes for an export requested as "${requested}". ` +
    'This shell will not write a file whose contents disagree with its declared format — a mislabelled ' +
    'file is worse than a failed export, because nothing downstream can tell. ' +
    (got === 'png' && (requested.toLowerCase() === 'avif' || requested.toLowerCase() === 'heic')
      ? 'The headless render tier has no AV1/HEVC encoder, so its canvas encoder degrades to PNG. '
      : '') +
    `Export "${LABEL[got].toLowerCase()}" instead, or re-encode the ${LABEL[got]} output yourself. ` +
    'No file was written.',
  );
}
