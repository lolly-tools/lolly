// SPDX-License-Identifier: MPL-2.0
/**
 * Multi-edit - 2–8 saved sessions edited side by side (#/multi?s=slot,slot…).
 *
 * The batch grid (/pro) stays the power path for large render queues; this view
 * is the *editing* counterpart for a small, manageable selection: a grid of live
 * canvases (one engine runtime per session - the same createRuntime → hydrate →
 * paint path as the single-tool view) and ONE combined sidebar:
 *
 *   • "Shared" - a collapsible card of every input declared (same id, same type,
 *     same constraints - the /pro column-merge rule) by 2+ of the selected
 *     sessions. Editing a shared control fans the value out to every session
 *     that declares the input, live.
 *   • One collapsed card per session with ALL of its own inputs - rendered by
 *     the SAME renderInputs/syncInputs the tool sidebar uses (full fidelity:
 *     asset pickers, blocks, colour fields) - plus a condensed export block
 *     (format + width/height/unit/dpi + download; no copy/save/share tiers).
 *   • A search field that filters controls across every card.
 *
 * Clicking a canvas opens + scrolls to that session's card. "Save all" writes
 * every session back to its slot; "Download all" renders each through the same
 * offscreen export path the batch grid uses (pro/render-export.renderRowToBlob).
 *
 * Reuse, not reinvention: controls come from tool-inputs.ts, canvas lifecycle
 * from render-lifecycle/scope-css/embed, session storage from bridge/state, and
 * the shared-input rule from pro/model.constraintSignature.
 */
import '../styles/parts/tool.css';        // .tool-inputs control styles (shared chunk with the tool view)
import '../styles/parts/multi-edit.css';
import { UNITS, serializeUrlState, buildEmbedUrl, buildInputModel } from '@lolly/engine';
import { setPendingToolSeed } from '../lib/drop-router.ts';
import { navigateTo } from '../nav.ts';
import { createToolRuntime as createRuntime } from '../lib/mount-runtime.ts';
import { getTool, chooseFormat, isExportable } from '../bridge/tool-loader.ts';
import { createNetAPI } from '../bridge/net.ts';
import { neutralizeEmbeds, hydrateEmbeds } from '../bridge/embed.ts';
import { namespaceInlinedSvgIds } from '../bridge/svg-inline-ids.ts';
import { runTemplateScripts } from '../lib/render-lifecycle.ts';
import { attachCanvasCommit } from '../lib/canvas-commit.ts';
import { scopeCss, scopeTemplateStyles } from '../lib/scope-css.ts';
import { syncInputs } from './tool-inputs.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { fold, tokenize, scoreHaystack } from '../lib/search/match.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import { mountZoomHud } from '../components/zoom-hud.ts';
import { startBatchExport } from '../lib/batch-job.ts';
import { MULTI_EDIT_MIN, MULTI_EDIT_MAX } from '../lib/multi-edit-limits.ts';
import { memberSaveValues, applySharedEdit } from '../lib/multi-edit-lazy.ts';
import { createSinglePreviewer } from '../lib/multi-edit-single.ts';
import { setupMobileSheet } from '../lib/mobile-sheet.ts';

import type { WebToolHost, PanelEl } from './tool.ts';
import type { InputModelItem, InputValue, InputSpec } from '../../../../engine/src/inputs.js';
import type { LoadedTool } from '../../../../engine/src/loader.js';
import type { Runtime } from '../../../../engine/src/runtime.js';
import type { Unit } from '../../../../engine/src/units.js';
import type { SavedStateData, WebStateAPI } from '../bridge/state.ts';
import { backPillHtml, mountBackPill } from '../components/back-pill.ts';

interface ViewElement extends HTMLElement { _cleanup?: () => void; }

/** One mounted session: its record, tool, runtime and per-cell paint state. */
interface Member {
  slot: string;
  label: string;
  toolName: string;
  tool: LoadedTool;
  /** Created LAZILY - null until this cell nears the viewport (or its card opens, or
   *  it leads a shared input). `values` stays the authoritative session state until
   *  then, so a cell whose runtime is never built still saves/exports correctly. */
  runtime: Runtime | null;
  /** In-flight createRuntime, so concurrent ensureRuntime() calls dedupe to one. */
  creating: Promise<Runtime> | null;
  data: SavedStateData;
  /** The session's live input values: the createRuntime seed, and - while a cell is
   *  un-created - the buffer a fanned-out shared edit writes into so it is present when
   *  the runtime is finally built. Once the runtime exists, IT is authoritative. */
  values: Record<string, InputValue>;
  thumb: string | null;
  canvasEl: HTMLElement;
  /** Rescale this cell's canvas to its freshly-rendered aspect (set in the cell loop). */
  fit: () => void;
  /** The stored-thumbnail placeholder, dropped once the live canvas has real content. */
  thumbEl: HTMLElement | null;
  panelEl: PanelEl;
  panelModel: InputModelItem[] | null;
  lastPainted: string | null;
  paintRaf: number;
  renderGen: number;
  dirty: boolean;
  /** Within the IntersectionObserver's margin - live paints only while true; a far
   *  cell freezes on its last frame and repaints on approach (needsPaint). */
  near: boolean;
  /** The runtime emitted while this cell was frozen far off-screen - repaint on approach. */
  needsPaint: boolean;
}

const MIN_SEL = MULTI_EDIT_MIN;
const MAX_SEL = MULTI_EDIT_MAX;

// Preview-zoom bounds. Card width is a single CSS var on the grid; auto-fill
// reflows the columns to fit. Each press multiplies/divides by ZOOM_STEP ("a few
// factors"); "Fit" jumps to the largest size at which every design still fits the
// viewport. Persisted per-browser so a chosen size survives revisits.
const ZOOM_MIN = 160;
const ZOOM_MAX = 1100;
const ZOOM_STEP = 1.25;
const ZOOM_KEY = 'me-zoom-cardw';

const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ZOOM_OUT_ICON = svg('<line x1="5" y1="12" x2="19" y2="12"/>');
const ZOOM_IN_ICON = svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>');
const FIT_ICON = svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>');

/** Current values of a runtime's model as a plain map (what a session persists). */
function modelValues(runtime: Runtime): Record<string, InputValue> {
  return Object.fromEntries(runtime.getModel().map(i => [i.id, i.value]));
}

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export async function mountMultiEdit(viewEl: ViewElement, host: WebToolHost, params: string): Promise<void> {
  // Titles the tab AND labels this view for the next view's back pill (lib/back-nav.ts).
  document.title = tRaw('{name} - Lolly', { name: t('Multi-edit') });
  const slots = (new URLSearchParams(params).get('s') ?? '')
    .split(',').map(s => decodeURIComponent(s.trim())).filter(Boolean);
  // The Projects folder this multi-edit was opened from (`#/multi?s=…&from=<id>`),
  // the "Save all" project picker's default. Absent when opened from the Tools gallery
  // ("Make copies…"), where the copies are loose and there IS no current project - the
  // case this picker exists to solve.
  const originFolderId = new URLSearchParams(params).get('from') || null;

  const fail = (msg: string): void => {
    viewEl.innerHTML = `
      <div class="me-error">
        <p>${escape(msg)}</p>
        <a class="btn" href="#/p">Back to Projects</a>
      </div>`;
  };
  if (slots.length < MIN_SEL || slots.length > MAX_SEL) {
    // Say HOW to get here, not just the constraint (plans/142 W5): this view is
    // reached from a Projects selection, and a bare/bookmarked #/multi was a
    // dead end that named a rule with no door.
    fail(`Multi-edit works on ${MIN_SEL}–${MAX_SEL} saved sessions - got ${slots.length}. `
      + `In Projects, select the sessions (Cmd/Ctrl-click), then choose "Edit together".`);
    return;
  }

  // ── Load sessions + tools (NO runtimes yet) ────────────────────────────────
  // The web shell's state surface (list() with thumbs, typed load()) - HostV1's
  // StateAPI is the narrow portable contract, this view is web-only.
  //
  // Deliberately cheap: this resolves each session's record + tool manifest only.
  // createRuntime is the expensive half (it runs the tool's onInit hook and resolves
  // its asset refs - real network for photos/logos), so it's deferred until AFTER the
  // grid is on screen; doing it here left the whole view blank for the length of the
  // loop, which scales with the selection (up to 8). Each session's stored thumbnail
  // carries first paint instead - see cellHtml + the hydrate loop below.
  const state = host.state as unknown as WebStateAPI;
  const entries = await state.list();
  const bySlot = new Map(entries.map(e => [e.slot, e]));
  const members: Member[] = [];
  for (const slot of slots) {
    const entry = bySlot.get(slot);
    const data = await state.load(slot);
    if (!entry || !data) { fail('A selected session no longer exists.'); return; }
    const toolId = String(data.__toolId ?? entry.toolId ?? '');
    let tool: LoadedTool;
    try { tool = await getTool(toolId); }
    catch { fail(`The tool "${toolId}" for one session isn't in this catalog.`); return; }
    const values: Record<string, InputValue> = {};
    for (const [k, v] of Object.entries(data)) if (!k.startsWith('__')) values[k] = v as InputValue;
    members.push({
      slot,
      label: String(entry.label || data.__label || tool.manifest.name || toolId),
      toolName: tool.manifest.name ?? toolId,
      tool, data, values,
      // Runtime is built lazily (ensureRuntime) - never eagerly for all cells.
      runtime: null,
      creating: null,
      thumb: entry.thumb ?? null,
      canvasEl: null as unknown as HTMLElement,
      fit: () => { /* set in the cell loop */ },
      thumbEl: null,
      panelEl: null as unknown as PanelEl,
      panelModel: null,
      lastPainted: null,
      paintRaf: 0,
      renderGen: 0,
      dirty: false,
      near: false,
      needsPaint: false,
    });
  }

  // ── Shared inputs: same id + same type + same constraints on 2+ sessions ───
  // The /pro grid's column-merge rule (pro/model.deriveColumns), recomputed per
  // SESSION rather than per tool so two sessions of the same tool still share.
  const { constraintSignature } = await import('../pro/model.ts');
  interface SharedEntry { id: string; lead: Member; count: number; }
  const shared: SharedEntry[] = [];
  {
    const byId = new Map<string, { decl: InputSpec; members: Member[]; sigs: Set<string> }>();
    for (const m of members) {
      for (const input of (m.tool.manifest.inputs ?? []) as InputSpec[]) {
        if (!input || typeof input.id !== 'string') continue;
        if ((input as { group?: string }).group === 'export') continue; // sheet-owned, not sidebar inputs
        const cur = byId.get(input.id);
        if (!cur) byId.set(input.id, { decl: input, members: [m], sigs: new Set([constraintSignature(input)]) });
        else { cur.members.push(m); cur.sigs.add(constraintSignature(input)); }
      }
    }
    for (const [id, col] of byId) {
      if (col.members.length < 2) continue;
      if (new Set(col.members.map(m => (m.tool.manifest.inputs ?? []).find(i => i.id === id)?.type)).size !== 1) continue;
      if (col.sigs.size !== 1) continue;
      shared.push({ id, lead: col.members[0]!, count: col.members.length });
    }
  }
  const sharedMembersOf = (id: string): Member[] =>
    members.filter(m => (m.tool.manifest.inputs ?? []).some(i => i.id === id));

  // ── Markup ──────────────────────────────────────────────────────────────────
  const cellHtml = (m: Member, i: number): string => {
    const w = m.tool.manifest.render?.width ?? 800;
    const h = m.tool.manifest.render?.height ?? 600;
    const single = !!m.tool.manifest.singleInstance;
    return `
      <figure class="me-cell${single ? ' is-single' : ''}" data-me-cell="${i}" tabindex="0" role="button"
        aria-label="${escape(single ? tRaw('Show the inputs for {label}, or click the preview to interact with it', { label: m.label }) : tRaw('Show the inputs for {label}', { label: m.label }))}">
        <div class="me-stage" style="aspect-ratio:${w} / ${h}">
          ${m.thumb ? `<img class="me-thumb" data-me-thumb="${i}" src="${escape(m.thumb)}" alt="" aria-hidden="true">` : ''}
          <div class="me-scale" data-me-scale="${i}" style="width:${w}px;height:${h}px">
            <div class="me-canvas" id="me-c${i}"></div>
          </div>
          ${single ? `<span class="me-live-hint" aria-hidden="true">${escape(t('Click to interact'))}</span>` : ''}
        </div>
        <figcaption class="me-cap">
          <span class="me-cap-label">${escape(m.label)}</span>
          <span class="me-cap-tool">${escape(m.toolName)}</span>
        </figcaption>
      </figure>`;
  };

  const exportBlockHtml = (m: Member, i: number): string => {
    const formats = (m.tool.manifest.render?.formats ?? []).filter(f => f !== 'html');
    const fmt = chooseFormat(m.tool.manifest, String(m.data.__export_format ?? '') || undefined);
    const w = String(m.data.__export_width ?? '');
    const h = String(m.data.__export_height ?? '');
    const unit = String(m.data.__export_unit ?? 'px');
    const dpi = String(m.data.__export_dpi ?? '');
    if (!isExportable(m.tool.manifest)) return `<p class="me-export-note">${t('This tool is render-only - it has no file export.')}</p>`;
    return `
      <div class="me-export" data-me-export="${i}">
        <span class="me-export-label">${t('Export')}</span>
        <label class="me-exp-field">${t('Format')}
          <select class="field-select field-select--sm field-select--auto" data-me-fmt="${i}">${formats.map(f => `<option value="${escape(f)}"${f === fmt ? ' selected' : ''}>${escape(f.toUpperCase())}</option>`).join('')}</select>
        </label>
        <label class="me-exp-field">${t('W')} <input type="number" class="field-input field-input--sm" min="1" inputmode="numeric" placeholder="${escape(t('auto'))}" data-me-w="${i}" value="${escape(w)}"></label>
        <label class="me-exp-field">${t('H')} <input type="number" class="field-input field-input--sm" min="1" inputmode="numeric" placeholder="${escape(t('auto'))}" data-me-h="${i}" value="${escape(h)}"></label>
        <label class="me-exp-field">${t('Unit')}
          <select class="field-select field-select--sm field-select--auto" data-me-unit="${i}">${UNITS.map(u => `<option value="${u}"${u === unit ? ' selected' : ''}>${u}</option>`).join('')}</select>
        </label>
        <label class="me-exp-field me-exp-dpi" ${unit === 'px' ? 'hidden' : ''}>${t('DPI')} <input type="number" class="field-input field-input--sm" min="1" inputmode="numeric" placeholder="300" data-me-dpi="${i}" value="${escape(dpi)}"></label>
        <button type="button" class="btn me-download" data-me-download="${i}" data-sfx="whoosh">${t('Download')}</button>
      </div>`;
  };

  viewEl.innerHTML = `
    <div class="me-layout">
      <header class="me-head">
        ${backPillHtml({ class: 'me-back', iconOnly: true })}
        <h1 class="me-title">${t('Multi-edit')} <span class="me-count">${t('{n} designs', { n: members.length })}</span></h1>
        <div class="me-head-actions">
          <button type="button" class="btn" data-me-saveall data-sfx="save">${t('Save all')}</button>
          <button type="button" class="btn" data-me-tosheet data-sfx="whoosh" title="${escape(t('Lay every design out on a printable sheet, n-up, to cut apart'))}">${t('Send to Print Sheet')}</button>
          <button type="button" class="btn" data-me-tobatch data-sfx="whoosh" title="${escape(t('Save your edits, then open every design as a row in the batch sheet'))}">${t('Batch grid')}</button>
          <button type="button" class="btn me-primary" data-me-downloadall data-sfx="whoosh">${t('Download all')}</button>
          ${langFabHtml()}
        </div>
      </header>
      <div class="me-body">
        <aside class="me-sidebar" aria-label="${escape(t('Combined inputs'))}">
          <button type="button" class="me-sheet-grip" aria-label="${escape(t('Drag to resize the inputs, tap to expand'))}"></button>
          <div class="me-search">
            <input type="search" placeholder="${escape(t('Filter inputs…'))}" aria-label="${escape(t('Filter inputs'))}" data-me-search>
          </div>
          <details class="me-card me-card--shared" data-me-shared-card ${shared.length ? 'open' : ''} ${shared.length ? '' : 'hidden'}>
            <summary><span class="me-card-title">${t('Shared')}</span><span class="me-card-count">${shared.length === 1 ? t('1 input · applies to every design') : t('{n} inputs · applies to every design', { n: shared.length })}</span></summary>
            <div class="tool-inputs me-inputs" data-me-shared-panel></div>
          </details>
          ${members.map((m, i) => `
          <details class="me-card" data-me-card="${i}">
            <summary><span class="me-card-title">${escape(m.label)}</span><span class="me-card-count">${escape(m.toolName)}</span></summary>
            <div class="tool-inputs me-inputs" data-me-panel="${i}"></div>
            ${exportBlockHtml(m, i)}
          </details>`).join('')}
        </aside>
        <div class="me-gridwrap">
          <div class="me-gridbar">
            <div class="me-zoom" data-me-zoom></div>
          </div>
          <div class="me-grid" data-me-grid>
            ${members.map(cellHtml).join('')}
          </div>
        </div>
      </div>
    </div>`;

  const cleanups: Array<() => void> = [];

  // singleInstance tools (WebGL / window-global) can't run N live copies in one document
  // (the later cell's script disposes the earlier ones). Their cells render sequential
  // still previews through the export path instead of live canvases.
  const previewer = createSinglePreviewer(host);
  cleanups.push(() => previewer.dispose());

  cleanups.push(attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host));
  // The profile FAB every other nav-less view carries (dashboard, convert, valid…);
  // it supersedes the header's lang fab (overrides.css hides .lang-fab beside it).
  mountProfileFab(viewEl.querySelector('.me-head-actions'), host);
  mountBackPill(viewEl);

  // Mobile: the inputs become a bottom sheet dragged over the grid (the same
  // draggable split the tool view uses - lib/mobile-sheet), so the list can be
  // pulled up to fill the screen or down to a peek strip. Desktop is untouched:
  // the grip is display:none and the sheet vars are only read under the media query.
  {
    const meBody = viewEl.querySelector<HTMLElement>('.me-body');
    const meSidebar = viewEl.querySelector<HTMLElement>('.me-sidebar');
    const meGrip = viewEl.querySelector<HTMLElement>('.me-sheet-grip');
    if (meBody && meSidebar && meGrip) {
      const sheet = setupMobileSheet(meBody, meSidebar, meGrip, {
        anchor: 'bottom', mq: '(max-width: 900px)', initial: 'half',
        names: { heightVar: '--me-sheet-h', stateAttr: 'data-me-sheet', peekVar: '--me-peek-h', draggingClass: 'is-me-sheet-dragging', headerSel: '.me-sheet-grip' },
      });
      cleanups.push(() => sheet.teardown());
    }
  }

  // Declared ahead of everything: runtime.subscribe emits synchronously, so
  // scheduleSidebar (hoisted fn) runs before the sidebar block below is reached.
  let sidebarRaf = 0;

  // ── Lazy runtimes + viewport-gated paint ────────────────────────────────────
  // Runtimes are NOT created up front. createRuntime runs the tool's onInit and
  // resolves its asset refs (real network), so building all N eagerly - as this view
  // used to (capped at 8) - put the whole selection's boot on the critical path and
  // its memory in play at once. Instead each cell's runtime is built the moment the
  // cell nears the viewport (ensureRuntime, via the IntersectionObserver below); a
  // cell far off-screen stays a stored thumbnail until then, and once painted it
  // FREEZES on its last frame (needsPaint) and repaints only on approach. This is
  // what lets the grid hold many designs (MULTI_EDIT_MAX) at a paint cost that tracks
  // what's on screen, not the selection size. `m.values` stays authoritative until a
  // runtime exists, so a never-created cell still saves/exports correctly.

  // Tools that appear MORE THAN ONCE in the grid: only their cells get per-cell id
  // namespacing (below). Scoping it to duplicates keeps a mixed-tool grid byte-identical
  // to before and shields any tool whose script hard-codes an element id - the reported
  // "multiple of the same tool render wrong" is exactly the duplicate case.
  const dupToolIds = new Set<string>();
  {
    const seen = new Set<string>();
    for (const m of members) {
      const id = m.tool.manifest.id;
      if (seen.has(id)) dupToolIds.add(id); else seen.add(id);
    }
  }

  // The ONE singleInstance cell currently LIVE (real interactive canvas), or null (all
  // still previews). They share window globals + the WebGL context cap, so at most one
  // holds live tool DOM at a time; every other cell is an id-free <img> still, which is
  // what lets an activated cell's getElementById find only its own freshly-painted DOM.
  let activeSingle: number | null = null;
  const retireThumb = (m: Member) => (): void => { m.thumbEl?.remove(); m.thumbEl = null; };

  // paint(m,i): rewrite this cell to its runtime's latest hydrated output.
  const paint = (m: Member, i: number): void => {
    m.paintRaf = 0;
    m.needsPaint = false;
    const rt = m.runtime;
    if (!rt) return;
    const hydrated = rt.getHydrated();
    if (hydrated === m.lastPainted) return;
    const gen = ++m.renderGen;
    try {
      m.canvasEl.innerHTML = neutralizeEmbeds(hydrated);
      // Same containment as the single-tool view: a template <style> is unscoped and
      // unlayered as authored, so it would beat every app layer and leak across panes.
      scopeTemplateStyles(m.canvasEl, `#me-c${i}`);
      runTemplateScripts(m.canvasEl);
      // Namespace this cell's SVG def ids (gradients, filters, clipPaths, masks,
      // markers, <use href>) when this tool is DUPLICATED in the grid. Every cell renders
      // into ONE document, so N copies of the same tool otherwise define the same `id` N
      // times and every `url(#id)` binds to the FIRST cell's def - a diverged copy
      // silently paints the first cell's gradient (or blanks). A per-cell prefix (mc0,
      // mc1, …) makes each cell self-contained. After the template script, so a script's
      // own getElementById still sees originals.
      // …but NOT a singleInstance tool: it only ever paints as the SOLE live cell (all
      // its siblings are id-free stills), so there is no collision to fix, and renaming
      // its ids would break a script that re-queries by id in a pointer handler.
      if (dupToolIds.has(m.tool.manifest.id) && !m.tool.manifest.singleInstance) namespaceInlinedSvgIds(m.canvasEl, `mc${i}`);
      void hydrateEmbeds(m.canvasEl, { host, isCurrent: () => gen === m.renderGen });
      m.fit();   // re-fit to the freshly-rendered aspect (width/height may have changed)
      m.lastPainted = hydrated;
      m.thumbEl?.remove();
      m.thumbEl = null;
    } catch (err) {
      console.warn('multi-edit paint failed:', err);
    }
  };
  // Live paint only for a near cell; a far cell records needsPaint and freezes on
  // its last frame until it scrolls back into range (the IntersectionObserver below).
  const schedulePaint = (m: Member, i: number): void => {
    if (!m.runtime) return;
    if (!m.near) { m.needsPaint = true; return; }
    // singleInstance tools: the ACTIVE cell live-paints (interactive canvas); every other
    // is a still. A non-active cell's still auto-updates ONLY while nothing is live -
    // rendering one otherwise (renderRowToBlob mounts an instance) would dispose the live
    // cell through the shared window globals, so it just marks itself stale and refreshes
    // when it is next activated or the live cell is released.
    if (m.tool.manifest.singleInstance) {
      if (activeSingle === i) { if (!m.paintRaf) m.paintRaf = requestAnimationFrame(() => paint(m, i)); return; }
      if (activeSingle === null) { previewer.schedule(m.slot, m.tool.manifest.id, memberSaveValues(m, modelValues), m.canvasEl, retireThumb(m)); return; }
      m.needsPaint = true;
      return;
    }
    if (!m.paintRaf) m.paintRaf = requestAnimationFrame(() => paint(m, i));
  };

  // ── singleInstance live activation ──────────────────────────────────────────
  // Snapshot cell i's live canvas to an id-free <img> still (so the next activated cell's
  // getElementById can't grab it). Synchronous: a WebGL canvas is captured in-place via
  // toDataURL after forcing one frame (the tool's own export-frame hook); a non-canvas
  // tool (or a capture failure) falls back to the last still we rendered, else blank.
  const freezeSingle = (i: number): void => {
    const m = members[i];
    if (!m) return;
    if (m.paintRaf) { cancelAnimationFrame(m.paintRaf); m.paintRaf = 0; }
    const canvas = m.canvasEl.querySelector<HTMLCanvasElement>('canvas');
    let url: string | null = null;
    if (canvas) {
      try {
        (canvas as { __lollyFrameRender?: (t: number) => void }).__lollyFrameRender?.(0);
        url = canvas.toDataURL('image/png');
      } catch { url = null; }
    }
    if (!url) url = previewer.lastUrl(m.slot);
    m.canvasEl.textContent = '';   // drop the live tool DOM + its ids NOW
    m.lastPainted = null;
    if (url) {
      const img = document.createElement('img');
      img.className = 'me-preview'; img.alt = ''; img.src = url;
      m.canvasEl.appendChild(img);
    }
  };
  // Make cell i the sole live singleInstance cell: freeze the outgoing one, then live-paint i.
  const activateSingle = (i: number): void => {
    if (activeSingle === i) return;
    const m = members[i];
    if (!m) return;
    if (activeSingle !== null) freezeSingle(activeSingle);
    activeSingle = i;
    void ensureRuntime(m, i).then(() => { if (activeSingle === i) paint(m, i); });
  };
  // Release the live cell back to a still, and let any stale siblings refresh now that
  // nothing is live (a shared edit made while a cell was live left them frozen).
  const deactivateSingle = (): void => {
    if (activeSingle === null) return;
    freezeSingle(activeSingle);
    activeSingle = null;
    members.forEach((m, j) => { if (m.tool.manifest.singleInstance && m.needsPaint && m.near) schedulePaint(m, j); });
  };

  // Build one cell's runtime on demand (dedupes concurrent calls), wire its live
  // paint + sidebar sync, and paint it once. Seeded from m.values, which carries any
  // shared edit buffered while the cell was un-created. Same allowlist rule as
  // views/tool.ts: a manifest `network.allowlist` gives THIS mount a host clone whose
  // `net` enforces exactly that list; the shared boot host keeps its fail-closed empty
  // allowlist (bridge methods are closures, not `this`-bound, so a shallow spread is
  // safe). Per member - the grid can mix tools with different (or no) allowlists.
  const ensureRuntime = (m: Member, i: number): Promise<Runtime> => {
    if (m.runtime) return Promise.resolve(m.runtime);
    if (m.creating) return m.creating;
    m.creating = (async () => {
      const mountHost = m.tool.manifest.network?.allowlist?.length
        ? { ...host, net: createNetAPI({ allowlist: m.tool.manifest.network.allowlist }) }
        : host;
      const rt = await createRuntime(m.tool, mountHost, m.values);
      m.runtime = rt;
      // Bind this canvas to ITS OWN runtime: an interactive tool (gradient dots,
      // street-map pan) commits 1:1 to this session, never through the shared/fan
      // sidebar control that a global data-input-id query would hit.
      attachCanvasCommit(m.canvasEl, rt);
      cleanups.push(rt.subscribe(() => { schedulePaint(m, i); scheduleSidebar(); }));
      schedulePaint(m, i);   // first paint (near by construction - we only create on approach/open)
      scheduleSidebar();     // its card may be open, waiting on the model
      return rt;
    })();
    return m.creating;
  };

  // ── Canvas cells: scoped styles + fit (runtime + paint arrive lazily) ───────
  members.forEach((m, i) => {
    m.canvasEl = viewEl.querySelector<HTMLElement>(`#me-c${i}`)!;
    m.panelEl = viewEl.querySelector<PanelEl>(`[data-me-panel="${i}"]`)!;
    if (m.tool.styles) {
      const styleEl = document.createElement('style');
      styleEl.textContent = scopeCss(m.tool.styles, `#me-c${i}`);
      m.canvasEl.before(styleEl);
    }
    const manifestW = m.tool.manifest.render?.width ?? 800;
    const manifestH = m.tool.manifest.render?.height ?? 600;
    // Scale the native-size canvas to the cell (transform, so tool layout math sees its
    // true pixel size). Fit the WHOLE tool into its cell rather than cropping a tall one:
    // the cell adopts the tool's real aspect (read off the hydrated SVG's viewBox), so a
    // portrait chart gets its full frame. Canvas tools with no viewBox keep the manifest box.
    const scaleHost = viewEl.querySelector<HTMLElement>(`[data-me-scale="${i}"]`)!;
    const stage = scaleHost.parentElement!;
    m.fit = (): void => {
      const vb = scaleHost.querySelector('svg')?.viewBox?.baseVal;
      const cw = vb && vb.width > 0 ? vb.width : manifestW;
      const ch = vb && vb.height > 0 ? vb.height : manifestH;
      if (scaleHost.style.width !== `${cw}px`) scaleHost.style.width = `${cw}px`;
      if (scaleHost.style.height !== `${ch}px`) scaleHost.style.height = `${ch}px`;
      const ar = `${cw} / ${ch}`;
      if (stage.style.aspectRatio !== ar) stage.style.aspectRatio = ar;
      scaleHost.style.transform = `scale(${stage.clientWidth / cw})`;
    };
    const ro = new ResizeObserver(m.fit);
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());
    // The stored thumbnail carrying this cell's first paint (cellHtml), retired once the
    // live canvas has real content. Left in place on a paint failure - a still beats blank.
    m.thumbEl = viewEl.querySelector<HTMLElement>(`[data-me-thumb="${i}"]`);
  });
  cleanups.push(() => { for (const m of members) if (m.paintRaf) cancelAnimationFrame(m.paintRaf); });

  // ── Viewport gating: create + live-update cells near the viewport, freeze the rest.
  // The margin pre-warms roughly a screen above/below so a scroll reveals a live (not
  // blank) cell. Once created a runtime STAYS alive on scroll-away - cheap at tens of
  // cells, keeps interactive edits, and avoids re-running onInit; only the DOM paint is
  // gated. ponytail: fixed 600px lead; widen if very tall cells scroll in still-blank.
  const NEAR_MARGIN = 600;
  // Whether a cell is within the live band RIGHT NOW - computed synchronously so the
  // first paint never waits on IntersectionObserver's async first callback. (IO's first
  // delivery is a frame or two out, and is paused entirely while the tab is hidden - so
  // gating the initial paint on it left visible cells blank; the observer below only
  // needs to catch CHANGES as the user scrolls.)
  const isNear = (cell: Element): boolean => {
    const r = cell.getBoundingClientRect();
    return r.bottom > -NEAR_MARGIN && r.top < window.innerHeight + NEAR_MARGIN;
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const i = Number((e.target as HTMLElement).dataset.meCell);
      const m = members[i];
      if (!m) continue;
      m.near = e.isIntersecting;
      if (e.isIntersecting) void ensureRuntime(m, i).then(() => { if (m.needsPaint) schedulePaint(m, i); });
    }
  }, { rootMargin: `${NEAR_MARGIN}px 0px` });
  members.forEach((m, i) => {
    const cell = viewEl.querySelector(`[data-me-cell="${i}"]`);
    if (!cell) return;
    io.observe(cell);
    // Initial live band: mark + build the cells on screen now, so they paint on the
    // first frame instead of waiting for the observer.
    if (isNear(cell)) { m.near = true; void ensureRuntime(m, i); }
  });
  cleanups.push(() => io.disconnect());

  // Shared-input LEADS must be live so the Shared card can read (and fan out from) a
  // real model - create just those up front (usually member 0, already built above if
  // it's on screen). Everything else waits for its cell to scroll into range.
  for (const s of shared) void ensureRuntime(s.lead, members.indexOf(s.lead));

  // ── The combined sidebar ────────────────────────────────────────────────────
  // Shared card: a fan-out "runtime". renderInputs drives it through setInput,
  // getModel AND `manifest` - the dense-sections density hint reads
  // runtime.manifest.render, and a bare { setInput, getModel } adapter (its original
  // contract) threw "Cannot read properties of undefined (reading 'render')" and took
  // the whole /multi view down whenever 2+ sessions shared an input. Any member's
  // manifest satisfies it: the density hint is tool-level and copies share a tool.
  // setInput writes to every session that declares the input.
  const sharedPanel = viewEl.querySelector<PanelEl>('[data-me-shared-panel]');
  let sharedModelPrev: InputModelItem[] | null = null;
  const sharedModel = (): InputModelItem[] =>
    shared.flatMap(({ id, lead }) => {
      // Lead runtimes are created up front, but createRuntime is async - a first
      // syncSidebar can run before it resolves. Skip until it does; ensureRuntime
      // re-runs scheduleSidebar on completion, so the item appears a frame later.
      const item = lead.runtime?.getModel().find(it => it.id === id);
      // showIf deps may live outside the shared set - always show shared items.
      return item ? [{ ...item, showIf: undefined }] : [];
    });
  const fanRuntime = {
    manifest: members[0]?.tool.manifest,
    async setInput(id: string, value: InputValue): Promise<void> {
      // A live cell applies the edit through its runtime (re-render → paint if near); a
      // still-frozen cell buffers it into m.values, so createRuntime seeds it when the
      // cell is finally built (lib/multi-edit-lazy.applySharedEdit, unit-tested).
      for (const m of sharedMembersOf(id)) await applySharedEdit(m, id, value);
    },
    getModel: () => sharedModel(),
  } as unknown as Runtime;

  // Per-panel sync with a focus guard: a rebuild of one card must never steal
  // focus from the control being typed in inside ANOTHER card (renderInputs
  // restores focus by data-input-id, and ids repeat across cards).
  const syncGuarded = (fn: () => void): void => {
    const before = document.activeElement as HTMLElement | null;
    fn();
    const after = document.activeElement as HTMLElement | null;
    if (before && before.isConnected && after !== before) before.focus({ preventScroll: true });
  };

  function syncSidebar(): void {
    sidebarRaf = 0;
    if (sharedPanel && shared.length) {
      syncGuarded(() => { sharedModelPrev = syncInputs(sharedPanel, sharedModel(), sharedModelPrev, fanRuntime, host, () => { /* dirty set in fan-out */ }); });
    }
    members.forEach((m, i) => {
      const card = viewEl.querySelector<HTMLDetailsElement>(`details[data-me-card="${i}"]`);
      if (!card?.open) { m.panelModel = null; return; } // sync lazily on open
      // An opened card needs a live runtime for its model; build it if the cell was
      // still frozen, and re-sync once it arrives (ensureRuntime calls scheduleSidebar).
      const rt = m.runtime;
      if (!rt) { void ensureRuntime(m, i); return; }
      const model = rt.getModel();
      syncGuarded(() => { m.panelModel = syncInputs(m.panelEl, model, m.panelModel, rt, host, () => { m.dirty = true; }); });
    });
  }
  function scheduleSidebar(): void { if (!sidebarRaf) sidebarRaf = requestAnimationFrame(syncSidebar); }
  syncSidebar();
  cleanups.push(() => { if (sidebarRaf) cancelAnimationFrame(sidebarRaf); });
  // renderInputs parks document-level capture dismissers (+ any flatpickr calendars)
  // on EVERY panel it renders - the shared card and each session card. Without these
  // disposer calls every visit to /multi stacked up to three document listeners per
  // panel for the life of the app. Lazily-skipped panels never rendered simply have
  // no disposer to call.
  cleanups.push(() => {
    sharedPanel?._inputsDispose?.();
    members.forEach(m => m.panelEl._inputsDispose?.());
  });

  // Opening a collapsed card renders its (lazily-skipped) panel.
  viewEl.querySelectorAll<HTMLDetailsElement>('details[data-me-card]').forEach(card => {
    card.addEventListener('toggle', () => { if (card.open) scheduleSidebar(); });
  });

  // ── Grid → sidebar: click a canvas, open + scroll to its card ──────────────
  // For a singleInstance cell the click also brings it LIVE (the still becomes an
  // interactive canvas - rotate a 3D model, pan a flythrough); re-clicking the live cell
  // (e.g. the click that ends a rotate-drag) is a no-op and must not re-scroll/flash.
  const activateCell = (i: number): void => {
    const wasActive = !!viewEl.querySelector(`.me-cell[data-me-cell="${i}"]`)?.classList.contains('is-active');
    viewEl.querySelectorAll('.me-cell').forEach((c, ci) => c.classList.toggle('is-active', ci === i));
    if (members[i]?.tool.manifest.singleInstance) activateSingle(i);
    const card = viewEl.querySelector<HTMLDetailsElement>(`details[data-me-card="${i}"]`);
    if (!card || wasActive) return;
    card.open = true;
    scheduleSidebar();
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    card.classList.remove('me-flash'); void card.offsetWidth; card.classList.add('me-flash');
  };
  viewEl.querySelectorAll<HTMLElement>('[data-me-cell]').forEach(cell => {
    const i = Number(cell.dataset.meCell);
    cell.addEventListener('click', () => activateCell(i));
    cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateCell(i); } });
  });
  // Escape releases a live singleInstance cell back to a still (and lets stale siblings
  // catch up on any shared edit made while it was live). [[escape-to-close-overlays]]
  const onEsc = (e: KeyboardEvent): void => { if (e.key === 'Escape' && activeSingle !== null) deactivateSingle(); };
  document.addEventListener('keydown', onEsc);
  cleanups.push(() => document.removeEventListener('keydown', onEsc));

  // ── Preview zoom: scale every card up (scroll to inspect) or down (fit more on
  //    screen). One --me-card-w on the grid drives an auto-fill layout; each cell's
  //    ResizeObserver (above) rescales its canvas to whatever width results. ───────
  const gridEl = viewEl.querySelector<HTMLElement>('[data-me-grid]')!;
  const clampZoom = (w: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(w)));
  // Native aspect ratio per member - the fit calc needs each card's real height.
  const aspects = members.map(m => (m.tool.manifest.render?.width ?? 800) / (m.tool.manifest.render?.height ?? 600));

  // Live column count (auto-fill resolves 1fr tracks to px, space-separated).
  const gridCols = (): number => getComputedStyle(gridEl).gridTemplateColumns.split(' ').filter(Boolean).length || 1;

  /** The largest card width at which every design still clears the viewport height
   * - i.e. the fewest columns whose stacked rows fit without scrolling. */
  function fitCardW(): number {
    const cs = getComputedStyle(gridEl);
    const innerW = gridEl.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const gap = parseFloat(cs.rowGap) || 16;
    const availH = window.innerHeight - gridEl.getBoundingClientRect().top - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    if (!(innerW > 0) || !(availH > 0)) return clampZoom(340); // pre-layout fallback
    const CAP = 44; // caption strip + borders, approx px
    for (let cols = 1; cols <= members.length; cols++) {
      const colW = (innerW - (cols - 1) * gap) / cols;
      if (colW <= 0) continue;
      let total = 0;
      for (let r = 0; r * cols < members.length; r++) {
        let rowH = 0;
        for (let c = 0; c < cols && r * cols + c < members.length; c++) rowH = Math.max(rowH, colW / aspects[r * cols + c]! + CAP);
        total += rowH;
      }
      total += (Math.ceil(members.length / cols) - 1) * gap;
      // fewest cols that fits → biggest cards. The −1px bias keeps auto-fill from
      // rounding a hair down to one FEWER column (which would overflow the fit).
      if (total <= availH) return clampZoom(Math.floor(colW) - 1);
    }
    // Even at max columns the rows overflow - use the tightest (smallest) width.
    return clampZoom(Math.floor((innerW - (members.length - 1) * gap) / members.length) - 1);
  }

  let cardW: number;
  try { const saved = Number(localStorage.getItem(ZOOM_KEY)); cardW = saved >= ZOOM_MIN && saved <= ZOOM_MAX ? saved : fitCardW(); }
  catch { cardW = fitCardW(); }

  // The zoom HUD: Fit first, then −/read/+ (multi-edit's long-standing order - 
  // unlike the tool stage's Fit-last stage-nav). The readout stays a plain,
  // announced-only span (never a control) - clicking a card's readout to fit
  // isn't a gesture anyone's asked for here, so parity keeps it inert.
  const zoomHud = mountZoomHud(viewEl.querySelector<HTMLElement>('[data-me-zoom]')!, {
    ariaLabel: t('Preview size'),
    classes: { btn: 'me-zoom-btn', pct: 'me-zoom-read', fit: 'me-zoom-fit' },
    fitPosition: 'start',
    pctInteractive: false,
    pctAriaLive: 'polite',
    onZoom: (dir) => { cardW = dir > 0 ? cardW * ZOOM_STEP : cardW / ZOOM_STEP; applyZoom(); },
    onFit: () => { cardW = fitCardW(); applyZoom(); },
    outContent: ZOOM_OUT_ICON,
    inContent: ZOOM_IN_ICON,
    fitContent: FIT_ICON,
    outAriaLabel: t('Smaller previews'),
    inAriaLabel: t('Larger previews'),
    fitAriaLabel: t('Fit all on screen'),
    fitTitle: t('Fit all on screen'),
    min: ZOOM_MIN,
    max: ZOOM_MAX,
  });
  cleanups.push(() => zoomHud.destroy());

  const updateReadout = (): void => zoomHud.setReadout(t('{n} across', { n: gridCols() }));
  function applyZoom(): void {
    cardW = clampZoom(cardW);
    gridEl.style.setProperty('--me-card-w', `${cardW}px`);
    try { localStorage.setItem(ZOOM_KEY, String(cardW)); } catch { /* private mode */ }
    zoomHud.setValue(cardW);
    updateReadout();
  }
  applyZoom();

  // Keep "N across" honest as the window resizes (auto-fill reflows columns).
  const zoomRO = new ResizeObserver(() => updateReadout());
  zoomRO.observe(gridEl);
  cleanups.push(() => zoomRO.disconnect());

  // ── Search: filter controls across every card ───────────────────────────────
  const searchEl = viewEl.querySelector<HTMLInputElement>('[data-me-search]');
  searchEl?.addEventListener('input', () => {
    const q = searchEl.value.trim();
    // lib/search matching (plans/99 M3): fold both sides, AND across tokens - 
    // "café" finds "cafe", and "logo width" finds a row carrying both words in
    // any order. Tokenized once per keystroke, not per row.
    const tokens = tokenize(q);
    const hitText = (text: string): boolean =>
      !tokens.length || scoreHaystack([{ text: fold(text), weight: 1 }], tokens) > 0;
    viewEl.querySelectorAll<HTMLDetailsElement>('.me-card').forEach(card => {
      // Ensure lazily-skipped panels exist before filtering them.
      if (q && !card.open) { card.open = true; syncSidebar(); }
      let hits = 0;
      // Filter whole control ROWS - the label text lives on .input-row; the
      // [data-input-id] attribute rides the control element inside it.
      card.querySelectorAll<HTMLElement>('.me-inputs .input-row').forEach(row => {
        const id = row.querySelector<HTMLElement>('[data-input-id]')?.dataset.inputId ?? '';
        const hit = hitText(`${id} ${row.textContent ?? ''}`);
        row.hidden = !hit;
        if (hit) hits++;
      });
      const title = card.querySelector('.me-card-title')?.textContent ?? '';
      const titleHit = tokens.length > 0 && hitText(title);
      if (titleHit) { card.querySelectorAll<HTMLElement>('.me-inputs .input-row').forEach(r => { r.hidden = false; }); hits++; }
      card.classList.toggle('me-card--nomatch', q !== '' && hits === 0);
    });
    if (!q) {
      // Restore the resting state: everything visible, no dimmed cards.
      viewEl.querySelectorAll<HTMLElement>('.me-card .me-inputs .input-row').forEach(r => { r.hidden = false; });
      viewEl.querySelectorAll<HTMLDetailsElement>('.me-card').forEach(c => c.classList.remove('me-card--nomatch'));
    }
  });

  // ── Condensed export blocks + downloads ─────────────────────────────────────
  const exportOpts = (i: number): { format?: string; width?: number; height?: number; unit?: Unit; dpi?: number } => ({
    format: viewEl.querySelector<HTMLSelectElement>(`[data-me-fmt="${i}"]`)?.value,
    width: num(viewEl.querySelector<HTMLInputElement>(`[data-me-w="${i}"]`)?.value),
    height: num(viewEl.querySelector<HTMLInputElement>(`[data-me-h="${i}"]`)?.value),
    unit: (viewEl.querySelector<HTMLSelectElement>(`[data-me-unit="${i}"]`)?.value ?? 'px') as Unit,
    dpi: num(viewEl.querySelector<HTMLInputElement>(`[data-me-dpi="${i}"]`)?.value),
  });
  viewEl.querySelectorAll<HTMLSelectElement>('select[data-me-unit]').forEach(sel => {
    sel.addEventListener('change', () => {
      sel.closest('.me-export')?.querySelector<HTMLElement>('.me-exp-dpi')?.toggleAttribute('hidden', sel.value === 'px');
    });
  });

  // Save one session back to its slot: current model values + this card's export
  // settings, preserving markers this view doesn't edit (profile/bleed/marks…).
  // The thumb is kept as-is; the tool view refreshes it on its own saves.
  async function saveOne(i: number): Promise<void> {
    const m = members[i]!;
    const opts = exportOpts(i);
    // A live cell's runtime is authoritative; a never-created cell saves the values it
    // was seeded with plus any shared edits buffered into m.values (lib/multi-edit-lazy).
    const values = memberSaveValues(m, modelValues);
    const data: SavedStateData = {
      ...m.data,
      ...values,
      __toolId: m.tool.manifest.id,
      __toolVersion: m.tool.manifest.version,
      __export_format: opts.format ?? '',
      __export_width: opts.width != null ? String(opts.width) : '',
      __export_height: opts.height != null ? String(opts.height) : '',
      __export_unit: opts.unit ?? 'px',
      __export_dpi: opts.dpi != null ? String(opts.dpi) : '',
    };
    await state.save(m.slot, data, m.thumb);
    m.data = data;
    m.dirty = false;
  }
  async function saveAll(): Promise<void> {
    for (let i = 0; i < members.length; i++) await saveOne(i);
  }

  // Send every design to Print Sheet as a live tool link - NO render is baked here.
  // Each cell holds the member's canonical embed URL (createRuntime → serializeUrlState
  // → buildEmbedUrl, the same recipe the asset picker's "embed a saved session" uses),
  // which print-sheet re-renders through host.compose.renderUrl on every mount. So the
  // sheet stays live: edit a design later and its cell follows. The seed is handed to
  // print-sheet's mount directly (setPendingToolSeed → the tool view's `seededDirect`
  // path), so N links never have to survive a URL. `once` lays each design out a single
  // time and paginates; the drop-in order is the members' order.
  function toSheet(): void {
    const cells: { art: { id: string } }[] = [];
    for (const m of members) {
      // Prefer the live runtime model (captures unsaved edits); fall back to the
      // seed values for a cell whose runtime was never built.
      const model = m.runtime ? m.runtime.getModel() : buildInputModel(m.tool.manifest, { initial: m.values });
      const fmts = m.tool.manifest.render?.formats ?? [];
      // Vector where the tool offers it (scales cleanly for print), else a raster still.
      const format = fmts.includes('svg') ? 'svg' : (fmts.find(f => ['png', 'jpg', 'jpeg', 'webp'].includes(f)) ?? 'png');
      const url = buildEmbedUrl({ toolId: m.tool.manifest.id, format, query: serializeUrlState(model) });
      // The cell's artwork must be a REF OBJECT ({id}), not a bare string - the runtime's
      // assetRefId reads .id off an object and ignores bare strings, so a bare URL renders
      // an empty grid. The id is the canonical embed URL; resolveAssetRefs re-renders it.
      if (url) cells.push({ art: { id: url } });
    }
    if (!cells.length) { announce(t('Nothing to send.')); return; }
    setPendingToolSeed('print-sheet', { cells, fill: 'once' });
    navigateTo('#/tool/print-sheet');
  }

  // "Batch grid": persist every design's current edits to its slot, then open them all in
  // the batch sheet - one editable row per session (#/batch?s=…, the same selection route
  // Projects' "Edit as sheet" uses). Saving first is what carries the edits: the batch view
  // reads the SAVED sessions. The origin folder rides along so a save there returns home.
  async function toBatch(): Promise<void> {
    try { await saveAll(); }
    catch (err) { console.warn('multi-edit → batch save failed:', err); announce(t("Couldn't save your edits.")); return; }
    const s = slots.map(encodeURIComponent).join(',');
    navigateTo(`#/batch?s=${s}${originFolderId ? `&from=${encodeURIComponent(originFolderId)}` : ''}`);
  }

  // "Save all" opens the shared Save dialog's "Add to a project" picker (the same one
  // the tool view uses), so the sessions LAND somewhere the user can find them - the
  // fix for "Save all does nothing" when multi-edit was reached from the Tools gallery
  // ("Make copies…"), where the copies are loose and there is no current project. The
  // picker defaults to the folder we were opened from, else the folder these sessions
  // already share; "Save" persists every edit AND files every session into the choice.
  async function saveToProject(): Promise<void> {
    const [{ openSaveDialog }, { createFolderStore }] = await Promise.all([
      import('../lib/save-dialog.ts'),
      import('../folders.ts'),
    ]);
    const store = createFolderStore(host as unknown as Parameters<typeof createFolderStore>[0]);
    const folders = await store.list().catch(() => []);
    // Preselect where a re-save should go: our origin folder, else the one folder these
    // sessions already share (null when they're loose or spread across folders).
    const shared = new Set(members.map(m => store.folderOfRef(folders, m.slot)));
    const common = shared.size === 1 ? [...shared][0]! : null;
    openSaveDialog({
      toolName: t('these designs'),
      hasTemplates: false,
      bases: [],
      currentFolderId: originFolderId ?? common,
      listFolders: async () => (await store.list()).map(f => ({ id: f.id, name: f.name })),
      createFolder: async (name) => { const f = await store.create(name, null); return { id: f.id, name: f.name }; },
      saveToLibrary: async (folderId) => {
        await saveAll();
        for (const m of members) await store.moveItem(m.slot, folderId, 'session');
        return true;
      },
      saveTemplate: async () => { /* not offered for a multi-edit save */ },
      announce: (msg) => announce(msg),
      t: (s) => t(s),
    });
  }

  const authorForExport = async () => {
    const profile = await host.profile.get().catch(() => null);
    return (profile as { useDetails?: boolean } | null)?.useDetails ? profile : null;
  };

  // Renders run as a WP-F background job - the same path the Projects view uses
  // (lib/batch-job.ts). The global job toast owns progress, cancel and failure, and the
  // run is deliberately NOT registered in `cleanups`: leaving this view must not kill an
  // export that is already rendering. `exporting` guards only the click, not the run.
  let exporting = false;
  viewEl.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement; // not `t` - that's the i18n lookup
    // Send to Print Sheet navigates away with an in-memory seed - no render, no async
    // work, so it sits before the export busy-guard below.
    if (target.closest<HTMLElement>('[data-me-tosheet]')) { toSheet(); return; }
    if (target.closest<HTMLElement>('[data-me-tobatch]')) { void toBatch(); return; }
    const one = target.closest<HTMLElement>('[data-me-download]');
    const all = target.closest<HTMLElement>('[data-me-downloadall]');
    const save = target.closest<HTMLElement>('[data-me-saveall]');
    if (!one && !all && !save) return;
    if (exporting) return;
    exporting = true;
    const busy = (one ?? all ?? save)!;
    busy.setAttribute('aria-busy', 'true');
    try {
      if (one) {
        // Save first so the standard session-export path (which reads the SAVED
        // slot - same code the Projects tile menu runs) renders what's on screen,
        // with the tool's own filename/format and Content Credentials intact.
        const i = Number(one.dataset.meDownload);
        await saveOne(i);
        const author = await authorForExport();
        startBatchExport(tRaw('Rendering {name}', { name: members[i]!.label }), async (job) => {
          const { renderSessionToFile } = await import('../pro/folder-export.ts');
          return renderSessionToFile(host, members[i]!.slot, { job, author });
        });
      } else if (all) {
        // One nested, C2PA-signed zip via the SAME pipeline as the Projects
        // "Render selection" action - with the optional AES-256 export lock.
        await saveAll();
        const { askExportLock } = await import('../lib/export-lock.ts');
        const { ok, strongPassword, zipLock } = await askExportLock('these designs', true);
        if (!ok) return;
        const author = await authorForExport();
        startBatchExport(t('Rendering these designs'), async (job) => {
          const { exportSelectionAsBatch } = await import('../pro/folder-export.ts');
          return exportSelectionAsBatch(host, {
            label: 'Multi-edit', sessionRefs: members.map(m => m.slot), folderIds: [], allFolders: [],
            job, author, strongPassword, zipLock,
          });
        });
      } else if (save) {
        await saveToProject();
      }
    } catch (err) {
      console.warn('multi-edit action failed:', err);
      announce(t('Something went wrong - see the console.'));
    } finally {
      busy.removeAttribute('aria-busy');
      exporting = false;
    }
  });

  viewEl._cleanup = () => { cleanups.forEach(fn => { try { fn(); } catch { /* teardown */ } }); };
}
