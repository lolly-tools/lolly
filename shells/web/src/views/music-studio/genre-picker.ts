// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's genre picker (#/music): the genre button opens a grid of every
 * genre as a card with its icon and title (lib/genre-icons.ts), grouped by category (chill,
 * electronic, classic and international) and A to Z in each, the genre playing now marked,
 * each card in its own wash of the design system's colours (genre-colours.ts). A card
 * picks its genre. The header holds the
 * "Shuffle genres" switch: on, the shuffle button draws a new genre; off, the shuffle
 * keeps the genre and draws a new seed and sound.
 *
 * The grid is one stop for Tab: the arrow keys move through it (up and down by the row
 * as the cards are laid out, across the two groups), Home and End go to the first and
 * last card, and Enter or Space picks. Escape and the close button close the picker, and
 * focus goes back to the genre button. Built on mountModal (components/modal.ts): a
 * sheet from the bottom on a phone (parts/music-browser.css) and a centred panel on a
 * wider screen.
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import { mountModal } from '../../components/modal.ts';
import { GENRE_GROUPS, genreIconSvg, genreTitle, type GenreCategory } from '../../lib/genre-icons.ts';
import { paintGenreTiles } from './genre-colours.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';
import '../../styles/parts/music-browser.css';

export interface GenrePickerHost {
  /** The genre playing now. */
  current(): LofiMood;
  /** Play another genre. */
  pick(mood: LofiMood): void;
  /** Whether the shuffle button draws a new genre. */
  shuffleGenres(): boolean;
  setShuffleGenres(on: boolean): void;
}

/** The picker opens as a centred panel from this width, as a sheet below it (the view's breakpoint). */
const WIDE = '(min-width: 761px)';
let opened = 0;

/** Each category's heading. */
const CATEGORY_TITLE = (): Record<GenreCategory, string> => ({ chill: t('Chill'), electronic: t('Electronic'), classic: t('Classic'), international: t('International') });

/** What the switch does, said under the title. */
const switchNote = (on: boolean, mood: LofiMood): string => (on
  ? t('Shuffle draws a new genre each time.')
  : tRaw('Shuffle keeps {genre} and draws a new seed and sound.', { genre: genreTitle(mood) }));

/**
 * The card an arrow key moves to: the next or previous card for left and right, and for
 * up and down the card in the nearest row above or below whose centre is closest across,
 * so the grid reads as it is laid out whatever its column count.
 */
interface Placed { getBoundingClientRect(): { left: number; top: number; bottom: number; width: number } }
export function cardToward<T extends Placed>(cards: readonly T[], from: T, key: string): T | null {
  const i = cards.indexOf(from);
  if (key === 'ArrowRight') return cards[i + 1] ?? null;
  if (key === 'ArrowLeft') return cards[i - 1] ?? null;
  if (key === 'Home') return cards[0] ?? null;
  if (key === 'End') return cards[cards.length - 1] ?? null;
  if (key !== 'ArrowDown' && key !== 'ArrowUp') return null;
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const down = key === 'ArrowDown';
  let best: T | null = null;
  let bestRow = Infinity, bestDx = Infinity;
  for (const c of cards) {
    if (c === from) continue;
    const b = c.getBoundingClientRect();
    const row = down ? b.top - r.bottom : r.top - b.bottom;
    if (row < -1) continue;
    const dx = Math.abs(b.left + b.width / 2 - cx);
    if (row < bestRow - 1 || (Math.abs(row - bestRow) <= 1 && dx < bestDx)) { best = c; bestRow = row; bestDx = dx; }
  }
  return best;
}

/**
 * Open the picker. `host` is the shell's bridge: given one, each card takes its own wash
 * of the design system's colours (genre-colours.ts); without one the cards stay plain.
 */
export function openGenrePicker(h: GenrePickerHost, opts: { opener?: HTMLElement | null; onClose?: () => void; host?: unknown } = {}): { close(): void } {
  const n = ++opened;
  const wide = window.matchMedia(WIDE).matches;
  const now = h.current();
  const titleId = `msg-title-${n}`;
  const titles = CATEGORY_TITLE();
  const groups = GENRE_GROUPS.map(g => `
    <section class="msg-group" aria-labelledby="msg-g-${n}-${g.id}">
      <h3 class="msb-family-title" id="msg-g-${n}-${g.id}">${escapeHtml(titles[g.id])}</h3>
      <div class="msg-grid">${g.moods.map(m => `
        <button type="button" class="msg-card" data-genre-card="${m}" aria-pressed="${m === now}" tabindex="${m === now ? 0 : -1}">
          <span class="msg-icon" aria-hidden="true">${genreIconSvg(m, 26)}</span>
          <span class="msg-name">${escapeHtml(genreTitle(m))}</span>
        </button>`).join('')}
      </div>
    </section>`).join('');
  const content = `
    <div class="msb-head">
      <span class="msb-grip" aria-hidden="true"></span>
      <div class="msb-title-row">
        <h2 class="msb-title" id="${titleId}">${escapeHtml(t('Genre'))}</h2>
        <button type="button" class="msg-switch" role="switch" aria-checked="${h.shuffleGenres()}" aria-describedby="msg-note-${n}" data-shuffle-genres>
          <span class="msg-switch-track" aria-hidden="true"><span class="msg-switch-knob"></span></span>
          <span>${escapeHtml(t('Shuffle genres'))}</span>
        </button>
        <button type="button" class="btn btn--ghost btn--sm msb-close" data-close aria-label="${escapeHtml(t('Close'))}" title="${escapeHtml(t('Close'))}">${icon('close', { size: 18 })}</button>
      </div>
      <p class="msb-now" id="msg-note-${n}" data-note>${escapeHtml(switchNote(h.shuffleGenres(), now))}</p>
    </div>
    <div class="msb-body msg-body" role="group" aria-labelledby="${titleId}">${groups}</div>`;

  const modal = mountModal<'picked' | 'escape' | 'button'>(content, {
    className: `msb msg ${wide ? 'msb--dialog' : 'msb--sheet'}`,
    cancelValue: 'escape',
    onClose: (how) => {
      // Back to the genre button, however the person left (a route change takes focus elsewhere).
      if (how && opts.opener?.isConnected) opts.opener.focus({ preventScroll: true });
      opts.onClose?.();
    },
  });
  const dlg = modal.el;
  dlg.setAttribute('aria-labelledby', titleId);
  const cards = [...dlg.querySelectorAll<HTMLElement>('[data-genre-card]')];
  const body = dlg.querySelector<HTMLElement>('.msg-body');
  if (opts.host) void paintGenreTiles(cards, opts.host).catch(() => { /* the cards stay plain */ });

  dlg.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest<HTMLElement>('button') : null;
    if (!btn || !dlg.contains(btn)) return;
    if (btn.matches('[data-close]')) { modal.close('button'); return; }
    if (btn.matches('[data-shuffle-genres]')) {
      const on = btn.getAttribute('aria-checked') !== 'true';
      h.setShuffleGenres(on);
      btn.setAttribute('aria-checked', String(on));
      const note = dlg.querySelector<HTMLElement>('[data-note]');
      if (note) note.textContent = switchNote(on, h.current());
      return;
    }
    const mood = cards.includes(btn) ? btn.dataset.genreCard : undefined;
    const pick = GENRE_GROUPS.flatMap(g => g.moods).find(m => m === mood);
    if (!pick) return;
    modal.close('picked');
    h.pick(pick);
  });
  // The arrow keys move through the grid; the card left focused is the grid's one Tab stop.
  dlg.addEventListener('keydown', (e) => {
    const from = e.target instanceof HTMLElement && cards.includes(e.target) ? e.target : null;
    if (!from || e.altKey || e.ctrlKey || e.metaKey) return;
    const to = cardToward(cards, from, e.key);
    if (!to) return;
    e.preventDefault();
    from.tabIndex = -1;
    to.tabIndex = 0;
    to.focus();
  });

  // Open on the genre playing now: focused, and when it is below the fold, scrolled up
  // to about the middle, with the top of the list starting on a whole row.
  const current = cards.find(c => c.dataset.genreCard === now) ?? cards[0];
  current?.focus({ preventScroll: true });
  if (current && body) {
    const card = current.getBoundingClientRect();
    const view = body.getBoundingClientRect();
    if (card.bottom > view.bottom) {
      const want = card.top - view.top - (body.clientHeight - card.height) / 2;
      const rows = cards.map(c => c.getBoundingClientRect().top - view.top).filter(top => top >= want);
      const gap = parseFloat(getComputedStyle(body).paddingTop) || 0;
      body.scrollTop = Math.max(0, Math.min(...rows, card.top - view.top) - gap);
    }
  }
  return { close: () => modal.close() };
}
