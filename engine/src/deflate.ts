// SPDX-License-Identifier: MPL-2.0
/**
 * Raw DEFLATE compressor + zlib wrapper — the byte-emitting half the engine was
 * missing. The DECODE side has always been in-tree (url-pack.ts inflates `z`
 * tokens via the platform DecompressionStream; png-unfilter.ts reverses PNG row
 * filters over an already-inflated stream), but nothing could *produce* a
 * DEFLATE stream synchronously and platform-free. The upcoming deep-pixel
 * writers need exactly that: a PNG writer compresses IDAT with zlib-wrapped
 * DEFLATE (PNG spec §10.1), and an OpenEXR writer's ZIP compression is raw
 * DEFLATE per scanline block. CompressionStream is async and stream-shaped —
 * wrong fit for a writer that interleaves compressed chunks into a container —
 * and pulling in a dependency for a frozen 1996 IETF standard is not the
 * engine's style. Pure math + typed arrays; DOM-free, deterministic, identical
 * in browser/CLI/MCP.
 *
 * ─── What subset of RFC 1951 this emits ──────────────────────────────────────
 * LZ77 over the full 32 KB window (hash-chain matcher, lazy matching as in
 * zlib's deflate_slow) coded with the FIXED Huffman tables (RFC 1951 §3.2.6),
 * with a per-stream fallback to stored blocks (§3.2.4, BTYPE=00) whenever the
 * fixed-code stream would be larger — so incompressible input costs at most
 * 5 bytes per 65535-byte block of overhead, never an expansion blow-up. Both
 * block types are mandatory for every conforming inflater, so the output is
 * spec-valid everywhere (node:zlib, DecompressionStream, libpng, ...).
 *
 * DYNAMIC Huffman blocks (§3.2.7 — per-block code lengths, typically another
 * 5-15% on text) are a deliberate later upgrade, not an omission by accident:
 * they add the two-pass symbol-frequency + code-length-code machinery without
 * changing this module's API or the validity of anything emitted today. The
 * consumers this was built for (PNG IDAT of pixel data, EXR ZIP) see most of
 * their win from LZ77 matching, which is fully implemented here.
 *
 * ─── zlib wrapper (RFC 1950) ─────────────────────────────────────────────────
 * `zlibCompress` = 2-byte header (CMF 0x78: CM=8 deflate, CINFO=7 → 32 KB
 * window; FLG 0x9C: check bits making CMF·256+FLG ≡ 0 mod 31, FLEVEL=2, no
 * dictionary) + deflateRaw + big-endian Adler-32 of the UNCOMPRESSED bytes
 * (RFC 1950 §2.2-2.3). Adler-32 per §8: two sums mod 65521 (largest prime
 * < 2^16), started at s1=1 s2=0; the deferred-modulo batch of 5552 is NMAX
 * from zlib's adler32.c (largest n with 255·n·(n+1)/2 + (n+1)·(65521-1) < 2^32).
 *
 * ─── Two entry points, and why there are two ────────────────────────────────
 * `deflateRaw`/`zlibCompress` are the ONE-SHOT path: they tokenize the whole
 * input (~8 bytes of scratch per input byte) and emit a single block. They are
 * kept exactly as they were because their output bytes are pinned by shipped
 * goldens (tests/png.test.ts, shells/web/src/bridge/export-hdr-png.test.ts) and
 * feed C2PA hashes; nothing about them changed when streaming arrived.
 *
 * `createDeflateStream`/`createZlibStream` are the SLAB-FED path (house shape:
 * create -> push -> finish, as `createStreamingMux` in the web shell's
 * video-encode-core.ts). Scratch is O(1) in the input: one 32 KB sliding LZ77
 * window carried across every slab, a hash table and a block's worth of tokens
 * — ~450 KB total, whatever the payload size — and DEFLATE blocks are emitted
 * as they are produced, with BFINAL written only by `finish()`. That is what a
 * 4K 16-bit PNG (66 MiB of filtered scanlines, ~530 MiB of one-shot scratch)
 * needs; `png.ts` picks this path past a documented size and the whole-image
 * `filtered` buffer disappears with it.
 *
 * The two paths therefore have TWO matchers, deliberately: the streaming one
 * slides a fixed window (max match distance `MAX_DIST` = 32506, zlib's own
 * bound) and closes a block every `blockBytes`, so its bytes cannot be
 * bit-identical to the one-shot's single block at distance <= 32768. Sharing
 * one matcher would mean re-pinning every shipped golden for a fraction of a
 * percent of ratio. What IS shared is the token encoding (`writeTokens`) and
 * the cost model (`fixedCost`), so the two streams differ only in blocking and
 * match reach, never in how a token becomes bits.
 *
 * Reference constants (all from RFC 1951 §3.2.5-3.2.6, transcribed verbatim):
 * length codes 257-285 with their base lengths + extra bits, distance codes
 * 0-29 with base distances + extra bits, and the fixed literal/length code
 * ranges (8-bit 0x30.. for 0-143, 9-bit 0x190.. for 144-255, 7-bit 0x00.. for
 * 256-279, 8-bit 0xC0.. for 280-287). Huffman codes are packed MSB-first into
 * the LSB-first bitstream (§3.1.1), hence the bit-reversed code tables.
 */

// ── RFC 1951 §3.2.5 — length codes 257..285 ─────────────────────────────────
const LEN_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const LEN_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];

// ── RFC 1951 §3.2.5 — distance codes 0..29 ──────────────────────────────────
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

const MIN_MATCH = 3;
const MAX_MATCH = 258;
const WINDOW = 32768;        // CINFO=7 → 2^15 (RFC 1950 §2.2); max distance (RFC 1951 §3.2.5)
const STORED_MAX = 65535;    // LEN is 16-bit (RFC 1951 §3.2.4)
const HASH_BITS = 15;
const HASH_SIZE = 1 << HASH_BITS;
const NICE_LEN = 128;        // stop the chain walk once a match this long is found

/** length → slot 0..28 (index by len - 3). Slot 28 (code 285) wins for 258. */
const LEN_SLOT = (() => {
  const t = new Uint8Array(256);
  for (let s = 0; s < 29; s++) {
    const hi = s === 28 ? 258 : LEN_BASE[s]! + (1 << LEN_EXTRA[s]!) - 1;
    for (let l = LEN_BASE[s]!; l <= Math.min(hi, 258); l++) t[l - 3] = s;
  }
  return t;
})();

/** distance → slot 0..29 (index by distance, 1..32768). */
const DIST_SLOT = (() => {
  const t = new Uint8Array(WINDOW + 1);
  for (let s = 0; s < 30; s++) {
    const hi = DIST_BASE[s]! + (1 << DIST_EXTRA[s]!) - 1;
    for (let d = DIST_BASE[s]!; d <= Math.min(hi, WINDOW); d++) t[d] = s;
  }
  return t;
})();

/** Reverse the low `len` bits of `code` — Huffman codes pack MSB-first (§3.1.1). */
function revBits(code: number, len: number): number {
  let r = 0;
  for (let i = 0; i < len; i++) { r = (r << 1) | (code & 1); code >>= 1; }
  return r;
}

/** Fixed literal/length codes (RFC 1951 §3.2.6), pre-reversed for the bit writer. */
const FIXED_LIT_BITS = new Uint8Array(288);
const FIXED_LIT_CODE = new Uint16Array(288);
(() => {
  for (let s = 0; s < 288; s++) {
    let code: number, bits: number;
    if (s < 144) { code = 0x30 + s; bits = 8; }
    else if (s < 256) { code = 0x190 + (s - 144); bits = 9; }
    else if (s < 280) { code = s - 256; bits = 7; }
    else { code = 0xc0 + (s - 280); bits = 8; }
    FIXED_LIT_BITS[s] = bits;
    FIXED_LIT_CODE[s] = revBits(code, bits);
  }
})();

/** Fixed distance codes: plain 5-bit values 0..29 (§3.2.6), pre-reversed. */
const FIXED_DIST_CODE = new Uint8Array(30);
for (let s = 0; s < 30; s++) FIXED_DIST_CODE[s] = revBits(s, 5);

export interface DeflateOptions {
  /**
   * Lazy matching (zlib's deflate_slow): defer a match one byte if the next
   * position matches longer. Slightly smaller output for ~15% more matcher
   * work. Default true.
   */
  lazy?: boolean;
  /** Hash-chain candidates examined per position. Default 128. */
  maxChain?: number;
}

// ── LSB-first bit writer (RFC 1951 §3.1.1) ──────────────────────────────────
class BitWriter {
  private out: Uint8Array;
  private len = 0;
  private bitBuf = 0;
  private bitCnt = 0;

  constructor(capacity: number) { this.out = new Uint8Array(Math.max(64, capacity)); }

  private ensure(n: number): void {
    if (this.len + n <= this.out.length) return;
    const grown = new Uint8Array(Math.max(this.out.length * 2, this.len + n));
    grown.set(this.out.subarray(0, this.len));
    this.out = grown;
  }

  /** Write `count` bits of `value`, LSB first. count <= 16. */
  writeBits(value: number, count: number): void {
    this.bitBuf |= value << this.bitCnt;
    this.bitCnt += count;
    while (this.bitCnt >= 8) {
      this.ensure(1);
      this.out[this.len++] = this.bitBuf & 0xff;
      this.bitBuf >>>= 8;
      this.bitCnt -= 8;
    }
  }

  /** Pad to a byte boundary with zero bits (stored-block alignment, §3.2.4). */
  alignByte(): void {
    if (this.bitCnt > 0) {
      this.ensure(1);
      this.out[this.len++] = this.bitBuf & 0xff;
      this.bitBuf = 0;
      this.bitCnt = 0;
    }
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.out.set(bytes, this.len);
    this.len += bytes.length;
  }

  finish(): Uint8Array {
    this.alignByte();
    return this.out.slice(0, this.len);
  }
}

/**
 * LZ77 tokenizer: hash-chain matcher over the 32 KB window, optional lazy
 * matching. Tokens: value < 256 = literal byte; otherwise
 * 0x40000000 | (distance << 8) | (length - 3).
 */
function tokenize(data: Uint8Array, lazy: boolean, maxChain: number): { tokens: Uint32Array; count: number } {
  const n = data.length;
  const tokens = new Uint32Array(n); // worst case: all literals
  let count = 0;
  if (n < MIN_MATCH + 1) {
    for (let i = 0; i < n; i++) tokens[count++] = data[i]!;
    return { tokens, count };
  }

  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(n);
  const hashAt = (i: number): number =>
    ((data[i]! << 10) ^ (data[i + 1]! << 5) ^ data[i + 2]!) & (HASH_SIZE - 1);

  const insert = (i: number): void => {
    const h = hashAt(i);
    prev[i] = head[h]!;
    head[h] = i;
  };

  /** Longest match at pos against earlier positions in the chain. */
  const findMatch = (pos: number): number => {
    const maxLen = Math.min(MAX_MATCH, n - pos);
    if (maxLen < MIN_MATCH) return 0;
    const floor = pos - WINDOW;
    let best = 0;
    let bestDist = 0;
    let chain = maxChain;
    let cand = head[hashAt(pos)]!;
    while (cand >= 0 && cand >= floor && chain-- > 0) {
      // cheap pre-checks before the byte walk
      if (data[cand + best]! === data[pos + best]! && data[cand]! === data[pos]!) {
        let l = 0;
        while (l < maxLen && data[cand + l]! === data[pos + l]!) l++;
        if (l > best) {
          best = l;
          bestDist = pos - cand;
          if (l >= maxLen || l >= NICE_LEN) break;
        }
      }
      cand = prev[cand]!;
    }
    return best >= MIN_MATCH ? (bestDist << 9) | best : 0;
  };

  // Standard deflate_slow shape: a match found at position i-1 may be held
  // pending one byte; if position i matches longer, i-1 is demoted to a
  // literal and the new match becomes pending. Every position is hashed
  // exactly once, at the top of its iteration.
  const hashLimit = n - MIN_MATCH; // last position with 3 full bytes to hash
  let i = 0;
  let prevLen = 0;
  let prevDist = 0;
  let havePrev = false;
  while (i < n) {
    let mLen = 0;
    let mDist = 0;
    if (i <= hashLimit) {
      const m = findMatch(i);
      mLen = m & 0x1ff;
      mDist = m >>> 9;
      insert(i);
    }
    if (havePrev) {
      if (mLen > prevLen) {
        // current match is longer: the deferred position becomes a literal
        // and the current match becomes the pending one.
        tokens[count++] = data[i - 1]!;
        prevLen = mLen;
        prevDist = mDist;
        i++;
        continue;
      }
      // emit the pending match (it starts at i - 1)
      tokens[count++] = 0x40000000 | (prevDist << 8) | (prevLen - MIN_MATCH);
      const end = Math.min(i - 1 + prevLen, hashLimit + 1);
      for (let j = i + 1; j < end; j++) insert(j);
      i = i - 1 + prevLen;
      havePrev = false;
      continue;
    }
    if (mLen >= MIN_MATCH) {
      if (lazy && mLen < NICE_LEN && i + 1 < n) {
        prevLen = mLen;
        prevDist = mDist;
        havePrev = true;
        i++;
        continue;
      }
      tokens[count++] = 0x40000000 | (mDist << 8) | (mLen - MIN_MATCH);
      const end = Math.min(i + mLen, hashLimit + 1);
      for (let j = i + 1; j < end; j++) insert(j);
      i += mLen;
    } else {
      tokens[count++] = data[i]!;
      i++;
    }
  }
  // A pending match cannot survive the loop: deferring requires i + 1 < n and
  // a match of length >= 3 ahead, so the next iteration always resolves it.
  return { tokens, count };
}

/** The one method both writers expose to the shared token emitter. */
interface BitSink { writeBits(value: number, count: number): void; }

/**
 * Emit `count` tokens as fixed-Huffman symbols, then the end-of-block code.
 * The block header (BFINAL/BTYPE) is the caller's — it differs between the
 * one-shot (always final) and the streaming (final only on finish) paths.
 * Shared so both paths turn a token into exactly the same bits.
 */
function writeTokens(w: BitSink, tokens: Uint32Array, count: number): void {
  for (let t = 0; t < count; t++) {
    const tok = tokens[t]!;
    if (tok < 256) {
      w.writeBits(FIXED_LIT_CODE[tok]!, FIXED_LIT_BITS[tok]!);
    } else {
      const len = (tok & 0xff) + MIN_MATCH;
      const dist = (tok >>> 8) & 0xffff;
      const ls = LEN_SLOT[len - MIN_MATCH]!;
      const ds = DIST_SLOT[dist]!;
      w.writeBits(FIXED_LIT_CODE[257 + ls]!, FIXED_LIT_BITS[257 + ls]!);
      if (LEN_EXTRA[ls]! > 0) w.writeBits(len - LEN_BASE[ls]!, LEN_EXTRA[ls]!);
      w.writeBits(FIXED_DIST_CODE[ds]!, 5);
      if (DIST_EXTRA[ds]! > 0) w.writeBits(dist - DIST_BASE[ds]!, DIST_EXTRA[ds]!);
    }
  }
  w.writeBits(FIXED_LIT_CODE[256]!, FIXED_LIT_BITS[256]!); // end of block
}

/** Bit cost of the token stream under the fixed Huffman tables. */
function fixedCost(tokens: Uint32Array, count: number): number {
  let bits = 3 + FIXED_LIT_BITS[256]!; // block header + end-of-block
  for (let t = 0; t < count; t++) {
    const tok = tokens[t]!;
    if (tok < 256) {
      bits += FIXED_LIT_BITS[tok]!;
    } else {
      const lenSlot = LEN_SLOT[tok & 0xff]!;
      const distSlot = DIST_SLOT[(tok >>> 8) & 0xffff]!;
      bits += FIXED_LIT_BITS[257 + lenSlot]! + LEN_EXTRA[lenSlot]! + 5 + DIST_EXTRA[distSlot]!;
    }
  }
  return bits;
}

/**
 * Compress to a raw DEFLATE stream (RFC 1951) — no zlib header/trailer.
 * Output inflates with `DecompressionStream('deflate-raw')`,
 * `zlib.inflateRawSync`, or any conforming inflater.
 */
export function deflateRaw(data: Uint8Array, opts?: DeflateOptions): Uint8Array {
  const n = data.length;
  const lazy = opts?.lazy !== false;
  const maxChain = Math.max(1, opts?.maxChain ?? 128);

  const { tokens, count } = tokenize(data, lazy, maxChain);
  const fixedBytes = Math.ceil(fixedCost(tokens, count) / 8);
  const storedBlocks = Math.max(1, Math.ceil(n / STORED_MAX));
  const storedBytes = n + 5 * storedBlocks;

  if (fixedBytes <= storedBytes) {
    const w = new BitWriter(fixedBytes);
    w.writeBits(1, 1); // BFINAL
    w.writeBits(1, 2); // BTYPE=01 fixed Huffman (§3.2.3)
    writeTokens(w, tokens, count);
    return w.finish();
  }

  // Stored fallback (§3.2.4): incompressible data costs 5 bytes per 65535.
  const w = new BitWriter(storedBytes);
  let off = 0;
  do {
    const chunk = Math.min(STORED_MAX, n - off);
    const final = off + chunk >= n;
    w.writeBits(final ? 1 : 0, 1); // BFINAL
    w.writeBits(0, 2);             // BTYPE=00 stored
    w.alignByte();
    w.writeBytes(Uint8Array.of(chunk & 0xff, (chunk >>> 8) & 0xff, ~chunk & 0xff, (~chunk >>> 8) & 0xff)); // LEN, NLEN
    w.writeBytes(data.subarray(off, off + chunk));
    off += chunk;
  } while (off < n);
  return w.finish();
}

/**
 * Adler-32 (RFC 1950 §8): s1 += byte, s2 += s1, both mod 65521 (the largest
 * prime below 2^16), seeded s1=1 s2=0. NMAX=5552 deferred-modulo batching is
 * the standard bound from zlib's adler32.c. Returns an unsigned 32-bit value
 * (s2 << 16 | s1).
 */
export function adler32(data: Uint8Array, seed = 1): number {
  const MOD = 65521;
  const NMAX = 5552;
  let s1 = seed & 0xffff;
  let s2 = (seed >>> 16) & 0xffff;
  const n = data.length;
  let i = 0;
  while (i < n) {
    const end = Math.min(n, i + NMAX);
    for (; i < end; i++) { s1 += data[i]!; s2 += s1; }
    s1 %= MOD;
    s2 %= MOD;
  }
  return ((s2 << 16) | s1) >>> 0;
}

/**
 * Compress to a zlib stream (RFC 1950): CMF/FLG header + raw DEFLATE +
 * big-endian Adler-32 of the input. This is the wrapper PNG IDAT requires
 * (PNG spec §10.1). Output inflates with `zlib.inflateSync` or
 * `DecompressionStream('deflate')`.
 */
export function zlibCompress(data: Uint8Array, opts?: DeflateOptions): Uint8Array {
  // NOTE: the one-shot path, byte-frozen by shipped goldens. New callers with a
  // payload of unknown size want createZlibStream instead.
  const body = deflateRaw(data, opts);
  const out = new Uint8Array(2 + body.length + 4);
  // CMF 0x78: CM=8 (deflate), CINFO=7 (32 KB window). FLG 0x9C: FLEVEL=2,
  // FDICT=0, FCHECK making 0x789C = 30876 = 31·996 ≡ 0 mod 31 (RFC 1950 §2.2).
  out[0] = 0x78;
  out[1] = 0x9c;
  out.set(body, 2);
  const a = adler32(data);
  const o = 2 + body.length;
  out[o] = (a >>> 24) & 0xff;
  out[o + 1] = (a >>> 16) & 0xff;
  out[o + 2] = (a >>> 8) & 0xff;
  out[o + 3] = a & 0xff;
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Slab-fed (streaming) DEFLATE — create -> push -> finish
// ────────────────────────────────────────────────────────────────────────────

/**
 * Bytes of context a match may need beyond the current position: the longest
 * match plus a hash's worth, plus one. zlib's MIN_LOOKAHEAD (deflate.h) — the
 * amount that must be buffered AHEAD of the cursor before a match decision can
 * be made without the answer depending on where a slab happened to end.
 */
const MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1; // 262

/**
 * Furthest back a streaming match may reach. zlib's MAX_DIST: the window is
 * slid a whole `WINDOW` at a time, so the last `MIN_LOOKAHEAD` bytes of reach
 * are given up to guarantee every referenced byte (and every `prev` chain entry
 * for it) is still resident after a slide. Costs a hair of ratio versus the
 * one-shot matcher's full 32768 and buys O(1) memory.
 */
const MAX_DIST = WINDOW - MIN_LOOKAHEAD; // 32506

/** Input bytes per emitted block. Kept well under STORED_MAX so the stored
 *  fallback for one block is always expressible as a single LEN. */
const DEFAULT_BLOCK_BYTES = 32768;

/** Growable byte sink that can hand back the complete bytes produced so far. */
class StreamWriter implements BitSink {
  private out = new Uint8Array(1 << 16);
  private len = 0;
  private bitBuf = 0;
  private bitCnt = 0;

  private ensure(n: number): void {
    if (this.len + n <= this.out.length) return;
    const grown = new Uint8Array(Math.max(this.out.length * 2, this.len + n));
    grown.set(this.out.subarray(0, this.len));
    this.out = grown;
  }

  writeBits(value: number, count: number): void {
    this.bitBuf |= value << this.bitCnt;
    this.bitCnt += count;
    while (this.bitCnt >= 8) {
      this.ensure(1);
      this.out[this.len++] = this.bitBuf & 0xff;
      this.bitBuf >>>= 8;
      this.bitCnt -= 8;
    }
  }

  alignByte(): void {
    if (this.bitCnt > 0) {
      this.ensure(1);
      this.out[this.len++] = this.bitBuf & 0xff;
      this.bitBuf = 0;
      this.bitCnt = 0;
    }
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.out.set(bytes, this.len);
    this.len += bytes.length;
  }

  /** Complete bytes emitted since the last drain. Partial bits stay buffered. */
  drain(): Uint8Array {
    const out = this.out.slice(0, this.len);
    this.len = 0;
    return out;
  }
}

/** Options for {@link createDeflateStream} / {@link createZlibStream}. */
export interface DeflateStreamOptions extends DeflateOptions {
  /**
   * Input bytes per emitted DEFLATE block (default 32768, clamped to
   * 1024..65235). Smaller blocks let incompressible stretches fall back to
   * stored sooner; larger blocks amortise the ~1.3 bytes of block overhead.
   */
  blockBytes?: number;
}

/**
 * A push-based DEFLATE session. Slabs stream in; scratch stays O(1) in the
 * total input (one 32 KB window, a hash table, one block of tokens).
 */
export interface DeflateStream {
  /**
   * Compress one slab. Any size, including 0 — slab boundaries do NOT affect
   * correctness and barely affect ratio (the LZ77 window carries across them).
   * The slab is copied into the window before returning, so the caller may
   * reuse the buffer immediately. Returns the stream bytes completed by this
   * push (often empty; never a partial byte).
   */
  push(slab: Uint8Array): Uint8Array;
  /**
   * Flush the last block with BFINAL=1, byte-align, and return the remaining
   * stream bytes. The concatenation of every push result and this is the
   * complete stream. Not callable twice.
   */
  finish(): Uint8Array;
  /** Uncompressed bytes accepted so far. */
  readonly bytesIn: number;
  /** Stream bytes produced so far. */
  readonly bytesOut: number;
}

/**
 * Create a slab-fed raw DEFLATE stream (RFC 1951).
 *
 * ```ts
 * const z = createDeflateStream();
 * const parts = [];
 * for (const slab of slabs) parts.push(z.push(slab));
 * parts.push(z.finish());
 * ```
 *
 * The output is a normal multi-block DEFLATE stream: fixed-Huffman blocks with
 * a per-block stored fallback (§3.2.4), BFINAL only on the last. Every block
 * after the first may reference the previous ~32 KB, so cross-slab repetition
 * compresses exactly as it would in one shot.
 */
export function createDeflateStream(opts: DeflateStreamOptions = {}): DeflateStream {
  const lazy = opts.lazy !== false;
  const maxChain = Math.max(1, opts.maxChain ?? 128);
  // Reject rather than clamp: Math.floor(NaN) survives min/max as NaN, and a NaN
  // token-array length becomes a ZERO-length array, whose out-of-bounds writes are
  // silently dropped -- producing a well-formed but undecodable stream. Loud is right.
  const rawBlock = opts.blockBytes ?? DEFAULT_BLOCK_BYTES;
  if (!Number.isFinite(rawBlock)) throw new Error('deflate stream: blockBytes must be a finite number');
  const blockBytes = Math.min(STORED_MAX - 300, Math.max(1024, Math.floor(rawBlock)));

  // ── O(1) state: 64 KB window + 128 KB head + 128 KB prev + one block of tokens
  const win = new Uint8Array(2 * WINDOW);
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(WINDOW).fill(-1);
  const tokens = new Uint32Array(blockBytes + MAX_MATCH + 8);
  const w = new StreamWriter();

  let winLen = 0;      // bytes resident in `win`
  let strstart = 0;    // matcher cursor within `win`
  let blockStart = 0;  // first byte of the open block within `win`
  let tokenEnd = 0;    // position the emitted tokens cover up to (<= strstart)
  let tokenCount = 0;
  // Lazy-match state deliberately lives here, not in a local: a slab may end
  // between a deferred match and its resolution.
  let prevLen = 0;
  let prevDist = 0;
  let havePrev = false;
  let finished = false;
  let bytesIn = 0;
  let bytesOut = 0;

  const hashAt = (i: number): number =>
    ((win[i]! << 10) ^ (win[i + 1]! << 5) ^ win[i + 2]!) & (HASH_SIZE - 1);

  const insert = (i: number): void => {
    const h = hashAt(i);
    prev[i & (WINDOW - 1)] = head[h]!;
    head[h] = i;
  };

  /** Longest match at pos against the resident window. 0, or (dist << 9) | len. */
  const findMatch = (pos: number): number => {
    const maxLen = Math.min(MAX_MATCH, winLen - pos);
    if (maxLen < MIN_MATCH) return 0;
    const floor = pos - MAX_DIST;
    let best = 0;
    let bestDist = 0;
    let chain = maxChain;
    let cand = head[hashAt(pos)]!;
    while (cand >= 0 && cand >= floor && chain-- > 0) {
      if (win[cand + best]! === win[pos + best]! && win[cand]! === win[pos]!) {
        let l = 0;
        while (l < maxLen && win[cand + l]! === win[pos + l]!) l++;
        if (l > best) {
          best = l;
          bestDist = pos - cand;
          if (l >= maxLen || l >= NICE_LEN) break;
        }
      }
      cand = prev[cand & (WINDOW - 1)]!;
    }
    return best >= MIN_MATCH ? (bestDist << 9) | best : 0;
  };

  /**
   * Close the open block. Chooses fixed-Huffman or stored per block on the same
   * cost model the one-shot uses, so an incompressible stretch inside an
   * otherwise compressible stream costs 5 bytes rather than expanding.
   */
  const flushBlock = (final: boolean): void => {
    if (!final && tokenCount === 0) return;    // nothing to say yet
    const rawLen = tokenEnd - blockStart;
    const fixedBytes = Math.ceil(fixedCost(tokens, tokenCount) / 8);
    if (fixedBytes <= rawLen + 5) {
      w.writeBits(final ? 1 : 0, 1);
      w.writeBits(1, 2);                        // BTYPE=01 fixed Huffman
      writeTokens(w, tokens, tokenCount);
    } else {
      w.writeBits(final ? 1 : 0, 1);
      w.writeBits(0, 2);                        // BTYPE=00 stored (§3.2.4)
      w.alignByte();
      w.writeBytes(Uint8Array.of(rawLen & 0xff, (rawLen >>> 8) & 0xff, ~rawLen & 0xff, (~rawLen >>> 8) & 0xff));
      w.writeBytes(win.subarray(blockStart, tokenEnd));
    }
    tokenCount = 0;
    blockStart = tokenEnd;                      // stays >= 0 across slides: see slide()
  };

  const maybeFlush = (): void => {
    if (tokenEnd - blockStart >= blockBytes) flushBlock(false);
  };

  const emitLiteral = (b: number): void => {
    tokens[tokenCount++] = b;
    tokenEnd++;
    maybeFlush();
  };

  const emitMatch = (dist: number, len: number): void => {
    tokens[tokenCount++] = 0x40000000 | (dist << 8) | (len - MIN_MATCH);
    tokenEnd += len;
    maybeFlush();
  };

  /**
   * Advance the matcher. `final` = no more input will arrive, so run to the end
   * of the window; otherwise stop MIN_LOOKAHEAD short, which is what makes the
   * decisions independent of where the slab ended.
   *
   * Shape is zlib's deflate_slow, identical to the one-shot tokenizer's: a
   * match at i-1 may be held pending one byte and demoted to a literal if i
   * matches longer.
   */
  const run = (final: boolean): void => {
    const runTo = final ? winLen : winLen - MIN_LOOKAHEAD;
    const hashLimit = winLen - MIN_MATCH;       // last position with 3 bytes to hash
    while (strstart < runTo) {
      let mLen = 0;
      let mDist = 0;
      if (strstart <= hashLimit) {
        const m = findMatch(strstart);
        mLen = m & 0x1ff;
        mDist = m >>> 9;
        insert(strstart);
      }
      if (havePrev) {
        if (mLen > prevLen) {
          emitLiteral(win[strstart - 1]!);
          prevLen = mLen;
          prevDist = mDist;
          strstart++;
          continue;
        }
        emitMatch(prevDist, prevLen);
        const end = Math.min(strstart - 1 + prevLen, hashLimit + 1);
        for (let j = strstart + 1; j < end; j++) insert(j);
        strstart = strstart - 1 + prevLen;
        havePrev = false;
        continue;
      }
      if (mLen >= MIN_MATCH) {
        if (lazy && mLen < NICE_LEN && strstart + 1 < winLen) {
          prevLen = mLen;
          prevDist = mDist;
          havePrev = true;
          strstart++;
          continue;
        }
        emitMatch(mDist, mLen);
        const end = Math.min(strstart + mLen, hashLimit + 1);
        for (let j = strstart + 1; j < end; j++) insert(j);
        strstart += mLen;
      } else {
        emitLiteral(win[strstart]!);
        strstart++;
      }
    }
    // A pending match cannot survive a FINAL run for the same reason it cannot
    // survive the one-shot loop: deferring requires a byte after it, so the next
    // iteration always resolves it. In a non-final run it is carried forward.
  };

  /**
   * Slide the window down by WINDOW bytes to make room. The open block is
   * flushed FIRST, which is what keeps `blockStart` addressable (it becomes
   * tokenEnd >= strstart - 1 >= WINDOW) and keeps a stored block's source bytes
   * resident. Positions shift by exactly WINDOW, so `prev`'s window-masked
   * indices are unchanged and only the values need adjusting.
   */
  const slide = (): void => {
    flushBlock(false);
    win.copyWithin(0, WINDOW, winLen);
    winLen -= WINDOW;
    strstart -= WINDOW;
    blockStart -= WINDOW;
    tokenEnd -= WINDOW;
    for (let i = 0; i < HASH_SIZE; i++) { const v = head[i]!; head[i] = v >= WINDOW ? v - WINDOW : -1; }
    for (let i = 0; i < WINDOW; i++) { const v = prev[i]!; prev[i] = v >= WINDOW ? v - WINDOW : -1; }
  };

  return {
    push(slab: Uint8Array): Uint8Array {
      if (finished) throw new Error('deflate stream: push after finish.');
      bytesIn += slab.length;
      let off = 0;
      while (off < slab.length) {
        if (winLen === win.length) {
          run(false);
          // run() leaves strstart at winLen - MIN_LOOKAHEAD, comfortably past
          // WINDOW, so the slide never discards a byte a later match can reach.
          slide();
        }
        const n = Math.min(win.length - winLen, slab.length - off);
        win.set(slab.subarray(off, off + n), winLen);
        winLen += n;
        off += n;
        run(false);
      }
      const out = w.drain();
      bytesOut += out.length;
      return out;
    },

    finish(): Uint8Array {
      if (finished) throw new Error('deflate stream: finish called twice.');
      run(true);
      flushBlock(true);
      w.alignByte();
      finished = true;
      const out = w.drain();
      bytesOut += out.length;
      return out;
    },

    get bytesIn() { return bytesIn; },
    get bytesOut() { return bytesOut; },
  };
}

/**
 * Create a slab-fed zlib stream (RFC 1950): the same 2-byte header
 * `zlibCompress` writes, a streamed DEFLATE body, and the big-endian Adler-32
 * of everything pushed. This is what a PNG IDAT of unknown size wants.
 */
export function createZlibStream(opts: DeflateStreamOptions = {}): DeflateStream {
  const raw = createDeflateStream(opts);
  let adler = 1;
  let headerPending = true;
  let bytesOut = 0;

  // Same CMF/FLG as zlibCompress — see its comment for the FCHECK arithmetic.
  const withHeader = (body: Uint8Array): Uint8Array => {
    if (!headerPending) return body;
    headerPending = false;
    const out = new Uint8Array(2 + body.length);
    out[0] = 0x78;
    out[1] = 0x9c;
    out.set(body, 2);
    return out;
  };

  return {
    push(slab: Uint8Array): Uint8Array {
      adler = adler32(slab, adler);
      const out = withHeader(raw.push(slab));
      bytesOut += out.length;
      return out;
    },

    finish(): Uint8Array {
      const body = raw.finish();
      const out = new Uint8Array((headerPending ? 2 : 0) + body.length + 4);
      let o = 0;
      if (headerPending) { headerPending = false; out[0] = 0x78; out[1] = 0x9c; o = 2; }
      out.set(body, o);
      o += body.length;
      out[o] = (adler >>> 24) & 0xff;
      out[o + 1] = (adler >>> 16) & 0xff;
      out[o + 2] = (adler >>> 8) & 0xff;
      out[o + 3] = adler & 0xff;
      bytesOut += out.length;
      return out;
    },

    get bytesIn() { return raw.bytesIn; },
    get bytesOut() { return bytesOut; },
  };
}
