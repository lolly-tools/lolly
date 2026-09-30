// SPDX-License-Identifier: MPL-2.0
/**
 * start: lifecycle.
 *
 * Every function takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import { navigateTo } from '../../nav.ts';
import type { ViewElement } from './shared.ts';
import { bindOp, type StartCtx } from './context.ts';

// ── Escape returns to the view the user came from - same target as the back
//    pill (colour-popover Escapes stopPropagation at the field, so they never
//    reach this) ──────────────────────────────────────────────────────────────
export const onKey = (start: StartCtx, e: KeyboardEvent): void => {
  const { backHref, editorMount, versionsPanel } = start;
  if (e.key !== 'Escape' || start.installing) return; // no Esc-teardown mid-install
  // The import dialog owns the key while it's open: the native <dialog> handles
  // Escape itself (its `cancel` event), but the keydown still bubbles up here -
  // without this guard one press would close the dialog AND leave the studio.
  if (start.importModal || start.looksModal || start.recovery?.el.isConnected || start.usage?.modalOpen()) return;
  // The Esc stack: floating popovers first (they close themselves and
  // stopImmediatePropagation before this handler - the query is a
  // belt-and-braces guard so the sheet never folds under a popover that
  // somehow let the key through), then an expanded palette sheet folds to
  // peek, then back to where the user came from.
  const popoverOpen = !!editorMount.querySelector(
    '[data-be-editor]:not([hidden]), [data-grad-pop]:not([hidden]), .color-picker-field:not(.color-field--inline) .color-popover:not([hidden])'
  );
  // The tray sits above the palette sheet in the stack, so it answers first:
  // on a phone it folds to peek, on a dock width it closes (it reports which
  // by returning true either way).
  if (!popoverOpen && start.trayUi?.collapse()) {
    e.preventDefault();
    start.candidates.syncTrayToggle();
    return;
  }
  if (!popoverOpen && start.paletteSheet?.collapse()) {
    e.preventDefault();
    return;
  }
  // An open compat disclosure in the Versions panel folds before the studio is
  // left. Esc only ever CANCELS here: no publish, activate or restore is ever
  // one keypress away, and the panel has no modal for it to dismiss.
  if (!popoverOpen && !versionsPanel.hidden && start.versions?.collapse()) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  navigateTo(backHref);
};
export function wireCleanup(start: StartCtx): void {
  const { viewEl } = start;
  document.addEventListener('keydown', start.lifecycle.onKey);
  (viewEl as ViewElement)._cleanup = () => {
    start.looksModal?.close();
    document.removeEventListener('keydown', start.lifecycle.onKey);
    // A dialog outlives the view it was opened from (it's body-mounted), so leaving
    // the studio must take it with it.
    start.sources.closeImport();
    start.recovery?.close();
    start.unsubTray?.();
    start.unsubTray = null;
    start.unsubBeat?.();
    start.unsubBeat = null;
    start.trayUi?.teardown();
    start.trayUi = null;
    start.overview?.teardown();
    start.overview = null;
    start.usage?.teardown();
    start.usage = null;
    start.versions?.teardown();
    start.versions = null;
    start.paletteSheet?.teardown();
    start.paletteSheet = null;
    start.editor?.teardown();
  };
}

export function lifecycleOps(start: StartCtx) {
  return {
    onKey: bindOp(start, onKey),
    wireCleanup: bindOp(start, wireCleanup),
  };
}
