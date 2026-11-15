// SPDX-License-Identifier: MPL-2.0
/**
 * The instrument popup's place (views/music-studio/instrument-popup.ts): beside its
 * origin, to the right where there is room, else to the left, else over the point clicked, always
 * inside the screen, and growing from the point clicked.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/instrument-popup.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePopup } from './instrument-popup.ts';

const view = { width: 1440, height: 900 };
const size = { width: 392, height: 640 };

test('a lane head on the left opens the popup to its right, its top by the head', () => {
  const at = placePopup({ x: 288, y: 500, rect: { left: 12, top: 460, right: 288, bottom: 540 } }, size, view);
  assert.equal(at.side, 'right');
  assert.equal(at.left, 300);
  assert.equal(at.top, 244, 'kept inside the screen: 900 less the margin and the height');
  assert.deepEqual([at.originX, at.originY], [-12, 256], 'it grows from the head\'s edge');
});

test('a section near the right edge opens it to the left of the click', () => {
  const at = placePopup({ x: 1300, y: 300, rect: { left: 1296, top: 280, right: 1304, bottom: 340 } }, size, view);
  assert.equal(at.side, 'left');
  assert.equal(at.left, 1296 - 12 - 392);
  assert.equal(at.top, 244, 'a tall popup is lifted to stay inside the screen');
});

test('with no room either side it sits over the click, inside the screen', () => {
  const narrow = { width: 700, height: 600 };
  const at = placePopup({ x: 350, y: 100, rect: { left: 340, top: 80, right: 360, bottom: 120 } }, { width: 392, height: 700 }, narrow);
  assert.equal(at.side, 'over');
  assert.ok(at.left >= 16 && at.left + 392 <= narrow.width - 16);
  assert.equal(at.top, 16, 'a popup taller than the screen starts at the margin');
});

test('what the popup is about, on the timeline: every run of its kind of section, or the whole lane', async () => {
  const { barRuns } = await import('./instrument-popup.ts');
  const sections = ['intro', 'verse', 'verse', 'drop', 'drop', 'verse', 'drop', 'rest'];
  assert.deepEqual(barRuns(sections, 'drop'), [[3, 5], [6, 7]]);
  assert.deepEqual(barRuns(sections, 'verse'), [[1, 3], [5, 6]]);
  assert.deepEqual(barRuns(sections, null), [[0, 8]], 'opened from the lane head: the whole lane');
  assert.deepEqual(barRuns(sections, 'bridge'), []);
});
