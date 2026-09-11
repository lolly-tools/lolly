// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - saved batch sessions.
 *
 * A session is a snapshot of the whole grid: every row (its template + values +
 * per-row format/filename/dimensions/height) plus the view state (chosen format,
 * zip name, collapsed columns, column widths). It is persisted through the host
 * state bridge - the same IndexedDB store and asset-retention path that backs
 * single-tool saves - so library assets referenced by a saved batch are kept
 * alive by sync just like a regular session's assets.
 *
 * Batch slots are namespaced with BATCH_SLOT_PREFIX so the rest of the app can
 * tell them apart from single-tool sessions (regular slots are `<toolId>:<ts>`,
 * which never collide with this prefix). Keep this module free of DOM/view
 * concerns so the whole /pro feature stays removable in one folder.
 */
import { getTool, isExportable } from './render-export.ts';
import { BATCH_SLOT_PREFIX, isBatchSlot } from '../lib/batch-slots.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { restoreKit } from './kit-model.ts';
import type { KitState } from './kit-model.ts';

// Distinctive prefix; single-tool slots are `<toolId>:<timestamp>` so they
// never start with this. The literal + predicate are the shared lib module now
// (finding #13) - imported above for this module's use and re-exported here.
export { BATCH_SLOT_PREFIX, isBatchSlot };

/** A live batch row (what the grid holds and sessions read/write). */
export interface SessionRow {
  kitOutputId?: string;
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
  /** CMYK press condition (the `profile` URL param), for pdf-cmyk / cmyk-tiff. */
  profile?: string;
  /** Bleed as a dimension string, e.g. "3mm". */
  bleed?: string;
  /** Print marks as the `marks` CSV - decoded by lib/print-marks-csv.ts. */
  marks?: string;
}

/** The slice of live batch state a snapshot captures. */
export interface SessionStateInput {
  kit?: KitState;
  format: string;
  unit?: string;
  dpi?: number;
  /**
   * RUN-LEVEL print settings - the toolbar defaults every row inherits, stored
   * beside `format`/`unit`/`dpi` because they are the same kind of thing: a run
   * default a row may override. Without them a saved print batch reopened
   * trim-sized, unmarked and profile-less.
   */
  profile?: string;
  bleed?: string;
  marks?: string;
  zipName?: string;
  collapsed: Iterable<string>;
  colWidths: Record<string, number>;
  rows: SessionRow[];
}

/** One row inside a serialized snapshot (transient/derived fields dropped). */
export interface SnapshotRow {
  kitOutputId?: string;
  toolId: string;
  values: Record<string, InputValue>;
  format?: string;
  filename?: string;
  outWidth?: number;
  outHeight?: number;
  unit?: string;
  dpi?: number;
  height?: number;
  /** CMYK press condition (the `profile` URL param), for pdf-cmyk / cmyk-tiff. */
  profile?: string;
  /** Bleed as a dimension string, e.g. "3mm". */
  bleed?: string;
  /** Print marks as the `marks` CSV - decoded by lib/print-marks-csv.ts. */
  marks?: string;
}

/** A serializable snapshot of a whole batch, persisted via host.state. */
export interface BatchSnapshot {
  kit?: KitState;
  __batch: true;
  format: string;
  unit: string;
  dpi: number;
  /**
   * RUN-LEVEL print settings. Optional (not defaulted like unit/dpi) because
   * "no bleed / no marks / no press profile" is the correct reading of a snapshot
   * written before this field existed - an absent field is never an asserted zero,
   * and equally never a fabricated 3mm.
   */
  profile?: string;
  bleed?: string;
  marks?: string;
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
 * Pure: distil the live batch state into a serializable snapshot. Drops the
 * transient/derived bits - each row's `uid` (regenerated on load) and `manifest`
 * (reloaded from the tool id) - and keeps only rows that picked a template.
 */
export function snapshotFromState(state: SessionStateInput): BatchSnapshot {
  return {
    __batch: true,
    ...(state.kit ? { kit: restoreKit(state.kit) } : {}),
    format: state.format,
    unit: state.unit ?? 'px',
    dpi: state.dpi ?? 300,
    // Run-level print settings. Written only when set, so a non-print batch's
    // snapshot is byte-identical to what it was before this feature.
    ...(state.profile ? { profile: state.profile } : {}),
    ...(state.bleed ? { bleed: state.bleed } : {}),
    ...(state.marks ? { marks: state.marks } : {}),
    zipName: state.zipName ?? '',
    collapsed: [...state.collapsed],
    colWidths: { ...state.colWidths },
    rows: state.rows
      .filter(r => r.toolId)
      .map(r => ({
        ...(r.kitOutputId ? { kitOutputId: r.kitOutputId } : {}),
        toolId: r.toolId,
        values: r.values ?? {},
        format: r.format,
        filename: r.filename,
        outWidth: r.outWidth,
        outHeight: r.outHeight,
        unit: r.unit,
        dpi: r.dpi,
        height: r.height,
        // Per-row print overrides (a row that carries one beats the run default).
        profile: r.profile,
        bleed: r.bleed,
        marks: r.marks,
      })),
  };
}

/**
 * Rebuild live rows from a snapshot, reloading each row's manifest (same path
 * the CSV import uses). A row whose tool no longer loads - OR is no longer
 * batch-renderable (a render-only / on-device utility, now hidden from the
 * picker) - is kept but cleared to an empty row rather than dropped, so positions
 * stay stable. Clearing (rather than leaving a dead toolId) keeps the grid honest:
 * the template cell would otherwise read as blank while the row still contributed
 * orphan columns and got silently skipped at render.
 *
 * @param {object} data        snapshot produced by snapshotFromState
 * @param {object} deps
 * @param {() => object} deps.newRow  the caller's fresh-row factory (owns uid)
 */
export async function rowsFromSnapshot<R extends SessionRow>(
  data: { rows?: readonly SnapshotRow[] },
  { newRow }: { newRow: () => R },
): Promise<R[]> {
  const rows: R[] = [];
  for (const r of data.rows ?? []) {
    const row = newRow();
    row.toolId = r.toolId;
    if (r.kitOutputId) row.kitOutputId = r.kitOutputId;
    row.values = r.values ?? {};
    if (r.format) row.format = r.format;
    if (r.filename) row.filename = r.filename;
    if (r.outWidth) row.outWidth = r.outWidth;
    if (r.outHeight) row.outHeight = r.outHeight;
    if (r.unit) row.unit = r.unit;
    if (r.dpi) row.dpi = r.dpi;
    if (r.height) row.height = r.height;
    if (r.profile) row.profile = r.profile;
    if (r.bleed) row.bleed = r.bleed;
    if (r.marks) row.marks = r.marks;
    try {
      const manifest = (await getTool(r.toolId)).manifest;
      if (isExportable(manifest)) row.manifest = manifest;
      else { if (!r.kitOutputId) row.toolId = ''; row.manifest = null; }
    } catch {
      if (!r.kitOutputId) row.toolId = '';
      row.manifest = null;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Storage facade over host.state, scoped to batch slots. Mirrors the structure of a
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
      return data && (data as BatchSnapshot).__batch ? (data as BatchSnapshot) : null;
    },

    async delete(slot) {
      await host.state.delete(slot);
    },
  };
}
