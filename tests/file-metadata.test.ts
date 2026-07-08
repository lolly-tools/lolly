/**
 * Embedded-metadata reader tests (the /verify view's "reveal" side).
 * Run with: node --test tests/file-metadata.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFileMetadata } from '../engine/src/file-metadata.ts';

const u16le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
const u16be = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const bytesOf = (...parts: (number[] | string)[]): Uint8Array => {
  const arrs = parts.map((p) => (typeof p === 'string' ? [...new TextEncoder().encode(p)] : p));
  return new Uint8Array(arrs.flat());
};

// A minimal EXIF/TIFF block with a single ASCII IFD0 entry, no Make/Model —
// the shape that used to crash the reader (see below).
function tiffWithSingleAsciiTag(tag: number, value: string): Uint8Array {
  const str = value + '\0';
  return bytesOf(
    'II', u16le(42), u32le(8), // header, IFD0 offset = 8
    u16le(1),                  // 1 entry
    u16le(tag), u16le(2), u32le(str.length), u32le(26), // ASCII entry, value at offset 26
    u32le(0),                  // next IFD = 0
    str,
  );
}

function jpegWithExif(tiff: Uint8Array): Uint8Array {
  const app1payload = bytesOf('Exif\0\0', [...tiff]);
  const app1 = bytesOf([0xff, 0xe1], u16be(app1payload.length + 2), [...app1payload]);
  const app0 = bytesOf([0xff, 0xe0, 0x00, 0x10], 'JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sos = bytesOf([0xff, 0xda], [0, 0x3f, 0], [0xff, 0xd9]);
  return bytesOf([0xff, 0xd8], [...app0], [...app1], [...sos]);
}

test('extractFileMetadata: JPEG EXIF with no Make/Model still yields other fields', () => {
  // Regression: readExif used to call asciiVal() unconditionally for tags
  // 0x010f/0x0110 even when absent from the IFD, throwing inside the reader
  // and (caught by the outer try/catch) silently discarding every field —
  // Artist, Software, GPS, all of it — for any EXIF block without a camera.
  const jpeg = jpegWithExif(tiffWithSingleAsciiTag(0x013b, 'Ada Lovelace')); // Artist
  const meta = extractFileMetadata(jpeg);
  assert.equal(meta.format, 'JPEG');
  const artist = meta.fields.find((f) => f.label === 'Artist');
  assert.ok(artist, 'Artist field should survive a Make/Model-less EXIF block');
  assert.equal(artist!.value, 'Ada Lovelace');
  assert.equal(artist!.sensitive, true);
});

test('extractFileMetadata: JPEG EXIF with a camera Make still reads Camera', () => {
  const jpeg = jpegWithExif(tiffWithSingleAsciiTag(0x010f, 'ACME'));
  const meta = extractFileMetadata(jpeg);
  const camera = meta.fields.find((f) => f.label === 'Camera');
  assert.ok(camera);
  assert.equal(camera!.value, 'ACME');
});

test('extractFileMetadata: unrecognised bytes never throw', () => {
  assert.doesNotThrow(() => extractFileMetadata(new Uint8Array([1, 2, 3])));
  assert.deepEqual(extractFileMetadata(new Uint8Array([1, 2, 3])).fields, []);
});
