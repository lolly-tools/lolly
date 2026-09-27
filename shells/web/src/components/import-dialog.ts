// SPDX-License-Identifier: MPL-2.0
/**
 * The Import data dialog (plans/277 P11, P13): the one confirmation shown before a
 * backup .zip or a copy Sync wrote is imported, from Settings → Storage → Import
 * data… and from Open alike, both through lib/data-import.ts. It asks for the sync
 * passphrase in place when the copy is encrypted, and keeps itself open after a
 * failure so the reason can be read and a passphrase typed again.
 */
import { t } from '../i18n.ts';
// Aliased on import: a bare `escape` shadows the deprecated global of that name.
import { escape as escapeHtml } from '../utils.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { mountModal, type ModalHandle } from './modal.ts';

/** How the import dialog reads for the file being imported (plans/277 P13). */
export interface ImportDialogOpts {
  /** 'sync-copy': a copy Sync wrote to the person's storage. Absent: a backup .zip. */
  kind?: 'backup' | 'sync-copy';
  /** One line above the body saying which file this is. */
  lead?: string;
  /** The copy is encrypted with the sync passphrase: show a field for the passphrase,
   *  whose value reaches `onConfirm`. It never leaves this device. */
  passphrase?: boolean;
}

/** Where an open dialog is recorded so a view can close it when the view is swapped
 *  out (the Settings view keeps such a set). */
export interface ImportDialogModals {
  add(modal: ModalHandle<void>): unknown;
  delete(modal: ModalHandle<void>): unknown;
}

// Confirm + run a data import. The action may throw (not a backup, wrong format,
// quota, a wrong passphrase); surface the reason in place and keep the dialog open
// rather than leaving the user guessing, so a wrong passphrase can be typed again.
// Resolves true once the import finished, false when the dialog closed without one.
export function showImportDialog(
  onConfirm: (input: { passphrase: string }) => Promise<void>,
  opts: ImportDialogOpts = {},
  modals?: ImportDialogModals,
): Promise<boolean> {
  const syncCopy = opts.kind === 'sync-copy';
  const content = `
    <h3 id="import-dialog-title">${syncCopy ? t('Import this sync copy?') : t('Import data?')}</h3>
    ${opts.lead ? `<p class="clear-dialog-lead">${escapeHtml(opts.lead)}</p>` : ''}
    <p>${syncCopy
      ? (isTauriShell() ? t('This adds the copy’s sessions, uploaded assets, folders, favourites, templates and saved file history to this device, and deletes nothing. When a session or asset is on both, the copy saved more recently is kept. Your details and settings on this device stay as they are; empty ones are filled in from the copy. Nothing is uploaded.') : t('This adds the copy’s sessions, uploaded assets, folders, favourites, templates and saved file history to this browser, and deletes nothing. When a session or asset is on both, the copy saved more recently is kept. Your details and settings in this browser stay as they are; empty ones are filled in from the copy. Nothing is uploaded.'))
      : (isTauriShell() ? t('This adds the backup’s sessions, uploaded assets, folders, favourites, templates and saved file history to this device, and deletes nothing. When a session or asset is on both, the copy saved more recently is kept. Your details and settings on this device stay as they are; empty ones are filled in from the backup. Existing historical versions and result records are never overwritten. Keep the backup until every item is restored.') : t('This adds the backup’s sessions, uploaded assets, folders, favourites, templates and saved file history to this browser, and deletes nothing. When a session or asset is on both, the copy saved more recently is kept. Your details and settings in this browser stay as they are; empty ones are filled in from the backup. Existing historical versions and result records are never overwritten. Keep the backup until every item is restored.'))}</p>
    ${opts.passphrase ? `<label class="clear-confirm">
      <span class="clear-confirm-prompt">${t('Sync passphrase')}</span>
      <input type="password" class="clear-confirm-input import-passphrase" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
    </label>` : ''}
    <p class="import-error" role="alert" style="color:hsl(var(--destructive));font-size:13px;margin:0 0 12px" hidden></p>
    <div class="clear-dialog-actions">
      <button class="btn" data-scope="import">${t('Import')}</button>
      <button class="btn" data-scope="cancel">${t('Cancel')}</button>
    </div>`;
  let imported = false;
  let settle: (done: boolean) => void = () => {};
  const closed = new Promise<boolean>((resolve) => { settle = resolve; });
  const modal = mountModal<void>(content, {
    className: 'clear-dialog',
    initialFocus: (el) => el.querySelector<HTMLElement>('.import-passphrase, [data-scope="import"]'),
    onClose: () => { modals?.delete(modal); settle(imported); },
  });
  modal.el.setAttribute('aria-labelledby', 'import-dialog-title');
  modals?.add(modal);

  const importBtn = modal.el.querySelector<HTMLButtonElement>('[data-scope="import"]')!;
  const field = modal.el.querySelector<HTMLInputElement>('.import-passphrase');
  const run = async (): Promise<void> => {
    if (importBtn.disabled) return;
    const btns = modal.el.querySelectorAll('button');
    const errEl = modal.el.querySelector<HTMLElement>('.import-error');
    btns.forEach(b => { b.disabled = true; });
    if (field) field.disabled = true;
    importBtn.textContent = t('Importing…');
    try {
      await onConfirm({ passphrase: field?.value ?? '' });
      imported = true;
      modal.close(); // success re-mounts the page; drop the dialog
    } catch (err) {
      if (errEl) { errEl.textContent = (err as { message?: string })?.message || t('Import failed.'); errEl.hidden = false; }
      btns.forEach(b => { b.disabled = false; });
      importBtn.textContent = t('Import');
      // A wrong passphrase is typed again: the field takes focus with its text selected.
      // Other failures return focus to Import, which lost the focus while disabled.
      if (field) { field.disabled = false; field.focus(); field.select(); } else importBtn.focus();
    }
  };
  modal.el.addEventListener('click', e => {
    const scope = (e.target as Element).closest<HTMLElement>('[data-scope]')?.dataset.scope;
    if (!scope) return;
    if (scope === 'cancel') { modal.close(); return; }
    void run();
  });
  field?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); void run(); }
  });
  return closed;
}
