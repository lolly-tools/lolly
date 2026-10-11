// SPDX-License-Identifier: MPL-2.0
/**
 * Which picture a small tile draws for an asset.
 *
 * A vector asset is drawn from its own SVG, not from the raster `thumb` a catalog
 * or a DAM ships beside it: the thumb is a small bitmap, so a crisp logo turned
 * into a soft one the moment a tile was bigger than the bitmap or the screen
 * was dense. The SVG is drawn through an <img>, never inlined, so its markup can
 * not run script or reach the network; that keeps a DAM's untrusted SVG inert.
 *
 * Two cases still prefer the raster thumb. An SVG heavier than SVG_TILE_MAX_BYTES
 * (a traced photo, an embedded bitmap) costs more to parse and paint than a tile
 * is worth, so the thumb draws instead when one exists. And when the SVG fails to
 * load at all, the thumb is swapped in by one document-level error listener, so
 * no tile is left broken while a smaller picture of the same asset is available.
 *
 * Everything else keeps today's rule: the small thumb when there is one, the
 * original otherwise.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { escapeHtml } from './html.ts';

/** Above this many bytes an SVG tile draws the raster thumb instead, when one exists. */
export const SVG_TILE_MAX_BYTES = 1.5 * 1024 * 1024;

export interface ThumbSources {
  /** The URL the tile draws first; empty when the asset has nothing drawable. */
  src: string;
  /** The URL to swap in when `src` fails to load; absent when nothing better exists. */
  fallback?: string;
  /** True when `src` is the asset's own SVG. */
  vector: boolean;
  /** Signed previews only; the ref's original URL stays unchanged. */
  srcset?: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function byteSize(ref: AssetRef): number | undefined {
  const size = ref.meta?.size ?? ref.meta?.bytes;
  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
}

/** True when the format the ref resolved to is SVG (pickFormat falls back to formats[0]). */
export function isSvgRef(ref: Pick<AssetRef, 'format'>): boolean {
  return String(ref.format ?? '').toLowerCase() === 'svg';
}

/**
 * A connected library's bytes are served per request through the instance, so a
 * tile URL carries the entry version it was listed at (`?v=`). The instance can
 * then let the browser keep those bytes for good, and a changed asset arrives
 * under a new URL. Only a plain `/catalog/ext/` URL is touched: one that already
 * carries a query (a file preview) is left as it is.
 */
export function versionedTileUrl(url: string, ref: Pick<AssetRef, 'version' | 'meta'>): string {
  const version = text(ref.version);
  if (!url || !version || !ref.meta?.provider || url.includes('?') || url.includes('#') || !url.includes('/catalog/ext/')) return url;
  return `${url}?v=${encodeURIComponent(version)}`;
}

export interface ThumbOptions {
  /** Draw a raster's small `thumb` rather than its original (default true). A
   *  surface that previews the exact bytes chosen (a treated photo is a new
   *  image whose thumb is still the untreated one) passes false. */
  preferThumb?: boolean;
  /** CSS width for responsive previews; defaults suit grid, card and list tiles. */
  sizes?: string;
}

function signedPreviews(ref: AssetRef): Array<{ url: string; width: number }> {
  if (ref.type !== 'raster' || ref.meta?.animated || !Array.isArray(ref.meta?.renditions)) return [];
  const checksum = text(ref.meta.originalChecksum);
  if (!/^sha256-[A-Za-z0-9+/]{43}=$/.test(checksum)) return [];
  let original: string;
  try { original = Array.from(atob(checksum.slice(7)), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''); } catch { return []; }
  const previews = ref.meta.renditions.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const r = value as Record<string, unknown>, url = text(r.url), width = dimension(r.width);
    if (r.of !== original || r.format !== 'webp' || !width || (ref.width && width > ref.width)
      || !/^sha256-[A-Za-z0-9+/]{43}=$/.test(text(r.checksum)) || !/^\/catalog\/[A-Za-z0-9._@/+,-]+\.[0-9a-f]{16}\.webp$/.test(url)) return [];
    return [{ url, width }];
  });
  return previews.sort((a, b) => a.width - b.width).filter((r, i, all) => !i || r.width !== all[i - 1]!.width);
}

/** The tile's source and its fallback, by the rules in the header above. */
export function thumbSources(ref: AssetRef, opts: ThumbOptions = {}): ThumbSources {
  const url = versionedTileUrl(text(ref.url), ref);
  const thumb = versionedTileUrl(text(ref.meta?.thumbUrl), ref);
  if (isSvgRef(ref) && url) {
    const size = byteSize(ref);
    if (thumb && size !== undefined && size > SVG_TILE_MAX_BYTES) return { src: thumb, vector: false };
    return { src: url, vector: true, ...(thumb && thumb !== url ? { fallback: thumb } : {}) };
  }
  const previews = opts.preferThumb === false ? [] : signedPreviews(ref);
  if (previews.length) return { src: (previews.find(p => p.width >= 640) ?? previews.at(-1)!).url,
    vector: false, srcset: previews.map(p => `${p.url} ${p.width}w`).join(', ') };
  return { src: (opts.preferThumb === false ? '' : thumb) || url, vector: false };
}

const dimension = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n) : undefined;
};

/**
 * The <img> for a tile: lazy, decoded off the main thread, with the asset's own
 * width and height as attributes so the box is reserved before the bytes arrive
 * (every tile class sizes the image in CSS, so the attributes only state the
 * aspect). `fallback`, when present, rides as data-thumb-fallback for the
 * document-level error listener.
 */
export function thumbImgHtml(ref: AssetRef, className: string, opts: ThumbOptions = {}): string {
  const { src, fallback, srcset } = thumbSources(ref, opts);
  const width = dimension(ref.width);
  const height = dimension(ref.height);
  const size = width && height ? ` width="${width}" height="${height}"` : '';
  if (fallback) installThumbFallback();
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async"${size}`
    + `${srcset ? ` srcset="${escapeHtml(srcset)}" sizes="${escapeHtml(opts.sizes ?? '(max-width: 640px) 45vw, 320px')}"` : ''}`
    + `${fallback ? ` data-thumb-fallback="${escapeHtml(fallback)}"` : ''}>`;
}

/**
 * Swap a failed tile image to its fallback, once. Exported for tests; the
 * listener installed below calls it for every image error in the document.
 */
export function swapToFallback(target: EventTarget | null): boolean {
  const img = target as HTMLImageElement | null;
  if (img?.tagName !== 'IMG') return false;
  const fallback = img.getAttribute('data-thumb-fallback');
  if (!fallback) return false;
  img.removeAttribute('data-thumb-fallback');
  img.src = fallback;
  return true;
}

let installed = false;
/** One capture-phase listener for the whole document: an image error does not
 *  bubble, but it does pass through the capture phase, and an inline onerror
 *  attribute would be refused by the shell's CSP. */
export function installThumbFallback(doc: Document | undefined = globalThis.document): void {
  if (installed || !doc) return;
  installed = true;
  doc.addEventListener('error', (event) => { swapToFallback(event.target); }, true);
}
