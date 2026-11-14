// SPDX-License-Identifier: MPL-2.0
/**
 * Flutes blown, modelled: a jet of breath across an edge driving a pipe, worked out in JS one
 * note at a time and played back, as the reeds and the brass are (lib/lofi-reeds.ts,
 * lib/lofi-brass.ts).
 *
 * The player blows a thin jet across the mouth hole at the edge opposite. The air in the
 * pipe sways in and out of the hole, and as it does it pushes the jet a little to one side.
 * The jet amplifies that push near its own preferred frequency (the player sets the lips so
 * that frequency is the note's) and carries it to the edge a moment later (the jet's delay).
 * At the edge the jet splits, some of it into the pipe and some out over the top, and the
 * share that goes in saturates when the jet swings wholly to one side; a jet never quite
 * centred on the edge splits unevenly, which gives the even harmonics. The changing flow
 * drives the pipe like a piston and starts a wave down the bore; the far end turns it back,
 * the top first lost, and the loop sustains itself at the pipe's resonance.
 *
 * - The flute's pipe is open at both ends, so every harmonic of the note can ring in the pipe.
 * - The pan flute's pipes are stopped at the bottom: a wave comes back unturned, the pipe
 *   sounds an octave under an open one its length, and only the odd harmonics ring. Its even
 *   harmonics come from the jet itself, heard over the top of the pipe.
 *
 * A harder breath swings the jet further past the edge, so the split saturates and the note
 * fills out with harmonics: louder is brighter, as on a real flute. The jet is turbulent, so
 * there is breath in the tone: noise driving the pipe, which rings it into a breathy halo
 * round each harmonic, and a hiss of air over the hole. The tongue releases the jet already
 * swinging at the note, with a puff of air (the chiff); a held note gets a breath vibrato
 * that swells the tone and moves its pitch a little, and the breath is never quite steady;
 * a slurred note moves to its pitch under the same breath.
 *
 * The flute's breath is a player's, not a hiss laid over the tone (the pan flute keeps its
 * own): the turbulence comes as the jet swings into the pipe, once a period, so the air
 * pulses with the note; it sits in the middle of the band, as a recorded flute's does; it
 * grows against the tone the harder the player blows; and when the breath stops the air
 * outlasts the tone a moment, with a puff as the lips part. The pitch follows the breath, so
 * a tongued note starts a little sharp under the tongue's push. A player's choices come in
 * with the note (lib/lofi-perform.ts makes them): a softer "du" tongue, a note stopped by
 * the tongue for the next, a swell or a taper, and a vibrato that comes in late and wanders
 * in depth and rate. Breaths between phrases are the player's (lib/lofi-winds.ts draws them
 * with lib/lofi-breath.ts). Each articulated note starts with a burst of air as the tongue
 * lets the jet go, short and bright, every one its own (lib/lofi-breath.ts makes it from
 * FLUTE_BURST), and a quick note's jet never settles, so a fast run stays airy where a held
 * note clears. A breath running out (the player keeps track) brings more air and a shakier
 * breath.
 *
 * The flute's sound leaves it as a real one's does: rising with the frequency as it radiates
 * from the holes, and some 18 dB weaker over the tone holes' cutoff near 1.5 kHz, where the
 * bore no longer rings (the pipe's own sound only: the jet's turbulence goes straight out).
 * Up the range the player blows a faster jet with less air against the tone. So the low notes
 * are full and woody, their 2nd to 5th harmonics close under the 1st, the middle keeps its
 * 2nd and 3rd with little over them, and the top is nearly pure.
 *
 * The constants were set by measuring the model against recordings, for measurement only
 * (no recording is in this repository): a flute's sustained notes with and without vibrato
 * at three strengths, and a pan flute played in a studio (with a low pan pipe and a wooden
 * one for the breath). Against them:
 * - the flute's 2nd to 5th harmonics within a few dB at each strength, filling out with the
 *   breath as recorded (centroid about 1.35, 1.6 and 1.9 harmonics softly, at mezzo-forte
 *   and loud; recorded 1.25, 1.8 and 2.0);
 * - by register, over a studio player's 61 phrases (attacks left out) and an anechoic
 *   flute's notes: the 2nd to 5th harmonics 4.8 dB from the phrases' on average (before the
 *   cutoff, 6.1), C4 to F#4 carrying them 4 to 21 dB under the 1st (recorded 3 to 9; before,
 *   8 to 25), C5 to E5 its 4th 23 dB under (recorded 30; before, 20), C6 up its 2nd 22
 *   (recorded 29; before, 17); G4 to B4's 3rd is 7 dB too strong (recorded 14 under the 1st,
 *   before 12, now 6.5), where the fit gave ground;
 * - its breath 31 dB under the harmonics from 1 to 8 kHz (recorded 29 to 34), its chiff 9
 *   to 14 dB under them (recorded 8 to 14 at mezzo-forte), speaking within 3 dB in 80 ms
 *   at mezzo-forte (recorded 54 to 109) and in tune within 2 cents from C4 to C6;
 * - its vibrato 6, 12 and 18 cents at the three strengths with the level swinging 1.5 dB
 *   (recorded 6, 12 and 18 cents, 1.4 to 1.8 dB), released in about 300 ms (recorded 320);
 * - the pan flute's odd harmonics leading (2nd about 28 dB under the fundamental, 3rd 20,
 *   5th 30; recorded 30, 18 and 26), its breath 9 to 11 dB under them (recorded 10 to 21),
 *   its chiff 5 dB under (recorded 5 under to 2 over), speaking in 85 ms (recorded 70 to
 *   125);
 * - the flute's breath between the harmonics, by third-octave band from 500 Hz to 12.5 kHz
 *   against its harmonics, within about 3 dB of recorded flutes at three strengths (peaking
 *   near 1.6 to 2 kHz about 40 dB down at mezzo-forte, 13 dB lower at 500 Hz), where the old
 *   hiss rose to 11 dB too much at the top; the noise above 4 kHz pulsing at the pitch by
 *   31 to 35 dB (recorded 20 to 43; the old hiss 10 to 22);
 * - over whole phrases against a recorded professional's and a CC0 amateur's: tongued
 *   changes dipping 8.7 dB for 10 ms (recorded 7.4 dB for 15 ms, 6.8 for 5), tongued notes
 *   starting 7 to 14 cents sharp (recorded 10 and 19), phrase ends 1 to 4 cents flat
 *   (recorded 5 sharp to 6 flat), held notes moving 2.6 to 4.7 dB a second (recorded 1.7 to
 *   5.5), vibrato 8 to 10 cents at 5.1 to 5.5 Hz, its depth wandering by about 2 cents
 *   (recorded 9.7 cents at 5.9 Hz, wandering 2.0), and the breath after a phrase about 37
 *   to 49 dB under the notes (recorded 31 to 38 in a room; the old flute was silent);
 * - over recorded double- and triple-tongued runs: the air above 4 kHz jumping 5.9 dB over
 *   the note's own at each tongued onset for about 4 ms (recorded 5.5 dB, 6 ms; before the
 *   burst, 5.2 dB under), and quick notes (under 0.2 s apart) carrying 16 dB less air than
 *   tone where slow ones carry 25 (recorded 19 and 28; before, 29 and 28); and in the
 *   triple-tongued run at C5 the 3rd harmonic 11 dB under the 1st and the 4th 23 (recorded
 *   10 and 36; before the cutoff, 14 and 19).
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */

import { airBurst, type BurstShape } from './lofi-breath.ts';

export type Pipe = 'open' | 'stopped';

/**
 * How a flautist plays a lead note, in its `mod` (lib/lofi-perform.ts decides, lib/lofi-winds.ts
 * plays): FLUTE_PLAYED marks the flags as the flute's own (another lead's `mod` means
 * something else), and the rest say how the note goes: scooped up into (the composer's
 * bend), half-tongued (a "du"), ghosted (a passing note barely blown), swelled, tapered (both:
 * a messa di voce), with a breath after it (a deep one in a longer rest, a quick one snatched
 * from the end of the note), stopped by the tongue for the next note rather than let go, and
 * tongued with the back of the tongue (the "ku" of a double-tongued run). Above the flags,
 * how much of the player's breath is used as the note starts and as it ends (FLUTE_LUNGS:
 * see lungsMod).
 */
export const FLUTE_PLAYED = 1 << 12;
export const FLUTE_SCOOP = 1, FLUTE_SOFT = 2, FLUTE_GHOST = 4, FLUTE_SWELL = 8, FLUTE_TAPER = 16, FLUTE_BREATH = 32, FLUTE_DEEP = 64, FLUTE_STOP = 128, FLUTE_KU = 256, FLUTE_SNATCH = 512;
/** The breath used at a note's start and end, in 15 steps each (0 a full breath, 15 none left), above FLUTE_PLAYED. */
export const FLUTE_LUNGS = 1 << 13, FLUTE_LUNGS_END = 1 << 17;
const LUNG_STEPS = 15;
/** A note's breath in its `mod`: how much is used as it starts and as it ends (shares, 0 to 1). */
export function lungsMod(start: number, end: number): number {
  const q = (u: number): number => Math.round(Math.min(1, Math.max(0, u)) * LUNG_STEPS);
  return q(start) * FLUTE_LUNGS + q(end) * FLUTE_LUNGS_END;
}
/** The breath used as a note starts and ends, from its `mod` (both 0 for a note that does not say). */
export function lungsOf(mod: number): [number, number] {
  return [(Math.floor(mod / FLUTE_LUNGS) % 16) / LUNG_STEPS, (Math.floor(mod / FLUTE_LUNGS_END) % 16) / LUNG_STEPS];
}
/** A lead note's `mod` as another instrument should read it (a double): the composer's own bend under a flautist's flags. */
export function composerMod(mod: number | undefined): number {
  const m = mod ?? 0;
  return m & FLUTE_PLAYED ? m & FLUTE_SCOOP : m;
}

export interface JetNote {
  sr: number;
  /** The note (Hz), and the one it is slurred from under the same breath, if any. */
  f: number; from?: number;
  /** How hard it is blown (0 to 1), how long it is held (s), and how long to render (s). */
  vel: number; dur: number; seconds: number;
  /** The flute (open) or the pan flute (stopped). */
  pipe: Pipe;
  /** The breath vibrato: its pitch depth (cents, half its swing) and rate (Hz); 0 plays it straight. */
  vibrato: number; rate: number;
  /** A scoop up into the note (semitones under it, 0 none). */
  scoop: number;
  /** How firmly the tongue starts a note that is not slurred: 1 a "tu" (the default), less a softer "du". */
  tongue?: number;
  /** How the player shapes a held note: its level's change from start to end (dB: more a swell, less a taper) and how far its middle rises over that (dB, a messa di voce). */
  contour?: number; arch?: number;
  /** The tongue stops the note for the next one: the tone and the air end at once, with no breath after. */
  stop?: boolean;
  /**
   * The burst of air as the tongue lets the jet go (the flute only, drawn from FLUTE_BURST):
   * dB over that shape's level (a softer tongue less), its centre as a share of the shape's,
   * and how quick the note is (0 settled, 1 the quickest; lib/lofi-breath.ts noteSpeed). A
   * tongued note has one at its strength unless given `null`; a slur has none unless asked.
   * And how unsettled the jet is as the note starts (a share of extra air, dying away as the
   * jet settles), which keeps a quick note airy.
   */
  burst?: { db?: number; centre?: number; speed?: number } | null; unsettled?: number;
  /** A breath running out (the flute only): more air against the tone (dB), and the breath and the pitch wobbling more (a share more). */
  airDb?: number; shake?: number;
}

/** A second-order Butterworth filter (RBJ), low- or high-pass, run one sample at a time. */
class Butter {
  private readonly b0: number; private readonly b1: number; private readonly a1: number; private readonly a2: number;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(sr: number, hz: number, high: boolean) {
    const w = (2 * Math.PI * hz) / sr, cs = Math.cos(w), al = Math.sin(w) / Math.SQRT2, a0 = 1 + al;
    this.b0 = (high ? (1 + cs) / 2 : (1 - cs) / 2) / a0; this.b1 = (high ? -(1 + cs) : 1 - cs) / a0;
    this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
  }
  next(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b0 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * The tone holes' cutoff: the sound under the cutoff as it is, over it `db` weaker. A Linkwitz-Riley
 * split (two Butterworths each side, in phase at every frequency), so the two halves add
 * without a notch where they cross.
 */
class Cutoff {
  private readonly lo: [Butter, Butter]; private readonly hi: [Butter, Butter]; private readonly above: number;
  constructor(sr: number, hz: number, db: number) {
    this.lo = [new Butter(sr, hz, false), new Butter(sr, hz, false)];
    this.hi = [new Butter(sr, hz, true), new Butter(sr, hz, true)];
    this.above = 10 ** (db / 20);
  }
  next(x: number): number {
    return this.lo[1].next(this.lo[0].next(x)) + this.above * this.hi[1].next(this.hi[0].next(x));
  }
}

/** A delay line read at a fractional, changing length (linear interpolation). */
class Line {
  private readonly buf: Float64Array;
  private at = 0;
  constructor(size: number) { this.buf = new Float64Array(size); }
  /** The sample written `delay` samples ago (1 the last one written). */
  read(delay: number): number {
    const n = this.buf.length;
    const d = Math.max(1, Math.min(n - 2, delay));
    const whole = Math.floor(d);
    const frac = d - whole;
    const a = this.buf[(this.at - whole + 1 + n) % n]!;
    const b = this.buf[(this.at - whole + n) % n]!;
    return a + (b - a) * frac;
  }
  write(v: number): void {
    this.at = (this.at + 1) % this.buf.length;
    this.buf[this.at] = v;
  }
}

/** A pipe and how it is blown: every constant the measurements set (see blowFlute for what each does). */
interface Breath {
  /** The jet's delay (a share of the period), how sharply it prefers the note (Q), and its gain softly and at full strength. */
  jet: number; band: number; gainSoft: number; gainLoud: number;
  /** How unevenly the jet splits at the edge (the even harmonics), softly and at full strength. */
  evenSoft: number; evenLoud: number;
  /** The far end's reflection and the loss of the top (a pole, twice), and the mouth hole's reflection. */
  reflect: number; pole: number; mouth: number;
  /** The breath's turbulence driving the pipe, the hiss over the hole and its centre (Hz), and the chiff's puff and how fast it fades (s). */
  turbulence: number; air: number; airHz: number; chiff: number; chiffTime: number;
  /** How fast the breath comes in softly and at full strength, and goes (s); the tongue's push of breath and how fast it settles (s). */
  attackSoft: number; attackLoud: number; release: number; push: number; pushTime: number;
  /** How sharp the loop runs by itself (cents, plus cents a kHz of the note), and how much of a period the tongue starts it with. */
  sharp: readonly [number, number]; seed: number;
  /** The jet heard straight from the edge, and how unsteady the breath is (a share of the breath). */
  edge: number; unsteady: number;
  /** The vibrato's swell of breath (a share), the pitch's wander (cents), and when the vibrato comes in and how long it takes (s). */
  vibratoBreath: number; wander: number; vibratoFrom: number; vibratoIn: number;
  /**
   * The air as a player's breath, not a hiss on top (the flute; 0 leaves the pan flute's
   * own): how sharply the turbulence pulses as the jet swings into the pipe each period
   * (the power of the jet's share going in), the hiss's band (its Q) and its top above
   * `airTop` Hz (a share of it), how long the air goes on after the tone stops (s) and the
   * puff as the lips part, how far the pitch follows the breath (cents for the breath's
   * whole strength over its held level: a tongued note starts sharp, a dying one goes
   * flat), and how much the vibrato's depth and rate wander within a note (shares).
   */
  pulse: number; airQ: number; airTop: number; airTopHz: number; airRelease: number; puff: number; pressPitch: number; vibratoWobble: number;
  /** The turbulence's own band: a band-pass round this centre (Hz, Q 0.7; 0 leaves it broad, as the pan flute's). */
  turbHz: number;
  /** How much louder the breath is against the tone the harder the player blows (dB a unit of strength, about the middle). */
  airVel: number;
  /** How long the air holds on after the tone collapses before it fades (s), and how far the dying pitch follows the breath (a share of pressPitch). */
  airHold: number; releasePitch: number;
  /** How fast the tongue stops a note for the next one (s): recorded tongued changes dip 7 to 30 dB within 5 to 60 ms. */
  tongueStop: number;
  /** The tongue's burst of air against the held air (FLUTE_BURST for the flute; null none), and how fast the jet settles after the tongue lets it go (s). */
  burst: BurstShape | null; settle: number;
  /**
   * How the sound leaves the flute (0 leaves the pan flute's own): the share of it that rises
   * with the frequency as it radiates from the holes (1 a full 6 dB an octave over the note),
   * and the tone holes' cutoff (Hz), above which the bore no longer rings and the harmonics
   * come out `cutoffDb` weaker (0 none).
   */
  radiate: number; cutoff: number; cutoffDb: number;
  /** How the player's lips change up the range (dB an octave over C5): the jet's gain (a faster jet up high), how unevenly it splits, and the air against the tone. */
  gainTilt: number; evenTilt: number; airTilt: number;
}

/**
 * The flute's tongued burst, against its own held air at the note's strength, as recorded
 * players' are over double- and triple-tongued runs: the air above 4 kHz jumps 3 to 7 dB over
 * the note's own for a few milliseconds, centred near 1.5 to 2.5 kHz with a bright top, every
 * note its own (2.5 dB, its length and its centre spreading); a louder note puffs harder, and
 * a quick one harder again.
 */
export const FLUTE_BURST: BurstShape = {
  centre: 2560, width: 1.7, top: 0.6, topHz: 4000,
  level: 6.9, length: 0.008, rise: 0.0008, perStrength: 7, perSpeed: 4.2,
  spread: 2.5, lengthSpread: 0.3, centreSpread: 0.17,
};

const FLUTE_TUNING: Record<Pipe, Breath> = {
  open: {
    jet: 0.72, band: 3.2, gainSoft: 0.095, gainLoud: 0.215, evenSoft: 0.12, evenLoud: 0.55, reflect: 0.97, pole: 0.5, mouth: 0.97,
    turbulence: 0.25, air: 1.1, airHz: 1800, chiff: 0.3, chiffTime: 0.02, attackSoft: 0.05, attackLoud: 0.012, release: 0.04,
    vibratoBreath: 0.18, wander: 1.5, vibratoFrom: 0.15, vibratoIn: 0.25,
    push: 0.6, pushTime: 0.025, sharp: [3, 5], seed: 0.3, edge: 0, unsteady: 0.08,
    pulse: 2, airQ: 1.1, airTop: 0.25, airTopHz: 5000, airRelease: 0.1, puff: 1.5, pressPitch: 30, vibratoWobble: 0.25, turbHz: 1600, airVel: 12, airHold: 0.08, releasePitch: 0, tongueStop: 0.008, burst: FLUTE_BURST, settle: 0.06,
    radiate: 1, cutoff: 1500, cutoffDb: -18, gainTilt: 1.9, evenTilt: -0.5, airTilt: -1,
  },
  stopped: {
    jet: 0.72, band: 3, gainSoft: 0.08, gainLoud: 0.14, evenSoft: 0.55, evenLoud: 0.7, reflect: 0.97, pole: 0.5, mouth: 0.97,
    turbulence: 3.5, air: 1.8, airHz: 3000, chiff: 0.8, chiffTime: 0.03, attackSoft: 0.06, attackLoud: 0.03, release: 0.03,
    vibratoBreath: 0.08, wander: 2, vibratoFrom: 0.2, vibratoIn: 0.25,
    push: 0.6, pushTime: 0.025, sharp: [3, 5], seed: 0.3, edge: 3, unsteady: 0.08,
    pulse: 0, airQ: 0.5, airTop: 0, airTopHz: 5000, airRelease: 0, puff: 0, pressPitch: 0, vibratoWobble: 0, turbHz: 0, airVel: 0, airHold: 0, releasePitch: 0, tongueStop: 0.03, burst: null, settle: 0.06,
    radiate: 0, cutoff: 0, cutoffDb: 0, gainTilt: 0, evenTilt: 0, airTilt: 0,
  },
};

/** A one-pole low-pass's phase delay (samples) at `hz`, for y = (1 - p) x + p y'. */
function poleDelay(p: number, sr: number, hz: number): number {
  const w = (2 * Math.PI * hz) / sr;
  return Math.atan2(p * Math.sin(w), 1 - p * Math.cos(w)) / w;
}

/** Blow one note. */
export function blowFlute(n: JetNote, rand: () => number): Float32Array {
  const { sr } = n;
  const T = FLUTE_TUNING[n.pipe];
  const out = new Float32Array(Math.ceil(n.seconds * sr));
  const stopped = n.pipe === 'stopped';
  const open = !stopped;
  const lowest = Math.min(n.f, n.from ?? n.f, n.f * 2 ** (-Math.max(0, n.scoop) / 12));
  const bore = new Line(Math.ceil(sr / lowest) + 8);
  const jetLine = new Line(Math.ceil(sr / lowest) + 8);
  const v = Math.min(1, Math.max(0, n.vel));
  // Up the range the player blows a faster jet, split a little differently, with less air against the tone.
  const octave = Math.log2(n.f / 523.25);
  const gain = T.gainSoft * (T.gainLoud / T.gainSoft) ** v * 10 ** ((T.gainTilt * octave) / 20);
  const even = (T.evenSoft + (T.evenLoud - T.evenSoft) * v) * 10 ** ((T.evenTilt * octave) / 20);
  const release = Math.round(n.dur * sr);
  const attack = (T.attackSoft + (T.attackLoud - T.attackSoft) * v) * sr;
  const stop = open && n.stop === true;
  const releaseFall = Math.exp(-1 / ((stop ? T.tongueStop : T.release) * sr));
  const chiffFall = Math.exp(-1 / (T.chiffTime * sr));
  // How firmly the tongue starts the note: a "du" lets less of the chiff and the push through.
  const tongue = open ? Math.max(0, Math.min(1, n.tongue ?? 1)) : 1;
  // The chiff is a larger share of a soft note's start than of a loud one's.
  let chiff = n.from ? 0 : T.chiff * (1.5 - v + 40 * Math.max(0, 0.45 - v) ** 2) * tongue;
  const pushFall = Math.exp(-1 / (T.pushTime * sr));
  let push = n.from ? 0 : T.push * tongue;
  // How sharp the loop runs by itself (cents, measured over the range), taken back out of the pipe's length.
  const flat = 2 ** ((T.sharp[0] + T.sharp[1] * n.f / 1000) / 1200);
  let breath = n.from ? 1 : 0;
  // The pitch: in from a slur or a scoop, wandering, with a breath vibrato once held.
  const glide = n.from ? 0.035 * sr : n.scoop ? 0.1 * sr : 0;
  const start = n.from ?? (n.scoop ? n.f * 2 ** (-n.scoop / 12) : n.f);
  const drift = Math.exp((-2 * Math.PI * 2) / sr);
  const shake = open ? Math.max(0, n.shake ?? 0) : 0;
  const driftScale = (T.wander * (1 + 0.5 * shake)) / (0.577 * Math.sqrt((1 - drift) / (1 + drift)));
  let wander = 0;
  let phase = rand() * Math.PI * 2;
  // The breath is never quite steady: three slow movements at rates that never line up.
  const drifts = [rand() * 6.3, rand() * 6.3, rand() * 6.3];
  // A player's vibrato comes in later on some notes than others, and its depth and rate wander as it goes.
  const late = open ? 1 + 1.5 * rand() : 1;
  const wobbles = open ? [rand() * 6.3, rand() * 6.3] : [0, 0];
  const vibFrom = T.vibratoFrom * late * sr;
  const lag = 2 * poleDelay(T.pole, sr, n.f);
  let lp = 0, lp2 = 0, last = 0, dcx = 0, dcy = 0;
  // What radiates: rising with the frequency (a difference, set to leave the note's own level), and weaker above the tone holes' cutoff.
  const riseScale = 1 / (2 * Math.sin((Math.PI * n.f) / sr));
  const holes = T.cutoff ? new Cutoff(sr, T.cutoff, T.cutoffDb) : null;
  let lastTone = 0;
  let bx1 = 0, bx2 = 0, by1 = 0, by2 = 0;
  // The tongue lets the jet go already swinging at the note: the pipe starts with a little
  // of one period in it, so the note speaks in a few round trips (a slurred note's pipe is
  // still ringing with the last one).
  {
    const p = (sr / start) * (stopped ? 0.5 : 1);
    const amp = T.seed * (n.from ? 2 : 1) * (sr / start) / (2 * Math.PI);
    for (let i = 0; i < Math.ceil(p); i++) bore.write(Math.sin((2 * Math.PI * i) / p) * amp);
  }
  // The hiss of air over the hole: a broad band of noise round `airHz`, and for the flute its top.
  const aw = (2 * Math.PI * T.airHz) / sr, aal = Math.sin(aw) / (2 * T.airQ), aa0 = 1 + aal;
  const ab0 = aal / aa0, aa1 = (-2 * Math.cos(aw)) / aa0, aa2 = (1 - aal) / aa0;
  let ax1 = 0, ax2 = 0, ay1 = 0, ay2 = 0;
  const topPole = Math.exp((-2 * Math.PI * T.airTopHz) / sr);
  let topLow = 0;
  const tw = (2 * Math.PI * (T.turbHz || 1000)) / sr, tal = Math.sin(tw) / 1.4, ta0 = 1 + tal;
  const tb0 = tal / ta0, ta1 = (-2 * Math.cos(tw)) / ta0, ta2 = (1 - tal) / ta0;
  let tx1 = 0, tx2 = 0, ty1 = 0, ty2 = 0;
  // The flute's air: it follows the breath in, outlasts the tone when the breath stops, and puffs as the lips part.
  let air = n.from ? 1 : 0, puff = 0;
  const airFall = open && T.airRelease > 0 ? Math.exp(-1 / (T.airRelease * sr)) : 0;
  const puffFall = Math.exp(-1 / (0.04 * sr));
  // The shape the player gives a held note (dB at its start, middle and end).
  const shaped = open && (n.contour || n.arch);
  const breathy = 10 ** ((T.airVel * (v - 0.5) + T.airTilt * octave + (open ? n.airDb ?? 0 : 0)) / 20);
  // The tongue's burst: a short, bright rush of air as the jet is let go, against the held
  // air at this strength, and the jet's unsettled air after the burst. A slur keeps the jet
  // going, so it has neither unless asked.
  const tongued = n.burst === undefined ? (n.from ? null : {}) : n.burst;
  const B = open ? T.burst : null;
  const burst = B && tongued
    ? airBurst(sr, { ...B, level: B.level + (tongued.db ?? 0), centre: B.centre * (tongued.centre ?? 1) }, { strength: v, speed: tongued.speed ?? 0, seed: Math.floor(rand() * 4294967296) })
    : null;
  const burstRef = T.air * breathy;
  const settleFall = Math.exp(-1 / (T.settle * sr));
  let unsettled = open ? (n.unsettled ?? 0) : 0;
  for (let i = 0; i < out.length; i++) {
    const into = glide ? Math.min(1, i / glide) : 1;
    let f = start * (n.f / start) ** (into * into * (3 - 2 * into));
    wander = drift * wander + (1 - drift) * (rand() * 2 - 1);
    let cents = wander * driftScale;
    let swell = 1;
    const tt = i / sr;
    if (n.vibrato && i > vibFrom) {
      const wob = T.vibratoWobble;
      phase += (2 * Math.PI * n.rate * (wob ? 1 + 0.3 * wob * Math.sin(2 * Math.PI * 0.35 * tt + wobbles[1]!) : 1)) / sr;
      const depth = Math.min(1, (i - vibFrom) / (T.vibratoIn * sr)) * (wob ? 1 + wob * Math.sin(2 * Math.PI * 0.6 * tt + wobbles[0]!) : 1);
      const s = Math.sin(phase);
      cents += n.vibrato * depth * s;
      swell += T.vibratoBreath * depth * s;
    }
    // The breath: in over the attack (at once on a slur), held, let go.
    if (i < release) breath = Math.min(1, breath + 1 / attack);
    else breath *= releaseFall;
    const unsteady = 1 + T.unsteady * (1 + shake) * (0.62 * Math.sin(2 * Math.PI * 1.3 * tt + drifts[0]!) + 0.5 * Math.sin(2 * Math.PI * 2.9 * tt + drifts[1]!) + 0.35 * Math.sin(2 * Math.PI * 6.1 * tt + drifts[2]!));
    let press = breath * swell * unsteady * (1 + push);
    if (shaped) {
      const x = Math.min(1, i / Math.max(1, release));
      press *= 10 ** (((n.contour ?? 0) * x + (n.arch ?? 0) * 4 * x * (1 - x)) / 20);
    }
    // The pitch follows the breath: sharp under the tongue's push, a little flat as the breath dies.
    if (open) cents += T.pressPitch * (push + (i >= release ? T.releasePitch * (breath - 1) : 0));
    f *= 2 ** (cents / 1200);
    const period = (sr / f) * flat;
    push *= pushFall;
    chiff *= chiffFall;
    // The wave back from the far end: turned over by an open end, not by a stopped one, its top lost first.
    const loop = (stopped ? period / 2 : period) - lag;
    lp = (1 - T.pole) * bore.read(loop) + T.pole * lp;
    lp2 = (1 - T.pole) * lp + T.pole * lp2;
    const back = (stopped ? 1 : -1) * T.reflect * lp2;
    // The jet: pushed by the air swaying in the hole, reaching the edge a moment later.
    // The jet amplifies a sway near its own preferred frequency, which the player sets to the note.
    const w = (2 * Math.PI * f) / sr, al = Math.sin(w) / (2 * T.band), a0 = 1 + al;
    const sway = (al * back - al * bx2 + 2 * Math.cos(w) * by1 - (1 - al) * by2) / a0;
    bx2 = bx1; bx1 = back; by2 = by1; by1 = sway;
    jetLine.write(sway);
    const swing = jetLine.read(T.jet * period) * gain;
    // The split at the edge: the share of the jet that goes into the pipe saturates.
    const split = Math.tanh(swing);
    const into2 = press * (split + even * split * split);
    // The jet drives the pipe as its flow changes; scaled by the period, so it pushes as hard at every pitch.
    const drive = (into2 - last) * period / (2 * Math.PI);
    last = into2;
    let turbLevel: number, hissLevel: number;
    if (open) {
      // The air: it follows the breath in, and when the breath stops it fades more slowly than the tone, with a puff.
      if (i < release) air = breath;
      else if (stop) air = breath;
      else { if (i === release) puff = T.puff; if (i > release + T.airHold * sr) air *= airFall; }
      puff *= puffFall;
      unsettled *= settleFall;
      const blow = air * swell * unsteady * (1 + unsettled);
      // Turbulence comes as the jet swings into the pipe, once a period, the way a real flute's breath pulses.
      const gate = ((1 + split) * 0.5) ** T.pulse * (T.pulse + 1);
      turbLevel = T.turbulence * breathy * blow * gate + chiff * 0.2;
      hissLevel = T.air * breathy * blow * blow * gate + chiff + puff;
    } else {
      turbLevel = T.turbulence * press + chiff * 0.2;
      hissLevel = T.air * press * press + chiff;
    }
    // The jet is turbulent: its noise drives the pipe too, which rings it into a breathy halo round each harmonic.
    let turb = (rand() * 2 - 1) * turbLevel;
    if (T.turbHz) {
      const band = tb0 * turb - tb0 * tx2 - ta1 * ty1 - ta2 * ty2;
      tx2 = tx1; tx1 = turb; ty2 = ty1; ty1 = band;
      turb = band * 2;
    }
    const wave = -T.mouth * back + drive + turb;
    bore.write(wave);
    // What is heard: the air moving at the hole, with the breath's hiss over the top.
    const hissIn = (rand() * 2 - 1) * hissLevel;
    const hiss = ab0 * hissIn - ab0 * ax2 - aa1 * ay1 - aa2 * ay2;
    ax2 = ax1; ax1 = hissIn; ay2 = ay1; ay1 = hiss;
    let y: number;
    if (T.radiate || holes) {
      // The pipe's sound radiates and meets the tone holes' cutoff; the jet's own turbulence goes straight out.
      let tone = wave - turb - back + T.edge * drive;
      if (T.radiate) {
        const rise = (tone - lastTone) * riseScale;
        lastTone = tone;
        tone += T.radiate * (rise - tone);
      }
      if (holes) tone = holes.next(tone);
      y = tone + turb + hiss;
    } else y = wave - back + T.edge * drive + hiss;
    if (burst && i < burst.length) y += burst[i]! * burstRef;
    if (T.airTop) {
      topLow = (1 - topPole) * hissIn + topPole * topLow;
      y += T.airTop * (hissIn - topLow);
    }
    // What the jet itself sends out at the edge, heard over the top of the pipe (a stopped pipe's even harmonics come from here).
    const d = y - dcx + 0.995 * dcy;
    dcx = y; dcy = d;
    out[i] = d;
  }
  return out;
}
