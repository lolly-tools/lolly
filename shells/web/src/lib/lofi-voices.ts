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
 * The dance genres of the Lolly Sings family add their own:
 *   keys   pad (two soft detuned saws) and supersaw (a bright stack of four wide saws)
 *   lead   angel (a saw and an octave sine through two vowel formants, with vibrato)
 *   bass   wobble (a filter swinging at the note's own rate), growl (distorted, with
 *          formant filters moving apart), reese (three detuned saws, slowly moving),
 *          slap (a thumbed or popped string: a bright attack, a resonant pop), screech
 *          (an FM cry), pulse (a console's bass channel) and electro (a driven riff
 *          with a wah); each takes the tune's brightness and drive
 *   lead   pulse (a thin chiptune pulse that blips into its note)
 *   fx     crash (a cymbal with a low boom under a drop), riser (a build's noise sweep)
 *          and coin (a bright two-note square ding)
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
  else if (style === 'pad' || style === 'supersaw') saws(k, out, t, midi, vel, dur, style === 'supersaw');
  else fmPiano(k, out, t, midi, vel, dur, style === 'wurli');
}

/**
 * Saw chords for the dance genres. A pad is two soft saws that swell in; a supersaw is
 * four, spread wider and brighter, that strike at once (the future-bass chord). Both are
 * low-passed so a chord of four stays a wall of sound and not a buzz.
 */
function saws(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, superSaw: boolean): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + (superSaw ? 0.25 : 0.7);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(superSaw ? 5200 : 1800, t);
  lp.frequency.setTargetAtTime(superSaw ? 3200 : 2400, t + 0.05, 0.4);
  lp.Q.value = 0.5;
  const amp = ctx.createGain();
  const peak = (superSaw ? 0.066 : 0.064) * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + (superSaw ? 0.01 : 0.35));
  amp.gain.setTargetAtTime(peak * 0.8, t + 0.4, 0.5);
  amp.gain.setTargetAtTime(EPS, t + dur, superSaw ? 0.06 : 0.25);
  lp.connect(amp).connect(out);
  // Four saws for the supersaw and two for the pad: seven and three were most of a
  // drop's cost, and the spread, not the count, is what makes the chord wide.
  const spread = superSaw ? [-22, -8, 9, 23] : [-8, 8];
  for (const cents of spread) {
    const o = osc(k, 'sawtooth', f, t, end);
    o.detune.value = cents + (k.rng() - 0.5) * 3;
    o.connect(lp);
  }
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
  else if (style === 'angel') angel(k, out, t, midi, vel, dur);
  else if (style === 'pulse') pulseLead(k, out, t, midi, vel, dur);
}

/** Pulse lead: a thin 12.5% pulse that blips up an octave for its first moment, then holds with a little vibrato. */
function pulseLead(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7000;
  const amp = ctx.createGain();
  struck(amp.gain, t, dur, 0.05 * vel, 0.003, 0.25, 0.75, 0.05);
  lp.connect(amp).connect(out);
  const o = pulseOsc(k, 0.125, f * 2, t, end);
  o.frequency.setValueAtTime(f, t + 0.03);
  vibrato(k, o.detune, t, end, 6, 14, 0.25);
  o.connect(lp);
}

/**
 * Angel: the soaring lead of the dance genres, voiceless though vocal. A saw and a sine an
 * octave above pass through two band-pass filters at an open "ah" (about 800 and 1200 Hz),
 * swell in, and gain a slow vibrato as they hold.
 */
function angel(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.5;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.11 * vel, t + 0.06);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.18);
  const mix = ctx.createGain();
  mix.gain.value = 1;
  for (const [hz, q, level] of [[800, 3, 1], [1200, 4, 0.7], [2600, 5, 0.25]] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    mix.connect(bp).connect(g).connect(amp);
  }
  const body = ctx.createGain();
  body.gain.value = 0.35;   // some of the plain tone under the formants, so it keeps its pitch
  mix.connect(body).connect(amp);
  amp.connect(out);
  const saw = osc(k, 'sawtooth', f, t, end);
  const sine = osc(k, 'sine', f * 2, t, end);
  const sg = ctx.createGain();
  sg.gain.value = 0.5;
  saw.connect(mix);
  sine.connect(sg).connect(mix);
  vibrato(k, saw.detune, t, end, 5.2, 16, 0.25);
  vibrato(k, sine.detune, t, end, 5.2, 16, 0.25);
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

/**
 * A bass note. `mod` is the note's movement (LofiNote.mod): for a wobble or a growl the
 * filter's swing in Hz (the station turns cycles a beat into Hz), on a slap bass 1 for a
 * popped note.
 */
export function bass(style: LofiStyle['bass'], k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod = 0, tone: Tone = PLAIN_TONE): void {
  if (style === 'wobble') { wobble(k, out, t, midi, vel, dur, mod, tone); return; }
  if (style === 'growl') { growl(k, out, t, midi, vel, dur, mod, tone); return; }
  if (style === 'reese') { reese(k, out, t, midi, vel, dur, tone); return; }
  if (style === 'slap') { slap(k, out, t, midi, vel, dur, Math.round(mod), tone); return; }
  if (style === 'screech') { screech(k, out, t, midi, vel, dur, mod, tone); return; }
  if (style === 'pulse') { pulseBass(k, out, t, midi, vel, dur, tone); return; }
  if (style === 'electro') { electro(k, out, t, midi, vel, dur, tone); return; }
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

/** A dance tune's tone (LofiStyle.bright and drive): filter brightness and how hard the bass is driven. */
export interface Tone { bright: number; drive: number }
const PLAIN_TONE: Tone = { bright: 1, drive: 1 };

/** A pulse wave of `duty` (0.5 is a square) as a band-limited PeriodicWave, one per context and duty. */
const PULSES = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();
function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  let byDuty = PULSES.get(ctx);
  if (!byDuty) { byDuty = new Map(); PULSES.set(ctx, byDuty); }
  let wave = byDuty.get(duty);
  if (!wave) {
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let h = 1; h < n; h++) real[h] = (2 / (h * Math.PI)) * Math.sin(h * Math.PI * duty);
    wave = ctx.createPeriodicWave(real, imag);
    byDuty.set(duty, wave);
  }
  return wave;
}

/** An oscillator playing a pulse of `duty` from `t` to `end`. */
function pulseOsc(k: VoiceKit, duty: number, f: number, t: number, end: number): OscillatorNode {
  const o = k.ctx.createOscillator();
  o.setPeriodicWave(pulseWave(k.ctx, duty));
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(end);
  return o;
}

/** A soft-clipping curve, for the dance basses' drive. */
const DRIVE = ((): Float32Array => {
  const c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
  return c;
})();

function driven(ctx: BaseAudioContext): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  ws.curve = DRIVE as Float32Array<ArrayBuffer>;
  // No oversampling: the drive only shapes bass, and oversampling every note's clipper
  // was a large share of the dance stations' cost.
  ws.oversample = 'none';
  return ws;
}

/** A gain of `amount` feeding a clipper: the drive stage, louder in means dirtier out. */
function drivenBy(ctx: BaseAudioContext, amount: number): [GainNode, WaveShaperNode] {
  const push = ctx.createGain();
  push.gain.value = amount;
  const ws = driven(ctx);
  push.connect(ws);
  return [push, ws];
}

/** A sine under a dance bass, an octave down when the note is high: what the low end feels. */
function sub(k: VoiceKit, out: AudioNode, t: number, f: number, vel: number, dur: number): void {
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.006);
  g.gain.setTargetAtTime(EPS, t + dur, 0.03);
  osc(k, 'sine', f > 70 ? f / 2 : f, t, t + dur + 0.2).connect(g).connect(out);
}

/** Wobble: a saw and a square through a resonant low-pass whose cutoff swings at `rate` Hz. */
function wobble(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 7;
  lp.frequency.value = 700 * tone.bright;
  const lfo = osc(k, 'sine', Math.max(0.5, rate), t, end);
  const depth = ctx.createGain();
  depth.gain.value = 620 * tone.bright;
  lfo.connect(depth).connect(lp.frequency);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.005);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.02);
  const [push, ws] = drivenBy(ctx, tone.drive);
  lp.connect(push);
  ws.connect(amp).connect(out);
  osc(k, 'sawtooth', f, t, end).connect(lp);
  const sq = osc(k, 'square', f, t, end);
  sq.detune.value = 7;
  const sg = ctx.createGain();
  sg.gain.value = 0.6;
  sq.connect(sg).connect(lp);
  sub(k, out, t, f, vel, dur);
}

/** Growl: a driven saw stack through two band-passes that sweep apart and back, a vowel that talks. */
function growl(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.08;
  const pre = ctx.createGain();
  pre.gain.value = 0.6 * tone.drive;
  const ws = driven(ctx);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.24 * vel, t + 0.004);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.015);
  const lfo = osc(k, 'triangle', Math.max(1, rate), t, end);
  for (const [hz, swing] of [[520, 380], [1500, -700]] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz * tone.bright;
    bp.Q.value = 6;
    const d = ctx.createGain();
    d.gain.value = swing;
    lfo.connect(d).connect(bp.frequency);
    ws.connect(bp).connect(amp);
  }
  pre.connect(ws);
  amp.connect(out);
  for (const cents of [-10, 0, 9]) {
    const o = osc(k, 'sawtooth', f * 1.04, t, end);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);   // a small "yoi" into pitch
    o.detune.value = cents;
    o.connect(pre);
  }
  sub(k, out, t, f, vel * 0.9, dur);
}

/**
 * Reese: three saws a few cents apart, so they beat against each other, under a slowly
 * moving low-pass, then driven hard into a clipper (the dirt) and smoothed after it so
 * the grit stays in the bass's range rather than fizzing.
 */
function reese(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.15;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900 * tone.bright;
  lp.Q.value = 2;
  const drift = osc(k, 'sine', 0.3 + k.rng() * 0.2, t, end);
  const d = ctx.createGain();
  d.gain.value = 420;
  drift.connect(d).connect(lp.frequency);
  const push = ctx.createGain();
  push.gain.value = 1.3 * tone.drive;
  const smooth = ctx.createBiquadFilter();
  smooth.type = 'lowpass';
  smooth.frequency.value = 3200;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.02);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.05);
  lp.connect(push).connect(driven(ctx)).connect(smooth).connect(amp).connect(out);
  for (const cents of [-14, 0, 13]) {
    const o = osc(k, 'sawtooth', f, t, end);
    o.detune.value = cents;
    o.connect(lp);
  }
  sub(k, out, t, f, vel, dur);
}

/**
 * Slap: a plucked string, modelled the classic way (Karplus-Strong). A short burst of
 * noise runs round a delay line one period long, losing a little top on every trip
 * through a low-pass, so it rings and mellows like a real string. Because the pitch is
 * the delay's length, the note can move: `art` is how it is played (LofiNote.mod).
 *   0 thumb  a dull thud, woody and round
 *   1 pop    a bright snap with a quick, slightly sharp start
 *   2 slide  comes up into the note from a fourth below
 *   3 bend   popped, then pushed up a tone and let back down
 * A sine under the string keeps the weight a modelled string loses as it decays.
 */
function slap(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const pop = art === 1 || art === 3;
  const len = Math.max(0.12, Math.min(dur + 0.08, 0.8));
  const end = t + len + 0.05;
  // The string. A Web Audio loop holds at least one 128-frame block, which caps the
  // string at about 340 Hz; slap notes stay below that.
  const delay = ctx.createDelay(0.1);
  const period = (hz: number): number => Math.max(128 / ctx.sampleRate, 1 / hz);
  const pitch = delay.delayTime;
  if (art === 2) {
    pitch.setValueAtTime(period(f * 2 ** (-5 / 12)), t);
    pitch.linearRampToValueAtTime(period(f), t + 0.07);
  } else if (art === 3) {
    pitch.setValueAtTime(period(f), t);
    pitch.linearRampToValueAtTime(period(f * 2 ** (2 / 12)), t + 0.09);
    pitch.linearRampToValueAtTime(period(f), t + 0.22);
  } else if (pop) {
    pitch.setValueAtTime(period(f * 1.012), t);
    pitch.linearRampToValueAtTime(period(f), t + 0.03);
  } else {
    pitch.setValueAtTime(period(f), t);
  }
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = (pop ? 5200 : 2000) * tone.bright;
  const loop = ctx.createGain();
  loop.gain.setValueAtTime(pop ? 0.992 : 0.986, t);
  loop.gain.setValueAtTime(pop ? 0.992 : 0.986, t + len);
  loop.gain.linearRampToValueAtTime(0, t + len + 0.03);   // let go of the string
  delay.connect(damp).connect(loop).connect(delay);
  // The pluck: a thud for the thumb, a click for the pop.
  const excite = ctx.createBiquadFilter();
  excite.type = pop ? 'bandpass' : 'lowpass';
  excite.frequency.value = pop ? 2600 : 900;
  excite.Q.value = pop ? 0.8 : 0.7;
  const eg = ctx.createGain();
  eg.gain.setValueAtTime(pop ? 1 : 0.9, t);
  eg.gain.exponentialRampToValueAtTime(EPS, t + (pop ? 0.006 : 0.012));
  noiseAt(k, t, 0.015).connect(excite).connect(eg).connect(delay);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime((pop ? 0.42 : 0.5) * vel, t);
  amp.gain.setTargetAtTime(EPS, t + len, 0.03);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 35;
  delay.connect(hp).connect(amp).connect(out);
  // The weight under the string, following its slides and bends.
  const body = osc(k, 'sine', f, t, end);
  if (art === 2) {
    body.frequency.setValueAtTime(f * 2 ** (-5 / 12), t);
    body.frequency.linearRampToValueAtTime(f, t + 0.07);
  } else if (art === 3) {
    body.frequency.linearRampToValueAtTime(f * 2 ** (2 / 12), t + 0.09);
    body.frequency.linearRampToValueAtTime(f, t + 0.22);
  }
  const bg = ctx.createGain();
  struck(bg.gain, t, len, (pop ? 0.12 : 0.22) * vel, 0.003, 0.2, 0.5, 0.03);
  body.connect(bg).connect(out);
}

/**
 * Screech: an FM cry. A saw is frequency-modulated by a sine at one and a half times its
 * pitch; the modulation depth and a peaky band-pass both swing at `rate`, then the lot
 * is driven hard. Mid-range and aggressive, with a sine under it for the low end.
 */
function screech(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.06;
  const carrier = osc(k, 'sawtooth', f * 1.06, t, end);
  carrier.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.12, dur * 0.5));   // a slide into the note
  const mod = osc(k, 'sine', f * 1.5, t, end);
  const index = ctx.createGain();
  index.gain.value = f * 2.2;
  const lfo = osc(k, 'triangle', Math.max(1, rate), t, end);
  const swing = ctx.createGain();
  swing.gain.value = f * 1.8;
  lfo.connect(swing).connect(index.gain);
  mod.connect(index).connect(carrier.frequency);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 4;
  bp.frequency.value = 1700 * tone.bright;
  const sweep = ctx.createGain();
  sweep.gain.value = 1100 * tone.bright;
  lfo.connect(sweep).connect(bp.frequency);
  const [push, ws] = drivenBy(ctx, 0.9 * tone.drive);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.004);
  amp.gain.setTargetAtTime(EPS, t + dur, 0.015);
  carrier.connect(push);
  ws.connect(bp).connect(amp).connect(out);
  sub(k, out, t, f / 2, vel * 0.85, dur);
}

/** Pulse bass: a 25% pulse with a triangle an octave down, short and bright, like a console's bass channel. */
function pulseBass(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.06, Math.min(dur, 0.4));
  const end = t + len + 0.05;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5000 * tone.bright;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.14 * vel, t + 0.002);
  amp.gain.setValueAtTime(0.14 * vel, t + len * 0.7);
  amp.gain.exponentialRampToValueAtTime(EPS, t + len);
  lp.connect(amp).connect(out);
  pulseOsc(k, 0.25, f, t, end).connect(lp);
  const tri = osc(k, 'triangle', f / 2, t, end);
  const tg = ctx.createGain();
  tg.gain.value = 1.4;
  tri.connect(tg).connect(lp);
}

/**
 * Electro: a saw and a square through a resonant low-pass that snaps shut (a wah on every
 * note), driven very hard and high-passed so the dirt sits in the mids, over a sine for the low end.
 */
function electro(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.08, dur);
  const end = t + len + 0.06;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 5;
  lp.frequency.setValueAtTime(3400 * tone.bright, t);
  lp.frequency.exponentialRampToValueAtTime(520 * tone.bright, t + Math.min(0.18, len));
  const [push, ws] = drivenBy(ctx, 1.1 * tone.drive);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.15 * vel, t + 0.003);
  amp.gain.setTargetAtTime(EPS, t + len, 0.02);
  lp.connect(push);
  ws.connect(hp).connect(amp).connect(out);
  osc(k, 'sawtooth', f, t, end).connect(lp);
  const sq = osc(k, 'square', f, t, end);
  sq.detune.value = -8;
  sq.connect(lp);
  sub(k, out, t, f, vel * 0.8, len);
}

// ── effects ──────────────────────────────────────────────────────────────────

/** A crash: bright noise that rings for a couple of seconds, and on a drop a low boom under the kick. */
export function crash(k: VoiceKit, out: AudioNode, t: number, vel: number): void {
  const { ctx } = k;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3800;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 7600;
  bp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.25);
  g.gain.exponentialRampToValueAtTime(EPS, t + 2);
  noiseAt(k, t, 2).connect(hp).connect(bp).connect(g).connect(out);
  if (vel < 0.8) return;
  const boom = osc(k, 'sine', 62, t, t + 1.1);
  boom.frequency.exponentialRampToValueAtTime(34, t + 0.9);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.5 * vel, t);
  bg.gain.exponentialRampToValueAtTime(EPS, t + 1);
  boom.connect(bg).connect(out);
}

/** A riser: noise through a band-pass that climbs over `dur`, growing louder, cut dead at the end. */
export function riser(k: VoiceKit, out: AudioNode, t: number, vel: number, dur: number): void {
  const { ctx } = k;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.004, t);
  g.gain.exponentialRampToValueAtTime(0.14 * vel, t + dur);
  g.gain.setValueAtTime(EPS, t + dur + 0.01);
  noiseAt(k, t, dur + 0.02).connect(bp).connect(g).connect(out);
  const tone = osc(k, 'sawtooth', 110, t, t + dur + 0.02);
  tone.frequency.exponentialRampToValueAtTime(880, t + dur);
  const tl = ctx.createBiquadFilter();
  tl.type = 'lowpass';
  tl.frequency.value = 2400;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(EPS, t);
  tg.gain.exponentialRampToValueAtTime(0.03 * vel, t + dur);
  tg.gain.setValueAtTime(EPS, t + dur + 0.01);
  tone.connect(tl).connect(tg).connect(out);
}

/** A coin: a square blip at `midi`, then a held blip a fourth higher, ringing out. */
export function coin(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number): void {
  const { ctx } = k;
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.003);
  g.gain.setValueAtTime(0.07 * vel, t + 0.07);
  g.gain.exponentialRampToValueAtTime(EPS, t + 0.5);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7000;
  lp.connect(g).connect(out);
  const o = osc(k, 'square', mtof(midi), t, t + 0.55);
  o.frequency.setValueAtTime(mtof(midi + 5), t + 0.07);
  o.connect(lp);
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
