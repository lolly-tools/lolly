// SPDX-License-Identifier: MPL-2.0
/**
 * Reed instruments blown, modelled: the saxophone and the clarinet as digital waveguides,
 * after Perry Cook's in the Synthesis ToolKit (the STK's Saxofony and Clarinet), worked out
 * in JS one note at a time and played back.
 *
 * The player's breath presses on a reed. The reed is a valve: the more the pressure across
 * it, the more it closes, so how much of the wave coming back up the bore it lets through
 * depends on that pressure (the reed table, clipped at fully open and fully shut). The bore
 * is a delay line the length of the note's period, with a little low-pass and an inverted
 * reflection at the bell, losing a few per cent each trip. The loop of breath, reed and
 * bore oscillates by itself, and how hard the player blows sets how far the reed beats and
 * so how bright the note is: a soft note is round, a hard one buzzes.
 *
 * - The saxophone's bore is a cone. Its waveguide is two delay lines in a loop, split at
 *   the mouthpiece's place along the cone, so every harmonic sounds.
 * - The clarinet's is a cylinder, closed at the reed: one line, half the period long, so
 *   the odd harmonics lead in the low register, as they do on a real clarinet.
 *
 * The breath swells in over a few tens of milliseconds with a little noise in it, a held
 * note gets a jaw vibrato that comes in after a moment, a note slurred from the one before
 * glides there with no new attack, and a scooped note starts a semitone flat.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */

export interface ReedNote {
  sr: number;
  /** The note (Hz), and the one it slurs from, if any. */
  f: number; from?: number;
  /** How hard it is blown (0 to 1), how long it is held (s), and how long to render (s). */
  vel: number; dur: number; seconds: number;
  bore: 'cone' | 'cylinder';
  /** The jaw vibrato's depth (cents) and rate (Hz); a scoop up into the note (semitones, 0 none). */
  vibrato: number; rate: number; scoop: number;
  /** How quickly the breath swells in (s). */
  attack: number;
}

/** A fractional delay line with linear interpolation, its length changeable every sample. */
class Line {
  private readonly buf: Float32Array;
  private at = 0;
  constructor(size: number) { this.buf = new Float32Array(size); }
  /** The sample `delay` samples ago. */
  read(delay: number): number {
    const d = Math.max(1, Math.min(this.buf.length - 2, delay));
    const whole = Math.floor(d);
    const frac = d - whole;
    const n = this.buf.length;
    const a = this.buf[(this.at - whole + n) % n]!;
    const b = this.buf[(this.at - whole - 1 + n) % n]!;
    return a + (b - a) * frac;
  }
  write(x: number): void {
    this.at = (this.at + 1) % this.buf.length;
    this.buf[this.at] = x;
  }
}

/**
 * The reed: how much of the returning wave it passes at a pressure difference, clipped
 * open and shut. The clarinet's closes as the pressure rises; the saxophone's waveguide,
 * whose loop takes the wave in the other sense, has the table the other way round (as in
 * the STK's own two instruments).
 */
const reed = (diff: number, slope: number): number => Math.max(-1, Math.min(1, REED_OFFSET + slope * diff));
const REED_OFFSET = 0.7;
const CLARINET_SLOPE = -0.3;
const SAX_SLOPE = 0.3;
/** The mouthpiece's place along the sax's cone, as a share of the loop (between two harmonics' nodes, so none is lost outright). */
const MOUTHPIECE = 0.23;
/** The loop's own delay (the filters'), taken off the period so the note is in tune; measured. */
const SAX_TRIM = 2.55;
const CLARINET_TRIM = 1.5;
/** How strongly the tongue sets the bore going (the wave it starts with, against the breath): the sax's cone takes a fuller start. */
const TONGUE = 0.25;
const SAX_TONGUE = 0.6;
/**
 * The sax's blowing pressure, soft to hard. In this waveguide the tone darkens and brightens
 * unevenly with pressure: below 0.55 the reed does not speak, from about 0.68 to 0.73 the
 * tone brightens with pressure as a played sax does (measured against an alto's mf and ff
 * notes), and above about 0.75 notes jump to the octave. So a stroke's strength stays in that band.
 */
const SAX_PRESSURE = [0.68, 0.73] as const;
/** The push of breath behind a tongued note as the tongue lets go of the reed (a share of the pressure), and how fast it settles (s). */
const SAX_PUSH = 0.25;
const SAX_PUSH_TIME = 0.05;
/**
 * How a tongued sax note's loudness rises: a recorded alto's goes from 20 dB down to its
 * full level in about 30 ms, where the waveguide by itself takes a tenth of a second to
 * grow. The note is worked out whole before it plays, so its steady level is known and its
 * first SPEAK_SHAPE seconds are brought to that rise; the tone keeps building as it does.
 */
const SPEAK = 0.03;
const SPEAK_SHAPE = 0.15;
/**
 * The 4th harmonic, lifted back (dB). Even heard at the bell, the loop sounds the harmonics
 * near 1 / MOUTHPIECE weakly, because the reed sits where they have a node: the 4th came out
 * about 10 dB under its neighbours, where a recorded alto's 3rd, 4th and 5th are about level.
 */
const SAX_FOURTH = 9;
/**
 * How much darker a sax blown softly is above 1 kHz (dB per unit of strength under full): a
 * recorded alto's harmonics there stand about 5 to 8 dB higher at ff than at mf, which this
 * waveguide's narrow pressure band (SAX_PRESSURE) cannot give by itself. At most SAX_DARK_MOST.
 */
const SAX_DARK = 12;
const SAX_DARK_MOST = 9;
/** How far a player's pitch wanders while holding a note (cents, standard deviation): a recorded alto's held notes, 1.5 to 3. */
const WANDER = 2.2;
/** How uneven the clarinet's reed is (the even harmonics it brings). */
const CLARINET_EVEN = 0.5;

/** Blow one note. */
export function blowReed(n: ReedNote, rand: () => number): Float32Array {
  const { sr } = n;
  const out = new Float32Array(Math.ceil(n.seconds * sr));
  const lines = [new Line(Math.ceil(sr / 30) + 4), new Line(Math.ceil(sr / 30) + 4)];
  const cone = n.bore === 'cone';
  const pressure = cone ? SAX_PRESSURE[0] + (SAX_PRESSURE[1] - SAX_PRESSURE[0]) * Math.min(1, Math.max(0, n.vel)) : 0.52 + 0.2 * n.vel;
  const attack = Math.max(1, n.attack * sr);
  const release = Math.round(n.dur * sr);
  const releaseLen = 0.07 * sr;
  const glide = n.from ? 0.05 * sr : n.scoop ? 0.08 * sr : 0;
  const start = n.from ?? (n.scoop ? n.f * 2 ** (-n.scoop / 12) : n.f);
  const vibratoFrom = Math.min(0.3, n.dur * 0.5) * sr;
  // The tongue: a player starts a note by releasing the reed against the tongue, which
  // sets the bore's fundamental going at once. Here the bore starts with a wave one period
  // long already in it, so a low note speaks in a few cycles instead of growing out of the
  // noise over a third of a second (and on the fundamental, not the octave).
  const seedPeriod = sr / start / (cone ? 1 : 2);
  for (let i = 0; i < Math.ceil(seedPeriod); i++) {
    const v = Math.sin((2 * Math.PI * i) / seedPeriod) * (cone ? SAX_TONGUE : TONGUE) * pressure;
    lines[0]!.write(v);
    lines[1]!.write(-v * MOUTHPIECE);
  }
  let lp = 0, last = 0;
  let phase = rand() * Math.PI * 2;
  // The push of breath as the tongue lets the reed go (none on a slur, which has no new attack).
  let push = cone && !n.from ? SAX_PUSH : 0;
  const pushFall = Math.exp(-1 / (SAX_PUSH_TIME * sr));
  // The pitch's slow wander: noise smoothed to below about 3 Hz, scaled to WANDER cents.
  const drift = Math.exp((-2 * Math.PI * 3) / sr);
  const driftScale = WANDER / (0.577 * Math.sqrt((1 - drift) / (1 + drift)));
  let wander = 0;
  for (let i = 0; i < out.length; i++) {
    // The breath: swelling in (at once on a slur), held, let go, with a little noise.
    const swell = n.from ? Math.min(1, i / (0.012 * sr)) : Math.min(1, i / attack);
    const gone = i < release ? 1 : Math.max(0, 1 - (i - release) / releaseLen);
    const breath = pressure * (1 + push) * swell * gone * (1 + (rand() * 2 - 1) * 0.06);
    push *= pushFall;
    // The pitch: gliding in from a slur or a scoop, then the jaw's vibrato once the note settles.
    const into = glide ? Math.min(1, i / glide) : 1;
    let f = start * (n.f / start) ** (into * into * (3 - 2 * into));
    wander = drift * wander + (1 - drift) * (rand() * 2 - 1);
    f *= 2 ** ((wander * driftScale) / 1200);
    if (i > vibratoFrom) {
      phase += (2 * Math.PI * n.rate) / sr;
      const depth = Math.min(1, (i - vibratoFrom) / (0.25 * sr));
      f *= 2 ** ((n.vibrato * depth * Math.sin(phase)) / 1200);
    }
    let y: number;
    if (n.bore === 'cone') {
      const period = sr / f - SAX_TRIM;
      const back = lines[0]!.read(period * (1 - MOUTHPIECE));
      lp = 0.5 * (back + last);
      last = back;
      const bell = -0.95 * lp;
      y = bell - lines[1]!.read(period * MOUTHPIECE);
      const diff = breath - y;
      lines[1]!.write(bell);
      lines[0]!.write(breath - diff * reed(diff, SAX_SLOPE) - bell);
      // What is heard is the wave arriving at the bell, where the sound leaves the horn. The
      // pressure at the mouthpiece has a node for every harmonic near a multiple of
      // 1 / MOUTHPIECE (the 4th and the 13th), which made the tone hollow; the bell's wave does not.
      y = back;
    } else {
      const half = sr / f / 2 - CLARINET_TRIM;
      const back = lines[0]!.read(half);
      lp = 0.5 * (back + last);
      last = back;
      const diff = -0.95 * lp - breath;
      y = breath + diff * reed(diff, CLARINET_SLOPE);
      lines[0]!.write(y);
      // The reed opens and shuts unevenly, which gives a real clarinet's weak even harmonics.
      y += CLARINET_EVEN * y * y;
    }
    out[i] = y;
  }
  // Take out the breath's own steady push, which is not sound.
  let x1 = 0, y1 = 0;
  for (let i = 0; i < out.length; i++) {
    const y = out[i]! - x1 + 0.995 * y1;
    x1 = out[i]!;
    y1 = y;
    out[i] = y;
  }
  if (cone) {
    peak(out, sr, n.f * 4, SAX_FOURTH, 4);
    shelf(out, sr, 1000, -Math.min(SAX_DARK_MOST, SAX_DARK * Math.max(0, 0.95 - n.vel)));
  }
  if (cone && !n.from) speak(out, sr, n.dur);
  return out;
}

/** A high shelf from `hz` up (dB `gain`), in place. */
function shelf(x: Float32Array, sr: number, hz: number, gain: number): void {
  if (gain === 0) return;
  const w = (2 * Math.PI * hz) / sr, cs = Math.cos(w);
  const a = 10 ** (gain / 40);
  const sq = 2 * Math.sqrt(a) * (Math.sin(w) / Math.SQRT2);
  const b0 = a * (a + 1 + (a - 1) * cs + sq), b1 = -2 * a * (a - 1 + (a + 1) * cs), b2 = a * (a + 1 + (a - 1) * cs - sq);
  const a0 = a + 1 - (a - 1) * cs + sq, a1 = 2 * (a - 1 - (a + 1) * cs), a2 = a + 1 - (a - 1) * cs - sq;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[i] = y;
  }
}

/** A peaking filter at `hz` (dB `gain`, quality `q`), in place. */
function peak(x: Float32Array, sr: number, hz: number, gain: number, q: number): void {
  if (hz >= sr * 0.45) return;
  const w = (2 * Math.PI * hz) / sr;
  const a = 10 ** (gain / 40);
  const alpha = Math.sin(w) / (2 * q);
  const b0 = 1 + alpha * a, b1 = -2 * Math.cos(w), b2 = 1 - alpha * a, a0 = 1 + alpha / a, a2 = 1 - alpha / a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const y = (b0 * v + b1 * x1 + b2 * x2 - b1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[i] = y;
  }
}

/** A window's RMS level, from sample `a` to `b`. */
function level(x: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = a; i < b; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, b - a));
}

/**
 * Bring a tongued note's first moments to a played note's rise (SPEAK): its level is
 * measured every 5 ms against its steady level (from the end of the shaped part to as far
 * as the note is held) and evened out to the rise, the correction fading out by the end of
 * the shaped part. A note held too briefly to have a steady level is left as it is.
 */
function speak(x: Float32Array, sr: number, held: number): void {
  const from = Math.round(Math.max(0.05, Math.min(SPEAK_SHAPE, held * 0.5)) * sr);
  const to = Math.min(x.length, Math.round(Math.min(held, 0.45) * sr));
  const hop = Math.round(0.005 * sr);
  if (to - from < hop * 4) return;
  const steady = level(x, from, to);
  if (steady <= 0) return;
  const gains: number[] = [];
  for (let k = 0; k * hop <= from; k++) {
    const t = (k * hop) / sr;
    const rise = t < SPEAK ? 0.5 - 0.5 * Math.cos((Math.PI * t) / SPEAK) : 1;
    const now = level(x, Math.max(0, k * hop - hop), Math.min(x.length, k * hop + hop));
    const g = now > 0 ? Math.min(4, (steady * rise) / now) : 0;
    // The correction fades out over the shaped part's last third.
    const fade = Math.min(1, Math.max(0, (from - k * hop) / (from / 3)));
    gains.push(1 + (g - 1) * fade);
  }
  for (let i = 0; i <= from && i < x.length; i++) {
    const k = Math.min(gains.length - 2, Math.floor(i / hop));
    const u = i / hop - k;
    x[i] = x[i]! * (gains[k]! + (gains[k + 1]! - gains[k]!) * u);
  }
}
