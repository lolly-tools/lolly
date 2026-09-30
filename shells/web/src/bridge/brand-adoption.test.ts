// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrandAdoptionAPI, type AdoptionDb } from './brand-adoption.ts';
import type { DesignSystemRecord } from '../lib/design-system/registry.ts';
import { prepareTokenAdoption } from '../lib/design-system/adoption-material.ts';
import { selectAdoptionFonts } from '../lib/design-system/adoption-fonts.ts';

function database() {
  const record: DesignSystemRecord = { id: 'harbour', label: 'Harbour', ns: 'user/ds/harbour/', headId: 'user/ds/harbour/tokens/brand', source: { kind: 'local' }, locked: false, createdAt: 1, lastUsedAt: 1 };
  const stores = new Map<string, Map<any, any>>([
    ['user-assets', new Map([[record.headId, { id: record.headId, type: 'tokens', format: 'json', version: 'before', blob: new Blob(['{"old":true}']) }]])],
    ['profile', new Map([['active-design-system', record.id]])],
    ['design-systems', new Map([[record.id, record]])],
  ]);
  let failAt = 0;
  let writes = 0;
  const db: AdoptionDb = { transaction(names, mode) {
    const scratch = structuredClone(stores);
    let aborted = false;
    let resolve!: () => void;
    let reject!: (reason: Error) => void;
    const done = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    setImmediate(() => {
      if (aborted) return;
      if (mode === 'readwrite') for (const name of names) stores.set(name, scratch.get(name)!);
      resolve();
    });
    const write = () => { if (++writes === failAt) throw new Error('Injected storage failure'); };
    return { done, abort() { aborted = true; reject(new Error('Aborted')); }, objectStore(name) {
      const rows = scratch.get(name)!;
      return {
        get: async key => structuredClone(rows.get(key)),
        put: async (value, key) => { write(); rows.set(key ?? (value as { id: string }).id, structuredClone(value)); },
        delete: async key => { write(); rows.delete(key); },
      };
    } };
  } };
  const api = createBrandAdoptionAPI(db, () => {});
  return { db, api, stores, record, fail(n: number) { writes = 0; failAt = n; } };
}
const asset = (ns: string) => ({ id: `${ns}logo/new`, type: 'vector' as const, format: 'svg', blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }) });

test('ordinary rule edits keep import recovery receipts separate and still reject stale heads', async () => {
  const r = database();
  await r.api.commit(await r.api.prepare(await r.api.capture(), { doc: { imported: true } }));
  const key = `brand-adoption-recovery:${r.record.id}`;
  const receipt = structuredClone(r.stores.get('profile')!.get(key));
  const candidate = await r.api.prepare(await r.api.capture(), { doc: { ruleEdited: true } });
  await r.api.commit(candidate, { recovery: false });
  assert.deepEqual(r.stores.get('profile')!.get(key), receipt);
  assert.equal(await r.api.recovery(r.record.id), null, 'old import cannot overwrite the later rule edit');
  const stale = await r.api.prepare(await r.api.capture(), { doc: { stale: true } });
  r.stores.get('user-assets')!.get(r.record.headId).version = 'concurrent-edit';
  await assert.rejects(r.api.commit(stale, { recovery: false }), /changed/);
});

test('review is isolated and its candidate cannot be changed after preparation', async () => {
  const r = database();
  const snapshot = await r.api.capture();
  const doc = { next: true };
  const file = asset(r.record.ns);
  const candidate = await r.api.prepare(snapshot, { doc, assets: [file] });
  doc.next = false; file.id = 'user/elsewhere'; candidate.record.label = 'Changed by caller';
  assert.equal(r.stores.get('user-assets')!.size, 1);
  await r.api.commit(candidate);
  assert.equal(r.stores.get('design-systems')!.get(r.record.id).label, 'Harbour');
  assert.equal(await r.stores.get('user-assets')!.get(r.record.headId).blob.text(), '{"next":true}');
  assert.ok(r.stores.get('user-assets')!.has(`${r.record.ns}logo/new`));
  await assert.rejects(r.api.commit(candidate), /expired/);
});

test('failure at every write boundary leaves all active material and the pointer unchanged', async () => {
  for (let boundary = 1; boundary <= 5; boundary++) {
    const r = database();
    const before = structuredClone(r.stores);
    const candidate = await r.api.prepare(await r.api.capture(), { doc: { next: true }, assets: [asset(r.record.ns)] });
    r.fail(boundary);
    await assert.rejects(r.api.commit(candidate), /Injected/);
    assert.deepEqual(r.stores, before, `boundary ${boundary}`);
  }
});

test('changed head, selection, name, lock and asset collisions refuse stale adoption', async () => {
  const changes = [
    (r: ReturnType<typeof database>) => { r.stores.get('user-assets')!.get(r.record.headId).version = 'newer'; },
    (r: ReturnType<typeof database>) => { r.stores.get('profile')!.set('active-design-system', 'another'); },
    (r: ReturnType<typeof database>) => { r.stores.get('design-systems')!.get(r.record.id).label = 'Renamed'; },
    (r: ReturnType<typeof database>) => { r.stores.get('design-systems')!.get(r.record.id).locked = true; },
    (r: ReturnType<typeof database>) => { r.stores.get('user-assets')!.set(`${r.record.ns}logo/new`, { ...asset(r.record.ns), checksum: 'different' }); },
  ];
  for (const mutate of changes) {
    const r = database();
    const candidate = await r.api.prepare(await r.api.capture(), { doc: { next: true }, assets: [asset(r.record.ns)] });
    mutate(r);
    const before = structuredClone(r.stores);
    await assert.rejects(r.api.commit(candidate), /changed/);
    assert.deepEqual(r.stores, before);
  }
});

test('quota failure and a cancelled new-system review create no partial records', async () => {
  const r = database();
  const before = structuredClone(r.stores);
  const newRecord = { ...r.record, id: 'new', ns: 'user/ds/new/', headId: 'user/ds/new/tokens/brand' };
  await r.api.prepare(await r.api.capture({ create: newRecord }), { doc: { next: true } });
  assert.deepEqual(r.stores, before);
  const limited = createBrandAdoptionAPI(r.db, () => {}, async () => { throw new Error('Storage full'); });
  await assert.rejects(limited.prepare(await limited.capture(), { doc: {} }), /Storage full/);
  assert.deepEqual(r.stores, before);
});

test('recovery survives restart, restores record and references, and retains resource bytes', async () => {
  const r = database();
  await r.api.commit(await r.api.prepare(await r.api.capture(), { doc: { next: true }, assets: [asset(r.record.ns)], importedFonts: ['new-face'], appearance: { theme: 'dark' } }));
  const restarted = createBrandAdoptionAPI(r.db, () => {});
  assert.ok(await restarted.recovery(r.record.id));
  await restarted.restore(r.record.id);
  const restored = r.stores.get('user-assets')!.get(r.record.headId);
  assert.equal(await restored.blob.text(), '{"old":true}');
  assert.notEqual(restored.version, 'before', 'recovery must invalidate older review snapshots');
  assert.deepEqual(r.stores.get('design-systems')!.get(r.record.id), r.record);
  assert.ok(r.stores.get('user-assets')!.has(`${r.record.ns}logo/new`));
  assert.equal(await restarted.recovery(r.record.id), null);
});

test('recovery cannot overwrite later edits', async () => {
  const r = database();
  await r.api.commit(await r.api.prepare(await r.api.capture(), { doc: { next: true } }));
  r.stores.get('user-assets')!.get(r.record.headId).version = 'later-edit';
  assert.equal(await r.api.recovery(r.record.id), null);
  await assert.rejects(r.api.restore(r.record.id), /changed/);
  assert.equal(r.stores.get('user-assets')!.get(r.record.headId).version, 'later-edit');
});

test('custom device refs are copied and remapped without overwriting a shared file', async () => {
  const r = database();
  const source = { id: 'partner/ribbon', type: 'vector' as const, format: 'svg', blob: new Blob(['<svg/>']) };
  const doc = { $extensions: { 'com.suse.lolly': { brandSystem: { schemaVersion: 1, roles: [{ id: 'signal', label: 'Signal ribbon', resources: [{ type: 'asset', id: source.id }] }] } } } };
  const host = { brandAdoption: r.api, assets: { _getBlob: async (id: string) => id === source.id ? source.blob : null, get: async () => source } };
  const prepared = await prepareTokenAdoption(host, await r.api.capture(), doc, [], { validateFile: async () => {} });
  const id = (prepared.doc as typeof doc).$extensions['com.suse.lolly'].brandSystem.roles[0]!.resources[0]!.id;
  assert.match(id, /^user\/ds\/harbour\/logo\/adopt-/);
  assert.equal(doc.$extensions['com.suse.lolly'].brandSystem.roles[0]!.resources[0]!.id, source.id);
  await r.api.commit(prepared.candidate);
  assert.equal(await r.stores.get('user-assets')!.get(id).blob.text(), '<svg/>');
});

test('a missing device or undecodable font prevents adoption; font selection follows recovery', async () => {
  const r = database();
  const host = { brandAdoption: r.api, assets: { _getBlob: async () => null, get: async () => ({ type: 'vector' as const }) } };
  const snapshot = await r.api.capture();
  await assert.rejects(prepareTokenAdoption(host, snapshot, { asset: { mark: { $type: 'asset', $value: 'missing/mark' } } }), /unavailable/);
  const font = { id: 'user/fonts/same/0', type: 'font' as const, format: 'woff2', blob: new Blob(['bad']), meta: { family: 'Same' } };
  await assert.rejects(prepareTokenAdoption(host, snapshot, {}, [font], { validateFile: async () => { throw new Error('Invalid face'); } }), /Invalid face/);
  assert.equal(r.stores.get('user-assets')!.size, 1);
  const rows = [font, { ...font, id: 'new', meta: { family: 'Same', adoption: 'revision' } }, { ...font, id: 'older', meta: { family: 'Same', adoption: 'older' } }];
  assert.deepEqual(selectAdoptionFonts(rows, ['new']).map(v => v.id), ['new']);
  assert.deepEqual(selectAdoptionFonts(rows).map(v => v.id), [font.id]);
});

test('new-system recovery returns to the former system without deleting imported files', async () => {
  const r = database();
  const record = { ...r.record, id: 'new', ns: 'user/ds/new/', headId: 'user/ds/new/tokens/brand' };
  const candidate = await r.api.prepare(await r.api.capture({ create: record }), { doc: {}, assets: [asset(record.ns)] });
  await r.api.commit(candidate);
  assert.equal(r.stores.get('profile')!.get('active-design-system'), 'new');
  await r.api.restore('new');
  assert.equal(r.stores.get('profile')!.get('active-design-system'), 'harbour');
  assert.equal(r.stores.get('design-systems')!.has('new'), false);
  assert.ok(r.stores.get('user-assets')!.has(`${record.ns}logo/new`));
});

test('a referenced file changing during review or before recovery cannot be overwritten', async () => {
  for (const duringReview of [true, false]) {
    const r = database();
    const file = { ...asset(r.record.ns), version: 'original', checksum: 'original' };
    r.stores.get('user-assets')!.set(file.id, file);
    r.stores.get('user-assets')!.get(r.record.headId).blob = new Blob([JSON.stringify({ logo: { $type: 'asset', $value: file.id } })]);
    const candidate = await r.api.prepare(await r.api.capture(), { doc: {} });
    if (!duringReview) await r.api.commit(candidate);
    r.stores.get('user-assets')!.get(file.id).version = 'edited';
    const before = structuredClone(r.stores);
    await assert.rejects(duringReview ? r.api.commit(candidate) : r.api.restore(r.record.id), /changed/);
    assert.deepEqual(r.stores, before);
  }
});

test('later ordinary font installs take precedence over an imported family', () => {
  const rows = [
    { id: 'old', meta: { family: 'Same', modifiedAt: 1 } },
    { id: 'import', meta: { family: 'Same', modifiedAt: 2, adoption: 'revision' } },
    { id: 'later', meta: { family: 'Same', modifiedAt: 3 } },
  ];
  assert.deepEqual(selectAdoptionFonts(rows.slice(0, 2), ['import']).map(r => r.id), ['import']);
  assert.deepEqual(selectAdoptionFonts(rows, ['import']).map(r => r.id), ['old', 'later']);
});

test('brand package adoption verifies every part, decodes before writing, and remaps custom devices', async () => {
  const { strToU8 } = await import('fflate');
  const { buildIntegrity } = await import('../lib/bundle.ts');
  const { adoptBrandPack } = await import('../lib/design-system/adoption-pack.ts');
  const r = database();
  const host = { brandAdoption: r.api, assets: {
    _getBlob: async (id: string) => r.stores.get('user-assets')!.get(id)?.blob ?? null,
    get: async (id: string) => r.stores.get('user-assets')!.get(id),
  } };
  const doc = { $extensions: { 'com.suse.lolly': { brandSystem: { schemaVersion: 1, roles: [{ id: 'signal', label: 'Signal ribbon', resources: [{ type: 'asset', id: 'user/logo/ribbon' }] }] } } } };
  const parts = {
    'tokens.json': strToU8(JSON.stringify(doc)),
    'logos.json': strToU8(JSON.stringify([{ id: 'user/logo/ribbon', file: 'logos/ribbon.svg', format: 'svg' }])),
    'logos/ribbon.svg': strToU8('<svg/>'),
    'fonts.json': strToU8(JSON.stringify([
      { id: 'user/fonts/current/0', file: 'fonts/current.woff2', format: 'woff2', meta: { family: 'Editorial' } },
      { id: 'user/fonts/archive/0', file: 'fonts/archive.woff2', format: 'woff2', meta: { family: 'Editorial' }, selected: false },
    ])),
    'fonts/current.woff2': strToU8('current bytes'),
    'fonts/archive.woff2': strToU8('archive bytes'),
  };
  const files = { ...parts, 'manifest.json': strToU8(JSON.stringify({ format: 'lolly-brand', minReader: 3, integrity: await buildIntegrity(parts) })) };
  const before = structuredClone(r.stores);
  await assert.rejects(adoptBrandPack(host, files, 2), /newer/);
  await assert.rejects(adoptBrandPack(host, { ...files, 'logos/ribbon.svg': strToU8('corrupt') }, 3), /integrity/);
  await assert.rejects(adoptBrandPack(host, files, 3, { validateFile: async () => { throw new Error('Decode failed'); } }), /Decode failed/);
  assert.deepEqual(r.stores, before);
  const summary = await adoptBrandPack(host, files, 3, { validateFile: async () => { assert.deepEqual(r.stores, before); } });
  assert.equal(summary.logos, 1);
  const head = JSON.parse(await r.stores.get('user-assets')!.get(r.record.headId).blob.text());
  const ref = head.$extensions['com.suse.lolly'].brandSystem.roles[0].resources[0].id;
  assert.match(ref, /^user\/ds\/harbour\/logo\/adopt-/);
  assert.equal(await r.stores.get('user-assets')!.get(ref).blob.text(), '<svg/>');
  const selected = r.stores.get('design-systems')!.get(r.record.id).importedFonts as string[];
  assert.equal(selected.length, 1);
  assert.equal(await r.stores.get('user-assets')!.get(selected[0]!).blob.text(), 'current bytes');
  assert.equal([...r.stores.get('user-assets')!.values()].filter(row => row.type === 'font').length, 2);
  await r.api.restore(r.record.id);
  assert.equal(await r.stores.get('user-assets')!.get(r.record.headId).blob.text(), '{"old":true}');
});

test('another namespace or a trashed newer font cannot shadow the active imported family', async () => {
  const { listUserFonts } = await import('../user-fonts.ts');
  const rows = [
    { id: 'user/ds/harbour/fonts/selected/0', type: 'font', blob: new Blob(['face']), meta: { family: 'Same', modifiedAt: 2, adoption: 'new' } },
    { id: 'user/ds/other/fonts/selected/0', type: 'font', blob: new Blob(['other']), meta: { family: 'Same', modifiedAt: 3 } },
    { id: 'user/ds/harbour/fonts/trash/0', type: 'font', blob: new Blob(['trash']), meta: { family: 'Same', modifiedAt: 4 }, trashedAt: 'today' },
  ];
  const host = { designSystems: { active: async () => ({ id: 'harbour', importedFonts: [rows[0]!.id] }) }, assets: { _exportUserAssets: async () => rows } };
  const fonts = await listUserFonts(host as never);
  assert.deepEqual(fonts.map(f => f.assetIds), [[rows[0]!.id]]);
});

test('published versions retain their bytes, frozen files and existing local ledger', async () => {
  const { withVersionIndex, readVersionIndex, versionAssetId, frozenAssetId, sha256Hex, docChecksum, applyPinnedAssets } = await import('../../../../engine/src/design-version.ts');
  const r = database();
  const oldEntry = { slug: 'local', label: 'Local', date: '2026-01-01', checksum: 'unchanged' };
  const head = r.stores.get('user-assets')!.get(r.record.headId);
  head.blob = new Blob([JSON.stringify(withVersionIndex({ old: true }, { versions: [oldEntry], active: null }))]);
  const original = new Blob(['<svg>old</svg>']);
  const sha = await sha256Hex(new Uint8Array(await original.arrayBuffer()));
  const frozenId = frozenAssetId(sha);
  const source = { logo: { $type: 'asset', $value: 'user/logo/mark' } };
  const entry = { slug: 'incoming', label: 'Incoming', date: '2026-02-01', checksum: await docChecksum(source), assets: [{ id: 'user/logo/mark', version: 'old-file', sha256: sha, frozenId }] };
  const doc = withVersionIndex(source, { versions: [entry], active: null });
  const incoming = [
    { id: 'user/logo/mark', type: 'vector' as const, format: 'svg', blob: new Blob(['<svg>new</svg>']) },
    { id: frozenId, type: 'vector' as const, format: 'svg', blob: original, version: 'old-file' },
    { id: versionAssetId(r.record.headId, entry.slug), type: 'tokens' as const, format: 'json', blob: new Blob([JSON.stringify(source)]), meta: { slug: entry.slug } },
  ];
  const host = { brandAdoption: r.api, assets: { _getBlob: async (id: string) => r.stores.get('user-assets')!.get(id)?.blob ?? null, get: async () => { throw new Error('No external file'); } } };
  const prepared = await prepareTokenAdoption(host, await r.api.capture(), doc, incoming, { validateFile: async () => {} });
  await r.api.commit(prepared.candidate);
  const ledger = readVersionIndex(prepared.doc);
  assert.deepEqual(ledger.versions[0], oldEntry);
  assert.equal(ledger.versions[1]!.assets![0]!.frozenId, frozenId);
  const version = JSON.parse(await r.stores.get('user-assets')!.get(versionAssetId(r.record.headId, entry.slug)).blob.text());
  assert.equal(await docChecksum(version), ledger.versions[1]!.checksum);
  const resolved = applyPinnedAssets(version, ledger.versions[1]!.assets!) as typeof source;
  assert.equal(resolved.logo.$value, frozenId);
  assert.equal(await r.stores.get('user-assets')!.get(frozenId).blob.text(), '<svg>old</svg>');
  const next = await prepareTokenAdoption(host, await r.api.capture(), { next: true });
  assert.deepEqual(readVersionIndex(next.doc), ledger, 'a token-only import must keep published history');
  await assert.rejects(prepareTokenAdoption(host, await r.api.capture(), withVersionIndex({}, { versions: [{ ...entry, slug: 'missing' }], active: null })), /without their files/);
});
