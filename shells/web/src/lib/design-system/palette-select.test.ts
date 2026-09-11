// SPDX-License-Identifier: MPL-2.0
/**
 * The Colours pane's selection model (plan 182 section 5.5, M1b).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/palette-select.test.ts"
 *
 * `lib/brand-editor.ts` has no DOM harness, so every selection RULE lives in the
 * pure module and is pinned here: the range that spans two groups, the marquee
 * that touches two grids, Shift after Cmd, and the one that is a property of the
 * design rather than of the code - "Select all" cannot reach an inherited colour,
 * because reading order never lists one.
 *
 * jsdom-free: the model takes rectangles, not elements.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createSelection } from './palette-select.ts';
import type { SelectRect, SelectTile } from './palette-select.ts';

/** Two groups, five tiles each, in the pane's reading order. */
const PRIMARY = ['p1', 'p2', 'p3', 'p4', 'p5'];
const CUSTOM = ['c1', 'c2', 'c3', 'c4', 'c5'];
const OWN = [...PRIMARY, ...CUSTOM];

const sel = (order: string[] = OWN) => createSelection({ order: () => order });

/** A tile row laid out left to right at one vertical band. */
function row(keys: string[], top: number): SelectTile[] {
  return keys.map((key, i) => ({
    key,
    rect: { left: i * 50, top, right: i * 50 + 44, bottom: top + 44 },
  }));
}
const rect = (left: number, top: number, right: number, bottom: number): SelectRect =>
  ({ left, top, right, bottom });

test('toggle adds then removes, and moves the anchor each time', () => {
  const s = sel();
  s.toggle('p2');
  assert.deepEqual(s.keys(), ['p2']);
  assert.equal(s.anchor(), 'p2');
  s.toggle('p2');
  assert.deepEqual(s.keys(), []);
  assert.equal(s.anchor(), 'p2');
});

test('a range spans group boundaries in reading order', () => {
  const s = sel();
  s.set(['p4']);
  s.range('p4', 'c2');
  assert.deepEqual(s.keys(), ['p4', 'p5', 'c1', 'c2']);
});

test('a range reads the same drawn backwards', () => {
  const s = sel();
  s.range('c2', 'p4');
  assert.deepEqual(s.keys(), ['p4', 'p5', 'c1', 'c2']);
});

test('Shift after Cmd keeps what Cmd collected', () => {
  const s = sel();
  s.toggle('p1');
  s.toggle('c4'); // anchor is now c4
  s.range('c4', 'c1');
  assert.deepEqual(s.keys(), ['p1', 'c1', 'c2', 'c3', 'c4']);
});

test('a second Shift from the same anchor redraws the span, it does not pile up', () => {
  const s = sel();
  s.toggle('p1');
  s.range('p1', 'p4');
  assert.deepEqual(s.keys(), ['p1', 'p2', 'p3', 'p4']);
  s.range('p1', 'p2');
  assert.deepEqual(s.keys(), ['p1', 'p2'], 'the first span is gone, the Cmd base stays');
});

test('keys() come back in reading order however they were collected', () => {
  const s = sel();
  s.toggle('c3');
  s.toggle('p2');
  s.toggle('c1');
  assert.deepEqual(s.keys(), ['p2', 'c1', 'c3']);
});

test('a marquee takes every tile it touches, across two groups', () => {
  const s = sel();
  const tiles = [...row(PRIMARY, 0), ...row(CUSTOM, 100)];
  // A tall band down the second and third columns, from the primary row into custom.
  const touched = s.marquee(rect(60, 10, 130, 130), tiles);
  assert.deepEqual(touched, ['p2', 'p3', 'c2', 'c3']);
  assert.deepEqual(s.keys(), ['p2', 'p3', 'c2', 'c3']);
});

test('a folded group passes no tiles, so a marquee over it takes nothing', () => {
  const s = sel();
  // Custom is folded: the caller hands over the open group's tiles only.
  const tiles = row(PRIMARY, 0);
  s.marquee(rect(0, 0, 500, 500), tiles);
  assert.deepEqual(s.keys(), PRIMARY);
});

test('a zero-area marquee (a plain click on empty space) touches nothing', () => {
  const s = sel();
  const tiles = row(PRIMARY, 0);
  assert.deepEqual(s.marquee(rect(10, 10, 10, 10), tiles), []);
  assert.deepEqual(s.keys(), []);
});

test('a marquee over a base unions with it (a Shift-held drag)', () => {
  const s = sel();
  const tiles = row(PRIMARY, 0);
  s.marquee(rect(0, 0, 60, 44), tiles, ['c5']);
  assert.deepEqual(s.keys(), ['p1', 'p2', 'c5']);
});

test('Select all takes every own tile, and can never reach an inherited one', () => {
  // The pane's order() lists own tiles only - the starter group is not in it,
  // so there is no filter to forget.
  const s = sel();
  s.all();
  assert.deepEqual(s.keys(), OWN);
  assert.equal(s.has('starter-neutral-1'), false);
});

test('a group Select all adds to the selection rather than replacing it', () => {
  const s = sel();
  s.toggle('p1');
  s.allInGroup(CUSTOM);
  assert.deepEqual(s.keys(), ['p1', ...CUSTOM]);
});

test('arrows walk reading order and clamp at both ends', () => {
  const s = sel();
  assert.deepEqual(s.keyboard('ArrowRight', 'p5', { columns: 5 }), { focus: 'c1', handled: true, cleared: false });
  assert.equal(s.keyboard('ArrowLeft', 'p1', { columns: 5 }).focus, 'p1');
  assert.equal(s.keyboard('ArrowRight', 'c5', { columns: 5 }).focus, 'c5');
  assert.equal(s.size(), 0, 'moving the focus alone selects nothing');
});

test('up and down step a row at a time, at the grid width the caller measured', () => {
  const s = sel();
  assert.equal(s.keyboard('ArrowDown', 'p2', { columns: 5 }).focus, 'c2');
  assert.equal(s.keyboard('ArrowUp', 'c3', { columns: 5 }).focus, 'p3');
});

test('an arrow with no focused tile enters the grid at the near end', () => {
  const s = sel();
  assert.equal(s.keyboard('ArrowRight', null).focus, 'p1');
  assert.equal(s.keyboard('ArrowLeft', null).focus, 'c5');
});

test('Shift-arrow extends from the anchor', () => {
  const s = sel();
  s.toggle('p2');
  const r = s.keyboard('ArrowRight', 'p2', { shift: true, columns: 5 });
  assert.equal(r.focus, 'p3');
  assert.deepEqual(s.keys(), ['p2', 'p3']);
  s.keyboard('ArrowRight', 'p3', { shift: true, columns: 5 });
  assert.deepEqual(s.keys(), ['p2', 'p3', 'p4']);
});

test('Space toggles the focused tile and keeps the focus put', () => {
  const s = sel();
  const r = s.keyboard(' ', 'p3');
  assert.deepEqual(r, { focus: 'p3', handled: true, cleared: false });
  assert.deepEqual(s.keys(), ['p3']);
  s.keyboard(' ', 'p3');
  assert.deepEqual(s.keys(), []);
});

test('Cmd-A selects every own tile', () => {
  const s = sel();
  assert.equal(s.keyboard('a', 'p1', { meta: true }).handled, true);
  assert.deepEqual(s.keys(), OWN);
  assert.equal(s.keyboard('a', 'p1', {}).handled, false, 'bare a is the channel keys, not ours');
});

test('Escape clears, and reports that it did NOTHING when there was nothing to clear', () => {
  // The studio's Escape ladder (popover, review, then the selection) only works
  // if an Escape this model did not consume falls through.
  const s = sel();
  assert.deepEqual(s.keyboard('Escape', 'p1'), { focus: 'p1', handled: false, cleared: false });
  s.toggle('p1');
  assert.deepEqual(s.keyboard('Escape', 'p1'), { focus: 'p1', handled: true, cleared: true });
  assert.equal(s.size(), 0);
});

test('an unhandled key is reported as such, with the focus untouched', () => {
  const s = sel();
  assert.deepEqual(s.keyboard('l', 'p1'), { focus: 'p1', handled: false, cleared: false });
});

test('prune drops keys a repaint took away', () => {
  let order = [...OWN];
  const s = createSelection({ order: () => order });
  s.set(['p2', 'c1']);
  order = order.filter(k => k !== 'c1');
  s.prune();
  assert.deepEqual(s.keys(), ['p2']);
});

test('onChange fires on a real change and stays quiet on a no-op', () => {
  const s = sel();
  let n = 0;
  const off = s.onChange(() => { n++; });
  s.toggle('p1');
  assert.equal(n, 1);
  s.clear();
  assert.equal(n, 2);
  s.clear(); // already empty
  assert.equal(n, 2);
  s.allInGroup([]); // nothing to add
  assert.equal(n, 2);
  off();
  s.toggle('p1');
  assert.equal(n, 2, 'unsubscribed');
});
