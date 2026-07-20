/**
 * Lolly pixel watermark — synthetic round-trip tests (no image codec; pure RGBA
 * buffers). Robustness against real JPEG/resize/crop lives in the separate
 * sharp-based suite, tests/pixel-watermark-robustness.test.ts.
 * Run with: node --test tests/pixel-watermark.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  embedWatermark, detectWatermark, canCarryWatermark, DETECT_THRESHOLD, MIN_IMPRINT_BLOCKS,
} from '../engine/src/pixel-watermark.ts';

// A deterministic textured RGBA buffer — a smooth gradient plus per-pixel white
// noise. NON-periodic on purpose: a regular pattern (e.g. a fixed checker) puts a
// consistent signature in the mid-band that biases the unmarked baseline away
// from zero, which real photographic content does not do. White noise keeps every
// block above the flat-block gate while staying uncorrelated with the chip, so an
// unmarked score sits ≈ 0 — matching the real-image calibration.
function texture(w: number, h: number, seed = 1): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  let a = seed >>> 0;
  const rnd = (): number => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const base = (x * 160) / w + (y * 60) / h;
      const noise = (rnd() - 0.5) * 40;
      const v = Math.max(0, Math.min(255, 60 + base + noise));
      px[p] = v; px[p + 1] = Math.max(0, Math.min(255, v * 0.8 + 20));
      px[p + 2] = Math.max(0, Math.min(255, 255 - v)); px[p + 3] = 255;
    }
  }
  return px;
}

function psnr(a: Uint8Array, b: Uint8Array): number {
  let sse = 0, n = 0;
  for (let p = 0; p < a.length; p += 4) for (let c = 0; c < 3; c++) { const d = a[p + c]! - b[p + c]!; sse += d * d; n++; }
  if (sse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / (sse / n));
}

test('embed → detect round-trips with a clear positive score', () => {
  const w = 256, h = 256;
  const orig = texture(w, h);
  const marked = embedWatermark(orig, { width: w, height: h });

  const before = detectWatermark(orig, { width: w, height: h });
  const after = detectWatermark(marked, { width: w, height: h });

  assert.equal(before.present, false, `unmarked score ${before.score} should be below threshold`);
  assert.equal(after.present, true, `marked score ${after.score} should clear ${DETECT_THRESHOLD}`);
  assert.ok(after.score > before.score + 0.05, `marked (${after.score}) should clearly beat unmarked (${before.score})`);
  // Textured content: (nearly) every 8×8 block clears the flat-block gate.
  assert.ok(after.blocks >= 0.95 * 32 * 32, `scanned ${after.blocks} of 1024 blocks`);
});

test('embed stays visually lossless (PSNR ≥ 40 dB) on textured content', () => {
  const w = 256, h = 256;
  const orig = texture(w, h);
  const marked = embedWatermark(orig, { width: w, height: h });
  const p = psnr(orig, marked);
  assert.ok(p >= 40, `PSNR ${p.toFixed(1)} dB should be ≥ 40`);
});

test('flat buffer: stays near-clean AND is not a false positive', () => {
  const w = 128, h = 128;
  const flat = new Uint8Array(w * h * 4).fill(200);
  for (let p = 3; p < flat.length; p += 4) flat[p] = 255; // opaque
  const marked = embedWatermark(flat, { width: w, height: h });
  // Perceptual mask floors flat blocks, so the change is tiny (high PSNR)…
  assert.ok(psnr(flat, marked) >= 48, 'flat regions should be barely touched');
  // …and an unmarked flat field must never read as watermarked.
  assert.equal(detectWatermark(flat, { width: w, height: h }).present, false);
});

test('unmarked textured images are not false positives across many seeds', () => {
  const w = 256, h = 256;
  let positives = 0;
  for (let s = 1; s <= 20; s++) {
    const noise = texture(w, h, s * 7919);
    if (detectWatermark(noise, { width: w, height: h }).present) positives++;
  }
  assert.equal(positives, 0, `expected 0 false positives over 20 unmarked images, got ${positives}`);
});

test('small images demand a higher score (size-adjusted threshold) — no small-image false positives', () => {
  // The null correlation is wider on few-block images; the σ-floor must keep them clean.
  let positives = 0;
  for (let s = 1; s <= 30; s++) {
    const noise = texture(96, 96, s * 104729);
    if (detectWatermark(noise, { width: 96, height: 96 }).present) positives++;
  }
  assert.equal(positives, 0, `expected 0 false positives over 30 small unmarked images, got ${positives}`);
});

test('images smaller than one 8×8 block are a no-op (returned unchanged, absent)', () => {
  const w = 5, h = 5;
  const tiny = texture(w, h);
  const marked = embedWatermark(tiny, { width: w, height: h });
  assert.deepEqual(marked, tiny);
  const d = detectWatermark(tiny, { width: w, height: h });
  assert.equal(d.present, false);
  assert.equal(d.blocks, 0);
});

// ── canCarryWatermark — the imprint-on-embed size floor ──────────────────────
// The PDF/PPTX embed chokepoints (shells/web/src/bridge/export*.ts) gate every
// Lolly-rendered raster on this before imprinting, so a tiny gradient chip or icon
// isn't marked with a signal it could never carry durably.

test('canCarryWatermark: the boolean is exactly floor(w/8)·floor(h/8) ≥ MIN_IMPRINT_BLOCKS', () => {
  // Independent recomputation of the block count — never calls the same code path.
  const blocks = (w: number, h: number): number => Math.floor(w / 8) * Math.floor(h / 8);
  for (const [w, h] of [[64, 64], [232, 232], [239, 239], [240, 240], [248, 248], [1280, 720], [100, 1600], [300, 50]] as const) {
    assert.equal(canCarryWatermark(w, h), blocks(w, h) >= MIN_IMPRINT_BLOCKS, `${w}×${h} (${blocks(w, h)} blocks vs floor ${MIN_IMPRINT_BLOCKS})`);
  }
});

test('canCarryWatermark: the embed floor stays at the ~195px crossover (decoupled from detection)', () => {
  // The embed-size floor is derived from MIN_IMPRINT_THRESHOLD (0.035), NOT the
  // detection floor — DETECT_THRESHOLD was raised 0.035→0.06 to reject the HDR
  // false positive, but that must not change which images we imprint. So the
  // ~594-block / ~195² crossover holds regardless. Pin it so a future band/embed
  // retune (not a detection retune) updates the copy.
  assert.ok(MIN_IMPRINT_BLOCKS >= 550 && MIN_IMPRINT_BLOCKS <= 650, `MIN_IMPRINT_BLOCKS ${MIN_IMPRINT_BLOCKS} should be ~594 (a ~195² image)`);
  assert.equal(canCarryWatermark(240, 240), true, '240² (900 blocks) clears the floor');
  assert.equal(canCarryWatermark(200, 200), true, '200² (625 blocks) clears the floor');
  assert.equal(canCarryWatermark(192, 192), false, '192² (576 blocks) is below the floor');
});

test('canCarryWatermark: rejects sub-block and tiny-icon rasters', () => {
  assert.equal(canCarryWatermark(5, 5), false, 'smaller than one 8×8 block');
  assert.equal(canCarryWatermark(64, 64), false, 'a typical icon is too small');
  assert.equal(canCarryWatermark(0, 0), false);
});

test('canCarryWatermark: an ACCEPTED size genuinely round-trips a detectable mark', () => {
  // Ties the floor to real engine behaviour (not just its own formula): the
  // smallest accepted square must actually carry a mark the detector reads back.
  const s = 240;                                   // just over the floor (900 ≥ ~871)
  assert.equal(canCarryWatermark(s, s), true);
  const orig = texture(s, s);
  const marked = embedWatermark(orig, { width: s, height: s });
  const after = detectWatermark(marked, { width: s, height: s });
  assert.equal(after.present, true, `marked ${s}² score ${after.score} should clear the size-adjusted threshold`);
  assert.equal(detectWatermark(orig, { width: s, height: s }).present, false, 'unmarked must stay clean');
});

test('detection survives a hard center crop (spread-spectrum redundancy)', () => {
  const w = 512, h = 512;
  const marked = embedWatermark(texture(w, h), { width: w, height: h });
  // Crop the center 256×256 on the 8×8 grid (offset multiple of 8 keeps blocks aligned).
  const cw = 256, ch = 256, ox = 128, oy = 128;
  const crop = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const src = ((oy + y) * w + ox) * 4;
    crop.set(marked.subarray(src, src + cw * 4), y * cw * 4);
  }
  assert.equal(detectWatermark(crop, { width: cw, height: ch }).present, true);
});
