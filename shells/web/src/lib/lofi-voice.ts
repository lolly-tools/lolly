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
 * The same voice shouts the band's phrases (sayShout): "pick it up", "let's go" and "go",
 * their consonants as well as their vowels.
 *
 * Pure: no DOM, no Web Audio; deterministic for the same delivery, settings and seed.
 */

import { LOFI_TAGS, lofiShoutStep } from '../../../../engine/src/lofi-compose.ts';

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

// ── The band's shouts ─────────────────────────────────────────────────────

/** The band's shouted phrases, in the order of LOFI_SHOUTS from LOFI_SHOUT_PHRASES on. */
export const SHOUT_PHRASES = ['pickitup', 'letsgo', 'go'] as const;
export type ShoutPhrase = typeof SHOUT_PHRASES[number];

type Quad = readonly [number, number, number, number];
/**
 * A sound of a shouted phrase. Its formants, as a vowel's, and what sounds through them:
 * the voice, breath (the h after a p), a hiss with a resonance of its own (an s), or a
 * stop's release, a click of noise at `nf` as the closure opens. A sound with none of
 * these is a closure: the silence of the lips or tongue shut before a p, k, t or g.
 */
interface Sound {
  f: Quad; bw: Quad; dur: number;
  voice?: number; asp?: number; fric?: number; burst?: number;
  /** The hiss's or the click's centre and width (Hz). */
  nf?: number; nbw?: number;
  /** How long before this sound the formants start moving to it, and how long after its start they arrive (s). */
  pre?: number; glide?: number;
}
/**
 * A syllable: the consonants before its vowel, the vowel (whose length keeps the beat), the
 * consonants after, and the vowel's pitch (times the note). A short vowel has a `longest`:
 * past it, the closure after it waits instead, as a chant clips its short syllables.
 */
interface Syllable { onset: readonly Sound[]; vowel: Sound; coda: readonly Sound[]; pitch: number; longest?: number }
/** A phrase: its syllables, the one that falls on the note's beat, how long its last vowel is held and how far its pitch falls at the end. */
interface Phrase { syllables: readonly Syllable[]; anchor: number; hold: number; fall: number }

// A man's formants, shouted: the mouth opens wider than in speech, so the first formant is higher.
const IH: Quad = [440, 1900, 2550, 3500];   // the i of "pick" and "it"
const UH: Quad = [720, 1220, 2500, 3450];   // the u of "up"
const EH: Quad = [630, 1780, 2520, 3500];   // the e of "let's"
const OH: Quad = [570, 920, 2450, 3400];    // "go", opening
const OO: Quad = [430, 820, 2350, 3350];    // and closing towards oo
const LL: Quad = [360, 1100, 2700, 3500];   // the l of "let's"
// Where each closure takes the formants: the lips (p), the soft palate before i and before o (k, g), the ridge behind the teeth (t, s).
const LIPS: Quad = [250, 850, 2200, 3300];
const VELUM_FRONT: Quad = [280, 2250, 2650, 3550];
const VELUM_BACK: Quad = [280, 1300, 2150, 3300];
const RIDGE: Quad = [280, 1750, 2650, 3550];
const BW: Quad = [75, 95, 140, 220];        // a vowel's bandwidths
const BW_OPEN: Quad = [400, 220, 280, 340]; // breath's, wider, the first most: the glottis is open
const BW_SHUT: Quad = [120, 400, 500, 600]; // a voiced closure's: only the low hum gets out

const PHRASES: Record<ShoutPhrase, Phrase> = {
  // p-i-k-i-t-u-p: the p and the k breathed (aspirated), the t short, the last p released with a puff.
  pickitup: {
    anchor: 0, hold: 0.17, fall: 0.8,
    syllables: [
      { pitch: 1, longest: 0.11, onset: [{ f: LIPS, bw: BW, dur: 0.012, burst: 0.8, nf: 800, nbw: 2000 }, { f: IH, bw: BW_OPEN, dur: 0.065, asp: 1, glide: 0.07 }],
        vowel: { f: IH, bw: BW, dur: 0, voice: 1, glide: 0.02 }, coda: [{ f: VELUM_FRONT, bw: BW, dur: 0.045, pre: 0.035 }] },
      { pitch: 0.92, longest: 0.1, onset: [{ f: VELUM_FRONT, bw: BW, dur: 0.012, burst: 0.9, nf: 2800, nbw: 900 }, { f: IH, bw: BW_OPEN, dur: 0.025, asp: 0.6, glide: 0.03 }],
        vowel: { f: IH, bw: BW, dur: 0, voice: 1, glide: 0.02 }, coda: [{ f: RIDGE, bw: BW, dur: 0.035, pre: 0.03 }] },
      { pitch: 1.08, onset: [{ f: RIDGE, bw: BW, dur: 0.01, burst: 0.7, nf: 4300, nbw: 2200 }, { f: UH, bw: BW_OPEN, dur: 0.012, asp: 0.4, glide: 0.035 }],
        vowel: { f: UH, bw: BW, dur: 0, voice: 1, glide: 0.035 },
        coda: [{ f: LIPS, bw: BW, dur: 0.05, pre: 0.04 }, { f: UH, bw: BW_OPEN, dur: 0.05, burst: 0.3, nf: 900, nbw: 1500, asp: 0.35 }] },
    ],
  },
  // l-e-t-s-g-o: the l a dip in the voice, the t closing into the s's hiss, the g's closure humming, and "go" sliding to oo.
  letsgo: {
    anchor: 1, hold: 0.26, fall: 0.74,
    syllables: [
      { pitch: 0.89, onset: [{ f: LL, bw: BW, dur: 0.06, voice: 0.55 }], vowel: { f: EH, bw: BW, dur: 0, voice: 1, glide: 0.04 },
        coda: [{ f: RIDGE, bw: BW, dur: 0.03, pre: 0.03 }, { f: RIDGE, bw: BW, dur: 0.008, burst: 0.5, nf: 4500, nbw: 2500 }, { f: RIDGE, bw: BW, dur: 0.08, fric: 0.6, nf: 6200, nbw: 3500 }] },
      goSyllable(),
    ],
  },
  go: { anchor: 0, hold: 0.3, fall: 0.72, syllables: [goSyllable()] },
};
/** "Go": the g's closure humming, its click at the soft palate, then the vowel opening and closing towards oo. */
function goSyllable(): Syllable {
  return {
    pitch: 1.06,
    onset: [{ f: [200, 1300, 2150, 3300], bw: BW_SHUT, dur: 0.03, voice: 0.12 }, { f: VELUM_BACK, bw: BW, dur: 0.018, burst: 1.2, nf: 1600, nbw: 600, voice: 0.2 }, { f: OH, bw: BW_OPEN, dur: 0.012, voice: 0.6, asp: 0.3, glide: 0.04 }],
    vowel: { f: OH, bw: BW, dur: 0, voice: 1, glide: 0.05 },
    coda: [{ f: OO, bw: BW, dur: 0.13, voice: 1, glide: 0.12, pre: 0 }],
  };
}

/** One voice shouting: its pitch at the stressed vowel (Hz), its vocal tract, how pressed the voice is, a rasp, timing, place and level. */
interface Shouter { f0: number; tract: number; open: number; rasp: number; stretch: number; level: number; pan: number; late: number }

/** A formant resonator in Klatt's form, as Resonator, its frequency and bandwidth set every few samples rather than each one. */
class Formant {
  private y1 = 0; private y2 = 0;
  private a = 0; private b = 0; private c = 0;
  set(f: number, bw: number, sr: number): void {
    this.c = -Math.exp((-2 * Math.PI * bw) / sr);
    this.b = 2 * Math.exp((-Math.PI * bw) / sr) * Math.cos((2 * Math.PI * f) / sr);
    this.a = 1 - this.b - this.c;
  }
  run(x: number): number {
    const y = this.a * x + this.b * this.y1 + this.c * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** A band-pass filter of constant peak gain (the audio EQ cookbook's), for the noise of a hiss or a click. */
class BandPass {
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  private b0 = 0; private a1 = 0; private a2 = 0;
  set(f: number, bw: number, sr: number): void {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr, q = f / Math.max(1, bw), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
    this.b0 = alpha / a0; this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - alpha) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x - this.b0 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Lay a phrase's sounds out in time: each syllable's vowel starts `step` seconds after the
 * last one's, so the phrase keeps the tune's beat, its consonants fitted in between; the
 * last vowel is held. Returns the sounds, when each starts, and when the anchor's vowel starts.
 */
function layOut(ph: Phrase, step: number, v: Shouter, hold: number): { sounds: Sound[]; starts: number[]; anchor: number; pitches: Array<[number, number]> } {
  const sounds: Sound[] = [], starts: number[] = [], pitches: Array<[number, number]> = [];
  const length = (list: readonly Sound[]): number => list.reduce((sum, x) => sum + x.dur * v.stretch, 0);
  let t = 0.03, anchor = 0;
  ph.syllables.forEach((syl, i) => {
    for (const x of syl.onset) { sounds.push(x); starts.push(t); t += x.dur * v.stretch; }
    const next = ph.syllables[i + 1];
    const room = next ? Math.max(0.04, step - length(syl.coda) - length(next.onset)) : hold;
    const vowel = Math.min(room, syl.longest ?? room);
    if (i === ph.anchor) anchor = t;
    // A shouted syllable's pitch climbs to its height and, on the last, falls away.
    pitches.push([t, syl.pitch * 0.94], [t + vowel * 0.35, syl.pitch]);
    sounds.push({ ...syl.vowel, dur: vowel / v.stretch });
    starts.push(t);
    t += vowel;
    let wait = room - vowel;
    for (const x of syl.coda) {
      sounds.push(x); starts.push(t); t += x.dur * v.stretch;
      if (wait > 0 && !x.voice && !x.asp && !x.fric && !x.burst) { t += wait; wait = 0; }
    }
  });
  pitches.push([t, ph.syllables[ph.syllables.length - 1]!.pitch * ph.fall]);
  starts.push(t);
  return { sounds, starts, anchor, pitches };
}

/** Render one voice shouting the laid-out phrase into `out`, its anchor at `at` seconds. */
function shoutInto(out: [Float32Array, Float32Array], sr: number, plan: ReturnType<typeof layOut>, v: Shouter, rand: () => number, at: number): void {
  const { sounds, starts, pitches } = plan;
  const end = starts[starts.length - 1]!;
  const offset = at - plan.anchor + v.late;
  const first = Math.max(0, Math.round(offset * sr));
  const n = Math.min(out[0].length - first, Math.ceil((end + 0.05) * sr));
  const res = [new Formant(), new Formant(), new Formant(), new Formant()];
  const hiss = new BandPass(), click = new BandPass();
  const left = Math.sqrt((1 - v.pan) / 2), right = Math.sqrt((1 + v.pan) / 2);
  let phase = 1, period = 0, strength = 1, tilt = 0, odd = false, k = 0, clickAt = -1, clickLevel = 0, lastNoise = 0, settled = 0;
  let voice = 0, asp = 0, fric = 0, p = 1;
  const f = [0, 0, 0, 0], bw = [0, 0, 0, 0];
  // Each boundary's window: how long before it the formants start to move, and how long after it they arrive.
  const pre = sounds.map(x => (x.pre ?? 0.01) * v.stretch), glide = sounds.map(x => Math.max(0.006, (x.glide ?? 0.03) * v.stretch));
  for (let i = 0; i < n; i++) {
    const t = i / sr + Math.max(0, -offset);
    while (k < sounds.length - 1 && t >= starts[k + 1]!) k++;
    // Past a boundary's window everything has arrived at that sound, so the easing starts there.
    while (settled < sounds.length - 1 && t >= starts[settled + 1]! + glide[settled + 1]!) settled++;
    const cur = sounds[k]!;
    if (cur.burst && clickAt !== starts[k]) { clickAt = starts[k]!; clickLevel = cur.burst; click.set(cur.nf ?? 2000, cur.nbw ?? 1000, sr); }
    if (cur.fric && i % 64 === 0) hiss.set(cur.nf ?? 5000, cur.nbw ?? 2500, sr);
    // The controls move slowly, so they are worked out every eighth sample: the formants
    // travel from sound to sound, each boundary easing them over its own window.
    if (i % 8 === 0) {
      const base = sounds[settled]!;
      for (let j = 0; j < 4; j++) { f[j] = base.f[j]!; bw[j] = base.bw[j]!; }
      voice = base.voice ?? 0; asp = base.asp ?? 0; fric = base.fric ?? 0;
      for (let s = settled + 1; s < sounds.length; s++) {
        const b = starts[s]!, x = sounds[s]!;
        if (t < b - 0.05) break;
        const u = ease(Math.min(1, Math.max(0, (t - (b - pre[s]!)) / Math.max(1e-3, pre[s]! + glide[s]!))));
        for (let j = 0; j < 4; j++) { f[j] = f[j]! + (x.f[j]! - f[j]!) * u; bw[j] = bw[j]! + (x.bw[j]! - bw[j]!) * u; }
        const w = Math.min(1, Math.max(0, (t - b + 0.003) / 0.009));
        voice += ((x.voice ?? 0) - voice) * w; asp += ((x.asp ?? 0) - asp) * w; fric += ((x.fric ?? 0) - fric) * w;
      }
      for (let j = 0; j < 4; j++) res[j]!.set(Math.min(f[j]! * v.tract, sr * 0.45), bw[j]!, sr);
      // The pitch through the phrase.
      p = pitches[0]![1];
      for (let s = 1; s < pitches.length; s++) {
        const [ta, pa] = pitches[s - 1]!, [tb, pb] = pitches[s]!;
        if (t >= ta) p = t >= tb ? pb : pa + (pb - pa) * ((t - ta) / Math.max(1e-3, tb - ta));
      }
    }
    // The voice's own wobble from period to period, and the rasp.
    const f0 = v.f0 * p;
    phase += 1 / Math.max(1, period);
    if (phase >= 1) {
      phase -= 1;
      odd = !odd;
      period = (sr / f0) * (1 + (rand() - 0.5) * 0.016);
      strength = (1 + (rand() - 0.5) * 0.1) * (odd ? 1 + v.rasp : 1 - v.rasp);
    }
    const x = phase / v.open;
    const pulse = x < 1 ? (2 * x - 3 * x * x) * strength : 0;
    tilt += (0.35 + (1 - v.open) * 0.6) * (pulse - tilt);
    const noise = rand() * 2 - 1;
    // Breath rides each opening of the glottis while the voice sounds; aspiration is breath
    // alone, turbulence that is brighter than the voice, so its noise is tilted up.
    const breath = noise - lastNoise * 0.6;
    lastNoise = noise;
    let y = tilt * voice + breath * (asp * 0.7 + voice * 0.05 * (x < 1 ? 1 : 0.3));
    for (let j = 0; j < 4; j++) y = res[j]!.run(y);
    const since = t - clickAt;
    const pop = clickAt >= 0 && since >= 0 && since < 0.03 ? click.run(noise) * clickLevel * Math.exp(-since / 0.005) * 4 : 0;
    const s = fric > 0.001 ? hiss.run(rand() * 2 - 1) * fric * 3.2 : 0;
    const env = Math.min(1, t / 0.004) * Math.min(1, Math.max(0, (end - t) / 0.07));
    const out1 = (y + pop + s) * env * v.level;
    out[0][first + i] = out[0][first + i]! + out1 * left;
    out[1][first + i] = out[1][first + i]! + out1 * right;
  }
}

/** The octave of `midi` nearest a register (Hz). */
function nearest(midi: number, hz: number): number {
  const target = 69 + 12 * Math.log2(hz / 440);
  return [midi - 24, midi - 12, midi, midi + 12].reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
}

/** A voice for the shouts: a man's or a woman's, its stressed vowel on the note in that voice's shouting register. */
function shouter(rand: () => number, midi: number): Shouter {
  const who = speaker(rand);
  const woman = who.f0 > 160;
  return { f0: mtof(nearest(midi, woman ? 400 : 235)), tract: who.tract, open: 0.42, rasp: 0.04 + rand() * 0.12, stretch: 1, level: 1, pan: 0, late: 0 };
}

/**
 * A band's shouted phrase: "pick it up", "let's go" or "go", called by one voice or by a
 * crowd of four. `midi` is the note the stressed vowel is pitched to (the chord's root), in
 * each voice's own register; `beat` is the tune's beat (s), which the syllables keep.
 * `voice` draws the caller, the same one all through a tune; `take` draws this use's
 * small differences (timing, pitch, how hard it is shouted), so no two calls are
 * identical. Returns stereo, and `at`: the moment, in seconds, the stressed vowel starts,
 * which the player puts on the beat.
 */
export function sayShout(sr: number, phrase: ShoutPhrase, opts: { midi: number; beat: number; crowd: boolean }, voice: () => number, take: () => number): { audio: [Float32Array, Float32Array]; at: number } {
  const ph = PHRASES[phrase];
  const step = phrase === 'go' ? 0 : lofiShoutStep(phrase, opts.beat);
  const caller = shouter(voice, opts.midi);
  const people = opts.crowd ? [caller, shouter(voice, opts.midi), shouter(voice, opts.midi), shouter(voice, opts.midi)] : [caller];
  const pans = opts.crowd ? [-0.2, -0.7, 0.7, 0.35] : [(take() - 0.5) * 0.3];
  const seconds = 0.1 + step * ph.anchor + 0.04 + step * (ph.syllables.length - 1) + ph.hold * 1.2 + 0.5;
  const audio: [Float32Array, Float32Array] = [new Float32Array(Math.ceil(seconds * sr)), new Float32Array(Math.ceil(seconds * sr))];
  const at = 0.12 + step * ph.anchor;
  people.forEach((one, i) => {
    // This call's differences: a little quicker or slower, a few cents off the note, pressed harder or softer.
    const v: Shouter = {
      ...one,
      f0: one.f0 * 2 ** (((take() - 0.5) * (opts.crowd ? 60 : 40)) / 1200),
      tract: one.tract * (0.98 + take() * 0.04),
      open: one.open + (take() - 0.5) * 0.08,
      stretch: 0.94 + take() * 0.12,
      pan: pans[i] ?? 0,
      late: opts.crowd ? i * 0.004 + take() * 0.008 : 0,
      // The caller leads the crowd, a little louder, so the consonants come through the voices' blur.
      level: opts.crowd ? (i === 0 ? 0.85 : 0.5) : 1,
    };
    const plan = layOut(ph, step, v, ph.hold * (0.9 + take() * 0.25));
    shoutInto(audio, sr, plan, v, take, at);
  });
  // A comfortable peak: the shout's level is set by the player.
  let peak = 0;
  for (const ch of audio) for (const x of ch) peak = Math.max(peak, Math.abs(x));
  if (peak > 0) for (const ch of audio) for (let i = 0; i < ch.length; i++) ch[i] = (ch[i]! / peak) * 0.8;
  return { audio, at };
}
