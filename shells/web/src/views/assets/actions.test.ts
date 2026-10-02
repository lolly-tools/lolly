// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { canConvert, selection } from './actions.ts';
import type { CatCtx } from './context.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
const photo = { id: 'photo', type: 'raster', format: 'png' } as AssetRef;
const sound = { id: 'sound', type: 'audio', format: 'wav' } as AssetRef;
const cat = {} as CatCtx;
test('conversion gates the whole selection and refuses unsupported procedural audio', () => {
  assert.equal(canConvert(cat, [photo]), true);
  assert.equal(canConvert(cat, [photo, photo]), true);
  assert.equal(canConvert(cat, [photo, sound]), false);
  assert.equal(canConvert(cat, [{ ...sound, format: 'zzfxm' }]), false);
  assert.equal(canConvert(cat, [{ ...photo, meta: { animated: true } }]), false);
  assert.equal(canConvert(cat, [{ ...photo, original: { url: 'original', format: 'psd' } }]), false);
  assert.equal(canConvert(cat, [{ ...photo, type: 'text', format: 'md' }]), true);
});
test('a missing selected source cannot silently turn into a partial operation', () => {
  const ctx = { selected: new Set(['photo', 'deleted']), assetById: new Map([['photo', photo]]) } as CatCtx;
  assert.deepEqual(selection(ctx), []);
  ctx.selected.delete('deleted');
  assert.deepEqual(selection(ctx), [photo]);
});
