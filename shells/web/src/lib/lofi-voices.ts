// SPDX-License-Identifier: MPL-2.0
/**
 * Lofi instruments: the Web Audio voices that play engine/src/lofi-compose.ts's notes.
 * Every one is synthesised from oscillators, filters and a seeded noise buffer, so the
 * station ships no samples, owes no licence and renders the same bytes offline as live.
 *
 *   keys   an electric piano: a two-operator FM voice whose brightness falls as the note
 *          rings (the "tine"), plus a faint bell partial on the attack.
 *   bass   a round sine with a little triangle for definition, a pluck at the start.
 *   lead   soft vibes: a sine with a quiet fourth-harmonic shimmer and a slow vibrato.
 *   kick   a sine that drops from about 140 to 48 Hz, with a muffled click.
 *   snare  a band of noise over a short tonal body; `brush` makes it a soft swish.
 *   rim    a short woody knock.
 *   hat    high noise, closed or open.
 *
 * Each voice schedules its own nodes at `t` on the context it is given and lets them
 * end; nothing is kept. Levels sit low: the station's bus and master set the loudness.
 */

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

/** The electric piano. `dur` is how long the key is held. */
export function keys(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.45;
  const car = ctx.createOscillator();
  car.frequency.setValueAtTime(f, t);
  car.detune.setValueAtTime((k.rng() - 0.5) * 8, t);
  const mod = ctx.createOscillator();
  mod.frequency.setValueAtTime(f, t);
  const index = ctx.createGain();   // FM depth in Hz: bright on the strike, mellowing as it rings
  index.gain.setValueAtTime(f * (0.6 + vel * 1.2), t);
  index.gain.exponentialRampToValueAtTime(f * 0.18, t + 0.7);
  mod.connect(index).connect(car.frequency);
  const amp = ctx.createGain();
  const peak = 0.16 * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(peak * 0.38, t + Math.max(0.01, Math.min(1.2, dur * 0.9)));
  amp.gain.setTargetAtTime(EPS, t + dur, 0.12);
  car.connect(amp).connect(out);
  // The tine: a quiet partial three octaves and a bit up, gone in a moment.
  const tine = ctx.createOscillator();
  tine.frequency.setValueAtTime(f * 7.1, t);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(EPS, t);
  tg.gain.exponentialRampToValueAtTime(0.012 * vel, t + 0.002);
  tg.gain.exponentialRampToValueAtTime(EPS, t + 0.12);
  tine.connect(tg).connect(out);
  for (const o of [car, mod]) { o.start(t); o.stop(end); }
  tine.start(t); tine.stop(t + 0.14);
}

export function bass(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.25;
  const amp = ctx.createGain();
  const peak = 0.34 * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(peak * 0.55, t + Math.max(0.012, Math.min(0.5, dur * 0.9)));
  amp.gain.setTargetAtTime(EPS, t + dur, 0.06);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(420, t + 0.25);
  lp.connect(amp).connect(out);
  for (const [type, level] of [['sine', 1], ['triangle', 0.35]] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f * 1.015, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);   // the pluck settles into pitch
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
    o.start(t); o.stop(end);
  }
}

export function lead(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.5;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f, t);
  const vib = ctx.createOscillator();
  vib.frequency.setValueAtTime(5.1, t);
  const depth = ctx.createGain();   // vibrato in cents, easing in after the attack
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(7, t + 0.35);
  vib.connect(depth).connect(o.detune);
  const amp = ctx.createGain();
  const peak = 0.11 * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(peak * 0.45, t + Math.max(0.015, Math.min(0.9, dur * 0.9)));
  amp.gain.setTargetAtTime(EPS, t + dur, 0.15);
  o.connect(amp).connect(out);
  const shimmer = ctx.createOscillator();
  shimmer.frequency.setValueAtTime(f * 4, t);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(EPS, t);
  sg.gain.exponentialRampToValueAtTime(0.02 * vel, t + 0.004);
  sg.gain.exponentialRampToValueAtTime(EPS, t + 0.3);
  shimmer.connect(sg).connect(out);
  for (const n of [o, vib]) { n.start(t); n.stop(end); }
  shimmer.start(t); shimmer.stop(t + 0.32);
}

export function kick(k: VoiceKit, out: AudioNode, t: number, vel: number): void {
  const { ctx } = k;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.07);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.003);
  amp.gain.exponentialRampToValueAtTime(EPS, t + 0.42);
  o.connect(amp).connect(out);
  o.start(t); o.stop(t + 0.45);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.18 * vel, t);
  cg.gain.exponentialRampToValueAtTime(EPS, t + 0.012);
  noiseAt(k, t, 0.015).connect(lp).connect(cg).connect(out);
}

export function snare(k: VoiceKit, out: AudioNode, t: number, vel: number, brush = false): void {
  const { ctx } = k;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = brush ? 2600 : 1900;
  bp.Q.value = brush ? 0.6 : 0.9;
  const g = ctx.createGain();
  const decay = brush ? 0.26 : 0.17;
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime((brush ? 0.2 : 0.32) * vel, t + (brush ? 0.02 : 0.002));
  g.gain.exponentialRampToValueAtTime(EPS, t + decay);
  noiseAt(k, t, decay).connect(bp).connect(g).connect(out);
  if (brush) return;
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(190, t);
  body.frequency.exponentialRampToValueAtTime(160, t + 0.08);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(EPS, t);
  bg.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.002);
  bg.gain.exponentialRampToValueAtTime(EPS, t + 0.09);
  body.connect(bg).connect(out);
  body.start(t); body.stop(t + 0.1);
}

export function rim(k: VoiceKit, out: AudioNode, t: number, vel: number): void {
  const { ctx } = k;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(1150, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(0.14 * vel, t + 0.001);
  g.gain.exponentialRampToValueAtTime(EPS, t + 0.035);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + 0.04);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 3;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.3 * vel, t);
  ng.gain.exponentialRampToValueAtTime(EPS, t + 0.03);
  noiseAt(k, t, 0.03).connect(bp).connect(ng).connect(out);
}

export function hat(k: VoiceKit, out: AudioNode, t: number, vel: number, open = false): void {
  const { ctx } = k;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 10000;
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  const decay = open ? 0.24 : 0.035;
  g.gain.setValueAtTime(0.16 * vel, t);
  g.gain.exponentialRampToValueAtTime(EPS, t + decay);
  noiseAt(k, t, decay).connect(hp).connect(bp).connect(g).connect(out);
}
