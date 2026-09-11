// SPDX-License-Identifier: MPL-2.0
/**
 * The /profile "Sync across my devices" section (plans/138 B1). Device sync over
 * storage the person already owns: this device exports the whole-person bundle,
 * optionally encrypts it, and PUTs it to a connected provider; another device sees
 * the newer snapshot and applies it. No Lolly server in the path.
 *
 * Honest by construction: the copy states last-write-wins (applying replaces this
 * device's data), that the passphrase is device-local and unrecoverable if lost,
 * and that snapshots go straight to the user's own cloud. The section only offers
 * providers that (a) have a two-way SyncRemote and (b) are connected here - so it
 * sends people to Connected services first when nothing qualifies.
 */

import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { navigateTo } from '../nav.ts';
import { exportBackup } from '../data-transfer.ts';
import { getSyncConfig, saveSyncConfig } from '../lib/sync-config.ts';
import { availableSyncProviders, syncNow, checkNewer, applyNewer } from '../lib/sync-service.ts';

type SyncHost = Parameters<typeof exportBackup>[0]['host'];
const depsOf = (host: SyncHost) => ({ host, storage: localStorage });

function whenText(iso: string | null): string {
  if (!iso) return t('never');
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/** Fill the section body and wire it. Re-renders itself after every change. */
export async function mountSyncBody(body: HTMLElement, host: SyncHost): Promise<void> {
  const cfg = await getSyncConfig();
  const providers = availableSyncProviders();

  const intro = `<p class="storage-hint-text">${t('Keep your projects, brand and settings in step across your devices - through storage you own. Snapshots go straight from this device to your cloud; no Lolly server ever holds them. This is last-write-wins: applying a newer snapshot replaces this device’s data with it.')}</p>`;

  if (providers.length === 0) {
    body.innerHTML = `${intro}
      <p class="pconn-note">${t('First connect a provider that supports sync - an S3 bucket - in Connected services.')}</p>
      <div class="pconn-actions"><button type="button" class="btn" data-sync-goto-connections>${t('Open Connected services')}</button></div>`;
    body.querySelector('[data-sync-goto-connections]')?.addEventListener('click', () => {
      navigateTo('#/profile?focus=connections-section');
    });
    return;
  }

  const providerOpts = providers.map((p) =>
    `<option value="${escape(p.kind)}"${p.kind === cfg.providerKind ? ' selected' : ''}>${escape(p.label)}</option>`).join('');

  body.innerHTML = `${intro}
    <div class="pconn-form">
      <label class="pconn-field"><span>${t('Where to sync')}</span>
        <select class="field-input" data-sync-provider>
          <option value=""${cfg.providerKind ? '' : ' selected'}>${t('Choose a provider…')}</option>
          ${providerOpts}
        </select>
      </label>
      <label class="pconn-field"><span>${t('Passphrase (optional)')}</span>
        <input class="field-input" type="password" data-sync-pass value="${escape(cfg.passphrase ?? '')}" autocomplete="off" spellcheck="false" placeholder="${t('Encrypt before upload')}">
      </label>
      <p class="pconn-note">${t('A passphrase encrypts each snapshot before it leaves this device, so your cloud only ever holds ciphertext. It is needed to restore, stays on this device, and is never in backups - if you lose it, the snapshot can’t be recovered.')}</p>
    </div>
    <label class="pconn-home"><input type="checkbox" data-sync-enabled${cfg.enabled ? ' checked' : ''}> ${t('Sync across my devices')}</label>
    <div class="pconn-actions">
      <button type="button" class="btn" data-sync-now>${t('Sync now')}</button>
      <button type="button" class="btn" data-sync-check>${t('Check for a newer version')}</button>
      <span class="pconn-status" data-sync-status role="status"></span>
    </div>
    <p class="pconn-note">${t('Last synced: {when}', { when: whenText(cfg.lastSyncedAt) })}</p>`;

  const status = (msg: string): void => {
    const el = body.querySelector<HTMLElement>('[data-sync-status]');
    if (el) el.textContent = msg;
  };
  const busy = (on: boolean): void => {
    body.querySelectorAll<HTMLButtonElement>('.pconn-actions .btn').forEach((b) => { b.disabled = on; });
  };

  // Persist provider / passphrase / enabled as they change.
  body.querySelector<HTMLSelectElement>('[data-sync-provider]')?.addEventListener('change', async (e) => {
    await saveSyncConfig({ providerKind: (e.target as HTMLSelectElement).value });
  });
  body.querySelector<HTMLInputElement>('[data-sync-pass]')?.addEventListener('change', async (e) => {
    await saveSyncConfig({ passphrase: (e.target as HTMLInputElement).value });
  });
  body.querySelector<HTMLInputElement>('[data-sync-enabled]')?.addEventListener('change', async (e) => {
    await saveSyncConfig({ enabled: (e.target as HTMLInputElement).checked });
    announce((e.target as HTMLInputElement).checked ? t('Enabled') : t('Disabled'));
  });

  body.querySelector('[data-sync-now]')?.addEventListener('click', async () => {
    // Persist any unsaved provider/passphrase edits first (change may not have fired).
    const provider = body.querySelector<HTMLSelectElement>('[data-sync-provider]')?.value ?? '';
    const pass = body.querySelector<HTMLInputElement>('[data-sync-pass]')?.value ?? '';
    await saveSyncConfig({ providerKind: provider, passphrase: pass });
    if (!provider) { status(t('Pick a provider first.')); return; }
    busy(true); status(t('Syncing…'));
    try {
      await syncNow(depsOf(host));
      const now = await getSyncConfig();
      status(t('Synced. Last synced: {when}', { when: whenText(now.lastSyncedAt) }));
      announce(t('Synced'));
    } catch (err) {
      status(String((err as Error)?.message || t('Sync failed - try again')));
    } finally { busy(false); }
  });

  body.querySelector('[data-sync-check]')?.addEventListener('click', async () => {
    const provider = body.querySelector<HTMLSelectElement>('[data-sync-provider]')?.value ?? '';
    if (!provider) { status(t('Pick a provider first.')); return; }
    await saveSyncConfig({ providerKind: provider });
    busy(true); status(t('Checking…'));
    try {
      const { hasNewer } = await checkNewer();
      busy(false);
      if (!hasNewer) { status(t('You’re up to date.')); return; }
      const ok = await confirmDialog({
        title: t('Apply the newer snapshot?'),
        message: t('A newer version of your data is in your cloud, synced from another device. Applying it replaces this device’s projects, brand and settings with that version. This can’t be undone.'),
        confirmLabel: t('Apply and reload'),
        danger: true,
      });
      if (!ok) { status(t('Left this device unchanged.')); return; }
      busy(true); status(t('Applying…'));
      await applyNewer(depsOf(host));
      status(t('Applied. Reloading…'));
      setTimeout(() => { location.reload(); }, 600);
    } catch (err) {
      status(String((err as Error)?.message || t('Couldn’t check - try again')));
      busy(false);
    }
  });
}
