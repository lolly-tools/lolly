// SPDX-License-Identifier: MPL-2.0
/**
 * Which archetype a source slide should be poured into (plan 274 section 3.3).
 *
 * The census measured every slide into a `LayoutFeaturesV1` vector; this module
 * scores that vector against the archetypes one slide master declares and picks
 * one. Every rule is a plain comparison over the vector, so a rule can be tested
 * on a hand written feature record with no deck behind it, and every score
 * carries the sentences a review shows instead of a percentage.
 *
 * Three things the feature vector cannot state get their own optional hints: a
 * quotation and a single large figure both need the words themselves, a cover
 * slide needs to know where in the deck it sits, and `LayoutFeaturesV1` carries
 * counts rather than content or position. A caller that has the source passes
 * `ArchetypeHintsV1`; a caller that does not gets no quote, no big-number and no
 * title proposal, which is the honest answer rather than a guess.
 *
 * Coverage comes before taste. When the caller states what the slide keeps
 * (`ArchetypeHintsV1.needs`), an archetype whose slots hold every kind of kept
 * content outranks one that would leave a chart or a picture with nowhere to go,
 * whatever the aesthetic rules below score them: a slide's content that fits no
 * slot ends on another slide, and that costs more than a plainer layout. The
 * exception is a slide with more than `LITTLE_TEXT_WORDS` words, where a layout
 * no rule chose ranks after every layout a rule did choose: its words cost more
 * than one picture moved on. What counts as kept content is the caller's
 * reading; the first pass leaves out icons and small marks (`isIncidentalPicture`
 * in deck-compile.ts), so one small picture never asks for a picture slot.
 *
 * Among archetypes that cover the same share, when the top two are closer than
 * `minGap`, the choice falls back to the plainest content archetype (if it covers
 * as much) and the leader travels as the alternative, so the review can offer it
 * without the first pass having committed to it.
 *
 * Pure: no DOM, no clock, no filesystem, no network, no randomness. The same
 * features and master give the same list on every host.
 */

import type { ArchetypeRefV1, ArchetypeV1, LayoutFeaturesV1, ObjectClassV1, ReviewMessageV1 } from '@lolly-tools/core';
import type { SlideMasterV1 } from '@lolly-tools/core';
import { isKnownArchetypeId } from '@lolly-tools/core';
import { compareCodeUnits } from './rebrand-order.ts';
import { reviewMessage, type ReviewMessageCodeV1 } from './rebrand-review.ts';

/** Identity of these rules, recorded on a plan for replay. */
export const ARCHETYPE_RULES = { name: 'rebrand-archetype', version: 'archetype-2026-09-24.4' } as const;

// ─── the numbers the rules turn on, in one place so a test can read them ─────

/** A title slide carries a title and at most this many words in total. */
export const TITLE_MAX_WORDS = 14;
/** A section header is shorter still, and carries no subtitle of its own. */
export const SECTION_MAX_WORDS = 10;
/** A section header runs to at most this many paragraphs. */
export const SECTION_MAX_PARAGRAPHS = 2;
/** A big-number slide states its figure and at most this many words around it. */
export const BIG_NUMBER_MAX_WORDS = 8;
/** At or under this word count a slide counts as carrying little text. */
export const LITTLE_TEXT_WORDS = 30;
/** Pictures covering at least this share of the slide make it a visual one. */
export const VISUAL_IMAGE_SHARE = 0.2;
/** Pictures covering at least this share of the slide make it a full-bleed one. */
export const FULL_IMAGE_SHARE = 0.6;
/** A picture beside text covers at least this share of the slide. */
export const SPLIT_IMAGE_SHARE_MIN = 0.15;
/** Two equal sibling boxes on two distinct left edges, over `LITTLE_TEXT_WORDS`, read as two columns. */
export const TWO_COLUMN_SIBLINGS = 2;
export const TWO_COLUMN_LEFT_EDGES = 2;
/** The top two candidates closer than this fall back to the content archetype. */
export const ARCHETYPE_MIN_GAP = 0.15;

/**
 * Facts about the slide's own words that the feature vector does not carry.
 * A caller with the source deck computes them; one without passes nothing.
 */
export interface ArchetypeHintsV1 {
  /** The slide's text opens or closes with a quotation mark. */
  quoteMarks?: boolean;
  /** One text object states a figure, with at most a unit or a symbol beside it. */
  bigNumber?: boolean;
  /**
   * The slide opens the deck, or its source layout names itself a title layout.
   * A cover slide states its title and often nothing the census reads as a
   * subtitle, so without this the pair below would answer section header for
   * every deck's opening slide.
   */
  coverSlide?: boolean;
  /**
   * The kinds of content the slide keeps, counted: what the plan will pour into
   * the archetype. Absent means unknown, and every archetype then covers the
   * slide in full, which leaves the aesthetic rules to decide alone.
   */
  needs?: Partial<Record<CoverageRoleV1, number>>;
  /**
   * What the structure matcher (`rebrand-structure.ts`) read: the library id it
   * named with at least a likely band, or null when it read the slide and named
   * nothing. Absent means the matcher did not run (a census from before plan 275).
   * The two-column rule reads it, because boxes of one size on two left edges are
   * two columns only when they stand side by side: in the corpus six of the rule's
   * fifty-four picks were, and the rest were stacks, grids and dense slides.
   */
  structure?: string | null;
}

/** Structures a two-column layout holds: two boxes side by side. */
export const TWO_COLUMN_STRUCTURES: ReadonlySet<string> = new Set(['columns-2', 'text-two-column', 'comparison']);

/** The kinds of kept content an archetype's slots are measured against. */
export const COVERAGE_ROLES = ['title', 'subtitle', 'body', 'visual', 'data', 'note'] as const;
export type CoverageRoleV1 = (typeof COVERAGE_ROLES)[number];

export interface ArchetypeScoreV1 {
  id: ArchetypeRefV1;
  /**
   * Share of the slide's kinds of kept content this archetype has a slot for,
   * zero to one. Ranked before `score`.
   */
  coverage: number;
  /** Zero to one. Comparable inside one call; it is not a probability. */
  score: number;
  /** Slots nothing the slide keeps would fill; fewer wins a tie on coverage and score. */
  spare: number;
  /** One plain sentence per rule that fired, with the numbers in it. */
  reasons: string[];
}

export interface ArchetypePickV1 {
  id: ArchetypeRefV1;
  coverage: number;
  score: number;
  reasons: string[];
  /**
   * The same finding in plain words for a person (plan 275 section 3.3): a coded
   * sentence with no figures in its text, the figures in its params.
   */
  messages: ReviewMessageV1[];
  /** The leader, when the gap to it was under `minGap` and the pick fell back. */
  alternative?: ArchetypeRefV1;
}

export interface PickArchetypeOptsV1 {
  /** Gap under which the top two count as a tie. Defaults to `ARCHETYPE_MIN_GAP`. */
  minGap?: number;
  hints?: ArchetypeHintsV1;
  /** The archetype a tie falls back to. Defaults to `content`. */
  fallback?: ArchetypeRefV1;
}

// ─── reading the feature vector ──────────────────────────────────────────────

function count(features: LayoutFeaturesV1, klass: ObjectClassV1): number {
  return features.counts[klass] ?? 0;
}

interface Measured {
  titles: number;
  subtitles: number;
  bodies: number;
  pictures: number;
  charts: number;
  tables: number;
  words: number;
  paragraphs: number;
  imageShare: number;
  leftEdges: number;
  siblings: number;
}

function measure(features: LayoutFeaturesV1): Measured {
  return {
    titles: count(features, 'title'),
    subtitles: count(features, 'subtitle'),
    bodies: count(features, 'body'),
    pictures: count(features, 'photo') + count(features, 'screenshot') + count(features, 'diagram'),
    // The class count and the presence flag describe the same object: the
    // census sets both for one native chart or table, so this takes the larger
    // of the two rather than their sum, which read one table as two.
    charts: Math.max(count(features, 'chart'), features.chartPresent ? 1 : 0),
    tables: Math.max(count(features, 'table'), features.tablePresent ? 1 : 0),
    words: features.textWords,
    paragraphs: features.textParagraphs,
    imageShare: features.imageAreaShare,
    leftEdges: features.distinctLeftEdges,
    siblings: features.equalSiblingBoxes,
  };
}

type Rule = (m: Measured, hints: ArchetypeHintsV1) => { score: number; reasons: string[] };

/**
 * Does the slide keep a picture? The census counts a photo, a screenshot and a
 * diagram; a picture it could not class (no text was read from it) is known
 * only from the kept content the caller states, which leaves icons out.
 */
function pictured(m: Measured, hints: ArchetypeHintsV1): boolean {
  return m.pictures >= 1 || (hints.needs?.visual ?? 0) > 0;
}

const NOTHING = { score: 0, reasons: [] as string[] };

/**
 * One rule per archetype, from plan 274 section 3.3. Where two archetypes would
 * read the same slide, the pair is made exclusive by a threshold rather than by
 * a tie break, so the gap between them stays wide enough to be a real choice:
 * a picture at or over `FULL_IMAGE_SHARE` is full bleed rather than merely
 * visual, and the title and section pair is exclusive in both directions. A
 * subtitle makes it a title slide; the `coverSlide` hint makes it one as well
 * and takes the section rule out, because a deck's opening slide often carries
 * a title and a date line and nothing the census reads as a subtitle.
 */
const RULES: Partial<Record<ArchetypeRefV1, Rule>> = {
  title(m, hints) {
    if (m.titles < 1 || m.bodies > 0 || m.tables > 0 || m.charts > 0) return NOTHING;
    if (m.words > TITLE_MAX_WORDS || m.imageShare >= VISUAL_IMAGE_SHARE) return NOTHING;
    const reasons = [`A title and no body text, ${m.words} words in all, at or under the ${TITLE_MAX_WORDS} a title slide carries.`];
    if (m.subtitles >= 1) {
      reasons.push('A subtitle sits under the title, which is what a title slide holds and a section header does not.');
      return { score: 0.92, reasons };
    }
    if (hints.coverSlide) {
      reasons.push('The slide opens the deck, so its heading is the deck title rather than a divider.');
      return { score: 0.9, reasons };
    }
    return { score: 0.6, reasons };
  },
  section(m, hints) {
    if (hints.coverSlide) return NOTHING;
    if (m.titles < 1 || m.subtitles > 0 || m.bodies > 0 || m.tables > 0 || m.charts > 0) return NOTHING;
    if (m.words > SECTION_MAX_WORDS || m.paragraphs > SECTION_MAX_PARAGRAPHS) return NOTHING;
    if (m.imageShare >= VISUAL_IMAGE_SHARE) return NOTHING;
    return {
      score: 0.86,
      reasons: [`A heading on its own: ${m.words} words in ${m.paragraphs} paragraphs, no subtitle and no body.`],
    };
  },
  'big-number'(m, hints) {
    if (!hints.bigNumber || m.words > BIG_NUMBER_MAX_WORDS) return NOTHING;
    return { score: 0.95, reasons: [`One figure and ${m.words} words around it.`] };
  },
  table(m) {
    if (m.tables < 1) return NOTHING;
    const reasons = [`The slide carries ${m.tables} ${m.tables === 1 ? 'table' : 'tables'}.`];
    if (m.bodies === 0) return { score: 0.96, reasons };
    return { score: 0.93, reasons };
  },
  'full-image'(m) {
    if (m.imageShare < FULL_IMAGE_SHARE || m.words > LITTLE_TEXT_WORDS) return NOTHING;
    return {
      score: 0.94,
      reasons: [`Pictures cover ${Math.round(m.imageShare * 100)}% of the slide, at or over the ${Math.round(FULL_IMAGE_SHARE * 100)}% a full-bleed picture takes.`],
    };
  },
  visual(m, hints) {
    if (m.imageShare >= FULL_IMAGE_SHARE) return NOTHING;
    if (m.words > LITTLE_TEXT_WORDS) return NOTHING;
    if (m.charts > 0) {
      return { score: 0.88, reasons: [`A chart and ${m.words} words, at or under the ${LITTLE_TEXT_WORDS} that count as little text.`] };
    }
    if (pictured(m, hints) && m.imageShare >= VISUAL_IMAGE_SHARE) {
      return { score: 0.88, reasons: [`One picture over ${Math.round(m.imageShare * 100)}% of the slide and ${m.words} words.`] };
    }
    return NOTHING;
  },
  split(m, hints) {
    // A chart beside more text than a visual slide carries, or with a note line
    // to close it, wants the panel for the words and the slot for the chart.
    if (m.charts >= 1 && m.imageShare < FULL_IMAGE_SHARE) {
      if (m.words > LITTLE_TEXT_WORDS) return { score: 0.9, reasons: [`A chart beside ${m.words} words of text.`] };
      const notes = hints.needs?.note ?? 0;
      if (notes > 0) {
        return { score: 0.8, reasons: [`A chart with ${notes} ${notes === 1 ? 'note line' : 'note lines'} to set beside it.`] };
      }
    }
    if (!pictured(m, hints) || m.words <= LITTLE_TEXT_WORDS) return NOTHING;
    if (m.imageShare < SPLIT_IMAGE_SHARE_MIN || m.imageShare >= FULL_IMAGE_SHARE) return NOTHING;
    return {
      score: 0.9,
      reasons: [`A picture over ${Math.round(m.imageShare * 100)}% of the slide beside ${m.words} words of text.`],
    };
  },
  'two-column'(m, hints) {
    if (hints.structure !== undefined && (hints.structure === null || !TWO_COLUMN_STRUCTURES.has(hints.structure))) return NOTHING;
    if (m.siblings < TWO_COLUMN_SIBLINGS || m.leftEdges < TWO_COLUMN_LEFT_EDGES || m.bodies < 2) return NOTHING;
    // Two columns need enough text to fill them. Without this clause a citation
    // and a unit note of the same size count as a pair of columns, which is what
    // the adversarial fixture does to a rule reading counts alone.
    if (m.words < LITTLE_TEXT_WORDS) return NOTHING;
    return {
      score: 0.9,
      reasons: [`${m.siblings} boxes of the same size on ${m.leftEdges} left edges, with ${m.bodies} bodies of text over ${m.words} words.`],
    };
  },
  quote(m, hints) {
    if (!hints.quoteMarks || m.words > LITTLE_TEXT_WORDS) return NOTHING;
    return { score: 0.93, reasons: [`Quotation marks around ${m.words} words.`] };
  },
  content(m) {
    if (m.titles >= 1 && m.bodies >= 1) {
      return { score: 0.7, reasons: [`A title over ${m.bodies} body text box, ${m.words} words in all.`] };
    }
    return { score: 0.5, reasons: ['Nothing more specific fired, so the plainest content layout stands in.'] };
  },
};

// ─── coverage ────────────────────────────────────────────────────────────────

/**
 * Can this archetype hold one kind of kept content? The table, one line per need:
 *
 *   title     a title slot (a caption is not one: a heading set as a caption over
 *             a full-bleed crop of a chart or a diagram loses both)
 *   subtitle  a subtitle slot, else a body slot (it becomes the first paragraph)
 *   body      a body slot; a number slot for one big figure; a quote slot for a quotation
 *   visual    an image slot (a picture, or a chart kept as its picture)
 *   data      a table slot (a table carried as text)
 *   note      a text slot a citation or a unit line can close: body, caption,
 *             subtitle or attribution
 */
function holds(archetype: ArchetypeV1, need: CoverageRoleV1, hints: ArchetypeHintsV1): boolean {
  const has = (role: string, kind?: string): boolean =>
    archetype.placeholders.some((ph) => ph.role === role && (kind === undefined || ph.kind === kind));
  switch (need) {
    case 'title': return has('title');
    case 'subtitle': return has('subtitle') || has('body');
    case 'body':
      return has('body') || (hints.bigNumber === true && has('number')) || (hints.quoteMarks === true && has('quote'));
    case 'visual': return archetype.placeholders.some((ph) => ph.kind === 'image');
    case 'data': return has('data', 'table');
    case 'note':
      return archetype.placeholders.some((ph) => ph.kind === 'text'
        && (ph.role === 'body' || ph.role === 'caption' || ph.role === 'subtitle' || ph.role === 'attribution'));
    default: return false;
  }
}

/**
 * Share of the slide's kinds of kept content one archetype has a slot for, and
 * how many of its slots nothing kept would fill. A slide that states no needs is
 * covered in full by every archetype and leaves no slot spare.
 */
export function archetypeCoverage(
  archetype: ArchetypeV1,
  hints: ArchetypeHintsV1 = {},
): { coverage: number; missing: CoverageRoleV1[]; spare: number } {
  const wanted = COVERAGE_ROLES.filter((role) => (hints.needs?.[role] ?? 0) > 0);
  if (wanted.length === 0) return { coverage: 1, missing: [], spare: 0 };
  const missing = wanted.filter((role) => !holds(archetype, role, hints));
  // A slot is spare when no kept kind would land in it: an empty picture slot on
  // a slide with no picture, a body slot on a slide with no body text.
  const spare = archetype.placeholders.filter((ph) => {
    if (ph.kind === 'image') return (hints.needs?.visual ?? 0) === 0;
    if (ph.role === 'title') return (hints.needs?.title ?? 0) === 0;
    if (ph.role === 'body') {
      return (hints.needs?.body ?? 0) === 0 && (hints.needs?.subtitle ?? 0) === 0 && (hints.needs?.note ?? 0) === 0;
    }
    if (ph.role === 'data') return (hints.needs?.data ?? 0) === 0;
    return false;
  }).length;
  return { coverage: Math.round(((wanted.length - missing.length) / wanted.length) * 1000) / 1000, missing, spare };
}

/**
 * Score every archetype the master declares against one slide's features.
 * Sorted by coverage, then by score, then by the fewest spare slots, then by id,
 * so two runs agree, with one exception: on a slide carrying more than
 * `LITTLE_TEXT_WORDS` words, an archetype whose rule scored zero ranks after
 * every one that scored above zero. Coverage alone would pour a page of text
 * into a layout no rule chose for it, whose narrow text slot starves the words;
 * past that many words a picture with no slot goes on to a continuation slide
 * instead. An archetype with no rule scores zero and is returned anyway,
 * because a review offers the whole set.
 */
export function scoreArchetypes(
  features: LayoutFeaturesV1,
  master: SlideMasterV1,
  hints: ArchetypeHintsV1 = {},
): ArchetypeScoreV1[] {
  const m = measure(features);
  const out: ArchetypeScoreV1[] = master.archetypes.map((archetype) => {
    const rule = RULES[archetype.id];
    const got = rule ? rule(m, hints) : NOTHING;
    const { coverage, missing, spare } = archetypeCoverage(archetype, hints);
    const reasons = [...got.reasons];
    if (missing.length > 0) reasons.push(`No slot for the ${missing.join(', ')} the slide keeps.`);
    return { id: archetype.id, coverage, score: got.score, spare, reasons };
  });
  const wordy = m.words > LITTLE_TEXT_WORDS;
  const tier = (row: ArchetypeScoreV1): number => (wordy && row.score <= 0 ? 1 : 0);
  // The layout library's archetypes (plan 275) have no rule here yet, so at equal
  // coverage and score one of the twelve ranks first: an unscored Three cards must
  // not take a photo slide from the split layout on the alphabet alone.
  const unknown = (row: ArchetypeScoreV1): number => (isKnownArchetypeId(row.id) ? 0 : 1);
  return out.sort((a, b) => (tier(a) - tier(b)) || (b.coverage - a.coverage) || (b.score - a.score)
    || (unknown(a) - unknown(b)) || (a.spare - b.spare) || compareCodeUnits(a.id, b.id));
}

/**
 * The archetype for one slide. Only archetypes that cover as much of the kept
 * content as the best one compete. Among those, a leader clear of the runner-up
 * by `minGap` is taken; a closer pair falls back to the content archetype when it
 * covers as much, and returns the leader as the alternative, because the plan
 * says the choice is shown with its evidence and a near tie is not evidence.
 */
export function pickArchetype(
  features: LayoutFeaturesV1,
  master: SlideMasterV1,
  opts: PickArchetypeOptsV1 = {},
): ArchetypePickV1 {
  const minGap = opts.minGap ?? ARCHETYPE_MIN_GAP;
  const fallbackId = opts.fallback ?? 'content';
  const hints = opts.hints ?? {};
  const scored = scoreArchetypes(features, master, hints);
  const top = scored[0];
  const m = measure(features);
  if (!top) {
    return {
      id: fallbackId,
      coverage: 0,
      score: 0,
      reasons: ['The master declares no archetype, so the plainest content layout stands in.'],
      messages: [reviewMessage('layout.reason.pick.plain', {})],
    };
  }
  const peers = scored.filter((row) => row.coverage === top.coverage);
  const fallback = peers.find((row) => row.id === fallbackId);
  const second = peers[1];
  const tied = second !== undefined && top.score - second.score < minGap;
  if (!tied || !fallback) {
    return { id: top.id, coverage: top.coverage, score: top.score, reasons: [...top.reasons], messages: pickMessages(top, m) };
  }

  const alternative = top.id === fallback.id ? second?.id : top.id;
  const reasons = [
    `${top.id} and ${second?.id ?? 'the runner-up'} scored within ${minGap} of each other, so the plainest content layout was taken and the leader is offered as the alternative.`,
    ...fallback.reasons,
  ];
  const messages = [
    reviewMessage('layout.reason.pick.tie', { leader: top.id, runnerUp: second?.id ?? '', gap: minGap }),
    ...pickMessages(fallback, m),
  ];
  const pick: ArchetypePickV1 = { id: fallback.id, coverage: fallback.coverage, score: fallback.score, reasons, messages };
  if (alternative && alternative !== fallback.id) pick.alternative = alternative;
  return pick;
}

/**
 * The sentence a person reads for a pick: which rule chose it, in plain words, with
 * the measured figures in the params. A layout no rule chose reads as the plainest
 * standing in.
 */
function pickMessages(row: ArchetypeScoreV1, m: Measured): ReviewMessageV1[] {
  const params = { words: m.words, paragraphs: m.paragraphs, share: Math.round(m.imageShare * 100), score: row.score, coverage: row.coverage };
  if (row.score <= 0) {
    // No rule chose it: it stands in as the plainest layout, or as the one with a
    // place for everything the slide keeps.
    return [reviewMessage(row.id === 'content' || row.coverage < 1 ? 'layout.reason.pick.plain' : 'layout.reason.pick.covers', params)];
  }
  let code: ReviewMessageCodeV1;
  switch (row.id) {
    case 'title': code = 'layout.reason.pick.title'; break;
    case 'section': code = 'layout.reason.pick.section'; break;
    case 'big-number': code = 'layout.reason.pick.big-number'; break;
    case 'table': code = 'layout.reason.pick.table'; break;
    case 'full-image': code = 'layout.reason.pick.full-image'; break;
    case 'visual': code = m.charts > 0 ? 'layout.reason.pick.visual.chart' : 'layout.reason.pick.visual'; break;
    case 'split': code = m.charts > 0 ? 'layout.reason.pick.split.chart' : 'layout.reason.pick.split'; break;
    case 'two-column': code = 'layout.reason.pick.two-column'; break;
    case 'quote': code = 'layout.reason.pick.quote'; break;
    case 'content': code = m.titles >= 1 && m.bodies >= 1 ? 'layout.reason.pick.content' : 'layout.reason.pick.plain'; break;
    default: code = 'layout.reason.pick.plain';
  }
  return [reviewMessage(code, params)];
}
