// SPDX-License-Identifier: MPL-2.0
/**
 * Is this tool a file transform (file in, bytes out) rather than a render?
 *
 * An `exportFile` hook usually marks a transform, but a rendering tool can also offer
 * an extra file action through that hook: Darkroom renders graded stills and uses
 * `exportFile` only to rebuild a layered PSD. Routing on the hook alone sent
 * `lolly run darkroom --export=jpg` down the transform path, which refused the format
 * and then tried the PSD rebuild. A tool that renders stills says so, with an
 * `exportStill` hook or an explicit `render.export: true`, and is not a transform.
 */
export function isFileTransform(manifest: {
  hooks?: { exportFile?: unknown; exportStill?: unknown } | null;
  render?: { export?: unknown } | null;
}): boolean {
  if (!manifest.hooks?.exportFile) return false;
  if (manifest.render?.export === true || manifest.hooks.exportStill) return false;
  return true;
}
