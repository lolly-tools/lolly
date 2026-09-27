// SPDX-License-Identifier: MPL-2.0
/**
 * ProfileAPI - user profile (firstname, headshot, etc).
 *
 * Single record at key 'me'. Headshot is stored as an AssetRef pointing into
 * the user-assets object store. Subscriptions let tools (or the host UI) react
 * when the user edits their profile mid-session.
 *
 * Several tabs share the record, and every view writes the whole of it: read,
 * change a field, write back. So that a record made from an old copy never
 * undoes a change written since (plan 277 review R3: a Trash entry, a folder
 * move, a favourite), whether the change came from another tab or from another
 * view in this tab:
 *
 *   - every write stores a new revision id beside the record ('me:revision'), in
 *     the same transaction;
 *   - every record this API hands out carries a private link to its base: the
 *     revision it was made from and that record as JSON. A record passed to
 *     set() becomes its own base from then on, so a view that keeps its record
 *     and writes it again compares with what it wrote last, and a record read
 *     while that write is under way is made from the write;
 *   - a write whose base revision is the stored revision (always the case with
 *     one view writing at a time) stores the record exactly as given, as before,
 *     and reads nothing but the revision id;
 *   - otherwise the stored record is read, and only the fields this writer
 *     changed since its base are applied onto it, with lists such as `trash` and
 *     `folders` combined entry by entry (lib/profile-rebase.ts).
 *
 * The link is a symbol-keyed property, so a record built with `{ ...profile }`
 * keeps the link, while IndexedDB, JSON and postMessage never see the link. A
 * record that carries no link (a backup's record for a replace, a JSON copy) is
 * written whole, as every write was before. After each write the other tabs are
 * told on a BroadcastChannel to drop their cached copy.
 *
 * Limits, stated rather than hidden:
 *   - two writes started together from one record that set one field to two
 *     values: the second compares with the same base as the first, and when it
 *     puts the field back to its base value that reads as "left alone", so the
 *     first write's value stays;
 *   - a tab still running an older build writes the record without a new
 *     revision id, so until it reloads its writes can be overwritten as before.
 */

import type { Profile } from '@lolly-tools/core/host-v1';
// Type only: the rebase itself loads on first use, off the boot path (it is
// needed only when another writer changed the record, see `decide`).
import type { rebaseProfileWrite } from '../lib/profile-rebase.ts';

const KEY = 'me';
/** The revision id of the stored record, a sibling key in the same store. */
const REVISION_KEY = 'me:revision';

/** One transaction on the profile store (the idb library's shape). idb types
 *  `put` as absent on a read-only transaction, hence the undefined. */
export interface ProfileTx {
  store: {
    get(key: string): Promise<unknown>;
    put: ((value: unknown, key: string) => Promise<unknown>) | undefined;
  };
  done: Promise<void>;
}

/** The slice of the idb database this API touches (the 'profile' store). */
export interface ProfileDb {
  get(store: 'profile', key: string): Promise<unknown>;
  put(store: 'profile', value: unknown, key: string): Promise<unknown>;
  /** Present on the real database: the record and its revision are then read
   *  together, and a write reads and replaces both with no other tab's write in
   *  between. Without it each step is separate. */
  transaction?(store: 'profile', mode: 'readonly' | 'readwrite'): ProfileTx;
}

/** The slice of BroadcastChannel this API uses. */
export interface ProfileChannel {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

/** HostV1's ProfileAPI plus the host-UI setter/cache-buster/subscription. */
export interface WebProfileAPI {
  get(): Promise<Profile>;
  set(profile: Profile): Promise<void>;
  bust(): void;
  subscribe(fn: (profile: Profile) => void): () => void;
}

/** What a record was made from: the stored revision (null when it matches no
 *  stored revision) and the record as JSON. */
interface Base { rev: string | null; json: string }

/** The property that links a handed-out record to its base. Not exported, and
 *  its value is an empty token, so no caller can reach or change the base. */
const BASE = Symbol('lolly.profile.base');

const isProfile = (v: unknown): v is Profile => typeof v === 'object' && v !== null && !Array.isArray(v);
const asProfile = (v: unknown): Profile => (isProfile(v) ? v : {});

/** The record as JSON, or null when it cannot be written as JSON. JSON because a
 *  profile is JSON-shaped (a backup writes it as profile.json) and turning it into
 *  text costs a third of a structured copy. */
function toJson(profile: Profile): string | null {
  try { return JSON.stringify(profile); } catch { return null; }
}

function newRevision(): string {
  const c: { randomUUID?(): string } | undefined = globalThis.crypto;
  return c?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type Rebase = typeof rebaseProfileWrite;
let rebaseModule: Promise<Rebase | null> | null = null;

/** Load lib/profile-rebase.ts once; null when it cannot be loaded (a failed load
 *  can be tried again later). */
function loadRebase(): Promise<Rebase | null> {
  if (!rebaseModule) {
    rebaseModule = import('../lib/profile-rebase.ts').then(
      m => m.rebaseProfileWrite,
      () => { rebaseModule = null; return null; },
    );
  }
  return rebaseModule;
}

/** The channel other tabs listen on, or null where there is none. */
function openChannel(): ProfileChannel | null {
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    const channel: BroadcastChannel & { unref?(): void } = new BroadcastChannel('lolly:profile');
    // Node's channel keeps a test process alive; a browser has no unref.
    channel.unref?.();
    return channel;
  } catch { return null; }
}

export function createProfileAPI(db: ProfileDb, opts: { channel?: ProfileChannel | null; loadRebase?: () => Promise<Rebase | null> } = {}): WebProfileAPI {
  const listeners = new Set<(profile: Profile) => void>();
  let rebase: Rebase | null = null;
  let loading: Promise<void> | null = null;
  function ensureRebase(): Promise<void> {
    if (!loading) {
      loading = (opts.loadRebase ?? loadRebase)().then(
        fn => { rebase = fn; if (!fn) loading = null; },
        () => { loading = null; },
      );
    }
    return loading;
  }
  let cache: Profile | null = null;
  // Counts writes started, so only the latest one to start sets the cache when
  // it settles: an older write settling later never brings back an older record.
  let seq = 0;
  // Token → base. Weak, so a base lives exactly as long as some record links to the token.
  const bases = new WeakMap<object, Base>();
  const channel = opts.channel === undefined ? openChannel() : opts.channel;
  if (channel) channel.onmessage = () => { cache = null; };

  /** `record` linked to `base` (a copy when the record cannot take the link). */
  function link(record: Profile, base: Base): Profile {
    const out = Object.isExtensible(record) ? record : { ...record };
    const token = Object.freeze({});
    bases.set(token, base);
    Reflect.set(out, BASE, token);
    return out;
  }

  function baseOf(profile: Profile): Base | undefined {
    const token: unknown = Reflect.get(profile, BASE);
    return typeof token === 'object' && token !== null ? bases.get(token) : undefined;
  }

  /** The stored record and its revision, read together. */
  async function load(): Promise<{ record: Profile; rev: string | null }> {
    const tx = db.transaction?.('profile', 'readonly');
    if (tx) tx.done.catch(() => { /* a failed read rejects below */ });
    const [record, rev] = tx
      ? await Promise.all([tx.store.get(KEY), tx.store.get(REVISION_KEY)])
      : await Promise.all([db.get('profile', KEY), db.get('profile', REVISION_KEY)]);
    return { record: asProfile(record), rev: typeof rev === 'string' ? rev : null };
  }

  async function read(): Promise<Profile> {
    if (cache) return cache;
    const { record, rev } = await load();
    // A write that started while this read waited is newer than what it read.
    if (cache) return cache;
    const json = toJson(record);
    cache = json === null ? record : link(record, { rev, json });
    return cache;
  }

  /**
   * What to store for `profile`, made from `base`. Reads the stored revision
   * and, only when it moved since the base, the stored record. Runs inside the
   * write's transaction, and marks `own` as matching no stored revision before
   * the put when the record is rebased, so a write that starts next already sees
   * that a record made from this one lacks what the rebase added. Null when a
   * rebase is needed and its module is not loaded yet: nothing can wait inside
   * the transaction, so the write loads it and starts again. When the module
   * cannot be loaded at all, the record is written whole, as before.
   */
  async function decide(profile: Profile, base: Base | undefined, own: Base | null, readRev: () => Promise<unknown>, readRecord: () => Promise<unknown>, mayWait: boolean): Promise<{ stored: Profile; json: string | null } | null> {
    const same = { stored: profile, json: own ? own.json : null };
    if (!base) return same;
    const storedRev = await readRev();
    if (base.rev !== null && storedRev === base.rev) return same;
    const current = asProfile(await readRecord());
    if (toJson(current) === base.json) return same;
    if (!rebase) return mayWait ? null : same;
    const merged = rebase(asProfile(JSON.parse(base.json)), current, profile);
    const json = toJson(merged);
    if (own && json !== own.json) own.rev = null;
    return { stored: merged, json };
  }

  async function write(profile: Profile): Promise<void> {
    const base = baseOf(profile);
    const mine = ++seq;
    const rev = newRevision();
    const prior: unknown = Reflect.get(profile, BASE);
    // This record becomes its own base now: a record made from it while the
    // write is under way, or written again later, is compared with what this
    // write sends, not with what it was first read from.
    const ownJson = toJson(profile);
    const own: Base | null = ownJson === null ? null : { rev, json: ownJson };
    const record = own ? link(profile, own) : profile;
    const token: unknown = Reflect.get(record, BASE);
    cache = record;
    if (base && !rebase) void ensureRebase();
    let result: { stored: Profile; json: string | null } | null = null;
    try {
      for (let attempt = 0; !result; attempt++) {
        const mayWait = attempt === 0;
        const tx = db.transaction?.('profile', 'readwrite');
        if (tx?.store.put) {
          tx.done.catch(() => { /* a failed write rejects below */ });
          result = await decide(profile, base, own, () => tx.store.get(REVISION_KEY), () => tx.store.get(KEY), mayWait);
          if (result) await Promise.all([tx.store.put(result.stored, KEY), tx.store.put(rev, REVISION_KEY), tx.done]);
          else await tx.done;
        } else {
          result = await decide(profile, base, own, () => db.get('profile', REVISION_KEY), () => db.get('profile', KEY), mayWait);
          if (result) {
            await db.put('profile', result.stored, KEY);
            await db.put('profile', rev, REVISION_KEY);
          }
        }
        if (!result) await ensureRebase();
      }
    } catch (error) {
      // Nothing was stored: the record goes back to its own base (unless a later
      // write has linked it since), a record made from it meanwhile never counts
      // as current, and the cache is read again.
      if (own) own.rev = null;
      if (record === profile && Reflect.get(profile, BASE) === token) Reflect.set(profile, BASE, prior);
      if (mine === seq) cache = null;
      throw error;
    }
    const { stored, json } = result;
    // Rebased: the cache takes the record stored, which the given record is not.
    const settled = stored === profile ? record : json === null ? stored : link(stored, { rev, json });
    if (mine === seq) cache = settled;
    try { channel?.postMessage('changed'); } catch { /* channel closed */ }
    listeners.forEach(fn => {
      try { fn(settled); } catch (e) { console.error(e); }
    });
  }

  return {
    get: () => read(),
    // Host UI uses this - not exposed to tools but kept on the same object for simplicity.
    set: write,
    bust() { cache = null; },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
