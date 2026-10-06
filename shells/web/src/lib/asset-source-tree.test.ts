// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { buildAssetSourceTree, matchesAssetSource, sourceNodeId } from './asset-source-tree.ts';
const asset = (id: string, provider: string, taxonomy: Array<{ id: string; name: string; kind: string }>): AssetRef => ({ id, source: 'library', type: 'vector', format: 'svg', url: '/file.svg', meta: { provider, providerLabel: 'Library', providerTaxonomy: taxonomy } });
test('duplicate labels and overlapping collections preserve provider and node identities', () => {
  const files = [asset('one', 'a', [{ id: 'c1', name: 'Logos', kind: 'collection' }, { id: 'c2', name: 'Logos', kind: 'collection' }]), asset('two', 'b', [{ id: 'c1', name: 'Logos', kind: 'collection' }])];
  const tree = buildAssetSourceTree(files);
  assert.equal(tree.find(n => n.id === sourceNodeId('a'))?.children?.[0]?.children?.length, 2);
  assert.deepEqual(files.filter(a => matchesAssetSource(a, sourceNodeId('a', 'collection', 'c2'))).map(a => a.id), ['one']);
  assert.deepEqual(files.filter(a => matchesAssetSource(a, sourceNodeId('b', 'collection', 'c1'))).map(a => a.id), ['two']);
  files[0]!.meta!.providerTaxonomy = [{ id: 'c1', name: 'Renamed', kind: 'collection' }];
  assert.equal(matchesAssetSource(files[0]!, sourceNodeId('a', 'collection', 'c1')), true);
});
test('unavailable visible sources remain navigable without inventing asset totals', () => {
  const tree = buildAssetSourceTree([], [{ id: 'outage', label: 'Resource Library', status: 'unavailable' }]);
  assert.equal(tree.find(n => n.id === sourceNodeId('outage'))?.label, 'Resource Library');
  assert.equal(tree.find(n => n.id === sourceNodeId('outage'))?.count, undefined);
  assert.equal(matchesAssetSource(asset('one', 'a', []), 'invalid'), false);
});
