// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readBrandSystem, brandSystemOf } from '../engine/src/brand-system.ts';
import { brandContext, contextTokens } from '../engine/src/brand-context.ts';
import { TOKEN_EXT } from '../engine/src/token-ext.ts';

for (const name of ['harbour', 'atelier']) test(`${name}: custom vocabulary survives the existing context envelope`, () => {
  const value = JSON.parse(readFileSync(new URL(`./fixtures/brand-systems/${name}.json`, import.meta.url), 'utf8'));
  assert.deepEqual(readBrandSystem(value), value);
  const doc = { color: { ink: { $type: 'color', $value: '#123456' } }, $extensions: { [TOKEN_EXT]: { brandSystem: value }, 'foreign.vendor': { retained: true } } };
  const roundtrip = contextTokens(JSON.parse(JSON.stringify(brandContext(doc))));
  assert.deepEqual(roundtrip, doc);
  assert.deepEqual(brandSystemOf(roundtrip), value);
  const returned = readBrandSystem(value)!;
  returned.roles[0]!.label = 'Changed';
  assert.notEqual(value.roles[0].label, 'Changed');
  assert.equal(readBrandSystem({ ...value, schemaVersion: 2 }), null);
  assert.equal(readBrandSystem({ ...value, roles: [...value.roles, value.roles[0]] }), null);
  assert.equal(readBrandSystem({ ...value, bindings: [{ id: 'b', roleId: 'missing', consumer: { slot: 'anything' } }] }), null);
});
test('legacy tokens need no migration; invalid approval is not read as approved', () => {
  assert.equal(brandSystemOf({ color: {} }), null);
  const value = JSON.parse(readFileSync(new URL('./fixtures/brand-systems/harbour.json', import.meta.url), 'utf8'));
  value.rules[0].review = { state: 'approved' };
  assert.equal(readBrandSystem(value), null);
});

test('custom role files participate in published-version pinning and frozen resolution', async () => {
  const { collectAssetTokens, applyPinnedAssets } = await import('../engine/src/design-version.ts');
  const doc = { $extensions: { 'com.suse.lolly': { brandSystem: { schemaVersion: 1, roles: [{ id: 'ribbon', label: 'Signal ribbon', resources: [{ type: 'asset', id: 'user/logo/ribbon' }] }] } } } };
  assert.equal(collectAssetTokens(doc)[0]?.id, 'user/logo/ribbon');
  const pinned = applyPinnedAssets(doc, [{ id: 'user/logo/ribbon', version: '1', sha256: 'known', frozenId: 'user/frozen/known' }]) as typeof doc;
  assert.equal(pinned.$extensions['com.suse.lolly'].brandSystem.roles[0]!.resources[0]!.id, 'user/frozen/known');
  assert.equal(doc.$extensions['com.suse.lolly'].brandSystem.roles[0]!.resources[0]!.id, 'user/logo/ribbon');
});
