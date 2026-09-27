// SPDX-License-Identifier: MPL-2.0
/**
 * sync-engine (plans/138 B1 - continuity snapshots, hardened by Tier D) - the
 * DOM-free core of device sync over storage the person controls. No Lolly server:
 * this device exports the whole-person bundle (data-transfer.ts, the same unit
 * "Export my data" writes), optionally encrypts it, and writes it as a single
 * snapshot to a store the person chose (sync-remote.ts). Another device sees a
 * newer snapshot and offers to apply it.
 *
 * The rules that keep work safe (plans/138 Tier D, R1 to R4):
 *   - A push names the copy it replaces. If the store holds a different copy, the
 *     push is refused as a conflict and the person decides (WP-S1). Stores that
 *     can check this themselves get a conditional write too.
 *   - Applying a copy can replace this device (WP-S2), but only for items the
 *     caller says may go; data-transfer.ts does the removal.
 *   - Before an apply, the caller can save this device first (WP-S3), and a push
 *     can leave a daily copy beside the snapshot.
 *   - A snapshot that another device could not restore, or that this shell
 *     cannot upload in one request, is refused before upload (WP-S4).
 *   - A failed automatic push retries with backoff (R4).
 *
 * Still one snapshot, newest wins, not a per-record merge: that is B2.
 *
 * The engine is PURE over injected state: it never reads a clock (the store
 * stamps each snapshot) and never persists the sync bookkeeping itself - the caller
 * holds `SyncState` and stores it device-locally, because per plans/138
 * device-specific sync state is never itself synced. That keeps this unit
 * testable headless against MemoryRemote.
 */

import {
  exportBackup, importBackup, EMPTY_BACKUP_IDS, MAX_RESTORE_ENTRY_BYTES, MAX_RESTORE_TOTAL_BYTES,
  type BackupIds, type ReplaceScope,
} from '../data-transfer.ts';
import type { SyncRemote, SnapshotMeta } from './sync-remote.ts';
import { SyncConflictError } from './sync-remote.ts';
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
  /** Passphrase to encrypt before upload / decrypt after download. Omit for none,
   *  which is the default (plans/138 Tier D, D8). A snapshot pushed WITH a
   *  passphrase can only be applied WITH the same one - there is no recovery if
   *  it's lost. */
  passphrase?: string;
}

/** Which limit a refused snapshot broke. */
export type SizeLimit = 'restore-total' | 'restore-entry' | 'upload';

/** The snapshot is too big to sync: another device could not restore it, or this
 *  shell cannot upload it in one request. Retrying does not help. */
export class SyncTooLargeError extends Error {
  readonly limit: SizeLimit;
  readonly bytes: number;
  readonly max: number;
  /** For 'restore-entry': the part that is too big. */
  readonly part: string;
  constructor(limit: SizeLimit, bytes: number, max: number, part = '') {
    super(`The sync snapshot is too large (${bytes} bytes; the limit is ${max}).`);
    this.name = 'SyncTooLargeError';
    this.limit = limit;
    this.bytes = bytes;
    this.max = max;
    this.part = part;
  }
}

export interface BuildOpts extends SyncOpts {
  /** The most bytes this shell can send in one request; absent = no limit here. */
  maxUploadBytes?: number;
}

/** Export this device, check the limits, encrypt when asked. */
export async function buildSnapshot(deps: BackupDeps, opts: BuildOpts = {}): Promise<{ bytes: Uint8Array; ids: BackupIds }> {
  const { blob, ids, size } = await exportBackup(deps, { mode: 'sync' });
  if (size.total > MAX_RESTORE_TOTAL_BYTES) throw new SyncTooLargeError('restore-total', size.total, MAX_RESTORE_TOTAL_BYTES);
  if (size.largest.bytes > MAX_RESTORE_ENTRY_BYTES) {
    throw new SyncTooLargeError('restore-entry', size.largest.bytes, MAX_RESTORE_ENTRY_BYTES, size.largest.name);
  }
  let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
  if (opts.passphrase) bytes = await encryptSnapshot(bytes, opts.passphrase);
  if (opts.maxUploadBytes !== undefined && bytes.length > opts.maxUploadBytes) {
    throw new SyncTooLargeError('upload', bytes.length, opts.maxUploadBytes);
  }
  return { bytes, ids };
}

export interface PushOpts extends BuildOpts {
  /** This device's bookkeeping. The push goes ahead only while the store still
   *  holds the copy `state.lastSyncedRev` names (or nothing, for a device whose
   *  copy was removed). */
  state: SyncState;
  /** Skip the check: the person chose to replace the synced copy with this device. */
  force?: boolean;
}

export type PushResult =
  | { status: 'pushed'; meta: SnapshotMeta; state: SyncState; bytes: Uint8Array; ids: BackupIds }
  | { status: 'conflict'; remote: SnapshotMeta | null };

/**
 * Export this device's state and write it as THE snapshot. Refused as a conflict
 * when the store holds a copy this device has not seen: another device pushed
 * since, or this device never synced with this store. On success the returned
 * state's rev matches the store, so this device won't treat its own push as newer.
 */
export async function pushSnapshot(deps: BackupDeps, remote: SyncRemote, opts: PushOpts): Promise<PushResult> {
  let ifRev: string | null | undefined;
  if (!opts.force) {
    const current = await remote.head();
    if (current && current.rev !== opts.state.lastSyncedRev) return { status: 'conflict', remote: current };
    ifRev = current ? current.rev : null;
  }
  const { bytes, ids } = await buildSnapshot(deps, opts);
  try {
    const meta = await remote.put(bytes, ifRev === undefined ? undefined : { ifRev });
    return { status: 'pushed', meta, state: { lastSyncedRev: meta.rev, lastSyncedAt: meta.updatedAt }, bytes, ids };
  } catch (err) {
    if (err instanceof SyncConflictError) return { status: 'conflict', remote: await remote.head().catch(() => null) };
    throw err;
  }
}

/**
 * Write this device's current state to `remote` with no condition: the copy saved
 * before an apply, so the apply can be undone (WP-S3).
 */
export async function saveCopy(deps: BackupDeps, remote: SyncRemote, opts: BuildOpts = {}): Promise<SnapshotMeta> {
  const { bytes } = await buildSnapshot(deps, opts);
  return remote.put(bytes);
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

export interface ApplyOpts extends SyncOpts {
  /** What the apply may remove from this device; absent = add and update only. */
  replace?: ReplaceScope;
  /** How the copy's profile record and preferences meet this device's. Absent =
   *  'replace': keeping devices in step means the synced record wins, and so does
   *  its copy of a session or asset that is on both sides. 'merge' keeps this
   *  device's folders, favourites, templates and settings, adds the copy's new
   *  ones, and keeps whichever copy of a shared session or asset is newer (the
   *  first join's "Bring it to this device"). */
  profile?: 'merge' | 'replace';
  /** Runs once the copy is downloaded and readable, before anything is written.
   *  A throw stops the apply with this device unchanged. */
  beforeApply?: () => Promise<void>;
}

/** Why an encrypted sync copy could not be opened: no passphrase was given, or the
 *  one given does not decrypt the copy (a wrong passphrase, or damaged bytes: AES-GCM
 *  cannot tell the two apart). */
export class SnapshotPassphraseError extends Error {
  readonly reason: 'missing' | 'wrong';
  constructor(reason: 'missing' | 'wrong') {
    super(reason === 'missing'
      ? 'This snapshot is encrypted - enter its passphrase to restore it.'
      : 'Wrong passphrase for this snapshot.');
    this.name = 'SnapshotPassphraseError';
    this.reason = reason;
  }
}

/**
 * The backup bundle inside a sync copy: the bytes unchanged when the copy is plain,
 * decrypted with `passphrase` when it is encrypted (snapshot-crypto.ts, "LSE1").
 * Throws SnapshotPassphraseError when an encrypted copy has no passphrase or the
 * wrong one. This is the one decoder for a sync copy: pullAndApply uses it for a
 * download, and importSnapshotFile for a copy the person opened from a file.
 */
export async function openSnapshot(bytes: Uint8Array, passphrase?: string): Promise<Uint8Array> {
  if (!isEncryptedSnapshot(bytes)) return bytes;
  if (!passphrase) throw new SnapshotPassphraseError('missing');
  const plain = await decryptSnapshot(bytes, passphrase);
  if (!plain) throw new SnapshotPassphraseError('wrong');
  return plain;
}

/**
 * Import a sync copy the person opened from a file (plans/277 P13): the current copy,
 * a daily copy or the before-apply copy, downloaded from their storage and dropped on
 * Open or picked in Import data…. It is imported exactly as a backup .zip is, with
 * importBackup's defaults: it adds and updates, merges the profile record, and deletes
 * nothing. It reads no remote and leaves the sync bookkeeping alone, because a copy
 * opened by hand is not a sync. Nothing is written when the passphrase is missing or
 * wrong, or when the bundle inside is not a readable backup.
 */
export async function importSnapshotFile(
  deps: BackupDeps, bytes: Uint8Array, opts: SyncOpts = {},
): Promise<Awaited<ReturnType<typeof importBackup>>> {
  return importBackup(deps, await openSnapshot(bytes, opts.passphrase));
}

/**
 * Download the remote snapshot and apply it to this device. Decrypts first when
 * the snapshot is encrypted (needs the passphrase). Returns the import summary,
 * the updated local state and the ids the applied copy holds. Throws when there
 * is no snapshot, or an encrypted one is missing / has the wrong passphrase, or
 * `beforeApply` fails - nothing is applied in those cases.
 */
export async function pullAndApply(
  deps: BackupDeps, remote: SyncRemote, opts: ApplyOpts = {},
): Promise<{ summary: Awaited<ReturnType<typeof importBackup>>; state: SyncState; ids: BackupIds }> {
  const got = await remote.get();
  if (!got) throw new Error('There is no snapshot in your cloud yet.');
  if (!isEncryptedSnapshot(got.bytes) && opts.passphrase) {
    // A plaintext snapshot when a passphrase was expected: don't silently apply -
    // it may be an older unencrypted push, but the mismatch is worth surfacing.
    throw new Error('This snapshot is not encrypted, but a passphrase was set. Check your sync settings.');
  }
  const bytes = await openSnapshot(got.bytes, opts.passphrase);
  if (opts.beforeApply) await opts.beforeApply();
  // A merge (Bring it to this device) keeps the newer copy of a session or asset
  // that is on both sides; keeping devices in step and restoring take the copy.
  const merge = opts.profile === 'merge';
  const summary = await importBackup(deps, bytes, {
    mode: 'sync', profile: merge ? 'merge' : 'replace', sameId: merge ? 'newer' : 'incoming',
    ...(opts.replace ? { replace: opts.replace } : {}),
  });
  // A partial restore is not a synced revision. Leave the previous revision in
  // place, so a storage/conflict failure remains visible and retryable.
  if (summary.failedAssets || summary.failedHistory || summary.skipped) throw new Error('The snapshot was only partly restored. Keep the cloud backup and retry after freeing space, resolving conflicting versions, or updating Lolly.');
  return {
    summary,
    state: { lastSyncedRev: got.meta.rev, lastSyncedAt: got.meta.updatedAt },
    ids: summary.ids ?? EMPTY_BACKUP_IDS,
  };
}

// ── Daily copies (WP-S3) ────────────────────────────────────────────────────────

/** How many daily copies rotate beside the snapshot: one per weekday. */
export const DAILY_SLOTS = 7;

/** ISO weekday (1 = Monday … 7 = Sunday) of a timestamp, in UTC; null when unreadable. */
export function isoWeekdayUtc(when: string): number | null {
  const ms = Date.parse(when);
  if (Number.isNaN(ms)) return null;
  const day = new Date(ms).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The UTC calendar date of a timestamp (YYYY-MM-DD); null when unreadable. */
export function utcDate(when: string): string | null {
  const ms = Date.parse(when);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

/**
 * After a successful push, keep the same bytes in that weekday's slot, once per
 * UTC day. The date comes from the store's own stamp on the push, so the engine
 * still reads no clock. Returns whether a copy was written.
 */
export async function writeDailyCopy(
  bytes: Uint8Array, pushed: SnapshotMeta, slotRemote: (day: number) => SyncRemote,
): Promise<boolean> {
  const day = isoWeekdayUtc(pushed.updatedAt);
  const today = utcDate(pushed.updatedAt);
  if (!day || !today) return false;
  const slot = slotRemote(day);
  const existing = await slot.head();
  if (existing && utcDate(existing.updatedAt) === today) return false;
  await slot.put(bytes);
  return true;
}

// ── The automatic push driver ───────────────────────────────────────────────────

/** Injectable timers so the scheduler is testable without wall-clock flakiness. */
export interface SchedulerTimers {
  set(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clear(h: ReturnType<typeof setTimeout>): void;
}
const REAL_TIMERS: SchedulerTimers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h) };

/** Wait times before retrying a failed push: 30 s, 2 min, 10 min, then every 30 min. */
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000];

/**
 * Debounced push driver: notifyChange() coalesces a burst of edits into ONE push
 * after `delayMs` of quiet. A push already in flight makes the next change wait
 * until it settles (then fires once), so overlapping edits never race two uploads.
 * flush() forces any pending push now (e.g. on app background/close). Errors from
 * `push` are handed to onError, never thrown into the caller's edit path, and,
 * when `retryDelays` is given, the push is tried again after the next wait in
 * that list (the last wait repeats). A success resets the wait.
 */
export function makeSyncScheduler(
  push: () => Promise<void>,
  delayMs: number,
  { onError, timers = REAL_TIMERS, retryDelays = [] }: {
    onError?: (err: unknown) => void; timers?: SchedulerTimers; retryDelays?: readonly number[];
  } = {},
): { notifyChange(): void; flush(): Promise<void>; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pending = false; // a change arrived while a push was in flight
  let failures = 0;

  const clearTimer = (): void => { if (timer) { timers.clear(timer); timer = null; } };

  const run = async (): Promise<void> => {
    clearTimer();
    if (running) { pending = true; return; }   // coalesce into the in-flight push
    running = true;
    let failed = false;
    try {
      await push();
      failures = 0;
    } catch (err) {
      failed = true;
      onError?.(err);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        void run();                                // a change arrived mid-push - push once more
      } else if (failed && retryDelays.length) {
        const wait = retryDelays[Math.min(failures, retryDelays.length - 1)]!;
        failures++;
        timer = timers.set(() => void run(), wait);
      }
    }
  };

  return {
    notifyChange(): void { clearTimer(); timer = timers.set(() => void run(), delayMs); },
    async flush(): Promise<void> { await run(); },
    cancel(): void { clearTimer(); pending = false; failures = 0; },
  };
}
