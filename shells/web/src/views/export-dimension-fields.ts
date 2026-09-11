// SPDX-License-Identifier: MPL-2.0

import { convertLength, roundIn } from '../lib/unit-steps.ts';

export interface ExportDimensionUpdate {
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
}

function field<T extends Element>(root: ParentNode, action: string): T | null {
  return root.querySelector<T>(`[data-action="${action}"]`);
}

/** Apply dimensions selected by a manifest option and return the effective unit. */
export function applyExportDimensionFields(
  root: ParentNode,
  currentUnit: string,
  update: ExportDimensionUpdate,
): string {
  const { width, height, unit, dpi } = update;
  const unitEl = field<HTMLSelectElement>(root, 'export-unit');
  const widthEl = field<HTMLInputElement>(root, 'export-width');
  const heightEl = field<HTMLInputElement>(root, 'export-height');
  let effectiveUnit = currentUnit;

  if (unitEl && unit) {
    if (unit !== currentUnit && width == null && height == null) {
      for (const input of [widthEl, heightEl]) {
        const value = Number.parseFloat(input?.value ?? '');
        if (input && value > 0) input.value = String(roundIn(convertLength(value, currentUnit, unit), unit));
      }
    }
    unitEl.value = unit;
    effectiveUnit = unit;
    const dpiField = root.querySelector<HTMLElement>('[data-dpi-field]');
    if (dpiField) dpiField.style.display = unit === 'px' ? 'none' : 'inline-flex';
  }

  if (widthEl && (width ?? 0) > 0) widthEl.value = String(width);
  if (heightEl && (height ?? 0) > 0) heightEl.value = String(height);
  const dpiEl = field<HTMLInputElement>(root, 'export-dpi');
  if (dpiEl && (dpi ?? 0) > 0) dpiEl.value = String(Math.round(dpi ?? 0));
  return effectiveUnit;
}

/** Preserve physical size when the export unit control changes directly. */
export function convertExportDimensionFields(root: ParentNode, from: string, to: string): void {
  for (const action of ['export-width', 'export-height']) {
    const input = field<HTMLInputElement>(root, action);
    const value = Number.parseFloat(input?.value ?? '');
    if (input && value > 0) input.value = String(roundIn(convertLength(value, from, to), to));
  }
  const dpiField = root.querySelector<HTMLElement>('[data-dpi-field]');
  if (dpiField) dpiField.style.display = to === 'px' ? 'none' : 'inline-flex';
}
