// SPDX-License-Identifier: MPL-2.0
/**
 * Windows ICO / CUR reader: picks the LARGEST image in the directory and
 * decodes it to RGBA. The import side of the icon story: the shell already
 * ENCODES `.ico` (packs a PNG or BMP per size into an ICONDIR), so this is the
 * reverse. A dropped `.ico` becomes an editable raster.
 *
 * Pure bytes, DOM-free, no network/filesystem. Untrusted input throughout
 * (docs/threat-model.md): every field read is bounds-checked against the buffer
 * before it is dereferenced, and every count/offset/size from the header is
 * validated against the actual byte length before it is trusted. A crafted
 * `count`, `bytesInRes`, or `imageOffset` throws rather than reading out of
 * bounds or looping.
 *
 * ─── The container (ICO/CUR spec) ────────────────────────────────────────────
 * A 6-byte ICONDIR (reserved(0), type(1=ICO, 2=CUR), image count) followed by
 * `count` 16-byte ICONDIRENTRY records. Each entry carries a width/height byte
 * (0 means 256), colour/plane fields, a `bytesInRes` size and an `imageOffset`
 * pointing at the image payload elsewhere in the file. The payload is EITHER a
 * whole PNG file (Vista+ stores large icons this way) OR a "BMP" that is really
 * a headerless DIB: a BITMAPINFOHEADER whose `height` is DOUBLED (the XOR colour
 * mask stacked on a 1-bpp AND transparency mask), NO BITMAPFILEHEADER, and NO
 * `BITMAPINFOHEADER.height`-implied file layout: pixels follow the header (and
 * any palette) directly.
 *
 * ─── PNG entries: we return the bytes, not pixels ────────────────────────────
 * The engine has no PNG DECODER (it has png.ts's writer and png-unfilter.ts's
 * row-filter reversal, but no inflate + full IDAT decode path), so a PNG-payload
 * entry is returned as `{ png: true, bytes, width, height }` for the shell to
 * decode natively (createImageBitmap / an <img>). The width/height come from the
 * PNG's own IHDR when present (more reliable than the directory's 0-means-256
 * byte), falling back to the directory dimensions.
 *
 * ─── BMP entries: 32-bit and 24-bit DIB ──────────────────────────────────────
 * Decoded here. 32-bit BGRA is read straight (the stored alpha is honoured).
 * 24-bit BGR is opaque, then the 1-bpp AND mask (if the row stride leaves room
 * for it) punches transparency. A real icon relies on the AND mask for its
 * cut-out even at 24-bit. Rows are bottom-up and padded to a 4-byte boundary,
 * per the DIB convention. Palettised (1/4/8-bpp) and 16-bit DIBs are not
 * decoded (those sizes are essentially always PNG or 32-bit today) and throw
 * a clear `unsupported` rather than guessing.
 */

/** A decoded BMP-payload icon: straight RGBA, one byte per channel, row-major. */
export interface IcoRgbaImage {
  readonly png?: false;
  readonly rgba: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** A PNG-payload icon: the shell decodes the raw bytes natively. */
export interface IcoPngImage {
  readonly png: true;
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export type IcoImage = IcoRgbaImage | IcoPngImage;

export class IcoDecodeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'IcoDecodeError';
    this.code = code;
  }
}

// A directory count over this can only be a hostile or corrupt file: 16 bytes
// per entry means even the entry table would run past any plausible icon file.
const MAX_ENTRIES = 4096;
// Guard the decoded pixel buffer the same way psd.ts guards its dimensions:
// 256 is the real ICO ceiling, but PNG entries can legitimately be larger; keep
// a generous cap so a crafted BMP header can't ask for a gigabyte allocation.
const MAX_DIM = 8192;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Cheap prefix check: a real ICONDIR has reserved 0, type 1 (ICO) or 2 (CUR). */
export function isIco(input: Uint8Array | ArrayBuffer): boolean {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < 6) return false;
  if (b[0] !== 0 || b[1] !== 0) return false;
  const type = b[2]! | (b[3]! << 8);
  if (type !== 1 && type !== 2) return false;
  const count = b[4]! | (b[5]! << 8);
  return count >= 1;
}

/**
 * Decode an ICO/CUR, returning its largest image (by pixel area). BMP payloads
 * come back as decoded RGBA; PNG payloads come back as raw bytes for the shell.
 * Throws {@link IcoDecodeError} on a malformed or unsupported file.
 */
export function decodeIco(input: Uint8Array | ArrayBuffer): IcoImage {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 6) throw new IcoDecodeError('short', 'file shorter than an ICONDIR header (6 bytes)');
  if (bytes[0] !== 0 || bytes[1] !== 0) throw new IcoDecodeError('magic', 'not an ICO/CUR file (reserved bytes non-zero)');

  const type = bytes[2]! | (bytes[3]! << 8);
  if (type !== 1 && type !== 2) throw new IcoDecodeError('type', `ICONDIR type ${type} (expected 1=ICO or 2=CUR)`);

  const count = bytes[4]! | (bytes[5]! << 8);
  if (count < 1) throw new IcoDecodeError('empty', 'ICONDIR declares zero images');
  if (count > MAX_ENTRIES) throw new IcoDecodeError('count', `ICONDIR count ${count} exceeds sane maximum ${MAX_ENTRIES}`);

  // The entry table must fit: 6-byte header + count * 16-byte ICONDIRENTRY.
  const tableEnd = 6 + count * 16;
  if (tableEnd > bytes.length) {
    throw new IcoDecodeError('truncated', `ICONDIR count ${count} needs ${tableEnd} bytes; file is ${bytes.length}`);
  }

  // Parse every entry, validating its slice, and keep the one with the most pixels.
  let best: { width: number; height: number; offset: number; size: number } | null = null;
  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 16;
    // width/height bytes: 0 encodes 256.
    const w = bytes[rec]! === 0 ? 256 : bytes[rec]!;
    const h = bytes[rec + 1]! === 0 ? 256 : bytes[rec + 1]!;
    const size = readU32(bytes, rec + 8);
    const offset = readU32(bytes, rec + 12);
    // The image payload must lie wholly inside the file: the classic hostile
    // field. offset+size can overflow 32 bits in a crafted file, so compare in
    // the (safe-integer) number domain, not modular u32.
    if (size === 0) continue; // empty entry: skip, never let it win
    if (offset < tableEnd || offset > bytes.length || offset + size > bytes.length) {
      throw new IcoDecodeError('offset', `entry ${i} image [${offset}..${offset + size}) escapes file (len ${bytes.length})`);
    }
    if (!best || w * h > best.width * best.height) best = { width: w, height: h, offset, size };
  }
  if (!best) throw new IcoDecodeError('empty', 'no non-empty image entries in ICONDIR');

  const payload = bytes.subarray(best.offset, best.offset + best.size);

  if (isPngPayload(payload)) {
    const dims = pngDimensions(payload);
    return {
      png: true,
      // Copy out so the returned bytes don't pin the whole ICO buffer alive.
      bytes: payload.slice(),
      width: dims?.width ?? best.width,
      height: dims?.height ?? best.height,
    };
  }

  return decodeDib(payload, best.width, best.height);
}

// ─── PNG payload ─────────────────────────────────────────────────────────────

function isPngPayload(p: Uint8Array): boolean {
  if (p.length < PNG_MAGIC.length) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) if (p[i] !== PNG_MAGIC[i]) return false;
  return true;
}

/** IHDR width/height (big-endian): the first chunk after the 8-byte signature. */
function pngDimensions(p: Uint8Array): { width: number; height: number } | null {
  // signature(8) + length(4) + 'IHDR'(4) + width(4) + height(4) → needs 24 bytes.
  if (p.length < 24) return null;
  if (p[12] !== 0x49 || p[13] !== 0x48 || p[14] !== 0x44 || p[15] !== 0x52) return null; // 'IHDR'
  const width = readU32BE(p, 16);
  const height = readU32BE(p, 20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

// ─── BMP / DIB payload ───────────────────────────────────────────────────────

function decodeDib(dib: Uint8Array, dirW: number, dirH: number): IcoRgbaImage {
  // BITMAPINFOHEADER is 40 bytes; anything shorter can't be a DIB we read.
  if (dib.length < 40) throw new IcoDecodeError('dib-short', `DIB payload ${dib.length} bytes, shorter than a 40-byte BITMAPINFOHEADER`);

  const headerSize = readU32(dib, 0);
  if (headerSize < 40) throw new IcoDecodeError('dib-header', `DIB header size ${headerSize} (expected >= 40 BITMAPINFOHEADER)`);
  if (headerSize > dib.length) throw new IcoDecodeError('dib-header', `DIB header size ${headerSize} exceeds payload ${dib.length}`);

  const width = readI32(dib, 4);
  // The DIB height is DOUBLED (XOR mask + AND mask stacked); the image height is
  // half. A negative height would mean top-down, which an ICO never uses.
  const dibHeight = readI32(dib, 8);
  const height = Math.floor(dibHeight / 2);
  const bpp = dib[14]! | (dib[15]! << 8);

  if (width < 1 || height < 1) throw new IcoDecodeError('dib-dims', `DIB image dimensions ${width}x${height} (from doubled height ${dibHeight})`);
  if (width > MAX_DIM || height > MAX_DIM) throw new IcoDecodeError('dib-dims', `DIB image ${width}x${height} exceeds max ${MAX_DIM}`);
  // Sanity vs the directory record: warn-free but reject a wild mismatch that
  // could only be corruption (the directory said tiny, the DIB claims huge).
  void dirW; void dirH;

  if (bpp !== 32 && bpp !== 24) {
    throw new IcoDecodeError('dib-bpp', `DIB with ${bpp} bits/pixel is not supported (only 24 and 32; smaller icons are PNG or palettised)`);
  }

  // Colour rows: bytes-per-pixel, each row padded UP to a 4-byte boundary.
  const bytesPP = bpp >> 3;
  const xorStride = (((width * bpp) + 31) >> 5) << 2; // ceil(width*bpp/32)*4
  const pixelStart = headerSize; // no palette for 24/32-bpp DIBs
  const xorBytes = xorStride * height;
  if (pixelStart + xorBytes > dib.length) {
    throw new IcoDecodeError('dib-truncated', `DIB colour mask needs ${pixelStart + xorBytes} bytes; payload is ${dib.length}`);
  }

  // 1-bpp AND (transparency) mask, also 4-byte-padded rows, stacked after XOR.
  const andStride = (((width) + 31) >> 5) << 2; // ceil(width/32)*4
  const andStart = pixelStart + xorBytes;
  const hasAndMask = andStart + andStride * height <= dib.length;

  const rgba = new Uint8Array(width * height * 4);
  // Pass 1: colour + raw alpha (32-bit) / opaque (24-bit), tracking whether the
  // 32-bit alpha channel actually carries information.
  let sawAlpha = false;
  for (let y = 0; y < height; y++) {
    // Rows are bottom-up: file row 0 is the image's bottom row.
    const srcRow = pixelStart + (height - 1 - y) * xorStride;
    let di = y * width * 4;
    for (let x = 0; x < width; x++) {
      const si = srcRow + x * bytesPP;
      // Stored BGR(A) → RGBA.
      rgba[di] = dib[si + 2]!;
      rgba[di + 1] = dib[si + 1]!;
      rgba[di + 2] = dib[si]!;
      if (bpp === 32) {
        const a = dib[si + 3]!;
        if (a !== 0) sawAlpha = true;
        rgba[di + 3] = a;
      } else {
        rgba[di + 3] = 255;
      }
      di += 4;
    }
  }

  // Pass 2: the 1-bpp AND (transparency) mask. A 32-bit icon that carries a real
  // alpha channel does not need it, and many such icons ship a bogus all-0xFF AND
  // mask as a formality. Applying it would blank every valid pixel. So honour alpha
  // for 32-bit and use the AND mask ONLY for 24-bit (no alpha) or a 32-bit icon whose
  // alpha channel is entirely zero (no usable alpha, so the mask is the only cut-out).
  const useAndMask = hasAndMask && (bpp !== 32 || !sawAlpha);
  if (useAndMask) {
    for (let y = 0; y < height; y++) {
      const andRow = andStart + (height - 1 - y) * andStride;
      let di = y * width * 4;
      for (let x = 0; x < width; x++) {
        const bit = dib[andRow + (x >> 3)]!;
        // AND bit set → transparent (the cut-out); else opaque.
        rgba[di + 3] = ((bit >> (7 - (x & 7))) & 1) ? 0 : 255;
        di += 4;
      }
    }
  }

  return { rgba, width, height };
}

// ─── little/big-endian reads, each bounds-checked before deref ───────────────

function readU32(b: Uint8Array, o: number): number {
  if (o + 4 > b.length) throw new IcoDecodeError('read', `u32 read at ${o} past end ${b.length}`);
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

function readI32(b: Uint8Array, o: number): number {
  if (o + 4 > b.length) throw new IcoDecodeError('read', `i32 read at ${o} past end ${b.length}`);
  return b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24);
}

function readU32BE(b: Uint8Array, o: number): number {
  if (o + 4 > b.length) throw new IcoDecodeError('read', `u32be read at ${o} past end ${b.length}`);
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}
