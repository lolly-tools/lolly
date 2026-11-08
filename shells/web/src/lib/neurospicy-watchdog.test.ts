// SPDX-License-Identifier: MPL-2.0
/**
 * The analyser stall watchdog's rule: when is a waveform frozen, and when is it silence?
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/neurospicy-watchdog.test.ts
 *
 * The watchdog swaps in a new analyser when the old one freezes (an iOS/WebKit habit).
 * Treating silence as a freeze swapped analysers under a visualizer still wired to the old
 * one, which then showed nothing while the music played: the visualizer "froze".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveStalled } from './neurospicy.ts';

const wave = (f: (i: number) => number): Uint8Array => Uint8Array.from({ length: 128 }, (_, i) => f(i));

test('the same waveform twice, with a signal in it, is a freeze', () => {
  const w = wave((i) => 128 + Math.round(40 * Math.sin(i / 5)));
  assert.equal(waveStalled(w, Uint8Array.from(w)), true);
});

test('silence is not a freeze, however long it lasts', () => {
  const flat = wave(() => 128);
  assert.equal(waveStalled(flat, Uint8Array.from(flat)), false);
});

test('a changing waveform, or nothing to compare with, is not a freeze', () => {
  assert.equal(waveStalled(wave((i) => 128 + (i % 7)), wave((i) => 128 + (i % 5))), false);
  assert.equal(waveStalled(null, wave((i) => 100 + (i % 3))), false);
  assert.equal(waveStalled(wave(() => 130), new Uint8Array(64).fill(130)), false, 'different lengths');
});
