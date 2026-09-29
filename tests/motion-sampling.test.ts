// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShutterAccumulator, shutterTimes, parseMotionParams, validateMotionBlur, assertMotionRequest } from '../engine/src/motion-sampling.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';

test('shutter midpoints are centred, clipped to ranges and never cross a hard cut', () => {
  const blur = { samples: 4, shutterAngle: 180 } as const;
  assert.deepEqual(shutterTimes(100, 25, 0, 1000, [], blur), [92.5, 97.5, 102.5, 107.5]);
  assert.deepEqual(shutterTimes(100, 25, 100, 1000, [], blur), [101.25, 103.75, 106.25, 108.75]);
  assert.ok(shutterTimes(500, 30, 0, 1000, [500], blur).every(time => time >= 500));
  assert.ok(shutterTimes(499, 30, 0, 1000, [500], blur).every(time => time < 500));
  assert.deepEqual(shutterTimes(100, 30, 0, 1000, [], { samples: 16, shutterAngle: 0 }), [100]);
});
test('integration is linear-light, premultiplied and static pixels retain their bytes', () => {
  const sum = new ShutterAccumulator(4), target = new Uint8ClampedArray(4);
  sum.add(new Uint8ClampedArray([255, 255, 255, 255])); sum.add(new Uint8ClampedArray([0, 0, 0, 255])); sum.finish(target);
  assert.deepEqual([...target], [188, 188, 188, 255]);
  sum.add(new Uint8ClampedArray([255, 0, 0, 255])); sum.add(new Uint8ClampedArray([0, 255, 0, 0])); sum.finish(target);
  assert.deepEqual([...target], [255, 0, 0, 128]);
  for (let n = 0; n < 256; n++) {
    for (let i = 0; i < 16; i++) sum.add(new Uint8ClampedArray([n, 173, 64, 117]));
    sum.finish(target); assert.deepEqual([...target], [n, 173, 64, 117]);
  }
});
test('range and blur settings round-trip and invalid requests fail visibly', () => {
  const settings = { motionBlur: { samples: 8, shutterAngle: 180 } as const, sequenceRange: { from: 1.25, to: 3 } };
  const query = serializeUrlState([], settings), read = parseUrlState(query, { inputs: [] });
  assert.deepEqual(read.motionBlur, settings.motionBlur); assert.deepEqual(read.sequenceRange, settings.sequenceRange);
  for (const samples of [0, 2, 32, '8']) assert.throws(() => validateMotionBlur({ samples, shutterAngle: 180 }));
  for (const query of ['seqrange=3,1', 'seqrange=1,', 'motionblur=8,Infinity']) assert.throws(() => parseMotionParams(new URLSearchParams(query)));
  assert.throws(() => assertMotionRequest('lottie', settings), /requires/);
  assert.throws(() => new ShutterAccumulator(256 * 1024 * 1024), /scratch/);
});
