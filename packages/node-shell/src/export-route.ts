// SPDX-License-Identifier: MPL-2.0
/**
 * Which renderer draws a Design export in the Node shells (plan 326), in the same words
 * as the web shell (`engine/src/design-export-route.ts`).
 *
 * - SVG, SVGZ and PDF pages the drawing operations carry are written here, with no
 *   browser (`design-ops-svg.ts`, `design-ops-pdf.ts`): route `operations`.
 * - Every still raster goes to the browser tier, the headless Chromium driving the web
 *   shell, which routes the page itself and stamps the credential with the route it took.
 *   Node has no GPU route: the drawing operations reach pixels only through WebGPU, and
 *   a CPU substitute is ruled out (plan 295 section 2). A qualified native adapter would
 *   plug in at `nodeRasterRoute`, admitting the same evaluation the web shell admits and
 *   handing its RGBA to the Node PNG writer before the post-stamp in shells/cli/src/run.ts.
 *
 * `LOLLY_EXPORT_ROUTE` (`auto`, `ops` or `legacy`) is the internal override. `legacy`
 * sends Design pages to the browser tier's compatibility renderer; the value is passed
 * to that tier's page, so `ops` asks the browser tier for its GPU route.
 */
import { designExportRouteFields, designOperationsRenderer, parseDesignExportRouteChoice, type DesignExportRouteChoice, type DesignExportRouteRecord } from '../../../engine/src/design-export-route.ts';
import { DESIGN_DRAW_VERSION } from '../../../engine/src/design-draw.ts';

/** The override this process asks for, `auto` when unset or unreadable. */
export function nodeExportRouteChoice(env: Record<string, string | undefined> = process.env): DesignExportRouteChoice {
  return parseDesignExportRouteChoice(env.LOLLY_EXPORT_ROUTE) ?? 'auto';
}

/** The record for a page this shell wrote from the drawing operations. */
export const nodeOperationsRoute = (): DesignExportRouteRecord => ({ route: 'operations', renderer: designOperationsRenderer(DESIGN_DRAW_VERSION) });

/** The credential keys for a Node-drawn page (none when the browser tier drew it and stamped its own). */
export const nodeRouteEnvironment = (record: DesignExportRouteRecord | null | undefined): Record<string, string> =>
  designExportRouteFields(record) as Record<string, string>;

/** One log line for a Design still on Node: the browser tier draws it, and why. */
export function nodeRasterRoute(format: string): string {
  return `Design ${format.toUpperCase()} export: drawn by the browser render tier, which routes the page itself; this shell has no GPU route for pixels.`;
}

/** The value forwarded to the browser tier's page storage, or null to leave the page on its own default. */
export function forwardedExportRoute(env: Record<string, string | undefined> = process.env): DesignExportRouteChoice | null {
  return parseDesignExportRouteChoice(env.LOLLY_EXPORT_ROUTE);
}
