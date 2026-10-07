// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanvasCommentsCapability, CommentListResult } from './canvas-comments.ts';

// A host written before the optional review features still satisfies the seam, so an
// older adapter keeps compiling and a caller has to check for each optional member.
const minimal: CanvasCommentsCapability = {
  list: async () => ({ enabled: true, permissions: { userId: 'u1', create: true, editOwn: true, resolveAny: false, deleteAny: false }, threads: [] }),
  create: async () => { throw new Error('unused'); },
  command: async () => { throw new Error('unused'); },
  loadDraft: async () => '',
  saveDraft: async () => {},
};

test('the optional review features are absent on a minimal host', async () => {
  const listed: CommentListResult = await minimal.list();
  assert.equal(listed.features, undefined);
  assert.equal(listed.reads, undefined);
  for (const key of ['get', 'suggest', 'markRead', 'link', 'pendingTarget', 'onTarget', 'changes'] as const) assert.equal(minimal[key], undefined, key);
});
