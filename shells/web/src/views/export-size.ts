// SPDX-License-Identifier: MPL-2.0
/**
 * Export-size select driver.
 *
 * A "size" select can drive the export dimensions: any select input whose options
 * carry width/height (+ optional unit) maps each option value to a physical export
 * size, so choosing e.g. "A6 landscape" actually sets the exported page size - not
 * just the on-canvas proportions. Kept in its own module (no DOM / flatpickr
 * imports) so the manifest→dims parsing is unit-testable; the shell wiring that
 * applies the dims to the export bar lives in tool.js.
 *
 * Returns { id, dims: { <optionValue>: { width, height, unit } } } or null when no
 * select carries dimensions. The first qualifying select wins (one per tool).
 */
import type { InputSpec } from '../../../../engine/src/inputs.ts';
import { canvasSizeOf, isUnit, toUnit } from '../../../../engine/src/units.ts';

/** The manifest slice this module reads. */
interface ExportSizeManifest {
  inputs?: InputSpec[];
}

export interface ExportSizeDims {
  width: number;
  height: number;
  unit: string;
}

export interface ExportSizeResult {
  id: string;
  dims: Record<string, ExportSizeDims>;
}

export function exportSizeDriver(manifest: ExportSizeManifest): ExportSizeResult | null {
  for (const input of manifest?.inputs ?? []) {
    if (input.type !== 'select' || !Array.isArray(input.options)) continue;
    const dims: Record<string, ExportSizeDims> = {};
    let any = false;
    for (const o of input.options) {
      if (o && o.width! > 0 && o.height! > 0) {
        dims[o.value] = { width: o.width!, height: o.height!, unit: o.unit || 'mm' };
        any = true;
      }
    }
    if (any) return { id: input.id, dims };
  }
  return null;
}

/**
 * Aspect-ratio guard. A tool may declare render.aspectWarning to flag page sizes
 * its layout isn't built for (e.g. a portrait-only document set to landscape).
 * aspect = width ÷ height; the warning fires when it falls outside the declared
 * [min, max] band (either bound optional). Editor-only - the message is shown
 * beside the dimension controls and never affects the rendered output.
 *
 * Returns the warning message when the given width/height trip the guard, else null.
 * A tiny epsilon keeps an exactly-on-the-bound size (e.g. a 1:1 square at max:1)
 * from tripping on floating-point dust.
 */
interface AspectWarningManifest {
  render?: {
    aspectWarning?: Record<string, unknown>;
  };
}

export function aspectWarning(manifest: AspectWarningManifest, width: number, height: number): string | null {
  const cfg = manifest?.render?.aspectWarning;
  if (!cfg || !(width > 0) || !(height > 0)) return null;
  const aspect = width / height;
  const tooWide = typeof cfg.max === 'number' && aspect > cfg.max + 1e-6;
  const tooTall = typeof cfg.min === 'number' && aspect < cfg.min - 1e-6;
  return (tooWide || tooTall) ? ((cfg.message as string) || 'This size may not suit this tool.') : null;
}

/** A size as a link or a saved session gives it: values in `unit`, DPI for a physical unit. */
export interface ExportSizeFields {
  width?: number | null;
  height?: number | null;
  unit?: string | null;
  dpi?: number | null;
}

/** Everything a link export's size can come from, strongest first. */
export interface LinkExportSizeSources {
  /** The link's reserved `width`/`height`/`unit`/`dpi`. A width or height here wins. */
  link: ExportSizeFields;
  /** The export size a reopened session saved (`__export_width` and the rest). */
  session: ExportSizeFields;
  /** The size select's option in force now, or null (no size select, or an option without dimensions). */
  option: ExportSizeDims | null;
  /** True when the size select holds a different option from the one the view opened with. */
  optionMoved: boolean;
  /** The tool's render box, CSS px. */
  render: { width: number; height: number };
}

/** The size to hand the export bridge, and the same size as the canvas size a tool lays out for. */
export interface LinkExportSize {
  /** A px number, or a value with its unit ("297mm"): the two forms export options take. */
  width: number | string;
  height: number | string;
  /** Raster DPI for a physical unit; absent for px. */
  dpi?: number;
  /** CSS px (engine canvasSizeOf), or null when a side is not a positive length. */
  canvas: { width: number; height: number } | null;
}

const positive = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const qualify = (v: number | string, unit: string): number | string =>
  typeof v === 'number' && unit !== 'px' ? `${v}${unit}` : v;

/**
 * The size a link export writes, matching what the export bar would show for the same
 * document (see linkExportSizeFor in views/tool/exporting.ts for the sources).
 *
 * - A link width or height wins, side by side, exactly as before: a side the link left
 *   out keeps the render box.
 * - Otherwise a size select that moved since the view opened decides, then a reopened
 *   session's saved size, then the select's option, then the render box. An option
 *   without dimensions (calendar-ics' month view) means the render box, as it does in
 *   the bar.
 * - A link `unit` with no width or height re-expresses that size in its unit, so
 *   `unit=px` writes a print size at screen pixels and `unit=in` keeps the paper size.
 * - DPI: the link's, then the session's, then 300, and only for a physical unit.
 *
 * Pure, so the precedence is tested without a browser.
 */
export function linkExportSize({ link, session, option, optionMoved, render }: LinkExportSizeSources): LinkExportSize {
  const renderBox: ExportSizeDims = { width: render.width, height: render.height, unit: 'px' };
  if (positive(link.width) || positive(link.height)) {
    const unit = link.unit || 'px';
    const width = positive(link.width) ? qualify(link.width, unit) : render.width;
    const height = positive(link.height) ? qualify(link.height, unit) : render.height;
    return {
      width, height,
      ...(unit !== 'px' ? { dpi: positive(link.dpi) ? link.dpi : 300 } : {}),
      canvas: canvasSizeOf(width, height, unit),
    };
  }
  const saved = positive(session.width) && positive(session.height)
    ? { width: session.width, height: session.height, unit: session.unit || 'px' }
    : null;
  let { width, height, unit } = optionMoved ? option ?? renderBox : saved ?? option ?? renderBox;
  const wanted = link.unit;
  const from = unit;
  if (wanted && wanted !== from && isUnit(wanted) && isUnit(from)) {
    const to = (v: number): number => Math.round(toUnit({ value: v, unit: from }, wanted) * 1e4) / 1e4;
    width = to(width);
    height = to(height);
    unit = wanted;
  }
  const dpi = positive(link.dpi) ? link.dpi : positive(session.dpi) ? session.dpi : 300;
  return {
    width: qualify(width, unit),
    height: qualify(height, unit),
    ...(unit !== 'px' ? { dpi } : {}),
    canvas: canvasSizeOf(width, height, unit),
  };
}
