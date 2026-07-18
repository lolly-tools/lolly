// SPDX-License-Identifier: MPL-2.0
/**
 * Animated WebP packer — pure, DOM-free, platform-agnostic.
 *
 * Chunk-level surgery only: the shell supplies COMPLETE already-encoded still
 * WebP files (one per animation frame, from the browser's native
 * canvas.toBlob('image/webp')), and this splices their image bitstreams into a
 * single animated RIFF/WEBP. No pixel work, no compression — each frame's
 * `VP8 ` / `VP8L` chunk (and its optional `ALPH`) is copied verbatim into one
 * `ANMF`, wrapped by a `VP8X` (animation flag) + `ANIM` (loop/background)
 * header. The browser does the compression; the engine assembles the container.
 *
 * Like apng.ts / emf.ts / eps.ts this is a byte-format authority: no DOM, no
 * deps, fully node:test-able. NOTE: WebP RIFF integers are LITTLE-endian — PNG
 * (apng.ts) is big-endian — hence the separate little-endian helpers here.
 */

import { concatBytes as concat } from './bytes.ts';

export interface PackWebpAnimOptions {
  /** Per-frame display time in ms; a number applies to all frames, an array is
   *  per-frame (missing/invalid entries fall back to 67). Clamped to ≥1. */
  delayMs?: number | number[];
  /** ANIM loop_count; 0 = loop forever (default). */
  loops?: number;
  /** Canvas width — the export path always passes this (frames share geometry). */
  width?: number;
  /** Canvas height. */
  height?: number;
  /** ANIM background colour, RGBA; default fully transparent. */
  background?: [number, number, number, number];
}

const u16LE = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff];
const u24LE = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff];

// One RIFF chunk: fourcc(4) + u32LE payloadSize + payload + pad(0x00 iff size is
// odd). The pad byte is part of the enclosing RIFF but is NOT counted in the
// chunk's own size field.
function chunk(fourcc: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length + (payload.length & 1));
  for (let i = 0; i < 4; i++) out[i] = fourcc.charCodeAt(i);
  const n = payload.length;
  out[4] = n & 0xff; out[5] = (n >>> 8) & 0xff; out[6] = (n >>> 16) & 0xff; out[7] = (n >>> 24) & 0xff;
  out.set(payload, 8);
  return out;
}

interface WebpImage { chunks: Uint8Array; hasAlpha: boolean; width: number; height: number; }

// Parse a still WebP (canvas.toBlob('image/webp') output — simple lossy `VP8 `,
// simple lossless `VP8L`, or extended `VP8X`+`ALPH`+`VP8 `/`VP8L`) and return its
// image bitstream chunks VERBATIM (ALPH before VP8, as libwebp demux requires),
// plus whether it carries alpha and its pixel dimensions.
function parseStillWebp(bytes: Uint8Array, label: string): WebpImage {
  const fourcc = (o: number): string => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
  const u32 = (o: number): number => (bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16) | (bytes[o + 3]! << 24)) >>> 0;
  const u24 = (o: number): number => (bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16));
  if (bytes.length < 12 || fourcc(0) !== 'RIFF' || fourcc(8) !== 'WEBP') {
    throw new Error(`packWebpAnim: ${label} is not a WebP (bad RIFF/WEBP signature)`);
  }
  const imageChunks: Uint8Array[] = [];
  let hasAlpha = false, width = 0, height = 0, sawImage = false;
  let p = 12;
  while (p + 8 <= bytes.length) {
    const cc = fourcc(p);
    const size = u32(p + 4);
    const full = 8 + size + (size & 1);
    if (p + 8 + size > bytes.length) throw new Error(`packWebpAnim: ${label} truncated in ${cc}`);
    const q = p + 8;                              // payload start
    if (cc === 'VP8X') {
      if (bytes[q]! & 0x10) hasAlpha = true;
      width = u24(q + 4) + 1;
      height = u24(q + 7) + 1;
    } else if (cc === 'ALPH') {
      hasAlpha = true;
      imageChunks.push(bytes.subarray(p, p + full));
    } else if (cc === 'VP8 ') {
      imageChunks.push(bytes.subarray(p, p + full));
      sawImage = true;
      if (!width) {                              // lossy keyframe header: tag(3) + 9D 01 2A, then 14-bit dims
        width = (bytes[q + 6]! | (bytes[q + 7]! << 8)) & 0x3fff;
        height = (bytes[q + 8]! | (bytes[q + 9]! << 8)) & 0x3fff;
      }
    } else if (cc === 'VP8L') {
      imageChunks.push(bytes.subarray(p, p + full));
      sawImage = true;
      if (!width) {                              // 0x2f signature, then 14-bit w-1, 14-bit h-1, 1-bit alpha
        const bits = (bytes[q + 1]! | (bytes[q + 2]! << 8) | (bytes[q + 3]! << 16) | (bytes[q + 4]! << 24)) >>> 0;
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
        if ((bits >>> 28) & 1) hasAlpha = true;
      }
    }
    // ICCP / EXIF / XMP / ANIM / ANMF are ignored.
    p += full;
  }
  if (!sawImage) throw new Error(`packWebpAnim: ${label} has no VP8/VP8L image data`);
  return { chunks: concat(imageChunks), hasAlpha, width, height };
}

/**
 * Pack pre-encoded still WebP frames (identical geometry) into an animated WebP.
 *
 * frames : Uint8Array[] — complete still WebP files.
 * opts   : { delayMs = 67, loops = 0, width?, height?, background = transparent }
 *
 * Returns the animated WebP bytes as a Uint8Array.
 */
export function packWebpAnim(frames: Uint8Array[], opts: PackWebpAnimOptions = {}): Uint8Array {
  const { delayMs = 67, loops = 0, background = [0, 0, 0, 0] } = opts;
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error('packWebpAnim: frames must be a non-empty array of encoded WebP byte arrays');
  }
  if (!Number.isInteger(loops) || loops < 0) {
    throw new Error('packWebpAnim: loops must be a non-negative integer (0 = infinite)');
  }

  const imgs = frames.map((f, i) => {
    if (!(f instanceof Uint8Array)) throw new Error(`packWebpAnim: frame ${i} is not a Uint8Array`);
    return parseStillWebp(f, `frame ${i}`);
  });
  const width = opts.width ?? imgs[0]!.width;
  const height = opts.height ?? imgs[0]!.height;
  const hasAlpha = imgs.some(im => im.hasAlpha);

  // VP8X: flags byte (Animation | Alpha) + 3 reserved + canvas (w-1, h-1) u24LE.
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x02 | (hasAlpha ? 0x10 : 0);
  vp8x.set(u24LE(width - 1), 4);
  vp8x.set(u24LE(height - 1), 7);

  // ANIM: background colour (BGRA byte order) + loop_count (u16LE, 0 = infinite).
  const anim = new Uint8Array(6);
  anim[0] = background[2] & 0xff; anim[1] = background[1] & 0xff; anim[2] = background[0] & 0xff; anim[3] = background[3] & 0xff;
  anim.set(u16LE(Math.min(0xffff, loops)), 4);

  const parts: Uint8Array[] = [chunk('VP8X', vp8x), chunk('ANIM', anim)];

  // One ANMF per frame: full-canvas region at 0,0, Blending=overwrite (0x02),
  // Disposal=none — the SOURCE semantics apng.ts uses, so transparent pixels
  // replace rather than compositing over the previous frame.
  for (let i = 0; i < imgs.length; i++) {
    const raw = Array.isArray(delayMs) ? delayMs[i] : delayMs;
    const dur = Number.isFinite(raw) && (raw as number) >= 0 ? Math.min(0xffffff, Math.max(1, Math.round(raw as number))) : 67;
    const hdr = new Uint8Array(16);
    hdr.set(u24LE(0), 0);            // X / 2
    hdr.set(u24LE(0), 3);            // Y / 2
    hdr.set(u24LE(width - 1), 6);    // W - 1
    hdr.set(u24LE(height - 1), 9);   // H - 1
    hdr.set(u24LE(dur), 12);         // duration (ms)
    hdr[15] = 0x02;                  // Blending=1 (overwrite), Disposal=0
    parts.push(chunk('ANMF', concat([hdr, imgs[i]!.chunks])));
  }

  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set([0x52, 0x49, 0x46, 0x46], 0);   // 'RIFF'
  const riffSize = 4 + body.length;        // 'WEBP' + chunks; == total - 8
  out[4] = riffSize & 0xff; out[5] = (riffSize >>> 8) & 0xff; out[6] = (riffSize >>> 16) & 0xff; out[7] = (riffSize >>> 24) & 0xff;
  out.set([0x57, 0x45, 0x42, 0x50], 8);    // 'WEBP'
  out.set(body, 12);
  return out;
}
