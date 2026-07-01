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
export { packQuery, unpackToken, expandQuery, hasPackedState, isPackAvailable, PACK_PARAM } from './url-pack.js';
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
// 1.4.0 — additive: live media. The optional `host.media` capability (a camera
// frame source) plus a new `onFrame` hook + runtime.startLive/stopLive let a tool
// react to a live camera stream frame-by-frame (e.g. a filter that responds to
// motion). Pure progressive enhancement: the hook is only driven where the shell
// provides host.media; a shell without it (or a tool without onFrame) is unaffected,
// and such tools keep working as ordinary still-image tools. No v1 method changed.
// 1.5.0 — additive: packed URL state. A whole readable query can be compressed into
// a single reserved `z` param (raw DEFLATE + base64url — url-pack.js: packQuery /
// unpackToken / expandQuery) so complex tools stay shareable past the ~2000-char URL
// ceiling. Pure URL-mode enhancement — no bridge/host method added or changed; the
// codec is native (CompressionStream) with graceful fallback to the readable form.
export const ENGINE_VERSION = '1.5.0';
