// SPDX-License-Identifier: MPL-2.0
/**
 * Lofi composition: the seeded, endless stream of bars behind the Neurospicy player's
 * Lofi station. Pure and deterministic (no Web Audio, no DOM, no Date, no Math.random;
 * the PRNG is seeded), so one seed gives the same music in the live player, in an
 * offline render for a video music bed, and in any shell that can play notes.
 *
 * It writes NOTES, not sound: each bar is a list of { voice, beat, dur, midi, vel }
 * events for the shell's instruments (shells/web/src/lib/lofi-voices.ts) to play.
 * Swing, laid-back timing and velocity variation are already in the beats and
 * velocities here, so a render never needs its own randomness to sound human.
 *
 * A tune is one key, tempo and pair of four-bar progressions, arranged as intro,
 * verse, bridge, break, verse and outro (about two to three minutes). When it ends the
 * stream rests for a bar and starts the next tune, whose seed follows from this one,
 * so a station never runs out and never repeats a tune it has just played.
 *
 * The harmony is the jazz-derived vocabulary lofi leans on: major and minor ninths,
 * dominant thirteenths and altered dominants, voiced without the root (the bass has
 * it) and voice-led so each chord moves as little as possible from the last. Melodies
 * are a two-bar motif and its answer, drawn from the key's pentatonic scale and
 * pulled onto a chord tone on the strong beats, so the lead never fights the keys.
 * No voices: nothing here sings or speaks.
 */
import { mulberry32 } from './zzfx-compose.ts';

export type LofiMood = 'warm' | 'lateNight' | 'rainy';
export const LOFI_MOODS: readonly LofiMood[] = ['warm', 'lateNight', 'rainy'];

export type LofiVoice = 'keys' | 'bass' | 'lead' | 'kick' | 'snare' | 'rim' | 'hat' | 'openHat';
export const LOFI_DRUM_VOICES: readonly LofiVoice[] = ['kick', 'snare', 'rim', 'hat', 'openHat'];

export interface LofiNote {
  voice: LofiVoice;
  /** Start, in beats from the start of the bar (swing and feel already applied). */
  beat: number;
  /** Length in beats (drums: 0, they ring their own length). */
  dur: number;
  /** MIDI note number (drums: 0). */
  midi: number;
  /** Velocity, 0 to 1. */
  vel: number;
}

export type LofiSection = 'intro' | 'verse' | 'bridge' | 'break' | 'outro' | 'rest';

export interface LofiTuneInfo {
  seed: number;
  mood: LofiMood;
  bpm: number;
  /** 0.5 is straight; lofi sits around 0.56 to 0.62 on the sixteenths. */
  swing: number;
  /** "E♭ minor". */
  key: string;
  /** Chord names of the two progressions, e.g. ["Cm9", "Fm9", …]. */
  progressions: [string[], string[]];
  /** Bars in the tune, the rest bar after it included. */
  bars: number;
}

export interface LofiBar {
  tune: LofiTuneInfo;
  /** 0-based bar within the tune. */
  index: number;
  section: LofiSection;
  /** The chord this bar sits on, e.g. "Fm9" (empty for the rest bar). */
  chord: string;
  notes: LofiNote[];
  /** How open the tone filter is, 0 (muffled) to 1 (open): intros and outros close the filter. */
  open: number;
  /** Overall level, 0 to 1: the outro fades. */
  level: number;
}

export interface LofiStream {
  /** The next bar. Endless: after a tune ends the next one begins. */
  next(): LofiBar;
}

// ── harmony ───────────────────────────────────────────────────────────────

/** Chord qualities as semitones from the root, root first. */
const QUALITIES = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  dom9: [0, 4, 7, 10, 14],
  dom13: [0, 4, 10, 14, 21],
  sus: [0, 5, 7, 10, 14],
  b9: [0, 4, 7, 10, 13],
  s9: [0, 4, 7, 10, 15],
  m7b5: [0, 3, 6, 10],
} as const;
type Quality = keyof typeof QUALITIES;
const SUFFIX: Record<Quality, string> = {
  maj7: 'maj7', maj9: 'maj9', m7: 'm7', m9: 'm9', m11: 'm11', dom9: '9', dom13: '13',
  sus: '9sus4', b9: '7♭9', s9: '7♯9', m7b5: 'm7♭5',
};
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** A chord in a progression: [semitones above the key's tonic, quality]. */
type Step = readonly [number, Quality];

/** Four-bar progressions. Major ones for warm; minor (aeolian and dorian) for the others. */
const MAJOR: readonly (readonly Step[])[] = [
  [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, 'dom13']],     // I vi ii V
  [[2, 'm9'], [7, 'dom13'], [0, 'maj9'], [0, 'maj7']],    // ii V I I
  [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],      // IV iii ii I
  [[0, 'maj7'], [5, 'maj9'], [4, 'm7'], [9, 'm9']],      // I IV iii vi
  [[5, 'maj9'], [7, 'sus'], [4, 'm7'], [9, 'm9']],       // IV V iii vi
  [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [7, 'sus']],     // I iii IV V
];
const MINOR: readonly (readonly Step[])[] = [
  [[0, 'm9'], [5, 'm9'], [10, 'dom9'], [3, 'maj9']],     // i iv VII III
  [[0, 'm9'], [8, 'maj9'], [2, 'm7b5'], [7, 'b9']],      // i VI ii° V
  [[5, 'm9'], [0, 'm9'], [8, 'maj9'], [7, 's9']],        // iv i VI V
  [[0, 'm9'], [5, 'dom9'], [0, 'm11'], [5, 'dom9']],     // dorian i IV
  [[8, 'maj9'], [7, 'b9'], [0, 'm9'], [0, 'm11']],       // VI V i i
  [[0, 'm11'], [3, 'maj9'], [8, 'maj9'], [7, 'sus']],    // i III VI V
];
const PENTA_MAJOR = [0, 2, 4, 7, 9];
const PENTA_MINOR = [0, 3, 5, 7, 10];

/** Tempo, swing and register per mood. */
const MOOD: Record<LofiMood, { minor: boolean; bpm: [number, number]; swing: [number, number]; snare: 'snare' | 'rim'; busy: number }> = {
  warm: { minor: false, bpm: [76, 88], swing: [0.56, 0.6], snare: 'snare', busy: 0.6 },
  lateNight: { minor: true, bpm: [66, 76], swing: [0.58, 0.62], snare: 'snare', busy: 0.4 },
  rainy: { minor: true, bpm: [68, 80], swing: [0.57, 0.61], snare: 'rim', busy: 0.45 },
};

interface Chord { root: number; quality: Quality; name: string; tones: number[] }

function chordOf(key: number, [degree, quality]: Step): Chord {
  const root = (key + degree) % 12;
  return { root, quality, name: NAMES[root] + SUFFIX[quality], tones: QUALITIES[quality].map(i => (root + i) % 12) };
}

/** The keys' voicing: up to four chord tones without the root, guide tones first. */
function voicingClasses(c: Chord): number[] {
  const iv = QUALITIES[c.quality];
  // Order by importance: third, seventh, then the colour tones, then the fifth.
  const rank = (i: number): number => ([3, 4].includes(i % 12) ? 0 : [10, 11].includes(i) ? 1 : i > 12 ? 2 : i === 5 || i === 6 ? 2 : 3);
  const picked = iv.slice(1).sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  return picked.map(i => (c.root + i) % 12);
}

const KEYS_LO = 52;
const KEYS_HI = 76;

/** Place pitch classes as a close voicing near `prev` (voice leading), within the keys' range. */
function voiceLead(classes: number[], prev: number[] | null): number[] {
  const sorted = [...classes].sort((a, b) => a - b);
  let best: number[] = [];
  let bestCost = Infinity;
  for (let rot = 0; rot < sorted.length; rot++) {
    const order = [...sorted.slice(rot), ...sorted.slice(0, rot)];
    for (let base = KEYS_LO - 12; base <= KEYS_HI; base += 12) {
      const v: number[] = [];
      let last = -Infinity;
      for (const pc of order) {
        let p = base + pc;
        while (p <= last) p += 12;
        v.push(p);
        last = p;
      }
      if (v[0]! < KEYS_LO || v[v.length - 1]! > KEYS_HI) continue;
      const centre = v.reduce((s, p) => s + p, 0) / v.length;
      const cost = prev
        ? v.reduce((s, p, i) => s + Math.abs(p - (prev[Math.min(i, prev.length - 1)] ?? p)), 0) + Math.abs(centre - 64) * 0.15
        : Math.abs(centre - 63);
      if (cost < bestCost) { bestCost = cost; best = v; }
    }
  }
  return best;
}

// ── rhythm ────────────────────────────────────────────────────────────────

/** [step, length in steps] hits for the keys, per bar. */
const COMPING: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 15]],                       // hold the bar
  [[0, 9], [10, 6]],               // and again on the and of three
  [[0, 7], [8, 7]],                // twice
  [[0, 5], [6, 4], [12, 4]],       // a lilting three
  [[0, 3], [3, 7], [14, 2]],       // pushed
];
const KICKS: readonly (readonly number[])[] = [[0, 10], [0, 7, 10], [0, 3, 10], [0, 8, 10], [0, 10, 11]];

export interface LofiOptions {
  /** The first tune's mood, which later tunes keep. */
  mood: LofiMood;
}

/** Sixteenth `step` of a bar as a beat, with swing on the off-sixteenths. */
function stepBeat(step: number, swing: number): number {
  const beat = step / 4;
  return step % 2 === 1 ? beat + (swing - 0.5) * 0.5 : beat;
}

/** The next tune's seed: a fixed scramble of this one, so a station's run of tunes is reproducible. */
export function nextLofiSeed(seed: number): number {
  return Math.floor(mulberry32(seed ^ 0x9e3779b9)() * 4294967296) >>> 0;
}

/** Build one tune's bars. */
export function composeLofiTune(seed: number, mood: LofiMood): LofiBar[] {
  const rng = mulberry32(seed >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length)] as T;
  const range = ([lo, hi]: [number, number]): number => lo + rng() * (hi - lo);
  const chance = (p: number): boolean => rng() < p;
  const m = MOOD[mood];

  const key = Math.floor(rng() * 12);
  const bpm = Math.round(range(m.bpm));
  const swing = Math.round(range(m.swing) * 100) / 100;
  const pool = m.minor ? MINOR : MAJOR;
  const progA = pick(pool);
  let progB = pick(pool);
  for (let tries = 0; progB === progA && tries < 4; tries++) progB = pick(pool);
  const chordsA = progA.map(s => chordOf(key, s));
  const chordsB = progB.map(s => chordOf(key, s));
  const penta = (m.minor ? PENTA_MINOR : PENTA_MAJOR).map(i => (key + i) % 12);

  // The arrangement: [section, bars, progression]. Verses are 8 or 16 bars.
  const verse = chance(0.35) ? 16 : 8;
  const plan: Array<[LofiSection, number, Chord[]]> = [
    ['intro', 4, chordsA], ['verse', verse, chordsA], ['bridge', 8, chordsB],
    ['break', 4, chordsA], ['verse', 8, chordsA], ['outro', 4, chordsA], ['rest', 1, chordsA],
  ];
  const total = plan.reduce((s, [, n]) => s + n, 0);
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood, bpm, swing,
    key: `${NAMES[key]} ${m.minor ? 'minor' : 'major'}`,
    progressions: [chordsA.map(c => c.name), chordsB.map(c => c.name)],
    bars: total,
  };

  // Per-tune grooves, kept for a few bars at a time so the parts settle in.
  const kick = pick(KICKS);
  const motifs = [motif(rng, m.busy), motif(rng, m.busy)];
  let comp = pick(COMPING);
  let prevVoicing: number[] | null = null;
  let prevLead = 72;

  const bars: LofiBar[] = [];
  let index = 0;
  for (const [section, count, chords] of plan) {
    for (let i = 0; i < count; i++, index++) {
      const chord = chords[i % chords.length]!;
      const nextChord = chords[(i + 1) % chords.length]!;
      const notes: LofiNote[] = [];
      const phraseEnd = i % 8 === 7 || i === count - 1;
      if (i % 4 === 0 && chance(0.5)) comp = pick(COMPING);

      // Section switches.
      const keysOn = section !== 'rest';
      const bassOn = section === 'verse' || section === 'bridge' || (section === 'intro' && i >= 2) || (section === 'break' && i >= 2) || (section === 'outro' && i < 3);
      const drumsOn = section === 'verse' || section === 'bridge' || (section === 'outro' && i < 2);
      const leadOn = (section === 'verse' && i >= Math.min(4, count / 2)) || section === 'bridge' || (section === 'break' && i % 2 === 1);
      const level = section === 'outro' ? 1 - (i + 1) * 0.17 : section === 'rest' ? 0 : 1;
      const open = section === 'intro' ? 0.35 + i * 0.15 : section === 'break' ? 0.55 : section === 'outro' ? 0.8 - i * 0.18 : section === 'rest' ? 0.3 : 1;

      if (keysOn) {
        const voicing = voiceLead(voicingClasses(chord), prevVoicing);
        prevVoicing = voicing;
        const hits = section === 'intro' || section === 'outro' ? [[0, 15] as const] : comp;
        for (const [step, len] of hits) {
          const roll = 0.012 + rng() * 0.02;   // fingers never land together
          voicing.forEach((p, n) => {
            notes.push({
              voice: 'keys', midi: p, beat: stepBeat(step, swing) + n * roll,
              dur: len / 4, vel: clamp01((step === 0 ? 0.62 : 0.5) + (n === voicing.length - 1 ? 0.06 : 0) + (rng() - 0.5) * 0.1),
            });
          });
        }
      }

      if (bassOn) {
        const root = placeIn(chord.root, 36, 47);
        const fifth = root + 7 <= 50 ? root + 7 : root - 5;
        const walk = chance(0.5);
        notes.push({ voice: 'bass', midi: root, beat: 0, dur: walk ? 0.75 : 1.6, vel: 0.82 });
        if (walk) notes.push({ voice: 'bass', midi: chance(0.5) ? root : root + 12 <= 52 ? root + 12 : root, beat: stepBeat(3, swing), dur: 0.6, vel: 0.62 });
        notes.push({ voice: 'bass', midi: chance(0.6) ? root : fifth, beat: stepBeat(10, swing), dur: 0.9, vel: 0.7 });
        if (nextChord.root !== chord.root && chance(0.45)) {
          const target = placeIn(nextChord.root, 36, 47);
          notes.push({ voice: 'bass', midi: target + (chance(0.5) ? 1 : -1), beat: stepBeat(14, swing), dur: 0.4, vel: 0.6 });
        }
      }

      if (leadOn) {
        const mo = motifs[section === 'bridge' ? 1 : 0]!;
        const answer = i % 2 === 1;
        const bar = mo[i % 2]!;
        for (let n = 0; n < bar.length; n++) {
          const { step, move, len } = bar[n]!;
          let pitch = stepScale(prevLead, answer && n === bar.length - 1 ? -Math.abs(move) : move, penta);
          if (step % 8 === 0 || n === bar.length - 1) pitch = nearestTone(pitch, chord.tones);   // strong beats sit on the chord
          pitch = Math.max(64, Math.min(84, pitch));
          prevLead = pitch;
          notes.push({ voice: 'lead', midi: pitch, beat: stepBeat(step, swing) + (rng() - 0.5) * 0.02, dur: len / 4, vel: clamp01(0.5 + (rng() - 0.5) * 0.14) });
        }
      }

      if (drumsOn) {
        const outroThin = section === 'outro';
        for (const s of kick) notes.push({ voice: 'kick', midi: 0, dur: 0, beat: stepBeat(s, swing), vel: s === 0 ? 0.9 : 0.74 });
        if (!outroThin) {
          for (const s of [4, 12]) notes.push({ voice: m.snare, midi: 0, dur: 0, beat: s / 4 + 0.02 + rng() * 0.012, vel: 0.78 + (rng() - 0.5) * 0.08 });   // laid back
          for (const s of [7, 9, 15]) if (chance(0.16)) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: stepBeat(s, swing), vel: 0.22 });   // ghosts
        }
        const open = !outroThin && i % 4 === 3 && chance(0.6);
        for (let s = 0; s < 16; s += 2) {
          if (open && s === 14) { notes.push({ voice: 'openHat', midi: 0, dur: 0, beat: stepBeat(s, swing), vel: 0.42 }); continue; }
          notes.push({ voice: 'hat', midi: 0, dur: 0, beat: stepBeat(s, swing) + (rng() - 0.5) * 0.015, vel: clamp01((s % 4 === 2 ? 0.46 : 0.34) + (rng() - 0.5) * 0.1) });
          if (chance(0.1 * m.busy)) notes.push({ voice: 'hat', midi: 0, dur: 0, beat: stepBeat(s + 1, swing), vel: 0.2 });
        }
        if (phraseEnd && !outroThin) {   // a small fill to turn the phrase
          if (chance(0.5)) notes.push({ voice: 'kick', midi: 0, dur: 0, beat: stepBeat(13, swing), vel: 0.6 });
          notes.push({ voice: 'snare', midi: 0, dur: 0, beat: stepBeat(15, swing), vel: 0.35 });
        }
      }

      notes.sort((a, b) => a.beat - b.beat);
      bars.push({ tune: info, index, section, chord: section === 'rest' ? '' : chord.name, notes, open, level });
    }
  }
  return bars;
}

/** An endless stream of bars from `seed`: one tune after another. */
export function lofiStream(seed: number, opts: LofiOptions): LofiStream {
  let tuneSeed = seed >>> 0;
  let bars = composeLofiTune(tuneSeed, opts.mood);
  let at = 0;
  return {
    next(): LofiBar {
      if (at >= bars.length) {
        tuneSeed = nextLofiSeed(tuneSeed);
        bars = composeLofiTune(tuneSeed, opts.mood);
        at = 0;
      }
      return bars[at++]!;
    },
  };
}

// ── melody helpers ────────────────────────────────────────────────────────

interface MotifNote { step: number; move: number; len: number }

/** A two-bar rhythm and contour: a few notes on the eighths, the odd sixteenth, rests between. */
function motif(rng: () => number, busy: number): [MotifNote[], MotifNote[]] {
  const bar = (answer: boolean): MotifNote[] => {
    const count = 2 + Math.floor(rng() * (2 + busy * 3));
    const steps = new Set<number>();
    while (steps.size < count) {
      const s = Math.floor(rng() * 8) * 2 + (rng() < 0.15 ? 1 : 0);
      if (s < (answer ? 12 : 16)) steps.add(s);
    }
    const sorted = [...steps].sort((a, b) => a - b);
    return sorted.map((step, n) => ({
      step,
      move: [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)]!,
      len: Math.min(8, ((sorted[n + 1] ?? 16) - step)) * (n === sorted.length - 1 ? 1 : 0.9),
    }));
  };
  return [bar(false), bar(true)];
}

/** Move `steps` places along the scale (pitch classes) from `from`. */
function stepScale(from: number, steps: number, scale: number[]): number {
  let p = from;
  const dir = Math.sign(steps);
  for (let n = 0; n < Math.abs(steps); n++) {
    do p += dir; while (!scale.includes(((p % 12) + 12) % 12));
  }
  if (steps === 0 && !scale.includes(((p % 12) + 12) % 12)) return stepScale(from, 1, scale);
  return p;
}

/** The nearest pitch to `p` whose class is one of `tones`. */
function nearestTone(p: number, tones: number[]): number {
  for (let d = 0; d <= 6; d++) {
    for (const q of [p - d, p + d]) if (tones.includes(((q % 12) + 12) % 12)) return q;
  }
  return p;
}

/** A pitch class placed between lo and hi. */
function placeIn(pc: number, lo: number, hi: number): number {
  let p = lo + ((pc - lo) % 12 + 12) % 12;
  if (p > hi) p -= 12;
  return p;
}

function clamp01(v: number): number { return Math.max(0.05, Math.min(1, v)); }
