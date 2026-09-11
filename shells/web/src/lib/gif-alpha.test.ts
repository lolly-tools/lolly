// SPDX-License-Identifier: MPL-2.0
/**
 * WP-H - transparent animated GIF packer (lib/gif-alpha.ts, plans/124 section 11).
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/gif-alpha.test.ts
 *
 * gifenc is pure (no DOM, no codecs), so this runs headless. What is pinned:
 *   - ALPHA CORRECTNESS: a fully-transparent input pixel lands at the reserved
 *     transparent index (0) both in the quantised index buffer AND after a real
 *     pack → LZW-decode round trip; a fully-opaque pixel never lands at index 0.
 *   - CONTAINER FLAGS: the Graphic Control Extension marks index 0 transparent.
 *   - DETERMINISM: same RGBA frames + threshold ⇒ byte-identical GIF.
 *
 * The GIF decoder below is validated BY CONSTRUCTION: the encoder is gifenc
 * (independently trusted, deterministic), and LZW is lossless, so a correct
 * decoder must return exactly quantizeGifAlphaFrame()'s pre-encode index buffer.
 * The test asserts that equality, so a decoder bug fails the test rather than
 * hiding one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { packGifAlpha, quantizeGifAlphaFrame, GIF_TRANSPARENT_INDEX } = await import('./gif-alpha.ts');

/** Build a tiny w×h straight-alpha RGBA frame from a per-pixel painter. */
function frame(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      const o = (y * w + x) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
    }
  }
  return data;
}

// ── A minimal GIF reader: GCE flags + first-frame LZW-decoded index buffer ─────

interface DecodedGif { transparent: boolean; transparentIndex: number; disposal: number; indices: number[]; width: number; height: number; }

function decodeGifFirstFrame(u8: Uint8Array): DecodedGif {
  assert.equal(String.fromCharCode(u8[0]!, u8[1]!, u8[2]!), 'GIF', 'GIF signature');
  let p = 6; // header
  const packed = u8[p + 4]!;
  const gctFlag = (packed & 0x80) !== 0;
  const gctSize = 2 << (packed & 0x07);
  p += 7;
  if (gctFlag) p += gctSize * 3;

  let transparent = false, transparentIndex = 0, disposal = 0;
  const skipSubBlocks = (): void => { while (u8[p] !== 0) p += u8[p]! + 1; p++; };

  for (;;) {
    const b = u8[p++]!;
    if (b === 0x21) { // extension introducer
      const label = u8[p++]!;
      if (label === 0xf9) { // Graphic Control Extension
        const size = u8[p++]!; // 4
        const flags = u8[p]!;
        disposal = (flags >> 2) & 0x07;
        transparent = (flags & 0x01) !== 0;
        transparentIndex = u8[p + 3]!;
        p += size;
        p++; // block terminator
      } else {
        skipSubBlocks();
      }
    } else if (b === 0x2c) { // image descriptor
      const iw = u8[p + 4]! | (u8[p + 5]! << 8);
      const ih = u8[p + 6]! | (u8[p + 7]! << 8);
      const ipacked = u8[p + 8]!;
      p += 9;
      const lctFlag = (ipacked & 0x80) !== 0;
      const lctSize = 2 << (ipacked & 0x07);
      if (lctFlag) p += lctSize * 3;
      const minCodeSize = u8[p++]!;
      const data: number[] = [];
      while (u8[p] !== 0) {
        const len = u8[p++]!;
        for (let i = 0; i < len; i++) data.push(u8[p++]!);
      }
      p++; // terminator
      const indices = lzwDecode(Uint8Array.from(data), minCodeSize, iw * ih);
      return { transparent, transparentIndex, disposal, indices, width: iw, height: ih };
    } else if (b === 0x3b) { // trailer
      break;
    } else {
      throw new Error(`unexpected block 0x${b.toString(16)} at ${p - 1}`);
    }
  }
  throw new Error('no image frame found');
}

/** GIF variable-width LZW decode (no early-change; width grows when next == 1<<size). */
function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  let next = 0;
  const reset = (): void => {
    dict = [];
    for (let i = 0; i < clearCode; i++) dict[i] = [i];
    dict[clearCode] = [];
    dict[eoiCode] = [];
    next = eoiCode + 1;
    codeSize = minCodeSize + 1;
  };
  reset();

  const out: number[] = [];
  let bitBuf = 0, bitCount = 0, pos = 0;
  let prev: number[] | null = null;
  const readCode = (): number => {
    while (bitCount < codeSize) {
      if (pos >= data.length) return eoiCode;
      bitBuf |= data[pos++]! << bitCount;
      bitCount += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>>= codeSize;
    bitCount -= codeSize;
    return code;
  };

  while (out.length < pixelCount) {
    const code = readCode();
    if (code === clearCode) { reset(); prev = null; continue; }
    if (code === eoiCode) break;
    let entry: number[];
    if (code < next && dict[code] !== undefined) entry = dict[code]!;
    else if (prev) entry = [...prev, prev[0]!]; // KwKwK
    else break;
    for (const px of entry) out.push(px);
    if (prev) {
      dict[next++] = [...prev, entry[0]!];
      if (next === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  return out;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('quantizeGifAlphaFrame: transparent pixel → index 0, opaque pixel → non-zero', () => {
  // 2×1: pixel 0 fully transparent (over a red RGB the matte left untouched),
  //      pixel 1 fully opaque blue.
  const rgba = frame(2, 1, (x) => (x === 0 ? [255, 0, 0, 0] : [0, 0, 255, 255]));
  const { palette, index } = quantizeGifAlphaFrame(rgba);
  assert.equal(index[0], GIF_TRANSPARENT_INDEX, 'transparent pixel maps to the reserved index');
  assert.notEqual(index[1], GIF_TRANSPARENT_INDEX, 'opaque pixel must not map to the transparent index');
  assert.deepEqual(palette[GIF_TRANSPARENT_INDEX], [0, 0, 0], 'index 0 is the reserved transparent placeholder');
});

test('quantizeGifAlphaFrame: threshold is the < boundary (127 transparent, 128 opaque at default)', () => {
  const rgba = frame(2, 1, (x) => (x === 0 ? [10, 20, 30, 127] : [10, 20, 30, 128]));
  const { index } = quantizeGifAlphaFrame(rgba);
  assert.equal(index[0], GIF_TRANSPARENT_INDEX, 'alpha 127 (< 128) is transparent');
  assert.notEqual(index[1], GIF_TRANSPARENT_INDEX, 'alpha 128 (>= 128) is opaque');
});

test('packGifAlpha: GCE marks index 0 transparent, and the round trip keeps the transparent pixel at 0', () => {
  const w = 4, h = 4;
  // A transparent border around an opaque green centre - a realistic cutout shape.
  const rgba = frame(w, h, (x, y) => {
    const opaque = x > 0 && x < w - 1 && y > 0 && y < h - 1;
    return opaque ? [20, 200, 60, 255] : [123, 45, 67, 0];
  });
  const expected = quantizeGifAlphaFrame(rgba).index;

  const bytes = packGifAlpha([rgba], { width: w, height: h, delayMs: 80 });
  const gif = decodeGifFirstFrame(bytes);

  assert.equal(gif.transparent, true, 'GCE transparency flag is set');
  assert.equal(gif.transparentIndex, GIF_TRANSPARENT_INDEX, 'GCE transparent index is the reserved 0');
  assert.equal(gif.disposal, 2, 'frame disposes to background so transparency does not smear');
  assert.equal(gif.width, w);
  assert.equal(gif.height, h);
  // Lossless LZW: the decoded indices must equal the pre-encode index buffer.
  assert.deepEqual(gif.indices, Array.from(expected), 'pack → decode reproduces the index buffer exactly');

  // Every border (transparent-input) pixel decodes to the transparent index; no
  // opaque centre pixel does.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const wasTransparent = !(x > 0 && x < w - 1 && y > 0 && y < h - 1);
      if (wasTransparent) assert.equal(gif.indices[i], GIF_TRANSPARENT_INDEX, `pixel ${x},${y} stays transparent`);
      else assert.notEqual(gif.indices[i], GIF_TRANSPARENT_INDEX, `pixel ${x},${y} stays opaque`);
    }
  }
});

test('packGifAlpha: deterministic - same frames + threshold ⇒ identical bytes', () => {
  const w = 5, h = 3;
  const mk = (): Uint8Array[] => [
    frame(w, h, (x, y) => [(x * 40) & 255, (y * 70) & 255, 128, x === 0 ? 0 : 255]),
    frame(w, h, (x, y) => [(x * 17) & 255, 200, (y * 33) & 255, y === h - 1 ? 0 : 255]),
  ];
  const a = packGifAlpha(mk(), { width: w, height: h, delayMs: 100, loops: 0 });
  const b = packGifAlpha(mk(), { width: w, height: h, delayMs: 100, loops: 0 });
  assert.deepEqual(Array.from(a), Array.from(b), 'byte-identical across runs');
  assert.ok(a.length > 0);
});

test('packGifAlpha: multi-frame, opaque pixel never collides with the transparent index even when black', () => {
  // An opaque BLACK pixel shares RGB with the index-0 placeholder [0,0,0]; it must
  // still land on a non-zero (opaque) index, not the transparent one.
  const w = 2, h = 1;
  const rgba = frame(w, h, (x) => (x === 0 ? [0, 0, 0, 0] : [0, 0, 0, 255]));
  const bytes = packGifAlpha([rgba], { width: w, height: h, delayMs: 50 });
  const gif = decodeGifFirstFrame(bytes);
  assert.equal(gif.indices[0], GIF_TRANSPARENT_INDEX, 'transparent black → transparent index');
  assert.notEqual(gif.indices[1], GIF_TRANSPARENT_INDEX, 'opaque black → opaque index');
});
