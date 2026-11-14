// SPDX-License-Identifier: MPL-2.0
/**
 * How a future-bass chord moves (the keys `future`, Sherbert's chords), and how a drop's
 * chords change from bar to bar. The composer (lofi-compose.ts) writes a chord's movement
 * into each of its notes' `mod`; the station (shells/web/src/lib/lofi-station.ts) reads it
 * back for the voice (shells/web/src/lib/lofi-future.ts).
 *
 * A `mod` holds, from the low bits up:
 *   0 to 15   the wub's rate, a code into FUTURE_RATES (swings a beat; 0 holds the chord)
 *   16        the chord bends up a whole tone into its pitch
 *   32        the chord dives an octave as it ends (a tape stop, at the end of a phrase)
 *   64        the chord is a swell: it rises out of nothing into the next hit, as a reversed
 *             chord does
 *   128 x n   the chord is gated in pattern n of FUTURE_GATES (1 to 7)
 * Every value the composer wrote before (a rate of 0 to 4 or 8, plus 16 for a bend) means
 * what it always meant.
 *
 * Measured against future-bass records and loops (Creative Commons, measurement only, never
 * kept here): their chords move 10 to 15 dB in level inside a bar (the old chords about 9),
 * chopped in eighths, sixteenths and three-three-two, and a drop's chords turn at the end of
 * each four- and eight-bar phrase rather than looping one figure.
 *
 * Pure: no DOM, no Web Audio; the drop's variations come from a stream of their own, so a
 * tune's other parts compose exactly as they did.
 */
import { mulberry32 } from './zzfx-compose.ts';
import type { LofiNote } from './lofi-compose.ts';

export const FUTURE_BEND = 16;
export const FUTURE_DIVE = 32;
export const FUTURE_SWELL = 64;
export const FUTURE_GATE = 128;

/**
 * The wub's rates, swings a beat, by code. Codes 0 to 4 and 8 are the counts the composer
 * always wrote (2 eighths, 3 eighth-note triplets, 4 sixteenths, 8 thirty-seconds); 5 is a
 * dotted eighth, 6 quarter-note triplets, 7 sixteenth-note triplets, 9 a dotted quarter.
 */
export const FUTURE_RATES: readonly number[] = [0, 1, 2, 3, 4, 4 / 3, 1.5, 6, 8, 2 / 3, 0, 0, 0, 0, 0, 0];
/** The rate codes for the triplet and dotted wubs. */
export const RATE_DOTTED = 5, RATE_TRIPLET_QUARTER = 6, RATE_TRIPLET_SIXTEENTH = 7;

/** A gate: the chord opens at each [beat, length] within `period` beats, over and over while it is held. */
export interface FutureGate { period: number; opens: ReadonlyArray<readonly [number, number]> }

/** Thirty-seconds over the last beat of a bar: the stutter into the next phrase. */
const STUTTER: ReadonlyArray<readonly [number, number]> = [[0, 2.9], ...Array.from({ length: 8 }, (_, n) => [3 + n / 8, 0.07] as const)];

/** The gate patterns, by number (0 is no gate). */
export const FUTURE_GATES: ReadonlyArray<FutureGate | null> = [
  null,
  // Three-three-two in sixteenths, twice a bar: x..x..x.
  { period: 2, opens: [[0, 0.55], [0.75, 0.55], [1.5, 0.38]] },
  // Eighths, chopped short.
  { period: 1, opens: [[0, 0.3], [0.5, 0.3]] },
  // Eighth-note triplets.
  { period: 1, opens: [[0, 0.22], [1 / 3, 0.22], [2 / 3, 0.22]] },
  // Sixteenths.
  { period: 1, opens: [[0, 0.15], [0.25, 0.15], [0.5, 0.15], [0.75, 0.15]] },
  // Held, then a thirty-second stutter over the last beat.
  { period: 4, opens: STUTTER },
  // Syncopated across the bar: x..x..x...x..x..
  { period: 4, opens: [[0, 0.6], [0.75, 0.6], [1.5, 0.45], [2.5, 0.6], [3.25, 0.6]] },
  // A trance gate: x.xx.x.. twice a bar.
  { period: 2, opens: [[0, 0.2], [0.5, 0.2], [0.75, 0.2], [1.25, 0.45]] },
];

/** A chord's movement, read from its notes' `mod`. */
export interface FutureMove {
  /** The wub, in swings a beat (0 holds the chord). */
  rate: number;
  bend: boolean;
  dive: boolean;
  swell: boolean;
  /** A gate pattern's number (0 none). */
  gate: number;
}

export function readFuture(mod: number): FutureMove {
  const m = Math.max(0, Math.floor(mod));
  return {
    rate: FUTURE_RATES[m & 15] ?? 0,
    bend: (m & FUTURE_BEND) !== 0,
    dive: (m & FUTURE_DIVE) !== 0,
    swell: (m & FUTURE_SWELL) !== 0,
    gate: Math.min(FUTURE_GATES.length - 1, Math.floor(m / FUTURE_GATE) & 7),
  };
}

/** A `mod` for a chord's movement: a rate code, and the bend, dive, swell and gate. */
export function futureMod(m: { rate?: number; bend?: boolean; dive?: boolean; swell?: boolean; gate?: number }): number {
  return (m.rate ?? 0) & 15 | (m.bend ? FUTURE_BEND : 0) | (m.dive ? FUTURE_DIVE : 0) | (m.swell ? FUTURE_SWELL : 0) | (((m.gate ?? 0) & 7) * FUTURE_GATE);
}

/**
 * The openings of a gate over a chord `dur` beats long: [beat, length] pairs, each cut at the
 * chord's end. The last opening of a pattern held past its period starts the pattern again.
 */
export function gateOpens(gate: number, dur: number): Array<[number, number]> {
  const g = FUTURE_GATES[gate];
  if (!g) return [[0, dur]];
  const out: Array<[number, number]> = [];
  for (let from = 0; from < dur - 1e-6; from += g.period) {
    for (const [at, len] of g.opens) {
      const b = from + at;
      if (b >= dur - 1e-6) break;
      out.push([b, Math.min(len, dur - b)]);
    }
  }
  return out;
}

/** How a tune's drops vary its chords, drawn once a tune from its own stream. */
export interface FuturePlan {
  /** How the fourth bar of each four turns: a stutter of thirty-seconds, a gated chord, or a triplet run. */
  turn: 'stutter' | 'gate' | 'triplet';
  /** How each eight-bar phrase ends: a dive, a gap for the vocal and the fill, or a swell into the next. */
  end: 'dive' | 'gap' | 'swell';
  /** The gate a held chord takes when it is gated, and the rate code of a held chord's wub when it wubs. */
  holdGate: number;
  holdRate: number;
  /** Whether the build's last bar swells into the drop (or keeps its breath). */
  swellIn: boolean;
  /** Which of the tune's figures the third bar of each four plays (an index the composer resolves). */
  third: number;
  seed: number;
}

export function futurePlan(seed: number): FuturePlan {
  const r = mulberry32((seed ^ 0xf0b5ba55) >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)] as T;
  return {
    turn: pick(['stutter', 'stutter', 'gate', 'triplet'] as const),
    end: pick(['dive', 'dive', 'gap', 'swell'] as const),
    holdGate: pick([1, 1, 6, 7, 2]),
    holdRate: pick([2, 3, 3, RATE_DOTTED, RATE_TRIPLET_QUARTER, 4]),
    swellIn: r() < 0.55,
    third: Math.floor(r() * 7),
    seed,
  };
}

/** A small stream for one bar's choices, the same every time for the same tune and bar. */
function barStream(plan: FuturePlan, bar: number): () => number {
  return mulberry32((plan.seed ^ Math.imul(bar + 1, 0x9e3779b1) ^ 0x5eed) >>> 0);
}

/** One chord in a bar: when, how long and how hard (beats), its movement and its notes' pitches. */
interface Hit { beat: number; dur: number; vel: number; mod: number }

function chordsOf(notes: readonly LofiNote[]): { voicing: number[]; hits: Hit[] } {
  const byBeat = new Map<number, LofiNote[]>();
  for (const n of notes) {
    const key = Math.round(n.beat * 1000);
    byBeat.set(key, [...(byBeat.get(key) ?? []), n]);
  }
  const hits = [...byBeat.values()].map(ns => ({ beat: ns[0]!.beat, dur: ns[0]!.dur, vel: ns.reduce((s, n) => s + n.vel, 0) / ns.length, mod: ns[0]!.mod ?? 0 })).sort((a, b) => a.beat - b.beat);
  const voicing = [...new Set(notes.map(n => n.midi))].sort((a, b) => a - b);
  return { voicing, hits };
}

function notesOf(hits: readonly Hit[], voicing: readonly number[], jitter: () => number): LofiNote[] {
  return hits.flatMap(h => voicing.map(midi => ({ voice: 'keys' as const, midi, beat: h.beat, dur: h.dur, vel: Math.max(0.05, Math.min(1, h.vel + (jitter() - 0.5) * 0.05)), ...(h.mod ? { mod: h.mod } : {}) })));
}

/** A drop's bar: its index in the drop, the drop's length, and the swung sixteenth's beat. */
export interface DropBar { i: number; bars: number; sb: (step: number) => number }

/**
 * A drop's bar of chords, varied: `notes` are the bar as the tune's two figures play it (the
 * old way, so the main stream is drawn as it was), and `third` the notes of the tune's third
 * figure. The third bar of each four plays the third figure; a held chord is gated or given a
 * triplet or dotted wub now and then; the fourth bar of each four turns (a stutter, a gated
 * chord or a triplet run over its last beat); and the eighth bar of each eight, and the drop's
 * last, ends its phrase with a dive, a gap or a swell into the next bar.
 */
export function futureDropBar(notes: readonly LofiNote[], third: readonly LofiNote[], plan: FuturePlan, at: DropBar): LofiNote[] {
  if (!notes.length) return [...notes];
  const r = barStream(plan, at.i);
  const base = at.i % 4 === 2 && third.length ? chordsOf(third) : chordsOf(notes);
  const { voicing } = chordsOf(notes);
  let hits = base.hits.map(h => ({ ...h }));
  // A held chord (a beat and a half or more) without a wub: gated or wubbed now and then.
  for (const h of hits) {
    const move = readFuture(h.mod);
    if (h.dur >= 1.4 && move.rate === 0 && !move.gate && r() < 0.45) {
      h.mod = r() < 0.55 ? futureMod({ ...move, rate: 0, gate: plan.holdGate }) | (h.mod & FUTURE_BEND) : futureMod({ ...move, rate: plan.holdRate }) | (h.mod & FUTURE_BEND);
    }
  }
  const phraseEnd = at.i % 8 === 7 || at.i === at.bars - 1;
  const turn = at.i % 4 === 3 && !phraseEnd;
  if (turn) hits = turnBar(hits, plan.turn, at.sb);
  if (phraseEnd) hits = endPhrase(hits, at.i === at.bars - 1 ? 'dive' : plan.end, at.sb);
  return notesOf(hits, voicing, r);
}

/** The fourth bar's last beat, turned: the chords before it kept, then the turn. */
function turnBar(hits: Hit[], how: FuturePlan['turn'], sb: (step: number) => number): Hit[] {
  const keep = hits.filter(h => h.beat < 2.95).map(h => ({ ...h, dur: Math.min(h.dur, 3 - h.beat - 0.04) }));
  const vel = hits[0]?.vel ?? 0.6;
  if (how === 'stutter') {
    // Thirty-seconds, climbing in strength into the next bar.
    return [...keep, ...Array.from({ length: 8 }, (_, n) => ({ beat: 3 + n / 8, dur: 0.09, vel: Math.min(1, vel * (0.75 + n * 0.05)), mod: 0 }))];
  }
  if (how === 'triplet') {
    // Eighth-note triplets over the last beat and a half.
    return [...keep.filter(h => h.beat < 2.45).map(h => ({ ...h, dur: Math.min(h.dur, 2.5 - h.beat - 0.04) })), ...Array.from({ length: 4 }, (_, n) => ({ beat: 2.5 + n / 3, dur: 0.26, vel: vel * (0.85 + n * 0.05), mod: 0 }))];
  }
  // A chord held over the last two beats, chopped in sixteenths.
  return [...keep.filter(h => h.beat < 1.95).map(h => ({ ...h, dur: Math.min(h.dur, 2 - h.beat - 0.04) })), { beat: sb(8), dur: 2 - 0.04, vel, mod: futureMod({ gate: 4 }) }];
}

/** The last bar of a phrase, ended: a dive (the last chord held to the bar's end, falling), a gap or a swell into the next bar. */
function endPhrase(hits: Hit[], how: FuturePlan['end'], sb: (step: number) => number): Hit[] {
  if (how === 'gap') return hits.filter(h => h.beat < 1.95).map(h => ({ ...h, dur: Math.min(h.dur, 2 - h.beat - 0.04) }));
  if (how === 'swell') {
    const keep = hits.filter(h => h.beat < 1.95).map(h => ({ ...h, dur: Math.min(h.dur, 2 - h.beat - 0.04) }));
    return [...keep, { beat: sb(10), dur: 4 - sb(10), vel: hits[0]?.vel ?? 0.6, mod: FUTURE_SWELL }];
  }
  const keep = hits.filter(h => h.beat < 2.95);
  const last = keep[keep.length - 1];
  if (!last) return hits;
  return [...keep.slice(0, -1), { ...last, dur: 4 - last.beat - 0.02, mod: (last.mod & FUTURE_BEND) | FUTURE_DIVE }];
}

/**
 * A build's last bar of chords: the climbing wub cut to two beats, then (when the tune swells
 * in) a swell rising out of nothing into the drop's first chord. Without the swell the bar
 * keeps its breath before the drop, as it did.
 */
export function futureBuildEnd(notes: readonly LofiNote[], plan: FuturePlan, sb: (step: number) => number): LofiNote[] {
  if (!plan.swellIn || !notes.length) return [...notes];
  const { voicing, hits } = chordsOf(notes);
  const first = hits[0]!;
  const r = barStream(plan, -1);
  return notesOf([{ ...first, dur: Math.min(first.dur, 2 - 0.04) }, { beat: sb(9), dur: 4 - sb(9), vel: Math.min(1, first.vel + 0.08), mod: FUTURE_SWELL }], voicing, r);
}
