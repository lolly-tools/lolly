// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { packWav, parseWav } from '@lolly/engine';
import { trimMedia } from './media-trim.ts';

test('trims synthetic audio to the exact requested sample range', async () => {
  const sampleRate = 48_000;
  const samples = new Float32Array(sampleRate * 2);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.2;
  const source = packWav({ channels: [samples], sampleRate });

  const result = await trimMedia(source, {
    start: 0.25,
    end: 1.25,
    container: 'keep',
    sourceName: 'tone.wav',
    sourceMime: 'audio/wav',
  });
  const decoded = parseWav(result.bytes);

  assert.equal(result.container, 'wav');
  assert.equal(result.durationBefore, 2);
  assert.equal(result.durationAfter, 1);
  assert.equal(decoded.sampleRate, sampleRate);
  assert.equal(decoded.channels[0]!.length, sampleRate);
});

test('rejects an empty trim range by name', async () => {
  const source = packWav({ channels: [new Float32Array(48_000)], sampleRate: 48_000 });
  await assert.rejects(
    trimMedia(source, { start: 1, end: 1, container: 'keep', sourceName: 'silence.wav' }),
    /start \(1s\) must be before end \(1s\)/,
  );
});
