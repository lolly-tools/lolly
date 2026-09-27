// SPDX-License-Identifier: MPL-2.0
/**
 * sync-config (plans/138 B1) - the DEVICE-LOCAL settings for device sync: is it
 * on, which connected provider is the sync home, the optional passphrase, and the
 * bookkeeping (`lastSyncedRev`/`lastSyncedAt`) the engine compares for
 * newer-detection.
 *
 * WHERE IT LIVES AND WHY: the IndexedDB 'profile' store, key 'sync-config' - the
 * same neighbourhood as provider-connections, and like it NEVER travels in a
 * portable backup (data-transfer's exportBackup reads only the 'me' key), so the
 * passphrase and the device-specific rev never leak into a snapshot or a backup
 * zip. That is deliberate: the sync bookkeeping is per-device by design (plans/138
 * "Never synced: device identity"), and the passphrase is a secret held under the
 * same custody model as the S3 keys in provider-connections (device-local, wiped
 * by Clear-all).
 */

import { openDB } from '../bridge/db.ts';
import { clearSignal } from './clear-signal.ts';
import type { SyncState } from './sync-engine.ts';
import type { SnapshotMeta } from './sync-remote.ts';
import type { BackupIds } from '../data-transfer.ts';

export interface SyncConfig {
  /** Master switch. Off = no auto-push, no boot check, byte-identical to no sync. */
  enabled: boolean;
  /** The SyncRemote kind that is this device's sync home ('s3', …); '' = none picked. */
  providerKind: string;
  /** Optional passphrase: snapshots are encrypted with it before upload, and need
   *  it to restore. '' / absent = no encryption. Stored device-local, never in backups. */
  passphrase?: string;
  /** The remote rev this device last pushed OR applied. null = never synced here. */
  lastSyncedRev: string | null;
  /** ISO time of that last push/apply, for the "Last synced …" line. */
  lastSyncedAt: string | null;
  /** This device has changes the synced copy does not hold yet (plans/138 Tier D,
   *  WP-S1). Set by any local write, cleared by a push or an apply. While it is
   *  set, a synced copy never replaces this device without the person choosing. */
  dirty?: boolean;
  /** The synced copy changed on another device while this one had changes of its
   *  own. Automatic pushes pause until the person chooses what to keep. */
  conflict?: SnapshotMeta | null;
  /** How many conflicts this device has met (plans/138 Tier D, R10). */
  conflictCount?: number;
  /** The last sync failure, in words, for the status line; null after a success. */
  lastError?: string | null;
}

const KEY = 'sync-config';
const BASE_KEY = 'sync-base';
const DEFAULT: SyncConfig = { enabled: false, providerKind: '', lastSyncedRev: null, lastSyncedAt: null, dirty: false, conflict: null, conflictCount: 0, lastError: null };

let cache: SyncConfig | null = null;

async function readStore(): Promise<SyncConfig> {
  if (cache) return cache;
  try {
    const db = await openDB();
    cache = { ...DEFAULT, ...((await db.get('profile', KEY)) as Partial<SyncConfig> | undefined) };
  } catch {
    cache = { ...DEFAULT }; // no IDB (jsdom / tests) - memory-only
  }
  return cache;
}

/** The current sync config (defaults merged). Cached after first read. Reads as
 *  off in a tab that must not write after "Clear all my data" (lib/clear-signal.ts),
 *  so no automatic push, boot check or apply starts there. */
export async function getSyncConfig(): Promise<SyncConfig> {
  if (clearSignal.writesBlocked()) return { ...(cache ?? DEFAULT), enabled: false };
  return { ...(await readStore()) };
}

/** Merge a patch into the config and persist it. Returns the new config. Refused
 *  (nothing stored, in memory or on disk) in a tab that must not write after a
 *  clear: such a tab still holds the config from before the clear, and writing
 *  any of it back would turn sync on again over the emptied browser. */
export async function saveSyncConfig(patch: Partial<SyncConfig>): Promise<SyncConfig> {
  if (clearSignal.writesBlocked()) return { ...(cache ?? DEFAULT), enabled: false };
  const next: SyncConfig = { ...(await readStore()), ...patch };
  cache = next;
  try {
    const db = await openDB();
    await db.put('profile', next, KEY);
  } catch { /* no IDB - the memory cache already holds it */ }
  return { ...next };
}

/** The engine's SyncState view of the config (its rev bookkeeping). */
export function syncStateOf(cfg: SyncConfig): SyncState {
  return { lastSyncedRev: cfg.lastSyncedRev, lastSyncedAt: cfg.lastSyncedAt };
}

/**
 * The ids in the copy this device last pushed or applied. A replace apply may
 * remove only these, so work made here since then always survives (WP-S2).
 * Stored under its own key because it can be long; device-local like the rest.
 */
let baseCache: BackupIds | null = null;

export async function getSyncBase(): Promise<BackupIds | null> {
  if (baseCache) return baseCache;
  try {
    const db = await openDB();
    baseCache = ((await db.get('profile', BASE_KEY)) as BackupIds | undefined) ?? null;
  } catch { /* no IDB - memory only */ }
  return baseCache;
}

export async function saveSyncBase(ids: BackupIds): Promise<void> {
  if (clearSignal.writesBlocked()) return; // as saveSyncConfig
  baseCache = ids;
  try {
    const db = await openDB();
    await db.put('profile', ids, BASE_KEY);
  } catch { /* no IDB - the memory cache already holds it */ }
}

/**
 * "Clear all my data", first step (lib/clear-all-data.ts): sync off, and this
 * browser's sync bookkeeping forgotten, in memory and on disk, before anything is
 * emptied. With no last synced revision a later push is a first join, which never
 * replaces a synced copy by itself, so a cleared browser cannot upload its empty
 * state over the person's synced data even if the rest of the clear fails. Runs
 * while the clear already refuses every other write, so it writes directly.
 */
export async function resetSyncForClear(): Promise<void> {
  cache = { ...DEFAULT };
  baseCache = null;
  const db = await openDB();
  await db.put('profile', { ...DEFAULT }, KEY);
  await db.delete('profile', BASE_KEY);
}

/** Test seam: drop the in-memory caches (never touches IndexedDB). */
export function resetSyncConfigForTests(): void {
  cache = null;
  baseCache = null;
}
