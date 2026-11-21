// SPDX-License-Identifier: MPL-2.0
/**
 * Gallery, featured and template previews, drawn through the real export path and
 * kept in the one preview store (plan 373).
 *
 * A look's picture is found by its recipe (lib/preview-recipe.ts: the tool and its
 * version, the values, the design-system context, the colourway and the poster
 * frame), so the featured row, a gallery cover and a template preview of the same
 * look share one entry and one render. A miss is drawn by the offscreen source of
 * the preview writer (lib/preview-render.ts) and stored. Build-time artwork cannot
 * identify the person's active palette, so it is never substituted for a render.
 */

// render-export (→ createRuntime → Handlebars + tool loader → Ajv) is imported LAZILY
// inside lib/preview-render.ts - the featured row mounts on the gallery landing, and
// a static import would pull the whole render engine onto the render-blocking boot
// chunk. The variant thumbnails render post-paint (the cross-fade builds up), so it
// loads then. A cache hit never loads it at all.
import { newWorkTokenSelection, type ColourwaySeedHost } from './colourway-seed.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

type FeaturedHost = HostV1;

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

/** Where the picture comes from and goes: the preview store and the offscreen
 *  writer. Replaced in tests, which have no IndexedDB and no render stage. */
export const previewSeams = {
  cached: async (key: string): Promise<string | null> => (await import('./preview-cache.ts')).cachedPreview(key),
  store: async (key: string, picture: import('../bridge/preview-store.ts').PreparedPicture): Promise<string> => (await import('./preview-cache.ts')).storePreview(key, picture),
  render: async (...args: Parameters<typeof import('./preview-render.ts').renderLookPicture>) => (await import('./preview-render.ts')).renderLookPicture(...args),
};

// In-flight renders, keyed by recipe. The featured hero row and the gallery carousel
// both ask for the same look during the post-load window; without this, each ~350ms
// offscreen render (+ main-thread raster) runs twice concurrently. Both callers share
// one promise; evicted on settle so failures retry.
const inflight = new Map<string, Promise<string>>();

/** The recipe key of one look (exported for tests). */
export async function lookRecipe(host: FeaturedHost, toolId: string, values: Record<string, unknown>, previewTimeMs?: number, scope?: string): Promise<{ key: string; context: string; tokenSelection: unknown }> {
  const { previewContextDigest, previewRecipeKey, catalogToolVersion } = await import('./preview-recipe.ts');
  // A cover opens as the person's own colourway, so it is drawn in that colourway too.
  const tokenSelection = await newWorkTokenSelection(host as ColourwaySeedHost);
  const context = await previewContextDigest(host);
  const vw = Number((values as { width?: unknown }).width);
  const vh = Number((values as { height?: unknown }).height);
  const key = await previewRecipeKey({
    tool: toolId, version: catalogToolVersion(toolId), values, context,
    ...(tokenSelection ? { colourway: tokenSelection } : {}),
    ...(previewTimeMs !== undefined ? { frame: previewTimeMs } : {}),
    ...(vw > 0 && vh > 0 ? { size: { width: vw, height: vh } } : {}),
    ...(scope ? { scope } : {}),
  });
  return { key, context, tokenSelection };
}

/**
 * Render (or reuse a stored) preview of one look and return an `<img>` source: a
 * data URL for SVG, an object URL for a raster (lib/preview-urls.ts). `values` is
 * the look's input map - seeded into the render exactly the way URL params are.
 * watermark/embedMeta are off: this is a showcase picture, not a deliverable.
 *
 * Vector-first: renders at displayFormatOf (SVG when the tool lists it). If that throws
 * - an svg-less tool, or one the HTML→SVG walker can't handle - and the tool also has a
 * raster format, it falls back to raster so the preview still shows rather than vanishing.
 *
 * The store finds a picture by what was drawn, not by who asked: `variantIndex` and
 * the plain `keyPrefix` labels are the callers' own bookkeeping. A prefix that carries a
 * brand scope (`template@<tag>`, the template chooser's mounted brand slots) is part
 * of what was drawn, so it enters the recipe.
 */
export async function renderFeaturedVariant(
  host: FeaturedHost,
  toolId: string,
  formats: readonly string[] | undefined,
  _variantIndex: number | string,
  values: Record<string, unknown>,
  keyPrefix = 'featured',
  previewTimeMs?: number,
): Promise<string> {
  const primary = displayFormatOf(formats);
  if (!primary) throw new Error(`no displayable export format for ${toolId}`);
  const scope = keyPrefix.startsWith('template@') ? keyPrefix.slice('template@'.length) : undefined;
  const { key, context, tokenSelection } = await lookRecipe(host, toolId, values, previewTimeMs, scope);
  const hit = await previewSeams.cached(key);
  if (hit) return hit;
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    const vw = Number((values as { width?: unknown }).width);
    const vh = Number((values as { height?: unknown }).height);
    const opts = { tokenSelection: tokenSelection ?? undefined, previewTimeMs, recipe: key, ...(vw > 0 && vh > 0 ? { width: vw, height: vh } : {}) };
    let picture;
    try {
      picture = await previewSeams.render(host, toolId, primary, values, opts);
    } catch (e) {
      const raster = rasterFormatOf(formats);
      if (primary !== 'svg' || !raster || raster === primary) throw e;
      picture = await previewSeams.render(host, toolId, raster, values, opts);
    }
    // The brand changed while this rendered: the picture belongs to the old one.
    const { previewContextDigest } = await import('./preview-recipe.ts');
    if (context !== await previewContextDigest(host)) throw new Error('Preview brand changed during rendering');
    return previewSeams.store(key, picture);
  })();
  inflight.set(key, job);
  try { return await job; } finally { inflight.delete(key); }
}

/**
 * Could this look src fail after it is set? A data URL cannot. A manifest file can
 * 404, and an object URL can be revoked once it leaves the reader's map
 * (lib/preview-urls.ts), so both get the error path below, which draws the look
 * again (a store hit, normally, with a fresh URL).
 */
export function isManifestLook(src: string): boolean {
  return !src.startsWith('data:');
}

/** Compatibility entry point for callers recovering an older manifest image or a
 *  revoked object URL: the same look, found again by its recipe. */
export function renderMissingLook(
  host: FeaturedHost,
  toolId: string,
  formats: readonly string[] | undefined,
  variantIndex: number | string,
  values: Record<string, unknown>,
): Promise<string> {
  return renderFeaturedVariant(host, toolId, formats, variantIndex, values, 'featured-missing');
}

/**
 * Render (or reuse stored) previews of EVERY PAGE of a paged tool (render.paged) and
 * return one `<img>` source per page, each page stored as its own entry with the
 * page index in its recipe. Vector-first with the same raster fallback as
 * renderFeaturedVariant. Used by the gallery tile's preview strip so a multi-page doc
 * scrolls through its actual pages instead of one cramped all-pages thumbnail.
 */
export async function renderFeaturedPages(
  host: FeaturedHost,
  toolId: string,
  formats: readonly string[] | undefined,
): Promise<string[]> {
  const primary = displayFormatOf(formats);
  if (!primary) throw new Error(`no displayable export format for ${toolId}`);
  const { previewContextDigest, previewRecipeKey, catalogToolVersion } = await import('./preview-recipe.ts');
  const { cachedPreview, storePreview, cachedPageCount, storePageCount } = await import('./preview-cache.ts');
  const context = await previewContextDigest(host);
  const version = catalogToolVersion(toolId);
  const countKey = await previewRecipeKey({ tool: toolId, version, values: {}, context, frame: 'pages' });
  // The page count is kept as a tiny row of its own: a cached set needs no render
  // to know how many pages it has.
  const known = await cachedPageCount(countKey);
  if (known) {
    const srcs = await Promise.all(Array.from({ length: known }, async (_, page) => cachedPreview(await previewRecipeKey({ tool: toolId, version, values: {}, context, frame: page }))));
    if (srcs.every((src): src is string => !!src)) return srcs;
  }
  const { renderPagePictures } = await import('./preview-render.ts');
  let pictures;
  try {
    pictures = await renderPagePictures(host, toolId, primary);
  } catch (e) {
    const raster = rasterFormatOf(formats);
    if (primary !== 'svg' || !raster || raster === primary) throw e;
    pictures = await renderPagePictures(host, toolId, raster);
  }
  if (context !== await previewContextDigest(host)) throw new Error('Preview brand changed during rendering');
  const out: string[] = [];
  for (const [page, picture] of pictures.entries()) out.push(await storePreview(await previewRecipeKey({ tool: toolId, version, values: {}, context, frame: page }), picture));
  await storePageCount(countKey, out.length);
  return out;
}
