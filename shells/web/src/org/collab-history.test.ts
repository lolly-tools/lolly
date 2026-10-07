// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkCollabHistory, WorkHistoryError, type WorkHistoryFetch } from './collab-history.ts';

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refuse = (status: number, code?: string): Response => json({ error: { code: code ?? 'X', message: 'refused' } }, status);
/** An older instance: no versions routes. */
const noVersions = (input: string | URL): Response | undefined => (/\/versions(\?|$)/.test(String(input)) ? new Response('', { status: 404 }) : undefined);

test('Work refresh sees new revisions and copies use the actual tool identity', async () => {
  let calls = 0;
  let latest = 2;
  const history = createWorkCollabHistory('s/1', async (input, init) => {
    calls++;
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.credentials, 'include');
    const old = noVersions(input); if (old) return old;
    if (input === '/api/v1/sessions/s%2F1') return Response.json({ toolId: 'chart', toolVersion: '3' });
    assert.equal(input, '/api/v1/sessions/s%2F1/revisions');
    return json({ revisions: [
      ...(latest === 3 ? [{ sessionId: 's/1', rev: 3, inputs: { title: 'newest' } }] : []),
      { sessionId: 's/1', rev: 2, inputs: { title: 'new' }, meta: { label: 'Poster' }, actor: 'u2', actorLabel: 'Alex', at: '2026-09-07T10:00:00.000Z' },
      { sessionId: 's/1', rev: 1, inputs: { title: 'old' }, meta: {}, actor: 'u1', at: '2026-09-07T09:00:00.000Z' },
    ] });
  });
  const page = await history.list();
  assert.equal(page.entries[0]?.label, 'Poster');
  assert.equal(page.entries[0]?.toolId, 'chart');
  assert.deepEqual(page.entries[0]?.actor, { id: 'u2', label: 'Alex' });
  assert.deepEqual(page.entries[1]?.actor, { id: 'u1' }, 'older servers can omit display names');
  latest = 3;
  assert.equal((await history.list()).entries[0]?.revision, 3);
  const firstPage = await history.list({ limit: 1 });
  assert.equal(firstPage.before, 's/1:3');
  assert.deepEqual((await history.list({ before: firstPage.before })).entries.map(row => row.revision), [2, 1]);
  assert.deepEqual(await history.read('s/1:1'), { title: 'old', __toolId: 'chart', __label: 'Revision 1' });
  assert.equal(calls, 11, 'every action reaches the server again; a 404 on versions is asked once');
  assert.equal(history.canRestore, false);
  assert.equal(history.remove, undefined);
  assert.equal(history.preview, undefined, 'an older instance offers no previews, so its full revisions are not fetched per thumbnail');
});

test('access revoked after listing cannot be bypassed by reading or copying a cached payload', async () => {
  let denied = false;
  const history = createWorkCollabHistory('s', async input => {
    const old = noVersions(input); if (old) return old;
    if (denied && String(input).endsWith('/revisions')) return new Response('', { status: 403 });
    return Response.json(String(input).endsWith('/revisions')
      ? { revisions: [{ sessionId: 's', rev: 1, inputs: { secret: 'private' } }] }
      : { toolId: 'gradient' });
  });
  assert.equal((await history.list()).entries.length, 1);
  denied = true;
  await assert.rejects(history.read('s:1'), /403/);
  await assert.rejects(history.saveCopy!('s:1'), /403/);
  await assert.rejects(history.list(), /403/);
});

test('malformed rows and rows for another session cannot be opened', async () => {
  const history = createWorkCollabHistory('s', async input => noVersions(input) ?? Response.json(String(input).endsWith('/revisions')
    ? { revisions: [null, [], { rev: '2' }, { rev: -1 }, { sessionId: 'other', rev: 1, inputs: {} },
      { rev: 3, inputs: [], meta: {} }, { rev: 4, inputs: { title: 'good' }, meta: { toolId: 'chart', toolVersion: '2' } }] }
    : { toolId: 'gradient' }));
  assert.deepEqual((await history.list()).entries.map(row => row.revision), [4, 3]);
  assert.equal(await history.read('s:1'), null);
  assert.equal(await history.read('s:3'), null);
  assert.deepEqual(await history.saveCopy!('s:4'), { title: 'good', __toolId: 'chart', __toolVersion: '2', __label: 'Revision 4' });
  assert.deepEqual((await history.list({ before: 's:expired' })).entries, []);
});

test('missing tool identity fails clearly instead of guessing Design', async () => {
  const history = createWorkCollabHistory('s', async () => Response.json({}));
  await assert.rejects(history.list(), /tool identity/);
});

// ── Saved versions (plan 76 M4) ───────────────────────────────────────────────

interface Sent { url: string; method: string; body?: unknown }
function versionsHost(role: string, versions: unknown[], extra: (url: string, method: string, body: unknown) => Response | undefined = () => undefined) {
  const sent: Sent[] = [];
  const fetcher: WorkHistoryFetch = async (input, init) => {
    const url = String(input), method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined;
    sent.push({ url, method, ...(body === undefined ? {} : { body }) });
    const answer = extra(url, method, body);
    if (answer) return answer;
    if (url === '/api/v1/sessions/s1') return json({ id: 's1', toolId: 'design', label: 'Spring poster', projectId: 'p1', myRole: role });
    if (url.startsWith('/api/v1/sessions/s1/versions?')) return json({ versions, before: 'cursor-2' });
    return new Response('', { status: 500 });
  };
  return { sent, fetcher };
}
const version = (id: string, kind: string, more: Record<string, unknown> = {}) => ({ id, sessionId: 's1', rev: 4, kind, at: '2026-10-08T09:00:00.000Z', bytes: 10, contributors: [], ...more });

test('versions are listed with their reason, name and contributors; the before state of a restore is not a row', async () => {
  const { sent, fetcher } = versionsHost('editor', [
    version('ver_named', 'named', { label: '  Final draft ', createdBy: 'u1', createdByName: 'Ana',
      contributors: [{ id: 'u1', kind: 'user', edits: 3, name: 'Ana' }, { id: 'guest', kind: 'guest', edits: 2, name: 'Guest' }, { id: 'a1', kind: 'agent', edits: 1, name: 'Layout helper' }] }),
    version('ver_before', 'before', { createdBy: 'u1' }),
    version('ver_restore', 'restore', { createdBy: 'u2', createdByName: 'Ben', restoredFrom: 'ver_auto' }),
    version('ver_auto', 'auto'), version('ver_close', 'close'), version('ver_save', 'save', { createdBy: 'u3' }),
    version('../escape', 'auto'), version('ver_other', 'auto', { sessionId: 's2' }), version('ver_bad', 'mystery'),
    version('ver_rev', 'auto', { rev: -1 }), { id: 'ver_noat', kind: 'auto', rev: 1 },
  ]);
  const history = createWorkCollabHistory('s1', fetcher);
  const page = await history.list({ limit: 500 });
  assert.equal(sent[1]?.url, '/api/v1/sessions/s1/versions?limit=100', 'the server limit is 1 to 100');
  assert.equal(page.before, 'cursor-2');
  assert.deepEqual(page.entries.map(entry => [entry.id, entry.reason]), [
    ['ver_named', 'named'], ['ver_restore', 'restore'], ['ver_auto', 'checkpoint'], ['ver_close', 'checkpoint'], ['ver_save', 'save'],
  ]);
  const named = page.entries[0]!;
  assert.equal(named.label, 'Final draft');
  assert.deepEqual(named.actor, { id: 'u1', label: 'Ana' });
  assert.deepEqual(named.contributors, [{ id: 'u1', label: 'Ana' }, { id: 'guest' }, { id: 'a1', label: 'Layout helper' }],
    'a guest is one aggregate named by the shell, with no link id');
  assert.equal(page.entries[2]?.label, 'Spring poster', 'an unnamed version carries the document name');
  assert.deepEqual(page.entries[2]?.actor, { id: 'collab' });
  await history.list({ before: 'cursor-2' });
  assert.equal(sent.at(-1)?.url, '/api/v1/sessions/s1/versions?limit=30&before=cursor-2');
});

test('only writers may restore or save, and only managers may delete', async () => {
  for (const [role, restore, remove] of [['viewer', false, false], ['editor', true, false], ['manager', true, true], ['owner', true, true], [undefined, false, false]] as const) {
    const { fetcher } = versionsHost(role as string, [version('ver_auto', 'auto')]);
    const history = createWorkCollabHistory('s1', fetcher);
    assert.equal(history.canRestore, false, 'nothing is offered before the instance answered');
    await history.list();
    assert.equal(history.canRestore, restore, `${role} restore`);
    assert.equal(typeof history.remove === 'function', remove, `${role} delete`);
  }
});

test('a version opens as a copy from its stored inputs, and a version of another session does not', async () => {
  const { fetcher } = versionsHost('viewer', [], url => {
    if (url === '/api/v1/sessions/s1/versions/ver_named') return json({ version: { ...version('ver_named', 'named', { label: 'Final' }), inputs: { title: 'v1' }, meta: { toolId: 'chart', toolVersion: '2' } } });
    if (url === '/api/v1/sessions/s1/versions/ver_auto') return json({ version: { ...version('ver_auto', 'auto'), inputs: { title: 'auto' }, meta: { label: 'Old name' } } });
    if (url === '/api/v1/sessions/s1/versions/ver_other') return json({ version: { ...version('ver_other', 'auto', { sessionId: 's2' }), inputs: {}, meta: {} } });
    if (url === '/api/v1/sessions/s1/versions/ver_gone') return new Response('', { status: 404 });
    return undefined;
  });
  const history = createWorkCollabHistory('s1', fetcher);
  assert.deepEqual(await history.read('ver_named'), { title: 'v1', __toolId: 'chart', __toolVersion: '2', __label: 'Final' });
  assert.deepEqual(await history.saveCopy!('ver_auto'), { title: 'auto', __toolId: 'design', __label: 'Old name' });
  assert.equal(await history.read('ver_other'), null);
  assert.equal(await history.read('ver_gone'), null);
  assert.equal(await history.read('../../admin'), null, 'an id that is not a version id never becomes a path');
});

test('Save version posts the trimmed name with a fresh request id and maps refusals to their copy', async () => {
  let refusal: Response | undefined;
  const { sent, fetcher } = versionsHost('editor', [], (url, method) => {
    if (url === '/api/v1/sessions/s1/versions' && method === 'POST') return refusal ?? json({ version: version('ver_new', 'named') }, 201);
    return undefined;
  });
  let next = 0;
  const history = createWorkCollabHistory('s1', fetcher, { requestId: () => `req-${++next}` });
  await history.saveVersion!(`  ${'x'.repeat(130)} `);
  assert.deepEqual(sent.at(-1), { url: '/api/v1/sessions/s1/versions', method: 'POST', body: { label: 'x'.repeat(120), requestId: 'req-1' } });
  await history.saveVersion!('Launch 😀'.padEnd(119, '.') + '😀');
  assert.equal((sent.at(-1)!.body as { label: string }).label.length, 119, 'a character is never split at the limit');
  await assert.rejects(history.saveVersion!('   '), WorkHistoryError);
  for (const [response, copy] of [
    [refuse(409, 'VERSION_SPACE'), 'History is full. Ask a manager to delete old versions.'],
    [refuse(409, 'VERSION_LIMIT'), 'History is full. Ask a manager to delete old versions.'],
    [refuse(429, 'RATE_LIMITED'), 'Too many version changes. Try again in a minute.'],
    [refuse(403, 'READ_ONLY'), 'Only editors can restore versions.'],
    [refuse(409, 'PROJECT_ARCHIVED'), 'Could not complete this action. Please try again.'],
    [new Response('not json', { status: 500 }), 'Could not complete this action. Please try again.'],
  ] as const) {
    refusal = response;
    await assert.rejects(history.saveVersion!('Named'), (error: unknown) => error instanceof WorkHistoryError && error.message === copy);
  }
  assert.equal(new Set(sent.filter(item => item.method === 'POST').map(item => (item.body as { requestId: string }).requestId)).size, 8, 'every save has its own request id');
});

test('restore posts a fresh request id and reports the version that undoes it with what stayed unchanged', async () => {
  let answer: Response = json({ revision: 9, live: true, restored: { id: 'ver_r' }, before: { id: 'ver_b' }, skipped: ['layout', 7], vetoed: ['brand'] });
  const { sent, fetcher } = versionsHost('editor', [], (url, method) => (url.endsWith('/restore') && method === 'POST' ? answer : undefined));
  const history = createWorkCollabHistory('s1', fetcher, { requestId: () => 'req' });
  assert.deepEqual(await history.restore!('ver_auto'), { undoId: 'ver_b', skipped: ['layout'], vetoed: ['brand'] });
  assert.deepEqual(sent.at(-1), { url: '/api/v1/sessions/s1/versions/ver_auto/restore', method: 'POST', body: { requestId: 'req' } });
  answer = json({ revision: 10, live: false, restored: 'ver_r2', before: 'ver_b2', skipped: [], vetoed: [] });
  assert.deepEqual(await history.restore!('ver_b'), { undoId: 'ver_b2', skipped: [], vetoed: [] });
  answer = json({ revision: 11, before: '../x' });
  assert.deepEqual(await history.restore!('ver_b'), { skipped: [], vetoed: [] }, 'an undo target that is not a version id is not offered');
  for (const [response, copy] of [
    [refuse(409, 'RESTORE_INCOMPLETE'), 'Nothing was restored because the document could not take every change. Try again.'],
    [refuse(409, 'SESSION_CHANGED'), 'The document changed while restoring. Try again.'],
    [refuse(409, 'VERSION_SPACE'), 'History is full. Ask a manager to delete old versions.'],
    [refuse(404, 'NOT_FOUND'), 'This version is no longer available.'],
    [refuse(410, 'SESSION_DELETED'), 'This version is no longer available.'],
    [refuse(429, 'RATE_LIMITED'), 'Too many version changes. Try again in a minute.'],
  ] as const) {
    answer = response;
    await assert.rejects(history.restore!('ver_auto'), (error: unknown) => error instanceof WorkHistoryError && error.message === copy);
  }
  const before = sent.length;
  await assert.rejects(history.restore!('../ver'), WorkHistoryError);
  assert.equal(sent.length, before, 'an invalid id is refused without a request');
});

test('a manager deletes a version; the request names only that version', async () => {
  const { sent, fetcher } = versionsHost('manager', [version('ver_auto', 'auto')], (url, method) =>
    (method === 'DELETE' ? (url.endsWith('/ver_auto') ? json({ deleted: true }) : refuse(404, 'NOT_FOUND')) : undefined));
  const history = createWorkCollabHistory('s1', fetcher);
  await history.list();
  await history.remove!('ver_auto');
  assert.deepEqual(sent.at(-1), { url: '/api/v1/sessions/s1/versions/ver_auto', method: 'DELETE' });
  await assert.rejects(history.remove!('ver_gone'), /no longer available/);
  const empty = versionsHost('owner', [version('ver_auto', 'auto')], (_url, method) => (method === 'DELETE' ? new Response(null, { status: 204 }) : undefined));
  const quiet = createWorkCollabHistory('s1', empty.fetcher);
  await quiet.list();
  await quiet.remove!('ver_auto');
});

test('a preview renders the version inputs; failures and unsafe images become no preview', async () => {
  const { fetcher } = versionsHost('viewer', [], url => (url.endsWith('/versions/ver_auto')
    ? json({ version: { ...version('ver_auto', 'auto'), inputs: { title: 'auto' }, meta: {} } })
    : url.endsWith('/versions/ver_missing') ? refuse(404, 'NOT_FOUND') : undefined));
  const jobs: unknown[] = [];
  let image = 'data:image/png;base64,AAAA';
  const history = createWorkCollabHistory('s1', fetcher, { render: async job => { jobs.push(job); if (image === 'throw') throw new Error('no'); return image; } });
  assert.equal(await history.preview!('ver_auto'), image);
  assert.deepEqual(jobs[0], { sessionId: 's1', projectId: 'p1', versionId: 'ver_auto', toolId: 'design', inputs: { title: 'auto' } });
  image = 'javascript:alert(1)';
  assert.equal(await history.preview!('ver_auto'), null);
  image = 'throw';
  assert.equal(await history.preview!('ver_auto'), null);
  assert.equal(await history.preview!('ver_missing'), null);
});

test('a changed instance or account refuses every request', async () => {
  let person = 'u1';
  const { sent, fetcher } = versionsHost('editor', []);
  const history = createWorkCollabHistory('s1', fetcher, { principal: () => person });
  await history.list();
  person = 'u2';
  const before = sent.length;
  await assert.rejects(history.list(), WorkHistoryError);
  await assert.rejects(history.restore!('ver_auto'), WorkHistoryError);
  await assert.rejects(history.saveVersion!('Named'), WorkHistoryError);
  assert.equal(sent.length, before, 'nothing reaches the instance for the next account');
});

test('after a list, a thumbnail asks only for its version, which the instance still checks', async () => {
  const { sent, fetcher } = versionsHost('viewer', [version('ver_auto', 'auto')], url => (url.endsWith('/versions/ver_auto')
    ? json({ version: { ...version('ver_auto', 'auto'), inputs: { title: 'auto' }, meta: {} } }) : undefined));
  const history = createWorkCollabHistory('s1', fetcher, { render: async () => 'data:image/png;base64,AAAA' });
  await history.list();
  const before = sent.length;
  assert.equal(await history.preview!('ver_auto'), 'data:image/png;base64,AAAA');
  assert.deepEqual(sent.slice(before).map(item => item.url), ['/api/v1/sessions/s1/versions/ver_auto']);
  await history.read('ver_auto');
  assert.deepEqual(sent.slice(before + 1).map(item => item.url), ['/api/v1/sessions/s1', '/api/v1/sessions/s1/versions/ver_auto'],
    'a copy rechecks the session as well');
});
