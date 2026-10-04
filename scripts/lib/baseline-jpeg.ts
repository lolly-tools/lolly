// SPDX-License-Identifier: MPL-2.0
/**
 * A small baseline JPEG encoder for the generated fixture photographs
 * (scripts/build-rebrand-fixtures.ts). The fixture builder promises that no
 * fixture byte comes from a versioned dependency, and a photograph big enough to
 * fill a 1920 px slide is too large as a stored PNG, so this writes JPEG itself.
 *
 * It is the plain JFIF baseline: 8-bit YCbCr, 4:2:0 chroma, the Annex K
 * quantisation tables scaled by the IJG quality rule, the Annex K Huffman tables,
 * and the AAN forward DCT. Every step is IEEE double arithmetic with literal
 * constants (no Math.cos, no platform library), so the same pixels give the same
 * bytes on every machine. It is not tuned for size or speed; fixtures only.
 */

/** Annex K luminance quantisation table, in natural (row-major) order. */
const LUMA_QT = [
  16, 11, 10, 16, 24, 40, 51, 61,
  12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77,
  24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];
/** Annex K chrominance quantisation table, in natural order. */
const CHROMA_QT = [
  17, 18, 24, 47, 99, 99, 99, 99,
  18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99,
  ...new Array<number>(32).fill(99),
];

/** Code counts per length 1..16 and symbols, Annex K.3. */
const DC_LUMA_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_CHROMA_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUMA_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const AC_LUMA_VALUES = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
  0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
  0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
  0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
  0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
  0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
];
const AC_CHROMA_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHROMA_VALUES = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
  0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
  0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
  0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
  0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
  0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
  0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
  0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
  0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
  0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
];

/** The AAN scale factors, cos(k*pi/16)*sqrt(2) for k > 0, as literals. */
const AAN = [1.0, 1.387039845, 1.306562965, 1.175875602, 1.0, 0.785694958, 0.5411961, 0.275899379];

/** ZIGZAG[natural index] = position in the zigzag scan. */
const ZIGZAG: number[] = (() => {
  const out = new Array<number>(64);
  let pos = 0;
  for (let s = 0; s < 15; s++) {
    const lo = Math.max(0, s - 7);
    const hi = Math.min(7, s);
    for (let k = 0; k <= hi - lo; k++) {
      const row = s % 2 === 0 ? hi - k : lo + k;
      out[row * 8 + (s - row)] = pos++;
    }
  }
  return out;
})();

interface HuffCode { code: number; len: number }

function huffTable(bits: readonly number[], values: readonly number[]): HuffCode[] {
  if (bits.reduce((a, b) => a + b, 0) !== values.length) throw new Error('baseline-jpeg: a Huffman table miscounts its symbols');
  const table: HuffCode[] = [];
  let code = 0;
  let k = 0;
  for (let len = 1; len <= 16; len++) {
    for (let j = 0; j < bits[len - 1]!; j++) table[values[k++]!] = { code: code++, len };
    code <<= 1;
  }
  return table;
}

/** The AC symbol set is fixed: EOB, ZRL and every run 0..15 with size 1..10. A typo in a table fails here, never in a decoder. */
function assertAcSymbols(values: readonly number[]): void {
  const want = new Set<number>([0x00, 0xf0]);
  for (let run = 0; run < 16; run++) for (let size = 1; size <= 10; size++) want.add((run << 4) | size);
  const got = new Set(values);
  if (got.size !== values.length || got.size !== want.size || [...want].some((v) => !got.has(v))) throw new Error('baseline-jpeg: an AC table does not hold the 162 baseline symbols');
}
assertAcSymbols(AC_LUMA_VALUES);
assertAcSymbols(AC_CHROMA_VALUES);

const HT = {
  dcLuma: huffTable(DC_LUMA_BITS, DC_VALUES),
  acLuma: huffTable(AC_LUMA_BITS, AC_LUMA_VALUES),
  dcChroma: huffTable(DC_CHROMA_BITS, DC_VALUES),
  acChroma: huffTable(AC_CHROMA_BITS, AC_CHROMA_VALUES),
};

/** The IJG rule: a quality of 1..100 scales a base table, each entry kept in 1..255. */
function scaledTable(base: readonly number[], quality: number): number[] {
  const scale = quality < 50 ? Math.floor(5000 / quality) : 200 - quality * 2;
  return base.map((v) => Math.min(255, Math.max(1, Math.floor((v * scale + 50) / 100))));
}

/** The divisors folded with the AAN scale, per natural index. */
function divisors(table: readonly number[]): Float64Array {
  const out = new Float64Array(64);
  for (let i = 0; i < 64; i++) out[i] = 1 / (table[i]! * AAN[i >> 3]! * AAN[i & 7]! * 8);
  return out;
}

class BitWriter {
  private bytes = new Uint8Array(1 << 16);
  private length = 0;
  private acc = 0;
  private count = 0;

  byte(b: number): void {
    if (this.length === this.bytes.length) {
      const grown = new Uint8Array(this.bytes.length * 2);
      grown.set(this.bytes);
      this.bytes = grown;
    }
    this.bytes[this.length++] = b;
  }

  word(w: number): void { this.byte((w >> 8) & 0xff); this.byte(w & 0xff); }

  bits(value: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) {
      this.acc = (this.acc << 1) | ((value >> i) & 1);
      if (++this.count === 8) {
        this.byte(this.acc);
        if (this.acc === 0xff) this.byte(0);
        this.acc = 0;
        this.count = 0;
      }
    }
  }

  /** Pads the last byte with ones, as the standard asks. */
  flush(): void { if (this.count > 0) this.bits((1 << (8 - this.count)) - 1, 8 - this.count); }

  result(): Uint8Array { return this.bytes.slice(0, this.length); }
}

/** The AAN forward DCT in place, then quantisation into zigzag order. */
function dctQuantise(block: Float64Array, div: Float64Array, out: Int32Array): void {
  for (let pass = 0; pass < 2; pass++) {
    const stride = pass === 0 ? 1 : 8;
    const step = pass === 0 ? 8 : 1;
    for (let line = 0; line < 8; line++) {
      const o = line * step;
      const d0 = block[o]!; const d1 = block[o + stride]!; const d2 = block[o + 2 * stride]!; const d3 = block[o + 3 * stride]!;
      const d4 = block[o + 4 * stride]!; const d5 = block[o + 5 * stride]!; const d6 = block[o + 6 * stride]!; const d7 = block[o + 7 * stride]!;
      const t0 = d0 + d7; const t7 = d0 - d7; const t1 = d1 + d6; const t6 = d1 - d6;
      const t2 = d2 + d5; const t5 = d2 - d5; const t3 = d3 + d4; const t4 = d3 - d4;
      const e10 = t0 + t3; const e13 = t0 - t3; const e11 = t1 + t2; const e12 = t1 - t2;
      block[o] = e10 + e11;
      block[o + 4 * stride] = e10 - e11;
      const z1 = (e12 + e13) * Math.SQRT1_2;
      block[o + 2 * stride] = e13 + z1;
      block[o + 6 * stride] = e13 - z1;
      const o10 = t4 + t5; const o11 = t5 + t6; const o12 = t6 + t7;
      const z5 = (o10 - o12) * 0.382683433;
      const z2 = 0.5411961 * o10 + z5;
      const z4 = 1.306562965 * o12 + z5;
      const z3 = o11 * Math.SQRT1_2;
      const z11 = t7 + z3; const z13 = t7 - z3;
      block[o + 5 * stride] = z13 + z2;
      block[o + 3 * stride] = z13 - z2;
      block[o + stride] = z11 + z4;
      block[o + 7 * stride] = z11 - z4;
    }
  }
  // Baseline Huffman tables code AC sizes up to 10 bits; only quality near 100 on hard edges goes past that size.
  for (let i = 0; i < 64; i++) {
    const q = Math.round(block[i]! * div[i]!);
    out[ZIGZAG[i]!] = i === 0 ? q : Math.max(-1023, Math.min(1023, q));
  }
}

/** Bits needed for a coefficient's magnitude: its JPEG size category. */
function category(v: number): number {
  let a = v < 0 ? -v : v;
  let n = 0;
  while (a > 0) { n++; a >>= 1; }
  return n;
}

function encodeBlock(w: BitWriter, zz: Int32Array, prevDc: number, dc: HuffCode[], ac: HuffCode[]): number {
  const diff = zz[0]! - prevDc;
  const dcCat = category(diff);
  w.bits(dc[dcCat]!.code, dc[dcCat]!.len);
  if (dcCat) w.bits(diff < 0 ? diff + (1 << dcCat) - 1 : diff, dcCat);
  let last = 63;
  while (last > 0 && zz[last] === 0) last--;
  let run = 0;
  for (let i = 1; i <= last; i++) {
    const v = zz[i]!;
    if (v === 0) { run++; continue; }
    while (run >= 16) { w.bits(ac[0xf0]!.code, ac[0xf0]!.len); run -= 16; }
    const cat = category(v);
    const sym = ac[(run << 4) | cat]!;
    w.bits(sym.code, sym.len);
    w.bits(v < 0 ? v + (1 << cat) - 1 : v, cat);
    run = 0;
  }
  if (last < 63) w.bits(ac[0]!.code, ac[0]!.len);
  return zz[0]!;
}

function writeHuffmanSegment(w: BitWriter): void {
  const tables: Array<[number, readonly number[], readonly number[]]> = [
    [0x00, DC_LUMA_BITS, DC_VALUES], [0x10, AC_LUMA_BITS, AC_LUMA_VALUES],
    [0x01, DC_CHROMA_BITS, DC_VALUES], [0x11, AC_CHROMA_BITS, AC_CHROMA_VALUES],
  ];
  w.word(0xffc4);
  w.word(2 + tables.reduce((n, [, , values]) => n + 17 + values.length, 0));
  for (const [id, bits, values] of tables) {
    w.byte(id);
    for (const b of bits) w.byte(b);
    for (const v of values) w.byte(v);
  }
}

/**
 * Encode 8-bit RGB pixels (`width * height * 3` bytes, row-major) as a baseline
 * JFIF JPEG at an IJG quality of 1..100. Deterministic: the same input gives the
 * same bytes everywhere.
 */
export function encodeBaselineJpeg(rgb: Uint8Array, width: number, height: number, quality = 80): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 0xffff || height > 0xffff)
    throw new Error(`baseline-jpeg: ${width}x${height} is not a size a baseline JPEG holds`);
  if (rgb.length !== width * height * 3) throw new Error(`baseline-jpeg: ${rgb.length} bytes is not ${width}x${height} RGB`);
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new Error(`baseline-jpeg: quality ${quality} is outside 1..100`);
  const lumaQt = scaledTable(LUMA_QT, quality);
  const chromaQt = scaledTable(CHROMA_QT, quality);
  const lumaDiv = divisors(lumaQt);
  const chromaDiv = divisors(chromaQt);

  const w = new BitWriter();
  w.word(0xffd8);
  // APP0: JFIF 1.1, no density unit, aspect 1:1, no thumbnail.
  w.word(0xffe0); w.word(16);
  for (const b of [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0]) w.byte(b);
  w.word(1); w.word(1); w.byte(0); w.byte(0);
  w.word(0xffdb); w.word(2 + 2 * 65);
  for (const [id, table] of [[0, lumaQt], [1, chromaQt]] as const) {
    w.byte(id);
    const zz = new Array<number>(64);
    for (let i = 0; i < 64; i++) zz[ZIGZAG[i]!] = table[i]!;
    for (const v of zz) w.byte(v);
  }
  // SOF0: 8-bit, three components, Y sampled 2x2 against Cb and Cr.
  w.word(0xffc0); w.word(17); w.byte(8); w.word(height); w.word(width); w.byte(3);
  for (const [id, sampling, table] of [[1, 0x22, 0], [2, 0x11, 1], [3, 0x11, 1]]) { w.byte(id!); w.byte(sampling!); w.byte(table!); }
  writeHuffmanSegment(w);
  w.word(0xffda); w.word(12); w.byte(3);
  for (const [id, tables] of [[1, 0x00], [2, 0x11], [3, 0x11]]) { w.byte(id!); w.byte(tables!); }
  w.byte(0); w.byte(63); w.byte(0);

  const block = new Float64Array(64);
  const zz = new Int32Array(64);
  const cb = new Float64Array(256);
  const cr = new Float64Array(256);
  let dcY = 0; let dcCb = 0; let dcCr = 0;
  for (let my = 0; my < height; my += 16) {
    for (let mx = 0; mx < width; mx += 16) {
      for (let by = 0; by < 2; by++) {
        for (let bx = 0; bx < 2; bx++) {
          for (let y = 0; y < 8; y++) {
            const py = Math.min(height - 1, my + by * 8 + y);
            for (let x = 0; x < 8; x++) {
              const pxl = Math.min(width - 1, mx + bx * 8 + x);
              const i = (py * width + pxl) * 3;
              const r = rgb[i]!; const g = rgb[i + 1]!; const b = rgb[i + 2]!;
              const k = (by * 8 + y) * 16 + bx * 8 + x;
              block[y * 8 + x] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
              cb[k] = -0.168736 * r - 0.331264 * g + 0.5 * b;
              cr[k] = 0.5 * r - 0.418688 * g - 0.081312 * b;
            }
          }
          dctQuantise(block, lumaDiv, zz);
          dcY = encodeBlock(w, zz, dcY, HT.dcLuma, HT.acLuma);
        }
      }
      for (const [plane, which] of [[cb, 0], [cr, 1]] as const) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const k = y * 32 + x * 2;
            block[y * 8 + x] = (plane[k]! + plane[k + 1]! + plane[k + 16]! + plane[k + 17]!) / 4;
          }
        }
        dctQuantise(block, chromaDiv, zz);
        if (which === 0) dcCb = encodeBlock(w, zz, dcCb, HT.dcChroma, HT.acChroma);
        else dcCr = encodeBlock(w, zz, dcCr, HT.dcChroma, HT.acChroma);
      }
    }
  }
  w.flush();
  w.word(0xffd9);
  return w.result();
}
