// SPDX-License-Identifier: MPL-2.0
/**
 * Record scratches: a DJ's hand on a record and the crossfader, placed as a producer places
 * them. This writes where and how; the shell's turntable plays them (lib/lofi-turntable.ts)
 * on Lolly's own sounds, never a record's: a vowel sung by the chop voice, a horn stab
 * blown by the brass model, a slice of the tune's own chopped break, or a bass note.
 *
 * A SCRATCH NOTE is a `scratch` note: its `midi` the pitch the source is heard at when the
 * record turns at its proper speed (a chord tone of the bar), its `dur` how long the hand
 * works (beats), and its `mod` the scratch, the source and the stroke rate (scratchMod).
 * The vocabulary, from the turntablists' own names: the baby (the record pushed and pulled,
 * the fader open), the chirp (each stroke cut short by the fader), the transformer (slow
 * strokes, the fader tapped in time), the flare (the fader clicked shut once or twice inside
 * a stroke), the tear (a stroke broken into steps), the crab (the fader tapped by four
 * fingers in a fast run), the scribble (the record shaken fast and small), the stab (one
 * short, hard push), and the DJ's rewind (the record pulled back, the music running
 * backwards and slowing) and backspin (the record spun backwards and let go).
 *
 * Where (withScratches), each on a stream of its own so a tune's other notes never move:
 * - hip-hop: a scratched hook in some tunes' choruses (the turnaround of each four bars cut
 *   in sixteenths, leaving its last half beat to the band's shout), scratch fills to end
 *   phrases, and now and then a scratched intro;
 * - R&B: rare and soft, a chirp or a baby scratch into a chorus;
 * - breakbeat and jungle: a rewind or a backspin into some drops, and stabs and chirps over
 *   the break's edits, scratching the tune's own break;
 * - trip-hop: now and then a slow, dusty baby scratch to end a phrase;
 * - funk, nu-disco and UK garage: rarely, one chirp or stab to end a chorus's phrase, as a
 *   DJ cuts in over a record.
 */
import type { LofiBar, LofiMood, LofiNote } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** The scratches, by a `scratch` note's `mod`. */
export const SCRATCH_KINDS = ['baby', 'chirp', 'transformer', 'flare', 'tear', 'crab', 'scribble', 'stab', 'rewind', 'backspin'] as const;
export type ScratchKind = typeof SCRATCH_KINDS[number];
/** What is on the record: a sung vowel, a horn stab, the tune's own break, a bass note. */
export const SCRATCH_SOURCES = ['voice', 'horn', 'break', 'bass'] as const;
export type ScratchSource = typeof SCRATCH_SOURCES[number];
/** How many strokes the hand makes in a beat. */
export const SCRATCH_RATES = [2, 3, 4, 6] as const;

export interface Scratch { kind: ScratchKind; source: ScratchSource; rate: number }

/** A `scratch` note's `mod`. */
export function scratchMod(s: Partial<Scratch> & { kind: ScratchKind }): number {
  const rate = Math.max(0, (SCRATCH_RATES as readonly number[]).indexOf(s.rate ?? 4));
  return SCRATCH_KINDS.indexOf(s.kind) + 16 * Math.max(0, SCRATCH_SOURCES.indexOf(s.source ?? 'voice')) + 64 * rate;
}
/** Read a `scratch` note's `mod`. */
export function readScratch(mod: number | undefined): Scratch {
  const m = Math.max(0, Math.floor(mod ?? 0));
  return { kind: SCRATCH_KINDS[m % 16] ?? 'baby', source: SCRATCH_SOURCES[Math.floor(m / 16) % 4] ?? 'voice', rate: SCRATCH_RATES[Math.floor(m / 64) % 4] ?? 4 };
}

// ── where a tune scratches ───────────────────────────────────────────────────

/** The genres that scratch, how often a tune does, and how. */
interface Habit {
  /** The chance a tune of the genre scratches at all. */
  chance: number;
  /** The sources it scratches, weighted (a break only where the tune chops one). */
  sources: ReadonlyArray<readonly [ScratchSource, number]>;
}
const HABITS: Partial<Record<LofiMood, Habit>> = {
  hiphop: { chance: 0.85, sources: [['voice', 5], ['horn', 3], ['break', 2], ['bass', 1]] },
  rnb: { chance: 0.35, sources: [['voice', 4], ['horn', 1]] },
  breakbeat: { chance: 0.75, sources: [['break', 4], ['voice', 3], ['horn', 2]] },
  jungle: { chance: 0.75, sources: [['break', 4], ['voice', 3], ['horn', 2]] },
  triphop: { chance: 0.35, sources: [['voice', 3], ['horn', 2], ['break', 1]] },
  funk: { chance: 0.2, sources: [['horn', 3], ['voice', 2]] },
  nudisco: { chance: 0.2, sources: [['voice', 3], ['horn', 2]] },
  ukGarage: { chance: 0.2, sources: [['voice', 3], ['bass', 1]] },
};
/** Whether a genre scratches at all. */
export const scratches = (mood: LofiMood): boolean => HABITS[mood] !== undefined;

/** The effects a scratch keeps clear of, in the beats it plays. */
const CLEAR_OF = new Set(['hey', 'tag', 'magpie', 'kookaburra', 'fm', 'siren', 'game', 'coin', 'whipbird', 'lorikeet']);
/** A note's `mod` from this on is a slice of a chopped break (lofi-break-chop.ts SLICE), kept here as a number so this module stands alone. */
const SLICE = 1 << 16;

const pickWeighted = <T>(r: () => number, w: ReadonlyArray<readonly [T, number]>): T => {
  let x = r() * w.reduce((s, [, n]) => s + n, 0);
  for (const [v, n] of w) { x -= n; if (x < 0) return v; }
  return w[w.length - 1]![0];
};
/** Pitch class `pc` placed in the octave from `lo`. */
const place = (pc: number, lo: number): number => lo + ((((pc - lo) % 12) + 12) % 12);

/** The bars where a new section starts, by what it is. */
function starts(bars: readonly LofiBar[], section: string): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) if (bars[i]!.section === section && bars[i - 1]!.section !== section && bars[i - 1]!.section !== 'rest') out.push(i);
  return out;
}
/** Whether a bar has room from `from` to `to` (beats): no effect there the scratch would crowd. */
function clear(bar: LofiBar, from: number, to: number): boolean {
  return !bar.notes.some(n => CLEAR_OF.has(n.voice) && n.beat < to && n.beat + Math.max(0.25, n.dur) > from);
}

/** Whether a tune scratches, and on what: the first draws of its scratch stream. */
function drawSource(r: () => number, mood: LofiMood, chops: boolean): ScratchSource | null {
  const habit = HABITS[mood];
  if (!habit || r() >= habit.chance) return null;
  const sources = habit.sources.filter(([s]) => s !== 'break' || chops);
  return pickWeighted<ScratchSource>(r, sources.length ? sources : [['voice', 1]]);
}
/** The source a tune scratches, or null when it does not scratch: a player can make the record before the first scratch. `chops` is whether the tune chops a break. */
export function scratchSource(seed: number, mood: LofiMood, chops: boolean): ScratchSource | null {
  return drawSource(mulberry32((seed ^ 0x5c7a7c4) >>> 0), mood, chops);
}

/**
 * A tune with its scratches: unchanged in a genre that does not scratch, or a tune that
 * does not; otherwise with the genre's moments added, each in a bar with room for the scratch.
 */
export function withScratches(bars: LofiBar[], seed: number, mood: LofiMood): LofiBar[] {
  if (!HABITS[mood] || !bars.length) return bars;
  const r = mulberry32((seed ^ 0x5c7a7c4) >>> 0);
  const source = drawSource(r, mood, bars.some(b => b.notes.some(n => (n.mod ?? 0) >= SLICE)));
  if (!source) return bars;
  const out = bars.slice();
  const add = (i: number, kind: ScratchKind, beat: number, dur: number, rate: number, vel: number, tone = 0): boolean => {
    const bar = out[i];
    if (!bar?.tones.length || !clear(bar, beat, beat + dur)) return false;
    if (!(bar.layers.includes('fx') || bar.layers.includes('lead') || bar.layers.includes('snare'))) return false;
    // The source heard on the bar's chord: its root, or (`tone` 1) its fifth, in the voice's or the horn's middle, the bass's low register.
    const pc = tone === 1 ? (bar.tones[2] ?? bar.tones[0]!) : bar.tones[0]!;
    const midi = source === 'bass' ? place(pc, 36) : source === 'horn' ? place(pc, 62) : place(pc, 60);
    const note: LofiNote = { voice: 'scratch', midi: source === 'break' ? 0 : midi, beat, dur, vel, mod: scratchMod({ kind, source, rate }) };
    out[i] = { ...bar, notes: [...bar.notes, note].sort((a, b) => a.beat - b.beat) };
    return true;
  };
  const drops = starts(out, 'drop');
  const dropBars = (from: number): number[] => { const at: number[] = []; for (let i = from; i < out.length && out[i]!.section === 'drop'; i++) at.push(i); return at; };

  if (mood === 'hiphop') {
    // A scratched hook: the turnaround of each four bars of the chorus cut in sixteenths, the
    // same scratch every time, as a DJ cuts the hook in.
    const hooked = r() < 0.55;
    const hook: ScratchKind = pickWeighted(r, [['chirp', 3], ['baby', 2], ['transformer', 2], ['flare', 1]]);
    // Fills to end phrases, and now and then a scratched intro over the beat.
    const fills = (['flare', 'tear', 'crab', 'chirp', 'scribble'] as const).map(k => [k, 1] as const);
    const intro = r() < 0.3;
    for (const d of drops) for (const i of dropBars(d)) {
      const pos = i - d;
      if (hooked && pos % 4 === 3) add(i, hook, 2, 1.5, 4, 0.8, pos % 8 === 7 ? 1 : 0);
      else if (!hooked && pos % 8 === 7 && r() < 0.6) add(i, pickWeighted(r, fills), 2.5, 1, r() < 0.5 ? 4 : 6, 0.75);
    }
    for (let i = 1; i < out.length; i++) {
      const b = out[i]!;
      if ((b.section === 'verse' || b.section === 'break') && i % 8 === 7 && r() < 0.4) add(i, pickWeighted(r, fills), 2.5, 1, 4, 0.7);
    }
    if (intro) {
      const first = out.findIndex(b => b.section === 'intro' && b.layers.includes('snare'));
      for (let i = Math.max(0, first); first >= 0 && i < out.length && out[i]!.section === 'intro'; i += 2) add(i, r() < 0.5 ? 'baby' : 'transformer', 0, 4, r() < 0.5 ? 2 : 4, 0.7);
    }
  } else if (mood === 'rnb') {
    // Rare and soft: one or two chirps or baby scratches into a chorus.
    let left = 1 + (r() < 0.3 ? 1 : 0);
    for (const d of drops) if (left > 0 && r() < 0.7 && add(d - 1, r() < 0.6 ? 'chirp' : 'baby', 3, 1, 4, 0.55)) left--;
  } else if (mood === 'breakbeat' || mood === 'jungle') {
    // A rewind or a backspin into some drops, over the last two beats before the drop; where
    // those are taken, the last beat alone, or the two before a shout on the last beat. Stabs
    // and chirps over the break's edits. The first drop always gets one where there is room
    // (a track that fits a tune to its length keeps the first), a later drop now and then.
    drops.forEach((d, k) => {
      const kind = r() < 0.65 ? 'rewind' : 'backspin';
      if (k === 0 || r() < 0.35) add(d - 1, kind, 2, 2, 4, 0.75) || add(d - 1, kind, 3, 1, 4, 0.75) || add(d - 1, kind, 1, 2, 4, 0.75);
    });
    for (const d of drops) for (const i of dropBars(d)) {
      const pos = i - d;
      if (pos % 8 === 7 && r() < 0.45) add(i, r() < 0.5 ? 'stab' : 'chirp', 2.5, r() < 0.5 ? 0.5 : 1, 4, 0.75, pos % 16 === 15 ? 1 : 0);
      else if (pos % 8 === 3 && r() < 0.2) add(i, 'stab', 3.5, 0.5, 4, 0.7);
    }
  } else if (mood === 'triphop') {
    // A slow, dusty baby scratch now and then, to end a phrase.
    let left = 1 + (r() < 0.4 ? 1 : 0);
    for (let i = 1; i < out.length && left > 0; i++) {
      const b = out[i]!;
      if ((b.section === 'verse' || b.section === 'drop') && i % 8 === 7 && r() < 0.5 && add(i, 'baby', 2, 2, 2, 0.6)) left--;
    }
  } else {
    // Funk, nu-disco and UK garage: one chirp or stab to end a chorus phrase.
    const d = drops[Math.floor(r() * drops.length)];
    if (d !== undefined && out[d + 7]?.section === 'drop') add(d + 7, r() < 0.5 ? 'chirp' : 'stab', 3, 1, 4, 0.65);
  }
  return out;
}
