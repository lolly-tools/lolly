// SPDX-License-Identifier: MPL-2.0
/**
 * The desktop and mobile apps keep each session's picture once, as a file named by
 * the hash of its bytes, under saved-state/previews/ (plan 373). The record keeps a
 * short reference. These drive the shared state bridge over an in-memory adapter:
 * the file is written and read back before any record points at the file, a torn file never
 * shows, a rename keeps the picture, an adapter with no binary file calls keeps the
 * old data URL, this device's old data-URL pictures move into files with every
 * other field of the record kept, and what an older desktop build would read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFsStateAPI, type StateFs } from '../shells/tauri-shared/bridge-overrides/state-fs.ts';
import { previewRefFor, decodePictureDataUrl } from '../engine/src/session-preview.ts';

const PNG_HEAD = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==');
const png = (tag: string): string => `data:image/png;base64,${btoa(PNG_HEAD + tag)}`;

function memoryFs(options: { binary?: boolean } = {}) {
  const text = new Map<string, string>();
  const bytes = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  const fs: StateFs = {
    exists: async (path) => text.has(path) || bytes.has(path) || dirs.has(path),
    mkdirRecursive: async (path) => { dirs.add(path); },
    readTextFile: async (path) => { const v = text.get(path); if (v === undefined) throw new Error(`missing ${path}`); return v; },
    writeTextFile: async (path, value) => { text.set(path, value); },
    readDirNames: async (path) => [...text.keys(), ...bytes.keys()].filter(k => k.startsWith(`${path}/`)).map(k => k.slice(path.length + 1)).filter(k => !k.includes('/'))
      .concat(path === 'saved-state' && [...bytes.keys()].some(k => k.startsWith('saved-state/previews/')) ? ['previews'] : []),
    remove: async (path) => { text.delete(path); bytes.delete(path); },
    ...(options.binary === false ? {} : {
      readFile: async (path: string) => { const v = bytes.get(path); if (!v) throw new Error(`missing ${path}`); return v.slice(); },
      writeFile: async (path: string, value: Uint8Array) => { bytes.set(path, value.slice()); },
    }),
  };
  return { fs, text, bytes };
}
async function prepared(url: string) {
  const decoded = decodePictureDataUrl(url)!;
  const ref = (await previewRefFor(decoded.bytes, decoded.type, { route: 'export-raster' }))!;
  return { ref, bytes: decoded.bytes };
}

test('a saved picture is written as one file, read back, and named by the record', async () => {
  const { fs, bytes, text } = memoryFs();
  const state = createFsStateAPI(fs);
  const picture = await prepared(png('one'));
  await state.save('poster:1', { __toolId: 'poster', title: 'a' }, picture);
  const file = `saved-state/previews/${picture.ref.key}.png`;
  assert.ok(bytes.has(file), 'the picture file exists');
  const record = JSON.parse(text.get('saved-state/poster%3A1.json')!);
  assert.equal(record.thumb, null);
  assert.equal(record.preview.key, picture.ref.key);
  const [row] = await state.list();
  assert.equal(row!.preview?.key, picture.ref.key);
  assert.equal(row!.thumb, null);
  assert.equal((await state.picture!(row!.preview!))?.type, 'image/png');
  assert.equal(await state.pictureDataUrl!({ slot: 'poster:1' }), png('one'));
  // A rename keeps the picture; a copy by reference shares the one file.
  await state.save('poster:1', { __toolId: 'poster', title: 'a', __label: 'Renamed' });
  await state.save('poster:2', { __toolId: 'poster', title: 'a' }, row!.preview);
  assert.equal([...bytes.keys()].length, 1);
  assert.equal((await state.list()).filter(r => r.preview?.key === picture.ref.key).length, 2);
  // A torn or altered file never shows as a picture.
  bytes.set(file, new Uint8Array([1, 2, 3]));
  assert.equal(await state.picture!(row!.preview!), null);
});

test('an adapter without binary file calls keeps the picture on the record as a data URL, as before', async () => {
  const { fs, text } = memoryFs({ binary: false });
  const state = createFsStateAPI(fs);
  await state.save('poster:1', { __toolId: 'poster' }, await prepared(png('old-adapter')));
  const record = JSON.parse(text.get('saved-state/poster%3A1.json')!);
  assert.equal(record.thumb, png('old-adapter'));
  assert.equal(record.preview, undefined);
});

test("this device's old data-URL pictures move into files after a list, keeping every other field of the record", async () => {
  const { fs, text, bytes } = memoryFs();
  const legacy = { slot: 'poster:9', toolId: 'poster', toolVersion: '1', label: 'Old', data: { __toolId: 'poster', title: 'x' }, thumb: png('legacy'),
    updatedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', formatVersion: 4, engineVersion: '1.349.0', somethingNewer: { kept: true } };
  text.set('saved-state/poster%3A9.json', JSON.stringify(legacy));
  text.set('saved-state/slotname-v1.marker', '1');
  const state = createFsStateAPI(fs);
  const before = await state.list();
  assert.equal(before[0]!.thumb, png('legacy'), 'shown the old way until it moves');
  // The move waits a moment after the list; wait for the move.
  for (let i = 0; i < 100 && ![...bytes.keys()].length; i++) await new Promise(r => setTimeout(r, 50));
  for (let i = 0; i < 100 && JSON.parse(text.get('saved-state/poster%3A9.json')!).thumb; i++) await new Promise(r => setTimeout(r, 20));
  const after = JSON.parse(text.get('saved-state/poster%3A9.json')!);
  assert.equal(after.thumb, null);
  assert.equal(after.preview.route, 'legacy');
  assert.deepEqual(after.somethingNewer, { kept: true }, 'a field this build does not know is kept');
  assert.equal(after.updatedAt, legacy.updatedAt, 'moving a picture is not an edit');
  assert.equal(await state.pictureDataUrl!({ slot: 'poster:9' }), png('legacy'), 'byte for byte the picture it was');
});

test('what an older desktop build sees: it lists only .json names and finds no thumb on a moved record', async () => {
  const { fs, text } = memoryFs();
  const state = createFsStateAPI(fs);
  await state.save('poster:1', { __toolId: 'poster', title: 'a' }, await prepared(png('new')));
  // The 1.1.0 and 1.2.1 readers: every *.json name in saved-state, thumb as the picture.
  const names = (await fs.readDirNames('saved-state')).filter(name => name.endsWith('.json'));
  assert.deepEqual(names, ['poster%3A1.json'], 'the previews directory is not a record to them');
  const record = JSON.parse(text.get(`saved-state/${names[0]}`)!);
  assert.equal(record.thumb ?? null, null, 'no picture for them: the tool icon shows; the document opens');
  assert.equal(record.data.title, 'a');
});
