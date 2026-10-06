// SPDX-License-Identifier: MPL-2.0
/** Labelled actions keep the same icon, spacing and accessible name when compacted. */
import { icon, type IconName } from '../lib/icons.ts';
import { escape as escapeHtml } from '../utils.ts';
import { fitLabels } from '../lib/fit-labels.ts';
import { iconNode } from '../lib/icon-node.ts';

export function actionButtonContent(label: string, symbol: IconName): string {
  return `${icon(symbol)}<span class="btn-label">${escapeHtml(label)}</span>`;
}

export function setActionButtonContent(element: HTMLElement, label: string, symbol: IconName): void {
  const glyph = iconNode(symbol), text = element.ownerDocument.createElement('span');
  text.className = 'btn-label'; text.textContent = label;
  element.replaceChildren(...(glyph ? [glyph, text] : [text]));
}

export function actionButton(label: string, symbol: IconName, primary = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn btn--labelled${primary ? ' btn--primary' : ''}`;
  button.title = label;
  button.setAttribute('aria-label', label);
  setActionButtonContent(button, label, symbol);
  return button;
}

/** Refit after available width or asynchronously loaded invite controls change. */
export function mountActionToolbar(toolbar: HTMLElement): () => void {
  toolbar.classList.add('action-toolbar');
  const fit = () => fitLabels(toolbar, ['is-compact']);
  let size = '';
  const resize = new ResizeObserver(() => {
    const next = `${toolbar.clientWidth}:${toolbar.clientHeight}`;
    if (next !== size) { fit(); size = `${toolbar.clientWidth}:${toolbar.clientHeight}`; }
  });
  const children = new MutationObserver(fit);
  resize.observe(toolbar);
  children.observe(toolbar, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  fit();
  return () => { resize.disconnect(); children.disconnect(); };
}
