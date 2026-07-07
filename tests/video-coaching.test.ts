/**
 * video-coach-core contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework — uses node:test built-in.
 *
 * Exercises the PURE exposure-coaching logic that turns a camera frame's RGBA bytes into
 * luma statistics (frameLuma) and then into an exposure verdict (coachVideo): too dark,
 * too bright, or overexposed / backlit. The logic lives in a DOM-free core module
 * (shells/web/src/lib/video-coach-core.ts) precisely so it can be imported here without
 * pulling in the DOM HUD (mountCoachHud) or the frame sampling in record-control.ts.
 *
 * Thresholds under test (see video-coach-core.ts):
 *   DARK_MEAN   = 0.16   (mean luma ≤ this = underlit)
 *   BRIGHT_MEAN = 0.82   (mean luma ≥ this = washed out)
 *   BLOWN_FRAC  = 0.22   (≥ this share pure-white = blown highlights / backlit)
 *   CRUSH_FRAC  = 0.55   (≥ this share pure-black = mostly darkness)
 *   MIN_SAMPLES = 64     (fewer samples than this = say nothing yet)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { frameLuma, coachVideo } from '../shells/web/src/lib/video-coach-core.ts';

// A solid W×H RGBA frame of one colour.
function solid(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  return d;
}

// A dark frame with the first `whiteFrac` of its pixels blown to pure white (a backlit
// subject: dark face against a bright window).
function backlit(w: number, h: number, whiteFrac: number): Uint8ClampedArray {
  const d = solid(w, h, 20, 20, 20);
  const whites = Math.floor(w * h * whiteFrac);
  for (let i = 0; i < whites; i++) { d[i * 4] = 255; d[i * 4 + 1] = 255; d[i * 4 + 2] = 255; }
  return d;
}

const W = 100, H = 100;   // 10 000 px — well over MIN_SAMPLES

// ─── frameLuma: brightness + clipped-pixel fractions ──────────────────────────

test('frameLuma of pure white → mean 1, all clipHi', () => {
  const s = frameLuma(solid(W, H, 255, 255, 255), W, H);
  assert.equal(s.mean, 1);
  assert.equal(s.clipHi, 1);
  assert.equal(s.clipLo, 0);
  assert.ok(s.samples >= 64);
});

test('frameLuma of pure black → mean 0, all clipLo', () => {
  const s = frameLuma(solid(W, H, 0, 0, 0), W, H);
  assert.equal(s.mean, 0);
  assert.equal(s.clipHi, 0);
  assert.equal(s.clipLo, 1);
});

test('frameLuma of mid-grey → mean ≈ 0.5, nothing clipped', () => {
  const s = frameLuma(solid(W, H, 128, 128, 128), W, H);
  assert.ok(Math.abs(s.mean - 0.5) < 0.02);
  assert.equal(s.clipHi, 0);
  assert.equal(s.clipLo, 0);
});

test('frameLuma guards a too-short buffer → zero samples', () => {
  const s = frameLuma(new Uint8ClampedArray(8), W, H);   // claims 100×100 but holds 2 px
  assert.equal(s.samples, 0);
  assert.equal(s.mean, 0);
});

// ─── coachVideo: exposure verdicts ────────────────────────────────────────────

test('a dark frame → too dark (tone low, dark cue)', () => {
  const c = coachVideo(frameLuma(solid(W, H, 12, 12, 12), W, H));
  assert.equal(c.tone, 'low');
  assert.equal(c.cue, 'dark');
  assert.match(c.warning, /dark/i);
});

test('a washed-out (bright, unclipped) frame → too bright (tone hot, bright cue)', () => {
  // Uniform luma ≈ 0.85 (217/255) — above BRIGHT_MEAN but below the blown-white cutoff.
  const c = coachVideo(frameLuma(solid(W, H, 217, 217, 217), W, H));
  assert.equal(c.tone, 'hot');
  assert.equal(c.cue, 'bright');
});

test('a fully white frame → overexposed / blown highlights (glare cue)', () => {
  const c = coachVideo(frameLuma(solid(W, H, 255, 255, 255), W, H));
  assert.equal(c.tone, 'hot');
  assert.equal(c.cue, 'glare');
});

test('backlit: a dark subject with a blown background → glare, even at a moderate mean', () => {
  const c = coachVideo(frameLuma(backlit(W, H, 0.3), W, H));   // 30% blown white
  assert.equal(c.cue, 'glare');
  assert.equal(c.tone, 'hot');
});

test('a well-exposed mid-grey frame → nothing to say', () => {
  const c = coachVideo(frameLuma(solid(W, H, 128, 128, 128), W, H));
  assert.equal(c.tone, 'ok');
  assert.equal(c.warning, '');
  assert.equal(c.cue, null);
});

test('too few samples (a tiny/unseen frame) → say nothing', () => {
  const c = coachVideo(frameLuma(solid(4, 4, 0, 0, 0), 4, 4));   // 16 px < MIN_SAMPLES
  assert.equal(c.tone, 'ok');
  assert.equal(c.warning, '');
  assert.equal(c.cue, null);
});
