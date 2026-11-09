// SPDX-License-Identifier: MPL-2.0
/**
 * lib/stage-hud-clearance.ts - the canvas is fitted below the folded phone HUD and
 * beside the unfolded column.
 *
 * The rects are the ones WebKit measured for the Filter tool on an iPhone 15 viewport
 * (393 x 659): the stage starts at 112, the controls sheet covers it down to 329.5 and
 * the Export pill reserves the last 56.5px. Before this module, the unfolded column's
 * full height was reserved above the canvas, the fit fell to its 40px floor and the
 * canvas sat behind the Export pill until a zoom moved the canvas.
 *
 * Run directly:  node --test shells/web/src/lib/stage-hud-clearance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudClearance, type ClearanceBox } from './stage-hud-clearance.ts';

const BAND: ClearanceBox = { left: 0, top: 329.5, right: 393, bottom: 602.5 };
const SWIRL: ClearanceBox = { left: 321, top: 350, right: 361, bottom: 394 };
const COLUMN: ClearanceBox = { left: 311, top: 350, right: 361, bottom: 629 };

/** fitCanvas's arithmetic for a square 1080px canvas: a 32px gutter, a 40px floor. */
function fittedSide(clear: { top: number; left: number; right: number }): number {
  const availW = Math.max(40, BAND.right - BAND.left - clear.left - clear.right - 32);
  const availH = Math.max(40, BAND.bottom - BAND.top - clear.top - 32);
  return 1080 * Math.min(1, availW / 1080, availH / 1080);
}

test('the folded swirl is cleared from above, as before', () => {
  assert.deepEqual(hudClearance(SWIRL, BAND), { top: 64.5, left: 0, right: 0 });
});

test('the unfolded column is cleared from the side it stands on', () => {
  const clear = hudClearance(COLUMN, BAND);
  assert.deepEqual(clear, { top: 0, left: 0, right: 82 });
  // The canvas keeps the band's whole height and stops short of the column.
  assert.equal(Math.round(fittedSide(clear)), 241);
  const oldTopBand = { top: COLUMN.bottom - BAND.top, left: 0, right: 0 };
  assert.equal(fittedSide(oldTopBand), 40, 'the old top band left only the 40px floor');
});

test('a column against the left edge is cleared on the left', () => {
  const left: ClearanceBox = { left: 32, top: 350, right: 82, bottom: 629 };
  assert.deepEqual(hudClearance(left, BAND), { top: 0, left: 82, right: 0 });
});

test('a short band clears even the swirl from the side', () => {
  const short: ClearanceBox = { ...BAND, bottom: 410 };
  assert.deepEqual(hudClearance(SWIRL, short), { top: 0, left: 0, right: 72 });
});

test('nothing is reserved without a HUD in the band', () => {
  const none = { top: 0, left: 0, right: 0 };
  assert.deepEqual(hudClearance(null, BAND), none);
  assert.deepEqual(hudClearance(undefined, BAND), none);
  assert.deepEqual(hudClearance({ left: 0, top: 0, right: 0, bottom: 0 }, BAND), none, 'a hidden HUD measures 0 x 0');
  assert.deepEqual(hudClearance({ left: 321, top: 200, right: 361, bottom: 300 }, BAND), none, 'under the sheet');
  assert.deepEqual(hudClearance(COLUMN, { ...BAND, bottom: BAND.top }), none, 'no band left to share');
});
