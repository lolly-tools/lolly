// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCommentAnchor, readCommentThread } from './canvas-review-v1.ts';
test('object anchors are bounded local coordinates and canvas anchors use document space', () => {
  const object = { kind: 'object', collection: 'boxes', objectId: 'image', surface: 'page', x: .25, y: .8 };
  assert.deepEqual(readCommentAnchor(object), object);
  assert.equal(readCommentAnchor({ ...object, x: 2 }), null);
  assert.equal(readCommentAnchor({ ...object, x: Infinity }), null);
  assert.equal(readCommentAnchor({ ...object, objectId: '__proto__' }), null);
  assert.ok(readCommentAnchor({ kind: 'canvas', surface: 'page', x: -500, y: 200 }));
});
test('review records reject oversized or duplicate messages and retain author attribution', () => {
  const now = new Date().toISOString(), message = { id: 'msg', authorId: 'alice', authorName: 'Alice', body: 'Please align this', createdAt: now };
  const thread = { id: 'thread', sessionId: 'session', anchor: { kind: 'canvas', surface: 'page', x: 4, y: 5 }, authorId: 'alice', authorName: 'Alice', revision: 1, createdAt: now, updatedAt: now, messages: [message] };
  assert.deepEqual(readCommentThread(thread), thread);
  assert.equal(readCommentThread({ ...thread, messages: [message, message] }), null);
  assert.equal(readCommentThread({ ...thread, messages: [{ ...message, body: 'x'.repeat(4001) }] }), null);
});
