// SPDX-License-Identifier: MPL-2.0
/**
 * Straya's didgeridoo and its birds: the parts of the Straya style that lib/lofi-compose.ts's
 * dance path hands to this module. Like every composer here it writes notes, never sound,
 * and is pure and deterministic; every draw comes from the tune's own Straya stream, so no
 * other style moved when it arrived.
 *
 * Two instruments play three roles, the way contemporary Australian roots records use them
 * (the genre's traits, never a ceremonial song and never one player's performance): the
 * Didgeridoo, the deep one, and the Yidaki, modelled on the yidaki of north-east Arnhem Land,
 * higher and brighter.
 *
 * - The bass: the Didgeridoo's drone on the key note through the intro, the verses and the
 *   outro, the player's breath pushing a pulse on the stomp's beats and the circular breath
 *   once every bar or two, so the drone never stops and keeps the groove under the stomp.
 * - The middle: through the pre-chorus and the chorus a rhythm, the tongue and the mouth
 *   working on the sixteenths ("doo-ga-doo-ga"), the vowel sweeping "oo" to "ee", tongued
 *   accents and toots, two bars of groove and its answer, building through the pre-chorus into
 *   toots on the chorus's downbeat. Most tunes layer the two: the Yidaki plays the rhythm a
 *   fifth above the Didgeridoo's drone, which carries on underneath. The rest have one player,
 *   the Didgeridoo turning its own drone into a mellower rhythm.
 * - The lead: the solo section is the Yidaki's. It trades phrases with the banjo or the
 *   fiddle, two bars each (or carries the first half alone over the stomp and the clap), with
 *   voiced calls that rise and fall, barks, a howl sung through the drone, toots and sweeps,
 *   over the Didgeridoo's drone in a tune that layers them.
 *
 * The notes are `bass` notes for the drone (the tune's bass is the Didgeridoo) and `didge`
 * notes for the other two, each note's `mod` its articulation plus its role times DIDGE_ROLE
 * and its kind times DIDGE_KIND, its `midi` the drone's pitch: the shell's player
 * (lib/lofi-didgeridoo.ts) knows where its own instrument's toot sits.
 *
 * The birds are Straya's signature, as they are when Australian records sample them: most
 * tunes have one bird moment up front, drawn from the seed, a magpie's carol opening the
 * tune or carrying it into the chorus, or a kookaburra's laugh after the didgeridoo's solo,
 * at a turnaround or as the last sound of the tune; some tunes have both. Featured, the
 * band leaves the lead out under it, like a sampled hook. Between phrases a quieter magpie
 * now and then sings where the lead has rested, never over the lead.
 */
import type { LofiLayer, LofiNote, LofiSection, LofiStyle } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

// ── what the notes mean ──────────────────────────────────────────────────────

/**
 * How a didgeridoo note is played, in its `mod`: the drone held; the mouth opening and
 * closing on it ("wa"); a toot, the overblown note on the bore's second resonance; a bark
 * shouted into the horn; the circular breath (the drone sags while the nose breathes in,
 * then the lungs push back); a howl, the voice sung through the drone; the tongue sweeping
 * "oo" to "ee" and back; a tongued accent ("d"); a voiced call that rises and falls like an
 * animal's; a push from the diaphragm with no change of vowel; a growl, the voice rough and low
 * in the throat under the drone; and a bend, the lips loosened so the drone sags a little and
 * comes back, as far as a fixed bore lets a player bend.
 */
export const DIDGE_DRONE = 0, DIDGE_WA = 1, DIDGE_TOOT = 2, DIDGE_BARK = 3, DIDGE_BREATH = 4, DIDGE_HOWL = 5, DIDGE_SWEEP = 6, DIDGE_TONGUE = 7, DIDGE_CALL = 8, DIDGE_PUSH = 9, DIDGE_GROWL = 10, DIDGE_BEND = 11;
/** The articulation's bits in a note's `mod`. */
export const DIDGE_ART = 15;
/** The role in a note's `mod`, times this: 0 the drone (a bass note), 1 the middle's rhythm, 2 the lead. */
export const DIDGE_ROLE = 16;
export const DIDGE_MID = 1, DIDGE_LEAD = 2;
/** The kind of instrument in a note's `mod`, times this (0 to 7: lib/lofi-didgeridoo.ts YIDAKI). */
export const DIDGE_KIND = 64;
/** A didgeridoo note's articulation, role and kind. */
export function readDidge(mod: number): { art: number; role: number; kind: number } {
  return { art: mod % DIDGE_ROLE, role: Math.floor(mod / DIDGE_ROLE) % 4, kind: Math.floor(mod / DIDGE_KIND) % 8 };
}

/**
 * Two instruments, each with kinds of its own (lib/lofi-didgeridoo.ts YIDAKI says how each
 * kind's bore sounds). The Didgeridoo is the deep one: a long, wide bore, a classic one, a
 * bell-ended one and a termite-hollowed one, low and dark, its toot soft and low. The Yidaki
 * is modelled on the yidaki of north-east Arnhem Land: a narrower, more conical bore, pitched
 * higher and brighter, its toot strong and sharp; two kinds.
 */
export const DIDGERIDOO_KINDS: readonly number[] = [0, 1, 3];
export const YIDAKI_KINDS: readonly number[] = [2, 4];
/** Whether a kind is one of the Yidaki's. */
export const isYidaki = (kind: number): boolean => YIDAKI_KINDS.includes(kind);
/** The instruments a person can choose for a track that this module plays: the music generator's ids. */
export type DidgeInstrument = 'didgeridoo' | 'yidaki';
export const DIDGE_INSTRUMENTS: ReadonlySet<string> = new Set<DidgeInstrument>(['didgeridoo', 'yidaki']);

/** A pitch class placed between lo and hi (MIDI). */
function placeIn(pc: number, lo: number, hi: number): number {
  let p = lo + ((pc - lo) % 12 + 12) % 12;
  if (p > hi) p -= 12;
  return p;
}
/**
 * The pitch each instrument plays for a key (its pitch class): the Didgeridoo's drone low, from
 * 44 to 82 Hz; the Yidaki alone from 58 to 110 Hz; and with the Didgeridoo droning under it,
 * a fifth above the Didgeridoo, as a bagpipe's drones sit on the key note and its fifth, so
 * the Yidaki's strong odd harmonics fall between the Didgeridoo's and neither masks the other.
 */
export const didgeridooPitch = (key: number): number => placeIn(key, 29, 40);
export const yidakiPitch = (key: number, over: boolean): number => (over ? didgeridooPitch(key) + 7 : placeIn(key, 34, 45));

/**
 * A bird note's `mod`: its song's seed in the low bits (under LOFI_BIRD_FEATURE), then
 * LOFI_BIRD_FEATURE when it is a featured moment (up front, the lead clear of it), and how
 * many birds sing together, less one, times LOFI_BIRD_FLOCK (a magpie family's carol, a
 * kookaburra family laughing together).
 */
export const LOFI_BIRD_FEATURE = 4096;
export const LOFI_BIRD_FLOCK = 8192;
/** A bird note's song seed, whether it is featured, and how many birds sing the song. */
export function readBird(mod: number): { song: number; featured: boolean; birds: number } {
  return { song: mod % LOFI_BIRD_FEATURE, featured: (mod & LOFI_BIRD_FEATURE) !== 0, birds: 1 + Math.floor(mod / LOFI_BIRD_FLOCK) % 4 };
}

type Figure = ReadonlyArray<readonly [number, number, number]>;

/**
 * The middle's grooves, a bar of sixteenths each: [step, length, articulation]. They tile
 * the bar, so the drone under them never stops, and each ends where the breath can go.
 */
const MID_GROOVES: readonly Figure[] = [
  // doo-ga-doo-ga: the mouth opening on the beats, the tongue between.
  [[0, 2, DIDGE_WA], [2, 2, DIDGE_TONGUE], [4, 2, DIDGE_WA], [6, 2, DIDGE_TONGUE], [8, 2, DIDGE_WA], [10, 2, DIDGE_TONGUE], [12, 2, DIDGE_WA], [14, 2, DIDGE_TONGUE]],
  // the sweep up to "ee" and down across a dotted beat, tongued back in.
  [[0, 3, DIDGE_SWEEP], [3, 3, DIDGE_TONGUE], [6, 2, DIDGE_WA], [8, 3, DIDGE_SWEEP], [11, 3, DIDGE_TONGUE], [14, 2, DIDGE_WA]],
  // pushes on the stomp, the mouth between, a toot on the backbeat's and.
  [[0, 2, DIDGE_PUSH], [2, 2, DIDGE_WA], [4, 2, DIDGE_PUSH], [6, 2, DIDGE_TOOT], [8, 2, DIDGE_PUSH], [10, 2, DIDGE_WA], [12, 2, DIDGE_PUSH], [14, 2, DIDGE_WA]],
  // a run of tongued sixteenths into a long sweep.
  [[0, 1, DIDGE_TONGUE], [1, 1, DIDGE_TONGUE], [2, 2, DIDGE_WA], [4, 1, DIDGE_TONGUE], [5, 1, DIDGE_TONGUE], [6, 2, DIDGE_WA], [8, 4, DIDGE_SWEEP], [12, 2, DIDGE_TONGUE], [14, 2, DIDGE_WA]],
  // the dotted feel: three and three and two.
  [[0, 3, DIDGE_WA], [3, 3, DIDGE_WA], [6, 2, DIDGE_TONGUE], [8, 3, DIDGE_WA], [11, 3, DIDGE_WA], [14, 2, DIDGE_TONGUE]],
  // "wah-ee": a sweep each half bar, tongued pairs between.
  [[0, 4, DIDGE_SWEEP], [4, 2, DIDGE_TONGUE], [6, 2, DIDGE_TONGUE], [8, 4, DIDGE_SWEEP], [12, 2, DIDGE_TONGUE], [14, 2, DIDGE_TONGUE]],
  // pushes with a growl between: the voice rattling in the throat on the offbeats.
  [[0, 2, DIDGE_PUSH], [2, 2, DIDGE_GROWL], [4, 2, DIDGE_WA], [6, 2, DIDGE_TONGUE], [8, 2, DIDGE_PUSH], [10, 2, DIDGE_GROWL], [12, 2, DIDGE_WA], [14, 2, DIDGE_TONGUE]],
];
/** A groove's answer bar ends its phrase: the last beat turned into toots. */
const MID_TURNS: readonly Figure[] = [
  [[12, 2, DIDGE_TOOT], [14, 2, DIDGE_TOOT]],
  [[12, 1, DIDGE_TONGUE], [13, 1, DIDGE_TONGUE], [14, 2, DIDGE_TOOT]],
  [[12, 2, DIDGE_SWEEP], [14, 2, DIDGE_TOOT]],
];

/**
 * The lead's phrases, two bars each: [bar, step, length, articulation]. Calls, toots,
 * barks, a howl and sweeps over the drone, then the breath before the answer comes.
 */
const LEAD_PHRASES: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number]>> = [
  [[0, 0, 6, DIDGE_SWEEP], [0, 6, 2, DIDGE_TOOT], [0, 8, 2, DIDGE_TOOT], [0, 10, 6, DIDGE_CALL], [1, 0, 4, DIDGE_HOWL], [1, 4, 2, DIDGE_TONGUE], [1, 6, 2, DIDGE_TONGUE], [1, 8, 2, DIDGE_BARK], [1, 10, 2, DIDGE_DRONE], [1, 12, 2, DIDGE_TOOT], [1, 14, 2, DIDGE_BREATH]],
  [[0, 0, 2, DIDGE_TOOT], [0, 2, 2, DIDGE_WA], [0, 4, 2, DIDGE_TOOT], [0, 6, 2, DIDGE_WA], [0, 8, 8, DIDGE_CALL], [1, 0, 2, DIDGE_BARK], [1, 2, 2, DIDGE_TONGUE], [1, 4, 2, DIDGE_BARK], [1, 6, 2, DIDGE_TONGUE], [1, 8, 4, DIDGE_SWEEP], [1, 12, 2, DIDGE_TOOT], [1, 14, 2, DIDGE_BREATH]],
  [[0, 0, 8, DIDGE_CALL], [0, 8, 2, DIDGE_TOOT], [0, 10, 2, DIDGE_TOOT], [0, 12, 2, DIDGE_TOOT], [0, 14, 2, DIDGE_DRONE], [1, 0, 4, DIDGE_SWEEP], [1, 4, 4, DIDGE_SWEEP], [1, 8, 2, DIDGE_BARK], [1, 10, 2, DIDGE_BARK], [1, 12, 4, DIDGE_BREATH]],
  [[0, 0, 3, DIDGE_BARK], [0, 3, 3, DIDGE_BARK], [0, 6, 2, DIDGE_TOOT], [0, 8, 4, DIDGE_GROWL], [0, 12, 4, DIDGE_BEND], [1, 0, 2, DIDGE_TONGUE], [1, 2, 2, DIDGE_TONGUE], [1, 4, 2, DIDGE_TOOT], [1, 6, 2, DIDGE_WA], [1, 8, 6, DIDGE_CALL], [1, 14, 2, DIDGE_BREATH]],
  [[0, 0, 4, DIDGE_BEND], [0, 4, 2, DIDGE_TOOT], [0, 6, 2, DIDGE_TOOT], [0, 8, 4, DIDGE_SWEEP], [0, 12, 4, DIDGE_CALL], [1, 0, 4, DIDGE_GROWL], [1, 4, 4, DIDGE_HOWL], [1, 8, 2, DIDGE_TOOT], [1, 10, 2, DIDGE_BARK], [1, 12, 4, DIDGE_BREATH]],
  [[0, 0, 2, DIDGE_TONGUE], [0, 2, 2, DIDGE_TONGUE], [0, 4, 4, DIDGE_CALL], [0, 8, 2, DIDGE_TOOT], [0, 10, 2, DIDGE_WA], [0, 12, 2, DIDGE_TOOT], [0, 14, 2, DIDGE_WA], [1, 0, 8, DIDGE_HOWL], [1, 8, 4, DIDGE_SWEEP], [1, 12, 2, DIDGE_BARK], [1, 14, 2, DIDGE_BREATH]],
];

// ── the tune's plan ──────────────────────────────────────────────────────────

/** Where a featured bird sings. */
export type BirdMoment = { bird: 'magpie' | 'kookaburra'; at: 'open' | 'intoDrop' | 'afterSolo' | 'turn' | 'last' };

export interface StrayaPlan {
  r: () => number;
  /** The solo: traded two bars at a time, or the didgeridoo carrying its first half alone. */
  solo: 'trade' | 'carry';
  /** The lead that answers the didgeridoo in the solo. */
  answer: LofiStyle['lead'];
  /** Bars between the drone's circular breaths (one or two), and on which sixteenth it falls. */
  breathEvery: 1 | 2; breathAt: number;
  /** The middle's groove and its answer, and the answer's turn. */
  grooves: readonly [Figure, Figure]; turn: Figure;
  /** The lead's phrases, in the order they come. */
  phrases: readonly number[];
  /** The tune's featured bird moments. */
  birds: readonly BirdMoment[];
  /** The featured birds already sung (each moment sings once). */
  sung: Set<string>;
  /** Beats of the next bar still under a featured bird, where the lead stays out. */
  clearing: number;
  /** The birds' own stream, so the didgeridoo's draws never move a bird. */
  birdR: () => number;
  /**
   * Whether the two instruments play together: the Didgeridoo's drone held under the Yidaki's
   * rhythm through the pre-chorus and the chorus, and under its solo. Otherwise one player at a
   * time: the Didgeridoo turns its own drone into the rhythm, and the Yidaki solos alone.
   */
  both: boolean;
  /**
   * The kinds (lib/lofi-didgeridoo.ts YIDAKI): the Didgeridoo's for the drone, the one the
   * rhythm is played on (a Yidaki when both play, else the Didgeridoo) and the one it changes to
   * at some phrase turns of a chorus, and the Yidaki the soloist plays.
   */
  kinds: { bass: number; mid: number; turn: number; lead: number; swap: number };
}

/** The tune's Straya plan, from a stream of its own (`seed` already mixed). */
export function strayaOf(seed: number, lead: LofiStyle['lead'], fixedLead: boolean): StrayaPlan {
  const r = mulberry32(seed >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)] as T;
  const solo = r() < 0.35 ? 'carry' : 'trade';
  // The banjo or the fiddle answers; a lead a person chose answers as itself.
  const answer: LofiStyle['lead'] = fixedLead ? lead : lead === 'banjo' ? (r() < 0.55 ? 'fiddle' : 'banjo') : r() < 0.7 ? 'banjo' : 'fiddle';
  const breathEvery = r() < 0.6 ? 2 : 1;
  const breathAt = pick([12, 14, 14]);
  const g = Math.floor(r() * MID_GROOVES.length);
  const g2 = r() < 0.5 ? g : Math.floor(r() * MID_GROOVES.length);
  const turnFig = pick(MID_TURNS);
  const order = Array.from({ length: LEAD_PHRASES.length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  // Most tunes have one bird moment up front, some two (a magpie and a kookaburra), a few none.
  const magpies: ReadonlyArray<readonly [BirdMoment['at'], number]> = [['open', 3], ['intoDrop', 2]];
  const kookas: ReadonlyArray<readonly [BirdMoment['at'], number]> = [['afterSolo', 3], ['last', 2], ['turn', 1]];
  const weighted = (w: ReadonlyArray<readonly [BirdMoment['at'], number]>): BirdMoment['at'] => {
    let x = r() * w.reduce((s, [, n]) => s + n, 0);
    for (const [v, n] of w) { x -= n; if (x < 0) return v; }
    return w[0]![0];
  };
  const which = r();
  const birds: BirdMoment[] = which < 0.08 ? []
    : which < 0.36 ? [{ bird: 'magpie', at: weighted(magpies) }, { bird: 'kookaburra', at: weighted(kookas) }]
    : which < 0.68 ? [{ bird: 'magpie', at: weighted(magpies) }]
    : [{ bird: 'kookaburra', at: weighted(kookas) }];
  // The two instruments, from a stream of their own: most tunes layer them.
  const lr = mulberry32((seed ^ 0x1a7e5) >>> 0);
  const both = lr() < 0.7;
  const deep = (k: number): number => DIDGERIDOO_KINDS[k % DIDGERIDOO_KINDS.length]!;
  const bassAt = lr() < 0.5 ? 0 : 1 + Math.floor(lr() * 2);
  const soloist = YIDAKI_KINDS[Math.floor(lr() * YIDAKI_KINDS.length)]!;
  const otherYidaki = YIDAKI_KINDS.find(k => k !== soloist)!;
  const mid = both ? (lr() < 0.6 ? soloist : otherYidaki) : deep(bassAt);
  const turn = both ? (mid === soloist ? otherYidaki : soloist) : deep(bassAt + 1 + Math.floor(lr() * 2));
  const kinds = { bass: deep(bassAt), mid, turn, lead: soloist, swap: 0.2 + lr() * 0.3 };
  return { r, solo, answer, breathEvery, breathAt, grooves: [MID_GROOVES[g]!, MID_GROOVES[g2]!], turn: turnFig, phrases: order, birds, sung: new Set(), clearing: 0, birdR: mulberry32((seed ^ 0xb1d5) >>> 0), both, kinds };
}

/**
 * The didgeridoos' half of a plan for another style (Arnhem Land), from a stream of its own:
 * the Yidaki's grooves, turns and phrases, the breath, the solo's shape and its answer, the
 * kinds, and whether the Didgeridoo drones under the Yidaki (`both`). No birds.
 */
export function didgePlanOf(seed: number, both: boolean, answer: LofiStyle['lead']): StrayaPlan {
  const r = mulberry32(seed >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)] as T;
  const solo = r() < 0.35 ? 'carry' : 'trade';
  const breathEvery = r() < 0.6 ? 2 : 1;
  const breathAt = pick([12, 14, 14]);
  const g = Math.floor(r() * MID_GROOVES.length);
  const g2 = r() < 0.5 ? g : Math.floor(r() * MID_GROOVES.length);
  const turnFig = pick(MID_TURNS);
  const order = Array.from({ length: LEAD_PHRASES.length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  const soloist = YIDAKI_KINDS[Math.floor(r() * YIDAKI_KINDS.length)]!;
  const otherYidaki = YIDAKI_KINDS.find(k => k !== soloist)!;
  const kinds = { bass: DIDGERIDOO_KINDS[Math.floor(r() * DIDGERIDOO_KINDS.length)]!, mid: r() < 0.6 ? soloist : otherYidaki, turn: soloist, lead: soloist, swap: 0.2 + r() * 0.3 };
  if (kinds.turn === kinds.mid) kinds.turn = otherYidaki;
  return { r, solo, answer, breathEvery, breathAt, grooves: [MID_GROOVES[g]!, MID_GROOVES[g2]!], turn: turnFig, phrases: order, birds: [], sung: new Set(), clearing: 0, birdR: r, both, kinds };
}

/** A part of a band's running order, as the dance path builds it, with the solo's trades marked. */
export interface StrayaPart { section: LofiSection; bars: number; layers: readonly LofiLayer[]; trade?: 'didge' | 'answer' }

/**
 * The running order with the solo cut into its trades: the didgeridoo's bars (no banjo, no
 * bass drone: the soloist's own drone is under the calls), and the answers. Carried, the
 * first four bars are the didgeridoo's alone over the stomp, the clap and the shaker.
 */
export function strayaParts<P extends StrayaPart>(parts: P[], plan: StrayaPlan, keepBass = false): P[] {
  const out: P[] = [];
  for (const p of parts) {
    if (p.section !== 'break') { out.push(p); continue; }
    // A band whose bass is its own (Arnhem Land's) keeps it under the solo; Straya's bass is the drone, the soloist's own.
    const drums = p.layers.filter(l => l === 'kick' || l === 'snare' || l === 'hats' || l === 'fx' || (keepBass && l === 'bass'));
    const didge = p.layers.filter(l => l !== 'lead' && (keepBass || l !== 'bass'));
    const plan2: Array<[number, 'didge' | 'answer', readonly LofiLayer[]]> = plan.solo === 'carry'
      ? [[4, 'didge', drums], [2, 'answer', p.layers], [2, 'didge', didge]]
      : [[2, 'didge', didge], [2, 'answer', p.layers], [2, 'didge', didge], [2, 'answer', p.layers]];
    let left = p.bars;
    for (const [bars, trade, layers] of plan2) {
      const n = Math.min(bars, left);
      if (n <= 0) break;
      out.push({ ...p, bars: n, trade, layers });
      left -= n;
    }
  }
  return out;
}

// ── the didgeridoo's parts ───────────────────────────────────────────────────

/** Where in the tune a bar of the didgeridoo falls. */
export interface DidgeBar {
  section: LofiSection;
  /** Bars into the part, the part's length, and bars into the section. */
  i: number; bars: number; inSection: number;
  /** The kick's sixteenths in this bar (the stomp's), and whether it is a pre-chorus's last bar. */
  kicks: readonly number[]; lastOfBuild: boolean;
  /** The Didgeridoo's drone pitch, and the Yidaki's: a fifth above the drone when `over`, with the Didgeridoo droning underneath. */
  root: number; high: number; over: boolean;
  /** A sixteenth as a beat, with the tune's swing. */
  sb: (step: number) => number;
}

/** Notes from a figure: each lasting to the next, so the drone between them never stops. */
function tile(steps: ReadonlyArray<readonly [number, number, number, number]>, at: DidgeBar, voice: 'bass' | 'didge', role: number, kind: number, midi = at.root): LofiNote[] {
  const sorted = [...steps].sort((a, b) => a[0] - b[0]);
  return sorted.map(([step, , art, vel], n) => {
    const next = sorted[n + 1]?.[0] ?? 16;
    const beat = at.sb(step);
    return { voice, midi, beat, dur: Math.max(0.1, at.sb(next) - beat - 0.01), vel, mod: art + role * DIDGE_ROLE + kind * DIDGE_KIND };
  });
}

/**
 * The drone under a bar (the bass): a push from the diaphragm on each of the stomp's beats,
 * the drone held between, and the circular breath on its bar, the push back landing on the
 * next downbeat. The intro's last bar ends on a toot into the verse.
 */
export function didgeBass(plan: StrayaPlan, at: DidgeBar, voice: 'bass' | 'didge' = 'bass'): LofiNote[] {
  const r = plan.r;
  const steps: Array<[number, number, number, number]> = [];
  const breathes = (at.inSection + 1) % plan.breathEvery === 0;
  const last = at.section === 'intro' && at.i === at.bars - 1;
  // A phrase's last bar now and then bends the drone on its third beat, as a player's lips do.
  const bend = at.inSection % 4 === 3 && r() < 0.3;
  for (const k of at.kicks) {
    if (breathes && k >= plan.breathAt) continue;
    if (last && k >= 12) continue;
    steps.push([k, 0, k === 0 ? DIDGE_PUSH : bend && k === 8 ? DIDGE_BEND : r() < 0.25 ? DIDGE_WA : DIDGE_PUSH, k === 0 ? 0.74 : 0.62 + r() * 0.06]);
  }
  if (!steps.some(s => s[0] === 0)) steps.push([0, 0, DIDGE_DRONE, 0.66]);
  if (last) steps.push([12, 0, DIDGE_SWEEP, 0.76], [14, 0, DIDGE_BREATH, 0.7]);
  else if (breathes) steps.push([plan.breathAt, 0, DIDGE_BREATH, 0.68]);
  return tile(steps, at, voice, 0, plan.kinds.bass);
}

/**
 * The middle's rhythm for a bar: the groove, its answer turning the phrase, building through
 * a pre-chorus (pushes at first, the groove itself by its second half, toots into the chorus)
 * and the breath on its bar.
 */
export function didgeMid(plan: StrayaPlan, at: DidgeBar): LofiNote[] {
  const build = at.section === 'build';
  let fig: Array<readonly [number, number, number]> = [...plan.grooves[at.inSection % 2]!];
  // The Didgeridoo plays the rhythm mellower than the Yidaki: its sweeps and pushes, never a growl.
  if (!isYidaki(plan.kinds.mid)) fig = fig.map(([s, l, a]) => [s, l, a === DIDGE_GROWL ? DIDGE_WA : a] as const);
  if (build && at.i < at.bars / 2) fig = MID_GROOVES[2]!.map(([s, l, a]) => [s, l, a === DIDGE_TOOT ? DIDGE_WA : a] as const);
  if (at.inSection % 4 === 3 || at.lastOfBuild) fig = [...fig.filter(([s]) => s < 12), ...(at.lastOfBuild ? [[12, 1, DIDGE_TONGUE], [13, 1, DIDGE_TONGUE], [14, 2, DIDGE_TOOT]] as const : plan.turn)];
  const breathes = !at.lastOfBuild && (at.inSection + 1) % plan.breathEvery === 0;
  if (breathes) fig = [...fig.filter(([s]) => s < 14), [14, 2, DIDGE_BREATH]];
  const lift = build ? 0.05 + (0.15 * (at.i + 1)) / at.bars : 0.2;
  const steps = fig.map(([s, , a]) => [s, 0, a, Math.min(1, (s % 4 === 0 ? 0.62 : 0.5) + lift + (a === DIDGE_TOOT ? 0.12 : 0))] as [number, number, number, number]);
  // At some phrase turns of a chorus the rhythm moves to another kind of the same instrument, as a player picks up another.
  const kind = at.section === 'drop' && Math.floor(at.inSection / 4) % 2 === 1 && plan.kinds.swap > 0.35 ? plan.kinds.turn : plan.kinds.mid;
  return tile(steps, at, 'didge', DIDGE_MID, kind, isYidaki(kind) ? at.high : at.root);
}

/** The lead's two bars of a phrase: `phrase` counts the didgeridoo's phrases through the solo. */
export function didgeLead(plan: StrayaPlan, at: DidgeBar, phrase: number): LofiNote[] {
  const shape = LEAD_PHRASES[plan.phrases[phrase % plan.phrases.length]!]!;
  const half = at.i % 2;
  const steps = shape.filter(([b]) => b === half).map(([, s, , a]) => [s, 0, a, a === DIDGE_DRONE ? 0.7 : 0.82 + plan.r() * 0.12] as [number, number, number, number]);
  return tile(steps, at, 'didge', DIDGE_LEAD, plan.kinds.lead, at.high);
}

// ── the birds ────────────────────────────────────────────────────────────────

/** A bar, for placing the birds: its section, where it falls, and the notes it already holds. */
export interface BirdBar {
  section: LofiSection; i: number; bars: number;
  /** The section that comes next, and whether this is the bar the tune's last sound starts on (two bars into the outro). */
  next: LofiSection | undefined; closing: boolean;
  /** Whether the didgeridoo has just finished its solo (the first bar after the last trade). */
  afterSolo: boolean;
  /** Whether this bar ends the tune's first chorus. */
  firstDropEnd: boolean;
  /** The magpie's and the kookaburra's pitch for the tune. */
  magpie: number; kookaburra: number;
  sb: (step: number) => number;
}

/** Whether a stretch of the bar (beats) is clear of the lead, the banjo's or the didgeridoo's. */
function clear(notes: readonly LofiNote[], from: number, to: number): boolean {
  return !notes.some(n => (n.voice === 'lead' || (n.voice === 'didge' && readDidge(n.mod ?? 0).role === DIDGE_LEAD)) && n.beat < to && n.beat + n.dur > from);
}

/**
 * The birds of a bar, into `notes`: a featured moment where the plan puts one (the lead
 * notes under it taken out, as a producer clears room for a sampled hook), and otherwise now
 * and then a quieter magpie between phrases, only where the lead has rested.
 */
export function strayaBirds(plan: StrayaPlan, at: BirdBar, notes: LofiNote[]): void {
  const r = plan.birdR;
  const song = (): number => Math.floor(r() * LOFI_BIRD_FEATURE);
  // A featured bird from the bar before may still be singing: the lead waits for the bird.
  if (plan.clearing > 0) {
    for (let n = notes.length - 1; n >= 0; n--) if (notes[n]!.voice === 'lead' && notes[n]!.beat < plan.clearing) notes.splice(n, 1);
    plan.clearing = Math.max(0, plan.clearing - 4);
  }
  for (const m of plan.birds) {
    const key = `${m.bird}:${m.at}`;
    if (plan.sung.has(key)) continue;
    let beat = -1, dur = 0;
    // Each moment's length in beats: a magpie's carol a few seconds, a kookaburra's laugh about six to eight.
    if (m.at === 'open' && at.section === 'intro' && at.i === 0) { beat = 0; dur = 7; }
    else if (m.at === 'intoDrop' && at.section === 'build' && at.next === 'drop' && at.i === at.bars - 2) { beat = 2; dur = 6; }
    else if (m.at === 'afterSolo' && at.afterSolo) { beat = 0.5; dur = 12; }
    else if (m.at === 'turn' && at.firstDropEnd) { beat = 2; dur = 11; }
    else if (m.at === 'last' && at.closing) { beat = 1; dur = 16; }
    if (beat < 0) continue;
    plan.sung.add(key);
    const flock = m.bird === 'magpie' ? (r() < 0.6 ? 1 + Math.floor(r() * 2) : 0) : r() < 0.4 ? 1 : 0;
    const mod = song() + LOFI_BIRD_FEATURE + flock * LOFI_BIRD_FLOCK;
    // The band clears the lead from under the hook, in this bar.
    for (let n = notes.length - 1; n >= 0; n--) if (notes[n]!.voice === 'lead' && notes[n]!.beat >= beat - 0.25) notes.splice(n, 1);
    plan.clearing = Math.max(plan.clearing, beat + dur - 4);
    notes.push({ voice: m.bird, midi: m.bird === 'magpie' ? at.magpie : at.kookaburra, beat, dur, vel: m.bird === 'magpie' ? 0.82 : 0.86, mod });
  }
  // Between phrases: a quiet magpie in a calm section's phrase end, where the lead rests.
  const calm = at.section === 'intro' || at.section === 'verse' || at.section === 'outro' || at.section === 'break';
  if (calm && at.i % 4 === 3 && !notes.some(n => n.voice === 'magpie' || n.voice === 'kookaburra') && r() < 0.5) {
    const beat = at.sb(r() < 0.5 ? 8 : 10);
    const dur = 1.5 + r() * 1.5;
    if (clear(notes, beat, Math.min(4, beat + dur))) notes.push({ voice: 'magpie', midi: at.magpie, beat, dur, vel: 0.4, mod: song() });
  }
}

// ── the didgeridoo's cameo in the bass genres ────────────────────────────────

/** The bass genres the didgeridoo now and then turns up in, over or between the bass stacks. */
export const DIDGE_CAMEO = new Set(['dubstep', 'brostep', 'dnb', 'dnbJump', 'dnbDark', 'dnbRave']);

/** Where a tune's cameo falls: in a drop (the first or the second) at a phrase's end, or in the breakdown's middle; or none. */
export interface Cameo { section: 'drop' | 'break'; alt: boolean; bar: number; /** A Yidaki's kind. */ kind: number; figure: number; second: boolean }

/**
 * The cameo's figures over a drop: a bar of the drone undulating (the mouth opening and the
 * tongue on the sixteenths), the toots and a growl or a call coming out of it in the second
 * half, never on their own.
 */
const CAMEO_FILLS: readonly Figure[] = [
  [[0, 2, DIDGE_WA], [2, 2, DIDGE_TONGUE], [4, 2, DIDGE_WA], [6, 2, DIDGE_TONGUE], [8, 2, DIDGE_PUSH], [10, 2, DIDGE_TOOT], [12, 2, DIDGE_GROWL], [14, 2, DIDGE_TOOT]],
  [[0, 3, DIDGE_WA], [3, 3, DIDGE_WA], [6, 2, DIDGE_TONGUE], [8, 4, DIDGE_CALL], [12, 2, DIDGE_WA], [14, 2, DIDGE_TOOT]],
  [[0, 2, DIDGE_PUSH], [2, 2, DIDGE_WA], [4, 2, DIDGE_PUSH], [6, 2, DIDGE_WA], [8, 1, DIDGE_TONGUE], [9, 1, DIDGE_TONGUE], [10, 2, DIDGE_TOOT], [12, 1, DIDGE_TONGUE], [13, 1, DIDGE_TONGUE], [14, 2, DIDGE_TOOT]],
];

/**
 * A bass-genre tune's didgeridoo cameo, from a stream of its own (`seed` already mixed): about
 * two tunes in five have one, a single bar, and a few of those a second, shorter one in the other
 * drop. Rare by design: a moment, never a part.
 */
export function cameoOf(seed: number): Cameo | null {
  const r = mulberry32(seed >>> 0);
  if (r() >= 0.4) return null;
  const inBreak = r() < 0.35;
  // Always the Yidaki: its strong, sharp toots and its formant band above a kilohertz cut
  // through a bass stack that the Didgeridoo's deep drone would only thicken.
  return { section: inBreak ? 'break' : 'drop', alt: r() < 0.5, bar: inBreak ? 2 : r() < 0.5 ? 3 : 7, kind: YIDAKI_KINDS[Math.floor(r() * 4) % YIDAKI_KINDS.length]!, figure: Math.floor(r() * CAMEO_FILLS.length), second: r() < 0.3 };
}

/** The cameo's notes in a bar (none where it does not fall): `bar` counts the section's bars. */
export function didgeCameo(c: Cameo, at: { section: LofiSection; alt: boolean; bar: number; root: number; sb: (step: number) => number }): LofiNote[] {
  const tileAt = (fig: Figure, vel: number): LofiNote[] => {
    const sorted = [...fig].sort((x, y) => x[0] - y[0]);
    return sorted.map(([step, , art], n) => {
      const beat = at.sb(step), next = sorted[n + 1]?.[0] ?? 16;
      return { voice: 'didge' as const, midi: at.root, beat, dur: Math.max(0.1, at.sb(next) - beat - 0.01), vel, mod: art + DIDGE_MID * DIDGE_ROLE + c.kind * DIDGE_KIND };
    });
  };
  if (at.section === c.section && at.alt === c.alt && at.bar === c.bar) {
    // In the breakdown, a bar of rhythm between the stacks; in a drop, the bar's second half over the bass.
    return c.section === 'break' ? tileAt(MID_GROOVES[c.figure * 2]!, 0.72) : tileAt(CAMEO_FILLS[c.figure]!, 0.8);
  }
  // The second, shorter one: the other drop's eighth bar, half a bar of undulation into a toot.
  if (c.second && c.section === 'drop' && at.section === 'drop' && at.alt !== c.alt && at.bar === 7) return tileAt([[8, 2, DIDGE_WA], [10, 2, DIDGE_TONGUE], [12, 2, DIDGE_WA], [14, 2, DIDGE_TOOT]], 0.75);
  return [];
}

// ── the magpie in botanica and sherbert ──────────────────────────────────────

/** The styles that sing the magpie as their own, besides Straya: botanica gently, sherbert as a hook. */
export const MAGPIE_STYLES = new Set(['botanica', 'sherbert']);

/**
 * A botanica or sherbert tune with its magpie, from a stream of its own (`seed` already mixed),
 * so every other note is as it was. Botanica's is gentle: a quiet warble in the opening, in the
 * clearing (its breakdown) and now and then at a phrase's end, only where the lead rests.
 * Sherbert's is a hook: most tunes carol once up front, into the first drop, at that drop's
 * tail or in the breakdown, the chopped vocal leaving room under it, and some warble quietly
 * in the breakdown too.
 */
export function withMagpies<B extends { section: LofiSection; index: number; tones: readonly number[]; notes: LofiNote[] }>(bars: B[], mood: string, seed: number, sb: (step: number) => number = s => s / 4): B[] {
  if (!MAGPIE_STYLES.has(mood)) return bars;
  // Scrambled first: neighbouring seeds' first draws would otherwise lie close together.
  const r = mulberry32(Math.imul((seed ^ (seed >>> 16)) >>> 0, 0x45d9f3b) >>> 0);
  r(); r();
  const song = (): number => Math.floor(r() * LOFI_BIRD_FEATURE);
  const out = bars.map(b => ({ ...b, notes: [...b.notes] }));
  const runStart = (i: number): number => { let j = i; while (j > 0 && out[j - 1]!.section === out[i]!.section) j--; return j; };
  const pitch = (b: B): number => 84 + (((b.tones[0] ?? 0) + 7) % 12);
  const add = (b: B, n: LofiNote): void => { b.notes.push(n); b.notes.sort((x, y) => x.beat - y.beat); };
  if (mood === 'botanica') {
    let sung = 0;
    out.forEach((b, i) => {
      if (sung >= 4) return;
      const into = i - runStart(i);
      const calm = b.section === 'intro' || b.section === 'break' || b.section === 'verse' || b.section === 'outro';
      const chance = (b.section === 'intro' && into === 1) ? 0.7 : (b.section === 'break' && into === 2) ? 0.6 : calm && into % 4 === 3 ? 0.25 : 0;
      if (!chance || r() >= chance) return;
      const beat = sb(r() < 0.5 ? 8 : 4), dur = 2 + r() * 2;
      if (!clear(b.notes, beat, Math.min(4, beat + dur))) return;
      add(b, { voice: 'magpie', midi: pitch(b), beat, dur, vel: 0.42, mod: song() });
      sung++;
    });
    return out;
  }
  // Sherbert: one carol up front in most tunes, the chopped vocal cleared from under the carol.
  const drop = out.findIndex(b => b.section === 'drop');
  if (drop < 1) return out;
  let dropEnd = drop;
  while (dropEnd + 1 < out.length && out[dropEnd + 1]!.section === 'drop') dropEnd++;
  const breakAt = out.findIndex(b => b.section === 'break');
  const x = r();
  const where = x < 0.15 ? -1 : x < 0.5 ? drop - 1 : x < 0.75 ? dropEnd : breakAt >= 0 ? breakAt + 1 : drop - 1;
  if (where >= 0 && where < out.length) {
    const b = out[where]!;
    const beat = where === drop - 1 ? 0 : 2;
    for (let n = b.notes.length - 1; n >= 0; n--) if (b.notes[n]!.voice === 'lead' && b.notes[n]!.beat >= beat - 0.25) b.notes.splice(n, 1);
    add(b, { voice: 'magpie', midi: pitch(b), beat, dur: 6, vel: 0.8, mod: song() + LOFI_BIRD_FEATURE + (r() < 0.3 ? LOFI_BIRD_FLOCK : 0) });
  }
  if (breakAt >= 0 && breakAt + 4 < out.length && out[breakAt + 4]!.section === 'break' && r() < 0.4) {
    const b = out[breakAt + 4]!;
    if (clear(b.notes, 2, 4)) add(b, { voice: 'magpie', midi: pitch(b), beat: 2, dur: 2.5, vel: 0.4, mod: song() });
  }
  return out;
}

/**
 * A toot (the overblown honk) only where the band is busy and loud around it: players put it
 * over a full band, and on its own it sounds out of place (Andy, 2026-11-14). In a bar that is
 * not a pre-chorus, a chorus or a solo trade with the band playing under the solo, or where fewer than four
 * other parts play, each toot becomes the mouth's "wa" in its place, so the undulation carries
 * on and nothing honks bare. In place on `notes`.
 */
export function gateToots(notes: LofiNote[], section: LofiSection, layers: readonly LofiLayer[], gated: ReadonlySet<string> = DIDGE_ONLY, own?: string): void {
  const parts = new Set(notes.filter(n => n.voice !== 'didge' && n.voice !== own).map(n => n.voice)).size;
  const band = layers.includes('keys') && layers.includes('kick');
  const busy = (section === 'build' || section === 'drop' || (section === 'break' && band)) && parts >= 4;
  if (busy) return;
  for (const n of notes) {
    if (!gated.has(n.voice)) continue;
    const d = readDidge(n.mod ?? 0);
    if (d.art === DIDGE_TOOT) n.mod = (n.mod ?? 0) - DIDGE_TOOT + DIDGE_WA;
  }
}
/** The voices a toot is gated in: the didgeridoo's own notes, and with its drone as the bass, the bass's too. */
export const DIDGE_ONLY: ReadonlySet<string> = new Set(['didge']);
export const DIDGE_AND_DRONE: ReadonlySet<string> = new Set(['didge', 'bass']);


// ── a track a person gives to the Didgeridoo or the Yidaki ───────────────────

/** A bar as the music generator hands it over, to play one track of it on an instrument of this module. */
export interface ChosenBar {
  section: LofiSection; index: number; layers: readonly LofiLayer[]; notes: readonly LofiNote[];
  /** The key note's pitch class, the tune's seed and its swing (on the sixteenths and the eighths). */
  key: number; seed: number; swing: number; swing8: number;
}

/**
 * A bar with one track played on the Didgeridoo or the Yidaki a person chose for it, in the
 * track's own voice, so the track's fader and lane keep it: a didgeridoo has one note, so
 * what the track played becomes what a player does on that note.
 *
 * - The bass: the drone on the key note wherever the bass played, a push on each of the
 *   stomp's beats (the kick's) and the circular breath every other bar.
 * - The chords: a groove of the module's own wherever the chords sound, on the beats the
 *   chords left, the Didgeridoo's mellower (no growl).
 * - The melody: the tune's phrases kept, each note a call, a howl, a sweep, a bark, a toot or
 *   the tongue by how long it is and where it moves, the drone carried between notes that
 *   follow closely and stopped at a phrase's rest.
 *
 * `over` says a Didgeridoo drones under this bar, so a Yidaki plays a fifth above the drone. Toots only
 * where the band is busy (gateToots).
 */
export function playOnDidge(bar: ChosenBar, track: 'keys' | 'lead' | 'bass', instrument: DidgeInstrument, over: boolean): LofiNote[] {
  const own = bar.notes.filter(n => n.voice === track).sort((a, b) => a.beat - b.beat);
  if (!own.length) return [...bar.notes];
  const rest = bar.notes.filter(n => n.voice !== track);
  const r = mulberry32((bar.seed ^ Math.imul(bar.index + 1, 0x2c1b3c6d) ^ (track === 'keys' ? 0x6b : track === 'lead' ? 0x1e : 0xba)) >>> 0);
  const yidaki = instrument === 'yidaki';
  const kinds = yidaki ? YIDAKI_KINDS : DIDGERIDOO_KINDS;
  const kind = kinds[(bar.seed >>> 3) % kinds.length]!;
  const midi = yidaki ? yidakiPitch(bar.key, over) : didgeridooPitch(bar.key);
  const sb = (step: number): number => {
    let beat = step / 4;
    if (step % 4 === 2) beat += bar.swing8 - 0.5;
    else if (step % 2 === 1) beat += (bar.swing - 0.5) * 0.5;
    return beat;
  };
  const role = track === 'lead' ? DIDGE_LEAD : track === 'keys' ? DIDGE_MID : 0;
  const note = (beat: number, dur: number, art: number, vel: number): LofiNote => ({ voice: track, midi, beat, dur: Math.max(0.1, dur), vel, mod: art + role * DIDGE_ROLE + kind * DIDGE_KIND });
  const sounding = (beat: number): boolean => own.some(n => n.beat <= beat + 0.01 && n.beat + Math.max(n.dur, 0.25) > beat);
  const out: LofiNote[] = [];
  if (track === 'lead') {
    for (let i = 0; i < own.length; i++) {
      const n = own[i]!, prev = own[i - 1], next = own[i + 1];
      const gap = next ? next.beat - (n.beat + n.dur) : 4 - (n.beat + n.dur);
      const end = next && gap < 0.75 ? next.beat - 0.01 : n.beat + n.dur + Math.min(0.25, Math.max(0, gap - 0.05));
      const up = prev ? n.midi - prev.midi : 0;
      const peak = (!prev || n.midi >= prev.midi) && (!next || n.midi >= next.midi);
      const art = n.dur >= 1.5 ? (peak ? DIDGE_HOWL : DIDGE_CALL)
        : n.dur >= 0.75 ? (up > 0 ? DIDGE_CALL : gap >= 1 && r() < 0.3 ? DIDGE_BEND : DIDGE_SWEEP)
        : n.dur >= 0.375 ? (up >= 4 ? DIDGE_BARK : n.vel >= 0.8 && Math.abs(n.beat - Math.round(n.beat)) < 0.01 ? DIDGE_TOOT : DIDGE_WA)
        : DIDGE_TONGUE;
      out.push(note(n.beat, end - n.beat, art, Math.min(1, 0.7 + 0.25 * n.vel)));
    }
  } else {
    // The steps the figure plays on: a groove of the module's own for the chords, the stomp's pushes for the drone.
    const kicks = [...new Set(bar.notes.filter(n => n.voice === 'kick').map(n => Math.round(n.beat * 4)))].filter(s => s >= 0 && s < 16).sort((a, b) => a - b);
    let fig: Array<readonly [number, number]>;
    if (track === 'keys') {
      const g = MID_GROOVES[(bar.seed + (bar.index >> 1)) % MID_GROOVES.length]!;
      fig = g.map(([step, , art]) => [step, !yidaki && art === DIDGE_GROWL ? DIDGE_WA : art] as const);
      if (bar.index % 4 === 3) fig = [...fig.filter(([step]) => step < 12), ...MID_TURNS[bar.seed % MID_TURNS.length]!.map(([step, , art]) => [step, art] as const)];
    } else fig = (kicks.length ? kicks : [0, 8]).map(k => [k, k === 0 || r() > 0.25 ? DIDGE_PUSH : DIDGE_WA] as const);
    if (bar.index % 2 === 1) fig = [...fig.filter(([step]) => step < 14), [14, DIDGE_BREATH]];
    const steps = fig.filter(([step]) => sounding(sb(step))).sort((a, b) => a[0] - b[0]);
    if (track === 'bass' && sounding(0) && !steps.some(([step]) => step === 0)) steps.unshift([0, DIDGE_DRONE]);
    steps.forEach(([step, art], i) => {
      const beat = sb(step);
      const next = steps[i + 1]?.[0];
      const stop = next !== undefined && sounding(sb(next) - 0.01) ? sb(next) - 0.01 : Math.max(...own.filter(n => n.beat <= beat + 0.01).map(n => n.beat + n.dur), beat + 0.25);
      out.push(note(beat, stop - beat, art, Math.min(1, (step % 4 === 0 ? 0.68 : 0.56) + (art === DIDGE_TOOT ? 0.12 : 0))));
    });
  }
  const notes = [...rest, ...out].sort((a, b) => a.beat - b.beat);
  gateToots(notes, bar.section, bar.layers, new Set([track]), track);
  return notes;
}
