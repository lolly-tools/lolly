// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeToTargetBytes, DEFAULT_IMAGE_OPTIONS } from '../src/image-operation-v1.ts';
test('target-size encoding never claims success over the limit', async () => {
  const out = await encodeToTargetBytes(async quality => ({ size: Math.round(quality * 1000), quality }), { ...DEFAULT_IMAGE_OPTIONS, targetBytes: 500 });
  assert.ok(out.size <= 500 && out.quality > .48);
  await assert.rejects(encodeToTargetBytes(async () => ({ size: 600 }), { ...DEFAULT_IMAGE_OPTIONS, targetBytes: 500 }), /cannot be reached/);
  await assert.rejects(encodeToTargetBytes(async () => ({ size: 1 }), { ...DEFAULT_IMAGE_OPTIONS, quality: NaN }));
  await assert.rejects(encodeToTargetBytes(async () => ({ size: 1 }), DEFAULT_IMAGE_OPTIONS, AbortSignal.abort()));
});
