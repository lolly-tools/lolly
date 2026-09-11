// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - render the whole batch, sequentially.
 *
 * Rows are rendered one at a time (concurrency 1) on purpose: tool templates
 * run arbitrary scripts that may touch window globals and the document font
 * loader, and each render mounts a full-size offscreen node. Serial execution
 * keeps memory bounded and avoids cross-tool interference; the export work is
 * the bottleneck regardless, so parallelism buys little here.
 *
 * Failures are isolated - one bad row is recorded and the batch continues.
 */
import { renderRowToBlob, getTool, isExportable } from './render-export.ts';
import { deriveExportFilename } from '@lolly/engine';
import { playSfx } from '../lib/sfx.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/** A batch row with the per-row export overrides the grid / CSV can set. */
export interface BatchRow {
  /**
   * Stable, opaque identity assigned where this array was ASSEMBLED (the /pro grid's
   * row uid; a folder row's path + session ref + ordinal). NEVER an index:
   * `BatchProgress.index` / `BatchResult.index` are positions in the array handed to
   * {@link runBatch}, and `planBatch` COMPACTS the array, so an index captured before
   * it points at a different row afterwards. Anything that names a row to a HUMAN - a
   * log line, a preflight finding, a skipped-row report - keys on `uid`; only the
   * queue's own arithmetic (seq prefix, `n / total`) uses the index.
   *
   * Optional so every existing call site keeps compiling; deliberately NOT added to
   * `render-export.ts`'s local `BatchRow` (identity must not cross the render
   * boundary - that file's "add a field to all three row declarations" rule has this
   * as its one documented exception).
   */
  uid?: string;
  toolId: string;
  values: Record<string, unknown>;
  unit?: string;
  dpi?: number;
  format?: string;
  outWidth?: number;
  outHeight?: number;
  filename?: string;
  /** CMYK press condition (the `profile` URL param), for pdf-cmyk / cmyk-tiff. */
  profile?: string;
  /** Bleed as a dimension string, e.g. "3mm". */
  bleed?: string;
  /** Print marks as the `marks` CSV - decoded by lib/print-marks-csv.ts. */
  marks?: string;
}

/** A rendered output ready for packaging. */
export interface BatchFile {
  name: string;
  blob: Blob;
  ms: number;
  fmt: string;
  url: string;
}

/**
 * How every progress event and every result names a row. Extracted so the meaning
 * of `index` is written down ONCE rather than six times across two closed unions.
 */
export interface BatchRowRef {
  /**
   * 0-based position in the array handed to {@link runBatch} - the RUNNER index, not
   * the row number the user sees and not a stable identity. `planBatch` compacts, so
   * translate through {@link BatchPlan.srcIndex} before showing a number to a human,
   * and key persistent things on {@link BatchRow.uid}.
   */
  index: number;
}

/**
 * Diagnostics for ONE row, carried through a run untouched.
 *
 * Deliberately NOT a `Finding`: that type is Phase 1's (future home
 * `packages/core/src/preflight.ts`) and does not exist yet. Nothing in this module
 * ever inspects an element - it only guarantees WHICH row an entry belongs to. When
 * Phase 1 lands, call sites instantiate `runBatch<Finding>(…)` and every consumer
 * types through automatically, with no cast to delete anywhere.
 */
export type RowNotes<F = unknown> = readonly F[];

/**
 * Diagnostics for a whole run, PARALLEL to the rows array handed to {@link runBatch}:
 * `notes[i]` describes `rows[i]`, and `notes.length === rows.length`.
 *
 * A parallel array rather than a Map keyed by index precisely because its length can
 * be asserted against `rows.length` - an index-space mismatch is the failure mode this
 * channel exists to prevent, and a Map cannot detect one. {@link notesFromFindings}
 * builds it from {@link BatchPlan.findings}.
 */
export type BatchNotes<F = unknown> = ReadonlyArray<RowNotes<F> | undefined>;

/** The notes for a row, re-emitted by the runner. Never inspected here. */
interface BatchRowNotes<F> {
  notes?: RowNotes<F>;
}

/** Per-row outcome of a run. */
export type BatchResult<F = unknown> =
  | (BatchRowRef & BatchRowNotes<F> & { row: BatchRow; ok: true; name: string; size: number; ms: number })
  | (BatchRowRef & BatchRowNotes<F> & { row: BatchRow; ok: false; error: string });

/** Progress event emitted per row as a run proceeds. */
export type BatchProgress<F = unknown> =
  | (BatchRowRef & { total: number; status: 'cancelled' })
  | (BatchRowRef & { total: number; status: 'rendering'; row: BatchRow })
  | (BatchRowRef & BatchRowNotes<F> & { total: number; status: 'done'; row: BatchRow; name: string; blob: Blob; fmt: string; ms: number })
  | (BatchRowRef & BatchRowNotes<F> & { total: number; status: 'error'; row: BatchRow; error: string });

/**
 * Flatten {@link BatchPlan.findings} (sparse, keyed by queue position) into the dense
 * parallel array {@link runBatch} takes. Skipped rows (`rowIndex === -1`) are dropped
 * on purpose: they have no queue position, so they belong to the run REPORT
 * (`pro/manifest.ts`), never to the runner's per-row channel.
 */
export function notesFromFindings<F>(
  findings: ReadonlyArray<{ rowIndex: number; items: F[] }> = [],
  total = 0,
): BatchNotes<F> {
  const out: Array<RowNotes<F> | undefined> = new Array(total).fill(undefined);
  for (const f of findings) {
    if (f.rowIndex < 0 || f.rowIndex >= total) continue;
    const prev = out[f.rowIndex];
    out[f.rowIndex] = prev ? [...prev, ...f.items] : f.items;
  }
  return out;
}

/** Options controlling a batch run. */
export interface RunBatchOpts<F = unknown> {
  format?: string;
  unit?: string;
  dpi?: number;
  onProgress?: (p: BatchProgress<F>) => void;
  isCancelled?: () => boolean;
  pathAware?: boolean;
  /**
   * Per-row diagnostics, PARALLEL to `rows` (see {@link BatchNotes}). Re-emitted on the
   * `done`/`error` events and on each {@link BatchResult}, by reference and never
   * inspected. A length mismatch is logged, not thrown - a wrong-row diagnostic is worse
   * than none, but it must not take a render down.
   */
  notes?: BatchNotes<F>;
  /** AES-256 lock applied to any pdf/pdf-cmyk rows (ignored for other formats). */
  strongPassword?: string;
  /**
   * RUN-LEVEL print settings - the batch grid's toolbar defaults, exactly like
   * `format`/`unit`/`dpi` above: a row that carries its own value wins, a row that
   * does not inherits these. `renderRowToBlob` reads all three off the ROW, so
   * {@link resolvePrintSettings} merges them onto a copy of the row at the render
   * boundary (the row object the caller handed in is never mutated - progress and
   * results keep reporting the row as the user declared it).
   *
   * `profile` is a CMYK press condition (engine CMYK_CONDITIONS ids), `bleed` a
   * dimension string ("3mm"), `marks` the `marks` CSV (lib/print-marks-csv.ts).
   *
   * Callers may pass them unconditionally because {@link printSettingsFor} GATES them
   * on the row's resolved format - they are NOT "ignored by every non-print format".
   * A raster row handed a bleed renders no bleed and no marks (only renderPdf /
   * renderCmykPdf / renderCmykTiff call `printGeometry`) but the export bridge still
   * builds a C2PA `c2pa.edited` action from the same opts, so an ungated merge signed
   * "Added 3mm bleed, crop marks…" into every PNG in the batch and wrote print params
   * into its recreate URL. See {@link printSettingsFor} for the gate.
   */
  profile?: string;
  bleed?: string;
  marks?: string;
  /**
   * Lolly pixel imprint, forwarded to every row (renderRowToBlob opts.imprint - 
   * the bridge embeds it on raster formats and ignores it elsewhere). Opt-in
   * only, never a default: unlike c2pa/watermark (policy defaults renderRowToBlob
   * applies itself), imprint mirrors the export panel's toggle (tool-actions
   * [data-action="imprint"], seeded by ?imprint=). Sessions don't persist it
   * (sessionSnapshot writes no __export_imprint), so there's no per-row channel - 
   * callers thread the live toggle's run-level value here.
   */
  imprint?: boolean;
}

/** The three print settings, at either level (run default or per row). */
export interface PrintSettings {
  /** CMYK press condition (the `profile` URL param), for pdf-cmyk / cmyk-tiff. */
  profile?: string;
  /** Bleed as a dimension string, e.g. "3mm". */
  bleed?: string;
  /** Print marks as the `marks` CSV - decoded by lib/print-marks-csv.ts. */
  marks?: string;
}

/**
 * Per-row print settings win over the run-level defaults - the same precedence
 * `runBatch` already applies to `format`, `unit` and `dpi`, stated once here so
 * the rule has a single home and a test can pin it.
 *
 * An EMPTY STRING counts as absent, not as "explicitly off". That is not a
 * convenience: `''` is exactly what the single-tool export panel writes for these
 * three when the print card is switched off (`readBleed`/`readMarks` in
 * views/tool-actions.ts return `''`), so a session saved with print off must
 * inherit the run's setting rather than assert a bleed of nothing. Every consumer
 * downstream is already `if (row.bleed)`-shaped, so `''` and `undefined` behave
 * identically once resolved.
 */
export function resolvePrintSettings(row: PrintSettings, run: PrintSettings = {}): PrintSettings {
  const pick = (a: string | undefined, b: string | undefined): string | undefined =>
    (a != null && a !== '') ? a : (b != null && b !== '' ? b : undefined);
  return {
    profile: pick(row.profile, run.profile),
    bleed: pick(row.bleed, run.bleed),
    marks: pick(row.marks, run.marks),
  };
}

/**
 * The formats that actually consume print settings: the three that call the engine's
 * `printGeometry` (renderPdf, renderCmykPdf, renderCmykTiff). Every other format
 * renders no bleed and no marks whatever it is handed.
 */
const PRINT_FORMATS = new Set(['pdf', 'pdf-cmyk', 'cmyk-tiff']);

/**
 * The print settings a row should actually carry into the render, given the format it
 * RESOLVES to (`row.format || runFormat`).
 *
 * This is the gate, and it exists because "the non-print formats ignore these" was
 * false. `renderRowToBlob` turns `profile`/`bleed`/`marks` into `exportOpts`
 * (`colorProfile`/`bleed`/`cropMarks`/…) for every format, and the export bridge builds
 * the signed C2PA `c2pa.edited` action out of those opts - so a PNG rendered under a
 * run-level 3mm bleed shipped a cryptographically signed claim that bleed and crop
 * marks were applied, when the raster path never applied either. The same row's
 * recreate URL carried `bleed=3mm&marks=…` for a PNG. Gating in ONE place covers the
 * run-level values, the per-row values inherited from a batch snapshot, and the URL,
 * because all three are serialised from the row copy this produces.
 *
 * When the format cannot be resolved here (no per-row format and no run format - the
 * folder/selection paths, where `chooseFormat` picks the tool's native format later),
 * the row's OWN settings are kept and the run-level defaults are not applied: a value
 * the user attached to that one row is evidence, a toolbar default is not. Gating on
 * the finally-chosen `fmt` inside `render-export.ts` would close that last gap; that
 * file's export internals are owned elsewhere - see the hand-off note in the return.
 */
export function printSettingsFor(row: PrintSettings & { format?: string }, run: PrintSettings = {}, runFormat?: string): PrintSettings {
  const resolved = String(row.format || runFormat || '').toLowerCase();
  if (PRINT_FORMATS.has(resolved)) return resolvePrintSettings(row, run);
  // Unknown format → the row's own declarations only, never the run's.
  if (!resolved) return resolvePrintSettings(row, {});
  return { profile: undefined, bleed: undefined, marks: undefined };
}

const FMT_EXT: Record<string, string> ={ 'pdf-cmyk': 'pdf', jpeg: 'jpg', 'eps-cmyk': 'eps', 'svg-anim': 'svg', 'webp-anim': 'webp' };
const extFor = (fmt: string): string => FMT_EXT[fmt] ?? fmt;

const sanitizeSeg = (s: string): string => s.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Ensure unique, filesystem-safe names within the zip. With `pathAware`, the
 * base may carry `/` separators (a grouped/folder export wants nested zip
 * directories) - each path segment is sanitized but the separators are kept, so
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
 * @param {Array<{toolId:string, values:object}>} rows  rows with a chosen tool
 * @param {HostV1} host
 * @param {object} opts
 * @param {string} [opts.format]                 preferred export format
 * @param {(p:object)=>void} [opts.onProgress]   progress callback
 * @param {()=>boolean} [opts.isCancelled]       cooperative cancel check
 * @returns {Promise<{files:Array<{name,blob}>, results:Array}>}
 */
export async function runBatch<F = unknown>(
  rows: BatchRow[],
  host: HostV1,
  { format, unit, dpi, onProgress, isCancelled, pathAware = false, strongPassword, imprint, profile, bleed, marks, notes }: RunBatchOpts<F> = {},
): Promise<{ files: BatchFile[]; results: BatchResult<F>[] }> {
  const files: BatchFile[] = [];
  const results: BatchResult<F>[] = [];
  const usedNames = new Set<string>();
  const total = rows.length;
  // The channel's one invariant, checked where both lengths are in hand. Nothing may
  // filter, sort or splice the array between planBatch returning and runBatch receiving
  // it (see planBatch's JSDoc) - this is what catches a caller that did.
  if (notes && notes.length !== rows.length) {
    host.log?.('warn', `runBatch: notes/rows length mismatch (${notes.length} vs ${rows.length}) - per-row diagnostics dropped rather than mis-attributed`);
    notes = undefined;
  }
  const notesFor = (i: number): RowNotes<F> | undefined => {
    const n = notes?.[i];
    return n?.length ? n : undefined;
  };
  // Every file is prefixed with its 1-based position in the batch, zero-padded to
  // the batch size, so the names sort in row order in the zip / file explorer - 
  // named rows included. Pad width tracks the count so e.g. row 100 sorts after
  // row 99 (a fixed 2-digit pad would order "100" before "99" lexically).
  const seqWidth = Math.max(2, String(total).length);

  // Content-derived auto stem (plans/140 S1): a row without an explicit filename
  // names itself from its own values via render.filenameFrom, so "03-ana-kovac.png"
  // both sorts and reads at the event desk. Best-effort - any lookup failure keeps
  // the tool-id fallback exactly as before.
  const autoStem = async (row: BatchRow): Promise<string | null> => {
    try {
      const { manifest } = await getTool(row.toolId);
      return deriveExportFilename(manifest as Parameters<typeof deriveExportFilename>[0], row.values);
    } catch { return null; }
  };

  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) {
      onProgress?.({ index: i, total, status: 'cancelled' });
      break;
    }
    const row = rows[i]!;
    onProgress?.({ index: i, total, status: 'rendering', row });
    try {
      // A row may carry its own format + output dimensions (e.g. set via CSV);
      // else fall back to the global format and the tool's native size.
      // Per-row unit/DPI fall back to the toolbar defaults. DPI only matters for
      // physical units + raster, so px rows keep the export's native 96.
      const rowUnit = row.unit ?? unit ?? 'px';
      const rowDpi = rowUnit === 'px' ? undefined : (row.dpi ?? dpi ?? 300);
      // Print settings resolve the same way, but they live ON the row as far as
      // renderRowToBlob is concerned, so the merge produces a COPY. The original
      // `row` is what progress/results report, and it stays untouched. The merge is
      // GATED on the row's resolved format (printSettingsFor): a non-print row is
      // handed no print settings at all, so it cannot sign a C2PA claim about bleed
      // and marks it never rendered, nor put them in its recreate URL.
      const printed: BatchRow = { ...row, ...printSettingsFor(row, { profile, bleed, marks }, format) };
      const t0 = Date.now();
      const { blob, format: fmt, url } = await renderRowToBlob(printed as Parameters<typeof renderRowToBlob>[0], host, {
        format: row.format || format, width: row.outWidth, height: row.outHeight, unit: rowUnit as NonNullable<Parameters<typeof renderRowToBlob>[2]>['unit'], dpi: rowDpi, strongPassword, imprint,
      });
      const ms = Date.now() - t0; // render time, surfaced in the zip manifest
      // Per-row filename wins for the stem (extension stripped - we add the
      // format's); else the tool id. Either way it's prefixed with the row number
      // so files always sort the way the rows appeared in the table.
      const stem = row.filename?.trim()
        ? row.filename.trim().replace(/\.[a-z0-9]{1,5}$/i, '')
        : (await autoStem(row)) ?? row.toolId;
      // The seq prefix goes on the basename only so files sort within their
      // folder when the stem carries a nested path (e.g. "event/badges/badge").
      const seq = String(i + 1).padStart(seqWidth, '0');
      const slash = pathAware ? stem.lastIndexOf('/') : -1;
      const base = slash >= 0
        ? `${stem.slice(0, slash + 1)}${seq}-${stem.slice(slash + 1)}`
        : `${seq}-${stem}`;
      const name = uniqueName(usedNames, base, extFor(fmt), pathAware);
      files.push({ name, blob, ms, fmt, url }); // fmt distinguishes pdf-cmyk from pdf; url = reopen-in-Lolly link
      results.push({ index: i, row, ok: true, name, size: blob.size, ms, notes: notesFor(i) });
      onProgress?.({ index: i, total, status: 'done', row, name, blob, fmt, ms, notes: notesFor(i) });
      playSfx('ding'); // a quiet, satisfying "one done" - fires for EVERY render path through runBatch
    } catch (err) {
      // `err` is unknown in a strict catch; read `.message` off it exactly as the
      // JS did (cast is erased, runtime behaviour unchanged).
      results.push({ index: i, row, ok: false, error: String((err as { message?: unknown })?.message ?? err), notes: notesFor(i) });
      onProgress?.({ index: i, total, status: 'error', row, error: String((err as { message?: unknown })?.message ?? err), notes: notesFor(i) });
    }
  }

  return { files, results };
}

/**
 * Injected dependencies for {@link planBatch}. Defaults are the static imports from
 * `render-export.ts`; overriding them is what makes the planner drivable in a unit
 * test with no catalog (the same dependency inversion `folder-rows.ts` uses via
 * `FolderHost`).
 */
export interface PlanBatchDeps<F = unknown> {
  /**
   * Per-row pre-pass producing an opaque findings payload. SEAM: the element type `F`
   * is supplied by the caller - Phase 1's `Finding` (future home:
   * `packages/core/src/preflight.ts`) slots in as `planBatch<Finding>(rows, …)` with
   * no other change here. This module deliberately declares no findings shape.
   *
   * `rowIndex` is the row's position in the array `runBatch` will be handed
   * (i.e. in `renderable`), or **-1** for a skipped row, which has no queue position
   * at all. `ctx.srcIndex` is always its position in the array passed IN.
   */
  check?: (row: BatchRow, rowIndex: number, ctx: { srcIndex: number; skippedReason?: string }) => F[];
  getTool?: (toolId: string) => Promise<{ manifest: unknown }>;
  isExportable?: (manifest: any) => boolean;
}

/**
 * The plan for a run. `renderable`/`skipped` are unchanged; the two new arrays exist
 * because compaction destroys positional identity and nothing downstream could
 * recover it.
 */
export interface BatchPlan<F = unknown> {
  /** Rows that will be handed to {@link runBatch}, in queue order. */
  renderable: BatchRow[];
  /** Rows dropped before the run, each with the source position + identity it had. */
  skipped: Array<{ row: BatchRow; reason: string; srcIndex: number; uid?: string }>;
  /** `renderable[k]` came from `rows[srcIndex[k]]` - the mapping compaction erases. */
  srcIndex: number[];
  /**
   * Opaque per-row findings. `rowIndex` is an index into `renderable` (exactly what
   * `runBatch` emits as `BatchProgress.index`), or -1 for a skipped row; `uid` rides
   * beside it so a finding is nameable to a human even with no queue position.
   */
  findings: Array<{ rowIndex: number; uid?: string; items: F[] }>;
}

/**
 * Validate rows before a run: drop empties, flag render-only tools. Returns
 * { renderable, skipped } so the UI can warn before committing to a batch.
 *
 * **This function COMPACTS**: `renderable[k]` is not `rows[k]`. Two properties are
 * required and both are now pinned by `batch.test.ts` - it never CLONES (every
 * pushed row is reference-identical to its input), and it now reports the mapping it
 * destroys (`srcIndex`, and `srcIndex`/`uid` on each skipped entry). See
 * {@link BatchRow.uid}: the index is a queue position, the uid is the row.
 */
export async function planBatch<F = unknown>(
  rows: BatchRow[],
  { check, getTool: getToolDep = getTool, isExportable: isExportableDep = isExportable }: PlanBatchDeps<F> = {},
): Promise<BatchPlan<F>> {
  const renderable: BatchRow[] = [];
  const skipped: BatchPlan<F>['skipped'] = [];
  const srcIndex: number[] = [];
  const findings: BatchPlan<F>['findings'] = [];
  // Both numbers are known only here, inside the one loop that sees the input
  // position and the queue position at the same time - so they are captured together.
  const record = (row: BatchRow, rowIndex: number, srcIdx: number, skippedReason?: string) => {
    if (!check) return;
    const items = check(row, rowIndex, { srcIndex: srcIdx, skippedReason });
    if (items?.length) findings.push({ rowIndex, uid: row.uid, items });
  };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const drop = (reason: string) => { skipped.push({ row, reason, srcIndex: i, uid: row.uid }); record(row, -1, i, reason); };
    if (!row.toolId) { drop('No template selected'); continue; }
    try {
      const tool = await getToolDep(row.toolId);
      if (!isExportableDep(tool.manifest)) {
        drop('Render-only tool');
      } else {
        renderable.push(row);
        srcIndex.push(i);
        record(row, renderable.length - 1, i);
      }
    } catch {
      drop('Failed to load template');
    }
  }
  return { renderable, skipped, srcIndex, findings };
}
