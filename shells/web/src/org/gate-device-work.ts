// SPDX-License-Identifier: MPL-2.0
/**
 * org/gate-device-work - the signed-out gate's way back to the work kept in this browser
 * (plan 75 WEBGATE). Signed out of a gated workspace, the app is out of reach, but work
 * saved on this device is still here: when the device holds any that is the browser's
 * own, the gate offers "Download the work saved in this browser", a backup file in the
 * format Settings exports.
 *
 * Anyone at a signed-out screen can press that button, so the file carries only work
 * that belongs to nobody in particular. It leaves out:
 *  - recovery copies tagged to an account (lib/collab-recovery-owner.ts): interrupted
 *    team edits, which their owner downloads or discards from Sign out
 *    (org/account-chip.ts), and which the recovery notices show only to that account;
 *  - device copies of team documents, which a durable team origin points at
 *    (org/team-origin-durable.ts);
 *  - the revision history, whose checkpoints are kept per document and would carry
 *    those documents' earlier states. The current copy of the rest of the work travels.
 * The offer shows only when something is left after that. org/index.ts loads this
 * module only when it draws the gate, so none of it is on the boot path.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { exportBackup } from '../data-transfer.ts';
import { RECOVERY_SLOT_PREFIX, recoveryOwner } from '../lib/collab-recovery-owner.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { t } from '../i18n.ts';

type BackupHost = Parameters<typeof exportBackup>[0]['host'];

/** Whether the live host can write a full backup (the web and app bridges can; a test host may not). */
function canBackUp(host: HostV1): host is HostV1 & BackupHost {
  return typeof (host.assets as { _exportUserAssets?: unknown })._exportUserAssets === 'function';
}

/**
 * The slots of `rows` the gate's download leaves out (see the header): every recovery
 * copy carrying an owner tag, or that cannot be read to tell, and every slot a durable
 * team origin points at.
 */
export async function gateWithheldSlots(
  state: Pick<HostV1['state'], 'load'>, rows: ReadonlyArray<{ slot: string }>,
): Promise<Set<string>> {
  const withheld = new Set<string>();
  for (const { slot } of rows) {
    if (!slot.startsWith(RECOVERY_SLOT_PREFIX)) continue;
    let data: unknown = null;
    try { data = await state.load(slot); } catch { withheld.add(slot); continue; }
    if (recoveryOwner(data)) withheld.add(slot);
  }
  try {
    for (const slot of await (await import('./team-origin-durable.ts')).durableTeamOriginSlots()) withheld.add(slot);
  } catch { /* the store cannot be read: no team copy is known */ }
  return withheld;
}

/**
 * `host` as the gate's export sees it: device storage that lists and loads only the
 * slots not in `withheld`, and no revision history. Everything else (profile, images,
 * design systems, preferences) is the host's own.
 */
export function gateExportHost<H extends BackupHost>(host: H, withheld: ReadonlySet<string>): H {
  const source = host.state;
  const state: BackupHost['state'] = {
    list: async () => (await source.list()).filter((row) => !withheld.has(row.slot)),
    load: async (slot) => (withheld.has(slot) ? null : source.load(slot)),
    save: (slot, data, thumb) => source.save(slot, data, thumb),
  };
  return new Proxy(host, { get: (target, key, receiver) => (key === 'state' ? state : Reflect.get(target, key, receiver)) });
}

/** Fill the gate's `slot` with the offer when this browser holds work the gate may hand out. */
export function offerDeviceWork(slot: HTMLElement): void {
  const host = getHostRef();
  if (!host?.state || !canBackUp(host)) return;
  const withheldNow = async (): Promise<Set<string>> => gateWithheldSlots(host.state, await host.state.list());
  void (async () => {
    const rows = await host.state.list();
    const withheld = await gateWithheldSlots(host.state, rows);
    if (!rows.some((row) => !withheld.has(row.slot)) || !slot.isConnected) return;
    const label = t('Download the work saved in this browser');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.dataset.act = 'gate-device-work';
    btn.style.cssText = 'min-width:9rem;min-height:var(--ui-size-target)';
    btn.textContent = label;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.style.cssText = 'margin:.5rem 0 0;font-size:.85rem;color:hsl(var(--destructive))';
    status.hidden = true;
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = t('Exporting…');
      status.hidden = true;
      try {
        const { exportBackup: backUp } = await import('../data-transfer.ts');
        // Asked again at the press: a copy saved or tagged since the offer is left out too.
        const { blob, filename } = await backUp({ host: gateExportHost(host, await withheldNow()), storage: localStorage });
        if (host.export?.download) await host.export.download(blob, filename);
        else (await import('../bridge/anchor-save.ts')).anchorSave(blob, filename);
      } catch {
        status.textContent = t('Data export failed. Keep your local files and try again.');
        status.hidden = false;
      }
      btn.disabled = false;
      btn.textContent = label;
    });
    slot.replaceChildren(btn, status);
    slot.hidden = false;
  })().catch(() => { /* device storage unreadable: no offer, the gate stands as it is */ });
}
