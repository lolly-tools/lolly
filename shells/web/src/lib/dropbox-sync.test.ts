// SPDX-License-Identifier: MPL-2.0
/**
 * lib/dropbox-send.ts `dropboxSyncRemote` (plans/138 B1). One fixed app-folder
 * path, mode:overwrite uploads, `rev` = Dropbox's own file rev, 409→null.
 * Mock-fetch coverage of request shape, head/get/put, and an end-to-end engine
 * run against a stateful fake Dropbox.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dropboxSyncRemote } from './dropbox-send.ts';
import { cacheToken, resetConnectionsForTests } from './provider-connections.ts';
import { pushSnapshot, checkForNewer, pullAndApply, INITIAL_SYNC_STATE } from './sync-engine.ts';

function withToken(): void {
  resetConnectionsForTests();
  cacheToken('dropbox', 'tok', Date.now() + 3_600_000);
}

interface Call { url: string; method: string; arg?: string }
function mockFetch(handler: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const h = (init?.headers ?? {}) as Record<string, string>;
    const call: Call = { url: String(input), method: init?.method ?? 'GET', arg: h['Dropbox-API-Arg'] };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetch: fn, calls };
}

test('canSyncSilently is true with a cached token', async () => {
  withToken();
  assert.equal(await dropboxSyncRemote(mockFetch(() => new Response('{}')).fetch).canSyncSilently!(), true);
});

test('head: get_metadata 409 → null, 200 → meta', async () => {
  withToken();
  assert.equal(await dropboxSyncRemote(mockFetch(() => new Response(null, { status: 409 })).fetch).head(), null);
  const meta = await dropboxSyncRemote(mockFetch(() =>
    new Response(JSON.stringify({ rev: 'a1', size: 512, server_modified: '2025-01-01T00:00:00Z' }), { status: 200 })).fetch).head();
  assert.deepEqual(meta, { rev: 'a1', updatedAt: '2025-01-01T00:00:00Z', size: 512 });
});

test('put uploads to the fixed path with mode:overwrite and returns the rev', async () => {
  withToken();
  const { fetch, calls } = mockFetch(() => new Response(JSON.stringify({ rev: 'a2', size: 3 })));
  const meta = await dropboxSyncRemote(fetch).put(new Uint8Array([1, 2, 3]));
  assert.match(calls[0]!.url, /content\.dropboxapi\.com\/2\/files\/upload$/);
  const arg = JSON.parse(calls[0]!.arg!);
  assert.equal(arg.path, '/lolly-sync/snapshot.lolly');
  assert.equal(arg.mode, 'overwrite');
  assert.equal(meta.rev, 'a2');
});

test('get downloads bytes + meta from the Dropbox-API-Result header; 409 → null', async () => {
  withToken();
  assert.equal(await dropboxSyncRemote(mockFetch(() => new Response(null, { status: 409 })).fetch).get(), null);
  const body = new Uint8Array([4, 5]);
  const got = await dropboxSyncRemote(mockFetch(() =>
    new Response(body as unknown as BodyInit, { status: 200, headers: { 'dropbox-api-result': JSON.stringify({ rev: 'a3', size: 2 }) } })).fetch).get();
  assert.deepEqual([...got!.bytes], [4, 5]);
  assert.equal(got!.meta.rev, 'a3');
});

// Stateful fake Dropbox: one path, metadata/download/upload; 409 when absent.
function fakeDropbox(): typeof fetch {
  let file: { bytes: Uint8Array; rev: number } | null = null;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/files/get_metadata')) {
      return file
        ? new Response(JSON.stringify({ rev: `r${file.rev}`, size: file.bytes.length }))
        : new Response(null, { status: 409 });
    }
    if (url.endsWith('/files/upload')) {
      file = { bytes: new Uint8Array(init!.body as Uint8Array), rev: (file?.rev ?? 0) + 1 };
      return new Response(JSON.stringify({ rev: `r${file.rev}`, size: file.bytes.length }));
    }
    if (url.endsWith('/files/download')) {
      if (!file) return new Response(null, { status: 409 });
      return new Response(file.bytes as unknown as BodyInit, { status: 200, headers: { 'dropbox-api-result': JSON.stringify({ rev: `r${file.rev}`, size: file.bytes.length }) } });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
}

function makeHost(sessions: Record<string, unknown> = {}) {
  const sess = new Map<string, { data: unknown }>(Object.entries(sessions).map(([k, v]) => [k, { data: v }]));
  const store = new Map<string, string>();
  const host = {
    profile: { async get() { return {}; }, async set() {} },
    state: { async list() { return [...sess.keys()].map((slot) => ({ slot })); }, async load(s: string) { return sess.get(s)?.data ?? null; }, async save(s: string, d: unknown) { sess.set(s, { data: d }); } },
    assets: { async _exportUserAssets() { return []; }, async _importUserAsset() {} },
    log() {},
  };
  return { deps: { host: host as never, storage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } } }, sess };
}

test('end-to-end: engine push→detect→pull through dropboxSyncRemote against a fake Dropbox', async () => {
  withToken();
  const fetch = fakeDropbox();
  const a = makeHost({ 's1': { v: 1 } });
  const b = makeHost();

  const { state: aState } = await pushSnapshot(a.deps, dropboxSyncRemote(fetch));
  assert.equal((await checkForNewer(dropboxSyncRemote(fetch), INITIAL_SYNC_STATE)).hasNewer, true);
  const { summary } = await pullAndApply(b.deps, dropboxSyncRemote(fetch));
  assert.equal(summary.sessions, 1);
  assert.deepEqual(b.sess.get('s1')!.data, { v: 1 });

  assert.equal((await checkForNewer(dropboxSyncRemote(fetch), aState)).hasNewer, false);
  await pushSnapshot(a.deps, dropboxSyncRemote(fetch));
  assert.equal((await checkForNewer(dropboxSyncRemote(fetch), aState)).hasNewer, true, 'a second push bumps the rev');
});
