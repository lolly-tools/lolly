// SPDX-License-Identifier: MPL-2.0
/**
 * The house organ ('houseOrgan'): the bright, percussive organ that plays the stabs and
 * the bass riffs of nineties house and UK garage. Not a tonewheel organ held under a
 * rotating speaker (lofi-voices.ts organ): this one speaks with a pop and falls straight
 * back, so a short stab is mostly attack and a held chord sits well under the attack.
 *
 * Built from what the records have, not from any instrument's preset:
 * - a drawbar-like spectrum at the played pitch (the fundamental and its second, third,
 *   fourth, sixth and eighth harmonics, the second nearly as strong as the first and the
 *   fourth over the third), which is the hollow, nasal colour of the sound;
 * - a percussive pop, the third harmonic struck and gone in about a tenth of a second, and
 *   the whole note falling from its attack to a little under half within about a fifth of
 *   a second;
 * - a key click, a breath of noise in the first few milliseconds;
 * - two voices a few cents apart, one each side, for the chorus that widens it in a mix;
 * - a gentle bump around 1.2 kHz and a roll-off above about 6 kHz, brighter struck harder.
 */
import { crack, EPS, mtof, osc, type VoiceKit } from './lofi-voices.ts';

/** The note's level at its attack: on the same stabs it measured 11.6 dB under the Rhodes (K-weighted), and a
 *  short, falling sound measures quieter than it sounds, so it takes about four-fifths of that back. */
const LEVEL = 0.2;
/** Where the note settles after the pop, against the attack, and how quickly it gets there (s). */
const SETTLE = 0.42;
const FALL = 0.18;

const WAVES = new WeakMap<BaseAudioContext, PeriodicWave>();
function organWave(ctx: BaseAudioContext): PeriodicWave {
  let wave = WAVES.get(ctx);
  if (!wave) {
    // Harmonics 1 to 8 of the played note.
    const amp = [0, 1, 0.75, 0.42, 0.55, 0.12, 0.3, 0.05, 0.22];
    wave = ctx.createPeriodicWave(new Float32Array(amp.length), Float32Array.from(amp));
    WAVES.set(ctx, wave);
  }
  return wave;
}

/** One stereo pair of panners per keys lane, made once: a note is then oscillators and gains. */
const SIDES = new WeakMap<AudioNode, readonly [AudioNode, AudioNode]>();
function sidesOf(ctx: BaseAudioContext, out: AudioNode): readonly [AudioNode, AudioNode] {
  let sides = SIDES.get(out);
  if (!sides) {
    const make = (pan: number): AudioNode => {
      const bump = ctx.createBiquadFilter();
      bump.type = 'peaking';
      bump.frequency.value = 1200;
      bump.Q.value = 0.9;
      bump.gain.value = 3;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      bump.connect(p).connect(out);
      return bump;
    };
    sides = [make(-0.45), make(0.45)];
    SIDES.set(out, sides);
  }
  return sides;
}

/** Play a house-organ note. */
export function houseOrgan(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const hold = Math.max(0.04, dur);
  const end = t + hold + 0.2;
  const sides = sidesOf(ctx, out);
  const peak = LEVEL * vel;
  const top = Math.min(9000, 4200 + 3000 * vel);
  // The two voices, a few cents apart, one each side, each through its own envelope.
  sides.forEach((side, n) => {
    const o = ctx.createOscillator();
    o.setPeriodicWave(organWave(ctx));
    o.frequency.setValueAtTime(f, t);
    o.detune.value = (n ? 5 : -5) + (k.rng() - 0.5) * 2;
    o.start(t);
    o.stop(end);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    lp.frequency.value = top;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(EPS, t);
    amp.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.002);
    amp.gain.setTargetAtTime(peak * 0.5 * SETTLE, t + 0.004, FALL / 3);
    amp.gain.setTargetAtTime(EPS, t + hold, 0.03);
    o.connect(lp).connect(amp).connect(side);
  });
  // The pop: the third harmonic struck, gone in about a tenth of a second, in the middle.
  const pop = osc(k, 'sine', f * 3, t, t + 0.25);
  const pg = ctx.createGain();
  pg.gain.setValueAtTime(EPS, t);
  pg.gain.exponentialRampToValueAtTime(peak * 0.3, t + 0.0015);
  pg.gain.setTargetAtTime(EPS, t + 0.003, 0.035);
  pop.connect(pg).connect(out);
  crack(k, out, t, 0.035 * vel, 2600, 0.005);   // the key click
}
