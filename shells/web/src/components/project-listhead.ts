// SPDX-License-Identifier: MPL-2.0
/** Sortable headings share the column tracks of every Projects row. */
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import type { ProjectsSort } from '../views/projects-view-options.ts';

export function projectListHead(sortBy: ProjectsSort, sortRev: boolean): string {
    // The arrow shows the REAL direction: name/kind run A→Z unreversed, while the
    // date and size sorts run newest/biggest first unreversed - i.e. descending.
    const descending = (key: ProjectsSort): boolean => (key === 'name' || key === 'tool') ? sortRev : !sortRev;
    // Drawn in CSS (.listhead-dir, projects.css): the same two hairlines as the disclosure arrow.
    const glyph = (key: ProjectsSort): string => `<span class="listhead-dir" data-dir="${descending(key) ? 'desc' : 'asc'}" aria-hidden="true"></span>`;
    // The sort state rides the accessible NAME: aria-sort is only exposed on real
    // table header roles, and these are buttons in a div, so a screen reader would
    // otherwise miss the sort direction.
    const col = (key: ProjectsSort, label: string): string => {
      const on = sortBy === key;
      const state = on ? (descending(key) ? t('sorted descending') : t('sorted ascending')) : t('not sorted');
      return `<button type="button" class="listhead-col${on ? ' is-on' : ''}" data-listsort="${key}" aria-label="${escapeHtml(`${label}, ${state}`)}">${escapeHtml(label)}${on ? glyph(key) : ''}</button>`;
    };
    const note = sortBy === 'added'
      ? `<span class="listhead-sortnote">${t('Sorted by date added')}${glyph('added')}</span>`
      : '';
    return `<div class="projects-listhead" role="row">
      <span class="listhead-name">${col('name', t('Name'))}${note}</span>
      ${col('tool', t('Kind'))}${col('size', t('Size'))}${col('modified', t('Modified'))}
    </div>`;
  }
