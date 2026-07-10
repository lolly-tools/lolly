/**
 * Shared ZzFX preset bank + ZzFXM composition helpers for the ingest/generator
 * scripts (procedural generator, MIDI→ZzFXM, MOD→ZzFXM, hand-authored). Pure —
 * no fs/network — so callers can render-verify via the engine.
 *
 * Note numbers follow ZzFXM: 12 = a voice's base frequency; other notes
 * transpose by 2**((n-12)/12). TONAL voices are based at C4 (bass/sub at C2, two
 * octaves down) so the SAME note number means the same pitch class across voices
 * — melody/chords stay in key. DRUMS are unpitched character sounds: always
 * struck at note 12 (their own base), never transposed.
 *
 * The drum + a few timbre presets are adapted from the ZzFXM converter's vetted
 * instrument table (github.com/keithclark/ZzFXM, MIT), with the sparse-array
 * "default" holes resolved to explicit values (a song JSON can't carry holes).
 */
import { zzfxR, type ZzfxSong, type ZzfxInstrument } from '../../engine/src/zzfxm.ts';

const C4 = 261.63;
const C2 = 65.41;

/**
 * Voice bank (ZzFX param lists). Tonal voices are soft/low-volume so summed
 * layers don't clip. Param order: volume, randomness, frequency, attack,
 * sustain, release, shape(0 sin/1 tri/2 saw/3 tan/4 noise), shapeCurve, slide,
 * deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush,
 * delay, sustainVolume, decay, tremolo, filter.
 */
export const PRESETS = {
  // ── tonal (C4 / C2 based) ─────────────────────────────────────────────
  pad:     [0.5, 0, C4, 0.25, 0, 2.2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6],
  warmPad: [0.42, 0, C4, 0.3, 0.25, 2.0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.55],
  sweep:   [0.3, 0, C4, 1.2, 0.4, 2.8, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5], // slow soothing swell
  bell:    [0.5, 0, C4, 0.01, 0.05, 0.7, 1, 1],
  glass:   [0.42, 0, C4, 0.005, 0.03, 0.9, 0, 1],
  pluck:   [0.45, 0, C4, 0.005, 0.05, 0.5, 2, 1],
  bass:    [0.6, 0, C2, 0.03, 0.15, 0.9, 0],
  sub:     [0.68, 0, C2, 0.05, 0.2, 1.1, 0],
  // ── drums (struck at note 12; adapted from ZzFXM's table, softened) ────
  kick:    [0.9, 0, 84, 0, 0, 0.1, 0, 0.7, 0, 0, 0, 0.5, 0, 6.7, 1, 0.05],
  snare:   [0.7, 0, 655, 0, 0, 0.09, 3, 1.65, 0, 0, 0, 0, 0.02, 3.8, -0.1, 0, 0.2],
  hat:     [0.5, 0, 4000, 0, 0, 0.03, 2, 1.25, 0, 0, 0, 0, 0.02, 6.8, -0.3, 0, 0.5],
  openhat: [0.45, 0, 2100, 0, 0, 0.1, 3, 3, 0, 0, -400, 0, 0, 2],
  clap:    [0.55, 0, 220, 0, 0, 0.1, 3, 0, 0, 0, 320, 0, 0, 4],
} satisfies Record<string, ZzfxInstrument>;
export type PresetName = keyof typeof PRESETS;

/** Pentatonic note pools (note numbers, low→high, ~1.5 octaves). No dissonance. */
export const SCALES = {
  majorPent: [12, 14, 16, 19, 21, 24, 26, 28], // C D E G A …
  minorPent: [12, 15, 17, 19, 22, 24, 27, 29], // C Eb F G Bb …
  suspended: [12, 14, 17, 19, 22, 24, 26, 29], // C D F G Bb … airy/open
} satisfies Record<string, number[]>;
export type ScaleName = keyof typeof SCALES;

const STEPS = 16; // steps per pattern
const R = 0; // rest / let the previous note ring

/** Deterministic PRNG so generated songs are byte-stable across runs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seconds one STEPS-long pattern lasts at a BPM (matches ZzFXM's beat math). */
export function patternSeconds(bpm: number): number {
  const beatLen = ((zzfxR / bpm) * 60) >> 2;
  return (STEPS * beatLen) / zzfxR;
}

// ── channel builders ────────────────────────────────────────────────────
/** A channel row: [instrumentIndex, panning, ...16 notes]. */
function channel(inst: number, pan: number, notes: number[]): number[] {
  return [inst, pan, ...notes];
}
/** 16 steps with `note` placed at the given step indices, rests elsewhere. */
function hits(steps: number[], note = 12): number[] {
  const a = new Array<number>(STEPS).fill(R);
  for (const s of steps) if (s >= 0 && s < STEPS) a[s] = note;
  return a;
}
/** 16 steps from explicit [step, note] pairs. */
function placed(entries: [number, number][]): number[] {
  const a = new Array<number>(STEPS).fill(R);
  for (const [s, n] of entries) if (s >= 0 && s < STEPS) a[s] = n;
  return a;
}
/** A calm stepwise random-walk melody over the scale, anchored to the bar root. */
function walk(rng: () => number, scale: number[], root: number, restProb: number): number[] {
  let idx = scale.indexOf(root);
  if (idx < 0) idx = Math.floor(scale.length / 2);
  const mel: number[] = [];
  for (let s = 0; s < STEPS; s++) {
    if (s > 0 && rng() < restProb) {
      mel.push(R);
      continue;
    }
    const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)]!;
    idx = Math.max(0, Math.min(scale.length - 1, idx + step));
    mel.push(scale[idx]!);
  }
  mel[0] = root;
  return mel;
}
/** Cycle distinct patterns into a ~targetSec sequence (loops cleanly). */
function arrange(numPatterns: number, bpm: number, targetSec: number): number[] {
  const count = Math.max(numPatterns * 2, Math.round(targetSec / patternSeconds(bpm)));
  const seq: number[] = [];
  for (let i = 0; i < count; i++) seq.push(i % numPatterns);
  return seq;
}

export type Archetype = 'ambient' | 'rhythmic' | 'melodic';

export interface SongSpec {
  archetype: Archetype;
  seed: number;
  bpm: number;
  scale: ScaleName;
  /** Bar roots (note numbers > 0), one per distinct pattern; a progression. */
  roots: number[];
  targetSec: number;
  /** Melody/stab voice (default per archetype). */
  lead?: PresetName;
  /** Bass voice (default per archetype). */
  bass?: PresetName;
  restProb?: number;
  pan?: number;
}

/**
 * Compose a ZzFXM song in one of three shapes for variety:
 *  - ambient  : warm pad + a soothing swell + sparse melody + sub — no drums, slow.
 *  - rhythmic : kick/snare/hats + a bass groove + a chord stab — beat-driven.
 *  - melodic  : lead melody + pad + bass + light offbeat hats.
 * Deterministic; arranged to ~targetSec by pattern reuse.
 */
export function composeSong(spec: SongSpec): ZzfxSong {
  const rng = mulberry32(spec.seed);
  const scale = SCALES[spec.scale];
  const pan = spec.pan ?? 0;

  let instruments: ZzfxInstrument[];
  const patterns: number[][][] = [];

  if (spec.archetype === 'ambient') {
    instruments = [PRESETS.warmPad, PRESETS.sweep, PRESETS[spec.lead ?? 'glass'], PRESETS.sub];
    const restProb = spec.restProb ?? 0.55;
    for (const root of spec.roots) {
      patterns.push([
        channel(0, 0, placed([[0, root], [8, root + 7]])), // warm pad
        channel(1, 0, placed([[0, root]])), // soothing swell, rings the bar
        channel(2, pan, walk(rng, scale, root, restProb)), // sparse melody
        channel(3, 0, placed([[0, root]])), // sub
      ]);
    }
  } else if (spec.archetype === 'rhythmic') {
    instruments = [PRESETS.kick, PRESETS.snare, PRESETS.hat, PRESETS[spec.bass ?? 'bass'], PRESETS[spec.lead ?? 'pluck']];
    for (const root of spec.roots) {
      patterns.push([
        channel(0, 0, hits([0, 4, 8, 12])), // kick — four on the floor
        channel(1, 0, hits([4, 12])), // snare — backbeat
        channel(2, 0, hits([0, 2, 4, 6, 8, 10, 12, 14])), // hats — eighths
        channel(3, 0, placed([[0, root], [3, root], [8, root], [11, root]])), // bass groove
        channel(4, pan, placed([[0, root], [8, root + 7]])), // chord stab
      ]);
    }
  } else {
    instruments = [PRESETS.pad, PRESETS[spec.lead ?? 'bell'], PRESETS.bass, PRESETS.hat];
    const restProb = spec.restProb ?? 0.3;
    for (const root of spec.roots) {
      patterns.push([
        channel(0, 0, placed([[0, root], [8, root + 7]])), // pad
        channel(1, pan, walk(rng, scale, root, restProb)), // lead melody
        channel(2, 0, placed([[0, root], [8, root]])), // bass
        channel(3, 0, hits([2, 6, 10, 14])), // light offbeat hats
      ]);
    }
  }

  return {
    bpm: spec.bpm,
    instruments,
    patterns,
    sequence: arrange(spec.roots.length, spec.bpm, spec.targetSec),
  };
}
