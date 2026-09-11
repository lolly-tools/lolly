// SPDX-License-Identifier: MPL-2.0
/**
 * mountModal - the shared native-`<dialog>` lifecycle every app dialog needs:
 * body mount, `showModal()`, Escape via the `cancel` event, backdrop-hit-test
 * dismissal, initial focus, and teardown. Extracted from confirm-dialog.ts,
 * whose four dialog kinds (confirm/choice/notice/prompt) were the closest
 * thing to a shared modal component already - that behaviour is the spec
 * this primitive codifies for every other dialog to build on.
 *
 * `content` is opaque HTML; the caller wires its own listeners onto the
 * returned `.el` (data-act buttons, inputs, …) - this primitive only owns
 * the shell around it: create, mount, open, dismiss, close.
 *
 * Two things the caller never has to wire, because the dialog is mounted on
 * `document.body` - OUTSIDE the router's `#view`, which is the only thing a route
 * change replaces:
 *   - a route change under an open dialog (a hash link, navigateTo) tears it down,
 *     so it can't be left stranded in the top layer over the next view. Same
 *     NAV_EVENTS safety net body-popover.ts has for the same reason.
 *   - system Back (Android's key, iOS's edge swipe, the browser button) closes the
 *     topmost dialog INSTEAD of navigating the view out from under it: opening
 *     pushes one same-URL history entry per dialog for Back to consume, and any
 *     other close path consumes its own entry again. Both live in
 *     lib/overlay-back.ts, the ONE Back stack dialogs share with the anchored
 *     popovers, so a menu opened over a dialog closes before the dialog does.
 *
 * Focus containment is native: `showModal()` traps Tab inside the dialog and
 * `close()` restores focus to whatever was focused beforehand (the HTML
 * dialog-closing steps) - so there's no need for lib/focus-trap.ts here,
 * which exists for `role="dialog"` DIV overlays the browser doesn't trap for
 * free. `close()` always calls the native `.close()` before removing the
 * node so that restore step actually runs.
 */

export interface ModalHandle<T> {
  /** The mounted `<dialog>` element - wire content-specific listeners onto it. */
  el: HTMLDialogElement;
  /** Close (if not already closed/removed) and resolve `onClose` with `result`. Idempotent. */
  close(result?: T): void;
}

export interface ModalOptions<T> {
  /** Class name(s) set on the `<dialog>` element, e.g. `'modal'`, `'share-dialog'`. */
  className: string;
  ariaLabel?: string;
  /** Element to focus once mounted (called right after `showModal()`). Omit to
   *  leave focus wherever the browser's default (first autofocus/focusable) goes. */
  initialFocus?: (el: HTMLDialogElement) => HTMLElement | null | undefined;
  /** Value to resolve with on Escape, a backdrop click, or system Back. Fixed value,
   *  or computed from the dialog element at dismiss time. */
  cancelValue?: T | ((el: HTMLDialogElement) => T);
  /** Fired exactly once, after the dialog is closed + removed - however it closed
   *  (Escape, backdrop, Back, or a caller-driven `close(result)`). A route change
   *  under the dialog resolves `undefined`, never cancelValue: nobody dismissed it. */
  onClose?: (result: T | undefined) => void;
}

import { adoptFloatCluster, releaseFloatCluster } from '../lib/float-cluster.ts';
import { registerOverlay, type OverlayEntry, type OverlayRecord } from '../lib/overlay-back.ts';

export function mountModal<T = void>(content: string, opts: ModalOptions<T>): ModalHandle<T> {
  const dlg = document.createElement('dialog');
  dlg.className = opts.className;
  if (opts.ariaLabel) dlg.setAttribute('aria-label', opts.ariaLabel);
  dlg.innerHTML = content;
  document.body.appendChild(dlg);

  let settled = false;
  /** This dialog's place on the shared Back stack (lib/overlay-back.ts), set once
   *  the dialog is wired and about to open. */
  let back: OverlayEntry | null = null;
  const cancelResult = (): T | undefined =>
    typeof opts.cancelValue === 'function' ? (opts.cancelValue as (el: HTMLDialogElement) => T)(dlg) : opts.cancelValue;

  const close = (result?: T): void => {
    if (settled) return;
    settled = true;
    back?.release(); // pops the entry this dialog pushed, unless a nav/Back disowned it
    releaseFloatCluster(dlg); // rescue the adopted floating cluster BEFORE the node goes away
    if (dlg.open) dlg.close(); // runs the native dialog-closing steps (incl. focus restore)
    dlg.remove();
    opts.onClose?.(result);
  };

  const record: OverlayRecord = {
    // Teardown, not a dismissal: resolve with `undefined` rather than cancelValue so
    // a caller can tell a route change from an Escape (welcome-dialog persists the
    // "seen" flag on one and not the other).
    nav: () => { back?.disown(); close(); },
    pop: () => { back?.disown(); close(cancelResult()); },
  };

  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(cancelResult()); }); // Escape
  // Safety net for outside callers that close the <dialog> natively instead of via
  // the handle (confirm-dialog's closeConfirmDialogs teardown does) - without this
  // the stack record and its owed history entry outlive the dialog, and the next
  // Back press gets eaten by the phantom. close() is idempotent, so the event its
  // own `dlg.close()` above fires is a no-op re-entry.
  dlg.addEventListener('close', () => close());
  dlg.addEventListener('click', (e) => {
    // Click outside the content box (on the ::backdrop) dismisses. A <dialog>'s own
    // click target is the dialog element itself whether the hit lands on its padding
    // or the backdrop, so a plain bounding-rect test is what actually distinguishes
    // them - works regardless of whether the content wraps itself in an inner div.
    // Only rect-test clicks that target the dialog itself: keyboard activation
    // (Enter/Space) of an inner button fires a UA-synthetic click at clientX/Y =
    // 0,0 - outside any centered card - which the bare rect test would misread as
    // a backdrop hit and dismiss as Cancel before the caller's data-act listener
    // (registered after this one) ever sees it. A true backdrop or padding click
    // always targets the <dialog> element, never an inner node.
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(cancelResult());
  });

  // On the stack before showModal(), so open order stays the Back order even if a
  // caller's initialFocus or an adopted float opens something of its own.
  back = registerOverlay(record);

  dlg.showModal();
  // Everything outside a modal dialog is inert and below the top layer, so the
  // body-level floating cluster (job toast + undo toasts) moves in with us -
  // progress and Undo stay visible and interactive over the dialog.
  adoptFloatCluster(dlg);
  opts.initialFocus?.(dlg)?.focus();

  return { el: dlg, close };
}
