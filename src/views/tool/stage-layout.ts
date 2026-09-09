// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: sidebar width, canvas fit, paged and carousel canvases, the filmstrip.
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import { acquireCollabSession } from '../../lib/collab-session-source.ts';
import { carryMountState, willRemountForCollab } from '../../lib/collab-live-mount.ts';
import { releaseTeamSessionOrigin } from '../../org/team-session-origin.ts';
import type { ToolCollab } from '../tool-collab.ts';
import { stopFrameFps } from '../../lib/frame-fps.ts';
import { escape as escapeText } from '../../utils.ts';
import { backPillHtml } from '../../components/back-pill.ts';
import { guideButtonHtml, hasGuide } from '../../components/tool-guide.ts';
import { docsAppHref, t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { applyBrandVars } from '../../brand-vars.ts';
import { createThemeToggle } from '../../components/theme-toggle.ts';
import { createSoundToggle } from '../../components/sound-toggle.ts';
import { createProfileControl } from '../../components/profile-menu.ts';
import { mountScopedStyle } from '../../lib/scope-css.ts';
import { flickDirection, setupMobileSheet } from '../../lib/mobile-sheet.ts';
import { wireExportPanelFloat } from '../../lib/export-panel-float.ts';
import { isDocked, releaseDock } from '../../lib/edge-dock.ts';
import { playSfx } from '../../lib/sfx.ts';
import { attachCanvasCommit } from '../../lib/canvas-commit.ts';
import { mountUndoControls } from '../tool-history-controls.ts';
import { icon } from '../../lib/icons.ts';
import { setupStageNav } from '../tool-stage-nav.ts';
import { focusSidebarBlock, scrollToControl, stopSlotPreview } from '../tool-inputs.ts';
import { armViewEnter } from '../../view-enter.ts';
import type { PanelEl } from './shared.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

export function setSidebarWidth(tview: ToolViewCtx, w: number, save = true): void {
  const { SIDEBAR_MIN, fullscreenToggle, layout, sidebarEl } = tview;
  if (!sidebarEl) return;
  const snapped = w < SIDEBAR_MIN ? 0 : w;
  sidebarEl.style.width = snapped + 'px';
  // Freeze the content width at the open size so collapsing to 0 clips rather
  // than reflows (kept on collapse - only updated while the panel is open).
  if (snapped > 0) sidebarEl.style.setProperty('--sb-open-w', snapped + 'px');
  // Publish the open width so the desktop export panel can match the sidebar.
  if (snapped > 0) layout.style.setProperty('--sidebar-w', snapped + 'px');
  const isOpen = snapped > 0;
  layout.dataset.sidebar = isOpen ? 'open' : 'closed';
  if (fullscreenToggle) {
    fullscreenToggle.toggleAttribute('open', isOpen);
    fullscreenToggle.setAttribute(
      'aria-label',
      isOpen ? t('Collapse sidebar') : t('Expand sidebar')
    );
  }
  if (save) localStorage.setItem('sidebarWidth', String(snapped));
}
// The live param string, whichever URL form the bar is in: the path's ?search once
// syncUrl has prettified it, or the hash's #…?query in the instant after boot.
export function currentQuery(_tview: ToolViewCtx): string {
  if (window.location.search) return window.location.search.slice(1);
  const qi = window.location.hash.indexOf('?');
  return qi >= 0 ? window.location.hash.slice(qi + 1) : '';
}
export function getRestoreWidth(tview: ToolViewCtx): number {
  const { SIDEBAR_DEFAULT, SIDEBAR_MIN } = tview;
  const v = Number(localStorage.getItem('sidebarWidth'));
  return v > SIDEBAR_MIN ? v : SIDEBAR_DEFAULT;
}
export function updateFullParam(tview: ToolViewCtx, shouldBeFull: boolean): void {
  const { TOOL_URL_BASE } = tview;
  const sp = new URLSearchParams(currentQuery(tview));
  if (shouldBeFull) sp.set('full', '');
  else sp.delete('full');
  const parts: string[] = [];
  for (const [k, v] of sp.entries()) parts.push(v ? `${k}=${encodeURIComponent(v)}` : k);
  const q = parts.join('&');
  history.replaceState(history.state, '', q ? `${TOOL_URL_BASE}?${q}` : TOOL_URL_BASE);
}
// ── Responsive canvas ─────────────────────────────────────────────────────
//
// The canvas stays at its DOM-declared pixel dimensions so that CSS
// getComputedStyle and exports work correctly. A CSS transform scales it
// visually to fit the available stage width. The outer wrapper is sized to
// the visual (scaled) dimensions so the layout doesn't leave a gap.

export function fitCanvas(tview: ToolViewCtx): void {
  const { canvasEl, nativeH, nativeW, outerEl, pagedDoc, pagesMode, sidebarEl, stageEl, visitorPage } = tview;
  if (visitorPage) return; // a visitor page flows as a document - never scaled to fit
  if (!canvasEl || !outerEl) return;
  if (tview.stageZoom?.isZoomed()) return; // preserve pan/zoom across window/sidebar resize
  if (pagesMode) {
    fitPages(tview);
    return;
  } // carousel: fit the page strip, not one page
  if (pagedDoc) {
    fitPagedDoc(tview);
    return;
  } // multi-page doc: fit one page's width; the stage scrolls
  const canvasW = parseInt(canvasEl.style.width, 10) || nativeW;
  const canvasH = parseInt(canvasEl.style.height, 10) || nativeH;
  const stageRect = stageEl.getBoundingClientRect();

  // On mobile the controls sheet overlaps the top of the (static) preview stage.
  // Pad the stage down by however much the sheet currently covers it, so Fit
  // sizes AND centres the canvas within the area the sheet leaves visible - not
  // behind it. getBoundingClientRect is the border-box (padding-independent), so
  // the scale math stays stable as we set the padding.
  let topPad = 0;
  if (sidebarEl && window.matchMedia('(max-width: 640px)').matches) {
    const sheetBottom = sidebarEl.getBoundingClientRect().bottom;
    topPad = Math.max(0, Math.min(stageRect.height, sheetBottom - stageRect.top));
  }
  const padPx = topPad ? `${topPad}px` : '';
  if (stageEl.style.paddingTop !== padPx) stageEl.style.paddingTop = padPx; // guard the ResizeObserver

  // A view can reserve top/bottom chrome bands (via --stage-reserve-* on the stage) so the
  // fitted canvas sits BETWEEN its docked toolbars instead of under them - the deck editor
  // uses this to lift its freeform toolbars out of the canvas. Default 0 → wholly inert for
  // every other tool. Reserved as flex MARGINS on the centred outer (not stage padding - the
  // overlay is inset to the stage's padding box, so padding would drag the toolbars in with
  // it); justify-content:center then honours the margins, floating the canvas into the band.
  const cs = getComputedStyle(stageEl);
  const reserveTop = Math.max(0, parseFloat(cs.getPropertyValue('--stage-reserve-top')) || 0);
  const reserveBottom = Math.max(
    0,
    parseFloat(cs.getPropertyValue('--stage-reserve-bottom')) || 0
  );
  // Left band: the free-canvas rail docks into a fixed-width left panel while the
  // timeline is open (see dockRailForTimeline). Same margin mechanism as top/bottom -
  // centring the margin box puts the canvas exactly centred in the remaining band.
  const reserveLeft = Math.max(0, parseFloat(cs.getPropertyValue('--stage-reserve-left')) || 0);
  // There is NO right band. The one right-hand column is the app's edge dock
  // (lib/edge-dock.ts) - the export sheet, the compact zoom bar and the Design
  // inspector all take a slot in it - and that column reserves its space by nudging
  // `#view` with `--dock-w`, so the stage this function measures is already narrower.
  // Subtracting a second right reserve on top of it took the space twice and left the
  // canvas sitting off-centre to the left of its own surface.
  const availW = Math.max(40, stageRect.width - reserveLeft - 32);
  const availH = Math.max(40, stageRect.height - topPad - reserveTop - reserveBottom - 32);
  const scale = Math.min(1, availW / canvasW, availH / canvasH);
  canvasEl.style.transform = scale < 1 ? `scale(${scale.toFixed(4)})` : '';
  outerEl.style.width = Math.round(canvasW * scale) + 'px';
  outerEl.style.height = Math.round(canvasH * scale) + 'px';
  outerEl.style.marginTop = reserveTop ? `${reserveTop}px` : '';
  outerEl.style.marginBottom = reserveBottom ? `${reserveBottom}px` : '';
  outerEl.style.marginLeft = reserveLeft ? `${reserveLeft}px` : '';
  outerEl.style.marginRight = '';
  tview.stageZoom?.sync(); // refresh the zoom % readout after a re-fit
}
// Reset pan/zoom and re-fit. Passed to renderActions so a dimension change always
// returns to a clean fitted view rather than leaving a panned/zoomed canvas.
//
// The fit is the CONTENT fit (`stageZoom.fit()`), the same one `refitStage` and the
// `canvas-resize` listener use since plan 179 C5 - not `reset() + fitCanvas()`, which
// frames the export box alone. `setCanvasSize` calls this, and `importAsArtboards`
// calls `setCanvasSize` the moment its rows commit: a 20-slide .pptx was therefore
// framed on slide 1 with slides 2-20 off the right edge and nothing saying they were
// there, on the newest path, with no later re-fit (the ResizeObserver watches the
// stage, whose size did not change). `fit()` resets first, so the "return to a clean
// fitted view" contract is unchanged; a tool with no artboards cannot tell the
// difference, since the content rect is then null and fit() is exactly what this was.
export function resetView(tview: ToolViewCtx): void {
  if (tview.stageZoom) tview.stageZoom.fit();
  else fitCanvas(tview);
}
// ── Multi-page document canvas (render.paged) ──────────────────────────────
// A paged tool stacks its [data-pdf-page] boxes vertically and the STAGE scrolls the
// whole document - every page visible at full length, not one page clipped with an
// inner scroll (the old behaviour where pages "appeared out of nowhere"). We fit ONE
// page's width to the surface with `zoom` (not a transform: zoom shrinks the layout
// box too, so the scroll surface measures the pages at their on-screen size and scrolls
// correctly). Height grows via CSS (#tool-canvas + its root are height:auto here), so
// adding a page just makes the surface taller. `zoom` is neutralised during export
// (exportUnscaled) so each page still prints at its true, unscaled page size.
export function fitPagedDoc(tview: ToolViewCtx): void {
  const { canvasEl, nativeW, stageEl, webDoc } = tview;
  if (!canvasEl) return;
  // A web-page preview never zooms: the canvas IS the viewport, CSS gives it
  // the pane's full width and the content reflows there like a real page.
  if (webDoc) {
    canvasEl.style.zoom = '';
    tview.stageZoom?.sync();
    return;
  }
  const stageRect = stageEl.getBoundingClientRect();
  // Leave the surface's side padding (24px each) PLUS room for each page's drop-shadow,
  // so the left/right shadows aren't clipped by the scroll surface.
  const availW = Math.max(40, stageRect.width - 96);
  const zoom = Math.min(1, availW / nativeW); // never upscale past 1:1
  canvasEl.style.zoom = zoom < 1 ? String(Number(zoom.toFixed(4))) : '';
  tview.stageZoom?.sync();
}
// ── Multi-page (carousel) canvas ──────────────────────────────────────────
// The editor canvas is a horizontal strip of N same-size page frames. render.width/
// height stay ONE page's size (each [data-pdf-page] frame + PDF page is page-sized);
// the STRIP width is derived from the live page-count + page-size inputs and applied
// to #tool-canvas so the free-canvas overlay's coordinate math (which reads
// canvasEl.style.width) stays correct. Fit shows up to three pages at a workable size
// (fit-to-single-page is off) - the zoom/pan HUD reaches the rest.
export function pageGeom(tview: ToolViewCtx): { count: number; pw: number; ph: number; gap: number; stripW: number } {
  const { nativeH, nativeW, pagesCfg } = tview;
  const cfg = pagesCfg!;
  const gap = cfg.gap ?? 56;
  const min = cfg.min ?? 1,
    max = cfg.max ?? 6;
  const read = (id: string, dflt: number): number => {
  const { runtime } = tview;
    const v = runtime.getModel().find((i) => i.id === id)?.value;
    const n = typeof v === 'number' ? v : parseFloat(v as string);
    return Number.isFinite(n) ? n : dflt;
  };
  const count = Math.max(min, Math.min(max, Math.round(read(cfg.count, 3))));
  const pw = Math.max(1, Math.round(read(cfg.width, nativeW)));
  const ph = Math.max(1, Math.round(read(cfg.height, nativeH)));
  return { count, pw, ph, gap, stripW: count * pw + (count - 1) * gap };
}
export function fitPages(tview: ToolViewCtx): void {
  const { canvasEl, outerEl, pagesCfg, stageEl } = tview;
  if (!canvasEl || !outerEl || !pagesCfg) return;
  const g = pageGeom(tview);
  const stageRect = stageEl.getBoundingClientRect();
  const availW = Math.max(40, stageRect.width - 32);
  const availH = Math.max(40, stageRect.height - 32);
  // Fit up to three pages wide (identical to the whole strip when count ≤ 3); the
  // strip scales as one unit (transform-origin: top left) so overlay geometry holds.
  const shown = Math.min(g.count, 3);
  const viewW = shown * g.pw + (shown - 1) * g.gap;
  const scale = Math.min(1, availW / viewW, availH / g.ph);
  canvasEl.style.transform = scale !== 1 ? `scale(${scale.toFixed(4)})` : '';
  outerEl.style.width = Math.round(g.stripW * scale) + 'px';
  outerEl.style.height = Math.round(g.ph * scale) + 'px';
  tview.stageZoom?.sync();
}
export function syncStrip(tview: ToolViewCtx): void {
  const { canvasEl, pagesMode } = tview;
  if (!pagesMode || !canvasEl) return;
  const g = pageGeom(tview);
  const key = g.stripW + 'x' + g.ph;
  if (key === tview.prevStripKey) return;
  tview.prevStripKey = key;
  canvasEl.style.width = g.stripW + 'px';
  canvasEl.style.height = g.ph + 'px';
  tview.stageZoom?.reset();
  fitPages(tview);
} // size the strip before the first fit

// Re-fit after the stage (or the canvas) changed size. At Fit this is the FULL fit,
// which since plan 179 C5 means "the canvas, then the artboard union on top of it" -
// so a deck's framing tracks a window resize, and a template load that brings in new
// artboards is framed rather than left half off-screen. A view the USER zoomed or
// panned is untouched, exactly as before (fitCanvas's own isZoomed guard), and a tool
// with no artboards cannot tell the difference: stageZoom.fit() is then reset() (a
// no-op at Fit) plus the same fitCanvas call this always made.
export function refitStage(tview: ToolViewCtx): void {
  if (tview.stageZoom && !tview.stageZoom.isUserZoomed()) tview.stageZoom.fit();
  else fitCanvas(tview);
}
/** Sidebar width, dropped lines and inputs. */
export async function wireSidebar(tview: ToolViewCtx): Promise<void> {
  const { backPillOpts, bareExport, bulkFilesId, canBulk, canSaveSession, canvasRole, captureHint, chromeless, designChrome, documentLayout, dsRegistry, exportUiEmpty, hasInputs, hideSidebar, isFull, madeWith, nativeH, nativeW, noAside, onDevice, pagedDoc, privacyBadge, runtime, showAside, showExportPanel, toolId, transcribeSpec, viewEl, visitorPage, webDoc } = tview;
  const SIDEBAR_DEFAULT = 272; tview.SIDEBAR_DEFAULT = SIDEBAR_DEFAULT;
  const SIDEBAR_MIN = 40; tview.SIDEBAR_MIN = SIDEBAR_MIN;
  const savedWidth = Number(localStorage.getItem('sidebarWidth') ?? SIDEBAR_DEFAULT); tview.savedWidth = savedWidth;
  // The desktop export panel anchors to the sidebar's bottom edge, so ?options
  // needs the sidebar open even if this device last left it collapsed (width 0).
  const sidebarOpen =
    isFull || hideSidebar || chromeless ? false : showExportPanel || savedWidth > 0; tview.sidebarOpen = sidebarOpen;
  const openWidth = savedWidth > 0 ? savedWidth : SIDEBAR_DEFAULT; tview.openWidth = openWidth;

  // A saved design (or a shared URL) can reference an image the user has since
  // deleted from their device library. The runtime resolves those to null and
  // reports them here; tell the user the field was left blank rather than leaving
  // a silent gap. Worded by DroppedAsset.reason: a frozen (baked) image whose
  // stored data was missing reads differently from an image that no longer resolves.
  const dropped = runtime.droppedAssets ?? []; tview.dropped = dropped;
  const bakedLost = dropped.filter((d) => d.reason === 'baked-bytes-lost'); tview.bakedLost = bakedLost;
  const unresolved = dropped.filter((d) => d.reason !== 'baked-bytes-lost'); tview.unresolved = unresolved;
  const _fieldsWere = (n: number): string => (n > 1 ? t('fields were') : t('field was'));
  const droppedLines = [
    unresolved.length
      ? t(
          'An image used in this saved design is no longer available, so the <strong>{fields}</strong> {were} left blank.',
          { fields: unresolved.map((d) => d.label).join(', '), were: tview.history.fieldsWere(unresolved.length) }
        )
      : '',
    bakedLost.length
      ? t(
          "A frozen image's data was missing from this saved design, so the <strong>{fields}</strong> {were} left blank.",
          { fields: bakedLost.map((d) => d.label).join(', '), were: tview.history.fieldsWere(bakedLost.length) }
        )
      : '',
  ].filter(Boolean); tview.droppedLines = droppedLines;
  const droppedNotice = droppedLines.length
    ? `
    <div class="tool-notice" role="status" id="dropped-assets-notice">
      <span class="tool-notice-text">${droppedLines.join(' ')}</span>
      <button type="button" class="tool-notice-close" id="dropped-assets-dismiss" aria-label="${escapeText(t('Dismiss this message'))}">✕</button>
    </div>`
    : ''; tview.droppedNotice = droppedNotice;

  // Capture tool without the extension (see the gate above): mounted for composition,
  // so tell the author capture-to-file needs the extension/desktop while compose works.
  const captureNotice = captureHint
    ? `
    <div class="tool-notice" role="status" id="capture-hint-notice">
      ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - docsAppHref() over a build-time slug constant, always '#/docs/…' */ ''}
      <span class="tool-notice-text">${t('Compose a shot and copy its recipe here. Saving it to a file needs the desktop app or browser extension.')} <a href="${escapeText(docsAppHref('create/extension'))}" target="_blank" rel="noopener">${t('Get the extension')}</a></span>
      <button type="button" class="tool-notice-close" id="capture-hint-dismiss" aria-label="${escapeText(t('Dismiss this message'))}">✕</button>
    </div>`
    : ''; tview.captureNotice = captureNotice;

  // A resumed session made under another design system (plans/186 section 3.8):
  // say so, and offer the switch when that system is on this device. Rendering
  // continues with the active one meanwhile - a missing ref keeps its cached hex,
  // which is the half-rebrand the notice is warning about.
  const madeWithOnDevice =
    madeWith && dsRegistry ? await dsRegistry.get(madeWith.id).catch(() => null) : null; tview.madeWithOnDevice = madeWithOnDevice;
  const madeWithNotice = madeWith
    ? `
    <div class="tool-notice" role="status" id="made-with-notice">
      <span class="tool-notice-text">${
        madeWithOnDevice
          ? t('Made with <strong>{name}</strong>. This design system is not the active one.', {
              name: escapeText(madeWith.label),
            })
          : t(
              'Made with <strong>{name}</strong>, which is not on this device. Rendering with the active design system.',
              { name: escapeText(madeWith.label) }
            )
      }
        ${madeWithOnDevice ? ` <button type="button" class="tool-notice-link" id="made-with-switch">${t('Switch to {name}', { name: escapeText(madeWith.label) })}</button>` : ''}</span>
      <button type="button" class="tool-notice-close" id="made-with-dismiss" aria-label="${escapeText(t('Dismiss this message'))}">✕</button>
    </div>`
    : ''; tview.madeWithNotice = madeWithNotice;

  viewEl.innerHTML = `
    ${
      /* The editor layout's Home pill moves INTO the design top bar's left slot (plan 179
          M1), so the free-floating corner pill is gated off there - two pills would sit on
          top of each other. mountBackPill() scans the whole view, so the one the bar emits
          (backHomeHtml, below) is wired by the same call, unsaved-changes intercept and all. */ ''
    }
    ${noAside && !visitorPage && !designChrome ? backPillHtml(backPillOpts) : ''}
    <div class="tool-layout${chromeless ? ' is-editor' : ''}${documentLayout ? ' is-document' : ''}${pagedDoc ? ' is-paged' : ''}${webDoc ? ' is-webdoc' : ''}${visitorPage ? ' is-visitor' : ''}${hideSidebar && !visitorPage ? ' is-bare' : ''}" id="tool-layout"${documentLayout ? ' data-theme="light"' : ''} data-sidebar="${noAside ? 'hidden' : sidebarOpen ? 'open' : 'closed'}">
      ${
        showAside
          ? `
        <aside class="sidebar" id="tool-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-back-row">
              ${backPillHtml({ ...backPillOpts, class: 'sidebar-back' })}
            </div>
            <div class="sidebar-header-row">
              <span class="sidebar-title-wrap">
                <span class="sidebar-title">${escapeText(tview.tool.manifest.name)}</span>
                ${hasGuide(tview.tool.manifest) ? guideButtonHtml() : ''}
                ${canSaveSession ? `<button type="button" class="multi-edit-btn" id="multi-edit-btn" data-tip="${escapeText(t('Make variants'))}" aria-label="${escapeText(t('Make variants'))}" aria-haspopup="menu" aria-expanded="false">${icon('grid', { className: 'multi-edit-icon' })}</button>` : ''}
                ${
                  /* "Bulk from rows" - the same icon-only header control as Make variants
                      next to it, so it needs no styling of its own. */ ''
                }
                ${canBulk ? `<button type="button" class="multi-edit-btn" id="bulk-rows-btn" data-tip="${escapeText(t('Bulk from rows'))}" aria-label="${escapeText(t('Bulk from rows'))}">${icon('table', { className: 'multi-edit-icon' })}</button>` : ''}
                ${/* "Bulk from files" (plans/147 M2) - loop this transform tool over N picked files into one zip. */ ''}
                ${bulkFilesId ? `<button type="button" class="multi-edit-btn" id="bulk-files-btn" data-tip="${escapeText(t('Bulk from files'))}" aria-label="${escapeText(t('Bulk from files'))}">${icon('layersStack', { className: 'multi-edit-icon' })}</button>` : ''}
              </span>
              <button class="fullscreen-toggle" id="fullscreen-toggle" ${sidebarOpen ? 'open' : ''} aria-label="${escapeText(sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar'))}"></button>
            </div>
          </div>
          <div class="sidebar-body">
            ${privacyBadge}
            ${droppedNotice}
            ${captureNotice}
            ${madeWithNotice}
            <div id="tool-inputs" class="tool-inputs"></div>
            ${
              hasInputs
                ? `
              <div class="sidebar-utils" id="sidebar-utils">
                ${toolId === 'darkroom' && typeof (window as { VideoDecoder?: unknown }).VideoDecoder !== 'undefined' && typeof (window as { VideoEncoder?: unknown }).VideoEncoder !== 'undefined' ? `<button type="button" id="grade-video-btn" class="clear-inputs-btn" title="${escapeText(t('Apply this look to a video from your library - runs on-device as a background job'))}">${t('Grade a video…')}</button>` : ''}
                ${transcribeSpec ? `<button type="button" id="transcribe-btn" class="clear-inputs-btn" disabled title="${escapeText(t('Add a clip first'))}">${t('Transcribe')}</button>` : ''}
                <button type="button" id="clear-inputs-btn" class="clear-inputs-btn" title="${escapeText(t('Reset all inputs to defaults'))}">${t('Clear changes')}</button>
              </div>
            `
                : ''
            }
            <div class="tool-actions" id="tool-actions"></div>
          </div>
          <div class="sidebar-drag-handle resize-grip" id="sidebar-drag-handle"></div>
        </aside>
        <!-- Grip lives OUTSIDE the sheet (it's position:fixed): keeps it from being
             clipped by the sheet's overflow, which must stay hidden so the form
             can't spill past the sheet's rounded edge. -->
        <button type="button" class="sheet-grip" id="sheet-grip" aria-label="${escapeText(t('Drag to resize controls, tap to expand'))}"></button>
      `
          : chromeless || bareExport
            ? `<div class="tool-actions" id="tool-actions"></div>`
            : ''
      }
      <div class="tool-stage" id="tool-stage">
        ${!exportUiEmpty && !visitorPage ? `<div class="url-budget" id="url-budget-gauge" role="button" tabindex="0" aria-label="${escapeText(t('URL budget'))}" title="${escapeText(t('URL budget'))}" hidden><span class="url-budget-fill" data-gauge-fill></span></div><div class="url-budget-toast" data-gauge-toast role="status" aria-live="polite" hidden></div>` : ''}
        ${showAside ? `<button class="fullscreen-toggle-float" id="fullscreen-toggle-float" aria-label="${escapeText(t('Expand sidebar'))}"></button>` : ''}
        ${
          hideSidebar && onDevice
            ? `<div class="on-device-badge on-device-badge--float" title="${escapeText(t('This tool runs entirely in your browser. Your file is never uploaded.'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>${t('Runs on your device - nothing is uploaded')}</span>
        </div>`
            : ''
        }
        ${
          hideSidebar
            ? `<div id="tool-content" role="${canvasRole}" aria-label="${escapeText(tview.history.canvasLabel())}"></div>`
            : `
        <div class="tool-canvas-outer" id="tool-canvas-outer">
          ${
            /* Visitor page: a real document, not a picture of one - no role="img"
                (its links must stay in the accessibility tree) and no fixed px
                frame (the page flows at viewport width, CSS owns the height). */ ''
          }
          <div class="tool-canvas" id="tool-canvas"${
            visitorPage
              ? ' style="width: 100%;"'
              : ` role="${canvasRole}" aria-label="${escapeText(tview.history.canvasLabel())}"
               style="width: ${nativeW}px; height: ${nativeH}px;"`
          }></div>
        </div>`
        }
      </div>
      ${
        (!hideSidebar || bareExport) && !exportUiEmpty && !visitorPage
          ? `
        <div class="render-pill" id="render-pill" role="group" aria-label="${escapeText(t('Export and save'))}">
          <button type="button" class="render-pill-btn render-pill-get" id="render-fab" data-sfx="hydraulicOpen" aria-label="${escapeText(t('Export options'))}">
            <svg class="render-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            <span>${t('Export')}</span>
          </button>
          ${
            canSaveSession
              ? `
          <span class="render-pill-sep" aria-hidden="true"></span>
          <button type="button" class="render-pill-btn render-pill-save" id="render-save" data-sfx="save" aria-label="${escapeText(t('Save to your library'))}" title="${escapeText(t('Save to your library'))}">
            <svg class="render-pill-icon render-pill-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span data-save-label>${t('Save')}</span>
          </button>`
              : ''
          }
        </div>
        <div class="export-overlay" id="export-overlay">
          <div class="export-overlay-scrim" data-export-close></div>
          ${
            /* data-canvas-keys="off": the canvas editor binds its bare-key verbs on
                `window`, so this sheet's own buttons were a live canvas surface - Delete
                on Download removed the selected box, the arrows nudged it. The attribute
                travels WITH the element the dock re-parents, so it covers the sheet
                docked in the right column and floating over the stage alike. */ ''
          }
          <div class="export-popup" role="dialog" aria-modal="true" data-canvas-keys="off" aria-label="${escapeText(t('Export'))}">
            <div class="export-popup-head">
              <span class="export-popup-title">${t('Export')}</span>
              <button type="button" class="export-popup-close" data-export-close aria-label="${escapeText(t('Close'))}">&#x2715;</button>
            </div>
            <div class="export-popup-body" id="export-popup-body"></div>
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  // Entrance settle (plans/142): a tool mounts as one brief fade instead of an
  // instant cut. The worst measured transition was a full-bleed dark canvas
  // (countdown) arriving over a near-white page - ΔL 0.90 with no easing. Armed
  // synchronously with the innerHTML above (view-enter.ts contract) so the first
  // paint already carries the hidden `from` state; reduced motion (OS or app
  // pref) skips arming entirely and renders instantly. The animated nodes are
  // the sidebar and the STAGE WRAPPER - never #tool-canvas itself, whose paint
  // is the user's artwork and is shared with the export path.
  armViewEnter(viewEl, '#tool-sidebar, .tool-stage');

  const canvasScope = hideSidebar ? '#tool-content' : '#tool-canvas'; tview.canvasScope = canvasScope;

  // Chromeless editors own their on-canvas affordances; ordinary tools get a focus hint.
  const focusHint = chromeless ? '' : `
[data-canvas-input] { cursor: pointer; }
[data-canvas-input]:hover { outline: 2px dashed rgba(128,128,128,0.35); outline-offset: 3px; border-radius: 2px; }`; tview.focusHint = focusHint;
  const styleEl = mountScopedStyle(`${tview.tool.styles ?? ''}${focusHint}`, canvasScope); tview.styleEl = styleEl;

  const layout = viewEl.querySelector<HTMLElement>('#tool-layout')!; tview.layout = layout;
  const inputsEl = viewEl.querySelector<PanelEl>('#tool-inputs'); tview.inputsEl = inputsEl;
  const canvasEl = hideSidebar ? null : viewEl.querySelector<HTMLElement>('#tool-canvas'); tview.canvasEl = canvasEl;
  const outerEl = hideSidebar ? null : viewEl.querySelector<HTMLElement>('#tool-canvas-outer'); tview.outerEl = outerEl as ToolViewCtx['outerEl'];
  const contentEl = (hideSidebar ? viewEl.querySelector<HTMLElement>('#tool-content') : canvasEl)!; tview.contentEl = contentEl;
  // The node the export/thumbnail actions target. Normally the fixed render canvas;
  // a bareExport full-bleed tool has no #tool-canvas, so it's the mounted #tool-content
  // (whose [data-export-root] mirror exportTargetNode then retargets). Non-null wherever
  // export is offered, unlike canvasEl which is null for every hideSidebar layout.
  const exportSourceNode = bareExport ? contentEl : canvasEl; tview.exportSourceNode = exportSourceNode;

  // Shell chrome a full-bleed tool can host INSIDE its own top toolbar via
  // [data-shell-slot] hooks: the render/export control. Re-applied after each
  // template paint (paint() swaps innerHTML, recreating the empty slots).
  // The theme slot ([data-shell-slot="theme"]) is retired (2026-08-27, Andy):
  // full-bleed utilities now dock the consolidated profile menu top-right - theme,
  // sound/Neurospicy and Language all live inside it - so the standalone toggle
  // would be a duplicate control. Tools that still author the slot get an empty
  // span, which renders nothing.
  tview.placeRenderPill = null;
}

export function wireFilmstrip(tview: ToolViewCtx): void {
  const { bakedLost, contentEl, dropped, madeWith, runtime, unresolved, viewEl } = tview;
  // Slide-sorter filmstrip for paged tools - mounted lazily on the first paint (below),
  // refreshed on each re-render, and torn down with the view. See lib/page-filmstrip.ts.
  tview.filmstrip = null;
  // Interactive tools (gradient, street-map) commit canvas edits through
  // this per-canvas channel bound to the one runtime; the marker persists across
  // every innerHTML paint. (The legacy global-sidebar-poke path stays as their
  // fallback for offscreen export, where no canvas is mounted.)
  attachCanvasCommit(contentEl, runtime);
  // Inject the brand's semantic colour slots (--brand-primary, --brand-surface,
  // …) from the active tokens onto the canvas root, so templates can consume
  // `var(--brand-primary, <fallback>)`. Like the token-sourced swatches above
  // (setSwatches), this is best-effort and non-blocking for the interactive
  // mount: a missing tokens doc leaves the template fallbacks in charge. The
  // promise IS captured, though - the deep-link auto-export/copy/preview paths
  // await it (raced with a short cap so a stalled tokens fetch can't hold up a
  // capture beyond quiescence) so a `?export=` capture doesn't race the tokens
  // fetch and ship fallback colours. Namespaced --brand-* so the vars can never
  // collide with the shell's :root shadcn HSL triples (see brand-vars.ts).
  const brandVarsReady: Promise<unknown> = Promise.race([
    applyBrandVars(contentEl, tview.host),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ]).catch(() => {
    /* cosmetic - never block a mount or fail an export on brand vars */
  }); tview.brandVarsReady = brandVarsReady;
  // Always present in the template (both layouts render #tool-stage), so treat it
  // as non-null - mirrors mountTool's unguarded uses (ro.observe, fitCanvas, …).
  const stageEl = viewEl.querySelector<HTMLElement>('#tool-stage')!; tview.stageEl = stageEl;

  // Sidebar tools use the shared header controls; Design supplies its top bar.
  const backRow = viewEl.querySelector<HTMLElement>('.sidebar-back-row'); tview.backRow = backRow as ToolViewCtx['backRow'];
  if (backRow) {
    tview.historyControls = mountUndoControls(backRow, tview.history.undoHistory, tview.history.redoHistory);
    tview.history.refreshHistoryUI();
  }

  // Theme cycle toggle now lives in the canvas zoom HUD (setupStageNav below), not
  // the sidebar header - so it's shared by every canvas tool (including the
  // chromeless editor/Design, which has no sidebar) and the header stays
  // uncluttered. Built once here so setupStageNav can dock it into the HUD.
  const themeToggle = createThemeToggle(tview.host as unknown as Parameters<typeof createThemeToggle>[0]); tview.themeToggle = themeToggle;
  // The interface-sound (sfx) toggle rides the same HUD, right after the theme toggle, so
  // the editor/Design (which has no sidebar) can mute/unmute sounds from the canvas.
  const soundToggle = createSoundToggle(tview.host as unknown as Parameters<typeof createSoundToggle>[0]); tview.soundToggle = soundToggle;
  // The profile avatar sits after the sound toggle - icon only, opening the same
  // consolidated menu the main views' top-right avatar opens (theme, sound/Neurospicy,
  // Language, Settings…), so a canvas tool needs no separate sidebar language/theme controls.
  const profileToggle = createProfileControl(
    tview.host as unknown as Parameters<typeof createProfileControl>[0],
    { className: 'stage-nav-profile' }
  ); tview.profileToggle = profileToggle;

  // Removed-image notice: announce it (live region) and let the user dismiss it.
  if (dropped.length) {
    announce(
      [
        unresolved.length
          ? tRaw(
              'An image used in this saved design is no longer available; the {fields} {were} left blank.',
              {
                fields: unresolved.map((d) => d.label).join(', '),
                were: tview.history.fieldsWere(unresolved.length),
              }
            )
          : '',
        bakedLost.length
          ? tRaw("A frozen image's data was missing; the {fields} {were} left blank.", {
              fields: bakedLost.map((d) => d.label).join(', '),
              were: tview.history.fieldsWere(bakedLost.length),
            })
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      { assertive: true }
    );
    viewEl
      .querySelector('#dropped-assets-dismiss')
      ?.addEventListener('click', () => viewEl.querySelector('#dropped-assets-notice')?.remove());
  }
  viewEl
    .querySelector('#capture-hint-dismiss')
    ?.addEventListener('click', () => viewEl.querySelector('#capture-hint-notice')?.remove());
  viewEl
    .querySelector('#made-with-dismiss')
    ?.addEventListener('click', () => viewEl.querySelector('#made-with-notice')?.remove());
  viewEl.querySelector('#made-with-switch')?.addEventListener('click', async () => {
    if (!madeWith) return;
    const { switchDesignSystem } = await import('../../lib/design-system/switch.ts');
    // The person asked for this session under its own design system: switch, then
    // remount this very route so the render is born with it (a just-opened saved
    // session holds no unsaved work yet).
    await switchDesignSystem(
      tview.host as unknown as Parameters<typeof switchDesignSystem>[0],
      madeWith.id,
      { noRemount: true }
    );
    window.dispatchEvent(new Event('lolly:remount'));
  });
}

export function wireStageZoom(tview: ToolViewCtx): void {
  const { dragHandle, fullscreenToggle, fullscreenToggleFloat, layout, openWidth, showAside, sidebarEl, sidebarOpen } = tview;
  // Canvas pan/zoom handle for the stage, assigned once the canvas is wired
  // (see setupStageNav below). Reset whenever the stage is resized by a
  // sidebar toggle so the preview returns to a clean fit.
  tview.stageZoom = null;
  // The Design mark menu lives on the free-canvas handle, which mounts after the stage
  // nav; the docked HUD's swirl reaches it through this late-bound slot.
  tview.onFocusRect = null;

  if (showAside) {
    fullscreenToggle!.addEventListener('click', () => {
      const opening = layout.dataset.sidebar !== 'open';
      tview.stageLayout.setSidebarWidth(opening ? tview.stageLayout.getRestoreWidth() : 0);
      tview.stageLayout.updateFullParam(!opening);
      tview.stageZoom?.reset();
      setTimeout(tview.stageLayout.fitCanvas, 220);
    });

    fullscreenToggleFloat!.addEventListener('click', () => {
      tview.stageLayout.setSidebarWidth(tview.stageLayout.getRestoreWidth());
      tview.stageLayout.updateFullParam(false);
      tview.stageZoom?.reset();
      setTimeout(tview.stageLayout.fitCanvas, 220);
    });

    // Drag to resize
    {
      let dragging = false;
      let startX = 0;
      let startW = 0;

      dragHandle!.addEventListener('pointerdown', (e) => {
        dragging = true;
        startX = e.clientX;
        startW = sidebarEl!.getBoundingClientRect().width;
        sidebarEl!.classList.add('is-dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        dragHandle!.setPointerCapture(e.pointerId);
      });

      dragHandle!.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const w = Math.min(600, Math.max(0, startW + (e.clientX - startX)));
        tview.stageLayout.setSidebarWidth(w, false);
      });

      dragHandle!.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        sidebarEl!.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        tview.stageLayout.setSidebarWidth(sidebarEl!.getBoundingClientRect().width);
        tview.stageLayout.fitCanvas();
      });
    }

    // Apply saved/initial width without triggering a save
    tview.stageLayout.setSidebarWidth(sidebarOpen ? openWidth : 0, false);
  }
}

/** Responsive canvas observers, multi-page canvases and presence chrome. */
export async function wireCanvas(tview: ToolViewCtx): Promise<void> {
  const { actionsEl, bareExport, canvasEl, chromeless, collab, contentEl, designChrome, editorLayout, hideSidebar, inputsEl, isFull, layout, libraryHost, mountLifecycle, nativeW, outerEl, pagedDoc, profileToggle, runtime, sheetGrip, showExportPanel, shutter, sidebarEl, slot, soundToggle, stageEl, styleEl, themeToggle, toolId, viewEl, visitorPage } = tview;
  // The stage resized, so the canvas re-fits - and every remote focus ring and
  // cursor was anchored from rects that just moved. `collabReanchor` is null unless
  // a collab is live, so this stays the one-call observer it has always been.
  const ro = new ResizeObserver(() => {
    tview.stageLayout.refitStage();
    tview.collabReanchor?.();
  }); tview.ro = ro;
  ro.observe(stageEl);
  tview.stageLayout.fitCanvas();
  if (canvasEl) canvasEl.addEventListener('canvas-resize', tview.stageLayout.refitStage);

  // A tool with a live canvas stage (its own preview, a sidebar, not a paged document or
  // the visitor page). These are the tools that consolidate their right-hand chrome into
  // the one edge-dock column - the HUD follows the sidebar and the export sheet opens in it
  // - so the right side reads like the Design editor's (Andy, 2026-09-07). Computed once
  // because the stage-nav mount (below) and the export-panel wiring (further down, outside
  // this block) both need it.
  const canvasStage = !!(stageEl && !hideSidebar && !visitorPage && outerEl && canvasEl && !pagedDoc); tview.canvasStage = canvasStage;

  // Canvas navigation - one module for both pointer types. Touch gets pinch-zoom +
  // drag-pan; desktop gets trackpad-native zoom/pan (Cmd/Ctrl-wheel & pinch zoom
  // about the cursor, Space/middle-drag pan, 0/1/+/- keys) plus a Fit/% HUD.
  if (canvasStage) {
    // The other direction of the `fc-focus-rect` seam (plan 179 C5): the stage ASKS the
    // overlay for a rect worth framing - the union of the document's artboards for Fit,
    // the selection's AABB for Shift+2. The dispatch is synchronous, so the answer is on
    // `detail.rect` by the time it returns; with no overlay mounted (every tool but the
    // canvas editors) or no artboards in the document it stays null, and Fit then does
    // exactly what it always did.
    const askRect =
      (what: 'content' | 'selection' | 'active') =>
      (): { x: number; y: number; w: number; h: number } | null => {
        const detail: {
          what: string;
          rect: { x: number; y: number; w: number; h: number } | null;
        } = { what, rect: null };
        try {
          stageEl.dispatchEvent(new CustomEvent('fc-query-rect', { detail }));
        } catch {
          return null;
        }
        return detail.rect;
      };
    const contentRect = askRect('content');
    // Pass fitCanvas as the "fit" action so the HUD's Fit button re-fits to the
    // CURRENT layout (e.g. the area left by the mobile sheet), not just the
    // stale fit that reset() restores. themeToggle docks into the HUD (its icon
    // sits alongside the zoom controls; see setupStageNav).
    // The Design editor gets NO floating HUD: its top bar carries Fit / ± / NN% (plan 179
    // M1), and the swirl pill was the second of two zoom controls on one stage. The theme
    // and sound toggles the HUD used to host move with it - into the bar's mark menu, via
    // the `chrome` option on initFreeCanvas below - so nothing is lost, only re-homed.
    // Every gesture (pinch, wheel, space-pan, 0/1/+/-) is unchanged either way.
    // In the Design editor the HUD is built hidden and docks itself into the right
    // sidebar's compact bar (zoom, theme, sound, profile) whenever that
    // column holds a panel; the top bar carries the zoom cluster and the avatar only
    // while nothing is docked (Andy, 2026-09-03: "the zoom / theme / profile menu are
    // meant to be part of the right dock if it is opened, we don't need to recreate
    // those things in the top panel"). The File menu stays in the top bar.
    tview.stageZoom = setupStageNav(
      stageEl,
      outerEl,
      canvasEl,
      nativeW,
      tview.stageLayout.fitCanvas,
      themeToggle,
      soundToggle,
      profileToggle,
      {
        contentRect,
        activeRect: askRect('active'),
        selectionRect: askRect('selection'),
        hud: !designChrome,
        editorLayout: !!designChrome,
        // Every OTHER canvas tool (Timezone, Darkroom, …) consolidates the HUD into the
        // one right column too - the pill stays visible when undocked, but rides into the
        // column as the compact bar whenever a full panel is docked there. Andy 2026-09-07.
        autoDockHud: !designChrome,
      }
    );
    // The Artboards navigator (free-canvas) asks the stage to frame one artboard by
    // dispatching `fc-focus-rect` with the frame's native rect - the overlay never
    // touches the pan/zoom transform itself. Wired here because only tool.ts holds the
    // StageNav handle; torn down with the view in _cleanup below.
    tview.onFocusRect = (e: Event): void => {
      const d = (e as CustomEvent<{ x: number; y: number; w: number; h: number }>).detail;
      if (d) tview.stageZoom?.focusRect(d.x, d.y, d.w, d.h);
    };
    stageEl.addEventListener('fc-focus-rect', tview.onFocusRect);

    // A document with artboards OPENS showing all of them. Both halves of the answer land
    // after this line - the runtime paints the frame pages asynchronously and the overlay
    // that reports them is a lazy chunk - so poll a bounded run of frames for the first
    // content rect, exactly like the `?present` auto-entry below, and fit once. Any hand
    // on the trackpad (or a deep link that framed something) wins and stops the poll.
    {
      let tries = 0;
      const openFit = (): void => {
        if (!viewEl.isConnected || !tview.stageZoom || tview.stageZoom.isUserZoomed()) return;
        if (contentRect()) {
          tview.stageZoom.fit();
          return;
        }
        if (tries++ < 120) requestAnimationFrame(openFit); // ~2s at 60fps, then give up
      };
      requestAnimationFrame(openFit);
    }
  } else if (stageEl && pagedDoc && (themeToggle || soundToggle)) {
    // Paged docs navigate by NATIVE scroll of the canvas surface (no pan/zoom transform),
    // so there's no zoom HUD - but the theme / sound toggles still dock in the same
    // bottom-right cluster every canvas tool carries.
    const hud = document.createElement('div');
    hud.className = 'stage-nav stage-nav--chrome';
    if (themeToggle) hud.append(themeToggle);
    if (soundToggle) hud.append(soundToggle);
    stageEl.appendChild(hud);
  } else if (hideSidebar && !visitorPage && !isFull) {
    // Full-bleed utility (is-bare): no zoom HUD, but the consolidated profile menu
    // (theme, sound/Neurospicy, Language, Settings) docks top-right in the reserved
    // chrome strip - the mirror of the back pill's top-left pin, reusing the main
    // views' .gallery-topright cluster (chrome layer, globally loaded). This replaces
    // the standalone theme toggle these tools used to host in their own toolbars.
    // Appended to the layout so the view's innerHTML swap tears it down; the menu
    // popover itself already closes on any navigation (NAV_EVENTS).
    const cluster = document.createElement('div');
    cluster.className = 'gallery-topright';
    cluster.appendChild(
      createProfileControl(tview.host as unknown as Parameters<typeof createProfileControl>[0])
    );
    layout.appendChild(cluster);
  }

  // ── Live collab: presence chrome (plan 100 section 4.6, section 5) ───────────────────────
  //
  // The ONE place a mounted tool becomes a collab, and the only place in this view
  // that knows presence exists. It is DEAD in this repo: nothing registers a session
  // source (lib/collab-session-source.ts), so `acquireCollabSession` returns null
  // having allocated nothing, the presence chunk is never fetched, no node is
  // created, no listener or timer is armed, and the mount stays byte-identical to
  // the single-player one it has always been.
  //
  // It sits HERE, and not beside the op plumbing it belongs to (search "Live collab
  // (plan 100 section 5)"), for two reasons that are both about the DOM: presence is chrome,
  // so it needs the stage, the render surface and the sidebar root, which the view's
  // innerHTML only creates further up; and the pill shares the stage's top-inline-end
  // lane with the zoom HUD, so it can only measure what it is clearing after
  // setupStageNav has built it.
  //
  // The composition itself lives in ./tool-collab.ts - see that file's header for why
  // it is a module rather than a hundred lines here (it is the half of this that can
  // actually be tested, and the half that must not ride the tool chunk).
  const collabHandle = acquireCollabSession(tview.tool.manifest.id, slot ?? null); tview.collabHandle = collabHandle;
  if (collabHandle) {
    // ONE transport per mount. The plumbing attached at mount time talks to whatever
    // `canvas-sync-provider` holds; the session attaches its OWN against this handle's
    // adapter (and wraps it for an observer's role, which the bare plumbing cannot
    // know about). Two attachments over one adapter would emit every local edit
    // twice, so the session's is the one that survives. `detach()` is idempotent, so
    // _cleanup calling it again later is free.
    collab?.detach();

    // The teardown holder is armed BEFORE the await, which is the whole reason this
    // shape is not a plain `const collab = await …`. A navigation during the import
    // (or during the token read behind it) runs _cleanup while nothing is mounted
    // yet: `aborted` latches, and the composition that arrives a moment later is torn
    // straight back down instead of taking over a view that is already gone - with
    // its presence heartbeat running, in a detached tree, forever.
    let mounted: ToolCollab | null = null;
    let aborted = false;
    tview.collabTeardown = () => {
      aborted = true;
      tview.collabReanchor = null;
      mounted?.teardown();
      mounted = null;
    };
    try {
      const { mountToolCollab } = await import('../tool-collab.ts');
      const built = await mountToolCollab({
        handle: collabHandle,
        runtime,
        toolManifest: tview.tool.manifest,
        host: tview.host,
        // Where a RECEIVED beam arrives (the same object as `host` unless this mount is an
        // acceptor's), and the export bar's `__export_*` markers, read at press time so a
        // beamed session reopens at the size, unit, DPI and profile it was sent at rather
        // than at tool defaults. `actionsApi` is built further down; both are closures, so
        // neither is read until the human presses send.
        libraryHost,
        exportSettings: () => { const { actionsApi } = tview; return actionsApi?.sessionState?.() ?? null; },
        // The stage hosts the pill and the overlay layer; the render surface is
        // passed to be MEASURED and never written to, which is what keeps an export
        // byte-identical whether or not anyone is watching (section 4.6, section 8).
        stage: stageEl,
        canvas: contentEl,
        sidebar: inputsEl,
      });
      if (aborted) built.teardown();
      else {
        mounted = built;
        tview.collabReanchor = () => built.reanchor();
      }
    } catch (e) {
      // A presence stack that fails to load costs the user their collab, never their
      // tool: the transport is closed and the mount carries on single-player.
      console.warn('[lolly:collab] presence failed to mount', e);
      tview.collabTeardown = null;
      try {
        collabHandle.close();
      } catch {
        /* the transport's failure is not the view's */
      }
    }
  }

  // Mobile (≤640px): the sidebar becomes a top-anchored controls panel with the
  // grip on its bottom edge; the preview fills below. Dragging the grip down grows
  // the controls (grip tracks the finger), releasing snaps to peek/half/full, and
  // the preview re-fits to whatever space the panel leaves.
  if (!hideSidebar && sheetGrip && sidebarEl) {
    // The preview is a static backdrop the sheet slides over, so half/full snaps
    // leave it untouched. But collapsing to peek (grip dragged to the top) vacates
    // most of the screen - re-fit there so the canvas grows into the freed space.
    // fitCanvas no-ops if the user has zoomed/panned, so this only fires at Fit.
    // Wait out the 0.34s height settle so it measures the final sheet position.
    setupMobileSheet(layout, sidebarEl, sheetGrip, {
      onChange: (snap) => {
        if (snap === 'peek') setTimeout(tview.stageLayout.fitCanvas, 360);
      },
    });
  }

  // Collapse the export/actions panel behind a "Render" button on BOTH mobile and
  // desktop: the wired #tool-actions node moves into the popup (its listeners
  // survive the move). Mobile presents it as a full-screen sheet; desktop as a
  // non-modal panel anchored to the sidebar bottom - pure CSS difference (app.css).
  tview.exportTeardown = null;
  // The image-framing overlay's unsubscribe (plans/148). Null unless the tool
  // declares a framing control; torn down with the view like the export chrome.
  tview.framingTeardown = null;
  // The "Save" half of the render pill - assigned just below, but declared out here
  // so the dirty-state helpers (markSessionDirty / markSessionSaved, defined later)
  // can flash and clear it from the input-change chokepoint.
  tview.renderSaveBtn = null;
  const renderPill = viewEl.querySelector<HTMLElement>('#render-pill'); tview.renderPill = renderPill;
  // The ambient URL-budget gauge (plan 115 P1) - a draggable vertical bar showing the
  // share-link cost of the current edit (reads the P0 cost model, never the address bar).
  // The instance is created after actionsApi (below) so a click can open the Share dialog;
  // the holder is declared here so syncUrl + _cleanup (both above that point) can see it.
  const urlGaugeEl = viewEl.querySelector<HTMLElement>('#url-budget-gauge'); tview.urlGaugeEl = urlGaugeEl as ToolViewCtx['urlGaugeEl'];
  tview.urlGauge = null;
  const renderFab = viewEl.querySelector<HTMLButtonElement>('#render-fab'); tview.renderFab = renderFab as ToolViewCtx['renderFab']; // the "Export" half (opens export)
  tview.renderSaveBtn = viewEl.querySelector<HTMLButtonElement>('#render-save'); // the "Save" half (outer-scoped)
  const exportOverlay = viewEl.querySelector<HTMLElement>('#export-overlay'); tview.exportOverlay = exportOverlay as ToolViewCtx['exportOverlay'];
  const exportBody = viewEl.querySelector<HTMLElement>('#export-popup-body'); tview.exportBody = exportBody;
  if (
    (!hideSidebar || bareExport) &&
    renderFab &&
    exportOverlay &&
    exportBody &&
    actionsEl &&
    renderPill
  ) {
    const mqMobile = window.matchMedia('(max-width: 640px)');
    const exportPopup = exportOverlay.querySelector<HTMLElement>('.export-popup')!;
    // The export panel is modal ONLY on mobile, where it's a full bottom sheet over a
    // scrim. On desktop it's a NON-modal panel anchored to the sidebar bottom - the
    // inputs above and the resize handle must stay live (users routinely open Export,
    // then go back to editing before downloading), so we neither inert the background
    // nor trap Tab there. The markup hard-codes aria-modal; we correct it per
    // breakpoint here. applyModality reconciles inert + aria-modal with both the open
    // state and the current breakpoint, so it's safe to re-run on resize too.
    const isModal = (): boolean => mqMobile.matches;
    const applyModality = (): void => {
      const modal = layout.classList.contains('export-open') && isModal();
      for (const child of layout.children) {
        if (child !== exportOverlay) (child as HTMLElement).inert = modal; // pointer + Tab blocked behind the sheet
      }
      exportPopup.setAttribute('aria-modal', modal ? 'true' : 'false');
    };
    const closeExport = (): void => {
      const { actionsApi } = tview;
      const wasOpen = layout.classList.contains('export-open');
      // If edge-docked, undock first so the popup returns to its overlay and the
      // export-open removal actually hides it (docked, it lives outside the overlay).
      if (isDocked('export')) releaseDock('export');
      layout.classList.remove('export-open');
      renderFab.setAttribute('aria-expanded', 'false');
      actionsApi?.stopAudioPreview?.(); // silence any audio audition when the popup closes
      // The pneumatic 'pushhh' as the door seals shut - here (not on the close controls)
      // so every dismissal path (✕, scrim, Escape, flick-down) sounds it exactly once, and
      // only when a panel was actually open (defensive/duplicate closes stay silent). The
      // matching 'shhhht' open rides the trigger's data-sfx, which every open path clicks.
      if (wasOpen) playSfx('hydraulicClose');
      // The mirror of 'lolly:export-open': anything showing a value the sheet also edits
      // has to re-read it on the way OUT too. The document name is the case that bit -
      // the sheet's Filename field and the design top bar's name field are two views of
      // one string, and a rename that was normalised or reverted as the sheet closed left
      // the bar showing the value the user no longer had.
      if (wasOpen) actionsEl.dispatchEvent(new CustomEvent('lolly:export-close'));
      applyModality(); // un-inert before returning focus to the trigger
      // Return focus to the trigger. In editor mode the render pill is hidden, so the
      // visible Export control is the real trigger: the design top bar's when it is
      // mounted (plan 179 M1 - it is the primary now), the rail icon otherwise.
      const focusTarget =
        (chromeless
          ? (viewEl.querySelector<HTMLElement>('[data-topbar="export"]') ??
            viewEl.querySelector<HTMLElement>('.fc-action-primary'))
          : null) ?? renderFab;
      focusTarget.focus();
    };
    // Subscribers to "the sheet just opened" - today only the float wiring below, which
    // uses it to put the sheet back in the right-hand column the user keeps it in.
    const exportOpenHooks = new Set<() => void>();
    const openExport = ({ focus = true }: { focus?: boolean } = {}): void => {
      layout.classList.add('export-open');
      renderFab.setAttribute('aria-expanded', 'true');
      applyModality();
      // Let the panel refresh anything derived from live state (the auto
      // filename placeholder follows the inputs and the provenance toggles).
      actionsEl.dispatchEvent(new CustomEvent('lolly:export-open'));
      // …and tell the float wiring, which is where the sheet decides whether it belongs
      // in the one right-hand column. A plain event will not do: the actions panel is a
      // DESCENDANT of the popup, so an event fired on it never reaches a listener on the
      // popup, and the sheet has to be placed before focus moves into it.
      for (const cb of [...exportOpenHooks]) {
        try {
          cb();
        } catch (e) {
          console.error(e);
        }
      }
      // Move focus into the dialog (its close button) for keyboard/SR users - but
      // not when auto-opened from ?options on load, where grabbing focus is jarring.
      if (focus) exportOverlay.querySelector<HTMLElement>('.export-popup-close')?.focus();
    };
    // Actions live in the Render popup on every breakpoint. The Get|Save pill
    // lives INSIDE the sidebar on desktop (a centred footer) but must sit OUTSIDE
    // it on mobile, where it's a viewport FAB the sheet's overflow would clip.
    const placeActions = (): void => {
      if (actionsEl.parentElement !== exportBody) exportBody.appendChild(actionsEl);
      // A full-bleed tool can host the pill INSIDE its own toolbar via
      // [data-shell-slot="export"] (desktop). Otherwise: no sidebar in chromeless
      // modes → the pill floats over the stage (like mobile); else it docks under
      // the sidebar. The slot only exists once the template has painted, so this is
      // re-run from paint() via placeRenderPill below.
      const exportSlot = !mqMobile.matches
        ? contentEl.querySelector<HTMLElement>('[data-shell-slot="export"]')
        : null;
      const fabDest =
        exportSlot ?? (mqMobile.matches || chromeless || !sidebarEl ? layout : sidebarEl);
      if (renderPill.parentElement !== fabDest) fabDest.appendChild(renderPill);
    };
    tview.placeRenderPill = placeActions;
    renderFab.setAttribute('aria-haspopup', 'dialog');
    renderFab.setAttribute('aria-expanded', 'false');
    renderFab.addEventListener('click', () => openExport());
    exportOverlay
      .querySelectorAll('[data-export-close]')
      .forEach((el) => { el.addEventListener('click', closeExport); });
    // Escape closes the export popup; Tab is wrapped so focus stays within the
    // sheet (a belt-and-braces companion to the inert background above - inert
    // alone can let Tab graze the browser chrome between the last and first stop).
    const onExportKey = (e: KeyboardEvent): void => {
      if (!layout.classList.contains('export-open')) return;
      if (e.key === 'Escape') {
        closeExport();
        return;
      }
      if (e.key !== 'Tab' || !isModal()) return; // only trap Tab in the modal (mobile) sheet
      const focusables = [
        ...exportOverlay.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0]!,
        last = focusables[focusables.length - 1]!;
      // Only wrap when focus is already at an edge of the popup - if it's elsewhere
      // (e.g. an auto-opened panel the user hasn't tabbed into yet) leave Tab alone.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onExportKey);

    // Flick-down to dismiss the export popup - the same instinct as swiping a
    // bottom sheet away. The popup follows the finger; release past a threshold
    // (or a fast flick) closes it, otherwise it springs back. Drags from the
    // (scrollable) body only engage at the top, so the list still scrolls.
    let py = 0,
      pt = 0,
      pdrag = false;
    const popupStart = (e: TouchEvent): void => {
      pdrag = mqMobile.matches && e.touches.length === 1;
      // Never engage the flick-to-dismiss when the touch ends up on a scrubbable
      // control - the export-size fields own the full horizontal drag of their
      // value, so a diagonal scrub must not also drag the sheet down.
      if (pdrag && (e.target as HTMLElement).closest?.('[data-scrub]')) pdrag = false;
      if (pdrag && exportBody.contains(e.target as Node) && exportBody.scrollTop > 0) pdrag = false;
      if (!pdrag) return;
      py = e.touches[0]!.clientY;
      pt = e.timeStamp;
    };
    const popupMove = (e: TouchEvent): void => {
      if (!pdrag) return;
      const dy = e.touches[0]!.clientY - py;
      if (dy <= 0) {
        exportPopup.style.transform = '';
        return;
      } // upward → ignore
      e.preventDefault(); // claim the gesture from scroll
      exportPopup.classList.add('is-popup-dragging');
      exportPopup.style.transform = `translateY(${dy}px)`;
    };
    const popupEnd = (e: TouchEvent): void => {
      if (!pdrag) return;
      pdrag = false;
      const dy = (e.changedTouches[0]?.clientY ?? py) - py;
      exportPopup.classList.remove('is-popup-dragging');
      exportPopup.style.transform = ''; // hand back to the CSS transition
      if (dy > 0 && flickDirection(dy, e.timeStamp - pt) === 1) closeExport();
    };
    exportPopup.addEventListener('touchstart', popupStart, { passive: true });
    exportPopup.addEventListener('touchmove', popupMove, { passive: false });
    exportPopup.addEventListener('touchend', popupEnd, { passive: true });
    exportPopup.addEventListener('touchcancel', popupEnd, { passive: true });

    // Free-floating desktop behaviour: drag the head to move, grips to resize,
    // maximise to full height, dock to snap back - persisted per device. A "free"
    // layout (canvas/chromeless, no sidebar to dock under) opens floated. Mobile
    // keeps its bottom-sheet + flick-dismiss; the module no-ops under 641px.
    const exportHead = exportPopup.querySelector<HTMLElement>('.export-popup-head');
    const floatTeardown = exportHead
      ? wireExportPanelFloat({
          overlay: exportOverlay,
          popup: exportPopup,
          head: exportHead,
          isMobile: () => mqMobile.matches,
          freeLayout: chromeless || !sidebarEl,
          editorLayout,
          // Ordinary canvas tools open the export sheet in the one right column too, so the
          // right side matches the Design editor (Andy, 2026-09-07). editorLayout already
          // does this for Design, so only the non-editor canvas tools need the extra nudge.
          preferEdge: canvasStage && !editorLayout,
          onOpen: (cb) => {
            exportOpenHooks.add(cb);
            return () => {
              exportOpenHooks.delete(cb);
            };
          },
        })
      : null;

    placeActions();
    // ?options share-links land with the export panel already open (no focus grab).
    if (showExportPanel) openExport({ focus: false });
    const onBreakpoint = (): void => {
      placeActions();
      applyModality();
    };
    mqMobile.addEventListener('change', onBreakpoint);
    tview.exportTeardown = () => {
      mqMobile.removeEventListener('change', onBreakpoint);
      document.removeEventListener('keydown', onExportKey);
      floatTeardown?.();
    };
  }

  // Cleanup: remove injected <style>, disconnect observer, tear down canvas nav + export.
  viewEl._cleanup = () => {
    const { actionsApi } = tview;
    // Abort late continuations and release scope-owned resources before dismantling
    // the DOM they are allowed to address. The scope is idempotent and failure-isolated.
    mountLifecycle.dispose();
    window.removeEventListener('lolly:design-system-changed', tview.designSystem.onDesignSystemChanged);
    // Release the live camera FIRST and guarded: it's the one teardown step whose failure
    // leaves hardware running, and a throw anywhere in this teardown used to abort the whole
    // navigation (the scanner trap - see the router guard in main.ts). Idempotent, so the
    // ordered call below re-runs harmlessly.
    try {
      runtime.stopLive?.();
    } catch (e) {
      console.error('[tool] stopLive on teardown:', e);
    }
    tview.urlGauge?.dispose(); // cancel any pending pack-refine timer so it can't fire post-teardown
    // FIRST, because everything below destroys the thing it reads. Starting a collab
    // remounts this tool through a route that cannot carry an uploaded asset, a picked
    // file, a long paragraph or the slot - so when (and only when) that remount is the
    // reason we are being torn down, the live model crosses in memory instead. The
    // predicate is three comparisons and no allocation, which is the whole cost every
    // ordinary teardown pays for this.
    if (willRemountForCollab(toolId)) {
      const live: Record<string, unknown> = {};
      // `undefined` is skipped rather than carried: the carry is applied ON TOP of the
      // route, so a value the model does not hold would otherwise blank one the route
      // (or the resumed slot) did.
      for (const item of runtime.getModel())
        if (item.value !== undefined) live[item.id] = item.value;
      carryMountState(toolId, slot ?? null, live);
    }
    // Latch first: the template chooser is un-awaited and outlives nothing else here,
    // so this is the ONLY thing that stops it landing on a torn-down runtime. Closing
    // takes the modal itself down with the view (it was never inside viewEl's subtree -
    // it's appended to document.body - so nothing below would otherwise touch it) and
    // resolves its promise blank; the latch then short-circuits the pick handler even
    // if a fetch already in flight resolves with a real (now-irrelevant) selection.
    tview.templatePickTornDown = true;
    tview.templatePickClose?.();
    tview.templatePickClose = null;
    runtime.stopLive?.(); // release the camera if a live session is running
    (tview.host.media as unknown as { armAnimSource?: (m: string | null) => void }).armAnimSource?.(null); // drop any armed anim source
    stopFrameFps(); // stop the dev fps meter if it was running
    runtime.stopMeter?.();
    runtime.cancelRecording?.(); // release the mic / abort any take
    runtime.destroy?.(); // release per-mount executor resources (a Worker-isolated tool's run)
    (stageEl as (HTMLElement & { _recordCleanup?: () => void }) | null)?._recordCleanup?.(); // viewfinder + timers
    (stageEl as (HTMLElement & { _animCleanup?: () => void }) | null)?._animCleanup?.(); // animation transport bar + its rAF poll
    actionsApi?.stopAudioPreview?.(); // a detached <audio> keeps playing - stop it on navigation
    stopSlotPreview(); // and the sidebar slot's own sound preview (also a detached <audio>)
    actionsApi?.dispose?.(); // unsubscribe the cost-authoring registry listener + tear down its extension
    tview.lottieModule?.destroyLottiePlayers(); // else animationManager ticks detached trees
    tview.videoModule?.destroyVideoPlayers(); // drop remembered <video> positions
    tview.vizModule?.destroyToolViz(); // else a WebGL2 context stays pinned per visited tool
    if (tview.onFocusRect && stageEl) stageEl.removeEventListener('fc-focus-rect', tview.onFocusRect);
    styleEl.remove();
    shutter.destroy();
    ro.disconnect();
    tview.stageZoom?.destroy();
    tview.exportTeardown?.();
    tview.framingTeardown?.();
    tview.framingTeardown = null; // framing overlay: listeners + its layer
    tview.filmstrip?.destroy();
    window.removeEventListener('keydown', tview.history.onHistoryKey);
    // Presence chrome first, transport last: the pill/rings/cursors come down, then
    // the session says goodbye and closes the channel (see the block's own note).
    // Null unless a collab was live, and idempotent when it was.
    tview.collabTeardown?.();
    tview.collabTeardown = null;
    collab?.detach(); // restore the un-wrapped setInput; drop any queued remote ops
    // The team-session id belongs to THIS mount and dies with it: the Share dialog can be
    // opened again from the Projects view over a LOCAL session of the same tool, and an
    // origin that outlived its mount would key a room on the wrong session. A remount
    // (the collab adoption path) re-earns it or does without - it is never resurrected.
    releaseTeamSessionOrigin();
    clearTimeout(tview.historyToastTimer);
    tview.historyToastEl?.remove();
    if (tview.rafId) {
      cancelAnimationFrame(tview.rafId);
      tview.rafId = 0;
    }
    // Everything renderInputs parked outside the sidebar's subtree - the document-
    // level capture dismissers + body-mounted flatpickr calendars - in one call, so
    // a detached sidebar tree isn't pinned alive across tool navigation.
    inputsEl?._inputsDispose?.();
    // The export popup (actionsEl) wires its own help tip for the C2PA card
    // (renderActions, not renderInputs - outside the disposer's remit).
    if (actionsEl?._helpTipDismiss)
      document.removeEventListener('click', actionsEl._helpTipDismiss, true);
    tview.openGuide?.close();
    tview.openGuide = null;
  };

  // Temporarily remove the CSS scale so dom-to-image sees native dimensions.
  // Also strips data-canvas-input attrs so they don't appear in exported files,
  // restoring them after so click-to-focus keeps working post-export.
  // Serialized behind exportChain: overlapping exports (e.g. a Download click while
  // the fire-and-forget history thumbnail captures) would otherwise both read
  // prevTransform and the later one restore a stale '', leaving the canvas unscaled.
  tview.exportChain = Promise.resolve();
}

export function wireCanvasEditor(tview: ToolViewCtx): void {
  const { INLINE_EDIT_CONTROLS, canvasEl, hideSidebar, inputsEl, layout, runtime } = tview;
  // Click-to-focus: clicking a rendered canvas element that represents an input
  // focuses the corresponding sidebar control. Tools can suppress this per-element
  // with pointer-events:none. The handler is added once; annotations are re-applied
  // via resolveCanvasAnnotations() after each innerHTML update.
  if (canvasEl)
    canvasEl.addEventListener('click', (e) => {
      if (hideSidebar || !inputsEl) return;
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-canvas-input]');
      if (!target) return;
      const id = target.dataset.canvasInput!;

      // A FRAMED image belongs to the framing overlay (plans/148): a tap there arms
      // pan/zoom/tilt. It usually also carries data-canvas-input for its asset slot
      // (annotateTemplate tags the tag's first referenced input, which is the src),
      // and that would open the asset picker on top of the arm - two editors from
      // one tap. The overlay wins on its own element; the sidebar row is still one
      // more tap away, and the picker stays reachable from there.
      if ((e.target as HTMLElement).closest('[data-framing]')) return;

      // A plain top-level input (never a "<blocksId>:<index>" block reference -
      // that never matches a top-level model item's id) whose control has an
      // in-place editor opens it right here instead of falling through to the
      // sidebar-focus path below.
      const inlineInput = runtime.getModel().find((i) => i.id === id);
      if (inlineInput && INLINE_EDIT_CONTROLS.has(inlineInput.control)) {
        tview.popovers.openInlineInputEditor(target, inlineInput);
        return;
      }

      // Most ids map straight to a sidebar row. A "<blocksInputId>:<index>" id
      // (emitted per rendered block, e.g. data-canvas-input="blocks:0") points at
      // one block inside a blocks input - focus that block and fold the rest.
      let control = inputsEl.querySelector<HTMLElement>(`[data-input-id="${id}"]`);
      let blockIndex: string | null = null;
      const blockRef = !control && id.match(/^(.+):(\d+)$/);
      if (blockRef) {
        const blocksEl = inputsEl.querySelector<HTMLElement>(
          `.blocks-input[data-input-id="${blockRef[1]}"]`
        );
        if (blocksEl) {
          control = blocksEl;
          blockIndex = blockRef[2]!;
        }
      }
      if (!control) return;

      const focus = () => {
        // Reveal the control if it lives inside a collapsed section (mirrors the
        // scrollToInput path), so the focused input is actually visible.
        control!.closest('details.input-section')?.setAttribute('open', '');
        if (blockIndex != null) {
          focusSidebarBlock(control!, blockIndex);
        } else {
          control!.focus(); // lights the CSS :focus-within spotlight
          scrollToControl(control!); // header-aware, reduce-motion-safe, with arrival pulse
        }
      };
      if (layout.dataset.sidebar === 'closed') {
        tview.stageLayout.setSidebarWidth(tview.stageLayout.getRestoreWidth());
        requestAnimationFrame(focus);
      } else {
        focus();
      }
    });

  // Deferred-preview tools (manifest.render.preview): the live canvas is only a
  // placeholder until an explicit, expensive render runs - e.g. url-shot, which
  // screenshots a real page in beforeExport. The template supplies a [data-preview]
  // control; here we drive it (busy/error state) and run the render into the frame.
  // Wired by delegation on the canvas so it survives the innerHTML rebuild that the
  // runtime subscriber does on every input change.
  const previewCfg = tview.tool.manifest.render.preview as
    | { auto?: boolean; format?: string }
    | undefined; tview.previewCfg = previewCfg;
}

export function stageLayoutOps(tview: ToolViewCtx) {
  return {
    setSidebarWidth: bindOp(tview, setSidebarWidth),
    currentQuery: bindOp(tview, currentQuery),
    getRestoreWidth: bindOp(tview, getRestoreWidth),
    updateFullParam: bindOp(tview, updateFullParam),
    fitCanvas: bindOp(tview, fitCanvas),
    resetView: bindOp(tview, resetView),
    fitPagedDoc: bindOp(tview, fitPagedDoc),
    pageGeom: bindOp(tview, pageGeom),
    fitPages: bindOp(tview, fitPages),
    syncStrip: bindOp(tview, syncStrip),
    refitStage: bindOp(tview, refitStage),
    wireSidebar: bindOp(tview, wireSidebar),
    wireFilmstrip: bindOp(tview, wireFilmstrip),
    wireStageZoom: bindOp(tview, wireStageZoom),
    wireCanvas: bindOp(tview, wireCanvas),
    wireCanvasEditor: bindOp(tview, wireCanvasEditor),
  };
}
