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
/** How strongly the tongue sets the bore going (the wave it starts with, against the breath). */
const TONGUE = 0.25;
/** How uneven the clarinet's reed is (the even harmonics it brings). */
const CLARINET_EVEN = 0.5;

/** Blow one note. */
export function blowReed(n: ReedNote, rand: () => number): Float32Array {
  const { sr } = n;
  const out = new Float32Array(Math.ceil(n.seconds * sr));
  const lines = [new Line(Math.ceil(sr / 30) + 4), new Line(Math.ceil(sr / 30) + 4)];
  const pressure = 0.52 + 0.2 * n.vel;
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
  const seedPeriod = sr / start / (n.bore === 'cone' ? 1 : 2);
  for (let i = 0; i < Math.ceil(seedPeriod); i++) {
    const v = Math.sin((2 * Math.PI * i) / seedPeriod) * TONGUE * pressure;
    lines[0]!.write(v);
    lines[1]!.write(-v * MOUTHPIECE);
  }
  let lp = 0, last = 0;
  let phase = rand() * Math.PI * 2;
  for (let i = 0; i < out.length; i++) {
    // The breath: swelling in (at once on a slur), held, let go, with a little noise.
    const swell = n.from ? Math.min(1, i / (0.012 * sr)) : Math.min(1, i / attack);
    const gone = i < release ? 1 : Math.max(0, 1 - (i - release) / releaseLen);
    const breath = pressure * swell * gone * (1 + (rand() * 2 - 1) * 0.06);
    // The pitch: gliding in from a slur or a scoop, then the jaw's vibrato once the note settles.
    const into = glide ? Math.min(1, i / glide) : 1;
    let f = start * (n.f / start) ** (into * into * (3 - 2 * into));
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
  return out;
}
