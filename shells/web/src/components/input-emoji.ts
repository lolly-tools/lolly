// SPDX-License-Identifier: MPL-2.0
/** Emoji insertion for the generic sidebar's plain text and block fields. */
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { icon } from '../lib/icons.ts';
import { emojiPickerOptions } from '../lib/emoji-picker-options.ts';
import { tRaw } from '../i18n.ts';
import { mountInputEmojiDisplay } from './input-emoji-display.ts';
import './input-emoji.css';

type TextField = HTMLInputElement | HTMLTextAreaElement;
let chromeScopes = 0;

/** Use the native editing events so validation, undo and block commits still run. */
export function insertInputEmoji(field: TextField, emoji: string, start: number, end: number): boolean {
  if (field.disabled || field.readOnly || !field.isConnected) return false;
  const next = field.value.slice(0, start) + emoji + field.value.slice(end);
  if (field.maxLength >= 0 && next.length > field.maxLength) return false;
  const EventType = field.ownerDocument.defaultView!.InputEvent;
  if (!field.dispatchEvent(new EventType('beforeinput', {
    bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: emoji,
  }))) return false;
  field.value = next;
  field.focus();
  field.setSelectionRange(start + emoji.length, start + emoji.length);
  field.dispatchEvent(new EventType('input', {
    bubbles: true, composed: true, inputType: 'insertText', data: emoji,
  }));
  return true;
}

export function mountInputEmoji(
  root: HTMLElement, model: InputModelItem[], host: HostV1, runtime: Runtime,
): () => void {
  if (!host.emoji || !runtime.emoji) return () => {};
  let disposed = false;
  let dismiss: (() => void) | undefined;
  const artwork = emojiPickerOptions(host, runtime).emoji;
  const idScope = `c${chromeScopes++}_`;
  const displays: ReturnType<typeof mountInputEmojiDisplay>[] = [];
  const off = artwork?.onSetChange?.(() => {
    if (disposed || !root.isConnected) return;
    for (const display of displays) display.refresh();
    const cells = root.querySelectorAll<HTMLButtonElement>('[data-emoji-cell]');
    if (!cells.length) return;
    for (const cell of cells) cell.textContent = cell.value;
    void runtime.applyEmojiToDom(root, { track: false, idScope }).catch(() => {});
  });
  const candidates = root.querySelectorAll<HTMLElement>(
    '.field-input[data-input-id], jelly-input[data-input-id], jelly-textarea[data-input-id], input.block-field[data-field-id], textarea.block-field[data-field-id]',
  );
  for (const target of candidates) {
    const input = model.find((item) => item.id === target.closest<HTMLElement>('[data-input-id]')?.dataset.inputId);
    if (!input) continue;
    // Skip a locked control (inert inside the sidebar). A modal that is open while the
    // sidebar mounts, such as the template chooser, makes the whole app inert for a
    // moment; that must not cost every field its button for the life of the view.
    const locked = target.closest('[inert]');
    if (locked && root.contains(locked)) continue;
    const spec = target.dataset.fieldId
      ? input.fields?.find((field) => field.id === target.dataset.fieldId?.split(':')[2])
      : input;
    if (!spec || !['text', 'longtext', undefined].includes(spec.type)) continue;
    if ('optionsFrom' in spec && spec.optionsFrom) continue;
    // A tone curve field holds level numbers, never prose.
    if ('display' in spec && spec.display === 'curve') continue;
    const native = (): TextField | null => target.matches('input, textarea')
      ? target as TextField : target.shadowRoot?.querySelector<TextField>('input, textarea') ?? null;
    const field = native();
    if (field && (field.disabled || field.readOnly || (field.tagName === 'INPUT' && field.type !== 'text'))) continue;
    const name = spec.label ?? spec.id;
    // The button must not become part of the surrounding label's field name.
    if (!target.hasAttribute('aria-label') && !target.hasAttribute('aria-labelledby')) target.setAttribute('aria-label', name);
    const wrapper = document.createElement('span'); wrapper.className = 'input-emoji-field';
    target.before(wrapper); wrapper.append(target);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'input-emoji-trigger';
    button.setAttribute('aria-haspopup', 'dialog');
    button.title = tRaw('Insert emoji'); button.setAttribute('aria-label', tRaw('Insert emoji'));
    button.append(new window.DOMParser().parseFromString(icon('smile', { size: 16 }), 'image/svg+xml').documentElement);
    button.addEventListener('click', () => {
      const current = native();
      if (!current || current.disabled || current.readOnly) return;
      const start = current.selectionStart ?? current.value.length;
      const end = current.selectionEnd ?? start;
      void import('./emoji-picker.ts').then(async ({ openEmojiPopover, closeEmojiPopover }) => {
        if (disposed || !button.isConnected) return;
        const pop = await openEmojiPopover(button, (emoji) => {
          insertInputEmoji(current, emoji, start, end);
        }, emojiPickerOptions(host, runtime));
        if (disposed) { if (pop.isConnected) closeEmojiPopover(); return; }
        dismiss = () => { if (pop.isConnected) closeEmojiPopover(); };
      }).catch(() => {
        if (!disposed) button.title = tRaw('Emoji could not load.');
      });
    });
    wrapper.append(button);
    const fieldScope = `${idScope}f${displays.length}_`;
    if (field) displays.push(mountInputEmojiDisplay(field, wrapper,
      (node) => runtime.applyEmojiToDom(node, { track: false, idScope: fieldScope })));
  }
  return () => { disposed = true; off?.(); dismiss?.(); for (const display of displays) display.dispose(); };
}

/** Emoji table columns replace a cell; ordinary text fields insert at the caret. */
export function wireEmojiCells(
  root: ParentNode, host: HostV1, runtime: Runtime,
  pick: (cell: HTMLButtonElement, emoji: string) => void,
): void {
  root.querySelectorAll<HTMLButtonElement>('[data-emoji-cell]').forEach((cell) => {
    cell.setAttribute('aria-haspopup', 'dialog');
    cell.addEventListener('click', () => {
      void import('./emoji-picker.ts').then(({ openEmojiPopover }) => {
        if (!cell.isConnected) return;
        return openEmojiPopover(cell, (emoji) => pick(cell, emoji), emojiPickerOptions(host, runtime));
      }).catch(() => { cell.title = tRaw('Emoji could not load.'); });
    });
  });
}
