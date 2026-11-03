// SPDX-License-Identifier: MPL-2.0
/**
 * An inspector dialog as the second pane, in the two-pane layout.
 *
 * Assets shows an asset's details in a modal dialog over the browser. On a foldable
 * or a near-square touch screen in two columns (lib/layout-posture.ts) the same
 * dialog becomes the pane beside the browser instead: non-modal, so the browser
 * stays live and tapping another asset shows it in the same place, and sized by the
 * split divider (lib/split-panes.ts), so the two meet at the hinge.
 *
 * The details take the inline end, the side the desk's right-hand column has always
 * been on, and reserve it through `--dock-w` and `html[data-edge-dock]` exactly as
 * that column does (lib/edge-dock.ts, which is inert for Assets in two panes), so
 * the view and its fixed chrome step aside and tighten with no rules of their own. Assets has no
 * drawing surface, so the dominant hand moves the divider's snap points with it
 * but never the details' side.
 *
 * The switch is in place (`ModalHandle.setModal`): a fold, an unfold or a turn onto
 * the table changes modality and size, never the dialog, so a half-typed field and
 * the scroll position survive. On a tabletop, and outside split, the dialog is the
 * modal it has always been.
 */
import { currentLayout, onLayoutChange } from './layout-posture.ts';
import { mountSplitView, SPLIT_CHANGE_EVENT } from './split-panes.ts';
import type { SplitViewHandle } from './split-panes.ts';
import type { HandHost } from './hand-pref.ts';

/** The modal handle slice this needs (components/modal.ts). */
export interface SwitchableDialog {
  el: HTMLDialogElement;
  setModal(modal: boolean): void;
}

/** Two columns right now: split, and not stacked on a tabletop. */
export function inspectorPaneWanted(): boolean {
  const s = currentLayout();
  return s.layout === 'split' && s.posture !== 'tabletop';
}

/** The class the pane form carries; styles/parts/split.css places the pane. */
export const PANE_CLASS = 'is-split-pane';

/**
 * Follow the layout with `dialog`: a pane in two columns, a modal elsewhere.
 * `id` keys the divider's remembered ratio. Returns the stop, for the dialog's close.
 */
export function followSplitPane(dialog: SwitchableDialog, opts: { id: string; host?: HandHost }): () => void {
  const root = document.documentElement;
  let view: SplitViewHandle | null = null;
  let reserving = false;
  let ownsDockAttr = false;
  const reserve = (px: number): void => {
    root.style.setProperty('--dock-w', `${px}px`);
    if (!root.hasAttribute('data-edge-dock')) { root.setAttribute('data-edge-dock', ''); ownsDockAttr = true; }
    reserving = true;
  };
  const release = (): void => {
    if (!reserving) return;
    root.style.removeProperty('--dock-w');
    if (ownsDockAttr) { root.removeAttribute('data-edge-dock'); ownsDockAttr = false; }
    reserving = false;
  };
  let busy = false;
  let stopped = false;

  const apply = (): void => {
    if (busy || stopped) return;
    busy = true;
    try {
      const want = inspectorPaneWanted();
      if (want && !view) view = mountSplitView({ id: opts.id, host: opts.host });
      if (!want && view) { view.destroy(); view = null; }
      const g = view?.geometry();
      if (want && g && g.mode === 'columns') {
        // The details take the inline end; which physical side that is depends on
        // the direction, and its width on the divider's place.
        const right = g.controlLeft ? g.canvas : g.control;
        const left = g.controlLeft ? g.control : g.canvas;
        const pane = root.dir === 'rtl' ? left : right;
        reserve(pane + g.gutter);
        dialog.el.style.setProperty('--split-pane-w', `${pane}px`);
        dialog.el.classList.add(PANE_CLASS);
        dialog.setModal(false);
      } else {
        release();
        dialog.el.classList.remove(PANE_CLASS);
        dialog.el.style.removeProperty('--split-pane-w');
        dialog.setModal(true);
      }
    } finally { busy = false; }
  };

  const offLayout = onLayoutChange(apply);
  window.addEventListener(SPLIT_CHANGE_EVENT, apply);
  apply();
  return () => {
    if (stopped) return;
    stopped = true;
    offLayout();
    window.removeEventListener(SPLIT_CHANGE_EVENT, apply);
    view?.destroy();
    view = null;
    release();
  };
}
