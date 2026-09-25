// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation controller (plan 274 sections 2.1, 3.5 and 4): the one owner of an
 * open renovation project in the web shell. `controller-api.ts` is the contract and
 * states the three rules this file keeps; this header says how.
 *
 * 1. **Every edit is one transaction.** An edit runs the pure function from the
 *    engine's `rebrand-edit.ts` over the plan in hand, captures the rows it touched
 *    from the plan before and after, and writes the edited plan once through
 *    `commitPlan` in `lifecycle.ts`. Undo writes the captured rows back through the
 *    same path, as its own transaction. Edits, undo, redo, Shuffle, Open in Design
 *    and a reload run one after another through a single queue, so two clicks never
 *    race each other to the store. A refused write leaves the plan, the history and
 *    the preview as they were; only the save state says why.
 * 2. **The Proposed pane shows what the person will get.** The preview compiles with
 *    every proposal applied, flagged ones included (`applyUnreviewed` and
 *    `applyNeedsAttention` on). Open in Design is refused while the engine's
 *    `openPendingIds` names a row (no decision, review unreviewed or needs attention,
 *    not locked, on an included slide), and while the preview in hand is not the one
 *    for the current plan (still updating, or failed), and then compiles with both
 *    flags off, so the two agree. Accept all suggestions is the engine's
 *    `acceptSuggestions` with `scope: 'all'` and `includedOnly`, so it answers exactly
 *    those rows as proposed, in one undoable transaction. A slide left out is not
 *    compiled, so its rows neither hold Open in Design back nor get answered.
 * 3. **Background work never overwrites a person.** Every preview compile is tagged
 *    with the plan revision it read. A result older than the preview already held is
 *    dropped, and every long run carries a session number, so a result for a project
 *    that was closed or replaced is dropped.
 *
 * Four journeys beyond the first read (the contract's header lists them): a second Open
 * in Design opens a new document named with its revision and records what changed
 * against the compile before it (`compile-diff.ts`); a newer version of the deck is read
 * into the same lineage with the open plan as `previous`; a preset reruns the first pass
 * as one undoable step whose undo restores the whole plan; several decks are read one
 * after another under one job, the first opening for review while the rest are read
 * into their own projects in the background.
 *
 * The stages run through `deps.runStage` (the shell's worker) and the long ones sit
 * under one job on the job toast, so leaving `#/rebrand` does not stop them. No job is
 * ever started inside another: `runJob` claims the one heavy slot, and a job that
 * waited for a slot its parent holds would wait for good. The
 * faithful deck and the preview are recomputed on every open, never stored: they are
 * disposable. `rebrandControllerFor` keeps one controller per key for the life of
 * the page, which is what lets a person leave the view and come back to the same
 * project and the same running stage.
 *
 * No DOM, no clock of its own (timers only for coalescing a preview), no storage
 * other than the injected store.
 */
import {
  acceptSuggestions as acceptSuggestionRows,
  autoMatchLayouts as autoMatchLayoutRows,
  capturePlanRows,
  captureThemeRows,
  decideObjects,
  framePreviewSvg,
  moveSlide,
  openPendingIds,
  resolveRebrandDesignSystem,
  restoreThemeRows,
  setColorTarget,
  setFontTarget,
  setSlidesArrangement,
  setDeckTheme,
  setSlideGround,
  setSlidesIncluded,
  setSlidesLayout,
  type AutoMatchBandsV1,
  type DeckLookV1,
  type PlanEditResultV1,
  type PlanRowsSnapshotV1,
  type PlanRowsTouchedV1,
  type RenovationPresetV1,
  type ThemeSolveContextV1,
} from '@lolly/engine';
import {
  PROJECT_STAGES,
  PROJECT_THUMB_SVG_MAX,
  REBRAND_ERROR_CODES,
  type ColorMappingV1,
  type CompiledDeckV1,
  type DeckCensusV1,
  type DeckThemeV1,
  type ProjectStageV1,
  type RenovationPlanV1,
  type RenovationProjectV1,
  type SlideArrangementV1,
  type SlideGroundV1,
  type SourceDeckV1,
} from '@lolly-tools/core/rebrand-v1';
// Plan 275's plan edits. They are not on the engine barrel yet (one package edits
// engine/src/index.ts in this phase), so they come from their module directly, the way
// brand-vars.ts reaches engine modules the barrel does not carry.
import { moveSlides as moveSlideBlock, resetSlideDecisions, setObjectText as setObjectTextRow } from '../../../../../engine/src/rebrand-edit.ts';
import { glyphRunsOf } from '../../../../../engine/src/svg-items.ts';
import { tRaw } from '../../i18n.ts';
import type {
  CensusStageInputV1,
  CompileStageInputV1,
  FaithfulStageInputV1,
  KeepDesignResultV1,
  PlanStageInputV1,
  RebrandBatchRowV1,
  RebrandIngestResultV1,
  RebrandPackPartsV1,
  RebrandControllerDepsV1,
  RebrandControllerV1,
  RebrandDecideInputV1,
  RebrandDesignSystemInfoV1,
  RebrandDownloadV1,
  RebrandEditOutcomeV1,
  RebrandErrorV1,
  RebrandHistoryLabelV1,
  RebrandHistoryV1,
  RebrandModeV1,
  RebrandOpenOutcomeV1,
  RebrandPresetSaveOutcomeV1,
  RebrandPresetSummaryV1,
  RebrandProgressV1,
  RebrandProjectSummaryV1,
  RebrandResolvedSystemV1,
  RebrandSaveStateV1,
  RebrandSlidePictureDepsV1,
  RebrandStateV1,
  RebrandStepV1,
  RebrandVectorLabelCountsV1,
  RebrandVectorLabelReadV1,
  RebrandVectorLabelsV1,
} from './controller-api.ts';
import { compileDiff, type CompileDiffV1 } from './compile-diff.ts';
import { Deflate } from 'fflate';
import { MAX_REVISION_EXPANDED, MAX_REVISION_SNAPSHOT } from '../../bridge/revision-limits.ts';
import { compiledDeckToFrames, exceedsDesignHistory, openCompiledDeckInDesign } from './design-handoff.ts';
import { advance, commitPlan, markStageComplete, openProject, resumePoint, type StagePartValueV1 } from './lifecycle.ts';
import { personalPresetId, presetFromPlan } from './presets.ts';
import { ProjectQuotaError } from './project-store.ts';
import { slidePictureIdsOf, recoveryRefs, splicePreviewDeck, mostlyPictures, previewPlanOf, carryPersonRows, carryIntoNewerVersion, keepLineageFacts, nearestSystemColour } from './controller-preview.ts';
export { slidePictureIdsOf, recoveryRefs, splicePreviewDeck, mostlyPictures, previewPlanOf, carryPersonRows, carryIntoNewerVersion, keepLineageFacts, CARRIED_ITEM_ID, ANOTHER_LOOK_ITEM_ID, lineageQueueItems, queueWithLineage, nearestSystemColour } from './controller-preview.ts';

/**
 * The rows Open in Design waits on, from the engine: no decision, review unreviewed
 * or needs attention, not locked, on an included slide. The view's footer and the
 * queue read it through this module.
 */
export { openPendingIds };

/** Where it was declared first; the contract now lives in `controller-api.ts`. */
export type { RebrandSlidePictureDepsV1 } from './controller-api.ts';

/** The wait between an edit and the preview compile it asks for, so a burst of edits compiles once. */
export const PREVIEW_DELAY_MS = 150;

/** How often a picture URL is asked for before the picture is left blank for the session. */
const MEDIA_TRIES = 3;

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/**
 * One undo step: the rows an edit touched, as they were and as the edit left them; or,
 * for a preset, the whole plan before and after, since a first pass rewrites every row
 * and the plan's own preset and logo fields.
 */
type HistoryStepV1 =
  | { label: RebrandHistoryLabelV1; before: PlanRowsSnapshotV1; after: PlanRowsSnapshotV1 }
  | { label: RebrandHistoryLabelV1; whole: { before: RenovationPlanV1; after: RenovationPlanV1 } };

/** What a stage run carries while it works: the project handle and the save state it last saw. */
interface RunCtxV1 {
  session: number;
  signal: AbortSignal;
  project: RenovationProjectV1;
  source: SourceDeckV1;
  census: DeckCensusV1 | null;
  plan: RenovationPlanV1 | null;
  /** The plan stored for this project before a re-run, carried as `previous`. */
  previous: RenovationPlanV1 | null;
  /** The preset the first pass applies, when one was chosen. */
  preset?: RenovationPresetV1;
  save: RebrandSaveStateV1;
}

/** What a read starts from, beyond the file. */
interface ReadOptsV1 {
  /** The lineage a newer version joins. */
  lineageId?: string;
  /** The plan whose decisions carry forward where the object matched. */
  previous?: RenovationPlanV1;
  preset?: RenovationPresetV1;
  /** A preset named by id, looked up once the read is under way, when `preset` is not given. */
  presetId?: string | null;
}


/**
 * Whether the document this deck opens as is still larger than Design's automatic
 * history keeps (close-out decision 10), measured the way Design admits a checkpoint
 * since its snapshots are stored compressed: the pages' JSON deflated, against
 * `MAX_REVISION_SNAPSHOT`, and the JSON itself against `MAX_REVISION_EXPANDED`. Pages
 * whose JSON already fits the budget are not compressed to find out. An estimate that
 * errs large, as `exceedsDesignHistory` says of the pages.
 */
export async function overDesignHistory(deck: CompiledDeckV1): Promise<boolean> {
  if (!exceedsDesignHistory(deck, MAX_REVISION_SNAPSHOT)) return false;
  const encoder = new TextEncoder();
  const pages = compiledDeckToFrames(deck).map((frame) => encoder.encode(JSON.stringify(frame)));
  let bytes = 0;
  for (const page of pages) bytes += page.byteLength;
  if (bytes > MAX_REVISION_EXPANDED) return true;
  return (await deflatedLength(pages)) > MAX_REVISION_SNAPSHOT;
}

/** The raw deflate length of these bytes in a row, streamed so the output is never held. */
async function deflatedLength(parts: Uint8Array<ArrayBuffer>[]): Promise<number> {
  if (typeof CompressionStream === 'function' && typeof Blob === 'function') {
    try {
      const reader = new Blob(parts).stream().pipeThrough(new CompressionStream('deflate-raw')).getReader();
      let length = 0;
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) length += chunk.value.byteLength;
      return length;
    } catch {
      // A shell without deflate-raw measures with fflate below.
    }
  }
  let length = 0;
  const deflate = new Deflate({ level: 6 }, (chunk) => {
    length += chunk.byteLength;
  });
  if (parts.length === 0) deflate.push(new Uint8Array(0), true);
  parts.forEach((part, i) => {
    deflate.push(part, i === parts.length - 1);
  });
  return length;
}

/** Label runs still drawn per read deck, counted once: the count walks every drawing's paths. */
const drawnLabels = new WeakMap<SourceDeckV1, number>();

/**
 * The chart labels a read deck still holds as glyph outlines (close-out 9.3): the runs
 * `glyphRunsOf` finds in each drawing that stays editable, the same rule the reader
 * counts by. Counted once per deck object; `seedDrawnLabels` records a count the read
 * already made.
 */
export function drawnLabelCount(source: SourceDeckV1): number {
  const known = drawnLabels.get(source);
  if (known !== undefined) return known;
  let runs = 0;
  for (const slide of source.slides) {
    for (const object of slide.objects) {
      if (object.kind === 'vector' && object.vectorItems) runs += glyphRunsOf(object.vectorItems).length;
    }
  }
  drawnLabels.set(source, runs);
  return runs;
}

/** Record the drawn labels a read counted for this deck, so they are not counted again. */
function seedDrawnLabels(source: SourceDeckV1, drawn: number): void {
  if (Number.isFinite(drawn) && drawn >= 0) drawnLabels.set(source, drawn);
}

/**
 * The open deck's outlined labels as the state carries them: what is still drawn and,
 * after a reading in this tab, what it wrote as text. Undefined when there are none.
 */
function vectorLabelsOf(source: SourceDeckV1, counts?: RebrandVectorLabelCountsV1): RebrandVectorLabelsV1 | undefined {
  if (counts) seedDrawnLabels(source, counts.drawn);
  const drawn = drawnLabelCount(source);
  const text = counts?.text ?? 0;
  if (drawn === 0 && text === 0) return undefined;
  return { drawn, ...(text > 0 ? { text } : {}), read: counts?.read === true };
}


/**
 * What tells two reads of one deck apart: the bytes and the import, the reader (a
 * rebuild marks its version) and which slides were rebuilt from which picture.
 */
function sourceIdentityOf(source: SourceDeckV1): string {
  return JSON.stringify([
    source.source.hash,
    source.source.instanceId,
    source.reader.name,
    source.reader.version,
    source.slides.map((slide) => [slide.id, slide.recovery?.assetRef ?? null, slide.objects.length]),
  ]);
}

/** What one checkpointed write left: a save, or a full device. */
type AdvanceOnceV1 = { kind: 'saved'; project: RenovationProjectV1 } | { kind: 'held' };

/** Newest first, by the last write, else the creation. */
function newestFirst(projects: RenovationProjectV1[]): RenovationProjectV1[] {
  const when = (project: RenovationProjectV1): string => project.updatedAt ?? project.createdAt ?? '';
  return [...projects].sort((a, b) => (when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : 0));
}

/** A stage stopped for a reason the view can name. */
class StepFailure extends Error {
  readonly code: RebrandErrorV1['code'];
  constructor(code: RebrandErrorV1['code'], message: string) {
    super(message);
    this.name = 'StepFailure';
    this.code = code;
  }
}

/**
 * Why Keep the design stopped, as a code the view has copy for. The contract's
 * `KeepDesignStateV1.error` carries one of these, never an English sentence.
 */
export const KEEP_FAILURE_CODES = [
  'keep.no-patcher',
  'keep.no-source',
  'keep.no-system',
  'keep.not-a-deck',
  'keep.failed',
] as const;
export type KeepFailureCodeV1 = (typeof KEEP_FAILURE_CODES)[number];

/** Keep the design stopped for a reason the view names by its code. */
class KeepFailure extends Error {
  readonly code: KeepFailureCodeV1;
  constructor(code: KeepFailureCodeV1, message: string) {
    super(message);
    this.name = 'KeepFailure';
    this.code = code;
  }
}

/** The keep failure code for a caught value. `keep-design.ts` names its refusals by code too. */
function keepFailureOf(err: unknown): KeepFailureCodeV1 {
  if (err instanceof KeepFailure) return err.code;
  if (typeof err === 'object' && err !== null && 'code' in err) {
    if (err.code === 'pptx-unavailable') return 'keep.no-patcher';
    if (err.code === 'not-a-deck') return 'keep.not-a-deck';
  }
  return 'keep.failed';
}

const ERROR_CODES: readonly RebrandErrorV1['code'][] = [
  ...REBRAND_ERROR_CODES,
  'cancelled',
  'unsupported-file',
  'no-design-system',
  'stage-failed',
];

/** The error code a caught value names, when it names one the view has copy for. */
function errorCodeOf(err: unknown): RebrandErrorV1['code'] | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const { code } = err;
  return ERROR_CODES.find((known) => known === code);
}

function abortError(): Error {
  const err = new Error('The stage was cancelled.');
  err.name = 'AbortError';
  return err;
}

function isAbortLike(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('name' in err)) return false;
  return err.name === 'AbortError' || err.name === 'StageCancelledError';
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

/** The failure a caught value stands for, named by code so the view picks its own copy. */
function errorOf(err: unknown, step: RebrandStepV1, signal?: AbortSignal): RebrandErrorV1 {
  if (signal?.aborted || isAbortLike(err)) return { code: 'cancelled', message: 'The stage was cancelled.', step };
  if (err instanceof ProjectQuotaError) return { code: 'storage.quota', message: err.message, step };
  if (err instanceof StepFailure) return { code: err.code, message: err.message, step };
  const code = errorCodeOf(err);
  if (code) return { code, message: messageOf(err), step };
  return { code: 'stage-failed', message: messageOf(err), step };
}

/** Key order and undefined fields do not make two records different. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).filter((key) => rec[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(rec[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const sameValue = (a: unknown, b: unknown): boolean => stableJson(a) === stableJson(b);

/** A saved look as the design-system input carries it (`RebrandThemeFactsV1`). */
function isDeckLook(value: unknown): value is DeckLookV1 {
  return value !== null && typeof value === 'object'
    && 'id' in value && typeof value.id === 'string'
    && 'name' in value && typeof value.name === 'string'
    && 'colors' in value && value.colors !== null && typeof value.colors === 'object';
}

const stageAt = (stage: ProjectStageV1): number => PROJECT_STAGES.indexOf(stage);

function hasStoredPart(project: RenovationProjectV1, kind: keyof RenovationProjectV1['parts']): boolean {
  const at = project.parts[kind];
  return typeof at === 'string' && at.length > 0;
}

function committed(project: RenovationProjectV1): boolean {
  return typeof project.checkpoint.at === 'string' && project.checkpoint.at.length > 0;
}

/** The file name without its extension, for a download named after the source. */
function stemOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return stem.trim() || 'deck';
}

/**
 * "Reading slide 4 of 15": the slide in hand, one past those read, never past the last
 * and never "slide 0". The intake's progress line and the job toast say the same.
 */
export function readingSentence(done: number, total: number): string {
  const n = Math.max(1, Math.min(total, Math.floor(done) + 1));
  return tRaw('Reading slide {done} of {total}', { done: n, total });
}

/** The long edge a project's thumbnail is drawn at, in px (close-out section 3.2). */
export const PROJECT_THUMB_EDGE = 192;

/** The design system's own faces, brand first, as the proposed drawings name them. */
function facesOf(resolved: RebrandResolvedSystemV1): string[] {
  const { brand, mono } = resolved.input.fonts ?? {};
  return [...new Set([brand, mono].filter((face): face is string => typeof face === 'string' && face.trim() !== ''))];
}

/** The design system as the view reads it, with its two faces named (close-out 9.2). */
function infoWithFaces(resolved: RebrandResolvedSystemV1): RebrandDesignSystemInfoV1 {
  const { brand, mono } = resolved.input.fonts ?? {};
  const faces = { ...(brand ? { brand } : {}), ...(mono ? { mono } : {}) };
  return Object.keys(faces).length > 0 ? { ...resolved.info, faces } : resolved.info;
}

/**
 * The first frame of a proposed deck drawn for a project list, or null when there is
 * none or it is over `PROJECT_THUMB_SVG_MAX` bytes. Drawn at `PROJECT_THUMB_EDGE` with
 * the thumbnail detail in the design system's faces; every picture is left to the
 * drawing's flat box, since a drawable URL ends with the tab.
 */
export function projectThumbnail(deck: CompiledDeckV1, resolved: RebrandResolvedSystemV1): string | null {
  const frame = deck.frames.find((one) => one.width > 0 && one.height > 0);
  if (!frame) return null;
  const { brand, mono } = resolved.input.fonts ?? {};
  const fonts = { ...(brand ? { brand } : {}), ...(mono ? { mono } : {}) };
  const svg = framePreviewSvg(frame, {
    assetHref: () => undefined,
    ...(brand || mono ? { fonts } : {}),
    detail: 'thumbnail',
    longEdge: PROJECT_THUMB_EDGE,
  });
  const long = Math.max(frame.width, frame.height, 1);
  const w = Math.max(1, Math.round((frame.width * PROJECT_THUMB_EDGE) / long));
  const h = Math.max(1, Math.round((frame.height * PROJECT_THUMB_EDGE) / long));
  const sized = svg.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${w}" height="${h}"`);
  return new TextEncoder().encode(sized).byteLength <= PROJECT_THUMB_SVG_MAX ? sized : null;
}

function initialState(mode: RebrandModeV1 = 'renovate'): RebrandStateV1 {
  return {
    phase: 'idle',
    mode,
    progress: null,
    error: null,
    project: null,
    source: null,
    census: null,
    plan: null,
    faithful: null,
    preview: null,
    previewStale: false,
    designSystem: null,
    save: { kind: 'none' },
    history: { canUndo: false, canRedo: false },
    keep: { status: 'idle' },
    readiness: [],
    // Named so a new project's state clears them: a compile diff and the versions list
    // belong to the project they were read for, never to the next one.
    compileDiff: undefined,
    versions: undefined,
    vectorLabels: undefined,
    tick: 0,
  };
}

/** Every image row in a deck's frames, by the asset ref it draws. */
function imageRefs(deck: CompiledDeckV1 | null | undefined): string[] {
  const out: string[] = [];
  for (const frame of deck?.frames ?? []) {
    for (const row of frame.layers) {
      if (row.kind !== 'image') continue;
      const ref = row.image;
      if (typeof ref === 'string' && ref.length > 0) out.push(ref);
    }
  }
  return out;
}

/** A project whose read never finished: no source deck and no stage marked. Nothing can open it. */
function unfinishedRead(project: RenovationProjectV1): boolean {
  return project.checkpoint.stage === 'ingest' && !committed(project) && !hasStoredPart(project, 'sourceDeck');
}

type EditRefusalV1 = NonNullable<RebrandEditOutcomeV1['refusal']>;

/** The plan, project and source an edit works on, or why there is none to edit. */
type EditReadyV1 =
  | { ok: true; plan: RenovationPlanV1; project: RenovationProjectV1; source: SourceDeckV1 }
  | { ok: false; refusal: EditRefusalV1 };

const refused = (refusal: EditRefusalV1, skipped = 0): RebrandEditOutcomeV1 => ({ ok: false, touched: 0, skipped, refusal });

/** What one plan write left behind: the state to show, and whether the edit stands. */
type PlanWriteV1 =
  | { ok: true; patch: Partial<RebrandStateV1> }
  | { ok: false; refusal: EditRefusalV1; patch: Partial<RebrandStateV1> };

/** A reading of the deck in hand that gives a new deck (`rereadDeck` in the controller). */
interface RereadV1 {
  /** The job toast's title. */
  title: string;
  /** What the reading counts up to, for the first progress. */
  total: number;
  /** The toast's line for the reading so far. */
  note: (done: number, total: number) => string;
  /** The state's progress while reading, or null to leave it to the toast. */
  progress: (done: number, total: number) => RebrandProgressV1 | null;
  read(source: SourceDeckV1, signal: AbortSignal, onProgress: (done: number, total: number) => void): Promise<RereadResultV1>;
}

interface RereadResultV1 {
  source: SourceDeckV1;
  /** What the reading changed (slides rebuilt, labels written as text). Zero keeps the deck in hand. */
  touched: number;
  /** What it left as it was. */
  kept: number;
  /** State the reading settles, applied with the new deck, or on its own when nothing changed. */
  patch?: Partial<RebrandStateV1>;
}

/** One edit: the pure function, the rows to capture for undo, and the undo label. */
interface EditSpecV1 {
  run: (plan: RenovationPlanV1, source: SourceDeckV1) => PlanEditResultV1;
  rows: (result: PlanEditResultV1, source: SourceDeckV1) => PlanRowsTouchedV1;
  label: (result: PlanEditResultV1) => RebrandHistoryLabelV1;
  /** Slides whose preview is compiled alone first, before the whole deck, so the pane shows them at once. */
  quick?: (result: PlanEditResultV1) => string[];
}

export function createRebrandController(deps: RebrandControllerDepsV1): RebrandControllerV1 {
  const { store } = deps;
  const previewDelay = Math.max(0, deps.previewDelayMs ?? PREVIEW_DELAY_MS);

  let state: RebrandStateV1 = initialState();
  const listeners = new Set<(next: RebrandStateV1) => void>();
  /** Bumped whenever the open project changes; a late result for an older session is dropped. */
  let session = 0;
  let disposed = false;
  /** The running stage, which `cancel` aborts. */
  let run: AbortController | null = null;
  /** True while `rebuildPictures` runs: every edit is refused as busy meanwhile. */
  let readingPictures = false;
  let keepRun: AbortController | null = null;
  let system: RebrandResolvedSystemV1 | null = null;
  /** False when storage refused the project's first write, so it lives in memory only. */
  let stored = true;
  let undoSteps: HistoryStepV1[] = [];
  let redoSteps: HistoryStepV1[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  /** The one preview compile in flight. A request while it runs waits for it and runs once after. */
  let previewRun: AbortController | null = null;
  let previewAgain = false;
  /** The one compile of a few slides alone, run ahead of the whole deck after a layout change. */
  let quickRun: AbortController | null = null;
  /**
   * Bumped whenever the plan is loaded again from the store. A preview is ordered by
   * revision only within one load: a reload can put a lower revision in place, and a
   * preview from before it describes edits that are gone.
   */
  let loadEpoch = 0;
  /** The load the held preview was compiled in. */
  let heldEpoch = 0;
  /** Asset ref to drawable URL. Null while the URL is on its way. */
  const media = new Map<string, string | null>();
  /** How often each picture URL was asked for, so a failed one is asked again, a few times. */
  const mediaTries = new Map<string, number>();
  let keepBytes: Uint8Array | null = null;
  /** The last deck compiled for Design, for a `.lolly` download while the store holds none. */
  let lastCompiled: CompiledDeckV1 | null = null;
  /**
   * The last compile that really opened in Design, the baseline "Changed since the last
   * opening" compares against. A compile whose handoff failed never becomes it.
   */
  let lastOpened: CompiledDeckV1 | null = null;
  /**
   * False once a compile was stored and its handoff has not finished: the stored compiled
   * part then describes a document that never opened, so it is no baseline.
   */
  let storedCompiledOpened = true;
  /**
   * Design documents opened per project in this tab, for the revision in a document's
   * name when the store could not record the session.
   */
  const openedHere = new Map<string, number>();
  /**
   * The content of the preset the open plan's first pass ran with, when this tab knows
   * it, so applying the same preset again after it was saved anew runs it again rather
   * than answering that it is already applied.
   */
  let appliedPresetKey: string | null = null;
  /**
   * A multi-file read. It outlives the session of the deck that opened first, so closing
   * that deck does not stop the others; `cancelBatch`, the job toast's own cancel and
   * `dispose` do.
   */
  let batchRun: AbortController | null = null;
  /** The preset the next read applies, as the intake chose it. */
  let nextPreset: string | null = null;
  /** The view's answer to "is the reading on screen": while true, a read job shows no toast. */
  let quietFn: (() => boolean) | null = null;
  /** The design-system faces this tab already loaded, so a second read does not wait for them again. */
  const facesLoaded = new Set<string>();

  /** True while the view shows the reading itself, so the read job keeps its toast off. A view that throws reads as not quiet. */
  const quietWhile = (): boolean => {
    try {
      return quietFn?.() === true;
    } catch {
      return false;
    }
  };

  /** Put the finished read job's dismiss on the state, for the view to take its toast down. */
  function offerDismiss(at: number, dismiss: (() => void) | undefined): void {
    if (!dismiss || !live(at)) return;
    emit({ finishedJob: { dismiss } });
  }

  // ─── state ─────────────────────────────────────────────────────────────────

  function emit(patch: Partial<RebrandStateV1>): void {
    if (disposed) return;
    state = { ...state, ...patch, tick: state.tick + 1 };
    const current = state;
    for (const listener of [...listeners]) {
      try {
        listener(current);
      } catch {
        /* a listener that throws must not keep the others from hearing */
      }
    }
  }

  const live = (at: number): boolean => at === session && !disposed;

  function emitFor(at: number, patch: Partial<RebrandStateV1>): void {
    if (live(at)) emit(patch);
  }

  function historyState(): RebrandHistoryV1 {
    const undo = undoSteps[undoSteps.length - 1];
    const redo = redoSteps[redoSteps.length - 1];
    return {
      canUndo: Boolean(undo),
      canRedo: Boolean(redo),
      ...(undo ? { undo: undo.label } : {}),
      ...(redo ? { redo: redo.label } : {}),
    };
  }

  /** One after another: a write never starts before the one before it settled. */
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  }

  function releaseMedia(): void {
    for (const url of media.values()) if (url) deps.releaseMediaUrl(url);
    media.clear();
  }

  /**
   * Stop everything the open project owns and start a new session. Emits nothing:
   * the caller sends the state that replaces it in one notification.
   */
  function begin(): number {
    session += 1;
    run?.abort();
    run = null;
    keepRun?.abort();
    keepRun = null;
    previewRun?.abort();
    previewRun = null;
    previewAgain = false;
    quickRun?.abort();
    quickRun = null;
    if (previewTimer !== null) clearTimeout(previewTimer);
    previewTimer = null;
    releaseMedia();
    mediaTries.clear();
    system = null;
    stored = true;
    undoSteps = [];
    redoSteps = [];
    keepBytes = null;
    lastCompiled = null;
    lastOpened = null;
    storedCompiledOpened = true;
    appliedPresetKey = null;
    heldEpoch = loadEpoch;
    return session;
  }

  // ─── media ─────────────────────────────────────────────────────────────────

  /**
   * Ask for a drawable URL for every picture these decks draw, and for `extra` refs
   * (the untouched pictures of rebuilt slides), once each.
   */
  function collectMedia(decks: Array<CompiledDeckV1 | null | undefined>, extra: readonly string[] = []): void {
    const at = session;
    const pending: Array<Promise<boolean>> = [];
    const refs = [...decks.flatMap((deck) => imageRefs(deck)), ...extra];
    for (const ref of refs) {
      if (media.has(ref)) continue;
      const tries = mediaTries.get(ref) ?? 0;
      if (tries >= MEDIA_TRIES) continue;
      mediaTries.set(ref, tries + 1);
      media.set(ref, null);
      // A request that failed or came back empty is forgotten, so the next deck
      // that draws the picture asks again.
      const forget = (): void => {
        if (live(at) && media.get(ref) === null) media.delete(ref);
      };
      pending.push(deps.mediaUrl(ref).then(
        (url) => {
          if (!live(at) || media.get(ref) !== null) {
            if (url) deps.releaseMediaUrl(url);
            return false;
          }
          if (!url) {
            forget();
            return false;
          }
          media.set(ref, url);
          return true;
        },
        () => {
          forget();
          return false;
        },
      ));
    }
    if (pending.length === 0) return;
    void Promise.all(pending).then((landed) => {
      if (landed.some(Boolean)) emitFor(at, {});
    });
  }

  // ─── the preview ───────────────────────────────────────────────────────────

  /**
   * Take a preview compiled from `revision` in load `epoch`, unless a newer one from
   * the same load is already held. A result for a revision that is no longer current
   * still replaces an older one, so the pane moves toward the plan rather than waiting
   * on the last compile. A result from before a reload is dropped, and a preview from
   * before a reload gives way to the first result after it. A preview that arrives clears a
   * failed preview's error, since the pane is current again.
   */
  function offerPreview(at: number, deck: CompiledDeckV1, revision: number, epoch: number): void {
    if (!live(at) || epoch !== loadEpoch) return;
    const held = state.preview;
    if (held && heldEpoch === epoch && held.planRevision > revision) return;
    heldEpoch = epoch;
    emit({
      preview: { deck, planRevision: revision },
      previewStale: revision !== state.plan?.revision,
      ...(state.error?.step === 'preview' ? { error: null } : {}),
    });
    collectMedia([deck]);
  }

  /** The preview's compile: every proposal applied, flagged ones included. */
  function compileInput(plan: RenovationPlanV1): CompileStageInputV1 | null {
    const { source, census } = state;
    if (!source || !system) return null;
    return { source, ...(census ? { census } : {}), plan, system: system.input, applyUnreviewed: true, applyNeedsAttention: true };
  }

  /**
   * Compile the preview for the plan in hand. One compile runs at a time: a request
   * while one runs is remembered and runs once, for the plan current then, after it
   * finishes. So a stream of edits never queues a compile per revision behind the one
   * heavy slot, and the pane still reaches the latest plan.
   */
  async function compilePreview(at: number): Promise<void> {
    if (!live(at)) return;
    if (previewRun) {
      previewAgain = true;
      return;
    }
    const { plan, project } = state;
    if (!plan || !project) return;
    const input = compileInput(previewPlanOf(plan));
    if (!input) return;
    const epoch = loadEpoch;
    const ac = new AbortController();
    previewRun = ac;
    try {
      const deck = await deps.runStage<CompileStageInputV1, CompiledDeckV1>(
        'rebrand.compile',
        input,
        { projectId: project.id, planRevision: plan.revision },
        ac.signal,
      );
      offerPreview(at, deck, plan.revision, epoch);
    } catch (err) {
      // The pane keeps the last preview and says it is updating; a compile that
      // failed for its own reason is named, a superseded or cancelled one is not.
      if (!ac.signal.aborted && !isAbortLike(err) && live(at) && state.plan?.revision === plan.revision) {
        emit({ error: { code: 'stage-failed', message: messageOf(err), step: 'preview' } });
      }
    } finally {
      if (previewRun === ac) {
        previewRun = null;
        if (previewAgain) {
          previewAgain = false;
          void compilePreview(at);
        }
      }
    }
  }

  /** True when the preview in hand is for this plan and nothing about it failed. */
  function previewCurrent(plan: RenovationPlanV1): boolean {
    return state.error?.step !== 'preview' && !state.previewStale && state.preview?.planRevision === plan.revision;
  }

  function schedulePreview(): void {
    if (previewTimer !== null) clearTimeout(previewTimer);
    const at = session;
    previewTimer = setTimeout(() => {
      previewTimer = null;
      void compilePreview(at);
    }, previewDelay);
  }

  /**
   * Compile these slides alone for the plan in hand and splice their frames into the
   * held preview, so a new layout shows at once (plan 275 decision 31). It is asked
   * for before the whole-deck compile, so it runs first on the one heavy slot. The
   * pane still says Updating (`previewStale` stays true) and Open in Design still
   * waits for the whole deck. A result that arrives after the whole deck, or for a
   * plan that moved on, is dropped.
   */
  async function quickPreview(at: number, slideIds: readonly string[]): Promise<void> {
    const { plan, project, source } = state;
    if (!live(at) || !plan || !project || !source || slideIds.length === 0 || !state.preview) return;
    const ids = new Set(slideIds);
    const whole = previewPlanOf(plan);
    const input = compileInput({ ...whole, slides: whole.slides.filter((slide) => ids.has(slide.id)) });
    if (!input) return;
    const epoch = loadEpoch;
    quickRun?.abort();
    const ac = new AbortController();
    quickRun = ac;
    try {
      const deck = await deps.runStage<CompileStageInputV1, CompiledDeckV1>(
        'rebrand.compile',
        input,
        { projectId: project.id, planRevision: plan.revision },
        ac.signal,
      );
      const held = state.preview;
      if (!live(at) || ac.signal.aborted || epoch !== loadEpoch || state.plan?.revision !== plan.revision) return;
      if (!held || held.planRevision >= plan.revision) return;
      const objects = new Set(source.slides.filter((slide) => ids.has(slide.id)).flatMap((slide) => slide.objects.map((object) => object.id)));
      const pageNumbers = new Set((system?.input.master.furniture ?? []).filter((one) => one.kind === 'page-number').map((one) => one.id));
      const spliced = splicePreviewDeck(held.deck, deck, ids, objects, plan.revision, pageNumbers);
      emit({ preview: { deck: spliced, planRevision: plan.revision }, previewStale: true });
      collectMedia([spliced]);
    } catch {
      // The whole-deck compile that follows draws these slides too.
    } finally {
      if (quickRun === ac) quickRun = null;
    }
  }

  // ─── stages ────────────────────────────────────────────────────────────────

  function stage<I, O>(name: Parameters<RebrandControllerDepsV1['runStage']>[0], input: I, ctx: RunCtxV1, planRevision?: number): Promise<O> {
    return deps.runStage<I, O>(
      name,
      input,
      planRevision === undefined ? { projectId: ctx.project.id } : { projectId: ctx.project.id, planRevision },
      ctx.signal,
    );
  }

  /**
   * Write one stage's part and its checkpoint through `advance`, so a reload resumes
   * after it. A quota refusal keeps going in memory and says so; a stale handle stops.
   *
   * After a quota refusal the checkpoint did not move, so the next stage recorded
   * against it would be refused as out of order, and a later plan write would mark the
   * review over a part that is not stored. The rest of this project's session stays
   * in memory instead: nothing more is written, and the `.lolly` download carries the
   * parts held here.
   */
  async function record(ctx: RunCtxV1, at: ProjectStageV1, value: StagePartValueV1, algorithm: string): Promise<void> {
    if (!stored) return;
    let res: AdvanceOnceV1;
    try {
      res = await advanceOnce(ctx.project, at, value, algorithm, ctx.signal);
    } catch (err) {
      if (err instanceof StepFailure && err.code === 'plan.revision-stale') ctx.save = { kind: 'stale' };
      throw err;
    }
    if (res.kind === 'held') {
      stored = false;
      ctx.save = { kind: 'held', reason: 'quota' };
      return;
    }
    ctx.project = res.project;
    ctx.save = { kind: 'saved', revision: res.project.revision };
  }

  /**
   * One part and its checkpoint through `advance`, with the retry for a checkpoint that
   * was refused after the part was written. `held` is a full device; every other
   * outcome that is not a save throws, named.
   */
  async function advanceOnce(
    project: RenovationProjectV1,
    at: ProjectStageV1,
    value: StagePartValueV1,
    algorithm: string,
    signal: AbortSignal,
  ): Promise<AdvanceOnceV1> {
    const res = await advance(
      store,
      project,
      at,
      async (p, asked) => ({ projectId: p.id, stage: asked, algorithmVersion: algorithm, result: value }),
      { signal },
    );
    switch (res.outcome) {
      case 'advanced':
        return { kind: 'saved', project: res.project };
      case 'uncheckpointed': {
        const again = await markStageComplete(store, res.project, at, res.planRevision);
        if (again.outcome !== 'advanced') throw new StepFailure('stage-failed', again.outcome === 'uncheckpointed' ? again.message : res.message);
        return { kind: 'saved', project: again.project };
      }
      case 'held':
        return { kind: 'held' };
      case 'cancelled':
        throw abortError();
      case 'reload':
        throw new StepFailure('plan.revision-stale', res.message);
      default:
        throw new StepFailure('stage-failed', res.message);
    }
  }

  /**
   * Census, design system, plan, the faithful deck, the first preview and readiness,
   * starting at `from`. A stage before `from` runs only when its record is missing.
   */
  async function analyse(ctx: RunCtxV1, from: ProjectStageV1 | null, onStep: (step: RebrandStepV1) => void): Promise<void> {
    const runs = (name: ProjectStageV1): boolean => from !== null && stageAt(from) <= stageAt(name);
    const at = ctx.session;
    const step = (next: RebrandStepV1): void => {
      onStep(next);
      emitFor(at, { progress: { step: next } });
    };
    const checkAbort = (): void => {
      if (ctx.signal.aborted) throw abortError();
    };

    let census = ctx.census;
    if (runs('census') || !census) {
      step('census');
      census = await stage<CensusStageInputV1, DeckCensusV1>('rebrand.census', { source: ctx.source }, ctx);
      checkAbort();
      await record(ctx, 'census', census, census.rules.version);
      ctx.census = census;
      emitFor(at, { census, project: ctx.project, save: ctx.save });
    }

    step('plan');
    const resolved = await deps.resolveDesignSystem();
    checkAbort();
    if (!resolved) throw new StepFailure('no-design-system', 'No design system could be read, so there is nothing to plan against.');
    if (!live(at)) return;
    system = resolved;
    const faces = facesOf(resolved);
    const waiting = faces.length > 0 && deps.loadFaces !== undefined && faces.some((face) => !facesLoaded.has(face));
    emit({ designSystem: infoWithFaces(resolved), ...(waiting ? { fontsReady: false } : { fontsReady: true }) });
    if (waiting) void loadFaces(at, faces);

    let plan = ctx.plan;
    // A stored plan made against another token pack or slide master cannot compile
    // here: the compile refuses it. It is made again against this design system, with
    // what the person chose carried across.
    const outdated = plan && !runs('plan') && (await designSystemChanged(plan, resolved)) ? plan : null;
    checkAbort();
    if (runs('plan') || !plan || outdated) {
      const previous = outdated ?? ctx.previous;
      const planInput: PlanStageInputV1 = {
        source: ctx.source,
        census,
        system: resolved.input,
        ...(previous ? { previous } : {}),
        ...(ctx.preset ? { preset: ctx.preset } : {}),
        ...(outdated?.shuffleSeed !== undefined ? { seed: outdated.shuffleSeed } : {}),
      };
      let fresh = await stage<PlanStageInputV1, RenovationPlanV1>('rebrand.plan', planInput, ctx);
      checkAbort();
      if (live(at)) appliedPresetKey = ctx.preset ? JSON.stringify(ctx.preset) : null;
      if (outdated) {
        const floor = Math.max(outdated.revision, ctx.project.checkpoint.planRevision ?? 0);
        fresh = { ...keepLineageFacts(carryPersonRows(fresh, outdated, resolved.info), outdated), revision: Math.max(fresh.revision, floor + 1) };
      } else if (ctx.previous && ctx.previous.source.hash !== fresh.source.hash) {
        // A newer version: the plan stage carried the object decisions; the slide,
        // colour and font choices come across here.
        fresh = carryIntoNewerVersion(fresh, ctx.previous, resolved.info);
      }
      plan = fresh;
      await record(ctx, 'plan', plan, plan.algorithms.plan);
      ctx.plan = plan;
      emitFor(at, { plan, project: ctx.project, save: ctx.save });
    }

    step('preview');
    const faithful = await stage<FaithfulStageInputV1, CompiledDeckV1>('rebrand.faithful', { source: ctx.source }, ctx);
    checkAbort();
    emitFor(at, { faithful });
    // The picture a rebuilt slide came from loads with the rest, so the Original pane can
    // show the slide as it was (plan 275 decision 29).
    collectMedia([faithful], recoveryRefs(ctx.source));

    const previewInput: CompileStageInputV1 = {
      source: ctx.source,
      census,
      plan: previewPlanOf(plan),
      system: resolved.input,
      applyUnreviewed: true,
      applyNeedsAttention: true,
    };
    const preview = await stage<CompileStageInputV1, CompiledDeckV1>('rebrand.compile', previewInput, ctx, plan.revision);
    checkAbort();

    let readiness: RebrandStateV1['readiness'] = [];
    try {
      readiness = await deps.readiness(ctx.source, census);
    } catch {
      readiness = [];
    }
    checkAbort();
    if (!live(at)) return;
    await storeThumbnail(ctx, preview, resolved);
    if (!live(at)) return;
    heldEpoch = loadEpoch;
    emit({
      phase: 'review',
      progress: null,
      error: null,
      project: ctx.project,
      plan,
      census,
      preview: { deck: preview, planRevision: plan.revision },
      previewStale: false,
      readiness,
      save: ctx.save,
    });
    collectMedia([preview]);
    await emitVersions(at, ctx.project);
  }

  /**
   * Load the design system's faces, then say they are ready (close-out 9.2). A failure
   * or a slow device still ends in ready: the drawing then takes the fallback rather
   * than waiting for good.
   */
  async function loadFaces(at: number, faces: readonly string[]): Promise<void> {
    try {
      await deps.loadFaces?.([...faces]);
    } catch {
      // The drawing falls back to the next face in its stack.
    }
    for (const face of faces) facesLoaded.add(face);
    if (live(at) && state.fontsReady === false) emit({ fontsReady: true });
  }

  /**
   * The first proposed slide drawn small, stored once on the project for the lists that
   * name it (close-out section 3.2): at a fixed long edge with the thumbnail detail, in
   * the design system's faces, every picture a flat box (a drawable URL does not outlive
   * the tab). Nothing is stored over `PROJECT_THUMB_SVG_MAX` bytes, nor while the project
   * lives in memory, nor over a thumbnail already there. A refused write changes nothing
   * but leaves the save state as it was.
   */
  async function storeThumbnail(ctx: RunCtxV1, preview: CompiledDeckV1, resolved: RebrandResolvedSystemV1): Promise<void> {
    if (!stored || ctx.save.kind !== 'saved' || ctx.project.thumbSvg) return;
    const svg = projectThumbnail(preview, resolved);
    if (!svg) return;
    let res: Awaited<ReturnType<typeof store.update>>;
    try {
      res = await store.update(ctx.project.id, ctx.project.revision, { thumbSvg: svg });
    } catch {
      return;
    }
    if (!res.ok) return;
    const fresh = await store.get(ctx.project.id).catch(() => null);
    if (!fresh) return;
    ctx.project = fresh;
    ctx.save = { kind: 'saved', revision: fresh.revision };
  }

  /** A stored project as the intake and the report list it. */
  function summaryOf(project: RenovationProjectV1): RebrandProjectSummaryV1 {
    const when = project.updatedAt ?? project.createdAt ?? '';
    return {
      id: project.id,
      name: project.name,
      ...(project.source.name ? { sourceName: project.source.name } : {}),
      ...(typeof project.source.pageCount === 'number' ? { slides: project.source.pageCount } : {}),
      // A written plan is a project in review: the list reads the stage it is at,
      // not the last one it finished, so it never says "being prepared" over a plan.
      stage: project.checkpoint.stage === 'plan' && committed(project) ? 'review' : project.checkpoint.stage,
      ...(when ? { updatedAt: when } : {}),
      ...(project.thumbSvg ? { thumbSvg: project.thumbSvg } : {}),
    };
  }

  /** The other stored versions of a project's deck: the same lineage, newest first. */
  async function versionsOf(project: RenovationProjectV1): Promise<RebrandProjectSummaryV1[]> {
    const lineage = project.source.lineageId;
    const all = await store.list().catch((): RenovationProjectV1[] => []);
    return newestFirst(all.filter((other) => other.id !== project.id && other.source.lineageId === lineage && !unfinishedRead(other)))
      .map(summaryOf);
  }

  async function emitVersions(at: number, project: RenovationProjectV1): Promise<void> {
    const versions = await versionsOf(project);
    if (live(at) && state.project?.id === project.id) emit({ versions });
  }

  /** Whether a plan was made against another token pack or slide master than `resolved`. */
  async function designSystemChanged(plan: RenovationPlanV1, resolved: RebrandResolvedSystemV1): Promise<boolean> {
    const was = plan.designSystem;
    if (was.masterId !== undefined && was.masterId !== resolved.input.master.id) return true;
    const { snapshot } = await resolveRebrandDesignSystem(resolved.input);
    return was.tokenHash !== snapshot.tokenHash;
  }

  function fail(at: number, err: unknown, step: RebrandStepV1, signal?: AbortSignal): void {
    if (!live(at)) return;
    const error = errorOf(err, step, signal);
    emit({
      phase: 'failed',
      progress: null,
      error,
      ...(error.code === 'storage.quota' ? { save: { kind: 'held', reason: 'quota' } as const } : {}),
    });
  }

  /** The project ingest handed back, stored if ingest did not store it. */
  async function ensureStored(project: RenovationProjectV1, file: File): Promise<RenovationProjectV1> {
    const found = await store.get(project.id);
    if (found) return found;
    const { version: _version, revision: _revision, checkpoint: _checkpoint, parts: _parts, designSessionIds: _sessions, ...input } = project;
    try {
      return await store.create(input, { bytes: file });
    } catch (err) {
      if (err instanceof ProjectQuotaError) {
        stored = false;
        return err.project;
      }
      throw err;
    }
  }

  function afterReview(at: number): void {
    if (live(at) && state.phase === 'review' && state.mode === 'keep-design' && (state.keep.status === 'idle' || state.keep.status === 'failed')) {
      void runKeep();
    }
  }

  // ─── opening and starting ──────────────────────────────────────────────────

  /** The preset with this id among the ones on offer, or undefined when none is. */
  async function presetById(id: string | null | undefined): Promise<RenovationPresetV1 | undefined> {
    if (!id || !deps.presets) return undefined;
    try {
      return (await deps.presets.list()).find((entry) => entry.preset.id === id)?.preset;
    } catch {
      return undefined;
    }
  }

  /** The ingest, with the in-place model offer held back while it runs. */
  async function ingestHeld(file: File, signal: AbortSignal, lineageId: string | undefined, onProgress: (done: number, total: number) => void): Promise<RebrandIngestResultV1> {
    const release = deps.holdOffers?.();
    try {
      return await deps.ingest({ file, signal, onProgress, ...(lineageId ? { lineageId } : {}) });
    } finally {
      release?.();
    }
  }

  /**
   * Read one deck into the open session: the ingest, then the census, the plan, both
   * panes and readiness. Resolves the project id once the deck has one.
   */
  async function readIntoSession(
    file: File,
    at: number,
    ac: AbortController,
    opts: ReadOptsV1,
    onProgress: ((done: number, total: number) => void) | null,
    onStep: (step: RebrandStepV1) => void,
  ): Promise<string | null> {
    const preset = opts.preset ?? (await presetById(opts.presetId));
    const ingested = await ingestHeld(file, ac.signal, opts.lineageId, (count, total) => {
      onProgress?.(count, total);
      emitFor(at, { progress: { step: 'read', done: count, total } });
    });
    if (ac.signal.aborted) {
      // The read finished just as the cancel came. A cancelled read leaves nothing
      // behind, the same rule the ingest keeps for a cancel during the read.
      await store.remove(ingested.project.id).catch(() => undefined);
      throw abortError();
    }
    const project = await ensureStored(ingested.project, file);
    const ctx: RunCtxV1 = {
      session: at,
      signal: ac.signal,
      project,
      source: ingested.source,
      census: null,
      plan: null,
      previous: opts.previous ?? null,
      ...(preset ? { preset } : {}),
      save: stored ? { kind: 'saved', revision: project.revision } : { kind: 'held', reason: 'quota' },
    };
    if (!(hasStoredPart(project, 'sourceDeck') && committed(project))) {
      await record(ctx, 'ingest', ingested.source, `${ingested.source.reader.name}/${ingested.source.reader.version}`);
    }
    if (!live(at)) return ctx.project.id;
    onProgress?.(0, 0);
    emit({
      phase: 'analysing',
      project: ctx.project,
      source: ctx.source,
      progress: { step: 'census' },
      save: ctx.save,
      vectorLabels: vectorLabelsOf(ctx.source, ingested.vectorLabels),
    });
    await analyse(ctx, 'census', onStep);
    return ctx.project.id;
  }

  async function start(file: File): Promise<void> {
    await startWith(file, { presetId: nextPreset });
  }

  async function startWith(file: File, opts: ReadOptsV1): Promise<void> {
    if (disposed) return;
    const at = begin();
    const ac = new AbortController();
    run = ac;
    // A new single read ends the list of an earlier multi-file read, unless one is still running.
    emit({ ...initialState(state.mode), phase: 'reading', progress: { step: 'read' }, ...(batchRun ? {} : { batch: undefined }) });
    let step: RebrandStepV1 = 'read';
    try {
      let finished: (() => void) | undefined;
      const done = await deps.runJob(
        { title: tRaw('Planning a renovation of {name}', { name: file.name }), cancel: () => ac.abort(), quietWhile },
        async (handle) => {
          finished = handle.dismiss;
          await readIntoSession(file, at, ac, opts, (count, total) => handle.progress(count, total, total > 0 ? readingSentence(count, total) : undefined), (next) => {
            step = next;
          });
          return live(at);
        },
      );
      if (done === undefined && live(at) && state.phase !== 'review') fail(at, abortError(), step, ac.signal);
      offerDismiss(at, finished);
    } catch (err) {
      fail(at, err, step, ac.signal);
    } finally {
      if (run === ac) run = null;
    }
    afterReview(at);
    readPicturesOnArrival(at);
  }

  /**
   * A deck that is mostly slide pictures has its text read as part of opening it (plan
   * 275 decision 29), in answer to the person having chosen or dropped it: this runs
   * after a read the person started, never after a stored project opens. With the model
   * on the device the reading runs at once; with the model missing nothing opens on
   * arrival, and the notice band's Read the text carries the offer (close-out section
   * 2.5). It is not awaited, so the review is open to look through while it runs; an
   * edit made meanwhile is refused as busy (see `editReady`), since the rebuild replaces
   * the objects it would name.
   */
  function readPicturesOnArrival(at: number): void {
    if (!live(at) || state.phase !== 'review' || state.mode !== 'renovate') return;
    if (!deps.ensureTextReading || !deps.rebuildSlidePictures || !mostlyPictures(state.source)) return;
    if (state.readiness.find((item) => item.id === 'ocr')?.state !== 'ready') return;
    void readSlidePictures();
  }

  /**
   * A newer version of the open deck: a new project in the same lineage whose first
   * pass carries the open plan's decisions where the object matched. With nothing open,
   * it is a plain read.
   */
  async function openNewerVersion(file: File): Promise<void> {
    const { project, plan } = state;
    if (!project || !plan) {
      await start(file);
      return;
    }
    await startWith(file, { lineageId: project.source.lineageId, previous: plan, presetId: plan.presetId ?? null });
  }

  /**
   * Several decks, one after another, each under a job of its own. The first goes
   * through the session's own read and opens for review when it is ready; each one
   * after it is read, checked and planned into its own project in the background.
   * The heavy slot is released between decks, so Open in Design, opening a ready deck
   * and Keep the design wait for one deck at most, never for the whole list. `batch`
   * says where each one is.
   */
  async function startMany(files: File[]): Promise<void> {
    if (disposed) return;
    const decks = files.filter((file): file is File => Boolean(file));
    const first = decks[0];
    if (!first) return;
    if (decks.length === 1) {
      await start(first);
      return;
    }
    batchRun?.abort();
    const bac = new AbortController();
    batchRun = bac;
    let rows: RebrandBatchRowV1[] = decks.map((file, index) => ({ index, name: file.name, state: 'waiting' }));
    const setRow = (index: number, patch: Partial<RebrandBatchRowV1>): void => {
      if (batchRun !== bac || disposed) return;
      rows = rows.map((one) => (one.index === index ? { ...one, ...patch } : one));
      emit({ batch: rows });
    };
    emit({ batch: rows });
    const presetId = nextPreset;
    try {
      const preset = await presetById(presetId);
      const opts: ReadOptsV1 = preset ? { preset } : {};
      let resolved: RebrandResolvedSystemV1 | null = null;
      for (const [index, file] of decks.entries()) {
        if (bac.signal.aborted) {
          setRow(index, { state: 'failed', error: 'cancelled' });
          continue;
        }
        setRow(index, { state: 'reading' });
        if (index === 0) {
          await readFirstOfMany(file, bac.signal, opts, (id) => setRow(index, { projectId: id }), (patch) => setRow(index, patch));
          continue;
        }
        let projectId: string | undefined;
        try {
          const done = await deps.runJob(
            {
              title: tRaw('Reading {name}, deck {n} of {total}', { name: file.name, n: index + 1, total: decks.length }),
              cancel: () => bac.abort(),
            },
            async () => {
              resolved ??= system ?? (await deps.resolveDesignSystem());
              if (!resolved) throw new StepFailure('no-design-system', 'No design system could be read, so there is nothing to plan against.');
              projectId = await readInBackground(file, bac.signal, resolved, opts.preset, (id) => {
                projectId = id;
                setRow(index, { projectId: id });
              });
              return true;
            },
          );
          if (done === undefined) throw abortError();
          setRow(index, { state: 'ready', ...(projectId ? { projectId } : {}) });
        } catch (err) {
          setRow(index, { state: 'failed', error: errorOf(err, 'read', bac.signal).code, ...(projectId ? { projectId } : {}) });
        }
      }
    } finally {
      if (batchRun === bac) batchRun = null;
    }
  }

  /** The first deck of a multi-file read, through the session under a job of its own, so it opens for review. */
  async function readFirstOfMany(
    file: File,
    batchSignal: AbortSignal,
    opts: ReadOptsV1,
    onProject: (id: string) => void,
    setRow: (patch: Partial<RebrandBatchRowV1>) => void,
  ): Promise<void> {
    const at = begin();
    const ac = new AbortController();
    run = ac;
    const onAbort = (): void => ac.abort();
    batchSignal.addEventListener('abort', onAbort, { once: true });
    emit({ ...initialState(state.mode), phase: 'reading', progress: { step: 'read' } });
    let step: RebrandStepV1 = 'read';
    try {
      const read: { id: string | null } = { id: null };
      const done = await deps.runJob(
        { title: tRaw('Planning a renovation of {name}', { name: file.name }), cancel: () => ac.abort() },
        async (handle) => {
          read.id = await readIntoSession(file, at, ac, opts, (count, total) => handle.progress(count, total), (next) => {
            step = next;
          });
          return true;
        },
      );
      if (done === undefined) throw abortError();
      const id = read.id;
      if (id) onProject(id);
      setRow({ state: 'ready', ...(id ? { projectId: id } : {}) });
    } catch (err) {
      const id = live(at) ? state.project?.id : undefined;
      fail(at, err, step, ac.signal);
      setRow({ state: 'failed', error: errorOf(err, step, ac.signal).code, ...(id ? { projectId: id } : {}) });
    } finally {
      batchSignal.removeEventListener('abort', onAbort);
      if (run === ac) run = null;
    }
    afterReview(at);
    readPicturesOnArrival(at);
  }

  /**
   * One deck of a multi-file read that is not the open one: read, checked and planned
   * into its own project, each stage checkpointed, with nothing drawn. It never touches
   * the open session. A full device fails this deck rather than holding it in memory,
   * since nothing is on screen to keep it for.
   */
  async function readInBackground(
    file: File,
    signal: AbortSignal,
    resolved: RebrandResolvedSystemV1,
    preset: RenovationPresetV1 | undefined,
    onProject: (id: string) => void,
  ): Promise<string> {
    // No offer hold here: the person is looking at another deck, and an in-place download
    // they ask for there must not be refused over a read they cannot see.
    const ingested = await deps.ingest({ file, signal, onProgress: () => {} });
    if (signal.aborted) {
      await store.remove(ingested.project.id).catch(() => undefined);
      throw abortError();
    }
    let project = await storedOrCreate(ingested.project, file);
    onProject(project.id);
    const saved = (res: AdvanceOnceV1): RenovationProjectV1 => {
      if (res.kind === 'held') throw new StepFailure('storage.quota', 'This device has no room left for the project.');
      return res.project;
    };
    if (!(hasStoredPart(project, 'sourceDeck') && committed(project))) {
      project = saved(await advanceOnce(project, 'ingest', ingested.source, `${ingested.source.reader.name}/${ingested.source.reader.version}`, signal));
    }
    const census = await deps.runStage<CensusStageInputV1, DeckCensusV1>('rebrand.census', { source: ingested.source }, { projectId: project.id }, signal);
    if (signal.aborted) throw abortError();
    project = saved(await advanceOnce(project, 'census', census, census.rules.version, signal));
    const plan = await deps.runStage<PlanStageInputV1, RenovationPlanV1>(
      'rebrand.plan',
      { source: ingested.source, census, system: resolved.input, ...(preset ? { preset } : {}) },
      { projectId: project.id },
      signal,
    );
    if (signal.aborted) throw abortError();
    project = saved(await advanceOnce(project, 'plan', plan, plan.algorithms.plan, signal));
    return project.id;
  }

  /** The project ingest handed back, stored if ingest did not store it, without touching the session. */
  async function storedOrCreate(project: RenovationProjectV1, file: File): Promise<RenovationProjectV1> {
    const found = await store.get(project.id);
    if (found) return found;
    const { version: _version, revision: _revision, checkpoint: _checkpoint, parts: _parts, designSessionIds: _sessions, ...input } = project;
    try {
      return await store.create(input, { bytes: file });
    } catch (err) {
      if (err instanceof ProjectQuotaError) throw new StepFailure('storage.quota', err.message);
      throw err;
    }
  }

  async function open(projectId: string): Promise<void> {
    if (disposed) return;
    const at = begin();
    const ac = new AbortController();
    run = ac;
    emit({ ...initialState(state.mode), phase: 'analysing', progress: { step: 'read' } });
    let step: RebrandStepV1 = 'read';
    try {
      const opened = await openProject(store, projectId);
      if (!opened) throw new StepFailure('stage-failed', `No renovation project ${projectId} is stored on this device.`);
      if (opened.unknownStage !== undefined) {
        throw new StepFailure('plan.invalid', `This project stopped at "${opened.unknownStage}", which this version of Lolly cannot read.`);
      }
      let project = opened.project;
      const source = await store.getPart<SourceDeckV1>(project.id, 'sourceDeck');
      if (!live(at)) return;
      if (!source) {
        emit({ project });
        throw new StepFailure('source.unreadable', 'This project holds no read deck, so the file has to be chosen again.');
      }
      if (opened.resumeFrom === 'ingest') {
        // The deck was read and the stage was never marked: mark it rather than read again.
        const marked = await markStageComplete(store, project, 'ingest');
        if (marked.outcome !== 'advanced') {
          throw new StepFailure('stage-failed', 'message' in marked ? marked.message : 'The read deck could not be marked as read.');
        }
        project = marked.project;
      }
      const from = opened.resumeFrom === 'ingest' ? 'census' : resumePoint(project).resumeFrom;
      const past = (name: ProjectStageV1): boolean => from === null || stageAt(from) > stageAt(name);
      const census = past('census') ? await store.getPart<DeckCensusV1>(project.id, 'census') : null;
      const storedPlan = await store.getPart<RenovationPlanV1>(project.id, 'plan');
      const plan = past('plan') ? storedPlan : null;
      if (!live(at)) return;
      const save: RebrandSaveStateV1 = { kind: 'saved', revision: project.revision };
      emit({ project, source, census, plan, save, vectorLabels: vectorLabelsOf(source) });

      const preset = await presetById(storedPlan?.presetId);
      let finished: (() => void) | undefined;
      const done = await deps.runJob(
        { title: tRaw('Opening {name}', { name: project.name }), cancel: () => ac.abort(), quietWhile },
        async (handle) => {
          finished = handle.dismiss;
          const ctx: RunCtxV1 = {
            session: at,
            signal: ac.signal,
            project,
            source,
            census,
            plan,
            previous: storedPlan,
            ...(preset ? { preset } : {}),
            save,
          };
          await analyse(ctx, from, (next) => {
            step = next;
          });
          return true;
        },
      );
      if (done === undefined && live(at) && state.phase !== 'review') fail(at, abortError(), step, ac.signal);
      offerDismiss(at, finished);
    } catch (err) {
      fail(at, err, step, ac.signal);
    } finally {
      if (run === ac) run = null;
    }
    afterReview(at);
    readLabelsWhenReady(at);
  }

  async function recent(): Promise<RebrandProjectSummaryV1[]> {
    const projects = await store.list();
    // A read that stopped before its source deck was stored (a tab closed mid-read)
    // cannot be opened, so it is not offered. It stays until the store removes it.
    return newestFirst(projects.filter((project) => !unfinishedRead(project))).map(summaryOf);
  }

  function close(): void {
    if (disposed) return;
    begin();
    emit({ ...initialState(state.mode) });
  }

  function quietJobsWhile(quiet: (() => boolean) | null): void {
    quietFn = quiet;
  }

  async function remove(projectId: string): Promise<void> {
    if (state.project?.id === projectId) close();
    await store.remove(projectId);
  }

  // ─── edits ─────────────────────────────────────────────────────────────────

  function editReady(): EditReadyV1 {
    const { plan, project, source } = state;
    if (!plan || !project || !source) return { ok: false, refusal: 'no-plan' };
    if (state.phase !== 'review') return { ok: false, refusal: 'busy' };
    // While the slide pictures are read the rebuild replaces the objects an edit would
    // name, so an edit is refused at once with its reason, never held for minutes
    // behind the reading in the queue.
    if (readingPictures) return { ok: false, refusal: 'busy' };
    return { ok: true, plan, project, source };
  }

  /** Write a whole plan as one transaction and say what the view should show after it. */
  async function writePlan(plan: RenovationPlanV1): Promise<PlanWriteV1> {
    const project = state.project;
    if (!project) return { ok: false, refusal: 'no-plan', patch: {} };
    const at = session;
    if (!stored) {
      const next = { ...plan, revision: Math.max(plan.revision, project.checkpoint.planRevision ?? 0) + 1 };
      return { ok: true, patch: { plan: next, save: { kind: 'held', reason: 'quota' } } };
    }
    emit({ save: { kind: 'saving' } });
    const res = await commitPlan(store, project, plan);
    if (!live(at)) return { ok: false, refusal: 'busy', patch: {} };
    switch (res.outcome) {
      case 'committed':
        return { ok: true, patch: { plan: res.plan, project: res.project, save: { kind: 'saved', revision: res.project.revision } } };
      case 'held':
        return { ok: true, patch: { plan: res.plan, save: { kind: 'held', reason: 'quota' } } };
      case 'uncheckpointed':
        return {
          ok: true,
          patch: {
            plan: res.plan,
            project: res.project,
            save: res.refusal === 'stale-revision' ? { kind: 'stale' } : { kind: 'saved', revision: res.project.revision },
          },
        };
      case 'reload':
        return { ok: false, refusal: 'stale-revision', patch: { save: { kind: 'stale' } } };
      default:
        return { ok: false, refusal: res.refusal === 'quota' ? 'quota' : 'stale-revision', patch: { save: { kind: 'stale' } } };
    }
  }

  function edit(spec: EditSpecV1): Promise<RebrandEditOutcomeV1> {
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    return serial(async () => {
      const ready = editReady();
      if (!ready.ok) return refused(ready.refusal);
      const { plan: base, source } = ready;
      const result = spec.run(base, source);
      const skipped = result.skipped.length;
      if (result.touched.length === 0) return refused('nothing-to-do', skipped);
      const rows = spec.rows(result, source);
      const before = capturePlanRows(base, rows);
      const after = capturePlanRows(result.plan, rows);
      if (sameValue(before, after)) return refused('nothing-to-do', skipped);
      const written = await writePlan(result.plan);
      if (!written.ok) {
        if (Object.keys(written.patch).length > 0) emitFor(session, written.patch);
        return refused(written.refusal, skipped);
      }
      undoSteps.push({ label: spec.label(result), before, after });
      redoSteps = [];
      emit({ ...written.patch, history: historyState(), previewStale: true });
      // Asked for before the whole deck, so it takes the heavy slot first.
      if (spec.quick) void quickPreview(session, spec.quick(result));
      schedulePreview();
      return { ok: true, touched: result.touched.length, skipped };
    });
  }

  function travel(direction: 'undo' | 'redo'): Promise<RebrandEditOutcomeV1> {
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    return serial(async () => {
      const ready = editReady();
      if (!ready.ok) return refused(ready.refusal);
      const from = direction === 'undo' ? undoSteps : redoSteps;
      const top = from[from.length - 1];
      if (!top) return refused('nothing-to-do');
      const plan = 'whole' in top
        ? (direction === 'undo' ? top.whole.before : top.whole.after)
        // `restoreThemeRows` is `restorePlanRows` for every step but a theme's, whose
        // capture also holds the deck theme it put back.
        : restoreThemeRows(ready.plan, direction === 'undo' ? top.before : top.after);
      const written = await writePlan(plan);
      if (!written.ok) {
        if (Object.keys(written.patch).length > 0) emitFor(session, written.patch);
        return refused(written.refusal);
      }
      from.pop();
      (direction === 'undo' ? redoSteps : undoSteps).push(top);
      emit({ ...written.patch, history: historyState(), previewStale: true });
      schedulePreview();
      return { ok: true, touched: top.label.count, skipped: 0 };
    });
  }

  function decide(input: RebrandDecideInputV1): Promise<RebrandEditOutcomeV1> {
    return edit({
      run: (plan, source) => decideObjects(plan, {
        objectIds: input.objectIds,
        action: input.action,
        ...(input.replacement ? { replacement: input.replacement } : {}),
        author: 'user',
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.includeCorrected ? { includeCorrected: true } : {}),
        source,
      }),
      rows: (result, source) => ({ objectIds: result.touched, source }),
      label: (result) => ({ kind: 'decide', action: input.action, count: result.touched.length }),
    });
  }

  /** The whole queue as proposed, flagged rows included: the rows `openPendingIds` names, on included slides. */
  function acceptSuggestions(): Promise<RebrandEditOutcomeV1> {
    return edit({
      run: (plan, source) => acceptSuggestionRows(plan, { scope: 'all', author: 'user', includedOnly: true, source }),
      rows: (result, source) => ({ objectIds: result.touched, source }),
      label: (result) => ({ kind: 'accept', count: result.touched.length }),
    });
  }

  function include(slideIds: string[], included: boolean): Promise<RebrandEditOutcomeV1> {
    // The history counts the slides whose include flipped, not every slide named: a
    // bulk Include over three slides, two already in, is "include 1 slide".
    let flipped = 0;
    return edit({
      run: (plan) => {
        const named = new Set(slideIds);
        flipped = plan.slides.filter((slide) => named.has(slide.id) && slide.include !== included).length;
        return setSlidesIncluded(plan, slideIds, included);
      },
      rows: (result) => ({ slideIds: result.touched }),
      label: () => ({ kind: included ? 'include' : 'exclude', count: flipped }),
    });
  }

  function move(slideId: string, delta: number): Promise<RebrandEditOutcomeV1> {
    return edit({
      run: (plan) => moveSlide(plan, slideId, delta),
      rows: (result) => ({ slideIds: result.touched }),
      // A move renumbers every included slide; the person moved one.
      label: () => ({ kind: 'move', count: 1 }),
    });
  }

  /**
   * A new layout for these slides, as one undoable step. Their preview is compiled
   * alone first, so the Proposed pane shows the new layout before the whole deck has
   * compiled again (plan 275 decision 31).
   */
  function setLayout(slideIds: string[], layout: Parameters<RebrandControllerV1['setLayout']>[1]): Promise<RebrandEditOutcomeV1> {
    return edit({
      run: (plan) => setSlidesLayout(plan, slideIds, layout),
      rows: (result) => ({ slideIds: result.touched }),
      label: (result) => ({ kind: 'layout', count: result.touched.length }),
      quick: (result) => result.touched,
    });
  }

  /**
   * How these slides are built (plan 275 section 4): poured into their layout, kept in
   * their original arrangement, or kept as a picture. One undoable step; the layout
   * stays on each row, so switching back restores it. Their preview is compiled alone
   * first, as a new layout's is.
   */
  function setArrangement(slideIds: string[], arrangement: SlideArrangementV1): Promise<RebrandEditOutcomeV1> {
    return edit({
      run: (plan) => setSlidesArrangement(plan, slideIds, arrangement),
      rows: (result) => ({ slideIds: result.touched }),
      label: (result) => ({ kind: 'arrangement', count: result.touched.length }),
      quick: (result) => result.touched,
    });
  }

  /**
   * Auto-match (plan 275 decision 28): every included slide (of `slideIds`, when
   * given) whose layout read reaches `bands` takes the layout it names, as one
   * undoable step. `likely` by default, the web's band: clear and likely reads. A
   * layout a person or a preset chose, an arrangement a person chose, a slide left out,
   * a slide with a locked row, a read whose layout has too few cells and a slide already
   * on its layout are passed over. The count it answers is the slides it set.
   */
  function autoMatchLayouts(bands: AutoMatchBandsV1 = 'likely', slideIds?: string[]): Promise<RebrandEditOutcomeV1> {
    const master = system?.input.master;
    if (!master) return Promise.resolve(refused('no-plan'));
    return edit({
      run: (plan, source) => autoMatchLayoutRows(plan, source, state.census ?? undefined, { bands, master, ...(slideIds ? { slideIds } : {}) }),
      rows: (result) => ({ slideIds: result.touched }),
      label: (result) => ({ kind: 'auto-match', count: result.touched.length }),
    });
  }

  /** Move these slides to the start or the end of the included slides, in their own order, as one step. */
  function moveTo(slideIds: string[], to: 'start' | 'end'): Promise<RebrandEditOutcomeV1> {
    return moveSlides(slideIds, to === 'start' ? 0 : Number.MAX_SAFE_INTEGER);
  }

  /** Move these slides as one block so the first sits at `toIndex` among the included slides. */
  function moveSlides(slideIds: string[], toIndex: number): Promise<RebrandEditOutcomeV1> {
    const named = new Set(slideIds);
    return edit({
      run: (plan) => moveSlideBlock(plan, slideIds, toIndex),
      rows: (result) => ({ slideIds: result.touched }),
      // A move renumbers every included slide; the person moved the ones they named.
      label: (result) => ({ kind: 'move', count: result.touched.filter((id) => named.has(id)).length }),
    });
  }

  /**
   * Correct an object's text, or give the reading back with `null`, as one undoable
   * step. The row's `textOverride` is what the compile writes in place of the source runs.
   */
  function setObjectText(objectId: string, text: string | null): Promise<RebrandEditOutcomeV1> {
    return edit({
      run: (plan) => setObjectTextRow(plan, objectId, text),
      rows: (result, source) => ({ objectIds: result.touched, source }),
      label: (result) => ({ kind: 'text', count: result.touched.length }),
    });
  }

  /**
   * "Undo my changes to this slide": the first pass runs again over the same source,
   * preset and seed with no earlier plan, and each named slide takes its proposal back
   * from it (the layout a person set, the slide's own background, every row that is not
   * locked, and the memory of those rows), as one undoable step.
   */
  function resetSlide(slideIds: string[]): Promise<RebrandEditOutcomeV1> {
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    return serial(async () => {
      const ready = editReady();
      if (!ready.ok) return refused(ready.refusal);
      const resolved = system;
      const { project, source, plan: base } = ready;
      const census = state.census;
      if (!resolved || !census) return refused('no-plan');
      const at = session;
      const ac = new AbortController();
      run = ac;
      let proposed: RenovationPlanV1;
      try {
        const preset = await presetById(base.presetId);
        proposed = await deps.runStage<PlanStageInputV1, RenovationPlanV1>(
          'rebrand.plan',
          { source, census, system: resolved.input, ...(preset ? { preset } : {}), ...(base.shuffleSeed === undefined ? {} : { seed: base.shuffleSeed }) },
          { projectId: project.id, planRevision: base.revision },
          ac.signal,
        );
      } catch (err) {
        if (!ac.signal.aborted && !isAbortLike(err)) emitFor(at, { error: { code: 'stage-failed', message: messageOf(err), step: 'plan' } });
        return refused('busy');
      } finally {
        if (run === ac) run = null;
      }
      if (!live(at) || state.plan !== base) return refused('busy');
      const result = resetSlideDecisions(base, slideIds, { proposed, source });
      const skipped = result.skipped.length;
      if (result.touched.length === 0) return refused('nothing-to-do', skipped);
      const named = new Set(result.touched);
      const rowIds = base.slides.filter((slide) => named.has(slide.id)).flatMap((slide) => slide.objects.map((row) => row.id));
      const rows: PlanRowsTouchedV1 = { slideIds: result.touched, objectIds: rowIds, source };
      const before = capturePlanRows(base, rows);
      const after = capturePlanRows(result.plan, rows);
      if (sameValue(before, after)) return refused('nothing-to-do', skipped);
      const written = await writePlan(result.plan);
      if (!written.ok) {
        if (Object.keys(written.patch).length > 0) emitFor(session, written.patch);
        return refused(written.refusal, skipped);
      }
      const label: RebrandHistoryLabelV1 = { kind: 'reset', count: result.touched.length };
      undoSteps.push({ label, before, after });
      redoSteps = [];
      emit({ ...written.patch, history: historyState(), previewStale: true });
      void quickPreview(session, result.touched);
      schedulePreview();
      return { ok: true, touched: result.touched.length, skipped };
    });
  }

  /**
   * What a theme edit solves the colours against (plan 275 section 6.2): the census,
   * the design system's colours in each of its modes and its master, the source, and
   * for a look theme the look the design-system input carries. Null before a deck is read.
   */
  function themeSolve(source: SourceDeckV1, theme: DeckThemeV1 | null | undefined): ThemeSolveContextV1 | null {
    const resolved = system;
    const census = state.census;
    if (!resolved || !census) return null;
    const { input } = resolved;
    const carried = 'looks' in input ? input.looks : undefined;
    const looks = Array.isArray(carried) ? carried.filter(isDeckLook) : [];
    const look = theme?.id === 'look' ? looks.find((one) => one.id === theme.lookId) : undefined;
    const locked = 'locked' in input && input.locked === true;
    return {
      census,
      source,
      system: { colors: input.colors, ...(input.darkColors ? { darkColors: input.darkColors } : {}), master: input.master },
      ...(look ? { look } : {}),
      ...(locked ? { locked: true } : {}),
    };
  }

  /**
   * One theme edit as one undoable step: the rows it names captured with the deck
   * theme (`captureThemeRows`), so undo puts back the theme, every slide's ground and
   * every colour the solve moved.
   */
  function themeEdit(
    run: (plan: RenovationPlanV1, solve: ThemeSolveContextV1) => ReturnType<typeof setDeckTheme>,
    theme: (plan: RenovationPlanV1) => DeckThemeV1 | null | undefined,
    label: (result: ReturnType<typeof setDeckTheme>) => RebrandHistoryLabelV1,
  ): Promise<RebrandEditOutcomeV1> {
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    return serial(async () => {
      const ready = editReady();
      if (!ready.ok) return refused(ready.refusal);
      const { plan: base, source } = ready;
      const solve = themeSolve(source, theme(base));
      if (!solve) return refused('no-plan');
      const result = keepLocks(base, run(base, solve));
      const skipped = result.skipped.length + (result.groundSkipped?.length ?? 0);
      if (result.touched.length === 0) return refused('nothing-to-do', skipped);
      const before = captureThemeRows(base, result.rows);
      const after = captureThemeRows(result.plan, result.rows);
      if (sameValue(before, after)) return refused('nothing-to-do', skipped);
      const written = await writePlan(result.plan);
      if (!written.ok) {
        if (Object.keys(written.patch).length > 0) emitFor(session, written.patch);
        return refused(written.refusal, skipped);
      }
      const step = label(result);
      undoSteps.push({ label: step, before, after });
      redoSteps = [];
      emit({ ...written.patch, history: historyState(), previewStale: true });
      // A few slides on a ground of their own are compiled alone first, as a new layout's are.
      if (step.kind === 'ground' && result.rows.slideIds) void quickPreview(session, result.rows.slideIds);
      schedulePreview();
      return { ok: true, touched: step.count, skipped };
    });
  }

  /**
   * Decision 33c: a colour a person locked keeps the hex they locked under every
   * theme. The solve drops a locked target it cannot hold on a moved ground, so each
   * locked row goes back to the plan's own; the compile then draws its hex, whatever
   * the theme remaps its token to.
   */
  function keepLocks(base: RenovationPlanV1, result: ReturnType<typeof setDeckTheme>): ReturnType<typeof setDeckTheme> {
    const pinned = new Map(base.colors.filter((row) => row.locked === true && row.to).map((row) => [row.useId, row]));
    if (pinned.size === 0) return result;
    const colors = result.plan.colors.map((row) => pinned.get(row.useId) ?? row);
    const kept = new Set(pinned.keys());
    return {
      ...result,
      plan: { ...result.plan, colors },
      touched: result.touched.filter((id) => !kept.has(id)),
      rows: { ...result.rows, useIds: (result.rows.useIds ?? []).filter((id) => !kept.has(id)) },
    };
  }

  /**
   * The deck theme (plan 275 section 6, decision 33), or null for the master as
   * shipped, as one undoable step. The colours are solved again once per ground
   * group, so each holds on the ground its slide is drawn on. A look theme on a
   * locked design system changes nothing and says so (`nothing-to-do`, one skipped).
   */
  function setTheme(theme: DeckThemeV1 | null): Promise<RebrandEditOutcomeV1> {
    return themeEdit(
      (plan, solve) => setDeckTheme(plan, theme, { solve }),
      () => theme,
      () => ({ kind: 'theme', count: 1 }),
    );
  }

  /**
   * These slides' own background, or null to follow the deck theme again, as one
   * undoable step. A slide whose layout has no version for that ground stays on the
   * deck's ground and is counted as skipped.
   */
  function setGround(slideIds: string[], ground: SlideGroundV1 | null): Promise<RebrandEditOutcomeV1> {
    return themeEdit(
      (plan, solve) => setSlideGround(plan, slideIds, ground, { solve }),
      (plan) => plan.designSystem.theme,
      (result) => ({ kind: 'ground', count: result.rows.slideIds?.length ?? 0 }),
    );
  }

  /**
   * The answer of a command the contract declares and this build does not carry out
   * yet (plan 275 section 8): nothing changes, and the refusal says why.
   */
  function notBuilt(): Promise<RebrandEditOutcomeV1> {
    return Promise.resolve({ ok: false, touched: 0, skipped: 0, refusal: 'not-built' });
  }

  /**
   * Read the text in the slides that are still one picture of a whole slide, and
   * rebuild each from what it finds (plan 274 section 6). The text recognition model is
   * offered in place first, from the click that asked; declining leaves every slide a
   * picture. Then, as one job with its progress in slides: the rebuild, the source deck
   * written again, the census and the first pass run again with the plan in hand as
   * `previous`, so the decisions carry where the objects are the same, and the person's
   * slide, colour and font choices come across as they do for a changed design system.
   * Both panes and readiness are drawn again. The undo history is cleared, since it
   * was captured against objects the rebuild replaced.
   */
  function readSlidePictures(slideIds?: string[]): Promise<RebrandEditOutcomeV1> {
    const { ensureTextReading, rebuildSlidePictures } = deps;
    if (!ensureTextReading || !rebuildSlidePictures) return notBuilt();
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    const asked = slideIds ? new Set(slideIds) : null;
    const wanted = slidePictureIdsOf(early.source).filter((id) => !asked || asked.has(id));
    if (wanted.length === 0) return Promise.resolve(refused('nothing-to-do'));
    // The deck the click was made over, since the offer below can outlast it.
    const asker = { at: session, projectId: early.project.id };
    // Asked before the queue. The offer opens a sheet, which needs only the page's
    // sticky activation (a person who chose or dropped the deck has given it, and
    // `ensureModel` checks it and says what to press when it is missing); the download
    // itself starts from the sheet's own Download button and runs on its own job. So the
    // read on arrival, which runs after the deck is read, can ask too.
    return ensureTextReading().then((ready) => (ready ? serial(() => rebuildPictures(wanted, rebuildSlidePictures, asker)) : refused('nothing-to-do')));
  }

  /**
   * Read the chart labels the drawings hold as glyph outlines as text (close-out 9.3).
   * In answer to the person: the text recognition model is offered in place first, as
   * for the slide pictures, and declining leaves the labels drawn.
   */
  function readVectorLabels(): Promise<RebrandEditOutcomeV1> {
    const { readVectorLabels: readLabels, ensureTextReading } = deps;
    if (!readLabels) return notBuilt();
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    if (drawnLabelCount(early.source) === 0) return Promise.resolve(refused('nothing-to-do'));
    const asker = { at: session, projectId: early.project.id };
    const offered = ensureTextReading ? ensureTextReading('labels') : Promise.resolve(true);
    return offered.then((ready) => (ready ? serial(() => rereadLabels(readLabels, asker)) : refused('nothing-to-do')));
  }

  /** Decks whose labels this tab already tried to read on its own, by identity, so an open does not read them again. */
  const labelsTried = new Set<string>();

  /**
   * Read the outlined labels on their own when the text model is already on the device:
   * after a stored deck opens, and after the model was downloaded in place. Nothing is
   * offered and nothing downloads; without the model the labels stay drawn and the
   * readiness row carries the offer. Nothing is tried while readiness says the model
   * can still be downloaded. An open tries once per deck in this tab; `again` is
   * readiness checked after a download, which tries whatever came before.
   */
  function readLabelsWhenReady(at: number, again = false): void {
    const readLabels = deps.readVectorLabels;
    const { source, project } = state;
    if (!readLabels || !source || !project || !live(at) || state.phase !== 'review' || state.mode !== 'renovate') return;
    if (state.vectorLabels?.read || drawnLabelCount(source) === 0) return;
    const key = `${project.id}|${sourceIdentityOf(source)}`;
    if ((!again && labelsTried.has(key)) || state.readiness.some((item) => item.id.startsWith('ocr') && item.state === 'downloadable')) return;
    labelsTried.add(key);
    void serial(() => rereadLabels(readLabels, { at, projectId: project.id }));
  }

  /** The labels read as one job over the deck in hand; the counts go on the state whatever the reading found. */
  function rereadLabels(
    readLabels: NonNullable<RebrandControllerDepsV1['readVectorLabels']>,
    asker: { at: number; projectId: string },
  ): Promise<RebrandEditOutcomeV1> {
    return rereadDeck({
      title: tRaw('Reading the chart labels'),
      // The reading states its total with its first progress.
      total: 0,
      note: (done, total) => tRaw('Reading the labels of chart {n} of {total}', { n: Math.min(done + 1, Math.max(1, total)), total }),
      // The review's progress line names slide pictures; the toast carries this one.
      progress: () => null,
      async read(source, signal, onProgress) {
        const out: RebrandVectorLabelReadV1 = await readLabels({ source, signal, onProgress });
        if (!out.ok) return { source, touched: 0, kept: drawnLabelCount(source) };
        const vectorLabels = vectorLabelsOf(out.source, out.summary);
        return { source: out.source, touched: out.summary.text, kept: out.summary.drawn, patch: { vectorLabels } };
      },
    }, asker);
  }

  /** The slide pictures' rebuild as a reading of the deck (see `rereadDeck`). */
  function rebuildPictures(
    wanted: string[],
    rebuild: RebrandSlidePictureDepsV1['rebuildSlidePictures'],
    asker: { at: number; projectId: string },
  ): Promise<RebrandEditOutcomeV1> {
    return rereadDeck({
      title: wanted.length === 1 ? tRaw('Reading the text in 1 slide picture') : tRaw('Reading the text in {n} slide pictures', { n: wanted.length }),
      total: wanted.length,
      // The toast says what the intake's band says (close-out P4): the slide in hand,
      // one past those read, never past the last.
      note: readingSentence,
      progress: (done, total) => ({ step: 'read', done, total }),
      async read(source, signal, onProgress) {
        const out = await rebuild({ source, slideIds: wanted, signal, onProgress });
        return { source: out.source, touched: out.rebuilt, kept: out.kept };
      },
    }, asker);
  }

  /**
   * One reading of the deck in hand that gives a new deck, as one job: the slide
   * pictures' rebuild, or the chart labels read as text. Everything after the reading
   * (census, first pass, both panes, readiness) runs on the new deck in memory, and the
   * deck, census and plan are written together only after the last point a cancel is
   * taken, so a cancel or a failure before then leaves the store and the review as they
   * were, and the crops a rebuild stored are given back (an abort of the signal it was
   * handed says the result was dropped). Once the new deck is written it is the
   * project's: a census or plan write that fails after it keeps the review on that deck
   * and names what did not save, and a reopen resumes over that same deck.
   */
  async function rereadDeck(reread: RereadV1, asker: { at: number; projectId: string }): Promise<RebrandEditOutcomeV1> {
    // The text recognition offer can span a long download on a job of its own, and a
    // person may open another deck meanwhile. Slide ids are positions in a PDF, so the
    // reading runs only on the deck that was asked about.
    if (!live(asker.at) || state.project?.id !== asker.projectId) return refused('busy');
    const ready = editReady();
    if (!ready.ok) return refused(ready.refusal);
    const resolved = system;
    if (!resolved || !state.census) return refused('no-plan');
    const { project, source, plan: base } = ready;
    const at = session;
    const ac = new AbortController();
    run = ac;
    readingPictures = true;
    // Aborted when the new deck is not taken, so a rebuild gives its crops back. A
    // cancel once the writes began no longer reaches it: the deck may be stored by
    // then, and only the end of the writes says whether it was.
    const drop = new AbortController();
    let writing = false;
    let adopted = false;
    ac.signal.addEventListener('abort', () => {
      if (!writing) drop.abort();
    }, { once: true });
    let step: RebrandStepV1 = 'read';
    const checkAbort = (): void => {
      if (ac.signal.aborted) throw abortError();
    };
    emit({ progress: reread.progress(0, reread.total), error: null });
    try {
      const outcome = await deps.runJob(
        { title: reread.title, cancel: () => ac.abort() },
        async (handle): Promise<RebrandEditOutcomeV1> => {
          const read = await reread.read(source, drop.signal, (done, total) => {
            handle.progress(done, total, reread.note(done, total));
            emitFor(at, { progress: reread.progress(done, total) });
          });
          checkAbort();
          if (read.touched === 0 || !live(at)) {
            if (read.patch && live(at)) emitFor(at, read.patch);
            return refused('nothing-to-do', read.kept);
          }

          const ctx: RunCtxV1 = { session: at, signal: ac.signal, project, source: read.source, census: null, plan: null, previous: base, save: state.save };
          // Each stage after the reading names itself in the job toast too, in the words the
          // intake's progress line uses, so neither is left on the last picture.
          step = 'census';
          emitFor(at, { progress: { step } });
          handle.progress(0, 0, tRaw('Looking for repeated objects'));
          const census = await stage<CensusStageInputV1, DeckCensusV1>('rebrand.census', { source: read.source }, ctx);
          checkAbort();

          step = 'plan';
          emitFor(at, { progress: { step } });
          handle.progress(0, 0, tRaw('Preparing suggestions'));
          const preset = await presetById(base.presetId);
          const fresh = await stage<PlanStageInputV1, RenovationPlanV1>('rebrand.plan', {
            source: read.source,
            census,
            system: resolved.input,
            previous: base,
            ...(preset ? { preset } : {}),
            ...(base.shuffleSeed === undefined ? {} : { seed: base.shuffleSeed }),
          }, ctx);
          checkAbort();
          const floor = Math.max(base.revision, ctx.project.checkpoint.planRevision ?? 0);
          const plan: RenovationPlanV1 = {
            ...keepLineageFacts(carryPersonRows(fresh, base, resolved.info), base),
            revision: Math.max(fresh.revision, floor + 1),
          };

          step = 'preview';
          emitFor(at, { progress: { step } });
          handle.progress(0, 0, tRaw('Drawing the proposed slides'));
          const faithful = await stage<FaithfulStageInputV1, CompiledDeckV1>('rebrand.faithful', { source: read.source }, ctx);
          checkAbort();
          const preview = await stage<CompileStageInputV1, CompiledDeckV1>('rebrand.compile', {
            source: read.source,
            census,
            plan: previewPlanOf(plan),
            system: resolved.input,
            applyUnreviewed: true,
            applyNeedsAttention: true,
          }, ctx, plan.revision);
          checkAbort();
          let readiness: RebrandStateV1['readiness'] = [];
          try {
            readiness = await deps.readiness(read.source, census);
          } catch {
            readiness = [];
          }
          if (!live(at)) return refused('busy');
          checkAbort();

          // The last point a cancel is taken: the writes run to the end on a signal
          // of their own.
          const write: RunCtxV1 = { ...ctx, signal: new AbortController().signal };
          writing = true;
          step = 'read';
          try {
            await record(write, 'ingest', read.source, `${read.source.reader.name}/${read.source.reader.version}`);
          } catch (err) {
            // A checkpoint refused after the part was written still leaves the
            // rebuilt deck stored, and then its crops must stay.
            if (!(await storedSourceIs(project.id, read.source))) throw err;
          }
          adopted = true;
          let unsaved: RebrandErrorV1 | null = null;
          try {
            step = 'census';
            await record(write, 'census', census, census.rules.version);
            step = 'plan';
            await record(write, 'plan', plan, plan.algorithms.plan);
          } catch (err) {
            unsaved = errorOf(err, step);
          }
          if (!live(at)) return { ok: true, touched: read.touched, skipped: read.kept };
          undoSteps = [];
          redoSteps = [];
          heldEpoch = loadEpoch;
          emit({
            progress: null,
            error: unsaved,
            project: write.project,
            source: read.source,
            census,
            plan,
            faithful,
            preview: { deck: preview, planRevision: plan.revision },
            previewStale: false,
            readiness,
            save: write.save,
            history: historyState(),
            ...read.patch,
          });
          collectMedia([faithful, preview], recoveryRefs(read.source));
          return { ok: true, touched: read.touched, skipped: read.kept };
        },
      );
      if (outcome === undefined) {
        emitFor(at, { progress: null });
        return refused('busy');
      }
      if (!outcome.ok) emitFor(at, { progress: null });
      return outcome;
    } catch (err) {
      if (ac.signal.aborted || isAbortLike(err)) {
        emitFor(at, { progress: null });
        return refused('busy');
      }
      emitFor(at, { progress: null, error: errorOf(err, step, ac.signal) });
      return refused('busy');
    } finally {
      readingPictures = false;
      if (!adopted) drop.abort();
      if (run === ac) run = null;
    }
  }

  /** True when the store holds `source` as this project's deck. A store that cannot answer says no. */
  async function storedSourceIs(projectId: string, source: SourceDeckV1): Promise<boolean> {
    try {
      const held = await store.getPart<SourceDeckV1>(projectId, 'sourceDeck');
      return held !== null && held !== undefined && sourceIdentityOf(held) === sourceIdentityOf(source);
    } catch {
      return false;
    }
  }

  function setColour(useIds: string[], target: { hex: string; path?: string } | null, lock?: boolean): Promise<RebrandEditOutcomeV1> {
    if (target === null) return autoColour(useIds);
    return edit({
      run: (plan) => setColorTarget(plan, useIds, target, lock),
      rows: (result) => ({ useIds: result.touched }),
      label: (result) => ({ kind: 'colour', count: result.touched.length }),
    });
  }

  function setFont(from: string, to: string, toPath?: string): Promise<RebrandEditOutcomeV1> {
    return edit({
      run: (plan) => setFontTarget(plan, from, to, toPath),
      rows: (result) => ({ fonts: result.touched }),
      label: (result) => ({ kind: 'font', count: result.touched.length }),
    });
  }

  /**
   * "Automatic" for some colour uses: the colour solve runs again and those uses take
   * its answer, unlocked, in one transaction labelled as a colour change. Clearing the
   * target alone would leave the rows with none, and the compile would keep the old
   * source colour while the view said automatic. The solve reads the same seed the plan
   * holds, so automatic means what the plan's own solve gives; other rows stay.
   */
  function autoColour(useIds: string[]): Promise<RebrandEditOutcomeV1> {
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    return serial(async () => {
      const ready = editReady();
      if (!ready.ok) return refused(ready.refusal);
      const resolved = system;
      const { project, source, plan: base } = ready;
      const census = state.census;
      if (!resolved || !census) return refused('no-plan');
      const wanted = new Set(useIds);
      const known = new Set(base.colors.map((row) => row.useId));
      const skipped = [...wanted].filter((id) => !known.has(id)).length;
      if (!base.colors.some((row) => wanted.has(row.useId))) return refused('nothing-to-do', skipped);
      const at = session;
      const ac = new AbortController();
      run = ac;
      let fresh: RenovationPlanV1;
      try {
        fresh = await deps.runStage<PlanStageInputV1, RenovationPlanV1>(
          'rebrand.plan',
          { source, census, system: resolved.input, previous: base, ...(base.shuffleSeed === undefined ? {} : { seed: base.shuffleSeed }) },
          { projectId: project.id, planRevision: base.revision },
          ac.signal,
        );
      } catch (err) {
        if (!ac.signal.aborted && !isAbortLike(err)) emitFor(at, { error: { code: 'stage-failed', message: messageOf(err), step: 'plan' } });
        return refused('busy');
      } finally {
        if (run === ac) run = null;
      }
      if (!live(at) || state.plan !== base) return refused('busy');

      // The cleared uses take the solve's row, unlocked. A use the solve could not map
      // (no target, or a distinction it could not keep) takes the nearest colour the
      // design system has, so Automatic always gives the row a target and the compile
      // never falls back to the source colour; the compile's own contrast check still
      // reports a pair that ends up too close.
      const offered = new Map(fresh.colors.map((row) => [row.useId, row]));
      const cleared = setColorTarget(base, useIds, null).plan;
      const colors = cleared.colors.map((row) => {
        if (!wanted.has(row.useId)) return row;
        const solved = offered.get(row.useId) ?? row;
        const next: ColorMappingV1 = { ...solved };
        delete next.locked;
        if (next.to !== undefined && next.unresolved === undefined) return next;
        const nearest = nearestSystemColour(next.from, resolved.info.colors);
        if (!nearest) return next;
        next.to = nearest.hex;
        if (nearest.path) next.toPath = nearest.path;
        else delete next.toPath;
        delete next.unresolved;
        return next;
      });
      const next: RenovationPlanV1 = { ...base, colors };
      const rows: PlanRowsTouchedV1 = { useIds: base.colors.filter((row) => wanted.has(row.useId)).map((row) => row.useId) };
      const before = capturePlanRows(base, rows);
      const after = capturePlanRows(next, rows);
      if (sameValue(before, after)) return refused('nothing-to-do', skipped);
      const written = await writePlan(next);
      if (!written.ok) {
        if (Object.keys(written.patch).length > 0) emitFor(session, written.patch);
        return refused(written.refusal, skipped);
      }
      const touched = rows.useIds?.length ?? 0;
      undoSteps.push({ label: { kind: 'colour', count: touched }, before, after });
      redoSteps = [];
      emit({ ...written.patch, history: historyState(), previewStale: true });
      schedulePreview();
      return { ok: true, touched, skipped };
    });
  }

  function shuffleColours(): Promise<RebrandEditOutcomeV1> {
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    return serial(async () => {
      const ready = editReady();
      if (!ready.ok) return refused(ready.refusal);
      const resolved = system;
      const { project, source, plan: base } = ready;
      const census = state.census;
      if (!resolved || !census) return refused('no-plan');
      const at = session;
      const seed = (base.shuffleSeed ?? 0) + 1;
      const ac = new AbortController();
      run = ac;
      let fresh: RenovationPlanV1;
      try {
        fresh = await deps.runStage<PlanStageInputV1, RenovationPlanV1>(
          'rebrand.plan',
          { source, census, system: resolved.input, previous: base, seed },
          { projectId: project.id, planRevision: base.revision },
          ac.signal,
        );
      } catch (err) {
        if (!ac.signal.aborted && !isAbortLike(err)) emitFor(at, { error: { code: 'stage-failed', message: messageOf(err), step: 'plan' } });
        return refused('busy');
      } finally {
        if (run === ac) run = null;
      }
      if (!live(at) || state.plan !== base) return refused('busy');

      // Only the colour rows and the seed come across; locked rows stay as they are.
      const offered = new Map(fresh.colors.map((row) => [row.useId, row]));
      const colors = base.colors.map((row) => (row.locked ? row : (offered.get(row.useId) ?? row)));
      const changed = base.colors.filter((row, i) => !sameValue(row, colors[i])).length;
      const next: RenovationPlanV1 = { ...base, colors, shuffleSeed: fresh.shuffleSeed ?? seed };
      const rows: PlanRowsTouchedV1 = { useIds: base.colors.map((row) => row.useId) };
      const before = capturePlanRows(base, rows);
      const after = capturePlanRows(next, rows);
      const written = await writePlan(next);
      if (!written.ok) {
        if (Object.keys(written.patch).length > 0) emitFor(session, written.patch);
        return refused(written.refusal);
      }
      // A shuffle that moved nothing still stores its seed, so the next one offers
      // something else; it is not a step anybody would undo.
      if (changed > 0) {
        undoSteps.push({ label: { kind: 'shuffle', count: changed }, before, after });
        redoSteps = [];
      }
      emit({ ...written.patch, history: historyState(), ...(changed > 0 ? { previewStale: true } : {}) });
      if (changed > 0) schedulePreview();
      return { ok: true, touched: changed, skipped: 0 };
    });
  }

  // ─── presets ───────────────────────────────────────────────────────────────

  async function presets(): Promise<RebrandPresetSummaryV1[]> {
    if (!deps.presets) return [];
    try {
      return (await deps.presets.list()).map((entry) => ({
        id: entry.preset.id,
        name: entry.name,
        origin: entry.origin,
        ...(entry.description ? { description: entry.description } : {}),
      }));
    } catch {
      return [];
    }
  }

  function choosePreset(presetId: string | null): void {
    if (disposed) return;
    nextPreset = presetId;
    emit({ nextPresetId: presetId ?? undefined });
  }

  /**
   * The first pass again with `presetId` (or with none), over the plan in hand, as one
   * transaction and one undo step. The plan in hand is `previous`, so every decision a
   * person made carries across; which slides are in, their order and the layouts,
   * colours and faces the person chose come across the same way a changed design system
   * brings them. Undo puts the whole plan back.
   */
  function applyPreset(presetId: string | null): Promise<RebrandEditOutcomeV1> {
    const early = editReady();
    if (!early.ok) return Promise.resolve(refused(early.refusal));
    return serial(async () => {
      const ready = editReady();
      if (!ready.ok) return refused(ready.refusal);
      const resolved = system;
      const { project, source, plan: base } = ready;
      const census = state.census;
      if (!resolved || !census) return refused('no-plan');
      const preset = presetId === null ? undefined : await presetById(presetId);
      if (presetId !== null && !preset) return refused('nothing-to-do');
      // The same preset is applied already only when its content is the one the plan
      // ran with; a preset saved again under its name runs again.
      if ((base.presetId ?? null) === presetId && (presetId === null || appliedPresetKey === JSON.stringify(preset))) {
        return refused('nothing-to-do');
      }
      const at = session;
      const ac = new AbortController();
      run = ac;
      let fresh: RenovationPlanV1;
      try {
        fresh = await deps.runStage<PlanStageInputV1, RenovationPlanV1>(
          'rebrand.plan',
          {
            source,
            census,
            system: resolved.input,
            previous: base,
            ...(preset ? { preset } : {}),
            ...(base.shuffleSeed === undefined ? {} : { seed: base.shuffleSeed }),
          },
          { projectId: project.id, planRevision: base.revision },
          ac.signal,
        );
      } catch (err) {
        if (!ac.signal.aborted && !isAbortLike(err)) emitFor(at, { error: { code: 'stage-failed', message: messageOf(err), step: 'plan' } });
        return refused('busy');
      } finally {
        if (run === ac) run = null;
      }
      if (!live(at) || state.plan !== base) return refused('busy');
      let next = keepLineageFacts(carryPersonRows(fresh, base, resolved.info), base);
      if (presetId === null) {
        next = { ...next };
        delete next.presetId;
      }
      next = { ...next, revision: base.revision };
      const written = await writePlan(next);
      if (!written.ok) {
        if (Object.keys(written.patch).length > 0) emitFor(session, written.patch);
        return refused(written.refusal);
      }
      const after = written.patch.plan ?? next;
      appliedPresetKey = preset ? JSON.stringify(preset) : null;
      undoSteps.push({ label: { kind: 'preset', count: 1 }, whole: { before: base, after } });
      redoSteps = [];
      emit({ ...written.patch, history: historyState(), previewStale: true });
      schedulePreview();
      const touched = after.slides.reduce((n, slide) => n + slide.objects.length, 0);
      return { ok: true, touched, skipped: 0 };
    });
  }

  /** The decisions on the open plan as a personal preset, under `name`. */
  async function savePreset(name: string): Promise<RebrandPresetSaveOutcomeV1> {
    const { plan, census } = state;
    const label = name.trim();
    if (!plan || !label) return { ok: false, refusal: 'no-plan' };
    if (!deps.presets) return { ok: false, refusal: 'no-store' };
    const base = await presetById(plan.presetId);
    const preset = presetFromPlan(plan, census, { id: personalPresetId(label), ...(base ? { base } : {}) });
    try {
      const saved = await deps.presets.savePersonal(preset, label);
      return { ok: true, id: saved.preset.id };
    } catch {
      return { ok: false, refusal: 'failed' };
    }
  }

  /** Readiness again, after a model was downloaded in place. */
  async function refreshReadiness(): Promise<void> {
    const { source, census } = state;
    if (!source) return;
    const at = session;
    let readiness: RebrandStateV1['readiness'] = [];
    try {
      readiness = await deps.readiness(source, census);
    } catch {
      readiness = [];
    }
    emitFor(at, { readiness });
    // The model may have arrived in place: chart labels still drawn are read now.
    readLabelsWhenReady(at, true);
  }

  // ─── Design ────────────────────────────────────────────────────────────────

  /**
   * Compile what was accepted and open it in Design. `focusSlideId` opens the whole
   * document with the view on that slide's frame (plan 275 section 5.1).
   */
  function openInDesign(opts: { focusSlideId?: string } = {}): Promise<RebrandOpenOutcomeV1> {
    return serial(async (): Promise<RebrandOpenOutcomeV1> => {
      const { source, census } = state;
      let { plan, project } = state;
      if (!plan || !project || !source) return { ok: false, reason: 'no-plan', warnings: [] };
      const resolved = system;
      if (state.phase !== 'review' || !resolved) return { ok: false, reason: 'busy', warnings: [] };
      const pending = openPendingIds(plan).length;
      if (pending > 0) return { ok: false, reason: 'unreviewed', pending, warnings: [] };
      // What opens has to be what the Proposed pane showed (rule 2): a preview that failed,
      // or one for an older plan, has shown nothing current yet.
      if (!previewCurrent(plan)) return { ok: false, reason: 'busy', warnings: [] };

      const at = session;
      // Edits held in memory after a full device are written first. The review
      // checkpoint and the compiled part name a plan revision, and the store has to
      // hold that revision for them to mean anything on the next open.
      if (stored && state.save.kind === 'held') {
        const written = await writePlan(plan);
        if (!live(at)) return { ok: false, reason: 'busy', warnings: [] };
        if (!written.ok) {
          if (Object.keys(written.patch).length > 0) emit(written.patch);
          return { ok: false, reason: 'stale-revision', warnings: [] };
        }
        if (written.patch.save?.kind === 'held') {
          emit({ save: written.patch.save });
        } else {
          const writtenPlan = written.patch.plan ?? plan;
          // The write only moved the revision on; the preview still shows this plan, so
          // it follows, or every later Open in Design would read it as out of date.
          const preview = state.preview && state.preview.planRevision === plan.revision
            ? { ...state.preview, planRevision: writtenPlan.revision }
            : state.preview;
          emit({ ...written.patch, preview });
          plan = writtenPlan;
          project = written.patch.project ?? project;
        }
      }
      // Still held: Design opens from memory and nothing is written to the store.
      const memoryOnly = !stored || state.save.kind === 'held';
      const opening = { plan, project };

      const ac = new AbortController();
      run = ac;
      // Written inside the job and read after it.
      const progressAt: { step: RebrandStepV1 } = { step: 'compile' };
      emit({ phase: 'opening', progress: { step: 'compile' }, error: null });
      try {
        const outcome = await deps.runJob(
          { title: tRaw('Opening {name} in Design', { name: opening.project.name }), cancel: () => ac.abort() },
          async (): Promise<RebrandOpenOutcomeV1 & { patch: Partial<RebrandStateV1> }> => {
            // The compile this one follows, read before it is replaced, so the report can
            // say what the plan change altered. A first compile has none.
            const baseline = lastOpened
              ?? (memoryOnly || !storedCompiledOpened ? null : await store.getPart<CompiledDeckV1>(opening.project.id, 'compiled').catch(() => null));
            const input: CompileStageInputV1 = {
              source,
              ...(census ? { census } : {}),
              plan: opening.plan,
              system: resolved.input,
              applyUnreviewed: false,
              applyNeedsAttention: false,
            };
            const compiled = await deps.runStage<CompileStageInputV1, CompiledDeckV1>(
              'rebrand.compile',
              input,
              { projectId: opening.project.id, planRevision: opening.plan.revision },
              ac.signal,
            );
            if (ac.signal.aborted) throw abortError();
            if (live(at)) lastCompiled = compiled;
            const changes: CompileDiffV1 | undefined = baseline ? compileDiff(baseline, compiled) : undefined;

            let current = opening.project;
            let save: RebrandSaveStateV1 = state.save;
            if (!memoryOnly) {
              if (resumePoint(current).resumeFrom === 'review') {
                // Opening in Design is the end of the review, so it is marked before the compile is.
                const marked = await markStageComplete(store, current, 'review', opening.plan.revision);
                if (marked.outcome !== 'advanced') {
                  return { ok: false, reason: 'stale-revision', warnings: [], patch: { save: { kind: 'stale' } } };
                }
                current = marked.project;
              }
              const res = await advance(
                store,
                current,
                'compile',
                async (p, asked) => ({ projectId: p.id, stage: asked, algorithmVersion: compiled.algorithms.compile ?? '', result: compiled }),
                { signal: ac.signal },
              );
              if (res.outcome === 'cancelled') throw abortError();
              if (res.outcome === 'reload') {
                return { ok: false, reason: 'stale-revision', warnings: [], patch: { save: { kind: 'stale' } } };
              }
              if (res.outcome === 'advanced' || res.outcome === 'uncheckpointed') {
                current = res.project;
                save = { kind: 'saved', revision: res.project.revision };
                if (live(at)) storedCompiledOpened = false;
              } else if (res.outcome === 'held') {
                save = { kind: 'held', reason: 'quota' };
              } else {
                throw new StepFailure('stage-failed', res.message);
              }
            }

            // A document still over Design's history budget once compressed opens with no
            // automatic history, so the project is kept as a `.lolly` file first and the
            // outcome says where (close-out decision 10). A file that could not be kept
            // does not stop the opening: the project is still stored on this device.
            let savedAs: string | undefined;
            if (deps.saveProjectFile && (await overDesignHistory(compiled))) {
              try {
                const held: RebrandPackPartsV1 = {
                  sourceDeck: source,
                  ...(census ? { census } : {}),
                  plan: opening.plan,
                  compiled,
                };
                const kept = await deps.saveProjectFile(await deps.packProject(current, held));
                if (kept) savedAs = kept.name;
              } catch {
                savedAs = undefined;
              }
              if (ac.signal.aborted) throw abortError();
            }

            progressAt.step = 'handoff';
            emitFor(at, { progress: { step: 'handoff' }, project: current, save });
            const focusFrameId = opts.focusSlideId === undefined
              ? undefined
              : compiled.frames.find((frame) => frame.sourceSlideId === opts.focusSlideId && frame.continuation !== true)?.id;
            const handed = await openCompiledDeckInDesign({
              deck: compiled,
              project: current,
              store,
              navigate: deps.design.navigate,
              importer: deps.design.importer,
              openedBefore: openedHere.get(current.id) ?? 0,
              ...(focusFrameId ? { focusFrameId } : {}),
            });
            openedHere.set(current.id, Math.max(openedHere.get(current.id) ?? 0, current.designSessionIds?.length ?? 0) + 1);
            // Design opened this compile, so it is what the next opening is compared with.
            if (live(at)) {
              lastOpened = compiled;
              storedCompiledOpened = true;
            }
            if (handed.recorded && stored) {
              // The session list is a small record write and can succeed while the plan
              // is still held; the project handle follows it, the save state does not.
              current = (await store.get(current.id)) ?? current;
              if (!memoryOnly) save = { kind: 'saved', revision: current.revision };
              // The handoff wrote its session, so the project has opened in Design: the
              // lists read "opened in Design" from here (close-out A4). A refused mark
              // leaves it at "compile", which the next opening marks again.
              if (!memoryOnly && current.checkpoint.stage === 'compile') {
                const marked = await markStageComplete(store, current, 'done', opening.plan.revision).catch(() => null);
                if (marked?.outcome === 'advanced') {
                  current = marked.project;
                  save = { kind: 'saved', revision: current.revision };
                }
              }
            } else if (handed.refusal === 'stale-revision') {
              save = { kind: 'stale' };
            }
            return {
              ok: true,
              sessionId: handed.sessionId,
              warnings: handed.warnings,
              ...(changes ? { changes } : {}),
              ...(savedAs ? { savedAs } : {}),
              patch: { project: current, save, compileDiff: changes ?? null },
            };
          },
        );
        if (!outcome) {
          emitFor(at, { phase: 'review', progress: null, error: errorOf(abortError(), progressAt.step) });
          return { ok: false, reason: 'compile-failed', warnings: [] };
        }
        const { patch, ...answer } = outcome;
        emitFor(at, { ...patch, phase: 'review', progress: null });
        return answer;
      } catch (err) {
        emitFor(at, { phase: 'review', progress: null, error: errorOf(err, progressAt.step, ac.signal) });
        return { ok: false, reason: progressAt.step === 'handoff' ? 'handoff-failed' : 'compile-failed', warnings: [] };
      } finally {
        if (run === ac) run = null;
      }
    });
  }

  /**
   * The project as a `.lolly` file. While the store holds less than this tab (a full
   * device held an edit, or the project never reached the store), the parts come from
   * memory, so the file carries the work the person sees.
   */
  async function downloadProject(): Promise<RebrandDownloadV1 | null> {
    const project = state.project;
    if (!project) return null;
    if (stored && state.save.kind !== 'held') return await deps.packProject(project);
    const parts: RebrandPackPartsV1 = {
      ...(state.source ? { sourceDeck: state.source } : {}),
      ...(state.census ? { census: state.census } : {}),
      ...(state.plan ? { plan: state.plan } : {}),
      ...(lastCompiled && lastCompiled.planRevision === state.plan?.revision ? { compiled: lastCompiled } : {}),
    };
    return await deps.packProject(project, parts);
  }

  // ─── keep the design ───────────────────────────────────────────────────────

  async function runKeep(): Promise<void> {
    const project = state.project;
    if (!project) return;
    const at = session;
    const keep = deps.keepDesign;
    if (!keep) {
      emit({ keep: { status: 'failed', error: 'keep.no-patcher' } });
      return;
    }
    const ac = new AbortController();
    keepRun = ac;
    emit({ keep: { status: 'working' }, progress: { step: 'keep-design' } });
    try {
      const out = await deps.runJob(
        { title: tRaw('Swapping the design system in {name}', { name: project.name }), cancel: () => ac.abort() },
        async (): Promise<KeepDesignResultV1> => {
          const bytes = await deps.sourceBytes(project);
          if (!bytes) throw new KeepFailure('keep.no-source', 'The original file was not kept on this device.');
          const resolved = system ?? await deps.resolveDesignSystem();
          if (!resolved) throw new KeepFailure('keep.no-system', 'No design system is active.');
          if (live(at) && !system) {
            system = resolved;
            emit({ designSystem: resolved.info });
          }
          return await keep.call(deps, { bytes, system: resolved.input, signal: ac.signal });
        },
      );
      if (!live(at)) return;
      if (!out) {
        emit({ keep: { status: 'idle' }, progress: null });
        return;
      }
      keepBytes = out.bytes;
      emit({ keep: { status: 'ready', preview: out.preview, changes: out.changes }, progress: null });
      collectMedia([out.preview]);
    } catch (err) {
      if (!live(at)) return;
      if (ac.signal.aborted || isAbortLike(err)) {
        emit({ keep: { status: 'idle' }, progress: null });
        return;
      }
      emit({ keep: { status: 'failed', error: keepFailureOf(err) }, progress: null });
    } finally {
      if (keepRun === ac) keepRun = null;
    }
  }

  async function setMode(mode: RebrandModeV1): Promise<void> {
    if (disposed) return;
    if (state.mode !== mode) emit({ mode });
    if (mode !== 'keep-design' || !state.project) return;
    if (state.phase === 'reading' || state.phase === 'analysing') return;
    if (state.keep.status === 'idle' || state.keep.status === 'failed') await runKeep();
  }

  async function keepDesignDownload(): Promise<RebrandDownloadV1 | null> {
    const project = state.project;
    if (!keepBytes || !project) return null;
    const stem = stemOf(project.source.name ?? project.name);
    return { blob: new Blob([new Uint8Array(keepBytes)], { type: PPTX_MIME }), filename: `${stem}-rebranded.pptx` };
  }

  // ─── the rest ──────────────────────────────────────────────────────────────

  /**
   * Stop the step the person is watching: the open deck's read or open, and Keep the
   * design. The other decks of a multi-file read carry on; `cancelBatch` stops them.
   */
  function cancel(): void {
    run?.abort();
    keepRun?.abort();
  }

  /** Stop the decks of a multi-file read that have not been read yet. */
  function cancelBatch(): void {
    batchRun?.abort();
  }

  /**
   * Read the project back from the store after another tab moved it on. A start or an
   * open that failed on that refusal opens again from the store, which recomputes the
   * Original pane and readiness; a project under review keeps its panes and takes the
   * stored plan, and the preview compiled before it gives way to the next one.
   */
  async function reload(): Promise<void> {
    const reopen = await serial(async (): Promise<string | null> => {
      const project = state.project;
      if (!project || !stored) return null;
      if (state.phase === 'reading' || state.phase === 'analysing' || state.phase === 'opening') return null;
      const at = session;
      const fresh = await store.get(project.id);
      if (!live(at)) return null;
      if (!fresh) {
        emit({
          phase: 'failed',
          progress: null,
          error: { code: 'stage-failed', message: `No renovation project ${project.id} is stored on this device.` },
          save: { kind: 'none' },
        });
        return null;
      }
      if (state.phase === 'failed' && state.error?.code === 'plan.revision-stale') return fresh.id;
      // Another tab may have rebuilt the slide pictures: the stored plan and census
      // then name objects of a deck this tab does not hold, so it opens again whole.
      const held = state.source;
      const storedSource = await store.getPart<SourceDeckV1>(fresh.id, 'sourceDeck');
      if (!live(at)) return null;
      if (held && storedSource && sourceIdentityOf(storedSource) !== sourceIdentityOf(held)) return fresh.id;
      const plan = await store.getPart<RenovationPlanV1>(fresh.id, 'plan');
      const census = await store.getPart<DeckCensusV1>(fresh.id, 'census');
      if (!live(at)) return null;
      // The history was captured against the plan this tab held; it does not
      // describe the plan another tab wrote.
      undoSteps = [];
      redoSteps = [];
      loadEpoch += 1;
      emit({
        project: fresh,
        plan: plan ?? state.plan,
        census: census ?? state.census,
        save: { kind: 'saved', revision: fresh.revision },
        history: historyState(),
        previewStale: true,
      });
      schedulePreview();
      return null;
    });
    if (reopen !== null) await open(reopen);
  }

  function mediaHref(ref: string): string | undefined {
    return media.get(ref) ?? undefined;
  }

  function dispose(): void {
    if (disposed) return;
    begin();
    batchRun?.abort();
    batchRun = null;
    disposed = true;
    listeners.clear();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    startMany,
    openNewerVersion,
    presets,
    choosePreset,
    applyPreset,
    savePreset,
    refreshReadiness,
    open,
    recent,
    remove,
    close,
    decide,
    acceptSuggestions,
    include,
    move,
    setLayout,
    setArrangement,
    moveTo,
    moveSlides,
    // A copy needs a plan row that names the source slide it draws (plan 275 open issue): not built.
    duplicateSlide: notBuilt,
    resetSlide,
    setTheme,
    setGround,
    readSlidePictures,
    readVectorLabels,
    autoMatchLayouts,
    setObjectText,
    setColour,
    setFont,
    shuffleColours,
    undo: () => travel('undo'),
    redo: () => travel('redo'),
    openInDesign,
    downloadProject,
    setMode,
    keepDesignDownload,
    mediaHref,
    cancel,
    cancelBatch,
    reload,
    quietJobsWhile,
    dispose,
  };
}

const controllers = new WeakMap<object, RebrandControllerV1>();

/**
 * One controller per key (the view passes its host) for the life of the page, made
 * on the first call. Leaving `#/rebrand` keeps the project and a running stage;
 * mounting the view again reattaches to the same controller. `dispose` ends it and
 * the next call makes a fresh one.
 */
export function rebrandControllerFor(key: object, makeDeps: () => RebrandControllerDepsV1): RebrandControllerV1 {
  const found = controllers.get(key);
  if (found) return found;
  const inner = createRebrandController(makeDeps());
  const controller: RebrandControllerV1 = {
    ...inner,
    dispose: () => {
      if (controllers.get(key) === controller) controllers.delete(key);
      inner.dispose();
    },
  };
  controllers.set(key, controller);
  return controller;
}
