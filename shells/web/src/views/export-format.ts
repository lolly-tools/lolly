// SPDX-License-Identifier: MPL-2.0
/**
 * Export-format select driver.
 *
 * A "mode" select can drive the export FORMAT bar: any select input whose options
 * carry a `formats` list narrows the download bar to that option's formats while it
 * is selected - so a unified filter tool's effect picker offers svg/pdf/emf on a
 * vector effect but only png/jpg on a raster one, while `render.formats` stays the
 * union (the superset the shell may ever show). The dual of exportSizeDriver, which
 * drives dimensions the same way; kept DOM-free so the manifest→formats parsing is
 * unit-testable, with the shell applying it via actionsApi.setFormats in tool.js.
 *
 * Returns { id, formats: { <optionValue>: string[] } } or null when no select
 * carries per-option formats. The first qualifying select wins (one per tool).
 */
import type { InputSpec } from '../../../../engine/src/inputs.ts';

/** The manifest slice this module reads. */
interface ExportFormatManifest {
  inputs?: InputSpec[];
}

export interface ExportFormatResult {
  id: string;
  formats: Record<string, string[]>;
}

export function exportFormatDriver(manifest: ExportFormatManifest): ExportFormatResult | null {
  for (const input of manifest?.inputs ?? []) {
    if (input.type !== 'select' || !Array.isArray(input.options)) continue;
    const formats: Record<string, string[]> = {};
    let any = false;
    for (const o of input.options) {
      const list = (o as { formats?: unknown }).formats;
      if (Array.isArray(list) && list.length) {
        formats[o.value] = list.map(String);
        any = true;
      }
    }
    if (any) return { id: input.id, formats };
  }
  return null;
}
