// SPDX-License-Identifier: MPL-2.0
/**
 * Carry-forward and one applied decision (plan 274 section 3.3, work package 4).
 *
 * The deck here is hand built rather than read from a pptx, because the whole
 * question is what happens when a source CHANGES, and a hand built deck can be
 * mutated one field at a time. Fingerprints are written the way the reader
 * writes them (`<kind>:<hash>` over the kind, the gridded box and the content),
 * so moving a box means giving the object a new fingerprint, which is exactly
 * what `sourceDeckFromPptx` would do.
 *
 * Run with: node --test "tests/rebrand-decisions.test.ts"
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { censusDeck } from '../engine/src/deck-census.ts';
import { applyDecision, carryForward } from '../engine/src/rebrand-decisions.ts';
import type {
  DeckCensusV1,
  RenovationPlanV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceObjectV1,
} from '../packages/core/src/index.ts';

const HASH = `sha256:${'a'.repeat(64)}`;

function text(id: string, fingerprint: string, body: string, y: number): SourceObjectV1 {
  return {
    id,
    fingerprint,
    kind: 'text',
    box: { x: 80, y, w: 1120, h: 110, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs: [{ text: body, sizePt: 32 }] }] },
  };
}

function mark(id: string): SourceObjectV1 {
  return {
    id,
    fingerprint: 'pic:mark0001',
    kind: 'pic',
    box: { x: 1120, y: 620, w: 64, h: 64, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'raster-preserved' },
    media: 'user/media/partner-mark',
    mediaMime: 'image/png',
  };
}

function slide(id: string, index: number, objects: SourceObjectV1[]): SlideSourceV1 {
  return {
    id,
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

/** Two slides, each with one line of text and the same partner mark. */
function deck(firstSlideId = 'slide1', firstTitleFingerprint = 'text:title001'): SourceDeckV1 {
  return {
    version: 1,
    source: { kind: 'pptx', hash: HASH, lineageId: 'lineage-1', instanceId: 'instance-1', pageCount: 2 },
    slides: [
      slide(firstSlideId, 0, [
        text(`${firstSlideId}.2`, firstTitleFingerprint, 'The first title', 120),
        mark(`${firstSlideId}.3`),
      ]),
      slide('slide2', 1, [text('slide2.2', 'text:title002', 'The second title', 120), mark('slide2.3')]),
    ],
    fonts: [],
    warnings: [],
    reader: { name: 'hand-built', version: 'test' },
  };
}

function groupId(census: DeckCensusV1): string {
  const group = census.groups.find((one) => one.kind === 'media');
  assert.ok(group, 'the two partner marks verify into one group');
  return group.id;
}

/** A previous plan holding three decisions and the memories they were made against. */
function previousPlan(scope: string): RenovationPlanV1 {
  return {
    version: 1,
    source: { lineageId: 'lineage-1', hash: HASH, instanceId: 'instance-1' },
    revision: 1,
    designSystem: { id: 'ds', tokenHash: `sha256:${'0'.repeat(64)}`, fontHashes: {}, assetHashes: {} },
    algorithms: { reader: 'hand-built', census: 'census-test', plan: 'plan-test' },
    mode: 'renovate',
    slides: [
      {
        id: 'slide1',
        include: true,
        layout: 'content',
        layoutSource: 'proposed',
        objects: [
          { id: 'slide1.2', class: 'title', evidence: [], proposal: 'keep', review: 'accepted', decision: 'keep', author: 'user' },
          {
            id: 'slide1.3',
            class: 'logo-candidate',
            evidence: [],
            proposal: 'replace',
            review: 'needs-attention',
            decision: 'replace',
            decisionReplacement: { kind: 'brand-logo', variant: 'auto' },
            author: 'user',
            scope,
          },
        ],
      },
      {
        id: 'slide2',
        include: true,
        layout: 'content',
        layoutSource: 'proposed',
        objects: [
          { id: 'slide2.2', class: 'title', evidence: [], proposal: 'keep', review: 'accepted', decision: 'remove', author: 'user' },
          { id: 'slide2.3', class: 'logo-candidate', evidence: [], proposal: 'replace', review: 'needs-attention', scope },
        ],
      },
    ],
    colors: [],
    fonts: [],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [
      { fingerprint: 'text:title001', slideLineage: 'slide1', action: 'keep', author: 'user', planRevision: 1 },
      {
        fingerprint: 'pic:mark0001',
        slideLineage: 'slide1',
        action: 'replace',
        replacement: { kind: 'brand-logo', variant: 'auto' },
        author: 'user',
        scope,
        planRevision: 1,
      },
      { fingerprint: 'text:title002', slideLineage: 'slide2', action: 'remove', author: 'user', planRevision: 1 },
    ],
  };
}

test('the same bytes carry every decision by exact match', () => {
  const source = deck();
  const census = censusDeck(source);
  const previous = previousPlan(groupId(census));
  const got = carryForward(previous, source, census);

  assert.deepEqual(got.carried, ['slide1.2', 'slide1.3', 'slide2.2']);
  assert.deepEqual(got.needsReview, []);
  for (const row of got.applied) assert.equal(row.carriedBy, 'exact');
  assert.equal(got.decisions.filter((memory) => memory.carriedBy === 'exact').length, 3);
  assert.equal(got.decisions.length, 3, 'nothing was invented and nothing was lost');
});

test('a moved box is not matched and goes back to the queue', () => {
  const source = deck('slide1', 'text:title001-moved');
  const census = censusDeck(source);
  const previous = previousPlan(groupId(census));
  const got = carryForward(previous, source, census);

  assert.ok(!got.carried.includes('slide1.2'), 'a changed fingerprint is not the object the decision was made about');
  assert.deepEqual(got.needsReview, ['slide1.2']);
  assert.ok(got.carried.includes('slide2.2'), 'the untouched slide still carries');
  const memory = got.decisions.find((one) => one.fingerprint === 'text:title001');
  assert.ok(memory, 'the decision is kept even though it could not be placed');
  assert.equal(memory.carriedBy, undefined);
});

test('a renamed slide loses the id, and only a verified group carries the decision', () => {
  const source = deck('slide1b');
  const census = censusDeck(source);
  const scope = groupId(census);
  const previous = previousPlan(scope);
  const got = carryForward(previous, source, census);

  // The renamed slide's text had no group, so its decision needs another look.
  assert.ok(got.needsReview.includes('slide1.2'));
  // The partner mark is one verified group, so the group decision reaches both members.
  assert.ok(got.carried.includes('slide1b.3'), 'the renamed slide\'s mark is a member of the same group');
  assert.ok(got.carried.includes('slide2.3'), 'so is the other slide\'s mark');
  const byGroup = got.applied.filter((row) => row.carriedBy === 'group');
  assert.deepEqual(byGroup.map((row) => row.objectId).sort(), ['slide1b.3', 'slide2.3']);
  for (const row of byGroup) {
    assert.equal(row.action, 'replace');
    assert.deepEqual(row.replacement, { kind: 'brand-logo', variant: 'auto' });
    assert.equal(row.scope, scope);
  }
  // The untouched slide still carries by exact match.
  assert.ok(got.applied.some((row) => row.objectId === 'slide2.2' && row.carriedBy === 'exact'));
});

test('carried ids and reviewed ids come back sorted, and the result repeats', () => {
  const source = deck('slide1b');
  const census = censusDeck(source);
  const previous = previousPlan(groupId(census));
  const once = carryForward(previous, source, census);
  const twice = carryForward(previous, source, census);
  assert.deepEqual(once, twice);
  assert.deepEqual(once.carried, [...once.carried].sort());
  assert.deepEqual(once.needsReview, [...once.needsReview].sort());
});

test('applyDecision writes one row and leaves every other row alone', () => {
  const census = censusDeck(deck());
  const plan = previousPlan(groupId(census));
  const next = applyDecision(plan, 'slide2.3', 'keep', undefined, 'user');

  const touched = next.slides[1]?.objects[1];
  assert.ok(touched);
  assert.equal(touched.decision, 'keep');
  assert.equal(touched.review, 'accepted');
  assert.equal(touched.author, 'user');

  assert.deepEqual(next.slides[0], plan.slides[0], 'the other slide is untouched');
  assert.deepEqual(next.slides[1]?.objects[0], plan.slides[1]?.objects[0], 'the other row on the slide is untouched');
  assert.equal(plan.slides[1]?.objects[1]?.decision, undefined, 'the plan handed in was not mutated');
  assert.deepEqual(next.decisions, plan.decisions, 'the memory list belongs to the caller holding the source');
});

test('a group action reaches every row already carrying that scope, and nothing else', () => {
  const census = censusDeck(deck());
  const scope = groupId(census);
  const plan = previousPlan(scope);
  const next = applyDecision(plan, 'slide1.3', 'keep', undefined, 'agent', scope);

  const marks = next.slides.flatMap((one) => one.objects).filter((row) => row.scope === scope);
  assert.equal(marks.length, 2);
  for (const row of marks) {
    assert.equal(row.decision, 'keep');
    assert.equal(row.review, 'accepted');
    assert.equal(row.author, 'agent');
    assert.equal(row.decisionReplacement, undefined, 'a keep clears the replacement the previous decision carried');
  }
  const titles = next.slides.flatMap((one) => one.objects).filter((row) => row.class === 'title');
  assert.deepEqual(titles.map((row) => row.decision), ['keep', 'remove'], 'the text rows kept their own decisions');
});

test('a group carry never reaches a member an exact match already claimed', () => {
  const source = deck();
  const census = censusDeck(source);
  const scope = groupId(census);
  const base = previousPlan(scope);

  // One mark was decided object by object and carries the memory that places it.
  // The other carries a GROUP decision whose memory no longer names its
  // fingerprint, so the group route is the only one left for it.
  const previous: RenovationPlanV1 = {
    ...base,
    slides: [
      {
        ...base.slides[0]!,
        objects: [
          { id: 'slide1.2', class: 'title', evidence: [], proposal: 'keep', review: 'accepted', decision: 'keep', author: 'user' },
          { id: 'slide1.3', class: 'logo-candidate', evidence: [], proposal: 'replace', review: 'accepted', decision: 'keep', author: 'user' },
        ],
      },
      {
        ...base.slides[1]!,
        objects: [
          { id: 'slide2.2', class: 'title', evidence: [], proposal: 'keep', review: 'accepted', decision: 'remove', author: 'user' },
          {
            id: 'slide2.3',
            class: 'logo-candidate',
            evidence: [],
            proposal: 'replace',
            review: 'accepted',
            decision: 'replace',
            decisionReplacement: { kind: 'brand-logo', variant: 'auto' },
            author: 'user',
            scope,
          },
        ],
      },
    ],
    decisions: [
      { fingerprint: 'text:title001', slideLineage: 'slide1', action: 'keep', author: 'user', planRevision: 1 },
      { fingerprint: 'pic:mark0001', slideLineage: 'slide1', action: 'keep', author: 'user', planRevision: 1 },
      { fingerprint: 'text:title002', slideLineage: 'slide2', action: 'remove', author: 'user', planRevision: 1 },
      {
        fingerprint: 'pic:stale0001',
        slideLineage: 'slide2',
        action: 'replace',
        replacement: { kind: 'brand-logo', variant: 'auto' },
        author: 'user',
        scope,
        planRevision: 1,
      },
    ],
  };

  const got = carryForward(previous, source, census);
  const forMark = got.applied.filter((row) => row.objectId === 'slide1.3');
  assert.equal(forMark.length, 1, 'one object carries one decision, whatever route found it');
  assert.equal(forMark[0]?.action, 'keep', 'the group action did not overwrite the choice made on this object');
  assert.equal(forMark[0]?.carriedBy, 'exact');
  // The group still reaches the member nothing else claimed.
  assert.ok(got.applied.some((row) => row.objectId === 'slide2.3' && row.action === 'replace'));
  const ids = got.applied.map((row) => row.objectId);
  assert.deepEqual(ids, [...new Set(ids)], 'no object is applied twice');
});

test('applyDecision handed the source writes the memory, and the next revision carries it', () => {
  const source = deck();
  const census = censusDeck(source);
  const plan = previousPlan(groupId(census));
  const bare: RenovationPlanV1 = {
    ...plan,
    slides: plan.slides.map((slide) => ({
      ...slide,
      objects: slide.objects.map((row) => {
        const next = { ...row };
        delete next.decision;
        delete next.decisionReplacement;
        return next;
      }),
    })),
    decisions: [],
  };

  // Without the source there is no fingerprint to remember the decision against.
  const noMemory = applyDecision(bare, 'slide1.2', 'remove');
  assert.deepEqual(noMemory.decisions, [], 'the memory list belongs to the caller holding the source');
  assert.deepEqual(carryForward(noMemory, source, census).carried, [], 'a decision with no memory cannot be placed');

  const next = applyDecision(bare, 'slide1.2', 'remove', undefined, 'user', undefined, source);
  assert.deepEqual(next.decisions, [
    { fingerprint: 'text:title001', slideLineage: 'slide1', action: 'remove', author: 'user', planRevision: 1 },
  ]);
  const got = carryForward(next, source, census);
  assert.deepEqual(got.carried, ['slide1.2']);
  assert.deepEqual(got.needsReview, []);
  assert.equal(got.applied[0]?.carriedBy, 'exact');
  assert.equal(got.applied[0]?.action, 'remove');

  // A second decision on the same object replaces the memory rather than adding one.
  const again = applyDecision(next, 'slide1.2', 'keep', undefined, 'user', undefined, source);
  assert.equal(again.decisions.length, 1);
  assert.equal(again.decisions[0]?.action, 'keep');
});

test('a picture now read as a vector keeps its decision when only the kind moved (plan 275 decision 32)', () => {
  const source = deck();
  const first = source.slides[0];
  assert.ok(first);
  // A newer reader reads the first slide's mark as a drawing: same id, same place, a
  // fingerprint that now leads with its new kind.
  first.objects = first.objects.map((object) => (object.id === 'slide1.3'
    ? { ...object, kind: 'vector' as const, fingerprint: 'vector:mark0001' }
    : object));
  const census = censusDeck(source);
  const previous = previousPlan('group:gone');
  const got = carryForward(previous, source, census);

  assert.ok(got.carried.includes('slide1.3'), 'the decision reaches the same object');
  assert.equal(got.needsReview.includes('slide1.3'), false);
  const row = got.applied.find((one) => one.objectId === 'slide1.3');
  assert.equal(row?.carriedBy, 'exact');
  assert.equal(row?.action, 'replace');
  assert.deepEqual(row?.replacement, { kind: 'brand-logo', variant: 'auto' });
  // The memory now names what the object is, so the next revision matches it exactly.
  const memory = got.decisions.find((one) => one.slideLineage === 'slide1' && one.action === 'replace');
  assert.equal(memory?.fingerprint, 'vector:mark0001');
  assert.equal(memory?.carriedBy, 'exact');
  assert.equal(got.decisions.length, 3, 'nothing was invented and nothing was lost');
});

test('a picture memory is not taken by a vector while the picture it names is still on the slide', () => {
  const source = deck();
  const first = source.slides[0];
  assert.ok(first);
  // The mark stays a picture, and a new drawing takes the mark's old id: that is a
  // different object, so the decision about the picture does not move onto it.
  first.objects = [
    ...first.objects.map((object) => (object.id === 'slide1.3' ? { ...object, id: 'slide1.4' } : object)),
    { ...(first.objects[1] as SourceObjectV1), id: 'slide1.3', kind: 'vector', fingerprint: 'vector:other001' },
  ];
  first.readingOrder = first.objects.map((object) => object.id);
  const census = censusDeck(source);
  const got = carryForward(previousPlan('group:gone'), source, census);
  assert.equal(got.applied.some((one) => one.objectId === 'slide1.3'), false);
});
