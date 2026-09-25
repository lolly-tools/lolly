// SPDX-License-Identifier: MPL-2.0
/**
 * The structure matcher (plan 275 section 3): which layout of the library a source
 * slide was drawn as, how sure the read is, and the one opt-in action that applies
 * the reads across a deck (decision 28, Auto-match).
 *
 * The census measured every slide's kept content into units and the containers that
 * hold them (`LayoutFeaturesV1.units` and `containers`). This module reads the
 * relations between those boxes: three text boxes side by side at one height and
 * about one width are three columns, pictures in a row are an image row, a lattice of
 * cards is a grid, rows each opened by a letter are numbered rows. Each rule returns
 * a confidence from 0 to 1, built from measures of likeness (width spread, row alignment,
 * gap regularity, lattice fill), a coverage (the share of the slide's kept body units
 * the structure explains) and sentences in plain words. The measured figures travel
 * in the sentence's `params`, never in its text: a person reads "Three text boxes
 * side by side, about the same width and lined up", the eval reads `widthSpread`.
 *
 * Three bands decide what the first pass does with a read (section 3.3):
 *
 *   clear   confidence at or over `APPLY`, coverage at or over `APPLY_COVERAGE`,
 *           the master carries the structure and has cells enough for the units
 *           the read covers, and no other structure scores as well: the first pass
 *           sets the layout as a proposal.
 *   likely  confidence at or over `PROPOSE` but short of one of those: the plainer
 *           layout stands and the read travels as the alternative.
 *   none    under `PROPOSE`, or explaining under half the content.
 *
 * Slot capacity counts cells, not boxes of a kind (decision 30): every kind of
 * content may take every cell, so a structure applies only when its archetype has at
 * least as many cells (title boxes aside) as the units the read covers need. A repeated
 * cell (a label over its body) is one cell, as a card is one unit. That is what keeps a
 * one-picture full-bleed layout off a slide of three pictures. Numbered list is the one
 * stated exception: its rows continue onto the next slide by design
 * (`CONTINUED_STRUCTURES`).
 *
 * A source layout name is a prior only: an alias table maps PowerPoint's and
 * Google's layout names to library ids, a match adds at most `PRIOR_MAX`, and never
 * lifts a read into another band.
 *
 * Pure: no DOM, no clock, no filesystem, no network, no randomness. Every sort
 * breaks its ties by id in code-unit order, so the same deck reads the same way on
 * every host.
 */

import type {
  ArchetypeRefV1,
  ArchetypeV1,
  DeckCensusV1,
  LayoutFeaturesV1,
  LayoutMatchBandV1,
  LayoutMatchV1,
  LayoutUnitV1,
  ObjectClassV1,
  ObjectPlanV1,
  RebrandReportV1,
  RenovationPlanV1,
  ReportEntryV1,
  ReviewMessageV1,
  SlideMasterV1,
  SlidePlanV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceObjectV1,
} from '@lolly-tools/core';

import { INCIDENTAL_PICTURE_SHARE } from './deck-compile.ts';
import { ARCHETYPE_MIN_GAP } from './rebrand-archetype.ts';
import type { PlanEditResultV1 } from './rebrand-edit.ts';
import { compareCodeUnits } from './rebrand-order.ts';
import { reviewMessage, type ReviewMessageCodeV1 } from './rebrand-review.ts';
import { archetypeForStructure, findStructure } from './slide-structures.ts';

/** Identity of these rules, recorded in the plan's `algorithms.plan` through `PLAN_RULES`. */
export const STRUCTURE_RULES = { name: 'rebrand-structure', version: 'structure-2026-09-25.1' } as const;

// ─── the numbers the rules turn on (plan 275 section 3.5) ────────────────────

/** Two units share a row when their vertical overlap is at least this share of the shorter one... */
export const ROW_OVERLAP = 0.5;
/** ...or their centres sit within this share of the slide height. */
export const ROW_CENTRE_TOL = 0.06;
/** Two units share a column when their horizontal overlap is at least this share of the narrower one. */
export const COL_OVERLAP = 0.5;
/** A width spread (against the median) at or under this reads as "the same width". */
export const WIDTH_SAME = 0.15;
/** A width spread at which similarity reaches zero. */
export const WIDTH_ZERO = 0.25;
/** A spread of row centres (share of the height) at which row alignment reaches zero. */
export const Y_ZERO = 0.1;
/** A spread of gaps (share of the width) at which regularity reaches zero. */
export const GAP_ZERO = 0.1;
/** A row of columns spans at least this share of the width... */
export const MIN_SPAN = 0.5;
/** ...and none of its columns is wider than this share: a wider box is the body. */
export const MAX_COLUMN_WIDTH = 0.55;
/** A picture is content at or over this share of the slide: the compile's `INCIDENTAL_PICTURE_SHARE`. */
export const CONTENT_PICTURE = INCIDENTAL_PICTURE_SHARE;
/** The smallest picture beside text that reads as a layout rather than an inset. */
export const SPLIT_PICTURE = 0.12;
/** Two stacked units join one reading block when the gap between them is under this share of the height... */
export const BLOCK_GAP = 0.05;
/** ...this share of the narrower one's width lies inside the wider one... */
export const BLOCK_OVERLAP = 0.6;
/** ...and the wider one is at most this many times the narrower one. */
export const BLOCK_WIDTH_RATIO = 1.6;
/** A box no taller than this many lines of its own type is one line. */
export const SINGLE_LINE = 1.6;
/** A container holds a box when at least this share of the box lies inside it (the census's `CARD_CONTAINMENT`). */
export const CARD_CONTAINMENT = 0.8;
/** A table built from text boxes needs at least this many cells... */
export const TABLE_MIN_CELLS = 9;
/** ...left edges lining up within this share of the width... */
export const TABLE_EDGE = 0.03;
/** ...filling at least this share of its lattice... */
export const TABLE_FILL = 0.6;
/** ...with its largest type at most this many times the median. */
export const TABLE_PT_RATIO = 1.6;
/** Confidence at or over which a read may apply on its own. */
export const APPLY = 0.8;
/** Confidence at or over which a read is offered at all. */
export const PROPOSE = 0.55;
/** Coverage at or over which a read may apply on its own. */
export const APPLY_COVERAGE = 0.75;
/** Coverage under which the whole-slide read stands and the structure is only offered. */
export const MIN_COVERAGE = 0.5;
/** A figure in large type is at or over this size. */
export const BIG_NUMBER_PT = 28;
/** Two reads over `APPLY` closer than this fall back to the plainer. */
export const RUNNER_UP_GAP = ARCHETYPE_MIN_GAP;
/** A row label ends within this share of the width of the longer text it opens. */
export const LABEL_GAP = 0.12;
/** Left edges of a stack line up within this share of the width. */
export const STACK_EDGE = 0.05;
/** A stack holds this many rows at most; more is a list, not a structure. */
export const STACK_MAX = 8;
/** A source layout name adds at most this much to a read it agrees with. */
export const PRIOR_MAX = 0.1;
/** Units at or over which a slide that fits nothing reads as a diagram. */
export const DENSE_UNITS = 20;
/** With no title named, the largest text starting above this share of the height, over everything else, is the heading. */
export const TOP_BAND = 0.2;
/** A picture covering at least this share of a slide that holds a layout of its own is its ground (the census's `FLATTENED_AREA_SHARE`). */
export const BACKGROUND_SHARE = 0.9;
/** Words a full-bleed picture can carry over it and still be the content (plan 274's little text). */
export const CAPTION_WORDS = 30;

// ─── units ───────────────────────────────────────────────────────────────────

interface FBox { x: number; y: number; w: number; h: number }

type UnitKind = LayoutUnitV1['kind'] | 'block';

interface Unit {
  id: string;
  kind: UnitKind;
  box: FBox;
  words: number;
  maxPt: number;
  /** States a figure in large type, or a short word at the slide's largest body size. */
  figure: boolean;
  /** Opens with a row or step number ("1", "2.", "Step 3"). */
  numbered: boolean;
  /** Holds a date or a year. */
  dated: boolean;
  /** Opens with an icon over its text. */
  iconAbove: boolean;
  /** A short heading over longer text inside the unit. */
  headed: boolean;
  /** A row opened by a short label beside it (the MEDDPICC letters). */
  labelled: boolean;
  members: string[];
}

interface SlideUnits {
  headings: Unit[];
  body: Unit[];
  /** Wide thin shapes: a timeline's rule. */
  rules: Unit[];
  /** The text boxes before cards absorbed them and blocks merged them: what a table read aligns. */
  cells: Unit[];
  /** Units before they merge, headings aside: what "dense" counts. */
  raw: number;
  words: number;
}

const area = (b: FBox): number => Math.max(0, b.w) * Math.max(0, b.h);
const overlap1 = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const yOverlapShare = (a: FBox, b: FBox): number => overlap1(a.y, a.y + a.h, b.y, b.y + b.h) / Math.max(1e-6, Math.min(a.h, b.h));
const xOverlapShare = (a: FBox, b: FBox): number => overlap1(a.x, a.x + a.w, b.x, b.x + b.w) / Math.max(1e-6, Math.min(a.w, b.w));
const cy = (b: FBox): number => b.y + b.h / 2;
const cx = (b: FBox): number => b.x + b.w / 2;
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const sim = (dev: number, zeroAt: number): number => clamp01(1 - dev / zeroAt);
const r2 = (n: number): number => Math.round(n * 100) / 100;
const pct = (n: number): number => Math.round(n * 100);

function inside(inner: FBox, outer: FBox): number {
  const ix = overlap1(inner.x, inner.x + inner.w, outer.x, outer.x + outer.w);
  const iy = overlap1(inner.y, inner.y + inner.h, outer.y, outer.y + outer.h);
  return area(inner) > 0 ? (ix * iy) / area(inner) : 0;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

function relSpread(xs: number[]): number {
  const med = median(xs);
  return med > 0 ? (Math.max(...xs) - Math.min(...xs)) / med : 1;
}

function union(a: FBox, b: FBox): FBox {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  return { x: x0, y: y0, w: Math.max(a.x + a.w, b.x + b.w) - x0, h: Math.max(a.y + a.h, b.y + b.h) - y0 };
}

function textOf(object: SourceObjectV1 | undefined): string {
  return (object?.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join('\n');
}

/** A figure: digits with at most three letters and three words beside them. */
function figureText(text: string): boolean {
  const t = text.trim();
  if (!t || !/\d/.test(t)) return false;
  const letters = t.replace(/[^\p{L}]/gu, '');
  return letters.length <= 3 && t.split(/\s+/).length <= 3;
}

const NUMBERED = /^\s*(?:(?:step|phase|stage)\s+)?(?:\d{1,2}|[ivx]{1,4})(?:[.):]|\s|$)/i;
const DATED = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\bq[1-4]\b|\bh[12]\b/i;
const AGENDA_WORDS = /\b(?:agenda|contents|overview|outline|today|topics)\b/i;

/** Row markers of one or two characters, the labels of a labelled stack. */
function shortLabel(text: string, words: number): boolean {
  const bare = text.trim().replace(/[.):]$/, '');
  return (bare.length >= 1 && bare.length <= 2) || (words >= 1 && words <= 3 && bare.length <= 24);
}

interface UnitContext {
  classOf: (id: string) => ObjectClassV1 | undefined;
  objectOf: (id: string) => SourceObjectV1 | undefined;
  removed: ReadonlySet<string>;
  slideHeightPx: number;
}

function unitFrom(raw: LayoutUnitV1, ctx: UnitContext): Unit {
  const object = ctx.objectOf(raw.id);
  const text = textOf(object);
  return {
    id: raw.id,
    kind: raw.kind,
    box: { ...raw.box },
    words: raw.words,
    maxPt: raw.maxPt,
    figure: figureText(text) && raw.maxPt >= BIG_NUMBER_PT,
    numbered: NUMBERED.test(text),
    dated: DATED.test(text),
    iconAbove: false,
    headed: false,
    labelled: false,
    members: [],
  };
}

/** A card from its container and the members still free to absorb. */
function cardFrom(container: LayoutUnitV1, members: Unit[]): Unit {
  const ordered = [...members].sort((a, b) => (a.box.y - b.box.y) || (a.box.x - b.box.x) || compareCodeUnits(a.id, b.id));
  const texts = ordered.filter((unit) => unit.kind === 'text');
  const first = texts[0];
  const icon = ordered.find((unit) => unit.kind === 'icon' || unit.kind === 'pic');
  return {
    id: container.id,
    kind: 'card',
    box: { ...container.box },
    words: members.reduce((n, u) => n + u.words, 0),
    maxPt: members.reduce((n, u) => Math.max(n, u.maxPt), 0),
    figure: members.some((u) => u.figure),
    numbered: first?.numbered ?? false,
    dated: members.some((u) => u.dated),
    iconAbove: icon !== undefined && first !== undefined && icon.box.y + icon.box.h <= first.box.y + 0.02,
    headed: texts.length >= 2 && (first?.words ?? 0) <= 8,
    labelled: false,
    members: ordered.flatMap((unit) => (unit.members.length > 0 ? unit.members : [unit.id])),
  };
}

/**
 * Pair each short label (a letter, a number, one to three words) with the longer
 * text that starts within `LABEL_GAP` to its right, level with it, when at least
 * three such pairs stand in one column. The pair is one row unit.
 */
function pairLabels(units: Unit[], ctx: UnitContext): Unit[] {
  const texts = units.filter((u) => u.kind === 'text');
  const pairs: Array<{ label: Unit; line: Unit }> = [];
  const used = new Set<string>();
  const labels = texts
    .filter((u) => shortLabel(textOf(ctx.objectOf(u.id)), u.words))
    .sort((a, b) => (a.box.y - b.box.y) || compareCodeUnits(a.id, b.id));
  for (const label of labels) {
    let best: Unit | undefined;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const line of texts) {
      if (line === label || used.has(line.id) || line.words <= label.words || line.box.w <= label.box.w) continue;
      const gap = line.box.x - (label.box.x + label.box.w);
      if (gap < -0.01 || gap > LABEL_GAP) continue;
      const level = yOverlapShare(label.box, line.box) >= ROW_OVERLAP || Math.abs(cy(label.box) - cy(line.box)) <= ROW_CENTRE_TOL;
      if (!level) continue;
      if (gap < bestGap) {
        best = line;
        bestGap = gap;
      }
    }
    if (best) {
      used.add(best.id);
      pairs.push({ label, line: best });
    }
  }
  const columnOf = (pair: { label: Unit }): Array<{ label: Unit; line: Unit }> =>
    pairs.filter((other) => Math.abs(other.label.box.x - pair.label.box.x) <= STACK_EDGE);
  const kept = pairs.filter((pair) => columnOf(pair).length >= 3);
  if (kept.length === 0) return units;
  const gone = new Set(kept.flatMap((pair) => [pair.label.id, pair.line.id]));
  const rows: Unit[] = kept.map(({ label, line }) => ({
    id: line.id,
    kind: 'text',
    box: union(label.box, line.box),
    words: label.words + line.words,
    maxPt: Math.max(label.maxPt, line.maxPt),
    figure: false,
    numbered: true,
    dated: label.dated || line.dated,
    iconAbove: false,
    headed: false,
    labelled: true,
    members: [label.id, line.id],
  }));
  return [...units.filter((u) => !gone.has(u.id)), ...rows];
}

/**
 * Reading blocks (section 3.1): a heading over its paragraph, an icon over its label,
 * a figure over its caption. Two list siblings of one height and one type size, both
 * over a line and a half tall, stay apart; two single lines at one size are one
 * paragraph and join (that is what re-forms OCR lines on a flattened page).
 */
function mergeBlocks(units: Unit[], slideHeightPx: number): Unit[] {
  const singleLine = (u: Unit): boolean => u.maxPt > 0 && u.box.h <= SINGLE_LINE * ((u.maxPt * (96 / 72) * 1.2) / Math.max(1, slideHeightPx));
  const mergeable = (u: Unit): boolean => (u.kind === 'text' && !u.labelled) || u.kind === 'icon' || u.kind === 'block';
  let pool = units.map((u) => ({ ...u, members: [...u.members] }));
  let changed = true;
  while (changed) {
    changed = false;
    pool.sort((a, b) => (a.box.y - b.box.y) || (a.box.x - b.box.x) || compareCodeUnits(a.id, b.id));
    outer: for (let i = 0; i < pool.length; i += 1) {
      const a = pool[i] as Unit;
      if (!mergeable(a)) continue;
      for (let j = i + 1; j < pool.length; j += 1) {
        const b = pool[j] as Unit;
        if (!mergeable(b)) continue;
        if (a.kind === 'icon' && b.kind === 'icon') continue;
        const gap = b.box.y - (a.box.y + a.box.h);
        if (gap > BLOCK_GAP) continue;
        if (gap < -Math.min(a.box.h, b.box.h) * 0.5) continue;
        if (xOverlapShare(a.box, b.box) < BLOCK_OVERLAP) continue;
        const sameHeight = Math.abs(a.box.h - b.box.h) <= 0.2 * Math.max(a.box.h, b.box.h);
        const samePt = a.maxPt > 0 && b.maxPt > 0 && Math.abs(a.maxPt - b.maxPt) <= 0.1 * Math.max(a.maxPt, b.maxPt);
        if (a.kind !== 'icon' && b.kind !== 'icon' && sameHeight && samePt && a.words > 2 && b.words > 2 && !(singleLine(a) && singleLine(b))) continue;
        if (Math.max(a.box.w, b.box.w) > BLOCK_WIDTH_RATIO * Math.min(a.box.w, b.box.w)) continue;
        const merged = union(a.box, b.box);
        if (pool.some((c) => c !== a && c !== b && !mergeable(c) && inside(c.box, merged) > 0.5)) continue;
        const block: Unit = {
          id: a.kind === 'icon' ? b.id : a.id,
          kind: a.kind === 'icon' && b.kind === 'text' && b.figure ? 'text' : 'block',
          box: merged,
          words: a.words + b.words,
          maxPt: Math.max(a.maxPt, b.maxPt),
          figure: a.figure || b.figure,
          numbered: a.kind === 'icon' ? b.numbered : a.numbered,
          dated: a.dated || b.dated,
          iconAbove: a.kind === 'icon' || a.iconAbove,
          headed: a.headed || (a.kind !== 'icon' && a.words <= 8 && b.words > a.words),
          labelled: false,
          members: [...(a.members.length ? a.members : [a.id]), ...(b.members.length ? b.members : [b.id])]
            .filter((id, k, arr) => arr.indexOf(id) === k),
        };
        pool = pool.filter((u) => u !== a && u !== b);
        pool.push(block);
        changed = true;
        break outer;
      }
    }
  }
  return pool.filter((u) => u.kind !== 'icon').map((u) => (u.kind === 'block' ? { ...u, kind: 'text' as const } : u));
}

function slideUnits(features: LayoutFeaturesV1, ctx: UnitContext): SlideUnits | null {
  if (!features.units) return null;
  let heading = (id: string): boolean => {
    const klass = ctx.classOf(id);
    if (klass === 'title' || klass === 'subtitle') return true;
    return klass === 'unknown' && ctx.objectOf(id)?.roleEstimate === 'title';
  };
  let units = features.units.filter((u) => !ctx.removed.has(u.id)).map((u) => unitFrom(u, ctx));
  const byId = new Map(units.map((u) => [u.id, u]));
  // Cards: the smallest container first, each taking the members still free. A
  // container that is itself a kept unit (a filled shape, a panel picture) is the
  // card and no longer content of its own.
  const absorbed = new Set<string>();
  const cards: Unit[] = [];
  const containers = [...(features.containers ?? [])].sort((a, b) => (area(a.box) - area(b.box)) || compareCodeUnits(a.id, b.id));
  for (const container of containers) {
    const members = (container.members ?? [])
      .map((id) => byId.get(id))
      .filter((u): u is Unit => u !== undefined && !absorbed.has(u.id) && !heading(u.id) && u.id !== container.id);
    if (!members.some((u) => u.kind === 'text')) continue;
    for (const u of members) absorbed.add(u.id);
    absorbed.add(container.id);
    cards.push(cardFrom(container, members));
  }
  // A card inside a larger card: a note box inside a panel belongs to the panel when
  // the panel holds text of its own; a band that holds only cards is the ground the
  // cards stand on, so the cards stay and the band goes.
  for (const outer of [...cards].sort((a, b) => (area(b.box) - area(a.box)) || compareCodeUnits(a.id, b.id))) {
    if (!cards.includes(outer)) continue;
    const inner = cards.filter((card) => card !== outer && area(card.box) < area(outer.box) && inside(card.box, outer.box) >= CARD_CONTAINMENT);
    if (inner.length === 0) continue;
    const own = (features.containers ?? []).find((c) => c.id === outer.id)?.members ?? [];
    const ownText = own.some((id) => byId.get(id)?.kind === 'text' && outer.members.includes(id));
    if (ownText) {
      for (const card of inner) {
        outer.members.push(...card.members);
        outer.words += card.words;
        outer.maxPt = Math.max(outer.maxPt, card.maxPt);
        cards.splice(cards.indexOf(card), 1);
      }
    } else {
      cards.splice(cards.indexOf(outer), 1);
    }
  }
  // No title named: the largest text, starting in the top band, across half the slide
  // and above everything else on it, is the heading all the same (a survey question
  // over its chart). The census's class stands; only the layout read sets it aside.
  if (!units.some((u) => heading(u.id) && u.kind === 'text')) {
    const top = Math.max(0, ...units.filter((u) => u.kind === 'text').map((u) => u.maxPt));
    const above = (u: Unit): boolean => units.every((v) => v === u || v.kind === 'shape' || v.kind === 'icon' || v.box.y >= u.box.y + u.box.h - 0.02);
    const lead = units
      .filter((u) => u.kind === 'text' && u.maxPt === top && top > 0 && u.box.y <= TOP_BAND && u.box.w >= MIN_SPAN && above(u))
      .sort((a, b) => (a.box.y - b.box.y) || compareCodeUnits(a.id, b.id))[0];
    if (lead) {
      const named = heading;
      heading = (id: string): boolean => id === lead.id || named(id);
    }
  }
  const cells = units.filter((u) => u.kind === 'text' && !heading(u.id));
  const headings = units.filter((u) => heading(u.id) && u.kind === 'text');
  const words = units.reduce((n, u) => n + u.words, 0);
  // A picture under everything else on the slide is its ground, not content, when what
  // stands on it is a layout of its own (a picture, a card, a chart, a table, or more
  // text than a caption). A photograph with a line or two over it is a full-bleed
  // picture, and one with nothing on it is the slide.
  const onTop = units.filter((u) => area(u.box) < BACKGROUND_SHARE && !heading(u.id) && u.kind !== 'shape' && u.kind !== 'icon');
  const ground = onTop.some((u) => u.kind !== 'text') || cards.length > 0 || onTop.reduce((n, u) => n + u.words, 0) > CAPTION_WORDS;
  const loose = units.filter((u) => !absorbed.has(u.id) && !heading(u.id) && !(ground && u.kind === 'pic' && area(u.box) >= BACKGROUND_SHARE));
  const raw = loose.filter((u) => u.kind !== 'shape' && u.kind !== 'icon').length + cards.length;
  units = mergeBlocks(pairLabels(loose, ctx), ctx.slideHeightPx);
  const all = [...units, ...cards];
  const rules = all.filter((u) => u.kind === 'shape' && u.box.w >= 0.5 && u.box.h <= 0.02);
  const body = all.filter((u) => u.kind !== 'shape' && u.kind !== 'icon');
  // A figure in large type counts a short word at the slide's largest body size too
  // (a stat card that states "Faster" in its figure's place).
  const top = Math.max(0, ...body.map((u) => u.maxPt));
  for (const u of body) {
    if (!u.figure && u.kind !== 'pic' && top >= BIG_NUMBER_PT && u.maxPt === top && u.words <= 8) {
      const lead = u.members.length > 0 ? ctx.objectOf(u.members[0] as string) : ctx.objectOf(u.id);
      const leadText = textOf(lead).trim();
      if (leadText.length > 0 && leadText.split(/\s+/).length <= 2) u.figure = true;
    }
  }
  return { headings, body, rules, cells, raw, words };
}

// ─── clustering ──────────────────────────────────────────────────────────────

function clusterRows(units: Unit[]): Unit[][] {
  const sorted = [...units].sort((a, b) => (cy(a.box) - cy(b.box)) || compareCodeUnits(a.id, b.id));
  const rows: Unit[][] = [];
  for (const u of sorted) {
    const row = rows.find((r) => r.some((v) => yOverlapShare(u.box, v.box) >= ROW_OVERLAP || Math.abs(cy(u.box) - cy(v.box)) <= ROW_CENTRE_TOL)
      && !r.some((v) => xOverlapShare(u.box, v.box) >= 0.5));
    if (row) row.push(u);
    else rows.push([u]);
  }
  for (const r of rows) r.sort((a, b) => (a.box.x - b.box.x) || compareCodeUnits(a.id, b.id));
  return rows;
}

function clusterCols(units: Unit[]): Unit[][] {
  const sorted = [...units].sort((a, b) => (cx(a.box) - cx(b.box)) || compareCodeUnits(a.id, b.id));
  const cols: Unit[][] = [];
  for (const u of sorted) {
    const col = cols.find((c) => c.some((v) => xOverlapShare(u.box, v.box) >= COL_OVERLAP));
    if (col) col.push(u);
    else cols.push([u]);
  }
  for (const c of cols) c.sort((a, b) => (a.box.y - b.box.y) || compareCodeUnits(a.id, b.id));
  return cols;
}

// ─── reads ───────────────────────────────────────────────────────────────────

/** One read of a slide: the rule that named it, the library entry it names, and how sure. */
export interface StructureReadV1 {
  /** The rule's own name with its count (`columns-3`, `stack-8`, `image-row-3`, `grid-2x2`). */
  read: string;
  /** The layout library id the read names (`columns-3`, `numbered-rows`, `images-3`). */
  structure: string;
  confidence: number;
  /** Share of the slide's kept body units the read explains, 0 to 1. */
  coverage: number;
  /** Units the read covers, by id. */
  unitIds: string[];
  /** Boxes the read needs: what slot capacity is measured against. */
  needs: number;
  /** The sentence a person reads, plain words; the figures are in its params. */
  reason: ReviewMessageV1;
  /** The rounded row and grid vector plus the picture side: what "similar slides" groups by. */
  signature: string;
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** A count as a word, for a sentence that carries no digits. Past twelve it is "many". */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? 'many';
}

function reason(code: ReviewMessageCodeV1, params: Record<string, string | number>): ReviewMessageV1 {
  return reviewMessage(code, params);
}

function rowRead(fullRow: Unit[], rules: Unit[]): StructureReadV1 | null {
  // A one-word sliver under 5% of the width between columns is a connector (a plus,
  // an equals sign, an arrow) and is set aside.
  const connectors = fullRow.filter((u) => u.kind === 'text' && u.words <= 1 && u.box.w <= 0.05);
  const row = fullRow.filter((u) => !connectors.includes(u));
  if (row.length < 2 || row.length > 6) return null;
  const isPic = row.every((u) => u.kind === 'pic');
  const isText = row.every((u) => u.kind === 'text' || u.kind === 'card');
  if (!isPic && !isText) return null;
  if (isPic && row.some((u) => area(u.box) < CONTENT_PICTURE)) return null;
  const widths = row.map((u) => u.box.w);
  if (!isPic && Math.max(...widths) > MAX_COLUMN_WIDTH) return null;
  const last = row[row.length - 1] as Unit;
  const first = row[0] as Unit;
  const span = last.box.x + last.box.w - first.box.x;
  if (span < MIN_SPAN) return null;
  const wSpread = relSpread(widths);
  const ySpread = Math.max(...row.map((u) => cy(u.box))) - Math.min(...row.map((u) => cy(u.box)));
  const gaps: number[] = [];
  for (let i = 1; i < row.length; i += 1) {
    const a = row[i - 1] as Unit;
    const b = row[i] as Unit;
    gaps.push(b.box.x - (a.box.x + a.box.w));
  }
  const minW = Math.min(...widths);
  if (gaps.some((g) => g < -0.15 * minW)) return null;
  const gapRange = gaps.length > 1 ? Math.max(...gaps) - Math.min(...gaps) : 0;
  const wS = sim(wSpread, WIDTH_ZERO);
  const yS = sim(ySpread, Y_ZERO);
  const gS = sim(gapRange, GAP_ZERO);
  if (wS <= 0 || yS <= 0) return null;
  const confidence = r2(0.45 * wS + 0.3 * yS + 0.25 * gS);
  const n = row.length;
  const params: Record<string, string | number> = {
    count: n,
    countWord: countWord(n),
    widthSpread: pct(wSpread),
    rowSpread: pct(ySpread),
    gapSpread: pct(gapRange),
    span: pct(span),
    connectors: connectors.length,
  };
  const unitIds = row.map((u) => u.id);
  if (isPic) {
    return {
      read: `image-row-${n}`, structure: `images-${n}`, confidence, coverage: 0, unitIds, needs: n,
      reason: reason('layout.reason.images', params), signature: `row:${n}:pic`,
    };
  }
  if (row.every((u) => u.figure)) {
    return {
      read: `stats-${n}`, structure: `stats-${n}`, confidence, coverage: 0, unitIds, needs: n,
      reason: reason('layout.reason.stats', params), signature: `row:${n}:figure`,
    };
  }
  const numberedInOrder = row.every((u) => u.numbered);
  const chevrons = connectors.length > 0 && connectors.length >= n - 1;
  if (n >= 3 && (numberedInOrder || chevrons)) {
    return {
      read: `steps-${n}`, structure: `steps-${n}`, confidence, coverage: 0, unitIds, needs: n,
      reason: reason('layout.reason.steps', params), signature: `row:${n}:steps`,
    };
  }
  const ruled = rules.some((r) => row.every((u) => yOverlapShare(r.box, { ...u.box, y: u.box.y - 0.05, h: u.box.h + 0.1 }) > 0));
  const datedAll = row.every((u) => u.dated);
  if (n >= 3 && (ruled || datedAll)) {
    return {
      read: 'timeline', structure: 'timeline', confidence, coverage: 0, unitIds, needs: n,
      reason: reason('layout.reason.timeline', params), signature: `row:${n}:timeline`,
    };
  }
  let structure = `columns-${n}`;
  const cards = row.every((u) => u.kind === 'card');
  if (n === 2 && !cards) structure = row.every((u) => u.headed) ? 'comparison' : 'text-two-column';
  else if ((n === 3 || n === 4) && row.every((u) => u.iconAbove)) structure = `icon-columns-${n}`;
  return {
    read: `columns-${n}`, structure, confidence, coverage: 0, unitIds, needs: n,
    reason: reason(cards
      ? (wSpread <= WIDTH_SAME ? 'layout.reason.row.cards.same' : 'layout.reason.row.cards.uneven')
      : (wSpread <= WIDTH_SAME ? 'layout.reason.row.text.same' : 'layout.reason.row.text.uneven'), params),
    signature: `row:${n}:${cards ? 'card' : 'text'}`,
  };
}

function gridRead(units: Unit[]): StructureReadV1 | null {
  // A box wider than a column (a subtitle across the slide) is no cell: it would chain
  // every column into one.
  const pool = units.filter((u) => (u.kind === 'pic' || u.kind === 'card' || u.kind === 'text') && u.box.w <= MAX_COLUMN_WIDTH);
  if (pool.length < 4) return null;
  const rows = clusterRows(pool).filter((r) => r.length >= 2);
  const cols = clusterCols(pool).filter((c) => c.length >= 2);
  if (rows.length < 2 || cols.length < 2) return null;
  const inGrid = pool.filter((u) => rows.some((r) => r.includes(u)) && cols.some((c) => c.includes(u)));
  const R = rows.length;
  const C = Math.round(median(rows.map((r) => r.length)));
  if (inGrid.length < 4 || inGrid.length < 0.75 * R * C) return null;
  const pics = inGrid.filter((u) => u.kind === 'pic').length;
  const isPic = pics >= 0.75 * inGrid.length;
  const isText = pics === 0;
  if (!isPic && !isText) return null;
  // Columns line up: the x starts of each row fall within 4% of the first row's.
  const firstRow = rows[0] as Unit[];
  const starts = firstRow.map((u) => u.box.x);
  const lined = rows.every((r) => r.every((u) => starts.some((x) => Math.abs(u.box.x - x) <= 0.04)));
  if (!lined) return null;
  const wSpread = relSpread(inGrid.map((u) => u.box.w));
  const hSpread = relSpread(inGrid.map((u) => u.box.h));
  const rowCount = new Set(rows.map((r) => r.length)).size;
  const wS = sim(wSpread, WIDTH_ZERO);
  const hS = sim(hSpread, WIDTH_ZERO);
  const regular = rowCount === 1 ? 1 : 0.7;
  if (wS <= 0 || hS <= 0) return null;
  const confidence = r2((0.4 * wS + 0.3 * hS + 0.3) * regular * clamp01(inGrid.length / (R * C)));
  const params: Record<string, string | number> = {
    count: inGrid.length,
    countWord: countWord(inGrid.length),
    rows: R,
    rowsWord: countWord(R),
    columns: C,
    columnsWord: countWord(C),
    widthSpread: pct(wSpread),
    heightSpread: pct(hSpread),
  };
  return {
    read: `grid-${C}x${R}`,
    structure: isPic ? `image-grid-${C}x${R}` : `grid-${C}x${R}`,
    confidence,
    coverage: 0,
    unitIds: inGrid.map((u) => u.id),
    needs: inGrid.length,
    reason: reason(isPic ? 'layout.reason.image-grid' : 'layout.reason.grid', params),
    signature: `grid:${C}x${R}:${isPic ? 'pic' : 'text'}`,
  };
}

function splitRead(units: Unit[]): StructureReadV1 | null {
  const pics = units.filter((u) => (u.kind === 'pic' || u.kind === 'chart') && area(u.box) >= SPLIT_PICTURE);
  const texts = units.filter((u) => u.kind === 'text' || u.kind === 'card');
  if (pics.length !== 1 || texts.length === 0) return null;
  const pic = pics[0] as Unit;
  const onRight = pic.box.x >= 0.4;
  const onLeft = pic.box.x + pic.box.w <= 0.6;
  if (!onRight && !onLeft) return null;
  const side = onRight ? 'right' : 'left';
  const disjoint = texts.filter((t) => xOverlapShare(t.box, pic.box) < 0.2 && yOverlapShare(t.box, pic.box) >= 0.3);
  const under = texts.filter((t) => !disjoint.includes(t) && yOverlapShare(t.box, pic.box) >= 0.3
    && (onRight ? t.box.x < pic.box.x - 0.05 : t.box.x + t.box.w > pic.box.x + pic.box.w + 0.05));
  const beside = [...disjoint, ...under];
  if (beside.length === 0) return null;
  const words = beside.reduce((n, t) => n + t.words, 0);
  const share = area(pic.box);
  const penalty = under.length > 0 ? 0.15 : 0;
  const confidence = r2(0.5 + 0.3 * clamp01((share - SPLIT_PICTURE) / 0.2) + 0.2 * clamp01(beside.length / texts.length) - penalty);
  const chart = pic.kind === 'chart';
  const structure = chart ? (side === 'left' ? 'chart-and-callout' : 'callout-and-chart') : side === 'right' ? 'text-and-image' : 'image-and-text';
  const params: Record<string, string | number> = {
    side,
    share: pct(share),
    texts: beside.length,
    words,
    over: under.length,
  };
  const code: ReviewMessageCodeV1 = chart
    ? (side === 'right' ? 'layout.reason.chart.right' : 'layout.reason.chart.left')
    : under.length > 0
      ? (side === 'right' ? 'layout.reason.split.over.right' : 'layout.reason.split.over.left')
      : (side === 'right' ? 'layout.reason.split.right' : 'layout.reason.split.left');
  return {
    read: structure,
    structure,
    confidence,
    coverage: 0,
    unitIds: [pic.id, ...beside.map((t) => t.id)],
    needs: 2,
    reason: reason(code, params),
    signature: `split:${side}:${chart ? 'chart' : 'pic'}`,
  };
}

/** A callout card is at least this share of the slide wide, and at most `MAX_COLUMN_WIDTH`. */
export const CALLOUT_MIN_WIDTH = 0.2;

/**
 * Text with a callout (close-out CP13): one card holding text to one side of the
 * slide, every other text and card beside it and clear of it across, some of them
 * level with it down, and no picture large enough to make the slide a split. Rows of
 * text beside a boxed takeaway are this layout, not one column of body text with the
 * box lost.
 */
function calloutRead(units: Unit[]): StructureReadV1 | null {
  if (units.some((u) => (u.kind === 'pic' || u.kind === 'chart' || u.kind === 'table') && area(u.box) >= SPLIT_PICTURE)) return null;
  const content = units.filter((u) => u.kind === 'text' || u.kind === 'card');
  const cards = content.filter((u) => u.kind === 'card' && u.words > 0 && u.box.w >= CALLOUT_MIN_WIDTH && u.box.w <= MAX_COLUMN_WIDTH);
  const reads: StructureReadV1[] = [];
  for (const card of cards) {
    const onRight = card.box.x >= 0.4;
    const onLeft = card.box.x + card.box.w <= 0.6;
    if (!onRight && !onLeft) continue;
    const others = content.filter((u) => u !== card);
    const beside = others.filter((t) => xOverlapShare(t.box, card.box) < 0.2
      && (onRight ? t.box.x + t.box.w <= card.box.x + 0.02 : t.box.x >= card.box.x + card.box.w - 0.02));
    if (beside.length === 0 || beside.length < others.length) continue;
    // One card beside one other card is two boxes, which the row read names.
    if (beside.length === 1 && beside[0]?.kind === 'card') continue;
    const level = beside.filter((t) => yOverlapShare(t.box, card.box) >= 0.3).length;
    if (level === 0) continue;
    const side = onRight ? 'right' : 'left';
    reads.push({
      read: 'callout',
      structure: 'text-and-callout',
      confidence: r2(0.7 + 0.15 * clamp01(level / beside.length) + 0.05 * clamp01(card.words / 10)),
      coverage: 0,
      unitIds: [...beside.map((t) => t.id), card.id],
      needs: 2,
      reason: reason(onRight ? 'layout.reason.callout.right' : 'layout.reason.callout.left', { side, texts: beside.length, words: card.words }),
      signature: `callout:${side}`,
    });
  }
  // More than one card the rest stands beside is not one callout.
  return reads.length === 1 ? reads[0] as StructureReadV1 : null;
}

function stackRead(units: Unit[], ctx: { early: boolean; agenda: boolean; words: number }): StructureReadV1 | null {
  const pool = units.filter((u) => u.kind === 'text' || u.kind === 'card');
  if (pool.length < 3) return null;
  const cols = clusterCols(pool).sort((a, b) => (b.length - a.length) || compareCodeUnits(a[0]?.id ?? '', b[0]?.id ?? ''));
  const col = cols[0] as Unit[];
  if (col.length < 3 || col.length > STACK_MAX || col.length < pool.length * 0.75) return null;
  const left = col.map((u) => u.box.x);
  const lSpread = Math.max(...left) - Math.min(...left);
  const wSpread = relSpread(col.map((u) => u.box.w));
  const gaps: number[] = [];
  for (let i = 1; i < col.length; i += 1) {
    const a = col[i - 1] as Unit;
    const b = col[i] as Unit;
    gaps.push(b.box.y - (a.box.y + a.box.h));
  }
  const gapRange = Math.max(...gaps) - Math.min(...gaps);
  const lS = sim(lSpread, STACK_EDGE);
  const wS = sim(wSpread, WIDTH_ZERO);
  const gS = sim(gapRange, GAP_ZERO);
  if (lS <= 0 || wS <= 0) return null;
  const confidence = r2(0.4 * lS + 0.35 * wS + 0.25 * gS);
  const n = col.length;
  const labelled = col.every((u) => u.labelled || u.numbered);
  const params: Record<string, string | number> = {
    count: n,
    countWord: countWord(n),
    edgeSpread: pct(lSpread),
    widthSpread: pct(wSpread),
    gapSpread: pct(gapRange),
    words: ctx.words,
  };
  let structure = 'title-body';
  let code: ReviewMessageCodeV1 = 'layout.reason.stack';
  if (labelled && ctx.early && ctx.agenda) {
    structure = 'agenda-numbered';
    code = 'layout.reason.stack.agenda';
  } else if (labelled) {
    structure = 'numbered-rows';
    code = 'layout.reason.stack.labelled';
  }
  return {
    read: `stack-${n}`,
    structure,
    confidence,
    coverage: 0,
    unitIds: col.map((u) => u.id),
    needs: structure === 'title-body' ? 1 : n,
    reason: reason(code, params),
    signature: `stack:${n}:${labelled ? 'labelled' : 'plain'}`,
  };
}

function bigNumberRead(units: Unit[]): StructureReadV1 | null {
  const figures = units.filter((u) => u.kind === 'text' && u.figure);
  if (figures.length !== 1) return null;
  if (units.some((u) => u.kind !== 'text')) return null;
  const figure = figures[0] as Unit;
  const captions = units.filter((u) => u !== figure);
  const caption = captions.find((c) => xOverlapShare(c.box, figure.box) >= 0.3 && c.box.y >= figure.box.y + figure.box.h - 0.02 && c.box.y - (figure.box.y + figure.box.h) <= 0.1);
  const merged = figure.members.length >= 2;
  const confidence = r2(0.6 + 0.3 * (caption || merged ? 1 : 0) + 0.1 * (captions.length <= 2 ? 1 : 0));
  return {
    read: 'big-number',
    structure: 'big-number',
    confidence,
    coverage: 0,
    unitIds: [figure.id, ...(caption ? [caption.id] : [])],
    needs: 1,
    reason: reason('layout.reason.big-number', { pt: figure.maxPt, captioned: caption || merged ? 1 : 0 }),
    signature: 'whole:big-number',
  };
}

/**
 * A table built from text boxes: cells whose left edges line up in three or more
 * columns over three or more rows. Column widths may differ, as a table's do, so it
 * reads edges rather than sizes; a card grid's figure over its caption is kept out by
 * the type ratio.
 */
function tableRead(cells: Unit[], body: Unit[]): StructureReadV1 | null {
  if (cells.length < TABLE_MIN_CELLS) return null;
  const rows = clusterRows(cells).filter((r) => r.length >= 2);
  if (rows.length < 3) return null;
  const edges: number[][] = [];
  for (const c of [...cells].sort((a, b) => (a.box.x - b.box.x) || compareCodeUnits(a.id, b.id))) {
    const col = edges.find((e) => Math.abs((e[0] ?? 0) - c.box.x) <= TABLE_EDGE);
    if (col) col.push(c.box.x);
    else edges.push([c.box.x]);
  }
  const cols = edges.filter((e) => e.length >= 3);
  if (cols.length < 3) return null;
  const lattice = rows.length * cols.length;
  const inLattice = cells.filter((c) => cols.some((e) => Math.abs((e[0] ?? 0) - c.box.x) <= TABLE_EDGE) && rows.some((r) => r.includes(c))).length;
  const fill = inLattice / lattice;
  if (fill < TABLE_FILL || inLattice < TABLE_MIN_CELLS) return null;
  const pts = cells.map((c) => c.maxPt).filter((n) => n > 0).sort((a, b) => a - b);
  if (pts.length >= 4 && (pts[pts.length - 1] ?? 0) > TABLE_PT_RATIO * (pts[Math.floor(pts.length / 2)] ?? 0)) return null;
  const counts = rows.map((r) => r.length);
  const regular = counts.filter((n) => n === Math.round(median(counts))).length / rows.length;
  const confidence = r2(0.4 * clamp01(fill) + 0.4 * regular + 0.2);
  return {
    read: 'table',
    structure: 'table',
    confidence,
    coverage: 0,
    unitIds: body.map((u) => u.id),
    needs: 1,
    reason: reason('layout.reason.table', { cells: inLattice, rows: rows.length, columns: cols.length, fill: pct(fill) }),
    signature: `table:${cols.length}`,
  };
}

/** What the whole slide is when no arrangement of boxes explains it: plan 274's own reads. */
interface WholeRead {
  /** Null when nothing specific was named (plain text, a heading alone, an empty slide). */
  read: StructureReadV1 | null;
  kind: 'empty' | 'heading' | 'text' | 'named';
}

function wholeRead(su: SlideUnits, quoted: boolean): WholeRead {
  const { headings, body } = su;
  const allWords = su.words;
  const picArea = Math.min(1, body.filter((u) => u.kind === 'pic').reduce((n, u) => n + area(u.box), 0));
  const tables = body.filter((u) => u.kind === 'table').length;
  const charts = body.filter((u) => u.kind === 'chart').length;
  const texts = body.filter((u) => u.kind === 'text' || u.kind === 'card');
  const pictures = body.filter((u) => u.kind === 'pic').length;
  const all = body.map((u) => u.id);
  const named = (structure: string, confidence: number, code: ReviewMessageCodeV1, params: Record<string, string | number>, needs: number): WholeRead => ({
    kind: 'named',
    read: { read: structure, structure, confidence, coverage: 1, unitIds: all, needs, reason: reason(code, params), signature: `whole:${structure}` },
  });
  if (body.length === 0 && headings.length === 0) return { kind: 'empty', read: null };
  if (tables > 0) return named('table', 0.9, 'layout.reason.table.native', { tables }, tables + (texts.length > 0 ? 1 : 0));
  if (quoted && allWords <= 40) {
    // A quotation beside a photograph is the quote-with-picture layout, not a bare quote
    // that would leave the photograph nowhere to go.
    const photo = body.some((u) => u.kind === 'pic' && area(u.box) >= SPLIT_PICTURE);
    return photo
      ? named('image-with-quote', 0.8, 'layout.reason.quote.picture', { words: allWords, pictures }, 2)
      : named('quote', 0.85, 'layout.reason.quote', { words: allWords }, 1);
  }
  if (picArea >= 0.6 && allWords <= 30 && (headings.length === 0 || picArea >= 0.9)) {
    const words = texts.reduce((n, u) => n + u.words, 0);
    return named(words > 0 ? 'full-image-caption' : 'full-image', 0.9, 'layout.reason.full-image', { share: pct(picArea), pictures }, pictures + charts + (texts.length > 0 ? 1 : 0));
  }
  if (body.length === 0) return { kind: 'heading', read: null };
  const captionLike = (u: Unit): boolean => u.words <= 20 && u.maxPt <= 12;
  const captions = texts.filter(captionLike).length;
  if (charts === 1 && texts.length === captions && body.length === charts + captions) {
    return named('chart', captions ? 0.8 : 0.85, 'layout.reason.chart', { notes: captions }, 1 + (captions > 0 ? 1 : 0));
  }
  const bigPics = body.filter((u) => u.kind === 'pic' && area(u.box) >= SPLIT_PICTURE);
  if (bigPics.length === 1 && texts.length === captions && body.length === 1 + captions) {
    const share = area((bigPics[0] as Unit).box);
    return named('visual', captions ? 0.75 : 0.8, 'layout.reason.visual', { share: pct(share), captions }, 1 + (captions > 0 ? 1 : 0));
  }
  return { kind: 'text', read: null };
}

/** Everything the matcher found on one slide. */
export interface SlideStructureReadV1 {
  /** The leading read, when the matcher named one; absent for a plain text slide, a heading or an empty slide. */
  top?: StructureReadV1;
  /** The next read, when there was one. */
  runnerUp?: StructureReadV1;
  /** Two reads over `APPLY` within `RUNNER_UP_GAP`: a near tie, which is not evidence. */
  tied: boolean;
  /** The leader explained under `MIN_COVERAGE` of the content, so the whole-slide read stands. */
  demoted: boolean;
  /** Many boxes that fit nothing: a diagram, a map (decision 8). */
  dense: boolean;
  /** What the whole slide reads as when no arrangement is named. */
  whole: WholeRead['kind'];
  /** Body units after merging, headings aside. */
  units: number;
}

export interface ReadStructureOptsV1 {
  /** The census class of an object, by id. */
  classOf: (id: string) => ObjectClassV1 | undefined;
  /** Objects the plan removes; a removed shape still holds a card as its container. */
  removed?: ReadonlySet<string>;
  /** The slide sits early in the deck (the first three), where an agenda is expected. */
  early?: boolean;
  /** The slide's text opens and closes with quotation marks. */
  quoteMarks?: boolean;
}

/**
 * Read one slide's structure from its census units. Null when the census carries no
 * units (a census from before plan 275), which is not a read of anything.
 */
export function readSlideStructure(slide: SlideSourceV1, features: LayoutFeaturesV1, opts: ReadStructureOptsV1): SlideStructureReadV1 | null {
  const objects = new Map(slide.objects.map((object) => [object.id, object]));
  const ctx: UnitContext = {
    classOf: opts.classOf,
    objectOf: (id) => objects.get(id),
    removed: opts.removed ?? new Set<string>(),
    slideHeightPx: slide.height > 0 ? slide.height : 720,
  };
  const su = slideUnits(features, ctx);
  if (!su) return null;
  const flattened = slide.origin.flattened === true;
  const body = su.body;
  const texts = [...su.headings, ...body].map((u) => textOf(objects.get(u.members[0] ?? u.id))).join(' ');
  const agenda = AGENDA_WORDS.test(texts);

  const candidates: StructureReadV1[] = [];
  for (const row of clusterRows(body)) {
    const read = rowRead(row, su.rules);
    if (read) candidates.push(read);
  }
  for (const read of [gridRead(body), splitRead(body), calloutRead(body), stackRead(body, { early: opts.early === true, agenda, words: su.words }), bigNumberRead(body)]) {
    if (read) candidates.push(read);
  }
  const coverageOf = (read: StructureReadV1): number => (body.length > 0 ? r2(read.unitIds.length / body.length) : 0);
  for (const c of candidates) c.coverage = coverageOf(c);
  // The table read runs last and only where nothing better explains the cells: never
  // on a flattened slide (OCR cuts a paragraph into lines that line up like cells),
  // never where two or more cards stand, never where a row or grid read already
  // covers three quarters of the content with confidence.
  const cards = body.filter((u) => u.kind === 'card').length;
  const explained = candidates.some((c) => c.coverage >= 0.75 && c.confidence >= APPLY);
  const table = flattened || cards >= 2 || explained ? null : tableRead(su.cells, body);
  if (table) {
    table.coverage = coverageOf(table);
    candidates.push(table);
  }
  const whole = wholeRead(su, opts.quoteMarks === true);
  // A slide whose content stacks rather than stands in a row reads as Title and body
  // however many equal boxes it has (the MEDDPICC question lists), unless its rows are
  // labelled: `stackRead` names it so.
  const ranked = candidates
    .map((c) => ({ c, s: c.confidence * (0.5 + 0.5 * c.coverage) }))
    .sort((a, b) => (b.s - a.s) || compareCodeUnits(a.c.read, b.c.read));
  const dense = su.raw >= DENSE_UNITS;
  const out: SlideStructureReadV1 = { tied: false, demoted: false, dense: false, whole: whole.kind, units: body.length };
  const leader = ranked[0];
  if (!leader) {
    if (whole.read) out.top = whole.read;
    out.dense = dense && !whole.read;
    return out;
  }
  const top = leader.c;
  if (top.coverage < MIN_COVERAGE) {
    // A structure that explains under half the content is offered, not laid out.
    if (whole.read) {
      out.top = whole.read;
      out.runnerUp = top;
    } else {
      out.top = top;
      out.demoted = true;
    }
    out.dense = dense && out.top === top;
    return out;
  }
  out.top = top;
  const second = ranked.find((row) => row.c.structure !== top.structure);
  if (second) {
    out.runnerUp = second.c;
    out.tied = top.confidence >= APPLY && second.c.confidence >= APPLY && second.c.coverage >= MIN_COVERAGE
      && leader.s - second.s < RUNNER_UP_GAP;
  }
  return out;
}

// ─── bands, capacity and the master ──────────────────────────────────────────

/**
 * Cells an archetype offers content, title boxes aside: every kind of content may take
 * each of them (decision 30). A repeated cell is one cell however many boxes it holds
 * (a number, a label and a body make one row of Numbered list), because a read counts
 * its units the same way: `repeat.count` when the archetype has a repeat, else one per
 * distinct `group`, and each box outside a group is a cell of its own.
 */
export function slotCapacity(archetype: Pick<ArchetypeV1, 'placeholders' | 'repeat'>): number {
  const content = archetype.placeholders.filter((ph) => ph.role !== 'title');
  const loose = content.filter((ph) => ph.group === undefined).length;
  if (archetype.repeat) return archetype.repeat.count + loose;
  const groups = new Set(content.flatMap((ph) => (ph.group === undefined ? [] : [ph.group])));
  return groups.size + loose;
}

/**
 * Structures whose rows continue onto the next slide by design (plan 275 F9: eight
 * lettered rows pour four and four into Numbered list, the letters kept). A read over
 * their cells still fits, and the compile states each continuation it adds. Every
 * other structure fits only when its archetype has a cell for every unit.
 */
export const CONTINUED_STRUCTURES: ReadonlySet<string> = new Set(['numbered-rows']);

/** The archetype holds the read: a cell for every unit, or a structure that continues by design. */
export function capacityFits(structure: string, capacity: number, needs: number): boolean {
  return capacity >= needs || CONTINUED_STRUCTURES.has(structure);
}

/** Nearest library entries for a structure the library or the master lacks, most alike first. */
const NEAREST: Readonly<Record<string, readonly string[]>> = {
  'columns-5': ['columns-4', 'grid-3x2'],
  'columns-6': ['grid-3x2', 'columns-4'],
  'stats-2': ['columns-2', 'big-number'],
  'stats-5': ['stats-4', 'columns-4'],
  'stats-6': ['stats-4', 'grid-3x2'],
  'steps-5': ['steps-4', 'columns-4'],
  'steps-6': ['steps-4', 'grid-3x2'],
  'icon-columns-4': ['columns-4'],
  'images-4': ['image-grid-2x2', 'images-3'],
  'images-5': ['images-3'],
  'images-6': ['image-grid-2x2'],
  'grid-2x3': ['grid-3x2', 'grid-2x2'],
  'grid-4x2': ['grid-3x2', 'columns-4'],
  'grid-3x3': ['grid-3x2'],
  'grid-4x3': ['grid-3x2'],
  'image-grid-3x2': ['image-grid-2x2'],
  'image-grid-2x3': ['image-grid-2x2'],
  'image-grid-4x2': ['image-grid-2x2'],
  'callout-and-chart': ['chart-and-callout', 'split'],
  // The same two columns, text in the wide one and the takeaway's label and body in the narrow.
  'text-and-callout': ['chart-and-callout'],
  'full-image': ['full-image-caption'],
  'agenda-numbered': ['numbered-rows', 'agenda'],
};

/**
 * The archetype of this master that holds a structure: the one carrying it, else the
 * nearest the library names (`archetypeForStructure` with `nearest`), else a family
 * neighbour from `NEAREST`, else the plainest content layout. `exact` says whether the
 * master carries the structure itself.
 */
export function archetypeForRead(master: SlideMasterV1, structure: string): { archetype: ArchetypeV1 | undefined; exact: boolean } {
  const exact = archetypeForStructure(master, structure);
  if (exact) return { archetype: exact, exact: true };
  for (const neighbour of NEAREST[structure] ?? []) {
    const found = archetypeForStructure(master, neighbour);
    if (found) return { archetype: found, exact: false };
  }
  const nearest = archetypeForStructure(master, structure, { nearest: true });
  if (nearest) return { archetype: nearest, exact: false };
  const plain = archetypeForStructure(master, 'title-body') ?? master.archetypes.find((a) => a.id === 'content');
  return { archetype: plain, exact: false };
}

/** A count as a word opening a sentence ("Six"). */
function countWordCap(n: number): string {
  const word = countWord(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Library families whose ids end in a count, and the noun a sentence names their cells by. */
const COUNTED_FAMILIES: ReadonlyArray<{ pattern: RegExp; noun: string }> = [
  { pattern: /^columns-(\d+)$/, noun: 'boxes' },
  { pattern: /^icon-columns-(\d+)$/, noun: 'boxes with icons' },
  { pattern: /^cards-(\d+)$/, noun: 'cards' },
  { pattern: /^stats-(\d+)$/, noun: 'numbers' },
  { pattern: /^steps-(\d+)$/, noun: 'steps' },
  { pattern: /^images-(\d+)$/, noun: 'pictures' },
];

/**
 * The library's name for a structure, for a sentence ("Three boxes"). A structure the
 * library does not name (`columns-6`, `grid-4x3`) is worded from its id, so a sentence a
 * person reads never carries a digit: "Six boxes", "Three rows of four boxes".
 */
export function structureName(structure: string): string {
  const named = findStructure(structure)?.name;
  if (named) return named;
  for (const family of COUNTED_FAMILIES) {
    const m = family.pattern.exec(structure);
    if (m) return `${countWordCap(Number(m[1]))} ${family.noun}`;
  }
  const grid = /^(image-)?grid-(\d+)x(\d+)$/.exec(structure);
  if (grid) {
    const across = Number(grid[2]);
    const rows = Number(grid[3]);
    const noun = grid[1] ? (across === 1 ? 'picture' : 'pictures') : (across === 1 ? 'box' : 'boxes');
    return `${countWordCap(rows)} ${rows === 1 ? 'row' : 'rows'} of ${countWord(across)} ${noun}`;
  }
  // Another id: its words, counts spelled out.
  const words = structure.split('-').map((part) => (/^\d+$/.test(part) ? countWord(Number(part)) : part.replace(/\d+/g, (d) => ` ${countWord(Number(d))} `).trim()));
  const text = words.join(' ').replace(/\s+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The name an archetype goes by in a sentence: its library structure's name, else its own. */
function archetypeName(archetype: ArchetypeV1 | undefined): string {
  if (!archetype) return structureName('title-body');
  return findStructure(archetype.structure ?? archetype.id)?.name ?? archetype.name ?? archetype.id;
}

// ─── the layout-name prior ───────────────────────────────────────────────────

/**
 * PowerPoint's nine layout names and Google Slides' predefined layouts, to the
 * library id each names. A name is a prior only (section 3.2): it adds at most
 * `PRIOR_MAX` to a read that agrees with it and never names a layout on its own.
 */
export const LAYOUT_NAME_ALIASES: Readonly<Record<string, string>> = {
  'title slide': 'cover-title',
  'title and content': 'title-body',
  'section header': 'section',
  'two content': 'columns-2',
  comparison: 'comparison',
  'title only': 'title-only',
  'content with caption': 'text-and-callout',
  'picture with caption': 'image-caption',
  title: 'cover-title',
  title_and_body: 'title-body',
  title_and_two_columns: 'text-two-column',
  title_only: 'title-only',
  section_header: 'section',
  section_title_and_description: 'section-description',
  one_column_text: 'one-column-text',
  main_point: 'statement',
  big_number: 'big-number',
  caption_only: 'image-caption',
};

/** Words in a vendor's own layout names and the family of library ids each points at. */
const NAME_TOKENS: ReadonlyArray<{ pattern: RegExp; family: readonly string[] }> = [
  { pattern: /\b(?:two|2)[\s_-]*(?:column|content|col)s?\b/i, family: ['columns-2', 'text-two-column', 'comparison'] },
  { pattern: /\b(?:three|3)[\s_-]*(?:column|content|col)s?\b/i, family: ['columns-3', 'icon-columns-3', 'cards-3'] },
  { pattern: /\b(?:four|4)[\s_-]*(?:column|content|col)s?\b/i, family: ['columns-4', 'grid-2x2', 'stats-4'] },
  { pattern: /\b(?:image|picture|photo)s?\b/i, family: ['text-and-image', 'image-and-text', 'visual', 'full-image', 'full-image-caption', 'image-caption', 'images-2', 'images-3'] },
  { pattern: /\b(?:divider|section)\b/i, family: ['section'] },
  { pattern: /\bagenda\b/i, family: ['agenda', 'agenda-numbered'] },
  { pattern: /\bquote\b/i, family: ['quote'] },
  { pattern: /\btable\b/i, family: ['table'] },
  { pattern: /\bchart\b/i, family: ['chart', 'chart-and-callout', 'callout-and-chart'] },
];

/** Library ids a source layout name points at: the alias, else the family its words name. Empty when it names none. */
export function layoutNamePrior(layoutName: string | undefined): string[] {
  if (!layoutName) return [];
  const key = layoutName.trim().toLowerCase();
  const alias = LAYOUT_NAME_ALIASES[key] ?? LAYOUT_NAME_ALIASES[key.replace(/\s+/g, '_')];
  if (alias) return [alias];
  const out: string[] = [];
  for (const token of NAME_TOKENS) if (token.pattern.test(layoutName)) out.push(...token.family);
  return [...new Set(out)];
}

/** The ceiling a prior may lift a confidence to: just under the next band. */
function bandCeiling(confidence: number): number {
  if (confidence < PROPOSE) return PROPOSE - 0.01;
  if (confidence < APPLY) return APPLY - 0.01;
  return 1;
}

// ─── the match a plan stores ─────────────────────────────────────────────────

/** A slide's layout read, as a plan stores it. */
export interface SlideLayoutMatchV1 {
  /** Absent when the matcher named nothing (plain text, a heading, an empty slide). */
  match?: LayoutMatchV1;
  /** The archetype the read points at in this master: the one carrying it, else the nearest. */
  archetype?: ArchetypeRefV1;
  /** The master carries the structure itself. */
  exact: boolean;
  /** Sentences in plain words, the read's own first. */
  reasons: ReviewMessageV1[];
  /** Many boxes that fit nothing. */
  dense: boolean;
  /** The rule's own name (`stack-8`), for the eval. */
  read?: string;
}

export interface MatchSlideLayoutOptsV1 extends ReadStructureOptsV1 {
  master: SlideMasterV1;
}

/** The slides at the head of a deck, where an agenda is expected. */
export const EARLY_SLIDES = 3;

/**
 * Classes a layout read never reads, whatever the proposal says about them. Each one
 * is furniture the design system's archetypes bring back on their own, and a layout
 * chosen from furniture is a layout chosen from the template rather than from the slide.
 */
export const FURNITURE_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>([
  'page-number',
  'date',
  'decoration',
  'footer',
  'recurring-text',
  'template-furniture',
]);

// Opening and closing quotation marks: straight, double and single curly, low-9 and guillemets.
const OPENING_QUOTE = /^\s*["'\u201C\u201E\u00AB\u2018]/;
const CLOSING_QUOTE = /["\u201D\u00BB\u2019]\s*$/;

/** The slide's text, the objects in `skip` aside, opens and closes with quotation marks somewhere. */
export function hasQuoteMarks(slide: SlideSourceV1, skip?: ReadonlySet<string>): boolean {
  return slide.objects
    .filter((object) => !skip?.has(object.id))
    .map((object) => textOf(object))
    .filter((text) => text.trim().length > 0)
    .some((text) => OPENING_QUOTE.test(text) && CLOSING_QUOTE.test(text));
}

/** What a layout read leaves out of a slide: the rows it removes (the decision, else the proposal) and its furniture. */
export function readRemoved(rows: ReadonlyArray<Pick<ObjectPlanV1, 'id' | 'class' | 'proposal' | 'decision'>>): Set<string> {
  const removed = new Set<string>();
  for (const row of rows) {
    if ((row.decision ?? row.proposal) === 'remove' || FURNITURE_CLASSES.has(row.class)) removed.add(row.id);
  }
  return removed;
}

/**
 * The options a slide's layout read runs with. The first pass and Auto-match both build
 * them here, so a slide reads the same way whichever of them asks.
 */
export function layoutReadOpts(
  slide: SlideSourceV1,
  removed: ReadonlySet<string>,
  classOf: (id: string) => ObjectClassV1 | undefined,
  master: SlideMasterV1,
): MatchSlideLayoutOptsV1 {
  return { master, classOf, removed, early: slide.index < EARLY_SLIDES, quoteMarks: hasQuoteMarks(slide, removed) };
}

/**
 * Read one slide and state the read the way a plan stores it: the structure, its
 * confidence, coverage, band and signature, the archetype of this master that holds
 * it, and the sentences. The layout-name prior is applied here, inside the band.
 */
export function matchSlideLayout(slide: SlideSourceV1, features: LayoutFeaturesV1, opts: MatchSlideLayoutOptsV1): SlideLayoutMatchV1 {
  const read = readSlideStructure(slide, features, opts);
  const none: SlideLayoutMatchV1 = { exact: false, reasons: [], dense: false };
  if (!read) return none;
  const top = read.top;
  if (!top) {
    if (read.dense) return { ...none, dense: true, reasons: [reviewMessage('layout.reason.dense', { units: read.units })] };
    return none;
  }
  const prior = layoutNamePrior(slide.origin.layoutName);
  let confidence = top.confidence;
  let priorAdded = 0;
  if (prior.includes(top.structure)) {
    const lifted = Math.min(confidence + PRIOR_MAX, bandCeiling(confidence));
    priorAdded = r2(Math.max(0, lifted - confidence));
    confidence = r2(confidence + priorAdded);
  }
  const { archetype, exact } = archetypeForRead(opts.master, top.structure);
  const capacity = archetype ? slotCapacity(archetype) : 0;
  const fits = exact && capacityFits(top.structure, capacity, top.needs);
  let band: LayoutMatchBandV1;
  if (read.demoted || confidence < PROPOSE || top.coverage < MIN_COVERAGE) band = 'none';
  else if (confidence >= APPLY && top.coverage >= APPLY_COVERAGE && fits && !read.tied) band = 'clear';
  else band = 'likely';
  const params = { ...top.reason.params, confidence: top.confidence, coverage: top.coverage, capacity, needs: top.needs, prior: priorAdded };
  const reasons: ReviewMessageV1[] = [{ ...top.reason, params }];
  if (band === 'likely') {
    if (!exact) reasons.push(reviewMessage('layout.reason.missing', { layout: structureName(top.structure), fallback: archetypeName(archetype) }));
    else if (!fits) reasons.push(reviewMessage('layout.reason.capacity', { layout: structureName(top.structure), capacity, needs: top.needs }));
    else if (read.tied && read.runnerUp) reasons.push(reviewMessage('layout.reason.tie', { other: structureName(read.runnerUp.structure) }));
    else reasons.push(reviewMessage('layout.reason.likely', { confidence, coverage: top.coverage }));
  }
  if (band === 'none') reasons.push(reviewMessage('layout.reason.none', { confidence, coverage: top.coverage }));
  if (read.dense && band !== 'clear') reasons.push(reviewMessage('layout.reason.dense', { units: read.units }));
  const match: LayoutMatchV1 = { structure: top.structure, confidence, coverage: top.coverage, band, signature: top.signature };
  const out: SlideLayoutMatchV1 = { match, exact, reasons, dense: read.dense && band !== 'clear', read: top.read };
  if (archetype) out.archetype = archetype.id;
  return out;
}

// ─── Auto-match (decision 28) ────────────────────────────────────────────────

/** How sure a read must be for Auto-match to apply it. */
export const AUTO_MATCH_BANDS = ['clear', 'likely', 'all'] as const;
export type AutoMatchBandsV1 = (typeof AUTO_MATCH_BANDS)[number];

export interface AutoMatchOptsV1 {
  bands: AutoMatchBandsV1;
  /** Only these slides (a filmstrip selection). Absent means every slide. */
  slideIds?: readonly string[];
  /** The master the plan pours into, so a structure it lacks falls to its nearest. */
  master: SlideMasterV1;
}

/**
 * Why Auto-match passed a slide by. `arranged`: a person chose how the slide is drawn
 * (its original arrangement, or one picture), so its layout is not used. `capacity`:
 * the layout the read names has fewer cells than the read needs. `unchanged`: the slide
 * already carries that layout, so there is nothing to set.
 */
export type AutoMatchSkipV1 = 'excluded' | 'user' | 'preset' | 'locked' | 'no-match' | 'band' | 'unknown' | 'arranged' | 'capacity' | 'unchanged';

/** One slide Auto-match would set, and to what. */
export interface AutoMatchSlideV1 {
  slideId: string;
  structure: string;
  band: LayoutMatchBandV1;
  layout: ArchetypeRefV1;
  /** The master lacks the structure and its nearest archetype was used. */
  nearest: boolean;
  /** The slide's layout changes. Always true: a slide already on the layout is passed by as `unchanged`. */
  changes: boolean;
}

function bandAllowed(band: LayoutMatchBandV1, bands: AutoMatchBandsV1): boolean {
  if (bands === 'all') return true;
  if (bands === 'likely') return band === 'clear' || band === 'likely';
  return band === 'clear';
}

/** A slide with a locked row: a person held part of it, and a new layout would move that part. */
function lockedSlide(slide: SlidePlanV1): boolean {
  return slide.objects.some((row) => row.locked === true);
}

/** A person's decision changed which rows the slide keeps, so a read stored before it is stale. */
function keepsChanged(slide: SlidePlanV1): boolean {
  return slide.objects.some((row) => row.decision !== undefined && (row.decision === 'remove') !== (row.proposal === 'remove'));
}

/** The read Auto-match acts on for one slide. */
interface AutoRead {
  match: LayoutMatchV1;
  /** Cells the read needs, when the slide could be read again from the census. */
  needs?: number;
  /** The read's own sentence, its figures in the params, when the slide was read again. */
  reason?: ReviewMessageV1;
}

/**
 * The reads Auto-match acts on, slide by slide, computed on first use. The read the plan
 * stores stands unless a decision changed which rows the slide keeps; the census reads
 * the slide again (with the first pass's own options) for what the stored read does not
 * carry, the cells it needs and its sentence, and for a slide planned before the matcher.
 */
function autoReads(source: SourceDeckV1, census: DeckCensusV1 | undefined, master: SlideMasterV1): (slide: SlidePlanV1) => AutoRead | undefined {
  const sourceOf = new Map(source.slides.map((slide) => [slide.id, slide]));
  const featuresOf = new Map((census?.layouts ?? []).map((row) => [row.slideId, row]));
  const classOf = new Map((census?.objects ?? []).map((row) => [row.id, row.hypothesis.class]));
  const cache = new Map<string, AutoRead | undefined>();
  return (slide) => {
    if (cache.has(slide.id)) return cache.get(slide.id);
    const src = sourceOf.get(slide.id);
    const features = featuresOf.get(slide.id);
    const fresh = src && features?.units
      ? matchSlideLayout(src, features, layoutReadOpts(src, readRemoved(slide.objects), (id) => classOf.get(id), master))
      : undefined;
    const stored = slide.layoutMatch;
    let out: AutoRead | undefined;
    if (stored && !(fresh && keepsChanged(slide))) {
      out = { match: stored };
      const same = fresh?.match?.structure === stored.structure ? fresh : undefined;
      const first = same?.reasons[0];
      if (first) {
        out.reason = first;
        const needs = first.params.needs;
        if (typeof needs === 'number') out.needs = needs;
      }
    } else if (fresh?.match) {
      out = { match: fresh.match };
      const first = fresh.reasons[0];
      if (first) {
        out.reason = first;
        const needs = first.params.needs;
        if (typeof needs === 'number') out.needs = needs;
      }
    }
    cache.set(slide.id, out);
    return out;
  };
}

/**
 * What Auto-match would do, slide by slide, without doing it: the slides it sets and
 * why it passes the others by. A slide is set when it is included, a person or a preset
 * did not set its layout, a person did not choose its arrangement, no row on it is
 * locked, it carries a read in the bands asked for, the layout that read names has
 * cells enough for it, and the slide is not on that layout already.
 */
export function autoMatchPreview(
  plan: RenovationPlanV1,
  source: SourceDeckV1,
  census: DeckCensusV1 | undefined,
  opts: AutoMatchOptsV1,
): { slides: AutoMatchSlideV1[]; skipped: Array<{ id: string; reason: AutoMatchSkipV1 }> } {
  const wanted = opts.slideIds ? new Set(opts.slideIds) : null;
  const readOf = autoReads(source, census, opts.master);
  const slides: AutoMatchSlideV1[] = [];
  const skipped: Array<{ id: string; reason: AutoMatchSkipV1 }> = [];
  if (wanted) {
    const known = new Set(plan.slides.map((slide) => slide.id));
    for (const id of wanted) if (!known.has(id)) skipped.push({ id, reason: 'unknown' });
  }
  for (const slide of plan.slides) {
    if (wanted && !wanted.has(slide.id)) continue;
    const skip = (reason: AutoMatchSkipV1): void => { skipped.push({ id: slide.id, reason }); };
    if (!slide.include) { skip('excluded'); continue; }
    if (slide.layoutSource === 'user') { skip('user'); continue; }
    if (slide.layoutSource === 'preset') { skip('preset'); continue; }
    if (slide.arrangement !== undefined) { skip('arranged'); continue; }
    if (lockedSlide(slide)) { skip('locked'); continue; }
    const read = readOf(slide);
    if (!read) { skip('no-match'); continue; }
    if (!bandAllowed(read.match.band, opts.bands)) { skip('band'); continue; }
    const { archetype, exact } = archetypeForRead(opts.master, read.match.structure);
    if (!archetype) { skip('no-match'); continue; }
    // A layout with too few cells would pour the rest onto continuation slides.
    if (read.needs !== undefined && !capacityFits(archetype.structure ?? archetype.id, slotCapacity(archetype), read.needs)) { skip('capacity'); continue; }
    if (slide.layout === archetype.id) { skip('unchanged'); continue; }
    slides.push({ slideId: slide.id, structure: read.match.structure, band: read.match.band, layout: archetype.id, nearest: !exact, changes: true });
  }
  return { slides, skipped };
}

/** Sentences that describe a read's standing before it was set, which Auto-match setting it makes untrue. */
const SUPERSEDED_REASONS: ReadonlySet<string> = new Set([
  'layout.reason.likely',
  'layout.reason.none',
  'layout.reason.missing',
  'layout.reason.missing.used',
  'layout.reason.capacity',
  'layout.reason.tie',
]);

/**
 * Auto-match (plan 275 decision 28): set every eligible slide to the layout its read
 * names, as one plan edit, with `layoutSource: 'auto'`. `bands` is `clear` (the apply
 * band), `likely` (apply and propose) or `all` (every slide the matcher named a
 * structure for, whatever its confidence). A structure the master lacks falls to its
 * nearest carried archetype, and the reasons name both. A layout a person or a preset
 * set, an arrangement a person chose, a slide left out and a slide with a locked row
 * are never touched, and neither is a read whose layout has too few cells for it.
 * A slide it sets carries the read and the read's own sentence. `touched` lists the
 * slides set; capture `slideIds` = touched to undo it.
 */
export function autoMatchLayouts(
  plan: RenovationPlanV1,
  source: SourceDeckV1,
  census: DeckCensusV1 | undefined,
  opts: AutoMatchOptsV1,
): PlanEditResultV1 {
  const preview = autoMatchPreview(plan, source, census, opts);
  const skipped: PlanEditResultV1['skipped'] = [];
  for (const row of preview.skipped) {
    if (row.reason === 'excluded' || row.reason === 'locked' || row.reason === 'unknown') skipped.push({ id: row.id, reason: row.reason });
    else if (row.reason === 'user' || row.reason === 'preset' || row.reason === 'arranged') skipped.push({ id: row.id, reason: 'corrected' });
  }
  if (preview.slides.length === 0) return { plan, touched: [], skipped };
  const readOf = autoReads(source, census, opts.master);
  const bySlide = new Map(preview.slides.map((row) => [row.slideId, row]));
  const slides = plan.slides.map((slide): SlidePlanV1 => {
    const row = bySlide.get(slide.id);
    if (!row) return slide;
    const next: SlidePlanV1 = { ...slide, layout: row.layout, layoutSource: 'auto' };
    delete next.layoutAlternative;
    const read = readOf(slide);
    if (read) next.layoutMatch = { ...read.match };
    // The reasons become the read's own: its sentence, then how the master held it.
    // What the first pass said about the layout it picked, or about the read not being
    // sure enough to set, no longer describes the slide.
    const own = read?.reason
      ? [read.reason]
      : (slide.layoutReasons ?? []).filter((one) => !SUPERSEDED_REASONS.has(one.code) && !one.code.startsWith('layout.reason.pick.'));
    const reasons = [...own];
    if (row.nearest) {
      const carried = archetypeForRead(opts.master, row.structure).archetype;
      reasons.push(reviewMessage('layout.reason.missing.used', { layout: structureName(row.structure), fallback: archetypeName(carried) }));
    }
    if (reasons.length > 0) next.layoutReasons = reasons;
    else delete next.layoutReasons;
    return next;
  });
  return { plan: { ...plan, slides }, touched: preview.slides.map((row) => row.slideId), skipped };
}

/**
 * How many slides Auto-match would set, and how many of those are only likely: what the
 * web shows before it runs. `unchanged`, `capacity` and `arranged` count the slides it
 * passes by for those reasons, so a surface can say why it would set none.
 */
export function autoMatchCount(
  plan: RenovationPlanV1,
  source: SourceDeckV1,
  census: DeckCensusV1 | undefined,
  opts: AutoMatchOptsV1,
): { count: number; likely: number; clear: number; none: number; changes: number; anyMatch: boolean; unchanged: number; capacity: number; arranged: number } {
  const preview = autoMatchPreview(plan, source, census, opts);
  const out = { count: preview.slides.length, likely: 0, clear: 0, none: 0, changes: 0, anyMatch: false, unchanged: 0, capacity: 0, arranged: 0 };
  for (const row of preview.slides) {
    out[row.band] += 1;
    if (row.changes) out.changes += 1;
  }
  for (const row of preview.skipped) {
    if (row.reason === 'unchanged' || row.reason === 'capacity' || row.reason === 'arranged') out[row.reason] += 1;
  }
  out.anyMatch = plan.slides.some((slide) => slide.layoutMatch !== undefined) || preview.slides.length > 0;
  return out;
}

/** The archetype a slide's layout names, its light form when the slide carries a variant. */
function layoutArchetype(master: SlideMasterV1, layout: ArchetypeRefV1): ArchetypeV1 | undefined {
  const found = master.archetypes.find((a) => a.id === layout);
  if (found?.variantOf) return master.archetypes.find((a) => a.id === found.variantOf) ?? found;
  return found;
}

/**
 * The band an Auto-match slide is counted under: its read's, unless the layout it
 * carries is no longer the one that read names (a re-plan read the slide again under
 * newer rules and kept the layout Auto-match set earlier), which is counted as a guess.
 */
function autoBand(slide: SlidePlanV1, master: SlideMasterV1): LayoutMatchBandV1 {
  const match = slide.layoutMatch;
  if (!match) return 'none';
  const named = archetypeForRead(master, match.structure).archetype;
  const carried = layoutArchetype(master, slide.layout);
  if (named && carried && named.id !== carried.id) return 'none';
  return match.band;
}

/**
 * Matched slides per band, from the plan: what a CLI envelope reports and the report
 * agrees with. With `master`, a slide whose carried layout is no longer the one its read
 * names is counted as a guess, as the report counts it.
 */
export function autoMatchedCounts(plan: RenovationPlanV1, master?: SlideMasterV1): Record<LayoutMatchBandV1, number> {
  const out: Record<LayoutMatchBandV1, number> = { clear: 0, likely: 0, none: 0 };
  for (const slide of plan.slides) {
    if (!slide.include || slide.layoutSource !== 'auto') continue;
    out[master ? autoBand(slide, master) : (slide.layoutMatch?.band ?? 'none')] += 1;
  }
  return out;
}

const BAND_WORDS: Readonly<Record<LayoutMatchBandV1, string>> = { clear: 'a clear match', likely: 'a likely match', none: 'a guess' };

/**
 * One `layout.auto-matched` entry per included slide Auto-match set, naming the layout
 * the slide carries, the band and the slide, in plan order. `reason` carries
 * `<structure>:<band>` so a reader can count without parsing the message. A slide whose
 * carried layout is no longer the one its read names says the layout stayed from an
 * earlier Auto-match, and counts as a guess.
 */
export function autoMatchReportEntries(plan: RenovationPlanV1, master: SlideMasterV1, source?: SourceDeckV1): ReportEntryV1[] {
  const numberOf = new Map((source?.slides ?? []).map((slide, i) => [slide.id, i + 1]));
  const out: ReportEntryV1[] = [];
  plan.slides.forEach((slide, i) => {
    if (!slide.include || slide.layoutSource !== 'auto') return;
    const band = autoBand(slide, master);
    const structure = slide.layoutMatch?.structure ?? slide.layout;
    const n = numberOf.get(slide.id) ?? i + 1;
    const { archetype, exact } = archetypeForRead(master, structure);
    const used = layoutArchetype(master, slide.layout) ?? archetype;
    const agrees = !slide.layoutMatch || !archetype || !used || archetype.id === used.id;
    let message: string;
    if (!agrees) {
      message = `Slide ${n}: the ${archetypeName(used)} layout stays from an earlier Auto-match; the slide now reads as ${structureName(structure)}.`;
    } else if (exact || !slide.layoutMatch) {
      message = `Slide ${n}: Auto-match set the ${archetypeName(used)} layout, ${BAND_WORDS[band]}.`;
    } else {
      message = `Slide ${n}: Auto-match read ${structureName(structure)}, ${BAND_WORDS[band]}; this design system has no such layout, so ${archetypeName(used)} was used.`;
    }
    out.push({ code: 'layout.auto-matched', message, slideId: slide.id, reason: `${structure}:${band}` });
  });
  return out;
}

/** The report with one `layout.auto-matched` entry per slide Auto-match set, entries already there replaced. */
export function withAutoMatchEntries(report: RebrandReportV1, plan: RenovationPlanV1, master: SlideMasterV1, source?: SourceDeckV1): RebrandReportV1 {
  const entries = report.entries.filter((entry) => entry.code !== 'layout.auto-matched');
  return { ...report, entries: [...entries, ...autoMatchReportEntries(plan, master, source)] };
}
