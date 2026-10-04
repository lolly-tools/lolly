// SPDX-License-Identifier: MPL-2.0
/**
 * Text over a picture, measured (plan 291 M4 fix): the render family reads the pixels
 * under a text layer the mounted audit could only send to a visual check, and raises
 * `design.text.contrast-low` when nearly all of that area fails. Dark ink over a dark
 * photo used to check clean with a review note only.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { applySampledContrast, judgeSampledContrast, SAMPLED_MIN_PIXELS } from '../packages/node-shell/src/contrast-sample.ts';
import { checkFindingFromMounted } from '../engine/src/design-check.ts';

const NAVY = { r: 0x0c, g: 0x32, b: 0x2c, a: 1 };
const WHITE = { r: 255, g: 255, b: 255, a: 1 };

function area(count: number, pick: (i: number) => [number, number, number]): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(...pick(i), 255);
  return out;
}

const darkPhoto = area(400, (i) => [20 + (i % 7), 30 + (i % 5), 28 + (i % 3)]);
const halfAndHalf = area(400, (i) => (i % 2 ? [20, 30, 28] : [235, 240, 238]));

test('navy ink over a dark photo measures low; white ink over the same photo does not', () => {
  const navy = judgeSampledContrast(darkPhoto, [NAVY], 3);
  assert.ok(navy, 'enough pixels to measure');
  assert.equal(navy.low, true);
  assert.ok(navy.ratio < 1.5, `ratio ${navy.ratio}`);
  assert.equal(navy.failing, 1);
  const white = judgeSampledContrast(darkPhoto, [WHITE], 4.5);
  assert.equal(white?.low, false);
  assert.ok((white?.ratio ?? 0) > 10);
});

test('a background that is half light and half dark stays a visual check', () => {
  const verdict = judgeSampledContrast(halfAndHalf, [NAVY], 3);
  assert.equal(verdict?.low, false);
  assert.ok(Math.abs((verdict?.failing ?? 0) - 0.5) < 0.01);
});

test('the worst of several run colours decides, translucent ink is painted over each pixel, and too few pixels is no measurement', () => {
  assert.equal(judgeSampledContrast(darkPhoto, [WHITE, NAVY], 3)?.low, true, 'one dark run is enough');
  assert.equal(judgeSampledContrast(darkPhoto, [{ ...WHITE, a: 0.1 }], 3)?.low, true, 'a faint white over a dark photo fails');
  assert.equal(judgeSampledContrast(area(SAMPLED_MIN_PIXELS - 1, () => [0, 0, 0]), [WHITE], 3), null);
  assert.equal(judgeSampledContrast(area(100, () => [0, 0, 0]).map((v, i) => (i % 4 === 3 ? 0 : v)), [WHITE], 3), null, 'transparent pixels are skipped');
  assert.equal(judgeSampledContrast(darkPhoto, [], 3), null);
});

test('a measured low note becomes contrast-low with its ratio; a mixed one and an unmeasured one stay visual checks', () => {
  const review = (layerId: string) => ({
    id: 'design.text.contrast-review', severity: 'info', path: `/boxes/${layerId.length}/fg`,
    evidence: { name: layerId, reason: 'complex-background' }, message: 'Check visually.', layerId,
  });
  const value = {
    format: 'lolly-design-check-page', version: 1,
    mounted: { findings: [review('title'), review('caption'), review('other'), { id: 'design.text.overflow', severity: 'warn', path: '/boxes/1/text', evidence: { name: 'x' }, message: '', layerId: 'x' }], checked: { overflow: 4, contrast: 2, fonts: 0 }, manualContrastReview: 3 },
  };
  const low = judgeSampledContrast(darkPhoto, [NAVY], 3)!;
  const mixed = judgeSampledContrast(halfAndHalf, [NAVY], 3)!;
  const out = applySampledContrast(value, new Map([['title', { verdict: low, minimum: 3 }], ['caption', { verdict: mixed, minimum: 4.5 }]])) as typeof value & { sampledContrast: { measured: number; low: number } };
  const [title, caption, other, overflow] = out.mounted.findings as Array<{ id: string; severity: string; evidence: Record<string, string>; layerId: string; path: string; message: string }>;
  assert.equal(title!.id, 'design.text.contrast-low');
  assert.equal(title!.severity, 'warn');
  assert.deepEqual(title!.evidence, { name: 'title', reason: 'sampled-background', ratio: low.ratio.toFixed(1), minimum: '3.0' });
  assert.equal(caption!.id, 'design.text.contrast-review');
  assert.equal(other!.id, 'design.text.contrast-review');
  assert.equal(overflow!.id, 'design.text.overflow');
  assert.equal(out.mounted.checked.contrast, 3);
  assert.equal(out.mounted.manualContrastReview, 2);
  assert.deepEqual(out.sampledContrast, { measured: 2, low: 1 });
  const finding = checkFindingFromMounted(title as never);
  assert.equal(finding.code, 'design.text.contrast-low');
  assert.match(finding.message, /has about \d\.\d:1 contrast with the picture under it; this text needs at least 3\.0:1\./);
  assert.equal(finding.needs, undefined, 'a measured finding needs no visual check');
  assert.equal(applySampledContrast(value, new Map()), value, 'nothing measured leaves the answer as it was');
});
