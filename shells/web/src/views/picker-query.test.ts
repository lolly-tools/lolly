// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { pickerAcceptsAsset, queryPickerAssets } from './picker-query.ts';
const template = { id: 'brand/title', type: 'data', format: 'mogrt', url: '/title.mogrt', source: 'library' } as AssetRef;
const document = { ...template, id: 'brand/document', format: 'aep' };
const model = { ...template, id: 'brand/model', type: 'model', format: '3mf' } as AssetRef;
const video = { ...template, id: 'brand/video', type: 'video', format: 'mp4' } as AssetRef;
const assets = { query: async ({ type }: { type?: string }) => [template, document, model, video].filter(a => !type || a.type === type) } as HostV1['assets'];
test('motion slots accept MOGRT previews while still and model slots refuse them', () => {
  assert.equal(pickerAcceptsAsset({ type: 'video' }, template), true);
  assert.equal(pickerAcceptsAsset({ type: 'image', motion: true }, template), true);
  assert.equal(pickerAcceptsAsset({ type: 'image' }, template), false);
  assert.equal(pickerAcceptsAsset({ type: 'model' }, template), false);
});
test('motion queries include templates without including arbitrary Adobe project files', async () => {
  const refs = await queryPickerAssets(assets, { type: 'video' }, true);
  assert.ok(refs.some(a => a.id === template.id));
  assert.ok(!refs.some(a => a.id === document.id));
  const union = await queryPickerAssets(assets, { types: ['video', 'audio'] }, false);
  assert.deepEqual(union.map(a => a.id).sort(), [template.id, video.id].sort());
});
test('the Studio model query selects 3MF and excludes template/video assets', async () => {
  assert.deepEqual(await queryPickerAssets(assets, { type: 'model' }, false), [model]);
});
