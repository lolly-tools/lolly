// SPDX-License-Identifier: MPL-2.0
/**
 * The kamancheh, the Persian spike fiddle, modelled on the fiddle's bowed string
 * (lib/lofi-bowed.ts) and heard through its own body: a skin stretched over a small
 * mulberry bowl, the bridge standing on the skin, the instrument turned on its spike
 * rather than the bow on the string.
 *
 * The string and the bow are the fiddle's: Helmholtz motion from the hair's stick and slip,
 * the stroke's bite and scratch, rosin on every slip, the arm's sway. What the kamancheh
 * changes is what it is heard through, and how it is played.
 *
 * The body. A violin's wooden top has its air mode near 280 Hz and its plates' modes from
 * 400 Hz, so a low note keeps its fundamental. The kamancheh's skin is lighter and its bowl
 * small: below the skin's first strong mode, near 760 Hz, the skin moves stiffly and the
 * bowl radiates little, so the response falls about 24 dB an octave under some 580 Hz (at
 * 250 Hz it sits about 34 dB further under 1 kHz than the violin's does), and a note on the
 * low strings is mostly its harmonics: the thin, nasal sound. From 800 Hz to 4 kHz the
 * skin's modes hold a plateau within about 4 dB, where a violin's response falls away, and
 * above that it falls only some 9 dB to 10 kHz: the bright, buzzy edge.
 *
 * The playing, measured on the same recordings (see KAMANCHEH_PLAYER): a vibrato on about
 * half the held notes, wider than a violinist's and from player to player very different
 * (half its swing 9 to 26 cents, 15 typical, up to about 50), at 4.7 to 6.3 a second; notes
 * changed under one bow in a quick slide of the finger; slides up (now and then down) into
 * a note; and the tahrir's turn, a flick up to the note above, or down to the one below,
 * and back in about 160 ms, as a singer breaks the voice; a little more noise under every
 * held note than the fiddle carries; and a stroke that takes about 100 ms to speak.
 *
 * Measured against recordings of solo kamancheh, for measurement only (no recording is in
 * this repository): the PCMIR database (Mousavi, Prasath and Mousavi, 2019, CC BY 4.0),
 * 363 five-second phrases by several players, measured the same way as the composer's
 * Persian lines played by this model and by the voice it replaced. Against them:
 * - held harmonics 1 to 10 within about 2 dB (rms, every semitone C4 to G#5) and the 11th
 *   to 16th within 3 dB, register by register; the old voice kept a violin's fundamental,
 *   5 to 11 dB too strong below D5;
 * - noise between the harmonics from 1 to 8 kHz 28 dB under them (recorded 30, the old
 *   voice 51), and 37 dB from 200 Hz to 2 kHz (recorded 35, old 75);
 * - vibrato on about half the held notes (recorded 55%, old every one), 16 cents typical
 *   (recorded 15, old a fixed 23) at about 6 a second; turns about one every five seconds
 *   of playing (recorded one every four, old none);
 * - a stroke within 3 dB of its held level after about 100 ms (recorded 108, old a fixed
 *   67), its first 25 ms some 20 dB under (recorded 26: a slower start sent loud low
 *   strokes into double slip, as on the fiddle);
 * - no note leaves Helmholtz motion once it has spoken, G3 to D6, slurred, slid, turned
 *   and sung wide (lofi-spike-fiddles.test.ts sweeps every case).
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */
import { BOW_TUNING, bowSource, resonate, type BodyModes, type BowNote, type BowTuning } from './lofi-bowed.ts';

/**
 * The kamancheh's string: the fiddle's, with more rosin on the slips, broader and growing
 * only as the bow's speed does (its held notes carry more noise between the harmonics than
 * a violin's, and the loudest the least), the crackle following the bow up to speed, a
 * slower stroke and a less steady finger, as measured.
 */
export const KAMANCHEH_TUNING: BowTuning = {
  ...BOW_TUNING,
  rosinDirect: 3.9, rosinGrow: 1, rosinLoud: 0, rosinHigh: 700, rosinFollow: 1,
  rampSoft: 0.22, rampLoud: 0.12, wander: 4.5,
};

/**
 * The skin and bowl as modes: frequency (Hz), level (dB) and Q. The bowl's air and the
 * skin's first modes low (the strongest near 760 Hz), then a mode every eighth of an octave
 * from 1 kHz (the two the fit left silent taken out), their levels fitted to the recorded
 * harmonics register by register, with the string's own taken off. Below KAMANCHEH_CUT the
 * bowl radiates less and less (KAMANCHEH_CUT_ORDER second-order sections).
 */
const KAMANCHEH_BODY: BodyModes = [
  [300, -19.0, 14], [560, -23.7, 18], [760, -10.1, 22], [1000, -4.7, 40], [1189, -14.7, 40], [1297, -13.3, 40],
  [1414, -14.0, 40], [1542, -13.1, 40], [1682, -7.2, 40], [1834, -13.6, 40], [2000, -11.4, 40], [2181, -6.3, 40],
  [2378, -7.6, 40], [2594, -7.5, 40], [2828, -11.5, 40], [3084, -4.3, 40], [3364, -2.3, 40], [3668, -6.5, 40],
  [4000, -5.2, 40], [4362, -2.1, 40], [4757, -5.6, 40], [5187, -6.0, 40], [5657, -9.5, 40], [6169, 0.0, 40],
  [6727, -6.5, 40], [7336, -5.3, 40], [8000, -9.4, 40], [8724, -12.0, 40], [9514, -12.5, 40],
];
const KAMANCHEH_CUT = 580;
const KAMANCHEH_CUT_ORDER = 2;

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

/** The skin and bowl's response to the force on the bridge. */
export function skinBody(sr: number, x: Float32Array): Float32Array {
  const y = resonate(sr, x, KAMANCHEH_BODY);
  for (let k = 0; k < KAMANCHEH_CUT_ORDER; k++) lowCut(sr, y, KAMANCHEH_CUT);
  return y;
}

/**
 * The hair's corner (see BOW_TUNING.hair) as harmonics of the note: the recordings' high
 * notes keep their upper harmonics where the low ones lose theirs at the same frequencies,
 * as a thin top string does against the thick low ones, so the corner follows the note.
 */
const KAMANCHEH_HAIR = 2.2;

/** The string's constants for a note at `f` Hz. */
export function kamanchehTuning(f: number): BowTuning {
  return { ...KAMANCHEH_TUNING, hair: KAMANCHEH_HAIR * f };
}

/** Bow one kamancheh note: the string through the skin. */
export function bowKamancheh(n: BowNote, rand: () => number): Float32Array {
  return skinBody(n.sr, bowSource(n, rand, kamanchehTuning(n.f)));
}

/**
 * How loud a kamancheh note comes out of the model (dB, held): a, plus b a unit of strength
 * over a half, plus c a semitone over C5, measured. It rises with the note, as the skin
 * lets less of a low note's fundamental through.
 */
export const KAMANCHEH_RAW: readonly [number, number, number] = [-18.3, 18.7, 0.37];

/**
 * The gain that brings a modelled note to a steady level: how loud it is held (RMS over the
 * part after its attack), with `kept` of its own difference from `expected` (dB) left in,
 * so the notes the body favours still stand out a little, as they do on the instrument.
 */
export function steadyGain(data: Float32Array, sr: number, held: number, expected: number, kept: number): number {
  const a = Math.floor(Math.min(0.06, held / 3) * sr), b = Math.max(a + 32, Math.floor(Math.min(held, 0.6) * sr));
  let s = 0;
  for (let i = a; i < b && i < data.length; i++) s += data[i]! * data[i]!;
  const own = 10 * Math.log10(s / (b - a) + 1e-20);
  return 10 ** (-((1 - kept) * own + kept * expected) / 20);
}

/** How a kamancheh player sings, measured on the recordings (see kamanchehPlay). */
export const KAMANCHEH_PLAYER = {
  /** A note held longer than `vibratoFrom` s sings with vibrato `vibratoShare` of the time. */
  vibratoFrom: 0.3, vibratoShare: 0.6,
  /** The vibrato's depth (cents, half its swing): log-normal about `vibrato` by `vibratoSpread`, within `vibratoLeast` to `vibratoMost`. */
  vibrato: 15, vibratoSpread: 0.75, vibratoLeast: 5, vibratoMost: 50,
  /** Its rate (Hz): about `rate`, by `rateSpread`, within 4 to 7.5. */
  rate: 6.2, rateSpread: 0.7,
  /** A slurred note's glide (s): log-normal about `slurGlide` by `slurSpread`. */
  slurGlide: 0.025, slurSpread: 0.5,
  /**
   * A note the composer bends (art 1): slid into, `slideShare` of them, from a semitone (a
   * whole tone `slideWide` of the time) below, or above `slideDown` of the time, over
   * `slideGlide` s; or turned (`turnShare` of them, see below); or played plain.
   */
  slideShare: 0.1, slideWide: 0.35, slideDown: 0.1, slideGlide: 0.16,
  /**
   * The tahrir's turn: a flick to the neighbour above (below `turnDown` of the time) by
   * `turnCents` (spread by `turnSpread`, never past `turnMost`) and back, over `turnLen`
   * s, starting `turnAt` s into the note, and a second straight after it `turnTwice` of
   * the time.
   */
  turnShare: 0.45, turnDown: 0.4, turnCents: 165, turnSpread: 0.3, turnMost: 250, turnLen: 0.15, turnAt: 0.06, turnTwice: 0.3,
} as const;

/** What the composer and the station say about a note: how long it is held (s), its art, and whether it is slurred. */
export interface KamanchehNote { held: number; art: number; slurred: boolean }
/** How the player plays it: the BowNote's left-hand parts. */
export type KamanchehPlay = Pick<BowNote, 'vibrato' | 'rate' | 'slide' | 'glide' | 'bend' | 'reach'>;

/** A standard normal draw (Box-Muller), cut at 2.5. */
function gauss(rand: () => number): number {
  const v = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  return Math.max(-2.5, Math.min(2.5, v));
}

/**
 * A flick away and back, as the finger does it: up in the first 15% (a quick step, as the
 * recordings' are), held, and back over the last 30%.
 */
function flick(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.15) { const a = u / 0.15; return a * a * (3 - 2 * a); }
  if (u < 0.7) return 1;
  const a = (1 - u) / 0.3;
  return a * a * (3 - 2 * a);
}

/**
 * The left hand's choices for one note, from the player's seeded source: whether and how
 * wide it sings, how a slur glides, and, on a note the composer bends, a slide in or a turn.
 */
export function kamanchehPlay(n: KamanchehNote, rand: () => number): KamanchehPlay {
  const P = KAMANCHEH_PLAYER;
  const sings = n.held > P.vibratoFrom && rand() < P.vibratoShare;
  const vibrato = sings ? Math.min(P.vibratoMost, Math.max(P.vibratoLeast, P.vibrato * Math.exp(P.vibratoSpread * gauss(rand)))) : 0;
  const rate = Math.min(7.5, Math.max(4, P.rate + P.rateSpread * gauss(rand)));
  const play: KamanchehPlay = { vibrato, rate, slide: 0, reach: 0 };
  if (n.slurred) play.glide = P.slurGlide * Math.exp(P.slurSpread * gauss(rand));
  if (n.art !== 1) return play;
  const pick = rand();
  if (pick < P.slideShare && !n.slurred) {
    const by = rand() < P.slideWide ? 2 : 1;
    play.slide = rand() < P.slideDown ? -by : by;
    play.glide = P.slideGlide * (0.75 + 0.5 * rand());
  } else if (pick < P.slideShare + P.turnShare && n.held > P.turnAt + P.turnLen + 0.05) {
    const down = rand() < P.turnDown;
    const cents = (down ? -1 : 1) * Math.min(P.turnMost, P.turnCents * Math.exp(P.turnSpread * gauss(rand)));
    const len = P.turnLen * (0.8 + 0.4 * rand());
    const twice = n.held > P.turnAt + 2 * len + 0.05 && rand() < P.turnTwice;
    const at = P.turnAt;
    play.bend = (s: number): number => cents * (flick((s - at) / len) + (twice ? 0.8 * flick((s - at - len) / len) : 0));
    if (down) play.reach = -cents / 100 + 0.2;
  }
  return play;
}
