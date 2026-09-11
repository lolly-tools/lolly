// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure screencap crop arithmetic.
 * Run directly:  node --test shells/web/src/views/screen-capture-crop.test.ts
 *
 * DOM-free - the interactive overlay + export-size push in screen-capture-control.ts
 * are verified manually in real Chromium (jsdom has no layout/rasteriser). These lock
 * down the essential math: crop composition in shot-space and fraction→pixel size.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeCropRect, cropPixelSize } from './screen-capture-crop.ts';

const FULL = { x: 0, y: 0, w: 100, h: 100 };

test('cropPixelSize: full crop is the whole shot', () => {
  assert.deepEqual(cropPixelSize(FULL, 1920, 1080), { width: 1920, height: 1080 });
});

test('cropPixelSize: half crop is half the pixels', () => {
  assert.deepEqual(cropPixelSize({ x: 25, y: 25, w: 50, h: 50 }, 1920, 1080), { width: 960, height: 540 });
});

test('cropPixelSize: null for a dimensionless shot (never NaN/0 to the export bar)', () => {
  assert.equal(cropPixelSize(FULL, 0, 0), null);
  assert.equal(cropPixelSize(FULL, 1920, 0), null);
});

test('cropPixelSize: rounds to a whole pixel and never below 1', () => {
  // 0.01% of 1920 = 0.192px → rounds toward 0, but the floor keeps it at 1.
  assert.deepEqual(cropPixelSize({ x: 0, y: 0, w: 0.01, h: 0.01 }, 1920, 1080), { width: 1, height: 1 });
});

test('composeCropRect: a drag over the full window maps 1:1 into shot-space', () => {
  // Drag the middle half of the canvas while the crop is the whole shot.
  const next = composeCropRect(FULL, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 2000, 1000);
  assert.deepEqual(next, { x: 25, y: 25, w: 50, h: 50 });
});

test('composeCropRect: composes against the current crop (no drift on re-drag)', () => {
  // Already cropped to the right half; drag the left half of THAT window.
  const cur = { x: 50, y: 0, w: 50, h: 100 };
  const next = composeCropRect(cur, { x: 0, y: 0, w: 0.5, h: 1 }, 2000, 1000)!;
  // 0..0.5 of a window that spans 50..100% of the shot → 50..75%.
  assert.deepEqual(next, { x: 50, y: 0, w: 25, h: 100 });
});

test('composeCropRect: a composed crop is idempotent through cropPixelSize', () => {
  // Two successive drags must land on exactly the same pixels as the equivalent single drag.
  const one = composeCropRect(FULL, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 1920, 1080)!;
  const twoA = composeCropRect(FULL, { x: 0.5, y: 0, w: 0.5, h: 1 }, 1920, 1080)!;
  const twoB = composeCropRect(twoA, { x: 0, y: 0.5, w: 1, h: 0.5 }, 1920, 1080)!;
  assert.deepEqual(cropPixelSize(one, 1920, 1080), cropPixelSize(twoB, 1920, 1080));
});

test('composeCropRect: a tap (sub-1% drag) is rejected', () => {
  assert.equal(composeCropRect(FULL, { x: 0.5, y: 0.5, w: 0.005, h: 0.005 }, 1920, 1080), null);
});

test('composeCropRect: dimensionless shot yields null', () => {
  assert.equal(composeCropRect(FULL, { x: 0, y: 0, w: 0.5, h: 0.5 }, 0, 0), null);
});

test('composeCropRect: snaps to whole natural pixels so the size is stable', () => {
  // An awkward fraction of a 1000px-wide shot snaps its width to a whole-pixel percentage.
  const next = composeCropRect(FULL, { x: 0, y: 0, w: 0.3337, h: 1 }, 1000, 1000)!;
  // 0.3337 * 1000 = 333.7px → snaps to 334px → 33.4%.
  assert.equal(Math.round(next.w / 100 * 1000), 334);
  assert.deepEqual(cropPixelSize(next, 1000, 1000), { width: 334, height: 1000 });
});
