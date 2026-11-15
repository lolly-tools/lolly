// SPDX-License-Identifier: MPL-2.0
/**
 * Who sings a tune's vocal chops: one voice of four (a woman's, a man's, a baritone's or a
 * child's), or a group of them on one line. The voices themselves (their vocal tracts, their
 * pitch ranges, how they sing) are the web shell's (lib/lofi-chop-voices.ts); this module only
 * casts them, and is pure, so the composer's notes never move with the casting.
 *
 * The chops are lead instruments of their own in the browser: each voice alone, a woman with a
 * baritone an octave under her, a children's choir and a mixed group. The first chop lead,
 * `chop`, is the genre's own choice: a link or saved tune with that id plays whatever its
 * genre would cast. Each genre casts on a stream of its own drawn from the tune's seed, so no
 * note of any tune moves: Sherbert, Sugar and C-Pop sing a woman's voice sped up, with a man an
 * octave under some drops; R&B, soul and hip hop sometimes a man's; Mandopop a woman or a man,
 * as its ballads are sung; Arnhem Land's unison hook a mixed group; and now and then a dreamy
 * breakdown or a botanica moment a children's choir.
 *
 * The syllables are the chopper's (lib/lofi-chop.ts) and stay wordless whoever sings them.
 */
import type { LofiMood, LofiSection } from './lofi-compose.ts';
import { arnhemOf, arnhemUnison } from './lofi-arnhem.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** The four voices a chop is sung in. */
export const CHOP_VOICES = ['female', 'male', 'baritone', 'child'] as const;
export type ChopVoice = typeof CHOP_VOICES[number];

/**
 * The vocal chop leads: the genre's own choice, each voice alone, a woman with a baritone an
 * octave under, a children's choir and a mixed group. Their ids are in the composer's
 * LOFI_LEADS too, so a link can name any of them.
 */
export const CHOP_LEADS = ['chop', 'chopFemale', 'chopMale', 'chopBaritone', 'chopChild', 'chopOctave', 'chopChoir', 'chopGroup'] as const;
export type ChopLead = typeof CHOP_LEADS[number];
/** Whether a lead is one of the vocal chops. */
export const isChopLead = (lead: string): lead is ChopLead => (CHOP_LEADS as readonly string[]).includes(lead);

/** One singer of a chop: the voice, the octave the melody is sung in, and its place in the group. */
export interface ChopSinger {
  voice: ChopVoice;
  /** Semitones from the written note: a man sings an octave under the melody. */
  shift: number;
  /** How far the sample is sped up (1 not at all): the voice's formants and vibrato rise with it, as a sampler's repitch carries them. */
  speed: number;
  /** Level against a single voice's. */
  level: number;
  /** Place across the speakers (-1 left to 1 right) and how late the singer comes in (s). */
  pan: number; late: number;
  /** Mixed into the tune's seed, so each singer of a group is their own voice. */
  salt: number;
  /** Two takes double-tracked (a lead vocal), or one (a voice in a group). */
  takes: 1 | 2;
}

/** A baritone's line goes down a second octave in a bar that sits higher than this (MIDI, the bar's average note an octave down). */
const BARITONE_TOP = 64;

/** The octave a baritone sings a bar in: an octave under the written line, two in a bar that sits high. */
export function baritoneShift(barMean: number): number {
  return barMean - 12 > BARITONE_TOP ? -24 : -12;
}

const one = (voice: ChopVoice, shift: number, speed = 1): ChopSinger => ({ voice, shift, speed, level: 1, pan: 0, late: 0, salt: 0, takes: 2 });

/** A children's choir: five voices on the line, each its own take, timing and place; together about as loud as one voice (K-weighted). */
const CHOIR: ReadonlyArray<Omit<ChopSinger, 'voice' | 'shift' | 'speed' | 'takes'>> = [
  { level: 0.7, pan: -0.62, late: 0.004, salt: 0x1c01 },
  { level: 0.67, pan: -0.24, late: 0.017, salt: 0x1c02 },
  { level: 0.73, pan: 0.06, late: 0, salt: 0x1c03 },
  { level: 0.66, pan: 0.36, late: 0.022, salt: 0x1c04 },
  { level: 0.7, pan: 0.66, late: 0.011, salt: 0x1c05 },
];
const choir = (): ChopSinger[] => CHOIR.map(c => ({ ...c, voice: 'child', shift: 0, speed: 1, takes: 1 }));

/** A mixed group: two women on the line, a tenor and a baritone under them, each its own take; as loud as the three-voice coro it took over from. */
function group(barMean: number, menLead = false): ChopSinger[] {
  const women = menLead ? 0.52 : 0.69, men = menLead ? 0.73 : 0.56;
  return [
    { voice: 'female', shift: 0, speed: 1, level: women, pan: -0.45, late: 0.006, salt: 0x6a01, takes: 1 },
    { voice: 'female', shift: 0, speed: 1, level: women * 0.9, pan: 0.3, late: 0.019, salt: 0x6a02, takes: 1 },
    { voice: 'male', shift: -12, speed: 1, level: men, pan: 0.5, late: 0, salt: 0x6a03, takes: 1 },
    { voice: 'baritone', shift: baritoneShift(barMean), speed: 1, level: men * 0.85, pan: -0.15, late: 0.013, salt: 0x6a04, takes: 1 },
  ];
}
/** A woman's chop with a baritone singing it an octave under her (two in a bar that sits high). */
const octave = (barMean: number, female: ChopSinger, under: 'male' | 'baritone' = 'baritone'): ChopSinger[] => [
  female,
  { voice: under, shift: under === 'baritone' ? baritoneShift(barMean) : -12, speed: 1, level: 0.6, pan: 0, late: 0.008, salt: 0x0c7a, takes: 1 },
];

/** A singer at the octave that voice sings a line in. */
function solo(voice: ChopVoice, barMean: number, speed = 1): ChopSinger {
  return one(voice, voice === 'baritone' ? baritoneShift(barMean) : voice === 'male' ? -12 : 0, speed);
}

type Odds<T extends string> = Partial<Record<T, number>>;

/** How a genre casts its chops when the lead is its own choice (`chop`). */
interface ChopPlan {
  /** The voice that sings a tune, by odds. */
  voices: Odds<ChopVoice>;
  /** The odds a woman's voice is a sped-up sample, and how far it is sped up. */
  up?: number; speed?: readonly [number, number];
  /** The odds a tune puts a man's voice an octave under the woman's through its drops, and which. */
  octave?: number; under?: Odds<'male' | 'baritone'>;
  /** The odds a tune hands these sections to a children's choir. */
  choir?: number; choirIn?: readonly LofiSection[];
}

/** A woman's voice sped up a little, as a producer's chop usually is. */
const SPED: readonly [number, number] = [1.06, 1.2];
const PLANS: Partial<Record<LofiMood, ChopPlan>> = {
  // Future bass: her voice sped up, a man an octave under about one tune in three's drops, and now and then a children's choir in the breakdown.
  sherbert: { voices: { female: 1 }, up: 0.85, octave: 0.35, under: { male: 1, baritone: 1 }, choir: 0.15, choirIn: ['break'] },
  sugar: { voices: { female: 1 }, up: 0.85, octave: 0.25, under: { male: 1, baritone: 1 }, choir: 0.1, choirIn: ['break'] },
  kpop: { voices: { female: 3, male: 1 }, up: 0.6, octave: 0.25, under: { male: 2, baritone: 1 } },
  cpop: { voices: { female: 4, male: 1 }, up: 0.8, octave: 0.3, under: { male: 2, baritone: 1 } },
  // Mandopop is a singer's ballad: a woman or a man, the voice as it is.
  mandopop: { voices: { female: 11, male: 9 } },
  rnb: { voices: { female: 3, male: 2 }, up: 0.15, octave: 0.15, under: { baritone: 1 } },
  soul: { voices: { female: 11, male: 9 } },
  hiphop: { voices: { female: 10, male: 7, baritone: 3 }, up: 0.3, speed: [1.04, 1.12] },
  triphop: { voices: { female: 4, male: 1 } },
  lofiHouse: { voices: { female: 7, male: 3 }, up: 0.4, speed: [1.03, 1.12] },
  funkyHouse: { voices: { female: 13, male: 7 }, up: 0.4, octave: 0.2, under: { baritone: 1 } },
  ukGarage: { voices: { female: 3, male: 1 }, up: 0.8, octave: 0.15, under: { male: 1 } },
  breakbeat: { voices: { female: 13, male: 7 }, up: 0.7, octave: 0.2, under: { male: 1, baritone: 1 } },
  jungle: { voices: { female: 13, male: 7 }, up: 0.7, octave: 0.2, under: { male: 1, baritone: 1 } },
  dnb: { voices: { female: 13, male: 7 }, up: 0.7, octave: 0.2, under: { male: 1, baritone: 1 } },
  dubstep: { voices: { female: 7, male: 2, baritone: 1 }, up: 0.7, octave: 0.3, under: { baritone: 1 } },
  brostep: { voices: { female: 7, male: 2, baritone: 1 }, up: 0.7, octave: 0.3, under: { baritone: 1 } },
  electro: { voices: { female: 7, male: 3 }, up: 0.6, octave: 0.2, under: { male: 1 } },
  // A botanica moment: a child's voice now and then, and some tunes' breakdowns sung by a children's choir.
  botanica: { voices: { female: 14, child: 3, male: 3 }, choir: 0.25, choirIn: ['break'] },
  dream: { voices: { female: 4, child: 1 }, choir: 0.25, choirIn: ['break'] },
  fantasy: { voices: { female: 4, child: 1 }, choir: 0.25, choirIn: ['break'] },
  salsa: { voices: { male: 1, female: 1 } },
  noosa: { voices: { female: 7, male: 3 } },
};
const PLAIN: ChopPlan = { voices: { female: 3, male: 1 } };

/** A draw from weighted odds. */
function choose<T extends string>(r: () => number, odds: Odds<T>): T {
  const entries = Object.entries(odds) as Array<[T, number]>;
  let x = r() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) { x -= w; if (x < 0) return k; }
  return entries[entries.length - 1]![0];
}

/** A tune's casting for the genre's own chops, drawn from its seed on a stream of its own. */
export interface ChopCasting {
  /** The voice that sings the tune, and how far it is sped up (1 not at all). */
  voice: ChopVoice; speed: number;
  /** The man under the drops, if this tune has one. */
  under: 'male' | 'baritone' | null;
  /** The sections a children's choir sings. */
  choirIn: readonly LofiSection[];
}

/** A seed mixed through (murmur3's finaliser), so tunes whose seeds differ by a bit or two still cast independently. */
function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** How a genre casts a tune's chops, read straight from its seed. */
export function chopCasting(mood: LofiMood, seed: number): ChopCasting {
  // Each genre's own stream: the seed mixed with the genre's name.
  let salt = 0xc4a57;
  for (let i = 0; i < mood.length; i++) salt = Math.imul(salt ^ mood.charCodeAt(i), 16777619) >>> 0;
  const r = mulberry32(mix((seed ^ salt) >>> 0));
  const plan = PLANS[mood] ?? PLAIN;
  let voices = plan.voices;
  // Arnhem Land: a man's voice more often at the modern end, as its hip-hop and funk-pop are sung.
  if (mood === 'arnhem') voices = arnhemOf((seed ^ 0xa4e3) >>> 0).zone === 'modern' ? { male: 3, female: 2 } : { male: 1, female: 1 };
  const voice = choose(r, voices);
  const up = r() < (plan.up ?? 0);
  const [lo, hi] = plan.speed ?? SPED;
  const speed = voice === 'female' && up ? lo + r() * (hi - lo) : up && voice === 'male' ? 1 + r() * (hi - lo) * 0.5 : 1;
  // The man under her drops, only under a woman's voice.
  const under = voice === 'female' && plan.under && r() < (plan.octave ?? 0) ? choose(r, plan.under) : null;
  const choirIn = plan.choirIn && r() < (plan.choir ?? 0) ? plan.choirIn : [];
  return { voice, speed, under, choirIn };
}

/** Whether a tune sings its chorus together: salsa's coro, and Arnhem Land's tunes that sing their hook in unison (lofi-arnhem.ts). */
export function chopCoro(mood: LofiMood, seed: number): boolean {
  return mood === 'salsa' || (mood === 'arnhem' && arnhemUnison(seed));
}

/** The bar a cast is for: the tune's genre and seed, the bar's section, and its lead's average note (MIDI). */
export interface ChopBar { mood: LofiMood; seed: number; section: LofiSection | string; barMean: number }

/**
 * Who sings a chop lead in a bar, the principal singer first. A chorus the genre sings
 * together (chopCoro) is a mixed group, the men leading in salsa's coro.
 */
export function chopCast(lead: ChopLead, bar: ChopBar): ChopSinger[] {
  const m = bar.barMean;
  switch (lead) {
    case 'chopFemale': return [solo('female', m)];
    case 'chopMale': return [solo('male', m)];
    case 'chopBaritone': return [solo('baritone', m)];
    case 'chopChild': return [solo('child', m)];
    case 'chopOctave': return octave(m, solo('female', m));
    case 'chopChoir': return choir();
    case 'chopGroup': return group(m);
    case 'chop': break;
  }
  if (bar.section === 'drop' && chopCoro(bar.mood, bar.seed)) return group(m, bar.mood === 'salsa');
  const cast = chopCasting(bar.mood as LofiMood, bar.seed);
  if (cast.choirIn.includes(bar.section as LofiSection)) return choir();
  const principal = solo(cast.voice, m, cast.speed);
  if (cast.under && bar.section === 'drop') return octave(m, principal, cast.under);
  return [principal];
}
