// SPDX-License-Identifier: MPL-2.0
/**
 * Brass blown, modelled: a trumpet or a trombone as a player's lips on a bore, worked out
 * in JS one note at a time and played back, as the reeds are (lib/lofi-reeds.ts).
 *
 * The lips are a valve the breath pushes open: a mass on a spring, driven by the pressure
 * difference between the mouth and the mouthpiece. The air through them (Bernoulli's flow
 * through the gap) starts a wave down the bore. The bell sends the low part of each wave
 * back and lets the rest out, so the bore resonates at the note and its harmonics up to
 * the bell's cutoff, and what is heard is what leaves the bell: the bore's own tone with
 * its lows thinned, as a real horn radiates. The returning wave pushes back on the lips,
 * and the loop sustains itself at the bore's pitch.
 *
 * Brass gets brighter, not just louder, when it is blown harder, for two reasons this
 * model keeps. The harder the breath, the further the lips swing and the more abruptly
 * they shut, so the flow is a sharper pulse. And a loud wave steepens on its way down a
 * long bore, its crests running ahead of its troughs (the sound of a trumpet played ff
 * and of a trombone's blare): here the outgoing wave is read early in proportion to its
 * own pressure before it leaves the bell.
 *
 * A tongued note starts with the push of the breath the tongue held back, which settles
 * over a few tens of milliseconds (the accent at the front of a played note), and a
 * little noise from the air rushing through the lips before they lock onto the bore. A
 * held note wanders a few cents, as a player's does. The note can be scooped up into,
 * slurred from the one before, and fall off (or rise off, a doit) at its end. A soloist's
 * held note can also grow a vibrato towards its end and taper as the breath eases.
 *
 * The constants were set by measuring the model against recorded brass sections: the
 * steady spectrum and how it brightens with loudness, the attack and its accent, the
 * release, the pitch's movement and the section's spread. A section is miked close to
 * its bells; a soloist is heard off the bell's axis, and heardSolo gives that sound, set
 * against recorded solo trumpets.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */

export type Horn = 'trumpet' | 'trombone';

export interface LipNote {
  sr: number;
  /** The note (Hz), and the one it slurs from, if any. */
  f: number; from?: number;
  /** How hard it is blown (0 to 1), how long it is held (s), and how long to render (s). */
  vel: number; dur: number; seconds: number;
  horn: Horn;
  /** A scoop up into the note (how many semitones under the note it starts, 0 none), and how long it takes to rise (s, 0.12 by default). */
  scoop: number; scoopTime?: number;
  /** How far the note falls off as it ends (semitones; negative rises, a doit; 0 neither). */
  fall: number;
  /**
   * The player's vibrato: how deep it has grown by the time the breath stops (cents), its
   * rate (Hz), and when it comes in (s into the note; by default 0.3 s, or halfway through
   * a shorter note). It deepens steadily from there. A section plays straight (0).
   */
  vibrato: number; rate: number; vibratoFrom?: number;
  /** How far the breath eases off by the end of the note (a share of it, 0 none). */
  taper?: number;
  /** How unsteady the player's lips are: 1 as recorded trumpets are in the note's register (see GRAIN), 0 steady, as the section was fitted. */
  grain?: number;
}

/** An instrument: its bell, its lips, and how hard its players blow. */
interface Bore {
  /** Where the bell stops reflecting and starts radiating (Hz). */
  bell: number;
  /** The lips' own resonance against the note, and how sharply they resonate. */
  lip: number; q: number;
  /** How much of each wave the bell sends back, below its cutoff. */
  reflect: number;
  /** How far a loud wave steepens on its way down the bore (samples per unit of pressure). */
  steep: number;
  /** The mouth's pressure blowing softly and at full strength. */
  soft: number; loud: number;
  /**
   * How far the loop sounds from the note by itself (cents), measured over the horn's
   * range: blown softly, `sharp[0]` plus `sharp[1]` per kHz of the note; blown at full
   * strength, `sharp[2]` plus `sharp[3]` per kHz squared more (see LAG).
   */
  sharp: readonly [number, number, number, number];
  /** How strongly the tongue sets the bore going (the wave it starts with, against the breath): a long bore needs a firmer start to speak as promptly. */
  tongue: number;
}

/**
 * The trumpet's bell lets go of its harmonics from about 1.5 kHz and the trombone's from
 * about 700 Hz; the trombone's bore is twice as long, so its waves steepen further.
 */
const BORES: Record<Horn, Bore> = {
  trumpet: { bell: 1500, lip: 0.75, q: 6, reflect: 0.97, steep: 4, soft: 0.11, loud: 2.2, sharp: [-4, 0, 3, 33], tongue: 0.08 },
  trombone: { bell: 700, lip: 0.75, q: 6, reflect: 0.97, steep: 7, soft: 0.11, loud: 2.2, sharp: [-4, 55, -2, 150], tongue: 0.3 },
};

/** The lips at rest are just closed: the breath has to push them open. */
const REST = -0.02;
/** How far the pressure difference moves the lips, and how much air a gap passes. */
const COMPLIANCE = 0.6;
const GAP = 1.6;
/**
 * The loop's own delay past its filters (samples): the lips answer the bore a sample late.
 * With it, the loop still runs a little off the bore's resonance by itself, sharper the
 * harder it is blown and the higher the note (the lips push the frequency above the
 * resonance, as an outward-striking valve does), and the trombone, whose bell lets go of
 * its harmonics low, more than the trumpet: each horn's `sharp`, measured over its range
 * at four strengths. The player keeps the note in tune for its strength, so the pitch
 * still lifts with the tongue's push and sags a little as the breath stops, as a played
 * note's does, by half of what the loop alone would do.
 */
const LAG = 1.4;
/**
 * The lips are never quite steady: their tension and the breath behind them wander from
 * cycle to cycle, at 20 to 200 a second (GRAIN_SLOW to GRAIN_FAST Hz). That is the grain
 * of a played trumpet: the period jitters, the cycles' level shimmers, noise sits between
 * the harmonics and the sound is roughened at 20 to 200 Hz, with a trace of the half
 * harmonics. Measured on recorded single notes (University of Iowa, anechoic, and
 * Philharmonia, in a room), from E4 up: jitter 0.06 to 0.10 % low in the range, rising to
 * 0.14 to 0.21 at the top; shimmer 0.07 to 0.13 dB low and 0.05 to 0.08 above; the 1-2 kHz
 * band's noise 26 to 37 dB under its harmonics; the half harmonics 35 to 45 dB under,
 * most in the low register, where the lips sit loosely on the bore's lower resonances.
 * The breath wanders by GRAIN_BREATH of itself (a standard deviation), more below
 * GRAIN_LOW_FROM (up to GRAIN_BREATH_LOW more six semitones under), and the tension from
 * GRAIN_TOP_FROM up (up to GRAIN_TENSION_TOP), where the lips are tightest. A soloist's
 * held notes then give jitter 0.10 % low to 0.21 at the top, shimmer 0.09 dB low and 0.08
 * above, noise 29 to 37 dB under and the half harmonics 34 to 46 dB under; held steady
 * they gave 0.04 %, 0.02 dB, 43 to 48 and 53 to 56.
 */
const GRAIN_SLOW = 20;
const GRAIN_FAST = 200;
const GRAIN_BREATH = 0.015;
const GRAIN_BREATH_LOW = 0.004;
const GRAIN_LOW_FROM = 68;
const GRAIN_TENSION_TOP = 0.003;
const GRAIN_TOP_FROM = 78;
/**
 * Slurred onto a new note, the lips settle onto its resonance over a few tens of ms: on
 * recorded slurs the jitter just after the change is 1.0 to 1.2 times the held note's for
 * a step and 1.4 to 1.7 for a leap of a third or more, and the noise between the harmonics
 * 2 to 5 dB up. The wander is SLUR_UNSTEADY more at the change for a leap of four
 * semitones or more (less for a step), dying away over SLUR_SETTLE s: 1.0 and 1.4 times,
 * 3 and 5 dB.
 */
const SLUR_UNSTEADY = 2.5;
const SLUR_SETTLE = 0.05;
/** A dc blocker's pole inside the loop: the bore is open, so it holds no steady pressure. */
const DC = 0.9995;
/** The push of breath behind a tongued note (a share of the pressure), and how fast it settles (s). */
const PUSH = 0.8;
const PUSH_TIME = 0.02;
/** How strongly the note before still rings in the bore when a note is slurred onto it (against the breath). */
const SLUR_RING = 0.6;
/** How quickly the breath comes in on a tongued note and on a slur (s). */
const ATTACK = 0.005;
const SLUR_ATTACK = 0.004;
/** How the breath stops (s): the lips go on buzzing a moment as the pressure falls. */
const RELEASE = 0.045;
/**
 * The air through the lips is turbulent: noise in the flow, a share of it, which the bore
 * colours and the bell lets out. It is rough while a tongued note speaks, before the lips
 * lock onto the bore (ROUGH, settling in ROUGH_TIME s), and slight once they have.
 */
const TURBULENCE = 0.04;
const ROUGH = 0.15;
const ROUGH_TIME = 0.03;
/** How far a held note's pitch wanders (cents, standard deviation): recorded section players hold within 2 to 3. */
const WANDER = 2.4;
/** How long a fall or a doit takes (s), from the end of the note. */
const FALL_TIME = 0.22;
/**
 * A lip vibrato moves the breath with the pitch: the level swings about a third of a dB
 * with a 5 cent vibrato on recorded trumpets (University of Iowa samples: 0.15 to 0.5 dB
 * with vibrato, about 0.1 without). A share of the breath per cent of depth.
 */
const VIBRATO_BREATH = 0.005;

/** A fractional delay line with linear interpolation. */
class Line {
  private readonly buf: Float64Array;
  private at = 0;
  constructor(size: number) { this.buf = new Float64Array(size); }
  /** The sample written `delay` samples ago (1 is the last one written). */
  read(delay: number): number {
    const n = this.buf.length;
    const d = Math.max(1, Math.min(n - 3, delay));
    const whole = Math.floor(d);
    const frac = d - whole;
    const a = this.buf[(this.at - whole + 1 + n) % n]!;
    const b = this.buf[(this.at - whole + n) % n]!;
    return a + (b - a) * frac;
  }
  write(x: number): void {
    this.at = (this.at + 1) % this.buf.length;
    this.buf[this.at] = x;
  }
}

/** A biquad's coefficients (RBJ), normalised by a0. */
interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }
function biquad(sr: number, hz: number, q: number, high: boolean): Biquad {
  const w = (2 * Math.PI * hz) / sr, c = Math.cos(w), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
  const b = high ? (1 + c) / 2 : (1 - c) / 2;
  return { b0: b / a0, b1: (high ? -2 * b : 2 * b) / a0, b2: b / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0 };
}
/** A biquad's phase delay (samples) at `hz`. */
function phaseDelay(q: Biquad, sr: number, hz: number): number {
  const w = (2 * Math.PI * hz) / sr;
  const num = Math.atan2(-q.b1 * Math.sin(w) - q.b2 * Math.sin(2 * w), q.b0 + q.b1 * Math.cos(w) + q.b2 * Math.cos(2 * w));
  const den = Math.atan2(-q.a1 * Math.sin(w) - q.a2 * Math.sin(2 * w), 1 + q.a1 * Math.cos(w) + q.a2 * Math.cos(2 * w));
  return -(num - den) / w;
}
/** The loop's dc blocker's phase delay (samples) at `hz` (negative: it leads). */
function dcDelay(sr: number, hz: number): number {
  const w = (2 * Math.PI * hz) / sr;
  return -(Math.atan2(Math.sin(w), 1 - Math.cos(w)) - Math.atan2(DC * Math.sin(w), 1 - DC * Math.cos(w))) / w;
}

/** The mouth's pressure for a strength: the loudest brass is blown about twenty times as hard as the softest. */
export function pressure(horn: Horn, vel: number): number {
  const b = BORES[horn];
  return b.soft * (b.loud / b.soft) ** Math.min(1, Math.max(0, vel));
}

/** The solo's cutoff (Hz) from SOLO_FULL strength up, and how many octaves it falls per unit of strength under that. */
const SOLO_TOP = 3600;
const SOLO_FULL = 0.55;
const SOLO_SOFT = 3.9;

/**
 * A solo trumpet as a listener hears it, rather than as a horn section is miked. The bell
 * sends its top octaves forward in a narrow beam, so off its axis, as a soloist is heard
 * and recorded, the sound above about 3 kHz falls away; and blown softly the lips never
 * quite shut, so the pulse they let through is rounder still. Measured against recorded
 * solo trumpets (University of Iowa and Philharmonia single notes, and solo phrases) in
 * the lead's range: at a mezzo-forte the third-octaves at 4, 6.3 and 10 kHz sit about 20,
 * 31 and 47 dB under the strongest, where the model as a section is miked gives 12, 21
 * and 27. Two gentle low-passes at SOLO_TOP, lower by SOLO_SOFT octaves for each unit of
 * strength under SOLO_FULL, bring it to 20, 33 and 45, and blown softly near the recorded
 * pianissimo (40, 55 and 67 at a strength of 0.15; recorded 37 to 51, 55 to 66, 72 to 75).
 * In place, on a rendered note.
 */
export function heardSolo(x: Float32Array, sr: number, vel: number): void {
  const fc = Math.min(0.45 * sr, SOLO_TOP * 2 ** (SOLO_SOFT * Math.min(0, vel - SOLO_FULL)));
  const a = Math.exp((-2 * Math.PI * fc) / sr), b = 1 - a;
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    y1 = b * x[i]! + a * y1;
    y2 = b * y1 + a * y2;
    x[i] = y2;
  }
}

/** Blow one note. */
export function blowLips(n: LipNote, rand: () => number): Float32Array {
  const { sr } = n;
  const b = BORES[n.horn];
  const out = new Float32Array(Math.ceil(n.seconds * sr));
  const bore = new Line(Math.ceil(sr / 20) + 8);
  // The outgoing wave, read up to STEEP_MAX samples early as it steepens.
  const STEEP_MAX = 24;
  const bell = new Line(STEEP_MAX * 2 + 8);
  const reflect = biquad(sr, b.bell, 0.6, false);
  const radiate = biquad(sr, b.bell * 0.87, 0.7, true);
  const pm = pressure(n.horn, n.vel);
  const lag = phaseDelay(reflect, sr, n.f) + dcDelay(sr, n.f) - LAG;
  // How sharp the loop runs at a pressure (cents), and the half of that the player corrects for the note's strength.
  const pSoft = pressure(n.horn, 0.2), pSpan = Math.log(pressure(n.horn, 1) / pSoft);
  const kHz = n.f / 1000;
  const [s0, s1, l0, l2] = b.sharp;
  const sharp = (p: number): number => s0 + s1 * kHz + Math.min(1, Math.max(0, Math.log(Math.max(p, 1e-4) / pSoft) / pSpan)) * (l0 + l2 * kHz * kHz);
  const set = sharp(pm) * 0.5;
  const release = Math.round(n.dur * sr);
  const releaseLen = RELEASE * sr;
  const attack = (n.from ? SLUR_ATTACK : ATTACK) * sr;
  let rough = n.from ? 0 : ROUGH;
  // Slurred onto a new resonance, the lips take a moment to settle there: more unsteady at first, the more so the further they move.
  const settle = n.from ? SLUR_UNSTEADY * Math.min(1, Math.abs(12 * Math.log2(n.f / n.from)) / 4) : 0;
  const settleTime = SLUR_SETTLE * sr;
  // The lips' unsteadiness (GRAIN): two band-limited wanders, one in their tension, one in the breath.
  const grain = n.grain ?? 0;
  const midi = 69 + 12 * Math.log2(n.f / 440);
  const breathDepth = GRAIN_BREATH + GRAIN_BREATH_LOW * Math.min(1, Math.max(0, (GRAIN_LOW_FROM - midi) / 6));
  const tensionDepth = GRAIN_TENSION_TOP * Math.min(1, Math.max(0, (midi - GRAIN_TOP_FROM) / 6));
  const gHi = Math.exp((-2 * Math.PI * GRAIN_FAST) / sr), gLo = Math.exp((-2 * Math.PI * GRAIN_SLOW) / sr);
  // Each wander's spread before scaling (white noise of variance 1/3 through the band): dividing by that makes each depth a standard deviation.
  const gNorm = 1 / Math.sqrt(((1 - gHi) ** 2 / (1 - gHi * gHi) + (1 - gLo) ** 2 / (1 - gLo * gLo) - (2 * (1 - gHi) * (1 - gLo)) / (1 - gHi * gLo)) / 3);
  let tHi = 0, tLo = 0, bHi = 0, bLo = 0;
  const roughFall = Math.exp(-1 / (ROUGH_TIME * sr));
  const glide = n.from ? 0.05 * sr : n.scoop ? (n.scoopTime ?? 0.12) * sr : 0;
  const start = n.from ?? (n.scoop ? n.f * 2 ** (-n.scoop / 12) : n.f);
  const fallLen = FALL_TIME * sr;
  const vibratoFrom = (n.vibratoFrom ?? Math.min(0.3, n.dur * 0.5)) * sr;
  const vibratoSpan = Math.max(0.05 * sr, release - vibratoFrom);
  const taper = n.taper ?? 0;
  // Filter and lip state.
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let o1 = 0, o2 = 0, p1 = 0, p2 = 0;
  let dcx = 0, dcy = 0;
  let lipY = 0, lipV = 0;
  const dt = 1 / sr;
  let push = n.from ? 0 : PUSH;
  const pushFall = Math.exp(-1 / (PUSH_TIME * sr));
  // The pitch's slow wander: noise smoothed to below about 3 Hz, scaled to WANDER cents.
  const drift = Math.exp((-2 * Math.PI * 3) / sr);
  const driftScale = WANDER / (0.577 * Math.sqrt((1 - drift) / (1 + drift)));
  let wander = 0;
  let phase = rand() * Math.PI * 2;
  // The tongue: a player starts a note by letting the breath go against lips already set
  // for the note, which sets the bore's fundamental going at once. Here the bore starts
  // with a wave one period long already in it, so the note speaks in a few round trips.
  // A slurred note's bore is still ringing with the note before, at its full strength.
  const period = sr / start;
  const seed = (n.from ? SLUR_RING : b.tongue) * pm;
  for (let i = 0; i < Math.ceil(period); i++) bore.write(Math.sin((2 * Math.PI * i) / period) * seed);
  for (let i = 0; i < out.length; i++) {
    // The pitch: in from a slur or a scoop, wandering, a vibrato once settled, off at the end.
    const into = glide ? Math.min(1, i / glide) : 1;
    let f = start * (n.f / start) ** (into * into * (3 - 2 * into));
    wander = drift * wander + (1 - drift) * (rand() * 2 - 1);
    let cents = wander * driftScale;
    // The vibrato, deepening from where it comes in to where the breath stops, as a
    // soloist's does on a held note, and swinging the breath a little with the pitch.
    let swing = 0;
    if (n.vibrato && i > vibratoFrom) {
      phase += (2 * Math.PI * n.rate) / sr;
      swing = n.vibrato * Math.min(1, (i - vibratoFrom) / vibratoSpan) * Math.sin(phase);
      cents += swing;
    }
    if (n.fall && i > release - fallLen * 0.3) {
      const u = Math.min(1, (i - (release - fallLen * 0.3)) / fallLen);
      cents -= n.fall * 100 * u * u;
    }
    f *= 2 ** (cents / 1200);
    // The breath: in, the tongue's push settling, held, let go (more slowly under a fall).
    const swell = Math.min(1, i / attack);
    const letGo = n.fall ? fallLen * 0.8 : releaseLen;
    const gone = i < release ? 1 : Math.max(0, 1 - (i - release) / letGo);
    const ease = taper ? 1 - taper * Math.min(1, i / Math.max(1, release)) ** 2 : 1;
    let tension = 1, breath = 1;
    if (grain) {
      const r1 = rand() * 2 - 1, r2 = rand() * 2 - 1;
      tHi = gHi * tHi + (1 - gHi) * r1; tLo = gLo * tLo + (1 - gLo) * r1;
      bHi = gHi * bHi + (1 - gHi) * r2; bLo = gLo * bLo + (1 - gLo) * r2;
      const unsteady = grain * (1 + settle * Math.exp(-i / settleTime));
      tension = 1 + unsteady * tensionDepth * (tHi - tLo) * gNorm;
      breath = 1 + unsteady * breathDepth * (bHi - bLo) * gNorm;
    }
    const air = pm * (1 + push) * swell * gone * gone * ease * (1 + VIBRATO_BREATH * swing) * breath;
    push *= pushFall;
    // The wave coming back from the bell, with the bell's low-pass and the open bore's dc block.
    const back = bore.read((sr / f) * 2 ** ((set + sharp(air) * 0.5) / 1200) - lag);
    const r = reflect.b0 * back + reflect.b1 * x1 + reflect.b2 * x2 - reflect.a1 * y1 - reflect.a2 * y2;
    x2 = x1; x1 = back; y2 = y1; y1 = r;
    const d = r - dcx + DC * dcy;
    dcx = r; dcy = d;
    const minus = b.reflect * d;
    // The lips: the gap they leave, the air through it (solved with the bore's pressure), the force on them.
    const gap = Math.max(0, REST + lipY) * GAP;
    const drive = air - 2 * minus;
    let dp: number, u: number;
    if (drive >= 0) { const s = (-gap + Math.sqrt(gap * gap + 4 * drive)) / 2; dp = s * s; u = gap * s; }
    else { const s = (-gap + Math.sqrt(gap * gap - 4 * drive)) / 2; dp = -s * s; u = -gap * s; }
    u *= 1 + (rand() * 2 - 1) * (TURBULENCE + rough);
    rough *= roughFall;
    const w = 2 * Math.PI * f * b.lip * tension;
    lipV += (w * w * (COMPLIANCE * dp - lipY) - (w / b.q) * lipV) * dt;
    lipY += lipV * dt;
    const plus = minus + u;
    bore.write(plus);
    // Down the bore and out of the bell: steepened by its own pressure, its lows thinned.
    bell.write(plus);
    const now = bell.read(STEEP_MAX);
    const early = Math.max(0, Math.min(STEEP_MAX * 2 - 2, STEEP_MAX - b.steep * now));
    const leaving = bell.read(early);
    const o = radiate.b0 * leaving + radiate.b1 * o1 + radiate.b2 * o2 - radiate.a1 * p1 - radiate.a2 * p2;
    o2 = o1; o1 = leaving; p2 = p1; p1 = o;
    out[i] = o;
  }
  return out;
}
