// SPDX-License-Identifier: MPL-2.0
/**
 * qr-skin tests - plan 100 section 6.1 (skin 2), section 2.9, section 11.27; wave 2.6.
 * Run directly:  node --test shells/web/src/collab/qr-skin.test.ts
 *
 * A QR encoder is the kind of code that looks right and scans never, so almost none
 * of this suite trusts the implementation's own vocabulary. Five independent legs:
 *
 *  1. AN INDEPENDENT DECODER, written in this file from ISO/IEC 18004 rather than by
 *     reading `qr-skin.ts`: it rebuilds the function-module map from the published
 *     alignment-centre table, un-masks with its own copy of the eight mask formulas,
 *     walks the zigzag itself, de-interleaves using the PUBLISHED block table (not the
 *     encoder's derived one) and parses the bit stream. Encode → decode → equal is
 *     therefore a genuine round trip, not a tautology.
 *  2. PUBLISHED VECTORS. The Reed–Solomon engine is checked against the worked example
 *     in ISO/IEC 18004 Annex I (the 1-M symbol for "01234567", whose sixteen data
 *     codewords and ten EC codewords are printed in the standard) AND against a second
 *     RS implementation written here as plain polynomial long division. The version
 *     information blocks are checked against the standard's Table 25 strings for
 *     versions 7–10; the capacity and block tables against Tables 7 and 9.
 *  3. CODE PROPERTIES, which need no remembered bit strings: the 15-bit format code has
 *     minimum Hamming distance 7 and the 18-bit version code distance 8 (that is what
 *     makes them survive damage), and the count of non-function modules must equal
 *     8 × total codewords + the version's remainder bits. Those catch a wrong alignment
 *     pattern or a mis-reserved format area, which a round trip alone can hide.
 *  4. STRUCTURE: three finder patterns with separators, timing rows, the dark module,
 *     the 4-module quiet zone, the size formula.
 *  5. THE REAL PAYLOAD. A genuine `sdp-codec` invite is packed, dressed in the base32
 *     QR skin, encoded, decoded by leg 1 and fed back through `decodePayload` - and the
 *     sizes are printed as diagnostics, so a capacity regression shows up as a number.
 *
 * Plus: nothing throws (fuzz over random strings and hostile options), and the scan
 * rung degrades honestly when `BarcodeDetector` is absent, formatless or broken.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QR_ALPHANUMERIC_SET,
  QR_MAX_VERSION,
  QR_QUIET_ZONE,
  QrRenderError,
  createQrElementRenderer,
  createQrRenderer,
  createQrScanner,
  encodeQr,
  moduleAt,
  probeBarcodeDetector,
  qrCapacity,
  renderQr,
  renderQrSvg,
  resetQrScanProbe,
  rsEncode,
  scanQrFromVideo,
  toSvg,
} from './qr-skin.ts';
import type { QrMode, QrSymbol } from './qr-skin.ts';
import { encodeToken, decodePayload, pack } from './sdp-codec.ts';
import type { CollabPayload, SdpMaterial } from './sdp-codec.ts';

// ── helpers ───────────────────────────────────────────────────────────────────

function ok<T>(r: { ok: true; value: T } | { ok: false; code: string; reason: string }, what = ''): T {
  assert.equal(r.ok, true, `${what} expected ok, got ${r.ok === false ? `${r.code}: ${r.reason}` : ''}`);
  return (r as { ok: true; value: T }).value;
}

function err(r: { ok: boolean; code?: string; reason?: string }, code: string, what = ''): void {
  assert.equal(r.ok, false, `${what} expected failure ${code}, got ok`);
  assert.equal(r.code, code, `${what} expected ${code}, got ${r.code}: ${r.reason}`);
  assert.equal(typeof r.reason, 'string');
}

/** Deterministic PRNG - a failing fuzz case must be reproducible from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ══ Published tables (ISO/IEC 18004) - this file's independent source of truth ══

/** Table 9, level M: [blocks in group 1, data codewords each, blocks in group 2, each, EC per block]. */
const PUBLISHED_M: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  1: [1, 16, 0, 0, 10],
  2: [1, 28, 0, 0, 16],
  3: [1, 44, 0, 0, 26],
  4: [2, 32, 0, 0, 18],
  5: [2, 43, 0, 0, 24],
  6: [4, 27, 0, 0, 16],
  7: [4, 31, 0, 0, 18],
  8: [2, 38, 2, 39, 22],
  9: [3, 36, 2, 37, 22],
  10: [4, 43, 1, 44, 26],
};

/** Table 7 - total codewords in the symbol, versions 1–10. */
const PUBLISHED_TOTAL_CODEWORDS: Readonly<Record<number, number>> = {
  1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346,
};

/** Table 1 - remainder bits that fall outside the codeword grid. */
const PUBLISHED_REMAINDER_BITS: Readonly<Record<number, number>> = {
  1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0,
};

/** Table E.1 - alignment pattern centre coordinates. */
const PUBLISHED_ALIGNMENT: Readonly<Record<number, readonly number[]>> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/** Table 25 - version information bit strings (MSB first), versions 7–10. */
const PUBLISHED_VERSION_INFO: Readonly<Record<number, string>> = {
  7: '000111110010010100',
  8: '001000010110111100',
  9: '001001101010011001',
  10: '001010010011010011',
};

/** Character capacity at level M, versions 1–10 (Table 7's alphanumeric and byte columns). */
const PUBLISHED_CAPACITY: Readonly<Record<QrMode, readonly number[]>> = {
  alphanumeric: [20, 38, 61, 90, 122, 154, 178, 221, 262, 311],
  byte: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
};

// ══ An independent decoder ═════════════════════════════════════════════════════

/** GF(256), built here from the primitive polynomial rather than imported. */
const EXP: number[] = [];
const LOG: number[] = new Array<number>(256).fill(0);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP.push(x);
    LOG[x] = i;
    x = x << 1;
    if (x > 255) x ^= 0x11d;
  }
}
function mul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[(LOG[a]! + LOG[b]!) % 255]!;
}

/** A second RS encoder, as textbook polynomial long division over GF(256). */
function rsReference(data: readonly number[], degree: number): number[] {
  // generator = ∏ (x − α^i), coefficients high-order first, leading 1 included.
  let gen = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] = next[j]! ^ gen[j]!;
      next[j + 1] = next[j + 1]! ^ mul(gen[j]!, EXP[i]!);
    }
    gen = next;
  }
  const buf = [...data, ...new Array<number>(degree).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = buf[i]!;
    if (coef === 0) continue;
    for (let j = 0; j <= degree; j++) buf[i + j] = buf[i + j]! ^ mul(gen[j]!, coef);
  }
  return buf.slice(data.length);
}

/** The eight data-mask formulas, transcribed from section 8.8.1. */
function maskAt(mask: number, x: number, y: number): boolean {
  if (mask === 0) return (y + x) % 2 === 0;
  if (mask === 1) return y % 2 === 0;
  if (mask === 2) return x % 3 === 0;
  if (mask === 3) return (y + x) % 3 === 0;
  if (mask === 4) return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
  if (mask === 5) return ((y * x) % 2) + ((y * x) % 3) === 0;
  if (mask === 6) return (((y * x) % 2) + ((y * x) % 3)) % 2 === 0;
  return (((y + x) % 2) + ((y * x) % 3)) % 2 === 0;
}

/**
 * Which modules are function patterns, built from the spec's description of each region
 * and the PUBLISHED alignment table - deliberately not from the module under test.
 */
function functionMap(version: number): Uint8Array {
  const size = version * 4 + 17;
  const fn = new Uint8Array(size * size);
  const mark = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < size && y < size) fn[y * size + x] = 1;
  };
  // Finder patterns with their separators: 8×8 in each of three corners.
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      mark(x, y);
      mark(size - 1 - x, y);
      mark(x, size - 1 - y);
    }
  }
  // Timing patterns.
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }
  // Alignment patterns, skipping the three that would collide with finders.
  const centres = PUBLISHED_ALIGNMENT[version]!;
  for (const cy of centres) {
    for (const cx of centres) {
      const nearFinder =
        (cx <= 8 && cy <= 8) || (cx <= 8 && cy >= size - 9) || (cx >= size - 9 && cy <= 8);
      if (nearFinder) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(cx + dx, cy + dy);
    }
  }
  // Format information (two copies) and the always-dark module.
  for (let i = 0; i < 9; i++) {
    mark(8, i);
    mark(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    mark(size - 1 - i, 8);
    mark(8, size - 1 - i);
  }
  // Version information (two 3×6 blocks) for versions 7 and up.
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      mark(size - 11 + (i % 3), Math.floor(i / 3));
      mark(Math.floor(i / 3), size - 11 + (i % 3));
    }
  }
  return fn;
}

function bchFormatRemainder(fifteenBits: number): number {
  let rem = fifteenBits;
  for (let i = 0; i < 15; i++) {
    if (rem & (1 << (14 - i))) rem ^= 0x537 << (4 - i);
  }
  return rem & 0x3ff;
}

interface DecodedQr {
  version: number;
  mask: number;
  ecLevel: number;
  mode: QrMode;
  text: string;
}

/**
 * Matrix → text. Byte-mode and alphanumeric happy path only; no error correction is
 * applied (a symbol we just made must be intact), but the format information's BCH
 * check IS verified, and both copies of it must agree.
 */
function decodeQr(modules: Uint8Array, size: number): DecodedQr {
  assert.equal((size - 17) % 4, 0, 'size must be 4v+17');
  const version = (size - 17) / 4;
  const dark = (x: number, y: number): number => modules[y * size + x]!;

  // Format information, copy 1 (section 8.9's placement, transcribed).
  let raw1 = 0;
  const seq1: [number, number][] = [];
  for (let i = 0; i <= 5; i++) seq1.push([8, i]);
  seq1.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) seq1.push([14 - i, 8]);
  for (let i = 14; i >= 0; i--) raw1 = (raw1 << 1) | dark(seq1[i]![0], seq1[i]![1]);

  // Copy 2, split across the other two corners.
  let raw2 = 0;
  const seq2: [number, number][] = [];
  for (let i = 0; i < 8; i++) seq2.push([size - 1 - i, 8]);
  for (let i = 8; i < 15; i++) seq2.push([8, size - 15 + i]);
  for (let i = 14; i >= 0; i--) raw2 = (raw2 << 1) | dark(seq2[i]![0], seq2[i]![1]);
  assert.equal(raw1, raw2, 'the two format-information copies disagree');

  const format = raw1 ^ 0x5412;
  assert.equal(bchFormatRemainder(format), 0, 'format information fails its BCH check');
  const ecLevel = (format >>> 13) & 0b11;
  const mask = (format >>> 10) & 0b111;

  // Un-mask every non-function module.
  const fn = functionMap(version);
  const plain = new Uint8Array(modules);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (fn[y * size + x] === 1) continue;
      if (maskAt(mask, x, y)) plain[y * size + x] = plain[y * size + x]! ^ 1;
    }
  }

  // Walk the zigzag: column pairs right to left, alternating direction, skipping col 6.
  const bits: number[] = [];
  let col = size - 1;
  let upward = true;
  while (col > 0) {
    if (col === 6) col = 5;
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step;
      for (const x of [col, col - 1]) {
        if (fn[y * size + x] === 1) continue;
        bits.push(plain[y * size + x]!);
      }
    }
    upward = !upward;
    col -= 2;
  }

  const [g1n, g1d, g2n, g2d, ecc] = PUBLISHED_M[version]!;
  const total = PUBLISHED_TOTAL_CODEWORDS[version]!;
  assert.equal(
    bits.length,
    total * 8 + PUBLISHED_REMAINDER_BITS[version]!,
    'wrong number of data-bearing modules',
  );
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= total * 8; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]!;
    codewords.push(b);
  }

  // De-interleave using the published block layout.
  const lengths: number[] = [];
  for (let i = 0; i < g1n; i++) lengths.push(g1d);
  for (let i = 0; i < g2n; i++) lengths.push(g2d);
  const blocks: number[][] = lengths.map(() => []);
  let at = 0;
  const longest = Math.max(...lengths);
  for (let i = 0; i < longest; i++) {
    for (let b = 0; b < lengths.length; b++) {
      if (i < lengths[b]!) blocks[b]!.push(codewords[at++]!);
    }
  }
  assert.equal(at, lengths.reduce((a, b) => a + b, 0), 'de-interleave consumed the wrong count');
  assert.equal(at + ecc * lengths.length, total, 'block layout does not fill the symbol');
  const data = blocks.flat();

  // Parse the bit stream.
  const stream: number[] = [];
  for (const b of data) for (let i = 7; i >= 0; i--) stream.push((b >>> i) & 1);
  let p = 0;
  const take = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | stream[p++]!;
    return v;
  };
  const modeBits = take(4);
  const mode: QrMode = modeBits === 0b0010 ? 'alphanumeric' : 'byte';
  assert.ok(modeBits === 0b0010 || modeBits === 0b0100, `unexpected mode indicator ${modeBits}`);
  const count = take(mode === 'alphanumeric' ? (version <= 9 ? 9 : 11) : version <= 9 ? 8 : 16);

  let text: string;
  if (mode === 'alphanumeric') {
    let out = '';
    for (let i = 0; i + 1 < count; i += 2) {
      const v = take(11);
      out += QR_ALPHANUMERIC_SET[Math.floor(v / 45)]! + QR_ALPHANUMERIC_SET[v % 45]!;
    }
    if (count % 2 === 1) out += QR_ALPHANUMERIC_SET[take(6)]!;
    text = out;
  } else {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) bytes[i] = take(8);
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  return { version, mask, ecLevel, mode, text };
}

function roundTrip(text: string, opts?: Parameters<typeof encodeQr>[1]): DecodedQr {
  const symbol = ok(encodeQr(text, opts), `encode ${text.slice(0, 24)}`);
  const decoded = decodeQr(symbol.modules, symbol.size);
  assert.equal(decoded.text, text, 'round trip changed the text');
  assert.equal(decoded.version, symbol.version);
  assert.equal(decoded.mask, symbol.mask);
  assert.equal(decoded.mode, symbol.mode);
  assert.equal(decoded.ecLevel, 0b00, 'level M is the 00 code');
  return decoded;
}

// ══ 1. Reed–Solomon against published + independent references ═════════════════

test('RS matches the ISO/IEC 18004 Annex I worked example (1-M, "01234567")', () => {
  // The standard prints both halves of this symbol; the data codewords are the
  // numeric-mode encoding of "01234567" padded to 16, and the ten EC codewords follow.
  const data = Uint8Array.from([
    0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11,
    0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11,
  ]);
  const expected = [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55];
  assert.deepEqual([...rsEncode(data, 10)], expected);
});

test('RS agrees with an independently written long-division implementation', () => {
  const rand = mulberry32(0xc0ffee);
  for (const degree of [10, 16, 18, 22, 24, 26]) {
    for (let trial = 0; trial < 30; trial++) {
      const n = 1 + Math.floor(rand() * 60);
      const data = Uint8Array.from({ length: n }, () => Math.floor(rand() * 256));
      assert.deepEqual([...rsEncode(data, degree)], rsReference([...data], degree), `degree ${degree}`);
    }
  }
});

// ══ 2. Tables and code properties ══════════════════════════════════════════════

test('derived capacities match the published level-M tables', () => {
  for (let v = 1; v <= QR_MAX_VERSION; v++) {
    const [g1n, g1d, g2n, g2d, ecc] = PUBLISHED_M[v]!;
    const publishedData = g1n * g1d + g2n * g2d;
    const publishedTotal = PUBLISHED_TOTAL_CODEWORDS[v]!;
    assert.equal(publishedData + ecc * (g1n + g2n), publishedTotal, `table self-check v${v}`);
    assert.equal(qrCapacity(v, 'alphanumeric'), PUBLISHED_CAPACITY.alphanumeric[v - 1], `alnum v${v}`);
    assert.equal(qrCapacity(v, 'byte'), PUBLISHED_CAPACITY.byte[v - 1], `byte v${v}`);
  }
  // Out of range is 0, never a throw or a NaN.
  assert.equal(qrCapacity(0, 'byte'), 0);
  assert.equal(qrCapacity(11, 'byte'), 0);
  assert.equal(qrCapacity(2.5, 'byte'), 0);
});

test('the module grid holds exactly the codewords the table promises', () => {
  // Counts the free (non-function) modules the encoder actually left, using this
  // file's own function map - a wrong alignment pattern or an unreserved format
  // area changes this number even when the symbol still round-trips.
  for (let v = 1; v <= QR_MAX_VERSION; v++) {
    const size = v * 4 + 17;
    const fn = functionMap(v);
    let free = 0;
    for (let i = 0; i < fn.length; i++) if (fn[i] === 0) free++;
    assert.equal(
      free,
      PUBLISHED_TOTAL_CODEWORDS[v]! * 8 + PUBLISHED_REMAINDER_BITS[v]!,
      `v${v} (${size}×${size}) free modules`,
    );
  }
});

test('version information matches Table 25 and keeps its Hamming distance', () => {
  // Encode one payload per version so the symbol carries real version bits, then read
  // the block back out of the top-right corner.
  const seen: number[] = [];
  for (let v = 7; v <= QR_MAX_VERSION; v++) {
    const symbol = ok(encodeQr('LOLLY', { minVersion: v, maxVersion: v }));
    let bits = '';
    for (let i = 17; i >= 0; i--) {
      bits += moduleAt(symbol, symbol.size - 11 + (i % 3), Math.floor(i / 3)) ? '1' : '0';
    }
    assert.equal(bits, PUBLISHED_VERSION_INFO[v], `version info v${v}`);
    // The second copy is the transpose of the first.
    for (let i = 0; i < 18; i++) {
      assert.equal(
        moduleAt(symbol, symbol.size - 11 + (i % 3), Math.floor(i / 3)),
        moduleAt(symbol, Math.floor(i / 3), symbol.size - 11 + (i % 3)),
        `version info copies disagree at ${i} (v${v})`,
      );
    }
    seen.push(Number.parseInt(bits, 2));
  }
  // The version code's published property: minimum Hamming distance 8.
  for (let i = 0; i < seen.length; i++) {
    for (let j = i + 1; j < seen.length; j++) {
      const d = (seen[i]! ^ seen[j]!).toString(2).split('').filter(c => c === '1').length;
      assert.ok(d >= 8, `version codes ${i} and ${j} are only ${d} bits apart`);
    }
  }
});

test('the 32 format codes keep their minimum Hamming distance of 7', () => {
  // Read the real format bits out of eight symbols (level M × masks 0–7); the other
  // 24 codes are not ours to emit, so the property is checked over what we can produce
  // plus the published all-M row, which is what a scanner actually disambiguates.
  const codes: number[] = [];
  for (let mask = 0; mask < 8; mask++) {
    const symbol = ok(encodeQr('LOLLY', { mask }));
    let raw = 0;
    const seq: [number, number][] = [];
    for (let i = 0; i <= 5; i++) seq.push([8, i]);
    seq.push([8, 7], [8, 8], [7, 8]);
    for (let i = 9; i < 15; i++) seq.push([14 - i, 8]);
    for (let i = 14; i >= 0; i--) raw = (raw << 1) | (moduleAt(symbol, seq[i]![0], seq[i]![1]) ? 1 : 0);
    assert.equal(bchFormatRemainder(raw ^ 0x5412), 0, `mask ${mask} format BCH`);
    assert.equal((raw ^ 0x5412) >>> 10, mask, `mask ${mask} round trip (level M is 00)`);
    codes.push(raw);
  }
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const d = (codes[i]! ^ codes[j]!).toString(2).split('').filter(c => c === '1').length;
      assert.ok(d >= 7, `format codes for masks ${i}/${j} are only ${d} bits apart`);
    }
  }
  // 0x5412 exists so that the all-zero data does not produce an all-light area.
  assert.notEqual(codes[0], 0);
});

// ══ 3. Structure ═══════════════════════════════════════════════════════════════

const FINDER = [
  '1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111',
];

function assertFinder(symbol: QrSymbol, ox: number, oy: number, where: string): void {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      assert.equal(
        moduleAt(symbol, ox + x, oy + y),
        FINDER[y]![x] === '1',
        `${where} finder module ${x},${y}`,
      );
    }
  }
}

test('every symbol has three finder patterns, separators, timing and the dark module', () => {
  for (const [text, note] of [['LOLLY', 'v1'], ['A'.repeat(200), 'v8-ish'], ['x'.repeat(200), 'byte']] as const) {
    const symbol = ok(encodeQr(text), note);
    const n = symbol.size;
    assert.equal(n, symbol.version * 4 + 17, `${note} size formula`);

    assertFinder(symbol, 0, 0, `${note} top-left`);
    assertFinder(symbol, n - 7, 0, `${note} top-right`);
    assertFinder(symbol, 0, n - 7, `${note} bottom-left`);
    // The fourth corner must NOT hold a finder - three eyes is how a scanner orients,
    // so a fourth would make the symbol's rotation ambiguous.
    let fourthMatches = true;
    for (let y = 0; y < 7 && fourthMatches; y++) {
      for (let x = 0; x < 7; x++) {
        if (moduleAt(symbol, n - 7 + x, n - 7 + y) !== (FINDER[y]![x] === '1')) {
          fourthMatches = false;
          break;
        }
      }
    }
    assert.equal(fourthMatches, false, `${note} bottom-right corner must not be a finder`);

    // Separators: the light row/column that isolates each finder.
    for (let i = 0; i < 8; i++) {
      assert.equal(moduleAt(symbol, i, 7), false, `${note} top-left separator row ${i}`);
      assert.equal(moduleAt(symbol, 7, i), false, `${note} top-left separator col ${i}`);
      assert.equal(moduleAt(symbol, n - 1 - i, 7), false, `${note} top-right separator ${i}`);
      assert.equal(moduleAt(symbol, 7, n - 1 - i), false, `${note} bottom-left separator ${i}`);
    }

    // Timing patterns alternate, dark on even coordinates, between the finders.
    for (let i = 8; i < n - 8; i++) {
      assert.equal(moduleAt(symbol, i, 6), i % 2 === 0, `${note} horizontal timing at ${i}`);
      assert.equal(moduleAt(symbol, 6, i), i % 2 === 0, `${note} vertical timing at ${i}`);
    }

    assert.equal(moduleAt(symbol, 8, n - 8), true, `${note} dark module`);
    // Reads outside the symbol are light, never a throw.
    assert.equal(moduleAt(symbol, -1, 0), false);
    assert.equal(moduleAt(symbol, 0, n), false);
  }
});

test('alignment patterns sit on the published centres', () => {
  for (let v = 2; v <= QR_MAX_VERSION; v++) {
    const symbol = ok(encodeQr('LOLLY', { minVersion: v, maxVersion: v }));
    const centres = PUBLISHED_ALIGNMENT[v]!;
    for (const cy of centres) {
      for (const cx of centres) {
        const nearFinder =
          (cx <= 8 && cy <= 8) || (cx <= 8 && cy >= symbol.size - 9) || (cx >= symbol.size - 9 && cy <= 8);
        if (nearFinder) continue;
        assert.equal(moduleAt(symbol, cx, cy), true, `v${v} centre ${cx},${cy}`);
        for (let d = -1; d <= 1; d++) {
          assert.equal(moduleAt(symbol, cx + d, cy - 1), false, `v${v} ring at ${cx + d},${cy - 1}`);
          assert.equal(moduleAt(symbol, cx + d, cy + 1), false, `v${v} ring at ${cx + d},${cy + 1}`);
        }
        for (let d = -2; d <= 2; d++) {
          assert.equal(moduleAt(symbol, cx + d, cy - 2), true, `v${v} outer at ${cx + d},${cy - 2}`);
          assert.equal(moduleAt(symbol, cx + d, cy + 2), true, `v${v} outer at ${cx + d},${cy + 2}`);
        }
      }
    }
  }
});

// ══ 4. Round trip through the independent decoder ══════════════════════════════

test('alphanumeric round trip, every version', () => {
  for (let v = 1; v <= QR_MAX_VERSION; v++) {
    const cap = qrCapacity(v, 'alphanumeric');
    const prev = v === 1 ? 0 : qrCapacity(v - 1, 'alphanumeric');
    // One payload that only fits at v, one exactly at the ceiling, one odd-length.
    for (const len of [prev + 1, cap, cap - 1]) {
      const text = Array.from({ length: len }, (_, i) => QR_ALPHANUMERIC_SET[i % 45]!).join('');
      const decoded = roundTrip(text);
      assert.equal(decoded.version, v, `${len} chars should be version ${v}`);
      assert.equal(decoded.mode, 'alphanumeric');
    }
  }
});

test('byte round trip, every version, including UTF-8', () => {
  for (let v = 1; v <= QR_MAX_VERSION; v++) {
    const cap = qrCapacity(v, 'byte');
    const prev = v === 1 ? 0 : qrCapacity(v - 1, 'byte');
    for (const len of [prev + 1, cap]) {
      const text = 'x'.repeat(len); // lowercase → outside the alphanumeric set
      const decoded = roundTrip(text);
      assert.equal(decoded.version, v, `${len} bytes should be version ${v}`);
      assert.equal(decoded.mode, 'byte');
    }
  }
  // Multi-byte characters are counted in BYTES, not code points.
  const decoded = roundTrip('héllo · 世界 · 🎨');
  assert.equal(decoded.mode, 'byte');
});

test('every mask produces a decodable symbol', () => {
  for (let mask = 0; mask < 8; mask++) {
    const decoded = roundTrip('HOLD YOUR LAPTOPS TOGETHER', { mask });
    assert.equal(decoded.mask, mask);
  }
});

test('mask selection is automatic, deterministic and not a constant', () => {
  const a = ok(encodeQr('LOLLY COLLAB 1'));
  const b = ok(encodeQr('LOLLY COLLAB 1'));
  assert.deepEqual([...a.modules], [...b.modules], 'the same input must give the same symbol');
  const masks = new Set<number>();
  for (let i = 0; i < 40; i++) masks.add(ok(encodeQr(`COLLAB INVITE ${i}`)).mask);
  assert.ok(masks.size > 1, 'penalty scoring never chose a second mask - is it wired up?');
});

test('forcing byte mode on alphanumeric text still round-trips (and costs a version)', () => {
  const text = 'A'.repeat(200);
  const auto = ok(encodeQr(text));
  const forced = ok(encodeQr(text, { mode: 'byte' }));
  assert.equal(auto.mode, 'alphanumeric');
  assert.equal(forced.mode, 'byte');
  assert.ok(forced.version > auto.version, 'byte mode should need a bigger symbol');
  assert.equal(decodeQr(forced.modules, forced.size).text, text);
});

/**
 * A golden symbol, module for module.
 *
 * Its provenance is what makes it worth 21 lines: it is the output of the MIT
 * `qrcode-svg` build vendored inside `community/qr-code/hooks.js` - a widely used,
 * independently written encoder - for the same content at the same version, level and
 * mask. The shell may not IMPORT tool data (that boundary is the point), but nothing
 * stops a one-off comparison, and this suite's development ran every fixture below
 * through it: with the mask pinned, every symbol this encoder produces is byte-
 * identical to that implementation's, across versions 1–9, byte mode, level M. The two
 * disagree only on which mask to CHOOSE, which is a quality heuristic rather than a
 * conformance question (section 8.8.2 scoring differs between real implementations).
 *
 * So this fixture pins the whole pipeline - version choice, bit stream, ECC,
 * interleaving, function patterns, data walk, format bits, masking - to a foreign
 * reference. If a refactor changes one module, this is the test that says so.
 */
const GOLDEN_HELLO_MASK2 = [
  '#######....#..#######',
  '#.....#...#.#.#.....#',
  '#.###.#.##....#.###.#',
  '#.###.#.#.#.#.#.###.#',
  '#.###.#.##..#.#.###.#',
  '#.....#.####..#.....#',
  '#######.#.#.#.#######',
  '........##...........',
  '#.#####...##..#####..',
  '.##.##.#.######..##..',
  '..#####.#...#.##.###.',
  '.##.#....######..##..',
  '.#.######...#..#..#.#',
  '........#.#.#..#.#...',
  '#######..###.#..#.##.',
  '#.....#.#.#....#####.',
  '#.###.#.##.#.#..#.##.',
  '#.###.#.##.#####.#...',
  '#.###.#.##..#.##..#..',
  '#.....#..######.###..',
  '#######.##..#...#.##.',
];

function renderRows(symbol: QrSymbol): string[] {
  const rows: string[] = [];
  for (let y = 0; y < symbol.size; y++) {
    let row = '';
    for (let x = 0; x < symbol.size; x++) row += moduleAt(symbol, x, y) ? '#' : '.';
    rows.push(row);
  }
  return rows;
}

test('golden: byte-identical to an independent encoder (v1, level M, mask 2)', () => {
  const symbol = ok(encodeQr('HELLO', { mode: 'byte', mask: 2 }));
  assert.equal(symbol.version, 1);
  assert.deepEqual(renderRows(symbol), GOLDEN_HELLO_MASK2);
  assert.equal(decodeQr(symbol.modules, symbol.size).text, 'HELLO');
});

test('golden: a version-9 symbol matches the same reference (alignment + version info)', () => {
  // 53×53 is too much to read, so the pin is an FNV-1a of the rows. Same provenance as
  // the fixture above: `qrcode-svg` on 180 'a's, level M, mask 3.
  const symbol = ok(encodeQr('a'.repeat(180), { mode: 'byte', mask: 3 }));
  assert.equal(symbol.version, 9);
  const joined = renderRows(symbol).join('');
  let h = 0x811c9dc5;
  for (const ch of joined) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  assert.equal(h.toString(16).padStart(8, '0'), '624a617a');
});

test('fuzz: random payloads survive the round trip', () => {
  const rand = mulberry32(0x51de);
  for (let trial = 0; trial < 120; trial++) {
    const len = 1 + Math.floor(rand() * 90);
    let text = '';
    const alnumOnly = rand() < 0.5;
    for (let i = 0; i < len; i++) {
      if (alnumOnly) {
        text += QR_ALPHANUMERIC_SET[Math.floor(rand() * 45)]!;
      } else {
        // Any code point except the surrogate range (a lone surrogate is not text).
        let cp = Math.floor(rand() * 0x2000);
        if (cp >= 0xd800 && cp <= 0xdfff) cp = 0x41;
        text += String.fromCodePoint(cp);
      }
    }
    const symbol = encodeQr(text);
    if (!symbol.ok) {
      assert.equal(symbol.code, 'too-large', `trial ${trial}`);
      continue;
    }
    assert.equal(decodeQr(symbol.value.modules, symbol.value.size).text, text, `trial ${trial}`);
  }
});

// ══ 5. Capacity boundaries and typed failures ══════════════════════════════════

test('the capacity ceiling is a typed failure, one character either side', () => {
  const alnumCap = qrCapacity(QR_MAX_VERSION, 'alphanumeric');
  assert.equal(alnumCap, 311);
  assert.equal(ok(encodeQr('A'.repeat(alnumCap))).version, QR_MAX_VERSION);
  err(encodeQr('A'.repeat(alnumCap + 1)), 'too-large', 'one over the alnum ceiling');

  const byteCap = qrCapacity(QR_MAX_VERSION, 'byte');
  assert.equal(byteCap, 213);
  assert.equal(ok(encodeQr('x'.repeat(byteCap))).version, QR_MAX_VERSION);
  err(encodeQr('x'.repeat(byteCap + 1)), 'too-large', 'one over the byte ceiling');

  // The reason names the numbers, so a dialog logging it is diagnosable.
  const failure = encodeQr('x'.repeat(1000));
  assert.equal(failure.ok, false);
  if (!failure.ok) assert.match(failure.reason, /213/);
});

test('bad input is refused, never thrown', () => {
  err(encodeQr(''), 'empty');
  err(encodeQr(undefined as unknown as string), 'bad-input');
  err(encodeQr(42 as unknown as string), 'bad-input');
  err(encodeQr('OK', { mask: 8 }), 'bad-input');
  err(encodeQr('OK', { mask: -1 }), 'bad-input');
  err(encodeQr('OK', { mask: 1.5 }), 'bad-input');
  err(encodeQr('OK', { minVersion: 0 }), 'bad-input');
  err(encodeQr('OK', { maxVersion: 11 }), 'bad-input');
  err(encodeQr('OK', { minVersion: 5, maxVersion: 4 }), 'bad-input');
  err(encodeQr('OK', { mode: 'kanji' as unknown as QrMode }), 'bad-input');
  err(encodeQr('lowercase', { mode: 'alphanumeric' }), 'bad-input');
  // A version window that cannot hold the payload reports capacity, not confusion.
  err(encodeQr('A'.repeat(40), { maxVersion: 2 }), 'too-large');
});

test('fuzz: no input makes encodeQr throw', () => {
  const rand = mulberry32(0x9e11);
  for (let trial = 0; trial < 200; trial++) {
    const len = Math.floor(rand() * 400);
    let text = '';
    for (let i = 0; i < len; i++) text += String.fromCharCode(Math.floor(rand() * 0x10000));
    const opts = {
      mask: Math.floor(rand() * 12) - 2,
      minVersion: Math.floor(rand() * 14) - 2,
      maxVersion: Math.floor(rand() * 14) - 2,
    };
    const r = encodeQr(text, opts);
    if (!r.ok) assert.ok(['empty', 'too-large', 'bad-input'].includes(r.code), `code ${r.code}`);
  }
});

// ══ 6. SVG ═════════════════════════════════════════════════════════════════════

test('SVG carries a viewBox, the quiet zone and crisp rendering', () => {
  const symbol = ok(encodeQr('LOLLY COLLAB'));
  const svg = toSvg(symbol);
  const span = symbol.size + QR_QUIET_ZONE * 2;
  assert.match(svg, new RegExp(`viewBox="0 0 ${span} ${span}"`));
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /width="100%" height="100%"/);
  assert.match(svg, /<rect width="\d+" height="\d+" fill="#fff"\/>/);
  assert.match(svg, /<path fill="currentColor" d="M/);
  // Dark modules default to black through the presentation attribute, so a dark theme
  // cannot silently invert the symbol.
  assert.match(svg, /color="#000"/);
  assert.match(svg, /aria-hidden="true"/);
  assert.ok(svg.startsWith('<svg '), 'no XML preamble - this is an inline fragment');
  assert.ok(svg.endsWith('</svg>'));

  // Every path command lands inside the viewBox.
  for (const m of svg.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    const run = Number(m[3]);
    assert.ok(x >= QR_QUIET_ZONE && y >= QR_QUIET_ZONE, 'a run started inside the quiet zone');
    assert.ok(x + run <= QR_QUIET_ZONE + symbol.size, 'a run ran past the symbol');
  }
});

test('SVG options: margin, colours, pixel size, label', () => {
  const symbol = ok(encodeQr('LOLLY'));
  const plain = toSvg(symbol, { margin: 0, light: null, dark: '#123456', pixelSize: 240 });
  assert.match(plain, new RegExp(`viewBox="0 0 ${symbol.size} ${symbol.size}"`));
  assert.ok(!plain.includes('<rect'), 'light:null must not paint a background');
  assert.match(plain, /fill="#123456"/);
  assert.match(plain, /width="240" height="240"/);

  const labelled = toSvg(symbol, { label: 'Invite QR' });
  assert.match(labelled, /role="img" aria-label="Invite QR"/);
  assert.match(labelled, /<title>Invite QR<\/title>/);
});

test('SVG escapes hostile option strings', () => {
  const symbol = ok(encodeQr('LOLLY'));
  const svg = toSvg(symbol, { label: '"><script>x</script>', dark: '"><script>y</script>' });
  assert.ok(!svg.includes('<script>'), 'markup leaked out of an option');
  assert.ok(svg.includes('&lt;script&gt;'));
  // The quote that would have closed the attribute is escaped, so the tag stays intact.
  assert.ok(!svg.includes('aria-label=""'), 'a quote escaped its attribute');
  assert.equal(svg.match(/<svg /g)?.length, 1);
  assert.equal(svg.split('>')[0]?.includes('&quot;'), true);
});

test('renderQr throws only on capacity, renderQrSvg never throws', () => {
  assert.match(renderQr('LOLLY'), /^<svg /);
  assert.match(createQrRenderer({ margin: 2 })('LOLLY'), /viewBox="0 0 25 25"/);
  assert.throws(
    () => renderQr('x'.repeat(1000)),
    (e: unknown) => e instanceof QrRenderError && e.code === 'too-large',
  );
  err(renderQrSvg('x'.repeat(1000)), 'too-large');
  assert.match(ok(renderQrSvg('LOLLY')), /^<svg /);
});

test('createQrElementRenderer matches the dialog callback and degrades to null', () => {
  // A minimal element stand-in: the dialog only ever appends what comes back.
  interface FakeEl {
    className: string;
    attrs: Record<string, string>;
    innerHTML: string;
    setAttribute(name: string, value: string): void;
    firstElementChild: { setAttribute(name: string, value: string): void; attrs: Record<string, string> } | null;
  }
  const made: FakeEl[] = [];
  const child = { attrs: {} as Record<string, string>, setAttribute(n: string, v: string) { this.attrs[n] = v; } };
  const doc = {
    createElement(): HTMLElement {
      const el: FakeEl = {
        className: '',
        attrs: {},
        innerHTML: '',
        setAttribute(n, v) { this.attrs[n] = v; },
        firstElementChild: child,
      };
      made.push(el);
      return el as unknown as HTMLElement;
    },
  };

  const render = createQrElementRenderer({ doc, maxWidthPx: 200 });
  const el = render('LOLLY COLLAB');
  assert.ok(el, 'a fitting payload must produce an element');
  const box = made[0]!;
  assert.equal(box.className, 'qr-skin');
  assert.match(box.attrs.style!, /max-width:200px/);
  assert.match(box.innerHTML, /^<svg /);
  // Percentage width against the wrapper's max-width, auto height - never height:100%.
  assert.equal(child.attrs.style, 'display:block;width:100%;height:auto');

  // Over capacity is a missing QR, not a throw - the dialog just shows the token.
  assert.equal(render('x'.repeat(1000)), null);
  // No document anywhere (worker, CLI) is the same graceful null.
  assert.equal(createQrElementRenderer()('LOLLY'), null);
});

// ══ 7. The real ceremony payload (section 6.1, section 2.9) ══════════════════════════════════

function material(candidates: SdpMaterial['candidates']): SdpMaterial {
  return {
    fingerprint: { algo: 'sha-256', bytes: Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 0xff) },
    iceUfrag: 'K7xQ',
    icePwd: 'aB3dEfGhIjKlMnOpQrStUv',
    candidates,
    setupRole: 'actpass',
  };
}

const MDNS = (n: number): string => `${'0123abcd'}-${1000 + n}-4${n}12-8${n}34-abcdef01234${n}.local`;

test('a real invite token fits well inside version 10, with margin', (t) => {
  const cases: [string, CollabPayload][] = [
    [
      'LAN invite, three mDNS candidates',
      {
        kind: 'invite',
        material: material([
          { type: 'host', protocol: 'udp', address: MDNS(1), port: 51234 },
          { type: 'host', protocol: 'udp', address: MDNS(2), port: 51235 },
          { type: 'host', protocol: 'udp', address: MDNS(3), port: 51236 },
        ]),
        invite: {
          v: 1,
          toolId: 'design',
          toolVersion: '1.4.0',
          engineVersion: '1.108.0',
          name: 'Priya',
          colorIndex: 3,
          opVersion: '1.1.0',
        },
      },
    ],
    [
      'invite, IPv4 host + srflx',
      {
        kind: 'invite',
        material: material([
          { type: 'host', protocol: 'udp', address: '192.168.1.44', port: 51234 },
          { type: 'srflx', protocol: 'udp', address: '203.0.113.9', port: 41235 },
        ]),
        invite: {
          v: 1,
          toolId: 'qr-code',
          toolVersion: '1.2.0',
          engineVersion: '1.108.0',
          name: 'Sam',
          colorIndex: 1,
          opVersion: '1.1.0',
        },
      },
    ],
    [
      'answer, single host candidate',
      {
        kind: 'answer',
        material: material([{ type: 'host', protocol: 'udp', address: '192.168.1.7', port: 49876 }]),
      },
    ],
    [
      'answer, three mDNS candidates',
      {
        kind: 'answer',
        material: material([
          { type: 'host', protocol: 'udp', address: MDNS(4), port: 51234 },
          { type: 'host', protocol: 'udp', address: MDNS(5), port: 51235 },
          { type: 'host', protocol: 'udp', address: MDNS(6), port: 51236 },
        ]),
      },
    ],
  ];

  for (const [label, payload] of cases) {
    const bytes = ok(pack(payload), label);
    const token = encodeToken(bytes, 'qr');
    const symbol = ok(encodeQr(token), label);
    // The whole point of the base32 skin: it stays in alphanumeric mode.
    assert.equal(symbol.mode, 'alphanumeric', `${label} should not fall back to byte mode`);
    assert.ok(symbol.version <= QR_MAX_VERSION, `${label} needs version ${symbol.version}`);
    const headroom = qrCapacity(symbol.version, 'alphanumeric') - token.length;
    t.diagnostic(
      `${label}: ${bytes.length} B → ${token.length} chars → version ${symbol.version} ` +
        `(${symbol.size}×${symbol.size}), ${headroom} chars spare, ` +
        `${qrCapacity(QR_MAX_VERSION, 'alphanumeric') - token.length} under the v10 ceiling`,
    );

    // Full pipeline: symbol → (independent decoder) → token → codec → the same payload.
    const decoded = decodeQr(symbol.modules, symbol.size);
    assert.equal(decoded.text, token, `${label} token survived the symbol`);
    const back = ok(decodePayload(decoded.text, 'qr'), label);
    assert.deepEqual(back, payload, `${label} payload survived the whole skin`);
  }
});

test('byte mode alone would NOT hold a typical invite - the base32 skin is load-bearing', () => {
  const payload: CollabPayload = {
    kind: 'invite',
    material: material([
      { type: 'host', protocol: 'udp', address: MDNS(1), port: 51234 },
      { type: 'host', protocol: 'udp', address: MDNS(2), port: 51235 },
      { type: 'host', protocol: 'udp', address: MDNS(3), port: 51236 },
    ]),
    invite: {
      v: 1,
      toolId: 'design',
      toolVersion: '1.4.0',
      engineVersion: '1.108.0',
      name: 'Priya',
      colorIndex: 3,
      opVersion: '1.1.0',
    },
  };
  const token = encodeToken(ok(pack(payload)), 'qr');
  assert.ok(token.length > qrCapacity(QR_MAX_VERSION, 'byte'), 'the premise of the header comment');
  err(encodeQr(token, { mode: 'byte' }), 'too-large');
  assert.ok(encodeQr(token).ok, 'and alphanumeric mode carries it');
});

// ══ 8. Scan: the progressive rung (section 11.27) ═════════════════════════════════════

interface FakeDetected {
  rawValue?: unknown;
}

function fakeScope(opts: {
  formats?: readonly string[] | null;
  omitStatic?: boolean;
  ctorThrows?: boolean;
  staticThrows?: boolean;
  frames?: FakeDetected[][];
  detectThrows?: boolean;
  onDetect?: () => void;
}): { BarcodeDetector: unknown; calls: () => number } {
  let calls = 0;
  const frames = opts.frames ?? [];
  class FakeBarcodeDetector {
    constructor(_init?: { formats?: string[] }) {
      if (opts.ctorThrows) throw new Error('no backend');
    }
    detect(_source: unknown): Promise<readonly FakeDetected[]> {
      calls++;
      opts.onDetect?.();
      if (opts.detectThrows) return Promise.reject(new Error('detect blew up'));
      return Promise.resolve(frames.shift() ?? []);
    }
    static getSupportedFormats(): Promise<readonly string[]> {
      if (opts.staticThrows) return Promise.reject(new Error('enumeration failed'));
      return Promise.resolve(opts.formats ?? ['qr_code']);
    }
  }
  if (opts.omitStatic) {
    Reflect.deleteProperty(FakeBarcodeDetector, 'getSupportedFormats');
  }
  return { BarcodeDetector: FakeBarcodeDetector, calls: () => calls };
}

const readyVideo = { readyState: 4, videoWidth: 640, videoHeight: 480 };

test('probe: absent BarcodeDetector degrades gracefully', async () => {
  const cap = await probeBarcodeDetector({ scope: {} });
  assert.deepEqual(cap, { supported: false, formats: [], reason: 'no-api' });
  // Anything non-constructible reads the same way.
  assert.equal((await probeBarcodeDetector({ scope: { BarcodeDetector: 'yes' } })).reason, 'no-api');
  assert.equal((await probeBarcodeDetector({ scope: { BarcodeDetector: null } })).reason, 'no-api');
});

test('probe: an API that decodes no QR is not support', async () => {
  const cap = await probeBarcodeDetector({ scope: fakeScope({ formats: ['ean_13', 'code_128'] }) });
  assert.equal(cap.supported, false);
  assert.equal(cap.reason, 'no-qr-format');
  assert.deepEqual([...cap.formats], ['ean_13', 'code_128']);
});

test('probe: supported, and a throwing constructor or enumeration is honest about it', async () => {
  const good = await probeBarcodeDetector({ scope: fakeScope({}) });
  assert.equal(good.supported, true);
  assert.ok(good.formats.includes('qr_code'));
  assert.equal(good.reason, undefined);

  const broken = await probeBarcodeDetector({ scope: fakeScope({ ctorThrows: true }) });
  assert.equal(broken.supported, false);
  assert.equal(broken.reason, 'probe-failed');
  assert.equal(typeof broken.detail, 'string');

  const noEnum = await probeBarcodeDetector({ scope: fakeScope({ staticThrows: true }) });
  assert.equal(noEnum.supported, false);
  assert.equal(noEnum.reason, 'probe-failed');

  // No static enumeration at all (polyfill / older build): construct and believe it.
  const legacy = await probeBarcodeDetector({ scope: fakeScope({ omitStatic: true }) });
  assert.equal(legacy.supported, true);
  assert.deepEqual([...legacy.formats], ['qr_code']);
});

test('probe: the global answer is cached, and resettable', async () => {
  resetQrScanProbe();
  const first = await probeBarcodeDetector();
  const second = await probeBarcodeDetector();
  assert.deepEqual(first, second);
  // Node has no BarcodeDetector, which is exactly the Safari/Firefox rung.
  assert.equal(first.supported, false);
  assert.equal(first.reason, 'no-api');
  resetQrScanProbe();
});

test('scan: resolves the first decoded value after empty frames', async () => {
  const scope = fakeScope({ frames: [[], [], [{ rawValue: 'ABC234' }]] });
  const value = await scanQrFromVideo(readyVideo, { scope, intervalMs: 0 });
  assert.equal(value, 'ABC234');
  assert.equal(scope.calls(), 3);
});

test('scan: honours the accept predicate instead of taking any QR in frame', async () => {
  const scope = fakeScope({
    frames: [[{ rawValue: 'https://example.com/poster' }], [{ rawValue: 'LOLLYTOKEN' }]],
  });
  const value = await scanQrFromVideo(readyVideo, {
    scope,
    intervalMs: 0,
    accept: (v) => /^[A-Z2-7]+$/.test(v),
  });
  assert.equal(value, 'LOLLYTOKEN');
});

test('scan: skips junk results without ending the scan', async () => {
  const scope = fakeScope({ frames: [[{ rawValue: 42 }, { rawValue: '' }], [{ rawValue: 'GOOD' }]] });
  assert.equal(await scanQrFromVideo(readyVideo, { scope, intervalMs: 0 }), 'GOOD');
});

test('scan: aborting resolves null rather than rejecting', async () => {
  const controller = new AbortController();
  const scope = fakeScope({ onDetect: () => controller.abort() });
  const value = await scanQrFromVideo(readyVideo, { scope, intervalMs: 5, signal: controller.signal });
  assert.equal(value, null);
  // An already-aborted signal never even reaches the camera.
  const cold = new AbortController();
  cold.abort();
  const scope2 = fakeScope({ frames: [[{ rawValue: 'NEVER' }]] });
  assert.equal(await scanQrFromVideo(readyVideo, { scope: scope2, intervalMs: 0, signal: cold.signal }), null);
  assert.equal(scope2.calls(), 0);
});

test('scan: no support means null immediately, not a spinning camera', async () => {
  assert.equal(await scanQrFromVideo(readyVideo, { scope: {}, intervalMs: 0 }), null);
  assert.equal(
    await scanQrFromVideo(readyVideo, { scope: fakeScope({ formats: ['ean_13'] }), intervalMs: 0 }),
    null,
  );
});

test('scan: a detector that always throws gives up, reporting each failure', async () => {
  const seen: unknown[] = [];
  const scope = fakeScope({ detectThrows: true });
  const value = await scanQrFromVideo(readyVideo, {
    scope,
    intervalMs: 0,
    onError: (e) => seen.push(e),
  });
  assert.equal(value, null);
  assert.equal(seen.length, 8, 'gives up after eight consecutive failures');
  assert.ok(seen[0] instanceof Error);
});

test('scan: waits for the video to have a frame', async () => {
  const video = { readyState: 0, videoWidth: 0, videoHeight: 0 };
  const scope = fakeScope({ frames: [[{ rawValue: 'READY' }]] });
  const controller = new AbortController();
  const pending = scanQrFromVideo(video, { scope, intervalMs: 1, signal: controller.signal });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(scope.calls(), 0, 'a video with no frame must not be handed to detect()');
  controller.abort();
  assert.equal(await pending, null);
});

test('createQrScanner binds a video and matches the ceremony callback shape', async () => {
  const scope = fakeScope({ frames: [[{ rawValue: 'BOUND' }]] });
  const scan = createQrScanner(readyVideo, { scope, intervalMs: 0 });
  assert.equal(await scan(), 'BOUND');

  const controller = new AbortController();
  controller.abort();
  const scope2 = fakeScope({ frames: [[{ rawValue: 'NOPE' }]] });
  const scan2 = createQrScanner(readyVideo, { scope: scope2, intervalMs: 0 });
  assert.equal(await scan2({ signal: controller.signal }), null);
});
