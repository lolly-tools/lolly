// SPDX-License-Identifier: MPL-2.0
/**
 * The sounds of a place outdoors, for botanica (engine/src/lofi-botanica.ts): birds, wind,
 * rustling leaves, running and dripping water, rain, insects, and a twig snapping or a
 * droplet falling as percussion. Lolly ships no samples, so none of this is a recording:
 * each is a model of how the sound is made, driven by a seed, and the same seed always
 * gives the same bytes.
 *
 * - Birds sing syllables: a nearly pure whistle whose pitch sweeps, with a faint second
 *   harmonic, under an envelope that opens and closes in a few tens of milliseconds. Each
 *   bird's song is its syllable shapes, how fast it says them and its range: a blackbird's
 *   low fluted warble ending in a twitter, a robin's thin cascade of quick sweeps, a wren's
 *   rattling trills, a thrush saying each phrase two or three times, a wood pigeon's coo,
 *   and the Australian magpie's carol of two voices gliding between the notes of a
 *   pentatonic scale with trills and a gurgle (the magpie lib/lofi-voices.ts sings for
 *   Straya, rendered here as a buffer and measured against a recorded one).
 * - Wind is the air's rush, pink-ish noise whose loudness and brightness follow a gust: a
 *   slow random swell that reverts to its mean (an Ornstein-Uhlenbeck process), with a
 *   hollow band that rises as the wind gets up.
 * - Leaves rustle as many small clicks, each a few milliseconds of bright noise, crowding
 *   as the gust rises, over the hiss of the leaves too small and many to hear apart.
 * - Running water is bubbles (after van den Doel, "Physically based models for liquid
 *   sounds", 2005): each a sine at the bubble's Minnaert frequency, its pitch rising as it
 *   nears the surface and dying away, hundreds a second over a soft rush.
 * - A drip is one bigger bubble that rises steeply in pitch (the plink), after a tiny tap,
 *   in drips that come nearly evenly from each source, as from a tap or a cave's ceiling.
 * - Rain is drops striking (short clicks) and some landing in water (small bubbles), over
 *   the patter's noise.
 * - A cricket chirps: three to five pulses of a pure tone near 4.5 kHz, a chirp or two a
 *   second; a cicada buzzes, noise pulsed hundreds of times a second in a high band; a bee
 *   hums at its wingbeat, nearer and further as it passes.
 *
 * A bed (wind, leaves, water, rain, insects) is rendered as a loop of a dozen seconds per
 * tune and played from different places in it (see bedLoop), so a long tune costs one loop
 * per kind rather than a render per bar. Pure: no DOM, no Web Audio; the player at the end
 * is the only part that touches a context.
 */
import { BOTANICA_BIRDS, BOTANICA_INSECTS, readNature, type BotanicaBird, type BotanicaInsect, type BotanicaNature } from '../../../../engine/src/lofi-botanica.ts';

export type Stereo = [Float32Array, Float32Array];

// ── seeded sources and small filters ─────────────────────────────────────────

/** A small seeded source (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Several numbers mixed into one seed (FNV-1a over their 32-bit words). */
export function mix(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) {
    let v = x >>> 0;
    for (let k = 0; k < 4; k++) { h = Math.imul(h ^ (v & 0xff), 16777619) >>> 0; v >>>= 8; }
  }
  return h >>> 0;
}
/** A normal draw (Box-Muller). */
function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

/** An RBJ biquad, its coefficients settable while it runs. */
export class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  private readonly sr: number;
  constructor(sr: number) { this.sr = sr; }
  /** 'lp', 'hp' or 'bp' (a band-pass whose peak is 0 dB) at `f` Hz with quality `q`. */
  set(type: 'lp' | 'hp' | 'bp', f: number, q = 0.707): this {
    const w = (2 * Math.PI * Math.min(this.sr * 0.45, Math.max(10, f))) / this.sr;
    const cw = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    if (type === 'lp') { this.b0 = (1 - cw) / 2 / a0; this.b1 = (1 - cw) / a0; this.b2 = this.b0; }
    else if (type === 'hp') { this.b0 = (1 + cw) / 2 / a0; this.b1 = -(1 + cw) / a0; this.b2 = this.b0; }
    else { this.b0 = al / a0; this.b1 = 0; this.b2 = -al / a0; }
    this.a1 = (-2 * cw) / a0; this.a2 = (1 - al) / a0;
    return this;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Pink-ish noise (Paul Kellet's three-pole economy filter over white). */
class Pink {
  private p0 = 0; private p1 = 0; private p2 = 0;
  private readonly r: () => number;
  constructor(r: () => number) { this.r = r; }
  next(): number {
    const w = this.r() * 2 - 1;
    this.p0 = 0.99765 * this.p0 + w * 0.099;
    this.p1 = 0.963 * this.p1 + w * 0.2965;
    this.p2 = 0.57 * this.p2 + w * 1.0526;
    return (this.p0 + this.p1 + this.p2 + w * 0.1848) * 0.25;
  }
}

/**
 * A gust: a level between about 0.1 and 1 that wanders and reverts to its mean (an
 * Ornstein-Uhlenbeck process, `tau` seconds to forget), sampled every `hop` samples and
 * eased between. Wind and the leaves it moves share one, so they rise together.
 */
export function gustCurve(sr: number, n: number, seed: number, tau = 4, mean = 0.45, spread = 0.28): Float32Array {
  const r = seeded(mix(seed, 0x6057));
  const hop = Math.max(1, Math.round(sr / 50));
  const steps = Math.ceil(n / hop) + 2;
  const dt = hop / sr;
  const pts = new Float32Array(steps);
  let x = mean + spread * gauss(r) * 0.5;
  const a = Math.exp(-dt / tau), s = spread * Math.sqrt(1 - a * a);
  for (let k = 0; k < steps; k++) {
    x = mean + (x - mean) * a + s * gauss(r);
    pts[k] = Math.max(0.06, Math.min(1, x));
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / hop, k = Math.floor(p), u = p - k;
    const e = u * u * (3 - 2 * u);
    out[i] = pts[k]! * (1 - e) + pts[k + 1]! * e;
  }
  return out;
}

// ── birds ────────────────────────────────────────────────────────────────────

/** One element of a song: when it starts (s), how long, its pitch path (Hz at its start, middle and end), its level, and a rattle's rate (Hz, 0 none). */
interface Syllable { at: number; len: number; f: readonly [number, number, number]; level: number; trill?: number }

/** An element's shape: a held note, a slur, a hook (a steep fall into a held tail), a quick sweep, or a rattle (a note pulsed fast). */
type Shape = 'note' | 'slur' | 'hook' | 'sweep' | 'rattle';

/**
 * How a bird sings, from measured recordings (see the tests' notes): its range (Hz), the
 * shapes of its elements by weight, their lengths (most short, a share long), the gaps
 * between them, how far it jumps from one element to the next (octaves, one deviation),
 * how it repeats (an element over and over in a wren's trill, a motif two to four times in
 * a thrush's phrase), and its harmonics (a bird's whistle is nearly pure: the second
 * harmonic 29 to 39 dB down in the recordings).
 */
interface Species {
  lo: number; hi: number;
  shapes: ReadonlyArray<readonly [Shape, number]>;
  short: readonly [number, number]; long: readonly [number, number]; longShare: number;
  gap: readonly [number, number];
  jump: number;
  /** Elements in a motif, and times the motif is said. */
  motif: readonly [number, number]; reps: readonly [number, number];
  h2: number; h3: number;
  /** How far its elements bend, against the widest (a blackbird's notes are nearly level, a thrush's hooks fall far). */
  bend: number;
}
const SPECIES: Record<Exclude<BotanicaBird, 'magpie' | 'dove'>, Species> = {
  // A blackbird's fluted warble: low, mostly held or gently slurred notes, then a quiet high twitter.
  blackbird: { lo: 1450, hi: 3500, shapes: [['note', 6], ['slur', 1.5], ['hook', 0.5], ['rattle', 1]], short: [0.01, 0.03], long: [0.06, 0.14], longShare: 0.25, gap: [0.025, 0.07], jump: 0.3, motif: [1, 1], reps: [1, 1], h2: 0.02, h3: 0.006, bend: 1.1 },
  // A robin's thin cascade: short held notes high up, jumping far between them, a few quick sweeps.
  robin: { lo: 2600, hi: 8000, shapes: [['note', 6], ['sweep', 1], ['slur', 1], ['rattle', 1]], short: [0.008, 0.024], long: [0.06, 0.15], longShare: 0.18, gap: [0.005, 0.02], jump: 0.5, motif: [1, 1], reps: [1, 2], h2: 0.012, h3: 0.003, bend: 1.3 },
  // A wren's rattle: hooks and short notes, each repeated fast in a trill, trill after trill.
  wren: { lo: 3400, hi: 7700, shapes: [['hook', 4], ['note', 2], ['sweep', 2]], short: [0.01, 0.022], long: [0.035, 0.06], longShare: 0.12, gap: [0.01, 0.025], jump: 0.25, motif: [1, 2], reps: [4, 10], h2: 0.012, h3: 0.003, bend: 0.75 },
  // A song thrush: a motif of a few hooks, sweeps and notes, said two to four times, then the next.
  thrush: { lo: 2500, hi: 7500, shapes: [['hook', 3], ['sweep', 2], ['note', 2], ['slur', 2], ['rattle', 1]], short: [0.015, 0.05], long: [0.07, 0.15], longShare: 0.25, gap: [0.015, 0.045], jump: 0.4, motif: [2, 5], reps: [2, 4], h2: 0.035, h3: 0.01, bend: 1.3 },
};

/** An element's pitch path, from its shape round `f`, its bends scaled by `bend`. */
function pathOf(r: () => number, shape: Shape, f: number, bend = 1): readonly [number, number, number] {
  const between = (lo: number, hi: number): number => (lo + r() * (hi - lo)) * bend;
  switch (shape) {
    case 'note': { const w = between(0.01, 0.05); return [f * (1 - w), f * (1 + w * 0.5), f * (1 - w * 0.3)]; }
    case 'slur': { const w = between(0.08, 0.22) * (r() < 0.5 ? -1 : 1); return [f * (1 - w), f, f * (1 + w)]; }
    case 'hook': { const w = between(0.25, 0.5); return [f * (1 + w), f * 1.03, f]; }
    case 'sweep': { const w = between(0.25, 0.5) * (r() < 0.6 ? -1 : 1); return [f * (1 - w), f, f * (1 + w)]; }
    default: return [f, f * 1.01, f];
  }
}

/** The elements of one phrase of a song, `seconds` long at most. */
function songOf(bird: Exclude<BotanicaBird, 'magpie' | 'dove'>, seconds: number, r: () => number): Syllable[] {
  const sp = SPECIES[bird];
  const out: Syllable[] = [];
  const between = (lo: number, hi: number): number => lo + r() * (hi - lo);
  const shapes = sp.shapes.reduce((s, [, w]) => s + w, 0);
  const shapeOf = (): Shape => { let roll = r() * shapes; for (const [s, w] of sp.shapes) { roll -= w; if (roll < 0) return s; } return 'note'; };
  const clampF = (f: number): number => Math.max(sp.lo, Math.min(sp.hi, f));
  let centre = Math.sqrt(sp.lo * sp.hi) * 2 ** ((r() - 0.5) * 0.6);
  let t = 0.02;
  const twitterFrom = bird === 'blackbird' ? seconds * between(0.6, 0.8) : Infinity;
  while (t < seconds - 0.05) {
    if (t > twitterFrom) {
      // A blackbird's phrase ends in a twitter: quick, quiet, higher elements.
      const len = between(0.008, 0.022);
      out.push({ at: t, len, f: pathOf(r, r() < 0.5 ? 'sweep' : 'note', between(3300, 4800), 0.4), level: between(0.25, 0.45) });
      t += len + between(0.012, 0.035);
      continue;
    }
    const motif: Array<Omit<Syllable, 'at'> & { gap: number }> = [];
    const count = sp.motif[0] + Math.floor(r() * (sp.motif[1] - sp.motif[0] + 1));
    for (let k = 0; k < count; k++) {
      centre = clampF(centre * 2 ** (gauss(r) * sp.jump));
      const shape = shapeOf();
      const len = r() < sp.longShare ? between(sp.long[0], sp.long[1]) : between(sp.short[0], sp.short[1]);
      const [a, b, c] = pathOf(r, shape, centre, sp.bend);
      const path = [clampF(a), clampF(b), clampF(c)] as const;
      motif.push({ len, f: path, level: between(0.55, 1), trill: shape === 'rattle' ? between(28, 55) : 0, gap: between(sp.gap[0], sp.gap[1]) });
    }
    const reps = sp.reps[0] + Math.floor(r() * (sp.reps[1] - sp.reps[0] + 1));
    for (let rep = 0; rep < reps && t < seconds - 0.03; rep++) {
      for (const e of motif) {
        if (t >= seconds - 0.03) break;
        out.push({ at: t, len: e.len, f: e.f, level: e.level * (0.9 + r() * 0.1), ...(e.trill ? { trill: e.trill } : {}) });
        t += e.len + e.gap;
      }
      if (sp.motif[1] > 1) t += between(0.03, 0.08);
    }
    if (sp.reps[1] > 1) t += between(0.02, 0.08);
  }
  return out;
}

/** Sing elements into `out` from `at` (s), each a whistle along its path with its faint harmonics; a rattle pulses fast. */
function sing(out: Float32Array, sr: number, syllables: readonly Syllable[], sp: { h2: number; h3: number }, r: () => number, gain: number, at = 0): void {
  for (const s of syllables) {
    const start = Math.round((at + s.at) * sr);
    const n = Math.round(s.len * sr);
    if (start + n >= out.length) break;
    let phase = r() * Math.PI * 2;
    const rise = Math.max(1, Math.round(Math.min(0.006, s.len * 0.2) * sr));
    const fall = Math.max(1, Math.round(Math.min(0.012, s.len * 0.3) * sr));
    for (let i = 0; i < n; i++) {
      const u = i / n;
      // The pitch path: a smooth curve through start, middle and end (a hook falls fast, then holds).
      const f = u < 0.5 ? s.f[0] + (s.f[1] - s.f[0]) * Math.sin((u * Math.PI)) : s.f[1] + (s.f[2] - s.f[1]) * (1 - Math.cos((u - 0.5) * Math.PI));
      phase += (2 * Math.PI * f) / sr;
      const env = Math.min(1, i / rise, (n - i) / fall);
      const am = s.trill ? 0.55 + 0.45 * Math.cos((2 * Math.PI * s.trill * i) / sr) : 1;
      const v = Math.sin(phase) + sp.h2 * Math.sin(2 * phase + 0.4) + sp.h3 * Math.sin(3 * phase + 1.1);
      out[start + i] = out[start + i]! + v * env * env * (3 - 2 * env) * am * s.level * gain;
    }
  }
}

/** A wood pigeon's coo: a breathy, hooted "oo" with its harmonics, five notes in the familiar rhythm. */
function coo(sr: number, seconds: number, centre: number, r: () => number): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * sr));
  // coo-COO-coo, coo-coo: the second note longest and loudest.
  const notes: ReadonlyArray<readonly [number, number, number, number]> = [[0, 0.32, 0.95, 0.7], [0.42, 0.55, 1.05, 1], [1.05, 0.3, 0.97, 0.75], [1.55, 0.28, 1, 0.8], [1.93, 0.3, 0.96, 0.7]];
  const breath = new Biquad(sr).set('bp', centre * 1.5, 1.2);
  for (const [at, len, ratio, level] of notes) {
    const start = Math.round(at * sr), n = Math.round(len * sr);
    let phase = 0;
    for (let i = 0; i < n && start + i < out.length; i++) {
      const u = i / n;
      const f = centre * ratio * (1 + 0.06 * Math.sin(Math.PI * u) - 0.04 * u);
      phase += (2 * Math.PI * f) / sr;
      const env = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 1.5;
      const v = Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase) + 0.5 * breath.run(r() * 2 - 1);
      out[start + i] = v * env * level * 0.5;
    }
  }
  return out;
}

/**
 * The Australian magpie's carol, after lib/lofi-voices.ts's magpie for Straya: two voices
 * on the notes of a pentatonic scale round `centre`, each note gliding in from the last
 * and struck afresh, some trilled, some a gurgle, now and then one leaping an octave or
 * two, with the harmonics a magpie's throat gives (the second about 24 dB down in the
 * recordings).
 */
function carol(sr: number, seconds: number, centre: number, r: () => number): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * sr));
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const midi = 12 * Math.log2(centre / 440) + 69 - 7;
  for (let voice = 0; voice < 2; voice++) {
    const begin = voice * (0.1 + r() * 0.3);
    const end = Math.min(seconds - 0.05, begin + 0.8 + r() * seconds);
    if (end <= begin + 0.2) continue;
    let f = 440 * 2 ** ((midi - 69) / 12);
    let phase = 0, trillPhase = 0;
    let t = begin;
    while (t < end - 0.03) {
      const len = 0.008 + r() ** 2 * 0.07;
      const leap = r() < 0.2 ? 12 * (1 + Math.floor(r() * 2)) : 0;
      const target = 440 * 2 ** ((midi + (voice ? -5 : 0) + scale[Math.floor(r() * scale.length)]! + leap - 69) / 12);
      const trill = r() < 0.2 ? 0.02 : 0;
      const level = 0.5 + r() * 0.5;
      const glide = r() < 0.2 ? 0.3 : 0.05;
      const from = f;
      const start = Math.round(t * sr), n = Math.round(len * sr);
      for (let i = 0; i < n && start + i < out.length; i++) {
        const u = i / n;
        f = from + (target - from) * Math.min(1, u / glide);
        trillPhase += (2 * Math.PI * 30) / sr;
        phase += (2 * Math.PI * f * (1 + trill * Math.sin(trillPhase))) / sr;
        const env = Math.min(1, u / 0.15, (1 - u) / 0.25);
        out[start + i] = out[start + i]! + (Math.sin(phase) + 0.06 * Math.sin(2 * phase + 0.3) + 0.02 * Math.sin(3 * phase)) * env * level * 0.45;
      }
      t += len + (r() < 0.85 ? 0.01 + r() * 0.035 : 0.003);
    }
  }
  return out;
}

/** One phrase of `bird`'s song, `seconds` long at most, round its pitch `centre` (Hz). Mono, peak about 0.5. */
export function birdPhrase(sr: number, bird: BotanicaBird, seconds: number, seed: number): Float32Array {
  const r = seeded(mix(seed, BOTANICA_BIRDS.indexOf(bird), 0xb12d));
  if (bird === 'dove') return coo(sr, Math.max(2.3, seconds), 520 + r() * 120, r);
  if (bird === 'magpie') return carol(sr, seconds, 950 + r() * 500, r);
  const out = new Float32Array(Math.ceil(seconds * sr));
  const sp = SPECIES[bird];
  sing(out, sr, songOf(bird, seconds, r), sp, r, 0.5);
  // A little air under the whistle: the bird is outdoors, a few metres off.
  const air = new Biquad(sr).set('hp', 200);
  for (let i = 0; i < out.length; i++) out[i] = air.run(out[i]!);
  return out;
}

/** The syllables a bird's phrase would sing, for the tests: their starts, lengths and pitch paths. */
export function birdSyllables(bird: Exclude<BotanicaBird, 'magpie' | 'dove'>, seconds: number, seed: number): Syllable[] {
  return songOf(bird, seconds, seeded(mix(seed, BOTANICA_BIRDS.indexOf(bird), 0xb12d)));
}

// ── beds ─────────────────────────────────────────────────────────────────────

/** Wind: the air's rush, its level and brightness following the gust, a hollow band rising as it gets up. */
export function wind(sr: number, seconds: number, seed: number, gust?: Float32Array): Stereo {
  const n = Math.ceil(seconds * sr);
  const g = gust ?? gustCurve(sr, n, seed, 4, 0.5, 0.18);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    const pink = new Pink(seeded(mix(seed, ch, 0x91d)));
    const lp = new Biquad(sr), band = new Biquad(sr), rumble = new Biquad(sr).set('hp', 40);
    const o = out[ch]!;
    for (let i = 0; i < n; i++) {
      const level = g[i]!;
      if (i % 64 === 0) {
        lp.set('lp', 380 + 2300 * level * level, 0.6);
        band.set('bp', 220 + 900 * level, 2.2);
      }
      const x = pink.next();
      o[i] = rumble.run(lp.run(x) * 0.9 + band.run(x) * 0.7 * level) * level * 1.4;
    }
  }
  return out;
}

/**
 * Leaves in the wind: a dense rustle (noise gated by many tiny contacts a second, too many
 * to hear apart, crowding as the gust rises) with now and then a louder crackle.
 */
export function leaves(sr: number, seconds: number, seed: number, gust?: Float32Array): Stereo {
  const n = Math.ceil(seconds * sr);
  const g = gust ?? gustCurve(sr, n, seed, 12, 0.5, 0.24);
  const r = seeded(mix(seed, 0x1ea5));
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    const w = seeded(mix(seed, ch, 0x415));
    const bp = new Biquad(sr).set('bp', 1500, 0.4), lp = new Biquad(sr).set('lp', 5200, 0.6);
    const o = out[ch]!;
    // Shot noise: contacts arrive at a rate that climbs with the gust, each opening the noise for a moment.
    let env = 0;
    const fall = Math.exp(-1 / (0.0009 * sr));
    for (let i = 0; i < n; i++) {
      const level = g[i]!;
      if (w() < ((2200 + 3500 * level) / sr)) env += 0.12 + 0.35 * w();
      env *= fall;
      o[i] = lp.run(bp.run((w() * 2 - 1) * env)) * (0.45 + 0.55 * level) * 0.5;
    }
  }
  // The louder crackles: a leaf against a branch, under one a second.
  for (let i = 0; i < n; i++) {
    if (r() >= (0.8 * g[i]!) / sr) continue;
    const len = Math.round((0.002 + r() * 0.006) * sr);
    const f = new Biquad(sr).set('bp', 1800 + r() * 3000, 1.2);
    const side = r();
    for (let k = 0; k < len * 3 && i + k < n; k++) {
      const v = f.run(r() * 2 - 1) * Math.exp(-k / len) * (0.2 + r() * 0.2);
      out[0][i + k] = out[0][i + k]! + v * (1 - side);
      out[1][i + k] = out[1][i + k]! + v * side;
    }
  }
  return out;
}

/**
 * One bubble into a pair of channels at `at`: a sine at its Minnaert frequency dying away
 * at van den Doel's damping, its pitch rising by `rise` times the damping (an air bubble
 * nearing the surface). Run as a rotating phasor whose step is set every 32 samples, which
 * costs a few multiplies a sample.
 */
function bubble(l: Float32Array, rr: Float32Array, sr: number, at: number, f0: number, amp: number, rise: number, pan: number, phase0: number): void {
  const d = 0.043 * f0 + 0.0014 * f0 ** 1.5;
  const n = Math.min(l.length - at, Math.ceil((4.6 / d) * sr));
  const sigma = rise * d;
  const gl = amp * Math.cos(pan * Math.PI / 2), gr = amp * Math.sin(pan * Math.PI / 2);
  let re = Math.cos(phase0), im = Math.sin(phase0);
  const decay = Math.exp(-d / sr);
  let cs = 1, sn = 0;
  for (let i = 0; i < n; i++) {
    if ((i & 31) === 0) {
      const w = (2 * Math.PI * f0 * (1 + sigma * (i / sr))) / sr;
      cs = Math.cos(w) * decay; sn = Math.sin(w) * decay;
    }
    const nr = re * cs - im * sn;
    im = re * sn + im * cs;
    re = nr;
    l[at + i] = l[at + i]! + im * gl;
    rr[at + i] = rr[at + i]! + im * gr;
  }
}

/** Running water: a broad rush (most of it from half a kilohertz to a few, as a brook's is) and a babble of bubbles, most between one and four kilohertz. */
export function stream(sr: number, seconds: number, seed: number): Stereo {
  const n = Math.ceil(seconds * sr);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const r = seeded(mix(seed, 0x57e));
  const g = gustCurve(sr, n, mix(seed, 0x57f), 2.5, 0.7, 0.12);
  for (let ch = 0; ch < 2; ch++) {
    const pink = new Pink(seeded(mix(seed, ch, 0x8a5)));
    const hp = new Biquad(sr).set('hp', 420, 0.6), lp = new Biquad(sr).set('lp', 6500, 0.5);
    const o = out[ch]!;
    for (let i = 0; i < n; i++) o[i] = lp.run(hp.run(pink.next())) * 0.55 * g[i]!;
  }
  const rate = 160;
  for (let i = 0; i < n; i++) {
    if (r() >= (rate * g[i]!) / sr) continue;
    // Radii from about 0.6 to 3.5 mm, most of them near 1 to 2 mm.
    const radius = 0.0006 + 0.0029 * r() ** 1.6;
    const f0 = 3.26 / radius;
    if (f0 > sr * 0.42) continue;
    bubble(out[0], out[1], sr, i, f0, 0.035 * (0.4 + r()), 0.05 + r() * 0.1, r(), r() * 6.283);
  }
  return out;
}

/** One drip's plink: a tap, then a bubble ringing at a few kilohertz and dying within about ten milliseconds, its pitch rising only a little. Mono. */
export function plink(sr: number, seed: number, f0?: number): Float32Array {
  const r = seeded(mix(seed, 0xd41));
  const f = f0 ?? 1300 + r() * 3100;
  const out = new Float32Array(Math.ceil(0.12 * sr));
  const right = new Float32Array(out.length);
  // The tap of the drop meeting the water: a click under a millisecond.
  const tap = new Biquad(sr).set('bp', 3500 + r() * 2500, 0.9);
  for (let i = 0; i < Math.round(0.0015 * sr); i++) out[i] = tap.run((r() * 2 - 1) * (1 - i / (0.0015 * sr))) * 0.25;
  bubble(out, right, sr, Math.round((0.001 + r() * 0.003) * sr), f, 0.6 * Math.SQRT2, 0.02 + r() * 0.06, 0, 0);
  return out;
}

/** Dripping: a few sources, each dripping at its own pace (a drip every one to four seconds), into water. */
export function drips(sr: number, seconds: number, seed: number): Stereo {
  const n = Math.ceil(seconds * sr);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const r = seeded(mix(seed, 0xd1f));
  const sources = 2 + Math.floor(r() * 3);
  for (let src = 0; src < sources; src++) {
    const period = 1 + r() * 3;
    const jitter = 0.3 + r() * 0.4;
    const pitch = 1300 + r() * 3100;
    const pan = r(), level = 0.35 + r() * 0.65;
    let t = r() * period;
    let k = 0;
    while (t < seconds - 0.15) {
      const p = plink(sr, mix(seed, src, k++), pitch * (0.94 + r() * 0.12));
      const at = Math.round(t * sr);
      for (let i = 0; i < p.length && at + i < n; i++) {
        out[0][at + i] = out[0][at + i]! + p[i]! * level * Math.cos(pan * Math.PI / 2);
        out[1][at + i] = out[1][at + i]! + p[i]! * level * Math.sin(pan * Math.PI / 2);
      }
      t += period * Math.max(0.15, 1 + jitter * gauss(r));
    }
  }
  return out;
}

/** Rain: drops striking (short clicks) and some landing in water (small bubbles), over the patter's noise. */
export function rain(sr: number, seconds: number, seed: number): Stereo {
  const n = Math.ceil(seconds * sr);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const r = seeded(mix(seed, 0x4a1));
  const g = gustCurve(sr, n, mix(seed, 0x4a2), 6, 0.55, 0.2);
  for (let ch = 0; ch < 2; ch++) {
    const pink = new Pink(seeded(mix(seed, ch, 0x4a3)));
    const lp = new Biquad(sr).set('lp', 6500, 0.5), hp = new Biquad(sr).set('hp', 400, 0.6);
    const o = out[ch]!;
    for (let i = 0; i < n; i++) o[i] = lp.run(hp.run(pink.next())) * 0.22 * g[i]!;
  }
  const rate = 650;
  const click = new Biquad(sr);
  for (let i = 0; i < n; i++) {
    if (r() >= (rate * g[i]!) / sr) continue;
    const pan = r();
    if (r() < 0.12) { bubble(out[0], out[1], sr, i, 2500 + r() * 4000, 0.05 + 0.08 * r(), 0.1 + r() * 0.2, pan, 0); continue; }
    const len = Math.round((0.0003 + r() * 0.0012) * sr);
    const amp = 0.04 + 0.22 * r() ** 4;
    click.set('bp', 1500 + r() * 6000, 0.8);
    const o = out[pan < 0.5 ? 0 : 1];
    for (let k = 0; k < len * 3 && i + k < n; k++) o[i + k] = o[i + k]! + click.run((r() * 2 - 1) * Math.exp(-k / len)) * amp;
  }
  return out;
}

/**
 * Crickets: each chirps a few pulses of a pure tone near 4.7 kHz, about sixty pulses a
 * second within a chirp and a chirp or two a second, at its own pace and distance.
 */
function crickets(sr: number, seconds: number, seed: number): Stereo {
  const n = Math.ceil(seconds * sr);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const r = seeded(mix(seed, 0xc41));
  const count = 2 + Math.floor(r() * 3);
  for (let c = 0; c < count; c++) {
    const carrier = 4500 + r() * 500;
    const pulse = 0.006 + r() * 0.003, pulseGap = 0.006 + r() * 0.004;
    const pulses = 4 + Math.floor(r() * 5);
    const chirpEvery = 0.4 + r() * 0.35;
    const level = (0.25 + r() * 0.75) * 0.3;
    const pan = r();
    let t = r() * chirpEvery;
    while (t < seconds - 0.2) {
      for (let p = 0; p < pulses; p++) {
        const at = Math.round((t + p * (pulse + pulseGap)) * sr), len = Math.round(pulse * sr);
        let phase = r() * 6.283;
        for (let i = 0; i < len && at + i < n; i++) {
          phase += (2 * Math.PI * carrier * (1 - 0.02 * (i / len))) / sr;
          const v = Math.sin(phase) * Math.sin(Math.PI * i / len) * level;
          out[0][at + i] = out[0][at + i]! + v * Math.cos(pan * Math.PI / 2);
          out[1][at + i] = out[1][at + i]! + v * Math.sin(pan * Math.PI / 2);
        }
      }
      t += chirpEvery * (0.9 + r() * 0.2);
    }
  }
  return out;
}

/**
 * Cicadas: each sings bursts of buzz (noise in a band near 4.5 kHz, pulsed about eighty
 * times a second) a few times a second, the chorus swelling and falling away.
 */
function cicada(sr: number, seconds: number, seed: number): Stereo {
  const n = Math.ceil(seconds * sr);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const r = seeded(mix(seed, 0xc1c));
  const swell = gustCurve(sr, n, mix(seed, 0xc1d), 3, 0.7, 0.2);
  const singers = 2 + Math.floor(r() * 2);
  for (let c = 0; c < singers; c++) {
    const rate = 76 + r() * 16;
    const burstRate = 4.5 + r() * 2.5, duty = 0.45 + r() * 0.2;
    const centre = 4100 + r() * 700;
    const pan = r(), level = 0.5 + r() * 0.5;
    const gl = Math.cos(pan * Math.PI / 2) * level * 0.5, gr = Math.sin(pan * Math.PI / 2) * level * 0.5;
    const w = seeded(mix(seed, c, 0xc1e));
    const bp = new Biquad(sr).set('bp', centre, 2.2), bp2 = new Biquad(sr).set('bp', centre, 1.4);
    let phase = r() * 6.283, burst = r();
    for (let i = 0; i < n; i++) {
      burst += burstRate / sr;
      if (burst % 1 >= duty) continue;
      phase += (2 * Math.PI * rate) / sr;
      const pulse = 0.5 + 0.5 * Math.sin(phase);
      const v = bp2.run(bp.run(w() * 2 - 1)) * pulse * pulse * swell[i]! * 2;
      out[0][i] = out[0][i]! + v * gl;
      out[1][i] = out[1][i]! + v * gr;
    }
  }
  return out;
}

/**
 * Bees about the flowers: a few, each humming at its wingbeat (about 450 Hz, as the
 * recorded bees did) with bright harmonics and the fizz of its wings, nearer and further
 * as it passes.
 */
function bee(sr: number, seconds: number, seed: number): Stereo {
  const n = Math.ceil(seconds * sr);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const r = seeded(mix(seed, 0xbee));
  const count = 2 + Math.floor(r() * 2);
  const block = 64;
  for (let b = 0; b < count; b++) {
    const wing = 400 + r() * 80;
    const pass = 0.15 + r() * 0.7;   // where it is nearest, as a share of the note
    const width = 0.15 + r() * 0.2;
    const lp = new Biquad(sr).set('lp', 8000, 0.6), buzz = new Biquad(sr).set('bp', 3000, 0.5), fizz = new Biquad(sr).set('hp', 1500, 0.6);
    const w = seeded(mix(seed, b, 0xf12));
    let phase = r(), near = 0, f = wing, gl = 0, gr = 0;
    for (let i = 0; i < n; i++) {
      if (i % block === 0) {
        // Where the bee is, set a few hundred times a second: how near, its Doppler sweep and its wavering hum, and its side.
        const u = i / n;
        near = Math.exp(-(((u - pass) / width) ** 2)) * Math.min(1, u * 20, (1 - u) * 20) * 0.2;
        f = wing * (1 + 0.035 * Math.tanh((pass - u) * 6)) * (1 + 0.01 * Math.sin(2 * Math.PI * 7 * i / sr));
        const pan = 0.5 + 0.4 * Math.tanh((u - pass) * 4);
        gl = Math.cos(pan * Math.PI / 2) * near; gr = Math.sin(pan * Math.PI / 2) * near;
      }
      if (near < 1e-4) continue;
      phase = (phase + f / sr) % 1;
      const saw = phase * 2 - 1;
      const v = lp.run(saw) * 0.5 + buzz.run(saw) * 0.8 + fizz.run(w() * 2 - 1) * (1 - phase) * 0.3;
      out[0][i] = out[0][i]! + v * gl;
      out[1][i] = out[1][i]! + v * gr;
    }
  }
  return out;
}

/** Insects: crickets, a cicada or a bee. */
export function insects(sr: number, seconds: number, seed: number, kind: BotanicaInsect): Stereo {
  return kind === 'cicada' ? cicada(sr, seconds, seed) : kind === 'bee' ? bee(sr, seconds, seed) : crickets(sr, seconds, seed);
}

/** A twig snapping: two or three fibres breaking within a few milliseconds, each a sharp crack with the wood's ring. Mono. */
export function twig(sr: number, seed: number): Float32Array {
  const r = seeded(mix(seed, 0x7e1));
  const out = new Float32Array(Math.ceil(0.12 * sr));
  const breaks = 2 + Math.floor(r() * 3);
  let at = 0;
  for (let b = 0; b < breaks; b++) {
    const ring = new Biquad(sr).set('bp', 1400 + r() * 2600, 4 + r() * 6);
    const crack = new Biquad(sr).set('hp', 2500);
    const amp = (b === 0 ? 1 : 0.4 + r() * 0.5) * 0.5;
    const tau = (0.004 + r() * 0.012) * sr;
    for (let i = 0; at + i < out.length && i < tau * 5; i++) {
      const x = r() * 2 - 1;
      const e = Math.exp(-i / tau);
      out[at + i] = out[at + i]! + (crack.run(x) * Math.exp(-i / (0.0006 * sr)) * 0.8 + ring.run(x) * e * 2) * amp;
    }
    at += Math.round((0.003 + r() * 0.012) * sr);
  }
  return out;
}

/** Make a stereo bed loop without a seam: its last `fade` seconds crossfaded into its first. */
export function seamless(bed: Stereo, sr: number, fade = 0.5): Stereo {
  const f = Math.min(Math.floor(bed[0].length / 3), Math.round(fade * sr));
  return bed.map((ch) => {
    const n = ch.length - f;
    const out = ch.slice(0, n);
    for (let i = 0; i < f; i++) {
      const u = i / f;
      out[i] = ch[i]! * Math.sin(u * Math.PI / 2) + ch[n + i]! * Math.cos(u * Math.PI / 2);
    }
    return out;
  }) as Stereo;
}

/** A bed of `kind` for `seconds`, from `seed` (for insects, which insect). */
export function bed(kind: BotanicaNature, sr: number, seconds: number, seed: number, insect: BotanicaInsect = 'cricket'): Stereo {
  switch (kind) {
    case 'wind': return wind(sr, seconds, seed);
    case 'leaves': return leaves(sr, seconds, seed);
    case 'stream': return stream(sr, seconds, seed);
    case 'drip': return drips(sr, seconds, seed);
    case 'rain': return rain(sr, seconds, seed);
    default: return insects(sr, seconds, seed, insect);
  }
}

// ── played ───────────────────────────────────────────────────────────────────

/** How long a bed's loop is (s): long enough that its repeats are not heard as a loop. */
export const BED_LOOP = 10;
/** Each kind's level in the mix against the others (a bed's loudest stretch is about this). */
const BED_LEVEL: Record<string, number> = { wind: 0.5, leaves: 0.7, stream: 0.55, drip: 0.5, rain: 0.55, insects: 0.45, bird: 0.42, twig: 0.55, droplet: 0.45 };

/** The loops and the phrases rendered so far, per context. */
const LOOPS = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

function cached(ctx: BaseAudioContext, key: string, make: () => Stereo | Float32Array, rate = ctx.sampleRate): AudioBuffer {
  let cache = LOOPS.get(ctx);
  if (!cache) { cache = new Map(); LOOPS.set(ctx, cache); }
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 160) cache.clear();
    const made = make();
    const chans = made instanceof Float32Array ? [made] : made;
    buf = ctx.createBuffer(chans.length, chans[0]!.length, rate);
    chans.forEach((c, k) => buf!.getChannelData(k).set(c));
    cache.set(key, buf);
  }
  return buf;
}

/**
 * One of a tune's loops of a bed: two takes a kind, played from different places, so a
 * long tune does not hear one loop over and over. Rendered at half the context's rate (a
 * bed's sound lies below about 9 kHz, and the buffer is resampled as it plays), which
 * halves the cost; see BED_RATE.
 */
export function bedLoop(ctx: BaseAudioContext, kind: BotanicaNature, tune: number, take: number, insect: BotanicaInsect): AudioBuffer {
  const which = take % 2;
  const rate = Math.round(ctx.sampleRate * BED_RATE);
  return cached(ctx, `bed|${kind}|${insect}|${tune}|${which}`, () => seamless(bed(kind, rate, BED_LOOP + 0.5, mix(tune, BOTANICA_NATURE_SALT, which, kind.length), insect), rate), rate);
}
/** The share of the context's rate a bed is rendered at. */
export const BED_RATE = 0.5;
const BOTANICA_NATURE_SALT = 0x9a7e;

/**
 * Play a `nature` note: a bed faded in and out over its length from a place in the tune's
 * loop, a bird's phrase from a side of the stage, or a twig or a droplet as percussion.
 * `tune` is the tune's seed, `take` tells this note from the tune's others.
 */
export function playNature(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel: number, seconds: number, mod: number, tune: number, take: number): void {
  const { kind, variant } = readNature(mod);
  const gain = ctx.createGain();
  const level = (BED_LEVEL[kind] ?? 0.5) * vel;
  const src = ctx.createBufferSource();
  if (kind === 'bird') {
    const bird = BOTANICA_BIRDS[variant % 8] ?? 'blackbird';
    const song = variant >> 3;
    src.buffer = cached(ctx, `bird|${bird}|${tune}|${song}|${Math.round(seconds * 10)}`, () => birdPhrase(ctx.sampleRate, bird, Math.min(4, seconds), mix(tune, song)));
    gain.gain.value = level;
    const pan = ctx.createStereoPanner();
    pan.pan.value = ((mix(tune, song, 7) % 1000) / 1000) * 1.4 - 0.7;
    src.connect(gain).connect(pan).connect(out);
    src.start(t);
    return;
  }
  if (kind === 'twig' || kind === 'droplet') {
    const which = variant % 12;
    src.buffer = cached(ctx, `${kind}|${tune}|${which}|${midi}`, () => (kind === 'twig' ? twig(ctx.sampleRate, mix(tune, which)) : plink(ctx.sampleRate, mix(tune, which), 440 * 2 ** ((midi - 69) / 12) * 0.25)));
    gain.gain.value = level;
    const pan = ctx.createStereoPanner();
    pan.pan.value = ((which * 37) % 100) / 100 * 1.2 - 0.6;
    src.connect(gain).connect(pan).connect(out);
    src.start(t);
    return;
  }
  const insect: BotanicaInsect = BOTANICA_INSECTS[variant % 8] ?? 'cricket';
  const buf = bedLoop(ctx, kind, tune, kind === 'insects' ? variant >> 3 : variant, insect);
  src.buffer = buf;
  src.loop = true;
  const fade = Math.min(1.2, seconds / 3);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + fade);
  gain.gain.setValueAtTime(level, t + seconds - fade);
  gain.gain.linearRampToValueAtTime(0, t + seconds);
  src.connect(gain).connect(out);
  src.start(t, (((take * 7919) % 1000) / 1000) * (BED_LOOP - 0.1));
  src.stop(t + seconds + 0.05);
}
