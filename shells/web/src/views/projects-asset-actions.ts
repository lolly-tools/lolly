// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { menuItemHtml } from '../lib/context-menu.ts';
import { icon } from '../lib/icons.ts';
import { showUndoToast } from '../lib/undo-toast.ts';
import { tRaw } from '../i18n.ts';
import type { createFolderStore } from '../folders.ts';
import { openAssetInText, textAssetSupported } from '../lib/text-handoff.ts';

/** Removing a project reference keeps the original asset in the Catalog. */
export function projectAssetMenu(ref: AssetRef | undefined, favourite: string, clipboard: string): string {
  return [
    menuItemHtml('open-image', icon('externalLink', { strokeWidth: 1.9 }), t('Preview')),
    ref && textAssetSupported(ref) ? menuItemHtml('open-text', icon('pen', { strokeWidth: 1.9 }), t('Open in Text')) : '',
    ref && textAssetSupported(ref) ? menuItemHtml('open-write', icon('pen', { strokeWidth: 1.9 }), t('Open in Write')) : '',
    favourite,
    menuItemHtml('move-image', icon('move', { strokeWidth: 1.9 }), t('Move to…')),
    clipboard,
    menuItemHtml('delete-image', icon('trash', { strokeWidth: 1.9 }), t('Remove from project'), { danger: true }),
  ].join('');
}

export async function handleProjectTextAction(
  action: string, host: HostV1, asset: AssetRef | undefined, folderId: string | null,
): Promise<boolean> {
  if (action !== 'open-text' && action !== 'open-write') return false;
  if (asset) {
    try { await openAssetInText(host, asset, folderId ?? undefined, action === 'open-write' ? 'write' : 'text-helper'); }
    catch (error) { announce(error instanceof Error ? error.message : t('This text could not be read.')); }
  }
  return true;
}

/** Removing a reference offers Undo and preserves the underlying file. */
export async function removeProjectAsset(store: Pick<ReturnType<typeof createFolderStore>, 'removeItem' | 'addItem'>, folderId: string, ref: string, name: string, current: () => boolean, refresh: () => Promise<void>): Promise<void> {
  await store.removeItem(folderId, ref);
  if (!current()) return;
  await refresh();
  announce(t('Removed from project'));
  showUndoToast({
    message: tRaw('Removed "{name}" from the project. It is still in Assets.', { name }),
    undo: async () => {
      await store.addItem(folderId, { type: 'image', ref });
      if (current()) await refresh();
    },
  });
}
