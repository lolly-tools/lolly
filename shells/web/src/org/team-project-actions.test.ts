// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountTeamProjectActions } from './team-project-actions.ts';
import { clearTeamClipboard, teamClipboard, TEAM_ITEMS_MIME } from './team-project-moves.ts';
import { renameTeamFile, resetTeamFileRenameForTest, type TeamFolder } from './team-folders.ts';
import { TeamFileError } from './team-files.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'CustomEvent', 'getComputedStyle', 'AbortController']) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

test('shared item menu shows three dots and provides permitted duplicate and delete actions', async () => {
  document.body.innerHTML = '<section><div id="grid"><article class="folder-tile" data-ref="session" data-kind="team-session"><span class="tile-title">First Day</span></article></div></section>';
  const grid = document.getElementById('grid')!, calls: string[] = [];
  const cleanup = mountTeamProjectActions({ grid, content: grid.parentElement!, projectId: 'project', projectName: 'Project', folderId: 'folder', folders: [], files: [],
    canWrite: true, canManage: true, canDeleteSession: true, current: () => true, reload() {}, notice() {},
    duplicate: async id => { calls.push(id); }, sessionAction: async () => undefined });
  try {
    const trigger = grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!;
    assert.equal(trigger.textContent, ''); assert.equal(trigger.querySelectorAll('circle').length, 3);
    assert.equal(trigger.getAttribute('aria-label'), 'Item actions for First Day');
    const select = grid.querySelector<HTMLButtonElement>('.tile-check')!;
    assert.equal(select.textContent, ''); assert.ok(select.querySelector('svg'));
    assert.equal(select.title, 'Select First Day');
    trigger.click();
    assert.ok(document.querySelector('[data-act="delete"]'));
    document.querySelector<HTMLButtonElement>('[data-act="duplicate"]')!.click();
    await settle(); assert.deepEqual(calls, ['session']);
  } finally { cleanup(); }
});

test('viewers have no duplicate or delete menu actions', () => {
  document.body.innerHTML = '<section><div id="grid"><article class="folder-tile" data-ref="session" data-kind="team-session"><span class="tile-title">First Day</span></article></div></section>';
  const grid = document.getElementById('grid')!;
  const cleanup = mountTeamProjectActions({ grid, content: grid.parentElement!, projectId: 'project', projectName: 'Project', folderId: 'folder', folders: [], files: [],
    canWrite: false, canManage: false, canDeleteSession: false, current: () => true, reload() {}, notice() {},
    duplicate: async () => { throw new Error('viewer cannot duplicate'); }, sessionAction: async () => undefined });
  try {
    grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click();
    assert.equal(document.querySelector('[data-act="duplicate"]'), null);
    assert.equal(document.querySelector('[data-act="delete"]'), null);
  } finally { cleanup(); }
});

// Moves, the shared clipboard and file rename (plan 296).

const drafts: TeamFolder = { id: 'drafts', name: 'Drafts', projectId: 'p', parentId: null, createdAt: '', items: [] };
function sharedGrid(o: { folderId?: string | null; canWrite?: boolean; canDownload?: boolean; folders?: TeamFolder[]; tiles?: string; duplicate?: (id: string, kind: string, place?: { name?: string; folderId?: string | null }) => Promise<void>; sessionAction?: (action: string, id: string, tile: HTMLElement | null) => Promise<boolean | undefined> } = {}) {
  document.body.innerHTML = `<nav id="crumbs"><a href="#/p?team=p" data-team-folder="">Team</a></nav><section><div id="grid">${o.tiles ?? '<article class="folder-tile" data-ref="s1" data-kind="team-session"><span class="tile-title">Poster</span></article><article class="folder-tile" data-ref="s2" data-kind="team-session"><span class="tile-title">Flyer</span></article>'}</div></section>`;
  const grid = document.getElementById('grid')!, reloads: Array<string | undefined> = [], notices: string[] = [];
  const cleanup = mountTeamProjectActions({ grid, content: grid.parentElement!, crumbs: document.getElementById('crumbs')!, projectId: 'p', projectName: 'Team', folderId: o.folderId ?? null,
    folders: o.folders ?? [drafts], files: [], canWrite: o.canWrite ?? true, canManage: true, canDeleteSession: true, canDownload: o.canDownload,
    current: () => grid.isConnected, reload: message => { reloads.push(message); }, notice: message => { notices.push(message); },
    duplicate: o.duplicate ?? (async () => {}), sessionAction: o.sessionAction ?? (async () => undefined) });
  const act = (act: string) => document.querySelector<HTMLButtonElement>(`[data-act="${act}"]`);
  const bulk = (id: string) => { for (const dot of grid.querySelectorAll<HTMLButtonElement>('.tile-check')) if (dot.dataset.select === id) dot.click(); };
  return { grid, reloads, notices, cleanup, act, bulk };
}
async function withFetch(fake: typeof fetch, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch; globalThis.fetch = fake;
  try { await run(); } finally { globalThis.fetch = original; }
}
const keyV = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'v', metaKey: true, bubbles: true }));

test('Cut and Paste carry a selection to another folder through acknowledged moves', async () => {
  clearTeamClipboard();
  const calls: unknown[] = [];
  await withFetch(async (url, init) => { calls.push([String(url), JSON.parse(String(init?.body))]); return Response.json({}); }, async () => {
    const first = sharedGrid(); first.bulk('s1'); first.bulk('s2');
    first.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click(); first.act('cut')!.click();
    assert.deepEqual(first.notices, ['2 items cut']);
    assert.equal(first.grid.querySelectorAll('.is-cut').length, 2);
    first.cleanup();
    const next = sharedGrid({ folderId: 'drafts', tiles: '' }); keyV(); await settle(); await settle();
    assert.deepEqual(calls, ['s1', 's2'].map(ref => [`/api/v1/projects/p/folders/items/session/${ref}`, { folderId: 'drafts' }]));
    assert.deepEqual(next.reloads, ['2 items pasted']);
    assert.equal(teamClipboard('p'), null, 'a finished cut empties the clipboard');
    next.cleanup();
  });
});

test('a refused move is reported and keeps the cut for another try', async () => {
  clearTeamClipboard();
  const filed: TeamFolder[] = [{ ...drafts, items: [{ kind: 'session', ref: 's1' }] }];
  await withFetch(async () => new Response(null, { status: 403 }), async () => {
    const f = sharedGrid({ folderId: 'drafts', folders: filed });
    f.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click(); f.act('cut')!.click();
    f.cleanup();
    const back = sharedGrid({ folderId: null, folders: filed, tiles: '' }); keyV(); await settle(); await settle();
    assert.match(back.reloads[0] ?? '', /cannot change its folders/);
    assert.equal(teamClipboard('p')?.mode, 'cut');
    back.cleanup();
  });
  clearTeamClipboard();
});

test('a copy pastes as duplicates in the open folder, under the copied names', async () => {
  clearTeamClipboard();
  const copies: unknown[] = [];
  const f = sharedGrid({ duplicate: async (id, kind, place) => { copies.push([id, kind, place]); } });
  f.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click(); f.act('copy-item')!.click();
  f.cleanup();
  const next = sharedGrid({ folderId: 'drafts', tiles: '', duplicate: async (id, kind, place) => { copies.push([id, kind, place]); } });
  keyV(); await settle(); await settle();
  assert.deepEqual(copies, [['s1', 'team-session', { name: 'Poster', folderId: 'drafts' }]]);
  assert.deepEqual(next.reloads, ['1 item pasted']);
  assert.equal(teamClipboard('p')?.mode, 'copy', 'a copy can be pasted again');
  next.cleanup(); clearTeamClipboard();
});

test('dropping shared tiles on a folder moves them; a desktop file drag is left to the file drop', async () => {
  const calls: unknown[] = [];
  await withFetch(async (url, init) => { calls.push([String(url), JSON.parse(String(init?.body))]); return Response.json({}); }, async () => {
    const f = sharedGrid({ tiles: '<article class="folder-tile" data-ref="drafts" data-kind="team-folder"><span class="tile-title">Drafts</span></article><article class="folder-tile" data-ref="s1" data-kind="team-session"><span class="tile-title">Poster</span></article>' });
    const folder = f.grid.querySelector<HTMLElement>('[data-ref="drafts"]')!;
    assert.equal(f.grid.querySelector<HTMLElement>('[data-ref="s1"]')!.draggable, true);
    const drop = (data: Record<string, string>) => {
      const event = new window.Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { types: Object.keys(data), getData: (type: string) => data[type] ?? '' } });
      folder.dispatchEvent(event); return event.defaultPrevented;
    };
    assert.equal(drop({ Files: '' }), false);
    assert.equal(drop({ [TEAM_ITEMS_MIME]: JSON.stringify({ instance: '', project: 'p', items: [{ kind: 'session', ref: 's1' }] }) }), true);
    await settle(); await settle();
    assert.deepEqual(calls, [['/api/v1/projects/p/folders/items/session/s1', { folderId: 'drafts' }]]);
    assert.deepEqual(f.reloads, ['Moved']);
    f.cleanup();
  });
});

test('viewers keep selection without drag, clipboard or move actions', () => {
  const f = sharedGrid({ canWrite: false });
  try {
    assert.equal(f.grid.querySelector('[draggable="true"]'), null);
    f.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click();
    for (const act of ['cut', 'copy-item', 'move', 'duplicate', 'rename']) assert.equal(f.act(act), null, act);
    f.bulk('s1'); assert.equal(f.grid.querySelectorAll('.is-selected').length, 1);
  } finally { f.cleanup(); }
});

test('sessions offer Download as .lolly file beside Copy to my projects when the view can save one', () => {
  const f = sharedGrid({ canDownload: true });
  try {
    f.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click();
    const rows = [...document.querySelectorAll<HTMLElement>('[data-act]')].map(row => row.dataset.act);
    assert.equal(rows.indexOf('download-lolly'), rows.indexOf('copy-local') + 1);
    assert.equal(f.act('download-lolly')!.textContent, 'Download as .lolly file');
  } finally { f.cleanup(); }
  const g = sharedGrid({ canDownload: false });
  try { g.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click(); assert.equal(g.act('download-lolly'), null); }
  finally { g.cleanup(); }
});

test('a refused .lolly download reads as a download, not as a delete', async () => {
  const f = sharedGrid({ canDownload: true, sessionAction: async action => { if (action === 'download-lolly') throw new TeamFileError(403); return undefined; } });
  try {
    f.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click(); f.act('download-lolly')!.click();
    await settle(); await settle();
    assert.deepEqual(f.notices, ['You do not have access to the files in this project.']);
  } finally { f.cleanup(); }
});

test('shared file Rename is offered disabled, with the reason, on an instance without the route', async () => {
  resetTeamFileRenameForTest();
  const tiles = '<article class="folder-tile" data-ref="f1" data-kind="team-file"><span class="tile-title">logo.png</span></article>';
  const ready = sharedGrid({ tiles });
  try { ready.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click(); assert.equal(ready.act('rename')!.getAttribute('aria-disabled'), null); }
  finally { ready.cleanup(); }
  await withFetch(async () => Response.json({ error: { code: 'NOT_FOUND', message: 'no route for PATCH /api/v1/projects/p/files/f1' } }, { status: 404 }), async () => { await renameTeamFile('p', 'f1', 'x'); });
  const old = sharedGrid({ tiles });
  try {
    old.grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click();
    assert.equal(old.act('rename')!.getAttribute('aria-disabled'), 'true');
    assert.match(old.act('rename')!.textContent ?? '', /cannot rename shared files yet/);
  } finally { old.cleanup(); resetTeamFileRenameForTest(); }
});
