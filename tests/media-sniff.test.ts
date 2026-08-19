// SPDX-License-Identifier: MPL-2.0
/**
 * media-sniff contract tests - animated-raster + video-container detection.
 * Run with: node --test tests/media-sniff.test.ts
 *
 * Builds minimal but structurally-real containers (no valid CRCs needed - the
 * sniffer walks structure, not checksums) so assertions run against the same
 * byte layout a real encoder would emit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sniffAnimatedRaster, sniffVideoContainer, sniffContainer } from '../engine/src/media-sniff.ts';

// ── GIF ──────────────────────────────────────────────────────────────────────
// "GIF89a" + 7-byte Logical Screen Descriptor (no global colour table) + `frames`
// image descriptors (each: separator, 9-byte descriptor, LZW min code, one empty
// data sub-block run) + trailer.
function gif(frames: number): Uint8Array {
  const out: number[] = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // GIF89a
  out.push(1, 0, 1, 0, 0x00, 0, 0);                            // LSD, packed=0 (no GCT)
  for (let i = 0; i < frames; i++) {
    out.push(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00);              // image descriptor (packed=0)
    out.push(0x02);                                            // LZW minimum code size
    out.push(0x01, 0x00, 0x00);                                // one 1-byte sub-block, then terminator
  }
  out.push(0x3b);                                              // trailer
  return Uint8Array.from(out);
}

test('animated GIF (2 frames) is detected', () => {
  assert.equal(sniffAnimatedRaster(gif(2)), 'gif');
});

test('single-frame GIF is NOT flagged animated', () => {
  assert.equal(sniffAnimatedRaster(gif(1)), null);
});

// ── PNG / APNG ────────────────────────────────────────────────────────────────
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function chunk(type: string, dataLen = 0): number[] {
  const len = [(dataLen >>> 24) & 0xff, (dataLen >>> 16) & 0xff, (dataLen >>> 8) & 0xff, dataLen & 0xff];
  const t = [...type].map(c => c.charCodeAt(0));
  return [...len, ...t, ...new Array(dataLen).fill(0), 0, 0, 0, 0 /* crc */];
}
function png({ apng }: { apng: boolean }): Uint8Array {
  const out = [...PNG_SIG, ...chunk('IHDR', 13)];
  if (apng) out.push(...chunk('acTL', 8));
  out.push(...chunk('IDAT', 4), ...chunk('IEND'));
  return Uint8Array.from(out);
}

test('APNG (acTL before IDAT) is detected', () => {
  assert.equal(sniffAnimatedRaster(png({ apng: true }), { mime: 'image/png' }), 'apng');
});

test('still PNG (no acTL) is NOT flagged animated', () => {
  assert.equal(sniffAnimatedRaster(png({ apng: false }), { mime: 'image/png' }), null);
});

// ── WebP ────────────────────────────────────────────────────────────────────
function webp({ anim }: { anim: boolean }): Uint8Array {
  const riff = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]; // RIFF....WEBP
  if (anim) {
    // VP8X chunk: fourcc + size(10) + flags byte (0x02 = animation) + 9 more bytes.
    return Uint8Array.from([...riff, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }
  // Plain lossy: VP8 (space) chunk.
  return Uint8Array.from([...riff, 0x56, 0x50, 0x38, 0x20, 4, 0, 0, 0, 0, 0, 0, 0]);
}

test('animated WebP (VP8X anim flag) is detected', () => {
  assert.equal(sniffAnimatedRaster(webp({ anim: true }), { mime: 'image/webp' }), 'webp');
});

test('still WebP is NOT flagged animated', () => {
  assert.equal(sniffAnimatedRaster(webp({ anim: false }), { mime: 'image/webp' }), null);
});

// ── non-animatable / junk ─────────────────────────────────────────────────────
test('a JPEG header returns null (not an animatable raster)', () => {
  assert.equal(sniffAnimatedRaster(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), null);
});

test('empty input returns null and does not throw', () => {
  assert.equal(sniffAnimatedRaster(new Uint8Array(0)), null);
});

// ── video containers ──────────────────────────────────────────────────────────
test('MP4 (ftyp box) is recognised', () => {
  const mp4 = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]); // ....ftyp mp42
  assert.equal(sniffVideoContainer(mp4), 'mp4');
});

test('WebM (EBML magic) is recognised', () => {
  const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
  assert.equal(sniffVideoContainer(webm), 'webm');
});

test('a PNG is not mistaken for a video container', () => {
  assert.equal(sniffVideoContainer(png({ apng: false })), null);
});

test('AVIF/HEIC share MP4\'s ftyp box but are IMAGES, not videos', () => {
  const ftyp = (major: string, ...compat: string[]): Uint8Array => {
    const brands = [major, '\0\0\0\0', ...compat]; // minor_version slot after the major brand
    const size = 8 + brands.length * 4;
    const out = new Uint8Array(size);
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = size;
    out.set([0x66, 0x74, 0x79, 0x70], 4); // 'ftyp'
    brands.forEach((b, i) => { for (let c = 0; c < 4; c++) out[8 + i * 4 + c] = b.charCodeAt(c) || 0; });
    return out;
  };
  // Major brand says image - a still AVIF, a HEIC photo, an AVIF sequence.
  assert.equal(sniffVideoContainer(ftyp('avif', 'mif1', 'miaf')), null);
  assert.equal(sniffVideoContainer(ftyp('heic', 'mif1', 'heix')), null);
  assert.equal(sniffVideoContainer(ftyp('avis', 'avif', 'msf1')), null);
  // Generic HEIF major with the image brand in the compatibles (real AVIFs ship this way).
  assert.equal(sniffVideoContainer(ftyp('mif1', 'avif')), null);
  // Real movies keep matching: no image brand anywhere in the box.
  assert.equal(sniffVideoContainer(ftyp('isom', 'iso2', 'mp41')), 'mp4');
  assert.equal(sniffVideoContainer(ftyp('mp42', 'isom')), 'mp4');
  assert.equal(sniffVideoContainer(ftyp('qt  ')), 'mp4');
});

// ── sniffContainer: BMP / gzip / fonts ─────────────────────────────────────────
test('BMP is detected only with a full 54-byte header (a stray "BM" is not)', () => {
  const bmp = new Uint8Array(54); bmp[0] = 0x42; bmp[1] = 0x4d;   // 'BM' + full header
  assert.equal(sniffContainer(bmp), 'bmp');
  assert.equal(sniffContainer(Uint8Array.from([0x42, 0x4d, 0, 0])), null); // too short
});

test('a gzip stream is reported (never inflated) — the .svgz wrapper', () => {
  assert.equal(sniffContainer(Uint8Array.from([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0])), 'gzip');
});

test('a zip is detected by its PK magic (local header and empty-archive EOCD)', () => {
  const pad = (b: number[]) => Uint8Array.from([...b, 0, 0, 0, 0]);
  assert.equal(sniffContainer(pad([0x50, 0x4b, 0x03, 0x04])), 'zip'); // 'PK\x03\x04' local file header
  assert.equal(sniffContainer(pad([0x50, 0x4b, 0x05, 0x06])), 'zip'); // 'PK\x05\x06' empty-archive EOCD
  // GENERIC verdict: an OOXML/OCF package (PK magic too) also sniffs as 'zip' - 
  // the ingest path must disambiguate before exploding it as a plain archive.
  assert.equal(sniffContainer(pad([0x50, 0x4b, 0x03, 0x04])), 'zip');
});

test('a USTAR tar is detected by its magic at offset 257 (full header block)', () => {
  const tar = new Uint8Array(512);
  tar.set([0x75, 0x73, 0x74, 0x61, 0x72], 257); // 'ustar'
  assert.equal(sniffContainer(tar), 'tar');
  // The magic sits deep in the header - a short buffer must not false-positive.
  const short = new Uint8Array(300);
  short.set([0x75, 0x73, 0x74, 0x61, 0x72], 257);
  assert.equal(sniffContainer(short), null);
});

test('the four font containers are detected by sfnt/WOFF magic', () => {
  const magic = (b: number[]) => Uint8Array.from([...b, 0, 0, 0, 0]);
  assert.equal(sniffContainer(magic([0x00, 0x01, 0x00, 0x00])), 'ttf');  // TrueType
  assert.equal(sniffContainer(magic([0x74, 0x72, 0x75, 0x65])), 'ttf');  // 'true'
  assert.equal(sniffContainer(magic([0x4f, 0x54, 0x54, 0x4f])), 'otf');  // 'OTTO'
  assert.equal(sniffContainer(magic([0x77, 0x4f, 0x46, 0x46])), 'woff'); // 'wOFF'
  assert.equal(sniffContainer(magic([0x77, 0x4f, 0x46, 0x32])), 'woff2');// 'wOF2'
});

test('sniffContainer returns null for unrelated bytes (PNG, empty)', () => {
  assert.equal(sniffContainer(png({ apng: false })), null);
  assert.equal(sniffContainer(new Uint8Array(0)), null);
});
