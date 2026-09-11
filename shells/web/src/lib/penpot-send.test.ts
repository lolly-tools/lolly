// SPDX-License-Identifier: MPL-2.0
/**
 * Penpot send target (plans/178) - custody of the PAT (the Mastodon shape:
 * session-only default, at rest only by explicit choice) and the send flow:
 * one send makes ONE new Penpot file, imported as a binfile-v3 archive into
 * the project the send-time picker chose. Headless: connections ride
 * provider-connections' memory-only mode, the network is a stubbed global
 * fetch - the same rig as publish-send.test.ts.
 *
 * NOT covered here, deliberately: the picker MODAL itself. `prepare` mounts a
 * <dialog> through components/modal.ts, which needs a real DOM, so what is
 * tested is everything around it - the target declares a `prepare`, the
 * listing failures it maps, and the send's own reading of a `choice` (which is
 * what the modal resolves). The two surfaces that await `prepare` and skip the
 * render on a null (views/tool-actions.ts, views/catalog.ts) are DOM code too.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, zipSync } from 'fflate';
import { buildPenpotEntries, imageToPenpotDoc, penpotUuid } from '../../../../engine/src/penpot-file.ts';

import { connectPenpot, disconnectPenpot, testPenpot, penpotSendTarget } from './penpot-send.ts';
import { cachedToken, getConnection, hasConnection, resetConnectionsForTests } from './provider-connections.ts';

const realFetch = globalThis.fetch;

beforeEach(() => resetConnectionsForTests());
afterEach(() => {
  resetConnectionsForTests();
  globalThis.fetch = realFetch;
});

/** One canned response per URL-substring, recorded as it is served: JSON by
 *  default, `text` for import-binfile's server-sent-event answer. */
function stubFetch(routes: Array<{ match: string; status?: number; json?: unknown; text?: string }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes.find(r => url.includes(r.match));
    if (!route) return new Response('not stubbed', { status: 500 });
    return new Response(route.text ?? JSON.stringify(route.json ?? {}), {
      status: route.status ?? 200,
      headers: { 'content-type': route.text ? 'text/event-stream' : 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

/** What design.penpot.app answers an import with (probed 2026-09-02). */
const IMPORT_SSE = [
  'event: progress',
  'data: {"~:section":"~:manifest"}',
  '',
  'event: end',
  'data: ["~u40e06342-8830-80d6-8008-93e8caf41d9f"]',
  '',
].join('\n');

/** A PNG header the engine's `imageDimensions` can read - nothing more is
 *  needed, the writer stores the bytes verbatim. */
function fakePng(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const dv = new DataView(b.buffer);
  dv.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return b;
}

/** The archive the driver posted, unzipped. */
async function sentArchive(call: { init?: RequestInit }): Promise<Record<string, Uint8Array>> {
  const form = call.init?.body as FormData;
  const file = form.get('file') as Blob;
  return unzipSync(new Uint8Array(await file.arrayBuffer()));
}

const PROJECT = { id: 'p1', name: 'Brand kit' };
const CHOICE = { projectId: 'p1', projectName: 'Brand kit', teamId: 't1', name: 'Poster' };
const PAYLOAD = { bytes: fakePng(640, 480), name: 'poster', format: 'png', mime: 'image/png' };

// ── Custody ──────────────────────────────────────────────────────────────────

test('session-only custody keeps the PAT out of the record; persist writes it in', async () => {
  await connectPenpot(false, 'pat-secret', PROJECT);
  assert.ok(hasConnection('penpot'));
  let conn = await getConnection('penpot');
  assert.equal(conn?.persist, false);
  assert.equal(conn?.config?.token, undefined, 'session-only record is tokenless');
  assert.equal(conn?.config?.projectId, 'p1');
  assert.equal(cachedToken('penpot'), 'pat-secret', 'the token lives in the memory cache');
  assert.match(conn?.account ?? '', /design\.penpot\.app.*Brand kit/);

  await connectPenpot(true, 'pat-secret', PROJECT);
  conn = await getConnection('penpot');
  assert.equal(conn?.persist, true);
  assert.equal(conn?.config?.token, 'pat-secret', 'persist is the explicit choice that stores it');

  await disconnectPenpot();
  assert.ok(!hasConnection('penpot'));
  assert.equal(cachedToken('penpot'), null, 'disconnect drops the cached token too');
});

test('a token alone is a complete connection - the project is only a default', async () => {
  await connectPenpot(false, 'pat-secret');
  const conn = await getConnection('penpot');
  assert.equal(conn?.account, 'design.penpot.app', 'no project, no project in the label');
  assert.equal(conn?.config?.projectId, undefined);
  assert.ok(hasConnection('penpot'));
});

// ── The connect probe ────────────────────────────────────────────────────────

test('testPenpot: lists projects for the picker; an empty list is an honest failure', async () => {
  stubFetch([{ match: 'get-all-projects', json: [{ id: 'p1', name: 'Brand kit' }] }]);
  const ok = await testPenpot('pat');
  assert.ok(ok.ok);
  assert.deepEqual(ok.projects, [PROJECT]);

  stubFetch([{ match: 'get-all-projects', json: [] }]);
  const empty = await testPenpot('pat');
  assert.ok(!empty.ok);
  assert.match(empty.note, /no projects/);

  stubFetch([{ match: 'get-all-projects', status: 401 }]);
  const bad = await testPenpot('pat');
  assert.ok(!bad.ok);
  assert.match(bad.note, /401/);
});

// ── The destination question ─────────────────────────────────────────────────

test('the target declares a prepare - every surface asks before it renders', () => {
  assert.equal(typeof penpotSendTarget().prepare, 'function');
});

test('prepare: a rejected token reads as connect-again, and never reaches the import', async () => {
  await connectPenpot(false, 'pat', PROJECT);
  const calls = stubFetch([{ match: 'get-all-projects', status: 401 }]);
  await assert.rejects(
    () => penpotSendTarget().prepare!({ name: 'poster', format: 'png', mime: 'image/png' }),
    /connect again in Profile/);
  assert.equal(calls.length, 1, 'the listing failed - nothing was imported');
});

test('prepare: a token that sees no projects says so instead of opening an empty picker', async () => {
  await connectPenpot(false, 'pat', PROJECT);
  stubFetch([{ match: 'get-all-projects', json: [] }]);
  await assert.rejects(
    () => penpotSendTarget().prepare!({ name: 'poster', format: 'png', mime: 'image/png' }),
    /no projects/);
});

// ── The send flow ────────────────────────────────────────────────────────────

test('an image send imports ONE new file: a board, the picture as media, the brand alongside', async () => {
  await connectPenpot(false, 'pat', PROJECT);
  const calls = stubFetch([{ match: 'import-binfile', text: IMPORT_SSE }]);
  const target = penpotSendTarget();
  assert.ok(target.available());
  const out = await target.send({ ...PAYLOAD, choice: CHOICE });

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.url.includes('import-binfile'), 'the media library is not in the path any more');
  const form = calls[0]!.init?.body as FormData;
  assert.ok(form instanceof FormData);
  assert.equal(form.get('project-id'), 'p1', 'the project the picker chose');
  assert.equal(form.get('name'), 'Poster', 'the file name the picker chose');
  assert.equal(form.get('version'), '3');
  assert.equal((form.get('file') as File).name, 'Poster.penpot');

  const entries = await sentArchive(calls[0]!);
  const names = Object.keys(entries);
  assert.ok(names.includes('manifest.json'), 'a binfile-v3 archive, not a bare image');
  assert.ok(names.some(n => /^files\/[0-9a-f-]{36}\.json$/.test(n)), 'one file record');
  assert.ok(names.some(n => /^files\/[0-9a-f-]{36}\/media\/[0-9a-f-]{36}\.json$/.test(n)), 'the picture is real media');
  assert.ok(names.some(n => /^objects\/[0-9a-f-]{36}\.png$/.test(n)), 'with its storage blob beside it');
  const mediaPath = names.find(n => /\/media\//.test(n))!;
  const media = JSON.parse(new TextDecoder().decode(entries[mediaPath]!)) as Record<string, unknown>;
  assert.equal(media.mtype, 'image/png');
  assert.equal(media.width, 640);
  assert.equal(media.height, 480);
  assert.equal(media.isLocal, true, 'local media the board actually references');

  assert.match(out.label, /Poster/);
  assert.match(out.label, /Brand kit/);
  assert.equal(out.url, 'https://design.penpot.app/#/workspace?team-id=t1&file-id=40e06342-8830-80d6-8008-93e8caf41d9f');
});

test('a .penpot send is re-labelled inside the archive to the picked name, and nothing else moves', async () => {
  await connectPenpot(false, 'pat', PROJECT);
  const calls = stubFetch([{ match: 'import-binfile', text: IMPORT_SSE }]);
  // A real archive, as the export panel would hand over - named after the export.
  const doc = imageToPenpotDoc({ id: penpotUuid(), name: 'shot', mtype: 'image/png', width: 2, height: 2, bytes: fakePng(2, 2) }, { name: 'deck' });
  const built = buildPenpotEntries(doc).entries;
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(built)) files[k] = typeof v === 'string' ? enc.encode(v) : v;
  const bytes = zipSync(files);
  await penpotSendTarget().send({ bytes, name: 'deck', format: 'penpot', mime: 'application/x-penpot', choice: CHOICE });
  const entries = await sentArchive(calls[0]!);
  const dec = new TextDecoder();
  const manifest = JSON.parse(dec.decode(entries['manifest.json']!)) as { files: Array<{ name: string }> };
  assert.equal(manifest.files[0]!.name, 'Poster', 'the manifest names the picked file');
  const filePath = Object.keys(entries).find((n) => /^files\/[^/]+\.json$/.test(n))!;
  assert.equal((JSON.parse(dec.decode(entries[filePath]!)) as { name: string }).name, 'Poster', 'so does the file record');
  for (const [k, v] of Object.entries(files)) {
    if (k === 'manifest.json' || k === filePath) continue;
    assert.deepEqual(entries[k], v, `${k} is byte-identical`);
  }
  assert.equal((calls[0]!.init?.body as FormData).get('name'), 'Poster');
});
test('with no choice the send falls back to the connection default, and offers no link', async () => {
  await connectPenpot(false, 'pat', PROJECT);
  const calls = stubFetch([{ match: 'import-binfile', text: IMPORT_SSE }]);
  const out = await penpotSendTarget().send(PAYLOAD);
  assert.equal((calls[0]!.init?.body as FormData).get('project-id'), 'p1');
  assert.equal((calls[0]!.init?.body as FormData).get('name'), 'poster', 'the export filename');
  assert.match(out.label, /Brand kit/);
  assert.equal(out.url, undefined, 'no team id known, so no workspace link is invented');
});

test('a format Penpot stores nothing of is refused before the network', async () => {
  await connectPenpot(false, 'pat', PROJECT);
  const calls = stubFetch([{ match: 'import-binfile', text: IMPORT_SSE }]);
  await assert.rejects(
    () => penpotSendTarget().send({ bytes: new Uint8Array([1, 2, 3]), name: 'sheet', format: 'pdf', mime: 'application/pdf', choice: CHOICE }),
    /cannot take/);
  assert.equal(calls.length, 0);
});

test('a jpg send is normalised to image/jpeg, whatever the blob called itself', async () => {
  await connectPenpot(false, 'pat', PROJECT);
  const calls = stubFetch([{ match: 'import-binfile', text: IMPORT_SSE }]);
  await penpotSendTarget().send({ bytes: new Uint8Array([1, 2, 3]), name: 'shot', format: 'jpg', mime: 'image/jpg', choice: CHOICE });
  const entries = await sentArchive(calls[0]!);
  const mediaPath = Object.keys(entries).find(n => /\/media\//.test(n))!;
  const media = JSON.parse(new TextDecoder().decode(entries[mediaPath]!)) as Record<string, unknown>;
  assert.equal(media.mtype, 'image/jpeg');
  // Unreadable header - the writer still gets a size rather than a NaN.
  assert.equal(media.width, 1024);
  assert.equal(media.height, 1024);
});

test('a rejected token reads as connect-again, not a raw status', async () => {
  await connectPenpot(false, 'pat', PROJECT);
  stubFetch([{ match: 'import-binfile', status: 401, text: '{"type":"authentication"}' }]);
  await assert.rejects(() => penpotSendTarget().send({ ...PAYLOAD, choice: CHOICE }), /connect again in Profile/);
});

test("Penpot's own refusal is shown, not swallowed", async () => {
  await connectPenpot(false, 'pat', PROJECT);
  const sse = 'event: error\ndata: {"~:hint":"inconsistent-penpot-file"}\n\n';
  stubFetch([{ match: 'import-binfile', text: sse }]);
  await assert.rejects(() => penpotSendTarget().send({ ...PAYLOAD, choice: CHOICE }), /inconsistent-penpot-file/);
});

test('sending with no connection is refused before any network', async () => {
  const calls = stubFetch([]);
  await assert.rejects(() => penpotSendTarget().send(PAYLOAD), /Connect Penpot in Profile first/);
  assert.equal(calls.length, 0);
});

test('formats: the .penpot export plus every image the writer can wrap, no pdf', () => {
  const formats = penpotSendTarget().formats!;
  assert.ok(formats.includes('penpot'));
  assert.ok(formats.includes('png'));
  assert.ok(formats.includes('svg'));
  assert.ok(!formats.includes('pdf'));
});
