// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { fileBatchReportV1 } from '@lolly-tools/core/file-operation-v1';
import { batchOutputReference, portableFileBatch, type LocalFileBatch } from '../lib/file-batch-store.ts';
import type { FileOperationStore } from '../lib/file-operation-store.ts';
import { runSavedFileOperation } from '../lib/saved-file-operation.ts';
import { describeFile, runWebFileOperation } from '../lib/file-operation-adapter.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';

export function renderFileBatchHistory(root: HTMLElement, batches: LocalFileBatch[], store: FileOperationStore, host: HostV1, refresh: () => Promise<void>): void {
  root.hidden = !batches.length;
  root.innerHTML = `<h3>${t('Batches - every selected file')}</h3><p class="convert-retention">${t('Includes cancelled files and files that never started. Retrying creates a new batch; the original report is kept.')}</p><div data-batch-list></div><p role="status" data-batch-status></p>`;
  const list = root.querySelector<HTMLElement>('[data-batch-list]')!;
  const status = root.querySelector<HTMLElement>('[data-batch-status]')!;
  const announce = (error: unknown): void => { status.textContent = error instanceof Error ? error.message : String(error); };
  for (const batch of batches) {
    const complete = batch.members.every(m => m.report);
    const report = complete ? fileBatchReportV1(batch.members.map(m => m.report!)) : null;
    const count = (state: string): number => batch.members.filter(m => m.report?.state === state).length;
    const details = document.createElement('details'); details.className = 'convert-batch'; details.dataset.batchId = batch.id;
    details.innerHTML = `<summary>${escapeHtml(batch.members[0]!.source.facts.name)}${batch.members.length > 1 ? ` + ${batch.members.length - 1}` : ''} · ${escapeHtml(batch.request.target.toUpperCase())}<span>${count('succeeded')} ${t('ready')} · ${count('failed')} ${t('failed')} · ${count('cancelled')} ${t('cancelled')}${!complete ? ` · ${t('In progress')}` : ''}</span></summary><p class="convert-retention">${escapeHtml(new Date(batch.createdAt).toLocaleString())}</p><div class="convert-actions">${complete ? `<button class="btn" data-batch-saved-report>${t('Download batch report')}</button><button class="btn" data-batch-manifest>${t('Download manifest')}</button><button class="btn" data-batch-remove>${t('Remove batch record')}</button>` : `<button class="btn" data-batch-refresh>${t('Refresh status')}</button>`}</div><div data-batch-members></div>`;
    details.querySelector('[data-batch-refresh]')?.addEventListener('click', () => { void refresh().catch(announce); });
    const download = (value: unknown, suffix: string): void => { void host.export.download(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), `batch-${batch.id}.${suffix}.json`).catch(announce); };
    details.querySelector('[data-batch-saved-report]')?.addEventListener('click', () => download(report, 'report'));
    details.querySelector('[data-batch-manifest]')?.addEventListener('click', () => download({ ...portableFileBatch(batch), sourceBytesRetained: false, outputs: batch.members.map(batchOutputReference).filter(Boolean) }, 'manifest'));
    details.querySelector('[data-batch-remove]')?.addEventListener('click', async () => {
      if (!await confirmDialog({ title: t('Remove this batch record?'), message: t('This removes the batch manifest and its member reports. Individual saved results, library assets, originals and downloaded files are kept.'), confirmLabel: t('Remove batch record') })) return;
      try { await store.batches.remove(batch.id); await refresh(); } catch (error) { announce(error); }
    });
    for (const member of batch.members) {
      const result = member.report;
      const interrupted = result?.findings.some(f => f.code === 'operation-interrupted');
      const state = interrupted ? t('Interrupted - choose the original to retry') : result?.state === 'succeeded' ? t('Copy completed') : result?.state === 'failed' ? t('Failed') : result?.state === 'cancelled' ? t('Cancelled') : t('Queued or running');
      const row = document.createElement('article'); row.className = 'convert-history-row'; row.dataset.batchMember = member.operationId;
      row.innerHTML = `<div><h4>${escapeHtml(member.source.facts.name)}</h4><p>${state}</p>${result?.findings.map(f => `<p class="${f.severity === 'error' ? 'convert-error' : 'convert-retention'}">${escapeHtml(f.message)}</p>`).join('') ?? ''}${result?.state === 'succeeded' ? `<p class="convert-retention">${t('The batch keeps the receipt. Download availability depends on keeping the individual saved result.')}</p>` : ''}</div><div class="convert-actions">${result?.state === 'succeeded' ? `<button class="btn" data-batch-result>${t('Download copy')}</button>` : ''}${result ? `<button class="btn" data-batch-retry>${t('Retry with original…')}</button><input type="file" hidden data-batch-retry-file>` : ''}</div>`;
      row.querySelector('[data-batch-result]')?.addEventListener('click', async () => {
        try { const file = await store.getOutput(member.operationId); if (!file) throw new Error(t('This saved copy is no longer on this device. The receipt was kept. Retry with the original file.')); await host.export.download(file, file.name); } catch (error) { announce(error); }
      });
      const input = row.querySelector<HTMLInputElement>('[data-batch-retry-file]');
      const retry = row.querySelector<HTMLButtonElement>('[data-batch-retry]');
      retry?.addEventListener('click', () => input?.click());
      input?.addEventListener('change', async () => {
        const file = input.files?.[0]; input.value = ''; if (!file || !retry) return;
        retry.disabled = true;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        try {
          const facts = await describeFile(file);
          if (member.source.facts.sha256 && facts.sha256 !== member.source.facts.sha256) throw new Error(t('That is not the original file. Its SHA-256 differs; start a new operation instead.'));
          if (!member.source.facts.sha256 && !await confirmDialog({ title: t('Use this file for the retry?'), message: t('The previous operation never recorded a source hash, so Lolly cannot verify that this is the exact original. The old report will be kept and this file will start a new batch.'), confirmLabel: t('Start new batch') })) return;
          const next = await store.batches.create([{ file, outputName: member.outputName }], batch.request);
          heartbeat = setInterval(() => { void store.batches.heartbeat(next.id).catch(() => {}); }, 30_000);
          const link = { batchId: next.id, operationId: next.members[0]!.operationId };
          status.textContent = t('Retrying…');
          const outcome = await runSavedFileOperation(file, batch.request, { store: async () => store, describe: async () => facts, execute: runWebFileOperation }, undefined, member.outputName, link);
          await store.batches.complete(link, outcome.report); await refresh();
        } catch (error) { announce(error); }
        finally { if (heartbeat) clearInterval(heartbeat); retry.disabled = false; }
      });
      details.querySelector('[data-batch-members]')!.append(row);
    }
    list.append(details);
  }
}
