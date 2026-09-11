// SPDX-License-Identifier: MPL-2.0
/**
 * formatTime is the only part of the transport that is pure - the rest is element
 * wiring, verified in a real browser. What is worth pinning here is the behaviour that
 * caused an actual bug: a non-finite duration.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime } from './audio-transport.ts';

test('formatTime renders m:ss with a zero-padded seconds field', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(5), '0:05');
  assert.equal(formatTime(59), '0:59');
  assert.equal(formatTime(60), '1:00');
  assert.equal(formatTime(95), '1:35');
  assert.equal(formatTime(3599), '59:59');
});

test('formatTime truncates rather than rounding, so the clock never shows a time the track has not reached', () => {
  assert.equal(formatTime(9.9), '0:09');
  assert.equal(formatTime(59.99), '0:59');
});

test('a minute count past an hour keeps counting rather than wrapping', () => {
  // No h:mm:ss form on purpose - the catalog previews are loops and clips. Wrapping to
  // 0:00 at an hour would be a silent lie; 60:00 is merely unusual.
  assert.equal(formatTime(3600), '60:00');
});

test('non-finite and negative times render as unknown, never as 0:00', () => {
  // Infinity is the REAL case: a source served without range support reports it for
  // duration, and showing "0:00" there would claim a zero-length track.
  assert.equal(formatTime(Number.POSITIVE_INFINITY), '--:--');
  assert.equal(formatTime(Number.NaN), '--:--');
  assert.equal(formatTime(-1), '--:--');
});
