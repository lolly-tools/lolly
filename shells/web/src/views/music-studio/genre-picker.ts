// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's genre picker (#/music): the genre button opens a grid of every
 * genre as a card with its icon and title (lib/genre-icons.ts), in six groups (Chill, Rock
 * & Roots, Soul & Groove, Club, Bass & Synth and World) and A to Z in each, the genre
 * playing now marked, each card in its own wash of the design system's colours
 * (genre-colours.ts). Above the groups, a Recent row holds the last six genres played,
 * newest first (lib/music-prefs.ts), and is left out until one has played. A search
 * field filters the cards by title as you type, matching the start of any word in the
 * title whatever its case or accents, into one flat grid; clearing it brings the groups
 * back. A card picks its genre. Whether shuffle may change the genre is the lock beside
 * the genre button (genre-hero.ts), so the picker only picks.
 *
 * The person's own genres lead: a Favourites row of the genres they starred sits above
 * Recent, and a genre they hid is left out of the rows, the groups and the search (the
 * genre playing now always shows). Manage, in the header, turns the cards into a list of
 * every genre with a star and a hide toggle (genre-manage.ts), each change saved on the
 * profile with Undo in the toast. The cards and the list come in with the app's quick
 * entrance cascade (instrument-popup.ts cascade), not under reduced motion or the
 * performance setting.
 *
 * The cards are one stop for Tab: the arrow keys move through them (up and down by the
 * row as the cards are laid out, across the groups), Home and End go to the first and
 * last card, and Enter or Space picks. In the search field, Down goes to the first card
 * and Enter picks the first match. Escape clears the search first and closes the picker
 * second, and focus goes back to the genre button. On a wide screen the search field
 * takes focus as the picker opens; on a phone the genre playing now does, so the keyboard
 * stays down. Built on mountModal (components/modal.ts): a sheet from the bottom on a
 * phone (parts/music-browser.css) and a centred panel on a wider screen.
 */
import { closeButtonHtml } from '../../lib/close-button.ts';
import { t } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { mountModal } from '../../components/modal.ts';
import { LOFI_CARD, PICKER_GROUPS, cardTitle, genreCard, genreIconSvg, isLofiFlavour, type GenreCategory } from '../../lib/genre-icons.ts';
import { paintGenreTiles } from './genre-colours.ts';
import { genreManageList, type GenreManageList } from './genre-manage.ts';
import { cascade, motionOn } from './instrument-popup.ts';
import type { GenrePrefKind, GenrePrefs } from '../../lib/music-prefs.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';
import '../../styles/parts/music-browser.css';

export interface GenrePickerHost {
  /** The genre playing now. */
  current(): LofiMood;
  /** Play another genre. */
  pick(mood: LofiMood): void;
  /** The genres played lately, newest first (lib/music-prefs.ts loadRecentGenres). */
  recent?(): readonly string[];
  /** The person's favourite and hidden genres (lib/music-prefs.ts loadGenrePrefs). */
  genrePrefs?(): GenrePrefs;
  /** Star or hide a genre, or undo either; the view saves it on the profile. Without it there is no Manage. */
  setGenrePref?(genre: string, kind: GenrePrefKind, on: boolean): void;
}


/** The picker opens as a centred panel from this width, as a sheet below it (the view's breakpoint). */
const WIDE = '(min-width: 761px)';
let opened = 0;

/** Each group's heading. */
const CATEGORY_TITLE = (): Record<GenreCategory, string> => ({
  chill: t('Chill'), rock: t('Rock & Roots'), soul: t('Soul & Groove'), club: t('Club'), bass: t('Bass & Synth'), world: t('World'),
});

/** Text folded for matching: lower case, accents dropped. */
export const foldTitle = (s: string): string => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

/** Whether a title matches a search: the search's text starts a word in the title ("house"
 *  finds Lofi house, "rock" finds Stoner rock), whatever the case or accents. An empty
 *  search matches every title. */
export function matchesGenre(title: string, query: string): boolean {
  const q = foldTitle(query).trim().replace(/\s+/g, ' ');
  if (!q) return true;
  const text = foldTitle(title);
  for (let i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + 1)) {
    if (i === 0 || !/[\p{L}\p{N}]/u.test(text[i - 1]!)) return true;
  }
  return false;
}

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
  // Lofi's flavours share one card: the card is pressed while any of them plays.
  const now = genreCard(h.current());
  const titleId = `msg-title-${n}`;
  const titles = CATEGORY_TITLE();
  const card = (m: LofiMood): string => `
        <button type="button" class="msg-card" data-genre-card="${m}" aria-pressed="${m === now}" tabindex="-1">
          <span class="msg-icon" aria-hidden="true">${genreIconSvg(m, 26)}</span>
          <span class="msg-name">${escapeHtml(cardTitle(m))}</span>
        </button>`;
  const known = new Set<string>(PICKER_GROUPS.flatMap(g => g.moods));
  const prefsNow = (): GenrePrefs => h.genrePrefs?.() ?? { favourites: new Set(), hidden: new Set() };
  const recent = [...new Set((h.recent?.() ?? []).map(m => genreCard(m as LofiMood)))].filter((m): m is LofiMood => known.has(m) && (m === now || !prefsNow().hidden.has(m))).slice(0, 6);
  const favouritesRow = `
    <section class="msg-group" data-favourites aria-labelledby="msg-g-${n}-fav" hidden>
      <h3 class="msb-family-title" id="msg-g-${n}-fav">${escapeHtml(t('Favourites'))}</h3>
      <div class="msg-grid" data-favourites-grid></div>
    </section>`;
  const recentRow = recent.length ? `
    <section class="msg-group" data-recent aria-labelledby="msg-g-${n}-recent">
      <h3 class="msb-family-title" id="msg-g-${n}-recent">${escapeHtml(t('Recent'))}</h3>
      <div class="msg-grid">${recent.map(card).join('')}</div>
    </section>` : '';
  const groups = PICKER_GROUPS.map(g => `
    <section class="msg-group" data-group aria-labelledby="msg-g-${n}-${g.id}">
      <h3 class="msb-family-title" id="msg-g-${n}-${g.id}">${escapeHtml(titles[g.id])}</h3>
      <div class="msg-grid">${g.moods.map(card).join('')}</div>
    </section>`).join('');
  const content = `
    <div class="msb-head">
      <span class="msb-grip" aria-hidden="true"></span>
      <div class="msb-title-row">
        <h2 class="msb-title" id="${titleId}">${escapeHtml(t('Genre'))}</h2>
        ${h.setGenrePref ? `<button type="button" class="msb-chip msg-manage-btn" data-manage-toggle aria-pressed="false" title="${escapeHtml(t('Star favourite genres and hide the ones you never want'))}">${escapeHtml(t('Manage'))}</button>` : ''}
        ${closeButtonHtml({ className: 'msb-close', attrs: { 'data-close': true, title: t('Close') } })}
      </div>
      <input type="search" class="field-input msg-search" data-genre-search placeholder="${escapeHtml(t('Search genres'))}" aria-label="${escapeHtml(t('Search genres'))}" autocomplete="off" spellcheck="false">
    </div>
    <div class="msb-body msg-body" role="group" aria-labelledby="${titleId}">${favouritesRow}${recentRow}${groups}
      <section class="msg-group" data-results aria-label="${escapeHtml(t('Matching genres'))}" hidden>
        <div class="msg-grid" data-results-grid></div>
        <p class="msb-now msg-none" data-results-none hidden>${escapeHtml(t('No genre matches that search.'))}</p>
      </section>
    </div>`;

  const search = (): HTMLInputElement | null => modal.el.querySelector<HTMLInputElement>('[data-genre-search]');
  const modal = mountModal<'picked' | 'escape' | 'button'>(content, {
    className: `msb msg ${wide ? 'msb--dialog' : 'msb--sheet'}`,
    cancelValue: 'escape',
    // Escape clears a search, then leaves Manage, then closes the picker.
    onEscape: () => {
      const field = search();
      if (field?.value) { field.value = ''; filter(); field.focus(); } else if (managing) setManaging(false); else modal.close('escape');
    },
    onClose: (how) => {
      // Back to the genre button, however the person left (a route change takes focus elsewhere).
      if (how && opts.opener?.isConnected) opts.opener.focus({ preventScroll: true });
      opts.onClose?.();
    },
  });
  const dlg = modal.el;
  dlg.setAttribute('aria-labelledby', titleId);
  // The picker opens with the app's dialog motion (a sheet rises on a phone), unless motion is off.
  if (motionOn()) {
    dlg.classList.add('is-entering');
    dlg.addEventListener('animationend', (e) => { if (e.target === dlg) dlg.classList.remove('is-entering'); });
  }
  const body = dlg.querySelector<HTMLElement>('.msg-body');
  const field = search();
  const results = dlg.querySelector<HTMLElement>('[data-results]');
  const resultsGrid = dlg.querySelector<HTMLElement>('[data-results-grid]');
  const none = dlg.querySelector<HTMLElement>('[data-results-none]');
  /** The groups' cards, each with its home grid, in the order the groups list them. */
  const homes = [...dlg.querySelectorAll<HTMLElement>('[data-group] [data-genre-card]')].map(c => ({ card: c, grid: c.parentElement! }));
  /** The cards on show, in the order they are laid out. */
  const shown = (): HTMLElement[] => [...dlg.querySelectorAll<HTMLElement>('[data-genre-card]')].filter(c => !c.hidden && !c.closest('[hidden]'));
  /** Whether a genre is left out: hidden by the person, unless it is the one playing now. */
  const isOut = (mood: string | undefined): boolean => !!mood && mood !== now && prefsNow().hidden.has(mood);
  const favourites = dlg.querySelector<HTMLElement>('[data-favourites]');
  const favouritesGrid = dlg.querySelector<HTMLElement>('[data-favourites-grid]');
  /** Show the person's genres as they are now: the Favourites row (copies of the group cards,
   *  in the order starred), and every hidden genre left out of the rows and the groups. */
  function applyPrefs(): void {
    const prefs = prefsNow();
    const byMood = new Map(homes.map(x => [x.card.dataset.genreCard, x.card] as const));
    const starred = [...prefs.favourites].map(m => byMood.get(m)).filter((c): c is HTMLElement => !!c);
    favouritesGrid?.replaceChildren(...starred.map(c => { const copy = c.cloneNode(true) as HTMLElement; copy.hidden = false; return copy; }));
    if (favourites) favourites.hidden = !starred.length || managing || searching();
    for (const c of dlg.querySelectorAll<HTMLElement>('[data-recent] [data-genre-card], [data-group] [data-genre-card]')) c.hidden = isOut(c.dataset.genreCard);
    for (const g of dlg.querySelectorAll<HTMLElement>('[data-group]')) g.classList.toggle('is-empty', ![...g.querySelectorAll<HTMLElement>('[data-genre-card]')].some(c => !c.hidden));
    settleTabStop();
  }
  const searching = (): boolean => foldTitle(field?.value ?? '').trim() !== '';
  /** One card is the Tab stop: the genre playing now where it shows, else the first card. */
  const settleTabStop = (): HTMLElement | undefined => {
    const cards = shown();
    for (const c of dlg.querySelectorAll<HTMLElement>('[data-genre-card]')) c.tabIndex = -1;
    const stop = cards.find(c => c.dataset.genreCard === now) ?? cards[0];
    if (stop) stop.tabIndex = 0;
    return stop;
  };
  const nameOf = (c: HTMLElement): string => c.querySelector('.msg-name')?.textContent ?? '';
  /** Show the cards that match the search in one grid, A to Z, or the groups again when the search is empty. */
  function filter(): void {
    const query = field?.value ?? '';
    if (managing) { manage?.filter(query); return; }
    const looking = searching();
    for (const section of dlg.querySelectorAll<HTMLElement>('[data-recent], [data-group]')) section.hidden = looking;
    if (favourites) favourites.hidden = looking || !favouritesGrid?.children.length;
    if (results) results.hidden = !looking;
    if (looking) {
      const hits = homes.map(x => x.card).filter(c => !isOut(c.dataset.genreCard) && matchesGenre(nameOf(c), query))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'en', { sensitivity: 'base' }));
      resultsGrid?.replaceChildren(...hits);
      if (none) none.hidden = hits.length > 0;
    } else {
      for (const { card: c, grid } of homes) grid.append(c);
    }
    settleTabStop();
  }

  // ── Manage: every genre with a star and a hide toggle (genre-manage.ts) ─────
  let managing = false;
  let manage: GenreManageList | null = null;
  const manageBtn = dlg.querySelector<HTMLElement>('[data-manage-toggle]');
  function setManaging(on: boolean): void {
    if (!h.setGenrePref || managing === on) return;
    managing = on;
    manageBtn?.setAttribute('aria-pressed', String(on));
    if (on && !manage && body) {
      manage = genreManageList(document, {
        prefs: prefsNow,
        setPref: (genre, kind, value) => h.setGenrePref?.(genre, kind, value),
        changed: applyPrefs,
        titles,
        matches: matchesGenre,
      });
      body.append(manage.el);
    }
    if (manage) manage.el.hidden = !on;
    for (const section of dlg.querySelectorAll<HTMLElement>('[data-recent], [data-group], [data-results]')) section.hidden = on || (section.matches('[data-results]') ? !searching() : searching());
    applyPrefs();
    filter();
    if (on && manage) cascade(manage.rows().slice(0, 40));
    else if (!on) cascade(shown().slice(0, 40));
  }
  field?.addEventListener('input', filter);
  field?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && field.value) { e.preventDefault(); e.stopPropagation(); field.value = ''; filter(); return; }
    if (e.key === 'ArrowDown') { const first = shown()[0]; if (first) { e.preventDefault(); settleTabStop(); first.focus(); } return; }
    if (e.key === 'Enter' && field.value.trim()) { const first = shown()[0]; if (first) { e.preventDefault(); first.click(); } }
  });

  dlg.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest<HTMLElement>('button') : null;
    if (!btn || !dlg.contains(btn)) return;
    if (btn.matches('[data-close]')) { modal.close('button'); return; }
    if (btn.matches('[data-manage-toggle]')) { setManaging(!managing); return; }
    const mood = btn.matches('[data-genre-card]') ? btn.dataset.genreCard : undefined;
    const pick = PICKER_GROUPS.flatMap(g => g.moods).find(m => m === mood);
    if (!pick) return;
    modal.close('picked');
    // Lofi's card keeps the flavour playing, or starts on its first; the chips under the bar change flavour.
    if (pick === LOFI_CARD && isLofiFlavour(h.current())) return;
    h.pick(pick);
  });
  // The arrow keys move through the cards on show; the card left focused is their one Tab stop.
  dlg.addEventListener('keydown', (e) => {
    const cards = shown();
    const from = e.target instanceof HTMLElement && cards.includes(e.target) ? e.target : null;
    if (!from || e.altKey || e.ctrlKey || e.metaKey) return;
    const to = cardToward(cards, from, e.key);
    if (!to) return;
    e.preventDefault();
    from.tabIndex = -1;
    to.tabIndex = 0;
    to.focus();
  });

  applyPrefs();
  const cards = [...dlg.querySelectorAll<HTMLElement>('[data-genre-card]')];
  // The Favourites row's copies are painted with the rest, and later copies take the paint with them.
  if (opts.host) void paintGenreTiles(cards, opts.host).catch(() => { /* the cards stay plain */ });
  cascade(shown().slice(0, 40));
  // Open on the genre playing now: its card is the Tab stop, scrolled to about the middle
  // when it is below the fold with the top of the list starting on a whole row. A wide
  // screen focuses the search; a phone focuses the card, so its keyboard stays down.
  const current = settleTabStop();
  if (wide && field) field.focus({ preventScroll: true });
  else current?.focus({ preventScroll: true });
  if (current && body) {
    const box = current.getBoundingClientRect();
    const view = body.getBoundingClientRect();
    if (box.bottom > view.bottom) {
      const want = box.top - view.top - (body.clientHeight - box.height) / 2;
      const rows = cards.map(c => c.getBoundingClientRect().top - view.top).filter(top => top >= want);
      const gap = parseFloat(getComputedStyle(body).paddingTop) || 0;
      body.scrollTop = Math.max(0, Math.min(...rows, box.top - view.top) - gap);
    }
  }
  return { close: () => modal.close() };
}
