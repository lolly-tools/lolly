// SPDX-License-Identifier: MPL-2.0
/**
 * A voice saying "Lolly": the producer's tag a tune can open with or drop on, the way a
 * producer signs a track. Synthesised, never recorded: a small formant synthesiser after
 * Klatt's (1980). A glottal pulse (Klatt and Klatt's 1990 shape, each period a hair
 * different in length and strength, as a real voice is) and breath noise pass a cascade
 * of four resonators, the vocal tract's formants, whose frequencies move from one sound
 * of the word to the next: the l, the vowel of "lot", the second l and the "ee".
 *
 * The l is the tongue touching the ridge behind the teeth: the voice goes quieter and the
 * first two formants close in, which is the dip that makes "lol-ly" two syllables. A
 * delivery is how the word is said: spoken, shouted, a crowd shouting, sung on the
 * tune's key, whispered, pitched up, pitched down, robotic, stuttered, or thrown into
 * the echo. Each tune draws its own speaker (a lower or a higher voice, a longer or
 * shorter vocal tract), so no two tags are quite alike.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same delivery, settings and seed.
 */

import { LOFI_TAGS } from '../../../../engine/src/lofi-compose.ts';

/** How the word is said: the composer's tag deliveries (LOFI_TAGS). */
export const TAG_DELIVERIES = LOFI_TAGS;
export type TagDelivery = typeof LOFI_TAGS[number];

/** A sound of the word: its four formants (Hz) and their bandwidths, how voiced it is, and how long it lasts (s). */
interface Phone { f: readonly [number, number, number, number]; bw: readonly [number, number, number, number]; voice: number; dur: number }
/** "Lolly" as an adult speaker says it: l, the vowel of "lot", l, the "ee" of "happy". */
const WORD: readonly Phone[] = [
  { f: [360, 1050, 2700, 3500], bw: [70, 110, 160, 230], voice: 0.45, dur: 0.07 },
  { f: [640, 1000, 2500, 3400], bw: [80, 90, 140, 210], voice: 1, dur: 0.14 },
  { f: [340, 1250, 2650, 3450], bw: [70, 120, 160, 230], voice: 0.42, dur: 0.06 },
  { f: [290, 2250, 2950, 3650], bw: [55, 100, 160, 230], voice: 0.92, dur: 0.2 },
];

/** How one speaker says the word: pitch through the word, timing, and the voice's quality. */
interface Saying {
  /** The pitch (Hz) at each sound's middle, and where the word ends. */
  pitch: readonly number[];
  /** Each sound's length, as a multiple of the spoken one. */
  stretch: readonly number[];
  /** The vocal tract: 1 is an adult man's, about 1.17 a woman's, more for a child or a chipmunk. */
  tract: number;
  /** How long the glottis is open in each period (0.3 pressed, 0.7 breathy). */
  open: number;
  /** Breath in the voice (0 to 1), and the whole as breath with no voice (a whisper). */
  breath: number; whisper?: boolean;
  /** A vibrato on the held "ee" (cents), a monotone robot's held formants, and the level. */
  vibrato?: number; robot?: boolean; level: number;
  /** The speaker's place (-1 left to 1 right) and how late they start (s). */
  pan: number; late: number;
}

/** A two-pole resonator in Klatt's form, run on a sample with its frequency and bandwidth of the moment. */
class Resonator {
  private y1 = 0;
  private y2 = 0;
  run(x: number, f: number, bw: number, sr: number): number {
    const c = -Math.exp((-2 * Math.PI * bw) / sr);
    const b = 2 * Math.exp((-Math.PI * bw) / sr) * Math.cos((2 * Math.PI * f) / sr);
    const y = (1 - b - c) * x + b * this.y1 + c * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** A smooth step from 0 to 1. */
const ease = (u: number): number => u * u * (3 - 2 * u);

/** Render one speaker saying the word (or the sounds in `phones`) into `out` (left, right). */
function say(out: [Float32Array, Float32Array], sr: number, phones: readonly Phone[], s: Saying, rand: () => number, at: number): void {
  const lens = phones.map((p, i) => p.dur * (s.stretch[i] ?? 1));
  const mids: number[] = [];
  let total = 0;
  for (const len of lens) { mids.push(total + len / 2); total += len; }
  const start = Math.round((at + s.late) * sr);
  const n = Math.min(out[0].length - start, Math.ceil((total + 0.08) * sr));
  const res = [new Resonator(), new Resonator(), new Resonator(), new Resonator()];
  const left = Math.sqrt((1 - s.pan) / 2), right = Math.sqrt((1 + s.pan) / 2);
  let phase = 1, period = 0, strength = 1, tilt = 0;
  const held = { f: [0, 0, 0, 0], bw: [0, 0, 0, 0], until: -1 };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Where the word is: between which two sounds' middles, and how far.
    let k = 0;
    while (k < mids.length - 1 && t > mids[k + 1]!) k++;
    const a = phones[k]!, b = phones[Math.min(k + 1, phones.length - 1)]!;
    const span = Math.max(1e-3, (mids[k + 1] ?? total) - mids[k]!);
    const u = t <= mids[0]! ? 0 : ease(Math.min(1, Math.max(0, (t - mids[k]!) / span)));
    const f = [0, 1, 2, 3].map(j => (a.f[j]! + (b.f[j]! - a.f[j]!) * u) * s.tract);
    const bw = [0, 1, 2, 3].map(j => (a.bw[j]! + (b.bw[j]! - a.bw[j]!) * u) * (s.whisper ? 1.6 : 1));
    // A robot holds each formant for a moment, so the word steps from sound to sound.
    if (s.robot) {
      if (t >= held.until) { held.f = f; held.bw = bw.map(v => v * 0.7); held.until = t + 0.035; }
      for (let j = 0; j < 4; j++) { f[j] = held.f[j]!; bw[j] = held.bw[j]!; }
    }
    const voicing = a.voice + (b.voice - a.voice) * u;
    // The pitch through the word, and the held "ee"'s vibrato.
    const pk = Math.min(s.pitch.length - 2, k);
    let f0 = s.pitch[pk]! + (s.pitch[pk + 1]! - s.pitch[pk]!) * u;
    if (s.vibrato && t > mids[mids.length - 1]! - lens[lens.length - 1]! * 0.2) f0 *= 2 ** ((s.vibrato * Math.sin(2 * Math.PI * 5.4 * t)) / 1200);
    // The glottal pulse: each period a little different in length and strength.
    phase += 1 / Math.max(1, period);
    if (phase >= 1) {
      phase -= 1;
      period = (sr / f0) * (1 + (rand() - 0.5) * (s.robot ? 0 : 0.012));
      strength = 1 + (rand() - 0.5) * (s.robot ? 0 : 0.08);
    }
    const x = phase / s.open;
    const pulse = !s.whisper && x < 1 ? (2 * x - 3 * x * x) * strength : 0;
    // The voice's top falls away (more for a soft, breathy voice); breath rides each opening.
    tilt += (0.35 + (1 - s.open) * 0.6) * (pulse - tilt);
    const air = (rand() * 2 - 1) * (s.whisper ? 0.5 : s.breath * (x < 1 ? 0.35 : 0.12));
    // How loud: in over 15 ms, the word's own shape, out over the last 60 ms.
    const env = Math.min(1, t / 0.015) * Math.min(1, Math.max(0, (total + 0.04 - t) / 0.06));
    let y = (tilt * voicing + air * (s.whisper ? 1 : 0.5 + voicing * 0.5)) * env;
    for (let j = 0; j < 4; j++) y = res[j]!.run(y, Math.min(f[j]!, sr * 0.45), bw[j]!, sr);
    out[0][start + i] = out[0][start + i]! + y * s.level * left;
    out[1][start + i] = out[1][start + i]! + y * s.level * right;
  }
}

/** A speaker's voice, drawn for a tune: a man's or a woman's, a little higher or lower, a tract a little longer or shorter. */
function speaker(rand: () => number): { f0: number; tract: number } {
  const woman = rand() < 0.5;
  return { f0: (woman ? 205 : 118) * (0.9 + rand() * 0.2), tract: (woman ? 1.17 : 1) * (0.95 + rand() * 0.1) };
}

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/**
 * "Lolly", said one way. `midi` is a note of the tune's key in the singing range (the
 * sung tag sings its fifth and then the note), `beat` the tune's beat in seconds, which
 * the stutter keeps time with. Returns stereo, the word starting at once.
 */
export function sayLolly(sr: number, delivery: TagDelivery, opts: { midi: number; beat: number }, rand: () => number): [Float32Array, Float32Array] {
  const seconds = delivery === 'stutter' ? opts.beat * 1.5 + 0.8 : delivery === 'deep' ? 1.1 : 0.95;
  const out: [Float32Array, Float32Array] = [new Float32Array(Math.ceil(seconds * sr)), new Float32Array(Math.ceil(seconds * sr))];
  const who = speaker(rand);
  const base: Saying = { pitch: [], stretch: [1, 1, 1, 1], tract: who.tract, open: 0.6, breath: 0.2, level: 1, pan: 0, late: 0 };
  const speak = (f0: number): number[] => [f0 * 1.04, f0 * 1.13, f0 * 0.96, f0 * 0.86, f0 * 0.76];
  const shoutAt = (f0: number): number[] => [f0 * 1.05, f0 * 1.16, f0 * 1.02, f0 * 0.9, f0 * 0.72];
  const shouted: Partial<Saying> = { open: 0.42, breath: 0.25, stretch: [1, 1.35, 1, 1.4], level: 1.1 };
  if (delivery === 'spoken' || delivery === 'echo') say(out, sr, WORD, { ...base, pitch: speak(who.f0) }, rand, 0);
  else if (delivery === 'shout') say(out, sr, WORD, { ...base, ...shouted, pitch: shoutAt(who.f0 * 2) }, rand, 0);
  else if (delivery === 'crowd') {
    // A few people calling it together, each their own voice, a little apart.
    for (const [i, pan] of [-0.55, 0.5, 0.05].entries()) {
      const one = speaker(rand);
      say(out, sr, WORD, { ...base, ...shouted, tract: one.tract, pitch: shoutAt(one.f0 * 1.9), pan, late: i * 0.014 + rand() * 0.01, level: 0.62 }, rand, 0);
    }
  } else if (delivery === 'sung') {
    // Sung: the fifth on "lol", the note on "ly", the "ee" held with a vibrato.
    let note = opts.midi;
    if (who.f0 < 160) note -= 12;
    const lo = mtof(note + 7), ly = mtof(note);
    say(out, sr, WORD, { ...base, open: 0.55, breath: 0.18, stretch: [1, 1.6, 1, 2.6], vibrato: 28, pitch: [lo, lo, ly * 1.01, ly, ly] }, rand, 0);
  } else if (delivery === 'whisper') say(out, sr, WORD, { ...base, whisper: true, breath: 1, stretch: [1.2, 1.1, 1.2, 1.2], pitch: speak(who.f0), level: 1.4 }, rand, 0);
  else if (delivery === 'high') say(out, sr, WORD, { ...base, tract: who.tract * 1.32, pitch: speak(who.f0 * 1.9), stretch: [0.85, 0.85, 0.85, 0.9] }, rand, 0);
  else if (delivery === 'deep') say(out, sr, WORD, { ...base, tract: 0.8, open: 0.55, pitch: speak(68), stretch: [1.3, 1.35, 1.3, 1.4], level: 1.2 }, rand, 0);
  else if (delivery === 'robot') say(out, sr, WORD, { ...base, robot: true, open: 0.3, breath: 0, pitch: [who.f0, who.f0, who.f0, who.f0, who.f0] }, rand, 0);
  else {
    // The stutter: "lo-lo-lo-lolly", the first syllable on three sixteenths, then the word.
    const sixteenth = opts.beat / 4;
    const lo: readonly Phone[] = [WORD[0]!, { ...WORD[1]!, dur: Math.min(0.1, sixteenth * 0.7) }];
    for (let i = 0; i < 3; i++) say(out, sr, lo, { ...base, pitch: [who.f0 * 1.1, who.f0 * 1.1, who.f0], stretch: [0.8, 1] }, rand, i * sixteenth);
    say(out, sr, WORD, { ...base, pitch: speak(who.f0) }, rand, 3 * sixteenth);
  }
  // A comfortable peak: the voice's level is set by the player.
  let peak = 0;
  for (const ch of out) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (const ch of out) for (let i = 0; i < ch.length; i++) ch[i] = (ch[i]! / peak) * 0.8;
  return out;
}
