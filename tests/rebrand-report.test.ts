// SPDX-License-Identifier: MPL-2.0
/**
 * Which report codes a surface leaves out of its list of entries (plan 275
 * close-out decision 9): the ones the counts already carry, and, while the project
 * is still in review, the preview's own `review.applied-unreviewed`.
 *
 * Run with: node --test "tests/rebrand-report.test.ts"
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COUNTED_CODES, REVIEW_ONLY_CODES, addEntry, countedCode, emptyReport } from '../engine/src/rebrand-report.ts';
import { REPORT_CODES } from '../packages/core/src/index.ts';

test('the counted codes are the ones the counts carry, in review or not', () => {
  for (const code of ['object.retained', 'object.transformed', 'object.removed', 'colour.assigned'] as const) {
    assert.equal(countedCode(code, { inReview: true }), true, code);
    assert.equal(countedCode(code, { inReview: false }), true, code);
  }
  // Each counted code moves a count when it is added, which is why a list leaves it out.
  const report = emptyReport('sha256:x', 1);
  addEntry(report, { code: 'object.removed', objectId: 'a', disposition: 'removed', class: 'decoration' });
  addEntry(report, { code: 'colour.assigned' });
  assert.equal(report.counts.objects.removed, 1);
  assert.equal(report.counts.coloursAssigned, 1);
});

test('the preview compile\'s applied-unreviewed is left out while in review, and listed after', () => {
  assert.equal(countedCode('review.applied-unreviewed', { inReview: true }), true);
  assert.equal(countedCode('review.applied-unreviewed', { inReview: false }), false);
  assert.equal(countedCode('text.overflow', { inReview: true }), false);
  assert.equal(countedCode('object.unresolved', { inReview: true }), false, 'what could not be read is always listed');
});

test('every code the two sets name is a code of the contract', () => {
  const known = new Set<string>(REPORT_CODES);
  for (const code of [...COUNTED_CODES, ...REVIEW_ONLY_CODES]) assert.ok(known.has(code), code);
});
