// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - view entry point and orchestrator.
 *
 * mountPro(viewEl, host) owns the batch state and wires every interaction:
 * template selection, per-cell editing, bulk column writes, the batch run, and
 * delivery (single zip, or a spaced-out sequential-download fallback).
 *
 * Isolation contract: this module imports ONLY from the engine public surface
 * (@lolly/engine), the host bridge it is handed, and its own ./pro/*
 * siblings. It does not import from views/* and nothing in the rest of the app
 * imports from here. The single integration point is the lazy route in main.js.
 * To remove the feature: delete this folder and that one route case.
 */
import './pro.css';
import { mountKitPanel, type KitPanel } from './kit-panel.ts';
import { captureKitEdits, restoreKit, type KitState } from './kit-model.ts';
import { isHiddenSlot, BATCH_SLOT_PREFIX } from '../lib/batch-slots.ts';
import { serializeUrlState, buildEmbedUrl, toCssPx, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION } from '@lolly/engine';
import { marksToCsv, csvToMarks } from '../lib/print-marks-csv.ts';

// Output-dimension units the batch can target. px is the design canvas; the
// rest are physical and convert per format at export time (engine/src/units.js).
const UNIT_OPTIONS = ['px', 'mm', 'cm', 'in', 'pt'];
import { deriveColumns, cellInput, bulkTargets } from './model.ts';
import { renderGridHtml, bodyRow } from './grid.ts';
import { createGridNav } from './grid-nav.ts';
import { attachResize, isOnResizeEdge } from './resize.ts';
import { attachReorder } from './reorder.ts';
import { attachScrub } from '../lib/scrub.ts';
import { controlHtml, readControlValue } from './controls.ts';
import { openBlocksEditor, closeBlocksPanel } from './blocks-editor.ts';
import { colorFieldHtml, wireColorField, type ColorFieldValue } from '../components/color-field.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { mountZoomHud } from '../components/zoom-hud.ts';
import { mountModal } from '../components/modal.ts';
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { fold, tokenize, scoreHaystack } from '../lib/search/match.ts';
import { askExportLock } from '../lib/export-lock.ts';
import { getTool, renderRowToBlob, isExportable } from './render-export.ts';
import { planBatch, notesFromFindings } from './batch.ts';
import { createBatchRowCheck, skippedFindings } from './preflight-rows.ts';
import type { Finding } from '@lolly/engine';
import { icon } from '../lib/icons.ts';
import { saveBlob } from './zip.ts';
import { batchToCsv, csvToBatch, parseClipboardGrid, coerceCell } from './io.ts';
import { createSessionStore, rowsFromSnapshot, snapshotFromState } from './sessions.ts';
import { runBatchWithProgress } from './run-overlay.ts';
import { startBatchExport, isBatchRunActive } from '../lib/batch-job.ts';
import { rowsForFolder, rowsFromRefs } from './folder-rows.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Unit } from '../../../../engine/src/units.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { backPillHtml, mountBackPill } from '../components/back-pill.ts';
import { setPendingToolSeed } from '../lib/drop-router.ts';
import { navigateTo } from '../nav.ts';
import { announce } from '../a11y.ts';

// The asset-picker options shape, derived from the host bridge so the local
// casts below stay in lockstep with it (type-only; erased at runtime).
type PickOpts = Parameters<HostV1['assets']['pick']>[0];

// The catalog index the app hangs on `window` (populated at boot). Only the
// fields /pro reads; typed inline so a single cast keeps the module DOM-honest.
type WindowWithIndex = Window & { __toolIndex?: { tools?: IndexedTool[] } };

// A catalog-index tool entry as /pro reads it.
interface IndexedTool {
  id: string;
  name: string;
  status?: string;
  exportable?: boolean;
  capabilities?: readonly string[];
  /** The tool's inline-SVG mark from catalog/tools/index.json - first-party
   *  generated data, injected raw exactly like the gallery's tool cards. */
  icon?: string;
}

// The host surface /pro needs: HostV1 plus the web state store's size query.
interface ProHost extends HostV1 {
  state: HostV1['state'] & { sizes(): Promise<Record<string, number>> };
}

// Options the shell injects when mounting /pro (lazy route in main.js).
interface ProMountOpts {
  sessionSlot?: string;
  /** A tool id to start the batch on (`#/batch?tool=<id>`, the tool view's "Bulk from
   *  rows" action). Applied to the first empty row AFTER any session or sheet
   *  selection, so a deep link that carries both keeps the opened work. */
  seedToolId?: string;
  /** Session refs to open verbatim as grid rows - the Projects "Edit as sheet"
   *  selection (`#/pro?s=slot,slot…`). Each becomes a row (tool-less if it has no
   *  inputs); see {@link rowsFromRefs}. Takes precedence over `sessionSlot`. */
  seedRefs?: string[];
  onBatchRendered?: (files: any[]) => void;
  openFolderOverlay?: (host: ProHost, cfg: any) => void;
  /** The Projects folder the batch was invoked from (`#/batch?from=<id>`) - the
   *  save's default destination. null/absent = top-level Projects (library root). */
  originFolderId?: string | null;
  /** Injected folder store (the shell owns folders.ts; /pro stays import-isolated),
   *  so a batch can be SAVED into a project - default the origin, or a chosen /
   *  freshly-created subfolder. Absent → the save keeps its old library-only behaviour. */
  folderApi?: {
    /** Every project folder, each with its nesting depth (0 = top level), path-ordered. */
    list(): Promise<Array<{ id: string; name: string; depth: number }>>;
    /** Create a subfolder under `parentId` (null = top level) and return it. */
    create(name: string, parentId: string | null): Promise<{ id: string; name: string }>;
    /** File the batch slot into `folderId` (null = library root, i.e. no project). */
    file(slot: string, folderId: string | null): Promise<void>;
  };
}

// One batch row. `manifest` is the loaded tool manifest (null until the tool
// resolves); `values` is the row's per-input value map (loose - coerced per the
// input's declared type at render time).
interface GridRow {
  kitOutputId?: string;
  uid: string;
  toolId: string;
  manifest: ToolManifest | null;
  values: Record<string, any>;
  format?: string;
  unit?: string;
  dpi?: number;
  outWidth?: number;
  outHeight?: number;
  filename?: string;
  height?: number;
  /** Per-row print overrides - beat the run-level toolbar values when set. */
  profile?: string;
  bleed?: string;
  marks?: string;
}

// Render context handed to the (untyped) grid renderers.
interface GridCtx {
  tools: IndexedTool[];
  toolById: Map<string, IndexedTool>;
  assetPicker: boolean;
  unit: string;
  dpi: number;
  firstname?: string;
  collapsed?: Set<string>;
}

// The live batch model + view state.
interface BatchState {
  kit?: KitState;
  rows: GridRow[];
  format: string;
  unit: string;
  dpi: number;
  /**
   * RUN-LEVEL print settings - the toolbar's Print popover. Exactly the same
   * kind of thing as `format`/`unit`/`dpi` above: a default every row inherits
   * and any row may override (pro/batch.ts `resolvePrintSettings` is the one
   * statement of that precedence). Empty string = not set; there is no separate
   * "off" state, matching what the single-tool export panel writes.
   */
  profile: string;
  bleed: string;
  marks: string;
  running: boolean;
  cancelRequested: boolean;
  collapsed: Set<string>;
  colWidths: Record<string, number>;
  zipName: string;
}

// A body-mounted popover carrying its own outside-press handler (and, for the
// template picker, the row uid it's open for).
type PopoverEl = HTMLElement & {
  _onOutside?: (e: PointerEvent) => void;
  _row?: string;
};

// `pdf-cmyk` (the Print PDF) is offered at run level so a whole print run can be
// set in one place; a tool that can't produce it degrades through chooseFormat to
// its own first format, exactly as every other run-level format already does.
const FORMAT_OPTIONS = ['png', 'jpg', 'svg', 'emf', 'eps', 'pdf', 'pdf-cmyk', 'webp'];

// Which formats the print controls apply to. Deliberately IDENTICAL to the
// single-tool export panel's `isCmykFmt` / `isPrintFmt` (views/tool-actions.ts):
// the Color profile card is CMYK-only, print marks & bleed cover all three print
// formats. Restated rather than imported because /pro must not import from views/*
// (the isolation contract at the top of this file).
const isCmykFmt = (f: string | undefined): boolean => f === 'pdf-cmyk' || f === 'cmyk-tiff';
const isPrintFmt = (f: string | undefined): boolean => f === 'pdf' || f === 'pdf-cmyk' || f === 'cmyk-tiff';

// The print-marks defaults the panel applies when the card is switched on
// (tool-actions DEFAULT_PRINT_MARKS). Colour bars are added on top for the CMYK
// formats, where the press uses them as a control strip.
const DEFAULT_MARKS_CSV = 'crop,reg,bleed,prov';
const DEFAULT_MARKS_CSV_CMYK = 'crop,reg,bleed,bars,prov';
const DEFAULT_BLEED_MM = 3;

// The crop-marks glyph, same registry entry the export panel's print card uses
// (lib/icons.ts PATHS.crop) so the two surfaces read as one feature.
const ICON_CROP = icon('crop', { size: 14, className: 'pro-print-icon' });

// Input columns worth showing by default when a newly-added tool uses them
// (everything else a tool introduces starts collapsed). Matched by input id;
// "title" covers the common "heading text" of chart/meeting-style tools.
const DEFAULT_VISIBLE_COLS = new Set(['headshot', 'image', 'photo', 'heading', 'title']);

// Capability gating: hide tools this shell can't fulfil (e.g. 'capture' tools in
// the web PWA) so the batch only offers templates that will actually render.
// Inlined rather than imported from ../capabilities.js to keep pro/ self-contained
// per the isolation contract above. Absent host.capabilities ⇒ no gating.
function shellCanRun(tool: IndexedTool, host: ProHost): boolean {
  const need = tool.capabilities ?? [];
  if (need.length === 0) return true;
  const have: readonly string[] | undefined = host.capabilities;
  if (!Array.isArray(have)) return true;
  return need.every(c => have.includes(c));
}

let _uidSeq = 0;
const newRow = (): GridRow => ({ uid: `r${++_uidSeq}`, toolId: '', manifest: null, values: {} });
// Start with a single blank row, template search ready - the user grows the
// batch with the "=" shortcut (or + Row), which keeps each new row's flow fast.
const DEFAULT_ROWS = 1;
const blankRows = (): GridRow[] => Array.from({ length: DEFAULT_ROWS }, newRow);

export async function mountPro(viewEl: HTMLElement, host: ProHost, opts: ProMountOpts = {}): Promise<void> {
  document.title = 'Batch - Lolly';

  const assetPicker = typeof host.assets?.pick === 'function';
  const tools = [...((window as WindowWithIndex).__toolIndex?.tools ?? [])]
    // Batch renders data → asset, so hide render-only / on-device utilities: they
    // export themselves via their own exportFile flow, never the batch path, and
    // would only ever be skipped at run time. (`!== false` fails open if an older
    // cached index predates the `exportable` flag - see build-catalog-index.js.)
    .filter(t => t.exportable !== false)
    .filter(t => shellCanRun(t, host))
    .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  const toolByName = new Map(tools.map(t => [t.name, t]));

  const state: BatchState = {
    rows: blankRows(),
    format: 'png',
    unit: 'px',           // unit for the Width/Height columns (px/mm/cm/in/pt)
    dpi: 300,             // raster resolution for physical units (print default)
    profile: '',          // CMYK press condition - unset until the user picks one
    bleed: '',            // e.g. "3mm"; empty = trim-sized, no bleed
    marks: '',            // `marks` CSV; empty = no crop/registration/bleed marks
    running: false,
    cancelRequested: false,
    collapsed: new Set(), // column keys hidden from the matrix (restorable via tags)
    colWidths: {},        // key → px width (drag to widen); narrow defaults otherwise
    zipName: '',          // optional name for the delivered zip
  };
  const ctx: GridCtx = { tools, toolById: new Map(tools.map(t => [t.id, t])), assetPicker, unit: state.unit, dpi: state.dpi };
  // Personalise the empty-grid welcome when the user has a saved profile name
  // (Profile → First name). Fetched once at mount; the hint only shows before a
  // tool is picked, so a mid-session profile edit needn't re-render it.
  const meProfile = await host.profile?.get?.().catch(() => null);
  ctx.firstname = (meProfile?.firstname ?? '').trim();

  // ── Static shell ───────────────────────────────────────────────────────────
  viewEl.innerHTML = `
    <div class="pro-wrap">
      ${backPillHtml()}

      <div class="pro-toolbar">
        <button type="button" class="pro-btn pro-hamburger" id="pro-menu" aria-label="${escape(t('Toolbar menu'))}" aria-expanded="false" aria-controls="pro-toolbar-group">☰</button>
        <div class="pro-toolbar-group" id="pro-toolbar-group">
          <label class="pro-format pro-zip" title="${escape(t('Name for the downloaded .zip'))}">
            <input type="text" id="pro-zip-name" placeholder="lolly-batch" autocomplete="off" spellcheck="false"
              aria-label="${escape(t('Name for the downloaded .zip'))}">
            <span class="pro-zip-ext" aria-hidden="true">.zip</span>
          </label>
          <!-- + Row / +5 live at the bottom-left of the grid, where you use them.
               CSV download/upload live inside the Sessions dialog. -->
          <button type="button" class="pro-btn" id="pro-event-kit">${t('Event kit')}</button>
          <input type="file" id="pro-csv-file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden>
        </div>
        <span class="pro-spacer"></span>
        <div class="pro-zoom" data-pro-zoom></div>
        <label class="pro-format pro-unit-field" id="pro-unit-field" title="${escape(t('Units for the Width & Height columns'))}">
          <select id="pro-unit" class="field-select field-select--auto field-select--sm"
            aria-label="${escape(t('Units for the Width & Height columns'))}">${UNIT_OPTIONS.map(u => `<option value="${u}"${u === state.unit ? ' selected' : ''}>${u}</option>`).join('')}</select>
        </label>
        <label class="pro-format pro-dpi-field" id="pro-dpi-field" title="${escape(t('Raster resolution for physical units (mm/cm/in/pt). Ignored for px and for vector formats.'))}">
          <input type="number" id="pro-dpi" class="field-input field-input--auto field-input--sm"
            aria-label="${escape(t('Raster resolution in DPI'))}"
            min="36" max="1200" step="1" value="${state.dpi}"${state.unit === 'px' ? ' disabled' : ''}>
          <span class="pro-dpi-suffix" aria-hidden="true">dpi</span>
        </label>
        <label class="pro-format" id="pro-format-field" title="${escape(t('Output format for all rows (rows can override)'))}">
          <select id="pro-format" class="field-select field-select--auto field-select--sm"
            aria-label="${escape(t('Output format for every row'))}">${FORMAT_OPTIONS.map(f => `<option value="${f}"${f === state.format ? ' selected' : ''}>${f.toUpperCase()}</option>`).join('')}</select>
        </label>
        <button type="button" class="pro-btn pro-print-btn" id="pro-print" hidden aria-expanded="false"
          title="${escape(t('Bleed, print marks and the CMYK press profile for every row'))}">${ICON_CROP} ${t('Print')}</button>
        <button type="button" class="pro-btn" id="pro-sessions" title="${escape(t('Save or load a snapshot of this whole batch'))}">⛁ ${t('Sessions')}</button>
        <button type="button" class="pro-btn" id="pro-tosheet" title="${escape(t('Lay every row out on a printable sheet, n-up, to cut apart'))}">${t('Send to Print Sheet')}</button>
        <button type="button" class="pro-btn pro-btn--primary" id="pro-render" title="${escape(t('Render the batch'))}">${t('Render')}</button>
        ${langFabHtml()}
      </div>

      <section id="pro-kit-host" aria-label="${escape(t('Event kit'))}" hidden></section>
      <div id="pro-grid-host"></div>

      <div class="pro-progress" id="pro-progress" hidden></div>
    </div>
  `;

  let kitPanel: KitPanel | undefined;
  const gridHost  = viewEl.querySelector<HTMLElement>('#pro-grid-host')!;
  const progressEl = viewEl.querySelector<HTMLElement>('#pro-progress')!;
  const renderBtn = viewEl.querySelector<HTMLButtonElement>('#pro-render')!;
  const formatSel = viewEl.querySelector<HTMLSelectElement>('#pro-format')!;
  const unitSel = viewEl.querySelector<HTMLSelectElement>('#pro-unit')!;
  const dpiInput = viewEl.querySelector<HTMLInputElement>('#pro-dpi')!;
  const zipNameInput = viewEl.querySelector<HTMLInputElement>('#pro-zip-name')!;
  const printBtn = viewEl.querySelector<HTMLButtonElement>('#pro-print')!;
  // Declared HERE, not beside its open/close pair below: `syncPrintButton` is a
  // hoisted function declaration called from the first `renderGrid()`, which runs
  // before that point in the body - a `let` down there would still be in its
  // temporal dead zone and throw.
  let _printPop: PopoverEl | null = null;

  const detachLangMenu = attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);

  // Unit + DPI + Format + Sessions sit next to Render on desktop, but tuck into
  // the collapsible toolbar group (hamburger menu) on mobile. CSS can't reparent
  // across the breakpoint, so relocate them on match-media change.
  const unitField = viewEl.querySelector<HTMLElement>('#pro-unit-field')!;
  const dpiField = viewEl.querySelector<HTMLElement>('#pro-dpi-field')!;
  const formatField = viewEl.querySelector<HTMLElement>('#pro-format-field')!;
  const sessionsBtn = viewEl.querySelector<HTMLElement>('#pro-sessions')!;
  const toolbarGroup = viewEl.querySelector<HTMLElement>('#pro-toolbar-group')!;
  const zoomField = viewEl.querySelector<HTMLElement>('[data-pro-zoom]')!;
  const sheetButton = viewEl.querySelector<HTMLElement>('#pro-tosheet')!;
  const narrowMq = window.matchMedia('(max-width: 720px)'); // keep in sync with the @media in pro.css
  const placeFormat = () => {
    if (narrowMq.matches) toolbarGroup.append(zoomField, unitField, dpiField, formatField, printBtn, sessionsBtn, sheetButton);
    else renderBtn.before(zoomField, unitField, dpiField, formatField, printBtn, sessionsBtn, sheetButton); // desktop order
  };
  placeFormat();
  narrowMq.addEventListener('change', placeFormat);

  // Auto-size the zip-name field so the ".zip" suffix trails the last character
  // the user types instead of being pinned to the far right. A hidden span mirrors
  // the text to measure its pixel width; we clamp to the room the field actually
  // has so a long name scrolls inside the input rather than shoving ".zip" off the
  // edge. On mobile the field is a full-width dropdown row, so CSS owns sizing there.
  const zipField = zipNameInput.closest<HTMLElement>('.pro-zip')!;
  const zipExt = zipField.querySelector<HTMLElement>('.pro-zip-ext')!;
  const zipMeasure = document.createElement('span');
  zipMeasure.className = 'pro-zip-measure';
  zipMeasure.setAttribute('aria-hidden', 'true');
  zipField.appendChild(zipMeasure);
  const sizeZip = () => {
    if (narrowMq.matches) { zipNameInput.style.width = ''; return; }
    zipMeasure.textContent = zipNameInput.value || zipNameInput.placeholder || '';
    const cs = getComputedStyle(zipField);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
    const room = zipField.clientWidth - padX - zipExt.offsetWidth - gap;
    const want = zipMeasure.offsetWidth + 2;        // +2 keeps the caret from clipping
    zipNameInput.style.width = `${Math.max(40, Math.min(want, room))}px`;
  };
  const zipRO = new ResizeObserver(sizeZip);        // fires on mount + toolbar/zoom reflow
  zipRO.observe(zipField);
  narrowMq.addEventListener('change', sizeZip);

  // UI zoom (the −/+ pair, on the shared zoom HUD): emulate Cmd +/− using the
  // CSS `zoom` property, which reflows the whole page like native zoom. Works
  // on desktop AND lets a zoomed mobile display be shrunk back down. Applied
  // to <html> so it affects the entire UI, and persisted across the session.
  // This is an INTERFACE scale, not a canvas zoom - there's no "Fit" concept
  // (nothing to fit to), so the HUD renders no Fit button; its readout is a
  // real control instead (clicking it resets to 100%, same job Fit does
  // elsewhere), which is what onFit maps to here.
  const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  const ZOOM_KEY = 'ct-ui-zoom';
  const readZoom = () => { const z = parseFloat(localStorage.getItem(ZOOM_KEY) as string); return Number.isFinite(z) && z > 0 ? z : 1; };
  function applyZoom(z: number) {
    document.documentElement.style.zoom = z === 1 ? '' : String(z);
    try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* storage may be blocked */ }
    zoomHud.setReadout(`${Math.round(z * 100)}%`);
    zoomHud.setValue(z);
  }
  function stepZoom(dir: number) {
    const cur = readZoom();
    const i = ZOOM_STEPS.reduce((best, s, idx) => Math.abs(s - cur) < Math.abs(ZOOM_STEPS[best]! - cur) ? idx : best, 0);
    applyZoom(ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))]!);
  }
  const zoomHud = mountZoomHud(viewEl.querySelector<HTMLElement>('[data-pro-zoom]')!, {
    ariaLabel: t('Zoom interface'),
    classes: { btn: 'pro-zoom-btn', pct: 'pro-zoom-pct' },
    onZoom: (dir) => stepZoom(dir),
    onFit: () => applyZoom(1), // the readout's own click - "reset to 100%", this HUD's stand-in for Fit
    outAriaLabel: t('Zoom out'),
    inAriaLabel: t('Zoom in'),
    pctAriaLabel: t('Reset zoom to 100%'),
    outTitle: t('Zoom out - shrink the whole interface'),
    inTitle: t('Zoom in - enlarge the whole interface'),
    pctTitle: t('Reset zoom to 100%'),
    min: ZOOM_STEPS[0],
    max: ZOOM_STEPS[ZOOM_STEPS.length - 1],
    initialReadout: `${Math.round(readZoom() * 100)}%`,
  });
  applyZoom(readZoom()); // restore any prior zoom on entry

  // Saved batch sessions (snapshot the whole grid; persisted via host.state).
  const sessions = createSessionStore(host);

  // Dirty tracking: compare a canonical snapshot of the batch against the
  // baseline captured at load / last save. snapshotFromState already drops
  // transient bits (uid, manifest), so a serialise-compare is robust; it errs
  // toward false-positives, the safe direction for a "save before leaving?" guard.
  const serialize = () => { if (state.kit) captureKitEdits(state.kit, state.rows); return JSON.stringify(snapshotFromState(state)); };
  let baseline: string | null = null;        // set once the initial grid is in place
  const isDirty = () => baseline !== null && serialize() !== baseline;
  const markClean = () => { baseline = serialize(); };

  // Leaving /pro via the back pill. The pill owns the actual navigation (it goes
  // back to wherever you came from, not unconditionally to the gallery - see
  // components/back-pill.ts); this only takes the click over when the batch is
  // dirty, to offer saving it as a session first, and hands the pill's own `go`
  // back once the user has decided.
  let leaveAfterSave = false;
  let goHome = () => { location.hash = '#/'; };   // replaced by the pill's `go` on the guarded path
  mountBackPill(viewEl, {
    intercept: (go) => {
      // Only guard when there's unsaved, saveable work: a session needs at least
      // one template row (doSave enforces it), so prompting otherwise would offer a
      // "save" that can't succeed. Clean / empty → let the pill navigate.
      if (!isDirty() || !state.rows.some(r => r.toolId)) return false;
      goHome = go;
      showSaveSessionDialog({
        // Open the Sessions popover, then arm the one-shot "leave after saving"
        // intent - openSessions() runs closeSessions() synchronously (which clears
        // the flag), so it must be set *after* the call. doSave consumes it; an
        // abandoned popover clears it via closeSessions, so a later normal save
        // won't navigate.
        onSave: () => { openSessions(sessionsBtn); leaveAfterSave = true; },
        onLeave: () => go(),
      });
      return true;
    },
  });

  // Spreadsheet keyboard navigation (roving focus + focused/editing states).
  const nav = createGridNav(gridHost, {
    // Alt+↑/↓ reorders the focused row - the keyboard peer of the grip-drag. state
    // is authoritative (dirty is computed from it); renderGrid() re-renders and
    // nav.refresh({restoreFocus}) re-focuses the row by uid, so focus rides along.
    onReorderRow: (rowUid, dir) => {
      const i = state.rows.findIndex(r => r.uid === rowUid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= state.rows.length) return; // already at the top/bottom
      const moved = state.rows[i]!;
      state.rows[i] = state.rows[j]!;
      state.rows[j] = moved;
      renderGrid();
    },
  });

  // ── Delete-row confirm (two-step) ───────────────────────────────────────────
  // A row's ✕ arms on first click and confirms on the second; declared before the
  // first renderGrid() (which clears any pending arm) so there's no TDZ on call.
  // ReturnType<typeof setTimeout> | 0 rather than number: with transformers.js
  // in the program (host.speech), sharp's types pull @types/node globals in and
  // setTimeout's return stops being plain `number`.
  let _armedRemove: HTMLElement | null = null, _armTimer: ReturnType<typeof setTimeout> | 0 = 0;
  function clearRemoveArm() {
    if (_armTimer) { clearTimeout(_armTimer); _armTimer = 0; }
    if (_armedRemove) {
      _armedRemove.classList.remove('is-armed');
      _armedRemove.textContent = '✕';
      _armedRemove.title = 'Remove row';
      _armedRemove.setAttribute('aria-label', 'Remove row');
      _armedRemove = null;
    }
  }
  function armRemove(btn: HTMLElement) {
    clearRemoveArm();
    _armedRemove = btn;
    btn.classList.add('is-armed');
    btn.textContent = 'Remove?';
    btn.title = 'Click again to remove this row';
    btn.setAttribute('aria-label', 'Confirm remove row');
    _armTimer = setTimeout(clearRemoveArm, 3000); // auto-cancel if left untouched
  }

  // Colour cells (id is "row~col") write straight back to the row's values.
  // Shared so the full render and the single-row swap (replaceRow) wire colour
  // fields identically.
  const colorOnChange = (id: string, value: ColorFieldValue) => {
    const sep = id.indexOf('~');
    const r = rowByUid(id.slice(0, sep));
    if (r) r.values[id.slice(sep + 1)] = value;
  };

  // ── Render / re-render the grid from state ──────────────────────────────────
  function renderGrid() {
    clearRemoveArm(); // a re-render replaces the buttons; drop any pending confirm
    // Capture before we blow away the DOM, so nav can restore focus afterwards.
    const hadFocus = gridHost.contains(document.activeElement);
    // Preserve scroll across the full DOM swap: innerHTML recreates the
    // overflow:auto container (.pro-grid-scroll), which would otherwise snap a
    // scrolled grid back to 0,0 on every bulk-fill / paste / delete. Restored
    // AFTER nav.refresh, so focus-scrolling doesn't fight the restore.
    const prevScroll = gridHost.querySelector('.pro-grid-scroll');
    const scrollX = prevScroll?.scrollLeft ?? 0;
    const scrollY = prevScroll?.scrollTop ?? 0;
    ctx.unit = state.unit; ctx.dpi = state.dpi; // toolbar defaults that rows inherit
    ctx.collapsed = state.collapsed;            // export-column collapse for bodyRow (incl. addRows)
    const all = deriveColumns(state.rows.filter(r => r.manifest));
    // Collapsed columns are hidden from the matrix but keep their data - they're
    // shown as restorable tags below the grid. Visible columns drive everything.
    const visible = all.filter((c: any) => !state.collapsed.has(c.key));
    const hidden = all.filter((c: any) => state.collapsed.has(c.key));
    gridHost.innerHTML = renderGridHtml(state as unknown as Parameters<typeof renderGridHtml>[0], visible, ctx as unknown as Parameters<typeof renderGridHtml>[2], hidden);
    // Wire the shared SUSE colour picker for any colour cells (id is "row~col").
    wireColorField(gridHost, { onChange: colorOnChange });
    const filled = state.rows.filter(r => r.toolId).length;
    renderBtn.disabled = filled === 0 || state.running; // count text now lives in the columns bar
    nav.refresh({ restoreFocus: hadFocus });
    const nextScroll = gridHost.querySelector('.pro-grid-scroll');
    if (nextScroll) { nextScroll.scrollLeft = scrollX; nextScroll.scrollTop = scrollY; }
    highlightRelevantTags(); // outline the hidden tags the active row actually uses
    kitPanel?.refresh();
    syncPrintButton();       // rows (and their formats) decide whether print applies
    return visible;
  }

  // Swap a single row's <tr> in place. A per-row format/unit change touches only
  // that row (the column set is derived from the chosen tools, which don't
  // change), so a full renderGrid() - with its scroll capture/restore and total
  // re-wire - is wasted work. Re-wires just this row's colour fields and asks nav
  // to re-find the active cell inside the fresh <tr>. Falls back to a full render
  // if the row's gone.
  function replaceRow(uid: string) {
    const row = rowByUid(uid);
    const tr = gridHost.querySelector(`tbody tr[data-row="${CSS.escape(uid)}"]`);
    if (!row || !tr) { columns = renderGrid(); return; }
    const hadFocus = gridHost.contains(document.activeElement);
    const tmp = document.createElement('template');
    tmp.innerHTML = bodyRow(row as unknown as Parameters<typeof bodyRow>[0], columns, ctx as unknown as Parameters<typeof bodyRow>[2]);
    const next = tmp.content.firstElementChild as HTMLElement | null;
    if (!next) { columns = renderGrid(); return; }
    tr.replaceWith(next);
    wireColorField(next, { onChange: colorOnChange });
    nav.refresh({ restoreFocus: hadFocus });
  }

  // Outline the hidden data-column tags that the row you're on actually uses, so a
  // Pro scanning row-by-row sees at a glance which collapsed inputs apply here.
  // Export tags (Save as / size / dpi) apply to every row, so they're never flagged.
  // Uses state.rows directly (not rowByUid, declared below) so it's safe to call
  // from the first renderGrid() before that const is initialised.
  function highlightRelevantTags() {
    const bar = gridHost.querySelector('.pro-collapsed-bar');
    if (!bar) return;
    const focused = gridHost.querySelector<HTMLElement>('.pro-cell--focused');
    const row = focused && state.rows.find(r => r.uid === focused.dataset.row);
    const ids = new Set((row && row.manifest ? row.manifest.inputs ?? [] : []).map((i: any) => i.id));
    bar.querySelectorAll<HTMLElement>('.pro-collapsed-tag:not(.pro-collapsed-tag--export)').forEach(tag => {
      tag.classList.toggle('is-relevant', ids.has(tag.dataset.restoreCol));
    });
  }

  let columns = renderGrid();
  // The first cell's ring is set by nav.refresh (in renderGrid). Actually OPENING
  // its template search waits until the end of mount (openFirstTemplateSearch) - 
  // the grid's click/focusin handlers are wired below, so doing it here would
  // fire before them and the chooser wouldn't open (you'd have to press Return).

  const rowByUid = (uid: string | undefined) => state.rows.find(r => r.uid === uid);
  const colByKey = (key: string | undefined) => columns.find((c: any) => c.key === key);

  // Row-height + column-width drag resize. Mutates state directly (no re-render);
  // the renderer re-applies persisted sizes on the next render.
  const detachResize = attachResize(gridHost, {
    setRowHeight: (uid: string, h: number) => { const r = rowByUid(uid); if (r) r.height = h; },
    setColWidth: (key: string, w: number) => { state.colWidths[key] = w; },
  });

  // Drag-to-scrub the Width/Height cells. Commits by firing a normal `input`
  // event so the same handler that catches typing updates the row state - no
  // re-render, just a value write per frame (see scrub.js for the perf notes).
  const detachScrub = attachScrub(gridHost, {
    selector: 'input.pro-num',
    getFallback: (el: HTMLInputElement) => { const n = parseInt(el.placeholder, 10); return Number.isFinite(n) ? n : 0; },
    onCommit: (el: HTMLInputElement) => el.dispatchEvent(new Event('input', { bubbles: true })),
  });

  // Drag a row's grip handle (in the actions cell) to reorder rows. The module
  // moves the <tr> live for feedback; on drop it hands back the new uid order and
  // we reorder state.rows to match, then re-render so state stays authoritative.
  const detachReorder = attachReorder(gridHost, {
    scrollEl: () => gridHost.querySelector('.pro-grid-scroll'),
    onReorder: (order: string[]) => {
      const pos = new Map(order.map((uid, i) => [uid, i]));
      state.rows.sort((a, b) => (pos.get(a.uid) ?? 0) - (pos.get(b.uid) ?? 0));
      columns = renderGrid();
    },
  });

  // ── Template selection ──────────────────────────────────────────────────────
  async function selectTemplate(uid: string, name: string) {
    const row = rowByUid(uid);
    if (!row) return;
    const tool = toolByName.get(name);
    if (!tool) { renderGrid(); return; } // unknown text → revert to current
    if (tool.id === row.toolId) return;
    // Snapshot the columns that already exist (from other rows). Anything the new
    // tool introduces beyond these is brand-new and starts collapsed, so the user
    // opts into the fields they want; columns shared with other docs stay shown.
    const existingKeys = new Set(deriveColumns(state.rows.filter(r => r.manifest)).map((c: any) => c.key));
    row.toolId = tool.id;
    row.manifest = null;
    try {
      const loaded = await getTool(tool.id);
      row.manifest = loaded.manifest;
      // Drop values that no longer correspond to an input on the new tool.
      const ids = new Set((loaded.manifest.inputs ?? []).map((i: any) => i.id));
      row.values = Object.fromEntries(Object.entries(row.values).filter(([k]) => ids.has(k)));
      // Drop a per-row format the new tool can't produce.
      if (row.format && !(loaded.manifest.render?.formats ?? []).includes(row.format)) row.format = undefined;
      // Hide only the columns this tool just introduced - EXCEPT a whitelist of
      // common, high-value inputs (headshot/image/photo/heading) that are worth
      // showing straight away when a tool uses them.
      for (const c of deriveColumns(state.rows.filter(r => r.manifest))) {
        if (!existingKeys.has(c.key) && !DEFAULT_VISIBLE_COLS.has(c.key)) state.collapsed.add(c.key);
      }
    } catch {
      row.toolId = '';
    }
    columns = renderGrid();
  }

  // ── Template search popover ───────────────────────────────────────────────
  // A body-mounted float popover docked to the cell's top-left: a focused search
  // box on top, a filtered list of tools below. Replaces the old datalist combobox
  // (which was a pain to trigger on touch).
  let _tplPop: PopoverEl | null = null;
  let _tplSuppress = false; // briefly true after closing, so refocus doesn't reopen
  function closeTemplatePicker() {
    if (!_tplPop) return;
    document.removeEventListener('pointerdown', _tplPop._onOutside!, true);
    _tplPop.remove();
    _tplPop = null;
    _tplSuppress = true;
    setTimeout(() => { _tplSuppress = false; }, 0);
  }
  function openTemplatePicker(td: HTMLElement | null, row: GridRow | null | undefined) {
    if (!td || !row) return;
    if (_tplPop && _tplPop._row === row.uid) return; // already open for this cell
    closeBulkPopover(); closeSessions(); closePrintPopover(); closeTemplatePicker(); closeBlocksPanel();

    const pop: PopoverEl = document.createElement('div');
    pop.className = 'pro-popover pro-tpl-popover';
    pop._row = row.uid;
    pop.innerHTML = `
      <input type="search" class="pro-tpl-search" role="combobox" aria-expanded="true" aria-controls="pro-tpl-listbox" aria-autocomplete="list" aria-activedescendant="" placeholder="${escape(t('Search templates…'))}" autocomplete="off" spellcheck="false" aria-label="${escape(t('Search templates'))}">
      <ul class="pro-tpl-list" id="pro-tpl-listbox" role="listbox"></ul>`;
    document.body.appendChild(pop);
    _tplPop = pop;

    // Dock to the cell's top-left (overlays it), escaping the scroll container.
    // Nudge 2px left so the popover's flat left edge aligns flush with the grid.
    // Height: claim the whole viewport below the anchor (Andy, 2026-08-20 - the
    // list should show as much of itself as it can), overriding the sheet's
    // 60vh cap; the list inside scrolls for whatever still doesn't fit.
    const r = td.getBoundingClientRect();
    const W = Math.max(240, Math.round(r.width));
    const left = Math.max(6, Math.min(r.left - 2, window.innerWidth - W - 8));
    const top = Math.round(r.top);
    const maxH = Math.max(240, window.innerHeight - top - 10);
    pop.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${W}px;max-height:${maxH}px;z-index:9999;`;

    const search = pop.querySelector<HTMLInputElement>('.pro-tpl-search')!;
    const listEl = pop.querySelector<HTMLElement>('.pro-tpl-list')!;
    let shown: IndexedTool[] = [];
    let active = 0;

    // Point the combobox at its active option so screen readers announce it as
    // focus moves through the list (the search box keeps DOM focus throughout).
    const syncActiveDescendant = () => {
      search.setAttribute('aria-activedescendant', listEl.querySelector('.pro-tpl-opt.is-active')?.id ?? '');
    };
    const draw = (q: string) => {
      // lib/search matching (plans/99 M3): folded token AND over the NAME only - 
      // deliberately narrow (plan section 1 documents the scope), this list is short
      // and its rows show nothing but the name.
      const tokens = tokenize(q);
      shown = tokens.length
        ? tools.filter(t => scoreHaystack([{ text: fold(t.name ?? t.id), weight: 1 }], tokens) > 0)
        : tools;
      active = Math.min(active, Math.max(0, shown.length - 1));
      listEl.innerHTML = shown.length
        ? shown.map((t, i) => `<li><button type="button" role="option" id="pro-tpl-opt-${i}" aria-selected="${i === active ? 'true' : 'false'}" class="pro-tpl-opt${i === active ? ' is-active' : ''}" data-tool="${escape(t.name)}">
            <span class="pro-tpl-opt-ic" aria-hidden="true">${t.icon ?? ''}</span><span class="pro-tpl-opt-name">${escape(t.name)}</span>${t.status === 'experimental' ? '<span class="pro-tpl-opt-exp">exp</span>' : ''}
          </button></li>`).join('')
        : `<li class="pro-tpl-none">${t('No templates match “{query}”.', { query: q })}</li>`;
      syncActiveDescendant();
    };
    const highlight = () => {
      [...listEl.querySelectorAll('.pro-tpl-opt')].forEach((b, i) => {
        const on = i === active;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      listEl.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
      syncActiveDescendant();
    };
    const pick = async (name: string, advance = false) => {
      closeTemplatePicker();
      await selectTemplate(row.uid, name);
      if (advance) {
        // Keyboard flow: drop straight into this row's "Save as" cell, ready to type.
        gridHost.querySelector<HTMLElement>(`td[data-row="${row.uid}"][data-col="__filename"] .pro-control`)?.focus();
      } else {
        // Mouse pick: keep focus on the (re-rendered) template cell.
        gridHost.querySelector<HTMLElement>(`td[data-row="${row.uid}"][data-col="__template"]`)?.focus();
      }
    };

    draw('');
    search.addEventListener('input', () => { active = 0; draw(search.value); });
    listEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
      if (btn) pick(btn.dataset.tool!);
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(shown.length - 1, active + 1); highlight(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); highlight(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (shown[active]) pick(shown[active]!.name, true); e.preventDefault(); }
      else if (e.key === 'Escape') { closeTemplatePicker(); td.focus(); e.preventDefault(); }
    });

    // Outside-press closes (capture so it beats the grid's own handlers).
    const onOutside = (e: PointerEvent) => { if (!pop.contains(e.target as Node) && !td.contains(e.target as Node)) closeTemplatePicker(); };
    pop._onOutside = onOutside;
    setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
    // Fine pointers only - on touch the popover still opens (the list is right
    // there to tap), but focusing the field would pop the keyboard uninvited,
    // including on the auto-open at /batch's first empty cell (mirrors the
    // gate in components/search-bar.ts's claimSearchBar).
    if (!window.matchMedia('(pointer: coarse)').matches) search.focus();
  }

  // ── Event delegation on the grid ────────────────────────────────────────────
  gridHost.addEventListener('change', async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-row-format]')) {
      const row = rowByUid(t.dataset.rowFormat);
      // Only this row's template-cell format face changes; swap just its <tr>.
      // replaceRow swaps one <tr> and skips renderGrid, so the Print button's
      // gating has to be refreshed here: a single row switched to Print PDF is
      // exactly the case that makes print settings relevant to this run.
      if (row) { row.format = t.value || undefined; replaceRow(row.uid); syncPrintButton(); }
      return;
    }
    if (t.matches('[data-out-unit]')) {
      const row = rowByUid(t.dataset.row);
      // The DPI cell + width/height placeholders depend on the unit, but all live
      // in this row - swap just its <tr> (no column-set change).
      if (row) { row.unit = t.value; replaceRow(row.uid); }
      return;
    }
    const cell = t.closest?.('[data-cell]') as HTMLElement | null;
    if (cell) commitCell(cell.dataset.row, cell.dataset.col, t);
  });

  gridHost.addEventListener('input', (e) => {
    if ((e.target as HTMLInputElement).matches('[data-filename]')) {
      const r = rowByUid((e.target as HTMLInputElement).dataset.row);
      if (r) r.filename = (e.target as HTMLInputElement).value;
      return;
    }
    if ((e.target as HTMLInputElement).matches('[data-out-width]')) {
      const r = rowByUid((e.target as HTMLInputElement).dataset.row);
      if (r) r.outWidth = (e.target as HTMLInputElement).value ? (parseFloat((e.target as HTMLInputElement).value) || undefined) : undefined;
      return;
    }
    if ((e.target as HTMLInputElement).matches('[data-out-height]')) {
      const r = rowByUid((e.target as HTMLInputElement).dataset.row);
      if (r) r.outHeight = (e.target as HTMLInputElement).value ? (parseFloat((e.target as HTMLInputElement).value) || undefined) : undefined;
      return;
    }
    if ((e.target as HTMLInputElement).matches('[data-out-dpi]')) {
      const r = rowByUid((e.target as HTMLInputElement).dataset.row);
      if (r) r.dpi = (e.target as HTMLInputElement).value ? (parseInt((e.target as HTMLInputElement).value, 10) || undefined) : undefined;
      return;
    }
    const cell = (e.target as HTMLInputElement).closest?.('[data-cell]') as HTMLElement | null;
    if (cell && (e.target as HTMLInputElement).type !== 'checkbox') commitCell(cell.dataset.row, cell.dataset.col, e.target as HTMLElement);
  });

  gridHost.addEventListener('click', async (e) => {
    // Cancel a pending delete-confirm the moment the user clicks anything that
    // isn't the very button they armed (clicking it again is the confirm path).
    if (_armedRemove && (e.target as HTMLElement).closest('[data-action="remove-row"]') !== _armedRemove) clearRemoveArm();

    const tpl = (e.target as HTMLElement).closest<HTMLElement>('[data-template-trigger]');
    if (tpl) { openTemplatePicker(tpl.closest<HTMLElement>('td'), rowByUid(tpl.dataset.row)); return; }

    const blkTrigger = (e.target as HTMLElement).closest<HTMLElement>('[data-blocks-trigger]');
    if (blkTrigger) { editBlocksCell(blkTrigger.dataset.row!, blkTrigger.dataset.col!); return; }
    const blkBulk = (e.target as HTMLElement).closest<HTMLElement>('[data-bulk-blocks]');
    if (blkBulk) { bulkEditBlocks(blkBulk.dataset.bulkBlocks!); return; }

    const preview = (e.target as HTMLElement).closest<HTMLElement>('[data-preview-row]');
    if (preview) { openPreview(preview.dataset.previewRow!); return; }

    // Two-step delete: a stray click only arms the ✕; a deliberate second click on
    // the same (now red "Remove?") button confirms. Any other click - handled by
    // the disarm guard at the top of this listener - or a 3s timeout cancels it.
    const remove = (e.target as HTMLElement).closest<HTMLElement>('[data-action="remove-row"]');
    if (remove) {
      if (remove === _armedRemove) {
        clearRemoveArm();
        state.rows = state.rows.filter(r => r.uid !== remove.dataset.row);
        if (state.rows.length === 0) state.rows.push(newRow());
        columns = renderGrid();
      } else {
        armRemove(remove);
      }
      return;
    }
    // Clearing an image (the ✕ that the ✓ badge becomes on hover) must be checked
    // before the picker, since the badge lives inside the [data-asset-pick] button.
    const assetClear = (e.target as HTMLElement).closest<HTMLElement>('[data-asset-clear]');
    if (assetClear) {
      const cell = assetClear.closest<HTMLElement>('[data-cell]');
      const row = cell && rowByUid(cell.dataset.row);
      if (row) { delete row.values[cell!.dataset.col!]; columns = renderGrid(); }
      return;
    }
    const assetBtn = (e.target as HTMLElement).closest<HTMLElement>('[data-asset-pick]');
    if (assetBtn) {
      const cell = assetBtn.closest<HTMLElement>('[data-cell]');
      await pickAssetForCell(cell!.dataset.row!, cell!.dataset.col!);
      return;
    }
    const fill = (e.target as HTMLElement).closest<HTMLElement>('[data-bulk-col]');
    if (fill) { openBulkPopover(fill, fill.dataset.bulkCol!); return; }

    // Click the column heading (not the Fill button) → collapse it to a tag.
    const collapse = (e.target as HTMLElement).closest<HTMLElement>('[data-collapse-col]');
    if (collapse) { state.collapsed.add(collapse.dataset.collapseCol!); columns = renderGrid(); return; }

    // Click a tag below the grid → restore that column.
    const restore = (e.target as HTMLElement).closest<HTMLElement>('[data-restore-col]');
    if (restore) { state.collapsed.delete(restore.dataset.restoreCol!); columns = renderGrid(); return; }

    // Add rows from the bottom bar (anchored where you'd use them).
    const addBtn = (e.target as HTMLElement).closest<HTMLElement>('[data-add-rows]');
    if (addBtn) { addRows(+addBtn.dataset.addRows! || 1); return; }

    // "Fill last": propagate the last template-filled row into every empty row.
    const fillLast = (e.target as HTMLElement).closest('[data-fill-last]');
    if (fillLast) { fillEmptyFromLast(); return; }

    // Hide every input column (then the user clicks back the ones they need);
    // Show all clears the collapsed set.
    if ((e.target as HTMLElement).closest('[data-hide-all-cols]')) { columns.forEach((c: any) => state.collapsed.add(c.key)); columns = renderGrid(); return; }
    if ((e.target as HTMLElement).closest('[data-show-all-cols]')) { state.collapsed.clear(); columns = renderGrid(); return; }

    // Full-cell hit target: clicking the cell's own area (not a child control)
    // activates the cell's control - toggle a checkbox, open a picker, or focus
    // a text field for editing. Makes the whole cell selectable. Skip the bottom
    // edge, which is the row-resize grab zone.
    if (isOnResizeEdge(e)) return;
    const td = (e.target as HTMLElement).closest<HTMLElement>('td.pro-cell[data-col]');
    if (td && e.target === td) {
      const c = td.querySelector('.pro-control') as HTMLInputElement | null;
      if (!c) return;
      if (c.type === 'checkbox' || c.matches('[data-asset-pick]')) c.click();
      else { c.focus(); if (typeof c.select === 'function') { try { c.select(); } catch { /* number */ } } }
    }
  });

  // Navigating onto an EMPTY template cell auto-opens its search popover (the
  // obvious next action is to pick a tool). A cell that already has a tool stays
  // put - the user hits Enter (or clicks/taps) to change it. The suppress flag
  // stops an immediate reopen when we refocus the cell after closing.
  gridHost.addEventListener('focusin', (e) => {
    highlightRelevantTags(); // moving onto a new row re-aims the relevance outline
    if (_tplSuppress) return;
    const td = (e.target as HTMLElement).closest?.('td[data-col="__template"]');
    if (td && e.target === td) {
      const row = rowByUid((td as HTMLElement).dataset.row);
      if (row && !row.toolId) openTemplatePicker(td as HTMLElement, row);
    }
  });

  // Paste a spreadsheet range (Excel/Sheets copy = TSV) to fill cells from the
  // focused cell down/right. Only multi-cell/grid pastes are hijacked; a plain
  // value pastes into the field normally. Use Upload CSV to also set templates.
  gridHost.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!/[\t\n]/.test(text)) return; // not a grid → let it paste normally
    const td = (e.target as HTMLElement).closest?.('td[data-row][data-col]') || gridHost.querySelector('.pro-cell--focused');
    if (!td) return;
    const grid = parseClipboardGrid(text);
    if (grid.length <= 1 && (grid[0]?.length ?? 0) <= 1) return;
    e.preventDefault();
    if (routeMappedPaste(td as HTMLElement, grid)) return; // header / fixed-column mapping (plans/140 S3)
    pasteFill((td as HTMLElement).dataset.row, (td as HTMLElement).dataset.col, grid);
  });

  function commitCell(uid: string | undefined, key: string | undefined, el: HTMLElement) {
    const row = rowByUid(uid);
    const col = colByKey(key);
    if (!row || !col) return;
    const input = cellInput(col, row);
    if (!input) return;
    row.values[key!] = readControlValue(el, input);
  }

  async function pickAssetForCell(uid: string, key: string) {
    const row = rowByUid(uid);
    const col = colByKey(key);
    const input = cellInput(col!, row!);
    if (!input) return;
    const ref = await host.assets.pick({
      title: `Choose ${input.label ?? input.id}`,
      type: (input.assetType === 'any' ? undefined : input.assetType) as PickOpts['type'],
      tags: input.filter?.tags as PickOpts['tags'],
      namespace: input.filter?.namespace as PickOpts['namespace'],
      allowUpload: input.allowUpload === true,
      current: row!.values[key]?.id,
    });
    if (ref) { row!.values[key] = ref; columns = renderGrid(); }
  }

  // ── Blocks (repeating field groups): edit one cell, or fill the column ───────
  // Per-cell block collapse state, remembered for the session only (NOT serialized
  // into saved tool sessions). Absent key ⇒ first open ⇒ all blocks collapsed.
  const blockUI: Record<string, any> = {};
  // A viewable raster/SVG format for the in-panel preview (png/webp/jpg/svg all
  // render in an <img>); falls back to whatever the tool supports. Returns null
  // for render-only tools so the panel shows "nothing to preview".
  function previewFormat(manifest: any) {
    const formats = manifest?.render?.formats ?? [];
    for (const pref of ['png', 'webp', 'jpg', 'svg']) if (formats.includes(pref)) return pref;
    return formats[0] ?? null;
  }
  // Render `row` at native size with `records` applied to its blocks `key`, for
  // the blocks panel's live preview. Native size keeps it fast - the block editor
  // changes content, not dimensions - and the same engine path the batch uses.
  async function renderBlocksPreview(row: GridRow, key: string, records: any) {
    if (!row?.toolId || !row.manifest || !isExportable(row.manifest)) return null;
    const fmt = previewFormat(row.manifest);
    if (!fmt) return null;
    const snapshot = { ...row, values: { ...row.values, [key]: records } };
    return renderRowToBlob(snapshot, host, { format: fmt });
  }

  async function editBlocksCell(uid: string, key: string) {
    const row = rowByUid(uid)!;
    const col = colByKey(key);
    const input = row && col && cellInput(col, row);
    if (!input) return;
    closeTemplatePicker(); closeBulkPopover(); closeSessions();
    const value = Array.isArray(row.values[key]) ? row.values[key] : (input.default ?? []);
    const uiKey = `${uid}~${key}`;
    await openBlocksEditor({
      input, value, host, assetPicker,
      initialExpanded: blockUI[uiKey] ?? null,            // null on first open → all collapsed
      onUi: (expanded: any) => { blockUI[uiKey] = expanded; }, // remember collapse state for the session
      // Live: each edit commits to this row and refreshes ONLY this cell's summary
      // (no full grid re-render → no scroll churn or focus loss while editing).
      onChange: (records: any) => { row.values[key] = records; refreshBlocksCell(uid, key, input, records); },
      // Live preview of THIS row as the blocks change (skipped for render-only tools).
      renderPreview: row.toolId ? (records: any) => renderBlocksPreview(row, key, records) : undefined,
    });
    // The panel held focus; put it back on the cell.
    gridHost.querySelector<HTMLElement>(`td[data-row="${uid}"][data-col="${key.replace(/["\\]/g, '\\$&')}"]`)?.focus();
  }
  // Update one blocks cell's summary button in place (mirrors grid.js dataCell).
  function refreshBlocksCell(uid: string, key: string, input: any, arr: any) {
    const td = gridHost.querySelector(`td[data-row="${uid}"][data-col="${key.replace(/["\\]/g, '\\$&')}"]`);
    const btn = td?.querySelector<HTMLElement>('.pro-blocks-trigger');
    if (!btn) return;
    const n = Array.isArray(arr) ? arr.length : 0;
    const firstField = (input.fields ?? [])[0]?.id;
    const preview = n && firstField
      ? arr.slice(0, 2).map((r: any) => r?.[firstField]).filter((v: any) => v != null && v !== '').map(String).join(', ')
      : '';
    btn.textContent = n ? `${n} row${n === 1 ? '' : 's'}${preview ? ' · ' + preview : ''}` : 'Add…';
    btn.classList.toggle('is-empty', n === 0);
    btn.title = `Edit “${input.label ?? key}” - ${n} item${n === 1 ? '' : 's'}`;
  }
  async function bulkEditBlocks(key: string) {
    const col = colByKey(key);
    if (!col || !col.members) return;
    const input = [...col.members.values()][0]; // representative declaration (fields are shared)
    const targets = state.rows.filter(r => r.toolId && col.members.has(r.toolId));
    if (!input || !targets.length) return;
    closeTemplatePicker(); closeBulkPopover(); closeSessions();
    // Preview the working value against the first target row, so a bulk edit still
    // shows what the blocks will look like before applying to all rows.
    const previewRow = targets.find(r => r.manifest && isExportable(r.manifest));
    const result = await openBlocksEditor({
      input, value: input.default ?? [], host, assetPicker, applyLabel: `Apply to ${targets.length}`,
      renderPreview: previewRow ? (records: any) => renderBlocksPreview(previewRow, key, records) : undefined,
    });
    if (result !== null) { targets.forEach(r => { r.values[key] = result.map((rec: any) => ({ ...rec })); }); columns = renderGrid(); }
  }

  // ── Bulk column write ───────────────────────────────────────────────────────
  async function openBulkPopover(anchorEl: HTMLElement, key: string) {
    const col = colByKey(key);
    if (!col || !col.bulk) return;
    const targets = bulkTargets(col, state.rows, { assetPicker });
    if (targets.length === 0) return;

    // Assets: skip the popover and go straight to the shared picker.
    if (col.type === 'asset') {
      const ref = await host.assets.pick({
        title: `Fill “${col.label}” for ${targets.length} rows`,
        type: (col.spec!.assetType === 'any' ? undefined : col.spec!.assetType) as PickOpts['type'],
        allowUpload: col.spec!.allowUpload === true,
      });
      if (ref) { targets.forEach((r: any) => { r.values[key] = ref; }); columns = renderGrid(); }
      return;
    }

    closeBulkPopover(); closeBlocksPanel();
    // Colour columns fill with the shared SUSE picker; everything else with a
    // plain control read on apply.
    const isColor = col.type === 'color';
    let colorValue = col.spec!.default ?? '';
    const pop: PopoverEl = document.createElement('div');
    pop.className = 'pro-popover';
    pop.innerHTML = `
      <div class="pro-popover-title">Fill “${escape(col.label)}” · ${targets.length} row${targets.length === 1 ? '' : 's'}</div>
      <div class="pro-popover-control">${
        isColor
          ? colorFieldHtml(`bulk~${escape(key)}`, colorValue, { float: true, swatchesOnly: col.spec!.swatchesOnly === true })
          : controlHtml(col.spec!, col.spec!.default ?? '', 'data-bulk-input', { label: col.label })
      }</div>
      <div class="pro-popover-actions">
        <button type="button" class="pro-btn" data-bulk-cancel>Cancel</button>
        <button type="button" class="pro-btn pro-btn--primary" data-bulk-apply>Apply to ${targets.length}</button>
      </div>`;
    document.body.appendChild(pop);
    positionPopover(pop, anchorEl);

    const apply = () => {
      const value = isColor ? colorValue : readControlValue(pop.querySelector('[data-bulk-input]') as HTMLElement, col.spec!);
      targets.forEach((r: any) => { r.values[key] = value; });
      closeBulkPopover();
      columns = renderGrid();
    };

    if (isColor) {
      wireColorField(pop, { onChange: (_id, value) => { colorValue = value; } });
    } else {
      const control = pop.querySelector<HTMLElement>('[data-bulk-input]');
      control?.focus();
      control?.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' && col.spec!.type !== 'longtext') apply(); });
    }

    pop.querySelector('[data-bulk-apply]')!.addEventListener('click', apply);
    pop.querySelector('[data-bulk-cancel]')!.addEventListener('click', closeBulkPopover);
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);

    function onOutside(e: PointerEvent) { if (!pop.contains(e.target as Node)) closeBulkPopover(); }
    pop._onOutside = onOutside;
  }

  let _popover: PopoverEl | null = null;
  function positionPopover(pop: PopoverEl, anchorEl: HTMLElement) {
    const r = anchorEl.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
    pop.style.left = `${Math.round(Math.min(r.left + window.scrollX, window.innerWidth - 280))}px`;
    _popover = pop;
  }
  function closeBulkPopover() {
    if (_popover) {
      document.removeEventListener('pointerdown', _popover._onOutside!);
      _popover.remove();
      _popover = null;
    }
  }

  // ── Run-level print settings (bleed, marks, press profile) ──────────────────
  // The grid's counterpart to the single-tool export panel's "Print marks & bleed"
  // and "Color profile" cards. These are RUN-LEVEL defaults, in the same class as
  // the toolbar's unit/DPI/format: every row inherits them, and a row carrying its
  // own value wins (pro/batch.ts resolvePrintSettings). They are persisted in the
  // batch snapshot, so a print run reopens print-ready.
  //
  // Gating is the panel's, unchanged: marks & bleed apply to pdf / pdf-cmyk /
  // cmyk-tiff, the press profile to the two CMYK formats only - read off the
  // RESOLVED format of each row (`row.format || state.format`), because a grid can
  // be all-PNG at run level with three rows overridden to Print PDF.

  /** The set of formats this run will actually produce. */
  function effectiveFormats(): Set<string> {
    const picked = state.rows.filter(r => r.toolId).map(r => r.format || state.format);
    return new Set(picked.length ? picked : [state.format]);
  }
  // Function DECLARATIONS, not consts: `syncPrintButton` runs inside the first
  // `renderGrid()`, which happens earlier in this function body than these lines - 
  // a `const` arrow would still be in its temporal dead zone and throw.
  function anyPrintFormat(): boolean { return [...effectiveFormats()].some(isPrintFmt); }
  function anyCmykFormat(): boolean { return [...effectiveFormats()].some(isCmykFmt); }

  /**
   * Show the Print button only when the run produces something printable, and
   * badge it when settings are actually set. Settings are NOT cleared when the
   * format moves away from print - they are inert for a non-print format and come
   * back untouched if the user switches back, exactly like a per-row DPI.
   */
  function syncPrintButton() {
    printBtn.hidden = !anyPrintFormat();
    const on = Boolean(state.bleed || state.marks || state.profile);
    printBtn.classList.toggle('is-on', on);
    printBtn.setAttribute('aria-label', on
      ? t('Print settings for every row - on')
      : t('Print settings for every row'));
    if (printBtn.hidden) closePrintPopover();
  }

  function closePrintPopover() {
    if (!_printPop) return;
    document.removeEventListener('pointerdown', _printPop._onOutside!);
    _printPop.remove();
    _printPop = null;
    printBtn.setAttribute('aria-expanded', 'false');
  }

  function openPrintPopover(anchorEl: HTMLElement) {
    closeBulkPopover();
    closeSessions();
    if (_printPop) { closePrintPopover(); return; }   // second click closes

    const marks = csvToMarks(state.marks);            // null when unset - keep it that way
    const enabled = Boolean(state.bleed || state.marks);
    const mm = state.bleed ? (parseFloat(state.bleed) || DEFAULT_BLEED_MM) : DEFAULT_BLEED_MM;
    const initProfile = (state.profile && (CMYK_CONDITIONS as Record<string, unknown>)[state.profile])
      ? state.profile : DEFAULT_CMYK_CONDITION;
    const check = (on: boolean | undefined): string => (on ? ' checked' : '');
    const pm = marks ?? csvToMarks(anyCmykFormat() ? DEFAULT_MARKS_CSV_CMYK : DEFAULT_MARKS_CSV)!;

    const pop: PopoverEl = document.createElement('div');
    pop.className = 'pro-popover pro-popover--print';
    pop.innerHTML = `
      <div class="pro-popover-title">${escape(t('Print marks & bleed'))}</div>
      <label class="pro-print-enable">
        <input type="checkbox" class="field-check" data-print-enable${check(enabled)}>
        <span>${escape(t('Add bleed and marks to every row'))}</span>
      </label>
      <div class="pro-print-body" data-print-body${enabled ? '' : ' hidden'}>
        <label class="pro-print-bleed">
          <span>${escape(t('Bleed'))}</span>
          <input type="number" class="pro-sess-input" data-print-bleed value="${mm}" min="0" max="25" step="0.5"
            aria-label="${escape(t('Bleed in millimetres'))}">
          <span>mm</span>
        </label>
        <div class="pro-print-toggles">
          <label><input type="checkbox" class="field-check" data-mark="crop"${check(pm.crop)}> ${escape(t('Crop'))}</label>
          <label><input type="checkbox" class="field-check" data-mark="reg"${check(pm.registration)}> ${escape(t('Registration'))}</label>
          <label><input type="checkbox" class="field-check" data-mark="bleed"${check(pm.bleed)}> ${escape(t('Bleed'))}</label>
          <label><input type="checkbox" class="field-check" data-mark="bars"${check(pm.colorBars)}> ${escape(t('Color bars'))}</label>
          <label><input type="checkbox" class="field-check" data-mark="prov"${check(pm.provenance)}> ${escape(t('Stamp details'))}</label>
        </div>
      </div>
      <div class="pro-print-cmyk"${anyCmykFormat() ? '' : ' hidden'}>
        <label class="pro-print-profile">
          <span>${escape(t('Color profile'))}</span>
          <select class="field-select field-select--sm" data-cmyk-profile aria-label="${escape(t('CMYK press profile'))}">
            ${Object.entries(CMYK_CONDITIONS).map(([id, c]) => `<option value="${escape(id)}"${id === initProfile ? ' selected' : ''}>${escape((c as { info?: string }).info ?? id)}</option>`).join('')}
          </select>
        </label>
      </div>
      <p class="pro-print-hint">${escape(t('Applies to every row. A row that carries its own print settings keeps them.'))}</p>
      <div class="pro-popover-actions"><button type="button" class="pro-btn" data-print-done>${escape(t('Done'))}</button></div>
    `;
    document.body.appendChild(pop);
    positionPrintPopover(pop, anchorEl);
    printBtn.setAttribute('aria-expanded', 'true');

    const enableEl = pop.querySelector<HTMLInputElement>('[data-print-enable]')!;
    const bodyEl = pop.querySelector<HTMLElement>('[data-print-body]')!;
    const bleedEl = pop.querySelector<HTMLInputElement>('[data-print-bleed]')!;
    const profileEl = pop.querySelector<HTMLSelectElement>('[data-cmyk-profile]')!;

    // Read the card back into run-level state on every change - no Apply step, so
    // the popover behaves like the rest of the toolbar (change it, it's set).
    const readBack = () => {
      if (!enableEl.checked) { state.bleed = ''; state.marks = ''; }
      else {
        const v = parseFloat(bleedEl.value);
        state.bleed = v > 0 ? `${v}mm` : '';
        state.marks = marksToCsv({
          crop: pop.querySelector<HTMLInputElement>('[data-mark="crop"]')!.checked,
          registration: pop.querySelector<HTMLInputElement>('[data-mark="reg"]')!.checked,
          bleed: pop.querySelector<HTMLInputElement>('[data-mark="bleed"]')!.checked,
          colorBars: pop.querySelector<HTMLInputElement>('[data-mark="bars"]')!.checked,
          provenance: pop.querySelector<HTMLInputElement>('[data-mark="prov"]')!.checked,
        });
      }
      // The press profile is its own card in the panel and stays independent of the
      // marks toggle here too - a CMYK run can name a press condition with no marks.
      state.profile = anyCmykFormat() ? profileEl.value : state.profile;
      bodyEl.hidden = !enableEl.checked;
      syncPrintButton();
    };
    pop.addEventListener('change', readBack);
    pop.addEventListener('input', (e) => { if ((e.target as HTMLElement).matches('[data-print-bleed]')) readBack(); });
    pop.querySelector('[data-print-done]')!.addEventListener('click', () => { closePrintPopover(); printBtn.focus(); });
    // Escape closes, like every other overlay in the app (house rule).
    pop.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') { e.preventDefault(); closePrintPopover(); printBtn.focus(); }
    });
    enableEl.focus();

    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
    function onOutside(e: PointerEvent) {
      if (!pop.contains(e.target as Node) && e.target !== printBtn) closePrintPopover();
    }
    pop._onOutside = onOutside;
    _printPop = pop;
  }

  // Right-aligned to the button (the toolbar sits at the right edge), clamped to
  // the viewport so the wider print card can't hang off-screen.
  function positionPrintPopover(pop: PopoverEl, anchorEl: HTMLElement) {
    const r = anchorEl.getBoundingClientRect();
    const w = 280;
    pop.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
    pop.style.left = `${Math.round(Math.max(8, Math.min(r.right + window.scrollX - w, window.innerWidth - w - 8)))}px`;
  }

  printBtn.addEventListener('click', () => openPrintPopover(printBtn));

  // ── Saved sessions ───────────────────────────────────────────────────────────
  // Replace the whole grid + view state with a saved snapshot, reloading each
  // row's manifest (same rebuild path the CSV import uses).
  async function applySnapshot(data: any) {
    let kit: KitState | undefined;
    try { kit = restoreKit(data.kit); } catch { showProgress('<p role="alert">This saved kit is unsupported or damaged.</p>'); return; }
    const rows = await rowsFromSnapshot(data, { newRow });
    state.kit = kit;
    viewEl.classList.toggle('kit-hide-rows', !!kit);
    state.rows = rows.length ? rows : blankRows();
    state.format = data.format ?? state.format;
    state.unit = data.unit ?? 'px';
    state.dpi = data.dpi ?? 300;
    // Run-level print settings. Absent (a snapshot saved before they existed) is
    // "not set" - never a fabricated default bleed.
    state.profile = data.profile ?? '';
    state.bleed = data.bleed ?? '';
    state.marks = data.marks ?? '';
    state.zipName = data.zipName ?? '';
    state.collapsed = new Set(data.collapsed ?? []);
    state.colWidths = data.colWidths ?? {};
    formatSel.value = state.format;
    unitSel.value = state.unit;
    dpiInput.value = String(state.dpi);
    dpiInput.disabled = (state.unit === 'px');
    zipNameInput.value = state.zipName;
    closePrintPopover();                      // its controls are stale after a load
    sizeZip();
    columns = renderGrid();
    nav.focusActive();
    markClean();                              // a freshly loaded snapshot is the new baseline
  }

  let _sessPop: PopoverEl | null = null;
  function closeSessions() {
    leaveAfterSave = false;                   // abandoning the popover cancels "save & leave"
    if (_sessPop) {
      document.removeEventListener('pointerdown', _sessPop._onOutside!);
      _sessPop.remove();
      _sessPop = null;
    }
  }

  async function openSessions(anchorEl: HTMLElement) {
    closeBulkPopover();
    closeSessions();
    const pop: PopoverEl = document.createElement('div');
    pop.className = 'pro-popover pro-popover--sessions';
    document.body.appendChild(pop);
    _sessPop = pop;
    await drawSessions(pop);
    const r = anchorEl.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
    pop.style.left = `${Math.round(Math.min(r.left + window.scrollX, window.innerWidth - 320))}px`;
    const onOutside = (e: PointerEvent) => { if (!pop.contains(e.target as Node)) closeSessions(); };
    pop._onOutside = onOutside;
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
  }

  // (Re)render the popover body - the saved list plus the save-current control.
  async function drawSessions(pop: HTMLElement) {
    const list = await sessions.list();
    pop.innerHTML = `
      <div class="pro-popover-title">Batch sessions</div>
      ${list.length ? `<ul class="pro-sess-list">${list.map((s: any) => `
        <li class="pro-sess-item">
          <button type="button" class="pro-sess-load" data-load="${escape(s.slot)}" data-name="${escape(s.name)}" title="Load “${escape(s.name)}”">
            <span class="pro-sess-name">${escape(s.name)}</span>
            <span class="pro-sess-when">${escape(relTime(s.updatedAt))}</span>
          </button>
          <button type="button" class="pro-sess-del" data-del="${escape(s.slot)}" title="Delete" aria-label="Delete ${escape(s.name)}">✕</button>
        </li>`).join('')}</ul>`
        : `<p class="pro-sess-empty">No saved sessions yet - save the current grid below.</p>`}
      <div class="pro-sess-save">
        <input type="text" class="pro-sess-input" placeholder="Session name" value="${escape(state.zipName.trim())}" autocomplete="off" spellcheck="false" maxlength="60">
        <button type="button" class="pro-btn pro-btn--primary" data-save>Save</button>
      </div>
      ${opts.folderApi ? `<div class="pro-sess-project">
        <label class="pro-sess-project-label" for="pro-sess-project-sel">Save to project</label>
        <select id="pro-sess-project-sel" data-project aria-label="Project to save this batch into"></select>
        <input type="text" class="pro-sess-newsub" data-new-subfolder placeholder="New subfolder name" autocomplete="off" maxlength="60" aria-label="New subfolder name" hidden>
        <p class="pro-sess-project-hint">You can add more later.</p>
      </div>` : ''}
      <div class="pro-sess-csv">
        <span class="pro-sess-csv-label">Offline CSV</span>
        <button type="button" class="pro-btn" data-csv-export title="Download this batch as a CSV to edit in any spreadsheet">↓ Download</button>
        <button type="button" class="pro-btn" data-csv-import title="Load a batch from a CSV / TSV file">↑ Upload</button>
      </div>
      ${opts.openFolderOverlay ? `<div class="pro-sess-folders">
        <button type="button" class="pro-btn" data-folders title="Organize sessions into folders and open a folder in the grid">📁 Folders…</button>
      </div>` : ''}`;

    pop.querySelector('[data-folders]')?.addEventListener('click', openFoldersOverlay);

    // CSV download/upload (offline round-trip). The hidden file input persists
    // outside the popover so the OS dialog survives the popover closing.
    pop.querySelector('[data-csv-export]')!.addEventListener('click', exportCsv);
    pop.querySelector('[data-csv-import]')!.addEventListener('click', () => fileInput.click());

    pop.querySelectorAll<HTMLElement>('[data-load]').forEach(btn => btn.addEventListener('click', async () => {
      const data = await sessions.load(btn.dataset.load!);
      if (!data) { showProgress(`<p class="pro-progress-msg pro-log-err">That session couldn't be loaded.</p>`); return; }
      await applySnapshot(data);
      closeSessions();
      showProgress(`<p class="pro-progress-msg">Loaded session “${escape(btn.dataset.name)}”.</p>`);
    }));

    pop.querySelectorAll<HTMLElement>('[data-del]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await sessions.delete(btn.dataset.del!);
      await drawSessions(pop);
    }));

    // ── Project picker (only when the shell injects a folderApi) ──────────────
    // Choose where the saved batch is FILED: its origin folder by default (the
    // Projects folder Batch was opened from), any existing project, or a fresh
    // subfolder created "for the batch". Options are DOM-built (a folder name is
    // user data, never a raw-HTML sink).
    const NEW_SUB = '__new_subfolder__';
    const projectSel = pop.querySelector<HTMLSelectElement>('[data-project]');
    const newSubInput = pop.querySelector<HTMLInputElement>('[data-new-subfolder]');
    if (opts.folderApi && projectSel) {
      const mkOpt = (value: string, label: string, depth = 0): HTMLOptionElement => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = (depth ? `${'  '.repeat(depth)}↳ ` : '') + label;
        return o;
      };
      projectSel.replaceChildren(mkOpt('', 'My library'));
      void opts.folderApi.list().then(folders => {
        for (const f of folders) projectSel.appendChild(mkOpt(f.id, f.name, f.depth));
        projectSel.appendChild(mkOpt(NEW_SUB, '＋ New subfolder…'));
        // Default to the origin folder the batch was invoked from, when it still exists.
        if (opts.originFolderId && folders.some(f => f.id === opts.originFolderId)) projectSel.value = opts.originFolderId;
      }).catch(() => { /* leave the "No project" option only */ });
      projectSel.addEventListener('change', () => {
        const isNew = projectSel.value === NEW_SUB;
        if (newSubInput) { newSubInput.hidden = !isNew; if (isNew) newSubInput.focus(); }
      });
    }

    const input = pop.querySelector<HTMLInputElement>('.pro-sess-save .pro-sess-input')!;
    const doSave = async () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      if (!state.rows.some(r => r.toolId)) {
        showProgress(`<p class="pro-progress-msg">Pick at least one template before saving a session.</p>`);
        return;
      }
      const label = await sessions.save(name, state);
      // File the saved batch into the chosen project - default its origin folder, a
      // picked one, or a freshly-created subfolder. Injected, so it degrades to the old
      // library-only save when no folderApi is present. A filing hiccup never loses the
      // save itself (the batch is already persisted), so it's logged, not thrown.
      let filedInto: string | null = null;
      if (opts.folderApi && projectSel) {
        try {
          let folderId: string | null = projectSel.value || null;
          if (folderId === NEW_SUB) {
            const sub = (newSubInput?.value || '').trim();
            folderId = sub ? (await opts.folderApi.create(sub, opts.originFolderId ?? null)).id : (opts.originFolderId ?? null);
          }
          await opts.folderApi.file(BATCH_SLOT_PREFIX + label, folderId);
          filedInto = folderId;
        } catch (err) { console.warn('Filing the batch into a project failed:', err); }
      }
      markClean();                            // saving makes the batch clean
      if (leaveAfterSave) { closeSessions(); goHome(); return; }
      await drawSessions(pop);
      pop.querySelector<HTMLElement>('.pro-sess-save .pro-sess-input')?.focus();
      showProgress(`<p class="pro-progress-msg">Saved “${escape(name)}”${filedInto ? ' to your project' : ''}.</p>`);
    };
    pop.querySelector('[data-save]')!.addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
  }

  // Open the shared folder overlay to organize sessions and open a whole folder
  // (group) into the grid - flattened, with each row's "Save as" carrying its
  // group/subgroup path. Folder *creation* is disabled here (done in the gallery);
  // /pro only browses, loads, and flattens.
  async function openFoldersOverlay() {
    if (!opts.openFolderOverlay) return;
    closeSessions();
    const [entriesRaw, sizes] = await Promise.all([
      host.state.list(),
      host.state.sizes().catch(() => ({})),
    ]);
    const entries = entriesRaw.filter(e => !isHiddenSlot(e.slot));
    const nameById = new Map(((window as WindowWithIndex).__toolIndex?.tools ?? []).map(t => [t.id, t.name]));
    opts.openFolderOverlay(host, {
      context: 'pro',
      sessionEntries: entries,
      sessionSizes: sizes,
      nameById,
      showCreateFolder: false,        // groups are created in the gallery
      allowBatchExport: false,        // exporting from inside the grid is redundant
      onResume: async (entry: any) => {
        const data = await sessions.load(entry.slot);   // null unless a batch slot
        if (data) await applySnapshot(data);
        else window.location.hash = `#/tool/${entry.toolId}?slot=${encodeURIComponent(entry.slot)}`;
      },
      onOpenGroup: async (folder: any) => {
        // Flatten every subgroup's rows into the grid; each row's filename already
        // carries its "group/subgroup/stem" path (set by rowsForFolder).
        const rows = await rowsForFolder(host, folder);
        if (!rows.length) { showProgress(`<p class="pro-progress-msg">That folder has no renderable rows.</p>`); return; }
        await applySnapshot({ rows, zipName: folder.name });
        showProgress(`<p class="pro-progress-msg">Opened folder “${escape(folder.name)}” - ${rows.length} row${rows.length === 1 ? '' : 's'} flattened into the grid.</p>`);
      },
    });
  }

  function relTime(iso: string | undefined) {
    if (!iso) return '';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  // ── Toolbar ─────────────────────────────────────────────────────────────────
  formatSel.addEventListener('change', (e) => { state.format = (e.target as HTMLSelectElement).value; syncPrintButton(); });
  zipNameInput.addEventListener('input', (e) => { state.zipName = (e.target as HTMLInputElement).value; sizeZip(); });

  // The toolbar unit/DPI are the DEFAULTS every row inherits (row.unit/row.dpi
  // override per row, like the global vs per-row format). Changing a default
  // moves the rows still inheriting it; rows you've explicitly overridden keep
  // their unit (an explicit choice sticks). Re-render so effective units update.
  unitSel.addEventListener('change', (e) => {
    state.unit = (e.target as HTMLSelectElement).value;
    dpiInput.disabled = (state.unit === 'px');
    columns = renderGrid();
  });
  dpiInput.addEventListener('input', (e) => {
    const n = parseInt((e.target as HTMLInputElement).value, 10);
    if (n > 0) state.dpi = n; // the default; rows without a per-row DPI inherit it
  });
  // + Row / +5 live in the bottom bar (re-rendered with the grid), so they're
  // wired by delegation in the gridHost click handler via [data-add-rows].

  // Append empty rows incrementally - they never change the column set (columns
  // derive only from rows with a tool), so we just append <tr>s instead of
  // rebuilding the whole table. Falls back to a full render if the body's gone.
  function addRows(n: number): GridRow[] {
    const tbody = gridHost.querySelector('tbody');
    const added: GridRow[] = [];
    for (let i = 0; i < n; i++) { const r = newRow(); state.rows.push(r); added.push(r); }
    if (!tbody) { columns = renderGrid(); return added; }
    tbody.insertAdjacentHTML('beforeend', added.map(r => bodyRow(r as unknown as Parameters<typeof bodyRow>[0], columns, ctx as unknown as Parameters<typeof bodyRow>[2])).join(''));
    refreshFillLast(); // new empty rows may re-enable "Fill last"
    nav.refresh({ restoreFocus: false }); // include the new rows in the nav matrix
    return added;
  }

  // The "Fill last" button lives outside the table, so the incremental addRows
  // path doesn't re-render it - keep its disabled state in sync by hand. (A full
  // renderGrid bakes the same state in via addRowsHtml.)
  function refreshFillLast() {
    const btn = gridHost.querySelector<HTMLButtonElement>('[data-fill-last]');
    if (!btn) return;
    const hasSource = state.rows.some(r => r.toolId);
    const hasEmpty = state.rows.some(r => !r.toolId);
    btn.disabled = !(hasSource && hasEmpty);
  }

  // "Fill last": copy the last row that has a template into every row that has
  // none yet - turning one set-up row into a batch in a click. Each target gets
  // its OWN deep copy of the values (so later per-row edits stay independent) plus
  // the source's format / size / unit / dpi. The manifest is read-only data, so
  // it's shared by reference. Per-row filename is left auto so outputs don't
  // collide. Columns are unchanged (the source tool is already present), so a
  // plain re-render is enough.
  function fillEmptyFromLast() {
    let source: GridRow | null = null;
    for (const r of state.rows) if (r.toolId) source = r; // last filled row wins
    if (!source) return;
    let filled = 0;
    for (const row of state.rows) {
      if (row.toolId) continue;
      row.toolId = source.toolId;
      row.manifest = source.manifest;
      row.values = structuredClone(source.values ?? {});
      row.format = source.format;
      row.outWidth = source.outWidth;
      row.outHeight = source.outHeight;
      row.unit = source.unit;
      row.dpi = source.dpi;
      filled++;
    }
    if (filled) columns = renderGrid();
  }

  // Add one row and drop into its template search, ready to type a tool name.
  function addRowAndPick() {
    const [row] = addRows(1);
    if (!row) return;
    const td = gridHost.querySelector<HTMLElement>(`td[data-row="${row.uid}"][data-col="__template"]`);
    if (td) { td.focus(); openTemplatePicker(td, row); }
  }

  // "=" while a cell is focused (nav mode, not editing) quickly adds a row. Capture
  // phase + stopPropagation so grid-nav doesn't treat "=" as "type to edit". When
  // focus is inside a control (input/search/etc.) the key types normally.
  gridHost.addEventListener('keydown', (e) => {
    if (e.key !== '=' || (e.target as HTMLElement).tagName !== 'TD') return;
    e.preventDefault();
    e.stopPropagation();
    addRowAndPick();
  }, true);

  // ⌘/Ctrl+Enter adds a row from ANYWHERE in /pro - mid-edit, in the template
  // search, in the toolbar - since it produces no character it never fights
  // typing. Document-level + capture so it beats the per-cell / search Enter
  // handlers (and the body-mounted search popover, which isn't inside the grid).
  const onAddRowKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      addRowAndPick();
    }
  };
  document.addEventListener('keydown', onAddRowKey, true);

  renderBtn.addEventListener('click', () => { runBatchFlow().catch(err => reportFatal(err)); });

  // Send every filled row to Print Sheet as a LIVE tool link - no render is baked here.
  // Each cell holds the row's canonical embed URL (the same serializeUrlState → buildEmbedUrl
  // recipe openPreview uses for its deep link), which print-sheet re-renders through
  // host.compose.renderUrl on every mount, so the sheet follows later edits. The seed is
  // handed straight to print-sheet's mount (setPendingToolSeed → the tool view's seededDirect
  // path), so N links never have to fit in a URL. `once` lays each row out a single time and
  // paginates; row order is the drop-in order.
  const toSheetBtn = viewEl.querySelector<HTMLButtonElement>('#pro-tosheet')!;
  toSheetBtn.addEventListener('click', () => {
    const cells: { art: { id: string } }[] = [];
    for (const row of state.rows) {
      if (!row.toolId || !row.manifest) continue;
      const model = (row.manifest.inputs ?? []).map((i: any) => ({ ...i, value: row.values[i.id] ?? i.default }));
      const fmts = row.manifest.render?.formats ?? [];
      // Vector where the tool offers it (scales cleanly for print), else a raster still.
      const format = fmts.includes('svg') ? 'svg' : (fmts.find((f: string) => ['png', 'jpg', 'jpeg', 'webp'].includes(f)) ?? 'png');
      // keepUserIds: a same-device embed identity (see picker.ts embedSession).
      const url = buildEmbedUrl({ toolId: row.toolId, format, query: serializeUrlState(model, { keepUserIds: true }) });
      // The cell's artwork must be a REF OBJECT ({id}), not a bare string - the runtime's
      // assetRefId reads .id off an object and ignores bare strings, so a bare URL renders
      // an empty grid. The id is the canonical embed URL; resolveAssetRefs re-renders it.
      if (url) cells.push({ art: { id: url } });
    }
    if (!cells.length) { announce(t('Add a tool to a row first, then send the batch to a print sheet.')); return; }
    setPendingToolSeed('print-sheet', { cells, fill: 'once' });
    navigateTo('#/tool/print-sheet');
  });
  viewEl.querySelector('#pro-sessions')!.addEventListener('click', (e) => { openSessions(e.currentTarget as HTMLElement).catch(err => reportFatal(err)); });

  // Hamburger: at narrow widths the toolbar controls collapse into a dropdown
  // (CSS-driven); this just toggles it open and closes it on an outside tap.
  const toolbarEl = viewEl.querySelector<HTMLElement>('.pro-toolbar')!;
  const menuBtn = viewEl.querySelector<HTMLElement>('#pro-menu')!;
  const closeMenu = () => { toolbarEl.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuBtn.setAttribute('aria-expanded', toolbarEl.classList.toggle('is-open') ? 'true' : 'false');
  });
  const onDocPointer = (e: PointerEvent) => { if (toolbarEl.classList.contains('is-open') && !toolbarEl.contains(e.target as Node)) closeMenu(); };
  document.addEventListener('pointerdown', onDocPointer);

  // CSV import/export - the buttons live inside the Sessions dialog (wired in
  // drawSessions); the file input stays here so the OS picker survives the
  // dialog closing. Importing replaces the grid, so close the dialog after.
  const fileInput = viewEl.querySelector<HTMLInputElement>('#pro-csv-file')!;
  fileInput.addEventListener('change', () => {
    importCsvFile(fileInput.files?.[0]).then(() => closeSessions()).catch(err => reportFatal(err)).finally(() => { fileInput.value = ''; });
  });

  // ── Preview, CSV, paste ─────────────────────────────────────────────────────
  async function openPreview(uid: string) {
    const row = rowByUid(uid);
    if (!row?.toolId) return;
    let tool: any;
    try { tool = await getTool(row.toolId); } catch { return; }
    // Build a model from the row's values and hand it to the engine's canonical
    // URL serializer, so the deep link matches what the single-tool view expects.
    const model = (tool.manifest.inputs ?? []).map((i: any) => ({ ...i, value: row.values[i.id] ?? i.default }));
    // keepUserIds: a same-device preview link - a user/ upload resolves here.
    const qs = serializeUrlState(model, { format: row.format || state.format, keepUserIds: true });
    // Carry per-row export dimensions (reserved w/h params), and `full` so the
    // single-tool view hides its sidebar - a clean preview. The preview canvas
    // is on-screen px, so physical units are shown at their CSS-px (96dpi) size.
    const u = row.unit ?? state.unit;
    const toPreviewPx = (v: number) => Math.round(u === 'px' ? v : toCssPx({ value: v, unit: u as Unit }));
    let dims = '';
    if (row.outWidth) dims += `&w=${toPreviewPx(row.outWidth)}`;
    if (row.outHeight) dims += `&h=${toPreviewPx(row.outHeight)}`;
    const url = `${location.origin}${location.pathname}#/tool/${encodeURIComponent(row.toolId)}?${qs ? `${qs}&` : ''}full${dims}`;

    // Open a real popup window (sized) rather than a tab, reused per row by name.
    const w = Math.min(1280, screen.availWidth - 40);
    const h = Math.min(900, screen.availHeight - 40);
    const left = Math.max(0, ((screen as any).availLeft ?? 0) + (screen.availWidth - w) / 2);
    const top = Math.max(0, ((screen as any).availTop ?? 0) + (screen.availHeight - h) / 2);
    window.open(url, `ct-preview-${uid}`, `popup=yes,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(left)},top=${Math.round(top)}`);
  }

  function exportCsv() {
    const usable = state.rows.filter(r => r.toolId && r.manifest);
    if (!usable.length) { showProgress(`<p class="pro-progress-msg">Pick at least one template before exporting.</p>`); return; }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    void saveBlob(new Blob([batchToCsv(state.rows, { unit: state.unit, dpi: state.dpi })], { type: 'text/csv' }), `lolly-batch-${stamp}.csv`);
  }

  async function importCsvFile(file: File | undefined) {
    if (!file) return;
    let text;
    try { text = await file.text(); }
    catch { showProgress(`<p class="pro-progress-msg pro-log-err">Couldn't read that file.</p>`); return; }
    const { rows, errors } = await csvToBatch(text, { getTool, makeRow: newRow });
    if (!rows.length) {
      showProgress(`<p class="pro-progress-msg pro-log-err">${escape(errors[0] || 'No rows found in the file.')}</p>`);
      return;
    }
    state.rows = rows;
    state.collapsed.clear();
    columns = renderGrid();
    nav.focusActive();
    const ok = rows.filter((r: any) => r.toolId).length;
    showProgress(`<p class="pro-progress-msg">Loaded ${ok} row${ok === 1 ? '' : 's'} from CSV.${
      errors.length ? ` <span class="pro-log-err">${errors.length} issue${errors.length === 1 ? '' : 's'}.</span>` : ''
    }</p>${errors.length ? `<ol class="pro-log">${errors.map((e: any) => `<li class="pro-log-err">${escape(e)}</li>`).join('')}</ol>` : ''}`);
  }

  // Fill values from a pasted spreadsheet range, anchored at the focused cell.
  // Only writes into rows that already have a template (use Upload CSV to set
  // templates too); cells the tool doesn't have are skipped.
  // A pasted attendee list is usually taller than the grid: grow to fit, cloning
  // the anchor row's template + settings into the new rows (the same copy
  // fillEmptyFromLast makes) - a row with no manifest would silently drop its
  // slice of the paste. Shared by the anchor fill and the mapped fill.
  function growRowsForPaste(startRowIdx: number, rowCount: number): void {
    const anchor = state.rows[startRowIdx];
    const shortfall = startRowIdx + rowCount - state.rows.length;
    if (shortfall <= 0 || !anchor?.toolId) return;
    for (const row of addRows(shortfall)) {
      row.toolId = anchor.toolId;
      row.manifest = anchor.manifest;
      row.values = structuredClone(anchor.values ?? {});
      row.format = anchor.format;
      row.outWidth = anchor.outWidth;
      row.outHeight = anchor.outHeight;
      row.unit = anchor.unit;
      row.dpi = anchor.dpi;
    }
  }

  // plans/140 S3: routes a grid paste by COLUMN IDS instead of contiguous
  // position - the header route and the fixed-column route both land here.
  // Unhides every target column, grows the grid, coerces per input, re-renders.
  function applyMappedPaste(startUid: string | undefined, dataRows: string[][], colIds: (string | null)[]): void {
    const startRowIdx = state.rows.findIndex(r => r.uid === startUid);
    if (startRowIdx < 0) return;
    for (const id of colIds) if (id) state.collapsed.delete(id);
    growRowsForPaste(startRowIdx, dataRows.length);
    let filled = 0;
    for (let r = 0; r < dataRows.length; r++) {
      const row = state.rows[startRowIdx + r];
      if (!row || !row.manifest) continue;
      const byId = new Map((row.manifest.inputs ?? []).map((i: any) => [i.id, i]));
      for (let c = 0; c < dataRows[r]!.length; c++) {
        const id = colIds[c];
        const input = id ? byId.get(id) : undefined;
        if (!input) continue;
        const v = coerceCell(input as Parameters<typeof coerceCell>[0], dataRows[r]![c]!);
        if (v !== undefined) { row.values[id!] = v; filled++; }
      }
    }
    columns = renderGrid();
    if (filled) showProgress(`<p class="pro-progress-msg">Pasted ${filled} value${filled === 1 ? '' : 's'} from the clipboard.</p>`);
  }

  // plans/140 S3: an attendee list must never misfile into Save-as/size cells.
  // Two routes run ahead of the anchor-strict fill:
  //   1. HEADER: row 0's cells name this tool's inputs (by label or id,
  //      case-insensitive, no duplicates) - map by name, drop the header row,
  //      show any hidden target columns. No confirmation: the names were the
  //      user's own.
  //   2. FIXED-COLUMN ANCHOR: a multi-column paste aimed at Template/Save
  //      as/size maps positionally onto the tool's input columns after ONE
  //      confirmation naming the mapping - instead of writing names into
  //      Save-as and Width.
  // A headerless paste anchored in a real input column keeps the spreadsheet
  // convention untouched (fill right/down from the anchor).
  const PASTE_FIXED_COLS = ['__template', '__filename', '__width', '__height', '__unit', '__dpi'];
  function routeMappedPaste(td: HTMLElement, grid: string[][]): boolean {
    const row = rowByUid(td.dataset.row);
    if (!row || !row.manifest) return false;
    const inputs = (row.manifest.inputs ?? []) as { id: string; label?: string }[];
    const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
    const byName = new Map<string, string>();
    for (const i of inputs) { byName.set(norm(i.id), i.id); if (i.label) byName.set(norm(i.label), i.id); }

    const head = grid[0] ?? [];
    const matched = head.map(h => byName.get(norm(h)) ?? null);
    const hits = matched.filter(Boolean);
    if (grid.length > 1 && hits.length >= Math.max(1, Math.ceil(head.length / 2)) && hits.length === new Set(hits).size) {
      applyMappedPaste(td.dataset.row, grid.slice(1), matched);
      srAnnounce(`Mapped ${hits.length} column${hits.length === 1 ? '' : 's'} by header`);
      return true;
    }

    if (!PASTE_FIXED_COLS.includes(td.dataset.col ?? '') || (grid[0]?.length ?? 0) < 2) return false;
    const cols = deriveColumns([row as Parameters<typeof deriveColumns>[0][number]]);
    if (!cols.length) return false;
    void (async () => {
      const ids = await askColumnMapping(cols, grid, inputs);
      if (ids) applyMappedPaste(td.dataset.row, grid, ids);
    })();
    return true;
  }

  // The S3 mapping dialog: one select per pasted column, prefilled with the
  // grid's VISIBLE input columns in order, then the tool's text-family inputs
  // (an attendee list is names, not the Badge-size select that happens to be
  // declared first). The first data row rides each select's label as a sample,
  // so "Ana" sits beside the control choosing its column.
  async function askColumnMapping(
    cols: { key: string; label: string }[],
    grid: string[][],
    inputs: { id: string; label?: string; type?: string }[],
  ): Promise<(string | null)[] | null> {
    const n = grid[0]!.length;
    // Free-text inputs only: a pasted list is names and labels, not the number
    // and date controls a tool declares between them.
    const textish = new Set(['text', 'longtext', 'url']);
    const typeOf = new Map(inputs.map(i => [i.id, i.type ?? '']));
    const preferred = [
      ...cols.filter(c => !state.collapsed.has(c.key)),
      ...cols.filter(c => state.collapsed.has(c.key) && textish.has(typeOf.get(c.key) ?? '')),
      ...cols.filter(c => state.collapsed.has(c.key) && !textish.has(typeOf.get(c.key) ?? '')),
    ];
    const rowsWord = `${grid.length} row${grid.length === 1 ? '' : 's'}`;
    const selects = Array.from({ length: n }, (_, i) => {
      const pre = preferred[i]?.key ?? '';
      const sample = String(grid[0]![i] ?? '').slice(0, 24);
      return `<label class="pro-map-row" style="display:flex;align-items:center;gap:10px;justify-content:space-between">
        <span class="pro-map-sample" style="font-family:var(--font-mono);font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:12ch">${escape(sample || `column ${i + 1}`)}</span>
        <select class="field-select" data-map-col="${i}" aria-label="${escape(t('Input for pasted column'))} ${i + 1}" style="max-width:60%">
          <option value="">${escape(t('Skip'))}</option>
          ${cols.map(c => `<option value="${escape(c.key)}"${c.key === pre ? ' selected' : ''}>${escape(c.label)}</option>`).join('')}
        </select>
      </label>`;
    }).join('');
    return new Promise((resolve) => {
      const content = `
        <h2 class="modal-title">${escape(t('Map pasted columns?'))}</h2>
        <p class="modal-msg">${escape(t('The cell you pasted into holds export settings, so choose which input each pasted column fills.'))} (${escape(rowsWord)})</p>
        <div class="pro-map-rows" style="display:flex;flex-direction:column;gap:8px;margin:12px 0">${selects}</div>
        <div class="modal-actions">
          <button type="button" class="btn modal-cancel" data-act="cancel">${escape(t('Cancel'))}</button>
          <button type="button" class="btn modal-primary" data-act="ok">${escape(t('Paste'))}</button>
        </div>`;
      const modal = mountModal<(string | null)[] | null>(content, {
        className: 'modal',
        cancelValue: null,
        initialFocus: (el) => el.querySelector<HTMLElement>('select[data-map-col]'),
        onClose: (result) => resolve(result ?? null),
      });
      modal.el.addEventListener('click', (e) => {
        const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
        if (act === 'ok') {
          const picks = Array.from({ length: n }, (_, i) =>
            modal.el.querySelector<HTMLSelectElement>(`select[data-map-col="${i}"]`)?.value || null);
          modal.close(picks);
        } else if (act === 'cancel') modal.close(null);
      });
    });
  }

  function pasteFill(startUid: string | undefined, startColKey: string | undefined, grid: any) {
    // Column order must match the rendered grid so paste anchors correctly.
    const flatCols = ['__template', '__filename', '__width', '__height', '__unit', '__dpi', ...columns.map((c: any) => c.key)];
    const startRowIdx = state.rows.findIndex(r => r.uid === startUid);
    const startColIdx = Math.max(0, flatCols.indexOf(startColKey));
    if (startRowIdx < 0) return;

    growRowsForPaste(startRowIdx, grid.length);

    let filled = 0;
    for (let r = 0; r < grid.length; r++) {
      const row = state.rows[startRowIdx + r];
      if (!row || !row.manifest) continue;
      const byId = new Map((row.manifest.inputs ?? []).map((i: any) => [i.id, i]));
      for (let c = 0; c < grid[r].length; c++) {
        const colKey = flatCols[startColIdx + c];
        const raw = grid[r][c];
        if (!colKey || colKey === '__template') continue; // templates set via CSV upload
        if (colKey === '__filename') { row.filename = raw; filled++; continue; }
        if (colKey === '__width')  { row.outWidth  = parseFloat(raw) || undefined; filled++; continue; }
        if (colKey === '__height') { row.outHeight = parseFloat(raw) || undefined; filled++; continue; }
        if (colKey === '__unit')   { const u = String(raw).trim().toLowerCase(); if (UNIT_OPTIONS.includes(u)) { row.unit = u; filled++; } continue; }
        if (colKey === '__dpi')    { row.dpi = parseInt(raw, 10) || undefined; filled++; continue; }
        const input = byId.get(colKey);
        if (!input) continue;
        const v = coerceCell(input as Parameters<typeof coerceCell>[0], raw);
        if (v !== undefined) { row.values[colKey] = v; filled++; }
      }
    }
    columns = renderGrid();
    if (filled) showProgress(`<p class="pro-progress-msg">Pasted ${filled} value${filled === 1 ? '' : 's'} from the clipboard.</p>`);
  }

  // ── Batch run + delivery ────────────────────────────────────────────────────
  async function runBatchFlow() {
    if (state.running || kitPanel?.isBusy()) return;
    const kitErrors = await kitPanel?.validate() ?? [];
    if (kitErrors.length) { showProgress(`<p role="alert">${kitErrors.map(escape).join(' ')}</p>`); return; }
    // `state.running` only knows about runs THIS grid started. A retry launched from the
    // previous run's overlay is a second run that this flag never saw, and two runs
    // sharing the offscreen stage and the same progress mount is the failure mode the
    // overlay's lock exists for - so ask the overlay too, not just ourselves.
    if (isBatchRunActive()) {
      showProgress(`<p class="pro-progress-msg">${escape(t('An export is still running. Start this one when it finishes.'))}</p>`);
      return;
    }
    closeBulkPopover();

    // `srcIndex` maps each renderable row back to its position in state.rows - which IS
    // the grid's visible numbering, so it is the only thing that lets the overlay and the
    // zip manifest say "row 7" and mean the row the user is looking at. planBatch
    // compacts; nothing may re-filter `renderable` between here and the run.
    // The pre-pass. STATIC ONLY: it never mounts, renders or exports - it maps each
    // row to a PreflightJob and runs the engine's rules over it, so the user is told
    // what is wrong with row 7 BEFORE 200 rows render. The run-level settings handed
    // in are the same four the run itself is given below, which is what makes the
    // findings about the settings the render will actually use.
    const { check, runFindings } = await createBatchRowCheck(state.rows, host, {
      format: state.format, unit: state.unit, dpi: state.dpi,
      profile: state.profile || undefined,
      bleed: state.bleed || undefined,
      marks: state.marks || undefined,
    });
    const plan = await planBatch<Finding>(state.rows, { check });
    const { renderable, skipped, srcIndex, findings } = plan;
    if (renderable.length === 0) {
      showProgress(`<p class="pro-progress-msg">Nothing to render - pick at least one exportable template.</p>`);
      return;
    }

    // Ask before committing to the render (a batch can be large) and always offer the
    // whole-download lock + optional AES-256 password - it protects EVERY member (incl.
    // image-only batches) and R6-locks any PDFs inside. Blank password = no lock; cancel aborts.
    // When every row resolves to PDF, also offer the single-document delivery
    // (plans/140 S5) - one merged PDF, one row's pages after another.
    const allPdf = renderable.length > 1 &&
      renderable.every(r => { const f = (r as { format?: string }).format || state.format; return f === 'pdf' || f === 'pdf-cmyk'; });
    const { ok, strongPassword, zipLock, combinePdf } = await askExportLock(`${renderable.length} file${renderable.length === 1 ? '' : 's'}`, true, { offerCombine: allPdf });
    if (!ok) return;                          // cancelled

    // Author details ride into the zip manifest only when the user has opted in
    // (Profile → "Use my details"); otherwise the [ Author Information ] block is
    // dropped. The CSV is the exact settings that produced these files - 
    // re-importable to reproduce or tweak the run (Sessions ▸ Upload CSV).
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const zipBase = state.zipName.trim().replace(/\.zip$/i, '') || `lolly-batch-${stamp}`;
    const profile = await host.profile?.get?.().catch(() => null);
    const author = profile?.useDetails ? profile : null;
    const csv = batchToCsv(renderable as unknown as Parameters<typeof batchToCsv>[0], { unit: state.unit, dpi: state.dpi });

    // The run is a WP-F background job (lib/batch-job.ts): it survives navigating away
    // from the grid, the global toast owns its progress and cancel, and the run lock it
    // holds is released by the JOB ending - not by this view's `_cleanup`, which used to
    // leave the lock stuck on and refuse every later run with no way to clear it.
    startBatchExport(tRaw('Rendering {n} files', { n: renderable.length }), async (job) => {
      // The grid is disabled from the moment the run's TURN comes, not from the moment
      // it is queued: a job cancelled while still waiting behind another one never calls
      // this back, and a `running` flag set outside it would strand the grid disabled.
      state.running = true;
      state.cancelRequested = false;
      renderGrid();
      try {
        return await runBatchWithProgress(host, renderable, {
          job,
          mount: progressEl,
          format: state.format,
          // Toolbar defaults; each row may override via its own unit/dpi (batch.js).
          unit: state.unit,
          dpi: state.dpi,
          // Run-level print settings, same precedence: a row carrying its own bleed /
          // marks / press profile keeps it (batch.ts resolvePrintSettings). Passed
          // unconditionally because runBatch GATES them on each row's resolved format
          // (batch.ts printSettingsFor) - the Print button hides when the format leaves
          // print but deliberately does not clear these, and an ungated merge signed a
          // C2PA claim about bleed and marks onto rasters that rendered neither.
          profile: state.profile || undefined,
          bleed: state.bleed || undefined,
          marks: state.marks || undefined,
          zipBaseName: zipBase,
          srcIndex,
          // Per-row preflight findings, keyed by queue position. Skipped rows have no
          // queue position, so theirs travel by identity in `skippedFindings`, and the
          // run-invariant ones ride `runFindings` - three channels, none of them able to
          // stand in for another.
          notes: notesFromFindings(findings, renderable.length),
          skippedFindings: skippedFindings(plan),
          runFindings,
          author,
          csv,
          skipped,
          // Re-enable the grid as soon as the renders finish, before the zip builds.
          onRendered: () => { state.running = false; renderGrid(); },
          onBatchRendered: opts.onBatchRendered,
          announce: srAnnounce,
          strongPassword, zipLock, combinePdf,
        });
      } catch (err) {
        // The grid's own recovery still runs (clear `running`, say what happened in the
        // docked panel); rethrowing hands the SAME failure to the job, which is the only
        // surface left once this view is gone.
        reportFatal(err);
        throw err;
      }
    });
  }

  function showProgress(html: string) { progressEl.hidden = false; progressEl.innerHTML = html; }

  // Screen-reader announcer for batch milestones (start / done / cancelled).
  // Per-row progress is intentionally NOT announced - it would be far too chatty.
  // A local live region (not the shared a11y helper) keeps /pro's import isolation.
  let _srEl: HTMLDivElement | null = null;
  function srAnnounce(msg: string) {
    if (!_srEl) {
      _srEl = document.createElement('div');
      _srEl.className = 'visually-hidden';
      _srEl.setAttribute('aria-live', 'polite');
      _srEl.setAttribute('aria-atomic', 'true');
      viewEl.appendChild(_srEl);
    }
    _srEl.textContent = '';
    requestAnimationFrame(() => { _srEl!.textContent = msg; });
  }
  function reportFatal(err: any) {
    state.running = false;
    renderGrid();
    showProgress(`<p class="pro-progress-msg pro-log-err">Batch failed: ${escape(String(err.message ?? err))}</p>`);
  }

  // ── Cleanup (called by the router on navigation away) ───────────────────────
  kitPanel = mountKitPanel(viewEl, host, state, { newRow, changed: () => { zipNameInput.value = state.zipName; columns = renderGrid(); }, save: () => sessionsBtn.click() });
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => { kitPanel?.dispose(); detachLangMenu(); closeBulkPopover(); closeSessions(); closePrintPopover(); closeTemplatePicker(); closeBlocksPanel(); nav.destroy(); detachResize(); detachReorder(); detachScrub(); zipRO.disconnect(); zoomHud.destroy(); narrowMq.removeEventListener('change', placeFormat); narrowMq.removeEventListener('change', sizeZip); document.removeEventListener('pointerdown', onDocPointer); document.removeEventListener('keydown', onAddRowKey, true); };

  // Deep link, in precedence order:
  //  · a Projects "Edit as sheet" selection (#/pro?s=slot,slot…) → one row per
  //    selected item, opened verbatim (rowsFromRefs keeps non-tool items as
  //    tool-less rows);
  //  · a saved batch session (#/pro?session=…), e.g. resuming from the gallery's
  //    Saved-sessions list;
  //  · a "Bulk from rows" tool (#/batch?tool=<id>), which ADDS to either of the
  //    above rather than replacing it (see below);
  //  · otherwise drop straight into the first (blank) row's template search, ready
  //    to type - now that the grid's click + focusin handlers are wired.
  if (opts.seedRefs?.length) {
    const rows = await rowsFromRefs(host, opts.seedRefs);
    if (rows.length) {
      await applySnapshot({ rows });
      showProgress(`<p class="pro-progress-msg">Opened ${rows.length} row${rows.length === 1 ? '' : 's'} from your selection.</p>`);
    } else {
      showProgress(`<p class="pro-progress-msg pro-log-err">Nothing to open as a sheet from that selection.</p>`);
    }
  } else if (opts.sessionSlot) {
    const data = await sessions.load(opts.sessionSlot);
    if (data) await applySnapshot(data);
    else showProgress(`<p class="pro-progress-msg pro-log-err">That batch session could not be found.</p>`);
  }
  // …and last, a "Bulk from rows" deep link (#/batch?tool=<id>). It fills the first
  // EMPTY row - appending one when the grid above already used them all - so it adds
  // a template to whatever the two branches opened rather than replacing it. An
  // unknown id (a hand-typed link, or a tool this shell can't run) seeds nothing and
  // falls back to the template search.
  const seededTool = opts.seedToolId ? await seedTool(opts.seedToolId) : false;
  if (!seededTool && !opts.seedRefs?.length && !opts.sessionSlot) openFirstTemplateSearch();

  // Capture the initial grid as the clean baseline for the unsaved-changes guard
  // (covers blank start, a found deep-linked session, and the not-found case).
  markClean();

  async function seedTool(id: string): Promise<boolean> {
    const tool = ctx.toolById.get(id);
    if (!tool) return false;
    let row = state.rows.find(r => !r.toolId);
    if (!row) { row = newRow(); state.rows.push(row); columns = renderGrid(); }
    await selectTemplate(row.uid, tool.name);
    return !!row.toolId;
  }

  function openFirstTemplateSearch() {
    const td = gridHost.querySelector<HTMLElement>('td[data-col="__template"]');
    const row = td && rowByUid(td.dataset.row);
    if (td && row && !row.toolId) { td.focus(); openTemplatePicker(td, row); }
  }
}


// Unsaved-changes guard for leaving /pro. Reuses the shared `.unsaved-dialog`
// styling (app.css) and the shared mountModal lifecycle (components/modal.ts)
// - Escape and a backdrop click now dismiss like every other app dialog (the
// hand-rolled version only wired the three buttons + a bare Escape-remove).
// Mirrors the single-tool dialog in views/tool.js but stays in the pro module
// so the whole feature remains removable in one folder.
function showSaveSessionDialog({ onSave, onLeave }: { onSave: () => void; onLeave: () => void }) {
  const content = `
    <div class="unsaved-dialog-body">
      <h2>Unsaved batch</h2>
      <p>You've made changes to this batch.<br>Save it as a session before leaving?</p>
      <div class="unsaved-dialog-actions">
        <button type="button" class="unsaved-save" data-act="save">Save &amp; leave…</button>
        <button type="button" class="unsaved-leave" data-act="leave">Leave without saving</button>
        <button type="button" class="unsaved-cancel" data-act="cancel">Cancel</button>
      </div>
    </div>
  `;
  const modal = mountModal<'save' | 'leave' | undefined>(content, {
    className: 'unsaved-dialog',
    onClose: (result) => { if (result === 'save') onSave(); else if (result === 'leave') onLeave(); },
  });
  modal.el.addEventListener('click', (e) => {
    const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
    if (act === 'save') modal.close('save');
    else if (act === 'leave') modal.close('leave');
    else if (act === 'cancel') modal.close(undefined);
  });
}
