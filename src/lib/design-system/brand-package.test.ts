// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, unzipSync } from 'fflate';
import { buildBrandPackage, emptyBrandSelection, readBrandContent, importBrandContent, type BrandPackageHost } from './brand-package.ts';
import { importBrandPack } from '../../brand-transfer.ts';
import { readJson, verifyIntegrity } from '../bundle.ts';
import type { BeamAssetRecord } from '../beam-pack.ts';

function rig() {
  const records = new Map<string, BeamAssetRecord>();
  const slots = new Map<string, { data: Record<string, unknown>; thumb?: string | null }>();
  const brand = { id: 'acme', label: 'Acme', ns: 'user/ds/acme/', headId: 'user/ds/acme/tokens/brand', source: { kind: 'local' }, appearance: { theme: 'light' }, locked: false, createdAt: 1, lastUsedAt: 1 };
  records.set(brand.headId, { id: brand.headId, type: 'tokens', format: 'json', blob: new Blob([JSON.stringify({ color: { primary: { $type: 'color', $value: '#285540' } } })]) });
  const host = {
    designSystems: { get: async (id: string) => id === 'acme' ? brand : null, active: async () => brand, activeId: async () => 'different-active-brand', put: async () => {} },
    assets: {
      _exportUserAssets: async () => [...records.values()].filter(r => r.id.startsWith('user/')),
      _getBlob: async (id: string) => records.get(id)?.blob ?? null,
      _getUserRecord: async (id: string) => records.get(id) ?? null,
      _uploadUserAsset: async (r: BeamAssetRecord) => { records.set(r.id, r); },
      _deleteUserAsset: async (id: string) => { records.delete(id); },
      get: async (id: string) => { const r = records.get(id); if (!r) throw new Error('Missing'); return { ...r, source: id.startsWith('user/') ? 'user' : 'library', url: '' }; },
      _listUserAssets: async () => [], _listCatalogAssetIds: async () => [],
    },
    state: {
      list: async () => [...slots].map(([slot, { data, thumb }]) => ({ slot, toolId: data.__toolId, label: data.__label, thumb })),
      load: async (slot: string) => slots.get(slot)?.data ?? null,
      save: async (slot: string, data: Record<string, unknown>, thumb?: string | null) => { slots.set(slot, { data, thumb }); },
      delete: async (slot: string) => { slots.delete(slot); },
    },
    export: { download: async () => {} },
  } as unknown as BrandPackageHost;
  const image = (id: string, n: number, meta = {}) => records.set(id, { id, type: 'raster', format: 'png', blob: new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, n, 0, 0])], { type: 'image/png' }), meta });
  return { host, records, slots, image };
}
const unpack = async (blob: Blob) => unzipSync(new Uint8Array(await blob.arrayBuffer()));

test('brand only exports the named inactive brand without device content or active theme', async () => {
  const r = rig(); r.image('user/upload/private', 1);
  r.slots.set('private', { data: { __toolId: 'poster', __label: 'Private' } });
  const result = await buildBrandPackage(r.host, 'acme', emptyBrandSelection());
  const files = await unpack(result.blob);
  assert.equal(readJson(files, 'manifest.json').label, 'Acme');
  assert.equal(readJson(files, 'prefs.json').theme, 'light');
  assert.equal(files['content.json'], undefined);
  assert.equal(result.references, 0);
  assert.equal(r.slots.size, 1);
  assert.match(result.filename, /Acme.*\.lolly$/);
});

test('standalone brand carries referenced catalogue logos and rewrites their token ids', async () => {
  const r = rig(); r.image('catalog/logo/reverse', 1);
  r.records.get('user/ds/acme/tokens/brand')!.blob = new Blob([JSON.stringify({ asset: { logo: { 'vertical-primary-reverse': { $type: 'asset', $value: 'catalog/logo/reverse' } } } })]);
  const files = await unpack((await buildBrandPackage(r.host, 'acme', emptyBrandSelection())).blob);
  const logos = readJson(files, 'logos.json');
  assert.equal(logos.length, 1);
  assert.match(logos[0].id, /^user\/logo\/imported-/);
  assert.equal(readJson(files, 'tokens.json').asset.logo['vertical-primary-reverse'].$value, logos[0].id);
  assert.ok(files[logos[0].file]);
  assert.equal(r.records.has(logos[0].id), false, 'export must not mutate the source brand');
});

test('selection round trip carries shared session dependencies once, explicit catalogue items and no unselected data', async () => {
  const src = rig();
  src.image('user/upload/shared', 1); src.image('catalog/selected', 2, { license: 'proprietary' }); src.image('user/upload/private', 3);
  const data = { __toolId: 'poster', __label: 'Poster', image: { id: 'user/upload/shared', source: 'user', url: '' } };
  src.slots.set('a', { data, thumb: 'data:image/png;base64,AA==' }); src.slots.set('b', { data: { ...data, __label: 'Second' } }); src.slots.set('private', { data: { ...data, __label: 'Private' } });
  const out = await buildBrandPackage(src.host, 'acme', { sessions: ['a', 'b'], assets: ['catalog/selected'], tools: [] });
  const files = await unpack(out.blob);
  const manifest = readJson(files, 'manifest.json');
  assert.equal(manifest.minReader, 2);
  assert.deepEqual(manifest.contents, { sessions: 2, assets: 1, tools: 0, references: 0 });
  await verifyIntegrity(files, manifest.integrity, 'test');
  const content = (await readBrandContent(files))!;
  assert.deepEqual(content.payload.manifest.assets.map(a => a.id).sort(), ['catalog/selected', 'user/upload/shared']);
  const dst = rig(); dst.slots.set('existing', { data: { __toolId: 'poster', title: 'Keep me' } });
  const report = await importBrandContent(content, dst.host);
  assert.deepEqual(report, { sessions: 2, assets: 2, tools: 0, skippedTools: 0 });
  assert.equal(dst.slots.size, 3);
  const added = [...dst.slots].filter(([slot]) => slot !== 'existing');
  assert.ok(added.every(([slot]) => slot.startsWith('poster:')));
  assert.deepEqual(added.map(([, s]) => s.data.__label).sort(), ['Poster', 'Second']);
  const refs = added.map(([, s]) => (s.data.image as { id: string }).id);
  assert.equal(refs[0], refs[1]); assert.ok(dst.records.has(refs[0]!));
  assert.equal(dst.slots.get('existing')!.data.title, 'Keep me');
});

test('ordinary brand import restores the optional collection through the same intake', async () => {
  const src = rig(); src.slots.set('s', { data: { __toolId: 'poster', __label: 'Hello', title: 'World' } });
  const out = await buildBrandPackage(src.host, 'acme', { sessions: ['s'], assets: [], tools: [] });
  const dst = rig();
  const result = await importBrandPack({ host: dst.host, storage: { getItem: () => null, setItem() {} } }, await out.blob.arrayBuffer());
  assert.equal(result.tokens, true); assert.equal(result.contentSessions, 1); assert.equal(result.skipped, 0);
  assert.equal([...dst.slots.values()][0]!.data.title, 'World');
});

test('tool files travel intact and install only through the existing provision decision', async () => {
  const src = rig();
  const tool = { id: 'demo', trust: 'custom' as const, files: { 'tool.json': strToU8('{"id":"demo"}'), 'template.html': strToU8('<svg/>'), 'assets/image.png': new Uint8Array([1, 2, 3]) } };
  const out = await buildBrandPackage(src.host, 'acme', { sessions: [], assets: [], tools: ['demo'] }, { resolveTool: async () => tool });
  const content = (await readBrandContent(await unpack(out.blob)))!;
  assert.deepEqual(content.tools[0]!.files['tool/assets/image.png'], tool.files['assets/image.png']);
  let prompts = 0;
  const result = await importBrandContent(content, rig().host, async () => { prompts++; return false; });
  assert.equal(prompts, 1); assert.equal(result.skippedTools, 1); assert.equal(result.tools, 0);
});

test('missing selections fail explicitly, and unavailable dependencies are reported as references', async () => {
  const r = rig();
  await assert.rejects(buildBrandPackage(r.host, 'acme', { sessions: ['gone'], assets: [], tools: [] }), /no longer available/);
  await assert.rejects(buildBrandPackage(r.host, 'acme', { sessions: [], assets: ['gone'], tools: [] }), /no longer available/);
  r.slots.set('s', { data: { __toolId: 'poster', image: { id: 'user/upload/gone', source: 'user' } } });
  const out = await buildBrandPackage(r.host, 'acme', { sessions: ['s'], assets: [], tools: [] });
  assert.equal(out.references, 1);
});

test('nested corruption is rejected before any brand or session writes', async () => {
  const r = rig(); r.slots.set('s', { data: { __toolId: 'poster' } });
  const out = await buildBrandPackage(r.host, 'acme', { sessions: ['s'], assets: [], tools: [] });
  const files = await unpack(out.blob);
  files['content/collection.lolly'] = strToU8('broken');
  await assert.rejects(readBrandContent(files));
});

test('session write failure rolls back newly created slots and preserves existing ones', async () => {
  const src = rig(); src.slots.set('a', { data: { __toolId: 'poster' } }); src.slots.set('b', { data: { __toolId: 'poster' } });
  const out = await buildBrandPackage(src.host, 'acme', { sessions: ['a', 'b'], assets: [], tools: [] });
  const dst = rig(); dst.slots.set('keep', { data: { __toolId: 'old' } });
  const save = dst.host.state.save; let writes = 0;
  dst.host.state.save = async (...args) => { if (++writes === 2) throw new Error('disk full'); await save(...args); };
  await assert.rejects(importBrandContent((await readBrandContent(await unpack(out.blob)))!, dst.host), /disk full/);
  assert.deepEqual([...dst.slots.keys()], ['keep']);
});
