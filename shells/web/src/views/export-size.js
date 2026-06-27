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
export function exportSizeDriver(manifest) {
  for (const input of manifest?.inputs ?? []) {
    if (input.type !== 'select' || !Array.isArray(input.options)) continue;
    const dims = {};
    let any = false;
    for (const o of input.options) {
      if (o && o.width > 0 && o.height > 0) {
        dims[o.value] = { width: o.width, height: o.height, unit: o.unit || 'mm' };
        any = true;
      }
    }
    if (any) return { id: input.id, dims };
  }
  return null;
}
