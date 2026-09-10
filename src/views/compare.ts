// SPDX-License-Identifier: MPL-2.0
import type { HostV1, ComparisonSource } from '@lolly-tools/core/host-v1';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountComparison } from '../components/compare-panel.ts';
import { mountVisualComparison } from '../components/compare-visual-panel.ts';
import { comparisonVisualSource } from '../lib/compare-visual-sources.ts';
import { compareElement as el, compareButton as button } from '../components/compare-elements.ts';
import { comparisonFileSource, comparisonTextSource } from '../lib/compare-sources.ts';
import { t } from '../i18n.ts';

export function mountCompare(view: HTMLElement & { _cleanup?: () => void }, host: HostV1): void {
  document.title = `${t('Compare')} - Lolly`;
  view.innerHTML = backHomeHtml(); mountBackPill(view); mountHomeFab(view);
  const page = el('section', undefined, 'compare-page');
  page.append(el('h1', t('Compare')), el('p', t('Compare text, JSON, images or PDFs on this device. Your sources stay unchanged.')));
  const mode = el('select', undefined, 'field-select'); mode.setAttribute('aria-label', t('Comparison mode'));
  mode.add(new Option(t('Text'), 'text')); mode.add(new Option(t('JSON structure'), 'json')); mode.add(new Option(t('Images / PDF pages'), 'visual')); page.append(mode);
  const sources = el('div', undefined, 'compare-sources');
  const inputs: Array<{ text: HTMLTextAreaElement; file: File | undefined; label: HTMLElement }> = [];
  for (const side of [t('Before'), t('After')]) {
    const box = el('div', undefined, 'compare-source'), heading = el('h2', side), text = el('textarea', undefined, 'field-input');
    text.setAttribute('aria-label', `${side} ${t('text')}`); text.placeholder = t('Paste text here, or choose or drop a file.'); text.maxLength = 2 * 1024 * 1024;
    const picker = el('input'); picker.type = 'file'; picker.setAttribute('aria-label', `${side} ${t('file')}`);
    picker.hidden = true;
    const chooseFile = button('Choose file'); chooseFile.addEventListener('click', () => picker.click());
    const label = el('p', t('No file selected.'));
    const input = { text, file: undefined as File | undefined, label }; inputs.push(input);
    const choose = (file: File | undefined): void => { input.file = file; label.textContent = file?.name ?? t('No file selected.'); if (file) text.value = ''; invalidate(); };
    picker.addEventListener('change', () => choose(picker.files?.[0]));
    text.addEventListener('input', () => { input.file = undefined; picker.value = ''; label.textContent = t('Pasted text'); invalidate(); });
    box.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
    box.addEventListener('drop', event => { const file = event.dataTransfer?.files[0]; if (file) { event.preventDefault(); event.stopPropagation(); choose(file); } });
    box.append(heading, text, chooseFile, picker, label); sources.append(box);
  }
  const run = button('Compare', true), cancelLoad = button('Cancel loading'), status = el('p'), results = el('div'); status.setAttribute('role', 'status'); cancelLoad.hidden = true;
  page.append(sources, run, cancelLoad, status, results); view.append(page);
  let dispose: (() => void) | undefined, pending: AbortController | undefined, generation = 0;
  const invalidate = (): void => { generation++; pending?.abort(); dispose?.(); dispose = undefined; status.textContent = ''; cancelLoad.hidden = true; run.disabled = !host.compare; };
  mode.addEventListener('change', () => { invalidate(); for (const input of inputs) input.text.hidden = mode.value === 'visual'; });
  cancelLoad.addEventListener('click', () => { invalidate(); status.textContent = t('Comparison cancelled.'); });
  run.disabled = !host.compare;
  if (!host.compare) status.textContent = t('Comparison is unavailable in this host.');
  run.addEventListener('click', async () => {
    if (!host.compare) return;
    invalidate(); const token = generation; const controller = new AbortController(); pending = controller; run.disabled = true; cancelLoad.hidden = false; status.textContent = t('Loading sources locally…');
    try {
      if (mode.value === 'visual') {
        if (!host.compare.visual) throw new Error(t('Visual comparison is unavailable in this host.'));
        if (inputs.some(input => !input.file)) throw new Error(t('Choose an image or PDF for each side.'));
        const pair = await Promise.all(inputs.map(input => comparisonVisualSource(input.file!, host, controller.signal)));
        if (token !== generation) return;
        status.textContent = ''; dispose = mountVisualComparison(results, host.compare, { version: 1, before: pair[0]!, after: pair[1]! }); return;
      }
      const selectedMode = mode.value === 'json' ? 'json' : 'text';
      const pair: ComparisonSource[] = await Promise.all(inputs.map((input, i) => input.file
        ? comparisonFileSource(input.file, selectedMode, controller.signal)
        : comparisonTextSource(input.text.value, { id: `text-${i}`, kind: 'text', label: i ? t('After text') : t('Before text') }, selectedMode)));
      if (token !== generation) return;
      status.textContent = ''; dispose = mountComparison(results, host.compare, { version: 1, before: pair[0]!, after: pair[1]! });
    } catch (error) { if (token === generation) status.textContent = error instanceof Error ? error.message : t('Choose two compatible sources.'); controller.abort(); }
    finally { if (token === generation) { run.disabled = false; cancelLoad.hidden = true; } }
  });
  view._cleanup = () => { invalidate(); inputs.forEach(input => { input.file = undefined; input.text.value = ''; }); };
}
