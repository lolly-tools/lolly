// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the baseline TIFF encoder (engine/src/tiff.ts).
 *
 * Parses the emitted bytes back with a tiny reader and checks the IFD tags and
 * the pixel strip — the encoder is pure, so this fully exercises it with no DOM.
 *
 * Run with: node --test tests/tiff.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { packTiff } from '../engine/src/tiff.ts';

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };

interface TiffTag {
  type: number;
  count: number;
  vals: any[];
}
interface TiffRead {
  dv: DataView;
  tags: Record<number, TiffTag>;
  tagOrder: number[];
  ifd: number;
  n: number;
}

// Minimal baseline-TIFF IFD reader (little-endian only — that's all packTiff emits).
function readTiff(bytes: Uint8Array): TiffRead {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(bytes[0], 0x49, 'byte 0 is "I"');
  assert.equal(bytes[1], 0x49, 'byte 1 is "I" (little-endian)');
  assert.equal(dv.getUint16(2, true), 42, 'magic 42');
  const ifd = dv.getUint32(4, true);
  const n = dv.getUint16(ifd, true);
  const tags: Record<number, TiffTag> = {};
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12;
    const tag = dv.getUint16(o, true);
    const type = dv.getUint16(o + 2, true);
    const count = dv.getUint32(o + 4, true);
    const size = count * (TYPE_SIZE[type] || 1);
    const at = size > 4 ? dv.getUint32(o + 8, true) : o + 8;
    const vals: any[] = [];
    for (let k = 0; k < count; k++) {
      if (type === 3) vals.push(dv.getUint16(at + k * 2, true));
      else if (type === 4) vals.push(dv.getUint32(at + k * 4, true));
      else if (type === 5) vals.push([dv.getUint32(at + k * 8, true), dv.getUint32(at + k * 8 + 4, true)]);
      else vals.push(dv.getUint8(at + k)); // ASCII / BYTE
    }
    tags[tag] = { type, count, vals };
  }
  // Tags MUST be sorted ascending (baseline TIFF requirement).
  const tagOrder: number[] = [];
  for (let i = 0; i < n; i++) tagOrder.push(dv.getUint16(ifd + 2 + i * 12, true));
  return { dv, tags, tagOrder, ifd, n };
}

test('packTiff: RGB image has correct header, IFD tags and pixel strip', () => {
  const W = 2, H = 2;
  const rgb = new Uint8Array([
    255, 0, 0,   0, 255, 0,
    0, 0, 255,   255, 255, 0,
  ]);
  const bytes = packTiff(rgb, { width: W, height: H, samplesPerPixel: 3, dpi: 300 });
  const { tags, tagOrder } = readTiff(bytes);

  assert.equal(tags[256]!.vals[0], W, 'ImageWidth');
  assert.equal(tags[257]!.vals[0], H, 'ImageLength');
  assert.deepEqual(tags[258]!.vals, [8, 8, 8], 'BitsPerSample = 8,8,8');
  assert.equal(tags[259]!.vals[0], 1, 'Compression = none');
  assert.equal(tags[262]!.vals[0], 2, 'PhotometricInterpretation = RGB');
  assert.equal(tags[277]!.vals[0], 3, 'SamplesPerPixel = 3');
  assert.equal(tags[278]!.vals[0], H, 'RowsPerStrip = height (single strip)');
  assert.equal(tags[279]!.vals[0], W * H * 3, 'StripByteCounts');
  assert.deepEqual(tags[282]!.vals[0], [300, 1], 'XResolution = 300/1');
  assert.deepEqual(tags[283]!.vals[0], [300, 1], 'YResolution = 300/1');
  assert.equal(tags[296]!.vals[0], 2, 'ResolutionUnit = inch');

  // The pixel strip is the tail of the file at StripOffsets and matches the input.
  const off = tags[273]!.vals[0];
  assert.deepEqual(bytes.slice(off, off + rgb.length), rgb, 'strip bytes == input pixels');

  // IFD entries are tag-sorted.
  const sorted = [...tagOrder].sort((a, b) => a - b);
  assert.deepEqual(tagOrder, sorted, 'IFD entries sorted by tag');
});

test('packTiff: grayscale inlines a single BitsPerSample and defaults Photometric', () => {
  const W = 3, H = 1;
  const gray = new Uint8Array([0, 128, 255]);
  const bytes = packTiff(gray, { width: W, height: H, samplesPerPixel: 1 });
  const { tags } = readTiff(bytes);
  assert.equal(tags[258]!.count, 1, 'one BitsPerSample entry');
  assert.equal(tags[258]!.vals[0], 8);
  assert.equal(tags[262]!.vals[0], 1, 'Photometric defaults to BlackIsZero for 1 sample');
  assert.equal(tags[277]!.vals[0], 1, 'SamplesPerPixel = 1');
  const off = tags[273]!.vals[0];
  assert.deepEqual(bytes.slice(off, off + gray.length), gray);
});

test('packTiff: embeds provenance ASCII tags when supplied', () => {
  const rgb = new Uint8Array(3);
  const bytes = packTiff(rgb, {
    width: 1, height: 1, samplesPerPixel: 3,
    meta: { software: 'Lolly', author: 'Ada' }, description: 'A test image',
  });
  const { tags } = readTiff(bytes);
  const ascii = (t: number) => String.fromCharCode(...tags[t]!.vals.filter((b: number) => b !== 0));
  assert.equal(ascii(270), 'A test image', 'ImageDescription');
  assert.equal(ascii(305), 'Lolly', 'Software');
  assert.equal(ascii(315), 'Ada', 'Artist');
});

test('packTiff: rejects a pixel buffer that does not match width×height×samples', () => {
  assert.throws(() => packTiff(new Uint8Array(10), { width: 2, height: 2, samplesPerPixel: 3 }),
    /pixel buffer/);
});

test('packTiff: rejects non-positive dimensions', () => {
  assert.throws(() => packTiff(new Uint8Array(0), { width: 0, height: 1 }), /positive/);
});
