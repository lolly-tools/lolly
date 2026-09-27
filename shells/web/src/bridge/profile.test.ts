// SPDX-License-Identifier: MPL-2.0
/**
 * The profile bridge with two tabs open (bridge/profile.ts, plan 277 review R3).
 *
 * Two bridges over one in-memory store stand in for two tabs: each caches the
 * record it read, and every write goes through the store's own transaction, as
 * IndexedDB does. The Trash runs for real (lib/trash.ts over the memory state
 * API). What is pinned:
 *
 *   - with one tab, a write stores the record exactly as given, and nothing the
 *     bridge uses to track copies reaches the store;
 *   - a tab writing from an old copy (a favourite toggled the way views write)
 *     keeps what the other tab wrote since: a Trash entry keeps its folder, its
 *     label and a font's roles, so a restore puts each back;
 *   - an entry the other tab restored or deleted forever stays gone, even when
 *     the old copy changes the Trash itself;
 *   - the same holds for an old copy held inside one tab;
 *   - a record that did not come from this bridge (a backup's record for a
 *     replace) is written whole, as before;
 *   - a write tells the other tabs to drop their cached copy.
 *
 * Run directly:  node --test shells/web/src/bridge/profile.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '@lolly-tools/core/host-v1';
import { createProfileAPI, type ProfileChannel, type ProfileDb, type WebProfileAPI } from './profile.ts';
import { rebaseProfileWrite } from '../lib/profile-rebase.ts';
import { createMemoryStateDb } from '../lib/ephemeral-state.ts';
import { createStateAPI } from './state.ts';
import { createTrash, type FontTrashHooks, type TrashFontRole, type TrashHost } from '../lib/trash.ts';
import type { Folder, TrashEntry, TrashedFont, TrashedSession } from '../folders.ts';

/** The web shell's record, with the fields the folder store and the Trash add. */
type WebProfile = Profile & { folders?: Folder[]; trash?: TrashEntry[]; theme?: string; sfxVolume?: number; neurospicy?: { volume: number } };

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * One store shared by every tab, shaped like IndexedDB: values are copied on the
 * way in and out, read-write transactions run one after another, a read waits
 * for the read-write transactions opened before it, and a put can be made to
 * take time (`putMs`) or to fail once (`failNextPut`). Counts reads of the record.
 */
function memoryProfileDb(initial: WebProfile = {}, opts: { putMs?: number } = {}) {
  const data = new Map<string, unknown>([['me', structuredClone(initial)]]);
  let queue: Promise<void> = Promise.resolve();
  let recordReads = 0;
  let failNext = false;
  const read = async (key: string): Promise<unknown> => {
    if (key === 'me') recordReads++;
    return data.has(key) ? structuredClone(data.get(key)) : undefined;
  };
  const commit = async (value: unknown, key: string): Promise<void> => {
    const copy = structuredClone(value);
    if (opts.putMs) await sleep(opts.putMs);
    if (failNext) { failNext = false; throw new Error('QuotaExceededError'); }
    data.set(key, copy);
  };
  const db: ProfileDb = {
    get: async (_store, key) => { await queue; return read(key); },
    put: async (_store, value, key) => {
      const before = queue;
      let finish = (): void => {};
      queue = new Promise<void>(resolve => { finish = resolve; });
      await before;
      try { await commit(value, key); } finally { finish(); }
    },
    transaction: (_store, mode) => {
      const before = queue;
      if (mode === 'readonly') return { store: { get: async key => { await before; return read(key); }, put: undefined }, done: before };
      let finish = (): void => {};
      let fail = (_e: unknown): void => {};
      const done = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
      queue = done.catch(() => {});
      let pending = 0;
      let puts = 0;
      return {
        store: {
          get: async key => {
            await before;
            // As IndexedDB does, a transaction with nothing left to do commits.
            setTimeout(() => { if (!puts) finish(); }, 0);
            return read(key);
          },
          put: async (value, key) => {
            puts++;
            pending++;
            try { await commit(value, key); } catch (e) { fail(e); throw e; }
            if (--pending === 0) finish();
          },
        },
        done,
      };
    },
  };
  return {
    db,
    stored: (): WebProfile => (data.get('me') ?? {}) as WebProfile,
    revision: (): unknown => data.get('me:revision'),
    recordReads: (): number => recordReads,
    failNextPut: (): void => { failNext = true; },
  };
}

/** Channels that deliver to every other channel on the hub, at once or (as a
 *  browser does) in a later task after `delayMs`. */
function channelHub(delayMs?: number) {
  const members = new Set<ProfileChannel>();
  return (): ProfileChannel => {
    const channel: ProfileChannel = {
      onmessage: null,
      postMessage(message) {
        for (const other of members) {
          if (other === channel) continue;
          const deliver = (): void => other.onmessage?.(new MessageEvent('message', { data: message }));
          if (delayMs === undefined) deliver(); else setTimeout(deliver, delayMs);
        }
      },
    };
    members.add(channel);
    return channel;
  };
}

interface FakeFace { id: string; type: string; trashedAt?: string }

/** A Trash host for one tab: that tab's profile bridge, the shared saved-work store and uploads. */
function tabHost(profile: WebProfileAPI, shared: { state: TrashHost['state']; faces: Map<string, FakeFace> }): TrashHost {
  const { faces } = shared;
  return {
    profile,
    state: shared.state,
    assets: {
      async _listUserAssets() { return [...faces.values()].filter(f => !f.trashedAt).map(f => ({ id: f.id })); },
      async _deleteUserAsset(id: string) { faces.delete(id); },
      async _deleteTrashedUserAsset(id: string, trashedAt: string) {
        if (faces.get(id)?.trashedAt !== trashedAt) return false;
        faces.delete(id);
        return true;
      },
      async _setUserAssetTrashed(id: string, at: string | null, opts: { expect?: string | null } = {}) {
        const face = faces.get(id);
        if (!face || (opts.expect !== undefined && (face.trashedAt ?? null) !== opts.expect)) return false;
        if (at) face.trashedAt = at; else delete face.trashedAt;
        return true;
      },
      async _listTrashedUserAssets() {
        return [...faces.values()].filter(f => f.trashedAt).map(f => ({ id: f.id, type: f.type, name: 'Inter', family: 'Inter', trashedAt: f.trashedAt!, bytes: 10 }));
      },
    },
  };
}

/** Font hooks that record which roles a restore sets back. */
function fontHooks() {
  const restored: Array<{ family: string; roles: TrashFontRole[]; designSystemId: string | null; released?: TrashedFont['released'] }> = [];
  const hooks: FontTrashHooks = {
    async refresh() { /* no document */ },
    async restoreRoles(family, roles, designSystemId, released) {
      restored.push({ family, roles: [...roles], designSystemId, ...(released ? { released } : {}) });
      return [...roles];
    },
  };
  return { hooks, restored };
}

/** Two tabs over one store, both open (and each holding the record it read at boot). */
async function twoTabs(initial: WebProfile) {
  const store = memoryProfileDb(initial);
  const state = createStateAPI(createMemoryStateDb());
  const faces = new Map<string, FakeFace>();
  const a = createProfileAPI(store.db, { channel: null });
  const b = createProfileAPI(store.db, { channel: null });
  await a.get();
  await b.get();
  const shared = { state: state as TrashHost['state'], faces };
  return { store, state, faces, a, b, hostA: tabHost(a, shared), hostB: tabHost(b, shared) };
}

const EVENT: Folder = { id: 'event', name: 'Event', parentId: null, items: [{ type: 'session', ref: 'qr-code:poster' }], createdAt: 't0', updatedAt: 't0' };
const SESSION = { __toolId: 'qr-code', __toolVersion: '1.0.0', __label: 'Poster', url: 'https://example.test' };

/** Tab B toggles a favourite the way the views write: its cached record, then set. */
async function staleFavourite(tab: WebProfileAPI, id: string): Promise<void> {
  const p = await tab.get();
  p.favourites = [...(p.favourites ?? []), id];
  await tab.set(p);
}

test('one tab: a write stores the record exactly as given, and nothing the bridge tracks reaches the store', async () => {
  const store = memoryProfileDb({ firstname: 'Ada', favourites: ['qr-code'] });
  const api = createProfileAPI(store.db, { channel: null });
  const p = await api.get();
  p.favourites = ['qr-code', 'chart'];
  await api.set(p);
  await api.set({ ...(await api.get()), lang: 'de' });
  assert.deepEqual(store.stored(), { firstname: 'Ada', favourites: ['qr-code', 'chart'], lang: 'de' });
  assert.deepEqual(Object.getOwnPropertySymbols(store.stored()), []);
  assert.deepEqual(JSON.parse(JSON.stringify(await api.get())), store.stored(), 'the cached record reads as stored');
  assert.equal(await api.get(), await api.get(), 'reads share one cached record, as before');
});

test('R3: another tab\'s stale write keeps a Trash entry\'s folder, label and font roles, and a restore puts them back', async () => {
  const t = await twoTabs({ folders: [structuredClone(EVENT)] });
  await t.state.save('qr-code:poster', SESSION);
  t.faces.set('user/fonts/inter/0', { id: 'user/fonts/inter/0', type: 'font' });
  const fonts = fontHooks();
  const trashA = createTrash(t.hostA, { fonts: fonts.hooks });

  // Tab A deletes the creation (renamed in Projects) and the font family.
  const [entry] = await trashA.trashSessions(['qr-code:poster'], () => 'Poster FINAL');
  const font = await trashA.trashFont({ family: 'Inter', assetIds: ['user/fonts/inter/0'], roles: ['brand', 'display'], designSystemId: 'ds-1', released: { brand: 'SUSE', display: '' } });
  assert.ok(entry && font);

  // Tab B, open since before, stars a tool from the record it cached at boot.
  await staleFavourite(t.b, 'chart');

  const stored = t.store.stored();
  assert.deepEqual(stored.favourites, ['chart'], 'tab B\'s change is stored');
  assert.deepEqual(stored.trash, [font, entry], 'tab A\'s entries survive whole');
  assert.deepEqual(stored.folders?.[0]?.items, [], 'the creation stays out of its folder while in the Trash');

  const listed = await trashA.list();
  const session = listed.find((e): e is TrashedSession => e.kind === 'session');
  assert.equal(session?.parentId, 'event', 'the entry still knows its folder');
  assert.equal(session?.label, 'Poster FINAL', 'and its label override');
  assert.deepEqual(await trashA.restore(session!), { status: 'restored', missing: 0 });
  assert.deepEqual(t.store.stored().folders?.[0]?.items, [{ type: 'session', ref: 'qr-code:poster' }], 'restored into its folder, not the top level');

  const fontEntry = (await trashA.list()).find((e): e is TrashedFont => e.kind === 'font');
  assert.deepEqual(await trashA.restore(fontEntry!), { status: 'restored', missing: 0 });
  assert.deepEqual(fonts.restored, [{ family: 'Inter', roles: ['brand', 'display'], designSystemId: 'ds-1', released: { brand: 'SUSE', display: '' } }], 'the font\'s roles are set back');
  assert.deepEqual(t.store.stored().favourites, ['chart']);
});

test('R3: an entry tab A restored or deleted forever is not brought back by tab B\'s stale write', async () => {
  const t = await twoTabs({});
  await t.state.save('qr-code:kept', SESSION);
  await t.state.save('qr-code:restored', SESSION);
  await t.state.save('qr-code:purged', SESSION);
  const trashA = createTrash(t.hostA);
  await trashA.trashSessions(['qr-code:kept', 'qr-code:restored', 'qr-code:purged']);
  // Tab B reads the Trash as it is now, and keeps that copy.
  t.b.bust();
  const staleB = await t.b.get() as WebProfile;
  assert.equal(staleB.trash?.length, 3);

  const entries = await trashA.list();
  const bySlot = (slot: string): TrashEntry => entries.find(e => e.kind === 'session' && e.originalSlot === slot)!;
  assert.equal((await trashA.restore(bySlot('qr-code:restored'))).status, 'restored');
  assert.equal(await trashA.purge(bySlot('qr-code:purged')), 'purged');

  // A write from the old copy that leaves the Trash alone...
  await t.b.set({ ...staleB, favourites: ['chart'] });
  assert.deepEqual(t.store.stored().trash?.map(e => e.kind === 'session' && e.originalSlot), ['qr-code:kept']);
  // ...and one that changes the Trash itself from that old copy.
  const own: TrashedSession = { kind: 'session', slot: '__trash__:@1:qr-code:other', originalSlot: 'qr-code:other', label: 'Other', parentId: null, deletedAt: new Date(1).toISOString() };
  await t.b.set({ ...staleB, trash: [own, ...(staleB.trash ?? [])] } as WebProfile);
  assert.deepEqual(t.store.stored().trash?.map(e => e.kind === 'session' && e.originalSlot), ['qr-code:other', 'qr-code:kept']);
  assert.deepEqual(t.store.stored().favourites, ['chart']);
  assert.deepEqual((await t.state.list()).map(r => r.slot).filter(s => !s.startsWith('__trash__')), ['qr-code:restored'], 'the restored creation is live, once');
});

test('R3: an old copy held inside one tab does not undo a later write in that tab', async () => {
  const store = memoryProfileDb({ favourites: ['qr-code'] });
  const api = createProfileAPI(store.db, { channel: null });
  const held = await api.get() as WebProfile;             // a view keeps the record it read at mount
  api.bust();                                            // the Trash reads the stored record afresh
  const fresh = await api.get() as WebProfile;
  await api.set({ ...fresh, trash: [{ kind: 'asset', id: 'user/a', label: 'A', parentId: null, deletedAt: 't1' }] } as WebProfile);
  await api.set({ ...held, favouriteProjects: ['event'] });
  assert.deepEqual(store.stored(), {
    favourites: ['qr-code'],
    trash: [{ kind: 'asset', id: 'user/a', label: 'A', parentId: null, deletedAt: 't1' }],
    favouriteProjects: ['event'],
  });
});

test('two writes started together in one tab both hold', async () => {
  const store = memoryProfileDb({ firstname: 'Ada' });
  const api = createProfileAPI(store.db, { channel: null });
  const p = await api.get();
  await Promise.all([api.set({ ...p, lang: 'de' }), api.set({ ...p, favourites: ['chart'] })]);
  assert.deepEqual(store.stored(), { firstname: 'Ada', lang: 'de', favourites: ['chart'] });
});

test('a record that did not come from the bridge is written whole, as before', async () => {
  const store = memoryProfileDb({ firstname: 'Ada', favourites: ['qr-code'] });
  const a = createProfileAPI(store.db, { channel: null });
  const b = createProfileAPI(store.db, { channel: null });
  await b.get();
  await a.set({ ...(await a.get()), lang: 'de' });
  // A sync apply replaces the record with the synced copy.
  await b.set({ firstname: 'Ada Lovelace' });
  assert.deepEqual(store.stored(), { firstname: 'Ada Lovelace' });
  // A JSON copy of a record carries no link either.
  await b.set({ ...JSON.parse(JSON.stringify(await b.get())), lang: 'fr' });
  assert.deepEqual(store.stored(), { firstname: 'Ada Lovelace', lang: 'fr' });
});

test('a write tells the other tabs to drop their cached copy', async () => {
  const hub = channelHub();
  const store = memoryProfileDb({ favourites: [] });
  const a = createProfileAPI(store.db, { channel: hub() });
  const b = createProfileAPI(store.db, { channel: hub() });
  const before = await b.get();
  await a.set({ ...(await a.get()), favourites: ['chart'] });
  const after = await b.get();
  assert.notEqual(after, before, 'tab B read the store again');
  assert.deepEqual(after.favourites, ['chart']);
  // Tab B's own next write is then made from the current record, and keeps tab A's change.
  await b.set({ ...after, lang: 'de' });
  assert.deepEqual(store.stored(), { favourites: ['chart'], lang: 'de' });
});

test('subscribers hear the record as stored', async () => {
  const store = memoryProfileDb({ favourites: ['a'] });
  const a = createProfileAPI(store.db, { channel: null });
  const b = createProfileAPI(store.db, { channel: null });
  await b.get();
  await a.set({ ...(await a.get()), lang: 'de' });
  const heard: Profile[] = [];
  b.subscribe(p => heard.push(p));
  await b.set({ ...(await b.get()), favourites: ['a', 'b'] });
  assert.deepEqual(JSON.parse(JSON.stringify(heard)), [{ favourites: ['a', 'b'], lang: 'de' }]);
});

test('B1: a view that keeps its record and writes it twice, with another write in between, keeps both changes', async () => {
  // The gallery keeps the record it read at mount and stars and unstars on that
  // same object (lib/favourites.ts); the theme is written in between.
  const store = memoryProfileDb({ favourites: [] });
  const api = createProfileAPI(store.db, { channel: null });
  const gallery = await api.get();
  await api.set({ ...(await api.get()), theme: 'dark' } as WebProfile);
  gallery.favourites = ['chart'];
  await api.set(gallery);
  gallery.favourites = [];
  await api.set(gallery);
  assert.deepEqual(store.stored(), { favourites: [], theme: 'dark' }, 'the unstar is kept and the theme stays');
  gallery.favourites = ['qr-code'];
  await api.set(gallery);
  assert.deepEqual(store.stored(), { favourites: ['qr-code'], theme: 'dark' });
});

test('B2: a slider that writes on every input event ends where the person left it', async () => {
  const store = memoryProfileDb({ neurospicy: { volume: 0.5 } }, { putMs: 6 });
  const api = createProfileAPI(store.db, { channel: null });
  await api.get();
  const persist = async (volume: number): Promise<void> => {
    const p = await api.get();
    await api.set({ ...p, neurospicy: { volume } } as WebProfile);
  };
  for (const values of [[0.55, 0.6, 0.55, 0.5], [0.51, 0.52, 0.53, 0.52, 0.51]]) {
    const pending: Promise<void>[] = [];
    for (const v of values) { pending.push(persist(v)); await sleep(2); }
    await Promise.all(pending);
    assert.deepEqual(store.stored(), { neurospicy: { volume: values.at(-1) } }, `after ${values.join(', ')}`);
    assert.deepEqual((await api.get() as WebProfile).neurospicy, { volume: values.at(-1) }, 'and the cache agrees');
  }
});

test('B2: a star and an unstar on the held record while the first write is still committing', async () => {
  const store = memoryProfileDb({ favourites: [] }, { putMs: 8 });
  const api = createProfileAPI(store.db, { channel: null });
  const held = await api.get();
  held.favourites = ['chart'];
  const first = api.set(held);
  await sleep(2);
  held.favourites = [];
  const second = api.set(held);
  await Promise.all([first, second]);
  assert.deepEqual(store.stored().favourites, []);
  assert.deepEqual((await api.get()).favourites, []);
});

test('S1: a read between two overlapping writes sees the newest write, never an older one', async () => {
  const store = memoryProfileDb({ lang: 'en' }, { putMs: 6 });
  const api = createProfileAPI(store.db, { channel: null });
  const p = await api.get();
  const first = api.set({ ...p, lang: 'de' });
  await sleep(1);
  const second = api.set({ ...(await api.get()), lang: 'fr' });
  await first;
  assert.equal((await api.get()).lang, 'fr', 'the first write settling does not put its record back in the cache');
  await second;
  assert.equal(store.stored().lang, 'fr');
});

test('a write that fails stores nothing, and a record made from it meanwhile does not bring the failed change back', async () => {
  const store = memoryProfileDb({ favourites: [] }, { putMs: 4 });
  const api = createProfileAPI(store.db, { channel: null });
  const held = await api.get();
  store.failNextPut();
  const failing = api.set({ ...held, favourites: ['x'] });
  // Another view builds its record from the cache while the write is under way.
  const during = { ...(await api.get()), lang: 'de' };
  await assert.rejects(failing, /QuotaExceededError/);
  assert.deepEqual(store.stored(), { favourites: [] });
  assert.deepEqual((await api.get()).favourites, [], 'the cache is read again from the store');
  // That record carries the failed change; only its own change is written.
  await api.set(during);
  assert.deepEqual(store.stored(), { favourites: [], lang: 'de' });
  // The record the failed write was made from still writes from its own base.
  held.favourites = ['y'];
  await api.set(held);
  assert.deepEqual(store.stored(), { favourites: ['y'], lang: 'de' });
});

test('a record changed in place whose write fails is written whole by its next write', async () => {
  const store = memoryProfileDb({ favourites: [] });
  const api = createProfileAPI(store.db, { channel: null });
  const held = await api.get();
  held.favourites = ['x'];
  store.failNextPut();
  await assert.rejects(api.set(held), /QuotaExceededError/);
  await api.set(held);                                     // the view retries with the same record
  assert.deepEqual(store.stored(), { favourites: ['x'] });
});

test('a channel notice that arrives late changes nothing about what is stored', async () => {
  const hub = channelHub(5);
  const store = memoryProfileDb({ favourites: [] });
  const a = createProfileAPI(store.db, { channel: hub() });
  const b = createProfileAPI(store.db, { channel: hub() });
  await b.get();
  await a.set({ ...(await a.get()), theme: 'dark' } as WebProfile);
  // Tab B writes before the notice reaches it, from its stale cache.
  await staleFavourite(b, 'chart');
  await sleep(10);
  assert.deepEqual(store.stored(), { favourites: ['chart'], theme: 'dark' });
  assert.deepEqual(JSON.parse(JSON.stringify(await b.get())), store.stored(), 'and once the notice lands, tab B reads the store');
});

test('S3: a write with nothing written since its base reads only the revision, never the record', async () => {
  const store = memoryProfileDb({ firstname: 'Ada' });
  const api = createProfileAPI(store.db, { channel: null });
  await api.set({ ...(await api.get()), lang: 'de' });     // the first write stores a revision
  const reads = store.recordReads();
  for (let i = 0; i < 5; i++) await api.set({ ...(await api.get()), sfxVolume: i } as WebProfile);
  assert.equal(store.recordReads(), reads, 'no write read the record');
  assert.equal(typeof store.revision(), 'string', 'the revision is stored beside the record');
  assert.deepEqual(Object.keys(store.stored()), ['firstname', 'lang', 'sfxVolume'], 'and not inside the record');
});

test('a store written before revisions existed: the first write compares the records instead', async () => {
  const store = memoryProfileDb({ favourites: ['qr-code'] });
  const a = createProfileAPI(store.db, { channel: null });
  const b = createProfileAPI(store.db, { channel: null });
  await a.get();
  await b.get();
  assert.equal(store.revision(), undefined);
  await a.set({ ...(await a.get()), lang: 'de' });         // no revision to compare: the record matches the base
  await staleFavourite(b, 'chart');                         // tab B's base has no revision: compared, and rebased
  assert.deepEqual(store.stored(), { favourites: ['qr-code', 'chart'], lang: 'de' });
});

test('the rebase loads on first use: a write that needs it before it has loaded waits for it and starts again', async () => {
  const store = memoryProfileDb({ favourites: [] });
  let release = (): void => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let loads = 0;
  const loadRebase = async (): Promise<typeof rebaseProfileWrite> => { loads++; await gate; return rebaseProfileWrite; };
  const a = createProfileAPI(store.db, { channel: null, loadRebase });
  const b = createProfileAPI(store.db, { channel: null, loadRebase });
  await b.get();
  await a.set({ ...(await a.get()), theme: 'dark' } as WebProfile);
  const pending = staleFavourite(b, 'chart');
  await sleep(5);
  assert.deepEqual(store.stored(), { favourites: [], theme: 'dark' }, 'nothing is written while the rebase loads');
  release();
  await pending;
  assert.deepEqual(store.stored(), { favourites: ['chart'], theme: 'dark' });
  await a.set({ ...(await a.get()), lang: 'de' } as WebProfile);
  await staleFavourite(b, 'qr-code');
  assert.deepEqual(store.stored(), { favourites: ['chart', 'qr-code'], theme: 'dark', lang: 'de' });
  assert.equal(loads, 2, 'each tab starts loading the rebase at its first write, once');
});

test('when the rebase cannot be loaded, the record is written whole, as before', async () => {
  const store = memoryProfileDb({ favourites: [] });
  const loadRebase = async (): Promise<null> => null;
  const a = createProfileAPI(store.db, { channel: null, loadRebase });
  const b = createProfileAPI(store.db, { channel: null, loadRebase });
  await b.get();
  await a.set({ ...(await a.get()), theme: 'dark' } as WebProfile);
  await staleFavourite(b, 'chart');
  assert.deepEqual(store.stored(), { favourites: ['chart'] });
});
