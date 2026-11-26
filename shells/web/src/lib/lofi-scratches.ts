// SPDX-License-Identifier: MPL-2.0
/**
 * Scratches, played: the station's `scratch` notes (engine/src/lofi-scratch.ts) and the
 * Turntable lead, on the turntable of lib/lofi-turntable.ts.
 *
 * WHAT IS ON THE RECORD is always Lolly's own sound, made once per tune and context: a
 * vowel the chop voice sings (lib/lofi-chop.ts: "ah", "hey", "yeah" or "da", the tune's own
 * singer), a trumpet stab blown by the brass model (lib/lofi-brass.ts), the tune's own
 * chopped break from its first backbeat (lib/lofi-break-kit.ts), or a bass note (a sine and
 * a filtered saw). Each is pressed onto the record with a groove's soft surface noise under
 * it, so the noise moves and stops with the hand. A pitched source is heard at the note's
 * pitch when the record turns at its own speed: a scratch's sweep is around the tune's key.
 *
 * THE TURNTABLE LEAD plays the melody's rhythm as scratches: a short note a stab, a longer
 * one a chirp, a flare, a baby scratch, a long one a transformer, sixteenth strokes at the
 * tune's tempo, on the source the tune draws.
 *
 * Each scratch is worked out once into a buffer (a few milliseconds) and kept for the tune,
 * so a hook that comes round again plays from what was already made.
 */
import { readScratch, scratchSource, type ScratchKind, type ScratchSource } from '../../../../engine/src/lofi-scratch.ts';
import { chopsOf } from '../../../../engine/src/lofi-break-chop.ts';
import type { LofiBar, LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';
import { chopVocal, singChop } from './lofi-chop.ts';
import { blowLips } from './lofi-brass.ts';
import { breakRecording } from './lofi-break-kit.ts';
import { handMotion, turntable } from './lofi-turntable.ts';
import type { VoiceKit } from './lofi-voices.ts';

/** Each source's home pitch (the note it is made at) and its level once scratched, against the others. */
const HOME: Record<ScratchSource, { midi: number; level: number }> = {
  voice: { midi: 67, level: 1 }, horn: { midi: 70, level: 0.8 }, break: { midi: 0, level: 0.75 }, bass: { midi: 40, level: 1.1 },
};
/** The scratches' level on the effects lane: set so a scratch reads clearly yet sits under the hook (docs/generated-music.md). */
export const SCRATCH_LEVEL = 0.19;
/** A rewind holds the record at speed for longer than any other scratch, so it plays this much lower to sit under the hook too. */
const REWIND_LEVEL = 0.6;
/** Every record's sound brought to this RMS where the hand works it, so no source scratches louder than another. */
const RECORD_RMS = 0.12;
/** The groove's surface noise pressed under the sound (dB under its peak). */
const SURFACE = 44;
/** The chop voice's syllables a record carries ("ah", "hey", "yeah", "da"), by their place in lib/lofi-chop.ts SYLLABLES. */
const SYLLABLES = [0, 6, 7, 10] as const;

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** One tune's records and scratches on one context. */
interface Deck { records: Map<ScratchSource, { data: Float32Array; from: number } | null>; cuts: Map<string, AudioBuffer> }
const DECKS = new WeakMap<BaseAudioContext, Map<string, Deck>>();
function deckOf(ctx: BaseAudioContext, tune: LofiTuneInfo): Deck {
  let byTune = DECKS.get(ctx);
  if (!byTune) { byTune = new Map(); DECKS.set(ctx, byTune); }
  const key = `${tune.mood}:${tune.seed}:${tune.bpm}`;
  let deck = byTune.get(key);
  if (!deck) {
    if (byTune.size > 6) byTune.clear();
    deck = { records: new Map(), cuts: new Map() };
    byTune.set(key, deck);
  }
  return deck;
}

/** The groove's soft noise pressed under a source, from its own seed, and a little silence before it so the hand has somewhere to start. */
function press(x: Float32Array, sr: number, seed: number): { data: Float32Array; from: number } {
  const lead = Math.round(0.03 * sr);
  const out = new Float32Array(x.length + lead + Math.round(0.4 * sr));
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  out.set(x, lead);
  const r = mulberry32((seed ^ 0x9e0a7e) >>> 0);
  const floor = peak * 10 ** (-SURFACE / 20);
  let p0 = 0, p1 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = r() * 2 - 1;
    p0 = 0.99 * p0 + w * 0.06; p1 = 0.9 * p1 + w * 0.25;
    out[i] = out[i]! + (p0 + p1 + w * 0.1) * floor;
  }
  return { data: out, from: (lead - Math.round(0.004 * sr)) / sr };
}

/** A tune's record of `source`, made once: null for a break when the tune chops none. */
function record(ctx: BaseAudioContext, tune: LofiTuneInfo, source: ScratchSource): { data: Float32Array; from: number } | null {
  const deck = deckOf(ctx, tune);
  if (deck.records.has(source)) return deck.records.get(source)!;
  const sr = ctx.sampleRate;
  const r = mulberry32((tune.seed ^ 0x7ab1e) >>> 0);
  let made: { data: Float32Array; from: number } | null = null;
  if (source === 'voice') {
    const syllable = SYLLABLES[Math.floor(r() * SYLLABLES.length)]!;
    const [L, R] = singChop(sr, { syllable, midi: HOME.voice.midi, dur: 0.9, vel: 0.9, gesture: 0, amount: 0, beat: 60 / tune.bpm, vocal: chopVocal(tune.seed), take: 0.5 }, tune.seed);
    const mono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) mono[i] = (L[i]! + R[i]!) / 2;
    made = press(mono, sr, tune.seed);
  } else if (source === 'horn') {
    made = press(blowLips({ sr, f: mtof(HOME.horn.midi), vel: 0.9, dur: 0.45, seconds: 0.6, horn: 'trumpet', scoop: 0, fall: 0, vibrato: 0, rate: 5 }, r), sr, tune.seed);
  } else if (source === 'bass') {
    // A bass note: a sine and a saw through a closing low-pass, plucked and held.
    const n = Math.round(0.8 * sr), out = new Float32Array(n), f = mtof(HOME.bass.midi);
    let lp = 0, ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += f / sr;
      const saw = 2 * (ph % 1) - 1;
      const cut = 1 - Math.exp((-2 * Math.PI * (300 + 1500 * Math.exp(-t / 0.08))) / sr);
      lp += cut * (saw - lp);
      out[i] = (0.6 * Math.sin(2 * Math.PI * ph) + 0.4 * lp) * Math.min(1, t / 0.004) * Math.exp(-t / 0.9);
    }
    made = press(out, sr, tune.seed);
  } else {
    const brk = breakRecording(ctx, tune);
    if (brk) made = { data: brk.data, from: Math.max(0, brk.snare - 0.004) };
  }
  deck.records.set(source, made);
  return made;
}

/** The records still to make, per context, and the tunes already looked at. */
const PENDING = new WeakMap<BaseAudioContext, Array<() => void>>();
const SEEN = new WeakMap<BaseAudioContext, Set<string>>();
/**
 * Make a tune's records ahead of its first scratch (the station calls this for every bar it
 * queues): the record its composer's scratches use, and the Turntable lead's when the bar
 * plays the Turntable. Each is made by a later warm(), one a tick.
 */
export function prepare(ctx: BaseAudioContext, bar: LofiBar): void {
  const tune = bar.tune;
  const turntable = (bar.voices?.lead ?? tune.style.lead) === 'turntable';
  const key = `${tune.mood}:${tune.seed}:${tune.bpm}:${turntable ? 1 : 0}`;
  let seen = SEEN.get(ctx);
  if (!seen) { seen = new Set(); SEEN.set(ctx, seen); }
  if (seen.has(key)) return;
  if (seen.size > 32) seen.clear();
  seen.add(key);
  const wants = new Set<ScratchSource>();
  const own = scratchSource(tune.seed, tune.mood, chopsOf(tune.mood, tune.seed, tune.bpm) !== null);
  if (own) wants.add(own);
  if (turntable) wants.add(leadSource(tune));
  if (!wants.size) return;
  let jobs = PENDING.get(ctx);
  if (!jobs) { jobs = []; PENDING.set(ctx, jobs); }
  for (const source of wants) jobs.push(() => { record(ctx, tune, source); });
}
/** Make the next record waiting on `ctx` (the station calls this every tick); false when none waits. */
export function warm(ctx: BaseAudioContext): boolean {
  const job = PENDING.get(ctx)?.shift();
  job?.();
  return job !== undefined;
}

/** A scratch worked out once: its kind, source, pitch, length and stroke at this tune's tempo. */
function cut(ctx: BaseAudioContext, tune: LofiTuneInfo, kind: ScratchKind, source: ScratchSource, midi: number, seconds: number, stroke: number): AudioBuffer | null {
  const deck = deckOf(ctx, tune);
  const rec = record(ctx, tune, source) ?? record(ctx, tune, 'voice');
  if (!rec) return null;
  const pitched = source !== 'break' && midi > 0;
  const base = pitched ? Math.max(0.5, Math.min(2, 2 ** ((midi - HOME[source].midi) / 12))) : 1;
  const key = `${kind}|${source}|${pitched ? midi : 0}|${Math.round(seconds * 1000)}|${Math.round(stroke * 1000)}`;
  let buf = deck.cuts.get(key);
  if (!buf) {
    const sr = ctx.sampleRate;
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    const motion = handMotion(kind, seconds, stroke, sr, mulberry32((h ^ tune.seed) >>> 0));
    // A rewind or a backspin pulls the record a long way back, through the sound again and again.
    let back = 0;
    for (const v of motion.speed) back -= Math.min(0, v);
    const on = kind === 'rewind' || kind === 'backspin' ? reel(rec, sr, (back * base) / sr) : rec;
    const data = turntable(on.data, sr, on.from, motion, base, sr);
    // The sound where the hand works it, brought to RECORD_RMS.
    let e = 0;
    const a = Math.round(rec.from * sr), z = Math.min(rec.data.length, a + Math.round(0.3 * sr));
    for (let i = a; i < z; i++) e += rec.data[i]! * rec.data[i]!;
    const gain = RECORD_RMS / Math.max(1e-6, Math.sqrt(e / Math.max(1, z - a)));
    for (let i = 0; i < data.length; i++) data[i] = data[i]! * gain;
    buf = ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    if (deck.cuts.size > 96) deck.cuts.clear();
    deck.cuts.set(key, buf);
  }
  return buf;
}

/**
 * The record behind a rewind or a backspin: the sound repeated, as a looped record carries
 * it, so `back` seconds of pulling back keep finding sound; the hand starts on the last.
 */
function reel(rec: { data: Float32Array; from: number }, sr: number, back: number): { data: Float32Array; from: number } {
  const a = Math.round(rec.from * sr);
  const seg = rec.data.subarray(a);
  const reps = Math.max(1, Math.ceil((back * sr) / Math.max(1, seg.length)));
  const out = new Float32Array(a + seg.length * (reps + 1));
  out.set(rec.data.subarray(0, a));
  for (let k = 0; k <= reps; k++) out.set(seg, a + k * seg.length);
  return { data: out, from: (a + reps * seg.length) / sr };
}

/** Play a buffer at `t`, at `level`, into `out`. */
function spin(k: VoiceKit, out: AudioNode, buf: AudioBuffer, t: number, level: number): void {
  const src = k.ctx.createBufferSource();
  src.buffer = buf;
  const g = k.ctx.createGain();
  g.gain.value = level;
  src.connect(g).connect(out);
  src.start(t);
}

/** A `scratch` note: its scratch on its source, `len` seconds of the hand at `rate` strokes a beat. */
export function playScratch(k: VoiceKit, out: AudioNode, bar: LofiBar, t: number, midi: number, vel: number, len: number, mod: number): void {
  const s = readScratch(mod);
  const spb = 60 / bar.tune.bpm;
  const buf = cut(k.ctx, bar.tune, s.kind, s.source, midi, Math.max(0.06, len), spb / s.rate);
  if (buf) spin(k, out, buf, t, vel * SCRATCH_LEVEL * HOME[s.source].level * (s.kind === 'rewind' ? REWIND_LEVEL : 1));
}

/** The source a tune's Turntable lead scratches, drawn from its seed: mostly the voice, now and then the horn or the bass. */
export function leadSource(tune: LofiTuneInfo): ScratchSource {
  const x = mulberry32((tune.seed ^ 0x7e7a61e) >>> 0)();
  return x < 0.55 ? 'voice' : x < 0.85 ? 'horn' : 'bass';
}
/** The scratch a melody note becomes, by how long it is (beats). */
export function leadScratch(beats: number): ScratchKind {
  return beats <= 0.15 ? 'stab' : beats <= 0.3 ? 'chirp' : beats <= 0.6 ? 'flare' : beats <= 1.25 ? 'baby' : 'transformer';
}

/** A Turntable lead note: the melody's note scratched, at its pitch, sixteenth strokes at the tune's tempo. */
export function playTurntable(k: VoiceKit, out: AudioNode, bar: LofiBar, t: number, midi: number, vel: number, len: number): void {
  const spb = 60 / bar.tune.bpm;
  const source = leadSource(bar.tune);
  // A melody sits higher than a scratch's home: the voice and the horn an octave down where the note is high.
  const at = source === 'bass' ? midi - 24 : midi > HOME[source].midi + 7 ? midi - 12 : midi;
  const buf = cut(k.ctx, bar.tune, leadScratch(len / spb), source, at, Math.max(0.06, len), spb / 4);
  if (buf) spin(k, out, buf, t, vel * HOME[source].level);
}
