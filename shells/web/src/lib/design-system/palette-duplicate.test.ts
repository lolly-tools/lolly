// SPDX-License-Identifier: MPL-2.0
// The Colours room's Duplicate (palette-duplicate.ts): names, headings, order and independence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_EXT, createTokenSet } from '@lolly/engine';
import { setSwatchValue, walkSwatches, type BrandSwatch } from '../brand-doc.ts';
import { copyName, duplicateSwatches } from './palette-duplicate.ts';
import { paletteOrder } from './palette-order.ts';

const docOf = () => ({
  color: {
    $type: 'color',
    custom: {
      ink: { $type: 'color', $value: 'oklch(0.3 0.04 170)', $description: 'Ink' },
      paper: { $type: 'color', $value: '#faf5e9', $description: 'Paper' },
      mint: { $type: 'color', $value: '#3fd1a4', $description: 'Mint', $extensions: { [TOKEN_EXT]: { group: 'Brand' } } },
    },
    ramp: { primary: { 1: { $type: 'color', $value: '#123456' }, 2: { $type: 'color', $value: '#234567' } } },
    semantic: { primary: { $type: 'color', $value: '{color.custom.ink}' } },
  },
});
const swatches = (doc: unknown): BrandSwatch[] => walkSwatches(doc, 'light', key => createTokenSet(doc as never).resolve(key));
const byName = (doc: unknown, name: string): BrandSwatch => {
  const found = swatches(doc).find(s => s.name === name);
  assert.ok(found, name);
  return found;
};
const shownOf = (doc: unknown): string[] => swatches(doc).filter(s => s.kind !== 'semantic').map(s => s.key);

test('a copy is named after its source and steps past every name in use', () => {
  assert.equal(copyName('Bunyapine', new Set()), 'Bunyapine copy');
  assert.equal(copyName('Bunyapine', new Set(['bunyapine copy'])), 'Bunyapine copy 2');
  assert.equal(copyName('Bunyapine', new Set(['bunyapine copy', 'bunyapine copy 2'])), 'Bunyapine copy 3');
  assert.equal(copyName('  ', new Set()), 'Colour copy');
});

test('one swatch: a literal copy right after its source, under the same heading', () => {
  const doc = docOf();
  const shown = shownOf(doc);
  const { paths, keys } = duplicateSwatches(doc, [byName(doc, 'Mint')], { shown });
  assert.equal(paths.length, 1);
  const copy = byName(doc, 'Mint copy');
  assert.deepEqual(copy.path, paths[0]);
  assert.equal(copy.key, keys[0]);
  assert.equal(copy.raw, '#3fd1a4');
  assert.equal(copy.kind, 'custom');
  assert.equal(copy.group, 'Brand', 'filed under the heading the source shows under');
  const order = paletteOrder(doc);
  assert.equal(order[order.indexOf('color.custom.mint') + 1], copy.key, 'placed right after the source');
  assert.deepEqual(order.filter(k => k !== copy.key), shown, 'every other tile keeps its place');
});

test('several swatches: each copy follows its own source, and names never collide', () => {
  const doc = docOf();
  duplicateSwatches(doc, [byName(doc, 'Ink')], { shown: shownOf(doc) });
  const shown = shownOf(doc);
  const { paths } = duplicateSwatches(doc, [byName(doc, 'Ink'), byName(doc, 'Paper'), byName(doc, 'Ink copy')], { shown });
  assert.equal(paths.length, 3);
  const names = swatches(doc).map(s => s.name);
  assert.ok(names.includes('Ink copy 2'), 'a second copy of Ink steps past the first');
  assert.ok(names.includes('Paper copy'));
  assert.ok(names.includes('Ink copy copy'), 'a copy of a copy is named after that copy');
  assert.equal(new Set(names).size, names.length, 'no two swatches share a name');
  const order = paletteOrder(doc);
  const after = (name: string) => order[order.indexOf(byName(doc, name).key) + 1];
  assert.equal(after('Ink'), byName(doc, 'Ink copy 2').key);
  assert.equal(after('Paper'), byName(doc, 'Paper copy').key);
  assert.equal(after('Ink copy'), byName(doc, 'Ink copy copy').key);
  assert.equal(byName(doc, 'Ink copy 2').raw, 'oklch(0.3 0.04 170)', 'the stored notation travels with the value');
});

test('a copy is its own colour: changing either leaves the other alone', () => {
  const doc = docOf();
  const [path] = duplicateSwatches(doc, [byName(doc, 'Paper')], { shown: shownOf(doc) }).paths;
  setSwatchValue(doc, path!, '#ffffff');
  assert.equal(byName(doc, 'Paper').raw, '#faf5e9', 'moving the copy leaves the source');
  setSwatchValue(doc, byName(doc, 'Paper').path, '#000000');
  assert.equal(byName(doc, 'Paper copy').raw, '#ffffff', 'moving the source leaves the copy');
});

test('a ramp step copies as a fixed colour under its ramp heading; a role alias is skipped', () => {
  const doc = docOf();
  const step = swatches(doc).find(s => s.kind === 'ramp' && s.key.endsWith('.1'))!;
  const role = swatches(doc).find(s => s.kind === 'semantic')!;
  const { paths } = duplicateSwatches(doc, [step, role], { shown: shownOf(doc) });
  assert.equal(paths.length, 1, 'the role tile is not copied');
  const copy = swatches(doc).find(s => s.path.join('.') === paths[0]!.join('.'))!;
  assert.equal(copy.kind, 'custom');
  assert.equal(copy.raw, '#123456');
  assert.equal(copy.group, step.group);
  assert.equal(copy.isAlias, false);
});

test('a copy of a colour held as an alias holds the colour, not the alias', () => {
  const doc = docOf();
  (doc.color.custom as Record<string, unknown>).echo = { $type: 'color', $value: '{color.custom.paper}', $description: 'Echo' };
  duplicateSwatches(doc, [byName(doc, 'Echo')], { shown: shownOf(doc) });
  assert.equal(byName(doc, 'Echo copy').raw, '#faf5e9');
});

test('a brand colour copies beside itself: same group, no jump in group order, no print lock', () => {
  const doc = docOf() as Record<string, any>;
  doc.color.brand = { bunyapine: { $type: 'color', $value: '#008657', $description: 'Bunyapine', $extensions: { [TOKEN_EXT]: { cmyk: [100, 0, 60, 30] } } } };
  const source = byName(doc, 'Bunyapine');
  assert.equal(source.kind, 'other');
  assert.ok(source.lock, 'the source carries a print lock');
  const [path] = duplicateSwatches(doc, [source], { shown: shownOf(doc) }).paths;
  assert.deepEqual(path, ['color', 'brand', 'bunyapine-copy']);
  const copy = byName(doc, 'Bunyapine copy');
  assert.equal(copy.kind, 'other', 'the same kind, so its heading keeps its place');
  assert.equal(copy.group, source.group);
  assert.equal(copy.lock, null, 'a lock pinned to the source colour does not follow the copy');
  assert.equal(doc.color.brand['bunyapine-copy'].$extensions, undefined);
});
