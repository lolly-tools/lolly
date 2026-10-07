// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { __resetJobsForTest, jobsSnapshot } from '../lib/jobs.ts';
import { createFolderStore } from '../folders.ts';
import { registerSessionSource, type SessionSource } from '../lib/session-source.ts';
import { moveLocalItemsToTeam } from './local-team-transfer.ts';

async function fixture(failSecond: boolean) {
  const dom = new JSDOM('<body></body>', { url: 'https://instance.test/#/p', pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, location: w.location, Element: w.Element, HTMLElement: w.HTMLElement, HTMLDialogElement: w.HTMLDialogElement, Node: w.Node, localStorage: w.localStorage, AbortController: w.AbortController, requestAnimationFrame: w.requestAnimationFrame.bind(w) });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  let profile: Record<string, unknown> = {};
  const records = new Map<string, Record<string, unknown>>([['s1', { title: 'Poster', __toolId: 'design' }], ['s2', { title: 'Flyer', __toolId: 'design' }]]);
  const deleted: string[] = [], writes: Array<{ project: string; title: unknown; meta?: Record<string, unknown> }> = [], memberships: Array<{ ref: string; folderId: string }> = [];
  const host = {
    profile: { get: async () => profile, set: async (value: Record<string, unknown>) => { profile = value; } },
    state: { emojiStamp: async () => ({ emoji: 'twemoji', emojifx: 'brand' }), list: async () => [...records].map(([slot]) => ({ slot, toolId: 'design', label: slot, updatedAt: '2026-10-01', thumb: '' })), load: async (slot: string) => records.get(slot),
      save: async (slot: string, data: Record<string, unknown>) => { records.set(slot, data); }, delete: async (slot: string) => { deleted.push(slot); records.delete(slot); } },
    assets: { get: async () => null, _getBlob: async () => null, _deleteUserAsset: async () => {}, _listUserAssets: async () => [] },
  };
  const store = createFolderStore(host);
  const root = await store.create('Campaign'), child = await store.create('Drafts', root.id);
  await store.moveItem('s1', root.id, 'session'); await store.moveItem('s2', child.id, 'session');
  const source: SessionSource = { label: 'Workspace', listProjects: async () => [{ id: 'p', name: 'Team', myRole: 'editor' }], listSessions: async () => [], fetchSession: async () => null,
    write: { projectOptions: () => ({ canCreate: true, canShareFiles: true, groups: [] }), createProject: async () => ({ kind: 'error', status: 500 }), updateSession: async () => ({ kind: 'error', status: 500 }),
      createSession: async (project, data) => { writes.push({ project, title: data.inputs.title, meta: data.meta }); return failSecond && writes.length === 2 ? { kind: 'error', status: 503 } : { kind: 'saved', id: `shared-${writes.length}`, rev: 1 }; } },
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
  const move = moveLocalItemsToTeam(host as unknown as HostV1, [{ kind: 'folder', ref: root.id }], 'p', null, () => true);
  for (let n = 0; n < 20 && !document.querySelector('[data-act="ok"]'); n++) await new Promise(resolve => setTimeout(resolve, 0));
  document.querySelector<HTMLButtonElement>('[data-act="ok"]')!.click();
  const success = await move;
  return { records, deleted, writes, memberships, before, after: JSON.stringify(await store.list()), profile, success, jobs: jobsSnapshot(), close: () => { __resetJobsForTest(); unregister(); globalThis.fetch = originalFetch; w.close(); } };
}
test('a partial shared write preserves the complete local tree and its saved sessions', async () => {
  const f = await fixture(true);
  try { assert.equal(f.success, false); assert.equal(f.writes.length, 2); assert.deepEqual(f.deleted, []); assert.equal(f.after, f.before); assert.equal(f.records.size, 2); assert.equal(f.jobs[0]!.status, 'failed'); assert.match(f.jobs[0]!.error!, /originals are kept or recoverable/); }
  finally { f.close(); }
});
test('a completed transfer preserves nesting and archives local sessions for recovery only after saving all items', async () => {
  const f = await fixture(false);
  try {
    assert.equal(f.success, true); assert.equal(f.writes.length, 2);
    assert.deepEqual(f.writes.map(write => write.meta?.emoji), [{ emoji: 'twemoji', emojifx: 'brand' }, { emoji: 'twemoji', emojifx: 'brand' }]);
    assert.deepEqual(f.memberships, [{ ref: 'shared-1', folderId: 'f2' }, { ref: 'shared-2', folderId: 'f1' }]);
    assert.deepEqual(new Set(f.deleted), new Set(['s1', 's2']));
    assert.ok([...f.records.keys()].every(slot => slot.startsWith('__trash__:')));
    assert.equal(f.after, '[]'); assert.equal((f.profile.trash as unknown[]).length, 1);
  } finally { f.close(); }
});
