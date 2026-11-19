// SPDX-License-Identifier: MPL-2.0
/**
 * The one close button. Every control that closes, dismisses, clears or removes with a
 * cross is drawn here: one glyph (the icon set's cross, never a text character that
 * changes with the font), one box, one hover and one focus ring, styled by `.close-btn`
 * in styles/parts/buttons.css.
 *
 * A call site says what the press does (`label`), picks a size and passes a class of
 * its own for the button's position. The look belongs to this component, so a call
 * site's stylesheet holds position and nothing else.
 */
import { t } from '../i18n.ts';
import { escape as escapeText } from '../utils.ts';
import { icon } from './icons.ts';

export type CloseButtonAttr = string | number | boolean | null | undefined;

export interface CloseButtonOptions {
  /** What the press does, already translated: "Close", "Clear search", "Remove row 3".
   *  Defaults to "Close". An empty string writes no name, for a button that is also
   *  hidden from assistive technology. */
  label?: string;
  /** `md` closes a dialog, a sheet or a panel. `sm` sits in a row, a chip, a toast or a
   *  field. */
  size?: 'md' | 'sm';
  /** A ground of its own, for a button that floats over a picture. */
  solid?: boolean;
  /** The press removes something: the hover turns to the danger colour. */
  danger?: boolean;
  /** Take the colour of the text around the button, for a ground that is not one of the
   *  page's own surfaces: an inverted bubble, a coloured notice, a card with its own ink. */
  inherit?: boolean;
  /** The call site's own class or classes: the button's position, and a hook for code. */
  className?: string;
  /** Other attributes. `true` writes the bare attribute, and `false`, `null` and
   *  `undefined` write nothing. Values are escaped. */
  attrs?: Readonly<Record<string, CloseButtonAttr>>;
}

const ATTR_NAME = /^[a-z][a-z0-9-]*$/;
// The component writes these itself.
const OWN_ATTRS = new Set(['type', 'class', 'aria-label']);

/** The class list a close button carries, for a caller that must build the element itself. */
export function closeButtonClass(o: CloseButtonOptions = {}): string {
  return ['close-btn', o.size === 'sm' ? 'close-btn--sm' : '', o.solid ? 'close-btn--solid' : '', o.danger ? 'close-btn--danger' : '', o.inherit ? 'close-btn--inherit' : '', o.className ?? '']
    .filter(Boolean).join(' ');
}

/** The close button as markup. */
export function closeButtonHtml(o: CloseButtonOptions = {}): string {
  const label = o.label ?? t('Close');
  const attrs = Object.entries(o.attrs ?? {}).map(([key, value]) => {
    if (!ATTR_NAME.test(key) || OWN_ATTRS.has(key)) throw new Error(`closeButtonHtml: attribute "${key}" is not allowed`);
    if (value === false || value === null || value === undefined) return '';
    return value === true ? ` ${key}` : ` ${key}="${escapeText(value)}"`;
  }).join('');
  const named = label ? ` aria-label="${escapeText(label)}"` : '';
  return `<button type="button" class="${escapeText(closeButtonClass(o))}"${named}${attrs}>${icon('close')}</button>`;
}

/** The close button as an element, for code that builds its surface node by node. */
export function closeButton(o: CloseButtonOptions = {}, doc: Document = document): HTMLButtonElement {
  const holder = doc.createElement('div');
  holder.innerHTML = closeButtonHtml(o);
  const button = holder.firstElementChild as HTMLButtonElement;
  button.remove();
  return button;
}
