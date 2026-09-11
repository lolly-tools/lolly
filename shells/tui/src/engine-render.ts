// SPDX-License-Identifier: MPL-2.0
/**
 * Engine glue - the SAME render path the CLI/web use, driven interactively.
 * mountTool → createRuntime; renderSvg turns the current state into an SVG string
 * (for the terminal preview); exportToFile writes a real file via the Node bridge.
 */
import { loadTool, createRuntime, parseUrlState, serializeUrlState, expandQuery, normalizeLang, embedC2pa, C2PA_FORMATS } from '@lolly/engine';
import type { UrlState } from '../../../engine/src/url-mode.ts';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
// The DOM-free/raster format split + the resvg fast path + the export C2PA payload,
// shared with the CLI (one implementation, no drift).
import { NODE_FORMATS, pxDims, eligibleForResvgPng, rasterizeTierAPng, canCarryPrintPrep, printPrepRefusal } from '@lolly-tools/node-shell/raster';
import { buildExportC2paOpts } from '@lolly-tools/node-shell/c2pa-opts';
import { assertRenderOk } from '@lolly-tools/node-shell/render-integrity';
import type { RenderDims } from '@lolly-tools/node-shell/webshell-render';
import { toolFetchFile } from './catalog.ts';
import { getProfile } from './store.ts';
// The same allowlisted-fetch module every shell builds host.net from (the web
// bridge re-exports this one) - one matcher, no drift.
import { createNetAPI } from '@lolly-tools/node-shell/net';
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';
import type { JSDOM } from 'jsdom';

export type Runtime = Awaited<ReturnType<typeof createRuntime>>;
export type Manifest = Awaited<ReturnType<typeof loadTool>>['manifest'];

/** What a mount yields: the runtime, its manifest, and the FULL reserved URL state from
 *  the share link (so the caller can seed the export panel + know the requested language),
 *  not just the input values. */
export interface MountResult { runtime: Runtime; manifest: Manifest; reserved: UrlState }

/**
 * Mount a tool, optionally seeded from a share link / saved session's URL-state `query`
 * and from a saved record's `values`.
 *
 * `values` is the saved-session data the desktop app and the web shell both write - the
 * resolved input values plus their `__`-prefixed markers. A session saved in the desktop
 * app has only that (no URL-state), so it is what reopens it here. Values win over the
 * query where both name an input: they are the same state one step later, with nothing
 * dropped by an encoder. This is the web tool view's own rule (views/tool.ts).
 */
export async function mountTool(
  toolId: string, host: HostV1, query = '', values?: Record<string, unknown>,
): Promise<MountResult> {
  // Expand a packed `z=` share link FIRST (mirrors shells/cli/src/run.ts) - a no-op on a
  // readable or empty query. Without this the TUI silently loads a packed link at defaults.
  const expanded = query ? await expandQuery(query) : '';
  // Read `lang` before loadTool so a `?lang=de` link localizes the manifest via
  // applyManifestI18n (same as the CLI's run.ts) - even a lang packed inside `z=`.
  const lang = expanded ? normalizeLang(new URLSearchParams(expanded).get('lang')) ?? undefined : undefined;
  const tool = await loadTool(toolId, toolFetchFile(), { lang });
  // Rebuild host.net from THIS tool's network.allowlist (mirrors the web view's
  // post-load reassignment): the TUI's bridge is created once at boot, before any
  // manifest is known, so without this every host.net fetch would reject and a
  // network-capable tool that renders in the web shell would fail here.
  host.net = createNetAPI({ allowlist: tool.manifest.network?.allowlist });
  // Keep the WHOLE parsed state, not just .values: the reserved export controls (format,
  // dims, unit, dpi, c2pa, password, filename) seed the export panel instead of being
  // silently dropped and reset to manifest defaults.
  const reserved = parseUrlState(expanded, tool.manifest);
  const initial = values ? { ...reserved.values, ...values } : reserved.values;
  const runtime = await createRuntime(tool, host, initial as Parameters<typeof createRuntime>[2]);
  return { runtime, manifest: tool.manifest, reserved };
}

/** The current state as a URL query - what a saved session stores + reopens from. */
export function currentQuery(runtime: Runtime): string {
  return serializeUrlState(runtime.getModel());
}

/** The current input values by id - the other half of what a saved session stores, and
 *  the half the desktop app and the web shell read. */
export function modelValues(runtime: Runtime): Record<string, unknown> {
  return Object.fromEntries((runtime.getModel() as Array<{ id: string; value: unknown }>).map(i => [i.id, i.value]));
}

export function exportableFormats(manifest: Manifest): string[] {
  // Every declared format is now offerable: engine-native ones render DOM-free, the rest
  // via the scoped Chromium (a clear "run pnpm run install:browser / build:web" error
  // surfaces at export time if it isn't set up). `html` is appended as the universal
  // fallback so even a template with no <svg> and no browser can still write a file.
  const declared = ((manifest as { render?: { formats?: string[] } }).render?.formats ?? [])
    .map(f => f.toLowerCase());
  const ok = [...new Set(declared)];
  if (!ok.includes('html')) ok.push('html');
  return ok;
}

/** True when the tool captures a live URL (url-shot) - routed straight to Chromium. */
export function isCaptureTool(manifest: Manifest): boolean {
  return ((manifest as { capabilities?: string[] }).capabilities ?? []).includes('capture');
}

/** True when the tool is a file-in/file-out transform utility (strip-data, compress-pdf)
 * - its output is a FILE via the exportFile hook, not a render. */
export function isTransform(manifest: Manifest): boolean {
  return Boolean((manifest as { hooks?: { exportFile?: unknown } }).hooks?.exportFile);
}

function canvasOf(dom: JSDOM): HTMLElement {
  const c = dom.window.document.getElementById('canvas');
  if (!c) throw new Error('render canvas missing');
  return c;
}

/**
 * Render the runtime's CURRENT state to an SVG string, or null when this tool can't
 * produce SVG in a pure-Node shell (HTML-layout tools need a browser engine). Used
 * for the terminal image preview - resvg rasterises the returned SVG.
 */
export async function renderSvg(runtime: Runtime, dom: JSDOM): Promise<string | null> {
  try {
    const canvas = canvasOf(dom);
    canvas.innerHTML = runtime.getHydrated();
    const blob = await runtime.export(canvas, 'svg', {});
    return await blob.text();
  } catch {
    return null;
  }
}

/** Output size options for an export (mirrors the web/CLI: width/height are values in
 *  `unit`; a physical unit qualifies them so the engine converts per format). Extends
 *  the shared render dims (incl. the `password` PDF-lock param) with the TUI's
 *  Content-Credentials window. */
export interface ExportDims extends RenderDims { c2paDays?: number }

/**
 * Export the current state to `outPath` in `format`, honouring optional output
 * dimensions. Supports whatever the Node bridge produces (text/data + svg/emf/eps,
 * plus transform-hook utilities); raster/pdf throw a clear message (they need a browser
 * engine - the desktop app). Returns the number of bytes written.
 */
export async function exportToFile(
  runtime: Runtime, dom: JSDOM, manifest: Manifest, format: string, outPath: string, dims: ExportDims = {},
): Promise<number> {
  await mkdir(dirname(outPath), { recursive: true });   // ensure the target folder exists
  const fmt = format.toLowerCase();
  // Print prep that cannot be applied is a refusal, not a shrug (same guard the CLI runs in
  // run.ts). Only pdf/pdf-cmyk/cmyk-tiff carry a bleed box or crop marks - nothing draws them
  // onto a PNG/SVG/EPS on any tier, and the Tier-B browser's renderRaster ignores them too, so
  // a png+bleed/marks link would otherwise write a file byte-identical to one without them,
  // exit 0, with nothing to say so. Refuse by name instead. Shared message, no drift vs the CLI.
  if ((dims.bleed || dims.marks) && !canCarryPrintPrep(fmt)) {
    throw new Error(printPrepRefusal(fmt));
  }
  const transform = isTransform(manifest);
  const write = async (bytes: Uint8Array, viaWebShell = false): Promise<number> => {
    // Optionally stamp Content Credentials (C2PA) as the LAST byte operation - same rule
    // as the CLI/web. NEVER on transform utilities (strip-data's whole job is to REMOVE
    // metadata). Ephemeral on-device cert; a clean warn-and-continue on any failure.
    // The Tier-B (web shell) branch already stamped via the forwarded ?c2pa param, so it
    // passes viaWebShell=true to skip re-stamping (avoids a double credential).
    let out = bytes;
    if (dims.c2paDays && !transform && !viaWebShell && C2PA_FORMATS.includes(fmt)) {
      try {
        // Match the web/CLI tools.lolly.export enrichment: context + date + output
        // size + the scalar-input digest, so a TUI-made asset inspects as richly.
        // buildExportC2paOpts (shared with the CLI) also attaches the profile author
        // under the `useDetails` opt-in - same gate as every other shell.
        const profile = (await getProfile()) as Profile;
        out = await embedC2pa(bytes, fmt, buildExportC2paOpts({
          surface: 'tui',
          manifest: manifest as { id: string; name?: string },
          model: runtime.getModel(),
          format: fmt, dims, days: dims.c2paDays, profile,
        }));
      } catch { /* non-fatal - write the unstamped bytes */ }
    }
    const buf = Buffer.from(out);
    await writeFile(outPath, buf);
    return buf.length;
  };

  // 1. On-device transform utilities (strip-data, compress-pdf) produce bytes via the
  //    exportFile hook, not a render.
  if (transform) {
    // exportFile returns one result or a batch (a `multiple` file input). The CLI/TUI
    // path is single-file (one --file arg → one --output), so take the first result.
    const res = await runtime.exportFile();
    const first = Array.isArray(res) ? res[0] : res;
    if (!first?.bytes) throw new Error('exportFile produced no bytes');
    return write(first.bytes as Uint8Array);
  }

  // 2. Capture tools (url-shot): drive Chromium straight at the target URL. Produces
  //    png/jpg/pdf(vector)/svg directly - never touches the DOM export path.
  if (isCaptureTool(manifest)) {
    const { captureUrl, captureParamsFrom } = await import('./url-capture.ts');
    const params = captureParamsFrom(runtime.getModel() as Array<{ id: string; value: unknown }>);
    const cdims = pxDims(dims, manifest as { render?: { width?: number; height?: number } });
    const { bytes } = await captureUrl(params, fmt, cdims);
    return write(bytes);
  }

  // 3. Engine-native formats (svg/emf/eps + text/data): the DOM-free path.
  if (NODE_FORMATS.includes(fmt)) {
    const canvas = canvasOf(dom);
    canvas.innerHTML = runtime.getHydrated();
    // Qualify a physical unit onto the value (e.g. 210 + mm → "210mm"); px passes as a
    // number. Blank → the tool's native size. Mirrors shells/cli/src/run.ts.
    const u = dims.unit || 'px';
    const qual = (v: number | undefined): string | number | undefined =>
      (typeof v === 'number' && v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
    const opts: { width?: string | number; height?: string | number; dpi?: number } = { width: qual(dims.width), height: qual(dims.height) };
    if (u !== 'px' && dims.dpi) opts.dpi = dims.dpi;
    const blob = await runtime.export(canvas, fmt, opts);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Fail loud: this is the runtime's own DOM-free output - refuse to write a file the
    // render silently failed to produce (a swallowed onInit) rather than report success.
    assertRenderOk({ hookErrors: runtime.hookErrors, format: fmt, bytes });
    return write(bytes);
  }

  // 3b. PNG from an SVG-native tool: rasterise the engine's own SVG via resvg - no
  //     browser and no built web shell needed (the fast, always-available raster path,
  //     mirroring the MCP server's Tier A+resvg). resvg emits PNG only; jpg/webp/pdf
  //     fall through to the web-shell tier below. The Imprint is embedded HERE too, in
  //     the pixels, so imprint-by-default never drags a PNG into the browser tier (the
  //     same fix shells/cli/src/raster.ts made). Only the DURABLE (neural TrustMark)
  //     mark still needs the web shell's export path, so that alone falls through.
  if (eligibleForResvgPng(fmt, dims)) {
    const svg = await renderSvg(runtime, dom);
    if (svg) {
      // Shared Tier-A rasteriser (node-shell), identical to the CLI: imprint when asked
      // (a frame below the detection floor returns the plain PNG unmarked, never fails)
      // and the physical-unit DPI carried onto both the imprinted and plain paths.
      const { bytes: png } = await rasterizeTierAPng(svg, dims, manifest as { render?: { width?: number; height?: number } });
      // Tier A rasterises the runtime's own SVG, so a swallowed hook failure yields a
      // blank PNG - gate it (the hookErrors signal catches what a byte-count can't).
      assertRenderOk({ hookErrors: runtime.hookErrors, format: fmt, bytes: png });
      return write(png);
    }
  }

  // 4. Everything else (jpg/webp/pdf/video, and HTML-layout raster): drive the built web
  //    shell in Chromium so the bytes are identical to a web/desktop Download.
  const { renderViaWebShell } = await import('@lolly-tools/node-shell/webshell-render');
  const id = (manifest as { id: string }).id;
  // Let the web shell be the single c2pa authority for this tier: forward the credential
  // setting (c2paDays>0 ⇒ on at that lifetime; 0 ⇒ the tool's own default) and skip the
  // Node re-stamp in write(). This also carries any bleed/marks/imprint/pressProfile the
  // shared RenderDims holds through exportUrl.
  const webDims = { ...dims, c2pa: dims.c2paDays ? true : undefined, c2paDays: dims.c2paDays };
  const { bytes } = await renderViaWebShell(id, currentQuery(runtime), fmt, webDims);
  return write(bytes, true);
}
