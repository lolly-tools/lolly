// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVisualSources, renderComparisonPage } from '../engine/src/compare-visual.ts';
import { createCompareAPI } from '../engine/src/compare.ts';
import type { VisualComparisonPage, VisualComparisonSource } from '@lolly-tools/core/host-v1';
function page(values: number[], width = values.length, page = 1): VisualComparisonPage {
  return { page, width, height: values.length / width, unit: 'px', pixelWidth: width, pixelHeight: values.length / width, rgba: new Uint8ClampedArray(values.flatMap(v => [v, v, v, 255])) };
}
function source(pages: VisualComparisonPage[], totalPages = pages.length): VisualComparisonSource {
  return { identity: { id: 'snapshot', kind: 'file', label: 'CONFIDENTIAL' }, pages, totalPages };
}
test('visual comparison distinguishes byte equality, sampled appearance, noise, bounds and movement', async () => {
  const before = { ...source([page([0, 255, 255, 255])]), bytes: new Uint8Array([1]) };
  const after = { ...source([page([255, 255, 0, 255])]), bytes: new Uint8Array([2]) };
  const snapshot = structuredClone(before);
  const result = await createCompareAPI().visual!({ version: 1, before, after });
  assert.equal(result.byteEquality, 'different'); assert.equal(result.appearance, 'different');
  assert.equal(result.pages[0]!.changedPixels, 2); assert.deepEqual(result.pages[0]!.bounds, { x: 0, y: 0, width: 3, height: 1 });
  assert.deepEqual(before, snapshot);
  const ignored = compareVisualSources({ version: 1, before: source([page([100])]), after: source([page([103])]), options: { threshold: 3 } });
  assert.equal(ignored.appearance, 'same-rendered-pixels');
  assert.equal(compareVisualSources({ version: 1, before, after: { ...before, bytes: new Uint8Array([2]) } }).appearance, 'same-rendered-pixels');
});
test('native and fit alignment share the viewer sampler and keep dimension changes visible', () => {
  const before = source([page([0, 0])]), after = source([page([0, 0, 0, 0])]);
  const native = compareVisualSources({ version: 1, before, after });
  const fit = compareVisualSources({ version: 1, before, after, options: { alignment: 'fit' } });
  assert.equal(native.pages[0]!.changedPixels, 2); assert.equal(fit.pages[0]!.changedPixels, 0);
  assert.equal(fit.pages[0]!.kind, 'changed'); assert.equal(fit.pages[0]!.sizeChanged, true);
  assert.deepEqual([...renderComparisonPage(before.pages[0], native.pages[0]!, 'native')], [0,0,0,255,0,0,0,255,255,255,255,255,255,255,255,255]);
  const alpha = page([0]); alpha.rgba[3] = 0;
  assert.equal(compareVisualSources({ version: 1, before: source([alpha]), after: source([page([255])]) }).appearance, 'same-rendered-pixels');
});
test('added, removed, failed and capped pages remain distinct; partial matching never claims equality', () => {
  const one = source([page([0])]), two = source([page([0]), page([0], 1, 2)]);
  assert.equal(compareVisualSources({ version: 1, before: one, after: two }).summary.added, 1);
  assert.equal(compareVisualSources({ version: 1, before: two, after: one }).summary.removed, 1);
  const failed = compareVisualSources({ version: 1, before: two, after: source([page([0])], 2) });
  assert.equal(failed.pages[1]!.kind, 'unavailable'); assert.equal(failed.appearance, 'undetermined');
  const partial = compareVisualSources({ version: 1, before: one, after: { ...one, fidelity: { level: 'partial', limitations: ['Missing saved font.'] } } });
  assert.equal(partial.appearance, 'undetermined'); assert.ok(partial.limitations.includes('Missing saved font.'));
  const capped = compareVisualSources({ version: 1, before: source([page([0])], 1000), after: source([page([0])], 1000) });
  assert.equal(capped.pages.length, 12); assert.equal(capped.summary.total, 1000); assert.equal(capped.completeness, 'partial');
});
test('invalid previews are rejected, source work is bounded and cancellation is not equality', () => {
  const valid = source([page([0])]);
  for (const bad of [{ ...page([0]), width: Infinity }, { ...page([0]), rgba: new Uint8ClampedArray(3) }, { ...page([0]), pixelWidth: 10_000_000 }]) {
    assert.throws(() => compareVisualSources({ version: 1, before: source([bad]), after: valid }), /Invalid/);
  }
  const hugeGeometry = source([{ ...page([0]), width: 1_000_000, height: 1_000_000 }]);
  assert.equal(compareVisualSources({ version: 1, before: hugeGeometry, after: hugeGeometry }).pages[0]!.width, 768);
  const abort = new AbortController(); abort.abort();
  assert.throws(() => compareVisualSources({ version: 1, before: valid, after: valid }, abort.signal), { name: 'AbortError' });
});
