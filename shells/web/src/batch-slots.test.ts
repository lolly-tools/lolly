// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the canonical batch-slot naming helpers. These pin the
 * literal prefix and the prefix-matching / name-building idioms previously
 * duplicated across pro/sessions.js, folder-tiles.js, views/gallery.js and
 * pro/folder-rows.js.
 * Run directly:  node --experimental-strip-types --test shells/web/src/batch-slots.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BATCH_SLOT_PREFIX, isBatchSlot, batchSlot, batchSlotName } from './batch-slots.ts';

test('BATCH_SLOT_PREFIX matches the persisted literal', () => {
  // Persisted in IndexedDB slots — changing this breaks every saved batch.
  assert.equal(BATCH_SLOT_PREFIX, '__batch__:');
});

test('isBatchSlot: true only for strings carrying the prefix', () => {
  assert.equal(isBatchSlot('__batch__:VIP name badges'), true);
  assert.equal(isBatchSlot('__batch__:'), true);
  // Single-tool slots are `<toolId>:<timestamp>` — never the batch prefix.
  assert.equal(isBatchSlot('qr-code:1719900000000'), false);
  assert.equal(isBatchSlot('user/keep'), false);
  assert.equal(isBatchSlot(''), false);
  // Prefix must be at the start, not merely present.
  assert.equal(isBatchSlot('x__batch__:y'), false);
});

test('isBatchSlot: non-string inputs are never batch slots', () => {
  assert.equal(isBatchSlot(undefined), false);
  assert.equal(isBatchSlot(null), false);
  assert.equal(isBatchSlot(42), false);
  assert.equal(isBatchSlot({}), false);
});

test('batchSlot builds a slot from a session label', () => {
  assert.equal(batchSlot('VIP name badges'), '__batch__:VIP name badges');
  assert.equal(batchSlot(''), '__batch__:');
});

test('batchSlotName strips the prefix back off a slot', () => {
  assert.equal(batchSlotName('__batch__:VIP name badges'), 'VIP name badges');
  assert.equal(batchSlotName('__batch__:'), '');
});

test('batchSlot and batchSlotName round-trip', () => {
  const label = 'Q3 event pack';
  assert.equal(batchSlotName(batchSlot(label)), label);
  assert.equal(isBatchSlot(batchSlot(label)), true);
});
