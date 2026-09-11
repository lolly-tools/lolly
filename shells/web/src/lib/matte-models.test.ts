// SPDX-License-Identifier: MPL-2.0
/**
 * host.matte catalogue (lib/matte-models.ts) - the honesty gates.
 *
 * The one property that MUST hold: nothing is offered until its licence + weights
 * are verified. A model may only appear once MATTE_STAGED flips (in the same change
 * that lands its verified pin). This test is the tripwire on that gate - it pins the
 * exact staged set, so a NEW flip fails here until whoever flipped it re-affirms the
 * verification by updating this test in the same change.
 *
 * Run: node --test shells/web/src/lib/matte-models.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATTE_DEFAULT_MODEL, MATTE_MODELS, MATTE_MODEL_BYTES, MATTE_MODEL_FILES,
  MATTE_MODEL_SPEC, MATTE_NATIVE_ONLY, MATTE_STAGED,
  matteModel, matteModelsFor, resolveMatteModel, stagedMatteModels,
} from './matte-models.ts';

test('every catalogue model has a file, a byte size, a spec, and a staged flag', () => {
  for (const m of MATTE_MODELS) {
    assert.ok(MATTE_MODEL_FILES[m.id], `${m.id} has a filename`);
    assert.ok(MATTE_MODEL_BYTES[m.id] > 0, `${m.id} has a size`);
    assert.ok(MATTE_MODEL_SPEC[m.id], `${m.id} has a tensor spec`);
    assert.equal(typeof MATTE_STAGED[m.id], 'boolean', `${m.id} has a staged flag`);
    assert.ok(['Apache-2.0', 'MIT'].includes(m.license), `${m.id} is permissively licensed (${m.license})`);
    assert.ok(m.attribution.length > 0, `${m.id} carries its attribution`);
  }
});

test('MATTE_MODEL_BYTES is derived from the catalogue (cannot drift)', () => {
  for (const m of MATTE_MODELS) assert.equal(MATTE_MODEL_BYTES[m.id], m.approxBytes);
});

test('the default model is a real catalogue entry, staged, and runs without a native backend', () => {
  assert.ok(matteModel(MATTE_DEFAULT_MODEL), 'default resolves in the full catalogue');
  // The default is what every caller that omits opts.model gets, and what
  // resolveMatteModel degrades a retired id to - so a withheld or native-only default
  // would strand the web shell on a download it can never complete or run.
  assert.ok(MATTE_STAGED[MATTE_DEFAULT_MODEL], 'the default is staged');
  assert.ok(matteModelsFor(false).some(m => m.id === MATTE_DEFAULT_MODEL),
    'the default is offered on a shell with no native backend');
});

test('a retired or unknown model id degrades to the default instead of throwing', () => {
  // The runtime risk of narrowing the roster: ids outlive it in saved projects,
  // `?model=` links and the dialog's localStorage. Every entry point (matter.ts
  // canRun/runMatte/modelCached) normalizes through this, so the worst case is a
  // different matte plus a console line - never a TypeError on `spec.inputSize` nor a
  // hanging fetch of `/models/matte/undefined`.
  for (const retired of ['birefnet', 'birefnet-lite', 'isnet-general', '', 'nonsense']) {
    assert.equal(resolveMatteModel(retired), MATTE_DEFAULT_MODEL, `"${retired}" falls back`);
  }
  assert.equal(resolveMatteModel(undefined), MATTE_DEFAULT_MODEL, 'an omitted model falls back');
  assert.equal(resolveMatteModel(null), MATTE_DEFAULT_MODEL, 'a null model falls back');
  for (const m of MATTE_MODELS) assert.equal(resolveMatteModel(m.id), m.id, `${m.id} passes through`);
});

test('HONESTY GATE: exactly the verified models are offered', () => {
  // When you stage a model, you are asserting you have re-read its LICENSE and
  // verified its ONNX (see scripts/fetch-matte-models.ts gate list). Flipping a
  // flag without that verification is exactly the mistake this guards.
  //
  // Staged roster as of 2026-08-26: u2netp (general, the default) + modnet
  // (portraits). Each has a real sha256/byte-verified pin (fetch-matte-models.ts), its
  // ONNX graph inspected in onnxruntime (tensor shape/dtype, per-model normalization +
  // activation confirmed), and a permissive licence (Apache-2.0 ×2 - MPL-compatible).
  // Matte runs WASM-only, so no WebGPU gate applies. The BiRefNet pair (lite + full)
  // was REMOVED 2026-08-26 - it did not work well enough to earn its 605 MB. If this
  // fails, a staged flag changed - re-affirm the licence + pin were actually verified,
  // then update this list in the SAME change.
  assert.deepEqual(stagedMatteModels().map(m => m.id).sort(), ['modnet', 'u2netp'],
    'the staged set must match the verified models');
});

test('matteModel round-trips even an unstaged (withheld) id', () => {
  for (const m of MATTE_MODELS) assert.equal(matteModel(m.id)?.id, m.id);
});

test('BACKEND GATE: native-only models are offered only where a native backend exists', () => {
  // The full BiRefNet (Swin-L @1024²) was the only model that ever needed this gate,
  // and it was removed 2026-08-26 - so every flag is false today and the two shells
  // offer the same set. The gate is asserted GENERICALLY rather than against a fixed
  // id list so it keeps guarding when a future heavyweight flips a flag back on.
  assert.deepEqual(MATTE_NATIVE_ONLY, { 'u2netp': false, 'modnet': false },
    'no model on the current roster needs a native backend');

  // A native-only model may only be flagged if it is actually staged (a gate on a
  // withheld model would be meaningless and mask a staging regression).
  for (const id of Object.keys(MATTE_NATIVE_ONLY) as (keyof typeof MATTE_NATIVE_ONLY)[]) {
    if (MATTE_NATIVE_ONLY[id]) assert.ok(MATTE_STAGED[id], `${id} is native-only but not staged`);
  }

  // Web/CLI (no native backend): the staged set minus anything flagged native-only.
  assert.deepEqual(
    matteModelsFor(false).map(m => m.id).sort(),
    stagedMatteModels().filter(m => !MATTE_NATIVE_ONLY[m.id]).map(m => m.id).sort(),
    'web offers exactly the wasm-runnable staged models');
  // Desktop (native backend): the full staged set.
  assert.deepEqual(matteModelsFor(true).map(m => m.id).sort(), stagedMatteModels().map(m => m.id).sort(),
    'a native shell offers every staged model');
});
