// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - the BATCH PREFLIGHT COLLECTOR.
 *
 * The third fact collector, beside `views/tool-actions.ts` (`refreshPreflight`, the
 * mounted single-tool panel) and `shells/cli/src/preflight.ts` (headless, one job).
 * The engine owns the RULES (`engine/src/preflight.ts`); each shell collects the
 * FACTS from its own platform. This one collects them for ONE ROW of a bulk run,
 * and it is what closes the seam `planBatch`'s `check` was left as:
 *
 *     const { check, runFindings } = await createBatchRowCheck(rows, host, run);
 *     const plan = await planBatch<Finding>(rows, { check });
 *
 * Three channels come out, and they are not interchangeable: the per-row findings on
 * the plan (queue-space, for the runner), `runFindings` (properties of the platform or
 * the brand - see {@link RUN_LEVEL_IDS} - emitted ONCE), and {@link skippedFindings}
 * (the dropped rows, which have no queue position and are keyed by identity).
 *
 * ## Tier 1 only. Nothing here renders, mounts, or exports.
 *
 * A batch pre-pass runs BEFORE the first row is mounted, so every fact that needs a
 * node is a NAMED GAP, never a zero (`plans/65-preflight-and-cost.md` section 4, section 6):
 *
 *   - `stage` is `{ known: false, why: 'needs-mount' }`, exactly as the CLI reports
 *     it. Handing the engine an all-false `StageFacts` would make `isSequence`
 *     read as "checked, and it is not a sequence", so `count.cuts-inert` would
 *     assert an answer no one measured. The `Fact` union has no third shape for
 *     precisely this reason.
 *   - There is no runtime, so `onInit` has NOT run: `modelPhase` is `'declared'`
 *     and every hook-patchable count comes back as a ceiling rather than a fact.
 *
 * ## Settings parity is the whole point
 *
 * A preflight that checks settings the render will not use is worse than none. So
 * every setting below is resolved by the SAME helpers `runBatch` calls, in the same
 * order, and nothing is re-derived:
 *
 *   - format  → `chooseFormat(manifest, row.format || run.format)` - the exact call
 *     `renderRowToBlob` makes, including its fall-through to the tool's first
 *     declared format when neither level named one (the folder/selection paths).
 *   - unit/dpi → `row.unit ?? run.unit ?? 'px'`, and DPI only for a physical unit,
 *     `row.dpi ?? run.dpi ?? 300` - `runBatch`'s two lines, restated nowhere.
 *   - bleed/marks/press profile → `printSettingsFor(row, run, run.format)`, the
 *     GATE itself, imported from `./batch.ts`. Row-beats-run precedence and the
 *     "non-print formats carry none of these" rule therefore hold by construction:
 *     if the gate ever changes, preflight moves with the renderer.
 *
 * ## No currency, no rates, no money
 *
 * Counts and findings only, permanently. See `plans/65-preflight-and-cost.md` section 6, section 8.
 */

import { buildInputModel, isUnit, parseDimension, preflight } from '@lolly/engine';
import type {
  Fact, Finding, FindingId, PreflightInput, PreflightJob, PreflightManifest, PreflightSize,
  PreflightSource, PreflightSwatch,
} from '@lolly/engine';
import type { Unit } from '../../../../engine/src/units.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { csvToMarks } from '../lib/print-marks-csv.ts';
import { RASTER_DEFAULT_SCALE, SUPERSAMPLED_EXPORT_FORMATS } from '../bridge/export-scale.ts';
import { printSettingsFor, type BatchPlan, type BatchRow, type PrintSettings } from './batch.ts';
import { chooseFormat, getTool } from './render-export.ts';

/**
 * The RUN-LEVEL settings a row inherits - the /pro toolbar's defaults, or the
 * folder exporter's arguments. Structurally the subset of `RunBatchOpts` that
 * affects what a row renders as; named separately so a call site cannot pass a
 * progress callback and think it was preflighted.
 *
 * `strongPassword` is deliberately ABSENT: `/pro` asks for the export lock AFTER
 * `planBatch` has run, so at collection time nobody knows whether the job is
 * locked. Reporting `password: false` there would be an assertion about a setting
 * the user had not yet been asked for; no engine check reads it today, so the
 * member is simply not built.
 */
export interface BatchRunSettings {
  format?: string;
  unit?: string;
  dpi?: number;
  /** CMYK press condition (the `profile` URL param). Not a user profile. */
  profile?: string;
  bleed?: string;
  marks?: string;
}

/**
 * Everything the per-row job needs that is RUN-INVARIANT, resolved once by
 * {@link createBatchRowCheck} and shared by every row.
 *
 * The palette is the reason this type exists. `host.tokens.colors()` is async and
 * is a property of the BRAND, not of the job (`plans/65-preflight-and-cost.md` section 4), so
 * resolving it per row would be N awaits for one answer - and `check` is
 * synchronous, so it could not await at all. One resolve, one shared `Fact`.
 */
export interface BatchPreflightEnv {
  run: BatchRunSettings;
  /** `host.tokens.colors()`, or a named refusal. See {@link resolveBatchPalette}. */
  palette: Fact<readonly PreflightSwatch[]>;
  /** The user profile, so `bindToProfile` inputs resolve as a render would see
   *  them. Opaque here: it is handed straight to `buildInputModel`. */
  profile?: unknown;
  /** Which collector took the facts. `'web'` unless a test says otherwise. */
  source?: PreflightSource;
}

/** The context `planBatch` hands its `check` - restated so this module can be
 *  driven without importing the planner's private shape. */
export interface RowCheckCtx {
  /** The row's position in the array passed IN to `planBatch` - the number the
   *  grid shows and the only one a human can act on. */
  srcIndex: number;
  /** Present only for a row `planBatch` dropped. */
  skippedReason?: string;
}

/**
 * The manifest slice preflight reads.
 *
 * Narrowed explicitly rather than passed through, for the same reason
 * `tool-actions.ts` narrows it: `RenderSpec.video` is a `Record<string, unknown>`
 * bag and the two numbers preflight wants have to be PROVED to be numbers here.
 * Keep this in step with `views/tool-actions.ts`'s `preflightManifest` - they are
 * the same slice taken from the same type, and a member added to one belongs in
 * the other.
 */
export function toPreflightManifest(manifest: ToolManifest): PreflightManifest {
  const vidNum = (k: string): number | undefined => {
    const v = (manifest.render?.video as Record<string, unknown> | undefined)?.[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };
  return {
    id: manifest.id,
    status: manifest.status,
    render: {
      width: manifest.render?.width,
      height: manifest.render?.height,
      formats: manifest.render?.formats,
      export: manifest.render?.export,
      paginate: manifest.render?.paginate,
      pages: manifest.render?.pages,
      video: { wait: vidNum('wait'), duration: vidNum('duration') },
      aspectWarning: manifest.render?.aspectWarning,
    },
    inputs: manifest.inputs,
  };
}

/**
 * True when this row's still raster will be scaled by `RASTER_DEFAULT_SCALE` - i.e.
 * when it goes through `rasterStyle`'s not-requested branch.
 *
 * The base set is the bridge's own ({@link SUPERSAMPLED_EXPORT_FORMATS}); the one
 * addition is `cmyk-tiff`, which is conditional and so cannot live in a plain set.
 */
function isSupersampled(format: string, print: PrintSettings): boolean {
  const f = format.toLowerCase();
  if (SUPERSAMPLED_EXPORT_FORMATS.has(f)) return true;
  // renderCmykTiff: `geo ? coverRasterStyle(…) : rasterStyle(d, opts)`, and
  // `printGeometry` returns null when there is no bleed and no mark.
  if (f !== 'cmyk-tiff') return false;
  const marks = print.marks ? csvToMarks(print.marks) : null;
  const anyMark = !!marks && Object.values(marks).some(Boolean);
  const bleed = print.bleed ? parseDimension(print.bleed) : null;
  return !anyMark && !(bleed && bleed.value > 0);
}

/**
 * The output size THIS ROW will render at, as `renderRowToBlob` and the export
 * bridge together resolve it.
 *
 * Three properties are required and none of them is obvious:
 *
 * 1. **One declared dimension IS a declaration.** `renderRowToBlob` computes
 *    `bothGiven` for LAYOUT only; `outW`/`outH` are built independently
 *    (`render-export.ts:315-317`), so a row carrying `outWidth: 210` with
 *    `unit: 'mm'` and no height really does hand the export boundary
 *    `width: '210mm'`, and the PDF page really is 210mm wide. Reporting the
 *    manifest's pixel canvas for it made the engine say "no physical page size was
 *    declared" about a job that declared one. So any positive dimension is
 *    `declaredBy: 'row'` and the missing one is left at 0 - the CLI's `sizeFacts`
 *    shape exactly, which drives `print.trim-partially-declared`, the truthful
 *    finding, and blocks every area/pixel derivation (`physicalTrim` requires both
 *    `> 0`).
 * 2. **A dimension-less raster row does not render at the manifest canvas.** With
 *    neither dimension given, `exportOpts.width/height` are `undefined`,
 *    `rasterStyle` takes its NOT-`requested` branch and the output is the node box
 *    times {@link RASTER_DEFAULT_SCALE}. A 600 x 600 tool produces a 1200 x 1200
 *    PNG, so reporting 600 x 600 shipped a `bound: 'exact'` pixel count four times
 *    too small on the commonest batch row there is. Vector/PDF rows keep the
 *    unscaled box: `toPoints` is applied to the node box and `rasterStyle` never
 *    runs for them.
 * 3. **`unitDeclared` is true only when a unit was SPELLED OUT** - by the row's own
 *    `unit` cell or by the run's toolbar unit. `runBatch` defaults to `'px'` when
 *    neither did, and a `px` fallback is not a declaration: with `unitDeclared`
 *    false the engine refuses to derive a print area rather than trusting a unit
 *    nobody typed.
 *
 * `format`/`print` are resolved here when the caller does not supply them, by the
 * same two helpers `preflightJobForRow` uses, so a 3-argument call is still right.
 */
export function rowSize(
  row: BatchRow,
  manifest: PreflightManifest,
  run: BatchRunSettings,
  resolved?: { format?: string; print?: PrintSettings },
): PreflightSize {
  // runBatch, verbatim: `row.unit ?? unit ?? 'px'`, and DPI only off a physical unit.
  const rawUnit = row.unit ?? run.unit;
  const u: Unit = rawUnit != null && isUnit(rawUnit) ? rawUnit : 'px';
  const rowDpi = u === 'px' ? undefined : (row.dpi ?? run.dpi ?? 300);
  const w = row.outWidth ?? 0, h = row.outHeight ?? 0;
  if (!(w > 0) && !(h > 0)) {
    const format = resolved?.format ?? chooseFormat(manifest as ToolManifest, row.format || run.format || null);
    const print = resolved?.print
      ?? printSettingsFor(row, { profile: run.profile, bleed: run.bleed, marks: run.marks }, run.format);
    // The renderer's own two lines, restated: `rasterStyle`'s not-requested branch
    // is `Math.round(d.node.w * (opts.scale ?? RASTER_DEFAULT_SCALE))`, and the node
    // box for a dimension-less row IS the manifest canvas (`layoutW = nativeW`).
    const scale = isSupersampled(format, print) ? RASTER_DEFAULT_SCALE : 1;
    return {
      width: { value: (manifest.render?.width ?? 0) * scale, unit: 'px' },
      height: { value: (manifest.render?.height ?? 0) * scale, unit: 'px' },
      // A manifest canvas is bare pixels by construction, so the CSS convention
      // (96) is the only honest resolution to report for it.
      dpi: 96,
      declaredBy: 'manifest',
      unitDeclared: false,
    };
  }
  return {
    // The dimension that was NOT declared stays 0 - never zero-filled from the
    // manifest, never mirrored from the other one. Zero is what `physicalTrim` and
    // `checkRasterPixels` both refuse to derive from, which is the point.
    width: { value: w > 0 ? w : 0, unit: u },
    height: { value: h > 0 ? h : 0, unit: u },
    // Same defaulting the export path applies: 300 for a physical unit, CSS 96 for
    // pixels. A non-positive DPI is dropped rather than echoed.
    dpi: rowDpi != null && rowDpi > 0 ? rowDpi : (u === 'px' ? 96 : 300),
    declaredBy: 'row',
    unitDeclared: rawUnit != null && isUnit(rawUnit),
  };
}

/**
 * Build the `PreflightJob` for ONE row. Pure, synchronous, no DOM, no I/O.
 *
 * `rowIndex` is stamped with `ctx.srcIndex`, the SOURCE position - NOT the queue
 * position `planBatch` passes in. Every finding carries its `rowIndex` into an
 * artifact that outlives the run (the zip's report, a retry, a log line), and the
 * queue position is a position in a COMPACTED array: for a skipped row it is `-1`,
 * which names nothing at all, and for a renderable row it is a number the user
 * never counted to. `planBatch` keeps the queue position on the plan entry, where
 * the runner's index space needs it; the number written INSIDE the finding is the
 * one a person can find in the grid.
 */
export function preflightJobForRow(
  row: BatchRow,
  manifest: PreflightManifest,
  _rowIndex: number,
  ctx: RowCheckCtx,
  env: BatchPreflightEnv,
): PreflightJob {
  const { run } = env;
  // The format the RENDERER will pick: the row's own, else the run's, else the
  // tool's first declared format. `chooseFormat` is imported, not restated - it
  // also holds the jpg/jpeg equivalence.
  const format = chooseFormat(manifest as ToolManifest, row.format || run.format || null);
  // The GATE, called with exactly the arguments `runBatch` calls it with - the raw
  // `row.format || runFormat`, not the chosen one, because that is what the gate
  // sees at the render boundary. Row beats run; a non-print format keeps none.
  const print = printSettingsFor(row, { profile: run.profile, bleed: run.bleed, marks: run.marks }, run.format);

  // Bleed: a resolved string means the render applies it; nothing resolved means
  // the render applies NONE, which is a known null and not an unknown (the same
  // reading `tool-actions.ts` takes when the print card is off). A string that
  // does not parse is the only real unknown: it is a value that exists and could
  // not be read, never "no bleed".
  const bleedDim = print.bleed ? parseDimension(print.bleed) : null;
  const bleed: Fact<ReturnType<typeof parseDimension>> = print.bleed && !bleedDim
    ? { known: false, why: 'not-resolved' }
    : { known: true, value: bleedDim };

  // The declared model, built WITHOUT a runtime.
  //
  // `buildInputModel` is the engine's own declared-model builder - the same one the
  // CLI collector falls back to when `onInit` cannot run - so this is not a
  // fabricated model, it is the documented `modelPhase: 'declared'` phase, and the
  // engine downgrades every hook-patchable count to a ceiling because of it. The
  // user profile is threaded in so `bindToProfile` inputs hold what a render would
  // see; without it a pre-filled required input would read as blank and
  // `input.required-blank` would fire on a row that renders fine.
  let model: readonly PreflightInput[] | undefined;
  try {
    model = buildInputModel(manifest as ToolManifest, {
      profile: env.profile as never,
      initial: row.values as never,
    }) as unknown as readonly PreflightInput[];
  } catch {
    // A manifest the builder cannot walk drops the model, not the report: the
    // settings and count checks still run, and the input checks are simply absent.
    model = undefined;
  }

  return {
    source: env.source ?? 'web',
    manifest,
    ...(model ? { model } : {}),
    // No runtime, so no hooks have run. Stated, not implied.
    modelPhase: 'declared',
    // The raw cell map, exactly as the grid/CSV/session snapshot holds it, before
    // `buildInputModel` coerced anything. This is what `input.vector-clamped` reads.
    rawInitial: row.values as Readonly<Record<string, unknown>>,
    settings: {
      format,
      size: rowSize(row, manifest, run, { format, print }),
      bleed,
      // `csvToMarks` returns null for an absent CSV - "the export applies none",
      // which is a known null. All-false ("card on, nothing ticked") stays a
      // distinct, real state.
      marks: { known: true, value: print.marks ? csvToMarks(print.marks) : null },
      pressProfile: { known: true, value: print.profile ?? null },
      // `cuts` has no channel in the batch transport at all (no grid column, no CSV
      // header, no session key), so it is not built. It could only ever multiply
      // against a mounted timed stage anyway, which a pre-pass does not have.
      //
      // c2pa/imprint are left UNKNOWN rather than false: `renderRowToBlob` leaves
      // both undefined for a batch row and the export bridge applies its own
      // policy default, so the collector genuinely does not know. Same reading the
      // CLI takes for an unset flag.
      c2pa: { known: false, why: 'not-set' },
      imprint: { known: false, why: 'not-set' },
      ...(row.filename ? { filename: row.filename } : {}),
    },
    palette: env.palette,
    // No mounted artwork exists yet - this runs before the first row is rendered.
    // A NAMED GAP in the report, never an omission from it, and never an all-false
    // StageFacts that would read as "measured, and there is nothing there".
    stage: { known: false, why: 'needs-mount' },
    rowIndex: ctx.srcIndex,
  };
}

/**
 * One collector caveat: this row will not render at all.
 *
 * A skipped row has no queue position, but it is the case preflight most needs to
 * explain - "nothing about row 7 was counted, because row 7 has no template" is the
 * finding, and it can only be said here. Appended by the collector rather than
 * emitted by the engine, exactly like the CLI's `collect.*` caveats: it is a fact
 * about the COLLECTION, not a rule over the job, and the engine must stay unable to
 * know it.
 *
 * `needs` set means `severity: 'info'` and no `count` - the gap invariant, held by
 * hand here because the engine only enforces it for findings it produced itself.
 */
function skipCaveat(ctx: RowCheckCtx, uid?: string): Finding {
  return {
    id: 'collect.row-not-rendered',
    severity: 'info',
    needs: 'not-carried',
    message: `This row will not be rendered (${ctx.skippedReason}), so nothing about its output was counted.`,
    evidence: { reason: String(ctx.skippedReason ?? ''), srcIndex: ctx.srcIndex, ...(uid ? { uid } : {}) },
    rowIndex: ctx.srcIndex,
  };
}

/**
 * One collector caveat: the format the user asked for is not the format that will
 * render.
 *
 * `chooseFormat` is a SUBSTITUTION, not a resolution: handed `pdf` for a tool whose
 * manifest offers `svg, png, …`, it silently returns the tool's first declared
 * format. Reporting the substituted format as `settings.format` is right - that IS
 * what renders, and a preflight about settings the renderer will not use is worse
 * than none - but it also makes `settings.format-not-offered` structurally
 * unreachable in a batch, while `lolly preflight --export=pdf` (which never calls
 * `chooseFormat`) exits 1 on the same logical job. So the collector says the part
 * the engine cannot see: the request was changed, and here is what it became.
 *
 * A `warn`, not an error: the row will produce a file, just not the one asked for.
 */
function formatCaveat(requested: string, chosen: string, manifest: PreflightManifest, ctx: RowCheckCtx): Finding {
  const offered = (manifest.render?.formats ?? []).join(', ');
  const tool = manifest.id || 'this tool';
  return {
    id: 'collect.format-substituted',
    severity: 'warn',
    message: `This row was asked for ${requested}; ${tool} does not offer it, so it will render as ${chosen}.`,
    evidence: { requested, chosen, offered },
    rowIndex: ctx.srcIndex,
  };
}

/**
 * The findings that are properties of the PLATFORM or of the BRAND, never of a row.
 *
 * `checkRefusals` emits `refuse.output-file-size` with no gate at all - it is true of
 * every job Lolly will ever run - and the plate/palette ones are facts about the
 * brand's token set. Left in the per-row channel they put a note chip on all 50 rows
 * of a clean 50-row batch, the headline read "Done - 50 files, 50 with notes", and
 * `lolly.txt` carried "Lolly cannot predict the output file size" fifty times. That is
 * exactly the noise `plans/65-preflight-and-cost.md` section 6 names ("noise is how a real gap
 * gets skipped"): after one such run nobody reads the chips, and the one row with a
 * real `input.required-blank` is indistinguishable from the 49 without.
 *
 * They are not dropped - dropping a named gap is the one thing preflight may never do.
 * They are emitted ONCE at run level (see {@link createBatchRowCheck}'s `runFindings`).
 */
export const RUN_LEVEL_IDS: ReadonlySet<FindingId> = new Set<FindingId>([
  'refuse.output-file-size',
  'refuse.render-time',
  'refuse.ink-coverage',
  'refuse.exact-separation',
  'plates.palette-unresolved',
  'plates.no-spots-declared',
]);

/**
 * Findings for ONE row: build the job, run the engine's rules, return the list.
 *
 * `manifest` is null when the tool could not be loaded (or the row names none) - 
 * the row `planBatch` dropped with 'No template selected' / 'Failed to load
 * template'. There is then no job to build and none is invented: the row carries
 * the skip caveat alone, which is still a finding against that row.
 *
 * `onRunLevel` receives the findings partitioned out by {@link RUN_LEVEL_IDS}. A
 * caller that passes none is saying "this is a single row, there is no run" - the
 * run-invariant findings are then dropped from the row rather than reattached to it,
 * because a per-row channel is the one place they must not be.
 */
export function preflightRow(
  row: BatchRow,
  manifest: PreflightManifest | null,
  rowIndex: number,
  ctx: RowCheckCtx,
  env: BatchPreflightEnv,
  onRunLevel?: (f: Finding) => void,
): Finding[] {
  const caveats = ctx.skippedReason ? [skipCaveat(ctx, row.uid)] : [];
  if (!manifest) return caveats;
  // `preflight()` is TOTAL - it never throws, on any input - so there is no guard
  // here by design. The one thing that could still throw is the job assembly
  // above, and `createBatchRowCheck` catches that so a broken row cannot take the
  // whole plan down.
  const job = preflightJobForRow(row, manifest, rowIndex, ctx, env);
  // jpg/jpeg are the SAME request - `chooseFormat` holds that equivalence, so a tool
  // offering `jpeg` and a row asking for `jpg` is not a substitution.
  const alias = (f: string): string => (f === 'jpeg' ? 'jpg' : f);
  const requested = String(row.format || env.run.format || '').toLowerCase();
  const chosen = String(job.settings.format ?? '').toLowerCase();
  if (requested && chosen && alias(requested) !== alias(chosen)) {
    caveats.push(formatCaveat(requested, chosen, manifest, ctx));
  }
  const report = preflight(job);
  const perRow: Finding[] = [];
  for (const f of report.findings) {
    if (RUN_LEVEL_IDS.has(f.id)) onRunLevel?.(f);
    else perRow.push(f);
  }
  return [...caveats, ...perRow];
}

/**
 * The brand palette, or a named refusal - the CLI collector's rule, restated
 * because there is no shared home for it: `host.tokens.colors()` is called
 * DIRECTLY, never through `livePalette`, which silently substitutes the neutral
 * starter palette when tokens throw OR answer with nothing and carries no
 * provenance to tell the two apart. A throw and an empty list both become
 * `not-resolved`, so the engine withholds the plate ceiling instead of counting
 * starter swatches as if they were the brand's.
 */
export async function resolveBatchPalette(
  host: { tokens?: { colors?: () => Promise<unknown> } },
): Promise<Fact<readonly PreflightSwatch[]>> {
  try {
    const colors = await host.tokens?.colors?.();
    if (!Array.isArray(colors) || colors.length === 0) return { known: false, why: 'not-resolved' };
    return {
      known: true,
      value: colors.map((s: { path?: string; name?: string; spot?: unknown }) => ({
        path: s.path, name: s.name, spot: (s.spot ?? null) as PreflightSwatch['spot'],
      })),
    };
  } catch {
    return { known: false, why: 'not-resolved' };
  }
}

/** The host slice this collector reads. Both members are optional on `HostV1`. */
export interface PreflightHost {
  tokens?: { colors?: () => Promise<unknown> };
  profile?: { get?: () => Promise<unknown> };
  log?: (level: 'debug' | 'info' | 'warn' | 'error', msg: string) => void;
}

/**
 * The collector, plus the channel the per-row one is not.
 *
 * `runFindings` is populated AS the rows are checked (it is the array the returned
 * `check` writes into), so it is complete only once `planBatch` has resolved. Read it
 * after, never before.
 */
export interface BatchRowCheck {
  check: (row: BatchRow, rowIndex: number, ctx: RowCheckCtx) => Finding[];
  /** Run-invariant findings, deduplicated by id - see {@link RUN_LEVEL_IDS}. */
  runFindings: Finding[];
}

/**
 * The findings for the rows `planBatch` DROPPED, keyed by identity rather than by a
 * queue position they do not have.
 *
 * A skipped row's findings are filed under `rowIndex: -1`, which `notesFromFindings`
 * discards by design (correctly - the runner's channel is queue-space). Without this
 * they reached no surface at all: `buildPreflightReport` hard-coded `findings: []` for
 * every unmade row with no runner index, so the one case plan section 7 says preflight most
 * exists for ("the skipped, the errored and the cancelled are precisely the set a
 * preflight report is for") shipped as an empty array in `preflight.json`.
 *
 * `srcIndex` is read back off the finding itself: `preflightRow` stamps every finding
 * with `ctx.srcIndex`, so the identity travels inside the payload and does not depend
 * on a `uid` the /pro grid may not have set.
 */
export function skippedFindings(
  plan: Pick<BatchPlan<Finding>, 'findings'>,
): Array<{ uid?: string; srcIndex: number; items: Finding[] }> {
  return plan.findings
    .filter(f => f.rowIndex === -1)
    .map(f => ({ uid: f.uid, srcIndex: f.items[0]?.rowIndex ?? -1, items: f.items }));
}

/**
 * Build the `check` for `planBatch<Finding>(rows, { check })`.
 *
 * Async because the two RUN-INVARIANT facts - the brand palette and the user
 * profile - are async and `check` is not; both are resolved once here and shared by
 * every row. The tool manifests are pre-loaded for the same reason: `planBatch`
 * loads them itself but does not hand them to `check`, and `getTool` is CACHED
 * per tool id (`bridge/tool-loader.ts`), so this costs one fetch per DISTINCT
 * template for the whole run and zero for the second row using it.
 *
 * A tool that will not load is left out of the map on purpose. `planBatch` is about
 * to drop that row with 'Failed to load template', and the row gets the skip caveat
 * instead of an invented job.
 */
export async function createBatchRowCheck(
  rows: readonly BatchRow[],
  host: PreflightHost,
  run: BatchRunSettings = {},
  deps: { getTool?: (id: string) => Promise<{ manifest: ToolManifest }> } = {},
): Promise<BatchRowCheck> {
  const load = deps.getTool ?? getTool;
  const ids = [...new Set(rows.map(r => r.toolId).filter((id): id is string => !!id))];
  const manifests = new Map<string, PreflightManifest>();
  await Promise.all(ids.map(async (id) => {
    try {
      const tool = await load(id);
      manifests.set(id, toPreflightManifest(tool.manifest));
    } catch { /* row will be skipped by planBatch; the caveat says so */ }
  }));

  const palette = await resolveBatchPalette(host);
  let profile: unknown;
  try { profile = (await host.profile?.get?.()) ?? undefined; } catch { profile = undefined; }

  const env: BatchPreflightEnv = { run, palette, profile, source: 'web' };
  // Deduplicated by id: "Lolly cannot predict the output file size" is one fact about
  // the platform whether the run is 1 row or 500.
  const runFindings: Finding[] = [];
  const seen = new Set<string>();
  const onRunLevel = (f: Finding): void => {
    if (seen.has(f.id)) return;
    seen.add(f.id);
    // Stripped of the row stamp: it is not about that row, and a row number on it is
    // the mis-attribution this partition exists to remove.
    const { rowIndex: _rowIndex, ...rest } = f;
    runFindings.push(rest as Finding);
  };
  const check = (row: BatchRow, rowIndex: number, ctx: RowCheckCtx): Finding[] => {
    try {
      return preflightRow(row, (row.toolId && manifests.get(row.toolId)) || null, rowIndex, ctx, env, onRunLevel);
    } catch (e) {
      // A collector that throws must not take the RUN down: the plan is what the
      // user asked for, the findings are commentary on it. Logged, then dropped.
      host.log?.('warn', `preflight: row ${ctx.srcIndex + 1} could not be checked (${String((e as Error)?.message ?? e)})`);
      return [];
    }
  };
  return { check, runFindings };
}
