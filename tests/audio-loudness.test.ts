// SPDX-License-Identifier: MPL-2.0
/**
 * BS.1770-4 integrated loudness (plans/101 section 2.5). External reference
 * vectors need a network, so the proofs here are the standard's own calibration
 * properties: the K-filter's +0.691 dB at ~1 kHz cancels against the -0.691
 * offset, so a 997 Hz stereo sine reads its dBFS level as LKFS; gating drops
 * silence and deep quiet; the streaming meter is chunk-invariant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLoudnessMeter, integratedLoudness, normalizeGain, LOUDNESS_RATE } from '../engine/src/audio-loudness.ts';

const RATE = LOUDNESS_RATE;

function sine(seconds: number, freq: number, amp: number): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / RATE);
  return out;
}

test('calibration: a 997 Hz stereo sine reads its own level - 0 dBFS = 0.0 LKFS, -20 dBFS = -20.0', () => {
  const full = sine(5, 997, 1.0);
  const l0 = integratedLoudness([full, full]);
  assert.ok(l0 !== null && Math.abs(l0 - 0) < 0.1, `full scale: ${l0}`);
  const quiet = sine(5, 997, 0.1);
  const l20 = integratedLoudness([quiet, quiet]);
  assert.ok(l20 !== null && Math.abs(l20 - -20) < 0.1, `-20 dBFS: ${l20}`);
});

test('one channel carries half the energy: a mono-in-one-channel sine reads ~-3 LKFS down', () => {
  const s = sine(5, 997, 1.0);
  const l = integratedLoudness([s, new Float32Array(s.length)]);
  assert.ok(l !== null && Math.abs(l - -3.01) < 0.1, `one-channel: ${l}`);
});

test('silence has no loudness, and appended silence does not move the number (absolute gate)', () => {
  assert.equal(integratedLoudness([new Float32Array(RATE * 2)]), null);
  const tone = sine(4, 997, 0.25);
  const base = integratedLoudness([tone, tone])!;
  const padded = new Float32Array(tone.length + RATE * 10);
  padded.set(tone, 0);
  const withTail = integratedLoudness([padded, padded])!;
  // The tolerance covers the tone-to-silence BOUNDARY blocks: a 400 ms block
  // straddling the edge carries real partial energy, passes both gates, and
  // legitimately shifts the mean a fraction of a dB - the standard measures it
  // too. The gate claim is that ten SECONDS of silence adds nothing beyond that.
  assert.ok(Math.abs(withTail - base) < 0.25, `silence moved it: ${base} -> ${withTail}`);
});

test('the relative gate keeps a deep-quiet tail from dragging the number down', () => {
  const loud = sine(4, 997, 0.5);
  const quiet = sine(4, 997, 0.005);   // 40 dB down - outside the -10 LU gate
  const joined = new Float32Array(loud.length + quiet.length);
  joined.set(loud, 0);
  joined.set(quiet, loud.length);
  const base = integratedLoudness([loud, loud])!;
  const gated = integratedLoudness([joined, joined])!;
  assert.ok(Math.abs(gated - base) < 0.4, `the quiet tail dragged it: ${base} -> ${gated}`);
});

test('the streaming meter is chunk-invariant', () => {
  const s = sine(3, 440, 0.4);
  const whole = integratedLoudness([s, s])!;
  const m = createLoudnessMeter(RATE);
  for (let i = 0; i < s.length; i += 4800) m.push(s.subarray(i, i + 4800), s.subarray(i, i + 4800));
  const chunked = m.integrated()!;
  assert.ok(Math.abs(whole - chunked) < 1e-9, `chunking moved it: ${whole} vs ${chunked}`);
});

test('normalizeGain moves a measure onto a target and clamps the absurd', () => {
  const g = normalizeGain(-20, -14);
  assert.ok(Math.abs(20 * Math.log10(g) - 6) < 1e-9, 'a 6 dB lift');
  assert.ok(Math.abs(20 * Math.log10(normalizeGain(-80, -14)) - 24) < 1e-9, 'clamped at +24 dB');
  const meter = createLoudnessMeter(RATE);
  void meter;
  assert.throws(() => createLoudnessMeter(44_100), /48000/, 'wrong-rate metering is refused, not wrong');
});
