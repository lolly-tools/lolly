// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - render one row to an export Blob, fully offscreen.
 *
 * Reuses the SAME engine render path as the single-tool view: loadTool →
 * createRuntime → hydrate → host.export.render. The only difference is that the
 * tool is mounted into a detached, off-viewport node instead of the visible
 * canvas. Because we go through runtime.export(), experimental-tool watermarking
 * is enforced for free (see engine/src/runtime.js).
 *
 * The render-lifecycle helpers (scopeCss / runTemplateScripts /
 * waitForQuiescence) are now shared with views/tool.js via ../lib/
 * (scope-css.ts + render-lifecycle.ts) instead of being hand-copied here, so
 * the batch/compose path can no longer drift from the live view (finding #4).
 */
import { toCssPx, serializeUrlState, packQuery, isPackAvailable, PACK_PARAM } from '@lolly/engine';
import { createToolRuntime as createRuntime } from '../lib/mount-runtime.ts';
import { csvToMarks } from '../lib/print-marks-csv.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue, InputModelItem } from '../../../../engine/src/inputs.ts';
import type { CanvasCommitEl } from '../lib/canvas-commit.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { Unit } from '../../../../engine/src/units.ts';

// Absolute short-form tool URL - `https://lolly.tools/t/<id>?<inputs>`, the human
// "open this tool" address (mirrors views/tool.js TOOL_URL_BASE + the domain
// buildEmbedUrl hardcodes). `query` is the already-encoded input/export params.
const LOLLY_ORIGIN = 'https://lolly.tools';
const toolShareUrl = (toolId: string, query: string): string => `${LOLLY_ORIGIN}/t/${toolId}${query ? `?${query}` : ''}`;

// Prefer the compressed `z=<token>` query for long links: a blocks-heavy tool (e.g. a
// wayfinding sign's `directions` JSON) serialises to a huge readable query, so we DEFLATE
// it into the reserved pack param whenever that actually shortens the URL. The reopen
// route (views/tool.js) runs expandQuery on load, so a packed `/t/<id>?z=…` reopens
// identically. Threshold is LOWER than the address bar's ~1800 (see tool.js AUTO_PACK_MIN):
// a lolly.txt link is copied, not hand-edited, so shortness beats readability. Never
// regresses - the packed form is only swapped in when it's strictly shorter.
const PACK_QUERY_MIN = 256;
async function preferCompactQuery(query: string): Promise<string> {
  if (!query || query.length < PACK_QUERY_MIN || !isPackAvailable()) return query;
  const token = await packQuery(query);
  const packed = token && `${PACK_PARAM}=${token}`;
  return packed && packed.length < query.length ? packed : query;
}
import { getTool, chooseFormat, isExportable } from '../bridge/tool-loader.ts';
import { neutralizeEmbeds, hydrateEmbeds } from '../bridge/embed.ts';
import { createNetAPI } from '../bridge/net.ts';
import { applyBrandVars } from '../brand-vars.ts';
import { scopeCss, scopeTemplateStyles } from '../lib/scope-css.ts';
import { runTemplateScripts, waitForQuiescence } from '../lib/render-lifecycle.ts';
import { c2paDefaultOn } from '../lib/c2pa-policy.ts';
import { MOTION_EXPORT_FORMATS } from './folder-rows.ts';

// Re-exported for existing importers (pro/batch, pro/index, pro/sessions) that
// historically pulled these from here. The definitions now live in tool-loader.js
// so bridge/embed.js can share them without a circular import.
export { getTool, chooseFormat, isExportable };

const CANVAS_CLASS = 'pro-export-canvas';

// Motion export formats - captured as a live clip, not a single frame. When one of
// these is requested, the offscreen render feeds the tool's own clip settings
// (render.video) to the exporter's frame loop. Everything else exports one still.
// Single source of truth lives in folder-rows (also used by the batch exporter).
// Cap an embedded/composed clip's length so a nested render can't queue a huge
// real-time capture (Phase-1 buffers every frame) or a multi-MB data URL.
const EMBED_MAX_DURATION = 6;

// Post-mount settle before capture. Batch path historically settled a touch faster
// than the live view (350 vs the shared 400ms default); preserved explicitly so the
// extraction into mountToolCanvas changed nothing. Overridable per render via
// RenderRowOpts.settleMs - see the constraint documented there.
const SETTLE_MS = 350;

/** One batch row: which tool to render and the input values to seed it with,
 *  plus the per-row PRINT settings (kept structurally compatible with
 *  pro/batch.ts `BatchRow` and pro/folder-rows.ts `ExportRow` - the row shape is
 *  declared in three places today, so a field added for the batch path has to be
 *  added here too or it is silently dropped at the render boundary). */
interface BatchRow {
  toolId: string;
  values?: Record<string, InputValue>;
  /** CMYK press condition (the `profile` URL param), for pdf-cmyk / cmyk-tiff. */
  profile?: string;
  /** Bleed as a dimension string, e.g. "3mm". */
  bleed?: string;
  /** Print marks as the `marks` CSV - decoded by lib/print-marks-csv.ts. */
  marks?: string;
}

/** Preferred format + optional output dimensions for a batch render. */
interface RenderRowOpts {
  format?: string;
  width?: number;
  height?: number;
  unit?: Unit;
  dpi?: number;
  composeStack?: readonly string[];
  watermark?: boolean;
  embedMeta?: boolean;
  thumbnail?: boolean;
  /** Frame a preview around the first page/artboard when the tool supplies one. */
  previewPage?: boolean;
  /** Exact poster time for a curated motion template, through the shared clock. */
  previewTimeMs?: number;
  /**
   * Resolve raster catalog assets to their small `thumb` derivative instead of the
   * full-res original. ONLY for gallery/preview thumbnails (featured row, personalized
   * tile previews) - NOT compose/batch/real exports, which need full resolution. Safe
   * for any asset: pickFormat falls back to the original when no thumb exists, and
   * vector/lottie/video assets ignore the hint. See scripts/build-thumbnails.ts.
   */
  thumbAssets?: boolean;
  /** AES-256 lock applied to a pdf/pdf-cmyk output (ignored for other formats). */
  strongPassword?: string;
  /**
   * Content Credentials for THIS render. Unset → the shared default policy
   * (lib/c2pa-policy.ts) - the same rule the tool view's Export button applies - 
   * so batch/zip members are signed like single exports. A compose/preview
   * caller that passes embedMeta:false is never stamped regardless.
   */
  c2pa?: boolean;
  /**
   * Lolly pixel watermark (bridge/export.ts opts.imprint) - lets a batch/zip run
   * carry the export panel's toggle per row. Forwarded only when true; the bridge
   * embeds it on raster formats and ignores it elsewhere.
   */
  imprint?: boolean;
  /**
   * Override the post-mount settle (default SETTLE_MS). Only for a caller that
   * KNOWS the child mounts no image/lottie/video - the default exists to give
   * that media time to decode, and a short settle would capture it blank.
   */
  settleMs?: number;
}

/**
 * A shallow host wrapper whose asset resolver defaults raster lookups to the `thumb`
 * derivative format. The engine runtime resolves example photos via host.assets.get
 * during hydration; wrapping it here means a preview render ingests a ~30 KB thumbnail
 * instead of a 400 KB original - cutting both the fetch weight and the main-thread
 * rasterise cost of the gallery's featured row. host.assets methods are closures (not
 * `this`-bound), so a spread copy is safe.
 */
function withThumbAssets(host: HostV1): HostV1 {
  const assets = host.assets;
  return {
    ...host,
    assets: {
      ...assets,
      get: (id: string, opts: { format?: string; version?: string } = {}) =>
        assets.get(id, { ...opts, format: opts.format ?? 'thumb' }),
    },
  } as HostV1;
}

/**
 * Per-mount net enforcement, mirroring the live view (views/tool.ts mountTool): a
 * tool whose manifest declares `network.allowlist` renders with a host clone whose
 * `net` is scoped to exactly that list. The shared boot host keeps its fail-closed
 * empty allowlist - never mutated. Wrapping here covers every offscreen path
 * (batch row, composed child, preview), so a nested render can't fetch beyond its
 * OWN manifest grant. Same spread-copy safety rationale as withThumbAssets.
 */
function withToolNet(host: HostV1, manifest: ToolManifest): HostV1 {
  const allowlist = manifest.network?.allowlist;
  return allowlist?.length ? { ...host, net: createNetAPI({ allowlist }) } : host;
}

/**
 * Mount a tool's hydrated template into a fresh off-viewport stage and run the
 * shared post-paint settle. Both renderRowToBlob and renderToolPages go through
 * this so the offscreen lifecycle can't drift between them (they were two near-
 * identical copies), and - like the live view (views/tool.ts paint()) - BOTH
 * lottie AND <video> players are mounted: mountVideoPlayers resolves only once a
 * clip has a decoded frame, so a batch/compose/preview export snapshots a real
 * frame instead of a blank one (previously only lottie was mounted here, so a
 * `[data-video-key]` tool could export a not-yet-decoded frame).
 *
 * `fixedHeight` sets a stage/canvas height for the single-frame row path; omit it
 * for the paged path, which must lay out its full auto height so every page box is
 * measured. Returns the mounted { stage, canvas }; the caller exports from it and
 * MUST call stage._lottieCleanup?.() + stage.remove() in a finally. If the settle
 * itself throws, the stage is torn down here before rethrowing (no leak).
 */
async function mountToolCanvas(
  styles: string | null | undefined,
  hydrated: string,
  { layoutW, fixedHeight, composeStack, host, settleMs, getModel }: { layoutW: number; fixedHeight?: number; composeStack?: readonly string[]; host: HostV1; settleMs?: number; getModel?: () => InputModelItem[] },
): Promise<{ stage: ExportStage; canvas: HTMLDivElement }> {
  const stage: ExportStage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  // `contain:paint` makes the stage the containing block for `position:fixed` descendants (and
  // clips its paint to this box). Without it, a tool template's fixed element (e.g. text-helper's
  // Copy pill) positions against the VIEWPORT - not this left:-100000px stage - and flashes
  // on-screen for the ~350ms it's mounted; a viewport-unit-sized one flashes huge. Paint
  // containment doesn't contain size, so an auto-height stage still lays out fully.
  const heightCss = fixedHeight !== undefined ? `height:${fixedHeight}px;` : '';
  stage.style.cssText = `position:fixed;left:-100000px;top:0;width:${layoutW}px;${heightCss}contain:paint;pointer-events:none;z-index:-1;`;
  if (styles) {
    const style = document.createElement('style');
    style.textContent = scopeCss(styles, `.${CANVAS_CLASS}`);
    stage.appendChild(style);
  }
  const canvas = document.createElement('div');
  canvas.className = CANVAS_CLASS;
  canvas.style.cssText = fixedHeight !== undefined ? `width:${layoutW}px;height:${fixedHeight}px;` : `width:${layoutW}px;`;
  // Neutralise any lolly.tools embed URLs BEFORE insertion so this off-screen node
  // (batch row / composed child / single export) never fires a network request for
  // them - the live-preview wiring in views/tool.ts isn't on this path.
  canvas.innerHTML = neutralizeEmbeds(hydrated);
  // Contain the template's OWN <style> blocks, exactly as views/tool.ts and multi-edit.ts
  // do after their innerHTML swap. This stage is mounted in the LIVE document, so an
  // unscoped template <style> is not merely untidy - it is UNLAYERED, and unlayered CSS
  // beats every @layer in styles/app.css regardless of specificity. Several shipped templates
  // open with `*, *::before, *::after { margin:0; padding:0 }` and one (pose-geeko)
  // declares a bare `svg { width:100%; height:100% }`, so for the ~350ms a
  // stage was mounted those rules repainted the WHOLE app: chrome padding stripped (the
  // tab bar's pill flattens to plain text) and every icon in the page ballooned to 100%
  // of its button. Visible as a flash on a cold gallery→tool navigation, because
  // personalize-previews drives this path at boot. Must run BEFORE the stage is inserted
  // and before anything measures layout.
  scopeTemplateStyles(canvas, `.${CANVAS_CLASS}`);
  stage.appendChild(canvas);
  document.body.appendChild(stage);

  try {
    // Brand semantic vars (--brand-primary, …) must reach EVERY path that mounts
    // tool markup (plans/archive/brand-token-contract.md section 3). This offscreen stage serves
    // /pro batch rows, compose children, featured renders and personalize
    // previews - the live view applies the same vars in mountTool (views/tool.ts),
    // so without this call a batch/compose render of a semantic-var template
    // would fall back to the template defaults and mismatch its direct export.
    // Awaited (unlike the live mount): an offscreen render exports immediately,
    // so the vars must be on the node before the settle/capture below.
    await applyBrandVars(canvas, host);
    // A tool that keeps its declared inputs as a pure DATA channel (render.sidebar:false,
    // e.g. Run Web Code) never references them in its markup, so this off-screen render's
    // hydrated string carries none of the row's values - the template's own script would
    // fall back to the shared-origin IndexedDB draft (the user's LAST pen) and render the
    // wrong content. Hand it the model READ channel the live view exposes (canvas-commit.ts)
    // so its boot-seed reads THIS render's values. Write-only here: an off-screen render is
    // one-shot, so no __lollyCommit/__lollySubscribe.
    if (getModel) (canvas as CanvasCommitEl).__lollyModel = getModel;
    runTemplateScripts(canvas);
    await waitForQuiescence(canvas, { silenceMs: settleMs !== undefined && settleMs > 0 ? settleMs : SETTLE_MS });
    // Resolve embeds to local blob/data URLs before export so the embedded render
    // appears in the output. The compose stack is threaded so an embed inside a
    // composed child stays guarded (undefined → [] for the paged path).
    await hydrateEmbeds(canvas, { host, embed: { stack: composeStack ?? [] } });
    // Lottie + video markers: the live view mounts both; the chunks load only when a
    // marker exists. Lottie players are OWNED (must be reaped → _lottieCleanup); video
    // is progressive enhancement that owns nothing, but its promise gates on a decoded
    // frame so the export isn't blank.
    if (canvas.querySelector('[data-lottie-src]')) {
      const { mountLottiePlayers, destroyLottiePlayers } = await import('../views/lottie-mount.ts');
      await mountLottiePlayers(canvas);
      stage._lottieCleanup = () => destroyLottiePlayers(canvas);
    }
    if (canvas.querySelector('video[data-video-key]')) {
      const { mountVideoPlayers } = await import('../views/video-mount.ts');
      await mountVideoPlayers(canvas);
    }
    return { stage, canvas };
  } catch (e) {
    stage._lottieCleanup?.();
    stage.remove();
    throw e;
  }
}

interface RenderRowResult {
  blob: Blob;
  format: string;
  url: string;
}

interface RenderPagesResult {
  pages: Blob[];
  format: string;
}

// The offscreen stage div also carries a per-render lottie-cleanup callback so
// the finally block can unregister any players it mounted.
type ExportStage = HTMLDivElement & { _lottieCleanup?: () => void };

/**
 * Render a single row and return { blob, format }.
 * @param {{toolId:string, values:object}} row
 * @param {HostV1} host
 * @param {{format?:string, width?:number, height?:number, unit?:string, dpi?:number}} opts
 *        preferred format + optional output dimensions. width/height are values
 *        in `unit` (px/mm/cm/in/pt); blank falls back to the tool's native size.
 *        `dpi` sets raster resolution for physical units.
 */
export async function renderRowToBlob(row: BatchRow, host: HostV1, { format, width, height, unit = 'px', dpi, composeStack, watermark, embedMeta, thumbnail, previewPage, previewTimeMs, thumbAssets, strongPassword, c2pa, imprint, settleMs }: RenderRowOpts = {}): Promise<RenderRowResult> {
  const tool = await getTool(row.toolId);
  if (!isExportable(tool.manifest)) {
    throw new Error(`"${tool.manifest.name}" is render-only and cannot be exported.`);
  }

  const nativeW = tool.manifest.render.width;
  const nativeH = tool.manifest.render.height;

  // Establish the requested ASPECT at canvas creation - not at export. When both
  // dimensions are given we render the (responsive) tool into a box of that
  // aspect, in CSS px, so its layout adapts correctly. The export then does a
  // uniform unit→medium scale (no squashing). Blank → the tool's native size.
  const bothGiven = width !== undefined && width > 0 && height !== undefined && height > 0;
  const layoutW = bothGiven ? Math.max(1, Math.round(toCssPx({ value: width as number, unit }))) : nativeW;
  const layoutH = bothGiven ? Math.max(1, Math.round(toCssPx({ value: height as number, unit }))) : nativeH;

  // Feed the layout size to a tool's width/height inputs (if it declares them),
  // so hook-driven responsive tools recompute - mirrors the single-tool preview.
  const seeded: Record<string, InputValue> = { ...(row.values ?? {}) };
  const inputIds = new Set((tool.manifest.inputs ?? []).map(i => i.id));
  if (bothGiven) {
    if (inputIds.has('width')  && seeded.width  == null) seeded.width  = layoutW;
    if (inputIds.has('height') && seeded.height == null) seeded.height = layoutH;
  }
  // composeStack threads tool-id recursion state down when this render is itself
  // a composed child (set by the compose bridge); undefined for normal batch rows.
  const runtime = await createRuntime(tool, withToolNet(thumbAssets ? withThumbAssets(host) : host, tool.manifest), seeded, { composeStack });

  // Export dimension qualified with the unit (px / mm / cm / in / pt) so the
  // engine converts per format; blank falls back to the native canvas size.
  const dim = (v: number | undefined): string | number | undefined => (v !== undefined && v > 0 ? (unit && unit !== 'px' ? `${v}${unit}` : v) : undefined);
  const outW = dim(width);
  const outH = dim(height);

  let stage: ExportStage | undefined;
  let posterClock: ReturnType<typeof import('../bridge/sequence-dom.ts').createSequenceTime> | null = null;
  try {
    const mounted = await mountToolCanvas(tool.styles, runtime.getHydrated(), { layoutW, fixedHeight: layoutH, composeStack, host, settleMs, getModel: () => runtime.getModel() });
    stage = mounted.stage;
    const canvas = mounted.canvas;
    posterClock = previewTimeMs !== undefined && Number.isFinite(previewTimeMs)
      ? (await import('../bridge/sequence-dom.ts')).createSequenceTime(canvas) : null;
    posterClock?.apply(Math.max(0, previewTimeMs ?? 0));
    const fmt = chooseFormat(tool.manifest, format);
    // A "reopen in Lolly" link: this tool's short URL carrying the exact inputs +
    // export settings used for THIS render, so a zip recipient can return to
    // lolly.tools and recreate (or tweak) the file. Serialised from the live model so
    // values encode the same compact way the address bar does. Surfaced in the zip's
    // lolly.txt (see creditText in pro/zip.js); ignored on the compose/thumbnail paths.
    // Thumbnail/preview callers discard `url`, so skip serialising (+ its occasional
    // native DEFLATE) entirely on that path - only real exports (batch, compose child) need it.
    const url = thumbnail ? '' : toolShareUrl(tool.manifest.id, await preferCompactQuery(serializeUrlState(runtime.getModel(), {
      format: fmt, width, height, unit, dpi: unit !== 'px' ? dpi : undefined,
      // Print settings belong in the recreate link too - a zip recipient opening
      // lolly.txt should land on the file they were sent, bleed and marks included.
      profile: row.profile, bleed: row.bleed, marks: row.marks,
    })));
    // watermark/embedMeta/thumbnail are forwarded only when set (compose passes
    // watermark:false + embedMeta:false so an embedded child isn't stamped); batch
    // rows leave them undefined so runtime.export keeps its normal defaults.
    const exportOpts: { width?: string | number; height?: string | number; dpi?: number; watermark?: boolean; embedMeta?: boolean; thumbnail?: boolean; strongPassword?: string; wait?: number; duration?: number; fps?: number; c2pa?: boolean; imprint?: boolean; colorProfile?: string; bleed?: string; cropMarks?: boolean; registrationMarks?: boolean; bleedMarks?: boolean; colorBars?: boolean; provenance?: boolean } = { width: outW, height: outH, dpi };
    if (watermark !== undefined) exportOpts.watermark = watermark;
    if (embedMeta !== undefined) exportOpts.embedMeta = embedMeta;
    if (thumbnail !== undefined) exportOpts.thumbnail = thumbnail;
    // Content Credentials: a REAL batch/zip render signs by default under the same
    // policy as the tool view's Export button (previously the whole batch pipeline
    // silently skipped signing). Compose children (embedMeta:false) and thumbnails
    // are intermediates - never stamped; an explicit opts.c2pa always wins.
    const wantC2pa = c2pa ?? (embedMeta === false || thumbnail ? false : c2paDefaultOn(tool.manifest));
    if (wantC2pa) exportOpts.c2pa = true;
    // Pixel watermark: opt-in only, never a default - the bridge embeds it on
    // raster formats and ignores it elsewhere.
    if (imprint) exportOpts.imprint = true;
    // Print settings carried on the row (from the saved session / batch CSV). The
    // single-tool export bar assembles the same shape in printOpts(); this is the
    // batch path's equivalent, so a folder render honours the bleed, marks and
    // press condition the user actually chose instead of silently rendering a
    // trim-sized, unmarked, profile-less PDF.
    if (row.profile) exportOpts.colorProfile = row.profile;
    if (row.bleed) exportOpts.bleed = row.bleed;
    const rowMarks = csvToMarks(row.marks);
    if (rowMarks) {
      exportOpts.cropMarks = rowMarks.crop;
      exportOpts.registrationMarks = rowMarks.registration;
      exportOpts.bleedMarks = rowMarks.bleed;
      exportOpts.colorBars = rowMarks.colorBars;
      exportOpts.provenance = rowMarks.provenance;
    }
    // Motion format → capture a short clip. Its settle time + length come from the
    // authored sequence (or render.video for an untimed tool). Only composed child
    // renders are capped; a batch export must preserve the full document. The
    // exporter (renderVideo / renderGif) reads wait/duration/fps; still formats ignore them.
    if (MOTION_EXPORT_FORMATS.has(fmt)) {
      const vid = (tool.manifest.render as { video?: { wait?: number; duration?: number; fps?: number } }).video ?? {};
      exportOpts.wait = vid.wait ?? 1;
      const { sequenceDurationMs } = await import('../bridge/sequence-dom.ts');
      const seconds = sequenceDurationMs(canvas) / 1000 || vid.duration || 5;
      exportOpts.duration = composeStack ? Math.min(seconds, EMBED_MAX_DURATION) : seconds;
      if (vid.fps) exportOpts.fps = vid.fps;
    }
    // Strong-lock PDF outputs only; the export bridge ignores it for non-pdf formats.
    if (strongPassword && (fmt === 'pdf' || fmt === 'pdf-cmyk')) exportOpts.strongPassword = strongPassword;
    const target = previewPage ? canvas.querySelector<HTMLElement>('[data-pdf-page]') ?? canvas : canvas;
    if (target !== canvas) {
      const rect = target.getBoundingClientRect();
      exportOpts.width = rect.width;
      exportOpts.height = rect.height;
    }
    const blob = await runtime.export(target, fmt, exportOpts);
    return { blob, format: fmt, url };
  } finally {
    posterClock?.restore();
    stage?._lottieCleanup?.(); // destroyed players unregister from animationManager
    stage?.remove();
    runtime.destroy();
  }
}

/** A preview uses the same hydration, brand scope and clock as the editor/export.
 * Only Design is admitted: arbitrary tools may own live resources or globals. */
export async function mountTemplateMotion(host: HostV1, toolId: string, values: Record<string, InputValue>) {
  if (toolId !== 'design') throw new Error('Live template motion is available for Design.');
  const tool = await getTool(toolId);
  const runtime = await createRuntime(tool, withToolNet(host, tool.manifest), values);
  let ownedStage: ExportStage | undefined;
  try {
    const { stage, canvas } = await mountToolCanvas(tool.styles, runtime.getHydrated(), {
      layoutW: tool.manifest.render.width, fixedHeight: tool.manifest.render.height,
      host, getModel: () => runtime.getModel(),
    });
    ownedStage = stage;
    const clock = (await import('../bridge/sequence-dom.ts')).createSequenceTime(canvas);
    return {
      stage, canvas, width: tool.manifest.render.width, height: tool.manifest.render.height,
      seek: (ms: number) => clock.apply(ms),
      destroy() { clock.restore(); stage._lottieCleanup?.(); stage.remove(); runtime.destroy(); },
    };
  } catch (error) { ownedStage?._lottieCleanup?.(); ownedStage?.remove(); runtime.destroy(); throw error; }
}

/**
 * Render a PAGED tool (manifest render.paged - a document that lays out several
 * `[data-pdf-page]` boxes, e.g. multi-page-pdf) and return ONE export blob PER PAGE, so
 * a caller can show each page as its own preview. Mirrors renderRowToBlob's offscreen
 * mount, but the canvas is left auto-height (every page box is laid out and measured,
 * not clipped to one page) and each page element is exported individually. A single
 * page's geometry is simple - it renders cleanly and, unlike the whole stacked-pages
 * SVG, doesn't choke resvg. Falls back to a single whole-canvas export for a tool that
 * declares no page boxes.
 */
export async function renderToolPages(row: BatchRow, host: HostV1, { format, thumbnail, thumbAssets }: RenderRowOpts = {}): Promise<RenderPagesResult> {
  const tool = await getTool(row.toolId);
  if (!isExportable(tool.manifest)) {
    throw new Error(`"${tool.manifest.name}" is render-only and cannot be exported.`);
  }
  const layoutW = tool.manifest.render.width;   // one page's native size

  const runtime = await createRuntime(tool, withToolNet(thumbAssets ? withThumbAssets(host) : host, tool.manifest), { ...(row.values ?? {}) });

  // No fixed height: let the document lay out its FULL height so every page box is
  // measured (page boxes are fixed-size, so they render identically whether or not
  // the viewport clips them).
  const { stage, canvas } = await mountToolCanvas(tool.styles, runtime.getHydrated(), { layoutW, host, getModel: () => runtime.getModel() });

  try {
    const fmt = chooseFormat(tool.manifest, format);
    // Each page box is exported on its own; no page boxes → export the whole canvas once.
    const pageEls = [...canvas.querySelectorAll<HTMLElement>('[data-pdf-page]')];
    const targets: HTMLElement[] = pageEls.length ? pageEls : [canvas];
    const pages: Blob[] = [];
    for (const el of targets) {
      pages.push(await runtime.export(el, fmt, { watermark: false, embedMeta: false, thumbnail }));
    }
    return { pages, format: fmt };
  } finally {
    stage._lottieCleanup?.();
    stage.remove();
  }
}
