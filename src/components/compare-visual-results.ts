// SPDX-License-Identifier: MPL-2.0
import type { VisualComparisonRequest, VisualComparisonResult } from '@lolly-tools/core/host-v1';
import { renderComparisonPage } from '@lolly/engine';
import { visualComparisonReport } from '../lib/compare-visual-report.ts';
import { compareElement as el, compareButton as button } from './compare-elements.ts';
import { t } from '../i18n.ts';
import { deliverBlob } from '../lib/download-recovery.ts';

export function mountVisualResults(root: HTMLElement, result: VisualComparisonResult, request: VisualComparisonRequest): void {
  root.replaceChildren();
  const changed = result.summary.changed + result.summary.added + result.summary.removed;
  const summary = el('p', result.appearance === 'different' ? (changed === 1 ? t('1 page differs') : t('{n} pages differ', { n: changed })) : result.appearance === 'undetermined' ? t('Preview comparison is incomplete. Equality could not be established.') : t('The sampled previews match with these options.'), 'compare-summary');
  summary.setAttribute('role', 'status'); root.append(summary);
  root.append(el('p', result.byteEquality === 'equal' ? t('The supplied bytes are identical.') : result.byteEquality === 'different' ? t('The supplied bytes differ.') : t('Original byte equality was not checked.')));
  if (result.completeness === 'partial') root.append(el('p', t('Partial comparison. Unrendered content may differ.'), 'compare-limit'));
  for (const message of result.limitations) root.append(el('p', t(message), 'compare-limit'));
  const controls = el('div', undefined, 'compare-toolbar'), select = el('select', undefined, 'field-select'); select.setAttribute('aria-label', t('Preview page'));
  const kinds = { changed: t('Changed'), added: t('Added'), removed: t('Removed'), unchanged: t('No sampled change'), unavailable: t('Unavailable') };
  for (const page of result.pages) select.add(new Option(`${t('Page {n}', { n: page.page })} · ${kinds[page.kind]}`, String(page.page)));
  const previous = button('Previous changed page'), next = button('Next changed page');
  const layout = el('select', undefined, 'field-select'); layout.setAttribute('aria-label', t('Visual comparison layout'));
  for (const [name, value] of [['Side by side', 'pair'], ['Swipe', 'swipe'], ['Overlay', 'overlay'], ['Difference', 'difference']]) layout.add(new Option(t(name!), value));
  const blendLabel = el('label', t('After visibility')), blend = el('input'); blend.type = 'range'; blend.min = '0'; blend.max = '100'; blend.value = '50'; blend.setAttribute('aria-label', t('After visibility')); blendLabel.append(blend); blendLabel.hidden = true;
  const info = el('p', undefined, 'compare-page-info'); info.tabIndex = -1; info.setAttribute('aria-live', 'polite');
  const stage = el('div', undefined, 'compare-visual-stage'); controls.append(previous, next, select, layout, blendLabel); root.append(controls, info, stage);
  const changedPages = result.pages.filter(p => p.kind !== 'unchanged'); previous.disabled = next.disabled = !changedPages.length;
  const move = (direction: number): void => {
    const current = Number(select.value), candidates = direction > 0 ? changedPages.filter(p => p.page > current) : changedPages.filter(p => p.page < current).reverse();
    select.value = String((candidates[0] ?? (direction > 0 ? changedPages[0] : changedPages.at(-1)))!.page); render(); info.focus();
  };
  previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
  function render(): void {
    const page = result.pages.find(p => p.page === Number(select.value)); if (!page) return;
    const a = request.before.pages.find(p => p.page === page.page), b = request.after.pages.find(p => p.page === page.page);
    const geometry = [a, b].map(p => p ? `${p.width} × ${p.height} ${p.unit}` : t('No preview')).join(' → ');
    info.textContent = `${t('Page {n}', { n: page.page })} · ${kinds[page.kind]} · ${geometry} · ${page.width} × ${page.height} ${t('samples')} · ${t('Scale')} ${page.scale.toFixed(3)} · ${page.changedPixels}/${page.sampledPixels} ${t('changed samples')}${page.sizeChanged ? ` · ${t('Page dimensions changed')}` : ''}`;
    stage.replaceChildren(); stage.dataset.layout = layout.value;
    blendLabel.hidden = layout.value !== 'swipe' && layout.value !== 'overlay';
    const left = renderComparisonPage(a, page, result.options.alignment), right = renderComparisonPage(b, page, result.options.alignment);
    const paint = (data: Uint8ClampedArray, label: string): HTMLCanvasElement => {
      const canvas = el('canvas'); canvas.width = page.width; canvas.height = page.height; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', label);
      canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(data), page.width, page.height), 0, 0); return canvas;
    };
    if (layout.value === 'pair') {
      for (const [label, source, data, count] of [[t('Before'), a, left, request.before.totalPages], [t('After'), b, right, request.after.totalPages]] as const) {
        const pane = el('section'); pane.append(el('h3', label));
        pane.append(source ? paint(data, `${label} · ${t('Page {n}', { n: page.page })}`) : el('p', page.page > count ? t('Page not present') : t('Preview unavailable'))); stage.append(pane);
      }
    } else if (!a || !b || page.kind === 'unavailable') stage.append(el('p', t('Both page previews are needed for this view. Use Side by side to inspect the available page.')));
    else {
      const data = new Uint8ClampedArray(left.length), fraction = Number(blend.value) / 100;
      for (let i = 0; i < page.width * page.height; i++) {
        const offset = i * 4;
        for (let c = 0; c < 3; c++) data[offset + c] = layout.value === 'difference' ? (page.mask[i] ? (c === 1 ? 0 : 180) : 255)
          : layout.value === 'swipe' ? (i % page.width < page.width * fraction ? right[offset + c]! : left[offset + c]!)
            : Math.round(left[offset + c]! * (1 - fraction) + right[offset + c]! * fraction);
        data[offset + 3] = 255;
      }
      stage.append(paint(data, `${layout.selectedOptions[0]!.text} · ${t('Page {n}', { n: page.page })}`));
      if (layout.value === 'difference') stage.append(el('p', t('Coloured pixels exceed the selected threshold. White pixels have no sampled change.')));
    }
  }
  select.addEventListener('change', render); layout.addEventListener('change', render); blend.addEventListener('input', render); render();
  const list = el('details', undefined, 'compare-change'); list.append(el('summary', t('Page change list')));
  const entries = el('ul');
  for (const page of result.pages) { const item = el('li'), jump = button(`${t('Page {n}', { n: page.page })} · ${kinds[page.kind]}`); jump.addEventListener('click', () => { select.value = String(page.page); render(); info.focus(); }); item.append(jump); entries.append(item); }
  list.append(entries); root.append(list);
  const report = el('div', undefined, 'compare-toolbar'), names = el('label'), include = el('input'); include.type = 'checkbox'; names.append(include, document.createTextNode(t('Include source names and page details in report')));
  const save = button('Download comparison report'); save.addEventListener('click', () => {
    // Through the host (the Tauri shells override it with a native save) - never a raw anchor.
    void deliverBlob(new Blob([visualComparisonReport(result, include.checked)], { type: 'application/json' }), 'comparison.json');
  }); report.append(names, save); root.append(report);
}
