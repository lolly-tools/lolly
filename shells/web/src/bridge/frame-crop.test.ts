// SPDX-License-Identifier: MPL-2.0
// The cover-crop behind a framed camera take (RecordOpts.frame, v1.165).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverCrop, validFrame } from './frame-crop.ts';

test('a wide camera into a tall frame keeps the full height and trims the sides, centred', () => {
  // 1280x720 webcam into a 1080x1920 story: the crop is 405 wide, full height.
  const c = coverCrop(1280, 720, 1080, 1920);
  assert.equal(c.sh, 720);
  assert.ok(Math.abs(c.sw - 405) < 0.01, `crop width ${c.sw}`);
  assert.ok(Math.abs(c.sx - (1280 - 405) / 2) < 0.01, 'centred horizontally');
  assert.equal(c.sy, 0);
});

test('a tall camera into a wide frame keeps the full width and trims top and bottom', () => {
  const c = coverCrop(720, 1280, 1920, 1080);
  assert.equal(c.sw, 720);
  assert.ok(Math.abs(c.sh - 405) < 0.01);
  assert.equal(c.sx, 0);
  assert.ok(Math.abs(c.sy - (1280 - 405) / 2) < 0.01, 'centred vertically');
});

test('a matching aspect is the whole picture, and the crop never depends on target scale', () => {
  assert.deepEqual(coverCrop(1920, 1080, 1920, 1080), { sx: 0, sy: 0, sw: 1920, sh: 1080 });
  assert.deepEqual(coverCrop(1920, 1080, 960, 540), { sx: 0, sy: 0, sw: 1920, sh: 1080 });
});

test('degenerate inputs never produce a negative or NaN rect', () => {
  const c = coverCrop(0, 0, 1080, 1920);
  assert.deepEqual(c, { sx: 0, sy: 0, sw: 0, sh: 0 });
});

test('validFrame accepts two positive integers within the canvas cap and nothing else', () => {
  assert.deepEqual(validFrame({ width: 1080, height: 1920 }), { width: 1080, height: 1920 });
  assert.deepEqual(validFrame({ width: 1080.4, height: 1919.6 }), { width: 1080, height: 1920 });
  assert.equal(validFrame({ width: 0, height: 1920 }), null);
  assert.equal(validFrame({ width: 9000, height: 1920 }), null);
  assert.equal(validFrame({ width: 'a', height: 1920 }), null);
  assert.equal(validFrame(undefined), null);
});
