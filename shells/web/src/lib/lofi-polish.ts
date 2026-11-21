// SPDX-License-Identifier: MPL-2.0
/**
 * A style's finish, after the station's compressor: more width above the low mids and a
 * lift of the air, for the styles whose records are mixed that way.
 *
 * Measured 2026-11-21 against produced future bass (measurement only): in its drops the
 * side of the mix sits 1.5 to 3.5 dB under the middle from 500 Hz up, and the octaves from
 * 4 to 16 kHz sit 13 to 15 dB under the whole. Sherbert measured 5 to 9 dB and 17 to 21 dB,
 * narrower and duller, with the same balance below 2 kHz. The widening only raises what
 * is already different between the speakers, above `from`, so the low end stays in the
 * middle and the mix still sums to one channel cleanly.
 */
import type { LofiMood } from '../../../../engine/src/lofi-compose.ts';

interface Finish {
  /** How far the side is raised (dB), and from what frequency (Hz). */
  side: number;
  from: number;
  /** A shelf over `airFrom` (dB). */
  air: number;
  airFrom: number;
  /** A broad lift or cut of the middle (dB at Hz), where a chip or a synth lead carries the tune. */
  mid?: readonly [number, number];
  /** How far the whole mix is raised (dB) into a soft ceiling, for the styles whose records are loud; 0 is the ceiling alone. */
  lift?: number;
}

const FINISH: Partial<Record<LofiMood, Finish>> = {
  sherbert: { side: 3, from: 500, air: 4, airFrom: 4800, lift: 3 },
  // The bass styles: produced drops sit about 10 dB louder than these did, with 5 dB less
  // between their peaks and their average. A 3 dB lift into a soft ceiling goes part of the
  // way and leaves the drums their snap. Drum and bass's tops were 15 to 22 dB narrower than
  // its middle above 1 kHz, where its records are wide.
  dubstep: { side: 2, from: 600, air: 1, airFrom: 6000, lift: 3 },
  brostep: { side: 2, from: 600, air: 1, airFrom: 6000, lift: 3 },
  electro: { side: 2, from: 600, air: 1, airFrom: 6000, lift: 3 },
  dnb: { side: 5, from: 600, air: 2, airFrom: 5500, lift: 3 },
  dnbJump: { side: 5, from: 600, air: 2, airFrom: 5500, lift: 3 },
  dnbDark: { side: 5, from: 600, air: 1.5, airFrom: 5500, lift: 3 },
  dnbLiquid: { side: 6, from: 500, air: 2.5, airFrom: 5500, lift: 2 },
  dnbDeep: { side: 4, from: 600, air: 1, airFrom: 5500, lift: 2 },
  dnbRave: { side: 5, from: 600, air: 2, airFrom: 5500, lift: 3 },
  // The chip and retro styles, measured 2026-11-21 against classic chip and console music
  // (measurement only). There the octave from 500 Hz to 1 kHz is the loudest thing in the
  // mix (2 to 7 dB under the whole), the top octave is rolled away (21 to 29 dB under), the
  // mix is close to one channel, and it sits near -15 dBFS. Chiptune measured 11 dB down in
  // that octave, 16 dB down at the top (brighter than a console) and 10 dB quieter;
  // synthwave 14 to 16 dB down in the middle. Sugar is the modern side of the same family:
  // its top was 5 dB duller and its sides 12 dB narrower than produced records of its kind.
  chiptune: { side: 0, from: 500, air: -5, airFrom: 7000, mid: [3, 750], lift: 6 },
  synthwave: { side: 2, from: 500, air: 0, airFrom: 7000, mid: [3, 900], lift: 4 },
  sugar: { side: 5, from: 500, air: 3, airFrom: 5500, mid: [1.5, 800], lift: 3 },
  // Italo disco and Balearic measured nearly one channel (correlation 0.97): their chords and echoes are opened out.
  italo: { side: 4, from: 400, air: 1.5, airFrom: 6000, lift: 0 },
  balearic: { side: 5, from: 300, air: 1.5, airFrom: 6000, lift: 0 },
};

/** A soft ceiling: a straight line up to 0.7 of full level, then a curve that never passes 0.98. */
const CEILING = ((): Float32Array<ArrayBuffer> => {
  const c = new Float32Array(2049);
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 4 - 2;   // drawn for -2 to 2: a peak over full level still meets the curve
    const a = Math.abs(x);
    const y = a <= 0.7 ? a : 0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28);
    c[i] = Math.sign(x) * y;
  }
  return c;
})();

/** The finish for `mood` in front of `into`: returns where the station's compressor connects (`into` itself for a style with none). */
export function finish(ctx: BaseAudioContext, mood: LofiMood, into: AudioNode): AudioNode {
  const f = FINISH[mood];
  if (!f) return into;
  const input = ctx.createBiquadFilter();
  input.type = 'highshelf';
  input.frequency.value = f.airFrom;
  input.gain.value = f.air;
  // Left and right pass straight through; the side above `from` is added to the left and taken from the right.
  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  if (f.mid) {
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = f.mid[1];
    mid.Q.value = 0.8;
    mid.gain.value = f.mid[0];
    input.connect(mid).connect(split);
  } else input.connect(split);
  split.connect(merge, 0, 0);
  split.connect(merge, 1, 1);
  const side = ctx.createGain();
  side.channelCount = 1;
  side.channelCountMode = 'explicit';
  const half = ctx.createGain();
  half.gain.value = 0.5;
  const minusHalf = ctx.createGain();
  minusHalf.gain.value = -0.5;
  split.connect(half, 0).connect(side);
  split.connect(minusHalf, 1).connect(side);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = f.from;
  hp.Q.value = Math.SQRT1_2;
  const more = ctx.createGain();
  more.gain.value = 10 ** (f.side / 20) - 1;
  const flip = ctx.createGain();
  flip.gain.value = -1;
  side.connect(hp).connect(more);
  more.connect(merge, 0, 0);
  more.connect(flip).connect(merge, 0, 1);
  if (f.lift === undefined) { merge.connect(into); return input; }
  const up = ctx.createGain();
  // The shaper reads -1 to 1 across its curve, and the curve is drawn for -2 to 2, so the signal goes in at half.
  up.gain.value = 0.5 * 10 ** (f.lift / 20);
  const ceiling = ctx.createWaveShaper();
  ceiling.curve = CEILING;
  ceiling.oversample = '2x';
  merge.connect(up).connect(ceiling).connect(into);
  return input;
}
