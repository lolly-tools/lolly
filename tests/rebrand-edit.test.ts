// SPDX-License-Identifier: MPL-2.0
/**
 * Pure plan edits (plan 274 section 4, `engine/src/rebrand-edit.ts`) and the
 * report's `markAppliedUnreviewed`.
 *
 * The central property is undo: for every edit kind, capturing the rows the
 * edit touched from the plan it started from and restoring them onto the edited
 * plan gives the starting plan back exactly, and re-applying the edit to the
 * restored plan gives the edited plan again. It runs over the committed
 * fixtures' real plans with seeded choices, so it covers plans the first pass
 * writes rather than only hand-built ones.
 *
 * Run with: node --test "tests/rebrand-edit.test.ts"
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  acceptSuggestions,
  capturePlanRows,
  decideObjects,
  moveSlide,
  moveSlides,
  resetSlideDecisions,
  restorePlanRows,
  setColorTarget,
  setFontTarget,
  setObjectText,
  setSlidesArrangement,
  setSlidesIncluded,
  setSlidesLayout,
  slidesSharingSourceLayout,
  type PlanEditResultV1,
  type PlanRowsTouchedV1,
} from '../engine/src/rebrand-edit.ts';
import { effectiveSlideOrder, openPendingIds } from '../engine/src/rebrand-review.ts';
import { emptyReport, finalizeReport, addEntry, markAppliedUnreviewed } from '../engine/src/rebrand-report.ts';
import { ARCHETYPE_IDS, PLAN_ACTIONS, SLIDE_ARRANGEMENTS } from '../packages/core/src/index.ts';
import type { ObjectPlanV1, RenovationPlanV1, SourceDeckV1 } from '../packages/core/src/index.ts';
import { readFixture } from './helpers/rebrand-fixtures.ts';
import { runRebrandPipeline, type RebrandRunV1 } from './helpers/rebrand-pipeline.ts';

// ─── a small hand-built plan ─────────────────────────────────────────────────

function row(id: string, over: Partial<ObjectPlanV1> = {}): ObjectPlanV1 {
  return { id, class: 'logo-candidate', evidence: [], proposal: 'replace', review: 'needs-attention', ...over };
}

function handPlan(): { plan: RenovationPlanV1; source: SourceDeckV1 } {
  const ids = ['s1', 's2', 's3', 's4'];
  const plan: RenovationPlanV1 = {
    version: 1,
    source: { lineageId: 'hand', hash: 'sha256:hand', instanceId: 'hand' },
    revision: 3,
    designSystem: { id: 'test', tokenHash: 'sha256:0', fontHashes: {}, assetHashes: {} },
    algorithms: { reader: 'hand', census: 'hand', plan: 'hand' },
    mode: 'renovate',
    slides: ids.map((id, i) => ({
      id,
      include: true,
      layout: 'content',
      layoutSource: 'proposed',
      objects: [
        row(`${id}.mark`, {
          proposalReplacement: { kind: 'brand-logo', variant: 'auto' },
          scope: 'group:mark',
          ...(i === 1 ? { locked: true } : {}),
          ...(i === 2 ? { decision: 'keep' as const, author: 'user' as const, review: 'accepted' as const } : {}),
        }),
        row(`${id}.num`, { class: 'page-number', proposal: 'remove', review: 'accepted' }),
        row(`${id}.logo`, { class: 'known-logo', review: 'unreviewed', proposalReplacement: { kind: 'brand-logo', variant: 'auto' } }),
      ],
    })),
    colors: [
      { useId: 'u1', from: '#112233', role: 'ink', to: '#1d1d1d', toPath: 'color.semantic.text', affects: ['s1.num'] },
      { useId: 'u2', from: '#445566', role: 'accent', unresolved: 'palette-too-small', affects: [] },
    ],
    fonts: [{ from: 'Calibri', to: 'Inter', source: 'alias' }],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [{ fingerprint: 'fp:s3.mark', slideLineage: 's3', action: 'keep', author: 'user', planRevision: 2 }],
  };
  const source: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash: 'sha256:hand', lineageId: 'hand', instanceId: 'hand', pageCount: 4 },
    slides: plan.slides.map((slide, i) => ({
      id: slide.id,
      index: i,
      width: 1280,
      height: 720,
      background: {},
      objects: slide.objects.map((one) => ({
        id: one.id,
        fingerprint: `fp:${one.id}`,
        kind: 'pic' as const,
        box: { x: 0, y: 0, w: 10, h: 10, rot: 0 },
        origin: 'slide' as const,
        fidelity: { state: 'raster-preserved' as const },
      })),
      readingOrder: [],
      warnings: [],
      origin: { kind: 'pptx' as const, ...(i === 3 ? {} : { layout: i === 1 ? 'two' : 'one' }) },
    })),
    fonts: [],
    warnings: [],
    reader: { name: 'hand', version: '1' },
  };
  return { plan, source };
}

function rowOf(plan: RenovationPlanV1, id: string): ObjectPlanV1 {
  const found = plan.slides.flatMap((slide) => slide.objects).find((one) => one.id === id);
  assert.ok(found, `${id} is on the plan`);
  return found;
}

// ─── object decisions ────────────────────────────────────────────────────────

test('a group apply skips locked and corrected rows and names them', () => {
  const { plan, source } = handPlan();
  const before = structuredClone(plan);
  const result = decideObjects(plan, {
    objectIds: ['s1.mark', 's2.mark', 's3.mark', 's4.mark', 'nope'],
    action: 'remove',
    scope: 'group:mark',
    source,
  });
  assert.deepEqual(plan, before, 'the input plan is not changed');
  assert.deepEqual(result.touched, ['s1.mark', 's4.mark']);
  assert.deepEqual(result.skipped, [
    { id: 's2.mark', reason: 'locked' },
    { id: 's3.mark', reason: 'corrected' },
    { id: 'nope', reason: 'unknown' },
  ]);
  for (const id of result.touched) {
    const one = rowOf(result.plan, id);
    assert.equal(one.decision, 'remove');
    assert.equal(one.review, 'accepted');
    assert.equal(one.author, 'user');
    assert.equal(one.scope, 'group:mark');
  }
  assert.equal(rowOf(result.plan, 's3.mark').decision, 'keep', 'the correction stands');
  assert.equal(rowOf(result.plan, 's2.mark').decision, undefined, 'the locked row stands');
  assert.equal(result.plan.revision, plan.revision, 'an edit never bumps the revision');
  const memory = result.plan.decisions.filter((one) => one.action === 'remove');
  assert.deepEqual(memory.map((one) => [one.fingerprint, one.slideLineage, one.scope]).sort(), [
    ['fp:s1.mark', 's1', 'group:mark'],
    ['fp:s4.mark', 's4', 'group:mark'],
  ]);
});

test('includeCorrected reaches a correction, and an equal decision is not a correction', () => {
  const { plan } = handPlan();
  const included = decideObjects(plan, { objectIds: ['s3.mark'], action: 'remove', includeCorrected: true });
  assert.deepEqual(included.touched, ['s3.mark']);
  assert.equal(rowOf(included.plan, 's3.mark').decision, 'remove');
  const same = decideObjects(plan, { objectIds: ['s3.mark'], action: 'keep' });
  assert.deepEqual(same.touched, ['s3.mark']);
});

test('a replacement travels with the decision and an agent is recorded as the author', () => {
  const { plan } = handPlan();
  const result = decideObjects(plan, {
    objectIds: ['s1.mark'],
    action: 'replace',
    replacement: { kind: 'asset', id: 'test/logo/partner' },
    author: 'agent',
  });
  const one = rowOf(result.plan, 's1.mark');
  assert.deepEqual(one.decisionReplacement, { kind: 'asset', id: 'test/logo/partner' });
  assert.equal(one.author, 'agent');
});

test('acceptSuggestions: unreviewed leaves needs-attention alone and all answers it', () => {
  const { plan } = handPlan();
  const unreviewed = acceptSuggestions(plan, { scope: 'unreviewed', author: 'user' });
  assert.deepEqual(unreviewed.touched, ['s1.logo', 's2.logo', 's3.logo', 's4.logo']);
  assert.equal(rowOf(unreviewed.plan, 's1.mark').decision, undefined);
  assert.equal(rowOf(unreviewed.plan, 's1.mark').review, 'needs-attention');
  const logo = rowOf(unreviewed.plan, 's1.logo');
  assert.equal(logo.decision, 'replace');
  assert.deepEqual(logo.decisionReplacement, { kind: 'brand-logo', variant: 'auto' });
  assert.equal(logo.review, 'accepted');

  const all = acceptSuggestions(plan, { scope: 'all', author: 'preset' });
  assert.deepEqual(all.touched, ['s1.mark', 's1.logo', 's2.logo', 's3.logo', 's4.mark', 's4.logo']);
  assert.deepEqual(all.skipped, [{ id: 's2.mark', reason: 'locked' }]);
  assert.equal(rowOf(all.plan, 's1.mark').decision, 'replace');
  assert.equal(rowOf(all.plan, 's1.mark').author, 'preset');
  assert.equal(rowOf(all.plan, 's3.mark').decision, 'keep', 'a decided row is not answered again');
});

test('acceptSuggestions answers rows on included slides only unless a caller says otherwise', () => {
  const { plan } = handPlan();
  const left = setSlidesIncluded(plan, ['s4'], false).plan;
  const byDefault = acceptSuggestions(left, { scope: 'all', author: 'agent' });
  assert.deepEqual(byDefault.touched, ['s1.mark', 's1.logo', 's2.logo', 's3.logo'], 'the slide left out keeps its rows open');
  assert.equal(rowOf(byDefault.plan, 's4.mark').decision, undefined);
  assert.equal(rowOf(byDefault.plan, 's4.logo').decision, undefined);
  assert.deepEqual(byDefault.touched, openPendingIds(left), 'exactly the rows the shared pending rule names');
  assert.deepEqual(openPendingIds(byDefault.plan), [], 'and nothing is left waiting after it');

  const everywhere = acceptSuggestions(left, { scope: 'all', author: 'agent', includedOnly: false });
  assert.deepEqual(everywhere.touched, ['s1.mark', 's1.logo', 's2.logo', 's3.logo', 's4.mark', 's4.logo']);
});

// ─── slides ──────────────────────────────────────────────────────────────────

test('moveSlide reorders among included slides, writes order on each, and clamps', () => {
  const { plan } = handPlan();
  const later = moveSlide(plan, 's1', 2);
  assert.deepEqual(effectiveSlideOrder(later.plan).map((slide) => slide.id), ['s2', 's3', 's1', 's4']);
  assert.deepEqual(later.plan.slides.map((slide) => slide.order), [2, 0, 1, 3]);
  assert.deepEqual(later.touched, ['s2', 's3', 's1', 's4']);

  const clamped = moveSlide(plan, 's3', -99);
  assert.deepEqual(effectiveSlideOrder(clamped.plan).map((slide) => slide.id), ['s3', 's1', 's2', 's4']);
  const end = moveSlide(plan, 's2', 99);
  assert.deepEqual(effectiveSlideOrder(end.plan).map((slide) => slide.id), ['s1', 's3', 's4', 's2']);

  const withExcluded = setSlidesIncluded(plan, ['s2'], false).plan;
  const skip = moveSlide(withExcluded, 's4', -1);
  assert.deepEqual(effectiveSlideOrder(skip.plan).map((slide) => slide.id), ['s1', 's4', 's3', 's2']);
  assert.deepEqual(moveSlide(withExcluded, 's2', 1).skipped, [{ id: 's2', reason: 'excluded' }]);
  assert.deepEqual(moveSlide(plan, 'nope', 1).skipped, [{ id: 'nope', reason: 'unknown' }]);
});

test('setSlidesLayout marks the choice as the person own, and the source layout finds its siblings', () => {
  const { plan, source } = handPlan();
  const siblings = slidesSharingSourceLayout(source, 's1');
  assert.deepEqual(siblings, ['s1', 's3']);
  assert.deepEqual(slidesSharingSourceLayout(source, 's4'), ['s4']);
  assert.deepEqual(slidesSharingSourceLayout(source, 'nope'), []);
  const result = setSlidesLayout(plan, siblings, 'two-column');
  for (const slide of result.plan.slides) {
    const changed = siblings.includes(slide.id);
    assert.equal(slide.layout, changed ? 'two-column' : 'content');
    assert.equal(slide.layoutSource, changed ? 'user' : 'proposed');
  }
});

test('setSlidesArrangement keeps the layout, layout clears the field, and a layout pick goes back to the layout', () => {
  const { plan } = handPlan();
  const kept = setSlidesArrangement(plan, ['s1', 's2', 'nope'], 'picture');
  assert.deepEqual(kept.touched, ['s1', 's2']);
  assert.deepEqual(kept.skipped, [{ id: 'nope', reason: 'unknown' }]);
  for (const slide of kept.plan.slides) {
    assert.equal(slide.arrangement, slide.id === 's1' || slide.id === 's2' ? 'picture' : undefined);
    // The layout stays on the row, so switching back restores it.
    assert.equal(slide.layout, plan.slides.find((one) => one.id === slide.id)?.layout);
  }
  const original = setSlidesArrangement(kept.plan, ['s1'], 'original');
  assert.equal(original.plan.slides.find((one) => one.id === 's1')?.arrangement, 'original');
  const back = setSlidesArrangement(original.plan, ['s1'], 'layout');
  const s1 = back.plan.slides.find((one) => one.id === 's1');
  assert.ok(s1 && !('arrangement' in s1), 'layout is stored as no field');
  const picked = setSlidesLayout(kept.plan, ['s2'], 'two-column');
  const s2 = picked.plan.slides.find((one) => one.id === 's2');
  assert.ok(s2 && !('arrangement' in s2), 'picking a layout pours the slide into it again');
  // Undo is capture and restore over the touched slides.
  const snapshot = capturePlanRows(plan, { slideIds: kept.touched });
  assert.deepEqual(restorePlanRows(kept.plan, snapshot), plan);
});

// ─── colours and fonts ───────────────────────────────────────────────────────

test('setColorTarget locks by default, and null clears the choice and the lock', () => {
  const { plan } = handPlan();
  const set = setColorTarget(plan, ['u2', 'nope'], { hex: '#0c7c59', path: 'color.semantic.primary' });
  const u2 = set.plan.colors.find((one) => one.useId === 'u2');
  assert.deepEqual(u2, { useId: 'u2', from: '#445566', role: 'accent', to: '#0c7c59', toPath: 'color.semantic.primary', locked: true, affects: [] });
  assert.deepEqual(set.skipped, [{ id: 'nope', reason: 'unknown' }]);
  const loose = setColorTarget(plan, ['u1'], { hex: '#000000' }, false);
  assert.deepEqual(loose.plan.colors[0], { useId: 'u1', from: '#112233', role: 'ink', to: '#000000', affects: ['s1.num'] });
  const cleared = setColorTarget(set.plan, ['u2'], null);
  assert.deepEqual(cleared.plan.colors[1], { useId: 'u2', from: '#445566', role: 'accent', affects: [] });
});

test('setFontTarget records the person as the source', () => {
  const { plan } = handPlan();
  const result = setFontTarget(plan, 'Calibri', 'SUSE', 'font.brand');
  assert.deepEqual(result.plan.fonts, [{ from: 'Calibri', to: 'SUSE', toPath: 'font.brand', source: 'user' }]);
  assert.deepEqual(setFontTarget(plan, 'Arial', 'SUSE').skipped, [{ id: 'Arial', reason: 'unknown' }]);
});

// ─── undo, as a property over every edit kind ────────────────────────────────

/** A small deterministic generator, so a failure names a seed that reproduces it. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(rand: () => number, list: readonly T[]): T {
  const value = list[Math.floor(rand() * list.length)];
  assert.ok(value !== undefined);
  return value;
}

function subset<T>(rand: () => number, list: readonly T[]): T[] {
  return list.filter(() => rand() < 0.35);
}

type EditCase = { name: string; run: (plan: RenovationPlanV1) => PlanEditResultV1; touched: (result: PlanEditResultV1) => PlanRowsTouchedV1 };

function editCases(plan: RenovationPlanV1, source: SourceDeckV1, rand: () => number): EditCase[] {
  const objectIds = plan.slides.flatMap((slide) => slide.objects.map((one) => one.id));
  const slideIds = plan.slides.map((slide) => slide.id);
  const useIds = plan.colors.map((one) => one.useId);
  const fonts = plan.fonts.map((one) => one.from);
  const byObjects = (result: PlanEditResultV1): PlanRowsTouchedV1 => ({ objectIds: result.touched, source });
  const bySlides = (result: PlanEditResultV1): PlanRowsTouchedV1 => ({ slideIds: result.touched });
  const decideIds = subset(rand, objectIds);
  const action = pick(rand, PLAN_ACTIONS);
  const includeIds = subset(rand, slideIds);
  const moveId = pick(rand, slideIds);
  const delta = Math.floor(rand() * 7) - 3;
  const layout = pick(rand, ARCHETYPE_IDS);
  const layoutIds = subset(rand, slideIds);
  const arrangement = pick(rand, SLIDE_ARRANGEMENTS);
  const colorIds = subset(rand, useIds);
  const fontFrom = fonts.length > 0 ? pick(rand, fonts) : 'none';
  const blockIds = subset(rand, slideIds);
  const blockAt = Math.floor(rand() * (slideIds.length + 2)) - 1;
  const resetIds = subset(rand, slideIds);
  const textId = objectIds.length > 0 ? pick(rand, objectIds) : 'none';
  const textValue = rand() < 0.3 ? null : 'Corrected\r\ntext';
  // A reset goes back to the plan the edits started from, so it has something to undo.
  const bySlideRows = (result: PlanEditResultV1): PlanRowsTouchedV1 => {
    const named = new Set(result.touched);
    return { slideIds: result.touched, objectIds: result.plan.slides.filter((one) => named.has(one.id)).flatMap((one) => one.objects.map((o) => o.id)), source };
  };
  return [
    { name: 'decideObjects', run: (p) => decideObjects(p, { objectIds: decideIds, action, scope: 'test', source }), touched: byObjects },
    { name: 'decideObjects corrected', run: (p) => decideObjects(p, { objectIds: decideIds, action, includeCorrected: true }), touched: byObjects },
    { name: 'acceptSuggestions unreviewed', run: (p) => acceptSuggestions(p, { scope: 'unreviewed', author: 'user', source }), touched: byObjects },
    { name: 'acceptSuggestions all', run: (p) => acceptSuggestions(p, { scope: 'all', author: 'preset' }), touched: byObjects },
    { name: 'setSlidesIncluded', run: (p) => setSlidesIncluded(p, includeIds, false), touched: bySlides },
    {
      // Two edits as one transaction, so its touched rows are the union of both.
      name: 'setSlidesIncluded back',
      run: (p) => {
        const out = setSlidesIncluded(p, includeIds, false);
        const back = setSlidesIncluded(out.plan, includeIds, true);
        return { plan: back.plan, touched: [...new Set([...out.touched, ...back.touched])], skipped: back.skipped };
      },
      touched: bySlides,
    },
    { name: 'moveSlide', run: (p) => moveSlide(p, moveId, delta), touched: bySlides },
    { name: 'setSlidesLayout', run: (p) => setSlidesLayout(p, layoutIds, layout), touched: bySlides },
    { name: 'setSlidesArrangement', run: (p) => setSlidesArrangement(p, layoutIds, arrangement), touched: bySlides },
    {
      // A slide kept as a picture, then a layout picked for it: the arrangement goes with the pick.
      name: 'setSlidesArrangement then setSlidesLayout',
      run: (p) => {
        const out = setSlidesArrangement(p, layoutIds, 'original');
        const back = setSlidesLayout(out.plan, layoutIds, layout);
        return { plan: back.plan, touched: [...new Set([...out.touched, ...back.touched])], skipped: back.skipped };
      },
      touched: bySlides,
    },
    { name: 'setColorTarget', run: (p) => setColorTarget(p, colorIds, { hex: '#123456', path: 'color.x' }), touched: (r) => ({ useIds: r.touched }) },
    { name: 'setColorTarget clear', run: (p) => setColorTarget(p, colorIds, null), touched: (r) => ({ useIds: r.touched }) },
    { name: 'setFontTarget', run: (p) => setFontTarget(p, fontFrom, 'SUSE'), touched: (r) => ({ fonts: r.touched }) },
    { name: 'moveSlides', run: (p) => moveSlides(p, blockIds, blockAt), touched: bySlides },
    { name: 'resetSlideDecisions', run: (p) => resetSlideDecisions(p, resetIds, { proposed: plan, source }), touched: bySlideRows },
    { name: 'resetSlideDecisions without a proposal', run: (p) => resetSlideDecisions(p, resetIds, { source }), touched: bySlideRows },
    { name: 'setObjectText', run: (p) => setObjectText(p, textId, textValue), touched: (r) => ({ objectIds: r.touched, source }) },
  ];
}

function assertUndoInverts(label: string, plan: RenovationPlanV1, source: SourceDeckV1, seed: number): void {
  const rand = lcg(seed);
  // A plan that already carries decisions and an explicit order, so restore has real state to put back.
  let start = decideObjects(plan, { objectIds: subset(rand, plan.slides.flatMap((s) => s.objects.map((o) => o.id))), action: 'keep', source }).plan;
  start = moveSlide(start, pick(rand, start.slides.map((s) => s.id)), 1).plan;
  for (const edit of editCases(start, source, rand)) {
    const frozen = structuredClone(start);
    const result = edit.run(start);
    assert.deepEqual(start, frozen, `${label} seed ${seed} ${edit.name}: the input plan is untouched`);
    const snapshot = capturePlanRows(start, edit.touched(result));
    const restored = restorePlanRows(result.plan, snapshot);
    assert.deepEqual(restored, start, `${label} seed ${seed} ${edit.name}: restore inverts the edit`);
    assert.deepEqual(edit.run(restored).plan, result.plan, `${label} seed ${seed} ${edit.name}: re-applying gives the edited plan`);
  }
}

test('restorePlanRows inverts every edit kind on a hand-built plan', () => {
  const { plan, source } = handPlan();
  for (let seed = 1; seed <= 40; seed += 1) assertUndoInverts('hand', plan, source, seed);
});

test('restorePlanRows inverts every edit kind on the committed fixtures', async () => {
  const runs: RebrandRunV1[] = [];
  for (const name of ['simple.pptx', 'adversarial.pptx', 'palette.pptx'] as const) runs.push(await runRebrandPipeline(name, readFixture(name)));
  for (const run of runs) {
    for (let seed = 1; seed <= 12; seed += 1) assertUndoInverts(run.deck.source.name ?? 'fixture', run.plan, run.deck, seed);
  }
});

test('undo of an older transaction leaves a later one on other slides in place', () => {
  const { plan, source } = handPlan();
  const first = decideObjects(plan, { objectIds: ['s1.mark'], action: 'keep', source });
  const undoFirst = capturePlanRows(plan, { objectIds: first.touched });
  const second = decideObjects(first.plan, { objectIds: ['s4.mark'], action: 'remove', source });
  const undone = restorePlanRows(second.plan, undoFirst);
  assert.equal(rowOf(undone, 's1.mark').decision, undefined);
  assert.equal(rowOf(undone, 's4.mark').decision, 'remove');
  assert.ok(undone.decisions.some((one) => one.fingerprint === 'fp:s4.mark'));
  assert.ok(!undone.decisions.some((one) => one.fingerprint === 'fp:s1.mark'));
});

// ─── plan 275: block moves, reset and corrected text ─────────────────────────

test('moveSlides moves a block in its own order, to the start, the end or a gap, and names what it passed over', () => {
  const { plan } = handPlan();
  const order = (p: RenovationPlanV1): string[] => effectiveSlideOrder(p).filter((one) => one.include).map((one) => one.id);
  const toEnd = moveSlides(plan, ['s3', 's1'], Number.MAX_SAFE_INTEGER);
  assert.deepEqual(order(toEnd.plan), ['s2', 's4', 's1', 's3'], 'the block keeps deck order, whatever order it was named in');
  assert.deepEqual(toEnd.touched, ['s2', 's4', 's1', 's3']);
  assert.deepEqual(order(moveSlides(plan, ['s4'], 0).plan), ['s4', 's1', 's2', 's3']);
  assert.deepEqual(order(moveSlides(plan, ['s1', 's2'], 1).plan), ['s3', 's1', 's2', 's4'], 'the first moved slide lands at index 1');
  assert.deepEqual(order(moveSlides(plan, ['s1'], -5).plan), ['s1', 's2', 's3', 's4'], 'an index before the start clamps');
  const out = setSlidesIncluded(plan, ['s2'], false).plan;
  const moved = moveSlides(out, ['s2', 's9', 's4'], 0);
  assert.deepEqual(moved.skipped, [{ id: 's2', reason: 'excluded' }, { id: 's9', reason: 'unknown' }]);
  assert.deepEqual(order(moved.plan), ['s4', 's1', 's3']);
  assert.deepEqual(moveSlides(out, ['s2'], 0).touched, [], 'a slide left out has no place to move to');
});

test('resetSlideDecisions puts the proposal back, keeps locked rows, and forgets the decision memory', () => {
  const { plan, source } = handPlan();
  let edited = decideObjects(plan, { objectIds: ['s1.mark', 's1.logo', 's2.logo'], action: 'remove', source }).plan;
  edited = setSlidesLayout(edited, ['s1'], 'two-column').plan;
  edited = setObjectText(edited, 's1.num', 'Page one').plan;
  edited = { ...edited, slides: edited.slides.map((one) => (one.id === 's1' ? { ...one, ground: 'dark' as const, order: 0 } : one)) };
  const lockedLogo = { ...edited, slides: edited.slides.map((one) => (one.id === 's1' ? { ...one, objects: one.objects.map((r) => (r.id === 's1.logo' ? { ...r, locked: true } : r)) } : one)) };
  const result = resetSlideDecisions(lockedLogo, ['s1', 's9'], { proposed: plan, source });
  assert.deepEqual(result.touched, ['s1']);
  assert.deepEqual(result.skipped, [{ id: 's9', reason: 'unknown' }, { id: 's1.logo', reason: 'locked' }]);
  const slide = result.plan.slides.find((one) => one.id === 's1');
  assert.equal(slide?.layout, 'content');
  assert.equal(slide?.layoutSource, 'proposed');
  assert.equal(slide?.ground, undefined, 'the slide background was the person\'s change too');
  assert.equal(slide?.order, 0, 'the order is not a change to the slide');
  assert.deepEqual(rowOf(result.plan, 's1.mark'), rowOf(plan, 's1.mark'));
  assert.equal(rowOf(result.plan, 's1.num').textOverride, undefined);
  assert.equal(rowOf(result.plan, 's1.logo').decision, 'remove', 'a locked row stays as it is');
  assert.equal(rowOf(result.plan, 's2.logo').decision, 'remove', 'another slide is left alone');
  assert.ok(!result.plan.decisions.some((one) => one.slideLineage === 's1' && one.fingerprint === 'fp:s1.mark'), 'the memory of the reset row is forgotten');
  assert.ok(result.plan.decisions.some((one) => one.fingerprint === 'fp:s2.logo'), 'the memory of other slides stays');
  assert.deepEqual(resetSlideDecisions(plan, ['s1'], { proposed: plan, source }).touched, [], 'a slide at its proposal has nothing to reset');
});

test('resetSlideDecisions without a proposal takes the answer off and asks for review again', () => {
  const { plan, source } = handPlan();
  const edited = decideObjects(plan, { objectIds: ['s4.logo'], action: 'keep', source }).plan;
  const result = resetSlideDecisions(edited, ['s4'], { source });
  const reset = rowOf(result.plan, 's4.logo');
  assert.equal(reset.decision, undefined);
  assert.equal(reset.author, undefined);
  assert.equal(reset.review, 'unreviewed');
});

test('setObjectText writes the correction, null gives the reading back, and a locked row is passed over', () => {
  const { plan } = handPlan();
  const set = setObjectText(plan, 's1.num', 'Line one\r\nLine two');
  assert.deepEqual(set.touched, ['s1.num']);
  assert.equal(rowOf(set.plan, 's1.num').textOverride, 'Line one\nLine two');
  assert.equal(rowOf(plan, 's1.num').textOverride, undefined, 'the input plan is untouched');
  const back = setObjectText(set.plan, 's1.num', null);
  assert.deepEqual(back.plan, plan);
  assert.deepEqual(setObjectText(plan, 's2.mark', 'x').skipped, [{ id: 's2.mark', reason: 'locked' }]);
  assert.deepEqual(setObjectText(plan, 'nope', 'x').skipped, [{ id: 'nope', reason: 'unknown' }]);
  const snapshot = capturePlanRows(plan, { objectIds: set.touched });
  assert.deepEqual(restorePlanRows(set.plan, snapshot), plan, 'one capture undoes it');
});

// ─── the report ──────────────────────────────────────────────────────────────

test('markAppliedUnreviewed adds one entry per id, once, and keeps the accounting balanced', () => {
  const report = emptyReport('sha256:x', 2);
  addEntry(report, { code: 'object.retained', objectId: 'a', disposition: 'retained' });
  addEntry(report, { code: 'object.removed', objectId: 'b', disposition: 'removed' });
  const before = structuredClone(report);
  const marked = markAppliedUnreviewed(report, ['a', 'b', 'a']);
  assert.deepEqual(report, before, 'the report passed in is unchanged');
  assert.equal(marked.counts.appliedUnreviewed, 2);
  const entries = marked.entries.filter((entry) => entry.code === 'review.applied-unreviewed');
  assert.deepEqual(entries.map((entry) => entry.objectId), ['a', 'b']);
  assert.ok(entries.every((entry) => entry.message.length > 0 && entry.disposition === undefined));
  const again = markAppliedUnreviewed(marked, ['b', 'c']);
  assert.equal(again.counts.appliedUnreviewed, 3);
  assert.doesNotThrow(() => finalizeReport(structuredClone(marked), ['a', 'b']));
});

// ─── review findings pinned ──────────────────────────────────────────────────

test('a replacement a person chose survives a group apply that states none', () => {
  const { plan, source } = handPlan();
  const mine = decideObjects(plan, { objectIds: ['s1.mark'], action: 'replace', replacement: { kind: 'asset', id: 'mine' }, source }).plan;
  const group = decideObjects(mine, { objectIds: ['s1.mark', 's4.mark'], action: 'replace', scope: 'group:mark', source });
  assert.deepEqual(group.touched, ['s4.mark']);
  assert.deepEqual(group.skipped, [{ id: 's1.mark', reason: 'corrected' }]);
  assert.deepEqual(rowOf(group.plan, 's1.mark').decisionReplacement, { kind: 'asset', id: 'mine' });
  const forced = decideObjects(mine, { objectIds: ['s1.mark'], action: 'replace', includeCorrected: true });
  assert.equal(rowOf(forced.plan, 's1.mark').decisionReplacement, undefined, 'include corrected is the explicit way to overwrite it');
});

test('a decision made without a scope takes the earlier group scope off the row', () => {
  const { plan, source } = handPlan();
  const result = decideObjects(plan, { objectIds: ['s1.mark'], action: 'keep', source });
  assert.equal(rowOf(result.plan, 's1.mark').scope, undefined);
  assert.equal(rowOf(result.plan, 's4.mark').scope, 'group:mark', 'rows outside the apply keep theirs');
  const memory = result.plan.decisions.find((one) => one.fingerprint === 'fp:s1.mark');
  assert.equal(memory?.scope, undefined);
});

test('included slides hold orders 0 to n-1 once an order is set, whatever is left out and brought back', () => {
  const { plan } = handPlan();
  const five = { ...plan, slides: [...plan.slides, { ...plan.slides[0]!, id: 's5', objects: [] }] };
  let current = moveSlide(five, 's5', -4).plan;
  current = setSlidesIncluded(current, ['s3'], false).plan;
  assert.equal(current.slides.find((slide) => slide.id === 's3')?.order, undefined, 'a slide left out loses its order');
  current = moveSlide(current, 's1', 1).plan;
  const back = setSlidesIncluded(current, ['s3'], true);
  const orders = back.plan.slides.filter((slide) => slide.include).map((slide) => slide.order).sort((a, b) => (a ?? 0) - (b ?? 0));
  assert.deepEqual(orders, [0, 1, 2, 3, 4]);
  // s3 comes back right after s2, the included slide that precedes it in the source.
  assert.deepEqual(effectiveSlideOrder(back.plan).map((slide) => slide.id), ['s5', 's2', 's3', 's1', 's4']);
  assert.ok(back.touched.includes('s3') && back.touched.includes('s1') && back.touched.includes('s4'));

  const rand = lcg(7);
  for (let step = 0; step < 60; step += 1) {
    const ids = subset(rand, current.slides.map((slide) => slide.id));
    current = rand() < 0.5
      ? setSlidesIncluded(current, ids, rand() < 0.5).plan
      : moveSlide(current, pick(rand, current.slides.map((slide) => slide.id)), Math.floor(rand() * 5) - 2).plan;
    const included = current.slides.filter((slide) => slide.include);
    if (!included.some((slide) => slide.order !== undefined)) continue;
    assert.deepEqual(included.map((slide) => slide.order).sort((a, b) => (a ?? 0) - (b ?? 0)), included.map((_, i) => i), `step ${step}`);
  }
});

test('undo of an older transaction leaves a later decision on the same slide in place', () => {
  const { plan, source } = handPlan();
  const first = decideObjects(plan, { objectIds: ['s1.mark'], action: 'keep', source });
  const undoFirst = capturePlanRows(plan, { objectIds: first.touched, source });
  const second = decideObjects(first.plan, { objectIds: ['s1.logo'], action: 'remove', source });
  const undone = restorePlanRows(second.plan, undoFirst);
  assert.equal(rowOf(undone, 's1.mark').decision, undefined);
  assert.equal(rowOf(undone, 's1.logo').decision, 'remove');
  assert.ok(undone.decisions.some((one) => one.fingerprint === 'fp:s1.logo' && one.action === 'remove'), 'the later memory stays');
  assert.ok(!undone.decisions.some((one) => one.fingerprint === 'fp:s1.mark'));
});

test('markAppliedUnreviewed records a row that needed attention as such', () => {
  const report = emptyReport('sha256:x', 1);
  const marked = markAppliedUnreviewed(report, [{ id: 'a', review: 'needs-attention' }, { id: 'b', review: 'unreviewed' }, 'c']);
  const reviews = marked.entries.filter((entry) => entry.code === 'review.applied-unreviewed').map((entry) => [entry.objectId, entry.review]);
  assert.deepEqual(reviews, [['a', 'needs-attention'], ['b', 'unreviewed'], ['c', 'unreviewed']]);
  assert.equal(marked.counts.appliedUnreviewed, 3);
});
