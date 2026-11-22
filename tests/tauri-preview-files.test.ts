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
import { pbkdf2 } from 'node:crypto';
import { createFsStateAPI, whenFsStateIdle, type StateFs } from '../shells/tauri-shared/bridge-overrides/state-fs.ts';
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

/** Wait for the background work the state APIs over `fs` started (a move, a re-link,
 *  a sweep). It hashes on the platform's worker threads, so a count of event-loop
 *  turns is not enough on a loaded machine: that count failed on a CI runner. */
const settle = (fs: StateFs): Promise<void> => whenFsStateIdle(fs);

/** Keep the platform's worker threads busy, as other test files on a loaded CI runner
 *  do, so every hash the bridge takes finishes late. Returns the stop. */
function busyThreadPool(): () => void {
  let stop = false;
  const spin = (): void => { if (!stop) pbkdf2('lolly', 'busy', 20_000, 32, 'sha256', spin); };
  for (let i = 0; i < 8; i++) spin();
  return () => { stop = true; };
}

test('two saves of the same picture at once share one write: the second never truncates a file the first verified', async () => {
  const { fs, bytes } = memoryFs();
  let writes = 0;
  const write = fs.writeFile!;
  fs.writeFile = async (path, value) => { writes++; await new Promise(r => setTimeout(r, 20)); await write(path, value); };
  const state = createFsStateAPI(fs);
  const picture = await prepared(png('same'));
  await Promise.all([
    state.save('poster:1', { __toolId: 'poster', title: 'a' }, picture),
    state.save('poster:2', { __toolId: 'poster', title: 'b' }, picture),
  ]);
  assert.equal(writes, 1, 'one write of the file');
  const rows = await state.list();
  assert.ok(rows.every(row => row.preview?.key === picture.ref.key), 'both records point at it');
  assert.equal(bytes.size, 1);
  assert.equal(await state.pictureDataUrl!({ slot: 'poster:2' }), png('same'));
});

test('the picture sweep removes nothing after a walk that could not read every record, keeps a file a corrupt record points at, and removes a file only when two walks ten minutes apart found no record', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-21T09:00:00Z') });
  const { fs, bytes, text } = memoryFs();
  text.set('saved-state/slotname-v1.marker', '1');
  const first = createFsStateAPI(fs);
  const a = await prepared(png('a')), b = await prepared(png('b')), orphan = await prepared(png('orphan')), named = await prepared(png('named'));
  await first.save('poster:a', { __toolId: 'poster', title: 'a' }, a);
  await first.save('poster:b', { __toolId: 'poster', title: 'b' }, b);
  bytes.set(`saved-state/previews/${orphan.ref.key}.png`, orphan.bytes);
  bytes.set(`saved-state/previews/${named.ref.key}.png`, named.bytes);
  // A record cut short on disk that still holds the key of the picture it points at.
  text.set('saved-state/poster%3Acut.json', `{"slot":"poster:cut","preview":{"key":"${named.ref.key}","type":"image/png"`);
  const read = fs.readTextFile;
  let failB = false;
  fs.readTextFile = async (path) => { if (failB && path.endsWith('poster%3Ab.json')) throw new Error('busy'); return read(path); };
  // Each launch lists, then sweeps a moment later.
  const launch = async () => { await createFsStateAPI(fs).list(); context.mock.timers.tick(3000); await settle(fs); };
  failB = true;
  await launch();
  assert.equal(bytes.size, 4, 'an incomplete walk removes nothing, not even the orphan');
  assert.equal(text.has('saved-state/previews/orphans.txt'), false, 'and notes nothing');
  failB = false;
  await launch();
  assert.equal(bytes.size, 4, 'a first complete walk only notes the orphan');
  assert.match(text.get('saved-state/previews/orphans.txt')!, new RegExp(`^${orphan.ref.key} `));
  context.mock.timers.tick(11 * 60_000);
  await launch();
  const left = [...bytes.keys()].map(path => path.split('/').pop()!.split('.')[0]).sort();
  assert.deepEqual(left, [a.ref.key, b.ref.key, named.ref.key].sort(), 'a walk ten minutes later removes only the orphan');
});

test('a record another window writes while a walk runs keeps its picture: the second walk sees the record', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-21T09:00:00Z') });
  const { fs, bytes, text } = memoryFs();
  text.set('saved-state/slotname-v1.marker', '1');
  const picture = await prepared(png('shared'));
  bytes.set(`saved-state/previews/${picture.ref.key}.png`, picture.bytes);
  const launch = async () => { await createFsStateAPI(fs).list(); context.mock.timers.tick(3000); await settle(fs); };
  await launch();
  assert.ok(bytes.size === 1 && text.get('saved-state/previews/orphans.txt')?.startsWith(picture.ref.key), 'no record names the file yet: noted');
  // Another window copies a session by reference, naming the file.
  text.set('saved-state/poster%3Ab.json', JSON.stringify({ slot: 'poster:b', toolId: 'poster', data: { __toolId: 'poster' }, thumb: null, preview: { ...picture.ref }, updatedAt: '2026-11-21T09:01:00.000Z' }));
  context.mock.timers.tick(11 * 60_000);
  await launch();
  assert.equal(bytes.size, 1, 'the picture stays');
  assert.equal(text.get('saved-state/previews/orphans.txt'), '', 'and is no longer noted');
});

test('a long-running app sweeps the pictures a session let go of, so saving new pictures does not grow the folder without bound', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-21T09:00:00Z') });
  const { fs, bytes, text } = memoryFs();
  text.set('saved-state/slotname-v1.marker', '1');
  const state = createFsStateAPI(fs);
  const save = async (tag: string) => state.save('poster:1', { __toolId: 'poster', title: 'same work' }, await prepared(png(tag)));
  const keyOf = async (tag: string) => (await prepared(png(tag))).ref.key;
  // Three rounds of twenty saves of the same session, eleven minutes apart; each
  // round of let-go pictures starts a sweep a minute later.
  for (let i = 0; i < 21; i++) await save(`first-${i}`);
  context.mock.timers.tick(11 * 60_000); await settle(fs);
  for (let i = 0; i < 20; i++) await save(`second-${i}`);
  context.mock.timers.tick(60_000); await settle(fs);
  assert.equal(bytes.size, 41, 'the first round is only noted on its first walk');
  context.mock.timers.tick(11 * 60_000); await settle(fs);
  for (let i = 0; i < 20; i++) await save(`third-${i}`);
  context.mock.timers.tick(60_000); await settle(fs);
  for (let i = 0; i < 21; i++) assert.equal(bytes.has(`saved-state/previews/${await keyOf(`first-${i}`)}.png`), false, `first-${i} went`);
  assert.equal(bytes.size, 40, 'at most the two newest rounds remain');
  const record = JSON.parse(text.get('saved-state/poster%3A1.json')!);
  assert.ok(bytes.has(`saved-state/previews/${record.preview.key}.png`), 'the picture the record points at is kept');
});

test('a save or a delete that lands while old pictures move wins: the move never writes a stale copy or brings a deleted session back', async (context) => {
  const { fs, text } = memoryFs();
  text.set('saved-state/slotname-v1.marker', '1');
  const legacy = (slot: string, title: string) => JSON.stringify({ slot, toolId: 'poster', toolVersion: '1', label: title, data: { __toolId: 'poster', title }, thumb: png(`legacy-${title}`),
    updatedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', formatVersion: 4 });
  text.set('saved-state/poster%3A1.json', legacy('poster:1', 'one'));
  text.set('saved-state/poster%3A2.json', legacy('poster:2', 'two'));
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const state = createFsStateAPI(fs);
  await state.list();
  const fresh = await prepared(png('fresh'));
  await state.save('poster:1', { __toolId: 'poster', title: 'edited' }, fresh);
  await state.delete('poster:2');
  context.mock.timers.tick(3000);
  await settle(fs);
  const one = JSON.parse(text.get('saved-state/poster%3A1.json')!);
  assert.equal(one.data.title, 'edited');
  assert.equal(one.preview.key, fresh.ref.key, 'its own new picture, not the old one moved over it');
  assert.equal(text.has('saved-state/poster%3A2.json'), false, 'the deleted session stays deleted');
});

test('a picture from outside is read as the web store reads one: an SVG only through the sanitiser, refused where there is none', async () => {
  const { fs, text, bytes } = memoryFs();
  const state = createFsStateAPI(fs);
  const T = '2026-11-21T09:00:00.000Z';
  const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" onload="alert(1)"><rect width="8" height="8"/></svg>')}`;
  // Node has no DOMParser, so the sanitiser cannot run: the SVG is not kept at all.
  await state.restore!('poster:svg', { __toolId: 'poster', title: 'from a backup' }, svg, T, T);
  const record = JSON.parse(text.get('saved-state/poster%3Asvg.json')!);
  assert.equal(record.thumb, null);
  assert.equal(record.preview, undefined);
  assert.equal(record.data.title, 'from a backup', 'the session itself arrives');
  // A raster from outside is kept, as a file named by its bytes.
  await state.restore!('poster:png', { __toolId: 'poster', title: 'raster' }, png('outside'), T, T);
  const raster = JSON.parse(text.get('saved-state/poster%3Apng.json')!);
  assert.equal(raster.preview.route, 'received');
  assert.equal(bytes.size, 1);
  assert.equal(await state.pictureDataUrl!({ slot: 'poster:png' }), png('outside'));
});

/**
 * A record as the 1.2.1 CLI and TUI write one again (packages/node-shell/src/
 * session-store.ts at v1.2.1, `writeSessionRecord` with `normalise`d prior): only the
 * fields that build knew, `thumb` carried from the prior record (null once the
 * picture has moved), stamped as session format 4. `preview` does not survive.
 */
function writtenBy121(prior: Record<string, unknown>, slot: string, data: Record<string, unknown>, label: string): string {
  const at = '2026-11-22T10:00:00.000Z';
  return JSON.stringify({ slot, toolId: prior.toolId, toolVersion: prior.toolVersion, label, data,
    thumb: typeof prior.thumb === 'string' ? prior.thumb : null, updatedAt: at, createdAt: prior.createdAt ?? at,
    formatVersion: 4, engineVersion: '1.349.0' }, null, 2);
}

test('a 1.2.1 CLI or TUI rename or copy of a moved session: the picture is found again by its work, kept, and never swept', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-22T09:00:00Z') });
  const { fs, bytes, text } = memoryFs();
  text.set('saved-state/slotname-v1.marker', '1');
  const picture = await prepared(png('desktop'));
  const work = { __toolId: 'poster', title: 'launch', __label: 'Launch' };
  await createFsStateAPI(fs).save('poster:1', work, picture);
  const saved = JSON.parse(text.get('saved-state/poster%3A1.json')!);
  assert.equal(saved.preview.key, picture.ref.key);
  // The 1.2.1 TUI renames it; the 1.2.1 CLI copies it; and an old edit changes another copy's work.
  text.set('saved-state/poster%3A1.json', writtenBy121(saved, 'poster:1', { ...work, __label: 'Renamed' }, 'Renamed'));
  text.set('saved-state/poster%3A2.json', writtenBy121(saved, 'poster:2', { ...work, __label: 'Launch copy' }, 'Launch copy'));
  text.set('saved-state/poster%3A3.json', writtenBy121(saved, 'poster:3', { ...work, title: 'edited' }, 'Edited'));
  for (const slot of ['poster%3A1', 'poster%3A2']) assert.equal(JSON.parse(text.get(`saved-state/${slot}.json`)!).preview, undefined, 'the old writer dropped the reference');

  const launch = async () => { const rows = await createFsStateAPI(fs).list(); context.mock.timers.tick(3000); await settle(fs); return rows; };
  const rows = await launch();
  const key = (slot: string) => rows.find(row => row.slot === slot)?.preview?.key;
  assert.equal(key('poster:1'), picture.ref.key, 'the rename shows its picture');
  assert.equal(key('poster:2'), picture.ref.key, 'the copy shows the same picture');
  assert.equal(key('poster:3'), undefined, 'changed work is not given a picture of other work');
  const renamed = JSON.parse(text.get('saved-state/poster%3A1.json')!);
  assert.equal(renamed.preview.key, picture.ref.key, 'kept on the record');
  assert.equal(renamed.label, 'Renamed', 'every field the old writer wrote is kept');
  assert.equal(renamed.formatVersion, 4);
  // Two walks ten minutes apart: the picture stays, since records point at it again.
  context.mock.timers.tick(11 * 60_000);
  await launch();
  assert.ok(bytes.has(`saved-state/previews/${picture.ref.key}.png`));
});

test('on a busy machine the re-link is still written to the record: the wait is for the work, not for a count of turns', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-22T09:00:00Z') });
  const { fs, text } = memoryFs();
  text.set('saved-state/slotname-v1.marker', '1');
  const picture = await prepared(png('busy'));
  const work = { __toolId: 'poster', title: 'launch', __label: 'Launch' };
  await createFsStateAPI(fs).save('poster:1', work, picture);
  const saved = JSON.parse(text.get('saved-state/poster%3A1.json')!);
  text.set('saved-state/poster%3A1.json', writtenBy121(saved, 'poster:1', { ...work, __label: 'Renamed' }, 'Renamed'));
  const stop = busyThreadPool();
  try {
    await createFsStateAPI(fs).list();
    context.mock.timers.tick(3000);
    await settle(fs);
    assert.equal(JSON.parse(text.get('saved-state/poster%3A1.json')!).preview?.key, picture.ref.key, 'kept on the record');
  } finally { stop(); }
  await whenFsStateIdle(fs);
});

test('links stay honest: a renamed session gets its own picture back, not one another session with the same document saved later; an unreadable link stops the sweep; links for work no record has go', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-22T09:00:00Z') });
  const { fs, bytes, text } = memoryFs();
  text.set('saved-state/slotname-v1.marker', '1');
  const mine = await prepared(png('mine')), imported = await prepared(png('imported'));
  const work = { __toolId: 'poster', title: 'shared', __label: 'Mine' };
  const app = createFsStateAPI(fs);
  await app.save('poster:1', work, mine);
  await app.restore!('poster:imported', { ...work, __label: 'From a backup' }, imported, '2026-11-22T09:05:00.000Z', '2026-11-22T09:05:00.000Z');
  const saved = JSON.parse(text.get('saved-state/poster%3A1.json')!);
  text.set('saved-state/poster%3A1.json', writtenBy121(saved, 'poster:1', { ...work, __label: 'Renamed' }, 'Renamed'));
  const launch = async () => { const rows = await createFsStateAPI(fs).list(); context.mock.timers.tick(3000); await settle(fs); return rows; };
  let rows = await launch();
  assert.equal(rows.find(r => r.slot === 'poster:1')?.preview?.key, mine.ref.key, 'its own picture');

  // Many saves of one session with new work and the same picture leave one link.
  const busy = createFsStateAPI(fs);
  for (let i = 0; i < 30; i++) await busy.save('poster:busy', { __toolId: 'poster', title: `draft ${i}` }, mine);
  const links = () => [...text.keys()].filter(path => /previews\/w-[0-9a-f]{32}\.ref$/.test(path)).length;
  assert.ok(links() >= 30);
  context.mock.timers.tick(11 * 60_000);
  rows = await launch();
  assert.equal(links(), 2, 'one link for the shared document, one for the busy session');

  // A record that lost its reference, whose link cannot be read: nothing is swept.
  const lost = JSON.parse(text.get('saved-state/poster%3Aimported.json')!);
  text.set('saved-state/poster%3Aimported.json', writtenBy121(lost, 'poster:imported', { ...work, __label: 'Imported renamed' }, 'Imported renamed'));
  text.set('saved-state/poster%3A1.json', JSON.stringify({ ...JSON.parse(text.get('saved-state/poster%3A1.json')!), data: { ...work, title: 'moved on' } }));
  const read = fs.readTextFile;
  fs.readTextFile = async (path) => { if (/previews\/w-/.test(path)) throw new Error('busy'); return read(path); };
  await launch();
  context.mock.timers.tick(11 * 60_000);
  await launch();
  assert.ok(bytes.has(`saved-state/previews/${imported.ref.key}.png`), 'kept while its link could not be read');
});
