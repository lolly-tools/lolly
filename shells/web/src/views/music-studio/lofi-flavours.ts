// SPDX-License-Identifier: MPL-2.0
/**
 * Lofi's flavours, under the music generator's bar (#/music): a row of chips, shown only
 * while a flavour of Lofi is playing, that moves between them (Andy, 2026-11-21: Lofi is
 * one genre with a flavour chip). The picker has one Lofi card; this row is where Warm,
 * Late night, Rainy, Focus and the rest are chosen. Each flavour keeps its own id, so a
 * shared link opens on the same flavour.
 */
import { t } from '../../i18n.ts';
import { LOFI_FAMILY, genreTitle, isLofiFlavour } from '../../lib/genre-icons.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';
import '../../styles/parts/music-browser.css';

/** The row's markup: empty and hidden until a flavour of Lofi plays. */
export function lofiFlavoursHtml(): string {
  return '<div class="ms-flavours" data-flavours role="group" hidden></div>';
}

export interface LofiFlavours {
  /** Show the row for `mood`: its chips with that flavour pressed, or nothing for a genre that is not Lofi. */
  paint(mood: LofiMood): void;
}

/** Wire the row: a chip picks its flavour. */
export function wireLofiFlavours(row: HTMLElement, pick: (mood: LofiMood) => void): LofiFlavours {
  row.setAttribute('aria-label', t('Lofi flavour'));
  const chips = LOFI_FAMILY.map((mood) => {
    const b = row.ownerDocument.createElement('button');
    b.type = 'button';
    b.className = 'msb-chip';
    b.dataset.flavour = mood;
    b.textContent = t(genreTitle(mood));
    b.setAttribute('aria-pressed', 'false');
    return b;
  });
  row.replaceChildren(...chips);
  row.addEventListener('click', (e) => {
    const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-flavour]') : null;
    const mood = LOFI_FAMILY.find(m => m === chip?.dataset.flavour);
    if (mood && chip?.getAttribute('aria-pressed') !== 'true') pick(mood);
  });
  return {
    paint(mood) {
      row.hidden = !isLofiFlavour(mood);
      for (const chip of chips) {
        const on = chip.dataset.flavour === mood;
        chip.setAttribute('aria-pressed', String(on));
        // The flavour playing is brought into view when the row scrolls (a phone).
        if (on && !row.hidden) chip.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    },
  };
}
