// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { setAssetOpening, takeAssetOpening, takeAssetOpeningSeed, openingInputValues, readAssetFile } from './asset-open-handoff.ts';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import type { ToolManifest } from '@lolly/engine';
const ref = { source: 'user', id: 'user/source', type: 'raster', format: 'png', url: 'blob:preview', original: { url: 'blob:original', format: 'jpg' }, meta: { name: 'photo' } } as AssetRef;
test('opening is single use and belongs to the exact destination and session', () => {
  const value = { toolId: 'design', slot: 'new', kind: 'canvas' as const, refs: [ref], values: {}, at: Date.now() };
  setAssetOpening(value);
  assert.equal(takeAssetOpening('design', 'new'), null);
  assert.equal(takeAssetOpeningSeed('design', 'new'), value);
  assert.equal(takeAssetOpening('design', 'new', true), value);
  assert.equal(takeAssetOpening('design', 'new', true), null);
  setAssetOpening(value);
  assert.equal(takeAssetOpening('design', 'another', true), null);
  assert.equal(takeAssetOpening('design', 'new', true), null);
  setAssetOpening({ ...value, at: Date.now() - 61_000 });
  assert.equal(takeAssetOpening('design', 'new', true), null);
});
test('file reads use the host original-byte path and original format', async () => {
  let received: unknown;
  const host = { assets: { bytes: async (source: unknown) => { received = source; return new Uint8Array([1, 2, 3]); } } } as unknown as HostV1;
  const file = await readAssetFile(host, ref);
  assert.equal(received, ref);
  assert.equal(file.name, 'photo.jpg');
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array([1, 2, 3]));
});
test('input handoff preserves source refs and refuses hidden or oversized destinations', async () => {
  const host = { assets: { bytes: async () => new Uint8Array([1, 2, 3]) } } as unknown as HostV1;
  const manifest = { inputs: [{ id: 'source', type: 'asset' }] } as ToolManifest;
  const choice = { tool: { id: 'photo' }, intent: { id: 'photo', types: ['raster'] as AssetRef['type'][], binding: { kind: 'input' as const, input: 'source' } } };
  assert.equal((await openingInputValues(host, manifest, choice, [ref])).source, ref);
  manifest.inputs[0]!.showIf = { enabled: true };
  await assert.rejects(openingInputValues(host, manifest, choice, [ref]), /unavailable/);
  manifest.inputs = [{ id: 'source', type: 'file', maxSize: 2 }];
  await assert.rejects(openingInputValues(host, manifest, choice, [ref]), /limit/);
});
