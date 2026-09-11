// SPDX-License-Identifier: MPL-2.0
/**
 * lib/nextcloud-send.ts `webdavSyncRemote` (plans/138 B1) - the second concrete
 * SyncRemote. Mock-fetch coverage of request shape (Basic auth, MKCOL-then-PUT,
 * the dav URL + sync path), rev/meta parsing, 404→null, ETag-hidden→HEAD
 * recovery, plus an end-to-end engine run against a stateful fake server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { webdavSyncRemote, connectWebdav, type WebdavConfig } from './nextcloud-send.ts';
import { resetConnectionsForTests } from './provider-connections.ts';
import { pushSnapshot, checkForNewer, pullAndApply, INITIAL_SYNC_STATE } from './sync-engine.ts';

const CFG: WebdavConfig = {
  baseUrl: 'https://cloud.example.org', username: 'ada', appPassword: 'app-pw', folder: 'Lolly',
};

async function connect(): Promise<void> {
  resetConnectionsForTests();
  await connectWebdav(CFG);
}

interface Call { url: string; method: string; headers: Record<string, string> }
function mockFetch(handler: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    const call: Call = { url: String(input), method: init?.method ?? 'GET', headers };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetch: fn, calls };
}

test('put MKCOLs the ancestors then PUTs the snapshot with Basic auth', async () => {
  await connect();
  const { fetch, calls } = mockFetch((c) =>
    c.method === 'MKCOL' ? new Response(null, { status: 405 })       // already exists
    : new Response(null, { status: 201, headers: { etag: '"w1"' } })); // PUT
  const meta = await webdavSyncRemote(fetch).put(new Uint8Array([1, 2]));

  assert.deepEqual(calls.map((c) => c.method), ['MKCOL', 'MKCOL', 'PUT'], 'both ancestor collections created, then PUT');
  assert.match(calls[0]!.url, /\/remote\.php\/dav\/files\/ada\/Lolly$/);
  assert.match(calls[1]!.url, /\/remote\.php\/dav\/files\/ada\/Lolly\/lolly-sync$/);
  assert.match(calls[2]!.url, /\/remote\.php\/dav\/files\/ada\/Lolly\/lolly-sync\/snapshot\.lolly$/);
  assert.equal(calls[2]!.headers.authorization, `Basic ${Buffer.from('ada:app-pw').toString('base64')}`);
  assert.equal(meta.rev, 'w1');
});

test('head: 404 → null, 200 → meta', async () => {
  await connect();
  assert.equal(await webdavSyncRemote(mockFetch(() => new Response(null, { status: 404 })).fetch).head(), null);
  const meta = await webdavSyncRemote(mockFetch(() =>
    new Response(null, { status: 200, headers: { etag: '"w9"', 'content-length': '2048' } })).fetch).head();
  assert.equal(meta!.rev, 'w9');
  assert.equal(meta!.size, 2048);
});

test('get downloads bytes + meta; put recovers rev via HEAD when the PUT hides ETag', async () => {
  await connect();
  const body = new Uint8Array([5, 6, 7]);
  const got = await webdavSyncRemote(mockFetch(() => new Response(body, { status: 200, headers: { etag: '"g1"' } })).fetch).get();
  assert.deepEqual([...got!.bytes], [5, 6, 7]);
  assert.equal(got!.meta.rev, 'g1');

  const { fetch, calls } = mockFetch((c) =>
    c.method === 'MKCOL' ? new Response(null, { status: 201 })
    : c.method === 'PUT' ? new Response(null, { status: 201 })                       // no ETag exposed
    : new Response(null, { status: 200, headers: { etag: '"recovered"' } }));        // follow-up HEAD
  const meta = await webdavSyncRemote(fetch).put(new Uint8Array([1]));
  assert.equal(calls.at(-1)!.method, 'HEAD', 'a rev-less PUT is followed by HEAD');
  assert.equal(meta.rev, 'recovered');
});

// Stateful fake WebDAV: MKCOL ok, PUT stores + bumps ETag, HEAD/GET answer or 404.
function fakeServer(): typeof fetch {
  const store = new Map<string, { bytes: Uint8Array; etag: string }>();
  let seq = 0;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? 'GET';
    if (method === 'MKCOL') return new Response(null, { status: 201 });
    if (method === 'PUT') {
      store.set(path, { bytes: new Uint8Array(init!.body as Uint8Array), etag: `"w${++seq}"` });
      return new Response(null, { status: 201, headers: { etag: store.get(path)!.etag } });
    }
    const obj = store.get(path);
    if (!obj) return new Response(null, { status: 404 });
    return new Response(method === 'HEAD' ? null : (obj.bytes as unknown as BodyInit), {
      status: 200, headers: { etag: obj.etag, 'content-length': String(obj.bytes.length) },
    });
  }) as unknown as typeof fetch;
}

function makeHost(sessions: Record<string, unknown> = {}) {
  const sess = new Map<string, { data: unknown }>(Object.entries(sessions).map(([k, v]) => [k, { data: v }]));
  const store = new Map<string, string>();
  const host = {
    profile: { async get() { return {}; }, async set() {} },
    state: {
      async list() { return [...sess.keys()].map((slot) => ({ slot })); },
      async load(slot: string) { return sess.get(slot)?.data ?? null; },
      async save(slot: string, data: unknown) { sess.set(slot, { data }); },
    },
    assets: { async _exportUserAssets() { return []; }, async _importUserAsset() {} },
    log() {},
  };
  return { deps: { host: host as never, storage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } } }, sess };
}

test('end-to-end: engine push→detect→pull through webdavSyncRemote against a fake server', async () => {
  await connect();
  const fetch = fakeServer();
  const a = makeHost({ 's1': { v: 1 } });
  const b = makeHost();

  const { state: aState } = await pushSnapshot(a.deps, webdavSyncRemote(fetch));
  assert.equal((await checkForNewer(webdavSyncRemote(fetch), INITIAL_SYNC_STATE)).hasNewer, true);
  const { summary, state: bState } = await pullAndApply(b.deps, webdavSyncRemote(fetch));
  assert.equal(summary.sessions, 1);
  assert.deepEqual(b.sess.get('s1')!.data, { v: 1 });

  assert.equal((await checkForNewer(webdavSyncRemote(fetch), aState)).hasNewer, false);
  await pushSnapshot(a.deps, webdavSyncRemote(fetch));
  assert.equal((await checkForNewer(webdavSyncRemote(fetch), bState)).hasNewer, true, 'B sees A’s second push');
});
