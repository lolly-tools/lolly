// SPDX-License-Identifier: MPL-2.0
/**
 * Salsa: the dance composer's salsa tunes, written here so the composer's own module
 * (lofi-compose.ts) only hands the tune over. Pure and deterministic like the composer: no Web
 * Audio, no clock, a seeded source.
 *
 * Everything is written against the clave. A tune draws son clave in one direction (2-3 or
 * 3-2) and keeps it to the end: every section has an even number of bars, so a bar's side
 * of the clave is fixed by whether its place in the tune is even or odd. Each part takes its
 * rhythm from its side:
 *
 * - The clave itself, on two sticks: three strokes on the three side (one, the and of two,
 *   four) and two on the two side (two and three).
 * - The piano's montuno (guajeo): an eighth-note figure two bars long, the line (G4 to A5)
 *   doubled an octave down by the left hand, every bar's figure holding its side's off-beat clave strokes,
 *   beat one left empty and the last eighth of the bar anticipating the next chord, tied
 *   over the bar line.
 * - The bass's tumbao: the and of two, then four anticipating the next chord's root and
 *   held across the bar line, so beat one sounds the note already ringing and is never
 *   struck (only a section's first bar plays the one).
 * - The congas' tumbao: heel and toe on the downbeats and their ands, the slap on two,
 *   two open tones on four and its and; in the montuno the open tones move to the tumba on
 *   the two side, and a quinto calls at the end of an eight-bar phrase.
 * - The bongos' martillo, finger and thumb on the small drum and an open tone on the big
 *   one on four; in the montuno and the mambo the bongocero takes up the bongo bell on the
 *   beats instead.
 * - The timbales: cáscara on the shell (its own pattern for each side) with the left hand
 *   on the head in the verse, the same pattern on the mambo bell from the montuno on, and
 *   an abanico (a roll ending in a rimshot and the cymbal) into each new section.
 * - The güiro: long, short, short, every two beats.
 * - The brass: the verse's melody and the pregones on the lead (a trumpet, the singer's
 *   part), the mambo's riffs and their moñas on the whole section.
 * - The coro: a refrain sung by several voices in thirds, answered by the pregón.
 *
 * The running order: an intro (the piano's montuno alone, the percussion alone, or the
 * band with the horns), the verse, a two-bar bridge that breaks on the clave, the first
 * montuno (coro and pregón), the mambo, a second montuno, and an ending that hits the clave
 * together and the last chord.
 *
 * Tempo 160 to 210 beats a minute in four (felt in two: the bells and the bass lean on one
 * and three). Only genre traits: no song, arrangement or artist is imitated.
 */
import type { LofiBar, LofiLayer, LofiNote, LofiSection, LofiStyle, LofiTuneInfo } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** The salsa percussion, appended to the composer's LOFI_PERCUSSION in this order. */
export const SALSA_PERCUSSION = ['congas', 'bongos', 'timbales', 'bongoBell', 'mamboBell', 'clave', 'guiro'] as const;
export type SalsaPercussion = typeof SALSA_PERCUSSION[number];

/**
 * A congas note's `midi`: the drum times CONGA_DRUM plus the stroke. The drums: 0 the
 * quinto (the smallest and highest), 1 the conga, 2 the tumba (the biggest and lowest).
 */
export const CONGA_DRUM = 8;
/** The conga strokes: open tone, slap, muffled (the hand stays on the head), heel and toe of the hand, the bass tone in the middle of the head. */
export const CONGA_STROKES = { open: 1, slap: 2, muff: 3, heel: 4, toe: 5, bass: 6 } as const;
/** A bongos note's `midi`: the macho (the small drum) open, slapped, the fingertip and the thumb of the martillo; the hembra (the big one) open and slapped. */
export const BONGO_STROKES = { open: 1, slap: 2, finger: 3, thumb: 4, hembra: 5, hembraSlap: 6 } as const;
/** A timbales note's `midi`: the macho head and the hembra head (open), the shell (cáscara), a rimshot on the hembra and on the macho, the hembra muffled by the hand, and a soft head stroke (a roll's). */
export const TIMBAL_STROKES = { macho: 1, hembra: 2, shell: 3, rimshot: 4, machoRim: 5, muffled: 6, roll: 7 } as const;
/** A bell note's `midi` (the bongo bell and the mambo bell): struck at the mouth (open, low) or the neck (higher, choked). */
export const BELL_STROKES = { mouth: 1, neck: 2 } as const;
/** A güiro note's `midi`: the stick scraped down (away) or up (back). Its `dur` is the scrape's length in beats. */
export const GUIRO_STROKES = { down: 1, up: 2 } as const;

/** Son clave, in sixteenths of a four-beat bar: the three side and the two side. */
export const SON_CLAVE = { three: [0, 6, 12], two: [4, 8] } as const;
/** The cáscara (and the mambo bell's part), in sixteenths, by side. */
export const CASCARA = { three: [0, 4, 6, 10, 14], two: [0, 4, 8, 10, 14] } as const;
/** The clave's sides, in the order a tune plays them from its first bar. */
export type ClaveDirection = '3-2' | '2-3';
/** Which side of the clave bar `index` of a tune is on. */
export function claveSide(direction: ClaveDirection, index: number): 'three' | 'two' {
  const first = direction === '3-2' ? 'three' : 'two';
  return index % 2 === 0 ? first : first === 'three' ? 'two' : 'three';
}

/** What a salsa section is called: the chorus is the montuno, the solo section the mambo, the build the bridge. */
export function salsaSectionName(section: LofiSection): string {
  return section === 'drop' ? 'montuno' : section === 'break' ? 'mambo' : section === 'build' ? 'bridge' : section;
}

// ── harmony ───────────────────────────────────────────────────────────────

const Q = { maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10] } as const;
type Quality = keyof typeof Q;
const SUFFIX: Record<Quality, string> = { maj: '', min: 'm', dom7: '7', m7: 'm7', m7b5: 'm7♭5' };
/** The composer's note names (transposeChordName reads them). */
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
type Step = readonly [number, Quality];
interface Chord { root: number; quality: Quality; name: string; tones: number[] }
const chordOf = (key: number, [deg, q]: Step): Chord => {
  const root = (key + deg) % 12;
  return { root, quality: q, name: NAMES[root] + SUFFIX[q], tones: Q[q].map(i => (root + i) % 12) };
};

/** The verse's progressions, a chord a bar: the son's I IV V and ii V I, and their minor cousins. */
const VERSE_MAJOR: readonly (readonly Step[])[] = [
  [[0, 'maj'], [5, 'maj'], [7, 'dom7'], [0, 'maj']],
  [[0, 'maj'], [9, 'min'], [2, 'm7'], [7, 'dom7']],
  [[2, 'm7'], [7, 'dom7'], [0, 'maj'], [0, 'maj']],
  [[0, 'maj'], [7, 'dom7'], [7, 'dom7'], [0, 'maj']],
  [[5, 'maj'], [7, 'dom7'], [0, 'maj'], [9, 'min']],
];
const VERSE_MINOR: readonly (readonly Step[])[] = [
  [[0, 'min'], [5, 'min'], [7, 'dom7'], [0, 'min']],
  [[0, 'min'], [8, 'maj'], [2, 'm7b5'], [7, 'dom7']],
  [[2, 'm7b5'], [7, 'dom7'], [0, 'min'], [0, 'min']],
  [[5, 'min'], [7, 'dom7'], [0, 'min'], [0, 'min']],
  [[0, 'min'], [7, 'dom7'], [7, 'dom7'], [0, 'min']],
];
/** The montuno's vamps: what the coro and the pregón trade over. */
const VAMP_MAJOR: readonly (readonly Step[])[] = [
  [[0, 'maj'], [5, 'maj'], [7, 'dom7'], [5, 'maj']],
  [[0, 'maj'], [7, 'dom7'], [0, 'maj'], [7, 'dom7']],
  [[2, 'm7'], [7, 'dom7'], [2, 'm7'], [7, 'dom7']],
  [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'dom7']],
];
const VAMP_MINOR: readonly (readonly Step[])[] = [
  [[0, 'min'], [5, 'min'], [7, 'dom7'], [0, 'min']],
  [[0, 'min'], [7, 'dom7'], [0, 'min'], [7, 'dom7']],
  [[2, 'm7b5'], [7, 'dom7'], [0, 'min'], [7, 'dom7']],
  [[5, 'min'], [0, 'min'], [7, 'dom7'], [0, 'min']],
];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];

// ── the parts' figures ─────────────────────────────────────────────────────

/**
 * The montuno's figures, two bars each (the two side's bar, then the three side's), in
 * eighths: [eighth, what is played]. 'r', '3', '5' and '7' are the chord's root, third,
 * fifth and seventh (the root when it has none), 'R' the root an octave up, 'n' the
 * next chord's nearest tone (the anticipation), 'C' the chord in a block and 'N' the next
 * chord's. No figure strikes beat one (the anticipation before it is still ringing), and
 * each bar holds its side's off-beat clave strokes: the two side's eighths 2 and 4, the
 * three side's 3 and 6.
 */
type Role = 'r' | '3' | '5' | '7' | 'R' | 'n' | 'C' | 'N';
type Montuno = readonly [ReadonlyArray<readonly [number, Role]>, ReadonlyArray<readonly [number, Role]>];
export const MONTUNOS: readonly Montuno[] = [
  // The arpeggio: the chord broken up and down in eighths.
  [[[1, '3'], [2, '5'], [3, 'R'], [4, '5'], [5, '3'], [6, '5'], [7, 'n']], [[1, '5'], [2, 'R'], [3, '5'], [5, '3'], [6, '5'], [7, 'n']]],
  // The syncopated figure: pushes on the ands, a rest in each half.
  [[[1, '5'], [2, '3'], [4, '5'], [6, '3'], [7, 'n']], [[1, '3'], [2, '5'], [3, '3'], [5, '5'], [6, 'R'], [7, 'n']]],
  // The scale figure: down from the octave through the seventh.
  [[[1, 'R'], [2, '7'], [3, '5'], [4, '3'], [5, '5'], [6, '3'], [7, 'n']], [[1, '5'], [3, 'R'], [4, '7'], [5, '5'], [6, '3'], [7, 'n']]],
  // Blocks: the chord pushed on the ands, with the octaves on top.
  [[[1, 'C'], [2, 'C'], [4, 'C'], [6, 'C'], [7, 'N']], [[1, 'C'], [3, 'C'], [4, 'C'], [6, 'C'], [7, 'N']]],
];

/** The conga player's tumbao, one bar, in sixteenths: [step, drum, stroke, strength]. */
type Hand = readonly [number, number, number, number];
const MARCHA: readonly Hand[] = [[0, 1, 4, 0.42], [2, 1, 5, 0.34], [4, 1, 2, 0.8], [6, 1, 5, 0.34], [8, 1, 4, 0.42], [10, 1, 5, 0.34], [12, 1, 1, 0.78], [14, 1, 1, 0.74]];
/** The bongos' martillo: [step, stroke, strength]. */
const MARTILLO: ReadonlyArray<readonly [number, number, number]> = [[0, 3, 0.62], [2, 4, 0.36], [4, 3, 0.55], [6, 4, 0.36], [8, 3, 0.6], [10, 4, 0.36], [12, 5, 0.78], [14, 4, 0.4]];
/** The bongo bell on the beats: the mouth on one and three, the neck on two and four, and its ands. */
const BONGO_BELL: ReadonlyArray<readonly [number, number, number]> = [[0, 1, 0.82], [4, 2, 0.6], [6, 2, 0.4], [8, 1, 0.8], [12, 2, 0.6], [14, 2, 0.42]];
/** The güiro, long, short, short, every two beats: [step, stroke, length in beats, strength]. */
const GUIRO: ReadonlyArray<readonly [number, number, number, number]> = [[0, 1, 0.75, 0.6], [4, 2, 0.22, 0.45], [6, 1, 0.22, 0.5], [8, 1, 0.75, 0.6], [12, 2, 0.22, 0.45], [14, 1, 0.22, 0.5]];

/** A melody's rhythm cells, one bar each, by side: [sixteenth, length in sixteenths]. */
type Cell = ReadonlyArray<readonly [number, number]>;
const LINE_THREE: readonly Cell[] = [
  [[0, 3], [3, 3], [6, 2], [10, 2], [12, 4]],
  [[2, 2], [4, 2], [6, 4], [12, 2], [14, 2]],
  [[0, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
  [[3, 3], [6, 6], [14, 2]],
  [[0, 4], [6, 2], [8, 2], [12, 4]],
];
const LINE_TWO: readonly Cell[] = [
  [[4, 2], [6, 2], [8, 4], [14, 2]],
  [[2, 2], [4, 2], [6, 2], [8, 2], [10, 6]],
  [[4, 4], [8, 2], [10, 2], [12, 4]],
  [[0, 2], [2, 2], [4, 4], [8, 8]],
  [[4, 2], [8, 2], [10, 2], [14, 2]],
];
/** A phrase's last bar: a long note to land on. */
const CADENCE: readonly Cell[] = [[[0, 2], [2, 2], [4, 10]], [[2, 2], [4, 12]], [[0, 4], [4, 12]], [[4, 2], [6, 10]]];
/** The mambo's riffs, by side: short, punchy, on the ands. */
const RIFF_THREE: readonly Cell[] = [
  [[0, 1], [3, 1], [6, 2], [10, 1], [12, 2], [14, 1]],
  [[2, 1], [3, 1], [6, 1], [8, 2], [11, 1], [12, 1]],
  [[0, 2], [3, 1], [6, 1], [7, 1], [10, 2], [14, 2]],
];
const RIFF_TWO: readonly Cell[] = [
  [[2, 1], [4, 2], [8, 2], [11, 1], [14, 2]],
  [[4, 1], [6, 1], [8, 2], [10, 1], [12, 1], [14, 1]],
  [[0, 1], [2, 1], [4, 2], [7, 1], [8, 3]],
];

// ── composing ──────────────────────────────────────────────────────────────

/** What the composer hands over: how it draws a style, and each percussion kind's `mod`. */
export interface SalsaDeps {
  drawStyle: (rng: () => number) => LofiStyle;
  perc: (kind: SalsaPercussion) => number;
  bpm: readonly [number, number];
  minor: number;
}

interface SalsaPart { section: LofiSection; bars: number; prog: 0 | 1 | 2; layers: readonly LofiLayer[]; intro?: 'keys' | 'beat' | 'full'; open?: readonly [number, number]; ending?: boolean }

const ALL: readonly LofiLayer[] = ['keys', 'bass', 'lead', 'fx', 'kick', 'snare', 'hats'];
const DRUMS: readonly LofiLayer[] = ['kick', 'snare', 'hats'];

/** A salsa tune's running order (every section an even number of bars, so the clave never turns round). */
function arrangeSalsa(rng: () => number): SalsaPart[] {
  const r = rng();
  const intro: 'keys' | 'beat' | 'full' = r < 0.45 ? 'keys' : r < 0.7 ? 'beat' : 'full';
  const parts: SalsaPart[] = [];
  if (intro === 'keys') parts.push({ section: 'intro', bars: 4, prog: 1, layers: ['keys', 'fx'], intro, open: [0.75, 0.9] });
  else if (intro === 'beat') parts.push({ section: 'intro', bars: 4, prog: 1, layers: ['fx', ...DRUMS], intro, open: [0.85, 0.95] });
  else parts.push({ section: 'intro', bars: 4, prog: 1, layers: ALL, intro, open: [0.9, 1] });
  parts.push({ section: 'intro', bars: 4, prog: 1, layers: ALL, intro: 'full', open: [0.95, 1] });
  parts.push({ section: 'verse', bars: 16, prog: 0, layers: ALL });
  parts.push({ section: 'build', bars: 2, prog: 0, layers: ALL });
  parts.push({ section: 'drop', bars: 16, prog: 1, layers: ALL });
  parts.push({ section: 'break', bars: 8, prog: 2, layers: ALL });
  parts.push({ section: 'drop', bars: 16, prog: 1, layers: ALL });
  parts.push({ section: 'outro', bars: 4, prog: 1, layers: ALL, open: [1, 0.95] });
  parts.push({ section: 'outro', bars: 2, prog: 1, layers: ALL, ending: true, open: [0.95, 0.9] });
  return parts;
}

const clamp = (v: number): number => Math.max(0.05, Math.min(1, v));
/** Pitch class `pc` placed in [lo, hi], nearest `near` when given. */
function place(pc: number, lo: number, hi: number, near?: number): number {
  let best = -1;
  for (let p = lo; p <= hi; p++) {
    if (((p - pc) % 12 + 12) % 12 !== 0) continue;
    if (best < 0 || (near !== undefined && Math.abs(p - near) < Math.abs(best - near))) best = p;
  }
  if (best >= 0) return best;
  // A range narrower than an octave that misses the class: the nearest octave under its top.
  const up = lo + ((((pc - lo) % 12) + 12) % 12);
  return up > hi ? up - 12 : up;
}

/**
 * A melody a phrase at a time: rhythm cells by side, the pitches walking the scale along an
 * arch (up to a high point somewhere in the first two-thirds of the phrase, then down to
 * land), a chord tone wherever the line leans (a clave stroke, beat one or three, the
 * phrase's last note), and never the same note three times running.
 */
function melody(rng: () => number, cells: readonly Cell[], scale: readonly number[], chords: readonly Chord[], sides: ReadonlyArray<'three' | 'two'>, lo: number, hi: number, start: number): Array<Array<{ step: number; len: number; midi: number }>> {
  const ladder: number[] = [];
  for (let p = lo; p <= hi; p++) if (scale.includes(((p % 12) + 12) % 12)) ladder.push(p);
  const nearest = (p: number): number => ladder.reduce((b, x, i) => (Math.abs(x - p) < Math.abs(ladder[b]! - p) ? i : b), 0);
  let at = nearest(start);
  const home = at;
  const count = cells.reduce((s, c) => s + c.length, 0);
  const peakAt = 0.3 + rng() * 0.35;
  const height = 3 + Math.floor(rng() * 4);
  const out: Array<Array<{ step: number; len: number; midi: number }>> = [];
  let tied = false;
  let k = 0;
  let was = -1, wasBefore = -1;
  const isTone = (chord: Chord, i: number): boolean => chord.tones.includes(ladder[i]! % 12);
  cells.forEach((cell, b) => {
    const chord = chords[b]!;
    const bar: Array<{ step: number; len: number; midi: number }> = [];
    const strokes = SON_CLAVE[sides[b]!];
    cell.forEach(([step, len], n) => {
      if (tied && step === 0) return;
      const progress = count > 1 ? k / (count - 1) : 0;
      k++;
      const arch = progress < peakAt ? height * (progress / peakAt) : height * (1 - (progress - peakAt) / (1 - peakAt)) - 1;
      const want = home + arch;
      let move = Math.max(-2, Math.min(2, Math.round((want - at) * 0.6 + [-1, 0, 0, 1][Math.floor(rng() * 4)]!)));
      if (move === 0 && was === wasBefore && was === at) move = want >= at ? 1 : -1;
      at = Math.max(0, Math.min(ladder.length - 1, at + move));
      // On a clave stroke, a beat, or the phrase's last note: a chord tone, the nearest
      // one towards where the arch is heading.
      const leans = (strokes as readonly number[]).includes(step) || step % 8 === 0 || (b === cells.length - 1 && n === cell.length - 1);
      if (leans && !isTone(chord, at)) {
        const up = ladder.findIndex((_, i) => i > at && isTone(chord, i));
        const down = [...ladder.keys()].reverse().find(i => i < at && isTone(chord, i));
        at = up >= 0 && (down === undefined || want >= at) ? up : down ?? at;
      }
      if (at === was && was === wasBefore) {
        const other = want >= at ? ladder.findIndex((_, i) => i > at && (!leans || isTone(chord, i))) : [...ladder.keys()].reverse().find(i => i < at && (!leans || isTone(chord, i)));
        if (other !== undefined && other >= 0) at = other;
      }
      wasBefore = was;
      was = at;
      bar.push({ step, len, midi: ladder[at]! });
    });
    const last = cell[cell.length - 1]!;
    tied = last[0] + last[1] > 16;
    out.push(bar);
  });
  return out;
}

/** A diatonic third under `midi` in `scale` (a coro's second voice). */
function thirdBelow(midi: number, scale: readonly number[]): number {
  let p = midi - 1;
  let found = 0;
  while (p > midi - 6) {
    if (scale.includes(((p % 12) + 12) % 12)) found++;
    if (found === 2) return p;
    p--;
  }
  return midi - 3;
}

/** The nearest tone of `chord` two to five semitones under `midi`. */
function chordToneBelow(midi: number, chord: Chord): number {
  for (let p = midi - 2; p >= midi - 5; p--) if (chord.tones.includes(((p % 12) + 12) % 12)) return p;
  return midi - 12;
}

/** One salsa tune's bars (see the module's note). `fixed` holds the music generator's own picks. */
export function composeSalsa(seed: number, fixed: Partial<LofiStyle>, deps: SalsaDeps): LofiBar[] {
  const rng = mulberry32((seed ^ 0x5a15a) >>> 0);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
  const chance = (p: number): boolean => rng() < p;
  const key = Math.floor(rng() * 12);
  const minor = rng() < deps.minor;
  const style = { ...deps.drawStyle(rng), ...fixed };
  const bpm = Math.round(deps.bpm[0] + rng() * (deps.bpm[1] - deps.bpm[0]));
  const direction: ClaveDirection = chance(0.55) ? '2-3' : '3-2';
  const scale = minor ? HARMONIC_MINOR : MAJOR_SCALE;
  const scaleKey = scale.map(i => (key + i) % 12);
  const verse = pick(minor ? VERSE_MINOR : VERSE_MAJOR).map(s => chordOf(key, s));
  const vamp = pick(minor ? VAMP_MINOR : VAMP_MAJOR).map(s => chordOf(key, s));
  // The mambo rides the vamp, or the verse's changes.
  const mamboChords = chance(0.6) ? vamp : verse;
  const progs = [verse, vamp, mamboChords] as const;
  const parts = arrangeSalsa(rng);
  const total = parts.reduce((s, p) => s + p.bars, 0) + 1;
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood: 'salsa', bpm, swing: 0.5, swing8: 0.5, style,
    key: `${NAMES[key]} ${minor ? 'minor' : 'major'}`,
    progressions: [verse.map(c => c.name), vamp.map(c => c.name)],
    bars: total,
  };

  // The tune's own figures: the montuno for the verse and for the montuno, the verse's
  // melody, the coro, and the mambo's riff and its moña.
  const montunoVerse = pick(MONTUNOS);
  const montunoHot = chance(0.5) ? montunoVerse : pick(MONTUNOS);
  const sideOf = (index: number): 'three' | 'two' => claveSide(direction, index);
  const cellFor = (side: 'three' | 'two', cells: [readonly Cell[], readonly Cell[]]): Cell => pick(side === 'three' ? cells[0] : cells[1]);
  // The verse: an eight-bar melody sung twice, its second half answering the first.
  const sidesOf = (from: number, n: number): Array<'three' | 'two'> => Array.from({ length: n }, (_, i) => sideOf(from + i));
  const verseSides = sidesOf(0, 8);
  const verseCells = verseSides.map((s, i) => (i % 4 === 3 ? pick(CADENCE) : cellFor(s, [LINE_THREE, LINE_TWO])));
  const verseChords = Array.from({ length: 8 }, (_, i) => verse[i % 4]!);
  const verseLine = melody(rng, verseCells, scaleKey, verseChords, verseSides, 64, 79, 70);
  // The coro: two bars, the second landing on a long note, sung the same every time.
  const coroSides = sidesOf(0, 2);
  const coroCells = [cellFor(coroSides[0]!, [LINE_THREE, LINE_TWO]), pick(CADENCE)];
  const coroLine = melody(rng, coroCells, scaleKey, [vamp[0]!, vamp[1]!], coroSides, 67, 79, 72);
  // The mambo's riff and its moña, lower, each a two-bar rhythm played over the four
  // chords (its notes leaning on each chord's tones); the intro's horns play the riff over the vamp.
  const riffSides = sidesOf(0, 4);
  const twice = (cells: Cell[]): Cell[] => [cells[0]!, cells[1]!, cells[0]!, cells[1]!];
  const riffCells = twice(riffSides.slice(0, 2).map(s => cellFor(s, [RIFF_THREE, RIFF_TWO])));
  const riffLine = melody(rng, riffCells, scaleKey, mamboChords, riffSides, 67, 82, 72);
  const introRiff = mamboChords === vamp ? riffLine : melody(rng, riffCells, scaleKey, vamp, riffSides, 67, 82, 72);
  const monaCells = twice(riffSides.slice(0, 2).map(s => cellFor(s, [RIFF_THREE, RIFF_TWO])));
  const monaLine = melody(rng, monaCells, scaleKey, mamboChords, riffSides, 64, 72, 67);
  // The bass's fills, and whether its two-and is the fifth or the root.
  const fifthOnTwoAnd = chance(0.6);
  const lead = style.lead === 'flute' && !fixed.lead ? 'trumpet' : style.lead;

  // A part's chord at its bar `i` (`inSection` bars into its section): the ending is the
  // dominant and then the tonic, whatever the vamp was doing.
  const dominant = chordOf(key, [7, 'dom7']);
  const tonic = chordOf(key, [0, minor ? 'min' : 'maj']);
  const chordAt = (part: SalsaPart, i: number, inSection: number): Chord => {
    if (part.ending) return i >= part.bars - 1 ? tonic : dominant;
    const prog = progs[part.prog]!;
    return prog[inSection % prog.length]!;
  };

  const bars: LofiBar[] = [];
  let index = 0;
  /** Whether the bass played the bar before (its four is still ringing). */
  let bassPlaying = false;
  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi]!;
    const next = parts[pi + 1];
    let run = 0;
    for (let q = pi - 1; q >= 0 && parts[q]!.section === part.section; q--) run += parts[q]!.bars;
    for (let i = 0; i < part.bars; i++, index++) {
      const inSection = run + i;
      const side = sideOf(index);
      const chord = chordAt(part, i, inSection);
      const lastOfPart = i === part.bars - 1;
      const nextChord = lastOfPart && next ? chordAt(next, 0, 0) : chordAt(part, i + 1, inSection + 1);
      const has = (l: LofiLayer): boolean => part.layers.includes(l);
      const firstOfSection = inSection === 0;
      const notes: LofiNote[] = [];
      const hit = (voice: LofiNote['voice'], step: number, vel: number, midi = 0, dur = 0, mod?: number): void => {
        notes.push({ voice, beat: step / 4, dur, midi, vel: clamp(vel + (rng() - 0.5) * 0.06), ...(mod === undefined ? {} : { mod }) });
      };
      const perc = (kind: SalsaPercussion, step: number, stroke: number, vel: number, dur = 0): void => hit('perc', step, vel, stroke, dur, deps.perc(kind));
      const ending = part.ending === true;
      const breakBar = part.section === 'build' && lastOfPart;
      const hot = part.section === 'drop' || part.section === 'break' || (part.section === 'outro' && !ending);
      const strokes: readonly number[] = SON_CLAVE[side];

      // The break and the ending: the band hits the clave's strokes together (and the
      // ending then its last chord, on one).
      if (ending || breakBar) {
        const hits = ending && lastOfPart ? [0] : [...strokes];
        const voicing = chord.tones.map(pc => place(pc, 60, 71)).sort((a, b) => a - b);
        for (const st of hits) {
          const long = ending && lastOfPart;
          const len = long ? 3.5 : 0.35;
          const top = voicing[voicing.length - 1]!;
          if (has('keys')) for (const p of [...voicing, ...(voicing[0]! >= 64 ? [voicing[0]! - 12] : []), ...(top + 12 <= 76 ? [top + 12] : [])]) hit('keys', st, 0.7, p, len);
          if (has('bass')) hit('bass', st, 0.9, place(chord.root, 28, 39), len);
          if (has('lead')) hit('lead', st, 0.8, place(chord.tones[st === 0 ? 0 : 1] ?? chord.root, 67, 79), long ? 3 : 0.3);
          perc('timbales', st, TIMBAL_STROKES.rimshot, 0.9);
          perc('congas', st, CONGA_DRUM + CONGA_STROKES.slap, 0.8);
        }
        if (ending && lastOfPart) hit('crash', 0, 0.85);
        if (breakBar) {
          // The abanico: a roll on the hembra into the montuno's first beat.
          for (let n = 0; n < 6; n++) notes.push({ voice: 'perc', beat: 3 + n / 8, dur: 0, midi: TIMBAL_STROKES.roll, vel: clamp(0.35 + n * 0.08), mod: deps.perc('timbales') });
        }
        notes.sort((a, b) => a.beat - b.beat);
        bars.push({ tune: info, index, section: part.section, layers: part.layers, chord: chord.name, tones: chord.tones, notes, open: 1, level: 1, voices: { lead } });
        continue;
      }

      // CLAVE: the sticks, louder where the band leaves room.
      const claveVel = part.section === 'intro' ? 0.7 : hot ? 0.45 : 0.55;
      for (const st of strokes) perc('clave', st, 1, st === 0 ? claveVel + 0.05 : claveVel);

      // KEYS: the montuno, every section (the intro on its own, if the piano starts the tune).
      if (has('keys')) {
        const fig = (hot ? montunoHot : montunoVerse)[side === 'two' ? 0 : 1];
        let prev = 74;
        for (const [eighth, role] of fig) {
          const c = role === 'n' || role === 'N' ? nextChord : chord;
          const len = role === 'n' || role === 'N' ? 0.9 : 0.42;
          const vel = (eighth % 2 === 1 ? 0.6 : 0.52) * (part.section === 'intro' && part.intro === 'keys' ? 0.9 : 1);
          if (role === 'C' || role === 'N') {
            // A block: the chord's tones inside the octave its top note is doubled at.
            const top = place(c.tones[eighth % 2 === 1 ? 0 : Math.min(2, c.tones.length - 1)]!, 72, 83, prev);
            const inner = c.tones.map(pc => place(pc, top - 11, top - 1)).filter(p => p < top);
            for (const p of [top - 12, ...inner, top]) hit('keys', eighth * 2, vel, p, len);
            prev = top;
            continue;
          }
          const pc = role === 'r' || role === 'R' ? c.root
            : role === '3' ? c.tones[1]!
            : role === '5' ? c.tones[2]!
            : role === '7' ? (c.tones[3] ?? c.root)
            : c.tones.reduce((b, x) => (Math.abs(place(x, 67, 81, prev) - prev) < Math.abs(place(b, 67, 81, prev) - prev) ? x : b), c.root);
          const p = role === 'R' ? place(pc, 72, 83, Math.max(prev, 77)) : place(pc, 67, 81, prev);
          // The two hands in octaves.
          hit('keys', eighth * 2, vel, p, len);
          hit('keys', eighth * 2, vel * 0.9, p - 12, len);
          prev = p;
        }
      }

      // BASS: the tumbao, the and of two and then four anticipating the next chord,
      // held over the bar line; a section's first bar (or the bar the bass comes in) also plays the one.
      if (has('bass')) {
        const root = place(chord.root, 28, 39);
        const nextRoot = place(nextChord.root, 28, 39, root);
        if (firstOfSection || !bassPlaying) hit('bass', 0, 0.9, root, 1.4);
        const twoAnd = fifthOnTwoAnd ? place(chord.tones[2] ?? chord.root, Math.max(28, root - 5), root + 7) : root;
        hit('bass', 6, 0.82, twoAnd, 1.4);
        // At the end of a four-bar phrase the bass walks into the next chord.
        if (inSection % 4 === 3 && chance(0.5)) {
          hit('bass', 10, 0.74, place(chord.tones[1]!, root, root + 9), 0.45);
          hit('bass', 12, 0.88, nextRoot, 1.4);
        } else hit('bass', 12, 0.88, nextRoot, 1.4);
      }

      // PERCUSSION.
      if (has('kick') || has('hats')) {
        // Congas: the marcha; in the montuno the open tones on the two side go to the tumba,
        // and the quinto calls at the end of each eight-bar phrase.
        for (const [st, drum, stroke, vel] of MARCHA) {
          const tumba = hot && side === 'two' && stroke === CONGA_STROKES.open;
          perc('congas', st, (tumba ? 2 : drum) * CONGA_DRUM + stroke, vel);
        }
        if (hot && inSection % 8 === 7) for (const st of [9, 11, 13]) perc('congas', st, 0 * CONGA_DRUM + CONGA_STROKES.slap, 0.6);
        // Bongos: the martillo, or the bongo bell from the montuno on.
        if (hot) for (const [st, stroke, vel] of BONGO_BELL) perc('bongoBell', st, stroke, vel);
        else for (const [st, stroke, vel] of MARTILLO) perc('bongos', st, stroke, vel);
        // Timbales: cáscara on the shell with the left hand on the hembra in the verse and
        // the intro, the mambo bell's pattern from the montuno on.
        for (const st of CASCARA[side]) {
          const onClave = strokes.includes(st);
          if (hot) perc('mamboBell', st, onClave || st === 0 ? BELL_STROKES.mouth : BELL_STROKES.neck, onClave ? 0.72 : 0.55);
          else perc('timbales', st, TIMBAL_STROKES.shell, onClave ? 0.62 : 0.48);
        }
        if (!hot) perc('timbales', 12, TIMBAL_STROKES.muffled, 0.5);
        else perc('timbales', 12, TIMBAL_STROKES.hembra, 0.55);
        // Güiro: long, short, short.
        for (const [st, stroke, len, vel] of GUIRO) perc('guiro', st, stroke, vel, len);
        // The abanico into the next section, and its rimshot and cymbal on the new one's beat one.
        const into = lastOfPart && next && next.section !== part.section && next.section !== 'outro';
        if (into) for (let n = 0; n < 6; n++) notes.push({ voice: 'perc', beat: 3 + n / 8, dur: 0, midi: TIMBAL_STROKES.roll, vel: clamp(0.35 + n * 0.08), mod: deps.perc('timbales') });
        if (firstOfSection && part.section !== 'intro') { perc('timbales', 0, TIMBAL_STROKES.rimshot, 0.9); hit('crash', 0, 0.7); }
        // The timbalero's fill at the end of an eight-bar phrase of the verse.
        if (part.section === 'verse' && inSection % 8 === 7 && !lastOfPart) {
          for (const [st, stroke] of [[10, TIMBAL_STROKES.macho], [11, TIMBAL_STROKES.macho], [12, TIMBAL_STROKES.hembra], [13, TIMBAL_STROKES.hembra], [14, TIMBAL_STROKES.hembra]] as const) perc('timbales', st, stroke, 0.6);
        }
      }

      // LEAD: the verse's melody, the coro and the pregón, the mambo's riffs, the intro's horns.
      let voices: LofiBar['voices'] = { lead };
      if (has('lead')) {
        if (part.section === 'verse') {
          const line = verseLine[inSection % 8]!;
          // The second time through, the last note moves to the chord's third instead: the answer.
          const answer = inSection >= 8 && inSection % 8 === 7;
          for (const nt of line) {
            const midi = answer && nt === line[line.length - 1] ? place(chord.tones[1]!, Math.max(64, nt.midi - 4), Math.max(64, nt.midi - 4) + 11, nt.midi) : nt.midi;
            hit('lead', nt.step, nt.step % 4 === 0 ? 0.62 : 0.56, midi, nt.len / 4 * 0.9);
          }
        } else if (part.section === 'drop' || (part.section === 'outro' && !ending)) {
          // Two bars of coro, two of pregón.
          if (inSection % 4 < 2) {
            voices = { lead: 'chop' };
            for (const nt of coroLine[inSection % 2]!) {
              hit('lead', nt.step, 0.62, nt.midi, nt.len / 4 * 0.95);
              // The second voice: a chord tone under the line on beats one and three, a third under it between.
              const under = nt.step % 8 === 0 ? chordToneBelow(nt.midi, chord) : thirdBelow(nt.midi, scaleKey);
              if (under >= 64) hit('lead', nt.step, 0.5, under, nt.len / 4 * 0.95);
            }
          } else {
            const pregon = melody(rng, [cellFor(side, [LINE_THREE, LINE_TWO])], scaleKey, [chord], [side], 65, 81, 72)[0]!;
            // The pregón leaves the coro's first beat alone.
            for (const nt of pregon) if (!(inSection % 4 === 3 && nt.step >= 14)) hit('lead', nt.step, nt.step % 4 === 0 ? 0.64 : 0.58, nt.midi, nt.len / 4 * 0.88);
          }
        } else if (part.section === 'break' || (part.section === 'intro' && part.intro === 'full')) {
          const riff = part.section === 'break' ? riffLine : introRiff;
          for (const nt of riff[inSection % 4]!) hit('lead', nt.step, 0.78, nt.midi, Math.min(0.5, nt.len / 4 * 0.7));
          if (part.section === 'break' && inSection >= 4) for (const nt of monaLine[inSection % 4]!) hit('lead', nt.step, 0.66, nt.midi, Math.min(0.5, nt.len / 4 * 0.7));
        }
      }
      bassPlaying = has('bass');
      const [o0, o1] = part.open ?? [1, 1];
      const open = Math.round((o0 + (o1 - o0) * (part.bars > 1 ? i / (part.bars - 1) : 1)) * 1000) / 1000;
      notes.sort((a, b) => a.beat - b.beat);
      bars.push({ tune: info, index, section: part.section, layers: part.layers, chord: chord.name, tones: chord.tones, notes, open, level: 1, voices });
    }
  }
  bars.push({ tune: info, index, section: 'rest', layers: [], chord: '', tones: [], notes: [], open: 0.3, level: 0 });
  return bars;
}
