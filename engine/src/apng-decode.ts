// SPDX-License-Identifier: MPL-2.0
/**
 * APNG demuxer - pure, DOM-free, platform-agnostic. The inverse of apng.ts.
 *
 * Chunk-level surgery only, no pixel work. An Animated PNG is split into its
 * frames WITHOUT rasterising: each frame's already-compressed image data (the
 * default image's IDAT stream, or a later frame's fdAT stream with its 4-byte
 * sequence prefix removed) is re-wrapped as a STANDALONE, spec-valid PNG:
 * signature, a fresh IHDR sized to that frame's region, the shared colour/
 * palette ancillary chunks carried over verbatim, one IDAT, IEND. The host then
 * decodes each still through its ordinary PNG path; the engine never pulls in a
 * pixel decoder (the demux boundary the plan mandates for VP8/PNG rasterisation).
 *
 * Per fcTL geometry the default (pre-acTL) IDAT image may or may not be a visible
 * animation frame: when an fcTL precedes the first IDAT it is frame 0, when it
 * does not the default image is a hidden fallback and the animation starts at the
 * first fdAT frame. Both layouts are handled.
 *
 * Like apng.ts / emf.ts this is a byte-format authority: no DOM, no external
 * deps, fully node:test-able.
 */

import { crc32 } from './zip-crypto.ts';

/** One demuxed animation frame as a standalone PNG plus its APNG geometry/timing. */
export interface ApngFrame {
  /** A complete, valid PNG file for this frame's region. The host decodes it. */
  still: Uint8Array;
  /** Display time in milliseconds (delay_num / delay_den, den 0 ⇒ 100). */
  delayMs: number;
  /** Frame region x offset within the canvas (fcTL x_offset). */
  x: number;
  /** Frame region y offset within the canvas (fcTL y_offset). */
  y: number;
  /** APNG dispose_op: 0 NONE, 1 BACKGROUND, 2 PREVIOUS. */
  dispose: number;
  /** APNG blend_op: 0 SOURCE, 1 OVER. */
  blend: number;
}

/** Result of {@link demuxApng}. */
export interface DemuxApngResult {
  /** Canvas width (default image IHDR width). */
  width: number;
  /** Canvas height (default image IHDR height). */
  height: number;
  /** acTL num_plays. 0 means loop forever. */
  loops: number;
  /** Frames in display order. */
  frames: ApngFrame[];
}

const PNG_SIG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/**
 * Ancillary chunks that describe how EVERY frame's samples are interpreted, so
 * they must ride onto each standalone still. PLTE/tRNS are mandatory for indexed
 * images; the rest are colour/precision fidelity. Frame-local and animation
 * control chunks are deliberately excluded: a standalone still has neither.
 */
const SHARED_CHUNKS = new Set([
  'PLTE', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'hIST', 'pHYs', 'sPLT', 'cICP',
]);

interface PngChunk {
  type: string;
  data: Uint8Array;
}

function readU32(bytes: Uint8Array, off: number): number {
  return ((bytes[off]! << 24) | (bytes[off + 1]! << 16) | (bytes[off + 2]! << 8) | bytes[off + 3]!) >>> 0;
}

function readU16(bytes: Uint8Array, off: number): number {
  return ((bytes[off]! << 8) | bytes[off + 1]!) >>> 0;
}

function writeU32(bytes: Uint8Array, off: number, value: number): void {
  bytes[off] = (value >>> 24) & 0xff;
  bytes[off + 1] = (value >>> 16) & 0xff;
  bytes[off + 2] = (value >>> 8) & 0xff;
  bytes[off + 3] = value & 0xff;
}

/** Serialize one chunk: length + 4-char type + data + CRC(type‖data). */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  writeU32(out, 8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Split an encoded PNG into { type, data } chunks. Throws on a bad signature or truncation. */
function parseChunks(bytes: Uint8Array): PngChunk[] {
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) throw new Error('demuxApng: bad PNG signature');
  }
  const chunks: PngChunk[] = [];
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = readU32(bytes, off);
    const type = String.fromCharCode(bytes[off + 4]!, bytes[off + 5]!, bytes[off + 6]!, bytes[off + 7]!);
    const end = off + 12 + len;
    if (end > bytes.length) throw new Error(`demuxApng: truncated inside a ${type} chunk`);
    chunks.push({ type, data: bytes.subarray(off + 8, off + 8 + len) });
    off = end;
    if (type === 'IEND') break;
  }
  if (!chunks.length || chunks[0]!.type !== 'IHDR' || chunks[0]!.data.length !== 13) {
    throw new Error('demuxApng: no valid IHDR chunk');
  }
  return chunks;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** A frame under construction while walking the chunk stream. */
interface PendingFrame {
  width: number;
  height: number;
  x: number;
  y: number;
  delayMs: number;
  dispose: number;
  blend: number;
  data: Uint8Array[]; // IDAT / de-prefixed fdAT payloads, in order
}

/** delay_num / delay_den → milliseconds. delay_den 0 is treated as 100 (spec). */
function delayToMs(num: number, den: number): number {
  const d = den === 0 ? 100 : den;
  return (num / d) * 1000;
}

/**
 * Demux an APNG into standalone per-frame PNGs without rasterising.
 *
 * @param bytes a complete Animated PNG file.
 * @returns canvas geometry, loop count, and each frame as a standalone PNG plus
 *   its region/timing/compositing ops. Throws if the input is not a valid PNG
 *   or carries no acTL (i.e. is a plain still PNG).
 */
export function demuxApng(bytes: Uint8Array): DemuxApngResult {
  if (!(bytes instanceof Uint8Array)) throw new Error('demuxApng: input is not a Uint8Array');
  const chunks = parseChunks(bytes);

  const ihdr = chunks[0]!.data;                 // 13 bytes; bytes 8..12 = depth/colour/comp/filter/interlace
  const canvasWidth = readU32(ihdr, 0);
  const canvasHeight = readU32(ihdr, 4);

  // Shared header carried onto every still: a fresh IHDR (resized per frame) plus
  // the colour/palette ancillary chunks that appear before any image data.
  const shared: PngChunk[] = [];
  let loops = 0;
  let sawActl = false;

  const frames: PendingFrame[] = [];
  let current: PendingFrame | null = null;
  let sawIdat = false; // any IDAT seen - distinguishes a default frame from a hidden default image

  const flush = (): void => {
    if (current) { frames.push(current); current = null; }
  };

  for (const c of chunks) {
    switch (c.type) {
      case 'IHDR':
      case 'IEND':
        break;
      case 'acTL': {
        sawActl = true;
        if (c.data.length >= 8) loops = readU32(c.data, 4);
        break;
      }
      case 'fcTL': {
        // A new fcTL begins a new frame; flush the one in progress.
        flush();
        const d = c.data;
        if (d.length < 26) throw new Error('demuxApng: fcTL chunk is too short');
        current = {
          width: readU32(d, 4),
          height: readU32(d, 8),
          x: readU32(d, 12),
          y: readU32(d, 16),
          delayMs: delayToMs(readU16(d, 20), readU16(d, 22)),
          dispose: d[24]!,
          blend: d[25]!,
          data: [],
        };
        break;
      }
      case 'IDAT': {
        sawIdat = true;
        // Belongs to the frame whose fcTL preceded it; with no such fcTL it is the
        // hidden default image (not part of the animation) and is dropped.
        if (current) current.data.push(c.data);
        break;
      }
      case 'fdAT': {
        // 4-byte sequence number prefix, then the frame's IDAT-equivalent data.
        if (!current) throw new Error('demuxApng: fdAT chunk with no preceding fcTL');
        if (c.data.length < 4) throw new Error('demuxApng: fdAT chunk is too short');
        current.data.push(c.data.subarray(4));
        break;
      }
      default: {
        // Carry shared colour/palette chunks that precede the first image data.
        // They apply to every frame. Per the PNG spec PLTE/tRNS/etc. always sit
        // before the first IDAT, but the APNG spec lets frame 0's fcTL come
        // before that IDAT too. So gate on `!sawIdat` alone, not on whether a
        // frame is open, or an indexed frame loses its palette and the standalone
        // still is invalid.
        if (!sawIdat && SHARED_CHUNKS.has(c.type)) {
          shared.push({ type: c.type, data: c.data });
        }
        break;
      }
    }
  }
  flush();

  if (!sawActl) throw new Error('demuxApng: not an APNG (no acTL chunk)');
  if (frames.length === 0) throw new Error('demuxApng: no fcTL frames found');

  const out: ApngFrame[] = frames.map((f, i) => {
    if (f.data.length === 0) throw new Error(`demuxApng: frame ${i} has no image data`);
    // Fresh IHDR: copy the default one, override width/height with the frame region.
    const fih = new Uint8Array(13);
    fih.set(ihdr);
    writeU32(fih, 0, f.width);
    writeU32(fih, 4, f.height);

    const parts: Uint8Array[] = [PNG_SIG, chunk('IHDR', fih)];
    for (const s of shared) parts.push(chunk(s.type, s.data));
    parts.push(chunk('IDAT', f.data.length === 1 ? f.data[0]! : concat(f.data)));
    parts.push(chunk('IEND', new Uint8Array(0)));

    return {
      still: concat(parts),
      delayMs: f.delayMs,
      x: f.x,
      y: f.y,
      dispose: f.dispose,
      blend: f.blend,
    };
  });

  return { width: canvasWidth, height: canvasHeight, loops, frames: out };
}
