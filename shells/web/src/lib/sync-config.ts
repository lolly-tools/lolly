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
import type { SyncState } from './sync-engine.ts';

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
}

const KEY = 'sync-config';
const DEFAULT: SyncConfig = { enabled: false, providerKind: '', lastSyncedRev: null, lastSyncedAt: null };

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

/** The current sync config (defaults merged). Cached after first read. */
export async function getSyncConfig(): Promise<SyncConfig> {
  return { ...(await readStore()) };
}

/** Merge a patch into the config and persist it. Returns the new config. */
export async function saveSyncConfig(patch: Partial<SyncConfig>): Promise<SyncConfig> {
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

/** Test seam: drop the in-memory cache (never touches IndexedDB). */
export function resetSyncConfigForTests(): void {
  cache = null;
}
