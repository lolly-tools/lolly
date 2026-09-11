// SPDX-License-Identifier: MPL-2.0
/**
 * lib/google-drive.ts `driveSyncRemote` (plans/138 B1). drive.file scope → the
 * snapshot is a well-known-named file found via files.list and created/updated in
 * place; `rev` is headRevisionId. Mock-fetch coverage of find-then-create vs
 * find-then-update, head/get, 404→null, canSyncSilently (web session token), plus
 * an end-to-end engine run against a stateful fake Drive.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { driveSyncRemote, seedDriveTokenForTests, resetDriveToken } from './google-drive.ts';
import { pushSnapshot, checkForNewer, pullAndApply, INITIAL_SYNC_STATE } from './sync-engine.ts';

interface Call { url: string; method: string }
function mockFetch(handler: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = { url: String(input), method: init?.method ?? 'GET' };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetch: fn, calls };
}
const isList = (c: Call) => c.method === 'GET' && c.url.includes('/drive/v3/files?q=');

test('canSyncSilently is false without a session token, true once seeded (web)', async () => {
  resetDriveToken();
  const remote = driveSyncRemote(mockFetch(() => new Response('{}')).fetch);
  assert.equal(await remote.canSyncSilently!(), false);
  seedDriveTokenForTests('tok');
  assert.equal(await remote.canSyncSilently!(), true);
});

test('put CREATES via multipart when no file exists, returning headRevisionId as rev', async () => {
  seedDriveTokenForTests('tok');
  const { fetch, calls } = mockFetch((c) =>
    isList(c) ? new Response(JSON.stringify({ files: [] }))
    : new Response(JSON.stringify({ id: 'f1', headRevisionId: 'h1', size: '3' })));
  const meta = await driveSyncRemote(fetch).put(new Uint8Array([1, 2, 3]));

  assert.ok(isList(calls[0]!), 'looks the file up first');
  assert.match(calls[0]!.url, /name%3D'lolly-sync\.lolly'|name='lolly-sync\.lolly'/);
  assert.equal(calls[1]!.method, 'POST');
  assert.match(calls[1]!.url, /uploadType=multipart/);
  assert.equal(meta.rev, 'h1');
});

test('put UPDATES via media PATCH when the file already exists', async () => {
  seedDriveTokenForTests('tok');
  const { fetch, calls } = mockFetch((c) =>
    isList(c) ? new Response(JSON.stringify({ files: [{ id: 'f9', headRevisionId: 'old' }] }))
    : new Response(JSON.stringify({ id: 'f9', headRevisionId: 'new' })));
  const meta = await driveSyncRemote(fetch).put(new Uint8Array([9]));

  assert.equal(calls[1]!.method, 'PATCH');
  assert.match(calls[1]!.url, /\/files\/f9\?uploadType=media/);
  assert.equal(meta.rev, 'new');
});

test('head: no file → null, file → meta; get downloads media', async () => {
  seedDriveTokenForTests('tok');
  assert.equal(await driveSyncRemote(mockFetch(() => new Response(JSON.stringify({ files: [] }))).fetch).head(), null);

  const body = new Uint8Array([7, 7]);
  const remote = driveSyncRemote(mockFetch((c) =>
    isList(c) ? new Response(JSON.stringify({ files: [{ id: 'f1', headRevisionId: 'h2', size: '2', modifiedTime: '2025-01-01T00:00:00Z' }] }))
    : new Response(body as unknown as BodyInit)).fetch);
  const meta = await remote.head();
  assert.equal(meta!.rev, 'h2');
  const got = await remote.get();
  assert.deepEqual([...got!.bytes], [7, 7]);
  assert.equal(got!.meta.rev, 'h2');
});

// Extract the octet-stream content from a multipart/related create body the way
// real Drive does. Uses a TRUE Latin-1 binary string (String.fromCharCode is 1:1
// for bytes 0-255; TextDecoder('latin1') is windows-1252 and mangles 0x80-0x9F),
// so the zip round-trips byte-exact.
function multipartContent(body: Uint8Array): Uint8Array {
  let s = '';
  for (let i = 0; i < body.length; i++) s += String.fromCharCode(body[i]!);
  const boundary = s.slice(2, s.indexOf('\r\n'));        // leading "--<boundary>"
  const part = s.split(`--${boundary}`)[2] ?? '';         // ['', jsonPart, contentPart, '--']
  const content = part.slice(part.indexOf('\r\n\r\n') + 4, part.length - 2); // drop trailing CRLF
  const out = new Uint8Array(content.length);
  for (let i = 0; i < content.length; i++) out[i] = content.charCodeAt(i) & 0xff;
  return out;
}

// Stateful fake Drive: one file, list/create(multipart)/update(media)/media-download.
function fakeDrive(): typeof fetch {
  let file: { id: string; rev: number; bytes: Uint8Array } | null = null;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    if (method === 'GET' && url.includes('/drive/v3/files?q=')) {
      return new Response(JSON.stringify({ files: file ? [{ id: file.id, headRevisionId: `h${file.rev}`, size: String(file.bytes.length) }] : [] }));
    }
    if (method === 'GET' && /alt=media/.test(url)) {
      return new Response((file?.bytes ?? new Uint8Array()) as unknown as BodyInit);
    }
    if (method === 'POST') { file = { id: 'f1', rev: 1, bytes: multipartContent(new Uint8Array(init!.body as Uint8Array)) }; return new Response(JSON.stringify({ id: 'f1', headRevisionId: 'h1' })); }
    if (method === 'PATCH') { file = { id: 'f1', rev: (file?.rev ?? 0) + 1, bytes: new Uint8Array(init!.body as Uint8Array) }; return new Response(JSON.stringify({ id: 'f1', headRevisionId: `h${file.rev}` })); }
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

test('end-to-end: engine push→detect→pull through driveSyncRemote against a fake Drive', async () => {
  seedDriveTokenForTests('tok');
  const fetch = fakeDrive();
  const a = makeHost({ 's1': { v: 1 } });
  const b = makeHost();

  const { state: aState } = await pushSnapshot(a.deps, driveSyncRemote(fetch));
  assert.equal((await checkForNewer(driveSyncRemote(fetch), INITIAL_SYNC_STATE)).hasNewer, true);
  const { summary } = await pullAndApply(b.deps, driveSyncRemote(fetch));
  assert.equal(summary.sessions, 1);
  assert.deepEqual(b.sess.get('s1')!.data, { v: 1 });

  assert.equal((await checkForNewer(driveSyncRemote(fetch), aState)).hasNewer, false);
  await pushSnapshot(a.deps, driveSyncRemote(fetch));   // update → new headRevisionId
  assert.equal((await checkForNewer(driveSyncRemote(fetch), aState)).hasNewer, true, 'a second push bumps the rev');
});
