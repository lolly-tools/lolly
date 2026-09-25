// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly rebrand plan|compile|inspect|presets <in>...` - renovate a deck, or a
 * folder of decks, from the terminal (plan 274 sections 2.2, 2.3 and 5).
 *
 * Three explicit stages over one path, `@lolly-tools/node-shell/rebrand`, the same
 * `planDeck` and `compileDeck` the eval script and the test suite run:
 *
 *   plan     read each deck (a .pptx or a PDF, told apart by its bytes), take
 *            the census, run the first pass, and write the
 *            plan (`<name>.plan.json`) and the report it would compile to
 *            (`<name>.plan.report.json`). An agent edits the plan, never
 *            regenerates it between passes.
 *   compile  compile a plan (`--plan=<file|dir>`, or a fresh first pass without
 *            one) into a Design document: `<name>.lolly`, `<name>.report.json`,
 *            and with `--export=pptx` a native `<name>.rebranded.pptx`, a name
 *            that can never be the source deck, even in the default folder
 *            beside it. When `--accept-suggestions` answers rows, the answered plan is
 *            written too (`<name>.answered.plan.json`), so the revision the
 *            document records names a plan on disk. The bare flag answers the
 *            unreviewed rows, as the web's "Accept all suggestions" does;
 *            `--accept-suggestions=all` also answers the rows that need
 *            attention. `--auto-match[=clear|likely|all]` on plan or compile
 *            sets every slide whose layout read reaches that band to the layout
 *            it names (plan 275 decision 28); a bare flag means `all`, and the
 *            envelope counts the slides set per band for each file, one count
 *            per `layout.auto-matched` entry in the report.
 *   inspect  print a plan's summary, its review queue and per-slide states, or
 *            one slide's objects with `--slide=<n>`, paged.
 *
 * The design system is the active content profile's (LOLLY_PROFILE), read by
 * `resolveProfileDesignSystem`; a profile with no slide master renovates against
 * the neutral master and says so. `--profile` is the press condition elsewhere in
 * this CLI and is not read here. Nothing on this path reaches the network, so
 * `--offline` is accepted and changes nothing.
 *
 * WRITES. Nothing is written with `--dry-run`. Otherwise one deck's outputs are
 * written as a group, on the main thread: every temp file first (in the output's
 * own directory), then each renamed onto a name this run claimed with an
 * exclusive create. A file that is replaced is kept under a backup name until the
 * group is written. A failure part-way removes the outputs this run created and
 * puts every replaced file back, so a failed deck leaves the folder as it found
 * it. An existing file is never replaced without `--force`. An output
 * that is the source deck itself is refused even with `--force`, and "itself" is
 * the file's identity (device and inode), so a case-variant name on a
 * case-insensitive volume or a symlinked `--out-dir` is caught too.
 *
 * OUTCOMES. Each input ends `ready`, `needs-review` or `failed`, and a failed one
 * carries a stable code. The codes are the SDK contract's `REBRAND_ERROR_CODES`,
 * the pipeline's own additions (`RebrandFailureCodeV1`) and four codes of this
 * surface alone: `source.missing` (the input could not be opened),
 * `output.exists`, `output.unwritable` (an output could not be written) and
 * `internal` (a bug in Lolly).
 *
 *   source.missing, source.unsupported, plan.missing, plan.invalid    exit 2
 *   source.unreadable, source.encrypted, source.too-large,
 *   export.failed, output.unwritable, ocr.unavailable, storage.quota,
 *   compile.unresolved-objects, design-system.master-missing,
 *   design-system.logo-missing, design-system.unreadable              exit 1
 *   plan.hash-mismatch, plan.revision-stale,
 *   plan.design-system-mismatch, output.exists                        exit 4
 *
 * `inspect` fails the run as a whole rather than per file, so there the code
 * travels as the envelope's `error.detail`, and `error.kind` is its upper-snake
 * spelling (`plan.hash-mismatch` is `PLAN_HASH_MISMATCH`), like every other kind.
 *
 * The run exits with the most severe file's code. When every deck compiled and
 * at least one needs review, `compile` exits 5 (NOT_FOUND in exit-codes.ts: a
 * legitimate answer that is not the one asked for), with `ok: false` and the
 * full result in the envelope. Without `--keep-going` the run stops at the first
 * failed deck and lists the rest under `notAttempted`; with it, a failed deck is
 * recorded as failed and the run goes on. A failed deck is never counted as a
 * success.
 *
 * FOLDER RUNS. An input that is a directory expands to the .pptx and .pdf files
 * at its top level (every subfolder too with `--recursive`), sorted by name. Dot
 * files, PowerPoint's `~$` lock files and `x.rebranded.pptx` (this command's own
 * output) are not decks, and a PDF beside a .pptx of the same name is taken as an
 * export of that deck and left out, so the two never claim one output name. The
 * output folder is never walked for input. A deck found in
 * a subfolder writes into the same subfolder under `--out-dir` (or `--plan-out`),
 * so two decks with one name in two subfolders never collide. Compiling a folder
 * needs `--out-dir`, as several decks already do.
 *
 * THE RUN RECORD. A folder run, a run over several decks or a run with
 * `--resume` keeps two files in the output folder (`--out-dir` for compile, a
 * `--plan-out` folder for plan). `.lolly-rebrand-run.json`, through
 * `@lolly-tools/node-shell/rebrand-run-manifest`, is the account of each deck's
 * latest attempt: the sha256 of its bytes, its outcome, the last stage it
 * completed (census, plan, compile, then `plan` or `done` when it finished) and
 * every output of that deck on disk, from either stage. `.lolly-rebrand-stages.json`
 * (`StageLedger`) holds, per deck and per stage, the hash of the bytes that stage
 * read, what it was asked to do (the preset's content, and for a compile the
 * plan file's bytes, `--export=pptx` and `--accept-suggestions`), how it ended
 * and what it wrote, and per deck every output a run into the folder wrote for
 * it. A single deck compiled on its own keeps neither. `--dry-run` reads them and
 * writes none.
 *
 * `--resume` leaves a deck alone, reported with `skipped: true`, only when the
 * stage record says this same stage ran on these same bytes and was asked the
 * same thing, and it either finished with every output still on disk or failed
 * with a code the same bytes and plan fail with again (`source.unreadable`,
 * `source.encrypted`, `plan.hash-mismatch`, `plan.invalid`). Every other deck
 * runs: new, changed, edited plan, other options, a missing output, every other
 * failure, or finished only for the other stage. A deck always runs from its
 * bytes; the checkpoint says how far the last attempt got, it is not a point to
 * restart from. Bytes that change while their deck runs leave its entry pending.
 *
 * ONE COLLISION RULE. The manifest module can suffix a colliding name
 * (`deck-2.lolly`) through its `writeOutput`; this surface does not use that path.
 * Here an existing file is refused as `output.exists` unless `--force`, for every
 * run, so a folder run and a single deck answer the same way and no output ever
 * takes a name the person did not ask for. The one widening: under `--resume`, a
 * file the run record lists as an output of that same deck is the run's own work
 * and is replaced when the deck runs again. A refusal before anything is written
 * leaves the deck's entry as it was, so a finished deck stays finished. A deck's
 * own outputs stay its own when its bytes change, so they are replaced rather
 * than refused when it runs again. A write the process was killed in the middle
 * of can leave a renamed output the records do not list yet; that one is refused
 * on the next run until `--force`.
 *
 * `--jobs=N` runs N decks at once, each in its own worker thread (the reading,
 * census and compile are CPU work, so threads are what makes them overlap), at
 * most 8 and at most the machine's core count. Outputs are claimed and written
 * and the records kept on the main thread only. Without `--keep-going` a deck is
 * written only after every deck before it, no new deck starts after a failure,
 * and a deck still running then is dropped (nothing written, its entry put back)
 * and listed as not attempted. So the report, the outputs and the exit code are
 * the same whatever N is. Where no worker file is present beside this module
 * (`rebrand-worker.ts`, or `rebrand-worker.js` in a bundled build), the decks run
 * one after another and a note says so.
 *
 * SLIDES THAT ARE PICTURES (plan 274 section 6). A scanned PDF page, or a pptx
 * slide that is one picture of a whole slide, stays one picture unless `--ocr`
 * asks for its text to be read. `--ocr` runs the on-device OCR runner
 * (`nodeFlattenedOcr`, the same runner the render path uses when AI features are
 * on) when its model is already on this machine, and rebuilds each such slide
 * from the text and pictures it finds. Nothing is ever downloaded: without the
 * model the slides stay pictures and the record says why, naming `lolly models
 * fetch ocr`. Each deck's record carries a `flattened` entry whenever it has such
 * slides, so the envelope always says what happened to them. A plan records how
 * its slides were read, and `compile --plan` reads them the same way again: a
 * plan made with text recognition needs the model here too, and fails with
 * `ocr.unavailable` without it rather than compiling other objects.
 *
 * PRESETS. `--preset=<id|file.json>` takes a renovation preset by id, from the
 * active content profile's design system and then the personal presets file, or
 * from a file (`@lolly-tools/node-shell/rebrand`, `resolvePreset`). An id that
 * resolves to nothing is a usage error with the kind `PRESET_UNKNOWN`, one that
 * does not validate `PRESET_INVALID`, a file that cannot be read
 * `PRESET_UNREADABLE`; the preset code travels as `error.detail`. A preset is
 * recorded on the design system snapshot as well as on the plan. It shapes a
 * first pass, so `compile` refuses it beside `--plan`, whose plan already holds
 * its proposals, and `inspect` of a plan checks it and says it is not read.
 * `lolly rebrand presets [--json]` lists what resolves and what was found and
 * could not be used.
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, type Dirent } from 'node:fs';
import { copyFile, link, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import {
  AUTO_MATCH_BANDS,
  planSummary,
  reviewFidelity,
  reviewQueue,
  objectStates,
  slideStates,
  effectiveAction,
  type AutoMatchBandsV1,
  type PlanSummaryV1,
  type QueueItemV1,
  type RenovationPresetV1,
  type SlideStateV1,
} from '@lolly/engine';
import type {
  CompiledDeckV1,
  DeckCensusV1,
  EvidenceV1,
  FileOutcomeV1,
  ProjectStageV1,
  RebrandErrorCodeV1,
  RebrandReportV1,
  RenovationPlanV1,
  SourceDeckV1,
} from '@lolly-tools/core';
import { PROJECT_STAGES, REBRAND_ERROR_CODES } from '@lolly-tools/core';
import {
  RebrandPipelineError,
  buildDesignLolly,
  catalogAssetBytes,
  checkPlanFits,
  compileDeck,
  compiledDeckToPptx,
  designSessionFromCompiled,
  flattenedReadOfPlan,
  nodeFlattenedOcr,
  outcomeCounts,
  outcomeOf,
  planDeck,
  planProblems,
  readDeck,
  RebrandPresetError,
  listPresets,
  resolvePreset,
  resolveProfileDesignSystem,
  resolvePipelineSystem,
  sourceHashOf,
  type AcceptScopeV1,
  type FlattenedReadV1,
  type FlattenedSlideReportV1,
  type NodeFlattenedOcrV1,
  type OutcomeCountsV1,
  type PipelineMediaV1,
  type ReadDeckInputV1,
  type RebrandFailureCodeV1,
  type RebrandResolvedSystem,
  type RebrandXmlParserV1,
  type ResolvedPresetV1,
} from '@lolly-tools/node-shell/rebrand';
import {
  RUN_MANIFEST_FILE,
  RUN_OUTCOMES,
  RUN_PERMANENT_ERROR_CODES,
  createRunManifest,
  hashInput,
  type RunFileV1,
  type RunManifestV1,
} from '@lolly-tools/node-shell/rebrand-run-manifest';
import { nodeRebrandFs, writeAtomic } from '@lolly-tools/node-shell/rebrand-project-store';

import { emitResult } from './envelope.ts';
import { CliError, EXIT, exitCodeFor, unavailableHere, usageError } from './exit-codes.ts';
import { note, writeOut } from './output.ts';
import { REBRAND_STAGES, isOn } from './args.ts';

// ─── the surface ─────────────────────────────────────────────────────────────

/** One of the stages, or `presets`; the list lives in args.ts. */
export type RebrandStage = (typeof REBRAND_STAGES)[number];
/** The two stages that run over decks and write outputs. */
export type RebrandRunStage = 'plan' | 'compile';

const FOLDER_FLAGS = ['jobs', 'resume', 'recursive'] as const;
const STAGE_FLAGS: Record<RebrandStage, readonly string[]> = {
  plan: ['plan-out', 'preset', 'ocr', 'auto-match', 'dry-run', 'keep-going', 'offline', 'force', ...FOLDER_FLAGS],
  compile: ['plan', 'preset', 'ocr', 'accept-suggestions', 'auto-match', 'out-dir', 'export', 'dry-run', 'keep-going', 'offline', 'force', ...FOLDER_FLAGS],
  inspect: ['slide', 'page', 'limit', 'source', 'preset', 'ocr', 'offline'],
  presets: [],
};

/** The most decks one run works on at once, whatever `--jobs` asks for. */
export const REBRAND_MAX_JOBS = 8;
const GLOBAL_FLAGS = ['json', 'quiet', 'verbose', 'strict'];

/** The exit code a run where every deck compiled but some need review ends with. */
export const EXIT_NEEDS_REVIEW = EXIT.NOT_FOUND;

/** Codes of this surface alone, beside the pipeline's (see the header). */
type CliOnlyCode = 'source.missing' | 'plan.missing' | 'output.exists' | 'output.unwritable' | 'internal';

/** Codes a failed file can carry: every pipeline code, and this surface's own. */
export type RebrandFileErrorCode = RebrandFailureCodeV1 | CliOnlyCode;

/** The exit code of each file code. A `Record` over the whole union, so a code the contract adds fails the typecheck here until it is mapped. */
const CODE_EXIT: Record<RebrandFileErrorCode, number> = {
  'source.missing': EXIT.USAGE,
  'source.unsupported': EXIT.USAGE,
  'plan.missing': EXIT.USAGE,
  'plan.invalid': EXIT.USAGE,
  'source.unreadable': EXIT.FAILED,
  'source.encrypted': EXIT.FAILED,
  'source.too-large': EXIT.FAILED,
  'export.failed': EXIT.FAILED,
  'output.unwritable': EXIT.FAILED,
  'ocr.unavailable': EXIT.FAILED,
  'storage.quota': EXIT.FAILED,
  'compile.unresolved-objects': EXIT.FAILED,
  'design-system.master-missing': EXIT.FAILED,
  'design-system.logo-missing': EXIT.FAILED,
  'design-system.unreadable': EXIT.FAILED,
  'plan.hash-mismatch': EXIT.REFUSED,
  'plan.revision-stale': EXIT.REFUSED,
  'plan.design-system-mismatch': EXIT.REFUSED,
  'output.exists': EXIT.REFUSED,
  internal: EXIT.INTERNAL,
};

function isFileCode(code: string): code is RebrandFileErrorCode {
  return Object.hasOwn(CODE_EXIT, code);
}

/** `plan.hash-mismatch` as an envelope kind: `PLAN_HASH_MISMATCH`. */
function kindOf(code: RebrandFileErrorCode): string {
  return code.toUpperCase().replace(/[.-]/g, '_');
}

/** Worst last, the order `validate` ranks its files by, with a bug above everything. */
const SEVERITY: number[] = [EXIT.OK, EXIT_NEEDS_REVIEW, EXIT.USAGE, EXIT.FAILED, EXIT.REFUSED, EXIT.INTERNAL];

function worse(a: number, b: number): number {
  return SEVERITY.indexOf(b) > SEVERITY.indexOf(a) ? b : a;
}

/** One deck's failure, with its stable code. */
class FileFailure extends Error {
  readonly code: RebrandFileErrorCode;
  constructor(code: RebrandFileErrorCode, message: string) {
    super(message);
    this.name = 'FileFailure';
    this.code = code;
  }
}

/** Any thrown value as a file failure, keeping a pipeline code where there is one. */
function asFailure(err: unknown): FileFailure {
  if (err instanceof FileFailure) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof RebrandPipelineError) {
    return new FileFailure(isFileCode(err.code) ? err.code : 'export.failed', message);
  }
  return new FileFailure(exitCodeFor(err) === EXIT.INTERNAL ? 'internal' : 'export.failed', message);
}

/** A file failure as the run's own error, for a stage that fails as a whole. */
function asRunError(err: unknown): CliError {
  if (err instanceof CliError) return err;
  const failure = asFailure(err);
  return new CliError(failure.message, CODE_EXIT[failure.code], kindOf(failure.code), failure.code);
}

// ─── records ─────────────────────────────────────────────────────────────────

export interface FileErrorRecord {
  code: RebrandFileErrorCode;
  exit: number;
  message: string;
}

/** One deck's result, as the envelope's `files` carries it. */
export interface FileRecord {
  input: string;
  outcome: FileOutcomeV1;
  error?: FileErrorRecord;
  planPath?: string;
  reportPath?: string;
  outputs?: { lolly?: string; report?: string; pptx?: string; plan?: string };
  /** False on a dry run and on every failure: a failed deck's outputs are removed. */
  written?: boolean;
  counts?: PlanSummaryV1;
  pending?: number;
  attention?: number;
  unresolvedObjects?: number;
  unresolvedColours?: number;
  appliedUnreviewed?: number;
  /** Kept objects that fit no slide and are not on the canvas. */
  tray?: number;
  exportNotes?: string[];
  /** True when `--resume` found this deck finished, or failed for good, and left it alone. */
  skipped?: boolean;
  /** For a skipped deck: the outputs the run record lists. */
  recordedOutputs?: string[];
  /** For a skipped deck: the last stage the run record says it completed. */
  checkpoint?: ProjectStageV1;
  /** What happened to the slides that are pictures of slides. Absent when the deck has none. */
  flattened?: FlattenedRecord;
  /**
   * Slides whose layout Auto-match set, per band of the read, when `--auto-match`
   * was given: one per `layout.auto-matched` entry in the report.
   */
  autoMatched?: AutoMatchedRecord;
}

/** Slides Auto-match set, per band, and in all. */
export interface AutoMatchedRecord {
  clear: number;
  likely: number;
  none: number;
  total: number;
}

/**
 * Counted from the report's `layout.auto-matched` entries (their `reason` ends in the
 * band), so the envelope and the report agree whichever run set the slides.
 */
function autoMatchedRecord(report: RebrandReportV1): AutoMatchedRecord {
  const out: AutoMatchedRecord = { clear: 0, likely: 0, none: 0, total: 0 };
  for (const entry of report.entries) {
    if (entry.code !== 'layout.auto-matched') continue;
    const band = (entry.reason ?? '').split(':').pop();
    if (band !== 'clear' && band !== 'likely' && band !== 'none') continue;
    out[band] += 1;
    out.total += 1;
  }
  return out;
}

/** What happened to one deck's slides that are pictures of slides, as the envelope states it. */
export interface FlattenedRecord {
  /** Slides that are one picture of a whole slide. */
  slides: number;
  /** Slides rebuilt from the text and pictures found in them. */
  rebuilt: number;
  /** Slides kept as one picture. */
  kept: number;
  /** True when text recognition read the slides. */
  ocr: boolean;
  /** One plain sentence: how the slides were read, or why they stayed pictures. */
  note: string;
}

function failedRecord(input: string, failure: FileFailure): FileRecord {
  return {
    input,
    outcome: 'failed',
    written: false,
    error: { code: failure.code, exit: CODE_EXIT[failure.code], message: failure.message },
  };
}

function outcomeFields(counts: OutcomeCountsV1): Pick<FileRecord, 'pending' | 'attention' | 'unresolvedObjects' | 'unresolvedColours' | 'tray'> {
  return {
    pending: counts.pending,
    attention: counts.attention,
    unresolvedObjects: counts.unresolvedObjects,
    unresolvedColours: counts.unresolvedColours,
    tray: counts.tray,
  };
}

// ─── flags ───────────────────────────────────────────────────────────────────

function checkFlags(stage: RebrandStage, flags: Record<string, string>): void {
  const allowed = new Set([...STAGE_FLAGS[stage], ...GLOBAL_FLAGS]);
  for (const key of Object.keys(flags)) {
    if (!allowed.has(key)) {
      const takes = STAGE_FLAGS[stage].length > 0 ? `It takes: ${STAGE_FLAGS[stage].map((f) => `--${f}`).join(' ')}.` : 'It takes no flags beyond --json.';
      throw usageError(`--${key} is not a flag of lolly rebrand ${stage}. ${takes}`, 'UNKNOWN_FLAG');
    }
  }
}

function positiveInt(flags: Record<string, string>, key: string, fallback: number): number {
  const raw = flags[key];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw usageError(`--${key} takes a whole number from 1 up, not "${raw}".`, 'BAD_FLAG_VALUE');
  return value;
}

/**
 * The preset `--preset` names, by id or by file, or undefined when it names none.
 * A preset that cannot be used is a usage error whose kind is the preset code's
 * upper-snake spelling (`preset.unknown` is `PRESET_UNKNOWN`).
 */
function readPreset(flags: Record<string, string>): ResolvedPresetV1 | undefined {
  const spec = flags.preset;
  if (spec === undefined) return undefined;
  try {
    return resolvePreset(spec);
  } catch (err) {
    if (err instanceof RebrandPresetError) {
      throw new CliError(`--preset=${spec}: ${err.message}`, EXIT.USAGE, err.code.toUpperCase().replace(/[.-]/g, '_'), err.code);
    }
    throw err;
  }
}

// ─── shared pieces ───────────────────────────────────────────────────────────

let parser: RebrandXmlParserV1 | null = null;

/** jsdom's DOMParser, made once per process. */
async function xmlParser(): Promise<RebrandXmlParserV1> {
  if (parser) return parser;
  const { JSDOM } = await import('jsdom');
  const domParser = new new JSDOM('').window.DOMParser();
  parser = (xml: string): Document => domParser.parseFromString(xml, 'application/xml');
  return parser;
}

async function designSystem(opts: { quiet?: boolean } = {}): Promise<RebrandResolvedSystem> {
  let resolved: RebrandResolvedSystem | null;
  try {
    resolved = await resolveProfileDesignSystem();
  } catch (err) {
    throw asRunError(err);
  }
  if (!resolved) {
    throw unavailableHere('No content profile resolves here, so there is no design system to renovate against. Set LOLLY_PROFILE or run from a Lolly checkout.', 'NO_DESIGN_SYSTEM');
  }
  if (!opts.quiet) for (const line of resolved.notes) note(line);
  return resolved;
}

/**
 * The design system with the preset recorded on its snapshot, so a plan names
 * the preset and its version where it names the master and the tokens. The
 * token hash and the master do not move, so a plan still fits the system a
 * later compile resolves without the preset.
 */
async function presetSystem(resolved: RebrandResolvedSystem, preset: RenovationPresetV1 | undefined): Promise<RebrandResolvedSystem> {
  if (!preset) return resolved;
  const input = { ...resolved.input, preset: { id: preset.id, ...(preset.version !== undefined ? { version: preset.version } : {}) } };
  return { ...resolved, input, system: await resolvePipelineSystem(input) };
}

function systemSummary(resolved: RebrandResolvedSystem): Record<string, unknown> {
  return {
    profile: resolved.profile,
    id: resolved.system.snapshot.id,
    masterId: resolved.system.snapshot.masterId,
    neutralMaster: resolved.neutralMaster,
    tokenHash: resolved.system.snapshot.tokenHash,
    notes: resolved.notes,
  };
}

/** The file name without its last extension. */
function stem(path: string): string {
  const name = basename(path);
  const ext = extname(name);
  return ext ? name.slice(0, -ext.length) : name;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

async function readInput(input: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(input));
  } catch (err) {
    throw new FileFailure('source.missing', `${input} could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** The plan-stage report beside a plan: `x.plan.json` gives `x.plan.report.json`. */
function reportBesidePlan(planPath: string): string {
  return /\.json$/i.test(planPath) ? planPath.replace(/\.json$/i, '.report.json') : `${planPath}.report.json`;
}

/** The device and inode of an existing file, following symlinks, or null. */
function identityOf(path: string): { dev: number; ino: number } | null {
  try {
    const stat = statSync(path);
    return { dev: stat.dev, ino: stat.ino };
  } catch {
    return null;
  }
}

/**
 * True when writing `path` would replace the file `source` names. An existing
 * output is compared by device and inode, which answers a case-variant name on a
 * case-insensitive volume and a symlinked directory alike; a name that resolves to
 * no file cannot be the source.
 */
function isSourceFile(path: string, source: { dev: number; ino: number } | null): boolean {
  if (!source) return false;
  const out = identityOf(path);
  return out !== null && out.dev === source.dev && out.ino === source.ino;
}

/**
 * A key two spellings of one output share: the real path of the nearest existing
 * directory, then the rest, lower-cased so two names one case-insensitive volume
 * would fold together are one claim. On a case-sensitive volume that is
 * conservative: it refuses two outputs whose names differ only in case.
 */
function claimKey(path: string): string {
  const full = resolve(path);
  let dir = dirname(full);
  const rest: string[] = [basename(full)];
  for (;;) {
    try {
      return join(realpathSync(dir), ...rest).toLowerCase();
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return full.toLowerCase();
      rest.unshift(basename(dir));
      dir = parent;
    }
  }
}

/**
 * Refuse outputs that exist (unless `force`, or unless the run record lists the
 * file as this deck's own output under `--resume`), that another input of this
 * run already claimed, or that are the source itself. `hint` ends the sentence
 * an existing file is refused with.
 */
function claimOutputs(
  paths: string[],
  input: string,
  claimed: Set<string>,
  force: boolean,
  own: ReadonlySet<string> = new Set(),
  hint = 'Pass --force to replace it.',
): void {
  const source = identityOf(input);
  for (const path of paths) {
    if (isSourceFile(path, source)) throw new FileFailure('output.exists', `${path} would replace the source deck. Choose another --out-dir.`);
    if (claimed.has(claimKey(path))) throw new FileFailure('output.exists', `${path} is written by another input of this run.`);
    if (!force && !own.has(resolve(path)) && existsSync(path)) throw new FileFailure('output.exists', `${path} already exists. ${hint}`);
  }
  for (const path of paths) claimed.add(claimKey(path));
}

/** One output to write. */
interface PendingOutput {
  path: string;
  data: Uint8Array | string;
}

const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Write one deck's outputs as a group. Every temp file is written first, beside
 * its output; then each output is claimed (without `force`, and unless `own`
 * lists it as this deck's output in the run record, an exclusive create, so a
 * file that appeared since the check is never replaced), checked once more
 * against the source deck, and the temp renamed onto it. A file that is about to
 * be replaced is first kept under a backup name. On a failure the temps are
 * removed, an output this call created is removed, and a replaced file gets its
 * backup back, so the folder holds what it held before the call.
 */
async function writeOutputs(outputs: PendingOutput[], input: string, force: boolean, own: ReadonlySet<string> = new Set()): Promise<void> {
  const source = identityOf(input);
  const temps: Array<{ path: string; temp: string }> = [];
  /** Outputs this call placed: `backup` is the earlier file it replaced, if there was one. */
  const placed: Array<{ path: string; backup: string | null }> = [];
  try {
    for (const output of outputs) {
      const dir = dirname(output.path);
      const temp = join(dir, `.${basename(output.path)}.${randomUUID()}.tmp`);
      try {
        await mkdir(dir, { recursive: true });
        temps.push({ path: output.path, temp });
        await writeFile(temp, output.data);
      } catch (err) {
        throw new FileFailure('output.unwritable', `${output.path} could not be written: ${errText(err)}`);
      }
    }
    for (const { path, temp } of temps) {
      if (isSourceFile(path, source)) throw new FileFailure('output.exists', `${path} would replace the source deck. Choose another --out-dir.`);
      const replace = force || own.has(resolve(path));
      let backup: string | null = null;
      if (!replace) {
        try {
          const handle = await open(path, 'wx');
          await handle.close();
        } catch (err) {
          if ((err as { code?: unknown } | null)?.code === 'EEXIST') {
            throw new FileFailure('output.exists', `${path} already exists. Pass --force to replace it.`);
          }
          throw new FileFailure('output.unwritable', `${path} could not be written: ${errText(err)}`);
        }
        placed.push({ path, backup: null });
      } else if (existsSync(path)) {
        backup = join(dirname(path), `.${basename(path)}.${randomUUID()}.bak`);
        try {
          await link(path, backup);
        } catch {
          try {
            await copyFile(path, backup);
          } catch (err) {
            throw new FileFailure('output.unwritable', `${path} could not be kept aside before it was replaced: ${errText(err)}`);
          }
        }
      }
      if (replace) placed.push({ path, backup });
      try {
        await rename(temp, path);
      } catch (err) {
        throw new FileFailure('output.unwritable', `${path} could not be written: ${errText(err)}`);
      }
    }
  } catch (err) {
    await Promise.all(temps.map(({ temp }) => rm(temp, { force: true }).catch(() => undefined)));
    for (const { path, backup } of placed) {
      if (backup) await rename(backup, path).catch(() => undefined);
      else await rm(path, { force: true }).catch(() => undefined);
    }
    throw err;
  }
  await Promise.all(placed.map(({ backup }) => (backup ? rm(backup, { force: true }).catch(() => undefined) : undefined)));
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

// ─── one deck's work ─────────────────────────────────────────────────────────

interface RunOpts {
  dryRun: boolean;
  force: boolean;
  keepGoing: boolean;
}

function runOpts(flags: Record<string, string>): RunOpts {
  return { dryRun: isOn(flags['dry-run']), force: isOn(flags.force), keepGoing: isOn(flags['keep-going']) };
}

/** What one deck's work needs besides the deck, as plain data a worker thread can receive. */
interface TaskOpts extends RunOpts {
  /** Which rows `--accept-suggestions` answers, or false when it was not given. */
  acceptSuggestions: AcceptScopeV1 | false;
  exportPptx: boolean;
  preset?: RenovationPresetV1;
  /** `--ocr`: read the text in slides that are pictures, when the model is on this machine. */
  ocr: boolean;
  /** `--auto-match`: the bands Auto-match applies, or absent when it was not given. */
  autoMatch?: AutoMatchBandsV1;
}

// ─── slides that are pictures ────────────────────────────────────────────────

/** The OCR runner per model, asked for once per process (and once per worker thread). */
const ocrRunners = new Map<string, Promise<NodeFlattenedOcrV1>>();

/** The node OCR runner, or the reason it cannot run here. Checks for the model files and downloads nothing. */
function ocrRunner(model?: string): Promise<NodeFlattenedOcrV1> {
  const key = model ?? '';
  let found = ocrRunners.get(key);
  if (!found) {
    found = nodeFlattenedOcr(model ? { model } : {});
    ocrRunners.set(key, found);
  }
  return found;
}

/** The read options a first pass takes: text recognition when `--ocr` asked and the model is here. */
type FirstReadV1 = { read: Pick<ReadDeckInputV1, 'ocr' | 'ocrModel' | 'ocrMissing'>; unavailable?: string };

async function firstRead(opts: TaskOpts): Promise<FirstReadV1> {
  if (!opts.ocr) return { read: {} };
  const runner = await ocrRunner();
  if (runner.ok) return { read: { ocr: runner.ocr, ocrModel: runner.model } };
  return { read: { ocrMissing: 'unavailable' }, unavailable: runner.message };
}

/**
 * The read options that give the objects a saved plan names: its slides that are
 * pictures read the way the plan records (`flattenedReadOfPlan`). A plan made
 * with text recognition needs the model here as well; without it the deck fails
 * with `ocr.unavailable` rather than compiling other objects.
 */
async function planRead(plan: RenovationPlanV1): Promise<Pick<ReadDeckInputV1, 'flattened' | 'ocr' | 'ocrModel'>> {
  const shape = flattenedReadOfPlan(plan);
  if (!shape) return {};
  if (!shape.ocr) return { flattened: shape.flattened };
  const runner = await ocrRunner(shape.ocrModel);
  if (!runner.ok) {
    throw new FileFailure('ocr.unavailable', `This plan was made with the text read from slide pictures, so reading the deck again needs text recognition too. ${runner.message}`);
  }
  return { flattened: 'rebuild', ocr: runner.ocr, ocrModel: shape.ocrModel ?? runner.model };
}

const slidesWord = (n: number): string => `${n} slide${n === 1 ? '' : 's'}`;

/**
 * What happened to a deck's slides that are pictures of slides, or undefined when
 * it has none. `unavailable` is the sentence `--ocr` got back when the model is not
 * on this machine.
 */
function flattenedRecord(reports: readonly FlattenedSlideReportV1[], shape: FlattenedReadV1 | null, opts: TaskOpts, unavailable?: string): FlattenedRecord | undefined {
  if (reports.length === 0) return undefined;
  const rebuilt = reports.filter((one) => one.outcome === 'rebuilt').length;
  const kept = reports.length - rebuilt;
  const ocr = shape?.ocr === true;
  const count = reports.length;
  let note: string;
  if (ocr) {
    note = kept === 0
      ? `${slidesWord(count)} ${count === 1 ? 'is a picture' : 'are pictures'} of a slide; Lolly read the text in ${count === 1 ? 'it' : 'them'} and rebuilt ${count === 1 ? 'it' : 'each one'}, so review ${count === 1 ? 'it' : 'every one'}.`
      : `${slidesWord(count)} ${count === 1 ? 'is a picture' : 'are pictures'} of a slide; Lolly read the text and rebuilt ${rebuilt}, and ${kept} stay${kept === 1 ? 's' : ''} as a picture.`;
  } else if (unavailable) {
    note = `${slidesWord(count)} ${count === 1 ? 'stays a picture' : 'stay pictures'}. ${unavailable}`;
  } else if (opts.ocr || shape?.flattened === 'rebuild') {
    note = `${slidesWord(count)} ${count === 1 ? 'is a picture' : 'are pictures'} of a slide; ${rebuilt} ${rebuilt === 1 ? 'was' : 'were'} rebuilt from ${rebuilt === 1 ? 'its' : 'their'} regions without reading text, and ${kept} stay${kept === 1 ? 's' : ''} as a picture.`;
  } else {
    note = `${slidesWord(count)} ${count === 1 ? 'is a picture' : 'are pictures'} of a slide and ${count === 1 ? 'stays one picture' : 'stay pictures'}. Pass --ocr to read the text in ${count === 1 ? 'it' : 'them'} when the text recognition model is on this machine.`;
  }
  return { slides: count, rebuilt, kept, ocr, note };
}

/** The outputs one compiled deck may write. */
type CompileOutputs = NonNullable<FileRecord['outputs']>;

/** One deck's work, claimed and ready to run, here or in a worker thread. */
type DeckTask =
  | { stage: 'plan'; input: string; planPath: string; reportPath: string; opts: TaskOpts }
  | { stage: 'compile'; input: string; planFile?: string; outputs: CompileOutputs; opts: TaskOpts };

/** A checkpoint a deck reached, reported as it happens. */
type StageSink = (stage: ProjectStageV1) => void | Promise<void>;

/** `sha256:<hex>`, the spelling the run record hashes a deck with. */
const sha256 = (data: Uint8Array | string): string => `sha256:${createHash('sha256').update(data).digest('hex')}`;

/** The hashes of what one deck's work read, filled in as it reads. */
interface Seen {
  /** The deck bytes this work read, or '' before it read them. */
  hash: string;
  /** The plan file this work read, when it read one. */
  planHash?: string;
}

/**
 * What one deck's work hands back. The outputs are written on the main thread,
 * in deck order when a failure stops the run, so the work itself writes nothing.
 */
interface DeckResult extends Seen {
  record: FileRecord;
  /** The outputs to write: none on a dry run or a failure. */
  outputs: PendingOutput[];
}

async function planOne(task: Extract<DeckTask, { stage: 'plan' }>, system: RebrandResolvedSystem, onStage: StageSink, seen: Seen): Promise<DeckResult> {
  const { input, planPath, reportPath, opts } = task;
  const bytes = await readInput(input);
  seen.hash = sha256(bytes);
  const first = await firstRead(opts);
  const planned = await planDeck({
    bytes,
    name: basename(input),
    parseXml: await xmlParser(),
    system: system.system,
    ...first.read,
    ...(opts.preset ? { preset: opts.preset } : {}),
    ...(opts.autoMatch ? { autoMatch: opts.autoMatch } : {}),
    onStage,
  });
  const { compiled } = await compileDeck({ source: planned.source, census: planned.census, plan: planned.plan, system: planned.system });
  const outputs: PendingOutput[] = opts.dryRun ? [] : [
    { path: planPath, data: json(planned.plan) },
    { path: reportPath, data: json(compiled.report) },
  ];
  const flattened = flattenedRecord(planned.flattened, planned.read, opts, first.unavailable);
  const record: FileRecord = {
    input,
    outcome: outcomeOf(planned.plan, compiled),
    planPath,
    reportPath,
    written: false,
    counts: planSummary(planned.plan, planned.source, planned.census),
    ...outcomeFields(outcomeCounts(planned.plan, compiled)),
    ...(flattened ? { flattened } : {}),
    ...(opts.autoMatch ? { autoMatched: autoMatchedRecord(compiled.report) } : {}),
  };
  return { record, outputs, ...seen };
}

/** Where each deck's plan is read from, when `--plan` was given. */
function planSourcesFor(decks: DeckInput[], planFlag: string | undefined): Array<string | undefined> {
  if (planFlag === undefined) return decks.map(() => undefined);
  if (isDirectory(planFlag)) return decks.map((deck) => join(planFlag, deck.rel, `${stem(deck.input)}.plan.json`));
  if (decks.length > 1) {
    throw usageError('--plan names one file, and there are several inputs. Point --plan at the directory the plans were written to.', 'CONFLICTING_FLAGS');
  }
  return [planFlag];
}

async function readPlanFile(path: string, seen?: Seen): Promise<RenovationPlanV1> {
  let text: string;
  try {
    const raw = await readFile(path);
    if (seen) seen.planHash = sha256(raw);
    text = raw.toString('utf8');
  } catch (err) {
    throw new FileFailure('plan.missing', `The plan ${path} could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new FileFailure('plan.invalid', `The plan ${path} is not JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const problems = await planProblems(parsed);
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join('; ');
    throw new FileFailure('plan.invalid', `The plan ${path} is not a renovation plan: ${shown}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}`);
  }
  const plan = parsed as RenovationPlanV1;
  if (plan.mode !== 'renovate') {
    throw new FileFailure('plan.invalid', `The plan ${path} is a "${plan.mode}" plan; only a renovate plan compiles into a Design document.`);
  }
  return plan;
}

/** The Design tool version on this profile, for the session file. */
async function designToolVersion(): Promise<string | undefined> {
  try {
    const { readToolManifest } = await import('@lolly-tools/node-shell/content-roots');
    const manifest = readToolManifest('design') as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

/** The outputs one deck compiles to, in `outDir`. */
function compileOutputsFor(input: string, outDir: string, opts: TaskOpts): CompileOutputs {
  const name = stem(input);
  return {
    lolly: join(outDir, `${name}.lolly`),
    report: join(outDir, `${name}.report.json`),
    ...(opts.exportPptx ? { pptx: join(outDir, `${name}.rebranded.pptx`) } : {}),
    ...(opts.acceptSuggestions || opts.autoMatch ? { plan: join(outDir, `${name}.answered.plan.json`) } : {}),
  };
}

async function compileOne(task: Extract<DeckTask, { stage: 'compile' }>, system: RebrandResolvedSystem, onStage: StageSink, seen: Seen): Promise<DeckResult> {
  const { input, planFile, opts } = task;
  const name = stem(input);
  const outputs: CompileOutputs = { ...task.outputs };
  const bytes = await readInput(input);
  seen.hash = sha256(bytes);
  const parseXml = await xmlParser();

  let source: SourceDeckV1;
  let census: DeckCensusV1;
  let plan: RenovationPlanV1;
  let media: Map<string, PipelineMediaV1>;
  let flattened: FlattenedRecord | undefined;
  if (planFile) {
    plan = await readPlanFile(planFile, seen);
    if (plan.source.hash !== sourceHashOf(bytes)) {
      throw new FileFailure('plan.hash-mismatch', `The plan ${planFile} was made for other bytes (${plan.source.hash}), not ${input}.`);
    }
    const read = await readDeck({ bytes, name: basename(input), parseXml, instanceId: plan.source.instanceId, ...(await planRead(plan)) });
    ({ source, census, media } = read);
    flattened = flattenedRecord(read.flattened, read.read, opts);
    await onStage('census');
    checkPlanFits(plan, source, system.system);
    await onStage('plan');
  } else {
    const first = await firstRead(opts);
    const planned = await planDeck({
      bytes,
      name: basename(input),
      parseXml,
      system: system.system,
      ...first.read,
      ...(opts.preset ? { preset: opts.preset } : {}),
      onStage,
    });
    ({ source, census, plan, media } = planned);
    flattened = flattenedRecord(planned.flattened, planned.read, opts, first.unavailable);
  }

  const result = await compileDeck({
    source,
    census,
    plan,
    system: system.system,
    ...(opts.acceptSuggestions ? { acceptSuggestions: opts.acceptSuggestions } : {}),
    ...(opts.autoMatch ? { autoMatch: opts.autoMatch } : {}),
    author: opts.preset ? 'preset' : 'agent',
  });
  await onStage('compile');
  // The answered plan is written only when an answer or Auto-match changed it.
  if (result.appliedUnreviewed.length === 0 && result.autoMatched.length === 0) delete outputs.plan;
  const compiled: CompiledDeckV1 = result.compiled;
  const toolVersion = await designToolVersion();
  const session = designSessionFromCompiled(compiled, {
    label: source.source.title || name,
    projectId: `cli:${source.source.instanceId}`,
    ...(toolVersion ? { toolVersion } : {}),
  });
  const now = new Date().toISOString();
  const lolly = await buildDesignLolly({ session, media, name, exportedAt: now, ...(toolVersion ? { toolVersion } : {}) });
  // Read the file back through the reader the CLI opens sessions with, so a file
  // that would not open is a failure here rather than a surprise later.
  try {
    const { readLollyFile } = await import('@lolly-tools/node-shell/lolly-file');
    readLollyFile(lolly.bytes);
  } catch (err) {
    throw new FileFailure('export.failed', `The Design document for ${input} did not read back: ${err instanceof Error ? err.message : String(err)}`);
  }

  let pptxBytes: Uint8Array | undefined;
  const exportNotes: string[] = [];
  if (opts.exportPptx) {
    try {
      const { rasterizeSvgToPng } = await import('@lolly-tools/node-shell/raster');
      const pptx = await compiledDeckToPptx({
        compiled,
        system: system.system,
        media,
        resolveCatalog: (ref) => catalogAssetBytes(ref),
        rasterizeSvg: (svg, w, h) => rasterizeSvgToPng(new TextDecoder().decode(svg), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))),
        now,
        ...(source.source.title ? { title: source.source.title } : {}),
      });
      pptxBytes = pptx.bytes;
      exportNotes.push(...pptx.notes);
    } catch (err) {
      throw new FileFailure('export.failed', `The .pptx for ${input} could not be written: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const pending: PendingOutput[] = [];
  if (!opts.dryRun) {
    pending.push({ path: outputs.report!, data: json(result.report) }, { path: outputs.lolly!, data: lolly.bytes });
    if (pptxBytes && outputs.pptx) pending.push({ path: outputs.pptx, data: pptxBytes });
    if (outputs.plan) pending.push({ path: outputs.plan, data: json(result.plan) });
  }
  if (lolly.missingMedia.length) exportNotes.push(`${lolly.missingMedia.length} picture(s) the document draws were not held, so they travel as references.`);
  const record: FileRecord = {
    input,
    outcome: outcomeOf(result.plan, compiled),
    ...(planFile ? { planPath: planFile } : {}),
    outputs,
    written: false,
    counts: planSummary(result.plan, source, census),
    ...outcomeFields(outcomeCounts(result.plan, compiled)),
    appliedUnreviewed: result.appliedUnreviewed.length,
    ...(exportNotes.length ? { exportNotes } : {}),
    ...(flattened ? { flattened } : {}),
    ...(opts.autoMatch ? { autoMatched: autoMatchedRecord(result.report) } : {}),
  };
  return { record, outputs: pending, ...seen };
}

/**
 * Run one claimed deck in this thread, without writing its outputs. A file
 * failure becomes a failed record; a run-wide error is thrown.
 */
async function runTask(task: DeckTask, system: RebrandResolvedSystem, onStage: StageSink): Promise<DeckResult> {
  const seen: Seen = { hash: '' };
  try {
    return task.stage === 'plan' ? await planOne(task, system, onStage, seen) : await compileOne(task, system, onStage, seen);
  } catch (err) {
    if (err instanceof CliError) throw err;
    return { record: failedRecord(task.input, asFailure(err)), outputs: [], ...seen };
  }
}

/**
 * Write what one deck's work produced and hand back its final record: written,
 * or failed with the code the write failed with. Runs on the main thread.
 */
async function commitResult(input: string, result: DeckResult, force: boolean, own: ReadonlySet<string>): Promise<FileRecord> {
  if (result.record.error || result.outputs.length === 0) return result.record;
  try {
    await writeOutputs(result.outputs, input, force, own);
  } catch (err) {
    return failedRecord(input, asFailure(err));
  }
  return { ...result.record, written: true };
}

// ─── folder inputs ───────────────────────────────────────────────────────────

/** One deck of a run. */
interface DeckInput {
  /** The path as the run names it: as given, or joined onto the folder it was found in. */
  input: string;
  /** Its absolute path, the key the run record holds it under. */
  key: string;
  /** The subfolder of a folder input it was found in (`--recursive`), '' otherwise. */
  rel: string;
}

/** `x.rebranded.pptx` is what compile writes, never a deck to read from a folder. */
const OWN_OUTPUT = /\.rebranded\.pptx$/i;

function isDeckName(name: string): boolean {
  return /\.(pptx|pdf)$/i.test(name) && !OWN_OUTPUT.test(name) && !name.startsWith('.') && !name.startsWith('~$');
}

/**
 * The decks of one folder listing: a PDF beside a .pptx of the same name is an
 * export of that deck, so it is left out and the two never claim one output name.
 */
function withoutExports(names: string[]): string[] {
  const decks = new Set(names.filter((name) => /\.pptx$/i.test(name)).map((name) => name.slice(0, -5).toLowerCase()));
  return names.filter((name) => !/\.pdf$/i.test(name) || !decks.has(name.slice(0, -4).toLowerCase()));
}

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A directory's real path, so two spellings of one folder compare equal. */
function realKey(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/**
 * The decks in a folder, files by name then subfolders by name. `skip` holds the
 * real paths of the output folders, which are never read for input, and a
 * folder reached twice through a link is read once.
 */
function decksInFolder(root: string, recursive: boolean, skip: ReadonlySet<string>): DeckInput[] {
  const out: DeckInput[] = [];
  const visited = new Set<string>();
  const walk = (dir: string, rel: string): void => {
    const real = realKey(dir);
    if (visited.has(real)) return;
    visited.add(real);
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      throw usageError(`${dir} could not be listed: ${errText(err)}`, 'BAD_INPUT');
    }
    const files: string[] = [];
    const dirs: string[] = [];
    for (const entry of entries) {
      let isFile = entry.isFile();
      let isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        try {
          const stat = statSync(join(dir, entry.name));
          isFile = stat.isFile();
          isDir = stat.isDirectory();
        } catch {
          continue;
        }
      }
      if (isFile && isDeckName(entry.name)) files.push(entry.name);
      else if (isDir && recursive && !entry.name.startsWith('.')) dirs.push(entry.name);
    }
    for (const name of withoutExports(files).sort(byName)) {
      const input = join(dir, name);
      out.push({ input, key: resolve(input), rel });
    }
    for (const name of dirs.sort(byName)) {
      const full = join(dir, name);
      if (skip.has(realKey(full))) continue;
      walk(full, rel ? join(rel, name) : name);
    }
  };
  walk(root, '');
  return out;
}

/**
 * The decks a run's arguments name: a folder expands to its decks, a file stays
 * as given, and a deck named twice runs once.
 */
function expandInputs(args: string[], recursive: boolean, skip: ReadonlySet<string>): { decks: DeckInput[]; folder: boolean } {
  const decks: DeckInput[] = [];
  const seen = new Set<string>();
  let folder = false;
  for (const arg of args) {
    if (isDirectory(arg)) {
      folder = true;
      const found = decksInFolder(arg, recursive, skip);
      if (found.length === 0) {
        throw usageError(`${arg} holds no .pptx or .pdf files${recursive ? '' : ' at its top level; --recursive also reads its subfolders'}.`, 'NO_INPUT');
      }
      for (const deck of found) {
        if (seen.has(deck.key)) continue;
        seen.add(deck.key);
        decks.push(deck);
      }
      continue;
    }
    const key = resolve(arg);
    if (seen.has(key)) continue;
    seen.add(key);
    decks.push({ input: arg, key, rel: '' });
  }
  return { decks, folder };
}

/** Where each deck's plan goes. */
function planPathsFor(decks: DeckInput[], planOut: string | undefined, folder: boolean): { paths: string[]; asDir: boolean } {
  if (planOut === undefined) return { paths: decks.map((deck) => join(dirname(deck.input), `${stem(deck.input)}.plan.json`)), asDir: false };
  const asDir = folder || decks.length > 1 || planOut.endsWith('/') || isDirectory(planOut);
  if (!asDir) return { paths: [planOut], asDir };
  return { paths: decks.map((deck) => join(planOut, deck.rel, `${stem(deck.input)}.plan.json`)), asDir };
}

// ─── the run record ──────────────────────────────────────────────────────────

/** The stage a finished deck's entry records: `plan` after the plan stage, `done` after a compile. */
const FINAL_STAGE: Record<RebrandRunStage, ProjectStageV1> = { plan: 'plan', compile: 'done' };

const isStage = (value: unknown): value is ProjectStageV1 => typeof value === 'string' && (PROJECT_STAGES as readonly string[]).includes(value);
const isContractCode = (value: unknown): value is RebrandErrorCodeV1 => typeof value === 'string' && (REBRAND_ERROR_CODES as readonly string[]).includes(value);

/**
 * The entries of a run record as they are on disk, read before the manifest
 * opens it: opening resets a changed deck's outputs, and `--resume` needs to know
 * which files were that deck's own. Empty when there is no record or it cannot be
 * read; the manifest itself says what happened to an unreadable one.
 */
function readRunRecord(dir: string): Map<string, RunFileV1> {
  const out = new Map<string, RunFileV1>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(dir, RUN_MANIFEST_FILE), 'utf8'));
  } catch {
    return out;
  }
  const files = (parsed as { files?: unknown } | null)?.files;
  if (!Array.isArray(files)) return out;
  for (const raw of files) {
    const rec = raw as Record<string, unknown> | null;
    if (!rec || typeof rec.input !== 'string') continue;
    const outcome = (RUN_OUTCOMES as readonly unknown[]).includes(rec.outcome) ? (rec.outcome as RunFileV1['outcome']) : 'pending';
    out.set(rec.input, {
      input: rec.input,
      hash: typeof rec.hash === 'string' ? rec.hash : '',
      outcome,
      stage: isStage(rec.stage) ? rec.stage : 'ingest',
      outputs: Array.isArray(rec.outputs) ? rec.outputs.filter((p): p is string => typeof p === 'string') : [],
      ...(isContractCode(rec.errorCode) ? { errorCode: rec.errorCode } : {}),
      ...(typeof rec.message === 'string' ? { message: rec.message } : {}),
    });
  }
  return out;
}

/**
 * The stage record, kept beside the run record by this surface. The run record
 * holds one outcome and one output list per deck, which a plan run and a compile
 * run into one folder would overwrite in turn, and it does not know what a stage
 * was asked to do. The stage record holds, per deck and per stage, the hash of
 * the bytes that stage read, what it was asked to do, how it ended and what it
 * wrote, and per deck every output a run into this folder wrote for it, whatever
 * its bytes were then. `--resume` reads it; the run record stays the account of
 * each deck's latest attempt.
 */
export const RUN_STAGES_FILE = '.lolly-rebrand-stages.json';
const RUN_STAGES_VERSION = 1;

/** What one stage last did for one deck. */
interface StageRunV1 {
  /** `sha256:<hex>` of the deck bytes the stage read, or '' when it read none. */
  hash: string;
  /** What the stage was asked to do, from `fingerprintOf`. */
  fingerprint: string;
  outcome: FileOutcomeV1;
  code?: RebrandFileErrorCode;
  message?: string;
  /** The outputs this stage wrote, absolute. */
  outputs: string[];
}

/** One deck in the stage record. */
interface StageEntryV1 {
  /** Every output a run into this folder wrote for the deck, absolute. */
  owned: string[];
  plan?: StageRunV1;
  compile?: StageRunV1;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : []);

function readStageRun(raw: unknown): StageRunV1 | undefined {
  const rec = raw as Record<string, unknown> | null;
  if (!rec || typeof rec !== 'object' || typeof rec.hash !== 'string' || typeof rec.fingerprint !== 'string') return undefined;
  if (rec.outcome !== 'ready' && rec.outcome !== 'needs-review' && rec.outcome !== 'failed') return undefined;
  return {
    hash: rec.hash,
    fingerprint: rec.fingerprint,
    outcome: rec.outcome,
    ...(typeof rec.code === 'string' && isFileCode(rec.code) ? { code: rec.code } : {}),
    ...(typeof rec.message === 'string' ? { message: rec.message } : {}),
    outputs: strings(rec.outputs),
  };
}

/**
 * The stage record of one output folder. A record that cannot be read counts as
 * empty, so every deck runs again; nothing is lost, since the outputs it listed
 * are refused rather than replaced until `--force`.
 */
class StageLedger {
  readonly path: string;
  private readonly files = new Map<string, StageEntryV1>();
  private chain: Promise<void> = Promise.resolve();
  private warned = false;

  constructor(dir: string) {
    this.path = join(dir, RUN_STAGES_FILE);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.path, 'utf8'));
    } catch {
      return;
    }
    const doc = parsed as { version?: unknown; files?: unknown } | null;
    if (!doc || doc.version !== RUN_STAGES_VERSION || !doc.files || typeof doc.files !== 'object') return;
    for (const [key, raw] of Object.entries(doc.files as Record<string, unknown>)) {
      const rec = raw as Record<string, unknown> | null;
      if (!rec || typeof rec !== 'object') continue;
      const plan = readStageRun(rec.plan);
      const compile = readStageRun(rec.compile);
      this.files.set(key, { owned: strings(rec.owned), ...(plan ? { plan } : {}), ...(compile ? { compile } : {}) });
    }
  }

  stage(key: string, stage: RebrandRunStage): StageRunV1 | undefined {
    return this.files.get(key)?.[stage];
  }

  owned(key: string): string[] {
    return [...(this.files.get(key)?.owned ?? [])];
  }

  /** Record what one stage did for one deck, and add what it wrote to the deck's outputs. */
  async record(key: string, stage: RebrandRunStage, run: StageRunV1): Promise<void> {
    const entry = this.files.get(key) ?? { owned: [] };
    entry[stage] = run;
    entry.owned = [...new Set([...entry.owned, ...run.outputs])];
    this.files.set(key, entry);
    const text = json({ version: RUN_STAGES_VERSION, files: Object.fromEntries(this.files) });
    this.chain = this.chain.then(() => writeAtomic(nodeRebrandFs, this.path, text)).catch((err: unknown) => {
      if (!this.warned) note(`The stage record ${this.path} could not be written, so --resume will run these decks again: ${errText(err)}`);
      this.warned = true;
    });
    await this.chain;
  }
}

/**
 * What a stage was asked to do, as one string two runs compare: the stage, the
 * preset's content, and for a compile the plan file's bytes (or no plan), the
 * pptx export and the accept scope. A deck finished under one of these runs
 * again under another.
 */
function fingerprintOf(stage: RebrandRunStage, opts: TaskOpts, planHash: string | null): string {
  const preset = opts.preset ? sha256(JSON.stringify(opts.preset)) : null;
  // `--ocr` joins the fingerprint only when it is on, so a record written before it existed still matches.
  const ocr = opts.ocr ? { ocr: true } : {};
  // `--auto-match` joins it the same way, only when given.
  const auto = opts.autoMatch ? { autoMatch: opts.autoMatch } : {};
  if (stage === 'plan') return JSON.stringify({ stage, preset, ...ocr, ...auto });
  return JSON.stringify({ stage, preset, plan: planHash, exportPptx: opts.exportPptx, accept: opts.acceptSuggestions, ...ocr, ...auto });
}

/** Failures that belong to the bytes themselves, so every stage and every option fails the same way. */
const BYTES_FAILURES: ReadonlySet<RebrandFileErrorCode> = new Set<RebrandFileErrorCode>(['source.unreadable', 'source.encrypted']);

/** True when this stage record failed on these same bytes for a reason of the bytes alone. */
function failedOnBytes(run: StageRunV1 | undefined, hash: string): boolean {
  return !!run && !!hash && run.hash === hash && run.outcome === 'failed' && run.code !== undefined && BYTES_FAILURES.has(run.code);
}

/**
 * True when `--resume` may leave this deck alone for this stage: the stage ran
 * on these same bytes, was asked to do the same thing, and either finished with
 * every output still on disk or failed with a code the same bytes and the same
 * plan fail with again. Anything the stage record does not know runs.
 */
function stageFinished(run: StageRunV1 | undefined, hash: string, fingerprint: string): boolean {
  if (failedOnBytes(run, hash)) return true;
  if (!run || !hash || run.hash !== hash || run.fingerprint !== fingerprint) return false;
  if (run.outcome !== 'failed') return run.outputs.every((path) => existsSync(path));
  const code = run.code;
  return code !== undefined && isContractCode(code) && RUN_PERMANENT_ERROR_CODES.includes(code);
}

/** The record of a deck `--resume` left alone. */
function skippedRecord(deck: DeckInput, stage: RebrandRunStage, run: StageRunV1, entry: RunFileV1 | null): FileRecord {
  const record: FileRecord = {
    input: deck.input,
    outcome: run.outcome,
    written: false,
    skipped: true,
    checkpoint: run.outcome === 'failed' ? entry?.stage ?? 'ingest' : FINAL_STAGE[stage],
    recordedOutputs: [...run.outputs],
  };
  if (run.outcome === 'failed') {
    const code: RebrandFileErrorCode = run.code ?? 'export.failed';
    record.error = { code, exit: CODE_EXIT[code], message: run.message ?? 'This deck failed on an earlier run.' };
  }
  return record;
}

/**
 * The code a failure is recorded under in the run record. The run record holds
 * contract codes only; a code of this surface alone, and the pipeline's
 * `source.unsupported`, is recorded without one, which the run record reads as
 * worth another attempt.
 */
function recordedCode(code: RebrandFileErrorCode): RebrandErrorCodeV1 | undefined {
  return isContractCode(code) ? code : undefined;
}

/** The output paths a finished record wrote. */
function writtenPaths(record: FileRecord, stage: RebrandRunStage): string[] {
  if (!record.written || record.error) return [];
  const paths = stage === 'plan' ? [record.planPath, record.reportPath] : Object.values(record.outputs ?? {});
  return paths.filter((path): path is string => typeof path === 'string').map((path) => resolve(path));
}

// ─── running several decks ───────────────────────────────────────────────────

interface BatchResult {
  files: FileRecord[];
  notAttempted: string[];
}

/** Progress after each deck, for the CLI's notes and the bulk driver's ETA. */
export interface RebrandProgressV1 {
  /** Decks finished in this run, skipped decks not counted. */
  done: number;
  /** Decks this run works on. */
  total: number;
  record: FileRecord;
  elapsedMs: number;
  /** The time the rest should take at the pace so far, or null once the last deck is done. */
  etaMs: number | null;
}

/** Hooks a caller of `runRebrand` may pass. */
export interface RebrandHooksV1 {
  onProgress?: (progress: RebrandProgressV1) => void;
}

/** `42s` or `3m 05s`. */
export function formatSeconds(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
}

/** `[3/12, 40s, about 1m 20s left] deck.pptx: ready`. */
export function progressLine(progress: RebrandProgressV1): string {
  const eta = progress.etaMs === null ? '' : `, about ${formatSeconds(progress.etaMs)} left`;
  const what = progress.record.error ? `failed (${progress.record.error.code})` : progress.record.outcome;
  return `[${progress.done}/${progress.total}, ${formatSeconds(progress.elapsedMs)}${eta}] ${progress.record.input}: ${what}`;
}

/**
 * The worker thread entry beside this module: `rebrand-worker.ts` in a checkout,
 * `rebrand-worker.js` in a bundled build that ships one, or null when neither is
 * there.
 */
function workerUrl(): URL | null {
  const names = /\.ts$/i.test(new URL(import.meta.url).pathname)
    ? ['./rebrand-worker.ts', './rebrand-worker.js']
    : ['./rebrand-worker.js', './rebrand-worker.ts'];
  for (const name of names) {
    const url = new URL(name, import.meta.url);
    if (url.protocol === 'file:' && existsSync(fileURLToPath(url))) return url;
  }
  return null;
}

/** What a worker sends back. */
type WorkerReply =
  | { id: number; type: 'stage'; stage: ProjectStageV1 }
  | { id: number; type: 'result'; result: DeckResult }
  | { id: number; type: 'fatal'; message: string; exit: number; kind: string; detail?: string };

/** One worker thread that runs decks one at a time. A thread that dies is replaced on the next deck. */
class DeckWorker {
  private worker: Worker | null = null;
  private seq = 0;
  private current: { id: number; resolve: (result: DeckResult) => void; reject: (err: unknown) => void; onStage: StageSink } | null = null;

  private readonly url: URL;

  constructor(url: URL) {
    this.url = url;
  }

  run(task: DeckTask, onStage: StageSink): Promise<DeckResult> {
    const worker = this.worker ?? this.spawn();
    const id = ++this.seq;
    return new Promise<DeckResult>((resolveRun, rejectRun) => {
      this.current = { id, resolve: resolveRun, reject: rejectRun, onStage };
      worker.postMessage({ id, task });
    });
  }

  private spawn(): Worker {
    const worker = new Worker(this.url);
    this.worker = worker;
    worker.on('message', (reply: WorkerReply) => {
      const current = this.current;
      if (!current || reply.id !== current.id) return;
      if (reply.type === 'stage') {
        void current.onStage(reply.stage);
        return;
      }
      this.current = null;
      if (reply.type === 'result') current.resolve(reply.result);
      else current.reject(new CliError(reply.message, reply.exit, reply.kind, reply.detail));
    });
    const lost = (err: Error): void => {
      if (this.worker === worker) this.worker = null;
      const current = this.current;
      this.current = null;
      current?.reject(err);
    };
    worker.on('error', (err) => {
      lost(err instanceof Error ? err : new Error(String(err)));
      void worker.terminate();
    });
    worker.on('exit', (code) => lost(new Error(`The worker thread stopped with code ${code}.`)));
    return worker;
  }

  async close(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    if (worker) await worker.terminate();
  }
}

/**
 * Serve decks inside a worker thread (`rebrand-worker.ts`). The design system is
 * read once per thread and per preset, quietly: the main thread already printed
 * its notes. The worker writes nothing; the outputs travel back with the result.
 */
export function serveRebrandWorker(port: { on(event: 'message', listener: (message: { id: number; task: DeckTask }) => void): unknown; postMessage(value: WorkerReply): void }): void {
  const systems = new Map<string, Promise<RebrandResolvedSystem>>();
  const systemFor = (preset: RenovationPresetV1 | undefined): Promise<RebrandResolvedSystem> => {
    const key = preset ? JSON.stringify(preset) : '';
    let found = systems.get(key);
    if (!found) {
      found = designSystem({ quiet: true }).then((resolved) => presetSystem(resolved, preset));
      systems.set(key, found);
    }
    return found;
  };
  port.on('message', ({ id, task }) => {
    void (async () => {
      try {
        const system = await systemFor(task.opts.preset);
        const result = await runTask(task, system, (stage) => port.postMessage({ id, type: 'stage', stage }));
        port.postMessage({ id, type: 'result', result });
      } catch (err) {
        const error = asRunError(err);
        port.postMessage({ id, type: 'fatal', message: error.message, exit: error.exit, kind: error.kind, ...(error.detail !== undefined ? { detail: error.detail } : {}) });
      }
    })();
  });
}

/** The `--jobs` a run uses: at least 1, at most `REBRAND_MAX_JOBS` and the core count. */
function jobsFor(flags: Record<string, string>): number {
  const asked = positiveInt(flags, 'jobs', 1);
  const cap = Math.max(1, Math.min(REBRAND_MAX_JOBS, availableParallelism()));
  if (asked > cap) note(`--jobs=${asked} is more than this machine runs at once, so ${cap} decks run at a time.`);
  return Math.min(asked, cap);
}

/** Everything one run over decks needs. */
interface RunPlan {
  stage: RebrandRunStage;
  decks: DeckInput[];
  /** Builds one deck's task, or its failed record when a claim is refused. */
  prepare: (deck: DeckInput, index: number) => { task: DeckTask } | { record: FileRecord };
  /** Writes one deck's outputs on the main thread and hands back its final record. */
  commit: (deck: DeckInput, index: number, result: DeckResult) => Promise<FileRecord>;
  /** What the stage was asked to do for one deck, given the plan hash its work read. */
  fingerprint: (index: number, planHash: string | undefined) => string;
  /** The hash of each deck when the run opened, '' where it is not known. */
  hashes: string[];
  system: RebrandResolvedSystem;
  manifest: RunManifestV1 | null;
  /** The stage record to write, or null on a dry run and a run that keeps no record. */
  ledger: StageLedger | null;
  /** The worker thread entry, when the decks run in worker threads. */
  worker: URL | null;
  /** Deck indexes that run; the others already hold a record in `slots`. */
  work: number[];
  slots: Array<FileRecord | undefined>;
  jobs: number;
  keepGoing: boolean;
  hooks: RebrandHooksV1;
}

/** A promise with its resolver, which a later deck waits on. */
function gate(): { promise: Promise<void>; open: () => void } {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolveGate) => {
    open = resolveGate;
  });
  return { promise, open };
}

/**
 * Run the claimed decks through a pool of `jobs` lanes, one worker thread per
 * lane when there are several. Decks are claimed in deck order, their outputs
 * written and the run record kept here, on the main thread, and each record is
 * kept at its deck's index. Without `--keep-going` a deck is written only after
 * every deck before it, and a deck still running when an earlier one fails is
 * dropped: nothing of it is written, its run record entry goes back to what it
 * was, and it is listed as not attempted. So every `--jobs` value reports the
 * same records in the same order. Progress arrives in the order decks finish.
 */
async function runPool(run: RunPlan): Promise<BatchResult> {
  const { decks, manifest, ledger, stage, work, slots } = run;
  const started = new Set<number>();
  const startedAt = Date.now();
  let done = 0;
  let stop = false;
  let fatal: unknown = null;
  let recordWarned = false;

  const mark = async (key: string, fields: Parameters<RunManifestV1['markOutcome']>[1]): Promise<void> => {
    if (!manifest) return;
    try {
      await manifest.markOutcome(key, fields);
    } catch (err) {
      if (!recordWarned) note(`The run record ${manifest.path} could not be written, so --resume will not know about this run: ${errText(err)}`);
      recordWarned = true;
    }
  };

  /** Put a deck's run record entry back as it was before this run touched it. */
  const restore = async (key: string, before: RunFileV1 | null): Promise<void> => {
    if (!before) return;
    await mark(key, {
      outcome: before.outcome,
      stage: before.stage,
      outputs: before.outputs,
      ...(before.errorCode ? { errorCode: before.errorCode } : {}),
      ...(before.message ? { message: before.message } : {}),
    });
  };

  /** Record a finished deck and report progress. `result` is null for a claim refused before anything was written. */
  const settle = async (deck: DeckInput, index: number, record: FileRecord, result: DeckResult | null): Promise<void> => {
    // A refused claim leaves both records as they were, so a finished deck stays finished.
    if (result) {
      const opened = run.hashes[index] ?? '';
      const hash = result.hash || opened;
      const fingerprint = run.fingerprint(index, result.planHash);
      const written = writtenPaths(record, stage);
      if (record.error) {
        await ledger?.record(deck.key, stage, {
          hash,
          fingerprint,
          outcome: 'failed',
          code: record.error.code,
          message: record.error.message,
          outputs: [],
        });
      } else if (record.written) {
        await ledger?.record(deck.key, stage, { hash, fingerprint, outcome: record.outcome, outputs: written });
      }
      // The run record lists every output of this deck that is on disk, from either
      // stage and from earlier bytes too, so it matches the folder.
      const known = [...(manifest?.file(deck.key)?.outputs ?? []), ...(ledger?.owned(deck.key) ?? []), ...written];
      const onDisk = [...new Set(known.map((path) => resolve(path)))].filter((path) => existsSync(path));
      if (record.error) {
        const code = recordedCode(record.error.code);
        await mark(deck.key, { outcome: 'failed', outputs: onDisk, message: record.error.message, ...(code ? { errorCode: code } : {}) });
      } else if (record.written) {
        // Bytes that changed while the deck ran leave the entry pending, so the
        // next --resume runs it again whatever the stage record says.
        const moved = result.hash !== '' && opened !== '' && result.hash !== opened;
        await mark(deck.key, moved
          ? { outcome: 'pending', stage: 'ingest', outputs: onDisk }
          : { outcome: record.outcome, stage: FINAL_STAGE[stage], outputs: onDisk });
      }
    }
    done += 1;
    const elapsedMs = Date.now() - startedAt;
    run.hooks.onProgress?.({
      done,
      total: work.length,
      record,
      elapsedMs,
      etaMs: done < work.length ? (elapsedMs / done) * (work.length - done) : null,
    });
  };

  const useWorkers = run.worker !== null && run.jobs > 1 && work.length > 1;
  const lanes = useWorkers ? Math.min(run.jobs, work.length) : 1;
  const turns = work.map(() => gate());
  /** Without --keep-going, wait until every earlier deck is settled; true when this deck is dropped. */
  const dropped = async (position: number): Promise<boolean> => {
    if (run.keepGoing) return false;
    if (position > 0) await turns[position - 1]!.promise;
    return stop;
  };
  let cursor = 0;
  const lane = async (): Promise<void> => {
    const worker = useWorkers && run.worker ? new DeckWorker(run.worker) : null;
    try {
      // `cursor++` happens between awaits on one thread, so every lane takes a distinct deck.
      for (let position = cursor++; position < work.length && !stop; position = cursor++) {
        const index = work[position]!;
        const deck = decks[index]!;
        try {
          started.add(index);
          const prepared = run.prepare(deck, index);
          if ('record' in prepared) {
            // Refused before anything was written: the entry stays as it was.
            if (await dropped(position)) {
              started.delete(index);
              continue;
            }
            slots[index] = prepared.record;
            await settle(deck, index, prepared.record, null);
            if (!run.keepGoing) stop = true;
            continue;
          }
          const before = manifest?.file(deck.key) ?? null;
          await mark(deck.key, { outcome: 'pending', stage: 'ingest' });
          const onStage: StageSink = (reached) => mark(deck.key, { stage: reached });
          let result: DeckResult;
          try {
            result = worker ? await worker.run(prepared.task, onStage) : await runTask(prepared.task, run.system, onStage);
          } catch (err) {
            if (err instanceof CliError) {
              fatal ??= err;
              stop = true;
              await restore(deck.key, before);
              return;
            }
            result = { record: failedRecord(deck.input, new FileFailure('internal', `The worker thread running ${deck.input} stopped: ${errText(err)}`)), outputs: [], hash: '' };
          }
          if (await dropped(position)) {
            // An earlier deck failed while this one ran: as with --jobs=1, it was never attempted.
            started.delete(index);
            await restore(deck.key, before);
            continue;
          }
          const record = await run.commit(deck, index, result);
          slots[index] = record;
          await settle(deck, index, record, result);
          if (record.outcome === 'failed' && !run.keepGoing) stop = true;
        } finally {
          turns[position]!.open();
        }
      }
    } finally {
      await worker?.close();
    }
  };
  await Promise.all(Array.from({ length: lanes }, () => lane()));
  if (fatal) throw fatal;

  const files = slots.filter((record): record is FileRecord => record !== undefined);
  const notAttempted = work.filter((index) => !started.has(index)).map((index) => decks[index]!.input);
  return { files, notAttempted };
}

function totals(files: FileRecord[]): Record<FileOutcomeV1, number> {
  const out: Record<FileOutcomeV1, number> = { ready: 0, 'needs-review': 0, failed: 0 };
  for (const file of files) out[file.outcome] += 1;
  return out;
}

/** The counts the summary line states. */
export interface RebrandSummaryV1 {
  decks: number;
  ran: number;
  skipped: number;
  ready: number;
  needsReview: number;
  failed: number;
  notAttempted: number;
}

function summaryOf(batch: BatchResult): RebrandSummaryV1 {
  const counts = totals(batch.files);
  const skipped = batch.files.filter((file) => file.skipped).length;
  return {
    decks: batch.files.length + batch.notAttempted.length,
    ran: batch.files.length - skipped,
    skipped,
    ready: counts.ready,
    needsReview: counts['needs-review'],
    failed: counts.failed,
    notAttempted: batch.notAttempted.length,
  };
}

/** `4 decks: 2 ready, 1 needs review, 1 failed; 1 skipped by --resume; 0 not attempted.` */
export function summarySentence(summary: RebrandSummaryV1): string {
  const decks = `${summary.decks} deck${summary.decks === 1 ? '' : 's'}`;
  const review = `${summary.needsReview} ${summary.needsReview === 1 ? 'needs' : 'need'} review`;
  return `${decks}: ${summary.ready} ready, ${review}, ${summary.failed} failed; ${summary.skipped} skipped by --resume; ${summary.notAttempted} not attempted.`;
}

function runExit(batch: BatchResult, reviewCounts: boolean): number {
  let exit: number = EXIT.OK;
  for (const file of batch.files) {
    if (file.error) exit = worse(exit, file.error.exit);
    else if (reviewCounts && file.outcome === 'needs-review') exit = worse(exit, EXIT_NEEDS_REVIEW);
  }
  return exit;
}

/** "Auto-match set 5 slides: 3 clear, 2 likely", or that it set none. */
export function autoMatchedWords(counts: AutoMatchedRecord): string {
  if (counts.total === 0) return 'Auto-match set no slide';
  const bands = (['clear', 'likely', 'none'] as const)
    .filter((band) => counts[band] > 0)
    .map((band) => `${counts[band]} ${band === 'none' ? 'unsure' : band}`);
  return `Auto-match set ${counts.total} ${counts.total === 1 ? 'slide' : 'slides'}: ${bands.join(', ')}`;
}

/** One deck's line in the text report. */
export function summaryLine(file: FileRecord): string {
  if (file.skipped) {
    const why = file.error ? `failed (${file.error.code}) on an earlier run, and the same bytes fail the same way` : `${file.outcome} on an earlier run`;
    return `${file.input}: ${why}; left as it was`;
  }
  if (file.error) return `${file.input}: failed (${file.error.code}) ${file.error.message}`;
  const c = file.counts;
  const parts: string[] = [`${file.input}: ${file.outcome}`];
  if (c) {
    parts.push(`${c.slides.included} of ${c.slides.total} slides`);
    parts.push(`keep ${c.objects.keep}, replace ${c.objects.replace}, remove ${c.objects.remove}`);
  }
  const waiting: string[] = [];
  if (file.attention) waiting.push(`${file.attention} need attention`);
  if (file.pending) waiting.push(`${file.pending} unreviewed`);
  if (file.unresolvedObjects) waiting.push(`${file.unresolvedObjects} unresolved objects`);
  if (file.unresolvedColours) waiting.push(`${file.unresolvedColours} unresolved colours`);
  if (file.appliedUnreviewed) waiting.push(`${file.appliedUnreviewed} applied unreviewed`);
  if (file.tray) waiting.push(`${file.tray} in the tray`);
  if (waiting.length) parts.push(waiting.join(', '));
  if (file.autoMatched) parts.push(autoMatchedWords(file.autoMatched));
  return parts.join('; ');
}

/** What `runRebrand` hands back: the exit code and the result the envelope carries. */
export interface RebrandRunResultV1 {
  exit: number;
  result: {
    stage: RebrandRunStage;
    files: FileRecord[];
    notAttempted: string[];
    totals: Record<FileOutcomeV1, number>;
    summary: RebrandSummaryV1;
    run: { record: string | null; resume: boolean; jobs: number };
  } & Record<string, unknown>;
}

async function report(outcome: RebrandRunResultV1, asJson: boolean): Promise<void> {
  const { result, exit } = outcome;
  if (asJson) {
    await emitResult(result, exit);
    return;
  }
  const lines: string[] = [];
  for (const file of result.files) {
    lines.push(summaryLine(file));
    const written = file.written ? 'wrote' : 'would write';
    if (!file.error && !file.skipped) {
      const paths = [file.planPath && result.stage === 'plan' ? file.planPath : undefined, file.reportPath, ...Object.values(file.outputs ?? {})]
        .filter((path): path is string => typeof path === 'string');
      if (paths.length) lines.push(`  ${written} ${paths.join(', ')}`);
      for (const line of file.exportNotes ?? []) lines.push(`  pptx: ${line}`);
      if (file.flattened) lines.push(`  ${file.flattened.note}`);
      if (file.tray) lines.push(`  ${file.tray} kept object(s) fit no slide and are not on the canvas; the report names them.`);
    }
  }
  if (result.notAttempted.length) lines.push(`Not attempted after the failure (pass --keep-going to continue): ${result.notAttempted.join(', ')}`);
  lines.push(summarySentence(result.summary));
  if (result.run.record) lines.push(`The run record is ${result.run.record}; --resume runs only the decks that still need work.`);
  await writeOut(`${lines.join('\n')}\n`);
}

// ─── inspect ─────────────────────────────────────────────────────────────────

interface Inspected {
  source: SourceDeckV1;
  census: DeckCensusV1;
  plan: RenovationPlanV1;
  planPath?: string;
  sourcePath: string;
}

/**
 * The decks a plan may have been made from when `--source` is not given:
 * `<name>.pptx` and `<name>.pdf` beside `<name>.plan.json` or
 * `<name>.answered.plan.json`, those that exist. Both can, since a folder run
 * reads the pptx and `plan deck.pdf` writes the same plan name, so the caller
 * keeps the one whose bytes the plan pins.
 */
function siblingSources(planPath: string): string[] {
  const dir = dirname(planPath);
  const name = basename(planPath).replace(/(?:\.answered)?\.plan\.json$/i, '').replace(/\.json$/i, '');
  return [`${name}.pptx`, `${name}.pdf`].map((file) => join(dir, file)).filter((candidate) => existsSync(candidate));
}

async function inspectTarget(target: string, flags: Record<string, string>): Promise<Inspected> {
  const parseXml = await xmlParser();
  // Read first, so a preset that cannot be used is refused on either path.
  const chosen = readPreset(flags);
  if (/\.json$/i.test(target)) {
    if (chosen) note(`--preset=${chosen.id} shapes a first pass, and ${target} already holds its proposals, so the preset is not read here.`);
    let plan: RenovationPlanV1;
    try {
      plan = await readPlanFile(target);
    } catch (err) {
      throw asRunError(err);
    }
    const candidates = flags.source ? [flags.source] : siblingSources(target);
    if (candidates.length === 0) {
      throw usageError(`inspect needs the deck ${target} was made from: pass --source=<deck.pptx|deck.pdf>.`, 'SOURCE_REQUIRED');
    }
    let found: { sourcePath: string; bytes: Uint8Array } | null = null;
    for (const candidate of candidates) {
      let read: Uint8Array;
      try {
        read = await readInput(candidate);
      } catch (err) {
        throw asRunError(err);
      }
      if (sourceHashOf(read) === plan.source.hash) {
        found = { sourcePath: candidate, bytes: read };
        break;
      }
    }
    if (!found) {
      const named = candidates.join(' and ');
      throw asRunError(new FileFailure('plan.hash-mismatch', `${named} ${candidates.length === 1 ? 'is' : 'are'} not the deck ${target} was made from (the bytes differ).`));
    }
    const { sourcePath, bytes } = found;
    try {
      const read = await readDeck({ bytes, name: basename(sourcePath), parseXml, instanceId: plan.source.instanceId, ...(await planRead(plan)) });
      return { source: read.source, census: read.census, plan, planPath: target, sourcePath };
    } catch (err) {
      throw asRunError(err);
    }
  }
  let bytes: Uint8Array;
  try {
    bytes = await readInput(target);
  } catch (err) {
    throw asRunError(err);
  }
  const preset = chosen?.preset;
  const system = await presetSystem(await designSystem(), preset);
  try {
    const first = await firstRead({ dryRun: true, force: false, keepGoing: false, acceptSuggestions: false, exportPptx: false, ocr: isOn(flags.ocr) });
    if (first.unavailable) note(first.unavailable);
    const planned = await planDeck({ bytes, name: basename(target), parseXml, system: system.system, ...first.read, ...(preset ? { preset } : {}) });
    return { source: planned.source, census: planned.census, plan: planned.plan, sourcePath: target };
  } catch (err) {
    throw asRunError(err);
  }
}

interface Page<T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
}

function pageOf<T>(all: T[], page: number, limit: number): Page<T> {
  return { total: all.length, page, limit, items: all.slice((page - 1) * limit, page * limit) };
}

/** `1-3, 7, 9-12`. */
function slideRanges(numbers: number[]): string {
  const out: string[] = [];
  let start: number | undefined;
  let prev: number | undefined;
  for (const n of [...numbers].sort((a, b) => a - b)) {
    if (start === undefined) {
      start = n;
    } else if (n !== (prev ?? 0) + 1) {
      out.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = n;
    }
    prev = n;
  }
  if (start !== undefined) out.push(start === prev ? `${start}` : `${start}-${prev}`);
  return out.join(', ');
}

/** One plain sentence for an object's evidence: the strongest one the census wrote. */
function evidenceText(evidence: EvidenceV1[]): string {
  const ranked = [...evidence].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const sentence = ranked.find((one) => typeof one.sentence === 'string' && one.sentence.length > 0);
  if (sentence?.sentence) return sentence.sentence;
  const first = ranked[0];
  return first ? `${first.signal}: ${String(first.value)}` : 'No evidence was recorded.';
}

function queueRecord(item: QueueItemV1): Record<string, unknown> {
  return {
    id: item.id,
    section: item.section,
    class: item.class,
    action: item.action,
    proposal: item.proposal,
    review: item.review,
    fidelity: item.fidelity,
    title: item.title.text,
    titleCode: item.title.code,
    evidence: item.evidence.text,
    evidenceCode: item.evidence.code,
    slideNumbers: item.slideNumbers,
    objects: item.objectIds.length,
    objectIds: item.objectIds,
    // A slide-level card (a layout group, the diagrams) holds slides, not rows.
    ...(item.type ? { type: item.type, slideIds: item.slideIds } : {}),
    ...(item.layout ? { layout: item.layout } : {}),
  };
}

function pagingHint(what: string, page: Page<unknown>): string | undefined {
  if (page.total === 0) return undefined;
  const first = (page.page - 1) * page.limit + 1;
  const last = Math.min(page.total, page.page * page.limit);
  if (first > page.total) return `No ${what} on page ${page.page}; there are ${page.total}.`;
  const more = last < page.total ? ` --page=${page.page + 1} shows the next ${Math.min(page.limit, page.total - last)}.` : '';
  return `Showing ${what} ${first}-${last} of ${page.total}.${more}`;
}

async function inspectCli(target: string, flags: Record<string, string>, asJson: boolean): Promise<number> {
  const page = positiveInt(flags, 'page', 1);
  const limit = positiveInt(flags, 'limit', 20);
  const slideNumber = flags.slide === undefined ? undefined : positiveInt(flags, 'slide', 1);
  const { source, census, plan, planPath, sourcePath } = await inspectTarget(target, flags);
  const summary = planSummary(plan, source, census);
  const slides = slideStates(plan, source, census);
  const base = { input: target, ...(planPath ? { plan: planPath } : {}), source: sourcePath, summary };

  if (slideNumber !== undefined) {
    const state = slides.find((one) => one.number === slideNumber);
    if (!state) throw usageError(`--slide=${slideNumber} is not in this deck; it has ${slides.length} slides.`, 'BAD_FLAG_VALUE');
    const rows = plan.slides.find((one) => one.id === state.id)?.objects ?? [];
    const states = objectStates(plan, source);
    const objectOf = new Map(source.slides.flatMap((slide) => slide.objects).map((object) => [object.id, object]));
    const all = rows.map((row) => {
      const object = objectOf.get(row.id);
      const known = states.get(row.id);
      return {
        id: row.id,
        kind: object?.kind ?? 'unknown',
        class: row.class,
        action: effectiveAction(row),
        proposal: row.proposal,
        ...(row.decision !== undefined ? { decision: row.decision } : {}),
        review: row.review,
        fidelity: known?.fidelity ?? reviewFidelity(object),
        ...(row.author ? { author: row.author } : {}),
        locked: row.locked === true,
        evidence: evidenceText(row.evidence),
      };
    });
    const objects = pageOf(all, page, limit);
    if (asJson) {
      await emitResult({ ...base, slide: state, objects });
      return EXIT.OK;
    }
    const lines = [
      `Slide ${state.number}${state.title ? `: ${state.title}` : ''}`,
      `  ${state.include ? 'included' : 'left out'}, layout ${state.layout} (${state.layoutSource}), ${state.fidelity}; ${state.attention} need attention, ${state.unreviewed} unreviewed, ${state.removed} removed, ${state.unresolved} unresolved`,
      '',
    ];
    for (const object of objects.items) {
      lines.push(`${object.id}  ${object.kind}  ${object.class}  ${object.action}  ${object.review}  ${object.fidelity}${object.locked ? '  locked' : ''}`);
      lines.push(`    ${object.evidence}`);
    }
    const hint = pagingHint('objects', objects);
    if (hint) lines.push('', hint);
    await writeOut(`${lines.join('\n')}\n`);
    return EXIT.OK;
  }

  const queue = pageOf(reviewQueue(plan, census, source).map(queueRecord), page, limit);
  const slidePage = pageOf<SlideStateV1>(slides, page, limit);
  if (asJson) {
    await emitResult({ ...base, queue, slides: slidePage });
    return EXIT.OK;
  }
  const s = summary;
  const lines = [
    `${basename(sourcePath)}: ${s.slides.included} of ${s.slides.total} slides included`,
    `  objects: keep ${s.objects.keep}, replace ${s.objects.replace}, remove ${s.objects.remove}, unresolved ${s.objects.unresolved}`,
    `  review: ${s.review.attention} need attention, ${s.review.unreviewed} unreviewed, ${s.review.accepted} accepted`,
    `  colours: ${s.colours.assigned} assigned, ${s.colours.unresolved} unresolved, ${s.colours.locked} locked; fonts: ${s.fonts.substituted} substituted${s.flattened ? `; ${s.flattened} slides are one picture` : ''}`,
    '',
    'Queue',
  ];
  for (const item of queue.items) {
    const numbers = item.slideNumbers as number[];
    lines.push(`  [${String(item.section)}] ${String(item.title)} (slide${numbers.length === 1 ? '' : 's'} ${slideRanges(numbers)})`);
    lines.push(`      ${String(item.evidence)}`);
  }
  const queueHint = pagingHint('queue items', queue);
  if (queueHint) lines.push(`  ${queueHint}`);
  lines.push('', 'Slides');
  for (const one of slidePage.items) {
    lines.push(`  ${String(one.number).padStart(3)}  ${one.include ? 'in ' : 'out'}  ${one.layout.padEnd(11)} ${one.fidelity.padEnd(11)} attention ${one.attention}, unreviewed ${one.unreviewed}, removed ${one.removed}, unresolved ${one.unresolved}${one.title ? `  ${one.title}` : ''}`);
  }
  const slideHint = pagingHint('slides', slidePage);
  if (slideHint) lines.push(`  ${slideHint}`);
  lines.push('', '--slide=<n> lists one slide\'s objects with their class, action, review, fidelity and evidence.');
  await writeOut(`${lines.join('\n')}\n`);
  return EXIT.OK;
}

// ─── the entry ───────────────────────────────────────────────────────────────

/**
 * `--accept-suggestions`: bare (or `=unreviewed`) answers the unreviewed rows,
 * `=all` also the rows that need attention, an off value answers none.
 */
function acceptFlag(value: string | undefined): AcceptScopeV1 | false {
  if (value === undefined || !isOn(value)) return false;
  const lower = value.trim().toLowerCase();
  if (lower === 'all') return 'all';
  if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on' || lower === 'unreviewed') return 'unreviewed';
  throw usageError(`--accept-suggestions takes no value, or "all" to also answer the rows that need attention; not "${value}".`, 'BAD_FLAG_VALUE');
}

/**
 * `--auto-match`: bare (or an on value) means `all`, as decision 28 asks ("confident
 * CLI users can take their chances"); `=clear` and `=likely` narrow it; an off value
 * turns it off.
 */
function autoMatchFlag(value: string | undefined): AutoMatchBandsV1 | undefined {
  if (value === undefined || !isOn(value)) return undefined;
  const lower = value.trim().toLowerCase();
  const band = AUTO_MATCH_BANDS.find((one) => one === lower);
  if (band) return band;
  if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on') return 'all';
  throw usageError(`--auto-match takes no value, or one of clear, likely or all; not "${value}".`, 'BAD_FLAG_VALUE');
}

const USAGE_LINE = 'usage: lolly rebrand plan|compile|inspect <deck.pptx|deck.pdf|folder>... [flags], or lolly rebrand presets   (lolly --help lists the flags)';

/** Where a preset came from, in a few words. */
function presetOrigin(preset: ResolvedPresetV1): string {
  if (preset.origin === 'pack') return `design system, ${preset.assetId ?? preset.file}`;
  if (preset.origin === 'personal') return `personal, ${preset.file}`;
  return preset.file;
}

function presetSummary(preset: ResolvedPresetV1): Record<string, unknown> {
  return {
    id: preset.id,
    ...(preset.version !== undefined ? { version: preset.version } : {}),
    origin: preset.origin,
    file: preset.file,
    ...(preset.assetId ? { assetId: preset.assetId } : {}),
  };
}

/**
 * Run the plan or compile stage over decks and folders and hand back the exit
 * code and the result, without printing the report: `lolly rebrand` prints it,
 * and `scripts/renovate-decks.ts` prints its own. Usage errors are thrown as
 * `CliError`, as everywhere in this shell.
 */
export async function runRebrand(
  stage: RebrandRunStage,
  args: string[],
  flags: Record<string, string>,
  hooks: RebrandHooksV1 = {},
): Promise<RebrandRunResultV1> {
  checkFlags(stage, flags);
  if (args.length === 0) throw usageError(`lolly rebrand ${stage} needs at least one input. ${USAGE_LINE}`, 'MISSING_ARGUMENT');
  const opts = runOpts(flags);
  const resume = isOn(flags.resume);
  const jobs = jobsFor(flags);
  const chosen = readPreset(flags);
  const preset = chosen?.preset;
  const system = await presetSystem(await designSystem(), preset);

  // The output folders are never read for input, even when they sit inside it.
  const outDirFlag = flags['out-dir'];
  const planOut = flags['plan-out'];
  const skip = new Set<string>();
  if (stage === 'compile' && outDirFlag !== undefined) skip.add(realKey(outDirFlag));
  if (stage === 'plan' && planOut !== undefined) skip.add(realKey(planOut));
  const { decks, folder } = expandInputs(args, isOn(flags.recursive), skip);
  const several = folder || decks.length > 1;

  const autoMatch = autoMatchFlag(flags['auto-match']);
  const taskOpts: TaskOpts = {
    ...opts,
    acceptSuggestions: false,
    exportPptx: false,
    ocr: isOn(flags.ocr),
    ...(preset ? { preset } : {}),
    ...(autoMatch ? { autoMatch } : {}),
  };
  const extra: Record<string, unknown> = {
    designSystem: systemSummary(system),
    dryRun: opts.dryRun,
    ...(chosen ? { preset: presetSummary(chosen) } : {}),
    ...(autoMatch ? { autoMatch } : {}),
  };
  let recordDir: string | null = null;
  let build: (deck: DeckInput, index: number) => DeckTask;
  let planFileOf: (index: number) => string | undefined = () => undefined;

  if (stage === 'plan') {
    const { paths, asDir } = planPathsFor(decks, planOut, folder);
    const inFolder = planOut !== undefined && asDir;
    if (resume && !inFolder) throw usageError('--resume reads the run record in the --plan-out folder, so it needs --plan-out=<dir>.', 'MISSING_ARGUMENT');
    if (inFolder && (several || resume)) recordDir = resolve(planOut);
    build = (deck, index) => {
      const planPath = paths[index]!;
      return { stage: 'plan', input: deck.input, planPath, reportPath: reportBesidePlan(planPath), opts: taskOpts };
    };
  } else {
    const exportFlag = flags.export;
    if (exportFlag !== undefined && exportFlag.toLowerCase() !== 'pptx') {
      throw usageError(`--export=${exportFlag} is not a rebrand output. The Design document (.lolly) is always written; --export=pptx adds a native PowerPoint file.`, 'UNSUPPORTED_FORMAT');
    }
    if (several && outDirFlag === undefined) {
      throw usageError('Compiling several decks needs --out-dir=<dir>, so their outputs land in one place.', 'MISSING_ARGUMENT');
    }
    if (resume && outDirFlag === undefined) throw usageError('--resume reads the run record in --out-dir, so it needs --out-dir=<dir>.', 'MISSING_ARGUMENT');
    const planFiles = planSourcesFor(decks, flags.plan);
    planFileOf = (index) => planFiles[index];
    taskOpts.acceptSuggestions = acceptFlag(flags['accept-suggestions']);
    taskOpts.exportPptx = exportFlag !== undefined;
    if (preset && flags.plan !== undefined) {
      throw usageError('--preset shapes a first pass and --plan already holds its proposals, so pass one or the other.', 'CONFLICTING_FLAGS');
    }
    if (outDirFlag !== undefined && (several || resume)) recordDir = resolve(outDirFlag);
    build = (deck, index) => {
      const planFile = planFiles[index];
      const outDir = join(outDirFlag ?? dirname(deck.input), deck.rel);
      return {
        stage: 'compile',
        input: deck.input,
        ...(planFile !== undefined ? { planFile } : {}),
        outputs: compileOutputsFor(deck.input, outDir, taskOpts),
        opts: taskOpts,
      };
    };
    extra.acceptSuggestions = taskOpts.acceptSuggestions;
  }

  // The record as it was before this run opened it: the outputs each deck owns.
  const prior = recordDir && resume ? readRunRecord(recordDir) : new Map<string, RunFileV1>();
  const ledger = recordDir ? new StageLedger(recordDir) : null;
  let manifest: RunManifestV1 | null = null;
  if (recordDir && !opts.dryRun) {
    try {
      await mkdir(recordDir, { recursive: true });
      manifest = await createRunManifest(recordDir, { inputs: decks.map((deck) => deck.key) });
    } catch (err) {
      throw asRunError(new FileFailure('output.unwritable', `The run record in ${recordDir} could not be written: ${errText(err)}`));
    }
    if (manifest.setAside) note(`The run record in ${recordDir} could not be read, so it was moved to ${manifest.setAside} and a new one started.`);
  }

  // The hash of each deck and of each plan file as the run opens, which the stage
  // record compares against. The run record hashed the decks when it opened.
  const hashes: string[] = [];
  const planHashes: Array<string | null> = [];
  for (const [index, deck] of decks.entries()) {
    hashes.push(manifest ? manifest.file(deck.key)?.hash ?? '' : recordDir && resume ? await hashInput(nodeRebrandFs, deck.key) : '');
    const planFile = planFileOf(index);
    planHashes.push(planFile === undefined ? null : (await hashInput(nodeRebrandFs, planFile)) || 'unreadable');
  }
  const fingerprint = (index: number, planHash: string | undefined): string => fingerprintOf(stage, taskOpts, planHash ?? planHashes[index] ?? null);

  // Which decks run. Without --resume, every one.
  const slots: Array<FileRecord | undefined> = decks.map(() => undefined);
  const work: number[] = [];
  const otherStage: RebrandRunStage = stage === 'plan' ? 'compile' : 'plan';
  for (const [index, deck] of decks.entries()) {
    const hash = hashes[index] ?? '';
    const own = resume ? ledger?.stage(deck.key, stage) : undefined;
    const other = resume ? ledger?.stage(deck.key, otherStage) : undefined;
    // A deck the other stage found unreadable is unreadable here too.
    const done = stageFinished(own, hash, fingerprint(index, undefined)) ? own : failedOnBytes(other, hash) ? other : undefined;
    if (!done) {
      work.push(index);
      continue;
    }
    const entry = manifest?.file(deck.key) ?? null;
    slots[index] = skippedRecord(deck, stage, done, entry);
    // A run record entry reset when the bytes moved and moved back, or left pending
    // by a dropped deck, takes the finished state the stage record holds.
    if (manifest && entry?.outcome === 'pending') {
      const code = done.code ? recordedCode(done.code) : undefined;
      const outputs = ledger?.owned(deck.key).filter((path) => existsSync(path)) ?? [];
      await manifest.markOutcome(deck.key, done.outcome === 'failed'
        ? { outcome: 'failed', outputs, ...(code ? { errorCode: code } : {}), ...(done.message ? { message: done.message } : {}) }
        : { outcome: done.outcome, stage: FINAL_STAGE[stage], outputs }).catch(() => undefined);
    }
  }

  const hint = recordDir && !resume
    ? 'Pass --resume to leave the decks this run already finished, or --force to replace it.'
    : 'Pass --force to replace it.';
  const claimed = new Set<string>();
  /** Under --resume, the files the records list as a deck's own outputs, from either stage and earlier bytes. */
  const ownOf = (deck: DeckInput): Set<string> => {
    if (!resume) return new Set();
    return new Set([...(prior.get(deck.key)?.outputs ?? []), ...(ledger?.owned(deck.key) ?? [])].map((path) => resolve(path)));
  };
  const prepare = (deck: DeckInput, index: number): { task: DeckTask } | { record: FileRecord } => {
    const task = build(deck, index);
    const paths = task.stage === 'plan'
      ? [task.planPath, task.reportPath]
      : Object.values(task.outputs).filter((path): path is string => typeof path === 'string');
    try {
      claimOutputs(paths, deck.input, claimed, opts.force, ownOf(deck), hint);
    } catch (err) {
      return { record: failedRecord(deck.input, asFailure(err)) };
    }
    return { task };
  };
  const commit = (deck: DeckInput, _index: number, result: DeckResult): Promise<FileRecord> => commitResult(deck.input, result, opts.force, ownOf(deck));

  let lanes = jobs;
  const worker = jobs > 1 ? workerUrl() : null;
  if (jobs > 1 && !worker) {
    note('This build has no worker thread file for rebrand, so the decks run one after another.');
    lanes = 1;
  }
  const batch = await runPool({
    stage,
    decks,
    prepare,
    commit,
    fingerprint,
    hashes,
    system,
    manifest,
    ledger: opts.dryRun ? null : ledger,
    worker,
    work,
    slots,
    jobs: lanes,
    keepGoing: opts.keepGoing,
    hooks,
  });
  const exit = runExit(batch, stage === 'compile');
  return {
    exit,
    result: {
      stage,
      ...extra,
      files: batch.files,
      notAttempted: batch.notAttempted,
      totals: totals(batch.files),
      summary: summaryOf(batch),
      run: { record: manifest?.path ?? null, resume, jobs: lanes },
    },
  };
}

/** `lolly rebrand presets`: what resolves here, and what was found and could not be used. */
async function presetsCli(asJson: boolean): Promise<number> {
  const listing = listPresets();
  if (asJson) {
    await emitResult(listing);
    return EXIT.OK;
  }
  const lines: string[] = [];
  for (const one of listing.presets) {
    const label = one.name ? `  ${one.name}` : '';
    const shadowed = one.shadowed ? '; not used, since the design system has a preset with this id' : '';
    lines.push(`${one.id}${label}  (${presetOrigin(one)}${shadowed})`);
    if (one.description) lines.push(`  ${one.description}`);
  }
  for (const bad of listing.invalid) {
    lines.push(`Not usable: ${bad.file}${bad.id ? ` (${bad.id})` : ''}: ${bad.problems.join('; ')}`);
  }
  const usable = listing.presets.filter((one) => !one.shadowed).length;
  const where = listing.profile ? `the ${listing.profile} content profile` : 'this install, which has no content profile';
  lines.push(`${usable} preset${usable === 1 ? ' resolves' : 's resolve'} for ${where}; personal presets are read from ${listing.personalFile}.`);
  await writeOut(`${lines.join('\n')}\n`);
  return EXIT.OK;
}

/**
 * Run one stage. `args` are the positionals after `rebrand`; the result is the
 * exit code, which the caller sets on the process.
 */
export async function rebrandCli(args: string[], flags: Record<string, string>, asJson: boolean): Promise<number> {
  const [stageArg, ...inputs] = args;
  if (!stageArg || !(REBRAND_STAGES as readonly string[]).includes(stageArg)) {
    throw usageError(stageArg ? `"${stageArg}" is not a rebrand stage. ${USAGE_LINE}` : USAGE_LINE, 'MISSING_ARGUMENT');
  }
  const stage = stageArg as RebrandStage;
  checkFlags(stage, flags);

  if (stage === 'presets') {
    if (inputs.length > 0) throw usageError('lolly rebrand presets takes no inputs; it lists the presets that resolve here.', 'CONFLICTING_FLAGS');
    return presetsCli(asJson);
  }
  if (inputs.length === 0) throw usageError(`lolly rebrand ${stage} needs at least one input. ${USAGE_LINE}`, 'MISSING_ARGUMENT');

  if (stage === 'inspect') {
    if (inputs.length > 1) throw usageError('lolly rebrand inspect takes one plan or deck at a time.', 'CONFLICTING_FLAGS');
    return inspectCli(inputs[0]!, flags, asJson);
  }

  const outcome = await runRebrand(stage, inputs, flags, {
    onProgress: (progress) => {
      if (!asJson && progress.total > 1) note(progressLine(progress));
    },
  });
  await report(outcome, asJson);
  return outcome.exit;
}
