// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: preview runs, canvas errors, paint and flush.
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import { C2PA_FORMATS, DEFAULT_CMYK_CONDITION, VIDEO_CODEC_STRINGS, hasVideoParams, normalizeTableValue } from '@lolly/engine';
import { t } from '../../i18n.ts';
import { livePalette } from '../../lib/live-palette.ts';
import { scopeTemplateStyles } from '../../lib/scope-css.ts';
import { runTemplateScripts, waitForQuiescence } from '../../lib/render-lifecycle.ts';
import { hydrateEmbeds, neutralizeEmbeds } from '../../bridge/embed.ts';
import { markdownSafeUrl, mountTableCellEditing } from '../../lib/table-canvas-edit.ts';
import type { TableEditOpts } from '../../lib/table-canvas-edit.ts';
import { mountFilmstrip } from '../../lib/page-filmstrip.ts';
import { boundEndpointIds, geometryFastPathPlan } from '../canvas-scene.ts';
import type { Box } from '../free-canvas-math.ts';
import { c2paDefaultOn, exportTargetNode, extFor, isCmykFmt, isPrintFmt } from '../tool-actions.ts';
import { armAutoCopy, resolveCanvasAnnotations } from './shared.ts';
import type { RunExportOpts, } from './shared.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

// Drive a [data-preview] control through a capture. `btn` is the control the user
// actually clicked (auto-preview passes none → the first control, the placeholder
// button). Busy/error land on THAT control, and a PERSISTENT control (e.g. a
// hover-revealed refresh button that outlives the placeholder) is reset to idle on
// success - a placeholder button, which is hidden with the placeholder, doesn't
// care. An icon-only control (data-icon-only) keeps its glyph; its state shows via
// the is-busy / is-error classes (a CSS spinner / colour), never a text swap.
export async function runPreview(tview: ToolViewCtx, btn?: HTMLElement | null): Promise<void> {
  const { actionsApi, contentEl } = tview;
  const target = btn ?? contentEl.querySelector<HTMLElement>('[data-preview]');
  const iconOnly = Boolean(target?.dataset.iconOnly);
  if (target) {
    if (target.dataset.busy) return; // re-entrancy guard
    target.dataset.busy = '1';
    target.dataset.idleLabel ??= (target.textContent ?? '').trim();
    target.classList.remove('is-error');
    target.classList.add('is-busy');
    if (!iconOnly) target.textContent = target.dataset.busyLabel || t('Rendering…');
  }
  try {
    await actionsApi!.preview!();
    // Success: a placeholder button is gone with the placeholder; a persistent
    // control survives and must be returned to its idle state so a later hover
    // shows the affordance, not a stuck spinner.
    if (target?.isConnected) {
      target.classList.remove('is-busy');
      if (!iconOnly && target.dataset.idleLabel) target.textContent = target.dataset.idleLabel;
      delete target.dataset.busy;
    }
  } catch (err) {
    // Surface the failure in place; the control stays so the user can retry.
    const b = target ?? contentEl.querySelector<HTMLElement>('[data-preview]');
    if (b) {
      b.classList.remove('is-busy');
      b.classList.add('is-error');
      if (!b.dataset.iconOnly)
        b.textContent =
          (err as { message?: string })?.message || t('Preview failed - tap to retry');
      delete b.dataset.busy;
    }
    throw err;
  }
}
// Inline canvas error, shown when a template script throws mid-render. Lives on
// the stage as a sibling of the canvas, so the per-render innerHTML rebuild
// doesn't wipe it; cleared on the next successful render.
export function showCanvasError(tview: ToolViewCtx): void {
  const { contentEl, stageEl } = tview;
  const stage = stageEl || contentEl?.parentElement;
  if (!stage || stage.querySelector(':scope > .canvas-error')) return;
  const box = document.createElement('div');
  box.className = 'canvas-error';
  box.setAttribute('role', 'alert');
  box.textContent = t("Couldn't render this preview - check your inputs.");
  stage.appendChild(box);
}
export function clearCanvasError(tview: ToolViewCtx): void {
  const { contentEl, stageEl } = tview;
  (stageEl || contentEl?.parentElement)?.querySelector(':scope > .canvas-error')?.remove();
} // baseline for the geometry fast-skip diff (plans/98 section 9)

export function paint(tview: ToolViewCtx): void {
  const { actionsApi, brandVarsReady, canvasEditInput, canvasEl, canvasScope, contentEl, fastCfgPaint, fastPathOn, filmstripSide, formatDriver, hideSidebar, inputsEl, outerEl, pagedDoc, sizeDriver, tableEditOpts, urlFormat } = tview;
  tview.rafId = 0;
  if (!tview.pendingFrame) return;
  const { model, hydrated } = tview.pendingFrame;
  tview.pendingFrame = null;
  // Skip the expensive canvas rebuild when the hydrated output is byte-identical to
  // the last clean paint. refresh() and the coalesced double-emit re-emit unchanged
  // HTML, and a live camera/audio frame often traces to the same output - a full
  // innerHTML swap + <script> re-exec (chart/QR/map libs re-instantiate, resolved
  // embeds get wiped and re-fetched) per frame is pure waste. The MODEL can still
  // have moved on an input that doesn't touch the template (e.g. an export-dimension
  // select), so URL sync / size-driver / auto-export below always run. lastPainted
  // is recorded only after a CLEAN paint, so a throwing render retries next emit.
  // ── Geometry fast-skip (plans/98 section 9, opt-in) ────────────────────────────────
  // A proven pure-translation move whose DOM free-canvas already positioned (applyLiveRect
  // during the drag) needs no rebuild - export parity holds via COMPUTED style (the export
  // walker reads getComputedStyle, so raw-attribute formatting is irrelevant). paint()
  // derives the damage itself from consecutive box models (no hint channel), and VERIFIES
  // each moved node is already at committed geometry before skipping; anything unproven
  // (resize/rotate, cross-box, or a non-drag commit that didn't pre-position the DOM) falls
  // through to the full paint below.
  // lastPaintedBoxes advances ONLY after a clean skip or clean full paint (mirroring
  // lastPainted), NEVER unconditionally - so a throwing full paint leaves the baseline at
  // the last cleanly-painted boxes and a later move still diffs against it (catching the
  // un-healed change and forcing a full repaint), preserving the throwing-render self-heal.
  const prevBoxes = tview.lastPaintedBoxes;
  const curBoxes: Box[] | null =
    fastCfgPaint && canvasEditInput
      ? ((model.find((i) => i.id === canvasEditInput.id)?.value as Box[] | undefined) ?? null)
      : null;
  let geomSkipped = false;
  if (fastCfgPaint && prevBoxes && curBoxes) {
    const plan = geometryFastPathPlan(prevBoxes, curBoxes, {
      ...fastCfgPaint,
      connectorEndpointIds: boundEndpointIds(curBoxes, {
        idField: fastCfgPaint.field.idField,
        bindStartField: fastCfgPaint.bindStartField,
        bindEndField: fastCfgPaint.bindEndField,
        kindField: fastCfgPaint.kindField,
      }),
    });
    const esc = (id: string): string =>
      typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
    if (
      plan?.every((pt) => {
        // A frame patch targets the artboard PAGE element - its inline left/top are
        // global, exactly what the live drag wrote (plans/141 WP-A item 6). Members
        // that rode the frame have no patch: their frame-local style is unchanged.
        const el = contentEl.querySelector(
          pt.frame
            ? '.lolly-frame-page[data-frame-id="' + esc(pt.id) + '"]'
            : '.lolly-box[data-box-id="' + esc(pt.id) + '"]'
        ) as HTMLElement | null;
        return !!el && parseFloat(el.style.left) === pt.x && parseFloat(el.style.top) === pt.y;
      })
    ) {
      tview.lastPainted = hydrated;
      tview.lastPaintedBoxes = curBoxes;
      geomSkipped = true;
      if (typeof window !== 'undefined') {
        const w = window as unknown as { __lollyGeomFastPath?: { skips: number; fulls: number } };
        (w.__lollyGeomFastPath ??= { skips: 0, fulls: 0 }).skips++;
      }
    }
  }

  let contentPainted = geomSkipped;
  if (!geomSkipped && hydrated !== tview.lastPainted) {
    const gen = ++tview.renderGen;
    // Paged docs scroll the whole document in the canvas surface; a full innerHTML
    // rebuild would otherwise snap the view back to the cover on every keystroke.
    // Capture the surface's scroll offset and restore it after the swap.
    const prevScrollTop = pagedDoc && outerEl ? outerEl.scrollTop : 0;
    try {
      // Neutralise any lolly.tools embed URLs BEFORE insertion so the editor never
      // fires a network request for them; they're resolved to local composed
      // renders (blob URLs) just after the template's own scripts run. The
      // generation guard stops a slow embed render from overwriting a newer one.
      contentEl.innerHTML = neutralizeEmbeds(hydrated);
      // A <style> inside template.html would otherwise apply unscoped and unlayered,
      // beating every app layer - one tool's `*` reset strips the chrome's padding.
      scopeTemplateStyles(contentEl, canvasScope);
      if (!hideSidebar) resolveCanvasAnnotations(contentEl);
      // Keep the canvas's accessible summary current when it's a live a11yLabel.
      if (tview.tool.manifest.a11yLabel) contentEl.setAttribute('aria-label', tview.history.canvasLabel());
      runTemplateScripts(contentEl);
      // Populate any [data-shell-slot] hooks the freshly-painted template exposes
      // (the app theme toggle, the relocated export pill) - see mountToolbarSlots.
      tview.history.mountToolbarSlots();
      if (tableEditOpts) mountTableCellEditing(contentEl, tableEditOpts);
      tview.embedsPending = hydrateEmbeds(contentEl, { host: tview.host, isCurrent: () => gen === tview.renderGen });
      // Lottie markers are mounted by the shell, not the template (tools stay
      // data-only). Once the module has loaded, run the pass even on marker-less
      // paints so players orphaned by the innerHTML swap get reaped.
      if (tview.lottieModule || contentEl.querySelector('[data-lottie-src]')) {
        tview.lottiePending = (
          tview.lottieModule
            ? Promise.resolve(tview.lottieModule)
            : import('../lottie-mount.ts').then((m) => (tview.lottieModule = m))
        )
          .then((m) => { const { contentEl } = tview; return m.mountLottiePlayers(contentEl, { isCurrent: () => gen === tview.renderGen }); })
          .catch((err) => console.warn('lottie mount failed:', err));
      }
      // Split text's glyph tier (plans/175 WP-D): shape each letter-tier word through
      // host.text and replace its letter spans with per-cluster glyph groups, so the
      // animation keeps kerning, ligatures and Arabic joining. Progressive - a box
      // whose font resolves to no file keeps the span tier.
      if (
        contentEl.querySelector(
          '.lolly-box[data-t-split="letter"] .lly-w, .lolly-box[data-t-split-want="letter"] .lly-u'
        )
      ) {
        tview.glyphPending = (
          tview.glyphModule
            ? Promise.resolve(tview.glyphModule)
            : import('../glyph-split-mount.ts').then((m) => (tview.glyphModule = m))
        )
          .then((m) =>
            { const { contentEl } = tview; return m.mountGlyphSplits(contentEl, {
              isCurrent: () => gen === tview.renderGen,
              textApi: tview.host.text,
            }); }
          )
          .catch((err) => console.warn('glyph split mount failed:', err));
      }
      // Animated-SVG markers, mounted by the shell like Lottie: inline a live,
      // seekable <svg> so a catalog or uploaded animation actually plays in the
      // preview (and can be sampled/exported frame-accurately).
      if (contentEl.querySelector('[data-anim-src]')) {
        tview.animSvgPending = (
          tview.animSvgModule
            ? Promise.resolve(tview.animSvgModule)
            : import('../anim-svg-mount.ts').then((m) => (tview.animSvgModule = m))
        )
          .then((m) => { const { contentEl } = tview; return m.mountAnimSvgPlayers(contentEl, { isCurrent: () => gen === tview.renderGen }); })
          .catch((err) => console.warn('anim-svg mount failed:', err));
      }
      // Video position-keeper: restore each placed clip to where it was before this
      // rebuild (so it doesn't restart at 0), and settle once frames have decoded so
      // an export reads a real frame. Only paints with a keyed <video> load it.
      if (tview.videoModule || contentEl.querySelector('video[data-video-key]')) {
        tview.videoPending = (
          tview.videoModule
            ? Promise.resolve(tview.videoModule)
            : import('../video-mount.ts').then((m) => (tview.videoModule = m))
        )
          .then((m) => { const { contentEl } = tview; return m.mountVideoPlayers(contentEl, { isCurrent: () => gen === tview.renderGen }); })
          .catch((err) => console.warn('video mount failed:', err));
      }
      // MilkDrop placeholders. Run the pass on marker-less paints too once the module
      // is loaded, so switching the style away gives the WebGL context back instead of
      // leaving it parked on a canvas nothing is drawing into.
      if (tview.vizModule || contentEl.querySelector('[data-lolly-viz]')) {
        tview.vizPending = (
          tview.vizModule
            ? Promise.resolve(tview.vizModule)
            : import('../../lib/viz-tool-mount.ts').then((m) => (tview.vizModule = m))
        )
          .then((m) => { const { contentEl } = tview; return m.mountToolViz(contentEl, { isCurrent: () => gen === tview.renderGen }); })
          .catch((err) => console.warn('viz mount failed:', err));
      }
      clearCanvasError(tview);
      tview.lastPainted = hydrated;
      contentPainted = true;
      if (curBoxes) tview.lastPaintedBoxes = curBoxes; // clean full paint refreshes the baseline (throw-safe: after the render body)
      if (fastPathOn && typeof window !== 'undefined') {
        const w = window as unknown as { __lollyGeomFastPath?: { skips: number; fulls: number } };
        (w.__lollyGeomFastPath ??= { skips: 0, fulls: 0 }).fulls++;
      }
      // Keep the reader where they were scrolled to (paged docs only).
      if (pagedDoc && outerEl && prevScrollTop) outerEl.scrollTop = prevScrollTop;
      // Slide-sorter filmstrip: mount on the first paged paint, refresh thereafter.
      if (pagedDoc && outerEl && canvasEl) {
        if (!tview.filmstrip) tview.filmstrip = mountFilmstrip(outerEl, canvasEl, inputsEl, filmstripSide);
        else tview.filmstrip.refresh();
      }
    } catch (err) {
      // A throwing template script (charts, QR, fetch-backed tools run in page
      // context - unlike the sandboxed hooks) would otherwise leave a stale or
      // half-built canvas with no signal. Surface it; the sidebar stays editable.
      console.error('Render failed:', err);
      showCanvasError(tview);
    }
  }

  // Mounted Design health must never inspect the previous DOM against a newer
  // boxes model. The inspector invalidates on the synchronous model echo and only
  // resumes its layout/contrast/font checks after this clean-paint signal.
  if (contentPainted) canvasEl?.dispatchEvent(new CustomEvent('lolly-canvas-painted'));

  // The canvas just moved (or was rebuilt outright, taking every annotated node
  // with it) and the sidebar was re-synced a moment ago - so any remote focus ring
  // and cursor is anchored to geometry that no longer exists. Null unless a collab
  // is live, which makes this one nullable read per painted frame (section 11.14).
  tview.collabReanchor?.();

  tview.session.syncUrl();

  // When a size-driving select changes, set the export dimensions to the chosen
  // option - so picking "A6 landscape" actually exports an A6-landscape page.
  if (sizeDriver) {
    const v = model.find((i) => i.id === sizeDriver.id)?.value;
    if (v !== tview.lastDimsSizeVal) {
      tview.lastDimsSizeVal = v;
      const d = sizeDriver.dims[String(v)];
      // An option with no dims returns the export size to the tool's own
      // render box - otherwise "month then back to the card" kept exporting
      // the card at A4 landscape (calendar-ics, the one partially
      // dimensioned size select; E13 review).
      if (d) actionsApi?.setDims?.(d);
      else
        actionsApi?.setDims?.({
          width: tview.tool.manifest.render.width,
          height: tview.tool.manifest.render.height,
          unit: 'px',
        });
    }
  }

  // When a format-driving select changes (e.g. the filter effect), narrow the
  // export format bar to that option's formats. Runs on the initial emit too, so
  // the bar opens already scoped to the starting effect.
  if (formatDriver) {
    const v = model.find((i) => i.id === formatDriver.id)?.value;
    if (v !== tview.lastFmtDriveVal) {
      tview.lastFmtDriveVal = v;
      const f = formatDriver.formats[String(v)];
      if (f) actionsApi?.setFormats?.(f);
    }
  }

  if (tview.pendingAutoExport) {
    tview.pendingAutoExport = false;
    const fmt = urlFormat || tview.tool.manifest.render.formats[0]!;
    // Brand vars land async (tokens fetch) - await them alongside quiescence so
    // a deep-link export captures the branded canvas, not the fallbacks. The live
    // palette (for CMYK ink substitution) is the same tokens fetch, so it rides
    // along rather than adding its own wait.
    Promise.all([waitForQuiescence(contentEl), brandVarsReady, livePalette(tview.host)]).then(
      ([, , palette]) => {
      const { nativeH, nativeW, urlBleed, urlC2pa, urlDepth, urlDpi, urlDurable, urlFilename, urlHdr, urlHeight, urlImprint, urlMarks, urlNostage, urlPassword, urlProfile, urlUnit, urlVideo, urlWidth } = tview;
        const name = urlFilename || tview.tool.manifest.id;
        // Honour ?unit=/?dpi= so a deep link (or CLI) renders the right physical size.
        const u = urlUnit || 'px';
        const dim = (v: number | null, native: number): string | number =>
          (v ?? 0) > 0 ? (u !== 'px' ? `${v}${u}` : v!) : native;
        const expOpts: RunExportOpts = {
          width: dim(urlWidth, nativeW),
          height: dim(urlHeight, nativeH),
        };
        if (u !== 'px') expOpts.dpi = urlDpi || 300;
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
        // Standard lock: honour ?password= so a deep link can auto-export a locked
        // PDF or ZIP bundle (basic lock; clear-text in the URL by design - see pdfPassRow).
        if ((fmt === 'pdf' || fmt === 'zip') && urlPassword) expOpts.password = urlPassword;
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
        tview.exporting.exportUnscaled(() =>
          { const { exportSourceNode, runtime } = tview; return runtime
            .export(exportTargetNode(exportSourceNode), fmt, expOpts)
            .then((blob) => tview.host.export.download(blob, `${name}.${extFor(fmt, blob)}`))
            .catch((err) => console.error('Auto-export failed:', err)); }
        );
      }
    );
  }

  if (tview.pendingAutoCopy) {
    tview.pendingAutoCopy = false;
    Promise.all([waitForQuiescence(contentEl), brandVarsReady]).then(() =>
      { const { actionsApi, actionsEl, urlFormat } = tview; return armAutoCopy(actionsEl, actionsApi, urlFormat || undefined); }
    );
  }

  if (tview.pendingAutoPreview) {
    tview.pendingAutoPreview = false;
    Promise.all([waitForQuiescence(contentEl), brandVarsReady]).then(() =>
      runPreview(tview).catch((err) => console.error('Auto-preview failed:', err))
    );
  }
}
// Paint any queued frame right now (cancelling the scheduled rAF). Used by
// exportUnscaled so a capture reads the latest keystroke, and harmless if no
// frame is pending.
export function flushRender(tview: ToolViewCtx): void {
  if (tview.rafId) {
    cancelAnimationFrame(tview.rafId);
    tview.rafId = 0;
    paint(tview);
  }
}
export function wirePreview(tview: ToolViewCtx): void {
  const { autoCopy, autoExport, canvasEl, contentEl, previewCfg, runtime, sizeDriver } = tview;
  if (previewCfg && canvasEl) {
    canvasEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-preview]');
      if (!b) return;
      tview.render.runPreview(b).catch((err) => console.error('Preview failed:', err));
    });
  }

  // File-utility download: a template [data-export-file] button asks the tool's
  // exportFile hook to produce the transformed bytes (the file in → file out
  // shape - EXIF strip, redact, compress, …), then delivers them via
  // host.export.file (no watermark, no provenance - it's the user's own file).
  // Delegated on the persistent content container so it survives the innerHTML
  // rebuild the runtime subscriber does on every input change.
  if (runtime.hasExportFile && contentEl) {
    contentEl.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-export-file]');
      if (!btn || btn.dataset.busy) return;
      btn.dataset.busy = '1';
      btn.dataset.idleLabel ??= (btn.textContent ?? '').trim();
      btn.classList.remove('is-error');
      btn.classList.add('is-busy');
      btn.textContent = btn.dataset.busyLabel || t('Working…');
      try {
        let transformOpts: Record<string, unknown> = {};
        if (btn.hasAttribute('data-export-password')) {
          const { askExportLock } = await import('../../lib/export-lock.ts');
          const lock = await askExportLock(t('this PDF'), true);
          if (!lock.ok) {
            btn.classList.remove('is-busy');
            btn.textContent = btn.dataset.idleLabel!;
            delete btn.dataset.busy;
            return;
          }
          if (!lock.strongPassword) throw new Error(t('Enter a password to lock this PDF.'));
          transformOpts = { password: lock.strongPassword };
        }
        const res = await runtime.exportFile(transformOpts);
        const items = Array.isArray(res) ? res : [res];
        if (items.length === 1) {
          const { bytes, mime, filename } = items[0]!;
          const blob = new Blob([bytes as BlobPart], { type: mime || 'application/octet-stream' });
          await tview.host.export.file(blob, { filename: filename || 'file' });
        } else {
          // Batch (a `multiple` file input): fold every transformed file into ONE
          // zip so the browser delivers a single download (STORED for the already-
          // compressed media these tools emit). Names are disambiguated because
          // storeZip rejects collisions.
          const { storeZip } = await import('@lolly/engine');
          const used = new Map<string, number>();
          const entries = items.map((r, i) => {
            let name = r.filename || `file-${i + 1}`;
            const n = used.get(name) ?? 0;
            used.set(name, n + 1);
            if (n) {
              const dot = name.lastIndexOf('.');
              name =
                dot > 0 ? `${name.slice(0, dot)}-${n + 1}${name.slice(dot)}` : `${name}-${n + 1}`;
            }
            return {
              name,
              bytes: r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes),
            };
          });
          const zip = storeZip(entries);
          await tview.host.export.file(new Blob([zip as BlobPart], { type: 'application/zip' }), {
            filename: btn.dataset.exportArchive || 'transformed-files.zip',
          });
        }
        btn.classList.remove('is-busy');
        btn.textContent = btn.dataset.idleLabel!;
        delete btn.dataset.busy;
      } catch (err) {
        console.error('exportFile failed:', err);
        btn.classList.remove('is-busy');
        btn.classList.add('is-error');
        btn.textContent = (err as { message?: string })?.message || t('Export failed - try again');
        delete btn.dataset.busy;
      }
    });
  }

  // Scripts in template HTML don't execute when set via innerHTML (browser security).
  // Run them once on first render; subsequent renders update data but keep the
  // same script context alive.
  tview.pendingAutoExport = autoExport;
  tview.pendingAutoCopy = autoCopy;
  // Auto-generate a preview once the tool settles, so the user ends up on a rendered
  // frame rather than the placeholder. Once only (never on every input change - a
  // deferred render must stay deliberate), and skipped when a ?export is already
  // queued so we don't capture the same page twice on load.
  tview.pendingAutoPreview = Boolean(previewCfg?.auto) && !autoExport;
  // The model the sidebar DOM was last built/synced against. syncInputs uses it to
  // skip the full panel rebuild on a keystroke when the edited field already shows
  // the new value (see syncInputs). Null until the first render.
  tview.prevInputsModel = null;
  // Track the size-driving select's value so a change pushes the option's physical
  // dimensions to the export bar (see exportSizeDriver / actionsApi.setDims).
  tview.lastDimsSizeVal = sizeDriver
    ? runtime.getModel().find((i) => i.id === sizeDriver.id)?.value
    : null;
}

export function wireRenderLoop(tview: ToolViewCtx): void {
  const { runtime } = tview;
  tview.renderGen = 0;
  // Latest embed-hydration promise; exportUnscaled awaits it so an export reads
  // resolved blob URLs rather than the neutralised 1×1 placeholder.
  tview.embedsPending = Promise.resolve();
  // Latest lottie-mount pass (same contract); the module is loaded lazily the
  // first time a paint emits a [data-lottie-src] marker and kept for reaping.
  tview.lottiePending = Promise.resolve();
  tview.lottieModule = null;
  // Same contract for the video position-keeper (see video-mount.js): loaded the
  // first paint that emits a keyed <video>, awaited before export so a snapshot
  // reads a decoded frame rather than a blank one.
  tview.videoPending = Promise.resolve();
  tview.videoModule = null;
  // Same contract for the animated-SVG enhancer (anim-svg-mount.js): loaded the first
  // paint that emits a [data-anim-src] marker, inlining a live, seekable <svg> so it
  // animates in the preview and exports frame-accurately (parallel to Lottie).
  tview.animSvgPending = Promise.resolve();
  tview.animSvgModule = null;
  // Same contract for the shaped-glyph enhancer (glyph-split-mount.ts, plans/175
  // WP-D): loaded the first paint that emits a letter-tier split box, awaited before
  // export so a still or the compositor's live shots read shaped glyphs, not the
  // half-replaced span tier.
  tview.glyphPending = Promise.resolve();
  tview.glyphModule = null;
  // Same contract again for the MilkDrop enhancer (lib/viz-tool-mount.js): the tool
  // renders a placeholder and the shell owns the WebGL canvas inside it, across paints.
  tview.vizPending = Promise.resolve();
  tview.vizModule = null;

  // On-canvas table-cell editing for paginated tools (render.paginate): cells the
  // template stamped data-cell / data-cell-pick become editable / pickable, and
  // every edit bakes straight back to the source table input - the same setInput
  // path a sidebar keystroke rides. Re-wired each paint (the innerHTML swap
  // discards listeners, like every other canvas enhancer).
  const paginateSource = tview.tool.manifest.render.paginate?.source; tview.paginateSource = paginateSource;
  const tableEditOpts: TableEditOpts | null = paginateSource
    ? {
        getTable: () =>
          normalizeTableValue(runtime.getModel().find((i) => i.id === paginateSource)?.value) ?? {
            columns: [],
            rows: [],
          },
        commit: (next) => {
          void runtime.setInput(paginateSource, next);
        },
        pickImage: async (tag) => {
          const ref = await tview.host.assets.pick({
            tags: tag ? [tag] : undefined,
            title: t('Pick an image'),
          });
          if (!ref?.url) return null;
          // A user-upload's blob: URL dies with the session - inline small ones as
          // data: so the markdown ref remains across reloads and the table's Copy button.
          const url = await markdownSafeUrl(ref.url);
          const meta = ref.meta as { name?: unknown } | undefined;
          return { url, alt: typeof meta?.name === 'string' ? meta.name : ref.id };
        },
        pickLabel: t('Pick an image'),
      }
    : null; tview.tableEditOpts = tableEditOpts;

  // The RENDER half of the subscriber is coalesced behind requestAnimationFrame:
  // a full canvas rebuild swaps innerHTML, re-walks annotations, and re-executes
  // every template <script> (chart/QR/map libs re-instantiate), so doing it per
  // keystroke is wasteful. We stash the latest emit and paint at most once per
  // frame - the sidebar sync (below) stays synchronous so typed values echo with
  // no lag. The trailing emit is always the one we paint, so the final keystroke
  // never gets dropped; flushRender() forces it out synchronously before exports.
  tview.rafId = 0;
  tview.pendingFrame = null; // latest { model, hydrated } awaiting paint
  tview.lastPainted = null; // hydrated source of the last CLEAN paint - skip an identical canvas rebuild
  tview.lastPaintedBoxes = null;
}

export function renderOps(tview: ToolViewCtx) {
  return {
    runPreview: bindOp(tview, runPreview),
    showCanvasError: bindOp(tview, showCanvasError),
    clearCanvasError: bindOp(tview, clearCanvasError),
    paint: bindOp(tview, paint),
    flushRender: bindOp(tview, flushRender),
    wirePreview: bindOp(tview, wirePreview),
    wireRenderLoop: bindOp(tview, wireRenderLoop),
  };
}
