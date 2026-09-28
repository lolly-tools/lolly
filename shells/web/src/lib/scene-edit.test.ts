// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retimeSceneMembers } from './scene-edit.ts';
import { rippleOverlays } from '../views/timeline-math.ts';
import { TAKE_TIMING } from '../views/timeline-config.ts';

const fields = { idField: 'id', kindField: 'kind', frameKind: 'frame', frameField: 'frame', startField: 'start' };
const rows = [
  { id: 'a', kind: 'frame', start: 0, dur: 3, lane: 'seq' },
  { id: 'b', kind: 'frame', start: 3, dur: 4, lane: 'seq' },
  { id: 'title', frame: 'b', start: 3.5, dur: 2, kf: 't0_x0*t500_x40' },
  { id: 'late', frame: 'a', start: 4, dur: 1 },
  { id: 'still', frame: 'a' },
  { id: 'bed', start: 0, dur: 7 },
];
test('scene reorder carries explicit members and retains local tracks, scenery and global sound', () => {
  const next = rows.map(row => row.id === 'a' ? { ...row, start: 4 } : row.id === 'b' ? { ...row, start: 0 } : row);
  const moved = retimeSceneMembers(rows, next, fields);
  assert.equal(moved.find(row => row.id === 'title')!.start, .5);
  assert.equal(moved.find(row => row.id === 'title')!.kf, rows[2]!.kf);
  assert.equal(moved.find(row => row.id === 'late')!.start, 8, 'membership wins over which scene the child happens to overlap');
  assert.equal(moved.find(row => row.id === 'still')!.start, undefined);
  assert.equal(moved.find(row => row.id === 'bed')!.start, 0);
  assert.deepEqual(retimeSceneMembers(rows, moved, fields), moved, 'the already-applied ripple is not applied twice');
});
test('scene edits keep explicit child retimes and remove members of a deleted scene in the same transaction', () => {
  const next = rows.filter(row => row.id !== 'a').map(row => row.id === 'b' ? { ...row, start: 0 } : row.id === 'title' ? { ...row, start: 1 } : row);
  const moved = retimeSceneMembers(rows, next, fields);
  assert.equal(moved.find(row => row.id === 'title')!.start, 1);
  assert.ok(!moved.some(row => row.frame === 'a'));
  assert.deepEqual(rows[0], { id: 'a', kind: 'frame', start: 0, dur: 3, lane: 'seq' });
});
test('the timeline ripple follows declared artboards before looking for temporal anchors', () => {
  const cfg = { ...TAKE_TIMING, startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed', enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs', muteField: 'mute', laneField: 'lane', idField: 'id', frameField: 'frame', frameKindField: 'kind', frameKind: 'frame' };
  const next = rows.map(row => row.id === 'a' ? { ...row, start: 4 } : row.id === 'b' ? { ...row, start: 0 } : row);
  const moved = rippleOverlays(rows, next, cfg);
  assert.equal(moved.find(row => row.id === 'late')!.start, 8);
  assert.equal(moved.find(row => row.id === 'title')!.start, .5);
  assert.equal(moved.find(row => row.id === 'bed')!.start, 0);
});
