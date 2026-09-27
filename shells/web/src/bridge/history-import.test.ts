// SPDX-License-Identifier: MPL-2.0
/**
 * Import data… with revision history (plan 277 P1, the adversarial review's B1, B2
 * and B7). Two browsers, each the real state bridge and revision store over the
 * in-memory IndexedDB, exchange backups through data-transfer's own exportBackup /
 * importBackup, and edit through the real automatic-history controller, the way a
 * tool does. The fixture test at the end imports backups exported by the running
 * app after real use of QR Code.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/history-import.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from './idb-memory.test-utils.ts';

const { createStateAPI } = await import('./state.ts');
const { createRevisionStore } = await import('./revision-history.ts');
const { createAutomaticHistory } = await import('../views/automatic-history.ts');
const { exportBackup, importBackup } = await import('../data-transfer.ts');
const { isHiddenSlot } = await import('../lib/batch-slots.ts');
import type { SavedStateData, StateDb } from './state.ts';

const delay = (ms = 5): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function device() {
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const state = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  let profile: Record<string, unknown> = {};
  const host = {
    state, profile: { get: async () => profile, set: async (next: Record<string, unknown>) => { profile = next; }, bust() {} },
    assets: { _exportUserAssets: async () => [], _importUserAsset: async () => {} },
  };
  const prefs = new Map<string, string>();
  const storage = { getItem: (k: string) => prefs.get(k) ?? null, setItem: (k: string, v: string) => { prefs.set(k, v); }, removeItem: (k: string) => { prefs.delete(k); } };
  return { db, stores, state, history: state.history!, deps: { host, storage } as unknown as Parameters<typeof exportBackup>[0] };
}
type Device = ReturnType<typeof device>;

/** Open a creation in a tool: the controller the tool view mounts, over this device. */
async function open(dev: Device, slot: string | null, live: { data: SavedStateData }) {
  const opened = slot ? await dev.history.open(slot) : null;
  let active = slot;
  const controller = createAutomaticHistory({
    history: dev.history, initial: opened ? { head: opened.head, version: opened.version, ...(opened.workingHash !== undefined ? { workingHash: opened.workingHash } : {}), ...(opened.adopt ? { adopt: true } : {}) } : undefined,
    toolId: 'qr-code', getSlot: () => active, setSlot: next => { active = next; }, snapshot: () => live.data,
    load: s => dev.state.load(s), capture: async () => null, saved() {}, store: (s, data) => dev.state.save(s, data),
  });
  await delay(0);
  return { controller, slot: () => active!, unsaved: opened?.unsaved === true };
}
const qr = (label: string, url: string): SavedStateData => ({ __toolId: 'qr-code', __label: label, payload: 'url', url });
/** Edit and press Save, as a person does in the tool. */
async function edit(dev: Device, slot: string | null, data: SavedStateData): Promise<string> {
  const live = { data };
  const tool = await open(dev, slot, live);
  tool.controller.changed(); await tool.controller.flush();
  await tool.controller.save(tool.slot(), data);
  await tool.controller.close(); tool.controller.dispose();
  await delay();
  return tool.slot();
}
const backup = async (dev: Device): Promise<ArrayBuffer> => (await exportBackup(dev.deps)).blob.arrayBuffer();
const visible = async (dev: Device): Promise<string[]> => (await dev.state.list()).filter(row => !isHiddenSlot(row.slot)).map(row => row.slot).sort();
const versions = async (dev: Device, slot: string): Promise<unknown[]> =>
  Promise.all((await dev.history.list({ slot, limit: 100 })).entries.map(entry => dev.history.read(entry.id).then(data => data?.url)));
const drafts = async (dev: Device, slot: string): Promise<unknown[]> => {
  const page = await dev.history.recovery.list({ slot, limit: 100 });
  return Promise.all(page.entries.filter(entry => entry.diverged).map(entry => dev.history.recovery.read(entry.id).then(data => data?.url)));
};

test('two browsers: the newer copy wins, the other stays in History, and a new creation arrives', async () => {
  const laptop = device(), phone = device();
  const poster = await edit(laptop, null, qr('Poster', 'https://example.com/poster-v1'));
  await importBackup(phone.deps, await backup(laptop));
  await edit(phone, poster, qr('Poster', 'https://example.com/poster-phone'));
  await edit(laptop, poster, qr('Poster', 'https://example.com/poster-laptop-v2'));       // saved after the phone's edit: newer
  const flyer = await edit(laptop, null, qr('Flyer', 'https://example.com/flyer'));
  const summary = await importBackup(phone.deps, await backup(laptop));
  assert.deepEqual(await visible(phone), [flyer, poster].sort(), 'the new creation arrived');
  assert.equal((await phone.state.load(poster))?.url, 'https://example.com/poster-laptop-v2', 'the newer copy is current');
  assert.ok((await versions(phone, poster)).includes('https://example.com/poster-phone'), "this browser's saved copy stays in History");
  assert.equal((summary as { replaced?: number }).replaced, 1);
  for (const slot of [poster, flyer]) assert.equal((await phone.history.open(slot)).unsaved, false, `${slot} opens as saved`);
  // Re-importing the laptop's first, older backup changes nothing and refuses nothing.
  await importBackup(phone.deps, await backup(laptop));
  assert.equal((await phone.state.load(poster))?.url, 'https://example.com/poster-laptop-v2');
});

test('an edit here that no checkpoint holds becomes a protected draft when the backup has a newer copy', async () => {
  const laptop = device(), phone = device();
  const poster = await edit(laptop, null, qr('Poster', 'https://example.com/p1'));
  await importBackup(phone.deps, await backup(laptop));
  const cursor = await phone.history.current(poster);
  await phone.history.recovery.save(poster, qr('Poster', 'https://example.com/phone-typing'), { writerId: 'phone-tab', expectedHead: cursor.head, expectedVersion: cursor.version });
  await delay(10);
  await edit(laptop, poster, qr('Poster', 'https://example.com/p2-newer'));
  await importBackup(phone.deps, await backup(laptop));
  assert.equal((await phone.state.load(poster))?.url, 'https://example.com/p2-newer');
  assert.deepEqual(await drafts(phone, poster), ['https://example.com/phone-typing'], 'History > Protected drafts holds what was typed here');
});

test('the rule compares the last explicit save on each side, not the time of the latest draft', async () => {
  const laptop = device(), phone = device();
  const poster = await edit(laptop, null, qr('Poster', 'https://example.com/p1'));
  await importBackup(phone.deps, await backup(laptop));
  await edit(phone, poster, qr('Poster', 'https://example.com/phone-saved'));              // saved first
  await edit(laptop, poster, qr('Poster', 'https://example.com/laptop-saved'));            // saved later
  const cursor = await phone.history.current(poster);                                      // typed here last, not saved
  await phone.history.recovery.save(poster, qr('Poster', 'https://example.com/phone-typing'), { writerId: 'phone-tab', expectedHead: cursor.head, expectedVersion: cursor.version });
  await importBackup(phone.deps, await backup(laptop));
  assert.equal((await phone.state.load(poster))?.url, 'https://example.com/laptop-saved', 'the later save wins');
  assert.deepEqual(await drafts(phone, poster), ['https://example.com/phone-typing'], 'what was typed here is a protected draft');
  assert.ok((await versions(phone, poster)).includes('https://example.com/phone-saved'));
});

test("this browser's newer work stays, and the backup's older copy is kept, never refused", async () => {
  const laptop = device(), phone = device();
  const poster = await edit(laptop, null, qr('Poster', 'https://example.com/v1'));
  await importBackup(phone.deps, await backup(laptop));
  await edit(laptop, poster, qr('Poster', 'https://example.com/laptop'));
  const older = await backup(laptop);
  await delay(10);
  await edit(phone, poster, qr('Poster', 'https://example.com/phone-newer'));
  const summary = await importBackup(phone.deps, older);
  assert.equal((await phone.state.load(poster))?.url, 'https://example.com/phone-newer');
  const entries = (await phone.history.list({ slot: poster, limit: 100 })).entries;
  const kept = await Promise.all(entries.map(entry => phone.history.read(entry.id).then(data => data?.url)));
  assert.ok(kept.includes('https://example.com/laptop'), "the laptop's version is in this creation's History");
  assert.equal((summary as { kept?: number }).kept, 1);
  // A restore (sameId 'incoming') takes the backup's copy on purpose, keeping this one.
  await importBackup(phone.deps, older, { sameId: 'incoming' });
  assert.equal((await phone.state.load(poster))?.url, 'https://example.com/laptop');
  assert.ok((await versions(phone, poster)).includes('https://example.com/phone-newer'), "this browser's saved copy stays in History");
});

test('a creation in the Trash or discarded here is left there, and the rest of the import arrives', async () => {
  const laptop = device(), phone = device();
  const poster = await edit(laptop, null, qr('Poster', 'https://example.com/p1'));
  await importBackup(phone.deps, await backup(laptop));
  await phone.history.move(poster, `__trash__:${poster}`);
  const flyer = await edit(laptop, null, qr('Flyer', 'https://example.com/f1'));
  await edit(laptop, poster, qr('Poster', 'https://example.com/p2'));
  const summary = await importBackup(phone.deps, await backup(laptop));
  assert.deepEqual(await visible(phone), [flyer], 'the trashed creation stays in the Trash');
  assert.equal((summary as { hidden?: number }).hidden, 1);
  assert.ok((await versions(phone, `__trash__:${poster}`)).includes('https://example.com/p2'), "the laptop's newer version is kept with it");

  // A never-saved creation discarded here, then this browser's own earlier backup.
  const own = device();
  const live = { data: qr('Draft', 'https://example.com/draft') };
  const tool = await open(own, null, live);
  tool.controller.changed(); await tool.controller.flush(); await tool.controller.close(); tool.controller.dispose();
  const earlier = await backup(own);
  const result = await own.history.discard(tool.slot());
  assert.equal(result.outcome, 'removed');
  await importBackup(own.deps, earlier);
  assert.deepEqual(await visible(own), [], 'the discarded creation does not come back');
});

test('a backup creation whose slot holds a different creation here arrives beside it', async () => {
  const laptop = device(), phone = device();
  await laptop.state.save('qr-code:shared-slot', qr('Laptop one', 'https://example.com/laptop-one'));
  await edit(laptop, 'qr-code:shared-slot', qr('Laptop one', 'https://example.com/laptop-one-edited'));
  await edit(phone, null, qr('Phone one', 'https://example.com/phone-one')).then(slot => phone.history.move(slot, 'qr-code:shared-slot'));
  const summary = await importBackup(phone.deps, await backup(laptop));
  const urls = await Promise.all((await visible(phone)).map(slot => phone.state.load(slot).then(data => data?.url)));
  assert.deepEqual(urls.sort(), ['https://example.com/laptop-one-edited', 'https://example.com/phone-one']);
  assert.equal((summary as { copies?: number }).copies, 1);
});

test('B2: saved outside the editor and the last explicit save survive a backup', async () => {
  const laptop = device(), phone = device();
  const poster = await edit(laptop, null, qr('Poster', 'https://example.com/saved'));
  await laptop.state.save(poster, qr('Poster FINAL', 'https://example.com/saved'));       // renamed in Projects
  const draft = await (async () => {
    const live = { data: qr('Named draft', 'https://example.com/draft') };
    const tool = await open(laptop, null, live);
    tool.controller.changed(); await tool.controller.flush(); await tool.controller.close(); tool.controller.dispose();
    await laptop.state.save(tool.slot(), live.data);                                      // named in Projects
    return tool.slot();
  })();
  const kept = await edit(laptop, null, qr('Kept', 'https://example.com/kept-save'));
  const live = { data: qr('Kept', 'https://example.com/kept-unsaved-edit') };
  const tool = await open(laptop, kept, live);
  tool.controller.changed(); await tool.controller.flush(); await tool.controller.close(); tool.controller.dispose();
  for (const slot of [poster, draft]) assert.equal((await laptop.history.open(slot)).unsaved, false);
  assert.equal((await laptop.history.open(kept)).unsaved, true);

  await importBackup(phone.deps, await backup(laptop));
  for (const slot of [poster, draft]) {
    assert.equal((await phone.history.open(slot)).unsaved, false, `${slot} opens as saved after the import`);
    assert.equal((await phone.history.discard(slot)).outcome, 'unchanged', 'Leave without saving keeps it');
  }
  assert.equal((await phone.state.load(poster))?.__label, 'Poster FINAL');
  assert.equal((await phone.history.open(kept)).unsaved, true, 'an unsaved edit is still unsaved');
  assert.equal((await phone.history.discard(kept)).outcome, 'restored');
  assert.equal((await phone.state.load(kept))?.url, 'https://example.com/kept-save', 'the carried last explicit save is where a discard returns');
});

test('B7: a creation from before the saved pointer counts as saved and is adopted on open', async () => {
  const dev = device();
  const live = { data: qr('Old work', 'https://example.com/old-work') };
  const tool = await open(dev, null, live);
  tool.controller.changed(); await tool.controller.flush(); await tool.controller.close(); tool.controller.dispose();
  const slot = tool.slot();
  const row = dev.stores.get('revision-documents')!.get(JSON.stringify(slot))!;
  const { saved: _before, ...older } = row.value as Record<string, unknown>;                 // written before this build
  row.value = older;
  const opened = await dev.history.open(slot);
  assert.equal(opened.unsaved, false, 'no amber, no Unsaved changes on Home');
  assert.equal(opened.adopt, true);
  assert.equal((await dev.history.discard(slot)).outcome, 'unchanged', 'Leave without saving never removes it');
  const again = await open(dev, slot, { data: live.data });
  await delay(30); again.controller.dispose();
  const doc = dev.stores.get('revision-documents')!.get(JSON.stringify(slot))!.value as { saved?: { hash: string } | null };
  assert.ok(doc.saved, 'the first open recorded its state as the last explicit save');
  // New auto-filed work keeps the P1 rule.
  const fresh = await open(dev, null, { data: qr('New draft', 'https://example.com/new') });
  fresh.controller.changed(); await fresh.controller.flush(); await fresh.controller.close(); fresh.controller.dispose();
  const reopened = await dev.history.open(fresh.slot());
  assert.equal(reopened.unsaved, true);
  assert.equal(reopened.neverSaved, true, 'the dialog can say that leaving removes it from Projects');
  assert.equal((await dev.history.open(slot)).neverSaved, undefined, 'saved work never reads as never saved');
});

test('backups exported by the running app after real use of QR Code import onto a browser that edited the same creation', async () => {
  const fixture = (name: string): ArrayBuffer => { const bytes = readFileSync(new URL(`./__fixtures__/history-import/${name}`, import.meta.url)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };
  const phone = device();
  await importBackup(phone.deps, fixture('laptop-1.zip'));
  const [poster] = await visible(phone);
  assert.ok(poster, 'the first backup brought the Poster');
  await edit(phone, poster!, { ...(await phone.state.load(poster!))!, url: 'https://example.com/poster-phone' });
  const summary = await importBackup(phone.deps, fixture('laptop-2.zip'));
  const slots = await visible(phone);
  assert.equal(slots.length, 2, 'the Flyer made on the laptop arrived');
  const flyer = slots.find(slot => slot !== poster)!;
  assert.equal((await phone.state.load(flyer))?.url, 'https://example.com/flyer');
  // The phone's edit is newer than the laptop's backup, so it stays; the laptop's is kept.
  assert.equal((await phone.state.load(poster!))?.url, 'https://example.com/poster-phone');
  const history = await Promise.all((await phone.history.list({ slot: poster!, limit: 100 })).entries.map(entry => phone.history.read(entry.id).then(data => data?.url)));
  assert.ok(history.includes('https://example.com/poster-laptop-v2'), "the laptop's later version is in History");
  assert.equal((summary as { kept?: number }).kept, 1);
  for (const slot of slots) assert.equal((await phone.history.open(slot)).unsaved, false);
});

test('a backup whose history does not fit still brings its sessions: older checkpoints are left out first, never current states or saves', async () => {
  const { MAX_REVISION_BYTES } = await import('./revision-limits.ts');
  const { backupHistoryNote } = await import('../lib/backup-summary.ts');
  const laptop = device(), phone = device();
  const poster = await edit(laptop, null, qr('Poster', 'https://example.com/v1'));
  await edit(laptop, poster, qr('Poster', 'https://example.com/v2'));
  await edit(laptop, poster, qr('Poster', 'https://example.com/v3'));
  const flyer = await edit(laptop, null, qr('Flyer', 'https://example.com/flyer'));
  phone.stores.get('revision-usage')!.set(JSON.stringify('total'), { key: 'total', value: { bytes: MAX_REVISION_BYTES - 1, previews: 0 } });
  const summary = await importBackup(phone.deps, await backup(laptop)) as Awaited<ReturnType<typeof importBackup>> & { historyLeftOut?: number };
  assert.deepEqual(await visible(phone), [flyer, poster].sort(), 'the sessions arrived');
  assert.equal((await phone.state.load(poster))?.url, 'https://example.com/v3');
  assert.equal(summary.historyLeftOut, 2, 'the two older Poster checkpoints were left out');
  assert.deepEqual(await versions(phone, poster), ['https://example.com/v3'], 'the current state and last save came in');
  for (const slot of [poster, flyer]) assert.equal((await phone.history.open(slot)).unsaved, false);
  assert.match(backupHistoryNote(summary), /History did not fit: 2 older versions were not imported\./);
});

test('which history comes in when space is short: pinned always, then the newest that fit', async () => {
  const { admit } = await import('./revision-archive.ts');
  const items = [{ id: 'a', at: '2026-09-01', bytes: 10 }, { id: 'b', at: '2026-09-02', bytes: 10 }, { id: 'c', at: '2026-09-03', bytes: 10 }, { id: 'head', at: '2026-08-01', bytes: 10 }];
  const some = admit(items, 25, new Set(['head']));
  assert.deepEqual([...some.ids].sort(), ['c', 'head']); assert.equal(some.leftOut, 2);
  const none = admit(items, 0, new Set(['head']));
  assert.deepEqual([...none.ids], ['head'], 'a pinned checkpoint comes in even over the limit'); assert.equal(none.leftOut, 3);
  assert.equal(admit(items, 1_000, new Set()).leftOut, 0);
});

test('an archive that fails its own validation still refuses the import', async () => {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import('fflate');
  const laptop = device(), phone = device();
  await edit(laptop, null, qr('Poster', 'https://example.com/v1'));
  const files = unzipSync(new Uint8Array(await backup(laptop)));
  const archive = JSON.parse(strFromU8(files['revision-history.json']!));
  archive.revisions[0].data.url = 'https://example.com/tampered';
  files['revision-history.json'] = strToU8(JSON.stringify(archive));
  const manifest = JSON.parse(strFromU8(files['manifest.json']!));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', files['revision-history.json']!));
  manifest.integrity['revision-history.json'] = `sha256-${Buffer.from(digest).toString('base64')}`;
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  await assert.rejects(importBackup(phone.deps, zipSync(files)), /Invalid revision history/);
  assert.deepEqual(await visible(phone), [], 'nothing arrived');
});

test('the import status says what happened: new arrivals, nothing new, a newer copy kept, a removed creation left removed (recheck R1)', async () => {
  const { backupImportLine } = await import('../lib/backup-summary.ts');
  const line = (summary: unknown): string => backupImportLine(summary as Parameters<typeof backupImportLine>[0]);
  const laptop = device(), phone = device();
  const poster = await edit(laptop, null, qr('Poster', 'https://example.com/p1'));
  const flyer = await edit(laptop, null, qr('Flyer', 'https://example.com/f1'));
  const first = await backup(laptop);
  assert.match(line(await importBackup(phone.deps, first)), /^Imported 2 sessions and 0 images · 2 creation checkpoints$/);
  assert.equal(line(await importBackup(phone.deps, first)), 'Nothing new to import.', 'the same backup again changes nothing');
  await edit(phone, poster, qr('Poster', 'https://example.com/phone-newer'));             // newer here
  await phone.history.move(flyer, `__trash__:${flyer}`);                                    // in the Trash here
  const again = line(await importBackup(phone.deps, first));
  assert.equal(again, 'Kept this browser’s newer copy of 1 creation. · 1 creation removed from Projects here stayed removed.');
  assert.equal(line({ sessions: 2, kept: 3, hidden: 2 }), 'Imported 2 sessions and 0 images · Kept this browser’s newer copy of 3 creations. · 2 creations removed from Projects here stayed removed.');
});
