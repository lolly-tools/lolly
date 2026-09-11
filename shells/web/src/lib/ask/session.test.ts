// SPDX-License-Identifier: MPL-2.0
/**
 * The Ask transcript store (plans/103 M0). Pins append/read/reset and the
 * last-question lookup the seed-dedupe relies on.
 *
 * Run directly:  node --test shells/web/src/lib/ask/session.test.ts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { askSession, pushTurn, lastAskedQuestion, resetAskSession } from './session.ts';
import type { AskAnswer } from './answer.ts';

const emptyAnswer: AskAnswer = { intent: 'docs', primary: null, related: [], toolHits: [] };

beforeEach(() => resetAskSession());

test('starts empty; pushes accumulate in order', () => {
  assert.deepEqual(askSession(), []);
  pushTurn({ role: 'user', q: 'how do I export' });
  pushTurn({ role: 'answer', answer: emptyAnswer });
  const turns = askSession();
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.role, 'user');
  assert.equal(turns[1]!.role, 'answer');
});

test('lastAskedQuestion returns the most recent user turn, ignoring answers', () => {
  assert.equal(lastAskedQuestion(), null);
  pushTurn({ role: 'user', q: 'first' });
  pushTurn({ role: 'answer', answer: emptyAnswer });
  pushTurn({ role: 'user', q: 'second' });
  pushTurn({ role: 'answer', answer: emptyAnswer });
  assert.equal(lastAskedQuestion(), 'second');
});

test('reset clears the transcript', () => {
  pushTurn({ role: 'user', q: 'x' });
  resetAskSession();
  assert.deepEqual(askSession(), []);
  assert.equal(lastAskedQuestion(), null);
});
