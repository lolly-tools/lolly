// SPDX-License-Identifier: MPL-2.0
/**
 * A chopped break's recording, made the way a sampled break was: a funk drummer plays the
 * tune's take (engine/src/lofi-break-chop.ts breakTake) on Lolly's modelled kit
 * (lib/lofi-kit.ts) in a live room, the record is sampled into an old sampler (a low sample
 * rate, twelve bits, the record pushed in hot), and the sampler plays it back faster or
 * slower than the drummer played, its pitch moving with its speed. The result is one mono
 * recording per tune, at the tune's tempo, which the station slices
 * (lib/lofi-break-kit.ts).
 *
 * THE ROOM. Two room microphones hear everything at once: each drum's bleed into the
 * others, early reflections off the walls a few milliseconds apart, and a short diffuse
 * tail, darker as it rings. The snare's wires buzz in sympathy whenever the kick is struck.
 * A drum bus compressor brings the room and the ghost notes up between the hits, as the
 * records' do.
 *
 * THE SAMPLER. Each style has its own (SAMPLERS): its sample rate, its bit depth, whether
 * its input filter let the cymbals' top fold back down as aliasing (a sampler with no
 * anti-aliasing filter), its playback (holding each stored sample until the next, which
 * images the spectrum above the sampler's half rate, or interpolating), and its output
 * filter. The source record adds its own colour first: a dark top, a little rumble taken
 * away, and a few clicks of dust that are chopped up with the break.
 *
 * Pure: no DOM and no Web Audio. Deterministic: every random choice comes from a seeded
 * source, so a tune's break is the same recording on every render. Each piece of the kit is
 * rendered once (soft and hard strokes, a take or two of each) and every stroke of the take
 * mixes one in, so the work is a few pieces, done a step at a time (BreakRecorder.step).
 */
import { SLICES, type BreakDrum, type BreakStyle, type BreakTake } from '../../../../engine/src/lofi-break-chop.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';
import * as K from './lofi-kit.ts';

/** A style's sampler, and the record and room it sampled. */
export interface Sampler {
  /** The sampler's own rate (Hz) and bit depth. */
  rate: number;
  bits: number;
  /** Whether its input filtered the top away (false: the cymbals above half its rate fold back down). */
  filtered: boolean;
  /** Playback: each stored sample held until the next ('hold', imaging the spectrum), or interpolated. */
  hold: boolean;
  /** Its output filter (Hz). */
  out: number;
  /** How hot the record was sampled: the gain before the converter (1 peaks at full scale), its loudest hits clipping softly past 1. */
  hot: number;
  /** The record's top (Hz): an old recording's own darkness. */
  dark: number;
  /** How many of the record's dust clicks a second, and the record's surface noise (dB under the break's peak). */
  dust: number;
  surface: number;
  /** The producer's EQ on the sampled break: its presence near 3 kHz and its low mids near 550 Hz (dB). */
  presence: number;
  mud: number;
  /** The room microphones against the kit (the room's share), and the room's decay (s, 60 dB). */
  room: number;
  rt60: number;
}

/**
 * The styles' samplers. Jungle and breakbeat: a twelve-bit sampler at a reduced rate with
 * its filter in, pitched up; hip-hop: a twelve-bit drum machine sampler at about 26 kHz with
 * no input filter, its hats folding back as grit, not pitched; trip-hop: a lower rate still
 * and a dark, dusty record, slowed; drum and bass: a sixteen-bit sampler, clean.
 */
export const SAMPLERS: Record<BreakStyle, Sampler> = {
  jungle: { rate: 30000, bits: 12, filtered: true, hold: true, out: 10500, hot: 1.25, dark: 12000, dust: 3, surface: 46, presence: 3, mud: -3, room: 0.95, rt60: 0.8 },
  breakbeat: { rate: 32000, bits: 12, filtered: true, hold: true, out: 11500, hot: 1.15, dark: 13000, dust: 2, surface: 50, presence: 2, mud: -3, room: 0.9, rt60: 0.75 },
  hiphop: { rate: 26040, bits: 12, filtered: false, hold: true, out: 10500, hot: 1.3, dark: 11000, dust: 4, surface: 44, presence: 1, mud: -2, room: 0.9, rt60: 0.75 },
  triphop: { rate: 22050, bits: 12, filtered: true, hold: true, out: 9000, hot: 1.2, dark: 9000, dust: 7, surface: 40, presence: 0, mud: 0, room: 1.25, rt60: 0.95 },
  dnb: { rate: 44100, bits: 16, filtered: true, hold: false, out: 16000, hot: 1, dark: 16000, dust: 0.5, surface: 64, presence: 2, mud: -2, room: 0.9, rt60: 0.7 },
};

/** The kit the drummer plays: its leans, from lib/lofi-drums.ts's drumKit, and the kick's pitch (Hz). */
export interface BreakKit { snareHead: number; wires: number; ring: number; hatBright: number; hatDecay: number; rideRate: number; wash: number; kick: number }

/**
 * Each piece's level in the take's mix: a recorded kit's balance, the backbeat as loud as the
 * kick and the cymbals under both, set with the desk below until the take's octave bands sit
 * where twelve recorded funk takes' do (docs/generated-music.md). The station's kit is
 * balanced for a different job (lib/lofi-drums.ts LEVEL: each piece against the voice it replaced).
 */
const LEVEL: Record<'kick' | 'snare' | 'hat' | 'open' | 'ride', number> = { kick: 0.9, snare: 1.15, hat: 0.11, open: 0.13, ride: 0.24 };

/** A stroke's loudness by its velocity, as lib/lofi-drums.ts strokeLevel: full at 0.95, ghost notes falling away faster below 0.4. */
const strokeLevel = (vel: number): number => Math.min(1.25, vel >= 0.4 ? vel / 0.95 : (0.4 / 0.95) * (vel / 0.4) ** 2.5);

/** The pieces a take needs: each drum at its strokes (soft and hard), with how many takes of each. */
interface PieceSpec { drum: 'kick' | 'snare' | 'hat' | 'open' | 'ride'; vel: number; takes: number }
const PIECES: readonly PieceSpec[] = [
  { drum: 'kick', vel: 0.95, takes: 1 }, { drum: 'kick', vel: 0.72, takes: 1 },
  { drum: 'snare', vel: 0.95, takes: 2 }, { drum: 'snare', vel: 0.62, takes: 1 }, { drum: 'snare', vel: 0.3, takes: 2 },
  { drum: 'hat', vel: 0.66, takes: 1 }, { drum: 'hat', vel: 0.4, takes: 1 }, { drum: 'open', vel: 0.6, takes: 1 },
  { drum: 'ride', vel: 0.66, takes: 1 }, { drum: 'ride', vel: 0.42, takes: 1 },
];
/** How much higher the break's snare is tuned than the station's kit, and how much more its wires buzz (fitted to recorded funk drumming, docs/generated-music.md). */
const SNARE_UP = 1.35, SNARE_WIRES = 1.5;
/** The cymbals as the break hears them: fewer partials (a twelve-bit sampler at a low rate cannot tell more apart) and shorter rings. */
const BREAK_RIDE: K.CymbalSpec = { ...K.RIDE, density: 12, seconds: 1.4 };
const BREAK_OPEN: K.CymbalSpec = { ...K.HAT_OPEN, density: 9, seconds: 0.8 };
const BREAK_HAT: K.CymbalSpec = { ...K.HAT_CLOSED, density: 5 };

/** Which piece a stroke plays: its drum at the nearest strength it was rendered at. */
function pieceFor(drum: BreakDrum, vel: number): PieceSpec | null {
  const kind = drum === 'ghost' ? 'snare' : drum === 'hatSoft' ? 'hat' : drum === 'rideSoft' ? 'ride' : drum;
  const at = PIECES.filter(p => p.drum === kind);
  if (!at.length) return null;
  return at.reduce((best, p) => (Math.abs(p.vel - vel) < Math.abs(best.vel - vel) ? p : best));
}
const pieceKey = (p: PieceSpec, take: number): string => `${p.drum}:${p.vel}:${take}`;

/** A seeded source for one piece, so a piece renders the same whenever it is rendered. */
function pieceRandom(seed: number, key: string): () => number {
  let h = (seed ^ 0x2545f491) >>> 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return mulberry32(h);
}

/**
 * A cymbal's partials for a sampler: those above half its rate fold back down when its input
 * lets them through (aliasing), quieter by the input stage's own roll-off.
 */
function folded(base: readonly K.Partial[], s: Sampler, sr: number): K.Partial[] {
  if (s.filtered) return [...base];
  return base.map(p => (p.f < sr * 0.48 ? p : { ...p, f: sr - p.f, a: p.a * 0.35 })).filter(p => p.f > 200);
}

/** Render one piece of the kit at `sr`. */
function renderPiece(p: PieceSpec, take: number, kit: BreakKit, s: Sampler, sr: number, seed: number): Float32Array {
  const r = pieceRandom(seed, pieceKey(p, take));
  switch (p.drum) {
    case 'kick': return K.kickStroke(sr, kit.kick, p.vel, 0.85, 0.34, r);
    case 'snare': {
      // A funk drummer's snare, cranked up high and its wires tight: the crack the breaks are known for, little under 150 Hz.
      const x = K.snareStroke(sr, Math.max(230, Math.min(330, kit.snareHead * SNARE_UP)), p.vel, kit.wires * SNARE_WIRES, kit.ring, r);
      highpass1(x, sr, 150);
      return K.normalise(x, 0.95);
    }
    case 'hat': { const spec = { ...BREAK_HAT, scale: kit.hatBright, choke: (BREAK_HAT.choke ?? 0.05) * kit.hatDecay }; return K.cymbal(sr, spec, folded(K.cymbalBase(spec, pieceRandom(seed, 'hat-base')), s, sr), p.vel, r); }
    case 'open': { const spec = { ...BREAK_OPEN, scale: kit.hatBright }; return K.cymbal(sr, spec, folded(K.cymbalBase(spec, pieceRandom(seed, 'open-base')), s, sr), p.vel, r); }
    case 'ride': { const spec = { ...BREAK_RIDE, scale: kit.rideRate / 0.9, lives: kit.wash }; return K.cymbal(sr, spec, folded(K.cymbalBase(spec, pieceRandom(seed, 'ride-base')), s, sr), p.vel, r); }
  }
}

/** The drummer's tail past the last bar (s): the last strokes ringing out. */
const TAIL = 1.2;

/** A notch in place (RBJ), narrow: the zero an elliptic filter puts just past its edge. */
function notch(x: Float32Array, sr: number, hz: number): void {
  if (hz >= sr * 0.48) return;
  const w = (2 * Math.PI * hz) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * 2.5), a0 = 1 + al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const v = x[n]!;
    const y = (v - 2 * cw * x1 + x2 + 2 * cw * y1 - (1 - al) * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[n] = y;
  }
}
/** One-pole low-pass in place. */
function lowpass1(x: Float32Array, sr: number, hz: number): void {
  const k = 1 - Math.exp((-2 * Math.PI * hz) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y += k * (x[i]! - y); x[i] = y; }
}
/** One-pole high-pass in place. */
function highpass1(x: Float32Array, sr: number, hz: number): void {
  const a = Math.exp((-2 * Math.PI * hz) / sr);
  let y = 0, px = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]!; y = a * (y + v - px); px = v; x[i] = y; }
}
/** A fourth-order Butterworth low-pass in place: the sampler's output filter. */
function lowpass4(x: Float32Array, sr: number, hz: number): void {
  const f = Math.min(hz, sr * 0.45);
  for (const q of [0.5412, 1.3066]) {
    const w = (2 * Math.PI * f) / sr, cw = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha, b0 = (1 - cw) / 2 / a0, b1 = (1 - cw) / a0, a1 = (-2 * cw) / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let n = 0; n < x.length; n++) {
      const v = x[n]!;
      const y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = y;
      x[n] = y;
    }
  }
}

/**
 * The room the drummer played in: early reflections off the walls (a few taps, 6 to 30 ms),
 * then a short diffuse tail (four combs into two all-passes, Schroeder's reverberator), its
 * top darkening as it rings, fed from the kit above the kick's boom.
 */
function room(dry: Float32Array, sr: number, rt60: number, r: () => number): Float32Array {
  const send = new Float32Array(dry);
  highpass1(send, sr, 160);
  const out = new Float32Array(dry.length);
  for (const [ms, g] of [[6.3, 0.5], [11.7, 0.42], [17.9, 0.34], [23.1, 0.27], [29.6, 0.22]] as const) {
    const d = Math.round((ms + r() * 1.5) * sr / 1000);
    for (let i = d; i < out.length; i++) out[i] = out[i]! + send[i - d]! * g;
  }
  const tail = new Float32Array(dry.length);
  for (const ms of [29.7, 37.1, 41.1, 43.7]) {
    const d = Math.round((ms * (0.9 + r() * 0.2)) * sr / 1000);
    const fb = 10 ** ((-3 * d) / (sr * rt60));
    const buf = new Float32Array(d);
    let lp = 0, at = 0;
    for (let i = 0; i < tail.length; i++) {
      const y = buf[at]!;
      lp += 0.45 * (y - lp);   // the walls take the top from each pass
      buf[at] = send[i]! + lp * fb;
      tail[i] = tail[i]! + y * 0.25;
      at = (at + 1) % d;
    }
  }
  for (const [ms, g] of [[5.0, 0.7], [1.7, 0.7]] as const) {
    const d = Math.round(ms * sr / 1000);
    const buf = new Float32Array(d);
    let at = 0;
    for (let i = 0; i < tail.length; i++) {
      const bd = buf[at]!;
      const x = tail[i]!;
      const y = -g * x + bd;
      buf[at] = x + g * y;
      tail[i] = y;
      at = (at + 1) % d;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! + tail[i]! * 1.4;
  return out;
}

/** A peaking or shelving biquad in place (RBJ): `kind` 'peak' at `hz` with `q`, or 'low' a low shelf, `db` its gain. */
function eq(x: Float32Array, sr: number, kind: 'peak' | 'low', hz: number, db: number, q = 0.8): void {
  const A = 10 ** (db / 40), w = (2 * Math.PI * hz) / sr, cw = Math.cos(w), sw = Math.sin(w);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (kind === 'peak') {
    const al = sw / (2 * q);
    b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
  } else {
    const al = (sw / 2) * Math.SQRT2, rA = 2 * Math.sqrt(A) * al;
    b0 = A * (A + 1 - (A - 1) * cw + rA); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - rA);
    a0 = A + 1 + (A - 1) * cw + rA; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - rA;
  }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const v = x[n]!;
    const y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[n] = y;
  }
}
/**
 * The desk the break was recorded through: the recorded funk kits measure more body and
 * crack between 1 and 3 kHz than the modelled kit's close sound, less at 500 Hz and 4 kHz, and a
 * little less weight under 200 Hz (twelve takes, octave bands against the whole: docs/generated-music.md).
 */
const DESK: ReadonlyArray<readonly ['peak' | 'low', number, number, number]> = [['peak', 260, -3, 1], ['peak', 500, -3, 1], ['peak', 1400, 6, 0.7], ['peak', 2600, 2, 1], ['peak', 4300, -6, 1.1], ['low', 280, -3.5, 0.7]];

/** The drum bus compressor: a smooth level follower and a gentle ratio, so the room and the ghosts come up between the hits. */
function compress(x: Float32Array, sr: number, thresholdDb: number, ratio: number): void {
  const att = Math.exp(-1 / (0.004 * sr)), rel = Math.exp(-1 / (0.12 * sr));
  let env = 0;
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const th = peak * 10 ** (thresholdDb / 20);
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]!);
    env = a > env ? att * env + (1 - att) * a : rel * env + (1 - rel) * a;
    if (env > th) x[i] = x[i]! * (th * (env / th) ** (1 / ratio)) / env;
  }
}

/**
 * Records a tune's break a step at a time: each step() renders the next piece of the kit or
 * does the next stage of the recording (the take mixed, the room, the record, the sampler),
 * a few milliseconds to a few tens each, and finish() does whatever is left and returns the
 * recording at `outRate`, mono, at the tune's tempo. However the work is spread, the
 * recording is the same.
 */
export class BreakRecorder {
  private readonly pieces = new Map<string, Float32Array>();
  private readonly todo: Array<() => void> = [];
  private kitMix: Float32Array | null = null;
  private result: Float32Array | null = null;
  readonly take: BreakTake;
  readonly style: BreakStyle;
  readonly kit: BreakKit;
  readonly tuneBpm: number;
  readonly outRate: number;
  readonly seed: number;
  constructor(take: BreakTake, style: BreakStyle, kit: BreakKit, tuneBpm: number, outRate: number, seed: number) {
    this.take = take; this.style = style; this.kit = kit; this.tuneBpm = tuneBpm; this.outRate = outRate; this.seed = seed;
    const s = SAMPLERS[style];
    for (const p of PIECES) for (let n = 0; n < p.takes; n++) this.todo.push(() => { this.pieces.set(pieceKey(p, n), renderPiece(p, n, kit, s, s.rate, seed)); });
    this.todo.push(() => this.mix(), () => this.addRoom(), () => this.desk(), () => this.record(), () => this.play());
  }
  /** Whether the recording is made. */
  get done(): boolean { return this.result !== null; }
  /** Do the next step; false once the recording is made. */
  step(): boolean {
    this.todo.shift()?.();
    return this.todo.length > 0;
  }
  /** The recording: mono, at `outRate`, the whole take (64 slices) at the tune's tempo with its tail. */
  finish(): Float32Array {
    while (this.step()) { /* the rest of the steps */ }
    return this.result!;
  }

  /** The take, stroke by stroke, at the sampler's rate. A closed hat chokes an open one still ringing; the wires answer the kick. */
  private mix(): void {
    const sr = SAMPLERS[this.style].rate;
    const spb = 60 / this.take.bpm;
    const r = mulberry32((this.seed ^ 0x40c0de) >>> 0);
    const len = Math.ceil(((SLICES / 4) * spb + TAIL) * sr);
    const kit = new Float32Array(len);
    const timeOf = (h: { step: number; late: number }): number => Math.round((h.step / 4 + h.late) * spb * sr);
    const hits = [...this.take.hits].sort((a, b) => timeOf(a) - timeOf(b));
    const fade = Math.round(0.008 * sr);
    for (const h of hits) {
      const p = pieceFor(h.drum, h.vel);
      if (!p) continue;
      const buf = this.pieces.get(pieceKey(p, Math.floor(r() * p.takes)))!;
      const at = timeOf(h);
      const level = LEVEL[p.drum] * strokeLevel(h.vel) * (0.94 + r() * 0.12);
      // An open hat rings until the next closed hat shuts the plates.
      const shut = h.drum === 'open' ? hits.find(x => (x.drum === 'hat' || x.drum === 'hatSoft') && timeOf(x) > at) : undefined;
      const end = Math.min(buf.length, len - at, shut ? timeOf(shut) - at + fade : Infinity);
      const shutAt = shut ? timeOf(shut) - at : Infinity;
      for (let i = Math.max(0, -at); i < end; i++) kit[at + i] = kit[at + i]! + buf[i]! * level * (i < shutAt ? 1 : 1 - (i - shutAt) / fade);
      if (h.drum === 'kick') K.noiseBand(kit, sr, r, 5200, 0.7, 0.018 * h.vel * this.kit.wires, 0.004, 0.05, Math.max(0, at));
    }
    this.kitMix = kit;
    this.pieces.clear();
  }
  /** The room microphones. */
  private addRoom(): void {
    const s = SAMPLERS[this.style];
    const kit = this.kitMix!;
    const wet = room(kit, s.rate, s.rt60, mulberry32((this.seed ^ 0x700f) >>> 0));
    for (let i = 0; i < kit.length; i++) kit[i] = kit[i]! + wet[i]! * s.room;
  }
  /** The desk's EQ, and the bus compressor over the kit and the room together. */
  private desk(): void {
    const s = SAMPLERS[this.style];
    const kit = this.kitMix!;
    for (const [kind, hz, db, q] of DESK) eq(kit, s.rate, kind, hz, db, q);
    compress(kit, s.rate, -14, 2.5);
  }
  /** The record (its dark top, its rumble filtered out, a few clicks of dust) sampled in hot, softly clipping, to the sampler's bits. */
  private record(): void {
    const s = SAMPLERS[this.style];
    const sr = s.rate;
    const kit = this.kitMix!;
    const r = mulberry32((this.seed ^ 0xd057) >>> 0);
    lowpass1(kit, sr, s.dark);
    highpass1(kit, sr, 32);
    let peak = 0;
    for (const v of kit) peak = Math.max(peak, Math.abs(v));
    const clicks = Math.round((s.dust * kit.length) / sr);
    for (let c = 0; c < clicks; c++) {
      const i = Math.floor(r() * (kit.length - 64));
      const a = peak * (0.01 + 0.05 * r() ** 3) * (r() < 0.5 ? -1 : 1);
      const w = (2 * Math.PI * (1500 + r() * 4000)) / sr;
      for (let n = 0; n < 48; n++) kit[i + n] = kit[i + n]! + a * Math.exp(-n / 6) * Math.sin(w * n);
    }
    // The record's surface under the break, a soft pinkish noise from the stylus in the groove.
    const floor = peak * 10 ** (-s.surface / 20);
    let p0 = 0, p1 = 0;
    for (let i = 0; i < kit.length; i++) {
      const w = r() * 2 - 1;
      p0 = 0.997 * p0 + w * 0.05; p1 = 0.96 * p1 + w * 0.3;
      kit[i] = kit[i]! + (p0 + p1 + w * 0.15) * floor;
    }
    const steps = 2 ** (s.bits - 1);
    const gain = s.hot / Math.max(1e-6, peak);
    for (let i = 0; i < kit.length; i++) {
      const v = kit[i]! * gain;
      const c = v > 0.9 || v < -0.9 ? Math.sign(v) * (0.9 + 0.1 * Math.tanh((Math.abs(v) - 0.9) / 0.1)) : v;
      kit[i] = Math.round(c * steps) / steps;
    }
  }
  /** Played back at the tune's tempo: faster (or slower) than the drummer, its pitch with it, through the sampler's output filter. */
  private play(): void {
    const s = SAMPLERS[this.style];
    const kit = this.kitMix!;
    const ratio = this.tuneBpm / this.take.bpm;
    const outLen = Math.ceil((kit.length / s.rate / ratio) * this.outRate);
    const out = new Float32Array(outLen);
    const stepIn = (ratio * s.rate) / this.outRate;
    for (let n = 0; n < outLen; n++) {
      const pos = n * stepIn;
      const i = Math.floor(pos);
      out[n] = s.hold ? kit[i] ?? 0 : (kit[i] ?? 0) + ((kit[i + 1] ?? 0) - (kit[i] ?? 0)) * (pos - i);
    }
    // The sampler's output filter: steep, as its anti-imaging filter was, a notch just above its edge.
    lowpass4(out, this.outRate, s.out);
    if (s.hold) { lowpass4(out, this.outRate, s.out * 1.04); notch(out, this.outRate, s.out * 1.12); }
    // The producer's EQ on the sampled break.
    if (s.presence) eq(out, this.outRate, 'peak', 3200, s.presence, 0.9);
    if (s.mud) eq(out, this.outRate, 'peak', 550, s.mud, 1.1);
    let top = 0;
    for (const v of out) top = Math.max(top, Math.abs(v));
    if (top > 0) for (let i = 0; i < outLen; i++) out[i] = (out[i]! / top) * 0.9;
    this.result = out;
    this.kitMix = null;
  }
}

/** Where slice `slice` starts in the recording (s), at the tune's tempo: its sixteenth plus the drummer's push or drag. */
export function sliceStart(take: BreakTake, slice: number, tuneBpm: number): number {
  return Math.max(0, (slice / 4 + (take.starts[slice] ?? 0)) * (60 / tuneBpm));
}

/**
 * A slice held by a sampler's time-stretch: `material` seconds of the recording from `from`
 * spread over `seconds`, as short grains (`grain` s) overlapping by half, each read a little
 * further on, so the pitch holds while the time stretches. The grains repeating at their own
 * rate are the stretch's buzz, the sound of a held slice on the samplers of the time.
 */
export function stretchSlice(rec: Float32Array, sr: number, from: number, material: number, seconds: number, grain = 0.028): Float32Array {
  const n = Math.max(1, Math.round(seconds * sr));
  const g = Math.max(16, Math.round(grain * sr));
  const hop = g >> 1;
  const start = Math.round(from * sr);
  const span = Math.max(1, Math.round(material * sr) - g);
  const out = new Float32Array(n + g);
  for (let at = 0; at < n; at += hop) {
    const src = start + Math.round((at / n) * span);
    for (let i = 0; i < g; i++) out[at + i] = out[at + i]! + (rec[src + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / g));
  }
  return out.subarray(0, n);
}
