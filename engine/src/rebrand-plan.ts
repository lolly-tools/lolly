// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation plan's automatic first pass (plan 274 sections 3.3 and 9).
 *
 * A read source deck and its census go in; a `RenovationPlanV1` comes out with
 * a PROPOSAL and a review state for every object, a target archetype for every
 * slide, a colour assignment by use, a font assignment and the logo policy.
 *
 * A proposal is not a decision. Nothing here writes `decision`, except where a
 * previous revision's decision was carried forward on a verified match, and the
 * review state says which rows a person still has to look at. The removals the
 * first pass proposes are the ones the design system's own archetypes bring
 * back (page numbers, dates, ornament); every repeated line with words in it,
 * every citation and every unrecognised mark is a keep or a replace that asks
 * for attention, because repetition says nothing about whether the information
 * is disposable.
 *
 * `layoutFindings` is the hard-finding pass a compile needs before aesthetics:
 * text measured against the role box it would be poured into, and a role whose
 * type size is under the readable floor. Both are estimates from the master's
 * own numbers rather than a shaped measurement, and each entry states that.
 *
 * Pure: no DOM, no clock, no filesystem, no network, no `Math.random`. Ids come
 * back in source order, and a seed is the only source of variation.
 */

import type {
  AlgorithmVersionsV1,
  ArchetypeRefV1,
  ArchetypeRoleV1,
  ArchetypeV1,
  ColorMappingV1,
  DeckCensusV1,
  DeckThemeV1,
  DesignSystemSnapshotV1,
  LayoutFeaturesV1,
  ObjectClassV1,
  ObjectPlanV1,
  PlanActionV1,
  RenovationPlanV1,
  RenovationPresetV1,
  ReplacementV1,
  ReportEntryV1,
  ReviewMessageV1,
  ReviewStateV1,
  SlideMasterV1,
  SlidePlanV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceObjectV1,
} from '@lolly-tools/core';
import { findArchetype, roleFontSize } from '@lolly-tools/core';

import { AVERAGE_GLYPH_EM, ESTIMATE_LINE_HEIGHT, isIncidentalPicture, isNoteText } from './deck-compile.ts';
import { type ArchetypeHintsV1, type CoverageRoleV1, pickArchetype } from './rebrand-archetype.ts';
import { assignColors, type BrandSwatchV1 } from './rebrand-colors.ts';
import { carryForward } from './rebrand-decisions.ts';
import {
  isPlainTheme,
  systemForPlan,
  themeSourceOf,
  type DeckLookV1,
  type ThemeCarryV1,
  type ThemeSourceV1,
} from './rebrand-design-system.ts';
import { mapFonts } from './rebrand-fonts.ts';
import { EARLY_SLIDES, hasQuoteMarks, layoutReadOpts, matchSlideLayout, readRemoved, type SlideLayoutMatchV1 } from './rebrand-structure.ts';
import { reviewMessage } from './rebrand-review.ts';
import { solveThemeColors } from './rebrand-theme.ts';
import { masterBoxToPx } from './slide-master.ts';
import { buildEmbedUrl } from './tool-url.ts';
import { compareCodeUnits } from './rebrand-order.ts';

/** Identity of the first pass, recorded on the plan for replay. */
export const PLAN_RULES = { name: 'rebrand-plan', version: 'plan-2026-09-24.5' } as const;

/**
 * The overflow estimate's own numbers come from `deck-compile.ts` rather than
 * from a second pair here, and `layoutFindings` counts lines the way that
 * module's `estimateTextHeight` does, paragraph by paragraph. The plan's finding
 * and the compile's continuation frames then answer the same question with the
 * same arithmetic, and one tune moves both.
 */
/** Type size at the master's own size under which a role is reported unreadable. */
export const MIN_READABLE_PX = 12;
/** Slides at the start of a deck where a numbered list reads as an agenda (the structure matcher's own figure). */
export { EARLY_SLIDES };
/** Categories and series the chart-tool offer carries, so the offered link stays bounded. */
export const CHART_OFFER_MAX_CATEGORIES = 40;
export const CHART_OFFER_MAX_SERIES = 12;
/** The tool a rebuilt chart would be composed from. */
export const CHART_TOOL_ID = 'chart';

/**
 * A native chart plot this tree can offer to the chart tool, and the chart
 * type that tool would draw. A plot outside this table gets no offer, because
 * an offer nobody can honour is worse than none.
 */
export const SIMPLE_CHART_TYPES: Readonly<Record<string, string>> = {
  barChart: 'bar',
  bar3DChart: 'bar',
  pieChart: 'pie',
  pie3DChart: 'pie',
  lineChart: 'line',
  line3DChart: 'line',
  areaChart: 'area',
  area3DChart: 'area',
  doughnutChart: 'donut',
  scatterChart: 'scatter',
  radarChart: 'radar',
};

// ─── the preset ──────────────────────────────────────────────────────────────

/**
 * A named policy over the first pass. Declared in `@lolly-tools/core` from plan
 * 275 on, so its layout keys (`byStructure`, `bySourceLayoutName`) are part of
 * the contracts; re-exported here so every import of it keeps working.
 */
export type { RenovationPresetV1 } from '@lolly-tools/core';

export interface FirstPassDesignSystemV1 {
  snapshot: DesignSystemSnapshotV1;
  swatches: BrandSwatchV1[];
  fonts: {
    brand: string;
    mono?: string;
    /** Additive to plan 274's sketch: a serif face, when the design system names one. */
    serif?: string;
    availableFamilies?: string[];
  };
  master: SlideMasterV1;
  /**
   * The design system's colour per theme slot name (`accent1`, `dk1`, ...). A
   * source colour that named a slot takes the slot's colour as its first
   * candidate; contrast and distinction can still move it, and only a person's
   * lock is fixed.
   * Additive to plan 274's sketch, which states the rule without a carrier.
   */
  slots?: Record<string, { hex: string; path?: string }>;
}

export interface FirstPassInputV1 {
  source: SourceDeckV1;
  census: DeckCensusV1;
  designSystem: FirstPassDesignSystemV1;
  preset?: RenovationPresetV1;
  /** The plan this one supersedes. Its decisions are carried where they match. */
  previous?: RenovationPlanV1;
  algorithms: AlgorithmVersionsV1;
  /** Seed for the colour solver's candidate order, stored as `shuffleSeed`. */
  seed?: number;
  /** The saved looks a carried `look` theme may name (`RebrandThemeFactsV1`). */
  looks?: DeckLookV1[];
  /** The design system is brand-locked, so a carried look theme is not applied (plan 275 decision 17). */
  locked?: boolean;
}

// ─── the proposal table ──────────────────────────────────────────────────────

interface Proposed {
  proposal: PlanActionV1;
  review: ReviewStateV1;
  replacement?: ReplacementV1;
  role?: ArchetypeRoleV1;
  /** Where the row goes when kept and no role takes it, when the rule says. */
  surplus?: 'continuation' | 'tray';
}

/** Words on an object, used to tell a repeated line with meaning from ornament. */
function wordsOf(object: SourceObjectV1): number {
  const text = (object.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join(' ');
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * RFC 4180 quoting, the same rule as the engine's `csvCell` template helper in
 * `template.ts`, so the offer's data reads like every other CSV this tree
 * writes. That helper is registered with Handlebars rather than exported, which
 * is why the rule is written twice; the carriage return belongs in the class.
 */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The chart tool link a native chart with readable data could be rebuilt from.
 * It is recorded as an offer beside a `keep` proposal and never applied, because
 * a rebuilt chart is an interpretation of the original.
 *
 * The link is minted by `buildEmbedUrl`, which is this tree's one minter for a
 * composed-tool identity: it answers null past the length `parseToolUrl` will
 * read back, so a link nothing can render is never written. A chart wider than
 * that is offered with fewer rows rather than not at all, and a chart that
 * cannot be trimmed far enough is offered nothing.
 */
export function chartToolOffer(object: SourceObjectV1): ReplacementV1 | undefined {
  const data = object.chartData;
  if (!data) return undefined;
  const type = data.type ? SIMPLE_CHART_TYPES[data.type] : undefined;
  if (!type) return undefined;
  const series = (data.series ?? []).slice(0, CHART_OFFER_MAX_SERIES);
  if (series.length === 0) return undefined;
  const categories = (data.categories ?? []).slice(0, CHART_OFFER_MAX_CATEGORIES);
  const rowCount = categories.length > 0
    ? categories.length
    : Math.min(CHART_OFFER_MAX_CATEGORIES, Math.max(...series.map((one) => one.values.length)));
  if (!Number.isFinite(rowCount) || rowCount <= 0) return undefined;

  const header = ['Category', ...series.map((one, i) => one.name ?? `Series ${i + 1}`)];
  const rows: string[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const label = categories[row] ?? `Row ${row + 1}`;
    const cells = [label, ...series.map((one) => {
      const value = one.values[row];
      return value === undefined || !Number.isFinite(value) ? '' : String(value);
    })];
    rows.push(cells.map(csvCell).join(','));
  }

  const headerLine = header.map(csvCell).join(',');
  for (let take = rows.length; take >= 1; take -= 1) {
    const body = [headerLine, ...rows.slice(0, take)].join('\n');
    const query = `ct=${encodeURIComponent(type)}&d=${encodeURIComponent(body)}`;
    const url = buildEmbedUrl({ toolId: CHART_TOOL_ID, format: 'svg', query });
    if (url) return { kind: 'tool', url };
  }
  return undefined;
}

/**
 * The first pass's proposal for one object, from plan 274 section 3.3.
 *
 * A proposal a rule made is `unreviewed`, with one exception. Read the table as
 * three groups. What repeats but carries information, what cannot be read and
 * what only a person can recognise is kept or replaced and marked
 * `needs-attention`, which section 3.3 names row by row. A title, a subtitle and
 * body text are kept and `accepted` by the rule (plan 275 decision 12, with
 * `author: 'rule'` on the row): keeping the words is not a question, and leaving
 * them unreviewed would fill the queue and the report's list of rows applied
 * without review with every line of every slide. Everything else is the rule's
 * suggestion, unreviewed: removing what the archetypes bring back (page numbers,
 * dates, ornament), replacing a registered mark, keeping a chart or a picture
 * against a role.
 */
function proposeFor(klass: ObjectClassV1, object: SourceObjectV1 | undefined): Proposed {
  const words = object ? wordsOf(object) : 0;
  switch (klass) {
    case 'page-number':
    case 'date':
    case 'decoration':
      return { proposal: 'remove', review: 'unreviewed' };
    case 'template-furniture': {
      // A picture the layout or master drew (a mascot, a panel of art) is the
      // old template's own, not content a slide chose: kept, it waits in the
      // tray for a person rather than taking a continuation slide or a picture
      // slot. Template text keeps the label role it always had.
      const picture = object !== undefined && (object.kind === 'pic' || object.kind === 'vector');
      if (picture) return { proposal: 'keep', review: 'needs-attention', surplus: 'tray' };
      // An empty slot holds nothing to lose, and the master brings slots of its
      // own, so it is a removal the person can accept with the rest rather than
      // a question (template-example: 20 empty slots on a layout-sample deck).
      if (object?.placeholder !== undefined && words === 0 && object.kind !== 'pic') {
        return { proposal: 'remove', review: 'unreviewed' };
      }
      return { proposal: 'keep', review: 'needs-attention', role: 'label' };
    }
    case 'recurring-text':
      return words > 0
        ? { proposal: 'keep', review: 'needs-attention', role: 'caption' }
        : { proposal: 'remove', review: 'unreviewed' };
    case 'footer':
      return { proposal: 'keep', review: 'needs-attention', role: 'caption' };
    case 'known-logo':
      return { proposal: 'replace', review: 'unreviewed', replacement: { kind: 'brand-logo', variant: 'auto' } };
    case 'logo-candidate':
      // Replace, but never on its own: the review confirms the group first, and
      // the variant is read from the target frame background at compile time.
      return { proposal: 'replace', review: 'needs-attention', replacement: { kind: 'brand-logo', variant: 'auto' } };
    // A title, a subtitle and body text are kept and accepted by the rule (plan 275
    // decision 12): nothing about them asks a person, so they leave the queue and the
    // count of rows waiting, and the report says the rule proposed them.
    case 'title':
      return { proposal: 'keep', review: 'accepted', role: 'title' };
    case 'subtitle':
      return { proposal: 'keep', review: 'accepted', role: 'subtitle' };
    case 'body':
      return { proposal: 'keep', review: 'accepted', role: 'body' };
    case 'chart': {
      const offer = object ? chartToolOffer(object) : undefined;
      const row: Proposed = { proposal: 'keep', review: 'unreviewed', role: 'data' };
      if (offer) row.replacement = offer;
      return row;
    }
    case 'table':
      return { proposal: 'keep', review: 'unreviewed', role: 'data' };
    case 'screenshot':
    case 'diagram':
      return { proposal: 'keep', review: 'unreviewed', role: 'visual' };
    case 'photo':
      return { proposal: 'keep', review: 'needs-attention', role: 'visual' };
    default:
      return { proposal: 'keep', review: 'needs-attention' };
  }
}

/**
 * The role a class holds when the rule table gave it none, for a row whose keep
 * came from a person or a preset rather than from the rule. The compile answers
 * the same question with `roleForObject`, and a class it reads as furniture has
 * no content role there either, so a kept page number stays surplus.
 */
const ROLE_BY_CLASS: Partial<Record<ObjectClassV1, ArchetypeRoleV1>> = {
  'known-logo': 'visual',
  'logo-candidate': 'visual',
  photo: 'visual',
  screenshot: 'visual',
  diagram: 'visual',
  chart: 'data',
  table: 'data',
  title: 'title',
  subtitle: 'subtitle',
  body: 'body',
};

// ─── archetype hints the feature vector cannot carry ─────────────────────────

function textOf(object: SourceObjectV1): string {
  return (object.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join('\n');
}

/** A figure with at most a unit or a symbol beside it, for the big-number rule. */
function looksLikeOneFigure(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || !/\d/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^\p{L}]/gu, '');
  return letters.length <= 2;
}

/** What a caller tells `archetypeHints` about the slide beyond its own objects. */
export interface ArchetypeHintsOptsV1 {
  /**
   * Objects the hints must not read: the page number, the footer and the
   * ornament this same pass proposes for removal. Without it a page number on
   * its own reads as the slide's one figure and a quoted footer as its
   * quotation, and the layout would be chosen from what is about to be deleted.
   */
  skipObjectIds?: ReadonlySet<string>;
  /** The slide opens the deck, or its source layout names itself a title layout. */
  coverSlide?: boolean;
}

/** A source layout name that states the deck's own title slide. */
const TITLE_LAYOUT_NAME = /(?:^|[^a-z])(?:title|cover)(?:[^a-z]|$)/i;

/** True when this slide reads as the deck's opening one. */
export function isCoverSlide(slide: SlideSourceV1, sourceLayout?: string): boolean {
  if (slide.index === 0) return true;
  return sourceLayout !== undefined && TITLE_LAYOUT_NAME.test(sourceLayout);
}

/** What plan 274's quote, big-number and title rules need and `LayoutFeaturesV1` does not carry. */
export function archetypeHints(slide: SlideSourceV1, opts: ArchetypeHintsOptsV1 = {}): ArchetypeHintsV1 {
  const skip = opts.skipObjectIds;
  const texts = slide.objects
    .filter((object) => !skip?.has(object.id))
    .map(textOf)
    .filter((text) => text.trim().length > 0);
  const quoteMarks = hasQuoteMarks(slide, skip);
  const bigNumber = texts.length >= 1 && texts.filter(looksLikeOneFigure).length === 1
    && texts.every((text) => looksLikeOneFigure(text) || text.trim().split(/\s+/).length <= 6);
  const hints: ArchetypeHintsV1 = { quoteMarks, bigNumber };
  if (opts.coverSlide) hints.coverSlide = true;
  return hints;
}

// ─── the first pass ──────────────────────────────────────────────────────────

/**
 * The kind of slot one kept row will ask its archetype for, read the way the
 * compile places it: a chart is drawn as its picture (or a placeholder), so it
 * wants an image slot; a table is carried as text, so it wants a table slot; a
 * row with no role that is a picture wants an image slot and one that is text
 * wants the body. A note wants a text slot to close. A replacement by a picture wants an image
 * slot, and a replacement by the brand mark wants none, since the master's
 * furniture holds it.
 *
 * A picture asks for an image slot only when it is content (`isIncidentalPicture`
 * says no): its class says so, or its box covers at least
 * `INCIDENTAL_PICTURE_SHARE` of the slide. A small icon, a partner mark or a kept picture nobody classed is
 * incidental, and letting it ask for a picture slot would pour a text slide into
 * a split layout whose narrow panel starves the words.
 */
function coverageNeed(
  row: ObjectPlanV1,
  object: SourceObjectV1 | undefined,
  slide: { width: number; height: number },
): CoverageRoleV1 | undefined {
  const incidental = (): boolean => object !== undefined && isIncidentalPicture(row.class, object, slide);
  const action = row.decision ?? row.proposal;
  if (action === 'remove') return undefined;
  // A note (a citation, a unit line) asks only for a text slot it can close, so a
  // chart with its source line prefers a layout with a panel over one with none.
  if (action === 'keep' && object && isNoteText(row.class, object, row)) return 'note';
  if (action === 'replace') {
    const replacement = row.decision !== undefined ? (row.decisionReplacement ?? row.proposalReplacement) : row.proposalReplacement;
    if (replacement?.kind === 'brand-logo') return undefined;
    if (replacement?.kind === 'asset' || replacement?.kind === 'supplied-picture' || replacement?.kind === 'tool') return 'visual';
  }
  switch (row.role) {
    case 'title': return 'title';
    case 'subtitle': return 'subtitle';
    case 'body': return 'body';
    case 'visual': return incidental() ? undefined : 'visual';
    case 'data': return object?.kind === 'table' || object?.table !== undefined ? 'data' : 'visual';
    case undefined: break;
    default: return undefined;
  }
  if (!object) return undefined;
  if (object.kind === 'chart') return 'visual';
  if (object.kind === 'pic' || object.kind === 'vector') return incidental() ? undefined : 'visual';
  if (object.kind === 'table') return 'data';
  if (object.kind === 'text' && (object.text?.paras ?? []).some((para) => para.runs.some((run) => run.text.trim().length > 0))) return 'body';
  return undefined;
}

/**
 * A preset's locked colours as plan rows, which the themed solve reads its locks
 * from: each keeps the target the preset pinned, on every ground.
 */
function lockedRows(census: DeckCensusV1, preset: RenovationPresetV1 | undefined): ColorMappingV1[] {
  const uses = new Map(census.colors.uses.map((use) => [use.useId, use]));
  const rows: ColorMappingV1[] = [];
  for (const lock of preset?.lockedColors ?? []) {
    const use = uses.get(lock.useId);
    if (!use) continue;
    rows.push({ useId: lock.useId, from: use.hex, role: use.role, to: lock.to, ...(lock.toPath ? { toPath: lock.toPath } : {}), locked: true, affects: [] });
  }
  return rows;
}

/** Objects whose colours a mapping cannot reach: a picture keeps its own pixels. */
function rasterObjectIds(source: SourceDeckV1): string[] {
  const out: string[] = [];
  for (const slide of source.slides) {
    for (const object of slide.objects) {
      if (object.kind === 'pic' || object.fidelity.state === 'raster-preserved') out.push(object.id);
    }
  }
  return out.sort();
}

/**
 * The deck theme a plan made over `previous` keeps: the one a person chose there,
 * when the new plan is made against the same pack and master (plan 275 section 6.2).
 * A preset, a new reading or a picture rebuild then keeps the deck on Dark rather
 * than dropping it back to the master as shipped. Another pack starts with none.
 */
function carriedTheme(previous: RenovationPlanV1 | undefined, snapshot: DesignSystemSnapshotV1): DeckThemeV1 | undefined {
  const theme = previous?.designSystem.theme;
  if (!theme || !previous) return undefined;
  if (previous.designSystem.tokenHash !== snapshot.tokenHash) return undefined;
  if (previous.designSystem.masterId !== undefined && previous.designSystem.masterId !== snapshot.masterId) return undefined;
  return theme;
}

/**
 * The colours a first-pass shape is themed from, unthemed: the ones this realm
 * resolved it from, else the colours it carries (`ThemeCarryV1`), else its swatches.
 */
function firstPassSource(system: FirstPassDesignSystemV1 & ThemeCarryV1): ThemeSourceV1 {
  const known = themeSourceOf(system);
  if (known) return known;
  const carried = system.themeSource;
  if (carried) return { colors: carried.colors, ...(carried.darkColors ? { darkColors: carried.darkColors } : {}), master: system.master };
  const colors: Record<string, string> = {};
  for (const swatch of system.swatches) colors[swatch.path] = swatch.hex;
  return { colors, master: system.master };
}

export function firstPass(input: FirstPassInputV1): RenovationPlanV1 {
  const { source, census, preset, previous, algorithms } = input;
  // The deck theme is applied in this one function every entry point passes through
  // (plan 275 section 6.2): the one the shape was themed with, or the one `previous` carries.
  const theme = input.designSystem.snapshot.theme ?? carriedTheme(previous, input.designSystem.snapshot);
  const look = theme?.id === 'look' ? input.looks?.find((one) => one.id === theme.lookId) : undefined;
  const themeOpts = { ...(look ? { look } : {}), ...(input.locked ? { locked: true } : {}) };
  const designSystem = systemForPlan(input.designSystem, theme ? { designSystem: { theme } } : null, themeOpts);
  const master = designSystem.master;
  const excluded = new Set(preset?.excludeSlideIds ?? []);

  const censusById = new Map(census.objects.map((row) => [row.id, row]));
  const featuresById = new Map<string, LayoutFeaturesV1>(census.layouts.map((row) => [row.slideId, row]));

  // Decisions from the previous revision, where an object could be found again.
  const carried = previous ? carryForward(previous, source, census) : null;
  const carriedByObject = new Map((carried?.applied ?? []).map((row) => [row.objectId, row]));
  // The previous revision's slides of the same source, by id: what a person set on
  // them (a layout, the slide left out, its order, its ground, its arrangement).
  const previousSlides = new Map<string, SlidePlanV1>(
    previous && previous.source.lineageId === source.source.lineageId ? previous.slides.map((slide) => [slide.id, slide]) : [],
  );

  const slides: SlidePlanV1[] = source.slides.map((slide) => {
    const objects: ObjectPlanV1[] = slide.objects.map((object) => {
      const row = censusById.get(object.id);
      const klass: ObjectClassV1 = row?.hypothesis.class ?? 'unknown';
      const groupId = row?.groupId;
      const base = proposeFor(klass, object);

      const presetAction = preset?.actions?.[klass];
      const presetReview = preset?.review?.[klass];
      const proposal = presetAction ?? base.proposal;
      // An object with nothing to show is a review item whatever its class,
      // because a placeholder is never described as a picture of the source.
      const unavailable = object.fidelity.state === 'unavailable';
      // A preset that replaces the rule's action does not inherit the rule's
      // review state. The rule's keep of a title is a suggestion anybody can
      // accept in one step; a preset that turns the same row into a removal is
      // a different question, and it is flagged unless the preset states a
      // review of its own.
      const overridden = presetAction !== undefined && presetAction !== base.proposal;
      const review: ReviewStateV1 = presetReview
        ?? (unavailable || overridden ? 'needs-attention' : base.review);

      const plan: ObjectPlanV1 = {
        id: object.id,
        class: klass,
        evidence: row ? [...row.hypothesis.evidence] : [],
        proposal,
        review,
      };
      if (presetAction !== undefined) plan.author = 'preset';
      else if (review === 'accepted' && presetReview === undefined) plan.author = 'rule';
      // A logo group travels as one action: every member carries the group id,
      // so the review confirms the group before a replacement reaches its members.
      if (groupId && (klass === 'logo-candidate' || klass === 'known-logo')) plan.scope = groupId;

      const inherited = carriedByObject.get(object.id);
      if (inherited) {
        plan.decision = inherited.action;
        if (inherited.replacement) plan.decisionReplacement = inherited.replacement;
        plan.review = 'accepted';
        plan.author = inherited.author;
        if (inherited.scope !== undefined) plan.scope = inherited.scope;
      }

      // `proposalReplacement` describes the PROPOSAL, so it is stated whenever
      // the proposal is not a removal, whatever was decided afterwards.
      if (base.replacement && proposal !== 'remove') plan.proposalReplacement = base.replacement;

      // `role` describes what will HAPPEN, and the contract states that the
      // effective action is `decision ?? proposal`. A row a person or a preset
      // turned into a keep from a class the rule gave no role to takes the role
      // its class holds, so the findings pass measures it rather than skipping
      // it, and a row turned into a removal states no role at all.
      const action = plan.decision ?? proposal;
      if (action === 'keep') {
        const role = base.role ?? ROLE_BY_CLASS[klass];
        if (role) plan.role = role;
        if (base.surplus) plan.surplus = base.surplus;
      }
      return plan;
    });

    // The hints read the slide the plan is keeping, not the one it arrived as.
    const removed = readRemoved(objects);

    // What the kept content will ask the archetype for, so the pick covers it.
    const objectById = new Map(slide.objects.map((object) => [object.id, object]));
    const needs: Partial<Record<CoverageRoleV1, number>> = {};
    for (const row of objects) {
      if (removed.has(row.id)) continue;
      const need = coverageNeed(row, objectById.get(row.id), slide);
      if (need) needs[need] = (needs[need] ?? 0) + 1;
    }

    const features = featuresById.get(slide.id);
    const declared = new Set(master.archetypes.map((archetype) => archetype.id));
    const hints = features
      ? archetypeHints(slide, { skipObjectIds: removed, coverSlide: isCoverSlide(slide, features.sourceLayout) })
      : undefined;
    // The structure read (plan 275 section 3): what arrangement the slide's kept boxes
    // form, how sure, and the archetype of this master that holds it. Auto-match reads a
    // slide with the same options (`layoutReadOpts`), so both read it alike.
    const read: SlideLayoutMatchV1 | undefined = features
      ? matchSlideLayout(slide, features, layoutReadOpts(slide, removed, (id) => censusById.get(id)?.hypothesis.class, master))
      : undefined;
    const match = read?.match;

    // A preset's layout keys, most specific first: the part the slide was built on,
    // the layout's own name, then the structure the matcher read (by signature, then
    // by library id). A key naming an archetype the master lacks is passed over.
    const layoutName = slide.origin.layoutName;
    const presetLayout = [
      features?.sourceLayout ? preset?.layout?.bySourceLayout?.[features.sourceLayout] : undefined,
      layoutName !== undefined ? preset?.layout?.bySourceLayoutName?.[layoutName] : undefined,
      match ? (preset?.layout?.byStructure?.[match.signature] ?? preset?.layout?.byStructure?.[match.structure]) : undefined,
    ].find((id): id is ArchetypeRefV1 => id !== undefined && declared.has(id));
    // A layout a person chose in the plan this one supersedes (by hand, or through
    // Auto-match) stays: a new rules version regenerates proposals only.
    const kept = previousSlides.get(slide.id);
    const keptLayout = kept && (kept.layoutSource === 'user' || kept.layoutSource === 'auto') && declared.has(kept.layout) ? kept : undefined;

    let layout: ArchetypeRefV1 = 'content';
    let layoutSource: SlidePlanV1['layoutSource'] = 'proposed';
    let alternative: ArchetypeRefV1 | undefined;
    let reasons: ReviewMessageV1[] = [];

    if (keptLayout) {
      layout = keptLayout.layout;
      layoutSource = keptLayout.layoutSource;
      reasons = [reviewMessage('layout.reason.pick.kept', {})];
    } else if (presetLayout) {
      layout = presetLayout;
      layoutSource = 'preset';
      reasons = [reviewMessage('layout.reason.pick.preset', {})];
    } else if (match?.band === 'clear' && read?.archetype && declared.has(read.archetype)) {
      // A clear read sets the layout as a proposal, exactly as a rule sets one.
      layout = read.archetype;
      reasons = read.reasons;
    } else if (features && hints) {
      const opts: Parameters<typeof pickArchetype>[2] = {
        hints: {
          ...hints,
          needs,
          // The two-column rule reads it: null means the matcher read the slide and named
          // nothing it is at all sure of (no read, or one under the propose band).
          ...(features.units ? { structure: match && match.band !== 'none' ? match.structure : null } : {}),
        },
      };
      if (preset?.layout?.minGap !== undefined) opts.minGap = preset.layout.minGap;
      if (preset?.layout?.fallback !== undefined) opts.fallback = preset.layout.fallback;
      const picked = pickArchetype(features, master, opts);
      layout = picked.id;
      alternative = picked.alternative;
      reasons = picked.messages;
      if (match?.band === 'likely' && read?.archetype) {
        // A likely read travels as the alternative, with its own sentence first.
        if (read.archetype !== layout) alternative = read.archetype;
        reasons = [...read.reasons];
      } else if (read?.dense) {
        reasons = [...picked.messages, ...read.reasons];
      }
    }

    const plan: SlidePlanV1 = {
      id: slide.id,
      include: !excluded.has(slide.id) && (kept ? kept.include : true),
      layout,
      layoutSource,
      objects,
    };
    if (alternative && alternative !== layout) plan.layoutAlternative = alternative;
    if (reasons.length > 0) plan.layoutReasons = reasons;
    if (match) plan.layoutMatch = match;
    // The rest of what a person set on the slide carries forward too.
    if (kept?.order !== undefined) plan.order = kept.order;
    if (kept?.ground !== undefined) plan.ground = kept.ground;
    if (kept?.arrangement !== undefined) plan.arrangement = kept.arrangement;
    return plan;
  });

  // A deck theme, or a slide on a ground of its own, is solved once per ground group
  // (`solveThemeColors`), so each use holds its target on the ground its slide is drawn
  // on. With neither, the one solve the first pass has always run, byte for byte.
  const themed = (theme !== undefined && !isPlainTheme(theme) && !(input.locked === true && theme.id === 'look'))
    || slides.some((slide) => slide.ground !== undefined);
  const colors = themed
    ? []
    : assignColors({
      uses: census.colors.uses,
      contrastPairs: census.colors.contrastPairs,
      swatches: designSystem.swatches,
      rasterObjectIds: rasterObjectIds(source),
      ...(preset?.lockedColors ? { locked: preset.lockedColors } : {}),
      ...(preset?.minSeparation === undefined ? {} : { minSeparation: preset.minSeparation }),
      ...(designSystem.slots ? { slots: designSystem.slots } : {}),
      ...(input.seed === undefined ? {} : { seed: input.seed }),
    });

  const fonts = mapFonts({
    fonts: census.fonts,
    brand: designSystem.fonts.brand,
    ...(designSystem.fonts.serif === undefined ? {} : { serif: designSystem.fonts.serif }),
    ...(designSystem.fonts.mono === undefined ? {} : { mono: designSystem.fonts.mono }),
    ...(designSystem.fonts.availableFamilies === undefined ? {} : { available: designSystem.fonts.availableFamilies }),
  });

  const plan: RenovationPlanV1 = {
    version: 1,
    source: {
      lineageId: source.source.lineageId,
      hash: source.source.hash,
      instanceId: source.source.instanceId,
    },
    revision: previous ? previous.revision + 1 : 1,
    designSystem: designSystem.snapshot,
    algorithms,
    mode: 'renovate',
    slides,
    colors,
    fonts,
    logo: {
      policy: preset?.logo?.policy ?? 'brand',
      variantByBackground: preset?.logo?.variantByBackground ?? true,
    },
    decisions: carried?.decisions ?? previous?.decisions ?? [],
  };
  if (preset?.id) plan.presetId = preset.id;
  if (input.seed !== undefined) plan.shuffleSeed = input.seed;
  if (carried) plan.carryForward = { carried: carried.carried, needsReview: carried.needsReview };
  if (themed) {
    plan.colors = solveThemeColors({ ...plan, colors: lockedRows(census, preset) }, theme, {
      census,
      system: firstPassSource(input.designSystem),
      rasterObjectIds: rasterObjectIds(source),
      source,
      ...themeOpts,
      ...(preset?.minSeparation === undefined ? {} : { minSeparation: preset.minSeparation }),
    }).colors;
  }
  return plan;
}

// ─── hard layout findings ────────────────────────────────────────────────────

/** The placeholder an archetype holds for a role, taking each slot once. */
function takeSlot(archetype: ArchetypeV1, role: ArchetypeRoleV1, used: Map<ArchetypeRoleV1, number>): ArchetypeV1['placeholders'][number] | undefined {
  const taken = used.get(role) ?? 0;
  const matching = archetype.placeholders.filter((slot) => slot.role === role);
  const slot = matching[taken];
  used.set(role, taken + 1);
  return slot;
}

/**
 * The findings a compile has to carry whatever a quality score says: text that
 * will not fit the role box it is poured into, and a role whose type size is
 * under the readable floor.
 *
 * The overflow number is an estimate from the master's own type scale and an
 * average glyph advance, not a shaped measurement: a caller that can shape text
 * with the target font measures again and its number wins. The estimate exists
 * so a headless run still reports the case rather than staying silent. Its two
 * numbers and its line counting are the compile's own, so a body this pass
 * reports as over height is the one the compile continues onto another frame.
 *
 * An object whose role the archetype has no placeholder left for is counted and
 * skipped here: where it goes is the compile's answer, and this pass has no
 * report code to state it with.
 */
export function layoutFindings(plan: RenovationPlanV1, source: SourceDeckV1, master: SlideMasterV1): ReportEntryV1[] {
  const objectsById = new Map<string, SourceObjectV1>();
  for (const slide of source.slides) for (const object of slide.objects) objectsById.set(object.id, object);
  const out: ReportEntryV1[] = [];

  for (const slidePlan of plan.slides) {
    if (!slidePlan.include) continue;
    const archetype = findArchetype(master, slidePlan.layout);
    if (!archetype) continue;
    const used = new Map<ArchetypeRoleV1, number>();

    for (const row of slidePlan.objects) {
      const action = row.decision ?? row.proposal;
      if (action !== 'keep' || !row.role) continue;
      const object = objectsById.get(row.id);
      if (!object) continue;
      const slot = takeSlot(archetype, row.role, used);
      if (!slot) continue;

      const box = masterBoxToPx(master, slot.box);
      const size = roleFontSize(master, row.role, slot.style);
      if (size < MIN_READABLE_PX) {
        out.push({
          code: 'layout.below-readable-size',
          message: `The ${row.role} slot of the ${archetype.id} layout states ${size}px at the master size, under the ${MIN_READABLE_PX}px floor.`,
          slideId: slidePlan.id,
          objectId: row.id,
          class: row.class,
          action,
        });
      }

      const text = textOf(object);
      const characters = text.replace(/\s+/g, ' ').trim().length;
      if (characters === 0 || slot.kind !== 'text') continue;
      // Paragraph by paragraph, the way the compile's own estimate counts: a
      // three-line list takes three lines however short each line is.
      const perLine = Math.max(1, Math.floor(box.w / Math.max(1, size * AVERAGE_GLYPH_EM)));
      let lines = 0;
      for (const line of text.split('\n')) lines += Math.max(1, Math.ceil(line.replace(/\s+/g, ' ').trim().length / perLine));
      const needed = lines * size * ESTIMATE_LINE_HEIGHT;
      if (needed <= box.h) continue;
      out.push({
        code: 'text.overflow',
        message: `${characters} characters at ${size}px estimate ${lines} lines and ${Math.round(needed)}px, over the ${Math.round(box.h)}px the ${row.role} slot of the ${archetype.id} layout holds. The estimate uses an average glyph advance, so a shaped measurement replaces it.`,
        slideId: slidePlan.id,
        objectId: row.id,
        class: row.class,
        action,
      });
    }
  }

  return out.sort((a, b) => compareCodeUnits(a.slideId ?? '', b.slideId ?? '')
    || compareCodeUnits(a.objectId ?? '', b.objectId ?? '')
    || compareCodeUnits(a.code, b.code));
}
