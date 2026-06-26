/**
 * Pro / Batch mode — blocks (repeating field-group) editor.
 *
 * A `blocks` value is an array of records — a mini-table that can't live inside a
 * single grid cell. The grid renders the cell as a trigger (a summary button);
 * activating it opens THIS right-docked panel, which edits one cell's value (or,
 * for a bulk fill, the value applied to every row). The panel is deliberately
 * NON-modal and side-docked rather than a centred dialog: the grid stays visible
 * so you keep your place while editing. The structured array is the value the
 * engine renders and that CSV / paste already round-trip as JSON — no new format.
 *
 * Two commit models, by opts:
 *   • onChange present  → LIVE (per-cell). Every edit/add/remove/reorder calls
 *                         onChange(records); the footer is just "Done". Mirrors the
 *                         single-tool sidebar — what you see in the grid IS applied.
 *   • onChange absent   → EXPLICIT (bulk fill). A working copy + "Apply to N" /
 *                         Cancel; the value is broadcast to every row on apply.
 *
 * Each block is a collapsible card (mirrors the single-tool sidebar): a grip, an
 * expand toggle (collapsed shows a one-line preview — easy to scan/reorder long
 * lists), stacked fields, and remove. Cards reorder by dragging the grip (pointer)
 * or focusing it and using ↑/↓ (keyboard/touch). Per-field controls reuse the
 * local control factory (controls.js), the shared SUSE colour picker for `color`,
 * and the host asset picker for `asset`.
 *
 * Collapse state and the panel width persist for the SESSION: width in a module
 * var (every panel opens at the last-dragged size); collapse via initialExpanded /
 * onUi so the owner can remember it per cell (collapsed by default on first open).
 */
import { controlHtml, readControlValue } from './controls.js';
import { colorFieldHtml, wireColorField } from '../components/color-field.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GRIP_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`;
const CHEV_SVG = `<svg class="pro-blk-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;

function emptyRecord(fields) {
  const r = {};
  for (const f of fields) if (f.default !== undefined) r[f.id] = f.default;
  return r;
}

// Only one panel at a time (it's a singleton dock). The last dragged width sticks
// for the session so re-opening keeps your sizing.
let _active = null;
let _panelWidth = null;
export function closeBlocksPanel() { _active?.dismiss(); }

/**
 * @param {object} opts
 * @param {object} opts.input            blocks declaration ({ id, label, fields })
 * @param {Array}  opts.value            current records (array of { fieldId: value })
 * @param {object} opts.host             capability bridge (asset picker)
 * @param {boolean} opts.assetPicker     whether host.assets.pick is available
 * @param {(records:Array)=>void} [opts.onChange]  live mode: called on every change
 * @param {boolean[]|null} [opts.initialExpanded]  per-block expanded state; null/short ⇒ all collapsed
 * @param {(expanded:boolean[])=>void} [opts.onUi]  called when collapse state changes
 * @param {string} [opts.applyLabel]     explicit mode: apply-button label
 * @returns {Promise<Array|null>}        explicit: records / null. live: final records.
 */
export function openBlocksEditor({ input, value, host, assetPicker = false, onChange, initialExpanded, onUi, applyLabel = 'Save' }) {
  return new Promise((resolve) => {
    if (_active) _active.dismiss();

    const live = typeof onChange === 'function';
    const fields = input.fields ?? [];
    let records = Array.isArray(value) ? value.map((r) => ({ ...r })) : [];
    if (!records.length) records = [emptyRecord(fields)];
    // Collapsed by default on first open — but a lone block is auto-expanded (no
    // point hiding the only thing to edit). Restore the owner's remembered state
    // when its length matches the current blocks.
    let expanded = Array.isArray(initialExpanded) && initialExpanded.length === records.length
      ? initialExpanded.slice()
      : records.map(() => records.length === 1);

    const commit = () => { if (live) onChange(records.map((r) => ({ ...r }))); };
    const persistUi = () => { onUi?.(expanded.slice()); };

    const panel = document.createElement('aside');
    panel.className = 'pro-blocks-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `Edit ${input.label ?? input.id}`);
    if (_panelWidth) panel.style.width = `${_panelWidth}px`;
    panel.innerHTML = `
      <div class="pro-blk-resize" data-blk-resize title="Drag to resize" aria-hidden="true"></div>
      <div class="pro-blk-head">
        <h2 class="pro-blk-title">${esc(input.label ?? input.id)}</h2>
        <button type="button" class="pro-blk-x" data-blk-close aria-label="Close">✕</button>
      </div>
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
    const rowsEl = panel.querySelector('[data-blk-rows]');

    const fieldOf = (id) => fields.find((f) => f.id === id);

    function fieldControl(f, fv, i) {
      if (f.type === 'color') {
        return colorFieldHtml(`b${i}~${f.id}`, fv || '', { float: true, swatchesOnly: f.swatchesOnly === true });
      }
      if (f.type === 'asset') {
        const ref = fv && typeof fv === 'object' ? fv : null;
        const name = ref ? esc(ref.meta?.name || ref.id || 'Selected') : 'Choose…';
        const thumb = ref && ref.url ? `<img class="pro-asset-thumb" src="${esc(ref.url)}" alt="">` : '';
        return `<button type="button" class="pro-control pro-blk-asset${ref ? ' is-set' : ''}" data-blk-asset data-bi="${i}" data-bf="${esc(f.id)}">${thumb}<span class="pro-asset-name">${name}</span></button>`;
      }
      return controlHtml(f, fv, `data-blk-field data-bi="${i}" data-bf="${esc(f.id)}"`);
    }

    function cardHtml(rec, i) {
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

    function renderRows() {
      rowsEl.innerHTML = records.map((rec, i) => cardHtml(rec, i)).join('');
      wireColorField(rowsEl, {
        onChange: (id, v) => {
          const sep = id.indexOf('~');
          const i = +id.slice(1, sep);
          if (records[i]) { records[i][id.slice(sep + 1)] = v; commit(); }
        },
      });
    }
    renderRows();

    // Standard field edits update the model in place (no re-render → focus is kept).
    const onFieldEdit = (e) => {
      const el = e.target.closest('[data-blk-field]');
      if (!el) return;
      const i = +el.dataset.bi, f = fieldOf(el.dataset.bf);
      if (records[i] && f) {
        records[i][f.id] = readControlValue(el, f);
        // Keep the collapsed preview live as you edit the first field.
        if (f.id === fields[0]?.id) {
          const prevEl = rowsEl.querySelector(`.pro-blk-card[data-bi="${i}"] .pro-blk-card-prev`);
          if (prevEl) prevEl.textContent = String(records[i][f.id] ?? '');
        }
        commit();
      }
    };
    rowsEl.addEventListener('input', onFieldEdit);
    rowsEl.addEventListener('change', onFieldEdit);

    // Toggle / remove / asset-pick (delegated; survives re-render).
    rowsEl.addEventListener('click', async (e) => {
      const tog = e.target.closest('[data-blk-toggle]');
      if (tog) {
        const i = +tog.dataset.bi;
        expanded[i] = !expanded[i];
        tog.closest('.pro-blk-card').classList.toggle('is-open', expanded[i]);
        tog.setAttribute('aria-expanded', expanded[i] ? 'true' : 'false');
        tog.title = `${expanded[i] ? 'Collapse' : 'Expand'} block`;
        persistUi();
        return;
      }
      const del = e.target.closest('[data-blk-del]');
      if (del) {
        const i = +del.dataset.bi;
        records.splice(i, 1); expanded.splice(i, 1);
        if (!records.length) { records.push(emptyRecord(fields)); expanded.push(true); }
        renderRows(); commit(); persistUi();
        return;
      }
      const asset = e.target.closest('[data-blk-asset]');
      if (asset && assetPicker) {
        const i = +asset.dataset.bi, f = fieldOf(asset.dataset.bf);
        const ref = await host.assets.pick({
          title: `Choose ${f.label ?? f.id}`,
          type: f.assetType === 'any' ? undefined : f.assetType,
          allowUpload: f.allowUpload === true,
          current: records[i]?.[f.id]?.id,
        });
        if (ref && records[i]) { records[i][f.id] = ref; renderRows(); commit(); }
      }
    });
    panel.querySelector('[data-blk-add]').addEventListener('click', () => {
      records.push(emptyRecord(fields)); expanded.push(true); // newly added → open to edit
      renderRows(); commit(); persistUi();
      rowsEl.lastElementChild?.querySelector('.pro-control, .color-trigger')?.focus();
    });

    // ── Reorder: drag the grip (pointer) ────────────────────────────────────
    let drag = null;
    rowsEl.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('[data-blk-grip]');
      if (!grip || e.button !== 0) return;
      const card = grip.closest('.pro-blk-card');
      if (!card) return;
      drag = { card };
      card.classList.add('is-dragging');
      rowsEl.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    rowsEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      let ref = null;
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
      const order = [...rowsEl.querySelectorAll('.pro-blk-card')].map((c) => +c.dataset.bi);
      records = order.map((i) => records[i]);
      expanded = order.map((i) => expanded[i]);
      drag = null;
      renderRows(); commit(); persistUi();
    };
    rowsEl.addEventListener('pointerup', endDrag);
    rowsEl.addEventListener('pointercancel', endDrag);

    // ── Reorder: grip focused + ↑/↓ (keyboard / accessible) ─────────────────
    rowsEl.addEventListener('keydown', (e) => {
      const grip = e.target.closest('[data-blk-grip]');
      if (!grip) return;
      const i = +grip.dataset.bi;
      const j = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
      if (j < 0) return;
      e.preventDefault();
      if (j >= records.length) return;
      [records[i], records[j]] = [records[j], records[i]];
      [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
      renderRows(); commit(); persistUi();
      rowsEl.querySelector(`[data-blk-grip][data-bi="${j}"]`)?.focus();
    });

    // ── Resize: drag the panel's left edge ──────────────────────────────────
    const resizeEl = panel.querySelector('[data-blk-resize]');
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

    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); done(); } }
    document.addEventListener('keydown', onKey, true);
    panel.querySelectorAll('[data-blk-close]').forEach((b) => b.addEventListener('click', done));
    panel.querySelectorAll('[data-blk-cancel]').forEach((b) => b.addEventListener('click', done));
    panel.querySelector('[data-blk-apply]')?.addEventListener('click', apply);

    setTimeout(() => { (rowsEl.querySelector('.pro-blk-toggle') ?? rowsEl.querySelector('.pro-control'))?.focus(); }, 0);
  });
}
