// SPDX-License-Identifier: MPL-2.0
/**
 * sync-service (plans/138 B1) - the shell-facing glue over the pure sync engine:
 * resolves the configured provider to a SyncRemote, threads the passphrase, and
 * persists the rev bookkeeping back into sync-config. Everything mechanical
 * (export/encrypt/put, head-compare, get/decrypt/import) lives in sync-engine.ts;
 * this only wires it to the user's chosen provider and settings.
 *
 * It also owns the two runtime touchpoints:
 *   - auto-push: a debounced scheduler; `markSyncDirty()` from a mutation site
 *     coalesces a burst into one push, and app-background flushes it immediately.
 *   - boot check: `checkNewer()` for main.ts to offer "apply the newer snapshot".
 *
 * THE DRIVER AND ENGINE EDGES ARE DYNAMIC ON PURPOSE (plans/155 task 3.3). What stays
 * static below is only what boot already carries anyway (i18n, feature-flags, the tiny
 * provider-connections + sync-config readers); everything else loads on demand.
 * main.ts imports this file statically for `initSyncAutoPush` + `maybeApplyNewerAtBoot`,
 * so this module IS the boot path - and a single static `import` here re-anchors
 * whatever it names onto the entry's modulepreload set, where it downloads and parses
 * before first paint whether or not the user has ever configured sync. Measured on the
 * 2026-08-25 build, the static edges this file used to carry were:
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

import { t } from '../i18n.ts';
import { connectorEnabled } from '../feature-flags.ts';
import { hasConnection } from './provider-connections.ts';
import type { SyncRemote, SnapshotMeta } from './sync-remote.ts';
import type { BackupDeps } from './sync-engine.ts';
import { getSyncConfig, saveSyncConfig, syncStateOf } from './sync-config.ts';

/** The sync engine's module type, for the return/handle types below. `typeof import()`
 *  in TYPE position is erased by tsc - it creates no runtime edge, unlike a top-level
 *  `import type` list that a later refactor can quietly turn into a value import. */
type SyncEngine = typeof import('./sync-engine.ts');
type SyncScheduler = ReturnType<SyncEngine['makeSyncScheduler']>;

/** Provider kinds that have a two-way SyncRemote today. Each maps to a LOADER over the
 *  existing connected credentials: the kinds (what `availableSyncProviders` enumerates)
 *  stay static and free, while the driver bytes arrive only once a remote is actually
 *  resolved. WebDAV/Dropbox/Drive follow the same wrap-the-send-driver shape and slot
 *  in here. */
const REMOTES: Record<string, () => Promise<SyncRemote>> = {
  s3: async () => (await import('./s3-send.ts')).s3SyncRemote(),
  webdav: async () => (await import('./nextcloud-send.ts')).webdavSyncRemote(),
  gdrive: async () => (await import('./google-drive.ts')).driveSyncRemote(),
  dropbox: async () => (await import('./dropbox-send.ts')).dropboxSyncRemote(),
};

/** Localised label per sync provider kind (aligned with the send-target labels). */
export function syncProviderLabel(kind: string): string {
  if (kind === 's3') return t('S3 bucket');
  if (kind === 'webdav') return t('Nextcloud / WebDAV');
  if (kind === 'gdrive') return t('Google Drive');
  if (kind === 'dropbox') return t('Dropbox');
  return kind;
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
async function remoteFor(kind: string): Promise<SyncRemote | null> {
  if (!connectorEnabled(kind)) return null;
  return (await REMOTES[kind]?.()) ?? null;
}

/** Can this remote work without an interactive sign-in right now? Credential
 *  remotes omit the check (always silent); OAuth remotes answer per their token
 *  state. Used to keep the AUTO paths from popping a sign-in outside a gesture. */
async function isSilent(remote: SyncRemote): Promise<boolean> {
  return remote.canSyncSilently ? await remote.canSyncSilently() : true;
}

/** Push this device's state to the configured sync home now, updating the stored
 *  rev. Throws with a user-presentable message when nothing is configured. */
export async function syncNow(deps: BackupDeps): Promise<SnapshotMeta> {
  const cfg = await getSyncConfig();
  const remote = await remoteFor(cfg.providerKind);
  if (!remote) throw new Error(t('Pick a connected provider for sync first.'));
  const { pushSnapshot } = await import('./sync-engine.ts');
  const { meta, state } = await pushSnapshot(deps, remote, { passphrase: cfg.passphrase || undefined });
  await saveSyncConfig({ lastSyncedRev: state.lastSyncedRev, lastSyncedAt: state.lastSyncedAt });
  return meta;
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

/** Download the cloud snapshot and apply it OVER this device (last-write-wins),
 *  updating the stored rev. Throws on a missing/wrong passphrase or no snapshot. */
export async function applyNewer(deps: BackupDeps): Promise<Awaited<ReturnType<SyncEngine['pullAndApply']>>['summary']> {
  const cfg = await getSyncConfig();
  const remote = await remoteFor(cfg.providerKind);
  if (!remote) throw new Error(t('Pick a connected provider for sync first.'));
  const { pullAndApply } = await import('./sync-engine.ts');
  const { summary, state } = await pullAndApply(deps, remote, { passphrase: cfg.passphrase || undefined });
  await saveSyncConfig({ lastSyncedRev: state.lastSyncedRev, lastSyncedAt: state.lastSyncedAt });
  return summary;
}

// ── Auto-push (debounced, plus flush-on-background) ────────────────────────────

/** Debounce window for coalescing a burst of edits into one push. */
const PUSH_DEBOUNCE_MS = 8000;

let scheduler: SyncScheduler | null = null;
/** In flight or settled `armScheduler()` load, so the engine is fetched at most once. */
let arming: Promise<void> | null = null;
/** Set by initSyncAutoPush; also the "auto-push is wired" flag the old code read off
 *  `scheduler`, which is now null until the first change arrives. */
let getBackupDeps: (() => BackupDeps) | null = null;
/** A change arrived while the engine was still loading - replayed on arrival, so the
 *  very first edit of a session can't fall through the lazy-load window. */
let dirtyBeforeArmed = false;

/**
 * Build the debounced scheduler, pulling sync-engine (and, behind it, data-transfer +
 * fflate) in on demand. Called from the FIRST markSyncDirty(), not from boot: with
 * nothing dirty there is nothing to push, so a visit that never edits anything never
 * pays for the backup/zip stack at all. Idempotent and safe to call concurrently.
 */
function armScheduler(): Promise<void> {
  const getDeps = getBackupDeps;
  if (!getDeps) return Promise.resolve();
  arming ??= (async () => {
    const { makeSyncScheduler } = await import('./sync-engine.ts');
    // A reset (tests) or re-wire that happened while the engine was loading wins: arming
    // a scheduler over deps nobody holds any more would push stale state.
    if (scheduler || getDeps !== getBackupDeps) return;
    scheduler = makeSyncScheduler(async () => {
      const cfg = await getSyncConfig();
      if (!cfg.enabled) return;
      const remote = await remoteFor(cfg.providerKind);
      if (!remote || !(await isSilent(remote))) return;   // never pop OAuth outside a user gesture
      await syncNow(getDeps());
    }, PUSH_DEBOUNCE_MS, { onError: (err) => console.warn('Sync push failed:', err) });
    if (dirtyBeforeArmed) { dirtyBeforeArmed = false; scheduler.notifyChange(); }
  })();
  return arming;
}

/** Flush whatever is pending on app-background/close. Returns immediately - without
 *  loading anything - when nothing has been marked dirty, which is the whole point of
 *  arming lazily; if a change is still waiting on the load, it waits for it first so
 *  backgrounding right after an edit doesn't drop that edit. */
async function flushPending(): Promise<void> {
  if (!scheduler && !arming) return;
  await arming;
  await scheduler?.flush();
}

/**
 * Wire auto-push once at boot. `getDeps` returns the live backup deps (host +
 * storage). A change → notifyChange() coalesces to one push after the debounce;
 * app-background/close flushes any pending push immediately. Every push re-reads
 * the config and no-ops when sync is off, so enabling/disabling needs no re-wiring.
 *
 * This only records the deps and hangs the two lifecycle listeners; the scheduler
 * itself is built by the first markSyncDirty() (see armScheduler) so boot never pays
 * for the sync engine. Behaviour is unchanged - the debounce is 8 s, so a burst
 * beginning at the first change coalesces exactly as it did.
 */
export function initSyncAutoPush(getDeps: () => BackupDeps): void {
  if (getBackupDeps) return; // idempotent (re-entrant boot / HMR)
  getBackupDeps = getDeps;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) void flushPending(); });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { void flushPending(); });
  }
}

/** Signal that the user's state changed - schedules a debounced push if sync is on.
 *  A no-op until initSyncAutoPush() has run, and cheap to call from any mutation
 *  site (the enabled check happens inside the scheduled push). The first call of a
 *  session also arms the scheduler, which is what pulls sync-engine in. */
export function markSyncDirty(): void {
  if (scheduler) { scheduler.notifyChange(); return; }
  if (!getBackupDeps) return;   // auto-push not wired - same no-op as before
  dirtyBeforeArmed = true;
  void armScheduler();
}

/**
 * Boot touchpoint: if sync is on and a sibling device left a NEWER snapshot, offer
 * to apply it (last-write-wins - replaces this device's data). Best-effort and
 * non-blocking; a wrong/absent passphrase for an encrypted snapshot sends the user
 * to the sync section to set it rather than failing loudly. Applying reloads so the
 * restored state is live everywhere.
 */
export async function maybeApplyNewerAtBoot(deps: BackupDeps): Promise<void> {
  let hasNewer = false;
  try {
    const cfg = await getSyncConfig();
    if (!cfg.enabled) return;                         // auto-apply only when sync is on
    const remote = await remoteFor(cfg.providerKind);
    if (!remote || !(await isSilent(remote))) return; // don't pop OAuth at boot
    hasNewer = (await checkNewer()).hasNewer;
  } catch { return; }
  if (!hasNewer) return;
  const { confirmDialog } = await import('../components/confirm-dialog.ts');
  const ok = await confirmDialog({
    title: t('Apply the newer version from your cloud?'),
    message: t('A newer snapshot of your data was synced from another device. Applying it replaces this device’s projects, brand and settings with that version - this can’t be undone.'),
    confirmLabel: t('Apply and reload'),
    danger: true,
  });
  if (!ok) return;
  try {
    await applyNewer(deps);
    if (typeof location !== 'undefined') location.reload();
  } catch {
    // Most likely an encrypted snapshot needing its passphrase - send them to set it.
    const { navigateTo } = await import('../nav.ts');
    // Sync lives inside Connected services now; the old alias still resolves there.
    navigateTo('#/profile?focus=connections-section');
  }
}

/** Test seam: drop the scheduler so initSyncAutoPush can be re-armed. */
export function resetSyncServiceForTests(): void {
  scheduler?.cancel();
  scheduler = null;
  arming = null;
  getBackupDeps = null;
  dirtyBeforeArmed = false;
}
