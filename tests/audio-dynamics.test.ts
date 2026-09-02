// SPDX-License-Identifier: MPL-2.0
/**
 * The master true-peak limiter (plans/165 Slice E, plans/101 section 2.5).
 *
 * The claims proven here, each one a property the mix depends on:
 *   - the output's TRUE peak (checked by an independent 8x oversampler, not the
 *     module's own detector) never exceeds the ceiling;
 *   - content under the ceiling passes through BYTE-identical (the transparency
 *     that keeps every existing golden hash and RMS measurement unchanged);
 *   - any chunking of the same stream concatenates to the identical output (what
 *     keeps the 0.1 s feeder and the worker's whole-range call byte-identical);
 *   - total out equals total in after flush;
 *   - an INTER-SAMPLE peak engages the limiter even when every sample is safe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { activitySpans, createTruePeakLimiter } from '../engine/src/audio-dynamics.ts';

const RATE = 48_000;
const CEILING = 10 ** (-1 / 20);   // -1 dBTP

/** Deterministic pseudo-noise, so failures reproduce. */
function noise(n: number, amp: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = amp * ((s / 0xffffffff) * 2 - 1);
  }
  return out;
}

function sine(n: number, freq: number, amp: number, phase = 0): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / RATE + phase);
  return out;
}

/** Run a whole stereo signal through one limiter instance: process + flush. */
function limitWhole(l: Float32Array, r: Float32Array): [Float32Array, Float32Array] {
  const lim = createTruePeakLimiter({ rate: RATE });
  const [aL, aR] = lim.process(l, r);
  const [bL, bR] = lim.flush();
  const outL = new Float32Array(l.length);
  const outR = new Float32Array(r.length);
  outL.set(aL, 0); outL.set(bL, aL.length);
  outR.set(aR, 0); outR.set(bR, aR.length);
  assert.equal(aL.length + bL.length, l.length, 'total out equals total in');
  return [outL, outR];
}

/**
 * An INDEPENDENT true-peak estimate: 8x oversample by windowed-sinc interpolation,
 * written from scratch so it shares no code (and no blind spot) with the module.
 */
function truePeak8x(x: Float32Array): number {
  let peak = 0;
  const HALF = 16;
  for (let i = 0; i < x.length; i++) {
    for (let p = 0; p < 8; p++) {
      const t = i + p / 8;
      let acc = 0;
      for (let k = -HALF; k <= HALF; k++) {
        const idx = Math.round(t) + k;
        if (idx < 0 || idx >= x.length) continue;
        const d = t - idx;
        const sinc = d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d);
        const w = 0.5 * (1 + Math.cos((Math.PI * d) / (HALF + 1)));
        acc += (x[idx] as number) * sinc * w;
      }
      const m = Math.abs(acc);
      if (m > peak) peak = m;
    }
  }
  return peak;
}

test('a hard-over signal comes out under the ceiling, true peak included', () => {
  // A bandlimited hostile signal - the PV-overshoot class the limiter exists for:
  // tones summing to ~1.45. Full-band alternating noise is deliberately NOT the
  // true-peak fixture: the between-sample excursions of sign-alternating noise
  // exceed what ANY 4x detector (the BS.1770 method itself) resolves - that class
  // gets the sample-ceiling test below instead.
  const n = RATE / 2;
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / RATE;
    l[i] = 0.6 * Math.sin(220 * t) + 0.5 * Math.sin(997 * t + 1) + 0.35 * Math.sin(3701 * t + 2);
    r[i] = 0.55 * Math.sin(330 * t + 0.5) + 0.5 * Math.sin(1201 * t) + 0.4 * Math.sin(2903 * t + 1.3);
  }
  const [outL, outR] = limitWhole(l, r);
  for (const ch of [outL, outR]) {
    for (let i = 0; i < ch.length; i++) {
      assert.ok(Math.abs(ch[i] as number) <= CEILING + 1e-4, `sample ${i} over the ceiling: ${ch[i]}`);
    }
  }
  // The independent oversampler agrees the TRUE peak is held (a small tolerance:
  // two different interpolators disagree in the last few hundredths).
  assert.ok(truePeak8x(outL) <= CEILING + 0.02, `true peak L ${truePeak8x(outL)}`);
  assert.ok(truePeak8x(outR) <= CEILING + 0.02, `true peak R ${truePeak8x(outR)}`);
});

test('full-band hostile noise still holds the sample ceiling', () => {
  const l = noise(RATE / 2, 1.3, 7);
  const r = noise(RATE / 2, 1.3, 11);
  const [outL, outR] = limitWhole(l, r);
  for (const ch of [outL, outR]) {
    for (let i = 0; i < ch.length; i++) {
      assert.ok(Math.abs(ch[i] as number) <= CEILING + 1e-4, `sample ${i} over the ceiling: ${ch[i]}`);
    }
  }
});

test('content under the ceiling passes through byte-identical', () => {
  const l = sine(RATE / 4, 440, 0.7);
  const r = sine(RATE / 4, 660, 0.6);
  const [outL, outR] = limitWhole(l, r);
  for (let i = 0; i < l.length; i++) {
    assert.equal(outL[i], l[i], `left sample ${i} changed`);
    assert.equal(outR[i], r[i], `right sample ${i} changed`);
  }
  const lim = createTruePeakLimiter({ rate: RATE });
  lim.process(l, r); lim.flush();
  assert.equal(lim.engaged(), false, 'the limiter never engaged');
});

test('an inter-sample peak engages the limiter even with every sample safe', () => {
  // A sine at fs/4 with a 45-degree phase offset: every SAMPLE sits at ~0.742
  // (safe), but the waveform between samples reaches 1.05.
  const l = sine(RATE / 4, RATE / 4, 1.05, Math.PI / 4);
  for (let i = 0; i < l.length; i++) assert.ok(Math.abs(l[i] as number) < CEILING, 'precondition: samples are under the ceiling');
  const lim = createTruePeakLimiter({ rate: RATE });
  lim.process(l, l); lim.flush();
  assert.equal(lim.engaged(), true, 'the inter-sample peak went unnoticed');
});

test('any chunking of the stream concatenates to the identical output', () => {
  const l = noise(RATE, 1.2, 3);
  const r = noise(RATE, 1.2, 5);
  const [wholeL] = limitWhole(l, r);
  for (const step of [173, 4800]) {
    const lim = createTruePeakLimiter({ rate: RATE });
    const got = new Float32Array(l.length);
    let off = 0;
    for (let i = 0; i < l.length; i += step) {
      const [cL] = lim.process(l.subarray(i, i + step), r.subarray(i, i + step));
      got.set(cL, off); off += cL.length;
    }
    const [fL] = lim.flush();
    got.set(fL, off); off += fL.length;
    assert.equal(off, l.length, `chunk ${step}: total length`);
    for (let i = 0; i < l.length; i++) {
      assert.equal(got[i], wholeL[i], `chunk ${step}: sample ${i} differs from the whole-range run`);
    }
  }
});

test('a peak at the very end is still limited (the flush path looks ahead)', () => {
  const l = new Float32Array(1000);
  l[997] = 1.5;
  const [outL] = limitWhole(l, l);
  assert.ok(Math.abs(outL[997] as number) <= CEILING + 1e-4, `end spike survived: ${outL[997]}`);
});

// ── activitySpans (plans/165 WP-6 v2): where a clip actually makes sound ────────

test('activitySpans: silence yields nothing, a burst yields its window', () => {
  assert.deepEqual(activitySpans([new Float32Array(RATE)]), []);
  const x = new Float32Array(RATE * 2);
  x.set(sine(RATE / 2, 440, 0.5), Math.round(RATE * 0.5));   // 0.5s..1.0s of tone
  const spans = activitySpans([x], { rate: RATE });
  assert.equal(spans.length, 1, `expected one span, got ${JSON.stringify(spans)}`);
  const s = spans[0]!;
  assert.ok(Math.abs(s.from - 0.5) <= 0.06, `opens near 0.5s: ${s.from}`);
  assert.ok(Math.abs(s.to - 1.0) <= 0.11, `closes near 1.0s: ${s.to}`);
});

test('activitySpans: hysteresis rides through a dip, a real gap splits after minGap', () => {
  // Two sentences of tone with a 0.2s pause: merges (gap < 300ms default).
  const a = new Float32Array(RATE * 2);
  a.set(sine(Math.round(RATE * 0.6), 440, 0.5), 0);
  a.set(sine(Math.round(RATE * 0.6), 440, 0.5), Math.round(RATE * 0.8));
  assert.equal(activitySpans([a], { rate: RATE }).length, 1, 'a 200ms pause merges');
  // The same two sentences a full second apart: two spans.
  const b = new Float32Array(RATE * 3);
  b.set(sine(Math.round(RATE * 0.6), 440, 0.5), 0);
  b.set(sine(Math.round(RATE * 0.6), 440, 0.5), Math.round(RATE * 1.6));
  assert.equal(activitySpans([b], { rate: RATE }).length, 2, 'a 1s pause splits');
});

test('activitySpans: quiet content under the gate and blips under minSpan stay out', () => {
  const quiet = sine(RATE, 440, 0.002);   // ~-54 dBFS, under the -45 open gate
  assert.deepEqual(activitySpans([quiet], { rate: RATE }), []);
  const blip = new Float32Array(RATE);
  blip.set(sine(Math.round(RATE * 0.05), 440, 0.5), 1000);   // 50ms - under minSpan
  assert.deepEqual(activitySpans([blip], { rate: RATE }), []);
});
