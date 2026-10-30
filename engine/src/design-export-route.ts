// SPDX-License-Identifier: MPL-2.0
/**
 * Which renderer draws a Design export (plan 326).
 *
 * One vocabulary for the web shell and the Node shells, so a credential, a log line
 * and a test read the same words whichever shell made the file:
 *
 * - `gpu`: the page's drawing operations rasterised by the GPU page renderer
 *   (`shells/web/src/lib/webgpu/design-page.ts`), then finished by the format's own
 *   watermark, encoder, metadata writers and Content Credentials stamp.
 * - `operations`: the drawing operations written straight to a vector format by the
 *   engine (`design-draw-svg.ts`, `design-draw-pdf.ts`).
 * - `compatibility`: the browser's own renderer, dom-to-image for pixels and the DOM
 *   walker for vectors. Every page the other routes do not carry yet, and every
 *   non-Design tool, is drawn this way.
 *
 * Pure and dependency-free on purpose: the shells import it on the export path, and
 * the renderers themselves stay lazy.
 */

export type DesignExportRoute = 'gpu' | 'operations' | 'compatibility';

/**
 * The internal override (`lolly.exportRoute` in the web shell's storage,
 * `LOLLY_EXPORT_ROUTE` in Node, forwarded to the browser tier). `auto` is today's
 * routing; `ops` also lets an admitted still raster take the GPU route; `legacy` sends
 * every Design page to the compatibility renderer. Not a URL parameter: the reserved
 * parameters are a permanent contract and this is a temporary switch.
 */
export type DesignExportRouteChoice = 'auto' | 'ops' | 'legacy';

/**
 * Still raster formats whose Design export carries the authored document
 * (`ExportOpts.sourceDocument`). The runtime snapshots it for these as it does for SVG
 * and PDF, so a route can read the rows the screen draws.
 */
export const DESIGN_STILL_RASTER_FORMATS: readonly string[] = Object.freeze(['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'cmyk-tiff', 'bmp', 'ico', 'jxl', 'jxl-lossless']);

/** The still raster formats the GPU route draws. PNG first; the other encoders follow on the same pixels. */
export const DESIGN_GPU_FORMATS: readonly string[] = Object.freeze(['png']);

/** The renderer identity the compatibility route records, by format family. */
export const COMPATIBILITY_RASTER_RENDERER = 'dom-to-image';
export const COMPATIBILITY_VECTOR_RENDERER = 'dom-walker';

/** The route a shell chose for one export, and the version of the renderer that drew the page. */
export interface DesignExportRouteRecord {
  route: DesignExportRoute;
  /**
   * The versioned identity of the renderer: the GPU recipe, the drawing operations'
   * version, or the name of the compatibility renderer (the browser's own version is
   * never recorded, as with every other browser detail in the credential).
   */
  renderer: string;
}

/** The choice a stored or environment value names, or null for anything else. */
export function parseDesignExportRouteChoice(value: unknown): DesignExportRouteChoice | null {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return v === 'auto' || v === 'ops' || v === 'legacy' ? v : null;
}

/** The drawing operations' renderer identity for a given `DESIGN_DRAW_VERSION`. */
export const designOperationsRenderer = (drawVersion: number): string => `design-draw-v${drawVersion}`;

/** The compatibility renderer that draws `format`. */
export function compatibilityRenderer(format: string): string {
  return DESIGN_STILL_RASTER_FORMATS.includes(String(format).toLowerCase()) ? COMPATIBILITY_RASTER_RENDERER : COMPATIBILITY_VECTOR_RENDERER;
}

/**
 * The flat keys a route adds to the `tools.lolly.export` assertion: `route` and
 * `renderer`, both plain text, because Verify reads only scalar values from that
 * assertion. Nothing when no route was chosen, so an export outside the selector
 * records exactly what it recorded before.
 */
export function designExportRouteFields(record: DesignExportRouteRecord | null | undefined): { route?: DesignExportRoute; renderer?: string } {
  if (!record?.route || !record.renderer) return {};
  return { route: record.route, renderer: String(record.renderer).slice(0, 200) };
}

/** What a still raster request asks for that the GPU route does not draw, before any page is compiled. */
export interface DesignGpuRequest {
  hdr?: unknown;
  watermark?: unknown;
  thumbnail?: unknown;
  background?: unknown;
  keepEditorChrome?: unknown;
  deepFrame?: unknown;
  depth?: unknown;
  sourceDocument?: { toolId: string; values: Record<string, unknown> };
}

/**
 * The reasons a Design still cannot take the GPU route, from the request alone. Empty
 * means the page may be compiled and admitted. Each reason reads after "because".
 */
export function designGpuRefusals(format: string, opts: DesignGpuRequest, choice: DesignExportRouteChoice): string[] {
  const reasons: string[] = [];
  if (choice !== 'ops') reasons.push(choice === 'legacy' ? 'the compatibility route is forced' : 'the GPU route is not switched on');
  if (!DESIGN_GPU_FORMATS.includes(String(format).toLowerCase())) reasons.push(`the GPU route does not draw ${String(format).toUpperCase()} yet`);
  if (opts.sourceDocument?.toolId !== 'design') reasons.push('the export carries no authored Design document');
  if (opts.hdr || opts.sourceDocument?.values?.editingRange === 'hdr' || opts.deepFrame) reasons.push('the export is HDR, which keeps its deep route');
  if (opts.depth === 16) reasons.push('the export asks for 16-bit pixels');
  if (opts.watermark) reasons.push('the export carries a watermark');
  if (opts.thumbnail) reasons.push('the render is a thumbnail');
  if (opts.keepEditorChrome) reasons.push('the capture keeps the editor chrome');
  if (opts.background != null && opts.background !== '') reasons.push('the export sets its own background');
  return reasons;
}

/** One log line for a decision: which renderer drew the page and, when it was not the first choice, why. */
export function describeDesignExportRoute(format: string, record: DesignExportRouteRecord, reasons: readonly string[] = []): string {
  const what = `Design ${String(format).toUpperCase()} export`;
  const by = record.route === 'gpu' ? 'drawn by the GPU page renderer' : record.route === 'operations' ? 'drawn from the drawing operations' : 'drawn by the compatibility renderer';
  return `${what}: ${by} (${record.renderer})${reasons.length ? ` because ${reasons.join('; ')}` : ''}.`;
}
