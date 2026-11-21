// SPDX-License-Identifier: MPL-2.0
/**
 * The offscreen source of the preview writer (plan 373, section 5.5): a tool id
 * with values, drawn through the same export path a batch render takes
 * (pro/render-export.ts), then encoded by the one rule in lib/preview-writer.ts.
 *
 * SVG first: a tool that exports SVG is drawn as SVG and kept as SVG when it fits
 * one entry; a larger SVG is drawn into the raster tile by the browser's own SVG
 * renderer, at the full tile size because the source is vector. A tool with no SVG
 * export is drawn in its first raster format. The picture records which.
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
  recipe?: string;
}

/** Draw one look at an exact format and make it a picture. Throws when the render
 *  fails, so the caller can try the tool's other format. */
export async function renderLookPicture(host: HostV1, toolId: string, format: string, values: Record<string, unknown>, opts: LookRenderOptions = {}): Promise<PreparedPicture> {
  const { renderRowToBlob } = await import('../pro/render-export.ts');
  const writer = await import('./preview-writer.ts');
  const dims = opts.width && opts.height ? { width: opts.width, height: opts.height } : {};
  const { blob } = await renderRowToBlob(
    // values arrives as JSON (Record<string, unknown>); the render row types it as
    // InputValue - the runtime coerces per the input's declared type, so cast the row.
    { toolId, values, ...(opts.tokenSelection ? { tokenSelection: opts.tokenSelection } : {}), ...(opts.artifactDigest ? { artifactDigest: opts.artifactDigest } : {}) } as Parameters<typeof renderRowToBlob>[0],
    host,
    { format, watermark: false, embedMeta: false, thumbnail: true, previewPage: true, thumbAssets: true, previewTimeMs: opts.previewTimeMs, ...dims },
  );
  const facts = opts.recipe ? { recipe: opts.recipe } : {};
  if (format === 'svg') {
    const svg = await writer.svgPicture(blob, facts);
    if (svg) return svg;
    const raster = await writer.rasterPicture(new Blob([blob], { type: 'image/svg+xml' }), { ...facts, vector: true });
    if (raster) return raster;
    throw new Error(`The SVG preview of ${toolId} could not be drawn.`);
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
      ? (await writer.svgPicture(blob)) ?? (await writer.rasterPicture(new Blob([blob], { type: 'image/svg+xml' }), { vector: true }))
      : await writer.rasterPicture(blob);
    if (!picture) throw new Error(`A page preview of ${toolId} could not be drawn.`);
    out.push(picture);
  }
  return out;
}

/**
 * Draw a saved session again, for a tile whose picture is stale or missing: the
 * session's own values through the same row a Projects download renders. SVG
 * first when the tool exports SVG, else its first raster format.
 */
export async function renderSessionPicture(host: HostV1, data: Record<string, unknown>): Promise<PreparedPicture | null> {
  const toolId = typeof data.__toolId === 'string' ? data.__toolId : '';
  if (!toolId) return null;
  const [{ rowFromToolSession }, { displayFormatOf, rasterFormatOf }, { getTool }] = await Promise.all([
    import('../pro/folder-rows.ts'), import('./featured-render.ts'), import('../bridge/tool-loader.ts'),
  ]);
  const tool = await getTool(toolId);
  const formats = tool.manifest.render?.formats;
  const primary = displayFormatOf(formats);
  if (!primary) return null;
  const row = rowFromToolSession(data as Parameters<typeof rowFromToolSession>[0]) as unknown as { values?: Record<string, unknown>; artifactDigest?: string };
  const values = row.values ?? {};
  const opts = row.artifactDigest ? { artifactDigest: row.artifactDigest } : {};
  try {
    return await renderLookPicture(host, toolId, primary, values, opts);
  } catch {
    const raster = rasterFormatOf(formats);
    if (primary !== 'svg' || !raster) return null;
    return renderLookPicture(host, toolId, raster, values, opts).catch(() => null);
  }
}
