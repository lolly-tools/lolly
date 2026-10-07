// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
export type ProjectListSort = 'name' | 'added' | 'modified' | 'size' | 'tool';

export function projectsListHeadHtml(sortBy: ProjectListSort, sortRev: boolean, shared = false): string {
    const descending = (key: ProjectListSort): boolean => (key === 'name' || key === 'tool') ? sortRev : !sortRev;
    const glyph = (key: ProjectListSort): string => descending(key) ? '▾' : '▴';
    const col = (key: ProjectListSort, label: string): string => {
      const on = sortBy === key;
      const state = on ? (descending(key) ? t('sorted descending') : t('sorted ascending')) : t('not sorted');
      return `<button type="button" class="listhead-col${on ? ' is-on' : ''}" data-listsort="${key}" aria-label="${escapeHtml(`${label}, ${state}`)}">${escapeHtml(label)}${on ? `<span class="listhead-dir" aria-hidden="true">${glyph(key)}</span>` : ''}</button>`;
    };
    const note = sortBy === 'added'
      ? `<span class="listhead-sortnote">${t('Sorted by date added')} <span aria-hidden="true">${glyph('added')}</span></span>`
      : '';
    return `<div class="projects-listhead" role="row">
      <span class="listhead-name">${col('name', t('Name'))}${note}</span>
      ${col('tool', t('Kind'))}${shared ? `<span class="listhead-col">${t('Size')}</span>` : col('size', t('Size'))}${col('modified', t('Modified'))}
    </div>`;
  }

