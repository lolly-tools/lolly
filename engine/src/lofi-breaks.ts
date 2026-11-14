// SPDX-License-Identifier: MPL-2.0
/**
 * The break engine: breakbeat's drums, and drum and bass's top loop. A breakbeat producer
 * samples a drummer's two bars, cuts them into slices and plays the slices back in a new
 * order: a beat swapped for another, a slice stuttered, the snare rolled and pitched up
 * into a phrase, the kick dropped out for a beat, the ghost notes never quite the same.
 * This writes those bars as notes. The shell plays every note marked as a break's (its
 * `mod` at LOFI_BREAK or over) on a real acoustic kit sped up as a sampled break is,
 * through the break's filters (lib/lofi-breaks.ts).
 *
 * The source breaks below are written for Lolly: a funk drummer's vocabulary (a kick on
 * one and pushed off the beat, the snare on two and four, ghost notes around it, eighth or
 * sixteenth hats with an open hat to lift the bar), never a famous break's notes.
 *
 * Every draw comes from the caller's own stream, so a tune's other parts never move.
 */
import type { LofiNote, LofiSection } from './lofi-compose.ts';

/** A drum note's `mod` at or over this is a break's: the shell plays it on the break's kit. */
export const LOFI_BREAK = 64;
/** A break note's `mod` is this plus the semitones its slice is pitched (-24 to 24). */
const BREAK_PITCH = 96;
const BREAK_DRUMS = new Set<LofiNote['voice']>(['kick', 'snare', 'rim', 'hat', 'openHat', 'tom']);
/** Whether a note is a break's (played on the break's kit). */
export const isBreakNote = (n: LofiNote): boolean => (n.mod ?? 0) >= LOFI_BREAK && BREAK_DRUMS.has(n.voice);
/** The semitones a break note's slice is pitched. */
export const breakPitch = (n: LofiNote): number => (n.mod ?? BREAK_PITCH) - BREAK_PITCH;

/**
 * A source break: two bars of sixteenths for the kick, the snare and the hats.
 * Kick: X hard, x full, o soft. Snare: X the backbeat, x a full stroke, g a ghost note.
 * Hats: X an accent, x a stroke, l a light one between, o the hat opened.
 */
interface Source { k: string; s: string; h: string }
const SOURCES: readonly Source[] = [
  { k: 'X......x..x.....X.x.......x..o..', s: '....X....g..X..g....X.g....gX.g.', h: 'X.x.x.x.X.x.x.o.X.x.x.o.X.x.x.x.' },
  { k: 'X..x.......x....X.....x.......x.', s: '....X..g..g.X.g...g.X....g.g.X..', h: 'XlxlxlxlXlxlxlolXlxlxlxlXlxlxlxl' },
  { k: 'X.x........x....X....x....x....o', s: '....X.g..g..X.g....gX.......Xgx.', h: 'X.x.x.x.X.o.x.x.X.x.x.x.X.x.x...' },
  { k: 'X..x..x...x.....X.x....o...x....', s: '....X.......X.g.....X....g..X..g', h: 'XlxlXlxlXlxlXlxlXlxlXlxlXlxlXlol' },
  { k: 'X........x.x....X..x.........x..', s: '..g.X..g....X.gg....X.g...g.X...', h: 'X.x.X.x.X.x.X.x.X.x.X.x.X.x.X.o.' },
  { k: 'X.o....x.....x..X.....x...xo....', s: '....Xg....g.X..g.g..X....g..X.g.', h: 'XlxlxlxlXlxlxlxlXlxlxlxlXlxlxlol' },
];

/** The edits a bar can take, and how a phrase's last bar turns. */
type Edit = 'none' | 'swap' | 'stutter' | 'half' | 'pitch' | 'drop';
type Turn = 'roll' | 'stutter' | 'swap' | 'drop' | 'pitchRoll';

/** One tune's break: its source, a second break it borrows beats from, and how edited it is. */
export interface BreakPlan {
  main: Source;
  other: Source;
  /** How often a bar in the middle of a phrase is edited (0 to 1). */
  edits: number;
  /** Sixteenth hats through the drops, in place of the source's. */
  busyHats: boolean;
  /** How the tune's phrases turn, in its own order. */
  turns: readonly Turn[];
  /** Bars between the phrase's big turns (8 in a breakbeat, whose producers loop their break
   *  and edit it at the end of a phrase; 4 in drum and bass's top loop, edited all the time). */
  turnEvery: 2 | 4 | 8;
  /** Whether the ghost notes are drawn afresh every bar, or kept as the sample has them. */
  fresh: boolean;
  /** The sample's ghost notes that sound, and one more the drummer played in each of the sample's two bars. */
  keep: readonly boolean[];
  extra: readonly [number, number];
}

/** A tune's break plan, from its own stream. */
export function breakPlan(r: () => number, edits: number, how: { turnEvery: 2 | 4 | 8; fresh: boolean } = { turnEvery: 8, fresh: false }): BreakPlan {
  const a = Math.floor(r() * SOURCES.length);
  let b = Math.floor(r() * (SOURCES.length - 1));
  if (b >= a) b++;
  const all: Turn[] = ['roll', 'stutter', 'swap', 'drop', 'pitchRoll'];
  const order = all.map(t => [t, r()] as const).sort((x, y) => x[1] - y[1]).map(([t]) => t);
  // A top loop's turns are the snare's: rolls, a pitched roll and a stutter.
  const turns = how.fresh ? order.filter(t => t !== 'swap' && t !== 'drop') : order.slice(0, 3);
  const busyHats = r() < 0.5;
  const keep = Array.from({ length: 32 }, () => r() < 0.8);
  const ghostAt = (): number => [1, 3, 7, 9, 11, 13][Math.floor(r() * 6)]!;
  return { main: SOURCES[a]!, other: SOURCES[b]!, edits, busyHats, turns, turnEvery: how.turnEvery, fresh: how.fresh, keep, extra: [ghostAt(), ghostAt()] };
}

/** A slice of the break: where in the two bars it is read from, or -1 for silence. */
type Seq = number[];

/** Where the break bar is, and what it plays. */
export interface BreakAt {
  section: LofiSection;
  /** Bars into the section, and the section's length. */
  inSection: number;
  bars: number;
  /** The layers the bar has (kick, snare, hats). */
  kick: boolean; snare: boolean; hats: boolean;
  lastOfBuild: boolean;
  /** How loud the break plays (1 the main kit; a top loop under another kit plays quieter). */
  level: number;
  /** A sixteenth of the bar as a beat, with the tune's swing. */
  sb: (step: number) => number;
}

/** The velocity of a kick, snare or hat mark. */
const VEL: Record<string, number> = { X: 0.95, x: 0.78, o: 0.5, g: 0.24, l: 0.3 };

/**
 * One bar of the break. The bar reads its source's first or second bar in turn, so the
 * break loops its two bars as a sampled break does; in the middle of a phrase it is now and
 * then edited (a beat swapped for one from the other break, a slice stuttered, the first
 * half again, a beat pitched, the kick dropped), and the phrase's last bar turns (a snare
 * roll, pitched up as it climbs, a stutter, a swap, the kick dropped out), with a drag on
 * the snare to end each four bars between. The ghost notes are the sample's (or, in a top
 * loop, played afresh every bar). A build's break thins to the snare and hats and rolls
 * into the drop; its last half beat is a breath.
 *
 * The produced breakbeat records measured (docs/generated-music.md) loop a one- or two-bar
 * break with edits at the phrase ends: under one bar in five differs from the bar before.
 */
export function breakBar(plan: BreakPlan, r: () => number, at: BreakAt): LofiNote[] {
  const { section, inSection, sb } = at;
  // The sample's first bar loops; its second bar is the variation that ends each eight bars
  // (a top loop plays the two in turn).
  const half = plan.fresh ? inSection % 2 : inSection % 8 === 7 ? 1 : 0;
  const seq: Seq = Array.from({ length: 16 }, (_, s) => half * 16 + s);
  const pitch = new Array<number>(16).fill(0);
  const borrowed = new Array<boolean>(16).fill(false);
  const build = section === 'build';
  const phraseEnd = inSection % plan.turnEvery === plan.turnEvery - 1;
  const fourth = inSection % 4 === 3 && !phraseEnd;
  const quiet = section === 'intro' || section === 'outro' || section === 'verse';
  // The mid-phrase edits (never on the bar a section or an eight-bar phrase opens with).
  const edit: Edit = build || phraseEnd || inSection % 8 === 0 || r() >= plan.edits * (quiet ? 0.5 : 1) ? 'none'
    : (['swap', 'swap', 'stutter', 'half', 'pitch', 'drop'] as const)[Math.floor(r() * 6)]!;
  if (edit === 'swap') {
    const beat = 1 + Math.floor(r() * 3);
    const from = Math.floor(r() * 8);
    for (let j = 0; j < 4; j++) { seq[beat * 4 + j] = from * 4 + j; borrowed[beat * 4 + j] = true; }
  } else if (edit === 'stutter') {
    const st = [8, 10, 12][Math.floor(r() * 3)]!;
    for (let s = st + 2; s < 16; s++) seq[s] = seq[st + ((s - st) % 2)]!;
  } else if (edit === 'half') {
    for (let s = 8; s < 16; s++) seq[s] = seq[s - 8]!;
  } else if (edit === 'pitch') {
    const beat = 1 + Math.floor(r() * 3);
    const by = [-5, -3, 2, 3, 5][Math.floor(r() * 5)]!;
    for (let j = 0; j < 4; j++) pitch[beat * 4 + j] = by;
  }
  // A dropped kick leaves one beat (the second or the third) without its kick drum.
  const dropBeat = edit === 'drop' ? 1 + Math.floor(r() * 2) : -1;
  // The phrase's turn, in its last bar.
  let roll: { from: number; per: number; climb: number } | null = null;
  if (phraseEnd && !build && section !== 'intro') {
    const turn = plan.turns[Math.floor(inSection / 4) % plan.turns.length]!;
    if (turn === 'roll') roll = { from: 12, per: 2, climb: 0 };
    else if (turn === 'pitchRoll') roll = { from: 8, per: 2, climb: 7 };
    else if (turn === 'stutter') for (let s = 12; s < 16; s++) seq[s] = seq[12]!;
    else if (turn === 'swap') for (let s = 8; s < 16; s++) { seq[s] = (1 - half) * 16 + s - 8; borrowed[s] = true; }
    else if (turn === 'drop') for (let s = 8; s < 16; s++) if (s % 4 !== 0) seq[s] = -1;
  }
  if (build) {
    // A build's roll: eighths, then sixteenths, then thirty-seconds in its last bar, louder and higher.
    const left = at.bars - inSection;
    const per = left > at.bars / 2 ? 4 : left > 1 ? 2 : 1;
    roll = { from: 0, per: per * 2, climb: Math.round((inSection / Math.max(1, at.bars)) * 12) };
  }
  const out: LofiNote[] = [];
  const mark = (voice: LofiNote['voice'], beat: number, vel: number, semis: number): void => {
    if (at.lastOfBuild && beat >= 3.5) return;
    out.push({ voice, midi: 0, dur: 0, beat, vel: Math.max(0.05, Math.min(1, vel * at.level)), mod: BREAK_PITCH + Math.max(-24, Math.min(24, semis)) });
  };
  const sourceOf = (s: number): Source => (borrowed[s] ? plan.other : plan.main);
  for (let s = 0; s < 16; s++) {
    const from = seq[s]!;
    if (from < 0) continue;
    const src = sourceOf(s);
    const k = src.k[from] ?? '.', sn = src.s[from] ?? '.', h = src.h[from] ?? '.';
    const p = pitch[s]!;
    const jitter = (): number => 1 + (r() - 0.5) * 0.12;
    if (at.kick && !build && Math.floor(s / 4) !== dropBeat && k !== '.') mark('kick', sb(s), VEL[k === 'X' ? 'X' : k === 'x' ? 'x' : 'o']! * jitter(), p);
    if (at.snare && !build && sn !== '.' && !(roll && s >= roll.from)) {
      // A ghost note: the sample's own, or in a top loop played afresh, now and then one going.
      if (sn !== 'g' || (plan.fresh ? r() < 0.78 : plan.keep[from]!)) mark('snare', sb(s), VEL[sn]! * jitter(), p);
    }
    // A top loop over a kit leaves the kit's eighth-note hats to the kit and plays the rest.
    if (at.hats && h !== '.' && !(plan.fresh && s % 2 === 0 && h !== 'o')) {
      if (h === 'o') mark('openHat', sb(s), 0.5 * jitter(), p);
      else mark('hat', sb(s), (h === 'X' ? 0.6 : h === 'x' ? 0.46 : 0.28) * jitter(), p);
    }
    if (at.hats && plan.busyHats && section === 'drop' && h === '.' && s % 2 === 1) mark('hat', sb(s), 0.24 * jitter(), p);
  }
  // One more ghost note somewhere the drummer had none: the sample's, or in a top loop about every other bar.
  if (at.snare && !build && (plan.fresh ? r() < 0.5 : true)) {
    const s = plan.fresh ? [1, 3, 7, 9, 11, 13][Math.floor(r() * 6)]! : plan.extra[half]!;
    if (!out.some(n => n.voice === 'snare' && Math.abs(n.beat - sb(s)) < 0.05) && !(roll && s >= roll.from)) mark('snare', sb(s), 0.22, 0);
  }
  // A drag into the next four bars: two quiet snares on the last two sixteenths.
  if (fourth && at.snare && !build && section !== 'intro' && r() < 0.6) {
    for (const s of [14, 15]) if (!out.some(n => n.voice === 'snare' && Math.abs(n.beat - sb(s)) < 0.05)) mark('snare', sb(s), s === 14 ? 0.3 : 0.4, 0);
  }
  if (roll && at.snare) {
    const steps = Math.round((16 - roll.from) * 2 / roll.per);
    for (let n = 0; n < steps; n++) {
      const beat = roll.from / 4 + (n * roll.per) / 8;
      const t = n / Math.max(1, steps - 1);
      mark('snare', beat, 0.35 + 0.5 * t, Math.round(roll.climb * t));
    }
  }
  return out.sort((x, y) => x.beat - y.beat);
}

// ── drum and bass's own kit ────────────────────────────────────────────────────

/**
 * Drum and bass's kick and snare through a drop, edited bar by bar as the records' are
 * (Andy, 2026-11-14: D&B's drums may change). The two-step stays: the kick on one and on
 * the "and" of three, the snare on two and four, at 170 to 176 bpm. Around it, in the break
 * engine's vocabulary (all written for Lolly, none a famous break's): a second kick moved or
 * added, ghost snares and drags into the backbeat, a half bar re-cut, a turnaround to end
 * each four bars and a fill into each eight. The produced drum and bass measured
 * (docs/generated-music.md) changes its drums in 0.27 and 0.80 of its bars.
 */
type Hit = readonly [step: number, kind: 'k' | 'S' | 'g', vel: number];
/** The two-step's bars: the kick on one and the "and" of three, now and then pushed or doubled. */
const DNB_BASES: ReadonlyArray<readonly number[]> = [[0, 10], [0, 7, 10], [0, 10, 14], [0, 2, 10], [0, 10, 13], [0, 6, 10]];
/** A phrase's turnaround, the last half bar re-cut: kicks and snares traded, the backbeat pushed or doubled. */
const DNB_TURNS: ReadonlyArray<ReadonlyArray<Hit>> = [
  [[10, 'k', 0.85], [12, 'S', 0.95], [13, 'g', 0.3], [14, 'k', 0.8], [15, 'S', 0.7]],
  [[9, 'g', 0.28], [10, 'k', 0.85], [11, 'k', 0.75], [12, 'S', 0.95], [14, 'S', 0.75], [15, 'g', 0.3]],
  [[10, 'S', 0.7], [11, 'k', 0.8], [12, 'S', 0.95], [14, 'g', 0.3], [15, 'S', 0.65]],
  [[12, 'S', 0.95], [13, 'S', 0.6], [14, 'k', 0.85], [15, 'S', 0.75]],
  [[10, 'k', 0.85], [11, 'S', 0.9], [13, 'g', 0.3], [14, 'S', 0.85]],
];
/** A half bar re-cut in the middle of a phrase: the backbeat kept, the kicks and ghosts around it moved. */
const DNB_HALVES: ReadonlyArray<ReadonlyArray<Hit>> = [
  [[8, 'g', 0.25], [10, 'k', 0.85], [12, 'S', 0.95], [13, 'k', 0.7]],
  [[11, 'k', 0.85], [12, 'S', 0.95], [14, 'g', 0.3], [15, 'g', 0.25]],
  [[10, 'k', 0.8], [12, 'S', 0.95], [14, 'k', 0.75], [15, 'g', 0.3]],
  [[9, 'k', 0.8], [10, 'k', 0.7], [12, 'S', 0.95], [15, 'g', 0.3]],
];

/** One tune's D&B kit: its two bars of kick, its ghost notes, its turnarounds in order, and how often a bar is edited. */
export interface DnbKitPlan { a: readonly number[]; b: readonly number[]; ghosts: readonly number[]; turns: readonly number[]; edits: number }
export function dnbKitPlan(r: () => number): DnbKitPlan {
  const a = Math.floor(r() * DNB_BASES.length);
  let b = Math.floor(r() * (DNB_BASES.length - 1));
  if (b >= a) b++;
  const ghosts = [3, 7, 9, 14, 15].filter(() => r() < 0.4);
  const turns = DNB_TURNS.map((_, n) => [n, r()] as const).sort((x, y) => x[1] - y[1]).map(([n]) => n);
  return { a: DNB_BASES[a]!, b: DNB_BASES[b]!, ghosts, turns, edits: 0.2 + r() * 0.25 };
}

/**
 * One drop bar of the D&B kit. The bars of a phrase alternate between the tune's two kick
 * bars; most carry ghost notes; some are edited (a kick moved or added, a drag into a
 * backbeat, a half bar re-cut, a cluster of ghosts); the fourth bar of each four ends on a
 * turnaround and the eighth on a fill, a snare run climbing into the next phrase. The first
 * bar of a drop is the plain two-step under its crash. About a fifth to two-fifths of the
 * other bars are edited, which puts the kit between the two records measured.
 */
export function dnbKitBar(plan: DnbKitPlan, r: () => number, at: { inSection: number; sb: (step: number) => number }): LofiNote[] {
  const { inSection, sb } = at;
  const pos = inSection % 8;
  const kicks = new Map<number, number>();
  const snares = new Map<number, number>();
  for (const s of inSection % 2 ? plan.b : plan.a) kicks.set(s, s === 0 ? 0.95 : 0.82);
  snares.set(4, 0.95);
  snares.set(12, 0.95);
  const half = (hits: ReadonlyArray<Hit>, from: number): void => {
    for (const s of [...kicks.keys()]) if (s >= from) kicks.delete(s);
    for (const s of [...snares.keys()]) if (s >= from) snares.delete(s);
    for (const [s, kind, vel] of hits) (kind === 'k' ? kicks : snares).set(s, vel);
  };
  if (inSection > 0) {
    for (const s of plan.ghosts) if (!snares.has(s) && r() < 0.9) snares.set(s, 0.22 + r() * 0.08);
    if (pos === 7) {
      // The fill: a snare run from the half bar (or the last beat), louder all the way, the kick on the half bar.
      const from = r() < 0.5 ? 8 : 12;
      half([], from);
      if (from === 8) kicks.set(8, 0.8);
      for (let s = from; s < 16; s++) snares.set(s, 0.4 + ((s - from) / (16 - from)) * 0.55);
    } else if (pos === 3) {
      half(DNB_TURNS[plan.turns[Math.floor(inSection / 8) % plan.turns.length]!]!, 8);
    } else if (r() < plan.edits) {
      const edit = Math.floor(r() * 4);
      if (edit === 0) {
        // A kick moved or added: the second kick a sixteenth early or late, or a pickup before the backbeat.
        const second = [...kicks.keys()].find(s => s >= 7 && s <= 11);
        if (second !== undefined && r() < 0.5) { kicks.delete(second); kicks.set(second + (r() < 0.5 ? -1 : 1), 0.82); }
        else kicks.set([3, 6, 13][Math.floor(r() * 3)]!, 0.75);
      } else if (edit === 1) {
        // A drag into a backbeat: two quiet snares on the two sixteenths before the backbeat.
        const into = r() < 0.5 ? 4 : 12;
        snares.set(into - 2, 0.28);
        snares.set(into - 1, 0.38);
      } else if (edit === 2) {
        half(DNB_HALVES[Math.floor(r() * DNB_HALVES.length)]!, 8);
      } else {
        for (const s of r() < 0.5 ? [1, 3] : [9, 11]) if (!snares.has(s)) snares.set(s, 0.26);
      }
    }
  }
  const out: LofiNote[] = [];
  for (const [s, vel] of kicks) out.push({ voice: 'kick', midi: 0, dur: 0, beat: sb(s), vel });
  for (const [s, vel] of snares) out.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(s), vel: Math.min(1, vel) });
  return out.sort((x, y) => x.beat - y.beat);
}
