// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: unscaled export of the live canvas.
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import { hasVideoParams } from '@lolly/engine';
import { mergeExportPrefs } from '../../lib/export-prefs.ts';
import { marksFromCsv } from './shared.ts';
import type { ExportDefaults, ExportReport, PrintMarks } from './shared.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

export function exportUnscaled<T>(tview: ToolViewCtx, 
  fn: (report?: ExportReport) => Promise<T>,
  opts: { shutter?: boolean; detail?: string; onCancel?: () => void } = {}
): Promise<T> {
  const run = tview.exportChain.catch(() => {}).then(() => exportUnscaledRaw(tview, fn, opts));
  tview.exportChain = run.catch(() => {});
  return run;
}
export async function exportUnscaledRaw<T>(tview: ToolViewCtx, 
  fn: (report?: ExportReport) => Promise<T>,
  {
    shutter = false,
    detail,
    onCancel,
  }: { shutter?: boolean; detail?: string; onCancel?: () => void } = {}
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
  // Full-bleed tools (hideSidebar: export:false utilities and canvas-layout tools) have
  // no fixed-size artboard scaled-to-fit - canvasEl/outerEl are null - so there's no
  // transform to un-scale. Run the export directly (still behind the shutter). This is the
  // path the preview generator's __lollyCaptureThumb hook takes to vector-capture them.
  if (!canvasEl || !outerEl) {
    if (shutter) await tview.designSystem.closeShutter(detail, onCancel);
    try {
      return await fn(report);
    } finally {
      if (shutter) tview.designSystem.openShutter();
    }
  }
  const annotated = [...canvasEl.querySelectorAll<HTMLElement>('[data-canvas-input]')];
  const saved = annotated.map((el) => ({ el, id: el.dataset.canvasInput }));
  annotated.forEach((el) => { el.removeAttribute('data-canvas-input'); });

  // Close the shutter BEFORE the resize so the shake happens fully hidden.
  if (shutter) await tview.designSystem.closeShutter(detail, onCancel);

  const prevTransform = canvasEl!.style.transform;
  const prevZoom = canvasEl!.style.zoom; // paged docs fit-to-width via zoom
  const prevW = outerEl!.style.width;
  const prevH = outerEl!.style.height;
  canvasEl!.style.transform = '';
  canvasEl!.style.zoom = ''; // export reads pages at true page size
  outerEl!.style.width = canvasEl!.style.width;
  outerEl!.style.height = canvasEl!.style.height;
  try {
    return await fn(report);
  } finally {
    canvasEl!.style.transform = prevTransform;
    canvasEl!.style.zoom = prevZoom;
    outerEl!.style.width = prevW;
    outerEl!.style.height = prevH;
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
  // Rewrite the URL hash query string to reflect the current tool state so the
  // page is shareable and bookmarkable. Uses replaceState - no history entry.
  // Params the user has explicitly touched - only these are written to the URL.
  // Pre-seeded from any params already in the URL so shared/bookmarked links
  // are preserved across the first subscribe callback.
  tview.userHasMadeChanges = false;
  // A completed export/copy/save since the last edit. When true, the leave guards
  // stand down: the user finished - their latest state left as a file, a clipboard
  // copy or a library save - and "Unsaved changes" at that moment reads as the app
  // disbelieving them (audit 167 F-A2). Editing again re-arms the guard. The amber
  // Save cue deliberately stays: the SESSION may still be worth keeping, the guard
  // just stops blocking the door over it.
  tview.exportedSinceEdit = false;
}

export function exportingOps(tview: ToolViewCtx) {
  return {
    exportUnscaled: <T>(fn: (report?: ExportReport) => Promise<T>, opts: { shutter?: boolean; detail?: string; onCancel?: () => void } = {}): Promise<T> => exportUnscaled<T>(tview, fn, opts),
    exportUnscaledRaw: bindOp(tview, exportUnscaledRaw),
    resolveExportFormat: bindOp(tview, resolveExportFormat),
  };
}
