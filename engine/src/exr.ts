// SPDX-License-Identifier: MPL-2.0
/**
 * OpenEXR encoder - scanline, HALF (float16) or FLOAT (32-bit), NONE/ZIPS/ZIP.
 *
 * plans/61-deeprichpixels.md section 4.2 / section 6 Phase B3, surfaced CLI-first per section 10 item 4.
 * This format is for professional video, compositing, and colour pipelines:
 * every VFX and compositing tool reads OpenEXR (Nuke, Resolve, Flame, Fusion,
 * Blender, Houdini, RV, OIIO), and none of them accept a browser format.
 * PNG at 16 bits is a deep *display* master; EXR is a deep *scene-linear* one -
 * unbounded, negative-tolerant, and the only container in this tree that can
 * carry a `DeepFrame` without losing either end of its range.
 *
 * ─── What the caller hands over (colour) ────────────────────────────────────
 * A {@link DeepFrame}: RGBA interleaved float32, LINEAR light, un-premultiplied,
 * unbounded. That is already the EXR convention - "the values in an OpenEXR
 * file are usually scene-linear" (OpenEXR Technical Introduction, "Overview of
 * the OpenEXR File Format" / "Display-Referred vs. Scene-Referred"). This writer
 * therefore applies NO transfer curve, NO tone map and NO clamp: what is in the
 * frame is what lands in the file, `>1.0` and `<0.0` included. A caller who
 * wants display-referred pixels must run a view transform (`hdr.ts`) first and
 * knowingly hand over the result.
 *
 * The frame's `space` is written into the file as a `chromaticities` attribute
 * whenever it is not sRGB/Rec.709 primaries, so a compositor is told which
 * primaries the numbers are in rather than assuming the EXR default. An EXR with
 * no `chromaticities` attribute means Rec.709 primaries with a D65 white
 * (OpenEXR File Layout, "chromaticities"; Technical Introduction, "RGB Colour"),
 * which is exactly `srgb-linear` - so omitting it there is the honest encoding,
 * not a shortcut. `xyz-d50` and `lab` frames are refused: EXR's R/G/B channels
 * are RGB primaries by definition and there is no chromaticity triple that
 * describes a CIELAB buffer. Convert first (`pixels.ts#convertSpace`).
 *
 * SEAM (same rule `png.ts` and `tiff.ts` state, same reason - plan section 10, depth
 * follows provenance): this writer never invents depth. It writes float samples
 * because a `DeepFrame` genuinely holds float samples; it will happily encode a
 * frame that came from 8-bit bytes, but that is the caller's provenance claim to
 * make, not a quality upgrade this module performs.
 *
 * ─── What it emits (OpenEXR File Layout spec, https://openexr.com/en/latest/
 *     OpenEXRFileLayout.html - every field cited at its write site below) ──────
 *   magic (0x01312f76) → version+flags → header attributes → chunk offset table
 *   → scan line blocks.
 * Single-part, scanline, non-deep, INCREASING_Y. Channels are HALF by default
 * (`pixelType: 'float'` for 32-bit) and named R/G/B/A, written in the
 * ALPHABETICAL order the format requires - A, B, G, R.
 *
 * ─── Compression ────────────────────────────────────────────────────────────
 * `none` (1 scanline per block), `zips` (zlib, 1 scanline per block) and `zip`
 * (zlib, 16 scanlines per block - the default, and what every DCC writes). The
 * zlib body is preceded by OpenEXR's byte reordering + delta predictor, which is
 * the part people get wrong: the bytes are DE-INTERLEAVED FIRST (even-indexed
 * bytes into the first half of the buffer, odd-indexed into the second) and only
 * THEN delta-encoded across the whole reordered buffer. Doing it the other way
 * round produces a file that inflates fine and decodes to garbage. Reference:
 * `Imf::Zip::compress` in src/lib/OpenEXR/ImfZip.cpp (OpenEXR 3.x, BSD-3-Clause)
 * - reproduced in {@link zipPreprocess} with the C loop structure preserved so
 * the correspondence is checkable by eye.
 *
 * Deliberately NO PIZ. PIZ is a wavelet transform plus a Huffman coder with its
 * own bit-packed code table. Implementing it needs several hundred lines of
 * complex code, and it is easy to get subtly wrong. ZIP is universally
 * readable, and on rendered (non-grainy) imagery the size difference is only
 * single-digit percent. Same reasoning applies to RLE, PXR24 (lossy 24-bit
 * float), B44/B44A, and DWAA/DWAB (lossy DCT): every one of them is optional,
 * and every reader can inflate ZIP. If PIZ is needed later, add it as its own
 * module with its own fuzz corpus, not as a fourth branch here.
 *
 * ─── Reference source, not vendored code ─────────────────────────────────────
 * three.js's `EXRExporter` (MIT, examples/jsm/exporters/EXRExporter.js) was
 * read as prior art for this subset of the format; no code from it is present
 * here. The field layout below is written from the OpenEXR file-layout
 * specification, and the predictor from ImfZip.cpp, both cited inline.
 *
 * Not in the engine barrel: EXR is consumed by deep-path import (the `bytes.ts`
 * / `gainmap.ts` precedent), not by every shell.
 */

import { createZlibStream } from './deflate.ts';
import { packF16, type DeepFrame } from './pixels.ts';

// ─── constants from the spec ─────────────────────────────────────────────────

/**
 * Magic number: the four bytes 0x76 0x2f 0x31 0x01, i.e. the little-endian
 * int32 20000630 (File Layout, "Magic Number").
 */
export const EXR_MAGIC = 0x01312f76;

/** Format version in the low byte of the version field (File Layout, "Version Field"). */
const EXR_VERSION = 2;

/**
 * Version-field flag bit 10: any attribute name, attribute type name or channel
 * name longer than 31 bytes (File Layout, "Version Field" - the long-name flag).
 * Our own names are all short; the bit exists for caller-supplied attributes.
 */
const FLAG_LONG_NAMES = 0x400;

/** Maximum name length with the long-name flag set (File Layout). */
const MAX_NAME_LEN = 255;

/** Compression identifiers (File Layout, "compression"). */
const COMPRESSION_CODE = { none: 0, zips: 2, zip: 3 } as const;

/**
 * Scan lines per chunk, per compression method (File Layout, "Scan line
 * blocks"): NO_COMPRESSION and ZIPS store one scan line per block, ZIP sixteen.
 */
const LINES_PER_BLOCK = { none: 1, zips: 1, zip: 16 } as const;

/** Channel pixel types (File Layout, "chlist"): 0 = UINT, 1 = HALF, 2 = FLOAT. */
const PIXEL_TYPE_CODE = { half: 1, float: 2 } as const;

const BYTES_PER_SAMPLE = { half: 2, float: 4 } as const;

/** Slab size for the streaming deflater, so per-block scratch stays bounded. */
const DEFLATE_SLAB = 65536;

// ─── options ─────────────────────────────────────────────────────────────────

export type ExrCompression = keyof typeof COMPRESSION_CODE;
export type ExrPixelType = keyof typeof PIXEL_TYPE_CODE;

export interface PackExrOptions {
  /** Sample type. Default `'half'` - IEEE 754 binary16, what EXR exists for. */
  pixelType?: ExrPixelType;
  /** Default `'zip'` (16 scan lines per deflate block). */
  compression?: ExrCompression;
  /** Write an alpha channel. Default `'rgba'`. */
  channels?: 'rgba' | 'rgb';
  /**
   * Alpha association. OpenEXR has no metadata flag for this and the ecosystem
   * convention is ASSOCIATED (premultiplied) alpha - "RGB values are
   * premultiplied by alpha" (Technical Introduction, "Premultiplied vs.
   * Un-Premultiplied Colour Channels"); Nuke and Fusion both assume it. A
   * `DeepFrame` is un-premultiplied by contract, so the default multiplies at
   * this encode boundary. `'straight'` writes the frame's values untouched for
   * callers who know their consumer wants that. The frame itself is never
   * mutated either way. Ignored when `channels: 'rgb'`.
   */
  alpha?: 'premultiplied' | 'straight';
  /**
   * `'auto'` (default) writes a `chromaticities` attribute when the frame's
   * space is not sRGB/Rec.709 primaries - where the attribute's absence already
   * means exactly that. `'always'` writes it unconditionally; `'never'` omits
   * it; an explicit 8-tuple `[rx, ry, gx, gy, bx, by, wx, wy]` overrides the
   * space entirely (for a caller who knows better, e.g. an ACES working space).
   */
  chromaticities?: 'auto' | 'always' | 'never' | readonly number[];
  /** `pixelAspectRatio` attribute. Default 1. */
  pixelAspectRatio?: number;
  /**
   * Extra `string`-typed header attributes (e.g. `comments`, `owner`,
   * `software`) - written after the required ones, sorted by name so output
   * stays byte-deterministic. Reserved names are refused.
   */
  attributes?: Readonly<Record<string, string>>;
  /** Write the default `software` source attribution (default true). The shell sets it
   *  false for a metadata-stripped export (URL `meta=off`). Caller `attributes` still win. */
  attribution?: boolean;
}

// ─── chromaticities ──────────────────────────────────────────────────────────

/**
 * CIE xy primaries + white per pixel space, in the attribute's field order
 * (File Layout, "chromaticities": red.x red.y green.x green.y blue.x blue.y
 * white.x white.y, eight floats).
 *
 * Sources: Rec.709 primaries with D65 - ITU-R BT.709-6 Table 1 (also the EXR
 * default, Technical Introduction "RGB Colour"). Display-P3 - SMPTE EG 432-1
 * primaries with the D65 white CSS Color 4 section 10.4 uses. Rec.2020 - ITU-R
 * BT.2020-2 Table 3. The same primaries the matrices in `pixels.ts` are built
 * from, so the tag and the numbers cannot disagree.
 */
const CHROMATICITIES: Readonly<Record<string, readonly number[]>> = {
  'srgb-linear': [0.64, 0.33, 0.30, 0.60, 0.15, 0.06, 0.3127, 0.3290],
  'display-p3-linear': [0.680, 0.320, 0.265, 0.690, 0.150, 0.060, 0.3127, 0.3290],
  'rec2020-linear': [0.708, 0.292, 0.170, 0.797, 0.131, 0.046, 0.3127, 0.3290],
};

// ─── byte sink ───────────────────────────────────────────────────────────────

class Sink {
  private buf: Uint8Array;
  private view: DataView;
  len = 0;

  constructor(capacity = 1024) {
    this.buf = new Uint8Array(Math.max(64, capacity));
    this.view = new DataView(this.buf.buffer);
  }

  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    const grown = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    grown.set(this.buf.subarray(0, this.len));
    this.buf = grown;
    this.view = new DataView(grown.buffer);
  }

  u8(v: number): void { this.ensure(1); this.buf[this.len++] = v & 0xff; }
  i32(v: number): void { this.ensure(4); this.view.setInt32(this.len, v, true); this.len += 4; }
  u64(v: number): void { this.ensure(8); this.view.setBigUint64(this.len, BigInt(v), true); this.len += 8; }
  f32(v: number): void { this.ensure(4); this.view.setFloat32(this.len, v, true); this.len += 4; }
  bytes(b: Uint8Array): void { this.ensure(b.length); this.buf.set(b, this.len); this.len += b.length; }
  /** Null-terminated name (File Layout uses C strings for every name field). */
  name(s: string): void { this.bytes(utf8(s)); this.u8(0); }

  take(): Uint8Array { return this.buf.slice(0, this.len); }
}

const utf8 = (s: string): Uint8Array => {
  // Names and string attributes in EXR are byte strings; UTF-8 is what every
  // modern writer puts there. Hand-rolled so the engine needs no TextEncoder.
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(out);
};

// ─── the ZIP preprocessor ────────────────────────────────────────────────────

/**
 * OpenEXR's ZIP/ZIPS pre-compression transform, applied to a block's raw bytes
 * before deflate. Reproduces `Imf::Zip::compress`, src/lib/OpenEXR/ImfZip.cpp
 * (OpenEXR 3.x, BSD-3-Clause), in its original two-step order:
 *
 *  1. **Reorder** - even-indexed source bytes fill `tmp[0 .. ceil(n/2))`,
 *     odd-indexed bytes fill `tmp[ceil(n/2) .. n)`. For HALF samples this puts
 *     every low byte together and every high byte together, so the high halves
 *     (which barely change between neighbouring pixels) become a long run of
 *     near-identical bytes. This is why it comes FIRST: it is what makes the
 *     delta in step 2 small.
 *  2. **Delta-encode** - over the whole reordered buffer, `out[i] = tmp[i] -
 *     tmp[i-1] + 384` truncated to 8 bits (the `+ (128 + 256)` in the reference
 *     is a bias that keeps the C `int` arithmetic away from negative values
 *     before the narrowing store; only the low byte survives either way).
 *
 * The inverse is `Imf::Zip::uncompress`: undo the delta first
 * (`t[i] = t[i-1] + t[i] - 128`), then interleave back.
 *
 * Returns a new buffer; `raw` is untouched.
 */
function zipPreprocess(raw: Uint8Array): Uint8Array {
  const n = raw.length;
  const tmp = new Uint8Array(n);
  if (n === 0) return tmp;

  // 1. reorder (ImfZip.cpp: two write cursors, t1 at 0 and t2 at (n+1)/2)
  let t1 = 0;
  let t2 = (n + 1) >> 1;
  let s = 0;
  for (;;) {
    if (s < n) tmp[t1++] = raw[s++]!; else break;
    if (s < n) tmp[t2++] = raw[s++]!; else break;
  }

  // 2. predictor (ImfZip.cpp: p holds the PREVIOUS original byte, not the
  //    previous delta - so this is a first-order delta, not a running sum)
  let p = tmp[0]!;
  for (let i = 1; i < n; i++) {
    const cur = tmp[i]!;
    tmp[i] = (cur - p + (128 + 256)) & 0xff;
    p = cur;
  }
  return tmp;
}

/** Deflate a block body with the slab-fed zlib stream, so scratch stays O(1). */
function zlibBlock(pre: Uint8Array): Uint8Array {
  const z = createZlibStream();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let o = 0; o < pre.length; o += DEFLATE_SLAB) {
    const part = z.push(pre.subarray(o, Math.min(o + DEFLATE_SLAB, pre.length)));
    if (part.length) { parts.push(part); total += part.length; }
  }
  const tail = z.finish();
  if (tail.length) { parts.push(tail); total += tail.length; }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ─── the writer ──────────────────────────────────────────────────────────────

/** Header attribute names this module owns; a caller cannot shadow them. */
const RESERVED_ATTRS = new Set([
  'channels', 'chromaticities', 'compression', 'dataWindow', 'displayWindow',
  'lineOrder', 'pixelAspectRatio', 'screenWindowCenter', 'screenWindowWidth',
  'tiles', 'name', 'type', 'version', 'chunkCount',
]);

/**
 * Encode a {@link DeepFrame} as a single-part scanline OpenEXR file.
 *
 * @param frame linear, un-premultiplied, unbounded RGBA float (see module header)
 * @returns the complete file bytes
 */
export function packExr(frame: DeepFrame, opts: PackExrOptions = {}): Uint8Array {
  const { width, height, data, space } = frame;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`packExr: invalid frame dimensions ${width}x${height}`);
  }
  if (data.length !== width * height * 4) {
    throw new Error(`packExr: buffer length ${data.length} != ${width}x${height}x4`);
  }
  if (space === 'lab' || space === 'xyz-d50') {
    throw new Error(`packExr: ${space} is not an RGB space; convertSpace to an RGB space first`);
  }

  const pixelType: ExrPixelType = opts.pixelType ?? 'half';
  const compression: ExrCompression = opts.compression ?? 'zip';
  if (!(pixelType in PIXEL_TYPE_CODE)) throw new Error(`packExr: unknown pixelType ${String(pixelType)}`);
  if (!(compression in COMPRESSION_CODE)) throw new Error(`packExr: unknown compression ${String(compression)}`);
  const withAlpha = (opts.channels ?? 'rgba') === 'rgba';
  const premultiplied = withAlpha && (opts.alpha ?? 'premultiplied') === 'premultiplied';
  const par = opts.pixelAspectRatio ?? 1;
  if (!Number.isFinite(par) || par <= 0) throw new Error(`packExr: pixelAspectRatio must be > 0, got ${par}`);

  // Channel list, ALPHABETICAL - the format requires it (File Layout, "chlist":
  // "channels are stored in the file in alphabetical order"), so RGBA is written
  // A, B, G, R. `srcIndex` maps each back to its RGBA offset in the frame.
  const channels = withAlpha
    ? [{ name: 'A', srcIndex: 3 }, { name: 'B', srcIndex: 2 }, { name: 'G', srcIndex: 1 }, { name: 'R', srcIndex: 0 }]
    : [{ name: 'B', srcIndex: 2 }, { name: 'G', srcIndex: 1 }, { name: 'R', srcIndex: 0 }];

  const chroma = resolveChromaticities(opts.chromaticities ?? 'auto', space);
  // Default `software` attribution (the EXR standard's own generator field) so every
  // EXR names its source; a metadata-stripped export sets `attribution: false` to drop
  // it. Caller-supplied attributes always pass through (an explicit choice).
  const base = opts.attribution === false ? {} : { software: 'Lolly lolly.tools' };
  const extras = Object.entries({ ...base, ...(opts.attributes ?? {}) }).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [k] of extras) {
    if (RESERVED_ATTRS.has(k)) throw new Error(`packExr: attribute "${k}" is written by the encoder and cannot be overridden`);
    if (k.length === 0) throw new Error('packExr: attribute name must not be empty');
    // A NUL or control byte terminates the name field early, producing a
    // structurally corrupt header the reference reader cannot open at all.
    if (/[\x00-\x1f\x7f]/.test(k)) throw new Error(`packExr: attribute name ${JSON.stringify(k)} contains a control byte`);
    if (utf8(k).length > MAX_NAME_LEN) throw new Error(`packExr: attribute name "${k}" exceeds ${MAX_NAME_LEN} bytes`);
  }
  // Long-name flag: set only if some name actually needs it (File Layout,
  // "Version Field"). All of ours are short, so a plain file never sets it.
  const longNames = extras.some(([k]) => utf8(k).length > 31);

  // ── header ────────────────────────────────────────────────────────────────
  const h = new Sink(512);
  h.i32(EXR_MAGIC);                                        // magic number
  h.i32(EXR_VERSION | (longNames ? FLAG_LONG_NAMES : 0));  // version + flags
                                                           // (bit 9 tiled, 11 deep,
                                                           // 12 multipart: all clear)

  // Attributes are name-keyed and order-free in the spec; written alphabetically
  // for byte-determinism.
  attr(h, 'channels', 'chlist', (s) => {
    for (const c of channels) {
      s.name(c.name);                       // channel name, null-terminated
      s.i32(PIXEL_TYPE_CODE[pixelType]);    // pixel type
      s.u8(0);                              // pLinear (perceptually-linear hint,
                                            // only used by the lossy codecs)
      s.u8(0); s.u8(0); s.u8(0);            // 3 reserved bytes, must be 0
      s.i32(1);                             // xSampling
      s.i32(1);                             // ySampling
    }
    s.u8(0);                                // null byte terminates the chlist
  });

  if (chroma) {
    attr(h, 'chromaticities', 'chromaticities', (s) => { for (const v of chroma) s.f32(v); });
  }

  attr(h, 'compression', 'compression', (s) => s.u8(COMPRESSION_CODE[compression]));
  // box2i: xMin, yMin, xMax, yMax - INCLUSIVE, so xMax = width - 1.
  const box = (s: Sink): void => { s.i32(0); s.i32(0); s.i32(width - 1); s.i32(height - 1); };
  attr(h, 'dataWindow', 'box2i', box);
  attr(h, 'displayWindow', 'box2i', box);
  attr(h, 'lineOrder', 'lineOrder', (s) => s.u8(0));       // 0 = INCREASING_Y
  attr(h, 'pixelAspectRatio', 'float', (s) => s.f32(par));
  attr(h, 'screenWindowCenter', 'v2f', (s) => { s.f32(0); s.f32(0); });
  attr(h, 'screenWindowWidth', 'float', (s) => s.f32(1));
  for (const [k, v] of extras) {
    // A `string` attribute's bytes are NOT null-terminated: the attribute size
    // is the length (File Layout, "string").
    attr(h, k, 'string', (s) => s.bytes(utf8(v)));
  }
  h.u8(0);                                                 // empty name ends the header

  // ── chunks ────────────────────────────────────────────────────────────────
  const linesPerBlock = LINES_PER_BLOCK[compression];
  const numBlocks = Math.ceil(height / linesPerBlock);
  const bps = BYTES_PER_SAMPLE[pixelType];
  const rowBytes = width * bps * channels.length;

  const chunks: { y: number; body: Uint8Array }[] = [];
  const rowF32 = new Float32Array(width);
  for (let b = 0; b < numBlocks; b++) {
    const y0 = b * linesPerBlock;
    const lines = Math.min(linesPerBlock, height - y0);
    const raw = new Uint8Array(lines * rowBytes);
    const rv = new DataView(raw.buffer);
    let off = 0;
    // Block layout: for each scan line, for each channel in chlist order, the
    // whole scan line's samples for that channel (File Layout, "Scan line blocks").
    for (let dy = 0; dy < lines; dy++) {
      const rowStart = (y0 + dy) * width * 4;
      for (const c of channels) {
        for (let x = 0; x < width; x++) {
          const i = rowStart + x * 4;
          const v = data[i + c.srcIndex]!;
          rowF32[x] = premultiplied && c.srcIndex !== 3 ? v * data[i + 3]! : v;
        }
        if (pixelType === 'half') {
          // packF16 owns every float16 decision (RNE, subnormals, overflow to
          // Inf) - pixels.ts is the single implementation, never a second one
          // here. Bit patterns are then written little-endian explicitly rather
          // than reusing the typed array's memory, so the file does not depend
          // on the host's byte order.
          const bits = packF16(rowF32);
          for (let x = 0; x < width; x++) { rv.setUint16(off, bits[x]!, true); off += 2; }
        } else {
          for (let x = 0; x < width; x++) { rv.setFloat32(off, rowF32[x]!, true); off += 4; }
        }
      }
    }

    let body: Uint8Array = raw;
    if (compression !== 'none') {
      const deflated = zlibBlock(zipPreprocess(raw));
      // A reader treats a chunk whose data size is NOT smaller than the block's
      // uncompressed size as raw, uncompressed data (ImfScanLineInputFile.cpp:
      // `if (dataSize < uncompressedSize) uncompress(...) else use as-is`). So
      // "did not get smaller" must be written raw, or the file is undecodable.
      // Note this uses `>=` where OpenEXR's own ZipCompressor uses `>`, which
      // leaves an exact-tie chunk mislabelled; being stricter is free and safe.
      if (deflated.length < raw.length) body = deflated;
    }
    chunks.push({ y: y0, body });
  }

  // ── offset table + assembly ───────────────────────────────────────────────
  // The chunk offset table follows the header immediately: one unsigned 64-bit
  // little-endian file offset per chunk, in chunk order (File Layout, "Chunk
  // offset table"). Each entry points at the chunk's first byte - i.e. at its
  // y coordinate field, not at the pixel data.
  const tableBytes = numBlocks * 8;
  const headerBytes = h.take();
  let cursor = headerBytes.length + tableBytes;

  const table = new Sink(tableBytes);
  for (const c of chunks) {
    table.u64(cursor);
    cursor += 8 + c.body.length;   // int32 y + int32 dataSize + the data
  }

  const out = new Uint8Array(cursor);
  let at = 0;
  out.set(headerBytes, at); at += headerBytes.length;
  out.set(table.take(), at); at += tableBytes;
  const ov = new DataView(out.buffer);
  for (const c of chunks) {
    ov.setInt32(at, c.y, true); at += 4;          // y of the block's first scan line
    ov.setInt32(at, c.body.length, true); at += 4; // size of the data that follows
    out.set(c.body, at); at += c.body.length;
  }
  return out;
}

function attr(h: Sink, name: string, type: string, write: (s: Sink) => void): void {
  // Attribute record: name\0, type\0, int32 size, size bytes of data
  // (File Layout, "Header").
  const body = new Sink(64);
  write(body);
  const bytes = body.take();
  h.name(name);
  h.name(type);
  h.i32(bytes.length);
  h.bytes(bytes);
}

function resolveChromaticities(
  mode: 'auto' | 'always' | 'never' | readonly number[],
  space: DeepFrame['space'],
): readonly number[] | null {
  if (Array.isArray(mode) || ArrayBuffer.isView(mode)) {
    const arr = mode as readonly number[];
    if (arr.length !== 8) throw new Error(`packExr: chromaticities must be 8 numbers, got ${arr.length}`);
    for (const v of arr) if (!Number.isFinite(v)) throw new Error('packExr: chromaticities must be finite');
    return arr;
  }
  if (mode === 'never') return null;
  const known = CHROMATICITIES[space];
  if (!known) throw new Error(`packExr: no chromaticities known for space ${space}`);
  // 'auto': an absent attribute already MEANS Rec.709/D65, so writing it for
  // srgb-linear would be redundant bytes saying the same thing.
  if (mode === 'auto' && space === 'srgb-linear') return null;
  return known;
}
