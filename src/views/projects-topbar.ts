// SPDX-License-Identifier: MPL-2.0
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';

/** Project-specific actions in the shared view topbar. */
export function projectsTopRight(folderId: string | null): string {
  const historyHref = `#/history${folderId ? `?project=${encodeURIComponent(folderId)}` : ''}`;
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - fixed in-app hash route
  return `<a class="history-fab" href="${escapeHtml(historyHref)}" aria-label="${escapeHtml(t('History'))}" title="${escapeHtml(t('History'))}">${icon('history')}</a>
    <button type="button" class="filter-fab projects-viewopts" aria-label="${escapeHtml(t('View and sort options'))}" aria-haspopup="dialog" aria-expanded="false" title="${escapeHtml(t('View & sort'))}">${icon('filterLines')}</button>`;
}
