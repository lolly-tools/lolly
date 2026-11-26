// SPDX-License-Identifier: MPL-2.0
/**
 * A plucked string, modelled: the extended Karplus-Strong string of Jaffe and Smith (1983).
 * A delay line one period long holds the string's shape; each trip round the loop passes
 * a small low-pass (the string losing its high partials faster than its low ones) and a
 * loss that sets how long the note rings, and a one-pole all-pass makes up the fraction of
 * a sample the period needs to be in tune. What comes out is a string's sound because it
 * is a string's behaviour: the harmonics are exact multiples, the top dies first, a low
 * note rings longer than a high one, and every pluck differs a little.
 *
 * The rest is the player and the instrument:
 * - The pluck: the string's shape at the moment of release, a triangle peaking where it
 *   was plucked (which takes out the harmonics with a node there), with a little noise
 *   for the pick or the finger, darker for a soft pluck.
 * - Two planes: a string swings up and down and side to side, at minutely different
 *   pitches and losses. The first dies fast and the second lingers, so a guitar note has
 *   its bright strike and then its long, quieter ring, with a slow beat between them.
 * - A pickup (electric guitars) hears the string at one point along its length, taking out
 *   the harmonics with a node under it: the bridge pickup's bite, the neck pickup's warmth.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same spec and seed.
 */

export interface StringSpec {
  /** Sample rate and fundamental (Hz). */
  sr: number; f: number;
  /** Seconds to render. */
  seconds: number;
  /** Where the string is plucked, as a fraction of its length from the bridge (0.08 bright, 0.25 round). */
  pickAt: number;
  /** How bright the pluck is: the pluck's low-pass, as a multiple of the fundamental. */
  bright: number;
  /** Seconds for the fundamental to fall by 60 dB. */
  decay: number;
  /** Which harmonic is down 20 dB after a quarter second: high for a bright string, low for a dark one (nylon, flatwound). */
  mellow: number;
  /** A pickup's place along the string (electric), as a fraction from the bridge; none for an acoustic. */
  pickup?: number;
  /** How much of the pluck is noise (pick scrape, a fingertip) rather than shape: 0 to 1. */
  noise?: number;
  /** The second plane's level against the first (0 to 1), and how far apart they are tuned (cents). */
  plane?: number; beat?: number;
  /** Where the body or the speaker rolls the top off (Hz): an acoustic's top radiates little above about 5 kHz. */
  top?: number;
}

/**
 * The loop's low-pass, a one-pole y = (1 - a) x + a y', and the coefficient `a` that takes
 * `harmonic` down 20 dB against the fundamental in a quarter second at fundamental `f`.
 * (Karplus and Strong's two-tap average cannot damp a low string's upper harmonics nearly
 * that fast, which leaves every low note wiry.)
 */
function lossFor(sr: number, f: number, harmonic: number): number {
  const periods = 0.25 * f;
  const w0 = (2 * Math.PI * f) / sr;
  const w = Math.min(Math.PI * 0.95, w0 * harmonic);
  const target = 0.1 ** (1 / periods);
  // Past about 0.93 the low-pass delays the fundamental more than its overtones, so the
  // overtones go sharp: more out of tune with each other than a guitar's strings are.
  let lo = 0, hi = 0.93;
  for (let i = 0; i < 32; i++) {
    const a = (lo + hi) / 2;
    if (gainOf(a, w) / gainOf(a, w0) > target) lo = a; else hi = a;
  }
  return (lo + hi) / 2;
}
/** The one-pole's gain at `w`, normalised to 1 at DC. */
function gainOf(a: number, w: number): number {
  return (1 - a) / Math.sqrt(1 - 2 * a * Math.cos(w) + a * a);
}

/** One plane of the string, added into `out` at `level`. */
function plane(out: Float32Array, spec: StringSpec, f: number, decay: number, level: number, rand: () => number): void {
  const { sr } = spec;
  const a = lossFor(sr, f, spec.mellow);
  const w0 = (2 * Math.PI * f) / sr;
  // The per-period loss that sets the ring, made up for the low-pass's own loss at the fundamental.
  const g = Math.min(0.99995, 10 ** (-3 / (decay * f)) / gainOf(a, w0));
  // The loop's length: the delay line, the low-pass's delay at the fundamental, and the all-pass's fraction.
  const lag = Math.atan2(a * Math.sin(w0), 1 - a * Math.cos(w0)) / w0;
  const rest = sr / f - lag;
  let L = Math.floor(rest);
  let d = rest - L;
  if (d < 0.2) { L -= 1; d += 1; }
  const c = (1 - d) / (1 + d);
  // The pluck: a triangle peaking at the pluck point, plus a little noise, then the pluck's low-pass.
  const line = new Float32Array(L);
  const at = Math.max(1, Math.min(L - 1, Math.round(spec.pickAt * L)));
  const noise = spec.noise ?? 0.2;
  let mean = 0;
  for (let i = 0; i < L; i++) {
    const shape = i < at ? i / at : (L - i) / (L - at);
    line[i] = shape * (1 - noise) + (rand() * 2 - 1) * noise;
    mean += line[i]!;
  }
  mean /= L;
  for (let n = 0; n < L; n++) line[n] = line[n]! - mean;
  // The pluck's low-pass, twice over. The delay line holds one period of a periodic shape,
  // so each pass runs round the line once to settle before it writes: no seam at the wrap.
  const cut = Math.min(0.99, 1 - Math.exp((-2 * Math.PI * Math.min(spec.bright * f, sr * 0.45)) / sr));
  for (let stage = 0; stage < 2; stage++) {
    let lp = 0;
    for (let n = 0; n < L; n++) lp += cut * (line[n]! - lp);
    for (let n = 0; n < L; n++) { lp += cut * (line[n]! - lp); line[n] = lp; }
  }
  // The loop's filters start from the string as it already is, the end of the period being
  // what came just before its start; from rest they would put a click in the second period.
  const before = line[L - 1]!;
  let i = 0, held = before, apIn = g * before, apOut = g * before, last = before;
  for (let n = 0; n < out.length; n++) {
    const x = line[i]!;
    held = (1 - a) * x + a * held;
    const lossy = g * held;
    const y = c * lossy + apIn - c * apOut;
    apIn = lossy;
    apOut = y;
    line[i] = y;
    i = i + 1 === L ? 0 : i + 1;
    // What the bridge feels is the string's slope changing: the difference of its shape.
    out[n] = out[n]! + (x - last) * level;
    last = x;
  }
}

/** Render one pluck. `rand` seeds the pluck's noise, so two plucks of one note differ. */
export function pluckString(spec: StringSpec, rand: () => number): Float32Array {
  const out = new Float32Array(Math.ceil(spec.seconds * spec.sr));
  const second = spec.plane ?? 0.45;
  const beat = spec.beat ?? 1.2;
  plane(out, spec, spec.f, spec.decay * 0.6, 1, rand);
  if (second > 0) plane(out, spec, spec.f * 2 ** (beat / 1200), spec.decay * 1.25, second, rand);
  if (spec.pickup) {
    const gap = Math.max(1, Math.round((spec.pickup * spec.sr) / spec.f));
    for (let n = out.length - 1; n >= gap; n--) out[n] = out[n]! - out[n - gap]!;
  }
  // Take out any slow drift, roll off the top as the body or the speaker does, then set the
  // level by the note's first quarter second (its peak is a few sharp edges, not its loudness).
  const top = Math.min(0.99, 1 - Math.exp((-2 * Math.PI * Math.min(spec.top ?? 6000, spec.sr * 0.45)) / spec.sr));
  let x1 = 0, y1 = 0, lp = 0, sum = 0;
  const early = Math.min(out.length, Math.round(0.25 * spec.sr));
  for (let n = 0; n < out.length; n++) {
    const y = out[n]! - x1 + 0.995 * y1;
    x1 = out[n]!;
    y1 = y;
    lp += top * (y - lp);
    out[n] = lp;
    if (n < early) sum += lp * lp;
  }
  const rms = Math.sqrt(sum / Math.max(1, early));
  if (rms > 0) for (let n = 0; n < out.length; n++) out[n] = (out[n]! / rms) * 0.2;
  return out;
}
