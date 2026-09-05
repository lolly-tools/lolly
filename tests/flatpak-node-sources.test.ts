// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeSources } from '../scripts/merge-flatpak-node-sources.ts';

test('Flatpak node-source merge deduplicates identical destinations', () => {
  const source = { type: 'file', url: 'https://example.test/a', dest: 'cache/a' };
  assert.deepEqual(mergeSources([[source], [{ ...source }]]), [source]);
});

test('Flatpak node-source merge refuses conflicting destinations', () => {
  assert.throws(() => mergeSources([[
    { url: 'https://example.test/a', dest: 'cache/a' },
    { url: 'https://example.test/b', dest: 'cache/a' },
  ]]), /Conflicting Flatpak node sources/);
});

test('Flatpak node-source merge permits different filenames in one cache directory', () => {
  const first = { url: 'https://example.test/a', dest: 'cache/a', 'dest-filename': 'one' };
  const second = { url: 'https://example.test/b', dest: 'cache/a', 'dest-filename': 'two' };
  assert.deepEqual(mergeSources([[first, second]]), [first, second]);
});
