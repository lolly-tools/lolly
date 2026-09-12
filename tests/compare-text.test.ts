// SPDX-License-Identifier: MPL-2.0
/**
 * Pins compareText's own contract, independent of compare.ts's wrapping: the
 * bounded LCS after stripping equal edges, the 2 MiB / 20,000-token limits it
 * reports through the budget rather than throwing, and that emitted change
 * locations point at the ORIGINAL source line/offset (not a stripped index) -
 * the property compare.ts's consumers rely on to place a diff in a document.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareText } from '../engine/src/compare-text.ts';
import { comparisonBudget, COMPARE_MAX_TEXT } from '../engine/src/compare-budget.ts';
import type { ComparisonOptions } from '@lolly-tools/core/host-v1';

function run(before: string, after: string, options: ComparisonOptions = {}) {
  const budget = comparisonBudget(options);
  compareText(before, after, options, budget);
  return budget;
}

test('identical text produces no changes and no partial flag', () => {
  const budget = run('same text\nline two', 'same text\nline two');
  assert.equal(budget.changes.length, 0);
  assert.equal(budget.summary.total, 0);
  assert.equal(budget.partial, false);
});

test('a changed middle line reports the correct kind and original location', () => {
  const budget = run('one\ntwo\nthree', 'one\nTWO\nthree');
  assert.equal(budget.summary.total, 1);
  const change = budget.changes[0]!;
  assert.equal(change.kind, 'changed');
  // Line 2, offset past "one\n" (4 chars) in the ORIGINAL text, not index 0
  // after the equal-prefix/suffix stripping compareText does internally.
  assert.equal(change.before!.line, 2);
  assert.equal(change.before!.offset, 4);
  assert.equal(change.after!.line, 2);
});

test('a pure addition has no before location and a pure removal has no after location', () => {
  // Trailing newline on every line keeps line-granularity tokens identical
  // except for the appended/removed one, so the diff is a pure insert/delete.
  const added = run('one\ntwo\n', 'one\ntwo\nthree\n');
  assert.equal(added.changes.length, 1);
  assert.equal(added.changes[0]!.kind, 'added');
  assert.equal('before' in added.changes[0]!, false);

  const removed = run('one\ntwo\nthree\n', 'one\ntwo\n');
  assert.equal(removed.changes.length, 1);
  assert.equal(removed.changes[0]!.kind, 'removed');
  assert.equal('after' in removed.changes[0]!, false);
});

test('word granularity aligns at word boundaries within a line', () => {
  const budget = run('keep old word', 'keep new word', { granularity: 'word' });
  assert.equal(budget.summary.total, 1);
  assert.equal(budget.changes[0]!.beforeValue, 'old');
  assert.equal(budget.changes[0]!.afterValue, 'new');
});

test('whitespace ignore + ignoreCase treat reformatted-only text as equivalent', () => {
  const budget = run(' A  B\r\n', 'a b\n', { whitespace: 'ignore', ignoreCase: true });
  assert.equal(budget.changes.length, 0);
  assert.equal(budget.summary.total, 0);
});

test('text over the 2 MiB limit is refused via budget.limit, not a thrown error', () => {
  const huge = 'x'.repeat(COMPARE_MAX_TEXT + 1);
  const budget = run(huge, huge + 'y');
  assert.equal(budget.partial, true);
  assert.ok([...budget.limitations].some(m => m.includes('2 MiB')));
  assert.equal(budget.changes.length, 0);
});

test('more than 20,000 tokens is refused via budget.limit, not a thrown error', () => {
  const before = Array.from({ length: 20_001 }, (_, i) => `line${i}`).join('\n');
  const budget = run(before, before + '\nextra');
  assert.equal(budget.partial, true);
  assert.ok([...budget.limitations].some(m => m.includes('20,000-token')));
});

test('the LCS work budget stops mid-comparison on a tiny maxWork and marks the result partial', () => {
  const before = Array.from({ length: 50 }, (_, i) => `line${i}`).join('\n');
  const after = Array.from({ length: 50 }, (_, i) => `LINE${i}`).join('\n');
  const budget = run(before, after, { maxWork: 1 });
  assert.equal(budget.partial, true);
  assert.equal(budget.changes.length, 0);
});
