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

let router: (url: string) => Response = () => new Response('', { status: 404 });
globalThis.fetch = (async (input: RequestInfo | URL) => router(String(input))) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { createInstanceSessionSource } = await import('./session-source.ts');
const src = createInstanceSessionSource('Acme');

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

test('fetchSession returns full state, or null when incomplete/gone', async () => {
  router = (url) => url.includes('/api/v1/sessions/s1')
    ? json({ id: 's1', toolId: 'event-badge', toolVersion: '1.0.0', inputs: { title: 'Hi' }, meta: { label: 'Cover' } })
    : new Response('', { status: 410 });
  assert.deepEqual(await src.fetchSession('s1'), {
    toolId: 'event-badge', toolVersion: '1.0.0', inputs: { title: 'Hi' }, meta: { label: 'Cover' },
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
