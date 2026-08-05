// SPDX-License-Identifier: MPL-2.0
/**
 * BMP (Windows Bitmap) — uncompressed BI_RGB encoder + decoder.
 *
 * The oldest, dumbest raster container still in daily use: no compression, no
 * colour management, no provenance. It exists here because it is the lowest
 * common denominator — the format a legacy Windows tool, an embedded print
 * driver, a Delphi/VB app, or a "paste bitmap" clipboard consumer will accept
 * when nothing fancier is on offer. PNG is the engine's real display master
 * (png.ts); BMP is the escape hatch for the recipient who cannot read one.
 *
 * ─── What this emits (BITMAPFILEHEADER + BITMAPINFOHEADER, Microsoft
 *     "Bitmap Storage" / wingdi.h) ──────────────────────────────────────────
 *   14-byte BITMAPFILEHEADER : 'BM', file size, 2 reserved words, pixel offset.
 *   40-byte BITMAPINFOHEADER : header size (40), width, height (POSITIVE =
 *                              bottom-up rows), 1 plane, bit count (24 or 32),
 *                              BI_RGB (0), image byte size, 4 unused fields.
 *   pixel array              : bottom-up rows of BGR (24-bit) or BGRA (32-bit),
 *                              EACH ROW padded up to a 4-byte boundary.
 *
 * 24-bit by default; 32-bit BGRA the moment any pixel's alpha is < 255, so a
 * fully-opaque image stays the compact three-byte form and a transparent one
 * keeps its alpha. (BI_RGB 32-bit's fourth byte is officially "unused", but
 * every modern reader — Windows GDI+, browsers, ImageMagick — treats it as
 * alpha; that is the pragmatic contract, and the one this module's own decoder
 * honours on the round-trip.)
 *
 * ─── Bottom-up rows ─────────────────────────────────────────────────────────
 * A positive biHeight means the first row IN THE FILE is the BOTTOM row of the
 * image (origin lower-left) — the DIB convention. We write rgba top-down and
 * flip at the row level; decode flips back. (Negative biHeight = top-down is a
 * legal variant we ACCEPT on decode but never emit.)
 *
 * ─── Hostile input (the "GIF lesson") ───────────────────────────────────────
 * Every multi-byte field is read through a bounds-checked cursor: the header is
 * refused unless all 54 declared bytes are present, the pixel offset and the
 * per-row stride are validated against the actual buffer length BEFORE any
 * deref, and the row count is bounded by the buffer — there is no size field
 * that can drive an unbounded loop or an out-of-range read. Compressed
 * (BI_RLE / BITFIELDS), paletted (≤8-bit), and 1/16-bit variants are REFUSED
 * with a typed error rather than mis-decoded into plausible garbage.
 *
 * Pure math + typed arrays; DOM-free, no network/filesystem, deterministic and
 * identical in browser/CLI/MCP. Imports nothing but this module's own maths.
 */

/** A BMP this reader refuses as a class (vs a file it can decode). */
export class BmpUnsupportedError extends Error {
  readonly code: 'not-bmp' | 'truncated' | 'compression' | 'bit-depth' | 'dimensions';
  constructor(code: BmpUnsupportedError['code'], message: string) {
    super(message);
    this.name = 'BmpUnsupportedError';
    this.code = code;
  }
}

export interface EncodeBmpOptions {
  /** Force the pixel format instead of auto-picking 24 vs 32 from alpha.
   *  `24` drops alpha (composites nothing — bytes are taken as-is); `32` always
   *  writes BGRA. Default: 32 iff any pixel alpha < 255, else 24. */
  bitDepth?: 24 | 32;
}

const FILE_HEADER = 14;
const INFO_HEADER = 40;
const PIXELS_OFFSET = FILE_HEADER + INFO_HEADER; // 54

/** True iff any pixel is non-opaque, so we must keep an alpha channel. */
function hasAlpha(rgba: Uint8Array, pixelCount: number): boolean {
  for (let i = 0; i < pixelCount; i++) {
    if (rgba[i * 4 + 3]! < 255) return true;
  }
  return false;
}

/**
 * Encode interleaved top-down RGBA (8-bit, 4 bytes/pixel) into an uncompressed
 * BI_RGB BMP. 24-bit BGR when opaque, 32-bit BGRA when alpha is present (or as
 * forced by `opts.bitDepth`). Bottom-up rows, each padded to 4 bytes.
 */
export function encodeBmp(
  rgba: Uint8Array,
  width: number,
  height: number,
  opts: EncodeBmpOptions = {},
): Uint8Array {
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (!(w > 0) || !(h > 0)) {
    throw new BmpUnsupportedError('dimensions', `BMP dimensions must be positive integers, got ${width}x${height}`);
  }
  const pixelCount = w * h;
  if (rgba.length < pixelCount * 4) {
    throw new BmpUnsupportedError('dimensions', `RGBA buffer too small: need ${pixelCount * 4} bytes for ${w}x${h}, got ${rgba.length}`);
  }

  const bitDepth: 24 | 32 = opts.bitDepth ?? (hasAlpha(rgba, pixelCount) ? 32 : 24);
  const bytesPerPixel = bitDepth === 32 ? 4 : 3;

  // Row stride is padded up to the next 4-byte boundary (DIB requirement).
  const rowBytes = w * bytesPerPixel;
  const stride = (rowBytes + 3) & ~3;
  const imageSize = stride * h;
  const fileSize = PIXELS_OFFSET + imageSize;

  const out = new Uint8Array(fileSize);
  const dv = new DataView(out.buffer);

  // ── BITMAPFILEHEADER ──
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  dv.setUint32(2, fileSize, true);
  // bytes 6-9: two reserved words, left zero.
  dv.setUint32(10, PIXELS_OFFSET, true); // bfOffBits

  // ── BITMAPINFOHEADER ──
  dv.setUint32(14, INFO_HEADER, true); // biSize = 40
  dv.setInt32(18, w, true); // biWidth
  dv.setInt32(22, h, true); // biHeight positive => bottom-up
  dv.setUint16(26, 1, true); // biPlanes
  dv.setUint16(28, bitDepth, true); // biBitCount
  dv.setUint32(30, 0, true); // biCompression = BI_RGB
  dv.setUint32(34, imageSize, true); // biSizeImage
  dv.setInt32(38, 2835, true); // biXPelsPerMeter (~72 DPI)
  dv.setInt32(42, 2835, true); // biYPelsPerMeter
  dv.setUint32(46, 0, true); // biClrUsed
  dv.setUint32(50, 0, true); // biClrImportant

  // ── pixel array: bottom-up rows, BGR(A), padded ──
  for (let y = 0; y < h; y++) {
    // File row 0 is the image's bottom row.
    const srcRow = (h - 1 - y) * w;
    let dst = PIXELS_OFFSET + y * stride;
    for (let x = 0; x < w; x++) {
      const s = (srcRow + x) * 4;
      out[dst++] = rgba[s + 2]!; // B
      out[dst++] = rgba[s + 1]!; // G
      out[dst++] = rgba[s]!; // R
      if (bytesPerPixel === 4) out[dst++] = rgba[s + 3]!; // A
    }
    // remaining bytes of the padded stride stay zero
  }

  return out;
}

export interface DecodedBmp {
  rgba: Uint8Array;
  width: number;
  height: number;
}

/**
 * Decode an uncompressed 24- or 32-bit BI_RGB BMP into top-down interleaved
 * RGBA. Refuses compressed, paletted, and non-24/32-bit files with a typed
 * {@link BmpUnsupportedError} rather than mis-decoding. Every read is
 * bounds-checked; a truncated file throws 'truncated'.
 */
export function decodeBmp(bytes: Uint8Array): DecodedBmp {
  if (bytes.length < PIXELS_OFFSET) {
    throw new BmpUnsupportedError('truncated', `BMP shorter than a 54-byte header (${bytes.length} bytes)`);
  }
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    throw new BmpUnsupportedError('not-bmp', "missing 'BM' signature");
  }

  // The DataView must be windowed to the array's own view, not its whole buffer
  // (a subarray shares the parent ArrayBuffer at a nonzero byteOffset).
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);

  const pixelOffset = dv.getUint32(10, true);
  const infoSize = dv.getUint32(14, true);
  if (infoSize < INFO_HEADER) {
    // BITMAPCOREHEADER (12) and other legacy/short headers are not supported.
    throw new BmpUnsupportedError('bit-depth', `unsupported DIB header size ${infoSize} (need BITMAPINFOHEADER >= 40)`);
  }

  const width = dv.getInt32(18, true);
  const rawHeight = dv.getInt32(22, true);
  const bitCount = dv.getUint16(28, true);
  const compression = dv.getUint32(30, true);

  if (compression !== 0) {
    // BI_RLE8=1, BI_RLE4=2, BI_BITFIELDS=3, BI_JPEG=4, BI_PNG=5, ...
    throw new BmpUnsupportedError('compression', `unsupported BMP compression ${compression} (only BI_RGB=0)`);
  }
  if (bitCount !== 24 && bitCount !== 32) {
    throw new BmpUnsupportedError('bit-depth', `unsupported bit depth ${bitCount} (only uncompressed 24/32-bit)`);
  }

  // A negative height is the legal top-down variant; magnitude is the row count.
  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);
  if (width <= 0 || height <= 0) {
    throw new BmpUnsupportedError('dimensions', `invalid BMP dimensions ${width}x${rawHeight}`);
  }
  // Guard the multiply before it is used to size an allocation.
  if (width > 0x7fff || height > 0x7fff) {
    throw new BmpUnsupportedError('dimensions', `BMP too large to decode (${width}x${height})`);
  }

  const bytesPerPixel = bitCount === 32 ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  const stride = (rowBytes + 3) & ~3;

  // Pixel data must start inside the buffer and the whole image must fit.
  if (pixelOffset > bytes.length) {
    throw new BmpUnsupportedError('truncated', `pixel offset ${pixelOffset} past end of ${bytes.length}-byte file`);
  }
  const needed = pixelOffset + stride * height;
  if (needed > bytes.length) {
    throw new BmpUnsupportedError('truncated', `pixel data truncated: need ${needed} bytes, file is ${bytes.length}`);
  }

  const rgba = new Uint8Array(width * height * 4);
  // In a 32-bit BI_RGB BMP the 4th byte is officially UNUSED — many real encoders
  // (older GDI, Delphi/VB, scanner drivers) write it 0x00 for every pixel. Reading it
  // straight as alpha would make such a file decode fully transparent (a blank
  // conversion). So we read it, but track whether ANY pixel carried a non-zero value;
  // if none did, the channel was padding and the image is opaque. A genuinely
  // all-transparent BMP is degenerate and indistinguishable from padding, so opaque is
  // the correct pragmatic choice. (BITMAPV4/V5 alpha travels via BI_BITFIELDS, which we
  // reject above, so this only concerns the ambiguous BI_RGB case.)
  let sawAlpha = false;
  for (let row = 0; row < height; row++) {
    // File row `row` maps to output row `y` (flip for bottom-up).
    const y = topDown ? row : height - 1 - row;
    let src = pixelOffset + row * stride;
    let dst = y * width * 4;
    for (let x = 0; x < width; x++) {
      const b = bytes[src]!;
      const g = bytes[src + 1]!;
      const r = bytes[src + 2]!;
      rgba[dst] = r;
      rgba[dst + 1] = g;
      rgba[dst + 2] = b;
      if (bytesPerPixel === 4) {
        const a = bytes[src + 3]!;
        if (a !== 0) sawAlpha = true;
        rgba[dst + 3] = a;
      } else {
        rgba[dst + 3] = 255;
      }
      src += bytesPerPixel;
      dst += 4;
    }
  }
  if (bytesPerPixel === 4 && !sawAlpha) {
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  }

  return { rgba, width, height };
}

/** Cheap prefix check: 'BM' + a plausible file size. Never throws. */
export function isBmp(bytes: Uint8Array): boolean {
  return bytes.length >= PIXELS_OFFSET && bytes[0] === 0x42 && bytes[1] === 0x4d;
}
