// SPDX-License-Identifier: MPL-2.0
/**
 * The dizi, the Chinese transverse bamboo flute, modelled: the jet flute (lib/lofi-flutes.ts)
 * with the dimo, the thin membrane glued over a hole between the mouth hole and the finger
 * holes, buzzing on the bore's pressure.
 *
 * The jet, the pipe, the breath and the tongue are the flute's. The membrane is driven by the
 * bore's fundamental and swings against its own stiffness, clipping softly and evenly both
 * ways, so it adds the odd harmonics, and its buzz radiates from its hole in two bands round
 * 4.4 and 5.8 kHz (DIMO). A recorded dizi carries its third, fifth and seventh harmonics
 * only 11 to 16 dB under the whole in its middle register, where a Western flute's fall to
 * 18 to 47 dB under, while its even harmonics stay near a flute's: that odd series is the
 * buzz. The bamboo bore and its small holes radiate little under its lowest notes. A dizi
 * player blows with more air than a flautist (recorded dizi carry 3 to 6 dB more between the
 * harmonics), and ornaments: a grace note flicked from the hole above (the dieyin), a slide
 * up as a finger leaves its hole, a turn to the neighbour and back, a flutter-tongue on a
 * long, loud note and a fall off a note before a breath (diziPlay).
 *
 * Measured against recorded dizi, for measurement only (no recording is in this
 * repository): the FolkMusic dataset's dizi clips (Zenodo 8012071, CC BY 4.0, 80 phrases),
 * twelve sustained notes F5 to G6 from a CC0 Freesound pack ("Flute Dizi C all notes",
 * whose sharps are pitch-shifted), CC0 phrases from Freesound (108242, 342425, 594071) and
 * two CC BY 4.0 loops (429867, 454704). Against them:
 * - held harmonics 1 to 8 within 4.3 dB (rms) of the recordings register by register from
 *   G4 to B6, where the flute it is built on is 14.1 dB away;
 * - over the same phrases played by the model and by the players (the model following
 *   their pitch, note by note), the long-term spectrum from 250 Hz to 8 kHz 5 to 10 dB
 *   (rms over third-octave bands) from each recording, 4.1 dB in the median, where the
 *   voice it replaced was 9.5 to 14.2 dB from each;
 * - its flutter-tongue at 18 a second (recorded 15 to 19), its vibrato on most held
 *   notes at about 4.9 a second and 12 cents (recorded 4.4 to 5.8 and 9 to 13).
 *
 * Pure apart from playDizi (Web Audio): deterministic for the same note and seed.
 */
import { blowFlute, FLUTE_BREATH, FLUTE_DEEP, FLUTE_GHOST, FLUTE_KU, FLUTE_PLAYED, FLUTE_SCOOP, FLUTE_SNATCH, FLUTE_SOFT, FLUTE_STOP, FLUTE_SWELL, FLUTE_TAPER, type JetNote } from './lofi-flutes.ts';
import { inhale, noteSpeed, type InhaleShape } from './lofi-breath.ts';
import { mtof, type VoiceKit } from './lofi-voices.ts';

/**
 * The dimo's buzz, fitted to recorded dizi: how hard the bore's fundamental drives the
 * membrane (`drive`, against the flute's held level at mezzo-forte: far enough that the
 * membrane clips at every strength, as the recordings' steady odd series says), how
 * lopsided the membrane's swing is (`tilt`, 0 symmetric, which gives odd harmonics only),
 * and where its buzz radiates: two bands (Hz, their Q) at their levels (against the held level).
 */
export const DIMO = { drive: 7.03, tilt: -0.011, bands: [[4381, 2.46, 1.057], [5842, 2.46, 0.898]] as ReadonlyArray<readonly [number, number, number]> };

/** The jet flute's held level at mezzo-forte (dB: a, plus c a semitone over C5): lib/lofi-winds.ts FLUTES.open.raw. */
const FLUTE_HELD: readonly [number, number] = [26.1, -0.52];

/** A band-pass biquad (RBJ, constant peak gain) run over `x`. */
function bandpass(sr: number, x: Float32Array, hz: number, q: number): Float32Array {
  const w = (2 * Math.PI * Math.min(hz, sr * 0.45)) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!, o = b0 * v + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = o;
    y[i] = o;
  }
  return y;
}

/**
 * The membrane on a blown note: the bore's fundamental (`f`, picked out of the note) swings
 * the dimo, which buzzes against its own stiffness as a soft clip does (a symmetric swing
 * gives the odd harmonics a recorded dizi carries), and the buzz radiates from the hole in
 * two bands.
 */
export function dimo(sr: number, x: Float32Array, f: number, midi: number): Float32Array {
  const ref = 10 ** ((FLUTE_HELD[0] + FLUTE_HELD[1] * (midi - 72)) / 20) * Math.SQRT2;
  const fund = bandpass(sr, x, f, 1.5);
  const t0 = Math.tanh(DIMO.tilt);
  const swing = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) swing[i] = Math.tanh((DIMO.drive * fund[i]!) / ref + DIMO.tilt) - t0;
  const out = Float32Array.from(x);
  for (const [hz, q, level] of DIMO.bands) {
    const b = bandpass(sr, swing, hz, q);
    for (let i = 0; i < out.length; i++) out[i]! += ref * level * b[i]!;
  }
  return out;
}

/** Under this (Hz) the small bamboo bore and its holes radiate less and less: a second-order high-pass, measured on recorded dizi (the breath under the lowest notes). */
const DIZI_LOW = 300;

/** A second-order high-pass (RBJ, Q 0.7) run over `x` in place. */
function lowCut(sr: number, x: Float32Array, hz: number): void {
  const w = (2 * Math.PI * hz) / sr, c = Math.cos(w), alpha = Math.sin(w) / 1.4, a0 = 1 + alpha;
  const b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, a1 = (-2 * c) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!, y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[i] = y;
  }
}

/** Blow one dizi note: the jet flute's open pipe, through the dimo. */
export function blowDizi(n: Omit<JetNote, 'pipe'>, rand: () => number): Float32Array {
  const y = dimo(n.sr, blowFlute({ ...n, pipe: 'open' }, rand), n.f, 69 + 12 * Math.log2(n.f / 440));
  lowCut(n.sr, y, DIZI_LOW);
  return y;
}

/** How a dizi player plays, measured on recorded dizi music (see diziPlay). */
export const DIZI_PLAYER = {
  /** A note held longer than `vibratoFrom` s gets the breath vibrato `vibratoShare` of the time: log-normal about `vibrato` cents (half its swing) by `vibratoSpread`, within 5 to 30, at about `rate` Hz by `rateSpread`. */
  vibratoFrom: 0.35, vibratoShare: 0.75, vibrato: 12, vibratoSpread: 0.4, rate: 4.9, rateSpread: 0.45,
  /**
   * A note the composer bends (art 1): a grace note from above (the dieyin, a finger
   * flicked off a hole) `graceShare` of them, `graceCents` over for `graceLen` s; a slide
   * up from below (the finger sliding off its hole) `slideShare` of them, `slide`
   * semitones; or a turn (to the neighbour above and back) `turnShare` of them, `turnCents`
   * over `turnLen` s starting `turnAt` s in. The rest are played plain.
   */
  graceShare: 0.4, graceCents: 200, graceLen: 0.045,
  /** A grace note on a note the composer left plain, held at least `graceFrom` s and not slurred, `graceFree` of the time: recorded dizi players ornament far more notes than a tune marks. */
  graceFree: 0.15, graceFrom: 0.3,
  slideShare: 0.25, slide: 2,
  turnShare: 0.2, turnCents: 200, turnLen: 0.16, turnAt: 0.1,
  /** A long, loud note flutter-tongued (the huashe, a rolled tongue) `flutterShare` of the time, at about `flutterRate` Hz, its air `flutterAir` dB up. */
  flutterShare: 0.12, flutterFrom: 0.6, flutterVel: 0.65, flutterRate: 18, flutterAir: 6,
  /** A held note before a breath falls off its end `fallShare` of the time: `fallCents` down over the last `fallLen` s. */
  fallShare: 0.15, fallCents: 200, fallLen: 0.12,
  /** The dizi's air against a Western flute's (dB): a bamboo flute played with more breath, as recorded dizi carry 3 to 6 dB more between the harmonics. */
  air: 4,
} as const;

/** What the station says about a note: its pitch, how long it is held (s), how hard it is blown, the flautist's flags (lib/lofi-flutes.ts FLUTE_*) and whether it is slurred. */
export interface DiziNote { midi: number; held: number; vel: number; flags: number; slurred: boolean }
/** How the player plays it: the JetNote's parts, and a flutter-tongue's rate (Hz, 0 none). */
export type DiziPlay = Pick<JetNote, 'vibrato' | 'rate' | 'scoop' | 'bend' | 'reach' | 'airDb'> & { flutter: number };

/** A standard normal draw (Box-Muller), cut at 2.5. */
function gauss(rand: () => number): number {
  const v = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  return Math.max(-2.5, Math.min(2.5, v));
}
/** A smooth step from 0 to 1 as `u` goes from 0 to 1. */
const ease = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/**
 * The fingers' and the tongue's choices for one note, from the player's seeded source: the
 * breath vibrato, and on a note the composer bends a grace note, a slide or a turn; a long,
 * loud note may be flutter-tongued; a note before a breath may fall off its end.
 */
export function diziPlay(n: DiziNote, rand: () => number): DiziPlay {
  const P = DIZI_PLAYER;
  const ghost = (n.flags & FLUTE_GHOST) !== 0;
  const sings = !ghost && n.held > P.vibratoFrom && rand() < P.vibratoShare;
  const vibrato = sings ? Math.min(30, Math.max(5, P.vibrato * Math.exp(P.vibratoSpread * gauss(rand)))) : 0;
  const rate = Math.min(6.5, Math.max(4, P.rate + P.rateSpread * gauss(rand)));
  const play: DiziPlay = { vibrato, rate, scoop: 0, reach: 0, airDb: P.air, flutter: 0 };
  const bends: Array<(s: number) => number> = [];
  const grace = (): void => {
    const cents = P.graceCents * (rand() < 0.3 ? 1.5 : 1), len = P.graceLen * (0.75 + 0.5 * rand());
    bends.push((s: number) => cents * (1 - ease((s - len) / 0.015)));
  };
  if (!(n.flags & FLUTE_SCOOP) && !ghost && !n.slurred && n.held >= P.graceFrom && rand() < P.graceFree) grace();
  if (n.flags & FLUTE_SCOOP) {
    const pick = rand();
    if (pick < P.graceShare && !n.slurred) grace();
    else if (pick < P.graceShare + P.slideShare && !n.slurred) {
      play.scoop = P.slide;
    } else if (pick < P.graceShare + P.slideShare + P.turnShare && n.held > P.turnAt + P.turnLen + 0.05) {
      const cents = P.turnCents * (0.85 + 0.3 * rand()), len = P.turnLen * (0.8 + 0.4 * rand()), at = P.turnAt;
      bends.push((s: number) => { const u = (s - at) / len; return u <= 0 || u >= 1 ? 0 : cents * (u < 0.25 ? ease(u / 0.25) : u < 0.6 ? 1 : ease((1 - u) / 0.4)); });
    }
  }
  if (!ghost && n.held >= P.flutterFrom && n.vel >= P.flutterVel && rand() < P.flutterShare) {
    play.flutter = P.flutterRate * (0.9 + 0.2 * rand());
    play.airDb = P.air + P.flutterAir;
  }
  if ((n.flags & FLUTE_BREATH) && n.held > 0.4 && rand() < P.fallShare) {
    const len = P.fallLen * (0.8 + 0.4 * rand()), cents = P.fallCents * (0.8 + 0.4 * rand()), from = n.held - len;
    bends.push((s: number) => -cents * ease((s - from) / len));
    play.reach = cents / 100 + 0.3;
  }
  if (bends.length) play.bend = (s: number) => bends.reduce((a, b) => a + b(s), 0);
  return play;
}

/** A flutter-tongue on a rendered note: the tongue rolling against the jet at `rate` Hz, interrupting the tone. */
export function flutterTongue(sr: number, x: Float32Array, rate: number, rand: () => number): void {
  let phase = rand() * 2 * Math.PI;
  for (let i = 0; i < x.length; i++) {
    phase += (2 * Math.PI * rate * (1 + 0.08 * Math.sin(i / sr * 3.1))) / sr;
    const s = Math.sin(phase);
    x[i]! *= 0.45 + 0.55 * (s > 0 ? Math.sqrt(s) : 0);
  }
}

/** The dizi's level against the voice it replaced, how loud it comes out of the model (dB: a, plus b a unit of strength over a half, plus c a semitone over C5, measured), and how much of a note's own loudness against that trend the player keeps. */
const DIZI_LEVEL = 0.042;
export const DIZI_RAW: readonly [number, number, number] = [28.0, 8.1, -0.79];
const DIZI_KEPT = 0.3;
/** A tongued note's burst (dB) by how it is tongued, as the flautist's (lib/lofi-winds.ts). */
const PUFF = { tu: 0, du: -2.5, ku: -2.8, ghost: -6 };
/** The dizi player's breath in a rest: across the lips and through the mouth, as the flautist's (lib/lofi-winds.ts FLUTE_INHALE). */
const DIZI_INHALE: InhaleShape = { bands: [{ centre: 1400, width: 1.53 }, { centre: 3500, width: 1.01, level: -6.9 }], rise: 0.25, fall: 0.45 };

/** A small seeded source, from the station's own, so a tune's notes are the same each time. */
function seeded(k: VoiceKit): () => number {
  let a = Math.floor(k.rng() * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rendered note into the graph at `t`, at `level`. */
function playBuffer(k: VoiceKit, data: Float32Array, out: AudioNode, t: number, level: number): void {
  const { ctx } = k;
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = level;
  src.connect(g).connect(out);
  src.start(t);
}

/**
 * The dizi as a lead: the flautist's marks (lib/lofi-perform.ts flautist: a softer tongue,
 * a ghosted note, a swell or a taper, a note stopped by the tongue, a breath in the rest)
 * played on the jet flute through the dimo, with the dizi player's ornaments (diziPlay).
 * A note slurred `from` the one before moves under the same breath.
 */
export function playDizi(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from: number | undefined): void {
  const { ctx } = k;
  const flags = art & FLUTE_PLAYED ? art : art === 1 ? FLUTE_SCOOP : 0;
  const ghost = (flags & FLUTE_GHOST) !== 0;
  const held = Math.max(0.05, dur);
  const strength = Math.min(1, Math.max(0, vel)) * (ghost ? 0.75 : 1);
  const rand = seeded(k);
  const play = diziPlay({ midi, held, vel: strength, flags, slurred: from !== undefined }, rand);
  const ku = (flags & FLUTE_KU) !== 0;
  const tongue = ghost ? PUFF.ghost : ku ? PUFF.ku : flags & FLUTE_SOFT ? PUFF.du : PUFF.tu;
  const swell = (flags & FLUTE_SWELL) !== 0, taper = (flags & FLUTE_TAPER) !== 0;
  const { flutter, ...jet } = play;
  const data = blowDizi({
    sr: ctx.sampleRate, f: mtof(midi), from: from === undefined ? undefined : mtof(from), vel: strength, dur: held, seconds: held + 0.3,
    ...jet, tongue: ghost ? 0.3 : flags & FLUTE_SOFT ? 0.4 : 1,
    contour: swell && taper ? 0 : swell ? 3 : taper ? -4 : 0, arch: swell && taper ? 3 : 0,
    stop: (flags & FLUTE_STOP) !== 0,
    burst: from === undefined ? { db: tongue, centre: ku ? 0.8 : 1, speed: noteSpeed(held, 0.1, 0.3) } : null,
    unsettled: from === undefined ? 2.5 * noteSpeed(held, 0.1, 0.3) : 0,
  }, rand);
  if (flutter) flutterTongue(ctx.sampleRate, data, flutter, rand);
  const expected = DIZI_RAW[0] + DIZI_RAW[1] * (strength - 0.5) + DIZI_RAW[2] * (midi - 72);
  let s = 0;
  const a = Math.floor(Math.min(0.06, held / 3) * ctx.sampleRate), b = Math.max(a + 32, Math.floor(Math.min(held, 0.6) * ctx.sampleRate));
  for (let i = a; i < b && i < data.length; i++) s += data[i]! * data[i]!;
  const own = 10 * Math.log10(s / (b - a) + 1e-20);
  const level = DIZI_LEVEL * (0.55 + 0.45 * strength) * (ghost ? 0.6 : 1);
  playBuffer(k, data, out, t, level * 10 ** (-((1 - DIZI_KEPT) * own + DIZI_KEPT * expected) / 20));
  if (flags & FLUTE_BREATH) {
    const deep = (flags & FLUTE_DEEP) !== 0, snatched = (flags & FLUTE_SNATCH) !== 0;
    const air = inhale(ctx.sampleRate, snatched ? 0.12 : deep ? 0.34 : 0.2, DIZI_INHALE, Math.floor(k.rng() * 4294967296));
    playBuffer(k, air, out, t + held + (snatched ? 0.01 : 0.07), level * 10 ** ((deep ? -25 : -28) / 20));
  }
}
