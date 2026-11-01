// SPDX-License-Identifier: MPL-2.0
/**
 * The desktop and mobile apps write documents, slots and the migration marker
 * through the adapter's atomic write, so a crash mid-save cannot truncate a
 * saved document. An adapter without it still works through a plain write.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFsStateAPI, type StateFs } from '../shells/tauri-shared/bridge-overrides/state-fs.ts';

function fakeFs(atomic: boolean) {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const plain: string[] = [];
  const safe: string[] = [];
  const fs: StateFs = {
    exists: async (path) => files.has(path) || dirs.has(path),
    mkdirRecursive: async (path) => { dirs.add(path); },
    readTextFile: async (path) => { const v = files.get(path); if (v === undefined) throw new Error(`missing ${path}`); return v; },
    writeTextFile: async (path, text) => { plain.push(path); files.set(path, text); },
    readDirNames: async (path) => [...files.keys()].filter(k => k.startsWith(`${path}/`)).map(k => k.slice(path.length + 1)),
    remove: async (path) => { files.delete(path); },
    ...(atomic ? { writeDocumentAtomic: async (path: string, text: string) => { safe.push(path); files.set(path, text); } } : {}),
  };
  return { fs, files, plain, safe };
}

test('save and restore write the slot file through the atomic path only', async () => {
  const { fs, plain, safe } = fakeFs(true);
  const state = createFsStateAPI(fs);
  await state.save('qr-code:1', { __toolId: 'qr-code', url: 'a' });
  await state.restore!('qr-code:2', { __toolId: 'qr-code', url: 'b' }, null, '2026-09-21T09:00:00.000Z', '2026-09-20T09:00:00.000Z');
  assert.deepEqual(plain, [], 'no plain write reaches the destination');
  assert.ok(safe.some(p => /^saved-state\/qr-code.*1\.json$/.test(p)));
  assert.ok(safe.some(p => /^saved-state\/qr-code.*2\.json$/.test(p)));
  assert.ok(safe.includes('saved-state/slotname-v1.marker'), 'the migration marker is atomic too');
  assert.deepEqual((await state.load('qr-code:1'))?.url, 'a');
});

test('the legacy filename migration rewrites through the atomic path', async () => {
  const { fs, files, plain, safe } = fakeFs(true);
  files.set('saved-state/Q3_Report.json', JSON.stringify({ slot: 'Q3 Report', updatedAt: 't', data: { __toolId: 'x' } }));
  const state = createFsStateAPI(fs);
  await state.list();
  assert.deepEqual(plain, []);
  assert.ok(safe.some(p => p.endsWith('.json') && p !== 'saved-state/Q3_Report.json'));
  assert.equal(files.has('saved-state/Q3_Report.json'), false);
});

test('an adapter without the atomic write falls back to the plain write', async () => {
  const { fs, plain, safe } = fakeFs(false);
  const state = createFsStateAPI(fs);
  await state.save('qr-code:1', { __toolId: 'qr-code', url: 'a' });
  assert.deepEqual(safe, []);
  assert.ok(plain.some(p => p.startsWith('saved-state/qr-code')));
  assert.equal((await state.load('qr-code:1'))?.url, 'a');
});

test('a failed atomic write surfaces and leaves the earlier document readable', async () => {
  const { fs, files } = fakeFs(true);
  const state = createFsStateAPI(fs);
  await state.save('s', { __toolId: 'x', url: 'old' });
  const path = [...files.keys()].find(k => k.endsWith('s.json'))!;
  const before = files.get(path);
  fs.writeDocumentAtomic = async () => { throw new Error('disk full'); };
  await assert.rejects(state.save('s', { __toolId: 'x', url: 'new' }), /disk full/);
  assert.equal(files.get(path), before);
  assert.equal((await state.load('s'))?.url, 'old');
});
