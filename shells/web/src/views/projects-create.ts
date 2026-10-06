// SPDX-License-Identifier: MPL-2.0
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { actionButtonContent } from '../components/action-button.ts';
import { FOLDER_ICON } from '../folder-tiles.ts';

const FOLDER_PLUS_ICON = icon('folderPlus', { strokeWidth: 1.8 });
const FILE_PLUS_ICON = icon('filePlus', { strokeWidth: 1.8 });
const TEMPLATE_ICON = icon('layersStack', { strokeWidth: 1.8 });

/** The compact create buttons UP TOP (Andy, 2026-08-22): one toolbar, in the
 *  root's own header row and in a folder view's header before "Render folder",
 *  in BOTH view modes (plans/245). The root grid keeps its create tiles in grid
 *  mode; a folder grid carries none. */
export function listCreateBtns(isUncat = false, hasBlueprints = false): string {
  const btn = (kind: string, glyph: string, label: string): string =>
    `<button type="button" class="btn btn--labelled projects-create-btn" data-create-btn="${kind}">${glyph}<span class="btn-label">${escapeHtml(label)}</span></button>`;
  return [
    isUncat ? '' : btn('folder', FOLDER_PLUS_ICON, t('New folder')),
    btn('tool', FILE_PLUS_ICON, t('New asset')),
    !isUncat && hasBlueprints ? btn('template', TEMPLATE_ICON, t('New project from a blueprint')) : '',
  ].join('');
}

/** The empty-folder blank state (Andy, 2026-08-22): no grid, an invitation to
 *  the two create actions instead. The buttons reuse the header's
 *  [data-create-btn] wiring; Uncategorised (not a real folder) offers only
 *  New asset under its own explanation. */
export function emptyFolderHtml(isUncat: boolean): string {
  return `
    <div class="projects-blank">
      <span class="projects-blank-icon" aria-hidden="true">${isUncat ? FILE_PLUS_ICON : FOLDER_ICON}</span>
      <p class="projects-blank-title">${isUncat ? t('Nothing is uncategorised') : t('This folder is empty')}</p>
      <p class="projects-blank-sub">${isUncat ? t('Sessions you save without filing them are kept here.') : t('Add your first creation, or group work in a sub-folder.')}</p>
      <div class="projects-blank-actions">
        <button type="button" class="btn projects-render projects-create-btn" data-create-btn="tool">${FILE_PLUS_ICON}<span>${t('New asset')}</span></button>
        ${isUncat ? '' : `<button type="button" class="btn btn--labelled projects-create-btn" data-create-btn="folder">${FOLDER_PLUS_ICON}<span>${t('New folder')}</span></button>`}
      </div>
    </div>`;
}

/** Learning and Batch actions retain the folder as their return destination. */
export function projectLearningActionsHtml(folderId: string | null, batchFrom: string | null): string {
  const query = batchFrom ? `?from=${encodeURIComponent(batchFrom)}` : '';
  const course = folderId ? `<button type="button" class="btn btn--labelled projects-create-btn" data-course-folder="${escapeHtml(folderId)}">${actionButtonContent(t('Export course'), 'graduationCap')}</button>` : '';
  return `${course}<a class="btn btn--labelled projects-create-btn" href="#/learning${query}">${actionButtonContent(t('Create learning module'), 'graduationCap')}</a><a href="#/batch${query}" class="btn btn--labelled projects-batch-btn" title="${escapeHtml(t('Batch'))}">${actionButtonContent(t('Batch'), 'table')}</a>`;
}
