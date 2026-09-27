// SPDX-License-Identifier: MPL-2.0
import { t, tRaw } from '../i18n.ts';

/**
 * How much of what the person MADE rides in a backup (plans/226 section 4.7): the
 * templates they saved and the tools they built. Both live on the profile record, so
 * `profile.json` already carries them verbatim - this only counts them, so the human
 * summary in `lolly.txt` says out loud that they are in there. Tolerant of a profile
 * that has neither field, and of one where the field is not a list.
 */
export function backupOwnCounts(profile: unknown): { templates: number; userTools: number } {
  const p = (profile && typeof profile === 'object' ? profile : {}) as { userTemplates?: unknown; userTools?: unknown };
  return {
    templates: Array.isArray(p.userTemplates) ? p.userTemplates.length : 0,
    userTools: Array.isArray(p.userTools) ? p.userTools.length : 0,
  };
}

export function backupHistoryNote(summary: { revisions?: number; recoveryDrafts?: number; assetVersions?: number; fileOperations?: number; fileBatches?: number; failedHistory?: number; historyLeftOut?: number }): string {
  const parts: string[] = [];
  if (summary.revisions) parts.push(t('{n} creation checkpoints', { n: summary.revisions }));
  if (summary.recoveryDrafts) parts.push(t('{n} protected drafts', { n: summary.recoveryDrafts }));
  if (summary.assetVersions) parts.push(t('{n} saved asset versions', { n: summary.assetVersions }));
  if (summary.fileOperations) parts.push(t('{n} file operation records', { n: summary.fileOperations }));
  if (summary.fileBatches) parts.push(t('{n} file batches', { n: summary.fileBatches }));
  // Older history this browser had no room for (plan 277 P1): the import still ran.
  if (summary.historyLeftOut) parts.push(t('History did not fit: {n} older versions were not imported.', { n: summary.historyLeftOut }));
  if (summary.failedHistory) parts.push(t('{n} history items could not be restored. Keep your backup; free space or resolve conflicting versions before retrying.', { n: summary.failedHistory }));
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

/** What an import changed, the one summary that Import data…, a backup opened from
 *  Open, a sync copy imported by hand and the instance sheet all report. */
export interface ImportLineSummary {
  sessions?: number; userAssets?: number; revisions?: number; recoveryDrafts?: number; assetVersions?: number;
  fileOperations?: number; fileBatches?: number; failedHistory?: number; historyLeftOut?: number;
  /** Creations on both sides where this browser's newer copy stayed. */
  kept?: number;
  /** Creations removed from Projects here (the Trash, or left without saving) that stayed removed. */
  hidden?: number;
}

/**
 * The status line for an import, saying only what happened (plan 277 P1, recheck
 * R1): what arrived, this browser's newer copies kept, creations removed here that
 * stayed removed, and "Nothing new to import." when nothing changed at all.
 */
export function backupImportLine(summary: ImportLineSummary): string {
  const arrived = [summary.sessions, summary.userAssets, summary.revisions, summary.recoveryDrafts, summary.assetVersions,
    summary.fileOperations, summary.fileBatches].some(n => (n ?? 0) > 0);
  const parts: string[] = [];
  if (arrived) parts.push(tRaw('Imported {sessions} and {images}', {
    sessions: summary.sessions === 1 ? t('1 session') : t('{n} sessions', { n: summary.sessions ?? 0 }),
    images: summary.userAssets === 1 ? t('1 image') : t('{n} images', { n: summary.userAssets ?? 0 }),
  }));
  const history = backupHistoryNote(summary);
  if (history) parts.push(history.slice(3));
  if (summary.kept) parts.push(summary.kept === 1 ? t('Kept this browser’s newer copy of 1 creation.') : t('Kept this browser’s newer copy of {n} creations.', { n: summary.kept }));
  if (summary.hidden) parts.push(summary.hidden === 1 ? t('1 creation removed from Projects here stayed removed.') : t('{n} creations removed from Projects here stayed removed.', { n: summary.hidden }));
  return parts.length ? parts.join(' · ') : t('Nothing new to import.');
}
