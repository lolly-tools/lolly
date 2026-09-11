// SPDX-License-Identifier: MPL-2.0
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';

function historyButton(label: string, glyph: 'undo' | 'redo' | 'history', action: () => void): HTMLButtonElement {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'history-btn';
  el.setAttribute('aria-label', label); el.title = label; el.innerHTML = icon(glyph);
  el.addEventListener('click', action); return el;
}

/** Header undo/redo for sidebar tools. Design supplies these in its top bar. */
export function mountUndoControls(backRow: HTMLElement, undo: () => void, redo: () => void): {
  sync(canUndo: boolean, canRedo: boolean): void;
} {
  const group = document.createElement('div'); group.className = 'history-controls';
  const undoButton = historyButton(t('Undo'), 'undo', undo), redoButton = historyButton(t('Redo'), 'redo', redo);
  group.append(undoButton, redoButton);
  backRow.append(group);
  return { sync(canUndo, canRedo) {
    const active = document.activeElement;
    if (active === undoButton && !canUndo && canRedo) redoButton.focus();
    else if (active === redoButton && !canRedo && canUndo) undoButton.focus();
    undoButton.disabled = !canUndo; redoButton.disabled = !canRedo;
  } };
}

/** Adopt the existing undo/redo group; editor layouts use their own top bar. */
export function mountRevisionHistoryControl(root: HTMLElement, open: () => void): () => void {
  const group = root.querySelector('.history-controls');
  if (!group) return () => {};
  const button = historyButton(t('History'), 'history', open); button.dataset.historyOpen = '';
  group.append(button); return () => button.remove();
}
