// SPDX-License-Identifier: MPL-2.0
import type { ComparisonChange, ComparisonResult } from '@lolly-tools/core/host-v1';
import { comparisonReport } from '../lib/compare-report.ts';
import { compareElement as el, compareButton as button } from './compare-elements.ts';
import { t } from '../i18n.ts';
import { deliverBlob } from '../lib/download-recovery.ts';

const position = (location: ComparisonChange['before']): string => location?.line ? t('Line {line}', { line: location.line }) : location?.path.length ? location.path.map(String).join(' · ') : t('Document');
export function mountComparisonResults(root: HTMLElement, result: ComparisonResult): void {
  root.replaceChildren();
  const summary = el('p', result.equality === 'different' ? (result.summary.total === 1 ? t('1 change found') : t('{n} changes found', { n: result.summary.total }))
    : result.equality === 'identical-bytes' ? t('The supplied bytes are identical.')
      : result.equality === 'equivalent-content' ? t('The compared content is equivalent with these options.')
        : t('This comparison is incomplete. Equality could not be established.'), 'compare-summary');
  summary.setAttribute('role', 'status'); root.append(summary);
  root.append(el('p', t('Appearance and asset dependencies were not compared.'), 'compare-note'));
  if (result.completeness === 'partial' || result.detailsTruncated) root.append(el('p', t('Only part of the comparison is shown. Unlisted content may differ.'), 'compare-limit'));
  for (const message of result.limitations) root.append(el('p', t(message), 'compare-limit'));
  const toolbar = el('div', undefined, 'compare-toolbar');
  const prev = button('Previous change'), next = button('Next change');
  const layout = el('select', undefined, 'field-select'); layout.setAttribute('aria-label', t('Comparison layout'));
  layout.add(new Option(t('Side by side'), 'pair')); layout.add(new Option(t('Inline'), 'inline'));
  const values = el('label'), reveal = el('input'); reveal.type = 'checkbox'; values.append(reveal, document.createTextNode(t('Show changed values')));
  const list = el('div', undefined, 'compare-changes'); list.dataset.layout = 'pair';
  toolbar.append(prev, next, layout, values); root.append(toolbar, list);
  const items: HTMLDetailsElement[] = [];
  const kinds = { added: t('Added'), removed: t('Removed'), changed: t('Changed'), moved: t('Moved') };
  for (const change of result.changes) {
    const item = el('details', undefined, 'compare-change'); item.dataset.kind = change.kind;
    const heading = el('summary', `${kinds[change.kind]} · ${position(change.before ?? change.after)}${change.kind === 'moved' ? ` → ${position(change.after)}` : ''}`);
    const pair = el('div', undefined, 'compare-pair');
    const panes: HTMLPreElement[] = [];
    for (const [label, value, location] of [[t('Before'), change.beforeValue, change.before], [t('After'), change.afterValue, change.after]] as const) {
      const side = el('section'); side.append(el('h3', `${label} · ${position(location)}`));
      const pre = el('pre', value ?? t('Not present')); pre.tabIndex = 0;
      if (change.valueTruncated) pre.append(document.createTextNode(`\n${t('Value excerpt; some content is omitted.')}`));
      side.append(pre); panes.push(pre); pair.append(side);
    }
    for (const pane of panes) pane.addEventListener('scroll', () => { for (const other of panes) if (other !== pane && other.scrollLeft !== pane.scrollLeft) other.scrollLeft = pane.scrollLeft; });
    item.append(heading, pair); list.append(item); items.push(item);
  }
  let selected = -1;
  const move = (direction: number): void => {
    if (!items.length) return;
    selected = selected < 0 ? (direction > 0 ? 0 : items.length - 1) : (selected + direction + items.length) % items.length;
    const item = items[selected]!; item.querySelector('summary')?.focus(); item.scrollIntoView({ block: 'nearest' });
  };
  prev.disabled = next.disabled = !items.length; prev.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
  layout.addEventListener('change', () => { list.dataset.layout = layout.value; });
  reveal.addEventListener('change', () => { for (const item of items) item.open = reveal.checked; });
  const report = el('div', undefined, 'compare-toolbar');
  const content = el('select', undefined, 'field-select'); content.setAttribute('aria-label', t('Report content'));
  content.add(new Option(t('Summary only - no names or values'), 'summary'));
  content.add(new Option(t('Include source names, paths and values'), 'content'));
  const save = button('Download comparison report');
  save.addEventListener('click', () => {
    const blob = new Blob([comparisonReport(result, content.value === 'content')], { type: 'application/json' });
    // Through the host (the Tauri shells override it with a native save) - never a raw anchor.
    void deliverBlob(blob, 'comparison.json');
  });
  report.append(content, save); root.append(report);
}
