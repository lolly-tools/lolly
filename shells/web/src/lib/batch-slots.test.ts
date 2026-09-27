// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isHiddenSlot } from './batch-slots.ts';
import { CHECKPOINTS_KEY } from './design-system/studio-state.ts';

test('brand import checkpoints stay out of saved-work lists without hiding designs', () => {
  assert.equal(isHiddenSlot(CHECKPOINTS_KEY), true);
  assert.equal(isHiddenSlot('design:journey-announcement'), false);
  assert.equal(isHiddenSlot('__batch__:journey'), false);
  assert.equal(isHiddenSlot(undefined), false);
});

test('a creation discarded by Leave without saving is hidden from every session list and carries its discard time', async () => {
  const { DISCARDED_SLOT_PREFIX, discardedAt, discardedSlot, isDiscardedSlot, isTrashedSlot } = await import('./batch-slots.ts');
  const at = Date.parse('2026-09-27T09:30:00Z');
  const slot = discardedSlot('qr-code:1b2c', at);
  assert.ok(slot.startsWith(DISCARDED_SLOT_PREFIX) && slot.endsWith(':qr-code:1b2c'));
  assert.equal(isHiddenSlot(slot), true);
  assert.equal(isDiscardedSlot(slot), true);
  assert.equal(isTrashedSlot(slot), false, 'a discard is not the trash');
  assert.equal(discardedAt(slot), at);
  assert.equal(discardedAt('qr-code:1b2c'), null);
  assert.equal(discardedAt(`${DISCARDED_SLOT_PREFIX}not-a-time:x`), null);
});
