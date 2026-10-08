// SPDX-License-Identifier: MPL-2.0
/**
 * The asset picker's Projects tab (lolly plan 299 X8): local folders, shortcuts and
 * shared projects. The pure half pins which shared items one level holds and what a
 * shortcut stands for. The live half drives the real tab in jsdom against a session
 * source with a files half: what the top level lists, that search reaches projects
 * outside the person's list, and that a pick copies before it places.
 *
 * Run directly:  node --test shells/web/src/views/picker-projects.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://instance.test/' });
for (const k of ['window', 'document', 'location', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as unknown as typeof requestAnimationFrame;

const { createProjectsTab, sharedLevel, shortcutTarget } = await import('./picker-projects.ts');
const { registerSessionSource } = await import('../lib/session-source.ts');
type Deps = Parameters<typeof createProjectsTab>[0];

const folder = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, parentId: null, items: [], createdAt: '', updatedAt: '', ...extra }) as never;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('one level of a shared project: a folder lists its own items, the top lists the unfiled', () => {
  const folders = [{ id: 'f1', name: 'Logos', parentId: null, items: [{ kind: 'file' as const, ref: 'a' }, { kind: 'session' as const, ref: 's1' }] }];
  const files = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(sharedLevel(files, 'file', folders, 'f1').map(f => f.id), ['a']);
  assert.deepEqual(sharedLevel(files, 'file', folders, null).map(f => f.id), ['b']);
  // A session filed under the same ref does not hide a file with that id.
  assert.deepEqual(sharedLevel([{ id: 's1' }], 'file', folders, null).map(f => f.id), ['s1']);
});

test('a shortcut opens its project only on the workspace it came from', () => {
  const link = folder('l', 'Brand', { link: { instance: 'https://instance.test', projectId: 'prj_1', folderId: 'f1' } });
  assert.deepEqual(shortcutTarget(link, 'https://instance.test'), { projectId: 'prj_1', folderId: 'f1' });
  assert.equal(shortcutTarget(link, 'https://other.test'), null);
  assert.equal(shortcutTarget(folder('x', 'Plain'), 'https://instance.test'), null);
});

test('the tab lists own folders and own shared projects, search reaches the rest, and a file is copied before it is placed', async () => {
  const copied: string[] = [];
  const placed: string[] = [];
  const sessionsPlaced: string[] = [];
  registerSessionSource({
    label: 'Acme',
    async listProjects() { return []; },
    async listSessions() { return []; },
    async readProjects() {
      return { ok: true as const, items: [
        { id: 'prj_mine', name: 'Launch kit', via: 'member' as const, sessionCount: 2 },
        { id: 'prj_all', name: 'Company handbook', via: 'everyone' as const },
      ] };
    },
    async readSessions(projectId: string) {
      return { ok: true as const, items: projectId === 'prj_mine' ? [
        { id: 'ses_1', toolId: 'poster', label: 'Hero poster', updatedAt: new Date().toISOString() },
        { id: 'ses_2', toolId: 'audio-only', label: 'Jingle' },
      ] : [] };
    },
    async fetchSession() { return null; },
    files: {
      async listFolders() { return []; },
      async listFiles() {
        return [{ id: 'fil_img', name: 'logo.svg', type: 'svg', size: 2048 }, { id: 'fil_doc', name: 'notes.pdf', type: 'pdf', size: 9000 }];
      },
      async copyFile(projectId: string, fileId: string) { copied.push(`${projectId}/${fileId}`); return 'user/upload/copy-1'; },
      async localSession(sessionId: string) { return { __toolId: 'poster', sessionId }; },
    },
  });
  const pane = document.createElement('section');
  document.body.append(pane);
  let query = '';
  const deps: Deps = {
    pane, initialFolder: null,
    folders: () => [folder('loc', 'My drafts'), folder('lnk', 'Launch kit', { link: { instance: 'https://instance.test', projectId: 'prj_mine' } })],
    sessions: () => [], userAssets: () => [], imageCard: () => '',
    matches: (q, ...fields) => !q || fields.some(f => (f ?? '').toLowerCase().includes(q)),
    tool: id => (id === 'poster' ? { name: 'Poster', icon: null } : null),
    accepts: type => type === 'svg' || type === 'raster',
    async placeSession(load, toolId, name) { const data = await load(); sessionsPlaced.push(`${toolId}:${name}:${String(data?.sessionId)}`); },
    async placeFile(assetId) { placed.push(assetId); },
    query: () => query, visible: () => true, painted() {}, navigated() {}, log() {},
  };
  const tab = createProjectsTab(deps);
  tab.render('');
  await flush();
  const names = () => [...pane.querySelectorAll('.asset-picker-name')].map(n => n.textContent);
  // The shortcut stands for prj_mine at the top, so the shared section does not repeat
  // it; the project shared with everyone stays out until someone searches.
  assert.deepEqual(names(), ['My drafts', 'Launch kit']);
  assert.ok(pane.querySelector('[data-shared-open="prj_mine"]'), 'the shortcut opens the shared project');
  query = 'handbook';
  tab.render(query);
  assert.deepEqual(names(), ['Company handbook']);
  assert.equal(tab.count('handbook'), 1);

  query = '';
  tab.render(query);
  assert.equal(tab.handle(pane.querySelector<HTMLElement>('[data-shared-open="prj_mine"]')!), true);
  await flush();
  // Only what this slot can take: the audio-only session and the PDF are left out.
  assert.deepEqual(names(), ['Hero poster', 'logo.svg']);
  assert.match(pane.querySelector('.asset-picker-crumbs')!.textContent!, /Projects.*Launch kit/s);

  assert.equal(tab.handle(pane.querySelector<HTMLElement>('[data-shared-file="fil_img"]')!), true);
  await flush();
  assert.deepEqual(copied, ['prj_mine/fil_img']);
  assert.deepEqual(placed, ['user/upload/copy-1']);

  assert.equal(tab.handle(pane.querySelector<HTMLElement>('[data-shared-session="ses_1"]')!), true);
  await flush();
  assert.deepEqual(sessionsPlaced, ['poster:Hero poster:ses_1']);

  // The Projects crumb returns to the person's own folders.
  assert.equal(tab.handle(pane.querySelector<HTMLElement>('[data-folder-open=""]')!), true);
  assert.deepEqual(names(), ['My drafts', 'Launch kit']);
  tab.destroy();
});
