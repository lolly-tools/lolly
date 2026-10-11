// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
// Adapted from Penpot's grid-columns-row, grid-track-info and grid-layout-edition.
import { parseLayoutTrack } from '@lolly/engine';
import { ulid } from '../lib/row-id.ts';
import { escape as esc } from '../utils.ts';
import type { Box } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';
import { layoutIcon } from './design-layout-icons.ts';
import { layoutUi, selectedRows } from './design-layout-controls.ts';
import {
  addTrackPlacement,
  removeTrackPlacement,
  reorderTrackPlacement,
} from './design-layout-track-placement.ts';

function tracksFor(model: ModelPort, container: string, axis: string): Box[] {
  const tracks = model.getInput('layoutTracks');
  return (Array.isArray(tracks) ? (tracks as Box[]) : [])
    .filter((track) => track.container === container && track.axis === axis)
    .sort((a, b) => Number(a.order) - Number(b.order));
}
function trackParts(track: unknown): { unit: string; value: string } {
  try {
    const parsed = parseLayoutTrack(String(track));
    if (!['fixed', 'fr', 'auto', 'percent'].includes(parsed.kind))
      return { unit: 'custom', value: '' };
    return {
      unit: parsed.kind === 'fixed' ? 'px' : parsed.kind === 'percent' ? '%' : parsed.kind,
      value: parsed.kind === 'auto' ? '' : String(parsed.value),
    };
  } catch {
    return { unit: 'custom', value: '' };
  }
}
function trackRow(track: Box, axis: string, index: number, count: number, open: boolean): string {
  const { unit, value } = trackParts(track.track),
    id = esc(String(track.id));
  const attrs = `data-layout-axis="${axis}" data-layout-track-id="${id}"`;
  const title = `${axis === 'column' ? 'Column' : 'Row'} ${index + 1}`;
  const action = (name: string, label: string, icon: string, disabled = false) =>
    `<button type="button" class="dl-button dl-track-action" data-layout-track-action="${name}" ${attrs} aria-label="${label}" title="${label}"${disabled ? ' disabled' : ''}>${layoutIcon(icon, name === 'up' || name === 'down')}</button>`;
  return `<div class="dl-track"><div class="dl-track-input">${layoutIcon(axis === 'column' ? 'flex-vertical' : 'flex-horizontal')}<input type="number" min="0" step="any" data-layout-track-value ${attrs} aria-label="${title} size" value="${value}"${unit === 'auto' || unit === 'custom' ? ' disabled' : ''}><select data-layout-track-unit ${attrs} aria-label="${title} unit">${['fr', 'auto', 'px', '%', ...(unit === 'custom' ? ['custom'] : [])].map((choice) => `<option value="${choice}"${choice === unit ? ' selected' : ''}>${choice.toUpperCase()}</option>`).join('')}</select></div>${action('remove', `Remove ${title.toLowerCase()}`, 'remove')}<details class="dl-track-more" data-layout-track-options="${id}"${open ? ' open' : ''}><summary class="dl-button" aria-label="More ${title.toLowerCase()} options" title="More ${title.toLowerCase()} options">${layoutIcon('menu')}</summary><div class="dl-track-popover"><div class="dl-track-order">${action('up', `Move ${title.toLowerCase()} earlier`, 'column', index === 0)}${action('down', `Move ${title.toLowerCase()} later`, 'column-reverse', index === count - 1)}</div><label class="dl-track-expression">Expression<input data-layout-track-expression ${attrs} value="${esc(String(track.track))}" aria-label="${title} expression"></label></div></details></div>`;
}
export function gridTrackEditor(model: ModelPort, ids: string[]): string {
  if (ids.length !== 1) return '';
  const state = layoutUi(model, ids);
  return `<button type="button" class="dl-edit-grid" data-layout-edit-grid aria-expanded="${!!state.grid}">${state.grid ? 'Done editing grid' : 'Edit grid'}</button><div class="dl-grid-editor" data-layout-grid-editor${state.grid ? '' : ' hidden'}>${[
    'column',
    'row',
  ]
    .map((axis) => {
      const tracks = tracksFor(model, ids[0]!, axis);
      const title = axis === 'column' ? 'Columns' : 'Rows';
      return `<div class="dl-track-section"><details data-layout-track-section="${axis}"${state[axis as 'column' | 'row'] ? ' open' : ''}><summary><span>${title} ${tracks.length}</span><span class="dl-track-summary">${esc(tracks.map((track) => String(track.track)).join(', ') || 'Empty')}</span></summary><div class="dl-track-list">${tracks.map((track, index) => trackRow(track, axis, index, tracks.length, !!state.trackOptions?.includes(String(track.id)))).join('')}</div></details><button type="button" class="dl-button dl-add-track" data-layout-track-action="add" data-layout-axis="${axis}" aria-label="Add ${axis}" title="Add ${axis}">${layoutIcon('add')}</button></div>`;
    })
    .join('')}</div>`;
}
export function rawGridTracks(model: ModelPort, ids: string[]): string {
  if (ids.length !== 1) return '';
  return ['column', 'row']
    .map(
      (axis) =>
        `<label class="fc-row"><span>${axis === 'column' ? 'Column' : 'Row'} expressions</span><input data-layout-tracks="${axis}" value="${esc(
          tracksFor(model, ids[0]!, axis)
            .map((track) => String(track.track))
            .join(' ')
        )}" aria-label="Grid ${axis} tracks"></label>`
    )
    .join('');
}
function replaceAxis(
  model: ModelPort,
  container: string,
  axis: string,
  next: Box[],
  boxes?: Box[]
): void {
  const old = model.getInput('layoutTracks'),
    tracks = Array.isArray(old) ? (old as Box[]) : [];
  const layoutTracks = [
    ...tracks.filter((track) => track.container !== container || track.axis !== axis),
    ...next.map((track, order) => ({ ...track, order })),
  ];
  if (boxes) model.commit(boxes, { layoutTracks }, 'Edit grid tracks');
  else model.setInput('layoutTracks', layoutTracks);
}
function current(root: HTMLElement, node: HTMLElement, model: ModelPort, ids: string[]): boolean {
  return (
    root.isConnected &&
    node.isConnected &&
    ids.length === 1 &&
    selectedRows(model, ids)[0]?.layout === 'grid'
  );
}
function valid(input: HTMLInputElement | HTMLSelectElement, expression: string): boolean {
  try {
    parseLayoutTrack(expression);
    input.setCustomValidity('');
    return true;
  } catch (error) {
    input.setCustomValidity((error as Error).message);
    input.reportValidity();
    return false;
  }
}
function wireTypedTracks(root: HTMLElement, model: ModelPort, ids: string[]): void {
  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      '[data-layout-track-value], [data-layout-track-unit], [data-layout-track-expression]'
    )
    .forEach((input) => {
      input.addEventListener('change', () => {
        if (!current(root, input, model, ids)) return;
        const axis = input.dataset.layoutAxis!,
          tracks = tracksFor(model, ids[0]!, axis),
          track = tracks.find((row) => row.id === input.dataset.layoutTrackId);
        if (!track) return;
        const parts = trackParts(track.track);
        let expression = input.value;
        if (input.hasAttribute('data-layout-track-unit')) {
          if (input.value === 'custom') return;
          expression =
            input.value === 'auto'
              ? 'auto'
              : `${parts.value || (input.value === 'px' ? '100' : '1')}${input.value}`;
        } else if (input.hasAttribute('data-layout-track-value'))
          expression = `${input.value}${parts.unit}`;
        if (valid(input, expression))
          replaceAxis(
            model,
            ids[0]!,
            axis,
            tracks.map((row) => (row.id === track.id ? { ...row, track: expression } : row))
          );
      });
    });
}
function wireTrackActions(root: HTMLElement, model: ModelPort, ids: string[]): void {
  root.querySelectorAll<HTMLButtonElement>('[data-layout-track-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!current(root, button, model, ids) || button.disabled) return;
      const axis = button.dataset.layoutAxis!,
        action = button.dataset.layoutTrackAction!,
        tracks = tracksFor(model, ids[0]!, axis);
      const index = tracks.findIndex((track) => track.id === button.dataset.layoutTrackId);
      let boxes = model.getBoxes();
      if (action === 'add') {
        layoutUi(model, ids)[axis as 'column' | 'row'] = true;
        root.querySelector<HTMLDetailsElement>(`[data-layout-track-section="${axis}"]`)!.open =
          true;
        boxes = addTrackPlacement(boxes, ids[0]!, axis, tracks.length);
        tracks.push({
          id: ulid(),
          container: ids[0]!,
          axis,
          track: axis === 'column' ? '1fr' : 'auto',
        });
      } else if (index < 0) return;
      else if (action === 'remove') {
        tracks.splice(index, 1);
        boxes = removeTrackPlacement(boxes, ids[0]!, axis, index);
      } else {
        const to = index + (action === 'up' ? -1 : 1);
        if (to < 0 || to >= tracks.length) return;
        [tracks[index], tracks[to]] = [tracks[to]!, tracks[index]!];
        boxes = reorderTrackPlacement(boxes, ids[0]!, axis, index, to);
      }
      replaceAxis(model, ids[0]!, axis, tracks, boxes);
    });
  });
}
export function wireLayoutTracks(root: HTMLElement, model: ModelPort, ids: string[]): void {
  const state = layoutUi(model, ids);
  root
    .querySelector<HTMLButtonElement>('[data-layout-edit-grid]')
    ?.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      if (!current(root, button, model, ids)) return;
      state.grid = !state.grid;
      root.querySelector<HTMLElement>('[data-layout-grid-editor]')!.hidden = !state.grid;
      button.textContent = state.grid ? 'Done editing grid' : 'Edit grid';
      button.setAttribute('aria-expanded', String(state.grid));
    });
  root.querySelectorAll<HTMLDetailsElement>('[data-layout-track-section]').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (details.isConnected)
        state[details.dataset.layoutTrackSection as 'column' | 'row'] = details.open;
    });
  });
  root.querySelectorAll<HTMLDetailsElement>('[data-layout-track-options]').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (!details.isConnected) return;
      const trackId = details.dataset.layoutTrackOptions!;
      state.trackOptions = (state.trackOptions || []).filter((id) => id !== trackId);
      if (details.open) state.trackOptions.push(trackId);
    });
  });
  wireTypedTracks(root, model, ids);
  wireTrackActions(root, model, ids);
  root.querySelectorAll<HTMLInputElement>('[data-layout-tracks]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!current(root, input, model, ids)) return;
      const values = input.value.trim().split(/\s+/).filter(Boolean);
      if (!values.every((value) => valid(input, value))) return;
      input.setCustomValidity('');
      const axis = input.dataset.layoutTracks!,
        previous = tracksFor(model, ids[0]!, axis);
      replaceAxis(
        model,
        ids[0]!,
        axis,
        values.map((track, order) => ({
          id: previous[order]?.id || ulid(),
          container: ids[0]!,
          axis,
          track,
        }))
      );
    });
  });
}
