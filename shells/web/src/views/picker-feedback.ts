// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';
import type { CollectResult } from './picker.ts';
export { guidedCollection, mountGuidedCollection } from './picker-guided.ts';

export const collectOk = (r: CollectResult | boolean): boolean => typeof r === 'boolean' ? r : r.ok;
export const collectLabel = (r: CollectResult | boolean): string =>
  (typeof r === 'object' && r.label) || (collectOk(r) ? t('Added') : t('Couldn’t add'));

/** Show search counts on inactive tabs; an empty map clears the badges. */
export function renderTabCounts(root: HTMLElement, counts: ReadonlyMap<string, number>, activeTab: string): void {
  for (const button of root.querySelectorAll<HTMLElement>('.asset-picker-tab')) {
    button.querySelector('.asset-picker-tabcount')?.remove();
    const id = button.dataset.tab ?? '';
    const count = counts.get(id);
    if (count !== undefined && id !== activeTab) {
      const badge = document.createElement('span');
      badge.className = 'asset-picker-tabcount';
      badge.textContent = String(count);
      button.appendChild(badge);
    }
  }
}
// Flash a tile as added (green ✓ overlay) or failed, then restore - the dialog stays
// open so several items can be gathered in a row. The card owns `position:relative`
// already (the format badge sits on it), so the overlay pins cleanly.
export function flashCard(el: HTMLElement, r: CollectResult | boolean): void {
  const ok = collectOk(r), label = collectLabel(r);
  const card = el.closest<HTMLElement>('.asset-picker-toolcell, .asset-picker-card, .asset-picker-toolitem') ?? el;
  card.classList.add(ok ? 'is-added' : 'is-addfail');
  const badge = document.createElement('span');
  badge.className = 'asset-picker-added';
  badge.textContent = (ok ? '✓ ' : '') + label;
  card.appendChild(badge);
  announce(label);
  setTimeout(() => { badge.remove(); card.classList.remove('is-added', 'is-addfail'); }, 1200);
}

/** Transient feedback for additions that have no tile, such as pasted assets. */
export function createCollectToast(root: HTMLElement): (result: CollectResult | boolean) => void {
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  return (r) => {
    const ok = collectOk(r), label = collectLabel(r);
    let toast = root.querySelector<HTMLElement>('.asset-picker-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'asset-picker-toast';
      toast.setAttribute('role', 'status');
      root.querySelector('.asset-picker-panel')?.appendChild(toast);
    }
    toast.textContent = (ok ? '✓ ' : '') + label;
    toast.classList.toggle('is-fail', !ok);
    toast.classList.add('is-shown');
    announce(label);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast?.classList.remove('is-shown'), 1600);
  };
}

export function focusPickerCard(el: HTMLElement | null | undefined): void { if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); } }
export function movePickerSelection(cur: HTMLElement, key: string, cards: HTMLElement[]): void {
  const i = cards.indexOf(cur);
  if (key === 'ArrowRight') { focusPickerCard(cards[i + 1]); return; }
  if (key === 'ArrowLeft') { focusPickerCard(cards[i - 1]); return; }
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const down = key === 'ArrowDown';
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const c of cards) {
    if (c === cur) continue;
    const cr = c.getBoundingClientRect();
    const vy = (cr.top + cr.height / 2) - cy;
    if (down ? vy <= r.height * 0.4 : vy >= -r.height * 0.4) continue; // must be a further row
    const dx = Math.abs((cr.left + cr.width / 2) - cx);
    const score = dx + Math.abs(vy) * 1.5; // nearest column first, then nearest row
    if (score < bestScore) { bestScore = score; best = c; }
  }
  focusPickerCard(best);
}
