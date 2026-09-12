// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/compare-budget.ts - the work/output limits shared by the
 * comparison algorithms in compare-structure.ts and compare-text.ts.
 *
 * Pins the caps that keep a comparison bounded on adversarial input:
 *   - spend() enforces the work ceiling (clamped/defaulted via `bounded`,
 *     never NaN/negative/over the hard max) and reports false once exceeded,
 *     recording a limitation and flipping `partial`.
 *   - add() counts every change into `summary` regardless of the maxChanges
 *     cap, but stops appending to `changes` and sets `detailsTruncated` once
 *     the cap is hit - callers rely on the summary staying accurate even when
 *     details are dropped.
 *   - comparisonValue()/the structured excerpt never emit unbounded output:
 *     long strings and deep/wide objects are truncated to the documented
 *     2000-char / 100-node caps, and a cyclic reference is called out rather
 *     than infinitely recursed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonBudget, comparisonValue, COMPARE_MAX_TEXT } from '../engine/src/compare-budget.ts';
import type { ComparisonOptions } from '@lolly-tools/core/host-v1';

const opts = (o: Partial<ComparisonOptions> = {}): ComparisonOptions => o as ComparisonOptions;

test('spend() stays true under the work limit and false once exceeded, marking partial', () => {
  const budget = comparisonBudget(opts({ maxWork: 5 }));
  assert.equal(budget.spend(3), true);
  assert.equal(budget.partial, false);
  assert.equal(budget.spend(3), false); // 6 > 5
  assert.equal(budget.partial, true);
  assert.ok(budget.limitations.has('The comparison work limit was reached. Unchecked content may differ.'));
});

test('spend() clamps maxWork/maxChanges options to sane floors instead of trusting NaN or negative input', () => {
  const budget = comparisonBudget(opts({ maxWork: Number.NaN, maxChanges: -5 }));
  // maxWork falls back to the 1,000,000 default - a single small spend must pass.
  assert.equal(budget.spend(1), true);
  // maxChanges floors to 1 (Math.max(1, ...)), so at least one change is kept.
  budget.add({ kind: 'added', after: { path: [] }, afterValue: 'x' } as never);
  budget.add({ kind: 'added', after: { path: [] }, afterValue: 'y' } as never);
  assert.equal(budget.changes.length, 1);
  assert.equal(budget.detailsTruncated, true);
});

test('add() always increments the summary even after the maxChanges detail cap is hit', () => {
  const budget = comparisonBudget(opts({ maxChanges: 1 }));
  budget.add({ kind: 'added', after: { path: [] }, afterValue: 'a' } as never);
  budget.add({ kind: 'removed', before: { path: [] }, beforeValue: 'b' } as never);
  budget.add({ kind: 'changed' } as never);
  assert.equal(budget.summary.total, 3);
  assert.equal(budget.summary.added, 1);
  assert.equal(budget.summary.removed, 1);
  assert.equal(budget.summary.changed, 1);
  assert.equal(budget.changes.length, 1);
  assert.equal(budget.detailsTruncated, true);
});

test('spend() honours an AbortSignal by throwing rather than silently continuing', () => {
  const controller = new AbortController();
  const budget = comparisonBudget(opts(), controller.signal);
  controller.abort();
  assert.throws(() => budget.spend());
});

test('comparisonValue truncates a long string to 2000 chars and reports truncated', () => {
  const long = 'x'.repeat(3000);
  const { text, truncated } = comparisonValue(long);
  assert.equal(text.length, 2000);
  assert.equal(truncated, true);
  const { text: shortText, truncated: shortTruncated } = comparisonValue('short');
  assert.equal(shortText, 'short');
  assert.equal(shortTruncated, false);
});

test('comparisonValue renders primitives and a structured excerpt for objects/arrays', () => {
  assert.deepEqual(comparisonValue(42), { text: '42', truncated: false });
  assert.deepEqual(comparisonValue(true), { text: 'true', truncated: false });
  assert.deepEqual(comparisonValue(null), { text: 'null', truncated: false });
  const { text } = comparisonValue({ a: 1, b: [2, 3] });
  assert.equal(text, '{"a": 1, "b": [2, 3]}');
});

test('comparisonValue marks a cyclic object as truncated instead of recursing forever', () => {
  const cyclic: Record<string, unknown> = { name: 'loop' };
  cyclic.self = cyclic;
  const { text, truncated } = comparisonValue(cyclic);
  assert.equal(truncated, true);
  assert.ok(text.includes('[repeated reference]'));
});

test('comparisonValue keeps a 20-key object whole and truncates only past the cap', () => {
  const atCap: Record<string, number> = {};
  for (let i = 0; i < 20; i++) atCap[`k${i}`] = i;
  const { truncated: atCapTruncated } = comparisonValue(atCap);
  assert.equal(atCapTruncated, false);

  const overCap: Record<string, number> = { ...atCap, k20: 20 };
  const { truncated: overCapTruncated } = comparisonValue(overCap);
  assert.equal(overCapTruncated, true);
});

test('comparisonValue walks 8 levels of nesting whole and truncates only past the cap', () => {
  let atCap: unknown = 'leaf';
  for (let i = 0; i < 8; i++) atCap = { next: atCap };
  const { truncated: atCapTruncated } = comparisonValue(atCap);
  assert.equal(atCapTruncated, false);

  const overCap = { next: atCap };
  const { truncated: overCapTruncated } = comparisonValue(overCap);
  assert.equal(overCapTruncated, true);
});

test('COMPARE_MAX_TEXT pins the documented 2 MiB byte budget shared by comparison callers', () => {
  assert.equal(COMPARE_MAX_TEXT, 2097152);
});
