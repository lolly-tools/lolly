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
 * Per-record sync (plans/138 B2) is the second half of this file: `syncRecords`
 * keeps one object per record instead of one snapshot, merges per record, and
 * never loses an edit made on either side. The snapshot functions above it stay
 * for backups, daily copies and devices on older builds.
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
import {
  deriveStoreKeys, isSealedObject, objectNameFor, openObject, sealObject, sealedKeySettings, sha256Hex,
  SEAL_OVERHEAD, type StoreKeys,
} from './sync-keys.ts';
import { classify, classifyForced, type BaseEntry, type IndexEntry } from './sync-merge.ts';
import {
  canonicalJson, collectLocalRecords, conflictCopyId, makeRecord, mergeDesignSystemValues, mergeProfileValues,
  neverDeleted, parseRecordKey, partDigests, recordKey, recordTime, rekeyRecord, removeLocalRecord, writeLocalRecord,
  type LocalRecord, type RecordKind,
} from './sync-records.ts';

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

// ── Per-record sync (plans/138 B2) ──────────────────────────────────────────────
//
// The store holds one index and a folder of objects named by their content:
//   lolly-sync/v2/index           record key → entry (hash, object, parts, tombstone)
//   lolly-sync/v2/objects/<name>  a record body or a binary part, never changed once written
// A sync uploads the objects it needs first, then writes the index with the store's
// conditional write. The index is the only object that changes, so a sync that
// stops part way leaves unused objects behind, never a half-written record, and two
// devices writing at once cannot both win: the second one reads the index again and
// merges again. Only after the index is written does this device change its own
// records. sync-merge.ts decides each record, sync-records.ts reads and writes them,
// and sync-keys.ts holds the key design for optional encryption.

/** Where the index lives under the sync home's folder. */
export const RECORD_INDEX_PATH = 'lolly-sync/v2/index';
/** Where one content-named object lives under the sync home's folder. */
export const recordObjectPath = (name: string): string => `lolly-sync/v2/objects/${name}`;

/** Resolves one store path to the remote that reads and writes that object. */
export type OpenRemote = (path: string) => SyncRemote | Promise<SyncRemote>;

const INDEX_FORMAT = 'lolly-sync-index';
const INDEX_VERSION = 1;
/** The newest index layout this build can read. A newer index says so in `minReader`. */
export const INDEX_READER_VERSION = 1;

/** The store's index. */
export interface RecordIndex {
  format: typeof INDEX_FORMAT;
  version: number;
  minReader: number;
  /** A random id the first device gave this store. A device's base records this id, so a
   *  base from another store, or from before the store was replaced, is never read
   *  as this store's history. */
  store: string;
  /** Goes up with every write. A device refuses an index older than the newest one
   *  it has synced, so the store cannot quietly serve an earlier state. */
  seq: number;
  records: Record<string, IndexEntry>;
  /** Objects nothing names any more, with the time they stopped being named. */
  retired: Record<string, string>;
  /** Objects being removed, with the time the removal started. Never reused. */
  removing: Record<string, string>;
}

/** What this device keeps about its last per-record sync. Device-local, never synced. */
export interface RecordSyncBase {
  /** The store this base belongs to (RecordIndex.store). */
  store: string;
  /** The index `seq` this device last read or wrote. */
  seq: number;
  entries: Record<string, BaseEntry>;
  /** The profile and design-system records as last synced, for field merges. */
  bodies?: Record<string, Record<string, unknown>>;
}

/** How long a tombstone stays in the index. A device whose base still lists the
 *  record treats its absence as a deletion after that too. */
export const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** How long an object nothing names stays in the store before it may be removed. */
export const RETIRED_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** A removal that started this long ago and never finished is finished by the next device. */
const REMOVING_STALE_MS = 60 * 60 * 1000;
/** The longest list of retired objects the index keeps, for stores that cannot remove objects yet. */
const RETIRED_LIMIT = 5000;
const INDEX_ATTEMPTS = 4;
const TRANSFER_CONCURRENCY = 4;

/** The store served an index older than one this device already synced. */
export class SyncRollbackError extends Error {
  constructor() {
    super('Your synced data went back to an earlier state. Nothing was changed. To keep this device’s version, replace the synced copy with this device.');
    this.name = 'SyncRollbackError';
  }
}

/** An object the index names is not in the store. */
class MissingObjectError extends Error {
  constructor() {
    super('A synced item is missing from your storage. It will sync again on the next try.');
    this.name = 'MissingObjectError';
  }
}

export interface RecordSyncOpts extends SyncOpts {
  /** The store, one object path at a time. */
  open: OpenRemote;
  /** This device's base from its last per-record sync with this store, or null. */
  base: RecordSyncBase | null;
  /** The time, as an ISO string: stamps entries, tombstones and retired objects. */
  now: () => string;
  /** A label for this device, shown with the entries it writes. Never used for trust. */
  device?: string;
  /** Make the store match this device: every record here is sent, every other
   *  record gets a tombstone, and nothing comes back. The person's explicit choice. */
  force?: boolean;
  /** The most bytes this shell can send in one request; absent = no limit here. */
  maxUploadBytes?: number;
}

/** One record both sides changed, and how it was settled. */
export interface RecordConflict {
  key: string;
  /** 'here' or 'store': that side's copy stays at the key. 'both': the other side's
   *  copy is kept too, at `copy`. 'merged': the two were merged field by field. */
  kept: 'here' | 'store' | 'both' | 'merged';
  copy?: string;
  /** Set when an edit met a deletion: the side the edit was on. The edit is kept. */
  editMetDelete?: 'here' | 'store';
}

/** A record this sync left for the next one, and why. */
export interface DeferredRecord {
  key: string;
  reason: 'changed-here' | 'too-large' | 'missing' | 'failed';
  message?: string;
}

export interface RecordSyncResult {
  /** The index revision after this sync; null when the store still has no index. */
  rev: string | null;
  /** The new base, for the caller to keep on this device. */
  base: RecordSyncBase;
  /** Keys sent to the store, written as tombstones, written here and removed here. */
  pushed: string[];
  tombstoned: string[];
  pulled: string[];
  removedHere: string[];
  conflicts: RecordConflict[];
  deferred: DeferredRecord[];
  /** Objects written by this sync, and the objects it found already in the store. */
  uploaded: { objects: number; bytes: number };
  reused: number;
}

interface IndexRead {
  index: RecordIndex | null;
  rev: string | null;
  keys: StoreKeys | null;
}

const emptyIndex = (): RecordIndex => ({
  format: INDEX_FORMAT, version: INDEX_VERSION, minReader: 1,
  store: globalThis.crypto.randomUUID(), seq: 0, records: {}, retired: {}, removing: {},
});

const isRecordMap = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** An object name this build writes: a hex digest, with a suffix when the plain one was being removed. */
const OBJECT_NAME = /^[0-9a-f]{64}(\.\d{1,4})?$/;
const isOptional = (v: unknown, check: (x: unknown) => boolean): boolean => v === undefined || check(v);
const isText = (v: unknown): boolean => typeof v === 'string';
const isObjectName = (v: unknown): boolean => typeof v === 'string' && OBJECT_NAME.test(v);

/** The well-formed name and time pairs of a retired or removing list. */
const nameTimes = (v: unknown): Record<string, string> =>
  isRecordMap(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => isObjectName(e[0]) && typeof e[1] === 'string')) : {};

/** A well-formed index entry. Object names are checked so an index cannot point a
 *  read outside the objects folder. */
function isIndexEntry(v: unknown): v is IndexEntry {
  return isRecordMap(v) && typeof v.hash === 'string' && typeof v.updatedAt === 'string' && typeof v.size === 'number'
    && isOptional(v.object, isObjectName) && isOptional(v.deletedAt, isText) && isOptional(v.writtenBy, isText)
    && isOptional(v.parts, (p) => isRecordMap(p) && Object.values(p).every(isObjectName));
}

/**
 * Read and open the index. Null index when the store has none yet. A sealed index
 * needs the passphrase; a plain one must not meet a passphrase. With `force` an
 * index this device cannot read is treated as absent (its revision is kept for the
 * conditional write), except one that needs a newer build, which is never replaced.
 */
async function readRecordIndex(open: OpenRemote, passphrase: string | undefined, force: boolean): Promise<IndexRead> {
  const got = await (await open(RECORD_INDEX_PATH)).get();
  if (!got) return { index: null, rev: null, keys: null };
  const unreadable = (err: Error): IndexRead => {
    if (force) return { index: null, rev: got.meta.rev, keys: null };
    throw err;
  };
  let plain = got.bytes;
  let keys: StoreKeys | null = null;
  if (isSealedObject(got.bytes)) {
    if (!passphrase) return unreadable(new SnapshotPassphraseError('missing'));
    const settings = sealedKeySettings(got.bytes)!;
    keys = await deriveStoreKeys(passphrase, settings.salt, settings.rounds);
    const opened = await openObject(keys, got.bytes, 'index');
    if (!opened) return unreadable(new SnapshotPassphraseError('wrong'));
    plain = opened;
  } else if (passphrase) {
    return unreadable(new Error('This synced data is not encrypted, but a passphrase was set. Check your sync settings.'));
  }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(plain)); } catch { parsed = null; }
  if (!isRecordMap(parsed) || parsed.format !== INDEX_FORMAT || typeof parsed.store !== 'string' || !isRecordMap(parsed.records)
    || !Object.values(parsed.records).every(isIndexEntry)) {
    // A damaged entry is never dropped quietly: a missing record reads as a deletion.
    return unreadable(new Error('The synced index could not be read.'));
  }
  const required = typeof parsed.minReader === 'number' ? parsed.minReader : 1;
  if (required > INDEX_READER_VERSION) throw new Error('Your synced data needs a newer version of Lolly. Update this device, then sync again.');
  // Fields a newer build added are kept, so writing the index back never drops them.
  const index: RecordIndex = {
    ...parsed,
    format: INDEX_FORMAT,
    version: typeof parsed.version === 'number' ? parsed.version : INDEX_VERSION,
    minReader: required,
    store: parsed.store,
    seq: typeof parsed.seq === 'number' ? parsed.seq : 0,
    records: parsed.records as Record<string, IndexEntry>,
    retired: nameTimes(parsed.retired),
    removing: nameTimes(parsed.removing),
  };
  return { index, rev: got.meta.rev, keys };
}

/** Write the index, conditional on the revision that was read. */
async function writeRecordIndex(open: OpenRemote, keys: StoreKeys | null, index: RecordIndex, rev: string | null): Promise<SnapshotMeta> {
  const plain = new TextEncoder().encode(canonicalJson(index));
  const bytes = keys ? await sealObject(keys, plain, 'index') : plain;
  return (await open(RECORD_INDEX_PATH)).put(bytes, { ifRev: rev });
}

/** Read one object and check its content against the hash the index gives. */
async function readObject(open: OpenRemote, keys: StoreKeys | null, name: string | undefined, hash: string): Promise<Uint8Array> {
  const got = name ? await (await open(recordObjectPath(name))).get() : null;
  if (!got) throw new MissingObjectError();
  let bytes = got.bytes;
  if (keys) {
    const opened = await openObject(keys, bytes, 'object');
    if (!opened) throw new Error('A synced item could not be opened with this passphrase.');
    bytes = opened;
  }
  if (await sha256Hex(bytes) !== hash) throw new Error('A synced item was changed or damaged in your storage.');
  return bytes;
}

async function readRecordValue(open: OpenRemote, keys: StoreKeys | null, entry: IndexEntry): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(new TextDecoder().decode(await readObject(open, keys, entry.object, entry.hash)));
  if (!isRecordMap(value)) throw new Error('A synced item could not be read.');
  return value;
}

/** Run `fn` over `items`, `limit` at a time. Stops starting new items after the
 *  first failure, waits for the ones under way, then throws that failure. */
async function eachLimited<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failure: { err: unknown } | null = null;
  const worker = async (): Promise<void> => {
    while (!failure && next < items.length) {
      const item = items[next++]!;
      try { await fn(item); } catch (err) { failure ??= { err }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw (failure as { err: unknown }).err;
}

/** The objects the live entries of an index point at. */
function liveNames(index: RecordIndex): Set<string> {
  const names = new Set<string>();
  for (const entry of Object.values(index.records)) {
    if (entry.deletedAt) continue;
    if (entry.object) names.add(entry.object);
    for (const name of Object.values(entry.parts ?? {})) names.add(name);
  }
  return names;
}

/** One write this device makes to its own records after the index is written. */
interface LocalWrite {
  key: string;
  /** This device's hash the plan was made against; the write is skipped when the
   *  record changed here since (the person kept working during the sync). */
  expect: string | null;
  /** A conflict copy: written first. `requires` points at the copy a write waits for. */
  copy?: boolean;
  requires?: string;
  /** Content this device already has; otherwise read from `entry`. */
  record?: LocalRecord;
  entry?: IndexEntry;
  value?: Record<string, unknown>;
}

interface Upload {
  hash: string;
  read(): Promise<Uint8Array>;
}

interface RecordPlan {
  next: RecordIndex;
  uploads: Map<string, Upload>;
  writes: LocalWrite[];
  deletes: Array<{ key: string; expect: string | null }>;
  pushed: string[];
  tombstoned: string[];
  conflicts: RecordConflict[];
  deferred: DeferredRecord[];
  /** The profile and design-system records as the store now holds them. */
  bodies: Map<string, Record<string, unknown>>;
  reused: number;
}

interface PlanContext {
  local: Map<string, LocalRecord>;
  index: RecordIndex;
  /** The base that applies to this store; null for a first sync or a forced one. */
  base: RecordSyncBase | null;
  keys: StoreKeys | null;
  open: OpenRemote;
  stamp: string;
  force: boolean;
  device?: string;
  maxUploadBytes?: number;
  /** Objects this sync wrote in earlier attempts. */
  uploadedNames: ReadonlySet<string>;
}

/** Decide every record, then build the next index and the local writes that follow the index write. */
async function planRecordSync(ctx: PlanContext): Promise<RecordPlan> {
  const { local, index, keys, stamp } = ctx;
  const next: RecordIndex = { ...index, records: { ...index.records }, retired: { ...index.retired }, removing: { ...index.removing } };
  const plan: RecordPlan = {
    next, uploads: new Map(), writes: [], deletes: [], pushed: [], tombstoned: [], conflicts: [], deferred: [], bodies: new Map(), reused: 0,
  };
  const signed = ctx.device ? { writtenBy: ctx.device } : {};

  // The store's object for each content hash, so identical content is uploaded once.
  const known = new Map<string, string>();
  for (const entry of Object.values(index.records)) {
    if (entry.deletedAt) continue;
    if (entry.object) known.set(entry.hash, entry.object);
    for (const [digest, name] of Object.entries(entry.parts ?? {})) known.set(digest, name);
  }
  const inStore = new Set(known.keys());
  const nameFor = async (hash: string): Promise<string> => {
    const found = known.get(hash);
    if (found) {
      if (inStore.has(hash)) plan.reused++;
      return found;
    }
    const base = await objectNameFor(keys, hash);
    let name = base;
    for (let n = 1; name in next.removing; n++) name = `${base}.${n}`;
    known.set(hash, name);
    return name;
  };

  /** Put a record in the next index, with the uploads it needs. False when one of
   *  its objects is larger than this shell can send. */
  const stage = async (key: string, rec: LocalRecord): Promise<boolean> => {
    const overhead = keys ? SEAL_OVERHEAD : 0;
    const sizes = [rec.body.length, ...[...rec.parts.values()].map((p) => p.size)];
    if (ctx.maxUploadBytes !== undefined && sizes.some((n) => n + overhead > ctx.maxUploadBytes!)) {
      plan.deferred.push({ key, reason: 'too-large' });
      return false;
    }
    const isNew = (hash: string): boolean => !known.has(hash);
    const parts: Record<string, string> = {};
    for (const [digest, part] of rec.parts) {
      const fresh = isNew(digest);
      parts[digest] = await nameFor(digest);
      if (fresh) plan.uploads.set(parts[digest]!, { hash: digest, read: () => part.read() });
    }
    const fresh = isNew(rec.hash);
    const object = await nameFor(rec.hash);
    if (fresh) plan.uploads.set(object, { hash: rec.hash, read: async () => rec.body });
    next.records[key] = {
      hash: rec.hash, object, ...(rec.parts.size ? { parts } : {}),
      size: sizes.reduce((a, b) => a + b, 0), updatedAt: stamp, ...signed,
    };
    if (rec.kind === 'profile' || rec.kind === 'design-system') plan.bodies.set(key, rec.value);
    return true;
  };

  const keysToDecide = new Set([...local.keys(), ...Object.keys(index.records), ...Object.keys(ctx.base?.entries ?? {})]);
  const resolve: string[] = [];
  for (const key of [...keysToDecide].sort()) {
    const parsed = parseRecordKey(key);
    if (!parsed) continue;                      // a kind from a newer build: left as it is
    const here = local.get(key);
    const store = index.records[key];
    const decision = ctx.force
      ? classifyForced(here?.hash ?? null, store)
      : classify({ here: here?.hash ?? null, base: ctx.base?.entries[key], store, hasBase: !!ctx.base, neverDeleted: neverDeleted(parsed.kind) });
    if (decision.editMetDelete) plan.conflicts.push({ key, kept: decision.editMetDelete, editMetDelete: decision.editMetDelete });
    if (decision.action === 'push') {
      if (await stage(key, here!)) plan.pushed.push(key);
    } else if (decision.action === 'tombstone') {
      next.records[key] = { hash: store!.hash, size: 0, updatedAt: stamp, deletedAt: stamp, ...signed };
      plan.tombstoned.push(key);
    } else if (decision.action === 'pull') {
      plan.writes.push({ key, expect: here?.hash ?? null, entry: store! });
    } else if (decision.action === 'drop') {
      plan.deletes.push({ key, expect: here?.hash ?? null });
    } else if (decision.action === 'resolve') {
      resolve.push(key);
    }
  }

  for (const key of resolve) {
    const { kind, id } = parseRecordKey(key)!;
    const here = local.get(key)!;
    const store = index.records[key]!;
    let storeValue: Record<string, unknown>;
    try {
      storeValue = await readRecordValue(ctx.open, keys, store);
    } catch (err) {
      plan.deferred.push({ key, reason: err instanceof MissingObjectError ? 'missing' : 'failed', message: (err as Error)?.message });
      continue;
    }
    if (kind === 'profile' || kind === 'design-system') {
      const baseBody = ctx.base?.bodies?.[key] ?? null;
      const merged = await makeRecord(kind, id, (kind === 'profile' ? mergeProfileValues : mergeDesignSystemValues)(baseBody, here.value, storeValue));
      if (merged.hash !== store.hash) {
        if (!(await stage(key, merged))) continue;
        plan.pushed.push(key);
      }
      plan.bodies.set(key, merged.value);
      if (merged.hash !== here.hash) plan.writes.push({ key, expect: here.hash, record: merged });
      plan.conflicts.push({ key, kept: 'merged' });
      continue;
    }
    if (kind === 'pref' || kind === 'active-design-system') {
      plan.writes.push({ key, expect: here.hash, entry: store, value: storeValue });
      plan.conflicts.push({ key, kept: 'store' });
      continue;
    }
    // Sessions and uploaded assets: the copy saved later stays at the key, and the other
    // copy is kept too, under a new id. Equal or unknown times keep the store's copy at the key.
    const hereAt = recordTime(kind, here.value);
    const storeAt = recordTime(kind, storeValue);
    const hereWins = hereAt !== null && storeAt !== null && hereAt > storeAt;
    const loser = hereWins ? { value: storeValue, hash: store.hash } : here;
    let copyId: string | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = await conflictCopyId(kind, id, loser, attempt);
      if (candidate === null) break;
      const atCopy = index.records[recordKey(kind, candidate)];
      const hereCopy = local.get(recordKey(kind, candidate));
      if ((!atCopy || atCopy.deletedAt || atCopy.hash === loser.hash) && (!hereCopy || hereCopy.hash === loser.hash)) { copyId = candidate; break; }
    }
    const copyKey = copyId === null ? null : recordKey(kind, copyId);
    if (hereWins) {
      if (!(await stage(key, here))) continue;
      plan.pushed.push(key);
      if (copyKey) {
        if (index.records[copyKey]?.hash !== store.hash || index.records[copyKey]?.deletedAt) next.records[copyKey] = { ...store, updatedAt: stamp, ...signed };
        if (local.get(copyKey)?.hash !== store.hash) plan.writes.push({ key: copyKey, expect: local.get(copyKey)?.hash ?? null, copy: true, entry: store, value: storeValue });
      }
    } else {
      if (copyKey) {
        const copy = rekeyRecord(here, copyId!);
        const stored = index.records[copyKey];
        if ((!stored || stored.deletedAt || stored.hash !== here.hash) && !(await stage(copyKey, copy))) continue;
        if (local.get(copyKey)?.hash !== here.hash) plan.writes.push({ key: copyKey, expect: local.get(copyKey)?.hash ?? null, copy: true, record: copy });
      }
      plan.writes.push({ key, expect: here.hash, entry: store, value: storeValue, ...(copyKey ? { requires: copyKey } : {}) });
    }
    plan.conflicts.push({ key, kept: copyKey ? 'both' : hereWins ? 'here' : 'store', ...(copyKey ? { copy: copyKey } : {}) });
  }

  // Tombstones past their retention leave the index; a device whose base still
  // lists the record reads the absence as the same deletion.
  const stampMs = Date.parse(stamp);
  const expired = (when: string | undefined, ms: number): boolean => !!when && stampMs - Date.parse(when) > ms;
  for (const [key, entry] of Object.entries(next.records)) if (expired(entry.deletedAt, TOMBSTONE_RETENTION_MS)) delete next.records[key];

  // Objects that stop being named, including any this sync wrote in an attempt that
  // lost the race, are listed for removal later; names in use again leave the list.
  const live = liveNames(next);
  for (const name of [...liveNames(index), ...ctx.uploadedNames]) {
    if (!live.has(name) && !(name in next.removing) && !(name in next.retired)) next.retired[name] = stamp;
  }
  for (const name of live) delete next.retired[name];
  const retired = Object.entries(next.retired);
  if (retired.length > RETIRED_LIMIT) {
    retired.sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
    next.retired = Object.fromEntries(retired.slice(0, RETIRED_LIMIT));
  }
  return plan;
}

const WRITE_ORDER: Record<RecordKind, number> = { session: 0, profile: 1, 'design-system': 2, asset: 3, pref: 4, 'active-design-system': 5 };

/** Make this device's writes and removals, after the index is written. */
async function applyRecordPlan(
  deps: BackupDeps, ctx: { open: OpenRemote; keys: StoreKeys | null }, plan: RecordPlan,
): Promise<{
  written: Map<string, Record<string, unknown>>; removed: Set<string>; touched: Set<string>;
  pulled: string[]; removedHere: string[]; deferred: DeferredRecord[];
}> {
  const written = new Map<string, Record<string, unknown>>();
  const removed = new Set<string>();
  const pulled: string[] = [];
  const removedHere: string[] = [];
  const deferred: DeferredRecord[] = [];
  const touched = new Set([...plan.writes.map((w) => w.key), ...plan.deletes.map((d) => d.key)]);
  if (!touched.size) return { written, removed, touched, pulled, removedHere, deferred };
  const now = await collectLocalRecords(deps, touched);
  const changedHere = (key: string, expect: string | null): boolean => (now.get(key)?.hash ?? null) !== expect;

  const failedCopies = new Set<string>();
  const touchedAlso = new Set<string>();
  // Conflict copies first, then the order a backup restores in: a design system's
  // record exists before its material and before it can be made the active one.
  const order = (w: LocalWrite): number => (w.copy ? -1 : WRITE_ORDER[parseRecordKey(w.key)!.kind]);
  const writes = [...plan.writes].sort((x, y) => order(x) - order(y));
  for (const w of writes) {
    if (changedHere(w.key, w.expect) || (w.requires && failedCopies.has(w.requires))) {
      deferred.push({ key: w.key, reason: 'changed-here' });
      if (w.copy) failedCopies.add(w.key);
      continue;
    }
    try {
      const { kind, id } = parseRecordKey(w.key)!;
      let value: Record<string, unknown>;
      const parts = new Map<string, Uint8Array>();
      if (w.record) {
        value = w.record.value;
        for (const [digest, part] of w.record.parts) parts.set(digest, await part.read());
      } else {
        value = w.value ?? await readRecordValue(ctx.open, ctx.keys, w.entry!);
        for (const digest of partDigests(value)) parts.set(digest, await readObject(ctx.open, ctx.keys, w.entry!.parts?.[digest], digest));
      }
      await writeLocalRecord(deps, kind, id, value, parts);
      written.set(w.key, value);
      pulled.push(w.key);
      // Choosing the active design system also stamps that system's record here.
      if (kind === 'active-design-system' && typeof value.id === 'string') touchedAlso.add(recordKey('design-system', value.id));
    } catch (err) {
      if (w.copy) failedCopies.add(w.key);
      deferred.push({ key: w.key, reason: err instanceof MissingObjectError ? 'missing' : 'failed', message: (err as Error)?.message ?? String(err) });
    }
  }
  for (const d of plan.deletes) {
    if (changedHere(d.key, d.expect)) { deferred.push({ key: d.key, reason: 'changed-here' }); continue; }
    try {
      const { kind, id } = parseRecordKey(d.key)!;
      if (await removeLocalRecord(deps, kind, id)) removedHere.push(d.key);
      removed.add(d.key);
    } catch (err) {
      deferred.push({ key: d.key, reason: 'failed', message: (err as Error)?.message ?? String(err) });
    }
  }
  return { written, removed, touched: new Set([...written.keys(), ...removed, ...touchedAlso]), pulled, removedHere, deferred };
}

/**
 * Sync this device with a per-record store: decide each record against this
 * device's base (sync-merge.ts), send what changed here, write the index with a
 * conditional write (reading and merging again when another device wrote first),
 * then bring this device's records in line. Nothing is lost: a record edited on
 * both sides is merged or kept twice, and an edit that meets a deletion is kept.
 *
 * Returns the new base for the caller to keep on this device, and what happened.
 * Throws, with this device and the store unchanged, when the index cannot be
 * opened (passphrase missing or wrong, a newer format), when the store served an
 * older index than this device synced, or when other devices kept writing first.
 */
export async function syncRecords(deps: BackupDeps, opts: RecordSyncOpts): Promise<RecordSyncResult> {
  const { open, passphrase, force = false } = opts;
  const local = await collectLocalRecords(deps);
  const uploadedNames = new Set<string>();
  const uploaded = { objects: 0, bytes: 0 };
  let reusedInStore = 0;
  for (let attempt = 0; attempt < INDEX_ATTEMPTS; attempt++) {
    const read = await readRecordIndex(open, passphrase || undefined, force);
    const index = read.index ?? emptyIndex();
    const sameStore = !!(read.index && opts.base && opts.base.store === read.index.store);
    if (sameStore && !force && index.seq < opts.base!.seq) throw new SyncRollbackError();
    const keys = passphrase ? read.keys ?? await deriveStoreKeys(passphrase) : null;
    const plan = await planRecordSync({
      local, index, base: sameStore && !force ? opts.base : null, keys, open, stamp: opts.now(), force,
      device: opts.device, maxUploadBytes: opts.maxUploadBytes, uploadedNames,
    });

    await eachLimited([...plan.uploads], TRANSFER_CONCURRENCY, async ([name, up]) => {
      const remote = await open(recordObjectPath(name));
      if (await remote.head()) { reusedInStore++; return; }
      const plain = await up.read();
      if (await sha256Hex(plain) !== up.hash) throw new Error('Your data changed while it was syncing. It will sync again shortly.');
      const bytes = keys ? await sealObject(keys, plain, 'object') : plain;
      await remote.put(bytes);
      uploadedNames.add(name);
      uploaded.objects++;
      uploaded.bytes += bytes.length;
    });

    let rev = read.rev;
    const changed = read.index
      ? canonicalJson({ ...read.index, seq: 0 }) !== canonicalJson({ ...plan.next, seq: 0 })
      : Object.keys(plan.next.records).length > 0;
    if (changed) {
      plan.next.seq = Math.max(index.seq, sameStore ? opts.base!.seq : 0) + 1;
      try {
        rev = (await writeRecordIndex(open, keys, plan.next, read.rev)).rev;
      } catch (err) {
        if (err instanceof SyncConflictError) continue;   // another device wrote first: read and merge again
        throw err;
      }
    }

    const applied = await applyRecordPlan(deps, { open, keys }, plan);
    const deferred = [...plan.deferred, ...applied.deferred];
    const after = await collectLocalRecords(deps, applied.touched);
    const previous = sameStore && !force ? opts.base : null;
    const entries: Record<string, BaseEntry> = {};
    const bodies: Record<string, Record<string, unknown>> = {};
    const left = new Set(deferred.map((d) => d.key));
    for (const key of new Set([...Object.keys(plan.next.records), ...local.keys(), ...Object.keys(previous?.entries ?? {})])) {
      const kind = parseRecordKey(key)?.kind;
      if (!kind) continue;
      if (left.has(key)) {
        // Left for the next sync: keep what this device knew, so it is decided again.
        if (previous?.entries[key]) entries[key] = previous.entries[key]!;
        if (previous?.bodies?.[key]) bodies[key] = previous.bodies[key]!;
        continue;
      }
      const entry = plan.next.records[key];
      const remote = entry && !entry.deletedAt ? entry.hash : null;
      const here = applied.touched.has(key) ? after.get(key)?.hash ?? null : local.get(key)?.hash ?? null;
      if (remote === null && here === null) continue;
      entries[key] = { remote, local: here };
      if (remote !== null && (kind === 'profile' || kind === 'design-system')) {
        const body = plan.bodies.get(key) ?? applied.written.get(key)
          ?? (local.get(key)?.hash === remote ? local.get(key)!.value : undefined)
          ?? (previous?.entries[key]?.remote === remote ? previous.bodies?.[key] : undefined);
        if (body) bodies[key] = body;
      }
    }
    return {
      rev,
      base: { store: plan.next.store, seq: changed ? plan.next.seq : index.seq, entries, ...(Object.keys(bodies).length ? { bodies } : {}) },
      pushed: plan.pushed,
      tombstoned: plan.tombstoned,
      pulled: applied.pulled,
      removedHere: applied.removedHere,
      conflicts: plan.conflicts,
      deferred,
      uploaded,
      reused: plan.reused + reusedInStore,
    };
  }
  throw new SyncConflictError('Your synced data kept changing on another device. Sync again in a moment.');
}

/**
 * Remove objects nothing has named for RETIRED_GRACE_MS, when the store can remove
 * objects (the optional `SyncRemote.remove`). Two index writes keep this safe
 * beside devices syncing at the same time: the first moves the names to
 * `removing`, which no device reuses, so a device that read the index before
 * cannot write an index naming them (its conditional write fails and it reads
 * again); then the objects go, and the second write forgets them. A removal that
 * stopped part way is finished by the next device. Returns how many were removed.
 */
export async function collectRecordGarbage(open: OpenRemote, opts: { passphrase?: string; now: () => string }): Promise<number> {
  const probe = await open(recordObjectPath('probe'));
  if (typeof probe.remove !== 'function') return 0;
  let removedCount = 0;
  let toForget: string[] = [];
  for (let attempt = 0; attempt < INDEX_ATTEMPTS * 2; attempt++) {
    const read = await readRecordIndex(open, opts.passphrase || undefined, false);
    if (!read.index) return removedCount;
    const index = read.index;
    const stamp = opts.now();
    const stampMs = Date.parse(stamp);
    const live = liveNames(index);
    if (toForget.length) {
      // Second write: forget the names whose objects are gone.
      const removing = Object.fromEntries(Object.entries(index.removing).filter(([name]) => !toForget.includes(name)));
      try {
        await writeRecordIndex(open, read.keys, { ...index, seq: index.seq + 1, removing }, read.rev);
        return removedCount;
      } catch (err) {
        if (err instanceof SyncConflictError) continue;
        throw err;
      }
    }
    const due = Object.entries(index.retired)
      .filter(([name, since]) => !live.has(name) && stampMs - Date.parse(since) > RETIRED_GRACE_MS).map(([name]) => name);
    const stale = Object.entries(index.removing)
      .filter(([name, at]) => !live.has(name) && stampMs - Date.parse(at) > REMOVING_STALE_MS).map(([name]) => name);
    if (!due.length && !stale.length) return removedCount;
    if (due.length) {
      const retired = Object.fromEntries(Object.entries(index.retired).filter(([name]) => !due.includes(name)));
      const removing = { ...index.removing, ...Object.fromEntries(due.map((name) => [name, stamp])) };
      try {
        await writeRecordIndex(open, read.keys, { ...index, seq: index.seq + 1, retired, removing }, read.rev);
      } catch (err) {
        if (err instanceof SyncConflictError) continue;
        throw err;
      }
    }
    const gone: string[] = [];
    for (const name of [...due, ...stale]) {
      try {
        await (await open(recordObjectPath(name))).remove?.();
        gone.push(name);
        removedCount++;
      } catch { /* left in `removing`: the next device finishes it */ }
    }
    if (!gone.length) return removedCount;
    toForget = gone;
  }
  return removedCount;
}
