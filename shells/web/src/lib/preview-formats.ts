// SPDX-License-Identifier: MPL-2.0
/**
 * Which export format a preview of a tool is drawn in (plan 373). A leaf module,
 * shared by the gallery's previews (lib/featured-render.ts) and the preview writer's
 * offscreen source (lib/preview-render.ts), so neither imports the other.
 */

// Raster formats a featured tile can display as an <img>. A tool with none can
// still be featured - it just shows its committed preview with no live variants.
const RASTER_FORMATS = ['png', 'jpg', 'jpeg', 'webp'];

/** The first raster export format a tool declares, or null if it has none. */
export function rasterFormatOf(formats: readonly string[] | undefined): string | null {
  if (!Array.isArray(formats)) return null;
  return formats.find((f) => RASTER_FORMATS.includes(f)) ?? null;
}

/**
 * The format to render a preview look in. Lolly is vector-first, so SVG wins when a
 * tool exports it - the thumbnail stays crisp at any tile size, it works for vector-only
 * tools (e.g. multi-page-pdf, which has no raster format at all), and the vector export
 * path serialises the DOM instead of rasterising a canvas, so it renders even in a
 * backgrounded tab (no rAF-gated paint). Falls back to the first raster format, then null.
 */
export function displayFormatOf(formats: readonly string[] | undefined): string | null {
  if (!Array.isArray(formats)) return null;
  if (formats.includes('svg')) return 'svg';
  return rasterFormatOf(formats);
}

/**
 * The formats a gallery cover is drawn in. A tool that exports only video or documents can
 * state `galleryArt: "render"`: its first page is a real render, drawn as a PNG for the card,
 * and the tool's export list stays as it is. Every other tool draws in what it exports.
 */
export function coverFormats(tool: { formats?: readonly string[]; galleryArt?: 'render' | 'icon' }): readonly string[] | undefined {
  return tool.galleryArt === 'render' && !displayFormatOf(tool.formats) ? ['png'] : tool.formats;
}
