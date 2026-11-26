// SPDX-License-Identifier: MPL-2.0
/**
 * A Design frame exported as SVG from the engine's drawing operations, in Node (plan
 * 295, P3d): the CLI's browser-free page export.
 *
 * The same engine call as the web shell's (`designPageSvg`), lent what a Node host has:
 * the content roots' faces through the measure's shaper, HarfBuzz outlines, the asset
 * bytes and the brand's font tokens. Wherever the web shell would draw something this
 * host cannot settle without a browser, the result is a reason instead of a page, and
 * the CLI escalates to the browser tier, which draws the page through the web shell.
 */
import { toCssLength, toCssPx, parseDimension } from '@lolly/engine';
import type { ExportOpts, HostV1, IngredientCredential } from '@lolly-tools/core/host-v1';
import type { DesignPageDrawing, DesignPageSvg } from '../../../engine/src/design-page-svg.ts';
import { designOpsNodeHost } from './design-ops-host.ts';
import { nodeExportRouteChoice } from './export-route.ts';

/** The page `node` names, its size controls and the Node host that compiles it, or the reason there is none. */
type OpsHost = NonNullable<Awaited<ReturnType<typeof designOpsNodeHost>>>;
async function opsPage(node: Element | null | undefined, opts: ExportOpts, host: HostV1, ctx: { repoRoot: string }): Promise<{ values: Record<string, unknown>; frameId: string; use: OpsHost; dpi: number } | { reason: string } | null> {
  const doc = opts.sourceDocument;
  if (doc?.toolId !== 'design') return null;
  if (nodeExportRouteChoice() === 'legacy') return { reason: 'the compatibility route is forced (LOLLY_EXPORT_ROUTE=legacy)' };
  const frameId = node?.getAttribute?.('data-frame-id');
  if (!frameId) return { reason: 'the export is not a single frame (name one with --s)' };
  if (opts.watermark) return { reason: 'the export carries a watermark' };
  const use = await designOpsNodeHost(host, ctx, (opts as { convertPaths?: boolean }).convertPaths !== false);
  if (!use) return { reason: 'this shell has no text host' };
  const dpi = (opts.dpi as number) > 0 ? opts.dpi as number : 96;
  return { values: doc.values, frameId, use, dpi };
}

/** A compile that failed for a reason other than a broken render, as a reason. */
function compileReason(error: unknown): { reason: string } {
  if (error instanceof Error && error.name === 'RenderIntegrityError') throw error;
  return { reason: `the drawing could not be compiled (${error instanceof Error ? error.message : String(error)})` };
}

const findingsReason = (findings: readonly { feature: string; id: string }[]): { reason: string } =>
  ({ reason: `the page holds features the drawing operations do not carry yet: ${[...new Set(findings.map((f) => `${f.feature} (${f.id})`))].join(', ')}` });

/**
 * The page the operations draw for `node`, or the reason the page needs the browser
 * tier. Null when the export is not a Design page at all.
 */
export async function designOpsSvgNode(node: Element | null | undefined, opts: ExportOpts, host: HostV1, ctx: { repoRoot: string }): Promise<{ svg: string; ingredients: IngredientCredential[] } | { reason: string } | null> {
  const found = await opsPage(node, opts, host, ctx);
  if (!found || 'reason' in found) return found;
  const { values, frameId, use, dpi } = found;
  const width = parseDimension(opts.width) ?? undefined;
  const height = parseDimension(opts.height) ?? undefined;
  const { designFrames, designPageSvg } = await import('../../../engine/src/design-page-svg.ts');
  const frame = designFrames(values).find((f) => f.id === frameId);
  if (!frame) return { reason: `there is no visible frame "${frameId}"` };
  const w = width ?? { value: frame.width, unit: 'px' as const }, h = height ?? { value: frame.height, unit: 'px' as const };
  let page: DesignPageSvg;
  try {
    page = await designPageSvg(values, frameId, use.drawing, {
      dpi,
      size: { width: toCssLength(w), height: toCssLength(h), px: { w: toCssPx(w), h: toCssPx(h) } },
      ...(opts.meta ? { meta: opts.meta } : {}),
    });
  } catch (error) {
    return compileReason(error);
  }
  if (page.findings.length) return findingsReason(page.findings);
  // Every credentialed picture the document places rides the export's credential as an
  // ingredient, the pictures on other pages too, as on the web shell.
  return { svg: page.svg, ingredients: await use.ingredients(values) };
}

/**
 * The same page compiled, with its pictures' bytes, for a renderer that draws the
 * operations itself (the lolly-render crate, design-still.ts) instead of reading the
 * SVG. The same checks and the same reasons as `designOpsSvgNode`; a page with
 * findings is handed back with them, since that renderer refuses each one by name.
 */
export async function designOpsDrawingNode(node: Element | null | undefined, opts: ExportOpts, host: HostV1, ctx: { repoRoot: string }): Promise<{ drawing: DesignPageDrawing; ingredients: IngredientCredential[] } | { reason: string } | null> {
  const found = await opsPage(node, opts, host, ctx);
  if (!found || 'reason' in found) return found;
  const { values, frameId, use, dpi } = found;
  const { designFrames, designPageDrawing } = await import('../../../engine/src/design-page-svg.ts');
  if (!designFrames(values).some((f) => f.id === frameId)) return { reason: `there is no visible frame "${frameId}"` };
  let drawing: DesignPageDrawing;
  try {
    drawing = await designPageDrawing(values, frameId, use.drawing, { dpi });
  } catch (error) {
    return compileReason(error);
  }
  return { drawing, ingredients: await use.ingredients(values) };
}
