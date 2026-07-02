/**
 * Unit tests for the user-upload downscaling math.
 *
 * Only computeResize() is covered here — it's the pure piece. The full
 * downscaleRaster() path touches createImageBitmap + canvas and is browser-only
 * (no real canvas in node/jsdom), so it's verified manually in the web shell.
 *
 * Run with: node --test tests/image-resize.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeResize, MAX_LONGEST_EDGE } from '../shells/web/src/bridge/image-resize.ts';

test('computeResize: downscales a large landscape image to the longest edge', () => {
  const srcW = MAX_LONGEST_EDGE + 2000;       // wider than the cap → must shrink
  const r = computeResize(srcW, srcW * 0.75);
  assert.equal(r.width, MAX_LONGEST_EDGE);
  assert.equal(r.height, Math.round(srcW * 0.75 * (MAX_LONGEST_EDGE / srcW)));
  assert.equal(r.scale, MAX_LONGEST_EDGE / srcW);
});

test('computeResize: downscales a large portrait image (height is the longest edge)', () => {
  const srcH = MAX_LONGEST_EDGE + 2000;       // taller than the cap → must shrink
  const r = computeResize(srcH * 0.75, srcH);
  assert.equal(r.width, Math.round(srcH * 0.75 * (MAX_LONGEST_EDGE / srcH)));
  assert.equal(r.height, MAX_LONGEST_EDGE);
});

test('computeResize: a square caps both sides at the longest edge', () => {
  const side = MAX_LONGEST_EDGE + 1000;       // larger than the cap on both sides
  const r = computeResize(side, side);
  assert.equal(r.width, MAX_LONGEST_EDGE);
  assert.equal(r.height, MAX_LONGEST_EDGE);
});

test('computeResize: never upscales an already-small image', () => {
  const r = computeResize(800, 600);
  assert.deepEqual(r, { width: 800, height: 600, scale: 1 });
});

test('computeResize: an image exactly at the cap is left untouched', () => {
  const r = computeResize(MAX_LONGEST_EDGE, 1080);
  assert.equal(r.scale, 1);
  assert.equal(r.width, MAX_LONGEST_EDGE);
  assert.equal(r.height, 1080);
});

test('computeResize: outputs are always integers and within the cap', () => {
  const r = computeResize(4001, 2999);
  assert.ok(Number.isInteger(r.width), 'width is integer');
  assert.ok(Number.isInteger(r.height), 'height is integer');
  assert.ok(Math.max(r.width, r.height) <= MAX_LONGEST_EDGE, 'longest edge within cap');
});

test('computeResize: respects a custom max', () => {
  const r = computeResize(2000, 1000, 1000);
  assert.equal(r.width, 1000);
  assert.equal(r.height, 500);
});

test('computeResize: degrades gracefully on zero/invalid dimensions', () => {
  assert.deepEqual(computeResize(0, 0), { width: 0, height: 0, scale: 1 });
});
