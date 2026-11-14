// SPDX-License-Identifier: MPL-2.0
/**
 * Lofi house's own instrument, called by the station as the world voices and the guitars
 * are, so lofi-voices.ts stays under its size limit.
 *
 * The deep-house bass ('deep'): the bass is the loudest thing in a lofi house record, warm
 * and round, and it still reads on a phone's speaker. So it is two layers driven a little
 * hard into a soft clip, the way an old sampler's input warms a bass sample:
 * - a sine at the note, the weight you feel (a lofi house line sits between about 45 and
 *   130 Hz, so the note itself is the sub);
 * - a saw at the note through a low-pass that opens with each note and settles, the
 *   rounded "bwom" whose second to sixth harmonics are what a small speaker plays.
 * The clip adds the odd harmonics a little saturation gives, and a low-pass after it keeps
 * the top dark. Velocity sets the loudness after the clip, so a softer note is quieter, not
 * cleaner. Each note starts a hair sharp and settles into pitch, as a plucked synth bass
 * does.
 */
import { drivenBy, mtof, osc, EPS, type Tone, type VoiceKit } from './lofi-voices.ts';

/** The basses this module plays. */
export const HOUSE_BASSES = new Set<string>(['deep']);

/** The note's level after the clip, against the round bass's (measured, K-weighted, on the same line). */
const DEEP_LEVEL = 0.375;

/** Play a deep-house bass note. `tone` is the tune's brightness (the saw's filter) and drive (how hard the clip is pushed). */
export function bass(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.25;
  // The clip: pushed a little, more the more drive the tune draws (lofi house's 1.4 to 2.2).
  const [push, ws] = drivenBy(ctx, 0.55 + 0.2 * tone.drive);
  const dark = ctx.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = 1600 * tone.bright;
  dark.Q.value = 0.5;
  const amp = ctx.createGain();
  const peak = DEEP_LEVEL * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  amp.gain.setTargetAtTime(peak * 0.82, t + 0.06, 0.2);   // it settles a little after the attack
  amp.gain.setTargetAtTime(EPS, t + dur, 0.035);
  ws.connect(dark).connect(amp).connect(out);
  // The weight: a sine at the note. A bass stack's second take leaves the sine out: the
  // stack's own sub carries the weight, and the first take's sine still warms the clip.
  if (tone.take !== 1) {
    const sine = osc(k, 'sine', f * 1.012, t, end);
    sine.frequency.exponentialRampToValueAtTime(f, t + 0.025);
    const sg = ctx.createGain();
    sg.gain.value = 0.4;
    sine.connect(sg).connect(push);
  }
  // The body: a saw through a filter that opens on the note and closes to a couple of harmonics.
  const saw = osc(k, 'sawtooth', f * 1.012, t, end);
  saw.frequency.exponentialRampToValueAtTime(f, t + 0.025);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  const open = Math.max(250, Math.min(1400, f * 6 * tone.bright * (0.7 + 0.3 * vel)));
  const shut = Math.max(120, Math.min(500, f * 2.5 * tone.bright));
  lp.frequency.setValueAtTime(open, t);
  lp.frequency.exponentialRampToValueAtTime(shut, t + 0.14);
  const bg = ctx.createGain();
  bg.gain.value = 0.18;
  saw.connect(lp).connect(bg).connect(push);
}
