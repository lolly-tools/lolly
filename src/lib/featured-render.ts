// SPDX-License-Identifier: MPL-2.0
/**
 * Render gallery, featured and template previews through the real export path.
 * Cache identity includes input values, resolved tokens, visible palette swatches,
 * theme and opted-in profile details. Build-time artwork cannot identify the user's
 * active palette, so it is never substituted for a render.
 */

// render-export (→ createRuntime → Handlebars + tool loader → Ajv) is imported LAZILY
// inside the render helpers below - the featured row mounts on the gallery landing, and
// a static import would pull the whole render engine onto the render-blocking boot chunk.
// The variant thumbnails render post-paint (the cross-fade builds up), so it loads then.
import { rasterToThumbnailDataUrl } from './raster-thumb.ts';
import { previewContextSignature } from './preview-context.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { PreviewsAPI } from '../bridge/previews.ts';

type FeaturedHost = HostV1 & { previews?: PreviewsAPI };

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

/** Read any blob to a data-URL as-is (used for SVG - no rasterise/downscale needed). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

/** Render one look at an exact format, cached by (tool, index, format). */
// In-flight renders, keyed by cache key and effective render signature. The featured hero row and the gallery
// carousel both call renderVariantAt for the same look during the post-load window;
// without this, each ~350ms offscreen render (+ main-thread raster) runs twice
// concurrently. Both callers share one promise; evicted on settle so failures retry.
const inflightByHost = new WeakMap<FeaturedHost, Map<string, Promise<string>>>();

async function renderVariantAt(
  host: FeaturedHost,
  toolId: string,
  format: string,
  variantIndex: number | string,
  values: Record<string, unknown>,
  keyPrefix = 'featured',
  previewTimeMs?: number,
): Promise<string> {
  // Format is part of the key: a tool that once cached a raster look and now renders
  // vector (svg) must not return the stale raster thumbnail on a matching `sig`. The
  // `keyPrefix` namespaces the cache: 'featured' for hero/example looks (numeric index),
  // 'template' for "New from template" previews (string template id) - the two can never
  // collide, so a template preview never disturbs a featured-variant record.
  const cacheKey = `${keyPrefix}:${toolId}:${variantIndex}:${format}`;
  const sig = JSON.stringify(previewTimeMs === undefined ? [values, await previewContextSignature(host)] : [values, await previewContextSignature(host), previewTimeMs]);
  const cached = await host.previews?.get(cacheKey).catch(() => null);
  if (cached && cached.sig === sig && cached.thumb) return cached.thumb;

  let inflight = inflightByHost.get(host);
  if (!inflight) { inflight = new Map(); inflightByHost.set(host, inflight); }
  const flightKey = `${cacheKey}:${sig}`;
  const hit = inflight.get(flightKey);
  if (hit) return hit;

  const p = (async () => {
    // Per-example dimensions: when a look declares width/height (as inputs, in its values),
    // render the preview at THAT aspect rather than the tool's native canvas - so a
    // reflow-first tool like color-block can showcase tall / wide / square / banner looks in
    // one strip. Absent or non-positive → native size (unchanged for every other tool).
    const vw = Number((values as { width?: unknown }).width);
    const vh = Number((values as { height?: unknown }).height);
    const dims = vw > 0 && vh > 0 ? { width: vw, height: vh } : {};
    const { renderRowToBlob } = await import('../pro/render-export.ts');
    const { blob } = await renderRowToBlob(
      // values arrives as JSON (Record<string, unknown>); the render row types it as
      // InputValue - the runtime coerces per the input's declared type, so cast the row.
      { toolId, values } as Parameters<typeof renderRowToBlob>[0],
      host,
      { format, watermark: false, embedMeta: false, thumbnail: true, previewPage: true, thumbAssets: true, previewTimeMs, ...dims },
    );
    // SVG is already display-ready and resolution-independent - embed it verbatim as a
    // data-URL. A raster blob is downscaled to a gallery-weight PNG thumbnail.
    const thumb = format === 'svg' ? await blobToDataUrl(blob) : await rasterToThumbnailDataUrl(blob);
    if (sig !== JSON.stringify(previewTimeMs === undefined ? [values, await previewContextSignature(host)] : [values, await previewContextSignature(host), previewTimeMs])) throw new Error('Preview brand changed during rendering');
    await host.previews?.put(cacheKey, { thumb, sig }).catch(() => { /* cache is best-effort */ });
    return thumb;
  })();
  inflight.set(flightKey, p);
  try { return await p; } finally { inflight.delete(flightKey); }
}

/**
 * Render (or reuse a cached) featured-tile variant and return a thumbnail data-URL.
 * `values` is the manifest variant's input map - seeded into the render exactly the
 * way URL params are. watermark/embedMeta are off: this is a showcase thumbnail, not
 * a deliverable.
 *
 * Vector-first: renders at displayFormatOf (SVG when the tool lists it). If that throws
 * - an svg-less tool, or one the HTML→SVG walker can't handle - and the tool also has a
 * raster format, it falls back to raster so the preview still shows rather than vanishing.
 */
export async function renderFeaturedVariant(
  host: FeaturedHost,
  toolId: string,
  formats: readonly string[] | undefined,
  variantIndex: number | string,
  values: Record<string, unknown>,
  keyPrefix = 'featured',
  previewTimeMs?: number,
): Promise<string> {
  // Build-time previews do not identify the user's effective tokens. Only a
  // render cached against the active brand can stand in for this render.
  const primary = displayFormatOf(formats);
  if (!primary) throw new Error(`no displayable export format for ${toolId}`);
  try {
    return await renderVariantAt(host, toolId, primary, variantIndex, values, keyPrefix, previewTimeMs);
  } catch (e) {
    const raster = rasterFormatOf(formats);
    if (primary === 'svg' && raster && raster !== primary) {
      return await renderVariantAt(host, toolId, raster, variantIndex, values, keyPrefix, previewTimeMs);
    }
    throw e;
  }
}

/**
 * Did this look src come from the preview MANIFEST - a same-origin file the browser
 * still has to fetch, and can therefore 404 - or from a live render, which is a
 * data-URL and cannot fail after it is set? While the bundle inlined its looks the
 * question didn't exist: every src was a data-URL. Callers use it to decide whether
 * an <img> needs the error path below.
 */
export function isManifestLook(src: string): boolean {
  return !src.startsWith('data:');
}

/** Compatibility entry point for callers recovering an older manifest image. */
export function renderMissingLook(
  host: FeaturedHost,
  toolId: string,
  formats: readonly string[] | undefined,
  variantIndex: number | string,
  values: Record<string, unknown>,
): Promise<string> {
  return renderFeaturedVariant(host, toolId, formats, variantIndex, values, 'featured-missing');
}

/** Render one page set at an exact format, cached as a JSON array of data-URLs. */
async function renderPagesAt(host: FeaturedHost, toolId: string, format: string): Promise<string[]> {
  const cacheKey = `featured:${toolId}:pages:${format}`;
  const sig = await previewContextSignature(host);
  const cached = await host.previews?.get(cacheKey).catch(() => null);
  if (cached?.thumb && cached.sig === sig) {
    try { const arr = JSON.parse(cached.thumb); if (Array.isArray(arr) && arr.length) return arr; } catch { /* re-render */ }
  }
  const { renderToolPages } = await import('../pro/render-export.ts');
  const { pages } = await renderToolPages(
    { toolId, values: {} } as Parameters<typeof renderToolPages>[0],
    host,
    { format, thumbnail: true, thumbAssets: true },
  );
  const urls: string[] = [];
  for (const blob of pages) urls.push(format === 'svg' ? await blobToDataUrl(blob) : await rasterToThumbnailDataUrl(blob));
  if (sig !== await previewContextSignature(host)) throw new Error('Preview brand changed during rendering');
  // Stash the whole array under one synthetic key (distinct from the per-variant keys).
  await host.previews?.put(cacheKey, { thumb: JSON.stringify(urls), sig }).catch(() => { /* best-effort */ });
  return urls;
}

/**
 * Render (or reuse cached) previews of EVERY PAGE of a paged tool (render.paged) and
 * return one data-URL per page. Vector-first with the same raster fallback as
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
  try {
    return await renderPagesAt(host, toolId, primary);
  } catch (e) {
    const raster = rasterFormatOf(formats);
    if (primary === 'svg' && raster && raster !== primary) {
      return await renderPagesAt(host, toolId, raster);
    }
    throw e;
  }
}
