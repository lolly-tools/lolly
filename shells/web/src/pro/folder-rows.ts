// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - pure row assembly for folder (group) exports.
 *
 * Converts saved sessions into batch rows with nested export paths. Kept free of
 * any render/zip/DOM/CSS imports so it stays unit-testable and so pro/index.js can
 * use it to flatten a folder into the grid without pulling the run-overlay shell.
 */

import { BATCH_SLOT_PREFIX, isBatchSlot } from '../lib/batch-slots.ts';

/** An assembled batch row with an optional nested export path. */
export interface ExportRow {
  /**
   * Stable, opaque identity - see `pro/batch.ts` `BatchRow.uid`. Stamped by
   * {@link rowsForFolder} from the SOURCE (folder path :: session ref # ordinal), so
   * it is deterministic and survives `planBatch`'s compaction. NEVER an index: the
   * numbers the runner emits are queue positions in the compacted array.
   * The pure `rowFrom*` helpers do not stamp it - assembly does.
   */
  uid?: string;
  toolId: string | undefined;
  values: Record<string, unknown>;
  format?: string;
  filename?: string;
  outWidth?: number;
  outHeight?: number;
  unit?: string;
  dpi?: number;
  /** CMYK press condition (the `profile` URL param), for pdf-cmyk / cmyk-tiff. */
  profile?: string;
  /** Bleed as a dimension string, e.g. "3mm". */
  bleed?: string;
  /** Print marks as the `marks` CSV - decoded by lib/print-marks-csv.ts. */
  marks?: string;
}

/** One snapshot row inside a saved batch session. */
interface BatchSessionRow {
  toolId: string;
  values?: Record<string, unknown>;
  format?: string;
  filename?: string;
  outWidth?: number;
  outHeight?: number;
  unit?: string;
  dpi?: number;
  /** Per-row print overrides (see `rowFromBatchRow` for the precedence). */
  profile?: string;
  bleed?: string;
  marks?: string;
}

/**
 * The RUN-LEVEL print settings a batch snapshot carries - the /pro toolbar
 * defaults its rows inherit. A row that names its own value wins; this is the
 * fallback, and the two are merged when the snapshot is flattened into export
 * rows so a folder export reproduces what the saved batch would have rendered.
 */
export interface PrintDefaults {
  profile?: string;
  bleed?: string;
  marks?: string;
}

/**
 * An untrusted session record loaded from host.state - either a single-tool
 * session (flat input values + `__`-prefixed export meta) or a batch snapshot.
 */
interface StoredSession {
  __batch?: unknown;
  __label?: string;
  __toolId?: string;
  __export_filename?: string;
  __export_format?: string;
  __export_width?: string;
  __export_height?: string;
  __export_unit?: string;
  __export_dpi?: string;
  __export_profile?: string;
  __export_bleed?: string;
  __export_marks?: string;
  rows?: BatchSessionRow[];
  /**
   * A BATCH snapshot's run-level print settings (unprefixed - the `__export_*`
   * names above are the single-tool record's). Read only when `__batch` is set;
   * on a single-tool record these keys would be ordinary input values, which is
   * why nothing reads them outside the `__batch` branch of `rowsForFolder`.
   */
  profile?: string;
  bleed?: string;
  marks?: string;
}

/** One item in a saved folder. */
interface FolderItem {
  type: string;
  ref: string;
}

/** A saved folder (group) of sessions/assets. */
interface Folder {
  id?: string;
  name: string;
  parentId?: string | null;
  items?: FolderItem[];
}

/** The slice of the host this module needs: loading a stored session. */
interface FolderHost {
  state: { load(slot: string): Promise<StoredSession | null> };
}

const META = (k: string) => k.startsWith('__');

/** Drop the extension from a filename stem; fall back to the tool id. */
export function stemOf(filename: string | undefined, toolId: string | undefined): string {
  const f = filename?.trim();
  return (f ? f.replace(/\.[a-z0-9]{1,5}$/i, '') : '') || toolId || 'render';
}

/** Filesystem-safe-ish path segment for zip names (batch.js sanitizes again). */
export const slug = (s: unknown): string => String(s ?? '').trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');

// Motion export formats - a live clip captured in REAL TIME (rAF-driven), not a single
// frame. They pause when the tab isn't visible, so a batch that includes them needs the
// tab kept active. Single source of truth (render-export imports this too).
export const MOTION_EXPORT_FORMATS = new Set(['webm', 'mp4', 'gif', 'apng']);
/** True if a row renders to a real-time motion clip (video/animation). */
export const isMotionRow = (r: ExportRow): boolean => !!r.format && MOTION_EXPORT_FORMATS.has(r.format.toLowerCase());

const posNum = (v: string | undefined): number | undefined => { const n = parseFloat(v as string); return n > 0 ? n : undefined; };

/**
 * Convert a saved single-tool session's `data` into one batch row.
 *
 * A tool session stores its input values alongside `__`-prefixed export meta; the
 * row's `values` is exactly the inputs (every non-`__` key - render-export seeds
 * those straight into the runtime), and `__export_*` maps 1:1 onto the row's
 * format/filename/size fields. With `pathParts`, the filename becomes the nested
 * export path (`group/.../stem`).
 */
export function rowFromToolSession(data: StoredSession, pathParts: string[] = []): ExportRow {
  const values = Object.fromEntries(Object.entries(data).filter(([k]) => !META(k)));
  const leaf = stemOf(data.__export_filename, data.__toolId);
  return {
    toolId: data.__toolId,
    values,
    format: data.__export_format || undefined,
    filename: pathParts.length ? [...pathParts, leaf].join('/') : (data.__export_filename || undefined),
    outWidth: posNum(data.__export_width),
    outHeight: posNum(data.__export_height),
    unit: data.__export_unit || 'px',
    dpi: posNum(data.__export_dpi),
    // Print settings ride the row too. Without these a folder of print-ready PDFs
    // rendered out trim-sized with no crop marks and no press profile - settings
    // the user had explicitly set and that the session record had faithfully kept.
    profile: data.__export_profile || undefined,
    bleed: data.__export_bleed || undefined,
    marks: data.__export_marks || undefined,
  };
}

/**
 * Convert one snapshot row (from a batch session) into a path-stamped export row.
 *
 * `runDefaults` is the SNAPSHOT's run-level print block; a row that names its own
 * value wins, matching `runBatch`'s precedence for format/unit/dpi (the single
 * statement of the rule is `resolvePrintSettings` in ./batch.ts - this module is
 * deliberately import-free, so it restates the merge rather than importing it, and
 * `pro/folder-rows.test.ts` pins the two to the same answer).
 *
 * Before this, a batch snapshot's rows reached the folder exporter with all three
 * fields `undefined`: a folder of 40 rows the user had set to 3mm CMYK rendered
 * trim-sized, unmarked and profile-less. An absent field is a genuine "unset", not
 * an asserted zero - which is why `''` resolves to `undefined`, not to "no bleed".
 */
export function rowFromBatchRow(r: BatchSessionRow, pathParts: string[], runDefaults: PrintDefaults = {}): ExportRow {
  const leaf = stemOf(r.filename, r.toolId);
  const pick = (a: string | undefined, b: string | undefined): string | undefined =>
    (a != null && a !== '') ? a : (b != null && b !== '' ? b : undefined);
  return {
    toolId: r.toolId,
    values: r.values ?? {},
    format: r.format,
    filename: [...pathParts, leaf].join('/'),
    outWidth: r.outWidth,
    outHeight: r.outHeight,
    unit: r.unit,
    dpi: r.dpi,
    profile: pick(r.profile, runDefaults.profile),
    bleed: pick(r.bleed, runDefaults.bleed),
    marks: pick(r.marks, runDefaults.marks),
  };
}

/**
 * Assemble every renderable row for a folder, with nested export paths:
 *   - a batch session (subgroup) → all its rows, under `<group>/<subgroup>/…`
 *   - a single-tool session      → one row, under `<group>/…`
 * Image items are inputs, not renderable tools, so they're skipped.
 *
 * When `allFolders` is supplied, the folder's SUB-FOLDERS are recursed into as well, so
 * a nested tree exports under nested paths (`<group>/<child>/…`). Omitting it keeps the
 * legacy single-level behaviour (used by pro/index.js to flatten one folder into a grid).
 * `basePath` is the ancestor path prefix accumulated during recursion.
 */
export async function rowsForFolder(host: FolderHost, folder: Folder, allFolders: Folder[] | null = null, basePath: string[] = []): Promise<ExportRow[]> {
  const path = [...basePath, folder.name];
  const rows: ExportRow[] = [];
  for (const item of folder.items ?? []) {
    if (item.type !== 'session') continue;
    const data = await host.state.load(item.ref);
    if (!data) continue;
    if (data.__batch || isBatchSlot(item.ref)) {
      const sub = data.__label || item.ref.slice(BATCH_SLOT_PREFIX.length);
      // uid is stamped HERE, from the source, not by the pure helpers: `<path>::<ref>#<k>`.
      // The path prefix is required - exportSelectionAsBatch concatenates subtrees, so the
      // same session ref can legitimately appear under two selected folders, and uniqueness
      // is a property of the path, not the ref. No counter, no random: deterministic.
      const srcRows = data.rows ?? [];
      // The snapshot's run-level print block is the fallback for every row it holds.
      const runPrint: PrintDefaults = { profile: data.profile, bleed: data.bleed, marks: data.marks };
      // Pushed UNCONDITIONALLY, template or not. A pre-filter here shifted the source
      // position of every row after a template-less one and dropped it from the run
      // report entirely - a zip that lists only the rows it could render is not an
      // honest record of the job. `planBatch` drops these with the reason
      // 'No template selected', recording the source position and the uid stamped
      // below, so `#k` and the reported row number stay the same number.
      for (let k = 0; k < srcRows.length; k++) {
        const r = srcRows[k]!;
        rows.push({ ...rowFromBatchRow(r, [...path, sub], runPrint), uid: `${path.join('/')}::${item.ref}#${k}` });
      }
    } else if (data.__toolId) {
      rows.push({ ...rowFromToolSession(data, path), uid: `${path.join('/')}::${item.ref}` });
    }
  }
  if (allFolders) {
    for (const child of allFolders.filter(f => (f.parentId ?? null) === folder.id)) {
      rows.push(...await rowsForFolder(host, child, allFolders, path));
    }
  }
  return rows;
}

/**
 * Assemble grid rows from an EXPLICIT list of session refs - the Projects
 * multi-selection "Edit as sheet" path (`#/pro?s=slot,slot…`).
 *
 * Deliberately NOT {@link rowsForFolder}: a folder export skips non-tool items
 * because it can't render an image, but a sheet is an editing surface, and the
 * user asked for a selection to open verbatim - every item they picked becomes a
 * row. So a single-tool session is a row, a batch snapshot flattens to its rows,
 * and anything else (an uploaded image/asset with no inputs, or a record that
 * won't load) becomes a TOOL-LESS row: present in the grid with an empty tool
 * picker and no input cells, rather than silently dropped. Nothing here recurses
 * or nests paths - the selection is already the flat set the user chose.
 */
export async function rowsFromRefs(host: FolderHost, refs: string[]): Promise<ExportRow[]> {
  const rows: ExportRow[] = [];
  for (const ref of refs) {
    const data = await host.state.load(ref).catch(() => null);
    if (data && (data.__batch || isBatchSlot(ref))) {
      const srcRows = data.rows ?? [];
      const runPrint: PrintDefaults = { profile: data.profile, bleed: data.bleed, marks: data.marks };
      for (let k = 0; k < srcRows.length; k++) {
        rows.push({ ...rowFromBatchRow(srcRows[k]!, [], runPrint), uid: `${ref}#${k}` });
      }
    } else if (data && data.__toolId) {
      rows.push({ ...rowFromToolSession(data, []), uid: ref });
    } else {
      rows.push({ toolId: undefined, values: {}, filename: data?.__label, uid: ref });
    }
  }
  return rows;
}
