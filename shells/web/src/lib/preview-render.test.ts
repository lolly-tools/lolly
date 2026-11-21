// SPDX-License-Identifier: MPL-2.0
/**
 * A saved session drawn again on idle time (plan 373) is drawn at the size it was
 * made at, so a session saved at a custom shape keeps that shape in its picture.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/preview-render.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sessionRenderSize } from './preview-render.ts';

test('the saved width, height and unit are kept; a physical size gets a resolution that fills a 2x tile', () => {
  assert.deepEqual(sessionRenderSize({}), {}, "no size saved: the tool's own");
  assert.deepEqual(sessionRenderSize({ outWidth: 1080 }), {}, 'one side alone keeps the tool size, as an export does');
  assert.deepEqual(sessionRenderSize({ outWidth: 1080, outHeight: 1920, unit: 'px' }), { width: 1080, height: 1920 });
  // A4 portrait: the longest side, 11.69 in, at 124 dpi is 1450 pixels.
  assert.deepEqual(sessionRenderSize({ outWidth: 210, outHeight: 297, unit: 'mm', dpi: 300 }), { width: 210, height: 297, unit: 'mm', dpi: 124 });
  // A business card is small: drawn at its own 300 dpi, never above it.
  assert.deepEqual(sessionRenderSize({ outWidth: 85, outHeight: 55, unit: 'mm' }), { width: 85, height: 55, unit: 'mm', dpi: 300 });
  assert.deepEqual(sessionRenderSize({ outWidth: 85, outHeight: 55, unit: 'mm', dpi: 150 }), { width: 85, height: 55, unit: 'mm', dpi: 150 });
  // A banner metres long still gets a readable picture.
  assert.equal(sessionRenderSize({ outWidth: 300, outHeight: 100, unit: 'cm' }).dpi, 72);
  assert.deepEqual(sessionRenderSize({ outWidth: 800, outHeight: 600, unit: 'furlong' }), { width: 800, height: 600 }, 'an unknown unit reads as pixels');
});

test('the idle redraw passes the session size to the render', () => {
  const source = readFileSync(new URL('./preview-render.ts', import.meta.url), 'utf8');
  assert.match(source, /\.\.\.sessionRenderSize\(row\)/);
  assert.match(source, /unit: opts\.unit/);
});
