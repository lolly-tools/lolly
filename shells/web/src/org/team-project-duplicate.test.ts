// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateProjectItem } from './team-project-duplicate.ts';
import type { SessionSourceWriter, TeamSessionWrite } from '../lib/session-source.ts';

const saved: TeamSessionWrite[] = [];
const writer: SessionSourceWriter = {
  projectOptions: () => ({ canCreate: true, canSave: true, canEdit: true, groups: [] }),
  createProject: async () => ({ kind: 'error', status: 403 }),
  createSession: async (_project, input) => { saved.push(input); return { kind: 'saved', id: 'copy-id', rev: 1 }; },
  updateSession: async () => ({ kind: 'error', status: 403 }),
};
const opts = { projectId: 'project', id: 'original', kind: 'team-session', folderId: 'folder', folders: [], writer, name: 'First Day', current: () => true };

test('duplicate creates a distinct session in the same shared folder and preserves original inputs', async () => {
  const originalFetch = globalThis.fetch, requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const inputs = { boxes: [{ id: 'board', kind: 'frame', x: 10, y: 20 }] };
  saved.length = 0;
  globalThis.fetch = async (url, init) => {
    requests.push({ method: init?.method || 'GET', url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify({ projectId: 'project', toolId: 'design', toolVersion: '1', inputs, meta: { label: 'First Day', note: 'Preserve' } }), { status: 200 });
  };
  try {
    await duplicateProjectItem(opts);
    assert.deepEqual(saved[0]?.inputs, inputs);
    assert.deepEqual(saved[0]?.meta, { label: 'First Day copy', note: 'Preserve' });
    assert.deepEqual(requests.at(-1)?.body, { folderId: 'folder' });
    assert.match(requests.at(-1)!.url, /items\/session\/copy-id$/);
    assert.equal(requests.filter(r => r.method !== 'GET').length, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('no writes occur when access changes, creation is forbidden or folder references cycle', async () => {
  saved.length = 0;
  await assert.rejects(duplicateProjectItem({ ...opts, current: () => false }), /access changed/);
  await assert.rejects(duplicateProjectItem({ ...opts, writer: undefined }), /cannot duplicate/);
  await assert.rejects(duplicateProjectItem({ ...opts, id: 'cycle', kind: 'team-folder', folders: [{ id: 'cycle', parentId: 'cycle', projectId: 'project', name: 'Cycle', createdAt: '', items: [] }] }), /invalid references/);
  assert.equal(saved.length, 0);
});


test('a folder copy recreates its nested folder and session under new parents', async () => {
  const originalFetch = globalThis.fetch;
  const folders = [
    { id: 'folder', parentId: null, projectId: 'project', name: 'First Day', createdAt: '', items: [] },
    { id: 'child', parentId: 'folder', projectId: 'project', name: 'Drafts', createdAt: '', items: [{ kind: 'session' as const, ref: 'original' }] },
  ];
  const requests: Array<{ method: string; body: unknown }> = [];
  let created = 0;
  saved.length = 0;
  globalThis.fetch = async (url, init) => {
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, body });
    const data = method === 'POST' ? { folder: { ...body, id: `folder-copy-${++created}` } }
      : String(url).includes('/files') ? { files: [] }
      : { projectId: 'project', toolId: 'design', toolVersion: '1', inputs: { boxes: [] }, meta: { label: 'Draft' } };
    return new Response(JSON.stringify(data), { status: 200 });
  };
  try {
    await duplicateProjectItem({ ...opts, id: 'folder', kind: 'team-folder', folders, folderId: null });
    assert.deepEqual(requests.filter(r => r.method === 'POST').map(r => r.body), [
      { name: 'First Day copy', parentId: null }, { name: 'Drafts', parentId: 'folder-copy-1' },
    ]);
    assert.deepEqual(requests.find(r => r.method === 'PUT')?.body, { folderId: 'folder-copy-2' });
    assert.equal(saved[0]?.meta?.label, 'Draft');
    assert.equal(folders[1]?.parentId, 'folder');
  } finally { globalThis.fetch = originalFetch; }
});
