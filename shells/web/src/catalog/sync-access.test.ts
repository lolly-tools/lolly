// SPDX-License-Identifier: MPL-2.0
/**
 * syncCatalog on an instance that keeps its catalog for signed-in people.
 *
 *   node --test shells/web/src/catalog/sync-access.test.ts
 *
 * Two decisions are pinned here:
 *   - a 401/403 from a catalog index is "signed out", not "offline": no retry, no
 *     offline chip, networkStatus.offline stays false, and the refusal is
 *     remembered for the next boot;
 *   - a remembered refusal makes the next boot ask `signInRequired` before any
 *     catalog request, and sends none while the visitor is still signed out.
 * And the control: with no refusal on record, `signInRequired` is never asked and
 * a 5xx still reports offline exactly as before.
 *
 * jsdom supplies window/location/localStorage; fetch and the host bridge are mocks.
 * Node has no IndexedDB, so the instance base reads as same-origin.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.localStorage = dom.window.localStorage;

const TOOLS = { version: '1', generatedAt: 'g1', tools: [{ id: 'qr-code', name: 'QR Code' }] };
const ASSETS = { assets: [{ id: 'lolly/logo/primary', version: '1', tier: 'core', formats: [{ format: 'svg', url: '/catalog/assets/logo.svg' }] }] };
let status = 200;
let requests: string[] = [];

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input);
  requests.push(url);
  if (status !== 200) return new Response('', { status });
  if (url.endsWith('/catalog/tools/index.json')) return Response.json(TOOLS);
  if (url.endsWith('/catalog/assets/index.json')) return Response.json(ASSETS);
  return new Response('not found', { status: 404 });
}) as typeof fetch;

const { prepareAssetCatalogFetch, syncCatalog, syncCorePrefetch, networkStatus } = await import('./sync.ts');
const { catalogRefused, catalogRefusedBefore, resetCatalogAccessForTests } = await import('../lib/catalog-access.ts');
const { createTokensAPI } = await import('../bridge/tokens.ts');

const REFUSED_KEY = 'lolly:catalog-refused:same-origin';

function mockHost() {
  return {
    log: () => {},
    assets: {
      _syncFromIndex: async () => {},
      _pruneStale: async () => ({ blobs: 0, meta: 0 }),
      _hasBlob: async () => false,
      _cacheBlob: async () => {},
      _ensureBlob: async () => null,
    },
    state: { _getAssetRefs: async () => new Set<string>() },
  };
}

const chipShown = (): boolean => {
  const chip = document.getElementById('sbt-offline-chip');
  return !!chip && !chip.hidden;
};

beforeEach(() => {
  resetCatalogAccessForTests();
  localStorage.clear();
  networkStatus.offline = false;
  document.getElementById('sbt-offline-chip')?.remove();
  requests = [];
  status = 200;
});

for (const refused of [401, 403]) {
  test(`a ${refused} from the catalog is "signed out": no retry, no offline chip, remembered`, async () => {
    status = refused;
    await syncCatalog(mockHost());
    assert.equal(networkStatus.offline, false, 'never reported as offline');
    assert.equal(chipShown(), false, 'no "Offline - showing saved content" chip');
    assert.equal(catalogRefused(), true, 'later catalog reads on this page are skipped');
    assert.equal(catalogRefusedBefore(), true, 'the next boot knows to ask first');
    const toolIndexAsks = requests.filter(u => u.endsWith('/catalog/tools/index.json')).length;
    assert.ok(toolIndexAsks <= 1, `the tool index is not retried (asked ${toolIndexAsks} times)`);
    // Nothing later in the session goes back to the refused catalog.
    requests = [];
    await syncCatalog(mockHost());
    await syncCorePrefetch(mockHost());
    assert.deepEqual(requests, [], 'no further catalog requests this page load');
  });
}

test('a refusal remembered from last boot: a still-signed-out visitor sends no catalog request', async () => {
  localStorage.setItem(REFUSED_KEY, '1');
  let asked = 0;
  await syncCatalog(mockHost(), undefined, undefined, async () => { asked++; return true; });
  assert.equal(asked, 1, 'the sign-in answer is asked for');
  assert.deepEqual(requests, [], 'no catalog request while signed out');
  assert.equal(networkStatus.offline, false);
  assert.equal(chipShown(), false);
  assert.equal(catalogRefused(), true);
});

test('a refusal remembered from last boot: once signed in, the sync runs and forgets the refusal', async () => {
  localStorage.setItem(REFUSED_KEY, '1');
  await syncCatalog(mockHost(), undefined, undefined, async () => false);
  assert.ok(requests.some(u => u.endsWith('/catalog/tools/index.json')), 'the catalog is fetched');
  assert.equal(window.__toolIndex?.tools[0]?.id, 'qr-code');
  assert.equal(catalogRefusedBefore(), false, 'a successful read forgets the refusal');
  assert.equal(catalogRefused(), false);
});

/** A sign-in answer that has not arrived yet, settled by hand. */
function slowAnswer(): { ask: () => Promise<boolean>; answer: (gated: boolean) => void; asked: Promise<void> } {
  let answer!: (gated: boolean) => void;
  let sawAsk!: () => void;
  const asked = new Promise<void>(resolve => { sawAsk = resolve; });
  const result = new Promise<boolean>(resolve => { answer = resolve; });
  return { ask: () => { sawAsk(); return result; }, answer, asked };
}

/** A tokens reader over a store the sync fills: empty until `_syncFromIndex` runs. */
function tokensOver(host: ReturnType<typeof mockHost>) {
  let synced = false;
  host.assets._syncFromIndex = async () => { synced = true; };
  const DOC = { color: { brand: { $type: 'color', $value: '#30ba78' } } };
  return createTokensAPI({ assets: {
    _findMetaByType: async () => (synced ? { id: 'acme/tokens/brand', formats: [] } : null),
    _getBlob: async () => new Blob([JSON.stringify(DOC)], { type: 'application/json' }),
  } });
}

test('a refusal remembered from last boot: a token read waits for the sign-in answer and then sends nothing', async () => {
  localStorage.setItem(REFUSED_KEY, '1');
  const host = mockHost();
  const tokens = tokensOver(host);
  const gate = slowAnswer();
  const syncing = syncCatalog(host, undefined, undefined, gate.ask);
  await gate.asked;
  const read = tokens.resolve('color.brand');
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [], 'the token read does not fetch the asset index ahead of the answer');
  gate.answer(true);
  await syncing;
  assert.equal(await read, undefined, 'signed out: no brand tokens');
  assert.deepEqual(requests, [], 'no catalog request at all while signed out');
  assert.equal(catalogRefused(), true);
});

test('a refusal remembered from last boot: once signed in, a token read waits for the sync instead of fetching the index itself', async () => {
  localStorage.setItem(REFUSED_KEY, '1');
  const host = mockHost();
  const tokens = tokensOver(host);
  const gate = slowAnswer();
  const syncing = syncCatalog(host, undefined, undefined, gate.ask);
  await gate.asked;
  const read = tokens.resolve('color.brand');
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(requests, []);
  gate.answer(false);
  await syncing;
  assert.equal(await read, '#30ba78', 'the read is served from the synced store');
  // `as`: the deepEqual above narrowed `requests` to an empty tuple.
  const assetIndexAsks = (requests as string[]).filter(u => u.endsWith('/catalog/assets/index.json')).length;
  assert.equal(assetIndexAsks, 1, 'the asset index is fetched once, by the sync');
});

test('no refusal on record: the sign-in answer is never waited for', async () => {
  let asked = 0;
  await syncCatalog(mockHost(), undefined, undefined, async () => { asked++; return true; });
  assert.equal(asked, 0, 'a public deployment never waits on the control plane');
  assert.ok(requests.some(u => u.endsWith('/catalog/assets/index.json')));
  assert.equal(localStorage.getItem(REFUSED_KEY), null, 'nothing is written');
});

test('a server error is still offline: the cached copy and the chip, as before', async () => {
  status = 503;
  await syncCatalog(mockHost());
  assert.equal(networkStatus.offline, true);
  assert.equal(chipShown(), true);
  assert.equal(catalogRefused(), false);
  assert.equal(catalogRefusedBefore(), false);
});


test('preparing a catalog request preserves the remembered sign-in gate', async () => {
  localStorage.setItem(REFUSED_KEY, '1');
  const prepared = await prepareAssetCatalogFetch(async () => true);
  assert.equal(prepared, null);
  assert.deepEqual(requests, []);
  assert.equal(catalogRefused(), true);
});

test('a prepared catalog refusal stays signed out without an offline chip', async () => {
  status = 401;
  const prepared = prepareAssetCatalogFetch();
  await prepared;
  await syncCatalog(mockHost(), undefined, undefined, undefined, prepared);
  assert.equal(requests.length, 1);
  assert.equal(catalogRefused(), true);
  assert.equal(networkStatus.offline, false);
  assert.equal(chipShown(), false);
});

test('an unavailable sign-in probe permits the normal prepared catalog attempt', async () => {
  localStorage.setItem(REFUSED_KEY, '1');
  const prepared = await prepareAssetCatalogFetch(async () => { throw new Error('probe unavailable'); });
  assert.ok(prepared && 'response' in prepared);
  assert.equal(requests.length, 1);
});


test('a failed prepared request reaches the normal offline fallback', async () => {
  status = 503;
  const prepared = prepareAssetCatalogFetch();
  await prepared;
  await syncCatalog(mockHost(), () => {}, undefined, undefined, prepared);
  assert.equal(requests.filter(url => url.endsWith('/catalog/assets/index.json')).length, 1);
  assert.equal(catalogRefused(), false);
  assert.equal(networkStatus.offline, true);
  assert.equal(chipShown(), true);
});
