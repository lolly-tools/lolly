// SPDX-License-Identifier: MPL-2.0
/**
 * A Fender Rhodes, built from measurements of recorded instruments: a Mark II stage piano
 * taken from its harp into a valve preamp (53 single notes over six octaves), a second
 * Rhodes's notes an octave apart, and recorded chords on the Mark II, all for measurement
 * only. No recording is in this repository; what is kept is numbers, noted where used.
 *
 * The instrument: a hammer strikes a tine, a thin rod tuned by its spring and joined to a
 * heavy tone bar, which together ring like a tuning fork. The tine's tip swings in front of
 * an electromagnetic pickup, and the pickup's output is not in proportion to the swing: the
 * field falls off with distance and the tine sits a little to one side of the pickup's
 * centre. So the pickup itself makes the harmonics. A tine swinging gently gives nearly a
 * sine; struck harder, it swings further into the bend of the pickup's curve and the
 * second and third harmonics climb towards the fundamental, the "bark". The measured notes
 * show this inside every note: as the swing dies away, the harmonics fall faster than the
 * fundamental (the second 2.3 times as fast in decibels a second, the third 3.7 times),
 * so the tone darkens as the note rings, and the pickup's curve sets how much brighter a
 * harder stroke is.
 *
 * What is modelled, each fitted to the recorded notes:
 * - Harmonics: their levels against the fundamental 30 ms after the strike, by register
 *   (PARTIALS: a low note barks on its own, H2 and H3 within a few decibels of the
 *   fundamental; in the middle of the keyboard H2 sits 15 to 19 dB down and H3 16 to 23;
 *   at the top the note is nearly a sine, H2 32 to 36 dB down). The fundamental's decay
 *   by register (DECAY: about 3 to 4 dB a second through the middle, the tone bar's long
 *   sustain, 9 at D5, 14 at D6, 25 at the top), smooth, with no beating. Each harmonic
 *   decays faster than the fundamental, the second 2.3 times as fast and the fourth and
 *   above about 5 times (HARMONIC_FALL).
 * - Velocity: a harder stroke swings the tine further, raising harmonic n by n - 1
 *   decibels for each decibel of swing (the pickup's curve), held under a ceiling a few
 *   decibels over the fundamental.
 * - The tine's own bending mode, the bell in the first moments: a partial 7.3 to 7.6
 *   times the fundamental through the middle and lower registers (6.4 near D6), about 42 dB
 *   under the fundamental over the first 40 ms and dying at about 280 dB a second.
 * - The hammer's contact: a short burst at no pitch, centred near 2.5 kHz. In the first 10
 *   ms the octaves at 1, 2 and 4 kHz stand 20, 35 and 57 dB under the held note's whole
 *   level, as in the recordings. The note is at full level within 2 ms.
 * - The damper: when the key is let go, a felt stops the tine; the recorded chord fell
 *   more than 20 dB within about 30 ms of its release.
 *
 * The fundamental and the second harmonic, the parts that ring for seconds, play as two
 * oscillators; the rest (the upper harmonics, the tine's bell and the hammer) is worked out
 * once per note and strength and kept, so a held chord costs little. Pure rendering
 * (rhodesNote) has no Web Audio and is deterministic for the same note and seed.
 */

/** The voice's needs: an audio context and a seeded source (lib/lofi-voices.ts's VoiceKit is one). */
export interface RhodesKit { ctx: BaseAudioContext; rng: () => number }

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** Where the register tables are measured (MIDI notes), and each table's value at those notes. */
const KNOTS = [28, 40, 48, 56, 64, 74, 86, 96] as const;
/**
 * Harmonics 2 to 6 against the fundamental (dB), 30 ms into a note struck at VEL_REF, by
 * register: the median of the recorded notes in each stretch of the keyboard.
 */
const PARTIALS: ReadonlyArray<readonly number[]> = [
  [-3, -10, -15.5, -16.5, -18.5, -20, -32, -36],
  [-5, -8, -16, -20, -23, -34, -58, -72],
  [-19, -18, -33, -35, -38, -46, -72, -95],
  [-19, -35, -50, -48, -48, -55, -85, -100],
  [-28, -36, -57, -55, -55, -63, -85, -100],
];
/** The fundamental's decay (dB a second), by register. */
const DECAY = [1, 1.8, 2.9, 3.2, 3.9, 9, 14, 25] as const;
/**
 * How much faster each harmonic above the first decays, as a share of the fundamental's
 * rate, and the most: the recorded notes' harmonics fell 2.3 times as fast as the
 * fundamental (the second), 3.7 (the third) and about 5 from the fourth up.
 */
export const HARMONIC_FALL = 1.35;
const FALL_MOST = 5.2;
/** The strength the register tables were measured at: the keys' usual stroke. */
export const VEL_REF = 0.55;
/** The highest a harmonic climbs against the fundamental, however hard the stroke (dB), and how softly it bends to that ceiling. */
const CEILING = 2, CEILING_SOFT = 3;
/** The tine's bending mode: its ratio to the fundamental by register ([MIDI, ratio]), its level against the fundamental at the strike (dB at VEL_REF) and its decay (dB a second). */
const TINE_RATIO: ReadonlyArray<readonly [number, number]> = [[48, 7.55], [60, 7.5], [74, 7.33], [86, 6.45]];
const TINE_DB = -37, TINE_DECAY = 280;
/** The hammer's burst: its centre (Hz), its level against the fundamental at the strike (dB at VEL_REF), how quickly it dies (s). */
const HAMMER_HZ = 2500, HAMMER_DB = -45, HAMMER_TAU = 0.0025;
/** The note reaches its level in this long (s). */
const ONSET = 0.0015;
/** The damper's stop: the time constant of the fall once the key is let go (s). */
export const DAMPER = 0.012;
/** The fundamental's level at VEL_REF, against the voice's output. Set so the keys stem holds its level against the voice it replaced (K-weighted, soloed). */
const LEVEL = 0.127;
/** The highest harmonic worth rendering. */
const TOP_HZ = 10000;

/** A register table's value at `midi`, straight lines between the measured places. */
function at(table: readonly number[], midi: number): number {
  if (midi <= KNOTS[0]) return table[0]!;
  for (let i = 1; i < KNOTS.length; i++) {
    if (midi <= KNOTS[i]!) {
      const u = (midi - KNOTS[i - 1]!) / (KNOTS[i]! - KNOTS[i - 1]!);
      return table[i - 1]! + (table[i]! - table[i - 1]!) * u;
    }
  }
  return table[table.length - 1]!;
}

/** One partial of a struck note: its frequency against the fundamental, its level against the fundamental's at the strike (linear) and its decay (dB a second). */
export interface RhodesPartial { ratio: number; level: number; decay: number }

/** The harmonics of a note at `midi` struck at `vel`: the fundamental first, then each harmonic under TOP_HZ. */
export function rhodesHarmonics(midi: number, vel: number): RhodesPartial[] {
  const swing = 20 * Math.log10(Math.max(0.02, vel) / VEL_REF);
  const d1 = at(DECAY, midi);
  const f = mtof(midi);
  const out: RhodesPartial[] = [{ ratio: 1, level: 1, decay: d1 }];
  for (let n = 2; n * f < TOP_HZ; n++) {
    const base = n - 2 < PARTIALS.length ? at(PARTIALS[n - 2]!, midi) : at(PARTIALS[PARTIALS.length - 1]!, midi) - 8 * (n - 6);
    const raised = base + (n - 1) * swing;
    // Held under the ceiling, bending smoothly up to the ceiling.
    const db = -CEILING_SOFT * Math.log(Math.exp(-raised / CEILING_SOFT) + Math.exp(-CEILING / CEILING_SOFT));
    out.push({ ratio: n, level: 10 ** (db / 20), decay: d1 * Math.min(FALL_MOST, 1 + HARMONIC_FALL * (n - 1)) });
  }
  return out;
}

/** The tine's bending mode at `midi` struck at `vel`. */
export function rhodesTine(midi: number, vel: number): RhodesPartial {
  let ratio = TINE_RATIO[0]![1];
  for (let i = 1; i < TINE_RATIO.length; i++) {
    const [m0, r0] = TINE_RATIO[i - 1]!, [m1, r1] = TINE_RATIO[i]!;
    if (midi >= m0) ratio = midi >= m1 ? r1 : r0 + ((r1 - r0) * (midi - m0)) / (m1 - m0);
  }
  const swing = 20 * Math.log10(Math.max(0.02, vel) / VEL_REF);
  return { ratio, level: 10 ** ((TINE_DB + swing) / 20), decay: TINE_DECAY };
}

export interface RhodesSpec {
  sr: number; midi: number;
  /** How hard the key is struck (0 to 1). */
  vel: number;
  /** Seconds to render: the note rings with no damper over them. */
  seconds: number;
  /** Render from this harmonic up (1 the whole note; 3 leaves out the two the oscillators play). */
  from?: number;
}

/**
 * A struck note, ringing on its own: the harmonics from `from` up, the tine's bell and the
 * hammer's burst, at the voice's level (the fundamental at LEVEL times the strength).
 * Deterministic for the same spec and seed.
 */
export function rhodesNote(spec: RhodesSpec, rand: () => number): Float32Array {
  const { sr, midi, vel } = spec;
  const len = Math.ceil(spec.seconds * sr);
  const out = new Float32Array(len);
  const f = mtof(midi);
  const a1 = LEVEL * vel;
  const from = spec.from ?? 1;
  const parts = rhodesHarmonics(midi, vel).filter(p => p.ratio >= from);
  const tine = rhodesTine(midi, vel);
  if (tine.ratio * f < sr * 0.45) parts.push(tine);
  for (const p of parts) {
    const hz = p.ratio * f;
    if (hz >= sr * 0.45) continue;
    const amp = a1 * p.level;
    const k = Math.exp(-(p.decay * Math.LN10) / 20 / sr);
    // A partial stops being worth adding 80 dB under the fundamental's strike.
    const life = Math.min(len, Math.ceil((80 + 20 * Math.log10(p.level)) / p.decay * sr));
    const w = (2 * Math.PI * hz) / sr;
    const c = Math.cos(w) * k, s = Math.sin(w) * k;
    let re = 1, im = 0;
    for (let i = 0; i < life; i++) {
      out[i] = out[i]! + amp * im;
      const r = re * c - im * s; im = re * s + im * c; re = r;
    }
  }
  // The hammer's burst: noise, decaying fast, through a band near HAMMER_HZ.
  const burst = Math.min(len, Math.round(HAMMER_TAU * 8 * sr));
  const amp = a1 * 10 ** (HAMMER_DB / 20) * (vel / VEL_REF) ** 0.5 * 3;
  const wb = (2 * Math.PI * HAMMER_HZ) / sr, al = Math.sin(wb) / (2 * 0.7), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, c1 = (-2 * Math.cos(wb)) / a0, c2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < burst; i++) {
    const v = (rand() * 2 - 1) * Math.exp(-i / (HAMMER_TAU * sr));
    const y = b0 * v + b2 * x2 - c1 * y1 - c2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    out[i] = out[i]! + amp * y;
  }
  // The strike: full level within ONSET.
  const ramp = Math.min(len, Math.round(ONSET * sr));
  for (let i = 0; i < ramp; i++) out[i] = out[i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / ramp));
  // The end of the buffer: a short fade, so a note held past it does not click.
  const fade = Math.min(len, Math.round(0.02 * sr));
  for (let i = 0; i < fade; i++) out[len - 1 - i] = out[len - 1 - i]! * (i / fade);
  return out;
}

/** How long the upper part of a note is worth keeping (s): until it is 60 dB under the fundamental's strike, at most UPPER_MAX. */
const UPPER_MAX = 3;
function upperSeconds(midi: number, vel: number): number {
  const h3 = rhodesHarmonics(midi, vel)[2];
  if (!h3) return 0.5;
  const db = 20 * Math.log10(h3.level);
  return Math.min(UPPER_MAX, Math.max(0.5, (60 + db) / h3.decay + 0.05));
}

/** The upper parts rendered so far, per context: one per note and strength (in steps of a twentieth). */
const UPPER = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
function upperBuffer(k: RhodesKit, midi: number, vel: number): AudioBuffer {
  let cache = UPPER.get(k.ctx);
  if (!cache) { cache = new Map(); UPPER.set(k.ctx, cache); }
  const key = `${midi}|${vel}`;
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 160) cache.clear();
    let a = (Math.imul(midi + 1, 0x9e3779b1) ^ Math.round(vel * 100)) >>> 0;
    const rand = (): number => {
      a = (a + 0x6d2b79f5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const sr = k.ctx.sampleRate;
    const data = rhodesNote({ sr, midi, vel, seconds: upperSeconds(midi, vel), from: 3 }, rand);
    buf = k.ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    cache.set(key, buf);
  }
  return buf;
}

/** The smallest level an envelope falls toward. */
const EPS = 0.0001;

/**
 * One Rhodes note into `out` at `t`, struck at `vel` and held `dur` seconds: the
 * fundamental and second harmonic as oscillators, the rest from the kept upper part, all
 * stopped together by the damper.
 */
export function rhodes(k: RhodesKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const v = Math.max(0.05, Math.min(1, Math.round(vel * 20) / 20));
  const held = Math.max(0.05, dur);
  const stop = t + held + DAMPER * 8;
  // A tine is tuned by hand: each note a cent or two from true.
  const cents = (k.rng() - 0.5) * 3;
  const f = mtof(midi);
  const parts = rhodesHarmonics(midi, v);
  const note = ctx.createGain();
  note.gain.setValueAtTime(1, t);
  note.gain.setTargetAtTime(EPS, t + held, DAMPER);
  note.connect(out);
  for (const p of parts.slice(0, 2)) {
    const o = ctx.createOscillator();
    o.frequency.value = f * p.ratio;
    o.detune.value = cents;
    const g = ctx.createGain();
    const peak = LEVEL * v * p.level;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + ONSET);
    g.gain.setTargetAtTime(0, t + ONSET, 20 / Math.LN10 / p.decay);
    o.connect(g).connect(note);
    o.start(t);
    o.stop(stop);
  }
  const src = ctx.createBufferSource();
  src.buffer = upperBuffer(k, midi, v);
  src.detune.value = cents;
  src.connect(note);
  src.start(t);
  src.stop(Math.min(stop, t + src.buffer.duration));
}
