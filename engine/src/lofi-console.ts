// SPDX-License-Identifier: MPL-2.0
/**
 * The 16-bit console's FM effects, and where a tune plays them: spins that charge up,
 * long shots with echoing tails, and one moment before each drop. Written as `fm` notes
 * on a stream of their own (seed ^ 0xc0f5e) after the rest of the tune, so no other
 * part's draws move; the web shell's lib/lofi-console-fx.ts makes the sounds.
 *
 * The sounds are in the idiom of the early 16-bit consoles' FM chip (four operators,
 * feedback, pitches stepped once a video frame), designed for Lolly: none is a copy of a
 * game's effect.
 *
 *   spin     a motor revving up through one to four gears, each gear starting higher than
 *            the last, its whine pulsing faster and faster; it can let go in a whoosh
 *   pew      a short shot: a fast fall, a burst of feedback and the noise's crack, then its
 *            echo answering from side to side, darker each time (one shot or two)
 *   beam     a long, buzzing shot sliding down, with a longer tail
 *   charged  the big one, after a spin: a burst, a deep fall with a thump under it and the
 *            noise rumbling down, and the longest tail
 *   climb    a power-up: the next chord's tones climbing two octaves, the top one held
 *   dive     a warp: a pitch dive through three octaves, sweeping across the speakers
 *   launch   a spin into a charged shot, fired on the drop's first beat
 *   fanfare  a short start-of-game figure on the next chord, in two voices
 *   rewind   the tape stops under the music for the last beat, a console chord swelling into the stop
 *
 * Where (sugar, chiptune and sherbert): one moment in the bar before each drop, a
 * different one each time; a spin in the bar before a build now and then, in place of the
 * console sound that ended that phrase; and a few shots through the drops, off the beat,
 * where the lead is holding a note rather than starting one. A bird, a producer's tag, a
 * shouted phrase or a vocal stutter already in a bar before a drop is that drop's moment,
 * so the console stays out of the way. K-pop and synthwave borrow a moment, rarely.
 */
import type { LofiBar, LofiMood, LofiNote } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** The effects an `fm` note plays, by its `mod` (the low four bits). */
export const LOFI_FM_FX = ['spin', 'pew', 'beam', 'charged', 'climb', 'dive', 'launch', 'fanfare', 'rewind'] as const;
export type LofiFmFx = typeof LOFI_FM_FX[number];
/** The moments that can come before a drop. */
export const LOFI_FM_MOMENTS = ['climb', 'dive', 'launch', 'fanfare', 'rewind'] as const;
export type LofiFmMoment = typeof LOFI_FM_MOMENTS[number];

/** What an `fm` note holds besides its kind. */
export interface LofiFm {
  kind: LofiFmFx;
  /** A spin's or a launch's gears (1 to 4); a pew's shots (1 or 2). */
  count: number;
  /** A spin lets go in a whoosh. */
  whoosh: boolean;
  /** The side a shot's first echo answers from (and a dive starts on). */
  side: -1 | 1;
  /** The chord a climb, a fanfare or a rewind plays: semitones to its third and its fifth. */
  third: 3 | 4 | 5;
  fifth: 6 | 7 | 8;
  /** Which of the fanfare's figures. */
  figure: number;
}

const THIRDS = [3, 4, 5] as const;
const FIFTHS = [6, 7, 8] as const;

/** An `fm` note's `mod`: the kind in the low four bits, the rest above them. */
export function fmMod(fm: Partial<LofiFm> & { kind: LofiFmFx }): number {
  const count = Math.max(1, Math.min(4, fm.count ?? 1)) - 1;
  const third = Math.max(0, THIRDS.indexOf(fm.third ?? 4));
  const fifth = Math.max(0, FIFTHS.indexOf(fm.fifth ?? 7));
  const detail = count | (fm.whoosh ? 4 : 0) | (fm.side === 1 ? 8 : 0) | (third << 4) | (fifth << 6) | ((Math.max(0, fm.figure ?? 0) & 3) << 8);
  return LOFI_FM_FX.indexOf(fm.kind) + 16 * detail;
}

/** Read an `fm` note's `mod`. */
export function readFm(mod: number): LofiFm {
  const m = Math.max(0, Math.floor(mod));
  const d = Math.floor(m / 16);
  return {
    kind: LOFI_FM_FX[m % 16] ?? 'pew',
    count: (d & 3) + 1,
    whoosh: (d & 4) !== 0,
    side: (d & 8) !== 0 ? 1 : -1,
    third: THIRDS[(d >> 4) & 3] ?? 4,
    fifth: FIFTHS[(d >> 6) & 3] ?? 7,
    figure: (d >> 8) & 3,
  };
}

/** Whether an `fm` note is one of the moments before a drop. */
export function isFmMoment(note: LofiNote): boolean {
  return note.voice === 'fm' && (LOFI_FM_MOMENTS as readonly string[]).includes(readFm(note.mod ?? 0).kind);
}

/** The styles that play a game, and those that borrow a moment now and then (the chance, and which moments). */
const GAMES = new Set<LofiMood>(['sugar', 'chiptune', 'sherbert']);
const BORROW: Partial<Record<LofiMood, { chance: number; kinds: readonly LofiFmMoment[] }>> = {
  kpop: { chance: 0.3, kinds: ['rewind', 'dive', 'climb'] },
  synthwave: { chance: 0.25, kinds: ['dive', 'climb', 'rewind'] },
};
/** Where each moment starts in its bar (beats) and how long it is written. Every one starts by beat 3, so the last half beat before the drop stays a breath. */
const MOMENT_AT: Record<LofiFmMoment, readonly [number, number]> = {
  climb: [2.5, 1.4], dive: [3, 1], launch: [2, 2], fanfare: [2.5, 1.5], rewind: [3, 1],
};
/** The effects whose notes the console's own sounds would crowd: in a moment's or a spin's window, these give way. */
const CONSOLE = new Set(['game', 'coin']);
/** The sounds a shot keeps clear of. */
const CLEAR_OF = new Set(['game', 'coin', 'hey', 'tag', 'magpie', 'kookaburra', 'fm', 'blip', 'glitch']);
/** Off-beat eighths a shot may start on, in the order a bar offers them. */
const OFF_BEATS = [1.5, 2.5, 0.5, 3.5] as const;
/** A shouted phrase's `mod` (a `hey` from "pick it up" on), crowd or not (lofi-compose.ts LOFI_SHOUTS). */
const PHRASE_FROM = 9;
const CROWD = 16;

/** Pitch class `pc` placed between `lo` and `lo + 11`. */
function place(pc: number, lo: number): number {
  return lo + (((pc - lo) % 12) + 12) % 12;
}

/** The chord a bar plays, as an `fm` note wants it: its root and the semitones to its third and fifth. */
function chordOf(bar: LofiBar): { root: number; third: 3 | 4 | 5; fifth: 6 | 7 | 8 } {
  const root = bar.tones[0] ?? 0;
  const has = (i: number): boolean => bar.tones.some(pc => (((pc - root) % 12) + 12) % 12 === i);
  const third = has(4) ? 4 : has(3) ? 3 : has(5) ? 5 : 4;
  const fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : 7;
  return { root, third, fifth };
}

/** Whether a bar already has its own moment: a bird, the producer's tag, a shouted phrase or a vocal stutter (a run of short lead notes at its end). */
function featured(bar: LofiBar): boolean {
  if (bar.notes.some(n => n.voice === 'magpie' || n.voice === 'kookaburra' || n.voice === 'tag')) return true;
  if (bar.notes.some(n => n.voice === 'hey' && (n.mod ?? 0) % CROWD >= PHRASE_FROM)) return true;
  return bar.notes.filter(n => n.voice === 'lead' && n.beat >= 3 && n.dur <= 0.15).length >= 4;
}

/** The bars where a new section starts, by what it is. */
function starts(bars: readonly LofiBar[], section: string): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) if (bars[i]!.section === section && bars[i - 1]!.section !== section && bars[i - 1]!.section !== 'rest') out.push(i);
  return out;
}

/** The bar with `note` added, sorted by beat, and the console's notes from `clear` on taken out (the moment or the spin takes their place). */
function withNote(bar: LofiBar, note: LofiNote, clear?: number): LofiBar {
  const kept = clear === undefined ? bar.notes : bar.notes.filter(n => !(CONSOLE.has(n.voice) && n.beat >= clear));
  return { ...bar, notes: [...kept, note].sort((a, b) => a.beat - b.beat) };
}

/**
 * A tune with its console FM effects: unchanged in any style that has none, otherwise
 * with the moments, spins and shots described at the top of this module.
 */
export function withConsoleFx(bars: LofiBar[], seed: number, mood: LofiMood): LofiBar[] {
  const borrow = BORROW[mood];
  if (!GAMES.has(mood) && !borrow) return bars;
  const r = mulberry32((seed ^ 0xc0f5e) >>> 0);
  const out = bars.slice();
  const drops = starts(out, 'drop');
  const moment = (at: number, kind: LofiFmMoment): void => {
    const before = out[at - 1]!;
    const [beat, dur] = MOMENT_AT[kind];
    // A rewind slows the chord that is playing; the others play the chord the drop opens on.
    const chord = chordOf(kind === 'rewind' ? before : out[at]!);
    const side = r() < 0.5 ? -1 : 1;
    const mod = fmMod({ kind, third: chord.third, fifth: chord.fifth, side, count: kind === 'launch' ? 2 : 1, figure: Math.floor(r() * 3) });
    out[at - 1] = withNote(before, { voice: 'fm', midi: place(chord.root, 60), beat, dur, vel: 0.8, mod }, beat - 0.5);
  };
  if (borrow) {
    // A borrowed moment: before the last drop only, and only now and then.
    const last = drops.at(-1);
    if (last !== undefined && r() < borrow.chance && out[last - 1]!.layers.includes('fx') && !featured(out[last - 1]!)) moment(last, borrow.kinds[Math.floor(r() * borrow.kinds.length)]!);
    return out;
  }
  // One moment before each drop, never the same one twice in a tune.
  const order = [...LOFI_FM_MOMENTS];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  drops.forEach((d, n) => {
    const before = out[d - 1]!;
    if (before.layers.includes('fx') && !featured(before)) moment(d, order[n % order.length]!);
  });
  // A spin into a build now and then, over the last two beats of the bar before the build.
  for (const b of starts(out, 'build')) {
    const before = out[b - 1]!;
    if (!before.layers.includes('fx') || featured(before) || r() >= 0.55) continue;
    const mod = fmMod({ kind: 'spin', count: 1 + Math.floor(r() * 3), whoosh: r() < 0.6 });
    out[b - 1] = withNote(before, { voice: 'fm', midi: place(chordOf(out[b]!).root, 60), beat: 2, dur: 2, vel: 0.7, mod }, 1.5);
  }
  shots(out, r, mood);
  return out;
}

/** Lead notes' start beats from bar `i` and the next one (the next bar's counted from 4). */
function leadStarts(bars: readonly LofiBar[], i: number): number[] {
  const at = bars[i]!.notes.filter(n => n.voice === 'lead').map(n => n.beat);
  const next = bars[i + 1];
  if (next?.section === bars[i]!.section) for (const n of next.notes) if (n.voice === 'lead') at.push(n.beat + 4);
  return at;
}

/**
 * The shots through a tune's drops: two to four in sugar and chiptune, one or two in
 * sherbert (whose console already says a lot, and whose chopped vocal leaves its drops no
 * room, so its shots go in the breakdown's spaces too). Each on an off-beat in the middle
 * of a phrase (its second or third bar, never where a section opens or a phrase ends,
 * where the coins and shouts are), where no lead note starts for the shot's main hit and
 * no other effect is near. A long beam wants a longer space. Sherbert's arpeggios count
 * as busy. Once in a while a short spin charges a shot up.
 */
function shots(out: LofiBar[], r: () => number, mood: LofiMood): void {
  const sher = mood === 'sherbert';
  let budget = sher ? 1 + (r() < 0.5 ? 1 : 0) : 2 + (r() < 0.5 ? 1 : 0) + (r() < 0.25 ? 1 : 0);
  let charged = r() < 0.35;
  const busy = new Set(CLEAR_OF);
  if (sher) busy.add('sparkle');
  let side: -1 | 1 = r() < 0.5 ? -1 : 1;
  let lastShot = -8;
  const candidates: Array<{ i: number; beat: number; room: number }> = [];
  let inDrop = -1;
  for (let i = 0; i < out.length; i++) {
    const bar = out[i]!;
    if (bar.section !== 'drop' && !(sher && bar.section === 'break')) { inDrop = -1; continue; }
    if (i > 0 && out[i - 1]!.section !== bar.section) inDrop = -1;
    inDrop++;
    // Never in a section's last two bars either: a shot's tail would run into the turn into the next.
    if (inDrop % 4 === 0 || inDrop % 4 === 3 || !bar.layers.includes('fx') || out[i + 2]?.section !== bar.section) continue;
    const leads = leadStarts(out, i);
    for (const beat of OFF_BEATS) {
      if (bar.notes.some(n => busy.has(n.voice) && n.beat > beat - 0.75 && n.beat < beat + 1.25)) continue;
      const until = Math.min(...leads.filter(x => x > beat - 0.25), 8) - beat;
      if (until < 0.75) continue;
      candidates.push({ i, beat, room: until });
      break;
    }
  }
  // Spread them out: walk the candidates in order, each taken by chance, never within four bars of the last.
  const want = Math.max(1, budget);
  const p = Math.min(1, (want * 1.6) / Math.max(1, candidates.length));
  for (const c of candidates) {
    if (budget <= 0) break;
    if (c.i - lastShot < 4 || r() >= p) continue;
    const bar = out[c.i]!;
    const midi = place(chordOf(bar).root, 60);
    if (charged && c.room >= 1.75 && c.beat >= 1.5 && !bar.notes.some(n => busy.has(n.voice) && n.beat > c.beat - 1.25 && n.beat < c.beat)) {
      // A short spin charges the shot up over the beat before the shot.
      out[c.i] = withNote(withNote(bar, { voice: 'fm', midi, beat: c.beat - 1, dur: 1, vel: 0.6, mod: fmMod({ kind: 'spin', count: 1 }) }), { voice: 'fm', midi, beat: c.beat, dur: 1, vel: 0.72, mod: fmMod({ kind: 'charged', side }) });
      charged = false;
    } else {
      const beam = c.room >= 1.25 && r() < 0.6;
      const pair = !beam && c.room >= 1.25 && r() < 0.45;
      const mod = beam ? fmMod({ kind: 'beam', side }) : fmMod({ kind: 'pew', side, count: pair ? 2 : 1 });
      out[c.i] = withNote(bar, { voice: 'fm', midi, beat: c.beat, dur: beam ? 1 : pair ? 0.75 : 0.25, vel: beam ? 0.62 : 0.68, mod });
    }
    side = side === 1 ? -1 : 1;
    lastShot = c.i;
    budget--;
  }
}
