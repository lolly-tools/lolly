// SPDX-License-Identifier: MPL-2.0
/**
 * Jungle: chopped funk breaks at 160 to 175 bpm over a deep dub sub, the way the music was
 * made on samplers in the early nineties. The composer (lofi-compose.ts composeDanceTune)
 * calls these hooks, so that file holds only the calls:
 *
 * - The running order (arrangeJungle): an atmospheric intro of pads and strings with a dub
 *   siren and, in some tunes, the break filtered in under them; a build that rolls the
 *   break's snare into the drop; the drop, where the break and the sub arrive together; a
 *   breakdown of pads, long sub notes and the siren; a second build and a second drop with
 *   heavier edits; and an outro that thins to the break.
 * - The drums are the chopped break (lofi-break-chop.ts), with a crash on each drop and a
 *   riser through each build.
 * - The bass is a reggae and dub sub: long notes, a root held under the break, the fifth and
 *   the octave answering, a step into the next chord, and in some second drops a rolling
 *   bass in eighths (jungleFigures).
 * - The keys stab a chord off the beat in a drop, one or two hits a bar, which the station
 *   throws into a dub echo and a spring (lib/lofi-dub.ts); in the quiet sections they hold
 *   pads and strings.
 * - The siren is an original synth siren (a `siren` note, lib/lofi-dub.ts), at a few
 *   moments: the end of the intro, the top of a drop, the breakdown.
 * - The shouts are the station's own wordless ones (yeah, woo, oh, whoa), now and then at
 *   the top of a drop or to end its phrase. No MC and no accent is imitated.
 *
 * Every draw comes from a stream of the tune's own (jungleOf), so no other genre's tune moves.
 */
import type { DanceLean, DancePart, IntroStyle, LofiLayer, LofiNote, LofiSection, LofiStyle } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** A bass figure: [sixteenth, length in sixteenths, how it is played (`mod`), semitones above the root]. */
type Figure = ReadonlyArray<readonly [number, number, number, number]>;
/** The chord's own third and a step into the next chord's root (the composer's THIRD and APPROACH). */
const THIRD = 99;
const APPROACH = 98;

// ── the bass ────────────────────────────────────────────────────────────────

/**
 * The dub sub: long notes on the root, the fifth or the octave answering late in the bar, a
 * minor third or a step leading into the next chord. The lines move at half the tempo of
 * the break, as a reggae bassline does under jungle's double-time drums.
 */
const DUBS: readonly Figure[] = [
  [[0, 10, 0, 0], [10, 6, 0, 7]],
  [[0, 6, 0, 0], [6, 2, 0, 0], [8, 8, 0, 12]],
  [[0, 3, 0, 0], [3, 9, 0, 0], [12, 4, 0, APPROACH]],
  [[0, 8, 0, 0], [10, 2, 0, THIRD], [12, 4, 0, 7]],
  [[0, 12, 0, 0], [12, 2, 0, 10], [14, 2, 0, 7]],
  [[0, 4, 0, 0], [6, 6, 0, 7], [12, 4, 0, 5]],
  [[0, 14, 0, 0], [14, 2, 0, APPROACH]],
  [[2, 6, 0, 0], [8, 4, 0, 12], [12, 4, 0, 7]],
];
/** A rolling bass, in some second drops: eighths rolling round the root and the octave, stepping into the next chord. */
const ROLLS: readonly Figure[] = [
  [[0, 2, 0, 0], [2, 2, 0, 0], [4, 2, 0, 12], [6, 2, 0, 0], [8, 2, 0, 7], [10, 2, 0, 0], [12, 2, 0, 12], [14, 2, 0, APPROACH]],
  [[0, 3, 0, 0], [3, 1, 0, 0], [4, 2, 0, 12], [6, 2, 0, 7], [8, 3, 0, 0], [11, 1, 0, 0], [12, 2, 0, 10], [14, 2, 0, 7]],
  [[0, 2, 0, 0], [3, 2, 0, 0], [6, 2, 0, 12], [8, 2, 0, 0], [10, 2, 0, 7], [12, 4, 0, THIRD]],
];
/** The breakdown's sub: a root held the bar, or the root and its fifth, under the pads. */
const HOLDS: readonly Figure[] = [[[0, 16, 0, 0]], [[0, 12, 0, 0], [12, 4, 0, 7]]];

/** Jungle's figures for one of its basses, or null to leave the bass its usual ones. */
export function jungleFigures(mood: string, bass: LofiStyle['bass']): readonly Figure[] | null {
  if (mood !== 'jungle') return null;
  if (bass === 'round' || bass === 'deep' || bass === 'eight') return DUBS;
  if (bass === 'reese' || bass === 'synth') return ROLLS;
  return null;
}
/** The breakdown's held sub figure for bar `i`. */
export const jungleHold = (i: number): Figure => HOLDS[i % HOLDS.length]!;

// ── the running order ─────────────────────────────────────────────────────────

/**
 * A jungle tune's running order: the intro (pads alone, the break filtered in under them,
 * or the sub and the pads), a build, the first drop (the lead joining halfway), the
 * breakdown, a second build and drop (`alt`, its edits heavier), and an outro that thins
 * to the break and fades.
 */
export function arrangeJungle(rng: () => number, lean: DanceLean, intro: IntroStyle): DancePart[] {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length)] as T;
  const drums: readonly LofiLayer[] = ['kick', 'snare', 'hats'];
  const groove: readonly LofiLayer[] = ['keys', 'bass', 'fx', ...drums];
  // The break without its kick is the station's cue to high-pass it: a teaser under the pads.
  const opening: Record<IntroStyle, [readonly LofiLayer[], readonly LofiLayer[]]> = {
    keys: [['keys', 'fx'], ['keys', 'fx', 'hats']],
    beat: [['keys', 'fx', 'hats'], ['keys', 'fx', 'hats', 'bass']],
    bass: [['keys', 'bass', 'fx'], ['keys', 'bass', 'fx', 'hats']],
    lead: [['keys', 'lead', 'fx'], ['keys', 'lead', 'fx', 'hats']],
    full: [['keys', 'fx', 'hats'], ['keys', 'fx', 'hats', 'bass']],
  };
  const [first, then] = opening[intro];
  const half = lean.drop / 2;
  const parts: DancePart[] = [
    { section: 'intro', bars: lean.intro / 2 + 2, prog: 0, layers: first, open: [0.35, 0.6] },
    { section: 'intro', bars: lean.intro / 2 - 2, prog: 0, layers: then, open: [0.6, 0.85] },
  ];
  const drop = (alt: boolean): void => {
    parts.push({ section: 'build', bars: pick(lean.build), prog: 0, layers: ['keys', 'snare', 'hats', 'fx'], open: [0.7, 1] });
    parts.push({ section: 'drop', bars: half, prog: 1, layers: groove, alt });
    parts.push({ section: 'drop', bars: half, prog: 1, layers: [...groove, 'lead'], alt });
  };
  drop(false);
  parts.push({ section: 'break', bars: lean.breakdown, prog: 0, layers: ['keys', 'lead', 'bass', 'fx'], open: [0.75, 0.6] });
  drop(true);
  parts.push({ section: 'outro', bars: 4, prog: 0, layers: groove, open: [0.95, 0.75] });
  parts.push({ section: 'outro', bars: 4, prog: 0, layers: ['keys', 'fx', 'hats', 'snare'], open: [0.75, 0.45], fade: true });
  return parts;
}

// ── the tune's own draws ──────────────────────────────────────────────────────

/** A rhythm of chord stabs: [sixteenth, length in sixteenths]. */
type Rhythm = ReadonlyArray<readonly [number, number]>;
/** Jungle's stabs: sparse, off the beat, a chord or two a bar for the echo to fill. */
const STABS: readonly Rhythm[] = [[[6, 1]], [[2, 1], [10, 1]], [[14, 2]], [[6, 1], [14, 1]], [[3, 1], [11, 2]], [[10, 2]], [[0, 1], [6, 1]]];
/** The keys a jungle drop stabs; any other (a pad, a person's choice of a held sound) holds its chord as elsewhere. */
const STABBED = new Set<LofiStyle['keys']>(['organ', 'rhodes', 'brass', 'pluck', 'houseOrgan', 'felt', 'grand', 'wurli']);
/** The shouts, by their place in the composer's LOFI_SHOUTS: yeah, woo, oh and whoa, wordless or generic. */
const SHOUTS: ReadonlyArray<readonly [number, number]> = [[1, 3], [2, 3], [3, 2], [7, 2]];
/** The siren's kinds, a `siren` note's `mod` (lib/lofi-dub.ts): the wail up and down, a rising whoop, a fast pulse, a dive. */
export const JUNGLE_SIRENS = ['wail', 'whoop', 'pulse', 'dive'] as const;

/** One tune's own jungle draws: its two bars of stabs, its siren, its shouts, and a stream for the bars' choices. */
export interface JunglePlan { stabs: readonly [Rhythm, Rhythm]; siren: number; shout: readonly [number, number]; r: () => number }
export function jungleOf(seed: number): JunglePlan {
  const r = mulberry32((seed ^ 0x51e6a1) >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
  const shout = (): number => { let x = r() * 10; for (const [s, w] of SHOUTS) { x -= w; if (x < 0) return s; } return 1; };
  return { stabs: [pick(STABS), pick(STABS)], siren: Math.floor(r() * 3), shout: [shout(), shout()], r };
}

/** Whether a jungle tune stabs these keys in this section. */
export const jungleStabs = (keys: LofiStyle['keys'], section: LofiSection): boolean => STABBED.has(keys) && section === 'drop';

/** A drop bar of stabs: the chord cut short on the tune's rhythm, the first hit leaned on. */
export function jungleKeys(plan: JunglePlan, inSection: number, voicing: readonly number[], sb: (step: number) => number): LofiNote[] {
  const out: LofiNote[] = [];
  const rhythm = plan.stabs[inSection % 2]!;
  rhythm.forEach(([step, len], n) => {
    const vel = (n === 0 ? 0.62 : 0.54) + (plan.r() - 0.5) * 0.06;
    for (const p of voicing) out.push({ voice: 'keys', midi: p, beat: sb(step), dur: len / 4 - 0.03, vel: Math.max(0.05, Math.min(1, vel)) });
  });
  return out;
}

/** Where a bar is, for the drums' and the moments' choices. */
export interface JungleAt {
  section: LofiSection;
  /** Bars into the part and the part's length; bars into the section. */
  i: number; bars: number; inSection: number;
  alt: boolean;
  dropStart: boolean;
  /** The part after this one's section (a siren calls the drop in). */
  next: LofiSection | undefined;
  fx: boolean;
  /** The key's root (0 is C), for the siren's pitch. */
  key: number;
  sb: (step: number) => number;
}

/**
 * A bar's moments: the crash on each drop and every eight bars in, the riser through a
 * build, the siren at the end of the intro and in the breakdown (and now and then at the
 * top of a drop), and the shouts.
 */
export function jungleMoments(plan: JunglePlan, at: JungleAt): LofiNote[] {
  const out: LofiNote[] = [];
  const { r } = plan;
  if (!at.fx) return out;
  const siren = (beat: number, beats: number, kind: number, vel: number): void => {
    out.push({ voice: 'siren', midi: 72 + ((at.key + 7) % 12), beat, dur: beats, vel, mod: kind });
  };
  const shout = (beat: number, which: number, vel: number): void => {
    out.push({ voice: 'hey', midi: 55 + ((at.key + 12) % 12), beat, dur: 0.4, vel, mod: which });
  };
  if (at.section === 'build' && at.i === 0) out.push({ voice: 'riser', midi: 60, dur: at.bars * 4 - 0.5, beat: 0, vel: 0.7 });
  if (at.dropStart) out.push({ voice: 'crash', midi: 0, dur: 0, beat: 0, vel: 0.95 });
  else if (at.section === 'drop' && at.inSection % 8 === 0 && at.inSection > 0) out.push({ voice: 'crash', midi: 0, dur: 0, beat: 0, vel: 0.55 });
  // The siren: across the intro's last two bars, the breakdown's third and fourth, and at
  // the top of some drops (the second drop more often).
  if (at.section === 'intro' && at.next === 'build' && at.i === at.bars - 2) siren(0, 7.5, plan.siren, 0.62);
  if (at.section === 'break' && at.i === 2) siren(0, 7.5, (plan.siren + 1) % 3, 0.58);
  if (at.dropStart && r() < (at.alt ? 0.6 : 0.3)) siren(0.5, 3.5, 1, 0.55);
  if (at.section === 'break' && at.i === at.bars - 1 && r() < 0.4) siren(2, 2, 3, 0.5);
  // The shouts: at the top of a drop, and to end its eighth bar.
  if (at.dropStart && r() < 0.6) shout(at.sb(2), plan.shout[0], 0.85);
  else if (at.section === 'drop' && at.inSection % 8 === 7 && r() < 0.4) shout(at.sb(14), plan.shout[at.alt ? 1 : 0], 0.8);
  return out;
}
