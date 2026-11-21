// SPDX-License-Identifier: MPL-2.0
/**
 * The talking basses: the growl, the wobble, the foghorn and the jump-up stab, and the
 * mouth they share.
 *
 * Measured against produced bass shots (2026-11-21; measurement only, nothing sampled):
 * a produced growl or stab holds two or three vowel peaks still (near 500 Hz, 1.3 to
 * 1.6 kHz and 2.5 kHz) while its tone moves between them, keeps 8 to 16 dB of its energy
 * between 4 and 8 kHz, and is rough: its waveform repeats only 30 to 60 per cent from one
 * cycle to the next. The basses here before were one band-pass swept by an oscillator,
 * closed by a low-pass at 3.6 kHz, and clean (over 90 per cent).
 *
 * So a note is:
 * - a rough source: saws, and a saw whose pitch is shaken by a sine at a ratio that is not
 *   a whole number, which puts its partials between the harmonics;
 * - a first drive;
 * - the mouth: two vowels, each a bank of three fixed band-passes, crossfaded by a curve
 *   worked out for the note (a swing, a falling wow, a rising yoi, a gate), with a body
 *   band under them so the middle is never hollow. The filters never move, which costs a
 *   fraction of a swept filter and lets the vowels stay put the way a mouth's do;
 * - a second, lighter drive, so the vowel peaks rub against each other;
 * - the air: what the second drive makes above 3.5 kHz, opened with the mouth.
 *
 * A stack (lib/lofi-bass-stack.ts) plays two takes of a note; both draw the same vowels
 * and the same shape (they are picked from the note itself, never from the kit's draws)
 * and the second swings out of step by `tone.phase`.
 */
import { EPS, drivenBy, mtof, noiseAt, osc, sub, type Tone, type VoiceKit } from './lofi-voices.ts';

/** A vowel: three peaks (Hz) and each peak's level. */
type Vowel = readonly [readonly [number, number, number], readonly [number, number, number]];
const V = {
  oo: [[320, 800, 2300], [1, 0.5, 0.25]],
  oh: [[450, 850, 2500], [1, 0.7, 0.3]],
  aw: [[590, 950, 2600], [1, 0.8, 0.35]],
  ah: [[720, 1240, 2600], [1, 0.9, 0.45]],
  er: [[500, 1350, 1750], [1, 0.9, 0.6]],
  eh: [[530, 1700, 2540], [1, 0.9, 0.6]],
  ee: [[300, 2200, 2950], [0.9, 1, 0.7]],
  ae: [[660, 1650, 2450], [1, 1, 0.6]],
} as const satisfies Record<string, Vowel>;

/** How a mouth moves through a note: the crossfade from the first vowel (0) to the second (1) over time. */
type Shape = 'swing' | 'wow' | 'yoi' | 'gate' | 'open';

/** The points a mouth's curve is drawn with, per second of note (a curve is a ramp between points). */
const CURVE_RATE = 240;

/**
 * The crossfade curve of a note: `len` seconds at `rate` swings a second, starting
 * `phase` of a cycle in. A note too short for half a swing opens once (or closes once)
 * instead, so a short hit says one syllable.
 */
function curveOf(shape: Shape, len: number, rate: number, phase: number): Float32Array<ArrayBuffer> {
  const n = Math.max(8, Math.ceil(len * CURVE_RATE));
  const c = new Float32Array(n);
  const cycles = rate * len;
  for (let i = 0; i < n; i++) {
    const at = i / (n - 1);
    const x = at * cycles + phase;
    const frac = x - Math.floor(x);
    let v: number;
    if (shape === 'open') v = 1 - Math.exp(-at * 9);
    else if (cycles < 0.5) v = shape === 'wow' ? 1 - at : at;
    else if (shape === 'wow') v = Math.min(1, frac * 12) * (1 - frac) ** 1.5;
    else if (shape === 'yoi') v = frac ** 1.4 * Math.min(1, (1 - frac) * 14);
    else if (shape === 'gate') v = frac < 0.5 ? Math.min(1, frac * 30, (0.5 - frac) * 30) : 0;
    else v = 0.5 - 0.5 * Math.cos(2 * Math.PI * x);
    c[i] = v;
  }
  return c;
}

/** A number in 0..1 from a note's own facts, so both takes of a stack agree and the kit's draws are left alone. */
function hash(midi: number, len: number, rate: number, salt: number): number {
  const x = Math.sin(Math.round(midi) * 12.9898 + Math.round(len * 200) * 78.233 + Math.round(rate * 16) * 37.719 + salt * 4.1414) * 43758.5453;
  return x - Math.floor(x);
}

interface MouthSpec {
  from: Vowel;
  to: Vowel;
  curve: Float32Array<ArrayBuffer>;
  /** The vowels' sharpness, the body's level and frequency (a low-pass, or with `band` a wide band-pass that leaves the lows out), and the air's level against the vowels. */
  q: number;
  body: number;
  bodyHz: number;
  band?: boolean;
  air: number;
  /** How hard the second drive is pushed. */
  rub: number;
  bright: number;
}

/**
 * The mouth, from `t` for `len` seconds: returns its input. The two vowels crossfade along
 * the curve at equal power; the air opens with the second vowel.
 */
function mouth(k: VoiceKit, out: AudioNode, t: number, len: number, m: MouthSpec): GainNode {
  const { ctx } = k;
  const input = ctx.createGain();
  const [rub, ws] = drivenBy(ctx, m.rub, k.hq === true);
  const n = m.curve.length;
  const up = new Float32Array(n);
  const down = new Float32Array(n);
  for (let i = 0; i < n; i++) { up[i] = Math.sin(m.curve[i]! * Math.PI / 2); down[i] = Math.cos(m.curve[i]! * Math.PI / 2); }
  const span = Math.max(0.02, len);
  const bank = (vowel: Vowel, fade: Float32Array<ArrayBuffer>): void => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(fade[0]!, 0);
    g.gain.setValueCurveAtTime(fade, t, span);
    for (let i = 0; i < 3; i++) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(9000, vowel[0][i]! * (i === 0 ? 1 : m.bright ** 0.5));
      bp.Q.value = m.q * (i === 0 ? 0.7 : 1);
      const lvl = ctx.createGain();
      // A saw falls 6 dB an octave, so the upper peaks are lifted to stand as tall as the first.
      lvl.gain.value = vowel[1][i]! * 2.2 * (vowel[0][i]! / vowel[0][0]!) ** 0.75;
      input.connect(bp).connect(lvl).connect(g);
    }
    g.connect(rub);
  };
  bank(m.from, down);
  bank(m.to, up);
  // The body: the plain sound under the vowels, so 250 Hz to 1 kHz never empties as they move.
  const body = ctx.createBiquadFilter();
  body.type = m.band ? 'bandpass' : 'lowpass';
  body.frequency.value = m.bodyHz * m.bright;
  body.Q.value = m.band ? 0.6 : 0.8;
  const bg = ctx.createGain();
  bg.gain.value = m.body;
  input.connect(body).connect(bg).connect(rub);
  // After the rub: the whole sound under 9 kHz, and the air over 3.5 kHz, opening with the mouth.
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = Math.min(12000, 9000 * m.bright);
  ws.connect(top).connect(out);
  if (m.air > 0) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    hp.Q.value = 0.9;
    const ag = ctx.createGain();
    const breath = new Float32Array(n);
    for (let i = 0; i < n; i++) breath[i] = m.air * (0.35 + 0.65 * m.curve[i]!);
    ag.gain.setValueAtTime(breath[0]!, 0);
    ag.gain.setValueCurveAtTime(breath, t, span);
    ws.connect(hp).connect(ag).connect(out);
  }
  return input;
}

/**
 * The rough source into `to`: saws at `cents`, and one saw whose pitch a sine at `ratio`
 * times the note shakes by `index` of the note's frequency, falling to `rest` of that over the note.
 */
function rough(k: VoiceKit, to: AudioNode, f: number, t: number, end: number, cents: readonly number[], ratio: number, index: number, rest: number, glide = 1): void {
  const { ctx } = k;
  for (const c of cents) {
    const o = osc(k, 'sawtooth', f * glide, t, end);
    if (glide !== 1) o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    o.detune.value = c;
    o.connect(to);
  }
  if (index <= 0) return;
  const car = osc(k, 'sawtooth', f * glide, t, end);
  if (glide !== 1) car.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const mod = osc(k, 'sine', f * ratio, t, end);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(f * index, t);
  depth.gain.exponentialRampToValueAtTime(Math.max(EPS, f * index * rest), end);
  mod.connect(depth).connect(car.frequency);
  const g = ctx.createGain();
  g.gain.value = 0.9;
  car.connect(g).connect(to);
}

/** The vowel pairs a growl talks in, and the shapes its mouth takes. */
const GROWL_VOWELS: ReadonlyArray<readonly [Vowel, Vowel]> = [[V.oh, V.ee], [V.aw, V.eh], [V.oo, V.ah], [V.er, V.ae], [V.oh, V.eh], [V.ah, V.ee]];
const GROWL_SHAPES: readonly Shape[] = ['swing', 'wow', 'yoi', 'swing', 'gate'];

/**
 * Growl: the rough source driven into the mouth, which talks at `rate` between a vowel
 * pair picked for the note. A fast, short note says one syllable; a long one swings, wows
 * or stutters.
 */
export function growl(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.05, dur);
  const end = t + len + 0.08;
  const r = Math.max(1, rate);
  const pair = GROWL_VOWELS[Math.floor(hash(midi, len, r, 1) * GROWL_VOWELS.length)]!;
  const shape = GROWL_SHAPES[Math.floor(hash(midi, len, r, 2) * GROWL_SHAPES.length)]!;
  const curve = curveOf(shape, len, r, tone.phase ?? 0);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(GROWL_LEVEL * vel, t + 0.004);
  amp.gain.setValueAtTime(GROWL_LEVEL * vel, t + len);
  amp.gain.exponentialRampToValueAtTime(EPS, t + len + 0.012);   // a growl stops dead
  amp.connect(out);
  const input = mouth(k, amp, t, len, { from: pair[0], to: pair[1], curve, q: 6, body: 1.1, bodyHz: 430, band: true, air: 1.3, rub: 1.8, bright: tone.bright });
  const [push, ws] = drivenBy(ctx, 0.5 * tone.drive, true);
  ws.connect(input);
  rough(k, push, f, t, end, tone.take === undefined ? [-10, 9] : tone.take === 0 ? [-10] : [9], 1.5 + 0.007 * (midi % 5), 2.6, 0.6, 1.04);
  // An octave under, square: the throat's weight above the sub.
  const sq = osc(k, 'square', f / 2, t, end);
  const sg = ctx.createGain();
  sg.gain.value = 0.35;
  sq.connect(sg).connect(push);
  if (tone.sub !== false) sub(k, out, t, f, vel * 0.9, dur);
}
const GROWL_LEVEL = 0.05;

/** The shapes a wobble's filter takes; a wobble is mostly the round swing a dubstep record is known for. */
const WOBBLE_SHAPES: readonly Shape[] = ['swing', 'swing', 'swing', 'wow', 'yoi', 'gate'];
const WOBBLE_VOWELS: ReadonlyArray<readonly [Vowel, Vowel]> = [[V.oo, V.ah], [V.oo, V.aw], [V.oh, V.ae], [V.oo, V.eh]];

/**
 * Wobble: a saw and a square through a mouth that opens and shuts at `rate`: shut is a
 * dark oo with the body under it, open an ah or an eh with its air. Driven after the
 * mouth, as the old wobble's filter was, so the dirt comes as the mouth opens.
 */
export function wobble(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.05, dur);
  const end = t + len + 0.1;
  const r = Math.max(0.5, rate);
  const pair = WOBBLE_VOWELS[Math.floor(hash(midi, len, r, 3) * WOBBLE_VOWELS.length)]!;
  const shape = WOBBLE_SHAPES[Math.floor(hash(midi, len, r, 4) * WOBBLE_SHAPES.length)]!;
  const curve = curveOf(shape, len, r, tone.phase ?? 0);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(WOBBLE_LEVEL * vel, t + 0.005);
  amp.gain.setTargetAtTime(EPS, t + len, 0.015);
  amp.connect(out);
  const input = mouth(k, amp, t, len, { from: pair[0], to: pair[1], curve, q: 4.5, body: 1.5, bodyHz: 560, air: 0.7, rub: 1.1 * tone.drive, bright: tone.bright });
  osc(k, 'sawtooth', f, t, end).connect(input);
  const sq = osc(k, 'square', f, t, end);
  sq.detune.value = 7;
  const sg = ctx.createGain();
  sg.gain.value = 0.6;
  sq.connect(sg).connect(input);
  if (tone.sub !== false) sub(k, out, t, f, vel, dur);
}
const WOBBLE_LEVEL = 0.17;

/**
 * Foghorn: a long, flat, held note. Five saws (three at the note, two an octave up) and a
 * square swell open over about a tenth of a second, through an aw that barely moves, with
 * plenty of air, and stop dead. `rate` above zero drifts the vowel slowly toward an ah and
 * back. Its weight is the sine under it, at the note folded low.
 */
export function fog(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.12, dur);
  const end = t + len + 0.08;
  const curve = rate > 0 ? curveOf('swing', len, Math.min(2.5, rate), tone.phase ?? 0) : curveOf('open', len, 0, 0);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(FOG_LEVEL * vel, t + Math.min(0.09, len * 0.4));   // the horn swells in
  amp.gain.setValueAtTime(FOG_LEVEL * vel, t + len);
  amp.gain.exponentialRampToValueAtTime(EPS, t + len + 0.015);   // and stops dead
  amp.connect(out);
  const input = mouth(k, amp, t, len, { from: V.oh, to: V.aw, curve, q: 3, body: 1.1, bodyHz: 1300, air: 1.4, rub: 1.5 * (0.6 + 0.4 * tone.drive), bright: tone.bright });
  const one = tone.take === undefined;
  rough(k, input, f, t, end, one ? [-13, 0, 12] : tone.take === 0 ? [-13, 3] : [-3, 12], 0.5, 0.35, 1, 1);
  for (const c of one ? [-7, 8] : tone.take === 0 ? [-7] : [8]) {
    const o = osc(k, 'sawtooth', f * 2, t, end);
    o.detune.value = c;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    o.connect(g).connect(input);
  }
  const sq = osc(k, 'square', f, t, end);
  const sg = ctx.createGain();
  sg.gain.value = 0.3;
  sq.connect(sg).connect(input);
  if (tone.sub !== false) {
    // The horn's own weight: the note folded under 60 Hz, flat for the note and cut with the horn.
    let low = f;
    while (low > 60) low /= 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.5 * vel, t + 0.02);
    g.gain.setValueAtTime(0.5 * vel, t + len);
    g.gain.exponentialRampToValueAtTime(EPS, t + len + 0.03);
    osc(k, 'sine', low, t, end).connect(g).connect(out);
  }
}
const FOG_LEVEL = 0.07;

/** The vowels a jump-up stab barks. */
const JUMP_VOWELS: ReadonlyArray<readonly [Vowel, Vowel]> = [[V.eh, V.er], [V.ae, V.oh], [V.ee, V.er], [V.ah, V.oh]];

/**
 * Jump-up: a short bark in the middle of the mix, with no low end of its own (a stack's
 * sub, or the sine here, carries the note). A rough, buzzing source at the bass note,
 * high-passed at 250 Hz, barks a vowel that closes as the stab falls, after a click of
 * noise. `rate` above zero gates a longer note into a stutter at that rate.
 */
export function jump(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, rate: number, tone: Tone): void {
  const { ctx } = k;
  const f = mtof(midi);
  const len = Math.max(0.06, dur);
  const end = t + len + 0.25;
  const stutter = rate > 0 && rate * len >= 1;
  const pair = JUMP_VOWELS[Math.floor(hash(midi, len, rate, 5) * JUMP_VOWELS.length)]!;
  const curve = stutter ? curveOf('gate', len, rate, 0) : curveOf('wow', len + 0.2, 0, 0);
  // A stab rings on after its note for a moment; a stutter is cut by its gate.
  const ring = stutter ? len : len + 0.2;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, 0);
  if (stutter) {
    const gate = new Float32Array(curve.length);
    for (let i = 0; i < gate.length; i++) gate[i] = JUMP_LEVEL * vel * (0.2 + 0.8 * curve[i]!);
    amp.gain.setValueCurveAtTime(gate, t, len);
    amp.gain.setTargetAtTime(EPS, t + len, 0.01);
  } else {
    amp.gain.setValueAtTime(EPS, t);
    amp.gain.exponentialRampToValueAtTime(JUMP_LEVEL * vel, t + 0.008);
    amp.gain.setTargetAtTime(JUMP_LEVEL * vel * 0.1, t + Math.min(len, 0.09), 0.07);
    amp.gain.setTargetAtTime(EPS, t + ring, 0.02);
  }
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 250;
  hp.Q.value = 0.9;
  hp.connect(amp).connect(out);
  const input = mouth(k, hp, t, ring, { from: pair[1], to: pair[0], curve, q: 6, body: 0.3, bodyHz: 900, band: true, air: 1.8, rub: 2.2, bright: tone.bright });
  const [push, ws] = drivenBy(ctx, 0.6 * tone.drive, true);
  ws.connect(input);
  // The buzz: the note an octave up with a shake at a ratio between the harmonics, which is what roughens a stab.
  rough(k, push, f * 2, t, end, tone.take === 1 ? [8] : [-8], 2.76, 2.4, 0.3, tone.take === undefined ? 1.12 : 1.08);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(EPS, t + 0.03);
  noiseAt(k, t, 0.04).connect(ng).connect(input);
  if (tone.sub !== false) sub(k, out, t, f, vel * 0.9, Math.min(len, 0.25));
}
const JUMP_LEVEL = 0.12;
