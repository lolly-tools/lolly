// SPDX-License-Identifier: MPL-2.0
/**
 * One tile of the Logos room: its shape, and its markup filled or empty.
 *
 * A tile is shaped like the lockup it holds. A horizontal lockup sits in a
 * wide tile and a vertical one in a square tile, and the mark is set inside its
 * own clear space with `object-fit: contain` (brand-studio.css), so a wordmark
 * never touches the tile edge and a stacked mark is never cropped.
 *
 * An empty slot is a drop area in the same shape. It is dashed because a file can
 * be dropped on it (the room's one meaning for a dashed border), and it says
 * which logo goes there. Nothing stands in for the person's mark: a slot with no
 * mark of theirs shows no mark at all.
 *
 * Pure markup and maths, so the Logos room (lib/brand-editor/logos.ts) and its
 * tests read the same answers.
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { TREATMENT_META, splitVariant, type LogoSlot } from '../brand-logos.ts';
import { prettify } from '../brand-doc.ts';

/** `wide` for a horizontal lockup, `square` for a vertical one or a mark of its own. */
export type LogoTileShape = 'wide' | 'square';

/** The tile shape for a slot. A canonical slot answers from its orientation; a
 *  custom slot named for one (Lolly Demo's `horizontal-on-brand`) answers the
 *  same way, and any other custom mark (an icon, a crest) takes a square. */
export function logoTileShape(variant: string): LogoTileShape {
  const orientation = splitVariant(variant).orientation
    ?? (variant.startsWith('horizontal-') ? 'horizontal' : variant.startsWith('vertical-') ? 'vertical' : null);
  return orientation === 'horizontal' ? 'wide' : 'square';
}

/** What an empty slot asks for, in words. */
export function emptySlotPrompt(variant: string): string {
  return splitVariant(variant).orientation === 'vertical' ? t('Drop your vertical logo') : t('Drop your horizontal logo');
}

/** The Fauna placeholder for the magpie, who watches the place a mark is dropped.
 *  Empty and hidden until components/fauna-art.ts draws the bird inside. */
export const MAGPIE_SLOT = '<span class="fauna-slot" data-fauna="magpie" data-fauna-watch="drop" aria-hidden="true"></span>';

export interface LogoTileOptions {
  /** The slot's name, when the caller has one (a custom mark's label). */
  label?: string;
  /** Leave the magpie's placeholder in this tile (the first empty slot only). */
  fauna?: boolean;
}

/** One tile, filled with `slot` or empty when there is none. */
export function logoTileHtml(variant: string, identity: string, slot: LogoSlot | undefined, opts: LogoTileOptions = {}): string {
  const { treatment } = splitVariant(variant);
  const tm = treatment ? TREATMENT_META[treatment] : null;
  const name = opts.label ?? slot?.label ?? (tm ? tm.label : prettify(variant));
  const hint = slot ? t('Click to replace') : (tm ? tm.hint : t('A mark named its own way.'));
  // The whole tile is the file input's label and its drop target: data-file-drop
  // marks it, and logo-intake.ts wires the drop through lib/file-drop-tile.ts to
  // the same placement a picked file takes.
  const body = slot
    ? `<span class="be-logo-art"><img src="${escapeText(slot.url)}" alt="${escapeText(tRaw('{name} logo', { name }))}" loading="lazy"></span>`
    : `<span class="be-logo-empty">${opts.fauna ? MAGPIE_SLOT : ''}<span class="be-logo-empty-prompt">${escapeText(emptySlotPrompt(variant))}</span></span>`;
  // The slot's file input is `visually-hidden`, never `hidden`: a display:none
  // input is not focusable, which made every logo slot mouse-only. The label
  // draws the keyboard ring on its behalf via .be-logo-drop:focus-within
  // (brand-studio.css), the same construction the shared dropzone uses.
  return `<div class="be-logo-slot${slot ? ' is-filled' : ''}" data-be-logo="${escapeText(variant)}" data-treatment="${treatment ?? 'custom'}" data-shape="${logoTileShape(variant)}">
        <div class="be-logo-slot-head"><span class="be-logo-slot-name">${escapeText(name)}</span>
          ${slot && !slot.shipped ? `<button type="button" class="be-logo-del" data-logo-del="${escapeText(variant)}" data-identity="${escapeText(identity)}" aria-label="${escapeText(tRaw('Remove the {name} mark', { name }))}">&#x2715;</button>` : ''}</div>
        <label class="be-logo-drop" data-file-drop data-drop-label="${escapeText(slot ? t('Drop to replace') : t('Drop to add'))}">
          ${body}
          <input type="file" class="be-logo-file visually-hidden" data-logo-file="${escapeText(variant)}" data-identity="${escapeText(identity)}" accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="${escapeText(tRaw('Replace the {name} mark', { name }))}">
        </label>
        <p class="be-logo-hint">${escapeText(hint)}</p>
      </div>`;
}
