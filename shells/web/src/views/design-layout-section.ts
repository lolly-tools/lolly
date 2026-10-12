// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
// Adapted from Penpot's modern layout_container, layout_item and grid_cell menus.
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import type { Box } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';
import {
  compactNumber,
  commitLayoutPatch,
  iconChoices,
  layoutUi,
  segments,
  selectedRows,
  spacing,
  commonValue,
} from './design-layout-controls.ts';
import { gridTrackEditor, rawGridTracks, wireLayoutTracks } from './design-layout-tracks.ts';
export { wireLayoutTracks } from './design-layout-tracks.ts';
export { layoutFocusKey } from './design-layout-controls.ts';
export const LAYOUT_FIELDS = [
  'layout',
  'layoutOwner',
  'layoutOrder',
  'layoutDirection',
  'layoutWrap',
  'layoutGapX',
  'layoutGapY',
  'layoutPadTop',
  'layoutPadRight',
  'layoutPadBottom',
  'layoutPadLeft',
  'layoutAlign',
  'layoutAlignContent',
  'layoutJustify',
  'layoutJustifyItems',
  'layoutW',
  'layoutH',
  'layoutMinW',
  'layoutMaxW',
  'layoutMinH',
  'layoutMaxH',
  'layoutMarginTop',
  'layoutMarginRight',
  'layoutMarginBottom',
  'layoutMarginLeft',
  'layoutAbsolute',
  'layoutX',
  'layoutY',
  'layoutAngle',
  'layoutSelf',
  'layoutJustifySelf',
  'layoutRow',
  'layoutColumn',
  'layoutRowSpan',
  'layoutColumnSpan',
  'layoutArea',
];
export interface Controls {
  selectRow(
    label: string,
    field: string,
    value: unknown,
    options: Array<{ value: string; label: string }>
  ): string;
  toggleRow(label: string, field: string, value: boolean): string;
  numRow(label: string, field: string, value: number, options?: Record<string, unknown>): string;
  textRow(label: string, field: string, value: unknown): string;
}
const align = ['start', 'center', 'end'];
const distribute = [...align, 'space-between', 'space-around', 'space-evenly'];
function containerRows(b: Box, model: ModelPort, ids: string[], rows: Box[]): string {
  const grid = b.layout === 'grid',
    state = layoutUi(model, ids);
  const vertical = String(b.layoutDirection || 'row').startsWith('column');
  const axis = vertical ? 'column' : 'row';
  const directions = (
    grid ? ['row', 'column'] : ['row', 'row-reverse', 'column', 'column-reverse']
  ).map((value) => ({
    value,
    label: `Direction ${value}`,
    icon: value === 'row' ? 'grid-row' : value,
  }));
  const alignment = segments(
    rows,
    'layoutAlign',
    'Align items',
    iconChoices(align, 'Align items', `align-items-${axis}`),
    'start'
  );
  const direction = segments(rows, 'layoutDirection', 'Direction', directions, 'row');
  const wrap = segments(
    rows,
    'layoutWrap',
    'Wrap',
    [{ value: 'true', label: 'Wrap', icon: 'wrap' }],
    false
  );
  const gridAlign = (horizontal: boolean, label: string) =>
    align.map((value, index) => ({
      value,
      label: `${label} ${value}`,
      icon: `align-self-${horizontal ? 'row' : 'column'}-${(horizontal ? ['left', 'center', 'right'] : ['top', 'center', 'bottom'])[index]}`,
    }));
  let html = grid
    ? `<div class="dl-first-row dl-grid-first-row">${direction}${segments(rows, 'layoutAlign', 'Align items', gridAlign(false, 'Align items'), 'start')}${segments(rows, 'layoutJustifyItems', 'Justify items', gridAlign(true, 'Justify items'), 'start')}</div>`
    : `<div class="dl-first-row">${alignment}${direction}${wrap}</div>`;
  if (grid) {
    const gridDistribute = [...align, 'space-around', 'space-between', 'stretch'];
    html += `<div class="dl-distribution">${segments(rows, 'layoutAlignContent', 'Align content', iconChoices(gridDistribute, 'Align content', 'align-content-row'), 'start')}</div>`;
    html += `<div class="dl-distribution">${segments(rows, 'layoutJustify', 'Distribute', iconChoices(gridDistribute, 'Distribute', 'align-content-column'), 'start')}</div>`;
  } else {
    html += `<div class="dl-distribution">${segments(rows, 'layoutJustify', 'Distribute', iconChoices(distribute, 'Distribute', `justify-content-${axis}`), 'start')}</div>`;
    if (rows.some((row) => row.layoutWrap === true || row.layoutWrap === 'true'))
      html += `<div class="dl-distribution">${segments(rows, 'layoutAlignContent', 'Align content', iconChoices(distribute, 'Align content', `align-content-${axis}`), 'start')}</div>`;
  }
  const active = (gapAxis: string) =>
    grid ||
    rows.some(
      (row) =>
        row.layoutWrap === true ||
        row.layoutWrap === 'true' ||
        String(row.layoutDirection || 'row').startsWith('column') === (gapAxis === 'y')
    );
  html += `<div class="dl-spacing"><div class="dl-spacing-heading"><span>Gap</span><button type="button" class="dl-button dl-link" data-layout-ui="gap" aria-label="Uniform gap" title="Uniform gap" aria-pressed="${!!state.gap}"${!active('x') || !active('y') ? ' disabled' : ''}>${state.gap ? '↔' : '⇥'}</button></div><div class="dl-pair">${compactNumber(rows, 'gap-x', ['layoutGapX'], 'Column gap', 'gap-horizontal', !active('x'))}${compactNumber(rows, 'gap-y', ['layoutGapY'], 'Row gap', 'gap-vertical', !active('y'))}</div></div>`;
  html += spacing(rows, 'padding', state);
  if (grid) html += gridTrackEditor(model, ids);
  return html;
}
function dynamicOwner(box: Box, model: ModelPort): Box | undefined {
  return model
    .getBoxes()
    .find(
      (row) =>
        row.id === (box.layoutOwner || box.frame) &&
        (row.layout === 'flex' || row.layout === 'grid')
    );
}
function sizingRows(rows: Box[], model: ModelPort): string {
  const choices = (label: string) => [
    { value: 'fixed', label: `Fixed ${label}`, icon: 'fixed-width' },
    {
      value: 'fill',
      label: `Fill ${label}`,
      icon: 'fill-content',
      disabled: rows.some((row) => !dynamicOwner(row, model)),
    },
    { value: 'hug', label: `Hug ${label}`, icon: 'hug-content' },
  ];
  return `<div class="dl-sizing"><div class="dl-labeled-row"><span>Width</span>${segments(rows, 'layoutW', 'Width sizing', choices('width'), 'fixed')}</div><div class="dl-labeled-row"><span>Height</span>${segments(rows, 'layoutH', 'Height sizing', choices('height'), 'fixed', true)}</div></div>`;
}
function selfAlignment(rows: Box[], field: string, label: string, horizontal: boolean): string {
  const names = horizontal
    ? ['left', 'center', 'right', 'stretch']
    : ['top', 'center', 'bottom', 'stretch'];
  const choices = [...align, 'stretch'].map((value, index) => ({
    value,
    label: `${label} ${value}`,
    icon: `align-self-${horizontal ? 'row' : 'column'}-${names[index]}`,
  }));
  return `<div class="dl-labeled-row"><span>${label}</span>${segments(rows, field, label, choices, 'auto')}</div>`;
}
function gridPlacementRows(rows: Box[], model: ModelPort, ids: string[]): string {
  const state = layoutUi(model, ids);
  const source = JSON.stringify(
    rows.map((row) => [row.layoutRow, row.layoutColumn, row.layoutArea])
  );
  if (state.placementSource !== source) {
    state.placement = undefined;
    state.placementSource = undefined;
  }
  const inferred = (row: Box) =>
    row.layoutArea
      ? 'area'
      : Number(row.layoutRow) > 0 || Number(row.layoutColumn) > 0
        ? 'manual'
        : 'auto';
  const modes = rows.map(inferred),
    mode =
      state.placementSource === source && state.placement
        ? state.placement
        : modes.every((value) => value === modes[0])
          ? modes[0]
          : 'mixed';
  const buttons = ['auto', 'manual', 'area']
    .map(
      (value) =>
        `<button type="button" class="dl-button dl-text-button" data-layout-placement="${value}" aria-pressed="${mode === 'mixed' ? 'mixed' : mode === value}">${value[0]!.toUpperCase()}${value.slice(1)}</button>`
    )
    .join('');
  const coordinate = (axis: string, boundary: string) => {
    const field = `layout${axis}`,
      starts = rows.map((row) => Number(row[field]) || 1);
    const values = starts.map((start, index) =>
      boundary === 'end' ? start + (Number(rows[index]![`${field}Span`]) || 1) : start
    );
    const value = values.every((item) => item === values[0]) ? values[0] : '';
    return `<label class="dl-number"><span>${boundary}</span><input type="number" min="1" step="1" value="${value}" data-layout-coordinate="${axis.toLowerCase()}-${boundary}" aria-label="${axis} ${boundary}"></label>`;
  };
  return `<div class="dl-grid-placement"><div class="dl-segments" role="group" aria-label="Grid placement">${buttons}</div><label class="dl-area" data-layout-area${mode === 'area' ? '' : ' hidden'}>Area<input data-layout-area-name value="${esc(String(commonValue(rows, 'layoutArea', '') ?? ''))}" aria-label="Grid area name"></label><div data-layout-coordinates${mode === 'manual' || mode === 'area' ? '' : ' hidden'}><span class="dl-small-label">Columns</span><div class="dl-pair">${coordinate('Column', 'start')}${coordinate('Column', 'end')}</div><span class="dl-small-label">Rows</span><div class="dl-pair">${coordinate('Row', 'start')}${coordinate('Row', 'end')}</div></div></div>`;
}
function itemRows(b: Box, model: ModelPort, ids: string[], rows: Box[]): string {
  const owner = dynamicOwner(b, model),
    grid = owner?.layout === 'grid';
  let html = `<div class="dl-position">${segments(
    rows,
    'layoutAbsolute',
    'Position',
    [
      { value: 'false', label: 'Static' },
      { value: 'true', label: 'Absolute' },
    ],
    false
  )}</div>`;
  html += spacing(rows, 'margin', layoutUi(model, ids));
  if (grid) html += gridPlacementRows(rows, model, ids);
  const column = String(owner?.layoutDirection || 'row').startsWith('column');
  html += selfAlignment(rows, 'layoutSelf', 'Align self', grid ? false : column);
  if (grid) html += selfAlignment(rows, 'layoutJustifySelf', 'Justify self', true);
  return html;
}
function advancedRows(b: Box, model: ModelPort, c: Controls, ids: string[]): string {
  const all = model.getBoxes(),
    descendants = new Set(ids),
    pending = [...ids];
  for (let n = 0; n < pending.length; n++)
    for (const row of all)
      if (
        String(row.layoutOwner || row.frame || '') === pending[n] &&
        !descendants.has(String(row.id))
      ) {
        descendants.add(String(row.id));
        pending.push(String(row.id));
      }
  let html = c.selectRow(t('Container'), 'layoutOwner', b.layoutOwner || '', [
    { value: '', label: t('Free placement') },
    ...all
      .filter(
        (row) =>
          !descendants.has(String(row.id)) && (row.layout === 'flex' || row.layout === 'grid')
      )
      .map((row) => ({ value: String(row.id), label: String(row.name || row.id) })),
  ]);
  const num = (label: string, field: string) =>
    c.numRow(t(label), field, Number(b[field] || 0), {
      min: ['layoutX', 'layoutY', 'layoutAngle'].includes(field) ? -1e7 : 0,
      max: 1e7,
    });
  const select = (label: string, field: string, values: string[], fallback: string) =>
    c.selectRow(
      t(label),
      field,
      b[field] || fallback,
      values.map((value) => ({ value, label: value.replace('space-', '') }))
    );
  if (dynamicOwner(b, model) || b.kind === 'group' || b.layout === 'flex' || b.layout === 'grid')
    for (const axis of ['W', 'H'])
      html +=
        num(`Min ${axis === 'W' ? 'width' : 'height'}`, `layoutMin${axis}`) +
        c.textRow(
          `Max ${axis === 'W' ? 'width' : 'height'}`,
          `layoutMax${axis}`,
          b[`layoutMax${axis}`] ?? ''
        );
  if (b.layout === 'flex' || b.layout === 'grid') {
    html +=
      select('Align items', 'layoutAlign', [...align, 'stretch'], 'start') +
      select('Align content', 'layoutAlignContent', [...distribute, 'stretch'], 'start') +
      select('Distribute', 'layoutJustify', [...distribute, 'stretch'], 'start');
    if (b.layout === 'grid')
      html +=
        select('Justify items', 'layoutJustifyItems', [...align, 'stretch'], 'start') +
        rawGridTracks(model, ids);
  }
  if (dynamicOwner(b, model)) {
    html += num('Flow order', 'layoutOrder') + num('Local rotation', 'layoutAngle');
    if (b.layoutAbsolute === true || b.layoutAbsolute === 'true')
      html += num('Local X', 'layoutX') + num('Local Y', 'layoutY');
    if (dynamicOwner(b, model)?.layout === 'grid')
      for (const field of ['Row', 'Column', 'RowSpan', 'ColumnSpan'])
        html += num(field.replace('Span', ' span'), `layout${field}`);
  }
  return html;
}
export function layoutSectionRows(
  b: Box,
  model: ModelPort,
  c: Controls,
  ids: string[] = [String(b.id)]
): string {
  const rows = selectedRows(model, ids),
    state = layoutUi(model, ids);
  let html = segments(
    rows,
    'layout',
    'Layout',
    [
      { value: 'none', label: 'None' },
      { value: 'flex', label: 'Flex', disabled: rows.some(row => row.kind === 'group') },
      { value: 'grid', label: 'Grid', disabled: rows.some(row => row.kind === 'group') },
    ],
    'none'
  );
  if (b.layout === 'flex' || b.layout === 'grid') html += containerRows(b, model, ids, rows);
  if (dynamicOwner(b, model) || b.kind === 'group' || b.layout === 'flex' || b.layout === 'grid')
    html += sizingRows(rows, model);
  if (dynamicOwner(b, model)) html += itemRows(b, model, ids, rows);
  html += `<details class="dl-advanced" data-layout-advanced${state.advanced ? ' open' : ''}><summary>Advanced</summary>${advancedRows(b, model, c, ids)}</details>`;
  return `<div class="dl-section" data-layout-section>${html}</div>`;
}
function wireSpacing(root: HTMLElement, model: ModelPort, ids: string[]): void {
  const state = layoutUi(model, ids);
  root.querySelectorAll<HTMLButtonElement>('[data-layout-ui]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!button.isConnected || button.disabled || selectedRows(model, ids).length !== ids.length)
        return;
      const type = button.dataset.layoutUi as 'padding' | 'margin' | 'gap';
      state[type] = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(state[type]));
      if (type === 'gap') {
        button.textContent = state.gap ? '↔' : '⇥';
        return;
      }
      const group = button.closest<HTMLElement>('[data-layout-spacing]')!;
      group.querySelector<HTMLElement>('[data-layout-paired]')!.hidden = !!state[type];
      group.querySelector<HTMLElement>('[data-layout-individual]')!.hidden = !state[type];
    });
  });
  root.querySelectorAll<HTMLInputElement>('[data-layout-number]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.isConnected || input.disabled || !input.value.trim()) return;
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0 || value > 1e7) {
        input.setCustomValidity('Enter a number from 0 to 10000000.');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      const fields = input.dataset.layoutFields!.split(',');
      const otherGap = input.dataset.layoutNumber === 'gap-x' ? 'gap-y' : 'gap-x';
      if (
        state.gap &&
        input.dataset.layoutNumber!.startsWith('gap-') &&
        !root.querySelector<HTMLInputElement>(`[data-layout-number="${otherGap}"]`)?.disabled
      )
        fields.push(input.dataset.layoutNumber === 'gap-x' ? 'layoutGapY' : 'layoutGapX');
      commitLayoutPatch(model, ids, Object.fromEntries(fields.map((field) => [field, value])));
    });
  });
}
function wireGridPlacement(root: HTMLElement, model: ModelPort, ids: string[]): void {
  const state = layoutUi(model, ids);
  root.querySelectorAll<HTMLButtonElement>('[data-layout-placement]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!button.isConnected || selectedRows(model, ids).length !== ids.length) return;
      const mode = button.dataset.layoutPlacement!;
      state.placement = mode === 'area' ? mode : undefined;
      state.placementSource = JSON.stringify(
        selectedRows(model, ids).map((row) => [row.layoutRow, row.layoutColumn, row.layoutArea])
      );
      root.querySelectorAll<HTMLButtonElement>('[data-layout-placement]').forEach((node) => {
        node.setAttribute('aria-pressed', String(node === button));
      });
      root.querySelector<HTMLElement>('[data-layout-area]')!.hidden = mode !== 'area';
      root.querySelector<HTMLElement>('[data-layout-coordinates]')!.hidden = mode === 'auto';
      if (mode === 'auto')
        commitLayoutPatch(model, ids, { layoutRow: 0, layoutColumn: 0, layoutArea: '' });
      else if (mode === 'manual') {
        const selected = new Set(ids),
          idField = model.cfg?.idField || 'id';
        model.commit(
          model.getBoxes().map((row) =>
            selected.has(String(row[idField]))
              ? {
                  ...row,
                  layoutRow: Number(row.layoutRow) || 1,
                  layoutColumn: Number(row.layoutColumn) || 1,
                  layoutArea: '',
                }
              : row
          )
        );
      }
    });
  });
  root
    .querySelector<HTMLInputElement>('[data-layout-area-name]')
    ?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      if (input.isConnected) commitLayoutPatch(model, ids, { layoutArea: input.value });
    });
  root.querySelectorAll<HTMLInputElement>('[data-layout-coordinate]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.isConnected || !input.checkValidity() || !input.value) return;
      const [axis, boundary] = input.dataset.layoutCoordinate!.split('-'),
        field = `layout${axis === 'row' ? 'Row' : 'Column'}`;
      const selected = new Set(ids),
        idField = model.cfg?.idField || 'id',
        value = Number(input.value);
      if (!Number.isInteger(value) || value < 1 || selectedRows(model, ids).length !== ids.length)
        return;
      model.commit(
        model.getBoxes().map((row) =>
          selected.has(String(row[idField]))
            ? {
                ...row,
                [boundary === 'end' ? `${field}Span` : field]:
                  boundary === 'end' ? Math.max(1, value - (Number(row[field]) || 1)) : value,
              }
            : row
        )
      );
    });
  });
}
export function wireLayoutControls(root: HTMLElement, model: ModelPort, ids: string[]): void {
  const state = layoutUi(model, ids);
  wireLayoutTracks(root, model, ids);
  wireSpacing(root, model, ids);
  wireGridPlacement(root, model, ids);
  root
    .querySelector<HTMLDetailsElement>('[data-layout-advanced]')
    ?.addEventListener('toggle', (event) => {
      const details = event.currentTarget as HTMLDetailsElement;
      if (details.isConnected) state.advanced = details.open;
    });
  root.querySelectorAll<HTMLButtonElement>('[data-layout-field]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!button.isConnected || button.disabled || selectedRows(model, ids).length !== ids.length)
        return;
      const field = button.dataset.layoutField!;
      let value: unknown = button.dataset.layoutValue!;
      if (field === 'layoutWrap') value = button.getAttribute('aria-pressed') !== 'true';
      else if (field === 'layoutAbsolute') value = value === 'true';
      else if (
        ['layoutSelf', 'layoutJustifySelf'].includes(field) &&
        button.getAttribute('aria-pressed') === 'true'
      )
        value = 'auto';
      model.setField([...ids], field, value);
    });
  });
}
/** Adapt the existing inspector controls without adding another UI implementation. */
export function layoutInspectorControls(
  controls: Omit<Controls, 'selectRow'> & {
    selectRow(
      label: string,
      field: string,
      choices: Array<[string, string]>,
      value: unknown
    ): string;
  }
): Controls {
  return {
    ...controls,
    selectRow: (label, field, value, choices) =>
      controls.selectRow(
        label,
        field,
        choices.map((choice) => [choice.value, choice.label]),
        value
      ),
  };
}
export function layoutInspectorSignature(
  model: ModelPort,
  ids: string[],
  idField: string,
  nameField?: string
): unknown[] {
  const selected = new Set(ids),
    tracks = model.getInput('layoutTracks');
  return [
    Array.isArray(tracks) ? tracks.filter((track) => selected.has(String(track.container))) : [],
    model
      .getBoxes()
      .filter((row) => row.layout === 'flex' || row.layout === 'grid')
      .map((row) => [row[idField], row[nameField || 'name'], row.layout, row.layoutOwner]),
  ];
}
