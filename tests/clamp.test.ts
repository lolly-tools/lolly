// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the engine's one numeric clamp - it replaced 27 local copies across the
 * engine and web shell on 2026-09-09, so its NaN-passthrough and boundary
 * behaviour (matching Math.min/Math.max, not clamping NaN to a bound) is now a
 * contract every one of those call sites relies on rather than an implementation
 * detail of any single one.
 * Run: node --test tests/clamp.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clamp } from '../engine/src/clamp.ts';

test('holds a value inside the range unchanged', () => {
  assert.equal(clamp(5, 0, 10), 5);
});

test('clamps below and above the bounds', () => {
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test('values exactly at a bound pass through unchanged', () => {
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
});

test('a degenerate range (lo === hi) pins to that single value', () => {
  assert.equal(clamp(5, 3, 3), 3);
  assert.equal(clamp(-100, 3, 3), 3);
});

test('NaN passes through as NaN, like Math.min/Math.max do', () => {
  assert.ok(Number.isNaN(clamp(NaN, 0, 10)));
});

test('negative and fractional ranges clamp correctly', () => {
  assert.equal(clamp(-0.5, -1, 1), -0.5);
  assert.equal(clamp(-2, -1, 1), -1);
  assert.equal(clamp(2.5, -1, 1), 1);
});
