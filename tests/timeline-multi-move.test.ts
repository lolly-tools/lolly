// SPDX-License-Identifier: MPL-2.0
/**
 * timeline multi-move - marquee-selected batch moves in the timeline strip.
 * `moveOverlays` (delta-shift a set of overlays), `moveSeqClips` (block-move a set of
 * magnetic clips), `groupDropIndex` (the multi-drag insertion index). Run with: npm test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  moveOverlays, moveSeqClips, groupDropIndex, moveSeqClip, staggerOverlays,
  boxTiming, MAX_TIME_S, type Box, type TimeCfg,
} from '../shells/web/src/views/timeline-math.ts';

const cfg: TimeCfg = {
  idField: 'id',
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
  enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
  muteField: 'mute', laneField: 'lane',
};

/** Five gapless seq clips A..E, 2s each (starts 0,2,4,6,8). */
const seqRow = (): Box[] =>
  ['A', 'B', 'C', 'D', 'E'].map((id, i) => ({ id, lane: 'seq', start: i * 2, dur: 2 }));
/** Seq ids in play order (by start). */
const seqOrder = (boxes: Box[]): string[] =>
  boxes.filter((b) => b.lane === 'seq').map((b) => ({ id: String(b.id), s: boxTiming(b, cfg).start ?? 0 }))
    .sort((a, b) => a.s - b.s).map((x) => x.id);
const startOf = (boxes: Box[], id: string): number =>
  boxTiming(boxes.find((b) => b.id === id)!, cfg).start ?? -1;

// ---- moveOverlays ----------------------------------------------------------

test('moveOverlays shifts a set by one delta, preserving relative offsets', () => {
  const boxes: Box[] = [
    { id: 'o1', lane: '', start: 2, dur: 1 },
    { id: 'o2', lane: '', start: 5, dur: 1 },
    { id: 'o3', lane: '', start: 10, dur: 1 },
  ];
  const out = moveOverlays(boxes, cfg, ['o1', 'o2', 'o3'], 3);
  assert.deepEqual([startOf(out, 'o1'), startOf(out, 'o2'), startOf(out, 'o3')], [5, 8, 13]);
});

test('moveOverlays clamps the GROUP so the earliest stays >= 0 (shape preserved)', () => {
  const boxes: Box[] = [
    { id: 'o1', lane: '', start: 2, dur: 1 },
    { id: 'o2', lane: '', start: 5, dur: 1 },
  ];
  const out = moveOverlays(boxes, cfg, ['o1', 'o2'], -5); // -5 would push o1 to -3; clamp delta to -2
  assert.deepEqual([startOf(out, 'o1'), startOf(out, 'o2')], [0, 3]);
});

test('moveOverlays ignores seq-lane and unselected members', () => {
  const boxes: Box[] = [
    { id: 's', lane: 'seq', start: 0, dur: 2 },
    { id: 'o1', lane: '', start: 4, dur: 1 },
    { id: 'o2', lane: '', start: 6, dur: 1 },
  ];
  const out = moveOverlays(boxes, cfg, ['s', 'o1'], 2);
  assert.equal(startOf(out, 's'), 0);   // seq unchanged (pack-derived)
  assert.equal(startOf(out, 'o1'), 6);  // moved
  assert.equal(startOf(out, 'o2'), 6);  // not selected, unchanged
});

// ---- groupDropIndex --------------------------------------------------------

test('groupDropIndex counts non-moving clips past the pointer midpoint', () => {
  // moving B,D. remainder A,C,E (mids 1,5,9). pointer at 5 -> past A and C -> index 2.
  assert.equal(groupDropIndex(seqRow(), cfg, 5, ['B', 'D']), 2);
  assert.equal(groupDropIndex(seqRow(), cfg, 0, ['B', 'D']), 0);   // before everything
  assert.equal(groupDropIndex(seqRow(), cfg, 100, ['B', 'D']), 3); // clamped to remainder length
});

// ---- moveSeqClips ----------------------------------------------------------

test('moveSeqClips block-moves a non-contiguous selection to the front, keeping internal order', () => {
  const out = moveSeqClips(seqRow(), cfg, ['B', 'D'], 0);
  assert.deepEqual(seqOrder(out), ['B', 'D', 'A', 'C', 'E']);
  // gapless repack: starts 0,2,4,6,8 in the new order
  assert.deepEqual(['B', 'D', 'A', 'C', 'E'].map((id) => startOf(out, id)), [0, 2, 4, 6, 8]);
});

test('moveSeqClips inserts the block at an interior index (against the remainder)', () => {
  // remainder A,C,E; insert B,D at index 2 -> A,C,B,D,E
  const out = moveSeqClips(seqRow(), cfg, ['B', 'D'], 2);
  assert.deepEqual(seqOrder(out), ['A', 'C', 'B', 'D', 'E']);
});

test('moveSeqClips with one moving clip defers to moveSeqClip', () => {
  const a = moveSeqClips(seqRow(), cfg, ['C'], 0);
  const b = moveSeqClip(seqRow(), cfg, 'C', 0);
  assert.deepEqual(seqOrder(a), seqOrder(b));
  assert.deepEqual(seqOrder(a), ['C', 'A', 'B', 'D', 'E']);
});

test('moveSeqClips never mutates its input', () => {
  const src = seqRow();
  const snap = JSON.stringify(src);
  moveSeqClips(src, cfg, ['B', 'D'], 0);
  assert.equal(JSON.stringify(src), snap);
});

// ---- staggerOverlays (plans/175 WP-C) ---------------------------------------

test('staggerOverlays deals an even gap, anchored on the earliest start', () => {
  const boxes: Box[] = [
    { id: 'o1', lane: '', start: 2, dur: 1 },
    { id: 'o2', lane: '', start: 2.3, dur: 1 },
    { id: 'o3', lane: '', start: 9, dur: 1 },
  ];
  const out = staggerOverlays(boxes, cfg, ['o1', 'o2', 'o3'], 0.25);
  assert.deepEqual([startOf(out, 'o1'), startOf(out, 'o2'), startOf(out, 'o3')], [2, 2.25, 2.5]);
});

test('staggerOverlays keeps the CURRENT start order, breaking ties by row order', () => {
  const boxes: Box[] = [
    { id: 'late', lane: '', start: 8, dur: 1 },
    { id: 'tieB', lane: '', start: 3, dur: 1 },
    { id: 'tieA', lane: '', start: 3, dur: 1 },
    { id: 'first', lane: '', start: 1, dur: 1 },
  ];
  const out = staggerOverlays(boxes, cfg, ['late', 'tieA', 'tieB', 'first'], 0.5);
  // Dealt order: first(1) → tieB(3, earlier row) → tieA(3) → late(8).
  assert.deepEqual(
    [startOf(out, 'first'), startOf(out, 'tieB'), startOf(out, 'tieA'), startOf(out, 'late')],
    [1, 1.5, 2, 2.5]);
});

test('staggerOverlays ignores seq-lane and untimed members; under two eligible is a no-op', () => {
  const boxes: Box[] = [
    { id: 's1', lane: 'seq', start: 0, dur: 2 },
    { id: 's2', lane: 'seq', start: 2, dur: 2 },
    { id: 'o1', lane: '', start: 4, dur: 1 },
    { id: 'o2', lane: '', start: 4, dur: 1 },
    { id: 'scenery', lane: '' },
  ];
  const out = staggerOverlays(boxes, cfg, ['s1', 's2', 'o1', 'o2', 'scenery'], 1);
  assert.deepEqual([startOf(out, 's1'), startOf(out, 's2')], [0, 2], 'the magnetic row is never dealt');
  assert.equal(out.find((b) => b.id === 'scenery')!.start, undefined, 'scenery stays untimed');
  assert.deepEqual([startOf(out, 'o1'), startOf(out, 'o2')], [4, 5], 'the two overlays are dealt');
  // One eligible overlay → identity per box.
  const solo = staggerOverlays(boxes, cfg, ['o1', 's1'], 1);
  assert.deepEqual(solo.map((b) => b === boxes[solo.indexOf(b)]), [true, true, true, true, true]);
});

test('staggerOverlays preserves per-box identity on an already-dealt board (no undo step)', () => {
  const boxes: Box[] = [
    { id: 'o1', lane: '', start: 1, dur: 1 },
    { id: 'o2', lane: '', start: 1.5, dur: 1 },
  ];
  const out = staggerOverlays(boxes, cfg, ['o1', 'o2'], 0.5);
  assert.equal(out[0], boxes[0]);
  assert.equal(out[1], boxes[1]);
});

test('staggerOverlays clamps: junk gaps read as 0, and no start passes MAX_TIME_S', () => {
  const boxes: Box[] = [
    { id: 'o1', lane: '', start: 5, dur: 1 },
    { id: 'o2', lane: '', start: 3, dur: 1 },
  ];
  const zero = staggerOverlays(boxes, cfg, ['o1', 'o2'], Number.NaN);
  assert.deepEqual([startOf(zero, 'o2'), startOf(zero, 'o1')], [3, 3], 'NaN gap deals a zero gap');
  const huge = staggerOverlays(boxes, cfg, ['o1', 'o2'], 1e9);
  assert.equal(startOf(huge, 'o1'), MAX_TIME_S, 'the ceiling holds');
});
