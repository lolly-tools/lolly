// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSampleRequest, motionReviewTimes, parseSampleTimes, sampleOutputFormat, sequenceSampleTimes } from '../engine/src/sequence-samples.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';

test('explicit samples preserve zero and subframe precision through URL mode', () => {
  const sampleTimes = [0, 1 / 30, 2.5];
  const query = serializeUrlState([], { sampleTimes });
  const state = parseUrlState(query, { inputs: [] });
  assert.deepEqual(state.sampleTimes, sampleTimes);
  assert.deepEqual(state.values, {});
  assert.equal(parseUrlState('', { inputs: [] }).sampleTimes, undefined);
});

test('sample requests refuse empty, duplicate, descending, nonfinite and oversized lists', () => {
  for (const raw of ['', ',1', '1,', 'NaN', 'Infinity', '-1', '3601', '2,1', '1,1', Array.from({ length: 65 }, (_, i) => i).join(',')]) {
    assert.throws(() => parseSampleTimes(raw), RangeError, raw);
  }
  assert.throws(() => assertSampleRequest('png', 3, [0]), /not both/);
  assert.throws(() => assertSampleRequest('mp4', 1, [0]), /unavailable/);
  assert.equal(assertSampleRequest('png', 1), false);
});

test('uniform sheets and explicit seconds share one plan without clamping endpoint requests', () => {
  assert.deepEqual(sequenceSampleTimes(6000, 3), [1000, 3000, 5000]);
  assert.deepEqual(sequenceSampleTimes(6000, 1, [0, 2.999, 3, 5.999]), [0, 2999, 3000, 5999]);
  assert.throws(() => sequenceSampleTimes(6000, 1, [6]), /before the timeline end/);
  assert.throws(() => sequenceSampleTimes(0, 3), /timed composition/);
  assert.equal(sampleOutputFormat('png', 1, [2]), 'png');
  assert.equal(sampleOutputFormat('png', 1, [2, 3]), 'zip');
  assert.equal(sampleOutputFormat('svg', 3), 'zip');
  assert.equal(sampleOutputFormat('pdf', 3), 'pdf');
});

for (const fps of [24, 30, 60]) {
  test(`review samples cover both sides of boundaries and final output frame at ${fps} fps`, () => {
    const times = motionReviewTimes(6, fps, [0, 3], [1.5, 4.5]);
    for (const time of [0, 1.5, 3 - 1 / fps, 3, 3 + 1 / fps, 4.5, (6 * fps - 1) / fps]) assert.ok(times.includes(time));
    assert.ok(times.every(time => time >= 0 && time < 6));
    assert.deepEqual(times, [...new Set(times)].sort((a, b) => a - b));
  });
}
