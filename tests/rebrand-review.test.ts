// SPDX-License-Identifier: MPL-2.0
/**
 * The review model (plan 274 section 4, `engine/src/rebrand-review.ts`): the
 * queue, the per-object and per-slide states, the footer counts and the
 * suggestion list, over the committed fixtures and a small hand-built deck.
 *
 * The hand-built deck is the MEDDPICC pattern in miniature: one mark repeated on
 * five slides as a verified group, one member locked and one a person already
 * kept, page numbers that carry no group, a chart that could not be drawn on
 * two slides, a photo, and body text.
 *
 * Run with: node --test "tests/rebrand-review.test.ts"
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  REVIEW_MESSAGES,
  REVIEW_NOUNS,
  evidenceMessage,
  nounFor,
  objectStates,
  reviewMessage,
  openPendingIds,
  pendingSuggestionIds,
  planSummary,
  reviewQueue,
  slideStates,
  type QueueItemV1,
} from '../engine/src/rebrand-review.ts';
import { acceptSuggestions, decideObjects, moveSlide, setSlidesIncluded } from '../engine/src/rebrand-edit.ts';
import type {
  DeckCensusV1,
  FidelityStateV1,
  ObjectClassV1,
  ObjectPlanV1,
  PlanActionV1,
  RenovationPlanV1,
  ReviewStateV1,
  SourceDeckV1,
  SourceObjectKindV1,
  SourceObjectV1,
  SourceOriginV1,
} from '../packages/core/src/index.ts';
import { privateCorpus, readFixture, skipReason } from './helpers/rebrand-fixtures.ts';
import { runRebrandPipeline } from './helpers/rebrand-pipeline.ts';

// ─── a hand-built deck ───────────────────────────────────────────────────────

interface Spec {
  id: string;
  kind: SourceObjectKindV1;
  klass: ObjectClassV1;
  proposal: PlanActionV1;
  review: ReviewStateV1;
  fidelity?: FidelityStateV1;
  origin?: SourceOriginV1;
  text?: string;
  sizePt?: number;
  decision?: PlanActionV1;
  author?: ObjectPlanV1['author'];
  locked?: boolean;
  evidence?: ObjectPlanV1['evidence'];
}

function sourceObject(spec: Spec): SourceObjectV1 {
  const object: SourceObjectV1 = {
    id: spec.id,
    fingerprint: `fp:${spec.id.split('.').pop()}`,
    kind: spec.kind,
    box: { x: 10, y: 10, w: 100, h: 40, rot: 0 },
    origin: spec.origin ?? 'slide',
    fidelity: { state: spec.fidelity ?? 'editable' },
  };
  if (spec.text !== undefined) object.text = { paras: [{ runs: [{ text: spec.text, sizePt: spec.sizePt ?? 18 }] }] };
  return object;
}

function planRow(spec: Spec): ObjectPlanV1 {
  const row: ObjectPlanV1 = {
    id: spec.id,
    class: spec.klass,
    evidence: spec.evidence ?? [],
    proposal: spec.proposal,
    review: spec.review,
  };
  if (spec.decision !== undefined) row.decision = spec.decision;
  if (spec.author !== undefined) row.author = spec.author;
  if (spec.locked) row.locked = true;
  return row;
}

/** Five slides. Returns the source, the census and the plan the review model reads. */
function handDeck(): { source: SourceDeckV1; census: DeckCensusV1; plan: RenovationPlanV1 } {
  const slides: Spec[][] = [];
  const markEvidence = [{ signal: 'repeat-count' as const, value: 5, weight: 0.3, sentence: 'The same picture is on 5 slides.' }];
  for (let n = 1; n <= 5; n += 1) {
    const s = `s${n}`;
    const specs: Spec[] = [
      {
        id: `${s}.mark`, kind: 'pic', klass: 'logo-candidate', proposal: 'replace', review: 'needs-attention',
        fidelity: 'raster-preserved', evidence: markEvidence,
        ...(n === 2 ? { locked: true } : {}),
        ...(n === 3 ? { decision: 'keep' as const, author: 'user' as const, review: 'accepted' as const } : {}),
      },
      {
        id: `${s}.num`, kind: 'text', klass: 'page-number', proposal: 'remove', review: 'accepted', text: String(n), sizePt: 9,
        evidence: [{ signal: 'placeholder', value: 'sldNum', weight: 0.9 }],
      },
      { id: `${s}.title`, kind: 'text', klass: 'title', proposal: 'keep', review: 'accepted', text: `Slide ${n} heading`, sizePt: 36 },
    ];
    if (n === 2 || n === 4) {
      specs.push({ id: `${s}.chart`, kind: 'chart', klass: 'chart', proposal: 'keep', review: 'needs-attention', fidelity: 'unavailable' });
    }
    if (n === 4) specs.push({ id: `${s}.photo`, kind: 'pic', klass: 'photo', proposal: 'keep', review: 'needs-attention', fidelity: 'raster-preserved' });
    if (n === 5) specs.push({ id: `${s}.logo`, kind: 'pic', klass: 'known-logo', proposal: 'replace', review: 'unreviewed', fidelity: 'raster-preserved' });
    slides.push(specs);
  }

  const source: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash: 'sha256:hand', lineageId: 'hand', instanceId: 'hand', pageCount: 5 },
    slides: slides.map((specs, i) => ({
      id: `s${i + 1}`,
      index: i,
      width: 1280,
      height: 720,
      background: {},
      objects: specs.map(sourceObject),
      readingOrder: specs.map((spec) => spec.id),
      warnings: [],
      origin: { kind: 'pptx', layout: i % 2 === 0 ? 'layoutA' : 'layoutB' },
    })),
    fonts: [],
    warnings: [],
    reader: { name: 'hand', version: '1' },
  };

  const census: DeckCensusV1 = {
    version: 1,
    sourceHash: 'sha256:hand',
    rules: { name: 'hand', version: '1' },
    objects: slides.flatMap((specs, i) => specs.map((spec) => {
      const row: DeckCensusV1['objects'][number] = {
        id: spec.id,
        slideId: `s${i + 1}`,
        origin: spec.origin ?? 'slide',
        hypothesis: { class: spec.klass, confidence: 0.9, evidence: spec.evidence ?? [] },
      };
      if (spec.klass === 'logo-candidate') row.groupId = 'group:mark';
      return row;
    })),
    groups: [{
      id: 'group:mark',
      kind: 'media',
      members: ['s1.mark', 's2.mark', 's3.mark', 's4.mark', 's5.mark'],
      unverified: ['s5.logo'],
      slideIds: ['s1', 's2', 's3', 's4', 's5'],
      exemplar: 's1.mark',
      class: 'logo-candidate',
    }],
    colors: { uses: [], contrastPairs: [] },
    fonts: [],
    layouts: [],
    flattenedSlideIds: [],
    warnings: [],
  };

  const plan: RenovationPlanV1 = {
    version: 1,
    source: { lineageId: 'hand', hash: 'sha256:hand', instanceId: 'hand' },
    revision: 1,
    designSystem: { id: 'test', tokenHash: 'sha256:0', fontHashes: {}, assetHashes: {} },
    algorithms: { reader: 'hand', census: 'hand', plan: 'hand' },
    mode: 'renovate',
    slides: slides.map((specs, i) => ({
      id: `s${i + 1}`,
      include: true,
      layout: 'content',
      layoutSource: 'proposed',
      objects: specs.map(planRow),
    })),
    colors: [
      { useId: 'u1', from: '#112233', role: 'ink', to: '#1d1d1d', affects: [] },
      { useId: 'u2', from: '#445566', role: 'accent', unresolved: 'palette-too-small', affects: [] },
      { useId: 'u3', from: '#ffffff', role: 'bg', to: '#ffffff', locked: true, affects: [] },
    ],
    fonts: [
      { from: 'Calibri', to: 'Inter', source: 'alias' },
      { from: 'Inter', to: 'inter', source: 'class' },
    ],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [],
  };
  return { source, census, plan };
}

function itemOf(queue: QueueItemV1[], predicate: (item: QueueItemV1) => boolean): QueueItemV1 {
  const found = queue.find(predicate);
  assert.ok(found, 'the queue holds the expected item');
  return found;
}

// ─── the queue ───────────────────────────────────────────────────────────────

test('a verified group collapses the repeated mark into one item with its slide numbers', () => {
  const { source, census, plan } = handDeck();
  const queue = reviewQueue(plan, census, source);
  const mark = itemOf(queue, (item) => item.groupId === 'group:mark');
  assert.equal(mark.id, 'group:mark');
  assert.deepEqual(mark.objectIds, ['s1.mark', 's2.mark', 's3.mark', 's4.mark', 's5.mark']);
  assert.deepEqual(mark.slideNumbers, [1, 2, 3, 4, 5]);
  assert.equal(mark.action, 'replace');
  assert.equal(mark.review, 'needs-attention');
  assert.equal(mark.section, 'attention');
  assert.equal(mark.fidelity, 'picture');
  assert.deepEqual(mark.lockedIds, ['s2.mark']);
  assert.deepEqual(mark.correctedIds, ['s3.mark']);
  assert.deepEqual(mark.mixedIds, []);
  assert.equal(mark.title.text, 'Replace the same mark on 5 slides');
  assert.equal(mark.title.code, 'title.same.replace');
  assert.equal(mark.title.params.nounCode, 'noun.logo-candidate.one');
  // The review reads the row's signal and value, not the sentence a census stored.
  assert.equal(mark.evidence.text, 'Identical picture on each.');
  assert.equal(mark.evidence.code, 'evidence.repeat.picture');
  assert.deepEqual(mark.evidence.params, { count: 5 });
  assert.equal(mark.exemplar, 's1.mark');
  // The unverified candidate is its own item, never part of the group.
  assert.ok(!mark.objectIds.includes('s5.logo'));
  const logo = itemOf(queue, (item) => item.objectIds.includes('s5.logo'));
  assert.equal(logo.id, 'obj:s5.logo');
  assert.equal(logo.section, 'suggestions');
});

test('ungrouped page numbers across slides are one item per class and action', () => {
  const { source, census, plan } = handDeck();
  const queue = reviewQueue(plan, census, source);
  const numbers = itemOf(queue, (item) => item.class === 'page-number');
  assert.equal(numbers.objectIds.length, 5);
  assert.equal(numbers.action, 'remove');
  assert.equal(numbers.section, 'settled');
  assert.equal(numbers.title.text, 'Remove page numbers on 5 slides');
  assert.equal(numbers.evidence.text, 'In the page number slot of the layout.');
  assert.equal(numbers.evidence.code, 'evidence.placeholder.page-number');
  assert.match(numbers.id, /^rep:page-number:remove:/);
});

test('charts that could not be drawn and a single photo read as the plan voice says', () => {
  const { source, census, plan } = handDeck();
  const queue = reviewQueue(plan, census, source);
  const charts = queue.filter((item) => item.class === 'chart');
  assert.equal(charts.length, 1, 'two charts on two slides are one card: one card per class and kind per deck (F11)');
  assert.equal(charts[0]?.title.text, '2 charts could not be drawn');
  assert.deepEqual(charts[0]?.slideNumbers, [2, 4]);
  assert.equal(charts[0]?.fidelity, 'unavailable');
  const photo = itemOf(queue, (item) => item.class === 'photo');
  assert.equal(photo.title.text, 'Photo on slide 4');
  assert.equal(photo.evidence.text, 'On the slide itself.');
  assert.equal(photo.evidence.code, 'evidence.origin.slide');
  assert.equal(photo.evidenceAddsFact, false, 'where the object sits is no fact when it sits on the slide');
});

test('the queue orders by section, then first slide, then class order, then id', () => {
  const { source, census, plan } = handDeck();
  const queue = reviewQueue(plan, census, source);
  const sections = queue.map((item) => item.section);
  const firstSettled = sections.indexOf('settled');
  const lastAttention = sections.lastIndexOf('attention');
  const firstSuggestion = sections.indexOf('suggestions');
  assert.ok(lastAttention < firstSuggestion && firstSuggestion < firstSettled);
  assert.deepEqual(queue.filter((item) => item.section === 'attention').map((item) => item.id), [
    'group:mark',
    'kind:chart:keep:chart',
    'obj:s4.photo',
  ]);
});

test('every object appears in exactly one item', () => {
  const { source, census, plan } = handDeck();
  const queue = reviewQueue(plan, census, source);
  const seen = queue.flatMap((item) => item.objectIds).sort();
  const all = plan.slides.flatMap((slide) => slide.objects.map((row) => row.id)).sort();
  assert.deepEqual(seen, all);
});

test('the queue is the same whatever order the census lists its groups in', () => {
  const { source, census, plan } = handDeck();
  const extra = { ...census, groups: [...census.groups, { ...census.groups[0]!, id: 'group:empty', members: ['nope'], exemplar: 'nope' }] };
  const reversed = { ...extra, groups: [...extra.groups].reverse() };
  assert.deepEqual(reviewQueue(plan, extra, source), reviewQueue(plan, reversed, source));
});

test('every title and evidence code is in the message table', () => {
  const { source, census, plan } = handDeck();
  for (const item of reviewQueue(plan, census, source)) {
    for (const message of [item.title, item.evidence]) {
      assert.ok(message.code in REVIEW_MESSAGES, message.code);
      assert.ok(message.text.length > 0 && !message.text.includes('{'), message.text);
    }
  }
});

test('over the committed fixtures, grouped titles carry their numbers', async () => {
  for (const name of ['simple.pptx', 'adversarial.pptx'] as const) {
    const run = await runRebrandPipeline(name, readFixture(name));
    const queue = reviewQueue(run.plan, run.census, run.deck);
    assert.ok(queue.length > 0);
    const seen = queue.flatMap((item) => item.objectIds).sort();
    assert.deepEqual(seen, run.plan.slides.flatMap((slide) => slide.objects.map((row) => row.id)).sort(), name);
    const mark = itemOf(queue, (item) => item.class === 'logo-candidate');
    assert.equal(mark.title.text, `Replace the same mark on ${mark.slideNumbers.length} slides`);
    assert.ok(mark.slideNumbers.length > 1);
    for (const item of queue) {
      if (item.objectIds.length > 1) assert.match(item.title.text, /\d/, `${name}: "${item.title.text}" names its count`);
    }
  }
});

// ─── object and slide states ─────────────────────────────────────────────────

test('objectStates keeps the three states apart, and a held raster reads as a picture', () => {
  const { source, plan } = handDeck();
  const states = objectStates(plan, source);
  assert.equal(states.size, plan.slides.reduce((sum, slide) => sum + slide.objects.length, 0));
  assert.deepEqual(states.get('s3.mark'), {
    id: 's3.mark', slideId: 's3', action: 'keep', review: 'accepted', fidelity: 'picture', author: 'user', locked: false, class: 'logo-candidate',
  });
  assert.equal(states.get('s2.mark')?.locked, true);
  assert.equal(states.get('s2.chart')?.fidelity, 'unavailable');
  assert.equal(states.get('s1.title')?.fidelity, 'editable');
});

test('slideStates counts per slide and follows the effective deck order', () => {
  const { source, census, plan } = handDeck();
  const states = slideStates(plan, source, census);
  assert.deepEqual(states.map((state) => state.id), ['s1', 's2', 's3', 's4', 's5']);
  const s4 = states[3]!;
  assert.equal(s4.number, 4);
  assert.equal(s4.attention, 3);
  assert.equal(s4.removed, 1);
  assert.equal(s4.unresolved, 1);
  assert.equal(s4.fidelity, 'unavailable');
  assert.equal(s4.title, 'Slide 4 heading');
  assert.equal(s4.sourceLayout, 'layoutB');
  assert.equal(states[0]?.fidelity, 'picture');

  const moved = moveSlide(plan, 's4', -3).plan;
  const excluded = setSlidesIncluded(moved, ['s2'], false).plan;
  const reordered = slideStates(excluded, source, census);
  assert.deepEqual(reordered.map((state) => state.id), ['s4', 's1', 's3', 's5', 's2']);
  assert.deepEqual(reordered.map((state) => state.order), [0, 1, 2, 3, 4]);
  assert.deepEqual(reordered.map((state) => state.number), [4, 1, 3, 5, 2]);
  assert.equal(reordered[4]?.include, false);
});

test('a slide title is cut to 80 characters and falls back to the largest text', () => {
  const { source, census, plan } = handDeck();
  const slide = source.slides[0]!;
  const long = 'A'.repeat(50) + ' ' + 'B'.repeat(50);
  slide.objects = slide.objects.map((object) => (object.id === 's1.title'
    ? { ...object, text: { paras: [{ runs: [{ text: long, sizePt: 36 }] }] } }
    : object));
  const first = slideStates(plan, source, census)[0]!;
  assert.equal(first.title?.length, 80);
  const rows = plan.slides[0]!.objects.map((row) => (row.id === 's1.title' ? { ...row, class: 'body' as const } : row));
  const noTitle = { ...plan, slides: [{ ...plan.slides[0]!, objects: rows }, ...plan.slides.slice(1)] };
  assert.equal(slideStates(noTitle, source, census)[0]?.title?.startsWith('AAAA'), true, 'the largest text stands in');
});

// ─── the footer ──────────────────────────────────────────────────────────────

test('planSummary equals a hand count', () => {
  const { source, census, plan } = handDeck();
  const summary = planSummary(plan, source, census);
  // Five slides of mark, page number and title, two charts, one photo, one logo: 18 rows.
  // Effective actions: marks replace x4 plus the kept one, known logo replace, page numbers remove.
  assert.deepEqual(summary, {
    slides: { total: 5, included: 5 },
    objects: { keep: 1 + 5 + 2 + 1, replace: 4 + 1, remove: 5, unresolved: 2, unplaced: 0 },
    review: { attention: 4 + 2 + 1, unreviewed: 1, accepted: 1 + 5 + 5 },
    colours: { assigned: 2, unresolved: 1, locked: 1 },
    fonts: { substituted: 1 },
    flattened: 0,
  });
  const fewer = planSummary(setSlidesIncluded(plan, ['s4'], false).plan, source, census);
  assert.deepEqual(fewer.slides, { total: 5, included: 4 });
  assert.equal(fewer.objects.unresolved, 1, 'an excluded slide leaves its objects out of the object counts');
  assert.deepEqual(fewer.review, summary.review, 'review counts follow the queue, which lists every row');

  // A kept plain shape has no slot on any layout, so the compile holds it in the
  // tray, and the footer counts it before a compile so the view can show the number.
  const shape: SourceObjectV1 = {
    id: 's1.box', fingerprint: 'fp:s1.box', kind: 'shape', box: { x: 0, y: 0, w: 200, h: 100, rot: 0 },
    origin: 'slide', fidelity: { state: 'editable' }, fill: { hex: '#d65a28' },
  };
  const withShape = {
    ...plan,
    slides: plan.slides.map((slide, i) => (i === 0
      ? { ...slide, objects: [...slide.objects, { id: 's1.box', class: 'unknown' as const, evidence: [], proposal: 'keep' as const, review: 'needs-attention' as const }] }
      : slide)),
  };
  const shapedSource = { ...source, slides: source.slides.map((slide, i) => (i === 0 ? { ...slide, objects: [...slide.objects, shape] } : slide)) };
  assert.equal(planSummary(withShape, shapedSource, census).objects.unplaced, 1);
});

test('nounFor names an object in words from its class and kind', () => {
  assert.equal(nounFor('recurring-text', 'text'), 'repeated line');
  assert.equal(nounFor('page-number', 'text'), 'page number');
  assert.equal(nounFor('unknown', 'pic'), 'picture');
  assert.equal(nounFor('unknown', 'shape'), 'object');
  assert.equal(nounFor('decoration', 'shape'), 'shape');
  assert.equal(nounFor('body'), 'text block');
});

test('pendingSuggestionIds lists unreviewed, undecided, unlocked rows in plan order', () => {
  const { plan } = handDeck();
  assert.deepEqual(pendingSuggestionIds(plan), ['s5.logo']);
  const rows = plan.slides[0]!.objects.map((row) => (row.id === 's1.title' ? { ...row, review: 'unreviewed' as const, locked: true } : row));
  const locked = { ...plan, slides: [{ ...plan.slides[0]!, objects: rows }, ...plan.slides.slice(1)] };
  assert.deepEqual(pendingSuggestionIds(locked), ['s5.logo']);
});

test('openPendingIds names every row still waiting on an included slide, flagged ones too, and no locked row', () => {
  const { plan } = handDeck();
  const waiting = (row: ObjectPlanV1): boolean =>
    row.decision === undefined && row.locked !== true && (row.review === 'unreviewed' || row.review === 'needs-attention');
  const expected = plan.slides.filter((slide) => slide.include).flatMap((slide) => slide.objects.filter(waiting).map((row) => row.id));
  assert.ok(expected.length > 1, 'the hand deck has rows waiting');
  assert.deepEqual(openPendingIds(plan), expected, 'in plan order');
  assert.ok(openPendingIds(plan).includes('s5.logo'), 'an unreviewed row waits');
  assert.ok(openPendingIds(plan).length > pendingSuggestionIds(plan).length, 'a flagged row waits too');

  const first = plan.slides[0]!;
  const left = setSlidesIncluded(plan, [first.id], false).plan;
  for (const row of first.objects) assert.ok(!openPendingIds(left).includes(row.id), `${row.id} is on a slide left out`);

  const target = expected[0]!;
  const locked = withRows(plan, (row) => (row.id === target ? { ...row, locked: true } : row));
  assert.ok(!openPendingIds(locked).includes(target), 'a locked row is a person hold, not a wait');
  const decided = decideObjects(plan, { objectIds: [target], action: 'keep', author: 'user' }).plan;
  assert.ok(!openPendingIds(decided).includes(target), 'a decided row waits for nothing');
});

// ─── review findings pinned ──────────────────────────────────────────────────

function withRows(plan: RenovationPlanV1, fn: (row: ObjectPlanV1) => ObjectPlanV1): RenovationPlanV1 {
  return { ...plan, slides: plan.slides.map((slide) => ({ ...slide, objects: slide.objects.map(fn) })) };
}

test('correctedIds is exactly what a group apply of the item skips as corrected', () => {
  const { source, census, plan } = handDeck();
  // s4 was decided by a person as Replace with an asset of their own.
  const chosen = withRows(plan, (row) => (row.id === 's4.mark'
    ? { ...row, decision: 'replace', decisionReplacement: { kind: 'asset', id: 'mine' }, author: 'user', review: 'accepted' }
    : row));
  const mark = itemOf(reviewQueue(chosen, census, source), (item) => item.groupId === 'group:mark');
  const applied = decideObjects(chosen, {
    objectIds: mark.objectIds,
    action: mark.action,
    ...(mark.replacement ? { replacement: mark.replacement } : {}),
    scope: mark.id,
  });
  const skippedAsCorrected = applied.skipped.filter((one) => one.reason === 'corrected').map((one) => one.id);
  assert.deepEqual(mark.correctedIds, skippedAsCorrected);
  assert.deepEqual(mark.correctedIds, ['s3.mark', 's4.mark']);
});

test('a group title says could not be drawn only when every member could not be', () => {
  const { source, census, plan } = handDeck();
  const oneMissing = structuredClone(source);
  for (const slide of oneMissing.slides) {
    for (const object of slide.objects) if (object.id === 's1.mark') object.fidelity = { state: 'unavailable' };
  }
  const mark = itemOf(reviewQueue(plan, census, oneMissing), (item) => item.groupId === 'group:mark');
  assert.equal(mark.fidelity, 'unavailable', 'the badge still carries the weakest member');
  assert.equal(mark.title.text, 'Replace the same mark on 5 slides');

  const allMissing = structuredClone(source);
  for (const slide of allMissing.slides) {
    for (const object of slide.objects) if (object.id.endsWith('.mark')) object.fidelity = { state: 'unavailable' };
  }
  const gone = itemOf(reviewQueue(plan, census, allMissing), (item) => item.groupId === 'group:mark');
  assert.equal(gone.title.text, '5 marks could not be drawn');
  assert.equal(gone.title.params.nounCode, 'noun.logo-candidate.many');
});

test('members whose action differs without a correction are named in mixedIds', () => {
  const { source, census, plan } = handDeck();
  const mixed = withRows(plan, (row) => (row.id === 's5.mark' ? { ...row, proposal: 'keep' } : row));
  const mark = itemOf(reviewQueue(mixed, census, source), (item) => item.groupId === 'group:mark');
  assert.equal(mark.action, 'replace');
  assert.deepEqual(mark.mixedIds, ['s5.mark']);
  assert.deepEqual(mark.correctedIds, ['s3.mark']);
});

test('a repeat item keeps its id after it is applied', () => {
  const { source, census, plan } = handDeck();
  const before = itemOf(reviewQueue(plan, census, source), (item) => item.class === 'page-number');
  const applied = decideObjects(plan, { objectIds: before.objectIds, action: 'keep', scope: before.id }).plan;
  const after = itemOf(reviewQueue(applied, census, source), (item) => item.class === 'page-number');
  assert.equal(after.id, before.id);
  assert.equal(after.action, 'keep');
  assert.deepEqual(after.objectIds, before.objectIds);
});

test('every noun has a plural that differs from its singular', () => {
  for (const [key, noun] of Object.entries(REVIEW_NOUNS)) {
    const one = reviewMessage('title.one', { noun: noun.one, slide: 4 }).text;
    const several = reviewMessage('title.several.keep', { nouns: noun.many, count: 3, slide: 4 }).text;
    assert.notEqual(noun.one, noun.many, key);
    assert.ok(several.includes(noun.many) && !one.includes(noun.many), key);
  }
  assert.equal(reviewMessage('title.several.keep', { nouns: REVIEW_NOUNS['recurring-text'].many, count: 3, slide: 4 }).text,
    'Keep 3 repeated lines on slide 4');
});

test('every evidence template is one short sentence that names no raw source type and explains no method', () => {
  for (const [code, text] of Object.entries(REVIEW_MESSAGES)) {
    if (!code.startsWith('evidence.')) continue;
    assert.match(text, /^[A-Z0-9{][^.]*\.$/, `${code}: one sentence ending in a full stop`);
    assert.doesNotMatch(text, /\b(?:sldNum|ftr|dt|ctrTitle|subTitle|tbl|clipArt)\b/, `${code}: a raw placeholder type`);
    assert.ok(text.split(/\s+/).length <= 10, `${code}: "${text}" runs past ten words`);
    assert.doesNotMatch(text, /because|which is how|is not evidence|outranks|was generated|so it|the way a/i, `${code}: explains the method`);
  }
});

test('the evidence voice reads the row, not a sentence stored beside it', () => {
  const cases: Array<[Parameters<typeof evidenceMessage>[0], Parameters<typeof evidenceMessage>[2], string]> = [
    [[{ signal: 'repeat-count', value: 12, weight: 0.3, sentence: 'anything' }], { class: 'logo-candidate', kind: 'pic' }, 'Identical picture on each.'],
    [[{ signal: 'origin', value: 'master', weight: 0.3 }], { class: 'recurring-text', kind: 'text' }, 'From the slide master.'],
    [[{ signal: 'ocr-state', value: 'not-run', weight: 0.4 }], { class: 'unknown', kind: 'pic' }, 'Text in the picture was not read.'],
    [[{ signal: 'placeholder', value: 'title', weight: 0.9 }], { class: 'title', kind: 'text' }, 'In the title slot of the layout.'],
    [[{ signal: 'placeholder', value: 'sldNum', weight: 0.9 }], { class: 'page-number', kind: 'text' }, 'In the page number slot of the layout.'],
    [[{ signal: 'native-tag', value: 'barChart', weight: 0.6 }], { class: 'chart', kind: 'chart' }, 'Source names a bar chart.'],
  ];
  for (const [evidence, context, text] of cases) assert.equal(evidenceMessage(evidence, 0, context).text, text);
  // One row reads with its sibling: a small line states its words and its size together.
  const small = [
    { signal: 'text-size' as const, value: 7, weight: 0.2 },
    { signal: 'text-length' as const, value: 1, weight: 0.1 },
  ];
  assert.equal(evidenceMessage(small, 0, { class: 'decoration', kind: 'text' }).text, '1 word, 7 pt.');
  assert.equal(evidenceMessage(small, 0, { class: 'decoration', kind: 'text' }).code, 'evidence.text-size.words.one');
});

test('rows of one class, one proposal and one kind across the deck are one item with their members', () => {
  const { source, census, plan } = handDeck();
  const slide = source.slides[3]!;
  const extra = ['a', 'b', 'c'].map((n) => sourceObject({
    id: `s4.pic${n}`, kind: 'pic', klass: 'unknown', proposal: 'keep', review: 'needs-attention', fidelity: 'raster-preserved',
  }));
  slide.objects.push(...extra);
  const rows = extra.map((object) => planRow({
    id: object.id, kind: 'pic', klass: 'unknown', proposal: 'keep', review: 'needs-attention',
    evidence: [{ signal: 'ocr-state', value: 'not-run', weight: 0.4 }],
  }));
  plan.slides[3]!.objects.push(...rows);
  const queue = reviewQueue(plan, census, source);
  const pictures = itemOf(queue, (item) => item.objectIds.includes('s4.pica'));
  assert.deepEqual(pictures.objectIds, ['s4.pica', 's4.picb', 's4.picc']);
  assert.equal(pictures.id, 'kind:unknown:keep:pic');
  assert.equal(pictures.title.text, '3 pictures on slide 4');
  assert.equal(pictures.title.code, 'title.several');
  assert.equal(pictures.evidence.text, 'Text in the picture was not read.');
  assert.equal(pictures.evidenceAddsFact, false, 'text nobody tried to read is not a fact about the pictures');
  assert.deepEqual(pictures.slideNumbers, [4]);

  // A person's answer on one member keeps it in the item, so nothing moves under the pointer.
  const decided = decideObjects(plan, { objectIds: ['s4.picb'], action: 'remove', author: 'user' }).plan;
  const after = itemOf(reviewQueue(decided, census, source), (item) => item.objectIds.includes('s4.picb'));
  assert.equal(after.id, pictures.id);
  assert.deepEqual(after.correctedIds, ['s4.picb']);

  // The two charts of the hand deck are one card across the deck.
  assert.ok(queue.some((item) => item.id === 'kind:chart:keep:chart'));
});

// ─── plan 275: slide-level cards and the F11 queue ───────────────────────────

const STRUCTURES = readFileSync(fileURLToPath(new URL('./fixtures/rebrand/structures.pptx', import.meta.url)));
let structuresRun: ReturnType<typeof runRebrandPipeline> | null = null;
const structures = () => (structuresRun ??= runRebrandPipeline('structures.pptx', new Uint8Array(STRUCTURES)));

/** The fixture plan with one row left waiting on every slide, so every layout card is open. */
function waitingOnEverySlide(plan: RenovationPlanV1): RenovationPlanV1 {
  return {
    ...plan,
    slides: plan.slides.map((slide) => ({
      ...slide,
      objects: slide.objects.map((row, i) => (i === 0 ? { ...row, review: 'unreviewed' as const, decision: undefined } : row)),
    })),
  };
}

test('a layout group is one card per structure, holding slides rather than rows: clear under Suggestions, likely under Needs attention', async () => {
  const { plan: first, census, deck } = await structures();
  const plan = waitingOnEverySlide(first);
  const queue = reviewQueue(plan, census, deck);
  const groups = queue.filter((item) => item.type === 'layout-group');
  assert.equal(groups.length, 8, 'eight structures, one slide each');
  const columns = groups.find((item) => item.layout?.structure === 'columns-3');
  assert.ok(columns);
  assert.equal(columns.section, 'suggestions');
  assert.deepEqual(columns.objectIds, [], 'a layout card answers no object rows');
  assert.deepEqual(columns.slideIds, ['ppt/slides/slide1.xml']);
  assert.equal(columns.title.text, 'Three boxes, slide 1');
  assert.equal(columns.evidence.text, 'Three text boxes side by side, about the same width and lined up.');
  assert.deepEqual(columns.layout, { structure: 'columns-3', band: 'clear', archetype: 'columns-3' });
  const likely = groups.find((item) => item.layout?.structure === 'text-and-image');
  assert.equal(likely?.section, 'attention');
  assert.equal(likely?.title.text, 'Text left, picture right, slide 7');
  // Every row is still in exactly one object card.
  const seen = queue.flatMap((item) => item.objectIds).sort();
  assert.deepEqual(seen, plan.slides.flatMap((slide) => slide.objects.map((row) => row.id)).sort());
});

test('several slides of one structure are one card, and a card settles once its slides wait for nothing or a person set their layout', async () => {
  const { plan: first, census, deck } = await structures();
  const base = waitingOnEverySlide(first);
  const twin: RenovationPlanV1 = { ...base, slides: base.slides.map((slide, i) => (i === 1 ? { ...slide, layoutMatch: { ...base.slides[0]!.layoutMatch! } } : slide)) };
  const card = reviewQueue(twin, census, deck).find((item) => item.layout?.structure === 'columns-3');
  assert.equal(card?.title.text, 'Three boxes, 2 slides');
  assert.deepEqual(card?.slideNumbers, [1, 2]);
  const accepted = acceptSuggestions(base, { scope: 'all', author: 'user', includedOnly: true, source: deck }).plan;
  const answered = reviewQueue(accepted, census, deck).find((item) => item.layout?.structure === 'columns-3');
  assert.equal(answered?.section, 'settled', 'every row on the slide is answered, as Accept all leaves it');
  const chosen = { ...base, slides: base.slides.map((slide, i) => (i === 0 ? { ...slide, layoutSource: 'user' as const } : slide)) };
  assert.equal(reviewQueue(chosen, census, deck).some((item) => item.layout?.structure === 'columns-3'), false, 'a layout a person chose is no suggestion');
});

test('the first project under a new rules version puts every layout group under Needs attention', async () => {
  const { plan: first, census, deck } = await structures();
  const plan = waitingOnEverySlide(first);
  const groups = reviewQueue(plan, census, deck, { layoutGroupsNeedAttention: true }).filter((item) => item.type === 'layout-group');
  assert.ok(groups.length > 0);
  assert.ok(groups.every((item) => item.section === 'attention' && item.review === 'needs-attention'));
});

test('slides that read as diagrams are one card offering to keep them as pictures', async () => {
  const { plan: first, census, deck } = await structures();
  const dense = { code: 'layout.reason.dense', params: { units: 24 }, text: 'Many small boxes that fit no layout, like a diagram.' };
  const plan: RenovationPlanV1 = {
    ...first,
    slides: first.slides.map((slide, i) => (i === 2 || i === 5 ? { ...slide, layoutMatch: undefined, layoutReasons: [dense] } : slide)),
  };
  const card = reviewQueue(plan, census, deck).find((item) => item.type === 'diagram');
  assert.ok(card);
  assert.equal(card.section, 'attention');
  assert.equal(card.title.text, '2 slides read as diagrams');
  assert.equal(card.evidence.text, 'Keeping it as a picture may serve it better.');
  assert.deepEqual(card.slideNumbers, [3, 6]);
  const kept: RenovationPlanV1 = { ...plan, slides: plan.slides.map((slide, i) => (i === 2 || i === 5 ? { ...slide, arrangement: 'picture' as const } : slide)) };
  assert.equal(reviewQueue(kept, census, deck).some((item) => item.type === 'diagram'), false, 'a slide kept as a picture is answered');
});

test('the queue for MEDDPICC opens with at most eight cards', { skip: skipReason() ?? false }, async () => {
  const corpus = privateCorpus();
  const file = corpus?.slidesToTest.find((one) => /MEDDPICC/i.test(one));
  assert.ok(file);
  const run = await runRebrandPipeline('meddpicc.pptx', new Uint8Array(readFileSync(file)));
  const open = reviewQueue(run.plan, run.census, run.deck).filter((item) => item.section !== 'settled');
  assert.ok(open.length <= 8, `${open.length} cards: ${open.map((item) => item.title.text).join(' | ')}`);
  const titles = open.map((item) => item.title.text);
  assert.equal(titles.filter((title) => title === 'Remove the same shape on 12 slides').length, 0, 'the five master bars are one card');
});

test('a card of single letters, one on each slide, names the letters in slide order (close-out Q3)', () => {
  const withBadges = (text: (i: number) => string, slideOf: (i: number) => number) => {
    const { source, census, plan } = handDeck();
    for (let i = 0; i < 5; i += 1) {
      const n = slideOf(i);
      const spec: Spec = {
        id: `s${n}.badge${i}`, kind: 'text', klass: 'decoration', proposal: 'remove', review: 'unreviewed', text: text(i), sizePt: 48,
        evidence: [{ signal: 'text-size', value: 48, weight: 0.2 }, { signal: 'text-length', value: 1, weight: 0.1 }],
      };
      const slide = source.slides[n - 1];
      const row = plan.slides[n - 1];
      assert.ok(slide && row);
      slide.objects.push(sourceObject(spec));
      slide.readingOrder.push(spec.id);
      row.objects.push(planRow(spec));
      census.objects.push({ id: spec.id, slideId: `s${n}`, origin: 'slide', hypothesis: { class: 'decoration', confidence: 0.9, evidence: spec.evidence ?? [] } });
    }
    return reviewQueue(plan, census, source).filter((item) => item.objectIds.some((id) => id.includes('.badge')));
  };

  const letters = 'MEDDP';
  const [card] = withBadges((i) => letters[i] ?? '', (i) => i + 1);
  assert.ok(card);
  assert.equal(card.evidence.code, 'evidence.letters');
  assert.equal(card.evidence.text, 'The letters M, E, D, D, P, one per slide.');
  assert.deepEqual(card.evidence.params, { letters: 'M, E, D, D, P', count: 5 });

  // A word is not a letter, and two badges on one slide are not one per slide: the
  // card keeps the measurement it had, which the queue leaves off the card.
  const words = withBadges((i) => ['Meet', 'Every', 'Decision', 'Due', 'Plan'][i] ?? '', (i) => i + 1);
  assert.ok(words.every((item) => item.evidence.code !== 'evidence.letters'));
  const shared = withBadges((i) => letters[i] ?? '', (i) => (i < 2 ? 1 : i));
  assert.ok(shared.every((item) => item.evidence.code !== 'evidence.letters'));
});

// ─── close-out CP13 ───────────────────────────────────────────────────────────

/** Add one row to a slide of the hand deck: its source object, its census row and its plan row. */
function addRow(deck: ReturnType<typeof handDeck>, n: number, spec: Spec): void {
  const slide = deck.source.slides[n - 1];
  const row = deck.plan.slides[n - 1];
  assert.ok(slide && row);
  slide.objects.push(sourceObject(spec));
  slide.readingOrder.push(spec.id);
  row.objects.push(planRow(spec));
  deck.census.objects.push({ id: spec.id, slideId: `s${n}`, origin: spec.origin ?? 'slide', hypothesis: { class: spec.klass, confidence: 0.5, evidence: spec.evidence ?? [] } });
}

test('CP13 F8: the pictures a picture deck was cut into are one card that says the slides were rebuilt', () => {
  const deck = handDeck();
  for (let n = 1; n <= 5; n += 1) {
    addRow(deck, n, { id: `s${n}.cut`, kind: 'pic', klass: 'unknown', proposal: 'keep', review: 'needs-attention', origin: 'raster-region', fidelity: 'raster-preserved' });
  }
  const card = itemOf(reviewQueue(deck.plan, deck.census, deck.source), (item) => item.objectIds.includes('s1.cut'));
  assert.equal(card.title.code, 'title.rebuilt.many');
  assert.equal(card.title.text, 'Rebuilt 5 slides from pictures');
  assert.equal(card.evidence.code, 'evidence.rebuilt');
  assert.equal(card.evidence.text, 'Check each before Design.');
  assert.equal(card.objectIds.length, 5, 'the card still holds the pictures, so a decision on it reaches them');

  // A picture pasted on a slide of an ordinary deck keeps its own card.
  const pasted = handDeck();
  addRow(pasted, 1, { id: 's1.pasted', kind: 'pic', klass: 'unknown', proposal: 'keep', review: 'needs-attention', fidelity: 'raster-preserved' });
  assert.equal(itemOf(reviewQueue(pasted.plan, pasted.census, pasted.source), (item) => item.objectIds.includes('s1.pasted')).title.code, 'title.one');
});

test('CP13 F5: a card that merged several groups states its share of slides over its own slides', () => {
  const deck = handDeck();
  // Two repeating bands on four of five slides and one on the fifth, each group's own
  // evidence stating its own share: the card is on all five slides.
  const share = (value: number) => [{ signal: 'repeat-share' as const, value, weight: 0.5 }];
  for (let n = 1; n <= 4; n += 1) addRow(deck, n, { id: `s${n}.band`, kind: 'shape', klass: 'decoration', proposal: 'remove', review: 'unreviewed', evidence: share(0.8) });
  addRow(deck, 5, { id: 's5.bar', kind: 'shape', klass: 'decoration', proposal: 'remove', review: 'unreviewed', evidence: share(0.2) });
  deck.census.groups.push(
    { id: 'group:band', kind: 'shape', members: ['s1.band', 's2.band', 's3.band', 's4.band'], slideIds: ['s1', 's2', 's3', 's4'], exemplar: 's1.band', class: 'decoration' },
    { id: 'group:bar', kind: 'shape', members: ['s5.bar'], slideIds: ['s5'], exemplar: 's5.bar', class: 'decoration' },
  );
  const card = itemOf(reviewQueue(deck.plan, deck.census, deck.source), (item) => item.objectIds.includes('s5.bar'));
  assert.equal(card.slideIds.length, 5);
  assert.equal(card.title.text, 'Remove shapes on 5 slides');
  assert.equal(card.evidence.code, 'evidence.repeat-share');
  assert.equal(card.evidence.text, 'On 100% of slides.', 'the share counts the same slides the title does');
});
