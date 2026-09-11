// SPDX-License-Identifier: MPL-2.0
/**
 * depthHint (lib/image-sample.ts) - bit-depth header sniff over hand-built
 * fixture bytes. Reference values are the specs themselves: PNG 3rd ed section 11.2.1
 * puts the IHDR bit-depth byte at datastream offset 24; TIFF 6.0 tag 258
 * (BitsPerSample, SHORT) in the first IFD; ITU-T T.81 section B.2.2 puts the JPEG
 * sample precision as the first byte of the SOFn payload.
 *
 * Run: node --import ./tests/css-stub.mjs --test "shells/web/src/**\/*.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depthHint } from './image-sample.ts';

// ── fixture builders ─────────────────────────────────────────────────────────

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const u32be = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const u16le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
const u32le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
const u16be = (n: number): Uint8Array => Uint8Array.of((n >>> 8) & 0xff, n & 0xff);

const PNG_SIG = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

/** Minimal PNG head: signature + IHDR with the given bit depth (CRC not needed - 
 * the sniff stops at byte 24, exactly where the spec puts bit depth). */
function pngHead(bitDepth: number): Uint8Array {
  const ihdrData = concat([
    u32be(1), u32be(1),                       // width, height
    Uint8Array.of(bitDepth, 0, 0, 0, 0),      // bit depth, colour type, comp, filter, interlace
  ]);
  return concat([PNG_SIG, u32be(13), bytesOf('IHDR'), ihdrData, u32be(0) /* fake CRC */]);
}

/** Minimal single-IFD TIFF declaring BitsPerSample. count ≤ 2 stores the value
 * inline; count > 2 stores it at an offset past the IFD (per TIFF 6.0 IFD rules). */
function tiffFile(le: boolean, bits: number, samples = 1): Uint8Array {
  const u16 = le ? u16le : u16be;
  const u32 = le ? u32le : u32be;
  const header = concat([le ? bytesOf('II') : bytesOf('MM'), u16(42), u32(8)]); // IFD0 at 8
  const inline = samples <= 2;
  // IFD: count(2) + one entry(12) + next-IFD(4) = 18 bytes → values land at 8+18=26.
  const valueField = inline ? concat([u16(bits), u16(0)]) : u32(26);
  const entry = concat([u16(258), u16(3), u32(samples), valueField]);
  const ifd = concat([u16(1), entry, u32(0)]);
  const tail = inline ? new Uint8Array(0) : concat(Array.from({ length: samples }, () => u16(bits)));
  return concat([header, ifd, tail]);
}

/** JPEG head: SOI + SOF0 with the given precision byte (ITU-T T.81 section B.2.2: Lf, P, Y, X, Nf...). */
function jpegHead(precision: number): Uint8Array {
  const sofPayload = Uint8Array.of(precision, 0, 1, 0, 1, 1, 0x11, 0, 0); // P, Y, X, Nf=1, comp spec
  return concat([
    Uint8Array.of(0xff, 0xd8),                                     // SOI
    Uint8Array.of(0xff, 0xe0, 0x00, 0x10), bytesOf('JFIF\0'), Uint8Array.of(1, 1, 0, 0, 1, 0, 1, 0, 0), // APP0
    Uint8Array.of(0xff, 0xc0), u16be(2 + sofPayload.length), sofPayload, // SOF0
  ]);
}

const webpFile = (): Uint8Array => {
  const body = concat([bytesOf('WEBP'), bytesOf('VP8 '), u32le(2), Uint8Array.of(0, 0)]);
  return concat([bytesOf('RIFF'), u32le(body.length), body]);
};

/** ISOBMFF ftyp box with the given major brand (+ optional compatibles). */
function ftypFile(major: string, compatibles: string[] = []): Uint8Array {
  const brands = concat([bytesOf(major), u32be(0), ...compatibles.map(bytesOf)]);
  return concat([u32be(8 + brands.length), bytesOf('ftyp'), brands, new Uint8Array(16)]);
}

// ── the sniff, against the reference layouts ─────────────────────────────────

test('depthHint: 16-bit PNG IHDR reads byte 24 of the datastream', async () => {
  assert.deepEqual(await depthHint(pngHead(16)), { bitsPerChannel: 16, source: 'png' });
});

test('depthHint: 8-bit PNG is the negative control - never reported deep', async () => {
  assert.deepEqual(await depthHint(pngHead(8)), { bitsPerChannel: 8, source: 'png' });
});

test('depthHint: PNG with an illegal depth byte answers null, not a lie', async () => {
  // 3 is not a legal PNG bit depth (section 11.2.1 allows 1/2/4/8/16).
  assert.deepEqual(await depthHint(pngHead(3)), { bitsPerChannel: null, source: 'png' });
});

test('depthHint: 16-bit TIFF, little-endian, inline value', async () => {
  assert.deepEqual(await depthHint(tiffFile(true, 16)), { bitsPerChannel: 16, source: 'tiff' });
});

test('depthHint: 16-bit TIFF, big-endian, inline value', async () => {
  assert.deepEqual(await depthHint(tiffFile(false, 16)), { bitsPerChannel: 16, source: 'tiff' });
});

test('depthHint: RGB TIFF (count 3) follows the value offset', async () => {
  assert.deepEqual(await depthHint(tiffFile(true, 16, 3)), { bitsPerChannel: 16, source: 'tiff' });
  assert.deepEqual(await depthHint(tiffFile(false, 8, 3)), { bitsPerChannel: 8, source: 'tiff' });
});

test('depthHint: JPEG reports the SOF precision byte; 8 without one', async () => {
  assert.deepEqual(await depthHint(jpegHead(8)), { bitsPerChannel: 8, source: 'jpeg' });
  assert.deepEqual(await depthHint(jpegHead(12)), { bitsPerChannel: 12, source: 'jpeg' });
  // SOI + EOI and no frame header - baseline 8 is the honest default.
  assert.deepEqual(await depthHint(Uint8Array.of(0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0)), { bitsPerChannel: 8, source: 'jpeg' });
});

test('depthHint: WebP is 8-bit by format definition', async () => {
  assert.deepEqual(await depthHint(webpFile()), { bitsPerChannel: 8, source: 'webp' });
});

test('depthHint: HEIC/AVIF are recognised but honestly depth-unknown', async () => {
  assert.deepEqual(await depthHint(ftypFile('heic')), { bitsPerChannel: null, source: 'heic' });
  assert.deepEqual(await depthHint(ftypFile('avif')), { bitsPerChannel: null, source: 'avif' });
  // AVIF commonly ships major 'mif1' with 'avif' in the compatibles - AVIF wins.
  assert.deepEqual(await depthHint(ftypFile('mif1', ['miaf', 'avif'])), { bitsPerChannel: null, source: 'avif' });
  // An mp4's ftyp is neither.
  assert.deepEqual(await depthHint(ftypFile('isom', ['mp42'])), { bitsPerChannel: null, source: null });
});

test('depthHint: accepts a Blob as well as bytes', async () => {
  assert.deepEqual(await depthHint(new Blob([pngHead(16) as BlobPart])), { bitsPerChannel: 16, source: 'png' });
  assert.deepEqual(await depthHint(new Blob([tiffFile(true, 16, 3) as BlobPart])), { bitsPerChannel: 16, source: 'tiff' });
});

// ── hostile / truncated inputs: bounded reads, nulls, never a throw ──────────

test('depthHint: truncated and hostile inputs answer null and never throw', async () => {
  assert.deepEqual(await depthHint(new Uint8Array(0)), { bitsPerChannel: null, source: null });
  assert.deepEqual(await depthHint(Uint8Array.of(1, 2, 3)), { bitsPerChannel: null, source: null });
  // PNG signature only - container recognised, but no IHDR to read a depth from.
  assert.deepEqual(await depthHint(PNG_SIG), { bitsPerChannel: null, source: 'png' });
  // PNG signature + garbage where IHDR should be.
  assert.deepEqual(
    await depthHint(concat([PNG_SIG, u32be(13), bytesOf('JUNK'), new Uint8Array(17)])),
    { bitsPerChannel: null, source: 'png' },
  );
  // Random noise.
  const noise = Uint8Array.from({ length: 512 }, (_, i) => (i * 37 + 11) & 0xff);
  assert.deepEqual(await depthHint(noise), { bitsPerChannel: null, source: null });
});

test('depthHint: TIFF with a lying IFD offset or truncated IFD answers null', async () => {
  // IFD offset points far past EOF.
  const past = concat([bytesOf('II'), u16le(42), u32le(0xffff_fff0)]);
  assert.deepEqual(await depthHint(past), { bitsPerChannel: null, source: 'tiff' });
  // Entry count claims 500 entries but the file ends after the count.
  const trunc = concat([bytesOf('II'), u16le(42), u32le(8), u16le(500)]);
  assert.deepEqual(await depthHint(trunc), { bitsPerChannel: null, source: 'tiff' });
  // BitsPerSample value offset (count 3 → offset form) points past EOF.
  const badOff = concat([
    bytesOf('II'), u16le(42), u32le(8),
    u16le(1), u16le(258), u16le(3), u32le(3), u32le(0xffff_fff0), u32le(0),
  ]);
  assert.deepEqual(await depthHint(badOff), { bitsPerChannel: null, source: 'tiff' });
  // No BitsPerSample tag at all - stay agnostic rather than guess.
  const noTag = concat([
    bytesOf('II'), u16le(42), u32le(8),
    u16le(1), u16le(256), u16le(3), u32le(1), u32le(1), u32le(0), // ImageWidth only
  ]);
  assert.deepEqual(await depthHint(noTag), { bitsPerChannel: null, source: 'tiff' });
});

test('depthHint: JPEG with a zero-length segment cannot loop', async () => {
  const evil = concat([Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00), new Uint8Array(64)]);
  assert.deepEqual(await depthHint(evil), { bitsPerChannel: 8, source: 'jpeg' });
});
