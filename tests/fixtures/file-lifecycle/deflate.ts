// SPDX-License-Identifier: MPL-2.0
/**
 * The corpus's own DEFLATE writer (RFC 1951), so every fixture has the same bytes on
 * every Node build. Node's zlib cannot promise that: an official Node build bundles
 * Chromium's zlib, Homebrew's links the macOS system zlib, and the two compress the
 * same input to different lengths. Those lengths reach outcomes.json, and a cut
 * gzip's trailer, read as its declared size, is compressed data too.
 *
 * Two block shapes cover the corpus. Ordinary content is one fixed-Huffman block with
 * every byte a literal: nothing is shortened, but a reader still has to decode the
 * Huffman codes. A decompression bomb is a run of zeros, written as a literal zero
 * and then 258-byte copies of the byte before, each two bits long.
 */
import zlib from 'node:zlib';

/** Packs bits least significant first, as DEFLATE lays out every field but a code. */
class BitWriter {
  private buf = new Uint8Array(4096);
  private len = 0;
  private acc = 0;
  private count = 0;

  /** `n` bits of `value`, least significant first: block headers, lengths and counts. */
  bits(value: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.acc |= ((value >>> i) & 1) << this.count;
      if (++this.count === 8) this.flush();
    }
  }

  /** A Huffman code of `n` bits, which DEFLATE packs most significant bit first. */
  code(code: number, n: number): void {
    for (let i = n - 1; i >= 0; i--) this.bits((code >>> i) & 1, 1);
  }

  /** Pads the last byte with zero bits and returns everything written. */
  bytes(): Uint8Array {
    if (this.count) this.flush();
    return this.buf.slice(0, this.len);
  }

  private flush(): void {
    if (this.len === this.buf.length) {
      const grown = new Uint8Array(this.buf.length * 2);
      grown.set(this.buf);
      this.buf = grown;
    }
    this.buf[this.len++] = this.acc;
    this.acc = 0;
    this.count = 0;
  }
}

/** Raw DEFLATE: one final fixed-Huffman block that holds every byte as a literal. */
export function deflateLiterals(bytes: Uint8Array): Uint8Array {
  const w = new BitWriter();
  w.bits(1, 1);                         // the final block
  w.bits(1, 2);                         // fixed Huffman codes
  for (const b of bytes) {
    if (b < 144) w.code(0x30 + b, 8);   // literals 0 to 143: 00110000 onwards
    else w.code(0x190 + b - 144, 9);    // literals 144 to 255: 110010000 onwards
  }
  w.code(0, 7);                         // end of block
  return w.bytes();
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const x of bytes) { a = (a + x) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

/** A zlib stream (RFC 1950), as PNG's IDAT and iCCP chunks hold: header, literals, Adler-32. */
export function zlibLiterals(bytes: Uint8Array): Uint8Array {
  const body = deflateLiterals(bytes);
  const out = new Uint8Array(2 + body.length + 4);
  out.set([0x78, 0x01]);                // DEFLATE with a 32 KiB window; 0x7801 is a multiple of 31
  out.set(body, 2);
  new DataView(out.buffer).setUint32(2 + body.length, adler32(bytes));
  return out;
}

const MiB = 1024 * 1024;
// Code-length alphabet order (RFC 1951, 3.2.7).
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/**
 * One MiB of zeros as a dynamic-Huffman block, then an empty stored block that ends it
 * on a byte boundary so the MiB can be repeated as it is.
 *
 * The block's literal and length code has three symbols: the copy of 258 bytes (code 0),
 * the literal zero (10) and the end of block (11). Its distance code has distance 1
 * (code 0) and distance 2 (code 1), because zlib refuses an incomplete code. Their code
 * lengths are written with a code of three symbols too: 18, which repeats a zero
 * length (code 0), length 1 (10) and length 2 (11).
 */
function zeroMiB(): Uint8Array {
  const w = new BitWriter();
  w.bits(0, 1);                         // not the final block
  w.bits(2, 2);                         // dynamic Huffman codes
  w.bits(286 - 257, 5);                 // literal and length codes, up to symbol 285
  w.bits(2 - 1, 5);                     // two distance codes
  w.bits(18 - 4, 4);                    // code-length code lengths sent, up to symbol 1
  const codeLengthBits: Record<number, number> = { 18: 1, 1: 2, 2: 2 };
  for (const symbol of CODE_LENGTH_ORDER.slice(0, 18)) w.bits(codeLengthBits[symbol] ?? 0, 3);
  const zeros = (n: number): void => { w.code(0, 1); w.bits(n - 11, 7); };
  const length = (n: 1 | 2): void => { w.code(n === 1 ? 2 : 3, 2); };
  length(2);                            // symbol 0, the literal zero
  zeros(138); zeros(117);               // symbols 1 to 255 unused
  length(2);                            // symbol 256, the end of block
  zeros(28);                            // symbols 257 to 284 unused
  length(1);                            // symbol 285, a 258-byte copy
  length(1); length(1);                 // distances 1 and 2
  w.code(2, 2);                         // a literal zero
  const copies = Math.floor((MiB - 1) / 258);
  for (let i = 0; i < copies; i++) { w.code(0, 1); w.code(0, 1); }
  for (let i = 1 + copies * 258; i < MiB; i++) w.code(2, 2);
  w.code(3, 2);                         // end of block
  w.bits(0, 3);                         // an empty stored block, which pads to a byte
  const head = w.bytes();
  const out = new Uint8Array(head.length + 4);
  out.set(head);
  out.set([0x00, 0x00, 0xff, 0xff], head.length);
  return out;
}

/**
 * Raw DEFLATE that inflates to `mib` MiB of zeros, with its CRC-32 and size, at about
 * a kilobyte per MiB. A final empty fixed-Huffman block closes the stream.
 */
export function deflateZeros(mib: number): { data: Uint8Array; crc: number; size: number } {
  const block = zeroMiB();
  const data = new Uint8Array(block.length * mib + 2);
  const zeros = new Uint8Array(MiB);
  let crc = 0;
  for (let i = 0; i < mib; i++) { data.set(block, i * block.length); crc = zlib.crc32(zeros, crc); }
  data.set([0x03, 0x00], block.length * mib);
  return { data, crc: crc >>> 0, size: mib * MiB };
}
