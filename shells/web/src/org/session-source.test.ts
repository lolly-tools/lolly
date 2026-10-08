// SPDX-License-Identifier: MPL-2.0
/**
 * org/session-source.ts - the control-plane SessionSource adapter.
 *
 * Stubs global fetch (org traffic goes through instanceFetch → window.fetch for the
 * same-origin relative paths used here). Proves it maps the server contract onto the
 * seam types, and degrades to []/null on a failed request rather than throwing.
 *
 * Run directly:  node --test shells/web/src/org/session-source.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

let router: (url: string, init?: RequestInit) => Response = () => new Response('', { status: 404 });
const calls: Array<{ url: string; method: string; body: unknown; contentType: string | null }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({
    url: String(input),
    method: init?.method ?? 'GET',
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    contentType: new Headers(init?.headers).get('content-type'),
  });
  return router(String(input), init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { createInstanceSessionSource, teamProjectOptions, SESSION_BODY_LIMIT, COLLAB_ACTIVE, saveErrorCode } = await import('./session-source.ts');
const { registerSessionSource, getSessionWriter, _clearSessionSourceForTests } = await import('../lib/session-source.ts');
const src = createInstanceSessionSource('Acme');
let config: { can?: Record<string, boolean>; sharing?: { groups?: unknown } } | null = null;
const writable = createInstanceSessionSource('Acme', () => config);
const writer = writable.write!;

test('label is carried through for the section heading', () => {
  assert.equal(src.label, 'Acme');
});

test('listProjects maps the server shape', async () => {
  router = (url) => url.includes('/api/v1/projects')
    ? json({ projects: [{ id: 'p1', name: 'Summit', sessionCount: 3, updatedAt: '2026-07-21', ownerId: 'u9' }] })
    : new Response('', { status: 404 });
  const projects = await src.listProjects();
  assert.deepEqual(projects, [{ id: 'p1', name: 'Summit', sessionCount: 3, updatedAt: '2026-07-21' }]);
});

test('listSessions maps the server shape', async () => {
  router = (url) => url.includes('/api/v1/projects/p1/sessions')
    ? json({ sessions: [{ id: 's1', toolId: 'event-badge', label: 'Cover', rev: 2, updatedBy: 'u1', updatedAt: 'x', inputs: { secret: 1 } }] })
    : new Response('', { status: 404 });
  const sessions = await src.listSessions('p1');
  assert.deepEqual(sessions, [{ id: 's1', toolId: 'event-badge', label: 'Cover', updatedAt: 'x', updatedBy: 'u1' }]);
});

test('listSessions leaves out the nulls the instance sends for no label and no name', async () => {
  // lolly-work's row for a session saved without a label, by someone it cannot name.
  router = (url) => url.includes('/api/v1/projects/p1/sessions')
    ? json({ sessions: [{ id: 's2', toolId: 'chart', toolVersion: '1.0.0', label: null, meta: {}, rev: 1, updatedBy: 'u1', updatedAt: 'y', updatedByName: null }] })
    : new Response('', { status: 404 });
  const sessions = await src.listSessions('p1');
  assert.deepEqual(sessions, [{ id: 's2', toolId: 'chart', updatedAt: 'y', updatedBy: 'u1' }]);
  assert.equal('label' in sessions[0]!, false, 'no own key holding null');
});

test('fetchSession returns full state, or null when incomplete/gone', async () => {
  router = (url) => url.includes('/api/v1/sessions/s1')
    ? json({ id: 's1', toolId: 'event-badge', toolVersion: '1.0.0', inputs: { title: 'Hi' }, meta: { label: 'Cover' } })
    : new Response('', { status: 410 });
  assert.deepEqual(await src.fetchSession('s1'), {
    id: 's1', toolId: 'event-badge', toolVersion: '1.0.0', inputs: { title: 'Hi' }, meta: { label: 'Cover' },
  });
  assert.equal(await src.fetchSession('gone'), null); // 410 → null
  router = () => json({ id: 'x', toolId: 'event-badge' }); // no inputs
  assert.equal(await src.fetchSession('x'), null);
});

test('a network error degrades to empty / null (never throws into the view)', async () => {
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await src.listProjects(), []);
  assert.deepEqual(await src.listSessions('p1'), []);
  assert.equal(await src.fetchSession('s1'), null);
});

test('fetchSession keeps the revision and project the server reports', async () => {
  router = () => json({ id: 's2', projectId: 'p1', toolId: 'chart', inputs: { a: 1 }, rev: 7, updatedBy: 'u2', updatedAt: 't' });
  assert.deepEqual(await src.fetchSession('s2'), {
    id: 's2', projectId: 'p1', toolId: 'chart', inputs: { a: 1 }, rev: 7, updatedBy: 'u2', updatedAt: 't',
  });
});

// ── The write half ────────────────────────────────────────────────────────────

test('a source built without config is read-only; with it, the seam exposes the writer', () => {
  _clearSessionSourceForTests();
  assert.equal(src.write, undefined);
  registerSessionSource(src);
  assert.equal(getSessionWriter(), undefined, 'read-only source: nothing to write with');
  registerSessionSource(writable);
  assert.equal(getSessionWriter(), writer);
  _clearSessionSourceForTests();
  assert.equal(getSessionWriter(), undefined, 'dormant: no writer');
});

test('updateSession: a 200 is saved with the new rev, sent as a same-origin JSON PUT', async () => {
  calls.length = 0;
  router = (url, init) => url.endsWith('/api/v1/sessions/s1') && init?.method === 'PUT'
    ? json({ id: 's1', rev: 4 })
    : new Response('', { status: 404 });
  const got = await writer.updateSession({ id: 's1', inputs: { title: 'Hi', rows: [{ a: 1 }] }, meta: { label: 'Cover' }, rev: 3 });
  assert.deepEqual(got, { kind: 'saved', id: 's1', rev: 4 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, '/api/v1/sessions/s1');
  assert.equal(calls[0]!.contentType, 'application/json');
  assert.deepEqual(calls[0]!.body, { inputs: { title: 'Hi', rows: [{ a: 1 }] }, meta: { label: 'Cover' }, rev: 3 });
});

test('updateSession: a 409 is a conflict carrying the newer version', async () => {
  router = () => json({
    error: { code: 'CONFLICT' },
    current: { id: 's1', projectId: 'p1', toolId: 'event-badge', inputs: { title: 'Theirs' }, meta: { label: 'Cover' }, rev: 5, updatedBy: 'u7' },
  }, 409);
  const got = await writer.updateSession({ id: 's1', inputs: { title: 'Mine' }, rev: 3 });
  assert.deepEqual(got, {
    kind: 'conflict',
    current: { id: 's1', projectId: 'p1', toolId: 'event-badge', inputs: { title: 'Theirs' }, meta: { label: 'Cover' }, rev: 5, updatedBy: 'u7' },
  });
});

test('updateSession: a 409 carries who saved the newer version, by name, when the instance says', async () => {
  router = () => json({
    error: { code: 'CONFLICT' },
    current: { id: 's1', toolId: 'qr-code', inputs: {}, rev: 6, updatedBy: 'u7', updatedAt: '2026-10-02T11:58:00Z', updatedByName: ' Bea Teammate ' },
  }, 409);
  const got = await writer.updateSession({ id: 's1', inputs: {}, rev: 3 });
  assert.equal(got.kind, 'conflict');
  assert.equal(got.kind === 'conflict' && got.current.updatedByName, 'Bea Teammate');
  assert.equal(got.kind === 'conflict' && got.current.updatedAt, '2026-10-02T11:58:00Z');
  // A null or blank name (the person has none on record) is left out, not kept as text.
  router = () => json({ current: { toolId: 'qr-code', inputs: {}, rev: 6, updatedByName: null } }, 409);
  const none = await writer.updateSession({ id: 's1', inputs: {}, rev: 3 });
  assert.equal(none.kind === 'conflict' && 'updatedByName' in none.current, false);
  assert.equal(none.kind === 'conflict' && 'updatedByYou' in none.current, false, 'absent unless the instance says so');
});

test('updateSession: a 409 says when the newer version is the reader\'s own save', async () => {
  router = () => json({ current: { toolId: 'qr-code', inputs: {}, rev: 6, updatedByName: 'Andy Owner', updatedByYou: true } }, 409);
  const mine = await writer.updateSession({ id: 's1', inputs: {}, rev: 3 });
  assert.equal(mine.kind === 'conflict' && mine.current.updatedByYou, true);
  // Only a real true counts: a string or false is not read as "yours".
  router = () => json({ current: { toolId: 'qr-code', inputs: {}, rev: 6, updatedByYou: 'true' } }, 409);
  const odd = await writer.updateSession({ id: 's1', inputs: {}, rev: 3 });
  assert.equal(odd.kind === 'conflict' && 'updatedByYou' in odd.current, false);
});

test('updateSession: a 409 with no readable current version is an error, not an empty conflict', async () => {
  router = () => json({ error: { code: 'CONFLICT' } }, 409);
  const got = await writer.updateSession({ id: 's1', inputs: {}, rev: 1 });
  assert.deepEqual(got, { kind: 'error', status: 409 });
  assert.equal(saveErrorCode(got), undefined, 'a plain conflict keeps no code');
});

test('updateSession: a live collab\'s 409 is a refusal with its code, never a conflict', async () => {
  router = () => json({ error: { code: 'COLLAB_ACTIVE', message: 'live room' } }, 409);
  const got = await writer.updateSession({ id: 's1', inputs: {}, rev: 1 });
  assert.equal(got.kind, 'error');
  assert.equal(got.kind === 'error' && got.status, 409);
  assert.equal(saveErrorCode(got), COLLAB_ACTIVE);
  // Even with a version beside the code, there is no "open theirs or save a copy" to offer.
  router = () => json({ error: { code: 'COLLAB_ACTIVE' }, current: { toolId: 'qr-code', inputs: {}, rev: 9 } }, 409);
  const withCurrent = await writer.updateSession({ id: 's1', inputs: {}, rev: 1 });
  assert.equal(withCurrent.kind, 'error');
  assert.equal(saveErrorCode(withCurrent), COLLAB_ACTIVE);
  assert.equal(saveErrorCode({ kind: 'saved', id: 's1', rev: 2 }), undefined);
});

test('writes keep the status of a refusal, and 0 for no answer', async () => {
  router = () => json({ error: { code: 'FORBIDDEN' } }, 403);
  assert.deepEqual(await writer.updateSession({ id: 's1', inputs: {}, rev: 1 }), { kind: 'error', status: 403 });
  assert.deepEqual(await writer.createSession('p1', { toolId: 'qr-code', inputs: {} }), { kind: 'error', status: 403 });
  assert.deepEqual(await writer.createProject({ name: 'X', visibility: 'private' }), { kind: 'error', status: 403 });
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await writer.updateSession({ id: 's1', inputs: {}, rev: 1 }), { kind: 'error', status: 0 });
  router = () => json({ ok: true }); // a 200 without a rev is not a save we can record
  assert.deepEqual(await writer.updateSession({ id: 's1', inputs: {}, rev: 1 }), { kind: 'error', status: 0 });
});

test('createSession posts to the project and returns the new id and rev', async () => {
  calls.length = 0;
  router = (url, init) => url.endsWith('/api/v1/projects/p%201/sessions') && init?.method === 'POST'
    ? json({ id: 'new-1', rev: 1 }, 201)
    : new Response('', { status: 404 });
  const got = await writer.createSession('p 1', { toolId: 'event-badge', toolVersion: '2.1.0', inputs: { title: 'Hi' }, meta: { label: 'Cover' } });
  assert.deepEqual(got, { kind: 'saved', id: 'new-1', rev: 1 });
  assert.deepEqual(calls[0]!.body, { toolId: 'event-badge', toolVersion: '2.1.0', inputs: { title: 'Hi' }, meta: { label: 'Cover' } });
});

test('a body over the 4 MiB cap is refused locally with 413, without a request', async () => {
  calls.length = 0;
  router = () => json({ id: 'x', rev: 1 }, 201);
  const big = 'x'.repeat(SESSION_BODY_LIMIT);
  assert.deepEqual(await writer.createSession('p1', { toolId: 'design', inputs: { doc: big } }), { kind: 'error', status: 413 });
  assert.deepEqual(await writer.updateSession({ id: 's1', inputs: { doc: big }, rev: 1 }), { kind: 'error', status: 413 });
  assert.equal(calls.length, 0);
});

test('createProject sends name and visibility, and reads the created project', async () => {
  calls.length = 0;
  router = (url, init) => url.endsWith('/api/v1/projects') && init?.method === 'POST'
    ? json({ id: 'p9', name: 'Launch', visibility: { groups: ['design'] } }, 201)
    : new Response('', { status: 404 });
  assert.deepEqual(await writer.createProject({ name: '  Launch ', visibility: { groups: ['design'] } }),
    { kind: 'created', project: { id: 'p9', name: 'Launch' } });
  assert.deepEqual(calls[0]!.body, { name: 'Launch', visibility: { groups: ['design'] } });
  assert.deepEqual(await writer.createProject({ name: '   ', visibility: 'private' }), { kind: 'error', status: 400 });
});

test('projectOptions: groups from sharing.groups, only-me on an older instance, create unless denied', () => {
  const yes = { canSave: true, canEdit: true };
  config = null;
  assert.deepEqual(writer.projectOptions(), { canCreate: true, groups: [], ...yes });
  config = { can: { 'project.create': false } };
  assert.deepEqual(writer.projectOptions(), { canCreate: false, groups: [], ...yes });
  config = { can: { 'project.create': true }, sharing: { groups: ['design', ' ', 'design', 7, 'brand '] } };
  assert.deepEqual(writer.projectOptions(), { canCreate: true, groups: ['design', 'brand'], ...yes });
  assert.deepEqual(teamProjectOptions({ sharing: { groups: 'design' } }), { canCreate: true, groups: [], ...yes });
});

test('projectOptions: a viewer who may not save sessions is told so', () => {
  assert.deepEqual(teamProjectOptions({ can: { 'session.create': false } }), { canCreate: true, groups: [], canSave: false, canEdit: true });
  assert.deepEqual(teamProjectOptions({ can: { 'session.edit': false } }), { canCreate: true, groups: [], canSave: true, canEdit: false });
});

test('a session read carries the caller\'s project role when the instance sends one (plan 75 J5)', async () => {
  const { sessionDataFromBody } = await import('./session-source.ts');
  assert.equal(sessionDataFromBody({ toolId: 'poster', inputs: {}, myRole: 'viewer' })?.myRole, 'viewer');
  assert.equal(sessionDataFromBody({ toolId: 'poster', inputs: {}, myRole: 'owner' })?.myRole, 'owner');
  assert.equal(sessionDataFromBody({ toolId: 'poster', inputs: {}, myRole: 'commenter' })?.myRole, 'commenter');
  // A role this shell does not know (one added after it was built) fails closed: read as
  // a viewer's, so the document opens view-only. Only an absent role is unknown.
  assert.equal(sessionDataFromBody({ toolId: 'poster', inputs: {}, myRole: 'superuser' })?.myRole, 'viewer', 'a role this shell does not know fails closed');
  assert.equal('myRole' in (sessionDataFromBody({ toolId: 'poster', inputs: {}, myRole: '  ' }) ?? {}), false, 'a blank role is no role');
  assert.equal('myRole' in (sessionDataFromBody({ toolId: 'poster', inputs: {} }) ?? {}), false, 'absent stays absent, never an undefined key');
});
