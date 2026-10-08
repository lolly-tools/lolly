// SPDX-License-Identifier: MPL-2.0
/**
 * The offline pre-download must pull EXACTLY the model files the dialogs fetch on
 * demand - same store, same file names - or "Available offline" writes bytes the
 * runtime never reads. Cache-parity is the whole point of model-prefetch.ts; these
 * pin the offline file lists to the staged roster so the two can't drift.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { upscaleOfflineFiles, matteOfflineFiles, durableOfflineFiles } from './model-prefetch.ts';
import {
  DURABLE_ENCODER_FILE, DURABLE_ENCODER_PATH, DURABLE_MODEL_DIR, DURABLE_MODEL_STORE,
} from './durable-model.ts';
import { UPSCALE_MODEL_FILES, UPSCALE_FACE_DETECT_FILE, stagedUpscaleModels } from './upscale-models.ts';
import { MATTE_MODEL_FILES, MATTE_NATIVE_ONLY, matteModelsFor, stagedMatteModels } from './matte-models.ts';

test('the upscale offline part vendors every staged upscaler + the face detector', () => {
  const files = upscaleOfflineFiles();
  for (const m of stagedUpscaleModels()) {
    assert.ok(files.includes(UPSCALE_MODEL_FILES[m.id]), `${m.id} is pre-downloaded`);
  }
  assert.ok(files.includes(UPSCALE_FACE_DETECT_FILE), 'the GFPGAN face detector rides along');
  assert.equal(new Set(files).size, files.length, 'no duplicate files');
});

test('the illustration/anime model is in the offline part (the fix)', () => {
  assert.ok(
    upscaleOfflineFiles().includes(UPSCALE_MODEL_FILES['realesrgan-x4plus-anime']),
    'pre-downloading Upscaling models pulls the anime model so Illustration works offline',
  );
});

test('the matte offline part vendors exactly the cut-out models this shell can run', () => {
  // Cache parity is against what the picker OFFERS, which is backend-gated: a model
  // that can't run here must not be pre-downloaded here either. This test runs with no
  // Tauri backend (isTauriShell() === false), so matteOfflineFiles() is the
  // wasm-runnable subset - matteModelsFor(false).
  assert.deepEqual(
    [...matteOfflineFiles()].sort(),
    matteModelsFor(false).map(m => MATTE_MODEL_FILES[m.id]).sort(),
  );
  // No native-only model's bytes may ride the web/CLI offline part. Asserted against
  // MATTE_NATIVE_ONLY rather than a named id (the full BiRefNet, the only model that
  // ever needed it, was removed 2026-08-26) so the guard survives the empty roster and
  // still bites when a future heavyweight flips a flag back on.
  const nativeOnly = stagedMatteModels().filter(m => MATTE_NATIVE_ONLY[m.id]).map(m => MATTE_MODEL_FILES[m.id]);
  for (const f of nativeOnly) {
    assert.ok(!matteOfflineFiles().includes(f), `${f} needs a native backend - not a web offline download`);
  }
});

// ── The durable-credential encoder (plans/202 WP4.2) ─────────────────────────
//
// The encoder is fetched by lib/trustmark-embed.ts, which must stay dynamic-import
// only (it pulls in ORT's loader and the engine payload builder), so this module
// cannot import it to prove cache parity the way the rosters do. What CAN be
// proven, and is what actually breaks, is that both sides take the file identity
// from the one pure module - and that the embed no longer hand-rolls its own fetch
// against a same-origin URL, which is what hid the feature on the Tauri shells.

test('the durable offline part vendors exactly the encoder the embed runs', () => {
  assert.deepEqual(durableOfflineFiles(), [DURABLE_ENCODER_FILE]);
  assert.equal(DURABLE_MODEL_STORE, 'trustmark-models', 'shared with the deep-scan decoders');
  assert.equal(DURABLE_ENCODER_PATH, `/models/${DURABLE_MODEL_DIR}/${DURABLE_ENCODER_FILE}`);
});

test('the embed fetches through the shared model fetcher, not a hand-rolled same-origin URL', () => {
  const src = readFileSync(new URL('./trustmark-embed.ts', import.meta.url), 'utf8');
  // Comments stripped first: the module header names the .onnx files its maths was
  // verified against, which is documentation, not a second source of truth.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /createModelFetcher\(/, 'one fetch path with every other model family');
  assert.match(code, /from '\.\/durable-model\.ts'/, 'file identity comes from the shared module');
  assert.ok(!/'encoder_\w+\.onnx'/.test(code), 'no second copy of the file name to drift');
  assert.ok(!/\$\{MODELS_BASE\}/.test(code), 'URL building belongs to the fetcher (models base included)');
});

test('a model file past Chrome’s IndexedDB value ceiling is stored as a Blob, smaller ones as before', async () => {
  const { storableModelBytes, IDB_ARRAYBUFFER_MAX } = await import('./ort.ts');
  // Chrome refuses a serialized value past 133169152 bytes; the threshold stays well below that ceiling.
  assert.ok(IDB_ARRAYBUFFER_MAX < 133_169_152);
  const small = new ArrayBuffer(1024);
  assert.equal(storableModelBytes(small), small, 'a small model keeps the old record shape');
  const big = storableModelBytes(new ArrayBuffer(IDB_ARRAYBUFFER_MAX + 1));
  assert.ok(big instanceof Blob);
  assert.equal((big as Blob).size, IDB_ARRAYBUFFER_MAX + 1);
});

test('the singing part downloads every file but the fp32 fallbacks, the big files first', async () => {
  const { singOfflineFiles } = await import('./model-prefetch.ts');
  const { SING_FALLBACK_FILES, SING_FILE_BYTES, SING_PART_BYTES } = await import('./sing-models.ts');
  const files = singOfflineFiles();
  assert.equal(files.length, Object.keys(SING_FILE_BYTES).length - SING_FALLBACK_FILES.length);
  for (const f of SING_FALLBACK_FILES) assert.ok(!files.includes(f), `${f} is on demand only`);
  for (const v of ['kizuna', 'barbara', 'rise']) assert.ok(files.includes(`rondocode/gen_${v}.onnx`), `${v} rides with the part`);
  assert.ok(files.includes('rondocode/phoneme-int8.onnx') && files.includes('rondocode/tts_vector_estimator-int8.onnx') && files.includes('rondocode/tts_vocoder-int8.onnx'));
  assert.ok(files.includes('supertonic/LICENSE.txt') && files.includes('CREDITS.txt'), 'the licence and credits travel with the weights');
  assert.equal(files[0], 'rondocode/vec-768.onnx');
  assert.equal(SING_PART_BYTES, 1_218_137_628);
});
