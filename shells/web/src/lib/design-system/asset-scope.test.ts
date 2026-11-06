// SPDX-License-Identifier: MPL-2.0
/**
 * Which catalog rows are listed for the design system a person is using (asset-scope.ts).
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/asset-scope.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssetsAPI } from '../../bridge/assets.ts';
import {
  assetInScope, assetNamespace, companionOwning, pickPalette, readAssetScope, readCompanionAssets,
  serverDrawsOtherSystem, type AssetScope, type CompanionAssets,
} from './asset-scope.ts';
import { activeSkillsOf, skillBelongsTo } from './brand-skills.ts';
import { ACTIVE_DESIGN_SYSTEM_KEY, DESIGN_SYSTEMS_STORE } from './registry.ts';
import { starterSeed } from './starter.ts';

const DEMO: CompanionAssets = {
  tokens: 'lolly/tokens/demo', label: 'Lolly Demo',
  assets: ['lolly/tokens/demo', 'lolly/logo/', 'lolly/icons/', 'lolly/font/', 'lolly/palette/opal-', 'lolly/demo/lorikeet-lollipop'],
};
const shippedScope: AssetScope = { companions: [DEMO], shippedNamespace: 'suse/', active: null };
const demoScope: AssetScope = { ...shippedScope, active: DEMO };

test('the index entries that own rows are read; a companion that brings none has no scope', () => {
  assert.deepEqual(readCompanionAssets(undefined), []);
  assert.deepEqual(readCompanionAssets('x'), []);
  // lolly.tools' companion is the bundled starter: no rows, so lolly.tools has no scope.
  assert.deepEqual(readCompanionAssets([{ tokens: 'lolly/tokens/brand', label: 'Lolly Starter' }]), []);
  assert.deepEqual(readCompanionAssets([{ tokens: 'a/tokens/b', label: 'A', assets: [] }]), []);
  assert.deepEqual(readCompanionAssets([{ tokens: 'a/tokens/b', label: ' A ', assets: ['a/logo/', 3] }]), [{ tokens: 'a/tokens/b', label: 'A', assets: ['a/logo/'] }]);
});

test('ownership is by name: an exact id, or a family prefix', () => {
  assert.equal(companionOwning('lolly/logo/primary', [DEMO]), DEMO);
  assert.equal(companionOwning('lolly/palette/opal-icon-themes', [DEMO]), DEMO);
  assert.equal(companionOwning('lolly/demo/lorikeet-lollipop', [DEMO]), DEMO);
  assert.equal(companionOwning('lolly/demo/sample-photo', [DEMO]), null, 'a sample SUSE also holds is nobody\'s');
  assert.equal(companionOwning('suse/logo/primary', [DEMO]), null);
  assert.equal(assetNamespace('lolly/tokens/demo'), 'lolly/');
  assert.equal(assetNamespace('nothing'), '');
});

test('no scope lists everything', () => {
  for (const id of ['suse/logo/primary', 'lolly/logo/primary', 'community/emoji/noto/color']) assert.equal(assetInScope(id, null), true);
});

test("under the catalog's own system everything it had stays, and only the companion's rows go", () => {
  for (const id of ['suse/logo/primary', 'suse/icons/x', 'suse/skill/brand', 'suse/lottie/y', 'lolly/demo/sample-photo', 'lolly/demo/lolly-spin', 'community/emoji/noto/color', 'inst/hero', 'ext/brand/photo']) {
    assert.equal(assetInScope(id, shippedScope), true, id);
  }
  for (const id of ['lolly/logo/primary', 'lolly/icons/award', 'lolly/font/outfit', 'lolly/tokens/demo', 'lolly/palette/opal-icon-themes', 'lolly/demo/lorikeet-lollipop']) {
    assert.equal(assetInScope(id, shippedScope), false, id);
  }
});

test("under the companion its rows and the shared ones are listed, the catalog's own are not", () => {
  for (const id of ['lolly/logo/primary', 'lolly/icons/award', 'lolly/demo/sample-photo', 'community/emoji/noto/color', 'inst/hero']) {
    assert.equal(assetInScope(id, demoScope), true, id);
  }
  for (const id of ['suse/logo/primary', 'suse/icons/x', 'suse/skill/brand']) assert.equal(assetInScope(id, demoScope), false, id);
});

test('a palette is chosen by the asset it answers for, else by the active system', () => {
  const rows = [
    { id: 'lolly/palette/opal-icon-themes', type: 'palette', tags: ['icon-themes'] },
    { id: 'suse/palette/icon-themes', type: 'palette', tags: ['icon-themes'] },
    { id: 'suse/palette/brand-core', type: 'palette', tags: ['brand-core'] },
  ];
  const id = (row: { id: string } | undefined) => row?.id;
  assert.equal(id(pickPalette(rows, 'icon-themes', shippedScope)), 'suse/palette/icon-themes');
  assert.equal(id(pickPalette(rows, 'icon-themes', demoScope)), 'lolly/palette/opal-icon-themes');
  assert.equal(id(pickPalette(rows, 'icon-themes', demoScope, 'suse/icons/x')), 'suse/palette/icon-themes', 'a saved SUSE icon keeps SUSE pairings under Lolly Demo');
  assert.equal(id(pickPalette(rows, 'icon-themes', shippedScope, 'lolly/icons/award')), 'lolly/palette/opal-icon-themes');
  assert.equal(id(pickPalette(rows, 'icon-themes', demoScope, 'user/raster/1')), 'lolly/palette/opal-icon-themes', 'an upload falls to the active system');
  assert.equal(id(pickPalette([rows[0]!], 'icon-themes', null)), 'lolly/palette/opal-icon-themes', 'one palette is the answer on a one-system catalog');
  assert.equal(pickPalette([], 'icon-themes', null), undefined);
});

function dbWith(rows: Record<string, Record<string, unknown>>) {
  return {
    async get(store: string, key: IDBValidKey) { return rows[store]?.[String(key)]; },
    async getAll(store: string) { return Object.values(rows[store] ?? {}); },
  };
}
const SOURCE = { origin: 'https://x.test', tokensHead: 'suse/tokens/brand', companions: [DEMO] };
const lollyDemo = { id: 'lolly-demo', label: 'Lolly Demo', source: { kind: 'local', from: 'app', companion: { tokens: 'lolly/tokens/demo', label: 'Lolly Demo', instance: true } } };
const META = { 'suse/tokens/brand': { id: 'suse/tokens/brand', type: 'tokens', name: 'SUSE Brand Design Tokens' } };

test('a catalog that declares nothing has no scope, whatever is active', async () => {
  assert.equal(await readAssetScope(dbWith({ profile: { 'catalog-source': { origin: 'x' } } })), null);
  assert.equal(await readAssetScope(dbWith({ profile: { [ACTIVE_DESIGN_SYSTEM_KEY]: 'lolly-demo' }, [DESIGN_SYSTEMS_STORE]: { 'lolly-demo': lollyDemo } })), null);
});

test('the active record says which side of the scope a device is on', async () => {
  const shipped = await readAssetScope(dbWith({ profile: { 'catalog-source': SOURCE, [ACTIVE_DESIGN_SYSTEM_KEY]: 'shipped' } }));
  assert.equal(shipped?.active, null);
  assert.equal(shipped?.shippedNamespace, 'suse/');
  const none = await readAssetScope(dbWith({ profile: { 'catalog-source': SOURCE } }));
  assert.equal(none?.active, null, 'a fresh profile has no pointer and reads as the catalog system');
  const demo = await readAssetScope(dbWith({ profile: { 'catalog-source': SOURCE, [ACTIVE_DESIGN_SYSTEM_KEY]: 'lolly-demo' }, [DESIGN_SYSTEMS_STORE]: { 'lolly-demo': lollyDemo } }));
  assert.equal(demo?.active?.tokens, 'lolly/tokens/demo');
  const copy = { id: 'my-copy', label: 'My copy', source: { kind: 'local', forkedFrom: { id: 'lolly-demo' } } };
  const forked = await readAssetScope(dbWith({ profile: { 'catalog-source': SOURCE, [ACTIVE_DESIGN_SYSTEM_KEY]: 'my-copy' }, [DESIGN_SYSTEMS_STORE]: { 'lolly-demo': lollyDemo, 'my-copy': copy } }));
  assert.equal(forked?.active?.tokens, 'lolly/tokens/demo', 'a copy of Lolly Demo draws from Lolly Demo');
  const own = { id: 'acme', label: 'Acme', source: { kind: 'local' } };
  const mine = await readAssetScope(dbWith({ profile: { 'catalog-source': SOURCE, [ACTIVE_DESIGN_SYSTEM_KEY]: 'acme' }, [DESIGN_SYSTEMS_STORE]: { acme: own } }));
  assert.equal(mine?.active, null, "a person's own system sees the instance's assets, as it does today");
});

test('a failed read lists everything rather than nothing', async () => {
  assert.equal(await readAssetScope({ get: async () => { throw new Error('idb gone'); } }), null);
});

test('the server is said to draw another system only on a scoped catalog with another system active', async () => {
  const draws = (rows: Record<string, Record<string, unknown>>) => serverDrawsOtherSystem(dbWith(rows));
  assert.equal(await draws({ profile: { 'catalog-source': SOURCE, [ACTIVE_DESIGN_SYSTEM_KEY]: 'shipped' }, 'asset-meta': META }), null);
  assert.equal(await draws({ profile: { 'catalog-source': SOURCE }, 'asset-meta': META }), null);
  assert.deepEqual(await draws({ profile: { 'catalog-source': SOURCE, [ACTIVE_DESIGN_SYSTEM_KEY]: 'lolly-demo' }, [DESIGN_SYSTEMS_STORE]: { 'lolly-demo': lollyDemo }, 'asset-meta': META }),
    { active: 'Lolly Demo', own: 'SUSE' });
  // A person's own system on that catalog gets the same answer: the server cannot see it either.
  assert.equal((await draws({ profile: { 'catalog-source': SOURCE, [ACTIVE_DESIGN_SYSTEM_KEY]: 'acme' }, [DESIGN_SYSTEMS_STORE]: { acme: { id: 'acme', label: 'Acme', source: { kind: 'local' } } }, 'asset-meta': META }))?.own, 'SUSE');
  // A single-system catalog stays exactly as it was.
  assert.equal(await draws({ profile: { 'catalog-source': { origin: 'x' }, [ACTIVE_DESIGN_SYSTEM_KEY]: 'acme' }, [DESIGN_SYSTEMS_STORE]: { acme: { id: 'acme', label: 'Acme', source: { kind: 'local' } } } }), null);
});

// The real bridge over a map, so what `query` lists is what every view reads.
function bridgeOver(active: string | null, companions: CompanionAssets[] | null) {
  const row = (id: string, type: string, tags: string[] = []) => ({ id, type, name: id, version: '1', tags, formats: [{ format: 'svg', url: `/catalog/${id}.svg` }] });
  const rows = [
    row('lolly/demo/sample-photo', 'raster', ['photo']),
    row('lolly/logo/primary', 'vector', ['logo']),
    row('suse/logo/primary', 'vector', ['logo']),
    row('suse/skill/brand', 'skill'),
    row('community/emoji/noto/color', 'data', ['emoji-pack']),
  ];
  const stores: Record<string, Record<string, unknown>> = {
    profile: { 'catalog-source': companions ? { ...SOURCE, companions } : { origin: 'x' }, ...(active ? { [ACTIVE_DESIGN_SYSTEM_KEY]: active } : {}) },
    [DESIGN_SYSTEMS_STORE]: { 'lolly-demo': lollyDemo },
    'asset-meta': Object.fromEntries(rows.map(r => [r.id, r])),
  };
  return createAssetsAPI(dbWith(stores) as never);
}
const ids = (refs: { id: string }[]) => refs.map(ref => ref.id).sort();

test('query lists the active system, and get stays global so saved work keeps drawing', async () => {
  const onSuse = bridgeOver('shipped', [DEMO]);
  assert.deepEqual(ids(await onSuse.query()), ['community/emoji/noto/color', 'lolly/demo/sample-photo', 'suse/logo/primary', 'suse/skill/brand']);
  const onDemo = bridgeOver('lolly-demo', [DEMO]);
  assert.deepEqual(ids(await onDemo.query()), ['community/emoji/noto/color', 'lolly/demo/sample-photo', 'lolly/logo/primary']);
  assert.deepEqual(ids(await onDemo.query({ tags: ['logo'] })), ['lolly/logo/primary'], 'a brand logo slot resolves to the active system');
  assert.deepEqual(ids(await onDemo._queryEverySystem()), ['community/emoji/noto/color', 'lolly/demo/sample-photo', 'lolly/logo/primary', 'suse/logo/primary', 'suse/skill/brand']);
  assert.equal((await onDemo._assetScope())?.active?.label, 'Lolly Demo');
});

test('a catalog with no companions lists every row through query, as it always did', async () => {
  const single = bridgeOver('shipped', null);
  assert.equal(await single._assetScope(), null);
  assert.deepEqual(ids(await single.query()), ids(await single._queryEverySystem()));
  assert.equal((await single.query()).length, 5);
});

test("skills stay with their system: SUSE's listed under SUSE, none under Lolly Demo", async () => {
  const shippedRecord = { id: 'shipped', source: { kind: 'shipped' } } as never;
  const demoRecord = lollyDemo as never;
  const onSuse = await bridgeOver('shipped', [DEMO]).query({ type: 'skill' });
  assert.deepEqual(ids(onSuse), ['suse/skill/brand']);
  assert.equal(skillBelongsTo({ id: 'suse/skill/brand', source: 'library' }, shippedRecord), true);
  assert.deepEqual(await bridgeOver('lolly-demo', [DEMO]).query({ type: 'skill' }), [], 'not listed under Lolly Demo');
  assert.equal(skillBelongsTo({ id: 'suse/skill/brand', source: 'library' }, demoRecord), false, 'and refused if it were');
  assert.deepEqual(activeSkillsOf(onSuse, demoRecord), []);
});

test("a blank new system does not pick up a companion's marks as its placeholder logos", async () => {
  const logoSlots = (doc: Record<string, unknown>) => Object.keys(((doc.base as { asset?: { logo?: object } }).asset?.logo) ?? {}).filter(key => !key.startsWith('$'));
  const seed = (ids: string[], scope: AssetScope | null) => starterSeed({ assets: {
    _getBlob: async () => null,
    _listCatalogAssetIds: async () => ids,
    _assetScope: async () => scope,
  } } as never);
  const marks = ['lolly/logo/primary', 'lolly/logo/reverse', 'lolly/logo/mono', 'lolly/logo/mono-reverse', 'lolly/logo/horizontal', 'lolly/logo/horizontal-reverse', 'lolly/logo/horizontal-on-brand'];
  const onLollyTools = await seed(['lolly/tokens/demo', ...marks], null);
  assert.ok(logoSlots(onLollyTools).length > 0, 'a catalog that ships the marks as its own keeps them');
  const onSuseOnly = await seed(['suse/tokens/brand', 'suse/logo/primary'], null);
  assert.deepEqual(logoSlots(onSuseOnly), [], 'a catalog without them drops the slots, as before');
  const beside = await seed(['suse/tokens/brand', 'suse/logo/primary', 'lolly/tokens/demo', ...marks], shippedScope);
  assert.deepEqual(logoSlots(beside), [], 'a catalog holding them for a companion drops the slots too');
});
