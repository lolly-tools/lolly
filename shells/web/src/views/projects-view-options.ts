// SPDX-License-Identifier: MPL-2.0
import { mountBodyPopover, type BodyPopoverHandle, type PopoverAnchor } from '../components/body-popover.ts';
import { favouritesViewSection, sortSection, syncSortDir, viewOptionsSection } from '../components/view-options.ts';
import type { FeaturedViewMode } from '../components/featured-row.ts';
import { segHtml } from '../lib/seg.ts';
import { playSfx } from '../lib/sfx.ts';
import { captureNeutralPinned } from '../lib/capture-neutral.ts';
import { perfUiOn } from '../feature-flags.ts';
import { t } from '../i18n.ts';

export type ProjectsViewMode = 'preview' | 'list';
export type ProjectsSort = 'name' | 'added' | 'modified' | 'size' | 'tool';

/** The Projects view options: the same sections and controls as the Tools and Catalogue
 *  menus (components/view-options.ts), mounted through the body popover so the panel
 *  survives the view re-rendering under it. A change applies at once and the panel stays
 *  open, as it does in the other views. `favView` is null where no favourites strip shows. */
export function mountProjectsViewOptions(anchor: PopoverAnchor, options: {
  view: ProjectsViewMode;
  sort: ProjectsSort;
  reversed: boolean;
  atRoot: boolean;
  favView: FeaturedViewMode | null;
  onView(value: ProjectsViewMode): void;
  onSort(value: ProjectsSort): void;
  onReverse(value: boolean): void;
  onFavView(value: FeaturedViewMode): void;
}): BodyPopoverHandle {
  return mountBodyPopover(anchor, (el) => {
    let reversed = options.reversed;
    el.innerHTML = [
      options.favView ? favouritesViewSection(options.favView) : '',
      viewOptionsSection(t('Layout'), segHtml('projects-layout', [
        { id: 'preview', label: t('Grid') },
        { id: 'list', label: t('List') },
      ], options.view, t('Layout'), { attr: 'data-vm' })),
      sortSection('projects-sort', [
        { id: 'name', label: t('Name') },
        { id: 'added', label: t('Date added') },
        { id: 'modified', label: t('Last modified') },
        { id: 'size', label: t('Size') },
        ...(options.atRoot ? [] : [{ id: 'tool', label: t('By tool') }]),
      ], options.sort, reversed),
    ].join('');
    const dir = el.querySelector<HTMLElement>('.view-options-dir');
    syncSortDir(dir, reversed);
    const press = (group: string, attr: string, value: string): void =>
      el.querySelectorAll<HTMLElement>(`[data-be-seg="${group}"] [${attr}]`).forEach(b => { b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)); });
    el.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      const vm = target.closest<HTMLElement>('[data-vm]')?.dataset.vm as ProjectsViewMode | undefined;
      if (vm) { press('projects-layout', 'data-vm', vm); options.onView(vm); return; }
      const fav = target.closest<HTMLElement>('[data-be-seg="featured-view"] [data-view]')?.dataset.view;
      if (fav === 'gallery' || fav === 'coverflow') { press('featured-view', 'data-view', fav); options.onFavView(fav); return; }
      if (target.closest('.view-options-dir')) { reversed = !reversed; syncSortDir(dir, reversed); options.onReverse(reversed); }
    });
    el.querySelector<HTMLSelectElement>('#projects-sort')?.addEventListener('change', event => {
      options.onSort((event.target as HTMLSelectElement).value as ProjectsSort);
    });
    return el.querySelector<HTMLElement>('[aria-pressed="true"]');
  }, { className: 'view-options projects-viewmenu', role: 'dialog', ariaLabel: t('View options'), trackScroll: true });
}

/** An anchor that follows whichever button `current` finds now: the Projects view
 *  re-renders its top bar on every change, replacing the button the panel hangs from. */
export function liveAnchor(current: () => HTMLElement): PopoverAnchor {
  return {
    getBoundingClientRect: () => current().getBoundingClientRect(),
    contains: node => current().contains(node),
    focus: () => current().focus({ preventScroll: true }),
    setAttribute: (name, value) => current().setAttribute(name, value),
  };
}

/** The favourites strip's mode, shared with the Tools view: the gallery persists it
 *  under this key, and the Projects strips (favourites, Uncategorised) read the same one
 *  so a mode chosen in either place carries over. */
export const FEATURED_VIEW_STORAGE = 'lolly-featured-view';

export function readFeaturedView(): FeaturedViewMode {
  try {
    const v = localStorage.getItem(FEATURED_VIEW_STORAGE);
    if (v === 'gallery' || v === 'coverflow') return v;
  } catch { /* storage off */ }
  return captureNeutralPinned() || perfUiOn() ? 'gallery' : 'coverflow';
}

/** Store the favourites strip's mode, switch the live strip in place, and play the
 *  same cue as the Tools menu's switch when it actually changed. */
export function switchFavouritesView(value: FeaturedViewMode, strip: { setViewMode(mode: FeaturedViewMode): void } | null): void {
  const changed = value !== readFeaturedView();
  try { localStorage.setItem(FEATURED_VIEW_STORAGE, value); } catch { /* storage off */ }
  strip?.setViewMode(value);
  if (changed) playSfx(value === 'coverflow' ? 'coverflow' : 'gallery');
}
