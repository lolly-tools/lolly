// SPDX-License-Identifier: MPL-2.0
/**
 * Pure helpers for describing a placed `<img>` in the artwork, shared by the
 * preflight stage collector (`stageFacts` in views/tool-actions.ts). DOM-free so
 * the decisions that used to be inline - and got them wrong - can be unit-tested.
 *
 * Two questions the collector asks of each image:
 *  1. What do we call it? (`placedImageLabel`)
 *  2. Is it a raster at all? (`isVectorImageSrc` - a vector must not be measured
 *     for effective DPI; it is resolution-independent and carries through export
 *     as vector, so "N DPI, will look soft" is always a false positive for it.)
 */

/**
 * A human label for a placed image.
 *
 * `alt`/`aria-label` win. Otherwise a filename is derived from the src - but ONLY
 * for a real path-bearing URL. A `data:`/`blob:` src has no filename: splitting a
 * data URI on '/' returns the base64 tail (the mime type carries a '/', e.g.
 * `image/svg+xml`), which used to land verbatim inside a preflight finding as a
 * wall of base64. Those schemes fall straight through to `fallback`.
 */
export function placedImageLabel(
  alt: string | null | undefined,
  ariaLabel: string | null | undefined,
  src: string,
  fallback = 'An image',
): string {
  const fromSrc = /^(?:data|blob):/i.test(src) ? '' : (src.split('/').pop()?.split(/[?#]/)[0] ?? '');
  return alt || ariaLabel || fromSrc || fallback;
}

/**
 * Whether an `<img>` src is a vector (SVG), from the two signals available on the
 * live element: a `data:image/svg+xml` payload, or a URL whose path ends `.svg`.
 *
 * A `blob:` object URL carries no type in the string, so an SVG served that way is
 * reported false (unknowable, not vector) - the caller then measures it, which is
 * the pre-existing behaviour and never worse than before. The common artwork cases
 * (a catalog `.svg` asset, an inlined `data:image/svg+xml` mark) are both caught.
 */
export function isVectorImageSrc(src: string): boolean {
  if (/^data:image\/svg\+xml[;,]/i.test(src)) return true;
  const path = src.split(/[?#]/)[0] ?? '';
  return /\.svg$/i.test(path);
}
