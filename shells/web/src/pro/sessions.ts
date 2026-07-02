// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — saved batch sessions.
 *
 * A session is a snapshot of the whole grid: every row's template + values +
 * per-row format/filename/dimensions/height) plus the view state (chosen format,
 * zip name, collapsed columns, column widths). It is persisted through the host
 * state bridge — the same IndexedDB store and asset-retention path that backs
 * single-tool saves — so library assets referenced by a saved batch are kept
 * alive by sync just like a regular session's assets.
 *
 * Batch slots are namespaced with BATCH_SLOT_PREFIX so the rest of the app can
 * tell them apart from single-tool sessions (regular slots are `<toolId>:<ts>`,
 * which never collide with the prefix). Keep this module free of DOM/view
 * concerns so the whole /pro feature stays removable in one folder.
 */
import { getTool, isExportable } from './render-export.ts';
import { isBatchSlot, batchSlot, batchSlotName } from '../batch-slots.ts';
import type { HostV1, InputValue, ToolManifest } from '@lolly/engine';

/** A live batch row (what the grid holds and sessions read/write). */
export interface SessionRow {
  toolId: string;
  values: Record<string, InputValue>;
  manifest: ToolManifest | null;
  format?: string;
  filename?: string;
  outWidth?: number;
  outHeight?: number;
  unit?: string;
  dpi?: number;
  height?: number;
}

/** The slice of live batch state a snapshot captures. */
export interface SessionStateInput {
  format: string;
  unit?: string;
  dpi?: number;
  zipName?: string;
  collapsed: Iterable<string>;
  colWidths: Record<string, number>;
  rows: SessionRow[];
}

/** One row inside a serialized snapshot (transient/derived fields dropped). */
export interface SnapshotRow {
  toolId: string;
  values: Record<string, InputValue>;
  format?: string;
  filename?: string;
  outWidth?: number;
  outHeight?: number;
  unit?: string;
  dpi?: number;
  height?: number;
}

/** A serializable snapshot of a whole batch, persisted via host.state. */
export interface BatchSnapshot {
  __batch: true;
  format: string;
  unit: string;
  dpi: number;
  zipName: string;
  collapsed: string[];
  colWidths: Record<string, number>;
  rows: SnapshotRow[];
  __label?: string;
}

/** A saved-session list entry surfaced to the UI. */
export interface SessionListEntry {
  slot: string;
  name: string;
  updatedAt: string;
}

/** The CRUD facade over host.state, scoped to batch slots. */
export interface SessionStore {
  list(): Promise<SessionListEntry[]>;
  save(name: string, state: SessionStateInput): Promise<string>;
  load(slot: string): Promise<BatchSnapshot | null>;
  delete(slot: string): Promise<void>;
}

/**
 * Pure: distil live batch state into a serializable snapshot. Drops the
 * transient/derived bits — each row's `uid` (regenerated on load) and `manifest`
 * (reloaded from the tool id) — and keeps only rows with a picked template.
 */
export function snapshotFromState(state: SessionStateInput): BatchSnapshot {
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
 * Rebuild live rows from a snapshot. Each row's template is reloaded — a tool
 * that has since become non-batch-renderable (render-only / on-device / hidden
 * from the picker) is kept but cleared rather than the whole row dropped, so
 * positions stay stable. Clearing (rather than leaving a dead toolId) keeps the
 * grid honest: the template cell would otherwise read as blank while the row
 * still contributed orphan columns and got silently skipped at render.
 *
 * @param data snapshot produced by snapshotFromState
 * @param deps caller's fresh-row factory (owns uid)
 */
export async function rowsFromSnapshot<R extends SessionRow>(
  data: { rows?: readonly SnapshotRow[] },
  { newRow }: { newRow: () => R },
): Promise<R[]> {
  const rows: R[] = [];
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

/** Narrow a stored (untrusted) value to a batch snapshot. */
function isBatchSnapshot(data: unknown): data is BatchSnapshot {
  return typeof data === 'object' && data !== null && '__batch' in data && Boolean(data.__batch);
}

/**
 * Storage facade over host.state, scoped to batch slots. Mirrors the shape of a
 * little CRUD store: list / save / load / delete.
 */
export function createSessionStore(host: HostV1): SessionStore {
  return {
    /** Saved batches, newest first: [{ slot, name, updatedAt }]. */
    async list() {
      const all = await host.state.list();
      return all
        .filter(e => isBatchSlot(e.slot))
        .map(e => ({
          slot: e.slot,
          name: e.label ?? batchSlotName(e.slot),
          updatedAt: e.updatedAt,
        }))
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    },

    /** Save (or overwrite) a session under `name`. Returns the trimmed name. */
    async save(name, state) {
      const label = String(name ?? '').trim();
      if (!label) throw new Error('A session name is required.');
      const data = { ...snapshotFromState(state), __label: label };
      await host.state.save(batchSlot(label), data);
      return label;
    },

    /** Load a snapshot by slot, or null if missing / not a batch. */
    async load(slot) {
      const data: unknown = await host.state.load(slot);
      return isBatchSnapshot(data) ? data : null;
    },

    async delete(slot) {
      await host.state.delete(slot);
    },
  };
}
