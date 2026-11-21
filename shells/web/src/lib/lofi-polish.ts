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
}

const FINISH: Partial<Record<LofiMood, Finish>> = {
  sherbert: { side: 3, from: 500, air: 4, airFrom: 4800 },
};

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
  input.connect(split);
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
  merge.connect(into);
  return input;
}
