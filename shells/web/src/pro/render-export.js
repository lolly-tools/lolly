// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — render one row to an export Blob, fully offscreen.
 *
 * Reuses the SAME engine render path as the single-tool view: loadTool →
 * createRuntime → hydrate → host.export.render. The only difference is that the
 * tool is mounted into a detached, off-viewport node instead of the visible
 * canvas. Because we go through runtime.export(), experimental-tool watermarking
 * is enforced for free (see engine/src/runtime.js).
 *
 * The small DOM helpers below (scopeCss / runTemplateScripts / waitForQuiescence)
 * are intentionally faithful, self-contained copies of the ones in views/tool.js.
 * Duplicating ~40 lines keeps this feature removable without refactoring the
 * 2000-line single-tool view — a deliberate hygiene trade-off.
 */
import { createRuntime, toCssPx, serializeUrlState, packQuery, isPackAvailable, PACK_PARAM } from '@lolly/engine';

// Absolute short-form tool URL — `https://lolly.tools/t/<id>?<inputs>`, the human
// "open this tool" address (mirrors views/tool.js TOOL_URL_BASE + the domain
// buildEmbedUrl hardcodes). `query` is the already-encoded input/export params.
const LOLLY_ORIGIN = 'https://lolly.tools';
const toolShareUrl = (toolId, query) => `${LOLLY_ORIGIN}/t/${toolId}${query ? `?${query}` : ''}`;

// Prefer the compressed `z=<token>` query for long links: a blocks-heavy tool (e.g. a
// wayfinding sign's `directions` JSON) serialises to a huge readable query, so we DEFLATE
// it into the reserved pack param whenever that actually shortens the URL. The reopen
// route (views/tool.js) runs expandQuery on load, so a packed `/t/<id>?z=…` reopens
// identically. Threshold is LOWER than the address bar's ~1800 (see tool.js AUTO_PACK_MIN):
// a lolly.txt link is copied, not hand-edited, so shortness beats readability. Never
// regresses — the packed form is only swapped in when it's strictly shorter.
const PACK_QUERY_MIN = 256;
async function preferCompactQuery(query) {
  if (!query || query.length < PACK_QUERY_MIN || !isPackAvailable()) return query;
  const token = await packQuery(query);
  const packed = token && `${PACK_PARAM}=${token}`;
  return packed && packed.length < query.length ? packed : query;
}
import { getTool, chooseFormat, isExportable } from '../bridge/tool-loader.js';
import { neutralizeEmbeds, hydrateEmbeds } from '../bridge/embed.js';

// Re-exported for existing importers (pro/batch, pro/index, pro/sessions) that
// historically pulled these from here. The definitions now live in tool-loader.js
// so bridge/embed.js can share them without a circular import.
export { getTool, chooseFormat, isExportable };

const CANVAS_CLASS = 'pro-export-canvas';

/**
 * Render a single row and return { blob, format }.
 * @param {{toolId:string, values:object}} row
 * @param {HostV1} host
 * @param {{format?:string, width?:number, height?:number, unit?:string, dpi?:number}} opts
 *        preferred format + optional output dimensions. width/height are values
 *        in `unit` (px/mm/cm/in/pt); blank falls back to the tool's native size.
 *        `dpi` sets raster resolution for physical units.
 */
export async function renderRowToBlob(row, host, { format, width, height, unit = 'px', dpi, composeStack, watermark, embedMeta, thumbnail } = {}) {
  const tool = await getTool(row.toolId);
  if (!isExportable(tool.manifest)) {
    throw new Error(`"${tool.manifest.name}" is render-only and cannot be exported.`);
  }

  const nativeW = tool.manifest.render.width;
  const nativeH = tool.manifest.render.height;

  // Establish the requested ASPECT at canvas creation — not at export. When both
  // dimensions are given we render the (responsive) tool into a box of that
  // aspect, in CSS px, so its layout adapts correctly. The export then does a
  // uniform unit→medium scale (no squashing). Blank → the tool's native size.
  const bothGiven = width > 0 && height > 0;
  const layoutW = bothGiven ? Math.max(1, Math.round(toCssPx({ value: width, unit }))) : nativeW;
  const layoutH = bothGiven ? Math.max(1, Math.round(toCssPx({ value: height, unit }))) : nativeH;

  // Feed the layout size to a tool's width/height inputs (if it declares them),
  // so hook-driven responsive tools recompute — mirrors the single-tool preview.
  const seeded = { ...(row.values ?? {}) };
  const inputIds = new Set((tool.manifest.inputs ?? []).map(i => i.id));
  if (bothGiven) {
    if (inputIds.has('width')  && seeded.width  == null) seeded.width  = layoutW;
    if (inputIds.has('height') && seeded.height == null) seeded.height = layoutH;
  }
  // composeStack threads tool-id recursion state down when this render is itself
  // a composed child (set by the compose bridge); undefined for normal batch rows.
  const runtime = await createRuntime(tool, host, seeded, { composeStack });

  // Export dimension qualified with the unit (px / mm / cm / in / pt) so the
  // engine converts per format; blank falls back to the native canvas size.
  const dim = (v) => (v > 0 ? (unit && unit !== 'px' ? `${v}${unit}` : v) : undefined);
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
    await waitForQuiescence(canvas);
    // Resolve embeds to local blob/data URLs before export so the embedded render
    // appears in the output (the existing image seams then handle the blob). The
    // compose stack is threaded so an embed inside a composed child stays guarded.
    await hydrateEmbeds(canvas, { host, embed: { stack: composeStack ?? [] } });
    // Mount lottie players on any [data-lottie-src] markers — batch/folder renders
    // bypass the live-preview wiring in views/tool.js, so without this the capture
    // would show empty containers. The chunk loads only when a marker exists.
    if (canvas.querySelector('[data-lottie-src]')) {
      const { mountLottiePlayers, destroyLottiePlayers } = await import('../views/lottie-mount.js');
      await mountLottiePlayers(canvas);
      stage._lottieCleanup = () => destroyLottiePlayers(canvas);
    }
    const fmt = chooseFormat(tool.manifest, format);
    // A "reopen in Lolly" link: this tool's short URL carrying the exact inputs +
    // export settings used for THIS render, so a zip recipient can return to
    // lolly.tools and recreate (or tweak) the file. Serialised from the live model so
    // values encode the same compact way the address bar does. Surfaced in the zip's
    // lolly.txt (see creditText in pro/zip.js); ignored on the compose/thumbnail paths.
    const url = toolShareUrl(tool.manifest.id, await preferCompactQuery(serializeUrlState(runtime.getModel(), {
      format: fmt, width, height, unit, dpi: unit !== 'px' ? dpi : undefined,
    })));
    // watermark/embedMeta/thumbnail are forwarded only when set (compose passes
    // watermark:false + embedMeta:false so an embedded child isn't stamped); batch
    // rows leave them undefined so runtime.export keeps its normal defaults.
    const exportOpts = { width: outW, height: outH, dpi };
    if (watermark !== undefined) exportOpts.watermark = watermark;
    if (embedMeta !== undefined) exportOpts.embedMeta = embedMeta;
    if (thumbnail !== undefined) exportOpts.thumbnail = thumbnail;
    const blob = await runtime.export(canvas, fmt, exportOpts);
    return { blob, format: fmt, url };
  } finally {
    stage._lottieCleanup?.(); // destroyed players unregister from animationManager
    stage.remove();
  }
}

// ── DOM helpers (faithful copies of views/tool.js internals) ─────────────────

function scopeCss(css, scopeSelector) {
  return css.replace(/(^|\})\s*([^{}]+)\s*\{/g, (m, brace, sel) => {
    if (sel.trim().startsWith('@')) return m;
    const scoped = sel.split(',').map(s => `${scopeSelector} ${s.trim()}`).join(', ');
    return `${brace} ${scoped} {`;
  });
}

function runTemplateScripts(container) {
  container.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    [...old.attributes].forEach(a => s.setAttribute(a.name, a.value));
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

// Resolves once the node has been mutation-quiet for silenceMs (and any opt-in
// async 'tool:ready' signal has fired), or after timeoutMs regardless.
async function waitForQuiescence(node, { silenceMs = 350, timeoutMs = 8000 } = {}) {
  await document.fonts.ready;

  const needsReadySignal = !!window.__toolHasReadySignal;
  delete window.__toolHasReadySignal;

  return new Promise(resolve => {
    let settled = false;
    let silenceTimer = null;
    let isReady = !needsReadySignal;
    let isSilent = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(silenceTimer);
      clearTimeout(capTimer);
      observer.disconnect();
      document.removeEventListener('tool:ready', onReady);
      resolve();
    };
    const tryFinish = () => { if (isReady && isSilent) finish(); };
    const resetSilence = () => {
      isSilent = false;
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { isSilent = true; tryFinish(); }, silenceMs);
    };
    const onReady = () => { isReady = true; tryFinish(); };

    const observer = new MutationObserver(resetSilence);
    observer.observe(node, { childList: true, subtree: true, attributes: true, characterData: true });
    document.addEventListener('tool:ready', onReady, { once: true });

    const capTimer = setTimeout(finish, timeoutMs);
    resetSilence();
  });
}
