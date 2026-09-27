// SPDX-License-Identifier: MPL-2.0
/**
 * The desktop and mobile apps' state bridge keeps a session's save time the way
 * the web bridge does (plan 277 P7, review S2): restore() writes a backup import
 * or a Trash move with the session's own update and save times, save() counts
 * as a save only when the work changed (so a rename keeps the save time), and
 * list() reports it for the newer-copy import rule.
 */
import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFsStateAPI, type StateFs } from '../shells/tauri-shared/bridge-overrides/state-fs.ts';
import { restoreBackupSessions, packBackupSessions } from '../shells/web/src/lib/backup-sessions.ts';

function fakeStateFs(): StateFs {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    exists: async (path) => files.has(path) || dirs.has(path),
    mkdirRecursive: async (path) => { dirs.add(path); },
    readTextFile: async (path) => { const v = files.get(path); if (v === undefined) throw new Error(`missing ${path}`); return v; },
    writeTextFile: async (path, text) => { files.set(path, text); },
    readDirNames: async (path) => [...files.keys()].filter(k => k.startsWith(`${path}/`)).map(k => k.slice(path.length + 1)),
    remove: async (path) => { files.delete(path); },
  };
}

const T1 = '2026-09-20T09:00:00.000Z', T2 = '2026-09-21T09:00:00.000Z', T3 = '2026-09-22T09:00:00.000Z';
afterEach(() => { mock.timers.reset(); });

test('restore keeps the session’s own times; save stamps a save only when the work changed', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse(T3) });
  const state = createFsStateAPI(fakeStateFs());
  assert.ok(state.restore, 'the filesystem bridge implements restore');
  await state.restore!('qr-code:1', { __toolId: 'qr-code', __label: 'Launch', url: 'a' }, null, T2, T1);
  let row = (await state.list())[0]!;
  assert.equal(row.updatedAt, T2);
  assert.equal(row.savedAt, T1);

  // A rename (label and export filename only) keeps the save time.
  await state.save('qr-code:1', { __toolId: 'qr-code', __label: 'Launch (final)', __export_filename: 'Launch (final)', url: 'a' });
  row = (await state.list())[0]!;
  assert.equal(row.updatedAt, T3, 'the write time moves');
  assert.equal(row.savedAt, T1, 'the save time does not');

  // A real edit is a save.
  await state.save('qr-code:1', { __toolId: 'qr-code', __label: 'Launch (final)', url: 'b' });
  assert.equal((await state.list())[0]!.savedAt, T3);
});

test('a Trash-style move through restore keeps the save time, so the moved copy does not win an import', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse(T1) });
  const phone = createFsStateAPI(fakeStateFs());
  const laptop = createFsStateAPI(fakeStateFs());
  await phone.save('qr-code:1', { __toolId: 'qr-code', __label: 'Launch', url: 'old' });
  mock.timers.setTime(Date.parse(T2));
  await laptop.save('qr-code:1', { __toolId: 'qr-code', __label: 'Launch', url: 'newer on the laptop' });
  mock.timers.setTime(Date.parse(T3));
  // Into the Trash and back again, moving the record the way lib/trash.ts does.
  for (const [from, to] of [['qr-code:1', '__trash__:qr-code:1'], ['__trash__:qr-code:1', 'qr-code:1']]) {
    const row = (await phone.list()).find(r => r.slot === from)!;
    await phone.restore!(to!, (await phone.load(from!))!, row.thumb, row.updatedAt, row.savedAt);
    await phone.delete(from!);
  }
  assert.equal((await phone.list())[0]!.savedAt, T1);

  const entries: Record<string, Uint8Array> = {};
  await packBackupSessions(phone, entries as never, { mode: 'sync' });
  await restoreBackupSessions(laptop, entries as Record<string, Uint8Array<ArrayBuffer>>, {});
  assert.equal((await laptop.load('qr-code:1'))?.url, 'newer on the laptop');
});
