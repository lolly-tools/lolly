// SPDX-License-Identifier: MPL-2.0
/**
 * Lofi instruments: the Web Audio voices that play engine/src/lofi-compose.ts's notes.
 * Every one is synthesised from oscillators, filters and a seeded noise buffer, so the
 * station ships no samples, owes no licence and renders the same bytes offline as live.
 * Each tune's style (LofiStyle) picks one voice of each kind and tunes the drums.
 *
 *   keys   rhodes  a two-operator FM electric piano whose brightness falls as it rings
 *          felt    a soft, muffled upright: a few warm partials and a felt thump
 *          wurli   a reedier FM piano with more bark on the attack
 *          pluck   a soft pluck, half guitar and half koto: a filter that closes fast
 *   lead   vibes, flute (with breath), soft (a filtered saw, a little like muted brass),
 *          kalimba (a bright inharmonic tine), chip (a soft chiptune square, for Lolly Sings)
 *   bass   round (sine and triangle), upright (a darker pluck with a thump), synth
 *          (a filtered saw over a sine)
 *   drums  kick, snare, brush, clap, rim, hat and shaker, tuned by the style
 *
 * Each voice schedules its own nodes at `t` on the context it is given and lets them
 * end; nothing is kept. Levels sit low, and lofi-station.ts evens the variants out.
 */
import type { LofiStyle } from '../../../../engine/src/lofi-compose.ts';

export interface VoiceKit {
  ctx: BaseAudioContext;
  /** Two seconds of seeded white noise, shared by every noisy voice. */
  noise: AudioBuffer;
  /** Seeded 0..1, for the small detunes and noise offsets that keep repeats alive. */
  rng: () => number;
}

const EPS = 0.0001;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

function noiseAt(k: VoiceKit, t: number, dur: number): AudioBufferSourceNode {
  const src = k.ctx.createBufferSource();
  src.buffer = k.noise;
  src.loop = true;
  src.start(t, k.rng() * 1.5);
  src.stop(t + dur + 0.02);
  return src;
}

function osc(k: VoiceKit, type: OscillatorType, f: number, t: number, end: number): OscillatorNode {
  const o = k.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(end);
  return o;
}

/**
 * A held note's level: a strike to `peak`, a fall to `body` of it, then (for a long
 * note) a slow fade further, as a struck string or tine does, and a release at `dur`.
 */
function struck(g: AudioParam, t: number, dur: number, peak: number, attack: number, fall: number, body: number, release: number): void {
  g.setValueAtTime(EPS, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(peak * body, t + Math.max(attack + 0.005, Math.min(fall, dur * 0.9)));
  if (dur > fall + 0.2) g.setTargetAtTime(peak * body * 0.25, t + fall + 0.05, 2.2);
  g.setTargetAtTime(EPS, t + dur, release);
}

// ── keys ──────────────────────────────────────────────────────────────────────

export function keys(style: LofiStyle['keys'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  if (style === 'felt') felt(k, out, t, midi, vel, dur);
  else if (style === 'pluck') pluck(k, out, t, midi, vel, dur);
  else fmPiano(k, out, t, midi, vel, dur, style === 'wurli');
}

/** Rhodes or Wurlitzer: FM, bright on the strike and mellowing as it rings. */
function fmPiano(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, wurli: boolean): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.5;
  const car = osc(k, 'sine', f, t, end);
  car.detune.setValueAtTime((k.rng() - 0.5) * 8, t);
  const mod = osc(k, 'sine', f, t, end);
  const index = ctx.createGain();   // FM depth in Hz
  index.gain.setValueAtTime(f * (wurli ? 1.2 + vel * 1.8 : 0.6 + vel * 1.2), t);
  index.gain.exponentialRampToValueAtTime(f * (wurli ? 0.35 : 0.18), t + (wurli ? 0.35 : 0.7));
  mod.connect(index).connect(car.frequency);
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.16 * vel, 0.004, wurli ? 0.6 : 1.2, wurli ? 0.3 : 0.38, 0.12);
  car.connect(amp).connect(out);
  // The tine: a quiet high partial, gone in a moment.
  const tine = osc(k, 'sine', f * (wurli ? 3.01 : 7.1), t, t + 0.14);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(EPS, t);
  tg.gain.exponentialRampToValueAtTime((wurli ? 0.02 : 0.012) * vel, t + 0.002);
  tg.gain.exponentialRampToValueAtTime(EPS, t + 0.12);
  tine.connect(tg).connect(out);
}

/** Felt piano: warm partials through a low filter, a soft hammer thump, a long fade. */
function felt(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(3200, f * 5), t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(1600, f * 2.5), t + 0.8);
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.15 * vel, 0.008, 1.5, 0.42, 0.25);
  lp.connect(amp).connect(out);
  const det = (k.rng() - 0.5) * 6;
  for (const [ratio, level] of [[1, 1], [2.003, 0.38], [3.01, 0.14], [4.02, 0.05]] as const) {
    const o = osc(k, ratio === 1 ? 'triangle' : 'sine', f * ratio, t, end);
    o.detune.setValueAtTime(det, t);
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
  const thump = ctx.createBiquadFilter();
  thump.type = 'lowpass';
  thump.frequency.value = 500;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.05 * vel, t);
  tg.gain.exponentialRampToValueAtTime(EPS, t + 0.04);
  noiseAt(k, t, 0.05).connect(thump).connect(tg).connect(out);
}

/** A soft pluck: a saw and a triangle through a filter that snaps shut. */
function pluck(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const ring = Math.min(dur, 1.6);
  const end = t + ring + 0.4;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(Math.min(6000, f * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.4), t + 0.22);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.04 * vel, t + Math.max(0.01, Math.min(0.5, ring * 0.6)));
  amp.gain.setTargetAtTime(EPS, t + ring * 0.7, 0.25);
  lp.connect(amp).connect(out);
  for (const [type, cents, level] of [['sawtooth', -4, 0.5], ['triangle', 4, 0.8]] as const) {
    const o = osc(k, type, f, t, end);
    o.detune.setValueAtTime(cents, t);
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
}

// ── lead ──────────────────────────────────────────────────────────────────────

export function lead(style: LofiStyle['lead'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  if (style === 'flute') flute(k, out, t, midi, vel, dur);
  else if (style === 'soft') softLead(k, out, t, midi, vel, dur);
  else if (style === 'kalimba') kalimba(k, out, t, midi, vel);
  else if (style === 'vibes') vibes(k, out, t, midi, vel, dur);
  else if (style === 'chip') chip(k, out, t, midi, vel, dur);
}

/**
 * Chip: a soft chiptune lead for Lolly Sings. A square wave, rounded by a low-pass a few
 * harmonics up, that blips down into its pitch and gets a light vibrato as it holds -
 * the sound of an old console singing, not buzzing.
 */
function chip(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.2;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(9000, f * 5), t);
  lp.Q.value = 0.6;
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.06 * vel, 0.004, 0.35, 0.6, 0.06);
  lp.connect(amp).connect(out);
  const o = osc(k, 'square', f * 1.06, t, end);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.025);   // the blip down into pitch
  vibrato(k, o.detune, t, end, 5.8, 12, 0.3);
  o.connect(lp);
}

/** A vibrato (in cents) that eases in after the attack. */
function vibrato(k: VoiceKit, target: AudioParam, t: number, end: number, rate: number, cents: number, delay: number): void {
  const lfo = osc(k, 'sine', rate, t, end);
  const depth = k.ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(cents, t + delay);
  lfo.connect(depth).connect(target);
}

function vibes(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.5;
  const o = osc(k, 'sine', f, t, end);
  vibrato(k, o.detune, t, end, 5.1, 7, 0.35);
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.11 * vel, 0.012, 0.9, 0.45, 0.15);
  o.connect(amp).connect(out);
  const shimmer = osc(k, 'sine', f * 4, t, t + 0.32);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(EPS, t);
  sg.gain.exponentialRampToValueAtTime(0.02 * vel, t + 0.004);
  sg.gain.exponentialRampToValueAtTime(EPS, t + 0.3);
  shimmer.connect(sg).connect(out);
}

/** A flute: a near-sine that breathes in, with a little air in the tone. */
function flute(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.3;
  const amp = ctx.createGain();
  const peak = 0.085 * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.07);
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.08, dur), 0.09);
  amp.connect(out);
  const o = osc(k, 'sine', f, t, end);
  vibrato(k, o.detune, t, end, 4.8, 9, 0.3);
  o.connect(amp);
  const h2 = osc(k, 'sine', f * 2, t, end);
  const hg = ctx.createGain();
  hg.gain.value = 0.12;
  h2.connect(hg).connect(amp);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(9000, f * 2);
  bp.Q.value = 2;
  const breath = ctx.createGain();
  breath.gain.value = 0.35;
  noiseAt(k, t, dur + 0.3).connect(bp).connect(breath).connect(amp);
}

/** A soft lead: a filtered saw that swells in, a little like a muted horn. */
function softLead(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.3;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(f * 1.2, t);
  lp.frequency.exponentialRampToValueAtTime(f * 2.8, t + 0.08);
  lp.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.5);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.045);
  amp.gain.setTargetAtTime(EPS, t + Math.max(0.06, dur), 0.08);
  lp.connect(amp).connect(out);
  const o = osc(k, 'sawtooth', f, t, end);
  vibrato(k, o.detune, t, end, 5.4, 8, 0.25);
  o.connect(lp);
}

/** Kalimba: a bright tine with an inharmonic overtone that dies fast. */
function kalimba(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  for (const [ratio, level, decay] of [[1, 0.13, 1.1], [5.4, 0.04, 0.09], [2.01, 0.02, 0.3]] as const) {
    const pf = f * ratio;
    if (pf > 12000) continue;
    const o = osc(k, 'sine', pf, t, t + decay + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(level * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(EPS, t + decay);
    o.connect(g).connect(out);
  }
}

// ── bass ──────────────────────────────────────────────────────────────────────

export function bass(style: LofiStyle['bass'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.3;
  const amp = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.connect(amp).connect(out);
  if (style === 'upright') {
    struck(amp.gain, t, dur, 0.38 * vel, 0.006, 0.45, 0.35, 0.05);
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(330, t + 0.12);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.12 * vel, t);
    tg.gain.exponentialRampToValueAtTime(EPS, t + 0.03);
    const thump = ctx.createBiquadFilter();
    thump.type = 'lowpass';
    thump.frequency.value = 300;
    noiseAt(k, t, 0.04).connect(thump).connect(tg).connect(out);
  } else if (style === 'synth') {
    struck(amp.gain, t, dur, 0.24 * vel, 0.01, 0.5, 0.6, 0.06);
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(950, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.3);
  } else {
    struck(amp.gain, t, dur, 0.34 * vel, 0.008, 0.5, 0.55, 0.06);
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + 0.25);
  }
  const layers: ReadonlyArray<readonly [OscillatorType, number]> = style === 'synth'
    ? [['sawtooth', 0.6], ['sine', 1]]
    : style === 'upright' ? [['triangle', 1], ['sine', 0.6]] : [['sine', 1], ['triangle', 0.35]];
  for (const [type, level] of layers) {
    const o = osc(k, type, f * 1.015, t, end);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);   // the pluck settles into pitch
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
  }
}

// ── drums ─────────────────────────────────────────────────────────────────────

export function kick(k: VoiceKit, out: AudioNode, t: number, vel: number, hz: number, len: number): void {
  const { ctx } = k;
  const o = osc(k, 'sine', hz * 2.9, t, t + len + 0.05);
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.07);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.003);
  amp.gain.exponentialRampToValueAtTime(EPS, t + len);
  o.connect(amp).connect(out);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.18 * vel, t);
  cg.gain.exponentialRampToValueAtTime(EPS, t + 0.012);
  noiseAt(k, t, 0.015).connect(lp).connect(cg).connect(out);
}

/**
 * The backbeat, by the style's kit: a snare, a brush or a clap, around `tone` Hz. Each
 * starts with a HIT: a few milliseconds of bright noise (the crack of the stick, the
 * slap of the hands, the brush landing) over its body, so it reads as sharp and loud
 * through the lofi muffle and gives a visualizer's mid and treble bands a clear jump on
 * every backbeat.
 */
export function snare(style: LofiStyle['snare'], k: VoiceKit, out: AudioNode, t: number, vel: number, tone: number): void {
  const { ctx } = k;
  const brush = style === 'brush';
  // The hit: bright noise, full level at once, gone in 20 to 30 ms.
  crack(k, out, t, vel * (brush ? 0.32 : style === 'clap' ? 0.5 : 0.62), brush ? 2600 : 3800, brush ? 0.02 : 0.03);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = brush ? tone * 1.3 : style === 'clap' ? tone * 0.7 : tone;
  bp.Q.value = brush ? 0.6 : style === 'clap' ? 1.4 : 0.9;
  const g = ctx.createGain();
  if (style === 'clap') {
    // Three hands, a few milliseconds apart, then the room.
    g.gain.setValueAtTime(EPS, t);
    for (const [d, a] of [[0, 0.42], [0.011, 0.36], [0.023, 0.48]] as const) {
      g.gain.setValueAtTime(a * vel, t + d);
      g.gain.exponentialRampToValueAtTime(0.04 * vel, t + d + 0.009);
    }
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.2);
    noiseAt(k, t, 0.22).connect(bp).connect(g).connect(out);
    return;
  }
  // The snap (the wires): a band of noise around `tone`.
  const decay = brush ? 0.26 : 0.18;
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime((brush ? 0.24 : 0.44) * vel, t + (brush ? 0.012 : 0.0015));
  g.gain.exponentialRampToValueAtTime(EPS, t + decay);
  noiseAt(k, t, decay).connect(bp).connect(g).connect(out);
  if (brush) return;
  // The body (the drum): a short tone that drops, and a ring at about 330 Hz.
  for (const [type, from, to, level, len] of [['triangle', 205, 165, 0.3, 0.1], ['sine', 330, 290, 0.1, 0.07]] as const) {
    const body = osc(k, type, from, t, t + len + 0.01);
    body.frequency.exponentialRampToValueAtTime(to, t + len * 0.8);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(EPS, t);
    bg.gain.exponentialRampToValueAtTime(level * vel, t + 0.0015);
    bg.gain.exponentialRampToValueAtTime(EPS, t + len);
    body.connect(bg).connect(out);
  }
}

/** A drum's hit: high-passed noise at full level at once, falling away in `len` seconds. */
function crack(k: VoiceKit, out: AudioNode, t: number, peak: number, from: number, len: number): void {
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = from;
  hp.Q.value = 0.7;
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(EPS, t + len);
  noiseAt(k, t, len).connect(hp).connect(g).connect(out);
}

export function rim(k: VoiceKit, out: AudioNode, t: number, vel: number): void {
  const { ctx } = k;
  crack(k, out, t, vel * 0.3, 4500, 0.012);
  const o = osc(k, 'sine', 1150, t, t + 0.04);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.14 * vel, t + 0.001);
  g.gain.exponentialRampToValueAtTime(EPS, t + 0.035);
  o.connect(g).connect(out);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 3;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.3 * vel, t);
  ng.gain.exponentialRampToValueAtTime(EPS, t + 0.03);
  noiseAt(k, t, 0.03).connect(bp).connect(ng).connect(out);
}

/** Hats by the style's kit: a closed or open hat around `tone` Hz, or a shaker. */
export function hat(style: LofiStyle['hats'], k: VoiceKit, out: AudioNode, t: number, vel: number, tone: number, open = false): void {
  const { ctx } = k;
  const shaker = style === 'shaker';
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = shaker ? 3500 : tone * 0.75;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = shaker ? 5200 : tone * 1.2;
  bp.Q.value = shaker ? 1.1 : 0.7;
  const g = ctx.createGain();
  const decay = open ? 0.24 : shaker ? 0.07 : 0.035;
  if (shaker) {   // a shaker swishes in rather than striking
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.018);
  } else {
    g.gain.setValueAtTime(0.16 * vel, t);
  }
  g.gain.exponentialRampToValueAtTime(EPS, t + decay);
  noiseAt(k, t, decay).connect(hp).connect(bp).connect(g).connect(out);
}
