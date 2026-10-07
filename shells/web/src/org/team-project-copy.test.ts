// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionSource, TeamSessionWrite } from '../lib/session-source.ts';
import { duplicateProjectItem } from './team-project-copy.ts';
import type { ProjectFolder } from './project-folders.ts';

function source() {
  const writes: TeamSessionWrite[] = [];
  const source: SessionSource = { label: 'Workspace', listProjects: async () => [], listSessions: async () => [],
    fetchSession: async id => ({ id, projectId: 'p', toolId: 'design', toolVersion: '2', rev: 9, inputs: { title: id }, meta: { label: id === 's1' ? 'Poster' : 'Flyer', emoji: { set: 'twemoji' } } }),
    write: { projectOptions: () => ({ canCreate: true, groups: [] }), createProject: async () => ({ kind: 'error', status: 500 }), updateSession: async () => ({ kind: 'error', status: 500 }),
      createSession: async (_, data) => { writes.push(structuredClone(data)); return { kind: 'saved', id: `copy-${writes.length}`, rev: 1 }; } },
  };
  return { source, writes };
}
test('a session duplicate retains tool version and metadata and gets a fresh identity', async () => {
  const f = source();
  assert.equal(await duplicateProjectItem(f.source, 'p', { kind: 'session', ref: 's1', name: 'Poster' }, [], [], () => true), 'copy-1');
  assert.deepEqual(f.writes, [{ toolId: 'design', toolVersion: '2', inputs: { title: 's1' }, meta: { label: 'Poster copy', emoji: { set: 'twemoji' } } }]);
});
test('folder duplication retains nesting and contained names without changing the original memberships', async () => {
  const f = source(), originalFetch = globalThis.fetch, requests: Array<{ path: string; body: unknown }> = [];
  const folders: ProjectFolder[] = [{ id: 'root', projectId: 'p', parentId: null, name: 'Campaign', items: [{ kind: 'session', ref: 's1' }] }, { id: 'child', projectId: 'p', parentId: 'root', name: 'Drafts', items: [{ kind: 'session', ref: 's2' }] }];
  const before = structuredClone(folders); let created = 0;
  globalThis.fetch = async (url, init) => { const body = JSON.parse(String(init?.body)); requests.push({ path: String(url), body }); return Response.json(init?.method === 'POST' ? { folder: { id: `f${++created}` } } : {}); };
  try {
    assert.equal(await duplicateProjectItem(f.source, 'p', { kind: 'folder', ref: 'root', name: 'Campaign' }, folders, [], () => true), 'f1');
    assert.deepEqual(folders, before);
    assert.deepEqual(requests.map(request => request.body), [{ name: 'Campaign copy', parentId: null }, { name: 'Drafts', parentId: 'f1' }, { folderId: 'f2' }, { folderId: 'f1' }]);
    assert.deepEqual(f.writes.map(write => write.meta?.label), ['Flyer', 'Poster']);
  } finally { globalThis.fetch = originalFetch; }
});
