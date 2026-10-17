// SPDX-License-Identifier: MPL-2.0
/**
 * lib/sync-merge.ts (plans/138 B2): the three-way decision per record, as a table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classify, classifyForced, type BaseEntry, type IndexEntry } from './sync-merge.ts';

const live = (hash: string): IndexEntry => ({ hash, object: hash, size: 1, updatedAt: '2026-10-01T00:00:00.000Z' });
const tomb = (hash: string): IndexEntry => ({ hash, size: 0, updatedAt: '2026-10-02T00:00:00.000Z', deletedAt: '2026-10-02T00:00:00.000Z' });
const base = (remote: string | null, local: string | null = remote): BaseEntry => ({ remote, local });
const act = (input: Parameters<typeof classify>[0]): string => {
  const d = classify(input);
  return d.editMetDelete ? `${d.action}:${d.editMetDelete}` : d.action;
};

test('one side changed: take it; neither changed: keep', () => {
  assert.equal(act({ here: 'a', base: base('a'), store: live('a'), hasBase: true }), 'keep');
  assert.equal(act({ here: 'b', base: base('a'), store: live('a'), hasBase: true }), 'push');
  assert.equal(act({ here: 'a', base: base('a'), store: live('b'), hasBase: true }), 'pull');
  assert.equal(act({ here: null, base: base('a'), store: live('a'), hasBase: true }), 'tombstone');
  assert.equal(act({ here: 'a', base: base('a'), store: tomb('a'), hasBase: true }), 'drop');
  // A record pruned from the index reads as deleted for a device whose base lists the record.
  assert.equal(act({ here: 'a', base: base('a'), store: undefined, hasBase: true }), 'drop');
});

test('this device’s own representation is the base for "changed here"', () => {
  // The store says r, this device stored the same record as l (it restamped a field).
  assert.equal(act({ here: 'l', base: base('r', 'l'), store: live('r'), hasBase: true }), 'keep');
  assert.equal(act({ here: 'l2', base: base('r', 'l'), store: live('r'), hasBase: true }), 'push');
});

test('both changed: same content keeps, different content resolves, edit beats delete', () => {
  assert.equal(act({ here: 'c', base: base('a'), store: live('c'), hasBase: true }), 'keep');
  assert.equal(act({ here: 'b', base: base('a'), store: live('c'), hasBase: true }), 'resolve');
  assert.equal(act({ here: 'b', base: base('a'), store: tomb('a'), hasBase: true }), 'push:here');
  assert.equal(act({ here: null, base: base('a'), store: live('c'), hasBase: true }), 'pull:store');
  assert.equal(act({ here: null, base: base('a'), store: tomb('a'), hasBase: true }), 'keep');
});

test('a first sync merges: nothing is removed, a record on both sides with different content resolves', () => {
  assert.equal(act({ here: 'a', base: undefined, store: undefined, hasBase: false }), 'push');
  assert.equal(act({ here: null, base: undefined, store: live('a'), hasBase: false }), 'pull');
  assert.equal(act({ here: 'a', base: undefined, store: live('a'), hasBase: false }), 'keep');
  assert.equal(act({ here: 'a', base: undefined, store: live('b'), hasBase: false }), 'resolve');
  // A base from before is ignored without hasBase.
  assert.equal(act({ here: 'a', base: base('a'), store: undefined, hasBase: false }), 'push');
});

test('the exact content someone deleted does not come back from a device without a say', () => {
  assert.equal(act({ here: 'a', base: undefined, store: tomb('a'), hasBase: false }), 'drop');
  assert.equal(act({ here: 'a', base: undefined, store: tomb('a'), hasBase: true }), 'drop');
  // Different content from the deleted copy is an edit, and is kept.
  assert.equal(act({ here: 'b', base: undefined, store: tomb('a'), hasBase: false }), 'push');
});

test('a record that is never deleted reads an absent copy as unchanged', () => {
  assert.equal(act({ here: null, base: base('a'), store: live('a'), hasBase: true, neverDeleted: true }), 'keep');
  assert.equal(act({ here: null, base: base('a'), store: live('b'), hasBase: true, neverDeleted: true }), 'pull');
  assert.equal(act({ here: null, base: undefined, store: live('b'), hasBase: false, neverDeleted: true }), 'pull');
});

test('forced: this device becomes the store, with tombstones for the rest', () => {
  assert.equal(classifyForced('a', live('b')).action, 'push');
  assert.equal(classifyForced('a', live('a')).action, 'keep');
  assert.equal(classifyForced(null, live('b')).action, 'tombstone');
  assert.equal(classifyForced(null, tomb('b')).action, 'keep');
  assert.equal(classifyForced('a', tomb('a')).action, 'push');
});
