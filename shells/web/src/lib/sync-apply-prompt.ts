// SPDX-License-Identifier: MPL-2.0
import { confirmDialog } from '../components/confirm-dialog.ts';
import { t } from '../i18n.ts';
import { isTauriShell } from './instance-choice.ts';
import { navigateTo } from '../nav.ts';
import { showUndoToast } from './undo-toast.ts';

/** Keep conflict UI available without placing it on the startup path. */
export function showSyncConflictNotice(): void {
  showUndoToast({
    message: t('Your synced data changed on another device.'),
    actionLabel: t('Choose what to keep'),
    undo: () => { navigateTo('#/profile?focus=connections-section'); },
    duration: 15_000,
  });
}

/** Load the restore prompt only after sync finds a newer remote copy. */
export async function promptSyncApply(apply: () => Promise<unknown>): Promise<void> {
  const ok = await confirmDialog({
    title: t('Apply the newer version from your sync home?'),
    message: isTauriShell()
      ? t('Another device synced newer changes. Applying them updates this device to match, including items deleted there. A copy of this device is saved first, so you can undo this in Sync settings.')
      : t('Another device synced newer changes. Applying them updates this browser to match, including items deleted there. A copy of this browser’s data is saved first, so you can undo this in Sync settings.'),
    confirmLabel: t('Apply and reload'),
    danger: false,
  });
  if (!ok) return;
  try {
    await apply();
    if (typeof location !== 'undefined') location.reload();
  } catch {
    // An encrypted copy may need its passphrase in Connected services.
    navigateTo('#/profile?focus=connections-section');
  }
}
