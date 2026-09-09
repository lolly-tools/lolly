// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { revisionDifference } from './revision-difference.ts';

test('comparison ignores creation metadata and reports editable changes without retaining payloads', () => {
  const diff = revisionDifference({ __label: 'One', blocks: [{ text: 'before' }], background: 'blue' }, { __label: 'Two', blocks: [{ text: 'after' }], color: 'red' });
  assert.equal(diff.changed, 3); assert.ok(diff.paths.includes('blocks.0.text')); assert.equal(diff.truncated, false);
  assert.deepEqual(revisionDifference({ a: 1 }, { a: 1 }), { changed: 0, paths: [], truncated: false });
});

test('a large comparison limits retained detail', () => {
  const diff = revisionDifference(Array.from({ length: 1000 }, () => 1), Array.from({ length: 1000 }, () => 2));
  assert.equal(diff.paths.length, 50); assert.equal(diff.changed, 1000); assert.equal(diff.truncated, true);
});
