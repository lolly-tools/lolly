// SPDX-License-Identifier: MPL-2.0
/**
 * A spring reverb tank, modelled: the long two-spring tank of a guitar amp's reverb unit,
 * the sound of surf guitar. A transducer at one end twists the springs, the twist travels
 * along them and back, and a pickup at the far end hears each pass. A spring carries high
 * frequencies more slowly than low ones (it is dispersive), so every echo arrives as a
 * chirp, its low end first and its top a few tens of milliseconds later. That chirp after a
 * picked note is the tank's "drip".
 *
 * The model is a sum of the echoes, worked out in the frequency domain and turned into an
 * impulse response once per audio context and tank: each spring adds one pass's delay and
 * dispersion per echo, and loses what the tank's decay takes from a pass. A little diffuse
 * sound grows in under the echoes, as the springs' small irregularities scatter the wave.
 *
 * Fitted to recordings, used for measurement only (no recording is in this repository, only
 * numbers):
 * - an Accutronics 4EB2C1B two-spring tank, from 1,122 dry and wet guitar and bass notes
 *   (Martinez Ramirez, Benetos and Reiss, ICASSP 2020, Zenodo 3746119, CC BY 4.0),
 *   deconvolved: its echoes come every 58.5 and 76.7 ms (one spring each), it falls 60 dB in
 *   2.2 s at 500 Hz to 1 kHz, 2.1 at 2 kHz and 1.9 at 4, and its power response falls
 *   from +8 to +10 dB at 80 to 200 Hz (against 1 kHz) to -4 at 2 kHz, -9 at 4 kHz and -11 at 5;
 * - the spring reverb of a Roland RE-301, from its impulse response (Freesound 131034, CC0):
 *   each echo's chirp, its delay climbing from 1 kHz to the top of the band (+2 ms at 2 kHz,
 *   +7 at 3, +11 at 3.5, +22 at 4.4), fitted with a stretched all-pass's delay (its transition
 *   at 4,750 Hz, coefficient 0.4, 23.8 ms over a 43 ms pass) within a millisecond rms.
 * The surf amp's reverb unit drove the long-decay version of the measured tank (rated 2.75 to
 * 4 s, the measured one 1.75 to 3), so its decay is the measured tank's, a third longer at
 * every frequency.
 *
 * Pure apart from springInput, which builds the reverb unit's Web Audio graph.
 */
import { fftInPlace } from '../../../../engine/src/audio-analyse.ts';
import type { VoiceKit } from './lofi-voices.ts';

/** One spring: the time its echoes come apart (s), its level, and how much more slowly the top of the band travels a pass (s, at the transition). */
export interface Spring { trip: number; level: number; disperse: number }

export interface SpringTank {
  springs: readonly Spring[];
  /** The dispersion's transition (Hz), where a pass's delay climbs steepest, and its shape (the stretched all-pass's coefficient). */
  fc: number; shape: number;
  /** The decay: [Hz, seconds to fall 60 dB], log-spaced, held flat beyond the ends. */
  t60: ReadonlyArray<readonly [number, number]>;
  /** The tank's power response: [Hz, dB], as the measured one, held flat beyond the ends. */
  response: ReadonlyArray<readonly [number, number]>;
  /** The diffuse sound under the echoes: its level against theirs once it has grown in, and how long it takes to grow (s). */
  diffuse: number; grow: number;
  /** How long the impulse response runs (s). */
  seconds: number;
}

/**
 * The decay that gives the measured tank's: [Hz, T60 s]. The measured tank falls 60 dB in
 * 3.27 s at 125 Hz, 2.32 at 250, 2.23 at 500, 2.17 at 1 kHz, 2.09 at 2 kHz, 2.00 at 3 and 1.88
 * at 4 (octave bands, from the backward-integrated energy over 0.15 to 1 s). Each echo's
 * spread and the diffuse sound lengthen what an octave hears, so the table under the model is
 * fitted until the model, measured the same way, reads within 0.03 s of those up to 2 kHz
 * (0.09 at 3 kHz, 0.17 at 4).
 */
const MEASURED_T60: ReadonlyArray<readonly [number, number]> = [[125, 3.67], [250, 2.31], [500, 1.95], [1000, 1.7], [2000, 1.93], [3000, 1.35], [4000, 1.24]];
/** The long tank's decay against the measured one's: the midpoints of their rated decays, 3.4 s and 2.4 s. */
const LONG = 1.42;

/**
 * The long two-spring tank of a surf amp's reverb unit: the measured tank's echo times,
 * response and (a third longer) decay, with the chirp fitted to the recorded one. Each
 * spring's dispersion grows with its length.
 */
export const LONG_TANK: SpringTank = {
  springs: [{ trip: 0.0585, level: 1, disperse: 0.0238 * (0.0585 / 0.043) * 0.6 }, { trip: 0.0767, level: 1, disperse: 0.0238 * (0.0767 / 0.043) * 0.6 }],
  fc: 4750, shape: 0.4,
  t60: MEASURED_T60.map(([hz, s]) => [hz, s * LONG] as const),
  response: [[63, 2.8], [80, 8.3], [100, 10.1], [125, 9.1], [160, 10.3], [200, 8.4], [250, 7.3], [315, 4.1], [400, 6.5], [500, 2.6], [630, 5.9], [800, 1.5], [1000, 0], [1250, -1.1], [1600, 0.6], [2000, -4.3], [2500, -7.3], [3150, -6.2], [4000, -9.4], [5000, -10.9], [6300, -10.9], [7500, -13.2]],
  diffuse: 1, grow: 0.4,
  seconds: 3.6,
};

/** A table of [Hz, value] read at `hz`, straight lines on a log scale of frequency, flat past the ends. */
export function tableAt(table: ReadonlyArray<readonly [number, number]>, hz: number): number {
  if (hz <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [h1, v1] = table[i]!;
    if (hz <= h1) {
      const [h0, v0] = table[i - 1]!;
      return v0 + ((v1 - v0) * Math.log(hz / h0)) / Math.log(h1 / h0);
    }
  }
  return table[table.length - 1]![1];
}

/**
 * The extra delay of a pass at `hz` (s): a stretched first-order all-pass's group delay with
 * coefficient `a`, its period twice `fc`, brought to `disperse` at the transition and to
 * nothing at 0 Hz. It climbs slowly through the mids and steeply toward `fc`.
 */
export function passDelay(hz: number, fc: number, a: number, disperse: number): number {
  const g = (f: number): number => (1 - a * a) / (1 + 2 * a * Math.cos((Math.PI * f) / fc) + a * a);
  const g0 = (1 - a) / (1 + a), gfc = (1 + a) / (1 - a);
  return (disperse * (g(hz) - g0)) / (gfc - g0);
}

/**
 * The phase a pass adds at `hz` (radians): 2 pi times the integral of its delay from 0 Hz,
 * the all-pass's own phase, so the delay above holds exactly (`trip` is the delay at 0 Hz).
 */
function passPhase(hz: number, trip: number, fc: number, a: number, disperse: number): number {
  const theta = (Math.PI * hz) / fc;
  // The all-pass's phase, unwrapped: -arg((a + e^-jt) / (1 + a e^-jt)) rises from 0 by pi every period.
  const turns = Math.floor((theta + Math.PI) / (2 * Math.PI));
  const t = theta - turns * 2 * Math.PI;
  const lag = 2 * Math.atan2((1 - a) * Math.sin(t / 2), (1 + a) * Math.cos(t / 2)) + turns * 2 * Math.PI;
  const g0 = (1 - a) / (1 + a), gfc = (1 + a) / (1 - a);
  // The integral of g over frequency is (fc / pi) times the unwrapped phase.
  const integral = (disperse / (gfc - g0)) * ((fc / Math.PI) * lag - g0 * hz);
  return 2 * Math.PI * (trip * hz + integral);
}

/** A reader for a table at rising frequencies: the same values as tableAt, without searching from the start each time. */
function rising(table: ReadonlyArray<readonly [number, number]>): (hz: number) => number {
  let i = 1;
  const last = table.length - 1;
  return (hz: number): number => {
    if (hz <= table[0]![0]) return table[0]![1];
    while (i <= last && hz > table[i]![0]) i++;
    if (i > last) return table[last]![1];
    const lo = table[i - 1]!, hi = table[i]!;
    return lo[1] + ((hi[1] - lo[1]) * Math.log(hz / lo[0])) / Math.log(hi[0] / lo[0]);
  };
}

/** A small seeded source (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The highest frequency the tank passes worth working out (Hz): past that, its transducers are deep in their fall. */
const TOP = 8000;
/** Below this the tank's response falls away to nothing at 0 Hz (Hz). */
const LOW = 50;

/**
 * The tank's impulse response at `sr`: every spring's echoes, the k-th arriving k trips in
 * with k passes' dispersion and loss (summed exactly, as a geometric series per frequency),
 * through the tank's response, and the diffuse sound under them. Brought to unit energy.
 */
export function springImpulse(sr: number, tank: SpringTank, seed = 1): Float32Array {
  const len = Math.ceil(tank.seconds * sr);
  let n = 1;
  while (n < len * 1.6) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  const top = Math.min(TOP, sr * 0.45);
  const t60At = rising(tank.t60), dbAt = rising(tank.response);
  const springs = tank.springs;
  for (let k = 1; k <= n / 2; k++) {
    const hz = (k * sr) / n;
    if (hz > top) break;
    const t60 = t60At(hz);
    const gain = 10 ** (dbAt(hz) / 20);
    let sr0 = 0, si0 = 0;
    for (let j = 0; j < springs.length; j++) {
      const s = springs[j]!;
      // A pass takes longer at the top of the band (its dispersion), and the tank loses the same each second whatever the frequency.
      const loss = 10 ** ((-3 * (s.trip + passDelay(hz, tank.fc, tank.shape, s.disperse))) / t60);
      const ph = passPhase(hz, s.trip, tank.fc, tank.shape, s.disperse);
      // One pass: loss e^(-j ph); every echo: pass / (1 - pass).
      const pr = loss * Math.cos(ph), pi = -loss * Math.sin(ph);
      const dr = 1 - pr, di = -pi, dd = dr * dr + di * di;
      sr0 += (s.level * (pr * dr + pi * di)) / dd;
      si0 += (s.level * (pi * dr - pr * di)) / dd;
    }
    // Gentle edges at the top, so the band's end does not ring, and at the bottom, where no tank passes anything (nor a steady push).
    const edge = (hz > top * 0.8 ? 0.5 + 0.5 * Math.cos((Math.PI * (hz - top * 0.8)) / (top * 0.2)) : 1) * (hz < LOW ? (hz / LOW) ** 2 : 1);
    re[k] = gain * edge * sr0;
    im[k] = gain * edge * si0;
    if (k < n / 2) { re[n - k] = re[k]!; im[n - k] = -im[k]!; }
  }
  // The inverse transform, by the forward one on the conjugate.
  for (let k = 0; k < n; k++) im[k] = -im[k]!;
  fftInPlace(re, im);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = re[i]! / n;
  addDiffuse(out, sr, tank, seeded(seed));
  // A short fade at the end, and unit energy.
  const fade = Math.round(0.2 * sr);
  for (let i = 0; i < fade; i++) out[len - 1 - i] = out[len - 1 - i]! * (i / fade);
  let e = 0;
  for (let i = 0; i < len; i++) e += out[i]! * out[i]!;
  const scale = e > 0 ? 1 / Math.sqrt(e) : 0;
  for (let i = 0; i < len; i++) out[i] = out[i]! * scale;
  return out;
}

/**
 * The diffuse sound under the echoes: noise in four bands, each decaying at the tank's rate
 * there and shaped by its response, growing in from the first echo over `grow` seconds to
 * `diffuse` of the echoes' level at that moment.
 */
function addDiffuse(out: Float32Array, sr: number, tank: SpringTank, rand: () => number): void {
  if (tank.diffuse <= 0) return;
  const start = Math.round(Math.min(...tank.springs.map(s => s.trip)) * sr);
  // The echoes' own level over time, smoothed over 20 ms, to set the diffuse sound against.
  const win = Math.round(0.02 * sr);
  const level = new Float32Array(out.length);
  let acc = 0;
  for (let i = 0; i < out.length; i++) {
    acc += out[i]! * out[i]!;
    if (i >= win) acc -= out[i - win]! * out[i - win]!;
    level[i] = Math.sqrt(Math.max(0, acc) / win);
  }
  const bands = [[250, 0.9], [700, 0.9], [1800, 0.9], [3800, 0.9]] as const;
  const noise = new Float32Array(out.length);
  for (const [hz, q] of bands) {
    // A band-pass (constant peak gain) on fresh noise, its decay the tank's there.
    const w = (2 * Math.PI * hz) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
    const gain = 10 ** (tableAt(tank.response, hz) / 20);
    const fall = Math.exp(-6.91 / (tableAt(tank.t60, hz) * sr));
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, env = 1;
    for (let i = start; i < out.length; i++) {
      const v = rand() * 2 - 1;
      const y = b0 * v + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = y;
      noise[i] = noise[i]! + gain * env * y;
      env *= fall;
    }
  }
  // Scale the noise to `diffuse` of the echoes' level over the first half second after it grows in.
  const from = start + Math.round(tank.grow * sr), to = Math.min(out.length, from + Math.round(0.5 * sr));
  let en = 0, eo = 0;
  for (let i = from; i < to; i++) { en += noise[i]! * noise[i]!; eo += level[i]! * level[i]!; }
  const k = en > 0 ? tank.diffuse * Math.sqrt(eo / en) : 0;
  for (let i = start; i < out.length; i++) {
    const g = 1 - Math.exp(-(i - start) / (tank.grow * sr * 0.5));
    out[i] = out[i]! + k * g * noise[i]!;
  }
}

/** Each context's tank responses, made on first use. */
const IMPULSES = new WeakMap<BaseAudioContext, Map<SpringTank, AudioBuffer>>();
function impulseOf(ctx: BaseAudioContext, tank: SpringTank): AudioBuffer {
  let byTank = IMPULSES.get(ctx);
  if (!byTank) { byTank = new Map(); IMPULSES.set(ctx, byTank); }
  let buf = byTank.get(tank);
  if (!buf) {
    const data = springImpulse(ctx.sampleRate, tank);
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    byTank.set(tank, buf);
  }
  return buf;
}

/** How a reverb unit is set: its dwell (how hard the tank is driven; past about 1 the driver valve squashes the send), its mix (the tank's level against the dry), and its tone (a treble cut on the return, dB at 3 kHz). */
export interface ReverbUnit { dwell: number; mix: number; tone: number }

/** A curve for the driver valve: tanh, exactly zero at silence, slope one there. */
const DRIVER = ((): Float32Array<ArrayBuffer> => {
  const c = new Float32Array(2049);
  for (let i = 0; i < c.length; i++) { const x = ((i / (c.length - 1)) * 2 - 1) * 4; c[i] = Math.tanh(x); }
  return c;
})();

/** Each output's reverb units, by setting: built once, left running. */
const UNITS = new WeakMap<AudioNode, Map<string, GainNode>>();

/**
 * The reverb unit in front of an amp, as a surf guitarist set one up: the guitar goes straight
 * through to `out` and into the tank's driver (the dwell), and the tank's return (the mix)
 * joins the dry guitar there. Returns the unit's input.
 */
export function springInput(k: VoiceKit, out: AudioNode, unit: ReverbUnit, tank: SpringTank = LONG_TANK): GainNode {
  const key = `${unit.dwell}|${unit.mix}|${unit.tone}`;
  let byKey = UNITS.get(out);
  if (!byKey) { byKey = new Map(); UNITS.set(out, byKey); }
  const ready = byKey.get(key);
  if (ready) return ready;
  const { ctx } = k;
  const input = ctx.createGain();
  input.connect(out);
  const dwell = ctx.createGain();
  dwell.gain.value = unit.dwell / 4;
  const driver = ctx.createWaveShaper();
  driver.curve = DRIVER;
  driver.oversample = k.hq ? '4x' : '2x';
  const back = ctx.createGain();
  back.gain.value = 4 / Math.max(0.05, unit.dwell);
  const tankNode = ctx.createConvolver();
  tankNode.normalize = false;
  tankNode.buffer = impulseOf(ctx, tank);
  const tone = ctx.createBiquadFilter();
  tone.type = 'highshelf';
  tone.frequency.value = 3000;
  tone.gain.value = unit.tone;
  const mix = ctx.createGain();
  mix.gain.value = unit.mix;
  input.connect(dwell).connect(driver).connect(back).connect(tankNode).connect(tone).connect(mix).connect(out);
  byKey.set(key, input);
  return input;
}
