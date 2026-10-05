// SPDX-License-Identifier: MPL-2.0
/** A file chooser inside the picker, using thumbnails until a file is selected. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { mountAssetFileList } from './asset-file-list.ts';
import { tRaw } from '../i18n.ts';

export function mountAssetFilePicker(card: HTMLElement, ref: AssetRef, o: {
  back(): void; current(): boolean; accepts(ref: AssetRef): boolean;
  resolve(ref: AssetRef): Promise<AssetRef>; picked(ref: AssetRef): Promise<boolean>;
}): void {
  const back = document.createElement('button'); back.type = 'button'; back.className = 'btn btn--sm'; back.textContent = tRaw('Back to assets');
  back.addEventListener('click', o.back);
  const heading = document.createElement('h2'); heading.textContent = String(ref.meta?.assetGroupName ?? ref.meta?.name ?? ref.id);
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  card.append(back, heading, status); let busy = false;
  mountAssetFileList(card, ref, async selected => {
    if (busy) return; busy = true; status.textContent = tRaw('Loading selected file…');
    card.setAttribute('aria-busy', 'true');
    try {
      const resolved = await o.resolve(selected);
      if (!card.isConnected || !o.current()) return;
      if (await o.picked(resolved)) status.textContent = tRaw('File added.');
    } catch { if (card.isConnected && o.current()) status.textContent = tRaw('Could not load this file. Try again or choose another variation.'); }
    finally { busy = false; card.removeAttribute('aria-busy'); }
  }, o.accepts); back.focus();
}
