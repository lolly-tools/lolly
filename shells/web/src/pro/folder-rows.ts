// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — pure row assembly for folder (group) exports.
 *
 * Converts saved sessions into batch rows with nested export paths. Kept free of
 * any render/zip/DOM/CSS imports so it stays unit-testable and so pro/index.js can
 * use it to flatten a folder into the grid without pulling in the run-overlay shell.
 */
import { isBatchSlot, batchSlotName } from '../batch-slots.ts';
import { isUnit } from '@lolly/engine';
import type { InputValue, Unit } from '@lolly/engine';

/** An assembled batch row with an optional nested export path. */
export interface ExportRow {
  toolId: string;
  values: Record<string, InputValue>;
  format?: string;
  filename?: string;
  outWidth?: number;
  outHeight?: number;
  unit?: Unit;
  dpi?: number;
}

/** One snapshot row inside a saved batch session. */
interface BatchSessionRow {
  toolId: string;
  values?: Record<string, InputValue>;
  format?: string;
  filename?: string;
  outWidth?: number;
  outHeight?: number;
  unit?: string;
  dpi?: number;
}

/** Narrow an untrusted stored unit string to a known Unit. */
const asUnit = (v: unknown): Unit | undefined => (typeof v === 'string' && isUnit(v) ? v : undefined);

/**
 * An untrusted session record loaded from host.state — either a single-tool
 * session (flat input values + `__`-prefixed meta) or a batch snapshot. All
 * fields are optional/`unknown` because this is a JSON/storage boundary.
 */
export interface StoredSession {
  __batch?: unknown;
  __label?: unknown;
  __toolId?: unknown;
  __export_filename?: unknown;
  __export_format?: unknown;
  __export_width?: unknown;
  __export_height?: unknown;
  __export_unit?: unknown;
  __export_dpi?: unknown;
  rows?: unknown;
}

/** One item in a saved folder. */
interface FolderItem {
  type: string;
  ref: string;
}

/** A saved folder (group) of sessions/assets. */
export interface Folder {
  id?: string;
  name: string;
  parentId?: string | null;
  items?: FolderItem[];
}

/** The slice of the host this module needs: loading a stored session. */
export interface FolderHost {
  state: { load(slot: string): Promise<StoredSession | null> };
}

const META = (k: string): boolean => k.startsWith('__');

/** Narrow an untrusted stored value to a string (storage boundary). */
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Drop the extension from a filename stem; fall back to the tool id. */
export function stemOf(filename: string | undefined, toolId: string | undefined): string {
  const f = filename?.trim();
  return (f ? f.replace(/\.[a-z0-9]{1,5}$/i, '') : '') || toolId || 'render';
}

/** Filesystem-safe-ish path segment for zip names (batch.js sanitizes again). */
export const slug = (s: unknown): string =>
  String(s ?? '').trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');

const posNum = (v: unknown): number | undefined => { const n = parseFloat(String(v)); return n > 0 ? n : undefined; };

/**
 * Convert a saved single-tool session's `data` into one batch row.
 *
 * A tool session stores input values alongside `__`-prefixed export meta; the
 * row's `values` is exactly the inputs (every non-`__` key that render-export seeds
 * straight into the runtime), and `__export_*` maps 1:1 onto the row's
 * format/filename/size fields. With `pathParts`, the filename becomes a nested
 * export path (`group/.../stem`).
 */
export function rowFromToolSession(data: StoredSession, pathParts: string[] = []): ExportRow {
  const values = Object.fromEntries(Object.entries(data).filter(([k]) => !META(k)));
  const toolId = str(data.__toolId) ?? '';
  const leaf = stemOf(str(data.__export_filename), toolId);
  return {
    toolId,
    values,
    format: str(data.__export_format) || undefined,
    filename: pathParts.length ? [...pathParts, leaf].join('/') : (str(data.__export_filename) || undefined),
    outWidth: posNum(data.__export_width),
    outHeight: posNum(data.__export_height),
    unit: asUnit(data.__export_unit) ?? 'px',
    dpi: posNum(data.__export_dpi),
  };
}

/** Convert one snapshot row (from a batch session) into a path-stamped export row. */
export function rowFromBatchRow(r: BatchSessionRow, pathParts: string[]): ExportRow {
  const leaf = stemOf(r.filename, r.toolId);
  return {
    toolId: r.toolId,
    values: r.values ?? {},
    format: r.format,
    filename: [...pathParts, leaf].join('/'),
    outWidth: r.outWidth,
    outHeight: r.outHeight,
    unit: asUnit(r.unit),
    dpi: r.dpi,
  };
}

/**
 * Assemble renderable rows for a folder, with nested export paths:
 * - a batch session (subgroup) → all its rows, under `<group>/<subgroup>/…`
 * - a single-tool session → one row, under `<group>/…`
 * Image items are inputs, not renderable tools, so they're skipped.
 *
 * When `allFolders` is supplied, the folder's SUB-FOLDERS are recursed into as well,
 * so a nested tree exports under nested paths (`<group>/<child>/…`). Omitting it keeps
 * the legacy single-level behaviour (used by pro/index.js to flatten one folder into the grid).
 * `basePath` is the ancestor path prefix accumulated during recursion.
 */
async function rowsForFolder(
  host: FolderHost,
  folder: Folder,
  allFolders: Folder[] | null = null,
  basePath: string[] = [],
): Promise<ExportRow[]> {
  const path = [...basePath, folder.name];
  const rows: ExportRow[] = [];
  for (const item of folder.items ?? []) {
    if (item.type !== 'session') continue;
    const data = await host.state.load(item.ref);
    if (!data) continue;
    if (data.__batch || isBatchSlot(item.ref)) {
      const sub = str(data.__label) || batchSlotName(item.ref);
      const snapshotRows = Array.isArray(data.rows) ? data.rows : [];
      for (const r of snapshotRows) {
        if (r.toolId) rows.push(rowFromBatchRow(r, [...path, sub]));
      }
    } else if (data.__toolId) {
      rows.push(rowFromToolSession(data, path));
    }
  }
  if (allFolders) {
    for (const child of allFolders.filter(f => (f.parentId ?? null) === folder.id)) {
      rows.push(...await rowsForFolder(host, child, allFolders, path));
    }
  }
  return rows;
}

export { rowsForFolder };
