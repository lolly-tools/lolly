// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { localFileOperations, type LocalFileOperation } from '../lib/file-operation-store.ts';
import { describeFile, runWebFileOperation } from '../lib/file-operation-adapter.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { escape as escapeHtml } from '../utils.ts';
import { fmtBytes } from '../lib/format.ts';
import { t } from '../i18n.ts';
import { runSavedFileOperation } from '../lib/saved-file-operation.ts';
import { measureFileHistory } from '../lib/file-history-storage.ts';
import { renderFileBatchHistory } from './file-batch-history.ts';
import { attachFileResultActions } from './file-result-actions.ts';

const stateLabel = (state: LocalFileOperation['state']): string => ({
  running: t('Running'), succeeded: t('Ready to download'), failed: t('Failed'), cancelled: t('Cancelled'), interrupted: t('Interrupted - choose the original to retry'),
})[state];

export async function renderFileOperationHistory(root: HTMLElement, host: HostV1): Promise<void> {
  try {
    const store = await localFileOperations();
    const records = await store.list();
    const usage = await measureFileHistory();
    const batches = await store.batches.list();
    if (!root.isConnected) return;
    root.innerHTML = `<header class="convert-completed-heading"><div><p class="convert-eyebrow">${t('On this device')}</p><h2>${t('Recent file operations')}</h2></div></header><p class="convert-retention">${t('Completed copies survive reloads. Originals are not saved here. Download important files: clearing browser data also clears this history.')}</p><details class="convert-history-storage" data-history-storage><summary>${t('Storage, backups & saved versions')} · ${fmtBytes(usage.bytes)}</summary><p data-file-storage>${fmtBytes(usage.resultBytes)} / ${fmtBytes(usage.resultLimit)} ${t('saved results')} · ${usage.results}/100 ${t('records')}<br>${fmtBytes(usage.versionBytes)} / ${fmtBytes(usage.versionLimit)} ${t('asset versions')}<br>${usage.batches}/100 ${t('batch manifests')} · ${fmtBytes(usage.batchBytes)}${usage.reservedBytes ? ` · ${fmtBytes(usage.reservedBytes)} ${t('reserved for active work')}` : ''}</p><div class="convert-actions"><a class="btn" href="#/profile?focus=storage-section">${t('Back up or restore data…')}</a><button class="btn" data-all-versions>${t('Manage asset versions…')}</button><button class="btn" data-clean-abandoned>${t('Clean abandoned temporary files')}</button></div><p class="convert-retention">${t('Your data backup includes saved versions, reports and completed copies. Originals selected for conversion are not included.')}</p></details><section data-batch-history></section><label class="convert-field">${t('Find a file')}<input type="search" data-history-search placeholder="${t('Name, format or operation')}"></label><div data-history-rows></div><p role="status" data-history-status></p>`;
    const rows = root.querySelector<HTMLElement>('[data-history-rows]')!;
    const status = root.querySelector<HTMLElement>('[data-history-status]')!;
    renderFileBatchHistory(root.querySelector<HTMLElement>('[data-batch-history]')!, batches, store, host, () => renderFileOperationHistory(root, host));
    root.querySelector('[data-all-versions]')!.addEventListener('click', () => {
      void import('./asset-versions.ts').then(m => m.openAssetHistoryLibrary(host, async () => { await renderFileOperationHistory(root, host); })).catch(error => { status.textContent = String(error); });
    });
    root.querySelector('[data-clean-abandoned]')!.addEventListener('click', async () => {
      if (!await confirmDialog({ title: t('Clean abandoned temporary files?'), message: t('Only unreferenced operation files are removed. Saved results, reports, asset versions and active work are kept. This cleanup cannot be undone.'), confirmLabel: t('Clean temporary files') })) return;
      try { const removed = await store.reclaimAbandonedBytes(); status.textContent = `${removed.files} ${t('abandoned files removed')} · ${fmtBytes(removed.bytes)}. ${t('Saved results and versions were kept.')}`; }
      catch (error) { status.textContent = String(error); }
    });
    const renderRows = (items: LocalFileOperation[]): void => {
      rows.innerHTML = items.length ? items.map(record => `<article class="convert-history-row" data-operation="${escapeHtml(record.id)}"><div><h3>${escapeHtml(record.outputName || record.input.name)}</h3><p>${escapeHtml(stateLabel(record.state))} · ${escapeHtml(record.request.target.toUpperCase())} · ${fmtBytes(record.storedBytes)} · ${escapeHtml(new Date(record.createdAt).toLocaleString())}</p>${record.report?.findings.filter(f => f.severity === 'error').map(f => `<p class="convert-error">${escapeHtml(f.message)}</p>`).join('') ?? ''}</div><div class="convert-actions">${record.state === 'succeeded' ? `<button class="btn" data-history-download>${t('Download')}</button>` : ''}${record.report ? `<button class="btn" data-history-report>${t('Report')}</button>` : ''}${record.state !== 'running' ? `<button class="btn" data-history-retry>${t('Retry with original…')}</button><input type="file" hidden data-retry-file><button class="btn" data-history-remove>${t('Remove local result')}</button>` : ''}</div></article>`).join('') : `<p>${t('No matching operations yet.')}</p>`;
      rows.querySelectorAll<HTMLElement>('[data-operation]').forEach(row => {
        const record = records.find(record => record.id === row.dataset.operation)!;
        if (record.state === 'succeeded' && record.report?.outputs[0]) attachFileResultActions(row, record.id, record.report.outputs[0], host, message => { status.textContent = message; });
        row.querySelector('[data-history-download]')?.addEventListener('click', async () => {
          try { const file = await store.getOutput(record.id); if (!file) throw new Error(t('The result bytes are missing. Retry with the original file.')); await host.export.download(file, file.name); }
          catch (error) { status.textContent = String(error); }
        });
        row.querySelector('[data-history-report]')?.addEventListener('click', () => {
          void host.export.download(new Blob([JSON.stringify(record.report, null, 2)], { type: 'application/json' }), `${record.outputName || record.input.name}.report.json`).catch(error => { status.textContent = String(error); });
        });
        row.querySelector('[data-history-remove]')?.addEventListener('click', async () => {
          if (!await confirmDialog({ title: t('Remove this local result?'), message: t('This removes the saved copy and its report from this device. Your original and downloaded files are untouched.'), confirmLabel: t('Remove local result') })) return;
          try { await store.remove(record.id); await renderFileOperationHistory(root, host); } catch (error) { status.textContent = String(error); }
        });
        const input = row.querySelector<HTMLInputElement>('[data-retry-file]');
        row.querySelector('[data-history-retry]')?.addEventListener('click', () => input?.click());
        input?.addEventListener('change', async () => {
          const file = input.files?.[0]; if (!file) return;
          try {
            const facts = await describeFile(file);
            if (record.input.sha256 && facts.sha256 !== record.input.sha256) throw new Error(t('That is not the original file. Its SHA-256 differs; start a new operation instead.'));
            status.textContent = t('Retrying…');
            await runSavedFileOperation(file, record.request, { store: async () => store, describe: async () => facts, execute: runWebFileOperation });
            await renderFileOperationHistory(root, host);
          } catch (error) { status.textContent = String(error); }
        });
      });
    };
    renderRows(records);
    root.querySelector<HTMLInputElement>('[data-history-search]')!.addEventListener('input', event => {
      const query = (event.target as HTMLInputElement).value.normalize('NFKC').toLowerCase();
      renderRows(records.filter(record => `${record.input.name} ${record.outputName ?? ''} ${record.request.target} ${record.request.operation}`.normalize('NFKC').toLowerCase().includes(query)));
    });
  } catch (error) { root.textContent = `${t('Local history is unavailable:')} ${error instanceof Error ? error.message : String(error)}`; }
}
