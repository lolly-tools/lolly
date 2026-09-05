// SPDX-License-Identifier: MPL-2.0
/**
 * Animated WebP demuxer - pure, DOM-free, platform-agnostic. The inverse of
 * `webp-anim.ts` (`packWebpAnim`).
 *
 * Chunk-level surgery only: parse the RIFF/WEBP container's `VP8X` (canvas
 * geometry + flags), `ANIM` (background + loop count) and each `ANMF`
 * (per-frame region, timing, blend/dispose + the inner image bitstream), and
 * wrap every frame's image chunks (`ALPH`? + `VP8 `/`VP8L`) VERBATIM into a
 * STANDALONE still WebP file. No pixel work, no VP8/VP8L decode - the host hands
 * each recovered still to the platform's native WebP path to rasterize. That is
 * the established DEMUX boundary (cf. `apng-decode.ts`, the HEIC bundled decoder).
 *
 * Like webp-anim.ts / apng.ts / emf.ts this is a byte-format authority: no DOM,
 * no deps, fully node:test-able. WebP RIFF integers are LITTLE-endian.
 */

import { concatBytes as concat } from './bytes.ts';

/** One recovered animation frame. `still` is a complete, standalone still WebP. */
export interface WebpAnimFrame {
  /** Complete still WebP bytes ('RIFF'…'WEBP'); host decodes natively. */
  still: Uint8Array;
  /** Display duration in milliseconds (ANMF 24-bit field). */
  durationMs: number;
  /** Frame region X offset in canvas pixels. */
  x: number;
  /** Frame region Y offset in canvas pixels. */
  y: number;
  /** Frame region width in pixels. */
  frameWidth: number;
  /** Frame region height in pixels. */
  frameHeight: number;
  /** Disposal method bit: 0 = leave, 1 = dispose region to background. */
  dispose: number;
  /** Blending method bit: 0 = alpha-blend over canvas, 1 = overwrite. */
  blend: number;
}

export interface DemuxedWebpAnim {
  /** Canvas width in pixels (from VP8X). */
  width: number;
  /** Canvas height in pixels (from VP8X). */
  height: number;
  /** ANIM loop_count; 0 = loop forever. */
  loops: number;
  frames: WebpAnimFrame[];
}

const fourcc = (b: Uint8Array, o: number): string =>
  String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
const u16LEr = (b: Uint8Array, o: number): number => b[o]! | (b[o + 1]! << 8);
const u24LEr = (b: Uint8Array, o: number): number => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
const u32LEr = (b: Uint8Array, o: number): number =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

const u24LE = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff];

export const WEBP_DEMUX_MAX_INPUT_BYTES = 256 * 1024 * 1024;
export const WEBP_DEMUX_MAX_CHUNKS = 100_000;
export const WEBP_DEMUX_MAX_FRAMES = 4_096;
export const WEBP_DEMUX_MAX_DIM = 32_768;
export const WEBP_DEMUX_MAX_PIXELS = 128 * 1024 * 1024;
export const WEBP_DEMUX_MAX_OUTPUT_BYTES = 512 * 1024 * 1024;

// One RIFF chunk: fourcc(4) + u32LE payloadSize + payload + pad(0x00 iff odd).
function chunk(cc: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length + (payload.length & 1));
  for (let i = 0; i < 4; i++) out[i] = cc.charCodeAt(i);
  const n = payload.length;
  out[4] = n & 0xff; out[5] = (n >>> 8) & 0xff; out[6] = (n >>> 16) & 0xff; out[7] = (n >>> 24) & 0xff;
  out.set(payload, 8);
  return out;
}

// Wrap chunk bytes into a complete 'RIFF'<size>'WEBP' file.
function riffWebp(body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  out[0] = 0x52; out[1] = 0x49; out[2] = 0x46; out[3] = 0x46;   // 'RIFF'
  const riffSize = 4 + body.length;                              // 'WEBP' + body
  out[4] = riffSize & 0xff; out[5] = (riffSize >>> 8) & 0xff;
  out[6] = (riffSize >>> 16) & 0xff; out[7] = (riffSize >>> 24) & 0xff;
  out[8] = 0x57; out[9] = 0x45; out[10] = 0x42; out[11] = 0x50; // 'WEBP'
  out.set(body, 12);
  return out;
}

/**
 * Build a standalone still WebP from one ANMF's inner image chunks.
 *
 * `imageChunks` are complete RIFF chunks copied verbatim (an optional `ALPH`
 * before `VP8 `/`VP8L`). A lone `VP8 `/`VP8L` needs no header - that is the
 * canonical "simple" still form. Anything with a separate `ALPH` chunk requires
 * the extended `VP8X` form to be a legal still, so we prepend one declaring the
 * frame's dimensions and the alpha flag.
 */
function buildStill(imageChunks: Uint8Array, hasAlpha: boolean, w: number, h: number): Uint8Array {
  if (!hasAlpha) return riffWebp(imageChunks);
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x10;                    // Alpha flag (no animation, no other features)
  vp8x.set(u24LE(w - 1), 4);
  vp8x.set(u24LE(h - 1), 7);
  return riffWebp(concat([chunk('VP8X', vp8x), imageChunks]));
}

/**
 * Demultiplex an animated WebP into per-frame standalone still WebP files plus
 * geometry and timing.
 *
 * @param bytes complete animated WebP ('RIFF'…'WEBP' with VP8X animation flag).
 * @returns canvas dimensions, loop count, and one entry per ANMF.
 * @throws if the RIFF/WEBP signature is bad or a chunk is truncated.
 */
export function demuxWebpAnim(bytes: Uint8Array): DemuxedWebpAnim {
  if (bytes.length > WEBP_DEMUX_MAX_INPUT_BYTES) {
    throw new Error(`demuxWebpAnim: input exceeds ${WEBP_DEMUX_MAX_INPUT_BYTES} byte limit`);
  }
  if (bytes.length < 12 || fourcc(bytes, 0) !== 'RIFF' || fourcc(bytes, 8) !== 'WEBP') {
    throw new Error('demuxWebpAnim: not a WebP (bad RIFF/WEBP signature)');
  }
  const riffEnd = 8 + u32LEr(bytes, 4);
  if (riffEnd > bytes.length) throw new Error('demuxWebpAnim: RIFF size exceeds the input');

  let width = 0, height = 0, loops = 0;
  const frames: WebpAnimFrame[] = [];
  let chunks = 0;
  let outputBytes = 0;

  let p = 12;
  while (p + 8 <= riffEnd) {
    if (++chunks > WEBP_DEMUX_MAX_CHUNKS) {
      throw new Error(`demuxWebpAnim: more than ${WEBP_DEMUX_MAX_CHUNKS} chunks`);
    }
    const cc = fourcc(bytes, p);
    const size = u32LEr(bytes, p + 4);
    const full = 8 + size + (size & 1);
    if (p + 8 + size > riffEnd) throw new Error(`demuxWebpAnim: truncated in ${cc}`);
    const q = p + 8;                                   // payload start

    if (cc === 'VP8X') {
      if (size < 10) throw new Error('demuxWebpAnim: VP8X chunk is too short');
      width = u24LEr(bytes, q + 4) + 1;
      height = u24LEr(bytes, q + 7) + 1;
      validateGeometry(width, height, 'canvas');
    } else if (cc === 'ANIM') {
      if (size < 6) throw new Error('demuxWebpAnim: ANIM chunk is too short');
      loops = u16LEr(bytes, q + 4);
    } else if (cc === 'ANMF') {
      if (size < 16) throw new Error('demuxWebpAnim: ANMF chunk is too short');
      if (frames.length >= WEBP_DEMUX_MAX_FRAMES) {
        throw new Error(`demuxWebpAnim: more than ${WEBP_DEMUX_MAX_FRAMES} frames`);
      }
      // 16-byte frame header, then the inner image chunk stream.
      const fx = u24LEr(bytes, q) * 2;
      const fy = u24LEr(bytes, q + 3) * 2;
      const fw = u24LEr(bytes, q + 6) + 1;
      const fh = u24LEr(bytes, q + 9) + 1;
      const dur = u24LEr(bytes, q + 12);
      const flags = bytes[q + 15]!;
      const blend = (flags >> 1) & 1;
      const dispose = flags & 1;
      validateGeometry(fw, fh, 'frame');
      if (width && height && (fx + fw > width || fy + fh > height)) {
        throw new Error(`demuxWebpAnim: frame region ${fw}x${fh}+${fx}+${fy} escapes ${width}x${height} canvas`);
      }

      // Walk the frame's own chunk stream, collecting the image bitstream.
      const imgParts: Uint8Array[] = [];
      let hasAlpha = false;
      const frameEnd = q + size;                       // ANMF payload end (excl. RIFF pad)
      let fp = q + 16;
      while (fp + 8 <= frameEnd) {
        if (++chunks > WEBP_DEMUX_MAX_CHUNKS) {
          throw new Error(`demuxWebpAnim: more than ${WEBP_DEMUX_MAX_CHUNKS} chunks`);
        }
        const icc = fourcc(bytes, fp);
        const isize = u32LEr(bytes, fp + 4);
        const ifull = 8 + isize + (isize & 1);
        if (fp + 8 + isize > frameEnd) throw new Error(`demuxWebpAnim: truncated in ANMF/${icc}`);
        if (icc === 'ALPH') { hasAlpha = true; imgParts.push(bytes.subarray(fp, fp + ifull)); }
        else if (icc === 'VP8 ' || icc === 'VP8L') { imgParts.push(bytes.subarray(fp, fp + ifull)); }
        // Any other sub-chunk (unexpected) is ignored.
        fp += ifull;
      }
      if (imgParts.length === 0) throw new Error('demuxWebpAnim: ANMF has no VP8/VP8L image data');

      const imageBytes = imgParts.reduce((sum, part) => sum + part.length, 0);
      const stillBytes = 12 + imageBytes + (hasAlpha ? 18 : 0);
      outputBytes += stillBytes;
      if (!Number.isSafeInteger(outputBytes) || outputBytes > WEBP_DEMUX_MAX_OUTPUT_BYTES) {
        throw new Error(`demuxWebpAnim: standalone frames exceed ${WEBP_DEMUX_MAX_OUTPUT_BYTES} byte output limit`);
      }

      frames.push({
        still: buildStill(concat(imgParts), hasAlpha, fw, fh),
        durationMs: dur,
        x: fx,
        y: fy,
        frameWidth: fw,
        frameHeight: fh,
        dispose,
        blend,
      });
    }
    // ALPH/VP8/VP8L at top level (a still) and ICCP/EXIF/XMP are ignored.
    p += full;
  }

  return { width, height, loops, frames };
}

function validateGeometry(width: number, height: number, label: string): void {
  if (width < 1 || height < 1 || width > WEBP_DEMUX_MAX_DIM || height > WEBP_DEMUX_MAX_DIM
    || width * height > WEBP_DEMUX_MAX_PIXELS) {
    throw new Error(
      `demuxWebpAnim: ${label} ${width}x${height} exceeds ${WEBP_DEMUX_MAX_DIM} per side / ${WEBP_DEMUX_MAX_PIXELS} pixels`,
    );
  }
}
