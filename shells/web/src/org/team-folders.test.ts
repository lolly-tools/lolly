// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canMoveTeamItem, listTeamFolders, moveTeamItem, renameTeamFile, resetTeamFileRenameForTest, teamFileRenameAvailable,
  teamFolderPath, teamItemFolder, TeamFolderError, type TeamFolder,
} from './team-folders.ts';

const folders: TeamFolder[] = [
  { id: 'a', name: 'Campaign', projectId: 'p', parentId: null, createdAt: '', items: [{ kind: 'session', ref: 's' }] },
  { id: 'b', name: 'Drafts', projectId: 'p', parentId: 'a', createdAt: '', items: [{ kind: 'file', ref: 'f' }] },
];

async function withFetch<T>(fake: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try { return await run(); } finally { globalThis.fetch = original; }
}

test('folder paths and moves keep memberships and refuse cycles or foreign destinations', () => {
  assert.deepEqual(teamFolderPath(folders, 'b').map(folder => folder.name), ['Campaign', 'Drafts']);
  assert.equal(teamItemFolder(folders, { kind: 'file', ref: 'f' }), 'b');
  assert.equal(teamItemFolder(folders, { kind: 'session', ref: 'loose' }), null);
  assert.equal(teamItemFolder(folders, { kind: 'folder', ref: 'b' }), 'a');
  assert.equal(canMoveTeamItem(folders, { kind: 'folder', ref: 'a' }, 'b'), false);
  assert.equal(canMoveTeamItem(folders, { kind: 'folder', ref: 'a' }, 'a'), false);
  assert.equal(canMoveTeamItem(folders, { kind: 'folder', ref: 'b' }, null), true);
  assert.equal(canMoveTeamItem(folders, { kind: 'session', ref: 's' }, 'other-project-folder'), false);
});

test('the folder list refuses broken trees and keeps failures, rather than showing an empty project anyone can write to', async () => {
  for (const value of [folders, [{ ...folders[0], parentId: 'a' }], [{ ...folders[0], projectId: 'foreign' }], [{ ...folders[0], parentId: 'gone' }], { not: 'a list' }]) {
    const got = await withFetch(async () => Response.json({ folders: value }), () => listTeamFolders('p').then(() => 'ok', (error: unknown) => error));
    if (value === folders) assert.equal(got, 'ok');
    else assert.ok(got instanceof TeamFolderError && got.status === 0, JSON.stringify(value));
  }
  const refused = await withFetch(async () => new Response(null, { status: 403 }), () => listTeamFolders('p').catch((error: unknown) => error));
  assert.ok(refused instanceof TeamFolderError && refused.status === 403);
  assert.match((refused as Error).message, /cannot change its folders/);
  const offline = await withFetch(async () => { throw new Error('offline'); }, () => listTeamFolders('p').catch((error: unknown) => error));
  assert.ok(offline instanceof TeamFolderError && offline.status === 0);
});

test('folder and item moves use their own routes, encoded ids and an explicit null for the root', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  await withFetch(async (url, init) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return Response.json({}); }, async () => {
    await moveTeamItem('p /', { kind: 'folder', ref: 'f /' }, null);
    await moveTeamItem('p /', { kind: 'file', ref: 'upload /' }, 'drafts');
  });
  assert.deepEqual(calls, [
    { url: '/api/v1/projects/p%20%2F/folders/f%20%2F/parent', body: { parentId: null } },
    { url: '/api/v1/projects/p%20%2F/folders/items/file/upload%20%2F', body: { folderId: 'drafts' } },
  ]);
});

test('file rename sends only the name, and an instance without the route turns Rename off', async () => {
  resetTeamFileRenameForTest();
  const calls: Array<{ url: string; method?: string; body: unknown }> = [];
  const ok = await withFetch(async (url, init) => { calls.push({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) }); return Response.json({ name: 'Logo final.png' }); },
    () => renameTeamFile('p', 'file 1', 'Logo final.png'));
  assert.deepEqual(ok, { ok: true, data: { name: 'Logo final.png' } });
  assert.deepEqual(calls, [{ url: '/api/v1/projects/p/files/file%201', method: 'PATCH', body: { name: 'Logo final.png' } }]);
  // A missing file on a current instance is an ordinary refusal.
  const gone = await withFetch(async () => Response.json({ error: { code: 'NOT_FOUND', message: 'no such ready file' } }, { status: 404 }), () => renameTeamFile('p', 'f', 'x'));
  assert.deepEqual(gone, { ok: false, status: 404 });
  assert.equal(teamFileRenameAvailable(), true);
  // An instance that predates the route.
  const old = await withFetch(async () => Response.json({ error: { code: 'NOT_FOUND', message: 'no route for PATCH /api/v1/projects/p/files/f' } }, { status: 404 }), () => renameTeamFile('p', 'f', 'x'));
  assert.deepEqual(old, { ok: false, status: 404, unsupported: true });
  assert.equal(teamFileRenameAvailable(), false);
  resetTeamFileRenameForTest();
  const proxy = await withFetch(async () => new Response('Method Not Allowed', { status: 405 }), () => renameTeamFile('p', 'f', 'x'));
  assert.equal(proxy.ok === false && proxy.unsupported, true);
  resetTeamFileRenameForTest();
});
