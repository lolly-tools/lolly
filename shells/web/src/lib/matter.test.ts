// SPDX-License-Identifier: MPL-2.0
/**
 * host.matte runner - the PURE math (lib/matter.ts): letterbox geometry,
 * per-model normalization, and the mask activation. The ORT/canvas orchestration
 * around these is not testable headlessly (no weights, no onnxruntime-web in the
 * dev env - the module header's honesty ledger), so these three are what the
 * suite pins. They are also where the roster's silent-degradation footguns live:
 * a wrong normalization or activation does not crash, it quietly ruins the matte.
 *
 * Run: node --test shells/web/src/lib/matter.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateMask, packNchwNormalized, planLetterbox } from './matter.ts';
import { MATTE_MODEL_SPEC } from './matte-models.ts';

test('planLetterbox: a landscape image is centered with vertical padding', () => {
  const p = planLetterbox(200, 100, 320);
  assert.equal(p.scale, 320 / 200);          // limited by the wide axis
  assert.equal(p.contentW, 320);
  assert.equal(p.contentH, 160);
  assert.equal(p.offsetX, 0);
  assert.equal(p.offsetY, 80);               // (320-160)/2
});

test('planLetterbox: a square image fills the square exactly', () => {
  const p = planLetterbox(512, 512, 1024);
  assert.equal(p.contentW, 1024);
  assert.equal(p.contentH, 1024);
  assert.equal(p.offsetX, 0);
  assert.equal(p.offsetY, 0);
});

test('packNchwNormalized: MODNet uses [-1,1] normalization (mean 0.5 / std 0.5, NOT ImageNet)', () => {
  // The specific footgun: a non-ImageNet net whose mean/std must be applied per its
  // own recipe. MODNet maps grey 127.5 → 0 and white 255 → +1 (the [-1,1] range).
  const spec = MATTE_MODEL_SPEC['modnet'];
  assert.deepEqual(spec.mean, [0.5, 0.5, 0.5]);
  assert.deepEqual(spec.std, [0.5, 0.5, 0.5]);
  const grey = packNchwNormalized([128, 128, 128, 255], 1, spec);
  assert.ok(Math.abs(grey[0]! - (128 / 255 - 0.5) / 0.5) < 1e-6);
  const white = packNchwNormalized([255, 255, 255, 255], 1, spec);
  assert.ok(Math.abs(white[0]! - 1) < 1e-6);
});

test('packNchwNormalized: the ImageNet models subtract the ImageNet mean/std', () => {
  const spec = MATTE_MODEL_SPEC['u2netp'];
  const t = packNchwNormalized([255, 0, 0, 255], 1, spec); // pure red
  // R plane: (1 − 0.485)/0.229; G: (0 − 0.456)/0.224; B: (0 − 0.406)/0.225
  assert.ok(Math.abs(t[0]! - (1 - 0.485) / 0.229) < 1e-6);
  assert.ok(Math.abs(t[1]! - (-0.456) / 0.224) < 1e-6);
  assert.ok(Math.abs(t[2]! - (-0.406) / 0.225) < 1e-6);
});

test('packNchwNormalized: NCHW plane layout (all R, then all G, then all B)', () => {
  const spec = { inputSize: [2, 2] as [number, number], mean: [0, 0, 0] as [number, number, number], std: [1, 1, 1] as [number, number, number], activation: 'minmax' as const };
  // edge=1 → 1 pixel, 3 values: [R, G, B].
  const t = packNchwNormalized([10, 20, 30, 255], 1, spec);
  assert.equal(t.length, 3);
  assert.ok(Math.abs(t[0]! - 10 / 255) < 1e-6);
  assert.ok(Math.abs(t[1]! - 20 / 255) < 1e-6);
  assert.ok(Math.abs(t[2]! - 30 / 255) < 1e-6);
});

test('activateMask minmax stretches a bounded head to the full 0..1 range', () => {
  const m = activateMask([0.2, 0.4, 0.6, 0.8], 4, 'minmax');
  assert.equal(m[0], 0);                       // min → 0
  assert.equal(m[3], 1);                       // max → 1
  assert.ok(Math.abs(m[1]! - 1 / 3) < 1e-6);
});

test('activateMask minmax on a flat mask yields all-zero (no divide-by-zero)', () => {
  const m = activateMask([0.5, 0.5, 0.5], 3, 'minmax');
  assert.deepEqual([...m], [0, 0, 0]);
});

test('activateMask sigmoid squashes logits (0 → 0.5, large + → ~1, large − → ~0)', () => {
  const m = activateMask([0, 8, -8], 3, 'sigmoid');
  assert.ok(Math.abs(m[0]! - 0.5) < 1e-9);
  assert.ok(m[1]! > 0.999);
  assert.ok(m[2]! < 0.001);
});

test('the roster activations are pinned: every current head is bounded = minmax', () => {
  // Both models left after the BiRefNet pair was removed (2026-08-26) have bounded
  // heads. The sigmoid branch above is deliberately kept and still covered: it is the
  // logit path, and deleting it would make the next logit-head model silently minmax -
  // which washes the matte with no crash, the exact failure MATTE_MODEL_SPEC exists to
  // prevent.
  assert.equal(MATTE_MODEL_SPEC['u2netp'].activation, 'minmax');
  assert.equal(MATTE_MODEL_SPEC['modnet'].activation, 'minmax');
});
