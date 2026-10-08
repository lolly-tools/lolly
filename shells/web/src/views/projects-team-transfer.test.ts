// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { __resetJobsForTest, jobsSnapshot } from '../lib/jobs.ts';
import { createFolderStore } from '../folders.ts';
import { createTrash } from '../lib/trash.ts';
import { registerSessionSource, type SessionSource } from '../lib/session-source.ts';
import { isLocalItemsDrag, LOCAL_ITEMS_MIME, localDragItems, moveLocalItemsToTeam, wireLocalTeamDrops, type LocalProjectItem } from './projects-team-transfer.ts';
import { createSharedProjectsView, teamProjectTiles } from './projects-team.ts';
import type { Folder } from '../folders.ts';

interface Options {
  /** Refuse the nth session write. */
  failWrite?: number;
  /** Change this local session while the shared copies are being written. */
  editDuring?: string;
  /** Extra items to move besides the Campaign folder. */
  extra?: LocalProjectItem[];
  /** Make a new folder inside Campaign while the shared copies are being written. */
  folderDuring?: boolean;
  /** Mark Drafts as a folder already shared from this device. */
  sharedBefore?: boolean;
  /** The shared project list cannot be read. */
  projectsFail?: boolean;
}

async function fixture(o: Options = {}) {
  const dom = new JSDOM('<body></body>', { url: 'https://instance.test/#/p', pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, location: w.location, Element: w.Element, HTMLElement: w.HTMLElement, HTMLDialogElement: w.HTMLDialogElement, Node: w.Node, localStorage: w.localStorage, AbortController: w.AbortController, requestAnimationFrame: w.requestAnimationFrame.bind(w) });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  let profile: Record<string, unknown> = {};
  const records = new Map<string, Record<string, unknown>>([['s1', { title: 'Poster', __toolId: 'design' }], ['s2', { title: 'Flyer', __toolId: 'design' }], ['s3', { title: 'Loose', __toolId: 'design' }]]);
  const deleted: string[] = [], writes: Array<{ project: string; title: unknown; meta?: Record<string, unknown> }> = [], memberships: Array<{ ref: string; folderId: string }> = [];
  const host = {
    profile: { get: async () => profile, set: async (value: Record<string, unknown>) => { profile = value; } },
    state: { emojiStamp: async () => ({ emoji: 'twemoji', emojifx: 'brand' }), list: async () => [...records].map(([slot]) => ({ slot, toolId: 'design', label: slot, updatedAt: '2026-10-01', thumb: '' })), load: async (slot: string) => records.get(slot) ?? null,
      save: async (slot: string, data: Record<string, unknown>) => { records.set(slot, data); }, delete: async (slot: string) => { deleted.push(slot); records.delete(slot); } },
    assets: { get: async () => null, _getBlob: async () => null, _deleteUserAsset: async () => {}, _listUserAssets: async () => [] },
  };
  const store = createFolderStore(host), trash = createTrash(host);
  const root = await store.create('Campaign'), child = await store.create('Drafts', root.id);
  await store.moveItem('s1', root.id, 'session'); await store.moveItem('s2', child.id, 'session');
  if (o.sharedBefore) await store.setTeamCopy(child.id, { instance: 'https://instance.test', projectId: 'p', complete: true, copied: {} });
  const source: SessionSource = { label: 'Workspace', listSessions: async () => [], fetchSession: async () => null,
    listProjects: async () => { if (o.projectsFail) throw new Error('offline'); return [{ id: 'p', name: 'Team', myRole: 'editor' }]; },
    write: { projectOptions: () => ({ canCreate: true, canShareFiles: true, groups: [] }), createProject: async () => ({ kind: 'error', status: 500 }), updateSession: async () => ({ kind: 'error', status: 500 }),
      createSession: async (project, data) => {
        writes.push({ project, title: data.inputs.title, meta: data.meta });
        if (o.editDuring && writes.length === 1) records.set(o.editDuring, { ...records.get(o.editDuring), title: 'Edited meanwhile' });
        if (o.folderDuring && writes.length === 1) await store.create('Late', root.id);
        return o.failWrite === writes.length ? { kind: 'error', status: 503 } : { kind: 'saved', id: `shared-${writes.length}`, rev: 1 };
      } },
  };
  const unregister = registerSessionSource(source), originalFetch = globalThis.fetch;
  let folderNumber = 0;
  globalThis.fetch = async (url, init) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    if (init?.method === 'POST') return Response.json({ folder: { id: `f${++folderNumber}`, ...body } });
    if (init?.method === 'PUT') memberships.push({ ref: String(url).split('/').at(-1)!, folderId: body.folderId });
    return Response.json({});
  };
  const before = JSON.stringify(await store.list());
  const deps = { host: host as unknown as HostV1, store, trash, mounted: () => true };
  const move = moveLocalItemsToTeam(deps, [{ kind: 'folder', ref: root.id }, ...(o.extra ?? [])], 'p', null);
  for (let n = 0; n < 50 && !document.querySelector('[data-act="ok"]'); n++) await new Promise(resolve => setTimeout(resolve, 0));
  document.querySelector<HTMLButtonElement>('[data-act="ok"]')?.click();
  const success = await move;
  return { records, deleted, writes, memberships, before, after: JSON.stringify(await store.list()), profile, success, jobs: jobsSnapshot(), hash: w.location.hash,
    close: () => { __resetJobsForTest(); unregister(); globalThis.fetch = originalFetch; w.close(); } };
}

// First in the file: a11y.ts makes its live region on first use, in the document of
// the moment, so this test must announce before any other test does.
test('an unreadable shared project list stops the move before the question is asked', async () => {
  const f = await fixture({ projectsFail: true });
  try {
    assert.equal(f.success, false); assert.equal(f.writes.length, 0); assert.deepEqual(f.deleted, []); assert.equal(f.after, f.before);
    assert.equal(f.jobs.length, 0);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok([...document.querySelectorAll('[aria-live]')].some(region => region.textContent === 'Shared projects could not be loaded. Try again.'));
  } finally { f.close(); }
});

test('a refused shared write keeps the whole local tree and its saved sessions', async () => {
  const f = await fixture({ failWrite: 2 });
  try {
    assert.equal(f.success, false); assert.equal(f.writes.length, 2);
    assert.deepEqual(f.deleted, []); assert.equal(f.after, f.before); assert.equal(f.records.size, 3);
    assert.equal(f.jobs[0]!.status, 'failed');
    assert.match(f.jobs[0]!.error!, /1 item was saved to the shared project\. Your local items have not changed\./);
  } finally { f.close(); }
});

test('a finished move keeps the nesting and moves local sessions to Trash only after every item is saved', async () => {
  const f = await fixture();
  try {
    assert.equal(f.success, true); assert.equal(f.writes.length, 2);
    assert.deepEqual(f.writes.map(write => write.meta?.emoji), [{ emoji: 'twemoji', emojifx: 'brand' }, { emoji: 'twemoji', emojifx: 'brand' }]);
    // Drafts (f2) is made inside Campaign (f1); each session goes into its own folder.
    assert.deepEqual(f.memberships, [{ ref: 'shared-1', folderId: 'f2' }, { ref: 'shared-2', folderId: 'f1' }]);
    assert.deepEqual(new Set(f.deleted), new Set(['s1', 's2']));
    assert.ok([...f.records.keys()].filter(slot => slot !== 's3').every(slot => slot.startsWith('__trash__:')));
    assert.equal(f.after, '[]'); assert.equal((f.profile.trash as unknown[]).length, 1);
    assert.equal(f.hash, '#/p?team=p');
  } finally { f.close(); }
});

test('a session edited during the move keeps every local original, and the shared copies are reported', async () => {
  const f = await fixture({ editDuring: 's2' });
  try {
    assert.equal(f.success, false); assert.equal(f.writes.length, 2);
    assert.deepEqual(f.deleted, []); assert.equal(f.after, f.before);
    assert.match(f.jobs[0]!.error!, /changed during the move\. 2 items were saved to the shared project\. Your local items have not changed\./);
  } finally { f.close(); }
});

test('a folder made inside a moving folder during the move keeps every local original', async () => {
  const f = await fixture({ folderDuring: true });
  try {
    assert.equal(f.success, false); assert.equal(f.writes.length, 2); assert.deepEqual(f.deleted, []);
    const after = JSON.parse(f.after) as Array<{ name: string }>;
    assert.deepEqual(after.map(folder => folder.name).sort(), ['Campaign', 'Drafts', 'Late']);
    assert.equal(f.profile.trash, undefined, 'nothing went to Trash');
    assert.match(f.jobs[0]!.error!, /Local folders changed during the move\. 2 items were saved to the shared project\. Your local items have not changed\./);
  } finally { f.close(); }
});

test('a folder already shared from this device stops the move with its own reason', async () => {
  const f = await fixture({ sharedBefore: true });
  try {
    assert.equal(f.success, false); assert.equal(f.writes.length, 0); assert.deepEqual(f.deleted, []);
    assert.match(f.jobs[0]!.error!, /^A folder was already shared from this device, so it cannot move again\. Your local items have not changed\.$/);
  } finally { f.close(); }
});

test('a catalog picture stops the move before anything is written', async () => {
  const f = await fixture({ extra: [{ kind: 'image', ref: 'lolly/logo/primary' }] });
  try {
    assert.equal(f.success, false); assert.equal(f.writes.length, 0); assert.deepEqual(f.memberships, []);
    assert.deepEqual(f.deleted, []); assert.equal(f.after, f.before);
    assert.match(f.jobs[0]!.error!, /catalog image cannot move.*Your local items have not changed\./);
  } finally { f.close(); }
});

test('only a shared project or shortcut the person may write to takes a drop of local tiles', async () => {
  const dom = new JSDOM('<body></body>', { url: 'https://instance.test/#/p', pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, location: w.location, Element: w.Element, HTMLElement: w.HTMLElement, HTMLDialogElement: w.HTMLDialogElement, Node: w.Node, localStorage: w.localStorage, AbortController: w.AbortController, requestAnimationFrame: w.requestAnimationFrame.bind(w) });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const projects = [{ id: 'mine', name: 'Mine', myRole: 'editor' as const }, { id: 'look', name: 'Look only', myRole: 'viewer' as const }];
  let reads = 0;
  const unregister = registerSessionSource({ label: 'Workspace', listSessions: async () => [], fetchSession: async () => null,
    listProjects: async () => { reads++; return projects; },
    write: { projectOptions: () => ({ canCreate: true, canShareFiles: true, groups: [] }), createProject: async () => ({ kind: 'error', status: 500 }), updateSession: async () => ({ kind: 'error', status: 500 }), createSession: async () => ({ kind: 'error', status: 500 }) } });
  const shortcut = (id: string, projectId: string): Folder => ({ id, name: `Shortcut ${projectId}`, items: [], createdAt: '', updatedAt: '', link: { instance: 'https://instance.test', projectId } });
  const view = document.createElement('div');
  const shared = createSharedProjectsView({ host: {} as HostV1, toolName: id => id, beforeNavigate() {}, isMounted: () => true }, view, '', () => {});
  try {
    await shared.refresh();
    const folders = [shortcut('l1', 'mine'), shortcut('l2', 'look')];
    shared.folders(folders);
    const root = document.createElement('div');
    root.innerHTML = `<div id="own">${teamProjectTiles(projects)}</div><div id="links">${folders.map(folder => shared.folderTile(folder, {})).join('')}</div>`;
    document.body.append(root);
    const writable = (box: string) => [...root.querySelectorAll<HTMLElement>(`#${box} .folder-tile`)].map(tile => [tile.dataset.ref, tile.dataset.teamWritable]);
    assert.deepEqual(writable('own'), [['mine', 'true'], ['look', 'false']]);
    // A shortcut (lolly plan 299) is drawn as its project and carries the same answer.
    assert.deepEqual(writable('links'), [['mine', 'true'], ['look', 'false']]);
    wireLocalTeamDrops(root, { host: {} as HostV1, store: { list: async () => [], moveItem: async () => {} }, trash: { trashSessions: async () => {}, trashFolder: async () => {} }, mounted: () => true });
    const drag = (type: string, target: Element) => {
      const event = new w.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { types: [LOCAL_ITEMS_MIME], dropEffect: 'none', getData: (kind: string) => kind === LOCAL_ITEMS_MIME ? JSON.stringify([{ kind: 'session', ref: 's1' }]) : '' } });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    for (const box of ['own', 'links']) {
      const [mine, look] = root.querySelectorAll<HTMLElement>(`#${box} .folder-tile`);
      assert.equal(drag('dragover', mine!), true, `${box}: a writable tile takes the drag`);
      assert.equal(drag('dragover', look!), false, `${box}: a read-only tile does not`);
      const before = reads;
      assert.equal(drag('drop', look!), false); await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(reads, before, `${box}: a drop on a read-only tile starts no move`);
      assert.equal(document.querySelector('[data-act="ok"]'), null);
    }
    // A drop on a writable tile does start a move, which asks first.
    assert.equal(drag('drop', root.querySelector('#own .folder-tile')!), true);
    for (let n = 0; n < 50 && !document.querySelector('[data-act="cancel"]'); n++) await new Promise(resolve => setTimeout(resolve, 0));
    document.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.click();
  } finally { shared.dispose(); unregister(); __resetJobsForTest(); w.close(); }
});

test('a drag reads its own items, and a desktop file drag is not a local move', () => {
  const drag = (data: Record<string, string>) => ({ dataTransfer: { types: Object.keys(data), getData: (type: string) => data[type] ?? '' } }) as unknown as DragEvent;
  const items = [{ kind: 'session', ref: 's1' }, { kind: 'folder', ref: 'f1' }];
  assert.deepEqual(localDragItems(drag({ [LOCAL_ITEMS_MIME]: JSON.stringify(items), 'text/lolly-session': 's1' })), items);
  assert.deepEqual(localDragItems(drag({ 'text/lolly-session': 's9' })), [{ kind: 'session', ref: 's9' }]);
  assert.deepEqual(localDragItems(drag({ [LOCAL_ITEMS_MIME]: JSON.stringify([{ kind: 'team-project', ref: 'p' }]) })), []);
  assert.equal(isLocalItemsDrag(['Files']), false);
  assert.equal(isLocalItemsDrag(['Files', LOCAL_ITEMS_MIME]), true);
  assert.equal(isLocalItemsDrag(['application/x-lolly-team-items']), false);
});

test('a local upload already held by the project gets its own shared copy, and the teammate file stays where it is', async () => {
  const dom = new JSDOM('<body></body>', { url: 'https://instance.test/#/p', pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, location: w.location, Element: w.Element, HTMLElement: w.HTMLElement, HTMLDialogElement: w.HTMLDialogElement, Node: w.Node, localStorage: w.localStorage, AbortController: w.AbortController, requestAnimationFrame: w.requestAnimationFrame.bind(w) });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', png)), n => n.toString(16).padStart(2, '0')).join('');
  const file = (id: string, ready = true) => ({ id, projectId: 'p', name: 'logo.png', size: png.length, checksum: hash, contentType: 'image/png', ready, asset: {} });
  const teammate = `fil_${'t'.repeat(22)}`, fresh = `fil_${'f'.repeat(22)}`;
  let profile: Record<string, unknown> = {};
  const host = {
    profile: { get: async () => profile, set: async (value: Record<string, unknown>) => { profile = value; } },
    state: { list: async () => [], load: async () => null, save: async () => {}, delete: async () => {} },
    assets: { get: async () => ({ id: 'user/upload/logo', meta: { name: 'logo.png' } }), _getBlob: async () => new Blob([png], { type: 'image/png' }), _deleteUserAsset: async () => {}, _listUserAssets: async () => [] },
  };
  const store = createFolderStore(host), trash = createTrash(host);
  const logos = await store.create('Logos');
  await store.addItem(logos.id, { type: 'image', ref: 'user/upload/logo' });
  const unregister = registerSessionSource({ label: 'Workspace', listProjects: async () => [{ id: 'p', name: 'Team', myRole: 'editor' }], listSessions: async () => [], fetchSession: async () => null,
    write: { projectOptions: () => ({ canCreate: true, canShareFiles: true, groups: [] }), createProject: async () => ({ kind: 'error', status: 500 }), updateSession: async () => ({ kind: 'error', status: 500 }), createSession: async () => ({ kind: 'error', status: 500 }) } });
  const placed: Array<{ ref: string; folderId: string }> = [], originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const path = String(url), method = init?.method ?? 'GET';
    if (path.endsWith('/folders') && method === 'POST') return Response.json({ folder: { id: 'f1', ...JSON.parse(String(init?.body)) } });
    if (path.includes('/folders/items/') && method === 'PUT') { placed.push({ ref: path.split('/').at(-1)!, folderId: JSON.parse(String(init?.body)).folderId }); return Response.json({}); }
    if (path.endsWith('/files') && method === 'GET') return Response.json({ files: [file(teammate)] });
    if (path.endsWith(`/files/${teammate}`) && method === 'GET') return new Response(png, { headers: { 'content-length': String(png.length) } });
    if (path.endsWith('/files') && method === 'POST') return Response.json({ file: file(fresh, false) }, { status: 201 });
    if (path.includes('/parts/')) return new Response(null, { status: 204 });
    if (path.endsWith('/finalize')) return Response.json({ file: file(fresh) });
    return new Response('', { status: 404 });
  };
  try {
    const move = moveLocalItemsToTeam({ host: host as unknown as HostV1, store, trash, mounted: () => true }, [{ kind: 'folder', ref: logos.id }], 'p', null);
    for (let n = 0; n < 50 && !document.querySelector('[data-act="ok"]'); n++) await new Promise(resolve => setTimeout(resolve, 0));
    document.querySelector<HTMLButtonElement>('[data-act="ok"]')!.click();
    assert.equal(await move, true, jobsSnapshot()[0]?.error ?? 'the move failed');
    assert.deepEqual(placed, [{ ref: fresh, folderId: 'f1' }], 'only the new copy is filed; the teammate file is not moved');
    assert.equal(JSON.stringify(await store.list()), '[]', 'the local folder is in Trash');
    assert.equal((profile.trash as unknown[]).length, 1);
  } finally { __resetJobsForTest(); unregister(); globalThis.fetch = originalFetch; w.close(); }
});
