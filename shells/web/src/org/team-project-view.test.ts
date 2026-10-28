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
for (const key of ['window', 'document', 'location', 'HTMLElement', 'HTMLAnchorElement', 'HTMLDialogElement', 'Element', 'Node', 'MutationObserver', 'CustomEvent', 'getComputedStyle', 'AbortController', 'localStorage']) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}
Reflect.set(globalThis, 'requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
Reflect.set(globalThis, 'ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Reflect.set(globalThis, 'IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });

dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new dom.window.Event('close')); };

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

test('shared text-file creation retries placement without creating another document', async () => {
  const creates: import('../lib/session-source.ts').TeamSessionWrite[] = [], moves: string[] = [];
  const remove = registerSessionSource({ label: 'Workspace', fetchSession: async () => null,
    listProjects: async () => [{ id: 'p', name: 'Team', myRole: 'editor' }], listSessions: async () => [],
    write: { projectOptions: () => ({ canCreate: true, groups: [] }), createProject: async () => ({ kind: 'error', status: 403 }),
      createSession: async (_project, input) => { creates.push(input); return { kind: 'saved', id: 'new-text', rev: 1 }; },
      updateSession: async () => ({ kind: 'error', status: 403 }) },
  });
  let refused = true;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/folders')) return Response.json({ folders });
    if (init?.method === 'PUT') { moves.push(String(url)); return new Response('', { status: refused ? 503 : 204 }); }
    return new Response('', { status: 404 });
  };
  const container = document.createElement('div'); document.body.replaceChildren(container);
  const stop = mountTeamProjectView(container, { host: {} as HostV1, projectId: 'p', create: false, tab: 'sessions', folderId: 'a', toolName: id => id,
    beforeNavigate() {}, isMounted: () => container.isConnected });
  try {
    for (let i = 0; i < 200 && !container.querySelector('.folder-grid, .team-project-empty'); i++) await new Promise(resolve => setTimeout(resolve, 5));
    container.dispatchEvent(new dom.window.CustomEvent('lolly:team-file-create'));
    const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
    dialog.querySelector<HTMLInputElement>('[data-file-name]')!.value = 'Campaign.md';
    dialog.querySelector<HTMLSelectElement>('[data-file-type]')!.value = 'markdown';
    const submit = () => dialog.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    submit();
    for (let i = 0; i < 200 && !dialog.querySelector('[data-file-error]')!.textContent; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(creates.length, 1);
    assert.equal(creates[0]!.toolId, 'write');
    assert.equal(creates[0]!.inputs.language, 'markdown');
    assert.equal(creates[0]!.meta!.label, 'Campaign.md');
    refused = false; submit();
    for (let i = 0; i < 200 && dialog.isConnected; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(creates.length, 1);
    assert.equal(moves.length, 2);
    assert.ok(moves.every(url => url.includes('new-text')));
  } finally { stop(); remove(); }
});

test('a shared project viewer has no New file action', async () => {
  const remove = registerSessionSource({ label: 'Workspace', fetchSession: async () => null,
    listProjects: async () => [{ id: 'p', name: 'Team', myRole: 'viewer' }], listSessions: async () => [] });
  globalThis.fetch = async () => Response.json({ folders });
  const container = document.createElement('div'); document.body.replaceChildren(container);
  const stop = mountTeamProjectView(container, { host: {} as HostV1, projectId: 'p', create: false, tab: 'sessions', toolName: id => id,
    beforeNavigate() {}, isMounted: () => container.isConnected });
  try {
    for (let i = 0; i < 200 && !container.querySelector('.folder-grid, .team-project-empty'); i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(![...container.querySelectorAll('button')].some(button => button.textContent === 'New file'));
    container.dispatchEvent(new dom.window.CustomEvent('lolly:team-file-create'));
    assert.equal(document.querySelector('dialog'), null);
  } finally { stop(); remove(); }
});
