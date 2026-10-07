// SPDX-License-Identifier: MPL-2.0
import { segHtml } from '../lib/seg.ts';
import { t } from '../i18n.ts';
import { captureNeutralPinned } from '../lib/capture-neutral.ts';
import { viewOptionsSection } from './view-options.ts';

export type BrowseLayout = 'preview' | 'card' | 'list';
export const isBrowseLayout = (value: unknown): value is BrowseLayout => value === 'preview' || value === 'card' || value === 'list';

export function layoutSection(group: string, value: BrowseLayout, extra = ''): string {
  return viewOptionsSection(t('Layout'), segHtml(group, [
    { id: 'preview', label: t('Grid') }, { id: 'card', label: t('Card') }, { id: 'list', label: t('List') },
  ], value, t('Layout'), { attr: 'data-vm' }) + extra);
}

export function readBrowseLayout(view: 'tools' | 'utilities', query = ''): BrowseLayout {
  const requested = new URLSearchParams(query).get('layout');
  if (isBrowseLayout(requested)) return requested;
  if (captureNeutralPinned()) return 'preview';
  try {
    const saved = localStorage.getItem(`lolly-layout-${view}`);
    if (isBrowseLayout(saved)) return saved;
  } catch { /* Storage unavailable. */ }
  return 'preview';
}

/** Change the live tiles without rebuilding previews or losing keyboard focus. */
export function wireBrowseLayout(panel: HTMLElement, grid: HTMLElement | null, view: 'tools' | 'utilities', initial: BrowseLayout): void {
  if (!grid) return;
  grid.dataset.browseLayout = initial;
  panel.addEventListener('click', event => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-vm]');
    const mode = button?.dataset.vm;
    if (!isBrowseLayout(mode)) return;
    grid.dataset.browseLayout = mode;
    panel.querySelectorAll<HTMLElement>('[data-vm]').forEach(el => { el.setAttribute('aria-pressed', String(el.dataset.vm === mode)); });
    panel.querySelector('.view-options-size')?.toggleAttribute('hidden', mode === 'list');
    try { localStorage.setItem(`lolly-layout-${view}`, mode); } catch { /* Storage unavailable. */ }
  });
}

export const projectsLayoutClass = (mode: BrowseLayout): string => mode === 'list' ? ' projects-list' : mode === 'card' ? ' projects-cards' : '';
