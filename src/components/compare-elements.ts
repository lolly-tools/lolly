// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
export function compareElement<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el;
}
export function compareButton(text: string, primary = false): HTMLButtonElement {
  const el = compareElement('button', t(text), `btn ${primary ? 'btn--primary' : 'btn--ghost'}`); el.type = 'button'; return el;
}
