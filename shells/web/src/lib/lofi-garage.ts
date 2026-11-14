// SPDX-License-Identifier: MPL-2.0
/**
 * The warp bass ('warp'), UK garage's wobbling bassline: on some tunes the sub gives way
 * to a bass that bends and talks, as speed garage's did. Two saws a few cents apart through
 * a resonant low-pass whose cutoff swings in time with the beat (the composer's `mod`, 1 to
 * 7 swings a beat; 0 opens on the note and closes), a sine under them for the weight, a
 * slide up into the note from a fourth below (`mod` 8 or more), and the pitch sagging a
 * little as a long note ends, the warp that gives the bass its name. Driven a little, so a
 * small speaker hears its harmonics.
 *
 * In a bass stack (lib/lofi-bass-stack.ts) the sine is left to the stack's sub, and the
 * second take's swing starts out of step with the first (`tone.phase`).
 */
import { drivenBy, EPS, mtof, osc, type Tone, type VoiceKit } from './lofi-voices.ts';

/** The basses this module plays. */
export const GARAGE_BASSES = new Set<string>(['warp']);
/** The note's level after the drive: as loud as the deep-house bass in a garage drop (measured, K-weighted, 1.8 dB over it at 0.3). */
const LEVEL = 0.25;

/** Play a warp bass note: `mod` is its swings a beat plus 8 for a slide, `spb` the seconds a beat. */
export function bass(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod: number, spb: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const hold = Math.max(0.05, dur);
  const end = t + hold + 0.2;
  const swings = Math.round(mod) % 8;
  const slide = mod >= 8;
  const [push, ws] = drivenBy(ctx, 0.6 + 0.3 * tone.drive);
  const amp = ctx.createGain();
  const peak = LEVEL * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  amp.gain.setTargetAtTime(peak * 0.85, t + 0.05, 0.2);
  amp.gain.setTargetAtTime(EPS, t + hold, 0.04);
  ws.connect(amp).connect(out);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 6;
  const low = Math.max(90, f * 2.2 * tone.bright);
  const high = Math.min(2400, f * 11 * tone.bright);
  if (swings > 0) {
    // The swing: a sine at the beat's rate moving the cutoff between low and high. A second
    // take starts part of a cycle on, so the two never swing quite together.
    const rate = swings / spb;
    const lfo = osc(k, 'sine', rate, Math.max(0, t - (tone.phase ?? 0) / rate), end);
    const depth = ctx.createGain();
    depth.gain.value = (high - low) / 2;
    lp.frequency.setValueAtTime((high + low) / 2, t);
    lfo.connect(depth).connect(lp.frequency);
  } else {
    lp.frequency.setValueAtTime(high, t);
    lp.frequency.exponentialRampToValueAtTime(low, t + Math.min(0.3, hold));
  }
  lp.connect(push);
  const pitch = (o: OscillatorNode, ratio: number): void => {
    const target = f * ratio;
    if (slide) {
      o.frequency.setValueAtTime(target * 2 ** (-5 / 12), t);
      o.frequency.exponentialRampToValueAtTime(target, t + 0.08);
    }
    // The warp: a long note sags a semitone as it ends.
    if (hold > 0.35) {
      o.frequency.setValueAtTime(target, t + hold - 0.08);
      o.frequency.exponentialRampToValueAtTime(target * 2 ** (-1 / 12), t + hold);
    }
  };
  const cents = tone.take === 1 ? [4, 13] : [-11, -2];
  for (const c of cents) {
    const saw = osc(k, 'sawtooth', f, t, end);
    saw.detune.value = c;
    pitch(saw, 1);
    const g = ctx.createGain();
    g.gain.value = 0.32;
    saw.connect(g).connect(lp);
  }
  if (tone.sub !== false) {
    const sine = osc(k, 'sine', f, t, end);
    pitch(sine, 1);
    const sg = ctx.createGain();
    sg.gain.value = 0.55;
    sine.connect(sg).connect(push);
  }
}
