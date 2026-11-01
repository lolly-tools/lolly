// SPDX-License-Identifier: MPL-2.0
/**
 * Which renderer draws a Design still on the web shell (plan 326).
 *
 * The GPU route compiles the authored rows the screen draws (`sourceDocument`, the
 * runtime's snapshot) into drawing operations, admits them for the GPU page renderer
 * (`engine/src/design-draw-raster.ts`), draws them at the export's pixel size and hands
 * the pixels to the same watermark, PNG encoder, metadata splices and Content
 * Credentials stamp the browser renderer's pixels get. It is taken only when the
 * internal switch asks for it (`exportRouteChoice`, feature-flags.ts) and the page is
 * one the renderer carries; every other Design still goes to the browser renderer,
 * with the reason logged.
 *
 * Any failure once the GPU route is chosen (a lost device, a refusal at draw time, the
 * time budget, an encoder error) falls back to the browser renderer without a word to
 * the person; the reason goes to the log as a warning. Cancelling the export is not a
 * failure and is passed on.
 */
import { COMPATIBILITY_RASTER_RENDERER, describeDesignExportRoute, designGpuRefusals, type DesignExportRouteRecord } from '../../../../engine/src/design-export-route.ts';
import type { DesignRasterEvaluation } from '../../../../engine/src/design-draw-raster.ts';
import type { DesignRasterResult } from '../lib/webgpu/design-page.ts';
import { exportRouteChoice } from '../feature-flags.ts';
import { _host, exportDims, type ExportOpts } from './export-shared.ts';
import { pageHost } from './export-design-ops.ts';
import { rasterStyle } from './export-raster-style.ts';
import { encodePngCanvas } from './export-raster-finish.ts';

/** How long the GPU route may take before the browser renderer draws the page instead. Mutable for tests. */
export const GPU_ROUTE_BUDGET = { ms: 15_000 };

/** The export's pixel box, as the browser renderer would draw it (export.ts rasterStyle). */
export interface StillSize { width: number; height: number; nodeWidth: number; nodeHeight: number; dpi: number }

export interface StillRouteDeps {
  /** Today's renderer for this format; called with the route already recorded on `opts`. */
  compatibility(): Promise<Blob>;
  /** The pixel box; the browser renderer's own arithmetic unless a test lends another. */
  size?(): StillSize;
  /** Watermark, encode and splice a PNG from a canvas holding the drawn page; the shared writer unless a test lends another. */
  finishPng?(canvas: HTMLCanvasElement, dpi: number): Promise<Blob>;
  /** The GPU renderer; a seam for tests, the product device service otherwise. */
  raster?: (evaluation: DesignRasterEvaluation, signal: AbortSignal) => Promise<DesignRasterResult>;
}

const info = (message: string): void => { _host?.log?.('info', message); };

/** The pixel box the browser renderer would draw `node` at (export.ts renderRaster). */
function stillSize(node: Element, opts: ExportOpts): StillSize {
  const d = exportDims(node, opts), r = rasterStyle(d, opts, node);
  return { width: r.width, height: r.height, nodeWidth: d.node.w, nodeHeight: d.node.h, dpi: d.dpi };
}

function record(opts: ExportOpts, route: DesignExportRouteRecord): DesignExportRouteRecord {
  opts._exportRoute = route;
  return route;
}

/** The browser renderer draws the page; `reasons` say why it was not the GPU. */
async function compatibilityBecause(format: string, opts: ExportOpts, deps: StillRouteDeps, reasons: string[], level: 'info' | 'warn' = 'info'): Promise<Blob> {
  const chosen = record(opts, { route: 'compatibility', renderer: COMPATIBILITY_RASTER_RENDERER });
  _host?.log?.(level, describeDesignExportRoute(format, chosen, reasons));
  return deps.compatibility();
}

const findingList = (findings: ReadonlyArray<{ feature: string; id: string }>): string => [...new Set(findings.map((f) => f.id ? `${f.feature} (${f.id})` : f.feature))].join(', ');

/** The drawn page's pixels, or the reasons the GPU route does not carry this page. Throws on a draw failure. */
async function gpuPixels(node: Element, opts: ExportOpts, deps: StillRouteDeps, signal: AbortSignal): Promise<{ pixels: DesignRasterResult; size: StillSize; ingredients: NonNullable<ExportOpts['_ingredientSink']> } | { reasons: string[] }> {
  const values = opts.sourceDocument!.values;
  const frameId = node.getAttribute('data-frame-id');
  if (!frameId) return { reasons: ['the export is not a single frame'] };
  if (String(values.textDocument ?? '').trim()) return { reasons: ['the document composes text stories'] };
  const text = _host?.text, assets = _host?.assets;
  if (!text || !assets) return { reasons: ['this shell has no text or asset host'] };
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return { reasons: ['this browser has no WebGPU'] };
  const size = deps.size?.() ?? stillSize(node, opts);
  // The browser renderer scales the page uniformly by width; a request that changes the
  // page's proportions is drawn there, where the crop it makes is the one people know.
  if (Math.abs(size.height - size.nodeHeight * (size.width / size.nodeWidth)) > 0.5) return { reasons: ['the requested size changes the page\'s proportions'] };
  // Pictures read while compiling may carry credentials; they join the export's only if this route draws the page.
  const ingredients: NonNullable<ExportOpts['_ingredientSink']> = [];
  const compileOpts: ExportOpts = { ...opts, convertPaths: true, ...(opts._ingredientSink ? { _ingredientSink: ingredients } : {}) };
  const { designPageDrawing } = await import('../../../../engine/src/design-page-svg.ts');
  const drawing = await designPageDrawing(values, frameId, pageHost(node, compileOpts, text, assets), { dpi: size.dpi });
  if (Math.abs(drawing.frame.width - size.nodeWidth) > 0.5 || Math.abs(drawing.frame.height - size.nodeHeight) > 0.5) return { reasons: ['the page on screen is not at its authored size'] };
  const { prepareDesignRaster } = await import('../../../../engine/src/design-draw-raster.ts');
  const admitted = prepareDesignRaster(drawing.page, { width: size.width, height: size.height, dpi: size.dpi });
  if (!admitted.ok) return { reasons: [`the page holds features the GPU page renderer does not carry yet: ${findingList(admitted.findings)}`] };
  signal.throwIfAborted();
  const raster = deps.raster ?? (await import('../lib/webgpu/design-page.ts')).renderDesignRaster;
  const pixels = await raster(admitted.evaluation, signal);
  if (pixels.width !== size.width || pixels.height !== size.height) throw new Error(`the renderer returned ${pixels.width} x ${pixels.height} pixels for a ${size.width} x ${size.height} export`);
  return { pixels, size, ingredients };
}

/**
 * Draw one Design still: by the GPU page renderer when the switch asks for it and the page
 * is admitted, else by the browser renderer. Records the route on `opts` for the credential.
 */
export async function routeDesignStill(node: Element, format: string, opts: ExportOpts, deps: StillRouteDeps): Promise<Blob> {
  const refusals = designGpuRefusals(format, opts, await exportRouteChoice());
  if (refusals.length) return compatibilityBecause(format, opts, deps, refusals);
  const started = performance.now();
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(new DOMException('The GPU route ran past its time budget.', 'TimeoutError')), GPU_ROUTE_BUDGET.ms);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timer.signal]) : timer.signal;
  let fallback: { reasons: string[]; level: 'info' | 'warn' };
  try {
    const drawn = await gpuPixels(node, opts, deps, signal);
    if ('reasons' in drawn) fallback = { reasons: drawn.reasons, level: 'info' };
    else {
      const { pixels, size, ingredients } = drawn;
      const canvas = document.createElement('canvas');
      canvas.width = pixels.width; canvas.height = pixels.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2D canvas for the drawn pixels');
      ctx.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
      signal.throwIfAborted();
      const blob = await (deps.finishPng ?? ((c: HTMLCanvasElement, dpi: number) => encodePngCanvas(c, opts, dpi)))(canvas, size.dpi);
      for (const ingredient of ingredients) {
        if (opts._ingredientSink && !opts._ingredientSink.some((p) => p.activeLabel === ingredient.activeLabel)) opts._ingredientSink.push(ingredient);
      }
      const chosen = record(opts, { route: 'gpu', renderer: (await import('../../../../engine/src/design-draw-raster.ts')).DESIGN_RASTER_RECIPE });
      info(`${describeDesignExportRoute(format, chosen)} ${pixels.width} x ${pixels.height} px in ${Math.round(performance.now() - started)} ms, ${pixels.allocation.peakBytes} bytes on the device at peak.`);
      return blob;
    }
  } catch (error) {
    // The person's own cancel is passed on; anything else is the GPU route failing.
    if (opts.signal?.aborted) throw error;
    const why = error instanceof Error ? `${error.name === 'Error' ? '' : `${error.name}: `}${error.message}` : String(error);
    fallback = { reasons: [`the GPU route failed (${why})`], level: 'warn' };
  } finally {
    clearTimeout(timeout);
  }
  return compatibilityBecause(format, opts, deps, fallback.reasons, fallback.level);
}
