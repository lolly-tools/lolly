// SPDX-License-Identifier: MPL-2.0
/**
 * Depth catalogue (lib/depth-models.ts) - the honesty gates, the working-size cap
 * and the cache identity. The matte-models.test.ts idiom applied to plans/160.
 *
 * Offered models must have matching verified pins, sizes and a deployment
 * manifest entry. The model-host rollout ships those files with this build.
 *
 * Run: node --test shells/web/src/lib/depth-models.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPTH_DEFAULT_MODEL, DEPTH_MAX_WORK_EDGE, DEPTH_MODELS, DEPTH_MODEL_BYTES, DEPTH_MODEL_DIR,
  DEPTH_MODEL_FILES, DEPTH_MODEL_SPEC, DEPTH_MODEL_STORE, DEPTH_STAGED,
  depthCacheKey, depthModel, depthOfflineFiles, planWorkSize, stagedDepthModels,
} from './depth-models.ts';

test('every catalogue model has a file, a byte size, a spec, and a staged flag', () => {
  for (const m of DEPTH_MODELS) {
    assert.ok(DEPTH_MODEL_FILES[m.id], `${m.id} has a filename`);
    assert.ok(DEPTH_MODEL_BYTES[m.id] > 0, `${m.id} has a size`);
    assert.ok(DEPTH_MODEL_SPEC[m.id], `${m.id} has a tensor spec`);
    assert.equal(typeof DEPTH_STAGED[m.id], 'boolean', `${m.id} has a staged flag`);
    assert.ok(['Apache-2.0', 'MIT'].includes(m.license), `${m.id} is permissively licensed (${m.license})`);
    assert.ok(m.attribution.length > 0, `${m.id} carries its attribution`);
  }
});

test('DEPTH_MODEL_BYTES is derived from the catalogue (cannot drift)', () => {
  for (const m of DEPTH_MODELS) assert.equal(DEPTH_MODEL_BYTES[m.id], m.approxBytes);
});

test('the default model is a real catalogue entry', () => {
  assert.ok(depthModel(DEPTH_DEFAULT_MODEL), 'default resolves in the full catalogue');
});

test('the offered depth model has verified pins and a deployment manifest entry', async () => {
  const { ML_MODEL_FILES } = await import('@lolly-tools/node-shell/ml/model-pins');
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../../models-manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(stagedDepthModels().map(m => m.id), ['depth-anything-v2-small']);
  for (const m of stagedDepthModels()) {
    const file = DEPTH_MODEL_FILES[m.id];
    const pin = ML_MODEL_FILES.depth.files.find(f => f.path === file);
    assert.ok(pin);
    assert.equal(pin.bytes, m.approxBytes);
    assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    assert.ok(JSON.stringify(manifest).includes('depth/' + file));
  }
});

test('the offline download offers exactly what the picker would', () => {
  assert.deepEqual(depthOfflineFiles(), stagedDepthModels().map(m => DEPTH_MODEL_FILES[m.id]));
  assert.deepEqual(depthOfflineFiles(), ['depth-anything-v2-small.onnx']);
});

test('the spec matches the ViT-S/14 backbone constraint', () => {
  for (const m of DEPTH_MODELS) {
    const [h, w] = DEPTH_MODEL_SPEC[m.id].inputSize;
    assert.equal(h, w, 'a square input');
    assert.equal(h % 14, 0, `${m.id} input ${h} must be a multiple of 14 for a /14 patch backbone`);
  }
});

test('the cache coordinates are the pinned contract the fetcher and the store share', () => {
  assert.equal(DEPTH_MODEL_STORE, 'depth-models');
  assert.equal(DEPTH_MODEL_DIR, 'depth');
});

// ── the working-size cap (iOS memory, not quality) ────────────────────────────

test('planWorkSize caps the long side and preserves aspect', () => {
  assert.deepEqual(planWorkSize(4000, 3000), { width: 2048, height: 1536 });
  assert.deepEqual(planWorkSize(3000, 4000), { width: 1536, height: 2048 });
  assert.equal(DEPTH_MAX_WORK_EDGE, 2048);
});

test('planWorkSize never upscales a small photo and never returns a zero side', () => {
  assert.deepEqual(planWorkSize(640, 480), { width: 640, height: 480 }, 'already inside the box');
  const thin = planWorkSize(4000, 1, 2048);
  assert.equal(thin.width, 2048);
  assert.ok(thin.height >= 1, 'a 1px side survives the round-to-zero');
});

// ── the cache identity ────────────────────────────────────────────────────────

test('the cache key is (image checksum, model id) - a different model re-infers', () => {
  const a = depthCacheKey('abc123', 'depth-anything-v2-small');
  assert.ok(a.includes('abc123'), 'the image checksum is in the key');
  assert.ok(a.includes('depth-anything-v2-small'), 'so is the model id');
  assert.notEqual(a, depthCacheKey('def456', 'depth-anything-v2-small'), 'a different image is a different key');
  assert.equal(a, depthCacheKey('abc123', 'depth-anything-v2-small'), 'and the same pair is stable');
  assert.ok(a.startsWith('depth:'), 'namespaced inside the shared derived-media store');
});
