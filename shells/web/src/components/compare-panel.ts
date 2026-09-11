// SPDX-License-Identifier: MPL-2.0
import type { CompareAPI, ComparisonRequest } from '@lolly-tools/core/host-v1';
import { mountComparisonResults } from './compare-results.ts';
import { compareElement as el, compareButton as button } from './compare-elements.ts';
import { t } from '../i18n.ts';
import './compare.css';

/** Reused by utility/history. The request is captured; no editor or storage writes. */
export function mountComparison(root: HTMLElement, api: CompareAPI, input: ComparisonRequest): () => void {
  const request = structuredClone(input); request.options = { ...request.options };
  root.classList.add('compare-panel'); root.replaceChildren();
  const identities = el('div', undefined, 'compare-identities');
  const names = (): void => { identities.replaceChildren(el('p', `${t('Before')}: ${request.before.identity.label}`), el('p', `${t('After')}: ${request.after.identity.label}`)); };
  names();
  const options = el('div', undefined, 'compare-toolbar'), swap = button('Swap sides'), run = button('Compare again'), cancel = button('Cancel comparison');
  const status = el('p'); status.setAttribute('role', 'status');
  const result = el('div');
  const textMode = request.before.content.kind === 'text' && request.after.content.kind === 'text';
  const checkbox = (label: string, checked: boolean, changed: (checked: boolean) => void): void => {
    const wrap = el('label'), check = el('input'); check.type = 'checkbox'; check.checked = checked; wrap.append(check, document.createTextNode(t(label)));
    check.addEventListener('change', () => { changed(check.checked); void compare(); }); options.append(wrap);
  };
  if (textMode) {
    const granularity = el('select', undefined, 'field-select'); granularity.setAttribute('aria-label', t('Text comparison detail'));
    granularity.add(new Option(t('Lines'), 'line')); granularity.add(new Option(t('Words'), 'word')); granularity.value = request.options.granularity ?? 'line';
    granularity.addEventListener('change', () => { request.options!.granularity = granularity.value === 'word' ? 'word' : 'line'; void compare(); }); options.append(granularity);
    checkbox('Ignore whitespace', request.options.whitespace === 'ignore', checked => { request.options!.whitespace = checked ? 'ignore' : 'exact'; });
    checkbox('Ignore case', !!request.options.ignoreCase, checked => { request.options!.ignoreCase = checked; });
  } else checkbox('Match array items by unique id', request.options.arrayAlignment === 'id', checked => { request.options!.arrayAlignment = checked ? 'id' : 'position'; });
  options.append(swap, run, cancel); root.append(identities, options, status, result);
  let active: AbortController | undefined, generation = 0, disposed = false;
  async function compare(): Promise<void> {
    active?.abort(); const controller = new AbortController(); active = controller; const token = ++generation;
    cancel.disabled = false; run.disabled = true; status.textContent = t('Comparing locally…'); result.replaceChildren();
    try {
      const value = await api.run(request, { signal: controller.signal });
      if (disposed || token !== generation) return;
      status.textContent = ''; mountComparisonResults(result, value);
    } catch (error) {
      if (disposed || token !== generation) return;
      status.textContent = error instanceof Error && error.name === 'AbortError' ? t('Comparison cancelled.') : t('These sources could not be compared.');
    } finally { if (!disposed && token === generation) { run.disabled = false; cancel.disabled = true; } }
  }
  swap.addEventListener('click', () => { [request.before, request.after] = [request.after, request.before]; names(); void compare(); });
  run.addEventListener('click', () => { void compare(); }); cancel.addEventListener('click', () => active?.abort());
  void compare();
  return () => { disposed = true; generation++; active?.abort(); root.replaceChildren(); };
}
