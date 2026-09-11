// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { menuItemHtml } from '../lib/context-menu.ts';
import { icon } from '../lib/icons.ts';
import { openAssetInText, textAssetSupported } from '../lib/text-handoff.ts';

/** Removing a project reference keeps the original asset in the Catalog. */
export function projectAssetMenu(ref: AssetRef | undefined, favourite: string, clipboard: string): string {
  return [
    menuItemHtml('open-image', icon('externalLink', { strokeWidth: 1.9 }), t('Preview')),
    ref && textAssetSupported(ref) ? menuItemHtml('open-text', icon('pen', { strokeWidth: 1.9 }), t('Open in Text')) : '',
    favourite,
    menuItemHtml('move-image', icon('move', { strokeWidth: 1.9 }), t('Move to…')),
    clipboard,
    menuItemHtml('delete-image', icon('trash', { strokeWidth: 1.9 }), t('Remove from project'), { danger: true }),
  ].join('');
}

export async function handleProjectTextAction(
  action: string, host: HostV1, asset: AssetRef | undefined, folderId: string | null,
): Promise<boolean> {
  if (action !== 'open-text') return false;
  if (asset) {
    try { await openAssetInText(host, asset, folderId ?? undefined); }
    catch (error) { announce(error instanceof Error ? error.message : t('This text could not be read.')); }
  }
  return true;
}
