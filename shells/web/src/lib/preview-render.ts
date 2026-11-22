// SPDX-License-Identifier: MPL-2.0
/**
 * The offscreen source of the preview writer (plan 373, section 5.5): a tool id
 * with values, drawn through the same export path a batch render takes
 * (pro/render-export.ts), then encoded by the one rule in lib/preview-writer.ts.
 *
 * SVG first: a tool that exports SVG is drawn as SVG and kept as SVG, over the
 * per-picture limit too (no smaller form stays a vector). A tool with no SVG export
 * is drawn in its first raster format. The picture records which.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { PreparedPicture } from '../bridge/preview-store.ts';

export interface LookRenderOptions {
  tokenSelection?: unknown;
  /** The exact tool revision a saved session was made with (a sideloaded tool). */
  artifactDigest?: string;
  previewTimeMs?: number;
  width?: number;
  height?: number;
  /** The unit width and height are in (px when absent). */
  unit?: string;
  /** Raster resolution for a physical unit. */
  dpi?: number;
  recipe?: string;
}

/** Draw one look at an exact format and make it a picture. Throws when the render
 *  fails, so the caller can try the tool's other format. */
export async function renderLookPicture(host: HostV1, toolId: string, format: string, values: Record<string, unknown>, opts: LookRenderOptions = {}): Promise<PreparedPicture> {
  const { renderRowToBlob } = await import('../pro/render-export.ts');
  const writer = await import('./preview-writer.ts');
  const dims = opts.width && opts.height ? { width: opts.width, height: opts.height, ...(opts.unit ? { unit: opts.unit } : {}), ...(opts.dpi ? { dpi: opts.dpi } : {}) } : {};
  const { blob } = await renderRowToBlob(
    // values arrives as JSON (Record<string, unknown>); the render row types it as
    // InputValue - the runtime coerces per the input's declared type, so cast the row.
    { toolId, values, ...(opts.tokenSelection ? { tokenSelection: opts.tokenSelection } : {}), ...(opts.artifactDigest ? { artifactDigest: opts.artifactDigest } : {}) } as Parameters<typeof renderRowToBlob>[0],
    host,
    { format, watermark: false, embedMeta: false, thumbnail: true, previewPage: true, thumbAssets: true, previewTimeMs: opts.previewTimeMs, ...dims },
  );
  const facts = opts.recipe ? { recipe: opts.recipe } : {};
  if (format === 'svg') {
    // An SVG is kept as SVG, over the per-picture limit too: no smaller form stays a
    // vector, and builds before plan 373 kept these looks verbatim at any size. A
    // second, raster render of the tool here cost a phone seconds of main thread.
    const svg = await writer.svgPicture(blob, { ...facts, keepOverLimit: true });
    if (svg) return svg;
    throw new Error(`The SVG preview of ${toolId} could not be read.`);
  }
  const raster = await writer.rasterPicture(blob, facts);
  if (!raster) throw new Error(`The preview of ${toolId} could not be drawn.`);
  return raster;
}

/** Draw every page of a paged tool, one picture per page. */
export async function renderPagePictures(host: HostV1, toolId: string, format: string): Promise<PreparedPicture[]> {
  const { renderToolPages } = await import('../pro/render-export.ts');
  const writer = await import('./preview-writer.ts');
  const { pages } = await renderToolPages({ toolId, values: {} } as Parameters<typeof renderToolPages>[0], host, { format, thumbnail: true, thumbAssets: true });
  const out: PreparedPicture[] = [];
  for (const blob of pages) {
    const picture = format === 'svg'
      ? await writer.svgPicture(blob, { keepOverLimit: true })
      : await writer.rasterPicture(blob);
    if (!picture) throw new Error(`A page preview of ${toolId} could not be drawn.`);
    out.push(picture);
  }
  return out;
}

/** The longest side, in pixels, a redraw of a physical-size session is drawn at:
 *  twice the largest tile side, so the picture is sharp on a 2x screen. */
const REDRAW_LONG_SIDE = 1440;
const INCH: Record<string, number> = { in: 1, mm: 25.4, cm: 2.54, pt: 72 };

/**
 * The size a saved session was made at, for drawing it again: the same width,
 * height and unit, so the tool lays out for the same canvas and the picture has
 * the same shape. A physical size is drawn at a resolution that fills a tile on a
 * 2x screen, never above the session's own. Empty when the session kept the
 * tool's own size.
 */
export function sessionRenderSize(row: { outWidth?: number; outHeight?: number; unit?: string; dpi?: number }): Pick<LookRenderOptions, 'width' | 'height' | 'unit' | 'dpi'> {
  const { outWidth: width, outHeight: height } = row;
  if (!(width && width > 0 && height && height > 0)) return {};
  const unit = row.unit && row.unit in INCH ? row.unit : 'px';
  if (unit === 'px') return { width, height };
  const longest = Math.max(width, height) / INCH[unit]!;
  const dpi = Math.min(row.dpi && row.dpi > 0 ? row.dpi : 300, Math.max(72, Math.ceil(REDRAW_LONG_SIDE / longest)));
  return { width, height, unit, dpi };
}

/**
 * Draw a saved session again, for a tile whose picture is stale or missing: the
 * session's own values and size through the same row a Projects download renders.
 * SVG first when the tool exports SVG, else its first raster format.
 */
export async function renderSessionPicture(host: HostV1, data: Record<string, unknown>): Promise<PreparedPicture | null> {
  const toolId = typeof data.__toolId === 'string' ? data.__toolId : '';
  if (!toolId) return null;
  const [{ rowFromToolSession }, { displayFormatOf, rasterFormatOf }, { getTool }] = await Promise.all([
    import('../pro/folder-rows.ts'), import('./preview-formats.ts'), import('../bridge/tool-loader.ts'),
  ]);
  const tool = await getTool(toolId);
  const formats = tool.manifest.render?.formats;
  const primary = displayFormatOf(formats);
  if (!primary) return null;
  const row = rowFromToolSession(data as Parameters<typeof rowFromToolSession>[0]);
  const values = (row.values ?? {}) as Record<string, unknown>;
  const opts = { ...sessionRenderSize(row), ...(row.artifactDigest ? { artifactDigest: row.artifactDigest } : {}) };
  try {
    return await renderLookPicture(host, toolId, primary, values, opts);
  } catch {
    const raster = rasterFormatOf(formats);
    if (primary !== 'svg' || !raster) return null;
    return renderLookPicture(host, toolId, raster, values, opts).catch(() => null);
  }
}
