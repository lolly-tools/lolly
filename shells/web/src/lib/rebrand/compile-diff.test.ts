// SPDX-License-Identifier: MPL-2.0
/**
 * What changed between two compiles of one renovation (plan 274 section 3.4).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/compile-diff.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CompiledDeckV1 } from '@lolly-tools/core/rebrand-v1';
import { compileDiff, isEmptyDiff } from './compile-diff.ts';

const REPO = new URL('../../../../../', import.meta.url);
const COMPILED = JSON.parse(readFileSync(new URL('tests/fixtures/rebrand/samples/compiled.json', REPO), 'utf8')) as CompiledDeckV1;

const deck = (): CompiledDeckV1 => structuredClone(COMPILED);

test('the same deck twice changes nothing', () => {
  const diff = compileDiff(deck(), deck());
  assert.equal(isEmptyDiff(diff), true);
  assert.equal(diff.from, COMPILED.planRevision);
});

test('a frame left out and a frame added are named by id', () => {
  const next = deck();
  const [first, ...rest] = next.frames;
  assert.ok(first);
  next.frames = [...rest, { ...first, id: 'frame-new', layers: [] }];
  const diff = compileDiff(deck(), next);
  assert.deepEqual(diff.framesRemoved, [first.id]);
  assert.deepEqual(diff.framesAdded, ['frame-new']);
});

test('an object whose layers change is listed once by its source object, and a row order alone is no change', () => {
  const next = deck();
  const edge = next.lineage.forward.find((one) => one.layerIds.length > 0);
  assert.ok(edge, 'the sample has a source object with layers');
  const layerId = edge.layerIds[0];
  for (const frame of next.frames) {
    for (const row of frame.layers) {
      row.order = Number(row.order ?? 0) + 10;
      if (row.id === layerId) row.text = 'Something else';
    }
  }
  const diff = compileDiff(deck(), next);
  assert.deepEqual(diff.objectsChanged, [edge.sourceObjectId]);
});

test('an object with layers only in one compile is added or removed', () => {
  const next = deck();
  const edge = next.lineage.forward.find((one) => one.layerIds.length > 0);
  assert.ok(edge);
  next.lineage.forward = next.lineage.forward.filter((one) => one !== edge);
  next.lineage.forward.push({ sourceObjectId: 'brand-new.1', layerIds: [...edge.layerIds] });
  const diff = compileDiff(deck(), next);
  assert.deepEqual(diff.objectsRemoved, [edge.sourceObjectId]);
  assert.deepEqual(diff.objectsAdded, ['brand-new.1']);
});

test('colours and fonts are compared as sets, whatever case a colour is written in', () => {
  const next = deck();
  const row = next.frames[0]?.layers.find((one) => one.kind === 'text') ?? next.frames[0]?.layers[0];
  assert.ok(row);
  row.fill = '#abcdef';
  row.font = 'Serif Face';
  const diff = compileDiff(deck(), next);
  assert.ok(diff.coloursAdded.includes('#ABCDEF'));
  assert.deepEqual(diff.fontsAdded, ['Serif Face']);
  const back = compileDiff(next, deck());
  assert.ok(back.coloursRemoved.includes('#ABCDEF'));
  assert.deepEqual(back.fontsRemoved, ['Serif Face']);
});

test('over two real compiles, a slide left out or moved changes no object on the other slides but their page numbers', async () => {
  const { moveSlide, setSlidesIncluded } = await import('@lolly/engine');
  const pipeline = await import('../../../../../tests/helpers/rebrand-pipeline.ts');
  const fixtures = await import('../../../../../tests/helpers/rebrand-fixtures.ts');
  const bytes = fixtures.readFixture('simple.pptx');
  const base = await pipeline.runRebrandPipeline('simple.pptx', bytes);
  const [first, second] = base.plan.slides;
  assert.ok(first && second, 'simple.pptx has at least two slides');
  const firstObjects = new Set(first.objects.map((row) => row.id));

  const without = await pipeline.runRebrandPipeline('simple.pptx', bytes, {
    revise: (plan) => setSlidesIncluded(plan, [first.id], false).plan,
  });
  const left = compileDiff(base.compiled, without.compiled);
  assert.ok(left.framesRemoved.length > 0, 'the slide left out is named');
  // Every object on the slides that stayed kept its place inside its own slide. A page
  // number does change: the slide it is on has a new number.
  const classOf = new Map(base.plan.slides.flatMap((slide) => slide.objects.map((row) => [row.id, row.class] as const)));
  const changed = left.objectsChanged.filter((id) => !firstObjects.has(id) && classOf.get(id) !== 'page-number');
  assert.deepEqual(changed, [], JSON.stringify(left));
  assert.deepEqual(left.framesMoved, [], 'the slides after it kept their order');

  const moved = await pipeline.runRebrandPipeline('simple.pptx', bytes, {
    revise: (plan) => moveSlide(plan, second.id, -1).plan,
  });
  const shift = compileDiff(base.compiled, moved.compiled);
  assert.deepEqual(shift.objectsChanged.filter((id) => classOf.get(id) !== 'page-number'), [], 'a move changes no object but the page numbers');
  assert.deepEqual(shift.framesAdded, []);
  assert.deepEqual(shift.framesRemoved, []);
  assert.equal(shift.framesMoved.length, 1, 'one slide moved, and only that one is named');
  assert.equal(isEmptyDiff(shift), false);
});
