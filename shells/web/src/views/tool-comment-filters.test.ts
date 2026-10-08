// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CommentMessage, CommentThread } from '@lolly-tools/core/canvas-review-v1';
import type { CommentListResult } from '../lib/canvas-comments.ts';
import { createCommentReads, matchesFilter, mountCommentFilters, paintUnreadCount, threadInvolves, type CommentFilter } from './tool-comment-filters.ts';

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 7, 10, minutes)).toISOString();
const permissions = { userId: 'me', create: true, editOwn: true, resolveAny: false, deleteAny: false };
function thread(id: string, messages: Array<Partial<CommentMessage> & { authorId: string; mentions?: Array<{ id: string; name: string }> }>, extra: Partial<CommentThread> = {}): CommentThread {
  const full = messages.map((value, index): CommentMessage => ({ id: `${id}-${index}`, authorName: value.authorId, body: 'text', createdAt: at(30), ...value }));
  return { id, sessionId: 's', anchor: { kind: 'canvas', surface: 'page', x: 0, y: 0 }, authorId: full[0]!.authorId, authorName: full[0]!.authorName,
    revision: 1, createdAt: at(0), updatedAt: at(0), messages: full, ...extra };
}
const result = (extra: Partial<CommentListResult>): CommentListResult => ({ enabled: true, permissions, threads: [], ...extra });

test('unread follows the read mark, the read floor and waiting notices, ignores own and deleted messages, and is off without host support', () => {
  const reads = createCommentReads();
  const threads = {
    fresh: thread('fresh', [{ authorId: 'ana', createdAt: at(30) }]),
    seen: thread('seen', [{ authorId: 'ana', createdAt: at(20) }]),
    old: thread('old', [{ authorId: 'ana', createdAt: at(5) }]),
    noticed: thread('noticed', [{ authorId: 'ana', createdAt: at(5) }]),
    own: thread('own', [{ authorId: 'me', createdAt: at(30) }]),
    removed: thread('removed', [{ authorId: 'ana', createdAt: at(30), deletedAt: at(31) }]),
  };
  reads.apply(result({ readFloor: at(10), reads: { seen: at(25) }, notices: ['noticed'], features: { reads: true } }), true);
  assert.equal(reads.enabled, true);
  const unread = () => Object.values(threads).filter(value => reads.unread(value, 'me')).map(value => value.id);
  assert.deepEqual(unread(), ['fresh', 'noticed']);
  reads.markLocal(threads.fresh); reads.markLocal(threads.noticed);
  assert.deepEqual(unread(), [], 'marks made in this tab apply at once');
  reads.apply(result({ readFloor: at(10), reads: { seen: at(25) }, notices: ['noticed'], features: { reads: true } }), true);
  assert.deepEqual(unread(), [], 'a list that has not caught up yet does not undo them');
  reads.forget(['fresh']); assert.deepEqual(unread(), ['fresh'], 'a refused mark is forgotten');
  reads.apply(result({ readFloor: at(10), reads: { seen: at(25), fresh: at(30), noticed: at(30) }, features: { reads: true } }), true);
  reads.markLocal(threads.fresh);
  reads.apply(result({ readFloor: at(10), reads: { seen: at(25), fresh: at(30), noticed: at(30) }, notices: ['fresh'], features: { reads: true } }), true);
  assert.deepEqual(unread(), ['fresh'], 'once the host caught up, a new notice counts again');
  for (const [extra, canMark] of [[{ readFloor: at(10) }, true], [{ features: { reads: true } }, true], [{ readFloor: at(10), features: { reads: true } }, false]] as const) {
    reads.apply(result({ ...extra, notices: ['noticed'] }), canMark);
    assert.equal(reads.enabled, false); assert.deepEqual(unread(), []);
  }
});

test('involving me means I started the thread, wrote in it or am mentioned in a message still there', () => {
  assert.equal(threadInvolves(thread('a', [{ authorId: 'me' }]), 'me'), true);
  assert.equal(threadInvolves(thread('b', [{ authorId: 'ana' }, { authorId: 'me' }]), 'me'), true);
  assert.equal(threadInvolves(thread('c', [{ authorId: 'ana', mentions: [{ id: 'me', name: 'Me' }] }]), 'me'), true);
  assert.equal(threadInvolves(thread('d', [{ authorId: 'ana', mentions: [{ id: 'me', name: 'Me' }], deletedAt: at(40) }]), 'me'), false);
  assert.equal(threadInvolves(thread('e', [{ authorId: 'ana' }]), 'me'), false);
  assert.equal(threadInvolves(thread('f', [{ authorId: '' }]), ''), false, 'no signed-in person is involved in nothing');
  const reads = createCommentReads(), open = thread('o', [{ authorId: 'ana' }]), closed = thread('r', [{ authorId: 'ana' }], { resolvedAt: at(50) });
  const pick = (filter: CommentFilter) => [open, closed].filter(value => matchesFilter(value, filter, 'me', reads)).map(value => value.id);
  assert.deepEqual([pick('open'), pick('resolved'), pick('unread'), pick('involving')], [['o'], ['r'], [], []]);
});

test('the filter control is one radio group with counts, arrow keys and a hidden Unread segment', () => {
  const dom = new JSDOM('<body></body>');
  try {
    const changes: CommentFilter[] = [];
    const filters = mountCommentFilters(dom.window.document, value => { changes.push(value); });
    dom.window.document.body.append(filters.element);
    filters.paint({ open: 3, resolved: 1, unread: 2, involving: 0 }, false);
    const segments = () => [...filters.element.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    assert.deepEqual(segments().map(segment => [segment.textContent, segment.hidden, segment.getAttribute('aria-checked'), segment.tabIndex]),
      [['Open threads · 3', false, 'true', 0], ['Resolved threads · 1', false, 'false', -1], ['Unread · 2', true, 'false', -1], ['Involving me · 0', false, 'false', -1]]);
    const press = (key: string) => filters.element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    press('ArrowLeft'); assert.equal(filters.value, 'involving', 'arrows wrap and skip hidden segments');
    press('Home'); assert.equal(filters.value, 'open');
    filters.paint({ open: 3, resolved: 1, unread: 2, involving: 0 }, true);
    press('End'); press('ArrowUp'); assert.equal(filters.value, 'unread');
    assert.deepEqual(changes, ['involving', 'open', 'involving', 'unread']);
    filters.choose('unread'); assert.equal(changes.length, 4, 'choosing the current filter changes nothing');
  } finally { dom.window.close(); }
});

test('the Comments button names its unread count and shows a badge only when something is unread', () => {
  const dom = new JSDOM('<button><span class="visually-hidden">Comments</span></button>');
  try {
    const open = dom.window.document.querySelector('button')!;
    paintUnreadCount(open, 3);
    assert.equal(open.getAttribute('aria-label'), 'Comments, 3 unread'); assert.equal(open.querySelector('.collab-comments-badge')!.textContent, '3');
    assert.equal(open.querySelector('.collab-comments-badge')!.getAttribute('aria-hidden'), 'true');
    paintUnreadCount(open, 120); assert.equal(open.querySelector('.collab-comments-badge')!.textContent, '99+');
    paintUnreadCount(open, 0);
    assert.equal(open.getAttribute('aria-label'), 'Comments'); assert.equal(open.querySelector('.collab-comments-badge'), null);
    assert.equal(open.querySelector('.visually-hidden')!.textContent, 'Comments');
  } finally { dom.window.close(); }
});
