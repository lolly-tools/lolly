// SPDX-License-Identifier: MPL-2.0
/**
 * sync-service (plans/138 B1, hardened by Tier D) - the shell-facing glue over the
 * pure sync engine: resolves the configured provider to a SyncRemote, threads the
 * passphrase, and keeps the device-local bookkeeping in sync-config. Everything
 * mechanical (export/encrypt/put, head-compare, get/decrypt/import) lives in
 * sync-engine.ts; this wires it to the person's chosen provider and settings.
 *
 * What it adds on top of the engine (plans/138 Tier D):
 *   - conflicts: a refused push is recorded, automatic pushes pause, and the
 *     person chooses between the synced copy and this device;
 *   - a first join never overwrites an existing synced copy by itself;
 *   - every apply first saves this device to the before-apply slot, so it can be
 *     undone, and removes only what another device deleted;
 *   - a daily copy beside the snapshot, and the list of copies to restore from;
 *   - the triggers: any local write (lib/sync-changes.ts), coming back online,
 *     coming back to the foreground, and going to the background.
 *
 * THE DRIVER AND ENGINE EDGES ARE DYNAMIC ON PURPOSE (plans/155 task 3.3). What stays
 * static below is only what boot already carries anyway (i18n, feature-flags, the tiny
 * provider-connections + sync-config + sync-changes modules, instance-choice);
 * everything else loads on demand. main.ts imports this file statically for
 * `initSyncAutoPush` + `maybeApplyNewerAtBoot`, so this module IS the boot path - and
 * a single static `import` here re-anchors whatever it names onto the entry's
 * modulepreload set, where it downloads and parses before first paint whether or not
 * the user has ever configured sync. Measured on the 2026-08-25 build, the static
 * edges this file used to carry were:
 *   - the four sync drivers: google-drive 2.9 + s3-send 2.0 + dropbox-send 1.9 +
 *     nextcloud-send 1.6 KB gz, plus provider-auth 1.7 behind google-drive;
 *   - sync-engine → data-transfer → lib/zip → fflate: the fflate worker build alone is
 *     7.9 KB gz, plus data-transfer 2.4, lib/bundle 0.7 and lib/zip 0.4.
 * ~21 KB gz of cloud plumbing on the critical path of a first visit that has no cloud.
 * Both clusters are now behind `await import(...)` at their real point of use. Keep it
 * that way: re-adding a top-level import of a driver or of sync-engine silently puts
 * the whole subtree back (this is exactly how `nextcloud-send` survived task 3.3's
 * first pass, which only lazied `send-targets-builtin.ts`).
 */

import { t, tRaw } from '../i18n.ts';
import { connectorEnabled } from '../feature-flags.ts';
import { hasConnection } from './provider-connections.ts';
import type { SyncRemote, SnapshotMeta } from './sync-remote.ts';
import type { BackupDeps } from './sync-engine.ts';
import { getSyncConfig, saveSyncConfig, syncStateOf, getSyncBase, saveSyncBase } from './sync-config.ts';
import { noteLocalChange, onLocalChange, localChangeSeq, withoutLocalChanges } from './sync-changes.ts';
import { isTauriShell } from './instance-choice.ts';
import { clearSignal } from './clear-signal.ts';

/** The sync engine's module type, for the return/handle types below. `typeof import()`
 *  in TYPE position is erased by tsc - it creates no runtime edge, unlike a top-level
 *  `import type` list that a later refactor can quietly turn into a value import. */
type SyncEngine = typeof import('./sync-engine.ts');
type SyncScheduler = ReturnType<SyncEngine['makeSyncScheduler']>;

/** Where a copy lives in the person's store: the sync snapshot, one of the seven
 *  daily copies, or the copy saved before the last apply (plans/138 Tier D, WP-S3). */
export type SyncSlot = 'snapshot' | `day-${number}` | 'before-apply';

/** The store path for a slot, per provider; undefined = the adapter's own default
 *  (the sync snapshot). Drive has no folders under drive.file, so the name is flat. */
function slotPath(kind: string, slot: SyncSlot): string | undefined {
  if (slot === 'snapshot') return undefined;
  const name = `lolly-backup/${slot}.lolly`;
  if (kind === 'gdrive') return name.replace('/', '-');
  if (kind === 'dropbox') return `/${name}`;
  return name;
}

/** Provider kinds that have a two-way SyncRemote today. Each maps to a LOADER over the
 *  existing connected credentials: the kinds (what `availableSyncProviders` enumerates)
 *  stay static and free, while the driver bytes arrive only once a remote is actually
 *  resolved. `path` points the adapter at a slot; undefined keeps its default. */
const REMOTES: Record<string, (path?: string) => Promise<SyncRemote>> = {
  s3: async (path) => (await import('./s3-send.ts')).s3SyncRemote(undefined, path),
  webdav: async (path) => (await import('./nextcloud-send.ts')).webdavSyncRemote(undefined, path),
  gdrive: async (path) => (await import('./google-drive.ts')).driveSyncRemote(undefined, path),
  dropbox: async (path) => (await import('./dropbox-send.ts')).dropboxSyncRemote(undefined, path),
  o365: async (path) => (await import('./onedrive-send.ts')).onedriveSyncRemote(undefined, path),
};

/** The native request command in the Tauri apps caps one request body at 256 MiB
 *  (remote_fetch.rs in both Tauri shells, MAX_REQUEST_BYTES). */
const NATIVE_MAX_REQUEST_BYTES = 256 * 1024 * 1024;
const maxUploadBytes = (): number | undefined => (isTauriShell() ? NATIVE_MAX_REQUEST_BYTES : undefined);

/** Localised label per sync provider kind (aligned with the send-target labels). */
export function syncProviderLabel(kind: string): string {
  if (kind === 's3') return t('S3 bucket');
  if (kind === 'webdav') return t('Nextcloud / WebDAV');
  if (kind === 'gdrive') return t('Google Drive');
  if (kind === 'dropbox') return t('Dropbox');
  if (kind === 'o365') return t('OneDrive');
  return kind;
}

/** Provider kinds this build can sync with, whether or not they are connected
 *  (the connector kill switch still applies). Feeds lib/sync-choices.ts. */
export function syncProviderKinds(): string[] {
  return Object.keys(REMOTES).filter((kind) => connectorEnabled(kind));
}

/** The sync providers usable right now: a SyncRemote exists, its credentials are
 *  connected on this device, AND its connector kill switch is on. Drives the
 *  /profile provider picker. */
export function availableSyncProviders(): Array<{ kind: string; label: string }> {
  return Object.keys(REMOTES)
    .filter((kind) => connectorEnabled(kind) && hasConnection(kind))
    .map((kind) => ({ kind, label: syncProviderLabel(kind) }));
}

/** The single resolution point for every sync path (manual and automatic), so the
 *  connector kill switch also stops a provider a previous session had configured:
 *  no remote, no push, no check. */
async function remoteFor(kind: string, slot: SyncSlot = 'snapshot'): Promise<SyncRemote | null> {
  if (clearSignal.writesBlocked()) return null;   // "Clear all my data" ran: see refuseAfterClear
  const testLoader = testRemotes.get(kind);
  if (testLoader) return refuseAfterClear(testLoader(slotPath(kind, slot)));
  if (!connectorEnabled(kind)) return null;
  const remote = (await REMOTES[kind]?.(slotPath(kind, slot))) ?? null;
  return remote && refuseAfterClear(remote);
}

/** Said when sync is refused in a tab that has not reloaded since a clear. */
const clearedMessage = (): string => t('Your data was cleared in another tab. Reload this tab to keep working.');

/**
 * No upload from a tab that must stop writing for "Clear all my data"
 * (lib/clear-signal.ts, plan 277 review B6). A push already under way when the
 * clear starts may have read part of the emptied database, so the check runs
 * again right before the upload, not only when the push begins.
 */
function refuseAfterClear(remote: SyncRemote): SyncRemote {
  return {
    kind: remote.kind,
    head: () => remote.head(),
    get: () => remote.get(),
    put: (bytes, opts) => (clearSignal.writesBlocked() ? Promise.reject(new Error(clearedMessage())) : remote.put(bytes, opts)),
    ...(remote.canSyncSilently ? { canSyncSilently: () => remote.canSyncSilently!() } : {}),
  };
}

const testRemotes = new Map<string, (path?: string) => SyncRemote>();

/** Test seam: resolve `kind` to in-memory stores (one per path) instead of a driver. */
export function setSyncRemoteForTests(kind: string, loader: ((path?: string) => SyncRemote) | null): void {
  if (loader) testRemotes.set(kind, loader); else testRemotes.delete(kind);
}

async function requireRemote(kind: string, slot: SyncSlot = 'snapshot'): Promise<SyncRemote> {
  const remote = await remoteFor(kind, slot);
  if (!remote) throw new Error(clearSignal.writesBlocked() ? clearedMessage() : t('Pick a connected provider for sync first.'));
  return remote;
}

/** Can this remote work without an interactive sign-in right now? Credential
 *  remotes omit the check (always silent); OAuth remotes answer per their token
 *  state. Used to keep the AUTO paths from popping a sign-in outside a gesture. */
async function isSilent(remote: SyncRemote): Promise<boolean> {
  return remote.canSyncSilently ? await remote.canSyncSilently() : true;
}

const megabytes = (bytes: number): number => Math.ceil(bytes / (1024 * 1024));

/** A sync that trying again will not fix (the data is too large). Automatic sync
 *  records it for the status line and stops retrying. */
export class SyncRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncRefusedError';
  }
}

/** A size refusal in words, or null when `err` is something else. */
async function tooLargeMessage(err: unknown): Promise<string | null> {
  const { SyncTooLargeError } = await import('./sync-engine.ts');
  if (!(err instanceof SyncTooLargeError)) return null;
  if (err.limit === 'restore-entry') {
    return t('One item is too large to sync ({size} MB; the limit is {max} MB). Remove it or keep it out of your library, then sync again.', { size: megabytes(err.bytes), max: megabytes(err.max) });
  }
  if (err.limit === 'upload') {
    return t('Your data is too large to sync from this app ({size} MB; the limit is {max} MB). Sync from a browser, or remove large items.', { size: megabytes(err.bytes), max: megabytes(err.max) });
  }
  return t('Your data is too large to sync ({size} MB; the limit is {max} MB). Remove large items, then sync again.', { size: megabytes(err.bytes), max: megabytes(err.max) });
}

/** What a push did. */
export type SyncNowResult =
  | { status: 'pushed'; meta: SnapshotMeta }
  /** The store has a newer copy and this device has nothing of its own to add:
   *  the next step is to apply it, which is not a conflict. */
  | { status: 'newer'; remote: SnapshotMeta | null }
  | { status: 'conflict'; remote: SnapshotMeta | null };

/**
 * Push this device's state to the configured sync home now. Refused as a conflict
 * when the synced copy changed elsewhere, unless `force` says the person chose to
 * replace it. Throws with a user-presentable message when nothing is configured
 * or the data is too large.
 */
export async function syncNow(deps: BackupDeps, { force = false }: { force?: boolean } = {}): Promise<SyncNowResult> {
  const cfg = await getSyncConfig();
  const remote = await requireRemote(cfg.providerKind);
  const engine = await import('./sync-engine.ts');
  const seqAtStart = localChangeSeq();
  let result: Awaited<ReturnType<SyncEngine['pushSnapshot']>>;
  try {
    result = await engine.pushSnapshot(deps, remote, {
      state: syncStateOf(cfg), force, passphrase: cfg.passphrase || undefined, maxUploadBytes: maxUploadBytes(),
    });
  } catch (err) {
    const refused = await tooLargeMessage(err);
    const message = refused ?? (err as Error)?.message ?? String(err);
    await saveSyncConfig({ lastError: message });
    throw refused ? new SyncRefusedError(refused) : new Error(message);
  }
  if (result.status === 'conflict') {
    if (!cfg.dirty && cfg.lastSyncedRev !== null) return { status: 'newer', remote: result.remote };
    await recordConflict(result.remote);
    return result;
  }
  await saveSyncBase(result.ids);
  // An edit made while the upload ran is not in this copy, so it stays waiting.
  const settled = localChangeSeq() === seqAtStart;
  await saveSyncConfig({
    lastSyncedRev: result.state.lastSyncedRev,
    lastSyncedAt: result.state.lastSyncedAt,
    conflict: null,
    lastError: null,
    ...(settled ? { dirty: false } : {}),
  });
  if (settled) dirtyStored = false;
  // A daily copy beside the snapshot. Best-effort: the push already succeeded.
  const kind = cfg.providerKind;
  const slots = new Map<number, SyncRemote>();
  for (let day = 1; day <= engine.DAILY_SLOTS; day++) {
    const slotRemote = await remoteFor(kind, `day-${day}`);
    if (slotRemote) slots.set(day, slotRemote);
  }
  try {
    await engine.writeDailyCopy(result.bytes, result.meta, (day) => slots.get(day)!);
  } catch (err) {
    console.warn('Sync: the daily copy was not written:', err);
  }
  return { status: 'pushed', meta: result.meta };
}

async function recordConflict(remote: SnapshotMeta | null): Promise<void> {
  const cfg = await getSyncConfig();
  const known = cfg.conflict?.rev === remote?.rev;
  await saveSyncConfig({
    conflict: remote ?? { rev: '', updatedAt: '', size: 0 },
    ...(known ? {} : { conflictCount: (cfg.conflictCount ?? 0) + 1 }),
  });
}

/** Is there a snapshot in the cloud this device hasn't written or applied? Cheap
 *  (head only). Returns {hasNewer:false} when no provider is configured. NOT gated
 *  on the enabled toggle - that governs AUTO behaviour; a manual "Check" works
 *  whenever a provider is set. */
export async function checkNewer(): Promise<{ hasNewer: boolean; meta: SnapshotMeta | null }> {
  const cfg = await getSyncConfig();
  const remote = await remoteFor(cfg.providerKind);
  if (!remote) return { hasNewer: false, meta: null };
  const { checkForNewer } = await import('./sync-engine.ts');
  return checkForNewer(remote, syncStateOf(cfg));
}

/**
 * The first-join question (WP-S1): this device has never synced with the chosen
 * store, and the store already holds a copy. Returns that copy's meta, or null
 * when there is nothing to ask.
 */
export async function existingCopyForFirstJoin(): Promise<SnapshotMeta | null> {
  const cfg = await getSyncConfig();
  if (cfg.lastSyncedRev !== null) return null;
  const remote = await remoteFor(cfg.providerKind);
  return remote ? remote.head() : null;
}

/** How an apply treats this device. 'sync' is the normal case: remove only what
 *  another device deleted, and take the copy's profile record. 'merge' adds and
 *  updates only, and merges the profile record: the folders, favourites,
 *  templates and settings on this device stay (a first join, plans/277 P7). 'all'
 *  makes this device match the copy exactly (restoring an earlier copy). */
export type ApplyMode = 'sync' | 'merge' | 'all';

/**
 * Download a copy and apply it to this device, after saving this device to the
 * before-apply slot. Throws with a user-presentable message on any failure, with
 * this device unchanged. Callers reload the page afterwards.
 */
async function applyFrom(deps: BackupDeps, slot: SyncSlot, mode: ApplyMode): Promise<Awaited<ReturnType<SyncEngine['pullAndApply']>>> {
  const cfg = await getSyncConfig();
  const remote = await requireRemote(cfg.providerKind, slot);
  const undoSlot = await requireRemote(cfg.providerKind, 'before-apply');
  const engine = await import('./sync-engine.ts');
  const base = await getSyncBase();
  const replace = mode === 'all' ? 'all' as const
    : mode === 'sync' && cfg.lastSyncedRev !== null && base ? { removable: base } : undefined;
  const opts = { passphrase: cfg.passphrase || undefined, maxUploadBytes: maxUploadBytes() };
  const profile = mode === 'merge' ? 'merge' as const : 'replace' as const;
  const beforeApply = async (): Promise<void> => {
    try {
      await engine.saveCopy(deps, undoSlot, opts);
    } catch (err) {
      const reason = (await tooLargeMessage(err)) ?? (err as Error)?.message ?? String(err);
      throw new Error(isTauriShell()
        ? tRaw('Nothing was changed: this device could not be saved to your sync home first. {reason}', { reason })
        : tRaw('Nothing was changed: this browser’s data could not be saved to your sync home first. {reason}', { reason }));
    }
  };
  return withoutLocalChanges(() => engine.pullAndApply(deps, remote, { ...opts, replace, profile, beforeApply }));
}

/**
 * Apply the synced copy to this device. A device with changes of its own is not
 * overwritten unless `useSynced` says the person chose the synced copy; without
 * it, the conflict is recorded and the call reports that instead.
 */
export async function applyNewer(
  deps: BackupDeps, { useSynced = false }: { useSynced?: boolean } = {},
): Promise<{ status: 'applied' } | { status: 'conflict' }> {
  const cfg = await getSyncConfig();
  if (cfg.dirty && !useSynced) {
    await recordConflict((await checkNewer()).meta);
    return { status: 'conflict' };
  }
  const { state, ids } = await applyFrom(deps, 'snapshot', 'sync');
  await saveSyncBase(ids);
  await saveSyncConfig({
    lastSyncedRev: state.lastSyncedRev, lastSyncedAt: state.lastSyncedAt,
    dirty: false, conflict: null, lastError: null,
  });
  dirtyStored = false;
  return { status: 'applied' };
}

/**
 * First join, "Bring it here": add the synced copy to this device without removing
 * anything (folders, favourites, templates and Trash are merged, and this device's
 * settings stay), then push, so the store also gets what only this device had.
 */
export async function joinBringHere(deps: BackupDeps): Promise<void> {
  const { state, ids } = await applyFrom(deps, 'snapshot', 'merge');
  await saveSyncBase(ids);
  await saveSyncConfig({ lastSyncedRev: state.lastSyncedRev, lastSyncedAt: state.lastSyncedAt, conflict: null, lastError: null });
  await syncNow(deps);
}

/** "Keep this device": replace the synced copy with this device. */
export async function keepThisDevice(deps: BackupDeps): Promise<void> {
  await syncNow(deps, { force: true });
}

/** One copy the person can restore from. */
export interface RestorePoint {
  slot: SyncSlot;
  meta: SnapshotMeta;
}

/** The daily copies and the before-apply copy that exist in the store, newest first. */
export async function listRestorePoints(): Promise<RestorePoint[]> {
  const cfg = await getSyncConfig();
  const { DAILY_SLOTS } = await import('./sync-engine.ts');
  const slots: SyncSlot[] = ['before-apply'];
  for (let day = 1; day <= DAILY_SLOTS; day++) slots.push(`day-${day}`);
  // A slot that does not exist answers null; a store that cannot be reached throws,
  // and that must reach the person rather than read as "no earlier copies".
  const found = await Promise.all(slots.map(async (slot) => {
    const remote = await requireRemote(cfg.providerKind, slot);
    const meta = await remote.head();
    return meta ? { slot, meta } : null;
  }));
  return found
    .filter((p): p is RestorePoint => p !== null)
    .sort((a, b) => (Date.parse(b.meta.updatedAt) || 0) - (Date.parse(a.meta.updatedAt) || 0));
}

/**
 * Make this device match an earlier copy, then make that the synced copy. This
 * device is saved to the before-apply slot first (reading the chosen copy happens
 * before that save, so restoring the before-apply copy itself works too).
 */
export async function restoreFrom(deps: BackupDeps, slot: SyncSlot): Promise<void> {
  await applyFrom(deps, slot, 'all');
  await saveSyncConfig({ dirty: true, conflict: null, lastError: null });
  await syncNow(deps, { force: true });
}

// ── Automatic sync ─────────────────────────────────────────────────────────────

/** Debounce window for coalescing a burst of edits into one push. The apps get a
 *  shorter one: a phone gives a backgrounded app only seconds (Tier D, R6). */
const PUSH_DEBOUNCE_MS = 8000;
const APP_PUSH_DEBOUNCE_MS = 2000;

let scheduler: SyncScheduler | null = null;
/** In flight or settled `armScheduler()` load, so the engine is fetched at most once. */
let arming: Promise<void> | null = null;
/** Set by initSyncAutoPush; also the "auto-push is wired" flag. */
let getBackupDeps: (() => BackupDeps) | null = null;
/** A change arrived while the engine was still loading - replayed on arrival, so the
 *  very first edit of a session can't fall through the lazy-load window. */
let dirtyBeforeArmed = false;
/** Whether this session already said "dirty" to sync-config, to avoid a write per edit. */
let dirtyStored = false;
/** One conflict notice per session is enough; the sync section keeps the state. */
let conflictNoticeShown = false;
let unsubscribe: (() => void) | null = null;

async function showConflictNotice(): Promise<void> {
  if (conflictNoticeShown || typeof document === 'undefined') return;
  conflictNoticeShown = true;
  const { showSyncConflictNotice } = await import('./sync-apply-prompt.ts');
  showSyncConflictNotice();
}

/** One automatic push, with every outcome recorded for the status line. */
async function autoPush(getDeps: () => BackupDeps): Promise<void> {
  const cfg = await getSyncConfig();
  if (!cfg.enabled || !cfg.dirty || cfg.conflict) return;
  const remote = await remoteFor(cfg.providerKind);
  if (!remote || !(await isSilent(remote))) return;   // never pop OAuth outside a user gesture
  // A device that never synced with this store must not overwrite a copy there;
  // syncNow's check turns that into a conflict, which the notice then explains.
  let result: SyncNowResult;
  try {
    result = await syncNow(getDeps());
  } catch (err) {
    if (err instanceof SyncRefusedError) return;       // retrying will not help; the status says why
    throw err;                                         // network or server trouble: retry later
  }
  if (result.status === 'conflict') await showConflictNotice();
}

/**
 * Build the debounced scheduler, pulling sync-engine (and, behind it, data-transfer +
 * fflate) in on demand. Called from the FIRST local change, not from boot: with
 * nothing dirty there is nothing to push, so a visit that never edits anything never
 * pays for the backup/zip stack at all. Idempotent and safe to call concurrently.
 */
function armScheduler(): Promise<void> {
  const getDeps = getBackupDeps;
  if (!getDeps) return Promise.resolve();
  arming ??= (async () => {
    const { makeSyncScheduler, RETRY_DELAYS_MS } = await import('./sync-engine.ts');
    // A reset (tests) or re-wire that happened while the engine was loading wins: arming
    // a scheduler over deps nobody holds any more would push stale state.
    if (scheduler || getDeps !== getBackupDeps) return;
    scheduler = makeSyncScheduler(() => autoPush(getDeps),
      isTauriShell() ? APP_PUSH_DEBOUNCE_MS : PUSH_DEBOUNCE_MS,
      { onError: (err) => console.warn('Sync push failed:', err), retryDelays: RETRY_DELAYS_MS });
    if (dirtyBeforeArmed) { dirtyBeforeArmed = false; scheduler.notifyChange(); }
  })();
  return arming;
}

/** Push now if this device has changes waiting (foreground, back online). */
async function pushIfWaiting(): Promise<void> {
  const cfg = await getSyncConfig();
  if (!cfg.enabled || !cfg.dirty || cfg.conflict) return;
  await armScheduler();
  await scheduler?.flush();
}

/** Flush whatever is pending on app-background/close. Returns immediately - without
 *  loading anything - when nothing has been marked dirty this session. */
async function flushPending(): Promise<void> {
  if (!scheduler && !arming) return;
  await arming;
  await scheduler?.flush();
}

function onChange(): void {
  if (!dirtyStored) {
    dirtyStored = true;
    void saveSyncConfig({ dirty: true });
  }
  if (scheduler) { scheduler.notifyChange(); return; }
  if (!getBackupDeps) return;
  dirtyBeforeArmed = true;
  void armScheduler();
}

/**
 * Wire automatic sync once at boot. `getDeps` returns the live backup deps (host +
 * storage). A local change → a debounced push; going to the background flushes it;
 * coming back to the foreground or back online pushes changes that are still
 * waiting. Every push re-reads the config and does nothing while sync is off or a
 * conflict is open, so enabling/disabling needs no re-wiring.
 */
export function initSyncAutoPush(getDeps: () => BackupDeps): void {
  if (getBackupDeps) return; // idempotent (re-entrant boot / HMR)
  getBackupDeps = getDeps;
  unsubscribe = onLocalChange(onChange);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      void (document.hidden ? flushPending() : pushIfWaiting());
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { void flushPending(); });
    window.addEventListener('online', () => { void pushIfWaiting(); });
    // The mobile apps send these when the app leaves or returns to the screen
    // (shells/tauri-mobile/src-tauri/src/lib.rs), where visibilitychange may not
    // fire. Waiting changes, whether from this visit or an earlier one, go now,
    // while the app may still run.
    window.addEventListener('lolly:app-suspended', () => { void pushIfWaiting(); });
    window.addEventListener('lolly:app-resumed', () => { void pushIfWaiting(); });
  }
  // Changes left waiting by an earlier visit (offline, closed too soon).
  void getSyncConfig().then((cfg) => {
    dirtyStored = !!cfg.dirty;
    if (cfg.enabled && cfg.dirty && !cfg.conflict) {
      dirtyBeforeArmed = true;
      void armScheduler();
    }
  }).catch(() => {});
}

/** Signal that the user's state changed. The bridge reports its own writes
 *  (lib/sync-changes.ts); this stays for the few changes that bypass it. */
export function markSyncDirty(): void {
  noteLocalChange();
}

/**
 * Boot touchpoint: if sync is on and a sibling device left a NEWER snapshot, offer
 * to apply it. A device with changes of its own gets the conflict notice instead.
 * Best-effort and non-blocking; a wrong/absent passphrase for an encrypted
 * snapshot sends the person to the sync section. Applying reloads so the restored
 * state is live everywhere.
 */
export async function maybeApplyNewerAtBoot(deps: BackupDeps): Promise<void> {
  let newer: { hasNewer: boolean; meta: SnapshotMeta | null } = { hasNewer: false, meta: null };
  let cfg: Awaited<ReturnType<typeof getSyncConfig>>;
  try {
    cfg = await getSyncConfig();
    if (!cfg.enabled || cfg.conflict) return;          // auto-apply only when sync is on
    const remote = await remoteFor(cfg.providerKind);
    if (!remote || !(await isSilent(remote))) return; // don't pop OAuth at boot
    newer = await checkNewer();
  } catch { return; }
  if (!newer.hasNewer) return;
  if (cfg.dirty || cfg.lastSyncedRev === null) {
    await recordConflict(newer.meta);
    await showConflictNotice();
    return;
  }
  const { promptSyncApply } = await import('./sync-apply-prompt.ts');
  await promptSyncApply(() => applyNewer(deps));
}

/** Test seam: drop the scheduler so initSyncAutoPush can be re-armed. */
export function resetSyncServiceForTests(): void {
  scheduler?.cancel();
  scheduler = null;
  arming = null;
  getBackupDeps = null;
  dirtyBeforeArmed = false;
  dirtyStored = false;
  conflictNoticeShown = false;
  unsubscribe?.();
  unsubscribe = null;
}
