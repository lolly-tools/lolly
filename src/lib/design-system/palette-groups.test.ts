// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokenSet, TOKEN_EXT } from '@lolly/engine';
import { addSwatch, setSwatchGroup, walkSwatches } from '../brand-doc.ts';
import { addPaletteGroup, changePaletteGroup, carryPaletteGroups, paletteGroups } from './palette-groups.ts';

const fresh = (): Record<string, unknown> => ({ $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } }], base: { color: { custom: { coral: { $type: 'color', $value: '#ef775d' } } } }, light: { color: { semantic: { primary: { $type: 'color', $value: '{color.custom.coral}' } } } } });

test('empty groups survive token JSON round trips without becoming phantom colours', () => {
  const doc = fresh();
  assert.equal(addPaletteGroup(doc, '  Summer  '), 'Summer');
  assert.equal(addPaletteGroup(doc, 'summer'), 'Summer');
  assert.equal(addPaletteGroup(doc, '  '), null);
  const saved = JSON.parse(JSON.stringify(doc));
  assert.deepEqual(paletteGroups(saved), ['Summer']);
  assert.equal(walkSwatches(saved, 'light').filter(s => s.kind !== 'semantic').length, 1);
  assert.equal(createTokenSet(saved, { theme: 'light' }).resolve('color.semantic.primary'), '#ef775d');
});

test('rename and ungroup preserve colours and role aliases in both themes', () => {
  const doc = fresh();
  addPaletteGroup(doc, 'Summer');
  setSwatchGroup(doc, ['base', 'color', 'custom', 'coral'], 'Summer');
  const added = addSwatch(doc, 'custom', 'Ink', '#142823', { displayGroup: 'Summer' });
  assert.ok(added);
  assert.ok(changePaletteGroup(doc, 'Summer', 'Warm'));
  assert.deepEqual(paletteGroups(doc), ['Warm']);
  assert.ok(walkSwatches(doc, 'light').filter(s => s.kind === 'custom').every(s => s.group === 'Warm'));
  assert.ok(changePaletteGroup(doc, 'Warm', null));
  assert.deepEqual(paletteGroups(doc), []);
  assert.equal(walkSwatches(doc, 'light').filter(s => s.kind === 'custom').length, 2);
  assert.equal(createTokenSet(doc, { theme: 'light' }).resolve('color.semantic.primary'), '#ef775d');
});

test('renaming into an existing group merges it without erasing other extensions', () => {
  const doc = fresh();
  doc.$extensions = { unrelated: { data: true }, [TOKEN_EXT]: { excluded: ['color.x'] } };
  addPaletteGroup(doc, 'Warm'); addPaletteGroup(doc, 'Cool');
  assert.ok(changePaletteGroup(doc, 'Warm', 'cool'));
  assert.deepEqual(paletteGroups(doc), ['Cool']);
  assert.deepEqual((doc.$extensions as any).unrelated, { data: true });
  assert.deepEqual((doc.$extensions as any)[TOKEN_EXT].excluded, ['color.x']);
});

test('a shade rebuild retains empty groups and the placement of surviving colours', () => {
  const source = fresh(), next = fresh();
  addPaletteGroup(source, 'Summer'); addPaletteGroup(source, 'Next season');
  setSwatchGroup(source, ['base', 'color', 'custom', 'coral'], 'Summer');
  carryPaletteGroups(source, next);
  assert.deepEqual(paletteGroups(next), ['Summer', 'Next season']);
  assert.equal(walkSwatches(next, 'light').find(s => s.key === 'color.custom.coral')?.group, 'Summer');
});
