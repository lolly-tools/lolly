// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revealCanvasPeer } from './peer-view.ts';
import type { PresenceState } from '../../lib/collab-presence.ts';

test('a peer jump resolves the current slide and multi-selection without a model write', () => {
  const boxes = [{ id: 'page', kind: 'frame' }, { id: 'title', kind: 'text', frame: 'page' }, { id: 'body', kind: 'text', frame: 'page' }, { id: 'elsewhere', kind: 'text', frame: 'other' }];
  const original = JSON.stringify(boxes), focused: string[] = [], selections: string[][] = [];
  const fc = { disposed: false, blockId: 'boxes', cfg: { kindField: 'kind' }, frameCfg: { frameKind: 'frame', frameField: 'frame' },
    select: { getBoxes: () => boxes, idOf: (box: Record<string, unknown> | undefined) => String(box?.id), indexOfId: (rows: Record<string, unknown>[], id: string | undefined) => rows.findIndex(row => row.id === id) },
    selectionPort: { set: (ids: readonly string[]) => { selections.push([...ids]); } }, document: { focusArtboard: (id: string) => { focused.push(id); } }, textEdit: { commitTextEdit() {} } };
  const state: PresenceState = { userId: 'peer', name: 'Peer', color: '#123456', surface: { id: 'page', space: 'unit' }, selection: ['title', 'body', 'deleted', 'elsewhere', 'title'] };
  assert.equal(revealCanvasPeer(fc, state), true);
  assert.deepEqual(selections, [['title', 'body']]); assert.deepEqual(focused, ['page']); assert.equal(JSON.stringify(boxes), original);
  assert.equal(revealCanvasPeer(fc, { ...state, selection: [] }), true); assert.deepEqual(selections.at(-1), ['page']);
  assert.equal(revealCanvasPeer(fc, { ...state, surface: { id: 'deleted-page', space: 'unit' } }), false);
  fc.disposed = true; assert.equal(revealCanvasPeer(fc, state), false); assert.equal(selections.length, 2);
});
