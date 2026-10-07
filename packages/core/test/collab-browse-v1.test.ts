// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWSE_SELECTION_LIMIT, pointerVisible, readBrowsePointer, readBrowsePresence } from '../src/collab-browse-v1.ts';

test('a frame without a project is refused; everything optional is dropped when invalid', () => {
  assert.equal(readBrowsePresence(null), null);
  assert.equal(readBrowsePresence({ folderId: 'f1' }), null);
  assert.equal(readBrowsePresence({ projectId: 'has space' }), null);
  assert.deepEqual(readBrowsePresence({
    projectId: 'prj_1', folderId: 'bad id!', open: { kind: 'tool', id: 'x' }, pointer: { itemId: 'a', fx: 2, fy: 0 },
    selection: 'a', drag: { itemIds: [] }, following: 7, agent: { activity: 'reading' }, extra: true,
  }), { v: 1, projectId: 'prj_1', folderId: null });
});

test('a full frame keeps its known fields', () => {
  assert.deepEqual(readBrowsePresence({
    v: 9, projectId: 'prj_1', folderId: 'fld_2',
    open: { kind: 'session', id: 'ses_3', mode: 'edit' },
    pointer: { itemId: 'ses_3', fx: 0.25, fy: 1 },
    selection: ['ses_3', 'ses_3', 'fil_4'],
    drag: { itemIds: ['fil_4'], overFolderId: 'fld_5' },
    following: 'usr_9',
    agent: { sponsorId: 'usr_9', activity: '  Reading 12 files\u0007 ' },
  }), {
    v: 1, projectId: 'prj_1', folderId: 'fld_2',
    open: { kind: 'session', id: 'ses_3', mode: 'edit' },
    pointer: { itemId: 'ses_3', fx: 0.25, fy: 1 },
    selection: ['ses_3', 'fil_4'],
    drag: { itemIds: ['fil_4'], overFolderId: 'fld_5' },
    following: 'usr_9',
    agent: { sponsorId: 'usr_9', activity: 'Reading 12 files' },
  });
  const open = readBrowsePresence({ projectId: 'p', open: { kind: 'file', id: 'f', mode: 'delete' } })!;
  assert.equal(open.open?.mode, 'view', 'an unknown mode reads as view');
});

test('selection is capped', () => {
  const many = Array.from({ length: 500 }, (_, i) => `s${i}`);
  assert.equal(readBrowsePresence({ projectId: 'p', selection: many })!.selection!.length, BROWSE_SELECTION_LIMIT);
});

test('pointers: tile fractions, gaps and areas', () => {
  assert.deepEqual(readBrowsePointer({ between: null, side: 'after' }), { between: null, side: 'after' });
  assert.deepEqual(readBrowsePointer({ between: 'a', side: 'before' }), { between: 'a', side: 'before' });
  assert.equal(readBrowsePointer({ between: 'a', side: 'over' }), undefined);
  assert.deepEqual(readBrowsePointer({ area: 'sidebar' }), { area: 'sidebar' });
  assert.equal(readBrowsePointer({ area: 'window' }), undefined);
  assert.equal(readBrowsePointer({ itemId: 'a', fx: Number.NaN, fy: 0 }), undefined);
});

test('a pointer is drawn only when its item is in the receiver layout', () => {
  const visible = new Set(['a', 'b']);
  assert.ok(pointerVisible({ itemId: 'a', fx: 0, fy: 0 }, visible));
  assert.ok(!pointerVisible({ itemId: 'z', fx: 0, fy: 0 }, visible));
  assert.ok(pointerVisible({ between: null, side: 'after' }, visible));
  assert.ok(!pointerVisible({ between: 'z', side: 'before' }, visible));
  assert.ok(pointerVisible({ area: 'header' }, new Set()));
});
