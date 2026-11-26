// SPDX-License-Identifier: MPL-2.0
/**
 * Bilma, the hardwood clapsticks: two sticks struck together, worked out sample by sample.
 * A struck stick rings as a free bar does, its modes at 1, 2.76 and 5.40 times its lowest
 * (the bending modes of a bar free at both ends), and the two sticks ring at their own
 * pitches a little apart. The contact itself is a short, bright click of noise. The ring
 * falls fast while the hands still hold the sticks, then lingers a little: a bright, dry,
 * pitched click with a short ring.
 *
 * Measured against recorded hardwood sticks (numbers only; none is in this repository):
 * claves played one at a time (Wikimedia Commons, public domain) ring at one clear pitch
 * near 2.66 kHz, the next peaks 12 to 20 dB down, the ring 20 dB down by about 34 ms and
 * 40 dB down by about 210 ms, the spectrum's centroid about 3.3 kHz; two sticks clapped
 * (Freesound 367051 and 277585, CC0) put more noise in the click, centroid about 4.5 kHz.
 * The model's sticks: see BILMA_MEASURED in the tests.
 *
 * bilma() is pure (no DOM, no Web Audio; deterministic for the same seed); play() hands a hit
 * to the station's audio graph.
 */
import { seededRandom } from './lofi-breath.ts';
import type { VoiceKit } from './lofi-voices.ts';

/** A bar free at both ends: its bending modes, as multiples of the lowest. */
const MODES = [1, 2.756, 5.404] as const;
/** Each mode's level against the lowest, and how much faster it fades (a higher mode loses its energy sooner). */
const LEVELS = [1, 0.1, 0.03] as const;
const FADES = [1, 1.8, 3] as const;
/** The ring: most of it gone fast while the hands hold the sticks (s), the rest lingering (s), and that rest's share. */
const FAST = 0.0105;
const SLOW = 0.1;
const LINGER = 0.1;
/** The second stick against the first: its pitch and its level. */
const PAIR = 1.065;
const PAIR_LEVEL = 0.4;
/** The click of the contact: how long (s), how loud against the ring, and where its noise is (a one-pole high-pass, Hz). */
const CLICK = 0.0016;
const CLICK_LEVEL = 0.4;
const CLICK_FROM = 2500;
/** How long a hit lasts (s). */
const LENGTH = 0.32;

/**
 * One hit of the bilma: `f` the first stick's pitch (Hz, about 2 to 3 kHz), `strength` how hard
 * (0 to 1: a harder hit is louder, its click and higher modes brighter), `seed` the hit's own
 * (each hit meets the sticks a little differently).
 */
export function bilma(sr: number, f: number, strength: number, seed: number): Float32Array {
  const n = Math.round(LENGTH * sr);
  const out = new Float32Array(n);
  const r = seededRandom(seed >>> 0);
  const s = Math.min(1, Math.max(0.05, strength));
  // Each hit meets the sticks a little differently: a touch of pitch, and how much of the second stick.
  const sticks: Array<[number, number]> = [[f * (1 + (r() - 0.5) * 0.006), 1], [f * PAIR * (1 + (r() - 0.5) * 0.008), PAIR_LEVEL * (0.7 + 0.6 * r())]];
  const bright = 0.6 + 0.8 * s;
  for (const [hz, level] of sticks) {
    for (let m = 0; m < MODES.length; m++) {
      const fm = hz * MODES[m]!;
      if (fm >= sr * 0.45) continue;
      const a = level * LEVELS[m]! * (m === 0 ? 1 : bright);
      const w = (2 * Math.PI * fm) / sr;
      const fast = Math.exp(-FADES[m]! / (FAST * sr)), slow = Math.exp(-FADES[m]! / (SLOW * sr));
      let gf = 1 - LINGER, gs = LINGER;
      const phase = r() * 2 * Math.PI;
      for (let i = 0; i < n; i++) {
        out[i]! += a * (gf + gs) * Math.sin(w * i + phase);
        gf *= fast; gs *= slow;
      }
    }
  }
  // The click: a burst of high noise as the wood meets.
  const c = Math.round(CLICK * sr), pole = Math.exp((-2 * Math.PI * CLICK_FROM) / sr);
  let lp = 0;
  for (let i = 0; i < c; i++) {
    const x = r() * 2 - 1;
    lp = pole * lp + (1 - pole) * x;
    const env = Math.sin((Math.PI * i) / c);
    out[i]! += (x - lp) * env * CLICK_LEVEL * bright;
  }
  // The stick's first instant: the ring's start ramps over a few samples, as the wood takes the blow.
  const ramp = Math.round(0.0004 * sr);
  for (let i = 0; i < ramp && i < n; i++) out[i]! *= i / ramp;
  const g = 0.25 + 0.75 * s;
  for (let i = 0; i < n; i++) out[i]! *= g;
  return out;
}

/** The bilma's level into the drums' lane, against the kit (set by measurement: see the station's genre notes). */
const LEVEL = 0.3;

/** Play one hit of the bilma: `midi` the first stick's pitch, `vel` how hard. */
export function play(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number): void {
  const { ctx } = k;
  const sr = ctx.sampleRate;
  const x = bilma(sr, 440 * 2 ** ((midi - 69) / 12), vel, Math.floor(k.rng() * 4294967296));
  const buf = ctx.createBuffer(1, x.length, sr);
  buf.getChannelData(0).set(x);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = LEVEL;
  src.connect(g).connect(out);
  src.start(Math.max(t, ctx.currentTime));
}
