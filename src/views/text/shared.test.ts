// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_OPERATIONS } from '../../../../../engine/src/text-operations.ts';
import { findActions, suggestedActions, needsText } from './shared.ts';

test('action search understands task words across labels, help and synonyms', () => {
  for (const [query, expected] of [
    ['upper case', 'upper'],
    ['text art', 'ascii'],
    ['remove spaces', 'trim'],
    ['JSON schema', 'schema'],
    ['system logs', 'logs'],
  ] as const) {
    assert.ok(
      findActions(TEXT_OPERATIONS, query).some((op) => op.id === expected),
      query
    );
  }
  assert.deepEqual(findActions(TEXT_OPERATIONS, 'not-a-real-operation 98765'), []);
});
test('contextual actions support empty, prose, code and log entry points', () => {
  assert.equal(suggestedActions('')[0], 'ascii');
  for (const id of suggestedActions(''))
    assert.equal(needsText(TEXT_OPERATIONS.find((op) => op.id === id)!), false);
  assert.equal(suggestedActions('{"count":1}')[0], 'json');
  assert.equal(suggestedActions('const answer = 42;', 'typescript')[0], 'format');
  assert.equal(suggestedActions('INFO ready', 'auto', 'system.log')[0], 'logs');
  assert.equal(new Set(suggestedActions('name = "Lolly"', 'toml')).size, 3);
  const ranked = findActions(TEXT_OPERATIONS, '', ['logs', 'redact']);
  assert.deepEqual(
    ranked.slice(0, 2).map((op) => op.id),
    ['logs', 'redact']
  );
});
