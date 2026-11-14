// SPDX-License-Identifier: MPL-2.0
/**
 * What a `wave` note means: the sea on a sandy shore, the texture Noosacore breathes over
 * (lofi-noosa.ts) and that any style can have when a person turns the waves on. The notes
 * say where a wave breaks, how big it is and how far off; the shell's model
 * (shells/web/src/lib/lofi-waves.ts) makes the sound. Pure: no Web Audio, no randomness.
 *
 * A wave note is one of three kinds, by `mod & 3`:
 * - a break (0): one wave. The note starts as the swell is first heard and the wave breaks
 *   WAVE_SWELL[size] seconds later, so a composer that wants a wave to crash on a downbeat
 *   starts the note that long before the downbeat. The foam then runs up the sand and drains back.
 * - the shore (1): the roar of the waves breaking further along the beach, held for the
 *   note's length under everything else, as every field recording of a beach has the roar.
 * - the dunes (2): the breeze singing in the she-oaks on the dunes behind the beach, held
 *   for the note's length.
 *
 * `(mod >> 2) & 3` is how far off the wave is (WAVE_DISTANCES), `(mod >> 4) & 3` its size
 * (WAVE_SIZES), and `mod >> 6` a take, so no two waves of a tune are the same wave.
 */

/** The kinds of wave note. */
export const WAVE_KINDS = ['break', 'shore', 'dunes'] as const;
export type WaveKind = typeof WAVE_KINDS[number];
/** How far off a wave breaks: at the water's edge, a little out, out on the sandbank, far down the beach. */
export const WAVE_DISTANCES = ['edge', 'near', 'bank', 'far'] as const;
/** How big a wave is: a small one, a medium one, a big one and the biggest wave of a set. */
export const WAVE_SIZES = ['small', 'medium', 'big', 'set'] as const;
/** Seconds from a break note's start to the moment the wave breaks, by size: a bigger wave is heard building for longer. */
export const WAVE_SWELL = [1.4, 2, 2.6, 3.2] as const;
/** About how long a wave is heard after it breaks (s), by size: the foam's run up the sand and the backwash. */
export const WAVE_WASH = [3.4, 4.4, 5.4, 6.4] as const;
/** The largest take a wave note carries, so its `mod` stays a small whole number. */
export const WAVE_TAKES = 1 << 20;

/** A wave note's `mod`. */
export function waveMod(kind: WaveKind, distance = 1, size = 1, take = 0): number {
  const d = Math.max(0, Math.min(3, Math.floor(distance)));
  const s = Math.max(0, Math.min(3, Math.floor(size)));
  const k = ((Math.floor(take) % WAVE_TAKES) + WAVE_TAKES) % WAVE_TAKES;
  return WAVE_KINDS.indexOf(kind) + 4 * d + 16 * s + 64 * k;
}

/** What a wave note plays. */
export function readWave(mod: number): { kind: WaveKind; distance: number; size: number; take: number } {
  const m = Math.max(0, Math.floor(mod));
  return { kind: WAVE_KINDS[m & 3] ?? 'break', distance: (m >> 2) & 3, size: (m >> 4) & 3, take: Math.floor(m / 64) };
}

/** The beat a break note starts on, for its wave to break on `beat` at `bpm`: the swell comes first. */
export function swellBeats(size: number, bpm: number): number {
  return (WAVE_SWELL[Math.max(0, Math.min(3, Math.floor(size)))]! * bpm) / 60;
}

/** One wave of a series: when it breaks (s from the series' start), its size, how far off it is, and its take. */
export interface WaveEvent { at: number; size: number; distance: number; take: number }

/**
 * The waves breaking on a shore from `from` to `to` seconds, as the sea sends them: about
 * `period` seconds apart but never evenly (each gap drawn with a spread of `spread` against
 * the mean, the ratio the recordings showed, 0.23 to 0.36), and in sets, a few bigger waves
 * together every five to nine, as swell trains arrive (none bigger than `biggest`, a
 * WAVE_SIZES index: a sheltered river mouth only ever sees small ones). Most break near the
 * shore (`distance`), now and then one further out. The series is the same whatever stretch is
 * asked for, so a bar's waves can be read without the bars before the bar.
 */
export function waveSeries(seed: number, from: number, to: number, opts: { period?: number; spread?: number; distance?: number; biggest?: number } = {}): WaveEvent[] {
  const period = opts.period ?? 8;
  const biggest = opts.biggest ?? 3;
  const spread = opts.spread ?? 0.25;
  const near = opts.distance ?? 1;
  // A small stream of the series' own (mulberry32 over a scrambled seed).
  let a = Math.imul((seed ^ 0x3c6ef372) >>> 0, 0x9e3779b1) >>> 0;
  const r = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const sigma = Math.sqrt(Math.log(1 + spread * spread));
  const out: WaveEvent[] = [];
  let t = r() * period * 0.6;
  let setLen = 5 + Math.floor(r() * 5), inSet = Math.floor(r() * setLen);
  for (let k = 0; t < to && k < 100000; k++) {
    // Where the wave falls in its set: the middle of a set brings the biggest.
    const phase = Math.sin((Math.PI * (inSet + 0.5)) / setLen);
    const grow = phase + (r() - 0.5) * 0.7;
    const size = Math.min(biggest, grow > 0.95 ? 3 : grow > 0.6 ? 2 : grow > 0.2 ? 1 : 0);
    const distance = Math.max(0, Math.min(3, near + (r() < 0.18 ? 1 : 0) + (r() < 0.06 ? 1 : 0) - (r() < 0.1 ? 1 : 0)));
    const take = Math.floor(r() * WAVE_TAKES);
    if (t >= from) out.push({ at: t, size, distance, take });
    // A lognormal gap: never negative, its spread against its mean `spread`.
    const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    t += Math.max(period * 0.35, period * Math.exp(sigma * z - (sigma * sigma) / 2));
    if (++inSet >= setLen) { inSet = 0; setLen = 5 + Math.floor(r() * 5); }
  }
  return out;
}
