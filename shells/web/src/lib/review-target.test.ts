// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_TARGET_TTL_MS, onReviewTarget, setReviewTarget, takeReviewTarget } from './review-target.ts';

test('a target is taken once, for its own session only', () => {
  assert.equal(setReviewTarget('sess-a', 'thread_1'), true);
  assert.equal(takeReviewTarget('sess-b'), undefined);
  assert.equal(takeReviewTarget('sess-a'), 'thread_1');
  assert.equal(takeReviewTarget('sess-a'), undefined);
});

test('a newer target for the same session replaces the older one', () => {
  setReviewTarget('sess-a', 'thread_1');
  setReviewTarget('sess-a', 'thread_2');
  assert.equal(takeReviewTarget('sess-a'), 'thread_2');
});

test('ids that fail validation hold nothing and notify nobody', () => {
  const seen: string[] = [];
  const off = onReviewTarget((_s, t) => seen.push(t));
  try {
    for (const bad of ['', 'a b', 'x'.repeat(81), '../etc', 'id?x=1', '<b>']) assert.equal(setReviewTarget('sess-a', bad), false, bad);
    assert.equal(setReviewTarget('', 'thread_1'), false);
    assert.equal(takeReviewTarget('sess-a'), undefined);
    assert.deepEqual(seen, []);
  } finally { off(); }
});

test('a target expires after two minutes', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  setReviewTarget('sess-a', 'thread_1');
  t.mock.timers.tick(REVIEW_TARGET_TTL_MS - 1);
  assert.equal(takeReviewTarget('sess-a'), 'thread_1');
  setReviewTarget('sess-a', 'thread_1');
  t.mock.timers.tick(REVIEW_TARGET_TTL_MS);
  assert.equal(takeReviewTarget('sess-a'), undefined);
});

test('setting again starts a fresh window', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 2_000_000 });
  setReviewTarget('sess-a', 'thread_1');
  t.mock.timers.tick(REVIEW_TARGET_TTL_MS - 1_000);
  setReviewTarget('sess-a', 'thread_1');
  t.mock.timers.tick(REVIEW_TARGET_TTL_MS - 1_000);
  assert.equal(takeReviewTarget('sess-a'), 'thread_1');
});

test('listeners hear every target until they unsubscribe, and one failing listener does not stop the rest', () => {
  const seen: [string, string][] = [];
  const offBad = onReviewTarget(() => { throw new Error('boom'); });
  const off = onReviewTarget((s, id) => seen.push([s, id]));
  try {
    setReviewTarget('sess-a', 'thread_1');
    off();
    setReviewTarget('sess-a', 'thread_2');
    assert.deepEqual(seen, [['sess-a', 'thread_1']]);
  } finally { offBad(); off(); }
  assert.equal(takeReviewTarget('sess-a'), 'thread_2');
});

test('a listener can take the target it is told about', () => {
  const taken: (string | undefined)[] = [];
  const off = onReviewTarget((s) => taken.push(takeReviewTarget(s)));
  try {
    setReviewTarget('sess-c', 'thread_9');
    assert.deepEqual(taken, ['thread_9']);
    assert.equal(takeReviewTarget('sess-c'), undefined);
  } finally { off(); }
});

