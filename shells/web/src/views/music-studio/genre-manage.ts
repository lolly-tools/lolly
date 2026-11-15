// SPDX-License-Identifier: MPL-2.0
/**
 * The genre picker's Manage list (views/music-studio/genre-picker.ts, #/music): every genre
 * as a row with its icon and title, a star to make it a favourite (the picker's Favourites
 * row leads with it) and an eye to hide it (the picker leaves it out and a shuffle never
 * draws it; a link or the genre lock still plays a hidden genre). The rows sit under the
 * picker's six group headings and follow its search field.
 *
 * Each change is saved on the person's profile at once (lib/music-prefs.ts setGenrePref,
 * through the view) and offers a way back in the shared undo toast (lib/undo-toast.ts).
 * Built with DOM calls, so nothing here writes markup as text.
 */
import { t, tRaw } from '../../i18n.ts';
import { iconNode } from '../../lib/icon-node.ts';
import { GENRE_GROUPS, genreIconNode, genreTitle, type GenreCategory } from '../../lib/genre-icons.ts';
import { showUndoToast } from '../../lib/undo-toast.ts';
import type { GenrePrefKind, GenrePrefs } from '../../lib/music-prefs.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';

export interface GenreManageDeps {
  prefs(): GenrePrefs;
  /** Star or hide a genre, or undo either; the view saves the change on the profile. */
  setPref(genre: string, kind: GenrePrefKind, on: boolean): void;
  /** A change was made, so the picker can show its Favourites row and hidden genres afresh. */
  changed(): void;
  /** Each group's heading, as the picker shows the headings. */
  titles: Readonly<Record<GenreCategory, string>>;
  /** Whether a title matches the search (the picker's own rule). */
  matches(title: string, query: string): boolean;
}

export interface GenreManageList {
  el: HTMLElement;
  /** Show the rows whose title matches; answers how many match. */
  filter(query: string): number;
  /** Set every toggle to the preferences as they are now. */
  paint(): void;
  /** The rows on show, for the entrance cascade. */
  rows(): HTMLElement[];
}

/** What the toast says after a change, so the person knows what it did and can take it back. */
export function genrePrefLine(kind: GenrePrefKind, on: boolean, title: string): string {
  if (kind === 'favourite') return on ? tRaw('{genre} is a favourite: it leads the genre picker.', { genre: title }) : tRaw('{genre} is no longer a favourite.', { genre: title });
  return on ? tRaw('{genre} is hidden: the picker and shuffle leave it out.', { genre: title }) : tRaw('{genre} shows again.', { genre: title });
}

/** A small toggle with an icon, named for the genre it acts on. */
function toggle(doc: Document, kind: GenrePrefKind, mood: LofiMood, title: string): HTMLButtonElement {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = `msg-manage-toggle msg-manage-${kind === 'favourite' ? 'fav' : 'hide'}`;
  b.dataset.genrePref = kind;
  b.dataset.genre = mood;
  b.setAttribute('aria-pressed', 'false');
  const label = kind === 'favourite' ? tRaw('Favourite: {genre}', { genre: title }) : tRaw('Hide: {genre}', { genre: title });
  b.setAttribute('aria-label', label);
  b.title = kind === 'favourite' ? t('Favourite: leads the genre picker') : t('Hide from the picker and shuffle');
  const glyph = iconNode(kind === 'favourite' ? 'star' : 'eyeOff', doc);
  if (glyph) { glyph.setAttribute('aria-hidden', 'true'); b.append(glyph); }
  return b;
}

/** Build the list. It is shown and hidden by the picker; nothing here opens or closes. */
export function genreManageList(doc: Document, deps: GenreManageDeps): GenreManageList {
  const el = doc.createElement('div');
  el.className = 'msg-manage';
  el.dataset.manage = '';
  const intro = doc.createElement('p');
  intro.className = 'msb-now msg-manage-intro';
  intro.textContent = t('Star a genre to keep it at the top of the picker. Hide one to leave it out of the picker and of shuffles.');
  el.append(intro);
  const all: Array<{ row: HTMLElement; mood: LofiMood; title: string; section: HTMLElement }> = [];
  for (const group of GENRE_GROUPS) {
    const section = doc.createElement('section');
    section.className = 'msg-group';
    const head = doc.createElement('h3');
    head.className = 'msb-family-title';
    head.textContent = deps.titles[group.id];
    head.id = `msg-manage-${group.id}-${Math.random().toString(36).slice(2, 7)}`;
    section.setAttribute('aria-labelledby', head.id);
    const list = doc.createElement('ul');
    list.className = 'msg-manage-rows';
    list.setAttribute('role', 'list');
    for (const mood of group.moods) {
      const title = genreTitle(mood);
      const row = doc.createElement('li');
      row.className = 'msg-manage-row';
      row.dataset.manageRow = mood;
      const glyph = doc.createElement('span');
      glyph.className = 'msg-manage-icon';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.append(genreIconNode(mood, 18));
      const name = doc.createElement('span');
      name.className = 'msg-manage-name';
      name.textContent = title;
      row.append(glyph, name, toggle(doc, 'favourite', mood, title), toggle(doc, 'hidden', mood, title));
      list.append(row);
      all.push({ row, mood, title, section });
    }
    section.append(head, list);
    el.append(section);
  }
  const none = doc.createElement('p');
  none.className = 'msb-now msg-none';
  none.textContent = t('No genre matches that search.');
  none.hidden = true;
  el.append(none);

  function paint(): void {
    const prefs = deps.prefs();
    for (const { row, mood } of all) {
      const fav = prefs.favourites.has(mood), hid = prefs.hidden.has(mood);
      row.classList.toggle('is-hidden-genre', hid);
      row.querySelector('[data-genre-pref="favourite"]')?.setAttribute('aria-pressed', String(fav));
      row.querySelector('[data-genre-pref="hidden"]')?.setAttribute('aria-pressed', String(hid));
    }
  }
  el.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-genre-pref]') : null;
    const entry = b ? all.find(x => x.mood === b.dataset.genre) : undefined;
    if (!b || !entry) return;
    const kind: GenrePrefKind = b.dataset.genrePref === 'hidden' ? 'hidden' : 'favourite';
    const on = b.getAttribute('aria-pressed') !== 'true';
    const before = deps.prefs();
    const was: GenrePrefKind | null = before.favourites.has(entry.mood) ? 'favourite' : before.hidden.has(entry.mood) ? 'hidden' : null;
    deps.setPref(entry.mood, kind, on);
    paint();
    deps.changed();
    showUndoToast({
      message: genrePrefLine(kind, on, entry.title),
      duration: 6000,
      undo: () => {
        // Back to exactly how the genre stood: a favourite, hidden, or neither.
        if (was) deps.setPref(entry.mood, was, true);
        else deps.setPref(entry.mood, kind, false);
        paint();
        deps.changed();
      },
    });
  });
  paint();
  return {
    el,
    paint,
    filter(query) {
      let hits = 0;
      for (const x of all) { const on = deps.matches(x.title, query); x.row.hidden = !on; if (on) hits++; }
      for (const section of el.querySelectorAll<HTMLElement>('section')) section.hidden = ![...section.querySelectorAll<HTMLElement>('[data-manage-row]')].some(r => !r.hidden);
      none.hidden = hits > 0;
      return hits;
    },
    rows: () => all.filter(x => !x.row.hidden && !x.section.hidden).map(x => x.row),
  };
}
