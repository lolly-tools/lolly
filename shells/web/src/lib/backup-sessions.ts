// SPDX-License-Identifier: MPL-2.0
import { strToU8 } from 'fflate';
import type { RevisionArchiveAPI, RevisionArchive, RevisionArchiveSummary } from '../bridge/revision-archive-format.ts';
import { MAX_REVISION_ARCHIVE_BYTES } from '../bridge/revision-limits.ts';
import { readJson, type BundleEntry } from './bundle.ts';

interface SessionRow { slot: string; toolId?: unknown; toolVersion?: unknown; label?: unknown; thumb?: string | null; updatedAt?: string | null; savedAt?: string | null }
export interface BackupState {
  history?: { backup: RevisionArchiveAPI };
  list(): Promise<readonly SessionRow[]>;
  load(slot: string): Promise<unknown>;
  save(slot: string, data: unknown, thumb?: string | null): Promise<unknown>;
  /** Needed only by a replace import (device sync), which removes sessions the
   *  applied copy no longer holds. */
  delete?(slot: string): Promise<unknown>;
  /** Optional: write a restored session keeping its original update and save
   *  times. Without it a restored session is stamped with the time of the import,
   *  so a later import compares that stamp, not the time the work was saved. */
  restore?(slot: string, data: unknown, thumb: string | null, updatedAt: string, savedAt?: string): Promise<unknown>;
}
export interface BackupHistoryMode {
  mode?: 'manual' | 'sync';
  /**
   * Which copy wins when a restored session's slot, or an uploaded asset's id, is
   * already on this device (plans/277 P7, decided 2026-09-27). 'newer', the
   * default (Import data… and Sync's "Bring it to this device"), keeps whichever
   * copy was saved more recently, so an older file never overwrites newer work
   * here; equal or unreadable times keep this device's copy. 'incoming' always
   * takes the restored copy: device sync keeping devices in step, and restoring
   * an earlier copy, which goes back in time on purpose. Left unset, a
   * `mode: 'sync'` import takes the incoming copy, because a sync apply is a
   * replacement by definition; every other import keeps the newer copy.
   */
  sameId?: 'newer' | 'incoming';
}

/** The rule an import follows when an id is on both sides (see BackupHistoryMode.sameId). */
export function sameIdRule(options: BackupHistoryMode): 'newer' | 'incoming' {
  return options.sameId ?? (options.mode === 'sync' ? 'incoming' : 'newer');
}

/** Milliseconds since the epoch from an ISO string or a number; null when unreadable. */
function timeOf(value: unknown): number | null {
  const ms = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
}

/** When a session was last explicitly saved: its `savedAt`, which drafts,
 *  automatic checkpoints, renames and Trash moves leave alone; `updatedAt` for a
 *  record written before savedAt existed (plan 277 P7 review S2). */
export function sessionSavedAt(row: { savedAt?: unknown; updatedAt?: unknown } | null | undefined): unknown {
  return timeOf(row?.savedAt) !== null ? row!.savedAt : row?.updatedAt;
}

/** The newer-copy rule: does the incoming copy replace the one here? Only when
 *  both save times are readable and the incoming one is strictly later. */
export function incomingIsNewer(here: unknown, incoming: unknown): boolean {
  const a = timeOf(here);
  const b = timeOf(incoming);
  return a !== null && b !== null && b > a;
}

/**
 * The backup asset records to import under the newer-copy rule: every record
 * whose id is not here, and a record whose id is here only when it was modified
 * later than the copy here (`meta.modifiedAt`, which content writes stamp and a
 * restore keeps). With `sameId: 'incoming'` every record is imported.
 */
export async function assetRecordsToImport<T extends { id?: unknown; meta?: unknown }>(
  assets: { _exportUserAssets(): Promise<ReadonlyArray<{ id?: unknown; meta?: unknown }>> },
  records: readonly T[],
  options: BackupHistoryMode,
): Promise<T[]> {
  if (sameIdRule(options) === 'incoming' || !records.length) return [...records];
  const modifiedAt = (r: { meta?: unknown }): unknown => (r.meta && typeof r.meta === 'object' ? (r.meta as { modifiedAt?: unknown }).modifiedAt : undefined);
  const here = new Map((await assets._exportUserAssets()).map(r => [String(r.id), modifiedAt(r)]));
  return records.filter(rec => {
    const id = String(rec.id ?? '');
    return !here.has(id) || incomingIsNewer(here.get(id), modifiedAt(rec));
  });
}

export async function packBackupSessions(state: BackupState, entries: Record<string, BundleEntry>, options: BackupHistoryMode): Promise<{ sessions: number; slots: string[]; revisions?: number; recoveryDrafts?: number }> {
  const history = options.mode !== 'sync' && state.history ? await state.history.backup.export() : null;
  if (history) {
    const bytes = strToU8(JSON.stringify(history));
    if (bytes.byteLength > MAX_REVISION_ARCHIVE_BYTES) throw new Error('Complete revision history exceeds the 384 MiB backup limit. No partial history backup was created.');
    entries['revision-history.json'] = bytes;
  }
  // History's read transaction owns its sessions too. Do not pair a checkpoint
  // archive with a current snapshot captured later in another tab.
  const sessions: Array<SessionRow & { data: unknown }> = history?.documents.map(row => ({ ...row.state })) ?? [];
  const captured = new Set(sessions.map(row => row.slot));
  for (const row of await state.list()) {
    if (captured.has(row.slot)) continue;
    const data = await state.load(row.slot);
    if (data) sessions.push({ slot: row.slot, toolId: row.toolId, toolVersion: row.toolVersion,
      label: row.label ?? null, thumb: row.thumb ?? null, updatedAt: row.updatedAt ?? null,
      ...(row.savedAt ? { savedAt: row.savedAt } : {}), data });
  }
  entries['sessions.json'] = strToU8(JSON.stringify(sessions, null, 2));
  return { sessions: sessions.length, slots: sessions.map(row => row.slot), ...(history ? { revisions: history.revisions.length, recoveryDrafts: history.recoveries.length } : {}) };
}

/** Called before profile/assets/preferences writes. History validates the complete
 * archive and commits in one transaction; a creation on both sides is merged by
 * the newer-copy rule, never refused (plan 277 P1, review B1). */
export async function restoreBackupSessions(state: BackupState, files: Record<string, Uint8Array<ArrayBuffer>>, options: BackupHistoryMode): Promise<{ sessions: number } & Partial<RevisionArchiveSummary>> {
  if (files['revision-history.json'] && files['revision-history.json'].byteLength > MAX_REVISION_ARCHIVE_BYTES) throw new Error('Revision history exceeds the 384 MiB backup limit.');
  const history: unknown = options.mode !== 'sync' && state.history && files['revision-history.json'] ? readJson(files, 'revision-history.json') : null;
  if (options.mode !== 'sync' && state.history && files['revision-history.json'] && !history) throw new Error('Invalid revision history in this backup.');
  const sessions: unknown = readJson(files, 'sessions.json') ?? [];
  if (!Array.isArray(sessions)) throw new Error('Invalid saved-session list in this backup.');
  const summary = history ? await state.history!.backup.restore(history, { sameId: sameIdRule(options) }) : null;
  // restore() has validated this shape and every immutable hash before writing.
  const captured = new Set(history ? (history as RevisionArchive).documents.map(row => row.document.slot) : []);
  // Sessions this import wrote: the archive's creations added, replaced or placed
  // beside another here, then the plain rows below (plan 277 P1, recheck R1).
  let count = summary ? (summary.added ?? 0) + (summary.replaced ?? 0) + (summary.copies ?? 0) : 0;
  let keptHere = 0;
  // The newer-copy rule (sameId: 'newer', the default). A document the history
  // archive carries was merged above by the same rule, keeping the other side's
  // state as a protected draft.
  // Both sides compare the time of the last explicit save (sessionSavedAt).
  const savedHere = sameIdRule(options) === 'incoming' ? null : new Map((await state.list()).map(row => [row.slot, sessionSavedAt(row)]));
  for (const row of sessions) {
    if (!row || typeof row.slot !== 'string' || !row.data || captured.has(row.slot)) continue;
    if (savedHere?.has(row.slot) && !incomingIsNewer(savedHere.get(row.slot), sessionSavedAt(row))) {
      if (incomingIsNewer(sessionSavedAt(row), savedHere.get(row.slot))) keptHere++;   // this browser's copy is newer
      continue;
    }
    const updatedAt = typeof row.updatedAt === 'string' && timeOf(row.updatedAt) !== null ? row.updatedAt : null;
    const savedAt = typeof row.savedAt === 'string' && timeOf(row.savedAt) !== null ? row.savedAt : undefined;
    if (state.restore && updatedAt) await state.restore(row.slot, row.data, row.thumb ?? null, updatedAt, savedAt);
    else await state.save(row.slot, row.data, row.thumb ?? null);
    count++;
  }
  return { ...summary, sessions: count, ...(summary || keptHere ? { kept: (summary?.kept ?? 0) + keptHere } : {}) };
}
