// SPDX-License-Identifier: MPL-2.0
/**
 * lib/s3-send.ts `s3SyncRemote` (plans/138 B1) - the first concrete SyncRemote.
 * Exercised with a mock fetch (no network): request shape + SigV4 signing on
 * HEAD/GET/PUT, rev/meta parsing from response headers, the 404→null contract,
 * and the ETag-not-CORS-exposed → follow-up-HEAD recovery.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { s3SyncRemote, connectS3, type S3Config } from './s3-send.ts';
import { resetConnectionsForTests } from './provider-connections.ts';
import { pushSnapshot, checkForNewer, pullAndApply, INITIAL_SYNC_STATE } from './sync-engine.ts';

const CFG: S3Config = {
  endpoint: 'https://s3.example.com', region: 'eu-central-1', bucket: 'my-bucket',
  accessKeyId: 'AKIA_TEST', secretAccessKey: 'shhh', prefix: 'lolly/',
};

async function connect(): Promise<void> {
  resetConnectionsForTests();
  await connectS3(CFG);
}

interface Call { url: string; method: string; headers: Record<string, string>; body?: BodyInit | null }

/** A mock fetch that records calls and answers from a per-method queue/handler. */
function mockFetch(handler: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    const call: Call = { url: String(input), method: init?.method ?? 'GET', headers, body: init?.body ?? null };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetch: fn, calls };
}

test('put signs a PUT to the snapshot key and returns the ETag as rev', async () => {
  await connect();
  const { fetch, calls } = mockFetch(() => new Response(null, { status: 200, headers: { etag: '"abc123"', date: 'Wed, 01 Jan 2025 00:00:00 GMT' } }));
  const remote = s3SyncRemote(fetch);

  const meta = await remote.put(new Uint8Array([1, 2, 3]));

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, 'PUT');
  assert.match(calls[0]!.url, /\/my-bucket\/lolly\/lolly-sync\/snapshot\.lolly$/);
  assert.match(calls[0]!.headers.authorization ?? '', /^AWS4-HMAC-SHA256 Credential=AKIA_TEST\//);
  assert.ok(calls[0]!.headers['x-amz-content-sha256'], 'payload hash header present');
  assert.equal(meta.rev, 'abc123', 'ETag (quotes stripped) is the rev');
  assert.equal(meta.size, 3);
});

test('head: 404 → null, 200 → meta from headers', async () => {
  await connect();
  const notFound = s3SyncRemote(mockFetch(() => new Response(null, { status: 404 })).fetch);
  assert.equal(await notFound.head(), null);

  const present = s3SyncRemote(mockFetch(() =>
    new Response(null, { status: 200, headers: { etag: '"r7"', 'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT', 'content-length': '4096' } })).fetch);
  const meta = await present.head();
  assert.deepEqual(meta, { rev: 'r7', updatedAt: 'Wed, 01 Jan 2025 00:00:00 GMT', size: 4096 });
});

test('get downloads bytes + meta; 404 → null', async () => {
  await connect();
  const gone = s3SyncRemote(mockFetch(() => new Response(null, { status: 404 })).fetch);
  assert.equal(await gone.get(), null);

  const body = new Uint8Array([9, 8, 7, 6]);
  const remote = s3SyncRemote(mockFetch((c) => {
    assert.equal(c.method, 'GET');
    return new Response(body, { status: 200, headers: { etag: '"rev9"' } });
  }).fetch);
  const got = await remote.get();
  assert.deepEqual([...got!.bytes], [9, 8, 7, 6]);
  assert.equal(got!.meta.rev, 'rev9');
  assert.equal(got!.meta.size, 4);
});

test('put recovers the rev via a follow-up HEAD when the PUT response hides ETag', async () => {
  await connect();
  const { fetch, calls } = mockFetch((c) =>
    c.method === 'PUT'
      ? new Response(null, { status: 200 })                                  // no ETag exposed
      : new Response(null, { status: 200, headers: { etag: '"recovered"' } })); // the follow-up HEAD
  const remote = s3SyncRemote(fetch);

  const meta = await remote.put(new Uint8Array([1]));
  assert.deepEqual(calls.map((c) => c.method), ['PUT', 'HEAD'], 'HEAD follows a rev-less PUT');
  assert.equal(meta.rev, 'recovered');
});

test('put surfaces a non-OK bucket status', async () => {
  await connect();
  const remote = s3SyncRemote(mockFetch(() => new Response('denied', { status: 403 })).fetch);
  await assert.rejects(() => remote.put(new Uint8Array([1])), /403/);
});

// A stateful fake bucket - stores the one object, bumps its ETag on write, 404s
// when empty - so the engine's push→detect→pull loop runs end-to-end through the
// real s3SyncRemote code (SigV4 + header parsing), not just request shape.
function fakeBucket(): typeof fetch {
  const store = new Map<string, { bytes: Uint8Array; etag: string }>();
  let seq = 0;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = new URL(String(input)).pathname;
    const method = init?.method ?? 'GET';
    if (method === 'PUT') {
      const bytes = new Uint8Array(init!.body as Uint8Array);
      store.set(key, { bytes, etag: `"r${++seq}"` });
      return new Response(null, { status: 200, headers: { etag: store.get(key)!.etag } });
    }
    const obj = store.get(key);
    if (!obj) return new Response(null, { status: 404 });
    return new Response(method === 'HEAD' ? null : (obj.bytes as unknown as BodyInit), {
      status: 200, headers: { etag: obj.etag, 'content-length': String(obj.bytes.length) },
    });
  }) as unknown as typeof fetch;
}

// A compact in-memory BackupHost + storage (as in sync-engine.test.ts).
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

test('end-to-end: engine push→detect→pull through s3SyncRemote against a fake bucket', async () => {
  await connect();
  const fetch = fakeBucket();
  const a = makeHost({ 's1': { v: 1 } });
  const b = makeHost();

  const remoteA = s3SyncRemote(fetch);
  const { state: aState } = await pushSnapshot(a.deps, remoteA);

  // B (never synced) sees A's snapshot as newer and applies it.
  const remoteB = s3SyncRemote(fetch);
  assert.equal((await checkForNewer(remoteB, INITIAL_SYNC_STATE)).hasNewer, true);
  const { summary, state: bState } = await pullAndApply(b.deps, remoteB);
  assert.equal(summary.sessions, 1);
  assert.deepEqual(b.sess.get('s1')!.data, { v: 1 });

  // Neither device now sees a newer snapshot; a second push from A does bump it.
  assert.equal((await checkForNewer(remoteA, aState)).hasNewer, false);
  assert.equal((await checkForNewer(remoteB, bState)).hasNewer, false);
  await pushSnapshot(a.deps, remoteA);
  assert.equal((await checkForNewer(remoteB, bState)).hasNewer, true, 'B sees A’s second push');
});

test('end-to-end with encryption: the bucket holds ciphertext, the passphrase restores', async () => {
  await connect();
  const fetch = fakeBucket();
  const a = makeHost({ 's1': { secret: 42 } });
  await pushSnapshot(a.deps, s3SyncRemote(fetch), { passphrase: 'pw' });

  const b = makeHost();
  await assert.rejects(() => pullAndApply(b.deps, s3SyncRemote(fetch)), /encrypted/i);
  const c = makeHost();
  const { summary } = await pullAndApply(c.deps, s3SyncRemote(fetch), { passphrase: 'pw' });
  assert.equal(summary.sessions, 1);
  assert.deepEqual(c.sess.get('s1')!.data, { secret: 42 });
});
