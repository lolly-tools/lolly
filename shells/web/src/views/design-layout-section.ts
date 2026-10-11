// SPDX-License-Identifier: MPL-2.0
import { parseLayoutTrack } from '@lolly/engine';
import { ulid } from '../lib/row-id.ts';
import { escape as htmlEscape } from '../utils.ts';
import { t } from '../i18n.ts';
import type { Box } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';
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
export function layoutSectionRows(
  b: Box,
  model: ModelPort,
  c: Controls,
  ids: string[] = [String(b.id)]
): string {
  const options = (values: string[]) =>
    values.map((value) => ({
      value,
      label:
        value === 'hug'
          ? 'Content'
          : value === 'fill'
            ? 'Fill'
            : value === 'fixed'
              ? 'Fixed'
              : value,
    }));
  const select = (label: string, field: string, values: string[], fallback: string) =>
    c.selectRow(t(label), field, b[field] || fallback, options(values));
  const num = (label: string, field: string) =>
    c.numRow(t(label), field, Number(b[field] || 0), {
      min: ['layoutX', 'layoutY', 'layoutAngle'].includes(field) ? -1e7 : 0,
      max: 1e7,
    });
  const all = model.getBoxes();
  let html = select('Layout', 'layout', ['none', 'flex', 'grid'], 'none');
  if (b.layout === 'flex' || b.layout === 'grid') {
    html += select(
      'Direction',
      'layoutDirection',
      b.layout === 'grid' ? ['row', 'column'] : ['row', 'row-reverse', 'column', 'column-reverse'],
      'row'
    );
    if (b.layout === 'flex')
      html += c.toggleRow('Wrap', 'layoutWrap', b.layoutWrap === true || b.layoutWrap === 'true');
    html += num('Column gap', 'layoutGapX') + num('Row gap', 'layoutGapY');
    for (const side of ['Top', 'Right', 'Bottom', 'Left'])
      html += num(`${side} padding`, `layoutPad${side}`);
    html += select('Align items', 'layoutAlign', ['start', 'center', 'end', 'stretch'], 'start');
    html += select(
      'Align content',
      'layoutAlignContent',
      ['start', 'center', 'end', 'stretch', 'space-between', 'space-around', 'space-evenly'],
      'start'
    );
    html += select(
      'Distribute',
      'layoutJustify',
      ['start', 'center', 'end', 'stretch', 'space-between', 'space-around', 'space-evenly'],
      'start'
    );
    if (b.layout === 'grid') {
      html += select(
        'Justify items',
        'layoutJustifyItems',
        ['start', 'center', 'end', 'stretch'],
        'start'
      );
      const tracks = model.getInput('layoutTracks');
      for (const axis of ids.length === 1 ? ['column', 'row'] : []) {
        const value = (Array.isArray(tracks) ? tracks : [])
          .filter((t) => t.container === b.id && t.axis === axis)
          .sort((a, b) => Number(a.order) - Number(b.order))
          .map((t) => t.track)
          .join(' ');
        html += `<label class="fc-row"><span>${axis === 'column' ? 'Columns' : 'Rows'}</span><input data-layout-tracks="${axis}" value="${htmlEscape(value)}" placeholder="${axis === 'column' ? '1fr 1fr' : 'auto'}" aria-label="Grid ${axis} tracks"></label>`;
      }
    }
  }
  const descendants = new Set(ids),
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
  html += c.selectRow(t('Container'), 'layoutOwner', b.layoutOwner || '', [
    { value: '', label: t('Free placement') },
    ...all
      .filter((r) => !descendants.has(String(r.id)) && (r.layout === 'flex' || r.layout === 'grid'))
      .map((r) => ({ value: String(r.id), label: String(r.name || r.id) })),
  ]);
  if (b.layoutOwner || b.layout === 'flex' || b.layout === 'grid') {
    html +=
      select('Width', 'layoutW', ['fixed', 'hug', 'fill'], 'fixed') +
      select('Height', 'layoutH', ['fixed', 'hug', 'fill'], 'fixed');
    for (const axis of ['W', 'H'])
      html +=
        num(`Min ${axis === 'W' ? 'width' : 'height'}`, `layoutMin${axis}`) +
        c.textRow(
          `Max ${axis === 'W' ? 'width' : 'height'}`,
          `layoutMax${axis}`,
          b[`layoutMax${axis}`] ?? ''
        );
  }
  if (b.layoutOwner) {
    html +=
      num('Flow order', 'layoutOrder') +
      c.toggleRow(
        'Absolute placement',
        'layoutAbsolute',
        b.layoutAbsolute === true || b.layoutAbsolute === 'true'
      );
    if (b.layoutAbsolute === true || b.layoutAbsolute === 'true')
      html += num('Local X', 'layoutX') + num('Local Y', 'layoutY');
    html += num('Local rotation', 'layoutAngle');
    for (const side of ['Top', 'Right', 'Bottom', 'Left'])
      html += num(`${side} margin`, `layoutMargin${side}`);
    html += select(
      'Align self',
      'layoutSelf',
      ['auto', 'start', 'center', 'end', 'stretch'],
      'auto'
    );
    if (all.find((r) => r.id === b.layoutOwner)?.layout === 'grid') {
      html += select(
        'Justify self',
        'layoutJustifySelf',
        ['auto', 'start', 'center', 'end', 'stretch'],
        'auto'
      );
      for (const field of ['Row', 'Column', 'RowSpan', 'ColumnSpan'])
        html += num(field.replace('Span', ' span'), `layout${field}`);
      html += c.textRow('Area', 'layoutArea', b.layoutArea || '');
    }
  }
  return html;
}
export function wireLayoutTracks(root: HTMLElement, model: ModelPort, ids: string[]): void {
  root.querySelectorAll<HTMLInputElement>('[data-layout-tracks]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.isConnected || ids.length !== 1) return;
      const values = input.value.trim().split(/\s+/).filter(Boolean);
      try {
        for (const value of values) parseLayoutTrack(value);
      } catch (e) {
        input.setCustomValidity((e as Error).message);
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      const axis = input.dataset.layoutTracks!,
        container = ids[0];
      const old = model.getInput('layoutTracks');
      const tracks = Array.isArray(old) ? old : [];
      const previous = tracks
        .filter((t) => t.container === container && t.axis === axis)
        .sort((a, b) => Number(a.order) - Number(b.order));
      model.setInput('layoutTracks', [
        ...tracks.filter((t) => t.container !== container || t.axis !== axis),
        ...values.map((track, order) => ({
          id: previous[order]?.id || ulid(),
          container,
          axis,
          order,
          track,
        })),
      ]);
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
