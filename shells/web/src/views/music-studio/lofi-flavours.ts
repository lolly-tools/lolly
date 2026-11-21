// SPDX-License-Identifier: MPL-2.0
/**
 * A genre's flavours, under the music generator's bar (#/music): a row of chips, shown
 * only while a genre that has flavours is playing, that moves between them (Andy,
 * 2026-11-21: Lofi is one genre with a flavour chip, and drum and bass has its bouncy,
 * dark and soaring ones the same way). The picker has one card for such a genre; this row
 * is where Warm, Late night, Rainy and the rest, or Rolling, Bouncy, Dark and the rest,
 * are chosen. Each flavour keeps its own id, so a shared link opens on the same flavour.
 */
import { t, tRaw } from '../../i18n.ts';
import { genreFamilyOf, flavourLabel } from '../../lib/neurospicy-lofi.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';
import '../../styles/parts/music-browser.css';

/** The row's markup: empty and hidden until a genre with flavours plays. */
export function lofiFlavoursHtml(): string {
  return '<div class="ms-flavours" data-flavours role="group" hidden></div>';
}

export interface LofiFlavours {
  /** Show the row for `mood`: its genre's chips with that flavour pressed, or nothing for a genre with no flavours. */
  paint(mood: LofiMood): void;
}

/** Wire the row: a chip picks its flavour. */
export function wireLofiFlavours(row: HTMLElement, pick: (mood: LofiMood) => void): LofiFlavours {
  /** The family whose chips are in the row now. */
  let drawn: readonly LofiMood[] | null = null;
  row.addEventListener('click', (e) => {
    const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-flavour]') : null;
    const mood = drawn?.find(m => m === chip?.dataset.flavour);
    if (mood && chip?.getAttribute('aria-pressed') !== 'true') pick(mood);
  });
  return {
    paint(mood) {
      const family = genreFamilyOf(mood);
      row.hidden = !family;
      if (!family) return;
      if (drawn !== family.moods) {
        drawn = family.moods;
        row.setAttribute('aria-label', tRaw('{genre} flavour', { genre: family.title }));
        row.replaceChildren(...family.moods.map((m) => {
          const b = row.ownerDocument.createElement('button');
          b.type = 'button';
          b.className = 'msb-chip';
          b.dataset.flavour = m;
          b.textContent = t(flavourLabel(m));
          return b;
        }));
      }
      for (const chip of row.querySelectorAll<HTMLElement>('[data-flavour]')) {
        const on = chip.dataset.flavour === mood;
        chip.setAttribute('aria-pressed', String(on));
        // The flavour playing is brought into view when the row scrolls (a phone).
        if (on) chip.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    },
  };
}
