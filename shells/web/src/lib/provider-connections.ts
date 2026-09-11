// SPDX-License-Identifier: MPL-2.0
/**
 * provider-connections - the custody store behind /profile's Connected
 * services (plans/129). One record per provider kind, holding what the USER
 * chose to keep on this device:
 *
 *   - OAuth kinds (dropbox, o365): the account label always; the REFRESH TOKEN
 *     only when the user opted into "stay connected on this device". The
 *     session-only default keeps the device tokenless at rest - exactly the
 *     gdrive stance - with access tokens living in the in-memory cache below.
 *   - Credential kinds (s3, webdav): the user's own endpoint + keys, entered by
 *     them in /profile. Device-local by definition; Lolly never sees them
 *     server-side because there is no server in the path.
 *
 * WHERE IT LIVES AND WHY THAT IS THE PRIVACY STORY: the IndexedDB 'profile' KV
 * store, key 'provider-connections' - the offline-parts/pin-map neighbourhood.
 * The portable backup (src/data-transfer.ts exportBackup) is an ALLOWLIST
 * (profile record, sessions, uploads, PREF_KEYS) that never reads this key, so
 * connections and their secrets NEVER travel in a backup zip; "Clear all my
 * data" and Disconnect both wipe them. Session-only (persist:false) records are
 * held in memory only and vanish on reload by design.
 */

import { openDB } from '../bridge/db.ts';

export interface ProviderConnection {
  /** Provider kind, the lolly-work vocabulary ('dropbox' | 'o365' | 's3' | 'webdav'). */
  kind: string;
  /** Human label for the /profile row: an email, a handle, a bucket. */
  account: string;
  /** True = the user chose "stay connected on this device": the record (with
   *  its refresh token / credentials) is at rest in IndexedDB. False = memory
   *  only; gone on reload. */
  persist: boolean;
  /** OAuth kinds, persist only: the refresh token. */
  refreshToken?: string;
  /** Credential kinds: the user-entered config (endpoint, bucket, keys, …). */
  config?: Record<string, string>;
  /** Space-separated scopes granted, for honest display. */
  scopes?: string;
  connectedAt: string;
}

const KEY = 'provider-connections';

/** Session-only records + a write-through cache of persisted ones. */
const memory = new Map<string, ProviderConnection>();
/** Access tokens are ALWAYS memory-only, whatever the custody choice. */
const sessionTokens = new Map<string, { token: string; expiresAt: number }>();

async function readStore(): Promise<Record<string, ProviderConnection>> {
  try {
    const db = await openDB();
    return ((await db.get('profile', KEY)) as Record<string, ProviderConnection> | undefined) ?? {};
  } catch {
    return {}; // no IDB (jsdom) - memory-only mode
  }
}

async function writeStore(all: Record<string, ProviderConnection>): Promise<void> {
  try {
    const db = await openDB();
    await db.put('profile', all, KEY);
  } catch { /* no IDB - the memory map already holds it */ }
}

/** The connection for one kind: memory first, then the at-rest record. */
export async function getConnection(kind: string): Promise<ProviderConnection | null> {
  const m = memory.get(kind);
  if (m) return m;
  const rec = (await readStore())[kind] ?? null;
  if (rec) memory.set(kind, rec);
  return rec;
}

/** Every current connection, for the /profile section. */
export async function listConnections(): Promise<ProviderConnection[]> {
  const stored = await readStore();
  for (const [kind, rec] of Object.entries(stored)) {
    if (!memory.has(kind)) memory.set(kind, rec);
  }
  return [...memory.values()];
}

/** Save one connection under its custody choice: persist writes it at rest
 *  (secrets included); session-only keeps it in memory ONLY - and scrubs any
 *  previously persisted record for the kind, so flipping the toggle off is a
 *  real deletion, not a shadow copy. */
export async function saveConnection(rec: ProviderConnection): Promise<void> {
  memory.set(rec.kind, rec);
  const all = await readStore();
  if (rec.persist) {
    all[rec.kind] = rec;
  } else {
    delete all[rec.kind];
  }
  await writeStore(all);
}

/** Disconnect: wipe the record everywhere and drop any cached token. The
 *  caller does provider-side revocation where an API for it exists. */
export async function removeConnection(kind: string): Promise<void> {
  memory.delete(kind);
  sessionTokens.delete(kind);
  const all = await readStore();
  if (kind in all) {
    delete all[kind];
    await writeStore(all);
  }
}

/** A still-valid cached access token, or null. */
export function cachedToken(kind: string): string | null {
  const held = sessionTokens.get(kind);
  return held && held.expiresAt > Date.now() ? held.token : null;
}

export function cacheToken(kind: string, token: string, expiresAt: number): void {
  sessionTokens.set(kind, { token, expiresAt });
}

export function dropToken(kind: string): void {
  sessionTokens.delete(kind);
}

/** SYNC availability read for SendTarget.available() (which must stay cheap
 *  and synchronous): true once the kind's record is in the memory cache. Prime
 *  the cache at boot with primeConnections() so credential kinds (s3, webdav)
 *  surface in the export panel without a /profile visit first. */
export function hasConnection(kind: string): boolean {
  return memory.has(kind);
}

/** SYNC read of the cached record itself, for gates that need its config - e.g.
 *  a user-supplied Dropbox app key deciding dropboxAvailable(). Same priming
 *  rule as hasConnection(). */
export function cachedConnection(kind: string): ProviderConnection | null {
  return memory.get(kind) ?? null;
}

/** Fire-and-forget cache warm-up (send-targets-builtin calls it at boot). */
export function primeConnections(): void {
  void listConnections().catch(() => { /* no IDB - nothing to warm */ });
}

/** Test seam: reset the in-memory state (never touches IndexedDB). */
export function resetConnectionsForTests(): void {
  memory.clear();
  sessionTokens.clear();
}
