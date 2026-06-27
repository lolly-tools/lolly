// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — saved batch sessions.
 *
 * A session is a snapshot of the whole grid: every row (its template + values +
 * per-row format/filename/dimensions/height) plus the view state (chosen format,
 * zip name, collapsed columns, column widths). It is persisted through the host
 * state bridge — the same IndexedDB store and asset-retention path that backs
 * single-tool saves — so library assets referenced by a saved batch are kept
 * alive by sync just like a regular session's assets.
 *
 * Batch slots are namespaced with BATCH_SLOT_PREFIX so the rest of the app can
 * tell them apart from single-tool sessions (regular slots are `<toolId>:<ts>`,
 * which never collide with this prefix). Keep this module free of DOM/view
 * concerns so the whole /pro feature stays removable in one folder.
 */
import { getTool, isExportable } from './render-export.js';

// Distinctive prefix; single-tool slots are `<toolId>:<timestamp>` so they
// never start with this. NOTE: gallery.js duplicates this literal (it must not
// import from pro/), so keep the two in sync if it ever changes.
export const BATCH_SLOT_PREFIX = '__batch__:';

export const isBatchSlot = (slot) =>
  typeof slot === 'string' && slot.startsWith(BATCH_SLOT_PREFIX);

/**
 * Pure: distil the live batch state into a serializable snapshot. Drops the
 * transient/derived bits — each row's `uid` (regenerated on load) and `manifest`
 * (reloaded from the tool id) — and keeps only rows that picked a template.
 */
export function snapshotFromState(state) {
  return {
    __batch: true,
    format: state.format,
    unit: state.unit ?? 'px',
    dpi: state.dpi ?? 300,
    zipName: state.zipName ?? '',
    collapsed: [...state.collapsed],
    colWidths: { ...state.colWidths },
    rows: state.rows
      .filter(r => r.toolId)
      .map(r => ({
        toolId: r.toolId,
        values: r.values ?? {},
        format: r.format,
        filename: r.filename,
        outWidth: r.outWidth,
        outHeight: r.outHeight,
        unit: r.unit,
        dpi: r.dpi,
        height: r.height,
      })),
  };
}

/**
 * Rebuild live rows from a snapshot, reloading each row's manifest (same path
 * the CSV import uses). A row whose tool no longer loads — OR is no longer
 * batch-renderable (a render-only / on-device utility, now hidden from the
 * picker) — is kept but cleared to an empty row rather than dropped, so positions
 * stay stable. Clearing (rather than leaving a dead toolId) keeps the grid honest:
 * the template cell would otherwise read as blank while the row still contributed
 * orphan columns and got silently skipped at render.
 *
 * @param {object} data        snapshot produced by snapshotFromState
 * @param {object} deps
 * @param {() => object} deps.newRow  the caller's fresh-row factory (owns uid)
 */
export async function rowsFromSnapshot(data, { newRow }) {
  const rows = [];
  for (const r of data.rows ?? []) {
    const row = newRow();
    row.toolId = r.toolId;
    row.values = r.values ?? {};
    if (r.format) row.format = r.format;
    if (r.filename) row.filename = r.filename;
    if (r.outWidth) row.outWidth = r.outWidth;
    if (r.outHeight) row.outHeight = r.outHeight;
    if (r.unit) row.unit = r.unit;
    if (r.dpi) row.dpi = r.dpi;
    if (r.height) row.height = r.height;
    try {
      const manifest = (await getTool(r.toolId)).manifest;
      if (isExportable(manifest)) row.manifest = manifest;
      else { row.toolId = ''; row.manifest = null; }
    } catch {
      row.toolId = '';
      row.manifest = null;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Storage facade over host.state, scoped to batch slots. Mirrors the shape of a
 * little CRUD store: list / save / load / delete.
 */
export function createSessionStore(host) {
  return {
    /** Saved batches, newest first: [{ slot, name, updatedAt }]. */
    async list() {
      const all = await host.state.list();
      return all
        .filter(e => isBatchSlot(e.slot))
        .map(e => ({
          slot: e.slot,
          name: e.label ?? e.slot.slice(BATCH_SLOT_PREFIX.length),
          updatedAt: e.updatedAt,
        }))
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    },

    /** Save (or overwrite) a session under `name`. Returns the trimmed name. */
    async save(name, state) {
      const label = String(name ?? '').trim();
      if (!label) throw new Error('A session name is required.');
      const data = { ...snapshotFromState(state), __label: label };
      await host.state.save(BATCH_SLOT_PREFIX + label, data);
      return label;
    },

    /** Load a snapshot by slot, or null if missing / not a batch. */
    async load(slot) {
      const data = await host.state.load(slot);
      return data && data.__batch ? data : null;
    },

    async delete(slot) {
      await host.state.delete(slot);
    },
  };
}
