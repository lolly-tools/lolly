// SPDX-License-Identifier: MPL-2.0
/**
 * The low bowed strings, modelled: the viola, the cello and the double bass, each the
 * fiddle's bowed string (lib/lofi-bowed.ts) with its own bowing and its own body, and the
 * double bass plucked.
 *
 * The string is the fiddle's: two delay lines either side of the bow, the hair gripping
 * and letting go, Helmholtz motion. What each instrument changes, measured on recorded
 * players of it:
 * - the bow: further from the bridge on the bigger instruments and a little heavier, so
 *   the low strings' long periods still find Helmholtz motion on every stroke; the force
 *   still goes on before the speed (Guettler) and a slurred note plays the old one first
 *   for longer the lower the instrument, so no note leaves Helmholtz motion over its
 *   whole range (lofi-strings-bowed.test.ts sweeps every semitone, strength, slur and
 *   slide);
 * - the stroke: up to speed in about the same time on every note of an instrument, as
 *   the recordings' are, rather than in proportion to the note's period as the fiddle's;
 * - the corner and the hair: the hair's width follows the note (its corner a set number
 *   of harmonics up), so a soft stroke is darker than a loud one by about as much as on
 *   the recordings, which is little on a viola and a few dB on a cello or a bass;
 * - the rosin: as much crackle under a soft stroke as a loud one, less on high notes;
 * - the body (lib/lofi-string-bodies.ts): band-pass modes fitted to the recordings, the
 *   air mode and the wood's first modes where each instrument has them, the box's fall
 *   below them, and the low modes damped as a big box's are.
 *
 * Measured, for measurement only (no recording is in this repository), against the
 * University of Iowa's anechoic viola, cello and double bass at three strengths and the
 * Philharmonia's at six, with the Iowa 2012 and the VSCO 2 solo double bass besides.
 * See BOWED for what each constant does.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */
import { BOW_TUNING, bowSource, type BodyModes, type BowNote, type BowTuning } from './lofi-bowed.ts';
import { STRING_BODIES } from './lofi-string-bodies.ts';
import { pluckString } from './lofi-strings.ts';

/** The bowed strings this module models. */
export type BowedString = 'viola' | 'cello' | 'doublebass';
export const BOWED_STRINGS: readonly BowedString[] = ['viola', 'cello', 'doublebass'];
/** Each instrument's range (MIDI notes): its lowest open string to as high as it is asked to play. */
export const BOWED_RANGE: Record<BowedString, readonly [number, number]> = { viola: [48, 84], cello: [36, 76], doublebass: [28, 62] };

/**
 * A body: its modes (frequency Hz, level dB, Q), each a band-pass resonance whose peak is
 * its level, the box's fall below its air mode (`order` second-order high-passes at `cut`
 * Hz) and, where the plates pass less and less up top, `topOrder` low-passes at `top` Hz.
 * Band-pass modes have no response at rest, so the low notes' fundamentals come through
 * only as strongly as the box near them lets them, which a low instrument needs.
 */
export interface StringBody { modes: BodyModes; cut: number; order: number; top?: number; topOrder?: number }

/** One instrument's string and bow (see bowedTuning for how a note's constants follow from these). */
export interface BowedSpec {
  /** The string's constants (see BOW_TUNING) the note-by-note ones below leave as they are. */
  tuning: BowTuning;
  /** The hair's corner (BOW_TUNING.hair) as harmonics of the note. */
  hair: number;
  /** A note at `ref` Hz: the stroke's ramp up to speed (s) softly and at full strength, and how far it follows the note's period (1 in proportion, as the fiddle's; 0 the same for every note). */
  ref: number; rampSoft: number; rampLoud: number; rampFollow: number;
  /** The rosin's crackle at the bridge (BOW_TUNING.rosinDirect) for a note at `ref`, falling as the note rises by this power of its frequency. */
  rosinDirect: number; rosinFall: number;
}

export const BOWED: Record<BowedString, BowedSpec> = {
  viola: {
    tuning: { ...BOW_TUNING, poleSoft: 0.3, poleLoud: 0.05, crawl: 0.35, kappa: 0.2, beta: 0.11, accent: 0.8, forceAccent: 1, slurPreroll: 0.2, rosinGrow: 5, rosinLoud: 0 },
    hair: 16, ref: 262, rampSoft: 0.06, rampLoud: 0.12, rampFollow: 0, rosinDirect: 0.5, rosinFall: 0.8,
  },
  cello: {
    tuning: { ...BOW_TUNING, poleSoft: 0.6, poleLoud: 0.25, kappa: 0.2, beta: 0.12, accent: 0.8, forceAccent: 1, slurPreroll: 0.3, rosinGrow: 5, rosinLoud: 0 },
    hair: 6, ref: 131, rampSoft: 0.3, rampLoud: 0.18, rampFollow: 0, rosinDirect: 0.5, rosinFall: 0.8,
  },
  doublebass: {
    tuning: { ...BOW_TUNING, poleSoft: 0.6, poleLoud: 0.05, kappa: 0.18, beta: 0.14, accent: 0.5, forceAccent: 1, bite: 0.3, biteFull: 1, slurPreroll: 0.45, rosinGrow: 5, rosinLoud: 0 },
    hair: 8, ref: 65.4, rampSoft: 0.14, rampLoud: 0.06, rampFollow: 0, rosinDirect: 0.5, rosinFall: 0.8,
  },
};

/** The fiddle's ramp is set for C5 and scaled by the note's period; the low strings set theirs at their own `ref`. */
const C5 = 523.25;

/** An instrument's string constants for a note at `f` Hz. */
export function bowedTuning(inst: BowedString, f: number): BowTuning {
  const s = BOWED[inst];
  const follow = (s.ref / f) ** s.rampFollow * (f / C5);
  return {
    ...s.tuning,
    hair: s.hair * f,
    rampSoft: s.rampSoft * follow, rampLoud: s.rampLoud * follow,
    rosinDirect: s.rosinDirect * (f / s.ref) ** -s.rosinFall,
  };
}

/** A second-order section's coefficients and state. */
interface Section { b0: number; b1: number; b2: number; a1: number; a2: number; x1: number; x2: number; y1: number; y2: number }

/** A body's response to the force on the bridge: its modes ringing, summed, then the fall below the air mode. */
export function stringBody(sr: number, x: Float32Array, body: StringBody): Float32Array {
  const modes = body.modes.filter(([hz]) => hz < sr * 0.45).map(([hz, db, q]) => {
    const w = (2 * Math.PI * hz) / sr, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
    return { g: (10 ** (db / 20) * alpha) / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - alpha) / a0, y1: 0, y2: 0 };
  });
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    // Every band-pass mode shares the input's second difference: b0 (x - x2).
    const d = v - x2;
    x2 = x1; x1 = v;
    let y = 0;
    for (const m of modes) {
      const o = m.g * d - m.a1 * m.y1 - m.a2 * m.y2;
      m.y2 = m.y1; m.y1 = o;
      y += o;
    }
    out[i] = y;
  }
  const cuts: Section[] = [];
  const w = (2 * Math.PI * body.cut) / sr, c = Math.cos(w), alpha = Math.sin(w) / 1.4, a0 = 1 + alpha;
  for (let k = 0; k < body.order; k++) cuts.push({ b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0 });
  if (body.top && body.topOrder) {
    const wt = (2 * Math.PI * Math.min(body.top, sr * 0.45)) / sr, ct = Math.cos(wt), at = Math.sin(wt) / 1.4, a0t = 1 + at;
    for (let k = 0; k < body.topOrder; k++) cuts.push({ b0: (1 - ct) / 2 / a0t, b1: (1 - ct) / a0t, b2: (1 - ct) / 2 / a0t, a1: (-2 * ct) / a0t, a2: (1 - at) / a0t, x1: 0, x2: 0, y1: 0, y2: 0 });
  }
  for (const s of cuts) {
    for (let i = 0; i < out.length; i++) {
      const v = out[i]!;
      const y = s.b0 * v + s.b1 * s.x1 + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2;
      s.x2 = s.x1; s.x1 = v; s.y2 = s.y1; s.y1 = y;
      out[i] = y;
    }
  }
  return out;
}

/**
 * After the bow lifts, how long (s) the left hand takes to quiet the string, as a time
 * constant from DAMP_FROM s on: a long low string otherwise rings on for seconds, as it
 * does plucked, where a player lifting the bow lets it sound only a moment.
 */
const DAMP: Record<BowedString, number> = { viola: 0.12, cello: 0.15, doublebass: 0.18 };
const DAMP_FROM = 0.06;
/** How long a note sounds after the bow lifts until it is some 35 dB down (s): what a player has to render past the note. */
export const bowedTail = (inst: BowedString): number => DAMP_FROM + 4 * DAMP[inst];

/** Bow one note on an instrument: its string through its body, quieted after the bow lifts. */
export function bowInstrument(inst: BowedString, n: BowNote, rand: () => number): Float32Array {
  const y = stringBody(n.sr, bowSource(n, rand, bowedTuning(inst, n.f)), STRING_BODIES[inst]);
  const from = Math.round((n.dur + DAMP_FROM) * n.sr), fall = Math.exp(-1 / (DAMP[inst] * n.sr));
  let g = 1;
  for (let i = Math.max(0, from); i < y.length; i++) { g *= fall; y[i]! *= g; }
  return y;
}

// ── the double bass plucked ──────────────────────────────────────────────────

/** A plucked double bass note: sample rate, pitch (Hz), how hard (0 to 1) and how long to render (s). */
export interface PizzNote { sr: number; f: number; vel: number; seconds: number }

/**
 * The plucked double bass (pizzicato), measured on recorded basses: the string plucked
 * with the side of a finger (lib/lofi-strings.ts), heard through the same body as the bowed
 * bass. `pickAt` is where along the string it is plucked, `bright` the pluck's corner (as
 * harmonics of the note) softly and `brightLoud` at full strength, `decay` the seconds the
 * fundamental takes to fall 60 dB and `mellow` the harmonic down 20 dB a quarter of a second
 * in. The finger meeting the fingerboard knocks the body: `thump` of the note's level, a
 * burst of low noise under `thumpHz` lasting `thumpTime` s.
 */
export const PIZZ = {
  pickAt: 0.22, bright: 3, brightLoud: 4.5, decay: 3, mellow: 14, noise: 0.15, plane: 0.5, beat: 1.2, top: 4000,
  thump: 0.8, thumpHz: 180, thumpTime: 0.02,
};

/** Pluck one double bass note: the string through the body, with the knock of the finger. */
export function pluckBass(n: PizzNote, rand: () => number): Float32Array {
  const P = PIZZ;
  const v = Math.min(1, Math.max(0, n.vel));
  const s = pluckString({
    sr: n.sr, f: n.f, seconds: n.seconds, pickAt: P.pickAt, bright: P.bright + (P.brightLoud - P.bright) * v,
    decay: P.decay, mellow: P.mellow, noise: P.noise, plane: P.plane, beat: P.beat, top: P.top,
  }, rand);
  // The knock: low noise, falling away over thumpTime, into the body with the string.
  const a = Math.exp((-2 * Math.PI * P.thumpHz) / n.sr), fall = Math.exp(-1 / (P.thumpTime * n.sr));
  let lp = 0, lp2 = 0, env = P.thump * (0.4 + 0.6 * v);
  for (let i = 0; i < s.length && env > 1e-4; i++) {
    lp = (1 - a) * (rand() * 2 - 1) + a * lp;
    lp2 = (1 - a) * lp + a * lp2;
    s[i]! += lp2 * env;
    env *= fall;
  }
  return stringBody(n.sr, s, STRING_BODIES.doublebass);
}
