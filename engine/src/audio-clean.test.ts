// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAudioPcm } from './audio-clean.ts';

test('Clean trims exact zero edges, reaches loudness target and stays below -1 dBTP', () => {
  const rate = 48_000;
  const edge = rate / 4;
  const signal = rate;
  const channel = new Float32Array(edge + signal + edge);
  const amplitude = 10 ** (-30 / 20);
  for (let i = 0; i < signal; i++) channel[edge + i] = amplitude * Math.cos(2 * Math.PI * 997 * i / rate);
  const result = cleanAudioPcm([channel, channel], rate, { trimSilence: true, normalize: -16 });
  assert.equal(result.channels[0]!.length, signal);
  assert.equal(result.trimStartSeconds, 0.25);
  assert.equal(result.trimEndSeconds, 0.25);
  assert.equal(result.secondsTrimmed, 0.5);
  assert.ok(result.loudnessAfter != null && Math.abs(result.loudnessAfter + 16) <= 0.5, `got ${result.loudnessAfter} LUFS`);
  assert.ok(result.truePeakDb <= -1, `got ${result.truePeakDb} dBTP`);
});

test('Clean light and strong use the shell enhancement at stable blend strengths', () => {
  const original = new Float32Array(48_000).fill(0.2);
  const enhanced = new Float32Array(48_000).fill(0.1);
  const light = cleanAudioPcm([original], 48_000, { denoise: 'light', enhanced: [enhanced], normalize: 'off' });
  const strong = cleanAudioPcm([original], 48_000, { denoise: 'strong', enhanced: [enhanced], normalize: 'off' });
  assert.ok(Math.abs(light.channels[0]![1000]! - 0.145) < 1e-5);
  assert.ok(Math.abs(strong.channels[0]![1000]! - 0.1) < 1e-5);
});
