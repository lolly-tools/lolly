// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — grid renderer (HTML generation only).
 *
 * Pure-ish: given the batch state + derived columns, it returns the table HTML.
 * All state mutation and event wiring lives in index.js, which owns the model.
 * Keeping rendering separate from wiring makes the data-flow easy to follow and
 * the whole feature easy to delete.
 *
 * Layout: the table is `table-layout: fixed`, so columns stay at explicit widths
 * (narrow by default) and the user widens them by dragging header edges. Row
 * heights and column widths persist in state and are re-applied here on render.
 */
import { cellInput, isCellEditable } from './model.js';
import { controlHtml } from './controls.js';
import { colorFieldHtml } from '../components/color-field.js';
import { toUnit, UNITS } from '@lolly/engine';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EYE_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const BUCKET_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.5 8.5a1.5 1.5 0 0 0 0 2L8 19a1.5 1.5 0 0 0 2 0z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.5 2-3.5 2-3.5s2 2 2 3.5z"/></svg>`;
const DOC_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
// Two-column dot grip — the universal "grab to drag" affordance (see reorder.js).
const GRIP_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`;
const WARNING_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

// Structural columns keep a sensible default width; data columns do not (see
// dataWidthStyle) so they flex-share the leftover space and the table fits.
const DEFAULT_COL_W = 116;
const COL_DEFAULTS = { __template: 210, __filename: 150, __width: 78, __height: 78, __unit: 66, __dpi: 66 };

// Export-dimension columns: Save-as + output size/unit/dpi. Unlike the Template
// column (always shown) these are collapsible — a Pro who's set them once can hide
// them to declutter and restore from a distinct tag pinned to the front of the
// bottom bar. The values live on each row (filename/outWidth/unit/dpi) and survive
// collapse untouched; collapsing only hides the controls. Order here is the order
// the columns (and their restore tags) appear in.
export const EXPORT_COLS = [
  { key: '__filename', label: 'Save as' },
  { key: '__width', label: 'Width' },
  { key: '__height', label: 'Height' },
  { key: '__unit', label: 'Unit' },
  { key: '__dpi', label: 'DPI' },
];

const widthStyle = (key, widths) => `width:${widths?.[key] ?? COL_DEFAULTS[key] ?? DEFAULT_COL_W}px`;
// Data columns are flexible until the user drags one: no width ⇒ the column
// shares the table's free space; a stored width ⇒ it's pinned (and may scroll).
const dataWidthStyle = (key, widths) => (widths?.[key] != null ? `width:${widths[key]}px` : '');

/** Header cell for one derived column. Bulk-capable columns get a fill button. */
function headerCell(col, widths) {
  const action = col.bulk
    ? `<button type="button" class="pro-fill-btn" data-bulk-col="${esc(col.key)}" title="Fill “${esc(col.label)}” down every row" aria-label="Fill column">${BUCKET_SVG}</button>`
    : col.type === 'blocks'
      ? `<button type="button" class="pro-fill-btn" data-bulk-blocks="${esc(col.key)}" title="Edit “${esc(col.label)}” for every row" aria-label="Edit column for all rows">${BUCKET_SVG}</button>`
      : col.reason
        ? `<span class="pro-col-flag" title="${esc(col.reason)}" aria-label="${esc(col.reason)}">≠</span>`
        : '';
  // The label itself is the collapse control (distinct from the Fill button).
  return `<th class="pro-col" data-col="${esc(col.key)}" style="${dataWidthStyle(col.key, widths)}">
    <div class="pro-col-head">
      <button type="button" class="pro-col-label" data-collapse-col="${esc(col.key)}"
        title="Hide “${esc(col.label)}” — click its tag below to bring it back">${esc(col.label)}</button>
      ${action}
    </div>
  </th>`;
}

/** Header cell for a collapsible export-dimension column (Save as / Width / …).
 * The label is the collapse control, exactly like a data column, but it carries
 * no Fill button and its restore tag is styled apart and pinned to the front. */
function exportHeaderCell(col, widths) {
  return `<th class="pro-col-fixed" data-col="${esc(col.key)}" style="${widthStyle(col.key, widths)}">
    <div class="pro-col-head">
      <button type="button" class="pro-col-label" data-collapse-col="${esc(col.key)}"
        title="Hide “${esc(col.label)}” — restore it from the tag at the front of the bar below">${esc(col.label)}</button>
    </div>
  </th>`;
}

/** Bottom bar (always shown): add-row buttons at the left — anchored where you'd
 * use them — then the "hide all" control + restorable column tags, and the
 * queued-renders count pushed to the right.
 * @param {Array}  visible  currently-shown data columns
 * @param {Array}  hidden   collapsed data columns (shown as restore tags)
 * @param {number} queued   rows with a template chosen (the render count) */
// + Row / +5 / Fill last — rendered directly after the </table> (see
// renderGridHtml), not in the columns bar, so they can be positioned/styled
// independently. "Fill last" copies the last template-filled row into every
// empty row; it's disabled when there's no source row or nothing empty to fill.
function addRowsHtml(rows) {
  const hasSource = rows.some(r => r.toolId);
  const hasEmpty = rows.some(r => !r.toolId);
  const fillDisabled = !(hasSource && hasEmpty);
  return `<div class="pro-addrow">
    <button type="button" class="pro-btn" data-add-rows="1" title="Add one row (⌘/Ctrl+Enter)">+ Row</button>
    <button type="button" class="pro-btn" data-add-rows="5" title="Add five rows">+5</button>
    <button type="button" class="pro-btn pro-fill-last" data-fill-last${fillDisabled ? ' disabled' : ''}
      title="Copy the last row that has a template into every empty row below">Fill last</button>
  </div>`;
}

function columnsBarHtml(visible, hidden, queued, collapsedExport = []) {
  // "Hide all columns" + "Show all" controls.
  const hideAll = visible.length
    ? `<button type="button" class="pro-cols-action" data-hide-all-cols
        title="Hide every input column — then click the ones you want to edit">Hide all columns</button>`
    : '';
  // "Show all" restores everything — data columns AND collapsed export columns.
  const showAll = (hidden.length || collapsedExport.length)
    ? `<button type="button" class="pro-cols-action" data-show-all-cols title="Show every column">Show all</button>`
    : '';
  // Export tags lead the tag list and read as a distinct kind (the "Output" group)
  // so they never blend into the per-tool input tags. Same restore mechanism.
  const exportTags = collapsedExport.length
    ? `<span class="pro-collapsed-bar-label">Output</span>${
        collapsedExport.map(col => `<button type="button" class="pro-collapsed-tag pro-collapsed-tag--export" data-restore-col="${esc(col.key)}"
          title="Show the “${esc(col.label)}” export column">${esc(col.label)} <span aria-hidden="true">＋</span></button>`).join('')
      }`
    : '';
  const restore = hidden.length
    ? `<span class="pro-collapsed-bar-label">Hidden</span>${
        hidden.map(col => `<button type="button" class="pro-collapsed-tag" data-restore-col="${esc(col.key)}"
          title="Show “${esc(col.label)}”">${esc(col.label)} <span aria-hidden="true">＋</span></button>`).join('')
      }`
    : '';
  const count = queued
    ? `<span class="pro-count">${queued} render${queued === 1 ? '' : 's'} queued</span>`
    : '';
  return `<div class="pro-collapsed-bar">${hideAll}${showAll}${exportTags}${restore}${count}</div>`;
}

/** One data cell: editable control, read-only default, or greyed "not present". */
function dataCell(col, row, ctx) {
  const input = cellInput(col, row);
  if (!input) {
    return `<td class="pro-cell pro-cell--absent" data-col="${esc(col.key)}" data-row="${esc(row.uid)}"
      title="This template has no “${esc(col.label)}” field"></td>`;
  }

  // Blocks (repeating field groups) are a 2-D value; render a trigger cell that
  // shows a summary and opens the modal editor (wired in index.js). The structured
  // array lives in row.values and round-trips through CSV/paste/render unchanged.
  if (input.type === 'blocks') {
    const arr = Array.isArray(row.values[col.key]) ? row.values[col.key]
      : (Array.isArray(input.default) ? input.default : []);
    const n = arr.length;
    const firstField = (input.fields ?? [])[0]?.id;
    const preview = n && firstField
      ? arr.slice(0, 2).map(r => r?.[firstField]).filter(v => v != null && v !== '').map(String).join(', ')
      : '';
    const summary = n ? `${n} row${n === 1 ? '' : 's'}${preview ? ' · ' + preview : ''}` : 'Add…';
    return `<td class="pro-cell pro-cell--blocks" data-col="${esc(col.key)}" data-row="${esc(row.uid)}">
      <button type="button" class="pro-control pro-blocks-trigger${n ? '' : ' is-empty'}" data-blocks-trigger data-row="${esc(row.uid)}" data-col="${esc(col.key)}"
        title="Edit “${esc(col.label)}” — ${n} item${n === 1 ? '' : 's'}">${esc(summary)}</button>
    </td>`;
  }

  const value = row.values[col.key] ?? input.default ?? '';

  if (isCellEditable(col, row, { assetPicker: ctx.assetPicker })) {
    // Colour uses the shared SUSE picker. Id is row~col so each cell is unique;
    // `float` lets its popover escape the scrolling grid.
    if (input.type === 'color') {
      return `<td class="pro-cell pro-cell--color" data-col="${esc(col.key)}" data-row="${esc(row.uid)}">${
        colorFieldHtml(`${row.uid}~${col.key}`, value, { float: true, swatchesOnly: input.swatchesOnly === true })
      }</td>`;
    }
    const hooks = `data-cell data-row="${esc(row.uid)}" data-col="${esc(col.key)}"`;
    return `<td class="pro-cell" data-col="${esc(col.key)}" data-row="${esc(row.uid)}">${
      controlHtml(input, value, hooks)
    }</td>`;
  }

  // Present but not inline-editable (blocks / unknown / asset without a picker):
  // it renders with its tool default and is edited in the single-tool view.
  return `<td class="pro-cell pro-cell--readonly" data-col="${esc(col.key)}" data-row="${esc(row.uid)}"
    title="“${esc(col.label)}” is edited in the single-tool view; the template default is used">
    <span class="pro-cell-default">default</span></td>`;
}

/** One batch row: template + filename + a cell per column + remove button.
 * Exported so the host can append a single row incrementally (see addRows in
 * index.js) without rebuilding the whole table. */
export function bodyRow(row, columns, ctx) {
  const uid = esc(row.uid);
  const tool = ctx.tools.find(t => t.id === row.toolId);
  // Experimental tools flag the template cell (class .pro-exp) instead of a text
  // badge, so the styling — e.g. a faint hatch — lives entirely in CSS.
  const isExp = tool && tool.status === 'experimental';

  // Per-row format: a document-icon dropdown, sitting to the LEFT of the name.
  const formats = row.manifest?.render?.formats ?? [];
  // Face shows the blank document icon until a format is chosen, then the
  // extension (e.g. PNG) in a small semibold label.
  const fmtFace = row.format
    ? `<span class="pro-fmt-ext">${esc(row.format.toUpperCase())}</span>`
    : DOC_SVG;
  const fmtSelect = (tool && formats.length)
    ? `<label class="pro-fmt${row.format ? ' pro-fmt--set' : ''}"
         title="Output format for this row${row.format ? ` — ${esc(row.format.toUpperCase())}` : ' (blank uses the format set above)'}">
        ${fmtFace}
        <select class="pro-fmt-select" data-row-format="${uid}" tabindex="-1" aria-label="Format for this row">
          <option value="">Auto</option>
          ${formats.map(f => `<option value="${esc(f)}"${f === row.format ? ' selected' : ''}>${esc(f.toUpperCase())}</option>`).join('')}
        </select>
      </label>`
    : '';

  // Eye = open the single-tool view for this row with its inputs pre-filled.
  const eyeBtn = tool
    ? `<button type="button" class="pro-eye" data-preview-row="${uid}" tabindex="-1"
        title="Preview “${esc(tool.name)}” with this row's inputs" aria-label="Preview in tool">${EYE_SVG}</button>`
    : '';

  // The template "control" is a trigger that opens a search popover (built in
  // index.js) — far easier to hit on touch than the old datalist combobox.
  const templateCell = `<td class="pro-cell-template${isExp ? ' pro-exp' : ''}" data-row="${uid}" data-col="__template"${isExp ? ' title="Experimental — exports are watermarked"' : ''}>
    <span class="pro-template-format">${fmtSelect}</span>
    <button type="button" class="pro-template-select pro-template-trigger${fmtSelect ? ' has-fmt' : ''}" data-template-trigger data-row="${uid}"
      title="${tool ? `${esc(tool.name)} — click or press Enter to change` : 'Choose a template'}">
      <span class="pro-template-name${tool ? '' : ' is-placeholder'}">${esc(tool?.name ?? 'Search templates…')}</span>
    </button>
    <span class="pro-template-actions">${eyeBtn}</span>
  </td>`;

  const filenameCell = `<td class="pro-cell pro-cell-fixed" data-row="${uid}" data-col="__filename">
    <input class="pro-control" type="text" data-filename data-row="${uid}"
      value="${esc(row.filename ?? '')}" placeholder="auto" autocomplete="off" spellcheck="false">
  </td>`;

  // Per-row export dimensions, in this row's unit. The unit + DPI default to the
  // toolbar values (ctx.unit/ctx.dpi) but are overridable per row, so a batch can
  // mix (e.g. one row 100×75mm, another 1080px). Placeholder shows the tool's
  // native size converted into the effective unit so the default is legible.
  const unit = row.unit ?? ctx.unit ?? 'px';
  const dpi = row.dpi ?? ctx.dpi ?? 300;
  const nativeW = row.manifest?.render?.width;
  const nativeH = row.manifest?.render?.height;
  const ph = (native) => {
    if (!native) return 'auto';
    const v = unit === 'px' ? native : toUnit({ value: native, unit: 'px' }, unit);
    return esc(Math.round(v * 100) / 100);
  };
  const dimCell = (col, attr, val, native) => `<td class="pro-cell pro-cell-fixed" data-row="${uid}" data-col="${col}">
    <input class="pro-control pro-num" type="number" min="0" step="any" ${attr} data-row="${uid}"
      value="${val != null ? esc(val) : ''}" placeholder="${ph(native)}" autocomplete="off"
      title="Output ${col === '__width' ? 'width' : 'height'} in ${unit} · drag to scrub">
  </td>`;
  const widthCell = dimCell('__width', 'data-out-width', row.outWidth, nativeW);
  const heightCell = dimCell('__height', 'data-out-height', row.outHeight, nativeH);

  // Unit selector + DPI for this row. DPI only bites for physical units + raster,
  // so it's disabled (and dimmed) when the row is in px.
  const isPx = unit === 'px';
  const unitCell = `<td class="pro-cell pro-cell-fixed" data-row="${uid}" data-col="__unit">
    <select class="pro-control pro-unit-cell" data-out-unit data-row="${uid}" title="Units for width & height">
      ${UNITS.map(u => `<option value="${esc(u)}"${u === unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}
    </select>
  </td>`;
  const dpiCell = `<td class="pro-cell pro-cell-fixed${isPx ? ' pro-cell-muted' : ''}" data-row="${uid}" data-col="__dpi">
    <input class="pro-control pro-num" type="number" min="36" max="1200" step="1" data-out-dpi data-row="${uid}"
      value="${row.dpi != null ? esc(row.dpi) : ''}" placeholder="${esc(ctx.dpi ?? 300)}" ${isPx ? 'disabled' : ''}
      title="Raster DPI for physical units (ignored for px and vector formats)">
  </td>`;

  const cells = columns.map(col => dataCell(col, row, ctx)).join('');

  // Collapsed export columns drop their cell entirely, mirroring the header. The
  // collapse set lives on ctx so the incremental addRow path (which reuses ctx,
  // not a fresh render) honours the current state too.
  const collapsed = ctx.collapsed ?? new Set();
  const exportCell = (key, html) => (collapsed.has(key) ? '' : html);

  // Left gutter: the drag grip, pinned to the row's left edge (sticky like the
  // template column beside it) so a row is grabbable wherever you've scrolled.
  // No data-row/data-col, so keyboard nav skips it; reorder.js finds it by
  // [data-row-drag] regardless of which cell holds it.
  const dragCell = `<td class="pro-cell-drag">
    <button type="button" class="pro-row-drag" data-row-drag data-row="${uid}" tabindex="-1"
      title="Drag to reorder row" aria-label="Drag to reorder row">${GRIP_SVG}</button>
  </td>`;

  return `<tr data-row="${uid}"${row.height ? ` style="height:${row.height}px"` : ''}>
    ${dragCell}
    ${templateCell}
    ${exportCell('__filename', filenameCell)}
    ${exportCell('__width', widthCell)}
    ${exportCell('__height', heightCell)}
    ${exportCell('__unit', unitCell)}
    ${exportCell('__dpi', dpiCell)}
    ${cells}
    <td class="pro-cell-actions">
      <button type="button" class="pro-row-remove" data-action="remove-row" data-row="${uid}"
        title="Remove row" aria-label="Remove row">✕</button>
    </td>
  </tr>`;
}

/**
 * Render the whole grid.
 * @param {object} state    { rows, colWidths, ... }
 * @param {Array}  columns  visible columns (from deriveColumns(), minus collapsed)
 * @param {object} ctx      { tools, assetPicker }
 * @param {Array}  hidden   collapsed columns, rendered as restorable tags below
 */
export function renderGridHtml(state, columns, ctx, hidden = []) {
  const widths = state.colWidths;
  const collapsed = state.collapsed ?? new Set();
  // Export columns the user has collapsed (kept in their fixed order); the header
  // skips them and they reappear as distinct restore tags at the front of the bar.
  const collapsedExport = EXPORT_COLS.filter(c => collapsed.has(c.key));
  const exportHead = EXPORT_COLS
    .filter(c => !collapsed.has(c.key))
    .map(c => exportHeaderCell(c, widths))
    .join('');
  const head = `<thead><tr>
    <th class="pro-col-drag" aria-hidden="true"></th>
    <th class="pro-col-template" data-col="__template" style="${widthStyle('__template', widths)}">Template</th>
    ${exportHead}
    ${columns.map(c => headerCell(c, widths)).join('')}
    <th class="pro-col-actions"></th>
  </tr></thead>`;

  const body = `<tbody>${state.rows.map(r => bodyRow(r, columns, ctx)).join('')}</tbody>`;

  // Greet returning Pros by name when they've saved one (Profile → First name);
  // fall back to the generic welcome otherwise.
  const name = ctx.firstname?.trim();
  const greeting = name ? `<strong>${esc(name)}, you're a pro!:</strong>` : `<strong>Welcome Pro:</strong>`;
  const emptyHint = columns.length === 0 && hidden.length === 0
    ? `<div class="pro-empty-hint">
        <span class="pro-empty-hint-icon">${WARNING_SVG}</span>
        <p class="pro-empty-hint-text">${greeting} Pick a tool to begin.
        Fill any value down a whole column at once.</p>
      </div>`
    : '';

  const queued = state.rows.filter(r => r.toolId).length;
  return `<div class="pro-grid-scroll"><table class="pro-grid">${head}${body}</table>${addRowsHtml(state.rows)}</div>${columnsBarHtml(columns, hidden, queued, collapsedExport)}${emptyHint}`;
}
