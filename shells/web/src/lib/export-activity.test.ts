// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordExportActivity } from './export-activity.ts';

test('temporary participation never captures thumbnails or writes download history', async () => {
  let captured = 0, written = 0;
  await recordExportActivity({ allowed: false, entry: { toolId: 'design', label: 'Private', filename: 'private', format: 'png', query: 'private=true' },
    capture: async () => { captured++; return null; } }, async () => { written++; });
  assert.equal(captured, 0); assert.equal(written, 0);
});

test('download receipts freeze the creation association before async capture, and recording failures are harmless', async () => {
  const entry = { toolId: 'design', label: 'Launch', filename: 'launch', format: 'png', query: 'message=original', slot: 'design:one' };
  let saved: unknown;
  await recordExportActivity({ allowed: true, entry, capture: async () => { entry.slot = 'design:two'; entry.query = 'message=changed'; return null; } }, async row => { saved = row; });
  assert.equal((saved as typeof entry).slot, 'design:one'); assert.equal((saved as typeof entry).query, 'message=original');
  await assert.doesNotReject(recordExportActivity({ allowed: true, entry, capture: async () => { throw new Error('capture failed'); } }));
});
