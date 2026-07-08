/**
 * Lolly pixel watermark — real-encoder robustness (Phase 1 calibration, now a
 * regression). Runs marked/unmarked content through REAL JPEG/crop/resize via
 * sharp (already a repo devDependency) and asserts the survival envelope the
 * default strength/threshold were tuned for. Self-generated content — needs no
 * external fixtures. Skips cleanly if sharp can't load.
 *
 * Measured envelope (photo-like content, strength 5.5, threshold 0.035):
 *   survives:  PNG lossless, JPEG q95→q50, 8×8-aligned crop   (scores 0.17–0.66)
 *   does NOT:  arbitrary resize — the 8×8 grid shifts         (documented v1 gap)
 *   unmarked:  stays absent through every transform            (score ≈ 0)
 *
 * Run with: node --test tests/pixel-watermark-robustness.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embedWatermark, detectWatermark } from '../engine/src/pixel-watermark.ts';

let sharp: (typeof import('sharp'))['default'] | undefined;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }
const skip = sharp ? false : 'sharp not available';

interface Img { data: Uint8Array; width: number; height: number }

// Multi-scale "photo-like" content — smooth low-frequency blobs + mid-frequency
// ripples + mild grain, so real JPEG behaves as it would on a photograph
// (unlike flat or purely periodic synthetic fills).
function photoLike(w: number, h: number, seed = 1): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  let a = seed >>> 0;
  const rnd = (): number => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    const lo = 90 + 60 * Math.sin((x / w) * 3 + ph[0]!) + 50 * Math.cos((y / h) * 2.3 + ph[1]!);
    const mid = 25 * Math.sin((x + y) / 18 + ph[2]!) + 20 * Math.cos((x - y) / 13 + ph[3]!);
    const v = Math.max(0, Math.min(255, lo + mid + (rnd() - 0.5) * 14));
    px[p] = v; px[p + 1] = Math.max(0, Math.min(255, v * 0.85 + 18));
    px[p + 2] = Math.max(0, Math.min(255, 235 - v * 0.7)); px[p + 3] = 255;
  }
  return px;
}

async function toRaw(buf: Buffer): Promise<Img> {
  const { data, info } = await sharp!(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}
const rawPipe = (i: Img) => sharp!(Buffer.from(i.data), { raw: { width: i.width, height: i.height, channels: 4 } });
const jpeg = async (i: Img, q: number): Promise<Img> => toRaw(await rawPipe(i).jpeg({ quality: q }).toBuffer());
async function crop8(i: Img, frac: number): Promise<Img> {
  const cw = Math.round((i.width * frac) / 8) * 8, ch = Math.round((i.height * frac) / 8) * 8;
  const left = Math.round((i.width - cw) / 16) * 8, top = Math.round((i.height - ch) / 16) * 8;
  return toRaw(await rawPipe(i).extract({ left, top, width: cw, height: ch }).png().toBuffer());
}
const resize = async (i: Img, s: number): Promise<Img> =>
  toRaw(await rawPipe(i).resize(Math.round(i.width * s), Math.round(i.height * s)).png().toBuffer());
const det = (i: Img) => detectWatermark(i.data, { width: i.width, height: i.height });

test('marked content survives JPEG q95→q50 and an 8px-aligned crop', { skip }, async () => {
  for (const size of [512, 384]) {
    const orig: Img = { data: photoLike(size, size, size), width: size, height: size };
    const marked: Img = { data: embedWatermark(orig.data, { width: size, height: size }), width: size, height: size };

    for (const q of [95, 85, 70, 50]) {
      const r = det(await jpeg(marked, q));
      assert.ok(r.present, `${size}px marked should survive JPEG q${q} (score ${r.score.toFixed(4)})`);
    }
    const cropped = det(await crop8(marked, 0.6));
    assert.ok(cropped.present, `${size}px marked should survive a 60% crop (score ${cropped.score.toFixed(4)})`);
  }
});

test('unmarked content is never a false positive through any transform', { skip }, async () => {
  for (const size of [512, 384]) {
    const orig: Img = { data: photoLike(size, size, size + 7), width: size, height: size };
    for (const t of [
      det(orig),
      det(await jpeg(orig, 95)), det(await jpeg(orig, 70)), det(await jpeg(orig, 50)),
      det(await crop8(orig, 0.6)), det(await resize(orig, 0.75)), det(await resize(orig, 1.5)),
    ]) {
      assert.equal(t.present, false, `unmarked ${size}px should stay absent (score ${t.score.toFixed(4)})`);
    }
  }
});

test('resize is a documented v1 blind spot — the mark is not detected after rescale', { skip }, async () => {
  // The 8×8 grid shifts under resampling, so the mid-band no longer lines up with
  // the chip. This is expected; if a future resize-normalization step lands, this
  // assertion should be updated to expect survival.
  const size = 512;
  const marked: Img = { data: embedWatermark(photoLike(size, size, 42), { width: size, height: size }), width: size, height: size };
  assert.equal(det(await resize(marked, 0.75)).present, false, 'downscale should evade v1 detection');
  assert.equal(det(await resize(marked, 1.5)).present, false, 'upscale should evade v1 detection');
});
