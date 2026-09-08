// SPDX-License-Identifier: MPL-2.0
import { strToU8 } from 'fflate';
import type { RevisionArchiveAPI, RevisionArchive } from '../bridge/revision-archive-format.ts';
import { MAX_REVISION_ARCHIVE_BYTES } from '../bridge/revision-limits.ts';
import { readJson, type BundleEntry } from './bundle.ts';

interface SessionRow { slot: string; toolId?: unknown; toolVersion?: unknown; label?: unknown; thumb?: string | null; updatedAt?: string | null }
export interface BackupState {
  history?: { backup: RevisionArchiveAPI };
  list(): Promise<readonly SessionRow[]>;
  load(slot: string): Promise<unknown>;
  save(slot: string, data: unknown, thumb?: string | null): Promise<unknown>;
}
export interface BackupHistoryMode { mode?: 'manual' | 'sync' }

export async function packBackupSessions(state: BackupState, entries: Record<string, BundleEntry>, options: BackupHistoryMode): Promise<{ sessions: number; revisions?: number; recoveryDrafts?: number }> {
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
      label: row.label ?? null, thumb: row.thumb ?? null, updatedAt: row.updatedAt ?? null, data });
  }
  entries['sessions.json'] = strToU8(JSON.stringify(sessions, null, 2));
  return { sessions: sessions.length, ...(history ? { revisions: history.revisions.length, recoveryDrafts: history.recoveries.length } : {}) };
}

/** Called before profile/assets/preferences writes. History validates the complete
 * archive and commits in one transaction; a conflict leaves the install intact. */
export async function restoreBackupSessions(state: BackupState, files: Record<string, Uint8Array<ArrayBuffer>>, options: BackupHistoryMode): Promise<{ sessions: number; revisions?: number; recoveryDrafts?: number }> {
  if (files['revision-history.json'] && files['revision-history.json'].byteLength > MAX_REVISION_ARCHIVE_BYTES) throw new Error('Revision history exceeds the 384 MiB backup limit.');
  const history: unknown = options.mode !== 'sync' && state.history && files['revision-history.json'] ? readJson(files, 'revision-history.json') : null;
  if (options.mode !== 'sync' && state.history && files['revision-history.json'] && !history) throw new Error('Invalid revision history in this backup.');
  const sessions: unknown = readJson(files, 'sessions.json') ?? [];
  if (!Array.isArray(sessions)) throw new Error('Invalid saved-session list in this backup.');
  const summary = history ? await state.history!.backup.restore(history) : null;
  // restore() has validated this shape and every immutable hash before writing.
  const captured = new Set(history ? (history as RevisionArchive).documents.map(row => row.document.slot) : []);
  let count = captured.size;
  for (const row of sessions) {
    if (row && typeof row.slot === 'string' && row.data && !captured.has(row.slot)) {
      await state.save(row.slot, row.data, row.thumb ?? null); count++;
    }
  }
  return { sessions: count, ...summary };
}
