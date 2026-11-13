// SPDX-License-Identifier: MPL-2.0
/**
 * A violin bowed, modelled: a string driven by the bow's stick and slip, heard through the
 * instrument's body, worked out in JS one note at a time and played back, as the winds are
 * (lib/lofi-reeds.ts, lib/lofi-brass.ts).
 *
 * The string is two delay lines, one each side of the bow: waves run out to the bridge and
 * to the stopping finger, turn over and come back. Where they meet the bow, the hair grips
 * the string and drags it along until the string's own pull tears it free; it slips back,
 * and the hair grips again. That stick and slip (the friction curve below: a grip that lets
 * go as the string slides faster against the hair) settles into Helmholtz motion, one
 * corner running round the string once a period, and the force on the bridge is a sawtooth
 * with the corner's rounding. A harder bow makes a sharper corner and a brighter note. The
 * bridge loses a little of each wave, the top first.
 *
 * The bridge drives the body, whose many resonances give a violin its voice: the air in the
 * box near 280 Hz, the plates' first modes between 400 and 600, then denser and denser
 * modes up through the "bridge hill" near 2.5 kHz, all ringing a few tens of milliseconds.
 * Each harmonic of a note meets that ragged response at its own height, and as the finger rocks
 * in vibrato the harmonics slide up and down its slopes, rising and falling, which is what
 * makes a played note shimmer and a still one sound like a box.
 *
 * Played: the bow comes onto the string with a bite (more force than it will hold) and
 * speeds up, so the note starts in a scrape of slips before it locks into the period, as a
 * played détaché does; the hair is never smooth, so a little rosin noise rides on every
 * slip; the bow's speed wavers; a held note gets a vibrato that comes in after a moment; a
 * slurred note changes pitch under the same bow with no new attack; a slide comes up from
 * below; and when the bow lifts the string rings on into the body for a moment.
 *
 * The constants were set by measuring the model against recorded violins, for measurement
 * only (no recording is in this repository): two players' sustained notes without vibrato
 * at three strengths, and one player's short and long strokes, pianissimo to fortissimo,
 * with vibrato. The body's modes were fitted to some 180 recorded notes' harmonics, less
 * what the string gives them, then corrected against the whole model's. Against those
 * recordings, at the fiddle's register (G4 to A5):
 * - held harmonics within about 3 dB through the 10th at mezzo-forte and forte (the softest
 *   strokes a few dB dark above the 8th), the 5th to 8th climbing 5 to 10 dB from
 *   pianissimo to fortissimo, as recorded;
 * - a stroke comes within 3 dB of its held level 70 to 120 ms after it is first heard
 *   (recorded: 57 ms fortissimo to 132 pianissimo), through a scratch whose noise between
 *   the harmonics is 3 dB (loud) to 25 dB (soft) under them (recorded: 0 to 22);
 * - held, that noise sits 21 dB (fortissimo) to 40 dB (pianissimo) under the harmonics
 *   from 1 to 8 kHz (recorded: 21 to 35), rising toward the top as recorded;
 * - with vibrato the harmonics' levels swing by about 2 dB against each other (recorded:
 *   3 to 6, with a room in the recording), where a still note swings by about 1.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */

export interface BowNote {
  sr: number;
  /** The note (Hz), and the one it is slurred from under the same bow, if any. */
  f: number; from?: number;
  /** How hard it is bowed (0 to 1), how long it is held (s), and how long to render (s). */
  vel: number; dur: number; seconds: number;
  /** The left hand's vibrato: depth (cents, half its swing) and rate (Hz); 0 plays it still. */
  vibrato: number; rate: number;
  /** A slide up into the note (semitones under it, 0 none). */
  slide: number;
}

/** A delay line read at a fractional, changing length (third-order Lagrange interpolation). */
class Line {
  private readonly buf: Float64Array;
  private at = 0;
  constructor(size: number) { this.buf = new Float64Array(size); }
  /** The sample written `delay` samples ago (1 the last one written). */
  read(delay: number): number {
    const n = this.buf.length;
    const d = Math.max(2, Math.min(n - 4, delay));
    const whole = Math.floor(d) - 1;
    const x = d - whole;  // between 1 and 2: the four taps sit `whole` to `whole + 3` samples back
    const i = this.at - whole + 1 + n;
    const y0 = this.buf[i % n]!, y1 = this.buf[(i - 1) % n]!, y2 = this.buf[(i - 2) % n]!, y3 = this.buf[(i - 3) % n]!;
    const a = x - 1, b = x - 2, c = x - 3;
    return -y0 * a * b * c / 6 + y1 * x * b * c / 2 - y2 * x * a * c / 2 + y3 * x * a * b / 6;
  }
  write(v: number): void {
    this.at = (this.at + 1) % this.buf.length;
    this.buf[this.at] = v;
  }
}

/** A two-pole resonator (one body mode): its coefficients and state. */
interface Mode { a1: number; a2: number; g: number; y1: number; y2: number }

/**
 * The body's modes: frequency (Hz), level (dB) and Q. The low modes are a violin's
 * named ones (the air mode A0, the corpus bending mode, the plates' B1- and B1+); above
 * them the modes come thicker, and their levels follow the response measured from the
 * recorded notes: the harmonics' levels, less what the string itself gives them.
 */
const BODY: ReadonlyArray<readonly [number, number, number]> = [
  [275, -9.2, 58], [405, -19.4, 72], [460, -15.7, 82], [540, -15.9, 72], [602, -22.1, 96], [640, -28, 96],
  [692, -38.6, 96], [732, -31.5, 96], [792, -26.7, 96], [848, -19.4, 96], [911, -18.3, 96], [972, -11.4, 96],
  [1039, -11.8, 96], [1117, -17.9, 96], [1208, -13, 96], [1277, -2.9, 96], [1372, -13.9, 96],
  [1482, -16, 96], [1593, -25.7, 96], [1715, -16.7, 96], [1831, -11.9, 96], [1948, -5.4, 96],
  [2091, -10.6, 82], [2245, -7.1, 82], [2387, -2.9, 82], [2584, -9.3, 82], [2770, -6.1, 82],
  [2985, -17.8, 82], [3155, -9.1, 82], [3390, -3.6, 82], [3654, -6.6, 82], [3919, 0, 82], [4149, -12.3, 82],
  [4432, -18.8, 82], [4829, -2.1, 62], [5094, -8.9, 62], [5525, -4.3, 62], [5877, -9.4, 62],
  [6341, -4.7, 62], [6790, -3.4, 62], [7259, -11.2, 62], [7744, -10.3, 62], [8384, -6.3, 62],
  [8999, -5.8, 62],
];

/** Every constant the measurements set, in one place (see bowSource for what each does). */
const BOW_TUNING = {
  /** The bow's distance from the bridge, as a fraction of the string, and how far a player strays note to note (a share of that distance). */
  beta: 0.1, betaSpread: 0.3,
  /** How much of each wave the bridge sends back. */
  bridge: 0.985,
  /** The corner's rounding: a one-pole low-pass in the loop, softly bowed and at full strength. */
  poleSoft: 0.6, poleLoud: 0.05,
  /** The hair's width: a ribbon, not a point, so a light bow rounds the force on the bridge further (two one-pole low-passes from this corner frequency, Hz, rising eightfold to full strength). */
  hair: 1500,
  /** The bow's speed softly and at full strength (harder playing is a faster bow). */
  speedSoft: 0.1, speedLoud: 0.32,
  /** The bow's force against its speed (the friction curve's slope times the speed): lower is heavier. */
  kappaSoft: 0.26, kappaLoud: 0.3,
  /** The bite: extra force at the stroke's start (all of it from `biteFull` strength up, less below), and how fast it settles (s). */
  bite: 0.55, biteFull: 0.6, biteTime: 0.035,
  /**
   * The stroke: the bow drags at a crawl for `creep` s (the scratch before the string
   * catches), then comes up to speed over `rampSoft` s softly bowed, `rampLoud` at full
   * strength. A firm stroke starts faster than it goes on (the accent, a share of the speed
   * from `accentFrom` strength up, settling over `accentTime` s). Lifting takes `lift` s.
   */
  creep: 0.018, crawl: 0.06, rampSoft: 0.15, rampLoud: 0.05, accent: 1.6, accentFrom: 0.45, accentTime: 0.07, lift: 0.03,
  /**
   * Rosin: a crackle each time the string slips, against the bow's speed (more of it the
   * harder the bow, `rosinGrow` times from softest to loudest). A little of it runs along
   * the string (`rosin`), most reaches the bridge straight from the bow (`rosinDirect`), high
   * and broad. As the stroke starts the hair scratches before the string catches:
   * `scratch` of the speed, from `scratchFrom` strength up, fading over `scratchTime` s.
   */
  rosin: 0.02, rosinDirect: 0.15, rosinGrow: 20, rosinLoud: 20, rosinHigh: 1800, scratch: 1, scratchFrom: 0.3, scratchTime: 0.03,
  /** How far the bow's speed sways as the arm draws it (a share of it): a few slow movements, never faster than a few a second. */
  waver: 0.05,
  /** How far the pitch wanders under the finger (cents, standard deviation), below about 2 Hz. */
  wander: 2.5,
  /** When a held note's vibrato starts (s) and how long it takes to come in (s). */
  vibratoFrom: 0.18, vibratoIn: 0.25,
};
/**
 * The friction curve (after Smith and the STK's bow table): how much of the velocity
 * difference between bow and string the hair passes back into the string, falling as the
 * string slips faster. Its slope is set by the bow's force: a steep curve lets the string
 * slip easily (a light bow), a shallow one holds it (a heavy one).
 */
function grip(dv: number, slope: number): number {
  const s = Math.abs(dv * slope) + 0.75;
  return Math.min(1, 1 / (s * s * s * s));
}

/** A second-order high-pass's coefficients (RBJ, Q 0.7), normalised by a0. */
function highpass(sr: number, hz: number): { b0: number; b1: number; b2: number; a1: number; a2: number } {
  const w = (2 * Math.PI * hz) / sr, c = Math.cos(w), alpha = Math.sin(w) / 1.4, a0 = 1 + alpha;
  return { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0 };
}

/** A one-pole low-pass's phase delay (samples) at `hz`, for y = (1 - p) x + p y'. */
function poleDelay(p: number, sr: number, hz: number): number {
  const w = (2 * Math.PI * hz) / sr;
  return Math.atan2(p * Math.sin(w), 1 - p * Math.cos(w)) / w;
}

/** The body as a bank of resonators at this sample rate. */
function body(sr: number): Mode[] {
  return BODY.filter(([hz]) => hz < sr * 0.45).map(([hz, db, q]) => {
    const w = (2 * Math.PI * hz) / sr;
    const r = Math.exp(-w / (2 * q));
    // Normalised so each mode's peak is its level, whatever its Q.
    return { a1: -2 * r * Math.cos(w), a2: r * r, g: 10 ** (db / 20) * (1 - r), y1: 0, y2: 0 };
  });
}

/** Bow one note: the string through the body. */
export function bowString(n: BowNote, rand: () => number): Float32Array {
  return violinBody(n.sr, bowSource(n, rand));
}

/** The body's response to the force on the bridge. */
function violinBody(sr: number, x: Float32Array): Float32Array {
  const modes = body(sr);
  const out = new Float32Array(x.length);
  // A dc blocker after the modes: the box holds no steady pressure.
  const dc = Math.exp((-2 * Math.PI * 20) / sr);
  let dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    let y = 0;
    for (const m of modes) {
      const o = m.g * v - m.a1 * m.y1 - m.a2 * m.y2;
      m.y2 = m.y1; m.y1 = o;
      y += o;
    }
    dy = y - dx + dc * dy;
    dx = y;
    out[i] = dy;
  }
  return out;
}

/** The bowed string alone: the force on the bridge, before the body. */
export function bowSource(n: BowNote, rand: () => number): Float32Array {
  const { sr } = n;
  const out = new Float32Array(Math.ceil(n.seconds * sr));
  const maxPeriod = Math.ceil(sr / Math.min(n.f, n.from ?? n.f, n.f * 2 ** (-Math.max(0, n.slide) / 12)) * 1.1) + 8;
  const T = BOW_TUNING;
  const beta = T.beta * (1 + T.betaSpread * (rand() - 0.5));
  const nut = new Line(maxPeriod);
  const bridge = new Line(Math.ceil(maxPeriod * beta * 1.5) + 8);
  const v = Math.min(1, Math.max(0, n.vel));
  const speed = T.speedSoft * (T.speedLoud / T.speedSoft) ** v;
  // Nearer the bridge the string needs a heavier bow to hold it (Schelleng's minimum force grows as the square of the distance shrinks).
  const kappa = (T.kappaSoft + (T.kappaLoud - T.kappaSoft) * v) * (beta / T.beta) ** 2;
  const pole = T.poleSoft + (T.poleLoud - T.poleSoft) * v;
  const release = Math.round(n.dur * sr);
  const creep = n.from ? 0 : T.creep * sr;
  const ramp = (T.rampSoft + (T.rampLoud - T.rampSoft) * v) * sr;
  const accent = n.from ? 0 : T.accent * Math.max(0, v - T.accentFrom);
  const accentFall = Math.exp(-1 / (T.accentTime * sr));
  let lifted = 1;
  const liftFall = Math.exp(-1 / (T.lift * sr));
  const rosin = T.rosin * 12 ** v;
  const rosinDirect = T.rosinDirect * T.rosinGrow ** v * (1 + T.rosinLoud * Math.max(0, v - 0.5) ** 2);
  const hp = highpass(sr, T.rosinHigh);
  let hx1 = 0, hx2 = 0, hy1 = 0, hy2 = 0, hz1 = 0, hz2 = 0;
  const scratchFall = Math.exp(-1 / (T.scratchTime * sr));
  let scratch = n.from ? 0 : T.scratch * Math.max(0, v - T.scratchFrom) / (1 - T.scratchFrom);
  let hiss = 0, hiss2 = 0;
  const biteFall = Math.exp(-1 / (T.biteTime * sr));
  let bite = n.from ? 0 : T.bite * Math.min(1, v / T.biteFull);
  // The arm's sway: three slow movements at rates that never line up.
  const sway = [rand() * 6.3, rand() * 6.3, rand() * 6.3];
  // The pitch: in from a slur or a slide, wandering, with a vibrato once held.
  const glide = n.from ? 0.04 * sr : n.slide ? 0.12 * sr : 0;
  const start = n.from ?? (n.slide ? n.f * 2 ** (-n.slide / 12) : n.f);
  const drift = Math.exp((-2 * Math.PI * 2) / sr);
  const driftScale = T.wander / (0.577 * Math.sqrt((1 - drift) / (1 + drift)));
  let wander = 0;
  let phase = rand() * Math.PI * 2;
  const vibFrom = T.vibratoFrom * sr;
  const lagFix = poleDelay(pole, sr, n.f);
  let lp = 0;
  const hair = Math.exp((-2 * Math.PI * Math.min(sr * 0.4, T.hair * 8 ** v)) / sr);
  let ribbon = 0, ribbon2 = 0;
  // A slurred note's string is already moving: seed it with a period of the note before.
  if (n.from) {
    const p = sr / n.from;
    for (let i = 0; i < p; i++) {
      const s = ((i / p) * 2 - 1) * speed * 0.5;
      nut.write(s); bridge.write(s);
    }
  }
  for (let i = 0; i < out.length; i++) {
    const into = glide ? Math.min(1, i / glide) : 1;
    let f = start * (n.f / start) ** (into * into * (3 - 2 * into));
    wander = drift * wander + (1 - drift) * (rand() * 2 - 1);
    let cents = wander * driftScale;
    if (n.vibrato && i > vibFrom) {
      phase += (2 * Math.PI * n.rate) / sr;
      cents += n.vibrato * Math.min(1, (i - vibFrom) / (T.vibratoIn * sr)) * Math.sin(phase);
    }
    f *= 2 ** (cents / 1200);
    const period = sr / f - lagFix;
    // The bow: a crawl, up to speed with the accent on top, swaying, lifted at the end; its force bites and settles.
    const t = i / sr;
    const sw = T.waver * (0.62 * Math.sin(2 * Math.PI * 1.7 * t + sway[0]!) + 0.5 * Math.sin(2 * Math.PI * 3.9 * t + sway[1]!) + 0.35 * Math.sin(2 * Math.PI * 7.3 * t + sway[2]!));
    let up = 1;
    if (!n.from) {
      const r = Math.min(1, Math.max(0, (i - creep) / ramp));
      up = i < creep ? T.crawl : T.crawl + (1 - T.crawl) * r * r * (3 - 2 * r);
      if (i > creep) up *= 1 + accent * accentFall ** Math.max(0, i - creep - ramp * 0.6);
    }
    if (i >= release) lifted *= liftFall;
    const off = lifted > 0.001 ? lifted : 0;
    const vb = speed * up * off * (1 + sw);
    bite *= biteFall;
    if (i > creep) scratch *= scratchFall;
    // The force comes in with the speed (a player draws both together), a little heavier as the stroke bites.
    const sl = (kappa / Math.max(vb, speed * 0.03)) * (1 - bite);
    // The waves arriving at the bow from the finger and from the bridge (each turned over at its end).
    const fromNut = -nut.read(period * (1 - beta));
    const atBridge = bridge.read(period * beta);
    lp = (1 - pole) * atBridge + pole * lp;
    const fromBridge = -T.bridge * lp;
    const vh = fromNut + fromBridge;
    const dv = vb - vh;
    const g = grip(dv, sl);
    let push = off > 0 ? dv * g : 0;
    // Rosin: the slipping string drags a crackle from the hair (high, not low), most as the stroke starts.
    const crackle = rand() * 2 - 1;
    // Along the string it is high (a second difference); to the bridge, broader (a first).
    const grain = (crackle - 2 * hiss + hiss2) * 0.5 * speed * off;
    // The crackle comes in pulses, one each slip; it is filtered after, so the pulsing cannot fold it down low.
    const pulse = crackle * (rosinDirect * (1 - g) + scratch) * speed * off;
    const mid = hp.b0 * pulse + hp.b1 * hx1 + hp.b2 * hx2 - hp.a1 * hy1 - hp.a2 * hy2;
    const rasp = hp.b0 * mid + hp.b1 * hy1 + hp.b2 * hy2 - hp.a1 * hz1 - hp.a2 * hz2;
    hx2 = hx1; hx1 = pulse; hz2 = hz1; hz1 = rasp; hy2 = hy1; hy1 = mid;
    hiss2 = hiss;
    hiss = crackle;
    push += grain * rosin * (1 - g);
    nut.write(fromBridge + push);
    bridge.write(fromNut + push);
    ribbon = (1 - hair) * (atBridge + rasp) + hair * ribbon;
    ribbon2 = (1 - hair) * ribbon + hair * ribbon2;
    out[i] = ribbon2;
  }
  return out;
}
