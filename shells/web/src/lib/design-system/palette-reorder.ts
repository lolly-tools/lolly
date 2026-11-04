// SPDX-License-Identifier: MPL-2.0
import { wireReorderList } from '../../components/reorder-list.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { paletteOrder, writePaletteOrder } from './palette-order.ts';

interface PaletteReorderContext {
  doc(): unknown;
  before(label: string): void;
  commit(): void;
}

/** The card attribute that keeps a tile's drag handle on screen while keyboard
 *  focus is anywhere in the card (brand-studio.css shows it as an overlay). */
export const KBD_FOCUS_ATTR = 'data-kbd-focus';

/**
 * Keyboard focus on a tile shows its handle (plan 346 change 8). CSS alone
 * cannot carry that across Tab: moving focus from the tile to the handle blurs
 * the tile first, and in that instant nothing in the card is focused, so a
 * `:has(:focus-visible)` rule hides the handle and the browser finds it not
 * focusable. The attribute marks the card from the moment a tile or handle
 * takes keyboard focus until focus leaves the card altogether.
 */
function wireKeyboardReach(palette: HTMLElement): () => void {
  const onIn = (e: FocusEvent): void => {
    const el = e.target as HTMLElement;
    const card = el.closest<HTMLElement>('.be-pal-card');
    if (card && el.matches(':focus-visible')) card.setAttribute(KBD_FOCUS_ATTR, '');
  };
  const onOut = (e: FocusEvent): void => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.be-pal-card');
    if (card && !card.contains(e.relatedTarget as Node | null)) card.removeAttribute(KBD_FOCUS_ATTR);
  };
  palette.addEventListener('focusin', onIn);
  palette.addEventListener('focusout', onOut);
  return () => { palette.removeEventListener('focusin', onIn); palette.removeEventListener('focusout', onOut); };
}

/** Each group uses the shared pointer/keyboard gesture, with one undoable write. */
export function mountPaletteReorder(palette: HTMLElement | null, ctx: PaletteReorderContext): { render(): void; destroy(): void } {
  let stops: Array<() => void> = [];
  const unreach = palette ? wireKeyboardReach(palette) : () => {};
  const stopGroups = (): void => { for (const stop of stops) stop(); stops = []; };
  const destroy = (): void => { stopGroups(); unreach(); };
  const render = (): void => {
    stopGroups();
    for (const grid of palette?.querySelectorAll<HTMLElement>('.be-pal-grid') ?? []) {
      stops.push(wireReorderList(grid, (from, to) => {
        // A keyboard move puts focus back on the moved handle after the repaint,
        // which has to find that handle on screen even outside Select mode.
        const byKeyboard = !!(document.activeElement as HTMLElement | null)?.matches?.(':focus-visible');
        const cards = [...grid.querySelectorAll<HTMLElement>('[data-reorder-row]')];
        const keys = cards.map(card => card.dataset.reorderRow!);
        keys.splice(to, 0, keys.splice(from, 1)[0]!);
        const all = [...palette!.querySelectorAll<HTMLElement>('[data-reorder-row]')].map(card => card.dataset.reorderRow!);
        const group = new Set(keys);
        let i = 0;
        ctx.before(t('Reorder colours'));
        writePaletteOrder(ctx.doc(), [...all.map(key => group.has(key) ? keys[i++]! : key), ...paletteOrder(ctx.doc()).filter(key => !all.includes(key))]);
        ctx.commit();
        // Rendering replaced the grid, so restore focus using the stable token key.
        const moved = [...palette!.querySelectorAll<HTMLElement>('[data-reorder-row]')].find(card => card.dataset.reorderRow === keys[to]);
        if (moved && byKeyboard) moved.setAttribute(KBD_FOCUS_ATTR, '');
        moved?.querySelector<HTMLElement>('[data-reorder-handle]')?.focus();
      }, announce, {
        layout: 'grid',
        instructions: t('Use the arrow keys to move within this group. Space drops. Escape cancels.'),
        cancelled: t('Move cancelled.'),
        position: (index, count) => tRaw('Colour {position} of {count}.', { position: index + 1, count }),
      }));
    }
  };
  return { render, destroy };
}
