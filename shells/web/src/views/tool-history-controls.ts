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

/**
 * Put the History button where this view keeps its other document controls: in the
 * sidebar's undo/redo group, else (a tool with no sidebar: Sandbox, Doc Studio, Text)
 * beside the corner back pill, in the same top-left island the Home button joins
 * (components/back-pill.ts). Design and Org Chart draw it in their own top bar, so
 * `editorBar` skips the fallback for them.
 */
export function mountRevisionHistoryControl(root: HTMLElement, open: () => void, opts: { editorBar?: boolean } = {}): () => void {
  const group = root.querySelector('.history-controls');
  if (group) {
    const button = historyButton(t('History'), 'history', open); button.dataset.historyOpen = '';
    group.append(button); return () => button.remove();
  }
  const pill = opts.editorBar ? null : root.querySelector<HTMLElement>('.tools-home.home-full[data-back-pill]');
  if (!pill) return () => {};
  // The same button, in the glass square the corner island's controls wear.
  const button = historyButton(t('History'), 'history', open);
  button.className = 'history-fab'; button.dataset.historyOpen = '';
  // The corner pill pins itself (position: fixed), so a sibling would land in flow:
  // the island takes over the pinning, as addHomeEscape does for the Home button.
  let island = pill.parentElement?.classList.contains('chrome-topleft') ? pill.parentElement : null;
  if (!island) {
    island = document.createElement('div');
    island.className = 'chrome-topleft';
    pill.replaceWith(island);
    island.append(pill);
  }
  island.append(button);
  return () => button.remove();
}
