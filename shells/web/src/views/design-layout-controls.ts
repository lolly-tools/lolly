// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
// Adapted from Penpot's modern layout_container and layout_item sidebar menus.
import type { Box } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';
import { escape as esc } from '../utils.ts';
import { layoutIcon } from './design-layout-icons.ts';

export interface LayoutUiState {
  padding?: boolean;
  margin?: boolean;
  gap?: boolean;
  advanced?: boolean;
  grid?: boolean;
  column?: boolean;
  row?: boolean;
  placement?: string;
  placementSource?: string;
  trackOptions?: string[];
}
const uiStates = new WeakMap<ModelPort, Map<string, LayoutUiState>>();
export function layoutUi(model: ModelPort, ids: string[]): LayoutUiState {
  let states = uiStates.get(model);
  if (!states) {
    states = new Map();
    uiStates.set(model, states);
  }
  const key = JSON.stringify([...ids].sort());
  let state = states.get(key);
  if (!state) {
    state = {};
    states.set(key, state);
  }
  return state;
}
export function selectedRows(model: ModelPort, ids: string[]): Box[] {
  const selected = new Set(ids);
  return model.getBoxes().filter((row) => selected.has(String(row[model.cfg?.idField || 'id'])));
}
export function commonValue(rows: Box[], field: string, fallback: unknown): unknown {
  const values = rows.map((row) => row[field] ?? fallback);
  return values.every((value) => String(value) === String(values[0])) ? values[0] : undefined;
}
export interface LayoutChoice {
  value: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}
export function segments(
  rows: Box[],
  field: string,
  label: string,
  choices: LayoutChoice[],
  fallback: unknown,
  rotated = false
): string {
  const value = commonValue(rows, field, fallback);
  return `<div class="dl-segments" role="group" aria-label="${esc(label)}"${value === undefined ? ' data-layout-mixed="true"' : ''}>${choices.map((choice) => `<button type="button" class="dl-button${choice.icon ? '' : ' dl-text-button'}" data-layout-field="${esc(field)}" data-layout-value="${esc(choice.value)}" aria-label="${esc(choice.label)}" title="${esc(choice.label)}" aria-pressed="${value === undefined ? 'mixed' : String(String(value) === choice.value)}"${choice.disabled ? ' disabled' : ''}>${choice.icon ? layoutIcon(choice.icon, rotated) : esc(choice.label)}</button>`).join('')}</div>`;
}
export function iconChoices(values: string[], label: string, prefix: string): LayoutChoice[] {
  return values.map((value) => ({
    value,
    label: `${label} ${value.replace('space-', '')}`,
    icon: `${prefix}-${value.replace('space-', '')}`,
  }));
}
export function compactNumber(
  rows: Box[],
  key: string,
  fields: string[],
  label: string,
  icon: string,
  disabled = false,
  fallback = 0
): string {
  const values = fields.map((field) => commonValue(rows, field, fallback));
  const value = values.every((item) => item !== undefined && item === values[0]) ? values[0] : '';
  return `<label class="dl-number" title="${esc(label)}">${layoutIcon(icon)}<input type="number" min="0" max="10000000" step="any" data-layout-number="${esc(key)}" data-layout-fields="${fields.join(',')}" aria-label="${esc(label)}" value="${esc(String(value))}" placeholder="--"${disabled ? ' disabled' : ''}></label>`;
}
export function spacing(rows: Box[], type: 'padding' | 'margin', state: LayoutUiState): string {
  const prefix = type === 'padding' ? 'layoutPad' : 'layoutMargin';
  const isIndividual =
    state[type] ??
    ['Top', 'Left'].some(
      (side, index) =>
        commonValue(rows, `${prefix}${side}`, 0) !==
        commonValue(rows, `${prefix}${index ? 'Right' : 'Bottom'}`, 0)
    );
  const title = type === 'padding' ? 'Padding' : 'Margin';
  const paired =
    compactNumber(
      rows,
      `${type}-vertical`,
      [`${prefix}Top`, `${prefix}Bottom`],
      `Vertical ${type}`,
      `${type}-top-bottom`
    ) +
    compactNumber(
      rows,
      `${type}-horizontal`,
      [`${prefix}Left`, `${prefix}Right`],
      `Horizontal ${type}`,
      `${type}-left-right`
    );
  const individual = ['Top', 'Right', 'Bottom', 'Left']
    .map((side) =>
      compactNumber(
        rows,
        `${type}-${side.toLowerCase()}`,
        [`${prefix}${side}`],
        `${side} ${type}`,
        `${type}-${side.toLowerCase()}`
      )
    )
    .join('');
  return `<div class="dl-spacing" data-layout-spacing="${type}"><div class="dl-spacing-heading"><span>${title}</span><button type="button" class="dl-button" data-layout-ui="${type}" aria-label="Individual ${type}" title="Individual ${type}" aria-pressed="${isIndividual}">${layoutIcon('padding-extended')}</button></div><div class="dl-pair" data-layout-paired${isIndividual ? ' hidden' : ''}>${paired}</div><div class="dl-sides" data-layout-individual${isIndividual ? '' : ' hidden'}>${individual}</div></div>`;
}
export function commitLayoutPatch(
  model: ModelPort,
  ids: string[],
  patch: Record<string, unknown>
): void {
  const selected = new Set(ids),
    field = model.cfg?.idField || 'id';
  const boxes = model.getBoxes();
  if (ids.some((id) => !boxes.some((row) => String(row[field]) === id))) return;
  model.commit(
    boxes.map((row) => (selected.has(String(row[field])) ? ({ ...row, ...patch } as Box) : row))
  );
}
export function layoutFocusKey(node: HTMLElement): string | null {
  const d = node.dataset;
  if (d.layoutField)
    return `[data-layout-field="${esc(d.layoutField)}"][data-layout-value="${esc(d.layoutValue || '')}"]`;
  if (d.layoutNumber) return `[data-layout-number="${esc(d.layoutNumber)}"]`;
  if (d.layoutTrackId)
    return `[data-layout-track-id="${esc(d.layoutTrackId)}"][data-layout-track-${node.hasAttribute('data-layout-track-unit') ? 'unit' : 'value'}]`;
  return null;
}
