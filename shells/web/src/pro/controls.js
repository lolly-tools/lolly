/**
 * Pro / Batch mode — input control factory for grid cells and the bulk-write
 * popover. A deliberately small subset of the single-tool view's controls,
 * driven only by an input declaration (the engine manifest shape).
 *
 * This does NOT reuse tool.js's controlHtml (which is tightly coupled to the
 * single-tool sidebar: flatpickr, palette swatches, blocks, click-to-focus).
 * Keeping a focused renderer here means the single-tool view stays untouched
 * and this feature can be lifted out cleanly.
 *
 * Each control writes its current value into the DOM only; reading back is done
 * via readControlValue(), which coerces by type. Asset cells delegate to the
 * host picker (passed in by the caller) rather than embedding picker UI.
 */
import { optionValue } from './model.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * HTML for an editable control bound to one input declaration + current value.
 * `attrs` is a string of extra attributes (e.g. data-row / data-col hooks).
 * Returns '' for types that have no inline control (caller renders read-only).
 */
export function controlHtml(input, value, attrs = '') {
  const t = input.type;
  const common = `class="pro-control" data-type="${esc(t)}" ${attrs}`;

  switch (t) {
    case 'longtext':
      return `<textarea ${common} rows="2"${input.maxLength ? ` maxlength="${input.maxLength}"` : ''} placeholder="${esc(input.placeholder ?? '')}">${esc(value)}</textarea>`;

    case 'number': {
      const min = input.min !== undefined ? ` min="${input.min}"` : '';
      const max = input.max !== undefined ? ` max="${input.max}"` : '';
      const step = input.step !== undefined ? ` step="${input.step}"` : '';
      return `<input ${common} type="number"${min}${max}${step} value="${esc(value)}">`;
    }

    case 'boolean':
      return `<input ${common} type="checkbox"${value ? ' checked' : ''}>`;

    // NOTE: 'color' is intentionally not handled here — colour cells use the
    // shared SUSE picker (components/color-field.js), rendered in grid.js.

    case 'select': {
      const opts = (input.options ?? []).map(o => {
        const v = optionValue(o);
        const label = o && typeof o === 'object' ? (o.label ?? v) : v;
        return `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
      }).join('');
      return `<select ${common}>${opts}</select>`;
    }

    case 'date':
      return `<input ${common} type="date" value="${esc(value)}">`;
    case 'time':
      return `<input ${common} type="time" value="${esc(value)}">`;
    case 'datetime-local':
      return `<input ${common} type="datetime-local" value="${esc(value)}">`;

    case 'asset': {
      // The picker is opened on click by the grid; we only show current state.
      // A picked asset shows its thumbnail + name and flags the cell as selected
      // (data-selected) so the grid can make a filled image field obvious.
      const ref = value && typeof value === 'object' ? value : null;
      if (!ref || !(ref.url || ref.id)) {
        return `<button type="button" ${common} data-asset-pick>Choose…</button>`;
      }
      const name = ref.meta?.name || ref.id || 'Selected';
      const thumb = ref.url ? `<img class="pro-asset-thumb" src="${esc(ref.url)}" alt="">` : '';
      // Trailing badge: a ✓ that turns into a clickable ✕ on hover, so the image
      // can be cleared without opening the picker (handled by the grid click
      // delegate, which checks [data-asset-clear] before [data-asset-pick]).
      const clear = `<span class="pro-asset-clear" data-asset-clear role="button" aria-label="Remove image" title="Remove image"></span>`;
      return `<button type="button" ${common} data-asset-pick data-selected>${thumb}<span class="pro-asset-name">${esc(name)}</span>${clear}</button>`;
    }

    case 'url':
      return `<input ${common} type="url" value="${esc(value)}" placeholder="${esc(input.placeholder ?? 'https://…')}">`;

    case 'vector': {
      // One compound cell = N number sub-fields. The container carries the cell
      // hooks (data-cell/row/col via `attrs`); each sub-input is a .pro-control so
      // grid-nav focuses the first on edit, and readControlValue() reads them all.
      const fields = input.fields ?? [];
      const v = (value && typeof value === 'object') ? value : {};
      const sub = fields.map(f => {
        const fv = v[f.id] ?? f.default ?? f.min ?? 0;
        const min = f.min !== undefined ? ` min="${f.min}"` : '';
        const max = f.max !== undefined ? ` max="${f.max}"` : '';
        return `<label class="pro-vec-field" title="${esc(f.label ?? f.id)}"><span class="pro-vec-label">${esc(f.label ?? f.id)}</span><input class="pro-control pro-vec-num" type="number" data-vec-field="${esc(f.id)}"${min}${max} step="${f.step ?? 1}" value="${esc(fv)}"></label>`;
      }).join('');
      return `<div class="pro-vector" data-type="vector" data-vector ${attrs}>${sub}</div>`;
    }

    case 'text':
    default:
      return `<input ${common} type="text"${input.maxLength ? ` maxlength="${input.maxLength}"` : ''} value="${esc(value)}" placeholder="${esc(input.placeholder ?? '')}">`;
  }
}

/** Read + coerce a control element's value by its declared type. */
export function readControlValue(el, input) {
  switch (input.type) {
    case 'boolean':
      return !!el.checked;
    case 'number': {
      if (el.value === '') return input.default ?? 0;
      const n = Number(el.value);
      return Number.isNaN(n) ? (input.default ?? 0) : n;
    }
    case 'vector': {
      // `el` is the changed sub-input; climb to the container and read every
      // field so the whole { fieldId: number } object is committed at once.
      const root = el.closest?.('[data-vector]') ?? el;
      const byId = {};
      root.querySelectorAll?.('[data-vec-field]').forEach(s => { byId[s.dataset.vecField] = s; });
      const out = {};
      for (const f of input.fields ?? []) {
        const s = byId[f.id];
        let n = s && s.value !== '' ? Number(s.value) : (f.default ?? 0);
        if (Number.isNaN(n)) n = f.default ?? 0;
        out[f.id] = n;
      }
      return out;
    }
    default:
      return el.value;
  }
}
