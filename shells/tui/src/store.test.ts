// SPDX-License-Identifier: MPL-2.0
/**
 * The TUI's saved-project store against the DESKTOP app's own writer (plans/202 WP3.1).
 *
 * The point of the package is one set of files per machine, so the test drives the real
 * `createFsStateAPI` - the implementation both Tauri shells run - over a temp directory,
 * then reads the result through the TUI store. If the two ever disagree on the directory,
 * the filename codec or the record fields, this fails.
 *
 * `store.ts` resolves its directory ONCE at module load, so $LOLLY_STATE_DIR is set before
 * the dynamic import below.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFsStateAPI, type StateFs } from '../../tauri-shared/bridge-overrides/state-fs.ts';

const DIR = await mkdtemp(join(tmpdir(), 'lolly-tui-store-'));
process.env.LOLLY_STATE_DIR = DIR;

const store = await import('./store.ts');

process.on('exit', () => { try { rmSync(DIR, { recursive: true, force: true }); } catch { /* gone */ } });

/** The desktop shells' `fs` adapter, bound to the temp directory. Paths are relative to
 *  the app data dir, exactly as each Tauri shell binds @tauri-apps/plugin-fs. */
function tempFs(root: string): StateFs {
  const abs = (p: string): string => join(root, p);
  return {
    async exists(p) { try { await readFile(abs(p)); return true; } catch { return await dirExists(abs(p)); } },
    async mkdirRecursive(p) { await mkdir(abs(p), { recursive: true }); },
    async readTextFile(p) { return readFile(abs(p), 'utf8'); },
    async writeTextFile(p, text) { await mkdir(join(abs(p), '..'), { recursive: true }); await writeFile(abs(p), text); },
    async readDirNames(p) { return readdir(abs(p)); },
    async remove(p) { const { rm } = await import('node:fs/promises'); await rm(abs(p), { recursive: true, force: true }); },
  };
}

async function dirExists(p: string): Promise<boolean> {
  try { await readdir(p); return true; } catch { return false; }
}

test('a session the desktop app saved lists in the TUI store', async () => {
  const desktop = createFsStateAPI(tempFs(DIR));
  await desktop.save('qr-code:1788209079674', {
    __toolId: 'qr-code',
    __toolVersion: '1.0.0',
    __label: 'Conference badge',
    url: 'https://suse.com',
  }, null);

  const sessions = await store.listSessions();
  const found = sessions.find(s => s.slot === 'qr-code:1788209079674');
  assert.ok(found, 'the TUI must see the file the desktop bridge wrote');
  assert.equal(found.toolId, 'qr-code');
  assert.equal(found.label, 'Conference badge');
  assert.equal(found.data?.url, 'https://suse.com');
  assert.equal(found.query, '', 'a desktop record carries values, not URL-state');
});

test('a session the TUI saved loads back through the desktop bridge', async () => {
  await store.saveSession({
    slot: 'chart-99',
    toolId: 'chart',
    label: 'Q3 revenue',
    query: 'title=Q3+revenue',
    values: { title: 'Q3 revenue', rows: 4 },
    updatedAt: new Date().toISOString(),
  });

  const desktop = createFsStateAPI(tempFs(DIR));
  const data = await desktop.load('chart-99') as Record<string, unknown> | null;
  assert.ok(data, 'the desktop bridge must find the file the TUI wrote');
  assert.equal(data.__toolId, 'chart');
  assert.equal(data.__label, 'Q3 revenue');
  assert.equal(data.title, 'Q3 revenue');

  const listed = (await desktop.list()).find(e => e.slot === 'chart-99');
  assert.ok(listed);
  assert.equal(listed.toolId, 'chart');
  assert.equal(listed.label, 'Q3 revenue');
});

test('a slot with a space or a slash in it survives the round trip', async () => {
  const desktop = createFsStateAPI(tempFs(DIR));
  await desktop.save('Q3/Report keynote', { __toolId: 'design', __label: 'Q3/Report keynote' }, null);
  await store.saveSession({
    slot: 'Q3 Report', toolId: 'design', label: 'Q3 Report', query: '', updatedAt: new Date().toISOString(),
  });

  const slots = (await store.listSessions()).map(s => s.slot);
  assert.ok(slots.includes('Q3/Report keynote'));
  assert.ok(slots.includes('Q3 Report'), 'the two must not collapse onto one file');
  assert.ok(await desktop.load('Q3 Report'), 'and the desktop bridge reads the TUI one back');
});

test('app state the web shell keeps in the same store is not a project', async () => {
  const desktop = createFsStateAPI(tempFs(DIR));
  await desktop.save('__xprefs__:snippet', { format: 'png', width: 1200 }, null);
  const slots = (await store.listSessions()).map(s => s.slot);
  assert.equal(slots.includes('__xprefs__:snippet'), false, 'no toolId means it is not a project');
});

test('rename keeps the slot and the position in the recent order', async () => {
  await store.saveSession({
    slot: 'chart-rename', toolId: 'chart', label: 'Before', query: 'a=1', updatedAt: '2026-01-01T00:00:00.000Z',
  });
  await store.renameSession('chart-rename', 'After');
  const found = (await store.listSessions()).find(s => s.slot === 'chart-rename');
  assert.equal(found?.label, 'After');
  assert.equal(found?.updatedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(found?.query, 'a=1', 'renaming must not drop the state it reopens from');
});

test('delete removes the shared file, not just the TUI view of it', async () => {
  await store.saveSession({
    slot: 'chart-gone', toolId: 'chart', label: 'Gone', query: '', updatedAt: new Date().toISOString(),
  });
  await store.deleteSession('chart-gone');
  const desktop = createFsStateAPI(tempFs(DIR));
  assert.equal(await desktop.load('chart-gone'), null);
});

test('sessions saved before the move are copied across once, and left where they were', async () => {
  // A second temp home, so this case gets a store that has not migrated yet.
  const legacyHome = await mkdtemp(join(tmpdir(), 'lolly-tui-legacy-'));
  process.on('exit', () => { try { rmSync(legacyHome, { recursive: true, force: true }); } catch { /* gone */ } });
  await mkdir(join(legacyHome, 'sessions'), { recursive: true });
  await writeFile(join(legacyHome, 'sessions', 'qr-code-1.json'), JSON.stringify({
    slot: 'qr-code-1', toolId: 'qr-code', label: 'Old badge', query: 'url=https%3A%2F%2Fsuse.com',
    updatedAt: '2026-02-02T00:00:00.000Z',
  }));

  process.env.LOLLY_STATE_DIR = legacyHome;
  const legacyStore = await import(`./store.ts?migrate=${Date.now()}`) as typeof store;
  const sessions = await legacyStore.listSessions();
  process.env.LOLLY_STATE_DIR = DIR;

  const found = sessions.find(s => s.slot === 'qr-code-1');
  assert.ok(found, 'an old session must not vanish when the directory layout moves');
  assert.equal(found.label, 'Old badge');
  assert.equal(found.query, 'url=https%3A%2F%2Fsuse.com', 'the URL-state it reopens from comes across');
  assert.equal(found.updatedAt, '2026-02-02T00:00:00.000Z', 'and its place in the recent order');

  // The desktop bridge reads the copy, the old file is still there, and the marker stops
  // the walk running again.
  const desktop = createFsStateAPI(tempFs(legacyHome));
  assert.ok(await desktop.load('qr-code-1'));
  assert.ok(await readFile(join(legacyHome, 'sessions', 'qr-code-1.json'), 'utf8'));
  assert.ok(await readFile(join(legacyHome, 'saved-state', 'tui-sessions-v1.marker'), 'utf8'));
});
