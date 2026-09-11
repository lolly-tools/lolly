// SPDX-License-Identifier: MPL-2.0
/**
 * yours-shelf.ts - the selection rules (plans/170 WP-2).
 *
 * Run directly:
 *   node --test shells/web/src/views/yours-shelf.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yoursShelfTools, YOURS_MIN_TOOLS, YOURS_MAX_CHIPS } from './yours-shelf.ts';

const byId = new Map([...'abcdefghij'].map(c => [c, { id: c, name: c.toUpperCase() }]));
const none = new Set<string>();

test('the shelf stays away until enough distinct tools have sessions', () => {
  assert.deepEqual(yoursShelfTools(['a', 'b'], none, byId, none), []);
  assert.equal(yoursShelfTools(['a', 'b', 'c'], none, byId, none).length, YOURS_MIN_TOOLS);
});

test('favourited recents lead, then favourites, then recents - deduped and capped', () => {
  // 'c' is a favourited recent (leads); 'f' a favourite with no session (second
  // tier); the rest fill in recency order with no repeats.
  const picked = yoursShelfTools(['a', 'b', 'c', 'd'], new Set(['c', 'f']), byId, none);
  assert.deepEqual(picked.map(x => x.id), ['c', 'f', 'a', 'b', 'd']);
  const many = yoursShelfTools([...'abcdefghij'], none, byId, none);
  assert.equal(many.length, YOURS_MAX_CHIPS);
});

test('hidden tools and tools this catalog does not ship are excluded everywhere', () => {
  // 'a' is hidden, 'zzz' is not in the catalog - neither reaches the shelf.
  const picked = yoursShelfTools(['a', 'b', 'c', 'd', 'zzz'], new Set(['b']), byId, new Set(['a']));
  assert.deepEqual(picked.map(x => x.id), ['b', 'c', 'd']);
  // The gate counts USABLE recents: hiding one of three drops the shelf back
  // below the threshold rather than showing a two-chip shelf.
  assert.deepEqual(yoursShelfTools(['a', 'b', 'c'], none, byId, new Set(['a'])), []);
});
