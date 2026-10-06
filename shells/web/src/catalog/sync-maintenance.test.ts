// SPDX-License-Identifier: MPL-2.0
/**
 * syncCatalog's maintenance gate: the stale-asset prune waits for the gate main.ts
 * passes (the first-run welcome, lib/welcome-gate.ts), while the sync itself, and so
 * everything the gallery paints from, resolves without it.
 *
 *   node --test shells/web/src/catalog/sync-maintenance.test.ts
 *
 * jsdom supplies window/location/localStorage; fetch and the host bridge are mocks.
 * Node has no IndexedDB, so the instance base and the pin map read as empty, which
 * is what a first visit looks like anyway.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.localStorage = dom.window.localStorage;

const TOOLS = { version: '1', generatedAt: 'g1', tools: [{ id: 'qr-code', name: 'QR Code' }] };
const ASSETS = { assets: [{ id: 'lolly/logo/primary', version: '1', tier: 'core', formats: [{ format: 'svg', url: '/catalog/assets/logo.svg' }] }] };
let assetStatus = 200;
let toolRequests = 0;
let assetRequests = 0;
let lastAssetHeaders = new Headers();

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.endsWith('/catalog/tools/index.json')) { toolRequests++; return Response.json(TOOLS); }
  if (url.endsWith('/catalog/assets/index.json')) {
    assetRequests++;
    lastAssetHeaders = new Headers(init?.headers);
    if (assetStatus === 304) return new Response(null, { status: 304 });
    return Response.json(ASSETS, { headers: { ETag: '"assets-1"' } });
  }
  return new Response('not found', { status: 404 });
}) as typeof fetch;

const { prepareAssetCatalogFetch, syncCatalog } = await import('./sync.ts');
const { _setBaseForTests } = await import('../lib/instance.ts');

type Call = { name: string; assets?: unknown[] };
function mockHost(calls: Call[]) {
  return {
    log: () => {},
    assets: {
      _syncFromIndex: async (assets: unknown[]) => { calls.push({ name: 'meta-stored', assets }); },
      _pruneStale: async (assets: unknown[]) => { calls.push({ name: 'prune', assets }); return { blobs: 0, meta: 0 }; },
      _hasBlob: async () => false,
      _cacheBlob: async () => {},
      _ensureBlob: async () => null,
    },
    state: { _getAssetRefs: async () => new Set<string>() },
  };
}

function deferred(): { promise: Promise<void>; open: () => void } {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => { open = resolve; });
  return { promise, open };
}

/** Settle as `promise` does, or reject if it is still pending after `ms`. */
function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} was still pending after ${ms} ms`)), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

const settle = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

test('the prepared asset request is adopted once after bridge startup', async () => {
  localStorage.clear();
  assetStatus = 200;
  const calls: Call[] = [], before = assetRequests;
  const prepared = prepareAssetCatalogFetch();
  await prepared;
  assert.equal(assetRequests, before + 1);
  assert.deepEqual(calls, [], 'fetching metadata does not require or write the bridge');
  assert.equal(localStorage.getItem('sbt-catalog:assets-index'), null, 'an unconsumed response must not leave a validator for missing metadata');
  await syncCatalog(mockHost(calls), undefined, undefined, undefined, prepared);
  assert.equal(assetRequests, before + 1, 'sync adopts the response without a second request');
  assert.equal(JSON.parse(localStorage.getItem('sbt-catalog:assets-index') ?? '{}').etag, '"assets-1"');
  assert.deepEqual(calls.map(call => call.name), ['meta-stored', 'prune']);
});

test('a prepared response from another instance is discarded', async () => {
  localStorage.clear();
  const before = assetRequests;
  const prepared = prepareAssetCatalogFetch();
  await prepared;
  _setBaseForTests('https://other.example');
  try {
    const calls: Call[] = [];
    await syncCatalog(mockHost(calls), undefined, undefined, undefined, prepared);
    assert.equal(assetRequests, before + 2, 'the new instance gets its own request');
    assert.equal(calls.find(call => call.name === 'meta-stored')?.assets?.length, 1);
  } finally { _setBaseForTests(''); }
});

test('a cold welcome decision paints before the full tool catalog competes for bandwidth', async () => {
  const decision = deferred(), started = deferred(), calls: Call[] = [], before = toolRequests;
  const sync = syncCatalog(mockHost(calls), async () => { started.open(); await decision.promise; }, async () => {});
  await within(started.promise, 2000, 'welcome decision');
  assert.equal(toolRequests, before);
  decision.open(); await sync;
  assert.equal(toolRequests, before + 1);
  assert.equal(window.__toolIndex?.tools[0]?.id, 'qr-code');
});

test('the sync resolves while the gate is shut; the prune starts only after it opens', async () => {
  localStorage.clear();
  assetStatus = 200;
  const calls: Call[] = [];
  const gate = deferred();
  const order: string[] = [];
  await within(syncCatalog(mockHost(calls), () => order.push('assets-ready'), () => {
    order.push('gate-asked');
    return gate.promise;
  }), 2000, 'syncCatalog');
  assert.deepEqual(order, ['assets-ready', 'gate-asked'], 'the gate is asked after the welcome had its chance to take a hold');
  assert.deepEqual(calls.map((c) => c.name), ['meta-stored'], 'metadata is stored, nothing is pruned yet');
  assert.equal(window.__toolIndex?.tools[0]?.id, 'qr-code', 'the tool index the gallery paints from is in place');
  await settle();
  assert.equal(calls.some((c) => c.name === 'prune'), false, 'still waiting for the gate');
  gate.open();
  await settle();
  const prune = calls.find((c) => c.name === 'prune');
  assert.ok(prune, 'the prune runs once the gate opens');
  assert.deepEqual(prune.assets, ASSETS.assets);
});

test('without a gate the prune runs before the sync resolves, as other callers expect', async () => {
  localStorage.clear();
  assetStatus = 200;
  const calls: Call[] = [];
  await syncCatalog(mockHost(calls));
  assert.deepEqual(calls.map((c) => c.name), ['meta-stored', 'prune']);
});

test('a waiting prune stands down when a newer asset index has been synced since', async () => {
  localStorage.clear();
  assetStatus = 200;
  const early: Call[] = [];
  const gate = deferred();
  await within(syncCatalog(mockHost(early), undefined, () => gate.promise), 2000, 'syncCatalog');
  const later: Call[] = [];
  localStorage.clear();
  await syncCatalog(mockHost(later));
  assert.deepEqual(later.map((c) => c.name), ['meta-stored', 'prune'], 'the newer sync prunes against its own index');
  gate.open();
  await settle();
  assert.deepEqual(early.map((c) => c.name), ['meta-stored'], 'the older index must not prune after it');
});

test('an unchanged asset index (304) still tells the welcome, and never asks the gate', async () => {
  assetStatus = 304;
  const calls: Call[] = [];
  const asked: string[] = [];
  await syncCatalog(mockHost(calls), () => asked.push('assets-ready'), async () => { asked.push('gate-asked'); });
  assert.deepEqual(asked, ['assets-ready']);
  assert.deepEqual(calls, []);
  assetStatus = 200;
});

test('a gate that fails skips the prune without failing the sync', async () => {
  localStorage.clear();
  assetStatus = 200;
  const calls: Call[] = [];
  await within(syncCatalog(mockHost(calls), undefined, () => Promise.reject(new Error('gate broke'))), 2000, 'syncCatalog');
  await settle();
  assert.deepEqual(calls.map((c) => c.name), ['meta-stored']);
});


test('a prepared 304 response keeps the cached metadata and opens the welcome decision', async () => {
  assetStatus = 304;
  const calls: Call[] = [], asked: string[] = [], before = assetRequests;
  try {
    const prepared = prepareAssetCatalogFetch();
    await prepared;
    await syncCatalog(mockHost(calls), () => asked.push('assets-ready'), undefined, undefined, prepared);
    assert.equal(assetRequests, before + 1);
    assert.deepEqual(asked, ['assets-ready']);
    assert.deepEqual(calls, []);
  } finally { assetStatus = 200; }
});


test('a fresh asset request begun by the document is adopted once', async () => {
  localStorage.clear();
  const before = assetRequests, calls: Call[] = [];
  const path = '/catalog/assets/index.json';
  window.__lollyBootFetch = { [path]: fetch(path) };
  const prepared = prepareAssetCatalogFetch();
  await prepared;
  await syncCatalog(mockHost(calls), undefined, undefined, undefined, prepared);
  assert.equal(assetRequests, before + 1);
  assert.equal(window.__lollyBootFetch[path], undefined, 'adoption consumes the early response');
  assert.deepEqual(calls.map(call => call.name), ['meta-stored', 'prune']);
});


test('a cached asset index keeps its conditional request', async () => {
  localStorage.clear();
  localStorage.setItem('sbt-catalog:assets-index', JSON.stringify({ etag: '"cached-assets"' }));
  assetStatus = 304;
  const before = assetRequests;
  try {
    const prepared = prepareAssetCatalogFetch();
    await prepared;
    await syncCatalog(mockHost([]), undefined, undefined, undefined, prepared);
    assert.equal(assetRequests, before + 1);
    assert.equal(lastAssetHeaders.get('If-None-Match'), '"cached-assets"');
  } finally { assetStatus = 200; }
});
