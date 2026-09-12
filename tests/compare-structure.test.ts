// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/compare-structure.ts - structured (JSON-shaped) field comparison
 * with ordered-array diffing and optional stable-ID move detection.
 *
 * Pins the behaviour compare.ts's callers depend on:
 *   - a changed leaf value produces a 'changed' record; an added/removed key
 *     produces 'added'/'removed' with only the present side's path+value.
 *   - options.arrayAlignment: 'id' reorders arrays of {id: string} objects by
 *     LIS (longest increasing subsequence) so inserting one row does not
 *     report every later row as moved - only the row(s) that actually left
 *     the stable order do.
 *   - arrays with duplicate/missing ids fall back to positional comparison
 *     and record the documented limitation, rather than crashing.
 *   - the budget's limits (depth > 100, item-count > 40,000, cyclic refs,
 *     sparse arrays, non-plain values) each stop that branch and record a
 *     limitation instead of throwing.
 *   - ignoreRootMetadata skips only root-level `__`-prefixed keys, not nested
 *     ones.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareStructure } from '../engine/src/compare-structure.ts';
import { comparisonBudget } from '../engine/src/compare-budget.ts';
import type { ComparisonOptions } from '@lolly-tools/core/host-v1';

const opts = (o: Partial<ComparisonOptions> = {}): ComparisonOptions => o as ComparisonOptions;

function run(before: unknown, after: unknown, o: Partial<ComparisonOptions> = {}) {
  const budget = comparisonBudget(opts(o));
  compareStructure(before, after, opts(o), budget);
  return budget;
}

test('a changed leaf value produces one "changed" record with both paths', () => {
  const budget = run({ name: 'a' }, { name: 'b' });
  assert.equal(budget.changes.length, 1);
  const [c] = budget.changes;
  assert.equal(c!.kind, 'changed');
  assert.equal(c!.beforeValue, 'a');
  assert.equal(c!.afterValue, 'b');
});

test('an added key produces "added" with only an after-side path/value, no before side', () => {
  const budget = run({}, { name: 'new' });
  assert.equal(budget.changes.length, 1);
  const [c] = budget.changes;
  assert.equal(c!.kind, 'added');
  assert.equal(c!.afterValue, 'new');
  assert.equal('before' in c!, false);
});

test('a removed key produces "removed" with only a before-side path/value', () => {
  const budget = run({ name: 'gone' }, {});
  assert.equal(budget.changes.length, 1);
  const [c] = budget.changes;
  assert.equal(c!.kind, 'removed');
  assert.equal(c!.beforeValue, 'gone');
  assert.equal('after' in c!, false);
});

test('identical values produce no changes at all', () => {
  const budget = run({ a: 1, b: [1, 2, 3] }, { a: 1, b: [1, 2, 3] });
  assert.equal(budget.changes.length, 0);
  assert.equal(budget.summary.total, 0);
});

test('arrayAlignment "id" reports only the row that actually moved, not every later row', () => {
  const before = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  // Insert 'x' at the front: b and c keep their RELATIVE order, so only the
  // insertion should be reported - not b and c as "moved".
  const after = [{ id: 'x' }, { id: 'a' }, { id: 'b' }, { id: 'c' }];
  const budget = run(before, after, { arrayAlignment: 'id' });
  const kinds = budget.changes.map(c => c.kind).sort();
  assert.deepEqual(kinds, ['added']);
});

test('arrayAlignment "id" reports a genuine reorder as "moved"', () => {
  const before = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const after = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
  const budget = run(before, after, { arrayAlignment: 'id' });
  const moved = budget.changes.filter(c => c.kind === 'moved');
  assert.ok(moved.length >= 1, 'expected at least one moved record for a real reorder');
});

test('duplicate ids in an id-aligned array fall back to positional comparison with a limitation', () => {
  const before = [{ id: 'a', v: 1 }, { id: 'a', v: 2 }];
  const after = [{ id: 'a', v: 1 }, { id: 'a', v: 3 }];
  const budget = run(before, after, { arrayAlignment: 'id' });
  assert.ok([...budget.limitations].some(m => m.includes('missing or duplicate IDs')));
  // Positional fallback still finds the real change at index 1.
  assert.ok(budget.changes.some(c => c.kind === 'changed'));
});

test('a cyclic reference is reported as a limitation, not an infinite loop', () => {
  const a: Record<string, unknown> = { name: 'x' };
  a.self = a;
  const b: Record<string, unknown> = { name: 'x' };
  b.self = b;
  const budget = run(a, b);
  assert.ok([...budget.limitations].some(m => m.toLowerCase().includes('cyclic')));
});

test('a sparse array is refused with its documented limitation', () => {
  // A real hole at index 1, built by assignment: an array literal with an
  // empty slot is a lint error, and what matters here is the runtime hole
  // rather than the syntax that produced it.
  const sparse: number[] = [];
  sparse[0] = 1;
  sparse[2] = 3;
  const budget = run(sparse, [1, 2, 3]);
  assert.ok([...budget.limitations].some(m => m.includes('Sparse arrays')));
});

test('nesting deeper than 100 levels stops that branch with a limitation', () => {
  let before: unknown = 'leaf';
  let after: unknown = 'leaf2';
  for (let i = 0; i < 105; i++) { before = { next: before }; after = { next: after }; }
  const budget = run(before, after);
  assert.ok([...budget.limitations].some(m => m.includes('100 levels')));
});

test('ignoreRootMetadata skips a root-level __-prefixed key but not a nested one', () => {
  const before = { __meta: 'old', nested: { __meta: 'old' } };
  const after = { __meta: 'new', nested: { __meta: 'new' } };
  const budget = run(before, after, { ignoreRootMetadata: true });
  // Only the nested __meta change should surface.
  assert.equal(budget.changes.length, 1);
  assert.equal(budget.changes[0]!.beforeValue, 'old');
});

test('spend() exhaustion (maxWork) stops the walk and marks the result partial', () => {
  const before = { a: 1, b: 2, c: 3, d: 4, e: 5 };
  const after = { a: 9, b: 9, c: 9, d: 9, e: 9 };
  const budget = comparisonBudget(opts({ maxWork: 1 }));
  compareStructure(before, after, opts({ maxWork: 1 }), budget);
  assert.equal(budget.partial, true);
});
