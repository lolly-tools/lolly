// SPDX-License-Identifier: MPL-2.0
/**
 * gzip (RFC 1952): the member wrapper around raw DEFLATE, plus a synchronous
 * inflater so a `.gz`/`.svgz` can be read back without a platform decoder.
 *
 * The engine already emits raw DEFLATE (deflate.ts) and the zlib wrapper it
 * feeds PNG IDAT, but had no gzip framing and, at first, no synchronous
 * INFLATE at all: url-pack.ts inflates its `z` tokens through the platform
 * DecompressionStream (async, browser-only), which is the wrong shape for a
 * format writer/reader that must run identically in web, CLI and MCP. gzip is
 * what SVGZ is (section "SVGZ is exactly this"), what `.tar.gz` needs, and the most
 * requested "just give me a .gz" export, so both halves live here.
 *
 * ─── Which half is ours, and why ─────────────────────────────────────────────
 * DECODE is fflate's (`Inflate`), wrapped in this file's cap - see the block
 * comment above {@link inflateRaw}. A decoder's output is defined by the input,
 * so swapping one for another that the engine already depends on is free: 147
 * round-trips across every node:zlib level x strategy decoded to identical
 * bytes, and ~200 lines of hand-written bit reader, Huffman decoder and block
 * loop went with the swap.
 *
 * ENCODE stays in-house, because it is NOT free. fflate's `gzipSync` writes a
 * different member for the same input: a wall-clock MTIME (so two runs a second
 * apart disagree, which the goldens and C2PA hashes cannot have) and OS=3 rather
 * than 0xff, over a body its own deflate produces - dynamic Huffman where
 * deflate.ts emits fixed, so not one fixture of fourteen matched byte for byte.
 * See deflate.ts's header for the same measurement on the raw DEFLATE side.
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
 * third-party gzip may carry), INFLATE the body with the bounded
 * inflater, then verify BOTH the trailer CRC-32 and ISIZE against the recovered
 * bytes. A truncated or corrupt stream fails loudly rather than returning short
 * data: the trailer check is what makes that true end to end, since fflate's
 * decoder will hand back a short result for some corrupt streams the old
 * in-house one rejected outright, and ISIZE/CRC-32 catch every one of those.
 * Every field read is bounds-checked before deref, and the inflater can
 * neither loop forever nor over-allocate on a crafted length (the "GIF
 * lesson"): the output is capped at the declared size, and the compressed input
 * is fed in through pushes sized to the remaining headroom, so peak memory
 * tracks the declared size rather than whatever a hostile stream could expand to.
 *
 * ─── SVGZ is exactly this ────────────────────────────────────────────────────
 * SVGZ (`image/svg+xml` + `Content-Encoding: gzip`, `.svgz`) is a gzip member
 * whose payload is UTF-8 SVG text (`gzip(new TextEncoder().encode(svg))`), with
 * no SVGZ-specific framing. `gunzip` reverses it. That is the whole format.
 *
 * Pure math + typed arrays; DOM-free, deterministic, no network/filesystem.
 */

import { Inflate } from 'fflate';
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

/** Default recovered-size ceiling for a gzip member. Callers may lower it. */
export const GUNZIP_MAX_OUTPUT_BYTES = 320 * 1024 * 1024;

export interface GunzipOptions {
  /** Maximum trailer-declared and actually recovered byte length. */
  maxOutputBytes?: number;
}

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
export function gunzip(bytes: Uint8Array, opts: GunzipOptions = {}): Uint8Array {
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
  const maxOutputBytes = opts.maxOutputBytes ?? GUNZIP_MAX_OUTPUT_BYTES;
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0) {
    throw new Error('gunzip: maxOutputBytes must be a non-negative safe integer');
  }
  if (expectedSize > maxOutputBytes) {
    throw new Error(`gunzip: declared output ${expectedSize} exceeds ${maxOutputBytes} byte limit`);
  }

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
// Raw DEFLATE inflate (RFC 1951): fflate's decoder behind the engine's cap.
//
// The bit reader, canonical-Huffman decoder and block loop used to live here.
// They were measured against fflate's `Inflate` over 147 round-trips (every
// node:zlib level x strategy over an ascii/random/zero/source-file corpus) and
// the decoded bytes matched on every one, so the hand-written half went and the
// dependency the engine already carries does the decoding. The measurement is
// written up in engine/CHANGELOG.md under 2026-09-11.
//
// What did NOT move is the bound. fflate never grows a caller-supplied buffer
// and never reports having overrun one, so feeding it the whole stream at once
// would trade `sizeHint` for a silent truncation. Instead the compressed input
// is pushed through fflate's STREAMING decoder in slabs and each decoded chunk
// is appended to {@link OutBuffer}, which throws on the first byte past `sizeHint`.
//
// The slab size is the part that has to be got right. fflate decodes an ENTIRE
// push into its own growing buffer before it calls back (`Inflate.prototype.c`
// runs `inflt` to completion, then hands the result to `ondata`), so the cap in
// {@link OutBuffer} can only fire AFTER a whole slab has expanded. A fixed 64 KB
// slab therefore let a bomb materialise ~64 MB before the throw - measured at
// 187 MB RSS for 65 KB of input declaring `sizeHint` 1. So each push is instead
// sized to the OUTPUT headroom that is left, divided by DEFLATE's worst-case
// 1032:1 expansion. Peak transient allocation is then on the order of the
// declared size (with a ~1 MB floor from the minimum slab), never on the order
// of what a lying declared size would otherwise unlock. An honest stream is
// unaffected in output and bounded in push count: the slab shrinks as the
// headroom does, so the loop runs at most ~1032 pushes whatever the size.
// ────────────────────────────────────────────────────────────────────────────

/** Ceiling on compressed bytes handed to fflate per push. Bounds its per-push scratch. */
const INFLATE_PUSH_BYTES = 1 << 16;

/** Floor on that push size, so a tiny declared size still makes progress. */
const INFLATE_MIN_PUSH_BYTES = 1024;

/**
 * Largest expansion one DEFLATE byte can produce (RFC 1951): a 258-byte match
 * costs as little as ~2 bits, so 1032:1 is the standard worst case. Used to turn
 * "output bytes still allowed" into "compressed bytes safe to push".
 */
const MAX_INFLATE_RATIO = 1032;

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
  pushBytes(src: Uint8Array): void {
    this.ensure(src.length);
    this.buf.set(src, this.len);
    this.len += src.length;
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
  // An empty buffer is not a DEFLATE stream. fflate hands back an empty result
  // for one; the engine's callers want the same loud failure a truncated stream gets.
  if (data.length === 0) throw new Error('inflate: unexpected end of stream');

  const out = new OutBuffer(cap);
  const stream = new Inflate((chunk) => { if (chunk.length > 0) out.pushBytes(chunk); });
  try {
    let at = 0;
    while (at < data.length) {
      // fflate decodes a whole push before it calls back, so the push size - not
      // the cap - is what bounds the transient allocation. Size each push to the
      // output headroom that is left, divided by DEFLATE's worst-case expansion.
      const headroom = Math.ceil(Math.max(0, cap - out.len) / MAX_INFLATE_RATIO) + 64;
      const slab = Math.min(INFLATE_PUSH_BYTES, Math.max(INFLATE_MIN_PUSH_BYTES, headroom));
      const end = Math.min(at + slab, data.length);
      stream.push(data.subarray(at, end), end === data.length);
      at = end;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // OutBuffer's own cap message already carries the prefix; fflate's does not.
    throw message.startsWith('inflate:') ? err : new Error(`inflate: ${message}`);
  }
  return out.take();
}
