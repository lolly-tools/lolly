// SPDX-License-Identifier: MPL-2.0
/**
 * Mandopop and C-Pop: the dance composer's Chinese pop tunes, written here so the composer's
 * own module (lofi-compose.ts) only hands the tune over, as salsa's and oompa's are. Pure and
 * deterministic like the composer: no Web Audio, no clock, a seeded source of its own.
 *
 * Mandopop is Mandarin pop in the Taiwan and Hong Kong tradition. A tune is one of three
 * kinds, drawn per seed:
 * - a ballad (66 to 78 beats a minute): a grand piano's broken chords under the verse, the
 *   string section coming in through the pre-chorus and swelling under the chorus, a light
 *   kit (a cross-stick, then the full backbeat), a round or upright bass;
 * - an R&B tune (76 to 92): a Rhodes or the piano on syncopated chords, an 808 or a Motown
 *   bass with a sub, finger snaps or a clap on two and four, swung sixteenths on the hats;
 * - a soft-rock tune (84 to 100): the acoustic guitar strummed, the piano, the strings in
 *   the chorus, a full kit.
 * Over any of them, most tunes are China wind (zhongguo feng): the tune's hook is a
 * pentatonic line on an erhu, a dizi, a pipa or the guzheng, a guzheng runs into the
 * chorus, a woodblock, the tanggu and a gong colour the beat. The form is a song's: an intro
 * on the hook, a verse, a pre-chorus, a big chorus, an interlude, a second verse and chorus,
 * a bridge where the traditional instrument takes a solo, and the last chorus lifted a
 * semitone or a tone (a key change after a held dominant), then an outro on the hook.
 * The chords are Mandopop's: the canon's descending bass (I V vi iii IV I IV V), the
 * royal road (IV V iii vi) into a cadence, major sevenths and added ninths, a borrowed
 * minor four in a bridge.
 *
 * C-Pop is contemporary mainland pop, brighter and faster: dance-pop and EDM with idol-pop
 * energy (118 to 128, four on the floor, a clap on two and four, open hats on the
 * off-beats, supersaw stabs and plucks), trap-pop (94 to 108, half-time, sixteenth hats that
 * roll in triplets and thirty-seconds, an 808 sliding between notes) or a future-bass drop
 * (120 to 128, half-time, the wide chords pumping and bending). The guochao and gufeng
 * trend runs through it: after each chorus a dance break whose hook is a dizi or an erhu
 * riff (a pipa now and then) over the drop, a guzheng glissando into the chorus, the
 * tanggu and a gong on the drop. The form: intro, verse, pre-chorus with a riser and a
 * snare roll, chorus, dance break, again, a breakdown with the zither or the pipa alone
 * over a pad, a build, a last chorus (now and then a semitone up) and dance break, outro.
 *
 * The lead notes the composer bends (`mod` 1) are the ones a player ornaments: the erhu's
 * slides, the dizi's grace notes, the pipa's tremolo, a sung chop's scoop (the shell's
 * players choose how). Only genre traits: no song, singer or arrangement is imitated.
 */
import type { LofiBar, LofiLayer, LofiNote, LofiSection, LofiStyle, LofiTuneInfo } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

export type CpopMood = 'mandopop' | 'cpop';
/** The kinds of tune each genre draws. */
export const CPOP_KINDS = { mandopop: ['ballad', 'rnb', 'rock'], cpop: ['dance', 'trap', 'future'] } as const;
export type CpopKind = typeof CPOP_KINDS[CpopMood][number];

/** What the composer hands over: how it draws a style, and a percussion kind's `mod`. */
export interface CpopDeps {
  drawStyle: (rng: () => number) => LofiStyle;
  perc: (kind: 'tanggu' | 'gong' | 'woodblock' | 'shaker') => number;
}

/** What a Mandopop or C-Pop section is called. */
export function cpopSectionName(mood: CpopMood, section: LofiSection): string {
  if (section === 'build') return 'pre-chorus';
  if (section === 'drop') return 'chorus';
  if (section === 'feature') return mood === 'cpop' ? 'dance break' : 'interlude';
  if (section === 'bridge') return mood === 'cpop' ? 'breakdown' : 'bridge';
  return section;
}

// ── harmony ───────────────────────────────────────────────────────────────

const Q = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
  sus4: [0, 5, 7], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
} as const;
type Quality = keyof typeof Q;
const SUFFIX: Record<Quality, string> = { maj: '', min: 'm', maj7: 'maj7', m7: 'm7', dom7: '7', sus4: 'sus4', add9: 'add9', madd9: 'm(add9)' };
/** The composer's note names (its transposeChordName reads them). */
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
interface Chord { root: number; quality: Quality; name: string; tones: number[] }
/** A chord on a degree of the key (semitones over the key note) with its quality. */
type Step = readonly [number, Quality];
const pcOf = (m: number): number => ((m % 12) + 12) % 12;
function chordOf(key: number, [deg, q]: Step): Chord {
  const root = pcOf(key + deg);
  return { root, quality: q, name: NAMES[root] + SUFFIX[q], tones: Q[q].map(i => pcOf(root + i)) };
}

const I: Step = [0, 'maj'], ii: Step = [2, 'min'], iii: Step = [4, 'min'], IV: Step = [5, 'maj'], V: Step = [7, 'maj'], vi: Step = [9, 'min'];
const iv: Step = [5, 'min'], bVI: Step = [8, 'maj'], bVII: Step = [10, 'maj'], III: Step = [4, 'maj'];

/** Verses (eight bars, a chord a bar): the canon, its cousins, the axis and the doo-wop turn. */
const VERSES: readonly (readonly Step[])[] = [
  [I, V, vi, iii, IV, I, IV, V],
  [I, iii, vi, V, IV, iii, ii, V],
  [vi, IV, I, V, vi, IV, ii, V],
  [I, V, vi, V, IV, iii, ii, V],
  [I, vi, IV, V, I, vi, ii, V],
];
/** Pre-choruses (four bars), climbing to the dominant. */
const PRES: readonly (readonly Step[])[] = [
  [IV, V, iii, vi], [ii, iii, IV, V], [IV, iii, ii, V], [vi, V, IV, V], [IV, V, vi, V],
];
/** Choruses (eight bars): the royal road into a cadence, the canon, the axis. */
const CHORUSES: readonly (readonly Step[])[] = [
  [IV, V, iii, vi, ii, V, I, I],
  [I, V, vi, iii, IV, I, IV, V],
  [vi, IV, I, V, vi, IV, V, V],
  [IV, V, iii, vi, IV, V, I, I],
  [I, III, vi, I, IV, I, ii, V],
];
/** Bridges (eight bars): the minor side, a borrowed minor four, the lift through the flat six and seven. */
const BRIDGES: readonly (readonly Step[])[] = [
  [vi, iii, IV, I, ii, iii, IV, V],
  [IV, iv, I, vi, ii, V, I, V],
  [bVI, bVII, I, vi, bVI, bVII, V, V],
];
/** C-Pop's loops (four bars, played twice): the royal road, the axis from the minor, the pop punk four. */
const LOOPS: readonly (readonly Step[])[] = [
  [IV, V, iii, vi], [vi, IV, I, V], [I, V, vi, IV], [vi, V, IV, V], [IV, V, vi, I],
];

/** A chord as a Mandopop arranger colours it: sevenths and added ninths on the stable chords, a suspended dominant before it resolves. */
function colour(s: Step, mood: CpopMood, kind: CpopKind, r: () => number, last: boolean): Step {
  const [deg, q] = s;
  const lush = mood === 'mandopop' ? (kind === 'rock' ? 0.35 : 0.75) : kind === 'future' ? 0.7 : 0.3;
  if (q === 'maj' && (deg === 0 || deg === 5) && r() < lush) return [deg, r() < 0.6 ? 'maj7' : 'add9'];
  if (q === 'min' && r() < lush * 0.8) return [deg, r() < 0.7 ? 'm7' : 'madd9'];
  if (q === 'maj' && deg === 7 && last && r() < 0.5) return [deg, 'dom7'];
  return s;
}

// ── melody ────────────────────────────────────────────────────────────────

/** A bar's rhythm: [sixteenth, length in sixteenths]. */
type Cell = ReadonlyArray<readonly [number, number]>;
/** A verse's bars, sung: syncopated, many starting after the beat. */
const VERSE_CELLS: readonly Cell[] = [
  [[2, 2], [4, 2], [6, 2], [8, 4], [12, 4]],
  [[0, 3], [3, 1], [4, 2], [6, 2], [8, 6], [14, 2]],
  [[0, 2], [2, 2], [4, 4], [10, 2], [12, 4]],
  [[1, 2], [3, 1], [4, 4], [8, 2], [10, 2], [12, 4]],
  [[0, 6], [6, 2], [8, 2], [10, 2], [12, 4]],
  [[2, 1], [3, 1], [4, 2], [6, 2], [8, 2], [10, 6]],
];
/** A chorus's bars: longer notes, the tune opening up. */
const CHORUS_CELLS: readonly Cell[] = [
  [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]],
  [[0, 6], [6, 2], [8, 8]],
  [[0, 2], [2, 2], [4, 4], [8, 4], [12, 2], [14, 2]],
  [[0, 4], [4, 4], [8, 6], [14, 2]],
  [[0, 3], [3, 3], [6, 2], [8, 8]],
];
/** A China-wind hook's bars: dotted figures, a run of two sixteenths, a held note to ornament. */
const HOOK_CELLS: readonly Cell[] = [
  [[0, 3], [3, 1], [4, 2], [6, 2], [8, 3], [11, 1], [12, 4]],
  [[0, 2], [2, 1], [3, 1], [4, 4], [8, 2], [10, 2], [12, 4]],
  [[0, 6], [6, 1], [7, 1], [8, 4], [12, 2], [14, 2]],
  [[0, 4], [4, 2], [6, 1], [7, 1], [8, 8]],
];
/** A dance break's riff: busy sixteenths, the tresillo, repeated notes. */
const RIFF_CELLS: readonly Cell[] = [
  [[0, 2], [2, 2], [4, 1], [5, 1], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
  [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]],
  [[0, 2], [3, 2], [6, 2], [8, 1], [9, 1], [10, 2], [12, 4]],
  [[0, 3], [3, 1], [4, 2], [6, 1], [7, 1], [8, 3], [11, 1], [12, 2], [14, 2]],
];
/** A phrase's last bar: a long note and room to breathe. */
const END_CELLS: readonly Cell[] = [[[0, 8]], [[0, 4], [4, 8]], [[0, 2], [2, 2], [4, 10]], [[0, 12]]];

/** The lead's range: the composer's lead register, which every lead instrument plays. */
const LEAD_LO = 64, LEAD_HI = 84;
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];

interface Tone { step: number; len: number; midi: number; bend: boolean }

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

/**
 * A phrase of the tune: each bar's rhythm, its pitches walking the scale (a pentatonic
 * for a China-wind hook, the major scale with the pentatonic leaned on for a sung line)
 * along an arch towards `peak`, a chord tone on every strong beat and on the phrase's
 * last note, never the same note three times running. Long notes and the peak are marked
 * to be ornamented (`ornament` of them).
 */
function phrase(rng: () => number, cells: readonly Cell[], chords: readonly Chord[], key: number, penta: boolean, lo: number, hi: number, start: number, peak: number, ornament: number): Tone[][] {
  const scale = (penta ? PENTA : MAJOR_SCALE).map(i => pcOf(key + i));
  const ladder: number[] = [];
  for (let p = lo; p <= hi; p++) if (scale.includes(pcOf(p))) ladder.push(p);
  const near = (p: number): number => ladder.reduce((b, x, i) => (Math.abs(x - p) < Math.abs(ladder[b]! - p) ? i : b), 0);
  let at = near(start);
  const count = cells.reduce((s, c) => s + c.length, 0);
  const peakAt = 0.35 + rng() * 0.3;
  const out: Tone[][] = [];
  let k = 0, was = -1, wasBefore = -1;
  const isTone = (c: Chord, i: number): boolean => c.tones.includes(pcOf(ladder[i]!));
  cells.forEach((cell, b) => {
    const chord = chords[b % chords.length]!;
    const bar: Tone[] = [];
    cell.forEach(([step, len], n) => {
      const progress = count > 1 ? k / (count - 1) : 0;
      k++;
      const want = progress < peakAt ? start + (peak - start) * (progress / peakAt) : peak + (start - 2 - peak) * ((progress - peakAt) / (1 - peakAt));
      const target = near(want);
      const move = Math.max(-2, Math.min(2, Math.round((target - at) * 0.6 + [-1, 0, 0, 1][Math.floor(rng() * 4)]!)));
      // A sung line leans on the pentatonic: a fourth or a seventh only in passing.
      at = Math.max(0, Math.min(ladder.length - 1, at + move));
      const leans = step === 0 || step === 8 || (b === cells.length - 1 && n === cell.length - 1);
      if (!penta && !leans && !PENTA.map(i => pcOf(key + i)).includes(pcOf(ladder[at]!)) && len >= 3) {
        const alt = at + (target >= at ? 1 : -1);
        if (alt >= 0 && alt < ladder.length) at = alt;
      }
      if (leans && !isTone(chord, at)) {
        const up = ladder.findIndex((_, i) => i > at && isTone(chord, i));
        const down = [...ladder.keys()].reverse().find(i => i < at && isTone(chord, i));
        at = up >= 0 && (down === undefined || target >= at) ? up : down ?? at;
      }
      if (at === was && was === wasBefore) {
        const other = target >= at ? ladder.findIndex((_, i) => i > at && (!leans || isTone(chord, i))) : [...ladder.keys()].reverse().find(i => i < at && (!leans || isTone(chord, i)));
        if (other !== undefined && other >= 0) at = other;
      }
      wasBefore = was;
      was = at;
      const bend = len >= 4 && rng() < ornament;
      bar.push({ step, len, midi: ladder[at]!, bend });
    });
    out.push(bar);
  });
  return out;
}

/** A phrase moved onto other chords: each strong note to the nearest tone of its bar's chord. */
function refit(bars: readonly Tone[][], chords: readonly Chord[], lo: number, hi: number): Tone[][] {
  return bars.map((bar, b) => bar.map((t, n) => {
    const chord = chords[b % chords.length]!;
    const leans = t.step === 0 || t.step === 8 || (b === bars.length - 1 && n === bar.length - 1);
    if (!leans || chord.tones.includes(pcOf(t.midi))) return t;
    let best = t.midi, gap = 99;
    for (let p = Math.max(lo, t.midi - 4); p <= Math.min(hi, t.midi + 4); p++) {
      if (chord.tones.includes(pcOf(p)) && Math.abs(p - t.midi) < gap) { best = p; gap = Math.abs(p - t.midi); }
    }
    return { ...t, midi: best };
  }));
}

// ── the song ──────────────────────────────────────────────────────────────

type Part = 'intro' | 'verse' | 'pre' | 'chorus' | 'interlude' | 'dance' | 'bridge' | 'lift' | 'outro';
interface Plan { part: Part; bars: number; time: number; up?: boolean }

const SECTION_OF: Record<Part, LofiSection> = {
  intro: 'intro', verse: 'verse', pre: 'build', chorus: 'drop', interlude: 'feature', dance: 'feature', bridge: 'bridge', lift: 'build', outro: 'outro',
};

/** A tune's running order. */
function arrangeCpop(mood: CpopMood, lift: boolean): Plan[] {
  const p: Plan[] = [];
  if (mood === 'mandopop') {
    p.push({ part: 'intro', bars: 4, time: 0 });
    p.push({ part: 'verse', bars: 8, time: 0 });
    p.push({ part: 'pre', bars: 4, time: 0 });
    p.push({ part: 'chorus', bars: 8, time: 0 });
    p.push({ part: 'interlude', bars: 4, time: 0 });
    p.push({ part: 'verse', bars: 8, time: 1 });
    p.push({ part: 'pre', bars: 4, time: 1 });
    p.push({ part: 'chorus', bars: 8, time: 1 });
    p.push({ part: 'bridge', bars: 8, time: 0 });
    p.push({ part: 'lift', bars: 2, time: 0 });
    p.push({ part: 'chorus', bars: 8, time: 2, up: lift });
    p.push({ part: 'outro', bars: 4, time: 0, up: lift });
    return p;
  }
  p.push({ part: 'intro', bars: 4, time: 0 });
  p.push({ part: 'verse', bars: 8, time: 0 });
  p.push({ part: 'pre', bars: 4, time: 0 });
  p.push({ part: 'chorus', bars: 8, time: 0 });
  p.push({ part: 'dance', bars: 8, time: 0 });
  p.push({ part: 'verse', bars: 8, time: 1 });
  p.push({ part: 'pre', bars: 4, time: 1 });
  p.push({ part: 'chorus', bars: 8, time: 1 });
  p.push({ part: 'dance', bars: 8, time: 1 });
  p.push({ part: 'bridge', bars: 8, time: 0 });
  p.push({ part: 'lift', bars: 4, time: 0 });
  p.push({ part: 'chorus', bars: 8, time: 2, up: lift });
  p.push({ part: 'dance', bars: 8, time: 2, up: lift });
  p.push({ part: 'outro', bars: 4, time: 0, up: lift });
  return p;
}

/** The tempo ranges (beats a minute) of each kind. */
const TEMPO: Record<CpopKind, readonly [number, number]> = {
  ballad: [66, 78], rnb: [76, 92], rock: [84, 100], dance: [118, 128], trap: [94, 108], future: [120, 128],
};

/** The traditional instruments a hook may be on, by genre (weights). */
const HOOK_LEADS: Record<CpopMood, ReadonlyArray<readonly [LofiStyle['lead'], number]>> = {
  mandopop: [['erhu', 4], ['dizi', 3], ['pipa', 2], ['zheng', 1]],
  cpop: [['dizi', 4], ['erhu', 3], ['pipa', 2]],
};

const clamp = (v: number): number => Math.max(0.05, Math.min(1, v));

/** One Mandopop or C-Pop tune's bars (see the module's note). `fixed` holds the music generator's own picks. */
export function composeCpop(seed: number, mood: CpopMood, fixed: Partial<LofiStyle>, deps: CpopDeps): LofiBar[] {
  const rng = mulberry32((seed ^ (mood === 'mandopop' ? 0x3a0d0 : 0xc909)) >>> 0);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
  const chance = (p: number): boolean => rng() < p;
  const weighted = <T>(w: ReadonlyArray<readonly [T, number]>): T => {
    let r = rng() * w.reduce((s, [, n]) => s + n, 0);
    for (const [v, n] of w) {
      r -= n;
      if (r < 0) return v;
    }
    return w[w.length - 1]![0];
  };
  const roll = rng();
  const kind: CpopKind = mood === 'mandopop'
    ? (roll < 0.45 ? 'ballad' : roll < 0.75 ? 'rnb' : 'rock')
    : (roll < 0.45 ? 'dance' : roll < 0.75 ? 'trap' : 'future');
  const [t0, t1] = TEMPO[kind];
  const bpm = Math.round(t0 + rng() * (t1 - t0));
  const key = Math.floor(rng() * 12);
  // Most Mandopop tunes are China wind; C-Pop's guochao hook is in every dance break.
  const wind = mood === 'cpop' || chance(0.7);
  const lift = mood === 'mandopop' ? chance(0.75) : chance(0.4);
  const liftBy = chance(0.6) ? 1 : 2;
  const swing = kind === 'rnb' ? 0.56 : kind === 'trap' ? 0.52 : 0.5;

  // The instruments: the genre's draw, set by the kind of tune, with the person's picks kept.
  const drawn = deps.drawStyle(rng);
  const hook = weighted(HOOK_LEADS[mood]);
  const kindKeys: LofiStyle['keys'] = kind === 'ballad' ? 'grand' : kind === 'rnb' ? (chance(0.6) ? 'rhodes' : 'grand') : kind === 'rock' ? 'steel'
    : kind === 'future' ? 'pluck' : chance(0.5) ? 'pluck' : 'supersaw';
  const kindBass: LofiStyle['bass'] = kind === 'ballad' ? (chance(0.6) ? 'round' : 'upright') : kind === 'rnb' ? (chance(0.6) ? 'eight' : 'motown')
    : kind === 'rock' ? 'picked' : kind === 'dance' ? (chance(0.6) ? 'synth' : 'eight') : 'eight';
  const kindSnare: LofiStyle['snare'] = kind === 'ballad' ? 'snare' : kind === 'rnb' ? (chance(0.5) ? 'snap' : 'clap') : kind === 'rock' ? 'snare' : kind === 'trap' ? (chance(0.5) ? 'clap' : 'snap') : kind === 'future' ? 'stack' : 'clap';
  // The sung line: in a China-wind tune a voice (sung chops) or the hook's instrument itself; otherwise the genre's drawn lead.
  const voiceLead: LofiStyle['lead'] = wind ? (chance(mood === 'cpop' ? 0.75 : 0.5) ? 'chop' : hook) : drawn.lead;
  const style: LofiStyle = {
    ...drawn, keys: kindKeys, bass: kindBass, snare: kindSnare, lead: voiceLead,
    groove: kind === 'dance' ? 'disco' : kind === 'trap' || kind === 'future' ? 'halfStep' : kind === 'rnb' ? 'boomBap' : 'rock',
    hats: kind === 'ballad' ? 'hat' : drawn.hats,
    ...fixed,
  };
  const chosenLead = !!fixed.lead;
  const lead = style.lead;
  // The traditional instrument's own sections (the hook, the interlude, the solo): the hook's instrument, unless a person chose the lead.
  const hookLead: LofiStyle['lead'] = chosenLead || !wind ? lead : hook;
  // The pad under a chorus: the string section in Mandopop, the future-bass chords or a pad in C-Pop.
  const padKeys: LofiStyle['keys'] = mood === 'mandopop' ? 'strings' : kind === 'future' ? 'future' : chance(0.5) ? 'supersaw' : 'pad';

  // The chords: a progression for each part, coloured once so a part sounds the same each time.
  const colourAll = (p: readonly Step[], k: number): Chord[] => p.map((s, i) => chordOf(k, colour(s, mood, kind, rng, i === p.length - 1)));
  const loopA = pick(LOOPS), loopB = pick(LOOPS);
  const verseP = mood === 'mandopop' ? pick(VERSES) : [...loopA, ...loopA];
  const preP = pick(PRES);
  const chorusP = mood === 'mandopop' ? pick(CHORUSES) : [...loopB, ...loopB];
  const bridgeP = pick(BRIDGES);
  // The lift holds the dominant of the key the last chorus is in: the new one, when it rises.
  const landing = lift ? pcOf(key + liftBy) : key;
  const liftChords = [chordOf(landing, [7, 'sus4']), chordOf(landing, [7, 'dom7']), chordOf(landing, [7, 'sus4']), chordOf(landing, [7, 'dom7'])];
  const progs = (k: number): Record<Part, Chord[]> => {
    const verse = colourAll(verseP, k), pre = colourAll(preP, k), chorus = colourAll(chorusP, k), bridge = colourAll(bridgeP, k);
    return { intro: chorus.slice(0, 4), verse, pre, chorus, interlude: chorus.slice(0, 4), dance: chorus, bridge, lift: liftChords, outro: chorus.slice(0, 4) };
  };
  const home = progs(key);
  const lifted = progs(pcOf(key + liftBy));
  const minorish = verseP[0]![0] === 9 && chorusP[0]![0] === 9;
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood, bpm, swing, swing8: 0.5, style,
    key: minorish ? `${NAMES[pcOf(key + 9)]} minor` : `${NAMES[key]} major`,
    progressions: [home.verse.map(c => c.name), home.chorus.map(c => c.name)],
    bars: 0,
  };

  // The tunes: the verse sung low, the chorus high, the hook pentatonic.
  const ornament = mood === 'mandopop' ? 0.4 : 0.3;
  const sung = (chords: readonly Chord[], cells: readonly Cell[], lo: number, hi: number, start: number, peak: number, k: number, penta: boolean): Tone[][] => {
    const half = chords.length / 2;
    const rhythm = cells.slice(0, half);
    const a = phrase(rng, rhythm, chords.slice(0, half), k, penta, lo, hi, start, peak, ornament);
    if (chords.length <= 4) return a;
    const lastA = a[a.length - 1]!;
    const b = refit(a.slice(0, half - 1), chords.slice(half, chords.length - 1), lo, hi);
    const end = phrase(rng, [pick(END_CELLS)], chords.slice(chords.length - 1), k, penta, lo, hi, lastA[lastA.length - 1]!.midi, start, ornament);
    return [...a, ...b, ...end];
  };
  const cellsOf = (pool: readonly Cell[], n: number, endWith = true): Cell[] => {
    const out = Array.from({ length: n }, () => pick(pool));
    if (endWith) out[n - 1] = pick(END_CELLS);
    // Phrases echo: the third bar answers the first with its rhythm.
    if (n >= 4) out[2] = out[0]!;
    return out;
  };
  const tunesFor = (p: Record<Part, Chord[]>, k: number): Record<Part, Tone[][]> => {
    const verseCells = cellsOf(VERSE_CELLS, 8);
    const chorusCells = cellsOf(CHORUS_CELLS, 8);
    const hookCells = cellsOf(mood === 'cpop' ? RIFF_CELLS : HOOK_CELLS, 4, false);
    const preCells = cellsOf(mood === 'cpop' ? VERSE_CELLS : CHORUS_CELLS, 4);
    const hookTune = phrase(rng, hookCells, p.interlude, k, true, 67, LEAD_HI, 74, 81, 0.45);
    return {
      intro: hookTune,
      verse: sung(p.verse, verseCells, LEAD_LO, 77, 67, 74, k, wind && chance(0.4)),
      pre: phrase(rng, preCells, p.pre, k, false, 67, 81, 71, 79, ornament),
      chorus: sung(p.chorus, chorusCells, 69, LEAD_HI, 74, 83, k, false),
      interlude: hookTune,
      dance: [...hookTune, ...refit(hookTune, p.dance.slice(4), 67, LEAD_HI)],
      bridge: phrase(rng, cellsOf(HOOK_CELLS, 8), p.bridge, k, true, 67, LEAD_HI, 72, 84, 0.5),
      lift: [],
      outro: hookTune,
    };
  };
  const tuneHome = tunesFor(home, key);
  const tuneUp = lift ? (() => {
    const t = tunesFor(lifted, pcOf(key + liftBy));
    // The last chorus is the chorus, lifted: the same tune moved up, kept in the lead's range.
    const up = (bars: readonly Tone[][], chords: readonly Chord[]): Tone[][] => refit(bars.map(b => b.map(n => ({ ...n, midi: n.midi + liftBy > LEAD_HI ? n.midi + liftBy - 12 : n.midi + liftBy }))), chords, LEAD_LO, LEAD_HI);
    return { ...t, chorus: up(tuneHome.chorus, lifted.chorus), dance: up(tuneHome.dance, lifted.dance), outro: up(tuneHome.outro, lifted.outro) };
  })() : tuneHome;

  const plan = arrangeCpop(mood, lift);
  const total = plan.reduce((s, p) => s + p.bars, 0) + 1;
  info.bars = total;
  const sb = (step: number): number => {
    let beat = step / 4;
    if (step % 2 === 1) beat += (swing - 0.5) * 0.5;
    return beat;
  };
  const tanggu = deps.perc('tanggu'), gong = deps.perc('gong'), woodblock = deps.perc('woodblock'), shaker = deps.perc('shaker');
  // The tune's drummer: how busy the ballad's verse is, the R&B's kick figure, the trap hats' roll rate.
  const kickFigure = pick([[0, 7, 10], [0, 6, 10, 11], [0, 3, 8, 10], [0, 10]] as const);
  const verseBrushed = chance(0.5);
  const rolls = kind === 'trap' ? 0.55 : kind === 'rnb' ? 0.25 : 0.12;

  const bars: LofiBar[] = [];
  let index = 0;
  let voicing: number[] = [];
  for (let pi = 0; pi < plan.length; pi++) {
    const part = plan[pi]!;
    const next = plan[pi + 1];
    const chords = (part.up ? lifted : home)[part.part];
    const tune = (part.up ? tuneUp : tuneHome)[part.part];
    const section = SECTION_OF[part.part];
    for (let i = 0; i < part.bars; i++, index++) {
      const chord = chords[i % chords.length]!;
      const lastOfPart = i === part.bars - 1;
      const notes: LofiNote[] = [];
      const add = (voice: LofiNote['voice'], step: number, vel: number, midi = 0, dur = 0, mod?: number): void => {
        notes.push({ voice, beat: sb(step), dur, midi, vel: clamp(vel + (rng() - 0.5) * 0.06), ...(mod === undefined ? {} : { mod }) });
      };
      const percHit = (kind2: number, stroke: number, step: number, vel: number): void => {
        notes.push({ voice: 'perc', midi: stroke, dur: 0, beat: sb(step), vel: clamp(vel), mod: kind2 });
      };
      const loud = part.part === 'chorus' || part.part === 'dance';
      const intoChorus = lastOfPart && (next?.part === 'chorus');
      const voices: NonNullable<LofiBar['voices']> = {};
      const layers = new Set<LofiLayer>();

      // THE TUNE: the sung line, the hook or the solo; the lift breathes.
      const line = tune[i % Math.max(1, tune.length)];
      const onHook = part.part === 'intro' || part.part === 'interlude' || part.part === 'dance' || part.part === 'bridge' || part.part === 'outro';
      if (onHook && hookLead !== lead) voices.lead = hookLead;
      // A guzheng run into a chorus: the zither sweeps up its pentatonic in the pre-chorus's last bar.
      const zhengRun = wind && intoChorus && part.part === 'pre' && !chosenLead && chance(mood === 'cpop' ? 0.7 : 0.55);
      if (line && !(part.part === 'outro' && i >= 2 && chance(0.5))) {
        layers.add('lead');
        const lineVel = loud ? 0.8 : part.part === 'verse' ? 0.62 : 0.7;
        for (const t of line) {
          if (zhengRun && t.step >= 8) continue;
          const dur = (t.len / 4) * (t.len <= 2 ? 0.85 : 0.94);
          add('lead', t.step, lineVel + (t.step % 8 === 0 ? 0.06 : 0), t.midi, dur, t.bend ? 1 : 0);
        }
      }
      if (zhengRun) {
        voices.lead = 'zheng';
        const scale = PENTA.map(s => pcOf(key + (part.up ? liftBy : 0) + s));
        const run: number[] = [];
        for (let p = 64; p <= 84 && run.length < 14; p++) if (scale.includes(pcOf(p))) run.push(p);
        // From the second half of the bar, two notes a sixteenth, up to the top; the beat's own note a chord tone.
        let st = 9;
        for (const p of run) {
          if (st > 15.5) break;
          const m = Number.isInteger(st) && st % 8 === 0 && !chord.tones.includes(pcOf(p)) ? place(chord.root, 64, 84, p) : p;
          notes.push({ voice: 'lead', beat: sb(Math.floor(st)) + (st % 1) / 4, dur: 0.18, midi: m, vel: clamp(0.5 + (st - 9) * 0.04) });
          st += 0.5;
        }
        layers.add('lead');
      }

      // THE KEYS: the piano's broken chords, the Rhodes's stabs, the acoustic strummed, the synths' plucks and stabs.
      const want = chord.tones.length > 3 ? [chord.tones[1]!, chord.tones[2]!, chord.tones[3]!] : [chord.root, chord.tones[1]!, chord.tones[2]!];
      const centre = voicing.length ? voicing.reduce((a, b) => a + b, 0) / voicing.length : 64;
      voicing = want.map(pc => place(pc, 55, 74, centre)).sort((a, b) => a - b);
      const keysV = style.keys;
      const quiet = part.part === 'intro' || part.part === 'outro' || part.part === 'bridge';
      const kv = loud ? 0.62 : quiet ? 0.5 : 0.55;
      const keysOn = !(mood === 'cpop' && part.part === 'dance' && kind === 'future');
      if (keysOn) {
        layers.add('keys');
        if (keysV === 'grand' || keysV === 'felt') {
          // A ballad's piano: the chord broken in eighths (or sixteenths in a chorus), the hands' shape kept.
          const pattern = loud ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 2, 4, 6, 8, 10, 12, 14];
          const order = [0, 1, 2, 1, 0, 1, 2, 1];
          const top = place(chord.root, 60, 76, voicing[2]! + 3);
          pattern.forEach((st, j) => {
            const v = j === 0 ? voicing : [voicing[order[j]! % voicing.length]!];
            for (const p of v) add('keys', st, kv * (j % 4 === 0 ? 1 : 0.82), p, 0.5);
          });
          if (loud) add('keys', 8, kv * 0.9, top, 1.6);
        } else if (keysV === 'rhodes' || keysV === 'wurli') {
          // R&B: the chord on the one, pushed into the "and" of two, a lighter touch on four.
          for (const [st, len, v] of [[0, 1.4, 1], [6, 0.9, 0.85], [12, 0.8, 0.7]] as const) for (const p of voicing) add('keys', st, kv * v, p, len);
        } else if (keysV === 'steel' || keysV === 'nylon') {
          // Strummed: down, down-up, up-down-up (the strummer picks the strings).
          for (const st of [0, 4, 6, 10, 12, 14]) for (const p of voicing) add('keys', st, kv * (st % 4 === 0 ? 1 : 0.78), p, 0.45);
        } else if (keysV === 'pluck' || keysV === 'chiparp') {
          // Plucks: the chord in rising sixteenths, as a dance-pop arpeggio.
          const notesUp = [...voicing, voicing[0]! + 12 <= 76 ? voicing[0]! + 12 : voicing[0]!];
          for (let st = 0; st < 16; st++) {
            if (!loud && st % 2 === 1) continue;
            add('keys', st, kv * (st % 4 === 0 ? 0.9 : 0.7), notesUp[st % notesUp.length]!, 0.22);
          }
        } else if (keysV === 'future') {
          // Future-bass chords: pumping on the beats, a bend into the drop's first.
          for (const st of [0, 4, 8, 12]) for (const p of voicing) add('keys', st, kv, p, 0.9, (st === 0 && i === 0 ? 16 : 0) + (loud ? 2 : 0));
        } else {
          // Supersaw and the rest: stabs on the off-beats, a held chord in the quiet parts.
          if (quiet || part.part === 'verse') for (const p of voicing) add('keys', 0, kv * 0.85, p, 3.8);
          else for (const st of [2, 6, 10, 14]) for (const p of voicing) add('keys', st, kv, p, 0.35);
        }
      }

      // THE PAD: the string section swelling through a Mandopop pre-chorus and under its chorus and bridge; C-Pop's pad or future chords under its chorus and dance break.
      const padHere = mood === 'mandopop'
        ? (part.part === 'pre' || part.part === 'chorus' || part.part === 'bridge' || part.part === 'lift' || (part.part === 'verse' && part.time === 1 && i >= 4))
        : (part.part === 'chorus' || part.part === 'dance' || part.part === 'bridge' || part.part === 'lift');
      if (padHere) {
        voices.pad = padKeys;
        const low = place(chord.root, 48, 59);
        const pad = [low, ...chord.tones.slice(1, 3).map(pc => place(pc, low + 3, low + 16))];
        const pv = part.part === 'pre' ? 0.35 + (i / Math.max(1, part.bars)) * 0.3 : loud ? 0.62 : 0.45;
        if (padKeys === 'future') {
          for (const st of [0, 4, 8, 12]) for (const p of pad) add('pad', st, pv, p, 0.95, (i === 0 && st === 0 ? 16 : 0) + 2);
        } else for (const p of pad) add('pad', 0, pv, p, 3.9);
      }

      // THE BASS.
      const bassRoot = place(chord.root, mood === 'cpop' ? 31 : 36, mood === 'cpop' ? 42 : 47);
      const fifth = place(chord.tones[2] ?? chord.root, bassRoot + 2, bassRoot + 9);
      const bassOn = !(part.part === 'intro' && i < 2) && !(part.part === 'outro' && i >= 2) && !(part.part === 'bridge' && mood === 'cpop' && i < 4);
      if (bassOn) {
        layers.add('bass');
        const bv = loud ? 0.82 : 0.68;
        const nextRoot = chords[(i + 1) % chords.length]!.root;
        if (style.bass === 'eight') {
          // An 808: long notes on the kick's figure, sliding to the next chord's root at the bar's end.
          const fig = kind === 'trap' || kind === 'future' ? [0, 7, 10] : [...kickFigure];
          fig.forEach((st, j) => { add('bass', st, bv * (j ? 0.85 : 1), bassRoot, ((fig[j + 1] ?? 16) - st) / 4 * 0.9, 0); });
          if (loud && chance(0.4)) add('bass', 14, bv * 0.8, place(nextRoot, 31, 47, bassRoot), 0.4, 2);
        } else if (style.bass === 'synth' || style.bass === 'pulse') {
          // Dance-pop: octave eighths under four on the floor.
          for (let st = 0; st < 16; st += 2) add('bass', st, bv * (st % 4 === 0 ? 1 : 0.8), st % 4 === 2 && bassRoot + 12 <= 64 ? bassRoot + 12 : bassRoot, 0.4);
        } else if (style.bass === 'picked') {
          for (let st = 0; st < 16; st += 2) add('bass', st, bv * (st % 8 === 0 ? 1 : 0.78), st === 12 ? fifth : bassRoot, 0.45);
        } else {
          // A ballad's bass: the root held, the fifth on three in a chorus, a step into the next chord.
          add('bass', 0, bv, bassRoot, loud ? 1.8 : 3.6);
          if (loud) add('bass', 8, bv * 0.85, fifth, 1.6);
          if (pcOf(nextRoot - chord.root) !== 0 && chance(0.4)) {
            const target = place(nextRoot, bassRoot - 7, bassRoot + 7, bassRoot);
            add('bass', 14, bv * 0.75, target + (target > bassRoot ? -1 : 1), 0.45);
          }
        }
      }

      // THE DRUMS, as each kind plays them.
      // A ballad's first verse opens on the piano and the voice alone; the cross-stick comes in halfway.
      const drums = !(part.part === 'intro' && (mood === 'mandopop' ? i < 2 || kind === 'ballad' : false)) && !(part.part === 'outro' && i >= 2) && !(part.part === 'bridge' && i < 4)
        && !(kind === 'ballad' && part.part === 'verse' && part.time === 0 && i < 4);
      const firstBarOf = i === 0;
      if (drums) {
        layers.add('kick'); layers.add('snare'); layers.add('hats');
        const lastBarFill = lastOfPart && (next?.part === 'chorus' || next?.part === 'dance');
        if (kind === 'ballad' || kind === 'rock') {
          const verse = part.part === 'verse' || part.part === 'intro';
          if (verse && part.time === 0 && kind === 'ballad') {
            // The first verse: a cross-stick on two and four, the kick on one, the hats light.
            add('kick', 0, 0.55);
            if (verseBrushed) { add('rim', 4, 0.5); add('rim', 12, 0.5); } else { add('rim', 12, 0.5); }
            for (let st = 0; st < 16; st += 4) add('hat', st, 0.28, 0, 0, 1);
          } else {
            add('kick', 0, 0.8); add('kick', kind === 'rock' ? 8 : 10, 0.62);
            if (loud || kind === 'rock') add('kick', kind === 'rock' ? 6 : 8, 0.55);
            add('snare', 4, loud ? 0.82 : 0.66); add('snare', 12, loud ? 0.85 : 0.68);
            for (let st = 0; st < 16; st += 2) add('hat', st, st % 4 === 0 ? 0.42 : 0.3, 0, 0, st % 4 === 0 ? 0 : 1);
            if (loud && i % 4 === 3) add('openHat', 14, 0.4);
          }
          if (lastBarFill) for (const [st, m] of [[8, 50], [10, 47], [12, 45], [14, 40]] as const) add('tom', st, 0.6 + st * 0.015, m);
          if (firstBarOf && (part.part === 'chorus' || part.part === 'bridge')) add('crash', 0, 0.7);
        } else if (kind === 'rnb') {
          // R&B: the kick's syncopated figure, snaps or a clap on two and four, swung sixteenth hats that roll now and then.
          for (const st of kickFigure) add('kick', st, st === 0 ? 0.82 : 0.66);
          add('snare', 4, 0.75); add('snare', 12, 0.78);
          for (let st = 0; st < 16; st++) {
            if (!loud && st % 2 === 1) continue;
            add('hat', st, st % 4 === 0 ? 0.4 : 0.26, 0, 0, st % 2 ? 1 : 0);
          }
          if (chance(rolls) && part.part !== 'intro') for (let r = 0; r < 4; r++) notes.push({ voice: 'hat', beat: 3.5 + r / 8, dur: 0, midi: 0, vel: 0.3 + r * 0.04, mod: 1 });
          if (i % 2 === 1) add('openHat', 14, 0.35);
          if (lastBarFill) for (const st of [12, 13, 14, 15]) add('snare', st, 0.45 + (st - 12) * 0.1);
          if (firstBarOf && part.part === 'chorus') add('crash', 0, 0.6);
        } else if (kind === 'dance') {
          // Four on the floor, a clap on two and four, the open hat on every off-beat, sixteenths in the chorus.
          const build = part.part === 'pre' || part.part === 'lift';
          if (build) {
            const every = lastOfPart ? 1 : i >= part.bars / 2 ? 2 : 4;
            for (let st = 0; st < 16; st += every) add('snare', st, 0.4 + ((i + st / 16) / part.bars) * 0.45, 0, 0, Math.min(7, Math.floor(((i + st / 16) / part.bars) * 8)));
            if (!lastOfPart) for (const st of [0, 4, 8, 12]) add('kick', st, 0.75);
            if (i === 0) notes.push({ voice: 'riser', midi: 60, dur: part.bars * 4 - 0.5, beat: 0, vel: 0.75 });
          } else {
            for (const st of [0, 4, 8, 12]) add('kick', st, 0.86);
            add('snare', 4, 0.78); add('snare', 12, 0.8);
            for (const st of [2, 6, 10, 14]) add('openHat', st, loud ? 0.45 : 0.35);
            if (loud) for (let st = 1; st < 16; st += 2) add('hat', st, 0.25, 0, 0, 1);
          }
          if (firstBarOf && (part.part === 'chorus' || part.part === 'dance')) add('crash', 0, 0.85);
        } else {
          // Trap and future bass: half-time, the clap on three, the kick around it, hats in sixteenths that roll.
          const build = part.part === 'pre' || part.part === 'lift';
          if (build) {
            const every = lastOfPart ? 1 : 2;
            for (let st = 0; st < 16; st += every) add('snare', st, 0.38 + ((i + st / 16) / part.bars) * 0.45, 0, 0, Math.min(7, Math.floor(((i + st / 16) / part.bars) * 8)));
            if (i === 0) notes.push({ voice: 'riser', midi: 60, dur: part.bars * 4 - 0.5, beat: 0, vel: 0.75 });
          } else {
            add('kick', 0, 0.86); add('kick', 7, 0.6); if (chance(0.5)) add('kick', 10, 0.62);
            add('snare', 8, 0.82);
            if (loud && chance(0.3)) add('snare', 15, 0.4);
            for (let st = 0; st < 16; st += 2) add('hat', st, st % 4 === 0 ? 0.38 : 0.28, 0, 0, st % 4 === 0 ? 0 : 1);
            // A roll: a beat of thirty-seconds, or of triplet sixteenths.
            if (chance(rolls)) {
              const at = pick([1, 2, 3]) as number;
              const n = chance(0.5) ? 8 : 6;
              for (let r = 0; r < n; r++) notes.push({ voice: 'hat', beat: at + r / n, dur: 0, midi: 0, vel: 0.26 + r * 0.02, mod: 1 });
            }
          }
          if (firstBarOf && (part.part === 'chorus' || part.part === 'dance')) add('crash', 0, 0.85);
        }
      }

      // CHINA WIND's percussion: the tanggu and a gong on a chorus or a drop's first beat, a woodblock in the verses, a shaker in the R&B.
      if (wind) {
        if (firstBarOf && (part.part === 'chorus' || part.part === 'dance' || (part.part === 'bridge' && mood === 'mandopop'))) { percHit(tanggu, 1, 0, 0.8); percHit(gong, 1, 0, part.part === 'bridge' ? 0.5 : 0.65); }
        if (part.part === 'verse' && kind !== 'dance' && i % 2 === 1) { percHit(woodblock, 1, 6, 0.42); percHit(woodblock, 2, 14, 0.38); }
        if (intoChorus) for (const st of [12, 13, 14, 15]) percHit(tanggu, st === 15 ? 2 : 1, st, 0.45 + (st - 12) * 0.1);
      }
      if (kind === 'rnb' && loud) for (let st = 2; st < 16; st += 4) percHit(shaker, 1, st, 0.25);

      // The lift's held dominant breathes: everything stops on its last beat but the tanggu.
      if (part.part === 'lift' && lastOfPart) {
        for (let n = notes.length - 1; n >= 0; n--) if (notes[n]!.beat >= 3 && notes[n]!.voice !== 'perc' && notes[n]!.voice !== 'riser') notes.splice(n, 1);
      }

      if (voices.lead === lead) delete voices.lead;
      if (notes.some(n => n.voice === 'riser' || n.voice === 'crash')) layers.add('fx');
      const open = part.part === 'intro' ? 0.6 + 0.35 * (i / part.bars) : part.part === 'outro' ? 0.9 - 0.3 * (i / part.bars) : 1;
      // The song's arc: the verses held back, the pre-chorus climbing, the chorus full; the outro fades.
      const arc: Partial<Record<Part, number>> = mood === 'mandopop'
        ? { intro: 0.8, verse: part.time ? 0.86 : 0.78, pre: 0.86 + 0.12 * (i / part.bars), interlude: 0.88, bridge: 0.86, lift: 0.95 }
        : { intro: 0.85, verse: 0.86, pre: 0.88 + 0.1 * (i / part.bars), bridge: 0.8, lift: 0.9 + 0.1 * (i / part.bars) };
      const level = part.part === 'outro' ? 1 - 0.55 * (i / part.bars) : arc[part.part] ?? 1;
      bars.push({
        tune: info, index, section, layers: [...layers], chord: chord.name, tones: chord.tones, notes,
        open, level, ...(Object.keys(voices).length ? { voices } : {}),
      });
    }
  }
  bars.push({ tune: info, index: total - 1, section: 'rest', layers: [], chord: '', tones: [], notes: [], open: 0.6, level: 0 });
  return bars;
}
