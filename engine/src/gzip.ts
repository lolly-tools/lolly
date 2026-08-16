// SPDX-License-Identifier: MPL-2.0
/**
 * gzip (RFC 1952): the member wrapper around raw DEFLATE, plus a self-contained
 * inflater so a `.gz`/`.svgz` can be read back without a platform decoder.
 *
 * The engine already emits raw DEFLATE (deflate.ts) and the zlib wrapper it
 * feeds PNG IDAT, but had no gzip framing and, deliberately, no synchronous
 * INFLATE at all: url-pack.ts inflates its `z` tokens through the platform
 * DecompressionStream (async, browser-only), which is the wrong shape for a
 * format writer/reader that must run identically in web, CLI and MCP. gzip is
 * what SVGZ is (section "SVGZ is exactly this"), what `.tar.gz` needs, and the most
 * requested "just give me a .gz" export, so both halves live here.
 *
 * ─── Encode (RFC 1952 section 2.3) ──────────────────────────────────────────────────
 * 10-byte fixed header: ID1 0x1f, ID2 0x8b, CM 8 (deflate), FLG 0 (no name /
 * comment / extra / hcrc), MTIME 0 (RFC 1952: 0 = "no timestamp", the only
 * deterministic choice, since a wall clock would make output non-reproducible and
 * break byte-pinned goldens), XFL 0, OS 255 (0xff = "unknown", the privacy-
 * preserving value; we never leak the producer's platform), then the raw
 * DEFLATE body, then an 8-byte trailer: CRC-32 of the UNCOMPRESSED bytes and
 * ISIZE (input length mod 2^32), both little-endian (section 2.3.1).
 *
 * ─── Decode ──────────────────────────────────────────────────────────────────
 * Validate magic + CM + FLG (skipping any FEXTRA/FNAME/FCOMMENT/FHCRC fields a
 * third-party gzip may carry), INFLATE the body with the in-file bounded
 * inflater, then verify BOTH the trailer CRC-32 and ISIZE against the recovered
 * bytes. A truncated or corrupt stream fails loudly rather than returning short
 * data. Every field read is bounds-checked before deref, and the inflater can
 * neither loop forever nor over-allocate on a crafted length/distance (the "GIF
 * lesson"): the output is capped and every back-reference is validated against
 * bytes actually produced.
 *
 * ─── SVGZ is exactly this ────────────────────────────────────────────────────
 * SVGZ (`image/svg+xml` + `Content-Encoding: gzip`, `.svgz`) is a gzip member
 * whose payload is UTF-8 SVG text (`gzip(new TextEncoder().encode(svg))`), with
 * no SVGZ-specific framing. `gunzip` reverses it. That is the whole format.
 *
 * Pure math + typed arrays; DOM-free, deterministic, no network/filesystem.
 */

import { crc32 } from './zip-crypto.ts';
import { deflateRaw, type DeflateOptions } from './deflate.ts';

// ── RFC 1952 section 2.3.1: the fixed 10-byte header we emit ───────────────────────
const ID1 = 0x1f;
const ID2 = 0x8b;
const CM_DEFLATE = 8;
// FLG bits (RFC 1952 section 2.3.1): read on decode, never set on encode.
const FTEXT = 1;
const FHCRC = 2;
const FEXTRA = 4;
const FNAME = 8;
const FCOMMENT = 16;
const FLG_RESERVED = 0xe0; // bits 5-7 MUST be zero (RFC 1952 section 2.3.1.1)

/**
 * Wrap `bytes` in a gzip member (RFC 1952). Body is `deflateRaw(bytes)`; the
 * trailer is CRC-32 and ISIZE of the ORIGINAL bytes, little-endian. Reproducible
 * for a given input (MTIME 0, OS 0xff), so the output is byte-pinnable.
 */
export function gzip(bytes: Uint8Array, opts?: DeflateOptions): Uint8Array {
  const body = deflateRaw(bytes, opts);
  const out = new Uint8Array(10 + body.length + 8);
  out[0] = ID1;
  out[1] = ID2;
  out[2] = CM_DEFLATE;
  out[3] = 0; // FLG: none set
  // out[4..7] MTIME = 0 (already zero-filled)
  out[8] = 0; // XFL
  out[9] = 0xff; // OS = unknown
  out.set(body, 10);
  const crc = crc32(bytes);
  const o = 10 + body.length;
  out[o] = crc & 0xff;
  out[o + 1] = (crc >>> 8) & 0xff;
  out[o + 2] = (crc >>> 16) & 0xff;
  out[o + 3] = (crc >>> 24) & 0xff;
  const isize = bytes.length >>> 0; // mod 2^32 (RFC 1952 section 2.3.1)
  out[o + 4] = isize & 0xff;
  out[o + 5] = (isize >>> 8) & 0xff;
  out[o + 6] = (isize >>> 16) & 0xff;
  out[o + 7] = (isize >>> 24) & 0xff;
  return out;
}

/**
 * Reverse {@link gzip}: validate the header, inflate the DEFLATE body, and
 * verify the trailer CRC-32 + ISIZE. Throws on a bad magic, an unsupported
 * compression method, a reserved flag bit, a truncated stream, or a
 * CRC/length mismatch. Reads a gzip written by any conforming producer, not
 * only our own (skips FEXTRA/FNAME/FCOMMENT/FHCRC).
 */
export function gunzip(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 18) throw new Error('gunzip: too short to be a gzip member');
  if (bytes[0] !== ID1 || bytes[1] !== ID2) throw new Error('gunzip: bad magic (not a gzip stream)');
  if (bytes[2] !== CM_DEFLATE) throw new Error(`gunzip: unsupported compression method ${bytes[2]}`);
  const flg = bytes[3]!;
  if (flg & FLG_RESERVED) throw new Error('gunzip: reserved FLG bits set');
  void FTEXT; // FTEXT is advisory only; nothing to do

  let p = 10; // past the fixed header
  if (flg & FEXTRA) {
    if (p + 2 > bytes.length) throw new Error('gunzip: truncated in FEXTRA length');
    const xlen = bytes[p]! | (bytes[p + 1]! << 8);
    p += 2 + xlen;
    if (p > bytes.length) throw new Error('gunzip: truncated in FEXTRA field');
  }
  if (flg & FNAME) p = skipZeroString(bytes, p, 'FNAME');
  if (flg & FCOMMENT) p = skipZeroString(bytes, p, 'FCOMMENT');
  if (flg & FHCRC) {
    p += 2; // 2-byte header CRC16: presence checked, value not verified
    if (p > bytes.length) throw new Error('gunzip: truncated in FHCRC');
  }

  // The last 8 bytes are the trailer; the DEFLATE body is everything between.
  if (p + 8 > bytes.length) throw new Error('gunzip: no room for a DEFLATE body + trailer');
  const trailer = bytes.length - 8;
  const expectedCrc = readU32LE(bytes, trailer);
  const expectedSize = readU32LE(bytes, trailer + 4);

  const out = inflateRaw(bytes.subarray(p, trailer), expectedSize);

  if (out.length !== expectedSize) {
    throw new Error(`gunzip: ISIZE mismatch (trailer says ${expectedSize}, inflated ${out.length})`);
  }
  if (crc32(out) !== expectedCrc) throw new Error('gunzip: CRC-32 mismatch (corrupt stream)');
  return out;
}

/** Advance past a NUL-terminated header string; throws if it runs off the end. */
function skipZeroString(bytes: Uint8Array, from: number, field: string): number {
  let i = from;
  while (i < bytes.length && bytes[i] !== 0) i++;
  if (i >= bytes.length) throw new Error(`gunzip: unterminated ${field}`);
  return i + 1; // step over the NUL
}

/** Read a little-endian uint32 at `off` (caller guarantees off+4 <= length). */
function readU32LE(bytes: Uint8Array, off: number): number {
  return (bytes[off]! | (bytes[off + 1]! << 8) | (bytes[off + 2]! << 16) | (bytes[off + 3]! << 24)) >>> 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Raw DEFLATE inflate (RFC 1951): the decode half the engine lacked.
//
// Stored blocks (section 3.2.4), fixed Huffman (section 3.2.6) and dynamic Huffman (section 3.2.7).
// Bounded on every axis a hostile stream could exploit: a bit reader that
// reports end-of-input instead of reading past the buffer, an output that
// cannot exceed `sizeHint` (the gzip ISIZE, so a crafted length code cannot make
// us allocate gigabytes), and back-references validated against bytes actually
// produced (distance <= current output length). No recursion, no unbounded loop.
// ────────────────────────────────────────────────────────────────────────────

// RFC 1951 section 3.2.5: length codes 257..285 (base + extra bits).
const LEN_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const LEN_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
// RFC 1951 section 3.2.5: distance codes 0..29 (base + extra bits).
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
// RFC 1951 section 3.2.7: the order in which code-length-code lengths are stored.
const CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** LSB-first bit reader (RFC 1951 section 3.1.1) with hard bounds; never reads past `data`. */
class BitReader {
  private pos = 0;
  private bitBuf = 0;
  private bitCnt = 0;
  private readonly data: Uint8Array;
  constructor(data: Uint8Array) { this.data = data; }

  /** Read `count` bits (0..24), LSB first. Throws on end-of-input. */
  bits(count: number): number {
    while (this.bitCnt < count) {
      if (this.pos >= this.data.length) throw new Error('inflate: unexpected end of stream');
      this.bitBuf |= this.data[this.pos++]! << this.bitCnt;
      this.bitCnt += 8;
    }
    const v = this.bitBuf & ((1 << count) - 1);
    this.bitBuf >>>= count;
    this.bitCnt -= count;
    return v;
  }

  /** Drop any partial bits, aligning to the next byte (stored-block start, section 3.2.4). */
  alignByte(): void {
    this.bitBuf = 0;
    this.bitCnt = 0;
  }

  /** Copy `len` raw bytes (stored block); the reader must be byte-aligned. */
  readBytes(len: number): Uint8Array {
    if (this.pos + len > this.data.length) throw new Error('inflate: truncated stored block');
    const out = this.data.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  /** Read a byte-aligned little-endian uint16 (stored block LEN/NLEN). */
  readU16(): number {
    if (this.pos + 2 > this.data.length) throw new Error('inflate: truncated stored header');
    const v = this.data[this.pos]! | (this.data[this.pos + 1]! << 8);
    this.pos += 2;
    return v;
  }
}

/**
 * Canonical Huffman decoder built from a list of code lengths (RFC 1951 section 3.2.2).
 * Decodes one symbol per `decode()` call, bit by bit, so no code is ever read
 * beyond its length. `maxLen` bounds the walk; a bit reader hitting end-of-input
 * throws rather than spinning.
 */
class HuffTree {
  private readonly counts: Uint16Array;   // number of codes of each length
  private readonly symbols: Uint16Array;  // symbols sorted by (length, value)
  private readonly maxLen: number;

  constructor(lengths: Uint8Array | number[], maxLen: number) {
    this.maxLen = maxLen;
    this.counts = new Uint16Array(maxLen + 1);
    for (let i = 0; i < lengths.length; i++) {
      const l = lengths[i]!;
      if (l > maxLen) throw new Error('inflate: code length exceeds maximum');
      this.counts[l]!++;
    }
    this.counts[0] = 0; // length-0 symbols are absent, not codes
    // Offsets of each length's block within the sorted symbol table.
    const offsets = new Uint16Array(maxLen + 2);
    for (let l = 1; l <= maxLen; l++) offsets[l + 1] = offsets[l]! + this.counts[l]!;
    this.symbols = new Uint16Array(lengths.length);
    for (let i = 0; i < lengths.length; i++) {
      const l = lengths[i]!;
      if (l !== 0) this.symbols[offsets[l]!++] = i;
    }
  }

  /** Decode one symbol from `r`, walking one bit per length (RFC 1951 section 3.2.2). */
  decode(r: BitReader): number {
    let code = 0;
    let first = 0;   // first canonical code of the current length
    let index = 0;   // running symbol-table base for the current length
    for (let len = 1; len <= this.maxLen; len++) {
      code |= r.bits(1);
      const count = this.counts[len]!;
      if (code - first < count) return this.symbols[index + (code - first)]!;
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error('inflate: invalid Huffman code');
  }
}

// Fixed literal/length + distance trees (RFC 1951 section 3.2.6), built once.
const FIXED_LIT_TREE = (() => {
  const lengths = new Uint8Array(288);
  for (let i = 0; i < 144; i++) lengths[i] = 8;
  for (let i = 144; i < 256; i++) lengths[i] = 9;
  for (let i = 256; i < 280; i++) lengths[i] = 7;
  for (let i = 280; i < 288; i++) lengths[i] = 8;
  return new HuffTree(lengths, 9);
})();
const FIXED_DIST_TREE = (() => {
  const lengths = new Uint8Array(30).fill(5);
  return new HuffTree(lengths, 5);
})();

/** Growable output buffer capped at `sizeHint` so a crafted stream can't over-allocate. */
class OutBuffer {
  private buf: Uint8Array;
  private readonly cap: number;
  len = 0;
  constructor(cap: number) {
    this.cap = cap;
    this.buf = new Uint8Array(Math.min(cap, 1 << 16) || 64);
  }
  private ensure(extra: number): void {
    const need = this.len + extra;
    if (need > this.cap) throw new Error('inflate: output exceeds declared size (corrupt or hostile stream)');
    if (need <= this.buf.length) return;
    let next = this.buf.length * 2;
    while (next < need) next *= 2;
    const grown = new Uint8Array(Math.min(next, this.cap));
    grown.set(this.buf.subarray(0, this.len));
    this.buf = grown;
  }
  pushByte(b: number): void {
    this.ensure(1);
    this.buf[this.len++] = b;
  }
  pushBytes(src: Uint8Array): void {
    this.ensure(src.length);
    this.buf.set(src, this.len);
    this.len += src.length;
  }
  /** Copy `len` bytes from `dist` back: the LZ77 back-reference (section 3.2.3). */
  copyBack(dist: number, len: number): void {
    if (dist > this.len) throw new Error('inflate: distance points before start of output');
    this.ensure(len);
    let from = this.len - dist;
    for (let i = 0; i < len; i++) this.buf[this.len++] = this.buf[from++]!;
  }
  take(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }
}

/**
 * Inflate a raw DEFLATE stream (RFC 1951, no zlib/gzip wrapper). `sizeHint` is
 * the known uncompressed length (gzip ISIZE) and is used ONLY as a hard cap; the
 * returned length is whatever the stream actually decodes to (the caller checks
 * it against the trailer). Defaults to a generous cap when the size is unknown.
 */
export function inflateRaw(data: Uint8Array, sizeHint?: number): Uint8Array {
  // Cap: the declared size when known, else a bounded default. Never unbounded.
  const cap = sizeHint !== undefined && sizeHint >= 0 ? sizeHint : Math.max(1 << 20, data.length * 1024);
  const r = new BitReader(data);
  const out = new OutBuffer(cap);
  let final = false;

  while (!final) {
    final = r.bits(1) === 1;
    const type = r.bits(2);
    if (type === 0) {
      // Stored (section 3.2.4): align, LEN + one's-complement NLEN, then raw bytes.
      r.alignByte();
      const len = r.readU16();
      const nlen = r.readU16();
      if ((len ^ 0xffff) !== nlen) throw new Error('inflate: stored block LEN/NLEN mismatch');
      out.pushBytes(r.readBytes(len));
    } else if (type === 1) {
      inflateBlock(r, out, FIXED_LIT_TREE, FIXED_DIST_TREE);
    } else if (type === 2) {
      const { litTree, distTree } = readDynamicTables(r);
      inflateBlock(r, out, litTree, distTree);
    } else {
      throw new Error('inflate: invalid block type 3 (reserved)');
    }
  }
  return out.take();
}

/** Decode one Huffman-coded block body (fixed or dynamic) until end-of-block (256). */
function inflateBlock(r: BitReader, out: OutBuffer, litTree: HuffTree, distTree: HuffTree): void {
  for (;;) {
    const sym = litTree.decode(r);
    if (sym < 256) {
      out.pushByte(sym);
    } else if (sym === 256) {
      return; // end of block (section 3.2.3)
    } else {
      const li = sym - 257;
      if (li >= LEN_BASE.length) throw new Error('inflate: invalid length symbol');
      const len = LEN_BASE[li]! + r.bits(LEN_EXTRA[li]!);
      const dsym = distTree.decode(r);
      if (dsym >= DIST_BASE.length) throw new Error('inflate: invalid distance symbol');
      const dist = DIST_BASE[dsym]! + r.bits(DIST_EXTRA[dsym]!);
      out.copyBack(dist, len);
    }
  }
}

/**
 * Read a dynamic block's Huffman tables (RFC 1951 section 3.2.7): HLIT/HDIST/HCLEN, the
 * code-length-code lengths (in CLEN_ORDER), then the run-length-encoded literal
 * and distance code lengths. Every count and repeat is bounds-checked.
 */
function readDynamicTables(r: BitReader): { litTree: HuffTree; distTree: HuffTree } {
  const hlit = r.bits(5) + 257;  // 257..286
  const hdist = r.bits(5) + 1;   // 1..32
  const hclen = r.bits(4) + 4;   // 4..19
  if (hlit > 286 || hdist > 30) throw new Error('inflate: dynamic table count out of range');

  const clenLengths = new Uint8Array(19);
  for (let i = 0; i < hclen; i++) clenLengths[CLEN_ORDER[i]!] = r.bits(3);
  const clenTree = new HuffTree(clenLengths, 7);

  const total = hlit + hdist;
  const lengths = new Uint8Array(total);
  let i = 0;
  while (i < total) {
    const sym = clenTree.decode(r);
    if (sym < 16) {
      lengths[i++] = sym;
    } else if (sym === 16) {
      // Repeat previous length 3..6 times.
      if (i === 0) throw new Error('inflate: repeat with no previous code length');
      const repeat = 3 + r.bits(2);
      const prev = lengths[i - 1]!;
      if (i + repeat > total) throw new Error('inflate: code-length repeat overruns tables');
      for (let k = 0; k < repeat; k++) lengths[i++] = prev;
    } else if (sym === 17) {
      const repeat = 3 + r.bits(3); // 3..10 zeros
      if (i + repeat > total) throw new Error('inflate: zero-run overruns tables');
      i += repeat; // Uint8Array is already zero-filled
    } else if (sym === 18) {
      const repeat = 11 + r.bits(7); // 11..138 zeros
      if (i + repeat > total) throw new Error('inflate: zero-run overruns tables');
      i += repeat;
    } else {
      throw new Error('inflate: invalid code-length symbol');
    }
  }

  const litTree = new HuffTree(lengths.subarray(0, hlit), 15);
  const distTree = new HuffTree(lengths.subarray(hlit, total), 15);
  return { litTree, distTree };
}
