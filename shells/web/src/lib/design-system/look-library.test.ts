// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { exampleLooks, rankLocalLooks, lookTags, localLook, readLocalLooks, LOOK_BYTES } from './look-library.ts';
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
