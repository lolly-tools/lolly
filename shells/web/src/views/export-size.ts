// SPDX-License-Identifier: MPL-2.0
/**
 * Export-size select driver.
 *
 * A "size" select can drive the export dimensions: any select input whose options
 * carry width/height (+ optional unit) maps each option value to a physical export
 * size, so choosing e.g. "A6 landscape" actually sets the exported page size — not
 * just the on-canvas proportions. Kept in its own module (no DOM / flatpickr
 * imports) so the manifest→dims parsing is unit-testable; the shell wiring that
 * applies the dims to the export bar lives in tool.js.
 *
 * Returns { id, dims: { <optionValue>: { width, height, unit } } } or null when no
 * select carries dimensions. The first qualifying select wins (one per tool).
 */
import type { InputSpec } from '@lolly/engine';

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
      if (o && typeof o.width === 'number' && o.width > 0 && typeof o.height === 'number' && o.height > 0) {
        dims[o.value] = { width: o.width, height: o.height, unit: o.unit || 'mm' };
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
 * [min, max] band (either bound optional). Editor-only — the message is shown
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

export function aspectWarning(
  manifest: AspectWarningManifest,
  width: number | undefined,
  height: number | undefined,
): string | null {
  const cfg = manifest?.render?.aspectWarning;
  if (!cfg || typeof width !== 'number' || typeof height !== 'number' || !(width > 0) || !(height > 0)) return null;
  const aspect = width / height;
  const tooWide = typeof cfg.max === 'number' && aspect > cfg.max + 1e-6;
  const tooTall = typeof cfg.min === 'number' && aspect < cfg.min - 1e-6;
  return (tooWide || tooTall) ? (typeof cfg.message === 'string' ? cfg.message : 'This size may not suit this tool.') : null;
}
