// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { canMoveProjectItem, listProjectFolders, moveProjectItem, projectFolderPath, projectItemFolder, type ProjectFolder } from './project-folders.ts';

const folders: ProjectFolder[] = [
  { id: 'a', name: 'Campaign', projectId: 'p', parentId: null, items: [{ kind: 'session', ref: 's' }] },
  { id: 'b', name: 'Drafts', projectId: 'p', parentId: 'a', items: [{ kind: 'file', ref: 'f' }] },
];
test('folder paths and moves preserve memberships and refuse cycles or foreign destinations', () => {
  assert.deepEqual(projectFolderPath(folders, 'b').map(folder => folder.name), ['Campaign', 'Drafts']);
  assert.equal(projectItemFolder(folders, 'file', 'f'), 'b');
  assert.equal(projectItemFolder(folders, 'session', 'loose'), null);
  assert.equal(canMoveProjectItem(folders, { kind: 'folder', ref: 'a' }, 'b'), false);
  assert.equal(canMoveProjectItem(folders, { kind: 'folder', ref: 'a' }, 'a'), false);
  assert.equal(canMoveProjectItem(folders, { kind: 'folder', ref: 'b' }, null), true);
  assert.equal(canMoveProjectItem(folders, { kind: 'session', ref: 's' }, 'other-project-folder'), false);
});
test('the folder adapter rejects broken trees and preserves failures rather than exposing an empty writable root', async () => {
  const original = globalThis.fetch;
  try {
    for (const value of [folders, [{ ...folders[0], parentId: 'a' }], [{ ...folders[0], projectId: 'foreign' }], [{ ...folders[0], parentId: 'gone' }]]) {
      globalThis.fetch = async () => Response.json({ folders: value });
      assert.equal((await listProjectFolders('p')).ok, value === folders);
    }
    globalThis.fetch = async () => new Response(null, { status: 403 });
    assert.deepEqual(await listProjectFolders('p'), { ok: false, status: 403 });
    globalThis.fetch = async () => { throw Error('offline'); };
    assert.deepEqual(await listProjectFolders('p'), { ok: false, status: 0 });
  } finally { globalThis.fetch = original; }
});
test('folder and item moves use distinct endpoints, encoded IDs and explicit null root destinations', async () => {
  const original = globalThis.fetch, calls: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return Response.json({}); };
  try {
    await moveProjectItem('p /', { kind: 'folder', ref: 'f /' }, null);
    await moveProjectItem('p /', { kind: 'file', ref: 'upload /' }, 'drafts');
    assert.deepEqual(calls, [
      { url: '/api/v1/projects/p%20%2F/folders/f%20%2F/parent', body: { parentId: null } },
      { url: '/api/v1/projects/p%20%2F/folders/items/file/upload%20%2F', body: { folderId: 'drafts' } },
    ]);
  } finally { globalThis.fetch = original; }
});
