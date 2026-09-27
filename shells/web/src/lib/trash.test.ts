// SPDX-License-Identifier: MPL-2.0
/**
 * The one Trash model every web delete door shares (lib/trash.ts, plan 277 P3).
 *
 * Driven against the SAME StateAPI the web shell persists with (the memory
 * driver of lib/ephemeral-state.ts, so no IndexedDB), an in-memory profile and a
 * small assets fake that behaves like bridge/assets.ts: a trashed upload keeps its
 * record, is marked `trashedAt`, and drops out of _listUserAssets. The revision
 * store's move is modelled as the real one behaves: it keeps the record's fields,
 * returns quietly when the source is missing and refuses a taken destination.
 * What is pinned:
 *
 *   - a session delete moves the record (and its history, when the host has a
 *     revision store) to a trash slot stamped with the delete time, and
 *     remembers its folder;
 *   - restore puts record, history and folder membership back;
 *   - purge (Delete forever, Empty Trash, the 30-day sweep) is the only real
 *     deletion, and the one moment a session's history goes;
 *   - uploads follow the same rules, and a purge a saved creation blocks leaves
 *     the entry in the Trash;
 *   - list() reconciles what storage holds with the profile's entries, so an item
 *     is never in the Trash unseen or listed after it is gone;
 *   - the review's findings (B3, B4, B5, S4, S8, S9): a stale row, a stale profile
 *     write in another tab and an entry an import brought back can never delete
 *     anything that is not in the Trash under that entry.
 *
 * Run directly:  node --test shells/web/src/lib/trash.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStateDb } from './ephemeral-state.ts';
import { createStateAPI, type SavedStateData, type StateRecord } from '../bridge/state.ts';
import { createTrash, stampedTrashSlot, trashSlotInfo, TrashPurgeError, type TrashHost } from './trash.ts';
import { TRASH_RETENTION_MS, trashEntryKey, type TrashEntry, type TrashedFolder, type TrashedSession } from '../folders.ts';

interface FakeAsset { id: string; type: string; meta: { name: string }; blob: { size: number }; trashedAt?: string }

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number): string => new Date(ms).toISOString();

/** A host over the memory StateAPI and its raw store. */
function freshHost(opts: { history?: boolean; inUse?: Set<string>; onMove?: () => Promise<void> } = {}) {
  const db = createMemoryStateDb();
  const state = createStateAPI(db);
  const originalDelete = state.delete.bind(state);
  let profile: Record<string, unknown> = {};
  const deletes: string[] = [];
  const history = new Map<string, string[]>();
  const assets = new Map<string, FakeAsset>();
  const deletedAssets: string[] = [];
  const hostState = Object.assign(state, {
    async delete(slot: string) { deletes.push(slot); history.delete(slot); await originalDelete(slot); },
    ...(opts.history ? {
      history: {
        // bridge/revision-maintenance.ts moveSlot: the record keeps its fields;
        // a missing source is a quiet no-op; a taken destination throws.
        async move(from: string, to: string) {
          await opts.onMove?.();
          const rec = await db.get('state', from) as StateRecord | undefined;
          if (!rec) return;
          if (await db.get('state', to)) throw new Error('The destination already exists.');
          await db.put('state', { ...rec, slot: to });
          await db.delete('state', from);
          if (history.has(from)) { history.set(to, history.get(from)!); history.delete(from); }
        },
      },
    } : {}),
  });
  const host: TrashHost = {
    profile: {
      async get() { return structuredClone(profile); },
      async set(next: object) { profile = structuredClone(next as Record<string, unknown>); },
    },
    state: hostState as unknown as TrashHost['state'],
    assets: {
      async _listUserAssets() { return [...assets.values()].filter(a => !a.trashedAt).map(a => ({ id: a.id })); },
      async _deleteUserAsset(id: string) {
        if (opts.inUse?.has(id)) throw new Error('This asset is used by a saved creation or retained history.');
        assets.delete(id); deletedAssets.push(id);
      },
      async _deleteTrashedUserAsset(id: string, trashedAt: string) {
        const a = assets.get(id);
        if (!a || a.trashedAt !== trashedAt) return false;
        if (opts.inUse?.has(id)) throw new Error('This asset is used by a saved creation or retained history.');
        assets.delete(id); deletedAssets.push(id);
        return true;
      },
      async _setUserAssetTrashed(id: string, at: string | null, set: { expect?: string | null } = {}) {
        const a = assets.get(id);
        if (!a) return false;
        if (set.expect !== undefined && (a.trashedAt ?? null) !== set.expect) return false;
        if (at) a.trashedAt = at; else delete a.trashedAt;
        return true;
      },
      async _listTrashedUserAssets() {
        return [...assets.values()].filter(a => a.trashedAt).map(a => ({ id: a.id, type: a.type, name: a.meta.name, trashedAt: a.trashedAt!, bytes: a.blob.size }));
      },
    },
  };
  const addAsset = (id: string, name: string): void => { assets.set(id, { id, type: 'raster', meta: { name }, blob: { size: 100 } }); };
  /** Write a record as it is stored, with a chosen last-save time. */
  const putRecord = async (slot: string, data: SavedStateData, updatedAt: string): Promise<void> => {
    await db.put('state', { slot, toolId: data.__toolId, toolVersion: data.__toolVersion, label: data.__label, data, thumb: null, updatedAt, createdAt: updatedAt });
  };
  return { host, state, db, deletes, history, assets, deletedAssets, addAsset, putRecord, profile: () => profile, setProfile: (p: Record<string, unknown>) => { profile = p; } };
}

const SESSION = (label: string) => ({ __toolId: 'qr-code', __toolVersion: '1.0.0', __label: label, url: 'https://example.test' });
const slotsOf = async (f: ReturnType<typeof freshHost>): Promise<string[]> => (await f.state.list()).map(r => r.slot).sort();

test('a session delete moves the record and its history to a stamped trash slot, and remembers its folder', async () => {
  const f = freshHost({ history: true });
  await f.state.save('qr-code:a', SESSION('Poster'));
  f.history.set('qr-code:a', ['rev-1', 'rev-2']);
  f.setProfile({ folders: [{ id: 'fold', name: 'Event', parentId: null, items: [{ type: 'session', ref: 'qr-code:a' }], createdAt: '', updatedAt: '' }] });
  const trash = createTrash(f.host);
  const [entry] = await trash.trashSessions(['qr-code:a']);
  assert.ok(entry);
  const info = trashSlotInfo(entry.slot);
  assert.equal(info?.originalSlot, 'qr-code:a');
  assert.equal(info?.at, Date.parse(entry.deletedAt), 'the slot carries the delete time');
  assert.equal(entry.parentId, 'fold');
  assert.equal(entry.label, 'Poster');
  assert.deepEqual(await slotsOf(f), [entry.slot], 'the record left its slot');
  assert.deepEqual(f.history.get(entry.slot), ['rev-1', 'rev-2'], 'the history went with it and is kept');
  assert.deepEqual((f.profile().folders as Array<{ items: unknown[] }>)[0]!.items, [], 'the folder no longer lists it');
  assert.equal(f.deletes.length, 0, 'nothing was deleted');
  assert.equal((await trash.list()).length, 1);
});

test('restore puts the record, its history and its folder membership back', async () => {
  const f = freshHost({ history: true });
  await f.state.save('qr-code:a', SESSION('Poster'));
  f.history.set('qr-code:a', ['rev-1']);
  f.setProfile({ folders: [{ id: 'fold', name: 'Event', parentId: null, items: [{ type: 'session', ref: 'qr-code:a' }], createdAt: '', updatedAt: '' }] });
  const trash = createTrash(f.host);
  const [entry] = await trash.trashSessions(['qr-code:a']);
  assert.deepEqual(await trash.restore(entry!), { status: 'restored', missing: 0 });
  assert.deepEqual(await slotsOf(f), ['qr-code:a']);
  assert.deepEqual(f.history.get('qr-code:a'), ['rev-1']);
  assert.deepEqual((f.profile().folders as Array<{ items: Array<{ ref: string }> }>)[0]!.items.map(i => i.ref), ['qr-code:a']);
  assert.deepEqual(await trash.list(), []);
});

test('Delete forever is the one real deletion, and takes the history with it', async () => {
  const f = freshHost({ history: true });
  await f.state.save('qr-code:a', SESSION('Poster'));
  f.history.set('qr-code:a', ['rev-1']);
  const trash = createTrash(f.host);
  const [entry] = await trash.trashSessions(['qr-code:a']);
  assert.equal(await trash.purge(entry!), 'purged');
  assert.deepEqual(f.deletes, [entry!.slot]);
  assert.equal(f.history.size, 0, 'the history is gone once the item is deleted for good');
  assert.deepEqual(await f.state.list(), []);
  assert.deepEqual(await trash.list(), []);
});

test('a host with no revision store moves the record by load, save and delete', async () => {
  const f = freshHost();
  await f.state.save('qr-code:a', SESSION('Poster'));
  const trash = createTrash(f.host);
  const [entry] = await trash.trashSessions(['qr-code:a']);
  assert.equal((await f.state.load(entry!.slot))?.__label, 'Poster');
  await trash.restore(entry!);
  assert.deepEqual(await slotsOf(f), ['qr-code:a']);
});

test('a slot already in the Trash is never trashed twice, and every deletion gets its own trash slot', async () => {
  const f = freshHost({ history: true });
  await f.state.save('qr-code:a', SESSION('First'));
  const trash = createTrash(f.host);
  const [first] = await trash.trashSessions(['qr-code:a']);
  assert.deepEqual(await trash.trashSessions([first!.slot]), [], 'a trash slot is skipped');
  await f.state.save('qr-code:a', SESSION('Second'));
  const [second] = await trash.trashSessions(['qr-code:a']);
  assert.ok(second && second.slot !== first!.slot && second.slot.startsWith('__trash__:'));
  assert.equal((await trash.list()).length, 2);
});

test('a folder goes to the Trash with its sessions as one entry, and comes back whole', async () => {
  const f = freshHost({ history: true });
  await f.state.save('qr-code:a', SESSION('A'));
  await f.state.save('qr-code:b', SESSION('B'));
  f.setProfile({ folders: [
    { id: 'root', name: 'Event', parentId: null, items: [{ type: 'session', ref: 'qr-code:a' }, { type: 'image', ref: 'user/upload/1-x' }], createdAt: '', updatedAt: '' },
    { id: 'child', name: 'Day 1', parentId: 'root', items: [{ type: 'session', ref: 'qr-code:b' }], createdAt: '', updatedAt: '' },
  ] });
  const trash = createTrash(f.host);
  const entry = await trash.trashFolder('root');
  assert.ok(entry);
  assert.equal(entry.sessions.length, 2);
  assert.ok(entry.sessions.every(m => trashSlotInfo(m.slot)?.at === Date.parse(entry.deletedAt)), 'members carry the folder entry\'s time');
  assert.deepEqual(f.profile().folders, []);
  assert.deepEqual(await slotsOf(f), entry.sessions.map(m => m.slot).sort());
  assert.deepEqual(await trash.restore(entry), { status: 'restored', missing: 0 });
  assert.deepEqual(await slotsOf(f), ['qr-code:a', 'qr-code:b']);
  assert.deepEqual((f.profile().folders as Array<{ id: string }>).map(x => x.id).sort(), ['child', 'root']);
});

test('an upload goes to the Trash as a mark, leaves every list, and restores to its folder', async () => {
  const f = freshHost();
  f.addAsset('user/upload/1-a', 'Hero');
  f.setProfile({ folders: [{ id: 'fold', name: 'Event', parentId: null, items: [{ type: 'image', ref: 'user/upload/1-a' }], createdAt: '', updatedAt: '' }] });
  const trash = createTrash(f.host);
  const [entry] = await trash.trashAssets([{ id: 'user/upload/1-a', name: 'Hero', type: 'raster' }]);
  assert.equal(entry!.kind, 'asset');
  assert.equal(entry!.parentId, 'fold');
  assert.ok(f.assets.get('user/upload/1-a')?.trashedAt, 'the record stays, marked');
  assert.deepEqual(await f.host.assets._listUserAssets(), [], 'and every list skips it');
  assert.equal(await trash.bytes(), 100);
  await trash.restore(entry!);
  assert.equal(f.assets.get('user/upload/1-a')?.trashedAt, undefined);
  assert.deepEqual((f.profile().folders as Array<{ items: Array<{ ref: string }> }>)[0]!.items.map(i => i.ref), ['user/upload/1-a']);
});

test('purging an upload deletes the bytes and its favourite, hidden and category marks', async () => {
  const f = freshHost();
  f.addAsset('user/upload/1-a', 'Hero');
  f.setProfile({ favouriteAssets: ['user/upload/1-a', 'lolly/logo'], hiddenAssets: ['user/upload/1-a'], assetCategories: { 'user/upload/1-a': 'photos', other: 'icons' } });
  const trash = createTrash(f.host);
  const [entry] = await trash.trashAssets([{ id: 'user/upload/1-a', name: 'Hero' }]);
  assert.equal(await trash.purge(entry!), 'purged');
  assert.deepEqual(f.deletedAssets, ['user/upload/1-a']);
  const p = f.profile();
  assert.deepEqual(p.favouriteAssets, ['lolly/logo']);
  assert.deepEqual(p.hiddenAssets, []);
  assert.deepEqual(p.assetCategories, { other: 'icons' });
  assert.deepEqual(await trash.list(), []);
});

test('an upload a saved creation still uses stays in the Trash, and says why', async () => {
  const f = freshHost({ inUse: new Set(['user/upload/1-a']) });
  f.addAsset('user/upload/1-a', 'Hero');
  const trash = createTrash(f.host);
  const [entry] = await trash.trashAssets([{ id: 'user/upload/1-a', name: 'Hero' }]);
  await assert.rejects(trash.purge(entry!), TrashPurgeError);
  assert.equal((await trash.list()).length, 1, 'the entry is kept');
  const { purged, kept } = await trash.empty();
  assert.deepEqual({ purged, kept }, { purged: 0, kept: 1 });
});

test('the 30-day sweep purges only entries past the retention window', async () => {
  const f = freshHost({ history: true });
  await f.state.save('qr-code:old', SESSION('Old'));
  const trash = createTrash(f.host);
  const [old] = await trash.trashSessions(['qr-code:old']);
  // A day before the window closes nothing goes; a day after, it does.
  assert.equal(await trash.sweep(Date.parse(old!.deletedAt) + TRASH_RETENTION_MS - DAY), 0);
  assert.equal(await trash.sweep(Date.parse(old!.deletedAt) + TRASH_RETENTION_MS + DAY), 1);
  assert.deepEqual(f.deletes, [old!.slot]);
  assert.deepEqual(await trash.list(), []);
});

test('list() reconciles storage and entries both ways', async () => {
  const f = freshHost();
  // A mark with no entry (a backup brought the record without the profile's entry).
  f.addAsset('user/upload/1-a', 'Orphan');
  f.assets.get('user/upload/1-a')!.trashedAt = '2026-09-01T00:00:00.000Z';
  // An entry whose upload was restored on another device (record no longer marked).
  f.addAsset('user/upload/2-b', 'Restored elsewhere');
  // A `__trash__:` record no entry accounts for, and a session entry whose slot is gone.
  await f.state.save('__trash__:qr-code:c', SESSION('Stray'));
  f.setProfile({ trash: [
    { kind: 'asset', id: 'user/upload/2-b', label: 'Restored elsewhere', parentId: null, deletedAt: '2026-09-02T00:00:00.000Z' },
    { kind: 'session', slot: '__trash__:qr-code:gone', originalSlot: 'qr-code:gone', label: 'Gone', parentId: null, deletedAt: '2026-09-03T00:00:00.000Z' },
  ] });
  const entries = await createTrash(f.host).list();
  const keys = entries.map(e => `${e.kind}:${trashEntryKey(e)}`).sort();
  assert.deepEqual(keys, ['asset:user/upload/1-a', 'session:__trash__:qr-code:c']);
  assert.deepEqual(f.profile().trash, entries, 'the reconciled list is written back once');
});

// ── Review findings (plans/277 product-fixes/review.md) ──────────────────────

test('B3: Delete forever on a stale row never deletes an upload restored meanwhile', async () => {
  const f = freshHost();
  f.addAsset('user/upload/1-a', 'Receipt scan');
  const dialog = createTrash(f.host);
  const [row] = await dialog.trashAssets([{ id: 'user/upload/1-a', name: 'Receipt scan' }]);
  // The Undo toast, or another tab, restores it; the open dialog still shows the row.
  await createTrash(f.host).restore(row!);
  const outcome = await dialog.purge(row!);
  assert.ok(f.assets.has('user/upload/1-a'), 'the upload is still in the library');
  assert.equal(f.assets.get('user/upload/1-a')?.trashedAt, undefined, 'and still live');
  assert.deepEqual(f.deletedAssets, []);
  assert.equal(outcome, 'gone', 'and the row says the item has left the Trash');
});

test('B3: a stale row never deletes or restores the same upload deleted again since', async () => {
  const f = freshHost();
  f.addAsset('user/upload/1-a', 'Receipt scan');
  const trash = createTrash(f.host);
  const [first] = await trash.trashAssets([{ id: 'user/upload/1-a', name: 'Receipt scan' }]);
  await trash.restore(first!);
  await new Promise(r => setTimeout(r, 5));
  const [second] = await trash.trashAssets([{ id: 'user/upload/1-a', name: 'Receipt scan' }]);
  assert.notEqual(first!.deletedAt, second!.deletedAt);
  const outcome = await trash.purge(first!);
  assert.ok(f.assets.has('user/upload/1-a'), 'the old row deletes nothing');
  assert.equal(outcome, 'gone');
  assert.deepEqual((await trash.restore(first!))?.status, 'gone', 'and restores nothing');
  assert.equal(f.assets.get('user/upload/1-a')?.trashedAt, second!.deletedAt, 'the new deletion stands');
  assert.equal((await trash.list()).length, 1, 'with its entry');
});

test('B3: Empty Trash and the sweep re-check every item, so a restore in between is safe', async () => {
  const f = freshHost({ history: true });
  f.addAsset('user/upload/1-a', 'Receipt scan');
  await f.state.save('qr-code:a', SESSION('Poster'));
  const trash = createTrash(f.host);
  const [upload] = await trash.trashAssets([{ id: 'user/upload/1-a', name: 'Receipt scan' }]);
  const [session] = await trash.trashSessions(['qr-code:a']);
  // Another tab restores both, then this tab's stale entries are purged directly.
  const other = createTrash(f.host);
  await other.restore(upload!); await other.restore(session!);
  const outcomes = [await trash.purge(upload!), await trash.purge(session!)];
  assert.ok(f.assets.has('user/upload/1-a'), 'the restored upload is still there');
  assert.deepEqual(await slotsOf(f), ['qr-code:a']);
  assert.deepEqual(f.deletes, []);
  assert.deepEqual(outcomes, ['gone', 'gone']);
});

test('B4: another tab\'s stale profile write never gets a trashed creation deleted early', async () => {
  const f = freshHost({ history: true });
  await f.putRecord('qr-code:old', SESSION('Old poster'), iso(Date.now() - 90 * DAY));
  const cachedInTabB = structuredClone(f.profile());
  const tabA = createTrash(f.host);
  await tabA.trashSessions(['qr-code:old']);
  // Tab B toggles a favourite from the profile it read before: the entry is dropped.
  f.setProfile({ ...cachedInTabB, favouriteProjects: ['something'] });
  assert.equal(await tabA.sweep(), 0, 'the next Projects visit purges nothing');
  const [rebuilt] = await tabA.list();
  assert.ok(rebuilt, 'the creation shows in the Trash');
  assert.ok(Math.abs(Date.parse(rebuilt.deletedAt) - Date.now()) < 60_000, 'dated when it was deleted, not when it was last saved');
  assert.equal((await f.state.list()).length, 1, 'the creation is still stored');
});

test('B4: an unstamped orphan is dated now, and a rebuilt entry is never purged in the pass that rebuilt it', async () => {
  const f = freshHost({ history: true });
  // A slot from before stamping, last saved 90 days ago.
  await f.putRecord('__trash__:qr-code:legacy', SESSION('Legacy'), iso(Date.now() - 90 * DAY));
  // A stamped slot whose deletion really is 40 days old, with its entry lost.
  const stamped = stampedTrashSlot('qr-code:stamped', Date.now() - 40 * DAY);
  await f.putRecord(stamped, SESSION('Stamped'), iso(Date.now() - 50 * DAY));
  const trash = createTrash(f.host);
  assert.equal(await trash.sweep(), 0, 'nothing goes in the pass that found them');
  const entries = await trash.list();
  const legacy = entries.find(e => e.kind === 'session' && e.originalSlot === 'qr-code:legacy');
  assert.ok(legacy && Math.abs(Date.parse(legacy.deletedAt) - Date.now()) < 60_000, 'the legacy orphan gets its full 30 days');
  const old = entries.find(e => e.kind === 'session' && e.originalSlot === 'qr-code:stamped');
  assert.equal(old?.deletedAt, iso(trashSlotInfo(stamped)!.at!), 'the stamped orphan keeps its real delete time');
  assert.equal(await trash.sweep(), 1, 'a later visit removes the one past 30 days');
  assert.deepEqual(await slotsOf(f), ['__trash__:qr-code:legacy']);
});

test('B5: an old folder entry an import brings back never purges a newer Trash item', async () => {
  const f = freshHost({ history: true });
  // The layout the review reproduced, with slots from before stamping: today's
  // "Invoice QR" entry and a 35-day-old folder entry share one trash slot.
  const now = Date.now();
  await f.putRecord('__trash__:qr-code:s', SESSION('Invoice QR'), iso(now));
  const today: TrashedSession = { kind: 'session', slot: '__trash__:qr-code:s', originalSlot: 'qr-code:s', label: 'Invoice QR', parentId: null, deletedAt: iso(now) };
  const phantom: TrashedFolder = {
    kind: 'folder', rootId: 'old-event', name: 'Old event', deletedAt: iso(now - 35 * DAY),
    tree: [{ id: 'old-event', name: 'Old event', parentId: null, items: [{ type: 'session', ref: 'qr-code:s' }], createdAt: '', updatedAt: '' }],
    sessions: [{ originalSlot: 'qr-code:s', slot: '__trash__:qr-code:s' }],
  };
  f.setProfile({
    folders: [{ id: 'old-event', name: 'Old event', parentId: null, items: [], createdAt: '', updatedAt: '' }],
    trash: [phantom, today],
  });
  const trash = createTrash(f.host);
  // Delete forever on the phantom row: nothing of today's item goes.
  const outcome = await trash.purge(phantom);
  assert.deepEqual(await slotsOf(f), ['__trash__:qr-code:s'], 'today\'s item survives Delete forever on the phantom row');
  assert.equal(outcome, 'gone');
  // And the sweep, with the phantom back in the list, removes nothing either.
  f.setProfile({ ...f.profile(), trash: [phantom, today] });
  assert.equal(await trash.sweep(), 0);
  assert.deepEqual(await slotsOf(f), ['__trash__:qr-code:s'], 'today\'s item is still in the Trash');
  const entries = await trash.list();
  assert.deepEqual(entries.map(e => e.kind), ['session'], 'the phantom folder entry is dropped');
});

test('B5: a folder entry keeps only the members it owns', async () => {
  const f = freshHost({ history: true });
  const now = Date.now();
  await f.putRecord('__trash__:qr-code:s', SESSION('Shared'), iso(now));
  const newer: TrashedSession = { kind: 'session', slot: '__trash__:qr-code:s', originalSlot: 'qr-code:s', label: 'Shared', parentId: null, deletedAt: iso(now) };
  const older: TrashedFolder = {
    kind: 'folder', rootId: 'gone-folder', name: 'Gone', deletedAt: iso(now - 5 * DAY),
    tree: [{ id: 'gone-folder', name: 'Gone', parentId: null, items: [{ type: 'session', ref: 'qr-code:s' }], createdAt: '', updatedAt: '' }],
    sessions: [{ originalSlot: 'qr-code:s', slot: '__trash__:qr-code:s' }],
  };
  f.setProfile({ trash: [older, newer] });
  const entries = await createTrash(f.host).list();
  const folder = entries.find((e): e is TrashedFolder => e.kind === 'folder');
  assert.deepEqual(folder?.sessions, [], 'the newer entry owns the shared slot');
  assert.ok(entries.some(e => e.kind === 'session'));
});

test('S4: restoring a folder an import brought back merges its items and says what stayed', async () => {
  const f = freshHost({ history: true });
  await f.state.save('qr-code:s1', SESSION('S1'));
  await f.state.save('qr-code:s2', SESSION('S2'));
  f.setProfile({ folders: [{ id: 'event', name: 'Event', parentId: null, items: [{ type: 'session', ref: 'qr-code:s1' }, { type: 'session', ref: 'qr-code:s2' }], createdAt: '', updatedAt: '' }] });
  const trash = createTrash(f.host);
  const entry = await trash.trashFolder('event');
  // The import brings "Event" back holding S1, and a copy of S1 at its old slot.
  await f.state.save('qr-code:s1', SESSION('S1 from the copy'));
  f.setProfile({ ...f.profile(), folders: [{ id: 'event', name: 'Event', parentId: null, items: [{ type: 'session', ref: 'qr-code:s1' }], createdAt: '', updatedAt: '' }] });
  const result = await trash.restore(entry!);
  assert.equal(result.status, 'restored');
  const event = (f.profile().folders as Array<{ id: string; items: Array<{ ref: string }> }>).find(x => x.id === 'event')!;
  assert.ok(event.items.some(i => i.ref === 'qr-code:s2'), 'S2 is back in its folder');
  const besides = event.items.map(i => i.ref).filter(r => r.startsWith('qr-code:s1:'));
  assert.equal(besides.length, 1, 'the trashed S1 came back beside the imported one, in the folder');
  assert.deepEqual(await trash.list(), [], 'nothing is left behind in the Trash');
});

test('S4 and S8: a member that vanished is reported, and a restored item that vanished says so', async () => {
  const f = freshHost({ history: true });
  await f.state.save('qr-code:a', SESSION('A'));
  await f.state.save('qr-code:b', SESSION('B'));
  f.setProfile({ folders: [{ id: 'event', name: 'Event', parentId: null, items: [{ type: 'session', ref: 'qr-code:a' }, { type: 'session', ref: 'qr-code:b' }], createdAt: '', updatedAt: '' }] });
  const trash = createTrash(f.host);
  const folder = await trash.trashFolder('event');
  await f.db.delete('state', folder!.sessions[1]!.slot);   // gone from another tab
  assert.deepEqual(await trash.restore(folder!), { status: 'partial', missing: 1 });
  const event = (f.profile().folders as Array<{ id: string; items: Array<{ ref: string }> }>).find(x => x.id === 'event')!;
  assert.deepEqual(event.items.map(i => i.ref), ['qr-code:a'], 'no folder item points at a record that is not there');

  await f.state.save('qr-code:c', SESSION('C'));
  f.setProfile({ ...f.profile(), folders: [...(f.profile().folders as unknown[]), { id: 'other', name: 'Other', parentId: null, items: [{ type: 'session', ref: 'qr-code:c' }], createdAt: '', updatedAt: '' }] });
  const [single] = await trash.trashSessions(['qr-code:c']);
  await f.db.delete('state', single!.slot);
  assert.deepEqual(await trash.restore(single!), { status: 'gone', missing: 0 });
  const other = (f.profile().folders as Array<{ id: string; items: unknown[] }>).find(x => x.id === 'other')!;
  assert.deepEqual(other.items, [], 'no dangling folder item');
});

test('S9: the entry exists before the record moves, so another tab never finds it unowned', async () => {
  let seen: TrashEntry[] | null = null;
  const f = freshHost({ history: true, onMove: async () => { seen = (f.profile().trash as TrashEntry[] | undefined) ?? []; } });
  await f.putRecord('qr-code:old', SESSION('Old'), iso(Date.now() - 90 * DAY));
  await createTrash(f.host).trashSessions(['qr-code:old']);
  assert.equal((seen as TrashEntry[] | null)?.length, 1, 'the entry was written first');
});
