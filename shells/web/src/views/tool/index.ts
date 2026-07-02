// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view — mounts one tool.
 *
 * Lifecycle:
 *   1. loadTool() fetches manifest + template + hooks from the catalog
 *   2. createRuntime() spins up the engine with the host bridge
 *   3. We render input controls from runtime.getModel() and the template
 *      output from runtime.getHydrated()
 *   4. Input changes → runtime.setInput() → subscribed callback re-renders
 *   5. Action buttons call runtime.export() / host.clipboard / host.state
 */

import type { InputValue, InputModelItem, InputSpec, DroppedAsset, LoadedTool } from '@lolly/engine';
import { loadTool, createRuntime, parseUrlState, annotateTemplate, DEFAULT_CMYK_CONDITION, expandQuery } from '@lolly/engine';
import { escape } from '../../utils.ts';
import { navigateTo } from '../../nav.ts';
import { toolSupport } from '../../capabilities.ts';
import {
  isCmykFmt, isPrintFmt, marksFromCsv, extFor, ICON_UNDO, ICON_REDO,
} from './constants.ts';
import { createInputHistory } from './input-history.ts';
import { createInputPanel } from './input-panel.ts';
import { openEmbedEditor } from './embed-editor.ts';
import { makeFetchFile, mount404, mountUnavailable, mountInstallPrompt, resolveToolModuleUrl } from './routing.ts';
import { showClearDialog, showUnsavedDialog, createHistoryToast } from './dialogs.ts';
import { setupStageNav, setupMobileSheet, flickDirection, isTextEditing } from './stage.ts';
import type { StageNav } from './stage.ts';
import { setupCanvasFileDrop, setupCanvasBlocksDrop } from './drop.ts';
import type { DropToAddInput } from './drop.ts';
import { createUrlSync, shrinkUrl } from './url-sync.ts';
import { scrollToControl, focusSidebarBlock } from './canvas.ts';
import { renderActions, armAutoCopy, wireUpCopyUrl } from './export-actions.ts';
import type { ExportDefaults } from './export-actions.ts';
import { announce } from '../../a11y.ts';
import { PALETTE } from '../../palette.ts';
import { setSwatches } from '../../components/color-field.ts';
import { createThemeToggle } from '../../components/theme-toggle.ts';
import { exportSizeDriver } from '../export-size.ts';
import { neutralizeEmbeds, hydrateEmbeds } from '../../bridge/embed.ts';
import { scopeCss, runTemplateScripts, resolveCanvasAnnotations, waitForQuiescence } from '../../render/lifecycle.ts';
import type { WebHost } from '../../bridge/index.ts';
import type { ExportOptions } from '../../bridge/export/types.ts';
import 'flatpickr/dist/flatpickr.min.css';



/** The view root; the router reads back a `_cleanup` teardown hook off it. */
export type ToolViewElement = HTMLElement & { _cleanup?: () => void };

/** A loadTool failure may carry schema-validation details (see engine loader). */
const validationErrorsOf = (e: unknown): { path: string; message: string }[] => {
  if (e && typeof e === 'object' && 'validationErrors' in e && Array.isArray(e.validationErrors)) {
    return e.validationErrors.filter((ve): ve is { path: string; message: string } =>
      !!ve && typeof ve === 'object' && 'message' in ve);
  }
  return [];
};
const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const asString = (v: InputValue | undefined): string | undefined =>
  typeof v === 'string' && v !== '' ? v : undefined;

export async function mountTool(viewEl: ToolViewElement, host: WebHost, toolId: string, urlParams: string | null | undefined): Promise<void> {
  // If the catalog is loaded, do a fast existence check before fetching anything.
  // (main.js parks the index on window; same widened-view pattern as catalog/sync.ts.)
  const w: Window & { __toolIndex?: { tools?: { id: string }[] } } = window;
  const catalog = w.__toolIndex;
  if (catalog?.tools && !catalog.tools.some(t => t.id === toolId)) {
    mount404(viewEl, toolId);
    return;
  }

  const fetchFile = makeFetchFile(toolId);

  // Defer the loading screen so prefetched tools don't flash the gallery out.
  // The gallery stays visible until the tool is ready (or 400ms passes).
  const loadingTimer = setTimeout(() => {
    viewEl.innerHTML = `<p class="loading">Loading…</p>`;
  }, 400);

  let tool: LoadedTool;
  try {
    tool = await loadTool(toolId, fetchFile, { resolveModuleUrl: resolveToolModuleUrl });
    clearTimeout(loadingTimer);
  } catch (e) {
    clearTimeout(loadingTimer);
    if (errorMessage(e) === 'tool-not-found') {
      mount404(viewEl, toolId);
      return;
    }
    const validationErrors = validationErrorsOf(e);
    const errs = validationErrors.length
      ? `<ul class="error-list">${validationErrors.map(ve =>
          `<li><code>${escape(ve.path)}</code> — ${escape(ve.message)}</li>`
        ).join('')}</ul>`
      : '';
    viewEl.innerHTML = `<div class="error"><strong>${escape(errorMessage(e))}</strong>${errs}</div>`;
    return;
  }

  // Guard direct links: if the tool needs a capability this shell can't fulfil,
  // show the right panel instead of mounting it into a broken state — on a
  // Chromium browser a capture tool offers the extension ('install'); otherwise
  // "desktop only" ('unavailable').
  const sup = toolSupport(tool.manifest, host.capabilities);
  if (sup.status === 'install') { mountInstallPrompt(viewEl, tool.manifest); return; }
  if (sup.status === 'unavailable') { mountUnavailable(viewEl, tool.manifest, sup.unmet); return; }

  // Source the colour picker's swatches from design tokens (the canonical brand
  // colours), so choosing one keeps the value linked to the token. Falls back to
  // the built-in palette if tokens aren't available (offline first load, or a
  // shell without host.tokens). Best-effort — never blocks mounting the tool.
  try {
    const swatches = await host.tokens?.colors?.();
    if (swatches?.length) {
      // Token colours without a resolved value can't be shown as a swatch.
      setSwatches(swatches.flatMap(s => (s.value ? [{ value: s.value, label: s.name, group: s.group, ref: s.ref }] : [])));
    }
  } catch { /* keep the built-in palette */ }

  // Annotate the template once so rendered nodes carry data-canvas-input attrs
  // for click-to-focus. This is purely a shell-side concern; the engine just
  // stores the modified source and hydrates it like any other template.
  const inputIds = (tool.manifest.inputs ?? []).map(i => i.id);
  tool.template = annotateTemplate(tool.template, inputIds);
  document.title = `${tool.manifest.name} — Lolly`;

  // A packed link (`?z=…`) carries the whole state compressed; expand it back into a
  // plain query BEFORE anything reads it (parse, flag detection, dirty-param seed).
  // A no-op for ordinary readable links. Done once so every consumer below agrees.
  urlParams = await expandQuery(urlParams ?? '');

  const { values, format: urlFormat, export: autoExport, copy: autoCopy, slot, filename: urlFilename, width: urlWidth, height: urlHeight, unit: urlUnit, dpi: urlDpi, profile: urlProfile, password: urlPassword, bleed: urlBleed, marks: urlMarks } = parseUrlState(urlParams, tool.manifest);
  const urlFlags = new URLSearchParams(urlParams || '');
  const isFull = urlFlags.has('full');
  // `?nostage` pre-checks the export panel's "Full page" toggle (HTML export only):
  // the saved page drops the fixed-size canvas frame and fills the whole window.
  const urlNostage = urlFlags.has('nostage');
  // `?options` lands the recipient on the export-settings panel expanded (instead
  // of the collapsed Render button). `full` collapses ALL chrome to the bare
  // preview — the opposite intent — so it wins when both are present, matching the
  // CSS, which hides the export panel whenever its host sidebar is collapsed.
  const showExportPanel = !isFull && urlFlags.has('options');

  let initialValues: Record<string, InputValue> = values;
  if (slot) {
    const saved = await host.state.load(slot);
    if (saved) {
      // Drop the (typed-optional) undefined slots so the merged record stays total.
      const savedValues = Object.fromEntries(Object.entries(saved).filter(
        (e): e is [string, InputValue] => e[1] !== undefined));
      initialValues = { ...savedValues, ...values };
    }
  }

  // "+ New tool" from the Projects view leaves a sessionStorage marker so the first
  // FRESH session saved here files into the folder it launched from. Read it ONLY on a
  // fresh open (no resume `slot`) — otherwise a diverted "open the gallery, resume an
  // unrelated old session, save it" flow would capture it and misfile that session.
  // We READ (not remove) the marker: a hash navigation can mount the tool twice (a
  // browser fires popstate AND hashchange, which the router debounce can't fully
  // collapse), and a consume-on-mount would let the first mount swallow the marker
  // while the SECOND mount owns the live Save button. The marker is cleared instead
  // when the user lands on any non-tool view (main.js navigate). Used in performSave.
  let fileIntoFolder: string | null = null;
  if (!slot) {
    try {
      const into = sessionStorage.getItem('lolly:fileInto');
      if (into !== null) fileIntoFolder = into || null;
    } catch { /* sessionStorage unavailable (private mode) */ }
  }

  // Where the tool returns to when it leaves. The Projects view arms a marker (the
  // folder it launched from, e.g. `/#/p/<folderId>`) so a tool opened or resumed from a
  // folder saves and lands BACK in that folder; opening straight from the gallery leaves
  // no marker, so we fall back to '/' (the gallery). Read (not removed) here for the same
  // double-mount reason as fileIntoFolder above; cleared on the next non-tool mount.
  let returnTo = '/';
  try {
    const back = sessionStorage.getItem('lolly:returnTo');
    if (back) returnTo = back;
  } catch { /* sessionStorage unavailable (private mode) */ }

  // The back link follows that same marker: a tool launched from a folder reads "Back"
  // and returns to the folder; from the gallery it reads "Tools" and returns there. This
  // keeps the editing session a round-trip — add/resume a tool in a folder, then step
  // straight back into it — instead of dumping the user in the gallery.
  const fromFolder = returnTo !== '/';
  const backHref = fromFolder ? returnTo : '/';
  const backLabel = fromFolder ? 'Back' : 'Tools';

  // Populate inputs from user profile if they match profile field names
  const profile = await host.profile.get();
  const profileFields = new Map(Object.entries(profile));
  const profileInputIds = (tool.manifest.inputs ?? []).map(i => i.id);
  for (const inputId of profileInputIds) {
    const pv = profileFields.get(inputId);
    if (pv !== undefined && !(inputId in initialValues)) {
      initialValues[inputId] = pv;
    }
  }

  const runtime = await createRuntime(tool, host, initialValues);

  // ── Undo / redo (Cmd+Z / Cmd+Shift+Z / Cmd+Y) ──────────────────────────────
  // Lets an accidental slider nudge — or any control edit — be reverted. Every
  // control routes its edits through this history controller (history.set / the
  // sidebar-panel functions below), which owns the record/coalesce/limit policy
  // and leaves runtime.setInput unpatched (finding 7). A slider drag fires 'input'
  // on every pixel, so rapid same-input changes coalesce (by id + time) into a
  // single step — one gesture, one undo. Restoring just replays setInput, so the
  // existing subscriber refreshes the sidebar + canvas for free and the onInput
  // hook re-derives any computed inputs (we never store those).
  let historyControls: { sync(canUndo: boolean, canRedo: boolean): void } | null = null;   // header ↶/↷ buttons (set once the header mounts)
  // NB: named inputHistory, not `history`, so it doesn't shadow the global
  // window.history that syncUrl / updateFullParam call for the address bar.
  const inputHistory = createInputHistory(runtime);   // limit 100 / coalesce 500ms defaults
  const refreshHistoryUI = () => historyControls?.sync(inputHistory.canUndo, inputHistory.canRedo);
  const historyToast = createHistoryToast({ onUndo: () => undoHistory(), onRedo: () => redoHistory() });
  // undo()/redo() and every recorded edit fire onChange. A recorded edit has no
  // toast to follow, so dismiss any now-stale undo/redo toast there; an undo/redo
  // shows its toast immediately after, so suppress the dismiss around those (this
  // also preserves the no-flicker content-swap on rapid undo/redo).
  let inUndoRedo = false;
  inputHistory.onChange(() => {
    refreshHistoryUI();
    if (!inUndoRedo) historyToast.dismiss();
  });
  const undoHistory = () => {
    inUndoRedo = true;
    const step = inputHistory.undo();
    inUndoRedo = false;
    if (!step) { historyToast.show({ empty: 'undo' }); return; }
    historyToast.show({ kind: 'undo', label: step.label });
  };
  const redoHistory = () => {
    inUndoRedo = true;
    const step = inputHistory.redo();
    inUndoRedo = false;
    if (!step) { historyToast.show({ empty: 'redo' }); return; }
    historyToast.show({ kind: 'redo', label: step.label });
  };


  const onHistoryKey = (e: KeyboardEvent): void => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const redo = k === 'y' || (k === 'z' && e.shiftKey);
    const undo = k === 'z' && !e.shiftKey;
    if (!undo && !redo) return;
    // Free-text fields keep their own per-character undo; sliders, selects,
    // colours and checkboxes have no useful native undo, so we own those.
    if (isTextEditing()) return;
    e.preventDefault();
    if (redo) redoHistory(); else undoHistory();
  };
  window.addEventListener('keydown', onHistoryKey);

  const nativeW     = tool.manifest.render.width;
  const nativeH     = tool.manifest.render.height;
  const hasInputs   = (tool.manifest.inputs?.length ?? 0) > 0;
  const noExport    = tool.manifest.render.export === false;
  // Whether this tool persists a saved session — drives the Save half of the
  // render pill. Mirrors renderActions: the default action set includes 'save',
  // and an explicit empty actions list (opted-out file utilities) excludes it.
  const canSaveSession = (tool.manifest.render.actions ?? ['copy', 'download', 'save']).includes('save');
  const canvasLayout = tool.manifest.render.layout === 'canvas';
  // The WYSIWYG "editor" layout: a chromeless full-canvas surface (no input
  // sidebar) that KEEPS the fixed render canvas + the full render/export
  // scaffolding, so it exports like a normal tool. The direct-manipulation overlay
  // (select / drag / resize / rotate / z-order / align) is mounted below.
  const editorLayout = tool.manifest.render.layout === 'editor';
  // The blocks input the editor manipulates directly (carries the `canvas` flag).
  const canvasEditInput = editorLayout
    ? tool.manifest.inputs?.find(i => i.type === 'blocks' && i.canvas)
    : undefined;
  // Hide the sidebar for pure-canvas utilities: either no inputs at all, or an
  // explicit canvas layout — where the tool's single file input becomes a
  // drag-and-drop / click-to-pick zone on the canvas itself (setupCanvasFileDrop).
  // NOTE: editorLayout is deliberately NOT hideSidebar — it needs the live canvas
  // node + export UI. It only removes the input aside (via showAside below).
  const hideSidebar = (noExport && !hasInputs) || canvasLayout;
  // Whether the input aside is present. Editor mode drops it but is not hideSidebar.
  const showAside = !hideSidebar && !editorLayout;
  const noAside   = !showAside;   // no visible input aside (hidden-canvas OR editor)
  // The one declared file input a canvas-layout tool presents as that drop zone.
  const canvasFileInput = canvasLayout ? tool.manifest.inputs?.find(i => i.type === 'file') : null;
  // A sidebar tool with a `dropToAdd` blocks input (e.g. logo-wall) also turns its
  // canvas into a drop zone, so a pile of images can be dropped straight onto the
  // (usually empty) preview — not only onto the sidebar list. Canvas-layout file
  // utilities use canvasFileInput above instead, so they're excluded here.
  const canvasDropInput = !canvasFileInput
    ? tool.manifest.inputs?.find((i): i is InputSpec & DropToAddInput => i.type === 'blocks' && !!i.dropToAdd?.field
        && (i.fields ?? []).some(f => f.id === i.dropToAdd?.field && f.type === 'asset'))
    : undefined;

  // On-device utilities (privacy:'on-device') carry an honest, prominent badge —
  // the user's content is processed locally and never uploaded. It's the single
  // most reassuring thing on screen for someone used to handing files to strangers.
  const onDevice = tool.manifest.privacy === 'on-device';
  const privacyBadge = onDevice
    ? `<div class="on-device-badge" title="This tool runs entirely in your browser. Your file is never uploaded.">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Runs on your device — nothing is uploaded</span>
      </div>`
    : '';

  // The canvas is the visual OUTPUT (the editable interface is the sidebar), so
  // it's exposed to screen readers as a single role="img" with a text summary.
  // Authors can declare a live Handlebars summary (manifest.a11yLabel); otherwise
  // it's "<name> preview". Kept current in the render subscriber below.
  const canvasLabel = () => {
    if (!tool.manifest.a11yLabel) return `${tool.manifest.name} preview`;
    // Handlebars HTML-escapes {{values}}; an aria-label is plain text, so decode
    // the entities back (it's set via setAttribute, not innerHTML).
    const custom = runtime.getHydratedString(tool.manifest.a11yLabel)
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#(?:39|x27);/g, "'").trim();
    return custom || `${tool.manifest.name} preview`;
  };

  const SIDEBAR_DEFAULT = 272;
  const SIDEBAR_MIN     = 40;
  const savedWidth  = Number(localStorage.getItem('sidebarWidth') ?? SIDEBAR_DEFAULT);
  // The desktop export panel anchors to the sidebar's bottom edge, so ?options
  // needs the sidebar open even if this device last left it collapsed (width 0).
  const sidebarOpen = (isFull || hideSidebar || editorLayout) ? false : (showExportPanel || savedWidth > 0);
  const openWidth   = savedWidth > 0 ? savedWidth : SIDEBAR_DEFAULT;

  // A saved design (or a shared URL) can reference an image the user has since
  // deleted from their device library. The runtime resolves those to null and
  // reports them here; tell the user the field was left blank rather than leaving
  // a silent gap.
  const dropped: DroppedAsset[] = runtime.droppedAssets ?? [];
  const droppedLabels = dropped.map(d => d.label).join(', ');
  const droppedNotice = dropped.length ? `
    <div class="tool-notice" role="status" id="dropped-assets-notice">
      <span class="tool-notice-text">An image used in this saved design is no longer available, so the <strong>${escape(droppedLabels)}</strong> ${dropped.length > 1 ? 'fields were' : 'field was'} left blank.</span>
      <button type="button" class="tool-notice-close" id="dropped-assets-dismiss" aria-label="Dismiss this message">✕</button>
    </div>` : '';

  viewEl.innerHTML = `
    ${noAside ? `<a href="${escape(backHref)}" class="tools-home home-full">${backLabel}</a>` : ''}
    <div class="tool-layout${editorLayout ? ' is-editor' : ''}" id="tool-layout" data-sidebar="${noAside ? 'hidden' : (sidebarOpen ? 'open' : 'closed')}">
      ${showAside ? `
        <aside class="sidebar" id="tool-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-back-row">
              <a href="${escape(backHref)}" class="tools-home sidebar-back">${backLabel}</a>
            </div>
            <div class="sidebar-header-row">
              <span class="sidebar-title">${escape(tool.manifest.name)}</span>
              <button class="fullscreen-toggle" id="fullscreen-toggle" ${sidebarOpen ? 'open' : ''} aria-label="${sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}"></button>
            </div>
          </div>
          <div class="sidebar-body">
            ${privacyBadge}
            ${droppedNotice}
            <div id="tool-inputs" class="tool-inputs"></div>
            ${hasInputs ? `
              <div class="sidebar-utils" id="sidebar-utils">
                <button type="button" id="clear-inputs-btn" class="clear-inputs-btn" title="Reset all inputs to defaults">Clear changes</button>
              </div>
            ` : ''}
            <div class="tool-actions" id="tool-actions"></div>
          </div>
          <div class="sidebar-drag-handle" id="sidebar-drag-handle"></div>
        </aside>
        <!-- Grip lives OUTSIDE the sheet (it's position:fixed): keeps it from being
             clipped by the sheet's overflow, which must stay hidden so the form
             can't spill past the sheet's rounded edge. -->
        <button type="button" class="sheet-grip" id="sheet-grip" aria-label="Drag to resize controls, tap to expand"></button>
      ` : (editorLayout ? `<div class="tool-actions" id="tool-actions"></div>` : '')}
      <div class="tool-stage" id="tool-stage">
        ${showAside ? `<button class="fullscreen-toggle-float" id="fullscreen-toggle-float" aria-label="Expand sidebar"></button>` : ''}
        ${hideSidebar && onDevice ? `<div class="on-device-badge on-device-badge--float" title="This tool runs entirely in your browser. Your file is never uploaded.">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Runs on your device — nothing is uploaded</span>
        </div>` : ''}
        ${hideSidebar ? `<div id="tool-content" role="img" aria-label="${escape(canvasLabel())}"></div>` : `
        <div class="tool-canvas-outer" id="tool-canvas-outer">
          <div class="tool-canvas" id="tool-canvas" role="img" aria-label="${escape(canvasLabel())}"
               style="width: ${nativeW}px; height: ${nativeH}px;"></div>
        </div>`}
      </div>
      ${!hideSidebar ? `
        <div class="render-pill" id="render-pill" role="group" aria-label="Export and save">
          <button type="button" class="render-pill-btn render-pill-get" id="render-fab" aria-label="Export options">
            <svg class="render-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            <span>Export</span>
          </button>
          ${canSaveSession ? `
          <span class="render-pill-sep" aria-hidden="true"></span>
          <button type="button" class="render-pill-btn render-pill-save" id="render-save" aria-label="Save to your library" title="Save to your library">
            <svg class="render-pill-icon render-pill-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span data-save-label>Save</span>
          </button>` : ''}
        </div>
        <div class="export-overlay" id="export-overlay">
          <div class="export-overlay-scrim" data-export-close></div>
          <div class="export-popup" role="dialog" aria-modal="true" aria-label="Export">
            <div class="export-popup-head">
              <span class="export-popup-title">Export</span>
              <button type="button" class="export-popup-close" data-export-close aria-label="Close">&#x2715;</button>
            </div>
            <div class="export-popup-body" id="export-popup-body"></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  const canvasScope = hideSidebar ? '#tool-content' : '#tool-canvas';

  const styleEl = document.createElement('style');
  {
    const toolCss = tool.styles ? scopeCss(tool.styles, canvasScope) : '';
    // The editor layout owns its own selection chrome (free-canvas.js), so skip the
    // generic click-to-focus hover outline that would double up on every box.
    const focusHint = editorLayout ? '' : `
${canvasScope} [data-canvas-input] { cursor: pointer; }
${canvasScope} [data-canvas-input]:hover { outline: 2px dashed rgba(128,128,128,0.35); outline-offset: 3px; border-radius: 2px; }`;
    styleEl.textContent = `${toolCss}${focusHint}`;
    document.head.appendChild(styleEl);
  }

  // All of these were just created by the innerHTML assignment above.
  const layout    = viewEl.querySelector<HTMLElement>('#tool-layout')!;
  const inputsEl  = viewEl.querySelector<HTMLElement>('#tool-inputs');
  // The sidebar input panel instance (findings 6/8): owns its own gesture state
  // and previous-model baseline; the embed editor creates a separate instance.
  // markUserDirty is hoisted (function declaration below).
  const inputsPanel = inputsEl
    ? createInputPanel({ container: inputsEl, runtime, history: inputHistory, host, onDirty: (id: string) => markUserDirty(id) })
    : null;
  const canvasEl  = hideSidebar ? null : viewEl.querySelector<HTMLElement>('#tool-canvas')!;
  const outerEl   = hideSidebar ? null : viewEl.querySelector<HTMLElement>('#tool-canvas-outer')!;
  const contentEl = hideSidebar ? viewEl.querySelector<HTMLElement>('#tool-content')! : canvasEl;
  const stageEl   = viewEl.querySelector<HTMLElement>('#tool-stage')!;

  // Undo / redo buttons in the header — the tappable counterpart to Cmd+Z/Cmd+Y,
  // and the primary way to trigger history on touch (no keyboard). Centred in the
  // back-row between Tools (left) and the theme toggle (right). Each button stays
  // disabled while its stack is empty (refreshHistoryUI), and clicks route through
  // the same undoHistory/redoHistory the keyboard uses (so they show the toast too).
  // Only sidebar tools get the buttons; hideSidebar/canvas-layout tools (file
  // utilities with minimal inputs) have no back-row, so there they're keyboard-only.
  const backRow = viewEl.querySelector('.sidebar-back-row');
  if (backRow) {
    const group = document.createElement('div');
    group.className = 'history-controls';
    const mkBtn = (label: string, icon: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'history-btn';
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = icon;
      b.addEventListener('click', onClick);
      group.appendChild(b);
      return b;
    };
    const undoBtn = mkBtn('Undo', ICON_UNDO, undoHistory);
    const redoBtn = mkBtn('Redo', ICON_REDO, redoHistory);
    historyControls = {
      sync: (canUndo, canRedo) => {
        // If the button that ran the action is about to disable itself (e.g. the
        // last undo via keyboard), hand focus to its now-enabled sibling so a
        // disabled button doesn't drop focus to <body>.
        const active = document.activeElement;
        if (active === undoBtn && !canUndo && canRedo) redoBtn.focus();
        else if (active === redoBtn && !canRedo && canUndo) undoBtn.focus();
        undoBtn.disabled = !canUndo;
        redoBtn.disabled = !canRedo;
      },
    };
    backRow.appendChild(group);
    refreshHistoryUI();   // start disabled (empty history)
  }

  // Theme cycle toggle, sitting to the right of the sidebar's Tools button.
  viewEl.querySelector('.sidebar-back-row')?.appendChild(createThemeToggle(host));

  // Removed-image notice: announce it (live region) and let the user dismiss it.
  if (dropped.length) {
    announce(`An image used in this saved design is no longer available; the ${droppedLabels} ${dropped.length > 1 ? 'fields were' : 'field was'} left blank.`, { assertive: true });
    viewEl.querySelector('#dropped-assets-dismiss')
      ?.addEventListener('click', () => viewEl.querySelector('#dropped-assets-notice')?.remove());
  }

  // Export shutter: a camera-iris that closes over the whole stage so the brief
  // full-res resize during export (the "shake") is never seen, then opens.
  const SHUTTER_FLAPS = 6;
  let shutterEl: HTMLDivElement | null = null;
  if (stageEl) {
    shutterEl = document.createElement('div');
    shutterEl.className = 'export-shutter';
    shutterEl.setAttribute('aria-hidden', 'true');
    shutterEl.innerHTML = Array.from({ length: SHUTTER_FLAPS },
      (_, i) => `<span class="flap" style="--i:${i}"></span>`).join('');
    stageEl.appendChild(shutterEl);
  }
  const SHUTTER_MS = 430; // ≥ the .flap transition (0.42s) so it's fully closed/open
  const shutterFullscreen = () => window.matchMedia('(max-width: 640px)').matches;
  function closeShutter() {
    if (!shutterEl) return Promise.resolve();
    // Mobile: lift the shutter out of the stage so it covers the WHOLE screen —
    // over the sidebar sheet and export controls — for a more engaging capture.
    // (An ancestor's backdrop-filter is a fixed-positioning containing block, so
    // moving to <body> is what actually reaches the viewport.) Desktop: unchanged,
    // the shutter stays scoped to the stage.
    if (shutterFullscreen()) {
      document.body.appendChild(shutterEl);
      shutterEl.classList.add('export-shutter--fullscreen');
    }
    shutterEl.classList.add('is-active');
    void shutterEl.offsetWidth;          // reflow so the transition starts from "open"
    shutterEl.classList.add('is-closed');
    return new Promise(r => setTimeout(r, SHUTTER_MS));
  }
  function openShutter() {
    if (!shutterEl) return;
    shutterEl.classList.remove('is-closed');                          // sweep back out
    setTimeout(() => {
      shutterEl.classList.remove('is-active');                        // then unmount
      if (shutterEl.classList.contains('export-shutter--fullscreen')) {
        shutterEl.classList.remove('export-shutter--fullscreen');
        stageEl?.appendChild(shutterEl);                              // back into the stage
      }
    }, SHUTTER_MS);
  }
  // Standalone visual (no export gating) — used by Copy, whose clipboard write
  // must stay in the user-gesture context, so we can't await the shutter first.
  function playShutter() { closeShutter().then(openShutter); }
  const actionsEl  = viewEl.querySelector<HTMLElement>('#tool-actions');
  const sidebarEl  = viewEl.querySelector<HTMLElement>('#tool-sidebar');

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const fullscreenToggle      = viewEl.querySelector<HTMLButtonElement>('#fullscreen-toggle');
  const fullscreenToggleFloat = viewEl.querySelector<HTMLButtonElement>('#fullscreen-toggle-float');
  const dragHandle            = viewEl.querySelector<HTMLElement>('#sidebar-drag-handle');
  const sheetGrip             = viewEl.querySelector<HTMLButtonElement>('#sheet-grip');

  function setSidebarWidth(w: number, save = true): void {
    if (!sidebarEl) return;
    const snapped = w < SIDEBAR_MIN ? 0 : w;
    sidebarEl.style.width = snapped + 'px';
    // Freeze the content width at the open size so collapsing to 0 clips rather
    // than reflows (kept on collapse — only updated while the panel is open).
    if (snapped > 0) sidebarEl.style.setProperty('--sb-open-w', snapped + 'px');
    // Publish the open width so the desktop export panel can match the sidebar.
    if (snapped > 0) layout.style.setProperty('--sidebar-w', snapped + 'px');
    const isOpen = snapped > 0;
    layout.dataset.sidebar = isOpen ? 'open' : 'closed';
    if (fullscreenToggle) {
      fullscreenToggle.toggleAttribute('open', isOpen);
      fullscreenToggle.setAttribute('aria-label', isOpen ? 'Collapse sidebar' : 'Expand sidebar');
    }
    if (save) localStorage.setItem('sidebarWidth', String(snapped));
  }

  // Canonical address-bar URL for this open tool: the path form /t/<id> (so a copied
  // link carries the per-tool OG preview — see scripts/build-tool-og.js). All in-tool
  // URL writers (syncUrl, updateFullParam) build on this; the bar is rewritten from
  // the boot-time #/tool/<id> hash to this on the first syncUrl.
  const TOOL_URL_BASE = `/t/${toolId}`;

  // The live param string, whichever URL form the bar is in: the path's ?search once
  // syncUrl has prettified it, or the hash's #…?query in the instant after boot.
  function currentQuery() {
    if (window.location.search) return window.location.search.slice(1);
    const qi = window.location.hash.indexOf('?');
    return qi >= 0 ? window.location.hash.slice(qi + 1) : '';
  }

  function getRestoreWidth() {
    const v = Number(localStorage.getItem('sidebarWidth'));
    return v > SIDEBAR_MIN ? v : SIDEBAR_DEFAULT;
  }

  function updateFullParam(shouldBeFull: boolean): void {
    const sp = new URLSearchParams(currentQuery());
    if (shouldBeFull) sp.set('full', ''); else sp.delete('full');
    const parts: string[] = [];
    for (const [k, v] of sp.entries()) parts.push(v ? `${k}=${encodeURIComponent(v)}` : k);
    const q = parts.join('&');
    history.replaceState(null, '', q ? `${TOOL_URL_BASE}?${q}` : TOOL_URL_BASE);
  }

  // Canvas pan/zoom handle for the stage, assigned once the canvas is wired
  // (see setupStageNav below). Reset whenever the stage is resized by a
  // sidebar toggle so the preview returns to a clean fit.
  let stageZoom: StageNav | null = null;

  if (showAside && fullscreenToggle && fullscreenToggleFloat && dragHandle && sidebarEl) {
    fullscreenToggle.addEventListener('click', () => {
      const opening = layout.dataset.sidebar !== 'open';
      setSidebarWidth(opening ? getRestoreWidth() : 0);
      updateFullParam(!opening);
      stageZoom?.reset();
      setTimeout(fitCanvas, 220);
    });

    fullscreenToggleFloat.addEventListener('click', () => {
      setSidebarWidth(getRestoreWidth());
      updateFullParam(false);
      stageZoom?.reset();
      setTimeout(fitCanvas, 220);
    });

    // Drag to resize
    {
      let dragging = false;
      let startX = 0;
      let startW = 0;

      dragHandle.addEventListener('pointerdown', e => {
        dragging = true;
        startX = e.clientX;
        startW = sidebarEl.getBoundingClientRect().width;
        sidebarEl.classList.add('is-dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        dragHandle.setPointerCapture(e.pointerId);
      });

      dragHandle.addEventListener('pointermove', e => {
        if (!dragging) return;
        const w = Math.min(600, Math.max(0, startW + (e.clientX - startX)));
        setSidebarWidth(w, false);
      });

      dragHandle.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        sidebarEl.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setSidebarWidth(sidebarEl.getBoundingClientRect().width);
        fitCanvas();
      });
    }

    // Apply saved/initial width without triggering a save
    setSidebarWidth(sidebarOpen ? openWidth : 0, false);
  }

  // ── Responsive canvas ─────────────────────────────────────────────────────
  //
  // The canvas stays at its DOM-declared pixel dimensions so that CSS
  // getComputedStyle and exports work correctly. A CSS transform scales it
  // visually to fit the available stage width. The outer wrapper is sized to
  // the visual (scaled) dimensions so the layout doesn't leave a gap.

  function fitCanvas() {
    if (!canvasEl || !outerEl) return;
    if (stageZoom?.isZoomed()) return; // preserve pan/zoom across window/sidebar resize
    const canvasW   = parseInt(canvasEl.style.width,  10) || nativeW;
    const canvasH   = parseInt(canvasEl.style.height, 10) || nativeH;
    const stageRect = stageEl.getBoundingClientRect();

    // On mobile the controls sheet overlaps the top of the (static) preview stage.
    // Pad the stage down by however much the sheet currently covers it, so Fit
    // sizes AND centres the canvas within the area the sheet leaves visible — not
    // behind it. getBoundingClientRect is the border-box (padding-independent), so
    // the scale math stays stable as we set the padding.
    let topPad = 0;
    if (sidebarEl && window.matchMedia('(max-width: 640px)').matches) {
      const sheetBottom = sidebarEl.getBoundingClientRect().bottom;
      topPad = Math.max(0, Math.min(stageRect.height, sheetBottom - stageRect.top));
    }
    const padPx = topPad ? `${topPad}px` : '';
    if (stageEl.style.paddingTop !== padPx) stageEl.style.paddingTop = padPx; // guard the ResizeObserver

    const availW    = Math.max(40, stageRect.width  - 32);
    const availH    = Math.max(40, stageRect.height - topPad - 32);
    const scale     = Math.min(1, availW / canvasW, availH / canvasH);
    canvasEl.style.transform = scale < 1 ? `scale(${scale.toFixed(4)})` : '';
    outerEl.style.width  = Math.round(canvasW * scale) + 'px';
    outerEl.style.height = Math.round(canvasH * scale) + 'px';
    stageZoom?.sync(); // refresh the zoom % readout after a re-fit
  }

  // Reset pan/zoom and re-fit. Passed to renderActions so a dimension change always
  // returns to a clean fitted view rather than leaving a panned/zoomed canvas.
  function resetView() {
    stageZoom?.reset();
    fitCanvas();
  }

  const ro = new ResizeObserver(fitCanvas);
  ro.observe(stageEl);
  fitCanvas();
  if (canvasEl) canvasEl.addEventListener('canvas-resize', fitCanvas);

  // Canvas navigation — one module for both pointer types. Touch gets pinch-zoom +
  // drag-pan; desktop gets trackpad-native zoom/pan (Cmd/Ctrl-wheel & pinch zoom
  // about the cursor, Space/middle-drag pan, 0/1/+/- keys) plus a Fit/% HUD.
  if (stageEl && !hideSidebar && outerEl && canvasEl) {
    // Pass fitCanvas as the "fit" action so the HUD's Fit button re-fits to the
    // CURRENT layout (e.g. the area left by the mobile sheet), not just the
    // stale fit that reset() restores.
    stageZoom = setupStageNav(stageEl, outerEl, canvasEl, nativeW, fitCanvas);
  }

  // Mobile (≤640px): the sidebar becomes a top-anchored controls panel with the
  // grip on its bottom edge; the preview fills below. Dragging the grip down grows
  // the controls (grip tracks the finger), releasing snaps to peek/half/full, and
  // the preview re-fits to whatever space the panel leaves.
  if (!hideSidebar && sheetGrip && sidebarEl) {
    // The preview is a static backdrop the sheet slides over, so half/full snaps
    // leave it untouched. But collapsing to peek (grip dragged to the top) vacates
    // most of the screen — re-fit there so the canvas grows into the freed space.
    // fitCanvas no-ops if the user has zoomed/panned, so this only fires at Fit.
    // Wait out the 0.34s height settle so it measures the final sheet position.
    setupMobileSheet(layout, sidebarEl, sheetGrip, (snap) => {
      if (snap === 'peek') setTimeout(fitCanvas, 360);
    });
  }

  // Collapse the export/actions panel behind a "Render" button on BOTH mobile and
  // desktop: the wired #tool-actions node moves into the popup (its listeners
  // survive the move). Mobile presents it as a full-screen sheet; desktop as a
  // non-modal panel anchored to the sidebar bottom — pure CSS difference (app.css).
  let exportTeardown: (() => void) | null = null;
  // The "Save" half of the render pill — assigned just below, but declared out here
  // so the dirty-state helpers (markSessionDirty / markSessionSaved, defined later)
  // can flash and clear it from the input-change chokepoint.
  let renderSaveBtn: HTMLButtonElement | null = null;
  const renderPill    = viewEl.querySelector<HTMLElement>('#render-pill');
  const renderFab     = viewEl.querySelector<HTMLButtonElement>('#render-fab');   // the "Export" half (opens export)
  renderSaveBtn       = viewEl.querySelector<HTMLButtonElement>('#render-save');  // the "Save" half (outer-scoped)
  const exportOverlay = viewEl.querySelector<HTMLElement>('#export-overlay');
  const exportBody    = viewEl.querySelector<HTMLElement>('#export-popup-body');
  if (!hideSidebar && renderPill && renderFab && exportOverlay && exportBody && actionsEl) {
    const mqMobile    = window.matchMedia('(max-width: 640px)');
    const exportPopup = exportOverlay.querySelector<HTMLElement>('.export-popup')!;
    // The export panel is modal ONLY on mobile, where it's a full bottom sheet over a
    // scrim. On desktop it's a NON-modal panel anchored to the sidebar bottom — the
    // inputs above and the resize handle must stay live (users routinely open Export,
    // then go back to editing before downloading), so we neither inert the background
    // nor trap Tab there. The markup hard-codes aria-modal; we correct it per
    // breakpoint here. applyModality reconciles inert + aria-modal with both the open
    // state and the current breakpoint, so it's safe to re-run on resize too.
    const isModal = () => mqMobile.matches;
    const applyModality = () => {
      const modal = layout.classList.contains('export-open') && isModal();
      for (const child of layout.children) {
        if (child !== exportOverlay && child instanceof HTMLElement) child.inert = modal;   // pointer + Tab blocked behind the sheet
      }
      exportPopup.setAttribute('aria-modal', modal ? 'true' : 'false');
    };
    const closeExport = () => {
      layout.classList.remove('export-open');
      renderFab.setAttribute('aria-expanded', 'false');
      applyModality();                 // un-inert before returning focus to the trigger
      renderFab.focus(); // return focus to the trigger (it reappears on close)
    };
    const openExport = ({ focus = true }: { focus?: boolean } = {}) => {
      layout.classList.add('export-open');
      renderFab.setAttribute('aria-expanded', 'true');
      applyModality();
      // Move focus into the dialog (its close button) for keyboard/SR users — but
      // not when auto-opened from ?options on load, where grabbing focus is jarring.
      if (focus) exportOverlay.querySelector<HTMLElement>('.export-popup-close')?.focus();
    };
    // Actions live in the Render popup on every breakpoint. The Get|Save pill
    // lives INSIDE the sidebar on desktop (a centred footer) but must sit OUTSIDE
    // it on mobile, where it's a viewport FAB the sheet's overflow would clip.
    const placeActions = () => {
      if (actionsEl.parentElement !== exportBody) exportBody.appendChild(actionsEl);
      // No sidebar in editor mode → the pill floats over the stage (like mobile).
      const fabDest = (mqMobile.matches || editorLayout || !sidebarEl) ? layout : sidebarEl;
      if (renderPill.parentElement !== fabDest) fabDest.appendChild(renderPill);
    };
    renderFab.setAttribute('aria-haspopup', 'dialog');
    renderFab.setAttribute('aria-expanded', 'false');
    renderFab.addEventListener('click', () => openExport());
    exportOverlay.querySelectorAll('[data-export-close]')
      .forEach(el => el.addEventListener('click', closeExport));
    // Escape closes the export popup; Tab is wrapped so focus stays within the
    // sheet (a belt-and-braces companion to the inert background above — inert
    // alone can let Tab graze the browser chrome between the last and first stop).
    const onExportKey = (e: KeyboardEvent): void => {
      if (!layout.classList.contains('export-open')) return;
      if (e.key === 'Escape') { closeExport(); return; }
      if (e.key !== 'Tab' || !isModal()) return;   // only trap Tab in the modal (mobile) sheet
      const focusables = [...exportOverlay.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(el => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0]!, last = focusables[focusables.length - 1]!;
      // Only wrap when focus is already at an edge of the popup — if it's elsewhere
      // (e.g. an auto-opened panel the user hasn't tabbed into yet) leave Tab alone.
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onExportKey);

    // Flick-down to dismiss the export popup — the same instinct as swiping a
    // bottom sheet away. The popup follows the finger; release past a threshold
    // (or a fast flick) closes it, otherwise it springs back. Drags from the
    // (scrollable) body only engage at the top, so the list still scrolls.
    let py = 0, pt = 0, pdrag = false;
    const popupStart = (e: TouchEvent): void => {
      pdrag = mqMobile.matches && e.touches.length === 1;
      // Never engage the flick-to-dismiss when the touch lands on a scrubbable
      // control — the export-size fields own the full horizontal drag of their
      // value, so a diagonal scrub must not also drag the sheet down.
      if (pdrag && e.target instanceof Element && e.target.closest('[data-scrub]')) pdrag = false;
      if (pdrag && e.target instanceof Node && exportBody.contains(e.target) && exportBody.scrollTop > 0) pdrag = false;
      if (!pdrag) return;
      py = e.touches[0]?.clientY ?? 0;
      pt = e.timeStamp;
    };
    const popupMove = (e: TouchEvent): void => {
      if (!pdrag) return;
      const dy = (e.touches[0]?.clientY ?? py) - py;
      if (dy <= 0) { exportPopup.style.transform = ''; return; } // upward → ignore
      e.preventDefault();                       // claim the gesture from scroll
      exportPopup.classList.add('is-popup-dragging');
      exportPopup.style.transform = `translateY(${dy}px)`;
    };
    const popupEnd = (e: TouchEvent): void => {
      if (!pdrag) return;
      pdrag = false;
      const dy = (e.changedTouches[0]?.clientY ?? py) - py;
      exportPopup.classList.remove('is-popup-dragging');
      exportPopup.style.transform = '';          // hand back to the CSS transition
      if (dy > 0 && flickDirection(dy, e.timeStamp - pt) === 1) closeExport();
    };
    exportPopup.addEventListener('touchstart', popupStart, { passive: true });
    exportPopup.addEventListener('touchmove', popupMove, { passive: false });
    exportPopup.addEventListener('touchend', popupEnd, { passive: true });
    exportPopup.addEventListener('touchcancel', popupEnd, { passive: true });

    placeActions();
    // ?options share-links land with the export panel already open (no focus grab).
    if (showExportPanel) openExport({ focus: false });
    const onBreakpoint = () => { placeActions(); applyModality(); };
    mqMobile.addEventListener('change', onBreakpoint);
    exportTeardown = () => { mqMobile.removeEventListener('change', onBreakpoint); document.removeEventListener('keydown', onExportKey); };
  }

  // Cleanup: remove injected <style>, disconnect observer, tear down canvas nav + export.
  viewEl._cleanup = () => {
    runtime.stopLive?.(); // release the camera if a live session is running
    styleEl.remove(); shutterEl?.remove(); ro.disconnect(); stageZoom?.destroy(); exportTeardown?.();
    window.removeEventListener('keydown', onHistoryKey);
    historyToast.destroy();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    // Document-level capture listeners added per renderInputs — drop them (and the
    // panel's flatpickr calendars) so a detached sidebar tree isn't pinned alive
    // across tool navigation.
    inputsPanel?.destroy();
  };

  // Temporarily remove the CSS scale so dom-to-image sees native dimensions.
  // Also strips data-canvas-input attrs so they don't appear in exported files,
  // restoring them after so click-to-focus keeps working post-export.
  async function exportUnscaled(fn: () => Promise<Blob>, { shutter = false }: { shutter?: boolean } = {}): Promise<Blob> {
    // Renders are coalesced behind rAF (see the subscriber below); an export reads
    // the canvas DOM directly, so force any pending paint to land first — otherwise
    // we'd capture the frame before the latest keystroke.
    flushRender();
    // Embeds (lolly.tools/tool/… URLs) hydrate fire-and-forget on each render;
    // wait for the latest pass so export reads resolved blobs, not the placeholder.
    await embedsPending;
    // hideSidebar tools have no scaled canvas — nothing to strip or unscale.
    if (!canvasEl || !outerEl) return await fn();
    const annotated = [...canvasEl.querySelectorAll<HTMLElement>('[data-canvas-input]')];
    const saved = annotated.map(el => ({ el, id: el.dataset.canvasInput }));
    annotated.forEach(el => el.removeAttribute('data-canvas-input'));

    // Close the shutter BEFORE the resize so the shake happens fully hidden.
    if (shutter) await closeShutter();

    const prevTransform = canvasEl.style.transform;
    const prevW = outerEl.style.width;
    const prevH = outerEl.style.height;
    canvasEl.style.transform = '';
    outerEl.style.width  = canvasEl.style.width;
    outerEl.style.height = canvasEl.style.height;
    try {
      return await fn();
    } finally {
      canvasEl.style.transform = prevTransform;
      outerEl.style.width  = prevW;
      outerEl.style.height = prevH;
      saved.forEach(({ el, id }) => { if (el.isConnected && id != null) el.dataset.canvasInput = id; });
      if (shutter) openShutter();
    }
  }

  // ── Wire up ───────────────────────────────────────────────────────────────

  // A size-style select (its options carry width/height) sets the export size, so
  // the chosen badge/page size actually prints at that size. Seed the export-bar
  // defaults from the initially-selected option (URL / saved state still win).
  const sizeDriver = exportSizeDriver(tool.manifest);
  const sizeDims = sizeDriver
    ? sizeDriver.dims[String(runtime.getModel().find(i => i.id === sizeDriver.id)?.value)]
    : null;

  const exportDefaults: ExportDefaults = {
    filename: urlFilename || asString(initialValues.__export_filename),
    format:   urlFormat || asString(initialValues.__export_format),
    width:    urlWidth  || Number(initialValues.__export_width ?? '')  || sizeDims?.width  || undefined,
    height:   urlHeight || Number(initialValues.__export_height ?? '') || sizeDims?.height || undefined,
    unit:     urlUnit || asString(initialValues.__export_unit) || sizeDims?.unit || 'px',
    dpi:      urlDpi || Number(initialValues.__export_dpi ?? '') || 300,
    profile:  urlProfile || asString(initialValues.__export_profile) || undefined,
    // Password comes from the URL only — never restored from saved state (we don't
    // persist passwords at rest in the library; see performSave's __export_* snapshot).
    password: urlPassword || undefined,
    // Print prep (pdf / pdf-cmyk / cmyk-tiff): bleed dimension string + a marks toggle map.
    // Present (from URL or saved state) ⇒ the Print marks card opens pre-filled.
    bleed:    urlBleed || asString(initialValues.__export_bleed) || undefined,
    marks:    urlMarks || marksFromCsv(asString(initialValues.__export_marks)),
    // Full-page HTML export ("no stage"). URL-driven — like `password`, it isn't
    // persisted to the library at rest, only round-tripped through the URL.
    nostage:  urlNostage || undefined,
  };
  // Rewrite the URL hash query string to reflect the current tool state so the
  // page is shareable and bookmarkable. Uses replaceState — no history entry.
  // Params the user has explicitly touched — only these are written to the URL.
  // Pre-seeded from any params already in the URL so shared/bookmarked links
  // are preserved across the first subscribe callback.
  let userHasMadeChanges = false;
  // The render pill's Save half goes amber (with a one-shot flash) the moment the
  // first un-saved edit lands, and reverts to its resting state on save. We flash
  // only on the clean→dirty edge so it's an attention cue, not a strobe; the
  // animation is restarted by removing+re-adding the class (a no-op re-add wouldn't
  // replay it), so it fires again after each subsequent save→edit cycle.
  function markSessionDirty(): void {
    if (userHasMadeChanges) return;          // already dirty — keep the resting amber
    userHasMadeChanges = true;
    if (renderSaveBtn) {
      renderSaveBtn.classList.remove('is-unsaved');
      void renderSaveBtn.offsetWidth;        // force reflow so the flash animation restarts
      renderSaveBtn.classList.add('is-unsaved');
    }
  }
  function markSessionSaved(): void {
    userHasMadeChanges = false;
    renderSaveBtn?.classList.remove('is-unsaved');
  }
  // Address-bar writer: dirty-param tracking, export-control readback and the
  // auto-pack switch live in views/tool/url-sync.ts (finding 1). Seeded from the
  // params this mount was routed with; export controls are read live off actionsEl.
  const urlSync = createUrlSync({ runtime, toolUrlBase: TOOL_URL_BASE, urlParams, actionsEl });
  const syncUrl = (dirtyId?: string): void => urlSync.syncUrl(dirtyId);
  const barSeq = urlSync.barSeq;

  function markUserDirty(id?: string): void {
    markSessionDirty();   // sets userHasMadeChanges + flashes the Save pill on the first edit
    // Just record the param as dirty — the coalesced render's syncUrl() (folded
    // into the rAF below) writes the URL for every dirty param, so calling it here
    // too would replaceState twice per keystroke for no benefit.
    if (id) urlSync.markDirty(id);
  }

  const actionsApi = renderActions(actionsEl, tool.manifest, runtime, inputHistory, canvasEl, host, resetView, exportUnscaled, exportDefaults, syncUrl, playShutter, fileIntoFolder, returnTo, slot);

  // Copy-URL now lives in the actions bar (renderActions), alongside the export
  // buttons — its format/filename/dimension inputs are in the same element.
  if (actionsEl) wireUpCopyUrl(actionsEl, runtime, actionsEl, tool.manifest);

  // The render pill's Save half: an in-place quick-save. It reuses the exact same
  // export-aware save routine as the popup's Save button (performSave), but unlike
  // that button it does NOT navigate away — it's a checkpoint affordance. performSave
  // leaves the button disabled with a "Saved" label for its own navigate-away caller,
  // so we restore it here and clear the unsaved cue, briefly holding "Saved" as
  // confirmation before reverting to "Save".
  const saveBtnEl = renderSaveBtn;
  const doSave = actionsApi?.save;
  if (saveBtnEl && doSave) {
    const saveLabel = saveBtnEl.querySelector('[data-save-label]');
    saveBtnEl.addEventListener('click', async () => {
      if (saveBtnEl.dataset.saving) return;          // guard double-taps mid-save
      const ok = await doSave(saveBtnEl);            // performSave handles the label/disabled swap
      if (!ok) return;                               // failure path already reverted the button
      delete saveBtnEl.dataset.saving;
      saveBtnEl.disabled = false;
      markSessionSaved();                            // drop the amber unsaved cue
      saveBtnEl.classList.add('is-just-saved');
      setTimeout(() => {
        if (saveLabel) saveLabel.textContent = 'Save';
        saveBtnEl.classList.remove('is-just-saved');
      }, 1500);
    });
  }

  // Wire up the remaining sidebar utility buttons (Shrink URL, Clear changes).
  const sidebarUtilsEl = viewEl.querySelector('#sidebar-utils');
  if (sidebarUtilsEl) {
    sidebarUtilsEl.querySelector<HTMLButtonElement>('#shrink-url-btn')?.addEventListener('click', function () {
      void shrinkUrl(runtime, tool.manifest, barSeq);
      const prev = this.textContent;
      this.textContent = 'Shrunk!';
      setTimeout(() => { this.textContent = prev; }, 1500);
    });
  }

  // WYSIWYG editor overlay (render.layout:'editor'): mount the direct-manipulation
  // layer over the live canvas. Dynamically imported (gated, never static) so it's
  // only pulled in for editor-layout tools — the engine and every other tool are
  // untouched. It reads/writes the flat `boxes` array through runtime.setInput.
  if (editorLayout && canvasEditInput && canvasEl && stageEl) {
    // The artboard is a resizable document. Restore its size from the URL's
    // reserved width/height (px) if present, then re-fit.
    if (urlWidth != null && urlWidth > 0) canvasEl.style.width = urlWidth + 'px';
    if (urlHeight != null && urlHeight > 0) canvasEl.style.height = urlHeight + 'px';
    if ((urlWidth ?? 0) > 0 || (urlHeight ?? 0) > 0) resetView();
    // Resize the document: keep box coordinates fixed (they don't scatter), resize
    // the canvas, mirror it to the export dimensions so output matches, and re-fit.
    const setCanvasSize = (w: number, h: number): void => {
      canvasEl.style.width = w + 'px';
      canvasEl.style.height = h + 'px';
      actionsApi?.setDims?.({ width: w, height: h, unit: 'px' });
      markUserDirty('w'); markUserDirty('h');
      resetView();
    };
    import('../free-canvas.ts').then(({ initFreeCanvas }) => {
      if (!viewEl.isConnected) return;   // navigated away before the chunk loaded
      const fc = initFreeCanvas({
        viewEl, stageEl, canvasEl, outerEl, runtime, host,
        input: canvasEditInput, nativeW, nativeH,
        onDirty: markUserDirty,
        setCanvasSize,
        // Picking a Lolly link / saved session for a box image opens its inputs
        // first (configure → insert), same as the sidebar asset slots.
        editTool: (toolUrl: string) => openEmbedEditor(host, { editUrl: toolUrl, slotLabel: 'image', mode: 'insert' }),
      });
      const prevCleanup = viewEl._cleanup;
      viewEl._cleanup = () => { try { fc.destroy(); } catch (e) { console.error(e); } prevCleanup?.(); };
    }).catch(err => console.error('[layout-studio] editor overlay failed to load:', err));
  }

  // Intercept back / home nav clicks — offer save dialog if inputs have changed. Leaving
  // routes to backHref (the launch folder when the session came from one, else the
  // gallery), matching the back link's label and the Save button's return target.
  if (hasInputs) {
    viewEl.querySelectorAll('.tools-home').forEach(link => {
      link.addEventListener('click', e => {
        if (!userHasMadeChanges) return;
        e.preventDefault();
        // Offer "Save & leave" only when the tool actually has a save action.
        const saveAction = actionsApi?.save;
        const canSave = !!actionsEl?.querySelector('[data-action="save"]') && !!saveAction;
        showUnsavedDialog(
          canSave && saveAction ? async () => { if (await saveAction()) navigateTo(backHref); } : null,
          () => { navigateTo(backHref); },
        );
      });
    });
  }

  // Mark model inputs dirty the first time the user touches them.
  // The listener lives on the container so it survives renderInputs re-renders.
  (['change', 'input'] as const).forEach(evt =>
    inputsEl?.addEventListener(evt, e => {
      const id = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-input-id]')?.dataset.inputId : undefined;
      if (id) markUserDirty(id);
    })
  );

  // QOL: step a focused <select> with ↑/↓ and apply each value instantly, without
  // opening the dropdown. macOS opens the native menu on Arrow keys (Windows/Linux
  // cycle the value); intercepting it makes the behaviour consistent and lets the user
  // tab to a select and audition options one keypress at a time. Delegated on the
  // container so it covers top-level AND block-field selects and survives re-renders;
  // while the native menu is open the element doesn't receive these keydowns.
  inputsEl?.addEventListener('keydown', e => {
    if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || e.metaKey || e.ctrlKey || e.altKey) return;
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement) || sel.disabled) return;
    e.preventDefault(); // stop macOS popping the native menu on Arrow
    const opts = sel.options, dir = e.key === 'ArrowDown' ? 1 : -1;
    let next = sel.selectedIndex + dir;
    while (next >= 0 && next < opts.length && opts[next]?.disabled) next += dir; // skip disabled
    if (next < 0 || next >= opts.length || next === sel.selectedIndex) return;  // clamp at the ends
    sel.selectedIndex = next;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Click-to-focus: clicking a rendered canvas element that represents an input
  // focuses the corresponding sidebar control. Tools can suppress this per-element
  // with pointer-events:none. The handler is added once; annotations are re-applied
  // via resolveCanvasAnnotations() after each innerHTML update.
  if (canvasEl) canvasEl.addEventListener('click', e => {
    if (hideSidebar || !inputsEl) return;
    const target = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-canvas-input]') : null;
    if (!target) return;
    const id = target.dataset.canvasInput ?? '';

    // Most ids map straight to a sidebar row. A "<blocksInputId>:<index>" id
    // (emitted per rendered block, e.g. data-canvas-input="blocks:0") points at
    // one block inside a blocks input — focus that block and fold the rest.
    let control = inputsEl.querySelector<HTMLElement>(`[data-input-id="${id}"]`);
    let blockIndex: string | null = null;
    const blockRef = !control && id.match(/^(.+):(\d+)$/);
    if (blockRef) {
      const blocksEl = inputsEl.querySelector<HTMLElement>(`.blocks-input[data-input-id="${blockRef[1]}"]`);
      if (blocksEl) { control = blocksEl; blockIndex = blockRef[2] ?? null; }
    }
    if (!control) return;

    const focusTarget = control;
    const focus = () => {
      // Reveal the control if it lives inside a collapsed section (mirrors the
      // scrollToInput path), so the focused input is actually visible.
      focusTarget.closest('details.input-section')?.setAttribute('open', '');
      if (blockIndex != null) {
        focusSidebarBlock(focusTarget, blockIndex);
      } else {
        focusTarget.focus();              // lights the CSS :focus-within spotlight
        scrollToControl(focusTarget);     // header-aware, reduce-motion-safe, with arrival pulse
      }
    };
    if (layout.dataset.sidebar === 'closed') {
      setSidebarWidth(getRestoreWidth());
      requestAnimationFrame(focus);
    } else {
      focus();
    }
  });

  // Deferred-preview tools (manifest.render.preview): the live canvas is only a
  // placeholder until an explicit, expensive render runs — e.g. url-shot, which
  // screenshots a real page in beforeExport. The template supplies a [data-preview]
  // control; here we drive it (busy/error state) and run the render into the frame.
  // Wired by delegation on the canvas so it survives the innerHTML rebuild that the
  // runtime subscriber does on every input change.
  const previewCfg = tool.manifest.render.preview;
  async function runPreview(): Promise<void> {
    const btn = contentEl?.querySelector<HTMLElement>('[data-preview]');
    if (btn) {
      if (btn.dataset.busy) return;                  // re-entrancy guard
      btn.dataset.busy = '1';
      btn.dataset.idleLabel ??= (btn.textContent ?? '').trim();
      btn.classList.remove('is-error');
      btn.classList.add('is-busy');
      btn.textContent = btn.dataset.busyLabel || 'Rendering…';
    }
    try {
      await actionsApi?.preview?.();
      // Success: the hook painted the capture and hid the placeholder (button
      // included), so there's nothing to reset — it's gone from the DOM.
    } catch (err) {
      // Surface the failure in place; the placeholder stays so the user can retry.
      // The next input change rebuilds a fresh button with its idle label.
      const b = contentEl?.querySelector<HTMLElement>('[data-preview]');
      if (b) {
        b.classList.remove('is-busy');
        b.classList.add('is-error');
        b.textContent = errorMessage(err) || 'Preview failed — tap to retry';
        delete b.dataset.busy;
      }
      throw err;
    }
  }
  if (previewCfg && canvasEl) {
    canvasEl.addEventListener('click', e => {
      if (!(e.target instanceof Element && e.target.closest('[data-preview]'))) return;
      runPreview().catch(err => console.error('Preview failed:', err));
    });
  }

  // File-utility download: a template [data-export-file] button asks the tool's
  // exportFile hook to produce the transformed bytes (the file in → file out
  // shape — EXIF strip, redact, compress, …), then delivers them via
  // host.export.file (no watermark, no provenance — it's the user's own file).
  // Delegated on the persistent content container so it survives the innerHTML
  // rebuild the runtime subscriber does on every input change.
  if (runtime.hasExportFile && contentEl) {
    contentEl.addEventListener('click', async (e) => {
      const btn = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-export-file]') : null;
      if (!btn || btn.dataset.busy) return;
      btn.dataset.busy = '1';
      btn.dataset.idleLabel ??= (btn.textContent ?? '').trim();
      btn.classList.remove('is-error');
      btn.classList.add('is-busy');
      btn.textContent = btn.dataset.busyLabel || 'Working…';
      try {
        const { bytes, mime, filename } = await runtime.exportFile();
        // .slice() re-views the bytes over a plain ArrayBuffer (BlobPart-compatible).
        const blob = new Blob([bytes instanceof Uint8Array ? bytes.slice() : bytes], { type: mime || 'application/octet-stream' });
        await host.export.file(blob, { filename: filename || 'file' });
        btn.classList.remove('is-busy');
        btn.textContent = btn.dataset.idleLabel ?? '';
        delete btn.dataset.busy;
      } catch (err) {
        console.error('exportFile failed:', err);
        btn.classList.remove('is-busy');
        btn.classList.add('is-error');
        btn.textContent = errorMessage(err) || 'Export failed — try again';
        delete btn.dataset.busy;
      }
    });
  }

  // Scripts in template HTML don't execute when set via innerHTML (browser security).
  // Run them once on first render; subsequent renders update data but keep the
  // same script context alive.
  let pendingAutoExport = autoExport;
  let pendingAutoCopy = autoCopy;
  // Auto-generate a preview once the tool settles, so the user lands on a rendered
  // frame rather than the placeholder. Once only (never on every input change — a
  // deferred render must stay deliberate), and skipped when a ?export is already
  // queued so we don't capture the same page twice on load.
  let pendingAutoPreview = Boolean(previewCfg?.auto) && !autoExport;
  // Track the size-driving select's value so a change pushes the option's physical
  // dimensions to the export bar (see exportSizeDriver / actionsApi.setDims).
  let lastDimsSizeVal = sizeDriver ? runtime.getModel().find(i => i.id === sizeDriver.id)?.value : null;

  // Inline canvas error, shown when a template script throws mid-render. Lives on
  // the stage as a sibling of the canvas, so the per-render innerHTML rebuild
  // doesn't wipe it; cleared on the next successful render.
  function showCanvasError(): void {
    const stage = stageEl || contentEl?.parentElement;
    if (!stage || stage.querySelector(':scope > .canvas-error')) return;
    const box = document.createElement('div');
    box.className = 'canvas-error';
    box.setAttribute('role', 'alert');
    box.textContent = "Couldn't render this preview — check your inputs.";
    stage.appendChild(box);
  }
  function clearCanvasError(): void {
    (stageEl || contentEl?.parentElement)?.querySelector(':scope > .canvas-error')?.remove();
  }

  let renderGen = 0;
  // Latest embed-hydration promise; exportUnscaled awaits it so an export reads
  // resolved blob URLs rather than the neutralised 1×1 placeholder.
  let embedsPending = Promise.resolve();

  // The RENDER half of the subscriber is coalesced behind requestAnimationFrame:
  // a full canvas rebuild swaps innerHTML, re-walks annotations, and re-executes
  // every template <script> (chart/QR/map libs re-instantiate), so doing it per
  // keystroke is wasteful. We stash the latest emit and paint at most once per
  // frame — the sidebar sync (below) stays synchronous so typed values echo with
  // no lag. The trailing emit is always the one we paint, so the final keystroke
  // never gets dropped; flushRender() forces it out synchronously before exports.
  let rafId = 0;
  let pendingFrame: { model: InputModelItem[]; hydrated: string } | null = null;   // latest emit awaiting paint

  function paint(): void {
    rafId = 0;
    if (!pendingFrame) return;
    const { model, hydrated } = pendingFrame;
    pendingFrame = null;
    const gen = ++renderGen;
    try {
      // Neutralise any lolly.tools embed URLs BEFORE insertion so the editor never
      // fires a network request for them; they're resolved to local composed
      // renders (blob URLs) just after the template's own scripts run. The
      // generation guard stops a slow embed render from overwriting a newer one.
      if (!contentEl) return;
      contentEl.innerHTML = neutralizeEmbeds(hydrated);
      if (!hideSidebar) resolveCanvasAnnotations(contentEl);
      // Keep the canvas's accessible summary current when it's a live a11yLabel.
      if (tool.manifest.a11yLabel) contentEl.setAttribute('aria-label', canvasLabel());
      runTemplateScripts(contentEl);
      embedsPending = hydrateEmbeds(contentEl, { host, isCurrent: () => gen === renderGen });
      clearCanvasError();
    } catch (err) {
      // A throwing template script (charts, QR, fetch-backed tools run in page
      // context — unlike the sandboxed hooks) would otherwise leave a stale or
      // half-built canvas with no signal. Surface it; the sidebar stays editable.
      console.error('Render failed:', err);
      showCanvasError();
    }
    syncUrl();

    // When a size-driving select changes, set the export dimensions to the chosen
    // option — so picking "A6 landscape" actually exports an A6-landscape page.
    if (sizeDriver) {
      const v = model.find(i => i.id === sizeDriver.id)?.value;
      if (v !== lastDimsSizeVal) {
        lastDimsSizeVal = v;
        const d = sizeDriver.dims[String(v)];
        if (d) actionsApi?.setDims?.(d);
      }
    }

    if (pendingAutoExport) {
      pendingAutoExport = false;
      const fmt = urlFormat || tool.manifest.render.formats[0] || 'png';
      if (!contentEl) return;
      waitForQuiescence(contentEl).then(() => {
        const name = urlFilename || tool.manifest.id;
        // Honour ?unit=/?dpi= so a deep link (or CLI) renders the right physical size.
        const u = urlUnit || 'px';
        const dim = (v: number | null, native: number): number | string => (v != null && v > 0 ? (u !== 'px' ? `${v}${u}` : v) : native);
        const expOpts: Partial<ExportOptions> = { width: dim(urlWidth, nativeW), height: dim(urlHeight, nativeH) };
        if (u !== 'px') expOpts.dpi = urlDpi || 300;
        // CMYK print formats: carry the chosen press condition (recorded in the
        // PDF's output intent / the TIFF's metadata). The Print PDF also carries the
        // brand palette for exact ink matches; the TIFF does a flat per-pixel pass.
        if (isCmykFmt(fmt)) {
          expOpts.colorProfile = urlProfile || DEFAULT_CMYK_CONDITION;
          if (fmt === 'pdf-cmyk') expOpts.palette = PALETTE;
        }
        // HTML: honour ?nostage so a deep link auto-exports the full-page document
        // (no fixed-size canvas frame) — mirrors the panel's "Full page" toggle.
        if (fmt === 'html' && urlNostage) expOpts.fullPage = true;
        // Standard PDF: honour ?password= so a deep link can auto-export a locked
        // PDF (basic lock; clear-text in the URL by design — see pdfPassRow).
        if (fmt === 'pdf' && urlPassword) expOpts.password = urlPassword;
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
        void exportUnscaled(async () => {
          const blob = await runtime.export(canvasEl, fmt, expOpts);
          await host.export.download(blob, `${name}.${extFor(fmt, blob)}`).catch(err => console.error('Auto-export failed:', err));
          return blob;
        }).catch(err => console.error('Auto-export failed:', err));
      });
    }

    if (pendingAutoCopy && contentEl) {
      pendingAutoCopy = false;
      void waitForQuiescence(contentEl).then(() => armAutoCopy(actionsEl, actionsApi, urlFormat || undefined));
    }

    if (pendingAutoPreview && contentEl) {
      pendingAutoPreview = false;
      void waitForQuiescence(contentEl).then(() =>
        runPreview().catch(err => console.error('Auto-preview failed:', err))
      );
    }
  }

  // Paint any queued frame right now (cancelling the scheduled rAF). Used by
  // exportUnscaled so a capture reads the latest keystroke, and harmless if no
  // frame is pending.
  function flushRender(): void {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; paint(); }
  }

  runtime.subscribe(({ model, hydrated }) => {
    // Sidebar sync is cheap and must stay responsive, so it runs synchronously on
    // every emit; only the expensive canvas rebuild is deferred to the next frame.
    // (The panel itself skips the rebuild mid-drag and on a same-value keystroke.)
    inputsPanel?.render(model);
    pendingFrame = { model, hydrated };
    if (!rafId) rafId = requestAnimationFrame(paint);
  });

  // Live camera (engine v1.4): a tool that declares an `onFrame` hook can react to a
  // live camera stream. Pure progressive enhancement — the toggle appears only when
  // the tool has the hook AND this shell exposes a camera (host.media); otherwise the
  // tool just runs as a still-image tool. The runtime owns the frame→onFrame→repaint
  // loop; here we only drive the toggle and surface permission errors.
  if (stageEl && runtime.hasFrameHook && host.media?.isAvailable?.()) {
    const liveBtn = document.createElement('button');
    liveBtn.type = 'button';
    liveBtn.className = 'canvas-live-toggle';
    liveBtn.setAttribute('aria-pressed', 'false');
    liveBtn.title = 'React to your camera in real time';
    liveBtn.innerHTML = '<span class="canvas-live-dot" aria-hidden="true"></span><span class="canvas-live-label">Go live</span>';
    stageEl.appendChild(liveBtn);
    const setLiveUi = (on: boolean): void => {
      liveBtn.classList.toggle('is-live', on);
      liveBtn.setAttribute('aria-pressed', String(on));
      liveBtn.querySelector('.canvas-live-label')!.textContent = on ? 'Live' : 'Go live';
    };
    liveBtn.addEventListener('click', async () => {
      if (runtime.isLive()) { runtime.stopLive(); setLiveUi(false); announce('Live camera stopped'); return; }
      liveBtn.disabled = true;
      try {
        await runtime.startLive();
        setLiveUi(true);
        announce('Live camera started — the canvas now reacts to your camera');
      } catch (e) {
        announce(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Camera permission was declined.' : 'Couldn’t start the camera.', { assertive: true });
        host.log('warn', 'startLive failed', { error: String(e) });
      } finally {
        liveBtn.disabled = false;
      }
    });
  }

  // Canvas-layout file utilities (render.layout:"canvas"): the whole canvas IS
  // the file control — drag-and-drop or click anywhere to pick. The picked file
  // still flows through the normal input model + exportFile hook, so CLI/URL mode
  // are unaffected; only the presentation moves from the sidebar onto the canvas.
  if (canvasLayout && canvasFileInput && contentEl) {
    setupCanvasFileDrop({ viewEl, contentEl, runtime, history: inputHistory, input: canvasFileInput, onDirty: markUserDirty });
  }
  if (canvasDropInput && contentEl) {
    setupCanvasBlocksDrop({ viewEl, contentEl, runtime, history: inputHistory, host, input: canvasDropInput, onDirty: markUserDirty });
  }

  // Canvas tools can also expose interactive SETTINGS in the template (e.g. a
  // compression level) as ordinary declared inputs. The sidebar — which normally
  // binds inputs to the model — is hidden in canvas layout, so wire any in-canvas
  // control carrying [data-input-id] straight back to runtime.setInput. The values
  // are declared inputs, so URL/CLI parity is automatic (syncUrl writes the dirty
  // param). Bind 'change' (not 'input') so the per-render innerHTML rebuild doesn't
  // fight focus mid-interaction; the template reflects each value so a repaint keeps it.
  if (canvasLayout && contentEl) {
    contentEl.addEventListener('change', (e) => {
      const ctl = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-input-id]') : null;
      if (!ctl) return;
      const id = ctl.dataset.inputId;
      if (!id) return;
      if (!(ctl instanceof HTMLInputElement || ctl instanceof HTMLSelectElement || ctl instanceof HTMLTextAreaElement)) return;
      const value = ctl instanceof HTMLInputElement && ctl.type === 'checkbox' ? ctl.checked
        : ctl instanceof HTMLInputElement && ctl.type === 'number' ? Number(ctl.value)
          : ctl.value;
      void inputHistory.set(id, value);
      markUserDirty(id);
    });
  }

  viewEl.querySelector('#clear-inputs-btn')?.addEventListener('click', () => {
    showClearDialog(() => void (async () => {
      urlSync.clearDirty();
      markSessionDirty();   // clearing is an edit — flag unsaved + flash the Save pill
      for (const input of runtime.getModel()) {
        // Revoke a picked file's preview URL before clearing it (avoid a leak).
        const fileUrl = input.type === 'file' && input.value && typeof input.value === 'object' && 'url' in input.value ? input.value.url : null;
        if (typeof fileUrl === 'string' && fileUrl) URL.revokeObjectURL(fileUrl);
        const blank = input.type === 'boolean' ? false
          : input.type === 'asset' ? null
          : input.type === 'file' ? null
          : input.type === 'blocks' ? []
          : (input.default ?? '');
        await inputHistory.set(input.id, blank);
      }
    })());
  });
}
