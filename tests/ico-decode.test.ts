// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeIco, isIco, IcoDecodeError, ICO_MAX_DIM } from '../engine/src/ico-decode.ts';

// ─── ICO builders ────────────────────────────────────────────────────────────

function u16(n: number): number[] { return [n & 0xff, (n >> 8) & 0xff]; }
function u32(n: number): number[] { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; }

interface Entry { w: number; h: number; payload: Uint8Array; }

/** Assemble a valid ICONDIR + entries + payloads. */
function buildIco(entries: Entry[], overrides?: { count?: number; offsetFor?: (i: number) => number; sizeFor?: (i: number) => number }): Uint8Array {
  const count = overrides?.count ?? entries.length;
  const headerLen = 6 + entries.length * 16;
  const offsets: number[] = [];
  let cursor = headerLen;
  for (const e of entries) { offsets.push(cursor); cursor += e.payload.length; }

  const dir: number[] = [...u16(0), ...u16(1), ...u16(count)];
  entries.forEach((e, i) => {
    const off = overrides?.offsetFor ? overrides.offsetFor(i) : offsets[i]!;
    const size = overrides?.sizeFor ? overrides.sizeFor(i) : e.payload.length;
    dir.push(
      e.w & 0xff, e.h & 0xff, 0, 0, // width, height, colorCount, reserved
      ...u16(1), ...u16(32),        // planes, bitCount
      ...u32(size), ...u32(off),    // bytesInRes, imageOffset
    );
  });

  const out = new Uint8Array(cursor);
  out.set(dir, 0);
  entries.forEach((e, i) => out.set(e.payload, offsets[i]));
  return out;
}

/** A headerless 32-bit BGRA DIB: solid colour, doubled height, empty AND mask. */
function bmpDib(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const stride = w * 4;
  const andStride = (((w) + 31) >> 5) << 2;
  const buf = new Uint8Array(40 + stride * h + andStride * h);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 40, true);         // biSize
  dv.setInt32(4, w, true);           // biWidth
  dv.setInt32(8, h * 2, true);       // biHeight (DOUBLED)
  dv.setUint16(12, 1, true);         // biPlanes
  dv.setUint16(14, 32, true);        // biBitCount
  let p = 40;
  for (let i = 0; i < w * h; i++) { buf[p] = b; buf[p + 1] = g; buf[p + 2] = r; buf[p + 3] = a; p += 4; }
  return buf; // AND mask left all-zero (fully opaque)
}

/** A 24-bit BGR DIB with an AND mask cutting out the top-left pixel. */
function bmpDib24(w: number, h: number, r: number, g: number, b: number): Uint8Array {
  const stride = (((w * 24) + 31) >> 5) << 2;
  const andStride = (((w) + 31) >> 5) << 2;
  const buf = new Uint8Array(40 + stride * h + andStride * h);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 40, true);
  dv.setInt32(4, w, true);
  dv.setInt32(8, h * 2, true);
  dv.setUint16(12, 1, true);
  dv.setUint16(14, 24, true);
  for (let y = 0; y < h; y++) {
    let p = 40 + y * stride;
    for (let x = 0; x < w; x++) { buf[p] = b; buf[p + 1] = g; buf[p + 2] = r; p += 3; }
  }
  // AND mask: set bit for image top-left → file bottom row's first bit is NOT it.
  // Image row 0 (top) maps to file row (h-1). Set its high bit (x=0) transparent.
  const andStart = 40 + stride * h;
  buf[andStart + (h - 1) * andStride] = 0x80; // top row, x=0 → transparent
  return buf;
}

/** A minimal PNG payload: signature + IHDR with a given size (not a full PNG). */
function pngPayload(w: number, h: number): Uint8Array {
  const buf = new Uint8Array(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const dv = new DataView(buf.buffer);
  dv.setUint32(8, 13, false);        // IHDR length
  buf.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
  dv.setUint32(16, w, false);        // width BE
  dv.setUint32(20, h, false);        // height BE
  return buf;
}

// ─── tests ───────────────────────────────────────────────────────────────────

test('isIco recognises a valid ICONDIR and rejects junk', () => {
  const ico = buildIco([{ w: 16, h: 16, payload: bmpDib(16, 16, 10, 20, 30) }]);
  assert.equal(isIco(ico), true);
  assert.equal(isIco(new Uint8Array([0, 0, 9, 0, 1, 0])), false); // bad type
  assert.equal(isIco(new Uint8Array([1, 2, 3])), false);          // too short
});

test('two-entry ICO picks the largest (32px over 16px)', () => {
  const ico = buildIco([
    { w: 16, h: 16, payload: bmpDib(16, 16, 200, 100, 50) },
    { w: 32, h: 32, payload: bmpDib(32, 32, 11, 22, 33) },
  ]);
  const img = decodeIco(ico);
  assert.equal(img.png, undefined);
  if (img.png) throw new Error('expected BMP');
  assert.equal(img.width, 32);
  assert.equal(img.height, 32);
  // First pixel is the 32px image's colour (RGBA), not the 16px one.
  assert.deepEqual([img.rgba[0], img.rgba[1], img.rgba[2], img.rgba[3]], [11, 22, 33, 255]);
  assert.equal(img.rgba.length, 32 * 32 * 4);
});

test('32-bit BGRA is read straight with alpha honoured', () => {
  const ico = buildIco([{ w: 4, h: 4, payload: bmpDib(4, 4, 255, 128, 64, 200) }]);
  const img = decodeIco(ico);
  if (img.png) throw new Error('expected BMP');
  assert.deepEqual([img.rgba[0], img.rgba[1], img.rgba[2], img.rgba[3]], [255, 128, 64, 200]);
});

test('24-bit DIB is opaque except where the AND mask cuts out', () => {
  const ico = buildIco([{ w: 8, h: 8, payload: bmpDib24(8, 8, 90, 180, 240) }]);
  const img = decodeIco(ico);
  if (img.png) throw new Error('expected BMP');
  // Top-left pixel (image row 0, x 0) is masked transparent.
  assert.equal(img.rgba[3], 0);
  // A different pixel stays opaque with the right colour.
  const i = (1 * 8 + 1) * 4;
  assert.deepEqual([img.rgba[i], img.rgba[i + 1], img.rgba[i + 2], img.rgba[i + 3]], [90, 180, 240, 255]);
});

test('PNG-entry ICO returns {png:true} with IHDR dimensions', () => {
  const ico = buildIco([{ w: 0, h: 0, payload: pngPayload(256, 256) }]); // 0 → 256 in dir
  const img = decodeIco(ico);
  assert.equal(img.png, true);
  if (!img.png) throw new Error('expected PNG');
  assert.equal(img.width, 256);
  assert.equal(img.height, 256);
  assert.equal(img.bytes[0], 0x89);
});

test('PNG entry wins over a smaller BMP entry by area', () => {
  const ico = buildIco([
    { w: 16, h: 16, payload: bmpDib(16, 16, 1, 2, 3) },
    { w: 0, h: 0, payload: pngPayload(128, 128) },
  ]);
  const img = decodeIco(ico);
  assert.equal(img.png, true);
});

test('a tiny PNG payload cannot hand an excessive IHDR allocation to the host', () => {
  const ico = buildIco([{ w: 0, h: 0, payload: pngPayload(ICO_MAX_DIM, ICO_MAX_DIM) }]);
  assert.throws(() => decodeIco(ico), (e) => e instanceof IcoDecodeError && e.code === 'png-dims');
});

test('crafted oversized count throws', () => {
  assert.throws(() => decodeIco(new Uint8Array([0, 0, 1, 0, 0xff, 0xff])), (e) => e instanceof IcoDecodeError && e.code === 'count');
});

test('count whose entry table overruns the file throws', () => {
  // Declares 4 entries but the file is only the 6-byte header.
  const buf = new Uint8Array([0, 0, 1, 0, ...u16(4)]);
  assert.throws(() => decodeIco(buf), (e) => e instanceof IcoDecodeError && e.code === 'truncated');
});

test('entry imageOffset escaping the file throws', () => {
  const ico = buildIco([{ w: 16, h: 16, payload: bmpDib(16, 16, 0, 0, 0) }], { offsetFor: () => 0xffffff });
  assert.throws(() => decodeIco(ico), (e) => e instanceof IcoDecodeError && e.code === 'offset');
});

test('entry size escaping the file throws', () => {
  const ico = buildIco([{ w: 16, h: 16, payload: bmpDib(16, 16, 0, 0, 0) }], { sizeFor: () => 0x7fffffff });
  assert.throws(() => decodeIco(ico), (e) => e instanceof IcoDecodeError && e.code === 'offset');
});

test('unsupported bit depth (8-bpp palettised) throws clearly', () => {
  // A 40-byte DIB claiming 8 bpp - not decoded.
  const dib = new Uint8Array(40 + 16 * 16 + 64);
  const dv = new DataView(dib.buffer);
  dv.setUint32(0, 40, true);
  dv.setInt32(4, 16, true);
  dv.setInt32(8, 32, true);
  dv.setUint16(12, 1, true);
  dv.setUint16(14, 8, true);
  const ico = buildIco([{ w: 16, h: 16, payload: dib }]);
  assert.throws(() => decodeIco(ico), (e) => e instanceof IcoDecodeError && e.code === 'dib-bpp');
});

test('empty ICONDIR (zero count) throws', () => {
  assert.throws(() => decodeIco(new Uint8Array([0, 0, 1, 0, 0, 0])), (e) => e instanceof IcoDecodeError && e.code === 'empty');
});

test('32-bit icon honours its alpha channel and ignores a bogus all-0xFF AND mask', () => {
  // Regression: real 32-bit icons often ship an all-1s AND mask as a formality and
  // rely on the alpha channel. Applying that mask unconditionally would blank every
  // pixel. With real alpha present, the mask must be ignored.
  const w = 4;
  const h = 4;
  const dib = bmpDib(w, h, 10, 20, 30, 255); // fully opaque alpha
  const stride = w * 4;
  const andStart = 40 + stride * h;
  dib.fill(0xff, andStart); // corrupt AND mask to all-transparent
  const ico = decodeIco(buildIco([{ w, h, payload: dib }]));
  if (ico.png) { assert.fail('expected a decoded BMP icon, got a PNG payload'); return; }
  for (let i = 3; i < ico.rgba.length; i += 4) {
    assert.equal(ico.rgba[i], 255, 'opaque alpha preserved despite the bogus AND mask');
  }
  assert.equal(ico.rgba[0], 10, 'R survives');
});

test('32-bit icon with an all-zero alpha channel falls back to the AND mask', () => {
  // No usable alpha → the 1-bpp AND mask is the only cut-out, and opacity is derived
  // from it (opaque where the mask bit is 0).
  const w = 4;
  const h = 4;
  const dib = bmpDib(w, h, 10, 20, 30, 0); // alpha entirely zero
  const stride = w * 4;
  const andStride = (((w) + 31) >> 5) << 2;
  const andStart = 40 + stride * h;
  dib[andStart + (h - 1) * andStride] = 0x80; // image top-left → transparent
  const ico = decodeIco(buildIco([{ w, h, payload: dib }]));
  if (ico.png) { assert.fail('expected a decoded BMP icon, got a PNG payload'); return; }
  assert.equal(ico.rgba[3], 0, 'AND-masked pixel is transparent');
  assert.equal(ico.rgba[7], 255, 'unmasked pixel is opaque (derived from the mask, not the zero alpha)');
});
