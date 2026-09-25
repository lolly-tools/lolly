// SPDX-License-Identifier: MPL-2.0
/**
 * The review model of a renovation (plan 274 section 4): what the queue, the
 * footer, the report drawer, the CLI `inspect` command and later the TUI show.
 *
 * Everything here is a derivation over three inputs a surface already holds: the
 * plan, the census and the read source. Nothing is stored, so two surfaces that
 * render the same plan show the same queue, the same counts and the same
 * sentences.
 *
 * Three states are kept apart on every object and every slide, as section 4
 * asks: inclusion (what the deck will contain), review (unreviewed, accepted,
 * needs attention) and fidelity (editable, picture, approximate, unavailable).
 * Accepting a decision never improves fidelity, and a kept slide can still need
 * review.
 *
 * The queue groups work the way a person thinks about it. A verified census
 * group (the same mark on 24 slides) is one item. Rows that carry no group but
 * repeat (page numbers, dates, footers, recurring text) are one item per class,
 * proposal, evidence kind and object kind, when they span two slides or more.
 * The rest is one item per slide, class, proposal and object kind ("4 pictures
 * on slide 4"), and one item per object where a row has no such sibling.
 * Unverified group candidates are never grouped: a hash collision is not an
 * identity.
 *
 * User-facing English is returned as `{ code, params, text }`. `text` is the
 * English sentence; a shell translates by `code` with the params. Every template
 * is in `REVIEW_MESSAGES` and every noun in `REVIEW_NOUNS`, so a translator
 * sees them in one place. Evidence is read by `evidenceMessage` from the
 * signal and value a census row carries, in the class and object kind it
 * supports, so the census, the plan and the queue state one sentence per row
 * and the census writes that same text into its `sentence` field. An evidence
 * sentence says what was found, in about ten words, never how.
 *
 * Pure: no DOM, no clock, no filesystem, no network. Output order is fixed.
 */

import type {
  DecisionAuthorV1,
  DeckCensusV1,
  EvidenceV1,
  ObjectClassV1,
  ObjectGroupV1,
  ObjectPlanV1,
  PlanActionV1,
  RenovationPlanV1,
  ReplacementV1,
  ReviewStateV1,
  SlidePlanV1,
  SourceDeckV1,
  SourceObjectKindV1,
  SourceObjectV1,
  ArchetypeRefV1,
  LayoutMatchBandV1,
  ReviewMessageV1,
} from '@lolly-tools/core';
import { OBJECT_CLASSES, PLAN_ACTIONS } from '@lolly-tools/core';
import { compareCodeUnits as compareText } from './rebrand-order.ts';
import { findStructure } from './slide-structures.ts';

// ─── the shapes a surface renders ────────────────────────────────────────────

/** One sentence a person reads. Declared in `@lolly-tools/core` from plan 275 on, because a slide plan carries them; re-exported here unchanged. */
export type { ReviewMessageV1 } from '@lolly-tools/core';

/** How faithfully something can be shown, weakest last. `picture` is a held raster. */
export const REVIEW_FIDELITIES = ['editable', 'picture', 'approximate', 'unavailable'] as const;
export type ReviewFidelityV1 = (typeof REVIEW_FIDELITIES)[number];

/** The queue section an item belongs to: needs attention first, then suggestions, then settled. */
export const QUEUE_SECTIONS = ['attention', 'suggestions', 'settled'] as const;
export type QueueSectionV1 = (typeof QUEUE_SECTIONS)[number];

export interface QueueItemV1 {
  /**
   * The census group id, `obj:` plus an object id, `rep:` plus the repeat key
   * (class, proposal, evidence kind, object kind), or `slide:` plus the slide
   * key (slide id, class, proposal, object kind). Every part is a fact of the
   * rows that a decision does not change, so the id stays the same after an
   * apply and a scope stamped with it keeps naming the same item.
   */
  id: string;
  section: QueueSectionV1;
  class: ObjectClassV1;
  /** Effective action, `decision ?? proposal`; for several members, the one most of them take. */
  action: PlanActionV1;
  proposal: PlanActionV1;
  /** The effective replacement of the exemplar row, when it has one. */
  replacement?: ReplacementV1;
  /** Strongest across members: needs attention over unreviewed over accepted. */
  review: ReviewStateV1;
  objectIds: string[];
  lockedIds: string[];
  /**
   * Members a person or an agent already decided differently from `action` and
   * `replacement`: exactly the rows a group apply of this item skips as
   * `corrected`.
   */
  correctedIds: string[];
  /**
   * Members whose effective action differs from `action` and that are not
   * corrections: a different proposal, or a decision a rule or a preset wrote.
   * A group apply of this item changes them, so a view says how many differ.
   */
  mixedIds: string[];
  slideIds: string[];
  /** 1-based positions in the source deck, ascending. */
  slideNumbers: number[];
  exemplar: string;
  groupId?: string;
  title: ReviewMessageV1;
  evidence: ReviewMessageV1;
  /** Weakest member. */
  fidelity: ReviewFidelityV1;
  /**
   * What the item is about. Absent means object rows. `layout-group` holds the
   * slides the structure matcher read as one layout (plan 275 section 3.3): no object
   * rows, the slides in `slideIds`, the layout in `layout`. `diagram` holds the
   * slides that read as diagrams, with the offer to keep each as a picture.
   */
  type?: 'layout-group' | 'diagram';
  /** For a `layout-group`: the library id read, its band, and the archetype the slides take. */
  layout?: { structure: string; band: LayoutMatchBandV1; archetype: ArchetypeRefV1 };
  /**
   * False when the evidence sentence says nothing the title does not (F11): a view
   * leaves it out. Absent means it adds a fact.
   */
  evidenceAddsFact?: boolean;
}

/** Options a surface passes to `reviewQueue`. */
export interface ReviewQueueOptsV1 {
  /**
   * The first project opened under a new `algorithms.plan` rules version (plan 275
   * section 3.3): every layout group goes under Needs attention instead of
   * Suggestions, on that device, so the most visible change is looked at once.
   */
  layoutGroupsNeedAttention?: boolean;
}

export interface ObjectStateV1 {
  id: string;
  slideId: string;
  action: PlanActionV1;
  review: ReviewStateV1;
  fidelity: ReviewFidelityV1;
  author?: DecisionAuthorV1;
  locked: boolean;
  class: ObjectClassV1;
}

export interface SlideStateV1 {
  id: string;
  /** 1-based position in the source deck. */
  number: number;
  include: boolean;
  /** 0-based position in the effective deck order this list is returned in. */
  order: number;
  layout: ArchetypeRefV1;
  layoutSource: SlidePlanV1['layoutSource'];
  sourceLayout?: string;
  attention: number;
  unreviewed: number;
  removed: number;
  /** Objects with nothing to show that are not being removed. */
  unresolved: number;
  /** Weakest fidelity among the objects the slide keeps or replaces. */
  fidelity: ReviewFidelityV1;
  /** The first title, or the largest text, collapsed and cut to 80 characters. */
  title?: string;
}

export interface PlanSummaryV1 {
  slides: { total: number; included: number };
  /**
   * Effective actions on included slides; `unresolved` counts kept objects with
   * nothing to show, and `unplaced` counts kept plain shapes, which no layout of
   * a slide master has a slot for, so the compile holds them in the tray.
   */
  objects: { keep: number; replace: number; remove: number; unresolved: number; unplaced: number };
  /** Review states across every row, the same rows the queue is built from. */
  review: { attention: number; unreviewed: number; accepted: number };
  colours: { assigned: number; unresolved: number; locked: number };
  fonts: { substituted: number };
  /** Slides that are one picture: the flattened path. */
  flattened: number;
}

// ─── the message table ───────────────────────────────────────────────────────

/**
 * Every sentence template this module writes, by code. Fill-ins are `{name}` and
 * are filled from the message params. A title's first letter is raised after
 * filling, so `{noun}` stays lower case in the table.
 *
 * Two words are kept apart in everything a person reads. A "slot" is a place a
 * layout or a slide master keeps for content (OOXML calls it a placeholder, and
 * the `evidence.placeholder.*` codes keep that name so no code moves). A
 * "labelled stand-in" is the layer the compile writes where an object could not
 * be read. Neither is ever called a placeholder in the English text.
 */
export const REVIEW_MESSAGES = {
  'title.one': '{noun} on slide {slide}',
  'title.one-unavailable': '{noun} on slide {slide} could not be drawn',
  'title.many-unavailable': '{count} {nouns} could not be drawn',
  'title.same.keep': 'Keep the same {noun} on {slides} slides',
  'title.same.replace': 'Replace the same {noun} on {slides} slides',
  'title.same.remove': 'Remove the same {noun} on {slides} slides',
  'title.across.keep': 'Keep {nouns} on {slides} slides',
  'title.across.replace': 'Replace {nouns} on {slides} slides',
  'title.across.remove': 'Remove {nouns} on {slides} slides',
  'title.several.keep': 'Keep {count} {nouns} on slide {slide}',
  'title.several.replace': 'Replace {count} {nouns} on slide {slide}',
  'title.several.remove': 'Remove {count} {nouns} on slide {slide}',
  'title.master': '{noun} from the slide master on {slides} slides',
  'title.layout': '{noun} from the slide layout on {slides} slides',
  'title.several': '{count} {nouns} on slide {slide}',
  'evidence.origin.slide': 'On the slide itself.',
  'evidence.origin.layout': 'From the slide layout.',
  'evidence.origin.master': 'From the slide master.',
  'evidence.origin.pdf-artifact': 'Marked as decoration in the PDF.',
  'evidence.origin.raster-region': 'Part of a picture of the slide.',
  'evidence.placeholder.page-number': 'In the page number slot of the layout.',
  'evidence.placeholder.date': 'In the date slot of the layout.',
  'evidence.placeholder.footer': 'In the footer slot of the layout.',
  'evidence.placeholder.title': 'In the title slot of the layout.',
  'evidence.placeholder.subtitle': 'In the subtitle slot of the layout.',
  'evidence.placeholder.text': 'In a text slot of the layout.',
  'evidence.placeholder.picture': 'In a picture slot of the layout.',
  'evidence.placeholder.chart': 'In a chart slot of the layout.',
  'evidence.placeholder.table': 'In a table slot of the layout.',
  'evidence.placeholder.other': 'In a slot of the layout.',
  'evidence.placeholder-empty.title': 'Empty title slot.',
  'evidence.placeholder-empty.subtitle': 'Empty subtitle slot.',
  'evidence.placeholder-empty.text': 'Empty text slot.',
  'evidence.placeholder-empty.other': 'Empty slot.',
  'evidence.repeat.picture': 'Identical picture on each.',
  'evidence.repeat.drawing': 'Identical drawing on each.',
  'evidence.repeat.shape': 'Identical shape on each.',
  'evidence.repeat.line': 'Identical line on each.',
  'evidence.repeat.object': 'Identical object on each.',
  'evidence.match.exact': 'Identical on each slide.',
  'evidence.match.dhash': 'Near-identical picture on each slide.',
  'evidence.match.path-hash': 'Same drawing outline on each slide.',
  'evidence.repeat-share': 'On {percent}% of slides.',
  'evidence.position-jitter': 'Moves up to {percent}% between slides.',
  'evidence.margin.edge': 'In the slide margin.',
  'evidence.margin.top': 'In the top band.',
  'evidence.margin.bottom': 'In the bottom band.',
  'evidence.area-share': 'Covers {percent}% of the slide.',
  'evidence.aspect': 'Width to height {ratio} to 1.',
  'evidence.words.one': '1 word.',
  'evidence.words.many': '{count} words.',
  'evidence.no-text': 'No text.',
  'evidence.text-size': '{pt} pt text.',
  'evidence.text-size.words.one': '1 word, {pt} pt.',
  'evidence.text-size.words.many': '{count} words, {pt} pt.',
  'evidence.letters': 'The letters {letters}, one per slide.',
  'evidence.size-rank.first': 'Largest text on the slide.',
  'evidence.size-rank.second': 'Second largest text size on the slide.',
  'evidence.size-rank.third': 'Third largest text size on the slide.',
  'evidence.size-rank.other': '{count} larger text sizes on the slide.',
  'evidence.digits.page-number': 'A number that changes on each slide.',
  'evidence.digits.line': 'Same line apart from its digits.',
  'evidence.native-tag.table': 'Source names a table.',
  'evidence.native-tag.bar': 'Source names a bar chart.',
  'evidence.native-tag.pie': 'Source names a pie chart.',
  'evidence.native-tag.line': 'Source names a line chart.',
  'evidence.native-tag.area': 'Source names an area chart.',
  'evidence.native-tag.donut': 'Source names a donut chart.',
  'evidence.native-tag.scatter': 'Source names a scatter chart.',
  'evidence.native-tag.radar': 'Source names a radar chart.',
  'evidence.native-tag.chart': 'Source names a chart.',
  'evidence.native-tag.diagram': 'Source names a diagram.',
  'evidence.native-tag.connector': 'A connector line, which joins parts of a drawing.',
  'evidence.native-tag.other': 'Source names its own kind.',
  'evidence.unmatched': 'No rule matched it.',
  'evidence.unavailable': 'Could not be read from the file.',
  'evidence.chart-data': '{count} data series in the file.',
  'evidence.ocr.not-run': 'Text in the picture was not read.',
  'evidence.rebuilt': 'Check each before Design.',
  'evidence.ocr.unavailable': 'Text in the picture could not be read.',
  'evidence.ocr.no-text-found': 'No text in the picture.',
  'evidence.ocr.text-found': 'Text found in the picture.',
  'evidence.ocr-density': 'Dense text in the picture.',
  'evidence.edges.chart': 'Straight, even edges.',
  'evidence.edges.screenshot': 'Reads as a screen capture.',
  'evidence.edges.photo': 'Reads as a photograph.',
  'evidence.colours': '{count} distinct colours.',
  'evidence.fills': 'A drawing in {count} colours.',
  'evidence.fills.part': 'Part of a drawing in {count} colours.',
  'evidence.filled-shape': 'A filled shape with no text.',
  'evidence.known-identity': 'Matches the registered mark {label}.',
  'evidence.column-alignment': 'Text lines share column edges.',
  'evidence.none': 'No evidence recorded.',
  'evidence.diagram': 'Keeping it as a picture may serve it better.',
  'title.layout-group.one': '{layout}, slide {slide}',
  'title.layout-group.many': '{layout}, {count} slides',
  'title.layout-group.likely.one': '{layout}, slide {slide}',
  'title.layout-group.likely.many': '{layout}, {count} slides',
  'title.rebuilt.one': 'Rebuilt slide {slide} from its picture',
  'title.rebuilt.many': 'Rebuilt {count} slides from pictures',
  'title.diagram.one': 'Slide {slide} reads as a diagram',
  'title.diagram.many': '{count} slides read as diagrams',
  'layout.reason.row.text.same': '{countWord} text boxes side by side, about the same width and lined up.',
  'layout.reason.row.text.uneven': '{countWord} text boxes side by side and lined up, their widths a little different.',
  'layout.reason.row.cards.same': '{countWord} cards side by side, about the same width and lined up.',
  'layout.reason.row.cards.uneven': '{countWord} cards side by side and lined up, their widths a little different.',
  'layout.reason.images': '{countWord} pictures side by side.',
  'layout.reason.stats': '{countWord} figures in large type side by side.',
  'layout.reason.steps': '{countWord} numbered steps side by side.',
  'layout.reason.timeline': '{countWord} boxes in a row along a line or a run of dates.',
  'layout.reason.grid': '{countWord} boxes in {rowsWord} rows of {columnsWord}, about the same size.',
  'layout.reason.image-grid': '{countWord} pictures in {rowsWord} rows of {columnsWord}.',
  'layout.reason.split.right': 'A picture on the right with text beside it.',
  'layout.reason.callout.right': 'Text with a boxed takeaway on the right.',
  'layout.reason.callout.left': 'Text with a boxed takeaway on the left.',
  'layout.reason.split.left': 'A picture on the left with text beside it.',
  'layout.reason.split.over.right': 'A picture on the right, laid over part of the text beside it.',
  'layout.reason.split.over.left': 'A picture on the left, laid over part of the text beside it.',
  'layout.reason.chart.right': 'A chart on the right with text beside it.',
  'layout.reason.chart.left': 'A chart on the left with text beside it.',
  'layout.reason.stack': '{countWord} blocks of text stacked in one column.',
  'layout.reason.stack.labelled': '{countWord} rows stacked in one column, each opening with a short label.',
  'layout.reason.stack.agenda': 'A numbered list of topics early in the deck.',
  'layout.reason.big-number': 'One figure in large type, with little else.',
  'layout.reason.table': 'Text boxes lined up in rows and columns, like a table.',
  'layout.reason.table.native': 'The slide holds a table.',
  'layout.reason.quote': 'Quotation marks around the text.',
  'layout.reason.quote.picture': 'A quotation beside a photograph.',
  'layout.reason.full-image': 'Pictures cover most of the slide.',
  'layout.reason.chart': 'One chart and little text.',
  'layout.reason.visual': 'One large picture and little text.',
  'layout.reason.missing': 'This design system has no {layout} layout; {fallback} is the nearest.',
  'layout.reason.missing.used': 'This design system has no {layout} layout, so {fallback} was used.',
  'layout.reason.capacity': 'The {layout} layout has too few boxes for all of this content.',
  'layout.reason.tie': '{other} fits about as well, so this needs a look.',
  'layout.reason.likely': 'Close, but not sure enough to set on its own.',
  'layout.reason.none': 'Nothing more specific fits well.',
  'layout.reason.dense': 'Many small boxes that fit no layout, like a diagram.',
  'layout.reason.pick.title': 'A title with little else, at the start of the deck.',
  'layout.reason.pick.section': 'A heading on its own.',
  'layout.reason.pick.big-number': 'One figure with a few words around it.',
  'layout.reason.pick.table': 'The slide holds a table.',
  'layout.reason.pick.full-image': 'Pictures cover most of the slide.',
  'layout.reason.pick.visual.chart': 'A chart and little text.',
  'layout.reason.pick.visual': 'One large picture and little text.',
  'layout.reason.pick.split.chart': 'A chart beside the text.',
  'layout.reason.pick.split': 'A picture beside the text.',
  'layout.reason.pick.two-column': 'Two boxes of text of the same size.',
  'layout.reason.pick.quote': 'Quotation marks around the text.',
  'layout.reason.pick.content': 'A title over body text.',
  'layout.reason.pick.plain': 'Nothing more specific fits, so the plainest layout stands in.',
  'layout.reason.pick.covers': 'The layout with a place for everything the slide keeps.',
  'layout.reason.pick.tie': 'Two layouts fit about as well, so the plainer one stands and the other is offered.',
  'layout.reason.pick.preset': 'The preset sets this layout.',
  'layout.reason.pick.kept': 'Your earlier choice, kept.',
} as const satisfies Record<string, string>;

export type ReviewMessageCodeV1 = keyof typeof REVIEW_MESSAGES;

/**
 * The noun each class is named by, singular and plural. A title names the noun
 * it used in its `nounCode` param as `noun.<key>.one` or `noun.<key>.many`,
 * where `<key>` is a key of this table and the last part is the form.
 *
 * For the i18n pass: `{count} {nouns}` titles use one plural form. A language
 * with several plural categories needs a template per category, chosen from
 * the `count` param.
 */
export const REVIEW_NOUNS = {
  'template-furniture': { one: 'item from the old template', many: 'items from the old template' },
  decoration: { one: 'shape', many: 'shapes' },
  'logo-candidate': { one: 'mark', many: 'marks' },
  'known-logo': { one: 'registered mark', many: 'registered marks' },
  'recurring-text': { one: 'repeated line', many: 'repeated lines' },
  'page-number': { one: 'page number', many: 'page numbers' },
  footer: { one: 'footer', many: 'footers' },
  date: { one: 'date', many: 'dates' },
  title: { one: 'title', many: 'titles' },
  subtitle: { one: 'subtitle', many: 'subtitles' },
  body: { one: 'text block', many: 'text blocks' },
  chart: { one: 'chart', many: 'charts' },
  screenshot: { one: 'screenshot', many: 'screenshots' },
  photo: { one: 'photo', many: 'photos' },
  table: { one: 'table', many: 'tables' },
  diagram: { one: 'diagram', many: 'diagrams' },
  unknown: { one: 'object', many: 'objects' },
  picture: { one: 'picture', many: 'pictures' },
  drawing: { one: 'drawing', many: 'drawings' },
  'drawing-part': { one: 'drawing part', many: 'drawing parts' },
  label: { one: 'label', many: 'labels' },
  line: { one: 'line', many: 'lines' },
} as const satisfies Record<string, { one: string; many: string }>;

export type ReviewNounKeyV1 = keyof typeof REVIEW_NOUNS;

/** Fill a template's `{name}` slots from the params. An unknown slot stays as written. */
function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

function capitalise(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** One message from the table, with its English text filled in and its first letter raised. */
export function reviewMessage(code: ReviewMessageCodeV1, params: Record<string, string | number>): ReviewMessageV1 {
  return { code, params, text: capitalise(fill(REVIEW_MESSAGES[code], params)) };
}

// ─── reading one row ─────────────────────────────────────────────────────────

const REVIEW_RANK: Record<ReviewStateV1, number> = { accepted: 0, unreviewed: 1, 'needs-attention': 2 };
const FIDELITY_RANK: Record<ReviewFidelityV1, number> = { editable: 0, picture: 1, approximate: 2, unavailable: 3 };
const SECTION_RANK: Record<QueueSectionV1, number> = { attention: 0, suggestions: 1, settled: 2 };
const CLASS_RANK = new Map<ObjectClassV1, number>(OBJECT_CLASSES.map((klass, i) => [klass, i]));

/** The effective action of a row: a decision wins over the proposal. */
export function effectiveAction(row: ObjectPlanV1): PlanActionV1 {
  return row.decision ?? row.proposal;
}

/** The effective replacement, read the way the compile reads it. */
export function effectiveReplacement(row: ObjectPlanV1): ReplacementV1 | undefined {
  return row.decision !== undefined
    ? (row.decisionReplacement ?? row.proposalReplacement)
    : row.proposalReplacement;
}

/** The fidelity a person is told about. A held raster reads as `picture`; a missing object as `unavailable`. */
export function reviewFidelity(object: SourceObjectV1 | undefined): ReviewFidelityV1 {
  switch (object?.fidelity.state) {
    case 'editable': return 'editable';
    case 'raster-preserved': return 'picture';
    case 'approximate': return 'approximate';
    default: return 'unavailable';
  }
}

function strongerReview(a: ReviewStateV1, b: ReviewStateV1): ReviewStateV1 {
  return REVIEW_RANK[b] > REVIEW_RANK[a] ? b : a;
}

function weakerFidelity(a: ReviewFidelityV1, b: ReviewFidelityV1): ReviewFidelityV1 {
  return FIDELITY_RANK[b] > FIDELITY_RANK[a] ? b : a;
}

function sectionOf(review: ReviewStateV1): QueueSectionV1 {
  if (review === 'needs-attention') return 'attention';
  if (review === 'unreviewed') return 'suggestions';
  return 'settled';
}

function sameReplacement(a: ReplacementV1 | undefined, b: ReplacementV1 | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * True when a person or an agent already decided this row differently from the
 * given action and replacement. A decision a rule or a preset wrote is not a
 * correction, and a decision equal to the new one is not a different one.
 *
 * The replacement is compared with what the row would hold after the apply: an
 * apply that states none leaves the row on its proposal's replacement, so a
 * replacement a person chose earlier counts as different and is kept. Only a
 * Replace compares replacements, since Keep and Remove draw none.
 *
 * This is the one predicate both the queue's `correctedIds` and the apply's
 * `corrected` skips use.
 */
export function isCorrected(row: ObjectPlanV1, action: PlanActionV1, replacement?: ReplacementV1): boolean {
  if (row.decision === undefined) return false;
  if (row.author !== 'user' && row.author !== 'agent') return false;
  if (row.decision !== action) return true;
  if (action !== 'replace') return false;
  return !sameReplacement(effectiveReplacement(row), replacement ?? row.proposalReplacement);
}

/** The evidence row a queue item leads with: the heaviest one, earliest on a tie. */
function leadingEvidence(evidence: readonly EvidenceV1[]): number {
  let best = -1;
  evidence.forEach((row, index) => {
    const lead = evidence[best];
    if (!lead || Math.abs(row.weight) > Math.abs(lead.weight)) best = index;
  });
  return best;
}

/** The evidence kind a repeat bucket is keyed by: the signal of the leading row, else the origin. */
function evidenceKind(row: ObjectPlanV1): string {
  return row.evidence[leadingEvidence(row.evidence)]?.signal ?? 'origin';
}

/**
 * The app noun an OOXML placeholder type stands for, so a person never reads a
 * raw name such as `sldNum`. A type not listed reads as content.
 */
const PLACEHOLDER_KINDS: Readonly<Record<string, 'page-number' | 'date' | 'footer' | 'title' | 'subtitle' | 'text' | 'picture' | 'chart' | 'table'>> = {
  sldNum: 'page-number',
  dt: 'date',
  ftr: 'footer',
  title: 'title',
  ctrTitle: 'title',
  subTitle: 'subtitle',
  body: 'text',
  pic: 'picture',
  clipArt: 'picture',
  chart: 'chart',
  tbl: 'table',
};

/** The chart kind a native tag names, read from the tag's own words (`barChart`, `c:pie3DChart`). */
function nativeTagCode(value: EvidenceV1['value']): ReviewMessageCodeV1 {
  const tag = String(value);
  if (/table|tbl/i.test(tag)) return 'evidence.native-tag.table';
  if (/doughnut|donut/i.test(tag)) return 'evidence.native-tag.donut';
  if (/bar/i.test(tag)) return 'evidence.native-tag.bar';
  if (/pie/i.test(tag)) return 'evidence.native-tag.pie';
  if (/area/i.test(tag)) return 'evidence.native-tag.area';
  if (/scatter|bubble/i.test(tag)) return 'evidence.native-tag.scatter';
  if (/radar/i.test(tag)) return 'evidence.native-tag.radar';
  if (/connector/i.test(tag)) return 'evidence.native-tag.connector';
  if (/line/i.test(tag)) return 'evidence.native-tag.line';
  if (/chart/i.test(tag)) return 'evidence.native-tag.chart';
  if (/diagram/i.test(tag)) return 'evidence.native-tag.diagram';
  return 'evidence.native-tag.other';
}

/** What a repeated object is called in its evidence: a picture, a drawing, a shape or a line. */
function repeatCode(kind: SourceObjectKindV1 | undefined): ReviewMessageCodeV1 {
  switch (kind) {
    case 'pic': return 'evidence.repeat.picture';
    case 'vector': return 'evidence.repeat.drawing';
    case 'shape': return 'evidence.repeat.shape';
    case 'text': return 'evidence.repeat.line';
    default: return 'evidence.repeat.object';
  }
}

/** A share as a percentage: whole numbers, and one decimal under 1% so a small mark never reads 0%. */
function percent(value: EvidenceV1['value']): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const p = value * 100;
  return p < 1 ? Math.round(p * 10) / 10 : Math.round(p);
}

function count(value: EvidenceV1['value']): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

/** What a census row is read in: the class it supports and the kind of object it is about. */
export interface EvidenceContextV1 {
  class: ObjectClassV1;
  kind?: SourceObjectKindV1;
}

/**
 * One evidence row as a sentence: a code from `REVIEW_MESSAGES`, its params, and
 * the English text. `index` names the row inside its list, because one row reads
 * with a sibling (a text size says how many words the text holds). The census
 * writes this text into the row's `sentence`, and the queue reads it here, so
 * both say the same thing.
 */
export function evidenceMessage(evidence: readonly EvidenceV1[], index: number, context: EvidenceContextV1): ReviewMessageV1 {
  const row = evidence[index];
  if (!row) return reviewMessage('evidence.none', {});
  const value = row.value;
  const words = evidence.find((one) => one.signal === 'text-length' && typeof one.value === 'number');
  switch (row.signal) {
    case 'origin': {
      const origin = String(value);
      return origin === 'slide' || origin === 'layout' || origin === 'master' || origin === 'pdf-artifact' || origin === 'raster-region'
        ? reviewMessage(`evidence.origin.${origin}`, {})
        : reviewMessage('evidence.none', {});
    }
    case 'placeholder': {
      const kind = typeof value === 'string' ? PLACEHOLDER_KINDS[value] : undefined;
      if (context.class === 'template-furniture') {
        const empty = kind === 'title' || kind === 'subtitle' || kind === 'text' ? kind : 'other';
        return reviewMessage(`evidence.placeholder-empty.${empty}`, {});
      }
      return reviewMessage(kind ? `evidence.placeholder.${kind}` : 'evidence.placeholder.other', {});
    }
    case 'repeat-count':
      if (typeof value === 'string') return reviewMessage('evidence.match.exact', {});
      return reviewMessage(repeatCode(context.kind), { count: count(value) });
    case 'dhash-group':
      return reviewMessage('evidence.match.dhash', {});
    case 'path-hash-group':
      return reviewMessage('evidence.match.path-hash', {});
    case 'repeat-share':
      return reviewMessage('evidence.repeat-share', { percent: percent(value) });
    case 'position-jitter':
      return reviewMessage('evidence.position-jitter', { percent: Math.max(1, percent(value)) });
    case 'margin-zone':
      if (value === 'top') return reviewMessage('evidence.margin.top', {});
      if (value === 'bottom') return reviewMessage('evidence.margin.bottom', {});
      return reviewMessage('evidence.margin.edge', {});
    case 'area-share':
      return reviewMessage('evidence.area-share', { percent: percent(value) });
    case 'aspect':
      return reviewMessage('evidence.aspect', { ratio: typeof value === 'number' ? Math.round(value * 10) / 10 : String(value) });
    case 'text-length': {
      const n = count(value);
      if (n === 0) return reviewMessage('evidence.no-text', {});
      return n === 1 ? reviewMessage('evidence.words.one', { count: 1 }) : reviewMessage('evidence.words.many', { count: n });
    }
    case 'text-size': {
      const pt = typeof value === 'number' ? Math.round(value * 10) / 10 : 0;
      const n = words ? count(words.value) : 0;
      if (n === 1) return reviewMessage('evidence.text-size.words.one', { count: 1, pt });
      if (n > 1) return reviewMessage('evidence.text-size.words.many', { count: n, pt });
      return reviewMessage('evidence.text-size', { pt });
    }
    case 'size-rank': {
      const rank = count(value);
      if (rank === 0) return reviewMessage('evidence.size-rank.first', {});
      if (rank === 1) return reviewMessage('evidence.size-rank.second', {});
      if (rank === 2) return reviewMessage('evidence.size-rank.third', {});
      return reviewMessage('evidence.size-rank.other', { count: rank });
    }
    case 'digit-normalised-repeat':
      return reviewMessage(context.class === 'page-number' ? 'evidence.digits.page-number' : 'evidence.digits.line', {});
    case 'native-tag':
      if (context.class === 'unknown') {
        return reviewMessage(value === 'unavailable' ? 'evidence.unavailable' : 'evidence.unmatched', {});
      }
      return reviewMessage(nativeTagCode(value), {});
    case 'chart-data':
      return reviewMessage('evidence.chart-data', { count: count(value) });
    case 'ocr-state': {
      const state = String(value);
      return state === 'unavailable' || state === 'no-text-found' || state === 'text-found'
        ? reviewMessage(`evidence.ocr.${state}`, {})
        : reviewMessage('evidence.ocr.not-run', {});
    }
    case 'ocr-density':
      return reviewMessage('evidence.ocr-density', {});
    case 'edge-stats':
      if (context.class === 'chart') return reviewMessage('evidence.edges.chart', {});
      return reviewMessage(context.class === 'screenshot' ? 'evidence.edges.screenshot' : 'evidence.edges.photo', {});
    case 'colour-discreteness':
      return reviewMessage('evidence.colours', { count: count(value) });
    case 'fill-count':
      if (context.class !== 'diagram') return reviewMessage('evidence.filled-shape', {});
      return reviewMessage(context.kind === 'shape' ? 'evidence.fills.part' : 'evidence.fills', { count: count(value) });
    case 'known-identity':
      return reviewMessage('evidence.known-identity', { label: String(value) });
    case 'column-alignment':
      return reviewMessage('evidence.column-alignment', {});
    default:
      return reviewMessage('evidence.none', {});
  }
}

/** The evidence message for one row: the leading evidence row, else where the object came from. */
function rowEvidenceMessage(row: ObjectPlanV1 | undefined, object: SourceObjectV1 | undefined): ReviewMessageV1 {
  const evidence = row?.evidence ?? [];
  const lead = leadingEvidence(evidence);
  if (row && lead >= 0) {
    return evidenceMessage(evidence, lead, { class: row.class, ...(object?.kind ? { kind: object.kind } : {}) });
  }
  const origin = object?.origin;
  if (origin) return reviewMessage(`evidence.origin.${origin}`, {});
  return reviewMessage('evidence.none', {});
}

/**
 * The noun an item is named by. Template furniture, ornament and an unclassed
 * picture or drawing are named by what they are made of, since "template item"
 * or "object" says less than "picture".
 */
function nounKey(klass: ObjectClassV1, kind: SourceObjectKindV1 | undefined): ReviewNounKeyV1 {
  if (klass === 'template-furniture' || klass === 'decoration') {
    switch (kind) {
      case 'pic': return 'picture';
      case 'vector': return 'drawing';
      case 'text': return klass === 'template-furniture' ? 'recurring-text' : 'label';
      case 'table': return 'table';
      case 'chart': return 'chart';
      case 'shape': return 'decoration';
      default: return klass;
    }
  }
  if (klass === 'unknown' && kind === 'pic') return 'picture';
  if (klass === 'unknown' && kind === 'vector') return 'drawing';
  // A freeform the census reads as one part of a drawing: "811 drawing parts",
  // not "811 diagrams", since each shape is a piece of an icon or a figure.
  if (klass === 'diagram' && kind === 'shape') return 'drawing-part';
  return klass;
}

/**
 * The noun a sentence names one object by, from its class and its kind: the
 * words a person reads, never the class id or the object kind a file states.
 * The compile's report names objects with it too, so the review and the report
 * say the same thing about the same object.
 */
export function nounFor(klass: ObjectClassV1, kind?: SourceObjectKindV1): string {
  return REVIEW_NOUNS[nounKey(klass, kind)].one;
}

// ─── indexing the inputs once ────────────────────────────────────────────────

interface RowInfo {
  row: ObjectPlanV1;
  slideId: string;
  /** 1-based position in the source deck. */
  slideNumber: number;
  /** Paint position within the slide, for a stable order inside one slide. */
  position: number;
  object?: SourceObjectV1;
}

interface Index {
  rows: RowInfo[];
  byId: Map<string, RowInfo>;
  slideNumberOf: Map<string, number>;
}

function indexPlan(plan: RenovationPlanV1, source: SourceDeckV1): Index {
  const slideNumberOf = new Map<string, number>();
  const objectOf = new Map<string, SourceObjectV1>();
  source.slides.forEach((slide, i) => {
    slideNumberOf.set(slide.id, i + 1);
    for (const object of slide.objects) objectOf.set(object.id, object);
  });
  const rows: RowInfo[] = [];
  const byId = new Map<string, RowInfo>();
  plan.slides.forEach((slide, i) => {
    const slideNumber = slideNumberOf.get(slide.id) ?? i + 1;
    if (!slideNumberOf.has(slide.id)) slideNumberOf.set(slide.id, slideNumber);
    slide.objects.forEach((row, position) => {
      const info: RowInfo = { row, slideId: slide.id, slideNumber, position };
      const object = objectOf.get(row.id);
      if (object) info.object = object;
      rows.push(info);
      byId.set(row.id, info);
    });
  });
  return { rows, byId, slideNumberOf };
}

// ─── the queue ───────────────────────────────────────────────────────────────

/** Classes whose rows repeat by nature, so ungrouped rows of one kind become one item. */
const REPEATING_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>([
  'page-number',
  'date',
  'footer',
  'recurring-text',
  'template-furniture',
  'decoration',
]);

function repeatsByEvidence(row: ObjectPlanV1): boolean {
  return row.evidence.some((one) => (one.signal === 'repeat-count' && typeof one.value === 'number' && one.value > 1)
    || (one.signal === 'digit-normalised-repeat' && one.value === true));
}

/** The action most members take; a tie goes to the exemplar's, then to contract order. */
function majorityAction(members: RowInfo[], exemplar: RowInfo): PlanActionV1 {
  const counts = new Map<PlanActionV1, number>();
  for (const member of members) {
    const action = effectiveAction(member.row);
    counts.set(action, (counts.get(action) ?? 0) + 1);
  }
  let best = 0;
  for (const count of counts.values()) best = Math.max(best, count);
  const tied = PLAN_ACTIONS.filter((action) => (counts.get(action) ?? 0) === best);
  const own = effectiveAction(exemplar.row);
  return tied.includes(own) ? own : (tied[0] ?? own);
}

function byRowOrder(a: RowInfo, b: RowInfo): number {
  return (a.slideNumber - b.slideNumber) || (a.position - b.position) || compareText(a.row.id, b.row.id);
}

interface Draft {
  id: string;
  members: RowInfo[];
  exemplar: RowInfo;
  klass: ObjectClassV1;
  groupId?: string;
  /** How the title is phrased: one object, a verified group, a bucket of repeats, or several on one slide. */
  shape: 'one' | 'same' | 'across' | 'several';
}

function titleFor(draft: Draft, action: PlanActionV1, section: QueueSectionV1, slides: number[]): ReviewMessageV1 {
  const key = nounKey(draft.klass, draft.exemplar.object?.kind);
  const noun = REVIEW_NOUNS[key];
  const count = draft.members.length;
  const first = slides[0] ?? draft.exemplar.slideNumber;
  const one = { nounCode: `noun.${key}.one` };
  const many = { nounCode: `noun.${key}.many` };

  // "Could not be drawn" only when every member could not be; a group with one
  // missing member keeps its own title and the fidelity badge says the rest.
  const missing = draft.members.filter((member) => reviewFidelity(member.object) === 'unavailable').length;
  if (missing === count) {
    if (count === 1) return reviewMessage('title.one-unavailable', { ...one, noun: noun.one, slide: first });
    return reviewMessage('title.many-unavailable', { ...many, nouns: noun.many, count });
  }
  if (draft.shape === 'one') return reviewMessage('title.one', { ...one, noun: noun.one, slide: first });
  if (draft.shape === 'several') return reviewMessage('title.several', { ...many, nouns: noun.many, count, slide: first });
  if (slides.length < 2) return reviewMessage(`title.several.${action}`, { ...many, nouns: noun.many, count, slide: first });

  const inherited = draft.members.every((member) => member.object?.origin === 'master' || member.object?.origin === 'layout');
  const describes = draft.klass === 'template-furniture' || draft.klass === 'recurring-text' || draft.klass === 'footer';
  if (section === 'attention' && inherited && describes) {
    const fromLayout = draft.members.every((member) => member.object?.origin === 'layout');
    return reviewMessage(fromLayout ? 'title.layout' : 'title.master', { ...one, noun: noun.one, slides: slides.length });
  }
  if (draft.shape === 'same') return reviewMessage(`title.same.${action}`, { ...one, noun: noun.one, slides: slides.length });
  return reviewMessage(`title.across.${action}`, { ...many, nouns: noun.many, slides: slides.length });
}

/**
 * The pictures a slide picture was cut into that no rule named: the rebuild of a
 * picture deck itself (plan 275 decision 29). One card says the slides were rebuilt
 * and asks for a look at each, rather than proposing to keep each cut-out picture
 * (close-out F8).
 */
function rebuiltPictures(members: readonly RowInfo[]): boolean {
  return members.length > 0 && members.every((member) => member.row.class === 'unknown'
    && member.row.proposal === 'keep'
    && member.object?.origin === 'raster-region'
    && member.object.kind === 'pic');
}

/**
 * The evidence of a card counted over the card's own members: a share of slides is
 * the share of the deck the card's slides are, so the sentence and the title count
 * one set (close-out F5). Every other sentence is the exemplar's as it was.
 */
function evidenceOver(evidence: ReviewMessageV1, slides: number, deckSlides: number): ReviewMessageV1 {
  if (evidence.code !== 'evidence.repeat-share' || deckSlides <= 0) return evidence;
  return reviewMessage('evidence.repeat-share', { percent: percent(slides / deckSlides) });
}

function finishItem(draft: Draft, deckSlides: number): QueueItemV1 {
  const members = [...draft.members].sort(byRowOrder);
  const action = members.length === 1 ? effectiveAction(draft.exemplar.row) : majorityAction(members, draft.exemplar);
  // The replacement a view passes back when it applies this item.
  const replacement = effectiveReplacement(draft.exemplar.row);
  let review: ReviewStateV1 = 'accepted';
  let fidelity: ReviewFidelityV1 = 'editable';
  const lockedIds: string[] = [];
  const correctedIds: string[] = [];
  const mixedIds: string[] = [];
  for (const member of members) {
    review = strongerReview(review, member.row.review);
    fidelity = weakerFidelity(fidelity, reviewFidelity(member.object));
    if (member.row.locked) lockedIds.push(member.row.id);
    if (isCorrected(member.row, action, replacement)) correctedIds.push(member.row.id);
    else if (effectiveAction(member.row) !== action) mixedIds.push(member.row.id);
  }
  const section = sectionOf(review);
  const slideIds: string[] = [];
  const slideNumbers: number[] = [];
  for (const member of members) {
    if (slideIds.includes(member.slideId)) continue;
    slideIds.push(member.slideId);
    slideNumbers.push(member.slideNumber);
  }
  const item: QueueItemV1 = {
    id: draft.id,
    section,
    class: draft.klass,
    action,
    proposal: draft.exemplar.row.proposal,
    review,
    objectIds: members.map((member) => member.row.id),
    lockedIds,
    correctedIds,
    mixedIds,
    slideIds,
    slideNumbers,
    exemplar: draft.exemplar.row.id,
    title: titleFor({ ...draft, members }, action, section, slideNumbers),
    evidence: lettersEvidence(members) ?? evidenceOver(rowEvidenceMessage(draft.exemplar.row, draft.exemplar.object), slideIds.length, deckSlides),
    fidelity,
  };
  if (rebuiltPictures(members)) {
    const count = slideIds.length;
    item.title = count === 1
      ? reviewMessage('title.rebuilt.one', { slide: slideNumbers[0] ?? draft.exemplar.slideNumber })
      : reviewMessage('title.rebuilt.many', { count });
    item.evidence = reviewMessage('evidence.rebuilt', {});
  }
  if (QUIET_EVIDENCE.has(item.evidence.code)) item.evidenceAddsFact = false;
  if (replacement) item.replacement = replacement;
  if (draft.groupId) item.groupId = draft.groupId;
  return item;
}

/** The most single letters a card names in its evidence; more reads as a list, not a fact. */
const LETTERS_MAX = 12;

/**
 * The evidence of a card whose members are single letters, one on each slide (a
 * letter badge on every slide of a section): the letters in slide order, which say
 * more than their type size does. Null when a member is not one letter, when two
 * share a slide, and for a card of one.
 */
function lettersEvidence(members: readonly RowInfo[]): ReviewMessageV1 | null {
  if (members.length < 2 || members.length > LETTERS_MAX) return null;
  const letters: string[] = [];
  const slides = new Set<string>();
  for (const member of members) {
    const text = member.object ? textOf(member.object) : '';
    if (!/^\p{L}$/u.test(text) || slides.has(member.slideId)) return null;
    slides.add(member.slideId);
    letters.push(text);
  }
  return reviewMessage('evidence.letters', { letters: letters.join(', '), count: letters.length });
}

/**
 * Evidence that says nothing a card's title does not: where the object is when that
 * is the slide, no evidence, and text that was never read in a picture (said only
 * when reading was tried).
 */
const QUIET_EVIDENCE: ReadonlySet<string> = new Set(['evidence.origin.slide', 'evidence.none', 'evidence.unmatched', 'evidence.ocr.not-run']);

/**
 * One card per class, proposal and kind of object across the deck (plan 275 finding
 * F11): five verified groups of master bars are one "Remove shapes on 12 slides"
 * card, not five cards with one title. Where the drafts merged include verified
 * census groups, the card keeps the id of the largest (then the first by id), so a
 * group scope stamped with it still names the card; otherwise the id is `kind:` and
 * the key. A key held by one draft keeps that draft as it was.
 */
function collapseDrafts(drafts: Draft[]): Draft[] {
  const byKey = new Map<string, Draft[]>();
  const order: string[] = [];
  for (const draft of drafts) {
    const key = [draft.klass, draft.exemplar.row.proposal, draft.exemplar.object?.kind ?? 'unknown'].join(':');
    const list = byKey.get(key);
    if (list) list.push(draft);
    else {
      byKey.set(key, [draft]);
      order.push(key);
    }
  }
  const out: Draft[] = [];
  for (const key of order) {
    const list = byKey.get(key) ?? [];
    if (list.length === 1) {
      out.push(list[0] as Draft);
      continue;
    }
    const members = list.flatMap((draft) => draft.members).sort(byRowOrder);
    const grouped = list.filter((draft) => draft.groupId !== undefined)
      .sort((a, b) => (b.members.length - a.members.length) || compareText(a.id, b.id));
    const lead = grouped[0] ?? list[0] as Draft;
    const slides = new Set(members.map((member) => member.slideId)).size;
    const merged: Draft = {
      id: grouped[0]?.id ?? `kind:${key}`,
      members,
      exemplar: lead.exemplar,
      klass: lead.klass,
      shape: slides > 1 ? 'across' : 'several',
    };
    if (grouped[0]?.groupId) merged.groupId = grouped[0].groupId;
    out.push(merged);
  }
  return out;
}

/** A structure's name for a card title: the layout library's own, else its id. */
function layoutWords(structure: string): string {
  return findStructure(structure)?.name ?? structure;
}

/**
 * The slide-level items (plan 275 section 3.3): one `layout-group` card per
 * structure and band the matcher read, and one `diagram` card for the slides that
 * read as diagrams.
 *
 * A layout group holds the included slides whose layout the matcher read with a
 * clear or likely band and that still carry the rule's own layout
 * (`layoutSource: 'proposed'`). It counts as one item: a clear group sits under
 * Suggestions (under Needs attention when `layoutGroupsNeedAttention` is set), a
 * likely group under Needs attention. There is no field on a plan that records a
 * group as answered, so the answer is read from what a person did: the group is
 * settled once none of its slides still waits (every row on it answered, the way
 * Accept all leaves them, or its layout chosen by a person, a preset or Auto-match).
 */
function slideItems(plan: RenovationPlanV1, index: Index, opts: ReviewQueueOptsV1): QueueItemV1[] {
  const waiting = new Set<string>();
  for (const slide of plan.slides) {
    if (!slide.include) continue;
    if (slide.objects.some((row) => row.decision === undefined && row.locked !== true && (row.review === 'unreviewed' || row.review === 'needs-attention'))) {
      waiting.add(slide.id);
    }
  }
  const numberOf = (id: string): number => index.slideNumberOf.get(id) ?? 0;
  const groups = new Map<string, SlidePlanV1[]>();
  const diagrams: SlidePlanV1[] = [];
  for (const slide of plan.slides) {
    if (!slide.include) continue;
    const match = slide.layoutMatch;
    const dense = (slide.layoutReasons ?? []).some((one) => one.code === 'layout.reason.dense');
    if (dense && match?.band !== 'clear' && slide.arrangement === undefined) diagrams.push(slide);
    if (!match || match.band === 'none' || slide.layoutSource !== 'proposed') continue;
    const key = match.structure;
    const list = groups.get(key) ?? [];
    list.push(slide);
    groups.set(key, list);
  }
  const out: QueueItemV1[] = [];
  for (const key of [...groups.keys()].sort(compareText)) {
    const slides = (groups.get(key) ?? []).sort((a, b) => numberOf(a.id) - numberOf(b.id));
    const first = slides[0];
    const match = first?.layoutMatch;
    if (!first || !match) continue;
    // One card per structure; a group any of whose slides is only a likely read is likely.
    const band: LayoutMatchBandV1 = slides.some((slide) => slide.layoutMatch?.band === 'likely') ? 'likely' : 'clear';
    const open = slides.some((slide) => waiting.has(slide.id));
    const section: QueueSectionV1 = !open ? 'settled' : band === 'likely' || opts.layoutGroupsNeedAttention ? 'attention' : 'suggestions';
    const layout = layoutWords(match.structure);
    const count = slides.length;
    const titleCode: ReviewMessageCodeV1 = band === 'likely'
      ? (count === 1 ? 'title.layout-group.likely.one' : 'title.layout-group.likely.many')
      : (count === 1 ? 'title.layout-group.one' : 'title.layout-group.many');
    const lead = slides.find((slide) => slide.layoutMatch?.band === band) ?? first;
    const evidence = lead.layoutReasons?.[0] ?? reviewMessage('evidence.none', {});
    const item: QueueItemV1 = {
      id: `layout:${key}`,
      section,
      class: 'unknown',
      action: 'keep',
      proposal: 'keep',
      review: section === 'settled' ? 'accepted' : section === 'attention' ? 'needs-attention' : 'unreviewed',
      objectIds: [],
      lockedIds: [],
      correctedIds: [],
      mixedIds: [],
      slideIds: slides.map((slide) => slide.id),
      slideNumbers: slides.map((slide) => numberOf(slide.id)),
      exemplar: first.id,
      title: reviewMessage(titleCode, { count, slide: numberOf(first.id), layout, structure: match.structure }),
      evidence,
      fidelity: 'editable',
      type: 'layout-group',
      layout: { structure: match.structure, band, archetype: band === 'likely' ? (lead.layoutAlternative ?? lead.layout) : lead.layout },
    };
    out.push(item);
  }
  if (diagrams.length > 0) {
    const slides = diagrams.sort((a, b) => numberOf(a.id) - numberOf(b.id));
    const first = slides[0] as SlidePlanV1;
    const count = slides.length;
    const open = slides.some((slide) => slide.layoutSource === 'proposed');
    out.push({
      id: 'diagram:slides',
      section: open ? 'attention' : 'settled',
      class: 'diagram',
      action: 'keep',
      proposal: 'keep',
      review: open ? 'needs-attention' : 'accepted',
      objectIds: [],
      lockedIds: [],
      correctedIds: [],
      mixedIds: [],
      slideIds: slides.map((slide) => slide.id),
      slideNumbers: slides.map((slide) => numberOf(slide.id)),
      exemplar: first.id,
      title: reviewMessage(count === 1 ? 'title.diagram.one' : 'title.diagram.many', { count, slide: numberOf(first.id) }),
      evidence: reviewMessage('evidence.diagram', {}),
      fidelity: 'editable',
      type: 'diagram',
    });
  }
  return out;
}

/**
 * The review queue: needs attention, then suggestions, then settled, each by
 * first slide number, then by class in contract order, then by id.
 */
export function reviewQueue(plan: RenovationPlanV1, census: DeckCensusV1, source: SourceDeckV1, opts: ReviewQueueOptsV1 = {}): QueueItemV1[] {
  const index = indexPlan(plan, source);
  const drafts: Draft[] = [];
  const claimed = new Set<string>();

  // 1. Verified census groups, members only.
  const groups: ObjectGroupV1[] = [...census.groups].sort((a, b) => compareText(a.id, b.id));
  for (const group of groups) {
    const members = group.members
      .filter((id) => !claimed.has(id))
      .map((id) => index.byId.get(id))
      .filter((info): info is RowInfo => info !== undefined)
      .sort(byRowOrder);
    const first = members[0];
    if (!first) continue;
    for (const member of members) claimed.add(member.row.id);
    const exemplar = members.find((member) => member.row.id === group.exemplar) ?? first;
    const klass = group.class !== 'unknown' ? group.class : exemplar.row.class;
    drafts.push({
      id: group.id,
      members,
      exemplar,
      klass,
      groupId: group.id,
      shape: members.length > 1 ? 'same' : 'one',
    });
  }

  // 2. Ungrouped rows that repeat, bucketed by class, proposal, evidence kind and
  //    object kind. The proposal rather than the effective action, so an apply
  //    does not move a row to another item; members that differ are `mixedIds`.
  const buckets = new Map<string, RowInfo[]>();
  const singles: RowInfo[] = [];
  for (const info of index.rows) {
    if (claimed.has(info.row.id)) continue;
    if (REPEATING_CLASSES.has(info.row.class) || repeatsByEvidence(info.row)) {
      const key = [info.row.class, info.row.proposal, evidenceKind(info.row), info.object?.kind ?? 'unknown'].join(':');
      const list = buckets.get(key) ?? [];
      list.push(info);
      buckets.set(key, list);
    } else {
      singles.push(info);
    }
  }
  for (const key of [...buckets.keys()].sort(compareText)) {
    const members = (buckets.get(key) ?? []).sort(byRowOrder);
    const slides = new Set(members.map((member) => member.slideId));
    const first = members[0];
    if (!first) continue;
    if (slides.size < 2) {
      singles.push(...members);
      continue;
    }
    drafts.push({ id: `rep:${key}`, members, exemplar: first, klass: first.row.class, shape: 'across' });
  }

  // 3. Everything else, one item per class, proposal and kind of object across the
  //    deck (plan 275 finding F11): the photos of a deck are one card, not one card a
  //    slide, and a row with no such sibling is an item of its own. The proposal
  //    rather than the effective action, for the reason step 2 gives: a decision on
  //    one member must not move it to another item under the pointer, so a member
  //    decided otherwise stays and is counted in `correctedIds` or `mixedIds`.
  const byKind = new Map<string, RowInfo[]>();
  for (const info of singles) {
    const key = [info.row.class, info.row.proposal, info.object?.kind ?? 'unknown'].join(':');
    const list = byKind.get(key) ?? [];
    list.push(info);
    byKind.set(key, list);
  }
  for (const key of [...byKind.keys()].sort(compareText)) {
    const members = (byKind.get(key) ?? []).sort(byRowOrder);
    const first = members[0];
    if (!first) continue;
    if (members.length === 1) {
      drafts.push({ id: `obj:${first.row.id}`, members, exemplar: first, klass: first.row.class, shape: 'one' });
      continue;
    }
    const slides = new Set(members.map((member) => member.slideId)).size;
    drafts.push({ id: `kind:${key}`, members, exemplar: first, klass: first.row.class, shape: slides > 1 ? 'across' : 'several' });
  }

  const deckSlides = source.slides.length;
  const items = [...collapseDrafts(drafts).map((draft) => finishItem(draft, deckSlides)), ...slideItems(plan, index, opts)];
  return items.sort((a, b) => (SECTION_RANK[a.section] - SECTION_RANK[b.section])
    || ((a.slideNumbers[0] ?? 0) - (b.slideNumbers[0] ?? 0))
    || ((CLASS_RANK.get(a.class) ?? 0) - (CLASS_RANK.get(b.class) ?? 0))
    || compareText(a.id, b.id));
}

// ─── per-object and per-slide states ─────────────────────────────────────────

/** The three states of every plan row, by object id. */
export function objectStates(plan: RenovationPlanV1, source: SourceDeckV1): Map<string, ObjectStateV1> {
  const index = indexPlan(plan, source);
  const out = new Map<string, ObjectStateV1>();
  for (const info of index.rows) {
    const state: ObjectStateV1 = {
      id: info.row.id,
      slideId: info.slideId,
      action: effectiveAction(info.row),
      review: info.row.review,
      fidelity: reviewFidelity(info.object),
      locked: info.row.locked === true,
      class: info.row.class,
    };
    if (info.row.author !== undefined) state.author = info.row.author;
    out.set(info.row.id, state);
  }
  return out;
}

const TITLE_MAX = 80;

function textOf(object: SourceObjectV1): string {
  return (object.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function largestRunPt(object: SourceObjectV1): number {
  let max = 0;
  for (const para of object.text?.paras ?? []) for (const run of para.runs) max = Math.max(max, run.sizePt ?? 0);
  return max;
}

/** The slide's name for a filmstrip: the first title, else the largest text. */
function slideTitle(objects: SourceObjectV1[], rows: Map<string, ObjectPlanV1>): string | undefined {
  const withText = objects.filter((object) => textOf(object).length > 0);
  const titled = withText.find((object) => {
    const klass = rows.get(object.id)?.class;
    return klass === 'title' || object.placeholder === 'title' || object.placeholder === 'ctrTitle';
  });
  let pick = titled;
  if (!pick) {
    let best = -1;
    for (const object of withText) {
      const size = largestRunPt(object);
      if (size > best) {
        best = size;
        pick = object;
      }
    }
  }
  if (!pick) return undefined;
  return textOf(pick).slice(0, TITLE_MAX).trimEnd();
}

/**
 * The effective deck order: included slides by `order`, with the source index
 * standing in for a slide that states none, then by source index; excluded
 * slides after, in source order.
 */
export function effectiveSlideOrder(plan: RenovationPlanV1, source?: SourceDeckV1): SlidePlanV1[] {
  const sourceIndex = new Map<string, number>();
  (source?.slides ?? []).forEach((slide, i) => {
    sourceIndex.set(slide.id, i);
  });
  const indexOf = (slide: SlidePlanV1, fallback: number): number => sourceIndex.get(slide.id) ?? fallback;
  const rows = plan.slides.map((slide, i) => ({ slide, at: indexOf(slide, i) }));
  const included = rows.filter((row) => row.slide.include)
    .sort((a, b) => ((a.slide.order ?? a.at) - (b.slide.order ?? b.at)) || (a.at - b.at));
  const excluded = rows.filter((row) => !row.slide.include).sort((a, b) => a.at - b.at);
  return [...included, ...excluded].map((row) => row.slide);
}

/** One state row per slide, in effective deck order. */
export function slideStates(plan: RenovationPlanV1, source: SourceDeckV1, census?: DeckCensusV1): SlideStateV1[] {
  const sourceById = new Map(source.slides.map((slide, i) => [slide.id, { slide, number: i + 1 }]));
  const layoutOf = new Map((census?.layouts ?? []).map((row) => [row.slideId, row.sourceLayout]));
  return effectiveSlideOrder(plan, source).map((slidePlan, order): SlideStateV1 => {
    const found = sourceById.get(slidePlan.id);
    const objects = found?.slide.objects ?? [];
    const objectById = new Map(objects.map((object) => [object.id, object]));
    const rows = new Map(slidePlan.objects.map((row) => [row.id, row]));
    let attention = 0;
    let unreviewed = 0;
    let removed = 0;
    let unresolved = 0;
    let fidelity: ReviewFidelityV1 = 'editable';
    for (const row of slidePlan.objects) {
      if (row.review === 'needs-attention') attention += 1;
      if (row.review === 'unreviewed') unreviewed += 1;
      const action = effectiveAction(row);
      if (action === 'remove') {
        removed += 1;
        continue;
      }
      const shown = reviewFidelity(objectById.get(row.id));
      if (shown === 'unavailable') unresolved += 1;
      fidelity = weakerFidelity(fidelity, shown);
    }
    const state: SlideStateV1 = {
      id: slidePlan.id,
      number: found?.number ?? plan.slides.indexOf(slidePlan) + 1,
      include: slidePlan.include,
      order,
      layout: slidePlan.layout,
      layoutSource: slidePlan.layoutSource,
      attention,
      unreviewed,
      removed,
      unresolved,
      fidelity,
    };
    const sourceLayout = layoutOf.get(slidePlan.id) ?? found?.slide.origin.layout;
    if (sourceLayout !== undefined) state.sourceLayout = sourceLayout;
    const title = slideTitle(objects, rows);
    if (title) state.title = title;
    return state;
  });
}

// ─── the footer and the report drawer ────────────────────────────────────────

function sameFace(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * A plain shape: a box or a line with no picture to stand for it. The compile
 * has no slot for one on an archetype, so a kept one waits in the tray.
 */
function isPlainShape(object: SourceObjectV1): boolean {
  return object.kind === 'shape' && !object.media && !object.fidelity.fallbackAssetRef;
}

/** The counts the footer and the report drawer show before a compile. */
export function planSummary(plan: RenovationPlanV1, source: SourceDeckV1, census?: DeckCensusV1): PlanSummaryV1 {
  const objectOf = new Map<string, SourceObjectV1>();
  for (const slide of source.slides) for (const object of slide.objects) objectOf.set(object.id, object);

  const objects = { keep: 0, replace: 0, remove: 0, unresolved: 0, unplaced: 0 };
  const review = { attention: 0, unreviewed: 0, accepted: 0 };
  let included = 0;
  for (const slide of plan.slides) {
    if (slide.include) included += 1;
    for (const row of slide.objects) {
      if (row.review === 'needs-attention') review.attention += 1;
      else if (row.review === 'unreviewed') review.unreviewed += 1;
      else review.accepted += 1;
      if (!slide.include) continue;
      const action = effectiveAction(row);
      objects[action] += 1;
      const object = objectOf.get(row.id);
      if (action !== 'remove' && reviewFidelity(object) === 'unavailable') objects.unresolved += 1;
      else if (action === 'keep' && object && isPlainShape(object)) objects.unplaced += 1;
    }
  }

  const colours = { assigned: 0, unresolved: 0, locked: 0 };
  for (const row of plan.colors) {
    if (row.unresolved) colours.unresolved += 1;
    else if (row.to) colours.assigned += 1;
    if (row.locked) colours.locked += 1;
  }

  const flattened = census
    ? census.flattenedSlideIds.length
    : source.slides.filter((slide) => slide.origin.flattened === true).length;

  return {
    slides: { total: plan.slides.length, included },
    objects,
    review,
    colours,
    fonts: { substituted: plan.fonts.filter((row) => !sameFace(row.from, row.to)).length },
    flattened,
  };
}

/**
 * Rows that still wait for an answer before the plan can compile as reviewed, in
 * plan order: no decision, a review state of unreviewed or needs attention, not
 * locked, on a slide the deck includes. This is the one rule every surface gates
 * Open in Design (or a compile without `--accept-suggestions`) on and reads its
 * waiting count from, and exactly the rows `acceptSuggestions` with `scope: 'all'`
 * answers on its default of included slides only. A slide left out is not
 * compiled, so its rows never hold anything back; a locked row is a person's own
 * hold, which nothing answers for them.
 */
export function openPendingIds(plan: RenovationPlanV1): string[] {
  return openPendingRows(plan).map((row) => row.id);
}

/** The rows `openPendingIds` names, as rows, so the ids and the counts share one test. */
function openPendingRows(plan: RenovationPlanV1): ObjectPlanV1[] {
  const out: ObjectPlanV1[] = [];
  for (const slide of plan.slides) {
    if (!slide.include) continue;
    for (const row of slide.objects) {
      if (row.decision !== undefined || row.locked === true) continue;
      if (row.review === 'unreviewed' || row.review === 'needs-attention') out.push(row);
    }
  }
  return out;
}

/**
 * The rows `openPendingIds` names, split by review state: `pending` the rows
 * nobody reviewed, `attention` the rows a rule flagged. The one count every
 * surface shows beside a compile outcome, so a slide left out or a locked row
 * never reads as waiting on one surface and settled on another.
 */
export function openPendingCounts(plan: RenovationPlanV1): { pending: number; attention: number } {
  const open = openPendingRows(plan);
  const attention = open.filter((row) => row.review === 'needs-attention').length;
  return { pending: open.length - attention, attention };
}

/** Rows a named "Accept all suggestions" would answer: unreviewed, undecided and not locked, in plan order. */
export function pendingSuggestionIds(plan: RenovationPlanV1): string[] {
  const out: string[] = [];
  for (const slide of plan.slides) {
    for (const row of slide.objects) {
      if (row.review === 'unreviewed' && row.decision === undefined && row.locked !== true) out.push(row.id);
    }
  }
  return out;
}
