// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMENT_MENTION_LIMIT, COMMENT_THREAD_BYTES, readCommentAnchor, readCommentThread } from '../src/canvas-review-v1.ts';
const now = new Date().toISOString();
const message = { id: 'msg', authorId: 'alice', authorName: 'Alice', body: 'Please align this', createdAt: now };
const thread = { id: 'thread', sessionId: 'session', anchor: { kind: 'canvas', surface: 'page', x: 4, y: 5 }, authorId: 'alice', authorName: 'Alice', revision: 1, createdAt: now, updatedAt: now, messages: [message] };
const withMentions = (mentions: unknown) => readCommentThread({ ...thread, messages: [{ ...message, mentions }] })?.messages[0];
test('object anchors are bounded local coordinates and canvas anchors use document space', () => {
  const object = { kind: 'object', collection: 'boxes', objectId: 'image', surface: 'page', x: .25, y: .8 };
  assert.deepEqual(readCommentAnchor(object), object);
  assert.equal(readCommentAnchor({ ...object, x: 2 }), null);
  assert.equal(readCommentAnchor({ ...object, x: Infinity }), null);
  assert.equal(readCommentAnchor({ ...object, objectId: '__proto__' }), null);
  assert.ok(readCommentAnchor({ kind: 'canvas', surface: 'page', x: -500, y: 200 }));
});
test('object anchors keep the document-space pin point only when it is finite and within 1e6', () => {
  const object = { kind: 'object', collection: 'boxes', objectId: 'image', surface: 'page', x: .25, y: .8 };
  assert.deepEqual(readCommentAnchor({ ...object, at: { x: -120.5, y: 1e6 } }), { ...object, at: { x: -120.5, y: 1e6 } });
  assert.deepEqual(readCommentAnchor({ ...object, at: { x: 3, y: 4, z: 5 } }), { ...object, at: { x: 3, y: 4 } }, 'at is rebuilt');
  for (const at of [{ x: 1e6 + 1, y: 0 }, { x: 0, y: -1e6 - 1 }, { x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: '1', y: 2 }, { x: 1 }, [1, 2], null, 'here']) {
    const anchor = readCommentAnchor({ ...object, at });
    assert.deepEqual(anchor, object, `invalid at ${JSON.stringify(at)} is omitted, never a reason to reject`);
    assert.equal(Object.hasOwn(anchor!, 'at'), false);
  }
  assert.deepEqual(readCommentAnchor({ kind: 'canvas', surface: 'page', x: 4, y: 5, at: { x: 1, y: 2 } }), { kind: 'canvas', surface: 'page', x: 4, y: 5 }, 'canvas anchors never carry at');
  const kept = readCommentThread({ ...thread, anchor: { ...object, at: { x: 10, y: 20 } } });
  assert.deepEqual(kept?.anchor, { ...object, at: { x: 10, y: 20 } });
});
test('review records reject oversized or duplicate messages and retain author attribution', () => {
  assert.deepEqual(readCommentThread(thread), thread);
  assert.equal(readCommentThread({ ...thread, messages: [message, message] }), null);
  assert.equal(readCommentThread({ ...thread, messages: [{ ...message, body: 'x'.repeat(4001) }] }), null);
});
test('a payload from before mentions and pin points reads back unchanged', () => {
  const object = { kind: 'object', collection: 'boxes', objectId: 'image', surface: 'page', x: .5, y: .5 };
  const old = { ...thread, anchor: object, resolvedAt: now, resolvedBy: 'bob', messages: [message, { ...message, id: 'edit', editedAt: now }, { ...message, id: 'gone', body: '', deletedAt: now }] };
  const read = readCommentThread(old);
  assert.deepEqual(read, old);
  assert.equal(read!.messages.some(entry => Object.hasOwn(entry, 'mentions')), false);
  assert.equal(Object.hasOwn(read!.anchor, 'at'), false);
});
test('mentions are rebuilt as id and name, with invalid entries dropped rather than rejecting the thread', () => {
  const kept = withMentions([{ id: 'bob', name: 'Bob' }, { id: 'carol', name: 'Carol', email: 'carol@example.com', role: 'owner' }]);
  assert.deepEqual(kept?.mentions, [{ id: 'bob', name: 'Bob' }, { id: 'carol', name: 'Carol' }]);
  const dropped = withMentions([
    null, 'bob', ['bob', 'Bob'], { id: '', name: 'Empty id' }, { id: '__proto__', name: 'Proto' }, { id: 'tab\tid', name: 'Control' },
    { id: 'x'.repeat(257), name: 'Long id' }, { id: 7, name: 'Number id' }, { id: 'dan', name: '' }, { id: 'erin', name: 'n'.repeat(257) },
    { id: 'fay', name: 42 }, { id: 'gus' }, { id: 'hal', name: 'n'.repeat(256) },
  ]);
  assert.deepEqual(dropped?.mentions, [{ id: 'hal', name: 'n'.repeat(256) }], 'only the valid entry survives');
  assert.deepEqual(withMentions([{ id: 'bob', name: 'Bob' }, { id: 'bob', name: 'Robert' }, { id: 'carol', name: 'Carol' }])?.mentions,
    [{ id: 'bob', name: 'Bob' }, { id: 'carol', name: 'Carol' }], 'the first entry for a person wins');
});
test('mentions are capped at the limit and omitted when none survive', () => {
  assert.equal(COMMENT_MENTION_LIMIT, 10);
  const many = Array.from({ length: 15 }, (_, index) => ({ id: `person-${index}`, name: `Person ${index}` }));
  assert.deepEqual(withMentions(many)?.mentions, many.slice(0, COMMENT_MENTION_LIMIT));
  const padded = [{ id: 'bad' }, ...many.slice(0, 3), { id: 'person-0', name: 'Again' }, ...many.slice(3)];
  assert.deepEqual(withMentions(padded)?.mentions, many.slice(0, COMMENT_MENTION_LIMIT), 'invalid and repeated entries do not use up the limit');
  for (const mentions of [[], [{ id: '' }], 'bob', { id: 'bob', name: 'Bob' }, null, 3]) {
    const read = withMentions(mentions);
    assert.ok(read, `mentions ${JSON.stringify(mentions)} never reject the thread`);
    assert.equal(Object.hasOwn(read, 'mentions'), false, `mentions ${JSON.stringify(mentions)} are omitted`);
  }
});
test('the 64,000 byte thread limit is unchanged and counts mentions', () => {
  const fill = (target: number) => {
    const messages = Array.from({ length: 16 }, (_, index) => ({ ...message, id: `m${index}`, body: 'x' }));
    const sized = { ...thread, messages };
    let length = JSON.stringify(sized).length;
    for (const entry of messages) {
      const grow = Math.min(3999, target - length);
      if (grow <= 0) break;
      entry.body += 'x'.repeat(grow);
      length += grow;
    }
    assert.equal(JSON.stringify(sized).length, target);
    return sized;
  };
  assert.equal(COMMENT_THREAD_BYTES, 64_000);
  assert.ok(readCommentThread(fill(COMMENT_THREAD_BYTES)));
  assert.equal(readCommentThread(fill(COMMENT_THREAD_BYTES + 1)), null);
  const near = fill(COMMENT_THREAD_BYTES - 20);
  const full = { ...near, messages: [{ ...near.messages[0]!, mentions: [{ id: 'bob', name: 'Bob' }] }, ...near.messages.slice(1)] };
  assert.ok(JSON.stringify(full).length > COMMENT_THREAD_BYTES);
  assert.equal(readCommentThread(full), null, 'mentions count toward the thread limit');
});
