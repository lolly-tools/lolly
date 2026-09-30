// SPDX-License-Identifier: MPL-2.0
/**
 * The /profile "Sync across my devices" section (plans/138 B1, Tier D). Device sync
 * over storage the person already owns: this device exports the whole-person
 * bundle, optionally encrypts it, and writes it to a connected provider; another
 * device sees the newer copy and applies it. No Lolly server in the path.
 *
 * What the section shows, in order: where to sync, the optional passphrase (off
 * unless the person sets one, plans/138 Tier D D8), the switch, any choice the
 * person must make (a conflict, or a first join onto an existing copy), the status
 * (changes waiting, the last error, last synced), and the actions, including
 * restoring an earlier copy. The section only offers providers that have a two-way
 * SyncRemote and are connected here, so it sends people to Connected services
 * first when nothing qualifies.
 */

import { t, tRaw, currentLang } from '../i18n.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { escape } from '../utils.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { serviceMark } from '../lib/service-marks.ts';
import { COLLAPSE_CHEV } from './profile/shared.ts';
import { announce } from '../a11y.ts';
import { confirmDialog, choiceDialog } from '../components/confirm-dialog.ts';
import { navigateTo } from '../nav.ts';
import { exportBackup } from '../data-transfer.ts';
import { getSyncConfig, saveSyncConfig } from '../lib/sync-config.ts';
import { listConnections } from '../lib/provider-connections.ts';
import { syncChoicesFor, shellFacts, type SyncChoice } from '../lib/sync-choices.ts';
import { mobileSignInKinds } from '../lib/mobile-sign-in.ts';
import {
  availableSyncProviders, syncProviderKinds, syncNow, checkNewer, applyNewer, existingCopyForFirstJoin,
  joinBringHere, keepThisDevice, listRestorePoints, restoreFrom, type SyncSlot,
} from '../lib/sync-service.ts';

type SyncHost = Parameters<typeof exportBackup>[0]['host'];
const depsOf = (host: SyncHost) => ({ host, storage: localStorage });

function whenText(iso: string | null | undefined): string {
  if (!iso) return t('never');
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

const sizeText = (bytes: number): string => (bytes < 1024 * 1024
  ? t('{n} KB', { n: Math.max(1, Math.round(bytes / 1024)) })
  : t('{n} MB', { n: Math.round(bytes / (1024 * 1024)) }));

/** A name for a restore slot: "Before your last apply", or the weekday. */
function slotLabel(slot: SyncSlot): string {
  if (slot === 'before-apply') return t('Before your last apply');
  const day = Number(slot.slice('day-'.length));
  // 1 January 2024 was a Monday, so day N is that date plus N - 1 days.
  const date = new Date(Date.UTC(2024, 0, day));
  try {
    return new Intl.DateTimeFormat(currentLang(), { weekday: 'long', timeZone: 'UTC' }).format(date);
  } catch {
    return slot;
  }
}

/** Sync words for the copy of Lolly that syncs: this browser on the web, whose storage
 *  belongs to the browser, and this device in the desktop and mobile apps. Whole
 *  sentences per shell, for translation. */
const bringHereLabel = (): string => (isTauriShell() ? t('Bring it to this device') : t('Bring it to this browser'));
const replaceWithHereLabel = (): string => (isTauriShell() ? t('Replace it with this device') : t('Replace it with this browser'));
const bringHereNote = (): string => (isTauriShell()
  ? t('Bringing it here adds the synced data to this device and removes nothing.')
  : t('Bringing it here adds the synced data to this browser and removes nothing.'));

/** The "where can this device sync" list (plans/138 Tier D, WP-S5): one row per
 *  sync home, with its mark, why, and either the step that sets it up or its state. */
function choicesListHtml(choices: SyncChoice[]): string {
  const stateText: Record<SyncChoice['state'], string> = {
    ready: t('Ready'), setup: t('Needs set-up'), planned: t('Planned'), unavailable: t('Not on this device'),
  };
  const actionText: Record<NonNullable<SyncChoice['action']>, string> = {
    connections: t('Set up'), storage: t('Open Storage'),
  };
  const rows = choices.map((c) => `
    <li class="pconn-choice" data-state="${escape(c.state)}">
      ${serviceMark(c.id)}
      <span class="pconn-choice-text"><span class="pconn-choice-name">${escape(c.label)}</span>
        <span class="pconn-note">${escape(c.note)}</span></span>
      ${c.action && (c.state !== 'ready' || c.action === 'storage')
        ? `<button type="button" class="btn" data-sync-goto="${escape(c.action!)}" data-sync-kind="${escape(c.id)}">${escape(actionText[c.action!])}</button>`
        : `<span class="pconn-choice-state">${escape(stateText[c.state])}</span>`}
    </li>`).join('');
  return `<ul class="pconn-choices">${rows}</ul>`;
}

/** Open a service's row in Connected services, unfolding its group, and move there. */
function openService(kind: string): void {
  const row = document.querySelector<HTMLDetailsElement>(`#connections-body [data-pconn="${CSS.escape(kind)}"]`);
  if (!row) { document.querySelector('#connections-body')?.scrollIntoView({ block: 'start' }); return; }
  const group = row.closest<HTMLDetailsElement>('[data-pconn-group]');
  if (group) group.open = true;
  row.open = true;
  row.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  row.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
}

/** Fill the section body and wire it. Re-renders itself after every change. */
export async function mountSyncBody(body: HTMLElement, host: SyncHost): Promise<void> {
  const cfg = await getSyncConfig();
  // availableSyncProviders() reads the in-memory connection cache, which is still
  // empty when /profile is the first page loaded; warm it first, as the export
  // panel does (lib/send-targets-builtin.ts).
  const connections = await listConnections().catch(() => []);
  const providers = availableSyncProviders();
  const rerender = (): Promise<void> => mountSyncBody(body, host);
  const choices = syncChoicesFor(shellFacts(connections.map((c) => c.kind), syncProviderKinds(), mobileSignInKinds()));
  const wireGoto = (): void => {
    body.querySelectorAll<HTMLButtonElement>('[data-sync-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.syncGoto === 'storage') { navigateTo('#/profile?focus=storage-section'); return; }
        openService(btn.dataset.syncKind ?? '');
      });
    });
  };

  const intro = `<p class="storage-hint-text">${isTauriShell() ? t('Keep your projects, brand and settings in step across your devices, through storage you own. Your data goes straight from this device to your storage; no Lolly server ever holds it. Before a newer copy is applied here, a copy of this device is saved, so you can undo it.') : t('Keep your projects, brand and settings in step across your devices, through storage you own. Your data goes straight from this device to your storage; no Lolly server ever holds a copy. Before a newer copy is applied here, this browser’s data is saved, so you can undo the change.')}</p>`;

  // The group's folded value: whether this device syncs.
  const showOn = (on: boolean): void => {
    const value = body.closest('details')?.querySelector<HTMLElement>(':scope > summary [data-group-value]');
    if (value) value.textContent = on ? tRaw('On') : tRaw('Off');
  };
  showOn(providers.length > 0 && cfg.enabled);

  if (providers.length === 0) {
    body.innerHTML = `${intro}
      <p class="pconn-note">${t('First connect a provider that supports sync in Connected services. This is what works on this device:')}</p>
      ${choicesListHtml(choices)}`;
    wireGoto();
    return;
  }

  const providerOpts = providers.map((p) =>
    `<option value="${escape(p.kind)}"${p.kind === cfg.providerKind ? ' selected' : ''}>${escape(p.label)}</option>`).join('');

  // A choice the person must make before automatic sync continues.
  let choicePanel = '';
  if (cfg.conflict && cfg.lastSyncedRev === null) {
    choicePanel = `<div class="pconn-cred pconn-sync-choice" role="group" aria-label="${escape(t('Choose what to keep'))}">
      <p>${isTauriShell() ? t('Your sync home already has Lolly data from {when}. Choose what to keep before this device starts syncing.', { when: whenText(cfg.conflict.updatedAt) }) : t('Your sync home already has Lolly data from {when}. Choose what to keep before this browser starts syncing.', { when: whenText(cfg.conflict.updatedAt) })}</p>
      <div class="pconn-actions">
        <button type="button" class="btn btn--primary" data-sync-join="bring">${bringHereLabel()}</button>
        <button type="button" class="btn" data-sync-join="replace">${replaceWithHereLabel()}</button>
      </div>
      <p class="pconn-note">${bringHereNote()}</p>
    </div>`;
  } else if (cfg.conflict) {
    choicePanel = `<div class="pconn-cred pconn-sync-choice" role="group" aria-label="${escape(t('Choose what to keep'))}">
      <p>${isTauriShell() ? t('Your synced data changed on another device ({when}), and this device has changes of its own. Automatic sync is paused until you choose.', { when: whenText(cfg.conflict.updatedAt) }) : t('Your synced data changed on another device ({when}), and this browser has changes of its own. Automatic sync is paused until you choose.', { when: whenText(cfg.conflict.updatedAt) })}</p>
      <div class="pconn-actions">
        <button type="button" class="btn btn--primary" data-sync-resolve="synced">${t('Use the synced copy')}</button>
        <button type="button" class="btn" data-sync-resolve="device">${isTauriShell() ? t('Keep this device') : t('Keep this browser')}</button>
      </div>
      <p class="pconn-note">${t('Either way, the other version is kept in your sync home, and you can restore it below.')}</p>
    </div>`;
  }

  const waiting = cfg.dirty && !cfg.conflict
    ? `<p class="pconn-note">${cfg.enabled
      ? (isTauriShell() ? t('Changes on this device are waiting to sync.') : t('Changes in this browser are waiting to sync.'))
      : (isTauriShell() ? t('This device has changes that are not synced. Turn on sync, or use Sync now.') : t('This browser has changes that are not synced. Turn on sync, or use Sync now.'))}</p>`
    : '';
  const lastError = cfg.lastError
    ? `<p class="pconn-note" role="alert">${t('The last sync did not finish: {reason}', { reason: cfg.lastError })}</p>`
    : '';

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
      <p class="pconn-note">${t('Leave this empty unless you do not trust the place you sync to. With a passphrase, your data is encrypted on this device before upload, and every device needs the same passphrase. If it is lost, the synced copies cannot be opened.')}</p>
    </div>
    <label class="pconn-home"><input type="checkbox" data-sync-enabled${cfg.enabled ? ' checked' : ''}> ${t('Sync across my devices')}</label>
    ${choicePanel}
    ${waiting}
    ${lastError}
    <div class="pconn-actions">
      <button type="button" class="btn" data-sync-now>${t('Sync now')}</button>
      <button type="button" class="btn" data-sync-check>${t('Check for a newer version')}</button>
      <button type="button" class="btn" data-sync-restore>${t('Restore an earlier copy')}</button>
      <span class="pconn-status" data-sync-status role="status"></span>
    </div>
    <div data-sync-restore-list hidden></div>
    <p class="pconn-note">${t('Last synced: {when}', { when: whenText(cfg.lastSyncedAt) })}</p>
    <details class="pconn-sync-choices">
      <summary class="pconn-sync-choices-sum"><span>${t('Where this device can sync')}</span>${COLLAPSE_CHEV}</summary>
      ${choicesListHtml(choices)}
    </details>`;
  wireGoto();

  const status = (msg: string): void => {
    const el = body.querySelector<HTMLElement>('[data-sync-status]');
    if (el) el.textContent = msg;
  };
  const busy = (on: boolean): void => {
    body.querySelectorAll<HTMLButtonElement>('.pconn-actions .btn').forEach((b) => { b.disabled = on; });
  };
  const failed = (err: unknown, fallback: string): void => {
    status(String((err as Error)?.message || fallback));
    busy(false);
  };
  /** Persist any unsaved provider/passphrase edits (change may not have fired). */
  const saveFields = async (): Promise<string> => {
    const provider = body.querySelector<HTMLSelectElement>('[data-sync-provider]')?.value ?? '';
    const pass = body.querySelector<HTMLInputElement>('[data-sync-pass]')?.value ?? '';
    await saveSyncConfig({ providerKind: provider, passphrase: pass });
    return provider;
  };
  const reloadSoon = (): void => { setTimeout(() => { location.reload(); }, 600); };

  /** "Replace it with this device" / "Keep this device", after a second confirm. */
  const replaceSyncedCopy = async (when: string | undefined): Promise<boolean> => {
    const ok = await confirmDialog({
      title: t('Replace the synced copy?'),
      message: isTauriShell() ? tRaw('The synced copy from {when} is replaced by this device. Other devices then get this device’s version. The replaced copy stays in your sync home as an earlier copy you can restore.', { when: whenText(when) }) : tRaw('The synced copy from {when} is replaced by this browser’s data. Other devices then get this browser’s version. The replaced copy stays in your sync home as an earlier copy you can restore.', { when: whenText(when) }),
      confirmLabel: t('Replace'),
      danger: true,
    });
    if (!ok) return false;
    busy(true); status(t('Syncing…'));
    await keepThisDevice(depsOf(host));
    announce(t('Synced'));
    return true;
  };

  /** Ask the first-join question when the store already holds a copy. Returns
   *  false when the person cancelled, so the switch stays off. */
  const askFirstJoin = async (): Promise<boolean> => {
    const existing = await existingCopyForFirstJoin();
    if (!existing) return true;
    const choice = await choiceDialog({
      title: t('Your sync home already has Lolly data'),
      message: `${isTauriShell() ? tRaw('It was synced from another device on {when}. Bring it to this device, or replace it with this device?', { when: whenText(existing.updatedAt) }) : tRaw('It was synced from another device on {when}. Bring it to this browser, or replace it with this browser?', { when: whenText(existing.updatedAt) })} ${bringHereNote()}`,
      choices: [
        { id: 'replace', label: replaceWithHereLabel() },
        { id: 'bring', label: bringHereLabel(), primary: true },
      ],
    });
    if (choice === 'bring') {
      busy(true); status(t('Applying…'));
      await saveSyncConfig({ enabled: true });
      await joinBringHere(depsOf(host));
      status(t('Applied. Reloading…'));
      reloadSoon();
      return true;
    }
    if (choice === 'replace') {
      await saveSyncConfig({ enabled: true });
      if (await replaceSyncedCopy(existing.updatedAt)) { await rerender(); return true; }
      await saveSyncConfig({ enabled: false });
    }
    return false;
  };

  // Persist provider / passphrase as they change.
  body.querySelector<HTMLSelectElement>('[data-sync-provider]')?.addEventListener('change', async (e) => {
    await saveSyncConfig({ providerKind: (e.target as HTMLSelectElement).value });
  });
  body.querySelector<HTMLInputElement>('[data-sync-pass]')?.addEventListener('change', async (e) => {
    await saveSyncConfig({ passphrase: (e.target as HTMLInputElement).value });
  });
  body.querySelector<HTMLInputElement>('[data-sync-enabled]')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.checked) {
      await saveSyncConfig({ enabled: false });
      showOn(false);
      announce(t('Disabled'));
      return;
    }
    const provider = await saveFields();
    if (!provider) { input.checked = false; status(t('Pick a provider first.')); return; }
    try {
      if (!(await askFirstJoin())) { input.checked = false; return; }
      await saveSyncConfig({ enabled: true });
      showOn(true);
      announce(t('Enabled'));
    } catch (err) {
      input.checked = false;
      await saveSyncConfig({ enabled: false });
      failed(err, t('Sync failed - try again'));
    }
  });

  body.querySelector('[data-sync-now]')?.addEventListener('click', async () => {
    const provider = await saveFields();
    if (!provider) { status(t('Pick a provider first.')); return; }
    busy(true); status(t('Syncing…'));
    try {
      const result = await syncNow(depsOf(host));
      if (result.status === 'conflict') { await rerender(); return; }
      if (result.status === 'newer') {
        busy(false);
        status(t('Another device synced newer changes. Use “Check for a newer version” to bring them here.'));
        return;
      }
      await rerender();
      const now = await getSyncConfig();
      status(t('Synced. Last synced: {when}', { when: whenText(now.lastSyncedAt) }));
      announce(t('Synced'));
    } catch (err) {
      await rerender();
      failed(err, t('Sync failed - try again'));
    }
  });

  body.querySelector('[data-sync-check]')?.addEventListener('click', async () => {
    const provider = await saveFields();
    if (!provider) { status(t('Pick a provider first.')); return; }
    busy(true); status(t('Checking…'));
    try {
      const { hasNewer, meta } = await checkNewer();
      busy(false);
      if (!hasNewer) { status(t('You’re up to date.')); return; }
      const current = await getSyncConfig();
      if (current.lastSyncedRev === null) {
        if (await askFirstJoin()) await rerender();
        return;
      }
      if (current.dirty) {
        await applyNewer(depsOf(host));        // records the conflict instead of applying
        await rerender();
        return;
      }
      const ok = await confirmDialog({
        title: t('Apply the newer version?'),
        message: isTauriShell() ? tRaw('Another device synced newer changes on {when}. Applying them updates this device to match, including items deleted there. A copy of this device is saved first, so you can undo this below.', { when: whenText(meta?.updatedAt) }) : tRaw('Another device synced newer changes on {when}. Applying them updates this browser to match, including items deleted there. A copy of this browser’s data is saved first, so you can undo this below.', { when: whenText(meta?.updatedAt) }),
        confirmLabel: t('Apply and reload'),
        danger: false,
      });
      if (!ok) { status(isTauriShell() ? t('Left this device unchanged.') : t('Left this browser unchanged.')); return; }
      busy(true); status(t('Applying…'));
      await applyNewer(depsOf(host));
      status(t('Applied. Reloading…'));
      reloadSoon();
    } catch (err) {
      failed(err, t('Couldn’t check - try again'));
    }
  });

  body.querySelectorAll<HTMLButtonElement>('[data-sync-join]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        if (btn.dataset.syncJoin === 'bring') {
          busy(true); status(t('Applying…'));
          await joinBringHere(depsOf(host));
          status(t('Applied. Reloading…'));
          reloadSoon();
        } else if (await replaceSyncedCopy(cfg.conflict?.updatedAt)) {
          await rerender();
        }
      } catch (err) {
        failed(err, t('Sync failed - try again'));
      }
    });
  });

  body.querySelectorAll<HTMLButtonElement>('[data-sync-resolve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        if (btn.dataset.syncResolve === 'synced') {
          const ok = await confirmDialog({
            title: t('Use the synced copy?'),
            message: isTauriShell() ? tRaw('This device is updated to match the synced copy from {when}. Its own changes are saved to your sync home first, so you can restore them below.', { when: whenText(cfg.conflict?.updatedAt) }) : tRaw('This browser is updated to match the synced copy from {when}. Its own changes are saved to your sync home first, so you can restore them below.', { when: whenText(cfg.conflict?.updatedAt) }),
            confirmLabel: t('Use the synced copy'),
            danger: false,
          });
          if (!ok) return;
          busy(true); status(t('Applying…'));
          await applyNewer(depsOf(host), { useSynced: true });
          status(t('Applied. Reloading…'));
          reloadSoon();
        } else if (await replaceSyncedCopy(cfg.conflict?.updatedAt)) {
          await rerender();
        }
      } catch (err) {
        failed(err, t('Sync failed - try again'));
      }
    });
  });

  body.querySelector('[data-sync-restore]')?.addEventListener('click', async () => {
    const list = body.querySelector<HTMLElement>('[data-sync-restore-list]');
    if (!list) return;
    const provider = await saveFields();
    if (!provider) { status(t('Pick a provider first.')); return; }
    busy(true); status(t('Checking…'));
    try {
      const points = await listRestorePoints();
      busy(false); status('');
      list.hidden = false;
      if (!points.length) {
        list.innerHTML = `<p class="pconn-note">${t('No earlier copies yet. Lolly keeps one copy a day for a week, and one from before each apply.')}</p>`;
        return;
      }
      list.innerHTML = `<ul class="pconn-restore">${points.map((p) => `
        <li class="pconn-actions">
          <span><strong>${escape(slotLabel(p.slot))}</strong> · ${escape(whenText(p.meta.updatedAt))} · ${escape(sizeText(p.meta.size))}</span>
          <button type="button" class="btn" data-sync-restore-slot="${escape(p.slot)}">${t('Restore')}</button>
        </li>`).join('')}</ul>
        <p class="pconn-note">${t('Lolly keeps one copy a day for a week, and one from before your last apply. Your storage provider’s own version history may keep more.')}</p>`;
      list.querySelectorAll<HTMLButtonElement>('[data-sync-restore-slot]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const slot = btn.dataset.syncRestoreSlot as SyncSlot;
          const point = points.find((p) => p.slot === slot);
          const ok = await confirmDialog({
            title: t('Restore this copy?'),
            message: isTauriShell() ? tRaw('This device is changed to match the copy from {when}, including removing items that copy does not have. That copy then becomes the synced copy for your other devices. This device is saved first as “Before your last apply”.', { when: whenText(point?.meta.updatedAt) }) : tRaw('This browser is changed to match the copy from {when}, including removing items that copy does not have. That copy then becomes the synced copy for your other devices. This browser’s data is saved first as “Before your last apply”.', { when: whenText(point?.meta.updatedAt) }),
            confirmLabel: t('Restore and reload'),
            danger: true,
          });
          if (!ok) return;
          busy(true); status(t('Applying…'));
          try {
            await restoreFrom(depsOf(host), slot);
            status(t('Applied. Reloading…'));
            reloadSoon();
          } catch (err) {
            failed(err, t('Sync failed - try again'));
          }
        });
      });
    } catch (err) {
      failed(err, t('Couldn’t check - try again'));
    }
  });
}
