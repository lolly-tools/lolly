// SPDX-License-Identifier: MPL-2.0
/**
 * @lolly-tools/node-shell — shared plumbing for the Node shells (CLI + TUI).
 *
 * One implementation of the pieces both terminal shells need, so they cannot drift:
 *   repo-root.ts       — LOLLY_ROOT → marker walk → cwd repo-root resolution
 *   browsers.ts        — the scoped headless-Chromium launcher ("Tier B")
 *   webshell-render.ts — drive the built web shell for browser-only formats
 *   raster.ts          — the resvg SVG→PNG fast path ("Tier A") + the format split
 *   c2pa-opts.ts       — the export Content-Credentials payload (incl. profile author)
 *   text.ts            — host.text (HarfBuzz text-to-path), so DOM-free vector output
 *                        outlines text the same as the web shell
 *   render-integrity.ts — the fail-loud checkpoint: never write a broken file + exit 0
 *
 * Heavy deps (playwright-core, @resvg/resvg-js) are dynamically imported at point of
 * use, so importing this package never pulls a browser or a native module at startup.
 */
export { repoRoot } from './repo-root.ts';
export {
  INSTALL_BROWSERS_DIR, BrowserError, resolveBrowsersDir,
  getBrowser, browserInstalled, closeBrowser,
} from './browsers.ts';
export { renderViaWebShell, closeWebShell } from './webshell-render.ts';
export type { RenderDims } from './webshell-render.ts';
export { NODE_FORMATS, pxDims, rasterizeSvgToPng } from './raster.ts';
export type { PxDimsInput } from './raster.ts';
export { buildExportC2paOpts } from './c2pa-opts.ts';
export type { BuildExportC2paOpts, ExportC2paOpts } from './c2pa-opts.ts';
export { createNodeTextAPI } from './text.ts';
export { assertRenderOk, RenderIntegrityError } from './render-integrity.ts';
export type { HookErrorLike } from './render-integrity.ts';
export { captureUrl, captureParamsFrom } from './url-capture.ts';
export type { CaptureParams, CaptureDims } from './url-capture.ts';
