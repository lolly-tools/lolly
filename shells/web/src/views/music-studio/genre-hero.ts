// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's genre button and the lock beside it (#/music).
 *
 * THE GENRE BUTTON is the bar's hero, so someone opening a shared link or shuffling can
 * tell at once what is playing: the genre's icon, its title in a heavier weight, and under
 * the title one line of what you are hearing (genre-taglines.ts), on the genre's own wash
 * of the design system's colours, the same wash its card wears in the genre picker
 * (genre-colours.ts, each stop held to 4.5:1 against the text, in light and dark). When
 * the genre changes (a shuffle, the picker, an undo, or a link opening) the button lights
 * up briefly; with reduced motion asked for, by the system or in Lolly's own settings
 * (lib/a11y-prefs.ts), it changes without moving. Clicking it opens the genre picker.
 *
 * THE LOCK sits between the shuffle button and the genre button (beside the genre button
 * in the phone's top bar, where shuffle is down in the dock), so it reads as belonging to
 * the genre. An open padlock: shuffle may change the genre. A closed padlock: shuffle keeps
 * this genre and draws a new seed and sound. The choice is the person's "Shuffle genres"
 * preference on their profile (lib/music-prefs.ts), which the genre picker's switch used to
 * hold; the view keeps the preference.
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { genreIconNode, genreTitle } from '../../lib/genre-icons.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';
import { genreWashes, type GenreTile } from './genre-colours.ts';
import { genreTagline } from './genre-taglines.ts';

/** How long the button stays lit after a change of genre, in milliseconds (the animation's own length is in the stylesheet). */
const LIT_MS = 900;
let seq = 0;

/** The lock and the genre button, side by side. */
export function genreHeroHtml(): string {
  const n = ++seq;
  const keep = t('Keep this genre when shuffling');
  return `<span class="ms-genre-group">`
    + `<button type="button" class="ms-lock" data-genre-lock aria-pressed="false" aria-label="${escapeHtml(keep)}" title="${escapeHtml(keep)}">${icon('lockOpen', { size: 18, className: 'ms-lock-open' })}${icon('lock', { size: 18, className: 'ms-lock-shut' })}</button>`
    + `<button type="button" class="ms-genre" data-genre aria-haspopup="dialog" aria-describedby="ms-genre-tag-${n}">`
    + `<span class="ms-genre-icon" data-genre-icon aria-hidden="true"></span>`
    + `<span class="ms-genre-text"><span class="ms-genre-name" data-genre-name></span><span class="ms-genre-tag" id="ms-genre-tag-${n}" data-genre-tag></span></span>`
    + `<span class="ms-genre-more" aria-hidden="true">${icon('chevronDown', { size: 16 })}</span>`
    + `</button></span>`;
}

export interface GenreHero {
  /** Show a genre. `lit` lights the button up; it does by itself when the genre changed since the last paint. */
  paint(mood: LofiMood, opts?: { lit?: boolean }): void;
  destroy(): void;
}

/** Wire the genre button: its icon, title and line, its wash, and the light-up on a change. */
export function wireGenreHero(button: HTMLElement, host: unknown): GenreHero {
  const iconBox = button.querySelector<HTMLElement>('[data-genre-icon]');
  const name = button.querySelector<HTMLElement>('[data-genre-name]');
  const line = button.querySelector<HTMLElement>('[data-genre-tag]');
  let shown: LofiMood | null = null;
  let litTimer: ReturnType<typeof setTimeout> | undefined;
  /** The washes for the surface and text colours they were worked out for. */
  let washes: { key: string; tiles: Promise<Map<LofiMood, GenreTile>> } | null = null;
  let destroyed = false;

  /** The button's own surface and text colour, as drawn without a wash. */
  const baseColours = (): { surface: string; text: string } => {
    const tinted = button.classList.contains('is-tinted');
    if (tinted) button.classList.remove('is-tinted');
    const surface = getComputedStyle(button).backgroundColor;
    const text = getComputedStyle(name ?? button).color;
    if (tinted) button.classList.add('is-tinted');
    return { surface, text };
  };
  async function tint(mood: LofiMood): Promise<void> {
    const { surface, text } = baseColours();
    const key = `${surface}|${text}`;
    if (washes?.key !== key) washes = { key, tiles: genreWashes(host, surface, text).catch(() => new Map<LofiMood, GenreTile>()) };
    const tile = (await washes.tiles).get(mood);
    if (destroyed || shown !== mood) return;
    if (!tile) { button.classList.remove('is-tinted'); return; }
    button.style.setProperty('--ms-hero-from', tile.from);
    button.style.setProperty('--ms-hero-to', tile.to);
    button.style.setProperty('--ms-hero-angle', `${tile.angle}deg`);
    button.classList.add('is-tinted');
  }
  function light(): void {
    if (prefersReducedMotion()) return;
    button.classList.remove('is-lit');
    void button.offsetWidth; // a reflow, so the light-up starts over on a quick second change
    button.classList.add('is-lit');
    clearTimeout(litTimer);
    litTimer = setTimeout(() => button.classList.remove('is-lit'), LIT_MS);
  }
  // A change of theme repaints the wash for the new surface.
  const retint = (): void => { washes = null; if (shown) void tint(shown); };
  const themes = new MutationObserver(retint);
  themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
  dark?.addEventListener?.('change', retint);

  return {
    paint(mood, opts = {}) {
      const changed = shown !== null && shown !== mood;
      const title = genreTitle(mood);
      shown = mood;
      iconBox?.replaceChildren(genreIconNode(mood, 20));
      if (name) name.textContent = title;
      if (line) line.textContent = genreTagline(mood);
      button.setAttribute('aria-label', tRaw('Genre: {genre}. Choose a genre', { genre: title }));
      button.title = t('Choose a genre');
      button.dataset.genre = mood;
      void tint(mood);
      if (changed || opts.lit) light();
    },
    destroy() {
      destroyed = true;
      clearTimeout(litTimer);
      themes.disconnect();
      dark?.removeEventListener?.('change', retint);
    },
  };
}

export interface GenreLockDeps {
  /** Whether shuffle keeps the genre now. */
  locked(): boolean;
  /** Keep the genre, or let shuffle change it (the view saves the choice on the profile). */
  setLocked(on: boolean): void;
  /** The genre playing now, for the status line. */
  genre(): LofiMood;
  /** Say a line in the page's status line, which a screen reader speaks. */
  say(text: string): void;
}

export interface GenreLock {
  /** Show the lock as the preference is now (the profile arrives after the page opens). */
  paint(): void;
}

/** What the status line says when the lock turns. */
export function lockLine(locked: boolean, mood: LofiMood): string {
  return locked
    ? tRaw('Shuffle keeps {genre} now, and draws a new seed and sound.', { genre: genreTitle(mood) })
    : t('Shuffle picks a new genre now.');
}

/** Wire the lock: pressed (a closed padlock) keeps the genre when shuffling. */
export function wireGenreLock(button: HTMLElement, deps: GenreLockDeps): GenreLock {
  const paint = (): void => { button.setAttribute('aria-pressed', String(deps.locked())); };
  button.addEventListener('click', () => {
    const on = !deps.locked();
    deps.setLocked(on);
    paint();
    deps.say(lockLine(on, deps.genre()));
  });
  paint();
  return { paint };
}
