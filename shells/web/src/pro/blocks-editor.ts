// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — the blocks (repeating field-group) editor.
 *
 * A `blocks` value is an array of records — a mini-table that can't live inside a
 * single grid cell. The grid renders the cell as a trigger (a summary button);
 * activating it opens THIS right-docked panel, which edits one cell's value (or,
 * for a bulk fill, a value applied to every row). The panel is deliberately
 * NON-modal and side-docked rather than a centred dialog: the grid stays visible
 * so you keep your place while editing. The structured array value is what the
 * engine renders and what CSV / paste already round-trip as JSON — no new format.
 *
 * Two commit models, chosen by opts:
 *  • onChange present → LIVE (per-cell). Every edit/add/remove/reorder calls
 *    onChange(records); the footer is just "Done". Mirrors the
 *    single-tool sidebar — what you see in the grid IS applied.
 *  • onChange absent → EXPLICIT (bulk fill). A working copy + "Apply to N" /
 *    Cancel; the value is broadcast to every row on apply.
 *
 * Each block is a collapsible card (mirrors the single-tool sidebar): a grip, an
 * expand toggle (collapsed shows a one-line preview — easy to scan/reorder long
 * lists), the stacked fields, and remove. Cards reorder by dragging the grip (pointer)
 * or by focusing it and using ↑/↓ (keyboard/touch). Per-field controls reuse the
 * local control factory (controls.js), the shared SUSE colour picker for `color`, and
 * the host asset picker for `asset`.
 *
 * Collapse state and panel width persist for the SESSION: the width in a module
 * var (every panel opens at the last-dragged size); collapse via initialExpanded /
 * onUi so the owner can remember it per cell (collapsed by default on first open).
 */
import { controlHtml, readControlValue } from './controls.ts';
import { colorFieldHtml, wireColorField } from '../components/color-field.ts';
import type { InputSpec, InputValue, BlockFieldSpec, HostV1 } from '@lolly/engine';

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Read a property off an untrusted structured value (model value boundary). */
const readProp = (o: unknown, k: string): unknown =>
  (o && typeof o === 'object' ? Reflect.get(o, k) : undefined);

/** Narrow an untrusted value to a string. */
const asStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** One block record: a field-id → value map. */
type BlockRecord = Record<string, InputValue | undefined>;

/** The asset kinds the picker understands (mirrors AssetQuery.type). */
type AssetKind = 'vector' | 'raster' | 'video' | 'palette' | 'font';
function asAssetKind(v: unknown): AssetKind | undefined {
  switch (v) {
    case 'vector': case 'raster': case 'video': case 'palette': case 'font': return v;
    default: return undefined;
  }
}

// Stop waiting on a single preview render after this long. The engine's own
// quiescence cap is ~8s; this is the outer bound for the whole render+export, so a
// heavy template degrades to a "skipped" message instead of a stuck spinner.
const PREVIEW_TIMEOUT_MS = 15000;

const GRIP_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`;
const CHEV_SVG = `<svg class="pro-blk-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
const EYE_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;

function emptyRecord(fields: BlockFieldSpec[]): BlockRecord {
  const r: BlockRecord = {};
  for (const f of fields) if (f.default !== undefined) r[f.id] = f.default;
  return r;
}

/** Shallow-clone an untrusted stored record (JSON boundary). */
function cloneRecord(r: unknown): BlockRecord {
  return r && typeof r === 'object' && !Array.isArray(r) ? Object.fromEntries(Object.entries(r)) : {};
}

// Only one panel at a time (it's a singleton dock). The last dragged width sticks
// for the session so re-opening keeps your sizing.
let _active: { dismiss: () => void } | null = null;
let _panelWidth: number | null = null;
export function closeBlocksPanel(): void { _active?.dismiss(); }

/** Options for opening the blocks editor. */
export interface BlocksEditorOpts {
  input: InputSpec;
  value: InputValue;
  host: HostV1;
  assetPicker?: boolean;
  /** live mode: called on every change. */
  onChange?: (records: BlockRecord[]) => void;
  /** per-block expanded state; null/short ⇒ all collapsed. */
  initialExpanded?: boolean[] | null;
  /** called when collapse state changes. */
  onUi?: (expanded: boolean[]) => void;
  /** explicit mode: apply-button label. */
  applyLabel?: string;
  /** when present, the panel shows a live preview pane. */
  renderPreview?: (records: BlockRecord[]) => Promise<{ blob: Blob } | null>;
}

export function openBlocksEditor({ input, value, host, assetPicker = false, onChange, initialExpanded, onUi, applyLabel = 'Save', renderPreview }: BlocksEditorOpts): Promise<BlockRecord[] | null> {
  return new Promise((resolve) => {
    if (_active) _active.dismiss();

    const live = typeof onChange === 'function';
    const hasPreview = typeof renderPreview === 'function';
    const fields = input.fields ?? [];
    let records: BlockRecord[] = Array.isArray(value) ? value.map((r) => cloneRecord(r)) : [];
    if (!records.length) records = [emptyRecord(fields)];
    // Collapsed by default on first open — but a lone block is auto-expanded (no
    // point hiding the only thing to edit). Restore the owner's remembered state
    // when its length matches the current blocks.
    let expanded = Array.isArray(initialExpanded) && initialExpanded.length === records.length
      ? initialExpanded.slice()
      : records.map(() => records.length === 1);

    const commit = () => { if (onChange) onChange(records.map((r) => ({ ...r }))); schedulePreview(); };
    const persistUi = () => { onUi?.(expanded.slice()); };

    const panel = document.createElement('aside');
    panel.className = 'pro-blocks-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `Edit ${input.label ?? input.id}`);
    if (_panelWidth) panel.style.width = `${_panelWidth}px`;
    // Live-preview pane: a render of the row as the blocks change, so a user
    // doesn't have to keep opening the tool. Closable via its own ✕; the head's
    // eye button re-opens it. Only present when the owner supplies renderPreview.
    const previewToggle = hasPreview
      ? `<button type="button" class="pro-blk-prev-toggle" data-blk-prev-toggle title="Show / hide live preview" aria-label="Toggle live preview" aria-pressed="true">${EYE_SVG}</button>`
      : '';
    const previewPane = hasPreview
      ? `<div class="pro-blk-preview" data-blk-preview>
           <div class="pro-blk-preview-head">
             <span class="pro-blk-preview-title">Live preview</span>
             <button type="button" class="pro-blk-preview-x" data-blk-prev-close title="Close preview" aria-label="Close preview">✕</button>
           </div>
           <div class="pro-blk-preview-stage" data-blk-prev-stage>
             <p class="pro-blk-preview-msg">Rendering…</p>
           </div>
         </div>`
      : '';
    panel.innerHTML = `
      <div class="pro-blk-resize" data-blk-resize title="Drag to resize" aria-hidden="true"></div>
      <div class="pro-blk-head">
        <h2 class="pro-blk-title">${esc(input.label ?? input.id)}</h2>
        <div class="pro-blk-head-actions">
          ${previewToggle}
          <button type="button" class="pro-blk-x" data-blk-close aria-label="Close">✕</button>
        </div>
      </div>
      ${previewPane}
      <div class="pro-blk-body">
        <div class="pro-blk-cards" data-blk-rows></div>
        <button type="button" class="pro-btn pro-blk-add" data-blk-add>+ Add block</button>
      </div>
      <div class="pro-blk-foot">
        ${live
          ? `<button type="button" class="pro-btn pro-btn--primary" data-blk-close>Done</button>`
          : `<button type="button" class="pro-btn" data-blk-cancel>Cancel</button>
             <button type="button" class="pro-btn pro-btn--primary" data-blk-apply>${esc(applyLabel)}</button>`}
      </div>`;
    document.body.appendChild(panel);
    const rowsEl = panel.querySelector<HTMLElement>('[data-blk-rows]');
    const resizeEl = panel.querySelector<HTMLElement>('[data-blk-resize]');
    const addBtn = panel.querySelector<HTMLElement>('[data-blk-add]');
    if (!rowsEl || !resizeEl || !addBtn) throw new Error('blocks panel failed to render');

    // ── Live preview ─────────────────────────────────────────────────────────
    // Debounced + single-flight: a burst of keystrokes collapses to one render,
    // and while one render is in flight further changes mark it dirty and re-run
    // once on completion (never overlapping). Stale results after close/teardown
    // are ignored. Renders only while the pane is open, so closing it is free.
    const previewPaneEl = panel.querySelector<HTMLElement>('[data-blk-preview]');
    const previewStageEl = panel.querySelector<HTMLElement>('[data-blk-prev-stage]');
    const previewToggleEl = panel.querySelector<HTMLElement>('[data-blk-prev-toggle]');
    let previewOpen = hasPreview, previewBusy = false, previewDirty = false;
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    let previewUrl: string | null = null;

    function setPreviewMsg(text: string, isErr = false) {
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      if (previewStageEl) previewStageEl.innerHTML = `<p class="pro-blk-preview-msg${isErr ? ' is-error' : ''}">${esc(text)}</p>`;
    }
    function showPreviewBlob(blob: Blob) {
      const url = URL.createObjectURL(blob);
      if (previewStageEl) previewStageEl.innerHTML = blob.type === 'application/pdf'
        ? `<iframe class="pro-blk-preview-frame" src="${url}" title="Live preview"></iframe>`
        : `<img class="pro-blk-preview-img" src="${url}" alt="Live preview of your blocks">`;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = url;
    }
    async function runPreview() {
      if (!hasPreview || !previewOpen || !renderPreview || !previewPaneEl) return;
      if (previewBusy) { previewDirty = true; return; }    // coalesce: re-run after the current one
      previewBusy = true;
      previewPaneEl.classList.add('is-loading');
      try {
        // Guard against a slow/heavy tool wedging the preview in "Rendering…"
        // forever (the underlying render can't be cancelled, but its stage is
        // self-cleaning, so we just stop waiting and let the user keep editing).
        const res = await Promise.race([
          renderPreview(records.map((r) => ({ ...r }))),
          new Promise<{ blob: Blob } | null>((_, reject) => setTimeout(() => reject(new Error('timeout')), PREVIEW_TIMEOUT_MS)),
        ]);
        if (previewOpen) (res && res.blob) ? showPreviewBlob(res.blob) : setPreviewMsg('Nothing to preview yet.');
      } catch (err) {
        const detail = asStr(readProp(err, 'message'));
        if (previewOpen) setPreviewMsg(
          detail === 'timeout' ? 'This template is slow to render — preview skipped.'
            : (detail || 'Preview failed to render.'), true);
      } finally {
        previewBusy = false;
        previewPaneEl.classList.remove('is-loading');
        if (previewDirty && previewOpen) { previewDirty = false; runPreview(); }
      }
    }
    function schedulePreview() {
      if (!hasPreview || !previewOpen) return;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(runPreview, 400);
    }
    function setPreviewOpen(open: boolean) {
      previewOpen = open;
      if (previewPaneEl) previewPaneEl.hidden = !open;
      previewToggleEl?.setAttribute('aria-pressed', open ? 'true' : 'false');
      if (open) runPreview();
      else { clearTimeout(previewTimer); }
    }
    previewToggleEl?.addEventListener('click', () => setPreviewOpen(!previewOpen));
    panel.querySelector('[data-blk-prev-close]')?.addEventListener('click', () => setPreviewOpen(false));

    const fieldOf = (id: string): BlockFieldSpec | undefined => fields.find((f) => f.id === id);

    function fieldControl(f: BlockFieldSpec, fv: InputValue | undefined, i: number): string {
      if (f.type === 'color') {
        return colorFieldHtml(`b${i}~${f.id}`, fv || '', { float: true, swatchesOnly: readProp(f, 'swatchesOnly') === true });
      }
      if (f.type === 'asset') {
        const isObj = !!fv && typeof fv === 'object';
        const name = isObj ? esc(readProp(readProp(fv, 'meta'), 'name') || readProp(fv, 'id') || 'Selected') : 'Choose…';
        const url = asStr(readProp(fv, 'url'));
        const thumb = isObj && url ? `<img class="pro-asset-thumb" src="${esc(url)}" alt="">` : '';
        return `<button type="button" class="pro-control pro-blk-asset${isObj ? ' is-set' : ''}" data-blk-asset data-bi="${i}" data-bf="${esc(f.id)}">${thumb}<span class="pro-asset-name">${name}</span></button>`;
      }
      return controlHtml(f, fv, `data-blk-field data-bi="${i}" data-bf="${esc(f.id)}"`);
    }

    function cardHtml(rec: BlockRecord, i: number): string {
      const body = fields.map((f) => {
        const fv = rec[f.id] ?? f.default ?? '';
        return `<label class="pro-blk-field"><span class="pro-blk-flabel">${esc(f.label ?? f.id)}</span>${fieldControl(f, fv, i)}</label>`;
      }).join('');
      const firstId = fields[0]?.id;
      const prev = firstId ? String(rec[firstId] ?? '').trim() : '';
      return `<div class="pro-blk-card${expanded[i] ? ' is-open' : ''}" data-bi="${i}">
        <div class="pro-blk-card-head">
          <button type="button" class="pro-blk-grip" data-blk-grip data-bi="${i}" title="Drag to reorder — or focus and use ↑ / ↓" aria-label="Reorder block ${i + 1} of ${records.length}">${GRIP_SVG}</button>
          <button type="button" class="pro-blk-toggle" data-blk-toggle data-bi="${i}" aria-expanded="${expanded[i] ? 'true' : 'false'}" title="${expanded[i] ? 'Collapse' : 'Expand'} block">
            ${CHEV_SVG}<span class="pro-blk-card-n">Block ${i + 1}</span>${prev ? `<span class="pro-blk-card-prev">${esc(prev)}</span>` : ''}
          </button>
          <button type="button" class="pro-blk-del" data-blk-del data-bi="${i}" title="Remove block" aria-label="Remove block ${i + 1}">✕</button>
        </div>
        <div class="pro-blk-card-body">${body}</div>
      </div>`;
    }

    const renderRows = () => {
      rowsEl.innerHTML = records.map((rec, i) => cardHtml(rec, i)).join('');
      wireColorField(rowsEl, {
        onChange: (id, v) => {
          const sep = id.indexOf('~');
          const i = Number(id.slice(1, sep));
          const rec = records[i];
          if (rec) { rec[id.slice(sep + 1)] = v; commit(); }
        },
      });
    }
    renderRows();

    // Standard field edits update the model in place (no re-render → focus is kept).
    const onFieldEdit = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const el = target.closest<HTMLElement>('[data-blk-field]');
      if (!el) return;
      const i = Number(el.dataset.bi);
      const f = fieldOf(el.dataset.bf ?? '');
      const rec = records[i];
      if (rec && f) {
        rec[f.id] = readControlValue(el, f);
        // Keep the collapsed preview live as you edit the first field.
        if (f.id === fields[0]?.id) {
          const prevEl = rowsEl.querySelector(`.pro-blk-card[data-bi="${i}"] .pro-blk-card-prev`);
          if (prevEl) prevEl.textContent = String(rec[f.id] ?? '');
        }
        commit();
      }
    };
    rowsEl.addEventListener('input', onFieldEdit);
    rowsEl.addEventListener('change', onFieldEdit);

    // Toggle / remove / asset-pick (delegated; survives re-render).
    rowsEl.addEventListener('click', async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const tog = target.closest<HTMLElement>('[data-blk-toggle]');
      if (tog) {
        const i = Number(tog.dataset.bi);
        const open = !expanded[i];
        expanded[i] = open;
        tog.closest('.pro-blk-card')?.classList.toggle('is-open', open);
        tog.setAttribute('aria-expanded', open ? 'true' : 'false');
        tog.title = `${open ? 'Collapse' : 'Expand'} block`;
        persistUi();
        return;
      }
      const del = target.closest<HTMLElement>('[data-blk-del]');
      if (del) {
        const i = Number(del.dataset.bi);
        records.splice(i, 1); expanded.splice(i, 1);
        if (!records.length) { records.push(emptyRecord(fields)); expanded.push(true); }
        renderRows(); commit(); persistUi();
        return;
      }
      const asset = target.closest<HTMLElement>('[data-blk-asset]');
      if (asset && assetPicker) {
        const i = Number(asset.dataset.bi);
        const f = fieldOf(asset.dataset.bf ?? '');
        if (!f) return;
        const ref = await host.assets.pick({
          title: `Choose ${f.label ?? f.id}`,
          type: f.assetType === 'any' ? undefined : asAssetKind(f.assetType),
          allowUpload: f.allowUpload === true,
          current: asStr(readProp(records[i]?.[f.id], 'id')),
        });
        const rec = records[i];
        if (ref && rec) { rec[f.id] = ref; renderRows(); commit(); }
      }
    });
    addBtn.addEventListener('click', () => {
      records.push(emptyRecord(fields)); expanded.push(true); // newly added → open to edit
      renderRows(); commit(); persistUi();
      rowsEl.lastElementChild?.querySelector<HTMLElement>('.pro-control, .color-trigger')?.focus();
    });

    // ── Reorder: drag the grip (pointer) ────────────────────────────────────
    let drag: { card: HTMLElement } | null = null;
    rowsEl.addEventListener('pointerdown', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const grip = target.closest('[data-blk-grip]');
      if (!grip || e.button !== 0) return;
      const card = grip.closest<HTMLElement>('.pro-blk-card');
      if (!card) return;
      drag = { card };
      card.classList.add('is-dragging');
      rowsEl.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    rowsEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      let ref: Element | null = null;
      for (const c of rowsEl.querySelectorAll('.pro-blk-card')) {
        if (c === drag.card) continue;
        const r = c.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { ref = c; break; }
      }
      if (ref) { if (drag.card.nextSibling !== ref) rowsEl.insertBefore(drag.card, ref); }
      else if (rowsEl.lastElementChild !== drag.card) rowsEl.appendChild(drag.card);
    });
    const endDrag = () => {
      if (!drag) return;
      drag.card.classList.remove('is-dragging');
      const order = [...rowsEl.querySelectorAll<HTMLElement>('.pro-blk-card')].map((c) => Number(c.dataset.bi));
      records = order.map((i) => records[i] ?? {});
      expanded = order.map((i) => expanded[i] ?? false);
      drag = null;
      renderRows(); commit(); persistUi();
    };
    rowsEl.addEventListener('pointerup', endDrag);
    rowsEl.addEventListener('pointercancel', endDrag);

    // ── Reorder: grip focused + ↑/↓ (keyboard / accessible) ─────────────────
    rowsEl.addEventListener('keydown', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const grip = target.closest<HTMLElement>('[data-blk-grip]');
      if (!grip) return;
      const i = Number(grip.dataset.bi);
      const j = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
      if (j < 0) return;
      e.preventDefault();
      if (j >= records.length) return;
      const ri = records[i], rj = records[j];
      if (ri !== undefined && rj !== undefined) { records[i] = rj; records[j] = ri; }
      const ei = expanded[i], ej = expanded[j];
      if (ei !== undefined && ej !== undefined) { expanded[i] = ej; expanded[j] = ei; }
      renderRows(); commit(); persistUi();
      rowsEl.querySelector<HTMLElement>(`[data-blk-grip][data-bi="${j}"]`)?.focus();
    });

    // ── Resize: drag the panel's left edge ──────────────────────────────────
    let rz = false;
    resizeEl.addEventListener('pointerdown', (e) => {
      rz = true; resizeEl.setPointerCapture?.(e.pointerId);
      document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    resizeEl.addEventListener('pointermove', (e) => {
      if (!rz) return;
      const w = Math.max(300, Math.min(window.innerWidth - e.clientX, window.innerWidth - 100));
      panel.style.width = `${w}px`;
      _panelWidth = w;
    });
    const endRz = () => { if (!rz) return; rz = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    resizeEl.addEventListener('pointerup', endRz);
    resizeEl.addEventListener('pointercancel', endRz);

    // ── Lifecycle ───────────────────────────────────────────────────────────
    function teardown() {
      if (_active !== self) return;
      document.removeEventListener('keydown', onKey, true);
      clearTimeout(previewTimer);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      previewOpen = false; // ignore any in-flight render that resolves after close
      panel.remove();
      _active = null;
    }
    function done() { teardown(); resolve(live ? records : null); }
    function apply() {
      const clean = records.filter((r) => fields.some((f) => {
        const v = r[f.id];
        return v !== undefined && v !== '' && v !== null;
      }));
      teardown(); resolve(clean);
    }
    const self = { dismiss: done };
    _active = self;

    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); done(); } }
    document.addEventListener('keydown', onKey, true);
    panel.querySelectorAll('[data-blk-close]').forEach((b) => b.addEventListener('click', done));
    panel.querySelectorAll('[data-blk-cancel]').forEach((b) => b.addEventListener('click', done));
    panel.querySelector('[data-blk-apply]')?.addEventListener('click', apply);

    setTimeout(() => { (rowsEl.querySelector<HTMLElement>('.pro-blk-toggle') ?? rowsEl.querySelector<HTMLElement>('.pro-control'))?.focus(); }, 0);
    if (hasPreview) runPreview(); // first paint right away; later edits are debounced
  });
}
