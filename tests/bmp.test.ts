// SPDX-License-Identifier: MPL-2.0
/**
 * BMP encoder/decoder contract (engine/src/bmp.ts).
 *
 * Covers: 24-bit and 32-bit round-trips at ODD widths (so the 4-byte row
 * padding is actually exercised), a known 2x2 fixture whose every byte is
 * asserted against a hand-computed BITMAPFILEHEADER + BITMAPINFOHEADER + the
 * bottom-up padded pixel array, and that truncated / compressed / bad files
 * throw a typed BmpUnsupportedError rather than mis-decoding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BMP_MAX_DIM, encodeBmp, decodeBmp, isBmp, BmpUnsupportedError } from '../engine/src/bmp.ts';

// Build a deterministic RGBA buffer.
function makeRgba(w: number, h: number, alpha: (x: number, y: number) => number): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      px[i] = (x * 37 + y * 11) & 0xff; // R
      px[i + 1] = (x * 7 + y * 53) & 0xff; // G
      px[i + 2] = (x * 101 + y * 3) & 0xff; // B
      px[i + 3] = alpha(x, y);
    }
  }
  return px;
}

test('24-bit round-trip at an odd width (row padding)', () => {
  const w = 5;
  const h = 3;
  const src = makeRgba(w, h, () => 255); // fully opaque => 24-bit
  const bmp = encodeBmp(src, w, h);
  assert.ok(isBmp(bmp));
  // 5 px * 3 bytes = 15, padded to 16 per row.
  assert.equal((bmp[28]! | (bmp[29]! << 8)), 24, 'auto-picks 24-bit for opaque');
  const dec = decodeBmp(bmp);
  assert.equal(dec.width, w);
  assert.equal(dec.height, h);
  // RGB survives exactly; alpha is forced to 255 (24-bit carries none).
  assert.deepEqual(Array.from(dec.rgba), Array.from(src));
});

test('32-bit round-trip at an odd width, alpha preserved', () => {
  const w = 3;
  const h = 4;
  const src = makeRgba(w, h, (x, y) => (x === 0 && y === 0 ? 128 : x + y === 0 ? 0 : 200));
  const bmp = encodeBmp(src, w, h);
  assert.equal((bmp[28]! | (bmp[29]! << 8)), 32, 'auto-picks 32-bit when alpha present');
  const dec = decodeBmp(bmp);
  assert.equal(dec.width, w);
  assert.equal(dec.height, h);
  assert.deepEqual(Array.from(dec.rgba), Array.from(src), 'RGBA round-trips exactly');
});

test('32-bit BI_RGB whose 4th byte is all zero decodes OPAQUE, not transparent', () => {
  // Regression: many real encoders (older GDI, Delphi/VB, scanner drivers) write the
  // officially-"unused" 4th byte of a 32-bit BI_RGB pixel as 0x00. Reading it straight
  // as alpha would decode the whole image transparent - a blank conversion. When the
  // alpha channel is entirely zero it is padding, so the image is opaque.
  const w = 4;
  const h = 3;
  const src = makeRgba(w, h, () => 0); // every 4th byte 0
  const bmp = encodeBmp(src, w, h);    // alpha<255 everywhere → 32-bit written, A=0
  assert.equal((bmp[28]! | (bmp[29]! << 8)), 32, 'stored as 32-bit');
  const dec = decodeBmp(bmp);
  for (let i = 3; i < dec.rgba.length; i += 4) {
    assert.equal(dec.rgba[i], 255, 'all-zero alpha channel read as opaque');
  }
  // RGB still survives the round trip.
  for (let i = 0; i < dec.rgba.length; i += 4) {
    assert.equal(dec.rgba[i], src[i], 'R preserved');
    assert.equal(dec.rgba[i + 1], src[i + 1], 'G preserved');
    assert.equal(dec.rgba[i + 2], src[i + 2], 'B preserved');
  }
});

test('32-bit BMP with genuine alpha info keeps it (only all-zero is treated as padding)', () => {
  // One non-zero alpha byte proves the channel carries information → honour it.
  const w = 3;
  const h = 2;
  const src = makeRgba(w, h, (x, y) => (x === 0 && y === 0 ? 0 : 200));
  const dec = decodeBmp(encodeBmp(src, w, h));
  assert.equal(dec.rgba[3], 0, 'a real alpha 0 is preserved when the channel has info');
  assert.equal(dec.rgba[7], 200, 'other alpha values preserved');
});

test('forced 24-bit drops alpha', () => {
  const src = makeRgba(2, 2, () => 40);
  const bmp = encodeBmp(src, 2, 2, { bitDepth: 24 });
  assert.equal((bmp[28]! | (bmp[29]! << 8)), 24);
  const dec = decodeBmp(bmp);
  for (let i = 3; i < dec.rgba.length; i += 4) assert.equal(dec.rgba[i], 255);
});

test('known 2x2 fixture - exact bytes', () => {
  // Pixels (top-down RGBA), all opaque so we get 24-bit:
  //   (0,0) red      (1,0) green
  //   (0,1) blue     (1,1) white
  const rgba = new Uint8Array([
    255, 0, 0, 255, /* red   */ 0, 255, 0, 255, /* green */
    0, 0, 255, 255, /* blue  */ 255, 255, 255, 255, /* white */
  ]);
  const bmp = encodeBmp(rgba, 2, 2);

  // Row = 2px * 3 bytes = 6, padded to 8. imageSize = 8*2 = 16. file = 54+16 = 70.
  const stride = 8;
  const imageSize = stride * 2;
  const fileSize = 54 + imageSize;
  assert.equal(bmp.length, fileSize);

  // Expected full byte layout, hand-assembled.
  const expected = new Uint8Array(fileSize);
  const dv = new DataView(expected.buffer);
  expected[0] = 0x42;
  expected[1] = 0x4d;
  dv.setUint32(2, fileSize, true);
  dv.setUint32(10, 54, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, 2, true);
  dv.setInt32(22, 2, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 24, true);
  dv.setUint32(30, 0, true);
  dv.setUint32(34, imageSize, true);
  dv.setInt32(38, 2835, true);
  dv.setInt32(42, 2835, true);
  // Pixel array, bottom-up. File row 0 = image bottom row (y=1): blue, white.
  // BGR order, then 2 pad bytes.
  let o = 54;
  // bottom row (y=1): blue(0,0,255) -> BGR 255,0,0 ; white -> 255,255,255
  expected[o++] = 255; expected[o++] = 0; expected[o++] = 0;
  expected[o++] = 255; expected[o++] = 255; expected[o++] = 255;
  o += 2; // pad
  // top row (y=0): red(255,0,0) -> BGR 0,0,255 ; green(0,255,0) -> BGR 0,255,0
  expected[o++] = 0; expected[o++] = 0; expected[o++] = 255;
  expected[o++] = 0; expected[o++] = 255; expected[o++] = 0;
  o += 2; // pad

  assert.deepEqual(Array.from(bmp), Array.from(expected), 'byte-exact BMP');

  // And it decodes back to the original RGBA.
  const dec = decodeBmp(bmp);
  assert.deepEqual(Array.from(dec.rgba), Array.from(rgba));
});

test('decodes a top-down (negative height) BMP', () => {
  const src = makeRgba(3, 2, () => 255);
  const bmp = encodeBmp(src, 3, 2);
  // Flip biHeight to negative and re-lay the rows top-down to match.
  const dv = new DataView(bmp.buffer);
  // Rebuild rows top-down by swapping the two rows in the padded array.
  const stride = ((3 * 3) + 3) & ~3;
  const top = bmp.slice(54, 54 + stride);
  const bottom = bmp.slice(54 + stride, 54 + 2 * stride);
  bmp.set(bottom, 54);
  bmp.set(top, 54 + stride);
  dv.setInt32(22, -2, true);
  const dec = decodeBmp(bmp);
  assert.deepEqual(Array.from(dec.rgba), Array.from(src));
});

test('truncated file throws cleanly', () => {
  const bmp = encodeBmp(makeRgba(4, 4, () => 255), 4, 4);
  const cut = bmp.slice(0, bmp.length - 10);
  assert.throws(() => decodeBmp(cut), (e: unknown) => e instanceof BmpUnsupportedError && e.code === 'truncated');
  // Shorter than a header.
  assert.throws(() => decodeBmp(new Uint8Array(10)), (e: unknown) => e instanceof BmpUnsupportedError && e.code === 'truncated');
});

test('compressed BMP is refused', () => {
  const bmp = encodeBmp(makeRgba(4, 4, () => 255), 4, 4);
  new DataView(bmp.buffer).setUint32(30, 1, true); // BI_RLE8
  assert.throws(() => decodeBmp(bmp), (e: unknown) => e instanceof BmpUnsupportedError && e.code === 'compression');
});

test('paletted / low bit depth is refused', () => {
  const bmp = encodeBmp(makeRgba(4, 4, () => 255), 4, 4);
  new DataView(bmp.buffer).setUint16(28, 8, true); // 8-bit paletted
  assert.throws(() => decodeBmp(bmp), (e: unknown) => e instanceof BmpUnsupportedError && e.code === 'bit-depth');
});

test('non-BM signature is refused', () => {
  const bmp = encodeBmp(makeRgba(2, 2, () => 255), 2, 2);
  bmp[0] = 0x50; // 'P'
  assert.throws(() => decodeBmp(bmp), (e: unknown) => e instanceof BmpUnsupportedError && e.code === 'not-bmp');
  assert.equal(isBmp(bmp), false);
});

test('decode works on a subarray view (nonzero byteOffset)', () => {
  const src = makeRgba(3, 3, () => 255);
  const bmp = encodeBmp(src, 3, 3);
  const framed = new Uint8Array(bmp.length + 7);
  framed.set(bmp, 7);
  const view = framed.subarray(7);
  const dec = decodeBmp(view);
  assert.deepEqual(Array.from(dec.rgba), Array.from(src));
});

test('a plausible header cannot allocate an excessive decoded pixel buffer', () => {
  const bmp = encodeBmp(makeRgba(1, 1, () => 255), 1, 1);
  const dv = new DataView(bmp.buffer);
  dv.setInt32(18, BMP_MAX_DIM, true);
  dv.setInt32(22, BMP_MAX_DIM, true);
  assert.throws(
    () => decodeBmp(bmp),
    (e: unknown) => e instanceof BmpUnsupportedError && e.code === 'dimensions',
  );
});
