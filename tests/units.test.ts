/**
 * Unit-conversion contract tests for output dimensions.
 * Run with: node --test tests/units.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDimension, toInches, isPhysical, toPixels, toPoints, toCssPx, toCssLength, CSS_DPI,
} from '../engine/src/units.ts';

const close = (a: number, b: number, eps = 0.5): boolean => Math.abs(a - b) <= eps;

test('parseDimension: numbers are px', () => {
  assert.deepEqual(parseDimension(800), { value: 800, unit: 'px' });
  assert.equal(parseDimension(0), null);
  assert.equal(parseDimension(-5), null);
});

test('parseDimension: strings with/without units', () => {
  assert.deepEqual(parseDimension('210mm'), { value: 210, unit: 'mm' });
  assert.deepEqual(parseDimension('8.5in'), { value: 8.5, unit: 'in' });
  assert.deepEqual(parseDimension('595pt'), { value: 595, unit: 'pt' });
  assert.deepEqual(parseDimension('  1080 '), { value: 1080, unit: 'px' });   // default px
  assert.deepEqual(parseDimension('1080px'), { value: 1080, unit: 'px' });
});

test('parseDimension: respects a default unit + rejects junk', () => {
  assert.deepEqual(parseDimension('210', 'mm'), { value: 210, unit: 'mm' });
  assert.equal(parseDimension('wide'), null);
  assert.equal(parseDimension('10furlongs'), null); // unknown unit
  assert.equal(parseDimension(''), null);
  assert.equal(parseDimension(null), null);
});

test('toInches: A4 width', () => {
  assert.ok(close(toInches({ value: 210, unit: 'mm' }), 8.2677, 0.001));
  assert.ok(close(toInches({ value: 1, unit: 'in' }), 1, 0));
  assert.ok(close(toInches({ value: 96, unit: 'px' }), 1, 0)); // 96px = 1in (CSS)
  assert.ok(close(toInches({ value: 72, unit: 'pt' }), 1, 0));
});

test('toPixels: physical scales by DPI, px is dpi-independent', () => {
  assert.equal(toPixels({ value: 210, unit: 'mm' }, 300), 2480); // A4 width @ 300dpi
  assert.equal(toPixels({ value: 210, unit: 'mm' }, 96), 794);
  assert.equal(toPixels({ value: 800, unit: 'px' }, 300), 800);  // px ignores dpi
  assert.equal(toPixels({ value: 1, unit: 'in' }, 150), 150);
});

test('toPoints: vector — physical exact, px via 96dpi convention', () => {
  assert.ok(close(toPoints({ value: 210, unit: 'mm' }), 595.28)); // A4 width in pt
  assert.ok(close(toPoints({ value: 297, unit: 'mm' }), 841.89)); // A4 height in pt
  assert.equal(toPoints({ value: 72, unit: 'pt' }), 72);
  assert.equal(toPoints({ value: 96, unit: 'px' }), 72);          // 96px → 72pt @ 96dpi
});

test('toCssPx / toCssLength', () => {
  assert.equal(toCssPx({ value: 1, unit: 'in' }), CSS_DPI);
  assert.equal(toCssLength({ value: 210, unit: 'mm' }), '210mm');
  assert.equal(toCssLength({ value: 800, unit: 'px' }), '800px');
});

test('isPhysical', () => {
  assert.equal(isPhysical({ value: 1, unit: 'px' }), false);
  assert.equal(isPhysical({ value: 1, unit: 'mm' }), true);
  assert.equal(isPhysical(null), false);
});
