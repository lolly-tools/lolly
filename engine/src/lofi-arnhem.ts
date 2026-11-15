// SPDX-License-Identifier: MPL-2.0
/**
 * Arnhem Land: the region's band music today, the parts of the Arnhem Land style that
 * lib/lofi-compose.ts's dance path hands to this module. Rock, island grooves, soul and
 * hip-hop, with the yidaki and the bilma (the clapsticks) inside the band. Like every
 * composer here it writes notes, never sound, and is pure and deterministic; every draw comes
 * from the tune's own Arnhem Land streams, so no other style moved when it arrived.
 *
 * The style is the contemporary band tradition, never ceremony: no song cycle, no ceremonial
 * pattern for the yidaki or the bilma, and the voices sing wordless syllables only.
 *
 * Each tune sits somewhere on one line, from modern to traditional, and the point is the two
 * meeting in one track. Most tunes sit in the middle; some lean further one way:
 *
 * - The modern end: hip-hop, funk-pop and dance energy. A punchy beat with an 808 or a funky
 *   synth bass, bright pop hooks, energetic vocal chops and shouts riding the groove, and the
 *   Yidaki as a hook and a rhythmic driver inside the production.
 * - The traditional end: a rock and dance band on a traditional foundation. The bilma's
 *   steady, driving pulse and the Yidaki's rhythmic drone and calls set the groove (the
 *   Didgeridoo's drone under them for depth), the band layers guitars, bass and drums on top,
 *   and the chorus is a big hook sung in unison and answered.
 * - Now and then a tune is an island groove instead (reggae's one drop, a skank and a warm
 *   bass) or a soulful acoustic song (an acoustic guitar, warm keys and a soft drone).
 *
 * The bilma keeps time in every tune: quarters, a driving run of eighths or eighths pushed
 * into the beat, by the tune's place on the line. Through every chorus the sung hook calls
 * and the Yidaki answers, two bars each; the solo is the Yidaki's, traded with the band.
 */
import type { DanceLean, LofiLayer, LofiNote, LofiSection, LofiStyle } from './lofi-compose.ts';
import { didgeBass, didgeLead, didgeMid, didgePlanOf, didgeridooPitch, yidakiPitch, type DidgeBar, type StrayaPlan } from './lofi-straya.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** What a tune is: the blend of modern and traditional, an island groove, or a soulful acoustic song. */
export type ArnhemFlavour = 'blend' | 'island' | 'acoustic';
/** The blend's part of the line a tune falls in: the modern end, the middle, the traditional end. */
export type ArnhemZone = 'modern' | 'middle' | 'traditional';

export interface ArnhemPlan {
  /** The tune's place on the line, from 0 (modern) to 1 (traditional). */
  axis: number;
  flavour: ArnhemFlavour;
  zone: ArnhemZone;
  /** The style the tune is composed in: its tempo, groove, instruments and song form. */
  lean: DanceLean;
  /** The didgeridoos' plan (lofi-straya.ts): the Yidaki's grooves, phrases and kinds. */
  didge: StrayaPlan;
  /** Whether the Didgeridoo's drone sits under the band for depth. */
  depth: boolean;
  /** Whether the chorus hook is sung by a group in unison. */
  unison: boolean;
  /** The bilma's figure (BILMA_FIGURES) and its sticks' pitch (MIDI, the stick's lowest mode). */
  bilma: number; stick: number;
  /** How the vocal chops are cut: a producer's chops at the modern end, sung near the traditional. */
  chops: 'future' | 'plain' | 'coro' | 'smooth';
  /**
   * Where the eastern whipbird calls as the tune's signature moment, if it does: in the
   * intro, in the solo's opening bars, or now and then between phrases. From a stream of its
   * own, so placing the bird moves nothing else. The whipbird itself comes from the coast's
   * bird module, which this style calls once that module is in.
   */
  whipbird: 'intro' | 'break' | 'between' | null;
  /** Draws through the tune: the shouts. */
  r: () => number;
}

/** The voices that sing wordless syllables in every tune (the vocal chops' slices, lib/lofi-chop.ts): no word in any language. */
export const ARNHEM_SHOUTS = ['woo', 'oh', 'ayy', 'whoa'] as const;

type W<T> = ReadonlyArray<readonly [T, number]>;
const base = { kickLen: [0.3, 0.45] as [number, number], swing: 0.5, intro: 4, build: [4] as readonly number[], drop: 8, breakdown: 8, singingDrop: true, band: true, chordBars: 1 as const };

/** The style at each part of the line, and the two occasional ones. */
const LEANS: Record<ArnhemZone | 'island' | 'acoustic', DanceLean> = {
  // Hip-hop and funk-pop: an 808 or a funky synth bass, bright synth chords, a punchy clap.
  modern: {
    ...base, bpm: [94, 106], minor: 0.5, groove: 'boomBap',
    keys: [['future', 2], ['pluck', 2], ['electric', 2], ['rhodes', 1]] as W<LofiStyle['keys']>, lead: [['chop', 1]] as W<LofiStyle['lead']>,
    bass: [['eight', 2], ['synth', 2]] as W<LofiStyle['bass']>, snare: [['clap', 2], ['snare', 1]] as W<LofiStyle['snare']>,
    kick: [50, 58], kickLen: [0.4, 0.6], duck: [0.7, 1.1], crunch: 0.1, swing: 0.54, harmony: 'pop', busy: 0.8,
    softKeys: [['pluck', 2], ['rhodes', 1]] as W<LofiStyle['keys']>, verseBass: [['eight', 1]] as W<LofiStyle['bass']>, switchBass: [['synth', 1], ['eight', 1]] as W<LofiStyle['bass']>,
  },
  // A dance band: electric guitars over a four-on-the-floor or a rock beat, a bass guitar or a synth bass.
  middle: {
    ...base, bpm: [106, 120], minor: 0.45, groove: 'disco',
    keys: [['electric', 3], ['crunch', 2], ['clean', 2], ['future', 1]] as W<LofiStyle['keys']>, lead: [['chop', 1]] as W<LofiStyle['lead']>,
    bass: [['picked', 2], ['synth', 1], ['eight', 1]] as W<LofiStyle['bass']>, snare: [['snare', 2], ['clap', 1]] as W<LofiStyle['snare']>,
    kick: [52, 60], duck: [0.6, 0.9], crunch: 0.15, swing: 0.52, harmony: 'pop', busy: 0.75,
    softKeys: [['clean', 2], ['rhodes', 1]] as W<LofiStyle['keys']>, verseBass: [['picked', 1]] as W<LofiStyle['bass']>, switchBass: [['synth', 1], ['picked', 1]] as W<LofiStyle['bass']>,
  },
  // A rock band on the bilma's pulse: rhythm guitars, a bass guitar, a driving kit.
  traditional: {
    ...base, bpm: [112, 128], minor: 0.4, groove: 'rock',
    keys: [['crunch', 3], ['electric', 2], ['steel', 1]] as W<LofiStyle['keys']>, lead: [['chop', 1]] as W<LofiStyle['lead']>,
    bass: [['picked', 1]] as W<LofiStyle['bass']>, snare: [['snare', 1]] as W<LofiStyle['snare']>,
    kick: [52, 60], kickLen: [0.3, 0.4], duck: [0.5, 0.8], crunch: 0.2, harmony: 'rock', busy: 0.7,
    softKeys: [['steel', 2], ['clean', 1]] as W<LofiStyle['keys']>, verseBass: [['picked', 1]] as W<LofiStyle['bass']>, switchBass: [['picked', 1]] as W<LofiStyle['bass']>,
  },
  // The Top End's island and reggae lilt: a one drop, a skanking guitar, a warm round bass.
  island: {
    ...base, bpm: [76, 92], minor: 0.4, groove: 'oneDrop',
    keys: [['clean', 2], ['electric', 2], ['organ', 1]] as W<LofiStyle['keys']>, lead: [['chop', 1]] as W<LofiStyle['lead']>,
    bass: [['round', 1]] as W<LofiStyle['bass']>, snare: [['rim', 1]] as W<LofiStyle['snare']>,
    kick: [46, 54], kickLen: [0.35, 0.5], duck: [0.5, 0.8], crunch: 0, swing: 0.56, harmony: 'pop', busy: 0.6,
    softKeys: [['felt', 1], ['clean', 1]] as W<LofiStyle['keys']>, verseBass: [['round', 1]] as W<LofiStyle['bass']>, switchBass: [['round', 1]] as W<LofiStyle['bass']>,
  },
  // A gentle song led by the voice: an acoustic guitar, warm keys, an upright bass, brushes.
  acoustic: {
    ...base, bpm: [72, 88], minor: 0.45, groove: 'lazy', chordBars: 2,
    keys: [['steel', 3], ['rhodes', 2], ['felt', 1]] as W<LofiStyle['keys']>, lead: [['chop', 1]] as W<LofiStyle['lead']>,
    bass: [['upright', 1], ['round', 1]] as W<LofiStyle['bass']>, snare: [['brush', 2], ['rim', 1]] as W<LofiStyle['snare']>, hats: 'shaker',
    kick: [46, 54], duck: [0.3, 0.5], crunch: 0.1, swing: 0.54, harmony: 'pop', busy: 0.5,
    softKeys: [['felt', 1], ['steel', 1]] as W<LofiStyle['keys']>, verseBass: [['upright', 1]] as W<LofiStyle['bass']>, switchBass: [['upright', 1]] as W<LofiStyle['bass']>,
  },
};
/** The style the composer's tables hold for Arnhem Land: the middle of the line. */
export const ARNHEM_LEAN: DanceLean = LEANS.middle;

/**
 * The bilma's figures, a bar of sixteenths each: [step, strength]. Plain band time, nothing
 * else: quarters; a steady, driving run of eighths; eighths pushed into each beat.
 */
const BILMA_FIGURES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0, 0.8], [4, 0.66], [8, 0.74], [12, 0.66]],
  [[0, 0.8], [2, 0.52], [4, 0.68], [6, 0.52], [8, 0.74], [10, 0.52], [12, 0.68], [14, 0.52]],
  [[0, 0.8], [3, 0.5], [4, 0.66], [7, 0.5], [8, 0.74], [11, 0.5], [12, 0.66], [14, 0.56]],
];

/** The tune's Arnhem Land plan, from streams of its own (`seed` already mixed). */
export function arnhemOf(seed: number): ArnhemPlan {
  const r = mulberry32(seed >>> 0);
  // Most tunes sit in the middle of the line: the mean of two draws.
  const axis = (r() + r()) / 2;
  const f = r();
  const flavour: ArnhemFlavour = f < 0.06 ? 'island' : f < 0.11 ? 'acoustic' : 'blend';
  const zone: ArnhemZone = axis < 0.32 ? 'modern' : axis > 0.68 ? 'traditional' : 'middle';
  const lean0 = flavour === 'blend' ? LEANS[zone] : LEANS[flavour];
  // In the middle, the beat leans with the tune: a four-on-the-floor nearer the modern end, a rock beat nearer the traditional.
  const lean: DanceLean = flavour === 'blend' && zone === 'middle' ? { ...lean0, groove: r() < 1.2 - axis * 1.4 ? 'disco' : 'rock' } : lean0;
  // The Didgeridoo's drone for depth: most traditional tunes and the acoustic songs, some in the middle.
  const depth = flavour === 'acoustic' || (flavour === 'blend' && r() < (axis - 0.3) * 1.6);
  const unison = flavour === 'blend' && r() < (axis - 0.35) * 2.2;
  const bilma = flavour === 'island' || flavour === 'acoustic' ? 0 : zone === 'traditional' ? (r() < 0.75 ? 1 : 2) : zone === 'middle' ? (r() < 0.5 ? 1 : 2) : (r() < 0.5 ? 0 : 2);
  const stick = 98 + Math.floor(r() * 5);
  const chops = flavour === 'acoustic' ? 'smooth' : flavour === 'island' ? 'plain' : zone === 'modern' ? 'future' : zone === 'traditional' ? 'coro' : 'plain';
  const answer: LofiStyle['lead'] = flavour === 'acoustic' ? 'steel' : zone === 'modern' ? 'synthwave' : 'overdrive';
  const w = mulberry32((seed ^ 0x3b1d7) >>> 0)();
  const whipbird = w < 0.2 ? 'intro' : w < 0.35 ? 'break' : w < 0.5 ? 'between' : null;
  return { axis, flavour, zone, lean, didge: didgePlanOf((seed ^ 0x2d1d6) >>> 0, depth, answer), depth, unison, bilma, stick, chops, whipbird, r: mulberry32((seed ^ 0x5b0e7) >>> 0) };
}

/** What the vocal chops of a tune are cut like (lib/lofi-chop.ts), read straight from its seed. */
export function arnhemChops(seed: number): ArnhemPlan['chops'] {
  return arnhemOf((seed ^ 0xa4e3) >>> 0).chops;
}
/**
 * How much the station lifts a tune's didgeridoos against the band, from its seed: the modern
 * end's beat and 808 are the loudest band, so its Yidaki comes up most to stay the hook.
 */
export function arnhemDidgeLift(seed: number): number {
  const plan = arnhemOf((seed ^ 0xa4e3) >>> 0);
  return plan.flavour !== 'blend' ? 1 : plan.zone === 'modern' ? 1.45 : plan.zone === 'middle' ? 1.15 : 1;
}
/** Whether a tune's chorus is sung by a group in unison (the station's several singers), from its seed. */
export function arnhemUnison(seed: number): boolean {
  return arnhemOf((seed ^ 0xa4e3) >>> 0).unison;
}

/** A bar, for placing Arnhem Land's own parts: as the Straya didgeridoo's bar (lofi-straya.ts DidgeBar), and more. */
export interface ArnhemBar extends Omit<DidgeBar, 'high' | 'root' | 'over'> {
  /** The key note's pitch class, and the parts playing. */
  key: number; layers: readonly LofiLayer[];
  /** The solo's trade this bar is (lofi-straya.ts strayaParts), and whether it is a chorus's first bar. */
  trade?: 'didge' | 'answer'; dropStart: boolean;
  /** The section that comes next, whether the tune fades from here, and the shouts' pitch. */
  next: LofiSection | undefined; fade: boolean; shout: number;
}

/** The composer's ids for what this module places: the bilma's `perc` mod (its place in LOFI_PERCUSSION), the shouts' (LOFI_SHOUTS, ARNHEM_SHOUTS's order) and the crowd's flag. */
export interface ArnhemIds { bilma: number; shouts: readonly number[]; crowd: number }

/**
 * Arnhem Land's own parts for a bar, into `notes`: the bilma keeping time; the Yidaki's
 * rhythm, its answers to the sung hook through the choruses and its solo; the Didgeridoo's
 * drone under it where the tune wants depth; and the shouts. `phrase` counts the Yidaki's
 * two-bar phrases so far (its answers and its solo), and the count it ends on is returned.
 */
export function arnhemBar(plan: ArnhemPlan, at: ArnhemBar, notes: LofiNote[], phrase: number, ids: ArnhemIds): number {
  const has = (l: LofiLayer): boolean => at.layers.includes(l);
  const quiet = plan.flavour !== 'blend';
  // The bilma, every bar but the last fading one, louder towards the traditional end.
  if (!at.fade) {
    const fig = BILMA_FIGURES[at.section === 'intro' && at.i < at.bars / 2 && plan.zone !== 'traditional' ? 0 : plan.bilma]!;
    const lift = 0.7 + 0.3 * plan.axis;
    for (const [step, vel] of fig) notes.push({ voice: 'perc', midi: plan.stick, dur: 0, beat: at.sb(step), vel: vel * lift, mod: ids.bilma });
  }
  const over = plan.depth;
  const d: DidgeBar = { ...at, root: didgeridooPitch(at.key), high: yidakiPitch(at.key, over), over };
  const out: LofiNote[] = [];
  const s = at.section;
  // The Didgeridoo's drone for depth: under the verses, the choruses and the solo (not a chorus's answers: the band carries them).
  if (plan.depth && (s === 'verse' || s === 'drop' || s === 'break' || (s === 'intro' && at.i >= at.bars / 2) || (s === 'outro' && !at.fade))) out.push(...didgeBass(plan.didge, d, 'didge'));
  // The Yidaki: the solo's trades, the chorus's answers to the hook, its rhythm.
  const answers = s === 'drop' && at.inSection % 4 >= 2;
  if (s === 'break' && at.trade === 'didge') out.push(...didgeLead(plan.didge, d, phrase++ >> 1));
  else if (answers && !quiet) {
    out.push(...didgeLead(plan.didge, d, phrase++ >> 1));
    // The sung hook rests while the Yidaki answers.
    for (let n = notes.length - 1; n >= 0; n--) if (notes[n]!.voice === 'lead') notes.splice(n, 1);
  } else if (s === 'build' || s === 'drop' || (s === 'verse' && plan.zone === 'traditional' && !quiet) || (s === 'intro' && plan.zone !== 'modern' && !quiet)) {
    if (plan.flavour !== 'acoustic' && (has('keys') || has('kick') || s === 'intro')) out.push(...didgeMid(plan.didge, d));
  } else if (s === 'intro' && plan.zone === 'modern' && at.i === at.bars - 1 && !quiet) {
    // At the modern end the Yidaki opens as a hook: a phrase of calls into the verse.
    out.push(...didgeLead(plan.didge, d, phrase++ >> 1));
  }
  for (const n of out) notes.push(n);
  // The shouts: wordless, riding the chorus at the modern end and in the middle; the whole band at the traditional end into the chorus.
  const shout = (beat: number, which: number, crowd: boolean, vel: number): void => { notes.push({ voice: 'hey', midi: at.shout, dur: 0.4, beat, vel, mod: which + (crowd ? ids.crowd : 0) }); };
  if (!quiet && s === 'drop' && plan.zone !== 'traditional' && at.inSection % 4 === 1 && plan.r() < 0.6) shout(at.sb(14), ids.shouts[Math.floor(plan.r() * ids.shouts.length)]!, false, 0.78);
  if (!quiet && s === 'build' && at.next === 'drop' && at.i === at.bars - 1 && plan.zone !== 'modern') shout(at.sb(12), ids.shouts[3]!, true, 0.85);
  return phrase;
}
