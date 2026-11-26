// SPDX-License-Identifier: MPL-2.0
/**
 * The vocal chops' voices (lib/lofi-chop.ts sings them): a woman's, a man's, a baritone's and a
 * child's, each measured from real singing. engine/src/lofi-chop-cast.ts casts them.
 *
 * A voice is what the formant singer needs to sound like that kind of singer:
 *
 * - its vowels: the four formants of each vowel for the average speaker of its kind, from
 *   Hillenbrand et al.'s (1995) averages for men, women and children of ten to twelve (the
 *   fourth formant scaled with the third), and how far one singer's vocal tract strays from
 *   that average (the spread of the VocalSet singers' speech formants, below);
 * - its range: the notes it sings comfortably, and where it breaks into falsetto or head voice;
 * - its source: how long the glottis stays open in each period, how fast the harmonics fall
 *   away and how breathy it is, soft and loud, in its lower register and its upper one;
 * - its wobble from period to period (jitter and shimmer), and its vibrato;
 * - the trained voice's ring: the third and fourth formants drawn together into the cluster
 *   near 2.6 kHz (a baritone) or 2.9 kHz (a tenor) that carries over a band.
 *
 * The adult voices were fitted to VocalSet (Wilkins et al. 2018, CC BY 4.0): twenty trained
 * singers, nine women (sopranos and mezzos) and eleven men (tenors, baritones, basses and a
 * countertenor), singing long tones, scales and arpeggios on five vowels, softly, loudly,
 * breathily, belted and with vibrato. The child's voice was fitted to openly licensed
 * recordings of children singing, solo and in choirs (Freesound CC0, Wikimedia Commons CC BY
 * and public domain). The recordings were measured and never used: each voice was sung by the
 * model on the same vowels and pitches, measured the same way, and moved until the numbers
 * met (the jitter, shimmer, harmonics-to-noise ratio, H1-H2, the energy above 1 kHz against
 * below, the cluster's level and the vibrato). No real singer is imitated: the numbers are
 * each kind's medians, and every tune draws its own singer around them.
 *
 * The VocalSet singers are classically trained, and chops are pop: the vibrato and the ring
 * are kept at about half the trained voices' (a pop singer's are smaller), and nothing else is
 * changed from the measurements.
 */
import type { ChopVoice } from '../../../../engine/src/lofi-chop-cast.ts';

type Quad = readonly [number, number, number, number];
/** The vowels a chop's syllables are made of: ah, eh, ee, ay, oh, ooh and the schwa "yeah" closes on. */
export type Vowel = 'ah' | 'eh' | 'ee' | 'ey' | 'oh' | 'oo' | 'uh';

/** A woman's sung vowels, their four formants (Hz): Hillenbrand et al.'s (1995) averages for women, F4 near 4.2 kHz. */
export const WOMAN: Readonly<Record<Vowel, Quad>> = {
  ah: [940, 1550, 2820, 4150], eh: [730, 2060, 2980, 4200], ee: [440, 2760, 3370, 4300], ey: [540, 2530, 3050, 4200],
  oh: [560, 1040, 2830, 4050], oo: [460, 1110, 2740, 4000], uh: [650, 1600, 2850, 4100],
};
/** A man's (Hillenbrand et al. 1995, men), the fourth formant 0.85 of a woman's as the third is. The schwa as the woman's, scaled as "uh" is. */
const MAN: Readonly<Record<Vowel, Quad>> = {
  ah: [768, 1333, 2522, 3530], eh: [580, 1799, 2605, 3570], ee: [342, 2322, 3000, 3650], ey: [476, 2089, 2691, 3570],
  oh: [497, 910, 2459, 3440], oo: [378, 997, 2343, 3400], uh: [538, 1346, 2478, 3480],
};
/** A child's of ten to twelve (Hillenbrand et al. 1995, children), the fourth formant 1.1 of a woman's. */
const CHILD: Readonly<Record<Vowel, Quad>> = {
  ah: [1002, 1688, 2950, 4570], eh: [749, 2267, 3310, 4620], ee: [452, 3081, 3702, 4730], ey: [564, 2656, 3323, 4620],
  oh: [597, 1137, 2987, 4460], oo: [494, 1345, 2988, 4400], uh: [647, 1734, 3055, 4510],
};

/** How the glottis sounds in one register, soft (velocity 0) and the change at full strength. */
export interface ChopSource {
  /** How long the glottis is open in each period (0.3 pressed, 0.8 breathy): at velocity 0, and the change by velocity 1. */
  open: number; openVel: number;
  /** Where the harmonics start to fall away (Hz): softly, and the rise by velocity 1, on the velocity's square. */
  corner: number; cornerVel: number;
  /** Breath in the voice, against the singer's own breathiness: softly, and the change by velocity 1. */
  breath: number; breathVel: number;
  /** The presence a produced vocal is given: softly, and the rise by velocity 1. */
  presence: number; presenceVel: number;
}

/** A voice: its vowels, its singer's spread, its range and registers, its source, wobble, vibrato and ring. */
export interface ChopVoiceSpec {
  id: ChopVoice | 'legacy';
  vowels: Readonly<Record<Vowel, Quad>>;
  /** The consonants' formants (a woman's) against this voice's: about the vowels' ratio. */
  onset: number;
  /** One singer's vocal tract against the average, drawn per tune: lowest and highest. */
  tract: readonly [number, number];
  /** The singer's own breathiness (0 to 1), drawn per tune: lowest and highest. */
  breathy: readonly [number, number];
  /** The formants' bandwidths against an adult's (a child's are wider). */
  bw: number;
  /** The first formant's bandwidth when it follows a high note up, as a share of the note (0 leaves it as it is). */
  trackBw: number;
  /** The tract's higher formants (Hz, before the singer's own scale), above the vowel's four. */
  poles: readonly number[];
  /** The formants above those, lumped (Klatt's bypass): how much of the source's top goes straight through. */
  bypass: number;
  /** The ring: how far the third and fourth formants are drawn into the cluster (0 none), and its centre (Hz, before the singer's own scale). */
  ring: number; ringHz: number;
  /** How much of the ring the upper register keeps (a man's falsetto almost none). */
  highRing: number;
  /** The lower register's source, and the upper one's (falsetto for a man, head voice for a woman or a child). */
  low: ChopSource; high: ChopSource;
  /** Where the voice turns over to its upper register (MIDI), over how many semitones. */
  flip: number; flipSpan: number;
  /** The upper register against the lower: its level and its vibrato. */
  highLevel: number; highVib: number;
  /** Each period's length and strength wobble: the uniform draw's whole width. */
  jitter: number; shimmer: number;
  /** A slow wander of the pitch (cents), as an untrained voice drifts on a held note; 0 for none. */
  drift: number;
  /** Vibrato: its rate (Hz) and depth (cents, the swing either way) drawn per tune, how long a note is held before it starts (s), and how many notes carry one. */
  vibRate: readonly [number, number]; vibDepth: readonly [number, number]; vibDelay: number; vibShare: number;
  /** How long a slide or a scoop takes against a woman's. */
  glide: number;
  /** The notes it sings comfortably (MIDI). */
  range: readonly [number, number];
  /** Its level against the woman's at the same velocity, after each slice is set to the same loudness. */
  level: number;
}

/**
 * The chop voice before the voices were measured, kept for the botanica grains
 * (lib/lofi-grains.ts), which sing its open vowels: a woman's voice sped up a little, its
 * numbers as they were. Its tract (1.06 to 1.2) is the sped-up sample's.
 */
export const LEGACY_VOICE: ChopVoiceSpec = {
  id: 'legacy', vowels: WOMAN, onset: 1, tract: [1.06, 1.2], breathy: [0.15, 0.45], bw: 1, trackBw: 0, poles: [], bypass: 0, ring: 0, ringHz: 0, highRing: 1,
  low: { open: 0.64, openVel: -0.2, corner: 1500, cornerVel: 4500, breath: 1.25, breathVel: -0.6, presence: 0.5, presenceVel: 0.7 },
  high: { open: 0.64, openVel: -0.2, corner: 1500, cornerVel: 4500, breath: 1.25, breathVel: -0.6, presence: 0.5, presenceVel: 0.7 },
  flip: Infinity, flipSpan: 1, highLevel: 1, highVib: 1, jitter: 0.012, shimmer: 0.08, drift: 0,
  vibRate: [5.2, 6], vibDepth: [22, 40], vibDelay: 0.12, vibShare: 1, glide: 1, range: [60, 84], level: 1,
};

/** A woman's voice: a soprano or a mezzo (the alto range), fitted to the VocalSet women. */
const FEMALE: ChopVoiceSpec = {
  id: 'female', vowels: WOMAN, onset: 1, tract: [0.95, 1.06], breathy: [0.1, 0.3], bw: 1.4, trackBw: 0.3, poles: [4675], bypass: 0.75, ring: 0.32, ringHz: 3150, highRing: 0.6,
  // Her chest voice below the turn and her head voice above the turn, each fitted to the VocalSet women's notes in that register, soft, plain and loud.
  low: { open: 0.78, openVel: -0.07, corner: 400, cornerVel: 4050, breath: 0.85, breathVel: -0.45, presence: 1.24, presenceVel: 0.63 },
  high: { open: 0.71, openVel: -0.1, corner: 650, cornerVel: 5175, breath: 0.9, breathVel: -0.5, presence: 0.44, presenceVel: 0.88 },
  flip: 64, flipSpan: 4, highLevel: 1, highVib: 1, jitter: 0.01, shimmer: 0.07, drift: 0,
  vibRate: [5.2, 5.9], vibDepth: [30, 50], vibDelay: 0.14, vibShare: 1, glide: 1, range: [57, 84], level: 1.03,
};

/** A man's voice: a tenor, fitted to the VocalSet tenors. Above his turn, falsetto: open, soft-edged and breathy. */
const MALE: ChopVoiceSpec = {
  id: 'male', vowels: MAN, onset: 0.86, tract: [0.97, 1.05], breathy: [0.1, 0.28], bw: 1.15, trackBw: 0.3, poles: [3500], bypass: 0.85, ring: 0.8, ringHz: 2900, highRing: 0,
  low: { open: 0.625, openVel: -0.19, corner: 2850, cornerVel: 6000, breath: 0.85, breathVel: -0.5, presence: 0.61, presenceVel: 1.2 },
  // Falsetto: open longer, its top falling away early, breathier, no presence and no ring.
  high: { open: 0.725, openVel: -0.0125, corner: 700, cornerVel: 4050, breath: 1.6, breathVel: -0.5, presence: 0.05, presenceVel: 0 },
  flip: 66, flipSpan: 3, highLevel: 0.7, highVib: 0.6, jitter: 0.011, shimmer: 0.075, drift: 0,
  vibRate: [5.1, 5.8], vibDepth: [25, 42], vibDelay: 0.16, vibShare: 1, glide: 1.12, range: [48, 69], level: 1.08,
};

/** A baritone: darker, a longer tract, the ring lower, a slower vibrato; falsetto above about E4. */
const BARITONE: ChopVoiceSpec = {
  id: 'baritone', vowels: MAN, onset: 0.84, tract: [0.93, 1.01], breathy: [0.06, 0.2], bw: 1.31, trackBw: 0.3, poles: [3300], bypass: 0.95, ring: 0.75, ringHz: 2600, highRing: 0,
  low: { open: 0.64, openVel: -0.105, corner: 750, cornerVel: 5000, breath: 0.8, breathVel: -0.45, presence: 0.76, presenceVel: 0.73 },
  high: { open: 0.73, openVel: -0.0125, corner: 600, cornerVel: 3500, breath: 1.6, breathVel: -0.5, presence: 0.05, presenceVel: 0 },
  flip: 64, flipSpan: 3, highLevel: 0.68, highVib: 0.6, jitter: 0.012, shimmer: 0.08, drift: 0,
  vibRate: [4.8, 5.4], vibDepth: [22, 38], vibDelay: 0.18, vibShare: 1, glide: 1.5, range: [43, 64], level: 1.11,
};

/** A child: higher formants and wider bands, breathier, more wobble, a slow drift and a little vibrato on some notes. */
const CHILD_VOICE: ChopVoiceSpec = {
  id: 'child', vowels: CHILD, onset: 1.08, tract: [1, 1.12], breathy: [0.25, 0.5], bw: 1.46, trackBw: 0.3, poles: [5100], bypass: 0.6, ring: 0, ringHz: 0, highRing: 1,
  low: { open: 0.66, openVel: -0.14, corner: 2000, cornerVel: 6200, breath: 1.3, breathVel: -0.5, presence: 0.7, presenceVel: 0.45 },
  high: { open: 0.72, openVel: -0.1, corner: 1600, cornerVel: 5000, breath: 1.45, breathVel: -0.5, presence: 0.5, presenceVel: 0.4 },
  flip: 72, flipSpan: 4, highLevel: 0.9, highVib: 1, jitter: 0.04, shimmer: 0.12, drift: 12,
  vibRate: [3.4, 4.2], vibDepth: [18, 34], vibDelay: 0.25, vibShare: 0.4, glide: 0.8, range: [60, 79], level: 0.85,
};

/** The four voices by name. */
export const CHOP_VOICE: Readonly<Record<ChopVoice, ChopVoiceSpec>> = { female: FEMALE, male: MALE, baritone: BARITONE, child: CHILD_VOICE };

/** How far a note sits in the voice's upper register: 0 below its turn, 1 past it, eased between. */
export function upperShare(spec: ChopVoiceSpec, midi: number): number {
  const u = Math.min(1, Math.max(0, (midi - spec.flip) / spec.flipSpan));
  return u * u * (3 - 2 * u);
}

/** How the chopper plays each voice, against a woman's moves: how often each move happens. */
export interface ChopGestures { scoop: number; slide: number; flip: number; gate: number; stutter: number; fall: number; reverse: number }
/**
 * A man's chops flip a little less; a baritone's far less, sliding instead, and his slides
 * take longer (his `glide`); a child's are lighter: few falls, slides or flips, and the
 * swells and stutters rarer. A woman's are the chopper's own, untouched.
 */
export const CHOP_GESTURES: Readonly<Partial<Record<ChopVoice, ChopGestures>>> = {
  male: { scoop: 1, slide: 1.1, flip: 0.7, gate: 1, stutter: 1, fall: 1.1, reverse: 1 },
  baritone: { scoop: 1.1, slide: 1.25, flip: 0.35, gate: 0.8, stutter: 0.8, fall: 1.2, reverse: 0.9 },
  child: { scoop: 0.6, slide: 0.6, flip: 0.5, gate: 1.1, stutter: 0.9, fall: 0.4, reverse: 0.6 },
};
