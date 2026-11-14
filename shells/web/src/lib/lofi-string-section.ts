// SPDX-License-Identifier: MPL-2.0
/**
 * The low bowed strings played (lib/lofi-strings-bowed.ts): the viola, the cello and the
 * double bass each as a lead, and a string section holding the keys' chords.
 *
 * A lead is one player, as the fiddle is (lib/lofi-winds.ts): each note worked out whole
 * as it comes, slurred from the note before under the same bow, slid up into when the
 * composer bends it, with the player's own vibrato on a held note. The cello plays the
 * lead's line an octave down and the double bass two, in their own singing registers.
 *
 * The section gives each chord tone to the part whose range it sits in (basses, cellos,
 * violas, and violins at the top), and each part to several players who are a few cents
 * out of tune with each other, a few milliseconds apart and each with a vibrato of their
 * own, all heard through the part's body. A section's chords repeat, so a part's chord
 * tone, once worked out, is kept for the next time the same note comes at the same
 * strength and length.
 *
 * And the double bass plucked, for the bass part's upright (pizzicato, below).
 */
import { bowSource, bowString, type BowNote } from './lofi-bowed.ts';
import { bowInstrument, bowedTail, bowedTuning, pluckBass, stringBody, type BowedString } from './lofi-strings-bowed.ts';
import { STRING_BODIES } from './lofi-string-bodies.ts';
import type { VoiceKit } from './lofi-voices.ts';

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** The leads this module plays. */
export const STRING_LEADS = new Set<string>(['viola', 'cello', 'doublebass']);
/** The keys this module plays. */
export const STRING_KEYS = new Set<string>(['strings']);

/** A small seeded source, from the station's own, so a tune's notes are the same each time. */
function seeded(k: VoiceKit): () => number {
  return mulberry(Math.floor(k.rng() * 4294967296) >>> 0);
}
function mulberry(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal draw (Box-Muller), cut at 2.5. */
function gauss(rand: () => number): number {
  const v = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  return Math.max(-2.5, Math.min(2.5, v));
}

/**
 * A modelled note brought to a steady level: how loud it is held (RMS over the part after
 * its attack), with `kept` of its own difference from `expected` (dB) left in, so the notes
 * a body favours still stand out a little, as they do on the instrument.
 */
function heldGain(data: Float32Array, sr: number, held: number, expected: number, kept: number): number {
  const a = Math.floor(Math.min(0.06, held / 3) * sr), b = Math.max(a + 32, Math.floor(Math.min(held, 0.6) * sr));
  let s = 0;
  for (let i = a; i < b && i < data.length; i++) s += data[i]! * data[i]!;
  const own = 10 * Math.log10(s / (b - a) + 1e-20);
  return 10 ** (-((1 - kept) * own + kept * expected) / 20);
}

/** A rendered note into the graph at `t`, at `level`, at the buffer's own rate. */
function playData(k: VoiceKit, data: Float32Array, rate: number, out: AudioNode, t: number, level: number, pan?: number): void {
  const { ctx } = k;
  const buf = ctx.createBuffer(1, data.length, rate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = level;
  src.connect(g);
  if (pan !== undefined && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(out);
  } else g.connect(out);
  src.start(t);
}

/** How each instrument is played as a lead (see STRING_PLAYERS' fields). */
export interface StringPlayer {
  /** Semitones the lead's line is moved, into the instrument's own register. */
  shift: number;
  /** The level against the fiddle's, and how loud the model comes out (dB: a, plus b a unit of strength over a half, plus c a semitone over `at`). */
  level: number; raw: readonly [number, number, number]; at: number;
  /** The vibrato on a note held longer than `vibratoFrom` s, `vibratoShare` of the time: its depth (cents, half its swing) softly and loudly, and its rate (Hz). */
  vibratoFrom: number; vibratoShare: number; vibratoSoft: number; vibratoLoud: number; rate: number;
}

export const STRING_PLAYERS: Record<BowedString, StringPlayer> = {
  viola: { shift: 0, level: 0.0339, raw: [-22.8, 10.6, -0.26], at: 66, vibratoFrom: 0.3, vibratoShare: 0.9, vibratoSoft: 21, vibratoLoud: 27, rate: 6.1 },
  cello: { shift: -12, level: 0.0365, raw: [-17.7, 12.3, -0.1], at: 54, vibratoFrom: 0.3, vibratoShare: 0.8, vibratoSoft: 7, vibratoLoud: 13, rate: 5.6 },
  doublebass: { shift: -24, level: 0.0384, raw: [-17, 10.9, -0.42], at: 42, vibratoFrom: 0.35, vibratoShare: 0.25, vibratoSoft: 6, vibratoLoud: 7, rate: 5.4 },
};
/** How much of a note's own loudness against the measured trend a player keeps. */
const NOTE_KEPT = 0.3;

/** A lead note on a bowed string: `art` slides up into it from a semitone under; a slur changes note under the same bow. */
export function lead(style: string, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from: number | undefined): void {
  const inst = style as BowedString;
  const p = STRING_PLAYERS[inst];
  const { ctx } = k;
  const rand = seeded(k);
  const held = Math.max(0.05, dur);
  const strength = Math.min(1, Math.max(0, vel));
  const m = midi + p.shift;
  const sings = held > p.vibratoFrom && rand() < p.vibratoShare;
  const depth = (p.vibratoSoft + (p.vibratoLoud - p.vibratoSoft) * strength) * Math.exp(0.25 * gauss(rand));
  const data = bowInstrument(inst, {
    sr: ctx.sampleRate, f: mtof(m), from: from === undefined ? undefined : mtof(from + p.shift), vel: strength, dur: held, seconds: held + bowedTail(inst),
    vibrato: sings ? depth : 0, rate: p.rate * (0.92 + 0.16 * rand()), slide: art ? 1 : 0,
  }, rand);
  const expected = p.raw[0] + p.raw[1] * (strength - 0.5) + p.raw[2] * (m - p.at);
  const level = p.level * (0.55 + 0.45 * strength) * heldGain(data, ctx.sampleRate, held, expected, NOTE_KEPT);
  if (Number.isFinite(level)) playData(k, data, ctx.sampleRate, out, t, level);
}

// ── the section ──────────────────────────────────────────────────────────────

/** A part of the section: the violins (the fiddle's string and body), or a low string. */
export type SectionPartName = 'violins' | BowedString;

/** Below these, a chord tone is the basses', the cellos', the violas'; from VIOLINS_FROM up, the violins'. */
const BASSES_TO = 45;
const CELLOS_TO = 57;
const VIOLINS_FROM = 67;
/** The part for a chord tone. */
export function partFor(midi: number): SectionPartName {
  return midi <= BASSES_TO ? 'doublebass' : midi <= CELLOS_TO ? 'cello' : midi < VIOLINS_FROM ? 'viola' : 'violins';
}

/**
 * The section's players: how many to a part, how far each strays from the note (cents,
 * standard deviation), how late (s, from 0.6 of `late` on average, never early), and their
 * vibrato (cents, half its swing, softly and loudly, each player's own by `vibratoSpread`)
 * and its rate (Hz). Measured as recorded sections are (the VSCO 2 violins, violas and
 * cellos, held): over a second, each harmonic from the 4th to the 10th spreads 9 to 11
 * cents played loud (recorded 10 to 11) and about 8 soft (recorded 8.5 to 9). Three
 * players give that width with these tunings and vibratos; a real section's mixture
 * wobbles less (its vibrato 3 to 7 cents against the model's 5 to 7), having more players.
 */
export const SECTION = {
  players: 3, spread: 5, late: 0.012, vibratoSoft: 7, vibratoLoud: 14, vibratoSpread: 0.3, rate: 5.2, rateSpread: 0.5,
  /** Each part's place across the stage (pan), and the section's level. */
  pan: { violins: -0.45, viola: 0.1, cello: 0.35, doublebass: 0.5 } as Record<SectionPartName, number>,
  level: 0.037,
  /** The section is worked out at half the context's rate (the bodies pass little above a quarter of the context's rate). */
  rateDiv: 2,
};

/** One player in a part: their own tuning (cents), lateness (s), vibrato (against the section's) and its rate (Hz). */
export interface SectionPlayer { detune: number; late: number; vibrato: number; rate: number; seed: number }

/** Draw a part's players. */
export function sectionPlayers(rand: () => number, n = SECTION.players): SectionPlayer[] {
  const out: SectionPlayer[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      detune: SECTION.spread * gauss(rand),
      late: Math.max(0, SECTION.late * (0.6 + gauss(rand))),
      vibrato: Math.exp(SECTION.vibratoSpread * gauss(rand)),
      rate: SECTION.rate + SECTION.rateSpread * gauss(rand),
      seed: Math.floor(rand() * 4294967296) >>> 0,
    });
  }
  return out;
}

/**
 * A part's chord tone, every player summed and heard through the part's body: pure, so a
 * test can measure the spread. The violins are the fiddle's string and body, a body each.
 */
export function bowSection(part: SectionPartName, sr: number, f: number, vel: number, held: number, players: readonly SectionPlayer[]): Float32Array {
  const seconds = held + 0.35 + Math.max(0, ...players.map(p => p.late));
  const mix = new Float32Array(Math.ceil(seconds * sr));
  // A section sings wider the harder it plays.
  const depth = SECTION.vibratoSoft + (SECTION.vibratoLoud - SECTION.vibratoSoft) * Math.min(1, Math.max(0, vel));
  for (const p of players) {
    const n: BowNote = { sr, f: f * 2 ** (p.detune / 1200), vel, dur: held, seconds: held + 0.35, vibrato: held > 0.3 ? depth * p.vibrato : 0, rate: p.rate, slide: 0 };
    const rand = mulberry(p.seed);
    const x = part === 'violins' ? bowString(n, rand) : bowSource(n, rand, bowedTuning(part, n.f));
    const at = Math.round(p.late * sr);
    for (let i = 0; i < x.length && i + at < mix.length; i++) mix[i + at]! += x[i]!;
  }
  return part === 'violins' ? mix : stringBody(sr, mix, STRING_BODIES[part]);
}

/** The worked-out chord tones a context keeps, by part, note, strength, length and take. */
const KEPT = new WeakMap<BaseAudioContext, Map<string, { data: Float32Array; gain: number }>>();
const KEEP_MOST = 64;
/** Two takes of every chord tone, so a chord that repeats is not the same players exactly. */
const TAKES = 2;

/**
 * The string section's chords (the keys' 'strings'): each chord tone to the part whose
 * range it is in, played by that part's players.
 */
export function keys(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const part = partFor(midi);
  const strength = Math.min(1, Math.max(0, vel));
  const held = Math.max(0.12, dur);
  const take = Math.floor(k.rng() * TAKES);
  // Lengths and strengths in steps, so a repeated chord finds what it played before.
  const heldStep = Math.min(6, Math.ceil(held / 0.25) * 0.25), velStep = Math.round(strength * 10) / 10;
  const key = `${part}|${midi}|${velStep}|${heldStep}|${take}`;
  let kept = KEPT.get(ctx);
  if (!kept) { kept = new Map(); KEPT.set(ctx, kept); }
  let note = kept.get(key);
  // Half the context's rate, but never under 22.05 kHz (the least every browser's buffers take) or the context's own.
  const rate = Math.min(ctx.sampleRate, Math.max(22050, ctx.sampleRate / SECTION.rateDiv));
  if (!note) {
    if (kept.size >= KEEP_MOST) kept.delete(kept.keys().next().value!);
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    const data = bowSection(part, rate, mtof(midi), velStep, heldStep, sectionPlayers(mulberry(h)));
    note = { data, gain: heldGain(data, rate, heldStep, 0, 0) };
    kept.set(key, note);
  }
  // The bow lifts when the note ends: a cached take may be held longer than this note.
  const end = t + held;
  const { data } = note;
  const src = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, data.length, rate);
  buf.getChannelData(0).set(data);
  src.buffer = buf;
  const g = ctx.createGain();
  const level = SECTION.level * (0.55 + 0.45 * strength) * note.gain;
  if (!Number.isFinite(level)) return;
  g.gain.setValueAtTime(level, t);
  g.gain.setTargetAtTime(0.0001, end, 0.06);
  const p = ctx.createStereoPanner();
  p.pan.value = SECTION.pan[part];
  src.connect(g).connect(p).connect(out);
  src.start(t);
  src.stop(end + 0.5);
}

// ── the plucked double bass ──────────────────────────────────────────────────

/** Plucked notes a context keeps, by note, strength and take. */
const PLUCKED = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
/** How long a plucked note is worked out for (s): the string rings on until the hand stops the note. */
const PLUCK_SECONDS = 2.4;

/**
 * The plucked double bass (the bass part's 'upright', lib/lofi-voices.ts): the string
 * plucked and heard through the bass's body (lib/lofi-strings-bowed.ts' pluckBass), at
 * `level`, stopped by the hand when the note ends. Each note is worked out at three
 * strengths, two takes each, and kept.
 */
export function pizzicato(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, level: number, dur: number, bright = 1): void {
  const { ctx } = k;
  const layer = vel < 0.45 ? 0.35 : vel < 0.7 ? 0.6 : 0.85;
  const take = k.rng() < 0.5 ? 0 : 1;
  const key = `${midi}|${layer}|${take}`;
  let kept = PLUCKED.get(ctx);
  if (!kept) { kept = new Map(); PLUCKED.set(ctx, kept); }
  let buf = kept.get(key);
  if (!buf) {
    if (kept.size >= 300) kept.clear();
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    const data = pluckBass({ sr: ctx.sampleRate, f: mtof(midi), vel: layer, seconds: PLUCK_SECONDS }, mulberry(h));
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    kept.set(key, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.detune.value = (k.rng() - 0.5) * 6;
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = Math.min(ctx.sampleRate * 0.45, 5000 * bright);
  top.Q.value = 0.5;
  const amp = ctx.createGain();
  const end = t + Math.max(0.08, dur);
  amp.gain.setValueAtTime(level, t);
  amp.gain.setTargetAtTime(0.0001, end, 0.05);
  src.connect(top).connect(amp).connect(out);
  src.start(t);
  src.stop(end + 0.4);
}
