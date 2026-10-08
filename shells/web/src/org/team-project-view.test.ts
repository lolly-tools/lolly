// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-project-view.ts (plan 296): a search in a shared project reaches the open
 * folder's whole subtree and says where each result from another folder lives, and the
 * breadcrumbs carry the folder each one opens, so shared items can be dropped on them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/#/p?team=p', pretendToBeVisual: true });
for (const key of ['window', 'document', 'location', 'HTMLElement', 'HTMLAnchorElement', 'Element', 'Node', 'MutationObserver', 'CustomEvent', 'getComputedStyle', 'AbortController', 'localStorage']) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}
Reflect.set(globalThis, 'requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
Reflect.set(globalThis, 'ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Reflect.set(globalThis, 'IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });

const { registerSessionSource } = await import('../lib/session-source.ts');
const { mountTeamProjectView } = await import('./team-project-view.ts');

const folders = [
  { id: 'a', name: 'Campaign', projectId: 'p', parentId: null, createdAt: '', items: [{ kind: 'session', ref: 's2' }] },
  { id: 'b', name: 'Drafts', projectId: 'p', parentId: 'a', createdAt: '', items: [{ kind: 'session', ref: 's3' }] },
];
const unregister = registerSessionSource({
  label: 'Workspace', fetchSession: async () => null,
  listProjects: async () => [{ id: 'p', name: 'Team', myRole: 'editor' }],
  listSessions: async () => [{ id: 's1', toolId: 'design', label: 'Poster' }, { id: 's2', toolId: 'design', label: 'Poster draft' }, { id: 's3', toolId: 'design', label: 'Poster final' }],
});
globalThis.fetch = (async (url: RequestInfo | URL) => String(url).endsWith('/folders') ? Response.json({ folders }) : new Response('', { status: 404 })) as typeof fetch;
test.after(() => { unregister(); dom.window.close(); });

async function mount(opts: { query?: string; folderId?: string }) {
  const container = document.createElement('div'); document.body.replaceChildren(container);
  const stop = mountTeamProjectView(container, { host: {} as HostV1, projectId: 'p', create: false, tab: 'sessions', toolName: id => id,
    beforeNavigate() {}, isMounted: () => container.isConnected, ...opts });
  for (let i = 0; i < 200 && !container.querySelector('.folder-grid, .team-project-empty'); i++) await new Promise(resolve => setTimeout(resolve, 5));
  const tiles = [...container.querySelectorAll<HTMLElement>('.folder-tile[data-ref]')].map(tile => [tile.dataset.ref, tile.querySelector('.tile-sub')?.textContent?.trim() ?? '']);
  const crumbs = [...container.querySelectorAll<HTMLAnchorElement>('.projects-crumbs a')].map(a => [a.textContent, a.dataset.teamFolder ?? null]);
  stop(); return { tiles: Object.fromEntries(tiles), crumbs };
}

test('without a search the open folder shows only its own contents', async () => {
  const top = await mount({});
  assert.deepEqual(Object.keys(top.tiles).sort(), ['a', 's1']);
});

test('a search at the top reaches every folder and says where each result lives', async () => {
  const got = await mount({ query: 'poster' });
  assert.deepEqual(Object.keys(got.tiles).sort(), ['s1', 's2', 's3']);
  assert.doesNotMatch(got.tiles.s1!, /In /);
  assert.match(got.tiles.s2!, /In Campaign$/);
  assert.match(got.tiles.s3!, /In Campaign \/ Drafts$/);
});

test('a search inside a folder stays in its subtree, and the crumbs carry their folders', async () => {
  const got = await mount({ query: 'poster', folderId: 'a' });
  assert.deepEqual(Object.keys(got.tiles).sort(), ['s2', 's3']);
  assert.doesNotMatch(got.tiles.s2!, /In /);
  assert.match(got.tiles.s3!, /In Campaign \/ Drafts$/);
  assert.deepEqual(got.crumbs, [['Projects', null], ['Team', '']]);
});
