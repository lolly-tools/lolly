// SPDX-License-Identifier: MPL-2.0
/**
 * The club genres of the Lolly Sings family: breakbeat, funky house, UK garage and private
 * school piano (the deep, jazzy strand of amapiano). Their drums, chord stabs, basslines
 * and running orders, called by the composer (lofi-compose.ts composeDanceTune) so that
 * file holds only the hooks.
 *
 * - Breakbeat: a sampled drummer's break chopped and played back in a new order (the break
 *   engine, lofi-breaks.ts), a punchier kick under it in the drops, a rolling bass, short
 *   chord stabs and a 125 to 138 bpm feel.
 * - Funky house: four on the floor with claps on two and four, open hats on the offbeats,
 *   a shaker and Latin percussion, a filtered disco chord loop whose filter opens and closes
 *   through the drop, piano or organ stabs, a bouncing bass and vocal chops.
 * - UK garage: two-step, the kick on one and the "and" of three and never on three, the
 *   sixteenths shuffled and the hats swung harder still, rimshots between, house-organ
 *   stabs, chopped and pitched vocal hooks, a sub bass, and on some tunes a warping bass.
 * - Private school piano: amapiano at its most mellow, 108 to 113 bpm, the log drum low and
 *   soft, Rhodes and piano on jazz chords, a saxophone, soft shakers and percussion, and
 *   long builds.
 *
 * Every draw comes from a stream of the tune's own (clubPlan), so no other genre's tune moves.
 */
import type { DanceLean, DancePart, IntroStyle, LofiLayer, LofiNote, LofiSection, LofiStyle } from './lofi-compose.ts';
import { breakBar, breakPlan, type BreakPlan } from './lofi-breaks.ts';
import { BONGO_STROKES, CONGA_DRUM, CONGA_STROKES, TIMBAL_STROKES, type SalsaPercussion } from './lofi-salsa.ts';
import { mulberry32 } from './zzfx-compose.ts';

export type ClubMood = 'breakbeat' | 'funkyHouse' | 'ukGarage' | 'privateSchool';
export const CLUB_MOODS: readonly ClubMood[] = ['breakbeat', 'funkyHouse', 'ukGarage', 'privateSchool'];
export const isClubMood = (mood: string): mood is ClubMood => (CLUB_MOODS as readonly string[]).includes(mood);

/** A bass figure: [sixteenth, length in sixteenths, how it is played (the note's `mod`), semitones above the root]. */
type Figure = ReadonlyArray<readonly [number, number, number, number]>;
/** A rhythm of chord hits: [sixteenth, length in sixteenths]. */
type Rhythm = ReadonlyArray<readonly [number, number]>;
/** In a figure, the chord's own third and a step into the next chord's root (the composer's THIRD and APPROACH). */
const THIRD = 99;
const APPROACH = 98;

// ── the basslines ─────────────────────────────────────────────────────────────

/** Breakbeat's rolling bass: sixteenths rolling round the root, jumping the octave, stepping into the next chord. */
const BREAK_ROLLS: readonly Figure[] = [
  [[0, 3, 0, 0], [3, 1, 0, 0], [4, 2, 0, 12], [6, 2, 0, 0], [8, 3, 0, 0], [11, 1, 0, 7], [12, 2, 0, 0], [14, 2, 0, APPROACH]],
  [[0, 2, 0, 0], [2, 1, 0, 0], [3, 3, 0, 12], [6, 2, 0, 0], [10, 2, 0, 7], [12, 1, 0, 0], [13, 3, 0, 10]],
  [[0, 4, 0, 0], [4, 1, 0, 0], [5, 1, 0, 12], [6, 2, 0, 0], [8, 2, 0, 7], [10, 2, 0, 0], [13, 1, 0, 0], [14, 2, 0, 12]],
  [[0, 1, 0, 0], [1, 2, 0, 0], [3, 1, 0, 12], [4, 4, 0, 0], [10, 1, 0, 0], [11, 2, 0, 7], [13, 3, 0, 0]],
];
/** Funky house's bass: syncopated, bouncing off the octave, a disco player's line on a synth. */
const FUNKY_BASS: readonly Figure[] = [
  [[0, 1, 0, 0], [2, 1, 0, 12], [3, 1, 0, 0], [6, 1, 0, 0], [7, 1, 0, 12], [8, 1, 0, 0], [10, 1, 0, 10], [11, 1, 0, 0], [14, 2, 0, 12]],
  [[0, 2, 0, 0], [3, 1, 0, 0], [4, 1, 0, 12], [6, 1, 0, 0], [8, 2, 0, 7], [11, 1, 0, 0], [12, 1, 0, 12], [14, 1, 0, 10], [15, 1, 0, APPROACH]],
  [[0, 1, 0, 0], [1, 1, 0, 0], [3, 1, 0, 12], [6, 2, 0, 0], [9, 1, 0, 0], [10, 1, 0, 12], [12, 2, 0, 7], [14, 1, 0, THIRD]],
  [[2, 1, 0, 0], [3, 1, 0, 12], [6, 1, 0, 0], [7, 1, 0, 7], [10, 1, 0, 0], [11, 1, 0, 12], [13, 1, 0, 10], [14, 2, 0, 0]],
];
/** UK garage's sub: the root under the two-step kick and around it, a lift to the octave to turn the bar. */
const GARAGE_SUBS: readonly Figure[] = [
  [[0, 3, 0, 0], [3, 1, 0, 0], [6, 2, 0, 0], [10, 3, 0, 0], [13, 1, 0, 12], [14, 2, 0, 0]],
  [[0, 2, 0, 0], [3, 2, 0, 0], [7, 1, 0, 0], [10, 2, 0, 0], [12, 2, 0, 7], [14, 2, 0, APPROACH]],
  [[0, 4, 0, 0], [6, 1, 0, 0], [7, 2, 0, 12], [10, 4, 0, 0], [14, 2, 0, 10]],
  [[0, 2, 0, 0], [2, 1, 0, 12], [3, 3, 0, 0], [10, 2, 0, 0], [13, 3, 0, 7]],
];
/** The warp: long notes that wobble (`mod` is how many times its filter swings a beat) and slide (`mod` 8 or more slides in). */
const WARPS: readonly Figure[] = [
  [[0, 6, 2, 0], [6, 2, 0, 0], [10, 6, 3, 0]],
  [[0, 3, 0, 0], [3, 5, 10, 0], [10, 2, 0, 12], [12, 4, 2, 0]],
  [[0, 8, 2, 0], [10, 2, 0, 0], [12, 4, 4, 12]],
  [[0, 2, 0, 0], [3, 7, 9, 0], [10, 6, 2, 7]],
];
/** Private school's log drum: low, few and sliding (`mod` 2), the knock off the beat, rarely up the octave. */
const SOFT_LOGS: readonly Figure[] = [
  [[0, 4, 0, 0], [6, 2, 2, 0], [10, 4, 0, 7], [14, 2, 2, 0]],
  [[0, 3, 0, 0], [3, 3, 2, 0], [8, 4, 0, 0], [14, 2, 2, 7]],
  [[2, 3, 0, 0], [6, 2, 0, 0], [10, 3, 2, 7], [14, 2, 0, 0]],
  [[0, 6, 2, 0], [7, 2, 0, 0], [11, 5, 0, THIRD]],
  [[0, 2, 0, 0], [3, 3, 0, 0], [7, 2, 2, 12], [10, 6, 0, 0]],
];

/** A club genre's figures for one of its basses, or null to leave the bass its usual ones. */
export function clubFigures(mood: string, bass: LofiStyle['bass'], plan?: ClubPlan | null): readonly Figure[] | null {
  // Breakbeat's bass is one roll the tune keeps, looping as its break does.
  if (mood === 'breakbeat' && (bass === 'reese' || bass === 'electro')) return plan ? [BREAK_ROLLS[plan.roll]!] : BREAK_ROLLS;
  if (mood === 'funkyHouse' && (bass === 'synth' || bass === 'deep')) return FUNKY_BASS;
  if (mood === 'ukGarage' && bass === 'deep') return GARAGE_SUBS;
  if (bass === 'warp') return WARPS;
  if (mood === 'privateSchool' && bass === 'log') return SOFT_LOGS;
  return null;
}

// ── the drums ─────────────────────────────────────────────────────────────────

/** UK garage's two-step kicks, a bar each (sixteenths): never on three, the one and its answer pushed after. */
const TWO_STEPS: ReadonlyArray<readonly number[]> = [[0, 10], [0, 7, 10], [0, 3, 10], [0, 10, 13], [0, 6, 10], [0, 11], [0, 10, 14]];
/** UK garage's rimshots, between the kick and the snare. */
const GARAGE_RIMS: ReadonlyArray<readonly number[]> = [[3, 7, 11, 14], [2, 7, 9, 14], [3, 6, 11, 15], [7, 10, 13], [1, 6, 9, 14]];
/** Private school's rims around the soft backbeat. */
const SCHOOL_RIMS: ReadonlyArray<readonly number[]> = [[7, 14], [3, 11], [6, 14], [10, 15], [3, 7, 14]];
/** The older percussion kinds, by their place in the composer's LOFI_PERCUSSION. */
const SHAKER = 0, TAMBOURINE = 1, COWBELL = 3;
/** A conga stroke on one of the three drums (0 the quinto, 1 the conga, 2 the tumba), as salsa's section plays them (lofi-salsa.ts). */
const conga = (drum: number, stroke: keyof typeof CONGA_STROKES): number => drum * CONGA_DRUM + CONGA_STROKES[stroke];
/**
 * House congas, a bar each: the slap on the quinto answering the backbeat, the open tones of
 * the conga and the tumba pushed off the beat, a muffled stroke between. [sixteenth, stroke, strength].
 */
const HOUSE_CONGAS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[2, conga(1, 'open'), 0.55], [3, conga(1, 'muff'), 0.32], [6, conga(0, 'slap'), 0.6], [7, conga(1, 'open'), 0.45], [10, conga(2, 'open'), 0.6], [11, conga(2, 'open'), 0.5], [14, conga(0, 'slap'), 0.6]],
  [[0, conga(2, 'bass'), 0.45], [3, conga(1, 'open'), 0.5], [6, conga(0, 'slap'), 0.6], [8, conga(1, 'heel'), 0.3], [10, conga(1, 'open'), 0.5], [11, conga(2, 'open'), 0.5], [14, conga(0, 'slap'), 0.55], [15, conga(1, 'open'), 0.42]],
  [[2, conga(1, 'open'), 0.5], [4, conga(0, 'slap'), 0.58], [7, conga(1, 'open'), 0.42], [10, conga(2, 'open'), 0.55], [12, conga(0, 'slap'), 0.58], [14, conga(1, 'open'), 0.45]],
];
/** House bongos under the congas: eighths on the macho, fingertip and thumb, the hembra to turn the bar. */
const HOUSE_BONGOS: ReadonlyArray<readonly [number, number, number]> = [
  [0, BONGO_STROKES.finger, 0.45], [2, BONGO_STROKES.thumb, 0.3], [4, BONGO_STROKES.finger, 0.42], [6, BONGO_STROKES.thumb, 0.3],
  [8, BONGO_STROKES.finger, 0.45], [10, BONGO_STROKES.thumb, 0.3], [12, BONGO_STROKES.hembra, 0.55], [14, BONGO_STROKES.thumb, 0.34],
];

/** One tune's own draws for its club genre: the swing, the patterns it keeps, and a stream for the bars' small choices. */
export interface ClubPlan {
  mood: ClubMood;
  r: () => number;
  /** The sixteenths' swing, and the hats' (harder in UK garage). */
  swing: number;
  hatSwing: number;
  brk: BreakPlan | null;
  kicks: readonly [readonly number[], readonly number[]];
  rims: readonly [readonly number[], readonly number[]];
  stabs: readonly [Rhythm, Rhythm];
  congas: readonly [number, number];
  /** A percussion kind's place in the composer's list (its notes' `mod`). */
  perc: (kind: SalsaPercussion) => number;
  /** Funky house's bongos and its cowbell in the second half of a drop. */
  bongos: boolean;
  cowbell: boolean;
  /** Funky house's filter through a drop: how many bars it takes to close and open again, and how far it closes. */
  cycle: { period: number; low: number } | null;
  /** UK garage's programmed loop: which sixteenths the hats play, the ghost snares of its two bars, and an open hat to end every other bar. */
  hats: readonly boolean[];
  ghosts: readonly [readonly number[], readonly number[]];
  openHat: boolean;
  /** Breakbeat's rolling bass figure. */
  roll: number;
}

/** The chord hits each genre plays its keys on. */
const BREAK_STABS: readonly Rhythm[] = [[[0, 2], [3, 2], [10, 2]], [[0, 1], [6, 2], [10, 1], [13, 2]], [[2, 2], [7, 1], [10, 3]], [[0, 3], [8, 1], [11, 2], [14, 1]]];
const ORGAN_STABS: readonly Rhythm[] = [[[0, 1], [3, 1], [6, 2], [10, 1], [13, 1]], [[2, 1], [5, 1], [8, 2], [11, 1], [14, 1]], [[0, 2], [3, 1], [7, 1], [10, 2], [14, 1]], [[1, 1], [4, 1], [6, 1], [9, 2], [12, 1], [14, 1]]];
const DISCO_LOOPS: readonly Rhythm[] = [[[0, 3], [3, 3], [6, 2], [10, 2], [12, 4]], [[0, 2], [2, 2], [4, 2], [6, 1], [7, 1], [8, 2], [10, 2], [12, 2], [14, 2]], [[0, 6], [6, 2], [8, 2], [11, 3], [14, 2]], [[2, 2], [6, 2], [10, 2], [14, 2]]];
const SCHOOL_COMPS: readonly Rhythm[] = [[[0, 6], [6, 2], [10, 4], [14, 2]], [[0, 3], [3, 3], [6, 4], [10, 2], [12, 4]], [[0, 8], [10, 2], [12, 4]], [[0, 2], [3, 2], [6, 2], [8, 2], [11, 2], [14, 2]]];

/** A tune's club plan, drawn from its seed alone. */
export function clubPlan(mood: ClubMood, seed: number, perc: (kind: SalsaPercussion) => number): ClubPlan {
  const r = mulberry32((seed ^ 0xc1ab) >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
  const r2 = (v: number): number => Math.round(v * 100) / 100;
  const swing = mood === 'ukGarage' ? r2(0.57 + r() * 0.05) : mood === 'privateSchool' ? r2(0.54 + r() * 0.04) : mood === 'funkyHouse' ? r2(0.52 + r() * 0.04) : r2(0.5 + r() * 0.04);
  const hatSwing = mood === 'ukGarage' ? r2(Math.min(0.68, swing + 0.03 + r() * 0.03)) : swing;
  const stabsOf = mood === 'breakbeat' ? BREAK_STABS : mood === 'ukGarage' ? ORGAN_STABS : mood === 'funkyHouse' ? DISCO_LOOPS : SCHOOL_COMPS;
  // The two bars of kick: the second the first with a pickup added, or the same, as a programmed loop's are.
  const kickA = pick(TWO_STEPS);
  const pickup = pick([0, 7, 13, 14, 15].filter(s => !kickA.includes(s) && s !== 0).concat([-1]));
  const kickB = pickup < 0 ? kickA : [...kickA, pickup].sort((a, b) => a - b);
  const rimsOf = mood === 'privateSchool' ? SCHOOL_RIMS : GARAGE_RIMS;
  const rims = pick(rimsOf);
  return {
    mood, r, swing, hatSwing,
    brk: mood === 'breakbeat' ? breakPlan(r, 0.08 + r() * 0.08) : null,
    kicks: [kickA, kickB],
    rims: [rims, mood === 'privateSchool' ? pick(rimsOf) : rims],
    stabs: [pick(stabsOf), pick(stabsOf)],
    congas: [Math.floor(r() * HOUSE_CONGAS.length), Math.floor(r() * HOUSE_CONGAS.length)],
    perc,
    cycle: mood === 'funkyHouse' ? { period: pick([8, 16]), low: r2(0.5 + r() * 0.15) } : null,
    hats: Array.from({ length: 16 }, (_, s) => s % 4 === 2 || (s % 2 === 1 ? r() < 0.8 : r() < 0.55)),
    ghosts: ((g: number[]) => [g, g] as const)([7, 9, 15].filter(() => r() < 0.3)),
    openHat: r() < 0.6,
    roll: Math.floor(r() * BREAK_ROLLS.length),
    bongos: r() < 0.6,
    cowbell: r() < 0.4,
  };
}

/** Where a bar is in its tune, for the drums. */
export interface ClubBarAt {
  section: LofiSection;
  layers: readonly LofiLayer[];
  /** Bars into this part, the part's length, and bars into the section. */
  i: number; bars: number; inSection: number;
  lastOfBuild: boolean;
  dropStart: boolean;
}

/**
 * One bar of a club genre's drums. `sb` is a sixteenth as a beat at the tune's swing.
 * A build loses its kick, rolls its snare (or clap, or rim) into the drop under a riser and
 * leaves its last half beat empty; a drop opens on a crash.
 */
export function clubDrums(plan: ClubPlan, at: ClubBarAt, sb: (step: number) => number): LofiNote[] {
  const { section, layers, i, bars, inSection, lastOfBuild } = at;
  const r = plan.r;
  const has = (l: LofiLayer): boolean => layers.includes(l);
  const out: LofiNote[] = [];
  const build = section === 'build';
  const hit = (voice: LofiNote['voice'], beat: number, vel: number, mod?: number, midi = 0): void => {
    if (lastOfBuild && beat >= 3.5) return;
    out.push({ voice, midi, dur: 0, beat, vel: Math.max(0.05, Math.min(1, vel)), ...(mod === undefined ? {} : { mod }) });
  };
  // The hats' own swing: an odd sixteenth moved further behind than the tune's swing would place the note.
  const hb = (step: number): number => sb(step) + (step % 2 === 1 ? (plan.hatSwing - plan.swing) * 0.5 : 0);
  const quiet = section === 'intro' || section === 'outro';
  if (plan.mood === 'breakbeat' && plan.brk) {
    out.push(...breakBar(plan.brk, r, { section, inSection, bars, kick: has('kick'), snare: has('snare'), hats: has('hats'), lastOfBuild, level: quiet ? 0.85 : 1, sb }));
    // A punchier kick under the break's kicks in a drop: the weight a sampled break lacks.
    if (section === 'drop' && has('kick')) for (const n of out.filter(x => x.voice === 'kick' && x.vel > 0.6)) hit('kick', n.beat, n.vel * 0.6);
  } else if (plan.mood === 'ukGarage') {
    if (has('kick') && !build) for (const s of plan.kicks[inSection % 2]!) hit('kick', sb(s), s === 0 ? 0.95 : 0.85);
    // A programmed loop, as the records' are: two bars of kick, ghost snares and rimshots
    // that repeat, the hats the same every bar, and a fill to turn every eight bars.
    if (has('snare') && !build) {
      for (const s of [4, 12]) hit('snare', sb(s), 0.9);
      for (const s of plan.ghosts[inSection % 2]!) hit('snare', sb(s), 0.26 + r() * 0.04);
      for (const s of plan.rims[inSection % 2]!) hit('rim', sb(s), 0.44 + r() * 0.06);
      if (section === 'drop' && inSection % 8 === 7) for (const s of [13, 14, 15]) hit('snare', sb(s), 0.4 + (s - 13) * 0.12);
    }
    if (has('hats')) {
      const open = plan.openHat && section === 'drop' && inSection % 2 === 1;
      for (let s = 0; s < 16; s++) {
        if (!plan.hats[s]) continue;
        if (open && s === 14) { hit('openHat', hb(s), 0.45); continue; }
        if (s % 4 === 2) hit('hat', hb(s), quiet ? 0.36 : 0.5);
        else if (s % 2 === 1) { if (!quiet) hit('hat', hb(s), 0.24 + r() * 0.04, 1); }
        else hit('hat', hb(s), 0.26, 1);
      }
      if (!quiet) for (let s = 0; s < 16; s++) hit('perc', hb(s), s % 4 === 2 ? 0.34 : s % 2 ? 0.2 : 0.26, SHAKER);
    }
  } else if (plan.mood === 'funkyHouse') {
    if (has('kick') && !build) for (const s of [0, 4, 8, 12]) hit('kick', s / 4, section === 'drop' ? 0.95 : 0.85);
    if (has('snare') && !build) {
      for (const s of [4, 12]) hit('snare', s / 4, 0.88);
      if (r() < 0.4) hit('snare', sb(r() < 0.5 ? 14 : 15), 0.45);
    }
    if (has('hats')) {
      for (let s = 0; s < 16; s++) {
        if (s % 4 === 2) hit('openHat', sb(s), quiet ? 0.36 : 0.46);
        else if (s % 2 === 1 && !quiet) { if (r() < 0.85) hit('hat', sb(s), 0.22 + r() * 0.06, 1); }
        else if (s % 4 === 0 && !quiet) hit('hat', sb(s), 0.3);
      }
      if (!quiet) for (let s = 0; s < 16; s++) hit('perc', sb(s), s % 4 === 2 ? 0.36 : s % 2 ? 0.2 : 0.28, SHAKER);
      if (section === 'drop') for (const s of [2, 6, 10, 14]) hit('perc', sb(s), 0.32, TAMBOURINE);
      // The Latin section (salsa's congas, bongos and timbales, lib/lofi-latin-perc.ts): the
      // congas through the verse, the drop and the breakdown, bongos in some tunes' drops, a
      // cowbell in the second half of some, and the timbales filling into each eight bars.
      if (section === 'drop' || section === 'verse' || section === 'break') {
        for (const [s, midi, vel] of HOUSE_CONGAS[plan.congas[inSection % 2]!]!) hit('perc', sb(s), vel, plan.perc('congas'), midi);
        if (section === 'drop' && plan.bongos) for (const [s, stroke, vel] of HOUSE_BONGOS) hit('perc', sb(s), vel, plan.perc('bongos'), stroke);
        if (section === 'drop' && plan.cowbell && inSection >= 8) for (const s of [0, 6, 10]) hit('perc', sb(s), 0.36, COWBELL);
      }
      if (section === 'drop' && inSection % 8 === 7) {
        for (let n = 0; n < 6; n++) hit('perc', 3 + n / 8, 0.35 + n * 0.08, plan.perc('timbales'), TIMBAL_STROKES.roll);
      }
      if (at.dropStart) hit('perc', 0, 0.85, plan.perc('timbales'), TIMBAL_STROKES.rimshot);
    }
  } else {
    // Private school: everything soft. The kick on every beat but under the log drum, the
    // rims around a quiet backbeat, shakers swung through every section, congas in the drops.
    if (has('kick') && !build) for (const s of [0, 4, 8, 12]) hit('kick', s / 4, section === 'drop' ? 0.66 : 0.55);
    if (has('snare') && !build) {
      for (const s of [4, 12]) hit('rim', sb(s), 0.46);
      for (const s of plan.rims[inSection % 2]!) hit('rim', sb(s), 0.3 + r() * 0.05);
    }
    if (has('hats')) {
      for (let s = 0; s < 16; s++) hit('perc', sb(s), (s % 4 === 2 ? 0.34 : s % 2 ? 0.16 : 0.24) * (quiet ? 0.8 : 1), SHAKER);
      if (!quiet) for (const s of [2, 6, 10, 14]) hit('hat', sb(s), 0.22, 1);
      if (section === 'drop' || section === 'break') for (const [s, midi, vel] of HOUSE_CONGAS[plan.congas[inSection % 2]!]!) hit('perc', sb(s), vel * 0.6, plan.perc('congas'), midi);
    }
  }
  if (build && has('snare')) {
    // The roll: quarters, then eighths, then sixteenths, louder all the way (a rim's in private school).
    const left = bars - i;
    const every = left > bars / 2 ? 4 : left > 1 ? 2 : 1;
    const voice = plan.mood === 'privateSchool' ? 'rim' : 'snare';
    if (plan.mood !== 'breakbeat') for (let s = 0; s < 16; s += every) hit(voice, s / 4, 0.3 + ((i + s / 16) / bars) * (plan.mood === 'privateSchool' ? 0.3 : 0.55));
  }
  if (build && i === 0 && has('fx')) out.push({ voice: 'riser', midi: 60, dur: bars * 4 - 0.5, beat: 0, vel: plan.mood === 'privateSchool' ? 0.5 : 0.75 });
  if (at.dropStart && has('fx')) hit('crash', 0, plan.mood === 'privateSchool' ? 0.55 : 0.85);
  return out.sort((x, y) => x.beat - y.beat);
}

// ── the keys ─────────────────────────────────────────────────────────────────

/** The keys a genre stabs on its rhythm; any other (a pad held, a person's choice) plays as it would elsewhere. */
const STABBED: Record<ClubMood, ReadonlySet<LofiStyle['keys']>> = {
  breakbeat: new Set(['supersaw', 'brass', 'organ', 'pluck', 'houseOrgan']),
  funkyHouse: new Set(['brass', 'pad', 'organ', 'houseOrgan', 'rhodes', 'felt', 'supersaw', 'grand']),
  ukGarage: new Set(['houseOrgan', 'organ', 'rhodes', 'pluck', 'felt']),
  privateSchool: new Set(['rhodes', 'felt', 'wurli', 'organ', 'grand']),
};

/** Whether a genre stabs these keys in this section. */
export function clubStabs(plan: ClubPlan, keys: LofiStyle['keys'], section: LofiSection): boolean {
  if (!STABBED[plan.mood].has(keys)) return false;
  if (plan.mood === 'privateSchool') return section !== 'intro' && section !== 'outro';
  if (plan.mood === 'breakbeat') return section === 'drop';
  return section === 'drop' || section === 'verse' || section === 'build';
}

/** A bar of the keys on the tune's rhythm: each hit the chord cut short, its first leaned on; a build's last beat is a breath. */
export function clubKeys(plan: ClubPlan, at: { i: number; inSection: number; lastOfBuild: boolean }, voicing: readonly number[], sb: (step: number) => number, rnd: () => number): LofiNote[] {
  const pattern = plan.stabs[at.inSection % 2]!;
  const out: LofiNote[] = [];
  for (const [step, len] of pattern) {
    if (at.lastOfBuild && step >= 12) break;
    const vel = (step === pattern[0]![0] ? 0.6 : 0.5) + (rnd() - 0.5) * 0.06;
    for (const p of voicing) out.push({ voice: 'keys', midi: p, beat: sb(step), dur: len / 4 - 0.04, vel: Math.max(0.05, Math.min(1, vel)) });
  }
  return out;
}

// ── the running order ─────────────────────────────────────────────────────────

/** Each genre's verse and outro lengths (eight bars of outro at most: the composer fades an outro 0.11 a bar), and the layers of its build and breakdown. */
const SHAPES: Record<ClubMood, { verse: number; build: readonly LofiLayer[]; breakdown: readonly LofiLayer[]; outro: readonly [number, number] }> = {
  breakbeat: { verse: 8, build: ['keys', 'snare', 'hats', 'fx'], breakdown: ['keys', 'lead', 'fx'], outro: [4, 4] },
  funkyHouse: { verse: 8, build: ['keys', 'bass', 'snare', 'hats', 'fx'], breakdown: ['keys', 'lead', 'fx'], outro: [4, 4] },
  ukGarage: { verse: 16, build: ['keys', 'lead', 'snare', 'hats', 'fx'], breakdown: ['keys', 'bass', 'lead'], outro: [4, 4] },
  privateSchool: { verse: 16, build: ['keys', 'bass', 'snare', 'hats', 'fx'], breakdown: ['keys', 'lead', 'hats'], outro: [4, 4] },
};

/**
 * A club tune's running order: an intro in two halves that opens the filter (the beat, the
 * keys or the bass first, the groove joining), a verse on the groove, a build, the drop
 * (the lead joining halfway in breakbeat, funky house and private school, singing from the
 * top in UK garage), a breakdown, a second build and drop, and an outro that thins to the
 * drums, as a DJ wants an outro.
 */
export function arrangeClub(rng: () => number, lean: DanceLean, intro: IntroStyle, mood: ClubMood): DancePart[] {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length)] as T;
  const shape = SHAPES[mood];
  const drums: readonly LofiLayer[] = ['kick', 'snare', 'hats'];
  const groove: readonly LofiLayer[] = ['keys', 'bass', 'fx', ...drums];
  const singing = mood === 'ukGarage';
  const opening: Record<IntroStyle, [readonly LofiLayer[], readonly LofiLayer[]]> = {
    keys: [['keys', 'hats', 'fx'], ['keys', 'bass', 'snare', 'hats', 'fx']],
    beat: [[...drums, 'fx'], ['keys', 'fx', ...drums]],
    bass: [['bass', 'kick', 'hats', 'fx'], ['keys', 'bass', 'fx', ...drums]],
    lead: [['keys', 'lead', 'fx'], ['keys', 'lead', 'bass', 'hats', 'fx']],
    full: [groove, groove],
  };
  const [first, then] = opening[intro];
  const half = lean.intro / 2;
  const parts: DancePart[] = [
    { section: 'intro', bars: half, prog: 0, layers: first, open: [0.3, 0.6] },
    { section: 'intro', bars: half, prog: 0, layers: then, open: [0.6, 0.85] },
    { section: 'verse', bars: shape.verse, prog: 0, layers: singing || mood === 'privateSchool' ? [...groove, 'lead'] : groove, open: [0.85, 0.95] },
  ];
  const drop = (alt: boolean): void => {
    parts.push({ section: 'build', bars: pick(lean.build), prog: 0, layers: shape.build, open: [0.7, 1] });
    if (singing) parts.push({ section: 'drop', bars: lean.drop, prog: 1, layers: [...groove, 'lead'], alt });
    else {
      parts.push({ section: 'drop', bars: lean.drop / 2, prog: 1, layers: alt ? [...groove, 'lead'] : groove, alt });
      parts.push({ section: 'drop', bars: lean.drop / 2, prog: 1, layers: [...groove, 'lead'], alt });
    }
  };
  drop(false);
  parts.push({ section: 'break', bars: lean.breakdown, prog: 0, layers: shape.breakdown, open: [0.8, 0.6] });
  drop(true);
  parts.push({ section: 'outro', bars: shape.outro[0], prog: 0, layers: groove, open: [0.95, 0.75] });
  parts.push({ section: 'outro', bars: shape.outro[1], prog: 0, layers: mood === 'privateSchool' ? ['keys', 'hats'] : drums, open: [0.7, 0.4], fade: true });
  return parts;
}

// ── drum and bass's top loop ─────────────────────────────────────────────────

/** Drum and bass's top loop: a break chopped over the kit, from a stream of the tune's own. */
export interface TopLoop { brk: BreakPlan; r: () => number }
export function topLoopOf(seed: number): TopLoop {
  const r = mulberry32((seed ^ 0x70b1) >>> 0);
  return { brk: breakPlan(r, 0.6, { turnEvery: 4, fresh: true }), r };
}

/**
 * A bar of drum and bass's top loop: the break's hats and ghost notes (its kick left to the
 * kit, its backbeat to the kit's snare), quietly, through a drop and the second half of a
 * build, edited bar by bar as a producer edits one. Only notes are added (each a break's,
 * see isBreakNote), so the kit's own bars are unchanged.
 */
export function topLoopBar(top: TopLoop, at: { section: LofiSection; inSection: number; bars: number; lastOfBuild: boolean; hats: boolean }, sb: (step: number) => number): LofiNote[] {
  const { section } = at;
  const on = section === 'drop' || (section === 'build' && at.inSection >= at.bars / 2);
  if (!on || !at.hats) return [];
  const notes = breakBar(top.brk, top.r, { section: section === 'build' ? 'verse' : section, inSection: at.inSection, bars: at.bars, kick: false, snare: true, hats: true, lastOfBuild: at.lastOfBuild, level: 0.7, sb });
  // The loop's backbeat stays the kit's: only its ghosts, rolls and hats play.
  return notes.filter(n => !(n.voice === 'snare' && n.vel > 0.5 && Math.abs((n.beat % 2) - 1) < 0.05));
}
