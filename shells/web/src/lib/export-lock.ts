// SPDX-License-Identifier: MPL-2.0
/**
 * Shared "ask before render, optionally lock the download" prompt for every
 * batch/zip export flow - the Pro grid, a folder download, and a multi-selection
 * download. Cancelling aborts. A blank password means no lock.
 *
 * When a password is set it does BOTH, with one password (defense in depth):
 *   - locks the whole zip at the chosen tier (Standard = ZipCrypto, opens anywhere
 *     incl. Windows Explorer, weak; Strong = AES-256 / WinZip AE-2, strong but not
 *     Windows Explorer's built-in extract), protecting EVERY member incl. images, and
 *   - individually AES-256-locks any PDF members (via `strongPassword` → the R6 PDF
 *     lock), so a PDF stays locked even after the zip is extracted.
 */
import { confirmDialog } from '../components/confirm-dialog.ts';
import { mountModal } from '../components/modal.ts';
import { escape } from '../utils.ts';
import { t } from '../i18n.ts';
import type { ZipTier } from '@lolly/engine';

export interface ExportLockResult {
  /** false → the user cancelled; do not render. */
  ok: boolean;
  /** AES-256 password for the PDF members (R6 lock). Same value as the zip password. */
  strongPassword?: string;
  /** Whole-zip encryption tier (only when a password was set). */
  zipLock?: ZipTier;
  /** Deliver as ONE merged PDF (one row's pages after another) instead of a zip
   *  (plans/140 S5). Only offered when every row renders to PDF. */
  combinePdf?: boolean;
}

/**
 * @param what           human phrase for the title, e.g. "5 files", "this folder".
 * @param offerPassword  whether the run can produce lockable content (offer the
 *                       password + tier) or not (a plain confirm).
 */
export async function askExportLock(what: string, offerPassword: boolean, opts?: { offerCombine?: boolean }): Promise<ExportLockResult> {
  if (!offerPassword) {
    const ok = await confirmDialog({ title: `Render ${what}?`, message: 'Renders into a zip.', confirmLabel: 'Render', danger: false });
    return { ok };
  }
  return new Promise<ExportLockResult>((resolve) => {
    // Both controls take their box from the shared `.field-*` primitive
    // (styles/parts/fields.css, `primitives` layer) instead of the inline recipe
    // this file used to retype. The select deliberately does NOT carry
    // `.pdfpass-tier`: that rule lives in the LAZY, `views`-layer tool-chrome.css
    // (the export panel's own tier control), so it would win over the primitive
    // only in sessions that happened to load the tool view - and its `background:`
    // shorthand would erase the primitive's chevron on an `appearance:none` box.
    // The class was styling-only here; `.export-lock-tier` is the JS hook.
    const content = `
      <h2 class="modal-title">${escape(`Render ${what}?`)}</h2>
      <p class="modal-msg">Renders into a zip. Optionally set a password to lock the whole download (blank = no lock). Any PDFs inside are also individually AES-256-locked, so they stay locked after the zip is extracted.</p>
      <input type="password" class="field-input export-lock-pw" autocomplete="off" spellcheck="false" placeholder="Password (optional)" aria-label="${escape(t('Zip password (optional)'))}">
      <select class="field-select export-lock-tier" aria-label="Zip lock strength">
        <option value="strong">Strong · AES-256 - needs 7-Zip / WinZip / macOS (not Windows Explorer) ⓘ</option>
        <option value="standard">Standard · opens anywhere incl. Windows Explorer - weaker</option>
      </select>
      ${opts?.offerCombine ? `
      <label class="export-lock-combine-row" style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;text-align:left">
        <input type="checkbox" class="field-check export-lock-combine" style="margin-top:2px">
        <span>Single PDF - one row per page, ready for a print shop. The zip keeps each file's own Content Credentials; the combined PDF does not.</span>
      </label>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn modal-cancel" data-act="cancel">Cancel</button>
        <button type="button" class="btn modal-primary" data-act="ok">Render</button>
      </div>`;
    const modal = mountModal<ExportLockResult>(content, {
      className: 'modal',
      cancelValue: { ok: false },
      initialFocus: (el) => el.querySelector<HTMLElement>('.export-lock-pw'),
      onClose: (result) => resolve(result ?? { ok: false }),
    });
    const pwEl = modal.el.querySelector<HTMLInputElement>('.export-lock-pw')!;
    const tierEl = modal.el.querySelector<HTMLSelectElement>('.export-lock-tier')!;
    modal.el.addEventListener('click', (e) => {
      const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act === 'ok') {
        const pw = pwEl.value;
        const combinePdf = modal.el.querySelector<HTMLInputElement>('.export-lock-combine')?.checked || undefined;
        modal.close({ ok: true, strongPassword: pw || undefined, zipLock: pw ? (tierEl.value as ZipTier) : undefined, combinePdf });
        return;
      }
      if (act === 'cancel') modal.close({ ok: false });
    });
  });
}
