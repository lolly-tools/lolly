// SPDX-License-Identifier: MPL-2.0
// Unit tests for the riskiest bytes in the export path (finding 14): the
// format-native metadata splicers. Pure, DOM-free — driven by known vectors and
// exact byte-layout assertions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crc32, pngChunk, insertPngPhys, insertPngMeta, iTXtChunk,
  buildExifTiff, insertJpegExif, patchJpegDpi, withGifComment, injectSvgMeta,
} from './metadata.ts';
import type { ExportMeta } from '@lolly/engine';

const enc = (s: string) => new TextEncoder().encode(s);
const be32 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(o, false);
const typeOf = (chunk: Uint8Array) => String.fromCharCode(...chunk.subarray(4, 8));

// A minimal-but-well-formed PNG: signature + a 13-byte IHDR chunk. Enough for the
// splicers, which only need the signature + IHDR length to find their insert point.
function minimalPng(): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk('IHDR', new Uint8Array(13));
  const out = new Uint8Array(sig.length + ihdr.length);
  out.set(sig, 0); out.set(ihdr, sig.length);
  return out;
}

const META: ExportMeta = {
  software: 'Lolly', source: 'https://lolly.tools', tool: 'Poster',
  author: 'Ada Lovelace', contact: 'ada@example.com', description: 'A poster',
};

test('crc32 matches the canonical IEND vector', () => {
  assert.equal(crc32(enc('IEND')), 0xAE426082);
});

test('crc32 of the empty buffer is 0', () => {
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('pngChunk lays out [len][type][data][crc] with a correct CRC', () => {
  const chunk = pngChunk('IEND', new Uint8Array(0));
  assert.equal(be32(chunk, 0), 0);                 // data length
  assert.equal(typeOf(chunk), 'IEND');
  assert.equal(be32(chunk, chunk.length - 4), 0xAE426082); // crc over type+data
});

test('insertPngPhys converts dpi→pixels-per-metre and marks unit=metres', () => {
  const png = minimalPng();
  const out = insertPngPhys(png, 300);
  assert.ok(out, 'returns bytes for a valid PNG');
  // pHYs is spliced right after IHDR: sig(8) + IHDR(len 4 + type 4 + data 13 + crc 4 = 25) = 33
  const at = 33;
  const phys = out.subarray(at, at + 21); // 4 len + 4 type + 9 data + 4 crc
  assert.equal(typeOf(phys), 'pHYs');
  assert.equal(be32(phys, 0), 9);                  // pHYs data length
  const ppm = Math.round(300 / 0.0254);
  assert.equal(ppm, 11811);
  assert.equal(be32(phys, 8), ppm);                // X ppm (data starts at byte 8)
  assert.equal(be32(phys, 12), ppm);               // Y ppm
  assert.equal(phys[16], 1);                       // unit specifier: metres
});

test('insertPngPhys returns null for non-PNG input', () => {
  assert.equal(insertPngPhys(enc('not a png at all!'), 300), null);
});

test('iTXtChunk NUL-terminates the keyword then five zero framing bytes', () => {
  const chunk = iTXtChunk('Software', 'Lolly');
  assert.equal(typeOf(chunk), 'iTXt');
  const data = chunk.subarray(8, chunk.length - 4);
  assert.deepEqual(data.subarray(0, 8), enc('Software'));
  // keyword terminator + compression flag + method + lang term + translated term
  assert.deepEqual(Array.from(data.subarray(8, 13)), [0, 0, 0, 0, 0]);
  assert.deepEqual(data.subarray(13), enc('Lolly'));
});

test('insertPngMeta adds one iTXt chunk per non-empty field, after IHDR', () => {
  const out = insertPngMeta(minimalPng(), META);
  const text = new TextDecoder('latin1').decode(out);
  assert.ok(text.includes('iTXt'));
  assert.ok(text.includes('Lolly'));       // Software
  assert.ok(text.includes('Ada Lovelace')); // Author
  assert.ok(text.length > minimalPng().length);
});

test('insertPngMeta is a no-op when meta is undefined', () => {
  const png = minimalPng();
  assert.deepEqual(insertPngMeta(png, undefined), png);
});

test('buildExifTiff writes a little-endian TIFF header + IFD0', () => {
  const tiff = buildExifTiff([{ tag: 0x010E, value: 'hi' }]);
  assert.ok(tiff);
  assert.equal(tiff[0], 0x49); assert.equal(tiff[1], 0x49);  // "II"
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  assert.equal(dv.getUint16(2, true), 0x002A);               // magic 42
  assert.equal(dv.getUint32(4, true), 8);                    // IFD0 offset
  assert.equal(dv.getUint16(8, true), 1);                    // one entry
  assert.equal(dv.getUint16(10, true), 0x010E);              // ImageDescription tag
  assert.equal(dv.getUint16(12, true), 2);                   // type ASCII
});

test('buildExifTiff returns null when no field carries a value', () => {
  assert.equal(buildExifTiff([{ tag: 0x010E, value: '' }]), null);
});

test('insertJpegExif inserts an APP1 Exif segment after the JFIF APP0', () => {
  // FFD8 SOI, FFE0 APP0 len=0x10 "JFIF\0" + 9 bytes of body/padding.
  const jfif = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x00, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9,
  ]);
  const out = insertJpegExif(jfif, META);
  // APP0 spans offset 4 → 4 + 0x10 = 20 ⇒ APP1 is spliced in at offset 20.
  assert.equal(out[20], 0xFF); assert.equal(out[21], 0xE1);
  assert.equal(String.fromCharCode(...out.subarray(24, 28)), 'Exif');
});

test('patchJpegDpi stamps density-unit=inch and X/Y density', () => {
  const jfif = new Uint8Array(18);
  jfif.set([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00], 0);
  const out = patchJpegDpi(jfif, 300);
  assert.equal(out[13], 1);            // units: dpi
  assert.equal((out[14]! << 8) | out[15]!, 300); // Xdensity
  assert.equal((out[16]! << 8) | out[17]!, 300); // Ydensity
});

test('patchJpegDpi is a no-op for dpi<=0', () => {
  const jfif = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
  assert.deepEqual(patchJpegDpi(jfif, 0), jfif);
});

test('withGifComment inserts a 0x21 0xFE extension after the header/LSD', () => {
  // 13-byte header/LSD with no global colour table (packed byte 10 = 0).
  const gif = new Uint8Array(13);
  gif.set(enc('GIF89a'), 0);
  const out = withGifComment(gif, 'made with Lolly');
  assert.equal(out[13], 0x21); assert.equal(out[14], 0xFE); // comment extension
  assert.ok(out.length > gif.length);
});

test('injectSvgMeta splices a metadata block right after the opening <svg>', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
  const out = injectSvgMeta(svg, META);
  assert.ok(out.includes('<title>Poster</title>'));
  assert.ok(out.includes('<dc:creator>Ada Lovelace</dc:creator>'));
  assert.ok(out.indexOf('<metadata>') < out.indexOf('<rect/>')); // before content
});
