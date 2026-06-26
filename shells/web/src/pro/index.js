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
import { serializeUrlState, toCssPx } from '@lolly/engine';

// Output-dimension units the batch can target. px is the design canvas; the
// rest are physical and convert per format at export time (engine/src/units.js).
const UNIT_OPTIONS = ['px', 'mm', 'cm', 'in', 'pt'];
import { deriveColumns, cellInput, bulkTargets } from './model.js';
import { renderGridHtml, bodyRow } from './grid.js';
import { createGridNav } from './grid-nav.js';
import { attachResize, isOnResizeEdge } from './resize.js';
import { attachReorder } from './reorder.js';
import { attachScrub } from './scrub.js';
import { controlHtml, readControlValue } from './controls.js';
import { openBlocksEditor, closeBlocksPanel } from './blocks-editor.js';
import { colorFieldHtml, wireColorField } from '../components/color-field.js';
import { getTool, renderRowToBlob, isExportable } from './render-export.js';
import { runBatch, planBatch } from './batch.js';
import { buildZip, saveBlob, saveSequential } from './zip.js';
import { batchToCsv, csvToBatch, parseClipboardGrid, coerceCell } from './io.js';
import { createSessionStore, rowsFromSnapshot, snapshotFromState } from './sessions.js';
import { QUIPS, quipLines } from './quips.js';

const FORMAT_OPTIONS = ['png', 'jpg', 'svg', 'emf', 'pdf', 'webp'];

// Input columns worth showing by default when a newly-added tool uses them
// (everything else a tool introduces starts collapsed). Matched by input id;
// "title" covers the common "heading text" of chart/meeting-style tools.
const DEFAULT_VISIBLE_COLS = new Set(['headshot', 'image', 'photo', 'heading', 'title']);

// Capability gating: hide tools this shell can't fulfil (e.g. 'capture' tools in
// the web PWA) so the batch only offers templates that will actually render.
// Inlined rather than imported from ../capabilities.js to keep pro/ self-contained
// per the isolation contract above. Absent host.capabilities ⇒ no gating.
function shellCanRun(tool, host) {
  const need = tool.capabilities ?? [];
  if (need.length === 0) return true;
  const have = host.capabilities;
  if (!Array.isArray(have)) return true;
  return need.every(c => have.includes(c));
}

let _uidSeq = 0;
const newRow = () => ({ uid: `r${++_uidSeq}`, toolId: '', manifest: null, values: {} });
// Start with a single blank row, template search ready — the user grows the
// batch with the "=" shortcut (or + Row), which keeps each new row's flow fast.
const DEFAULT_ROWS = 1;
const blankRows = () => Array.from({ length: DEFAULT_ROWS }, newRow);

export async function mountPro(viewEl, host, opts = {}) {
  document.title = 'Batch — Lolly';

  const assetPicker = typeof host.assets?.pick === 'function';
  const tools = [...(window.__toolIndex?.tools ?? [])]
    // Batch renders data → asset, so hide render-only / on-device utilities: they
    // export themselves via their own exportFile flow, never the batch path, and
    // would only ever be skipped at run time. (`!== false` fails open if an older
    // cached index predates the `exportable` flag — see build-catalog-index.js.)
    .filter(t => t.exportable !== false)
    .filter(t => shellCanRun(t, host))
    .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  const toolByName = new Map(tools.map(t => [t.name, t]));

  const state = {
    rows: blankRows(),
    format: 'png',
    unit: 'px',           // unit for the Width/Height columns (px/mm/cm/in/pt)
    dpi: 300,             // raster resolution for physical units (print default)
    running: false,
    cancelRequested: false,
    collapsed: new Set(), // column keys hidden from the matrix (restorable via tags)
    colWidths: {},        // key → px width (drag to widen); narrow defaults otherwise
    zipName: '',          // optional name for the delivered zip
  };
  const ctx = { tools, assetPicker, unit: state.unit, dpi: state.dpi };
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

  const gridHost  = viewEl.querySelector('#pro-grid-host');
  const progressEl = viewEl.querySelector('#pro-progress');
  const renderBtn = viewEl.querySelector('#pro-render');
  const formatSel = viewEl.querySelector('#pro-format');
  const unitSel = viewEl.querySelector('#pro-unit');
  const dpiInput = viewEl.querySelector('#pro-dpi');
  const zipNameInput = viewEl.querySelector('#pro-zip-name');

  // Unit + DPI + Format + Sessions sit next to Render on desktop, but tuck into
  // the collapsible toolbar group (hamburger menu) on mobile. CSS can't reparent
  // across the breakpoint, so relocate them on match-media change.
  const unitField = viewEl.querySelector('#pro-unit-field');
  const dpiField = viewEl.querySelector('#pro-dpi-field');
  const formatField = viewEl.querySelector('#pro-format-field');
  const sessionsBtn = viewEl.querySelector('#pro-sessions');
  const toolbarGroup = viewEl.querySelector('#pro-toolbar-group');
  const narrowMq = window.matchMedia('(max-width: 720px)'); // keep in sync with the @media in pro.css
  const placeFormat = () => {
    if (narrowMq.matches) toolbarGroup.append(unitField, dpiField, formatField, sessionsBtn);
    else renderBtn.before(unitField, dpiField, formatField, sessionsBtn); // desktop order
  };
  placeFormat();
  narrowMq.addEventListener('change', placeFormat);

  // Auto-size the zip-name field so the ".zip" suffix trails the last character
  // the user types instead of being pinned to the far right. A hidden span mirrors
  // the text to measure its pixel width; we clamp to the room the field actually
  // has so a long name scrolls inside the input rather than shoving ".zip" off the
  // edge. On mobile the field is a full-width dropdown row, so CSS owns sizing there.
  const zipField = zipNameInput.closest('.pro-zip');
  const zipExt = zipField.querySelector('.pro-zip-ext');
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

  // UI zoom (the −/+ buttons): emulate Cmd +/− using the CSS `zoom` property,
  // which reflows the whole page like native zoom. Works on desktop AND lets a
  // zoomed mobile display be shrunk back down. Applied to <html> so it affects
  // the entire UI, and persisted across the session.
  const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  const ZOOM_KEY = 'ct-ui-zoom';
  const readZoom = () => { const z = parseFloat(localStorage.getItem(ZOOM_KEY)); return Number.isFinite(z) && z > 0 ? z : 1; };
  const applyZoom = (z) => {
    document.documentElement.style.zoom = z === 1 ? '' : String(z);
    try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* storage may be blocked */ }
  };
  const stepZoom = (dir) => {
    const cur = readZoom();
    const i = ZOOM_STEPS.reduce((best, s, idx) => Math.abs(s - cur) < Math.abs(ZOOM_STEPS[best] - cur) ? idx : best, 0);
    applyZoom(ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))]);
  };
  applyZoom(readZoom()); // restore any prior zoom on entry
  viewEl.querySelector('#pro-zoom-out').addEventListener('click', () => stepZoom(-1));
  viewEl.querySelector('#pro-zoom-in').addEventListener('click', () => stepZoom(1));

  // Saved batch sessions (snapshot the whole grid; persisted via host.state).
  const sessions = createSessionStore(host);

  // Dirty tracking: compare a canonical snapshot of the batch against the
  // baseline captured at load / last save. snapshotFromState already drops
  // transient bits (uid, manifest), so a serialise-compare is robust; it errs
  // toward false-positives, the safe direction for a "save before leaving?" guard.
  const serialize = () => JSON.stringify(snapshotFromState(state));
  let baseline = null;                       // set once the initial grid is in place
  const isDirty = () => baseline !== null && serialize() !== baseline;
  const markClean = () => { baseline = serialize(); };

  // Leaving /pro via the "← Tools" link. The link stays a normal hash anchor
  // (shared pill styling with profile/full-screen tools); we just intercept the
  // click when the batch is dirty and offer to save it as a session first.
  let leaveAfterSave = false;
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
      onSave: () => { openSessions(sessionsBtn); leaveAfterSave = true; },
      onLeave: goHome,
    });
  });

  // Spreadsheet keyboard navigation (roving focus + focused/editing states).
  const nav = createGridNav(gridHost);

  // ── Delete-row confirm (two-step) ───────────────────────────────────────────
  // A row's ✕ arms on first click and confirms on the second; declared before the
  // first renderGrid() (which clears any pending arm) so there's no TDZ on call.
  let _armedRemove = null, _armTimer = 0;
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
  function armRemove(btn) {
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
  const colorOnChange = (id, value) => {
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
  function replaceRow(uid) {
    const row = rowByUid(uid);
    const tr = gridHost.querySelector(`tbody tr[data-row="${CSS.escape(uid)}"]`);
    if (!row || !tr) { columns = renderGrid(); return; }
    const hadFocus = gridHost.contains(document.activeElement);
    const tmp = document.createElement('template');
    tmp.innerHTML = bodyRow(row, columns, ctx);
    const next = tmp.content.firstElementChild;
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
    const focused = gridHost.querySelector('.pro-cell--focused');
    const row = focused && state.rows.find(r => r.uid === focused.dataset.row);
    const ids = new Set((row && row.manifest ? row.manifest.inputs ?? [] : []).map(i => i.id));
    bar.querySelectorAll('.pro-collapsed-tag:not(.pro-collapsed-tag--export)').forEach(tag => {
      tag.classList.toggle('is-relevant', ids.has(tag.dataset.restoreCol));
    });
  }

  let columns = renderGrid();
  // The first cell's ring is set by nav.refresh (in renderGrid). Actually OPENING
  // its template search waits until the end of mount (openFirstTemplateSearch) —
  // the grid's click/focusin handlers are wired below, so doing it here would
  // fire before them and the chooser wouldn't open (you'd have to press Return).

  const rowByUid = (uid) => state.rows.find(r => r.uid === uid);
  const colByKey = (key) => columns.find(c => c.key === key);

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
  async function selectTemplate(uid, name) {
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
  let _tplPop = null;
  let _tplSuppress = false; // briefly true after closing, so refocus doesn't reopen
  function closeTemplatePicker() {
    if (!_tplPop) return;
    document.removeEventListener('pointerdown', _tplPop._onOutside, true);
    _tplPop.remove();
    _tplPop = null;
    _tplSuppress = true;
    setTimeout(() => { _tplSuppress = false; }, 0);
  }
  function openTemplatePicker(td, row) {
    if (!td || !row) return;
    if (_tplPop && _tplPop._row === row.uid) return; // already open for this cell
    closeBulkPopover(); closeSessions(); closeTemplatePicker(); closeBlocksPanel();

    const pop = document.createElement('div');
    pop.className = 'pro-popover pro-tpl-popover';
    pop._row = row.uid;
    pop.innerHTML = `
      <input type="search" class="pro-tpl-search" role="combobox" aria-expanded="true" aria-controls="pro-tpl-listbox" aria-autocomplete="list" aria-activedescendant="" placeholder="Search templates…" autocomplete="off" spellcheck="false" aria-label="Search templates">
      <ul class="pro-tpl-list" id="pro-tpl-listbox" role="listbox"></ul>`;
    document.body.appendChild(pop);
    _tplPop = pop;

    // Dock to the cell's top-left (overlays it), escaping the scroll container.
    // Nudge 2px left so the popover's flat left edge aligns flush with the grid.
    const r = td.getBoundingClientRect();
    const W = Math.max(240, Math.round(r.width));
    const left = Math.max(6, Math.min(r.left - 2, window.innerWidth - W - 8));
    pop.style.cssText = `position:fixed;top:${Math.round(r.top)}px;left:${left}px;width:${W}px;z-index:9999;`;

    const search = pop.querySelector('.pro-tpl-search');
    const listEl = pop.querySelector('.pro-tpl-list');
    let shown = [];
    let active = 0;

    // Point the combobox at its active option so screen readers announce it as
    // focus moves through the list (the search box keeps DOM focus throughout).
    const syncActiveDescendant = () => {
      search.setAttribute('aria-activedescendant', listEl.querySelector('.pro-tpl-opt.is-active')?.id ?? '');
    };
    const draw = (q) => {
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
    const pick = async (name, advance = false) => {
      closeTemplatePicker();
      await selectTemplate(row.uid, name);
      if (advance) {
        // Keyboard flow: drop straight into this row's "Save as" cell, ready to type.
        gridHost.querySelector(`td[data-row="${row.uid}"][data-col="__filename"] .pro-control`)?.focus();
      } else {
        // Mouse pick: keep focus on the (re-rendered) template cell.
        gridHost.querySelector(`td[data-row="${row.uid}"][data-col="__template"]`)?.focus();
      }
    };

    draw('');
    search.addEventListener('input', () => { active = 0; draw(search.value); });
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tool]');
      if (btn) pick(btn.dataset.tool);
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(shown.length - 1, active + 1); highlight(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); highlight(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (shown[active]) pick(shown[active].name, true); e.preventDefault(); }
      else if (e.key === 'Escape') { closeTemplatePicker(); td.focus(); e.preventDefault(); }
    });

    // Outside-press closes (capture so it beats the grid's own handlers).
    const onOutside = (e) => { if (!pop.contains(e.target) && !td.contains(e.target)) closeTemplatePicker(); };
    pop._onOutside = onOutside;
    setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
    search.focus();
  }

  // ── Event delegation on the grid ────────────────────────────────────────────
  gridHost.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.matches('[data-row-format]')) {
      const row = rowByUid(t.dataset.rowFormat);
      // Only this row's template-cell format face changes; swap just its <tr>.
      if (row) { row.format = t.value || undefined; replaceRow(row.uid); }
      return;
    }
    if (t.matches('[data-out-unit]')) {
      const row = rowByUid(t.dataset.row);
      // The DPI cell + width/height placeholders depend on the unit, but all live
      // in this row — swap just its <tr> (no column-set change).
      if (row) { row.unit = t.value; replaceRow(row.uid); }
      return;
    }
    const cell = t.closest?.('[data-cell]');
    if (cell) commitCell(cell.dataset.row, cell.dataset.col, t);
  });

  gridHost.addEventListener('input', (e) => {
    if (e.target.matches('[data-filename]')) {
      const r = rowByUid(e.target.dataset.row);
      if (r) r.filename = e.target.value;
      return;
    }
    if (e.target.matches('[data-out-width]')) {
      const r = rowByUid(e.target.dataset.row);
      if (r) r.outWidth = e.target.value ? (parseFloat(e.target.value) || undefined) : undefined;
      return;
    }
    if (e.target.matches('[data-out-height]')) {
      const r = rowByUid(e.target.dataset.row);
      if (r) r.outHeight = e.target.value ? (parseFloat(e.target.value) || undefined) : undefined;
      return;
    }
    if (e.target.matches('[data-out-dpi]')) {
      const r = rowByUid(e.target.dataset.row);
      if (r) r.dpi = e.target.value ? (parseInt(e.target.value, 10) || undefined) : undefined;
      return;
    }
    const cell = e.target.closest?.('[data-cell]');
    if (cell && e.target.type !== 'checkbox') commitCell(cell.dataset.row, cell.dataset.col, e.target);
  });

  gridHost.addEventListener('click', async (e) => {
    // Cancel a pending delete-confirm the moment the user clicks anything that
    // isn't the very button they armed (clicking it again is the confirm path).
    if (_armedRemove && e.target.closest('[data-action="remove-row"]') !== _armedRemove) clearRemoveArm();

    const tpl = e.target.closest('[data-template-trigger]');
    if (tpl) { openTemplatePicker(tpl.closest('td'), rowByUid(tpl.dataset.row)); return; }

    const blkTrigger = e.target.closest('[data-blocks-trigger]');
    if (blkTrigger) { editBlocksCell(blkTrigger.dataset.row, blkTrigger.dataset.col); return; }
    const blkBulk = e.target.closest('[data-bulk-blocks]');
    if (blkBulk) { bulkEditBlocks(blkBulk.dataset.bulkBlocks); return; }

    const preview = e.target.closest('[data-preview-row]');
    if (preview) { openPreview(preview.dataset.previewRow); return; }

    // Two-step delete: a stray click only arms the ✕; a deliberate second click on
    // the same (now red "Remove?") button confirms. Any other click — handled by
    // the disarm guard at the top of this listener — or a 3s timeout cancels it.
    const remove = e.target.closest('[data-action="remove-row"]');
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
    const assetClear = e.target.closest('[data-asset-clear]');
    if (assetClear) {
      const cell = assetClear.closest('[data-cell]');
      const row = cell && rowByUid(cell.dataset.row);
      if (row) { delete row.values[cell.dataset.col]; columns = renderGrid(); }
      return;
    }
    const assetBtn = e.target.closest('[data-asset-pick]');
    if (assetBtn) {
      const cell = assetBtn.closest('[data-cell]');
      await pickAssetForCell(cell.dataset.row, cell.dataset.col);
      return;
    }
    const fill = e.target.closest('[data-bulk-col]');
    if (fill) { openBulkPopover(fill, fill.dataset.bulkCol); return; }

    // Click the column heading (not the Fill button) → collapse it to a tag.
    const collapse = e.target.closest('[data-collapse-col]');
    if (collapse) { state.collapsed.add(collapse.dataset.collapseCol); columns = renderGrid(); return; }

    // Click a tag below the grid → restore that column.
    const restore = e.target.closest('[data-restore-col]');
    if (restore) { state.collapsed.delete(restore.dataset.restoreCol); columns = renderGrid(); return; }

    // Add rows from the bottom bar (anchored where you'd use them).
    const addBtn = e.target.closest('[data-add-rows]');
    if (addBtn) { addRows(+addBtn.dataset.addRows || 1); return; }

    // "Fill last": propagate the last template-filled row into every empty row.
    const fillLast = e.target.closest('[data-fill-last]');
    if (fillLast) { fillEmptyFromLast(); return; }

    // Hide every input column (then the user clicks back the ones they need);
    // Show all clears the collapsed set.
    if (e.target.closest('[data-hide-all-cols]')) { columns.forEach(c => state.collapsed.add(c.key)); columns = renderGrid(); return; }
    if (e.target.closest('[data-show-all-cols]')) { state.collapsed.clear(); columns = renderGrid(); return; }

    // Full-cell hit target: clicking the cell's own area (not a child control)
    // activates the cell's control — toggle a checkbox, open a picker, or focus
    // a text field for editing. Makes the whole cell selectable. Skip the bottom
    // edge, which is the row-resize grab zone.
    if (isOnResizeEdge(e)) return;
    const td = e.target.closest('td.pro-cell[data-col]');
    if (td && e.target === td) {
      const c = td.querySelector('.pro-control');
      if (!c) return;
      if (c.type === 'checkbox' || c.matches('[data-asset-pick]')) c.click();
      else { c.focus(); if (typeof c.select === 'function') { try { c.select(); } catch { /* number */ } } }
    }
  });

  // Navigating onto an EMPTY template cell auto-opens its search popover (the
  // obvious next action is to pick a tool). A cell that already has a tool stays
  // put — the user hits Enter (or clicks/taps) to change it. The suppress flag
  // stops an immediate reopen when we refocus the cell after closing.
  gridHost.addEventListener('focusin', (e) => {
    highlightRelevantTags(); // moving onto a new row re-aims the relevance outline
    if (_tplSuppress) return;
    const td = e.target.closest?.('td[data-col="__template"]');
    if (td && e.target === td) {
      const row = rowByUid(td.dataset.row);
      if (row && !row.toolId) openTemplatePicker(td, row);
    }
  });

  // Paste a spreadsheet range (Excel/Sheets copy = TSV) to fill cells from the
  // focused cell down/right. Only multi-cell/grid pastes are hijacked; a plain
  // value pastes into the field normally. Use Upload CSV to also set templates.
  gridHost.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!/[\t\n]/.test(text)) return; // not a grid → let it paste normally
    const td = e.target.closest?.('td[data-row][data-col]') || gridHost.querySelector('.pro-cell--focused');
    if (!td) return;
    const grid = parseClipboardGrid(text);
    if (grid.length <= 1 && (grid[0]?.length ?? 0) <= 1) return;
    e.preventDefault();
    pasteFill(td.dataset.row, td.dataset.col, grid);
  });

  function commitCell(uid, key, el) {
    const row = rowByUid(uid);
    const col = colByKey(key);
    if (!row || !col) return;
    const input = cellInput(col, row);
    if (!input) return;
    row.values[key] = readControlValue(el, input);
  }

  async function pickAssetForCell(uid, key) {
    const row = rowByUid(uid);
    const col = colByKey(key);
    const input = cellInput(col, row);
    if (!input) return;
    const ref = await host.assets.pick({
      title: `Choose ${input.label ?? input.id}`,
      type: input.assetType === 'any' ? undefined : input.assetType,
      tags: input.filter?.tags,
      namespace: input.filter?.namespace,
      allowUpload: input.allowUpload === true,
      current: row.values[key]?.id,
    });
    if (ref) { row.values[key] = ref; columns = renderGrid(); }
  }

  // ── Blocks (repeating field groups): edit one cell, or fill the column ───────
  // Per-cell block collapse state, remembered for the session only (NOT serialized
  // into saved tool sessions). Absent key ⇒ first open ⇒ all blocks collapsed.
  const blockUI = {};
  // A viewable raster/SVG format for the in-panel preview (png/webp/jpg/svg all
  // render in an <img>); falls back to whatever the tool supports. Returns null
  // for render-only tools so the panel shows "nothing to preview".
  function previewFormat(manifest) {
    const formats = manifest?.render?.formats ?? [];
    for (const pref of ['png', 'webp', 'jpg', 'svg']) if (formats.includes(pref)) return pref;
    return formats[0] ?? null;
  }
  // Render `row` at native size with `records` applied to its blocks `key`, for
  // the blocks panel's live preview. Native size keeps it fast — the block editor
  // changes content, not dimensions — and the same engine path the batch uses.
  async function renderBlocksPreview(row, key, records) {
    if (!row?.toolId || !row.manifest || !isExportable(row.manifest)) return null;
    const fmt = previewFormat(row.manifest);
    if (!fmt) return null;
    const snapshot = { ...row, values: { ...row.values, [key]: records } };
    return renderRowToBlob(snapshot, host, { format: fmt });
  }

  async function editBlocksCell(uid, key) {
    const row = rowByUid(uid);
    const col = colByKey(key);
    const input = row && col && cellInput(col, row);
    if (!input) return;
    closeTemplatePicker(); closeBulkPopover(); closeSessions();
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
    gridHost.querySelector(`td[data-row="${uid}"][data-col="${key.replace(/["\\]/g, '\\$&')}"]`)?.focus();
  }
  // Update one blocks cell's summary button in place (mirrors grid.js dataCell).
  function refreshBlocksCell(uid, key, input, arr) {
    const td = gridHost.querySelector(`td[data-row="${uid}"][data-col="${key.replace(/["\\]/g, '\\$&')}"]`);
    const btn = td?.querySelector('.pro-blocks-trigger');
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
  async function bulkEditBlocks(key) {
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
      renderPreview: previewRow ? (records) => renderBlocksPreview(previewRow, key, records) : undefined,
    });
    if (result !== null) { targets.forEach(r => { r.values[key] = result.map(rec => ({ ...rec })); }); columns = renderGrid(); }
  }

  // ── Bulk column write ───────────────────────────────────────────────────────
  async function openBulkPopover(anchorEl, key) {
    const col = colByKey(key);
    if (!col || !col.bulk) return;
    const targets = bulkTargets(col, state.rows, { assetPicker });
    if (targets.length === 0) return;

    // Assets: skip the popover and go straight to the shared picker.
    if (col.type === 'asset') {
      const ref = await host.assets.pick({
        title: `Fill “${col.label}” for ${targets.length} rows`,
        type: col.spec.assetType === 'any' ? undefined : col.spec.assetType,
        allowUpload: col.spec.allowUpload === true,
      });
      if (ref) { targets.forEach(r => { r.values[key] = ref; }); columns = renderGrid(); }
      return;
    }

    closeBulkPopover(); closeBlocksPanel();
    // Colour columns fill with the shared SUSE picker; everything else with a
    // plain control read on apply.
    const isColor = col.type === 'color';
    let colorValue = col.spec.default ?? '';
    const pop = document.createElement('div');
    pop.className = 'pro-popover';
    pop.innerHTML = `
      <div class="pro-popover-title">Fill “${escapeHtml(col.label)}” · ${targets.length} row${targets.length === 1 ? '' : 's'}</div>
      <div class="pro-popover-control">${
        isColor
          ? colorFieldHtml(`bulk~${escapeHtml(key)}`, colorValue, { float: true, swatchesOnly: col.spec.swatchesOnly === true })
          : controlHtml(col.spec, col.spec.default ?? '', 'data-bulk-input')
      }</div>
      <div class="pro-popover-actions">
        <button type="button" class="pro-btn" data-bulk-cancel>Cancel</button>
        <button type="button" class="pro-btn pro-btn--primary" data-bulk-apply>Apply to ${targets.length}</button>
      </div>`;
    document.body.appendChild(pop);
    positionPopover(pop, anchorEl);

    const apply = () => {
      const value = isColor ? colorValue : readControlValue(pop.querySelector('[data-bulk-input]'), col.spec);
      targets.forEach(r => { r.values[key] = value; });
      closeBulkPopover();
      columns = renderGrid();
    };

    if (isColor) {
      wireColorField(pop, { onChange: (_id, value) => { colorValue = value; } });
    } else {
      const control = pop.querySelector('[data-bulk-input]');
      control?.focus();
      control?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && col.spec.type !== 'longtext') apply(); });
    }

    pop.querySelector('[data-bulk-apply]').addEventListener('click', apply);
    pop.querySelector('[data-bulk-cancel]').addEventListener('click', closeBulkPopover);
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);

    function onOutside(e) { if (!pop.contains(e.target)) closeBulkPopover(); }
    pop._onOutside = onOutside;
  }

  let _popover = null;
  function positionPopover(pop, anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
    pop.style.left = `${Math.round(Math.min(r.left + window.scrollX, window.innerWidth - 280))}px`;
    _popover = pop;
  }
  function closeBulkPopover() {
    if (_popover) {
      document.removeEventListener('pointerdown', _popover._onOutside);
      _popover.remove();
      _popover = null;
    }
  }

  // ── Saved sessions ───────────────────────────────────────────────────────────
  // Replace the whole grid + view state with a saved snapshot, reloading each
  // row's manifest (same rebuild path the CSV import uses).
  async function applySnapshot(data) {
    const rows = await rowsFromSnapshot(data, { newRow });
    state.rows = rows.length ? rows : blankRows();
    state.format = data.format ?? state.format;
    state.unit = data.unit ?? 'px';
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

  let _sessPop = null;
  function closeSessions() {
    leaveAfterSave = false;                   // abandoning the popover cancels "save & leave"
    if (_sessPop) {
      document.removeEventListener('pointerdown', _sessPop._onOutside);
      _sessPop.remove();
      _sessPop = null;
    }
  }

  async function openSessions(anchorEl) {
    closeBulkPopover();
    closeSessions();
    const pop = document.createElement('div');
    pop.className = 'pro-popover pro-popover--sessions';
    document.body.appendChild(pop);
    _sessPop = pop;
    await drawSessions(pop);
    const r = anchorEl.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
    pop.style.left = `${Math.round(Math.min(r.left + window.scrollX, window.innerWidth - 320))}px`;
    const onOutside = (e) => { if (!pop.contains(e.target)) closeSessions(); };
    pop._onOutside = onOutside;
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
  }

  // (Re)render the popover body — the saved list plus the save-current control.
  async function drawSessions(pop) {
    const list = await sessions.list();
    pop.innerHTML = `
      <div class="pro-popover-title">Batch sessions</div>
      ${list.length ? `<ul class="pro-sess-list">${list.map(s => `
        <li class="pro-sess-item">
          <button type="button" class="pro-sess-load" data-load="${escapeHtml(s.slot)}" data-name="${escapeHtml(s.name)}" title="Load “${escapeHtml(s.name)}”">
            <span class="pro-sess-name">${escapeHtml(s.name)}</span>
            <span class="pro-sess-when">${escapeHtml(relTime(s.updatedAt))}</span>
          </button>
          <button type="button" class="pro-sess-del" data-del="${escapeHtml(s.slot)}" title="Delete" aria-label="Delete ${escapeHtml(s.name)}">✕</button>
        </li>`).join('')}</ul>`
        : `<p class="pro-sess-empty">No saved sessions yet — save the current grid below.</p>`}
      <div class="pro-sess-save">
        <input type="text" class="pro-sess-input" placeholder="Session name" value="${escapeHtml(state.zipName.trim())}" autocomplete="off" spellcheck="false" maxlength="60">
        <button type="button" class="pro-btn pro-btn--primary" data-save>Save</button>
      </div>
      <div class="pro-sess-csv">
        <span class="pro-sess-csv-label">Offline CSV</span>
        <button type="button" class="pro-btn" data-csv-export title="Download this batch as a CSV to edit in any spreadsheet">↓ Download</button>
        <button type="button" class="pro-btn" data-csv-import title="Load a batch from a CSV / TSV file">↑ Upload</button>
      </div>`;

    // CSV download/upload (offline round-trip). The hidden file input persists
    // outside the popover so the OS dialog survives the popover closing.
    pop.querySelector('[data-csv-export]').addEventListener('click', exportCsv);
    pop.querySelector('[data-csv-import]').addEventListener('click', () => fileInput.click());

    pop.querySelectorAll('[data-load]').forEach(btn => btn.addEventListener('click', async () => {
      const data = await sessions.load(btn.dataset.load);
      if (!data) { showProgress(`<p class="pro-progress-msg pro-log-err">That session couldn't be loaded.</p>`); return; }
      await applySnapshot(data);
      closeSessions();
      showProgress(`<p class="pro-progress-msg">Loaded session “${escapeHtml(btn.dataset.name)}”.</p>`);
    }));

    pop.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await sessions.delete(btn.dataset.del);
      await drawSessions(pop);
    }));

    const input = pop.querySelector('.pro-sess-input');
    const doSave = async () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      if (!state.rows.some(r => r.toolId)) {
        showProgress(`<p class="pro-progress-msg">Pick at least one template before saving a session.</p>`);
        return;
      }
      await sessions.save(name, state);
      markClean();                            // saving makes the batch clean
      if (leaveAfterSave) { closeSessions(); goHome(); return; }
      await drawSessions(pop);
      pop.querySelector('.pro-sess-input')?.focus();
      showProgress(`<p class="pro-progress-msg">Saved session “${escapeHtml(name)}”.</p>`);
    };
    pop.querySelector('[data-save]').addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
  }

  function relTime(iso) {
    if (!iso) return '';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  // ── Toolbar ─────────────────────────────────────────────────────────────────
  formatSel.addEventListener('change', (e) => { state.format = e.target.value; });
  zipNameInput.addEventListener('input', (e) => { state.zipName = e.target.value; sizeZip(); });

  // The toolbar unit/DPI are the DEFAULTS every row inherits (row.unit/row.dpi
  // override per row, like the global vs per-row format). Changing a default
  // moves the rows still inheriting it; rows you've explicitly overridden keep
  // their unit (an explicit choice sticks). Re-render so effective units update.
  unitSel.addEventListener('change', (e) => {
    state.unit = e.target.value;
    dpiInput.disabled = (state.unit === 'px');
    columns = renderGrid();
  });
  dpiInput.addEventListener('input', (e) => {
    const n = parseInt(e.target.value, 10);
    if (n > 0) state.dpi = n; // the default; rows without a per-row DPI inherit it
  });
  // + Row / +5 live in the bottom bar (re-rendered with the grid), so they're
  // wired by delegation in the gridHost click handler via [data-add-rows].

  // Append empty rows incrementally — they never change the column set (columns
  // derive only from rows with a tool), so we just append <tr>s instead of
  // rebuilding the whole table. Falls back to a full render if the body's gone.
  function addRows(n) {
    const tbody = gridHost.querySelector('tbody');
    const added = [];
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
    const btn = gridHost.querySelector('[data-fill-last]');
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
    const td = gridHost.querySelector(`td[data-row="${row.uid}"][data-col="__template"]`);
    if (td) { td.focus(); openTemplatePicker(td, row); }
  }

  // "=" while a cell is focused (nav mode, not editing) quickly adds a row. Capture
  // phase + stopPropagation so grid-nav doesn't treat "=" as "type to edit". When
  // focus is inside a control (input/search/etc.) the key types normally.
  gridHost.addEventListener('keydown', (e) => {
    if (e.key !== '=' || e.target.tagName !== 'TD') return;
    e.preventDefault();
    e.stopPropagation();
    addRowAndPick();
  }, true);

  // ⌘/Ctrl+Enter adds a row from ANYWHERE in /pro — mid-edit, in the template
  // search, in the toolbar — since it produces no character it never fights
  // typing. Document-level + capture so it beats the per-cell / search Enter
  // handlers (and the body-mounted search popover, which isn't inside the grid).
  const onAddRowKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      addRowAndPick();
    }
  };
  document.addEventListener('keydown', onAddRowKey, true);

  renderBtn.addEventListener('click', () => { runBatchFlow().catch(err => reportFatal(err)); });
  viewEl.querySelector('#pro-sessions').addEventListener('click', (e) => { openSessions(e.currentTarget).catch(err => reportFatal(err)); });

  // Hamburger: at narrow widths the toolbar controls collapse into a dropdown
  // (CSS-driven); this just toggles it open and closes it on an outside tap.
  const toolbarEl = viewEl.querySelector('.pro-toolbar');
  const menuBtn = viewEl.querySelector('#pro-menu');
  const closeMenu = () => { toolbarEl.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuBtn.setAttribute('aria-expanded', toolbarEl.classList.toggle('is-open') ? 'true' : 'false');
  });
  const onDocPointer = (e) => { if (toolbarEl.classList.contains('is-open') && !toolbarEl.contains(e.target)) closeMenu(); };
  document.addEventListener('pointerdown', onDocPointer);

  // CSV import/export — the buttons live inside the Sessions dialog (wired in
  // drawSessions); the file input stays here so the OS picker survives the
  // dialog closing. Importing replaces the grid, so close the dialog after.
  const fileInput = viewEl.querySelector('#pro-csv-file');
  fileInput.addEventListener('change', () => {
    importCsvFile(fileInput.files?.[0]).then(() => closeSessions()).catch(err => reportFatal(err)).finally(() => { fileInput.value = ''; });
  });

  // ── Preview, CSV, paste ─────────────────────────────────────────────────────
  async function openPreview(uid) {
    const row = rowByUid(uid);
    if (!row?.toolId) return;
    let tool;
    try { tool = await getTool(row.toolId); } catch { return; }
    // Build a model from the row's values and hand it to the engine's canonical
    // URL serializer, so the deep link matches what the single-tool view expects.
    const model = (tool.manifest.inputs ?? []).map(i => ({ ...i, value: row.values[i.id] ?? i.default }));
    const qs = serializeUrlState(model, { format: row.format || state.format });
    // Carry per-row export dimensions (reserved w/h params), and `full` so the
    // single-tool view hides its sidebar — a clean preview. The preview canvas
    // is on-screen px, so physical units are shown at their CSS-px (96dpi) size.
    const u = row.unit ?? state.unit;
    const toPreviewPx = (v) => Math.round(u === 'px' ? v : toCssPx({ value: v, unit: u }));
    let dims = '';
    if (row.outWidth) dims += `&w=${toPreviewPx(row.outWidth)}`;
    if (row.outHeight) dims += `&h=${toPreviewPx(row.outHeight)}`;
    const url = `${location.origin}${location.pathname}#/tool/${encodeURIComponent(row.toolId)}?${qs ? `${qs}&` : ''}full${dims}`;

    // Open a real popup window (sized) rather than a tab, reused per row by name.
    const w = Math.min(1280, screen.availWidth - 40);
    const h = Math.min(900, screen.availHeight - 40);
    const left = Math.max(0, (screen.availLeft ?? 0) + (screen.availWidth - w) / 2);
    const top = Math.max(0, (screen.availTop ?? 0) + (screen.availHeight - h) / 2);
    window.open(url, `ct-preview-${uid}`, `popup=yes,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(left)},top=${Math.round(top)}`);
  }

  function exportCsv() {
    const usable = state.rows.filter(r => r.toolId && r.manifest);
    if (!usable.length) { showProgress(`<p class="pro-progress-msg">Pick at least one template before exporting.</p>`); return; }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    saveBlob(new Blob([batchToCsv(state.rows, { unit: state.unit, dpi: state.dpi })], { type: 'text/csv' }), `lolly-batch-${stamp}.csv`);
  }

  async function importCsvFile(file) {
    if (!file) return;
    let text;
    try { text = await file.text(); }
    catch { showProgress(`<p class="pro-progress-msg pro-log-err">Couldn't read that file.</p>`); return; }
    const { rows, errors } = await csvToBatch(text, { getTool, makeRow: newRow });
    if (!rows.length) {
      showProgress(`<p class="pro-progress-msg pro-log-err">${escapeHtml(errors[0] || 'No rows found in the file.')}</p>`);
      return;
    }
    state.rows = rows;
    state.collapsed.clear();
    columns = renderGrid();
    nav.focusActive();
    const ok = rows.filter(r => r.toolId).length;
    showProgress(`<p class="pro-progress-msg">Loaded ${ok} row${ok === 1 ? '' : 's'} from CSV.${
      errors.length ? ` <span class="pro-log-err">${errors.length} issue${errors.length === 1 ? '' : 's'}.</span>` : ''
    }</p>${errors.length ? `<ol class="pro-log">${errors.map(e => `<li class="pro-log-err">${escapeHtml(e)}</li>`).join('')}</ol>` : ''}`);
  }

  // Fill values from a pasted spreadsheet range, anchored at the focused cell.
  // Only writes into rows that already have a template (use Upload CSV to set
  // templates too); cells the tool doesn't have are skipped.
  function pasteFill(startUid, startColKey, grid) {
    // Column order must match the rendered grid so paste anchors correctly.
    const flatCols = ['__template', '__filename', '__width', '__height', '__unit', '__dpi', ...columns.map(c => c.key)];
    const startRowIdx = state.rows.findIndex(r => r.uid === startUid);
    const startColIdx = Math.max(0, flatCols.indexOf(startColKey));
    if (startRowIdx < 0) return;

    let filled = 0;
    for (let r = 0; r < grid.length; r++) {
      const row = state.rows[startRowIdx + r];
      if (!row || !row.manifest) continue;
      const byId = new Map((row.manifest.inputs ?? []).map(i => [i.id, i]));
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
        const v = coerceCell(input, raw);
        if (v !== undefined) { row.values[colKey] = v; filled++; }
      }
    }
    columns = renderGrid();
    if (filled) showProgress(`<p class="pro-progress-msg">Pasted ${filled} value${filled === 1 ? '' : 's'} from the clipboard.</p>`);
  }

  // ── Batch run + delivery ────────────────────────────────────────────────────
  async function runBatchFlow() {
    if (state.running) return;
    closeBulkPopover();

    const { renderable, skipped } = await planBatch(state.rows);
    if (renderable.length === 0) {
      showProgress(`<p class="pro-progress-msg">Nothing to render — pick at least one exportable template.</p>`);
      return;
    }

    state.running = true;
    state.cancelRequested = false;
    renderGrid();

    const total = renderable.length;
    const skipNote = skipped.length
      ? `<li class="pro-log-skip">${skipped.length} row${skipped.length === 1 ? '' : 's'} skipped (${escapeHtml(skipped[0].reason)}${skipped.length > 1 ? ', …' : ''})</li>`
      : '';

    // Persistent progress shell: a rotating quip on top, then a head line + a
    // single Cancel button, then the live log. The Cancel button and the <ol>
    // are built ONCE here. draw() rewrites only the head text, and each finished
    // row appends one <li>. (The old code rebuilt the whole body on every row:
    // it re-created the Cancel button without re-binding its click — so it went
    // dead after row 1 — and re-serialised the entire log each time, O(N²) on a
    // big batch.)
    progressEl.hidden = false;
    progressEl.innerHTML = `
      <div class="pro-quip" aria-hidden="true"></div>
      <div class="pro-progress-body">
        <div class="pro-progress-head">
          <span class="pro-progress-headtext"></span>
          <button type="button" class="pro-btn" id="pro-cancel">Cancel</button>
        </div>
        <ol class="pro-log"></ol>
      </div>`;
    const quipEl = progressEl.querySelector('.pro-quip');
    const headEl = progressEl.querySelector('.pro-progress-headtext');
    const logEl = progressEl.querySelector('.pro-log');
    const cancelBtn = progressEl.querySelector('#pro-cancel');
    if (skipNote) logEl.insertAdjacentHTML('beforeend', skipNote);
    const draw = (head) => { headEl.innerHTML = head; };
    const appendLog = (li) => logEl.insertAdjacentHTML('beforeend', li);
    // One Cancel listener, bound once to the stable button, so even a long batch
    // stays cancellable (the old per-row rebuild dropped this after row 1).
    cancelBtn.addEventListener('click', () => { state.cancelRequested = true; cancelBtn.disabled = true; });

    // Shuffle the quips and rotate one every few seconds (re-triggering the CSS
    // fade on each swap). Just for fun while a big batch grinds away.
    const order = QUIPS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let qi = 0;
    const paintQuip = () => {
      quipEl.innerHTML = quipLines(QUIPS[order[qi]], total).map(l => `<span>${escapeHtml(l)}</span>`).join('');
      quipEl.style.animation = 'none'; void quipEl.offsetWidth; quipEl.style.animation = '';
    };
    paintQuip();
    const quipTimer = setInterval(() => { qi = (qi + 1) % order.length; paintQuip(); }, 4200);

    try {
      draw(`<strong>Rendering 0 / ${total}…</strong>`);
      srAnnounce(`Rendering ${total} item${total === 1 ? '' : 's'}…`);

      let done = 0;
      const { files, results } = await runBatch(renderable, host, {
        format: state.format,
        // Toolbar defaults; each row may override via its own unit/dpi (batch.js).
        unit: state.unit,
        dpi: state.dpi,
        isCancelled: () => state.cancelRequested,
        onProgress: (p) => {
          if (p.status === 'rendering') { draw(`<strong>Rendering ${done + 1} / ${total}…</strong>`); return; }
          if (p.status === 'done') appendLog(`<li class="pro-log-ok">✓ ${escapeHtml(p.name)}</li>`);
          else if (p.status === 'error') appendLog(`<li class="pro-log-err">✕ row ${p.index + 1}: ${escapeHtml(p.error)}</li>`);
          else if (p.status === 'cancelled') appendLog(`<li class="pro-log-skip">Cancelled</li>`);
          done++;
          draw(`<strong>Rendered ${done} / ${total}</strong>`);
        },
      });

      state.running = false;
      renderGrid();
      clearInterval(quipTimer);
      quipEl.remove();   // the job's done talking
      cancelBtn.remove(); // …and there's nothing left to cancel

      // Rows that errored mid-run still produce no file — surface the count so a
      // "Done — 480 files" can't quietly hide 20 failures.
      const failed = results.filter(r => !r.ok).length;
      const failNote = failed ? `, ${failed} failed` : '';

      if (files.length === 0) {
        draw(`<strong>No files produced.</strong>`);
        srAnnounce('Batch finished — no files produced.');
        return;
      }

      opts.onBatchRendered?.(files); // host-injected usage metric (see main.js)

      // Deliver: one zip when possible; spaced sequential downloads as a fallback.
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const zipBase = state.zipName.trim().replace(/\.zip$/i, '') || `lolly-batch-${stamp}`;
      // Only carry author details into the zip manifest when the user has opted
      // in (Profile → "Use my details"); otherwise the [ Author Information ]
      // block is dropped. creditText also omits it when there are no details.
      const profile = await host.profile?.get?.().catch(() => null);
      const author = profile?.useDetails ? profile : null;
      // The exact batch settings that produced these files — re-importable to
      // reproduce or tweak the run (Sessions ▸ Upload CSV).
      const csv = batchToCsv(renderable, { unit: state.unit, dpi: state.dpi });
      try {
        const zip = await buildZip(files, { zipName: `${zipBase}.zip`, author, csv });
        saveBlob(zip, `${zipBase}.zip`);
        draw(`<strong>Done — ${files.length} file${files.length === 1 ? '' : 's'} in one zip${failNote}.</strong>`);
        srAnnounce(`Batch complete — ${files.length} file${files.length === 1 ? '' : 's'} in one zip${failNote}.`);
      } catch (zipErr) {
        appendLog(`<li class="pro-log-skip">Zip failed (${escapeHtml(String(zipErr.message ?? zipErr))}); downloading files individually…</li>`);
        draw(`<strong>Downloading ${files.length} files individually…</strong>`);
        // Spaced one-at-a-time saves are slow and silent — surface progress as
        // each file is dispatched so the run never looks stalled.
        await saveSequential(files, {
          delayMs: 600,
          onSaved: (n, tot) => draw(`<strong>Saving ${n} / ${tot}…</strong>`),
        });
        draw(`<strong>Done — ${files.length} files downloaded${failNote}.</strong>`);
        srAnnounce(`Batch complete — ${files.length} file${files.length === 1 ? '' : 's'} downloaded${failNote}.`);
      }
    } finally {
      clearInterval(quipTimer); // never leave the rotator running
    }
  }

  function showProgress(html) { progressEl.hidden = false; progressEl.innerHTML = html; }

  // Screen-reader announcer for batch milestones (start / done / cancelled).
  // Per-row progress is intentionally NOT announced — it would be far too chatty.
  // A local live region (not the shared a11y helper) keeps /pro's import isolation.
  let _srEl = null;
  function srAnnounce(msg) {
    if (!_srEl) {
      _srEl = document.createElement('div');
      _srEl.className = 'visually-hidden';
      _srEl.setAttribute('aria-live', 'polite');
      _srEl.setAttribute('aria-atomic', 'true');
      viewEl.appendChild(_srEl);
    }
    _srEl.textContent = '';
    requestAnimationFrame(() => { _srEl.textContent = msg; });
  }
  function reportFatal(err) {
    state.running = false;
    renderGrid();
    showProgress(`<p class="pro-progress-msg pro-log-err">Batch failed: ${escapeHtml(String(err.message ?? err))}</p>`);
  }

  // ── Cleanup (called by the router on navigation away) ───────────────────────
  viewEl._cleanup = () => { closeBulkPopover(); closeSessions(); closeTemplatePicker(); closeBlocksPanel(); nav.destroy(); detachResize(); detachReorder(); detachScrub(); zipRO.disconnect(); narrowMq.removeEventListener('change', placeFormat); narrowMq.removeEventListener('change', sizeZip); document.removeEventListener('pointerdown', onDocPointer); document.removeEventListener('keydown', onAddRowKey, true); };

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
    const td = gridHost.querySelector('td[data-col="__template"]');
    const row = td && rowByUid(td.dataset.row);
    if (td && row && !row.toolId) { td.focus(); openTemplatePicker(td, row); }
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Unsaved-changes guard for leaving /pro. Reuses the shared `.unsaved-dialog`
// styling (app.css). Mirrors the single-tool dialog in views/tool.js but stays
// in the pro module so the whole feature remains removable in one folder.
function showSaveSessionDialog({ onSave, onLeave }) {
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
  dialog.querySelector('.unsaved-save').addEventListener('click', () => { cleanup(); onSave(); });
  dialog.querySelector('.unsaved-leave').addEventListener('click', () => { cleanup(); onLeave(); });
  dialog.querySelector('.unsaved-cancel').addEventListener('click', cleanup);
  dialog.addEventListener('cancel', () => dialog.remove());
}
