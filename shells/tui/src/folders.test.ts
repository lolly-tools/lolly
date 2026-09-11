// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the TUI's folder store (folders.ts): the pure tree helpers (BFS-ish
 * child/descendant walks, breadcrumbs, the uncategorised bucket) AND the persisted CRUD,
 * which is where the two rules that matter live - cascade delete never touches sessions,
 * and a session belongs to at most one folder.
 *
 * `folders.ts` resolves its directory ONCE at module load, so $LOLLY_STATE_DIR is set
 * before the dynamic import below; every case then runs against a throwaway temp dir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Folder } from './folders.ts';

const DIR = await mkdtemp(join(tmpdir(), 'lolly-tui-folders-'));
process.env.LOLLY_STATE_DIR = DIR;
const F = await import('./folders.ts');

process.on('exit', () => { try { rmSync(DIR, { recursive: true, force: true }); } catch { /* best effort */ } });

/** Build an in-memory folder record (the pure helpers never read disk). */
function folder(id: string, parentId: string | null, refs: string[] = []): Folder {
  const now = new Date().toISOString();
  return { id, name: id, parentId, items: refs.map(ref => ({ type: 'session', ref })), createdAt: now, updatedAt: now };
}

async function reset(): Promise<void> {
  await writeFile(F.foldersPath(), '[]');
}

// ── Where the file lives ─────────────────────────────────────────────────────

test('folders.json sits in the resolved state directory, not a directory of its own', () => {
  // This used to read only $LOLLY_TUI_DIR, so setting the current variable moved the
  // sessions and left the folders behind in ~/.lolly (plans/202 WP3.1).
  assert.equal(F.foldersPath(), join(DIR, 'folders.json'));
});

// ── Pure tree helpers ────────────────────────────────────────────────────────

test('childFolders returns direct children; null asks for the top level', () => {
  const all = [folder('a', null), folder('b', 'a'), folder('c', 'a'), folder('d', 'b')];
  assert.deepEqual(F.childFolders(all, null).map(f => f.id), ['a']);
  assert.deepEqual(F.childFolders(all, 'a').map(f => f.id), ['b', 'c']);
  assert.deepEqual(F.childFolders(all, 'd').map(f => f.id), []);
});

test('childFolders surfaces an orphan at the top level so it never vanishes', () => {
  const all = [folder('a', null), folder('orphan', 'deleted-parent')];
  assert.deepEqual(F.childFolders(all, null).map(f => f.id), ['a', 'orphan']);
});

test('descendantIds returns the whole subtree, excluding the folder itself', () => {
  const all = [folder('a', null), folder('b', 'a'), folder('c', 'b'), folder('d', null)];
  assert.deepEqual(F.descendantIds(all, 'a').sort(), ['b', 'c']);
  assert.deepEqual(F.descendantIds(all, 'd'), []);
});

test('descendantIds terminates on a malformed cycle', () => {
  const all = [folder('a', 'b'), folder('b', 'a')];
  assert.deepEqual(F.descendantIds(all, 'a'), ['b']);
});

test('folderPath is the breadcrumb from the top-level ancestor down', () => {
  const all = [folder('a', null), folder('b', 'a'), folder('c', 'b')];
  assert.deepEqual(F.folderPath(all, 'c').map(f => f.id), ['a', 'b', 'c']);
  assert.deepEqual(F.folderPath(all, 'missing'), []);
});

test('folderOfRef and uncategorisedRefs split the session set', () => {
  const all = [folder('a', null, ['s1']), folder('b', null, ['s2'])];
  assert.equal(F.folderOfRef(all, 's2'), 'b');
  assert.equal(F.folderOfRef(all, 's9'), null);
  assert.deepEqual(F.uncategorisedRefs(all, ['s1', 's2', 's3']), ['s3']);
});

// ── Persisted CRUD ───────────────────────────────────────────────────────────

test('createFolder persists and rejects a blank name', async () => {
  await reset();
  const f = await F.createFolder('  Client work  ');
  assert.equal(f.name, 'Client work');
  assert.deepEqual((await F.listFolders()).map(x => x.id), [f.id]);
  await assert.rejects(() => F.createFolder('   '), /folder name is required/);
});

test('a missing folders.json reads as an empty list, not a throw', async () => {
  await rm(F.foldersPath(), { force: true });
  assert.deepEqual(await F.listFolders(), []);
});

test('a corrupt folders.json reads as an empty list', async () => {
  await writeFile(F.foldersPath(), '{ not json');
  assert.deepEqual(await F.listFolders(), []);
});

test('removeFolder cascade-deletes the whole subtree and no other branch', async () => {
  await reset();
  const a = await F.createFolder('a');
  const b = await F.createFolder('b', a.id);
  const c = await F.createFolder('c', b.id);
  const other = await F.createFolder('other');
  const { removed } = await F.removeFolder(a.id);
  assert.deepEqual(removed.sort(), [a.id, b.id, c.id].sort());
  assert.deepEqual((await F.listFolders()).map(f => f.id), [other.id]);
});

test('addItem enforces single membership (adding elsewhere detaches)', async () => {
  await reset();
  const a = await F.createFolder('a');
  const b = await F.createFolder('b');
  await F.addItem(a.id, 's1');
  await F.addItem(b.id, 's1');
  const all = await F.listFolders();
  assert.deepEqual(all.find(f => f.id === a.id)!.items, []);
  assert.deepEqual(all.find(f => f.id === b.id)!.items.map(i => i.ref), ['s1']);
});

test('addItem is idempotent within one folder', async () => {
  await reset();
  const a = await F.createFolder('a');
  await F.addItem(a.id, 's1');
  await F.addItem(a.id, 's1');
  assert.equal((await F.getFolder(a.id))!.items.length, 1);
});

test('moveItem(null) sends a session back to uncategorised', async () => {
  await reset();
  const a = await F.createFolder('a');
  await F.addItem(a.id, 's1');
  await F.moveItem('s1', null);
  assert.deepEqual((await F.getFolder(a.id))!.items, []);
  assert.deepEqual(F.uncategorisedRefs(await F.listFolders(), ['s1']), ['s1']);
});

test('moveFolder refuses a cycle and a missing target, but reparents otherwise', async () => {
  await reset();
  const a = await F.createFolder('a');
  const b = await F.createFolder('b', a.id);
  await F.moveFolder(a.id, b.id);                       // cycle
  assert.equal((await F.getFolder(a.id))!.parentId, null);
  await F.moveFolder(a.id, 'ghost');                    // missing target
  assert.equal((await F.getFolder(a.id))!.parentId, null);
  const c = await F.createFolder('c');
  await F.moveFolder(a.id, c.id);
  assert.equal((await F.getFolder(a.id))!.parentId, c.id);
});

test('prune drops refs whose session is gone and leaves the rest', async () => {
  await reset();
  const a = await F.createFolder('a');
  await F.addItem(a.id, 's1');
  await F.addItem(a.id, 's2');
  const { removed } = await F.prune(['s1']);
  assert.equal(removed, 1);
  assert.deepEqual((await F.getFolder(a.id))!.items.map(i => i.ref), ['s1']);
  assert.equal((await F.prune(['s1'])).removed, 0);     // nothing left to prune
});

test('renameFolder trims and rejects a blank name', async () => {
  await reset();
  const a = await F.createFolder('a');
  await F.renameFolder(a.id, '  Renamed  ');
  assert.equal((await F.getFolder(a.id))!.name, 'Renamed');
  await assert.rejects(() => F.renameFolder(a.id, ' '), /folder name is required/);
});
