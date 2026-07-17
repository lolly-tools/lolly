// SPDX-License-Identifier: MPL-2.0
/**
 * ZzFXM composition — the shared ZzFX preset bank + the archetype composer
 * behind Lolly's procedural music (Neurospicy Mode tracks, video music beds,
 * the ingest/generator scripts). Pure and deterministic — no fs/network, no
 * Date, no Math.random (the PRNG is seeded) — so a caller can render-verify a
 * composed song via renderZzfxm anywhere the engine runs. Moved here from
 * scripts/lib/zzfx-music.ts (1.60.0) so shells can compose songs at runtime;
 * that path remains as a re-export shim.
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
import { zzfxR, type ZzfxSong, type ZzfxInstrument } from './zzfxm.ts';

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
  piano:   [0.4, 0, C4, 0.002, 0.06, 0.55, 3, 1],   // tan-wave, quick attack, natural-ish decay

  pluck:   [0.45, 0, C4, 0.005, 0.05, 0.5, 2, 1],
  bass:    [0.6, 0, C2, 0.03, 0.15, 0.9, 0],
  sub:     [0.68, 0, C2, 0.05, 0.2, 1.1, 0],
  // ── drums (struck at note 12; adapted from ZzFXM's table, softened) ────
  kick:    [0.9, 0, 84, 0, 0, 0.1, 0, 0.7, 0, 0, 0, 0.5, 0, 6.7, 1, 0.05],
  snare:   [0.7, 0, 655, 0, 0, 0.09, 3, 1.65, 0, 0, 0, 0, 0.02, 3.8, -0.1, 0, 0.2],
  hat:     [0.5, 0, 4000, 0, 0, 0.03, 2, 1.25, 0, 0, 0, 0, 0.02, 6.8, -0.3, 0, 0.5],
  openhat: [0.45, 0, 2100, 0, 0, 0.1, 3, 3, 0, 0, -400, 0, 0, 2],
  clap:    [0.55, 0, 220, 0, 0, 0.1, 3, 0, 0, 0, 320, 0, 0, 4],

  // ── more tonal voices (C4 / C2 based) — drumAndBass/jungle/classical/
  // spanishGuitar/cuban/bossaNova/whimsical/chiptune/lofi ─────────────────
  nylonGuitar:  [0.46, 0, C4, 0.006, 0.07, 0.55, 1, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.55], // warm plucked nylon/classical guitar
  harpsichord:  [0.38, 0, C4, 0.002, 0.02, 0.35, 2, 1.6, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0.35], // bright quick-decay pluck, slight metallic crush
  strings:      [0.4, 0, C4, 0.4, 0.3, 2.0, 1, 1, 0, 0, 0, 0, 0, 0, 0.02, 0, 0, 0.6], // slow-attack orchestral pad, gentle shimmer
  reese:        [0.6, 0, C2, 0.02, 0.15, 0.9, 2, 1, -4, 0.15, 0, 0, 0, 0, 0, 0, 0, 0.55], // deep moving sub — slide+deltaSlide give the wobble
  square:       [0.35, 0, C4, 0.003, 0.05, 0.12, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5], // chiptune square wave (shape 5, 50% duty)
  pulse:        [0.32, 0, C4, 0.003, 0.04, 0.1, 5, 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5], // chiptune pulse wave (narrower duty — brighter/buzzier)
  glockenspiel: [0.42, 0, C4, 0.002, 0.02, 1.0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.3], // music-box bell: pluck, taper, long ring (uses `decay`)
  epiano:       [0.38, 0, C4, 0.015, 0.12, 0.8, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4], // warm lo-fi electric-piano-ish keys

  // ── more drums (struck at note 12; softened in the same spirit as above) ─
  conga:       [0.55, 0, 300, 0.001, 0.02, 0.15, 1, 1.5, 0, 0, -200, 0.02, 0, 0, 0, 0, 0, 0.4],
  bongo:       [0.5, 0, 450, 0.001, 0.015, 0.1, 1, 1.5, 0, 0, -250, 0.015, 0, 0, 0, 0, 0, 0.4],
  claves:      [0.5, 0, 2500, 0, 0.008, 0.05, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3],
  shaker:      [0.35, 0, 6000, 0, 0, 0.04, 2, 1.2, 0, 0, 0, 0, 0.015, 5, -0.2, 0, 0.3],
  ride:        [0.4, 0, 5000, 0, 0, 0.5, 2, 1.5, 0, 0, 0, 0, 0.03, 4, -0.15, 0, 0.4],
  breakKick:   [0.85, 0, 100, 0, 0, 0.07, 0, 0.8, 0, 0, 0, 0.35, 0, 5, 1.2, 0.08], // punchier/tighter than `kick` — breakbeat
  breakSnare:  [0.65, 0, 700, 0, 0, 0.065, 3, 1.8, 0, 0, 0, 0, 0.015, 4.5, -0.15, 0, 0.15], // snappier/tighter than `snare` — breakbeat
  brushSnare:  [0.4, 0, 500, 0, 0.015, 0.16, 3, 1.4, 0, 0, 0, 0, 0.03, 2.5, -0.05, 0, 0.1], // soft brushed snare/rim (bossa/lo-fi)
} satisfies Record<string, ZzfxInstrument>;
export type PresetName = keyof typeof PRESETS;

/** Pentatonic note pools (note numbers, low→high, ~1.5 octaves). No dissonance. */
export const SCALES = {
  majorPent: [12, 14, 16, 19, 21, 24, 26, 28], // C D E G A …
  minorPent: [12, 15, 17, 19, 22, 24, 27, 29], // C Eb F G Bb …
  suspended: [12, 14, 17, 19, 22, 24, 26, 29], // C D F G Bb … airy/open

  // ── fuller/flavored scales for the new genre families ───────────────────
  phrygianDominant: [12, 13, 16, 17, 19, 20, 22, 24, 25, 28], // C Db E F G Ab Bb … Spanish/flamenco flavor
  majorScale:       [12, 14, 16, 17, 19, 21, 23, 24, 26, 28, 29], // C D E F G A B … full diatonic major, for classical
  harmonicMinor:    [12, 14, 15, 17, 19, 20, 23, 24, 26, 27, 29], // C D Eb F G Ab B … classical/spanish color
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
/** Even subdivisions 0, n, 2n, … (e.g. n=1 → every 16th, n=2 → eighths). */
function everyN(n: number): number[] {
  const a: number[] = [];
  for (let s = 0; s < STEPS; s += n) a.push(s);
  return a;
}
/**
 * Syncopated breakbeat kick+snare placement (drumAndBass/jungle) — deliberately
 * NOT four-on-the-floor. `ghostProb` sprinkles quiet extra snare hits at
 * off-grid candidate steps for a denser/choppier feel (jungle uses a higher
 * value than drumAndBass).
 */
function breakbeat(rng: () => number, ghostProb = 0): { kick: number[]; snare: number[] } {
  const kickSteps = [0, 6, 10];
  const snareSteps = [4, 12];
  for (const s of [2, 7, 9, 14]) if (rng() < ghostProb) snareSteps.push(s);
  return { kick: hits(kickSteps), snare: hits(snareSteps) };
}
/** Son-clave (3-2), 16 steps — the backbone rhythm for cuban/bossa patterns. */
function clave(): number[] {
  return hits([0, 3, 6, 10, 12]);
}
/** Fast broken-chord arpeggio: cycles `intervals` (semitones from root) every `stepEvery` steps — NES-style chiptune arpeggio. */
function arpeggio(root: number, intervals: number[], stepEvery = 2): number[] {
  const a = new Array<number>(STEPS).fill(R);
  for (let s = 0; s < STEPS; s += stepEvery) a[s] = root + intervals[(s / stepEvery) % intervals.length]!;
  return a;
}

export type Archetype =
  | 'ambient'
  | 'rhythmic'
  | 'melodic'
  | 'drumAndBass'
  | 'jungle'
  | 'classical'
  | 'spanishGuitar'
  | 'cuban'
  | 'bossaNova'
  | 'whimsical'
  | 'chiptune'
  | 'lofi';

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
 * Compose a ZzFXM song in one of several shapes for variety:
 *  - ambient      : warm pad + a soothing swell + sparse melody + sub — no drums, slow.
 *  - rhythmic     : kick/snare/hats + a bass groove + a chord stab — beat-driven.
 *  - melodic      : lead melody + pad + bass + light offbeat hats.
 *  - drumAndBass  : syncopated breakbeat + fast hats + a moving sub + a sparse dark pad.
 *  - jungle       : denser/choppier breakbeat + ghost hits + sub + echo-y sparse lead.
 *  - classical    : arpeggiated harpsichord + strings pad + a call-and-response voice — no drums.
 *  - spanishGuitar: arpeggiated nylon guitar + occasional chord stab — no drums.
 *  - cuban        : son-clave + conga/bongo tumbao + piano-montuno stabs.
 *  - bossaNova    : nylon guitar comping + brushed snare/rim + light shaker.
 *  - whimsical    : playful skipping glockenspiel melody with irregular rests + light bass.
 *  - chiptune     : fast NES-style square/pulse arpeggio + a blippy drum pattern.
 *  - lofi         : laid-back swung/shuffled beat + warm e-piano pad + mellow bass.
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
  } else if (spec.archetype === 'melodic') {
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
  } else if (spec.archetype === 'drumAndBass') {
    instruments = [PRESETS.breakKick, PRESETS.breakSnare, PRESETS.hat, PRESETS[spec.bass ?? 'reese'], PRESETS[spec.lead ?? 'pad']];
    const restProb = spec.restProb ?? 0.15;
    for (const root of spec.roots) {
      const brk = breakbeat(rng, 0.2);
      patterns.push([
        channel(0, 0, brk.kick), // breakbeat kick — syncopated, not four-on-the-floor
        channel(1, 0, brk.snare), // breakbeat snare + occasional ghost hits
        channel(2, 0, hits(everyN(1))), // fast 16th-note hats
        channel(3, 0, walk(rng, scale, root, restProb)), // moving sub/reese bass line
        channel(4, pan, placed([[0, root]])), // sparse dark stab/pad
      ]);
    }
  } else if (spec.archetype === 'jungle') {
    instruments = [PRESETS.breakKick, PRESETS.breakSnare, PRESETS.hat, PRESETS[spec.bass ?? 'sub'], PRESETS[spec.lead ?? 'glockenspiel']];
    const restProb = spec.restProb ?? 0.5;
    for (const root of spec.roots) {
      const brk = breakbeat(rng, 0.45); // denser/choppier than drumAndBass — more ghost hits
      patterns.push([
        channel(0, 0, brk.kick),
        channel(1, 0, brk.snare),
        channel(2, 0, hits(everyN(1))), // fast hats
        channel(3, 0, placed([[0, root], [10, root]])), // sub bass, half-time anchor
        channel(4, pan, walk(rng, scale, root, restProb)), // echo-y sparse ragga stab/bell lead
      ]);
    }
  } else if (spec.archetype === 'classical') {
    instruments = [PRESETS[spec.lead ?? 'harpsichord'], PRESETS.strings, PRESETS.piano];
    const restProb = spec.restProb ?? 0.2; // flowing — fewer rests than ambient
    for (const root of spec.roots) {
      patterns.push([
        channel(0, 0, placed([[0, root], [2, root + 4], [4, root + 7], [6, root + 4], [8, root], [10, root + 4], [12, root + 7], [14, root + 4]])), // arpeggiated harpsichord
        channel(1, 0, placed([[0, root], [8, root + 7]])), // strings pad, sustained
        channel(2, pan, walk(rng, scale, root, restProb)), // answering phrase — call-and-response
      ]);
    }
  } else if (spec.archetype === 'spanishGuitar') {
    instruments = [PRESETS[spec.lead ?? 'nylonGuitar'], PRESETS.clap, PRESETS.sub];
    const restProb = spec.restProb ?? 0.35;
    for (const root of spec.roots) {
      patterns.push([
        channel(0, pan, walk(rng, scale, root, restProb)), // passionate arpeggiated lead
        channel(0, 0, placed([[0, root], [8, root + 7]])), // occasional chord stab (root + fifth)
        channel(1, 0, hits([6, 14])), // light hand-clap accent, off-beat
        channel(2, 0, placed([[0, root]])), // grounding low root
      ]);
    }
  } else if (spec.archetype === 'cuban') {
    instruments = [PRESETS.claves, PRESETS.conga, PRESETS.bongo, PRESETS[spec.lead ?? 'piano'], PRESETS[spec.bass ?? 'bass']];
    for (const root of spec.roots) {
      patterns.push([
        channel(0, 0, clave()), // son-clave (3-2)
        channel(1, 0, hits([2, 6, 9, 13])), // conga tumbao
        channel(2, 0, hits([0, 4, 8, 11])), // bongo accents
        channel(3, pan, placed([[2, root], [6, root + 4], [9, root + 7], [13, root + 4]])), // piano-montuno stabs
        channel(4, 0, placed([[0, root], [8, root]])), // walking bass anchor
      ]);
    }
  } else if (spec.archetype === 'bossaNova') {
    instruments = [PRESETS[spec.lead ?? 'nylonGuitar'], PRESETS.brushSnare, PRESETS.shaker, PRESETS.bass];
    for (const root of spec.roots) {
      patterns.push([
        channel(0, pan, placed([[0, root], [3, root + 4], [6, root + 7], [10, root + 4], [12, root], [14, root + 7]])), // bossa comping pattern
        channel(1, 0, hits([4, 12])), // soft brushed snare/rim, off-beats
        channel(2, 0, hits(everyN(2))), // light shaker, eighths
        channel(3, 0, placed([[0, root], [8, root + 7]])), // relaxed bass
      ]);
    }
  } else if (spec.archetype === 'whimsical') {
    instruments = [PRESETS[spec.lead ?? 'glockenspiel'], PRESETS.pluck, PRESETS.hat];
    for (const root of spec.roots) {
      const restProb = (spec.restProb ?? 0.3) + rng() * 0.25; // varies bar to bar — avoids a strict predictable feel
      patterns.push([
        channel(0, pan, walk(rng, scale, root, restProb)), // playful skipping melody
        channel(1, 0, placed([[0, root], [7, root + 3], [11, root]])), // light plucky bass
        channel(2, 0, hits([3, 9])), // sparse curious tick
      ]);
    }
  } else if (spec.archetype === 'chiptune') {
    instruments = [PRESETS[spec.lead ?? 'square'], PRESETS.pulse, PRESETS.breakKick, PRESETS.hat];
    for (const root of spec.roots) {
      patterns.push([
        channel(0, pan, arpeggio(root, [0, 4, 7, 12], 1)), // fast NES-style broken-chord arpeggio
        channel(1, 0, placed([[0, root], [8, root + 7]])), // pulse-wave harmony stabs
        channel(2, 0, hits([0, 4, 8, 12])), // blippy 8-bit kick
        channel(3, 0, hits(everyN(2))), // simple hats
      ]);
    }
  } else {
    // lofi
    instruments = [PRESETS.breakKick, PRESETS.brushSnare, PRESETS.shaker, PRESETS[spec.lead ?? 'epiano'], PRESETS[spec.bass ?? 'bass']];
    for (const root of spec.roots) {
      patterns.push([
        channel(0, 0, hits([0, 10])), // laid-back kick
        channel(1, 0, hits([3, 7, 11, 15])), // swung/shuffled snare — off the straight grid
        channel(2, 0, hits(everyN(2))), // soft shaker, eighths
        channel(3, pan, placed([[0, root], [8, root + 7]])), // warm filtered e-piano pad
        channel(4, 0, placed([[0, root], [10, root]])), // mellow jazzy bass
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
