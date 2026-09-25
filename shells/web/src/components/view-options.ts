// SPDX-License-Identifier: MPL-2.0
/**
 * The view-options menu every browsing view opens from the sliders button in its top
 * bar: Tools, Utilities, Catalogue and Projects. One set of parts, so the four menus
 * read as one menu:
 *
 *   - the button: same icon, same name ("View options"), placed before History;
 *   - the panel: `.view-options` (styles/parts/gallery.css), the card skin with the
 *     section rhythm. The top-bar views add `.filter-popover` for its anchored and
 *     mobile-sheet placement; Projects mounts the same panel through the body popover;
 *   - the sections, in this order wherever a view has them: Favourites (the strip's
 *     Gallery | Cover Flow), Layout, Sort by (a select plus a direction toggle), Filter.
 *
 * What the menu is NOT for: Theme, Sound and Neurospicy live in Settings (the profile
 * menu and /profile), so no view repeats them here.
 *
 * Markup only. Each view keeps its own state, storage keys and click handling, keyed
 * off the hooks these functions stamp (`data-view` on the favourites segment, the
 * select's id, `.view-options-dir` on the direction toggle).
 */
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { segHtml, type SegOption } from '../lib/seg.ts';
import type { FeaturedViewMode } from './featured-row.ts';

const OPTIONS_ICON = icon('filterLines');
const SORT_DIR_ICON = icon('sortDir');

/** The top-bar button. `extraClass` is the view's own hook for its click wiring;
 *  `expanded` is for a view that re-renders its top bar while the menu is open. */
export function viewOptionsButtonHtml(extraClass: string, o: { popup?: 'true' | 'dialog'; controls?: string; expanded?: boolean } = {}): string {
  const label = escapeHtml(t('View options'));
  const controls = o.controls ? ` aria-controls="${escapeHtml(o.controls)}"` : '';
  return `<button type="button" class="filter-fab ${escapeHtml(extraClass)}" aria-label="${label}" title="${label}" aria-haspopup="${o.popup ?? 'true'}" aria-expanded="${o.expanded === true}"${controls}>${OPTIONS_ICON}</button>`;
}

/** One headed section. `forId` makes the heading a <label> for a single control. */
export function viewOptionsSection(head: string, body: string, forId = ''): string {
  const heading = forId
    ? `<label class="filter-pop-head" for="${escapeHtml(forId)}">${escapeHtml(head)}</label>`
    : `<p class="filter-pop-head">${escapeHtml(head)}</p>`;
  return `<div class="filter-pop-sort">${heading}${body}</div>`;
}

/** Favourites: how the favourites strip above the view is drawn. The segment's group
 *  hook is `data-be-seg="featured-view"` and each button carries `data-view`. */
export function favouritesViewSection(current: FeaturedViewMode, extra = ''): string {
  return viewOptionsSection(t('Favourites'), segHtml('featured-view', [
    { id: 'gallery', label: t('Gallery') },
    { id: 'coverflow', label: t('Cover Flow') },
  ], current, t('Featured view'), { attr: 'data-view' }) + extra);
}

/** Sort by: a select of keys and a toggle that reverses the order. `reversed` is the
 *  view's own direction state; syncSortDir keeps the toggle's wording in step. */
export function sortSection(id: string, options: ReadonlyArray<SegOption>, value: string, reversed: boolean): string {
  const select = `<select class="gallery-sort field-select" id="${escapeHtml(id)}">${options.map(o =>
    `<option value="${escapeHtml(o.id)}"${o.id === value ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>`;
  const dir = `<button type="button" class="gallery-sort-dir view-options-dir${reversed ? ' is-asc' : ''}" aria-pressed="${reversed}">${SORT_DIR_ICON}</button>`;
  return viewOptionsSection(t('Sort by'), `<div class="gallery-sort-row">${select}${dir}</div>`, id);
}

/** Bring the direction toggle's pressed state, name and hint in line with `reversed`. */
export function syncSortDir(btn: HTMLElement | null, reversed: boolean): void {
  if (!btn) return;
  btn.classList.toggle('is-asc', reversed);
  btn.setAttribute('aria-pressed', String(reversed));
  btn.setAttribute('aria-label', reversed ? t('Sort direction: oldest / last first') : t('Sort direction: newest / first first'));
  btn.title = reversed ? t('Showing last results first - click for the usual order') : t('Reverse - show the last results first');
}
