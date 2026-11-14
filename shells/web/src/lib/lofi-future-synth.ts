// SPDX-License-Identifier: MPL-2.0
/**
 * The future-bass chord's layers, worked out in JS sample by sample, for lib/lofi-future.ts
 * to play back from buffers. A real future-bass chord is several sounds stacked, and each is
 * built here as a producer builds it:
 *
 * - The stack: a dense supersaw. Many saws a note, each a little out of tune with the next on
 *   an uneven curve (the JP-8000's: the inner voices close to the pitch, the outer ones far,
 *   so the beats between them never line up), each starting at its own phase, spread across
 *   the speakers, with a thinner stack an octave up spread wider still. The low mids are kept
 *   in the middle (the side signal is high-passed), as a mix engineer keeps them, so the
 *   chord is wide on top and mono where the 808 lives. A little high-passed noise rides on
 *   it: the "hash" a supersaw's aliasing and the producer's compression bring up between
 *   the harmonics.
 * - The pluck: a short, bright strike for the attack, the filter closing fast.
 * - The body: a sub-octave saw, dark and mono, under the lowest note of a chord.
 *
 * A stack's buffer loops without a seam: each saw's frequency is rounded to a whole number of
 * cycles in the buffer, so every saw ends where it began. The player sets the exact pitch
 * with the playback rate, and starts each note at its own place in the loop, so two notes of
 * one pitch never sound the same.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same arguments and seed.
 */

/** How a stack of saws is built. */
export interface StackSpec {
  /** Saws in the main stack (odd, so one sits on the pitch). */
  voices: number;
  /** How far out of tune the outermost saws are (cents either side). */
  spread: number;
  /** The level of the saw on the pitch, and of each saw beside it. A centre no louder than the
   *  sides keeps the middle of the chord from swamping its width. */
  centre: number;
  side: number;
  /** Saws in the stack an octave up, how far out of tune and how loud (against the main stack). */
  octave: { voices: number; spread: number; level: number };
  /** The noise on top: its level against the saws (dB) and the frequency it is high-passed at (Hz). */
  hash: { db: number; from: number };
  /** Where the side signal is high-passed: below it the stack is mono (Hz). */
  monoBelow: number;
  /** How wide the voices are spread (0 all in the middle, 1 hard left and right at the edges). */
  width: number;
}

/** The stack live playing builds: rich enough to be the real sound, quick enough to build mid-tune. */
export const LIVE_STACK: StackSpec = {
  voices: 7, spread: 36, centre: 0.8, side: 0.86,
  octave: { voices: 5, spread: 28, level: 0.34 },
  hash: { db: -16, from: 5000 }, monoBelow: 260, width: 0.95,
};

/** The stack a render builds, at no cost to the playing: more saws, so the chord is denser and the beats slower to repeat. */
export const HQ_STACK: StackSpec = {
  voices: 11, spread: 40, centre: 0.75, side: 0.8,
  octave: { voices: 7, spread: 30, level: 0.34 },
  hash: { db: -16, from: 5000 }, monoBelow: 260, width: 0.97,
};

/**
 * The detunes of `n` saws (cents), the JP-8000's uneven spacing: each side's offsets grow as
 * the 1.6th power of the step out, so with three a side they sit at about 0.17, 0.52 and 1 of
 * the spread, and the right side is a touch narrower than the left, so no two beats match.
 */
export function detuneCurve(n: number, spread: number): number[] {
  if (n <= 1) return [0];
  const half = Math.floor(n / 2);
  const out: number[] = [];
  for (let i = half; i >= 1; i--) out.push(-spread * (i / half) ** 1.6);
  if (n % 2 === 1) out.push(0);
  for (let i = 1; i <= half; i++) out.push(spread * 0.98 * (i / half) ** 1.6);
  return out;
}

/**
 * Each saw's place across the speakers (-1 to 1), for detunes from detuneCurve: the one on
 * the pitch in the middle, and each pair (the flat and the sharp saw the same step out) split
 * between the sides, the flat one left in one pair and right in the next, so neither side is
 * the sharp side. Even the innermost pair sits well out (the chord is wide, as the records'
 * are), and the outermost is the widest.
 */
export function stackPans(detunes: readonly number[], width: number): number[] {
  const max = Math.max(...detunes.map(Math.abs)) || 1;
  const stepOut = (d: number): number => detunes.filter(x => Math.sign(x) === Math.sign(d) && Math.abs(x) < Math.abs(d)).length;
  return detunes.map(d => {
    if (d === 0) return 0;
    const side = (stepOut(d) % 2 === 0 ? 1 : -1) * Math.sign(d);
    return side * width * (0.82 + 0.18 * (Math.abs(d) / max) ** 0.5);
  });
}

/** A saw's frequency rounded to a whole number of cycles in `seconds`, kept apart from those already taken. */
function wholeCycles(f: number, seconds: number, taken: Set<number>): number {
  let k = Math.max(1, Math.round(f * seconds));
  for (let d = 1; taken.has(k); d++) k = Math.max(1, Math.round(f * seconds) + (d % 2 ? d : -d) * 1);
  taken.add(k);
  return k / seconds;
}

/** One band-limited saw (PolyBLEP), added into `l` and `r` with the pan's equal-power gains. */
function addSaw(l: Float32Array, r: Float32Array, sr: number, f: number, phase0: number, gain: number, pan: number): void {
  const dt = f / sr;
  if (dt >= 0.5) return;   // above the context's Nyquist frequency: nothing to add
  const a = (pan + 1) * Math.PI / 4;
  const gl = gain * Math.cos(a), gr = gain * Math.sin(a);
  let p = phase0;
  for (let i = 0; i < l.length; i++) {
    let v = 2 * p - 1;
    if (p < dt) { const t = p / dt; v -= t + t - t * t - 1; }
    else if (p > 1 - dt) { const t = (p - 1) / dt; v -= t * t + t + t + 1; }
    l[i]! += v * gl;
    r[i]! += v * gr;
    p += dt;
    if (p >= 1) p -= 1;
  }
}

/**
 * A two-pole filter run over a looping signal in place: run once over the end first, so the
 * filter starts in the state the loop's end leaves it in and the join is not heard.
 */
function biquadLoop(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): void {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const warm = Math.min(x.length, 4096);
  for (let i = x.length - warm; i < x.length; i++) {
    const y = b0 * x[i]! + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]!; y2 = y1; y1 = y;
  }
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
}

/** A Butterworth high-pass's coefficients (RBJ), at `f` Hz. */
function highpassCoefs(sr: number, f: number): [number, number, number, number, number] {
  const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr;
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  return [(1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0, -2 * cos / a0, (1 - alpha) / a0];
}

/** The level a stack's saws are brought to: about the old four-saw voice's, so the mix around it keeps its balance. */
const STACK_PEAK = 0.5;

/**
 * A stereo stack of saws at `f` Hz, `seconds` long, that loops without a seam (each saw a whole
 * number of cycles), with its octave stack, its hash and its mono low mids. Returns the left
 * and right channels and the frequency its middle saw actually plays (to set the exact pitch).
 */
export function sawStack(spec: StackSpec, sr: number, f: number, seconds: number, rand: () => number): { l: Float32Array; r: Float32Array; centre: number } {
  const n = Math.max(1, Math.round(seconds * sr));
  const len = n / sr;
  const l = new Float32Array(n), r = new Float32Array(n);
  const taken = new Set<number>();
  const centre = wholeCycles(f, len, taken);
  const layer = (voices: number, spread: number, level: number, at: number, width: number): void => {
    const detunes = detuneCurve(voices, spread);
    const pans = stackPans(detunes, width);
    // Equal loudness whatever the count: saws at random phases add as power.
    const norm = level / Math.sqrt(spec.centre * spec.centre + (voices - 1) * spec.side * spec.side);
    detunes.forEach((c, i) => {
      const fi = c === 0 && at === f ? centre : wholeCycles(at * 2 ** (c / 1200), len, taken);
      addSaw(l, r, sr, fi, rand(), norm * (c === 0 ? spec.centre : spec.side), pans[i]!);
    });
  };
  layer(spec.voices, spec.spread, 1, f, spec.width);
  if (spec.octave.voices > 0) layer(spec.octave.voices, spec.octave.spread, spec.octave.level, f * 2, Math.min(1, spec.width * 1.08));
  // The hash: noise high-passed twice, a little under the saws, different on each side.
  if (spec.hash.db > -90) {
    const hl = new Float32Array(n), hr = new Float32Array(n);
    for (let i = 0; i < n; i++) { hl[i] = rand() * 2 - 1; hr[i] = rand() * 2 - 1; }
    const c = highpassCoefs(sr, spec.hash.from);
    for (const h of [hl, hr]) { biquadLoop(h, ...c); biquadLoop(h, ...c); }
    const g = 10 ** (spec.hash.db / 20) * 0.6;
    for (let i = 0; i < n; i++) { l[i]! += hl[i]! * g; r[i]! += hr[i]! * g; }
  }
  // The low mids in the middle: the side signal high-passed.
  if (spec.monoBelow > 0) {
    const side = new Float32Array(n);
    for (let i = 0; i < n; i++) side[i] = (l[i]! - r[i]!) / 2;
    const c = highpassCoefs(sr, spec.monoBelow);
    biquadLoop(side, ...c);
    for (let i = 0; i < n; i++) {
      const mid = (l[i]! + r[i]!) / 2;
      l[i] = mid + side[i]!;
      r[i] = mid - side[i]!;
    }
  }
  normalise([l, r], STACK_PEAK);
  return { l, r, centre };
}

/** Bring the loudest sample of the channels to `peak`. */
function normalise(chs: Float32Array[], peak: number): void {
  let max = 0;
  for (const ch of chs) for (let i = 0; i < ch.length; i++) max = Math.max(max, Math.abs(ch[i]!));
  if (max <= 0) return;
  const g = peak / max;
  for (const ch of chs) for (let i = 0; i < ch.length; i++) ch[i]! *= g;
}

/** The pluck's length (s): it is over long before a stab is. */
export const PLUCK_SECONDS = 0.32;

/**
 * The pluck on a chord note's attack: close saws and a square an octave up, through a
 * low-pass that strikes open (about 9 kHz) and closes to under a kilohertz within a tenth of a
 * second, the level falling as fast, with a two-millisecond tick of noise on the front. Each
 * side has its own pair of saws, tuned apart the other way, so the strike is as wide as the
 * stack behind it; the tick and the square sit in the middle.
 */
export function pluckTone(sr: number, f: number, rand: () => number): { l: Float32Array; r: Float32Array } {
  const n = Math.round(PLUCK_SECONDS * sr);
  const l = new Float32Array(n), r = new Float32Array(n);
  const nyq = sr / 2;
  // [frequency, gain, side]: the side is -1 left, 1 right, 0 both.
  const voices: Array<[number, number, number]> = [
    [f, 0.4, 0], [f * 2, 0.28, 0],
    [f * 2 ** (9 / 1200), 0.36, -1], [f * 2 ** (-5 / 1200), 0.3, -1],
    [f * 2 ** (-9 / 1200), 0.36, 1], [f * 2 ** (5 / 1200), 0.3, 1],
  ];
  const phase = voices.map(() => rand());
  const inc = voices.map(([fv]) => (fv < nyq ? fv / sr : 0));
  const tick = Math.round(sr * 0.002);
  // The cutoff's and the level's falls, as per-sample factors (no exp in the loop).
  const cutFall = Math.exp(-1 / (0.035 * sr)), levelFall = Math.exp(-1 / (0.075 * sr)), riseFall = Math.exp(-1 / (0.0008 * sr));
  let open = 8100, level = 1, rise = 1;
  const lp = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    let mid = 0, left = 0, right = 0;
    for (let v = 0; v < voices.length; v++) {
      const [, g, side] = voices[v]!;
      const p = phase[v]!;
      const x = g * (v === 1 ? (p < 0.5 ? 1 : -1) : 2 * p - 1);
      if (side < 0) left += x; else if (side > 0) right += x; else mid += x;
      phase[v] = p + inc[v]! >= 1 ? p + inc[v]! - 1 : p + inc[v]!;
    }
    if (i < tick) mid += (rand() * 2 - 1) * 0.6 * (1 - i / tick);
    const a = 2 * Math.PI * Math.min(900 + open, nyq * 0.9) / sr;
    const g = a / (1 + a);   // a one-pole's coefficient, close enough to 1 - e^-a at these cutoffs
    lp[0]! += g * (mid + left - lp[0]!); lp[1]! += g * (lp[0]! - lp[1]!);
    lp[2]! += g * (mid + right - lp[2]!); lp[3]! += g * (lp[2]! - lp[3]!);
    const env = (1 - rise) * level;
    l[i] = lp[1]! * env;
    r[i] = lp[3]! * env;
    open *= cutFall; level *= levelFall; rise *= riseFall;
  }
  normalise([l, r], 0.5);
  return { l, r };
}

/**
 * The body under a chord: two saws an octave below the note, a few cents apart, through two
 * gentle low-passes (about 450 Hz), mono. Loops without a seam, as the stack does. Returns the
 * samples and the frequency the body actually plays at (a whole number of cycles), so the
 * player sets the exact pitch with the playback rate as it does for a stack.
 */
export function bodyTone(sr: number, f: number, seconds: number, rand: () => number): { data: Float32Array; centre: number } {
  const n = Math.max(1, Math.round(seconds * sr));
  const len = n / sr;
  const l = new Float32Array(n), r = new Float32Array(n);
  const taken = new Set<number>();
  const centre = wholeCycles(f / 2, len, taken);
  addSaw(l, r, sr, centre, rand(), 0.5, 0);
  addSaw(l, r, sr, wholeCycles((f / 2) * 2 ** (6 / 1200), len, taken), rand(), 0.4, 0);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = (l[i]! + r[i]!) / 2;
  const w = 2 * Math.PI * Math.min(450, sr * 0.45) / sr;
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const lp: [number, number, number, number, number] = [(1 - cos) / 2 / a0, (1 - cos) / a0, (1 - cos) / 2 / a0, -2 * cos / a0, (1 - alpha) / a0];
  biquadLoop(data, ...lp);
  biquadLoop(data, ...lp);
  normalise([data], 0.5);
  return { data, centre };
}
