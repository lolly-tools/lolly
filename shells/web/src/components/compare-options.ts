// SPDX-License-Identifier: MPL-2.0
import type { ComparisonRequest } from '@lolly-tools/core/host-v1';
import { compareElement as el } from './compare-elements.ts';
import { t } from '../i18n.ts';

/** Controls edit the captured request only; every mode uses the same Compare API. */
export function mountComparisonOptions(root: HTMLElement, request: ComparisonRequest, compare: () => Promise<void>): void {
  const options = request.options!;
  const checkbox = (label: string, checked: boolean, changed: (checked: boolean) => void): void => {
    const wrap = el('label'), check = el('input'); check.type = 'checkbox'; check.checked = checked; wrap.append(check, document.createTextNode(t(label)));
    check.addEventListener('change', () => { changed(check.checked); void compare(); }); root.append(wrap);
  };
  const before = request.before.content, after = request.after.content;
  if (before.kind === 'table' && after.kind === 'table') {
    const keys = new Set<string>();
    for (const table of before.tables) {
      const matches = after.tables.filter(value => value.name === table.name);
      if (matches.length !== 1 || before.tables.filter(value => value.name === table.name).length !== 1) continue;
      for (const column of table.columns) if (column && table.columns.filter(value => value === column).length === 1
        && matches[0]!.columns.filter(value => value === column).length === 1) keys.add(column);
    }
    const label = el('label', t('Row key')), select = el('select', undefined, 'field-select');
    select.setAttribute('aria-label', t('Row key'));
    select.add(new Option(t('Row position'), '')); for (const key of keys) select.add(new Option(key, key)); select.value = options.tableRowKey ?? '';
    label.append(select); root.append(label, el('p', t('Choose a common column to match rows. Duplicate or blank keys remain visible and use positional fallback.'), 'compare-note'));
    select.addEventListener('change', () => { options.tableRowKey = select.value || undefined; void compare(); });
  } else if (before.kind === 'document' && after.kind === 'document') {
    const label = el('label', t('Document alignment')), select = el('select', undefined, 'field-select');
    select.setAttribute('aria-label', t('Document alignment'));
    select.add(new Option(t('Exact text anchors'), 'text')); select.add(new Option(t('Reading position'), 'position')); select.add(new Option(t('Retained document IDs'), 'id'));
    select.options[2]!.disabled = !before.units.some(unit => unit.id) || !after.units.some(unit => unit.id);
    select.value = options.documentAlignment ?? 'text'; label.append(select); root.append(label);
    select.addEventListener('change', () => { options.documentAlignment = select.value as 'text' | 'position' | 'id'; void compare(); });
  } else if (before.kind === 'text' && after.kind === 'text') {
    const granularity = el('select', undefined, 'field-select'); granularity.setAttribute('aria-label', t('Text comparison detail'));
    granularity.add(new Option(t('Lines'), 'line')); granularity.add(new Option(t('Words'), 'word')); granularity.value = options.granularity ?? 'line';
    granularity.addEventListener('change', () => { options.granularity = granularity.value === 'word' ? 'word' : 'line'; void compare(); }); root.append(granularity);
    checkbox('Ignore whitespace', options.whitespace === 'ignore', checked => { options.whitespace = checked ? 'ignore' : 'exact'; });
    checkbox('Ignore case', !!options.ignoreCase, checked => { options.ignoreCase = checked; });
  } else if (['structure', 'yaml'].includes(before.kind) && ['structure', 'yaml'].includes(after.kind)) {
    checkbox('Match array items by unique id', options.arrayAlignment === 'id', checked => { options.arrayAlignment = checked ? 'id' : 'position'; });
  }
}
