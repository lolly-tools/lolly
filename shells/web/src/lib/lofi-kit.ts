// SPDX-License-Identifier: MPL-2.0
/**
 * A real drum kit, rendered in code: the cymbals, the hats, the snare, the toms and an
 * acoustic bass drum, each as the physics of the instrument has it, computed once per tune
 * into a few short recordings (a soft and a hard stroke, and two of each so no two strokes
 * are alike) that every hit then plays back. A hit costs one buffer, where a Web Audio
 * voice built from oscillators and filters cost ten or fifteen nodes and could not come
 * close to a cymbal's sound.
 *
 * - A cymbal (ride, crash, splash, china, the hats) is a bank of inharmonic partials, each
 *   a damped ring at its own frequency: dozens of them from a few hundred hertz to the top
 *   of hearing, louder around the cymbal's brightness, the higher ones dying first. The
 *   stick's energy moves into the high partials over the first moments, so the wash blooms
 *   just after the ping. A ride has its bell, a few strong partials that ring longest. Hats
 *   are two plates: a closed hat's ring is choked almost at once, with the plates' rattle.
 * - A drumhead (snare, toms, bass drum) rings at the membrane's modes, whose ratios are the
 *   zeros of the Bessel functions (1, 1.59, 2.14, 2.30, 2.65, 2.92 ...), the higher ones
 *   short. Struck harder, the head's tension rises, so its pitch starts a little sharp and
 *   settles. A snare's wires buzz against the bottom head as long as it moves.
 * - Struck harder is brighter: more of the high partials and modes, and more stick.
 *
 * Pure: no DOM and no Web Audio; the shells wrap the samples into buffers. Deterministic:
 * every random choice comes from the seeded source handed in, so a tune's kit is the same
 * on every render. The cost is a few tens of milliseconds per piece, paid once per tune.
 */

/** A seeded random source in 0..1. */
export type Rand = () => number;

/** One damped partial: frequency (Hz), level, the time it takes to fall by e (s), and how long its energy takes to arrive (s). */
interface Partial { f: number; a: number; tau: number; bloom: number }

/** Add `partials` into `out` (from sample `at`), each a damped sine with its own phase. */
function ring(out: Float32Array, sr: number, partials: readonly Partial[], rand: Rand, at = 0): void {
  for (const p of partials) {
    if (p.f >= sr * 0.48 || p.a <= 0) continue;
    const len = Math.min(out.length - at, Math.ceil(p.tau * 7 * sr));
    const w = (2 * Math.PI * p.f) / sr;
    const r = Math.exp(-1 / (p.tau * sr));
    // A damped sine by recursion: y[n] = 2r cos(w) y[n-1] - r^2 y[n-2].
    const c = 2 * r * Math.cos(w);
    const r2 = r * r;
    const phase = rand() * Math.PI * 2;
    let y1 = p.a * Math.sin(phase);
    let y2 = p.a * Math.sin(phase - w) / r;
    const bloom = p.bloom > 0 ? Math.exp(-1 / (p.bloom * sr)) : 0;
    let grow = p.bloom > 0 ? 1 : 0;
    for (let n = 0; n < len; n++) {
      const y = c * y1 - r2 * y2;
      y2 = y1;
      y1 = y;
      out[at + n] = (out[at + n] ?? 0) + y2 * (1 - grow);
      grow *= bloom;
    }
  }
}

/** White noise through a two-pole band-pass at `hz`, under an envelope rising in `attack` and falling by e in `tau`. */
function noiseBand(out: Float32Array, sr: number, rand: Rand, hz: number, q: number, level: number, attack: number, tau: number, at = 0): void {
  const len = Math.min(out.length - at, Math.ceil((attack + tau * 6) * sr));
  const w = (2 * Math.PI * Math.min(hz, sr * 0.45)) / sr;
  const alpha = Math.sin(w) / (2 * q);
  const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const up = Math.max(1, attack * sr);
  const fall = Math.exp(-1 / (tau * sr));
  let env = 1;
  for (let n = 0; n < len; n++) {
    const x = rand() * 2 - 1;
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    if (n >= up) env *= fall;
    const e = n < up ? n / up : env;
    out[at + n] = (out[at + n] ?? 0) + y * level * e;
  }
}

/** A cymbal's partials: `count` of them between `lo` and `hi` Hz, denser up high, loudest around `peak`. Fixed per cymbal. */
function cymbalPartials(rand: Rand, count: number, lo: number, hi: number, peak: number, spread: number, life: number, lifeTilt: number, bloomTop: number): Partial[] {
  const out: Partial[] = [];
  for (let i = 0; i < count; i++) {
    const u = Math.sqrt(rand());
    const f = lo * (hi / lo) ** u * (1 + (rand() - 0.5) * 0.01);
    const oct = Math.log2(f / peak);
    const a = Math.exp(-(oct * oct) / (2 * spread * spread)) * (0.5 + rand() * 0.5);
    out.push({ f, a, tau: life * (f / 500) ** -lifeTilt * (0.7 + rand() * 0.6), bloom: 0.0015 + bloomTop * (f / hi) });
  }
  return out;
}

/** A stroke on a set of partials: a soft stroke reaches fewer of the high ones. */
function stroke(partials: readonly Partial[], vel: number, scale: number, rand: Rand): Partial[] {
  const top = 2500 + 14000 * vel * vel;
  return partials.map((p) => ({ ...p, a: p.a * scale * Math.exp(-p.f / top) * (0.85 + rand() * 0.3) }));
}

/** Normalise to a peak of `to`. */
function normalise(x: Float32Array, to: number): Float32Array {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / peak) * to;
  return x;
}

export interface CymbalSpec {
  /** Partials, range (Hz), the brightest region, its width (octaves), the low partials' life (s), how much faster the high ones die, how long the wash takes to bloom at the top (s). */
  count: number; lo: number; hi: number; peak: number; spread: number; life: number; tilt: number; bloom: number;
  /** The bell: partials near this frequency that ring longest (ride), or none. */
  bell?: number;
  /** A choke (hats): the whole ring cut off after this long (s). */
  choke?: number;
  /** The stick's tick: its centre frequency, or none (a mallet). */
  tick?: number;
  /** Seconds to render. */
  seconds: number;
}

export const RIDE: CymbalSpec = { count: 70, lo: 320, hi: 15000, peak: 3800, spread: 1.4, life: 2.6, tilt: 0.5, bloom: 0.025, bell: 820, tick: 4800, seconds: 2.4 };
export const CRASH: CymbalSpec = { count: 80, lo: 300, hi: 16000, peak: 5200, spread: 1.5, life: 2.0, tilt: 0.42, bloom: 0.07, tick: 5000, seconds: 2.6 };
export const SPLASH: CymbalSpec = { count: 60, lo: 600, hi: 16000, peak: 7000, spread: 1.3, life: 0.9, tilt: 0.4, bloom: 0.03, tick: 6000, seconds: 1.2 };
export const CHINA: CymbalSpec = { count: 80, lo: 260, hi: 13000, peak: 3200, spread: 1.6, life: 1.6, tilt: 0.35, bloom: 0.06, tick: 3500, seconds: 2.2 };
export const HAT_CLOSED: CymbalSpec = { count: 56, lo: 450, hi: 16000, peak: 8000, spread: 1.2, life: 0.9, tilt: 0.45, bloom: 0.004, choke: 0.045, tick: 9000, seconds: 0.3 };
export const HAT_OPEN: CymbalSpec = { count: 56, lo: 450, hi: 16000, peak: 7500, spread: 1.25, life: 0.9, tilt: 0.45, bloom: 0.012, choke: 0.55, tick: 9000, seconds: 1.0 };

/** One cymbal stroke: `vel` 0..1 (soft strokes darker), the cymbal's own partials (`base`) so every stroke is the same cymbal. */
export function cymbal(sr: number, spec: CymbalSpec, base: readonly Partial[], vel: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.ceil(spec.seconds * sr));
  ring(out, sr, stroke(base, vel, 1, rand), rand);
  if (spec.bell) {
    const bell: Partial[] = [1, 1.47, 2.03, 2.6, 3.4].map((m, i) => ({ f: spec.bell! * m * (1 + (rand() - 0.5) * 0.004), a: (i ? 0.5 : 1) * (0.6 + 0.4 * vel) * 0.9, tau: spec.life * 0.8, bloom: 0 }));
    ring(out, sr, bell, rand);
  }
  if (spec.tick) noiseBand(out, sr, rand, spec.tick, 1.2, 1.2 * (0.4 + 0.6 * vel), 0.0005, 0.0025);
  // The plates' rattle: noise riding the hats' ring.
  if (spec.choke) noiseBand(out, sr, rand, spec.peak * 1.1, 0.8, 0.35, 0.001, spec.choke * 0.8);
  if (spec.choke) {
    const k = Math.exp(-1 / (spec.choke * sr));
    let e = 1;
    for (let i = 0; i < out.length; i++) { out[i] = out[i]! * e; e *= k; }
  }
  return normalise(out, 0.9 * (0.55 + 0.45 * vel));
}

/** A cymbal's fixed partials, from its own seed. */
export function cymbalBase(spec: CymbalSpec, rand: Rand): Partial[] {
  return cymbalPartials(rand, spec.count, spec.lo, spec.hi, spec.peak, spec.spread, spec.life, spec.tilt, spec.bloom);
}

/** The membrane's modes, as ratios to its fundamental (zeros of the Bessel functions), and how much a hit near the centre stirs each. */
const HEAD_MODES: ReadonlyArray<readonly [number, number]> = [[1, 1], [1.594, 0.45], [2.136, 0.32], [2.296, 0.55], [2.653, 0.22], [2.918, 0.2], [3.156, 0.16], [3.501, 0.12], [3.6, 0.3], [3.652, 0.1]];

/** Rings at a drumhead's modes from `f0`, each mode's pitch starting `sharp` above and settling in `settle` s, the fundamental lasting `life` s. */
function head(out: Float32Array, sr: number, f0: number, level: number, life: number, sharp: number, settle: number, modes: number, rand: Rand): void {
  for (const [ratio, weight] of HEAD_MODES.slice(0, modes)) {
    const tau = life * ratio ** -1.1 * (0.85 + rand() * 0.3);
    const len = Math.min(out.length, Math.ceil(tau * 7 * sr));
    const f = f0 * ratio;
    const fall = Math.exp(-1 / (tau * sr));
    const settleK = Math.exp(-1 / (settle * sr));
    let env = level * weight;
    let bend = sharp;
    let phase = rand() * Math.PI * 2;
    for (let n = 0; n < len; n++) {
      phase += (2 * Math.PI * f * (1 + bend)) / sr;
      out[n] = out[n]! + Math.sin(phase) * env;
      env *= fall;
      bend *= settleK;
    }
  }
}

export interface HeadSpec { f0: number; life: number; modes: number; seconds: number }

/** A snare stroke: the head, the wires buzzing as long as it moves (`wires` sets how much and how long), and the stick. */
export function snareStroke(sr: number, f0: number, vel: number, wires: number, ring: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.ceil(0.6 * sr));
  const hard = vel * vel;
  head(out, sr, f0, 0.55 * (0.5 + 0.5 * vel), 0.11 * ring, 0.05 * hard, 0.03, 4 + Math.round(5 * vel), rand);
  // The wires: a wide band of buzz, starting a moment after the hit, louder the harder.
  noiseBand(out, sr, rand, 5200, 0.6, 0.5 * wires * (0.2 + vel ** 1.5), 0.002, 0.09 * (0.7 + 0.3 * wires));
  noiseBand(out, sr, rand, 2600, 0.9, 0.3 * wires * (0.2 + vel ** 1.5), 0.0015, 0.06);
  // The stick on the head: a sharp, bright tick.
  noiseBand(out, sr, rand, 4200 + 2500 * vel, 0.8, 0.9 * hard, 0.0003, 0.003);
  return normalise(out, 0.95 * (0.35 + 0.65 * vel));
}

/** A tom stroke at `f0`: the head's modes, ringing longer the lower the tom, a little sharp and settling, with the stick. */
export function tomStroke(sr: number, f0: number, vel: number, rand: Rand): Float32Array {
  const life = 0.25 + Math.max(0, 200 - f0) * 0.003;
  const out = new Float32Array(Math.ceil(Math.min(2, life * 5) * sr));
  head(out, sr, f0, 0.7, life, 0.07 * vel * vel, 0.06, 5, rand);
  noiseBand(out, sr, rand, 3200, 0.9, 0.5 * vel * vel, 0.0003, 0.004);
  noiseBand(out, sr, rand, f0 * 2.5, 1.2, 0.12 * vel, 0.001, 0.03);   // the shell
  return normalise(out, 0.9 * (0.35 + 0.65 * vel));
}

/** A bass drum stroke at `f0`: the batter head's modes, a small fall with the strike, the beater's click (`click` 0 for a felt beater played softly) and the shell's thump. */
export function kickStroke(sr: number, f0: number, vel: number, click: number, life: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.ceil((life * 5 + 0.05) * sr));
  head(out, sr, f0, 1, life, 0.12 * vel, 0.02, 3, rand);
  noiseBand(out, sr, rand, 300, 0.8, 0.5 * vel, 0.001, 0.012);   // the shell
  if (click > 0) noiseBand(out, sr, rand, 3000, 1, 0.9 * click * vel * vel, 0.0002, 0.0018);   // the beater
  return normalise(out, 0.95 * (0.4 + 0.6 * vel));
}
