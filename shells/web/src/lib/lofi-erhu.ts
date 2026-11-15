// SPDX-License-Identifier: MPL-2.0
/**
 * The erhu, the Chinese two-string fiddle, modelled on the fiddle's bowed string
 * (lib/lofi-bowed.ts) and heard through its own body: a python skin stretched over a small
 * hexagonal box, the bridge standing on the skin.
 *
 * The string and the bow are the fiddle's: Helmholtz motion from the hair's stick and slip,
 * the stroke's bite, rosin on every slip. What the erhu changes:
 * - Two strings, the inner tuned to D4 and the outer to A4, with the bow's hair passing
 *   between them. The hair lies against the string it is not playing and damps it: in the
 *   recordings the idle string's partials stand no more than 2 dB over the noise between
 *   the played note's harmonics (as much as at any other frequency), so no second string
 *   rings here. The two open notes, D4 and A4, sound from the nut; every other is stopped.
 * - No fingerboard. A stopped string is held by the fingertip alone, so the end of the
 *   string is the finger's soft pad, which rounds and loses each wave (BOW_TUNING.finger);
 *   an open string ends on the nut. With the pad, the held harmonics came 0.4 dB closer to
 *   the recordings, register by register, and the highest register 1 dB closer.
 * - The python skin and the small box (ERHU_BODY): little under the skin's first strong
 *   modes near 470 and 750 Hz (a third-order fall under 600 Hz), so a low note is mostly
 *   its harmonics, then the nasal peak at 1.6 to 1.9 kHz, a dip near 2 kHz and a bright
 *   edge from 3 to 8 kHz.
 * - The stroke speaks fast and starts with an accent, much faster than the kamancheh's: a
 *   loud stroke within 3 dB of its held level in about 20 ms, a soft one in about 50.
 * - The rosin's noise between the harmonics stays about the same at every strength, as the
 *   recordings' does.
 * - The left hand (erhuPlay): a slow, wide vibrato (the rouxian) on most long notes, slides
 *   along the string between slurred notes and into the notes the composer bends (the
 *   huayin), a slide up to the neighbour and back, and a fall off a held note into a rest.
 *   Without a fingerboard the finger moves freely, but never under the open inner string.
 *
 * Measured against recordings of solo erhu, for measurement only (no recording is in this
 * repository): the ErhuPT dataset (Zenodo 4320991, CC BY 4.0: 729 clips of detache,
 * vibrato, slides, legato and staccato by several players), four CC0 erhu recordings from
 * Freesound (565196, 748144, 477169, 423496) and the FolkMusic dataset's erhu clips (Zenodo
 * 8012071, CC BY 4.0), each source weighted equally. Against them:
 * - held harmonics 1 to 8 within 3.2 dB (rms) on average register by register from D4 to
 *   B6 (2.0 to 4.7 by register);
 * - over the same phrases played by the model and by the players (the model following
 *   their pitch, stroke by stroke), the long-term spectrum from 250 Hz to 8 kHz 4.6 to 9
 *   dB (rms over third-octave bands) from each recording, 2.5 dB in the median over the
 *   full-band ones, where the voice it replaced was 10 to 18 dB from each;
 * - noise between the harmonics from 1 to 8 kHz 38 to 48 dB under them (recorded 40 to 48);
 * - a stroke within 3 dB of its held level after 21 ms loud, 25 at mezzo-forte and 50
 *   soft (recorded 2, 18 and 56);
 * - over the composer's lines, vibrato on about 60% of the held notes (recorded music 46
 *   to 50%), at 5.0 a second (4.9 to 5.6), 16 cents (11 to 23); slides of more than 90 ms
 *   0.27 a second (0.17 to 0.25), a median slide of 2 semitones (2.2);
 * - no stroke loses Helmholtz motion over the composer's range, every strength, slurred,
 *   slid and sung (lofi-erhu.test.ts sweeps the range).
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */
import type { LofiNote } from '../../../../engine/src/lofi-compose.ts';
import { BOW_TUNING, bowSource, resonate, type BodyModes, type BowNote, type BowTuning } from './lofi-bowed.ts';

/** The open strings (MIDI): the inner string's D4 and the outer string's A4. */
export const ERHU_INNER = 62, ERHU_OUTER = 69;

/** The erhu's string under the bow (see BOW_TUNING for what each constant does): the rosin's crackle the same at every strength, a quicker stroke with an accent, a heavier bow a little further from the bridge. */
export const ERHU_TUNING: BowTuning = {
  ...BOW_TUNING,
  rosinDirect: 0.85, rosinGrow: 1, rosinLoud: 0, rosinHigh: 1100,
  rampSoft: 0.08, rampLoud: 0.03, accent: 3, accentFrom: 0.4, accentTime: 0.05,
  kappa: 0.22, beta: 0.12, wander: 3,
};
/** The stroke's start by strength: how long the bow drags (s) and at what share of its speed, softest to loudest (the crawl rising as the square). */
export const ERHU_STROKE = { creepSoft: 0.03, creepLoud: 0.001, crawlSoft: 0.25, crawlLoud: 0.9 };

/**
 * The skin and box as modes: frequency (Hz), level (dB) and Q, a mode every twelfth of an
 * octave to 2.7 kHz and every eighth above, their levels fitted to the recorded held
 * harmonics with the string's own taken off. Under ERHU_CUT the box radiates less and less
 * (ERHU_CUT_ORDER second-order sections).
 */
export const ERHU_BODY: BodyModes = [
  [280, -14.3, 12], [297, -23.6, 12], [314, -28.5, 12], [333, -35.2, 12], [353, -42.1, 12], [374, -44.3, 12],
  [396, -43.0, 12], [420, -37.6, 12], [444, -27.6, 12], [471, -11.2, 12], [499, -14.4, 12], [529, -22.0, 12],
  [560, -29.7, 12], [593, -23.2, 12], [629, -25.3, 25], [666, -32.7, 25], [706, -30.7, 25], [748, -23.3, 25],
  [792, -24.8, 25], [839, -21.0, 25], [889, -25.7, 25], [942, -26.6, 25], [998, -29.5, 25], [1057, -31.5, 25],
  [1120, -29.2, 25], [1187, -30.0, 25], [1257, -30.5, 40], [1332, -29.2, 40], [1411, -26.1, 40], [1495, -26.6, 40],
  [1584, -19.9, 40], [1678, -7.4, 40], [1778, -8.0, 40], [1884, -18.1, 40], [1996, -26.9, 40], [2114, -34.0, 40],
  [2240, -31.0, 40], [2373, -29.2, 40], [2514, -30.0, 40], [2664, -28.5, 40], [2822, -25.6, 40], [3078, -23.5, 40],
  [3356, -8.6, 40], [3660, -20.6, 40], [3991, -18.7, 40], [4352, -12.3, 40], [4746, -17.0, 40], [5176, -4.0, 40],
  [5644, -10.4, 40], [6155, -14.1, 40], [6712, -15.7, 40], [7320, -4.0, 40], [7982, -8.4, 40], [8705, -8.6, 40],
  [9493, -15.2, 40], [10352, -11.6, 40],
];
export const ERHU_CUT = 600;
const ERHU_CUT_ORDER = 3;

/** A second-order high-pass (RBJ, Q 0.7) run over `x` in place. */
function lowCut(sr: number, x: Float32Array, hz: number): void {
  const w = (2 * Math.PI * hz) / sr, c = Math.cos(w), alpha = Math.sin(w) / 1.4, a0 = 1 + alpha;
  const b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, b2 = b0, a1 = (-2 * c) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[i] = y;
  }
}

/** The skin and box's response to the force on the bridge. */
export function erhuBody(sr: number, x: Float32Array): Float32Array {
  const y = resonate(sr, x, ERHU_BODY);
  for (let k = 0; k < ERHU_CUT_ORDER; k++) lowCut(sr, y, ERHU_CUT);
  return y;
}

/** The hair's corner as harmonics of the note (BOW_TUNING.hair), as the kamancheh's. */
export const ERHU_HAIR = 2.2;

/** The finger's pad on a stopped note (BOW_TUNING.finger): no fingerboard under the string, so the pad alone stops the string. */
export const ERHU_FINGER = 0.3;

/** Whether a note is an open string (no finger). */
export function erhuOpen(f: number): boolean {
  const m = 69 + 12 * Math.log2(f / 440);
  return Math.abs(m - ERHU_INNER) < 0.25 || Math.abs(m - ERHU_OUTER) < 0.25;
}

/** The string's constants for a note at `f` Hz bowed at strength `vel`. */
export function erhuTuning(f: number, vel = 0.5): BowTuning {
  const S = ERHU_STROKE, v = Math.min(1, Math.max(0, vel));
  return {
    ...ERHU_TUNING, hair: ERHU_HAIR * f, finger: erhuOpen(f) ? 0 : ERHU_FINGER,
    creep: S.creepSoft + (S.creepLoud - S.creepSoft) * v, crawl: S.crawlSoft + (S.crawlLoud - S.crawlSoft) * v * v,
  };
}

/** Bow one erhu note: the string through the skin. */
export function bowErhu(n: BowNote, rand: () => number): Float32Array {
  return erhuBody(n.sr, bowSource(n, rand, erhuTuning(n.f, n.vel)));
}

/** How an erhu player sings, measured on recorded erhu music (see erhuPlay). */
export const ERHU_PLAYER = {
  /** A note held longer than `vibratoFrom` s sings with vibrato `vibratoShare` of the time. */
  vibratoFrom: 0.3, vibratoShare: 0.6,
  /** The rouxian's depth (cents, half its swing): log-normal about `vibrato` by `vibratoSpread`, within `vibratoLeast` to `vibratoMost`. */
  vibrato: 16, vibratoSpread: 0.6, vibratoLeast: 6, vibratoMost: 60,
  /** Its rate (Hz): about `rate`, by `rateSpread`, within 4 to 6.5. */
  rate: 5.1, rateSpread: 0.45,
  /** A slurred note's glide (s), the finger sliding along the string: log-normal about `slurGlide` by `slurSpread`. */
  slurGlide: 0.04, slurSpread: 0.7,
  /**
   * A note the composer bends (art 1): slid into from below `slideShare` of them (a whole
   * tone, or a minor third `slideWide` of the time) over `slideGlide` s; slid into from
   * above `fromAbove` of them; or a return slide, up to the neighbour and back (huihuayin),
   * `returnShare` of them, `returnCents` up over `returnLen` s. The rest are played plain.
   */
  slideShare: 0.3, slideWide: 0.35, fromAbove: 0.08, slideGlide: 0.11,
  returnShare: 0.2, returnCents: 200, returnLen: 0.22,
  /** A held note left into a rest falls off its end (xiahuayin) `fallShare` of the time: `fallCents` down over the last `fallLen` s. */
  fallShare: 0.15, fallCents: 250, fallLen: 0.16,
} as const;

/** What the composer and the station say about a note: how long it is held (s), its art, whether it is slurred and whether a rest follows. */
export interface ErhuNote { midi: number; held: number; art: number; slurred: boolean; rest?: boolean }
/** How the player plays it: the BowNote's left-hand parts. */
export type ErhuPlay = Pick<BowNote, 'vibrato' | 'rate' | 'slide' | 'glide' | 'bend' | 'reach'>;

/** A standard normal draw (Box-Muller), cut at 2.5. */
function gauss(rand: () => number): number {
  const v = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  return Math.max(-2.5, Math.min(2.5, v));
}
/** A smooth step from 0 to 1 as `u` goes from 0 to 1. */
const ease = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/**
 * The left hand's choices for one note, from the player's seeded source: whether and how
 * wide it sings, how a slur glides along the string, and, on a note the composer bends, a
 * slide in from below or above or a return slide; a note left into a rest may fall off its
 * end. The erhu has no fingerboard, so every slide is the finger moving freely along the
 * string, and no slide goes under the open inner string.
 */
export function erhuPlay(n: ErhuNote, rand: () => number): ErhuPlay {
  const P = ERHU_PLAYER;
  const sings = n.held > P.vibratoFrom && rand() < P.vibratoShare;
  const vibrato = sings ? Math.min(P.vibratoMost, Math.max(P.vibratoLeast, P.vibrato * Math.exp(P.vibratoSpread * gauss(rand)))) : 0;
  const rate = Math.min(6.5, Math.max(4, P.rate + P.rateSpread * gauss(rand)));
  const play: ErhuPlay = { vibrato, rate, slide: 0, reach: 0 };
  if (n.slurred) play.glide = P.slurGlide * Math.exp(P.slurSpread * gauss(rand));
  const room = n.midi - ERHU_INNER;
  const bends: Array<(s: number) => number> = [];
  if (n.art === 1) {
    const pick = rand();
    if (pick < P.slideShare && !n.slurred && room >= 2) {
      play.slide = rand() < P.slideWide && room >= 3 ? 3 : 2;
      play.glide = P.slideGlide * (0.75 + 0.5 * rand());
    } else if (pick < P.slideShare + P.fromAbove && !n.slurred) {
      play.slide = -2;
      play.glide = P.slideGlide * (0.75 + 0.5 * rand());
    } else if (pick < P.slideShare + P.fromAbove + P.returnShare && n.held > P.returnLen + 0.1) {
      const cents = P.returnCents * (0.8 + 0.4 * rand()), len = P.returnLen * (0.8 + 0.4 * rand()), at = 0.03;
      bends.push((s: number) => { const u = (s - at) / len; return u <= 0 || u >= 1 ? 0 : cents * (u < 0.4 ? ease(u / 0.4) : ease((1 - u) / 0.6)); });
    }
  }
  if (n.rest && n.held > 0.45 && rand() < P.fallShare) {
    const len = P.fallLen * (0.75 + 0.5 * rand()), cents = Math.min(P.fallCents * (0.8 + 0.4 * rand()), Math.max(0, room) * 100), from = n.held - len;
    if (cents > 50) {
      bends.push((s: number) => -cents * ease((s - from) / len));
      play.reach = cents / 100 + 0.2;
    }
  }
  if (bends.length) play.bend = (s: number) => bends.reduce((a, b) => a + b(s), 0);
  return play;
}

/**
 * How loud an erhu note comes out of the model (dB, held): a, plus b a unit of strength over
 * a half, plus c a semitone over C5, measured on the model.
 */
export const ERHU_RAW: readonly [number, number, number] = [-23.2, 15.0, -0.05];

/** Added to an erhu note's `mod` (lib/lofi-perform.ts marks it): a rest follows, so a held note may fall off its end. */
export const ERHU_REST = 2;
/** A rest this long (s) after a note leaves it free to fall off its end. */
const REST_AFTER = 0.25;

/**
 * An erhu player reads the line ahead: each lead note followed by a rest of REST_AFTER s or
 * more is marked ERHU_REST, so the player may let it fall off its end. A bar whose lead is
 * doubled is left as written (the doubling instrument reads the composer's own `mod`).
 */
export function erhuist(notes: LofiNote[], spb: number, doubled: boolean): void {
  if (doubled) return;
  const lines = notes.map((n, i) => ({ n, i })).filter(({ n }) => n.voice === 'lead').sort((a, b) => a.n.beat - b.n.beat);
  for (let k = 0; k < lines.length; k++) {
    const { n, i } = lines[k]!, next = lines[k + 1]?.n;
    const after = ((next ? next.beat : 4) - (n.beat + n.dur)) * spb;
    if (after >= REST_AFTER) notes[i] = { ...n, mod: (n.mod ?? 0) | ERHU_REST };
  }
}
