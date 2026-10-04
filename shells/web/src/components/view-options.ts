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
 *     Layout always ends with the card-size slider, which each view remembers apart.
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
import { captureNeutralPinned } from '../lib/capture-neutral.ts';
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

/**
 * Card size: how many cards a view fits across. Five steps, smaller to larger, around
 * step 2, which is each view's own layout exactly as it was. A view at step 2 carries no
 * `data-card-size`, so its default render (and every docs capture of it) is untouched.
 * The grids read the attribute in CSS (parts/gallery.css): the Tools grid adds or
 * removes columns from its breakpoint ladder, the Catalogue and Projects grids scale
 * their card width. Each view keeps its own step, because a view with five cards and
 * one with fifty want different answers.
 */
export type CardSizeView = 'tools' | 'utilities' | 'catalog' | 'projects';
export const CARD_SIZE_DEFAULT = 2;
const CARD_SIZE_MAX = 4;
const cardSizeKey = (view: CardSizeView): string => `lolly-card-size-${view}`;

/** The view's saved step, or the default. A neutral capture always gets the default. */
export function readCardSize(view: CardSizeView): number {
  if (captureNeutralPinned()) return CARD_SIZE_DEFAULT;
  try {
    const raw = localStorage.getItem(cardSizeKey(view)) ?? '';
    if (/^\d$/.test(raw) && Number(raw) <= CARD_SIZE_MAX) return Number(raw);
  } catch { /* storage off */ }
  return CARD_SIZE_DEFAULT;
}

export function writeCardSize(view: CardSizeView, step: number): void {
  try {
    if (step === CARD_SIZE_DEFAULT) localStorage.removeItem(cardSizeKey(view));
    else localStorage.setItem(cardSizeKey(view), String(step));
  } catch { /* storage off */ }
}

/** The grid attribute for markup: empty at the default step. */
export function cardSizeAttr(step: number): string {
  return step === CARD_SIZE_DEFAULT ? '' : ` data-card-size="${step}"`;
}

/** Set (or clear, at the default) the step on a live grid element. */
export function applyCardSize(el: Element | null | undefined, step: number): void {
  if (!el) return;
  if (step === CARD_SIZE_DEFAULT) el.removeAttribute('data-card-size');
  else el.setAttribute('data-card-size', String(step));
}

/** The slider row, between a dense-grid and a large-grid glyph. `hidden` for a view in
 *  list layout, where card size has nothing to change. */
export function cardSizeHtml(step: number, hidden = false): string {
  const label = escapeHtml(t('Card size'));
  return `<div class="view-options-size"${hidden ? ' hidden' : ''}>${icon('gridDense')}`
    + `<input type="range" class="field-range view-options-size-range" min="0" max="${CARD_SIZE_MAX}" step="1" value="${step}" aria-label="${label}" title="${label}">`
    + `${icon('grid')}</div>`;
}

/** Wire the slider inside `root`: `apply` runs on every step while dragging, and the
 *  settled step is saved for `view`. */
export function wireCardSize(root: HTMLElement, view: CardSizeView, apply: (step: number) => void): void {
  const input = root.querySelector<HTMLInputElement>('.view-options-size-range');
  if (!input) return;
  const read = (): number => Math.max(0, Math.min(CARD_SIZE_MAX, Math.round(Number(input.value) || 0)));
  input.addEventListener('input', () => apply(read()));
  input.addEventListener('change', () => { const step = read(); apply(step); writeCardSize(view, step); });
}
