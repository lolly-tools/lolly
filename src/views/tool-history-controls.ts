// SPDX-License-Identifier: MPL-2.0
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';

/** Header undo/redo for sidebar tools. Design supplies these in its top bar. */
export function mountUndoControls(backRow: HTMLElement, undo: () => void, redo: () => void): {
  sync(canUndo: boolean, canRedo: boolean): void;
} {
  const group = document.createElement('div'); group.className = 'history-controls';
  const button = (label: string, glyph: 'undo' | 'redo', action: () => void): HTMLButtonElement => {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'history-btn';
    el.setAttribute('aria-label', label); el.title = label; el.innerHTML = icon(glyph);
    el.addEventListener('click', action); group.append(el); return el;
  };
  const undoButton = button(t('Undo'), 'undo', undo), redoButton = button(t('Redo'), 'redo', redo);
  backRow.append(group);
  return { sync(canUndo, canRedo) {
    const active = document.activeElement;
    if (active === undoButton && !canUndo && canRedo) redoButton.focus();
    else if (active === redoButton && !canRedo && canUndo) undoButton.focus();
    undoButton.disabled = !canUndo; redoButton.disabled = !canRedo;
  } };
}
