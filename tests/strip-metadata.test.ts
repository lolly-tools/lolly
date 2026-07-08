/**
 * Metadata-stripping tests — lossless clean-copy byte surgery (mirrors the
 * strip-data tool's hook logic; see engine/src/strip-metadata.ts).
 * Run with: node --test tests/strip-metadata.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stripMetadata, isStrippableFormat } from '../engine/src/strip-metadata.ts';

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
    return bytesOf(lenBytes, type, data, [0, 0, 0, 0]); // fake CRC — never validated
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
