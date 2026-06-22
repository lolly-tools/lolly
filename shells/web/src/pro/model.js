/**
 * Pro / Batch mode — pure model logic (NO DOM, NO engine, NO host).
 *
 * This module derives the batch grid's columns from the set of selected tools
 * and decides, per column, whether it can be "bulk written" (one value applied
 * to every row at once) or must be edited cell-by-cell.
 *
 * It is deliberately free of side effects so it can be unit-tested in isolation
 * (see model.test.js) and so the whole /pro feature can be reasoned about — and
 * removed — without touching the rest of the platform.
 *
 * Vocabulary:
 *   row      — one entry in the batch: a chosen template + the values for it.
 *   column   — an input id that appears in one or more selected tools.
 *   member   — a tool's declaration of that input (carries the constraints).
 *   bulk     — every member is compatible, so the column header is actionable.
 */

// Input types we can edit inline in a grid cell. `blocks` (repeating groups)
// and anything unknown are surfaced as read-only cells: they render with their
// tool defaults and are edited in the single-tool view. Keeping the supported
// set explicit means a new engine input type fails closed (read-only) rather
// than silently producing a broken control.
export const INLINE_TYPES = new Set([
  'text', 'longtext', 'url', 'number', 'boolean',
  'color', 'select', 'date', 'time', 'datetime-local', 'asset', 'vector',
]);

// Types eligible for bulk column-write. `asset` is bulk-writable only when the
// host exposes an asset picker (decided at render time, not here).
const BULK_TYPES = new Set([
  'text', 'longtext', 'url', 'number', 'boolean',
  'color', 'select', 'date', 'time', 'datetime-local', 'asset',
]);

// Input ids that collide with reserved URL params / fixed grid chrome. These are
// driven by the grid's own columns — Width/Height/Unit/DPI and Save-as — and by
// the export-dimension feed in render-export.js, so a tool input of the same name
// must NOT get its own column (it would duplicate, e.g., the Width/Height shown
// twice). Mirrors RESERVED in engine/src/url-mode.js.
const RESERVED_KEYS = new Set([
  'format', 'export', 'copy', 'slot', 'output', 'filename', '_v',
  'width', 'height', 'w', 'h', 'unit', 'dpi', 'full', 'options',
]);

/**
 * Stable signature of the constraints that must match for two inputs sharing an
 * id to be written together. Same id + same signature ⇒ bulk-writable.
 * Different signatures (e.g. one tool clamps a number 0–100, another 0–10) ⇒
 * the header is not actionable and each cell is edited with its own rules.
 */
export function constraintSignature(input) {
  const t = input.type;
  const sig = { type: t };
  switch (t) {
    case 'number':
      sig.min = input.min ?? null;
      sig.max = input.max ?? null;
      sig.step = input.step ?? null;
      sig.display = input.display ?? null;
      break;
    case 'text':
    case 'longtext':
    case 'url':
      sig.maxLength = input.maxLength ?? null;
      break;
    case 'select':
      sig.options = (input.options ?? []).map(optionValue);
      break;
    case 'color':
      sig.palette = input.palette ?? null;
      break;
    // boolean / date / time / datetime-local / asset: type alone is enough.
  }
  return JSON.stringify(sig);
}

/** Normalize a select option (string | {value,label}) to its value. */
export function optionValue(opt) {
  return opt && typeof opt === 'object' ? opt.value : opt;
}

/**
 * Derive grid columns from rows.
 * @param {Array<{toolId:string, manifest:object|null}>} rows
 * @returns {Array<Column>} in first-seen order
 *
 * Column = {
 *   key, label, type|'mixed',
 *   members: Map<toolId, inputDecl>,   // distinct tools that declare this id
 *   bulk: boolean,                     // header actionable?
 *   inline: boolean,                   // can any cell be edited inline?
 *   reason: string,                    // why not bulk (for the header tooltip)
 *   spec: inputDecl|null,              // representative decl for the bulk control
 * }
 */
export function deriveColumns(rows) {
  const byKey = new Map();

  for (const row of rows) {
    if (!row || !row.manifest) continue;
    for (const input of row.manifest.inputs ?? []) {
      if (!input || typeof input.id !== 'string') continue;
      // Reserved names (width/height/unit/dpi/filename/…) are owned by the grid
      // chrome and the export-dimension feed — never their own column.
      if (RESERVED_KEYS.has(input.id)) continue;
      let col = byKey.get(input.id);
      if (!col) {
        col = { key: input.id, label: input.label ?? input.id, members: new Map(), order: byKey.size };
        byKey.set(input.id, col);
      }
      // First non-empty label wins for display; keyed by tool so repeated
      // selections of the same template collapse to one member.
      col.members.set(row.toolId, input);
    }
  }

  return [...byKey.values()].map(finalizeColumn).sort((a, b) => a.order - b.order);
}

function finalizeColumn(col) {
  const members = [...col.members.values()];
  const types = new Set(members.map(m => m.type));
  const uniformType = types.size === 1 ? members[0].type : 'mixed';

  const inline = uniformType !== 'mixed' && INLINE_TYPES.has(uniformType);
  const signatures = new Set(members.map(constraintSignature));
  const bulk = uniformType !== 'mixed'
    && BULK_TYPES.has(uniformType)
    && signatures.size === 1;

  let reason = '';
  if (uniformType === 'mixed') {
    reason = 'Tools share this field name but use different input types — edit each cell.';
  } else if (!inline) {
    reason = 'This input type is edited in the single-tool view; cells use defaults.';
  } else if (!BULK_TYPES.has(uniformType)) {
    reason = 'This input type cannot be bulk-filled — edit each cell.';
  } else if (signatures.size > 1) {
    reason = 'Tools constrain this field differently (e.g. min/max) — edit each cell.';
  }

  return {
    key: col.key,
    label: col.label,
    order: col.order,
    type: uniformType,
    members: col.members,
    inline,
    bulk,
    reason,
    spec: bulk ? members[0] : null,
  };
}

/**
 * The input declaration for a given (row, column) pair, or null if this row's
 * tool does not have that input (→ the cell is greyed out / disabled).
 */
export function cellInput(column, row) {
  if (!row || !row.manifest) return null;
  return column.members.get(row.toolId) ?? null;
}

/** Whether a specific cell can be edited inline (vs. read-only default). */
export function isCellEditable(column, row, { assetPicker = false } = {}) {
  const input = cellInput(column, row);
  if (!input) return false;
  if (!INLINE_TYPES.has(input.type)) return false;
  if (input.type === 'asset' && !assetPicker) return false;
  return true;
}

/**
 * Rows that a bulk write to `column` should touch: those whose tool declares
 * the column AND whose cell is inline-editable. Returns row references.
 */
export function bulkTargets(column, rows, opts = {}) {
  return rows.filter(r => isCellEditable(column, r, opts));
}
