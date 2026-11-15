// SPDX-License-Identifier: MPL-2.0
/**
 * The 16-bit console's chips and its FM effects (lib/lofi-console-chip.ts, lib/lofi-console-fx.ts).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-console-fx.test.ts
 *
 * What is pinned:
 *  - the chips' published behaviour: the FM chip's pitches on its F-number grid from its
 *    7.67 MHz clock, the square-wave chip's clock / (32 n) steps (coarse at the top), its
 *    2 dB levels, the 0.75 dB total level, and the 9-bit converter's gap at zero;
 *  - a pitch the driver changes once a frame comes out as a staircase, a step every 60th of a second;
 *  - every effect works out to finite, audible, unclipped stereo, the same samples every
 *    time; a spin climbs, a shot falls, and a shot's echoes answer from one side and then the other;
 *  - the tape stop's curve slows the music from full speed to a halt;
 *  - the console switch (quiet=console) takes every FM effect out of a track, the rewind with them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dac9, psgHz, psgLevel, renderFm, tlLevel, ymHz, ymRegisters, DAC_STEP, LADDER, PSG_CLOCK, YM_RATE, type FmPatch } from './lofi-console-chip.ts';
import { renderConsoleFx, tapeStopCurve } from './lofi-console-fx.ts';
import { fmMod, LOFI_FM_FX, type LofiFmFx } from '../../../../engine/src/lofi-console.ts';
import { composeTrack, parseMusicState } from './music-state.ts';

const SR = 44100;

test('the FM chip plays only what its 11-bit F-number and block reach from its 7.67 MHz clock', () => {
  assert.ok(Math.abs(YM_RATE - 53267) < 1, 'its sample rate: the clock over 144');
  // f = fnum * 2^block * (clock / 144) / 2^21: A4 is block 4 (the octave whose F-numbers a note table uses), F-number 1083.
  assert.deepEqual(ymRegisters(440), { fnum: Math.round(440 * 2 ** 21 / (YM_RATE * 16)), block: 4 });
  assert.equal(ymRegisters(440).fnum, 1083);
  assert.ok(Math.abs(ymHz(440) - 440.12) < 0.05, `A4 sounds at ${ymHz(440).toFixed(2)} Hz`);
  for (let hz = 60; hz < 6000; hz *= 1.037) {
    const f = ymHz(hz);
    const { fnum, block } = ymRegisters(hz);
    assert.ok(Math.abs(f - fnum * 2 ** block * YM_RATE / 2 ** 21) < 1e-9, `${hz.toFixed(1)} Hz is on the grid`);
    assert.ok(Math.abs(1200 * Math.log2(f / hz)) < 3, `${hz.toFixed(1)} Hz within three cents (${f.toFixed(2)})`);
  }
});

test('the square-wave chip steps in clock / (32 n): coarse at the top, at 2 dB a level', () => {
  const at3k = psgHz(3000);
  const n = Math.round(PSG_CLOCK / (32 * at3k));
  assert.ok(Math.abs(at3k - PSG_CLOCK / (32 * n)) < 1e-9, 'on the chip\'s grid');
  const step = 1200 * Math.log2(PSG_CLOCK / (32 * (n - 1)) / at3k);
  assert.ok(step > 40, `the next step up from ${at3k.toFixed(0)} Hz is ${step.toFixed(0)} cents away`);
  assert.equal(psgLevel(0), 1);
  assert.ok(Math.abs(20 * Math.log10(psgLevel(1)) + 2) < 1e-9, '2 dB a step');
  assert.equal(psgLevel(15), 0, 'the last level is silence');
  assert.ok(Math.abs(20 * Math.log10(tlLevel(0.5)) / 0.75 - Math.round(20 * Math.log10(tlLevel(0.5)) / 0.75)) < 1e-9, 'a total level in 0.75 dB steps');
});

test('the 9-bit converter leaves a gap at zero, wider than a step', () => {
  const up = dac9(0.5 * DAC_STEP + DAC_STEP);
  const down = dac9(-0.5 * DAC_STEP);
  assert.ok(up - down > 2 * DAC_STEP, `the step across zero is ${((up - down) / DAC_STEP).toFixed(2)} steps`);
  assert.equal(dac9(0), 0, 'silence stays silent');
  assert.ok(Math.abs(dac9(0.999) - (255 + LADDER) * DAC_STEP) < 1e-12 && dac9(5) <= 1.01, 'full scale holds');
  for (let x = -1; x <= 1; x += 0.0137) assert.ok(Math.abs(dac9(x) - x) <= (1 + LADDER) * DAC_STEP + 1e-12, `${x.toFixed(3)} within a step and the gap`);
});

test('a pitch the driver changes once a frame comes out as a staircase', () => {
  // One plain sine (algorithm 7, operator 1 alone), its pitch written up a semitone every frame.
  const SINE: FmPatch = { algo: 7, fb: 0, ops: [
    { mul: 1, level: 0.8, a: 0.0005, d: 0, s: 0, r: 200 }, { mul: 1, level: 0, a: 0.001, d: 0, s: 0, r: 200 },
    { mul: 1, level: 0, a: 0.001, d: 0, s: 0, r: 200 }, { mul: 1, level: 0, a: 0.001, d: 0, s: 0, r: 200 },
  ] };
  const out = new Float32Array(SR);
  renderFm(out, SR, 0, SINE, 12, (f) => ({ hz: 220 * 2 ** (f / 12), key: f === 0 ? 'on' : undefined }), 0.01);
  const frame = SR / 60;
  // The pitch inside a frame, from the first and last upward zero crossings in it (each placed between its two samples).
  const pitch = (from: number, to: number): number => {
    const at: number[] = [];
    for (let i = Math.round(from) + 1; i < Math.round(to); i++) if (out[i - 1]! <= 0 && out[i]! > 0) at.push(i - 1 + out[i - 1]! / (out[i - 1]! - out[i]!));
    return ((at.length - 1) * SR) / (at.at(-1)! - at[0]!);
  };
  for (const f of [2, 5, 9]) {
    const inside = pitch(f * frame + 10, (f + 1) * frame - 10);
    assert.ok(Math.abs(1200 * Math.log2(inside / ymHz(220 * 2 ** (f / 12)))) < 15, `frame ${f} holds its pitch (${inside.toFixed(1)} Hz)`);
  }
});

const KINDS: Record<LofiFmFx, number> = { spin: 2, pew: 0.25, beam: 1, charged: 1, climb: 1.4, dive: 1, launch: 2, fanfare: 1.5, rewind: 1 };

test('every effect is finite, audible, unclipped stereo, and the same every time', () => {
  for (const kind of LOFI_FM_FX) {
    const mod = fmMod({ kind, count: 2, side: 1, third: 3, fifth: 7, whoosh: true });
    const [L, R] = renderConsoleFx(mod, 64, KINDS[kind] * 0.5, 0.5, SR);
    assert.equal(L.length, R.length);
    let peak = 0, energy = 0;
    for (let i = 0; i < L.length; i++) {
      assert.ok(Number.isFinite(L[i]!) && Number.isFinite(R[i]!), `${kind}: finite`);
      peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
      energy += L[i]! ** 2 + R[i]! ** 2;
    }
    assert.ok(peak > 0.2 && peak < 1.05, `${kind}: peak ${peak.toFixed(3)}`);
    assert.ok(energy > 0, `${kind}: audible`);
    assert.ok(Math.abs(L.at(-1)!) < 1e-3 && Math.abs(R.at(-1)!) < 1e-3, `${kind}: ends in silence`);
    const [L2] = renderConsoleFx(mod, 64, KINDS[kind] * 0.5, 0.5, SR);
    assert.deepEqual(L2, L, `${kind}: the same samples again`);
  }
});

/** How bright a stretch of a sound is: its zero crossings a second, a rough stand-in for its pitch. */
function brightness(x: Float32Array, from: number, to: number): number {
  let c = 0;
  for (let i = Math.round(from * SR) + 1; i < Math.round(to * SR); i++) if (x[i - 1]! <= 0 && x[i]! > 0) c++;
  return c / (to - from);
}

test('a spin climbs; a shot falls', () => {
  const [spin] = renderConsoleFx(fmMod({ kind: 'spin', count: 1 }), 60, 1, 0.5, SR);
  assert.ok(brightness(spin, 0.75, 0.95) > 1.3 * brightness(spin, 0.05, 0.25), `the spin climbs (${brightness(spin, 0.05, 0.25).toFixed(0)} to ${brightness(spin, 0.75, 0.95).toFixed(0)})`);
  const [pew] = renderConsoleFx(fmMod({ kind: 'pew' }), 64, 0.125, 0.5, SR);
  assert.ok(brightness(pew, 0.005, 0.04) > 2 * brightness(pew, 0.12, 0.2), `the shot falls (${brightness(pew, 0.005, 0.04).toFixed(0)} to ${brightness(pew, 0.12, 0.2).toFixed(0)})`);
});

test('a shot\'s echoes answer from one side and then the other, quieter each time', () => {
  const spb = 0.5, delay = 0.75 * spb;
  for (const side of [-1, 1] as const) {
    const [L, R] = renderConsoleFx(fmMod({ kind: 'pew', side }), 64, 0.125, spb, SR);
    const energy = (x: Float32Array, at: number): number => { let e = 0; for (let i = Math.round(at * SR); i < Math.round((at + 0.12) * SR); i++) e += x[i]! ** 2; return e; };
    const first = side < 0 ? [L, R] : [R, L];
    assert.ok(energy(first[0]!, delay) > 4 * energy(first[1]!, delay), `side ${side}: the first answer from its side`);
    assert.ok(energy(first[1]!, 2 * delay) > 4 * energy(first[0]!, 2 * delay), `side ${side}: the second from the other`);
    assert.ok(energy(first[0]!, 3 * delay) < energy(first[0]!, delay), `side ${side}: quieter as it goes`);
  }
});

test('the tape stop slows the music from full speed to a halt', () => {
  const c = tapeStopCurve(0, 0.5, 100);
  assert.equal(c[0], 0);
  const dt = 0.5 / 99;
  const speed = (i: number): number => 1 - (c[i + 1]! - c[i]!) / dt;
  assert.ok(speed(0) > 0.99, `full speed at first (${speed(0).toFixed(3)})`);
  assert.ok(speed(97) < 0.05, `stopped at the end (${speed(97).toFixed(3)})`);
  for (let i = 1; i < 98; i++) assert.ok(speed(i) <= speed(i - 1) + 1e-9, 'never speeding up');
});

test('the console switch takes every FM effect out, the rewind with them, and leaves every other note', () => {
  for (const [style, seed] of [['sugar', 2024], ['chiptune', 7], ['sherbert', 39]] as const) {
    const all = composeTrack(parseMusicState(`style=${style}&seed=${seed}&bars=64`));
    const quiet = composeTrack(parseMusicState(`style=${style}&seed=${seed}&bars=64&quiet=console`));
    const fm = (bars: typeof all): number => bars.reduce((n, b) => n + b.notes.filter(x => x.voice === 'fm').length, 0);
    assert.ok(fm(all) >= 3, `${style} ${seed}: FM effects to start with (${fm(all)})`);
    assert.equal(fm(quiet), 0, `${style} ${seed}: none with the console off`);
    const rest = (bars: typeof all) => bars.map(b => b.notes.filter(x => !['fm', 'game', 'coin'].includes(x.voice)));
    assert.deepEqual(rest(quiet), rest(all), `${style} ${seed}: everything else as it was`);
  }
});
