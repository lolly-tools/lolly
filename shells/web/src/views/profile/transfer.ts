// SPDX-License-Identifier: MPL-2.0
/**
 * Import/export — move everything (profile, saved sessions, uploaded images,
 * preferences) to or from a portable .zip, via data-transfer.ts.
 */

import { applyTheme } from '../../theme.ts';
import { announce } from '../../a11y.ts';
import { saveBlob } from '../../pro/zip.ts';
import { exportBackup, importBackup } from '../../data-transfer.ts';
import type { BackupHost } from '../../data-transfer.ts';
import type { WebHost } from '../../bridge/index.ts';
import type { Profile } from '@lolly/engine';
import type { SavedStateData } from '../../bridge/state.ts';
import type { UserAssetRecord } from '../../bridge/assets.ts';

// data-transfer.ts's BackupHost is deliberately loosely typed (it travels
// across shells with very different bridges) — adapt the concrete WebHost to
// it here, at the one seam that needs both shapes.
function toBackupHost(host: WebHost): BackupHost {
  return {
    profile: {
      // Spread into a fresh object literal so it structurally satisfies
      // Record<string, unknown> (Profile itself has no index signature).
      get: async () => ({ ...(await host.profile.get()) }),
      // The bundle's restored profile is a plain object; it's the same shape
      // host.profile.set expects, just typed generically by the transfer contract.
      set: (profile) => host.profile.set(profile as Profile),
    },
    state: {
      list: () => host.state.list(),
      load: (slot) => host.state.load(slot),
      // The bundle's restored session data is a plain object read back from
      // JSON; it's the same shape host.state.save expects (toolId/label plus
      // input values), just typed generically (`unknown`) by the transfer
      // contract, which has no dependency on the engine's InputValue type.
      save: (slot, data, thumb) => host.state.save(slot, data as SavedStateData, thumb),
    },
    assets: {
      // Spread each record into a fresh object literal so the array
      // structurally satisfies BackupAssetRecord[] (UserAssetRecord itself
      // has no index signature) — same trick as profile.get() above.
      _exportUserAssets: async () => (await host.assets._exportUserAssets()).map(r => ({ ...r })),
      // The bundle's restored asset record is a plain object; it's the same
      // shape host.assets._importUserAsset expects, just typed generically by
      // the transfer contract. Record<string, unknown> and UserAssetRecord
      // don't structurally overlap enough for a direct assertion, so route
      // through `unknown` — an interop-boundary cast, not a shortcut.
      _importUserAsset: (record) => host.assets._importUserAsset(record as unknown as UserAssetRecord),
    },
  };
}

// Confirmation dialog gated on typing nothing extra — just "Import" / "Cancel" —
// but still gives the operation a chance to report failure inline before the
// caller re-mounts the page. Mirrors the "clear all my data" dialog's shape.
function showImportDialog(onConfirm: () => Promise<void>): void {
  const overlay = document.createElement('div');
  overlay.className = 'clear-dialog-overlay';
  overlay.innerHTML = `
    <div class="clear-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
      <h3 id="import-dialog-title">Import data?</h3>
      <p>This loads the profile, saved sessions, images and preferences from the file. Anything with the same name on this device is overwritten; everything else is kept.</p>
      <p class="import-error" style="color:hsl(var(--destructive));font-size:13px;margin:0" hidden></p>
      <div class="clear-dialog-actions">
        <button class="btn" data-scope="import">Import</button>
        <button class="btn" data-scope="cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Escape-to-dismiss + focus-restore, mirroring openImageLightbox. (A full
  // Tab focus-trap is deferred — see followups.)
  const opener = document.activeElement;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
  const dismiss = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (opener instanceof HTMLElement) opener.focus();
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector<HTMLButtonElement>('[data-scope="import"]')?.focus();

  overlay.addEventListener('click', async e => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const scope = target.closest<HTMLElement>('[data-scope]')?.dataset.scope;
    if (!scope) return;
    if (scope === 'cancel') { dismiss(); return; }

    const btns = overlay.querySelectorAll<HTMLButtonElement>('button');
    const errEl = overlay.querySelector<HTMLElement>('.import-error');
    btns.forEach(b => (b.disabled = true));
    if (target instanceof HTMLElement) target.textContent = 'Importing…';
    try {
      await onConfirm();
      document.removeEventListener('keydown', onKey);
      overlay.remove(); // success re-mounts the page; drop the (body-level) overlay
    } catch (err) {
      if (errEl) {
        errEl.textContent = err instanceof Error ? err.message : 'Import failed.';
        errEl.hidden = false;
      }
      btns.forEach(b => (b.disabled = false));
      if (target instanceof HTMLElement) target.textContent = 'Import';
    }
  });
}

export interface WireDataTransferOptions {
  /** Re-mount the whole profile view after a successful import (fresh data). */
  remount: () => Promise<void>;
}

// Wire the "Move to another device" export/import buttons.
export function wireDataTransfer(viewEl: HTMLElement, host: WebHost, opts: WireDataTransferOptions): void {
  const backupHost = toBackupHost(host);

  // Export everything to a portable .zip for carrying to another offline install.
  viewEl.querySelector('#export-data-btn')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    if (!(btn instanceof HTMLButtonElement)) return;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Exporting…';
    try {
      const { blob, filename, summary } = await exportBackup({ host: backupHost, storage: localStorage });
      saveBlob(blob, filename);
      announce(`Exported ${summary.sessions} session${summary.sessions === 1 ? '' : 's'} and ${summary.userAssets} image${summary.userAssets === 1 ? '' : 's'}`);
      btn.textContent = 'Exported';
    } catch (err) {
      host.log?.('error', 'Data export failed', { error: String(err) });
      btn.textContent = 'Export failed';
    }
    setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1800);
  });

  // Import a bundle from another install (merge-overwrite), then re-mount.
  const importInput = viewEl.querySelector<HTMLInputElement>('#import-data-input');
  viewEl.querySelector('#import-data-btn')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', () => {
    const file = importInput.files?.[0];
    importInput.value = ''; // let the same file be re-picked later
    if (!file) return;
    showImportDialog(async () => {
      const bytes = await file.arrayBuffer();
      const summary = await importBackup({ host: backupHost, storage: localStorage }, bytes);
      host.profile.bust();
      applyTheme(localStorage.getItem('theme') || 'light');
      // `skipped` > 0 means the bundle came from a newer app and carried parts this
      // build doesn't understand yet — surface it rather than pretend a full restore.
      const skipNote = summary.skipped ? ` · ${summary.skipped} newer item${summary.skipped === 1 ? '' : 's'} skipped` : '';
      announce(`Imported ${summary.sessions} session${summary.sessions === 1 ? '' : 's'} and ${summary.userAssets} image${summary.userAssets === 1 ? '' : 's'}${skipNote}`);
      await opts.remount();
    });
  });
}
