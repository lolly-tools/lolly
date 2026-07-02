// SPDX-License-Identifier: MPL-2.0
/**
 * Modal dialogs + the undo/redo toast for the tool view (finding 1).
 * Extracted from tool.js; bodies unchanged. The toast is a small instance so
 * its element/timer state lives here instead of mountTool closure variables.
 */
import { escape } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { ICON_UNDO, ICON_REDO } from './constants.ts';

export function showClearDialog(onConfirm: () => void): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'unsaved-dialog';
  dialog.innerHTML = `
    <div class="unsaved-dialog-body">
      <h2>Clear changes?</h2>
      <p>This will reset every field to its default value.<br>This cannot be undone.</p>
      <div class="unsaved-dialog-actions">
        <button class="unsaved-leave">Clear changes</button>
        <button class="unsaved-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  const cleanup = () => { dialog.close(); dialog.remove(); };

  dialog.querySelector('.unsaved-leave')!.addEventListener('click', () => { cleanup(); onConfirm(); });
  dialog.querySelector('.unsaved-cancel')!.addEventListener('click', cleanup);
  dialog.addEventListener('cancel', () => dialog.remove());
}

// onSave: optional async () => void that performs the save and navigates on
// success (the caller owns both). We await it rather than firing a button click,
// so "Save & leave" reliably saves *then* leaves instead of trusting a
// fire-and-forget click + timer.
export function showUnsavedDialog(onSave: (() => Promise<void> | void) | null, onLeave: () => void): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'unsaved-dialog';
  dialog.innerHTML = `
    <div class="unsaved-dialog-body">
      <h2>Unsaved changes</h2>
      <p>You have unsaved changes. <br>Would you like to save before leaving?</p>
      <div class="unsaved-dialog-actions">
        ${onSave ? `<button class="unsaved-save">Save &amp; leave</button>` : ''}
        <button class="unsaved-leave">Leave without saving</button>
        <button class="unsaved-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  const cleanup = () => { dialog.close(); dialog.remove(); };

  if (onSave) dialog.querySelector('.unsaved-save')?.addEventListener('click', () => {
    cleanup();
    void onSave();
  });
  dialog.querySelector('.unsaved-leave')!.addEventListener('click', () => { cleanup(); onLeave(); });
  dialog.querySelector('.unsaved-cancel')!.addEventListener('click', cleanup);
  dialog.addEventListener('cancel', () => dialog.remove());
}

/** What the history toast shows: a step that happened, or an empty-stack nudge. */
export interface HistoryToastOpts {
  kind?: 'undo' | 'redo';
  label?: string;
  empty?: 'undo' | 'redo';
}

export interface HistoryToast {
  show(opts: HistoryToastOpts): void;
  /** Hide a now-stale toast (a fresh edit invalidates its counter-action). */
  dismiss(): void;
  /** Remove the toast element entirely (view unmount). */
  destroy(): void;
}

// Transient bottom-centre toast confirming what was undone/redone, with a
// one-tap counter-action (Redo after an undo, and vice-versa) — that button
// doubles as the redo path on touch, where there's no keyboard. Reuses
// announce() for the screen-reader side (the toast itself is aria-hidden to
// avoid a double read). A single reused element; the timer resets on each call.
export function createHistoryToast(actions: { onUndo(): void; onRedo(): void }): HistoryToast {
  let el: HTMLDivElement | null = null;
  let timer: ReturnType<typeof setTimeout> | 0 = 0;

  return {
    show({ kind, label, empty }: HistoryToastOpts): void {
      if (!el) {
        el = document.createElement('div');
        el.className = 'toast';
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
      }
      const wasVisible = el.classList.contains('is-visible');
      clearTimeout(timer);
      if (empty) {
        el.classList.add('is-muted');
        el.innerHTML = `<span class="toast-message">Nothing to ${empty}</span>`;
        announce(`Nothing to ${empty}`);
      } else {
        el.classList.remove('is-muted');
        const verb = kind === 'undo' ? 'Undid' : 'Redid';
        const counter = kind === 'undo' ? 'Redo' : 'Undo';
        el.innerHTML =
          `<span class="toast-icon" aria-hidden="true">${kind === 'undo' ? ICON_UNDO : ICON_REDO}</span>` +
          `<span class="toast-message">${verb}<span class="toast-label"> ${escape(String(label))}</span></span>` +
          // tabindex=-1: the toast is aria-hidden (announce() drives SR) so this button
          // must not become a phantom tab stop; it stays pointer-clickable for touch/mouse.
          `<button type="button" class="toast-action" tabindex="-1">${counter}</button>`;
        el.querySelector('.toast-action')!.addEventListener('click', () => {
          if (kind === 'undo') actions.onRedo(); else actions.onUndo();
        });
        announce(`${verb} ${label}`);
      }
      // Animate the slide-in only when coming from hidden; if it's already showing
      // (rapid undo/redo), just swap the content and reset the timer — no flicker.
      if (!wasVisible) void el.offsetWidth;   // flush the base state so the transition plays
      el.classList.add('is-visible');
      const target = el;
      timer = setTimeout(() => target.classList.remove('is-visible'), empty ? 1400 : 2200);
    },
    dismiss(): void {
      el?.classList.remove('is-visible');
    },
    destroy(): void {
      clearTimeout(timer);
      el?.remove();
      el = null;
    },
  };
}
