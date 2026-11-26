// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { waveformElement, waveformFacts, waveformPath } from './valid-stage-audio.ts';

test('the waveform is one bar per bucket, mirrored, and bounded for bad values', () => {
  const d = waveformPath([0, 0.5, 1, Number.NaN, 7, -3], 60, 100);
  assert.equal((d.match(/M/g) ?? []).length, 6);
  assert.doesNotMatch(d, /NaN|Infinity/);
  // A full-scale bucket stops short of the edges; a silent one still draws a hairline.
  const heights = [...d.matchAll(/v([\d.]+)h-/g)].map((m) => Number(m[1]));
  assert.equal(heights[2], 96);
  assert.equal(heights[4], 96, 'a value over 1 is clamped');
  assert.equal(heights[0], 1);
  assert.equal(heights[5], 1, 'a negative value is clamped');
  assert.equal(waveformPath([]), '');
});

test('the facts state a tempo only when the analysis found one', () => {
  assert.deepEqual(waveformFacts({ duration: 125.4, channels: 2, bpm: null }), ['2:05', 'Stereo']);
  assert.deepEqual(waveformFacts({ duration: 9, channels: 1, bpm: 119.6 }), ['0:09', 'Mono', 'About 120 beats a minute']);
  assert.deepEqual(waveformFacts({ duration: 1, channels: 6, bpm: null }), ['0:01', '6 channels']);
});

test('the waveform is a button that says what a press does, with the duration for seeking', () => {
  const doc = new JSDOM('<body></body>').window.document;
  const wave = waveformElement(doc, new Float32Array([0.2, 0.8]), { duration: 30, channels: 2, bpm: null });
  assert.equal(wave.dataset.waveDuration, '30');
  const plot = wave.querySelector('button[data-wave-seek]')!;
  assert.equal(plot.getAttribute('aria-label'), 'Waveform. Press to move the player there.');
  assert.equal((plot.querySelector('path')!.getAttribute('d')!.match(/M/g) ?? []).length, 2);
  assert.equal(wave.querySelector<HTMLElement>('[data-wave-head]')!.hidden, true);
  assert.deepEqual([...wave.querySelectorAll('.vf-wave-facts span')].map((el) => el.textContent), ['0:30', 'Stereo']);
});
