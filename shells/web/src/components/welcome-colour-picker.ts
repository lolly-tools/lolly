// SPDX-License-Identifier: MPL-2.0
/**
 * The welcome card's own-colour picker: Lolly's colour picker in a popover under the
 * card's palette button, in the pose Design System Setup gives a colour (the dials
 * and the value, with no swatch grid, since the card's colour row is the swatches).
 *
 * Turning a dial only moves the colour in the picker. The design system is made when
 * the person presses Apply, because making one repaints the whole gallery and that
 * must not happen on every step of a drag. Escape and a press outside close the
 * picker and change nothing.
 *
 * Loaded on the first press of the palette button, with the picker itself.
 */
import '../styles/parts/welcome-colour-picker.css';
import { t } from '../i18n.ts';
import { mountBodyPopover, type BodyPopoverHandle } from './body-popover.ts';
import { mountColorField } from './color-field.ts';

/** Open the picker under `anchor`, starting from `value`. `onApply` gets the chosen #rrggbb. */
export function openWelcomeColourPicker(anchor: HTMLElement, value: string, onApply: (hex: string) => void): BodyPopoverHandle {
  let chosen = value;
  const popover = mountBodyPopover(anchor, (el, handle) => {
    const field = document.createElement('div');
    field.className = 'welcome-colour-field';
    mountColorField(field, 'welcome-colour', {
      value,
      inline: true,
      onChange: (hex) => { if (/^#[0-9a-f]{6}/i.test(hex)) chosen = hex.slice(0, 7); },
    });
    const actions = document.createElement('div');
    actions.className = 'welcome-colour-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = t('Cancel');
    cancel.addEventListener('click', () => handle.close(true));
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'btn btn--primary';
    apply.textContent = t('Apply');
    apply.addEventListener('click', () => { handle.close(); onApply(chosen); });
    actions.append(cancel, apply);
    el.append(field, actions);
    return apply;
  }, { className: 'folder-menu welcome-colour-pop', role: 'dialog', ariaLabel: t('Pick a colour'), trackSize: true });
  popover.open();
  return popover;
}
