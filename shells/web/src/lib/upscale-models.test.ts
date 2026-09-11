// SPDX-License-Identifier: MPL-2.0
/**
 * host.upscale catalogue (lib/upscale-models.ts) - the honesty gates. Twin of
 * matte-models.test.ts.
 *
 * The one property that MUST hold: nothing is offered until its weights are real - 
 * a model appears only once UPSCALE_STAGED flips, in the same change that lands its
 * verified fetch-script pin (scripts/fetch-upscale-models.ts) OR, for the
 * conversion-sourced anime model, its reproducible converter
 * (scripts/convert-anime-upscale-onnx.py). This test is the tripwire on that gate:
 * it pins the exact staged set, so a NEW flip fails here until whoever flipped it
 * re-affirms the verification by updating this test in the same change.
 *
 * Run: node --test shells/web/src/lib/upscale-models.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UPSCALE_DEFAULT_MODEL, UPSCALE_MODELS, UPSCALE_MODEL_BYTES, UPSCALE_MODEL_FILES,
  UPSCALE_STAGED, stagedUpscaleModels, upscaleModel,
} from './upscale-models.ts';

test('every catalogue model has a file, a byte size, and a staged flag', () => {
  for (const m of UPSCALE_MODELS) {
    assert.ok(UPSCALE_MODEL_FILES[m.id], `${m.id} has a filename`);
    assert.ok(UPSCALE_MODEL_BYTES[m.id] > 0, `${m.id} has a size`);
    assert.equal(typeof UPSCALE_STAGED[m.id], 'boolean', `${m.id} has a staged flag`);
    assert.ok(['BSD-3-Clause', 'Apache-2.0'].includes(m.license), `${m.id} is permissively licensed (${m.license})`);
    assert.ok(m.attribution.length > 0, `${m.id} carries its attribution`);
    assert.ok(m.scale === 2 || m.scale === 4, `${m.id} declares an integer scale`);
  }
});

test('UPSCALE_MODEL_BYTES is derived from the catalogue (cannot drift)', () => {
  for (const m of UPSCALE_MODELS) assert.equal(UPSCALE_MODEL_BYTES[m.id], m.approxBytes);
});

test('the default model is a real, staged catalogue entry', () => {
  assert.ok(upscaleModel(UPSCALE_DEFAULT_MODEL), 'default resolves in the full catalogue');
  assert.ok(UPSCALE_STAGED[UPSCALE_DEFAULT_MODEL], 'the default must be staged');
});

test('HONESTY GATE: exactly the verified models are offered', () => {
  // Staging a model asserts you verified its weights: a real sha256/byte-verified
  // pin in scripts/fetch-upscale-models.ts, OR - for the conversion-sourced anime
  // model - that scripts/convert-anime-upscale-onnx.py reproduced it from the
  // upstream BSD-3 .pth and it ran + scaled x4 in onnxruntime. Flipping a flag
  // without that verification is exactly the mistake this guards.
  //
  // Staged roster as of 2026-08-06: general (fast, default) + x4plus (quality) +
  // x4plus-anime (illustration/line-art, converted 2026-08-06) + gfpgan (face).
  // All permissive (BSD-3-Clause ×3, Apache-2.0). If this fails, a staged flag
  // changed - re-affirm the weights were actually verified, then update this list
  // in the SAME change.
  assert.deepEqual(
    stagedUpscaleModels().map(m => m.id).sort(),
    ['gfpgan-v1.4', 'realesr-general-x4v3', 'realesrgan-x4plus', 'realesrgan-x4plus-anime'],
    'the staged set must match the verified models',
  );
});

test('upscaleModel round-trips every catalogue id', () => {
  for (const m of UPSCALE_MODELS) assert.equal(upscaleModel(m.id)?.id, m.id);
});
