// SPDX-License-Identifier: MPL-2.0
/**
 * The guitars of grunge, stoner rock and shoegaze, built on the modelled strings and the
 * amp model in lofi-voices.ts:
 * - clean: a clean electric heard at the neck pickup through a chorus pedal, two short
 *   delays swaying a few milliseconds either side of the dry string, one each side, the
 *   watery, shimmering tone of a grunge verse;
 * - fuzz: a power chord through a fuzz pedal into a big valve amp, looser in the low end
 *   than metal's and less scooped, double-tracked, the wall of a grunge chorus;
 * - wall: shoegaze's full chords swelling in through a softer fuzz, each string swaying
 *   with the tremolo arm, so the chord blurs into one wash that the room then smears.
 */
import { ampInput, pluckLevel, strings, stringBuffer, mtof, EPS, type Amp, type VoiceKit } from './lofi-voices.ts';

export const GUITAR_KEYS = new Set<string>(['clean', 'fuzz', 'wall']);

/** A fuzz pedal into a big valve amp: a great deal of gain, the low end left loose and big, the mids only a little scooped. */
const FUZZ_AMP: Amp = { gain: 22, tight: 75, push: [600, 3], low: [100, 6], mids: [750, -4], presence: [2400, 2], cab: 4400, level: 0.065 };
/** Shoegaze's fuzz: softer, the mids left in and the top rolled off, so a chord is a wash rather than a bite. */
const WALL_AMP: Amp = { gain: 9, tight: 90, push: [700, 2], low: [140, 3], mids: [1200, 2], presence: [2600, -2], cab: 3600, level: 0.05 };

export function keys(style: string, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  if (style === 'clean') clean(k, out, t, midi, vel, dur);
  else if (style === 'fuzz') fuzz(k, out, t, midi, vel, dur);
  else wall(k, out, t, midi, vel, dur);
}

/** A power chord an octave below the note (root, fifth, the octave on held chords) through the fuzz, double-tracked; a short note is palm-muted. */
function fuzz(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const root = mtof(midi - 12);
  const chug = dur < 0.18;
  strings(k, ampInput(k, out, FUZZ_AMP, true), t, chug ? [root, root * 1.5] : [root, root * 1.5, root * 2], vel, dur, chug, false);
}

/** One string of a shoegaze chord: it swells in over a tenth of a second and sways with the tremolo arm, through the soft fuzz. */
function wall(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const swell = k.ctx.createGain();
  swell.gain.setValueAtTime(EPS, t);
  swell.gain.exponentialRampToValueAtTime(1, t + 0.1);
  swell.connect(ampInput(k, out, WALL_AMP, true));
  strings(k, swell, t, [mtof(midi)], vel, Math.max(dur, 0.6), false, true);
}

/** A chorus pedal per output: the dry signal, and two short delays swaying either side of it, one each side. */
const CHORUSES = new WeakMap<AudioNode, GainNode>();
function chorusInput(k: VoiceKit, out: AudioNode): GainNode {
  const ready = CHORUSES.get(out);
  if (ready) return ready;
  const { ctx } = k;
  const input = ctx.createGain();
  input.connect(out);
  for (const [pan, rate, base] of [[-0.7, 0.62, 0.007], [0.7, 0.83, 0.0095]] as const) {
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = base;
    const sway = ctx.createOscillator();
    sway.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = 0.0028;
    sway.connect(depth).connect(delay.delayTime);
    sway.start(ctx.currentTime);
    const side = ctx.createStereoPanner();
    side.pan.value = pan;
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    input.connect(delay).connect(wet).connect(side).connect(out);
  }
  CHORUSES.set(out, input);
  return input;
}

/** A clean electric string at the neck pickup, through the chorus: the note rings until the hand lets go. */
function clean(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const hard = vel >= 0.6;
  const src = ctx.createBufferSource();
  src.buffer = stringBuffer(ctx, { f: mtof(midi), seconds: 2.4, pickAt: 0.15, bright: hard ? 16 : 10, decay: 3.5, mellow: 10, pickup: 0.25, noise: 0.15, top: 5500 }, k.rng() < 0.5 ? 0 : 1);
  src.detune.value = (k.rng() - 0.5) * 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(CLEAN_LEVEL * pluckLevel(vel), t);
  g.gain.setTargetAtTime(EPS, t + Math.max(0.1, dur), 0.08);
  src.connect(g).connect(chorusInput(k, out));
  src.start(t);
  src.stop(t + Math.max(0.1, dur) + 0.6);
}
/** The clean guitar's level against the other plucked keys. */
const CLEAN_LEVEL = 0.4;
