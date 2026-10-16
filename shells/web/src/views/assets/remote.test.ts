// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { remoteOps } from './remote.ts';
import type { CatCtx } from './context.ts';
const dom = new JSDOM('<body><main></main></body>', { url: 'http://localhost/#/a' });
const entry = (id: string, version = '1111111111111111') => ({ id: `ext/dam/${id}`, provider: 'dam', name: id, type: 'vector', version, formats: [{ format: 'svg', url: `/catalog/ext/dam/${id}/wide` }], meta: {} });
const capabilities = { indexedFilters: ['scope', 'q', 'source', 'types', 'tag', 'taxonomyKind', 'taxonomyId'] };
const reply = (id: string, version?: string) => Response.json({ capabilities, assets: [entry(id, version)], nextCursor: 'next', total: 100_000, version: version ?? 'fixture', complete: true,
  sources: [{ id: 'dam', label: 'DAM', count: 100_000, status: 'current' }], facets: { sources: [], sections: [], collections: [], types: [], tags: [], taxonomy: [{ source: 'dam', kind: 'folder', id: 'parent', name: 'Parent', count: 100 }, { source: 'dam', kind: 'folder', id: 'child', parentId: 'parent', name: 'Child', count: 25 }] } });
function fixture() {
  return { viewEl: dom.window.document.querySelector('main')!, params: '', query: '', typeFilter: 'all', sourceSelection: 'all', sourceStatuses: [], hiddenSet: new Set(), selected: new Set(), assetById: new Map(), allAssets: [], mounted: true,
    sections: { renderBody() {}, closeDetails() {} }, sources: { mount() {} }, thumbs: { assetTile: () => '' } } as unknown as CatCtx;
}

test('cross-page selection keeps its observed reference when a newer listing returns the same id', async () => {
  const original = globalThis.fetch; let response = reply('first'); globalThis.fetch = async () => response;
  const cat = fixture(), remote = remoteOps(cat); cat.remote = remote;
  try {
    await remote.load(); const selected = cat.assetById.get('ext/dam/first')!; cat.selected.add(selected.id);
    response = reply('second'); await remote.load('next');
    assert.equal(cat.assetById.get(selected.id), selected);
    assert.equal(remote.browser.refs.length, 1); assert.equal(cat.assetById.size, 2);
    response = reply('first', '2222222222222222'); await remote.load();
    assert.equal(cat.assetById.get(selected.id), selected, 'a new cache token cannot silently replace the selection');
    assert.match(selected.url, /v=1111111111111111$/); assert.match(remote.html(), /A selected asset has changed/);
    remote.restrictSources(new Set());
    assert.equal(cat.selected.size, 0); assert.equal(cat.assetById.size, 0); assert.equal(remote.browser.refs.length, 0);
  } finally { remote.dispose(); globalThis.fetch = original; }
});

test('source counts and native hierarchy come from the server facets, not one loaded tile', async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => reply('first');
  const cat = fixture(), remote = remoteOps(cat); cat.remote = remote;
  try {
    await remote.load(); const root = remote.tree().find(node => node.id === '["dam"]')!;
    assert.equal(root.count, 100_000); assert.equal(root.children![0]!.children!.length, 1);
    assert.equal(root.children![0]!.children![0]!.children![0]!.id, '["dam","folder","child"]');
    const calls: string[] = []; globalThis.fetch = async input => { calls.push(String(input)); return reply('ignored'); };
    cat.query = 'tag:approved'; await remote.load();
    assert.equal(calls.length, 0); assert.match(remote.html(), /Search operators are not supported/);
  } finally { remote.dispose(); globalThis.fetch = original; }
});
