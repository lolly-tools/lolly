// SPDX-License-Identifier: MPL-2.0
/**
 * Arrow keys between tiles, for the grids people browse to pick something: the
 * Tools and Utilities gallery and the Assets view. Once a tile (or any control
 * inside one) has focus, the arrows move to the nearest tile in that direction
 * and Home / End jump to the first and last, so a keyboard user no longer has to
 * Tab through every card's select dot, name and "+ New" to reach the next one.
 *
 * Movement is geometric (nearest tile centre, see `nearestInDirection`), so it
 * follows whatever the layout draws - masonry, wrapped rows, sections one above
 * another - with no column count to keep in step. Tab order is unchanged.
 *
 * It yields to everything that already owns an arrow key: text fields, selects
 * and sliders (isTypingTarget), an open dialog or menu, any handler that ran
 * first and called preventDefault (the Projects grid's own keyboard model, a
 * carousel), and every modified key.
 */
import { isTypingTarget } from './typing-target.ts';

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/**
 * The candidate nearest to `from` in direction `dir`, or null. Distance along the
 * axis dominates and cross-axis drift is a tie-breaker (weighted 3x), so Down
 * moves to the tile below rather than the nearest diagonal one.
 */
export function nearestInDirection<T>(from: DOMRect, dir: ArrowKey, candidates: ReadonlyArray<{ item: T; r: DOMRect }>): T | null {
  const cx = (from.left + from.right) / 2, cy = (from.top + from.bottom) / 2;
  let best: T | null = null;
  let bestScore = Infinity;
  for (const { item, r } of candidates) {
    const dx = (r.left + r.right) / 2 - cx, dy = (r.top + r.bottom) / 2 - cy;
    const ahead = dir === 'ArrowRight' ? dx > 1 : dir === 'ArrowLeft' ? dx < -1 : dir === 'ArrowDown' ? dy > 1 : dy < -1;
    if (!ahead) continue;
    const score = dir === 'ArrowLeft' || dir === 'ArrowRight'
      ? Math.abs(dx) + Math.abs(dy) * 3
      : Math.abs(dy) + Math.abs(dx) * 3;
    if (score < bestScore) { bestScore = score; best = item; }
  }
  return best;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const ARROWS = new Set<string>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export interface ArrowNavOpts {
  /** Selector for one tile. */
  items: string;
  /** Selector for the control to focus inside a tile; the first focusable one otherwise. */
  primary?: string;
}

/**
 * Wire arrow navigation over the tiles under `host` (delegated, so tiles rebuilt
 * by a re-render need nothing). Returns the unbind; call it on view teardown.
 */
export function wireArrowNav(host: HTMLElement, opts: ArrowNavOpts): () => void {
  // The preferred control only when it can take focus (an unavailable tool's name
  // is a plain span), else the tile's first focusable control.
  const focusOf = (tile: HTMLElement): HTMLElement | null => {
    const preferred = opts.primary ? tile.querySelector<HTMLElement>(opts.primary) : null;
    return preferred?.matches(FOCUSABLE) ? preferred : tile.querySelector<HTMLElement>(FOCUSABLE);
  };
  const visible = (el: HTMLElement): boolean => !el.hidden && el.getClientRects().length > 0;

  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (!ARROWS.has(e.key) && e.key !== 'Home' && e.key !== 'End') return;
    const target = e.target as HTMLElement | null;
    const tile = target?.closest<HTMLElement>(opts.items);
    if (!tile || !host.contains(tile) || isTypingTarget()) return;
    if (document.querySelector('dialog[open], [role="menu"], [role="listbox"]')) return;
    const tiles = [...host.querySelectorAll<HTMLElement>(opts.items)].filter(t => visible(t) && focusOf(t));
    let next: HTMLElement | null;
    if (e.key === 'Home') next = tiles[0] ?? null;
    else if (e.key === 'End') next = tiles[tiles.length - 1] ?? null;
    else {
      const candidates = tiles.filter(t => t !== tile).map(t => ({ item: t, r: t.getBoundingClientRect() }));
      next = nearestInDirection(tile.getBoundingClientRect(), e.key as ArrowKey, candidates);
    }
    const el = next && next !== tile ? focusOf(next) : null;
    if (!el) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
    next!.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  host.addEventListener('keydown', onKey);
  return () => host.removeEventListener('keydown', onKey);
}
