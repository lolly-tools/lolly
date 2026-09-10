// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { historyComparisonSource } from './history-comparison.ts';
import type { RevisionEntry } from '../bridge/revision-history.ts';
const entry: RevisionEntry = { id: 'retained-id', slot: 'design:one', documentId: 'one', parentId: null, toolId: 'design', label: 'Before', at: '2026-09-10T10:00:00Z', reason: 'save', hash: 'fixture', bytes: 20, assetRefs: [] };
test('a missing retained revision is unavailable and is never replaced by current state', async () => {
  const reads: string[] = [];
  await assert.rejects(historyComparisonSource({ read: async id => { reads.push(id); return null; } }, entry), /no longer available/);
  assert.deepEqual(reads, ['retained-id']);
});
