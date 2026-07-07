/**
 * media-sniff contract tests — animated-raster + video-container detection.
 * Run with: node --test tests/media-sniff.test.ts
 *
 * Builds minimal but structurally-real containers (no valid CRCs needed — the
 * sniffer walks structure, not checksums) so assertions run against the same
 * byte layout a real encoder would emit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sniffAnimatedRaster, sniffVideoContainer } from '../engine/src/media-sniff.ts';

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
