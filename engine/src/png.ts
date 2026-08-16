// SPDX-License-Identifier: MPL-2.0
/**
 * PNG encoder: 8-bit and 16-bit truecolour, pure bytes, DOM-free.
 *
 * plans/61-deeprichpixels.md section 4.2 / section 6 Phase B1: the first *own* PNG writer in the
 * tree. Everything before this was chunk SURGERY on bytes a browser encoder
 * produced (shells/web/src/bridge/export-image-meta.ts splices pHYs / cICP /
 * iCCP / iTXt into `canvas.toBlob` output, and engine/src/apng.ts re-wraps whole
 * encoded frames), which can never raise the depth, because IHDR was written by
 * someone else and is never rewritten. Owning IHDR + IDAT is what unlocks
 * 16-bit-per-channel output, and with it the plan's sharpest existing defect:
 * PQ code values quantised to 8 bits (section 1). `pqToU16` now has somewhere to go.
 *
 * ─── Governing principle: depth follows provenance (plan section 10) ────────────────
 * This writer NEVER converts between depths. `depth: 16` requires a Uint16Array
 * the caller already produced at 16 bits; `depth: 8` requires 8-bit bytes. There
 * is deliberately no "widen my 8-bit buffer" path, because a 16-bit file made of
 * 8-bit pixels is padding sold as quality: the export-side twin of the silent
 * ingest crush Phase A fixed. Depth conversion is `pixels.ts`'s seam
 * (`toU16`/`toU8Srgb`), colour is `hdr.ts`/`icc-pixels.ts`'s; by the time bytes
 * reach here every such decision has already been made and recorded. Same seam
 * rule `tiff.ts` states in its header, same reason.
 *
 * ─── What it emits ──────────────────────────────────────────────────────────
 * Signature, then IHDR (colour type 2 RGB / 6 RGBA; bit depth 8 or 16;
 * compression 0, filter 0, interlace 0, the only combinations that matter for
 * a rendered design), optional cICP / pHYs / iTXt, one or more IDATs, IEND.
 * 16-bit samples are big-endian, per PNG's network byte order (spec section 7.1).
 * Note that is the opposite of `tiff.ts`, whose "II" files are little-endian;
 * a Uint16Array handed to both writers therefore lands as different bytes on
 * purpose.
 *
 * `cICP` is PNG Third Edition (W3C REC 2025-06-24, section 11.3.3.6): four bytes for
 * colour primaries, transfer function, matrix coefficients, full-range flag, all
 * H.273 code points. `HDR_PQ_CICP` from hdr.ts is exactly the shape this takes,
 * so a Rec.2100-PQ export is `{ ...HDR_PQ_CICP }` and nothing else. Matrix
 * coefficients MUST be 0 (identity/RGB) for a PNG. The spec forbids anything
 * else because PNG samples are already RGB, so a non-zero value is refused here
 * rather than written and silently mis-rendered.
 *
 * `pHYs` mirrors the shell's `insertPngPhys` semantics exactly (unit specifier 1
 * = metre, ppm = round(dpi / 0.0254), both axes equal) so an engine-encoded PNG
 * and a spliced browser PNG print at the same physical size. That equality is
 * asserted by test, not by comment.
 *
 * `iTXt` is an uncompressed passthrough (compression flag 0, spec section 11.3.4.5):
 * UTF-8 text with a language tag and translated keyword, for callers that want
 * XMP or a description in the file. Deflated iTXt is not emitted; nothing needs
 * it, and one compression path is easier to keep honest than two.
 *
 * ─── Filtering ──────────────────────────────────────────────────────────────
 * All five PNG filters (spec section 9.2) with libpng's minimum-sum-of-absolute-
 * differences heuristic per scanline, treating filtered bytes as signed. Cheap
 * (five passes over a row, no lookahead) and it is what every real encoder does.
 * `filter: 'none'` forces type 0 for callers that want the fastest possible
 * encode or byte-stable output independent of the heuristic. The 16-bit path
 * uses the SAME heuristic rather than fixed None: with bpp = 8 the left
 * neighbour is a whole pixel away, so Sub/Paeth still track gradients, and the
 * measurement is pinned in tests/png.test.ts (a 16-bit gradient is materially
 * smaller filtered than unfiltered).
 *
 * ─── How big images are compressed (the section 9b blocker, now lifted) ─────────────
 * `deflate.ts` grew the slab-fed deflater its old TODO here asked for
 * (`createZlibStream`: one 32 KB LZ77 window carried across pushes, blocks
 * emitted as they are produced, BFINAL only on finish). So there are two
 * compression paths here, chosen by size and NOTHING else:
 *
 * - up to `STREAM_ABOVE_BYTES` (4 MiB of filtered bytes): the one-shot
 *   `zlibCompress`, unchanged. Every PNG this writer has ever emitted is in this
 *   range, and its bytes are pinned by goldens (tests/png.test.ts) and hashed by
 *   C2PA, so the small path stays byte-for-byte what it was.
 * - above it: `createZlibStream`, fed one filtered scanline at a time. Scratch
 *   is ~450 KB of compressor state regardless of image size, AND the whole-image
 *   `filtered` buffer is never allocated (rows are filtered straight into the
 *   stream). A 4K 16-bit RGBA master (66 MiB of scanlines, ~530 MiB of one-shot
 *   tokenizer scratch before this) now compresses in a few hundred KB of working
 *   memory. Output is a normal multi-block DEFLATE stream, spec-valid
 *   everywhere, a fraction of a percent larger than one-shot.
 *
 * `maxDeflateBytes` survives as a deliberate ceiling, but it is no longer a
 * MEMORY ceiling: the default is `DEFAULT_MAX_DEFLATE_BYTES` (1 GiB of filtered
 * bytes ≈ 134 megapixels of 16-bit RGBA), which is a sanity bound on the single
 * Uint8Array this function returns, not a statement about scratch. A caller that
 * passes a small cap still gets the old loud refusal. That is the seam the web
 * shell's HDR path uses to fall back, or, with `oversize: 'store'`, a
 * spec-valid uncompressed zlib stream (RFC 1951 section 3.2.4 stored blocks) built in
 * O(1) extra memory.
 *
 * The IDAT payload is split across multiple IDAT chunks (`idatChunkBytes`,
 * default 1 MiB) regardless; decoders concatenate them, and it keeps any single
 * chunk allocation modest.
 */

import { zlibCompress, createZlibStream, adler32, type DeflateOptions } from './deflate.ts';
import { crc32 } from './zip-crypto.ts';

/** PNG file signature (spec section 5.2). */
const PNG_SIG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/**
 * Default ceiling on filtered bytes (see header). 1 GiB ≈ 134 MP of 16-bit
 * RGBA. A sanity bound on the returned buffer, NOT a memory bound: past
 * `STREAM_ABOVE_BYTES` the compressor's scratch is constant.
 */
const DEFAULT_MAX_DEFLATE_BYTES = 1024 * 1024 * 1024;

/**
 * Filtered bytes above which compression streams instead of running one-shot.
 * Deliberately well above every PNG this writer emits today, so shipped goldens
 * and C2PA hashes keep their exact bytes; big deep masters take the bounded
 * path. Changing this changes output BYTES for images in the crossover range.
 */
const STREAM_ABOVE_BYTES = 4 * 1024 * 1024;

/** Default IDAT payload split. */
const DEFAULT_IDAT_CHUNK_BYTES = 1024 * 1024;

/** Largest LEN a stored DEFLATE block can carry (RFC 1951 section 3.2.4). */
const STORED_MAX = 65535;

/**
 * Coding-independent code points (ITU-T H.273), written as PNG 3e's `cICP`
 * chunk. `HDR_PQ_CICP` from hdr.ts satisfies this shape as-is.
 */
export interface PngCicp {
  /** H.273 ColourPrimaries: 1 = BT.709/sRGB, 9 = BT.2020. */
  primaries: number;
  /** H.273 TransferCharacteristics: 13 = sRGB, 16 = PQ, 18 = HLG. */
  transfer: number;
  /** H.273 MatrixCoefficients: MUST be 0 (identity) in a PNG. */
  matrix: number;
  /** Full-range (video_full_range_flag): 1 for PNG's full-range samples. */
  fullRange: number;
}

/** One uncompressed iTXt entry (spec section 11.3.4.5). */
export interface PngTextEntry {
  /** 1-79 Latin-1 characters, no leading/trailing/consecutive spaces. */
  keyword: string;
  /** UTF-8 text. */
  text: string;
  /** RFC 3066 language tag (e.g. "en"); empty when unspecified. */
  languageTag?: string;
  /** UTF-8 translation of the keyword; empty when untranslated. */
  translatedKeyword?: string;
}

/** Options for {@link packPng}. */
export interface PackPngOptions {
  width: number;
  height: number;
  /** Samples per pixel: 3 → RGB (colour type 2), 4 → RGBA (colour type 6). Default 4. */
  channels?: 3 | 4;
  /**
   * Bits per sample. 8 requires a Uint8Array/Uint8ClampedArray, 16 requires a
   * Uint16Array. NEVER converted here; see the module header's seam note.
   */
  depth?: 8 | 16;
  /** Physical resolution → pHYs (unit metre). Omitted when absent or <= 0. */
  dpi?: number;
  /** Coding-independent code points → cICP (PNG 3e). */
  cicp?: PngCicp;
  /** Uncompressed iTXt entries, written after IHDR in the given order. */
  text?: PngTextEntry[];
  /** Row filter strategy. 'auto' (default) = per-scanline MSAD heuristic. */
  filter?: 'auto' | 'none';
  /** Passed through to the deflate compressor. */
  deflate?: DeflateOptions;
  /**
   * Deliberate ceiling on filtered bytes. Default 1 GiB; memory no longer
   * scales with the image (see the header), so this is a sanity bound, and a
   * caller passing a small value is asking for a refusal seam, not saving RAM.
   */
  maxDeflateBytes?: number;
  /** What to do past `maxDeflateBytes`: throw (default) or emit stored blocks. */
  oversize?: 'throw' | 'store';
  /** Max bytes of compressed payload per IDAT chunk. Default 1 MiB. */
  idatChunkBytes?: number;
}

/** Samples accepted by {@link packPng}; element type must match `depth`. */
export type PngSamples = Uint8Array | Uint8ClampedArray | Uint16Array;

// ── chunk plumbing ──────────────────────────────────────────────────────────

function writeU32(b: Uint8Array, o: number, v: number): void {
  b[o] = (v >>> 24) & 0xff;
  b[o + 1] = (v >>> 16) & 0xff;
  b[o + 2] = (v >>> 8) & 0xff;
  b[o + 3] = v & 0xff;
}

/** length + type + data + CRC32(type‖data): spec section 5.3. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  writeU32(out, 8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const latin1 = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0xff) throw new Error(`packPng: ${JSON.stringify(s)} is not Latin-1 (PNG keyword/language fields are).`);
    out[i] = c;
  }
  return out;
};

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ── row filtering (spec section 9.2) ───────────────────────────────────────────────

/** PNG Paeth predictor (spec section 9.4); mirrors png-unfilter.ts's decode side. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** libpng's heuristic: sum of |byte as signed| over the filtered row. */
function msad(row: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < row.length; i++) {
    const v = row[i]!;
    sum += v < 128 ? v : 256 - v;
  }
  return sum;
}

/**
 * Filter `raw` (one scanline, already big-endian at the target depth) against
 * `prior` into `dst` (which must be `1 + rowBytes` long, tag included).
 * `bpp` is bytes per pixel: the Sub/Average/Paeth left offset.
 */
function filterRow(
  raw: Uint8Array, prior: Uint8Array | null, bpp: number,
  dst: Uint8Array, scratch: Uint8Array[], auto: boolean,
): void {
  const n = raw.length;
  if (!auto) {
    dst[0] = 0;
    dst.set(raw, 1);
    return;
  }
  const [sub, up, avg, pae] = scratch as [Uint8Array, Uint8Array, Uint8Array, Uint8Array];
  for (let x = 0; x < n; x++) {
    const r = raw[x]!;
    const a = x >= bpp ? raw[x - bpp]! : 0;
    const b = prior ? prior[x]! : 0;
    const c = prior && x >= bpp ? prior[x - bpp]! : 0;
    sub[x] = (r - a) & 0xff;
    up[x] = (r - b) & 0xff;
    avg[x] = (r - ((a + b) >> 1)) & 0xff;
    pae[x] = (r - paeth(a, b, c)) & 0xff;
  }
  // Type 0 (None) costs msad(raw) itself; no scratch needed.
  let bestType = 0;
  let bestCost = msad(raw);
  const cands: Array<[number, Uint8Array]> = [[1, sub], [2, up], [3, avg], [4, pae]];
  let best: Uint8Array | null = null;
  for (const [type, buf] of cands) {
    const cost = msad(buf);
    if (cost < bestCost) { bestCost = cost; bestType = type; best = buf; }
  }
  dst[0] = bestType;
  dst.set(best ?? raw, 1);
}

// ── stored-block zlib (the bounded-memory oversize escape hatch) ────────────

/**
 * A valid RFC 1950 stream carrying RFC 1951 section 3.2.4 stored blocks: no LZ77, no
 * Huffman, so no tokenizer scratch. Used only past `maxDeflateBytes` with
 * `oversize: 'store'`, for a caller that has deliberately capped the encoder and
 * still wants a file. Ordinary large images now stream instead (see header).
 */
function storedZlib(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / STORED_MAX));
  const out = new Uint8Array(2 + data.length + 5 * blocks + 4);
  // CMF 0x78 (deflate, 32 KB window) + FLG 0x01 (FLEVEL=0; 0x7801 ≡ 0 mod 31).
  out[0] = 0x78;
  out[1] = 0x01;
  let o = 2;
  let off = 0;
  do {
    const len = Math.min(STORED_MAX, data.length - off);
    const final = off + len >= data.length;
    out[o++] = final ? 1 : 0;             // BFINAL, BTYPE=00, byte-aligned
    out[o++] = len & 0xff;
    out[o++] = (len >>> 8) & 0xff;
    out[o++] = ~len & 0xff;
    out[o++] = (~len >>> 8) & 0xff;
    out.set(data.subarray(off, off + len), o);
    o += len;
    off += len;
  } while (off < data.length);
  const a = adler32(data);
  writeU32(out, o, a);
  return out.subarray(0, o + 4);
}

// ── the writer ──────────────────────────────────────────────────────────────

/**
 * Encode packed samples as a PNG file.
 *
 * @param pixels width*height*channels samples, row-major, un-premultiplied,
 *   already at `opts.depth` (Uint8Array/Uint8ClampedArray for 8, Uint16Array for
 *   16). No depth conversion and no colour conversion happen here.
 * @param opts   see {@link PackPngOptions}.
 * @returns the complete PNG file bytes.
 */
export function packPng(pixels: PngSamples, opts: PackPngOptions): Uint8Array {
  const W = Math.floor(opts.width);
  const H = Math.floor(opts.height);
  const channels = opts.channels ?? 4;
  const depth = opts.depth ?? 8;

  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) {
    throw new Error('packPng: width and height must be positive.');
  }
  if (channels !== 3 && channels !== 4) {
    throw new Error(`packPng: unsupported channels ${String(channels)} (3 = RGB, 4 = RGBA).`);
  }
  if (depth !== 8 && depth !== 16) {
    throw new Error(`packPng: unsupported depth ${String(depth)} (8 or 16).`);
  }
  // The buffer must already BE the requested depth; packPng writes, never converts.
  if (depth === 8 && !(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray)) {
    throw new Error('packPng: depth 8 requires a Uint8Array or Uint8ClampedArray (pixels.ts owns depth conversion).');
  }
  if (depth === 16 && !(pixels instanceof Uint16Array)) {
    throw new Error('packPng: depth 16 requires a Uint16Array (pixels.ts owns depth conversion).');
  }
  const expected = W * H * channels;
  if (!Number.isSafeInteger(expected)) throw new Error('packPng: image is too large to address.');
  if (pixels.length !== expected) {
    throw new Error(`packPng: pixel buffer is ${pixels.length} samples, expected ${expected} (${W}x${H}x${channels}).`);
  }

  const bpp = channels * (depth >> 3);       // bytes per pixel
  const rowBytes = W * bpp;
  const stride = rowBytes + 1;               // filter tag + scanline
  const filteredLen = stride * H;
  if (!Number.isSafeInteger(filteredLen)) throw new Error('packPng: image is too large to address.');

  // ── the ceiling, checked BEFORE anything image-sized is allocated ─────────
  const cap = opts.maxDeflateBytes ?? DEFAULT_MAX_DEFLATE_BYTES;
  if (filteredLen > cap && opts.oversize !== 'store') {
    throw new Error(
      `packPng: ${filteredLen} filtered bytes exceeds maxDeflateBytes (${cap}). ` +
      'That ceiling is now deliberate, not a memory limit: deflate.ts had no incremental surface ' +
      'when the guard was written and now has one (createZlibStream), so a payload this size ' +
      'compresses in constant scratch. ' +
      "Pass oversize: 'store' for an uncompressed (but valid) PNG, or raise maxDeflateBytes deliberately.",
    );
  }

  // ── serialise scanlines (big-endian for 16-bit, spec section 7.1), filter, compress ─
  // Rows are produced one at a time into `rowOut`. Past STREAM_ABOVE_BYTES each
  // one is pushed straight into the compressor, so the whole-image `filtered`
  // buffer is never allocated; below it rows are staged into `filtered` and
  // compressed in one shot, which is what keeps small-PNG bytes frozen.
  const streaming = filteredLen > STREAM_ABOVE_BYTES && filteredLen <= cap;
  const stored = filteredLen > cap;                 // oversize: 'store'
  const filtered = streaming ? null : new Uint8Array(filteredLen);
  const zstream = streaming ? createZlibStream(opts.deflate) : null;
  const zparts: Uint8Array[] = [];
  const rowOut = new Uint8Array(stride);
  // Two row buffers, swapped each scanline: `cur` is being written, `prev` holds
  // the previous row's UNFILTERED bytes (what Up/Average/Paeth predict against).
  let cur = new Uint8Array(rowBytes);
  let prev = new Uint8Array(rowBytes);
  const auto = (opts.filter ?? 'auto') !== 'none';
  const scratch = auto
    ? [new Uint8Array(rowBytes), new Uint8Array(rowBytes), new Uint8Array(rowBytes), new Uint8Array(rowBytes)]
    : [];

  for (let y = 0; y < H; y++) {
    const src = y * W * channels;
    if (depth === 8) {
      for (let i = 0; i < rowBytes; i++) cur[i] = pixels[src + i]! & 0xff;
    } else {
      for (let i = 0, s = src; i < rowBytes; i += 2, s++) {
        const v = pixels[s]! & 0xffff;
        cur[i] = v >>> 8;      // MSB first: PNG is network byte order
        cur[i + 1] = v & 0xff;
      }
    }
    filterRow(cur, y > 0 ? prev : null, bpp, rowOut, scratch, auto);
    if (zstream) {
      const part = zstream.push(rowOut);            // copies; rowOut is reusable
      if (part.length > 0) zparts.push(part);
    } else {
      filtered!.set(rowOut, y * stride);
    }
    const t = prev;
    prev = cur;
    cur = t;
  }

  let zdata: Uint8Array;
  if (zstream) {
    zparts.push(zstream.finish());
    zdata = concat(zparts);
  } else if (stored) {
    zdata = storedZlib(filtered!);
  } else {
    zdata = zlibCompress(filtered!, opts.deflate);
  }

  // ── chunks ────────────────────────────────────────────────────────────────
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, W);
  writeU32(ihdr, 4, H);
  ihdr[8] = depth;
  ihdr[9] = channels === 4 ? 6 : 2;  // colour type: 6 = truecolour+alpha, 2 = truecolour
  ihdr[10] = 0;                      // compression method: deflate
  ihdr[11] = 0;                      // filter method: adaptive (the five types)
  ihdr[12] = 0;                      // interlace: none
  const parts: Uint8Array[] = [PNG_SIG, chunk('IHDR', ihdr)];

  if (opts.cicp) {
    const { primaries, transfer, matrix, fullRange } = opts.cicp;
    for (const [name, v] of [['primaries', primaries], ['transfer', transfer], ['matrix', matrix], ['fullRange', fullRange]] as const) {
      if (!Number.isInteger(v) || v < 0 || v > 255) throw new Error(`packPng: cICP ${name} must be a byte, got ${String(v)}.`);
    }
    // PNG 3e section 11.3.3.6: samples are RGB, so identity is the only legal matrix.
    if (matrix !== 0) throw new Error(`packPng: cICP matrix must be 0 (identity) in a PNG, got ${matrix}.`);
    parts.push(chunk('cICP', Uint8Array.of(primaries, transfer, matrix, fullRange)));
  }

  if (opts.dpi !== undefined && opts.dpi > 0) {
    // Same arithmetic as the shell's insertPngPhys; asserted equal by test.
    const ppm = Math.round(opts.dpi / 0.0254);
    const phys = new Uint8Array(9);
    writeU32(phys, 0, ppm);
    writeU32(phys, 4, ppm);
    phys[8] = 1; // unit specifier: metre
    parts.push(chunk('pHYs', phys));
  }

  for (const entry of opts.text ?? []) {
    const keyword = latin1(entry.keyword);
    if (keyword.length < 1 || keyword.length > 79) {
      throw new Error(`packPng: iTXt keyword must be 1-79 characters, got ${keyword.length}.`);
    }
    // section 11.3.4.5: no NUL (it would terminate the field early and corrupt the
    // chunk structure), no leading/trailing spaces, no consecutive spaces.
    if (/\0/.test(entry.keyword) || /^ | $|  /.test(entry.keyword)) {
      throw new Error('packPng: iTXt keyword must not contain NUL or leading/trailing/consecutive spaces.');
    }
    parts.push(chunk('iTXt', concat([
      keyword, Uint8Array.of(0),
      Uint8Array.of(0, 0),                                   // compression flag 0, method 0
      latin1(entry.languageTag ?? ''), Uint8Array.of(0),
      utf8(entry.translatedKeyword ?? ''), Uint8Array.of(0),
      utf8(entry.text),
    ])));
  }

  const idatMax = Math.max(1, Math.floor(opts.idatChunkBytes ?? DEFAULT_IDAT_CHUNK_BYTES));
  for (let o = 0; o < zdata.length; o += idatMax) {
    parts.push(chunk('IDAT', zdata.subarray(o, Math.min(o + idatMax, zdata.length))));
  }
  parts.push(chunk('IEND', new Uint8Array(0)));
  return concat(parts);
}
