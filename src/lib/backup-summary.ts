// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
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
