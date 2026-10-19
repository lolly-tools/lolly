// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - which declared formats a batch run can produce.
 *
 * Kept free of DOM and render imports so the render boundary (render-export.ts),
 * preflight and both format menus (formats.ts, grid.ts) share one rule.
 */

/**
 * Whether a batch run can produce this format. A SCORM course is not one render per
 * row: Export course in Projects builds the package from reviewed, ordered lessons,
 * and the export bridge has no `scorm` renderer, so Batch neither offers nor renders SCORM.
 */
export const batchCanRender = (format: string): boolean => format !== 'scorm';
