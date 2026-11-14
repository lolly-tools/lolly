// SPDX-License-Identifier: MPL-2.0
/**
 * Granular pads for botanica (engine/src/lofi-botanica.ts): one of Lolly's own instruments
 * or voices, rendered, then cut into grains (tens of milliseconds each, under a smooth
 * window) and played back reordered, reversed, pitched and stretched into a pad that
 * shimmers. The sources are the instruments' own models: the felt piano's partials, the
 * modelled steel, nylon and harp strings (lib/lofi-strings.ts), the bowed fiddle
 * (lib/lofi-bowed.ts), the jet-blown flute (lib/lofi-flutes.ts), the chopped voice singing
 * an open vowel (lib/lofi-chop.ts) and a breath (lib/lofi-breath.ts) through the note's
 * resonances. Nothing is recorded.
 *
 * A cloud says how the grains are played: a shimmer (short grains, dense, some an octave
 * above), a reverse swell (longer grains, most played backwards), a stretch (long grains
 * scanning slowly through the note, twenty times slower than it was played), or a scatter
 * (sparse, short, wide across the speakers, glinting octaves up). Every choice comes from
 * the seed, so a pad is the same bytes every time.
 *
 * The cost is in the rendering, so each source note is rendered once per tune and pitch
 * and each pad once per chord tone, cloud and length (see grainBuffer): a tune's repeated
 * progression plays its pads again from the cache. Pure, apart from the player at the end.
 */
import { readGrain, type BotanicaCloud, type BotanicaSource } from '../../../../engine/src/lofi-botanica.ts';
import { pluckString } from './lofi-strings.ts';
import { bowString } from './lofi-bowed.ts';
import { blowFlute } from './lofi-flutes.ts';
import { chopVocal, singChop, CHOP_PLAIN } from './lofi-chop.ts';
import { inhale } from './lofi-breath.ts';
import { Biquad, mix, seeded, type Stereo } from './lofi-nature.ts';

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

// ── the sources ──────────────────────────────────────────────────────────────

/**
 * How long a source note is rendered (s). The grains read from its sounding part only: a
 * stretch scans a twentieth of real time and a shimmer about an eighth, both wrapping, so
 * a nine-second pad reads under a second and a half of its source.
 */
const SOURCE_SECONDS = 1.8;

/** A source note: its samples, and the pitch ratio that brings it back to the note asked for (a note rendered an octave off sounds right played at 2 or 0.5). */
export interface Source { data: Float32Array; ratio: number }

/** Each source's comfortable range (MIDI), where its model plays well: a note outside is rendered octaves in and moved back by the grains. */
const RANGE: Record<BotanicaSource, readonly [number, number]> = {
  piano: [40, 96], guitar: [40, 84], nylon: [40, 81], harp: [36, 96], fiddle: [55, 93], flute: [60, 96], voice: [55, 79], breath: [48, 84],
};

/**
 * The felt piano of lib/lofi-voices.ts, by its own recipe: a triangle at the note and sines
 * at the next three partials (2.003, 3.01, 4.02 times, at 0.38, 0.14 and 0.05), through a
 * low-pass that closes from five times the note to two and a half over 0.8 s, struck and
 * fading, with the felt's thump.
 */
function feltNote(sr: number, f: number, seconds: number, r: () => number): Float32Array {
  const n = Math.ceil(seconds * sr);
  const out = new Float32Array(n);
  const lp = new Biquad(sr);
  const det = 2 ** (((r() - 0.5) * 6) / 1200);
  const step = (f * det) / sr;
  let p1 = r(), p2 = r(), p3 = r(), p4 = r();
  const thump = new Biquad(sr).set('lp', 500);
  const from = Math.min(3200, f * 5), to = Math.min(1600, f * 2.5);
  const tau = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (i % 32 === 0) lp.set('lp', from * (to / from) ** Math.min(1, t / 0.8), Math.SQRT1_2);
    p1 = (p1 + step) % 1; p2 = (p2 + step * 2.003) % 1; p3 = (p3 + step * 3.01) % 1; p4 = (p4 + step * 4.02) % 1;
    const x = (1 - 4 * Math.abs(p1 - 0.5)) + 0.38 * Math.sin(tau * p2) + 0.14 * Math.sin(tau * p3) + 0.05 * Math.sin(tau * p4);
    // Struck: in over 8 ms, falling to the body's level over 1.5 s, then on slowly.
    const env = Math.min(1, t / 0.008) * (0.42 + 0.58 * Math.exp(-t / 0.5)) * Math.exp(-t / 3.5);
    out[i] = lp.run(x) * env + (i < 0.06 * sr ? thump.run(r() * 2 - 1) * 0.33 * Math.exp(-t / 0.012) : 0);
  }
  return out;
}

/** A breath tuned to the note: air from lib/lofi-breath.ts through narrow resonances at the note's first harmonics, with some of the air left raw. */
function breathNote(sr: number, f: number, seconds: number, seed: number): Float32Array {
  const air = inhale(sr, seconds, { bands: [{ centre: 1300, width: 2 }, { centre: 3600, width: 1.2, level: -7 }], rise: 0.2, fall: 0.3 }, seed);
  const bands = [1, 2, 3].map(h => ({ f: new Biquad(sr).set('bp', f * h, 28), level: [1, 0.5, 0.25][h - 1]! }));
  const out = new Float32Array(air.length);
  for (let i = 0; i < air.length; i++) {
    const x = air[i]!;
    let y = 0.25 * x;
    for (const b of bands) y += b.level * 6 * b.f.run(x);
    out[i] = y;
  }
  return out;
}

/** A source note of `midi`, rendered by its instrument's model and set to an RMS of about 0.2 over its sounding part. */
export function renderSource(source: BotanicaSource, midi: number, sr: number, seed: number): Source {
  const [lo, hi] = RANGE[source];
  let m = midi, ratio = 1;
  while (m < lo) { m += 12; ratio /= 2; }
  while (m > hi) { m -= 12; ratio *= 2; }
  const f = mtof(m);
  const r = seeded(mix(seed, Math.round(m * 10), source.length));
  let data: Float32Array;
  switch (source) {
    case 'piano': data = feltNote(sr, f, SOURCE_SECONDS, r); break;
    case 'guitar': data = pluckString({ sr, f, seconds: SOURCE_SECONDS, pickAt: 0.1, bright: 18, decay: 3.2, mellow: 9, noise: 0.15, top: 5200 }, r); break;
    case 'nylon': data = pluckString({ sr, f, seconds: SOURCE_SECONDS, pickAt: 0.16, bright: 9, decay: 2.6, mellow: 5, noise: 0.08, top: 4000 }, r); break;
    case 'harp': data = pluckString({ sr, f, seconds: SOURCE_SECONDS, pickAt: 0.3, bright: 12, decay: 4.5, mellow: 6, top: 6000 }, r); break;
    case 'fiddle': data = bowString({ sr, f, vel: 0.55, dur: SOURCE_SECONDS - 0.2, seconds: SOURCE_SECONDS, vibrato: 14, rate: 5.6, slide: 0 }, r); break;
    case 'flute': data = blowFlute({ sr, f, vel: 0.55, dur: SOURCE_SECONDS - 0.2, seconds: SOURCE_SECONDS, pipe: 'open', vibrato: 12, rate: 5, scoop: 0 }, r); break;
    case 'voice': {
      const vocal = chopVocal(seed);
      const [left, right] = singChop(sr, { syllable: vocal.slices[0]!, midi: m, dur: SOURCE_SECONDS - 0.1, vel: 0.7, gesture: CHOP_PLAIN, amount: 0, beat: 0.5, vocal, take: 0.5 }, mix(seed, m));
      data = new Float32Array(left.length);
      for (let i = 0; i < data.length; i++) data[i] = (left[i]! + right[i]!) * 0.5;
      break;
    }
    default: data = breathNote(sr, f, SOURCE_SECONDS, mix(seed, m));
  }
  // An RMS of 0.2 over the louder half of the note, so every source makes a pad of one loudness.
  const w = Math.min(data.length, Math.round(1.1 * sr));
  let e = 0;
  for (let i = 0; i < w; i++) e += data[i]! * data[i]!;
  const rms = Math.sqrt(e / Math.max(1, w));
  const g = rms > 1e-6 ? 0.2 / rms : 0;
  for (let i = 0; i < data.length; i++) data[i] = data[i]! * g;
  return { data, ratio };
}

// ── the clouds ───────────────────────────────────────────────────────────────

/** How a cloud plays its grains. */
export interface Cloud {
  /** A grain's length (s), shortest and longest. */
  grain: readonly [number, number];
  /** Grains a second. */
  density: number;
  /** The share of grains played backwards. */
  reverse: number;
  /** How fast the reading place moves through the source, against real time (0.05 stretches the note twenty times). */
  scan: number;
  /** The part of the source the grains are read from (shares of its length): past the attack, before it dies. */
  window: readonly [number, number];
  /** Pitches the grains play at, as ratios, by weight. */
  pitches: ReadonlyArray<readonly [number, number]>;
  /** How far each grain strays in pitch (cents, either way) and how wide they spread across the speakers (0 to 1). */
  jitter: number; spread: number;
}
export const CLOUDS: Record<BotanicaCloud, Cloud> = {
  shimmer: { grain: [0.04, 0.09], density: 48, reverse: 0.15, scan: 0.12, window: [0.04, 0.55], pitches: [[1, 4], [2, 2], [1.5, 0.6]], jitter: 7, spread: 0.8 },
  reverse: { grain: [0.12, 0.26], density: 16, reverse: 0.7, scan: 0.08, window: [0.03, 0.5], pitches: [[1, 4], [0.5, 0.8]], jitter: 4, spread: 0.6 },
  stretch: { grain: [0.14, 0.3], density: 16, reverse: 0.2, scan: 0.05, window: [0.04, 0.85], pitches: [[1, 5], [2, 0.8]], jitter: 3, spread: 0.5 },
  scatter: { grain: [0.02, 0.06], density: 16, reverse: 0.4, scan: 0.3, window: [0, 0.8], pitches: [[1, 2], [2, 3], [1.5, 1]], jitter: 14, spread: 1 },
};

/** One grain as it was placed: when, how long, where in the source, at what ratio, backwards or not, and where across the speakers. */
export interface Grain { at: number; len: number; from: number; ratio: number; reverse: boolean; pan: number }

/** The grains of a pad, `seconds` long from a source `sourceSeconds` long: every choice from `seed`. */
export function grainPlan(cloud: Cloud, seconds: number, sourceSeconds: number, seed: number): Grain[] {
  const r = seeded(mix(seed, 0x6a1));
  const total = cloud.pitches.reduce((s, [, w]) => s + w, 0);
  const pitch = (): number => {
    let roll = r() * total;
    for (const [p, w] of cloud.pitches) { roll -= w; if (roll < 0) return p; }
    return cloud.pitches[0]![0];
  };
  const [w0, w1] = cloud.window;
  const span = Math.max(0.05, (w1 - w0) * sourceSeconds);
  const out: Grain[] = [];
  let t = 0;
  while (t < seconds) {
    const len = cloud.grain[0] + r() * (cloud.grain[1] - cloud.grain[0]);
    // The reading place walks through the window at the scan rate and wraps, each grain a little off the walk.
    const walk = (t * cloud.scan) % span;
    const from = w0 * sourceSeconds + ((walk + (r() - 0.5) * 0.08 * span) % span + span) % span;
    const ratio = pitch() * 2 ** (((r() - 0.5) * 2 * cloud.jitter) / 1200);
    out.push({ at: t, len, from, ratio, reverse: r() < cloud.reverse, pan: 0.5 + (r() - 0.5) * cloud.spread });
    t += (1 / cloud.density) * (0.5 + r());
  }
  return out;
}

/**
 * A granular pad: `source` cut into the grains of `plan`, each read at its ratio (times
 * the source's own) under a Hann window, forwards or backwards, and placed across the
 * speakers. Stereo, about as loud as the source whatever the density, with a fade in and
 * out of `edge` seconds.
 */
export function grainCloud(source: Source, sr: number, seconds: number, plan: readonly Grain[], edge = 0.4): Stereo {
  const n = Math.ceil(seconds * sr);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const src = source.data;
  const last = src.length - 2;
  // Overlapping grains add: scale by the mean overlap so the pad is as loud however dense.
  const overlap = Math.max(1, plan.reduce((s, g) => s + g.len, 0) / Math.max(0.1, seconds));
  const norm = 1 / Math.sqrt(overlap);
  for (const g of plan) {
    const start = Math.round(g.at * sr);
    const len = Math.round(g.len * sr);
    const step = g.ratio * source.ratio;
    const left = Math.cos(g.pan * Math.PI / 2) * norm * Math.SQRT2;
    const right = Math.sin(g.pan * Math.PI / 2) * norm * Math.SQRT2;
    const origin = g.from * sr;
    for (let k = 0; k < len && start + k < n; k++) {
      const pos = g.reverse ? origin + (len - k) * step : origin + k * step;
      if (pos < 0 || pos >= last) continue;
      const i = Math.floor(pos), u = pos - i;
      const v = (src[i]! * (1 - u) + src[i + 1]! * u) * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / len));
      out[0][start + k] = out[0][start + k]! + v * left;
      out[1][start + k] = out[1][start + k]! + v * right;
    }
  }
  const e = Math.min(Math.round(edge * sr), Math.floor(n / 2));
  for (let i = 0; i < e; i++) {
    const g = Math.sin((i / e) * Math.PI / 2) ** 2;
    out[0][i] = out[0][i]! * g; out[1][i] = out[1][i]! * g;
    out[0][n - 1 - i] = out[0][n - 1 - i]! * g; out[1][n - 1 - i] = out[1][n - 1 - i]! * g;
  }
  return out;
}

// ── played ───────────────────────────────────────────────────────────────────

/** The sources and the pads rendered so far, per context. */
const SOURCES = new WeakMap<BaseAudioContext, Map<string, Source>>();
const PADS = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/**
 * The share of the context's rate the pads, their sources and the glitches are rendered
 * at: their sound lies under about 6 kHz (a shimmer's octave up included), so half the
 * rate halves the cost and loses nothing heard, the buffer being resampled as it plays.
 */
export const PAD_RATE = 0.5;
/** The rate a context's pads are rendered at. */
export const padRate = (ctx: BaseAudioContext): number => Math.round(ctx.sampleRate * PAD_RATE);

/** A tune's source note, rendered once, at the pads' rate. */
export function sourceOf(ctx: BaseAudioContext, source: BotanicaSource, midi: number, tune: number): Source {
  let cache = SOURCES.get(ctx);
  if (!cache) { cache = new Map(); SOURCES.set(ctx, cache); }
  const key = `${source}|${midi}|${tune}`;
  let s = cache.get(key);
  if (!s) {
    if (cache.size > 96) cache.clear();
    s = renderSource(source, midi, padRate(ctx), mix(tune, 0x50c));
    cache.set(key, s);
  }
  return s;
}

/** A pad's buffer: its source note grained by its cloud for `seconds`, rendered once per tune, pitch, cloud and length. */
export function grainBuffer(ctx: BaseAudioContext, source: BotanicaSource, cloud: BotanicaCloud, midi: number, seconds: number, tune: number): AudioBuffer {
  let cache = PADS.get(ctx);
  if (!cache) { cache = new Map(); PADS.set(ctx, cache); }
  const length = Math.round(seconds * 20) / 20;
  const key = `${source}|${cloud}|${midi}|${length}|${tune}`;
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 64) cache.clear();
    const src = sourceOf(ctx, source, midi, tune);
    const rate = padRate(ctx);
    const plan = grainPlan(CLOUDS[cloud], length, src.data.length / rate, mix(tune, midi, source.length, cloud.length));
    const [left, right] = grainCloud(src, rate, length, plan, Math.min(1.2, length / 3));
    buf = ctx.createBuffer(2, left.length, rate);
    buf.getChannelData(0).set(left);
    buf.getChannelData(1).set(right);
    cache.set(key, buf);
  }
  return buf;
}

/** The pads' level in the mix. */
const PAD_LEVEL = 0.3;

/** Play a `grain` note: its pad from the cache (or rendered now), at its velocity. */
export function playGrain(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel: number, seconds: number, mod: number, tune: number): void {
  const { source, cloud } = readGrain(mod);
  const src = ctx.createBufferSource();
  src.buffer = grainBuffer(ctx, source, cloud, midi, seconds, tune);
  const gain = ctx.createGain();
  gain.gain.value = PAD_LEVEL * vel;
  src.connect(gain).connect(out);
  src.start(t);
}
