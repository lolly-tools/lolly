// SPDX-License-Identifier: MPL-2.0
/**
 * Stage 2 of the renovation journey (plan 274 section 3.2, work package 3):
 * `censusDeck` over the three synthetic pptx fixtures and their hand-authored
 * labels, plus the rules that the fixtures cannot reach.
 *
 * Two things are measured here and both are recorded as numbers rather than
 * described: per-class precision and recall against the labels, as thresholds
 * that only ever go up, and the repetition rule's tolerance for a box that
 * drifts from slide to slide (the MEDDPICC case, where nothing is at exactly
 * the same place twice).
 *
 * The labels sidecar states a box, not an id: `readPptx` does not report a
 * shape's `p:cNvPr@id`, so the source adapter mints ids from z-order and the two
 * id forms do not line up. The boxes do, to the pixel, which is how
 * `tests/rebrand-source-pptx.test.ts` matches too.
 *
 * What the synthetic corpus cannot show, stated so silence is not read as
 * coverage: no fixture carries text recognition evidence or pixel statistics, so
 * the photo, screenshot and picture-chart rules are exercised on hand-written
 * source models further down rather than on the fixtures, and the fixtures'
 * one photograph comes back `unknown` with the evidence saying text recognition
 * never ran. That is the answer the plan asks for: a picture with no text found
 * is not evidence of a photograph.
 *
 * Run with: node --test "tests/rebrand-census.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)
import Ajv from 'ajv/dist/2020.js';

import { inflatePptx } from '../packages/node-shell/src/pptx.ts';
import { sourceDeckFromPptx } from '../packages/node-shell/src/rebrand/index.ts';
import { censusDeck } from '../engine/src/deck-census.ts';
import { evidenceMessage } from '../engine/src/rebrand-review.ts';
import {
  CENSUS_RULES,
  DISPLAY_LETTER_PT,
  GENERATOR_MARK_SHARE,
  HEADING_MAX_CHARS,
  LOGO_MAX_LONG_SIDE_SHARE,
} from '../engine/src/deck-census-rules.ts';
import type {
  DeckCensusV1,
  ObjectClassV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceObjectV1,
} from '../packages/core/src/rebrand-v1.ts';
import {
  allLabelledObjects,
  fixturePath,
  privateCorpus,
  privateLabels,
  readFixture,
  readLabels,
  skipReason,
  type FixtureObjectLabelV1,
  type SyntheticFixtureName,
} from './helpers/rebrand-fixtures.ts';

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

/** The pptx fixtures. The pdf one belongs to the flattened path, which reads through its own adapter. */
const PPTX_FIXTURES: SyntheticFixtureName[] = ['simple.pptx', 'adversarial.pptx', 'palette.pptx'];

interface Read {
  deck: SourceDeckV1;
  census: DeckCensusV1;
}

const cache = new Map<SyntheticFixtureName, Promise<Read>>();

/** One fixture read into the stage-1 model and then censused, once per run. */
function readFixtureCensus(name: SyntheticFixtureName): Promise<Read> {
  const found = cache.get(name);
  if (found) return found;
  const pending = (async (): Promise<Read> => {
    const bytes = readFixture(name);
    const parts = await inflatePptx(bytes);
    const deck = await sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'census-test',
      name,
      bytes: bytes.byteLength,
      sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
      reader: { name: 'pptx-read', version: 'test' },
    });
    return { deck, census: censusDeck(deck) };
  })();
  cache.set(name, pending);
  return pending;
}

function objectsOf(deck: SourceDeckV1): SourceObjectV1[] {
  return deck.slides.flatMap((slide) => slide.objects);
}

/** The labelled object whose box matches this one to the pixel, if there is one. */
function labelFor(labels: FixtureObjectLabelV1[], object: SourceObjectV1): FixtureObjectLabelV1 | undefined {
  return labels.find((label) => {
    const want = label.boxPx;
    if (!want) return false;
    return Math.abs(object.box.x - want.x) <= 1
      && Math.abs(object.box.y - want.y) <= 1
      && Math.abs(object.box.w - want.w) <= 1
      && Math.abs(object.box.h - want.h) <= 1;
  });
}

function textOf(object: SourceObjectV1): string {
  return (object.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join('\n');
}

// ─── per-class precision and recall ──────────────────────────────────────────

/**
 * Measured on 2026-09-24 over the three pptx fixtures, 52 labelled objects.
 * These are floors, not goals: a rule change may raise a number here, never
 * lower one. The comment on a row says what holds it where it is.
 */
const THRESHOLDS: Record<string, {
  precision: number;
  recall: number;
  note?: string;
  /** The class is labelled in the corpus but must never be PREDICTED on it. */
  neverPredicted?: true;
  /** The class is neither labelled nor predicted here, and the row is recorded anyway. */
  unexercised?: true;
}> = {
  title: { precision: 1, recall: 1 },
  body: { precision: 1, recall: 1 },
  decoration: { precision: 1, recall: 1 },
  'logo-candidate': { precision: 1, recall: 1 },
  'page-number': { precision: 1, recall: 1 },
  'recurring-text': { precision: 1, recall: 1 },
  footer: { precision: 1, recall: 1 },
  chart: { precision: 1, recall: 1 },
  table: { precision: 1, recall: 1 },
  // The corpus carries one photograph and no pixel statistics or text
  // recognition for it, so the rules answer `unknown` and say why. This is
  // pinned as "never predicted" rather than as a floor of zero, which no result
  // could fail. Raising it needs a fixture that carries the evidence.
  photo: { precision: 0, recall: 0, neverPredicted: true, note: 'no raster statistics or text recognition evidence in the corpus' },
  // The drawing-part rule (census-rules-2026-09-24.4) reads freeforms and
  // all-shape groups on a slide as parts of a drawing. No fixture holds one:
  // the adversarial group pairs a bar with its label, and the palette swatches
  // are preset rectangles, so a diagram here is a regression.
  diagram: { precision: 0, recall: 0, neverPredicted: true, unexercised: true, note: 'no freeform or all-shape group in the corpus' },
};

test('per-class precision and recall on the synthetic fixtures hold their recorded floors', async () => {
  const truePositives = new Map<string, number>();
  const falsePositives = new Map<string, number>();
  const falseNegatives = new Map<string, number>();
  const bump = (into: Map<string, number>, klass: string): void => { into.set(klass, (into.get(klass) ?? 0) + 1); };
  let scored = 0;

  for (const name of PPTX_FIXTURES) {
    const { deck, census } = await readFixtureCensus(name);
    const labels = allLabelledObjects(readLabels(name));
    const byId = new Map(objectsOf(deck).map((object) => [object.id, object]));
    for (const row of census.objects) {
      const object = byId.get(row.id);
      assert.ok(object, `the census names an object the source deck does not hold: ${row.id}`);
      const label = labelFor(labels, object);
      assert.ok(label, `no label states a box for ${row.id} in ${name}`);
      scored += 1;
      if (label.class === row.hypothesis.class) bump(truePositives, row.hypothesis.class);
      else {
        bump(falsePositives, row.hypothesis.class);
        bump(falseNegatives, label.class);
      }
    }
  }

  assert.equal(scored, 52, 'the three pptx fixtures hold 52 objects; a fixture change should be reviewed here');

  const measured: Record<string, { precision: number | null; recall: number | null }> = {};
  for (const klass of new Set([...truePositives.keys(), ...falsePositives.keys(), ...falseNegatives.keys()])) {
    const tp = truePositives.get(klass) ?? 0;
    const fp = falsePositives.get(klass) ?? 0;
    const fn = falseNegatives.get(klass) ?? 0;
    measured[klass] = {
      precision: tp + fp > 0 ? tp / (tp + fp) : null,
      recall: tp + fn > 0 ? tp / (tp + fn) : null,
    };
  }

  for (const [klass, floor] of Object.entries(THRESHOLDS)) {
    const got = measured[klass] ?? { precision: null, recall: null };
    if (got.precision === null && got.recall === null) {
      assert.ok(floor.unexercised,
        `${klass} is neither predicted nor labelled here, so its recorded floor measured nothing; mark the row unexercised or give it a fixture`);
    }
    if (floor.neverPredicted) {
      assert.equal(got.precision, null,
        `${klass} is recorded as never predicted on this corpus, and a prediction is a regression rather than coverage`);
    }
    if (got.precision !== null) {
      assert.ok(got.precision >= floor.precision,
        `${klass} precision fell to ${got.precision.toFixed(3)}, below the recorded ${floor.precision}`);
    }
    if (got.recall !== null) {
      assert.ok(got.recall >= floor.recall,
        `${klass} recall fell to ${got.recall.toFixed(3)}, below the recorded ${floor.recall}`);
    }
  }

  // template-furniture is in the plan's rule table and in no label of this
  // corpus: the master's own line carries words, so it is recurring text, and
  // the inherited mark is a logo candidate. Predicting it here would be a false
  // positive, so the floor is "never fired", and the class gets its numbers on
  // the private corpus.
  assert.equal(measured['template-furniture'], undefined,
    'template-furniture is unexercised by these fixtures; a prediction here is a regression, not coverage');
});

test('the inherited Confidential line keeps its origin and is never ornament', async () => {
  const { deck, census } = await readFixtureCensus('adversarial.pptx');
  const byId = new Map(objectsOf(deck).map((object) => [object.id, object]));
  const lines = census.objects.filter((row) => textOf(byId.get(row.id) as SourceObjectV1).includes('Confidential'));
  assert.equal(lines.length, deck.slides.length, 'the master line reaches every slide');
  for (const row of lines) {
    assert.equal(row.origin, 'master');
    assert.ok(row.hypothesis.class === 'recurring-text' || row.hypothesis.class === 'template-furniture',
      `a master line with words in it is recurring text or template furniture, not ${row.hypothesis.class}`);
    assert.notEqual(row.hypothesis.class, 'decoration', 'repetition is not a reason to call a confidentiality line ornament');
    const origin = row.hypothesis.evidence.find((item) => item.signal === 'origin');
    assert.ok(origin, 'the hypothesis states where the line came from');
    assert.equal(origin.value, 'master');
    assert.equal(origin.sentence, 'From the slide master.');
  }
});

test('evidence carries a weight and a sentence with the numbers in it', async () => {
  const { census } = await readFixtureCensus('simple.pptx');
  for (const row of census.objects) {
    assert.ok(row.hypothesis.evidence.length > 0, `${row.id} reached a class with no evidence`);
    for (const item of row.hypothesis.evidence) {
      assert.equal(typeof item.weight, 'number');
      assert.ok(item.weight >= -1 && item.weight <= 1, 'a weight is a contribution between -1 and 1');
      assert.ok((item.sentence ?? '').length > 0, `${row.id} carries a ${item.signal} row with no sentence`);
    }
    assert.ok(row.hypothesis.confidence > 0 && row.hypothesis.confidence <= 1);
  }
  const logo = census.objects.find((row) => row.hypothesis.class === 'logo-candidate');
  assert.ok(logo);
  const sentences = logo.hypothesis.evidence.map((item) => item.sentence ?? '').join(' ');
  assert.match(sentences, /Identical picture on each\./);
  assert.match(sentences, /In the slide margin\./);
});

test('every evidence sentence is short, states no method and names no raw placeholder type', async () => {
  const lecture = /because|which is how|not evidence|outranks|was generated|so it|the way a/i;
  const raw = /\b(?:sldNum|ftr|dt|ctrTitle|subTitle|clipArt|tbl)\b/;
  for (const name of ['simple.pptx', 'adversarial.pptx', 'palette.pptx'] as const) {
    const { census } = await readFixtureCensus(name);
    for (const row of census.objects) {
      for (const item of row.hypothesis.evidence) {
        const sentence = item.sentence ?? '';
        assert.ok(sentence.split(/\s+/).length <= 10, `${row.id} ${item.signal}: "${sentence}" runs past ten words`);
        assert.doesNotMatch(sentence, lecture, `${row.id} ${item.signal}: "${sentence}" explains the method`);
        assert.doesNotMatch(sentence, raw, `${row.id} ${item.signal}: "${sentence}" names a raw placeholder type`);
      }
    }
  }
});

test('every census sentence is the review table sentence for the same code, so the two never read differently', async () => {
  // The census writes no English of its own: each row's sentence comes from
  // REVIEW_MESSAGES through evidenceMessage, and this pins that on every row
  // the fixtures reach, including the rows the milestone 4 rules add.
  for (const name of PPTX_FIXTURES) {
    const { deck, census } = await readFixtureCensus(name);
    const kinds = new Map(objectsOf(deck).map((object) => [object.id, object.kind]));
    for (const row of census.objects) {
      const kind = kinds.get(row.id);
      row.hypothesis.evidence.forEach((item, index) => {
        const message = evidenceMessage(row.hypothesis.evidence, index, { class: row.hypothesis.class, ...(kind ? { kind } : {}) });
        assert.equal(item.sentence, message.text, `${name} ${row.id} ${item.signal}`);
        assert.ok(message.code.startsWith('evidence.'), `${row.id} ${item.signal} reads from the evidence codes`);
      });
    }
  }
});

test('the partner mark on three slides is one verified group', async () => {
  const { deck, census } = await readFixtureCensus('adversarial.pptx');
  const marks = objectsOf(deck).filter((object) => object.kind === 'pic');
  assert.equal(marks.length, 3, 'the fixture pastes the same mark on three slides');
  const ids = new Set(marks.map((object) => object.id));
  const group = census.groups.find((candidate) => candidate.members.every((id) => ids.has(id)) && candidate.kind === 'media');
  assert.ok(group, 'the three marks should come back as one group');
  assert.equal(group.members.length, 3);
  assert.equal(group.slideIds.length, 3);
  assert.equal(group.class, 'logo-candidate');
  assert.equal(group.unverified, undefined, 'nothing failed verification here');
  assert.ok(group.members.includes(group.exemplar));
  for (const id of group.members) {
    const row = census.objects.find((candidate) => candidate.id === id);
    assert.equal(row?.groupId, group.id, 'every member points back at its group');
  }
});

test('the citation footer with changing years is one group', async () => {
  const { deck, census } = await readFixtureCensus('adversarial.pptx');
  const citations = objectsOf(deck).filter((object) => textOf(object).startsWith('Source: report'));
  assert.equal(citations.length, 3, 'the fixture changes the year on each slide');
  assert.equal(new Set(citations.map((object) => textOf(object))).size, 3, 'no two are the same text');
  const ids = new Set(citations.map((object) => object.id));
  const groups = census.groups.filter((group) => group.members.some((id) => ids.has(id)));
  assert.equal(groups.length, 1, 'a changing year must not split one footer into three');
  const group = groups[0] as NonNullable<(typeof groups)[number]>;
  assert.equal(group.members.length, 3);
  assert.ok(group.class === 'footer' || group.class === 'recurring-text',
    `a repeated citation is footer or recurring text, not ${group.class}`);
  for (const id of group.members) {
    const row = census.objects.find((candidate) => candidate.id === id);
    const evidence = (row?.hypothesis.evidence ?? []).map((item) => item.signal);
    assert.ok(evidence.includes('digit-normalised-repeat'), 'the wildcarded repeat is stated as evidence');
  }
});

test('the palette fixture states one hex in three roles and a distinction set of eight series', async () => {
  const { census } = await readFixtureCensus('palette.pptx');
  const uses = census.colors.uses.filter((use) => use.hex === '#1F4E79');
  assert.ok(uses.length >= 3, `one hex in three roles, got ${uses.length} uses`);
  assert.equal(new Set(uses.map((use) => use.useId)).size, uses.length, 'each use has its own id');
  const roles = new Set(uses.map((use) => use.role));
  for (const role of ['bg', 'ink', 'accent'] as const) {
    assert.ok(roles.has(role), `#1F4E79 is used as ${role} on this deck and the census should say so`);
  }
  const accent = uses.find((use) => use.role === 'accent');
  assert.equal(accent?.scheme, 'accent1', 'a theme slot travels beside the resolved hex, so a plan can map slot to slot');

  const series = census.colors.uses.filter((use) => use.role === 'series');
  assert.equal(series.length, 8, 'the chart states eight series, and all eight must stay distinguishable');
  const sets = new Set(series.map((use) => use.distinctionSet));
  assert.equal(sets.size, 1, 'they belong to one chart');
  for (const use of series) assert.match(use.useId, /:series:\d+$/);

  // Six swatches named by theme slot, each its own use.
  const slots = census.colors.uses.filter((use) => (use.scheme ?? '').startsWith('accent'));
  assert.equal(slots.length, 6);
});

test('a caller that read the literal series colours overrides the theme cycle', async () => {
  const { deck } = await readFixtureCensus('palette.pptx');
  const chart = objectsOf(deck).find((object) => object.kind === 'chart');
  assert.ok(chart);
  const literals = ['#1F4E79', '#D65A28', '#106E60', '#7A4FBF', '#B8860B', '#2E7D32', '#8E244A', '#3F51B5'];
  const census = censusDeck(deck, { chartSeriesColors: (id) => (id === chart.id ? literals : undefined) });
  const series = census.colors.uses.filter((use) => use.role === 'series');
  assert.equal(series.length, 8);
  assert.deepEqual([...new Set(series.map((use) => use.hex))].sort(), [...literals].sort(),
    'the eight literals the file states are eight distinct uses');
});

test('contrast pairs are measured on the actual pair, with the ordinary minimum for ordinary text', async () => {
  const { census } = await readFixtureCensus('palette.pptx');
  const pairs = census.colors.contrastPairs;
  assert.ok(pairs.length >= 2, 'the palette slide sets text on a ground');
  for (const pair of pairs) {
    assert.notEqual(pair.foreground, pair.background);
    assert.ok(pair.minimum === 4.5 || pair.minimum === 3);
    assert.ok(census.colors.uses.some((use) => use.useId === pair.foreground));
    assert.ok(census.colors.uses.some((use) => use.useId === pair.background));
  }
  for (const pair of pairs) {
    assert.equal(pair.minimum, 3, 'the palette slide sets its text at 20 point, which takes the large-text minimum');
  }
});

test('ordinary text takes the 4.5 minimum against the box it sits on', () => {
  const caption: SourceObjectV1 = {
    id: 't1',
    fingerprint: 'caption',
    kind: 'text',
    box: { x: 80, y: 300, w: 400, h: 40, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    fill: { hex: '#1F4E79' },
    text: { paras: [{ runs: [{ text: 'Eleven point on its own box', sizePt: 11, color: { hex: '#2B2B2B' } }] }] },
  };
  const census = censusDeck(deckOf([slideOf([caption], 0)]));
  const pair = census.colors.contrastPairs.find((candidate) => candidate.objectId === 't1');
  assert.ok(pair, 'a text colour on its own fill is a pair the plan has to keep apart');
  assert.equal(pair.minimum, 4.5);
  assert.equal(pair.foreground, 't1:text');
  assert.equal(pair.background, 't1:fill', 'the pair is the actual foreground and background, not a slide average');
});

test('the layout, font and flattened censuses report what the deck states', async () => {
  const { deck, census } = await readFixtureCensus('adversarial.pptx');
  assert.equal(census.layouts.length, deck.slides.length);
  assert.equal(census.sourceHash, deck.source.hash);
  assert.equal(census.rules.name, CENSUS_RULES.name);
  assert.equal(census.rules.version, CENSUS_RULES.version);
  assert.equal(census.version, 1);

  const third = census.layouts[2];
  assert.ok(third);
  assert.equal(third.chartPresent, true);
  assert.equal(third.tablePresent, true);
  assert.ok((third.largestTextPt ?? 0) >= 36);
  assert.ok(third.textWords > 0);
  assert.equal(typeof third.sourceLayout, 'string');
  assert.equal((third.counts.title ?? 0), 1);

  assert.ok(census.fonts.length > 0);
  for (const font of census.fonts) {
    assert.ok(font.runs > 0);
    assert.ok(font.provenance === 'theme' || font.provenance === 'literal');
  }
  const titleFace = census.fonts.find((font) => (font.roles.title ?? 0) > 0);
  assert.ok(titleFace, 'the titles are set in a face, and the census says which');

  assert.deepEqual(census.flattenedSlideIds, [], 'no slide of this fixture is one full-bleed picture');
});

test('every fixture census validates against schemas/rebrand-census-v1.schema.json', async () => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/rebrand-census-v1.schema.json', import.meta.url), 'utf8')) as object;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  for (const name of PPTX_FIXTURES) {
    const { census } = await readFixtureCensus(name);
    const ok = validate(census) as boolean;
    if (!ok) {
      const errors = (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? ''}`).join('; ');
      assert.fail(`${name}: the census failed the schema: ${errors}`);
    }
  }
});

test('the census is the same on a second run over the same deck', async () => {
  const { deck, census } = await readFixtureCensus('simple.pptx');
  assert.equal(JSON.stringify(censusDeck(deck)), JSON.stringify(census));
});

// ─── hand-written source models: the rules the fixtures cannot reach ─────────

let nextSlide = 0;

function slideOf(objects: SourceObjectV1[], index = nextSlide++): SlideSourceV1 {
  return {
    id: `slide${index + 1}`,
    index,
    width: 1280,
    height: 720,
    background: {},
    objects,
    readingOrder: objects.map((object) => object.id),
    warnings: [],
    origin: { kind: 'pptx' },
  };
}

function deckOf(slides: SlideSourceV1[]): SourceDeckV1 {
  return {
    version: 1,
    source: { kind: 'pptx', hash: 'sha256:synthetic', lineageId: 'synthetic', instanceId: 'one', pageCount: slides.length },
    slides,
    fonts: [],
    warnings: [],
    reader: { name: 'hand-written', version: 'test' },
  };
}

function picture(id: string, x: number, y: number, w: number, h: number, media: string): SourceObjectV1 {
  return {
    id,
    fingerprint: media,
    kind: 'pic',
    box: { x, y, w, h, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'raster-preserved' },
    media,
  };
}

function band(id: string, x: number): SourceObjectV1 {
  return {
    id,
    fingerprint: 'band',
    kind: 'shape',
    box: { x, y: 40, w: 600, h: 56, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    fill: { hex: '#1F4E79' },
    geom: 'rect',
  };
}

test('a band that drifts stays one group, and a band that jumps is no group at all', () => {
  const drift = deckOf([0, 1, 2].map((i) => slideOf([band(`d${i}`, i * 0.02 * 1280)], i)));
  const driftCensus = censusDeck(drift);
  assert.equal(driftCensus.groups.length, 1, 'two percent of the slide width per slide is drift, not a different object');
  assert.equal((driftCensus.groups[0]?.members ?? []).length, 3);
  const jitter = driftCensus.objects[0]?.hypothesis.evidence.find((item) => item.signal === 'position-jitter');
  assert.ok(jitter, 'the movement is stated rather than hidden');

  const jump = deckOf([0, 1, 2].map((i) => slideOf([band(`j${i}`, i * 0.08 * 1280)], i)));
  assert.equal(censusDeck(jump).groups.length, 0, 'eight percent a slide is three different placements, and a group action must not apply');

  const tighter = censusDeck(drift, { jitterTolerance: 0.001 });
  assert.equal(tighter.groups.length, 0, 'the tolerance is set by the caller');
});

test('a candidate that fails verification is listed, never acted on', () => {
  const deck = deckOf([
    slideOf([picture('p0', 1100, 620, 64, 64, 'user/media/mark')], 0),
    slideOf([picture('p1', 1100, 620, 64, 64, 'user/media/mark')], 1),
    slideOf([picture('p2', 200, 120, 64, 64, 'user/media/mark')], 2),
  ]);
  const census = censusDeck(deck);
  assert.equal(census.groups.length, 1);
  const group = census.groups[0];
  assert.ok(group);
  assert.deepEqual(group.members, ['p0', 'p1']);
  assert.deepEqual(group.unverified, ['p2'], 'the same bytes at another place are a candidate, not a member');
  assert.equal(census.objects.find((row) => row.id === 'p2')?.groupId, undefined);
});

test('a registered mark raises a candidate to a known logo, by bytes or by difference hash', () => {
  const slides = [0, 1, 2].map((i) => slideOf([picture(`k${i}`, 1100, 620, 64, 64, 'user/media/mark')], i));
  const deck = deckOf(slides);

  const plain = censusDeck(deck);
  assert.equal(plain.objects[0]?.hypothesis.class, 'logo-candidate', 'with nothing to compare against it stays a candidate');

  const byBytes = censusDeck(deck, { knownLogos: [{ contentHash: 'user/media/mark', label: 'Old Brand mark' }] });
  assert.equal(byBytes.objects[0]?.hypothesis.class, 'known-logo');
  const identity = byBytes.objects[0]?.hypothesis.evidence.find((item) => item.signal === 'known-identity');
  assert.equal(identity?.value, 'Old Brand mark');

  const byHash = censusDeck(deck, {
    rasterStats: () => ({ dhash: '00000000000000ff' }),
    knownLogos: [{ dhash: '00000000000000f0', label: 'Old Brand mark' }],
  });
  assert.equal(byHash.objects[0]?.hypothesis.class, 'known-logo', 'four bits apart is inside the candidate radius');

  const tooFar = censusDeck(deck, {
    rasterStats: () => ({ dhash: '00000000000000ff' }),
    knownLogos: [{ dhash: 'ffffffffffffff00', label: 'Old Brand mark' }],
  });
  assert.equal(tooFar.objects[0]?.hypothesis.class, 'logo-candidate', 'a distant hash is not an identity');
});

test('a picture is a photo only when reading it ran and found no text', () => {
  const one = picture('pic1', 300, 200, 600, 400, 'user/media/photo');
  const deck = deckOf([slideOf([one], 0)]);
  const photoStats = { distinctColors: 9000, axisAlignedEdgeShare: 0.1, edgeDensity: 0.4 };

  const silent = censusDeck(deck, { rasterStats: () => photoStats });
  assert.equal(silent.objects[0]?.hypothesis.class, 'unknown', 'no text recognition means no photo claim');
  const why = silent.objects[0]?.hypothesis.evidence.find((item) => item.signal === 'ocr-state');
  assert.equal(why?.sentence, 'Text in the picture was not read.');

  const unavailable = censusDeck(deck, { rasterStats: () => photoStats, ocr: () => ({ state: 'unavailable' }) });
  assert.equal(unavailable.objects[0]?.hypothesis.class, 'unknown', 'a reader that could not run states nothing');

  const ran = censusDeck(deck, { rasterStats: () => photoStats, ocr: () => ({ state: 'no-text-found' }) });
  assert.equal(ran.objects[0]?.hypothesis.class, 'photo');

  const screen = censusDeck(deck, {
    rasterStats: () => photoStats,
    ocr: () => ({ state: 'text-found', textDensity: 3, lines: [] }),
  });
  assert.equal(screen.objects[0]?.hypothesis.class, 'screenshot');

  const drawn = censusDeck(deck, {
    rasterStats: () => ({ distinctColors: 12, axisAlignedEdgeShare: 0.8 }),
    ocr: () => ({ state: 'text-found', textDensity: 4, lines: [] }),
  });
  assert.equal(drawn.objects[0]?.hypothesis.class, 'chart', 'a text-heavy picture of flat colours and straight edges reads as a chart');
});

test('a native chart outranks anything read off pixels', () => {
  const chart: SourceObjectV1 = {
    id: 'c1',
    fingerprint: 'chart',
    kind: 'chart',
    box: { x: 200, y: 200, w: 600, h: 300, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'unavailable', reason: 'native-chart-no-fallback' },
    tag: 'barChart',
    chartData: { type: 'barChart', categories: ['a'], series: [{ name: 'EU', values: [1] }] },
    raster: { distinctColors: 9000, axisAlignedEdgeShare: 0.05 },
    ocr: { state: 'no-text-found' },
  };
  const census = censusDeck(deckOf([slideOf([chart], 0)]));
  assert.equal(census.objects[0]?.hypothesis.class, 'chart');
  const native = census.objects[0]?.hypothesis.evidence.find((item) => item.signal === 'chart-data');
  assert.equal(native?.sentence, '1 data series in the file.');
  const tag = census.objects[0]?.hypothesis.evidence.find((item) => item.signal === 'native-tag');
  assert.equal(tag?.sentence, 'Source names a bar chart.');
});

test('a slide that is one full-bleed picture is reported as flattened', () => {
  const full = picture('f0', 0, 0, 1280, 720, 'user/media/page');
  const census = censusDeck(deckOf([slideOf([full], 0)]));
  assert.deepEqual(census.flattenedSlideIds, ['slide1']);
});

// ─── what candidate generation must NOT merge ────────────────────────────────

/** A picture with no stored media, whose bytes a shell would have to decode. */
function fallbackPicture(id: string, x: number, y: number, ref: string): SourceObjectV1 {
  return {
    id,
    fingerprint: ref,
    kind: 'pic',
    box: { x, y, w: 64, h: 64, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'raster-preserved', fallbackAssetRef: ref },
  };
}

function drawing(id: string, svg: string): SourceObjectV1 {
  return {
    id,
    fingerprint: svg,
    kind: 'vector',
    box: { x: 1100, y: 620, w: 64, h: 64, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    vector: svg,
  };
}

test('two pictures that only collide under a difference hash are not one group', () => {
  const deck = deckOf([
    slideOf([fallbackPicture('c1', 1100, 620, 'user/media/mark')], 0),
    slideOf([fallbackPicture('c2', 1100, 620, 'user/media/mark')], 1),
    slideOf([fallbackPicture('c3', 1100, 620, 'user/media/other')], 2),
  ]);
  // One dHash for all three, which is what a flat or near-flat picture gives.
  const census = censusDeck(deck, { rasterStats: () => ({ dhash: '0000000000000000' }) });
  assert.equal(census.groups.length, 1);
  const group = census.groups[0];
  assert.ok(group);
  assert.deepEqual(group.members, ['c1', 'c2'], 'the two that carry the same ref are the group');
  assert.deepEqual(group.unverified, ['c3'], 'a colliding hash over different bytes is a candidate, never a member');
  const row = census.objects.find((candidate) => candidate.id === 'c1');
  assert.equal(row?.hypothesis.evidence.some((item) => item.signal === 'dhash-group'), true,
    'the group says it was generated by a difference hash and then verified');
});

test('a picture with no content identity to compare is never called a byte identical repeat', () => {
  const noRef = (id: string): SourceObjectV1 => ({
    id,
    fingerprint: id,
    kind: 'pic',
    box: { x: 1100, y: 620, w: 64, h: 64, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'raster-preserved' },
    raster: { dhash: '00000000000000ff' },
  });
  const deck = deckOf([slideOf([noRef('n1')], 0), slideOf([noRef('n2')], 1)]);
  const census = censusDeck(deck);
  assert.equal(census.groups.length, 1, 'the hash is still enough to raise a candidate');
  const evidence = census.objects[0]?.hypothesis.evidence ?? [];
  assert.equal(evidence.some((item) => item.signal === 'digit-normalised-repeat'), false,
    'nothing here is a wildcarded text repeat');
});

test('two path-free drawings at one place are two drawings', () => {
  const rect = '<svg><rect x="0" y="0" width="64" height="64" fill="#D0021B"/></svg>';
  const circle = '<svg><circle cx="32" cy="32" r="30" fill="#1F4E79"/></svg>';
  const mixed = deckOf([slideOf([drawing('v1', rect)], 0), slideOf([drawing('v2', circle)], 1)]);
  assert.equal(censusDeck(mixed).groups.length, 0,
    'a red square and a blue disc at the same corner are not one mark');

  const same = deckOf([slideOf([drawing('s1', rect)], 0), slideOf([drawing('s2', rect)], 1)]);
  assert.equal(censusDeck(same).groups.length, 1, 'the same drawing twice is one group');

  const empty = '<svg><text>SUSE</text></svg>';
  const none = deckOf([slideOf([drawing('e1', empty)], 0), slideOf([drawing('e2', empty)], 1)]);
  assert.equal(censusDeck(none).groups.length, 0, 'a drawing with no geometry read forms no family at all');
});

test('a two member family that loses one reports nothing, which is a decision and not an oversight', () => {
  const deck = deckOf([
    slideOf([picture('m0', 1100, 620, 64, 64, 'user/media/mark')], 0),
    slideOf([picture('m1', 200, 120, 64, 64, 'user/media/mark')], 1),
  ]);
  const census = censusDeck(deck);
  assert.equal(census.groups.length, 0, 'one verified member is not a repeat');
  for (const row of census.objects) assert.equal(row.groupId, undefined);
  // The near match is not reported anywhere: `ObjectGroupV1` has no room for a
  // group with no members. Read the note on `verifyFamily` before changing this.
});

// ─── the colour census reports what it could read ────────────────────────────

test('a fill stated only as a theme slot is still a colour use', () => {
  const panel: SourceObjectV1 = {
    id: 'panel',
    fingerprint: 'panel',
    kind: 'shape',
    box: { x: 0, y: 0, w: 1280, h: 720, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    fill: { scheme: 'accent1' },
    geom: 'rect',
  };
  const deck = deckOf([slideOf([panel], 0)]);
  deck.theme = { colors: { accent1: '#1F4E79', dk1: '#101318', lt1: '#FFFFFF' } };
  const census = censusDeck(deck);
  const use = census.colors.uses.find((candidate) => candidate.objectIds.includes('panel'));
  assert.ok(use, 'a colour named by its slot is the case slot-to-slot mapping exists for');
  assert.equal(use.hex, '#1F4E79', 'the slot resolves through the theme the deck states');
  assert.equal(use.scheme, 'accent1', 'the slot travels beside the resolved hex');
});

test('a slide that states no ground gets no background use', () => {
  const chip: SourceObjectV1 = {
    id: 'chip',
    fingerprint: 'chip',
    kind: 'shape',
    box: { x: 1100, y: 600, w: 60, h: 40, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    fill: { hex: '#FFCC00' },
    geom: 'rect',
  };
  const census = censusDeck(deckOf([slideOf([chip], 0)]));
  assert.equal(census.colors.uses.some((use) => use.role === 'bg'), false,
    'the heaviest filled shape on a slide is a shape, not the deck ground');

  const withGround = deckOf([{ ...slideOf([chip], 0), background: { color: { hex: '#FFFFFF' } } }]);
  const grounded = censusDeck(withGround);
  const bg = grounded.colors.uses.find((use) => use.role === 'bg');
  assert.ok(bg, 'a stated ground is the background');
  assert.equal(bg.hex, '#FFFFFF');
  assert.equal(bg.useId, 'slide:slide1:fill', 'the ground id sits outside the object id space');
});

test('two different colours never merge into one use because their ids met', () => {
  const awkward: SourceObjectV1 = {
    id: 'slide:slide1',
    fingerprint: 'awkward',
    kind: 'shape',
    box: { x: 0, y: 0, w: 200, h: 200, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    fill: { hex: '#FF0000' },
    geom: 'rect',
  };
  const deck = deckOf([{ ...slideOf([awkward], 0), background: { color: { hex: '#00FF00' } } }]);
  const census = censusDeck(deck);
  const hexes = census.colors.uses.map((use) => use.hex).sort();
  assert.deepEqual(hexes, ['#00FF00', '#FF0000'], 'both colours are reported');
  assert.equal(new Set(census.colors.uses.map((use) => use.useId)).size, 2, 'each keeps an id of its own');
});

test('contrast is reported on a pair that touches, or on no pair at all', () => {
  const ink = { hex: '#1A1A1A' };
  const title = (id: string): SourceObjectV1 => ({
    id,
    fingerprint: id,
    kind: 'text',
    box: { x: 60, y: 40, w: 400, h: 60, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs: [{ text: 'Quarterly review', sizePt: 11, color: ink }] }] },
  });
  const chip: SourceObjectV1 = {
    id: 'chip',
    fingerprint: 'chip',
    kind: 'shape',
    box: { x: 1100, y: 600, w: 60, h: 40, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    fill: { hex: '#FFCC00' },
    geom: 'rect',
  };
  const apart = censusDeck(deckOf([slideOf([title('t1'), chip], 0)]));
  assert.deepEqual(apart.colors.contrastPairs, [],
    'a swatch in the far corner is not the box the title sits on, so there is no pair to measure');

  const header: SourceObjectV1 = {
    id: 'header',
    fingerprint: 'header',
    kind: 'shape',
    box: { x: 0, y: 0, w: 1280, h: 200, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    fill: { hex: '#1F4E79' },
    geom: 'rect',
  };
  const over = censusDeck(deckOf([slideOf([header, chip, title('t2')], 0)]));
  const pair = over.colors.contrastPairs.find((candidate) => candidate.objectId === 't2');
  assert.ok(pair, 'a title lying on a header band is a pair');
  assert.equal(pair.background, 'header:fill', 'the band under it is the background, not the heaviest fill elsewhere');
  assert.equal(pair.minimum, 4.5);
});

// ─── classes that the fixtures do not reach ──────────────────────────────────

test('an empty inherited placeholder is furniture, not a confident title', () => {
  const slot: SourceObjectV1 = {
    id: 'empty-title',
    fingerprint: 'empty-title',
    kind: 'text',
    box: { x: 80, y: 120, w: 1120, h: 110, rot: 0 },
    origin: 'layout',
    fidelity: { state: 'editable' },
    placeholder: 'title',
  };
  const census = censusDeck(deckOf([slideOf([slot], 0)]));
  const row = census.objects[0];
  assert.ok(row);
  assert.equal(row.hypothesis.class, 'template-furniture', 'an empty slot holds no content to class');
  assert.ok(row.hypothesis.confidence < 0.95, 'and it is not stated with a content class confidence');
  const signals = row.hypothesis.evidence.map((item) => item.signal);
  assert.ok(signals.includes('placeholder') && signals.includes('origin'),
    'the review is told both which slot it is and where it was declared');
  assert.equal(census.layouts[0]?.counts.title ?? 0, 0, 'an empty slot is not a title in the layout census');
});

test('a repeated line written in sentences keeps its class and offers footer as the alternative', () => {
  const note = (id: string): SourceObjectV1 => ({
    id,
    fingerprint: 'note',
    kind: 'text',
    box: { x: 80, y: 620, w: 500, h: 22, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs: [{ text: 'Acme Corp and its partners, internal use only', sizePt: 9 }] }] },
  });
  const deck = deckOf([0, 1, 2].map((i) => slideOf([note(`f${i}`)], i)));
  const row = censusDeck(deck).objects[0];
  assert.ok(row);
  assert.equal(row.hypothesis.class, 'body', 'a sentence in the bottom band is content until something says otherwise');
  assert.equal(row.hypothesis.alternative, 'footer',
    'but a line repeated down there is raised as a footer candidate rather than left with no trace');
});

test('a group whose members split on class settles on its exemplar, not on the contract order', () => {
  const heading = (id: string, placeholder: boolean): SourceObjectV1 => {
    const object: SourceObjectV1 = {
      id,
      fingerprint: 'heading',
      kind: 'text',
      box: { x: 80, y: 60, w: 600, h: 60, rot: 0 },
      origin: 'slide',
      fidelity: { state: 'editable' },
      text: { paras: [{ runs: [{ text: 'Q1 KEY FIGURES', sizePt: 36 }] }] },
    };
    if (placeholder) object.placeholder = 'title';
    return object;
  };
  const deck = deckOf([slideOf([heading('a-title', true)], 0), slideOf([heading('b-repeat', false)], 1)]);
  const census = censusDeck(deck);
  const group = census.groups[0];
  assert.ok(group, 'the same headline twice is one group');
  const classes = group.members.map((id) => census.objects.find((row) => row.id === id)?.hypothesis.class);
  assert.deepEqual([...new Set(classes)].sort(), ['recurring-text', 'title'], 'the two members split one to one');
  assert.equal(group.exemplar, 'a-title');
  assert.equal(group.class, 'title', 'a tie settles on the exemplar rather than on the order of the contract array');
});

// ─── the milestone 4 tuning on the labelled private corpus ───────────────────
//
// Each rule below was changed against hand labels of three private decks
// (MEDDPICC, template-example, Why SUSE Summary; 1405 objects) and carries its
// measured effect there, pooled over the three, hits and predictions without
// the rule and with it. The numbers come from `scripts/rebrand-eval.ts
// --labels=<corpus>/labels` with one rule switched off at a time.

function textBox(id: string, body: string, pt: number, box: { x: number; y: number; w: number; h: number }, over: Partial<SourceObjectV1> = {}): SourceObjectV1 {
  return {
    id,
    fingerprint: `text:${id}`,
    kind: 'text',
    box: { ...box, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: body.split('\n').map((line) => ({ runs: [{ text: line, sizePt: pt }] })) },
    ...over,
  };
}

function classOf(census: DeckCensusV1, id: string): string | undefined {
  return census.objects.find((row) => row.id === id)?.hypothesis.class;
}

test('a small mark the layout places in the margin is a logo candidate on a deck that shows it once', () => {
  // MEDDPICC slide 1: the design system's own logo as a picture, from the title
  // layout, on the one slide that uses it. Pooled labels, logo-candidate hits
  // 15 to 65 of 72 and 18 to 68 predicted, with the freeform clause below.
  const mark: SourceObjectV1 = { ...picture('m1', 52, 55, 200, 66, 'user/media/logo'), origin: 'master' };
  const census = censusDeck(deckOf([slideOf([mark], 0), slideOf([], 1)]));
  const row = census.objects[0];
  assert.equal(row?.hypothesis.class, 'logo-candidate', 'the layout repeats it by construction');
  const origin = row?.hypothesis.evidence.find((item) => item.signal === 'origin');
  assert.equal(origin?.sentence, 'From the slide master.');

  // The same picture pasted on one slide is not a mark anybody repeated.
  const pasted = censusDeck(deckOf([slideOf([picture('p1', 52, 55, 200, 66, 'user/media/logo')], 0), slideOf([], 1)]));
  assert.equal(pasted.objects[0]?.hypothesis.class, 'unknown');
});

test('a mark drawn as freeform shapes is a logo candidate, and a strip across the margin is not', () => {
  const freeform = (id: string, x: number, w: number, h: number): SourceObjectV1 => ({
    id,
    fingerprint: `shape:${id}`,
    kind: 'shape',
    box: { x, y: 497, w, h, rot: 0 },
    origin: 'master',
    fidelity: { state: 'editable' },
    fill: { hex: '#30BA78' },
  });
  // template-example: the chameleon and the wordmark on every slide, drawn as paths.
  const deck = deckOf([0, 1, 2].map((i) => slideOf([freeform(`c${i}`, 23, 47, 24), freeform(`w${i}`, 78, 76, 19)], i)));
  const census = censusDeck(deck);
  for (const id of ['c0', 'w0', 'c2', 'w2']) assert.equal(classOf(census, id), 'logo-candidate', id);

  // SAP - Event in a Box: a picture strip across the top of a layout is small in
  // area and in the margin, and 46% of the slide wide. With the cap, 37 to 30
  // logo candidates on that deck, all seven removed being the strip.
  const strip: SourceObjectV1 = { ...picture('s0', 1, 0, 583, 89, 'user/media/strip'), origin: 'master' };
  assert.ok(583 / 1280 >= LOGO_MAX_LONG_SIDE_SHARE);
  const stripCensus = censusDeck(deckOf([slideOf([strip], 0)]));
  assert.equal(stripCensus.objects[0]?.hypothesis.class, 'template-furniture');
});

test('a picture the layout or master placed is template furniture, whatever its pixels read as', () => {
  // Pooled labels: template-furniture hits 51 to 55 of 55, unknown predictions 43 to 39.
  const art: SourceObjectV1 = { ...picture('art', 579, 87, 382, 453, 'user/media/mascot'), origin: 'master' };
  const photoStats = { distinctColors: 9000, axisAlignedEdgeShare: 0.1 };
  const census = censusDeck(deckOf([slideOf([art], 0)]), { rasterStats: () => photoStats });
  const row = census.objects[0];
  assert.equal(row?.hypothesis.class, 'template-furniture');
  assert.equal(census.layouts[0]?.counts.unknown ?? 0, 0, 'the layout census does not count it as an unclassed picture');
  const ran = censusDeck(deckOf([slideOf([art], 0)]), { rasterStats: () => photoStats, ocr: () => ({ state: 'no-text-found' }) });
  assert.equal(ran.objects[0]?.hypothesis.class, 'template-furniture', 'where it came from outranks what its pixels read as');
  assert.equal(ran.objects[0]?.hypothesis.alternative, 'photo', 'and the reading is kept as the other answer');
});

test('a lone letter is a badge, and the title is the heading of two or more words', () => {
  // MEDDPICC slides 5 to 12: a 48 pt letter in a circle, a 14 pt heading in a
  // navy box, 18 pt question lists. Before, the letter was the title.
  const letter = textBox('letter', 'M', 48, { x: 67, y: 67, w: 68, h: 70 });
  const heading = textBox('heading', 'METRICS - Measure the potential gain leading to the economic benefit', 14, { x: 180, y: 67, w: 626, h: 70 });
  const list = (id: string, x: number): SourceObjectV1 => textBox(id, 'How long does it take?\nHow important is it?\nWhat limits you today?', 18, { x, y: 172, w: 516, h: 444 });
  const census = censusDeck(deckOf([slideOf([letter, heading, list('left', 67), list('right', 623)], 0)]));
  const badge = census.objects.find((row) => row.id === 'letter');
  assert.equal(badge?.hypothesis.class, 'decoration', `a ${DISPLAY_LETTER_PT} pt letter or larger names nothing`);
  assert.equal(badge?.hypothesis.alternative, 'body', 'and the review can call it text in one step');
  assert.deepEqual(badge?.hypothesis.evidence.map((item) => item.sentence), ['1 word, 48 pt.', '1 word.']);
  assert.equal(classOf(census, 'heading'), 'title', 'the first short line in the top band over body copy');
  assert.equal(classOf(census, 'left'), 'body');
  // Pooled labels: lone letters take decoration hits 229 to 245 and body
  // predictions 78 to 62; the heading rule takes title hits 17 to 23 of 25.

  // A small letter (a table cell, an axis mark) stays text.
  const small = censusDeck(deckOf([slideOf([textBox('a', 'A', 12, { x: 400, y: 400, w: 20, h: 20 })], 0)]));
  assert.equal(small.objects[0]?.hypothesis.class, 'body');

  // A heading longer than the limit is left as body rather than read as a title.
  const long = textBox('long', 'x '.repeat(Math.ceil(HEADING_MAX_CHARS / 2) + 1).trim(), 14, { x: 180, y: 49, w: 770, h: 70 });
  const tooLong = censusDeck(deckOf([slideOf([long, list('left', 67)], 0)]));
  assert.equal(classOf(tooLong, 'long'), 'body');
});

test('the title placeholder names the slide, and a text slot holding the one largest short line names it when there is none', () => {
  const title = textBox('t', 'Hybrid cloud IT', 32, { x: 77, y: 66, w: 1126, h: 48 }, { placeholder: 'title' });
  const other = textBox('o', 'Customer challenges we hear', 40, { x: 77, y: 20, w: 900, h: 40 });
  const named = censusDeck(deckOf([slideOf([title, other], 0)]));
  assert.equal(classOf(named, 't'), 'title');
  assert.notEqual(classOf(named, 'o'), 'title', 'a larger free line does not take the title from the placeholder');

  // MEDDPICC slides 1, 2 and 4 set their titles in a body placeholder. Pooled
  // labels: title hits 19 to 23 with body predictions 66 to 62.
  const slot = textBox('slot', 'MEDDPICC-based Selling:\nWhat to Ask, When', 32, { x: 77, y: 261, w: 563, h: 93 }, { placeholder: 'body' });
  const date = textBox('date', 'October 2022', 10, { x: 77, y: 176, w: 493, h: 15 }, { placeholder: 'body' });
  const lifted = censusDeck(deckOf([slideOf([slot, date], 0)]));
  assert.equal(classOf(lifted, 'slot'), 'title');
  const lift = lifted.objects.find((row) => row.id === 'slot')?.hypothesis;
  assert.equal(lift?.alternative, 'body');
  assert.ok(lift?.evidence.some((item) => item.sentence === 'Largest text on the slide.'));
  assert.equal(classOf(lifted, 'date'), 'body');

  // Two text slots at one size: nothing is the one largest, so nothing is lifted.
  const twin = textBox('twin', 'Another line of equal size', 32, { x: 700, y: 261, w: 500, h: 93 }, { placeholder: 'body' });
  const tie = censusDeck(deckOf([slideOf([slot, twin], 0)]));
  assert.equal(classOf(tie, 'slot'), 'body');
});

test('the size-rank sentence counts larger text sizes, so two texts at one size count once', () => {
  // SAP - Event in a Box slide 6 read "4 other texts on the slide are larger"
  // beside five larger texts: the rank counts distinct sizes, and two texts
  // shared one. The sentence now says sizes, which is what the rank measures.
  const at = (id: string, pt: number, y: number): SourceObjectV1 =>
    textBox(id, `A line of body copy ${id}`, pt, { x: 300, y, w: 600, h: 40 });
  const census = censusDeck(deckOf([slideOf([
    at('a', 40, 300), at('b', 40, 350), at('c', 30, 400), at('d', 24, 450), at('e', 18, 500), at('f', 12, 550),
  ], 0)]));
  const sentence = (id: string): string | undefined => census.objects.find((row) => row.id === id)?.hypothesis.evidence
    .find((item) => item.signal === 'size-rank')?.sentence;
  assert.equal(sentence('a'), 'Largest text on the slide.');
  assert.equal(sentence('b'), 'Largest text on the slide.', 'a tie shares the rank');
  assert.equal(sentence('c'), 'Second largest text size on the slide.', 'two texts are larger, at one size');
  assert.equal(sentence('d'), 'Third largest text size on the slide.');
  assert.equal(sentence('e'), '3 larger text sizes on the slide.');
  assert.equal(sentence('f'), '4 larger text sizes on the slide.', 'five texts are larger, at four sizes');

  // A heading lifted by the rank over texts of two or more words still states the
  // rank over every text, so a larger lone letter beside it is counted.
  const badge = textBox('badge', 'M', 60, { x: 40, y: 300, w: 80, h: 80 });
  const heading = textBox('heading', 'Customer challenges we hear', 32, { x: 150, y: 30, w: 900, h: 50 });
  const lifted = censusDeck(deckOf([slideOf([badge, heading, at('copy', 14, 300)], 0)]));
  const lift = lifted.objects.find((row) => row.id === 'heading')?.hypothesis;
  assert.equal(lift?.class, 'title');
  assert.equal(lift?.evidence.find((item) => item.signal === 'size-rank')?.sentence, 'Second largest text size on the slide.');
});

test('an empty placeholder is a slot, not ornament, however large', () => {
  // template-example: empty title, body and picture placeholders on a
  // layout-sample deck. Pooled labels: template-furniture hits 35 to 55 and
  // decoration predictions 273 to 253.
  const body: SourceObjectV1 = {
    id: 'body', fingerprint: 'body', kind: 'shape', box: { x: 33, y: 79, w: 895, h: 379, rot: 0 },
    origin: 'slide', fidelity: { state: 'editable' }, placeholder: 'body', geom: 'rect',
  };
  const pic: SourceObjectV1 = { ...body, id: 'pic', fingerprint: 'pic', box: { x: 480, y: 0, w: 480, h: 540, rot: 0 }, placeholder: 'pic' };
  const census = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([{ ...body, id: `body${i}` }, { ...pic, id: `pic${i}` }], i))));
  for (const row of census.objects) assert.equal(row.hypothesis.class, 'template-furniture', row.id);
});

test('the parts of a drawing on a slide are a diagram, and the template bands are still ornament', () => {
  // template-example slide 24 draws 140 icons from 811 freeforms, and slide 15
  // its diagram templates. Pooled labels: diagram hits 0 to 857 of 858 and
  // decoration predictions 1041 to 253, which is most of the 982 that plan
  // 274 recorded for the deck. The rest of the 982 was right: the master's colour bars and panels.
  const part = (id: string, x: number, fill: string, over: Partial<SourceObjectV1> = {}): SourceObjectV1 => ({
    id, fingerprint: `shape:${id}`, kind: 'shape', box: { x, y: 30, w: 20, h: 24, rot: 0 },
    origin: 'slide', fidelity: { state: 'editable' }, fill: { hex: fill }, groupPath: ['627'], ...over,
  });
  const icon = [part('a', 31, '#0C322C'), part('b', 40, '#FE7C3F'), part('c', 49, '#0C322C')];
  const census = censusDeck(deckOf([slideOf(icon, 0)]));
  for (const row of census.objects) assert.equal(row.hypothesis.class, 'diagram', row.id);
  const fills = census.objects[0]?.hypothesis.evidence.find((item) => item.signal === 'fill-count');
  assert.equal(fills?.sentence, 'Part of a drawing in 2 colours.');

  // A bar grouped with its label is not a drawing, so it stays what it was.
  const bar = part('bar', 120, '#30BA78', { geom: 'rect', groupPath: ['70'], box: { x: 120, y: 470, w: 200, h: 30, rot: 0 } });
  const label = textBox('label', 'Phase one', 12, { x: 120, y: 500, w: 200, h: 30 }, { groupPath: ['70'] });
  const grouped = censusDeck(deckOf([slideOf([bar, label], 0)]));
  assert.equal(classOf(grouped, 'bar'), 'decoration');

  // A freeform the master repeats on every slide is the template's band.
  const band = (i: number): SourceObjectV1 => ({
    id: `band${i}`, fingerprint: 'band', kind: 'shape', box: { x: 479, y: 504, w: 173, h: 11, rot: 0 },
    origin: 'master', fidelity: { state: 'editable' }, fill: { hex: '#64E572' },
  });
  const banded = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([band(i)], i))));
  assert.equal(classOf(banded, 'band0'), 'decoration');
});

test('a connector drawn across the slide is a line of the drawing, not ornament', () => {
  // template-example slide 18: the timeline axis is a straight connector the
  // width of the slide. The page-wide rule read it as decoration and the plan
  // proposed its removal, though the labels mark it as one to keep.
  const axis = (id: string, origin: SourceObjectV1['origin'] = 'slide'): SourceObjectV1 => ({
    id, fingerprint: 'shape:axis', kind: 'shape', box: { x: -1, y: 368, w: 1282, h: 0, rot: 0 },
    origin, fidelity: { state: 'editable' }, geom: 'straightConnector1', line: { color: { hex: '#058DC7' }, widthPt: 2.25 },
  });
  const census = censusDeck(deckOf([slideOf([axis('axis')], 0)]));
  const row = census.objects[0]?.hypothesis;
  assert.equal(row?.class, 'diagram');
  assert.equal(row?.evidence[0]?.sentence, 'A connector line, which joins parts of a drawing.');

  // A plain line the width of the slide is still the page-wide ornament.
  const rule = censusDeck(deckOf([slideOf([{ ...axis('rule'), geom: 'line' }], 0)]));
  assert.equal(classOf(rule, 'rule'), 'decoration');

  // So is a connector the layout draws: that is the template's line, not the slide's.
  const layout = censusDeck(deckOf([slideOf([axis('band', 'layout')], 0)]));
  assert.equal(classOf(layout, 'band'), 'decoration');
});

test('two objects that share a fill are two groups, not one that neither passes', () => {
  // template-example paints its chameleon mark, a colour bar and a dozen icon
  // parts in one blue. Verified against one median box, neither the mark nor
  // the bar held together, and the mark reached the review as one item per
  // slide. With the family split by box, template-example goes from 27 items
  // needing attention to 12, and its groups from 7 to 19.
  const blue = (id: string, x: number, y: number, w: number, h: number): SourceObjectV1 => ({
    id, fingerprint: `shape:${id}`, kind: 'shape', box: { x, y, w, h, rot: 0 },
    origin: 'master', fidelity: { state: 'editable' }, fill: { hex: '#058DC7' }, geom: 'rect',
  });
  const slides = [0, 1, 2].map((i) => slideOf([
    blue(`mark${i}`, 23, 497, 47, 24),
    blue(`bar${i}`, 757, 504, 203, 11),
    ...(i === 1 ? [0, 1, 2, 3, 4].map((n) => ({ ...blue(`part${n}`, 540 + n * 24, 80, 7, 7), origin: 'slide' as const })) : []),
  ], i));
  const census = censusDeck(deckOf(slides));
  const members = census.groups.map((group) => [...group.members].sort().join(','));
  assert.ok(members.includes('mark0,mark1,mark2'), `the mark is one group: ${JSON.stringify(members)}`);
  assert.ok(members.includes('bar0,bar1,bar2'), 'and so is the bar');
  for (const group of census.groups) {
    for (const id of group.unverified ?? []) assert.ok(!id.startsWith('part'), 'an icon part that only shares the fill is not a candidate of either');
  }
});

test('template text on one slide is template furniture, and on every slide it is recurring text', () => {
  // template-example slide 21 and the Why SUSE closing slide: an address block
  // the closing layout draws once. Pooled labels: template-furniture hits 51 to
  // 55 and recurring-text predictions 17 to 11.
  const address = (id: string): SourceObjectV1 => textBox(id, 'SUSE S.A., 11-13 Boulevard de la Foire, Luxembourg', 12, { x: 69, y: 320, w: 293, h: 159 }, { origin: 'master' });
  const once = censusDeck(deckOf([slideOf([address('a0')], 0), slideOf([], 1), slideOf([], 2)]));
  assert.equal(classOf(once, 'a0'), 'template-furniture');
  assert.equal(once.objects[0]?.hypothesis.alternative, 'recurring-text');
  const every = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([address(`e${i}`)], i))));
  assert.equal(classOf(every, 'e0'), 'recurring-text');
});

test('a picture whose text was not read keeps an honest class on every path', () => {
  // Plan 274 section 3.2: text not read is not evidence of a photo. Pooled
  // labels hold five photographs; all five stay unknown with the reason, and
  // the eval counts them apart rather than inside recall.
  const photoStats = { distinctColors: 9000, axisAlignedEdgeShare: 0.05 };
  const drawnStats = { distinctColors: 8, axisAlignedEdgeShare: 0.9 };
  for (const stats of [photoStats, drawnStats]) {
    for (const ocr of [undefined, { state: 'not-run' as const }, { state: 'unavailable' as const }]) {
      const census = censusDeck(deckOf([slideOf([picture('p', 584, 6, 696, 714, 'user/media/valley')], 0)]), {
        rasterStats: () => stats,
        ...(ocr ? { ocr: () => ocr } : {}),
      });
      const row = census.objects[0];
      assert.equal(row?.hypothesis.class, 'unknown', `${JSON.stringify(stats)} ${ocr?.state ?? 'no reader'}`);
      assert.ok(row?.hypothesis.evidence.some((item) => item.signal === 'ocr-state'), 'and it says why');
    }
  }
});

// ─── the private corpus ──────────────────────────────────────────────────────

test('the census completes on every private deck and gives every object a class', { skip: skipReason() ?? false }, async () => {
  const corpus = privateCorpus();
  assert.ok(corpus, 'the skip guard should have run instead');
  const decks = [...corpus.files, ...corpus.slidesToTest].filter((file) => file.toLowerCase().endsWith('.pptx'));
  assert.ok(decks.length > 0, 'the corpus directory holds no pptx to census');
  for (const file of decks) {
    const bytes = new Uint8Array(readFileSync(file));
    const parts = await inflatePptx(bytes);
    const deck = await sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'private',
      sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
      reader: { name: 'pptx-read', version: 'test' },
    });
    const census = censusDeck(deck);
    const counted = new Set(census.objects.map((row) => row.id));
    for (const object of objectsOf(deck)) {
      assert.ok(counted.has(object.id), `${file}: ${object.id} reached no class`);
    }
    for (const row of census.objects) {
      const klass: ObjectClassV1 = row.hypothesis.class;
      assert.equal(typeof klass, 'string');
      assert.ok(row.hypothesis.evidence.length > 0, `${file}: ${row.id} reached ${klass} with no evidence`);
    }
  }
});

/**
 * A floor for one class: precision and recall that may only go up, or null
 * where the number is not measured. `maxPredicted` caps a class the labels never
 * use, whose precision is zero by construction and so cannot be floored: without
 * the cap, false predictions of it would pass however many there were.
 */
interface ClassFloorV1 {
  precision: number | null;
  recall: number | null;
  maxPredicted?: number;
}

/**
 * Floors per class on the three hand-labelled private decks, pooled, measured
 * 2026-09-24 with census-rules-2026-09-24.5 over 1329 objects: the 1405
 * labelled, less the 76 the labels list as `unsure`, which are left out of every
 * count so a guess in the labels is neither a hit nor a miss. Floors only ever
 * go up. `footer`, `date` and `photo` have labelled objects the rules do not
 * reach (a copyright line the census calls recurring text or template
 * furniture; one cover date; photographs whose text nobody read), so their
 * recall is recorded as it stands and their precision is not measured.
 * `recurring-text` is never a label here: its five predictions are the Why SUSE
 * footer lines, so it is capped at five rather than floored.
 *
 * The labels come from rules in `labels/make-labels.ts` written beside the
 * census rules, and template-example's 858 diagram labels are given in bulk by
 * slide, so a pooled 1.00 is weak evidence. The per-deck floors below are the
 * check that a fall on the two small decks shows through template-example's
 * 1121 objects.
 */
const PRIVATE_FLOORS: Record<string, ClassFloorV1> = {
  body: { precision: 0.94, recall: 1 },
  decoration: { precision: 0.96, recall: 1 },
  diagram: { precision: 1, recall: 1 },
  'logo-candidate': { precision: 1, recall: 0.9 },
  'page-number': { precision: 1, recall: 1 },
  subtitle: { precision: 1, recall: 0.66 },
  table: { precision: 1, recall: 1 },
  'template-furniture': { precision: 0.98, recall: 1 },
  title: { precision: 1, recall: 0.95 },
  unknown: { precision: 0.84, recall: 1 },
  footer: { precision: null, recall: 0 },
  date: { precision: null, recall: 0 },
  photo: { precision: null, recall: 0 },
  'recurring-text': { precision: null, recall: null, maxPredicted: 5 },
};

/**
 * The same floors deck by deck, measured with the pooled ones, keyed by deck
 * name without extension. Numbers in the comments are hits over predictions
 * (precision) and hits over labels (recall) at that measurement.
 */
const PRIVATE_DECK_FLOORS: Record<string, Record<string, ClassFloorV1>> = {
  // 142 objects. body 32/35, 32/32 (the eight slide 3 letters are row numbering and
  // labelled body since plan 275 F11); title 10/10, 10/11; one template-furniture
  // and three unknown predictions the labels call a footer, a date and photos.
  'MEDDPICC Question-based Selling - SAP': {
    body: { precision: 0.88, recall: 1 },
    decoration: { precision: 1, recall: 1 },
    'logo-candidate': { precision: 1, recall: 1 },
    title: { precision: 1, recall: 0.9 },
    'template-furniture': { precision: null, recall: null, maxPredicted: 1 },
    unknown: { precision: null, recall: null, maxPredicted: 3 },
    'recurring-text': { precision: null, recall: null, maxPredicted: 0 },
  },
  // 66 objects. Every sure label of body, decoration, logo-candidate,
  // page-number, template-furniture and title is a hit; five recurring-text
  // predictions are the footer lines and two unknown ones are photographs.
  'Why SUSE Summary': {
    body: { precision: 1, recall: 1 },
    decoration: { precision: 1, recall: 1 },
    'logo-candidate': { precision: 1, recall: 1 },
    'page-number': { precision: 1, recall: 1 },
    'template-furniture': { precision: 1, recall: 1 },
    title: { precision: 1, recall: 1 },
    'recurring-text': { precision: null, recall: null, maxPredicted: 5 },
    unknown: { precision: null, recall: null, maxPredicted: 2 },
  },
  // 1121 objects. decoration 72/79, 72/72; logo-candidate 43/43, 43/50; every
  // other class it holds is all hits.
  'template-example': {
    body: { precision: 1, recall: 1 },
    decoration: { precision: 0.91, recall: 1 },
    diagram: { precision: 1, recall: 1 },
    'logo-candidate': { precision: 1, recall: 0.86 },
    'page-number': { precision: 1, recall: 1 },
    subtitle: { precision: 1, recall: 1 },
    table: { precision: 1, recall: 1 },
    'template-furniture': { precision: 1, recall: 1 },
    title: { precision: 1, recall: 1 },
    unknown: { precision: 1, recall: 1 },
    'recurring-text': { precision: null, recall: null, maxPredicted: 0 },
  },
};

interface ClassCountsV1 {
  hit: Map<string, number>;
  predicted: Map<string, number>;
  wanted: Map<string, number>;
}

function holdFloors(counts: ClassCountsV1, floors: Record<string, ClassFloorV1>, where: string): void {
  for (const [klass, floor] of Object.entries(floors)) {
    const tp = counts.hit.get(klass) ?? 0;
    const p = counts.predicted.get(klass) ?? 0;
    const w = counts.wanted.get(klass) ?? 0;
    if (floor.precision !== null && p > 0) {
      assert.ok(tp / p >= floor.precision, `${where}: ${klass} precision ${(tp / p).toFixed(3)} is under the recorded ${floor.precision}`);
    }
    if (floor.recall !== null && w > 0) {
      assert.ok(tp / w >= floor.recall, `${where}: ${klass} recall ${(tp / w).toFixed(3)} is under the recorded ${floor.recall}`);
    }
    if (floor.maxPredicted !== undefined) {
      assert.ok(p <= floor.maxPredicted, `${where}: ${klass} is predicted ${p} times, past the recorded ${floor.maxPredicted}`);
    }
  }
}

test('per-class precision and recall on the labelled private decks hold their recorded floors', { skip: skipReason() ?? (privateLabels().length === 0 ? 'the private deck corpus has no labels directory' : false) }, async () => {
  const labelled = privateLabels();
  const pooled: ClassCountsV1 = { hit: new Map(), predicted: new Map(), wanted: new Map() };
  const bump = (into: Map<string, number>, klass: string): void => { into.set(klass, (into.get(klass) ?? 0) + 1); };
  let scored = 0;
  for (const { deck: file, labels } of labelled) {
    const bytes = new Uint8Array(readFileSync(file));
    const parts = await inflatePptx(bytes);
    const deck = await sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'private-labels',
      sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
      reader: { name: 'pptx-read', version: 'test' },
    });
    const census = censusDeck(deck);
    const want = new Map(allLabelledObjects(labels).map((label) => [label.id, label.class]));
    const unsure = new Set(labels.unsure ?? []);
    const own: ClassCountsV1 = { hit: new Map(), predicted: new Map(), wanted: new Map() };
    for (const row of census.objects) {
      const klass = want.get(row.id);
      assert.ok(klass, `${file}: ${row.id} has no label; relabel the deck when the reader changes`);
      if (unsure.has(row.id)) continue;
      scored += 1;
      for (const into of [own, pooled]) {
        bump(into.wanted, klass);
        bump(into.predicted, row.hypothesis.class);
        if (klass === row.hypothesis.class) bump(into.hit, klass);
      }
    }
    const name = path.basename(file).replace(/\.(pptx|pdf)$/i, '');
    const floors = PRIVATE_DECK_FLOORS[name];
    if (floors) holdFloors(own, floors, name);
  }
  assert.ok(scored > 0);
  holdFloors(pooled, PRIVATE_FLOORS, 'all labelled decks');
  assert.equal(pooled.predicted.get('photo') ?? 0, 0, 'no picture is called a photo while its text was never read');
});

// ─── a generator's mark on a picture deck (plan 275 WP10) ────────────────────

/** A slide rebuilt from its picture: the objects the rebuild made, the slide marked flattened. */
function rebuiltSlide(objects: SourceObjectV1[], index: number): SlideSourceV1 {
  return { ...slideOf(objects.map((o) => ({ ...o, origin: 'raster-region' as const, fidelity: { state: 'approximate' as const, reason: 'ocr-estimate' as const } })), index), origin: { kind: 'pptx', flattened: true } };
}

test('a short stamp at one corner of most picture slides is decoration, whatever it reads, and a logo on two slides is not', () => {
  const slides = Array.from({ length: 6 }, (_, i) => {
    // The reading differs from slide to slide, so no text group forms; the place is what repeats.
    const stamp = textBox(`s${i}.stamp`, i % 2 ? 'NotebookL M' : 'NotebookLM', 7, { x: 1180 + (i % 3), y: 692, w: 90, h: 16 });
    const icon = picture(`s${i}.icon`, 1164, 694, 12, 12, `media/icon${i}`);
    const title = textBox(`s${i}.title`, `Slide ${i + 1} is about something`, 36, { x: 64, y: 60, w: 900, h: 60 });
    const objects = [title, stamp, icon];
    if (i >= 4) objects.push(textBox(`s${i}.logo`, 'Lolly', 14, { x: 1180, y: 650, w: 80, h: 28 }));
    return rebuiltSlide(objects, 500 + i);
  });
  const census = censusDeck(deckOf(slides));
  for (let i = 0; i < 6; i++) {
    assert.equal(classOf(census, `s${i}.stamp`), 'decoration', `slide ${i + 1}: the stamp`);
    assert.equal(classOf(census, `s${i}.icon`), 'decoration', `slide ${i + 1}: the stamp's icon`);
    assert.notEqual(classOf(census, `s${i}.title`), 'decoration');
  }
  const stamp = census.objects.find((row) => row.id === 's0.stamp');
  assert.deepEqual(stamp?.hypothesis.evidence.map((e) => e.signal), ['repeat-share', 'margin-zone', 'area-share', 'origin']);
  assert.equal(stamp?.hypothesis.evidence[0]?.value, 1);
  // The logo stands on two slides of six, under the share, so it keeps its class.
  assert.notEqual(classOf(census, 's4.logo'), 'decoration');
  assert.ok(2 / 6 <= GENERATOR_MARK_SHARE);
});

test('the stamp rule reads only what a rebuild made, on picture slides, small and short', () => {
  // The same stamp placed by the slides themselves is a repeated line, judged by the text rules.
  const native = Array.from({ length: 4 }, (_, i) => slideOf([textBox(`n${i}.stamp`, 'Made with Gen', 7, { x: 1180, y: 692, w: 90, h: 16 })], 600 + i));
  const nativeCensus = censusDeck(deckOf(native));
  for (let i = 0; i < 4; i++) {
    const row = nativeCensus.objects.find((o) => o.id === `n${i}.stamp`);
    assert.ok(!row?.hypothesis.evidence.some((e) => e.signal === 'origin' && e.value === 'raster-region'));
  }
  // A long line in the corner of every picture slide is text, not a stamp.
  const long = Array.from({ length: 4 }, (_, i) => rebuiltSlide([textBox(`l${i}.note`, 'Figures are in euro millions and restated', 7, { x: 1100, y: 690, w: 170, h: 16 })], 700 + i));
  const longCensus = censusDeck(deckOf(long));
  for (let i = 0; i < 4; i++) assert.notEqual(classOf(longCensus, `l${i}.note`), 'decoration', `slide ${i + 1}`);
  // A large picture in the corner is not a stamp.
  const big = Array.from({ length: 4 }, (_, i) => rebuiltSlide([picture(`b${i}.photo`, 900, 400, 380, 320, `media/photo${i}`)], 800 + i));
  const bigCensus = censusDeck(deckOf(big));
  for (let i = 0; i < 4; i++) assert.notEqual(classOf(bigCensus, `b${i}.photo`), 'decoration');
});

test('the stamp rule leaves a corner logo to the logo rule, a page number to the number rules and a notice to a person', () => {
  const slides = Array.from({ length: 6 }, (_, i) => rebuiltSlide([
    textBox(`m${i}.title`, `Slide ${i + 1} is about something important`, 36, { x: 64, y: 60, w: 900, h: 60 }),
    // The same logo bytes in the bottom right corner of every slide.
    picture(`m${i}.logo`, 1150, 640, 96, 48, 'media/acme-logo'),
    // A page number bottom left, and a short notice top right.
    textBox(`m${i}.num`, String(i + 2), 10, { x: 40, y: 680, w: 14, h: 16 }),
    textBox(`m${i}.notice`, 'Confidential internal only', 8, { x: 1100, y: 20, w: 150, h: 14 }),
    // A stamp's icon, byte for byte the same on every slide, beside the stamp's name.
    picture(`m${i}.icon`, 1164, 694, 12, 12, 'media/stamp-icon'),
    textBox(`m${i}.stamp`, 'NotebookLM', 7, { x: 1180, y: 692, w: 90, h: 16 }),
  ], 900 + i));
  const census = censusDeck(deckOf(slides));
  for (let i = 0; i < 6; i++) {
    assert.equal(classOf(census, `m${i}.logo`), 'logo-candidate', `slide ${i + 1}: the old logo is replaced, not removed`);
    assert.notEqual(classOf(census, `m${i}.num`), 'decoration', `slide ${i + 1}: the page number`);
    assert.ok(['page-number', 'footer'].includes(classOf(census, `m${i}.num`) ?? ''), `slide ${i + 1}: ${classOf(census, `m${i}.num`)}`);
    assert.notEqual(classOf(census, `m${i}.notice`), 'decoration', `slide ${i + 1}: the notice is kept`);
    assert.equal(classOf(census, `m${i}.stamp`), 'decoration', `slide ${i + 1}: the stamp`);
    assert.equal(classOf(census, `m${i}.icon`), 'decoration', `slide ${i + 1}: the stamp's icon, beside its name`);
  }
});

test('on a picture slide, the text the rebuild estimated as the title is the title, top band or not', () => {
  const slides = Array.from({ length: 2 }, (_, i) => rebuiltSlide([
    // A title set over a photograph at mid height, and a body above it.
    textBox(`r${i}.body`, 'A line of body copy set above the title on this slide', 20, { x: 64, y: 60, w: 900, h: 40 }, { roleEstimate: 'body' }),
    textBox(`r${i}.title`, 'The title in the middle', 48, { x: 64, y: 320, w: 900, h: 80 }, { roleEstimate: 'title' }),
    textBox(`r${i}.small`, 'A smaller heading', 30, { x: 64, y: 500, w: 600, h: 50 }, { roleEstimate: 'title' }),
  ], 950 + i));
  const census = censusDeck(deckOf(slides));
  for (let i = 0; i < 2; i++) {
    assert.equal(classOf(census, `r${i}.title`), 'title');
    assert.notEqual(classOf(census, `r${i}.small`), 'title', 'only the largest estimated title');
    assert.notEqual(classOf(census, `r${i}.body`), 'title');
    const row = census.objects.find((o) => o.id === `r${i}.title`);
    assert.deepEqual(row?.hypothesis.evidence.map((e) => e.signal), ['text-size', 'origin', 'text-length']);
  }
});

test('the panel or box a rebuild found holding text is kept for a person, not proposed as ornament', () => {
  const slides = [rebuiltSlide([
    {
      id: 'c.o1', fingerprint: 'shape:o1', kind: 'shape', box: { x: 660, y: 220, w: 540, h: 420, rot: 0 },
      origin: 'slide', fidelity: { state: 'approximate' }, geom: 'rect', fill: { hex: '#ebeff1' }, line: { color: { hex: '#fbffff' }, widthPt: 1 }, groupPath: ['c.o1'],
    },
    textBox('c.t5', 'We did this easily.', 30, { x: 700, y: 260, w: 460, h: 120 }, { groupPath: ['c.o1'] }),
    // A rule the rebuild found, holding nothing.
    { id: 'c.r10', fingerprint: 'shape:r10', kind: 'shape', box: { x: 36, y: 195, w: 1200, h: 3, rot: 0 }, origin: 'slide', fidelity: { state: 'approximate' }, geom: 'rect', fill: { hex: '#848688' } },
  ], 990)];
  const census = censusDeck(deckOf(slides));
  assert.notEqual(classOf(census, 'c.o1'), 'decoration');
  assert.equal(classOf(census, 'c.o1'), 'unknown');
  assert.equal(classOf(census, 'c.r10'), 'decoration', 'a rule holding nothing is still ornament');
});

// ─── layout units and containers (plan 275 section 3.1) ──────────────────────

test('a column of single letters, each opening a row, is row numbering: kept as body, never ornament (MEDDPICC slide 3)', () => {
  const letters = 'MEDDPICC'.split('');
  const objects = letters.flatMap((letter, i) => [
    textBox(`l${i}`, letter, 48, { x: 241, y: 63 + i * 77, w: 69, h: 70 }),
    textBox(`r${i}`, `${letter}ETRIC - Measure the potential gain leading to the economic benefit`, 14, { x: 354, y: 63 + i * 77, w: 626, h: 70 }),
  ]);
  const census = censusDeck(deckOf([slideOf(objects, 2)]));
  for (let i = 0; i < letters.length; i += 1) {
    const row = census.objects.find((one) => one.id === `l${i}`);
    assert.equal(row?.hypothesis.class, 'body', `letter ${letters[i]} numbers its row`);
    assert.ok(row?.hypothesis.evidence.some((item) => item.signal === 'column-alignment'));
  }
  // The lone badge beside a heading is still one letter, not a column of them.
  const badge = censusDeck(deckOf([slideOf([
    textBox('letter', 'M', 48, { x: 67, y: 67, w: 68, h: 70 }),
    textBox('heading', 'METRICS - Measure the potential gain leading to the economic benefit', 14, { x: 180, y: 67, w: 626, h: 70 }),
  ], 0)]));
  assert.equal(classOf(badge, 'letter'), 'decoration');
});

test('the layout units are the kept content in slide fractions, clipped, with furniture and ornament left out', () => {
  const objects: SourceObjectV1[] = [
    textBox('title', 'A slide with three columns', 32, { x: 64, y: 36, w: 1152, h: 72 }, { placeholder: 'title' }),
    textBox('a', 'The first column of body text', 18, { x: 64, y: 200, w: 340, h: 300 }),
    { ...picture('photo', -128, 200, 400, 300, 'user/media/aa'), kind: 'pic' },
    textBox('num', '7', 10, { x: 1200, y: 690, w: 20, h: 16 }, { placeholder: 'sldNum' }),
  ];
  const census = censusDeck(deckOf([slideOf(objects, 1)]));
  const units = census.layouts[0]?.units ?? [];
  assert.deepEqual(units.map((unit) => unit.id).sort(), ['a', 'photo', 'title']);
  const photo = units.find((unit) => unit.id === 'photo');
  assert.equal(photo?.box.x, 0, 'a picture off the left edge counts by what shows');
  assert.equal(photo?.box.w, 0.2125, 'its right edge at 272 of 1280 px');
  assert.equal(units.find((unit) => unit.id === 'a')?.words, 6);
  assert.equal(units.find((unit) => unit.id === 'title')?.maxPt, 32);
});

test('a card panel the plan removes as ornament is still a container, holding the text inside it', () => {
  const panel = (id: string, x: number): SourceObjectV1 => ({
    id, fingerprint: `shape:${id}`, kind: 'shape', geom: 'rect', box: { x, y: 190, w: 270, h: 400, rot: 0 },
    origin: 'slide', fidelity: { state: 'editable' }, fill: { hex: '#E6F2EE' },
  });
  // The same panel at the same place on three slides reads as ornament.
  const slides = [0, 1, 2].map((index) => slideOf([
    panel(`p${index}`, 64),
    textBox(`t${index}`, 'Import: drop in a deck and every slide is read', 20, { x: 84, y: 210, w: 230, h: 350 }),
  ], index));
  const census = censusDeck(deckOf(slides));
  assert.equal(classOf(census, 'p0'), 'decoration');
  const layout = census.layouts[0];
  assert.deepEqual(layout?.units?.map((unit) => unit.id), ['t0'], 'ornament is never content');
  assert.deepEqual(layout?.containers?.map((c) => [c.id, c.kind, c.members]), [['p0', 'card', ['t0']]]);
});

test('on a slide rebuilt from a picture, the panels, cards and rows the rebuild named are the containers', () => {
  const rebuilt = (object: SourceObjectV1, group: string[]): SourceObjectV1 => ({ ...object, origin: 'raster-region', groupPath: group });
  const objects: SourceObjectV1[] = [0, 1, 2].flatMap((i) => [
    rebuilt(textBox(`label${i}`, `Card ${i} label`, 18, { x: 80 + i * 400, y: 300, w: 300, h: 40 }), [`s.card${i + 1}`]),
    rebuilt(textBox(`body${i}`, 'The words under the label of this card', 12, { x: 80 + i * 400, y: 350, w: 300, h: 120 }), [`s.card${i + 1}`]),
  ]);
  const census = censusDeck(deckOf([slideOf(objects, 3)]));
  const containers = census.layouts[0]?.containers ?? [];
  assert.deepEqual(containers.map((c) => [c.id, c.members]), [
    ['s.card1', ['label0', 'body0']],
    ['s.card2', ['label1', 'body1']],
    ['s.card3', ['label2', 'body2']],
  ]);
});

test('the structures fixture census names its cards and keeps the numbering letters', async () => {
  const { runRebrandPipeline } = await import('./helpers/rebrand-pipeline.ts');
  const run = await runRebrandPipeline('structures.pptx', new Uint8Array(readFileSync(path.join(path.dirname(fixturePath('simple.pptx')), 'structures.pptx'))));
  const slide2 = run.census.layouts.find((row) => row.slideId === 'ppt/slides/slide2.xml');
  assert.equal(slide2?.containers?.length, 4, 'four card panels hold their text');
  const letters = run.census.objects.filter((row) => row.slideId === 'ppt/slides/slide8.xml' && row.hypothesis.evidence.some((item) => item.signal === 'column-alignment'));
  assert.equal(letters.length, 4);
  assert.ok(letters.every((row) => row.hypothesis.class === 'body'));
});

// ─── plan 275 decision 32: a drawing carried as items ─────────────────────────

/** tests/fixtures/rebrand/vector.pptx read and censused: an SVG chart, freeform lockup parts, a metafile. */
async function vectorCensus(): Promise<Read> {
  const bytes = new Uint8Array(readFileSync(path.join(path.dirname(fixturePath('simple.pptx')), 'vector.pptx')));
  const parts = await inflatePptx(bytes);
  const deck = await sourceDeckFromPptx(parts, parseXml, {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    instanceId: 'census-test',
    name: 'vector.pptx',
    bytes: bytes.byteLength,
    sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
    reader: { name: 'pptx-read', version: 'test' },
  });
  return { deck, census: censusDeck(deck) };
}

test('plan 275: an SVG chart carried as items classes as a chart, never as decoration', async () => {
  const { deck, census } = await vectorCensus();
  const drawn = objectsOf(deck).filter((object) => object.kind === 'vector' && (object.vectorItems?.items.length ?? 0) > 0);
  const charts = drawn.filter((object) => object.vectorItems?.title === 'bar chart');
  assert.equal(charts.length, 2, 'the fixture carries the chart on two slides');
  for (const chart of charts) {
    const entry = census.objects.find((one) => one.id === chart.id);
    assert.equal(entry?.hypothesis.class, 'chart', `${chart.id} reads as a chart`);
  }
  // The master's mark, drawn as items too, stays a mark.
  for (const mark of drawn.filter((object) => object.origin === 'master')) {
    assert.equal(census.objects.find((one) => one.id === mark.id)?.hypothesis.class, 'logo-candidate');
  }
  assert.equal(drawn.some((object) => census.objects.find((one) => one.id === object.id)?.hypothesis.class === 'decoration'), false, 'no drawing reads as decoration');
});

test('plan 275: a drawing carried as items states its colours part by part, its series as one distinction set', async () => {
  const { deck, census } = await vectorCensus();
  const chart = objectsOf(deck).find((object) => object.kind === 'vector' && object.vectorItems?.title === 'bar chart');
  assert.ok(chart, 'the bar chart');
  const uses = census.colors.uses.filter((use) => use.objectIds.includes(chart.id));
  const series = uses.filter((use) => use.role === 'series');
  assert.ok(series.length >= 2, 'its bars are series uses');
  assert.ok(series.every((use) => use.distinctionSet === chart.id), 'kept apart as one set');
  assert.equal(new Set(series.map((use) => use.hex)).size, series.length, 'one use per series colour');
  assert.ok(uses.some((use) => use.role !== 'series'), 'its other parts are measured too');
  // Two reads agree: the uses are sorted and weighted the same way every time.
  assert.deepEqual(censusDeck(deck).colors.uses, census.colors.uses);
});

// ─── close-out CP13: one mark is one group, and a slide number is a page number ───

test('CP13 F5: a mark drawn as two pictures at one place, or as a symbol beside its wordmark, is one group', () => {
  const at = (id: string, media: string, x: number, w: number): SourceObjectV1 => ({ ...picture(id, x, 650, w, 40, media), origin: 'slide' });
  // Two colours of one mark drawn over each other, on three slides, and on the first a
  // third part the family did not verify (a drawing part at the same place).
  const part: SourceObjectV1 = {
    id: 'extra', fingerprint: 'shape:extra', kind: 'shape', box: { x: 40, y: 650, w: 160, h: 40, rot: 0 },
    origin: 'slide', fidelity: { state: 'editable' }, fill: { hex: '#0C322C' },
  };
  const layered = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([at(`g${i}`, 'user/media/green', 40, 160), at(`p${i}`, 'user/media/pine', 40, 160), ...(i === 0 ? [part] : [])], i))));
  const marks = layered.groups.filter((group) => group.class === 'logo-candidate');
  assert.equal(marks.length, 1, `one group: ${JSON.stringify(layered.groups.map((g) => [g.class, g.members]))}`);
  assert.deepEqual(marks[0]?.members, ['extra', 'g0', 'g1', 'g2', 'p0', 'p1', 'p2']);
  assert.equal(marks[0]?.slideIds.length, 3);
  for (const id of ['g1', 'p1', 'extra']) {
    const row = layered.objects.find((one) => one.id === id);
    assert.equal(row?.groupId, marks[0]?.id, `${id} is a member of the group`);
    assert.equal(row?.hypothesis.class, 'logo-candidate');
  }

  // A symbol beside its wordmark, level and a gap narrower than their height apart.
  const lockup = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([at(`s${i}`, 'user/media/symbol', 40, 40), at(`w${i}`, 'user/media/word', 90, 120)], i))));
  assert.equal(lockup.groups.filter((group) => group.class === 'logo-candidate').length, 1);

  // The template's own copy of the mark, where the slides cover it, and the mark the
  // slides draw again elsewhere: one shape, one inherited and one drawn, one group.
  const copy = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([{ ...picture(`m${i}`, 70, 40, 320, 80, 'user/media/master-mark'), origin: 'master' }, at(`d${i}`, 'user/media/drawn-mark', 900, 160)], i))));
  const copies = copy.groups.filter((group) => group.class === 'logo-candidate');
  assert.equal(copies.length, 1, `the copy joins: ${JSON.stringify(copy.groups.map((g) => [g.class, g.members]))}`);
  assert.ok(copies[0]?.exemplar.startsWith('d'), 'the picture a person sees is the mark the slides draw');

  // Two marks at two corners stay two groups.
  const apart = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([at(`l${i}`, 'user/media/left', 40, 120), at(`r${i}`, 'user/media/right', 1100, 120)], i))));
  assert.equal(apart.groups.filter((group) => group.class === 'logo-candidate').length, 2);
});

test('CP13 F2: a line of digits that changes from slide to slide in the bottom margin is a page number, not a footer', () => {
  const numbered = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([textBox(`n${i}`, String(i + 1), 15, { x: 540, y: 676, w: 77, h: 20 })], i))));
  for (const id of ['n0', 'n1', 'n2']) assert.equal(classOf(numbered, id), 'page-number', id);
  // A footer line with a year in it stays a footer.
  const footer = censusDeck(deckOf([0, 1, 2].map((i) => slideOf([textBox(`f${i}`, `Copyright 202${i} Example Corp`, 10, { x: 40, y: 690, w: 300, h: 16 })], i))));
  assert.notEqual(classOf(footer, 'f0'), 'page-number');
});
