// SPDX-License-Identifier: MPL-2.0
/**
 * What Rebuild palette keeps from the root `$extensions`. The whole path through the room
 * is in lib/brand-editor-leads.test.ts; these pin the rules of the copy itself.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/carry-extensions.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_EXT, readRecordedBrandPage, settleBrandPageWrite, withRecordedBrandPage } from '@lolly/engine';
import { carryRootExtensions } from './carry-extensions.ts';

type Rec = Record<string, unknown>;

const vendorOf = (doc: Rec): Rec => (doc.$extensions as Rec)[TOKEN_EXT] as Rec;

test('a document with no root record adds nothing', () => {
  for (const from of [{}, { $extensions: 'junk' }, null, 'junk', { $extensions: [] }]) {
    const to: Rec = { base: {} };
    carryRootExtensions(from, to);
    assert.deepEqual(to, { base: {} }, JSON.stringify(from));
  }
});

test('every key a rebuild does not decide comes across, cloned', () => {
  const brandSystem = { schemaVersion: 1, id: 'x', label: 'X', roles: [], bindings: [], rules: [] };
  const from: Rec = { $extensions: { [TOKEN_EXT]: { brandSystem, shareCards: 'opal', emoji: { schemaVersion: 1 }, emojiAssets: [{ id: 'a' }], versions: { list: [], active: null }, designSystem: { id: 'x', label: 'X' }, reference: { method: 'upload' }, recipes: [] }, 'org.example': { kept: true } } };
  const to: Rec = {};
  carryRootExtensions(from, to);
  assert.deepEqual(to, from);
  assert.notEqual(vendorOf(to).brandSystem, brandSystem, 'a copy, so a later edit cannot reach the old document');
});

test('a key the rebuild decides stays as the rebuild left it, present or absent', () => {
  const from: Rec = { $extensions: { [TOKEN_EXT]: { excluded: ['color.ramp.primary.2'], paletteOrder: ['a'], paletteGroups: ['Old'], themeAxes: { contrast: {} }, shareCards: 'opal' } } };
  const to: Rec = { $extensions: { [TOKEN_EXT]: { paletteGroups: ['New'] } } };
  carryRootExtensions(from, to);
  assert.deepEqual(vendorOf(to), { paletteGroups: ['New'], shareCards: 'opal' });
});

test('a key the rebuild already carried wins', () => {
  const from: Rec = { $extensions: { [TOKEN_EXT]: { brandSystem: { from: 'old' } }, 'org.example': { from: 'old' } } };
  const to: Rec = { $extensions: { [TOKEN_EXT]: { brandSystem: { from: 'carried' } }, 'org.example': { from: 'new' } } };
  carryRootExtensions(from, to);
  assert.deepEqual(to, { $extensions: { [TOKEN_EXT]: { brandSystem: { from: 'carried' } }, 'org.example': { from: 'new' } } });
});

test('a record that does not validate is kept as it stood', () => {
  const from: Rec = { $extensions: { [TOKEN_EXT]: { brandSystem: { schemaVersion: 99, nonsense: true } }, 'org.example': 3 } };
  const to: Rec = {};
  carryRootExtensions(from, to);
  assert.deepEqual(to, from);
  const junkVendor: Rec = {};
  carryRootExtensions({ $extensions: { [TOKEN_EXT]: 'junk' } }, junkVendor);
  assert.deepEqual(junkVendor, { $extensions: { [TOKEN_EXT]: 'junk' } });
});

test('a key that names part of the object model is never written', () => {
  const from = JSON.parse(`{ "$extensions": { "__proto__": { "polluted": 1 }, "${TOKEN_EXT}": { "__proto__": { "polluted": 1 }, "constructor": { "polluted": 1 }, "shareCards": "opal" } } }`) as Rec;
  const to: Rec = {};
  carryRootExtensions(from, to);
  assert.deepEqual(Object.keys(to.$extensions as Rec), [TOKEN_EXT]);
  assert.deepEqual(Object.keys(vendorOf(to)), ['shareCards']);
  assert.equal(({} as Rec).polluted, undefined);
  assert.equal(Object.getPrototypeOf(vendorOf(to)), Object.prototype);
});

test('the brand page rule holds: only settleBrandPageWrite decides what a head keeps', () => {
  const page = 'https://brand.example/acme';
  const head = withRecordedBrandPage({ base: {} }, page);
  const noSetting = { base: {} };

  // The head chose an address and a rebuild keeps the setting.
  const rebuilt: Rec = { base: { rebuilt: true } };
  carryRootExtensions(head, rebuilt);
  assert.equal(readRecordedBrandPage(settleBrandPageWrite(rebuilt, head)), page);

  // A document holding an address its head never chose gets no further than it did.
  const planted: Rec = { base: { rebuilt: true } };
  carryRootExtensions(withRecordedBrandPage({ base: {} }, page), planted);
  assert.equal(readRecordedBrandPage(settleBrandPageWrite(planted, noSetting)), null);
  assert.deepEqual(settleBrandPageWrite(planted, noSetting), { base: { rebuilt: true } }, 'and its containers are pruned');

  // A head whose setting is off, written over an unrelated document, stays off.
  const plain: Rec = { base: { rebuilt: true } };
  carryRootExtensions(noSetting, plain);
  assert.deepEqual(settleBrandPageWrite(plain, noSetting), { base: { rebuilt: true } });
});
