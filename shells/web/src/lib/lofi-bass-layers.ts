// SPDX-License-Identifier: MPL-2.0
/**
 * The layered basses of the bass styles (BASS_LAYERED in the composer), over the main bass
 * and under the soar's harmony:
 * - the travelling line: two saws a few cents apart and a square an octave down, through
 *   a low-pass that opens on each new note and settles, gliding from the note before when
 *   it follows straight on, as a mono synth's portamento does;
 * - the percussive bass: a short punch of frequency modulation (the modulator at the
 *   note, its depth falling away in 80 ms, so the note starts bright and knocks) over a
 *   square through a fast-closing filter, with a click.
 */
import { EPS, mtof, noiseAt, osc, type VoiceKit } from './lofi-voices.ts';

/** The travelling line, at `midi`, gliding from `from` (a MIDI note) when it follows straight on. */
export function travel(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, from?: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.06, dur);
  const end = t + len + 0.08;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 4;
  if (from === undefined) {
    lp.frequency.setValueAtTime(1700 * (0.7 + vel * 0.5), t);
    lp.frequency.exponentialRampToValueAtTime(650, t + 0.16);
  } else lp.frequency.setValueAtTime(800, t);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(TRAVEL_LEVEL * vel, t + (from === undefined ? 0.006 : 0.02));
  amp.gain.setTargetAtTime(EPS, t + len, 0.03);
  lp.connect(amp).connect(out);
  const start = from === undefined ? f : mtof(from);
  for (const [type, ratio, cents, level] of [['sawtooth', 1, -8, 0.5], ['sawtooth', 1, 8, 0.5], ['square', 0.5, 0, 0.45]] as const) {
    const o = osc(k, type, start * ratio, t, end);
    if (from !== undefined) o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.05);
    o.detune.value = cents;
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
}
/** The travelling line's level against the main bass. */
const TRAVEL_LEVEL = 0.3;

/** The percussive bass: one short knock at `midi`. */
export function stab(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + 0.2;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(STAB_LEVEL * vel, t + 0.002);
  amp.gain.exponentialRampToValueAtTime(EPS, t + 0.16);
  amp.connect(out);
  const car = osc(k, 'sine', f, t, end);
  const mod = osc(k, 'sine', f, t, end);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(f * 3.2 * (0.6 + vel * 0.5), t);
  depth.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.08);
  mod.connect(depth).connect(car.frequency);
  car.connect(amp);
  const sq = osc(k, 'square', f, t, end);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.06);
  const sg = ctx.createGain();
  sg.gain.value = 0.35;
  sq.connect(lp).connect(sg).connect(amp);
  const click = ctx.createGain();
  click.gain.setValueAtTime(0.25 * vel, t);
  click.gain.exponentialRampToValueAtTime(EPS, t + 0.004);
  noiseAt(k, t, 0.006).connect(click).connect(amp);
}
/** The percussive bass's level against the main bass. */
const STAB_LEVEL = 0.95;
