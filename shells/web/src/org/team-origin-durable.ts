// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-origin-durable - where a device copy of a team document came from, kept
 * across restarts (plan 75 J6 step 2, G17).
 *
 * org/team-session-origin.ts holds the origin of the document on screen for one page
 * load, with a sessionStorage mirror for a reload of the same tab. That is not enough
 * for the journey people actually take: edit a team document, close the tab or quit
 * the app, come back tomorrow and reopen the device copy from Projects. This file keeps
 * one record per device copy (the creation's `slot`) in IndexedDB, so the reopened copy
 * is the team document again, at the revision it was opened at, and Save still means
 * that session and still refuses to overwrite a newer one.
 *
 * Bound to a workspace and an account, and never used across either:
 *
 *  - a record is keyed by the workspace origin, a digest of the account id (never the
 *    id itself: a dev or proxy sign-in's id can carry an email address or a user name)
 *    and the slot, and is read only under the same workspace and the same account;
 *  - every record goes the moment the person does: a sign-out, Sign out on all devices
 *    and an account change (org/index.ts) and Leave (lib/instance-leave.ts) drop them
 *    all ({@link dropDurableTeamOrigins}), without any copy being opened;
 *  - and as a second line, a record found under a sign-out (the workspace's signed-out
 *    mark), another account or another workspace is dropped when it is found.
 *
 * The workspace and account are read from what org/index.ts already keeps on this
 * device (the instance base, and the member org-config cache with its session block),
 * by their documented keys, as lib/instance-leave.ts reads them, so this file imports
 * no part of the control plane. Pure data and IndexedDB: loaded lazily by
 * org/team-session-origin.ts only when a team document is on screen or a device copy
 * with a record is opened.
 */
import { getInstanceBase } from '../lib/instance.ts';
import type { TeamRole } from '../lib/session-source.ts';
import { TEAM_ORIGINS_DB, TEAM_ORIGINS_MARK, dropTeamOriginRecords } from '../lib/team-origin-records.ts';

/** One device copy's origin, as stored. */
export interface DurableTeamOrigin {
  /** `${workspace}\n${account}\n${slot}`. */
  key: string;
  workspace: string;
  /** A digest of the account id ({@link durableIdentity}), never the id. */
  account: string;
  /** The device creation's slot: what Projects reopens. */
  slot: string;
  toolId: string;
  sessionId: string;
  projectId?: string;
  rev?: number;
  label?: string;
  projectName?: string;
  role?: TeamRole;
  /** When the record was last written (ms). */
  at: number;
}

/** The fields a caller hands in; identity and key are filled in here. */
export type DurableTeamOriginInput = Omit<DurableTeamOrigin, 'key' | 'workspace' | 'account' | 'at'>;

/** Who is signed in to which workspace on this device, as far as this device knows. */
export interface DurableIdentity {
  workspace: string;
  account: string;
}

/** The storage the records live in. IndexedDB in a browser; a Map in a test. */
export interface DurableBackend {
  get(key: string): Promise<DurableTeamOrigin | undefined>;
  put(record: DurableTeamOrigin): Promise<void>;
  delete(key: string): Promise<void>;
  all(): Promise<DurableTeamOrigin[]>;
  /** Remove every record. */
  clear(): Promise<void>;
}

/** Set while any record may exist, so opening a device copy costs nothing otherwise. */
export const DURABLE_MARK_KEY = TEAM_ORIGINS_MARK;
const DB_NAME = TEAM_ORIGINS_DB;
const STORE = 'origins';

/** The roles that may save to a session. Any other role, one this shell does not know
 *  included, keeps no record: it fails closed, like the view-only layer. */
const EDIT_ROLES: readonly string[] = ['owner', 'manager', 'editor'];

/** The workspace scope org/index.ts keys its caches by. */
function scope(): string {
  return getInstanceBase() || 'same-origin';
}

/** This device's workspace origin: the instance base, or the page's own origin. */
function workspaceOrigin(): string {
  return getInstanceBase() || globalThis.location?.origin || '';
}

function readLocal(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

/**
 * The account as a record stores it: SHA-256 over the workspace and the account id, in
 * hex. Null without WebCrypto (an insecure page), and then nothing is kept.
 */
async function accountDigest(workspace: string, sub: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const bytes = await subtle.digest('SHA-256', new TextEncoder().encode(`lolly-team-origin\n${workspace}\n${sub}`));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/**
 * The signed-in member of this workspace, from the org-config cache org/index.ts keeps
 * under `lolly:org-config:<scope>` (removed on sign-out and Leave, replaced when another
 * member signs in). Its session block carries the account id as `sub`; the identity
 * holds a digest of that id. Null when no member is known, or a sign-out was recorded since.
 */
export async function durableIdentity(): Promise<DurableIdentity | null> {
  if (readLocal(`lolly:signed-out:${scope()}`) === '1') return null;
  let sub: unknown;
  try {
    const raw = readLocal(`lolly:org-config:${scope()}`);
    if (!raw) return null;
    const session = (JSON.parse(raw) as { config?: { session?: { sub?: unknown; user?: { sub?: unknown } } } }).config?.session;
    sub = session?.sub ?? session?.user?.sub;
  } catch {
    return null;
  }
  const workspace = workspaceOrigin();
  if (typeof sub !== 'string' || !sub || !workspace) return null;
  const account = await accountDigest(workspace, sub);
  return account ? { workspace, account } : null;
}

/** The record key for one slot under one identity. Pure. */
export function durableKey(identity: DurableIdentity, slot: string): string {
  return `${identity.workspace}\n${identity.account}\n${slot}`;
}

// ── IndexedDB backend ─────────────────────────────────────────────────────────

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const idb = globalThis.indexedDB;
      if (!idb) { reject(new Error('IndexedDB is unavailable')); return; }
      const open = idb.open(DB_NAME, 1);
      open.onupgradeneeded = () => { open.result.createObjectStore(STORE, { keyPath: 'key' }); };
      open.onsuccess = () => {
        const conn = open.result;
        // A drop from this tab or another (lib/team-origin-records.ts) deletes the
        // database: let go at once, so the delete is never held up by this page.
        conn.onversionchange = () => { conn.close(); dbPromise = null; };
        resolve(conn);
      };
      open.onerror = () => reject(open.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await db()).transaction(STORE, mode).objectStore(STORE);
  return request(work(store));
}

const indexedDbBackend: DurableBackend = {
  get: (key) => tx('readonly', (s) => s.get(key) as IDBRequest<DurableTeamOrigin | undefined>),
  put: async (record) => { await tx('readwrite', (s) => s.put(record)); },
  delete: async (key) => { await tx('readwrite', (s) => s.delete(key)); },
  all: () => tx('readonly', (s) => s.getAll() as IDBRequest<DurableTeamOrigin[]>),
  clear: async () => {
    const open = dbPromise;
    dbPromise = null;
    if (open) await open.then((conn) => conn.close(), () => undefined);
    await dropTeamOriginRecords();
  },
};

let backend: DurableBackend = indexedDbBackend;

/** TEST-ONLY: swap the storage (a Map-backed one), or restore IndexedDB with null. */
export function _setDurableBackendForTests(next: DurableBackend | null): void {
  backend = next ?? indexedDbBackend;
}

function mark(on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(DURABLE_MARK_KEY, '1');
    else globalThis.localStorage?.removeItem(DURABLE_MARK_KEY);
  } catch { /* storage blocked: the next open looks once, which is all the mark saves */ }
}

/** True when this device may hold a record (cheap, synchronous). */
export function mayHoldDurableTeamOrigins(): boolean {
  return readLocal(DURABLE_MARK_KEY) === '1';
}

// ── Records ─────────────────────────────────────────────────────────────────

/**
 * Keep the origin of the device copy at `input.slot` for the signed-in member. A no-op
 * without a known member (nothing to bind it to) or for a viewer, who cannot save to
 * the session and copies instead. Resolves whether a record was written.
 */
export async function rememberDurableTeamOrigin(input: DurableTeamOriginInput): Promise<boolean> {
  if (!input.slot || !input.sessionId || !input.toolId || (input.role !== undefined && !EDIT_ROLES.includes(input.role))) return false;
  const identity = await durableIdentity();
  if (!identity) return false;
  const record: DurableTeamOrigin = { ...input, ...identity, key: durableKey(identity, input.slot), at: Date.now() };
  try {
    await backend.put(record);
    mark(true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Drop every record that may not be used any more: all of them for this workspace
 * after a sign-out (no member known), those of another account on this workspace, and
 * those of another workspace. Resolves the records that are still usable.
 */
async function prune(identity: DurableIdentity | null): Promise<DurableTeamOrigin[]> {
  const all = await backend.all();
  const keep: DurableTeamOrigin[] = [];
  for (const rec of all) {
    const usable = !!identity && rec.workspace === identity.workspace && rec.account === identity.account;
    if (usable) keep.push(rec);
    else await backend.delete(rec.key).catch(() => { /* dropped on the next look */ });
  }
  if (!keep.length) mark(false);
  return keep;
}

/**
 * The origin of the device copy at `slot` opened in `toolId`, for the member signed in
 * now, or null. Prunes what may no longer be used on the way.
 */
export async function findDurableTeamOrigin(toolId: string, slot: string): Promise<DurableTeamOrigin | null> {
  if (!slot || !toolId) return null;
  try {
    const identity = await durableIdentity();
    const usable = await prune(identity);
    if (!identity) return null;
    const key = durableKey(identity, slot);
    const found = usable.find((rec) => rec.key === key);
    return found && found.toolId === toolId ? found : null;
  } catch {
    return null;
  }
}

/** Forget the record for `slot` (the copy was made its own, or its session is gone). */
export async function forgetDurableTeamOrigin(slot: string): Promise<void> {
  const identity = await durableIdentity();
  if (!identity || !slot) return;
  try { await backend.delete(durableKey(identity, slot)); } catch { /* nothing to forget */ }
}

/**
 * Drop every record and the mark: the person is no longer the one signed in here (a
 * sign-out, Sign out on all devices, another account, Leave). Never rejects; when the
 * storage cannot be cleared, the records left are inert (no mark, and no member they
 * could be found under) and the next look drops them.
 */
export async function dropDurableTeamOrigins(): Promise<void> {
  mark(false);
  try { await backend.clear(); } catch { /* see above */ }
}
