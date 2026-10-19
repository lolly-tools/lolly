// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssetBrowser, ASSET_BROWSE_LIMIT } from './browse.ts';
import { _setBaseForTests } from '../lib/instance.ts';
const entry = (id: string) => ({ id: `ext/dam/${id}`, name: id, provider: 'dam', type: 'vector', version: '1234567890123456', formats: [{ format: 'svg', url: `/catalog/ext/dam/${id}/file` }], meta: { assetFiles: [{ id: 'a'.repeat(24), format: 'svg', name: 'source.svg', url: `/catalog/ext/dam/${id}/file`, role: 'original' }] } });
const capabilities = { indexedFilters: ['q', 'scope', 'source', 'types', 'tag', 'taxonomyKind', 'taxonomyId'], liveFilters: ['q', 'source', 'scope'] };
const page = (id: string, nextCursor: string | null = null) => ({ capabilities, assets: [entry(id)], total: 100_000, nextCursor, facets: { sources: [{ id: 'dam', label: 'DAM', count: 100_000 }], sections: [], collections: [], tags: [], types: [] }, version: 'fixture', complete: false });

test('page navigation replaces metadata, keeps opaque cursors and forwards exact filters', async () => {
  const requests: URL[] = [];
  const browser = new AssetBrowser(async input => {
    const url = new URL(String(input), 'http://localhost'); requests.push(url);
    return Response.json(page(url.searchParams.has('cursor') ? 'second' : 'first', 'opaque+cursor'));
  });
  await browser.load({ scope: 'shared', q: 'launch', tag: 'approved', types: 'vector', taxonomyKind: 'folder', taxonomyId: 'native-42' });
  const selected = browser.refs[0]!;
  await browser.load(browser.filters, 'next');
  assert.equal(browser.refs.length, 1); assert.equal(browser.refs[0]!.id, 'ext/dam/second');
  assert.equal(Array.isArray(selected.meta?.assetFiles), true); assert.equal(selected.id, 'ext/dam/first');
  assert.equal(requests[1]!.searchParams.get('cursor'), 'opaque+cursor'); assert.equal(requests[1]!.searchParams.get('tag'), 'approved');
  assert.equal(requests[1]!.searchParams.get('limit'), String(ASSET_BROWSE_LIMIT));
  await browser.load(browser.filters, 'previous'); assert.equal(browser.refs[0]!.id, 'ext/dam/first'); assert.equal(browser.index, 0);
});

test('a late reply cannot overwrite a newer search or a different instance', async () => {
  let finish!: (response: Response) => void;
  const browser = new AssetBrowser(async input => new URL(String(input), 'http://localhost').searchParams.get('q') === 'old'
    ? new Promise<Response>(resolve => { finish = resolve; }) : Response.json(page('new')));
  const old = browser.load({ q: 'old' }); await browser.load({ q: 'new' }); finish(Response.json(page('old'))); await old;
  assert.equal(browser.refs[0]!.id, 'ext/dam/new');
  const cancelled = browser.load({ q: 'old' }); assert.equal(browser.loading, true);
  browser.dispose(); assert.equal(browser.loading, false);
  finish(Response.json(page('old'))); await cancelled; assert.equal(browser.refs.length, 0);
  const pending = browser.load({ q: 'old' }); _setBaseForTests('https://changed.example'); finish(Response.json(page('old'))); await pending;
  assert.notEqual(browser.refs[0]?.id, 'ext/dam/old'); _setBaseForTests('');
});

test('unsupported live combinations perform no request and never silently drop a tag', async () => {
  let calls = 0; const browser = new AssetBrowser(async () => { calls++; return Response.json({ results: [], capabilities }); });
  await browser.load({ q: 'launch', tag: 'approved' }, 'reset', true);
  assert.equal(calls, 0); assert.match(browser.error!.message, /exact filters/);
  await browser.load({ q: 'launch', source: 'dam' }, 'reset', true);
  assert.equal(calls, 1); assert.equal(browser.page?.complete, false); assert.equal(browser.mode, 'live');
});

test('refused, unavailable and unsupported servers remain distinct and clear stale cards', async () => {
  for (const status of [401, 403, 404, 503]) {
    const browser = new AssetBrowser(async () => new Response('', { status }));
    await browser.load({}); assert.equal(browser.refs.length, 0); assert.equal(browser.error?.status, status);
    assert.equal(browser.supported, status === 404 ? false : null);
  }
});

test('a load answers whether the server provides shared browsing only when the reply settles the question', async () => {
  const answer = (respond: () => Promise<Response>) => new AssetBrowser(respond).load({ scope: 'shared' });
  const refusal = (status: number) => Response.json({ error: { code: 'UNAUTHORIZED', message: 'this deployment is sign-in gated' } }, { status });
  assert.equal(await answer(async () => Response.json(page('first'))), true);
  for (const status of [401, 403]) {
    const browser = new AssetBrowser(async () => refusal(status));
    assert.equal(await browser.load({ scope: 'shared' }), true, `a JSON ${status} is Work refusing the visitor, so shared browsing exists`);
    assert.equal(browser.supported, null, 'a refusal is not a page'); assert.match(browser.error!.message, /Sign in to browse shared assets/);
  }
  assert.equal(await answer(async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })), false, 'an HTML fallback is not an API');
  assert.equal(await answer(async () => new Response('', { status: 404 })), false);
  for (const status of [401, 403]) assert.equal(await answer(async () => new Response('', { status })), null, `a ${status} with no body answers neither way`);
  assert.equal(await answer(async () => new Response('<p>Sign in</p>', { status: 401, headers: { 'content-type': 'text/html' } })), null, 'an HTML refusal could come from any host');
  for (const status of [500, 503]) assert.equal(await answer(async () => Response.json({ error: { code: 'UNAVAILABLE' } }, { status })), null, `a ${status} answers neither way`);
  assert.equal(await answer(async () => Response.json({ error: { code: 'INVALID_INPUT' } }, { status: 422 })), null, 'a 422 answers neither way');
  assert.equal(await answer(async () => Response.json({ ...page('first'), capabilities: undefined })), null, 'a server without the requested filters answers neither way');
  assert.equal(await answer(() => Promise.reject(new TypeError('Failed to fetch'))), null, 'a network error answers neither way');
  assert.equal(await answer(async () => Response.json({ capabilities, assets: 'not a page' })), null, 'JSON that is not a valid page answers neither way');
  let finish!: (response: Response) => void;
  const held = new AssetBrowser(() => new Promise<Response>(resolve => { finish = resolve; }));
  const cancelled = held.load({ scope: 'shared' }); held.dispose(); finish(refusal(401));
  assert.equal(await cancelled, null, 'a cancelled load answers neither way, even when the late reply is a JSON refusal');
});

test('a server cannot turn a bounded page request into a whole-library response', async () => {
  const browser = new AssetBrowser(async () => Response.json({ ...page('first'), assets: Array.from({ length: 101 }, (_, i) => entry(String(i))) }));
  await browser.load({}); assert.equal(browser.page, null); assert.match(browser.error!.message, /invalid asset page/);
});

test('an older server cannot silently ignore an unsupported exact filter', async () => {
  const browser = new AssetBrowser(async () => Response.json({ ...page('first'), capabilities: undefined }));
  await browser.load({ types: 'vector', tag: 'approved', scope: 'shared' });
  assert.equal(browser.refs.length, 0); assert.equal(browser.error?.status, 422);
  assert.match(browser.error!.message, /does not support/);
});
