// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFps } from './frame-fps.ts';

test('computeFps: frames over a window, one decimal', () => {
  assert.equal(computeFps(30, 1000), 30);       // 30 frames in 1s
  assert.equal(computeFps(45, 1500), 30);       // 45 in 1.5s
  assert.equal(computeFps(16, 1000), 16);
  assert.equal(computeFps(1, 3000), 0.3);       // rounds to 1 dp
});

test('computeFps: a non-positive window is 0, never Infinity/NaN', () => {
  assert.equal(computeFps(10, 0), 0);
  assert.equal(computeFps(10, -5), 0);
  assert.equal(computeFps(0, 1000), 0);
});
