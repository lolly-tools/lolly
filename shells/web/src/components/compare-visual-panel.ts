// SPDX-License-Identifier: MPL-2.0
import type { CompareAPI, VisualComparisonRequest } from '@lolly-tools/core/host-v1';
import { compareElement as el, compareButton as button } from './compare-elements.ts';
import { mountVisualResults } from './compare-visual-results.ts';
import { t } from '../i18n.ts';
import './compare.css';

export function mountVisualComparison(root: HTMLElement, api: CompareAPI, input: VisualComparisonRequest): () => void {
  const request = structuredClone(input); request.options = { ...input.options };
  root.replaceChildren(); root.classList.add('compare-panel');
  const identities = el('div', undefined, 'compare-identities'), controls = el('div', undefined, 'compare-toolbar');
  const names = (): void => { identities.replaceChildren(...[request.before, request.after].map((source, i) => el('p', `${i ? t('After') : t('Before')}: ${source.identity.label}${source.identity.revision ? ` · ${source.identity.revision}` : ''}`))); }; names();
  const alignment = el('select', undefined, 'field-select'); alignment.setAttribute('aria-label', t('Visual alignment'));
  alignment.add(new Option(t('Native size · top-left alignment'), 'native')); alignment.add(new Option(t('Fit both pages to one frame'), 'fit')); alignment.value = request.options.alignment ?? 'native';
  const label = el('label', t('Noise threshold (0–255)')), threshold = el('input', undefined, 'field-input'); threshold.type = 'number'; threshold.min = '0'; threshold.max = '255'; threshold.step = '1'; threshold.value = String(request.options.threshold ?? 0); label.append(threshold);
  const swap = button('Swap sides'), run = button('Run comparison', true), cancel = button('Cancel comparison');
  const status = el('p'); status.setAttribute('role', 'status'); const results = el('div'); controls.append(alignment, label, swap, run, cancel); root.append(identities, controls, status, results);
  let active: AbortController | undefined, generation = 0, disposed = false;
  async function compare(): Promise<void> {
    active?.abort(); const controller = new AbortController(); active = controller; const token = ++generation;
    results.replaceChildren(); cancel.disabled = false; run.disabled = true; status.textContent = t('Comparing previews locally…');
    request.options = { alignment: alignment.value === 'fit' ? 'fit' : 'native', threshold: Math.max(0, Math.min(255, Number(threshold.value) || 0)) }; threshold.value = String(request.options.threshold);
    try {
      if (!api.visual) throw new Error('Visual comparison is unavailable in this host.');
      const result = await api.visual(request, { signal: controller.signal });
      if (disposed || token !== generation) return;
      status.textContent = ''; mountVisualResults(results, result, request);
    } catch (error) {
      if (!disposed && token === generation) status.textContent = error instanceof Error && error.name === 'AbortError' ? t('Comparison cancelled.') : t('These previews could not be compared.');
    } finally { if (!disposed && token === generation) { run.disabled = false; cancel.disabled = true; } }
  }
  alignment.addEventListener('change', () => { void compare(); }); threshold.addEventListener('change', () => { void compare(); });
  swap.addEventListener('click', () => { [request.before, request.after] = [request.after, request.before]; names(); void compare(); });
  run.addEventListener('click', () => { void compare(); }); cancel.addEventListener('click', () => active?.abort());
  void compare();
  return () => { disposed = true; generation++; active?.abort(); root.replaceChildren(); };
}
