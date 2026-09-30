// SPDX-License-Identifier: MPL-2.0
import '../styles/parts/valid-production.css';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { inspectBrowserProduction } from '../bridge/production.ts';
import { parseProductionSpec, productionProblems, acceptProduction, productionDigest } from '../../../../engine/src/production.ts';
/** A local, explicit requirements check alongside Verify's existing reports. */
export function wireProductionVerify(view: HTMLElement, files: () => File[], host: HostV1): () => void {
  const panel = document.createElement('details'); panel.className = 'valid-production';
  const summary = document.createElement('summary'); summary.textContent = 'Production checks'; panel.append(summary);
  const intro = document.createElement('p'); intro.textContent = 'Check a file against supplied requirements. Reports describe measurements; approval remains a separate decision.'; panel.append(intro);
  const field = (label: string, accept: string): HTMLInputElement => {
    const wrapper = document.createElement('label'); wrapper.textContent = label; wrapper.className = 'field-label';
    const input = document.createElement('input'); input.type = 'file'; input.hidden = true; input.accept = accept;
    const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'btn'; pick.textContent = 'Choose file'; pick.addEventListener('click', () => input.click());
    const filename = document.createElement('span'); filename.className = 'valid-production-filename'; filename.textContent = 'No file chosen'; input.addEventListener('change', () => { filename.textContent = input.files?.[0]?.name ?? 'No file chosen'; });
    wrapper.append(input, pick, filename); panel.append(wrapper); return input;
  };
  const requirements = field('Requirements JSON', '.json,application/json'), reference = field('Reference file, if required', '.png,.jpg,.jpeg,.svg,.pdf,.mp4,.webm');
  const select = document.createElement('select'); select.className = 'field-select'; select.setAttribute('aria-label', 'File to check'); panel.append(select);
  const run = document.createElement('button'); run.type = 'button'; run.className = 'btn'; run.textContent = 'Check requirements'; panel.append(run);
  const result = document.createElement('div'); result.setAttribute('aria-live', 'polite'); panel.append(result);
  let controller: AbortController | undefined;
  const reset = (): void => { controller?.abort(); controller = undefined; result.replaceChildren(); run.disabled = false; };
  const refresh = (): void => {
    const prior = select.value; select.replaceChildren();
    files().forEach((file, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = file.name; select.append(option); });
    if (prior !== '' && Number(prior) < files().length) select.value = prior;
  };
  panel.addEventListener('toggle', refresh); select.addEventListener('focus', refresh);
  for (const el of [requirements, reference, select]) el.addEventListener('change', reset);
  run.addEventListener('click', async () => {
    reset(); const file = files()[Number(select.value)], req = requirements.files?.[0], ref = reference.files?.[0];
    if (!file || !req) { result.textContent = 'Choose a file in Verify and load its requirements JSON.'; return; }
    if (req.size > 128 * 1024 || file.size > 32 * 1024 * 1024 || (ref && ref.size > 32 * 1024 * 1024)) { result.textContent = 'The selected file exceeds the inspection size limit.'; return; }
    const work = new AbortController(); controller = work; run.disabled = true; result.textContent = 'Checking requirements…';
    try {
      const contract = parseProductionSpec(JSON.parse(await req.text())), bytes = new Uint8Array(await file.arrayBuffer());
      const report = await inspectBrowserProduction(bytes, contract, ref ? new Uint8Array(await ref.arrayBuffer()) : undefined, work.signal);
      const problems = await productionProblems(report, bytes, contract); work.signal.throwIfAborted();
      if (!files().includes(file) || !panel.isConnected) return;
      result.replaceChildren(); const title = document.createElement('p'); title.textContent = `${file.name}: ${problems.length ? 'Some required checks failed or could not run.' : 'All specified checks passed.'}`; result.append(title);
      const list = document.createElement('ul'); for (const check of report.checks) { const item = document.createElement('li'); const labels: Record<string, string> = { format: 'File format', readability: 'File readback', width: 'Width', height: 'Height', pages: 'Page count', alpha: 'Transparency', source: 'Source revision', context: 'Render settings' }; item.textContent = `${labels[check.id] ?? check.location}: ${check.state === 'pass' ? 'Passed' : check.state === 'fail' ? 'Does not match' : 'Could not measure'}`; list.append(item); } result.append(list);
      const reportFile = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const downloadReport = document.createElement('button'); downloadReport.type = 'button'; downloadReport.className = 'btn'; downloadReport.textContent = 'Download check report';
      downloadReport.addEventListener('click', () => { void host.export.download(reportFile, `${file.name}.production.json`).catch(error => { result.textContent = error instanceof Error ? error.message : 'Could not save the report.'; }); }); result.append(downloadReport);
      if (report.checks.every(c => c.state === 'pass' || (c.state === 'fail' && c.waivable))) {
        const review = document.createElement('details'), heading = document.createElement('summary'); heading.textContent = 'Record a local review'; review.append(heading);
        const name = document.createElement('input'); name.className = 'field-input'; name.placeholder = 'Reviewer name'; name.setAttribute('aria-label', 'Reviewer name'); review.append(name);
        const reason = document.createElement('textarea'); reason.className = 'field-input'; reason.placeholder = 'Reason for any appearance exceptions'; reason.setAttribute('aria-label', 'Reason for appearance exceptions'); review.append(reason);
        const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'btn'; accept.textContent = 'Download my review'; review.append(accept); result.append(review);
        accept.addEventListener('click', async () => {
          try {
            if (!files().includes(file)) throw new Error('The selected artifact has changed. Run the checks again.');
            const exceptions = await Promise.all(report.checks.filter(c => c.state === 'fail').map(async c => ({ findingId: c.id, findingSha256: await productionDigest(c), reason: reason.value })));
            const acceptance = await acceptProduction(report, bytes, contract, { kind: 'local-person', id: name.value, decisionRef: crypto.randomUUID() }, exceptions);
            await host.export.download(new Blob([JSON.stringify({ report, acceptance }, null, 2)], { type: 'application/json' }), `${file.name}.review.json`);
          } catch (error) { const note = document.createElement('p'); note.textContent = error instanceof Error ? error.message : 'Could not record this review.'; review.append(note); }
        });
      }
    } catch (error) { if (!work.signal.aborted) result.textContent = error instanceof Error ? error.message : 'Could not check this file.'; }
    finally { if (controller === work) run.disabled = false; }
  });
  view.append(panel); refresh();
  return () => { reset(); panel.remove(); };
}

/** Register cleanup alongside Verify's existing lifecycle. */
export function mountProductionVerify(view: HTMLElement, files: () => File[], host: HostV1): void {
  const cleanup = wireProductionVerify(view, files, host);
  const element = view as HTMLElement & { _cleanup?: () => void };
  const previous = element._cleanup;
  element._cleanup = () => { previous?.(); cleanup(); };
}
