// SPDX-License-Identifier: MPL-2.0
/** Projects layout changes preserve previews, selection and shared-folder activity. */
import { applyLayout, layoutAttr, layoutControlHtml, syncLayoutControls, type BrowseLayout } from '../components/browse-layout.ts';
import type { ProjectsViewMode } from './projects-view-options.ts';

export const projectLayout = (view: ProjectsViewMode): BrowseLayout => view === 'preview' ? 'grid' : view;
export const projectLayoutAttrs = (view: ProjectsViewMode): string => layoutAttr(projectLayout(view));
export const projectsLayoutControl = (view: ProjectsViewMode): string => layoutControlHtml('projects-layout-visible', projectLayout(view), 'data-project-layout');

export function applyProjectsLayout(root: HTMLElement, view: ProjectsViewMode): void {
  const mode = projectLayout(view);
  for (const grid of root.querySelectorAll('.projects-grid')) {
    grid.classList.toggle('projects-list', mode === 'list');
    applyLayout(grid, mode);
  }
  syncLayoutControls(root, mode, 'data-project-layout');
  const panel = document.querySelector('.projects-viewmenu');
  if (panel) syncLayoutControls(panel, mode, 'data-vm');
  root.querySelector<HTMLElement>('.projects-featured')?.toggleAttribute('hidden', mode !== 'grid');
}

export function wireProjectsLayout(root: HTMLElement, current: () => ProjectsViewMode, changed: (view: ProjectsViewMode) => void): void {
  applyProjectsLayout(root, current());
  root.addEventListener('click', event => {
    const mode = (event.target as Element | null)?.closest<HTMLElement>('[data-project-layout]')?.dataset.projectLayout;
    const view = mode === 'grid' ? 'preview' : mode === 'card' || mode === 'list' ? mode : undefined;
    if (view && view !== current()) changed(view);
  });
}
