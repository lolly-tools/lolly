// SPDX-License-Identifier: MPL-2.0
/**
 * The four renovation stages the shell-owned worker runs (plan 274 sections 3.2 to 3.4):
 * `rebrand.census`, `rebrand.plan`, `rebrand.compile` and `rebrand.faithful`.
 *
 * Each one is a pure call into the engine over the plain JSON its input type in
 * `controller-api.ts` names, so a stage gives the same answer in the worker and in the
 * runner's in-realm fallback. The design system arrives as `RebrandDesignSystemInputV1`
 * and is resolved here, on the side that runs the stage, because the resolved form
 * holds a token resolver closure that cannot cross a message.
 *
 * `rebrand.compile` also answers the deck theme popover's one preview request
 * (`ThemeTileRequestV1`): the plan under another theme, solved as `setTheme` solves it,
 * compiled for the deck's first slide alone.
 *
 * `ctx.throwIfCancelled()` runs between steps. The engine calls are single synchronous
 * passes, so a cancel takes effect before the next step starts rather than inside one.
 *
 * A plan records how its source was read, as the node pipeline records it
 * (`pipelineAlgorithms` there): a deck with slides that are pictures of slides adds
 * `+keep`, `+rebuild` or `+rebuild/ocr:<model>` after the reader's version
 * (`readerAlgorithm`), so `flattenedReadOfPlan` on the terminal reads a web plan the
 * same way and a compile there reads the same objects again.
 *
 * Registered in `stages.ts` and nowhere else. Nothing on the main thread imports this
 * file at module scope: the worker entry loads `stages.ts`, and the runner reaches it by
 * a dynamic import only when a realm has no Worker. The engine modules come in by deep
 * path rather than through the barrel, so the worker chunk carries these stages and not
 * the whole engine.
 */
import type { CompiledDeckV1, DeckCensusV1, RenovationPlanV1, SourceDeckV1 } from '@lolly-tools/core';
import type { DeckThemeV1 } from '@lolly-tools/core/rebrand-v1';
import { censusDeck } from '../../../../../engine/src/deck-census.ts';
import { CENSUS_RULES } from '../../../../../engine/src/deck-census-rules.ts';
import { compileFaithful, compileRenovated, compileSystemOpts } from '../../../../../engine/src/deck-compile.ts';
import { withAutoMatchEntries } from '../../../../../engine/src/rebrand-structure.ts';
import { resolveRebrandDesignSystem } from '../../../../../engine/src/rebrand-design-system.ts';
import { PLAN_RULES, firstPass, type FirstPassInputV1 } from '../../../../../engine/src/rebrand-plan.ts';
import { setDeckTheme, type ThemeSolveContextV1 } from '../../../../../engine/src/rebrand-theme.ts';
import type {
  CensusStageInputV1,
  CompileStageInputV1,
  FaithfulStageInputV1,
  PlanStageInputV1,
  RebrandStageNameV1,
} from './controller-api.ts';
import type { StageFnV1 } from './stage-core.ts';

/** The registered names, one per stage function below. */
export const REBRAND_STAGE_NAMES: readonly RebrandStageNameV1[] = [
  'rebrand.census',
  'rebrand.plan',
  'rebrand.compile',
  'rebrand.faithful',
];

/** The schema's limit on each algorithm version string. */
const ALGORITHM_VERSION_MAX = 64;
/** The model a PDF's own text layer records as its reading: not a recogniser that ran. */
const TEXT_LAYER_MODEL = 'pdf-text-layer';

/** The mark `rebuildSlidePictures` leaves on a rebuilt deck's reader version: text recognition, and its model. */
const REBUILD_MARK = /\+rebuild(\/ocr(?::(.+))?)?$/;

/**
 * The reader a plan records: the source's reader and version, and for a deck with
 * slides that are pictures of slides, how they were read. None rebuilt is `+keep`;
 * rebuilt with text recognition is `+rebuild/ocr:<model>` (the model left off when the
 * whole string would pass the schema's 64 characters); rebuilt without is `+rebuild`.
 *
 * Whether text recognition ran comes from the mark the rebuild left on the reader
 * version, as the node pipeline records it whenever a recogniser was passed: a slide's
 * own reading names no model when the recogniser found nothing somewhere. A deck
 * rebuilt before that mark existed is read from its slides.
 */
export function readerAlgorithm(source: SourceDeckV1): string {
  const mark = REBUILD_MARK.exec(source.reader.version);
  const version = mark ? source.reader.version.slice(0, mark.index) : source.reader.version;
  const base = `${source.reader.name}/${version}`;
  const flattened = source.slides.filter((slide) => slide.origin.flattened === true);
  if (flattened.length === 0) return base;
  const rebuilt = flattened.filter((slide) => slide.recovery !== undefined);
  if (rebuilt.length === 0) return `${base}+keep`;
  const ocr = mark ? mark[1] !== undefined : undefined;
  const model = mark
    ? mark[2]
    : rebuilt
      .map((slide) => (slide.ocr && 'model' in slide.ocr ? slide.ocr.model : undefined))
      .find((one) => typeof one === 'string' && one !== TEXT_LAYER_MODEL);
  if (ocr === false || (ocr === undefined && !model)) return `${base}+rebuild`;
  const named = model ? `+rebuild/ocr:${model}` : '+rebuild/ocr';
  return base.length + named.length <= ALGORITHM_VERSION_MAX ? `${base}${named}` : `${base}+rebuild/ocr`;
}

/** Stage 2: origin, class hypothesis and evidence for every source object. */
export const censusStage: StageFnV1<CensusStageInputV1, DeckCensusV1> = (input, ctx) => {
  ctx.throwIfCancelled();
  const census = censusDeck(input.source);
  ctx.throwIfCancelled();
  return census;
};

/**
 * Stage 3: the first pass. The algorithm versions come from the reader the source names
 * and the rule sets this build runs, so a plan records what produced it. A previous plan,
 * a preset and a seed pass straight through; the engine decides what carries forward.
 */
export const planStage: StageFnV1<PlanStageInputV1, RenovationPlanV1> = async (input, ctx) => {
  ctx.throwIfCancelled();
  const system = await resolveRebrandDesignSystem(input.system);
  ctx.throwIfCancelled();
  const pass: FirstPassInputV1 = {
    source: input.source,
    census: input.census,
    designSystem: system.firstPass,
    algorithms: {
      reader: readerAlgorithm(input.source),
      census: CENSUS_RULES.version,
      plan: PLAN_RULES.version,
    },
  };
  if (input.preset !== undefined) pass.preset = input.preset;
  if (input.previous !== undefined) pass.previous = input.previous;
  if (input.seed !== undefined) pass.seed = input.seed;
  // A look theme `previous` carries is kept with the looks and the lock the input
  // states, as the node pipeline keeps it (`themeFactsOf` there).
  const { looks, locked } = compileSystemOpts(input.system);
  if (looks) pass.looks = looks;
  if (locked) pass.locked = true;
  const plan = firstPass(pass);
  ctx.throwIfCancelled();
  return plan;
};

/**
 * A theme tile's request (plan 275 close-out CP5c): the deck theme popover draws the
 * first slide under each theme it offers, so it asks the compile for these slides of
 * the plan under another theme. The request rides the `rebrand.compile` stage rather
 * than a stage of its own, so the tiles and the Proposed pane share one registration,
 * one worker chunk and one compile.
 */
export interface ThemeTileRequestV1 {
  tile: {
    /** The theme to draw under, null for the master as shipped (Light). */
    theme: DeckThemeV1 | null;
    /** The slides to draw; every other slide is left out of the compile. */
    slideIds: string[];
  };
}

/** What `rebrand.compile` takes: the pane's input, or a theme tile's request on top of it. */
export type CompileStageRequestV1 = CompileStageInputV1 & Partial<ThemeTileRequestV1>;

/**
 * The plan and source a theme tile compiles: the plan under the tile's theme, with the
 * colours solved again the way `setTheme` solves them (each ground group, a look from the
 * looks the input carries, the lock), a colour a person locked kept at its own hex as the
 * controller keeps it (decision 33c), and then only the tile's slides, in plan and source
 * alike. The solve reads the whole deck before the cut, so a tile draws the colours the
 * applied theme would give that slide.
 */
export function themeTileInput(
  input: CompileStageInputV1 & ThemeTileRequestV1,
): { plan: RenovationPlanV1; source: SourceDeckV1 } {
  const { theme, slideIds } = input.tile;
  const { looks, locked } = compileSystemOpts(input.system);
  const look = theme?.id === 'look' ? looks?.find((one) => one.id === theme.lookId) : undefined;
  const { system } = input;
  const solve: ThemeSolveContextV1 | undefined = input.census
    ? {
      census: input.census,
      source: input.source,
      system: { colors: system.colors, master: system.master, ...(system.darkColors ? { darkColors: system.darkColors } : {}) },
      ...(look ? { look } : {}),
      ...(locked ? { locked: true } : {}),
    }
    : undefined;
  const edited = setDeckTheme(input.plan, theme, solve ? { solve } : { ...(locked ? { locked: true } : {}) }).plan;
  const pinned = new Map(input.plan.colors.filter((row) => row.locked === true && row.to).map((row) => [row.useId, row]));
  const colors = pinned.size > 0 ? edited.colors.map((row) => pinned.get(row.useId) ?? row) : edited.colors;
  const only = new Set(slideIds);
  return {
    plan: { ...edited, colors, slides: edited.slides.filter((slide) => only.has(slide.id)).map((slide) => ({ ...slide, include: true })) },
    source: { ...input.source, slides: input.source.slides.filter((slide) => only.has(slide.id)) },
  };
}

/**
 * Stage 5: the renovated deck. `applyUnreviewed` and `applyNeedsAttention` are true for
 * the Proposed pane, which shows every proposal applied, and false for Open in
 * Design, which the controller refuses until every proposal has an answer; so what
 * opens is what the pane showed.
 */
export const compileStage: StageFnV1<CompileStageRequestV1, CompiledDeckV1> = async (input, ctx) => {
  ctx.throwIfCancelled();
  const system = await resolveRebrandDesignSystem(input.system);
  ctx.throwIfCancelled();
  const { tile } = input;
  const cut = tile ? themeTileInput({ ...input, tile }) : { plan: input.plan, source: input.source };
  ctx.throwIfCancelled();
  const compiled = compileRenovated({
    source: cut.source,
    ...(input.census ? { census: input.census } : {}),
    plan: cut.plan,
    master: system.input.master,
    designSystem: system.compile,
    // The faces, looks and lock the input carries, the node pipeline's options from
    // the same input: a themed plan compiles to the same bytes here, on the CLI and in MCP.
    opts: { ...compileSystemOpts(input.system), applyUnreviewed: input.applyUnreviewed, applyNeedsAttention: input.applyNeedsAttention },
  });
  // The report names each slide Auto-match set, as the CLI and MCP reports do. A tile
  // shows no report, so it skips the work.
  if (!tile) compiled.report = withAutoMatchEntries(compiled.report, input.plan, system.input.master, input.source);
  ctx.throwIfCancelled();
  return compiled;
};

/** The Original pane: the source as it stands, through the same frame model as the proposal. */
export const faithfulStage: StageFnV1<FaithfulStageInputV1, CompiledDeckV1> = (input, ctx) => {
  ctx.throwIfCancelled();
  const compiled = compileFaithful(input.source);
  ctx.throwIfCancelled();
  return compiled;
};
