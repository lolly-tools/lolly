// SPDX-License-Identifier: MPL-2.0
/**
 * confirmDialog — a styled modal confirmation for destructive actions.
 *
 * Returns a Promise<boolean>: true on confirm, false on Cancel / Escape / a
 * backdrop click. One shared component (the Projects view + the profile Storage
 * manager) so every destructive flow looks and behaves identically. Reuses the
 * `.projects-confirm` <dialog> CSS already in app.css. Escape-to-close is an
 * app-wide convention; the safe Cancel button takes default focus.
 */
import { escape } from '../utils.ts';

// Open dialogs live on <body>, so a view unmount can't remove them by clearing
// its own container — track them here and tear any down via closeConfirmDialogs().
const openDialogs = new Set<HTMLDialogElement>();

export interface ConfirmDialogOpts {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true }: ConfirmDialogOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'projects-confirm';
    dlg.innerHTML = `
      <h2 class="projects-confirm-title">${escape(title)}</h2>
      <p class="projects-confirm-msg">${escape(message)}</p>
      <div class="projects-confirm-actions">
        <button type="button" class="btn projects-confirm-cancel" data-act="cancel">Cancel</button>
        <button type="button" class="btn${danger ? ' projects-confirm-danger' : ''}" data-act="ok">${escape(confirmLabel)}</button>
      </div>`;
    document.body.appendChild(dlg);
    openDialogs.add(dlg);
    let settled = false;
    const finish = (val: boolean) => {
      if (settled) return; settled = true;
      openDialogs.delete(dlg);
      if (dlg.open) dlg.close();
      dlg.remove();
      resolve(val);
    };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); }); // Escape
    dlg.addEventListener('click', (e) => {
      const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act) { finish(act === 'ok'); return; }
      // Click outside the content box (on the backdrop) dismisses.
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finish(false);
    });
    dlg.showModal();
    dlg.querySelector<HTMLButtonElement>('.projects-confirm-cancel')?.focus(); // default focus on the safe choice
  });
}

/** Tear down any still-open confirm dialogs — call on view unmount. */
export function closeConfirmDialogs(): void {
  for (const dlg of openDialogs) { if (dlg.open) dlg.close(); dlg.remove(); }
  openDialogs.clear();
}
