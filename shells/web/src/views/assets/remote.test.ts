// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { remoteOps } from './remote.ts';
import { renderShared } from './sections.ts';
import { _setBaseForTests } from '../../lib/instance.ts';
import type { CatCtx } from './context.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
const dom = new JSDOM('<body><main></main></body>', { url: 'http://localhost/#/a' });
const entry = (id: string, version = '1111111111111111') => ({ id: `ext/dam/${id}`, provider: 'dam', name: id, type: 'vector', version, formats: [{ format: 'svg', url: `/catalog/ext/dam/${id}/wide` }], meta: {} });
const capabilities = { indexedFilters: ['scope', 'q', 'source', 'types', 'tag', 'taxonomyKind', 'taxonomyId'] };
const reply = (id: string, version?: string) => Response.json({ capabilities, assets: [entry(id, version)], nextCursor: 'next', total: 100_000, version: version ?? 'fixture', complete: true,
  sources: [{ id: 'dam', label: 'DAM', count: 100_000, status: 'current' }], facets: { sources: [], sections: [], collections: [], types: [], tags: [], taxonomy: [{ source: 'dam', kind: 'folder', id: 'parent', name: 'Parent', count: 100 }, { source: 'dam', kind: 'folder', id: 'child', parentId: 'parent', name: 'Child', count: 25 }] } });
/** A view whose repaints are recorded: `body` for the whole body, `shared` for the section
 *  swapped in place and `sources` for the Sources rail. Both paints draw through html(). */
function fixture(paints: string[] = []): CatCtx {
  const cat: CatCtx = { viewEl: dom.window.document.querySelector('main')!, params: '', query: '', typeFilter: 'all', sourceSelection: 'all', sourceStatuses: [], hiddenSet: new Set(), selected: new Set(), assetById: new Map(), allAssets: [], mounted: true,
    sections: { renderBody() { paints.push('body'); cat.remote?.html(); }, renderShared() { paints.push('shared'); cat.remote?.html(); return true; }, closeDetails() {} },
    sources: { mount() { paints.push('sources'); } }, filters: { typeBucketEmpty: () => false }, thumbs: { assetTile: (ref: AssetRef) => ref.id } } as unknown as CatCtx;
  return cat;
}
/** Let a load started by a timer finish: fetch stubs and body reads settle on later turns. */
const settle = async () => { for (let turn = 0; turn < 20; turn++) await new Promise(resolve => setImmediate(resolve)); };

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

const noSharedLibrary: Array<[string, () => Response]> = [
  ['the HTML page a dev server or static host falls back to', () => new Response('<!doctype html><title>Lolly</title>', { headers: { 'content-type': 'text/html' } })],
  ['a 404', () => Response.json({ error: { message: 'Not found' } }, { status: 404 })],
  ['a reply that is not JSON', () => new Response('Shared assets', { headers: { 'content-type': 'text/plain' } })],
];
for (const [index, [name, respond]] of noSharedLibrary.entries()) {
  test(`${name} never shows or repaints the shared library, and later mounts do not ask that instance again`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const original = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls++; return respond(); };
    const paints: string[] = [], mounts: Array<ReturnType<typeof remoteOps>> = [];
    const mount = () => { const cat = fixture(paints), remote = remoteOps(cat); cat.remote = remote; mounts.push(remote); return remote; };
    _setBaseForTests(`https://static-${index}.example`);
    try {
      const first = mount();
      assert.equal(first.html(), '', 'nothing shows before the server answers');
      await first.load();
      assert.equal(calls, 1); assert.equal(first.html(), '');
      assert.deepEqual(paints, [], 'the answer repaints nothing');
      const later = mount(); later.sync(); t.mock.timers.tick(180);
      assert.equal(calls, 1, 'a later mount knows the answer'); assert.equal(later.html(), '');
      _setBaseForTests(`https://other-${index}.example`);
      mount().sync(); t.mock.timers.tick(180);
      assert.equal(calls, 2, 'a different instance is asked afresh');
      await settle();
      assert.deepEqual(paints, []);
    } finally { for (const remote of mounts) remote.dispose(); globalThis.fetch = original; _setBaseForTests(''); }
  });
}

test('a network error, an outage or a refusal with no JSON body shows and repaints nothing, and the next mount asks again', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const failures = [() => Promise.reject(new TypeError('Failed to fetch')), async () => new Response('', { status: 503 }), async () => Response.json({ error: { code: 'UNAVAILABLE' } }, { status: 502 }), async () => new Response('', { status: 401 })];
  const original = globalThis.fetch; let calls = 0; globalThis.fetch = async () => failures[calls++]!();
  const paints: string[] = [], mounts: Array<ReturnType<typeof remoteOps>> = [];
  const mount = () => { const cat = fixture(paints), remote = remoteOps(cat); cat.remote = remote; mounts.push(remote); return remote; };
  _setBaseForTests('https://unreachable.example');
  try {
    const first = mount(); await first.load();
    assert.equal(first.html(), '');
    for (let attempt = 2; attempt <= failures.length; attempt++) {
      const later = mount(); later.sync(); t.mock.timers.tick(180);
      assert.equal(calls, attempt, 'no answer was kept, so this mount asks again');
      await settle(); assert.equal(later.html(), '');
    }
    assert.deepEqual(paints, []);
  } finally { for (const remote of mounts) remote.dispose(); globalThis.fetch = original; _setBaseForTests(''); }
});

test('a JSON refusal confirms the shared library: the section asks the visitor to sign in, and a later mount shows it at once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { code: 'UNAUTHORIZED', message: 'this deployment is sign-in gated' } }, { status: 401 }); };
  _setBaseForTests('https://gated.example');
  const paints: string[] = [], cat = fixture(paints), remote = remoteOps(cat); cat.remote = remote;
  let closed = 0; cat.sections.closeDetails = () => { closed++; };
  // A provider record from the synced catalog, selected before the refusal arrives.
  const held = { id: 'ext/dam/held', type: 'vector', format: 'svg', url: '/catalog/ext/dam/held/wide', meta: { provider: 'dam' } } as unknown as AssetRef;
  cat.assetById.set(held.id, held); cat.selected.add(held.id);
  let later: ReturnType<typeof remoteOps> | undefined;
  try {
    assert.equal(remote.html(), '', 'nothing shows before the server answers');
    await remote.load();
    assert.equal(calls, 1);
    assert.match(remote.html(), /Shared library[\s\S]*Sign in to browse shared assets\./);
    assert.equal(cat.assetById.has(held.id), false, 'the refusal still removes shared records');
    assert.equal(cat.selected.has(held.id), false, 'and their selections');
    assert.equal(closed, 1, 'and closes any shared asset left open');
    assert.deepEqual(paints, ['body', 'sources'], 'dropping a selection repaints the body once');
    const next = fixture(paints); later = remoteOps(next); next.remote = later;
    assert.match(later.html(), /Shared library/, 'a later mount shows the section before its own reply');
    paints.length = 0; later.sync(); t.mock.timers.tick(180); await settle();
    assert.equal(calls, 2);
    assert.match(later.html(), /Sign in to browse shared assets\./);
    assert.deepEqual(paints, ['shared', 'shared'], 'its loading state and refusal replace the section in place');
  } finally { remote.dispose(); later?.dispose(); globalThis.fetch = original; _setBaseForTests(''); }
});

test('a valid page shows the shared library; later loads swap the section in place or leave it alone', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async input => { calls++; return reply(new URL(String(input)).searchParams.has('cursor') ? 'second' : 'first'); };
  _setBaseForTests('https://work.example');
  const paints: string[] = [], cat = fixture(paints), remote = remoteOps(cat); cat.remote = remote;
  let later: ReturnType<typeof remoteOps> | undefined;
  try {
    assert.equal(remote.html(), '', 'nothing shows before the server answers');
    await remote.load();
    assert.deepEqual(paints, ['body', 'sources'], 'the first valid page repaints the body once');
    assert.match(remote.html(), /Shared library[\s\S]*ext\/dam\/first/);
    paints.length = 0; await remote.load('next');
    assert.deepEqual(paints, ['shared', 'shared'], 'loading and the next page replace the section alone');
    assert.match(remote.html(), /ext\/dam\/second/);
    paints.length = 0; cat.query = 'tag:approved'; await remote.load(); await remote.load();
    assert.deepEqual(paints, ['shared', 'sources'], 'the same refusal a second time repaints nothing');
    const next = fixture(paints); later = remoteOps(next); next.remote = later;
    assert.match(later.html(), /Shared library/, 'a later mount shows the section before its own page arrives');
    paints.length = 0; later.sync(); t.mock.timers.tick(180); await settle();
    assert.equal(calls, 3);
    assert.deepEqual(paints, ['shared', 'body', 'sources'], 'that mount loads as a confirmed library always has');
  } finally { remote.dispose(); later?.dispose(); globalThis.fetch = original; _setBaseForTests(''); }
});

test('a definitive no repaints the body once when the type filter has no device assets left', async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
  _setBaseForTests('https://static-type.example');
  const paints: string[] = [], cat = fixture(paints); cat.typeFilter = 'lut'; cat.filters.typeBucketEmpty = () => true;
  const remote = remoteOps(cat); cat.remote = remote;
  try {
    await remote.load();
    assert.deepEqual(paints, ['body', 'sources'], 'the view can now fall back to All types');
    assert.equal(remote.html(), '');
  } finally { remote.dispose(); globalThis.fetch = original; _setBaseForTests(''); }
});

test('swapping the shared section in place keeps every device tile element', async () => {
  // The thumbnail upgraders a swap re-arms read the page document and watch tiles scroll into view.
  Reflect.set(globalThis, 'document', dom.window.document);
  Reflect.set(globalThis, 'IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  const original = globalThis.fetch; globalThis.fetch = async input => reply(new URL(String(input)).searchParams.has('cursor') ? 'second' : 'first');
  _setBaseForTests('https://work-dom.example');
  const viewEl = dom.window.document.createElement('div'), device = '<section class="cat-assets"><div class="cat-tile" data-id="user/vector/1"><button type="button" class="cat-check"></button></div></section>';
  viewEl.innerHTML = `<div class="catalog-body">${device}</div>`;
  const cat = fixture(); Object.assign(cat, { viewEl, host: {}, bulk: { pruneSelection() {}, syncBulkBar() {} }, wiring: { reapplyTreatment() {} } });
  cat.sections.renderBody = () => { viewEl.querySelector('.catalog-body')!.innerHTML = `${cat.remote!.html()}${device}`; };
  cat.sections.renderShared = () => renderShared(cat);
  const remote = remoteOps(cat); cat.remote = remote;
  try {
    await remote.load();
    const tile = viewEl.querySelector('[data-id="user/vector/1"]');
    assert.ok(viewEl.querySelector('.catalog-body > [data-shared-library]'), 'the first valid page adds the section');
    await remote.load('next');
    assert.equal(viewEl.querySelector('[data-id="user/vector/1"]'), tile, 'the device tile is the same element');
    assert.equal(viewEl.querySelectorAll('[data-shared-library]').length, 1);
    assert.match(viewEl.querySelector('[data-shared-library]')!.textContent!, /ext\/dam\/second/);
    assert.equal(viewEl.querySelector('.catalog-body')!.firstElementChild!.hasAttribute('data-shared-library'), true, 'the section still leads the body');
  } finally { remote.dispose(); globalThis.fetch = original; _setBaseForTests(''); Reflect.deleteProperty(globalThis, 'IntersectionObserver'); Reflect.deleteProperty(globalThis, 'document'); }
});
