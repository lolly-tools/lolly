// SPDX-License-Identifier: MPL-2.0
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { viewOptionsButtonHtml } from '../components/view-options.ts';

/** Project-specific actions in the shared view topbar. */
export function projectsTopRight(folderId: string | null): string {
  const historyHref = `#/history${folderId ? `?project=${encodeURIComponent(folderId)}` : ''}`;
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - a first-party #/history hash route built above, never user input
  const history = `<a class="history-fab" href="${escapeHtml(historyHref)}" aria-label="${escapeHtml(t('History'))}" title="${escapeHtml(t('History'))}">${icon('history')}</a>`;
  // View options first, then History: the same order as the Tools top bar.
  return `${viewOptionsButtonHtml('projects-viewopts', { popup: 'dialog' })}${history}`;
}
