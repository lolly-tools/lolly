import { holdUpdateWork } from '../../lib/update-work-state.ts';
// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: unscaled export of the live canvas.
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import { C2PA_FORMATS, DEFAULT_CMYK_CONDITION, VIDEO_CODEC_STRINGS, hasVideoParams } from '@lolly/engine';
import { mergeExportPrefs } from '../../lib/export-prefs.ts';
import { automationPasswordExpected } from '../../lib/automation-export-secret.ts';
import { LinkPasswordRefused, linkPasswordRefusal } from '../../lib/export-password.ts';
import { flushAddressWrites } from '../../lib/url-state.ts';
import { holdStageView } from '../../lib/stage-lod.ts';
import { withStudioExport } from '../../lib/studio-export-guard.ts';
import { settleForExport } from '../../lib/export-settle.ts';
import { livePalette } from '../../lib/live-palette.ts';
import { waitForQuiescence } from '../../lib/render-lifecycle.ts';
import { addressedFramePage } from '../../lib/export-target.ts';
import { waitForInitialViewport } from '../tool-initial-viewport.ts';
import { c2paDefaultOn, exportTargetNode, extFor, isCmykFmt, isPrintFmt } from '../tool-actions.ts';
import { exportPixelSize } from '../export-dimension-fields.ts';
import { linkExportSize, type LinkExportSize } from '../export-size.ts';
import { marksFromCsv } from './shared.ts';
import type { ExportDefaults, ExportReport, PrintMarks, RunExportOpts } from './shared.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

/** What an editor capture can ask of the wrapper. `size` is the pixel size this export
 *  really renders at, when the caller knows it (the export bar resolves it from the very
 *  dimensions it hands the bridge). A tool whose detail follows the output is built again
 *  for that size; leaving it out keeps the old behaviour, which is the preview's size. */
export interface ExportUnscaledOpts {
  shutter?: boolean;
  detail?: string;
  onCancel?: () => void;
  size?: { width: number; height: number };
}

export function exportUnscaled<T>(tview: ToolViewCtx,
  fn: (report?: ExportReport) => Promise<T>,
  opts: ExportUnscaledOpts = {}
): Promise<T> {
  const release = holdUpdateWork();
  const run = tview.exportChain.catch(() => {}).then(() => exportUnscaledRaw(tview, fn, opts)).finally(release);
  tview.exportChain = run.catch(() => {});
  return run;
}
export async function exportUnscaledRaw<T>(tview: ToolViewCtx, 
  fn: (report?: ExportReport) => Promise<T>,
  {
    shutter = false,
    detail,
    onCancel,
    size,
  }: ExportUnscaledOpts = {}
): Promise<T> {
  const { canvasEl, outerEl } = tview;
  // Drives the shutter's status block; inert when this export runs without one.
  const report: ExportReport = (done, total) => {
    if (shutter) tview.designSystem.reportShutterProgress(done, total);
  };
  // Renders are coalesced behind rAF (see the subscriber below); an export reads
  // the canvas DOM directly, so force any pending paint to land first - otherwise
  // we'd capture the frame before the latest keystroke.
  tview.render.flushRender();
  // And the address: anything the export reads from it (the `_themes` choice the token
  // bridge reads) must be the state being exported, not one still settling.
  flushAddressWrites();
  // The opening fit hides the canvas briefly. SVG capture correctly skips hidden
  // artwork, so both manual and URL-driven exports must wait for this chrome state.
  await waitForInitialViewport(canvasEl, tview.mountLifecycle.signal);
  // Embeds (lolly.tools/tool/… URLs) hydrate fire-and-forget on each render;
  // wait for the latest pass so export reads resolved blobs, not the placeholder.
  await tview.embedsPending;
  // Same for lottie players - a first-paint/deep-link export must not capture
  // an unmounted [data-lottie-src] container.
  await tview.lottiePending;
  // And for animated SVGs - a still/first export must inline the <svg> first, or
  // it captures an empty [data-anim-src] marker.
  await tview.animSvgPending;
  // And for shaped glyphs (plans/175 WP-D) - an export mid-enhancement would shoot
  // a word half span-tier, half glyph-tier.
  await tview.glyphPending;
  // And for video: snapshotMotion (export.js) needs a decoded frame or it skips
  // the <video> and exports blank - videoPending resolves once frames are ready.
  await tview.videoPending;
  // And for the visualizer: an artist preset is fetched, so an export that didn't wait
  // would capture whichever brand-native preset was up while that was in flight.
  await tview.vizPending;
  await tview.studioPending;
  if (tview.studioError) throw tview.studioError;
  await waitForInitialViewport(canvasEl, tview.mountLifecycle.signal);
  // A studio scene draws its export frame first, and a frame that fails while the export
  // runs fails the export (the frame clock only logs it).
  // Full-bleed tools (hideSidebar: export:false utilities and canvas-layout tools) have
  // no fixed-size artboard scaled-to-fit - canvasEl/outerEl are null - so there's no
  // transform to un-scale. Run the export directly (still behind the shutter). This is the
  // path the preview generator's __lollyCaptureThumb hook takes to vector-capture them.
  if (!canvasEl || !outerEl) {
    if (shutter) await tview.designSystem.closeShutter(detail, onCancel);
    try {
      return await withStudioExport(tview.studioModule, tview.contentEl, () => fn(report), 'export', size);
    } finally {
      if (shutter) tview.designSystem.openShutter();
    }
  }
  const annotated = [...canvasEl.querySelectorAll<HTMLElement>('[data-canvas-input]')];
  const saved = annotated.map((el) => ({ el, id: el.dataset.canvasInput }));
  annotated.forEach((el) => { el.removeAttribute('data-canvas-input'); });

  // Close the shutter BEFORE the resize so the shake happens fully hidden.
  if (shutter) await tview.designSystem.closeShutter(detail, onCancel);

  const resumeStage = tview.stageZoom?.suspend();
  // The view attributes (moving, level of detail) must not reach an export.
  const releaseView = holdStageView(canvasEl);
  const prevTransform = canvasEl!.style.transform;
  const prevOuterTransform = outerEl!.style.transform;
  const prevZoom = canvasEl!.style.zoom; // paged docs fit-to-width via zoom
  const prevW = outerEl!.style.width;
  const prevH = outerEl!.style.height;
  canvasEl!.style.transform = '';
  // Stage navigation adds another scale on the outer wrapper. Leaving it active
  // makes export measure zoomed bounds and enlarge the artwork beyond its page.
  outerEl!.style.transform = '';
  canvasEl!.style.zoom = ''; // export reads pages at true page size
  outerEl!.style.width = canvasEl!.style.width;
  outerEl!.style.height = canvasEl!.style.height;
  try {
    return await withStudioExport(tview.studioModule, tview.contentEl, () => fn(report), 'export', size);
  } finally {
    canvasEl!.style.transform = prevTransform;
    outerEl!.style.transform = prevOuterTransform;
    canvasEl!.style.zoom = prevZoom;
    outerEl!.style.width = prevW;
    outerEl!.style.height = prevH;
    releaseView();
    resumeStage?.();
    saved.forEach(({ el, id }) => {
      if (el.isConnected && id != null) el.dataset.canvasInput = id;
    });
    if (shutter) tview.designSystem.openShutter();
  }
}
export function resolveExportFormat(tview: ToolViewCtx): void {
  const { automationPassword, presentAddress, rememberedExport, sizeDims, toolId, urlBleed, urlC2pa, urlDepth, urlDpi, urlDurable, urlFilename, urlFormat, urlHdr, urlHeight, urlImprint, urlMarks, urlMetadata, urlNostage, urlPassword, urlProfile, urlUnit, urlVideo, urlWidth } = tview;
  const explicitExportFormat = urlFormat || (tview.initialValues.__export_format as string | undefined); tview.explicitExportFormat = explicitExportFormat;

  const exportDefaults: ExportDefaults = mergeExportPrefs(
    {
      motionBlur: tview.openedSession.url.motionBlur,
      filename: urlFilename || (tview.initialValues.__export_filename as string | undefined),
      // A named Design outcome is stronger than a generic per-tool remembered format,
      // but never stronger than this link/session's explicit choice.
      format:
        explicitExportFormat ||
        (toolId === 'design' ? tview.session.currentDesignOutcome().defaultFormat : undefined),
      width: urlWidth || Number(tview.initialValues.__export_width) || sizeDims?.width || undefined,
      height: urlHeight || Number(tview.initialValues.__export_height) || sizeDims?.height || undefined,
      unit:
        urlUnit || (tview.initialValues.__export_unit as string | undefined) || sizeDims?.unit || 'px',
      dpi: urlDpi || Number(tview.initialValues.__export_dpi) || 300,
      profile: urlProfile || (tview.initialValues.__export_profile as string | undefined) || undefined,
      // Never restored from saved state. Browser automation supplies its one-time
      // value over a Playwright binding, so it does not enter URL/history/logs.
      password: urlPassword || automationPassword || undefined,
      // Print prep (pdf / pdf-cmyk / cmyk-tiff): bleed dimension string + a marks toggle map.
      // Present (from URL or saved state) ⇒ the Print marks card opens pre-filled.
      bleed: urlBleed || (tview.initialValues.__export_bleed as string | undefined) || undefined,
      marks: (urlMarks ||
        marksFromCsv(
          tview.initialValues.__export_marks as string | null | undefined
        )) as PrintMarks | null,
      // Full-page HTML export ("no stage"). URL-driven - like `password`, it isn't
      // persisted to the library at rest, only round-tripped through the URL.
      nostage: urlNostage || undefined,
      // Content Credentials from ?c2pa= ({ on, days } or undefined) - an explicit
      // link setting beats the tool's render.c2pa default in the popup.
      c2pa: urlC2pa || undefined,
      // Pixel watermark from ?imprint= - on by default (like c2pa). Preserve an
      // explicit `imprint=0`/`off` as false rather than collapsing it to
      // undefined (`false || undefined` would silently re-default it to on).
      imprint: urlImprint === false ? false : urlImprint === true ? true : undefined,
      // Generator-metadata strip from ?meta=off - on by default; preserve an explicit
      // opt-out as false (the vector writers drop their source field when false).
      metadata: urlMetadata === false ? false : undefined,
      // Durable credential from ?durable=1 - opt-in, OFF by default (performance: a
      // neural encode + a one-time model fetch), so it's simply true/undefined.
      durable: urlDurable || undefined,
      // HDR (Rec.2100 PQ) raster export from ?hdr=1 - opt-in, OFF by default; the
      // tuned form (`hdr=1600-60-0-50`) seeds the slider dials.
      hdr: urlHdr ? true : undefined,
      hdrTune: urlHdr ?? undefined,
      // Requested export bit depth from ?depth= - 'auto' (the default) carries
      // nothing, so only an explicit 8/16/float request travels.
      depth: urlDepth !== 'auto' ? urlDepth : undefined,
      // Video controls from the URL (fps/seconds/wait/codec/vq): seed the panel so a
      // manual export honours a pasted link the way `format=` does.
      video: hasVideoParams(urlVideo) ? urlVideo : undefined,
      // The deck state address from ?s= (plan 112). Read from the BOOT url, like every
      // other export default: presentation mode writes `s=` live while presenting and
      // clears it on exit, so the live query is the wrong thing to photograph. A still
      // export of a framed doc then renders just that slide (tool-actions' fan-out).
      slide: presentAddress || undefined,
    },
    rememberedExport,
    tview.tool.manifest.render?.formats ?? []
  ); tview.exportDefaults = exportDefaults;
  // The licence declared for this document: the link's, else the saved session's.
  // Held on the runtime so the source credits, the export's metadata, the saved
  // record and the address bar all read one value. An unknown id clears it.
  tview.runtime.setOutputLicence?.(tview.urlLicence || (tview.initialValues.__export_licence as string | undefined) || null);
  // `_madewith=0` leaves the design-system record out (plans/319). Held on the
  // runtime like the licence, so the export panel's card, a deep-link export and
  // every other export from this mount read one switch.
  if (tview.openedSession.url.madeWith === false) tview.runtime.setMadeWith?.(false);
  // Rewrite the URL hash query string to reflect the current tool state so the
  // page is shareable and bookmarkable. Uses replaceState - no history entry.
  // Params the user has explicitly touched - only these are written to the URL.
  // Pre-seeded from any params already in the URL so shared/bookmarked links
  // are preserved across the first subscribe callback.
  tview.userHasMadeChanges = false;
  // A completed export/copy/save since the last edit. When true, the leave guards
  // stand down: the user finished - their latest state left as a file, a clipboard
  // copy or a library save - and "Unsaved edits" at that moment reads as the app
  // disbelieving them (audit 167 F-A2). Editing again re-arms the guard. The amber
  // Save cue deliberately stays: the SESSION may still be worth keeping, the guard
  // just stops blocking the door over it.
  tview.exportedSinceEdit = false;
}

export async function mountDocumentExport(tview: ToolViewCtx) {
  const pageValues = tview.runtime.getModel().find(item => item.id === 'pages')?.value;
  if (tview.toolId !== 'design' || !Array.isArray(pageValues) || pageValues.length <= 1) return undefined;
  await tview.runtime.whenSettled();
  const renderer = await import('../../pro/render-export.ts');
  return renderer.mountDocumentExport(tview.tool, tview.host, tview.runtime, { width: tview.nativeW, height: tview.nativeH });
}

/**
 * The size a link export writes, read the way the export bar reads it: the link's own
 * width, height, unit and DPI first; then a reopened session's export size; then the
 * option the tool's size select holds now (Certificate's Size, Stationery's Piece),
 * which a hook may have set; then the tool's render box. A device's remembered export
 * size is never used here, so the same link writes the same file on every device and
 * from the command line.
 */
export function linkExportSizeFor(tview: ToolViewCtx): LinkExportSize {
  const { initialValues: saved, sizeDriver, tool } = tview;
  // A tool with no export size of its own (a fixed design, `render.dims: false`) keeps
  // the render box the view already holds, as the export bar does for such a tool.
  const fixed = tool.manifest.render.dims === false || !!tool.manifest.designTool;
  const value = sizeDriver && !fixed ? tview.runtime.getModel().find((i) => i.id === sizeDriver.id)?.value : undefined;
  const option = sizeDriver && !fixed ? sizeDriver.dims[String(value)] ?? null : null;
  return linkExportSize({
    link: { width: tview.urlWidth, height: tview.urlHeight, unit: tview.urlUnit, dpi: tview.urlDpi },
    session: fixed ? {} : {
      width: Number(saved.__export_width) || null, height: Number(saved.__export_height) || null,
      unit: (saved.__export_unit as string | undefined) || null, dpi: Number(saved.__export_dpi) || null,
    },
    option,
    // The bar opened on the option the view mounted with (tview.sizeDims) and moves
    // with the select after that, so a different option now is the size in force.
    optionMoved: !fixed && (option ?? null) !== (tview.sizeDims ?? null),
    render: { width: tview.nativeW, height: tview.nativeH },
  });
}

/** Hold a link export until the document is the one the export panel would photograph
 *  (lib/export-settle.ts): the tool knows the size it is written at and the canvas shows
 *  every hook run the mount started. */
export function settleLinkExport(tview: ToolViewCtx, canvas: LinkExportSize['canvas']): Promise<void> {
  return settleForExport({
    runtime: tview.runtime,
    flush: () => tview.render.flushRender(),
    shown: () => tview.lastPainted,
    pending: () => tview.rafId !== 0,
    quiet: () => waitForQuiescence(tview.contentEl),
    warn: (message, error) => console.warn(message, error),
  }, canvas);
}

/**
 * The export a link asks for (`?format=png&export`): the same file the export panel
 * writes for the same document, at the same size and with the same artwork.
 */
export async function linkExport(tview: ToolViewCtx): Promise<void> {
  const fmt = tview.urlFormat || tview.tool.manifest.render.formats[0]!;
  // The password comes in the link or, from automation, over the one-time binding, and the
  // two travel the same way from here. A request this file cannot honour stops here, before
  // any work: an unlocked file is what must not come out of this function.
  const password = tview.urlPassword || tview.automationPassword || undefined;
  if (password || automationPasswordExpected()) {
    if (!password) throw new Error('A password was asked for and did not arrive, so nothing was written.');
    const refusal = linkPasswordRefusal(fmt, { password, bleed: tview.urlBleed, marks: tview.urlMarks });
    if (refusal) throw new LinkPasswordRefused(refusal);
  }
  // Brand vars land async (tokens fetch), so they are awaited with quiescence: a link
  // export captures the branded canvas, not the fallbacks. The live palette (for CMYK
  // ink substitution) comes from the same tokens fetch and waits with them.
  // waitForQuiescence rejects when a tool reports `tool:failed` (plan 265 milestone 2,
  // E4): a tool that could not draw is a logged reason the link export did not run.
  const [, , palette] = await Promise.all([waitForQuiescence(tview.contentEl), tview.brandVarsReady, livePalette(tview.host)]);
  const size = linkExportSizeFor(tview);
  await settleLinkExport(tview, size.canvas);
  const { urlBleed, urlC2pa, urlDepth, urlDurable, urlFilename, urlHdr, urlHeight, urlImprint, urlMarks, urlNostage, urlProfile, urlVideo, urlWidth } = tview;
  const name = urlFilename || tview.tool.manifest.id;
  const expOpts: RunExportOpts = {
    width: size.width,
    height: size.height,
    cuts: tview.openedSession.url.cuts,
    sampleTimes: tview.openedSession.url.sampleTimes,
    motionBlur: tview.openedSession.url.motionBlur, sequenceRange: tview.openedSession.url.sequenceRange,
  };
  if (size.dpi) expOpts.dpi = size.dpi;
  // CMYK print formats: carry the chosen press condition (recorded in the
  // PDF's output intent / the TIFF's metadata). The Print PDF also carries the
  // brand palette for exact ink matches; the TIFF does a flat per-pixel pass.
  if (isCmykFmt(fmt)) {
    expOpts.colorProfile = urlProfile || DEFAULT_CMYK_CONDITION;
    if (fmt === 'pdf-cmyk') expOpts.palette = palette;
  }
  // HTML: honour ?nostage so a deep link auto-exports the full-page document
  // (no fixed-size canvas frame) - mirrors the panel's "Full page" toggle.
  if (fmt === 'html' && urlNostage) expOpts.fullPage = true;
  // Standard lock, read above. The refusal has already seen the format.
  if (password) expOpts.password = password;
  // Content Credentials: ?c2pa= wins (on/off + ephemeral-cert lifetime,
  // e.g. c2pa=90 or c2pa=off - see url-mode.js); absent it falls back to
  // a render.c2pa tool's popup default. Never stamped alongside a
  // password (the same exclusion the popup enforces; the bridge would
  // skip it anyway).
  const wantC2pa = urlC2pa ? urlC2pa.on : c2paDefaultOn(tview.tool.manifest);
  if (wantC2pa && C2PA_FORMATS.includes(fmt) && !expOpts.password) {
    expOpts.c2pa = true;
    if (urlC2pa?.days) expOpts.c2paDays = urlC2pa.days;
  }
  // Pixel watermark (?imprint=): on by default for imprint-capable formats,
  // like C2PA - independent of the C2PA credential itself. Covers still rasters
  // AND the container formats (pdf/pdf-cmyk/pptx), whose Lolly-rendered rasters
  // are imprinted as they're composited in (a pure-vector page marks nothing).
  // Only an explicit `imprint=0`/`off` link suppresses it (see url-mode.ts
  // parseImprint; list mirrors tool-actions.ts's isImprintFmt).
  if (
    urlImprint !== false &&
    [
      'png',
      'jpg',
      'jpeg',
      'webp',
      'avif',
      'tiff',
      'bmp',
      'pdf',
      'pdf-cmyk',
      'pptx',
    ].includes(fmt)
  )
    expOpts.imprint = true;
  // Opt-in durable Content Credential (?durable=1): a neural TrustMark mark
  // carrying Lolly's id. Raster-only (no container rasters yet) and a no-op
  // until the encoder model is on-device. See plans/28-durable-content-credentials.md.
  if (urlDurable && ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff'].includes(fmt))
    expOpts.durable = true;
  // Opt-in HDR (?hdr=1): Rec.2100 PQ export with brand-colour glow. Raster
  // (PNG/JPEG/AVIF/TIFF - WebP excluded, no working HDR decode) plus the 10-bit
  // video containers (mp4/webm, plan 154 WP-2). urlHdr is null for ?hdr=0, so
  // ?hdr=0 forces SDR and ?hdr=1 forces HDR (tri-state via parseHdr). See engine/src/hdr.ts.
  if (urlHdr && ['png', 'jpg', 'jpeg', 'avif', 'tiff', 'mp4', 'webm'].includes(fmt)) {
    expOpts.hdr = true;
    expOpts.hdrPeakNits = urlHdr.peakNits;
    expOpts.hdrReach = urlHdr.reach;
    expOpts.hdrLift = urlHdr.lift;
    expOpts.hdrRichness = urlHdr.richness;
  }
  // Requested bit depth (?depth=): passed through as-is for every format -
  // 'auto' is the default and carries nothing. NO consumer logic here: the
  // export bridge decides what the provenance chain can honestly carry.
  if (urlDepth !== 'auto') expOpts.depth = urlDepth;
  // Video controls (?fps= ?seconds= ?wait= ?codec= ?vq=): the URL form of the export
  // panel's fields, so `?export=mp4&fps=60&seconds=6` renders the clip the panel
  // would - and the CLI, which is this path under another transport, gets the same
  // knobs. `seconds` is a deliberate length (durationUserSet), so a tool hook that
  // lengthens a clip to its material (the audiogram's analysed bed) stands down.
  if (expOpts.sampleTimes && urlVideo.fps != null) expOpts.fps = urlVideo.fps;
  if (
    ['mp4', 'webm', 'gif', 'apng', 'webp-anim'].includes(fmt) &&
    hasVideoParams(urlVideo)
  ) {
    if (urlVideo.fps != null) expOpts.fps = urlVideo.fps;
    if (urlVideo.seconds != null) {
      expOpts.duration = urlVideo.seconds;
      expOpts.durationUserSet = true;
    }
    if (urlVideo.wait != null) expOpts.wait = urlVideo.wait;
    if (urlVideo.codec) expOpts.videoCodec = VIDEO_CODEC_STRINGS[urlVideo.codec];
    if (urlVideo.quality) expOpts.videoQuality = urlVideo.quality;
  }
  // Print prep: honour ?bleed= / ?marks= so a deep link auto-exports a
  // print-ready file. Applied only when the link asks for it (never default).
  if (isPrintFmt(fmt) && (urlBleed || urlMarks)) {
    if (urlBleed) expOpts.bleed = urlBleed;
    if (urlMarks) {
      expOpts.cropMarks = urlMarks.crop;
      expOpts.registrationMarks = urlMarks.registration;
      expOpts.bleedMarks = urlMarks.bleed;
      expOpts.colorBars = urlMarks.colorBars;
      expOpts.provenance = urlMarks.provenance;
    }
  }
  await exportUnscaled(
    tview,
    async () => {
      const documentExport = await mountDocumentExport(tview);
      try {
        const exportSourceNode = documentExport?.canvas ?? tview.exportSourceNode;
        const runtime = documentExport?.runtime ?? tview.runtime;
        const page = addressedFramePage(exportSourceNode, fmt, tview.presentAddress);
        if (page) {
          if (!((urlWidth ?? 0) > 0)) expOpts.width = page.offsetWidth;
          if (!((urlHeight ?? 0) > 0)) expOpts.height = page.offsetHeight;
        }
        const blob = await runtime.export(page ?? exportTargetNode(exportSourceNode), fmt, expOpts);
        await tview.host.export.download(blob, `${name}.${extFor(fmt, blob)}`);
      } finally { documentExport?.destroy(); }
    },
    // The export knows the size it renders at, so a tool whose detail follows the
    // output is built for the size the link asked for, not for the preview.
    { size: exportPixelSize(expOpts) }
  );
}

export function exportingOps(tview: ToolViewCtx) {
  return {
    linkExport: bindOp(tview, linkExport),
    mountDocumentExport: bindOp(tview, mountDocumentExport),
    exportUnscaled: <T>(fn: (report?: ExportReport) => Promise<T>, opts: ExportUnscaledOpts = {}): Promise<T> => exportUnscaled<T>(tview, fn, opts),
    exportUnscaledRaw: bindOp(tview, exportUnscaledRaw),
    resolveExportFormat: bindOp(tview, resolveExportFormat),
  };
}
