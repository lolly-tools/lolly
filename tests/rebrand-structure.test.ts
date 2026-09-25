// SPDX-License-Identifier: MPL-2.0
/**
 * The structure matcher and Auto-match (plan 275 section 3, decisions 28 and 30).
 *
 * Most of this file is hand-written unit records, one small slide per rule, the way
 * `rebrand-archetype.test.ts` tests the archetype rules: a rule that needs a deck to
 * be exercised is a rule nobody can reason about. The structures fixture
 * (`tests/fixtures/rebrand/structures.pptx`, one slide per structure, each labelled
 * with the band a correct matcher reaches) pins the bands end to end, and Auto-match
 * runs over it. The private corpus case scores the reads against the per-slide
 * structure labels kept beside the decks, and skips by name without them.
 *
 * Run with: node --test "tests/rebrand-structure.test.ts"
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  APPLY,
  CARD_CONTAINMENT,
  CONTENT_PICTURE,
  PRIOR_MAX,
  PROPOSE,
  autoMatchCount,
  autoMatchLayouts,
  autoMatchPreview,
  autoMatchReportEntries,
  autoMatchedCounts,
  archetypeForRead,
  capacityFits,
  CONTINUED_STRUCTURES,
  countWord,
  layoutNamePrior,
  layoutReadOpts,
  matchSlideLayout,
  readSlideStructure,
  slotCapacity,
  structureName,
  withAutoMatchEntries,
} from '../engine/src/rebrand-structure.ts';
import { CARD_CONTAINMENT as CENSUS_CARD_CONTAINMENT, LAYOUT_CONTENT_PICTURE } from '../engine/src/deck-census.ts';
import { INCIDENTAL_PICTURE_SHARE } from '../engine/src/deck-compile.ts';
import { capturePlanRows, restorePlanRows } from '../engine/src/rebrand-edit.ts';
import { emptyReport } from '../engine/src/rebrand-report.ts';
import type {
  LayoutFeaturesV1,
  LayoutUnitV1,
  ObjectClassV1,
  RenovationPlanV1,
  SlideMasterFileV1,
  SlideMasterV1,
  SlideSourceV1,
  SourceObjectV1,
} from '../packages/core/src/index.ts';
import { runRebrandPipeline, STARTER_MASTER } from './helpers/rebrand-pipeline.ts';
import { privateCorpus, skipReason } from './helpers/rebrand-fixtures.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER: SlideMasterV1 = (JSON.parse(
  readFileSync(path.join(ROOT, 'brands/lolly-start/catalog/assets/lolly/slides/masters.json'), 'utf8'),
) as SlideMasterFileV1).masters[0] as SlideMasterV1;

// ─── a slide from unit records ───────────────────────────────────────────────

interface UnitSpec {
  id: string;
  /** Fractions of the slide. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: LayoutUnitV1['kind'];
  text?: string;
  pt?: number;
  klass?: ObjectClassV1;
}

interface SlideSpec {
  units: UnitSpec[];
  containers?: Array<{ id: string; x: number; y: number; w: number; h: number; members: string[] }>;
  index?: number;
  layoutName?: string;
  flattened?: boolean;
}

const W = 1280;
const H = 720;

function built(spec: SlideSpec): { slide: SlideSourceV1; features: LayoutFeaturesV1; classOf: (id: string) => ObjectClassV1 | undefined } {
  const objects: SourceObjectV1[] = spec.units.map((unit) => {
    const kind = unit.kind ?? (unit.text !== undefined ? 'text' : 'pic');
    const object: SourceObjectV1 = {
      id: unit.id,
      fingerprint: unit.id,
      kind: kind === 'icon' || kind === 'card' ? 'pic' : kind,
      box: { x: unit.x * W, y: unit.y * H, w: unit.w * W, h: unit.h * H, rot: 0 },
      origin: 'slide',
      fidelity: { state: 'editable' },
    };
    if (unit.text !== undefined) object.text = { paras: unit.text.split('\n').map((line) => ({ runs: [{ text: line, sizePt: unit.pt ?? 18 }] })) };
    return object;
  });
  const words = (text: string | undefined): number => (text ?? '').split(/\s+/).filter(Boolean).length;
  const units: LayoutUnitV1[] = spec.units.map((unit) => ({
    id: unit.id,
    kind: unit.kind ?? (unit.text !== undefined ? 'text' : 'pic'),
    box: { x: unit.x, y: unit.y, w: unit.w, h: unit.h },
    words: words(unit.text),
    maxPt: unit.text !== undefined ? unit.pt ?? 18 : 0,
  }));
  const containers: LayoutUnitV1[] = (spec.containers ?? []).map((c) => ({
    id: c.id, kind: 'card', box: { x: c.x, y: c.y, w: c.w, h: c.h }, words: 0, maxPt: 0, members: c.members,
  }));
  const slide: SlideSourceV1 = {
    id: 'slide1',
    index: spec.index ?? 4,
    width: W,
    height: H,
    background: {},
    objects,
    readingOrder: objects.map((o) => o.id),
    warnings: [],
    origin: { kind: 'pptx', ...(spec.layoutName ? { layoutName: spec.layoutName } : {}), ...(spec.flattened ? { flattened: true } : {}) },
  };
  const features: LayoutFeaturesV1 = {
    slideId: 'slide1', counts: {}, imageAreaShare: 0, chartPresent: false, tablePresent: false,
    distinctLeftEdges: 1, equalSiblingBoxes: 0, textParagraphs: 1, textWords: 0, units, containers,
  };
  const klass = new Map(spec.units.map((unit) => [unit.id, unit.klass ?? (unit.text !== undefined ? 'body' : 'photo')] as const));
  return { slide, features, classOf: (id) => klass.get(id) };
}

const TITLE: UnitSpec = { id: 't', x: 0.05, y: 0.05, w: 0.9, h: 0.1, text: 'A title for the slide', pt: 32, klass: 'title' };
const PARA = 'A paragraph of body text that runs to more than a few words across its box.';

function read(spec: SlideSpec) {
  const { slide, features, classOf } = built(spec);
  return readSlideStructure(slide, features, { classOf, early: (spec.index ?? 4) < 3 });
}

function match(spec: SlideSpec) {
  const { slide, features, classOf } = built(spec);
  return matchSlideLayout(slide, features, { classOf, master: MASTER, early: (spec.index ?? 4) < 3 });
}

// ─── constants shared with the census and the compile ───────────────────────

test('the matcher, the census and the compile agree on what a picture is and what a card holds', () => {
  assert.equal(CONTENT_PICTURE, INCIDENTAL_PICTURE_SHARE);
  assert.equal(LAYOUT_CONTENT_PICTURE, INCIDENTAL_PICTURE_SHARE);
  assert.equal(CARD_CONTAINMENT, CENSUS_CARD_CONTAINMENT);
  assert.ok(PROPOSE < APPLY);
});

// ─── one rule per case ───────────────────────────────────────────────────────

test('three text boxes side by side, about one width and lined up, are three boxes', () => {
  const got = read({ units: [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.27, h: 0.4, text: PARA },
    { id: 'b', x: 0.36, y: 0.31, w: 0.28, h: 0.4, text: PARA },
    { id: 'c', x: 0.68, y: 0.29, w: 0.27, h: 0.4, text: PARA },
  ] });
  assert.equal(got?.top?.read, 'columns-3');
  assert.equal(got?.top?.structure, 'columns-3');
  assert.ok((got?.top?.confidence ?? 0) >= APPLY);
  assert.equal(got?.top?.coverage, 1);
  assert.equal(got?.top?.reason.code, 'layout.reason.row.text.same');
  assert.equal(got?.top?.reason.text, 'Three text boxes side by side, about the same width and lined up.');
});

test('widths a fifth apart still read as boxes in a row, with the uneven sentence and a lower confidence', () => {
  const even = read({ units: [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.27, h: 0.4, text: PARA },
    { id: 'b', x: 0.36, y: 0.3, w: 0.27, h: 0.4, text: PARA },
    { id: 'c', x: 0.68, y: 0.3, w: 0.27, h: 0.4, text: PARA },
  ] });
  const uneven = read({ units: [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.24, h: 0.4, text: PARA },
    { id: 'b', x: 0.33, y: 0.3, w: 0.29, h: 0.4, text: PARA },
    { id: 'c', x: 0.66, y: 0.3, w: 0.28, h: 0.4, text: PARA },
  ] });
  assert.equal(uneven?.top?.read, 'columns-3');
  assert.equal(uneven?.top?.reason.code, 'layout.reason.row.text.uneven');
  assert.ok((uneven?.top?.confidence ?? 1) < (even?.top?.confidence ?? 0));
});

test('four cards drawn by panels the plan removes still read as four cards: a removed panel is a container', () => {
  const cards = [0, 1, 2, 3].map((i) => ({ id: `p${i}`, x: 0.05 + i * 0.23, y: 0.3, w: 0.2, h: 0.5, members: [`c${i}`] }));
  const { slide, features, classOf } = built({
    units: [TITLE, ...cards.map((card, i) => ({ id: `c${i}`, x: card.x + 0.02, y: 0.33, w: 0.16, h: 0.4, text: PARA }))],
    containers: cards,
  });
  const got = readSlideStructure(slide, features, { classOf, removed: new Set(cards.map((c) => c.id)) });
  assert.equal(got?.top?.structure, 'columns-4');
  assert.equal(got?.top?.reason.code, 'layout.reason.row.cards.same');
  assert.deepEqual(got?.top?.unitIds, ['p0', 'p1', 'p2', 'p3']);
});

test('two text columns are Two columns of text, and two headed columns are a comparison', () => {
  const plain = read({ units: [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.42, h: 0.5, text: PARA },
    { id: 'b', x: 0.53, y: 0.3, w: 0.42, h: 0.5, text: PARA },
  ] });
  assert.equal(plain?.top?.structure, 'text-two-column');
  const headed = read({ units: [TITLE,
    { id: 'ha', x: 0.05, y: 0.28, w: 0.42, h: 0.06, text: 'Before', pt: 22 },
    { id: 'a', x: 0.05, y: 0.36, w: 0.42, h: 0.4, text: PARA },
    { id: 'hb', x: 0.53, y: 0.28, w: 0.42, h: 0.06, text: 'After', pt: 22 },
    { id: 'b', x: 0.53, y: 0.36, w: 0.42, h: 0.4, text: PARA },
  ] });
  assert.equal(headed?.top?.structure, 'comparison');
});

test('figures in large type side by side are stats; one figure alone is a big number', () => {
  const stats = read({ units: [TITLE,
    { id: 'f1', x: 0.05, y: 0.3, w: 0.26, h: 0.12, text: '42%', pt: 54 },
    { id: 'c1', x: 0.05, y: 0.43, w: 0.26, h: 0.06, text: 'of teams ship weekly', pt: 14 },
    { id: 'f2', x: 0.37, y: 0.3, w: 0.26, h: 0.12, text: '3x', pt: 54 },
    { id: 'c2', x: 0.37, y: 0.43, w: 0.26, h: 0.06, text: 'faster reviews', pt: 14 },
    { id: 'f3', x: 0.69, y: 0.3, w: 0.26, h: 0.12, text: '12', pt: 54 },
    { id: 'c3', x: 0.69, y: 0.43, w: 0.26, h: 0.06, text: 'countries served', pt: 14 },
  ] });
  assert.equal(stats?.top?.structure, 'stats-3');
  const one = read({ units: [
    { id: 'f', x: 0.3, y: 0.3, w: 0.4, h: 0.2, text: '87%', pt: 96 },
    { id: 'c', x: 0.3, y: 0.52, w: 0.4, h: 0.06, text: 'of the deck read as layouts', pt: 16 },
  ] });
  assert.equal(one?.top?.structure, 'big-number');
});

test('numbered units in a row are steps; dated ones are a timeline', () => {
  const steps = read({ units: [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.27, h: 0.3, text: '1. Read the deck and census it' },
    { id: 'b', x: 0.36, y: 0.3, w: 0.27, h: 0.3, text: '2. Propose a plan for review' },
    { id: 'c', x: 0.68, y: 0.3, w: 0.27, h: 0.3, text: '3. Compile into Design' },
  ] });
  assert.equal(steps?.top?.structure, 'steps-3');
  const timeline = read({ units: [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.2, h: 0.3, text: 'Q1 2026 pilot with two teams' },
    { id: 'b', x: 0.28, y: 0.3, w: 0.2, h: 0.3, text: 'Q2 2026 the first release' },
    { id: 'c', x: 0.51, y: 0.3, w: 0.2, h: 0.3, text: 'Q3 2026 every region' },
    { id: 'd', x: 0.74, y: 0.3, w: 0.2, h: 0.3, text: 'Q4 2026 the review' },
  ] });
  assert.equal(timeline?.top?.structure, 'timeline');
});

test('one-word slivers between columns are connectors, set aside', () => {
  const got = read({ units: [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.25, h: 0.4, text: PARA },
    { id: 'plus', x: 0.32, y: 0.45, w: 0.03, h: 0.06, text: '+', pt: 30 },
    { id: 'b', x: 0.37, y: 0.3, w: 0.25, h: 0.4, text: PARA },
    { id: 'eq', x: 0.64, y: 0.45, w: 0.03, h: 0.06, text: '=', pt: 30 },
    { id: 'c', x: 0.69, y: 0.3, w: 0.25, h: 0.4, text: PARA },
  ] });
  assert.equal(got?.top?.structure, 'steps-3', 'a plus and an equals sign between three boxes join them into steps');
  assert.equal(got?.top?.reason.params.connectors, 2);
});

test('pictures in a row are an image row; in two rows of two they are a picture grid', () => {
  const row = read({ units: [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.27, h: 0.3 },
    { id: 'b', x: 0.36, y: 0.3, w: 0.27, h: 0.3 },
    { id: 'c', x: 0.68, y: 0.3, w: 0.27, h: 0.3 },
  ] });
  assert.equal(row?.top?.read, 'image-row-3');
  assert.equal(row?.top?.structure, 'images-3');
  assert.equal(row?.top?.reason.text, 'Three pictures side by side.');
  const grid = read({ units: [TITLE,
    { id: 'a', x: 0.1, y: 0.2, w: 0.38, h: 0.33 },
    { id: 'b', x: 0.52, y: 0.2, w: 0.38, h: 0.33 },
    { id: 'c', x: 0.1, y: 0.58, w: 0.38, h: 0.33 },
    { id: 'd', x: 0.52, y: 0.58, w: 0.38, h: 0.33 },
  ] });
  assert.equal(grid?.top?.structure, 'image-grid-2x2');
});

test('text boxes in two rows of two are a grid, and a subtitle across the slide does not chain the columns', () => {
  const got = read({ units: [TITLE,
    { id: 'sub', x: 0.05, y: 0.16, w: 0.9, h: 0.06, text: 'A subtitle that runs across the slide', pt: 19 },
    { id: 'a', x: 0.05, y: 0.28, w: 0.42, h: 0.28, text: PARA },
    { id: 'b', x: 0.53, y: 0.28, w: 0.42, h: 0.28, text: PARA },
    { id: 'c', x: 0.05, y: 0.6, w: 0.42, h: 0.28, text: PARA },
    { id: 'd', x: 0.53, y: 0.6, w: 0.42, h: 0.28, text: PARA },
  ] });
  assert.equal(got?.top?.structure, 'grid-2x2');
  assert.equal(got?.top?.coverage, 0.8);
});

test('text boxes whose left edges line up in rows and columns are a table', () => {
  const cells: UnitSpec[] = [];
  const xs = [0.05, 0.33, 0.52, 0.71];
  const ws = [0.26, 0.17, 0.17, 0.24];
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 4; c += 1) cells.push({ id: `r${r}c${c}`, x: xs[c]!, y: 0.25 + r * 0.09, w: ws[c]!, h: 0.05, text: `cell ${r} ${c}`, pt: 14 });
  }
  const got = read({ units: [TITLE, ...cells] });
  assert.equal(got?.top?.structure, 'table');
  assert.equal(got?.top?.reason.text, 'Text boxes lined up in rows and columns, like a table.');
});

test('one picture on a side with text beside it is a split; laid over the text it costs the read its band', () => {
  const right = match({ units: [TITLE,
    { id: 'body', x: 0.05, y: 0.25, w: 0.45, h: 0.6, text: PARA },
    { id: 'pic', x: 0.55, y: 0.25, w: 0.4, h: 0.6 },
  ] });
  assert.equal(right.match?.structure, 'text-and-image');
  assert.equal(right.match?.band, 'clear');
  assert.equal(right.reasons[0]?.text, 'A picture on the right with text beside it.');
  const left = match({ units: [TITLE,
    { id: 'pic', x: 0.05, y: 0.25, w: 0.4, h: 0.6 },
    { id: 'body', x: 0.5, y: 0.25, w: 0.45, h: 0.6, text: PARA },
  ] });
  assert.equal(left.match?.structure, 'image-and-text');
  const over = match({ units: [TITLE,
    { id: 'body', x: 0.05, y: 0.25, w: 0.9, h: 0.6, text: PARA },
    { id: 'pic', x: 0.55, y: 0.28, w: 0.38, h: 0.42 },
  ] });
  assert.equal(over.match?.structure, 'text-and-image');
  assert.equal(over.match?.band, 'likely', 'the overlap penalty keeps it out of the apply band');
  const chart = match({ units: [TITLE,
    { id: 'ch', x: 0.05, y: 0.25, w: 0.45, h: 0.6, kind: 'chart', klass: 'chart' },
    { id: 'body', x: 0.55, y: 0.25, w: 0.4, h: 0.6, text: PARA },
  ] });
  assert.equal(chart.match?.structure, 'chart-and-callout');
});

test('rows each opened by a letter are numbered rows, the letters kept (the MEDDPICC case); plain stacked blocks are Title and body', () => {
  const letters = 'MEDDPICC'.split('');
  const rows: UnitSpec[] = letters.flatMap((letter, i) => [
    { id: `l${i}`, x: 0.19, y: 0.09 + i * 0.107, w: 0.054, h: 0.097, text: letter, pt: 48 },
    { id: `r${i}`, x: 0.277, y: 0.09 + i * 0.107, w: 0.49, h: 0.097, text: `${letter}ETRIC ${PARA}`, pt: 14 },
  ]);
  const got = read({ units: rows, index: 2 });
  assert.equal(got?.top?.read, 'stack-8');
  assert.equal(got?.top?.structure, 'numbered-rows');
  assert.equal(got?.top?.reason.text, 'Eight rows stacked in one column, each opening with a short label.');
  const plain = read({ units: [TITLE,
    { id: 'a', x: 0.1, y: 0.25, w: 0.8, h: 0.15, text: PARA },
    { id: 'b', x: 0.1, y: 0.45, w: 0.8, h: 0.15, text: PARA },
    { id: 'c', x: 0.1, y: 0.65, w: 0.8, h: 0.15, text: PARA },
  ] });
  assert.equal(plain?.top?.structure, 'title-body');
});

test('whole-slide reads: a chart, a picture, a full bleed, a quotation, and a quotation beside a photograph', () => {
  assert.equal(read({ units: [TITLE, { id: 'ch', x: 0.05, y: 0.25, w: 0.9, h: 0.65, kind: 'chart', klass: 'chart' }] })?.top?.structure, 'chart');
  assert.equal(read({ units: [TITLE, { id: 'p', x: 0.1, y: 0.25, w: 0.8, h: 0.6 }] })?.top?.structure, 'visual');
  assert.equal(read({ units: [{ id: 'p', x: 0, y: 0, w: 1, h: 1 }] })?.top?.structure, 'full-image');
  assert.equal(read({ units: [{ id: 'p', x: 0, y: 0, w: 1, h: 1 }, { id: 'c', x: 0.05, y: 0.05, w: 0.5, h: 0.08, text: 'On a grey day in January' }] })?.top?.structure, 'full-image-caption');
  const quote = (photo: boolean) => {
    const { slide, features, classOf } = built({ units: [
      { id: 'q', x: 0.05, y: 0.3, w: 0.45, h: 0.3, text: '"The easiest migration we have made."' },
      ...(photo ? [{ id: 'p', x: 0.55, y: 0, w: 0.45, h: 1 }] : []),
    ] });
    return readSlideStructure(slide, features, { classOf, quoteMarks: true });
  };
  assert.equal(quote(false)?.top?.structure, 'quote');
  assert.notEqual(quote(true)?.top?.structure, 'quote', 'a quotation beside a photograph is not a bare quote');
});

test('a picture under a layout is the slide ground, and one with a caption over it is the slide', () => {
  const grounded = read({ units: [TITLE,
    { id: 'ground', x: 0, y: 0, w: 1, h: 1 },
    { id: 'body', x: 0.05, y: 0.25, w: 0.42, h: 0.6, text: `${PARA} ${PARA} ${PARA}` },
    { id: 'pic', x: 0.5, y: 0, w: 0.5, h: 1 },
  ] });
  assert.equal(grounded?.top?.structure, 'text-and-image');
});

test('with no title named, the largest text across the top over the rest is the heading (a survey question over its chart)', () => {
  const got = read({ units: [
    { id: 'q', x: 0.03, y: 0.05, w: 0.93, h: 0.29, text: 'The term Sovereign AI has been used to describe many things; which of these fits best?', pt: 56 },
    { id: 'ch', x: 0.03, y: 0.37, w: 0.93, h: 0.58, kind: 'chart', klass: 'chart' },
  ] });
  assert.equal(got?.top?.structure, 'chart');
});

test('a slide of many small boxes that fit nothing reads as a diagram', () => {
  const boxes: UnitSpec[] = [];
  for (let i = 0; i < 24; i += 1) boxes.push({ id: `b${i}`, x: 0.02 + (i * 0.137) % 0.9, y: 0.2 + Math.floor(i / 7) * 0.17 + (i % 3) * 0.02, w: 0.05 + (i % 4) * 0.03, h: 0.05, text: `part ${i}`, pt: 9 });
  const got = match({ units: [TITLE, ...boxes] });
  assert.equal(got.dense, true);
  assert.ok(got.reasons.some((r) => r.code === 'layout.reason.dense'));
  assert.notEqual(got.match?.band, 'clear');
});

// ─── bands, capacity and the prior ───────────────────────────────────────────

test('slot capacity counts cells, not boxes of a kind; the title box aside, a repeated cell one however many boxes it holds', () => {
  const find = (id: string) => MASTER.archetypes.find((a) => a.id === id)!;
  assert.equal(slotCapacity(find('columns-3')), 3, 'three cells of a label over a body');
  assert.equal(slotCapacity(find('full-image-plain')), 1);
  assert.equal(slotCapacity(find('full-image')), 2, 'a picture and its caption, no repeat');
  assert.equal(slotCapacity(find('numbered-rows')), 4, 'four rows of a number, a label and a body');
  assert.equal(slotCapacity(find('timeline')), 5);
  assert.equal(slotCapacity(find('comparison')), 2, 'two groups and no repeat');
  assert.equal(slotCapacity(find('chart-and-callout')), 2, 'a chart and one grouped callout');
  // Every repeat in the master: its count, never its boxes.
  for (const archetype of MASTER.archetypes) {
    if (archetype.repeat) assert.equal(slotCapacity(archetype), archetype.repeat.count, archetype.id);
  }
});

test('a numbered list of eight rows over a four-row layout is clear because it continues by design, its capacity counted in rows (MEDDPICC slide 3)', () => {
  const letters = 'MEDDPICC'.split('');
  const rows: UnitSpec[] = letters.flatMap((letter, i) => [
    { id: `l${i}`, x: 0.19, y: 0.09 + i * 0.107, w: 0.054, h: 0.097, text: letter, pt: 48 },
    { id: `r${i}`, x: 0.277, y: 0.09 + i * 0.107, w: 0.49, h: 0.097, text: `${letter}ETRIC ${PARA}`, pt: 14 },
  ]);
  const got = match({ units: rows, index: 2 });
  assert.equal(got.match?.structure, 'numbered-rows');
  assert.equal(got.match?.band, 'clear', 'Numbered list is the stated exception: its rows continue onto the next slide');
  assert.equal(got.reasons[0]?.params.needs, 8);
  assert.equal(got.reasons[0]?.params.capacity, 4, 'four rows, not twelve boxes');
  assert.ok(CONTINUED_STRUCTURES.has('numbered-rows'));
  assert.equal(capacityFits('columns-4', 4, 8), false, 'every other structure needs a cell for every unit');
});

test('a one-picture full bleed never applies over two pictures: the read is likely, with the reason', () => {
  // Two photographs laid over each other across the slide: no row, no grid, a full bleed read.
  const got = match({ units: [{ id: 'a', x: 0, y: 0, w: 0.7, h: 1 }, { id: 'b', x: 0.4, y: 0.1, w: 0.6, h: 0.8 }] });
  assert.equal(got.match?.structure, 'full-image');
  assert.equal(got.match?.band, 'likely');
  assert.ok(got.reasons.some((r) => r.code === 'layout.reason.capacity'));
});

test('a structure the master lacks is likely at any confidence, and its nearest carried archetype is named', () => {
  const five = [0, 1, 2, 3, 4].map((i) => ({ id: `c${i}`, x: 0.04 + i * 0.19, y: 0.3, w: 0.17, h: 0.4, text: PARA }));
  const got = match({ units: [TITLE, ...five] });
  assert.equal(got.match?.structure, 'columns-5');
  assert.equal(got.match?.band, 'likely');
  assert.equal(got.exact, false);
  assert.equal(got.archetype, 'columns-4');
  assert.equal(got.reasons.at(-1)?.text, 'This design system has no Five boxes layout; Four boxes is the nearest.');
  assert.equal(archetypeForRead(MASTER, 'no-such-structure').archetype?.id, 'content', 'nothing nearer falls to Title and body');
});

test('a layout name is a prior: it lifts an agreeing read by at most the prior and never across a band', () => {
  assert.deepEqual(layoutNamePrior('Two Content'), ['columns-2']);
  assert.deepEqual(layoutNamePrior('TITLE_AND_TWO_COLUMNS'), ['text-two-column']);
  assert.ok(layoutNamePrior('Divider Slide | Image | Green').includes('section'));
  assert.deepEqual(layoutNamePrior('Headline'), []);
  const units = [TITLE,
    { id: 'body', x: 0.05, y: 0.25, w: 0.9, h: 0.6, text: PARA },
    { id: 'pic', x: 0.55, y: 0.28, w: 0.38, h: 0.42 },
  ];
  const plain = match({ units });
  const named = match({ units, layoutName: 'Picture layout' });
  assert.equal(plain.match?.band, 'likely');
  assert.equal(named.match?.band, 'likely', 'the prior never lifts a likely read into the clear band');
  const lift = (named.match?.confidence ?? 0) - (plain.match?.confidence ?? 0);
  assert.ok(lift > 0 && lift <= PRIOR_MAX + 1e-9, `lifted by ${lift}`);
  assert.ok((named.match?.confidence ?? 1) < APPLY);
});

test('every sentence a person reads is plain words: no digits and no percent signs, the figures in the params', () => {
  const specs: SlideSpec[] = [
    { units: [TITLE, { id: 'a', x: 0.05, y: 0.3, w: 0.27, h: 0.4, text: PARA }, { id: 'b', x: 0.36, y: 0.3, w: 0.27, h: 0.4, text: PARA }, { id: 'c', x: 0.68, y: 0.3, w: 0.27, h: 0.4, text: PARA }] },
    { units: [{ id: 'a', x: 0, y: 0, w: 0.7, h: 1 }, { id: 'b', x: 0.4, y: 0.1, w: 0.6, h: 0.8 }] },
    { units: [TITLE, ...[0, 1, 2, 3, 4].map((i) => ({ id: `c${i}`, x: 0.04 + i * 0.19, y: 0.3, w: 0.17, h: 0.4, text: PARA }))] },
    { units: [TITLE, { id: 'body', x: 0.05, y: 0.25, w: 0.9, h: 0.6, text: PARA }, { id: 'pic', x: 0.55, y: 0.28, w: 0.38, h: 0.42 }] },
  ];
  for (const spec of specs) {
    for (const reason of match(spec).reasons) {
      assert.doesNotMatch(reason.text, /[\d%]/, reason.text);
      assert.ok(Object.keys(reason.params).length > 0 || reason.code.startsWith('layout.reason.'));
    }
  }
  assert.equal(countWord(3), 'three');
  assert.equal(countWord(40), 'many');
});

test('the read does not depend on the order the units are listed in', () => {
  const units = [TITLE,
    { id: 'a', x: 0.05, y: 0.3, w: 0.27, h: 0.4, text: PARA },
    { id: 'b', x: 0.36, y: 0.31, w: 0.28, h: 0.4, text: PARA },
    { id: 'c', x: 0.68, y: 0.29, w: 0.27, h: 0.4, text: PARA },
  ];
  assert.deepEqual(match({ units }), match({ units: [...units].reverse() }));
});

// ─── the structures fixture ──────────────────────────────────────────────────

interface StructureLabel { id: string; read: string; band: string }
const FIXTURE = path.join(ROOT, 'tests/fixtures/rebrand/structures.pptx');
const LABELS = (JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/rebrand/structures.labels.json'), 'utf8')) as {
  slides: Array<{ id: string; structure: StructureLabel }>;
}).slides;

let structuresRun: ReturnType<typeof runRebrandPipeline> | null = null;
const structures = () => (structuresRun ??= runRebrandPipeline('structures.pptx', new Uint8Array(readFileSync(FIXTURE))));

test('on the structures fixture every labelled slide lands in its band, on the structure its label names', async () => {
  const { plan } = await structures();
  for (const label of LABELS) {
    const slide = plan.slides.find((one) => one.id === `ppt/slides/${label.id}.xml`);
    assert.ok(slide, label.id);
    assert.equal(slide.layoutMatch?.structure, label.structure.id, `${label.id}: ${JSON.stringify(slide.layoutMatch)}`);
    assert.equal(slide.layoutMatch?.band, label.structure.band, label.id);
    for (const reason of slide.layoutReasons ?? []) assert.doesNotMatch(reason.text, /[\d%]/, reason.text);
  }
});

function withSources(plan: RenovationPlanV1, edit: (slide: RenovationPlanV1['slides'][number], i: number) => RenovationPlanV1['slides'][number]): RenovationPlanV1 {
  return { ...plan, slides: plan.slides.map(edit) };
}

test('Auto-match: clear changes only apply-band slides, all changes every slide the matcher named, and a person\'s layout survives both', async () => {
  const { plan: first, deck, census } = await structures();
  // Start from a plan whose layouts are all the plainest, so the edit is visible.
  const plain = withSources(first, (slide, i) => ({ ...slide, layout: 'content', layoutSource: i === 0 ? 'user' : 'proposed' }));
  const clear = autoMatchLayouts(plain, deck, census, { bands: 'clear', master: STARTER_MASTER });
  const clearIds = first.slides.filter((slide, i) => i > 0 && slide.layoutMatch?.band === 'clear').map((slide) => slide.id);
  assert.deepEqual(clear.touched, clearIds);
  assert.ok(!clear.touched.includes(first.slides[6]!.id), 'the likely slide is left for a person');
  assert.equal(clear.plan.slides[0]!.layout, 'content', 'a layout a person chose stays');
  assert.deepEqual(clear.skipped, [{ id: first.slides[0]!.id, reason: 'corrected' }]);
  for (const id of clear.touched) {
    const slide = clear.plan.slides.find((one) => one.id === id)!;
    assert.equal(slide.layoutSource, 'auto');
    assert.equal(slide.layout, archetypeForRead(STARTER_MASTER, slide.layoutMatch!.structure).archetype?.id);
  }

  const all = autoMatchLayouts(plain, deck, census, { bands: 'all', master: STARTER_MASTER });
  assert.deepEqual(all.touched, first.slides.slice(1).map((slide) => slide.id), 'every named slide but the one a person set');
  assert.equal(all.plan.slides[0]!.layoutSource, 'user');

  // Undo is the edit module's capture and restore over the touched slides.
  const before = capturePlanRows(plain, { slideIds: all.touched });
  assert.deepEqual(restorePlanRows(all.plan, before), plain);
});

test('Auto-match never touches a slide left out, a slide whose rows are all locked, or a slide outside the selection', async () => {
  const { plan: first, deck, census } = await structures();
  const plan = withSources(first, (slide, i) => {
    if (i === 1) return { ...slide, include: false };
    if (i === 2) return { ...slide, objects: slide.objects.map((row) => ({ ...row, locked: true })) };
    return { ...slide, layout: 'content' };
  });
  const got = autoMatchLayouts(plan, deck, census, { bands: 'all', master: STARTER_MASTER, slideIds: [first.slides[1]!.id, first.slides[2]!.id, first.slides[3]!.id] });
  assert.deepEqual(got.touched, [first.slides[3]!.id]);
  assert.deepEqual(got.skipped, [{ id: first.slides[1]!.id, reason: 'excluded' }, { id: first.slides[2]!.id, reason: 'locked' }]);
  const again = autoMatchLayouts(got.plan, deck, census, { bands: 'all', master: STARTER_MASTER, slideIds: [first.slides[3]!.id] });
  assert.deepEqual(again.touched, [], 'a slide already on its match from Auto-match is nothing to do');
});

test('a structure the master lacks falls to its nearest archetype, and the reasons and the report say so', async () => {
  const { plan: first, deck, census } = await structures();
  const slideId = first.slides[0]!.id;
  const plan = withSources(first, (slide, i) => (i === 0
    ? { ...slide, layout: 'content', layoutMatch: { ...slide.layoutMatch!, structure: 'columns-5', band: 'likely' } }
    : { ...slide, layoutSource: 'user' }));
  const got = autoMatchLayouts(plan, deck, census, { bands: 'likely', master: STARTER_MASTER });
  assert.deepEqual(got.touched, [slideId]);
  const slide = got.plan.slides[0]!;
  assert.equal(slide.layout, 'columns-4');
  assert.equal(slide.layoutReasons?.at(-1)?.text, 'This design system has no Five boxes layout, so Four boxes was used.');
  const entries = autoMatchReportEntries(got.plan, STARTER_MASTER, deck);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.code, 'layout.auto-matched');
  assert.equal(entries[0]!.slideId, slideId);
  assert.equal(entries[0]!.reason, 'columns-5:likely');
  assert.match(entries[0]!.message, /^Slide 1: Auto-match read Five boxes, a likely match; this design system has no such layout, so Four boxes was used\.$/);
});

test('the report carries one layout.auto-matched entry per slide Auto-match set, agreeing with the counts per band', async () => {
  const { plan: first, deck, census } = await structures();
  const plain = withSources(first, (slide) => ({ ...slide, layout: 'content' }));
  const got = autoMatchLayouts(plain, deck, census, { bands: 'all', master: STARTER_MASTER });
  const counts = autoMatchedCounts(got.plan);
  assert.deepEqual(counts, { clear: 7, likely: 1, none: 0 });
  const report = withAutoMatchEntries(emptyReport(deck.source.hash, got.plan.revision), got.plan, STARTER_MASTER, deck);
  const entries = report.entries.filter((entry) => entry.code === 'layout.auto-matched');
  assert.equal(entries.length, counts.clear + counts.likely + counts.none);
  assert.equal(entries.filter((entry) => entry.reason?.endsWith(':likely')).length, counts.likely);
  assert.match(entries[0]!.message, /^Slide 1: Auto-match set the Three boxes layout, a clear match\.$/);
  // Applying the entries twice replaces them rather than doubling them.
  assert.equal(withAutoMatchEntries(report, got.plan, STARTER_MASTER, deck).entries.length, report.entries.length);
});

test('the count Auto-match shows before it runs is the slides it sets, with the likely ones apart', async () => {
  const { plan: first, deck, census } = await structures();
  const plain = withSources(first, (slide) => ({ ...slide, layout: 'content' }));
  const count = autoMatchCount(plain, deck, census, { bands: 'likely', master: STARTER_MASTER });
  const run = autoMatchLayouts(plain, deck, census, { bands: 'likely', master: STARTER_MASTER });
  assert.equal(count.count, run.touched.length);
  assert.equal(count.likely, 1);
  assert.equal(count.changes, 8);
});

test('a plan from before the matcher still auto-matches: the read comes from the census', async () => {
  const { plan: first, deck, census } = await structures();
  const older = withSources(first, (slide) => {
    const { layoutMatch: _match, layoutReasons: _reasons, ...rest } = slide;
    return { ...rest, layout: 'content' };
  });
  const got = autoMatchLayouts(older, deck, census, { bands: 'clear', master: STARTER_MASTER });
  assert.equal(got.touched.length, 7);
  assert.equal(got.plan.slides[0]!.layoutMatch?.structure, 'columns-3', 'the read is stored with the slide it set');
});

test('Auto-match passes by a slide already on its layout: it is not counted, reported or made its own', async () => {
  const { plan: first, deck, census } = await structures();
  // The first pass already set every clear read as a proposal.
  const count = autoMatchCount(first, deck, census, { bands: 'likely', master: STARTER_MASTER });
  const run = autoMatchLayouts(first, deck, census, { bands: 'likely', master: STARTER_MASTER });
  assert.equal(count.count, 0);
  assert.equal(count.unchanged, first.slides.filter((slide) => slide.layoutMatch?.band !== 'none').length);
  assert.deepEqual(run.touched, []);
  assert.ok(run.plan.slides.every((slide) => slide.layoutSource === 'proposed'), 'a proposal stays a proposal, so a re-plan may still change it');
  assert.deepEqual(autoMatchReportEntries(run.plan, STARTER_MASTER, deck), []);
});

test('Auto-match passes by a slide whose arrangement a person chose, and one with any locked row', async () => {
  const { plan: first, deck, census } = await structures();
  const plan = withSources(first, (slide, i) => {
    if (i === 1) return { ...slide, layout: 'content', arrangement: 'picture' };
    if (i === 2) return { ...slide, layout: 'content', objects: slide.objects.map((row, j) => (j === 0 ? { ...row, locked: true } : row)) };
    return { ...slide, layout: 'content' };
  });
  const ids = [first.slides[1]!.id, first.slides[2]!.id, first.slides[3]!.id];
  const preview = autoMatchPreview(plan, deck, census, { bands: 'all', master: STARTER_MASTER, slideIds: ids });
  assert.deepEqual(preview.skipped, [{ id: ids[0], reason: 'arranged' }, { id: ids[1], reason: 'locked' }]);
  const got = autoMatchLayouts(plan, deck, census, { bands: 'all', master: STARTER_MASTER, slideIds: ids });
  assert.deepEqual(got.touched, [ids[2]]);
  assert.deepEqual(got.skipped, [{ id: ids[0], reason: 'corrected' }, { id: ids[1], reason: 'locked' }]);
  assert.equal(got.plan.slides[1]!.layout, 'content');
  assert.equal(got.plan.slides[1]!.arrangement, 'picture');
  assert.equal(autoMatchCount(plan, deck, census, { bands: 'all', master: STARTER_MASTER, slideIds: ids }).arranged, 1);
});

test('Auto-match passes by a read whose layout has fewer cells than the read needs', async () => {
  const { plan: first, deck, census } = await structures();
  // The same master with three cells in Four boxes: the fixture's four cards no longer fit.
  const small: SlideMasterV1 = {
    ...STARTER_MASTER,
    archetypes: STARTER_MASTER.archetypes.map((a) => (a.id === 'columns-4' && a.repeat
      ? { ...a, repeat: { ...a.repeat, count: 3 }, placeholders: a.placeholders.filter((ph) => ph.index !== 3) }
      : a)),
  };
  const rows = first.slides.findIndex((slide) => slide.layoutMatch?.structure === 'columns-4');
  assert.ok(rows >= 0);
  const plan = withSources(first, (slide, i) => (i === rows ? { ...slide, layout: 'content' } : { ...slide, layoutSource: 'user' }));
  const preview = autoMatchPreview(plan, deck, census, { bands: 'all', master: small });
  assert.deepEqual(preview.slides, []);
  assert.ok(preview.skipped.some((row) => row.id === first.slides[rows]!.id && row.reason === 'capacity'));
  assert.equal(autoMatchCount(plan, deck, census, { bands: 'all', master: small }).capacity, 1);
  assert.deepEqual(autoMatchLayouts(plan, deck, census, { bands: 'all', master: STARTER_MASTER }).touched, [first.slides[rows]!.id], 'the full master holds it');
});

test('Auto-match reads a slide again when a decision changed which boxes it keeps, and the reasons become the read', async () => {
  const { plan: first, deck, census } = await structures();
  // Slide 1 is three columns, each a label and a body; leaving out the third column's two boxes leaves two.
  const third = new Set(['ppt/slides/slide1.xml.5', 'ppt/slides/slide1.xml.6']);
  const plan = withSources(first, (slide, i) => (i === 0
    ? {
      ...slide,
      layout: 'content',
      layoutReasons: [...(slide.layoutReasons ?? []), { code: 'layout.reason.likely', params: {}, text: 'Close, but not sure enough to set on its own.' }],
      objects: slide.objects.map((row) => (third.has(row.id) ? { ...row, decision: 'remove' as const } : row)),
    }
    : { ...slide, layoutSource: 'user' }));
  const got = autoMatchLayouts(plan, deck, census, { bands: 'all', master: STARTER_MASTER });
  const slide = got.plan.slides[0]!;
  assert.deepEqual(got.touched, [slide.id]);
  assert.notEqual(slide.layoutMatch?.structure, 'columns-3', 'the stored read of three columns is stale');
  assert.equal(slide.layoutReasons?.length, 1);
  assert.equal(slide.layoutReasons?.[0]?.params.needs, 2);
  assert.ok(!(slide.layoutReasons ?? []).some((r) => r.code === 'layout.reason.likely'));
});

test('the first pass and Auto-match read with one set of options: quotation marks, removed boxes and the early slides', () => {
  const { slide, classOf } = built({ units: [{ id: 'q', x: 0.05, y: 0.3, w: 0.6, h: 0.3, text: '"The easiest migration we have made."' }], index: 1 });
  const opts = layoutReadOpts(slide, new Set(), classOf, MASTER);
  assert.equal(opts.quoteMarks, true);
  assert.equal(opts.early, true);
  assert.equal(layoutReadOpts(slide, new Set(['q']), classOf, MASTER).quoteMarks, false, 'a removed box is not read');
  assert.equal(layoutReadOpts({ ...slide, index: 3 }, new Set(), classOf, MASTER).early, false);
});

test('a plan from before the matcher reads every slide as the first pass did', async () => {
  const { plan: first, deck, census } = await structures();
  const older = withSources(first, (slide) => {
    const { layoutMatch: _match, ...rest } = slide;
    return { ...rest, layout: 'content' };
  });
  const got = autoMatchLayouts(older, deck, census, { bands: 'all', master: STARTER_MASTER });
  for (const slide of got.plan.slides) {
    const planned = first.slides.find((one) => one.id === slide.id)!;
    assert.equal(slide.layoutMatch?.structure, planned.layoutMatch?.structure, slide.id);
  }
});

test('the report names the layout a slide carries, and says when it stayed from an earlier Auto-match', async () => {
  const { plan: first, deck, census } = await structures();
  const plain = withSources(first, (slide) => ({ ...slide, layout: 'content' }));
  const got = autoMatchLayouts(plain, deck, census, { bands: 'all', master: STARTER_MASTER });
  // A re-plan under newer rules read slide 1 as four boxes, but kept the layout Auto-match set.
  const replanned = withSources(got.plan, (slide, i) => (i === 0 ? { ...slide, layoutMatch: { ...slide.layoutMatch!, structure: 'columns-4', band: 'clear' } } : slide));
  const entries = autoMatchReportEntries(replanned, STARTER_MASTER, deck);
  assert.equal(entries[0]!.message, 'Slide 1: the Three boxes layout stays from an earlier Auto-match; the slide now reads as Four boxes.');
  assert.equal(entries[0]!.reason, 'columns-4:none');
  const counts = autoMatchedCounts(replanned, STARTER_MASTER);
  assert.equal(counts.none, entries.filter((entry) => entry.reason?.endsWith(':none')).length);
});

test('a structure outside the library is named in words: no reason or report entry carries a digit', async () => {
  for (const id of ['columns-6', 'stats-5', 'stats-6', 'steps-6', 'images-4', 'images-7', 'grid-4x3', 'grid-3x3', 'image-grid-3x3', 'image-grid-4x2', 'icon-columns-5', 'cards-4', 'nothing-9']) {
    assert.doesNotMatch(structureName(id), /\d/, id);
  }
  assert.equal(structureName('columns-6'), 'Six boxes');
  assert.equal(structureName('stats-5'), 'Five numbers');
  assert.equal(structureName('grid-4x3'), 'Three rows of four boxes');
  assert.equal(structureName('image-grid-3x3'), 'Three rows of three pictures');
  const { plan: first, deck, census } = await structures();
  const plan = withSources(first, (slide, i) => (i === 0
    ? { ...slide, layout: 'content', layoutMatch: { ...slide.layoutMatch!, structure: 'columns-6', band: 'none' } }
    : { ...slide, layoutSource: 'user' }));
  const got = autoMatchLayouts(plan, deck, census, { bands: 'all', master: STARTER_MASTER });
  assert.deepEqual(got.touched, [first.slides[0]!.id]);
  for (const reason of got.plan.slides[0]!.layoutReasons ?? []) assert.doesNotMatch(reason.text, /\d/, reason.text);
  for (const entry of autoMatchReportEntries(got.plan, STARTER_MASTER, deck)) assert.doesNotMatch(entry.message.replace(/^Slide \d+: /, ''), /\d/, entry.message);
});

// ─── the private corpus against its structure labels ─────────────────────────

/**
 * Apply-band reads the compile still pours onto a continuation slide, each with why.
 * The read counts a card (a label over its body) as one cell, as `slotCapacity` does,
 * but the compile pours the card's boxes into separate cells, so a layout with cells
 * enough for the cards overflows. That is the compile's to fix; until it is, these are
 * named here rather than hidden by counting capacity in boxes.
 */
const CONTINUED_IN_APPLY_BAND: Readonly<Record<string, string>> = {
  'MEDDPICC Question-based Selling - SAP s3': 'Numbered list continues by design (CONTINUED_STRUCTURES)',
  'SUSE CADA Sales Enablement s2': 'the compile pours each card box apart',
  'SUSE CADA Sales Enablement s6': 'the compile pours each card box apart',
  'SUSE CADA Sales Enablement s15': 'the compile pours each card box apart',
  'Why SUSE Summary s2': 'the compile pours each card box apart',
  'Why SUSE Summary s3': 'the compile pours each card box apart',
  'Why SUSE Summary s4': 'the compile pours each card box apart',
};

test('the private corpus: no wrong read, no read over its slot capacity and no unexplained continuation in the apply band, against the structure labels', { skip: skipReason() ?? false }, async () => {
  const corpus = privateCorpus();
  assert.ok(corpus);
  const labelsDir = path.join(corpus.root, 'labels');
  let clear = 0;
  let labelled = 0;
  const wrong: string[] = [];
  const continued: string[] = [];
  for (const file of [...corpus.files, ...corpus.slidesToTest].filter((one) => /\.(pptx|pdf)$/i.test(one))) {
    const base = path.basename(file).replace(/\.(pptx|pdf)$/i, '');
    const labelFile = path.join(labelsDir, `${base}.structures.json`);
    if (!existsSync(labelFile)) continue;
    const labels = (JSON.parse(readFileSync(labelFile, 'utf8')) as { slides: Array<{ slide: number; structure: string; accept?: string[] }> }).slides;
    const byNumber = new Map(labels.map((label) => [label.slide, label]));
    const run = await runRebrandPipeline(path.basename(file), new Uint8Array(readFileSync(file)));
    // The compile's own measure: a read whose layout had too few cells pours the rest onward.
    const poured = new Set(run.compiled.report.entries.filter((entry) => entry.code === 'layout.poured-to-continuation').map((entry) => entry.slideId));
    run.deck.slides.forEach((slide, i) => {
      const planned = run.plan.slides.find((one) => one.id === slide.id);
      const got = planned?.layoutMatch;
      if (!planned || got?.band !== 'clear') return;
      clear += 1;
      const params = planned.layoutReasons?.[0]?.params ?? {};
      assert.ok(capacityFits(got.structure, Number(params.capacity), Number(params.needs)), `${base} s${i + 1} applies ${got.structure} over its slot capacity`);
      if (poured.has(slide.id)) continued.push(`${base} s${i + 1}`);
      const label = byNumber.get(i + 1);
      if (!label) return;
      labelled += 1;
      if (![label.structure, ...(label.accept ?? [])].includes(got.structure)) wrong.push(`${base} s${i + 1}: ${got.structure}, labelled ${label.structure}`);
    });
  }
  assert.ok(clear > 0, 'the corpus reads some slides in the apply band');
  assert.equal(labelled, clear, 'every apply-band slide carries a structure label');
  assert.deepEqual(wrong, []);
  assert.deepEqual(continued.sort(), Object.keys(CONTINUED_IN_APPLY_BAND).sort(), 'an apply-band read the compile continues is either fixed or named with its reason');
});

// ─── close-out CP13: text beside a boxed takeaway ─────────────────────────────

test('CP13: rows of text beside a boxed takeaway are Text with callout, not one column of body text', () => {
  const rows = [0, 1, 2].map((i) => ({ id: `r${i}`, x: 0.15, y: 0.32 + i * 0.22, w: 0.34, h: 0.12, text: PARA }));
  const callout = [{ id: 'c1', x: 0.55, y: 0.36, w: 0.39, h: 0.19, text: 'We did this easily. Because the incentives pointed one way.', pt: 30 },
    { id: 'c2', x: 0.55, y: 0.67, w: 0.39, h: 0.11, text: 'It was survival.', pt: 30 }];
  const spec: SlideSpec = {
    units: [TITLE, ...rows, ...callout],
    containers: [{ id: 'box', x: 0.52, y: 0.31, w: 0.42, h: 0.59, members: ['c1', 'c2'] }],
  };
  const got = read(spec);
  assert.equal(got?.top?.structure, 'text-and-callout');
  assert.equal(got?.top?.reason.code, 'layout.reason.callout.right');
  assert.equal(got?.top?.coverage, 1);
  assert.equal(got?.runnerUp?.structure, 'title-body', 'the stack read is still offered');
  assert.equal(structureName('text-and-callout'), 'Text with callout');
  // The master lacks the layout, so it pours onto the two columns of Chart with takeaway.
  const matched = match(spec);
  assert.equal(matched.match?.structure, 'text-and-callout');
  assert.equal(matched.archetype, archetypeForRead(MASTER, 'text-and-callout').archetype?.id);
  assert.equal(archetypeForRead(MASTER, 'text-and-callout').archetype?.structure ?? archetypeForRead(MASTER, 'text-and-callout').archetype?.id, 'chart-and-callout');

  // Two cards side by side are two boxes, and a card over a picture is not a callout.
  const two = read({ units: [TITLE, { id: 'a', x: 0.1, y: 0.35, w: 0.3, h: 0.3, text: PARA }, { id: 'b', x: 0.6, y: 0.35, w: 0.3, h: 0.3, text: PARA }],
    containers: [{ id: 'ca', x: 0.08, y: 0.3, w: 0.36, h: 0.4, members: ['a'] }, { id: 'cb', x: 0.58, y: 0.3, w: 0.36, h: 0.4, members: ['b'] }] });
  assert.notEqual(two?.top?.structure, 'text-and-callout');
  const pictured = read({ units: [TITLE, { id: 'p', x: 0.05, y: 0.3, w: 0.4, h: 0.5 }, ...callout],
    containers: [{ id: 'box', x: 0.52, y: 0.31, w: 0.42, h: 0.59, members: ['c1', 'c2'] }] });
  assert.notEqual(pictured?.top?.structure, 'text-and-callout');
});
