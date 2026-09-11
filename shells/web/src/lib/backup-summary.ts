// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';

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

export function backupHistoryNote(summary: { revisions?: number; recoveryDrafts?: number; assetVersions?: number; fileOperations?: number; fileBatches?: number; failedHistory?: number }): string {
  const parts: string[] = [];
  if (summary.revisions) parts.push(t('{n} creation checkpoints', { n: summary.revisions }));
  if (summary.recoveryDrafts) parts.push(t('{n} protected drafts', { n: summary.recoveryDrafts }));
  if (summary.assetVersions) parts.push(t('{n} saved asset versions', { n: summary.assetVersions }));
  if (summary.fileOperations) parts.push(t('{n} file operation records', { n: summary.fileOperations }));
  if (summary.fileBatches) parts.push(t('{n} file batches', { n: summary.fileBatches }));
  if (summary.failedHistory) parts.push(t('{n} history items could not be restored. Keep your backup; free space or resolve conflicting versions before retrying.', { n: summary.failedHistory }));
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}
