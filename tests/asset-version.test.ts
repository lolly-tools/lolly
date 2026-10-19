// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntime } from '../engine/src/runtime.ts';
import { bakeAssetRef, assetIdForUrl } from '../engine/src/bake.ts';
import { assetVersionPin, encodeAssetVersion, decodeAssetVersion, assetDependency } from '../engine/src/asset-version.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';
import { pinRevisionAssets } from '../shells/web/src/bridge/revision-asset-pins.ts';
import { revisionSnapshot } from '../shells/web/src/bridge/revision-snapshot.ts';
import { collectAssetRefs } from '../shells/web/src/bridge/asset-ref-collector.ts';

const pin = { version: 'old/v1 ~ #é', format: 'png' };
const asset = { source: 'user' as const, id: 'user/upload/photo', type: 'raster' as const, format: 'png', version: 'new', url: 'blob:gone', pin };
const inputs = [{ id: 'hero', type: 'asset', assetType: 'any' }, { id: 'rows', type: 'blocks', fields: [{ id: 'image', type: 'asset' }] }];
const tool: any = { manifest: { id: 'doc', name: 'Doc', version: '1.0.0', engineVersion: '^1.0.0', render: { width: 10, height: 10, formats: ['png'] }, inputs }, template: '{{#if hero}}<img src="{{asset hero}}">{{/if}}' };

test('pins round-trip unusual versions and keep modifier identities distinct', () => {
  const file = `photo?file=${'a'.repeat(24)}`;
  assert.equal(assetDependency({ id: file, pin }).id, file);
  assert.equal(assetDependency({ id: `${file}&theme=dark`, pin }).id, file);
  assert.equal(assetDependency({ id: `${file}&theme=dark`, pin }).modifier, '&theme=dark');
  assert.deepEqual(decodeAssetVersion(encodeAssetVersion('photo?theme=dark', pin)), { id: 'photo?theme=dark', pin });
  assert.equal(assetDependency({ ...asset, id: 'photo?theme=dark' }).key, encodeAssetVersion('photo', pin));
  assert.deepEqual(decodeAssetVersion('legacy/id'), { id: 'legacy/id' });
  assert.equal(assetVersionPin({ version: 'legacy' }), undefined);
  for (const value of [null, {}, { version: '' }, { version: 'x', format: 1 }]) assert.throws(() => assetVersionPin({ pin: value }));
  assert.throws(() => decodeAssetVersion('photo#lolly-version=%bad'), /Invalid/);
});

test('URL mode preserves pins in asset and compact block fields without sharing local ids', async () => {
  const model: any = inputs.map(input => ({ ...input, value: input.id === 'hero' ? asset : [{ image: asset }] }));
  const params = serializeUrlState(model, { keepUserIds: true });
  const decoded = parseUrlState(params, tool.manifest);
  const calls: unknown[] = [];
  const runtime = await createRuntime(tool, { version: '1', profile: { get: async () => ({}) }, log() {}, assets: { get: async (id: string, opts: unknown) => {
    calls.push({ id, opts }); return { ...asset, id, version: pin.version, url: 'data:image/png;base64,AA==' };
  } } } as any, decoded.values);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => JSON.stringify(call) === JSON.stringify({ id: asset.id, opts: pin })));
  assert.deepEqual((runtime.getModel().find(item => item.id === 'hero')!.value as typeof asset).pin, pin);
  const shared = serializeUrlState(model);
  assert.ok(!JSON.stringify(shared).includes('user/'));
  runtime.destroy();
});

test('an older resolved version stays live unless explicitly pinned; unavailable pins survive autosave', async () => {
  const calls: unknown[] = [];
  const host: any = { version: '1', profile: { get: async () => ({}) }, log() {}, assets: { get: async (_id: string, opts: unknown) => {
    calls.push(opts); return { ...asset, version: 'latest', pin: undefined, url: 'data:image/png;base64,LATEST' };
  } } };
  const live = await createRuntime(tool, host, { hero: { ...asset, pin: undefined, version: 'old' } });
  assert.deepEqual(calls, [undefined]);
  assert.equal((live.getModel()[0]!.value as typeof asset).version, 'latest');
  const exact = await createRuntime(tool, host, { hero: asset });
  const missing = exact.getModel()[0]!.value as typeof asset;
  assert.equal(missing.url, ''); assert.deepEqual(missing.pin, pin); assert.equal(exact.droppedAssets.length, 1);
  assert.ok(!exact.getHydrated().includes('LATEST'));
  assert.deepEqual(((await revisionSnapshot({ hero: missing })).data.hero as typeof asset).pin, pin);
  live.destroy(); exact.destroy();
});

test('new captures pin uploads while archive canonicalisation retains historical hashes', async () => {
  const original = { hero: { ...asset, version: 'v1', pin: undefined } };
  const prior = await revisionSnapshot(original);
  const captured = pinRevisionAssets(original);
  assert.deepEqual((captured.hero as typeof asset).pin, { version: 'v1', format: 'png' });
  assert.equal(original.hero.pin, undefined);
  assert.equal((await revisionSnapshot(original)).hash, prior.hash);
  const refs = new Set<string>(); collectAssetRefs({ hero: asset }, refs);
  assert.ok(refs.has(`${asset.id}:png:${pin.version}`), 'explicit pin overrides last-resolved version');
});

test('baked self-contained bytes take precedence over an old source pin', async () => {
  const baked = bakeAssetRef({ ...asset, url: 'data:image/png;base64,AA==' });
  assert.equal(baked.pin, undefined); assert.equal(assetIdForUrl({ ...baked, pin }), baked.id);
  const runtime = await createRuntime(tool, { version: '1', profile: { get: async () => ({}) }, log() {},
    assets: { get: async () => { throw new Error('A baked image must not resolve its old pin'); } } } as any, { hero: { ...baked, pin } });
  assert.equal(runtime.droppedAssets.length, 0); assert.equal((runtime.getModel()[0]!.value as typeof asset).url, baked.url);
  runtime.destroy();
});

test('export credential collection distinguishes the exact source versions it rendered', async () => {
  const calls: string[] = [];
  const host: any = { version: '1', profile: { get: async () => ({}) }, log() {},
    assets: { get: async (id: string, requested: typeof pin) => ({ ...asset, id, version: requested.version, pin: requested, url: 'data:image/png;base64,AA==' }),
      credential: async (id: string) => { calls.push(id); return null; } },
    export: { render: async () => new Blob(['output']) } };
  const runtime = await createRuntime(tool, host, { hero: asset, rows: [{ image: { ...asset, pin: { version: 'another', format: 'png' } } }] });
  const canvas = new JSDOM('<div id="canvas"></div>').window.document.getElementById('canvas')!;
  await runtime.export(canvas, 'png', { c2pa: true });
  assert.deepEqual(calls.sort(), [encodeAssetVersion(asset.id, pin), encodeAssetVersion(asset.id, { version: 'another', format: 'png' })].sort());
  runtime.destroy();
});
