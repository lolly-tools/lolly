// SPDX-License-Identifier: MPL-2.0
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
export { parseUrlState, serializeUrlState, RESERVED } from './url-mode.js';
export { parseEmbedUrl } from './embed.js';
export { parseToolUrl, buildEmbedUrl, isToolUrl } from './tool-url.js';
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
export { parseSvgPath, parseSvgPathArgs, svgArcToBeziers } from './svg-path.js';
export {
  parseCssLength, cornerRadii, uniformRadius, insetCorners, roundedRectPath, parseBoxShadow,
} from './css-box.js';
export { emitEmf } from './emf.js';
export { emitEps } from './eps.js';
export {
  createTokenSet, resolveColorValue, colorToHex,
  isAlias, aliasPath, isTokenValue, TOKEN_EXT,
} from './tokens.js';

// 1.1.0 — additive: `file` input type, the transform output path
// (host.export.file + the `exportFile` hook + runtime.exportFile), and the
// `privacy: 'on-device'` utility marker. All backwards-compatible with ^1.0.0
// tools; no v1 method was removed or changed.
// 1.2.0 — additive: tool composition / nested renders — the optional
// `host.compose` capability + manifest `composes` (rendered via resolveNestedRenders
// into `{{asset <id>}}` extras). Backwards-compatible; shells without compose just
// don't resolve composes (the {{#if}} slot stays empty).
// 1.3.0 — additive: end-user tool-as-image. A Lolly tool URL (share link / embed
// URL) pasted into the asset picker becomes an asset whose `id` is the canonical
// embed URL; the runtime re-renders it on load via the new optional
// `host.compose.renderUrl` (see tool-url.js). Backwards-compatible; a shell
// without renderUrl simply leaves such an asset blank.
export const ENGINE_VERSION = '1.3.0';
