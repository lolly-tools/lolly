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

import { loadTool, createRuntime, parseUrlState, serializeUrlState, annotateTemplate, UNITS, toCssPx, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION, buildEmbedUrl, parseToolUrl, isTokenValue, packQuery, expandQuery, hasPackedState, isPackAvailable, PACK_PARAM } from '@lolly/engine';

// Above this readable-query length the address bar and the Share dialog switch to
// the packed `z=` form (when it's actually shorter). Kept well under the ~2000-char
// ceiling that pasted links, social crawlers and some servers still enforce, while
// leaving simple/typical links in their hand-editable readable form.
const AUTO_PACK_MIN = 1800;
import { escape } from '../utils.js';
import { navigateTo } from '../nav.js';
import { toolSupport, capabilityLabel, CAPTURE_EXTENSION_URL } from '../capabilities.js';
import { announce } from '../a11y.js';
import { PALETTE } from '../palette.js';
import { colorFieldHtml, wireColorField, setSwatches } from '../components/color-field.js';
import { helpTip, wireHelpTips, linkHelpDescriptions } from '../components/help-tip.js';
import { showScrubReadout, hideScrubReadout } from '../components/scrub-readout.js';
import { createThemeToggle } from '../components/theme-toggle.js';
import { canSkipInputsRebuild } from './inputs-sync.js';
import {
  nestingActive, nestingConfig, deriveBlockKeys, blockParentIndex,
  blockTreeOrder, blockReparentMove, buildRefOptions, materializeRefTarget,
} from './block-tree.js';
import { exportSizeDriver, aspectWarning } from './export-size.js';
import { bumpMetric, recordFormat } from '../metrics.js';
import { videoSupport, cmykTiffSupport } from '../bridge/export.js';
import { neutralizeEmbeds, hydrateEmbeds } from '../bridge/embed.js';
import { getTool } from '../bridge/tool-loader.js';
import { openShareDialog } from '../components/share-dialog.js';
import { storeUserUpload } from './picker.js';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

// Human-readable labels and file extensions for format identifiers that differ
// from their raw string (e.g. "pdf-cmyk" → "Print PDF" / ".pdf").
const FMT_LABEL = { 'pdf-cmyk': 'Print PDF', 'cmyk-tiff': 'Print TIFF', 'jpeg': 'JPG', 'webm': 'WebM', 'mp4': 'MP4', apng: 'Animated PNG',
  emf: 'EMF (old)', eps: 'EPS', 'eps-cmyk': 'EPS (CMYK)', ics: 'Calendar', vcf: 'vCard', ico: 'Icon', zip: 'ZIP', csv: 'CSV', json: 'JSON' };
const FMT_EXT   = { 'pdf-cmyk': 'pdf', 'cmyk-tiff': 'tiff', 'jpeg': 'jpg', 'eps-cmyk': 'eps' };

// Print marks & bleed apply to the three print formats (pdf / pdf-cmyk / cmyk-tiff).
// Defaults when the user turns the card on; the CSV tokens (crop,reg,bleed,bars)
// match the engine's `marks` URL param (engine/src/url-mode.js parseMarks). Bleed is
// carried as a dimension string. The Color profile (press condition) card applies to
// the two CMYK formats.
const DEFAULT_PRINT_MARKS = { crop: true, registration: true, bleed: true, colorBars: false, provenance: true };
const isCmykFmt  = (f) => f === 'pdf-cmyk' || f === 'cmyk-tiff';
const isPrintFmt = (f) => f === 'pdf' || f === 'pdf-cmyk' || f === 'cmyk-tiff';
function marksToCsv(m) {
  return m ? [m.crop && 'crop', m.registration && 'reg', m.bleed && 'bleed', m.colorBars && 'bars', m.provenance && 'prov'].filter(Boolean).join(',') : '';
}
function marksFromCsv(csv) {
  if (!csv) return null;
  const s = new Set(String(csv).split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
  return { crop: s.has('crop'), registration: s.has('reg') || s.has('registration'), bleed: s.has('bleed'), colorBars: s.has('bars') || s.has('colorbars'), provenance: s.has('prov') || s.has('provenance') };
}
// Read the Print marks card from an export-panel element `el` (empty when off).
const printEnabled  = (el) => Boolean(el?.querySelector('[data-action="print-enable"]')?.checked);
function readBleed(el) {
  if (!printEnabled(el)) return '';
  const mm = parseFloat(el.querySelector('[data-action="print-bleed"]')?.value);
  return mm > 0 ? `${mm}mm` : '';
}
function readMarks(el) {
  if (!printEnabled(el)) return '';
  return marksToCsv({
    crop:         el.querySelector('[data-action="mark-crop"]')?.checked,
    registration: el.querySelector('[data-action="mark-reg"]')?.checked,
    bleed:        el.querySelector('[data-action="mark-bleed"]')?.checked,
    colorBars:    el.querySelector('[data-action="mark-bars"]')?.checked,
    provenance:   el.querySelector('[data-action="mark-prov"]')?.checked,
  });
}

// Visual formats a ZIP export bundles (data/text and video are excluded). The
// shell passes these as opts.bundleFormats; the export bridge renders each and
// archives them (see renderZip).
const ZIP_BUNDLE = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg', 'emf', 'eps', 'eps-cmyk', 'pdf', 'pdf-cmyk', 'cmyk-tiff', 'gif', 'apng', 'ico']);

// Which video containers this browser's MediaRecorder can actually record.
// Safari/iOS = mp4 only; Firefox = webm only; recent Chrome = both. Used to gate
// the video format options so users only ever see what their browser can produce.
const VIDEO = videoSupport();
// Print TIFF is desktop-only with working canvas readback (see cmykTiffSupport);
// hide it everywhere it can't be produced or cleanly downloaded.
const CMYK_TIFF_OK = cmykTiffSupport();
const keepFormat = (f) =>
  f === 'webm' ? VIDEO.webm
  : f === 'mp4' ? VIDEO.mp4
  : f === 'cmyk-tiff' ? CMYK_TIFF_OK
  : true;

const fmtLabel = (f) => FMT_LABEL[f] ?? f.toUpperCase();

// Download extension follows the produced Blob — a deep-linked video request may
// fall back to the other container, so trust the Blob's MIME over the format id.
function extFor(fmt, blob) {
  const t = blob?.type || '';
  if (t.includes('mp4'))  return 'mp4';
  if (t.includes('webm')) return 'webm';
  return FMT_EXT[fmt] ?? fmt;
}

// Set to true while a custom slider is being dragged so renderInputs
// doesn't rebuild the sidebar (killing pointer capture mid-drag).
// The canvas still updates live via contentEl.innerHTML in the subscriber.
let _sliderDragging = false;

// Active block drag-reorder gesture: { inputId, from } while a block's header is
// being dragged to a new position. Module-scoped so it survives the closure of a
// single renderInputs pass (the panel only rebuilds on drop).
let _blockDrag = null;

// Undo/redo glyphs for the history toast (Lucide undo-2 / redo-2). App chrome,
// not exported, so currentColor is safe here (unlike tool-template SVGs).
const ICON_UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></svg>';
const ICON_REDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/></svg>';

export async function mountTool(viewEl, host, toolId, urlParams) {
  // If the catalog is loaded, do a fast existence check before fetching anything.
  const catalog = window.__toolIndex;
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

  let tool;
  try {
    tool = await loadTool(toolId, fetchFile);
    clearTimeout(loadingTimer);
  } catch (e) {
    clearTimeout(loadingTimer);
    if (e.message === 'tool-not-found') {
      mount404(viewEl, toolId);
      return;
    }
    const errs = e.validationErrors?.length
      ? `<ul class="error-list">${e.validationErrors.map(ve =>
          `<li><code>${escape(ve.path)}</code> — ${escape(ve.message)}</li>`
        ).join('')}</ul>`
      : '';
    viewEl.innerHTML = `<div class="error"><strong>${escape(e.message)}</strong>${errs}</div>`;
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
      setSwatches(swatches.map(s => ({ value: s.value, label: s.name, group: s.group, ref: s.ref })));
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
  urlParams = await expandQuery(urlParams);

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

  let initialValues = values;
  if (slot) {
    const saved = await host.state.load(slot);
    if (saved) initialValues = { ...saved, ...values };
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
  let fileIntoFolder = null;
  if (!slot) {
    try {
      const into = sessionStorage.getItem('lolly:fileInto');
      if (into !== null) fileIntoFolder = into || null;
    } catch (e) { /* sessionStorage unavailable (private mode) */ }
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
  } catch (e) { /* sessionStorage unavailable (private mode) */ }

  // The back link follows that same marker: a tool launched from a folder reads "Back"
  // and returns to the folder; from the gallery it reads "Tools" and returns there. This
  // keeps the editing session a round-trip — add/resume a tool in a folder, then step
  // straight back into it — instead of dumping the user in the gallery.
  const fromFolder = returnTo !== '/';
  const backHref = fromFolder ? returnTo : '/';
  const backLabel = fromFolder ? 'Back' : 'Tools';

  // Populate inputs from user profile if they match profile field names
  const profile = await host.profile.get();
  const profileInputIds = (tool.manifest.inputs ?? []).map(i => i.id);
  for (const inputId of profileInputIds) {
    if (inputId in profile && !(inputId in initialValues)) {
      initialValues[inputId] = profile[inputId];
    }
  }

  const runtime = await createRuntime(tool, host, initialValues);

  // ── Undo / redo (Cmd+Z / Cmd+Shift+Z / Cmd+Y) ──────────────────────────────
  // Lets an accidental slider nudge — or any control edit — be reverted. There's
  // no shell-level chokepoint for edits: every control calls runtime.setInput
  // directly, so we wrap it once here to record before/after values. A slider
  // drag fires 'input' on every pixel, so rapid same-input changes coalesce (by
  // id + time) into a single step — one gesture, one undo. Restoring just replays
  // setInput, so the existing subscriber refreshes the sidebar + canvas for free
  // and the onInput hook re-derives any computed inputs (we never store those).
  const HISTORY_LIMIT = 100;
  const COALESCE_MS = 500;
  const undoStack = [];   // { id, label, before, after }
  const redoStack = [];
  let applyingHistory = false;
  let historyControls = null;   // header ↶/↷ buttons (set once the header mounts)
  let historyToastEl = null, historyToastTimer = 0;
  // Gesture continuity for coalescing, tracked SEPARATELY from stack entries: an
  // undo/redo leaves an old entry on top still carrying its original time, so if we
  // keyed coalescing off the entry the next edit could wrongly merge into it (losing
  // a state). applyHistory resets this, so a post-undo edit always starts fresh.
  let lastRecordId = null, lastRecordTime = 0;
  const refreshHistoryUI = () => historyControls?.sync(undoStack.length > 0, redoStack.length > 0);

  const cloneValue = v => { try { return structuredClone(v); } catch { return v; } };
  const sameValue = (a, b) => {
    if (a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  };
  // A value carrying raw file bytes / a blob: URL (a file input, or a `blocks` array
  // with an embedded image). We DON'T record these: the source blob URL is revoked
  // when the input is replaced/cleared, so a restored ref would point at a dead URL
  // (broken preview), and deep-cloning megabytes per history entry is wasteful.
  const carriesBytes = v => {
    if (!v || typeof v !== 'object') return false;
    if (v.bytes instanceof Uint8Array || v.bytes instanceof ArrayBuffer) return true;
    if (typeof v.url === 'string' && v.url.startsWith('blob:')) return true;
    return (Array.isArray(v) ? v : Object.values(v)).some(carriesBytes);
  };

  const baseSetInput = runtime.setInput.bind(runtime);
  // Expose the UNWRAPPED setter on the runtime so other scopes (notably renderActions'
  // programmatic width/height px-sync) can set inputs without the change landing in the
  // undo history. baseSetInput itself is local to mountTool; this is the shared handle.
  runtime.setInputNoHistory = baseSetInput;
  runtime.setInput = (id, value) => {
    if (!applyingHistory) {
      const cur = runtime.getModel().find(i => i.id === id);
      if (cur && !sameValue(cur.value, value) && !carriesBytes(value) && !carriesBytes(cur.value)) {
        const now = Date.now();
        const last = undoStack[undoStack.length - 1];
        if (last && lastRecordId === id && now - lastRecordTime < COALESCE_MS) {
          last.after = cloneValue(value);   // extend the gesture, keep its original `before`
        } else {
          // `label` (the input's human name) is what the toast shows on undo/redo.
          undoStack.push({ id, label: cur.label || cur.id, before: cloneValue(cur.value), after: cloneValue(value) });
          if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        }
        lastRecordId = id; lastRecordTime = now;
        redoStack.length = 0;   // a fresh edit breaks the redo chain
        historyToastEl?.classList.remove('is-visible');   // dismiss a now-stale undo/redo toast
        refreshHistoryUI();
      }
    }
    return baseSetInput(id, value);
  };

  const applyHistory = (id, value) => {
    applyingHistory = true;
    lastRecordId = null;   // an undo/redo ends any gesture — the next edit starts a new step
    try { runtime.setInput(id, cloneValue(value)); }
    finally { applyingHistory = false; }
  };
  const undoHistory = () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) { showHistoryToast({ empty: 'undo' }); return; }
    undoStack.pop();
    redoStack.push(entry);
    applyHistory(entry.id, entry.before);
    showHistoryToast({ kind: 'undo', label: entry.label });
    refreshHistoryUI();
  };
  const redoHistory = () => {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) { showHistoryToast({ empty: 'redo' }); return; }
    redoStack.pop();
    undoStack.push(entry);
    applyHistory(entry.id, entry.after);
    showHistoryToast({ kind: 'redo', label: entry.label });
    refreshHistoryUI();
  };

  // Transient bottom-centre toast confirming what was undone/redone, with a
  // one-tap counter-action (Redo after an undo, and vice-versa) — that button
  // doubles as the redo path on touch, where there's no keyboard. Reuses
  // announce() for the screen-reader side (the toast itself is aria-hidden to
  // avoid a double read). A single reused element; the timer resets on each call.
  const showHistoryToast = ({ kind, label, empty }) => {
    if (!historyToastEl) {
      historyToastEl = document.createElement('div');
      historyToastEl.className = 'toast';
      historyToastEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(historyToastEl);
    }
    const el = historyToastEl;
    const wasVisible = el.classList.contains('is-visible');
    clearTimeout(historyToastTimer);
    if (empty) {
      el.classList.add('is-muted');
      el.innerHTML = `<span class="toast-message">Nothing to ${empty}</span>`;
      announce(`Nothing to ${empty}`);
    } else {
      el.classList.remove('is-muted');
      const verb = kind === 'undo' ? 'Undid' : 'Redid';
      const counter = kind === 'undo' ? 'Redo' : 'Undo';
      el.innerHTML =
        `<span class="toast-icon" aria-hidden="true">${kind === 'undo' ? ICON_UNDO : ICON_REDO}</span>` +
        `<span class="toast-message">${verb}<span class="toast-label"> ${escape(String(label))}</span></span>` +
        // tabindex=-1: the toast is aria-hidden (announce() drives SR) so this button
        // must not become a phantom tab stop; it stays pointer-clickable for touch/mouse.
        `<button type="button" class="toast-action" tabindex="-1">${counter}</button>`;
      el.querySelector('.toast-action').addEventListener('click', () => {
        kind === 'undo' ? redoHistory() : undoHistory();
      });
      announce(`${verb} ${label}`);
    }
    // Animate the slide-in only when coming from hidden; if it's already showing
    // (rapid undo/redo), just swap the content and reset the timer — no flicker.
    if (!wasVisible) void el.offsetWidth;   // flush the base state so the transition plays
    el.classList.add('is-visible');
    historyToastTimer = setTimeout(() => el.classList.remove('is-visible'), empty ? 1400 : 2200);
  };

  const onHistoryKey = e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const redo = k === 'y' || (k === 'z' && e.shiftKey);
    const undo = k === 'z' && !e.shiftKey;
    if (!undo && !redo) return;
    // Free-text fields keep their own per-character undo; sliders, selects,
    // colours and checkboxes have no useful native undo, so we own those.
    if (isTextEditing()) return;
    e.preventDefault();
    redo ? redoHistory() : undoHistory();
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
    : null;
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
    ? tool.manifest.inputs?.find(i => i.type === 'blocks' && i.dropToAdd?.field
        && (i.fields ?? []).some(f => f.id === i.dropToAdd.field && f.type === 'asset'))
    : null;

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
  const dropped = runtime.droppedAssets ?? [];
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

  const layout    = viewEl.querySelector('#tool-layout');
  const inputsEl  = viewEl.querySelector('#tool-inputs');
  const canvasEl  = hideSidebar ? null : viewEl.querySelector('#tool-canvas');
  const outerEl   = hideSidebar ? null : viewEl.querySelector('#tool-canvas-outer');
  const contentEl = hideSidebar ? viewEl.querySelector('#tool-content') : canvasEl;
  const stageEl   = viewEl.querySelector('#tool-stage');

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
    const mkBtn = (label, icon, onClick) => {
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
  let shutterEl = null;
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
  const actionsEl  = viewEl.querySelector('#tool-actions');
  const sidebarEl  = viewEl.querySelector('#tool-sidebar');

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const fullscreenToggle      = viewEl.querySelector('#fullscreen-toggle');
  const fullscreenToggleFloat = viewEl.querySelector('#fullscreen-toggle-float');
  const dragHandle            = viewEl.querySelector('#sidebar-drag-handle');
  const sheetGrip             = viewEl.querySelector('#sheet-grip');

  function setSidebarWidth(w, save = true) {
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
    if (save) localStorage.setItem('sidebarWidth', snapped);
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

  function updateFullParam(shouldBeFull) {
    const sp = new URLSearchParams(currentQuery());
    if (shouldBeFull) sp.set('full', ''); else sp.delete('full');
    const parts = [];
    for (const [k, v] of sp.entries()) parts.push(v ? `${k}=${encodeURIComponent(v)}` : k);
    const q = parts.join('&');
    history.replaceState(null, '', q ? `${TOOL_URL_BASE}?${q}` : TOOL_URL_BASE);
  }

  // Canvas pan/zoom handle for the stage, assigned once the canvas is wired
  // (see setupStageNav below). Reset whenever the stage is resized by a
  // sidebar toggle so the preview returns to a clean fit.
  let stageZoom = null;

  if (showAside) {
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
  if (!hideSidebar && sheetGrip) {
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
  let exportTeardown = null;
  // The "Save" half of the render pill — assigned just below, but declared out here
  // so the dirty-state helpers (markSessionDirty / markSessionSaved, defined later)
  // can flash and clear it from the input-change chokepoint.
  let renderSaveBtn   = null;
  const renderPill    = viewEl.querySelector('#render-pill');
  const renderFab     = viewEl.querySelector('#render-fab');   // the "Export" half (opens export)
  renderSaveBtn       = viewEl.querySelector('#render-save');  // the "Save" half (outer-scoped)
  const exportOverlay = viewEl.querySelector('#export-overlay');
  const exportBody    = viewEl.querySelector('#export-popup-body');
  if (!hideSidebar && renderFab && exportOverlay && exportBody && actionsEl) {
    const mqMobile    = window.matchMedia('(max-width: 640px)');
    const exportPopup = exportOverlay.querySelector('.export-popup');
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
        if (child !== exportOverlay) child.inert = modal;   // pointer + Tab blocked behind the sheet
      }
      exportPopup.setAttribute('aria-modal', modal ? 'true' : 'false');
    };
    const closeExport = () => {
      layout.classList.remove('export-open');
      renderFab.setAttribute('aria-expanded', 'false');
      applyModality();                 // un-inert before returning focus to the trigger
      renderFab.focus(); // return focus to the trigger (it reappears on close)
    };
    const openExport = ({ focus = true } = {}) => {
      layout.classList.add('export-open');
      renderFab.setAttribute('aria-expanded', 'true');
      applyModality();
      // Move focus into the dialog (its close button) for keyboard/SR users — but
      // not when auto-opened from ?options on load, where grabbing focus is jarring.
      if (focus) exportOverlay.querySelector('.export-popup-close')?.focus();
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
    const onExportKey = (e) => {
      if (!layout.classList.contains('export-open')) return;
      if (e.key === 'Escape') { closeExport(); return; }
      if (e.key !== 'Tab' || !isModal()) return;   // only trap Tab in the modal (mobile) sheet
      const focusables = [...exportOverlay.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(el => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
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
    const popupStart = e => {
      pdrag = mqMobile.matches && e.touches.length === 1;
      // Never engage the flick-to-dismiss when the touch lands on a scrubbable
      // control — the export-size fields own the full horizontal drag of their
      // value, so a diagonal scrub must not also drag the sheet down.
      if (pdrag && e.target.closest?.('[data-scrub]')) pdrag = false;
      if (pdrag && exportBody.contains(e.target) && exportBody.scrollTop > 0) pdrag = false;
      if (!pdrag) return;
      py = e.touches[0].clientY;
      pt = e.timeStamp;
    };
    const popupMove = e => {
      if (!pdrag) return;
      const dy = e.touches[0].clientY - py;
      if (dy <= 0) { exportPopup.style.transform = ''; return; } // upward → ignore
      e.preventDefault();                       // claim the gesture from scroll
      exportPopup.classList.add('is-popup-dragging');
      exportPopup.style.transform = `translateY(${dy}px)`;
    };
    const popupEnd = e => {
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
    lottieModule?.destroyLottiePlayers(); // else animationManager ticks detached trees
    styleEl.remove(); shutterEl?.remove(); ro.disconnect(); stageZoom?.destroy(); exportTeardown?.();
    window.removeEventListener('keydown', onHistoryKey);
    clearTimeout(historyToastTimer); historyToastEl?.remove();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    // Document-level capture listeners added per renderInputs — drop them so a
    // detached sidebar tree isn't pinned alive across tool navigation.
    if (inputsEl?._colorPopoverDismiss) document.removeEventListener('click', inputsEl._colorPopoverDismiss, true);
    if (inputsEl?._blockMenuDismiss)    document.removeEventListener('click', inputsEl._blockMenuDismiss, true);
    if (inputsEl?._helpTipDismiss)      document.removeEventListener('click', inputsEl._helpTipDismiss, true);
  };

  // Temporarily remove the CSS scale so dom-to-image sees native dimensions.
  // Also strips data-canvas-input attrs so they don't appear in exported files,
  // restoring them after so click-to-focus keeps working post-export.
  async function exportUnscaled(fn, { shutter = false } = {}) {
    // Renders are coalesced behind rAF (see the subscriber below); an export reads
    // the canvas DOM directly, so force any pending paint to land first — otherwise
    // we'd capture the frame before the latest keystroke.
    flushRender();
    // Embeds (lolly.tools/tool/… URLs) hydrate fire-and-forget on each render;
    // wait for the latest pass so export reads resolved blobs, not the placeholder.
    await embedsPending;
    // Same for lottie players — a first-paint/deep-link export must not capture
    // an unmounted [data-lottie-src] container.
    await lottiePending;
    const annotated = [...canvasEl.querySelectorAll('[data-canvas-input]')];
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
      saved.forEach(({ el, id }) => { if (el.isConnected) el.dataset.canvasInput = id; });
      if (shutter) openShutter();
    }
  }

  // ── Wire up ───────────────────────────────────────────────────────────────

  // A size-style select (its options carry width/height) sets the export size, so
  // the chosen badge/page size actually prints at that size. Seed the export-bar
  // defaults from the initially-selected option (URL / saved state still win).
  const sizeDriver = exportSizeDriver(tool.manifest);
  const sizeDims = sizeDriver
    ? sizeDriver.dims[runtime.getModel().find(i => i.id === sizeDriver.id)?.value]
    : null;

  const exportDefaults = {
    filename: urlFilename || initialValues.__export_filename,
    format:   urlFormat || initialValues.__export_format,
    width:    urlWidth  || Number(initialValues.__export_width)  || sizeDims?.width  || undefined,
    height:   urlHeight || Number(initialValues.__export_height) || sizeDims?.height || undefined,
    unit:     urlUnit || initialValues.__export_unit || sizeDims?.unit || 'px',
    dpi:      urlDpi || Number(initialValues.__export_dpi) || 300,
    profile:  urlProfile || initialValues.__export_profile || undefined,
    // Password comes from the URL only — never restored from saved state (we don't
    // persist passwords at rest in the library; see performSave's __export_* snapshot).
    password: urlPassword || undefined,
    // Print prep (pdf / pdf-cmyk / cmyk-tiff): bleed dimension string + a marks toggle map.
    // Present (from URL or saved state) ⇒ the Print marks card opens pre-filled.
    bleed:    urlBleed || initialValues.__export_bleed || undefined,
    marks:    urlMarks || marksFromCsv(initialValues.__export_marks),
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
  function markSessionDirty() {
    if (userHasMadeChanges) return;          // already dirty — keep the resting amber
    userHasMadeChanges = true;
    if (renderSaveBtn) {
      renderSaveBtn.classList.remove('is-unsaved');
      void renderSaveBtn.offsetWidth;        // force reflow so the flash animation restarts
      renderSaveBtn.classList.add('is-unsaved');
    }
  }
  function markSessionSaved() {
    userHasMadeChanges = false;
    renderSaveBtn?.classList.remove('is-unsaved');
  }
  // Seed from the params this mount was routed with (form-agnostic — works whether the
  // bar arrived as /t/<id>?… or #/tool/<id>?…) so shared/bookmarked links survive the
  // first subscribe callback.
  const dirtyParams = new Set(new URLSearchParams(urlParams || '').keys());
  // Monotonic guard shared by every address-bar writer (syncUrl AND shrinkUrl). It's
  // bumped on EVERY bar write, so any later write invalidates an in-flight async pack
  // — a stale pack from an earlier (larger) state can never clobber a newer bar. A
  // holder object (not a bare `let`) so the module-level shrinkUrl can share it.
  const barSeq = { v: 0 };

  function syncUrl(dirtyId) {
    if (dirtyId) dirtyParams.add(dirtyId);

    const params = new URLSearchParams();

    for (const entry of runtime.getModel()) {
      const { id, type, value } = entry;
      if (!dirtyParams.has(id)) continue;
      // A picked file is binary, in-memory, device-local content — it has no
      // shareable URL form. Never write it (would otherwise serialise to junk).
      if (type === 'file') continue;
      if (type === 'asset') {
        // Library assets are shareable by ID; user uploads are device-local.
        const assetId = value?.id;
        if (assetId && !assetId.startsWith('user/')) params.set(id, assetId);
        continue;
      }
      if (type === 'blocks') {
        if (Array.isArray(value) && value.length > 0) {
          const json = JSON.stringify(value);
          if (json.length <= 8000) params.set(id, json);
        }
        continue;
      }
      if (type === 'vector') {
        // One flat param per field: "<inputId>.<fieldId>" (e.g. transform.zoom=200).
        if (value && typeof value === 'object') {
          for (const f of entry.fields ?? []) {
            if (value[f.id] !== undefined && value[f.id] !== null) params.set(`${id}.${f.id}`, String(value[f.id]));
          }
        }
        continue;
      }
      if (value == null || value === '') continue;
      if (typeof value === 'boolean' && !value) continue;
      // A token-backed colour ({ ref, value }) serialises to its canonical token ref
      // (mirrors the engine's coerceToString) — never String()'d into the URL as
      // "[object Object]", which would then ride into a lolly-URL embed of this tool.
      const str = type === 'color' && isTokenValue(value) ? value.ref : String(value);
      if (str.length > 150) continue;
      params.set(id, str);
    }

    if (dirtyParams.has('w')) {
      const w = parseInt(actionsEl?.querySelector('[data-action="export-width"]')?.value, 10);
      if (w > 0) params.set('w', String(w));
    }
    if (dirtyParams.has('h')) {
      const h = parseInt(actionsEl?.querySelector('[data-action="export-height"]')?.value, 10);
      if (h > 0) params.set('h', String(h));
    }
    if (dirtyParams.has('unit')) {
      const u = actionsEl?.querySelector('[data-action="export-unit"]')?.value;
      if (u && u !== 'px') params.set('unit', u);
    }
    if (dirtyParams.has('dpi')) {
      const d = parseInt(actionsEl?.querySelector('[data-action="export-dpi"]')?.value, 10);
      const u = actionsEl?.querySelector('[data-action="export-unit"]')?.value;
      if (d > 0 && u && u !== 'px') params.set('dpi', String(d));
    }
    if (dirtyParams.has('format')) {
      const fmt = actionsEl?.querySelector('[data-action="format"]')?.value;
      if (fmt) params.set('format', fmt);
    }
    if (dirtyParams.has('filename')) {
      const filename = actionsEl?.querySelector('[data-action="filename"]')?.value?.trim();
      if (filename) params.set('filename', filename);
    }
    if (dirtyParams.has('profile')) {
      // Meaningful for the CMYK print formats (Print PDF / Print TIFF); share it only
      // when one is selected and it isn't the default condition (keeps links clean).
      const fmt = actionsEl?.querySelector('[data-action="format"]')?.value;
      const prof = actionsEl?.querySelector('[data-action="cmyk-profile"]')?.value;
      if (isCmykFmt(fmt) && prof && prof !== DEFAULT_CMYK_CONDITION) params.set('profile', prof);
    }
    if (dirtyParams.has('password')) {
      // Open-password for the standard PDF only; carried clear-text by design (a
      // basic lock for short-lived transactional material). Empty value → omitted.
      const fmt = actionsEl?.querySelector('[data-action="format"]')?.value;
      const pw = actionsEl?.querySelector('[data-action="pdf-password"]')?.value;
      if (fmt === 'pdf' && pw) params.set('password', pw);
    }
    if (dirtyParams.has('bleed') || dirtyParams.has('marks')) {
      // Print marks & bleed — print formats (pdf / pdf-cmyk / cmyk-tiff) only, and
      // only when the card is on.
      const fmt = actionsEl?.querySelector('[data-action="format"]')?.value;
      const on  = actionsEl?.querySelector('[data-action="print-enable"]')?.checked;
      if (isPrintFmt(fmt) && on) {
        const mm = parseFloat(actionsEl?.querySelector('[data-action="print-bleed"]')?.value);
        if (mm > 0) params.set('bleed', `${mm}mm`);
        const csv = marksToCsv({
          crop:         actionsEl?.querySelector('[data-action="mark-crop"]')?.checked,
          registration: actionsEl?.querySelector('[data-action="mark-reg"]')?.checked,
          bleed:        actionsEl?.querySelector('[data-action="mark-bleed"]')?.checked,
          colorBars:    actionsEl?.querySelector('[data-action="mark-bars"]')?.checked,
          provenance:   actionsEl?.querySelector('[data-action="mark-prov"]')?.checked,
        });
        if (csv) params.set('marks', csv);
      }
    }
    if (dirtyParams.has('nostage')) {
      // Full-page HTML export — a presence flag, written only while HTML is the
      // selected format and the toggle is on (so it drops off other formats).
      const fmt = actionsEl?.querySelector('[data-action="format"]')?.value;
      const on  = actionsEl?.querySelector('[data-action="full-page"]')?.checked;
      if (fmt === 'html' && on) params.set('nostage', '');
    }

    const qs = params.toString();
    // Bump the shared guard on EVERY write (not just when we pack) so a later,
    // possibly sub-threshold, syncUrl invalidates any pack still in flight from an
    // earlier large state — otherwise that stale pack could resolve afterward and
    // overwrite this bar with the old state.
    const seq = ++barSeq.v;
    history.replaceState(null, '', qs ? `${TOOL_URL_BASE}?${qs}` : TOOL_URL_BASE);

    // Auto-switch to the packed form once the readable query gets long enough to
    // risk the ~2000-char URL ceiling. The readable write above already landed, so
    // simple links stay readable/editable and only large states get compressed —
    // and only if packing is available AND genuinely shorter. Async + seq-guarded so
    // a slow pack from an older keystroke can never clobber a newer bar.
    if (qs.length >= AUTO_PACK_MIN && isPackAvailable()) {
      packQuery(qs).then(token => {
        if (token == null || seq !== barSeq.v) return;      // unavailable, or superseded
        const packed = `${PACK_PARAM}=${token}`;
        if (packed.length >= qs.length) return;             // packing didn't help — keep readable
        history.replaceState(null, '', `${TOOL_URL_BASE}?${packed}`);
      }).catch(() => { /* keep the readable URL already written */ });
    }
  }

  function markUserDirty(id) {
    markSessionDirty();   // sets userHasMadeChanges + flashes the Save pill on the first edit
    // Just record the param as dirty — the coalesced render's syncUrl() (folded
    // into the rAF below) writes the URL for every dirty param, so calling it here
    // too would replaceState twice per keystroke for no benefit.
    if (id) dirtyParams.add(id);
  }

  const actionsApi = renderActions(actionsEl, tool.manifest, runtime, canvasEl, host, resetView, exportUnscaled, exportDefaults, syncUrl, playShutter, fileIntoFolder, returnTo, slot);

  // Copy-URL now lives in the actions bar (renderActions), alongside the export
  // buttons — its format/filename/dimension inputs are in the same element.
  if (actionsEl) wireUpCopyUrl(actionsEl, runtime, actionsEl, tool.manifest);

  // The render pill's Save half: an in-place quick-save. It reuses the exact same
  // export-aware save routine as the popup's Save button (performSave), but unlike
  // that button it does NOT navigate away — it's a checkpoint affordance. performSave
  // leaves the button disabled with a "Saved" label for its own navigate-away caller,
  // so we restore it here and clear the unsaved cue, briefly holding "Saved" as
  // confirmation before reverting to "Save".
  if (renderSaveBtn && actionsApi?.save) {
    const saveLabel = renderSaveBtn.querySelector('[data-save-label]');
    renderSaveBtn.addEventListener('click', async () => {
      if (renderSaveBtn.dataset.saving) return;          // guard double-taps mid-save
      const ok = await actionsApi.save(renderSaveBtn);   // performSave handles the label/disabled swap
      if (!ok) return;                                   // failure path already reverted the button
      delete renderSaveBtn.dataset.saving;
      renderSaveBtn.disabled = false;
      markSessionSaved();                                // drop the amber unsaved cue
      renderSaveBtn.classList.add('is-just-saved');
      setTimeout(() => {
        if (saveLabel) saveLabel.textContent = 'Save';
        renderSaveBtn.classList.remove('is-just-saved');
      }, 1500);
    });
  }

  // Wire up the remaining sidebar utility buttons (Shrink URL, Clear changes).
  const sidebarUtilsEl = viewEl.querySelector('#sidebar-utils');
  if (sidebarUtilsEl) {
    sidebarUtilsEl.querySelector('#shrink-url-btn')?.addEventListener('click', function () {
      shrinkUrl(runtime, tool.manifest, barSeq);
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
    if (urlWidth > 0) canvasEl.style.width = urlWidth + 'px';
    if (urlHeight > 0) canvasEl.style.height = urlHeight + 'px';
    if (urlWidth > 0 || urlHeight > 0) resetView();
    // Resize the document: keep box coordinates fixed (they don't scatter), resize
    // the canvas, mirror it to the export dimensions so output matches, and re-fit.
    const setCanvasSize = (w, h, unit = 'px') => {
      // w/h are in `unit`; the artboard DOM is always px (a physical unit maps at the
      // 96-DPI CSS convention), while the export bar carries the physical size so the
      // output renders at the chosen DPI.
      const pxW = Math.round(unit === 'px' ? w : toCssPx({ value: w, unit }));
      const pxH = Math.round(unit === 'px' ? h : toCssPx({ value: h, unit }));
      canvasEl.style.width = pxW + 'px';
      canvasEl.style.height = pxH + 'px';
      actionsApi?.setDims?.({ width: w, height: h, unit });
      markUserDirty('w'); markUserDirty('h');
      resetView();
    };
    import('./free-canvas.js').then(({ initFreeCanvas }) => {
      if (!viewEl.isConnected) return;   // navigated away before the chunk loaded
      const fc = initFreeCanvas({
        viewEl, stageEl, canvasEl, outerEl, runtime, host,
        input: canvasEditInput, nativeW, nativeH,
        onDirty: markUserDirty,
        setCanvasSize,
        // Document-info panel: read/write the export/save name, plus at-a-glance
        // details. Name binds to the export bar's filename field (the canonical
        // save name); last-edited reads the resumed session's timestamp if any.
        info: {
          name: tool.manifest.name,
          version: tool.manifest.version,
          status: tool.manifest.status,
          formats: tool.manifest.render.formats,
          getFilename: () => viewEl.querySelector('[data-action="filename"]')?.value || '',
          setFilename: (v) => {
            const fn = viewEl.querySelector('[data-action="filename"]');
            if (fn) { fn.value = v; fn.dispatchEvent(new Event('input', { bubbles: true })); }
          },
          lastEdited: async () => {
            if (!slot) return null;
            try { return (await host.state.list()).find(s => s.slot === slot)?.updatedAt || null; }
            catch { return null; }
          },
        },
        // Picking a Lolly link / saved session for a box image opens its inputs
        // first (configure → insert), same as the sidebar asset slots. The picker
        // passes mode 'edit' when re-opening the box's current Lolly render.
        editTool: (toolUrl, mode = 'insert') => openEmbedEditor(host, { editUrl: toolUrl, slotLabel: 'image', mode }),
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
        const canSave = !!actionsEl?.querySelector('[data-action="save"]') && !!actionsApi?.save;
        showUnsavedDialog(
          canSave ? async () => { if (await actionsApi.save()) navigateTo(backHref); } : null,
          () => { navigateTo(backHref); },
        );
      });
    });
  }

  // Mark model inputs dirty the first time the user touches them.
  // The listener lives on the container so it survives renderInputs re-renders.
  ['change', 'input'].forEach(evt =>
    inputsEl?.addEventListener(evt, e => {
      const id = e.target.closest('[data-input-id]')?.dataset.inputId;
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
    if (!sel || sel.tagName !== 'SELECT' || sel.disabled) return;
    e.preventDefault(); // stop macOS popping the native menu on Arrow
    const opts = sel.options, dir = e.key === 'ArrowDown' ? 1 : -1;
    let next = sel.selectedIndex + dir;
    while (next >= 0 && next < opts.length && opts[next].disabled) next += dir; // skip disabled
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
    const target = e.target.closest('[data-canvas-input]');
    if (!target) return;
    const id = target.dataset.canvasInput;

    // Most ids map straight to a sidebar row. A "<blocksInputId>:<index>" id
    // (emitted per rendered block, e.g. data-canvas-input="blocks:0") points at
    // one block inside a blocks input — focus that block and fold the rest.
    let control = inputsEl.querySelector(`[data-input-id="${id}"]`);
    let blockIndex = null;
    const blockRef = !control && id.match(/^(.+):(\d+)$/);
    if (blockRef) {
      const blocksEl = inputsEl.querySelector(`.blocks-input[data-input-id="${blockRef[1]}"]`);
      if (blocksEl) { control = blocksEl; blockIndex = blockRef[2]; }
    }
    if (!control) return;

    const focus = () => {
      // Reveal the control if it lives inside a collapsed section (mirrors the
      // scrollToInput path), so the focused input is actually visible.
      control.closest('details.input-section')?.setAttribute('open', '');
      if (blockIndex != null) {
        focusSidebarBlock(control, blockIndex);
      } else {
        control.focus();              // lights the CSS :focus-within spotlight
        scrollToControl(control);     // header-aware, reduce-motion-safe, with arrival pulse
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
  async function runPreview() {
    const btn = contentEl.querySelector('[data-preview]');
    if (btn) {
      if (btn.dataset.busy) return;                  // re-entrancy guard
      btn.dataset.busy = '1';
      btn.dataset.idleLabel ??= btn.textContent.trim();
      btn.classList.remove('is-error');
      btn.classList.add('is-busy');
      btn.textContent = btn.dataset.busyLabel || 'Rendering…';
    }
    try {
      await actionsApi.preview();
      // Success: the hook painted the capture and hid the placeholder (button
      // included), so there's nothing to reset — it's gone from the DOM.
    } catch (err) {
      // Surface the failure in place; the placeholder stays so the user can retry.
      // The next input change rebuilds a fresh button with its idle label.
      const b = contentEl.querySelector('[data-preview]');
      if (b) {
        b.classList.remove('is-busy');
        b.classList.add('is-error');
        b.textContent = err?.message || 'Preview failed — tap to retry';
        delete b.dataset.busy;
      }
      throw err;
    }
  }
  if (previewCfg && canvasEl) {
    canvasEl.addEventListener('click', e => {
      if (!e.target.closest('[data-preview]')) return;
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
      const btn = e.target.closest('[data-export-file]');
      if (!btn || btn.dataset.busy) return;
      btn.dataset.busy = '1';
      btn.dataset.idleLabel ??= btn.textContent.trim();
      btn.classList.remove('is-error');
      btn.classList.add('is-busy');
      btn.textContent = btn.dataset.busyLabel || 'Working…';
      try {
        const { bytes, mime, filename } = await runtime.exportFile();
        const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
        await host.export.file(blob, { filename: filename || 'file' });
        btn.classList.remove('is-busy');
        btn.textContent = btn.dataset.idleLabel;
        delete btn.dataset.busy;
      } catch (err) {
        console.error('exportFile failed:', err);
        btn.classList.remove('is-busy');
        btn.classList.add('is-error');
        btn.textContent = err?.message || 'Export failed — try again';
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
  // The model the sidebar DOM was last built/synced against. syncInputs uses it to
  // skip the full panel rebuild on a keystroke when the edited field already shows
  // the new value (see syncInputs). Null until the first render.
  let prevInputsModel = null;
  // Track the size-driving select's value so a change pushes the option's physical
  // dimensions to the export bar (see exportSizeDriver / actionsApi.setDims).
  let lastDimsSizeVal = sizeDriver ? runtime.getModel().find(i => i.id === sizeDriver.id)?.value : null;

  // Inline canvas error, shown when a template script throws mid-render. Lives on
  // the stage as a sibling of the canvas, so the per-render innerHTML rebuild
  // doesn't wipe it; cleared on the next successful render.
  function showCanvasError() {
    const stage = stageEl || contentEl?.parentElement;
    if (!stage || stage.querySelector(':scope > .canvas-error')) return;
    const box = document.createElement('div');
    box.className = 'canvas-error';
    box.setAttribute('role', 'alert');
    box.textContent = "Couldn't render this preview — check your inputs.";
    stage.appendChild(box);
  }
  function clearCanvasError() {
    (stageEl || contentEl?.parentElement)?.querySelector(':scope > .canvas-error')?.remove();
  }

  let renderGen = 0;
  // Latest embed-hydration promise; exportUnscaled awaits it so an export reads
  // resolved blob URLs rather than the neutralised 1×1 placeholder.
  let embedsPending = Promise.resolve();
  // Latest lottie-mount pass (same contract); the module is loaded lazily the
  // first time a paint emits a [data-lottie-src] marker and kept for reaping.
  let lottiePending = Promise.resolve();
  let lottieModule = null;

  // The RENDER half of the subscriber is coalesced behind requestAnimationFrame:
  // a full canvas rebuild swaps innerHTML, re-walks annotations, and re-executes
  // every template <script> (chart/QR/map libs re-instantiate), so doing it per
  // keystroke is wasteful. We stash the latest emit and paint at most once per
  // frame — the sidebar sync (below) stays synchronous so typed values echo with
  // no lag. The trailing emit is always the one we paint, so the final keystroke
  // never gets dropped; flushRender() forces it out synchronously before exports.
  let rafId = 0;
  let pendingFrame = null;   // latest { model, hydrated } awaiting paint

  function paint() {
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
      contentEl.innerHTML = neutralizeEmbeds(hydrated);
      if (!hideSidebar) resolveCanvasAnnotations(contentEl);
      // Keep the canvas's accessible summary current when it's a live a11yLabel.
      if (tool.manifest.a11yLabel) contentEl.setAttribute('aria-label', canvasLabel());
      runTemplateScripts(contentEl);
      embedsPending = hydrateEmbeds(contentEl, { host, isCurrent: () => gen === renderGen });
      // Lottie markers are mounted by the shell, not the template (tools stay
      // data-only). Once the module has loaded, run the pass even on marker-less
      // paints so players orphaned by the innerHTML swap get reaped.
      if (lottieModule || contentEl.querySelector('[data-lottie-src]')) {
        lottiePending = (lottieModule
          ? Promise.resolve(lottieModule)
          : import('./lottie-mount.js').then(m => (lottieModule = m)))
          .then(m => m.mountLottiePlayers(contentEl, { isCurrent: () => gen === renderGen }))
          .catch(err => console.warn('lottie mount failed:', err));
      }
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
        const d = sizeDriver.dims[v];
        if (d) actionsApi?.setDims?.(d);
      }
    }

    if (pendingAutoExport) {
      pendingAutoExport = false;
      const fmt = urlFormat || tool.manifest.render.formats[0];
      waitForQuiescence(contentEl).then(() => {
        const name = urlFilename || tool.manifest.id;
        // Honour ?unit=/?dpi= so a deep link (or CLI) renders the right physical size.
        const u = urlUnit || 'px';
        const dim = (v, native) => (v > 0 ? (u !== 'px' ? `${v}${u}` : v) : native);
        const expOpts = { width: dim(urlWidth, nativeW), height: dim(urlHeight, nativeH) };
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
        exportUnscaled(() =>
          runtime.export(canvasEl, fmt, expOpts)
            .then(blob => host.export.download(blob, `${name}.${extFor(fmt, blob)}`))
            .catch(err => console.error('Auto-export failed:', err))
        );
      });
    }

    if (pendingAutoCopy) {
      pendingAutoCopy = false;
      waitForQuiescence(contentEl).then(() => armAutoCopy(actionsEl, actionsApi, urlFormat || undefined));
    }

    if (pendingAutoPreview) {
      pendingAutoPreview = false;
      waitForQuiescence(contentEl).then(() =>
        runPreview().catch(err => console.error('Auto-preview failed:', err))
      );
    }
  }

  // Paint any queued frame right now (cancelling the scheduled rAF). Used by
  // exportUnscaled so a capture reads the latest keystroke, and harmless if no
  // frame is pending.
  function flushRender() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; paint(); }
  }

  runtime.subscribe(({ model, hydrated }) => {
    // Sidebar sync is cheap and must stay responsive, so it runs synchronously on
    // every emit; only the expensive canvas rebuild is deferred to the next frame.
    if (inputsEl && !_sliderDragging) {
      prevInputsModel = syncInputs(inputsEl, model, prevInputsModel, runtime, host, markUserDirty);
    }
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
    const setLiveUi = (on) => {
      liveBtn.classList.toggle('is-live', on);
      liveBtn.setAttribute('aria-pressed', String(on));
      liveBtn.querySelector('.canvas-live-label').textContent = on ? 'Live' : 'Go live';
    };
    liveBtn.addEventListener('click', async () => {
      if (runtime.isLive()) { runtime.stopLive(); setLiveUi(false); announce('Live camera stopped'); return; }
      liveBtn.disabled = true;
      try {
        await runtime.startLive();
        setLiveUi(true);
        announce('Live camera started — the canvas now reacts to your camera');
      } catch (e) {
        announce(e?.name === 'NotAllowedError' ? 'Camera permission was declined.' : 'Couldn’t start the camera.', { assertive: true });
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
    setupCanvasFileDrop({ viewEl, contentEl, runtime, input: canvasFileInput, onDirty: markUserDirty });
  }
  if (canvasDropInput && contentEl) {
    setupCanvasBlocksDrop({ viewEl, contentEl, runtime, host, input: canvasDropInput, onDirty: markUserDirty });
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
      const ctl = e.target.closest('[data-input-id]');
      if (!ctl) return;
      const id = ctl.dataset.inputId;
      if (!id) return;
      const value = ctl.type === 'checkbox' ? ctl.checked
        : ctl.type === 'number' ? Number(ctl.value)
          : ctl.value;
      runtime.setInput(id, value);
      markUserDirty(id);
    });
  }

  viewEl.querySelector('#clear-inputs-btn')?.addEventListener('click', () => {
    showClearDialog(async () => {
      dirtyParams.clear();
      markSessionDirty();   // clearing is an edit — flag unsaved + flash the Save pill
      for (const input of runtime.getModel()) {
        // Revoke a picked file's preview URL before clearing it (avoid a leak).
        if (input.type === 'file' && input.value?.url) URL.revokeObjectURL(input.value.url);
        const blank = input.type === 'boolean' ? false
          : input.type === 'asset' ? null
          : input.type === 'file' ? null
          : input.type === 'blocks' ? []
          : (input.default ?? '');
        await runtime.setInput(input.id, blank);
      }
    });
  });
}

/**
 * Read a picked / dropped File into the in-memory FileRef the input model carries
 * (bytes + metadata). The bytes live only in memory and are never uploaded — the
 * url is a local object URL for previews. Shared by the sidebar file-picker and
 * the canvas drop zone so both produce an identical model value.
 */
async function fileToRef(file) {
  return {
    __file: true,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    bytes: new Uint8Array(await file.arrayBuffer()),
    url: URL.createObjectURL(file),
  };
}

/**
 * Canvas-as-drop-zone for render.layout:"canvas" file utilities. The whole canvas
 * accepts a drag-and-drop file; a click opens the native picker only via an explicit
 * [data-file-pick] affordance (the empty-state drop zone and the Replace button both
 * carry it). Listeners live on the stable contentEl container and a hidden <input>
 * parked in viewEl, so they survive the per-render innerHTML swaps of the canvas
 * content. The picked file is written straight into the normal input model — no
 * special-casing downstream.
 */
function setupCanvasFileDrop({ viewEl, contentEl, runtime, input, onDirty }) {
  const id = input.id;
  const accept = Array.isArray(input.accept) ? input.accept.join(',') : '';

  const native = document.createElement('input');
  native.type = 'file';
  if (accept) native.accept = accept;
  native.style.display = 'none';
  viewEl.appendChild(native);

  const revokePrev = () => {
    const prev = runtime.getModel().find(i => i.id === id)?.value;
    if (prev && prev.url) URL.revokeObjectURL(prev.url);
  };
  const load = async (file) => {
    if (!file) return;
    if (input.maxSize && file.size > input.maxSize) {
      announce(`That file is too large (max ${fmtBytes(input.maxSize)}).`, { assertive: true });
      return;
    }
    const ref = await fileToRef(file);
    revokePrev();
    runtime.setInput(id, ref);
    onDirty?.(id);
  };

  native.addEventListener('change', () => { load(native.files && native.files[0]); native.value = ''; });

  // Click to pick: only an explicit [data-file-pick] affordance opens the picker (the
  // empty-state drop zone and the Replace button both carry it). We deliberately do
  // NOT treat a click on bare canvas as a pick — the canvas is full-bleed, so the dead
  // space around the centred drop zone would swallow stray clicks (including near-misses
  // on the fixed "Tools" return button in the corner) and surprise the user with a file
  // dialog. Drag-and-drop still covers the whole canvas.
  contentEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-file-pick]')) native.click();
  });

  // Drag-and-drop over the whole canvas. A depth counter tracks enter/leave across
  // child nodes so the highlight doesn't flicker as the pointer crosses them.
  let depth = 0;
  const setDrag = (on) => contentEl.classList.toggle('is-file-dragover', on);
  contentEl.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; setDrag(true); });
  contentEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  contentEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (--depth <= 0) { depth = 0; setDrag(false); }
  });
  contentEl.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    setDrag(false);
    load(e.dataTransfer?.files && e.dataTransfer.files[0]);
  });
}

/**
 * Canvas-as-drop-zone for a sidebar tool that declares a `dropToAdd` blocks input
 * (e.g. logo-wall). The whole canvas — most usefully its empty state — accepts a
 * drag-and-drop of several files and appends one block per file, exactly like
 * dropping onto the sidebar list (shared committer + _dropChains serialisation), so
 * the template's "Drop your logos here" invite actually works and a populated wall
 * still grows by dropping more. A click on an explicit [data-file-pick] affordance
 * (the empty-state invite carries one) opens the multi-file native picker. Bare-canvas
 * clicks are left alone so the full-bleed dead space can't surprise the user with a
 * file dialog, and so per-cell click-to-focus (data-canvas-input) keeps working.
 * Listeners live on the stable contentEl, so they survive the per-render innerHTML
 * swaps of the canvas content.
 */
function setupCanvasBlocksDrop({ viewEl, contentEl, runtime, host, input, onDirty }) {
  const { accept, addFiles } = makeBlocksDropper({ runtime, host, input, onDirty });

  const native = document.createElement('input');
  native.type = 'file';
  native.multiple = true;
  if (accept) native.accept = accept;
  native.style.display = 'none';
  viewEl.appendChild(native);
  native.addEventListener('change', () => { addFiles(native.files); native.value = ''; });

  contentEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-file-pick]')) native.click();
  });
  contentEl.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-file-pick]')) {
      e.preventDefault();
      // Stop Space from also reaching setupStageNav's window-level keydown, which
      // would arm Space-to-pan; the file dialog steals focus before the keyup, so
      // it'd otherwise stay stuck on.
      e.stopPropagation();
      native.click();
    }
  });

  let depth = 0;
  const setDrag = (on) => contentEl.classList.toggle('is-file-dragover', on);
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  contentEl.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDrag(true); });
  contentEl.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  contentEl.addEventListener('dragleave', (e) => { e.preventDefault(); if (--depth <= 0) { depth = 0; setDrag(false); } });
  contentEl.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; setDrag(false); addFiles(e.dataTransfer?.files); });
}

/**
 * Touch pinch-to-zoom + pan for the canvas stage.
 *
 * The page's native pinch-zoom is disabled (viewport user-scalable=no) so the
 * sticky sidebar header can't be stranded off-screen on mobile. To compensate,
 * the canvas preview gets gesture zoom here. It applies a transform to the OUTER
 * wrapper — fitCanvas only ever touches the inner canvas's width/height/transform,
 * so the two layers compose cleanly (fit-to-screen, then pinch on top of that).
 *
 * Returns { reset } so callers can snap back to the fitted view.
 */
// Unified canvas navigation for the stage: pinch-zoom + drag-pan on touch, and
// trackpad-native zoom/pan (+ a Fit/% HUD and keyboard shortcuts) on desktop.
// One module so both pointer types share a single transform model and never drift.
// The transform sits on the OUTER wrapper, layered on top of the fitCanvas scale;
// `scale` is a multiplier where 1 == the fitted view ("Fit").
function setupStageNav(stageEl, outerEl, canvasEl, nativeW, onFit) {
  const MAX = 16;                 // multiplier on top of the fitted view (Fit = 1)
  const MIN_ABS = 0.2;            // zoom-out floor: 20% of native export pixels
  const PINCH_DEADZONE = 0.02;    // ignore <2% finger-spread wobble so a pan ≠ zoom
  let scale = 1, tx = 0, ty = 0;
  let originX = 0, originY = 0;   // outer's natural (untransformed) top-left, client coords
  const pts = new Map();          // pointerId -> { x, y }   (touch / pen)
  let pinchDist = 0;              // finger separation at the previous move
  let lastMid = null;             // previous pinch midpoint (client coords)
  let panPt = null;               // previous single-finger point (client coords)
  let lastTap = 0;
  let spaceDown = false;          // desktop: hold Space to drag-pan
  let mousePanPt = null;          // desktop: previous mouse point while panning

  // transform-origin must be the top-left for the focal-point math below to hold
  // (CSS defaults to centre). fitCanvas never sets a transform on the outer wrapper.
  outerEl.style.transformOrigin = '0 0';

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid  = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function apply() {
    outerEl.style.transform = (scale === 1 && tx === 0 && ty === 0)
      ? '' : `translate(${tx}px, ${ty}px) scale(${scale})`;
    syncHud();
  }

  // Recover the wrapper's natural top-left from its current rect + transform, so
  // the math works regardless of the flex centring that positions it in the stage.
  function captureOrigin() {
    const r = outerEl.getBoundingClientRect();
    originX = r.left - tx;
    originY = r.top  - ty;
  }

  // Keep the (scaled) content centre inside the stage so it can never be lost.
  function clampPan() {
    const sr = stageEl.getBoundingClientRect();
    const w  = outerEl.offsetWidth  * scale;
    const h  = outerEl.offsetHeight * scale;
    const cx = originX + tx + w / 2;
    const cy = originY + ty + h / 2;
    if (cx < sr.left)   tx += sr.left   - cx;
    if (cx > sr.right)  tx += sr.right  - cx;
    if (cy < sr.top)    ty += sr.top    - cy;
    if (cy > sr.bottom) ty += sr.bottom - cy;
  }

  // Zooming OUT past Fit is allowed down to an absolute floor of MIN_ABS (so
  // objects parked off the artboard stay reachable in editor tools) — or Fit
  // itself when a huge canvas already fits below that floor.
  function minScale() {
    const w = canvasEl ? canvasEl.getBoundingClientRect().width : 0;
    if (!(w > 0)) return 1;
    const fitAbs = (w / scale) / nativeW;   // absolute zoom the Fit view shows
    return Math.min(1, MIN_ABS / fitAbs);
  }

  function isZoomed() { return Math.abs(scale - 1) > 0.001 || tx !== 0 || ty !== 0; }
  function reset() { scale = 1; tx = 0; ty = 0; apply(); }
  // "Fit" = clear any zoom/pan, then recompute the fit for the current layout
  // (so it accounts for e.g. the mobile sheet's current coverage). reset() first
  // so isZoomed() is false and onFit's fitCanvas isn't skipped.
  function fit() { reset(); onFit?.(); }

  // Zoom by `factor`, keeping the client point (fx, fy) pinned under the cursor.
  function zoomAbout(factor, fx, fy) {
    captureOrigin();
    const next = Math.max(minScale(), Math.min(MAX, scale * factor));
    if (next === scale) return;
    const r = next / scale;
    const lx = fx - originX, ly = fy - originY;
    tx = lx - (lx - tx) * r;
    ty = ly - (ly - ty) * r;
    scale = next;
    clampPan();
    apply();
  }

  function stageCentre() {
    const sr = stageEl.getBoundingClientRect();
    return { x: (sr.left + sr.right) / 2, y: (sr.top + sr.bottom) / 2 };
  }

  // Effective on-screen size vs native export pixels — the figure the HUD shows.
  function pct() {
    const w = canvasEl ? canvasEl.getBoundingClientRect().width : 0;
    return w > 0 ? Math.round(w / nativeW * 100) : 100;
  }

  // Jump to true 100% (1 CSS px per export px) about the stage centre.
  function actual() {
    const w = canvasEl ? canvasEl.getBoundingClientRect().width : 0;
    if (!(w > 0)) return;
    const c = stageCentre();
    zoomAbout(nativeW / w, c.x, c.y);
  }

  // ── Touch / pen: pinch-zoom + drag-pan (mouse stays free for click-to-focus) ──
  stageEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    captureOrigin();
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinchDist = dist(a, b);
      lastMid   = mid(a, b);
      panPt     = null;
    } else if (pts.size === 1) {
      panPt = { x: e.clientX, y: e.clientY };
      if (e.timeStamp - lastTap < 300 && isZoomed()) { fit(); lastTap = 0; }  // double-tap → fit (sheet-aware)
      else lastTap = e.timeStamp;
    }
  });

  stageEl.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = dist(a, b);
      const m = mid(a, b);
      if (lastMid) { tx += m.x - lastMid.x; ty += m.y - lastMid.y; }  // two-finger pan
      // Pinch-zoom with a dead-zone: ignore small finger-spread wobble so a
      // two-finger PAN doesn't register as zoom. (Without this, every frame
      // applied a tiny zoom about the moving midpoint and the jitter compounded —
      // "zooms like crazy" — while also fighting the pan so it felt sluggish.)
      // Hold pinchDist as the reference until we actually zoom, so a slow,
      // deliberate pinch still accumulates past the threshold and applies smoothly.
      if (pinchDist > 0 && Math.abs(d / pinchDist - 1) > PINCH_DEADZONE) {
        const next = Math.max(minScale(), Math.min(MAX, scale * (d / pinchDist)));
        const r = next / scale;
        const fx = m.x - originX, fy = m.y - originY;
        tx = fx - (fx - tx) * r;   // zoom about the pinch midpoint
        ty = fy - (fy - ty) * r;
        scale = next;
        pinchDist = d;             // reset the reference only when we actually zoom
      }
      lastMid = m;
      clampPan();
      apply();
      e.preventDefault();
    } else if (pts.size === 1 && isZoomed() && panPt) {
      tx += e.clientX - panPt.x;
      ty += e.clientY - panPt.y;
      panPt = { x: e.clientX, y: e.clientY };
      clampPan();
      apply();
      e.preventDefault();
    }
  });

  const endTouch = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) { lastMid = null; pinchDist = 0; }
    if (pts.size === 1) {
      const [p] = [...pts.values()];
      panPt = { x: p.x, y: p.y };
    } else if (pts.size === 0) {
      panPt = null;
      // Settled back AT fit — clear the transform. (Not <=: zoomed OUT past fit
      // is a legitimate resting state now.)
      if (Math.abs(scale - 1) <= 0.001) reset();
    }
  };
  stageEl.addEventListener('pointerup', endTouch);
  stageEl.addEventListener('pointercancel', endTouch);

  // Suppress native scroll/zoom on the stage so the gestures above own the touch.
  // Scoped here (not in CSS) so scrollable no-canvas tools keep normal touch scroll.
  stageEl.style.touchAction = 'none';

  // ── Desktop: trackpad-native zoom/pan + a Fit/% HUD + keyboard shortcuts ──────
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  let hud = null, pctEl = null;

  function syncHud() {
    if (pctEl) pctEl.textContent = pct() + '%';
    if (hud)   hud.dataset.zoomed = isZoomed() ? '1' : '';
  }

  const onKeyDown = e => {
    if (e.code === 'Space' && !isTyping()) { spaceDown = true; stageEl.classList.add('is-grabbable'); return; }
    if (isTyping()) return;
    if (e.key === '0')                       fit();                                              // Fit
    else if (e.key === '1')                  actual();                                           // 100%
    else if (e.key === '+' || e.key === '=') { const c = stageCentre(); zoomAbout(1.25, c.x, c.y); }
    else if (e.key === '-' || e.key === '_') { const c = stageCentre(); zoomAbout(0.8,  c.x, c.y); }
    else return;
    e.preventDefault();
  };
  const onKeyUp = e => { if (e.code === 'Space') { spaceDown = false; stageEl.classList.remove('is-grabbable'); } };

  // Zoom HUD (−  [NN%]  +  Fit) — created for EVERY pointer type. On touch it's the
  // primary way to snap to exact zoom levels and Fit (a pinch is imprecise); on
  // desktop it complements the trackpad/keyboard. The desktop-only wheel, mouse-pan
  // and keyboard wiring stays gated behind !isTouch further below.
  hud = document.createElement('div');
  hud.className = 'stage-nav';
  hud.innerHTML =
    '<button type="button" class="stage-nav-btn" data-nav="out" aria-label="Zoom out">−</button>' +
    '<button type="button" class="stage-nav-pct" data-nav="pct" aria-label="Toggle Fit and 100%"><span class="stage-nav-pct-val">100%</span></button>' +
    '<button type="button" class="stage-nav-btn" data-nav="in" aria-label="Zoom in">+</button>' +
    '<button type="button" class="stage-nav-btn stage-nav-fit" data-nav="fit" aria-label="Fit to window">Fit</button>';
  stageEl.appendChild(hud);
  pctEl = hud.querySelector('.stage-nav-pct-val');
  // Keep taps on the pill from reaching the stage's pinch / double-tap-to-fit logic.
  hud.addEventListener('pointerdown', e => e.stopPropagation());
  hud.addEventListener('click', e => {
    const b = e.target.closest('[data-nav]');
    if (!b) return;
    const c = stageCentre();
    if (b.dataset.nav === 'in')       zoomAbout(1.25, c.x, c.y);
    else if (b.dataset.nav === 'out') zoomAbout(0.8,  c.x, c.y);
    else if (b.dataset.nav === 'fit') fit();
    else if (b.dataset.nav === 'pct') { isZoomed() ? fit() : actual(); }
  });

  if (!isTouch) {
    // Cmd/Ctrl-wheel (and trackpad pinch, which the browser delivers as ctrl+wheel)
    // zooms about the cursor; a plain wheel pans, but only once zoomed in (nothing
    // to pan at Fit). passive:false so we can preventDefault the page zoom/scroll.
    stageEl.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAbout(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
      } else if (isZoomed()) {
        e.preventDefault();
        captureOrigin();
        tx -= e.deltaX; ty -= e.deltaY;
        clampPan(); apply();
      }
    }, { passive: false });

    // Pan with middle-drag or Space+left-drag; plain left-clicks stay free so the
    // canvas click-to-focus behaviour keeps working.
    stageEl.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      if (!(e.button === 1 || (e.button === 0 && spaceDown))) return;
      e.preventDefault();
      stageEl.setPointerCapture(e.pointerId);
      mousePanPt = { x: e.clientX, y: e.clientY };
      stageEl.classList.add('is-grabbing');
    });
    stageEl.addEventListener('pointermove', e => {
      if (!mousePanPt || e.pointerType !== 'mouse') return;
      captureOrigin();
      tx += e.clientX - mousePanPt.x;
      ty += e.clientY - mousePanPt.y;
      mousePanPt = { x: e.clientX, y: e.clientY };
      clampPan(); apply();
    });
    const endMouse = () => {
      if (!mousePanPt) return;
      mousePanPt = null;
      stageEl.classList.remove('is-grabbing');
      if (!isZoomed()) reset();
    };
    stageEl.addEventListener('pointerup', endMouse);
    stageEl.addEventListener('pointercancel', endMouse);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  syncHud();

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    hud?.remove();
  }

  return { reset, isZoomed, sync: syncHud, destroy };
}

// True when focus is in a text field, so global canvas shortcuts don't hijack typing.
function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// True only when focus is in a genuinely text-editable field (so Cmd+Z falls
// through to the browser's per-character undo). Deliberately NARROWER than
// isTyping: a focused range slider / colour / checkbox / number IS an <input>
// but has no native undo, so our input-history undo should still fire there.
function isTextEditing() {
  const el = document.activeElement;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  return ['text', 'search', 'url', 'tel', 'email', 'password'].includes((el.type || 'text').toLowerCase());
}

// Mobile only: drive the top-anchored controls panel via the grip on its bottom
// edge. Dragging sets an inline --sheet-h on the layout (the panel height + grip
// position read it live); the preview is a static full-screen backdrop the panel
// slides over. Releasing snaps to the nearest of peek/half/full. A plain tap on the
// grip steps through the stops with a bounce (peek↔half↔full), so half — both the
// controls and the preview in view — is always one tap from either extreme.
// Optional `onChange` fires on each move/snap (unused while the preview is static).
// Classify a vertical swipe as a flick. A flick is either fast (high velocity)
// or a long, decisive drag; small/slow moves are taps or jitter. Returns
// 1 (down), -1 (up), or 0 (neither). Shared by the controls sheet and the
// export popup so both surfaces feel the same.
function flickDirection(dy, dt) {
  const FAST = 0.35; // px/ms — a quick flick
  const FAR  = 48;   // px — a slow but decisive drag still counts
  if (Math.abs(dy) < 18) return 0;
  const v = dt > 0 ? Math.abs(dy) / dt : Infinity;
  if (v < FAST && Math.abs(dy) < FAR) return 0;
  return dy > 0 ? 1 : -1;
}

function setupMobileSheet(layoutEl, sidebarEl, gripEl, onChange) {
  const SNAPS = ['peek', 'half', 'full'];
  const mq = window.matchMedia('(max-width: 640px)');
  let state = 'half';
  let dragging = false, moved = false, tapMode = false, tapDir = 1, startY = 0, startH = 0;

  const vh = () => window.innerHeight;
  // Peek = the sheet's minimized height, which must equal the real header height
  // so the whole header (centered Tools pill + title row) shows, not just row 1.
  // Measured from headerEl below (it varies — e.g. 44px tap targets on touch);
  // 56 is only the pre-measurement fallback.
  let PEEK = 56;

  function setState(s) {
    state = s;
    layoutEl.style.removeProperty('--sheet-h'); // drop any drag override; the per-state var animates in
    layoutEl.dataset.sheet = s;
    onChange?.(s);
  }

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    layoutEl.classList.remove('is-sheet-dragging');
    // We just dropped `transition: none` (used for 1:1 tracking). Flush layout so
    // the restored height/top transition is live at the CURRENT height before
    // setState changes it — otherwise the class-removal + height change batch into
    // one recalc and the snap jumps instead of animating.
    void sidebarEl.offsetHeight;
    if (!moved) {                                   // a press, not a drag
      if (tapMode) {
        // Tap walks the sheet through its stops with a bounce (peek↔half↔full),
        // reversing at the ends. So half — both the controls AND the preview
        // visible — is always one tap from either extreme, and you can always
        // recentre the divider after moving it; the sheet never jumps the full
        // span in a single tap.
        const idx = Math.max(0, SNAPS.indexOf(state));
        if (idx === 0) tapDir = 1;
        else if (idx === SNAPS.length - 1) tapDir = -1;
        setState(SNAPS[idx + tapDir]);
      } else {
        layoutEl.style.removeProperty('--sheet-h'); // header tap: no-op
      }
      return;
    }
    // Positional zones, no velocity: where the divider comes to rest decides the
    // dock. The screen splits into equal thirds and the divider's resting Y picks
    // the stop — release in the TOP third → dock to the top (peek, controls
    // minimised), the BOTTOM third → dock to the bottom (full, controls maximised),
    // the MIDDLE third → the 50/50 split (half). So a drag to the middle from
    // either extreme always lands on split, and a drag to the top stays at the top.
    const dividerY = sidebarEl.getBoundingClientRect().bottom; // grip rides the sheet's bottom edge
    const third = vh() / 3;
    if (dividerY < third)     return setState('peek');
    if (dividerY > third * 2) return setState('full');
    setState('half');
  };

  // Turn an element into a drag handle: the sheet follows the finger and snaps on
  // release. `tapToggles` gives the grip its tap-to-toggle; `guard` lets the
  // header ignore presses that land on a real control (its Tools link / toggle).
  function addDragHandle(handleEl, { tapToggles = false, guard = null } = {}) {
    handleEl.addEventListener('pointerdown', e => {
      if (!mq.matches || (guard && !guard(e))) return;
      dragging = true; moved = false; tapMode = tapToggles;
      startY = e.clientY;
      startH = sidebarEl.getBoundingClientRect().height;
      layoutEl.classList.add('is-sheet-dragging');
      handleEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handleEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      if (Math.abs(e.clientY - startY) > 4) moved = true;
      const h = Math.min(vh() * 0.92, Math.max(PEEK, startH + (e.clientY - startY))); // never below peek → grip stays visible
      layoutEl.style.setProperty('--sheet-h', h + 'px');
      onChange?.();
    });
    handleEl.addEventListener('pointerup', endDrag);
    handleEl.addEventListener('pointercancel', endDrag);
  }

  // The grip is the obvious handle; the header is the "wide blank area" the panel
  // wanted — grab anywhere on the title bar that isn't an actual control and drag
  // the sheet through its three stops.
  addDragHandle(gripEl, { tapToggles: true });
  const headerEl = sidebarEl.querySelector('.sidebar-header');
  if (headerEl) {
    addDragHandle(headerEl, {
      guard: e => !e.target.closest('a, button, input, select, textarea, label'),
    });
    // Drive the peek height from the header's real height so the minimized sheet
    // shows the full two-row header (pill + title). Header height is content-based
    // and effectively constant per device, so a one-time measure suffices; --peek-h
    // feeds the CSS peek/preview-top vars (see the mobile sheet block).
    const h = Math.ceil(headerEl.getBoundingClientRect().height);
    if (h > 0) { PEEK = h; layoutEl.style.setProperty('--peek-h', h + 'px'); }
  }

  // The body is for scrolling the controls — nothing else. It deliberately has NO
  // drag/flick handler: a touch that lands on the inputs (or the gaps between them)
  // must only ever scroll the list, never resize or dock the sheet. The grip and
  // the header are the sole handles, so scrolling the controls can't collapse the
  // split view out from under you. Resizing happens by dragging the grip/header.

  layoutEl.dataset.sheet = state; // define the var; only consumed under the mobile media query
}

function makeFetchFile(toolId) {
  return async (path) => {
    const resp = await fetch(`/tools/${path}`);
    if (resp.status === 404) throw new Error('tool-not-found');
    // SPA servers return index.html for unknown paths with a 200. Detect that.
    const ct = resp.headers.get('content-type') ?? '';
    // SPA fallback check — but skip for .html files since template.html legitimately returns text/html.
    if (!resp.ok || (ct.includes('text/html') && !path.endsWith('.html'))) throw new Error('tool-not-found');
    return await resp.text();
  };
}

function mount404(viewEl, toolId) {
  document.title = 'Not Found — Lolly';
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">404</p>
        <h1 class="not-found-title">Tool not found</h1>
        <p class="not-found-desc">There's no tool at <code>${escape(toolId)}</code>.</p>
        <a href="/" class="not-found-home">Browse all tools</a>
      </div>
    </div>
  `;
}

// Shown when a tool is opened in a shell that can't fulfil its capabilities
// (e.g. a 'capture' tool in the web PWA). Mirrors the 404 layout.
function mountUnavailable(viewEl, manifest, unmet) {
  document.title = `${manifest.name} — Desktop only`;
  const why = unmet.map(capabilityLabel).join(', ');
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">Desktop</p>
        <h1 class="not-found-title">${escape(manifest.name)} needs the desktop app</h1>
        <p class="not-found-desc">This tool uses <strong>${escape(why)}</strong>, which the web app can’t provide — a browser can’t screenshot cross-origin pages. Open it in the Lolly desktop app.</p>
        <a href="/" class="not-found-home">Browse all tools</a>
      </div>
    </div>
  `;
}

// Shown on a Chromium browser for a capture tool when the extension isn't
// installed — the tool CAN run here once the free extension is added.
function mountInstallPrompt(viewEl, manifest) {
  document.title = `${manifest.name} — Add the extension`;
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">Add&#8209;on</p>
        <h1 class="not-found-title">Enable ${escape(manifest.name)} in your browser</h1>
        <p class="not-found-desc">Add the free Lolly screenshot extension and this tool captures pages right here — no desktop app needed. Install it, then reload this page.</p>
        <a href="${escape(CAPTURE_EXTENSION_URL)}" class="not-found-home" target="_blank" rel="noopener">Get the extension</a>
        <a href="#/" class="not-found-back">Back to all tools</a>
      </div>
    </div>
  `;
}

// Arms the `?copy` URL action. Clipboard writes require a user gesture
// (navigator.clipboard.write rejects otherwise, and the image path would fall
// back to a surprise download), so we can't copy silently on load. Instead we
// highlight the Copy button and perform the copy on the user's first click —
// which carries the transient activation the clipboard API needs.
function armAutoCopy(actionsEl, actionsApi, fmt) {
  const copyBtn = actionsEl?.querySelector('[data-action="copy"]');
  if (!copyBtn || !actionsApi?.copy) {
    console.warn('[copy] ?copy requested but this tool has no copy action');
    return;
  }

  const disarm = () => {
    document.removeEventListener('pointerdown', onGesture, true);
    copyBtn.classList.remove('copy-armed');
  };

  const onGesture = (e) => {
    disarm();
    // If the click landed on the Copy button, its own handler runs the copy —
    // don't double up. Any other first interaction triggers it here.
    if (copyBtn.contains(e.target)) return;
    actionsApi.copy(fmt).catch(err => console.error('Auto-copy failed:', err));
  };

  document.addEventListener('pointerdown', onGesture, true);
  copyBtn.classList.add('copy-armed');
}

// Honour the OS "reduce motion" setting for the JS-driven scroll/reveal below.
// The global CSS reset zeroes CSS animations + scroll-behavior, but it can't reach
// an explicit JS scrollIntoView({behavior:'smooth'}) or a WAAPI tween — those have
// to be gated here.
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Bring a sidebar control into view and flash a one-shot "you are here" pulse on
// its row. The single entry point for every canvas-click and block-expand scroll,
// so arrival is consistent: top-aligned (clear of the sticky header via the row's
// scroll-margin), smooth unless reduce-motion. `control` may be the control itself
// or any node inside its row/block.
function scrollToControl(control, { pulse = true } = {}) {
  if (!control) return;
  const row = control.closest('.input-row, .block-item') || control;
  row.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  if (!pulse) return;
  row.classList.remove('is-target');
  void row.offsetWidth;                       // restart the keyframe if it's mid-flight
  row.classList.add('is-target');
  const done = () => row.classList.remove('is-target');
  row.addEventListener('animationend', done, { once: true });
  setTimeout(done, 700);                       // fallback if the keyframe is reduce-motion-zeroed
}

// Reveal a block's fields with a brief height tween when it expands. The resting
// collapsed state stays `display:none` (so folded fields keep out of the Tab order
// and the a11y tree) — only the open is animated, and only when motion is allowed.
function revealBlockFields(item) {
  if (prefersReducedMotion()) return;
  const fields = item.querySelector('.block-fields');
  if (!fields || typeof fields.animate !== 'function') return;
  fields.style.height = '0px';
  fields.style.overflow = 'hidden';
  const h = fields.scrollHeight;               // full content height even while clamped to 0
  if (!h) { fields.style.height = ''; fields.style.overflow = ''; return; }
  const anim = fields.animate(
    [{ height: '0px', opacity: 0.4 }, { height: `${h}px`, opacity: 1 }],
    { duration: 180, easing: 'ease' }
  );
  const clear = () => { fields.style.height = ''; fields.style.overflow = ''; };
  anim.onfinish = anim.oncancel = clear;
}

// Single seam for folding/unfolding a block: keeps the collapse class, the chevron
// button's aria-label/title, and the open animation in lockstep wherever a block is
// toggled (chevron, pill body, collapse-all, canvas click). renderInputs re-applies
// the collapse state across model rebuilds via the captured collapsedBlocks set.
function toggleBlock(item, collapsed) {
  if (item.classList.contains('is-collapsed') === collapsed) return;
  item.classList.toggle('is-collapsed', collapsed);
  const btn = item.querySelector('[data-block-collapse]');
  btn?.setAttribute('aria-label', collapsed ? 'Expand block' : 'Collapse block');
  btn?.setAttribute('title', collapsed ? 'Expand' : 'Collapse');
  if (!collapsed) revealBlockFields(item);
}

// Click-to-focus for a single block inside a blocks input: expand the target
// block and fold every other typed block to a pill, then drop the caret in its
// text field and scroll it into view. Folding mirrors the manual collapse
// toggle's button state so renderInputs re-applies it across model rebuilds.
// Triggered when a rendered canvas block is clicked — an "edit one at a time"
// focus mode. Blocks with no text field (headshot, blank) just expand + scroll.
function focusSidebarBlock(blocksEl, index) {
  const items = [...blocksEl.querySelectorAll('.block-item.is-typed')];
  const target = items.find(b => b.dataset.blockIndex === String(index));
  if (!target) return;

  for (const b of items) toggleBlock(b, b !== target);

  // Reveal the block if it sits inside a closed section, then bring it into view.
  target.closest('details.input-section')?.setAttribute('open', '');
  scrollToControl(target);

  const field = target.querySelector(
    '.block-fields textarea.block-field, .block-fields input.block-field:not([type="range"])'
  );
  if (field) {
    field.focus();
    const end = field.value?.length ?? 0;
    try { field.setSelectionRange(end, end); } catch { /* non-text field */ }
  }
}

/**
 * Reflect a model change in the sidebar with the least work. renderInputs()
 * rebuilds the whole panel's innerHTML and re-wires every listener (and
 * destroys/recreates each flatpickr) — necessary on first render or a structural
 * change, but pure waste on a keystroke, where the only change is a value the
 * edited field already shows. In that case (canSkipInputsRebuild) the rebuild is
 * skipped entirely. Returns the model to remember as the new baseline.
 */
function syncInputs(el, model, prevModel, runtime, host, onDirty) {
  if (canSkipInputsRebuild(el, model, prevModel)) return model;
  renderInputs(el, model, runtime, host, onDirty);
  return model;
}

// Serialises drop-to-add commits per blocks-input id across re-renders (see the
// dropToAdd wiring below): each multi-file drop waits for the previous one to
// commit before reading the live array, so two quick drops can't both read the
// same base and clobber one another.
const _dropChains = new Map();

// Builds the "upload each file → append one block per file" committer for a blocks
// input that declares `dropToAdd`. Shared by the sidebar blocks list (renderInputs)
// and the canvas drop zone (setupCanvasBlocksDrop, e.g. logo-wall) so both surfaces
// accept a pile of files identically and serialise through _dropChains — a drop onto
// the canvas and one onto the sidebar can't read the same base array and clobber.
function makeBlocksDropper({ runtime, host, input, onDirty }) {
  const blockId = input.id;
  const field = input.dropToAdd.field;

  // Accept filter: "image/*" (default) matches any image; a trailing /* matches a
  // whole MIME group; an exact type matches itself. Files with no MIME type (some
  // OS drag sources report none) are allowed when accept has a wildcard group, so
  // they're not silently dropped — the upload path validates bytes.
  const accept = (input.dropToAdd.accept || 'image/*').trim();
  const accepted = (file) => {
    const t = (file.type || '').toLowerCase();
    if (!accept || accept === '*' || accept === '*/*') return true;
    if (!t) return accept.includes('/*');
    return accept.split(',').some(a => {
      a = a.trim().toLowerCase();
      return a.endsWith('/*') ? t.startsWith(a.slice(0, -1)) : t === a;
    });
  };

  // The noun for prompts/announcements comes from the input label, so this stays
  // generic — a future "Documents"/"Videos" blocks input reads correctly.
  const plural = (input.label || 'files').toLowerCase();
  const singular = plural.replace(/s$/, '');

  const commit = async (fileList) => {
    const all = Array.from(fileList || []);
    const files = all.filter(accepted);
    if (all.length && !files.length) { announce(`Those don't look like ${plural}.`, { assertive: true }); return; }
    if (!files.length) return;
    const made = [];
    for (const file of files) {
      try {
        const ref = await storeUserUpload(host, file);
        const block = {};
        for (const f of input.fields ?? []) block[f.id] = f.id === field ? ref : blockFieldDefault(f);
        made.push(block);
      } catch (e) {
        host.log?.('warn', `drop-to-add: couldn't add ${file.name}`, { error: String(e) });
        announce(`Couldn't add ${file.name}.`, { assertive: true });
      }
    }
    if (!made.length) return;
    // Re-read the live array at commit time: an earlier drop (or another edit) may
    // have changed it while our uploads were in flight.
    const live = runtime.getModel().find(i => i.id === blockId)?.value;
    const base = Array.isArray(live) ? live : [];
    runtime.setInput(blockId, [...base, ...made]);
    onDirty?.(blockId);
    announce(`Added ${made.length} ${made.length === 1 ? singular : plural}.`);
  };

  // Chain commits for this input so concurrent drops/selections (from either the
  // sidebar or the canvas) serialise — each reads the live array only after the
  // previous one has committed. Snapshot the files NOW: commit runs a microtask
  // later, by which time a change handler's `value = ''` may have emptied the list.
  const addFiles = (fileList) => {
    const snapshot = Array.from(fileList || []);
    const next = (_dropChains.get(blockId) || Promise.resolve()).then(() => commit(snapshot));
    _dropChains.set(blockId, next.catch(() => {}));
    return next;
  };

  return { accept, plural, addFiles };
}

function renderInputs(el, model, runtime, host, onDirty) {
  const modelValues = Object.fromEntries(model.map(i => [i.id, i.value]));
  const panelModel = model.filter(i => {
    if (i.group === 'export') return false;
    if (!i.showIf) return true;
    return Object.entries(i.showIf).every(([k, v]) => modelValues[k] === v);
  });

  const active       = document.activeElement;
  const focusId      = active?.dataset?.inputId;
  const blockFocusId = active?.dataset?.fieldId;
  // Vector number fields can't use data-input-id (that's the container) or
  // data-field-id (the blocks handler claims those), so restore them by
  // "<inputId>::<fieldId>".
  const vecFocusKey  = active?.classList?.contains('vec-num')
    ? `${active.closest('[data-input-id]')?.dataset.inputId}::${active.dataset.vecField}`
    : null;
  const selStart     = active?.selectionStart;
  const selEnd       = active?.selectionEnd;

  const renderOneInput = input => {
    const isCheckbox = input.control === 'checkbox';
    // The datetime field is a flatpickr (altInput) control, and the whole panel
    // re-renders on every keystroke — a floating label would re-animate from its
    // resting to floating position each time the value re-populates and visibly
    // wobble. Pin it to a static label above the field instead.
    const isStaticLabel = input.control === 'datetime-local-input';
    // Composite controls hold MANY interactive elements. A wrapping <label> makes the
    // browser forward any dead-space click to the label's first labelable descendant —
    // so a `blocks` input forwards gap / pill-body / near-miss clicks to block #0's
    // collapse chevron (the reported "clicking the 2nd scene expands the 1st"), and a
    // `vector` input forwards to its first number field. Wrap these in a <div role=group>
    // instead: the caption still names them (aria-labelledby), but it never proxies clicks.
    const isComposite = ['blocks', 'vector', 'asset-picker', 'file-picker', 'color-picker'].includes(input.control);
    const cls = `input-row${isCheckbox ? ' input-row--checkbox' : ''}${isStaticLabel ? ' input-row--static-label' : ''}`;
    const valueTag = input.control === 'slider'
      ? ` <span class="input-value">${parseFloat(input.value ?? 0)}</span>`
      : '';
    const labelId = `irow-label-${escape(input.id)}`;
    // Help moves behind an info button (see help-tip.js). The label id rides on the
    // text span only, so a composite's aria-labelledby never absorbs "More info".
    const ht = input.help ? helpTip(input.help) : null;
    const labelText = `<span class="input-label-text"${isComposite ? ` id="${labelId}"` : ''}>${escape(input.label ?? input.id)}${valueTag}</span>`;
    const label = `<span class="input-label">${labelText}${ht ? ht.button : ''}</span>`;
    const control = controlHtml(input, modelValues);
    const help = ht ? ht.pop : '';
    if (isCheckbox) return `<label class="${cls}">${control}${label}${help}</label>`;
    if (isComposite) return `<div class="${cls}" role="group" aria-labelledby="${labelId}">${label}${control}${help}</div>`;
    return `<label class="${cls}">${label}${control}${help}</label>`;
  };

  const openSections = new Set(
    [...el.querySelectorAll('.input-section[open] .input-section-summary')].map(s => s.textContent)
  );

  // Folded blocks carry no model value, so capture which are collapsed and re-apply
  // once the panel HTML is regenerated. Tree blocks key by their stable derived id
  // (data-block-key) so fold state follows a card across a drag-reparent reorder;
  // others key by array index as before.
  const foldKey = b => `${b.closest('.blocks-input')?.dataset.inputId}:${b.dataset.blockKey || b.dataset.blockIndex}`;
  const collapsedBlocks = new Set(
    [...el.querySelectorAll('.block-item.is-collapsed')].map(foldKey)
  );

  const parts = [];
  let openSection = null;
  for (const input of panelModel) {
    const sec = input.section ?? null;
    if (sec !== openSection) {
      if (openSection !== null) parts.push('</div></details>');
      if (sec !== null) {
        const wasOpen = openSections.has(sec);
        parts.push(`<details class="input-section"${wasOpen ? ' open' : ''}><summary class="input-section-summary">${escape(sec)}</summary><div class="input-section-body">`);
      }
      openSection = sec;
    }
    parts.push(renderOneInput(input));
  }
  if (openSection !== null) parts.push('</div></details>');
  el.innerHTML = parts.join('');

  const collapseBlock = (item) => {
    item.classList.add('is-collapsed');
    const btn = item.querySelector('[data-block-collapse]');
    btn?.setAttribute('aria-label', 'Expand block');
    btn?.setAttribute('title', 'Expand');
  };
  // On the first render of a freshly-mounted tool, fold every typed block so the
  // sidebar opens as a clean, scannable list — the user expands the ones they
  // want to edit. On later re-renders, preserve whatever the user had folded
  // (captured above); newly-added blocks stay open.
  const firstRender = !el.dataset.blocksDefaulted;
  el.dataset.blocksDefaulted = '1';
  if (firstRender) {
    el.querySelectorAll('.block-item.is-typed').forEach(collapseBlock);
  } else if (collapsedBlocks.size) {
    el.querySelectorAll('.block-item.is-typed').forEach(item => {
      if (collapsedBlocks.has(foldKey(item))) collapseBlock(item);
    });
  }

  // Reflect the live fold state on each blocks input's "Collapse all" pill: when
  // every block is already folded it offers "Expand all", otherwise "Collapse all".
  // Called after the fold-restore pass above and after every fold change (chevron,
  // header click, the pill itself) so the label never goes stale.
  const syncCollapseAllPills = () => {
    el.querySelectorAll('.blocks-input').forEach(wrap => {
      const pill = wrap.querySelector('[data-blocks-collapse-all]');
      if (!pill) return;
      const blocks = [...wrap.querySelectorAll('.block-item.is-typed')];
      const allFolded = blocks.length > 0 && blocks.every(b => b.classList.contains('is-collapsed'));
      pill.dataset.mode = allFolded ? 'expand' : 'collapse';
      pill.textContent = allFolded ? 'Expand all' : 'Collapse all';
      pill.setAttribute('aria-label', allFolded ? 'Expand all blocks' : 'Collapse all blocks');
    });
  };
  syncCollapseAllPills();

  if (focusId) {
    const restored = el.querySelector(`[data-input-id="${CSS.escape(focusId)}"]`);
    if (restored) {
      restored.focus();
      if (selStart != null && restored.setSelectionRange) {
        restored.setSelectionRange(selStart, selEnd);
      }
    }
  }

  if (blockFocusId) {
    const restored = el.querySelector(`[data-field-id="${CSS.escape(blockFocusId)}"]`);
    if (restored) {
      restored.focus();
      if (selStart != null && restored.setSelectionRange) {
        restored.setSelectionRange(selStart, selEnd);
      }
    }
  }

  if (vecFocusKey) {
    const [vid, vfield] = vecFocusKey.split('::');
    const restored = el.querySelector(
      `.vector-input[data-input-id="${CSS.escape(vid)}"] .vec-num[data-vec-field="${CSS.escape(vfield)}"]`
    );
    restored?.focus(); // number inputs expose no caret to restore
  }

  el.querySelectorAll('[data-input-id]').forEach(control => {
    const id    = control.dataset.inputId;
    const input = panelModel.find(i => i.id === id);

    if (input?.control === 'slider') {
      setupCustomSlider(control, runtime, id, onDirty);
      return;
    }

    if (input?.control === 'asset-picker') {
      control.addEventListener('click', async () => {
        const ref = await host.assets.pick({
          title:       `Choose ${input.label ?? input.id}`,
          type:        input.assetType === 'any' ? undefined : input.assetType,
          tags:        input.filter?.tags,
          namespace:   input.filter?.namespace,
          allowUpload: input.allowUpload === true,
          current:     input.value?.id,
          // A slot already holding a Lolly render gets an "edit the tool you're
          // using" banner in the picker (its inputs pre-filled), alongside the
          // normal choose-a-different-image grids.
          currentToolUrl:  input.value?.meta?.toolUrl,
          currentToolName: input.value?.meta?.name,
          // Picking a tool in the picker opens its inputs first (configure → insert),
          // reusing the same in-place editor the "from <tool>" Edit badge uses.
          editTool:    (toolUrl, mode = 'insert') => openEmbedEditor(host, { editUrl: toolUrl, slotLabel: input.label ?? input.id, mode }),
        });
        if (ref) { runtime.setInput(id, ref); onDirty?.(id); }
      });
      return;
    }

    if (input?.control === 'file-picker') {
      const native  = control.querySelector('.file-native');
      const trigger = control.querySelector('.file-trigger');
      const clearer = control.querySelector('.file-clear');
      // Revoke the previous preview object URL so picking a new file doesn't leak.
      const revokePrev = () => {
        const prev = runtime.getModel().find(i => i.id === id)?.value;
        if (prev && prev.url) URL.revokeObjectURL(prev.url);
      };
      trigger?.addEventListener('click', () => native?.click());
      clearer?.addEventListener('click', () => { revokePrev(); runtime.setInput(id, null); onDirty?.(id); });
      native?.addEventListener('change', async () => {
        const file = native.files && native.files[0];
        if (!file) return;
        if (input.maxSize && file.size > input.maxSize) {
          announce(`That file is too large (max ${fmtBytes(input.maxSize)}).`, { assertive: true });
          native.value = '';
          return;
        }
        const ref = await fileToRef(file);
        revokePrev();
        runtime.setInput(id, ref);
        onDirty?.(id);
      });
      return;
    }

    if (input?.control === 'datetime-local-input') return; // handled by flatpickr onClose
    if (input?.control === 'color-picker') return; // native picker handled by color-popover-native listener

    if (input?.control === 'vector') {
      setupVectorControl(control, runtime, id, onDirty, input);
      return;
    }

    control.addEventListener('input', (e) => {
      if (e.target !== control) return; // block fields bubble up — ignore them here
      const value = control.type === 'checkbox' ? control.checked : control.value;
      runtime.setInput(id, value);
    });
  });

  el.querySelectorAll('.fp-datetime').forEach(control => {
    const id       = control.dataset.inputId;
    const initVal  = control.dataset.fpValue || null;
    const existing = control._flatpickr;
    if (existing) existing.destroy();
    flatpickr(control, {
      enableTime:    true,
      dateFormat:    'Y-m-dTH:i',
      altInput:      true,
      altFormat:     'D j M Y h:iK',
      defaultDate:   initVal || null,
      allowInput:    false,
      time_24hr:     true,
      disableMobile: true,
      onReady(_, __, fp) {
        if (fp.altInput) fp.altInput.placeholder = control.placeholder || 'Live — current time';
      },
      // onClose fires once when the picker closes, after the user has finished
      // picking both the date and time. onChange would fire mid-interaction and
      // trigger renderInputs → el.innerHTML reset → destroying the open calendar.
      onClose(selectedDates, dateStr) {
        const next = selectedDates.length ? dateStr : '';
        runtime.setInput(id, next);
        onDirty?.(id);
      },
    });
  });

  el.querySelectorAll('[data-clear-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const clearId = btn.dataset.clearId;
      runtime.setInput(clearId, null);
      onDirty?.(clearId);
    });
  });

  // Edit a Lolly-sourced image in place: re-open the source tool's own inputs
  // (pre-filled from the asset's stored embed URL), tweak, and re-apply the new
  // render to this same slot. Only present when the asset carries meta.toolUrl.
  el.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const editId  = btn.dataset.editId;
      const cur     = panelModel.find(i => i.id === editId);
      const toolUrl = cur?.value?.meta?.toolUrl;
      if (!toolUrl || !host.compose?.renderUrl) return;
      const ref = await openEmbedEditor(host, { editUrl: toolUrl, slotLabel: cur.label ?? editId });
      if (ref) { runtime.setInput(editId, ref); onDirty?.(editId); }
    });
  });

  // Top-level colour inputs use the shared SUSE colour picker (swatches, native,
  // hex, alpha, popover toggle). Block-colour fields below keep their own wiring
  // since they write into a block array, not a top-level input.
  wireColorField(el, {
    onChange: (inputId, value) => { runtime.setInput(inputId, value); onDirty?.(inputId); },
    onInteractStart: () => { _sliderDragging = true; },
    onInteractEnd: () => { _sliderDragging = false; },
  });

  // On-demand help: delegated tap/Escape/outside-click wiring is attached once and
  // survives rebuilds; the aria-describedby links are (re)applied every render.
  wireHelpTips(el);
  linkHelpDescriptions(el);

  el.querySelectorAll('[data-block-swatch-field]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fieldKey = btn.dataset.blockSwatchField; // "blockId:idx:fieldId"
      const hex = btn.dataset.swatchValue;
      const parts = fieldKey.split(':');
      const blockId = parts[0], bIdx = parseInt(parts[1], 10), fId = parts[2];
      const native = el.querySelector(`[data-field-id="${CSS.escape(fieldKey)}"]`);
      if (native && hex.startsWith('#')) native.value = hex;
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...x }));
      if (!arr[bIdx]) arr[bIdx] = {};
      arr[bIdx][fId] = hex;
      runtime.setInput(blockId, arr);
      onDirty?.(blockId);
    });
  });


  // Block field changes
  el.querySelectorAll('[data-field-id]').forEach(field => {
    field.addEventListener('input', () => {
      // A number field mid-decimal — "1." or just "." — reports value="" with
      // validity.badInput. Committing that empties the model, which re-renders
      // the panel (blocks always take the full rebuild path) and wipes the
      // trailing "." the user is about to complete, so "1.2" lands as "12".
      // Hold off until the value parses; the field keeps showing the in-progress
      // text on its own, and the spinner arrows still commit valid steps. badInput
      // is never true for text/textarea/select, so this only ever guards numbers.
      if (field.validity?.badInput) return;
      const parts = field.dataset.fieldId.split(':');
      const blockId = parts[0], idx = parseInt(parts[1], 10), fieldId = parts[2];
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      let arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...x }));
      if (!arr[idx]) arr[idx] = {};
      const value = field.type === 'checkbox' ? field.checked : field.value;
      arr[idx][fieldId] = value;
      // Picking a parent from a reference dropdown anchors the target to a durable
      // id, so the link can't drift if rows are later reordered/added (same as the
      // drag-reparent path). Only for a same-input tree parent ref.
      const fdef = (inp.fields ?? []).find(f => f.id === fieldId);
      if (value && fdef?.optionsFrom && inp.nesting && fieldId === nestingConfig(inp).parentField) {
        arr = materializeRefTarget(arr, String(value), nestingConfig(inp));
      }
      runtime.setInput(blockId, arr);
      onDirty?.(blockId);
    });
  });

  // "+ Add" (and each typed add-menu option) appends a block. Typed menus carry
  // data-block-add-type, which seeds the discriminator; fields start at their
  // declared defaults so a new block renders cleanly rather than all-blank.
  el.querySelectorAll('[data-block-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const blockId = btn.dataset.blockAdd;
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const arr = Array.isArray(inp.value) ? [...inp.value] : [];
      const block = {};
      for (const f of inp.fields ?? []) block[f.id] = blockFieldDefault(f);
      const type = btn.dataset.blockAddType;
      if (inp.addMenu && type !== undefined) block[inp.addMenu.field] = type;
      runtime.setInput(blockId, [...arr, block]);
      onDirty?.(blockId);
    });
  });

  // Drop-to-add: a blocks input that declares `dropToAdd` turns its list into a
  // drop zone — dragging or selecting several image files at once uploads each
  // and appends one block per file (the image in the named asset field, every
  // other field at its default). It reuses the picker's upload path, so SVGs are
  // sanitised and big rasters downscaled exactly like a single "+ Add" upload.
  panelModel.filter(i => i.control === 'blocks' && i.dropToAdd?.field).forEach(input => {
    const blockId = input.id;
    const field = input.dropToAdd.field;
    if (!(input.fields ?? []).some(f => f.id === field && f.type === 'asset')) return;
    const wrap = el.querySelector(`.blocks-input[data-input-id="${CSS.escape(blockId)}"]`);
    const list = wrap?.querySelector('.blocks-list');
    if (!wrap || !list) return;
    wrap.classList.add('blocks-input--droppable');

    // The committer (upload each file → append one block per file) is shared with
    // the canvas drop zone (setupCanvasBlocksDrop), so both surfaces behave alike
    // and serialise through _dropChains.
    const { accept, plural, addFiles } = makeBlocksDropper({ runtime, host, input, onDirty });

    // Hidden multi-file input, opened by the drop hint — so "select several files"
    // works alongside drag-and-drop.
    const native = document.createElement('input');
    native.type = 'file';
    native.multiple = true;
    native.accept = accept;
    native.style.display = 'none';
    wrap.appendChild(native);
    native.addEventListener('change', () => { addFiles(native.files); native.value = ''; });

    // A persistent drop hint that doubles as a "choose files" button — it stays
    // put once blocks exist (just with shorter text) so adding more is always one
    // drop or click away, alongside the per-row "+ Add".
    const hasItems = !!list.querySelector('.block-item');
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'blocks-drop-hint';
    hint.textContent = hasItems
      ? `Drop or click to add more ${plural}`
      : `Drop ${plural} here, or click to choose files`;
    hint.addEventListener('click', () => native.click());
    list.appendChild(hint);

    let depth = 0;
    const setDrag = (on) => wrap.classList.toggle('is-file-dragover', on);
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    list.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDrag(true); });
    list.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    list.addEventListener('dragleave', (e) => { e.preventDefault(); if (--depth <= 0) { depth = 0; setDrag(false); } });
    list.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; setDrag(false); addFiles(e.dataTransfer?.files); });
  });

  // Typed add-menu: toggle the option list; one open at a time.
  el.querySelectorAll('[data-block-add-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.closest('.block-add-menu')?.querySelector('.block-add-options');
      if (!menu) return;
      const willOpen = menu.hidden;
      el.querySelectorAll('.block-add-options').forEach(m => { if (m !== menu) m.hidden = true; });
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  });

  // Per-block asset (image) fields delegate to the host picker, mirroring the
  // top-level asset-picker control but writing into the block array.
  el.querySelectorAll('[data-block-asset]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [blockId, idxStr, fId] = btn.dataset.blockAsset.split(':');
      const idx = parseInt(idxStr, 10);
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const f = (inp.fields ?? []).find(x => x.id === fId) ?? {};
      const cur = Array.isArray(inp.value) ? inp.value[idx]?.[fId] : null;
      const ref = await host.assets.pick({
        title:       `Choose ${f.label ?? fId}`,
        type:        f.assetType === 'any' ? undefined : f.assetType,
        tags:        f.filter?.tags,
        namespace:   f.filter?.namespace,
        allowUpload: f.allowUpload === true,
        current:     cur?.id,
        // Mirror the top-level slot: a block image that's already a Lolly render
        // offers its edit-in-place banner inside the picker too.
        currentToolUrl:  cur?.meta?.toolUrl,
        currentToolName: cur?.meta?.name,
        editTool:    (toolUrl, mode = 'insert') => openEmbedEditor(host, { editUrl: toolUrl, slotLabel: f.label ?? fId, mode }),
      });
      if (!ref) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...x }));
      if (!arr[idx]) arr[idx] = {};
      arr[idx][fId] = ref;
      runtime.setInput(blockId, arr);
      onDirty?.(blockId);
    });
  });

  el.querySelectorAll('[data-block-asset-clear]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [blockId, idxStr, fId] = btn.dataset.blockAssetClear.split(':');
      const idx = parseInt(idxStr, 10);
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...x }));
      if (arr[idx]) arr[idx][fId] = null;
      runtime.setInput(blockId, arr);
      onDirty?.(blockId);
    });
  });

  // Edit a Lolly-sourced block image in place (same flow as the top-level
  // data-edit-id handler, but writing back into the block array).
  el.querySelectorAll('[data-block-asset-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [blockId, idxStr, fId] = btn.dataset.blockAssetEdit.split(':');
      const idx = parseInt(idxStr, 10);
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const cur     = Array.isArray(inp.value) ? inp.value[idx]?.[fId] : null;
      const toolUrl = cur?.meta?.toolUrl;
      if (!toolUrl || !host.compose?.renderUrl) return;
      const f = (inp.fields ?? []).find(x => x.id === fId) ?? {};
      const ref = await openEmbedEditor(host, { editUrl: toolUrl, slotLabel: f.label ?? fId });
      if (!ref) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...x }));
      if (!arr[idx]) arr[idx] = {};
      arr[idx][fId] = ref;
      runtime.setInput(blockId, arr);
      onDirty?.(blockId);
    });
  });

  // Block range sliders: hold the sidebar steady while dragging (the canvas
  // still updates live), exactly like the top-level custom slider / vector scrub.
  el.querySelectorAll('.block-range-input').forEach(r => {
    const hold = () => { _sliderDragging = true; };
    const release = () => { _sliderDragging = false; };
    r.addEventListener('pointerdown', hold);
    r.addEventListener('pointerup', release);
    r.addEventListener('pointercancel', release);
    r.addEventListener('blur', release);
    r.addEventListener('change', release);
  });

  // Remove is a two-step confirm so a stray click can't drop a block: the first
  // click arms the button ("Delete?"); a second click within 3s (or while armed)
  // commits. Clicking elsewhere — or the timeout — disarms it.
  el.querySelectorAll('[data-block-remove]').forEach(btn => {
    // Confirm only for typed (card) blocks; compact name/value rows keep their
    // immediate delete (a "Delete?" label would stretch their tight grid cells).
    const confirms = !!btn.closest('.block-item.is-typed');
    const commit = () => {
      const blockId = btn.dataset.blockInput;
      const idx = parseInt(btn.dataset.blockIndex, 10);
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const arr = (Array.isArray(inp.value) ? [...inp.value] : []).filter((_, i) => i !== idx);
      runtime.setInput(blockId, arr);
      onDirty?.(blockId);
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirms) { commit(); return; }
      if (btn._armed) { btn._disarm?.(); commit(); return; }
      btn._armed = true;
      btn.classList.add('is-confirming');
      const original = btn.innerHTML;
      btn.innerHTML = 'Delete?';
      const away = (ev) => { if (!btn.contains(ev.target)) btn._disarm(); };
      const t = setTimeout(() => btn._disarm(), 3000);
      btn._disarm = () => {
        btn._armed = false;
        btn.classList.remove('is-confirming');
        btn.innerHTML = original;
        clearTimeout(t);
        document.removeEventListener('pointerdown', away, true);
        btn._disarm = null;
      };
      // Defer so this very click doesn't immediately count as "clicking away".
      setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
    });
  });

  // Drag a block's header to reorder. Native HTML5 DnD — the header is the handle.
  // For a plain blocks input the array is spliced into the new order. For a TREE
  // input (input.nesting active) the drop zone splits into before / after / inside,
  // so a card can be moved, re-nested or reordered in one gesture; the dragged
  // card's parent reference is updated and its whole subtree travels with it.
  const clearDropMarks = () => el
    .querySelectorAll('.drag-over, .drop-before, .drop-after, .drop-inside')
    .forEach(n => n.classList.remove('drag-over', 'drop-before', 'drop-after', 'drop-inside'));

  el.querySelectorAll('.block-item.is-typed').forEach(item => {
    const head = item.querySelector('[data-block-handle]');
    if (!head) return;
    const blockId = head.dataset.blockInput;
    const idx = parseInt(head.dataset.blockIndex, 10);
    const treeInp = panelModel.find(i => i.id === blockId);
    const treeMode = nestingActive(treeInp, modelValues);

    // Which of the three zones the pointer is over, by vertical position in the row.
    const zoneIntent = (e) => {
      const r = item.getBoundingClientRect();
      const rel = (e.clientY - r.top) / Math.max(1, r.height);
      return rel < 0.30 ? 'before' : rel > 0.70 ? 'after' : 'inside';
    };

    head.addEventListener('dragstart', (e) => {
      _blockDrag = { inputId: blockId, from: idx, intent: null, over: null };
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* Safari */ }
      item.classList.add('is-dragging');
    });
    head.addEventListener('dragend', () => {
      item.classList.remove('is-dragging');
      clearDropMarks();
      _blockDrag = null;   // clear even on a cancelled drag (no drop fired) so it can't go stale
      // A real drag suppresses the trailing click, but flag it anyway so a drag that
      // the browser rounds to a click can't also expand the pill (see head click below).
      head._dragJustHappened = true;
      setTimeout(() => { head._dragJustHappened = false; }, 0);
    });
    item.addEventListener('dragover', (e) => {
      if (!_blockDrag || _blockDrag.inputId !== blockId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!treeMode) { item.classList.toggle('drag-over', idx !== _blockDrag.from); return; }
      if (idx === _blockDrag.from) { item.classList.remove('drop-before', 'drop-after', 'drop-inside'); return; }
      const intent = zoneIntent(e);
      _blockDrag.intent = intent;
      _blockDrag.over = idx;
      item.classList.toggle('drop-before', intent === 'before');
      item.classList.toggle('drop-after', intent === 'after');
      item.classList.toggle('drop-inside', intent === 'inside');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over', 'drop-before', 'drop-after', 'drop-inside'));
    item.addEventListener('drop', (e) => {
      if (!_blockDrag || _blockDrag.inputId !== blockId) return;
      e.preventDefault();
      const from = _blockDrag.from, to = idx, intent = _blockDrag.intent || zoneIntent(e);
      clearDropMarks();
      _blockDrag = null;
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp || from == null) return;
      const arr = Array.isArray(inp.value) ? inp.value : [];
      if (from < 0 || from >= arr.length) return;
      let next;
      if (treeMode) {
        next = blockReparentMove(arr, from, to, intent, nestingConfig(inp));
        if (!next) return;                      // no-op / illegal (e.g. into own subtree)
      } else {
        if (from === to) return;
        next = [...arr];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
      }
      runtime.setInput(blockId, next);
      onDirty?.(blockId);
    });

    // Icon button folds this block to a pill — pure DOM toggle, no re-render
    // (renderInputs re-applies the collapsed state across rebuilds). toggleBlock
    // keeps the chevron's aria/title and the open animation in lockstep.
    const collapse = item.querySelector('[data-block-collapse]');
    collapse?.addEventListener('click', (e) => {
      e.stopPropagation();                 // don't reach the header's expand/drag
      const folded = !item.classList.contains('is-collapsed');
      toggleBlock(item, folded);
      syncCollapseAllPills();
      // On expand, bring the revealed fields into view so the click never looks dead
      // (a lower pill's fields would otherwise open below the scroll fold).
      if (!folded) scrollToControl(item, { pulse: false });
    });

    // The whole pill is the expand target while collapsed — clicking its body (preview,
    // swatch, grip, dead space) opens it, not just the 22px chevron. Only acts while
    // collapsed; ignores the chevron/remove buttons (they handle themselves) and the
    // click that ends a drag-reorder. Expanded cards are untouched (fields stay editable).
    head.addEventListener('click', (e) => {
      if (!item.classList.contains('is-collapsed')) return;
      if (e.target.closest('button')) return;
      if (head._dragJustHappened) return;
      toggleBlock(item, false);
      syncCollapseAllPills();
      scrollToControl(item, { pulse: false });
    });
  });

  // "Collapse all / Expand all" pill: fold or unfold every block in its group at
  // once — pure DOM toggle like the per-block chevron (renderInputs re-applies the
  // fold state across rebuilds), so no model change and no re-render.
  el.querySelectorAll('[data-blocks-collapse-all]').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = pill.closest('.blocks-input');
      const fold = pill.dataset.mode !== 'expand';
      wrap.querySelectorAll('.block-item.is-typed').forEach(item => toggleBlock(item, fold));
      syncCollapseAllPills();
      // Expanding many at once: surface the first so the change is visible.
      if (!fold) {
        const first = wrap.querySelector('.block-item');
        if (first) scrollToControl(first, { pulse: false });
      }
    });
  });

  if (el._colorPopoverDismiss) {
    document.removeEventListener('click', el._colorPopoverDismiss, true);
  }
  el._colorPopoverDismiss = e => {
    if (!e.target.closest('.color-picker-field') && !e.target.closest('.color-popover')) {
      el.querySelectorAll('.color-popover:not([hidden])').forEach(p => { p.hidden = true; p.style.cssText = ''; });
    }
  };
  document.addEventListener('click', el._colorPopoverDismiss, true);

  // Dismiss any open typed add-menu on an outside click. A click inside
  // .block-add-menu is left alone (the option's own handler appends + rebuilds).
  if (el._blockMenuDismiss) {
    document.removeEventListener('click', el._blockMenuDismiss, true);
  }
  el._blockMenuDismiss = e => {
    if (!e.target.closest('.block-add-menu')) {
      el.querySelectorAll('.block-add-options:not([hidden])').forEach(m => { m.hidden = true; });
    }
  };
  document.addEventListener('click', el._blockMenuDismiss, true);
}

// Starting value for a freshly-added block field. An explicit `default` wins;
// otherwise the type picks a sensible empty (number→min, select→first option,
// asset→null, text/color→'').
function blockFieldDefault(f) {
  if (f.default !== undefined) return f.default;
  switch (f.type) {
    case 'number':  return f.min ?? 0;
    case 'select':  return f.options?.[0]?.value ?? '';
    case 'boolean': return false;
    case 'asset':   return null;
    default:        return '';
  }
}

// Human-readable byte size for the file picker (chosen-file label + size limits).
function fmtBytes(n) {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function controlHtml(input, modelValues = {}) {
  const id  = escape(input.id);
  const val = escape(input.value ?? '');
  switch (input.control) {
    case 'textarea':
      return `<textarea data-input-id="${id}" rows="${input.rows ?? 3}" maxlength="${input.maxLength ?? ''}" placeholder="${escape(input.placeholder ?? ' ')}">${val}</textarea>`;
    case 'slider': {
      const min  = input.min  ?? 0;
      const max  = input.max  ?? 100;
      const step = input.step ?? 1;
      const num  = parseFloat(input.value ?? min);
      const pct  = ((num - min) / (max - min) * 100).toFixed(3);
      const stops = Math.round((max - min) / step);
      const ticks = (stops >= 2 && stops <= 30)
        ? `<div class="cs-ticks" aria-hidden="true">${
            Array.from({ length: stops + 1 }, (_, i) =>
              `<span class="cs-tick" style="left:${(i / stops * 100).toFixed(3)}%"></span>`
            ).join('')
          }</div>`
        : '';
      const unit = input.unit ?? input.suffix ?? '';
      return `<div class="custom-slider" data-input-id="${id}"
          data-min="${min}" data-max="${max}" data-step="${step}"${unit ? ` data-unit="${escape(unit)}"` : ''}
          tabindex="0" role="slider" aria-label="${escape(input.label ?? id)}"
          aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${num}" aria-valuetext="${escape(unit ? `${num} ${unit}` : String(num))}">
        <div class="cs-track">
          <div class="cs-fill" style="width:${pct}%"></div>
          <div class="cs-thumb" style="left:${pct}%"></div>
        </div>
        ${ticks}
      </div>`;
    }
    case 'select':
      return `<select data-input-id="${id}">${(input.options ?? []).map(o =>
        `<option value="${escape(o.value)}" ${o.value === input.value ? 'selected' : ''}>${escape(o.label ?? o.value)}</option>`
      ).join('')}</select>`;
    case 'checkbox':
      return `<input type="checkbox" data-input-id="${id}" ${input.value ? 'checked' : ''}>`;
    case 'color-picker':
      // Shared SUSE colour picker (see components/color-field.js).
      // `swatchesOnly` makes it a palette-restricted picker (no hex/native/alpha).
      return colorFieldHtml(id, input.value, { swatchesOnly: input.swatchesOnly === true });
    case 'palette-picker':
      return `<input type="text" data-input-id="${id}" value="${val}" placeholder="(palette picker: stub)">`;
    case 'asset-picker': {
      const currentLabel = input.value?.meta?.name ?? input.value?.id ?? 'Choose asset…';
      const hasValue = Boolean(input.value);
      // A selected asset carries a resolved blob: URL (see runtime resolveAssetRefs)
      // — show it as a small preview so the picked image is visible at a glance.
      // A lottie ref's URL is the animation JSON (unrenderable in <img>), so it
      // gets a play-glyph stub instead.
      const thumbUrl = input.value?.url;
      const thumb = input.value?.type === 'lottie'
        ? `<span class="asset-picker-thumb-inline asset-picker-thumb-lottie" aria-hidden="true">&#9654;</span>`
        : thumbUrl
          ? `<img class="asset-picker-thumb-inline" src="${escape(thumbUrl)}" alt="">`
          : '';
      // An image minted from a pasted Lolly link keeps its origin in meta.toolUrl —
      // the canonical, re-renderable embed URL (see compose.renderUrl). Surface that
      // provenance and an Edit affordance that re-opens the source tool's own inputs
      // (openEmbedEditor) so the editor can tweak it and re-apply. Plain library /
      // uploaded assets have no toolUrl, so they show no badge.
      const fromTool = input.value?.meta?.toolUrl ? (input.value.meta.name ?? 'a Lolly tool') : null;
      return `<div class="asset-picker-row">
        ${thumb}
        <button type="button" class="asset-picker-trigger" data-input-id="${id}">${escape(currentLabel)}</button>
        ${hasValue ? `<button type="button" class="asset-clear" data-clear-id="${id}" aria-label="Clear selection">&#x2715;</button>` : ''}
      </div>${fromTool ? `<div class="asset-from-tool">
        <span class="asset-from-tool-label"><span class="asset-from-tool-spark" aria-hidden="true">&#10022;</span> from <strong>${escape(fromTool)}</strong></span>
        <button type="button" class="asset-edit" data-edit-id="${id}">Edit</button>
      </div>` : ''}`;
    }
    case 'file-picker': {
      // A picked file is a FileRef (bytes + metadata) the hook transforms; the
      // bytes live only in memory and are never uploaded or persisted. The native
      // <input type=file> is hidden behind a styled trigger; binding (renderInputs)
      // reads the File into a FileRef on change.
      const ref = input.value && typeof input.value === 'object' && input.value.__file ? input.value : null;
      const accept = Array.isArray(input.accept) ? input.accept.join(',') : '';
      const meta = ref ? `${escape(ref.name)}${ref.size ? ` · ${fmtBytes(ref.size)}` : ''}` : '';
      return `<div class="file-picker" data-input-id="${id}">
        <input type="file" class="file-native" ${accept ? `accept="${escape(accept)}"` : ''} hidden>
        <button type="button" class="file-trigger">${ref ? 'Replace file…' : 'Choose file…'}</button>
        ${ref ? `<div class="file-chosen"><span class="file-name" title="${escape(ref.name)}">${meta}</span><button type="button" class="file-clear" aria-label="Remove file">&#x2715;</button></div>` : ''}
      </div>`;
    }
    case 'time-input':
      return `<div class="time-input-wrap"><input type="time" data-input-id="${id}" value="${val}"></div>`;
    case 'datetime-local-input':
      return `<input type="text" class="fp-datetime" data-input-id="${id}" data-fp-value="${val}" placeholder="Live — current time" readonly>`;
    case 'blocks': {
      const items   = Array.isArray(input.value) ? input.value : [];
      const fields  = input.fields ?? [];
      // addMenu turns "+ Add" into a typed menu and makes one sub-field the
      // block's fixed discriminator (shown as a head label, not an editable
      // control). Other sub-fields can opt into per-type visibility via showFor.
      const addMenu  = input.addMenu || null;
      const discr    = addMenu ? fields.find(f => f.id === addMenu.field) : null;
      const typeOpts = discr?.options ?? [];
      const typeLabel = v => typeOpts.find(o => o.value === v)?.label ?? (v ?? '');

      // Stack a label above a control inside a typed block; plain controls
      // (untyped blocks) render bare to keep the legacy compact row layout —
      // unless the input opts in with `labelledFields` (e.g. logo-wall, whose
      // optional per-logo controls aren't self-evident).
      const labelEach = !!(addMenu || input.labelledFields);
      const labelled = (f, inner, cls = '') => {
        if (!labelEach) return inner;
        const ht = f.help ? helpTip(f.help) : null;
        return `<div class="block-control${cls}"><span class="block-control-label">${escape(f.label ?? f.id)}${ht ? ht.button : ''}</span>${inner}${ht ? ht.pop : ''}</div>`;
      };

      // A sub-field's `showIf` is matched first against sibling fields of the same
      // block, then against top-level input values (modelValues) — so a per-block
      // control can depend on both another block field and a global toggle.
      const blockShowIf = (f, item) => {
        if (!f.showIf) return true;
        return Object.entries(f.showIf).every(([k, v]) =>
          ((item && k in item) ? item[k] : modelValues[k]) === v);
      };

      const blockField = (f, item, idx, typeVal) => {
        const fieldId = `${id}:${idx}:${escape(f.id)}`;
        if (addMenu && f.id === addMenu.field) return '';                 // discriminator → head label
        if (Array.isArray(f.showFor) && !f.showFor.includes(typeVal)) return '';
        if (!blockShowIf(f, item)) return '';

        // A reference picker: choices come from the rows of another blocks input
        // (e.g. "parent" lists the other cards). The value stored is each target
        // row's derived id, which the tool's hook resolves — so this replaces the
        // old "type the matching ID by hand" text boxes without any data change.
        if (f.optionsFrom) {
          const cur = String(item[f.id] ?? f.default ?? '');
          const { options, emptyLabel, freeText } = buildRefOptions({
            of: f.optionsFrom,
            ownerInputId: input.id,
            idx,
            getRows: (inId) => (Array.isArray(modelValues[inId]) ? modelValues[inId] : []),
            ownerNestingCfg: input.nesting ? nestingConfig(input) : null,
          });
          if (freeText) {
            // Combobox — pick an existing target or type a new id (kanban columns).
            const listId = `dl-${id}-${idx}-${escape(f.id)}`;
            const dlOpts = options.map(o => `<option value="${escape(o.value)}">${escape(o.label)}</option>`).join('');
            return labelled(f, `<input class="block-field block-field--ref" list="${listId}" data-field-id="${fieldId}"
              value="${escape(cur)}" placeholder="${escape(f.placeholder ?? emptyLabel ?? '— none —')}"
              aria-label="${escape(f.label ?? f.id)}"><datalist id="${listId}">${dlOpts}</datalist>`);
          }
          // Strict select. A stored value matching no current row is surfaced as a
          // selected "(unknown)" option rather than silently dropped — so a stale or
          // mistyped reference is visible instead of just "the link didn't work".
          const known = options.some(o => o.value === cur);
          const empty = `<option value=""${cur === '' ? ' selected' : ''}>${escape(emptyLabel ?? '— none —')}</option>`;
          const unknown = (cur !== '' && !known)
            ? `<option value="${escape(cur)}" selected>${escape(cur)} (unknown)</option>` : '';
          const opts = options.map(o =>
            `<option value="${escape(o.value)}"${o.value === cur ? ' selected' : ''}>${escape(o.label)}</option>`).join('');
          return labelled(f, `<select class="block-field block-field--ref" data-field-id="${fieldId}" aria-label="${escape(f.label ?? f.id)}">${empty}${unknown}${opts}</select>`);
        }

        if (f.type === 'boolean') {
          const on = !!item[f.id];
          const ht = f.help ? helpTip(f.help) : null;
          // Checkbox + inline label (always labelled — a bare checkbox is opaque),
          // spanning the full row so it reads as its own line.
          return `<label class="block-control block-control--checkbox block-control--full">
            <input type="checkbox" class="block-field block-field--checkbox" data-field-id="${fieldId}"${on ? ' checked' : ''}>
            <span class="block-control-label">${escape(f.label ?? f.id)}${ht ? ht.button : ''}</span>
            ${ht ? ht.pop : ''}
          </label>`;
        }

        if (f.type === 'color') {
          const hex = String(item[f.id] ?? '').trim();
          const pickerVal = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#30ba78';
          const swatches = PALETTE.map(s => `<button type="button"
            class="color-swatch"
            data-block-swatch-field="${fieldId}" data-swatch-value="${s.hex}"
            style="background:${s.hex}" title="${escape(s.label)}"></button>`).join('');
          return labelled(f, `<div class="color-picker-field block-color-field" data-color-field="${fieldId}">
            <button type="button" class="color-trigger" data-color-trigger="${fieldId}"
              aria-label="${escape(f.label ?? f.id)}">
              <span class="color-trigger-preview" style="background:${pickerVal}"></span>
              <span class="color-trigger-hex">${pickerVal}</span>
            </button>
            <div class="color-popover" hidden>
              <div class="color-swatches">${swatches}</div>
              <input type="color" class="color-popover-native"
                data-field-id="${fieldId}" value="${pickerVal}">
            </div>
          </div>`);
        }

        if (f.type === 'select') {
          const cur = String(item[f.id] ?? f.default ?? '');
          const opts = (f.options ?? []).map(o =>
            `<option value="${escape(o.value)}" ${String(o.value) === cur ? 'selected' : ''}>${escape(o.label ?? o.value)}</option>`).join('');
          return labelled(f, `<select class="block-field" data-field-id="${fieldId}" aria-label="${escape(f.label ?? f.id)}">${opts}</select>`);
        }

        if (f.type === 'number') {
          const min = f.min ?? 0, max = f.max ?? 1, step = f.step ?? 0.01;
          const cur = item[f.id] ?? f.default ?? min;
          // display:'slider' → range track; otherwise a plain number input that shows
          // the value and accepts decimals (e.g. 1.3, 0.5). Mirrors the top-level
          // number-vs-slider convention so block fields read consistently.
          if (f.display === 'slider') {
            return labelled(f, `<input type="range" class="block-field block-range-input" data-field-id="${fieldId}"
              min="${min}" max="${max}" step="${step}" value="${escape(cur)}" aria-label="${escape(f.label ?? f.id)}">`);
          }
          return labelled(f, `<input type="number" class="block-field block-number-input" data-field-id="${fieldId}"
            min="${min}" max="${max}" step="${step}" value="${escape(cur)}" inputmode="decimal" aria-label="${escape(f.label ?? f.id)}">`);
        }

        if (f.type === 'asset') {
          const ref = item[f.id];
          const has = ref && typeof ref === 'object' && ref.url;
          // A block image pasted from a Lolly link is re-editable too (mirrors the
          // top-level asset-picker case): a ✦ Edit button keyed on the same field id
          // the picker/clear handlers use re-opens the source tool (openEmbedEditor).
          const fromTool = ref?.meta?.toolUrl ? (ref.meta.name ?? 'a Lolly tool') : null;
          // A lottie ref's URL is JSON — show a play-glyph + name, not a dead <img>.
          const trigger = !has ? `<span>&#43; ${escape(f.label ?? 'Image')}</span>`
            : ref.type === 'lottie' ? `<span class="block-asset-lottie"><span aria-hidden="true">&#9654;</span> ${escape(ref.meta?.name ?? ref.id)}</span>`
            : `<img src="${escape(ref.url)}" alt="">`;
          return labelled(f, `<div class="block-asset">
            <button type="button" class="block-asset-trigger" data-block-asset="${fieldId}" aria-label="${escape(f.label ?? f.id)}">
              ${trigger}
            </button>
            ${fromTool ? `<button type="button" class="block-asset-edit" data-block-asset-edit="${fieldId}" title="Edit — from ${escape(fromTool)}" aria-label="Edit image, from ${escape(fromTool)}">&#10022;</button>` : ''}
            ${has ? `<button type="button" class="block-asset-clear" data-block-asset-clear="${fieldId}" aria-label="Remove ${escape(f.label ?? 'image')}">&#x2715;</button>` : ''}
          </div>`, ' block-control--full');
        }

        // A field can opt into a multi-line textarea for specific block kinds
        // (e.g. body text) via `multilineFor`; other kinds keep the single-line
        // input. Both carry data-field-id, so the generic commit + focus-restore
        // handlers below treat them identically.
        if (Array.isArray(f.multilineFor) && f.multilineFor.includes(typeVal)) {
          return `<textarea class="block-field block-field--textarea${addMenu ? ' block-field--full' : ''}"
            data-field-id="${fieldId}" rows="${f.rows ?? 3}"
            placeholder="${escape(f.placeholder ?? f.label ?? f.id)}"
            aria-label="${escape(f.label ?? f.id)}">${escape(String(item[f.id] ?? ''))}</textarea>`;
        }
        return `<input class="block-field${addMenu ? ' block-field--full' : ''}"
          data-field-id="${fieldId}"
          placeholder="${escape(f.placeholder ?? f.label ?? f.id)}"
          value="${escape(String(item[f.id] ?? ''))}"
          aria-label="${escape(f.label ?? f.id)}">`;
      };

      const removeBtn = (idx, label) => `<button type="button" class="block-remove"
        data-block-remove data-block-input="${id}" data-block-index="${idx}"
        aria-label="Remove ${escape(label || 'block')}" title="Remove">&#x2715;</button>`;

      // Six-dot grip — signals the header is a drag handle for reordering.
      const grip = `<svg class="block-grip" viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
        <circle cx="2.5" cy="3" r="1.2"/><circle cx="7.5" cy="3" r="1.2"/>
        <circle cx="2.5" cy="8" r="1.2"/><circle cx="7.5" cy="8" r="1.2"/>
        <circle cx="2.5" cy="13" r="1.2"/><circle cx="7.5" cy="13" r="1.2"/></svg>`;

      // Icon-only collapse toggle in the header — folds the block to a pill. The
      // chevron rotates to indicate state (CSS). State carries no model value, so
      // it's a pure DOM toggle here and re-applied after re-render by renderInputs.
      const collapseBtn = `<button type="button" class="block-collapse" data-block-collapse draggable="false" aria-label="Collapse block" title="Collapse">
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6.5 8 10l4-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;

      // Collapsed-pill summary: the first non-empty text field, plus the first
      // valid colour field as a dot — so a folded block stays identifiable.
      // Both respect the active type's showFor visibility.
      const visibleFor = (f, typeVal, item) =>
        !(Array.isArray(f.showFor) && !f.showFor.includes(typeVal)) && blockShowIf(f, item);
      const previewOf = (item, typeVal) => {
        for (const f of fields) {
          if (addMenu && f.id === addMenu.field) continue;
          if (!visibleFor(f, typeVal, item)) continue;
          // A field with no declared type renders as a text input, so treat it as
          // text here too — otherwise compact name/value blocks (whose fields omit
          // `type`) would collapse to a blank pill.
          const ty = f.type || 'text';
          if (ty === 'text' || ty === 'longtext') {
            const v = String(item[f.id] ?? '').trim();
            if (v) return v;
          }
        }
        return '';
      };
      const swatchOf = (item, typeVal) => {
        for (const f of fields) {
          if (!visibleFor(f, typeVal, item)) continue;
          if (f.type === 'color') {
            const v = String(item[f.id] ?? '').trim();
            if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
          }
        }
        return '';
      };

      // Tree mode: when the input declares `nesting` and it's active for the
      // current model (e.g. diagramType ∈ org|mindmap), render the flat array as an
      // indented outline in pre-order, and let the header drag drop above / below /
      // inside another card (see the drag handlers in renderInputs). The DATA stays
      // a flat reference-by-id array — only the presentation is tree-shaped.
      const nesting = nestingActive(input, modelValues);
      const nestCfg = nesting ? nestingConfig(input) : null;

      const itemHtml = (item, idx, depth = 0, key = null) => {
        const typeVal = addMenu ? item[addMenu.field] : null;
        const inner = fields.map(f => blockField(f, item, idx, typeVal)).join('');
        const sw = swatchOf(item, typeVal);
        const swatch = sw ? `<span class="block-head-swatch" style="background:${sw}"></span>` : '';
        const preview = `<span class="block-head-preview">${escape(previewOf(item, typeVal))}</span>`;
        // Typed blocks label their header with the variant name; untyped (compact
        // name/value) blocks have no variant, so the header is a bare handle. The
        // empty label still holds the flex spacer that right-aligns the controls,
        // and the collapsed pill (preview + swatch) supplies the identity. Both
        // kinds carry `is-typed` so they share the card chrome, collapse, drag and
        // first-render fold; `block-item--row` lets CSS tune the compact variant.
        const label = addMenu ? typeLabel(typeVal) : '';
        const rowCls = addMenu ? '' : ' block-item--row';
        const nestAttrs = nesting
          ? ` data-block-nested data-block-key="${escape(key ?? '')}" style="--block-depth:${depth}"` : '';
        const nestCls = nesting ? ` is-nestable${depth > 0 ? ' is-child' : ''}` : '';
        const title = nesting ? 'Drag to move, nest or reorder' : 'Drag to reorder';
        return `<div class="block-item is-typed${rowCls}${nestCls}" data-block-type="${escape(typeVal ?? '')}" data-block-index="${idx}"${nestAttrs}>
          <div class="block-head" data-block-handle draggable="true"
               data-block-input="${id}" data-block-index="${idx}" title="${title}">
            ${grip}<span class="block-type-label">${escape(label)}</span>${swatch}${preview}${collapseBtn}${removeBtn(idx, label || 'block')}
          </div>
          <div class="block-fields">${inner}</div>
        </div>`;
      };

      // In tree mode the list renders in pre-order (parent immediately above its
      // children) with each row carrying its TRUE array index, so the drag handlers
      // operate on the real array regardless of display order.
      let itemsHtml;
      if (nesting) {
        const keys = deriveBlockKeys(items, nestCfg);
        const order = blockTreeOrder(items, blockParentIndex(items, keys, nestCfg.parentField));
        itemsHtml = order.map(e => itemHtml(items[e.idx], e.idx, e.depth, keys[e.idx])).join('');
      } else {
        itemsHtml = items.map((it, i) => itemHtml(it, i)).join('');
      }

      let adder;
      if (addMenu) {
        const opts = typeOpts.map(o => {
          const used = items.some(it => it[addMenu.field] === o.value);
          const disabled = used && !o.repeatable;
          return `<button type="button" class="block-add-option" data-block-add="${id}"
            data-block-add-type="${escape(o.value)}"${disabled ? ' disabled' : ''}>${escape(o.label ?? o.value)}</button>`;
        }).join('');
        adder = `<div class="block-add-menu">
          <button type="button" class="block-add block-add--prominent" data-block-add-toggle="${id}" aria-haspopup="true" aria-expanded="false">&#43; ${escape(addMenu.label ?? 'Add')}</button>
          <div class="block-add-options" hidden>${opts}</div>
        </div>`;
      } else {
        adder = `<button type="button" class="block-add" data-block-add="${id}">+ Add</button>`;
      }

      // "Collapse all / Expand all" pill — only worth showing once there are
      // several blocks to fold. Its label is kept in sync with the live fold state
      // in renderInputs (syncCollapseAllPills); it starts as "Collapse all".
      const collapseAll = items.length > 1
        ? `<div class="blocks-toolbar"><button type="button" class="blocks-collapse-all" data-blocks-collapse-all="${id}" data-mode="collapse" aria-label="Collapse all blocks">Collapse all</button></div>`
        : '';
      return `<div class="blocks-input blocks-input--cards${addMenu ? ' blocks-input--typed' : ''}${nesting ? ' blocks-input--tree' : ''}" data-input-id="${id}">
        ${collapseAll}
        <div class="blocks-list">${itemsHtml}</div>
        ${adder}
      </div>`;
    }
    case 'vector': {
      // One compound input rendered as N Figma-style fields: drag the label to
      // scrub, or type a number. The whole { fieldId: number } object is committed
      // at once (see setupVectorControl), so bulk mode sees a single column.
      const fields = input.fields ?? [];
      const v = (input.value && typeof input.value === 'object') ? input.value : {};
      const fieldHtml = f => {
        const fv = v[f.id] ?? f.default ?? f.min ?? 0;
        const lab = escape(f.label ?? f.id);
        // Tiny single-character indicator shown inside the field (+ / X / Y …),
        // doubling as the drag handle. Field may set its own `symbol`; otherwise
        // the first letter of the label. Full label stays in title + aria-label.
        const sym = escape(f.symbol ?? (f.label ?? f.id).trim().charAt(0).toUpperCase());
        return `<span class="vec-field">
          <span class="vec-scrub" data-vec-scrub="${escape(f.id)}" title="Drag to adjust ${lab}" aria-hidden="true">${sym}</span>
          <input type="number" class="vec-num" data-vec-field="${escape(f.id)}"
            value="${escape(fv)}"${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''} step="${f.step ?? 1}"
            aria-label="${escape((input.label ? input.label + ' — ' : '') + (f.label ?? f.id))}">
        </span>`;
      };
      return `<div class="vector-input" data-input-id="${id}">${fields.map(fieldHtml).join('')}</div>`;
    }
    default:
      return `<input type="text" data-input-id="${id}" value="${val}" maxlength="${input.maxLength ?? ''}" placeholder="${escape(input.placeholder ?? ' ')}">`;
  }
}

// fitCanvas and exportUnscaled are passed in so refreshCanvasPreview and the
// export actions can coordinate with the responsive-scaling logic in mountTool.
function renderActions(el, manifest, runtime, canvasEl, host, fitCanvas, exportUnscaled, exportDefaults = {}, onUrlSync = null, playShutter = () => {}, fileIntoFolder = null, returnTo = '/', initialSlot = null) {
  // The slot this editing session writes to. Seeded from a resumed `?slot=` session,
  // otherwise null until the first save mints one. Every subsequent save (the Save
  // button, the render-pill quick-Save, "Save & leave") reuses it so edits UPDATE the
  // same saved session in place instead of spawning a new one on each save. Without
  // this, re-saving after an edit orphaned a fresh copy in Uncategorised and left the
  // original folder card frozen at its first-save state.
  let activeSlot = initialSlot;
  // Shareable-link button (wired by wireUpCopyUrl). A link glyph + label; the
  // label is swapped to "Copied!" on click, so it's wrapped in its own span to
  // keep the icon. Lives at the foot of the actions bar — after the render
  // (Download) button, so on mobile it stacks behind it.
  const copyUrlBtn = `<button type="button" data-action="copy-url" class="copy-url-btn btn" title="Copy a shareable link" aria-label="Share"><svg class="copy-url-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg><span data-copy-url-label>Share</span></button>`;

  // Save glyph — a tray with a down-arrow (matches the Feather "download" mark),
  // line-art to sit consistently beside the Copy and Share icons.
  const SAVE_SVG = `<svg class="save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

  // Shared, awaitable save routine — used by the Save button AND the
  // unsaved-changes dialog's "Save & leave". Returns true on success. Always
  // re-enables the button and surfaces failures: a save error used to leave the
  // button stuck on "Saving…" silently, which made "Save & leave" appear to do
  // nothing (and then click a now-disabled button — a no-op). The thumbnail is
  // best-effort (captureThumbnail swallows its own errors), so it never blocks a save.
  async function performSave(saveBtnEl) {
    const btn = saveBtnEl ?? el?.querySelector('[data-action="save"]');
    if (!btn || btn.dataset.saving) return false;
    const label = btn.querySelector('[data-save-label]') ?? btn;
    const idle  = label.textContent;
    btn.dataset.saving = '1';
    btn.disabled = true;
    label.textContent = 'Saving…';
    try {
      // Reuse the session's slot after the first save (or when resuming an existing
      // session) so a re-save updates it in place; only mint a new slot the first time.
      const slot   = activeSlot || `${manifest.id}:${Date.now()}`;
      const values = Object.fromEntries(runtime.getModel().map(i => [i.id, i.value]));
      // The effective export format (user-selected, or the tool's default). Drives
      // a vector (SVG) thumbnail for vector tools — see captureThumbnail.
      const fmt    = el?.querySelector('[data-action="format"]')?.value ?? '';
      const thumb  = await captureThumbnail(manifest, canvasEl, runtime, exportUnscaled, fmt);
      await host.state.save(slot, {
        ...values,
        __toolId:          manifest.id,
        __toolVersion:     manifest.version,
        __export_filename: el?.querySelector('[data-action="filename"]')?.value.trim() ?? '',
        __export_format:   fmt,
        __export_width:    el?.querySelector('[data-action="export-width"]')?.value ?? '',
        __export_height:   el?.querySelector('[data-action="export-height"]')?.value ?? '',
        __export_unit:     el?.querySelector('[data-action="export-unit"]')?.value ?? 'px',
        __export_dpi:      el?.querySelector('[data-action="export-dpi"]')?.value ?? '',
        __export_profile:  el?.querySelector('[data-action="cmyk-profile"]')?.value ?? '',
        __export_bleed:    readBleed(el),
        __export_marks:    readMarks(el),
      }, thumb);
      // Remember the slot so the next save updates THIS session rather than creating a
      // duplicate (see activeSlot above). Set before filing so a fresh first-save is
      // both filed into its folder AND pinned as the active slot for later edits.
      activeSlot = slot;
      // File a freshly-created session into the folder the Projects "+ New tool" flow
      // launched from (claimed at mount into fileIntoFolder — empty value = root/uncat
      // = null = no filing). One-shot, best-effort, never blocks the save.
      if (fileIntoFolder) {
        try {
          const { createFolderStore } = await import('../folders.js');
          await createFolderStore(host).moveItem(slot, fileIntoFolder, 'session');
        } catch (e) { /* filing is best-effort */ }
        fileIntoFolder = null;
      }
      label.textContent = 'Saved';
      announce('Saved');
      return true;                              // leave the button as-is; the caller navigates away
    } catch (e) {
      console.error('Save failed:', e);
      label.textContent = idle;
      btn.disabled = false;
      delete btn.dataset.saving;
      announce('Save failed');
      return false;
    }
  }

  if (manifest.render.export === false) {
    if (!el) return;
    const hasInputs = (manifest.inputs?.length ?? 0) > 0;
    // An explicit empty actions list opts out of the default Save+Share bar — for
    // on-device file utilities that provide their own download button and must
    // NOT persist the user's file bytes to storage (Save would write them to
    // IndexedDB, contradicting the "nothing is stored/uploaded" promise).
    const optedOut = Array.isArray(manifest.render.actions) && manifest.render.actions.length === 0;
    if (!hasInputs || optedOut) { el.innerHTML = ''; return {}; }
    el.innerHTML = `<div class="export-action-buttons"><button data-action="save" class="save-btn">${SAVE_SVG}<span data-save-label>Save</span></button>${copyUrlBtn}</div>`;
    el.querySelector('[data-action="save"]').addEventListener('click', async function () {
      if (await performSave(this)) setTimeout(() => { navigateTo(returnTo); }, 800);
    });
    return { save: performSave };
  }

  const actions    = manifest.render.actions ?? ['copy', 'download', 'save'];
  const exportOpts = runtime.getModel().filter(i => i.group === 'export' && i.control === 'checkbox');
  const isAnimatedFmt = f => f === 'webm' || f === 'mp4' || f === 'gif' || f === 'apng';
  // Mirrors VECTOR_FORMATS in engine/src/inputs.js — formats where text→path
  // outlining (the 'Convert paths' toggle) applies. Bitmap formats don't.
  const isVectorFmt   = f => f === 'svg' || f === 'pdf' || f === 'pdf-cmyk';
  // Show only the video containers this browser can record (Safari→mp4, Firefox→webm,
  // recent Chrome→both); non-video formats always pass. See keepFormat / VIDEO.
  const formats       = manifest.render.formats.filter(keepFormat);
  const hasAnimated   = formats.some(isAnimatedFmt);
  const initialFmt    = (exportDefaults.format && formats.includes(exportDefaults.format)) ? exportDefaults.format : formats[0];
  const videoDefaults = manifest.render.video ?? {};
  const defaultWait     = videoDefaults.wait     ?? 1;
  const defaultDuration = videoDefaults.duration ?? 5;

  // Directional glyphs that live inside the dimension inputs: ↔ marks width,
  // ↕ marks height, so the two fields read as "wide × tall" without labels.
  const ICON_W = `<svg class="dim-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/><line x1="4" y1="12" x2="20" y2="12"/></svg>`;
  const ICON_H = `<svg class="dim-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8 7 12 3 16 7"/><polyline points="8 17 12 21 16 17"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;

  // Tier 1 — filename · format. The format selector is the highest-priority
  // control; the filename rides alongside it as the natural "name.format" pair.
  const filenameRow = `
      <div class="filename-extension">
        <input type="text" class="export-filename" data-action="filename"
              value="${escape(exportDefaults.filename ?? manifest.name)}" placeholder="filename" spellcheck="false">
        ${formats.length > 1 ? `
          <select data-action="format" aria-label="Export format">
            ${formats.map(f => `<option value="${f}" ${f === initialFmt ? 'selected' : ''}>${fmtLabel(f)}</option>`).join('')}
          </select>
        ` : ''}
      </div>`;

  // Tier 2 — dimensions. The primary sizing control: full-width, prominent,
  // with the directional icon inside each field.
  const initUnit = exportDefaults.unit ?? 'px';
  const initDpi  = exportDefaults.dpi ?? 300;
  const dimsRow = manifest.render.dims !== false ? `
      <div class="export-dims">
        <div class="dim-field">
          ${ICON_W}
          <input type="number" data-action="export-width" data-scrub aria-label="Width"
                 value="${exportDefaults.width ?? manifest.render.width}" min="1" max="100000" step="any">
        </div>
        <span class="dim-x">×</span>
        <div class="dim-field">
          ${ICON_H}
          <input type="number" data-action="export-height" data-scrub aria-label="Height"
                 value="${exportDefaults.height ?? manifest.render.height}" min="1" max="100000" step="any">
        </div>
        <select class="dim-unit" data-action="export-unit" aria-label="Units"
                title="Units for width & height. Physical units (mm/cm/in/pt) export at the right size for print — PDF as a true page, raster at the chosen DPI.">
          ${UNITS.map(u => `<option value="${u}" ${u === initUnit ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
        <label class="dim-dpi" data-dpi-field style="display:${initUnit === 'px' ? 'none' : 'inline-flex'}"
               title="Raster resolution for physical units (ignored for vector formats).">
          <input type="number" data-action="export-dpi" value="${initDpi}" min="36" max="1200" step="1" aria-label="DPI">
          <span>dpi</span>
        </label>
      </div>` : '';

  // Editor-only aspect-ratio guard (manifest.render.aspectWarning). A hidden alert
  // beside the dimension controls, shown when the chosen page size falls outside the
  // tool's supported orientation band — see updateAspectWarning(). Never exported.
  const ICON_WARN = `<svg class="aspect-warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const aspectWarnRow = (manifest.render.aspectWarning && manifest.render.dims !== false)
    ? `<div class="export-aspect-warning" data-aspect-warning role="alert" hidden>${ICON_WARN}<span data-aspect-warning-text></span></div>`
    : '';

  // Tier 2.5 — colour profile (Print PDF only). The CMYK press condition embedded
  // in the PDF's OutputIntent. A self-contained card so this professional/print
  // setting reads as deliberate; revealed only when "Print PDF" (pdf-cmyk) is the
  // chosen format. Options come from the engine's CMYK_CONDITIONS registry.
  const ICON_DROP = `<svg class="cmyk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7s6.5 7 6.5 11.8a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.7 12 2.7z"/></svg>`;
  const hasCmyk     = formats.includes('pdf-cmyk') || formats.includes('cmyk-tiff');
  const initProfile = (exportDefaults.profile && CMYK_CONDITIONS[exportDefaults.profile])
    ? exportDefaults.profile : DEFAULT_CMYK_CONDITION;
  const cmykOptions = Object.entries(CMYK_CONDITIONS)
    .map(([key, c]) => `<option value="${escape(key)}" ${key === initProfile ? 'selected' : ''}>${escape(c.info)}</option>`)
    .join('');
  const cmykRow = hasCmyk ? `
      <div class="export-cmyk" data-cmyk-only style="display:${isCmykFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="cmyk-head">${ICON_DROP}<span>Color profile</span></span>
        <select data-action="cmyk-profile" aria-label="CMYK press profile"
                title="The CMYK press condition your printer targets — embedded as the Print PDF's output intent, recorded in the Print TIFF's metadata.">
          ${cmykOptions}
        </select>
        <p class="cmyk-hint">Names the CMYK press standard your printer targets — the Print PDF embeds it as its output intent; the Print TIFF records it in metadata (the pixels stay untagged DeviceCMYK).</p>
      </div>` : '';

  // Tier 2.6 — PDF password (standard "PDF" only). A non-empty value locks the
  // exported PDF on open (jsPDF standard security handler, copy/modify restricted).
  // Revealed only when "PDF" is chosen — the print-PDF path (pdf-cmyk) re-saves
  // through pdf-lib, which can't write encrypted PDFs.
  //
  // URL-expressible by design: a `?password=` link can pre-set it for quick,
  // short-lived transactional use (event materials etc). That's clear-text in the
  // URL — an accepted trade-off for a basic lock, not for confidential material.
  // It is NOT persisted to the library at rest (see performSave); URL is the only
  // way it round-trips. The initial value below comes from the URL only.
  // Collapsed by default — a click-to-expand disclosure (mirrors the Print marks
  // card) so the field + caveat only surface when wanted, keeping the panel tight.
  // Pre-opened when a value arrives (e.g. ?password=) so it's visible. Collapse is
  // purely visual: the input remains the source of truth, so a typed value still
  // applies on export and survives collapse/expand.
  const ICON_LOCK = `<svg class="pdfpass-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const hasPdf = formats.includes('pdf');
  const pdfPassInitOpen = Boolean(exportDefaults.password);
  const pdfPassRow = hasPdf ? `
      <div class="export-pdfpass${pdfPassInitOpen ? ' is-open' : ''}" data-pdf-only style="display:${initialFmt === 'pdf' ? 'flex' : 'none'}">
        <button type="button" class="pdfpass-head" data-action="pdfpass-toggle" aria-expanded="${pdfPassInitOpen}">${ICON_LOCK}<span>Password protect</span></button>
        <div class="pdfpass-body" data-pdfpass-body style="display:${pdfPassInitOpen ? 'flex' : 'none'}">
          <input type="password" data-action="pdf-password" autocomplete="new-password" spellcheck="false"
                 value="${escape(exportDefaults.password ?? '')}"
                 placeholder="Leave blank for no password" aria-label="PDF open password">
          <p class="pdfpass-hint">Requires this password to open the PDF. A basic lock, not strong encryption — don't rely on it for highly confidential files.</p>
        </div>
      </div>` : '';

  // Tier 2.65 — Content Credentials (standard "PDF" only, like the password card;
  // shares its [data-pdf-only] visibility). Checking it appends a signed C2PA
  // manifest to the finished PDF (the export bridge stamps it as the last byte
  // operation — see stampC2pa in bridge/export.js). Mutually exclusive with the
  // open-password: an encrypted document can't take the C2PA incremental update
  // (see refreshC2paUi). A tool pre-selects it via manifest render.c2pa.
  const ICON_CRED = `<svg class="c2pa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 11.5 2 2 4-4"/></svg>`;
  const c2paInitOn = manifest.render?.c2pa === true;
  const c2paRow = hasPdf ? `
      <div class="export-c2pa" data-pdf-only style="display:${initialFmt === 'pdf' ? 'flex' : 'none'}">
        <label class="c2pa-enable">
          <input type="checkbox" data-action="pdf-c2pa" ${c2paInitOn ? 'checked' : ''}>
          <span class="c2pa-head">${ICON_CRED}<span>Content Credentials</span></span>
        </label>
        <p class="c2pa-hint">Embeds a signed C2PA manifest recording that this file was made with Lolly. Signed with an on-device key, so viewers will show it as an unverified credential.</p>
      </div>` : '';

  // Tier 2.7 — print marks & bleed (pdf / pdf-cmyk / cmyk-tiff). An opt-in card
  // (master checkbox) so ordinary output stays trim-sized; turning it on reveals a
  // bleed field (default 3mm) + the mark toggles at print-standard defaults. Mark
  // size, gap and stroke weight are fixed in the engine (see print-marks.js).
  const ICON_CROP = `<svg class="print-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v16h16"/><path d="M2 6h16v16"/></svg>`;
  // Print finishing applies to a single trim-sized artwork; tools that emit
  // per-page boxes (multi-page PDF) opt out via render.printMarks:false so the
  // card isn't shown promising marks the multi-page export path doesn't apply.
  const hasPrint     = (hasPdf || hasCmyk) && manifest.render.printMarks !== false;
  const printInitOn  = Boolean(exportDefaults.bleed || exportDefaults.marks);
  const printInitMm  = exportDefaults.bleed ? (parseFloat(exportDefaults.bleed) || 3) : 3;
  // Colour bars default ON for the CMYK print formats (the press uses them as a
  // control strip), OFF for the RGB pdf. An explicit marks default (link/save) wins.
  // 'Stamp details' (provenance) is always pre-checked: the credit stamp is on by
  // default whenever the print-marks card is enabled, regardless of any remembered
  // marks state. The other marks still restore from saved/linked defaults.
  const pim          = { ...DEFAULT_PRINT_MARKS, colorBars: isCmykFmt(initialFmt), ...(exportDefaults.marks || {}), provenance: true };
  const printRow = hasPrint ? `
      <div class="export-print" data-printmarks-only style="display:${isPrintFmt(initialFmt) ? 'flex' : 'none'}">
        <label class="print-enable">
          <input type="checkbox" data-action="print-enable" ${printInitOn ? 'checked' : ''}>
          <span class="print-head">${ICON_CROP}<span>Print marks &amp; bleed</span></span>
        </label>
        <div class="print-body" data-print-body style="display:${printInitOn ? 'flex' : 'none'}">
          <label class="print-bleed">
            <span>Bleed</span>
            <input type="number" data-action="print-bleed" value="${printInitMm}" min="0" max="25" step="0.5" aria-label="Bleed in millimetres">
            <span>mm</span>
          </label>
          <div class="print-toggles">
            <label class="export-option"><input type="checkbox" data-action="mark-crop" ${pim.crop ? 'checked' : ''}> Crop</label>
            <label class="export-option"><input type="checkbox" data-action="mark-reg" ${pim.registration ? 'checked' : ''}> Registration</label>
            <label class="export-option"><input type="checkbox" data-action="mark-bleed" ${pim.bleed ? 'checked' : ''}> Bleed</label>
            <label class="export-option"><input type="checkbox" data-action="mark-bars" ${pim.colorBars ? 'checked' : ''}> Color bars</label>
            <label class="export-option"><input type="checkbox" data-action="mark-prov" ${pim.provenance ? 'checked' : ''}> Stamp details</label>
          </div>
          <p class="print-hint">Adds bleed and the chosen marks for a print shop; the artwork is scaled to fill the bleed. Registration marks print on all four plates in the Print PDF and Print TIFF. (An open-password can't be combined with marks.)</p>
        </div>
      </div>` : '';

  // Tier 3 — ancillary settings. Everything optional (transparent bg, timing,
  // dithering) lives in one wrapping chip cluster so the panel reads consistently
  // no matter which controls a given tool/format enables.
  const optionChips = exportOpts.map(i => {
    // 'Convert paths' only affects vector output, so its chip is gated to the
    // selected format (hidden for png/jpg/etc). Other export options are global.
    const vectorOnly = i.id === 'convertPaths';
    const hide = vectorOnly && !isVectorFmt(initialFmt);
    return `
        <label class="export-option"${vectorOnly ? ' data-vector-only' : ''}${hide ? ' style="display:none"' : ''}>
          <input type="checkbox" data-input-id="${escape(i.id)}" ${i.value ? 'checked' : ''}>
          ${escape(i.label ?? i.id)}
        </label>`;
  }).join('');
  const videoChip = hasAnimated ? `
        <div class="video-params" data-anim-params style="display:${isAnimatedFmt(initialFmt) ? 'flex' : 'none'}">
          <span class="vp-field"><span>Wait</span>
            <input type="number" data-action="video-wait" value="${defaultWait}" min="0" max="30" step="0.5"><span>s</span></span>
          <span class="vp-field"><span>Duration</span>
            <input type="number" data-action="video-duration" value="${defaultDuration}" min="1" max="60" step="0.5"><span>s</span></span>
          <label class="gif-dither-toggle" data-gif-only
                 style="display:${initialFmt === 'gif' ? 'flex' : 'none'}">
            <input type="checkbox" data-action="gif-dither">
            Dither
          </label>
          <label class="gif-dither-toggle" data-webm-only
                 style="display:${initialFmt === 'webm' ? 'flex' : 'none'}">
            <input type="checkbox" data-action="webm-60fps">
            60fps
          </label>
          ${runtime.hasFrameHook ? `<span class="vp-live-hint" style="flex-basis:100%;font-size:11px;opacity:.7;margin-top:2px">Records the live feed — start <strong>Go&nbsp;live</strong> on the canvas first.</span>` : ''}
        </div>` : '';
  // Full-page chip — HTML export only. Drops the fixed-size tool-canvas frame so
  // the saved page fills the whole browser window instead of a centred card.
  const hasHtml  = formats.includes('html');
  const htmlChip = hasHtml ? `
        <label class="export-option" data-html-only style="display:${initialFmt === 'html' ? 'flex' : 'none'}"
               title="Drop the fixed-size canvas frame so the saved page fills the whole window.">
          <input type="checkbox" data-action="full-page" ${exportDefaults.nostage ? 'checked' : ''}>
          Full page
        </label>` : '';
  const settingsRow = (optionChips || videoChip || htmlChip)
    ? `<div class="export-settings">${optionChips}${htmlChip}${videoChip}</div>`
    : '';

  // Tier 4 — actions. Copy · Save · Share share one equal-width row; Download is
  // the primary CTA, alone on its own full-width line at the very bottom.
  const CLIPBOARD_SVG = `<svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`;
  const copyBtn = actions.includes('copy')
    ? `<button data-action="copy" class="copy-btn" title="Copy to clipboard">${CLIPBOARD_SVG}<span>Copy</span></button>` : '';
  const saveBtn = actions.includes('save')
    ? `<button data-action="save" class="save-btn" title="Save to your library">${SAVE_SVG}<span data-save-label>Save</span></button>` : '';
  const downloadBtn = actions.includes('download')
    ? `<button data-action="download">Download${formats.length === 1 ? ' ' + fmtLabel(formats[0]) : ''}</button>`
    : '';
  const secondaryRow = `<div class="export-action-buttons">${copyBtn}${saveBtn}${copyUrlBtn}</div>`;
  const downloadRow = downloadBtn ? `<div class="export-action-buttons">${downloadBtn}</div>` : '';

  el.innerHTML = `
    ${actions.includes('download') ? `${filenameRow}${dimsRow}${aspectWarnRow}${cmykRow}${pdfPassRow}${c2paRow}${printRow}${settingsRow}` : ''}
    ${secondaryRow}
    ${downloadRow}
  `;

  exportOpts.forEach(i => {
    el.querySelector(`[data-input-id="${escape(i.id)}"]`)
      ?.addEventListener('change', ({ target }) => runtime.setInput(i.id, target.checked));
  });

  const animParamsEl  = el.querySelector('[data-anim-params]');
  const ditherEl      = el.querySelector('[data-gif-only]');
  const webm60El      = el.querySelector('[data-webm-only]');
  const formatEl      = el.querySelector('[data-action="format"]');
  const aspectWarnEl  = el.querySelector('[data-aspect-warning]');

  // Colour bars track the format: ON for the CMYK print formats (pdf-cmyk /
  // cmyk-tiff), OFF for the RGB pdf, re-applied on every format switch — until the
  // user toggles them, or a shared link set marks explicitly, after which their
  // choice is left alone.
  let barsUserSet = Boolean(exportDefaults.marks);
  const syncBarsDefault = (fmt) => {
    if (barsUserSet) return;
    const bars = el.querySelector('[data-action="mark-bars"]');
    if (bars) bars.checked = isCmykFmt(fmt);
  };

  // Show/hide timing params and format-specific controls when the format selector changes.
  if (formatEl) {
    formatEl.addEventListener('change', () => {
      const fmt = formatEl.value;
      if (animParamsEl) animParamsEl.style.display = isAnimatedFmt(fmt) ? 'flex' : 'none';
      if (ditherEl)     ditherEl.style.display     = fmt === 'gif'  ? 'flex' : 'none';
      if (webm60El)     webm60El.style.display      = fmt === 'webm' ? 'flex' : 'none';
      el.querySelectorAll('[data-vector-only]').forEach(c => { c.style.display = isVectorFmt(fmt) ? 'flex' : 'none'; });
      el.querySelectorAll('[data-html-only]').forEach(c => { c.style.display = fmt === 'html' ? 'flex' : 'none'; });
      el.querySelectorAll('[data-cmyk-only]').forEach(c => { c.style.display = isCmykFmt(fmt) ? 'flex' : 'none'; });
      el.querySelectorAll('[data-printmarks-only]').forEach(c => { c.style.display = isPrintFmt(fmt) ? 'flex' : 'none'; });
      syncBarsDefault(fmt);
      refreshPrintUi(); // owns [data-pdf-only] (password) visibility — see below
      onUrlSync?.('format');
      onUrlSync?.('marks');  // bars may have flipped with the format
    });
  }

  // Print marks card: reveal its body when enabled, and hide the open-password
  // card while it's on (marks/bleed route through pdf-lib, which can't encrypt).
  function refreshPrintUi() {
    const on  = el.querySelector('[data-action="print-enable"]')?.checked;
    const fmt = formatEl?.value ?? initialFmt;
    const body = el.querySelector('[data-print-body]');
    if (body) body.style.display = on ? 'flex' : 'none';
    el.querySelectorAll('[data-pdf-only]').forEach(c => { c.style.display = (fmt === 'pdf' && !on) ? 'flex' : 'none'; });
  }
  el.querySelector('[data-action="print-enable"]')?.addEventListener('change', () => {
    refreshPrintUi(); onUrlSync?.('bleed'); onUrlSync?.('marks');
  });
  el.querySelector('[data-action="print-bleed"]')?.addEventListener('input', () => onUrlSync?.('bleed'));
  ['mark-crop', 'mark-reg', 'mark-bleed', 'mark-bars', 'mark-prov'].forEach(a =>
    el.querySelector(`[data-action="${a}"]`)?.addEventListener('change', () => {
      if (a === 'mark-bars') barsUserSet = true;  // stop auto-tracking once chosen
      onUrlSync?.('marks');
    }));
  refreshPrintUi(); // initial state (e.g. card pre-opened from a shared link)

  // Colour profile (CMYK press condition) — print-PDF only; persists via URL/save.
  el.querySelector('[data-action="cmyk-profile"]')?.addEventListener('change', () => onUrlSync?.('profile'));

  el.querySelector('[data-action="filename"]')?.addEventListener('input', () => onUrlSync?.('filename'));

  // Full-page HTML export toggle ("no stage") — round-trips through the URL as ?nostage.
  el.querySelector('[data-action="full-page"]')?.addEventListener('change', () => onUrlSync?.('nostage'));

  // PDF open-password — clear-text in the URL by design (see pdfPassRow). Syncs on
  // input so a crafted/edited link round-trips; syncUrl gates it to the pdf format.
  el.querySelector('[data-action="pdf-password"]')?.addEventListener('input', () => onUrlSync?.('password'));

  // Password protect disclosure — the header toggles the body open/closed (purely
  // visual; the input value still drives export). Focus the field on expand.
  el.querySelector('[data-action="pdfpass-toggle"]')?.addEventListener('click', () => {
    const card = el.querySelector('.export-pdfpass');
    const open = card?.classList.toggle('is-open') ?? false;
    const body = el.querySelector('[data-pdfpass-body]');
    if (body) body.style.display = open ? 'flex' : 'none';
    el.querySelector('[data-action="pdfpass-toggle"]')?.setAttribute('aria-expanded', String(open));
    if (open) el.querySelector('[data-action="pdf-password"]')?.focus();
  });

  // Content Credentials ↔ open-password exclusion: an encrypted PDF can't take
  // the C2PA incremental update, so whichever is active disables the other
  // (mirrors the marks-vs-password exclusion in refreshPrintUi). Checking the
  // box clears a typed password; a typed password (or a ?password= link — the
  // initial call below) unchecks the box and wins over a tool's render.c2pa.
  const c2paEl    = el.querySelector('[data-action="pdf-c2pa"]');
  const pdfPassEl = el.querySelector('[data-action="pdf-password"]');
  function refreshC2paUi(changed) {
    if (!c2paEl || !pdfPassEl) return;
    if (changed === 'c2pa' && c2paEl.checked && pdfPassEl.value) {
      pdfPassEl.value = '';
      onUrlSync?.('password');
    }
    if (pdfPassEl.value) c2paEl.checked = false;
    c2paEl.disabled    = Boolean(pdfPassEl.value);
    pdfPassEl.disabled = c2paEl.checked;
  }
  c2paEl?.addEventListener('change', () => refreshC2paUi('c2pa'));
  pdfPassEl?.addEventListener('input', () => refreshC2paUi('password'));
  refreshC2paUi(); // initial state (?password= link vs a c2pa-default tool)

  const dimUnit = () => el.querySelector('[data-action="export-unit"]')?.value || 'px';
  const dimDpi  = () => { const n = parseInt(el.querySelector('[data-action="export-dpi"]')?.value, 10); return n > 0 ? n : 300; };
  // Raw numeric values the user typed, in the active unit.
  function rawDims() {
    const w = parseFloat(el.querySelector('[data-action="export-width"]')?.value);
    const h = parseFloat(el.querySelector('[data-action="export-height"]')?.value);
    return { w: w > 0 ? w : undefined, h: h > 0 ? h : undefined };
  }

  // Export dimensions: values qualified with the active unit (+ DPI for physical
  // units) so the engine converts per format. Vector ignores DPI; raster uses it.
  function exportDims() {
    if (manifest.render.dims === false) {
      return { width: manifest.render.width, height: manifest.render.height };
    }
    const { w, h } = rawDims();
    const u = dimUnit();
    const q = (v) => (v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
    const out = { width: q(w), height: q(h) };
    if (u !== 'px') out.dpi = dimDpi();
    return out;
  }

  // On-screen preview is CSS px: physical units shown at their 96-DPI px size.
  function previewPx() {
    const { w, h } = rawDims();
    const u = dimUnit();
    const toPx = (v) => (v > 0 ? (u === 'px' ? v : toCssPx({ value: v, unit: u })) : undefined);
    return { width: toPx(w), height: toPx(h) };
  }

  // Editor-only aspect-ratio guard. Evaluate the current page size (in px, so the
  // unit drops out of the ratio) against the tool's declared band and show/hide the
  // warning beside the dimension fields. Driven from refreshCanvasPreview, so it
  // tracks both typed dimensions and a size-select change. Never touches the canvas.
  function updateAspectWarning() {
    if (!aspectWarnEl) return;
    const { width, height } = previewPx();
    const msg = aspectWarning(manifest, width, height);
    aspectWarnEl.querySelector('[data-aspect-warning-text]').textContent = msg ?? '';
    aspectWarnEl.hidden = !msg;
  }

  // Print marks & bleed export opts (pdf / pdf-cmyk / cmyk-tiff). Empty when the card is off,
  // so an ordinary PDF stays trim-sized with no marks.
  function printOpts() {
    if (!printEnabled(el)) return {};
    const mm = parseFloat(el.querySelector('[data-action="print-bleed"]')?.value);
    return {
      bleed: mm > 0 ? `${mm}mm` : undefined,
      cropMarks:         el.querySelector('[data-action="mark-crop"]')?.checked ?? false,
      registrationMarks: el.querySelector('[data-action="mark-reg"]')?.checked ?? false,
      bleedMarks:        el.querySelector('[data-action="mark-bleed"]')?.checked ?? false,
      colorBars:         el.querySelector('[data-action="mark-bars"]')?.checked ?? false,
      provenance:        el.querySelector('[data-action="mark-prov"]')?.checked ?? false,
    };
  }

  function videoParams() {
    const wait     = parseFloat(el.querySelector('[data-action="video-wait"]')?.value)     ?? 1;
    const duration = parseFloat(el.querySelector('[data-action="video-duration"]')?.value) ?? 5;
    const hiFps    = el.querySelector('[data-action="webm-60fps"]')?.checked ?? false;
    return {
      wait:     isFinite(wait)     ? Math.max(0,  wait)     : 1,
      duration: isFinite(duration) ? Math.max(0.5, duration) : 5,
      fps:      hiFps ? 60 : undefined,
    };
  }

  // Preview the export aspect ratio on the canvas, then re-fit to the stage.
  function refreshCanvasPreview() {
    updateAspectWarning(); // first, so it reflects current fields even when dims are incomplete
    const { width: w, height: h } = previewPx();
    if (!(w > 0 && h > 0)) return;
    const previewScale = Math.min(1, manifest.render.width / w, manifest.render.height / h);
    canvasEl.style.width  = Math.round(w * previewScale) + 'px';
    canvasEl.style.height = Math.round(h * previewScale) + 'px';
    fitCanvas();
    // If the tool declares width/height inputs, sync dims so hooks can recompute layout.
    const model = runtime.getModel();
    const hasW = model.some(i => i.id === 'width');
    const hasH = model.some(i => i.id === 'height');
    if (hasW || hasH) {
      // Chain to avoid concurrent hook executions on the shared model. Use the UNWRAPPED
      // setter (runtime.setInputNoHistory, installed by mountTool) — NOT the history-
      // wrapped runtime.setInput — so this PROGRAMMATIC px sync, fired at mount and on
      // every unit/dimension change, never lands in the undo history or wipes the redo
      // chain. The user's own edits to a width/height field still go through the wrapped
      // setInput and stay undoable. baseSetInput is local to mountTool and out of scope
      // here; fall back to the wrapped setter if no wrapper was installed (e.g. a child
      // runtime) so this can never throw at boot.
      const setDims = runtime.setInputNoHistory || runtime.setInput;
      const p = hasW ? setDims('width', w) : Promise.resolve();
      p.then(() => { if (hasH) setDims('height', h); });
      // subscriber fires runTemplateScripts + syncUrl after each setInput
    } else {
      runTemplateScripts(canvasEl);
      onUrlSync?.();
    }
  }
  // Deferred-preview tools (manifest.render.preview): a painted preview is only
  // valid for the geometry it was captured at, so any change to the export size,
  // unit or DPI must drop back to the placeholder + its "click to preview"
  // button — exactly as changing a sidebar input does. Re-emitting
  // rebuilds the canvas from the model through the one render path (which clears
  // the painted [data-capture] image). No-op for ordinary tools, whose live
  // canvas is the preview. Format/filename don't change captured pixels, so they
  // leave the preview intact.
  const invalidatePreview = manifest.render.preview ? () => runtime.refresh() : () => {};

  // Brief, editor-only outline pulse on the canvas while the export size is being
  // changed (scrub / scroll / type), so a resize reads as deliberate. Applied to
  // the OUTER wrapper — never the exported #tool-canvas — so it can't bleed into
  // output, and removed shortly after the last change; the CSS handles the fade.
  // Re-armed on every change, so a continuous drag holds it on, then it lapses.
  const canvasOuterEl = canvasEl?.closest('.tool-canvas-outer') ?? canvasEl?.parentElement ?? null;
  let dimPulseTimer = 0;
  function pulseCanvasResize() {
    if (!canvasOuterEl) return;
    canvasOuterEl.classList.add('is-resizing');
    clearTimeout(dimPulseTimer);
    dimPulseTimer = setTimeout(() => canvasOuterEl.classList.remove('is-resizing'), 450);
  }

  // Label the floating scrub readout with the value + current unit (e.g. "1024 px",
  // "210 mm") so a drag reads clearly even with the cursor/finger over the field.
  // (dimUnit() is defined above with the other dimension helpers.)
  [
    [el.querySelector('[data-action="export-width"]'),  'w'],
    [el.querySelector('[data-action="export-height"]'), 'h'],
  ].forEach(([inp, key]) => {
    if (!inp) return;
    const onDimChange = () => { onUrlSync?.(key); refreshCanvasPreview(); invalidatePreview(); pulseCanvasResize(); };
    inp.addEventListener('input', onDimChange);
    addScrubBehavior(inp, onDimChange, { format: v => `${v} ${dimUnit()}` });
  });

  // Apply a {width,height,unit} from a size-select option to the export-bar fields,
  // so choosing a size sets the actual exported page size. Refreshes the preview +
  // URL just like a manual edit. The user can still override the fields afterwards.
  function setDims({ width, height, unit } = {}) {
    if (manifest.render.dims === false) return;
    const uEl = el.querySelector('[data-action="export-unit"]');
    if (uEl && unit) {
      uEl.value = unit;
      const dpiField = el.querySelector('[data-dpi-field]');
      if (dpiField) dpiField.style.display = unit === 'px' ? 'none' : 'inline-flex';
    }
    const wEl = el.querySelector('[data-action="export-width"]');
    const hEl = el.querySelector('[data-action="export-height"]');
    if (wEl && width > 0) wEl.value = String(width);
    if (hEl && height > 0) hEl.value = String(height);
    refreshCanvasPreview();
    invalidatePreview();
    pulseCanvasResize();
    onUrlSync?.('unit'); onUrlSync?.('w'); onUrlSync?.('h');
  }

  // Unit switch keeps the physical size: convert the typed values to the new
  // unit, toggle the DPI field, refresh the preview, and sync the URL.
  const unitSel = el.querySelector('[data-action="export-unit"]');
  const dpiFieldEl = el.querySelector('[data-dpi-field]');
  let curUnit = initUnit;
  unitSel?.addEventListener('change', () => {
    const to = unitSel.value;
    const wEl = el.querySelector('[data-action="export-width"]');
    const hEl = el.querySelector('[data-action="export-height"]');
    const conv = (v) => { const n = parseFloat(v); return n > 0 ? String(Math.round(toCssPx({ value: n, unit: curUnit }) / (toCssPx({ value: 1, unit: to })) * 100) / 100) : v; };
    if (wEl) wEl.value = conv(wEl.value);
    if (hEl) hEl.value = conv(hEl.value);
    curUnit = to;
    if (dpiFieldEl) dpiFieldEl.style.display = (to === 'px') ? 'none' : 'inline-flex';
    onUrlSync?.('unit'); onUrlSync?.('w'); onUrlSync?.('h');
    refreshCanvasPreview();
    invalidatePreview();
    pulseCanvasResize();
  });
  el.querySelector('[data-action="export-dpi"]')?.addEventListener('input', () => { onUrlSync?.('dpi'); invalidatePreview(); });

  el.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
    // performCopy drives the camera-shutter itself (fullscreen on mobile), per
    // path: the image path GATES the off-screen resize ("shake") behind the closed
    // shutter — like exports do — while keeping the clipboard write in the user
    // gesture by handing the shutter-delayed blob promise to ClipboardItem; the
    // text/html paths play it as parallel feedback (they have no such resize).
    performCopy().then((res) => {
      bumpMetric('imagesCopied');
      // Honest feedback: on browsers without image-clipboard support the bridge
      // downloads the file instead, so don't claim it was copied.
      announce(res?.method === 'download'
        ? 'Clipboard image not supported here — downloaded instead'
        : 'Copied to clipboard');
    }).catch(err => console.error('Copy failed:', err));
  });

  // Copies the current render to the clipboard. Shared by the Copy button and
  // the `?copy` URL action. `fmtOverride` honours `?format=<format>&copy`.
  async function performCopy(fmtOverride) {
    const fmt = fmtOverride
      || formatEl?.value
      || (formats.includes('png') ? 'png' : formats[0]);

    // Universal copy, by format:
    //   • txt / md   → plain text
    //   • html       → rich HTML (so an email signature pastes formatted into Gmail)
    //   • everything else (raster, SVG, PDF, …) → a PNG bitmap
    // so a paste always yields something useful whatever format is selected.
    const TEXT_FORMATS = new Set(['txt', 'md', 'markdown']);
    if (TEXT_FORMATS.has(fmt)) {
      playShutter();   // parallel capture feedback — writeText must stay in-gesture
      const blob = await exportUnscaled(() => runtime.export(canvasEl, fmt, exportDims()));
      await host.clipboard.writeText(await blob.text());
      return;
    }

    if (fmt === 'html') {
      playShutter();   // parallel capture feedback — no off-screen resize to hide here
      // Clone the canvas, then scrub everything email clients strip or ignore.
      const clone = canvasEl.cloneNode(true);
      clone.querySelectorAll('[data-canvas-input]').forEach(el => el.removeAttribute('data-canvas-input'));
      clone.querySelectorAll('script').forEach(el => el.remove());
      // <style> blocks — email clients (Gmail etc.) strip them; the template
      // already carries full inline styles so these are pure character waste.
      clone.querySelectorAll('style').forEach(el => el.remove());
      // Annotation comment markers (<!-- ci:id -->) — invisible, ~30 chars each.
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
      const comments = [];
      let commentNode;
      while ((commentNode = walker.nextNode())) comments.push(commentNode);
      comments.forEach(n => n.parentNode?.removeChild(n));

      // Wrap the async blob-URL → data-URL conversion in a Promise so ClipboardItem
      // receives it while navigator.clipboard.write() is still in gesture context.
      const htmlBlobPromise = (async () => {
        // Email signatures display at ≤200px, so cap encoding there; html tools
        // needing larger images can raise this in their own beforeExport hook.
        await Promise.all([...clone.querySelectorAll('img')].map(async img => {
          const src = img.getAttribute('src');
          if (!src?.startsWith('blob:')) return;
          try {
            const dataUrl = await new Promise((res, rej) => {
              const bmp = new Image();
              bmp.onload = () => {
                const MAX = 200;
                const scale = Math.min(1, MAX / Math.max(bmp.naturalWidth, bmp.naturalHeight));
                const w = Math.round(bmp.naturalWidth * scale);
                const h = Math.round(bmp.naturalHeight * scale);
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(bmp, 0, 0, w, h);
                res(c.toDataURL('image/jpeg', 0.75));
              };
              bmp.onerror = rej;
              bmp.src = src;
            });
            img.src = dataUrl;
          } catch { /* leave as-is if conversion fails */ }
        }));
        return new Blob([clone.innerHTML], { type: 'text/html' });
      })();

      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          const textBlob = htmlBlobPromise.then(b => b.text().then(
            t => { const d = document.createElement('div'); d.innerHTML = t; return new Blob([d.textContent ?? ''], { type: 'text/plain' }); }
          ));
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlobPromise, 'text/plain': textBlob })]);
          return;
        } catch { /* fall through to the bridge path */ }
      }
      await host.clipboard.writeHtml(await htmlBlobPromise.then(b => b.text()));
      return;
    }

    // Image copy. { shutter: true } closes the camera-iris BEFORE the off-screen
    // resize so its brief "shake" is hidden — exactly like exports — then opens it.
    // The clipboard write still stays in the user gesture because we hand the
    // shutter-delayed blob *promise* straight to ClipboardItem rather than awaiting
    // it first (awaiting before write() loses the gesture and the browser silently
    // denies the write; deferring the blob inside the promise is the cross-browser
    // pattern that survives the ~shutter delay). One export feeds both paths.
    const blobPromise = exportUnscaled(() => runtime.export(canvasEl, 'png', exportDims()), { shutter: true });
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
        return { method: 'clipboard' };
      } catch { /* fall through to the bridge path — blobPromise has already resolved */ }
    }
    // Bridge path: image clipboard write unavailable (e.g. older Firefox) — this
    // returns { method: 'download' } when it falls back to saving the file instead.
    return host.clipboard.writeImage(await blobPromise);
  }

  el.querySelector('[data-action="download"]')?.addEventListener('click', async (e) => {
    const btn  = e.currentTarget;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    const fmt        = formatEl?.value ?? formats[0];
    const isAnimated = isAnimatedFmt(fmt);
    const isGif      = fmt === 'gif';

    if (isAnimated) {
      const { wait, duration, fps } = videoParams();
      const totalS = wait + duration;
      btn.textContent = isGif
        ? `Encoding GIF… ${totalS}s`
        : fps === 60
          ? `Rendering 60fps… ${totalS}s+`
          : `Recording… ${totalS}s`;
    } else {
      // Slow non-animated exports (CMYK TIFF, high-DPI raster, PDF) previously froze
      // on a disabled button with no signal. Show progress and tell assistive tech.
      btn.textContent = 'Exporting…';
    }
    announce('Exporting…');

    try {
      const opts = {
        ...exportDims(),
        ...(isAnimated ? videoParams() : {}),
        ...(isGif ? { dither: el.querySelector('[data-action="gif-dither"]')?.checked ?? false } : {}),
        ...(fmt === 'html' ? { fullPage: el.querySelector('[data-action="full-page"]')?.checked ?? false } : {}),
        ...(isPrintFmt(fmt) ? printOpts() : {}),
        ...(fmt === 'pdf-cmyk' ? { palette: PALETTE } : {}),
        ...(isCmykFmt(fmt) ? {
          colorProfile: el.querySelector('[data-action="cmyk-profile"]')?.value || DEFAULT_CMYK_CONDITION,
        } : {}),
        ...(fmt === 'pdf' && el.querySelector('[data-action="pdf-password"]')?.value
          ? { password: el.querySelector('[data-action="pdf-password"]').value }
          : {}),
        ...(fmt === 'pdf' && el.querySelector('[data-action="pdf-c2pa"]')?.checked ? { c2pa: true } : {}),
        ...(fmt === 'zip' ? {
          ...printOpts(),   // bundled pdf / pdf-cmyk get marks & bleed; rasters ignore them
          palette: PALETTE,
          colorProfile: el.querySelector('[data-action="cmyk-profile"]')?.value || DEFAULT_CMYK_CONDITION,
          filename: el.querySelector('[data-action="filename"]')?.value.trim() || manifest.name,
          bundleFormats: formats.filter(f => ZIP_BUNDLE.has(f)),
        } : {}),
      };
      // Mask the resize with the shutter for instant (raster/vector) exports;
      // skip it for animated formats, which record the live canvas over seconds.
      const blob = await exportUnscaled(() => runtime.export(canvasEl, fmt, opts), { shutter: !isAnimated });
      const filename = el.querySelector('[data-action="filename"]')?.value.trim() || manifest.name;
      await host.export.download(blob, `${filename}.${extFor(fmt, blob)}`);
      bumpMetric('filesRendered'); recordFormat(fmt); // local usage metric
    } catch (err) {
      console.error('Export failed:', err);
      btn.removeAttribute('aria-busy');
      btn.textContent = 'Export failed';
      announce('Export failed', { assertive: true });
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 3000);
      return;
    }

    btn.removeAttribute('aria-busy');
    btn.textContent = prev;
    btn.disabled = false;
    announce('Export complete');
  });

  el.querySelector('[data-action="save"]')?.addEventListener('click', async function () {
    if (await performSave(this)) setTimeout(() => { navigateTo(returnTo); }, 800);
  });

  // Apply the initial (or restored) dimensions to the canvas preview immediately.
  refreshCanvasPreview();

  // Render to the live frame for PREVIEW only (deferred-preview tools — see
  // manifest.render.preview). We run the normal export pipeline purely for its
  // side effect: an expensive beforeExport hook (e.g. url-shot's page capture)
  // paints its result into the canvas DOM. We then discard the blob — no
  // download, no clipboard. The painted frame stays until the next input change
  // rebuilds the template (which correctly invalidates the stale preview).
  let previewing = false;
  async function preview() {
    if (previewing) return;
    previewing = true;
    try {
      const fmt = manifest.render.preview?.format || manifest.render.formats[0];
      await exportUnscaled(() => runtime.export(canvasEl, fmt, exportDims()));
    } finally {
      previewing = false;
    }
  }

  // Expose actions the mount scope can trigger programmatically (e.g. `?copy`,
  // and the unsaved-changes dialog's "Save & leave").
  return { copy: performCopy, preview, save: performSave, setDims };
}

function matchesDefault(input, paramVal) {
  const def = input.default;
  if (def == null) return false;
  if (input.type === 'blocks') return false;
  if (input.type === 'boolean') return (paramVal === '1' || paramVal === 'true') === !!def;
  if (input.type === 'number')  return Number(paramVal) === Number(def);
  if (input.type === 'color')   return paramVal.replace(/^#/, '').toLowerCase() === String(def).replace(/^#/, '').toLowerCase();
  return paramVal === String(def);
}

/**
 * Remove URL params from the live address bar that already equal the tool's defaults.
 * Operates on the raw query string to preserve compact encodings (e.g. ~,).
 */
async function shrinkUrl(runtime, manifest, barSeq) {
  // The bar is normally the path form /t/<id>?… by now; tolerate the boot-time hash
  // form too. Keep the route part, rewrite only the query.
  const hashQ = window.location.hash.indexOf('?');
  const rawQs = window.location.search ? window.location.search.slice(1)
           : (hashQ >= 0 ? window.location.hash.slice(hashQ + 1) : '');
  if (!rawQs) return;
  const base = window.location.pathname + window.location.hash.split('?')[0];

  // If the bar is already packed, expand it back to the readable query so the
  // default-stripping below can see individual params (it operates per-key).
  const qs = hasPackedState(rawQs) ? await expandQuery(rawQs) : rawQs;

  const model = runtime.getModel();
  const inputsByKey = {};
  for (const input of model) {
    inputsByKey[input.id] = input;
    if (input.urlKey) inputsByKey[input.urlKey] = input;
  }

  const RESERVED_KEEP = new Set(['format', 'export', 'copy', 'slot', 'output', 'full', '_v', 'nostage']);

  const kept = [];
  for (const part of qs.split('&')) {
    if (!part) continue;
    const eqIdx  = part.indexOf('=');
    const key    = eqIdx < 0 ? part : part.slice(0, eqIdx);
    const rawVal = eqIdx < 0 ? '' : part.slice(eqIdx + 1);
    const val    = decodeURIComponent(rawVal.replace(/\+/g, ' '));

    if (RESERVED_KEEP.has(key)) { kept.push(part); continue; }

    if (key === 'w' || key === 'width') {
      if (parseInt(val, 10) !== manifest.render.width) kept.push(part);
      continue;
    }
    if (key === 'h' || key === 'height') {
      if (parseInt(val, 10) !== manifest.render.height) kept.push(part);
      continue;
    }
    if (key === 'filename') {
      if (val !== manifest.name) kept.push(part);
      continue;
    }

    const input = inputsByKey[key];
    if (!input || !matchesDefault(input, val)) kept.push(part);
  }

  const newQs = kept.join('&');
  // Bump the shared guard so an in-flight syncUrl pack can't resolve later and clobber
  // this shrunk bar with the pre-shrink state (barSeq is the same holder syncUrl uses).
  const seq = barSeq ? ++barSeq.v : 0;
  // Re-pack if the shrunk-but-still-large query would still risk the URL ceiling and
  // packing actually wins; otherwise leave the readable form (shorter and editable).
  if (newQs.length >= AUTO_PACK_MIN && isPackAvailable()) {
    const token = await packQuery(newQs);
    if (barSeq && seq !== barSeq.v) return;             // a newer bar write happened mid-pack
    const packed = token && `${PACK_PARAM}=${token}`;
    if (packed && packed.length < newQs.length) {
      history.replaceState(null, '', `${base}?${packed}`);
      return;
    }
  }
  history.replaceState(null, '', newQs ? `${base}?${newQs}` : base);
}

/**
 * Encode a blocks array into the compact tilde-delimited URL format.
 * Each item's fields are comma-separated; items are tilde-separated.
 * Field values are encodeURIComponent'd so commas inside values become %2C
 * and are safe to split on. Color fields have their # stripped.
 * Returns null if encoding isn't possible (no fields defined).
 */
function encodeBlocksCompact(items, fields) {
  if (!Array.isArray(items) || !items.length || !fields.length) return null;
  return items.map(item =>
    fields.map(f => {
      const raw = item[f.id];
      // Asset sub-fields hold an AssetRef object — encode its id (library assets
      // only; uploaded user/ refs aren't shareable, same as top-level assets).
      if (f.type === 'asset') {
        const id = raw && typeof raw === 'object' ? raw.id : '';
        return encodeURIComponent(id && !String(id).startsWith('user/') ? id : '');
      }
      const v = String(raw ?? '');
      const s = f.type === 'color' ? v.replace(/^#/, '') : v;
      return encodeURIComponent(s);
    }).join(',')
  ).join('~');
}

// btnScopeEl — element containing the copy-url button (the actions bar)
// exportScopeEl — element containing format/filename/w/h inputs (actionsEl); optional
function wireUpCopyUrl(btnScopeEl, runtime, exportScopeEl, manifest) {
  btnScopeEl.querySelector('[data-action="copy-url"]')?.addEventListener('click', () => {
    showShareDialog(runtime, exportScopeEl ?? btnScopeEl, manifest);
  });
}

// Builds the base share-link query parts (tool inputs + the chosen export
// settings) — WITHOUT the on-visit behaviour flags (full/options/export/copy/_v),
// which the share dialog appends per the user's toggles.
function buildShareParams(runtime, exportScope) {
  const parts = [];

  for (const input of runtime.getModel()) {
    const { id, type, value, group, fields } = input;
    const key = input.urlKey ?? id;
    if (group === 'export') continue;

    if (type === 'asset') {
      const assetId = value?.id;
      if (assetId && !assetId.startsWith('user/')) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(assetId)}`);
      }
      continue;
    }

    if (type === 'blocks') {
      if (!Array.isArray(value) || value.length === 0) continue;
      const compact = encodeBlocksCompact(value, fields ?? []);
      // Fall back to JSON if no fields defined (other tools)
      const encoded = compact ?? JSON.stringify(value);
      if (encoded.length <= 8000) parts.push(`${key}=${compact ? encoded : encodeURIComponent(encoded)}`);
      continue;
    }

    if (type === 'vector') {
      // One flat param per field ("<inputId>.<fieldId>"), matching syncUrl and
      // serializeUrlState. Without this the object stringifies to "[object Object]".
      // Fields still at their default are omitted to keep the link short.
      if (value && typeof value === 'object') {
        for (const f of fields ?? []) {
          const fv = value[f.id];
          if (fv == null) continue;
          if (f.default !== undefined && String(fv) === String(f.default)) continue;
          parts.push(`${encodeURIComponent(`${key}.${f.id}`)}=${encodeURIComponent(String(fv))}`);
        }
      }
      continue;
    }

    if (value == null || value === '') continue;
    if (typeof value === 'boolean' && !value) continue;

    // Skip params whose value matches the declared default — they load identically without being in the URL.
    const def = input.default;
    if (def != null && type !== 'asset') {
      if (String(value) === String(def)) continue;
    }

    // A token-backed colour ({ ref, value }) serialises to its canonical token ref
    // so a shared/embedded link re-resolves against the destination's tokens — and
    // never leaks "[object Object]" into the URL (mirrors the engine's coerceToString).
    let str = type === 'color' && isTokenValue(value) ? value.ref : String(value);
    if (str.length > 150) continue;

    // Strip # from plain hex colors — saves 3 encoded chars (%23) per color param.
    // A token ref ({color.brand.jungle}) has no leading # and passes through as-is.
    if (type === 'color' && str.startsWith('#')) str = str.slice(1);

    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(str)}`);
  }

  // Export settings come from the live actions-bar controls (the export panel).
  const fmtEl = exportScope?.querySelector('[data-action="format"]');
  if (fmtEl?.value) parts.push(`format=${encodeURIComponent(fmtEl.value)}`);
  const fname = exportScope?.querySelector('[data-action="filename"]')?.value?.trim();
  if (fname) parts.push(`filename=${encodeURIComponent(fname)}`);
  const w = parseFloat(exportScope?.querySelector('[data-action="export-width"]')?.value);
  const h = parseFloat(exportScope?.querySelector('[data-action="export-height"]')?.value);
  if (w > 0) parts.push(`w=${w}`);
  if (h > 0) parts.push(`h=${h}`);
  const u = exportScope?.querySelector('[data-action="export-unit"]')?.value;
  if (u && u !== 'px') {
    parts.push(`unit=${u}`);
    const d = parseInt(exportScope?.querySelector('[data-action="export-dpi"]')?.value, 10);
    if (d > 0) parts.push(`dpi=${d}`);
  }
  // Colour profile is only meaningful for the CMYK print formats (Print PDF / Print
  // TIFF); carry it only when one is selected and it isn't the default condition.
  const prof = exportScope?.querySelector('[data-action="cmyk-profile"]')?.value;
  if (isCmykFmt(fmtEl?.value) && prof && prof !== DEFAULT_CMYK_CONDITION) {
    parts.push(`profile=${encodeURIComponent(prof)}`);
  }
  // PDF open-password — only for the standard PDF, only when set. Clear-text by
  // design so a shared link can carry the lock; never used for confidential files.
  const pdfPass = exportScope?.querySelector('[data-action="pdf-password"]')?.value;
  if (fmtEl?.value === 'pdf' && pdfPass) {
    parts.push(`password=${encodeURIComponent(pdfPass)}`);
  }
  // Print marks & bleed — print formats (pdf / pdf-cmyk / cmyk-tiff) only, and only
  // when the card is on.
  if (isPrintFmt(fmtEl?.value) && printEnabled(exportScope)) {
    const bleed = readBleed(exportScope);
    if (bleed) parts.push(`bleed=${encodeURIComponent(bleed)}`);
    const marks = readMarks(exportScope);
    if (marks) parts.push(`marks=${encodeURIComponent(marks)}`);
  }

  return parts;
}

/**
 * Edit a Lolly-sourced image in place → Promise<AssetRef | null>.
 *
 * An asset minted from a pasted Lolly link records its origin as a canonical,
 * re-renderable embed URL (meta.toolUrl — see compose.renderUrl). This overlay
 * re-opens the SOURCE tool's own inputs, pre-filled from that URL, so an editor can
 * make minor changes (and adjust format/size), preview live, and re-apply the new
 * render to the same slot. Resolves to a fresh tool-sourced AssetRef (a new
 * canonical id) or null if cancelled.
 *
 * Reuse, not reinvention: the source tool's controls are driven by a throwaway
 * runtime via the SAME renderInputs/syncInputs the main sidebar uses, and every
 * preview + the final commit go through host.compose.renderUrl(buildEmbedUrl(…)) —
 * the SAME minting the paste flow uses. So the re-applied asset round-trips through
 * URL mode + saved sessions exactly like the original; provenance is just the URL
 * we already persist, nothing new is stored.
 */
async function openEmbedEditor(host, { editUrl, slotLabel, mode = 'edit' } = {}) {
  if (!host.compose?.renderUrl) return null;
  const parsed = parseToolUrl(editUrl);
  if (!parsed) return null;

  let tool, desc, child;
  try {
    [tool, desc] = await Promise.all([getTool(parsed.toolId), host.compose._describeUrl(editUrl)]);
    if (!tool || !desc) return null;
    const state = parseUrlState(parsed.query, tool.manifest);
    child = await createRuntime(tool, host, state.values);
  } catch {
    return null; // unknown tool / bad link → silently no-op (button shouldn't have shown)
  }

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'embed-editor-overlay';
    const fmtOptions = desc.formats.map(f =>
      `<option value="${escape(f)}"${f === desc.format ? ' selected' : ''}>${escape(f.toUpperCase())}</option>`
    ).join('');
    const titleSlot = escape(slotLabel ?? 'image');
    // 'insert' = filling an empty slot from the picker's Tools/Saved list; 'edit' =
    // re-opening an already-placed Lolly asset via its "from <tool>" badge.
    const titleVerb  = mode === 'insert' ? 'New' : 'Edit';
    const applyLabel = mode === 'insert' ? 'Insert' : 'Re-apply to slot';
    overlay.innerHTML = `
      <div class="embed-editor-backdrop" aria-hidden="true"></div>
      <div class="embed-editor-panel" role="dialog" aria-modal="true" aria-label="Edit ${titleSlot}">
        <header class="embed-editor-head">
          <span class="embed-editor-spark" aria-hidden="true">&#10022;</span>
          <h2 class="embed-editor-title">${titleVerb} ${titleSlot} <span class="embed-editor-from">from ${escape(desc.name)}</span></h2>
          <button type="button" class="embed-editor-close" aria-label="Close">&times;</button>
        </header>
        <div class="embed-editor-body">
          <div class="embed-editor-form">
            <div class="tool-inputs ee-inputs"></div>
          </div>
          <div class="embed-editor-side">
            <div class="asset-picker-toolcard-controls">
              <label>Format <select class="ee-format" aria-label="Render format">${fmtOptions}</select></label>
              <label>Width <input type="number" class="ee-w" min="1" inputmode="numeric" placeholder="auto" value="${desc.width ?? ''}"></label>
              <label>Height <input type="number" class="ee-h" min="1" inputmode="numeric" placeholder="auto" value="${desc.height ?? ''}"></label>
            </div>
            <div class="asset-picker-toolcard-preview ee-preview"><div class="asset-picker-loading">Rendering…</div></div>
            <div class="embed-editor-actions">
              <button type="button" class="ee-cancel">Cancel</button>
              <button type="button" class="ee-apply" disabled>${applyLabel}</button>
            </div>
          </div>
        </div>
      </div>`;
    // Return focus to whatever opened the editor (the Edit button) when it closes —
    // matches the picker / export-panel convention so keyboard + AT users keep their
    // place rather than being dropped on <body> behind the (now-removed) scrim.
    const opener = document.activeElement;
    document.body.appendChild(overlay);

    const inputsEl  = overlay.querySelector('.ee-inputs');
    const fmtSel    = overlay.querySelector('.ee-format');
    const wEl       = overlay.querySelector('.ee-w');
    const hEl       = overlay.querySelector('.ee-h');
    const previewEl = overlay.querySelector('.ee-preview');
    const applyBtn  = overlay.querySelector('.ee-apply');
    // Move focus into the dialog so it's not stranded on the obscured Edit trigger.
    overlay.querySelector('.embed-editor-close')?.focus();

    let pending = null;   // the AssetRef "Re-apply" will commit
    let renderSeq = 0;    // drop a stale render when controls change again
    let prevModel;

    // Re-serialise the child's inputs to a canonical embed URL and re-render the
    // preview. width/height/unit/dpi ride in opts (not the query). We use the engine's
    // LOSSLESS serializeUrlState — NOT buildShareParams, which is the share-LINK
    // serialiser and silently drops scalars >150 chars, user/ assets and big block
    // arrays. The original paste keeps the query verbatim, so the edit flow must too,
    // or a long input (e.g. a QR `url`) would revert to default on re-apply and corrupt
    // the asset. Reserved width/height inputs that serializeUrlState emits are skipped
    // on re-parse; the effective size is carried via the opts below. renderUrl mints the id.
    const renderPreview = async () => {
      const seq = ++renderSeq;
      pending = null;
      applyBtn.disabled = true;
      previewEl.innerHTML = `<div class="asset-picker-loading">Rendering…</div>`;
      const query = serializeUrlState(child.getModel());
      const url = buildEmbedUrl({ toolId: parsed.toolId, format: fmtSel.value, query });
      const ref = url ? await host.compose.renderUrl(url, {
        format: fmtSel.value,
        width:  parseInt(wEl.value, 10) || undefined,
        height: parseInt(hEl.value, 10) || undefined,
        unit:   desc.unit ?? undefined,
        dpi:    desc.dpi ?? undefined,
      }).catch(() => null) : null;
      if (seq !== renderSeq) return; // a newer change supersedes this render
      if (!ref) {
        previewEl.innerHTML = `<p class="asset-picker-error">Couldn't render this — the inputs may be too large to re-apply as a link.</p>`;
        return;
      }
      pending = ref;
      previewEl.innerHTML = `<img class="asset-picker-toolcard-img" src="${escape(ref.url)}" alt="Preview of the ${escape(desc.name)} render">`;
      applyBtn.disabled = false;
    };

    let debounce;
    const schedulePreview = () => { clearTimeout(debounce); debounce = setTimeout(renderPreview, 300); };

    // The child runtime drives the source tool's input panel (the very same
    // renderInputs/syncInputs path as the main sidebar). subscribe fires once
    // immediately (initial render + first preview) and on every later change.
    child.subscribe(({ model }) => {
      if (!_sliderDragging) prevModel = syncInputs(inputsEl, model, prevModel, child, host, () => {});
      schedulePreview();
    });

    const close = (value) => {
      clearTimeout(debounce);
      renderSeq++; // invalidate any in-flight preview render so it can't write to the detached overlay
      document.removeEventListener('keydown', onKey);
      // renderInputs registers two document-level capture listeners on the panel
      // (colour-popover + block add-menu dismissers); drop them so the detached
      // overlay tree isn't pinned alive (mirrors mountTool's _cleanup).
      if (inputsEl._colorPopoverDismiss) document.removeEventListener('click', inputsEl._colorPopoverDismiss, true);
      if (inputsEl._blockMenuDismiss)    document.removeEventListener('click', inputsEl._blockMenuDismiss, true);
      if (inputsEl._helpTipDismiss)      document.removeEventListener('click', inputsEl._helpTipDismiss, true);
      // A child datetime input's flatpickr appends its calendar to <body> and registers
      // its own document/window listeners — removed only by destroy(). overlay.remove()
      // detaches the input but not the body-level calendar, so tear them down explicitly
      // (else repeated edits of a date-bearing source tool orphan calendars + retain the
      // child runtime via flatpickr's listener roots).
      inputsEl.querySelectorAll('.fp-datetime').forEach(c => c._flatpickr?.destroy());
      overlay.remove();
      if (opener instanceof HTMLElement) opener.focus();
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(null); } };
    document.addEventListener('keydown', onKey);

    overlay.querySelector('.embed-editor-backdrop').addEventListener('click', () => close(null));
    overlay.querySelector('.embed-editor-close').addEventListener('click', () => close(null));
    overlay.querySelector('.ee-cancel').addEventListener('click', () => close(null));
    applyBtn.addEventListener('click', () => { if (pending) close(pending); });
    fmtSel.addEventListener('change', renderPreview);
    wEl.addEventListener('input', schedulePreview);
    hEl.addEventListener('input', schedulePreview);
  });
}

// The Share button opens the shared dialog (components/share-dialog.js): a ready-to-copy
// link plus the on-visit behaviour toggles. This thin wrapper feeds it the live tool
// state; the Projects view reuses the same dialog for a saved session.
function showShareDialog(runtime, exportScope, manifest) {
  // Resolve the tool id from the address bar (path or hash form) so the link is the
  // crawler-visible /t/<id> shape. The dialog itself lives in components/share-dialog.js,
  // shared with the Projects view's per-session "Share link". buildShareParams stays here
  // (it reads the live runtime + export-panel DOM); the session path passes its own parts.
  const toolId = window.location.pathname.match(/^\/t\/([^/?]+)/)?.[1]
              ?? window.location.hash.match(/^#\/tool\/([^/?]+)/)?.[1];
  const currentFormat = exportScope?.querySelector('[data-action="format"]')?.value || '';
  openShareDialog({ toolId, baseParts: buildShareParams(runtime, exportScope), manifest, currentFormat });
}

// A vector input: N number fields committed together as one { fieldId: number }
// object. Each field can be typed into, or its label dragged horizontally to
// scrub (Figma-style). Scrubbing sets _sliderDragging so the sidebar isn't
// rebuilt mid-drag; the canvas still updates live via the runtime subscriber.
function setupVectorControl(container, runtime, id, onDirty, input) {
  const fields = input.fields ?? [];
  const nums = new Map();
  container.querySelectorAll('.vec-num').forEach(n => nums.set(n.dataset.vecField, n));

  const commit = () => {
    const obj = {};
    for (const f of fields) {
      const el = nums.get(f.id);
      if (!el) continue;
      const n = Number(el.value);
      obj[f.id] = Number.isNaN(n) ? (input.value?.[f.id] ?? f.default ?? 0) : n;
    }
    runtime.setInput(id, obj);
    onDirty?.(id);
  };

  nums.forEach(el => el.addEventListener('input', commit));

  // The whole field is the scrub surface, not just the symbol — drag anywhere on
  // a value to change it (Figma-style); the symbol is only a visual cue. A plain
  // click (no movement past the threshold) falls through to focus the <input> for
  // typing. Pointer Lock kicks in once dragging starts so the cursor wraps at
  // screen edges and a wide range (e.g. zoom) isn't capped by the sidebar width.
  container.querySelectorAll('.vec-field').forEach(fieldEl => {
    const fieldId = fieldEl.querySelector('.vec-scrub')?.dataset.vecScrub;
    const f  = fields.find(x => x.id === fieldId);
    const el = nums.get(fieldId);
    if (!f || !el) return;
    const step  = f.step ?? 1;
    const clamp = v => {
      if (f.min !== undefined) v = Math.max(f.min, v);
      if (f.max !== undefined) v = Math.min(f.max, v);
      return v;
    };
    let wasDragging = false;

    fieldEl.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const startX   = e.clientX;
      const startVal = Number(el.value) || 0;
      let   accumulated = 0;   // total pixel delta once pointer lock is active
      let   dragging    = false;

      function onMove(ev) {
        if (!dragging) {
          // Below the threshold this is still a potential click — leave it alone
          // so the field stays typeable.
          if (Math.abs(ev.clientX - startX) < 4) return;
          dragging = true;
          _sliderDragging = true;         // keep the sidebar from rebuilding mid-drag
          el.blur();                       // leave any text-edit mode
          document.body.style.cursor = 'ew-resize';
          fieldEl.setPointerCapture(e.pointerId);
          const req = fieldEl.requestPointerLock?.({ unadjustedMovement: true });
          if (req instanceof Promise) req.catch(() => fieldEl.requestPointerLock?.());
        }
        if (document.pointerLockElement === fieldEl) accumulated += ev.movementX;
        else accumulated = ev.clientX - startX; // keep in sync for the switch to locked mode
        el.value = String(clamp(startVal + Math.round(accumulated / 4) * step)); // ~1 step / 4px
        commit();                          // live: canvas re-hydrates, sidebar held
      }

      function onUp() {
        fieldEl.removeEventListener('pointermove', onMove);
        fieldEl.removeEventListener('pointerup', onUp);
        fieldEl.removeEventListener('pointercancel', onUp);
        document.removeEventListener('pointerlockchange', onLockChange);
        if (document.pointerLockElement === fieldEl) document.exitPointerLock();
        document.body.style.cursor = '';
        if (dragging) {
          _sliderDragging = false;
          wasDragging = true;
          setTimeout(() => { wasDragging = false; }, 50);
          commit();                        // final commit now re-renders the sidebar
        }
      }

      function onLockChange() {
        // Escape key or other external release — stop dragging cleanly.
        if (document.pointerLockElement !== fieldEl) onUp();
      }

      fieldEl.addEventListener('pointermove', onMove);
      fieldEl.addEventListener('pointerup', onUp);
      fieldEl.addEventListener('pointercancel', onUp);
      document.addEventListener('pointerlockchange', onLockChange);
    });

    // Suppress the click-to-focus that follows a drag so the caret doesn't jump
    // into the field after scrubbing.
    fieldEl.addEventListener('click', e => {
      if (wasDragging) { e.preventDefault(); el.blur(); }
    });
  });
}

function setupCustomSlider(el, runtime, id, onDirty) {
  const min  = parseFloat(el.dataset.min);
  const max  = parseFloat(el.dataset.max);
  const step = parseFloat(el.dataset.step) || 1;
  const unit = el.dataset.unit || '';
  const track = el.querySelector('.cs-track');
  const fill  = el.querySelector('.cs-fill');
  const thumb = el.querySelector('.cs-thumb');

  let lastSnapped = parseFloat(el.getAttribute('aria-valuenow')) || min;
  // Live numeric readout next to the label. The panel rebuild is suppressed during a
  // slider drag (_sliderDragging), so update this span directly or it stalls mid-drag.
  const valueOut = el.closest('.input-row')?.querySelector('.input-value');

  function snap(raw) {
    const s = Math.round((raw - min) / step) * step + min;
    return +(Math.min(max, Math.max(min, s)).toFixed(10));
  }

  // Keep aria-valuenow and a human aria-valuetext (with the unit, when one exists)
  // in lockstep so screen readers announce the value on every change.
  function setAria(v) {
    el.setAttribute('aria-valuenow', v);
    el.setAttribute('aria-valuetext', unit ? `${v} ${unit}` : String(v));
  }

  function setThumb(rawVal) {
    const pct = ((Math.min(max, Math.max(min, rawVal)) - min) / (max - min) * 100).toFixed(3);
    fill.style.width = pct + '%';
    thumb.style.left = pct + '%';
  }

  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.focus({ preventScroll: true }); // so the keyboard handler is live right after a click
    el.setPointerCapture(e.pointerId);
    _sliderDragging = true;
    el.classList.add('dragging');

    function fromPointer(e) {
      const rect  = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const raw   = min + ratio * (max - min);
      setThumb(raw);
      const snapped = snap(raw);
      if (snapped !== lastSnapped) {
        lastSnapped = snapped;
        setAria(snapped);
        if (valueOut) valueOut.textContent = String(snapped);
        runtime.setInput(id, snapped);
      }
    }

    function onUp() {
      el.removeEventListener('pointermove', fromPointer);
      el.removeEventListener('pointerup', onUp);
      _sliderDragging = false;
      el.classList.remove('dragging');
      // Snap thumb to final stop and trigger one last render
      setThumb(lastSnapped);
      onDirty?.(id);
      runtime.setInput(id, lastSnapped);
    }

    el.addEventListener('pointermove', fromPointer);
    el.addEventListener('pointerup', onUp);
    fromPointer(e);
  });

  el.addEventListener('keydown', e => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   next = lastSnapped + step;
    else if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') next = lastSnapped - step;
    else if (e.key === 'Home')      next = min;
    else if (e.key === 'End')       next = max;
    else if (e.key === 'PageUp')    next = lastSnapped + step * 10;
    else if (e.key === 'PageDown')  next = lastSnapped - step * 10;
    if (next === null) return;
    e.preventDefault();
    const snapped = snap(next);
    if (snapped === lastSnapped) return;
    lastSnapped = snapped;
    setThumb(lastSnapped);
    setAria(lastSnapped);
    onDirty?.(id);
    runtime.setInput(id, lastSnapped);
  });
}

// Adds scroll-to-change and click-drag-to-scrub to a number input.
// Dragging uses Pointer Lock once the threshold is crossed so the cursor
// wraps across screen edges and movement is truly unbounded.
// onChange fires after every value change from either interaction.
// opts.format(value) returns the label shown in the floating readout that
// appears while dragging (defaults to the bare value) — see scrub-readout.js.
function addScrubBehavior(inputEl, onChange, opts = {}) {
  const format = opts.format ?? (v => String(v));
  const getMin = () => parseInt(inputEl.min, 10) || 1;
  const getMax = () => parseInt(inputEl.max, 10) || 99999;
  const clamp  = v => Math.min(getMax(), Math.max(getMin(), v));

  inputEl.addEventListener('wheel', e => {
    // Only hijack the wheel to scrub the value when the field is focused; otherwise
    // let the event bubble so the surrounding panel scrolls past it normally.
    if (document.activeElement !== inputEl) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    inputEl.value = clamp((parseInt(inputEl.value, 10) || 0) + (e.deltaY < 0 ? step : -step));
    onChange();
  }, { passive: false });

  let dragging    = false;
  let wasDragging = false;
  let activeId    = null;   // the one pointer currently driving a drag

  inputEl.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    // One scrub at a time: a second finger landing on the field mustn't reset the
    // baseline of the drag already in progress (it drove jumpy values on touch).
    if (activeId !== null) return;
    activeId = e.pointerId;
    const startX   = e.clientX;
    const startVal = parseInt(inputEl.value, 10) || 0;
    // Touch can't lock the pointer, so the value stays hidden under the finger —
    // track the readout above the touch point; otherwise anchor it to the field.
    const isTouch  = e.pointerType === 'touch';
    let   accumulated = 0; // total delta once pointer lock is active
    dragging = false;
    inputEl.setPointerCapture(e.pointerId);

    // Float the live value clear of the cursor/finger while dragging.
    function showReadout(ev) {
      const text = format(inputEl.value);
      if (isTouch) showScrubReadout({ text, finger: { x: ev.clientX, y: ev.clientY } });
      else showScrubReadout({ text, anchorEl: inputEl });
    }

    function onMove(e) {
      if (e.pointerId !== activeId) return;   // ignore any other pointer
      if (!dragging) {
        if (Math.abs(e.clientX - startX) < 4) return;
        dragging = true;
        document.body.style.cursor = 'ew-resize';
        // Request pointer lock so the cursor wraps at screen edges.
        // unadjustedMovement removes OS pointer acceleration for 1:1 scrubbing.
        // Skipped for touch (unsupported) — the clientX fallback drives it there.
        if (!isTouch) {
          const req = inputEl.requestPointerLock?.({ unadjustedMovement: true });
          if (req instanceof Promise) {
            req.catch(() => inputEl.requestPointerLock?.());
          }
        }
      }

      const step = e.shiftKey ? 10 : 1;
      if (document.pointerLockElement === inputEl) {
        // Locked: accumulate raw movementX — no screen-edge limit.
        accumulated += e.movementX * step;
        inputEl.value = clamp(startVal + Math.round(accumulated));
      } else {
        // Lock not yet active (or unavailable): fall back to clientX delta.
        const dx = e.clientX - startX;
        inputEl.value = clamp(startVal + Math.round(dx * step));
        // Keep accumulated in sync so the switch to locked mode is seamless.
        accumulated = parseInt(inputEl.value, 10) - startVal;
      }
      onChange();
      showReadout(e);
    }

    function onUp(e) {
      // pointerup/cancel carry an event (ignore other pointers); onLockChange
      // calls onUp() with no argument to force a release.
      if (e && e.pointerId !== activeId) return;
      inputEl.removeEventListener('pointermove',   onMove);
      inputEl.removeEventListener('pointerup',     onUp);
      inputEl.removeEventListener('pointercancel', onUp);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement === inputEl) document.exitPointerLock();
      document.body.style.cursor = '';
      hideScrubReadout();
      if (dragging) {
        wasDragging = true;
        setTimeout(() => { wasDragging = false; }, 50);
      }
      dragging = false;
      activeId = null;
    }

    function onLockChange() {
      // Escape key or other external release — stop dragging cleanly.
      if (document.pointerLockElement !== inputEl) onUp();
    }

    inputEl.addEventListener('pointermove',   onMove);
    inputEl.addEventListener('pointerup',     onUp);
    inputEl.addEventListener('pointercancel', onUp);
    document.addEventListener('pointerlockchange', onLockChange);
  });

  // Suppress the click-to-focus that follows a drag so the cursor doesn't jump into text mode.
  inputEl.addEventListener('click', e => {
    if (wasDragging) { e.preventDefault(); inputEl.blur(); }
  });
}

// Cap on a vector thumbnail's raw SVG size. Dense vector output (e.g. a halftone
// with thousands of dots) can serialise to megabytes; above this we fall back to
// the raster path so a single thumbnail never bloats storage unbounded.
const SVG_THUMB_MAX_BYTES = 1_500_000;

async function captureThumbnail(manifest, canvasEl, runtime, exportUnscaled, format = '') {
  const nw = manifest.render.width  || 600;
  const nh = manifest.render.height || 600;

  // Vector thumbnail: when the effective export format is SVG (the user picked it,
  // or it's the tool's default), capture an SVG data-URL instead of a PNG. SVG is
  // resolution-independent — it renders in the gallery's <img> and stays crisp at
  // any card size. renderSvg() inlines blob-URLs and vector tools outline their
  // text, so the SVG is self-contained and safe in an <img> sandbox. Falls through
  // to the raster path on failure or if the SVG is pathologically large.
  if (format === 'svg') {
    try {
      const blob = await exportUnscaled(
        () => runtime.export(canvasEl, 'svg', { width: nw, height: nh, embedMeta: false, thumbnail: true }),
        { shutter: true },
      );
      const svg = await blob.text();
      if (svg && svg.length <= SVG_THUMB_MAX_BYTES) {
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
      }
    } catch { /* fall through to the raster path */ }
  }

  // Raster thumbnail (default): a PNG sized for the gallery's preview-forward hero
  // (shown up to a full card column wide, at 2× for retina). Storage isn't a
  // concern for the single most-recent session per tool.
  try {
    const maxW = 720;
    const maxH = 560;
    const scale = Math.min(maxW / nw, maxH / nh);
    const tw = Math.max(1, Math.round(nw * scale));
    const th = Math.max(1, Math.round(nh * scale));
    // Mask the brief full-res resize with the shutter — the thumbnail is a fast
    // single PNG frame, so the shutter fully covers it for every tool.
    const blob = await exportUnscaled(
      // thumbnail:true lets expensive hooks (e.g. url-shot's capture) reuse the
      // last render on the canvas instead of re-running a slow capture.
      () => runtime.export(canvasEl, 'png', { width: tw, height: th, embedMeta: false, thumbnail: true }),
      { shutter: true },
    );
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Re-create <script> elements so the browser executes them.
// innerHTML assignment intentionally skips script execution, so any template
// that needs runtime JS must be bootstrapped this way.
function runTemplateScripts(container) {
  container.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    [...old.attributes].forEach(a => s.setAttribute(a.name, a.value));
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

// Walk the canvas DOM for HTML comment markers left by annotateTemplate, convert
// them into data-canvas-input attributes, then remove the comments.
// Block-element outputs (e.g. <p> from {{markdown}}) are marked directly.
// Plain text outputs get wrapped in a transparent <span> so they're clickable.
function resolveCanvasAnnotations(canvasEl) {
  const comments = [];
  const walker = document.createTreeWalker(canvasEl, NodeFilter.SHOW_COMMENT);
  let node;
  while ((node = walker.nextNode())) comments.push(node);

  for (const comment of comments) {
    if (!comment.parentNode) continue;
    const text = comment.nodeValue.trim();
    const m = text.match(/^ci:(.+)$/);
    if (!m) continue;
    const id = m[1];

    // Collect siblings until the matching closing comment.
    const between = [];
    let closing = null;
    let cur = comment.nextSibling;
    while (cur) {
      if (cur.nodeType === Node.COMMENT_NODE && cur.nodeValue.trim() === `/ci:${id}`) {
        closing = cur;
        break;
      }
      between.push(cur);
      cur = cur.nextSibling;
    }

    const elements = between.filter(n => n.nodeType === Node.ELEMENT_NODE);
    if (elements.length > 0) {
      for (const el of elements) el.dataset.canvasInput = id;
    } else {
      // Pure text — wrap in a span so it's individually clickable.
      const span = document.createElement('span');
      span.dataset.canvasInput = id;
      comment.parentNode.insertBefore(span, comment);
      for (const n of between) span.appendChild(n);
    }

    comment.remove();
    closing?.remove();
  }
}

// Resolves once the canvas DOM has been mutation-quiet for silenceMs AND any
// pending async signal has fired, or after timeoutMs regardless.
//
// Opt-in contract for async tools (e.g. fetch-driven weather/maps):
//   1. Before returning from the script, set window.__toolHasReadySignal = true.
//   2. When all async work is done (every success AND error path), dispatch:
//        document.dispatchEvent(new CustomEvent('tool:ready'))
//   Without the signal this behaves exactly as before (mutation-silence only).
async function waitForQuiescence(node, { silenceMs = 400, timeoutMs = 8000 } = {}) {
  await document.fonts.ready;

  const needsReadySignal = !!window.__toolHasReadySignal;
  delete window.__toolHasReadySignal;

  return new Promise(resolve => {
    let settled = false;
    let silenceTimer = null;
    let isReady  = !needsReadySignal; // pre-resolved when no signal expected
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

function showClearDialog(onConfirm) {
  const dialog = document.createElement('dialog');
  dialog.className = 'unsaved-dialog';
  dialog.innerHTML = `
    <div class="unsaved-dialog-body">
      <h2>Clear changes?</h2>
      <p>This will reset every field to its default value.<br>This cannot be undone.</p>
      <div class="unsaved-dialog-actions">
        <button class="unsaved-leave">Clear changes</button>
        <button class="unsaved-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  const cleanup = () => { dialog.close(); dialog.remove(); };

  dialog.querySelector('.unsaved-leave').addEventListener('click', () => { cleanup(); onConfirm(); });
  dialog.querySelector('.unsaved-cancel').addEventListener('click', cleanup);
  dialog.addEventListener('cancel', () => dialog.remove());
}

// onSave: optional async () => void that performs the save and navigates on
// success (the caller owns both). We await it rather than firing a button click,
// so "Save & leave" reliably saves *then* leaves instead of trusting a
// fire-and-forget click + timer.
function showUnsavedDialog(onSave, onLeave) {
  const dialog = document.createElement('dialog');
  dialog.className = 'unsaved-dialog';
  dialog.innerHTML = `
    <div class="unsaved-dialog-body">
      <h2>Unsaved changes</h2>
      <p>You have unsaved changes. <br>Would you like to save before leaving?</p>
      <div class="unsaved-dialog-actions">
        ${onSave ? `<button class="unsaved-save">Save &amp; leave</button>` : ''}
        <button class="unsaved-leave">Leave without saving</button>
        <button class="unsaved-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  const cleanup = () => { dialog.close(); dialog.remove(); };

  onSave && dialog.querySelector('.unsaved-save')?.addEventListener('click', async () => {
    cleanup();
    await onSave();
  });
  dialog.querySelector('.unsaved-leave').addEventListener('click', () => { cleanup(); onLeave(); });
  dialog.querySelector('.unsaved-cancel').addEventListener('click', cleanup);
  dialog.addEventListener('cancel', () => dialog.remove());
}

function scopeCss(css, scopeSelector) {
  return css.replace(/(^|\})\s*([^{}]+)\s*\{/g, (m, brace, sel) => {
    if (sel.trim().startsWith('@')) return m;
    const scoped = sel.split(',').map(s => `${scopeSelector} ${s.trim()}`).join(', ');
    return `${brace} ${scoped} {`;
  });
}

