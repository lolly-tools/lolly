// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — view entry point and orchestrator.
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
import { serializeUrlState, toCssPx, isUnit } from '@lolly/engine';

import { deriveColumns, cellInput, bulkTargets } from './model.ts';
import { renderGridHtml, bodyRow } from './grid.ts';
import { createGridNav } from './grid-nav.ts';
import { attachResize, isOnResizeEdge } from './resize.ts';
import { attachReorder } from './reorder.ts';
import { attachScrub } from './scrub.ts';
import { controlHtml, readControlValue } from './controls.ts';
import { openBlocksEditor, closeBlocksPanel } from './blocks-editor.ts';
import { colorFieldHtml, wireColorField, type ColorFieldValue } from '../components/color-field.ts';
import { getTool, renderRowToBlob, isExportable } from './render-export.ts';
import { parseClipboardGrid } from './io.ts';
import { createSessionStore, rowsFromSnapshot, snapshotFromState } from './sessions.ts';
import { setupToolbar } from './toolbar.ts';
import { createCsvIo, UNIT_OPTIONS } from './csv-io.ts';
import { createBatchRun } from './batch-run.ts';
import { createSessionsView } from './sessions-view.ts';
import { createFolderActions, type OpenFolderOverlay } from './folder-actions.ts';
import type { GridRow, GridCtx } from './grid.ts';
import type { Column } from './model.ts';
import type { BatchFile } from './batch.ts';
import type { SnapshotRow } from './sessions.ts';
import type { Unit, InputValue, ToolManifest, InputSpec, HostV1, AssetRef } from '@lolly/engine';

/** The host surface /pro needs: HostV1 plus the web state store's size query. */
interface ProHost extends HostV1 {
  state: HostV1['state'] & { sizes(): Promise<Record<string, number>> };
}

/** A catalog-index tool entry as /pro reads it (window.__toolIndex). */
interface IndexedTool {
  id: string;
  name: string;
  status?: string;
  exportable?: boolean;
  capabilities?: readonly string[];
}

/** Options the shell injects when mounting /pro (lazy route in main.js). */
interface ProMountOpts {
  sessionSlot?: string;
  onBatchRendered?: (files: BatchFile[]) => void;
  openFolderOverlay?: OpenFolderOverlay;
}

/** Input to applySnapshot: a saved batch snapshot or a flattened folder's rows.
 *  All view-state fields are optional — a folder flatten supplies only rows+zipName. */
interface ApplySnapshotInput {
  rows?: readonly SnapshotRow[];
  format?: string;
  unit?: string;
  dpi?: number;
  zipName?: string;
  collapsed?: readonly string[];
  colWidths?: Record<string, number>;
}

/** The live batch model + view state (index owns this; the seams take slices). */
interface BatchState {
  rows: GridRow[];
  format: string;
  unit: Unit;
  dpi: number;
  running: boolean;
  cancelRequested: boolean;
  collapsed: Set<string>;
  colWidths: Record<string, number>;
  zipName: string;
}

const FORMAT_OPTIONS = ['png', 'jpg', 'svg', 'emf', 'eps', 'pdf', 'webp'];

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
  const have = host.capabilities;
  if (!Array.isArray(have)) return true;
  return need.every(c => have.some(h => h === c));
}

let _uidSeq = 0;
const newRow = (): GridRow => ({ uid: `r${++_uidSeq}`, toolId: '', manifest: null, values: {} });
// Start with a single blank row, template search ready — the user grows the
// batch with the "=" shortcut (or + Row), which keeps each new row's flow fast.
const DEFAULT_ROWS = 1;
const blankRows = (): GridRow[] => Array.from({ length: DEFAULT_ROWS }, newRow);
/** Narrow a control/stored value to a known Unit (the toolbar/grid only ever emit valid ones). */
const asUnit = (v: unknown): Unit | undefined => (typeof v === 'string' && isUnit(v) ? v : undefined);

/** One row of a repeating "blocks" field (mirrors blocks-editor's BlockRecord). */
type BlockRecord = Record<string, InputValue | undefined>;

// ── Boundary narrowers for untrusted input-spec/model values ──────────────────
const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const asStringArray = (v: unknown): string[] | undefined =>
  (Array.isArray(v) && v.every(x => typeof x === 'string') ? v : undefined);
const ASSET_TYPES = ['vector', 'raster', 'video', 'palette', 'font'] as const;
type AssetType = typeof ASSET_TYPES[number];
/** Narrow a tool's declared assetType to the picker's known set ('any' ⇒ unfiltered). */
const asAssetType = (v: string | undefined): AssetType | undefined =>
  (v && v !== 'any' ? ASSET_TYPES.find(t => t === v) : undefined);
/** Read the id off a stored asset-typed value (asset cells hold an AssetRef). */
const readAssetId = (v: InputValue | undefined): string | undefined =>
  (v && typeof v === 'object' && 'id' in v && typeof v.id === 'string' ? v.id : undefined);

export async function mountPro(viewEl: HTMLElement, host: ProHost, opts: ProMountOpts = {}): Promise<void> {
  document.title = 'Batch — Lolly';

  const assetPicker = typeof host.assets?.pick === 'function';
  const w: Window & { __toolIndex?: { tools?: IndexedTool[] } } = window;
  const tools = [...(w.__toolIndex?.tools ?? [])]
    // Batch renders data → asset, so hide render-only / on-device utilities: they
    // export themselves via their own exportFile flow, never the batch path, and
    // would only ever be skipped at run time. (`!== false` fails open if an older
    // cached index predates the `exportable` flag — see build-catalog-index.js.)
    .filter(t => t.exportable !== false)
    .filter(t => shellCanRun(t, host))
    .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  const toolByName = new Map(tools.map(t => [t.name, t]));

  const state: BatchState = {
    rows: blankRows(),
    format: 'png',
    unit: 'px',                   // unit for the Width/Height columns (px/mm/cm/in/pt)
    dpi: 300,                     // raster resolution for physical units (print default)
    running: false,
    cancelRequested: false,
    collapsed: new Set<string>(), // column keys hidden from the matrix (restorable via tags)
    colWidths: {},                // key → px width (drag to widen); narrow defaults otherwise
    zipName: '',                  // optional name for the delivered zip
  };
  const ctx: GridCtx = { tools, assetPicker, unit: state.unit, dpi: state.dpi };
  // Personalise the empty-grid welcome when the user has a saved profile name
  // (Profile → First name). Fetched once at mount; the hint only shows before a
  // tool is picked, so a mid-session profile edit needn't re-render it.
  const meProfile = await host.profile?.get?.().catch(() => null);
  ctx.firstname = (meProfile?.firstname ?? '').trim();

  // ── Static shell ───────────────────────────────────────────────────────────
  viewEl.innerHTML = `
    <div class="pro-wrap">
      <a href="#/" class="tools-home home-full">Tools</a>

      <div class="pro-toolbar">
        <button type="button" class="pro-btn pro-hamburger" id="pro-menu" aria-label="Toolbar menu" aria-expanded="false" aria-controls="pro-toolbar-group">☰</button>
        <div class="pro-toolbar-group" id="pro-toolbar-group">
          <label class="pro-format pro-zip" title="Name for the downloaded .zip">
            <input type="text" id="pro-zip-name" placeholder="lolly-batch" autocomplete="off" spellcheck="false">
            <span class="pro-zip-ext" aria-hidden="true">.zip</span>
          </label>
          <!-- + Row / +5 live at the bottom-left of the grid, where you use them.
               CSV download/upload live inside the Sessions dialog. -->
          <input type="file" id="pro-csv-file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden>
        </div>
        <span class="pro-spacer"></span>
        <div class="pro-zoom" role="group" aria-label="Zoom interface">
          <button type="button" class="pro-btn pro-zoom-btn" id="pro-zoom-out" title="Zoom out — shrink the whole interface" aria-label="Zoom out">−</button>
          <button type="button" class="pro-btn pro-zoom-btn" id="pro-zoom-in" title="Zoom in — enlarge the whole interface" aria-label="Zoom in">+</button>
        </div>
        <label class="pro-format pro-unit-field" id="pro-unit-field" title="Units for the Width & Height columns">
          <select id="pro-unit">${UNIT_OPTIONS.map(u => `<option value="${u}"${u === state.unit ? ' selected' : ''}>${u}</option>`).join('')}</select>
        </label>
        <label class="pro-format pro-dpi-field" id="pro-dpi-field" title="Raster resolution for physical units (mm/cm/in/pt). Ignored for px and for vector formats.">
          <input type="number" id="pro-dpi" min="36" max="1200" step="1" value="${state.dpi}"${state.unit === 'px' ? ' disabled' : ''}>
          <span class="pro-dpi-suffix" aria-hidden="true">dpi</span>
        </label>
        <label class="pro-format" id="pro-format-field" title="Output format for all rows (rows can override)">
          <select id="pro-format">${FORMAT_OPTIONS.map(f => `<option value="${f}"${f === state.format ? ' selected' : ''}>${f.toUpperCase()}</option>`).join('')}</select>
        </label>
        <button type="button" class="pro-btn" id="pro-sessions" title="Save or load a snapshot of this whole batch">⛁ Sessions</button>
        <button type="button" class="pro-btn pro-btn--primary" id="pro-render" title="Render the batch">Render</button>
      </div>

      <div id="pro-grid-host"></div>

      <div class="pro-progress" id="pro-progress" hidden></div>
    </div>
  `;

  // These elements were all just written into viewEl.innerHTML above, so the
  // non-null assertion is safe (per the codebase's own-innerHTML convention).
  const gridHost = viewEl.querySelector<HTMLElement>('#pro-grid-host')!;
  const progressEl = viewEl.querySelector<HTMLElement>('#pro-progress')!;
  const renderBtn = viewEl.querySelector<HTMLButtonElement>('#pro-render')!;
  const formatSel = viewEl.querySelector<HTMLSelectElement>('#pro-format')!;
  const unitSel = viewEl.querySelector<HTMLSelectElement>('#pro-unit')!;
  const dpiInput = viewEl.querySelector<HTMLInputElement>('#pro-dpi')!;
  const zipNameInput = viewEl.querySelector<HTMLInputElement>('#pro-zip-name')!;

  // Toolbar chrome (responsive reparenting, zip-name sizing, UI zoom, hamburger)
  // lives in toolbar.ts; index keeps the batch model. sizeZip is re-called here
  // after programmatic zip-name writes (applySnapshot / zip input handler).
  const sessionsBtn = viewEl.querySelector<HTMLElement>('#pro-sessions')!; // leave-guard reopens Sessions here
  const { sizeZip, detach: detachToolbar } = setupToolbar(viewEl);

  // Saved batch sessions (snapshot the whole grid; persisted via host.state).
  const sessions = createSessionStore(host);

  // Dirty tracking: compare a canonical snapshot of the batch against the
  // baseline captured at load / last save. snapshotFromState already drops
  // transient bits (uid, manifest), so a serialise-compare is robust; it errs
  // toward false-positives, the safe direction for a "save before leaving?" guard.
  const serialize = () => JSON.stringify(snapshotFromState(state));
  let baseline: string | null = null;        // set once the initial grid is in place
  const isDirty = () => baseline !== null && serialize() !== baseline;
  const markClean = () => { baseline = serialize(); };

  // Leaving /pro via the "← Tools" link. The link stays a normal hash anchor
  // (shared pill styling with profile/full-screen tools); we just intercept the
  // click when the batch is dirty and offer to save it as a session first.
  const goHome = () => { location.hash = '#/'; };
  viewEl.querySelector('.tools-home')?.addEventListener('click', (e) => {
    // Only guard when there's unsaved, saveable work: a session needs at least
    // one template row (doSave enforces it), so prompting otherwise would offer a
    // "save" that can't succeed. Clean / empty → let the anchor navigate.
    if (!isDirty() || !state.rows.some(r => r.toolId)) return;
    e.preventDefault();
    showSaveSessionDialog({
      // Open the Sessions popover, then arm the one-shot "leave after saving"
      // intent — openSessions() runs closeSessions() synchronously (which clears
      // the flag), so it must be set *after* the call. doSave consumes it; an
      // abandoned popover clears it via closeSessions, so a later normal save
      // won't navigate.
      onSave: () => { sessionsView.openSessions(sessionsBtn); sessionsView.armLeaveAfterSave(); },
      onLeave: goHome,
    });
  });

  // Spreadsheet keyboard navigation (roving focus + focused/editing states).
  const nav = createGridNav(gridHost);

  // ── Delete-row confirm (two-step) ───────────────────────────────────────────
  // A row's ✕ arms on first click and confirms on the second; declared before the
  // first renderGrid() (which clears any pending arm) so there's no TDZ on call.
  let _armedRemove: HTMLElement | null = null;
  let _armTimer: ReturnType<typeof setTimeout> | 0 = 0;
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
  const colorOnChange = (id: string, value: ColorFieldValue): void => {
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
    // Collapsed columns are hidden from the matrix but keep their data — they're
    // shown as restorable tags below the grid. Visible columns drive everything.
    const visible = all.filter(c => !state.collapsed.has(c.key));
    const hidden = all.filter(c => state.collapsed.has(c.key));
    gridHost.innerHTML = renderGridHtml(state, visible, ctx, hidden);
    // Wire the shared SUSE colour picker for any colour cells (id is "row~col").
    wireColorField(gridHost, { onChange: colorOnChange });
    const filled = state.rows.filter(r => r.toolId).length;
    renderBtn.disabled = filled === 0 || state.running; // count text now lives in the columns bar
    nav.refresh({ restoreFocus: hadFocus });
    const nextScroll = gridHost.querySelector('.pro-grid-scroll');
    if (nextScroll) { nextScroll.scrollLeft = scrollX; nextScroll.scrollTop = scrollY; }
    highlightRelevantTags(); // outline the hidden tags the active row actually uses
    return visible;
  }

  // Swap a single row's <tr> in place. A per-row format/unit change touches only
  // that row (the column set is derived from the chosen tools, which don't
  // change), so a full renderGrid() — with its scroll capture/restore and total
  // re-wire — is wasted work. Re-wires just this row's colour fields and asks nav
  // to re-find the active cell inside the fresh <tr>. Falls back to a full render
  // if the row's gone.
  function replaceRow(uid: string) {
    const row = rowByUid(uid);
    const tr = gridHost.querySelector(`tbody tr[data-row="${CSS.escape(uid)}"]`);
    if (!row || !tr) { columns = renderGrid(); return; }
    const hadFocus = gridHost.contains(document.activeElement);
    const tmp = document.createElement('template');
    tmp.innerHTML = bodyRow(row, columns, ctx);
    const next = tmp.content.firstElementChild;
    if (!(next instanceof HTMLElement)) { columns = renderGrid(); return; }
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
    const row = focused ? state.rows.find(r => r.uid === focused.dataset.row) : undefined;
    const ids = new Set((row && row.manifest ? row.manifest.inputs ?? [] : []).map(i => i.id));
    bar.querySelectorAll<HTMLElement>('.pro-collapsed-tag:not(.pro-collapsed-tag--export)').forEach(tag => {
      tag.classList.toggle('is-relevant', ids.has(tag.dataset.restoreCol ?? ''));
    });
  }

  let columns = renderGrid();
  // The first cell's ring is set by nav.refresh (in renderGrid). Actually OPENING
  // its template search waits until the end of mount (openFirstTemplateSearch) —
  // the grid's click/focusin handlers are wired below, so doing it here would
  // fire before them and the chooser wouldn't open (you'd have to press Return).

  const rowByUid = (uid: string): GridRow | undefined => state.rows.find(r => r.uid === uid);
  const colByKey = (key: string): Column | undefined => columns.find(c => c.key === key);

  // CSV import/export + spreadsheet paste-fill (csv-io.ts). index keeps the
  // `columns`/renderGrid closure, exposed to the seam as getColumns()/render().
  const csvIo = createCsvIo({
    state,
    getColumns: () => columns,
    render: () => { columns = renderGrid(); },
    focusActive: () => nav.focusActive(),
    showProgress,
    makeRow: newRow,
  });

  // Batch run + delivery (batch-run.ts): plan → progress UI → zip.
  const batchRun = createBatchRun({
    state,
    host,
    viewEl,
    progressMount: progressEl,
    render: () => { columns = renderGrid(); },
    showProgress,
    closeBulkPopover: () => closeBulkPopover(),
    onBatchRendered: opts.onBatchRendered,
  });

  // Saved-sessions popover (sessions-view.ts) + folder browsing (folder-actions.ts).
  // applySnapshot / dirty-tracking stay in index; CSV, folders and file-upload are
  // injected so each stays a leaf. The two reference each other lazily (folders
  // button ↔ closeSessions), resolved at click time once both consts exist.
  const sessionsView = createSessionsView({
    sessions,
    state,
    showProgress,
    applySnapshot,
    markClean,
    goHome,
    exportCsv: () => csvIo.exportCsv(),
    openCsvUpload: () => fileInput.click(),
    openFolders: () => folderActions.openFoldersOverlay(),
    foldersEnabled: !!opts.openFolderOverlay,
  });
  const folderActions = createFolderActions({
    host,
    openFolderOverlay: opts.openFolderOverlay,
    loadSession: (slot) => sessions.load(slot),
    applySnapshot,
    showProgress,
    closeSessions: () => sessionsView.closeSessions(),
  });

  // Row-height + column-width drag resize. Mutates state directly (no re-render);
  // the renderer re-applies persisted sizes on the next render.
  const detachResize = attachResize(gridHost, {
    setRowHeight: (uid, h) => { const r = rowByUid(uid); if (r) r.height = h; },
    setColWidth: (key, w) => { state.colWidths[key] = w; },
  });

  // Drag-to-scrub the Width/Height cells. Commits by firing a normal `input`
  // event so the same handler that catches typing updates the row state — no
  // re-render, just a value write per frame (see scrub.js for the perf notes).
  const detachScrub = attachScrub(gridHost, {
    selector: 'input.pro-num',
    getFallback: (el) => { const n = parseInt(el.placeholder, 10); return Number.isFinite(n) ? n : 0; },
    onCommit: (el) => el.dispatchEvent(new Event('input', { bubbles: true })),
  });

  // Drag a row's grip handle (in the actions cell) to reorder rows. The module
  // moves the <tr> live for feedback; on drop it hands back the new uid order and
  // we reorder state.rows to match, then re-render so state stays authoritative.
  const detachReorder = attachReorder(gridHost, {
    scrollEl: () => gridHost.querySelector('.pro-grid-scroll'),
    onReorder: (order) => {
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
    const existingKeys = new Set(deriveColumns(state.rows.filter(r => r.manifest)).map(c => c.key));
    row.toolId = tool.id;
    row.manifest = null;
    try {
      const loaded = await getTool(tool.id);
      row.manifest = loaded.manifest;
      // Drop values that no longer correspond to an input on the new tool.
      const ids = new Set((loaded.manifest.inputs ?? []).map(i => i.id));
      row.values = Object.fromEntries(Object.entries(row.values).filter(([k]) => ids.has(k)));
      // Drop a per-row format the new tool can't produce.
      if (row.format && !(loaded.manifest.render?.formats ?? []).includes(row.format)) row.format = undefined;
      // Hide only the columns this tool just introduced — EXCEPT a whitelist of
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
  let _tplPop: HTMLElement | null = null;
  let _tplPopRow: string | null = null;
  let _tplOutside: ((e: PointerEvent) => void) | null = null;
  let _tplSuppress = false; // briefly true after closing, so refocus doesn't reopen
  function closeTemplatePicker() {
    if (!_tplPop) return;
    if (_tplOutside) { document.removeEventListener('pointerdown', _tplOutside, true); _tplOutside = null; }
    _tplPop.remove();
    _tplPop = null;
    _tplPopRow = null;
    _tplSuppress = true;
    setTimeout(() => { _tplSuppress = false; }, 0);
  }
  function openTemplatePicker(td: HTMLElement | null, row: GridRow | undefined) {
    if (!td || !row) return;
    if (_tplPop && _tplPopRow === row.uid) return; // already open for this cell
    closeBulkPopover(); sessionsView.closeSessions(); closeTemplatePicker(); closeBlocksPanel();

    const pop = document.createElement('div');
    pop.className = 'pro-popover pro-tpl-popover';
    pop.innerHTML = `
      <input type="search" class="pro-tpl-search" role="combobox" aria-expanded="true" aria-controls="pro-tpl-listbox" aria-autocomplete="list" aria-activedescendant="" placeholder="Search templates…" autocomplete="off" spellcheck="false" aria-label="Search templates">
      <ul class="pro-tpl-list" id="pro-tpl-listbox" role="listbox"></ul>`;
    document.body.appendChild(pop);
    _tplPop = pop;
    _tplPopRow = row.uid;

    // Dock to the cell's top-left (overlays it), escaping the scroll container.
    // Nudge 2px left so the popover's flat left edge aligns flush with the grid.
    const r = td.getBoundingClientRect();
    const W = Math.max(240, Math.round(r.width));
    const left = Math.max(6, Math.min(r.left - 2, window.innerWidth - W - 8));
    pop.style.cssText = `position:fixed;top:${Math.round(r.top)}px;left:${left}px;width:${W}px;z-index:9999;`;

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
      const ql = q.trim().toLowerCase();
      shown = ql ? tools.filter(t => (t.name ?? t.id).toLowerCase().includes(ql)) : tools;
      active = Math.min(active, Math.max(0, shown.length - 1));
      listEl.innerHTML = shown.length
        ? shown.map((t, i) => `<li><button type="button" role="option" id="pro-tpl-opt-${i}" aria-selected="${i === active ? 'true' : 'false'}" class="pro-tpl-opt${i === active ? ' is-active' : ''}" data-tool="${escapeHtml(t.name)}">
            <span class="pro-tpl-opt-name">${escapeHtml(t.name)}</span>${t.status === 'experimental' ? '<span class="pro-tpl-opt-exp">exp</span>' : ''}
          </button></li>`).join('')
        : `<li class="pro-tpl-none">No templates match “${escapeHtml(q)}”.</li>`;
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
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest<HTMLElement>('[data-tool]');
      if (btn) void pick(btn.dataset.tool ?? '');
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(shown.length - 1, active + 1); highlight(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); highlight(); e.preventDefault(); }
      else if (e.key === 'Enter') { const sel = shown[active]; if (sel) void pick(sel.name, true); e.preventDefault(); }
      else if (e.key === 'Escape') { closeTemplatePicker(); td.focus(); e.preventDefault(); }
    });

    // Outside-press closes (capture so it beats the grid's own handlers).
    const onOutside = (e: PointerEvent) => { const t = e.target; if (!(t instanceof Node) || (!pop.contains(t) && !td.contains(t))) closeTemplatePicker(); };
    _tplOutside = onOutside;
    setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
    search.focus();
  }

  // ── Event delegation on the grid ────────────────────────────────────────────
  // Narrow an event target to an HTMLElement (form control or any element).
  const asControl = (t: EventTarget | null): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null =>
    (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) ? t : null;

  gridHost.addEventListener('change', async (e) => {
    const t = asControl(e.target);
    if (!t) return;
    if (t.matches('[data-row-format]')) {
      const row = rowByUid(t.dataset.rowFormat ?? '');
      // Only this row's template-cell format face changes; swap just its <tr>.
      if (row) { row.format = t.value || undefined; replaceRow(row.uid); }
      return;
    }
    if (t.matches('[data-out-unit]')) {
      const row = rowByUid(t.dataset.row ?? '');
      // The DPI cell + width/height placeholders depend on the unit, but all live
      // in this row — swap just its <tr> (no column-set change).
      if (row) { row.unit = asUnit(t.value); replaceRow(row.uid); }
      return;
    }
    const cell = t.closest<HTMLElement>('[data-cell]');
    if (cell) commitCell(cell.dataset.row, cell.dataset.col, t);
  });

  gridHost.addEventListener('input', (e) => {
    const t = asControl(e.target);
    if (!t) return;
    if (t.matches('[data-filename]')) {
      const r = rowByUid(t.dataset.row ?? '');
      if (r) r.filename = t.value;
      return;
    }
    if (t.matches('[data-out-width]')) {
      const r = rowByUid(t.dataset.row ?? '');
      if (r) r.outWidth = t.value ? (parseFloat(t.value) || undefined) : undefined;
      return;
    }
    if (t.matches('[data-out-height]')) {
      const r = rowByUid(t.dataset.row ?? '');
      if (r) r.outHeight = t.value ? (parseFloat(t.value) || undefined) : undefined;
      return;
    }
    if (t.matches('[data-out-dpi]')) {
      const r = rowByUid(t.dataset.row ?? '');
      if (r) r.dpi = t.value ? (parseInt(t.value, 10) || undefined) : undefined;
      return;
    }
    const cell = t.closest<HTMLElement>('[data-cell]');
    if (cell && t.type !== 'checkbox') commitCell(cell.dataset.row, cell.dataset.col, t);
  });

  gridHost.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    // Cancel a pending delete-confirm the moment the user clicks anything that
    // isn't the very button they armed (clicking it again is the confirm path).
    if (_armedRemove && t.closest('[data-action="remove-row"]') !== _armedRemove) clearRemoveArm();

    const tpl = t.closest<HTMLElement>('[data-template-trigger]');
    if (tpl) { openTemplatePicker(tpl.closest<HTMLElement>('td'), rowByUid(tpl.dataset.row ?? '')); return; }

    const blkTrigger = t.closest<HTMLElement>('[data-blocks-trigger]');
    if (blkTrigger) { editBlocksCell(blkTrigger.dataset.row, blkTrigger.dataset.col); return; }
    const blkBulk = t.closest<HTMLElement>('[data-bulk-blocks]');
    if (blkBulk) { bulkEditBlocks(blkBulk.dataset.bulkBlocks); return; }

    const preview = t.closest<HTMLElement>('[data-preview-row]');
    if (preview) { openPreview(preview.dataset.previewRow); return; }

    // Two-step delete: a stray click only arms the ✕; a deliberate second click on
    // the same (now red "Remove?") button confirms. Any other click — handled by
    // the disarm guard at the top of this listener — or a 3s timeout cancels it.
    const remove = t.closest<HTMLElement>('[data-action="remove-row"]');
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
    const assetClear = t.closest<HTMLElement>('[data-asset-clear]');
    if (assetClear) {
      const cell = assetClear.closest<HTMLElement>('[data-cell]');
      const row = cell ? rowByUid(cell.dataset.row ?? '') : undefined;
      const col = cell?.dataset.col;
      if (row && col) { delete row.values[col]; columns = renderGrid(); }
      return;
    }
    const assetBtn = t.closest<HTMLElement>('[data-asset-pick]');
    if (assetBtn) {
      const cell = assetBtn.closest<HTMLElement>('[data-cell]');
      if (cell) await pickAssetForCell(cell.dataset.row, cell.dataset.col);
      return;
    }
    const fill = t.closest<HTMLElement>('[data-bulk-col]');
    if (fill) { openBulkPopover(fill, fill.dataset.bulkCol); return; }

    // Click the column heading (not the Fill button) → collapse it to a tag.
    const collapse = t.closest<HTMLElement>('[data-collapse-col]');
    if (collapse) { const k = collapse.dataset.collapseCol; if (k) state.collapsed.add(k); columns = renderGrid(); return; }

    // Click a tag below the grid → restore that column.
    const restore = t.closest<HTMLElement>('[data-restore-col]');
    if (restore) { const k = restore.dataset.restoreCol; if (k) state.collapsed.delete(k); columns = renderGrid(); return; }

    // Add rows from the bottom bar (anchored where you'd use them).
    const addBtn = t.closest<HTMLElement>('[data-add-rows]');
    if (addBtn) { addRows(+(addBtn.dataset.addRows ?? '') || 1); return; }

    // "Fill last": propagate the last template-filled row into every empty row.
    const fillLast = t.closest('[data-fill-last]');
    if (fillLast) { fillEmptyFromLast(); return; }

    // Hide every input column (then the user clicks back the ones they need);
    // Show all clears the collapsed set.
    if (t.closest('[data-hide-all-cols]')) { columns.forEach(c => state.collapsed.add(c.key)); columns = renderGrid(); return; }
    if (t.closest('[data-show-all-cols]')) { state.collapsed.clear(); columns = renderGrid(); return; }

    // Full-cell hit target: clicking the cell's own area (not a child control)
    // activates the cell's control — toggle a checkbox, open a picker, or focus
    // a text field for editing. Makes the whole cell selectable. Skip the bottom
    // edge, which is the row-resize grab zone.
    if (isOnResizeEdge(e)) return;
    const td = t.closest<HTMLElement>('td.pro-cell[data-col]');
    if (td && t === td) {
      const c = td.querySelector<HTMLElement>('.pro-control');
      if (!c) return;
      if ((c instanceof HTMLInputElement && c.type === 'checkbox') || c.matches('[data-asset-pick]')) c.click();
      else { c.focus(); if (c instanceof HTMLInputElement || c instanceof HTMLTextAreaElement) { try { c.select(); } catch { /* number */ } } }
    }
  });

  // Navigating onto an EMPTY template cell auto-opens its search popover (the
  // obvious next action is to pick a tool). A cell that already has a tool stays
  // put — the user hits Enter (or clicks/taps) to change it. The suppress flag
  // stops an immediate reopen when we refocus the cell after closing.
  gridHost.addEventListener('focusin', (e) => {
    highlightRelevantTags(); // moving onto a new row re-aims the relevance outline
    if (_tplSuppress) return;
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const td = t.closest<HTMLElement>('td[data-col="__template"]');
    if (td && t === td) {
      const row = rowByUid(td.dataset.row ?? '');
      if (row && !row.toolId) openTemplatePicker(td, row);
    }
  });

  // Paste a spreadsheet range (Excel/Sheets copy = TSV) to fill cells from the
  // focused cell down/right. Only multi-cell/grid pastes are hijacked; a plain
  // value pastes into the field normally. Use Upload CSV to also set templates.
  gridHost.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!/[\t\n]/.test(text)) return; // not a grid → let it paste normally
    const t = e.target;
    const td = (t instanceof HTMLElement ? t.closest<HTMLElement>('td[data-row][data-col]') : null)
      ?? gridHost.querySelector<HTMLElement>('.pro-cell--focused');
    if (!td) return;
    const grid = parseClipboardGrid(text);
    if (grid.length <= 1 && (grid[0]?.length ?? 0) <= 1) return;
    e.preventDefault();
    csvIo.pasteFill(td.dataset.row ?? '', td.dataset.col ?? '', grid);
  });

  function commitCell(uid: string | undefined, key: string | undefined, el: HTMLElement) {
    if (!uid || !key) return;
    const row = rowByUid(uid);
    const col = colByKey(key);
    if (!row || !col) return;
    const input = cellInput(col, row);
    if (!input) return;
    row.values[key] = readControlValue(el, input);
  }

  async function pickAssetForCell(uid: string | undefined, key: string | undefined) {
    if (!uid || !key) return;
    const row = rowByUid(uid);
    const col = colByKey(key);
    if (!row || !col) return;
    const input = cellInput(col, row);
    if (!input) return;
    const ref = await host.assets.pick({
      title: `Choose ${input.label ?? input.id}`,
      type: asAssetType(input.assetType),
      tags: asStringArray(input.filter?.tags),
      namespace: asString(input.filter?.namespace),
      allowUpload: input.allowUpload === true,
      current: readAssetId(row.values[key]),
    });
    if (ref) { row.values[key] = ref; columns = renderGrid(); }
  }

  // ── Blocks (repeating field groups): edit one cell, or fill the column ───────
  // Per-cell block collapse state, remembered for the session only (NOT serialized
  // into saved tool sessions). Absent key ⇒ first open ⇒ all blocks collapsed.
  const blockUI: Record<string, boolean[]> = {};
  // A viewable raster/SVG format for the in-panel preview (png/webp/jpg/svg all
  // render in an <img>); falls back to whatever the tool supports. Returns null
  // for render-only tools so the panel shows "nothing to preview".
  function previewFormat(manifest: ToolManifest | null): string | null {
    const formats = manifest?.render?.formats ?? [];
    for (const pref of ['png', 'webp', 'jpg', 'svg']) if (formats.includes(pref)) return pref;
    return formats[0] ?? null;
  }
  // Render `row` at native size with `records` applied to its blocks `key`, for
  // the blocks panel's live preview. Native size keeps it fast — the block editor
  // changes content, not dimensions — and the same engine path the batch uses.
  async function renderBlocksPreview(row: GridRow, key: string, records: BlockRecord[]) {
    if (!row?.toolId || !row.manifest || !isExportable(row.manifest)) return null;
    const fmt = previewFormat(row.manifest);
    if (!fmt) return null;
    const snapshot = { ...row, values: { ...row.values, [key]: records } };
    return renderRowToBlob(snapshot, host, { format: fmt });
  }

  async function editBlocksCell(uid: string | undefined, key: string | undefined) {
    if (!uid || !key) return;
    const row = rowByUid(uid);
    const col = colByKey(key);
    const input = row && col ? cellInput(col, row) : null;
    if (!input || !row) return;
    closeTemplatePicker(); closeBulkPopover(); sessionsView.closeSessions();
    const value = Array.isArray(row.values[key]) ? row.values[key] : (input.default ?? []);
    const uiKey = `${uid}~${key}`;
    await openBlocksEditor({
      input, value, host, assetPicker,
      initialExpanded: blockUI[uiKey] ?? null,            // null on first open → all collapsed
      onUi: (expanded) => { blockUI[uiKey] = expanded; }, // remember collapse state for the session
      // Live: each edit commits to this row and refreshes ONLY this cell's summary
      // (no full grid re-render → no scroll churn or focus loss while editing).
      onChange: (records) => { row.values[key] = records; refreshBlocksCell(uid, key, input, records); },
      // Live preview of THIS row as the blocks change (skipped for render-only tools).
      renderPreview: row.toolId ? (records) => renderBlocksPreview(row, key, records) : undefined,
    });
    // The panel held focus; put it back on the cell.
    gridHost.querySelector<HTMLElement>(`td[data-row="${uid}"][data-col="${key.replace(/["\\]/g, '\\$&')}"]`)?.focus();
  }
  // Update one blocks cell's summary button in place (mirrors grid.js dataCell).
  function refreshBlocksCell(uid: string, key: string, input: InputSpec, arr: BlockRecord[]) {
    const td = gridHost.querySelector(`td[data-row="${uid}"][data-col="${key.replace(/["\\]/g, '\\$&')}"]`);
    const btn = td?.querySelector<HTMLElement>('.pro-blocks-trigger');
    if (!btn) return;
    const n = Array.isArray(arr) ? arr.length : 0;
    const firstField = (input.fields ?? [])[0]?.id;
    const preview = n && firstField
      ? arr.slice(0, 2).map(r => r?.[firstField]).filter(v => v != null && v !== '').map(String).join(', ')
      : '';
    btn.textContent = n ? `${n} row${n === 1 ? '' : 's'}${preview ? ' · ' + preview : ''}` : 'Add…';
    btn.classList.toggle('is-empty', n === 0);
    btn.title = `Edit “${input.label ?? key}” — ${n} item${n === 1 ? '' : 's'}`;
  }
  async function bulkEditBlocks(key: string | undefined) {
    if (!key) return;
    const col = colByKey(key);
    if (!col || !col.members) return;
    const input = [...col.members.values()][0]; // representative declaration (fields are shared)
    const targets = state.rows.filter(r => r.toolId && col.members.has(r.toolId));
    if (!input || !targets.length) return;
    closeTemplatePicker(); closeBulkPopover(); sessionsView.closeSessions();
    // Preview the working value against the first target row, so a bulk edit still
    // shows what the blocks will look like before applying to all rows.
    const previewRow = targets.find(r => r.manifest && isExportable(r.manifest));
    const result = await openBlocksEditor({
      input, value: input.default ?? [], host, assetPicker, applyLabel: `Apply to ${targets.length}`,
      renderPreview: previewRow ? (records) => renderBlocksPreview(previewRow, key, records) : undefined,
    });
    if (result !== null) { targets.forEach(r => { r.values[key] = result.map(rec => ({ ...rec })); }); columns = renderGrid(); }
  }

  // ── Bulk column write ───────────────────────────────────────────────────────
  async function openBulkPopover(anchorEl: HTMLElement, key: string | undefined) {
    if (!key) return;
    const col = colByKey(key);
    if (!col || !col.bulk || !col.spec) return;
    const targets = bulkTargets(col, state.rows, { assetPicker });
    if (targets.length === 0) return;
    const spec = col.spec; // bulk columns always carry a representative spec

    // Assets: skip the popover and go straight to the shared picker.
    if (col.type === 'asset') {
      const ref = await host.assets.pick({
        title: `Fill “${col.label}” for ${targets.length} rows`,
        type: asAssetType(spec.assetType),
        allowUpload: spec.allowUpload === true,
      });
      if (ref) { targets.forEach(r => { r.values[key] = ref; }); columns = renderGrid(); }
      return;
    }

    closeBulkPopover(); closeBlocksPanel();
    // Colour columns fill with the shared SUSE picker; everything else with a
    // plain control read on apply.
    const isColor = col.type === 'color';
    let colorValue: ColorFieldValue = typeof spec.default === 'string' ? spec.default : '';
    const pop = document.createElement('div');
    pop.className = 'pro-popover';
    pop.innerHTML = `
      <div class="pro-popover-title">Fill “${escapeHtml(col.label)}” · ${targets.length} row${targets.length === 1 ? '' : 's'}</div>
      <div class="pro-popover-control">${
        isColor
          ? colorFieldHtml(`bulk~${escapeHtml(key)}`, colorValue, { float: true, swatchesOnly: spec.swatchesOnly === true })
          : controlHtml(spec, spec.default ?? '', 'data-bulk-input')
      }</div>
      <div class="pro-popover-actions">
        <button type="button" class="pro-btn" data-bulk-cancel>Cancel</button>
        <button type="button" class="pro-btn pro-btn--primary" data-bulk-apply>Apply to ${targets.length}</button>
      </div>`;
    document.body.appendChild(pop);
    positionPopover(pop, anchorEl);

    const apply = () => {
      const value: InputValue = isColor ? colorValue : readControlValue(pop.querySelector<HTMLElement>('[data-bulk-input]')!, spec);
      targets.forEach(r => { r.values[key] = value; });
      closeBulkPopover();
      columns = renderGrid();
    };

    if (isColor) {
      wireColorField(pop, { onChange: (_id, value) => { colorValue = value; } });
    } else {
      const control = pop.querySelector<HTMLElement>('[data-bulk-input]');
      control?.focus();
      control?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && spec.type !== 'longtext') apply(); });
    }

    pop.querySelector('[data-bulk-apply]')?.addEventListener('click', apply);
    pop.querySelector('[data-bulk-cancel]')?.addEventListener('click', () => closeBulkPopover());
    const onOutside = (e: PointerEvent) => { const t = e.target; if (!(t instanceof Node) || !pop.contains(t)) closeBulkPopover(); };
    _popoverOutside = onOutside;
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
  }

  let _popover: HTMLElement | null = null;
  let _popoverOutside: ((e: PointerEvent) => void) | null = null;
  function positionPopover(pop: HTMLElement, anchorEl: HTMLElement) {
    const r = anchorEl.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
    pop.style.left = `${Math.round(Math.min(r.left + window.scrollX, window.innerWidth - 280))}px`;
    _popover = pop;
  }
  function closeBulkPopover() {
    if (_popoverOutside) { document.removeEventListener('pointerdown', _popoverOutside); _popoverOutside = null; }
    if (_popover) { _popover.remove(); _popover = null; }
  }

  // ── Saved sessions ───────────────────────────────────────────────────────────
  // Replace the whole grid + view state with a saved snapshot, reloading each
  // row's manifest (same rebuild path the CSV import uses).
  async function applySnapshot(data: ApplySnapshotInput) {
    const rows = await rowsFromSnapshot(data, { newRow });
    state.rows = rows.length ? rows : blankRows();
    state.format = data.format ?? state.format;
    state.unit = asUnit(data.unit) ?? 'px';
    state.dpi = data.dpi ?? 300;
    state.zipName = data.zipName ?? '';
    state.collapsed = new Set(data.collapsed ?? []);
    state.colWidths = data.colWidths ?? {};
    formatSel.value = state.format;
    unitSel.value = state.unit;
    dpiInput.value = String(state.dpi);
    dpiInput.disabled = (state.unit === 'px');
    zipNameInput.value = state.zipName;
    sizeZip();
    columns = renderGrid();
    nav.focusActive();
    markClean();                              // a freshly loaded snapshot is the new baseline
  }
  // ── Toolbar ─────────────────────────────────────────────────────────────────
  formatSel.addEventListener('change', () => { state.format = formatSel.value; });
  zipNameInput.addEventListener('input', () => { state.zipName = zipNameInput.value; sizeZip(); });

  // The toolbar unit/DPI are the DEFAULTS every row inherits (row.unit/row.dpi
  // override per row, like the global vs per-row format). Changing a default
  // moves the rows still inheriting it; rows you've explicitly overridden keep
  // their unit (an explicit choice sticks). Re-render so effective units update.
  unitSel.addEventListener('change', () => {
    state.unit = asUnit(unitSel.value) ?? state.unit;
    dpiInput.disabled = (state.unit === 'px');
    columns = renderGrid();
  });
  dpiInput.addEventListener('input', () => {
    const n = parseInt(dpiInput.value, 10);
    if (n > 0) state.dpi = n; // the default; rows without a per-row DPI inherit it
  });
  // + Row / +5 live in the bottom bar (re-rendered with the grid), so they're
  // wired by delegation in the gridHost click handler via [data-add-rows].

  // Append empty rows incrementally — they never change the column set (columns
  // derive only from rows with a tool), so we just append <tr>s instead of
  // rebuilding the whole table. Falls back to a full render if the body's gone.
  function addRows(n: number): GridRow[] {
    const tbody = gridHost.querySelector('tbody');
    const added: GridRow[] = [];
    for (let i = 0; i < n; i++) { const r = newRow(); state.rows.push(r); added.push(r); }
    if (!tbody) { columns = renderGrid(); return added; }
    tbody.insertAdjacentHTML('beforeend', added.map(r => bodyRow(r, columns, ctx)).join(''));
    refreshFillLast(); // new empty rows may re-enable "Fill last"
    nav.refresh({ restoreFocus: false }); // include the new rows in the nav matrix
    return added;
  }

  // The "Fill last" button lives outside the table, so the incremental addRows
  // path doesn't re-render it — keep its disabled state in sync by hand. (A full
  // renderGrid bakes the same state in via addRowsHtml.)
  function refreshFillLast() {
    const btn = gridHost.querySelector<HTMLButtonElement>('[data-fill-last]');
    if (!btn) return;
    const hasSource = state.rows.some(r => r.toolId);
    const hasEmpty = state.rows.some(r => !r.toolId);
    btn.disabled = !(hasSource && hasEmpty);
  }

  // "Fill last": copy the last row that has a template into every row that has
  // none yet — turning one set-up row into a batch in a click. Each target gets
  // its OWN deep copy of the values (so later per-row edits stay independent) plus
  // the source's format / size / unit / dpi. The manifest is read-only data, so
  // it's shared by reference. Per-row filename is left auto so outputs don't
  // collide. Columns are unchanged (the source tool is already present), so a
  // plain re-render is enough.
  function fillEmptyFromLast() {
    let source = null;
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
    const t = e.target;
    if (e.key !== '=' || !(t instanceof HTMLElement) || t.tagName !== 'TD') return;
    e.preventDefault();
    e.stopPropagation();
    addRowAndPick();
  }, true);

  // ⌘/Ctrl+Enter adds a row from ANYWHERE in /pro — mid-edit, in the template
  // search, in the toolbar — since it produces no character it never fights
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

  renderBtn.addEventListener('click', () => { batchRun.runBatchFlow().catch(err => batchRun.reportFatal(err)); });
  sessionsBtn.addEventListener('click', () => { sessionsView.openSessions(sessionsBtn).catch(err => batchRun.reportFatal(err)); });

  // CSV import/export — the buttons live inside the Sessions dialog (wired in
  // drawSessions); the file input stays here so the OS picker survives the
  // dialog closing. Importing replaces the grid, so close the dialog after.
  const fileInput = viewEl.querySelector<HTMLInputElement>('#pro-csv-file')!;
  fileInput.addEventListener('change', () => {
    csvIo.importCsvFile(fileInput.files?.[0]).then(() => sessionsView.closeSessions()).catch(err => batchRun.reportFatal(err)).finally(() => { fileInput.value = ''; });
  });

  // ── Preview, CSV, paste ─────────────────────────────────────────────────────
  async function openPreview(uid: string | undefined) {
    if (!uid) return;
    const row = rowByUid(uid);
    if (!row?.toolId) return;
    let tool: Awaited<ReturnType<typeof getTool>>;
    try { tool = await getTool(row.toolId); } catch { return; }
    // Build a model from the row's values and hand it to the engine's canonical
    // URL serializer, so the deep link matches what the single-tool view expects.
    const model = (tool.manifest.inputs ?? []).map(i => ({ ...i, value: row.values[i.id] ?? i.default }));
    const qs = serializeUrlState(model, { format: row.format || state.format });
    // Carry per-row export dimensions (reserved w/h params), and `full` so the
    // single-tool view hides its sidebar — a clean preview. The preview canvas
    // is on-screen px, so physical units are shown at their CSS-px (96dpi) size.
    const u = row.unit ?? state.unit;
    const toPreviewPx = (v: number) => Math.round(u === 'px' ? v : toCssPx({ value: v, unit: u }));
    let dims = '';
    if (row.outWidth) dims += `&w=${toPreviewPx(row.outWidth)}`;
    if (row.outHeight) dims += `&h=${toPreviewPx(row.outHeight)}`;
    const url = `${location.origin}${location.pathname}#/tool/${encodeURIComponent(row.toolId)}?${qs ? `${qs}&` : ''}full${dims}`;

    // Open a real popup window (sized) rather than a tab, reused per row by name.
    // availLeft/availTop are non-standard (multi-monitor); read via a widened type.
    const scr: Screen & { availLeft?: number; availTop?: number } = screen;
    const w = Math.min(1280, scr.availWidth - 40);
    const h = Math.min(900, scr.availHeight - 40);
    const left = Math.max(0, (scr.availLeft ?? 0) + (scr.availWidth - w) / 2);
    const top = Math.max(0, (scr.availTop ?? 0) + (scr.availHeight - h) / 2);
    window.open(url, `ct-preview-${uid}`, `popup=yes,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(left)},top=${Math.round(top)}`);
  }

  // Progress region primitive (shared by csv-io / sessions / folders / batch-run).
  function showProgress(html: string) { progressEl.hidden = false; progressEl.innerHTML = html; }

  // ── Cleanup (called by the router on navigation away) ───────────────────────
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => { closeBulkPopover(); sessionsView.closeSessions(); closeTemplatePicker(); closeBlocksPanel(); nav.destroy(); detachResize(); detachReorder(); detachScrub(); detachToolbar(); document.removeEventListener('keydown', onAddRowKey, true); };

  // Deep link: open a saved session if the route asked for one (#/pro?session=…),
  // e.g. resuming a batch from the gallery's Saved-sessions list. Otherwise drop
  // straight into the first (blank) row's template search, ready to type — now
  // that the grid's click + focusin handlers are wired.
  if (opts.sessionSlot) {
    const data = await sessions.load(opts.sessionSlot);
    if (data) await applySnapshot(data);
    else showProgress(`<p class="pro-progress-msg pro-log-err">That batch session could not be found.</p>`);
  } else {
    openFirstTemplateSearch();
  }

  // Capture the initial grid as the clean baseline for the unsaved-changes guard
  // (covers blank start, a found deep-linked session, and the not-found case).
  markClean();

  function openFirstTemplateSearch() {
    const td = gridHost.querySelector<HTMLElement>('td[data-col="__template"]');
    const row = td ? rowByUid(td.dataset.row ?? '') : undefined;
    if (td && row && !row.toolId) { td.focus(); openTemplatePicker(td, row); }
  }
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}

// Unsaved-changes guard for leaving /pro. Reuses the shared `.unsaved-dialog`
// styling (app.css). Mirrors the single-tool dialog in views/tool.js but stays
// in the pro module so the whole feature remains removable in one folder.
function showSaveSessionDialog({ onSave, onLeave }: { onSave: () => void; onLeave: () => void }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'unsaved-dialog';
  dialog.innerHTML = `
    <div class="unsaved-dialog-body">
      <h2>Unsaved batch</h2>
      <p>You've made changes to this batch.<br>Save it as a session before leaving?</p>
      <div class="unsaved-dialog-actions">
        <button class="unsaved-save">Save &amp; leave…</button>
        <button class="unsaved-leave">Leave without saving</button>
        <button class="unsaved-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  const cleanup = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector('.unsaved-save')!.addEventListener('click', () => { cleanup(); onSave(); });
  dialog.querySelector('.unsaved-leave')!.addEventListener('click', () => { cleanup(); onLeave(); });
  dialog.querySelector('.unsaved-cancel')!.addEventListener('click', cleanup);
  dialog.addEventListener('cancel', () => dialog.remove());
}
