// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { exampleLooks, rankLocalLooks, lookTags, localLook, readLocalLooks, LOOK_BYTES, lookTagline, hueFamily, hueMood, lookPalette } from './look-library.ts';
import type { DesignSystemRegistry } from './registry.ts';

test('local discovery filters explicit tags and fonts and puts an identical palette first', () => {
  const examples = exampleLooks();
  assert.deepEqual(rankLocalLooks(examples, 'warm').map(l => l.name), ['Sunroom']);
  assert.equal(rankLocalLooks(examples, '', examples[1])[0]?.id, examples[1]?.id);
  assert.deepEqual(rankLocalLooks(examples, 'unrecorded'), []);
  const custom = localLook('custom', 'My look', 'saved', { font: { brand: { $type: 'fontFamily', $value: 'Example Sans' } } });
  assert.equal(rankLocalLooks([...examples, custom], 'example sans')[0]?.id, 'custom');
  assert.deepEqual(lookTags([' Calm ', 'calm', '', 9, 'Green']), ['calm', 'green']);
});
test('library bounds file reads and retains usable systems when one cannot be previewed', async () => {
  let oversizedRead = false;
  const rows = async () => [{ id: 'ok', label: 'Mine', headId: 'ok', tags: ['Mine'] }, { id: 'large', headId: 'large' }, { id: 'bad', headId: 'bad' }];
  const result = await readLocalLooks({
    designSystems: { list: rows, visible: rows } as unknown as DesignSystemRegistry,
    assets: { _getBlob: async id => {
      if (id === 'large') return { size: LOOK_BYTES + 1, text: async () => { oversizedRead = true; return '{}'; } } as Blob;
      return new Blob([id === 'ok' ? JSON.stringify(exampleLooks()[0]!.doc) : '{bad']);
    } },
  });
  assert.equal(oversizedRead, false);
  assert.equal(result.unavailable, 2);
  assert.equal(result.looks.filter(l => l.source === 'saved').length, 1);
  assert.deepEqual(result.looks.find(l => l.id === 'ok')?.tags, ['mine']);
});
test('every look has a tag line: written tags first, measured words otherwise', () => {
  for (const look of exampleLooks()) assert.equal(lookTagline(look).length, 3, look.name);
  assert.deepEqual(lookTagline(exampleLooks()[0]!), ['calm', 'green', 'nature']);
  // A shipped or saved system with no tags (Lolly Demo, Lolly Starter) is described
  // by its lead and second colours, never by a count or a typeface name.
  const deepTeal = localLook('lolly-demo', 'Lolly Demo', 'saved', {
    color: { semantic: { primary: { $type: 'color', $value: '#003B36' }, secondary: { $type: 'color', $value: '#50C369' } } },
    font: { brand: { $type: 'fontFamily', $value: 'Crossland' } },
  });
  assert.deepEqual(lookTagline(deepTeal), ['deep', 'teal', 'green']);
  const ink = localLook('lolly-start', 'Lolly Starter', 'saved', { color: { neutral: { 1: { $type: 'color', $value: '#1d1d1d' } } } });
  assert.deepEqual(lookTagline(ink), ['neutral']);
  const tagged = localLook('mine', 'Mine', 'saved', deepTeal.doc, ['School']);
  assert.deepEqual(lookTagline(tagged), ['school'], 'a written tag stands alone');
  // The measured words are search terms too.
  assert.deepEqual(rankLocalLooks([deepTeal, ink], 'teal').map(l => l.id), ['lolly-demo']);
});

test('colour families and moods are measured in OKLCH', () => {
  assert.equal(hueFamily('#39734D'), 'green');
  assert.equal(hueFamily('#8551C8'), 'purple');
  assert.equal(hueFamily('#BE522A'), 'orange');
  assert.equal(hueFamily('#c0392b'), 'red');
  assert.equal(hueFamily('#f1c40f'), 'yellow');
  assert.equal(hueFamily('#2a6fdb'), 'blue');
  assert.equal(hueFamily('#d94f8c'), 'pink');
  assert.equal(hueFamily('#1d1d1d'), 'neutral');
  assert.equal(hueFamily('not a colour'), null);
  assert.equal(hueMood('#003B36'), 'deep');
  assert.equal(hueMood('#2a6fdb'), null, 'the middle band says nothing');
  assert.equal(hueMood('#1d1d1d'), null, 'a grey has no mood word');
});

test('the In context palette leads with the roles and repeats no colour', () => {
  const look = exampleLooks()[2]!;
  const { colors, roles } = lookPalette(look);
  assert.equal(colors[0], roles.primary);
  assert.equal(new Set(colors.map(c => c.toLowerCase())).size, colors.length);
  assert.ok(roles.surface && roles.text);
  assert.deepEqual(lookPalette(localLook('empty', 'Empty', 'saved', {})).colors, []);
});
