// SPDX-License-Identifier: MPL-2.0
/**
 * sync-engine (plans/138 B1 - continuity snapshots) - the DOM-free core of
 * device sync over a person's OWN cloud. No Lolly server: this device exports the
 * whole-person bundle (data-transfer.ts, the same unit "Export my data" writes),
 * optionally encrypts it, and PUTs it as a single snapshot to a remote the user
 * chose (sync-remote.ts). Another device sees a newer snapshot and offers to
 * apply it via the existing import path.
 *
 * v1 is LAST-WRITE-WINS at snapshot granularity, stated honestly in the UI: the
 * newest snapshot is the truth; applying it replaces this device's state with that
 * bundle. No per-record merge yet - that's B2, and B1 exists to teach us the
 * operational truths (snapshot size, push cadence, real conflict frequency)
 * before we design it.
 *
 * The engine is PURE over injected state: it never reads a clock (the remote
 * stamps the snapshot) and never persists the sync bookkeeping itself - the caller
 * holds `SyncState` and stores it DEVICE-LOCALLY (localStorage), because per
 * plans/138 device-specific sync state is explicitly never itself synced. That
 * keeps this unit testable headless against MemoryRemote.
 */

import { exportBackup, importBackup } from '../data-transfer.ts';
import type { SyncRemote, SnapshotMeta } from './sync-remote.ts';
import { encryptSnapshot, decryptSnapshot, isEncryptedSnapshot } from './snapshot-crypto.ts';

/** The host+storage slice a backup travels through - derived from data-transfer's
 *  own signature so a change there fails here at typecheck, not at runtime. */
export type BackupDeps = Parameters<typeof exportBackup>[0];

/** Device-local sync bookkeeping. NOT synced (plans/138 "Never synced": device
 *  identity / derived state). The caller persists it; the engine stays pure. */
export interface SyncState {
  /** The remote rev this device last pushed OR applied. null = never synced here. */
  lastSyncedRev: string | null;
  /** ISO time of that last push/apply (from the remote's meta), for honest UI. */
  lastSyncedAt: string | null;
}

export const INITIAL_SYNC_STATE: SyncState = { lastSyncedRev: null, lastSyncedAt: null };

export interface SyncOpts {
  /** Passphrase to encrypt before upload / decrypt after download. Omit for none
   *  (e.g. iCloud's already-private path). A snapshot pushed WITH a passphrase can
   *  only be applied WITH the same one - there is no recovery if it's lost. */
  passphrase?: string;
}

/**
 * Export this device's state and push it as THE snapshot (overwriting the prior
 * one). Returns the new remote meta and the updated local state, whose rev now
 * matches the remote - so this device won't then treat its own push as "newer".
 */
export async function pushSnapshot(
  deps: BackupDeps, remote: SyncRemote, opts: SyncOpts = {},
): Promise<{ meta: SnapshotMeta; state: SyncState }> {
  const { blob } = await exportBackup(deps, { mode: 'sync' });
  let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
  if (opts.passphrase) bytes = await encryptSnapshot(bytes, opts.passphrase);
  const meta = await remote.put(bytes);
  return { meta, state: { lastSyncedRev: meta.rev, lastSyncedAt: meta.updatedAt } };
}

/**
 * Is there a remote snapshot this device hasn't written or applied? Cheap - a
 * head() only, no download. False when there's no remote snapshot yet, or its rev
 * equals `lastSyncedRev` (this device wrote it, or already applied it).
 */
export async function checkForNewer(
  remote: SyncRemote, state: SyncState,
): Promise<{ hasNewer: boolean; meta: SnapshotMeta | null }> {
  const meta = await remote.head();
  return { hasNewer: !!meta && meta.rev !== state.lastSyncedRev, meta };
}

/**
 * Download the remote snapshot and apply it OVER this device's state (last-write-
 * wins). Decrypts first when the snapshot is encrypted (needs the passphrase).
 * Returns the import summary and the updated local state. Throws when there is no
 * snapshot, or an encrypted one is missing / has the wrong passphrase - the caller
 * surfaces that; nothing is applied in those cases.
 */
export async function pullAndApply(
  deps: BackupDeps, remote: SyncRemote, opts: SyncOpts = {},
): Promise<{ summary: Awaited<ReturnType<typeof importBackup>>; state: SyncState }> {
  const got = await remote.get();
  if (!got) throw new Error('There is no snapshot in your cloud yet.');
  let bytes = got.bytes;
  if (isEncryptedSnapshot(bytes)) {
    if (!opts.passphrase) throw new Error('This snapshot is encrypted - enter its passphrase to restore it.');
    const plain = await decryptSnapshot(bytes, opts.passphrase);
    if (!plain) throw new Error('Wrong passphrase for this snapshot.');
    bytes = plain;
  } else if (opts.passphrase) {
    // A plaintext snapshot when a passphrase was expected: don't silently apply -
    // it may be an older unencrypted push, but the mismatch is worth surfacing.
    throw new Error('This snapshot is not encrypted, but a passphrase was set. Check your sync settings.');
  }
  const summary = await importBackup(deps, bytes, { mode: 'sync' });
  // A partial restore is not a synced revision. Leave the previous revision in
  // place, so a storage/conflict failure remains visible and retryable.
  if (summary.failedAssets || summary.failedHistory || summary.skipped) throw new Error('The snapshot was only partly restored. Keep the cloud backup and retry after freeing space, resolving conflicting versions, or updating Lolly.');
  return { summary, state: { lastSyncedRev: got.meta.rev, lastSyncedAt: got.meta.updatedAt } };
}

/** Injectable timers so the scheduler is testable without wall-clock flakiness. */
export interface SchedulerTimers {
  set(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clear(h: ReturnType<typeof setTimeout>): void;
}
const REAL_TIMERS: SchedulerTimers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h) };

/**
 * Debounced push driver: notifyChange() coalesces a burst of edits into ONE push
 * after `delayMs` of quiet. A push already in flight makes the next change wait
 * until it settles (then fires once), so overlapping edits never race two uploads.
 * flush() forces any pending push now (e.g. on app background/close). Errors from
 * `push` are handed to onError, never thrown into the caller's edit path.
 */
export function makeSyncScheduler(
  push: () => Promise<void>,
  delayMs: number,
  { onError, timers = REAL_TIMERS }: { onError?: (err: unknown) => void; timers?: SchedulerTimers } = {},
): { notifyChange(): void; flush(): Promise<void>; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pending = false; // a change arrived while a push was in flight

  const clearTimer = (): void => { if (timer) { timers.clear(timer); timer = null; } };

  const run = async (): Promise<void> => {
    clearTimer();
    if (running) { pending = true; return; }   // coalesce into the in-flight push
    running = true;
    try {
      await push();
    } catch (err) {
      onError?.(err);
    } finally {
      running = false;
      if (pending) { pending = false; void run(); }  // a change arrived mid-push - push once more
    }
  };

  return {
    notifyChange(): void { clearTimer(); timer = timers.set(() => void run(), delayMs); },
    async flush(): Promise<void> { await run(); },
    cancel(): void { clearTimer(); pending = false; },
  };
}
