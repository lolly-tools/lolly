// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the baseline TIFF encoder (engine/src/tiff.ts).
 *
 * Parses the emitted bytes back with a tiny reader and checks the IFD tags and
 * the pixel strip - the encoder is pure, so this fully exercises it with no DOM.
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

// Minimal baseline-TIFF IFD reader (little-endian only - that's all packTiff emits).
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

// ---------------------------------------------------------------------------
// Deep output (depth: 16 | 'float32') - plans/61-deeprichpixels.md Phase A.
// Appended below the original 8-bit suite, which doubles as the byte-identical
// characterization of the 8-bit path (nothing above this line was touched).
// ---------------------------------------------------------------------------

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

// Golden files, captured 2026-07-31 and externally validated with libtiff's
// tiffinfo (reports "Sample Format: unsigned integer" / "IEEE floating point")
// and macOS sips (bitsPerSample 16 / 32). Byte-exact pins: any layout change
// to the encoder must consciously regenerate these.
// 1x1 RGB, depth 16, samples [0x0001, 0x8000, 0xffff]:
const GOLDEN_RGB16 =
  '49492a00080000000d000001040001000000010000000101040001000000010000000201030003000000aa00000003010300' +
  '01000000010000000601030001000000020000001101040001000000c600000015010300010000000300000016010400' +
  '01000000010000001701040001000000060000001a01050001000000b00000001b01050001000000b800000028010300' +
  '01000000020000005301030003000000c0000000000000001000100010004800000001000000480000000100000001000100' +
  '010001000080ffff';
// 1x1 gray, depth 'float32', sample [0.25] (0.25f LE = 00 00 80 3e):
const GOLDEN_GRAY_F32 =
  '49492a00080000000d000001040001000000010000000101040001000000010000000201030001000000200000000301030001000000010000' +
  '000601030001000000010000001101040001000000ba0000001501030001000000010000001601040001000000010000001701040001000000' +
  '040000001a01050001000000aa0000001b01050001000000b200000028010300010000000200000053010300010000000300000000000000' +
  '480000000100000048000000010000000000803e';

test('packTiff: 16-bit RGB - IFD structure, SampleFormat=1, LE sample bytes', () => {
  const W = 2, H = 1;
  // Values chosen to catch endianness: 0x1234 written LE must appear as 34 12.
  const rgb = new Uint16Array([0x1234, 0, 0xffff, 0x8000, 0x00ff, 0xff00]);
  const bytes = packTiff(rgb, { width: W, height: H, samplesPerPixel: 3, dpi: 300, depth: 16 });
  const { dv, tags } = readTiff(bytes);

  assert.deepEqual(tags[258]!.vals, [16, 16, 16], 'BitsPerSample = 16,16,16');
  assert.deepEqual(tags[339]!.vals, [1, 1, 1], 'SampleFormat = 1 (unsigned int, TIFF 6.0 sec. 19)');
  assert.equal(tags[339]!.type, 3, 'SampleFormat entries are SHORT');
  assert.equal(tags[279]!.vals[0], W * H * 3 * 2, 'StripByteCounts = samples * 2 bytes');
  assert.equal(tags[277]!.vals[0], 3);
  assert.equal(tags[259]!.vals[0], 1, 'still uncompressed');

  // Samples round-trip little-endian per the "II" header.
  const off = tags[273]!.vals[0];
  for (let i = 0; i < rgb.length; i++) {
    assert.equal(dv.getUint16(off + i * 2, true), rgb[i], `sample ${i}`);
  }
  // Endianness reference value: 0x1234 -> bytes 34 12 (not 12 34).
  assert.equal(bytes[off], 0x34);
  assert.equal(bytes[off + 1], 0x12);
  // File ends exactly at the strip end (single strip, no trailing bytes).
  assert.equal(bytes.length, off + W * H * 3 * 2);
});

test('packTiff: float32 grayscale - SampleFormat=3, IEEE-754 LE reference bytes', () => {
  const gray = new Float32Array([0, 0.5, 1, -1]);
  const bytes = packTiff(gray, { width: 2, height: 2, samplesPerPixel: 1, depth: 'float32' });
  const { dv, tags } = readTiff(bytes);

  assert.equal(tags[258]!.count, 1, 'one BitsPerSample entry (gray)');
  assert.equal(tags[258]!.vals[0], 32, 'BitsPerSample = 32');
  assert.equal(tags[339]!.count, 1);
  assert.equal(tags[339]!.vals[0], 3, 'SampleFormat = 3 (IEEE float, TIFF 6.0 sec. 19)');
  assert.equal(tags[262]!.vals[0], 1, 'Photometric still BlackIsZero');
  assert.equal(tags[279]!.vals[0], 4 * 4, 'StripByteCounts = samples * 4 bytes');

  const off = tags[273]!.vals[0];
  for (let i = 0; i < gray.length; i++) {
    assert.equal(dv.getFloat32(off + i * 4, true), gray[i], `sample ${i}`);
  }
  // IEEE-754 reference values, little-endian: 1.0 = 00 00 80 3f, 0.5 = 00 00 00 3f.
  assert.equal(hex(bytes.slice(off + 8, off + 12)), '0000803f', '1.0f LE');
  assert.equal(hex(bytes.slice(off + 4, off + 8)), '0000003f', '0.5f LE');
  assert.equal(bytes.length, off + 4 * 4);
});

test('packTiff: golden bytes - 16-bit RGB and float32 gray fixtures are byte-exact', () => {
  const rgb16 = packTiff(new Uint16Array([0x0001, 0x8000, 0xffff]), {
    width: 1, height: 1, samplesPerPixel: 3, depth: 16,
  });
  assert.equal(hex(rgb16), GOLDEN_RGB16, '1x1 16-bit RGB golden');
  const grayF = packTiff(new Float32Array([0.25]), {
    width: 1, height: 1, samplesPerPixel: 1, depth: 'float32',
  });
  assert.equal(hex(grayF), GOLDEN_GRAY_F32, '1x1 float32 gray golden');
});

test('packTiff: 8-bit output is byte-identical with depth omitted vs depth: 8', () => {
  const rgb = new Uint8Array([1, 2, 3, 4, 5, 6]);
  const a = packTiff(rgb, { width: 2, height: 1, samplesPerPixel: 3, dpi: 300 });
  const b = packTiff(rgb, { width: 2, height: 1, samplesPerPixel: 3, dpi: 300, depth: 8 });
  assert.deepEqual(a, b, 'explicit depth: 8 emits the same bytes');
  // 8-bit output must NOT carry a SampleFormat tag (spec default 1; omission
  // keeps the pre-depth encoder's bytes).
  const { tags } = readTiff(a);
  assert.equal(tags[339], undefined, 'no SampleFormat tag at 8-bit');
});

test('packTiff: negative control - different 16-bit data produces different bytes', () => {
  const a = packTiff(new Uint16Array([0, 1, 2]), { width: 1, height: 1, samplesPerPixel: 3, depth: 16 });
  const b = packTiff(new Uint16Array([0, 1, 3]), { width: 1, height: 1, samplesPerPixel: 3, depth: 16 });
  assert.notDeepEqual(a, b);
  assert.equal(a.length, b.length, 'same structure, different strip only');
});

test('packTiff: rejects a buffer whose element type does not match depth', () => {
  // No silent conversion - depth conversion is pixels.ts's seam, not the writer's.
  assert.throws(() => packTiff(new Uint8Array(3), { width: 1, height: 1, samplesPerPixel: 3, depth: 16 }), /Uint16Array/);
  assert.throws(() => packTiff(new Uint16Array(3), { width: 1, height: 1, samplesPerPixel: 3, depth: 'float32' }), /Float32Array/);
  assert.throws(() => packTiff(new Float32Array(3), { width: 1, height: 1, samplesPerPixel: 3 }), /Uint8Array/);
  assert.throws(() => packTiff(new Uint16Array(3), { width: 1, height: 1, samplesPerPixel: 3, depth: 12 as any }), /depth/);
});

test('packTiff: 16-bit length check counts samples, not bytes', () => {
  assert.throws(() => packTiff(new Uint16Array(5), { width: 1, height: 1, samplesPerPixel: 3, depth: 16 }), /pixel buffer/);
});

// --- ExtraSamples (338) ------------------------------------------------------
// TIFF 6.0 REQUIRES ExtraSamples whenever SamplesPerPixel exceeds the component
// count the PhotometricInterpretation implies (p.31 "ExtraSamples", p.77 field
// list). packTiff accepts spp up to 4, so an RGBA or gray+alpha file must declare
// its trailing sample; value 2 = unassociated (straight) alpha, which is the
// engine's convention everywhere else.

test('packTiff: RGBA declares ExtraSamples = 2 (unassociated alpha)', () => {
  const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const { tags, tagOrder } = readTiff(packTiff(rgba, { width: 2, height: 1, samplesPerPixel: 4 }));
  assert.equal(tags[277]!.vals[0], 4, 'SamplesPerPixel = 4');
  assert.equal(tags[262]!.vals[0], 2, 'Photometric = RGB (3 components)');
  assert.ok(tags[338], 'ExtraSamples tag 338 is present');
  assert.equal(tags[338]!.type, 3, 'ExtraSamples entries are SHORT');
  assert.deepEqual(tags[338]!.vals, [2], 'one extra sample, value 2 = unassociated alpha');
  assert.deepEqual(tagOrder, [...tagOrder].sort((a, b) => a - b), 'IFD still tag-sorted');
});

test('packTiff: gray + alpha (spp 2) declares one ExtraSample', () => {
  const ga = new Uint16Array([0x1111, 0xffff, 0x2222, 0x8000]);
  // photometric is explicit: the default is `spp === 1 ? 1 : 2`, so gray+alpha has
  // to say BlackIsZero itself (that default predates this change and is unmoved).
  const { tags } = readTiff(packTiff(ga, { width: 2, height: 1, samplesPerPixel: 2, photometric: 1, depth: 16 }));
  assert.equal(tags[262]!.vals[0], 1, 'Photometric = BlackIsZero (1 component)');
  assert.deepEqual(tags[338]!.vals, [2], 'spp 2 over a 1-component photometric = 1 extra sample');
  assert.deepEqual(tags[339]!.vals, [1, 1], 'SampleFormat still one entry per sample');
});

test('packTiff: emits one SHORT per extra sample, not a fixed single entry', () => {
  // photometric 2 (RGB, 3 components) over 4 samples gives exactly 1 extra;
  // forcing gray (1 component) over 4 samples gives 3, proving the count is derived.
  const { tags } = readTiff(packTiff(new Uint8Array(4), { width: 1, height: 1, samplesPerPixel: 4, photometric: 1 }));
  assert.equal(tags[338]!.count, 3, 'gray + 3 extra samples');
  assert.deepEqual(tags[338]!.vals, [2, 2, 2]);
});

test('packTiff: a photometric that consumes every sample emits no ExtraSamples', () => {
  // Separated/CMYK (photometric 5) is a 4-component space - spp 4 has no extras.
  const { tags } = readTiff(packTiff(new Uint8Array(4), { width: 1, height: 1, samplesPerPixel: 4, photometric: 5 }));
  assert.equal(tags[338], undefined, 'no ExtraSamples when spp equals the component count');
});

test('packTiff: spp <= the photometric component count stays byte-identical', () => {
  // Regression guard for the ExtraSamples change: RGB and gray output must not
  // move a single byte. These are the pre-338 goldens, re-asserted verbatim.
  const rgb16 = packTiff(new Uint16Array([0x0001, 0x8000, 0xffff]), {
    width: 1, height: 1, samplesPerPixel: 3, depth: 16,
  });
  assert.equal(hex(rgb16), GOLDEN_RGB16, '16-bit RGB golden unchanged by ExtraSamples');
  const grayF = packTiff(new Float32Array([0.25]), {
    width: 1, height: 1, samplesPerPixel: 1, depth: 'float32',
  });
  assert.equal(hex(grayF), GOLDEN_GRAY_F32, 'float32 gray golden unchanged by ExtraSamples');
  const rgb8 = packTiff(new Uint8Array([1, 2, 3, 4, 5, 6]), { width: 2, height: 1, samplesPerPixel: 3, dpi: 300 });
  assert.equal(readTiff(rgb8).tags[338], undefined, '8-bit RGB carries no ExtraSamples');
});

// Golden pin for the 8-bit RGBA path. This byte string is NEW as of the
// spec-conformance fix that added ExtraSamples (338): 8-bit spp=4 output
// deliberately changed (it was non-conformant before - no reader could tell what
// the 4th sample was). Nothing in the repo emitted spp=4 at the time, so no
// shipped bytes moved. spp<=3 is pinned unchanged above.
// 1x1 RGBA (0x11,0x22,0x33,0x80) at 300 dpi.
const GOLDEN_RGBA8 =
  '49492a00080000000d000001040001000000010000000101040001000000010000000201030004000000aa0000000301030001' +
  '000000010000000601030001000000020000001101040001000000c200000015010300010000000400000016010400010000' +
  '00010000001701040001000000040000001a01050001000000b20000001b01050001000000ba00000028010300010000000200' +
  '00005201030001000000020000000000000008000800080008002c010000010000002c010000010000001122' +
  '3380';

test('packTiff: golden bytes - 8-bit RGBA fixture is byte-exact', () => {
  const rgba = packTiff(new Uint8Array([0x11, 0x22, 0x33, 0x80]), {
    width: 1, height: 1, samplesPerPixel: 4, dpi: 300,
  });
  assert.equal(hex(rgba), GOLDEN_RGBA8, '1x1 8-bit RGBA golden (includes tag 338)');
});
