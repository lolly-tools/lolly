// SPDX-License-Identifier: MPL-2.0
/** Optional edge rules and authored tab stops stay in the paragraph popover. */
import type { TextParagraphStyleV1 } from '@lolly-tools/core';
import { styleTextControls, textControlNumber, textControlRow, destroyTextControls } from './text-control-ui.ts';
import { t } from '../i18n.ts';
export function mountParagraphRefinements(root: HTMLElement, read: () => TextParagraphStyleV1, write: (value: TextParagraphStyleV1, label: string) => void) {
  const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = t('Tabs and paragraph edges'); details.append(summary); root.append(details);
  const optical = document.createElement('input'); optical.type = 'checkbox'; optical.className = 'field-check'; textControlRow(details, t('Optical margin alignment'), optical);
  optical.addEventListener('change', () => write({ opticalMargin: optical.checked }, t('Optical margin alignment')));
  const tabs = document.createElement('div'); details.append(tabs);
  const add = document.createElement('button'); add.type = 'button'; add.textContent = t('Add tab stop');
  add.addEventListener('click', () => { const stops = read().tabs ?? []; write({ tabs: [...stops, { position: (stops.at(-1)?.position ?? 0) + 80, align: 'start' }] }, t('Add tab stop')); }); details.append(add);
  let stamp = '';
  function refreshTabs() {
    const value = read().tabs ?? [], key = JSON.stringify(value); add.disabled = value.length >= 128;
    if (stamp === key || tabs.contains(document.activeElement) || tabs.querySelector('.is-scrubbing')) return;
    stamp = key; destroyTextControls(tabs); tabs.replaceChildren();
    for (const [index, stop] of value.entries()) {
      const row = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = `${t('Tab stop')} ${index + 1}`; row.append(legend); tabs.append(row);
      const position = textControlNumber(row, t('Position'), { value: stop.position, min: 0, max: 100000, step: 1, precision: 2, onCommit: () => change() });
      const align = document.createElement('select'); for (const [value, label] of [['start', t('Start')], ['center', t('Centre')], ['end', t('End')], ['decimal', t('Decimal')]]) align.add(new Option(label!, value)); align.value = stop.align;
      const leader = document.createElement('input'); leader.maxLength = 32; leader.value = stop.leader ?? '';
      textControlRow(row, t('Alignment'), align); textControlRow(row, t('Leader'), leader);
      function change() {
        const stops = read().tabs ?? [], updated = stops.map((item, i) => i === index ? { position: Number(position.input.value), align: align.value as typeof stop.align, leader: leader.value } : item).sort((a, b) => a.position - b.position);
        if (new Set(updated.map(item => item.position)).size !== updated.length) { position.set(stop.position); return; }
        write({ tabs: updated }, t('Tab stop'));
      }
      for (const input of [align, leader]) input.addEventListener('change', change);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = t('Remove tab stop'); remove.addEventListener('click', () => write({ tabs: (read().tabs ?? []).filter((_, i) => i !== index) }, t('Remove tab stop'))); row.append(remove);
    }
  }
  const updates: Array<() => void> = [];
  const cap = document.createElement('fieldset'), capLegend = document.createElement('legend'); capLegend.textContent = t('Drop capital'); cap.append(capLegend); details.append(cap);
  const capOn = document.createElement('input'); capOn.type = 'checkbox'; capOn.className = 'field-check'; capOn.setAttribute('aria-label', t('Drop capital')); cap.append(capOn);
  const capital = () => read().dropCap ?? { enabled: false, characters: 1, lines: 3, gap: 8 };
  capOn.addEventListener('change', () => write({ dropCap: { ...capital(), enabled: capOn.checked } }, t('Drop capital')));
  updates.push(() => { capOn.checked = !!read().dropCap && read().dropCap?.enabled !== false; });
  for (const [key, label, min, max] of [['characters', t('Drop capital characters'), 1, 16], ['lines', t('Drop capital lines'), 2, 20], ['gap', t('Drop capital gap'), 0, 1000]] as const) {
    const field = textControlNumber(cap, label, { value: capital()[key], min, max, step: 1, precision: key === 'gap' ? 2 : 0, onCommit: value => write({ dropCap: { ...capital(), [key]: value } }, t('Drop capital')) });
    updates.push(() => field.set(capital()[key]));
  }
  for (const [key, label] of [['ruleBefore', t('Rule before paragraph')], ['ruleAfter', t('Rule after paragraph')]] as const) {
    const field = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = label; field.append(legend); details.append(field);
    const rule = () => read()[key] ?? { enabled: false, width: 1, offset: 4, color: '#000000' };
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.className = 'field-check'; enabled.setAttribute('aria-label', label); field.append(enabled);
    enabled.addEventListener('change', () => write({ [key]: { ...rule(), enabled: enabled.checked } }, label));
    const width = textControlNumber(field, t('Rule thickness'), { value: rule().width, min: .01, max: 1000, step: .1, precision: 2, onCommit: width => write({ [key]: { ...rule(), width } }, label) });
    const offset = textControlNumber(field, t('Rule offset'), { value: rule().offset, min: -1000, max: 1000, step: 1, precision: 2, onCommit: offset => write({ [key]: { ...rule(), offset } }, label) });
    const color = document.createElement('input'); color.type = 'color'; textControlRow(field, t('Rule colour'), color);
    color.addEventListener('change', () => write({ [key]: { ...rule(), color: color.value } }, label));
    updates.push(() => {
      const current = rule(); enabled.checked = !!read()[key] && current.enabled !== false; width.set(current.width); offset.set(current.offset);
      if (document.activeElement !== color) color.value = /^#[a-f0-9]{6}$/i.test(current.color) ? current.color : '#000000';
    });
  }
  function refresh() { optical.checked = !!read().opticalMargin; refreshTabs(); updates.forEach(update => { update(); }); styleTextControls(root); }
  refresh(); return { refresh };
}
