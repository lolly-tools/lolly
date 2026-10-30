// SPDX-License-Identifier: MPL-2.0

import { CSS_DPI, isPhysical, parseDimension, toPixels } from '@lolly/engine';
import { convertLength, roundIn } from '../lib/unit-steps.ts';

export interface ExportDimensionUpdate {
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
}

/** The export dimensions as the bridge receives them: plain px numbers, or unit strings. */
export interface ExportDimensionOpts {
  width?: number | string;
  height?: number | string;
  dpi?: number;
}

/**
 * The pixel size an export of these dimensions really renders at, or undefined when the
 * dimensions name no size at all (the bridge then measures the node on screen, which is
 * the preview size a reader already falls back to).
 *
 * Physical units become pixels at the export dpi, print's 300 when none was given: the
 * rule bridge/export-shared.ts applies, over the engine's own conversion, so a reader of
 * this number and the file it gets are talking about the same output.
 *
 * Today the one reader is the 3D studio, whose curve detail can follow the output size.
 */
export function exportPixelSize(
  dims: ExportDimensionOpts,
): { width: number; height: number } | undefined {
  const w = parseDimension(dims.width);
  const h = parseDimension(dims.height);
  if (!w && !h) return undefined;
  const dpi = (dims.dpi ?? 0) > 0 ? (dims.dpi ?? 0) : isPhysical(w) || isPhysical(h) ? 300 : CSS_DPI;
  const width = w ? toPixels(w, dpi) : 0;
  const height = h ? toPixels(h, dpi) : 0;
  // One side left blank takes the other one's value. The size is read for its longer
  // side, and a zero would read as "smaller than the preview" rather than "not given".
  return { width: width || height, height: height || width };
}

/**
 * Show or hide the DPI segment. The stylesheet's `:has()` rounding reads
 * `data-dpi-hidden`, never the inline style: an attribute selector on `style` inside any
 * `:has()` makes every inline style write in the document (the canvas chrome writes
 * dozens a frame while the view moves) schedule a `:has()` check on the ancestors, and
 * `html:has(...)` then restyles the whole page.
 */
function showDpiField(el: HTMLElement, shown: boolean): void {
  el.style.display = shown ? 'inline-flex' : 'none';
  el.toggleAttribute('data-dpi-hidden', !shown);
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
    if (dpiField) showDpiField(dpiField, unit !== 'px');
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
  if (dpiField) showDpiField(dpiField, to !== 'px');
}
