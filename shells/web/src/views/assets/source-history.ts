// SPDX-License-Identifier: MPL-2.0
/** Exact held reads and known device uses, separate from live source facts. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { catalogSourceHistory } from '../../bridge/catalog-history.ts';
import { sharedAssetId } from '../../catalog/curation.ts';
import { readCatalogJson } from '../../catalog/asset-record.ts';
import { getInstanceBase, instanceFetch, instancePath } from '../../lib/instance.ts';
import { t } from '../../i18n.ts';
import './source-history.css';
type LocalHistory = Awaited<ReturnType<typeof catalogSourceHistory>>;
export function mountSourceHistory(root: HTMLElement, ref: AssetRef, assets: { _sourceHistory?(id: string): Promise<LocalHistory> }): void {
  const document = root.ownerDocument, section = document.createElement('details'), summary = document.createElement('summary'), content = document.createElement('div');
  content.className = 'cat-inspector-section-body';
  section.className = 'cat-source-history';
  summary.textContent = t('Source history'); section.dataset.sourceHistory = ''; section.append(summary, content); root.append(section);
  const origin = getInstanceBase(), controller = new AbortController(); let loaded = false;
  root.closest('dialog')?.addEventListener('close', () => controller.abort(), { once: true });
  const alive = () => root.isConnected && !controller.signal.aborted && origin === getInstanceBase();
  const p = (text: string) => { const node = document.createElement('p'); node.textContent = text; content.append(node); return node; };
  section.addEventListener('toggle', () => {
    if (!section.open || loaded) return; loaded = true;
    const status = p(t('Loading source history…')); status.setAttribute('role', 'status');
    void (async () => {
      const id = sharedAssetId(ref) ?? ref.id;
      try {
        const local = await assets._sourceHistory?.(id); if (!alive()) return;
        status.textContent = t('Held reads on this device');
        if (!local?.observations.length) p(t('No retained source observations on this device.'));
        for (const observation of local?.observations ?? []) {
          p(`${observation.format} · ${observation.representation} · ${observation.observedAt}`);
          p(`SHA-256 ${observation.sha256}`);
          if (observation.sourceOrigin) p(t('Source: {origin}', { origin: observation.sourceOrigin }));
          if (observation.sourceVersion) p(t('Observed source version: {version}', { version: observation.sourceVersion }));
        }
        const documents = new Set(local?.revisions.map(row => row.documentId));
        p(t('Known saved creations on this device: {count}', { count: documents.size }));
        if (local?.truncated) p(t('Only part of the retained history was checked.'));
        for (const report of local?.reports ?? []) p(`${report.operation} · ${report.relation} · ${report.origin === 'observed-here' ? t('Observed on this device') : report.origin === 'imported' ? t('Imported report') : t('Origin not recorded')}`);
        if (local?.reports.length) p(t('Reports describe recorded operations. Imported reports can have incomplete execution or recipe information.'));
        p(t('Only recorded use on this device is shown. Attributes come from the device index at the recorded read; current access, processing and delivery permission are checked separately.'));
        if (!id.startsWith('inst/')) return;
        const response = await instanceFetch(instancePath(`/api/v1/catalog/assets/${id}/versions`), { cache: 'no-store', signal: controller.signal });
        const remote = await readCatalogJson(response) as { head: number; versions?: Array<{ version: number; formats: Array<{ format: string; checksum: string }> }>; sourceReviews?: Array<{ state: string; sourceReview: { purpose: string; target: string; files: Array<{ version: number; format: string; sha256: string }> } }> };
        if (!alive()) return;
        p(t('Current instance file versions: {count}', { count: remote.versions?.length ?? 0 }));
        p(t('Historical source attributes are not recorded by the instance.'));
        p(t('Reviews apply only to their listed file versions, purpose and target.'));
        for (const review of remote.sourceReviews ?? []) {
          p(`${review.sourceReview.purpose} · ${review.sourceReview.target} · ${review.state}`);
          for (const file of review.sourceReview.files) p(`${t('Version')} ${file.version} · ${file.format} · SHA-256 ${file.sha256}`);
        }
        const request = document.createElement('button'); request.type = 'button'; request.className = 'btn'; request.textContent = t('Request source review'); content.append(request);
        request.addEventListener('click', () => {
          request.disabled = true;
          void (async () => {
            try {
              const chains = await readCatalogJson(await instanceFetch(instancePath('/api/v1/chains'), { signal: controller.signal })) as { chains: Array<{ id: string; name: string }> };
              if (!alive()) return;
              const form = document.createElement('form');
              const purpose = document.createElement('input'), target = document.createElement('input'), chain = document.createElement('select'), file = document.createElement('select');
              const label = (name: string, control: HTMLElement) => { const wrapper = document.createElement('label'); wrapper.textContent = t(name); control.className = 'field-input'; wrapper.append(control); form.append(wrapper); };
              purpose.required = target.required = true; purpose.maxLength = 200; target.maxLength = 300;
              label('Review purpose', purpose); label('Activation target', target); label('Approval chain', chain); label('File version', file);
              for (const value of chains.chains ?? []) { const option = document.createElement('option'); option.value = value.id; option.textContent = value.name; chain.append(option); }
              const choices: Array<{ assetId: string; version: number; format: string; sha256: string; representation: 'original' }> = [];
              for (const version of remote.versions ?? []) for (const format of version.formats) if (/^[a-f0-9]{64}$/.test(format.checksum)) {
                const option = document.createElement('option'); option.value = String(choices.length); option.textContent = `${t('Version')} ${version.version} · ${format.format}`;
                option.selected = version.version === remote.head; file.append(option);
                choices.push({ assetId: id, version: version.version, format: format.format, sha256: format.checksum, representation: 'original' });
              }
              const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'btn'; submit.textContent = t('Request review'); submit.disabled = !choices.length || !chain.options.length;
              const result = document.createElement('p'); result.setAttribute('role', 'status'); form.append(submit, result); content.append(form);
              form.addEventListener('submit', event => {
                event.preventDefault(); if (!alive() || submit.disabled || !form.reportValidity()) return;
                submit.disabled = true;
                void (async () => {
                  try {
                    const response = await instanceFetch(instancePath('/api/v1/approvals'), { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ subjectType: 'source-review', title: purpose.value, chainId: chain.value,
                        sourceReview: { purpose: purpose.value, target: target.value, files: [choices[Number(file.value)]] } }) });
                    await readCatalogJson(response); if (alive()) { result.textContent = t('Source review requested. Approval applies only to this file version, purpose and target.'); form.querySelectorAll('input, select').forEach(control => { (control as HTMLInputElement).disabled = true; }); }
                  } catch { if (alive()) { result.textContent = t('Source review could not be requested. Refresh the source and check access before retrying.'); submit.disabled = false; } }
                })();
              });
            } catch { if (alive()) { p(t('Approval chains are unavailable.')); request.disabled = false; } }
          })();
        });
      } catch { if (alive()) p(t('Shared history is unavailable. Held observations remain local evidence.')); }
    })();
  });
}
