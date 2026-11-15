// SPDX-License-Identifier: MPL-2.0
/**
 * "Your instruments" (#/music): every instrument the person starred or blocked, for every
 * part, in one list inside the instrument popup (instrument-browser.ts), reached from the
 * popup's header. Each row says the instrument and its part (Melody, Chords or Bass) and
 * has one button to take the star or the block away; the shared undo toast
 * (lib/undo-toast.ts) puts it back. A star makes a shuffle draw the instrument more often,
 * and a block keeps it out of shuffles and new tunes (lib/music-prefs.ts).
 *
 * Built with DOM calls, so nothing here writes markup as text.
 */
import { t, tRaw } from '../../i18n.ts';
import { iconNode } from '../../lib/icon-node.ts';
import { instrumentIcon, musicIconNode } from '../../lib/instrument-icons.ts';
import { showUndoToast } from '../../lib/undo-toast.ts';
import { MUSIC_PARTS, instrumentsOf, type MusicPart, type MusicPrefKind, type MusicPrefs } from '../../lib/music-prefs.ts';
import { trackName } from './track-names.ts';

export interface YourInstrumentsDeps {
  prefs(): MusicPrefs;
  /** Star or block an instrument, or undo either; the view saves it on the profile. */
  setPref(part: MusicPart, id: string, kind: MusicPrefKind, on: boolean): void;
  /** An instrument's name as a card shows it ("Felt piano"). */
  name(part: MusicPart, id: string): string;
  /** A change was made, so the popup can paint its cards again. */
  changed(): void;
}

export interface YourEntry { part: MusicPart; id: string; kind: MusicPrefKind }

/**
 * The person's starred and blocked instruments, favourites first, each list by part
 * (Melody, Chords, Bass) and then in the order the part lists its instruments. An entry
 * for an instrument this build does not know is left out of the list (and kept on the
 * profile).
 */
export function yourEntries(prefs: MusicPrefs): YourEntry[] {
  const out: YourEntry[] = [];
  for (const kind of ['favourite', 'blocked'] as const) {
    const keys = kind === 'favourite' ? prefs.favourites : prefs.blocked;
    for (const part of MUSIC_PARTS) {
      for (const id of instrumentsOf(part)) if (keys.has(`${part}:${id}`)) out.push({ part, id, kind });
    }
  }
  return out;
}

/** What the toast says after an entry is removed. */
export function removedLine(entry: YourEntry, name: string): string {
  return entry.kind === 'favourite' ? tRaw('{name} is no longer a favourite.', { name }) : tRaw('{name} can play in shuffles again.', { name });
}

export interface YourInstruments {
  el: HTMLElement;
  /** Build the rows from the preferences as they are now. */
  paint(): void;
  rows(): HTMLElement[];
}

export function yourInstruments(doc: Document, deps: YourInstrumentsDeps): YourInstruments {
  const el = doc.createElement('div');
  el.className = 'msb-yours';
  el.dataset.yoursList = '';
  const heading = (text: string): HTMLElement => Object.assign(doc.createElement('h3'), { className: 'msb-family-title', textContent: text });

  function row(entry: YourEntry): HTMLElement {
    const name = deps.name(entry.part, entry.id);
    const li = doc.createElement('li');
    li.className = 'msb-card msb-yours-row';
    li.dataset.your = `${entry.kind}:${entry.part}:${entry.id}`;
    const glyph = doc.createElement('span');
    glyph.className = 'msb-icon';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.append(musicIconNode(instrumentIcon(entry.part, entry.id), 20));
    const text = doc.createElement('span');
    text.className = 'msb-text';
    text.append(
      Object.assign(doc.createElement('span'), { className: 'msb-name', textContent: name }),
      Object.assign(doc.createElement('span'), { className: 'msb-state', textContent: trackName(entry.part) }),
    );
    const remove = doc.createElement('button');
    remove.type = 'button';
    remove.className = 'msb-toggle msb-yours-remove';
    const label = entry.kind === 'favourite' ? tRaw('Remove {name} from your favourites', { name }) : tRaw('Unblock {name}', { name });
    remove.setAttribute('aria-label', label);
    remove.title = entry.kind === 'favourite' ? t('Remove from favourites') : t('Unblock');
    const x = iconNode('close', doc);
    if (x) { x.setAttribute('aria-hidden', 'true'); remove.append(x); }
    remove.addEventListener('click', () => {
      deps.setPref(entry.part, entry.id, entry.kind, false);
      paint();
      deps.changed();
      // Focus stays in the list: on the next row's button, or the list's first one.
      el.querySelector<HTMLElement>('.msb-yours-remove')?.focus({ preventScroll: true });
      showUndoToast({
        message: removedLine(entry, name),
        duration: 6000,
        undo: () => { deps.setPref(entry.part, entry.id, entry.kind, true); paint(); deps.changed(); },
      });
    });
    li.append(glyph, text, remove);
    return li;
  }

  function paint(): void {
    const entries = yourEntries(deps.prefs());
    const parts: HTMLElement[] = [];
    for (const kind of ['favourite', 'blocked'] as const) {
      const mine = entries.filter(e => e.kind === kind);
      if (!mine.length) continue;
      const list = doc.createElement('ul');
      list.className = 'msb-cards';
      list.setAttribute('role', 'list');
      list.append(...mine.map(row));
      const section = doc.createElement('section');
      section.className = 'msb-family';
      section.append(heading(kind === 'favourite' ? t('Favourites: shuffles draw these more often') : t('Blocked: kept out of shuffles and new tunes')), list);
      parts.push(section);
    }
    if (!parts.length) {
      parts.push(Object.assign(doc.createElement('p'), {
        className: 'msb-now msb-yours-empty',
        textContent: t('No favourite or blocked instruments yet. Star an instrument to hear it more often in shuffles, or block one to leave it out.'),
      }));
    }
    el.replaceChildren(...parts);
  }
  paint();
  return { el, paint, rows: () => [...el.querySelectorAll<HTMLElement>('.msb-yours-row, .msb-family-title')] };
}
