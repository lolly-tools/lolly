// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { collabHistoryPolicy } from './collab-history.ts';

test('Work history is durable and writers may restore shared points', () => {
  assert.deepEqual(collabHistoryPolicy({ track: 'work', role: 'writer', host: false }), {
    scope: 'shared', durability: 'durable', canRestore: true, canSaveCopy: true,
  });
});

test('observers can copy Work history but cannot restore it', () => {
  assert.deepEqual(collabHistoryPolicy({ track: 'work', role: 'observer', host: false }), {
    scope: 'shared', durability: 'durable', canRestore: false, canSaveCopy: true,
  });
});

test('P2P guests keep memory history until Save a copy', () => {
  assert.deepEqual(collabHistoryPolicy({ track: 'p2p', role: 'writer', host: false }), {
    scope: 'memory', durability: 'session', canRestore: false, canSaveCopy: true,
  });
});
