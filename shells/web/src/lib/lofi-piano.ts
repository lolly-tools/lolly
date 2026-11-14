// SPDX-License-Identifier: MPL-2.0
/**
 * A bright acoustic grand piano (the keys' 'grand'), modelled as the instrument works and
 * rendered once per note and strength, then played back, as the drum kit is:
 *
 * - The hammer. Felt is a stiff, nonlinear spring: struck harder, it squashes less of its
 *   travel and leaves the string sooner, so its push is shorter and reaches further up the
 *   string's partials. Its push is a half-sine `contact` long (about 4 ms on a soft bass
 *   note to under 1 ms on a hard treble one), whose spectrum is even to about
 *   1 / (2 contact) and falls steeply above. Voiced bright (harder felt, as a salsa or a pop
 *   record's piano is), the push is shorter still.
 * - The strike point. The hammer hits about an eighth of the way along the string, so the
 *   partials whose node is there (the 8th, 16th) are missing, and the ones near them weak.
 * - The string's stiffness. A steel string is a stiff bar as well as a string, so its nth
 *   partial sits at n f sqrt(1 + B n²), sharp of the harmonic series, by more the higher the
 *   string (B about 2e-4 at middle C, ten times that two octaves up). The tuning is
 *   stretched to match: the treble tuned a little sharp, the bass a little flat.
 * - The unison and the two decays. Most notes have three strings, tuned a cent or so apart.
 *   Coupled through the bridge, their motion splits into a mode in which they move together,
 *   pushing the soundboard hard and dying fast (the prompt sound), and modes in which they
 *   move against each other, barely pushing it, which ring on (the aftersound, 10 to 25 dB
 *   down). Each partial is therefore a fast decay and a slow one at slightly different
 *   pitches, which beat against each other: the slow shimmer of a piano note.
 * - The losses. Every partial loses energy to the soundboard and to the air and the string's
 *   own internal friction, the latter growing as the square of its frequency, so a note
 *   darkens as it rings.
 * - The soundboard. Struck, the whole case answers: a short knock of low and middle noise
 *   (the hammer's impact through the bridge, the key hitting its bed), louder the harder.
 *   The board also radiates the low partials of the bass weakly, and its wide resonances
 *   colour the middle.
 * - The damper. When the key lets go, the damper's felt drops onto the strings and stops them
 *   within a fraction of a second (the low strings more slowly). The top octave and a half
 *   has no dampers and rings on.
 *
 * Measured against recorded grand pianos (the University of Iowa MIS piano at pp, mf and
 * ff, C3 to C6, and Freesound CC0 close-miked grand notes; numbers only, no recording is in
 * this repository): the harmonic levels in the first 100 ms at each dynamic, each partial's
 * frequency (B) and decay, the prompt and aftersound levels, and the knock's level.
 *
 * Pure rendering below the player; deterministic from the seeded source handed in.
 */
import { noiseBand, normalise, ring, type Partial, type Rand } from './lofi-kit.ts';
import { EPS, mtof, type VoiceKit } from './lofi-voices.ts';

/** The keys this module plays. */
export const PIANO_KEYS = new Set<string>(['grand']);

/** The string's stiffness: the inharmonicity coefficient B for a key. */
export function inharmonicity(midi: number): number {
  // Measured: 1.1e-4 at C3, 2.9e-4 at C4, 6.4e-4 at A4, 8.4e-4 at C5 and 4.2e-3 at C6,
  // rising faster the higher the string; the wound bass strings level off.
  const d = midi - 60;
  return 10 ** (-3.54 + 0.036 * d + 0.0006 * d * d * (d > 0 ? 1 : 0.5)) + 6e-5 * Math.exp(-(midi - 21) / 8);
}
/** The stretched tuning: cents off equal temperament (the treble sharp, the bass flat), as a tuner sets a piano to its own partials. */
export function stretch(midi: number): number {
  const d = midi - 60;
  return d > 0 ? 0.0011 * d ** 2.4 : -0.006 * (-d) ** 1.6;
}
/**
 * Where the hammer's push stops reaching up the string's partials (Hz), by key and
 * strength: about 2.7 kHz at middle C, a little higher up the keyboard, and higher the
 * harder the key is struck (the felt stiffens as it squashes, so the push is shorter).
 */
export function hammerCutoff(midi: number, vel: number): number {
  return 2694 * 2 ** ((midi - 60) / 60) * Math.exp(0.431 * (vel - 0.55)) * PIANO.voicing;
}

/** The piano's measured numbers (see the module's note). */
export const PIANO = {
  /** The hammer's voicing: over 1 is harder felt, a brighter piano (1 is the recorded grand's). */
  voicing: 1,
  /** Where the hammer strikes, as a share of the string's length (an eighth and a bit in the middle, shorter in the treble). */
  strike: (midi: number): number => 1 / (8.33 + Math.max(0, midi - 60) * 0.256),
  /** How fast the partials fall away above the fundamental, before the hammer's own roll-off (1 / n to this power). */
  tilt: 0.82,
  /** How steeply the hammer's push falls off above its cutoff (the order of the roll-off). */
  order: 5,
  /** A harder stroke brightens everything above 500 Hz by this much per octave, per unit of strength (dB). */
  brighten: 5.84,
  /** The soundboard's radiation and the microphones close over the strings, by frequency: [Hz, dB]. */
  radiation: [[125, 3], [500, 0], [2000, -15], [8000, -14]] as ReadonlyArray<readonly [number, number]>,
  /** The prompt decay: losses as 1/tau = b1 + b3 f² (s⁻¹), b1 by key (a T60 of about 3.3 s at C3, 2.2 s at C4, 1.5 s at C5, 2.5 s at C6). */
  b1: (midi: number): number => (midi <= 72 ? 3.1 * 2 ** ((midi - 60) / 20) : 4.67 * 2 ** (-(midi - 72) / 16)),
  b3: 8e-8,
  /** The aftersound: its level against the prompt sound (a share, about 20 dB down), and how much longer it rings. */
  after: 0.1, afterLonger: 6,
  /** The unison's spread (cents, one deviation) between the strings of a note. */
  unison: 0.7,
  /** The soundboard's knock, against the note's loudest partial, at a full stroke. */
  knock: 1.2,
  /** The bass partials the board barely radiates: below this (Hz), weakened as the frequency falls. */
  boardLow: 110,
} as const;

/** The radiation curve's gain at `f` Hz (a share), between its measured points. */
function radiationAt(f: number): number {
  const pts = PIANO.radiation;
  const x = Math.log2(Math.max(pts[0]![0], Math.min(pts[pts.length - 1]![0], f)));
  for (let i = 1; i < pts.length; i++) {
    const [f1, d1] = pts[i]!, [f0, d0] = pts[i - 1]!;
    if (x <= Math.log2(f1)) return 10 ** ((d0 + ((x - Math.log2(f0)) / (Math.log2(f1) - Math.log2(f0))) * (d1 - d0)) / 20);
  }
  return 10 ** (pts[pts.length - 1]![1] / 20);
}
/** How strongly the hammer sets going a partial at `f` Hz, struck at `vel` with the push reaching `fc`. */
function hammerAt(f: number, fc: number, vel: number): number {
  const bright = 10 ** ((PIANO.brighten * (vel - 0.55) * Math.max(0, Math.log2(f / 500))) / 20);
  return bright / Math.sqrt(1 + (f / fc) ** (2 * PIANO.order));
}

/**
 * One note, struck at strength `vel` (0 to 1), as a new recording `seconds` long, before
 * any damper: every partial's prompt and aftersound, beating, and the soundboard's knock.
 */
export function pianoNote(sr: number, midi: number, vel: number, rand: Rand, seconds = 2.5): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * sr));
  const f0 = mtof(midi) * 2 ** (stretch(midi) / 1200);
  const B = inharmonicity(midi);
  const beta = PIANO.strike(midi);
  const fc = hammerCutoff(midi, vel);
  // The bass strings' fundamentals lead more than the middle's do (C3's harmonics measured 10 dB under C4's).
  const tilt = PIANO.tilt + 0.03 * Math.max(0, 60 - midi);
  const strings = midi < 33 ? 1 : midi < 45 ? 2 : 3;
  const partials: Partial[] = [];
  const top = Math.min(sr * 0.45, 14000);
  for (let n = 1; n <= 64; n++) {
    const f = n * f0 * Math.sqrt(1 + B * n * n);
    if (f >= top) break;
    const board = (f < PIANO.boardLow ? (f / PIANO.boardLow) ** 1.5 : 1) * radiationAt(f);
    const a = Math.abs(Math.sin(n * Math.PI * beta)) / n ** tilt * hammerAt(f, fc, vel) * board;
    if (a < 1e-4) continue;
    const tau = 1 / (PIANO.b1(midi) + PIANO.b3 * f * f);
    // The prompt sound: the strings moving together.
    partials.push({ f: f * 2 ** ((rand() - 0.5) * PIANO.unison * 0.3 / 1200), a: a * (1 - PIANO.after), tau, bloom: 0, phase: 0 });
    // The aftersound: the strings against each other, a little apart in pitch, ringing on.
    if (strings > 1) {
      for (let s = 0; s < strings - 1; s++) {
        const cents = (s === 0 ? 1 : -1) * PIANO.unison * (0.6 + 0.8 * rand());
        partials.push({ f: f * 2 ** (cents / 1200), a: (a * PIANO.after) / (strings - 1), tau: tau * PIANO.afterLonger, bloom: 0, phase: 0 });
      }
    } else partials.push({ f, a: a * PIANO.after, tau: tau * PIANO.afterLonger * 0.8, bloom: 0, phase: 0 });
  }
  ring(out, sr, partials, rand, 0, 2e-4);
  // The soundboard's knock: the hammer's blow through the bridge and the key on its bed.
  let peak = 0;
  for (let i = 0; i < Math.min(out.length, sr * 0.05); i++) peak = Math.max(peak, Math.abs(out[i]!));
  // Relatively louder up the keyboard, where the strings give the board less to say.
  const knock = PIANO.knock * peak * (0.4 + 0.6 * vel ** 1.5) * 2 ** ((midi - 60) / 12);
  // The case's low thump (the board's lowest modes, under the note), and the key and hammer higher up.
  noiseBand(out, sr, rand, 90, 0.8, knock, 0.002, 0.03);
  noiseBand(out, sr, rand, Math.min(400, 0.4 * f0), 0.9, knock * 0.7, 0.0015, 0.025);
  noiseBand(out, sr, rand, 700 + midi * 6, 0.8, knock * 0.3, 0.0004, 0.012);
  return normalise(out, 0.95);
}

// ── the player ────────────────────────────────────────────────────────────────

/** The strengths each note is rendered at. */
const LAYERS = [0.3, 0.55, 0.8, 1] as const;
/** The piano's level against the felt piano's on the same chords (K-weighted, measured). */
const GRAND_LEVEL = 0.42;
/** The highest key with a damper; the strings of the keys higher up ring on. */
const TOP_DAMPER = 89;

const BANKS = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
function noteRandom(name: string): Rand {
  let a = 2166136261;
  for (let i = 0; i < name.length; i++) a = Math.imul(a ^ name.charCodeAt(i), 16777619) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The loudness of a note at strength `vel`, against a full one rendered at that strength. */
function loudness(vel: number, layer: number): number {
  return (vel / layer) ** 1.1;
}

/**
 * Play a grand piano note: `dur` (s) until the key lets go and the damper falls. A note
 * short enough is rendered short (the damper will stop it), a long one with its full ring.
 */
export function grand(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const layer = LAYERS.reduce((b, x) => (Math.abs(x - vel) < Math.abs(b - vel) ? x : b), LAYERS[1]);
  const long = dur > 0.9 || midi > TOP_DAMPER;
  const seconds = long ? (midi < 48 ? 5 : midi < 72 ? 3.6 : 2.6) : 1.2;
  const name = `grand:${Math.round(midi)}:${layer}:${seconds}`;
  let bank = BANKS.get(k.ctx);
  if (!bank) { bank = new Map(); BANKS.set(k.ctx, bank); }
  let buf = bank.get(name);
  if (!buf) {
    if (bank.size > 300) bank.clear();
    const sr = k.ctx.sampleRate;
    const data = pianoNote(sr, Math.round(midi), layer, noteRandom(name), seconds);
    buf = k.ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    bank.set(name, buf);
  }
  const src = k.ctx.createBufferSource();
  src.buffer = buf;
  // A fractional key (a quarter-tone's) plays the nearest string, retuned.
  if (midi !== Math.round(midi)) src.playbackRate.value = 2 ** ((midi - Math.round(midi)) / 12);
  const g = k.ctx.createGain();
  const level = GRAND_LEVEL * loudness(vel, layer);
  g.gain.setValueAtTime(level, t);
  const length = buf.length / k.ctx.sampleRate;
  if (midi <= TOP_DAMPER) {
    // The damper: faster in the treble, slower on the heavy bass strings.
    const tau = 0.018 + 0.05 * Math.max(0, (72 - midi) / 48);
    g.gain.setTargetAtTime(EPS, t + Math.max(0.02, dur), tau);
  } else g.gain.setTargetAtTime(EPS, t + length - 0.05, 0.02);
  src.connect(g).connect(out);
  src.start(t);
  src.stop(t + (midi > TOP_DAMPER ? length : Math.min(length, Math.max(0.02, dur) + 0.6)));
}
