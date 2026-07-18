/**
 * Lolly pixel watermark — real-encoder robustness (Phase 1 calibration, now a
 * regression). Runs marked/unmarked content through REAL JPEG/crop/resize via
 * sharp (already a repo devDependency) and asserts the survival envelope the
 * default strength/threshold were tuned for. Self-generated content — needs no
 * external fixtures. Skips cleanly if sharp can't load.
 *
 * Measured envelope (photo-like content, v2 scheme: strength 3.8, 22-coefficient
 * mid-band, activity gate 2.5, threshold 0.035):
 *   survives:  PNG lossless, JPEG q95→q50, 8×8-aligned crop   (scores 0.11–0.53)
 *   does NOT:  arbitrary resize — the 8×8 grid shifts         (documented v1/v2 gap)
 *   unmarked:  stays absent through every transform            (score ≲ 0.02)
 *
 * v2 (2026-07-18) re-calibrated for lower visibility: vs v1 (strength 5.5, 15
 * coefficients, gate 1.5) the imprinted-vs-original PSNR rose ~1–2 dB and smooth-
 * but-not-flat blocks now carry nothing, while the min JPEG-q50 detection score
 * stays ≈ ×3.2 the threshold. A v1-embedded buffer still detects (dual-scheme
 * detector, last test) so pre-v2 `?imprint=1` files keep verifying.
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

// ── v1 backward-compat: a buffer marked with the ORIGINAL v1 scheme (15-coefficient
// mid-band, chip key 0x10111e5c, strength 5.5, activity gate 1.5) must still detect
// under the current dual-scheme detector, so pre-v2 `?imprint=1` files keep
// verifying. This is a self-contained replica of the v1 embedder (the engine no
// longer ships a v1 embed path) — the DETECTOR under test is the real one; only the
// fixture is hand-rolled. The DCT math is identical to the engine's (unchanged in v2).
const V1B = 8, V1BLOCK = 64;
const V1M = (() => {
  const m = new Float64Array(V1BLOCK);
  for (let u = 0; u < V1B; u++) { const a = u === 0 ? Math.sqrt(1 / V1B) : Math.sqrt(2 / V1B); for (let x = 0; x < V1B; x++) m[u * V1B + x] = a * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * V1B)); }
  return m;
})();
function v1dct(b: Float64Array, tmp: Float64Array, out: Float64Array): void {
  for (let y = 0; y < V1B; y++) for (let u = 0; u < V1B; u++) { let s = 0; for (let x = 0; x < V1B; x++) s += V1M[u * V1B + x]! * b[y * V1B + x]!; tmp[y * V1B + u] = s; }
  for (let v = 0; v < V1B; v++) for (let u = 0; u < V1B; u++) { let s = 0; for (let y = 0; y < V1B; y++) s += V1M[v * V1B + y]! * tmp[y * V1B + u]!; out[v * V1B + u] = s; }
}
function v1idct(c: Float64Array, tmp: Float64Array, out: Float64Array): void {
  for (let y = 0; y < V1B; y++) for (let u = 0; u < V1B; u++) { let s = 0; for (let v = 0; v < V1B; v++) s += V1M[v * V1B + y]! * c[v * V1B + u]!; tmp[y * V1B + u] = s; }
  for (let y = 0; y < V1B; y++) for (let x = 0; x < V1B; x++) { let s = 0; for (let u = 0; u < V1B; u++) s += V1M[u * V1B + x]! * tmp[y * V1B + u]!; out[y * V1B + x] = s; }
}
function v1rng(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const V1_MIDBAND = [3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40];
const V1_CHIP = (() => { const r = v1rng(0x10_11_1e_5c); return V1_MIDBAND.map(() => (r() < 0.5 ? -1 : 1)); })();
function embedV1(rgba: Uint8Array, w: number, h: number, strength = 5.5): Uint8Array {
  const bw = Math.floor(w / V1B), bh = Math.floor(h / V1B);
  const Y = new Float64Array(w * h);
  for (let i = 0, p = 0; i < Y.length; i++, p += 4) Y[i] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  const block = new Float64Array(V1BLOCK), tmp = new Float64Array(V1BLOCK), coef = new Float64Array(V1BLOCK), marked = new Float64Array(V1BLOCK);
  const out = new Uint8Array(rgba.length); out.set(rgba);
  const clamp = (v: number): number => { const r = Math.round(v); return r < 0 ? 0 : r > 255 ? 255 : r; };
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const ox = bx * V1B, oy = by * V1B;
    for (let y = 0; y < V1B; y++) for (let x = 0; x < V1B; x++) block[y * V1B + x] = Y[(oy + y) * w + (ox + x)]!;
    v1dct(block, tmp, coef);
    let acE = 0; for (let i = 1; i < V1BLOCK; i++) acE += coef[i]! * coef[i]!;
    const activity = Math.sqrt(acE / (V1BLOCK - 1));
    if (activity < 1.5) continue;                              // v1 ACTIVITY_FLOOR
    const m = activity / 9; const mask = m < 0.35 ? 0.35 : m > 2.5 ? 2.5 : m; // v1 MASK_MIN/MAX/REF
    for (let k = 0; k < V1_MIDBAND.length; k++) coef[V1_MIDBAND[k]!]! += strength * V1_CHIP[k]! * mask;
    v1idct(coef, tmp, marked);
    for (let y = 0; y < V1B; y++) for (let x = 0; x < V1B; x++) {
      const d = marked[y * V1B + x]! - block[y * V1B + x]!, p = ((oy + y) * w + (ox + x)) * 4;
      out[p] = clamp(rgba[p]! + d); out[p + 1] = clamp(rgba[p + 1]! + d); out[p + 2] = clamp(rgba[p + 2]! + d);
    }
  }
  return out;
}

test('a v1-embedded buffer still detects under the current (v2) dual-scheme detector', { skip }, async () => {
  const size = 512;
  const orig: Img = { data: photoLike(size, size, 512), width: size, height: size };
  const v1marked: Img = { data: embedV1(orig.data, size, size), width: size, height: size };
  // Sanity: this really is a v1 fixture, not a v2 one — the plain (v2) embedder
  // would produce a different buffer; the point is the OLD scheme still reads back.
  assert.notDeepEqual(v1marked.data, embedWatermark(orig.data, { width: size, height: size }));
  // The unmarked original must stay absent; the v1-marked buffer must detect.
  assert.equal(det(orig).present, false, `unmarked should be absent (score ${det(orig).score.toFixed(4)})`);
  const lossless = det(v1marked);
  assert.ok(lossless.present, `v1 mark should detect losslessly (score ${lossless.score.toFixed(4)})`);
  // …and survive a real JPEG re-encode, exactly like the v2 mark does.
  for (const q of [95, 70]) {
    const r = det(await jpeg(v1marked, q));
    assert.ok(r.present, `v1 mark should survive JPEG q${q} under the v2 detector (score ${r.score.toFixed(4)})`);
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
