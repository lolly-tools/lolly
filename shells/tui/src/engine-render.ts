// SPDX-License-Identifier: MPL-2.0
/**
 * Engine glue - the SAME render path the CLI/web use, driven interactively.
 * mountTool → createRuntime; renderSvg turns the current state into an SVG string
 * (for the terminal preview); exportToFile writes a real file via the Node bridge.
 */
import { loadTool, createRuntime, canvasSizeOf, parseUrlState, serializeUrlState, expandQuery, normalizeLang, hasEncryptedState, unpackEncrypted, ENC_PARAM, tokenRestoreRefsOf, embedC2pa, C2PA_FORMATS, extractC2paStore, readFileDesignRecord, parseToolUrl } from '@lolly/engine';
import { shareUrlState } from '../../../engine/src/share-privacy.ts';
import type { SessionEmojiStamp } from '../../../engine/src/session-record.ts';
import type { UrlState } from '../../../engine/src/url-mode.ts';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertFormatBytes } from '@lolly-tools/node-shell/format-sniff';
// The DOM-free/raster format split + the resvg fast path + the export C2PA payload,
// shared with the CLI (one implementation, no drift).
import { NODE_FORMATS, needsFloatScene, pxDims, eligibleForResvgPng, rasterizeTierAPng, canCarryPrintPrep, printPrepRefusal, svgExportSize } from '@lolly-tools/node-shell/raster';
import { buildExportC2paOpts } from '@lolly-tools/node-shell/c2pa-opts';
import { assertRenderOk } from '@lolly-tools/node-shell/render-integrity';
import { withoutSvgCredentials } from '@lolly-tools/node-shell/lolly-file';
import { assertExportLocked, exportPasswordRefusal } from '@lolly-tools/node-shell/export-lock';
import type { RenderDims } from '@lolly-tools/node-shell/webshell-render';
import { toolFetchFile } from './catalog.ts';
import { getProfile } from './store.ts';
import { selectCliBridgeTokens, applyBrandVars } from '../../cli/src/bridge.ts';
// The same allowlisted-fetch module every shell builds host.net from (the web
// bridge re-exports this one) - one matcher, no drift.
import { createNetAPI } from '@lolly-tools/node-shell/net';
import type { HostV1, IngredientCredential, Profile } from '@lolly-tools/core/host-v1';
import type { DesignExportRouteRecord } from '../../../engine/src/design-export-route.ts';
import type { JSDOM } from 'jsdom';

export type Runtime = Awaited<ReturnType<typeof createRuntime>>;
export type Manifest = Awaited<ReturnType<typeof loadTool>>['manifest'];
const runtimeHosts = new WeakMap<Runtime, HostV1>();

/**
 * The tool a pasted lolly.tools link opens, with its settings, or why it opens
 * none. The result always carries `fromLink`, so the mount refuses a link that
 * points at files on this computer (`mountTool`).
 */
export function toolLinkRoute(url: string, known: (toolId: string) => boolean): { toolId: string; query: string; fromLink: true } | { error: string } {
  const ref = parseToolUrl(url);
  if (!ref) return { error: 'Not a recognised lolly.tools URL' };
  if (!known(ref.toolId)) return { error: `This build has no tool “${ref.toolId}”` };
  return { toolId: ref.toolId, query: ref.query, fromLink: true };
}

/** A pasted link that points at a file on this computer (see `mountTool`). */
export class LinkLocalFileError extends Error {
  override name = 'LinkLocalFileError';
  readonly hit: { inputId: string; fieldId: string | null; value: string };
  constructor(hit: { inputId: string; fieldId: string | null; value: string }) {
    super(`The link sets ${hit.fieldId ? `a ${hit.fieldId} in ${hit.inputId}` : hit.inputId} to "${hit.value}", a file on this computer. ` +
      'A link cannot choose files for Lolly to read, so the tool was not opened. Open the tool from the gallery and add the file yourself.');
    this.hit = hit;
  }
}

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
 *
 * `fromLink` marks a query someone else wrote (a pasted lolly.tools link). Such a
 * query says what to draw, never which files on this computer to read: a `file:`
 * URL or a local path in a picture, or a path in a file input, is refused with a
 * `LinkLocalFileError` and nothing is mounted. The CLI refuses the same
 * (`bakeLocalBlockAssets`, LINK_LOCAL_PATH), because the bridge's
 * `host.assets.bytes` reads `file:` URLs and a hook such as Logo Wall's inlines
 * what it reads into the export.
 */
export async function mountTool(
  toolId: string, host: HostV1, query = '', values?: Record<string, unknown>,
  opts: { fromLink?: boolean; linkPassword?: string; untrustedValues?: boolean; emojiStamp?: SessionEmojiStamp } = {},
): Promise<MountResult> {
  // Expand a packed `z=` share link FIRST (mirrors shells/cli/src/run.ts) - a no-op on a
  // readable or empty query. Without this the TUI silently loads a packed link at defaults.
  const expanded = query ? await openLinkQuery(query, opts.linkPassword) : '';
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
  if (opts.emojiStamp && !reserved.emoji && !reserved.emojiStyle && !Object.hasOwn(values ?? {}, '__emoji')) {
    reserved.emoji = opts.emojiStamp.emoji; reserved.emojiFx = opts.emojiStamp.emojifx; reserved.emojiStyle = opts.emojiStamp.emojistyle ?? null;
  }
  if (opts.fromLink) {
    const { linkLocalFile } = await import('../../cli/src/block-files.ts');
    const hit = await linkLocalFile(tool.manifest as Parameters<typeof linkLocalFile>[0], (opts.untrustedValues ? { ...reserved.values, ...values } : reserved.values) as Record<string, unknown>);
    if (hit) throw new LinkLocalFileError(hit);
  }
  const initial = values ? { ...reserved.values, ...values } : reserved.values;
  const selection = values?.__tokenSelection as Record<string, string> | undefined ?? reserved.tokenSelection ?? undefined;
  selectCliBridgeTokens(host, selection);
  // The link's size is the canvas size the hooks first lay out for (engine 1.293); the
  // Export panel's width and height move it from there (setCanvasSizeFrom).
  const runtime = await createRuntime(tool, host, initial as Parameters<typeof createRuntime>[2], {
    canvasSize: canvasSizeOf(reserved.width, reserved.height, reserved.unit ?? 'px'),
    tokenSelection: selection,
  });
  selectCliBridgeTokens(host, runtime.tokenSelection);
  runtimeHosts.set(runtime, host);
  await (await import('./document-emoji.ts')).seedEmoji(runtime,host,reserved,values);
  return { runtime, manifest: tool.manifest, reserved };
}

/** Keep engine inputs and shell-owned CSS/native exports on the same colourway. */
export async function setDocumentTokenSelection(runtime: Runtime, host: HostV1, selection: Record<string, string>): Promise<void> {
  runtimeHosts.set(runtime, host);
  selectCliBridgeTokens(host, selection);
  try { await runtime.setTokenSelection(selection); }
  finally { selectCliBridgeTokens(host, runtime.tokenSelection); }
}

/**
 * Tell the tool the canvas size the Export panel's width, height and unit describe
 * (engine 1.293), the same CSS pixels the web shell hands it for that size. Both
 * sides blank or invalid is the tool's own size. A tool that follows the size lays
 * itself out again. True when the size changed: the caller then repaints the preview.
 */
export async function setCanvasSizeFrom(runtime: Runtime, dims: { width?: number; height?: number; unit?: string }): Promise<boolean> {
  const before = runtime.canvasSize;
  await runtime.setCanvasSize(canvasSizeOf(dims.width, dims.height, dims.unit || 'px'));
  return runtime.canvasSize !== before;
}

/** Decrypt before parsing or mounting; an unreadable link never becomes a default document. */
export class LinkPasswordError extends Error {}
export async function openLinkQuery(query: string, password?: string): Promise<string> {
  const expanded = await expandQuery(query);
  if (!hasEncryptedState(expanded)) return expanded;
  if (!password) throw new LinkPasswordError('This link needs its password. No document was opened.');
  const params = new URLSearchParams(expanded);
  const plain = await unpackEncrypted(params.get(ENC_PARAM) ?? '', password);
  if (plain === null) throw new LinkPasswordError('Wrong password or damaged link. No document was opened.');
  params.delete(ENC_PARAM);
  return expandQuery([plain, params.toString()].filter(Boolean).join('&'));
}

/** The current state as a URL query, including document choices and export controls. */
export function currentQuery(runtime: Runtime, options: Parameters<typeof serializeUrlState>[1] & { filename?: string } = {}, publicOnly = false): string {
  const style = runtime.emoji.style;
  const query = (publicOnly ? shareUrlState : serializeUrlState)(runtime.getModel(), {
    ...options, tokenSelection: runtime.tokenSelection,
    ...(style ? { emojiStyle: JSON.stringify(style) } : { emoji: 'none' }),
  });
  const params = new URLSearchParams(query);
  if (options.filename) params.set('filename', options.filename);
  return params.toString();
}

/** Saved values keep the markers the other shells read. */
export function modelValues(runtime: Runtime): Record<string, unknown> {
  return {
    ...Object.fromEntries(runtime.getModel().map(i => [i.id, i.value])),
    __tokenLinks: tokenRestoreRefsOf(runtime.getModel()),
    ...(runtime.tokenSelection ? { __tokenSelection: runtime.tokenSelection } : {}),
    __emoji: runtime.emoji.style,
  };
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

async function hydrateCanvas(runtime: Runtime, dom: JSDOM): Promise<HTMLElement> {
  const canvas = canvasOf(dom);
  canvas.innerHTML = runtime.getHydrated();
  for (const name of Array.from({ length: canvas.style.length }, (_, index) => canvas.style.item(index))) {
    if (name.startsWith('--')) canvas.style.removeProperty(name);
  }
  const host = runtimeHosts.get(runtime);
  if (host) await applyBrandVars(canvas, host);
  return canvas;
}

/**
 * Render the runtime's CURRENT state to an SVG string, or null when this tool can't
 * produce SVG in a pure-Node shell (HTML-layout tools need a browser engine). Used
 * for the terminal image preview - resvg rasterises the returned SVG.
 *
 * `dims` is the size a PNG export will be drawn at. As in the CLI's Tier A
 * (shells/cli/src/raster.ts), it reaches the SVG export as the width and height an
 * SVG export of that size gets, so a tool that lays itself out for the export's
 * shape (Logo Wall) draws the same picture into both, and only when the drawn root
 * <svg> has a viewBox, so a tool without one keeps the scaling the PNG always had.
 */
export async function renderSvg(runtime: Runtime, dom: JSDOM, dims?: ExportDims): Promise<string | null> {
  try {
    const canvas = await hydrateCanvas(runtime, dom);
    // The terminal preview is a surface a person looks at, so it draws emoji from
    // the chosen set like any other canvas. Stated here rather than left to the
    // side effect of the export below, which walks the same node a moment later.
    await runtime.applyEmojiToDom(canvas);
    const blob = await runtime.export(canvas, 'svg', svgExportSize(canvas, dims));
    return await blob.text();
  } catch {
    return null;
  }
}

/** Output size options for an export (mirrors the web/CLI: width/height are values in
 *  `unit`; a physical unit qualifies them so the engine converts per format). Extends
 *  the shared render dims (incl. the `password` PDF-lock param) with the TUI's
 *  Content-Credentials window. */
export interface ExportDims extends RenderDims {
  c2paDays?: number;
  /** The caller's own "no credential": none is stamped, and none stays in the file. */
  c2paOff?: boolean;
}

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
  // exit 0, with nothing to show for it. Refuse by name instead. Shared message, no drift vs the CLI.
  if ((dims.bleed || dims.marks) && !canCarryPrintPrep(fmt)) {
    throw new Error(printPrepRefusal(fmt));
  }
  const transform = isTransform(manifest);
  // A password this file cannot carry is refused before anything renders. A utility and a
  // capture write their own bytes, so those are read back in write() below instead.
  if (dims.password && !transform) {
    const refusal = exportPasswordRefusal(fmt, { password: dims.password, bleed: dims.bleed, marks: dims.marks });
    if (refusal) throw new Error(refusal);
  }
  // The canvas size is the export's own (engine 1.293), so a tool that lays itself out
  // for the canvas draws this file at this shape. A no-op when the view already set that size.
  await setCanvasSizeFrom(runtime, dims);
  // The design-system record (plans/319): the export panel's Design system row sets it
  // per export, so the runtime's own exports and the Tier-B URL read one switch.
  if (typeof dims.madeWith === 'boolean') runtime.setMadeWith(dims.madeWith);
  /** A Design page the Node bridge drew from the operations: its route and the credentialed pictures it drew (plan 326). */
  type DrawnHere = { pictures: IngredientCredential[]; route: DesignExportRouteRecord | null };
  const write = async (bytes: Uint8Array, viaWebShell = false, drawn?: DrawnHere): Promise<number> => {
    // Optionally stamp Content Credentials (C2PA) as the LAST byte operation - same rule
    // as the CLI/web. NEVER on transform utilities (strip-data's whole job is to REMOVE
    // metadata). A requested credential must succeed before bytes are written.
    // The Tier-B (web shell) branch already stamped via the forwarded ?c2pa param, so it
    // passes viaWebShell=true to skip re-stamping (avoids a double credential).
    // Off means none: an SVG that inlines credentialed artwork still holds that piece's manifest.
    let out = dims.c2paOff ? withoutSvgCredentials(bytes, fmt) : bytes;
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
          // The design system and colourway the file's own metadata records
          // (plans/319), so the credential gives the same ones. Bytes the runtime
          // did not export itself (a capture) are read back for one.
          meta: runtime.lastExportMeta ?? readFileDesignRecord(bytes),
          // Same reason as the CLI: this shell stamps here rather than in
          // host.export.render, so the emoji artwork the render placed has to be
          // handed over explicitly or its licence would go unrecorded.
          ingredients: [...runtime.emojiIngredients(), ...(drawn?.pictures ?? [])],
          route: drawn?.route ?? null,
        }));
      } catch (error) { throw new Error('Could not add the requested Content Credentials: ' + (error as Error).message); }
    }
    if (dims.c2paDays && !transform && C2PA_FORMATS.includes(fmt) && !extractC2paStore(out)) throw new Error('The requested Content Credentials are missing from the output. No file was written.');
    if (!transform) assertFormatBytes(fmt, out);
    // Every route ends here, so this is the last word: the file holds the lock or nothing is written.
    if (dims.password) await assertExportLocked(out, fmt, dims.password);
    const buf = Buffer.from(out);
    await writeFile(outPath, buf);
    return buf.length;
  };

  // 1. On-device transform utilities (strip-data, compress-pdf) produce bytes via the
  //    exportFile hook, not a render.
  if (transform) {
    // exportFile returns one result or a batch (a `multiple` file input). The CLI/TUI
    // path is single-file (one --file arg → one --output), so take the first result.
    const res = await runtime.exportFile(dims.password ? { password: dims.password } : {});
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
  const floatScene = needsFloatScene(manifest.id, modelValues(runtime).editingRange, fmt, dims.hdrParam);
  if (NODE_FORMATS.includes(fmt) && !floatScene) {
    const canvas = await hydrateCanvas(runtime, dom);
    // Qualify a physical unit onto the value (e.g. 210 + mm → "210mm"); px passes as a
    // number. Blank → the tool's native size. Mirrors shells/cli/src/run.ts.
    const u = dims.unit || 'px';
    const qual = (v: number | undefined): string | number | undefined =>
      (typeof v === 'number' && v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
    const drawn: DrawnHere = { pictures: [], route: null };
    const opts: { width?: string | number; height?: string | number; dpi?: number; spotsAsProcess?: boolean; ingredientSink: IngredientCredential[]; onExportRoute: (record: DesignExportRouteRecord) => void } = {
      width: qual(dims.width), height: qual(dims.height), ingredientSink: drawn.pictures, onExportRoute: (record) => { drawn.route = record; },
    };
    // eps-cmyk: the choice means one thing in every CMYK sink (EPS has no named plates, so its bytes do not move).
    if (dims.spotsAsProcess) opts.spotsAsProcess = true;
    if (u !== 'px' && dims.dpi) opts.dpi = dims.dpi;
    const query = currentQuery(runtime);
    try {
      const blob = await runtime.export(canvas, fmt, opts);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      assertRenderOk({ hookErrors: runtime.hookErrors, format: fmt, bytes });
      return write(bytes, false, drawn);
    } catch (error) {
      // HTML artwork needs the same vector walker used by web and CLI exports.
      // A failed hook or an intervening edit cannot be retried as a fresh render.
      if (!['svg', 'emf', 'eps', 'eps-cmyk', 'dxf', 'penpot'].includes(fmt) ||
          (error as Error)?.name === 'RenderIntegrityError' || runtime.hookErrors.length ||
          currentQuery(runtime) !== query) throw error;
    }
  }

  // 3b. PNG from an SVG-native tool: rasterise the engine's own SVG via resvg - no
  //     browser and no built web shell needed (the fast, always-available raster path,
  //     mirroring the MCP server's Tier A+resvg). resvg emits PNG only; jpg/webp/pdf
  //     fall through to the web-shell tier below. The Imprint is embedded HERE too, in
  //     the pixels, so imprint-by-default never drags a PNG into the browser tier (the
  //     same fix shells/cli/src/raster.ts made). Only the DURABLE (neural TrustMark)
  //     mark still needs the web shell's export path, so that alone falls through.
  if (!floatScene && modelValues(runtime).editingRange !== 'hdr' && eligibleForResvgPng(fmt, dims)) {
    const svg = await renderSvg(runtime, dom, dims);
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
  // setting (c2paDays>0 ⇒ on at that lifetime; c2paOff ⇒ off; neither ⇒ the tool's own default) and skip the
  // Node re-stamp in write(). This also carries any bleed/marks/imprint/pressProfile the
  // shared RenderDims holds through exportUrl.
  const webDims = { ...dims, c2pa: dims.c2paDays ? true : dims.c2paOff ? false : undefined, c2paDays: dims.c2paDays };
  const { bytes } = await renderViaWebShell(id, currentQuery(runtime), fmt, webDims);
  return write(bytes, true);
}
