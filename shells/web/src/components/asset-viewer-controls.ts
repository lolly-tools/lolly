// SPDX-License-Identifier: MPL-2.0
/** Shared styled controls for file viewers. */
import { t } from '../i18n.ts';
export function viewerButton(label: string, action: () => void, parent: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--ghost btn--sm';
  button.textContent = t(label); button.addEventListener('click', action); parent.append(button); return button;
}
export function viewerField(label: string, control: HTMLElement, parent: HTMLElement): HTMLLabelElement {
  control.setAttribute('aria-label', t(label));
  const row = document.createElement('label'); row.className = 'asset-viewer-field';
  const text = document.createElement('span'); text.textContent = t(label); row.append(text, control); parent.append(row); return row;
}
export function viewerSelect(options: Array<[string, string]>, parent: HTMLElement, label: string): HTMLSelectElement {
  const select = document.createElement('select'); select.className = 'field-select';
  for (const [value, name] of options) { const option = document.createElement('option'); option.value = value; option.textContent = t(name); select.append(option); }
  viewerField(label, select, parent); return select;
}
