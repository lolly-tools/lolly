// SPDX-License-Identifier: MPL-2.0
import '../styles/parts/valid-production.css';
import {
  productionCheckLabel,
  productionCheckReason,
  productionCheckValue,
} from './valid-production-copy.ts';
import { icon } from '../lib/icons.ts';
import type { ProductionReport } from '../../../../engine/src/production.ts';
import { metricRing } from '../components/metric-ring.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { inspectBrowserProduction } from '../bridge/production.ts';
import {
  parseProductionSpec,
  productionProblems,
  acceptProduction,
  productionDigest,
} from '../../../../engine/src/production.ts';
const reports = new WeakMap<File, ProductionReport>();
export const productionForReport = (file: File): ProductionReport | undefined => reports.get(file);
/** A local, explicit requirements check alongside Verify's existing reports. */
export function wireProductionVerify(
  view: HTMLElement,
  files: () => File[],
  host: HostV1
): () => void {
  const panel = document.createElement('details');
  panel.className = 'valid-production';
  panel.hidden = true;
  const summary = document.createElement('summary');
  summary.className = 'section-card-summary verify-disclosure';
  summary.innerHTML = `<span>${t('Production policy')}</span><span class="section-card-chev">${icon('chevronDown')}</span>`;
  panel.append(summary);
  const intro = document.createElement('p');
  intro.textContent = t('Compare the file with your requirements.');
  panel.append(intro);
  const help = document.createElement('a');
  help.href = '/info/build/production-checks.html';
  help.textContent = t('Help');
  help.className = 'valid-production-help';
  panel.append(help);
  const field = (label: string, accept: string): HTMLInputElement => {
    const wrapper = document.createElement('label');
    wrapper.textContent = t(label);
    wrapper.className = 'field-label';
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    input.accept = accept;
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'btn';
    pick.textContent = t('Choose');
    pick.addEventListener('click', () => input.click());
    const filename = document.createElement('span');
    filename.className = 'valid-production-filename';
    filename.textContent = t('None');
    input.addEventListener('change', () => {
      filename.textContent = input.files?.[0]?.name ?? t('None');
    });
    wrapper.append(input, pick, filename);
    panel.append(wrapper);
    return input;
  };
  const requirements = field('Requirements', '.json,application/json'),
    reference = field('Reference', '.png,.jpg,.jpeg,.svg,.pdf,.mp4,.webm');
  const select = document.createElement('select');
  select.className = 'field-select';
  select.setAttribute('aria-label', 'File to check');
  panel.append(select);
  const run = document.createElement('button');
  run.type = 'button';
  run.className = 'btn btn--primary';
  run.textContent = t('Check');
  panel.append(run);
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn';
  cancel.textContent = t('Cancel');
  cancel.hidden = true;
  panel.append(cancel);
  const result = document.createElement('div');
  result.setAttribute('aria-live', 'polite');
  panel.append(result);
  let controller: AbortController | undefined;
  const reset = (): void => {
    controller?.abort();
    controller = undefined;
    result.replaceChildren();
    for (const file of files()) reports.delete(file);
    run.disabled = !files().length || !requirements.files?.length;
    cancel.hidden = true;
  };
  cancel.addEventListener('click', () => {
    reset();
    result.textContent = t('Cancelled');
  });
  let previousFiles: File[] = [];
  const refresh = (): void => {
    const current = files();
    if (
      current.length === previousFiles.length &&
      current.every((file, index) => file === previousFiles[index])
    )
      return;
    previousFiles = [...current];
    reset();
    const prior = select.value;
    select.replaceChildren();
    files().forEach((file, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = file.name;
      select.append(option);
    });
    if (prior !== '' && Number(prior) < files().length) select.value = prior;
  };
  const report = view.querySelector('[data-report]');
  const observer = new MutationObserver(refresh);
  if (report) observer.observe(report, { childList: true, subtree: true });
  const selectedFile = (event: Event): void => {
    refresh();
    const index = (event as CustomEvent<string>).detail;
    if (select.value !== index) {
      select.value = index;
      reset();
    }
  };
  view.addEventListener('verify-file-select', selectedFile);
  panel.addEventListener('toggle', () => {
    refresh();
    if (!panel.open) panel.hidden = true;
  });
  select.addEventListener('focus', refresh);
  for (const el of [requirements, reference, select]) el.addEventListener('change', reset);
  run.addEventListener('click', async () => {
    reset();
    const file = files()[Number(select.value)],
      req = requirements.files?.[0],
      ref = reference.files?.[0];
    if (!file || !req) {
      result.textContent = t('Choose a file and its requirements.');
      return;
    }
    if (
      req.size > 128 * 1024 ||
      file.size > 32 * 1024 * 1024 ||
      (ref && ref.size > 32 * 1024 * 1024)
    ) {
      result.textContent = 'The selected file exceeds the inspection size limit.';
      return;
    }
    const work = new AbortController();
    controller = work;
    run.disabled = true;
    cancel.hidden = false;
    result.textContent = t('Checking…');
    try {
      const contract = parseProductionSpec(JSON.parse(await req.text())),
        bytes = new Uint8Array(await file.arrayBuffer());
      const report = await inspectBrowserProduction(
        bytes,
        contract,
        ref ? new Uint8Array(await ref.arrayBuffer()) : undefined,
        work.signal
      );
      const problems = await productionProblems(report, bytes, contract);
      work.signal.throwIfAborted();
      if (!files().includes(file) || !panel.isConnected) return;
      reports.set(file, report);
      result.replaceChildren();
      const passed = report.checks.filter((check) => check.state === 'pass').length;
      const heading = document.createElement('div');
      heading.className = 'valid-production-summary';
      heading.innerHTML = `${metricRing(report.checks.length ? (passed / report.checks.length) * 100 : null, `${passed}/${report.checks.length}`, t('Requirements passed'))}<strong>${esc(problems.length ? t('Review') : t('Passed'))}</strong>`;
      result.append(heading);
      const list = document.createElement('div');
      list.className = 'valid-production-checks';
      for (const check of report.checks) {
        const item = document.createElement('details');
        item.dataset.state = check.state;
        const title = document.createElement('summary');
        const label = document.createElement('span');
        label.textContent = productionCheckLabel(check);
        const state = document.createElement('span');
        state.className = 'valid-production-state';
        state.textContent =
          check.state === 'pass'
            ? t('Passed')
            : check.state === 'fail'
              ? t('Mismatch')
              : t('Unchecked');
        title.className = 'section-card-summary verify-disclosure';
        const arrow = document.createElement('span');
        arrow.className = 'section-card-chev';
        arrow.innerHTML = icon('chevronDown');
        title.append(label, state, arrow);
        item.append(title);
        const reason = document.createElement('p');
        reason.textContent = productionCheckReason(check);
        item.append(reason);
        if (check.expected !== undefined || check.actual !== undefined) {
          const measurements = document.createElement('dl');
          for (const [name, value] of [
            [t('Expected'), check.expected],
            [t('Measured'), check.actual],
          ] as const) {
            const term = document.createElement('dt'),
              definition = document.createElement('dd');
            term.textContent = name;
            definition.textContent = productionCheckValue(check, value);
            measurements.append(term, definition);
          }
          item.append(measurements);
        }
        list.append(item);
      }
      result.append(list);
      const reportFile = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const downloadReport = document.createElement('button');
      downloadReport.type = 'button';
      downloadReport.className = 'btn';
      downloadReport.textContent = t('Report');
      downloadReport.addEventListener('click', () => {
        void host.export.download(reportFile, `${file.name}.production.json`).catch((error) => {
          result.textContent =
            error instanceof Error ? error.message : 'Could not save the report.';
        });
      });
      result.append(downloadReport);
      if (report.checks.every((c) => c.state === 'pass' || (c.state === 'fail' && c.waivable))) {
        const review = document.createElement('details'),
          heading = document.createElement('summary');
        heading.className = 'section-card-summary verify-disclosure';
        heading.innerHTML = `<span>${t('Review')}</span><span class="section-card-chev">${icon('chevronDown')}</span>`;
        review.append(heading);
        const name = document.createElement('input');
        name.className = 'field-input';
        name.placeholder = 'Reviewer name';
        name.setAttribute('aria-label', 'Reviewer name');
        review.append(name);
        const reason = document.createElement('textarea');
        reason.className = 'field-input';
        reason.placeholder = t('Reason for exceptions');
        reason.setAttribute('aria-label', 'Reason for appearance exceptions');
        review.append(reason);
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'btn';
        accept.textContent = t('Save');
        review.append(accept);
        result.append(review);
        accept.addEventListener('click', async () => {
          try {
            if (!files().includes(file))
              throw new Error('The selected artifact has changed. Run the checks again.');
            const exceptions = await Promise.all(
              report.checks
                .filter((c) => c.state === 'fail')
                .map(async (c) => ({
                  findingId: c.id,
                  findingSha256: await productionDigest(c),
                  reason: reason.value,
                }))
            );
            const acceptance = await acceptProduction(
              report,
              bytes,
              contract,
              { kind: 'local-person', id: name.value, decisionRef: crypto.randomUUID() },
              exceptions
            );
            await host.export.download(
              new Blob([JSON.stringify({ report, acceptance }, null, 2)], {
                type: 'application/json',
              }),
              `${file.name}.review.json`
            );
          } catch (error) {
            const note = document.createElement('p');
            note.textContent =
              error instanceof Error ? error.message : 'Could not record this review.';
            review.append(note);
          }
        });
      }
    } catch (error) {
      if (!work.signal.aborted && controller === work)
        result.textContent = error instanceof Error ? error.message : 'Could not check this file.';
    } finally {
      if (controller === work) {
        run.disabled = false;
        cancel.hidden = true;
      }
    }
  });
  (view.querySelector('.valid-layout') ?? view).append(panel);
  refresh();
  reset();
  return () => {
    observer.disconnect();
    view.removeEventListener('verify-file-select', selectedFile);
    reset();
    panel.remove();
  };
}

/** Register cleanup alongside Verify's existing lifecycle. */
export function mountProductionVerify(view: HTMLElement, files: () => File[], host: HostV1): void {
  const cleanup = wireProductionVerify(view, files, host);
  const element = view as HTMLElement & { _cleanup?: () => void };
  const previous = element._cleanup;
  element._cleanup = () => {
    previous?.();
    cleanup();
  };
}
