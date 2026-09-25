// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation controller contract (plan 274 sections 2.1, 3.5 and 4).
 *
 * `#/rebrand` is split in two on purpose. The controller (`controller.ts`) owns the
 * project: it reads the deck, runs the stages, writes every decision through the
 * store's revision rule, keeps the undo history and hands a compiled deck to Design.
 * It touches no DOM. The view (`views/rebrand.ts` and `views/rebrand/*.ts`) renders
 * the state this file describes and calls the commands below; it never reads the
 * source file, the store or a stage result on its own.
 *
 * Types only. The controller implements `RebrandControllerV1`; the view wires
 * `RebrandControllerDepsV1` from the shell's real pieces (ingest, the stage runner,
 * the design-system reader, the Design handoff), which is also how the controller's
 * tests run without a browser.
 *
 * Three rules every implementation keeps:
 *
 * 1. **Every edit is one transaction.** A group apply, Accept all suggestions, an
 *    undo and a redo each write the plan once under the revision rule, and each is
 *    one step on the undo history. A refused write changes nothing the view shows.
 * 2. **The Proposed pane shows what the person will get.** The preview compiles with
 *    every proposal applied, including the ones flagged for attention. Open in Design
 *    compiles only accepted proposals and the person's own decisions, and is refused
 *    with `unreviewed` while any proposal still waits for an answer; Accept all
 *    suggestions is the named, undoable way to answer the rest at once. So what opens
 *    in Design is what the Proposed pane showed.
 * 3. **Background work never overwrites a person.** A stage result for an older plan
 *    revision is dropped, and a late preview only replaces an older one.
 *
 * Four more behaviours the commands below keep:
 *
 * - **A second Open in Design never overwrites the first.** Every Open in Design opens a
 *   new Design document beside the ones before it, named with its revision, and
 *   `compileDiff` says what the plan change altered between the last compile and this
 *   one. The project lists every document it opened (`designSessionIds`); the report
 *   shows them newest first. Merging edits made in an earlier document is not done here.
 * - **A newer version of a deck joins its lineage.** `openNewerVersion` reads the new
 *   file into a new project with the same `lineageId` and runs the first pass with the
 *   open plan as `previous`, so the engine's carry-forward decides which decisions
 *   travel. `versions` lists the other stored versions, so the old one stays reachable.
 * - **A preset is one undoable step.** `applyPreset` runs the first pass again with the
 *   preset over the plan in hand; the person's own decisions carry across and undo puts
 *   the whole plan back. `savePreset` writes the personal layer only.
 * - **Several decks are one job.** `startMany` reads them one after another under a single
 *   job, one project each; the first opens for review when it is ready and `batch` lists
 *   the rest with their state.
 *
 * The commands added for these are optional in the type, so a stub written before them
 * still satisfies the contract; `controller.ts` implements every one.
 */
import type { RebrandDesignSystemInputV1, RenovationPresetV1 } from '@lolly/engine';
import type {
  ArchetypeRefV1,
  CompiledDeckV1,
  DeckCensusV1,
  DeckThemeV1,
  PlanActionV1,
  ProjectStageV1,
  RebrandErrorCodeV1,
  RenovationPlanV1,
  RenovationProjectV1,
  ReplacementV1,
  SlideArrangementV1,
  SlideGroundV1,
  SourceDeckV1,
} from '@lolly-tools/core/rebrand-v1';
import type { JobHandle, StartJobOpts } from '../jobs.ts';
import type { CompileDiffV1 } from './compile-diff.ts';
import type { OpenCompiledDeckV1 } from './design-handoff.ts';
import type { WebRenovationProjectStore } from './project-store.ts';
import type { RebrandPresetEntryV1 } from './presets.ts';
import type { ReadinessItemV1 } from './readiness.ts';

// ─── state ───────────────────────────────────────────────────────────────────

/** Renovate the layout (mode C), or keep the design and swap the design system (mode A). */
export type RebrandModeV1 = 'renovate' | 'keep-design';

/**
 * The open project's progress through the journey.
 *
 * `idle` is the intake (no project open). `reading` is stage 1. `analysing` covers the
 * census and the first pass. `review` is a plan the person can work on; a preview
 * recompiling in the background does not leave it. `opening` is the compile for Design
 * and the handoff. `failed` is a stage that stopped; `error` says which and why.
 */
export type RebrandPhaseV1 = 'idle' | 'reading' | 'analysing' | 'review' | 'opening' | 'failed';

/** The step a progress line names. The view turns it into "Reading slide 8 of 40". */
export type RebrandStepV1 = 'read' | 'census' | 'plan' | 'preview' | 'compile' | 'handoff' | 'keep-design';

/** Counts, never an invented percentage. `total` absent means the end is not known yet. */
export interface RebrandProgressV1 {
  step: RebrandStepV1;
  done?: number;
  total?: number;
}

/** A failure the view can name. `message` is plain English for a log; the view shows copy by `code`. */
export interface RebrandErrorV1 {
  code: RebrandErrorCodeV1 | 'cancelled' | 'unsupported-file' | 'no-design-system' | 'stage-failed';
  message: string;
  step?: RebrandStepV1;
}

/**
 * Whether the person's work is on the device. `saved` appears only after a write
 * succeeded. `held` keeps the work in memory after a quota refusal and the view offers
 * a `.lolly` download. `stale` means another tab moved the project on; the view offers
 * a reload.
 */
export type RebrandSaveStateV1 =
  | { kind: 'none' }
  | { kind: 'saving' }
  | { kind: 'saved'; revision: number }
  | { kind: 'held'; reason: 'quota' }
  | { kind: 'stale' };

/**
 * What one undo or redo step did, so a button can say "Undo remove 18 objects".
 * `arrangement` is `setArrangement` (how slides are built), `auto-match` is Auto-match,
 * `theme` and `ground` are the deck theme and a slide's own background, `text` is a
 * corrected text and `reset` is "Undo my changes to this slide".
 */
export interface RebrandHistoryLabelV1 {
  kind:
    | 'decide'
    | 'accept'
    | 'include'
    | 'exclude'
    | 'move'
    | 'layout'
    | 'colour'
    | 'font'
    | 'shuffle'
    | 'preset'
    | 'arrangement'
    | 'auto-match'
    | 'theme'
    | 'ground'
    | 'text'
    | 'reset';
  /** The action a `decide` step applied. */
  action?: PlanActionV1;
  /** Objects, slides, colour uses or fonts the step touched. */
  count: number;
}

export interface RebrandHistoryV1 {
  canUndo: boolean;
  canRedo: boolean;
  undo?: RebrandHistoryLabelV1;
  redo?: RebrandHistoryLabelV1;
}

/** The design system the renovation targets, as the top bar and the readiness panel show it. */
export interface RebrandDesignSystemInfoV1 {
  id: string;
  name: string;
  /** True when the design system ships no slide master and the neutral one stands in. */
  neutralMaster: boolean;
  /** True when at least one logo variant resolved. */
  hasLogo: boolean;
  /** The archetypes the master offers, in its own order: what a layout override can pick. */
  archetypes: ArchetypeRefV1[];
  /** The design system's colours, path to hex, for the colour section's choices. */
  colors: Record<string, string>;
  /** The design system's faces, for the font section's choices. */
  fonts: string[];
  /**
   * The design system's own two faces: `brand` for every text of a proposed slide and
   * `mono` for runs the source marked as code (close-out 9.2). Absent when the design
   * system names none, and then a proposed drawing takes the first of `fonts`.
   */
  faces?: { brand?: string; mono?: string };
}

/** The Proposed pane's deck and the plan revision it was compiled from. */
export interface RebrandPreviewV1 {
  deck: CompiledDeckV1;
  planRevision: number;
}

/** Mode A: the surgical patch of the original file, and its faithful preview. */
export interface KeepDesignStateV1 {
  status: 'idle' | 'working' | 'ready' | 'failed';
  /** Faithful frames of the patched file, for the after pane. Same geometry as the original. */
  preview?: CompiledDeckV1;
  /** What the patch changed, for the one-line summary. */
  changes?: { themeSlots: number; colours: number; fonts: Array<{ from: string; to: string }> };
  /**
   * Why the patch stopped, as a code the view has copy for (`KeepFailureCodeV1` in
   * `controller.ts`: `keep.no-patcher`, `keep.no-source`, `keep.no-system`,
   * `keep.not-a-deck`, `keep.failed`), never an English sentence.
   */
  error?: string;
}

export interface RebrandStateV1 {
  phase: RebrandPhaseV1;
  mode: RebrandModeV1;
  progress: RebrandProgressV1 | null;
  error: RebrandErrorV1 | null;
  project: RenovationProjectV1 | null;
  source: SourceDeckV1 | null;
  census: DeckCensusV1 | null;
  plan: RenovationPlanV1 | null;
  /** The Original pane: `compileFaithful` over the source, so both panes share one renderer. */
  faithful: CompiledDeckV1 | null;
  /** The Proposed pane. */
  preview: RebrandPreviewV1 | null;
  /** True while the preview is older than the plan: the pane keeps it and says "Updating". */
  previewStale: boolean;
  designSystem: RebrandDesignSystemInfoV1 | null;
  save: RebrandSaveStateV1;
  history: RebrandHistoryV1;
  keep: KeepDesignStateV1;
  /** What this deck needs that the device may not have. Empty for an editable pptx. */
  readiness: ReadinessItemV1[];
  /** Bumped on every change, so a module can skip a redraw when nothing moved. */
  tick: number;
  /**
   * The other stored versions of this deck (same `lineageId`), newest first. Absent or
   * empty when this is the only one.
   */
  versions?: RebrandProjectSummaryV1[];
  /**
   * What the last Open in Design changed against the compile before it, for the report.
   * Null after a first compile, absent before the first compile in this tab.
   */
  compileDiff?: CompileDiffV1 | null;
  /** The decks of a multi-file read, in the order they were picked. Absent when there is none. */
  batch?: RebrandBatchRowV1[];
  /** The preset the next read applies, as the intake chose it. Absent means none. */
  nextPresetId?: string;
  /**
   * False from the moment the design system is read until its faces are loaded on this
   * device (close-out 9.2), so the Proposed pane draws once in the real face rather than
   * in a fallback that swaps. Absent or true means draw.
   */
  fontsReady?: boolean;
  /**
   * The job that read the open deck, once it finished: `dismiss` takes its toast off the
   * screen, for the view to call a few seconds after it said the deck is read (close-out
   * section 2.1). Absent while no read finished in this session.
   */
  finishedJob?: RebrandFinishedJobV1;
  /**
   * The open deck's chart labels that were drawn as glyph outlines (close-out 9.3): how
   * many stayed drawn, and how many the last reading in this tab wrote as text. Absent
   * when the deck has none.
   */
  vectorLabels?: RebrandVectorLabelsV1;
}

/** Outlined chart labels over a deck's drawings, as one reading counts them. */
export interface RebrandVectorLabelCountsV1 {
  /** Label runs found in the drawings that stay editable. */
  runs: number;
  /** Runs written as text. */
  text: number;
  /** Runs that stayed drawn. */
  drawn: number;
  /** Whether a recogniser read them. False: the text model was not on the device. */
  read: boolean;
}

/** The open deck's outlined chart labels, for the view to say how many stayed drawn. */
export interface RebrandVectorLabelsV1 {
  /** Labels still drawn as outlines in the deck in hand. */
  drawn: number;
  /** Labels the last reading in this tab wrote as text. Absent for a deck opened from the store. */
  text?: number;
  /**
   * True once a recogniser has been over these labels, so the ones still drawn read
   * below the confidence floor. False: the text model is not on the device yet, and
   * `readVectorLabels` offers it in place.
   */
  read: boolean;
}

/** What reading a stored deck's outlined labels came to. */
export type RebrandVectorLabelReadV1 =
  | { ok: true; source: SourceDeckV1; summary: RebrandVectorLabelCountsV1 }
  | { ok: false; reason: 'no-reader' | 'model-missing' };

/** A finished job whose toast the view may take down. */
export interface RebrandFinishedJobV1 {
  dismiss(): void;
}

/** One deck of a multi-file read, as the intake lists it. */
export interface RebrandBatchRowV1 {
  /** Position in the pick, stable for the life of the batch. */
  index: number;
  name: string;
  state: 'waiting' | 'reading' | 'ready' | 'failed';
  /** Set once the deck has a project on this device. */
  projectId?: string;
  /** Why the deck failed, as a code the intake has copy for. */
  error?: RebrandErrorV1['code'];
}

/** A preset the intake and the project menu offer. */
export interface RebrandPresetSummaryV1 {
  id: string;
  name: string;
  description?: string;
  /** `pack` is the design system's; `personal` is one the person saved. */
  origin: 'pack' | 'personal';
}

/** What Save as my preset did. */
export interface RebrandPresetSaveOutcomeV1 {
  ok: boolean;
  id?: string;
  refusal?: 'no-plan' | 'no-store' | 'failed';
}

// ─── commands ────────────────────────────────────────────────────────────────

/** A renovation project on this device, for the intake's reopen list. */
export interface RebrandProjectSummaryV1 {
  id: string;
  name: string;
  sourceName?: string;
  slides?: number;
  /** Where the project is: a project whose plan is written reads `review`. */
  stage: ProjectStageV1;
  updatedAt?: string;
  /**
   * The first proposed slide drawn small (`RenovationProjectV1.thumbSvg`), a standalone
   * SVG string of at most 16 KB. Absent when none was stored; a list then draws the
   * layout's wireframe.
   */
  thumbSvg?: string;
}

/** What an edit did. A refusal leaves the plan and the history as they were. */
export interface RebrandEditOutcomeV1 {
  ok: boolean;
  touched: number;
  /** Members a group apply left alone because they were locked or already decided differently. */
  skipped: number;
  /** `not-built` answers a command this build declares but does not carry out yet (plan 275). */
  refusal?: 'no-plan' | 'busy' | 'stale-revision' | 'quota' | 'nothing-to-do' | 'not-built';
}

export interface RebrandDecideInputV1 {
  objectIds: string[];
  action: PlanActionV1;
  replacement?: ReplacementV1;
  /** The queue item a group apply came from, recorded on every row it touched. */
  scope?: string;
  /** Include members a person already decided differently. Off unless asked for by name. */
  includeCorrected?: boolean;
}

/** Why Open in Design did not open, or what it opened. */
export interface RebrandOpenOutcomeV1 {
  ok: boolean;
  /** What changed against the compile before this one. Absent on a first compile. */
  changes?: CompileDiffV1;
  reason?: 'no-plan' | 'busy' | 'unreviewed' | 'cancelled' | 'compile-failed' | 'handoff-failed' | 'stale-revision';
  /** Proposals still waiting for an answer (unreviewed or flagged), when the reason is `unreviewed`. */
  pending?: number;
  sessionId?: string;
  warnings: string[];
  /**
   * The `.lolly` file saved on this device before a document too large for Design's
   * automatic history was handed over (close-out decision 10), by its file name, so the
   * outcome can say where the person's copy is. Absent when nothing needed saving.
   */
  savedAs?: string;
}

export interface RebrandDownloadV1 {
  blob: Blob;
  filename: string;
}

export interface RebrandControllerV1 {
  getState(): RebrandStateV1;
  /** Called with the new state after every change. Returns the unsubscribe. */
  subscribe(listener: (state: RebrandStateV1) => void): () => void;

  /** Read a file into a new project, then run the census and the first pass. */
  start(file: File): Promise<void>;
  /**
   * Read several decks one after another under one job, one project each. The first
   * opens for review when it is ready; `batch` lists every one with its state. One file
   * is the same as `start`.
   */
  startMany?(files: File[]): Promise<void>;
  /**
   * Read a newer version of the open deck into the same lineage: a new project whose
   * first pass carries the open plan's decisions where the object matched. The open
   * project stays stored and is listed in `versions`.
   */
  openNewerVersion?(file: File): Promise<void>;
  /** The presets on offer: the design system's, then the person's own. */
  presets?(): Promise<RebrandPresetSummaryV1[]>;
  /** The preset the next read applies (the intake's choice). Null clears it. */
  choosePreset?(presetId: string | null): void;
  /**
   * Run the first pass again with this preset over the plan in hand, the person's
   * decisions carried across, as one undoable step. Null runs it with no preset.
   */
  applyPreset?(presetId: string | null): Promise<RebrandEditOutcomeV1>;
  /** Write the decisions on the open plan as a personal preset under this name. */
  savePreset?(name: string): Promise<RebrandPresetSaveOutcomeV1>;
  /** Check again what the deck needs, after a model was downloaded in place. */
  refreshReadiness?(): Promise<void>;
  /** Open a stored project and resume from its checkpoint. */
  open(projectId: string): Promise<void>;
  /** Projects on this device, newest first. */
  recent(): Promise<RebrandProjectSummaryV1[]>;
  /** Delete a stored project, its parts and bytes nothing else references. */
  remove(projectId: string): Promise<void>;
  /** Back to the intake. The project stays stored. */
  close(): void;

  decide(input: RebrandDecideInputV1): Promise<RebrandEditOutcomeV1>;
  /**
   * Accept every proposal still waiting as proposed, flagged ones included: the named,
   * undoable answer to the whole queue. Rows a person decided and locked rows stay.
   */
  acceptSuggestions(): Promise<RebrandEditOutcomeV1>;
  include(slideIds: string[], include: boolean): Promise<RebrandEditOutcomeV1>;
  /** Move a slide earlier (negative) or later (positive) among the included slides. */
  move(slideId: string, delta: number): Promise<RebrandEditOutcomeV1>;
  /**
   * A new layout for these slides, as one undoable step. The changed slides compile
   * alone first and their frames go into the Proposed pane at once, still marked as
   * updating, before the whole deck compiles again (plan 275 decision 31).
   */
  setLayout(slideIds: string[], layout: ArchetypeRefV1): Promise<RebrandEditOutcomeV1>;
  /**
   * Move these slides to the start or the end of the included slides, keeping their
   * order among themselves, as one undoable step (plan 275 section 5.1).
   */
  moveTo?(slideIds: string[], to: 'start' | 'end'): Promise<RebrandEditOutcomeV1>;
  /**
   * Move these slides so the first of them sits at `toIndex` among the included
   * slides, keeping their order among themselves, as one undoable step: the drop of a
   * multi-slide drag at a gap in the filmstrip (plan 275 sections 5.2 and 5.5).
   * `toIndex` counts the slides that stay, and clamps to the ends.
   */
  moveSlides?(slideIds: string[], toIndex: number): Promise<RebrandEditOutcomeV1>;
  /**
   * A copy of each slide placed after it: a new slide plan row on the same source slide,
   * its layout and decisions copied, as one undoable step. Answers `not-built`: a slide
   * plan row is found by its source slide's id, so a copy needs a field that names the
   * source slide it draws (and its own object row ids), which the plan contract does
   * not have yet.
   */
  duplicateSlide?(slideIds: string[]): Promise<RebrandEditOutcomeV1>;
  /**
   * Undo the person's changes to these slides: the first pass runs again over the same
   * source, preset and seed, and each slide takes back its proposed layout, its proposed
   * rows (locked rows stay) and loses its own background and the memory of those rows,
   * as one undoable step.
   */
  resetSlide?(slideIds: string[]): Promise<RebrandEditOutcomeV1>;
  /** The deck theme (plan 275 section 6), null for the master as shipped. Answers `not-built` until it is built. */
  setTheme?(theme: DeckThemeV1 | null): Promise<RebrandEditOutcomeV1>;
  /** These slides' own background, null for the deck theme's. Answers `not-built` until it is built. */
  setGround?(slideIds: string[], ground: SlideGroundV1 | null): Promise<RebrandEditOutcomeV1>;
  /**
   * Read the text in the pictures of the flattened slides with the on-device text
   * reader, offered in place when it is not installed: the web half of plan 274
   * milestone 5. Answers `not-built` when the shell passes no
   * `RebrandSlidePictureDepsV1`, and `nothing-to-do` when no slide is a picture or the
   * offer is declined.
   */
  readSlidePictures?(slideIds?: string[]): Promise<RebrandEditOutcomeV1>;
  /**
   * Read the chart labels the deck's drawings hold as glyph outlines as text
   * (close-out 9.3), offering the text recognition model in place first when it is not
   * on the device. One job; the plan is made again over the read deck as for the slide
   * pictures. `touched` counts labels written as text and `skipped` the ones that stayed
   * drawn. Answers `nothing-to-do` when no label is drawn or the offer is declined, and
   * `not-built` when the shell passes no `readVectorLabels` dep.
   */
  readVectorLabels?(): Promise<RebrandEditOutcomeV1>;
  /**
   * Auto-match (plan 275 decision 28): apply the matcher's layout to every included
   * slide at once, as one undoable step, never over a layout a person chose. `bands`
   * is how sure a match must be: `clear`, `likely` (the web default) or `all`.
   * Answers `not-built` until it is built.
   */
  autoMatchLayouts?(bands?: 'clear' | 'likely' | 'all', slideIds?: string[]): Promise<RebrandEditOutcomeV1>;
  /**
   * Correct an object's text (plan 275 decision 29: OCR text on a rebuilt slide, or any
   * text read wrongly), as one undoable step; `null` restores the text as read. It
   * writes `ObjectPlanV1.textOverride`; a locked row is passed over.
   */
  setObjectText?(objectId: string, text: string | null): Promise<RebrandEditOutcomeV1>;
  /**
   * How these slides are built (plan 275 section 4): `layout` pours into the slide's
   * layout, `original` keeps the source placement restyled, `picture` keeps the slide
   * as it was (its recovery picture when it has one). One undoable step; the layout
   * choice is kept so switching back restores it. Left undefined until it is built.
   */
  setArrangement?(slideIds: string[], arrangement: SlideArrangementV1): Promise<RebrandEditOutcomeV1>;
  /** `null` clears the person's choice for these uses and lets the solver decide again. */
  setColour(useIds: string[], target: { hex: string; path?: string } | null, lock?: boolean): Promise<RebrandEditOutcomeV1>;
  setFont(from: string, to: string, toPath?: string): Promise<RebrandEditOutcomeV1>;
  /** Re-run the colour assignment from a new stored seed, locked rows fixed. */
  shuffleColours(): Promise<RebrandEditOutcomeV1>;
  undo(): Promise<RebrandEditOutcomeV1>;
  redo(): Promise<RebrandEditOutcomeV1>;

  /**
   * Compile with accepted decisions and open the result in Design as artboards.
   * `focusSlideId` opens the whole document with the view on that slide's own frame
   * (plan 275 section 5.1); a slide with no frame opens Design as it always has.
   */
  openInDesign(opts?: { focusSlideId?: string }): Promise<RebrandOpenOutcomeV1>;
  /** The whole project as a `.lolly` file, at any point. Null when nothing is open. */
  downloadProject(): Promise<RebrandDownloadV1 | null>;

  setMode(mode: RebrandModeV1): Promise<void>;
  /** Mode A's result: the original file with the design system's theme, colours and fonts. */
  keepDesignDownload(): Promise<RebrandDownloadV1 | null>;

  /** A drawable URL for a stored picture, once loaded. Undefined until then; a state change follows. */
  mediaHref(ref: string): string | undefined;
  /**
   * Stop the step the person is watching (the open deck's read, Keep the design).
   * Committed decisions stay, and the other decks of a multi-file read carry on.
   */
  cancel(): void;
  /** Stop the decks of a multi-file read that are not read yet. */
  cancelBatch?(): void;
  /** Reload the project from the store, after a stale-revision refusal. */
  reload(): Promise<void>;
  /**
   * While `quiet` answers true, the job that reads a deck shows no toast (the view is
   * showing the reading itself: the intake's frames row, close-out section 2.1). The
   * view sets it on mount and clears it with null when it leaves, and the toast
   * appears from then on for a read that is still running.
   */
  quietJobsWhile?(quiet: (() => boolean) | null): void;
  dispose(): void;
}

// ─── what the controller is built from ───────────────────────────────────────

/** A job as the controller asks for one: the registry's options, and when to keep its toast off. */
export interface RebrandJobOptsV1 extends StartJobOpts {
  /** While this answers true the job shows no toast; it shows once it answers false. */
  quietWhile?: () => boolean;
}

/** The handle the work gets: the registry's, and a way to take the finished toast down. */
export interface RebrandJobHandleV1 extends JobHandle {
  /** Take this job's toast off the screen once it finished. Nothing happens when none shows. */
  dismiss?(): void;
}

/** `runJob` as the controller calls it (the web shell's is `runJobOverHeavySlot` in `deps.ts`). */
export type RebrandRunJobV1 = <T>(
  opts: RebrandJobOptsV1,
  work: (handle: RebrandJobHandleV1) => Promise<T> | T,
) => Promise<T | undefined>;

/** The stages that run in the shell-owned worker (`stages.ts` registers them). */
export type RebrandStageNameV1 = 'rebrand.census' | 'rebrand.plan' | 'rebrand.compile' | 'rebrand.faithful';

export interface CensusStageInputV1 {
  source: SourceDeckV1;
}

export interface PlanStageInputV1 {
  source: SourceDeckV1;
  census: DeckCensusV1;
  system: RebrandDesignSystemInputV1;
  preset?: RenovationPresetV1;
  /** The plan this one supersedes; its decisions carry forward where they match. */
  previous?: RenovationPlanV1;
  seed?: number;
}

export interface CompileStageInputV1 {
  source: SourceDeckV1;
  census?: DeckCensusV1;
  plan: RenovationPlanV1;
  system: RebrandDesignSystemInputV1;
  /** True for the preview, false for Open in Design. */
  applyUnreviewed: boolean;
  /** True for the preview, so a proposal flagged for attention shows as proposed. False for Open in Design. */
  applyNeedsAttention: boolean;
}

export interface FaithfulStageInputV1 {
  source: SourceDeckV1;
}

/** Parts a `.lolly` download takes from memory instead of the store. */
export interface RebrandPackPartsV1 {
  sourceDeck?: SourceDeckV1;
  census?: DeckCensusV1;
  plan?: RenovationPlanV1;
  compiled?: CompiledDeckV1;
}

export interface RebrandIngestInputV1 {
  file: File;
  signal: AbortSignal;
  /**
   * The lineage a newer version of a deck joins. Absent for a first read, whose
   * lineage is its own content hash.
   */
  lineageId?: string;
  /** Slides read so far, of the total. */
  onProgress: (done: number, total: number) => void;
}

export interface RebrandIngestResultV1 {
  project: RenovationProjectV1;
  source: SourceDeckV1;
  /**
   * The chart labels the read found drawn as glyph outlines, how many became text and
   * how many stayed drawn (close-out 9.3). Absent: the reader did not count them.
   */
  vectorLabels?: RebrandVectorLabelCountsV1;
}

export interface RebrandResolvedSystemV1 {
  input: RebrandDesignSystemInputV1;
  info: RebrandDesignSystemInfoV1;
}

export interface KeepDesignResultV1 {
  bytes: Uint8Array;
  preview: CompiledDeckV1;
  changes: NonNullable<KeepDesignStateV1['changes']>;
}

/**
 * What reading the slide pictures needs from the shell (plan 274 section 6). Both are
 * optional members of `RebrandControllerDepsV1`: a shell that passes neither answers
 * `readSlidePictures` with `not-built`.
 */
export interface RebrandSlidePictureDepsV1 {
  /**
   * The text recognition model on this device, offered in place when it is not (the
   * web shell's `ensureModel("ocr")`). Resolves true once it is ready. `purpose` names
   * what the reading is for in the offer's words: slide pictures (the default) or a
   * chart's outlined labels.
   */
  ensureTextReading(purpose?: 'pictures' | 'labels'): Promise<boolean>;
  /**
   * Rebuild the slides of `source` that are still one picture of a whole slide (those
   * in `slideIds`), reading their text on the device. Progress in slides; the signal
   * stops it between slides and between regions.
   */
  rebuildSlidePictures(input: {
    source: SourceDeckV1;
    slideIds: string[];
    signal: AbortSignal;
    onProgress: (done: number, total: number) => void;
  }): Promise<{ source: SourceDeckV1; rebuilt: number; kept: number }>;
}

export interface RebrandControllerDepsV1 extends Partial<RebrandSlidePictureDepsV1> {
  store: WebRenovationProjectStore;
  /** Stage 1 on the main thread: it needs the XML parser and the upload store. */
  ingest(input: RebrandIngestInputV1): Promise<RebrandIngestResultV1>;
  /** One registered stage, in the worker or in place. Rejects on cancel, failure or a stale tag. */
  runStage<I, O>(
    stage: RebrandStageNameV1,
    input: I,
    tag: { projectId: string; planRevision?: number },
    signal: AbortSignal,
  ): Promise<O>;
  /** The active design system, or null when none can be read. */
  resolveDesignSystem(): Promise<RebrandResolvedSystemV1 | null>;
  /** Readiness rows for this deck (never downloads anything). */
  readiness(source: SourceDeckV1, census: DeckCensusV1 | null): Promise<ReadinessItemV1[]>;
  /** A drawable URL for a stored picture; the controller caches and releases it. */
  mediaUrl(ref: string): Promise<string | undefined>;
  releaseMediaUrl(url: string): void;
  /** The retained source bytes, or null when they were not retained. */
  sourceBytes(project: RenovationProjectV1): Promise<Uint8Array | null>;
  /**
   * Build the project's `.lolly` file from the record and its parts. `held` carries
   * parts kept in memory after a quota refusal; each one given is used in place of
   * the stored copy.
   */
  packProject(project: RenovationProjectV1, held?: RebrandPackPartsV1): Promise<RebrandDownloadV1>;
  /** Open Design and lay the compiled pages down (`design-handoff.ts` does the rest). */
  design: Pick<OpenCompiledDeckV1, 'navigate' | 'importer'>;
  /** Mode A. Absent where the shell has no `host.pptx`. */
  keepDesign?(input: { bytes: Uint8Array; system: RebrandDesignSystemInputV1; signal: AbortSignal }): Promise<KeepDesignResultV1>;
  /**
   * The job toast. The controller wraps each long stage in one job so leaving the view
   * keeps it running. `quietWhile` keeps the toast off while it answers true, and the
   * handle's `dismiss` takes a finished job's toast down.
   */
  runJob: RebrandRunJobV1;
  /**
   * Load the design system's faces on this device before the first proposed drawing
   * (close-out 9.2): the faces the brand editor installs and the ones the catalog
   * ships. Resolves when they are ready or when waiting longer would only delay the
   * drawing; never rejects. Absent: nothing is waited for.
   */
  loadFaces?(families: string[]): Promise<void>;
  /**
   * Keep a `.lolly` file on this device, for a document too large for Design's
   * automatic history (close-out decision 10). Answers the name it was kept under, or
   * null when it could not be kept. Absent: nothing is kept.
   */
  saveProjectFile?(file: RebrandDownloadV1): Promise<{ name: string } | null>;
  /** Delay for coalescing preview compiles after an edit, in ms. Tests pass 0. */
  previewDelayMs?: number;
  /** The presets on offer and the personal layer. Absent: no presets are offered. */
  presets?: {
    list(): Promise<RebrandPresetEntryV1[]>;
    savePersonal(preset: RenovationPresetV1, name: string): Promise<RebrandPresetEntryV1>;
  };
  /**
   * Hold the in-place model offer back while a deck is read, so no download sheet opens
   * over a running import (`holdModelOffers` in `lib/model-offer.ts`). Returns the release.
   */
  holdOffers?(): () => void;
  /**
   * Read the outlined chart labels of a deck read before the text model was on the
   * device (`readVectorLabelsIn` in `ingest.ts`). Never downloads: without the model it
   * answers `model-missing`, and the controller offers the model through
   * `ensureTextReading` when the person asked. Absent: labels stay drawn.
   */
  readVectorLabels?(input: {
    source: SourceDeckV1;
    signal: AbortSignal;
    onProgress: (done: number, total: number) => void;
  }): Promise<RebrandVectorLabelReadV1>;
}
