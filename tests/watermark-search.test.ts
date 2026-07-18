/**
 * Lolly pixel watermark — multi-scale + offset recovery search (Path A).
 *
 * Proves the two things the search has to earn, against INDEPENDENT ground truth
 * (real JPEG/crop/resize via sharp, self-generated content — no fixtures):
 *   1. FALSE-POSITIVE CONTROL. Run the FULL 576-cell grid (both tiers) over a
 *      battery of UNMARKED images (photo-like / flat / white-noise) crossed with
 *      their own crop/JPEG/resize derivatives; assert `present === false` on every
 *      single trial, and pin the max-of-grid score under SEARCH_DETECT_FLOOR. This
 *      is the empirical proof the family-wise bound survives contact with real image
 *      statistics (not just Gaussian noise). The floor itself (0.12) was calibrated
 *      from a 320-trial sweep at the worst 256² regime (max observed ≈ 0.0804).
 *   2. RECOVERY. embed → NON-8-aligned crop → plain detectWatermark MISSES, Tier 1
 *      FINDS it. embed → real resize → Tier 2 recovers a MODERATE ratio and, honestly,
 *      does NOT recover an aggressive downscale.
 *
 * Skips cleanly if sharp can't load. Run:
 *   node --test tests/watermark-search.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embedWatermark, detectWatermark } from '../engine/src/pixel-watermark.ts';
import { detectWatermarkSearch, SEARCH_DETECT_FLOOR, bilinearResampleRgba } from '../engine/src/watermark-search.ts';

let sharp: (typeof import('sharp'))['default'] | undefined;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }
const skip = sharp ? false : 'sharp not available';

interface Img { data: Uint8Array; width: number; height: number }

// Photo-like content (same generator family as the robustness suite): smooth
// low-frequency blobs + mid-frequency ripples + mild grain, so real JPEG/resize
// behave as they would on a photograph.
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

// Flat mid-grey fill — a degenerate case the robustness suite never covers.
function flat(w: number, h: number, v = 128): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const p = i * 4; px[p] = v; px[p + 1] = v; px[p + 2] = v; px[p + 3] = 255; }
  return px;
}

// White noise — maximally textured, so every block clears the activity gate: the
// adversarial FP case (many high-activity blocks correlating with the chip by chance).
function noise(w: number, h: number, seed = 1): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  let a = seed >>> 0;
  const rnd = (): number => { a = (a * 1664525 + 1013904223) >>> 0; return (a >>> 8) & 255; };
  for (let i = 0; i < w * h; i++) { const p = i * 4; px[p] = rnd(); px[p + 1] = rnd(); px[p + 2] = rnd(); px[p + 3] = 255; }
  return px;
}

async function toRaw(buf: Buffer): Promise<Img> {
  const { data, info } = await sharp!(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}
const rawPipe = (i: Img) => sharp!(Buffer.from(i.data), { raw: { width: i.width, height: i.height, channels: 4 } });
const jpeg = async (i: Img, q: number): Promise<Img> => toRaw(await rawPipe(i).jpeg({ quality: q }).toBuffer());
const resize = async (i: Img, s: number): Promise<Img> =>
  toRaw(await rawPipe(i).resize(Math.max(8, Math.round(i.width * s)), Math.max(8, Math.round(i.height * s))).png().toBuffer());
// Crop `l` px off the left and `t` px off the top (and the same off right/bottom to
// stay rectangular) — only left/top move the 8×8 block PHASE.
async function cropLT(i: Img, l: number, t: number): Promise<Img> {
  return toRaw(await rawPipe(i).extract({ left: l, top: t, width: i.width - 2 * l, height: i.height - 2 * t }).png().toBuffer());
}
const mark = (w: number, h: number, seed: number): Img =>
  ({ data: embedWatermark(photoLike(w, h, seed), { width: w, height: h }), width: w, height: h });
const det = (i: Img) => detectWatermark(i.data, { width: i.width, height: i.height });
const search = (i: Img, tier: 1 | 2) => detectWatermarkSearch(i.data, { width: i.width, height: i.height }, { tier });

// ── 1. FALSE-POSITIVE SWEEP ───────────────────────────────────────────────────
// The rigorous part. Every unmarked trial must come back present:false on the FULL
// grid, and the max score anywhere on the grid (returned as `score` on a miss) must
// stay under SEARCH_DETECT_FLOOR. Prints F/N and the empirical max so a regression
// is loud and the floor stays auditable. 0/N here bounds the FP rate at ≲ 3/N (~14%
// at 95% for N≈21) — this is the smoke test; the floor's real calibration came from
// the 320-trial sweep documented on SEARCH_DETECT_FLOOR.
test('the full search never false-positives on unmarked content', { skip }, async () => {
  const trials: Img[] = [];
  for (const s of [128, 192, 256, 384]) {
    trials.push({ data: photoLike(s, s, s * 3 + 1), width: s, height: s });
    trials.push({ data: noise(s, s, s * 7 + 5), width: s, height: s });
  }
  trials.push({ data: flat(256, 256), width: 256, height: 256 });
  // Cross two unmarked bases with real derivatives so the grid also sees JPEG-
  // blocking / resample / crop statistics, not just pristine content.
  const base: Img = { data: photoLike(256, 256, 999), width: 256, height: 256 };
  trials.push(await jpeg(base, 80), await jpeg(base, 50), await resize(base, 0.75), await resize(base, 1.5), await cropLT(base, 3, 5));
  const base2: Img = { data: photoLike(384, 384, 4242), width: 384, height: 384 };
  trials.push(await jpeg(base2, 60), await cropLT(base2, 11, 2));

  let falsePos = 0, maxScore = 0;
  for (const t of trials) {
    const r = await search(t, 2);
    if (r.present) falsePos++;
    if (r.score > maxScore) maxScore = r.score;
    if (r.present) console.error(`  FP: ${t.width}x${t.height} score=${r.score.toFixed(4)} scale=${r.scale} off=(${r.offsetX},${r.offsetY}) tier=${r.tier}`);
  }
  console.error(`[fp-sweep] trials=${trials.length} falsePositives=${falsePos} maxGridScore=${maxScore.toFixed(4)} floor=${SEARCH_DETECT_FLOOR}`);
  assert.equal(falsePos, 0, `${falsePos}/${trials.length} false positives on unmarked content (must be 0)`);
  assert.ok(maxScore < SEARCH_DETECT_FLOOR, `max-of-grid unmarked score ${maxScore.toFixed(4)} must stay under SEARCH_DETECT_FLOOR ${SEARCH_DETECT_FLOOR}`);
});

// ── 2a. CROP RECOVERY (Tier 1) ────────────────────────────────────────────────
// A near-half-block crop (3,4) shifts the block phase near maximum decorrelation, so
// plain detect (grid fixed at 0,0) collapses from a pristine ~0.5 to ~0.01–0.02 and
// MISSES; Tier 1's offset search realigns and RESTORES it to ~0.22 — a ~10× recovery
// that clears the 0.12 search floor with room to spare. (The reported offset is the
// FIRST passing cell under early-exit, not necessarily the exact realignment offset —
// partial-overlap phases also correlate — so presence, not the exact offset, is asserted.)
test('Tier 1 recovers a near-half-block crop that plain detect misses', { skip }, async () => {
  for (const size of [512, 320, 256]) {
    const marked = mark(size, size, size + 17);
    const cropped = await cropLT(marked, 3, 4);
    const plain = det(cropped);
    const found = await search(cropped, 1);
    console.error(`[crop 3,4 @${size}] plain present=${plain.present} score=${plain.score.toFixed(4)} | tier1 present=${found.present} score=${found.score.toFixed(4)} off=(${found.offsetX},${found.offsetY})`);
    assert.equal(plain.present, false, `plain detect should MISS a (3,4) crop @${size} (score ${plain.score.toFixed(4)})`);
    assert.ok(found.present, `Tier 1 should RECOVER a (3,4) crop @${size} (score ${found.score.toFixed(4)})`);
    assert.ok(found.score > plain.score * 4, `Tier 1 score ${found.score.toFixed(4)} should dwarf plain's ${plain.score.toFixed(4)}`);
    assert.equal(found.tier, 1, 'recovery should come from the offset tier');
  }
});

// ── 2b. RESIZE RECOVERY + HONEST BOUNDARY (Tier 2) ────────────────────────────
// A resize shifts the 8px pitch; plain detect misses (documented v1/v2 gap). Tier 2
// resamples the candidate back and recovers a MODERATE ratio. The honest claim gets
// a number: an AGGRESSIVE downscale must NOT recover.
test('Tier 2 recovers a moderate resize but not an aggressive downscale', { skip }, async () => {
  const size = 512;
  const marked = mark(size, size, 20260718);

  // Moderate: resize by 0.84 (= 2^-¼); the 1.19 (= 2^¼) candidate scale is its exact
  // inverse, restoring the 8px pitch. Plain detect misses; Tier 2 should recover.
  const moderate = await resize(marked, 0.84);
  const modPlain = det(moderate);
  const modFound = await search(moderate, 2);
  console.error(`[resize 0.84] plain present=${modPlain.present} score=${modPlain.score.toFixed(4)} | tier2 present=${modFound.present} score=${modFound.score.toFixed(4)} scale=${modFound.scale} off=(${modFound.offsetX},${modFound.offsetY})`);
  assert.equal(modPlain.present, false, `plain detect should MISS a 0.84× resize (score ${modPlain.score.toFixed(4)})`);
  assert.ok(modFound.present, `Tier 2 should RECOVER a 0.84× resize (score ${modFound.score.toFixed(4)})`);
  assert.equal(modFound.tier, 2, 'moderate-resize recovery should come from the scale tier');

  // Aggressive: a 0.3× downscale is a low-pass filter that destroys the mid-band at
  // embed time — no post-hoc upsample recovers destroyed information. Must NOT fire.
  const aggressive = await resize(marked, 0.3);
  const aggFound = await search(aggressive, 2);
  console.error(`[resize 0.30] tier2 present=${aggFound.present} score=${aggFound.score.toFixed(4)} scale=${aggFound.scale}`);
  assert.equal(aggFound.present, false, `Tier 2 should NOT recover a 0.3× aggressive downscale (score ${aggFound.score.toFixed(4)})`);
});

// ── 3. bilinear primitive sanity ──────────────────────────────────────────────
// Independent of sharp: a scale-1 resample is (near-)identity, dims scale as
// round(·×s), and a flat field round-trips exactly (no edge/DC drift).
test('bilinearResampleRgba: identity, dims, and flat-field invariance', () => {
  const w = 40, h = 24;
  const src = photoLike(w, h, 5);
  const id = bilinearResampleRgba(src, w, h, 1);
  assert.equal(id.width, w); assert.equal(id.height, h);
  let maxDiff = 0;
  for (let i = 0; i < src.length; i++) maxDiff = Math.max(maxDiff, Math.abs(src[i]! - id.data[i]!));
  assert.ok(maxDiff <= 1, `scale-1 resample should be ~identity (max channel diff ${maxDiff})`);

  const up = bilinearResampleRgba(src, w, h, 1.5);
  assert.equal(up.width, 60); assert.equal(up.height, 36);
  const down = bilinearResampleRgba(src, w, h, 0.5);
  assert.equal(down.width, 20); assert.equal(down.height, 12);

  const f = flat(w, h, 137);
  const fr = bilinearResampleRgba(f, w, h, 0.7);
  for (let i = 0; i < fr.data.length; i += 4) {
    assert.equal(fr.data[i], 137); assert.equal(fr.data[i + 1], 137);
    assert.equal(fr.data[i + 2], 137); assert.equal(fr.data[i + 3], 255);
  }
});
