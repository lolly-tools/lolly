// SPDX-License-Identifier: MPL-2.0
/** The frame popover and optional Inspector edit the same admitted geometry. */
import type { TextFrameV1 } from '@lolly-tools/core';
import { mountTextPathControls } from './text-path-controls.ts';
import { textControlNumber, styleTextControls, textControlRow, textControlGroup, textControlGrid, textControlChoices } from './text-control-ui.ts';
import { t } from '../i18n.ts';
export function mountTextFrameControls(root: HTMLElement, read: () => TextFrameV1, linked: () => boolean, write: (value: Partial<TextFrameV1>) => void, appliedScale?: () => number) {
  if (read().mode === 'path') return mountTextPathControls(root, read, write);
  const body = document.createElement('div'); root.append(body);
  const updates: Array<(frame: TextFrameV1) => void> = [];
  const number = (parent: HTMLElement, label: string, value: (frame: TextFrameV1) => number, change: (value: number) => Partial<TextFrameV1>, min = 0, max = 100000, step = '.1') => {
    const field = textControlNumber(parent, label, { value: value(read()), min, max, step: Number(step), onCommit: value => write(change(value)) });
    updates.push(frame => field.set(value(frame))); return field.input;
  };
  const check = (parent: HTMLElement, label: string, value: (frame: TextFrameV1) => boolean, change: (checked: boolean) => Partial<TextFrameV1>) => {
    const input = document.createElement('input'); input.type = 'checkbox'; input.className = 'field-check'; input.addEventListener('change', () => write(change(input.checked)));
    textControlRow(parent, label, input); updates.push(frame => { input.checked = value(frame); }); return input;
  };
  const mode = document.createElement('select');
  for (const [value, name] of [['auto-width', t('Auto width')], ['auto-height', t('Auto height')], ['fixed', t('Fixed frame')]]) mode.add(new Option(name, value));
  mode.addEventListener('change', () => write({ mode: mode.value as TextFrameV1['mode'], ...(mode.value === 'fixed' ? {} : { shrink: undefined }) })); textControlRow(body, t('Text frame'), mode);
  updates.push(frame => { mode.value = frame.mode; for (const option of mode.options) option.disabled = option.value !== 'fixed' && (linked() || frame.columns.count > 1); });
  const dimensions = textControlGrid(body);
  number(dimensions, t('Frame width'), frame => frame.width, width => ({ width, ...(read().mode === 'auto-width' ? { mode: 'auto-height' } : {}) }), .1);
  number(dimensions, t('Frame height'), frame => frame.height, height => ({ height, mode: 'fixed' }), .1);
  const vertical = textControlChoices(body, t('Vertical alignment'), [['top', t('Top'), 'alignT'], ['center', t('Centre'), 'alignM'], ['bottom', t('Bottom'), 'alignB']], () => read().verticalAlign, value => write({ verticalAlign: value as TextFrameV1['verticalAlign'] }));
  updates.push(() => vertical.refresh());
  check(body, t('Wrap around objects'), frame => frame.honorWrap !== false, honorWrap => ({ honorWrap }));

  const insets = textControlGrid(textControlGroup(body, t('Insets')));
  for (const [edge, label] of [['top', t('Top inset')], ['right', t('Right inset')], ['bottom', t('Bottom inset')], ['left', t('Left inset')]] as const)
    number(insets, label, frame => frame.inset[edge], value => ({ inset: { ...read().inset, [edge]: value } }));
  const columns = textControlGroup(body, t('Columns')), columnNumbers = textControlGrid(columns);
  number(columnNumbers, t('Columns'), frame => frame.columns.count, count => ({ columns: { ...read().columns, count }, ...(count > 1 ? { mode: 'fixed' } : {}) }), 1, 32, '1');
  const gutter = number(columnNumbers, t('Column gutter'), frame => frame.columns.gutter, gutter => ({ columns: { ...read().columns, gutter } }));
  const balance = check(columns, t('Balance final columns'), frame => frame.columns.balance, balance => ({ columns: { ...read().columns, balance } }));
  updates.push(frame => { balance.disabled = gutter.disabled = frame.columns.count < 2; });

  const fitting = textControlGroup(body, t('Text fitting'));
  const shrink = check(fitting, t('Shrink to fit'), frame => !!frame.shrink, enabled => ({ shrink: enabled ? { minSize: 8 } : undefined }));
  const minimum = number(fitting, t('Minimum text size'), frame => frame.shrink?.minSize ?? 8, minSize => ({ shrink: { minSize } }), 1, 1000);
  const scale = document.createElement('output'); const scaleRow = textControlRow(fitting, t('Applied text scale'), scale);
  updates.push(frame => { shrink.disabled = linked() || frame.mode !== 'fixed'; minimum.disabled = !frame.shrink || shrink.disabled; scaleRow.hidden = !frame.shrink; scale.textContent = `${Math.round((appliedScale?.() ?? 1) * 1000) / 10}%`; });

  const baselines = textControlGroup(body, t('Baseline grid'));
  number(baselines, t('Minimum first baseline'), frame => frame.firstBaseline ?? 0, firstBaseline => ({ firstBaseline }));
  check(baselines, t('Frame baseline grid'), frame => !!frame.grid, enabled => ({ grid: enabled ? { step: 24, offset: read().inset.top } : undefined }));
  const gridNumbers = textControlGrid(baselines);
  const gridStep = number(gridNumbers, t('Grid step'), frame => frame.grid?.step ?? 24, step => ({ grid: { step, offset: read().grid?.offset ?? 0 } }), .1);
  const gridOffset = number(gridNumbers, t('Grid offset'), frame => frame.grid?.offset ?? 0, offset => ({ grid: { step: read().grid?.step ?? 24, offset } }), -100000);
  updates.push(frame => { gridStep.disabled = gridOffset.disabled = !frame.grid; });
  function refresh() { const frame = read(); for (const update of updates) update(frame); }
  styleTextControls(body); refresh(); return { refresh };
}
