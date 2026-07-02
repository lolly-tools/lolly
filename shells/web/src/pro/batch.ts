// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — render the whole batch, sequentially.
 *
 * Rows are rendered one at a time (concurrency 1) on purpose: tool templates
 * run arbitrary scripts that may touch window globals and the document font
 * loader, and each render mounts a full-size offscreen node. Serial execution
 * keeps memory bounded and avoids cross-tool interference; the export work is
 * the bottleneck regardless, so parallelism buys little here.
 *
 * Failures are isolated — one bad row is recorded and the batch continues.
 */
import { renderRowToBlob, getTool, isExportable, type BatchRow } from './render-export.ts';
import type { RuntimeHost, Unit } from '@lolly/engine';

/** A batch row with the per-row export overrides the grid / CSV can set. */
export interface BatchRunRow extends BatchRow {
  unit?: Unit;
  dpi?: number;
  format?: string;
  outWidth?: number;
  outHeight?: number;
  filename?: string;
}

/** A rendered output ready for packaging. */
export interface BatchFile {
  name: string;
  blob: Blob;
  ms: number;
  fmt: string;
  url: string;
}

/** Per-row outcome of a run. */
export type BatchResult =
  | { index: number; row: BatchRunRow; ok: true; name: string; size: number; ms: number }
  | { index: number; row: BatchRunRow; ok: false; error: string };

/** Progress event emitted per row as a run proceeds. */
export type BatchProgress =
  | { index: number; total: number; status: 'cancelled' }
  | { index: number; total: number; status: 'rendering'; row: BatchRunRow }
  | { index: number; total: number; status: 'done'; row: BatchRunRow; name: string }
  | { index: number; total: number; status: 'error'; row: BatchRunRow; error: string };

/** Options controlling a batch run. */
export interface RunBatchOpts {
  format?: string;
  unit?: Unit;
  dpi?: number;
  onProgress?: (p: BatchProgress) => void;
  isCancelled?: () => boolean;
  pathAware?: boolean;
}

/** The rows a run keeps vs. drops, with reasons, from planBatch. Generic over the
 *  concrete row type so a caller passing richer rows (e.g. grid rows carrying a
 *  live manifest) gets them back untouched rather than widened to BatchRunRow. */
export interface BatchPlan<R extends BatchRunRow = BatchRunRow> {
  renderable: R[];
  skipped: Array<{ row: R; reason: string }>;
}

const FMT_EXT: Record<string, string> = { 'pdf-cmyk': 'pdf', jpeg: 'jpg', 'eps-cmyk': 'eps' };
const extFor = (fmt: string): string => FMT_EXT[fmt] ?? fmt;

const sanitizeSeg = (s: string): string => s.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');

/** Coerce a thrown value into a message string, reading `.message` when present. */
function errMessage(err: unknown): string {
  const msg = err && typeof err === 'object' && 'message' in err ? err.message : undefined;
  return String(msg ?? err);
}

/**
 * Ensure unique, filesystem-safe names within the zip. With `pathAware`, the
 * base may carry `/` separators (a grouped/folder export wants nested zip
 * directories) — each path segment is sanitized but the separators are kept, so
 * fflate writes a real folder tree. Without it, slashes are flattened to `-`
 * exactly as before, so ordinary grid runs are unchanged.
 */
function uniqueName(used: Set<string>, base: string, ext: string, pathAware = false): string {
  const safe = pathAware
    ? (base.split('/').map(sanitizeSeg).filter(Boolean).join('/') || 'render')
    : (base.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'render');
  let name = `${safe}.${ext}`;
  let n = 2;
  while (used.has(name)) name = `${safe}-${n++}.${ext}`;
  used.add(name);
  return name;
}

/**
 * @param rows  rows with a chosen tool
 * @param host
 * @param opts  preferred format, progress callback, cooperative cancel check
 * @returns files (name+blob) plus per-row results
 */
export async function runBatch(
  rows: BatchRunRow[],
  host: RuntimeHost,
  { format, unit, dpi, onProgress, isCancelled, pathAware = false }: RunBatchOpts = {},
): Promise<{ files: BatchFile[]; results: BatchResult[] }> {
  const files: BatchFile[] = [];
  const results: BatchResult[] = [];
  const usedNames = new Set<string>();
  const total = rows.length;
  // Every file is prefixed with its 1-based position in the batch, zero-padded to
  // the batch size, so the names sort in row order in the zip / file explorer —
  // named rows included. Pad width tracks the count so e.g. row 100 sorts after
  // row 99 (a fixed 2-digit pad would order "100" before "99" lexically).
  const seqWidth = Math.max(2, String(total).length);

  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) {
      onProgress?.({ index: i, total, status: 'cancelled' });
      break;
    }
    const row = rows[i];
    if (!row) continue;
    onProgress?.({ index: i, total, status: 'rendering', row });
    try {
      // A row may carry its own format + output dimensions (e.g. set via CSV);
      // else fall back to the global format and the tool's native size.
      // Per-row unit/DPI fall back to the toolbar defaults. DPI only matters for
      // physical units + raster, so px rows keep the export's native 96.
      const rowUnit = row.unit ?? unit ?? 'px';
      const rowDpi = rowUnit === 'px' ? undefined : (row.dpi ?? dpi ?? 300);
      const t0 = Date.now();
      const { blob, format: fmt, url } = await renderRowToBlob(row, host, {
        format: row.format || format, width: row.outWidth, height: row.outHeight, unit: rowUnit, dpi: rowDpi,
      });
      const ms = Date.now() - t0; // render time, surfaced in the zip manifest
      // Per-row filename wins for the stem (extension stripped — we add the
      // format's); else the tool id. Either way it's prefixed with the row number
      // so files always sort the way the rows appeared in the table.
      const stem = row.filename?.trim()
        ? row.filename.trim().replace(/\.[a-z0-9]{1,5}$/i, '')
        : row.toolId;
      // The seq prefix goes on the basename only so files sort within their
      // folder when the stem carries a nested path (e.g. "event/badges/badge").
      const seq = String(i + 1).padStart(seqWidth, '0');
      const slash = pathAware ? stem.lastIndexOf('/') : -1;
      const base = slash >= 0
        ? `${stem.slice(0, slash + 1)}${seq}-${stem.slice(slash + 1)}`
        : `${seq}-${stem}`;
      const name = uniqueName(usedNames, base, extFor(fmt), pathAware);
      files.push({ name, blob, ms, fmt, url }); // fmt distinguishes pdf-cmyk from pdf; url = reopen-in-Lolly link
      results.push({ index: i, row, ok: true, name, size: blob.size, ms });
      onProgress?.({ index: i, total, status: 'done', row, name });
    } catch (err) {
      results.push({ index: i, row, ok: false, error: errMessage(err) });
      onProgress?.({ index: i, total, status: 'error', row, error: errMessage(err) });
    }
  }

  return { files, results };
}

/**
 * Validate rows before a run: drop empties, flag render-only tools. Returns
 * { renderable, skipped } so the UI can warn before committing to a batch.
 */
export async function planBatch<R extends BatchRunRow>(rows: R[]): Promise<BatchPlan<R>> {
  const renderable: R[] = [];
  const skipped: BatchPlan<R>['skipped'] = [];
  for (const row of rows) {
    if (!row.toolId) { skipped.push({ row, reason: 'No template selected' }); continue; }
    try {
      const tool = await getTool(row.toolId);
      if (!isExportable(tool.manifest)) {
        skipped.push({ row, reason: 'Render-only tool' });
      } else {
        renderable.push(row);
      }
    } catch {
      skipped.push({ row, reason: 'Failed to load template' });
    }
  }
  return { renderable, skipped };
}
