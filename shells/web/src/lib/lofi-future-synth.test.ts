// SPDX-License-Identifier: MPL-2.0
/**
 * The future-bass chord's layers, built in JS (lofi-future-synth.ts).
 *
 * Run directly:  node --test shells/web/src/lib/lofi-future-synth.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyTone, detuneCurve, pluckTone, sawStack, stackPans, HQ_STACK, LIVE_STACK, PLUCK_SECONDS } from './lofi-future-synth.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

test('the detunes follow the JP-8000\'s uneven curve: close to the pitch inside, far out at the edges, one saw on the pitch', () => {
  const d = detuneCurve(7, 36);
  assert.deepEqual(d.map(x => Math.round(x * 10) / 10), [-36, -18.8, -6.2, 0, 6.1, 18.4, 35.3]);
  for (const n of [3, 5, 7, 11]) {
    const c = detuneCurve(n, 40);
    assert.equal(c.length, n);
    assert.equal(c.filter(x => x === 0).length, 1, `${n} saws: one on the pitch`);
    assert.ok(c.every((x, i) => i === 0 || x > c[i - 1]!), `${n} saws: in order`);
  }
});

test('each pair of saws is split across the speakers, and neither side is the sharp side', () => {
  const d = detuneCurve(7, 36);
  const pans = stackPans(d, 0.95);
  assert.equal(pans[3], 0, 'the saw on the pitch sits in the middle');
  for (let step = 1; step <= 3; step++) {
    const flat = pans[3 - step]!, sharp = pans[3 + step]!;
    assert.ok(Math.sign(flat) === -Math.sign(sharp), `step ${step}: the flat and the sharp saw on opposite sides`);
    assert.ok(Math.abs(flat) >= 0.6 && Math.abs(flat) <= 0.95, `step ${step}: well out (${flat})`);
  }
  assert.ok(pans.filter((p, i) => d[i]! > 0 && p > 0).length > 0 && pans.filter((p, i) => d[i]! > 0 && p < 0).length > 0, 'sharp saws on both sides');
});

test('a stack loops without a seam, at the pitch the player asks of it, the same every time', () => {
  for (const m of [48, 60, 72, 81]) {
    const s = sawStack(LIVE_STACK, SR, mtof(m), 1.5, mulberry32(m));
    assert.equal(s.l.length, 1.5 * SR);
    // The centre saw plays a whole number of cycles in the loop, within half a cycle a loop of the pitch.
    assert.ok(Math.abs(s.centre - mtof(m)) <= 1 / 1.5 / 2 + 1e-9, `${m}: centre ${s.centre} for ${mtof(m)}`);
    assert.ok(Number.isInteger(Math.round(s.centre * 1.5 * 1e6) / 1e6), `${m}: a whole number of cycles`);
    // The step across the loop's join is no bigger than an ordinary step inside the loop.
    let typical = 0;
    for (let i = 1; i < s.l.length; i++) typical += Math.abs(s.l[i]! - s.l[i - 1]!);
    typical /= s.l.length - 1;
    assert.ok(Math.abs(s.l[0]! - s.l[s.l.length - 1]!) < typical * 6, `${m}: no click at the join`);
  }
  const a = sawStack(HQ_STACK, SR, 300, 0.2, mulberry32(9)), b = sawStack(HQ_STACK, SR, 300, 0.2, mulberry32(9));
  assert.deepEqual(a.l, b.l);
});

/** The power within 45 cents of `f` Hz, every DFT bin of the loop summed (a stack's partials are spread that wide). */
function powerAt(x: Float32Array, f: number): number {
  const n = x.length;
  let total = 0;
  const lo = Math.floor(f * 2 ** (-45 / 1200) * n / SR), hi = Math.ceil(f * 2 ** (45 / 1200) * n / SR);
  for (let bin = lo; bin <= hi; bin++) {
    const w = 2 * Math.PI * bin / n;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { re += x[i]! * Math.cos(w * i); im -= x[i]! * Math.sin(w * i); }
    total += re * re + im * im;
  }
  return total;
}

test('a stack is wide on top and mono under its monoBelow, and peaks at a steady level', () => {
  const f = mtof(45);   // 110 Hz: its first two harmonics are under monoBelow, its eighth far above
  const s = sawStack(LIVE_STACK, SR, f, 1.5, mulberry32(3));
  const mid = new Float32Array(s.l.length), side = new Float32Array(s.l.length);
  for (let i = 0; i < s.l.length; i++) { mid[i] = (s.l[i]! + s.r[i]!) / 2; side[i] = (s.l[i]! - s.r[i]!) / 2; }
  const low = 10 * Math.log10(powerAt(side, f) / powerAt(mid, f));
  const high = 10 * Math.log10(powerAt(side, f * 8) / powerAt(mid, f * 8));
  assert.ok(low < -15, `mono low: the fundamental's side is ${low.toFixed(1)} dB under its middle`);
  assert.ok(high > -6, `wide on top: the eighth harmonic's side is ${high.toFixed(1)} dB under its middle`);
  let peak = 0;
  for (let i = 0; i < s.l.length; i++) peak = Math.max(peak, Math.abs(s.l[i]!), Math.abs(s.r[i]!));
  assert.ok(Math.abs(peak - 0.5) < 1e-6, 'brought to its peak');
});

test('a pluck strikes and is gone within its length, wide like the stack', () => {
  const p = pluckTone(SR, mtof(60), mulberry32(4));
  assert.equal(p.l.length, Math.round(PLUCK_SECONDS * SR));
  const rms = (x: Float32Array, from: number, to: number): number => Math.sqrt(x.subarray(from, to).reduce((s, v) => s + v * v, 0) / (to - from));
  const early = rms(p.l, 0, SR * 0.03), late = rms(p.l, p.l.length - SR * 0.03, p.l.length);
  assert.ok(20 * Math.log10(early / late) > 30, `falls more than 30 dB (${(20 * Math.log10(early / late)).toFixed(1)})`);
  assert.notDeepEqual(p.l, p.r, 'each side its own saws');
});

test('the body is a dark, mono sub-octave that loops at its own pitch', () => {
  const b = bodyTone(SR, mtof(60), 1.5, mulberry32(5));
  assert.ok(Math.abs(b.centre - mtof(60) / 2) <= 1 / 1.5 / 2 + 1e-9, 'an octave under the note');
  assert.ok(b.data.every(Number.isFinite));
});

test('a context far below the usual sample rate still builds every layer (the station\'s tests run at 4 kHz)', () => {
  const s = sawStack(LIVE_STACK, 4000, mtof(76), 0.5, mulberry32(6));
  assert.ok(s.l.every(Number.isFinite) && s.r.every(Number.isFinite));
  const p = pluckTone(4000, mtof(76), mulberry32(7));
  assert.ok(p.l.every(Number.isFinite));
});
