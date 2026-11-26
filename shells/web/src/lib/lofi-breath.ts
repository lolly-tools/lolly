// SPDX-License-Identifier: MPL-2.0
/**
 * Breath for any blown instrument, as pure buffers a model mixes into its note: the burst
 * of air as a note is articulated, the air heard before a note that starts out of silence,
 * and the breath drawn in a rest. No Web Audio and nothing about one instrument: each takes
 * a shape (its band, its length, its level and how that moves with the player's strength
 * and the note's speed) and a seed, and the same seed gives the same air.
 *
 * Levels are in dB against a reference the caller multiplies the buffer by (a model's own
 * held air, or its tone): at 0 dB a buffer's loudest moment has an RMS of 1 after its band
 * has shaped it, so the level reads the same whatever the band.
 *
 * Measured on recorded flutes, where this was first fitted: the air above 4 kHz jumps 3 to 7
 * dB over a note's own for 3 to 12 ms at each tongued onset, centred near 1.5 to 2.5 kHz,
 * every onset its own; a breath in a rest peaks 19 to 29 dB under the notes.
 */

/** A band of air: its centre (Hz), its width (octaves between its half-power points), and a bright edge above `topHz` (that share of the air again, unbanded; 0 none). */
export interface AirBand {
  centre: number; width: number;
  top?: number; topHz?: number;
}

/** An articulated onset's burst of air. */
export interface BurstShape extends AirBand {
  /** Its level (dB against the caller's reference) on a note blown at strength 0.5 that has time to settle (speed 0). */
  level: number;
  /** How long it lasts (s, the time constant of its fall) and how fast it comes in (s; 0.8 ms if left out). */
  length: number; rise?: number;
  /** How its level moves: dB per unit of strength about 0.5, and dB more on the quickest note (speed 1) than on a settled one. */
  perStrength?: number; perSpeed?: number;
  /** How each note's burst differs from the last: its level (dB, one deviation), its length and its centre (shares, either way). */
  spread?: number; lengthSpread?: number; centreSpread?: number;
}

/** The air heard before a note that starts out of silence: a swell that leads into the onset. */
export interface PreAttackShape extends AirBand {
  /** Its level (dB against the caller's reference) at the onset, on a note at strength 0.5, and dB per unit of strength about 0.5. */
  level: number; perStrength?: number;
  /** How long before the onset it starts (s), and how it swells: 1 a straight rise, more a later one. */
  length: number; curve?: number;
  /** How each note's differs: its level (dB, one deviation) and its length (a share, either way). */
  spread?: number; lengthSpread?: number;
}

/** A breath drawn in a rest: its bands (each with a level in dB against the first), and how much of it is rise and fall (shares of its length). */
export interface InhaleShape {
  bands: ReadonlyArray<AirBand & { level?: number }>;
  rise?: number; fall?: number;
}

/** The note the air belongs to: how hard it is blown (0 to 1), how quick it is (0 settled, 1 the quickest; see noteSpeed) and its seed. */
export interface BreathNote { strength: number; speed: number; seed: number }

/** A small seeded source (mulberry32): the same seed gives the same numbers. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How quick a note is, from its length (s): 1 at `fast` or shorter, 0 at `slow` or longer (time enough to settle). */
export function noteSpeed(seconds: number, fast = 0.1, slow = 0.3): number {
  return Math.min(1, Math.max(0, (slow - seconds) / (slow - fast)));
}

/** A normal draw (Box-Muller), cut at 2.5 deviations. */
function gauss(rand: () => number): number {
  const v = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  return Math.max(-2.5, Math.min(2.5, v));
}

/** A band's filters, run on noise one sample at a time: an RBJ band-pass at the centre plus the bright edge. */
class Band {
  private readonly b0: number; private readonly a1: number; private readonly a2: number;
  private readonly top: number; private readonly topPole: number;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0; private low = 0;
  constructor(sr: number, band: AirBand) {
    const w = (2 * Math.PI * Math.min(sr * 0.45, band.centre)) / sr;
    const q = 1 / (2 * Math.sinh((Math.LN2 / 2) * Math.max(0.1, band.width)));
    const al = Math.sin(w) / (2 * q), a0 = 1 + al;
    this.b0 = al / a0; this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - al) / a0;
    this.top = band.top ?? 0;
    this.topPole = Math.exp((-2 * Math.PI * Math.min(sr * 0.45, band.topHz ?? 4000)) / sr);
  }
  next(x: number): number {
    const y = this.b0 * x - this.b0 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    if (!this.top) return y;
    this.low = (1 - this.topPole) * x + this.topPole * this.low;
    return y + this.top * (x - this.low);
  }
}

/** The RMS a band gives unit-variance white noise: its impulse response's energy, so a buffer can be set to its stated level after the band. */
function bandGain(sr: number, band: AirBand): number {
  const f = new Band(sr, band);
  let e = 0;
  for (let i = 0; i < 4096; i++) { const y = f.next(i === 0 ? 1 : 0); e += y * y; }
  return Math.sqrt(e) || 1;
}

/** Noise of unit variance (uniform, scaled). */
const UNIT = Math.sqrt(3);

/**
 * The burst of air as a note is articulated: in within `rise`, falling away over `length`,
 * band-limited round its centre with its bright edge, its level moved by the note's strength
 * and speed and differing note to note by the seed. `seconds` long (enough for the fall by
 * default). Multiply by the reference the level is against.
 */
export function airBurst(sr: number, shape: BurstShape, note: BreathNote, seconds?: number): Float32Array {
  const rand = seededRandom(note.seed);
  const lengthShare = 1 + (shape.lengthSpread ?? 0) * (2 * rand() - 1);
  const centreShare = 1 + (shape.centreSpread ?? 0) * (2 * rand() - 1);
  const db = shape.level + (shape.perStrength ?? 0) * (note.strength - 0.5) + (shape.perSpeed ?? 0) * Math.min(1, Math.max(0, note.speed)) + (shape.spread ?? 0) * gauss(rand);
  const length = Math.max(0.001, shape.length * lengthShare);
  const band: AirBand = { ...shape, centre: shape.centre * centreShare };
  const n = Math.max(1, Math.round((seconds ?? length * 8) * sr));
  const out = new Float32Array(n);
  const f = new Band(sr, band);
  const amp = (10 ** (db / 20) * UNIT) / bandGain(sr, band);
  const fall = Math.exp(-1 / (length * sr));
  const riseStep = 1 / Math.max(1, (shape.rise ?? 0.0008) * sr);
  let env = 1, rise = 0;
  for (let i = 0; i < n; i++) {
    rise = Math.min(1, rise + riseStep);
    out[i] = f.next((rand() * 2 - 1) * amp * env * rise);
    env *= fall;
  }
  return out;
}

/**
 * The air before a note that starts out of silence (the breath moving before the tone
 * catches): `length` s that swell into the onset, ending at the level stated. The buffer's
 * last sample is the onset: place it so it ends where the note begins.
 */
export function preAttack(sr: number, shape: PreAttackShape, note: BreathNote): Float32Array {
  const rand = seededRandom(note.seed);
  const length = Math.max(0.005, shape.length * (1 + (shape.lengthSpread ?? 0) * (2 * rand() - 1)));
  const db = shape.level + (shape.perStrength ?? 0) * (note.strength - 0.5) + (shape.spread ?? 0) * gauss(rand);
  const n = Math.max(1, Math.round(length * sr));
  const out = new Float32Array(n);
  const f = new Band(sr, shape);
  const amp = (10 ** (db / 20) * UNIT) / bandGain(sr, shape);
  const curve = Math.max(0.2, shape.curve ?? 2);
  for (let i = 0; i < n; i++) out[i] = f.next((rand() * 2 - 1) * amp * ((i + 1) / n) ** curve);
  return out;
}

/**
 * A breath drawn in a rest: air through the lips and the mouth, a soft rush in its bands that
 * swells and fades, `seconds` long. At 0 dB its loudest 50 ms has an RMS of 1.
 */
export function inhale(sr: number, seconds: number, shape: InhaleShape, seed: number): Float32Array {
  const rand = seededRandom(seed);
  const n = Math.max(1, Math.round(seconds * sr));
  const out = new Float32Array(n);
  const bands = shape.bands.map((b) => ({ f: new Band(sr, b), level: 10 ** ((b.level ?? 0) / 20) }));
  const rise = shape.rise ?? 0.25, fall = shape.fall ?? 0.45;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    // In quickly, held, and let go more slowly: a breath through a small opening.
    const env = Math.min(1, x / rise) * Math.min(1, (1 - x) / fall);
    const e = (rand() * 2 - 1) * env * env;
    let y = 0;
    for (const b of bands) y += b.level * b.f.next(e);
    out[i] = y;
  }
  // Set the loudest 50 ms to an RMS of 1.
  const w = Math.max(1, Math.round(0.05 * sr));
  let best = 0;
  for (let a = 0; a + w <= n; a += Math.max(1, Math.round(w / 2))) {
    let s = 0;
    for (let i = a; i < a + w; i++) s += out[i]! * out[i]!;
    best = Math.max(best, s / w);
  }
  const g = best > 0 ? 1 / Math.sqrt(best) : 1;
  for (let i = 0; i < n; i++) out[i]! *= g;
  return out;
}
