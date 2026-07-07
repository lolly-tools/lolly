// SPDX-License-Identifier: MPL-2.0
/**
 * Pure, DOM-free media classification from header bytes.
 *
 * Two questions the ingest path can't answer from a MIME type alone:
 *   1. Is this raster ANIMATED? — an animated GIF, APNG and animated WebP are
 *      byte-for-byte a different beast from their still cousins, yet share the
 *      SAME MIME (`image/gif`, `image/png`, `image/webp`). Only the container
 *      bytes tell them apart. A shell must know, because re-encoding an animated
 *      raster through a canvas (the normal downscale path) silently flattens it
 *      to one frame — so it has to be stored verbatim instead.
 *   2. Is this a video container? — cheap to guess from MIME/extension, but a
 *      byte check is the honest backstop (an OS handing over a blank/wrong type).
 *
 * Everything here reads only a header prefix and returns a plain string|null, so
 * it lives in the engine (the format single-source-of-truth, alongside apng.ts /
 * tiff.ts) and every shell — web, Tauri, CLI — classifies uploads identically.
 * No DOM, no decode, no allocation beyond a short scan.
 */

/** An animated raster container the ingest path must preserve verbatim. */
export type AnimatedRasterKind = 'gif' | 'apng' | 'webp';

/** A recognised (short) video container. */
export type VideoContainer = 'mp4' | 'webm';

/** Coerce a BufferSource-ish input to a Uint8Array view without copying. */
function asBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function has(bytes: Uint8Array, offset: number, ...sig: number[]): boolean {
  if (offset + sig.length > bytes.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[offset + i] !== sig[i]) return false;
  return true;
}

/** ASCII fourcc match at `offset` (e.g. 'WEBP', 'acTL'). */
function fourcc(bytes: Uint8Array, offset: number, cc: string): boolean {
  if (offset + 4 > bytes.length) return false;
  for (let i = 0; i < 4; i++) if (bytes[offset + i] !== cc.charCodeAt(i)) return false;
  return true;
}

/**
 * Count GIF image frames up to `stopAt` by walking the block structure (skipping
 * colour tables + data sub-blocks by their length prefixes — no LZW decode). A GIF
 * with ≥2 image descriptors (0x2C) is animated. Needs the WHOLE file (a truncated
 * buffer could hide later frames); the caller passes full bytes for GIFs.
 */
function gifFrameCount(bytes: Uint8Array, stopAt = 2): number {
  // "GIF87a"/"GIF89a" + 7-byte Logical Screen Descriptor.
  let p = 13;
  // Global Colour Table: present when the packed field's high bit is set; its size
  // is 2^(N+1) entries of 3 bytes, where N is the low 3 bits.
  const packed = bytes[10] ?? 0;
  if (packed & 0x80) p += 3 * (1 << ((packed & 0x07) + 1));

  let frames = 0;
  let guard = 0;
  const n = bytes.length;
  while (p < n && guard++ < 1_000_000) {
    const block = bytes[p++];
    if (block === 0x3b) break;          // trailer
    if (block === 0x2c) {               // Image Descriptor → one frame
      if (++frames >= stopAt) return frames;
      // 9-byte descriptor; a local colour table may follow.
      const lp = bytes[p + 8] ?? 0;
      p += 9;
      if (lp & 0x80) p += 3 * (1 << ((lp & 0x07) + 1));
      p += 1;                           // LZW minimum code size
      p = skipSubBlocks(bytes, p);      // image data sub-blocks
    } else if (block === 0x21) {        // Extension Introducer
      p += 1;                           // label
      p = skipSubBlocks(bytes, p);
    } else {
      break;                            // unknown/corrupt — stop, report what we have
    }
  }
  return frames;
}

/** Advance past a run of length-prefixed sub-blocks, ending after the 0x00 terminator. */
function skipSubBlocks(bytes: Uint8Array, p: number): number {
  const n = bytes.length;
  while (p < n) {
    const len = bytes[p++]!;
    if (len === 0) break;
    p += len;
  }
  return p;
}

/** True if the PNG has an `acTL` chunk before its first `IDAT` (i.e. it's an APNG). */
function isAnimatedPng(bytes: Uint8Array): boolean {
  // 8-byte PNG signature, then length(4)+type(4)+data+crc(4) chunks.
  let p = 8;
  let guard = 0;
  const n = bytes.length;
  while (p + 8 <= n && guard++ < 100_000) {
    const len = (bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!;
    if (fourcc(bytes, p + 4, 'acTL')) return true;
    if (fourcc(bytes, p + 4, 'IDAT')) return false;   // image data reached, no acTL → still PNG
    if (len < 0) return false;                          // malformed length
    p += 12 + len;                                      // length + type + data + crc
  }
  return false;
}

/** True if a RIFF/WebP has its VP8X animation flag set (or an ANIM/ANMF chunk). */
function isAnimatedWebp(bytes: Uint8Array): boolean {
  if (!fourcc(bytes, 0, 'RIFF') || !fourcc(bytes, 8, 'WEBP')) return false;
  // Extended (VP8X) form carries a flags byte; bit 1 (0x02) is the animation flag.
  if (fourcc(bytes, 12, 'VP8X')) {
    const flags = bytes[20] ?? 0;
    if (flags & 0x02) return true;
  }
  // Belt-and-suspenders: scan the first chunks for an animation container.
  const scan = Math.min(bytes.length - 4, 4096);
  for (let p = 12; p < scan; p++) {
    if (fourcc(bytes, p, 'ANIM') || fourcc(bytes, p, 'ANMF')) return true;
  }
  return false;
}

/**
 * Classify an animated raster from its header, or null if it's a still image (or
 * not one of the three animatable raster containers). `mime`/`name` only steer
 * WHICH container check to run — the verdict is always from the bytes.
 */
export function sniffAnimatedRaster(
  input: Uint8Array | ArrayBuffer,
  { mime = '', name = '' }: { mime?: string; name?: string } = {},
): AnimatedRasterKind | null {
  const bytes = asBytes(input);
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();

  // GIF — identifiable by signature alone; animation needs the frame walk.
  if (has(bytes, 0, 0x47, 0x49, 0x46, 0x38)) {           // "GIF8"
    return gifFrameCount(bytes) >= 2 ? 'gif' : null;
  }
  // APNG — a PNG whose acTL precedes IDAT.
  if (has(bytes, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return isAnimatedPng(bytes) ? 'apng' : null;
  }
  // Animated WebP.
  if (fourcc(bytes, 0, 'RIFF') && fourcc(bytes, 8, 'WEBP')) {
    return isAnimatedWebp(bytes) ? 'webp' : null;
  }
  // Fall back to the declared type/extension only to know which check to try when
  // the magic bytes are absent (e.g. an OS-supplied blank MIME on a real file).
  if ((/png/.test(mime) || ext === 'png' || ext === 'apng') && isAnimatedPng(bytes)) return 'apng';
  if ((/webp/.test(mime) || ext === 'webp') && isAnimatedWebp(bytes)) return 'webp';
  return null;
}

/**
 * Recognise a short video container from its header, or null. MP4/MOV carry an
 * `ftyp` box at offset 4; WebM/MKV open with the EBML magic. Used as a byte-level
 * backstop for the MIME/extension gate the ingest path already applies.
 */
export function sniffVideoContainer(input: Uint8Array | ArrayBuffer): VideoContainer | null {
  const bytes = asBytes(input);
  if (has(bytes, 0, 0x1a, 0x45, 0xdf, 0xa3)) return 'webm';   // EBML (WebM/Matroska)
  if (fourcc(bytes, 4, 'ftyp')) return 'mp4';                 // ISO-BMFF (MP4/MOV/M4V)
  return null;
}
