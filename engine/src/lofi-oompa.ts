// SPDX-License-Identifier: MPL-2.0
/**
 * Oompa: the dance composer's Bavarian brass band tunes, written here so the composer's own
 * module (lofi-compose.ts) only hands the tune over. Pure and deterministic like the
 * composer: no Web Audio, no clock, a seeded source.
 *
 * A tune is a polka or a march in 2/4, or a waltz (a Ländler) in 3/4: each bar here is one
 * bar of the music (the tune's `beats` says two or three). Its parts are the band's:
 *
 * - The oom: a tuba (the bass) on the strong beats, the chord's root and then its fifth
 *   (a polka's and a march's two beats, a waltz's first beat, the root and the fifth taking
 *   turns bar by bar), and a run up or down the scale into each new strain. It leaves the
 *   odd beat out at the end of a phrase to breathe.
 * - The pah: the after-beats, a chord on each "and" (a waltz's two and three), played short
 *   and tongued by the tenor horns, a baritone and the trombones (the keys).
 * - The melody: a flugelhorn or a trumpet (the lead), with a second player a third or a
 *   sixth under the tune. In the trio the tenor horn takes the tune, the baritone under the horn.
 * - The clarinets: runs, arpeggios and turns over the tune in the strains they decorate.
 * - The trombones: a countermelody in the tenor range, on the chord's guiding tones, moving
 *   where the tune holds or rests.
 * - The drums: the bass drum on the beats with a cymbal on the after-beats (struck on the
 *   one mounted on the bass drum, or a pair of crash cymbals), a snare in a march, a
 *   woodblock now and then, and a cymbal crash opening a loud strain.
 *
 * The extra lines are lead notes whose `mod` says the part (OOMPA_PART), so the shell plays
 * each on its own instrument and each player breathes on their own.
 *
 * The form: a fanfare to open, the first strain twice (the second time decorated), the
 * second strain, a lead-in to the trio, the trio in the subdominant, softly and then with
 * the whole band (a march's trio has its break strain between), and a coda that ends on the
 * stinger. Every strain is sixteen bars of four four-bar phrases, the first and third
 * alike, the second and fourth answering them. The harmony is a major key's I, IV and V7
 * with secondary dominants. Only genre traits: no tune, arrangement or band is imitated.
 */
import type { LofiBar, LofiLayer, LofiNote, LofiSection, LofiStyle, LofiTuneInfo } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** The kinds of oompa tune: a polka and a march in 2/4, a waltz in 3/4. */
export const OOMPA_FORMS = ['polka', 'march', 'waltz'] as const;
export type OompaForm = typeof OOMPA_FORMS[number];

/**
 * The band's lines, by a lead note's `mod`: the part times OOMPA_PART. The melody is the
 * tune's lead (the bar's), the second plays under it in thirds and sixths, the clarinet
 * decorates, the counter is the trombones' countermelody and the fanfare the trumpets.
 */
export const OOMPA_PARTS = ['melody', 'second', 'clarinet', 'counter', 'fanfare'] as const;
export type OompaPart = typeof OOMPA_PARTS[number];
export const OOMPA_PART = 16;
/** Added to a lead note's `mod`: slurred from the part's note before (no new tongue). */
export const OOMPA_SLUR = 2;
/** Added to a lead note's `mod`: leaned on, an accent. */
export const OOMPA_ACCENT = 4;
/** A tuba note's `mod`: one of a run into a new strain, slurred and quick. */
export const OOMPA_RUN = 1;
/** Which part a lead note is. */
export function oompaPart(mod: number | undefined): OompaPart {
  return OOMPA_PARTS[Math.floor((mod ?? 0) / OOMPA_PART) % OOMPA_PARTS.length] ?? 'melody';
}

/** Beats in a bar of each form. */
export const OOMPA_BEATS: Record<OompaForm, number> = { polka: 2, march: 2, waltz: 3 };
/** The tempo ranges (beats a minute): a polka, a march (and a slower one), a waltz. */
const TEMPO = { polka: [108, 132], march: [100, 120], slowMarch: [84, 96], waltz: [132, 168] } as const;

/** What an oompa section is called: the verse is the first strain, the groove the second, the drop the trio. */
export function oompaSectionName(section: LofiSection): string {
  return section === 'intro' ? 'fanfare' : section === 'verse' ? 'first strain' : section === 'groove' ? 'second strain'
    : section === 'build' ? 'into the trio' : section === 'drop' ? 'trio' : section === 'break' ? 'break strain' : section === 'outro' ? 'coda' : section;
}

// ── harmony ───────────────────────────────────────────────────────────────

const Q = { maj: [0, 4, 7], dom7: [0, 4, 7, 10], min: [0, 3, 7] } as const;
type Quality = keyof typeof Q;
const SUFFIX: Record<Quality, string> = { maj: '', dom7: '7', min: 'm' };
/** The composer's note names (transposeChordName reads them). */
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
type Step = readonly [number, Quality];
interface Chord { root: number; quality: Quality; name: string; tones: number[] }
const chordOf = (key: number, [deg, q]: Step): Chord => {
  const root = ((key + deg) % 12 + 12) % 12;
  return { root, quality: q, name: NAMES[root] + SUFFIX[q], tones: Q[q].map(i => (root + i) % 12) };
};
const I: Step = [0, 'maj'], IV: Step = [5, 'maj'], V7: Step = [7, 'dom7'];
/** The secondary dominants: of the dominant (II7), of the subdominant (I7) and of the second (VI7). */
const II7: Step = [2, 'dom7'], I7: Step = [0, 'dom7'], VI7: Step = [9, 'dom7'];
const ii: Step = [2, 'min'];

/** The sixteen-bar strains, a chord a bar: the first strain's, the second's and the trio's. */
const FIRST: readonly (readonly Step[])[] = [
  [I, I, I, V7, V7, V7, V7, I, I, I, I7, IV, I, V7, I, I],
  [I, I, V7, V7, V7, V7, I, I, I, I, IV, IV, I, V7, I, I],
  [I, V7, V7, I, I, V7, V7, I, I, I7, IV, IV, II7, V7, I, I],
  [I, I, I, V7, V7, V7, II7, V7, I, I, I, IV, I, V7, I, I],
];
const SECOND: readonly (readonly Step[])[] = [
  [V7, V7, I, I, V7, V7, I, I, IV, IV, I, VI7, II7, V7, I, I],
  [IV, IV, I, I, V7, V7, I, I, IV, IV, I, I, V7, V7, I, I],
  [I7, I7, IV, IV, II7, II7, V7, V7, I, I, IV, IV, I, V7, I, I],
  [V7, V7, V7, I, ii, V7, I, I, V7, V7, V7, I, II7, V7, I, I],
];
const TRIO: readonly (readonly Step[])[] = [
  [I, I, V7, V7, V7, V7, I, I, I, I, IV, IV, I, V7, I, I],
  [I, I, I, V7, V7, V7, V7, I, I, VI7, II7, II7, V7, V7, I, I],
  [I, IV, I, V7, I, IV, V7, I, I, I7, IV, IV, I, V7, I, I],
];
/** The march's break strain: the low brass against the trumpets over the dominant's dominant. */
const BREAK: readonly Step[] = [II7, II7, V7, V7, II7, II7, V7, V7];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

// ── rhythm ────────────────────────────────────────────────────────────────

/** A bar's rhythm: [sixteenth, length in sixteenths]. */
type Cell = ReadonlyArray<readonly [number, number]>;
/** A polka's bars (2/4, eight sixteenths): eighths, a quarter and eighths, the dotted bounce, sixteenth pickups. */
const POLKA_CELLS: readonly Cell[] = [
  [[0, 2], [2, 2], [4, 2], [6, 2]],
  [[0, 4], [4, 2], [6, 2]],
  [[0, 2], [2, 2], [4, 4]],
  [[0, 3], [3, 1], [4, 2], [6, 2]],
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2]],
  [[0, 2], [2, 1], [3, 1], [4, 4]],
  [[0, 6], [6, 2]],
  [[0, 2], [2, 2], [4, 1], [5, 1], [6, 2]],
];
/** A march's bars: dotted figures and quarters, a little squarer than a polka's. */
const MARCH_CELLS: readonly Cell[] = [
  [[0, 3], [3, 1], [4, 3], [7, 1]],
  [[0, 4], [4, 4]],
  [[0, 3], [3, 1], [4, 4]],
  [[0, 2], [2, 2], [4, 2], [6, 2]],
  [[0, 6], [6, 2]],
  [[0, 4], [4, 3], [7, 1]],
];
/** A waltz's bars (3/4, twelve sixteenths): a half and a quarter, three quarters, a dotted half, a lilt. */
const WALTZ_CELLS: readonly Cell[] = [
  [[0, 8], [8, 4]],
  [[0, 4], [4, 4], [8, 4]],
  [[0, 12]],
  [[0, 4], [4, 8]],
  [[0, 6], [6, 2], [8, 4]],
  [[0, 4], [4, 2], [6, 2], [8, 4]],
  [[0, 2], [2, 2], [4, 4], [8, 4]],
];
/** A phrase's last bar: a long note and room to breathe after the note. */
const POLKA_END: readonly Cell[] = [[[0, 4]], [[0, 2], [2, 2]], [[0, 3], [3, 1], [4, 2]]];
const MARCH_END: readonly Cell[] = [[[0, 4]], [[0, 3], [3, 1], [4, 2]]];
const WALTZ_END: readonly Cell[] = [[[0, 8]], [[0, 4], [4, 4]], [[0, 6]]];

/** The fanfare's bars: dotted calls, the held dominant, and the last bar left to the tuba's run. */
const FANFARE: Record<'two' | 'three', readonly (readonly Cell[])[]> = {
  two: [
    [[[0, 3], [3, 1], [4, 4]], [[0, 3], [3, 1], [4, 2], [6, 2]], [[0, 8]], [[0, 4]]],
    [[[0, 2], [2, 2], [4, 2], [6, 2]], [[0, 4], [4, 4]], [[0, 3], [3, 1], [4, 4]], [[0, 4]]],
    [[[0, 1], [1, 1], [2, 2], [4, 4]], [[0, 1], [1, 1], [2, 2], [4, 4]], [[0, 8]], [[0, 4]]],
  ],
  three: [
    [[[0, 4], [4, 4], [8, 4]], [[0, 8], [8, 4]], [[0, 12]], [[0, 4]]],
    [[[0, 6], [6, 2], [8, 4]], [[0, 6], [6, 2], [8, 4]], [[0, 12]], [[0, 4]]],
  ],
};

// ── composing ──────────────────────────────────────────────────────────────

/** What the composer hands over: how it draws a style, and the woodblock's percussion `mod`. */
export interface OompaDeps {
  drawStyle: (rng: () => number) => LofiStyle;
  woodblock: number;
}

type Kind = 'fanfare' | 'first' | 'second' | 'leadIn' | 'trio' | 'break' | 'coda';
interface Strain {
  section: LofiSection; kind: Kind; bars: number;
  /** In the trio's key (the subdominant), or home. */
  trio: boolean;
  /** How loud the band plays it (a strength, 0 to 1). */
  dyn: number;
  /** The clarinets decorate; the trombones play their countermelody; the tenor horn and baritone take the tune. */
  deco?: boolean; counter?: boolean; duet?: boolean;
  /** The time through (0 the first): a repeat varies its ending a little. */
  time?: number;
}

const ALL: readonly LofiLayer[] = ['keys', 'bass', 'lead', 'kick', 'snare', 'hats'];

/** A tune's running order, by its form. */
function arrangeOompa(form: OompaForm, rng: () => number): Strain[] {
  const s: Strain[] = [];
  s.push({ section: 'intro', kind: 'fanfare', bars: 4, trio: false, dyn: 0.82 });
  s.push({ section: 'verse', kind: 'first', bars: 16, trio: false, dyn: 0.6, time: 0 });
  s.push({ section: 'verse', kind: 'first', bars: 16, trio: false, dyn: 0.64, deco: true, time: 1 });
  s.push({ section: 'groove', kind: 'second', bars: 16, trio: false, dyn: 0.7, counter: rng() < 0.6, time: 0 });
  if (form === 'march' || rng() < 0.35) s.push({ section: 'groove', kind: 'second', bars: 16, trio: false, dyn: 0.74, deco: true, counter: true, time: 1 });
  s.push({ section: 'build', kind: 'leadIn', bars: 4, trio: false, dyn: 0.5 });
  s.push({ section: 'drop', kind: 'trio', bars: 16, trio: true, dyn: 0.46, duet: true, time: 0 });
  if (form === 'march') s.push({ section: 'break', kind: 'break', bars: 8, trio: true, dyn: 0.82 });
  s.push({ section: 'drop', kind: 'trio', bars: 16, trio: true, dyn: 0.86, deco: true, counter: true, time: 1 });
  s.push({ section: 'outro', kind: 'coda', bars: 4, trio: true, dyn: 0.9 });
  return s;
}

const clamp = (v: number): number => Math.max(0.05, Math.min(1, v));
const pcOf = (m: number): number => ((m % 12) + 12) % 12;
/** Pitch class `pc` placed in [lo, hi], nearest `near` when given. */
function place(pc: number, lo: number, hi: number, near?: number): number {
  let best = -1;
  for (let p = lo; p <= hi; p++) {
    if (pcOf(p - pc) !== 0) continue;
    if (best < 0 || (near !== undefined && Math.abs(p - near) < Math.abs(best - near))) best = p;
  }
  if (best >= 0) return best;
  const up = lo + pcOf(pc - lo);
  return up > hi ? up - 12 : up;
}
/** The scale's notes from `lo` to `hi`. */
function ladderOf(scale: readonly number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let p = lo; p <= hi; p++) if (scale.includes(pcOf(p))) out.push(p);
  return out;
}
/** `n` scale steps from `midi` (down when negative). */
function scaleStep(midi: number, n: number, scale: readonly number[]): number {
  let p = midi, left = Math.abs(n);
  const dir = n < 0 ? -1 : 1;
  while (left > 0) { p += dir; if (scale.includes(pcOf(p))) left--; }
  return p;
}

interface Tone { step: number; len: number; midi: number; slur: boolean }

/**
 * A line a phrase at a time, as salsa's (lofi-salsa.ts) is: rhythm cells, the pitches
 * walking the scale (or, in the bars `arp` marks, the chord) along an arch, a chord tone on
 * every strong beat and on the phrase's last note, never the same note three times running.
 * A step between two quick notes in a bar is slurred now and then.
 */
function line(rng: () => number, cells: readonly Cell[], chords: readonly Chord[], scale: readonly number[], lo: number, hi: number, start: number, strong: (step: number) => boolean, arp: readonly boolean[]): Tone[][] {
  const ladder = ladderOf(scale, lo, hi);
  const nearest = (p: number): number => ladder.reduce((b, x, i) => (Math.abs(x - p) < Math.abs(ladder[b]! - p) ? i : b), 0);
  let at = nearest(start);
  const home = at;
  const count = cells.reduce((s, c) => s + c.length, 0);
  const peakAt = 0.3 + rng() * 0.35;
  const height = 3 + Math.floor(rng() * 4);
  const out: Tone[][] = [];
  let k = 0, was = -1, wasBefore = -1;
  const isTone = (chord: Chord, i: number): boolean => chord.tones.includes(pcOf(ladder[i]!));
  cells.forEach((cell, b) => {
    const chord = chords[b]!;
    const bar: Tone[] = [];
    cell.forEach(([step, len], n) => {
      const progress = count > 1 ? k / (count - 1) : 0;
      k++;
      const arch = progress < peakAt ? height * (progress / peakAt) : height * (1 - (progress - peakAt) / (1 - peakAt)) - 1;
      const want = home + arch;
      const leans = strong(step) || (b === cells.length - 1 && n === cell.length - 1);
      if (arp[b]) {
        // Up or down the chord: the next chord tone towards where the arch is heading.
        const up = want >= at;
        const next = up ? ladder.findIndex((_, i) => i > at && isTone(chord, i)) : [...ladder.keys()].reverse().find(i => i < at && isTone(chord, i));
        if (next !== undefined && next >= 0) at = next;
        else if (!isTone(chord, at)) at = ladder.findIndex((_, i) => isTone(chord, i) && i >= at) >= 0 ? ladder.findIndex((_, i) => isTone(chord, i) && i >= at) : at;
      } else {
        let move = Math.max(-2, Math.min(2, Math.round((want - at) * 0.6 + [-1, 0, 0, 1][Math.floor(rng() * 4)]!)));
        if (move === 0 && was === wasBefore && was === at) move = want >= at ? 1 : -1;
        at = Math.max(0, Math.min(ladder.length - 1, at + move));
      }
      if (leans && !isTone(chord, at)) {
        const up = ladder.findIndex((_, i) => i > at && isTone(chord, i));
        const down = [...ladder.keys()].reverse().find(i => i < at && isTone(chord, i));
        at = up >= 0 && (down === undefined || want >= at) ? up : down ?? at;
      }
      if (at === was && was === wasBefore) {
        const other = want >= at ? ladder.findIndex((_, i) => i > at && (!leans || isTone(chord, i))) : [...ladder.keys()].reverse().find(i => i < at && (!leans || isTone(chord, i)));
        if (other !== undefined && other >= 0) at = other;
      }
      const prev = bar[bar.length - 1];
      const slur = !!prev && prev.step + prev.len === step && len <= 2 && Math.abs(ladder[at]! - prev.midi) <= 2 && ladder[at]! !== prev.midi && rng() < 0.35;
      wasBefore = was;
      was = at;
      bar.push({ step, len, midi: ladder[at]!, slur });
    });
    out.push(bar);
  });
  return out;
}

/** A phrase's line moved onto other chords: each strong note to the nearest tone of its bar's chord. */
function refit(bars: readonly Tone[][], chords: readonly Chord[], strong: (step: number) => boolean, lo: number, hi: number): Tone[][] {
  return bars.map((bar, b) => bar.map((t, n) => {
    const chord = chords[b]!;
    const leans = strong(t.step) || (b === bars.length - 1 && n === bar.length - 1);
    if (!leans || chord.tones.includes(pcOf(t.midi))) return t;
    let best = t.midi, gap = 99;
    for (let p = Math.max(lo, t.midi - 4); p <= Math.min(hi, t.midi + 4); p++) {
      if (chord.tones.includes(pcOf(p)) && Math.abs(p - t.midi) < gap) { best = p; gap = Math.abs(p - t.midi); }
    }
    return { ...t, midi: best };
  }));
}

/** The second player's note under `midi`: a diatonic third, or a sixth when the third would go under `lo`; a chord tone on a strong beat. */
function under(midi: number, chord: Chord, scale: readonly number[], strong: boolean, lo: number): number {
  const third = scaleStep(midi, -2, scale);
  const sixth = scaleStep(midi, -5, scale);
  const options = third >= lo ? [third, sixth] : [sixth, third];
  if (!strong) return options[0]! >= lo - 2 ? options[0]! : options[1]!;
  for (const p of options) if (chord.tones.includes(pcOf(p)) && p >= lo - 2) return p;
  for (let p = midi - 3; p >= midi - 9; p--) if (chord.tones.includes(pcOf(p))) return p;
  return options[0]!;
}

/** One oompa tune's bars (see the module's note). `fixed` holds the music generator's own picks. */
export function composeOompa(seed: number, fixed: Partial<LofiStyle>, deps: OompaDeps): LofiBar[] {
  const rng = mulberry32((seed ^ 0x00a9a) >>> 0);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
  const chance = (p: number): boolean => rng() < p;
  const roll = rng();
  const form: OompaForm = roll < 0.45 ? 'polka' : roll < 0.7 ? 'march' : 'waltz';
  const slow = form === 'march' && chance(0.35);
  const [b0, b1] = form === 'march' ? (slow ? TEMPO.slowMarch : TEMPO.march) : TEMPO[form];
  const bpm = Math.round(b0 + rng() * (b1 - b0));
  // A brass band's keys: B♭, E♭, F and A♭ most, C and G now and then.
  const keyRoll = rng() * 16;
  const home = keyRoll < 4 ? 10 : keyRoll < 8 ? 3 : keyRoll < 11 ? 5 : keyRoll < 13 ? 8 : keyRoll < 15 ? 0 : 7;
  const trioKey = (home + 5) % 12;
  const style: LofiStyle = { ...deps.drawStyle(rng), groove: form, ...fixed };
  const beats = OOMPA_BEATS[form];
  const steps = beats * 4;
  const waltz = form === 'waltz';
  const strong = (step: number): boolean => step === 0 || (waltz && step === 8);
  const cells = waltz ? WALTZ_CELLS : form === 'march' ? MARCH_CELLS : POLKA_CELLS;
  const ends = waltz ? WALTZ_END : form === 'march' ? MARCH_END : POLKA_END;
  const strains = arrangeOompa(form, rng);
  const total = strains.reduce((s, p) => s + p.bars, 0) + 1;

  const first = pick(FIRST), second = pick(SECOND), trio = pick(TRIO);
  const homeOf = (p: readonly Step[]): Chord[] => p.map(s => chordOf(home, s));
  const trioOf = (p: readonly Step[]): Chord[] => p.map(s => chordOf(trioKey, s));
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood: 'oompa', bpm, swing: 0.5, swing8: 0.5, style, beats,
    key: `${NAMES[home]} major`,
    progressions: [homeOf(first).map(c => c.name), trioOf(trio).map(c => c.name)],
    bars: total,
  };

  // The drummer's choices for the tune: the cymbal on the after-beats struck on the one
  // mounted on the bass drum, or a pair of crash cymbals; a polka's snare on the after-beats
  // too in some tunes; the woodblock in the soft trio of some.
  const clash = chance(0.4);
  const polkaSnare = form === 'polka' && chance(0.35);
  const woodTrio = chance(0.45);
  const marchFigure = Math.floor(rng() * 3);
  // The melody's instrument, and the trio's: the tenor horn, unless a person chose the lead.
  const lead = style.lead;
  const trioLead: LofiStyle['lead'] = fixed.lead ? lead : 'tenorhorn';

  // The tunes: a melody for each strain, the second strain's own, the trio's.
  const scaleHome = MAJOR.map(i => (home + i) % 12), scaleTrio = MAJOR.map(i => (trioKey + i) % 12);
  /** A sixteen-bar strain's tune: two phrases and their returns, the last landing on the key's root. */
  const strainTune = (chords: readonly Chord[], scale: readonly number[], lo: number, hi: number, startAt: number): Tone[][] => {
    const rhythmA = [pick(cells), pick(cells), pick(cells), pick(ends)];
    const rhythmB = [rhythmA[0]!, pick(cells), pick(cells), pick(ends)];
    const arpA = rhythmA.map(() => chance(0.35)), arpB = rhythmB.map(() => chance(0.35));
    const p1 = line(rng, rhythmA, chords.slice(0, 4), scale, lo, hi, startAt, strong, arpA);
    const p2 = line(rng, rhythmB, chords.slice(4, 8), scale, lo, hi, p1[3]![p1[3]!.length - 1]!.midi, strong, arpB);
    const p3 = refit(p1, chords.slice(8, 12), strong, lo, hi);
    const p4 = refit(p2, chords.slice(12, 16), strong, lo, hi);
    // The strain ends home: its last note on the chord's root, near where the line was.
    const last = p4[3]!;
    const end = last[last.length - 1]!;
    last[last.length - 1] = { ...end, midi: place(chords[15]!.root, lo, hi, end.midi) };
    return [...p1, ...p2, ...p3, ...p4];
  };
  const firstTune = strainTune(homeOf(first), scaleHome, 62, 79, 70);
  const secondTune = strainTune(homeOf(second), scaleHome, 62, 79, 72);
  const trioTune = strainTune(trioOf(trio), scaleTrio, 55, 72, 63);
  // The fanfare: its rhythm, its chords (the tonic, then the dominant held) and its line, up the chord.
  const fanfareCells = pick(FANFARE[waltz ? 'three' : 'two']);
  const fanfareChords = [I, I, V7, V7].map(s => chordOf(home, s));
  const fanfare = line(rng, fanfareCells, fanfareChords, scaleHome, 62, 79, 65, strong, [true, true, true, true]);
  // The coda: the trio's dominant and tonic, the band's last call and the stinger.
  const codaChords = [V7, I, V7, I].map(s => chordOf(trioKey, s));
  const breakChords = BREAK.map(s => chordOf(trioKey, s));
  const leadInChords = [I, I7, I7, I7].map(s => chordOf(home, s));

  const bars: LofiBar[] = [];
  let index = 0;
  let pahVoicing: number[] = [];
  let counterAt = 55;
  const chordsOf = (s: Strain): Chord[] => (s.kind === 'fanfare' ? fanfareChords : s.kind === 'first' ? homeOf(first) : s.kind === 'second' ? homeOf(second)
    : s.kind === 'leadIn' ? leadInChords : s.kind === 'trio' ? trioOf(trio) : s.kind === 'break' ? breakChords : codaChords);
  for (let si = 0; si < strains.length; si++) {
    const part = strains[si]!;
    const next = strains[si + 1];
    const chords = chordsOf(part);
    for (let i = 0; i < part.bars; i++, index++) {
      const chord = chords[i % chords.length]!;
      const scale = part.trio ? scaleTrio : scaleHome;
      const lastOfPart = i === part.bars - 1;
      const into = lastOfPart ? next : undefined;
      const dyn = part.dyn;
      const notes: LofiNote[] = [];
      const hit = (voice: LofiNote['voice'], step: number, vel: number, midi = 0, dur = 0, mod?: number): void => {
        notes.push({ voice, beat: step / 4, dur, midi, vel: clamp(vel + (rng() - 0.5) * 0.05), ...(mod === undefined ? {} : { mod }) });
      };
      const lineNote = (who: OompaPart, t: Tone, vel: number, flags = 0): void => {
        hit('lead', t.step, vel, t.midi, (t.len / 4) * (t.len <= 2 ? 0.8 : 0.9), OOMPA_PARTS.indexOf(who) * OOMPA_PART + (t.slur ? OOMPA_SLUR : 0) + flags);
      };
      const coda = part.kind === 'coda';
      const stinger = coda && lastOfPart;
      const callBar = coda && i === part.bars - 3;
      const pickupBar = coda && i === part.bars - 2;
      const fanfareHeld = part.kind === 'fanfare' && i < 3;
      // A run into every new strain but the coda, and out of the fanfare into the first strain.
      const runBar = !!into && into.kind !== 'coda';

      // THE OOM: the tuba on the strong beats, root then fifth; a run into the next strain;
      // the odd beat left out to breathe at the end of an eight-bar phrase.
      const root = place(chord.root, 29, 40);
      const fifth = place(chord.tones[2] ?? chord.root, Math.max(28, root - 7), root + 7, root - 5);
      const oomVel = 0.78 * (0.75 + dyn * 0.35);
      if (stinger) hit('bass', 0, 0.92, root, 0.35, 0);
      else if (callBar) hit('bass', 0, 0.85, root, waltz ? 1.5 : 0.9, 0);
      else if (pickupBar) hit('bass', steps - 2, 0.8, place(chordOf(trioKey, V7).root, 29, 40), 0.4, 0);
      else if (fanfareHeld) hit('bass', 0, 0.85, root, beats * 0.8, 0);
      else if (runBar && into) {
        // Up the scale (or down it) into the next strain's first root: eighths, a waltz's quarters.
        const nextChord = chordsOf(into)[0]!;
        const nextScale = into.trio ? scaleTrio : scaleHome;
        const target = place(nextChord.root, 29, 40);
        const up = chance(0.65);
        const n = waltz ? 3 : 4, len = waltz ? 4 : 2;
        for (let r = 0; r < n; r++) {
          const p = Math.max(28, Math.min(48, scaleStep(target, up ? -(n - r) : n - r, nextScale)));
          hit('bass', r * len, oomVel * (r ? 0.95 : 1), r === 0 && !chord.tones.includes(pcOf(p)) ? root : p, (len / 4) * 0.9, r ? OOMPA_RUN : 0);
        }
      } else {
        const breathe = i % 8 === 7 && !waltz;
        const twoBar = i % 2 === 1 && chords[i - 1]?.name === chord.name;
        hit('bass', 0, oomVel, waltz && twoBar ? fifth : root, waltz ? 0.9 : 0.62, 0);
        if (!waltz && !breathe) hit('bass', 4, oomVel * 0.9, fifth, 0.6, 0);
      }

      // THE PAH: the after-beats, short and tongued: a polka's and a march's "and"s, a waltz's
      // two and three. Three of the chord's tones in close position (four for a seventh, now
      // and then), moving as little as they can.
      const want = chord.tones.length > 3 ? [chord.tones[1]!, chord.tones[3]!, chord.tones[2]!] : [chord.tones[1]!, chord.tones[2]!, chord.root];
      const centre = pahVoicing.length ? pahVoicing.reduce((a, b) => a + b, 0) / pahVoicing.length : 62;
      pahVoicing = want.map(pc => place(pc, 55, 70, centre)).sort((a, b) => a - b);
      if (chord.tones.length > 3 && chance(0.5)) pahVoicing = [place(chord.root, 53, 64, Math.min(...pahVoicing) - 4), ...pahVoicing].sort((a, b) => a - b);
      const pahVel = (0.5 + dyn * 0.38) * 0.82;
      const pahs = waltz ? [4, 8] : [2, 6];
      const pahLen = waltz ? 0.5 : 0.34;
      if (stinger) for (const p of pahVoicing) hit('keys', 0, 0.95, p, 0.35);
      else if (callBar) for (const p of pahVoicing) hit('keys', 0, 0.85, p, waltz ? 1.5 : 0.9);
      else if (pickupBar) for (const p of pahVoicing) hit('keys', steps - 2, 0.82, p, 0.35);
      else if (fanfareHeld) for (const p of pahVoicing) hit('keys', 0, 0.8, p, beats * 0.85);
      else if (part.kind !== 'fanfare') for (const st of pahs) for (const p of pahVoicing) hit('keys', st, pahVel, p, pahLen);

      // THE MELODY and the band's other lines.
      const voices: LofiBar['voices'] = { lead: part.duet ? trioLead : lead };
      const melVel = 0.45 + dyn * 0.45;
      /** The clarinets over a decorated bar: a run of the chord's tones up and back, a turn round a held note, or the tune an octave up. */
      const decorate = (bar: readonly Tone[]): void => {
        const held = bar.find(t => t.step === 0 && t.len >= (waltz ? 8 : 4));
        const r = rng();
        const vel = melVel * 0.78;
        const sub = waltz ? 2 : 1;
        if (held && r < 0.4) {
          // The turn: the held note an octave up, its neighbours above and below.
          const top = held.midi + 12 > 89 ? held.midi : held.midi + 12;
          const shape = [0, 1, 0, -1];
          for (let st = 0, k = 0; st < steps; st += 2 * sub, k++) {
            const p = shape[k % 4] === 0 ? top : scaleStep(top, shape[k % 4]!, scale);
            lineNote('clarinet', { step: st, len: 2 * sub, midi: p, slur: st > 0 }, vel);
          }
        } else if (r < 0.75) {
          // The run: up the chord from near the tune, and back down past the top.
          const start = place(chord.tones[r < 0.55 ? 0 : 1]!, 72, 83);
          const ladder = [] as number[];
          for (let p = 70; p <= 91; p++) if (chord.tones.includes(pcOf(p))) ladder.push(p);
          let at = ladder.indexOf(start), dir = 1;
          for (let st = 0; st < steps; st += sub) {
            lineNote('clarinet', { step: st, len: sub, midi: ladder[at]!, slur: st % 4 !== 0 }, vel * (st % 4 === 0 ? 1 : 0.9));
            if (at + dir >= ladder.length || at + dir < 0) dir = -dir;
            at += dir;
          }
        } else {
          for (const t of bar) if (t.midi + 12 <= 91) lineNote('clarinet', { ...t, midi: t.midi + 12 }, vel);
        }
      };
      /** The trombones' countermelody: a guiding tone of the chord (its third or seventh), near the last, and a step on to the next where the tune moves little. */
      const countermelody = (bar: readonly Tone[]): void => {
        const guides = [chord.tones[1]!, chord.tones[3] ?? chord.tones[2]!];
        const p = guides.map(pc => place(pc, 46, 63, counterAt)).reduce((b, x) => (Math.abs(x - counterAt) < Math.abs(b - counterAt) ? x : b));
        const vel = melVel * 0.85;
        const busy = bar.length >= 3;
        if (busy) lineNote('counter', { step: 0, len: steps, midi: p, slur: false }, vel);
        else {
          const nextChord = chords[(i + 1) % chords.length]!;
          const goal = place(nextChord.tones[1]!, 46, 63, p);
          const pass = Math.max(46, Math.min(63, scaleStep(p, goal > p ? 1 : goal < p ? -1 : 1, scale)));
          const half = waltz ? 4 : 4;
          lineNote('counter', { step: 0, len: half, midi: p, slur: false }, vel);
          lineNote('counter', { step: half, len: steps - half, midi: waltz && !chord.tones.includes(pcOf(pass)) ? p : pass, slur: true }, vel * 0.9);
        }
        counterAt = p;
      };
      if (fanfareHeld) {
        // The fanfare: the call in octaves, the trumpets on top, the trombones under, the clarinets over.
        for (const t of fanfare[i]!) {
          lineNote('fanfare', t, melVel, OOMPA_ACCENT);
          lineNote('melody', t, melVel * 0.95);
          lineNote('counter', { ...t, midi: t.midi - 12 }, melVel * 0.9);
          if (t.midi + 12 <= 91) lineNote('clarinet', { ...t, midi: t.midi + 12 }, melVel * 0.8);
        }
      } else if (part.kind === 'fanfare') {
        // The fanfare's last bar: its last note, then the tuba's run alone.
        for (const t of fanfare[3]!) lineNote('fanfare', t, melVel, OOMPA_ACCENT);
      } else if (part.kind === 'first' || part.kind === 'second' || part.kind === 'trio') {
        const tune = part.kind === 'first' ? firstTune : part.kind === 'second' ? secondTune : trioTune;
        const bar = tune[i]!;
        // The full trio takes the tune an octave up, on the flugelhorns.
        const lift = part.kind === 'trio' && !part.duet ? 12 : 0;
        for (const t of bar) {
          const tt = { ...t, midi: t.midi + lift };
          lineNote('melody', tt, melVel);
          lineNote('second', { ...tt, midi: under(tt.midi, chord, scale, strong(t.step), part.duet ? 46 : 55) }, melVel * 0.88);
        }
        if (part.deco) decorate(bar.map(t => ({ ...t, midi: t.midi + lift })));
        if (part.counter) countermelody(bar);
      } else if (part.kind === 'break') {
        // The low brass call, the trumpets answer: unison arpeggios over the dominant's dominant.
        const call = i % 2 === 0;
        const rhythm: ReadonlyArray<readonly [number, number]> = waltz ? [[0, 4], [4, 4], [8, 4]] : [[0, 2], [2, 2], [4, 2], [6, 2]];
        let p = call ? place(chord.root, 46, 58) : place(chord.tones[1]!, 67, 77);
        for (const [st, len] of rhythm) {
          const t: Tone = { step: st, len, midi: p, slur: false };
          lineNote(call ? 'counter' : 'fanfare', t, melVel, st === 0 ? OOMPA_ACCENT : 0);
          if (!call) lineNote('melody', t, melVel * 0.9);
          const idx = chord.tones.indexOf(pcOf(p));
          p = place(chord.tones[(idx + 1) % chord.tones.length]!, call ? 46 : 64, call ? 63 : 81, p + 3);
        }
      } else if (part.kind === 'leadIn') {
        // The clarinets run down into the trio over the band's oom-pah on the trio's dominant.
        if (i === 1 || i === 3) {
          const sub = waltz ? 2 : 1;
          let p = place(chord.tones[2]!, 82, 91);
          for (let st = 0; st < steps; st += sub) {
            lineNote('clarinet', { step: st, len: sub, midi: p, slur: st > 0 }, 0.5 + dyn * 0.3);
            p = Math.max(70, scaleStep(p, -1, chord.tones.includes(pcOf(scaleStep(p, -1, scaleTrio))) ? scaleTrio : scale));
            if (waltz && st + sub === 8 && !chord.tones.includes(pcOf(p))) p = place(chord.tones[1]!, 70, p);
          }
        }
      } else if (coda) {
        // The coda: the band's cadence, a call, the pickup and the stinger, all together.
        if (i === 0) {
          const top = place(chord.tones[3] ?? chord.tones[1]!, 67, 77);
          for (const [st, p] of [[0, top], [waltz ? 4 : 2, scaleStep(top, -1, scale)], [waltz ? 8 : 4, place(chord.tones[2]!, 65, 77, top)]] as const) {
            const len = waltz ? 4 : 2;
            lineNote('melody', { step: st, len, midi: p, slur: false }, melVel);
            lineNote('second', { step: st, len, midi: under(p, chord, scale, strong(st), 55), slur: false }, melVel * 0.88);
          }
        }
        const tutti = (st: number, len: number, vel: number): void => {
          const top = place(chord.root, 67, 79);
          lineNote('melody', { step: st, len, midi: top, slur: false }, vel, OOMPA_ACCENT);
          lineNote('second', { step: st, len, midi: place(chord.tones[1]!, 62, 74, top - 4), slur: false }, vel * 0.9, OOMPA_ACCENT);
          lineNote('fanfare', { step: st, len, midi: place(chord.tones[2]!, 64, 76), slur: false }, vel, OOMPA_ACCENT);
          lineNote('counter', { step: st, len, midi: place(chord.tones[1]!, 50, 62), slur: false }, vel * 0.9, OOMPA_ACCENT);
          lineNote('clarinet', { step: st, len, midi: place(chord.root, 79, 91), slur: false }, vel * 0.85, OOMPA_ACCENT);
        };
        if (callBar) tutti(0, waltz ? 8 : 4, 0.85);
        if (pickupBar) tutti(steps - 2, 2, 0.82);
        if (stinger) tutti(0, 2, 0.95);
      }

      // THE DRUMS.
      const kickVel = 0.62 + dyn * 0.3;
      if (stinger) { hit('kick', 0, 0.95); hit('crash', 0, 0.9); }
      else if (callBar) { hit('kick', 0, 0.85); hit('crash', 0, 0.75); }
      else if (pickupBar) { hit('snare', steps - 2, 0.75); hit('kick', steps - 2, 0.7); }
      else if (part.kind === 'fanfare') {
        if (i === 0) { hit('kick', 0, 0.85); hit('crash', 0, 0.8); }
        if (i === 1 || i === 3) hit('kick', 0, 0.72);
        // A roll through the held dominant into the first strain.
        if (i === 2) notes.push({ voice: 'snare', beat: 0, dur: beats, midi: 0, vel: 0.42 });
      } else {
        const softTrio = part.kind === 'trio' && !!part.duet;
        if (i === 0 && dyn >= 0.6 && part.kind !== 'leadIn') hit('crash', 0, 0.55 + dyn * 0.3);
        // The bass drum on the beats (a waltz's on its first).
        for (let b = 0; b < (waltz ? 1 : beats); b++) hit('kick', b * 4, b === 0 ? kickVel : kickVel * 0.82);
        // The cymbal on the after-beats (in a soft trio, the woodblock in some tunes).
        for (const st of pahs) {
          if (softTrio && woodTrio) hit('perc', st, 0.42 + dyn * 0.2, 1, 0, deps.woodblock);
          else hit('hat', st, (clash ? 0.5 : 0.42) + dyn * 0.25, 0, 0, clash ? 1 : 0);
          if (polkaSnare && !softTrio) hit('snare', st, 0.32 + dyn * 0.15);
        }
        // A march's snare: its figure every bar, a roll into each new phrase.
        if (form === 'march' && !softTrio) {
          if (i % 4 === 3) {
            for (const st of [0, 2]) hit('snare', st, 0.5 + dyn * 0.2);
            notes.push({ voice: 'snare', beat: 1, dur: 1, midi: 0, vel: clamp(0.45 + dyn * 0.2) });
          } else for (const st of MARCH_SNARE[marchFigure]!) hit('snare', st, (st === 0 ? 0.55 : 0.36) + dyn * 0.2);
        }
        // The woodblock's clip-clop at the end of the second strain's phrases, now and then.
        if (part.kind === 'second' && i % 8 === 7 && woodTrio) for (const st of waltz ? [0, 4, 8] : [0, 2, 4, 6]) hit('perc', st, 0.5, st % 4 === 0 ? 1 : 2, 0, deps.woodblock);
      }
      notes.sort((a, b) => a.beat - b.beat);
      bars.push({ tune: info, index, section: part.section, layers: ALL, chord: chord.name, tones: chord.tones, notes, open: 1, level: 1, voices });
    }
  }
  bars.push({ tune: info, index, section: 'rest', layers: [], chord: '', tones: [], notes: [], open: 0.3, level: 0 });
  return bars;
}

/** A march snare's figures, a bar of 2/4 in sixteenths. */
const MARCH_SNARE: ReadonlyArray<readonly number[]> = [[0, 2, 3, 4, 6], [0, 2, 4, 5, 6, 7], [0, 3, 4, 6, 7]];
