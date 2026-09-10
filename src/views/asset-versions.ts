// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { mountModal } from '../components/modal.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { escape as escapeHtml } from '../utils.ts';
import { fmtBytes } from '../lib/format.ts';
import { t } from '../i18n.ts';
import { safeFileName } from '@lolly-tools/core/file-v1';
import '../styles/parts/convert.css';
import { openDB } from '../bridge/db.ts';
import { allUserAssetVersions } from '../bridge/asset-history.ts';
import { assetComparisonMode } from '../lib/compare-asset-sources.ts';
import { openAssetComparison } from '../components/compare-assets.ts';
interface AssetVersionActions {
  _listUserAssetVersions(id: string): Promise<Array<{ version: string; savedAt: number; sha256: string; bytes: number; name: string; format: string }>>;
  _getBlob(id: string, options: { version: string }): Promise<Blob | null>;
  _restoreUserAssetVersion(id: string, version: string): Promise<void>;
  _removeUserAssetVersion(id: string, version: string): Promise<void>;
}
export async function openAssetVersions(id: string, host: HostV1, onChanged: () => Promise<void>): Promise<void> {
  const assets = host.assets as HostV1['assets'] & AssetVersionActions;
  const modal = mountModal(`<h2>${t('Saved asset versions')}</h2><p>${t('Replacing an upload keeps its previous bytes here. Restore makes a new current version; the selected snapshot stays unchanged. Saved versions are included when you export your data backup.')}</p><div data-versions></div><p role="status" data-version-status></p><button class="btn" data-close>${t('Close')}</button>`, { className: 'modal asset-versions-dialog', ariaLabel: t('Saved asset versions') });
  modal.el.querySelector('[data-close]')!.addEventListener('click', () => modal.close());
  const status = modal.el.querySelector<HTMLElement>('[data-version-status]')!;
  const render = async (): Promise<void> => {
    const versions = await assets._listUserAssetVersions(id);
    if (!modal.el.isConnected) return;
    modal.el.querySelector('[data-versions]')!.innerHTML = versions.length ? versions.map((v, i) => `<article class="convert-history-row"><h3>${escapeHtml(v.name)}</h3><p>${escapeHtml(new Date(v.savedAt).toLocaleString())} · ${fmtBytes(v.bytes)}</p><code style="overflow-wrap:anywhere">${escapeHtml(v.sha256)}</code><div class="convert-actions">${host.compare && assetComparisonMode([v, v]) ? `<button class="btn" data-compare-version="${i}">${t('Compare with current')}</button>` : ''}<button class="btn" data-download-version="${i}">${t('Download')}</button><button class="btn" data-restore-version="${i}">${t('Restore as current')}</button><button class="btn" data-remove-version="${i}">${t('Remove saved version')}</button></div></article>`).join('') : `<p>${t('Previous versions appear here after you replace this asset. Your current copy is unchanged.')}</p>`;
    modal.el.querySelectorAll<HTMLButtonElement>('[data-compare-version], [data-download-version], [data-restore-version], [data-remove-version]').forEach(button => { button.addEventListener('click', async () => {
      const index = Number(button.dataset.compareVersion ?? button.dataset.downloadVersion ?? button.dataset.restoreVersion ?? button.dataset.removeVersion);
      const version = versions[index]!;
      button.disabled = true;
      try {
        if (button.dataset.compareVersion !== undefined) {
          openAssetComparison(host, [{ id, version: version.version, format: version.format, label: version.name }, { id }]);
        } else if (button.dataset.downloadVersion !== undefined) {
          const blob = await assets._getBlob(id, { version: version.version });
          if (!blob) throw new Error(t('Saved version not found.'));
          await host.export.download(blob, safeFileName(version.name.includes('.') ? version.name : `${version.name}.${version.format}`));
        } else if (button.dataset.restoreVersion !== undefined) {
          if (!await confirmDialog({ title: t('Restore this version?'), message: t('The current bytes will also be saved as a version. Designs using the current asset will see the restored copy.'), confirmLabel: t('Restore as current'), danger: false })) return;
          await assets._restoreUserAssetVersion(id, version.version); await onChanged(); await render(); status.textContent = t('Version restored. The previous current copy is saved too.');
        } else {
          if (!await confirmDialog({ title: t('Remove this saved version?'), message: t('Versions used by saved creations or retained history are protected. Download a copy before removing an unused version; removal cannot be undone.'), confirmLabel: t('Remove saved version') })) return;
          await assets._removeUserAssetVersion(id, version.version); await onChanged(); await render();
        }
      } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
      finally { button.disabled = false; }
    }); });
  };
  try { await render(); } catch (error) { status.textContent = String(error); }
}

/** A recoverable snapshot stays discoverable even after its library head is deleted. */
export async function openAssetHistoryLibrary(host: HostV1, onChanged: () => Promise<void>): Promise<void> {
  const modal = mountModal(`<h2>${t('Saved asset versions')}</h2><p>${t('Review earlier copies, recover a deleted asset, or free space after downloading a backup. Versions are never removed automatically.')}</p><label class="convert-field">${t('Find an asset')}<input type="search" data-version-search></label><div data-version-library></div><p role="status" data-library-status></p><button class="btn" data-close>${t('Close')}</button>`, { className: 'modal asset-versions-dialog', ariaLabel: t('Saved asset versions') });
  modal.el.querySelector('[data-close]')!.addEventListener('click', () => modal.close());
  const status = modal.el.querySelector<HTMLElement>('[data-library-status]')!;
  const render = async (): Promise<void> => {
    const db = await openDB();
    const versions = await allUserAssetVersions(db);
    const current = new Set(await db.getAllKeys('user-assets'));
    const groups = new Map<string, { name: string; count: number; bytes: number }>();
    for (const v of versions.sort((a, b) => b.savedAt - a.savedAt)) {
      const group = groups.get(v.assetId) ?? { name: String(v.record.meta?.name || v.assetId), count: 0, bytes: 0 };
      group.count++; group.bytes += v.bytes; groups.set(v.assetId, group);
    }
    const input = modal.el.querySelector<HTMLInputElement>('[data-version-search]')!;
    const show = (): void => {
      const query = input.value.normalize('NFKC').toLowerCase();
      const items = [...groups].filter(([id, g]) => `${id} ${g.name}`.normalize('NFKC').toLowerCase().includes(query));
      modal.el.querySelector('[data-version-library]')!.innerHTML = items.map(([id, g], i) => `<article class="convert-history-row"><h3>${escapeHtml(g.name)}</h3><p>${g.count} ${t('saved versions')} · ${fmtBytes(g.bytes)}${current.has(id) ? '' : ` · ${t('Current asset deleted - earlier copies recoverable')}`}</p><div class="convert-actions"><button class="btn" data-open-asset-history="${i}">${t('Review versions…')}</button></div></article>`).join('') || `<p>${t('No matching saved versions.')}</p>`;
      modal.el.querySelectorAll<HTMLButtonElement>('[data-open-asset-history]').forEach(button => { button.addEventListener('click', () => {
        void openAssetVersions(items[Number(button.dataset.openAssetHistory)]![0], host, async () => { await onChanged(); await render(); }).catch(error => { status.textContent = String(error); });
      }); });
    };
    input.oninput = show; show();
  };
  try { await render(); } catch (error) { status.textContent = String(error); }
}
