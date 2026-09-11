// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - the run REPORT: which rows produced a file, which did not, and
 * why.
 *
 * Pure and dependency-free (no fflate, no DOM, no engine) so it is unit-testable and
 * so `zip.ts` stays about bytes. Two consumers, deliberately fed from the same
 * assembly so they can never disagree: the human `lolly.txt` block and the machine
 * `preflight.json` member.
 *
 * **Index identity is the whole point of this module.** Three index spaces exist:
 *
 *   - SOURCE - position in the array the user assembled (the /pro grid, or
 *     `rowsForFolder`'s concatenated output). The only number a human can point at.
 *   - RUNNER - position in the array handed to `runBatch`, i.e. `planBatch().renderable`.
 *     What `BatchProgress.index` / `BatchResult.index` and the zip's `NN-` prefix speak.
 *   - FILE - position in `files[]`.
 *
 * `planBatch` compacts, so an index captured before it points at a different row
 * afterwards; `BatchPlan.srcIndex` is the only bridge, and every row number that
 * reaches a person goes through it. A row number is therefore always a FIELD here,
 * never a substring baked into a sentence.
 */

/** The least a row must be for the report to name it. */
export interface LabelledRow {
  toolId?: string;
  filename?: string;
  uid?: string;
}

/**
 * The most specific handle a row has BEFORE it renders: the filename stem the user
 * set, else the tool id. Never a promise about the output name - `uniqueName` may
 * de-duplicate it, and a row that never rendered has no output name at all.
 */
export const rowLabel = (row?: LabelledRow): string =>
  row?.filename?.trim() || row?.toolId || '(no template)';

/** Why a row is in the job but not in the zip. */
export type UnmadeState = 'skipped' | 'failed' | 'cancelled';

/** A row that produced no file. */
export interface UnmadeRow {
  /** 1-based SOURCE position - `null` only when the assembler supplied no mapping. */
  row: number | null;
  /**
   * 0-based RUNNER position, or `null` for a skipped row - which never entered the
   * queue and so has no position in it. Carried for the machine sidecar only; the
   * text manifest prints `row` and nothing else, because runner space is not a
   * number a person can point at.
   */
  runIndex: number | null;
  label: string;
  uid?: string;
  state: UnmadeState;
  /** planBatch's reason, the caught message, or the cancelled sentence. */
  reason: string;
  /** Already flattened to lines by the caller - the manifest never sees note objects. */
  notes?: readonly string[];
}

/** The reason recorded for a row the run never reached. */
export const CANCELLED_REASON = 'The run was cancelled before this row';

/** A row outcome as the runner reports it (structural - see `batch.ts` BatchResult). */
export interface ResultLike {
  index: number;
  ok: boolean;
  error?: string;
  name?: string;
  row?: LabelledRow;
}

/** A row planBatch dropped before the run (structural - see `batch.ts` BatchPlan). */
export interface SkippedLike {
  row?: LabelledRow;
  reason: string;
  srcIndex?: number;
  uid?: string;
}

/** Everything the report needs about one finished run. */
export interface RunReportInput {
  /** The RUNNER array - exactly what was handed to `runBatch`. */
  rows: readonly LabelledRow[];
  /** `srcIndex[k]` is the 0-based SOURCE position of `rows[k]`. Identity mapping when absent. */
  srcIndex?: readonly number[];
  results: readonly ResultLike[];
  skipped?: readonly SkippedLike[];
  /**
   * SEAM (Phase 1): the diagnostics for runner row `k`, already flattened to display
   * lines by the caller. Kept as a callback rather than an array so this module never
   * holds an opaque payload it cannot render.
   */
  noteLines?: (runnerIndex: number) => readonly string[];
}

/** 1-based source row number for a runner index. */
const sourceRow = (input: RunReportInput, k: number): number | null => {
  if (!input.srcIndex) return k + 1;
  const s = input.srcIndex[k];
  return s == null ? null : s + 1;
};

const byRow = (a: { row: number | null }, b: { row: number | null }): number =>
  (a.row ?? Number.POSITIVE_INFINITY) - (b.row ?? Number.POSITIVE_INFINITY);

/**
 * Every row of the job that produced no file: skipped before the run, failed during
 * it, or never attempted because the run was cancelled.
 *
 * "Never attempted" is derived from absence - `runBatch` emits one `cancelled` event
 * and then stops pushing results, so a runner row with no result at all is a row the
 * queue never reached. Cancelled is NOT folded into failed: they are different
 * promises, and only one of them is worth a Retry button.
 */
export function collectUnmade(input: RunReportInput): UnmadeRow[] {
  const { rows, results, skipped = [], noteLines } = input;
  const out: UnmadeRow[] = [];

  for (const r of results) {
    if (r.ok) continue;
    const row = rows[r.index] ?? r.row;
    out.push({
      row: sourceRow(input, r.index),
      runIndex: r.index,
      label: rowLabel(row),
      uid: row?.uid,
      state: 'failed',
      reason: r.error || 'Render failed',
      notes: noteLines?.(r.index)?.length ? noteLines(r.index) : undefined,
    });
  }

  const attempted = new Set(results.map(r => r.index));
  for (let k = 0; k < rows.length; k++) {
    if (attempted.has(k)) continue;
    out.push({
      row: sourceRow(input, k),
      runIndex: k,
      label: rowLabel(rows[k]),
      uid: rows[k]?.uid,
      state: 'cancelled',
      reason: CANCELLED_REASON,
      notes: noteLines?.(k)?.length ? noteLines(k) : undefined,
    });
  }

  for (const s of skipped) {
    out.push({
      // A skipped row never entered the runner, so its position comes from planBatch,
      // which captured it at drop time. Absent → we say so rather than guess a number.
      row: s.srcIndex == null ? null : s.srcIndex + 1,
      runIndex: null,
      label: rowLabel(s.row),
      uid: s.uid ?? s.row?.uid,
      state: 'skipped',
      reason: s.reason,
    });
  }

  return out.sort(byRow);
}

// ─── The machine-readable sidecar ───────────────────────────────────────────────

/** One row of `preflight.json` - the index-identity contract, written down. */
export interface PreflightRow {
  /** 1-based SOURCE position. */
  row: number | null;
  /** 0-based RUNNER position; `null` when the row never reached the runner. */
  runIndex: number | null;
  label: string;
  uid?: string;
  state: 'rendered' | UnmadeState;
  /** Zip member name; `null` when the row produced no file. */
  file: string | null;
  reason: string | null;
  /**
   * SEAM (Phase 1): opaque, serialized as handed over. Phase 2 fixes only the
   * ENVELOPE - version, row identity, the state vocabulary, the caveat siblings.
   * Typed `unknown[]` on purpose: inventing half a `Finding` here is the retrofit
   * hazard running the other way.
   */
  findings: unknown[];
}

/** The `preflight.json` envelope. Shape fixed in Phase 2, before money exists. */
export interface PreflightReport {
  schema: 'lolly.preflight/1';
  generated: string;
  engine: string;
  job: {
    zipName: string;
    rowsRequested: number;
    rowsRendered: number;
    cancelled: boolean;
    /** Set when this package is a retry of an earlier one, naming it. */
    retryOf?: string;
  };
  rows: PreflightRow[];
  /**
   * Findings that belong to the RUN, not to any row: properties of the platform
   * ("Lolly cannot predict the output file size") or of the brand (an unresolved
   * palette). Emitted once here rather than repeated against all 500 rows - see
   * `pro/preflight-rows.ts` RUN_LEVEL_IDS for why that repetition is a defect and
   * not thoroughness. Opaque, exactly like a row's `findings`.
   */
  runFindings: unknown[];
  /**
   * Phase 2 counts and does no arithmetic. `kind` and the three null money fields ship
   * from day one so every consumer handles the null branch BEFORE Phase 4 can emit a
   * number - an absent field must never be forgeable as zero.
   */
  kind: 'counts-only';
  isQuote: false;
  estimatedTotalFromSuppliedRates: null;
  ratesFrom: null;
  disclaimer: string;
}

export const PREFLIGHT_DISCLAIMER =
  'Arithmetic done here from the rates you supplied. It is not a quote, and only your printer can give you one.';

/** Extra facts the report needs that the run itself does not carry. */
export interface PreflightJobInput extends RunReportInput {
  zipName: string;
  engine: string;
  cancelled?: boolean;
  retryOf?: string;
  /** ISO timestamp; injectable so a test is not a clock. */
  generated?: string;
  /** SEAM (Phase 1): the opaque findings for runner row `k`, serialized verbatim. */
  findings?: (runnerIndex: number) => unknown[];
  /**
   * The findings for rows that never reached the runner, keyed by IDENTITY - a
   * skipped row has no runner index, so there is no positional channel that can carry
   * them. Matched on `uid` when the assembler set one, else on the 1-based source row
   * (`srcIndex + 1`), which is the number every other member of this module speaks.
   */
  skippedFindings?: ReadonlyArray<{ uid?: string; srcIndex: number; items: unknown[] }>;
  /** Run-level findings, verbatim (see {@link PreflightReport.runFindings}). */
  runFindings?: readonly unknown[];
}

/**
 * Assemble the sidecar. Every row of the job appears exactly once - rendered rows and
 * unmade rows alike - ordered by the source row number the user can point at.
 */
export function buildPreflightReport(input: PreflightJobInput): PreflightReport {
  const { rows, results, zipName, engine, findings, skippedFindings = [] } = input;
  // A skipped row is found by what it IS, never by where it sat in a queue it never
  // entered: uid first (stable across a reopen), then the source row number.
  const skippedFor = (uid: string | undefined, row: number | null): unknown[] => {
    const hit = (uid != null && skippedFindings.find(s => s.uid != null && s.uid === uid))
      || (row != null && skippedFindings.find(s => s.srcIndex + 1 === row));
    return hit ? [...hit.items] : [];
  };
  const made: PreflightRow[] = [];
  for (const r of results) {
    if (!r.ok) continue;
    const row = rows[r.index] ?? r.row;
    made.push({
      row: sourceRow(input, r.index),
      runIndex: r.index,
      label: rowLabel(row),
      uid: row?.uid,
      state: 'rendered',
      file: r.name ?? null,
      reason: null,
      findings: findings?.(r.index) ?? [],
    });
  }

  const unmadeRows: PreflightRow[] = collectUnmade(input).map(u => ({
    row: u.row,
    runIndex: u.runIndex,
    label: u.label,
    uid: u.uid,
    state: u.state,
    file: null,
    reason: u.reason,
    // A skipped row never reached the runner, so it has no slot in the runner-space
    // channel - its findings come in by identity instead. They used to be dropped
    // here, which deleted `collect.row-not-rendered` (the finding the collector exists
    // to produce for exactly this row) from the copy that leaves the building.
    findings: u.runIndex == null ? skippedFor(u.uid, u.row) : (findings?.(u.runIndex) ?? []),
  }));

  return {
    schema: 'lolly.preflight/1',
    generated: input.generated ?? new Date().toISOString(),
    engine,
    job: {
      zipName,
      rowsRequested: made.length + unmadeRows.length,
      rowsRendered: made.length,
      cancelled: Boolean(input.cancelled),
      ...(input.retryOf ? { retryOf: input.retryOf } : {}),
    },
    rows: [...made, ...unmadeRows].sort(byRow),
    runFindings: [...(input.runFindings ?? [])],
    kind: 'counts-only',
    isQuote: false,
    estimatedTotalFromSuppliedRates: null,
    ratesFrom: null,
    disclaimer: PREFLIGHT_DISCLAIMER,
  };
}

/** Serialize the sidecar. Pretty-printed: a human opens this file too. */
export const preflightJson = (report: PreflightReport): string =>
  `${JSON.stringify(report, null, 2)}\n`;
