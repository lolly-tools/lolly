// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — render one row to an export Blob, fully offscreen.
 *
 * Reuses the SAME engine render path as the single-tool view: loadTool →
 * createRuntime → hydrate → host.export.render. The only difference is that the
 * tool is mounted into a detached, off-viewport node instead of the visible
 * canvas. Because we go through runtime.export(), experimental-tool watermarking
 * is enforced for free (see engine/src/runtime.ts).
 *
 * The DOM lifecycle (scopeCss / runTemplateScripts / waitForQuiescence) is the
 * shared implementation in ../render/ — the same one views/tool.js uses — so
 * the visible and batch paths can no longer drift (finding 4). This path keeps
 * its historical, slightly shorter silence window (350ms vs the canvas's 400ms).
 */
import { createRuntime, toCssPx, serializeUrlState, packQuery, isPackAvailable, PACK_PARAM } from '@lolly/engine';
import type { ToolManifest, InputValue, RuntimeHost, Unit } from '@lolly/engine';
import { scopeCss, runTemplateScripts, waitForQuiescence } from '../render/lifecycle.ts';
import { getTool, chooseFormat, isExportable } from '../bridge/tool-loader.ts';
import { neutralizeEmbeds, hydrateEmbeds } from '../bridge/embed.ts';

// Re-exported for existing importers (pro/batch, pro/index, pro/sessions) that
// historically pulled these from here. The definitions now live in tool-loader.js
// so bridge/embed.js can share them without a circular import.
export { getTool, chooseFormat, isExportable };

// Absolute short-form tool URL — `https://lolly.tools/t/<id>?<inputs>`, the human
// "open this tool" address (mirrors views/tool.js TOOL_URL_BASE + the domain
// buildEmbedUrl hardcodes). `query` is the already-encoded input/export params.
const LOLLY_ORIGIN = 'https://lolly.tools';
const toolShareUrl = (toolId: string, query: string): string =>
  `${LOLLY_ORIGIN}/t/${toolId}${query ? `?${query}` : ''}`;

// Prefer the compressed `z=<token>` query for long links: a blocks-heavy tool (e.g. a
// wayfinding sign's `directions` JSON) serialises to a huge readable query, so we DEFLATE
// it into the reserved pack param whenever that actually shortens the URL. The reopen
// route (views/tool.js) runs expandQuery on load, so a packed `/t/<id>?z=…` reopens
// identically. Threshold is LOWER than the address bar's ~1800 (see tool.js AUTO_PACK_MIN):
// a lolly.txt link is copied, not hand-edited, so shortness beats readability. Never
// regresses — the packed form is only swapped in when it's strictly shorter.
const PACK_QUERY_MIN = 256;
async function preferCompactQuery(query: string): Promise<string> {
  if (!query || query.length < PACK_QUERY_MIN || !isPackAvailable()) return query;
  const token = await packQuery(query);
  const packed = token && `${PACK_PARAM}=${token}`;
  return packed && packed.length < query.length ? packed : query;
}

const CANVAS_CLASS = 'pro-export-canvas';

/** One batch row: which tool to render and the input values to seed it with. */
export interface BatchRow {
  toolId: string;
  values?: Record<string, InputValue>;
}

export interface RenderRowOpts {
  /** Preferred export format; falls back per manifest via chooseFormat. */
  format?: string;
  /** Output dimensions in `unit` (px/mm/cm/in/pt); blank → the tool's native size. */
  width?: number;
  height?: number;
  unit?: Unit;
  /** Raster resolution for physical units. */
  dpi?: number;
  /** Tool-id recursion state when this render is itself a composed child. */
  composeStack?: string[];
  /** Forwarded to runtime.export only when set (compose passes false so an
   *  embedded child isn't stamped); undefined keeps the runtime defaults. */
  watermark?: boolean;
  embedMeta?: boolean;
  thumbnail?: boolean;
}

export interface RenderRowResult {
  blob: Blob;
  format: string;
  /** "Reopen in Lolly" share URL carrying the exact inputs + export settings. */
  url: string;
}

/** Render a single row and return its export blob + format + reopen URL. */
export async function renderRowToBlob(
  row: BatchRow,
  host: RuntimeHost,
  { format, width, height, unit = 'px', dpi, composeStack, watermark, embedMeta, thumbnail }: RenderRowOpts = {},
): Promise<RenderRowResult> {
  const tool = await getTool(row.toolId);
  const manifest: ToolManifest = tool.manifest;
  if (!isExportable(manifest)) {
    throw new Error(`"${manifest.name}" is render-only and cannot be exported.`);
  }

  const nativeW = manifest.render.width;
  const nativeH = manifest.render.height;

  // Establish the requested ASPECT at canvas creation — not at export. When both
  // dimensions are given we render the (responsive) tool into a box of that
  // aspect, in CSS px, so its layout adapts correctly. The export then does a
  // uniform unit→medium scale (no squashing). Blank → the tool's native size.
  const bothGiven = width !== undefined && width > 0 && height !== undefined && height > 0;
  const layoutW = bothGiven ? Math.max(1, Math.round(toCssPx({ value: width, unit }))) : nativeW;
  const layoutH = bothGiven ? Math.max(1, Math.round(toCssPx({ value: height, unit }))) : nativeH;

  // Feed the layout size to a tool's width/height inputs (if it declares them),
  // so hook-driven responsive tools recompute — mirrors the single-tool preview.
  const seeded: Record<string, InputValue> = { ...(row.values ?? {}) };
  const inputIds = new Set((manifest.inputs ?? []).map(i => i.id));
  if (bothGiven) {
    if (inputIds.has('width') && seeded.width == null) seeded.width = layoutW;
    if (inputIds.has('height') && seeded.height == null) seeded.height = layoutH;
  }
  // composeStack threads tool-id recursion state down when this render is itself
  // a composed child (set by the compose bridge); undefined for normal batch rows.
  const runtime = await createRuntime(tool, host, seeded, { composeStack });

  // Export dimension qualified with the unit (px / mm / cm / in / pt) so the
  // engine converts per format; blank falls back to the native canvas size.
  const dim = (v: number | undefined): string | number | undefined =>
    v !== undefined && v > 0 ? (unit && unit !== 'px' ? `${v}${unit}` : v) : undefined;
  const outW = dim(width);
  const outH = dim(height);

  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = `position:fixed;left:-100000px;top:0;width:${layoutW}px;height:${layoutH}px;pointer-events:none;z-index:-1;`;

  if (tool.styles) {
    const style = document.createElement('style');
    style.textContent = scopeCss(tool.styles, `.${CANVAS_CLASS}`);
    stage.appendChild(style);
  }

  const canvas = document.createElement('div');
  canvas.className = CANVAS_CLASS;
  canvas.style.cssText = `width:${layoutW}px;height:${layoutH}px;`;
  // Neutralise any lolly.tools embed URLs BEFORE insertion so this off-screen
  // node (batch row / composed child / single export) never fires a network
  // request for them — the live-preview wiring in views/tool.js isn't on this path.
  canvas.innerHTML = neutralizeEmbeds(runtime.getHydrated());
  stage.appendChild(canvas);
  document.body.appendChild(stage);

  try {
    runTemplateScripts(canvas);
    await waitForQuiescence(canvas, { silenceMs: 350 });
    // Resolve embeds to local blob/data URLs before export so the embedded render
    // appears in the output (the existing image seams then handle the blob). The
    // compose stack is threaded so an embed inside a composed child stays guarded.
    await hydrateEmbeds(canvas, { host, embed: { stack: composeStack ?? [] } });
    const fmt = chooseFormat(manifest, format);
    // A "reopen in Lolly" link: this tool's short URL carrying the exact inputs +
    // export settings used for THIS render, so a zip recipient can return to
    // lolly.tools and recreate (or tweak) the file. Serialised from the live model so
    // values encode the same compact way the address bar does. Surfaced in the zip's
    // lolly.txt (see creditText in pro/zip.js); ignored on the compose/thumbnail paths.
    const url = toolShareUrl(manifest.id, await preferCompactQuery(serializeUrlState(runtime.getModel(), {
      format: fmt, width, height, unit, dpi: unit !== 'px' ? dpi : undefined,
    })));
    // watermark/embedMeta/thumbnail are forwarded only when set (compose passes
    // watermark:false + embedMeta:false so an embedded child isn't stamped); batch
    // rows leave them undefined so runtime.export keeps its normal defaults.
    const exportOpts: { width?: string | number; height?: string | number; dpi?: number; watermark?: boolean; embedMeta?: boolean; thumbnail?: boolean } =
      { width: outW, height: outH, dpi };
    if (watermark !== undefined) exportOpts.watermark = watermark;
    if (embedMeta !== undefined) exportOpts.embedMeta = embedMeta;
    if (thumbnail !== undefined) exportOpts.thumbnail = thumbnail;
    const blob = await runtime.export(canvas, fmt, exportOpts);
    return { blob, format: fmt, url };
  } finally {
    stage.remove();
  }
}
