// SPDX-License-Identifier: MPL-2.0
/**
 * Metadata-stripping tests - lossless clean-copy byte surgery (mirrors the
 * strip-data tool's hook logic; see engine/src/strip-metadata.ts).
 * Run with: node --test tests/strip-metadata.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stripMetadata, isStrippableFormat, hasResidualMetadata } from '../engine/src/strip-metadata.ts';
import { extractFileMetadata, readMpfIndex } from '../engine/src/file-metadata.ts';
import { assembleGainMapJpeg } from '../engine/src/gainmap-jpeg.ts';
import type { GainMapMeta } from '../engine/src/gainmap.ts';

const bytesOf = (...parts: (number[] | Uint8Array | string)[]): Uint8Array => {
  const arrs = parts.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p) : new Uint8Array(p)));
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};

test('isStrippableFormat: recognises the four cleanable formats, case-insensitively', () => {
  assert.equal(isStrippableFormat('JPEG'), true);
  assert.equal(isStrippableFormat('png'), true);
  assert.equal(isStrippableFormat('Svg'), true);
  assert.equal(isStrippableFormat('PDF'), true);
  assert.equal(isStrippableFormat('WebP'), false);
  assert.equal(isStrippableFormat('TIFF'), false);
  assert.equal(isStrippableFormat(null), false);
  assert.equal(isStrippableFormat(undefined), false);
});

test('stripMetadata(jpeg): drops APP1 (EXIF), keeps APP0 and the scan data', () => {
  const app0 = bytesOf([0xff, 0xe0, 0x00, 0x10], 'JFIF\0', [0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const app1 = bytesOf([0xff, 0xe1, 0x00, 0x10], 'Exif\0\0', [0, 0, 0, 0, 0, 0, 0, 0]);
  const sos = bytesOf([0xff, 0xda], [0x00, 0x3f, 0x00], [0xff, 0xd9]); // SOS + junk scan data + EOI
  const jpeg = bytesOf([0xff, 0xd8], app0, app1, sos);

  const out = stripMetadata(jpeg, 'jpeg');
  assert.equal(out.length, jpeg.length - app1.length);
  const text = Buffer.from(out).toString('latin1');
  assert.ok(text.includes('JFIF'));
  assert.ok(!text.includes('Exif'));
  // SOI/EOI preserved.
  assert.equal(out[0], 0xff); assert.equal(out[1], 0xd8);
  assert.equal(out[out.length - 2], 0xff); assert.equal(out[out.length - 1], 0xd9);
});

test('stripMetadata(png): drops tEXt, keeps IHDR and IEND', () => {
  const chunk = (type: string, data: number[]): Uint8Array => {
    const len = data.length;
    const lenBytes = [(len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
    return bytesOf(lenBytes, type, data, [0, 0, 0, 0]); // fake CRC - never validated
  };
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const ihdr = chunk('IHDR', new Array(13).fill(0));
  const text = chunk('tEXt', [...Buffer.from('Author\0Ada')]);
  const iend = chunk('IEND', []);
  const png = bytesOf(sig, ihdr, text, iend);

  const out = stripMetadata(png, 'png');
  assert.equal(out.length, png.length - text.length);
  const s = Buffer.from(out).toString('latin1');
  assert.ok(s.includes('IHDR'));
  assert.ok(s.includes('IEND'));
  assert.ok(!s.includes('Author'));
});

test('stripMetadata(svg): drops comments, <metadata>, and editor-private attrs; keeps geometry', () => {
  const svg = [
    '<?xml version="1.0"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://x" sodipodi:docname="art.svg">',
    '<!-- Generator: Secret Tool 1.0 -->',
    '<metadata><rdf:RDF>author info</rdf:RDF></metadata>',
    '<rect width="10" height="10" inkscape:label="mine"/>',
    '</svg>',
  ].join('');
  const out = new TextDecoder().decode(stripMetadata(new TextEncoder().encode(svg), 'svg'));
  assert.ok(!out.includes('Generator'));
  assert.ok(!out.includes('metadata'));
  assert.ok(!out.includes('author info'));
  assert.ok(!out.includes('inkscape:label'));
  assert.ok(out.includes('<rect width="10" height="10"'));
});

test('stripMetadata: malformed input for a format is returned unchanged, not thrown', () => {
  const junk = new Uint8Array([1, 2, 3]);
  assert.deepEqual(stripMetadata(junk, 'jpeg'), junk);
  assert.deepEqual(stripMetadata(junk, 'png'), junk);
});

// ─── verify-after-strip: the fail-loud privacy guard (crypto-audit finding #3) ──
// stripMetadata must never fall open to an un-stripped original that a caller
// would present as "clean". hasResidualMetadata is the post-condition; these
// tests prove it flags a dirty file and clears a genuinely stripped one, and
// that stripMetadata's own output always passes its verify.

test('hasResidualMetadata(jpeg): flags an EXIF file, clears the stripped copy', () => {
  const app0 = bytesOf([0xff, 0xe0, 0x00, 0x10], 'JFIF\0', [0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const app1 = bytesOf([0xff, 0xe1, 0x00, 0x10], 'Exif\0\0', [0, 0, 0, 0, 0, 0, 0, 0]);
  const sos = bytesOf([0xff, 0xda], [0x00, 0x3f, 0x00], [0xff, 0xd9]);
  const jpeg = bytesOf([0xff, 0xd8], app0, app1, sos);
  assert.match(hasResidualMetadata(jpeg, 'jpeg') ?? '', /APP1/);
  assert.equal(hasResidualMetadata(stripMetadata(jpeg, 'jpeg'), 'jpeg'), null);
});

test('hasResidualMetadata(png): flags a tEXt chunk, clears the stripped copy', () => {
  const chunk = (type: string, data: number[]): Uint8Array => {
    const len = data.length;
    const lenBytes = [(len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
    return bytesOf(lenBytes, type, data, [0, 0, 0, 0]);
  };
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const png = bytesOf(sig, chunk('IHDR', new Array(13).fill(0)), chunk('tEXt', [...Buffer.from('Author\0Ada')]), chunk('IEND', []));
  assert.match(hasResidualMetadata(png, 'png') ?? '', /tEXt/);
  assert.equal(hasResidualMetadata(stripMetadata(png, 'png'), 'png'), null);
});

test('hasResidualMetadata(svg): flags editor cruft, clears the stripped copy', () => {
  const svg = [
    '<?xml version="1.0"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://x" sodipodi:docname="art.svg">',
    '<!-- Generator: Secret Tool 1.0 -->',
    '<metadata><rdf:RDF>author info</rdf:RDF></metadata>',
    '<rect width="10" height="10" inkscape:label="mine"/>',
    '</svg>',
  ].join('');
  const raw = new TextEncoder().encode(svg);
  assert.ok(hasResidualMetadata(raw, 'svg'), 'dirty svg should report residual metadata');
  assert.equal(hasResidualMetadata(stripMetadata(raw, 'svg'), 'svg'), null);
});

// ─── Multi-picture JPEGs (plans/61-deeprichpixels.md section 6 B2 / task E2) ───────────
//
// A gain-map HDR JPEG keeps its second image past the primary's EOI, described
// by an APP2 MPF index. Dropping every APPn but APP0 deleted the index and left
// the second image orphaned - a file the read-side then flags as carrying
// hidden appended data. The documented choice (see the module header) is to drop
// the extra images WITH the index, so a stripped file is a plain SDR JPEG.

const SOS_SEG = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];

/** A structurally-valid JPEG: SOI, an SOS whose length field is honest, entropy bytes, EOI. */
function minimalJpeg(entropy: number[]): Uint8Array {
  return bytesOf([0xff, 0xd8], SOS_SEG, entropy, [0xff, 0xd9]);
}

const GM_META: GainMapMeta = {
  channels: 1,
  gainMapMin: 0,
  gainMapMax: 2,
  gamma: 1,
  offsetSdr: 0,
  offsetHdr: 0,
  hdrCapacityMin: 0,
  hdrCapacityMax: 2,
  baseRendition: 'sdr',
  useBaseColorSpace: true,
};

test('stripMetadata(jpeg): a gain-map JPEG strips to a valid single-image SDR JPEG', () => {
  const base = minimalJpeg([0x11, 0x22, 0x33]);
  const gainMap = assembleGainMapJpeg(base, minimalJpeg([0x44, 0x55, 0x66]), GM_META);
  assert.ok(gainMap.length > base.length, 'the assembled file carries metadata and a second image');

  const out = stripMetadata(gainMap, 'jpeg');

  // 1. The output IS the original SDR JPEG, byte for byte. That is the strongest
  //    statement available: the base image was never re-encoded.
  assert.deepEqual([...out], [...base], 'stripping a gain-map JPEG yields the untouched SDR base');

  // 2. Structurally: one image, no metadata, no trailer.
  assert.equal(out[out.length - 2], 0xff);
  assert.equal(out[out.length - 1], 0xd9, 'the file must end at its EOI');
  assert.equal(readMpfIndex(out), null, 'the MPF index is gone');
  assert.equal(hasResidualMetadata(out, 'jpeg'), null);
  const text = Buffer.from(out).toString('latin1');
  assert.ok(!text.includes('MPF'), 'no orphaned MPF index');
  assert.ok(!text.includes('hdrgm'), 'no orphaned gain-map XMP');

  // 3. The defect this closes: the read-side no longer sees appended data at all.
  const meta = extractFileMetadata(out);
  assert.equal(meta.appended, undefined, 'no orphan left behind for the reveal to flag');

  // 4. Contrast - the UNstripped file discloses its gain map without alarm.
  const before = extractFileMetadata(gainMap);
  assert.match(before.appended?.kind ?? '', /HDR gain map/);
  assert.equal(!!before.fields.find((f) => f.label === 'Appended data')?.sensitive, false);
});

test('stripMetadata(jpeg): files with no MPF index are byte-for-byte unaffected by the MPF rule', () => {
  // Negative control 1: a plain JPEG with EXIF. Same output as before the change
  // - the EXIF goes, everything else survives, and there is no truncation.
  const app0 = bytesOf([0xff, 0xe0, 0x00, 0x10], 'JFIF\0', [0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const app1 = bytesOf([0xff, 0xe1, 0x00, 0x10], 'Exif\0\0', [0, 0, 0, 0, 0, 0, 0, 0]);
  const tail = bytesOf(SOS_SEG, [0x11, 0x22, 0x33], [0xff, 0xd9]);
  const plain = bytesOf([0xff, 0xd8], app0, app1, tail);
  assert.deepEqual([...stripMetadata(plain, 'jpeg')], [...bytesOf([0xff, 0xd8], app0, tail)]);

  // Negative control 2: a motion photo. Its appended MP4 is NOT declared by an
  // MPF index, and this module has never claimed to remove it - so the trailer
  // must survive exactly as it did before.
  const mp4 = bytesOf([0, 0, 0, 0x18], 'ftypmp42', [0, 0, 0, 0], 'mp42isom', [1, 2, 3, 4]);
  const motion = bytesOf([0xff, 0xd8], app0, app1, tail, mp4);
  const stripped = stripMetadata(motion, 'jpeg');
  assert.deepEqual([...stripped], [...bytesOf([0xff, 0xd8], app0, tail, mp4)]);
  assert.equal(extractFileMetadata(stripped).appended?.kind, 'video (motion photo)');
});

// ── external oracle: sharp knows nothing about gain maps, which is the point ──

interface SharpImage {
  raw(): SharpImage;
  jpeg(opts?: { quality?: number }): SharpImage;
  greyscale(): SharpImage;
  toBuffer(): Promise<Buffer>;
}
type SharpFactory = ((input: Buffer) => SharpImage) & ((opts: unknown) => SharpImage);

let sharp: SharpFactory | null = null;
try {
  const specifier = 'sharp';
  sharp = ((await import(specifier)) as { default: SharpFactory }).default;
} catch {
  sharp = null;
}
const SKIP_SHARP = sharp ? false : 'sharp is not installed (optional external-decoder oracle)';

test('stripMetadata(jpeg): sharp decodes the stripped gain-map file to the base SDR pixels', { skip: SKIP_SHARP }, async () => {
  const s = sharp!;
  const make = (r: number, g: number, b: number) =>
    s({ create: { width: 16, height: 16, channels: 3, background: { r, g, b } } }).jpeg({ quality: 90 }).toBuffer();
  const baseBuf = await make(200, 40, 90);
  const mapBuf = await make(128, 128, 128);
  const base = new Uint8Array(baseBuf);

  const file = assembleGainMapJpeg(base, new Uint8Array(mapBuf), GM_META);
  const basePixels = await s(baseBuf).raw().toBuffer();

  // The whole premise of the format: a gain-map-unaware decoder sees the SDR base.
  const assembledPixels = await s(Buffer.from(file)).raw().toBuffer();
  assert.deepEqual([...assembledPixels], [...basePixels], 'the assembled file decodes as the SDR base');

  const out = stripMetadata(file, 'jpeg');
  const strippedPixels = await s(Buffer.from(out)).raw().toBuffer();
  assert.deepEqual([...strippedPixels], [...basePixels], 'the stripped file decodes to identical pixels');
  assert.equal(readMpfIndex(out), null);
  assert.equal(extractFileMetadata(out).appended, undefined);
});
