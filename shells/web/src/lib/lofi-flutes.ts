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
 * The constants were set by measuring the model against recordings, for measurement only
 * (no recording is in this repository): a flute's sustained notes with and without vibrato
 * at three strengths, and a pan flute played in a studio (with a low pan pipe and a wooden
 * one for the breath). Against them:
 * - the flute's 2nd to 5th harmonics within a few dB at each strength (the 4th 5 to 8 dB
 *   strong), filling out with the breath as recorded (centroid about 1.5, 1.7 and 1.95
 *   harmonics softly, at mezzo-forte and loud; recorded 1.3, 1.8 and 1.9);
 * - its breath 31 dB under the harmonics from 1 to 8 kHz (recorded 29 to 34), its chiff 9
 *   to 14 dB under them (recorded 8 to 14 at mezzo-forte), speaking within 3 dB in 80 ms
 *   at mezzo-forte (recorded 54 to 109) and in tune within 2 cents from C4 to C6;
 * - its vibrato 6, 12 and 18 cents at the three strengths with the level swinging 1.5 dB
 *   (recorded 6, 12 and 18 cents, 1.4 to 1.8 dB), released in about 300 ms (recorded 320);
 * - the pan flute's odd harmonics leading (2nd about 28 dB under the fundamental, 3rd 20,
 *   5th 30; recorded 30, 18 and 26), its breath 9 to 11 dB under them (recorded 10 to 21),
 *   its chiff 5 dB under (recorded 5 under to 2 over), speaking in 85 ms (recorded 70 to
 *   125).
 *
 * Pure: no DOM, no Web Audio; deterministic for the same note and seed.
 */

export type Pipe = 'open' | 'stopped';

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
}

const FLUTE_TUNING: Record<Pipe, Breath> = {
  open: {
    jet: 0.72, band: 3, gainSoft: 0.097, gainLoud: 0.22, evenSoft: 0.25, evenLoud: 0.75, reflect: 0.97, pole: 0.5, mouth: 0.97,
    turbulence: 1, air: 0.4, airHz: 3000, chiff: 0.3, chiffTime: 0.02, attackSoft: 0.05, attackLoud: 0.012, release: 0.04,
    vibratoBreath: 0.18, wander: 1.5, vibratoFrom: 0.15, vibratoIn: 0.25,
    push: 0.6, pushTime: 0.025, sharp: [3, 5], seed: 0.3, edge: 0, unsteady: 0.08,
  },
  stopped: {
    jet: 0.72, band: 3, gainSoft: 0.08, gainLoud: 0.14, evenSoft: 0.55, evenLoud: 0.7, reflect: 0.97, pole: 0.5, mouth: 0.97,
    turbulence: 3.5, air: 1.8, airHz: 3000, chiff: 0.8, chiffTime: 0.03, attackSoft: 0.06, attackLoud: 0.03, release: 0.03,
    vibratoBreath: 0.08, wander: 2, vibratoFrom: 0.2, vibratoIn: 0.25,
    push: 0.6, pushTime: 0.025, sharp: [3, 5], seed: 0.3, edge: 3, unsteady: 0.08,
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
  const lowest = Math.min(n.f, n.from ?? n.f, n.f * 2 ** (-Math.max(0, n.scoop) / 12));
  const bore = new Line(Math.ceil(sr / lowest) + 8);
  const jetLine = new Line(Math.ceil(sr / lowest) + 8);
  const v = Math.min(1, Math.max(0, n.vel));
  const gain = T.gainSoft * (T.gainLoud / T.gainSoft) ** v;
  const even = T.evenSoft + (T.evenLoud - T.evenSoft) * v;
  const release = Math.round(n.dur * sr);
  const attack = (T.attackSoft + (T.attackLoud - T.attackSoft) * v) * sr;
  const releaseFall = Math.exp(-1 / (T.release * sr));
  const chiffFall = Math.exp(-1 / (T.chiffTime * sr));
  // The chiff is a larger share of a soft note's start than of a loud one's.
  let chiff = n.from ? 0 : T.chiff * (1.5 - v + 40 * Math.max(0, 0.45 - v) ** 2);
  const pushFall = Math.exp(-1 / (T.pushTime * sr));
  let push = n.from ? 0 : T.push;
  // How sharp the loop runs by itself (cents, measured over the range), taken back out of the pipe's length.
  const flat = 2 ** ((T.sharp[0] + T.sharp[1] * n.f / 1000) / 1200);
  let breath = n.from ? 1 : 0;
  // The pitch: in from a slur or a scoop, wandering, with a breath vibrato once held.
  const glide = n.from ? 0.035 * sr : n.scoop ? 0.1 * sr : 0;
  const start = n.from ?? (n.scoop ? n.f * 2 ** (-n.scoop / 12) : n.f);
  const drift = Math.exp((-2 * Math.PI * 2) / sr);
  const driftScale = T.wander / (0.577 * Math.sqrt((1 - drift) / (1 + drift)));
  let wander = 0;
  let phase = rand() * Math.PI * 2;
  // The breath is never quite steady: three slow movements at rates that never line up.
  const drifts = [rand() * 6.3, rand() * 6.3, rand() * 6.3];
  const vibFrom = T.vibratoFrom * sr;
  const lag = 2 * poleDelay(T.pole, sr, n.f);
  let lp = 0, lp2 = 0, last = 0, dcx = 0, dcy = 0;
  let bx1 = 0, bx2 = 0, by1 = 0, by2 = 0;
  // The tongue lets the jet go already swinging at the note: the pipe starts with a little
  // of one period in it, so the note speaks in a few round trips (a slurred note's pipe is
  // still ringing with the last one).
  {
    const p = (sr / start) * (stopped ? 0.5 : 1);
    const amp = T.seed * (n.from ? 2 : 1) * (sr / start) / (2 * Math.PI);
    for (let i = 0; i < Math.ceil(p); i++) bore.write(Math.sin((2 * Math.PI * i) / p) * amp);
  }
  // The hiss of air over the hole: a broad band of noise round `airHz`.
  const aw = (2 * Math.PI * T.airHz) / sr, aal = Math.sin(aw) / (2 * 0.5), aa0 = 1 + aal;
  const ab0 = aal / aa0, aa1 = (-2 * Math.cos(aw)) / aa0, aa2 = (1 - aal) / aa0;
  let ax1 = 0, ax2 = 0, ay1 = 0, ay2 = 0;
  for (let i = 0; i < out.length; i++) {
    const into = glide ? Math.min(1, i / glide) : 1;
    let f = start * (n.f / start) ** (into * into * (3 - 2 * into));
    wander = drift * wander + (1 - drift) * (rand() * 2 - 1);
    let cents = wander * driftScale;
    let swell = 1;
    if (n.vibrato && i > vibFrom) {
      phase += (2 * Math.PI * n.rate) / sr;
      const depth = Math.min(1, (i - vibFrom) / (T.vibratoIn * sr));
      const s = Math.sin(phase);
      cents += n.vibrato * depth * s;
      swell += T.vibratoBreath * depth * s;
    }
    f *= 2 ** (cents / 1200);
    const period = (sr / f) * flat;
    // The breath: in over the attack (at once on a slur), held, let go.
    if (i < release) breath = Math.min(1, breath + 1 / attack);
    else breath *= releaseFall;
    const tt = i / sr;
    const unsteady = 1 + T.unsteady * (0.62 * Math.sin(2 * Math.PI * 1.3 * tt + drifts[0]!) + 0.5 * Math.sin(2 * Math.PI * 2.9 * tt + drifts[1]!) + 0.35 * Math.sin(2 * Math.PI * 6.1 * tt + drifts[2]!));
    const press = breath * swell * unsteady * (1 + push);
    push *= pushFall;
    chiff *= chiffFall;
    // The wave back from the far end: turned over by an open end, not by a stopped one, its top lost first.
    const loop = (stopped ? period / 2 : period) - lag;
    lp = (1 - T.pole) * bore.read(loop) + T.pole * lp;
    lp2 = (1 - T.pole) * lp + T.pole * lp2;
    const back = (stopped ? 1 : -1) * T.reflect * lp2;
    // The jet: pushed by the air swaying in the hole, carrying its turbulence, reaching the edge a moment later.
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
    // The jet is turbulent: its noise drives the pipe too, which rings it into a breathy halo round each harmonic.
    const turb = (rand() * 2 - 1) * (T.turbulence * press + chiff * 0.2);
    const wave = -T.mouth * back + drive + turb;
    bore.write(wave);
    // What is heard: the air moving at the hole, with a hiss of breath over the top.
    const hissIn = (rand() * 2 - 1) * (T.air * press * press + chiff);
    const hiss = ab0 * hissIn - ab0 * ax2 - aa1 * ay1 - aa2 * ay2;
    ax2 = ax1; ax1 = hissIn; ay2 = ay1; ay1 = hiss;
    // What the jet itself sends out at the edge, heard over the top of the pipe (a stopped pipe's even harmonics come from here).
    const y = wave - back + T.edge * drive + hiss;
    const d = y - dcx + 0.995 * dcy;
    dcx = y; dcy = d;
    out[i] = d;
  }
  return out;
}
