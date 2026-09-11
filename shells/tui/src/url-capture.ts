// SPDX-License-Identifier: MPL-2.0
/**
 * Thin re-export - url-shot's terminal capture moved to @lolly-tools/node-shell, shared
 * with the CLI (one capture path, no drift). Kept because engine-render.ts + bridge.ts
 * import this path; new code should import the package directly.
 */
export { captureUrl, captureParamsFrom } from '@lolly-tools/node-shell/url-capture';
export type { CaptureParams, CaptureDims } from '@lolly-tools/node-shell/url-capture';
