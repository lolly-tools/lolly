// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for `planFolderRefs` (batch-export.ts) - the render plan a folder export
 * walks: which sessions land in the zip and at which relative path. It is exported
 * precisely so it can be inspected without running a render, and the Projects view's
 * format step reads the SAME plan, so a drift here silently changes what a user gets in
 * their zip.
 *
 * Pure: it takes the folder array, reads no disk.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { planFolderRefs } from './batch-export.ts';
import type { Folder } from './folders.ts';

function folder(id: string, name: string, parentId: string | null, refs: string[] = []): Folder {
  const now = new Date().toISOString();
  return { id, name, parentId, items: refs.map(ref => ({ type: 'session', ref })), createdAt: now, updatedAt: now };
}

test('sessions directly in the folder sit at the zip root', () => {
  const a = folder('a', 'Client work', null, ['s1', 's2']);
  assert.deepEqual(planFolderRefs(a, [a]), [
    { ref: 's1', relDir: '' },
    { ref: 's2', relDir: '' },
  ]);
});

test('a descendant folder contributes its slugged path, nested', () => {
  const a = folder('a', 'Root', null, ['s1']);
  const b = folder('b', 'Q3 Launch', 'a', ['s2']);
  const c = folder('c', 'Social Cuts', 'b', ['s3']);
  assert.deepEqual(planFolderRefs(a, [a, b, c]), [
    { ref: 's1', relDir: '' },
    { ref: 's2', relDir: 'q3-launch' },
    { ref: 's3', relDir: 'q3-launch/social-cuts' },
  ]);
});

test('the walk is breadth-first, so every parent path is set before its children', () => {
  const a = folder('a', 'Root', null, ['s1']);
  const b = folder('b', 'B', 'a', ['s2']);
  const c = folder('c', 'C', 'a', ['s3']);
  const d = folder('d', 'D', 'b', ['s4']);
  assert.deepEqual(planFolderRefs(a, [a, b, c, d]).map(p => p.ref), ['s1', 's2', 's3', 's4']);
});

test('single membership: the first folder in the walk claims a duplicated ref', () => {
  const a = folder('a', 'Root', null, ['s1']);
  const b = folder('b', 'Child', 'a', ['s1', 's2']);
  assert.deepEqual(planFolderRefs(a, [a, b]), [
    { ref: 's1', relDir: '' },
    { ref: 's2', relDir: 'child' },
  ]);
});

test('a sibling branch outside the folder is not planned', () => {
  const a = folder('a', 'Mine', null, ['s1']);
  const other = folder('z', 'Theirs', null, ['s9']);
  assert.deepEqual(planFolderRefs(a, [a, other]).map(p => p.ref), ['s1']);
});

test('a malformed parent cycle terminates instead of hanging', () => {
  const a = folder('a', 'A', 'b', ['s1']);
  const b = folder('b', 'B', 'a', ['s2']);
  const plan = planFolderRefs(a, [a, b]);
  assert.deepEqual(plan.map(p => p.ref), ['s1', 's2']);
});

test('an empty folder plans nothing', () => {
  const a = folder('a', 'Empty', null);
  assert.deepEqual(planFolderRefs(a, [a]), []);
});
