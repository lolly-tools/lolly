// SPDX-License-Identifier: MPL-2.0
/**
 * The combo organ (lib/lofi-combo.ts): its violin tab's harmonics against the recorded tab,
 * the divider's octaves locked in tune, the vibrato's rate and lopsided swing, the keying
 * (at once, the contacts' bounce, gone in a few milliseconds), and the level.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-combo.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FULL, keyLevel, keys, tabHarmonics, vibratoCents, VIOLIN } from './lofi-combo.ts';
import type { VoiceKit } from './lofi-voices.ts';

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
const db = (x: number): number => 20 * Math.log10(x);

/** The recorded violin tab's harmonics 2 to 6 against the fundamental (dB), by key: the power within a quarter of the note either side, so the vibrato does not blur them. */
const RECORDED: Record<number, readonly number[]> = {
  48: [-5.4, -1.5, -6.0, -5.6, -8.7],
  60: [-9.9, -7.9, -14.0, -14.1, -17.6],
  72: [-10.8, -12.8, -16.9, -18.2, -20.5],
  84: [-12.3, -13.3, -17.9, -18.8, -21.5],
  96: [-10.8, -13.0, -16.9, -18.5, -20.6],
};

test('the violin tab sounds as the recorded tab does: harmonics 2 to 6 within 2.5 dB on every key, under 1 dB rms over them all', () => {
  const misses: number[] = [];
  for (const [midi, levels] of Object.entries(RECORDED)) {
    const h = tabHarmonics(VIOLIN, mtof(Number(midi)), 16000);
    levels.forEach((want, i) => {
      const got = db(h[i + 2]! / h[1]!);
      misses.push(got - want);
      assert.ok(Math.abs(got - want) < 2.5, `key ${midi}, harmonic ${i + 2}: ${got.toFixed(1)} dB against ${want}`);
    });
  }
  const rms = Math.sqrt(misses.reduce((a, b) => a + b * b, 0) / misses.length);
  assert.ok(rms < 1, `rms ${rms.toFixed(2)} dB`);
});

test('the tab is the divider staircase: a low key has its odd and even harmonics both, the even ones from the squares an octave and more up', () => {
  const h = tabHarmonics(VIOLIN, mtof(48), 16000);
  // Harmonic 3 (the 8' square's third) stays near the fundamental on a low key, as recorded.
  assert.ok(db(h[3]! / h[1]!) > -4);
  // Harmonics 2, 4 and 8 are the 4', 2' and 1' squares' fundamentals: each a step quieter.
  assert.ok(h[2]! > h[4]! && h[4]! > h[8]!);
  // Every harmonic a square can give is there, up to the top of the band.
  for (let n = 1; n < 30; n++) assert.ok(h[n]! > 0, `harmonic ${n}`);
  // The full registration's lowest footage sounds an octave under the key.
  const full = tabHarmonics(FULL, mtof(60), 16000);
  assert.equal(full.length - 1, Math.floor(16000 / (mtof(60) / 2)));
});

test('the notes grow a little louder up the keyboard, as the recorded ones did', () => {
  assert.ok(Math.abs(keyLevel(72)) < 1e-9);
  assert.ok(Math.abs(keyLevel(84) - 1.8) < 0.01);
  assert.ok(keyLevel(48) < -3);
});

test('the vibrato: 6.25 a second, the same for every key, swinging 4.6 cents sharp and 9.2 flat', () => {
  const at = Array.from({ length: 1600 }, (_, i) => vibratoCents(i / 1600 / 6.25));
  assert.ok(Math.abs(Math.max(...at) - 4.64) < 0.05, `sharpest ${Math.max(...at).toFixed(2)}`);
  assert.ok(Math.abs(Math.min(...at) + 9.2) < 0.05, `flattest ${Math.min(...at).toFixed(2)}`);
  assert.ok(Math.abs(vibratoCents(0.37) - vibratoCents(0.37 + 1 / 6.25)) < 1e-9, 'one cycle every 0.16 s');
});

// ── keys(), on a context that records what it is asked to do ───────────────────────

interface Ev { kind: string; v: number; t: number }
class Param {
  value = 0;
  events: Ev[] = [];
  setValueAtTime(v: number, t: number): void { this.events.push({ kind: 'set', v, t }); }
  setTargetAtTime(v: number, t: number, tau: number): void { this.events.push({ kind: 'target', v, t: t + tau * 1000 }); this.events.push({ kind: 'tau', v: tau, t }); }
}
class Node0 { connected: unknown[] = []; connect<T>(n: T): T { this.connected.push(n); return n; } }
class Osc extends Node0 {
  frequency = new Param(); detune = new Param(); wave: unknown = null; started = -1; stopped = -1;
  setPeriodicWave(w: unknown): void { this.wave = w; }
  start(t: number): void { this.started = t; }
  stop(t: number): void { this.stopped = t; }
}
class Gain extends Node0 { gain = new Param(); }
class Ctx {
  currentTime = 0; sampleRate = 44100;
  oscs: Osc[] = []; gains: Gain[] = []; waves: Array<{ real: Float32Array; imag: Float32Array }> = [];
  createOscillator(): Osc { const o = new Osc(); this.oscs.push(o); return o; }
  createGain(): Gain { const g = new Gain(); this.gains.push(g); return g; }
  createPeriodicWave(real: Float32Array, imag: Float32Array): { real: Float32Array; imag: Float32Array } { const w = { real, imag }; this.waves.push(w); return w; }
}
const kit = (): { k: VoiceKit; ctx: Ctx } => { const ctx = new Ctx(); return { ctx, k: { ctx: ctx as unknown as BaseAudioContext, noise: null as unknown as AudioBuffer, rng: () => 0.5 } }; };

test('a key: its tone and its vibrato, at once on the key, bounced as the contacts close, and stopped soon after it is let go', () => {
  const { ctx, k } = kit();
  keys(k, {} as AudioNode, 1, 60, 0.6, 0.5);
  assert.equal(ctx.oscs.length, 2, 'the tone and its vibrato');
  const [tone, vibrato] = ctx.oscs as [Osc, Osc];
  assert.ok(Math.abs(tone.frequency.value - mtof(60)) < 1e-9);
  assert.ok(vibrato.connected.includes(tone.detune), 'the vibrato swings the tone');
  assert.equal(tone.started, 1);
  assert.ok(tone.stopped > 1.5 && tone.stopped < 1.53, `stops ${tone.stopped}`);
  const g = ctx.gains[0]!.gain.events;
  const on = g.find(e => e.kind === 'set' && e.t === 1)!;
  assert.ok(on.v > 0, 'full level at the key');
  assert.ok(g.some(e => e.kind === 'set' && e.v === 0 && e.t > 1 && e.t < 1.001), 'the contacts bounce open');
  assert.ok(g.some(e => e.kind === 'set' && e.v === on.v && e.t > 1.0005 && e.t < 1.002), 'and close again');
  const tau = g.find(e => e.kind === 'tau')!;
  assert.ok(Math.abs(tau.t - 1.5) < 1e-9 && tau.v < 0.003, 'let go at the end, 20 dB down within a few milliseconds');
});

test('the divider locks each key to the octave above: every C is as far from equal temperament as every other', () => {
  const offsets = [48, 60, 72, 84].map((m) => { const { ctx, k } = kit(); keys(k, {} as AudioNode, 0, m, 0.6, 0.2); return ctx.oscs[0]!.detune.value; });
  assert.ok(offsets.every(v => v === offsets[0]), offsets.join());
  const notes = Array.from({ length: 12 }, (_, i) => { const { ctx, k } = kit(); keys(k, {} as AudioNode, 0, 60 + i, 0.6, 0.2); return ctx.oscs[0]!.detune.value; });
  assert.ok(notes.every(v => Math.abs(v) <= 1), 'the twelve within a cent');
  assert.ok(new Set(notes).size > 6, 'and not all the same');
});

test('keys struck together swing together; the strength only scales the level, never the tone', () => {
  const { ctx, k } = kit();
  for (const m of [60, 64, 67]) keys(k, {} as AudioNode, 2, m, 0.6, 1);
  const vib = ctx.oscs.filter((_, i) => i % 2 === 1).map(o => o.wave);
  assert.ok(vib.every(w => w === vib[0]), 'one vibrato phase for the chord');
  const soft = kit(), hard = kit();
  keys(soft.k, {} as AudioNode, 0, 60, 0.3, 1);
  keys(hard.k, {} as AudioNode, 0, 60, 0.9, 1);
  assert.deepEqual(soft.ctx.waves[0]!.imag, hard.ctx.waves[0]!.imag);
  const level = (c: Ctx): number => c.gains[0]!.gain.events.find(e => e.kind === 'set' && e.v > 0)!.v;
  assert.ok(Math.abs(level(hard.ctx) / level(soft.ctx) - 3) < 1e-9);
});

test('the full registration sounds its 16\' an octave under the key', () => {
  const { ctx, k } = kit();
  keys(k, {} as AudioNode, 0, 60, 0.6, 0.5, FULL);
  assert.ok(Math.abs(ctx.oscs[0]!.frequency.value - mtof(48)) < 1e-9);
});
