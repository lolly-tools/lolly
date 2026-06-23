/**
 * Engine public surface.
 *
 * Host shells (web/Tauri/CLI) import from here. Tools NEVER import from here —
 * tools talk to the host through the capability bridge passed to their hooks.
 */

export { loadTool } from './loader.js';
export { validateManifest } from './validate.js';
export { createRuntime } from './runtime.js';
export { hydrate, annotateTemplate } from './template.js';
export { buildInputModel } from './inputs.js';
export { parseUrlState, serializeUrlState } from './url-mode.js';
export { buildExportMeta } from './metadata.js';
export {
  UNITS, CSS_DPI, isUnit, parseDimension,
  toInches, isPhysical, toPixels, toPoints, toCssPx, toCssLength, toUnit,
} from './units.js';
export {
  srgbIccProfile, iccProfileBytes, COLOR_PROFILES,
  rgbToCmyk, cmykCondition, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION,
} from './color.js';
export {
  computePrintGeometry, cmykToRgbApprox, PRINT_MARK_DEFAULTS,
} from './print-marks.js';
export {
  createTokenSet, resolveColorValue, colorToHex,
  isAlias, aliasPath, isTokenValue, TOKEN_EXT,
} from './tokens.js';

// 1.1.0 — additive: `file` input type, the transform output path
// (host.export.file + the `exportFile` hook + runtime.exportFile), and the
// `privacy: 'on-device'` utility marker. All backwards-compatible with ^1.0.0
// tools; no v1 method was removed or changed.
export const ENGINE_VERSION = '1.1.0';
