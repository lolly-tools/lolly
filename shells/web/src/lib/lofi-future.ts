// SPDX-License-Identifier: MPL-2.0
/**
 * Future-bass chords (the keys `future`, Sherbert's), played as a producer layers them:
 *
 *   the stack   a dense supersaw a note (seven saws live, eleven in a render) with a thinner
 *               stack an octave up, spread across the speakers, mono in the low mids, with a
 *               little hash on top (lib/lofi-future-synth.ts builds it, once a pitch)
 *   the pluck   a short, bright strike on each chord's attack, as wide as the stack
 *   the vowel   the chord through three formant filters, an "aah", which the wub swings into
 *   the body    a dark sub-octave saw under each chord's lowest note, mono, thinned under the 808
 *
 * Every future chord in a station goes through one chain, as a producer's chord bus does:
 * a high-pass that leaves the low end to the 808; a three-band compressor run in parallel
 * with the dry chord, the way OTT is used, so the hash and the tails between the hits come up
 * and the hits stay solid; a soft saturation; a chorus; a short room; and a pump the kicks
 * drive, which ducks the room with the chord (a sidechained reverb). The chain is built once,
 * on the first chord, so a chord itself is only a few buffers and gains.
 *
 * A chord's movement comes from the composer (engine/src/lofi-future.ts): a wub swinging the
 * level, the brightness and the vowel together at a synced rate (triplets and dotted values
 * too), a gate chopping a held chord in a rhythm, a bend up a whole tone into the pitch, a
 * dive at a phrase's end, a swell rising out of nothing into the next hit. A held chord gets
 * a slow vibrato that fades in.
 *
 * Cost. The old voice ran four saw oscillators, a pulse and three or four filters for every
 * note, which made a drop the costliest sound in the station. Here a note is one looping
 * buffer and a pluck, the chord's filters are shared, and the buffers are built once a pitch
 * (a stack for every third semitone, played at the pitch by its playback rate; the detunes
 * are in cents, so they survive the change). Live playing builds the stacks for a tune while
 * its intro plays (warm) and paces any it still lacks, playing the nearest stack it has
 * meanwhile, as the drum kits pace their takes; a render builds every one it needs.
 */
import type { KeysArt, VoiceKit } from './lofi-voices.ts';
import { bodyTone, pluckTone, sawStack, HQ_STACK, LIVE_STACK, PLUCK_SECONDS } from './lofi-future-synth.ts';
import { gateOpens } from '../../../../engine/src/lofi-future.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';

const EPS = 0.0001;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** The stacks are built for every STEP semitones and loop every LOOP seconds. */
const STEP = 3;
const LOOP = 1.5;
/** The least music (s) between two stacks built while playing live. */
const RENDER_GAP = 0.12;
/** The furthest (semitones) a stack is played from its own pitch while a closer one waits to be built. */
const BORROW = 7;

interface Layer { buf: AudioBuffer; centre: number }
interface Bank { stacks: Map<number, Layer>; plucks: Map<number, AudioBuffer>; bodies: Map<number, Layer>; nextRender: number; warming: boolean }
const BANKS = new WeakMap<BaseAudioContext, Bank>();

function bankOf(ctx: BaseAudioContext): Bank {
  let bank = BANKS.get(ctx);
  if (!bank) { bank = { stacks: new Map(), plucks: new Map(), bodies: new Map(), nextRender: -Infinity, warming: false }; BANKS.set(ctx, bank); }
  return bank;
}

const bucketOf = (midi: number): number => Math.round(midi / STEP) * STEP;
/** Each pitch's buffers come from its own seed, so they are the same whenever and in whatever order they are built. */
const seedOf = (bucket: number, layer: number, hq: boolean): number => (0xf0b5 ^ Math.imul(bucket + 1, 0x9e3779b1) ^ (layer << 8) ^ (hq ? 0x40000 : 0)) >>> 0;

function stereo(ctx: BaseAudioContext, l: Float32Array, r: Float32Array): AudioBuffer {
  const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
  buf.getChannelData(0).set(l);
  buf.getChannelData(1).set(r);
  return buf;
}

function mono(ctx: BaseAudioContext, d: Float32Array): AudioBuffer {
  const buf = ctx.createBuffer(1, d.length, ctx.sampleRate);
  buf.getChannelData(0).set(d);
  return buf;
}

function buildStack(k: VoiceKit, bank: Bank, bucket: number): Layer {
  const s = sawStack(k.hq ? HQ_STACK : LIVE_STACK, k.ctx.sampleRate, mtof(bucket), LOOP, mulberry32(seedOf(bucket, 0, !!k.hq)));
  const layer = { buf: stereo(k.ctx, s.l, s.r), centre: s.centre };
  bank.stacks.set(bucket, layer);
  return layer;
}

/** The built buffer whose pitch is nearest `bucket`, within BORROW semitones. */
function nearest<T>(from: Map<number, T>, bucket: number): T | undefined {
  let near: T | undefined;
  let best = BORROW + 1;
  for (const [b, v] of from) if (Math.abs(b - bucket) < best) { best = Math.abs(b - bucket); near = v; }
  return near;
}

/** Playing in real time: not a render worked out ahead, and not any offline context. */
function live(k: VoiceKit): boolean {
  return !k.hq && !(typeof OfflineAudioContext !== 'undefined' && k.ctx instanceof OfflineAudioContext);
}

/** A note's stack: its own pitch's, or (live, while the last one built is fresh) the nearest built. */
function stackFor(k: VoiceKit, midi: number, t: number): Layer {
  const bank = bankOf(k.ctx);
  const bucket = bucketOf(midi);
  const have = bank.stacks.get(bucket);
  if (have) return have;
  if (live(k) && t < bank.nextRender) {
    const near = nearest(bank.stacks, midi);
    if (near) return near;
  }
  bank.nextRender = t + RENDER_GAP;
  return buildStack(k, bank, bucket);
}

function pluckFor(k: VoiceKit, bucket: number, t: number): AudioBuffer {
  const bank = bankOf(k.ctx);
  let buf = bank.plucks.get(bucket);
  // Live, while a stack is being built for this chord, a pluck a step or two away will do.
  if (!buf && live(k) && t < bank.nextRender) buf = nearest(bank.plucks, bucket);
  if (!buf) { const p = pluckTone(k.ctx.sampleRate, mtof(bucket), mulberry32(seedOf(bucket, 1, false))); buf = stereo(k.ctx, p.l, p.r); bank.plucks.set(bucket, buf); }
  return buf;
}

function bodyFor(k: VoiceKit, bucket: number, t: number): Layer {
  const bank = bankOf(k.ctx);
  let layer = bank.bodies.get(bucket);
  if (!layer && live(k) && t < bank.nextRender) layer = nearest(bank.bodies, bucket);
  if (!layer) {
    const b = bodyTone(k.ctx.sampleRate, mtof(bucket), LOOP, mulberry32(seedOf(bucket, 2, false)));
    layer = { buf: mono(k.ctx, b.data), centre: b.centre };
    bank.bodies.set(bucket, layer);
  }
  return layer;
}

/** The chords' range: the keys' voicings (MIDI 52 to 76), with a little room either side. */
const WARM_FROM = 48, WARM_TO = 81;
/**
 * Build a tune's stacks before its chords need them, one every few frames, while its intro
 * plays (live playing only: a render builds what it needs as it goes). Does nothing outside a
 * page, or while a warm-up is already running.
 */
export function warm(k: VoiceKit): void {
  if (!live(k) || typeof document === 'undefined' || typeof setTimeout !== 'function') return;
  const bank = bankOf(k.ctx);
  if (bank.warming) return;
  const todo: number[] = [];
  for (let b = bucketOf(WARM_FROM); b <= WARM_TO; b += STEP) if (!bank.stacks.has(b)) todo.push(b);
  if (!todo.length) return;
  bank.warming = true;
  const next = (): void => {
    const b = todo.shift();
    if (b === undefined) { bank.warming = false; return; }
    if (!bank.stacks.has(b)) { buildStack(k, bank, b); pluckFor(k, b, -Infinity); bodyFor(k, b, -Infinity); }
    setTimeout(next, 40);
  };
  setTimeout(next, 40);
}

// ── the chord bus ─────────────────────────────────────────────────────────────

/** The chain every future chord in a station goes through, made on its first chord. */
interface Bus {
  /** The chords, their wub's muffled side, their vowel and their body. */
  main: GainNode;
  muffle: GainNode;
  vowel: GainNode;
  body: GainNode;
  /** The pump the kicks drive. */
  pump: GainNode;
  /** The chord being built, while its notes arrive one by one. */
  last: { key: string; group: Group } | null;
}
const BUSES = new WeakMap<AudioNode, Bus>();

function biquad(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q = Math.SQRT1_2, gain = 0): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.gain.value = gain;
  return b;
}

function gainNode(ctx: BaseAudioContext, v: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

/** Where the three-band compressor splits (Hz), as OTT splits. */
const SPLIT_LOW = 240, SPLIT_HIGH = 2600;
/** The compressors: [threshold dB, ratio, attack s, release s, level after]. */
const BANDS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [-34, 4, 0.006, 0.14, 0.7],
  [-38, 6, 0.003, 0.09, 1],
  [-40, 6, 0.002, 0.07, 1.3],
];
/** How much of the compressed chord is mixed with the dry (OTT's depth), and the dry's level. */
const OTT_WET = 0.62, OTT_DRY = 0.62;
/** The vowel: an "aah" sung by the chord, [Hz, Q, level]. */
const VOWEL: ReadonlyArray<readonly [number, number, number]> = [[730, 5, 1], [1090, 6, 0.6], [2440, 8, 0.32]];
/** The whole chain's level into the keys. */
const BUS_LEVEL = 1;

/** A soft clip, the same curve for every station. */
let SOFT: Float32Array<ArrayBuffer> | null = null;
function softCurve(): Float32Array<ArrayBuffer> {
  if (SOFT) return SOFT;
  const n = 2048;
  const c = new Float32Array(n);
  const drive = 1.6;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / Math.tanh(drive); }
  SOFT = c;
  return c;
}

/** A short, bright room for the chords (s): seeded noise falling away, a little different on each side. */
function roomImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.round(seconds * ctx.sampleRate));
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  const r = mulberry32(0x5ace);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const fall = Math.exp(-1 / (seconds * 0.28 * ctx.sampleRate));
    const rise = ctx.sampleRate * 0.004;
    let lp = 0, level = 1;
    for (let i = 0; i < n; i++) {
      const x = r() * 2 - 1;
      lp += 0.35 * (x - lp);   // a little darker than white
      d[i] = (x - lp * 0.5) * level * Math.min(1, i / rise);
      level *= fall;
    }
  }
  return buf;
}

function busOf(k: VoiceKit, out: AudioNode): Bus {
  const have = BUSES.get(out);
  if (have) return have;
  const { ctx } = k;
  const main = gainNode(ctx, 1), muffle = gainNode(ctx, 1), vowel = gainNode(ctx, 1), body = gainNode(ctx, 1);
  const pre = gainNode(ctx, 1);
  main.connect(pre);
  muffle.connect(biquad(ctx, 'lowpass', 900, 2)).connect(pre);
  for (const [f, q, level] of VOWEL) vowel.connect(biquad(ctx, 'bandpass', f, q)).connect(gainNode(ctx, level)).connect(pre);
  // The 808's room: a high-pass, again after the compressors (whose make-up gain would bring
  // the lows back), and a cut in the low mids, where the chord's fundamentals pile up; and a
  // lift on top where the records' chords shine.
  const air = biquad(ctx, 'highshelf', 7000, Math.SQRT1_2, 7);
  pre.connect(biquad(ctx, 'highpass', 250)).connect(biquad(ctx, 'peaking', 380, 0.8, -5)).connect(biquad(ctx, 'highshelf', 2500, Math.SQRT1_2, 2)).connect(air);
  // OTT: three bands, each compressed hard, mixed back under the dry chord.
  const glue = gainNode(ctx, 1);
  air.connect(gainNode(ctx, OTT_DRY)).connect(glue);
  const bands: AudioNode[] = [
    air.connect(biquad(ctx, 'lowpass', SPLIT_LOW)).connect(biquad(ctx, 'lowpass', SPLIT_LOW)),
    air.connect(biquad(ctx, 'highpass', SPLIT_LOW)).connect(biquad(ctx, 'highpass', SPLIT_LOW)).connect(biquad(ctx, 'lowpass', SPLIT_HIGH)).connect(biquad(ctx, 'lowpass', SPLIT_HIGH)),
    air.connect(biquad(ctx, 'highpass', SPLIT_HIGH)).connect(biquad(ctx, 'highpass', SPLIT_HIGH)),
  ];
  bands.forEach((band, i) => {
    const [threshold, ratio, attack, release, level] = BANDS[i]!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = threshold;
    comp.knee.value = 10;
    comp.ratio.value = ratio;
    comp.attack.value = attack;
    comp.release.value = release;
    band.connect(comp).connect(gainNode(ctx, level * OTT_WET)).connect(glue);
  });
  const shaper = ctx.createWaveShaper();
  shaper.curve = softCurve();
  shaper.oversample = k.hq ? '4x' : '2x';
  const sat = biquad(ctx, 'highpass', 250);
  glue.connect(shaper).connect(sat);
  // A chorus: the chord summed to one channel, then two delays swaying slowly, set apart on
  // either side, so the copies widen the chord rather than fold it in.
  const pump = gainNode(ctx, 1);
  sat.connect(pump);
  const tap = gainNode(ctx, 1);
  tap.channelCount = 1;
  tap.channelCountMode = 'explicit';
  tap.channelInterpretation = 'speakers';
  sat.connect(tap);
  for (const [base, depth, rate, pan] of [[0.011, 0.0017, 0.29, -0.8], [0.0145, 0.0021, 0.41, 0.8]] as const) {
    const d = ctx.createDelay(0.05);
    d.delayTime.value = base;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    lfo.connect(gainNode(ctx, depth)).connect(d.delayTime);
    lfo.start();
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    tap.connect(d).connect(p).connect(gainNode(ctx, 0.22)).connect(pump);
  }
  // The chords' own room, before the pump, so its tail ducks with the chord.
  const room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx, k.hq ? 1.1 : 0.7);
  sat.connect(room).connect(gainNode(ctx, 0.1)).connect(pump);
  // The body skips the high-pass: it is the low mids under the chord, kept dark and mono.
  body.connect(biquad(ctx, 'lowpass', 380, 0.6)).connect(biquad(ctx, 'highpass', 90, 0.6)).connect(pump);
  pump.connect(gainNode(ctx, BUS_LEVEL)).connect(out);
  const bus: Bus = { main, muffle, vowel, body, pump, last: null };
  BUSES.set(out, bus);
  return bus;
}

/** How far the chords dip under a kick, per unit of the style's ducking, on top of the station's duck. */
const PUMP = 0.3;
/**
 * Pump the future chords under a kick at `t` (the station calls this with each kick, as it
 * ducks the music): a fast dip, held for a moment, and a recovery over most of an eighth, the
 * shape a sidechain compressor keyed from the kick gives. Does nothing where no future chord
 * has played.
 */
export function pump(out: AudioNode, t: number, depth: number): void {
  const bus = BUSES.get(out);
  if (!bus) return;
  const g = bus.pump.gain;
  const at = Math.max(0, t - 0.012);
  g.setTargetAtTime(Math.max(0.08, 1 - PUMP * depth), at, 0.004);
  g.setTargetAtTime(1, at + 0.05, 0.075);
}

// ── a chord ───────────────────────────────────────────────────────────────────

/** The notes of one chord share its envelope, its wub and its vibrato. */
interface Group {
  env: GainNode;
  body: GainNode | null;
  vib: GainNode | null;
  pluck: GainNode | null;
  t: number;
  end: number;
}

/** A chord's level (a note's share), its pluck's and its body's. */
const PEAK = 0.105, PLUCK = 0.4, BODY = 0.1;
/** The bend: a whole tone up, most of the way in the first 45 per cent of its time. */
const BEND_CENTS = 200, BEND_TIME = 0.22;
/** The strike filter: wide open on the hit (Hz), settling (Hz, plus more for a harder chord) within STRIKE_TIME (s). */
const STRIKE_OPEN = 18000, STRIKE_SETTLE = 6500, STRIKE_VEL = 5000, STRIKE_TIME = 0.28;
/** How far a render's wub sweeps the strike filter either side of where it settled (Hz). */
const SWEEP_DEPTH = 4500;
/** A held chord's vibrato: cents, rate, and when it has faded in (s). */
const VIB_CENTS = 9, VIB_RATE = 5.2, VIB_IN = 0.8;

/** Write a chord's level onto `g`: its attack, its gate or swell, its dive and its release. */
function shape(g: AudioParam, t: number, dur: number, peak: number, art: KeysArt): void {
  const spb = art.spb ?? 0.42;
  if (art.swell) {
    // Out of nothing into the next hit, then cut, as a reversed chord ends.
    g.setValueAtTime(peak * 0.003, t);
    g.exponentialRampToValueAtTime(peak, t + Math.max(0.02, dur - 0.012));
    g.setTargetAtTime(EPS, t + dur, 0.006);
    return;
  }
  g.setValueAtTime(EPS, t);
  const gate = art.gate ?? 0;
  if (gate > 0) {
    const floor = peak * 0.04;
    g.setValueAtTime(floor, t);
    for (const [b, len] of gateOpens(gate, dur / spb)) {
      g.setTargetAtTime(peak, t + b * spb, 0.0025);
      g.setTargetAtTime(floor, t + (b + len) * spb, 0.006);
    }
  } else {
    g.exponentialRampToValueAtTime(peak, t + 0.005);
    g.setTargetAtTime(peak * 0.78, t + 0.03, 0.3);
  }
  if (art.dive) g.setTargetAtTime(peak * 0.3, t + dur * 0.55, dur * 0.3);
  g.setTargetAtTime(EPS, t + dur, dur < 0.25 ? 0.025 : 0.05);
}

/** Bend, scoop or dive a note's pitch, in cents on its detune. */
function glide(d: AudioParam, t: number, dur: number, art: KeysArt): void {
  if (art.swell) return;
  if (art.bend) {
    d.setValueAtTime(-BEND_CENTS, t);
    d.linearRampToValueAtTime(-BEND_CENTS * 0.2, t + BEND_TIME * 0.45);
    d.linearRampToValueAtTime(0, t + BEND_TIME);
  } else {
    d.setValueAtTime(-18, t);
    d.linearRampToValueAtTime(0, t + 0.025);
  }
  if (art.dive) {
    // A tape stop: the pitch falls an octave over the last of the chord, slowly then fast.
    const from = t + Math.max(BEND_TIME, dur * 0.35);
    d.setValueAtTime(0, from);
    d.linearRampToValueAtTime(-300, from + (t + dur - from) * 0.6);
    d.linearRampToValueAtTime(-1200, t + dur + 0.08);
  }
}

/** A cosine (not a sine), one per context, so a wub starts each chord at the top of its swing. */
const COSINES = new WeakMap<BaseAudioContext, PeriodicWave>();
function cosine(ctx: BaseAudioContext, rate: number, t: number, end: number): OscillatorNode {
  let wave = COSINES.get(ctx);
  if (!wave) { wave = ctx.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0])); COSINES.set(ctx, wave); }
  const o = ctx.createOscillator();
  o.setPeriodicWave(wave);
  o.frequency.setValueAtTime(rate, t);
  o.start(t);
  o.stop(end);
  return o;
}

function newGroup(k: VoiceKit, bus: Bus, t: number, dur: number, vel: number, art: KeysArt): Group {
  const { ctx } = k;
  const end = t + dur + 0.35;
  const env = ctx.createGain();
  const peak = PEAK * vel;
  shape(env.gain, t, dur, peak, art);
  if (art.swell) {
    // A swell opens from dark to bright as it rises, a breath of noise rising alongside.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(13000, t + Math.max(0.02, dur));
    lp.Q.value = 1.2;
    env.connect(lp).connect(bus.main);
    const hiss = ctx.createBufferSource();
    hiss.buffer = k.noise;
    hiss.loop = true;
    hiss.connect(gainNode(ctx, 0.25)).connect(lp);
    hiss.start(t, k.rng() * 1.5);
    hiss.stop(t + dur + 0.05);
    return { env, body: null, vib: null, pluck: null, t, end };
  }
  // The strike: the chord's filter opens wide on the hit and settles, brighter the harder the
  // chord is played (a ramp that ends, so the filter is worked out afresh only while it moves).
  const strike = biquad(ctx, 'lowpass', STRIKE_OPEN, 0.8);
  strike.frequency.setValueAtTime(STRIKE_OPEN, t);
  strike.frequency.exponentialRampToValueAtTime(STRIKE_SETTLE + STRIKE_VEL * vel, t + Math.max(0.03, Math.min(STRIKE_TIME, dur * 0.7)));
  env.connect(strike);
  if (art.rate > 0) {
    // The wub: the chord swings between itself, bright, and a muffled, sung copy, its level
    // dipping between: a crossfade between still filters. A render can afford to sweep the
    // strike filter with it too, as a producer's wub does (a swept filter is worked out every
    // sample, too dear for live playing).
    const lfo = cosine(ctx, art.rate, t, end);
    const bright = gainNode(ctx, 0.55);
    lfo.connect(gainNode(ctx, 0.45)).connect(bright.gain);
    const dark = gainNode(ctx, 0.32);
    lfo.connect(gainNode(ctx, -0.22)).connect(dark.gain);
    const sung = gainNode(ctx, 0.26);
    lfo.connect(gainNode(ctx, -0.2)).connect(sung.gain);
    if (k.hq) lfo.connect(gainNode(ctx, SWEEP_DEPTH)).connect(strike.frequency);
    strike.connect(bright).connect(bus.main);
    strike.connect(dark).connect(bus.muffle);
    strike.connect(sung).connect(bus.vowel);
  } else {
    strike.connect(bus.main);
    strike.connect(gainNode(ctx, 0.1)).connect(bus.vowel);
  }
  // A held chord, neither wubbing nor gated, sways a little once it has settled.
  let vib: GainNode | null = null;
  if (dur >= 1 && art.rate === 0 && !art.gate && !art.dive) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = VIB_RATE;
    lfo.start(t);
    lfo.stop(end);
    vib = ctx.createGain();
    vib.gain.setValueAtTime(0, t);
    vib.gain.setValueAtTime(0, t + 0.3);
    vib.gain.linearRampToValueAtTime(VIB_CENTS, t + VIB_IN);
    lfo.connect(vib);
  }
  const body = ctx.createGain();
  shape(body.gain, t, dur, BODY * peak, art);
  body.connect(bus.body);
  const pluck = gainNode(ctx, PLUCK * PEAK * vel / 0.13);
  pluck.connect(bus.main);
  return { env, body, vib, pluck, t, end };
}

/**
 * One note of a future chord. The notes of a chord (the same start, length and movement on
 * the same output) share one envelope and wub, and the first of them, the lowest, carries the
 * body. Same call as every keys voice's.
 */
export function future(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: KeysArt): void {
  const { ctx } = k;
  const bus = busOf(k, out);
  const key = `${t.toFixed(4)}|${dur.toFixed(4)}|${art.rate}|${art.bend}|${art.dive ?? false}|${art.swell ?? false}|${art.gate ?? 0}`;
  let first = false;
  if (bus.last?.key !== key) { bus.last = { key, group: newGroup(k, bus, t, dur, vel, art) }; first = true; }
  const group = bus.last.group;
  const f = mtof(midi);
  const stack = stackFor(k, midi, t);
  const src = ctx.createBufferSource();
  src.buffer = stack.buf;
  src.loop = true;
  src.playbackRate.value = f / stack.centre;
  glide(src.detune, t, dur, art);
  if (group.vib) group.vib.connect(src.detune);
  src.connect(group.env);
  src.start(t, k.rng() * LOOP * 0.98);
  src.stop(group.end);
  if (group.pluck) {
    const bucket = bucketOf(midi);
    const p = ctx.createBufferSource();
    p.buffer = pluckFor(k, bucket, t);
    p.playbackRate.value = f / mtof(bucket);
    p.connect(group.pluck);
    p.start(t);
    p.stop(t + PLUCK_SECONDS + 0.01);
  }
  if (first && group.body) {
    const bucket = bucketOf(midi);
    const layer = bodyFor(k, bucket, t);
    const b = ctx.createBufferSource();
    b.buffer = layer.buf;
    b.loop = true;
    b.playbackRate.value = f / 2 / layer.centre;
    glide(b.detune, t, dur, art);
    b.connect(group.body);
    b.start(t, k.rng() * LOOP * 0.98);
    b.stop(group.end);
  }
}
