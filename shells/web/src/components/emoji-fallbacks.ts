// SPDX-License-Identifier: MPL-2.0
/** Explicit fallback order. Missing packs stay visible until the author removes them. */
import type { EmojiSetInfoV1, EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';
import { tRaw } from '../i18n.ts';

export function mountEmojiFallbacks(root: HTMLElement, style: EmojiStyleV1, sets: readonly EmojiSetInfoV1[], change: (style: EmojiStyleV1) => void): void {
  const key = (pin: EmojiStyleV1['primary']): string => `${pin.id}@${pin.pin.version}`;
  const label = document.createElement('label');
  label.className = 'field-row';
  const title = document.createElement('span');
  title.className = 'field-label';
  title.textContent = tRaw('Fallback sets');
  const select = document.createElement('select');
  select.className = 'field-select';
  const option = (text: string, value: string): HTMLOptionElement => {
    const node = root.ownerDocument.createElement('option'); node.textContent = text; node.value = value; return node;
  };
  select.add(option(tRaw('Add a fallback set'), ''));
  for (const set of sets) {
    if ([style.primary, ...style.fallbacks].some(pin => key(pin) === key(set.pin))) continue;
    select.add(option(set.label, key(set.pin)));
  }
  select.disabled = select.options.length < 2 || style.fallbacks.length >= 8;
  select.addEventListener('change', () => {
    const found = sets.find(set => key(set.pin) === select.value);
    if (found) change({ ...style, fallbacks: [...style.fallbacks, structuredClone(found.pin)] });
  });
  label.append(title, select);
  root.append(label);
  style.fallbacks.forEach((pin, index) => {
    const row = document.createElement('div');
    row.className = 'field-row field-row--inline';
    const name = document.createElement('span');
    const found = sets.find(set => key(set.pin) === key(pin) && pin.checksum === set.pin.checksum);
    name.textContent = `${index + 1}. ${found?.label ?? `${key(pin)} (${tRaw('Unavailable')})`}`;
    const up = document.createElement('button');
    up.type = 'button'; up.className = 'btn'; up.textContent = tRaw('Move up'); up.disabled = index === 0;
    up.addEventListener('click', () => {
      const fallbacks = [...style.fallbacks];
      [fallbacks[index - 1], fallbacks[index]] = [fallbacks[index]!, fallbacks[index - 1]!];
      change({ ...style, fallbacks });
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'btn'; remove.textContent = tRaw('Remove');
    remove.addEventListener('click', () => change({ ...style, fallbacks: style.fallbacks.filter((_, i) => i !== index) }));
    row.append(name, up, remove); root.append(row);
  });
}
