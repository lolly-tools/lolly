// SPDX-License-Identifier: MPL-2.0
/**
 * Vocal chops: a sung phrase cut into slices and played as an instrument, the way a
 * producer chops a vocal. Synthesised, never recorded: each slice is sung by the formant
 * voice of ./lofi-voice.ts (a glottal pulse and breath through a cascade of vocal-tract
 * resonators, after Klatt), in one of four voices measured from real singing
 * (./lofi-chop-voices.ts): a woman's, a man's, a baritone's or a child's. Who sings is cast
 * by engine/src/lofi-chop-cast.ts: one voice, a woman sped up a little as chops usually
 * are, a baritone under her, a children's choir or a mixed group.
 *
 * Each tune draws its own vocal from its seed: a singer (how long the vocal tract is, how
 * breathy, the vibrato) and a handful of syllables sung ("oh", "la", "da", "yeah"…), the
 * slices of the sample. Each pitch is mapped to one slice, as a sampler maps a slice to a
 * key, so a melody that comes round again sings the same syllables; now and then the next
 * slice of the sample plays instead, as a producer playing through the pads.
 *
 * The chopper (chopper(), called by lib/lofi-perform.ts) decides how each note is played,
 * from the tune and the bar, so a tune plays the same every time: a short scoop up into a
 * note, a slide from the note before, an octave flip (the slice repitched, its formants
 * moving with it), a fall off a phrase's last note, a held note gated into sixteenths, a
 * stutter on a note's consonant before it opens, and now and then the vowel reversed,
 * swelling into a phrase. It moves each note a few milliseconds off the grid and gives
 * each its own take (a little sharper or flatter, the vowel a little brighter or darker).
 * How hard a note is sung changes its sound as well as its level: louder is a pressed,
 * brighter voice with the jaw open wider (a higher first formant), softer is breathier
 * and darker.
 *
 * Pure but for chop(), which plays a slice on a Web Audio context: the slices are sung
 * into buffers, each once per context.
 */
import { BandPass, Formant, ease } from './lofi-voice.ts';
import { LEAD_OWN } from './lofi-lead-art.ts';
import type { VoiceKit } from './lofi-voices.ts';
import { CHOP_GESTURES, CHOP_VOICE, LEGACY_VOICE, WOMAN, upperShare, type ChopVoiceSpec, type Vowel } from './lofi-chop-voices.ts';
import type { LofiBar, LofiNote } from '../../../../engine/src/lofi-compose.ts';
import { arnhemChops } from '../../../../engine/src/lofi-arnhem.ts';
import { chopCast, isChopLead, type ChopLead, type ChopSinger, type ChopVoice } from '../../../../engine/src/lofi-chop-cast.ts';

type Quad = readonly [number, number, number, number];

// ── the syllables ───────────────────────────────────────────────────────────

/**
 * How a syllable starts: the formants of the consonant (Hz), how long it lasts (s), how
 * much it is voiced, how long the formants take to reach the vowel (s), and its noise: a
 * breathed h, or a stop's click as it opens (centre and width, Hz). A nasal is a quiet,
 * dull murmur, its bands wide.
 */
interface Onset { f: Quad; dur: number; voice: number; glide: number; asp?: number; burst?: { f: number; bw: number; level: number }; nasal?: boolean; vowelShape?: boolean }
const ONSETS = {
  l: { f: [380, 1150, 2750, 3900], dur: 0.055, voice: 0.55, glide: 0.05 },
  y: { f: [310, 2550, 3250, 4200], dur: 0.05, voice: 0.75, glide: 0.075 },
  w: { f: [330, 780, 2500, 3800], dur: 0.05, voice: 0.65, glide: 0.075 },
  m: { f: [270, 1100, 2350, 3700], dur: 0.06, voice: 0.6, glide: 0.035, nasal: true },
  n: { f: [270, 1750, 2650, 3800], dur: 0.055, voice: 0.6, glide: 0.035, nasal: true },
  d: { f: [260, 1800, 2750, 3900], dur: 0.028, voice: 0.12, glide: 0.04, burst: { f: 3600, bw: 2600, level: 0.5 } },
  b: { f: [260, 950, 2300, 3700], dur: 0.028, voice: 0.12, glide: 0.04, burst: { f: 1100, bw: 1500, level: 0.4 } },
  h: { f: WOMAN.ah, dur: 0.06, voice: 0, glide: 0.01, asp: 0.9, vowelShape: true },
} as const satisfies Record<string, Onset>;

/** A slice of the sample: its consonant (if any), its vowel, and the vowel it glides to as it ends (a diphthong). */
interface Syllable { onset?: keyof typeof ONSETS; vowel: Vowel; to?: Vowel }
/** Every syllable a tune's vocal can hold. A chop's `mod` gives a syllable's place in this list. */
const SYLLABLES: readonly Syllable[] = [
  { vowel: 'ah' },                         // ah
  { vowel: 'oh', to: 'oo' },               // oh
  { vowel: 'oo' },                         // ooh
  { vowel: 'eh' },                         // eh
  { vowel: 'ee' },                         // ee
  { vowel: 'ah', to: 'ee' },               // ay (the "I")
  { onset: 'h', vowel: 'ey', to: 'ee' },   // hey
  { onset: 'y', vowel: 'eh', to: 'uh' },   // yeah
  { onset: 'l', vowel: 'ah' },             // la
  { onset: 'l', vowel: 'oh', to: 'oo' },   // lo
  { onset: 'd', vowel: 'ah' },             // da
  { onset: 'd', vowel: 'oo' },             // doo
  { onset: 'n', vowel: 'ah' },             // na
  { onset: 'n', vowel: 'ey', to: 'ee' },   // nay
  { onset: 'm', vowel: 'ah' },             // ma
  { onset: 'w', vowel: 'oh' },             // wo
  { onset: 'w', vowel: 'ah' },             // wa
  { onset: 'y', vowel: 'ah' },             // ya
  { onset: 'y', vowel: 'oh', to: 'oo' },   // yo
  { onset: 'b', vowel: 'ah' },             // ba
];
/** The syllables a phrase can open on with no consonant, which a sample always holds a couple of. */
const OPEN = [0, 1, 2, 3, 4, 5];
/** The syllables that are no word in any language, for the styles that sing only those (Arnhem Land): not "hey", "yeah", "ya" or "yo". */
const VOCABLES = [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19];

// ── how a note is chopped, carried in its `mod` ─────────────────────────────

/** Marks a lead note's `mod` as the chopper's. */
export const CHOP_MARK = 1 << 14;
/** A note only the chop sings (a stutter's piece, a reversed swell): an instrument doubling the lead leaves it out. */
export const CHOP_ONLY = LEAD_OWN;
/** How a slice is played. */
export const CHOP_PLAIN = 0, CHOP_SCOOP = 1, CHOP_SLIDE = 2, CHOP_FLIP = 3, CHOP_GATE = 4, CHOP_REVERSE = 5, CHOP_FALL = 6, CHOP_PIECE = 7;

/** A chopped note's `mod`: the slice (its place in SYLLABLES), how it is played, and by how much (semitones, or the gate's steps a beat). */
export function chopMod(syllable: number, gesture: number, amount = 0, only = false): number {
  return CHOP_MARK | (only ? CHOP_ONLY : 0) | (syllable & 31) | ((gesture & 7) << 5) | ((Math.max(-16, Math.min(15, Math.round(amount))) + 16) << 8);
}
/** A chopped note's `mod`, read back; a note the chopper never saw is null. */
export function readChop(mod: number): { syllable: number; gesture: number; amount: number; only: boolean } | null {
  if (!(mod & CHOP_MARK)) return null;
  return { syllable: Math.min(SYLLABLES.length - 1, mod & 31), gesture: (mod >> 5) & 7, amount: ((mod >> 8) & 31) - 16, only: !!(mod & CHOP_ONLY) };
}

// ── the tune's vocal ─────────────────────────────────────────────────────────

/** The average pitch of a bar's lead notes (MIDI), which sets a baritone's octave. */
export function leadMean(notes: readonly LofiNote[]): number {
  let sum = 0, n = 0;
  for (const x of notes) if (x.voice === 'lead') { sum += x.midi; n++; }
  return n ? sum / n : 72;
}

/** A pitch's class (0 is C), for a note a quarter-tone off too. */
const pitchClass = (midi: number): number => ((Math.round(midi) % 12) + 12) % 12;

/** A small seeded source. */
function mulberry(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Mix a few integers into one seed. */
function hash(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) h = Math.imul(h ^ (x >>> 0), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/** A tune's vocal sample: the singer, the syllables sung (the slices) and the slice each pitch plays. */
export interface ChopVocal {
  /** The voice: its vowels, range, registers and source (./lofi-chop-voices.ts). */
  spec: ChopVoiceSpec;
  /** The singer's vocal tract, as a formant scale against the voice's average speaker. */
  tract: number;
  /** How far the sample is sped up (1 not at all): the formants and the vibrato rise with the speed. */
  speed: number;
  /** How breathy the singer is (0 to 1). */
  breathy: number;
  /** The vibrato (Hz) and its depth (cents). */
  vibRate: number; vibDepth: number;
  /** The slices, as places in SYLLABLES. */
  slices: readonly number[];
  /** The slice each pitch class plays: a place in `slices`. */
  byPitch: readonly number[];
}

/**
 * The vocal a tune's chops are cut from, drawn from its seed alone. With a `voice`, the
 * singer is drawn around that voice's measured average (sped up by `speed`); without one, it
 * is the chop voice as it was before the voices were measured, which the botanica grains sing.
 * The syllables are the same whoever sings them.
 */
export function chopVocal(seed: number, mood?: string, voice?: ChopVoice, speed = 1): ChopVocal {
  const r = mulberry(hash(seed, 0xc40b));
  let tract = 1.06 + r() * 0.14;
  let breathy = 0.15 + r() * 0.3;
  let vibRate = 5.2 + r() * 0.8, vibDepth = 22 + r() * 18;
  const spec = voice ? CHOP_VOICE[voice] : LEGACY_VOICE;
  if (voice) {
    // The singer, on a stream of the voice's own, so the syllables below stay the tune's.
    const v = mulberry(hash(seed, 0xc40b, CHOP_VOICES_SALT[voice]));
    const pick = (lo: number, hi: number): number => lo + v() * (hi - lo);
    tract = pick(...spec.tract);
    breathy = pick(...spec.breathy);
    vibRate = pick(...spec.vibRate);
    vibDepth = pick(...spec.vibDepth);
  }
  // Two open vowels, then four more of anything, none twice.
  const slices: number[] = [];
  while (slices.length < 2) { const s = OPEN[Math.floor(r() * OPEN.length)]!; if (!slices.includes(s)) slices.push(s); }
  // Arnhem Land's voices sing vocables only, drawn from their own list; every other style's draws are as they were.
  const from = mood === 'arnhem' ? VOCABLES : null;
  while (slices.length < 6) { const s = from ? from[Math.floor(r() * from.length)]! : Math.floor(r() * SYLLABLES.length); if (!slices.includes(s)) slices.push(s); }
  const byPitch = Array.from({ length: 12 }, () => Math.floor(r() * slices.length));
  return { spec, tract, speed, breathy, vibRate, vibDepth, slices, byPitch };
}
/** Each voice's own stream for its singer. */
const CHOP_VOICES_SALT: Readonly<Record<ChopVoice, number>> = { female: 0xf1, male: 0x3a1e, baritone: 0xba5, child: 0xc41d };

// ── the chopper ─────────────────────────────────────────────────────────────

/** How each style chops: how often each move happens, and its timing (ms: a deviation either way, and a lay-back). */
interface Chopping { scoop: number; slide: number; flip: number; gate: number; stutter: number; fall: number; reverse: number; loose: number; late: number }
const CHOPPING: Record<'future' | 'smooth' | 'house' | 'plain' | 'coro' | 'garage', Chopping> = {
  // Future bass: a producer's chops, flipped, gated and stuttered, on the grid.
  future: { scoop: 0.15, slide: 0.25, flip: 0.16, gate: 0.3, stutter: 0.15, fall: 0.12, reverse: 0.35, loose: 1.5, late: 0 },
  // R&B: sung, sliding and falling, a little behind the beat.
  smooth: { scoop: 0.35, slide: 0.45, flip: 0.06, gate: 0.08, stutter: 0.07, fall: 0.3, reverse: 0.3, loose: 5, late: 8 },
  // Lofi house: a sampler played by hand, sparse, the slices mostly left as they are.
  house: { scoop: 0.2, slide: 0.2, flip: 0.1, gate: 0.18, stutter: 0.1, fall: 0.15, reverse: 0.4, loose: 6, late: 5 },
  plain: { scoop: 0.22, slide: 0.3, flip: 0.1, gate: 0.15, stutter: 0.1, fall: 0.18, reverse: 0.3, loose: 4, late: 0 },
  // A salsa coro: sung, not chopped. The singers scoop and slide a little and fall off the
  // long notes; nothing is flipped, gated, stuttered or reversed.
  coro: { scoop: 0.2, slide: 0.25, flip: 0, gate: 0, stutter: 0, fall: 0.2, reverse: 0, loose: 6, late: 4 },
  // UK garage: hooks cut short and gated on the swung grid, flipped and stuttered, rarely sung through.
  garage: { scoop: 0.12, slide: 0.18, flip: 0.22, gate: 0.38, stutter: 0.2, fall: 0.1, reverse: 0.3, loose: 2, late: 0 },
};
const CHOPPING_OF: Partial<Record<string, keyof typeof CHOPPING>> = { sherbert: 'future', sugar: 'future', kpop: 'future', dubstep: 'future', brostep: 'future', dnb: 'future', electro: 'future', rnb: 'smooth', soul: 'smooth', triphop: 'smooth', lofiHouse: 'house', salsa: 'coro', botanica: 'house', ukGarage: 'garage', funkyHouse: 'house', breakbeat: 'future' };

/** A normally distributed draw (mean 0, deviation 1), cut at 2.5. */
function gauss(rand: () => number): number {
  const v = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  return Math.max(-2.5, Math.min(2.5, v));
}

/** Who sings a bar's chops (engine/src/lofi-chop-cast.ts), the principal singer first. */
export function castOf(instrument: ChopLead, bar: LofiBar): ChopSinger[] {
  return chopCast(instrument, { mood: bar.tune.mood, seed: bar.tune.seed, section: bar.section, barMean: leadMean(bar.notes) });
}

/**
 * The chopper: how each of a bar's lead notes is sung (its slice and move, carried in its
 * `mod`), each moved a few milliseconds off the grid, with a stutter's pieces and a
 * reversed swell added where it chooses. A run of short notes on one pitch (the
 * composer's own stutter) is one slice stuttered. `rand` is the bar's seeded source.
 * `instrument` is the chop lead playing: the bar's principal singer's voice suits the moves
 * to it (a baritone flips less and slides more, a child's chops are lighter); a woman's
 * are the style's own.
 */
export function chopper(notes: LofiNote[], bar: LofiBar, spb: number, rand: () => number, instrument: string = 'chop'): LofiNote[] {
  const vocal = chopVocal(bar.tune.seed, bar.tune.mood);
  // Arnhem Land's chops are cut by the tune's place on its line (engine/src/lofi-arnhem.ts): a producer's at the modern end, sung near the traditional.
  const style = CHOPPING[bar.tune.mood === 'arnhem' ? arnhemChops(bar.tune.seed) : CHOPPING_OF[bar.tune.mood] ?? 'plain'];
  const lead = notes.filter(n => n.voice === 'lead').sort((a, b) => a.beat - b.beat);
  if (!lead.length) return notes;
  const voice = castOf(isChopLead(instrument) ? instrument : 'chop', bar)[0]!.voice;
  const g = CHOP_GESTURES[voice];
  const how: Chopping = g ? { ...style, scoop: style.scoop * g.scoop, slide: style.slide * g.slide, flip: style.flip * g.flip, gate: style.gate * g.gate, stutter: style.stutter * g.stutter, fall: style.fall * g.fall, reverse: style.reverse * g.reverse } : style;
  const added = new Map<LofiNote, LofiNote[]>();
  const played = new Map<LofiNote, LofiNote>();
  let slice = vocal.byPitch[pitchClass(lead[0]!.midi)]!;
  for (let i = 0; i < lead.length; i++) {
    const n = lead[i]!, prev = lead[i - 1], next = lead[i + 1];
    const restBefore = prev ? n.beat - (prev.beat + prev.dur) : n.beat;
    const restAfter = next ? next.beat - (n.beat + n.dur) : 4 - (n.beat + n.dur);
    // The composer's stutter: short notes on one pitch in a row sing one slice's start, over and over.
    const run = (m?: LofiNote): boolean => !!m && m.midi === n.midi && m.dur <= 0.25 && n.dur <= 0.25;
    const stuttering = run(prev) || run(next);
    if (!(stuttering && run(prev))) slice = rand() < 0.62 ? vocal.byPitch[pitchClass(n.midi)]! : (slice + 1) % vocal.slices.length;
    const syllable = vocal.slices[slice]!;
    let gesture = CHOP_PLAIN, amount = 0;
    if (stuttering) gesture = CHOP_PIECE;
    else if (n.mod === 1) { gesture = CHOP_SCOOP; amount = -2; }   // the composer asked for a scoop
    else if (prev && restBefore < 0.15 && Math.abs(n.midi - prev.midi) <= 7 && n.midi !== prev.midi && rand() < how.slide) { gesture = CHOP_SLIDE; amount = prev.midi - n.midi; }
    else if (n.dur >= 0.7 && rand() < how.gate) { gesture = CHOP_GATE; amount = rand() < 0.75 ? 4 : 3; }
    else if (n.dur >= 0.4 && (!next || restAfter >= 0.25) && rand() < how.fall) { gesture = CHOP_FALL; amount = -(3 + Math.floor(rand() * 3)); }
    else if (i > 0 && rand() < how.flip) { gesture = CHOP_FLIP; amount = n.midi <= 76 ? 12 : -12; }
    else if (n.dur >= 0.3 && rand() < how.scoop) { gesture = CHOP_SCOOP; amount = rand() < 0.6 ? -1 : -2; }
    // Off the grid by a few milliseconds, the style's lay-back on top; a stutter stays tight.
    const ms = stuttering ? 0 : gauss(rand) * how.loose + how.late;
    const shift = ms / 1000 / spb;
    const vel = Math.max(0.05, Math.min(1, n.vel * (1 + gauss(rand) * 0.05)));
    const extra: LofiNote[] = [];
    // A stutter on a held note: its consonant three times in thirty-seconds (sixteenths at a slow tempo), then the note.
    const step = spb > 0.55 ? 0.25 : 0.125;
    if (!stuttering && gesture === CHOP_PLAIN && n.dur >= 3 * step + 0.3 && (n.beat % 1 < 0.02) && rand() < how.stutter) {
      for (let s = 0; s < 3; s++) extra.push({ ...n, beat: n.beat + s * step, dur: step * 0.7, vel: vel * (0.8 + s * 0.06), mod: chopMod(syllable, CHOP_PIECE, 0, true) });
      played.set(n, { ...n, beat: n.beat + 3 * step, dur: n.dur - 3 * step, vel, mod: chopMod(syllable, gesture, amount) });
    } else {
      played.set(n, { ...n, beat: Math.max(0, n.beat + shift), vel, mod: chopMod(syllable, gesture, amount) });
    }
    // The odd reversed swell into a phrase that starts after a rest of a beat or more.
    if (restBefore >= 1 && n.beat >= 1 && !stuttering && rand() < how.reverse) {
      const len = Math.min(restBefore - 0.1, n.beat >= 2 && rand() < 0.5 ? 2 : 1);
      extra.unshift({ ...n, beat: n.beat - len, dur: len, vel: vel * 0.8, mod: chopMod(syllable, CHOP_REVERSE, 0, true) });
    }
    if (extra.length) added.set(n, extra);
  }
  const out: LofiNote[] = [];
  for (const n of notes) {
    out.push(...(added.get(n) ?? []));
    out.push(played.get(n) ?? n);
  }
  return out;
}

// ── singing a slice ─────────────────────────────────────────────────────────

/** Everything one slice is sung from. */
export interface ChopSlice {
  syllable: number;
  midi: number;
  /** Seconds to the cut. */
  dur: number;
  /** How hard it is sung (0 to 1): its brightness and how open the vowel is. */
  vel: number;
  gesture: number;
  /** Semitones (a scoop, slide, flip or fall), or the gate's steps a beat. */
  amount: number;
  /** The tune's beat (s), for the gate. */
  beat: number;
  vocal: ChopVocal;
  /** This slice's take (0 to 1): a few cents off and the vowel a little brighter or darker. */
  take: number;
}

/** A sung vowel's bandwidths (Hz), and a nasal murmur's, wider. */
const BW: Quad = [80, 100, 150, 240];
const BW_NASAL: Quad = [120, 300, 380, 480];
/** The higher formants' bandwidths (Hz): wider the higher they are. */
const POLE_BW = [350, 500, 650];
/** A chop's level once its slice is sung: the sung body's loudness, before its velocity. */
const CHOP_RMS = 0.046;
/** How far an octave flip carries the formants with the pitch, as a sampler's repitch does (part of the way). */
const FLIP_FORMANT = 0.35;

/** A source's value at `vel`, softly `a` changing by `b` at full strength. */
const atVel = (a: number, b: number, vel: number): number => a + b * vel;

/** One take of a slice, mono, into `out` from sample `at`, at `gain`. Returns the sung body's RMS before `gain`. */
function sing(out: Float32Array, sr: number, s: ChopSlice, rand: () => number, at: number, cents: number, vowelOnly: boolean, decay: number): number {
  const syl = SYLLABLES[s.syllable] ?? SYLLABLES[0]!;
  const onset: Onset | null = vowelOnly || !syl.onset ? null : ONSETS[syl.onset];
  const od = onset ? onset.dur : 0;
  const len = Math.max(0.03, s.dur);
  const vel = Math.max(0, Math.min(1, s.vel));
  const spec = s.vocal.spec;
  const flip = s.gesture === CHOP_FLIP ? s.amount : 0;
  const base = 440 * 2 ** ((s.midi + flip - 69) / 12) * 2 ** (cents / 1200);
  const scale = s.vocal.tract * s.vocal.speed * 2 ** ((flip / 12) * FLIP_FORMANT) * (0.975 + s.take * 0.05);
  // Which register the note was sung in: the singer sang it before the sampler repitched it
  // (a flip), slower by the sample's speed-up. Above the voice's turn, its upper register.
  const up = upperShare(spec, s.midi - 12 * Math.log2(s.vocal.speed));
  const src = (k: 'open' | 'breath' | 'presence', kv: 'openVel' | 'breathVel' | 'presenceVel', v: number): number => {
    const lo = atVel(spec.low[k], spec.low[kv], v);
    return up > 0 ? lo + (atVel(spec.high[k], spec.high[kv], v) - lo) * up : lo;
  };
  const cornerLo = spec.low.corner + spec.low.cornerVel * vel * vel;
  const corner = up > 0 ? cornerLo + (spec.high.corner + spec.high.cornerVel * vel * vel - cornerLo) * up : cornerLo;
  // Louder is pressed and bright, the jaw open wider; softer is breathy and dark.
  const open = src('open', 'openVel', vel);
  const breath = s.vocal.breathy * src('breath', 'breathVel', vel);
  // The voice's top: a soft voice's harmonics fall away above about 1.6 kHz, a full one's
  // above 5 kHz; and the presence a produced vocal is given, more on a full one.
  const tiltK = 1 - Math.exp((-2 * Math.PI * corner) / sr);
  const presence = src('presence', 'presenceVel', vel) * (sr / 44100);
  const jaw = 0.93 + 0.14 * vel;
  // The ring belongs to the lower register: a man's falsetto has almost none.
  const ring = up > 0 ? spec.ring * (1 + (spec.highRing - 1) * up) : spec.ring;
  const release = s.gesture === CHOP_FALL ? 0.05 : len > 0.4 ? 0.03 : 0.012;
  const n = Math.min(out.length - at, Math.ceil((len + release) * sr));
  if (n <= 0) return 0;
  // The pitch through the slice, before the vibrato.
  const glide = (s.gesture === CHOP_SLIDE ? Math.min(0.14, len * 0.45) : s.gesture === CHOP_SCOOP ? 0.075 : 0.03) * spec.glide;
  const from = s.gesture === CHOP_SLIDE || s.gesture === CHOP_SCOOP ? s.amount : s.gesture === CHOP_REVERSE ? 0 : -0.15;
  const fallAt = Math.max(len * 0.55, len - 0.28);
  const pitch = (t: number): number => {
    let semis = t < glide ? from * (1 - ease(t / glide)) : 0;
    if (s.gesture === CHOP_FALL && t > fallAt) semis += s.amount * ((t - fallAt) / (len - fallAt)) ** 2;
    return base * 2 ** (semis / 12);
  };
  // Some voices carry a vibrato on only some notes (a child's), each take deciding; a sped-up sample's is quicker.
  const vibOn = len > 0.3 && s.gesture !== CHOP_PIECE && s.take < spec.vibShare;
  const vibDepth = s.vocal.vibDepth * (0.7 + 0.5 * vel) * (up > 0 ? 1 + (spec.highVib - 1) * up : 1), vibRate = s.vocal.vibRate * (0.96 + s.take * 0.08) * s.vocal.speed;
  const vibAt = spec.vibDelay;
  // An untrained voice's pitch wanders slowly on a held note, each take its own way.
  const drift = spec.drift, dp = s.take * 19.1, dq = s.take * 7.3;
  let wander = 1;
  const res = [new Formant(), new Formant(), new Formant(), new Formant()];
  // The tract's higher formants, which the vowel tables leave out: without them the voice has
  // almost nothing above 5 kHz (60 dB under a sung voice there). Set once: they hardly move.
  const higher = spec.poles.map((hz, j) => { const r = new Formant(); r.set(Math.min(hz * scale, sr * 0.45), POLE_BW[j] ?? 600, sr); return r; });
  const h0 = higher[0] ?? null, h1 = higher[1] ?? null;
  // The formants above those, lumped, as Klatt's bypass is: a little of the source straight
  // through, keeping the air above 6 kHz that the four formants alone leave silent.
  const bypass = spec.bypass;
  // The voice's numbers the loop reads, held here.
  const target = spec.vowels[syl.vowel], to = syl.to ? spec.vowels[syl.to] : null;
  const onsetScale = spec.onset, bwScale = spec.bw, ringHz = spec.ringHz, trackBw = spec.trackBw, jitter = spec.jitter, shimmer = spec.shimmer;
  const click = new BandPass();
  const burst = onset?.burst;
  if (burst) click.set(burst.f, burst.bw, sr);
  const f = [0, 0, 0, 0], bw = [0, 0, 0, 0], setF = [-1, -1, -1, -1], setB = [-1, -1, -1, -1];
  const attackT = onset ? 0.005 : 0.012;
  let quick = spec.id === 'legacy' ? 0 : (Math.floor(rand() * 4294967295) | 1);
  let phase = 0, period = sr / base, inc = 1 / period, strength = 1, tilt = 0, lastNoise = 0, lastTract = 0, lastDry = 0, voicing = 1, asp = 0, f0 = base;
  let sum = 0, count = 0;
  const bodyFrom = od + 0.02, bodyTo = len - 0.01;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (i % 8 === 0) {
      // The formants: the consonant's, moving to the vowel's, and at the end towards the vowel it glides to.
      const u = onset ? ease(Math.min(1, Math.max(0, (t - (od - onset.glide * 0.25)) / onset.glide))) : 1;
      const g = to && len > 0.12 && t > len * 0.5 ? ease(Math.min(1, (t - len * 0.5) / (len * 0.5))) * 0.85 : 0;
      for (let j = 0; j < 4; j++) {
        const start = onset && !onset.vowelShape ? onset.f[j]! * onsetScale : target[j]!;
        let hz = start + (target[j]! - start) * u;
        if (to) hz += (to[j]! - hz) * g;
        // The trained voice's ring: the third and fourth formants drawn together into one cluster.
        if (j >= 2 && ring > 0) hz += ((j === 2 ? ringHz - 200 : ringHz + 250) - hz) * ring;
        f[j] = hz * scale * (j === 0 ? jaw : 1);
        const nb = onset?.nasal ? BW_NASAL[j]! : BW[j]!;
        bw[j] = (nb + (BW[j]! - nb) * u) * bwScale * (j >= 2 && ring > 0 ? 1 - 0.3 * ring : 1);
      }
      voicing = onset ? onset.voice + (1 - onset.voice) * Math.min(1, Math.max(0, (t - od) / 0.012)) : 1;
      asp = onset?.asp ? onset.asp * (1 - Math.min(1, Math.max(0, (t - od + 0.01) / 0.025))) : 0;
      f0 = pitch(t) * (vibOn && t > vibAt ? 2 ** ((vibDepth * Math.min(1, (t - vibAt) / 0.2) * Math.sin(2 * Math.PI * vibRate * t)) / 1200) : 1);
      if (drift > 0) {
        // The wander moves slowly, so it is worked out every fourth time.
        if (i % 32 === 0) wander = 2 ** ((drift * (0.6 * Math.sin(2 * Math.PI * 1.1 * t + dp) + 0.4 * Math.sin(2 * Math.PI * 2.3 * t + dq))) / 1200);
        f0 *= wander;
      }
      // A high note leaves no voice under a low first formant: a singer raises the first formant
      // to the note, and an open glottis damps it there (a wider band on a measured voice).
      if (f[0]! < f0 * 1.08) { f[0] = f0 * 1.08; if (trackBw) bw[0] = Math.max(bw[0]!, f0 * trackBw); }
      // A held vowel's formants stand still: a resonator is set again only when its own move.
      for (let j = 0; j < 4; j++) {
        const hz = Math.min(f[j]!, sr * 0.45);
        if (hz !== setF[j] || bw[j] !== setB[j]) { res[j]!.set(hz, bw[j]!, sr); setF[j] = hz; setB[j] = bw[j]!; }
      }
    }
    // The glottal pulse, each period a little different, with its closing step band-limited (a polyBLEP).
    phase += inc;
    if (phase >= 1) {
      phase -= 1;
      period = (sr / f0) * (1 + (rand() - 0.5) * jitter);
      strength = 1 + (rand() - 0.5) * shimmer;
      inc = 1 / period;
    }
    const x = phase / open;
    let pulse = x < 1 ? (2 * x - 3 * x * x) * strength : 0;
    const dt = inc, tc = phase - open;
    if (tc >= 0 && tc < dt) { const v = tc / dt; pulse += (strength / 2) * (2 * v - v * v - 1); }
    else if (tc < 0 && tc > -dt) { const v = tc / dt; pulse += (strength / 2) * (v * v + 2 * v + 1); }
    tilt += tiltK * (pulse - tilt);
    // Breath rides the voice; an h is breath alone, brighter (its low end mostly gone) and
    // well under the vowel, as a breathed h is.
    // A measured voice draws its breath from a quicker generator of its own (xorshift); the old voice keeps its stream.
    let noise: number;
    if (quick) { quick ^= quick << 13; quick ^= quick >>> 17; quick ^= quick << 5; noise = (quick >>> 0) / 2147483648 - 1; } else noise = rand() * 2 - 1;
    const air = noise - lastNoise * 0.6, hiss = noise - lastNoise * 0.95;
    lastNoise = noise;
    let y = tilt * voicing + hiss * asp * 0.4 + air * breath * voicing * (x < 1 ? 0.12 : 0.04);
    const dry = y;
    for (let j = 0; j < 4; j++) y = res[j]!.run(y);
    if (h0) y = h0.run(y);
    if (h1) y = h1.run(y);
    if (bypass) y += (dry - lastDry) * bypass;
    lastDry = dry;
    const tract = y;
    y += presence * (y - lastTract);
    lastTract = tract;
    if (burst) {
      const since = t - (od - 0.004);
      if (since >= 0 && since < 0.03) y += click.run(noise) * burst.level * Math.exp(-since / 0.005) * 0.4;
    }
    // The slice's shape: a soft start on a vowel, a quicker one on a consonant, and the cut.
    // (Worked out only near the ends: in between both are exactly 1.)
    const attack = t < attackT ? t / attackT : 1;
    const cut = t < len - 1e-6 ? 1 : Math.min(1, Math.max(0, (len + release - t) / release));
    const body = decay > 0 ? Math.exp(-t / decay) : 1 - Math.min(0.08, t * 0.05);
    out[at + i] = out[at + i]! + y * attack * cut * body;
    if (t >= bodyFrom && t <= bodyTo) { sum += y * y; count++; }
  }
  if (!count) for (let i = 0; i < n; i++) { sum += out[at + i]! ** 2; count++; }
  return Math.sqrt(sum / Math.max(1, count));
}

/** The slice's level against the woman's: the voice's own, and quieter in a man's falsetto. */
function voiceLevel(s: ChopSlice): number {
  const spec = s.vocal.spec;
  const up = upperShare(spec, s.midi - 12 * Math.log2(s.vocal.speed));
  return spec.level * (up > 0 ? 1 + (spec.highLevel - 1) * up : 1);
}

/**
 * Sing one slice, double-tracked: two takes a few cents apart, one to each side, the
 * second a few milliseconds late. Returns stereo at the chop's level for `s.vel`. A gate
 * cuts a held slice into steps of the beat; a reversed slice is its vowel sung and
 * echoed, dying away, then played backwards, so the slice swells into the next note.
 * With `takes` of 1 (one voice of a group) it is a single take, in the middle: both
 * channels are the same array, for a player to place.
 */
export function singChop(sr: number, s: ChopSlice, seed: number, takes: 1 | 2 = 2): [Float32Array, Float32Array] {
  const reverse = s.gesture === CHOP_REVERSE;
  const len = Math.max(0.03, s.dur);
  const tail = reverse ? 0 : s.gesture === CHOP_FALL ? 0.06 : 0.04;
  const late = takes === 2 ? Math.round(0.006 * sr) : 0;
  const size = Math.ceil((len + tail) * sr) + late;
  const decay = reverse ? len * 0.4 : 0;
  const level = CHOP_RMS * Math.max(0, Math.min(1.4, s.vel)) * voiceLevel(s);
  let channels: Float32Array[];
  if (takes === 1) {
    const one = new Float32Array(size);
    const gain = level / Math.max(1e-6, sing(one, sr, s, mulberry(hash(seed, 1)), 0, (s.take - 0.5) * 8, reverse, decay));
    for (let i = 0; i < size; i++) one[i] = one[i]! * gain;
    channels = [one];
  } else {
    const sung = [new Float32Array(size), new Float32Array(size)];
    const rms = [
      sing(sung[0]!, sr, s, mulberry(hash(seed, 1)), 0, -6 + (s.take - 0.5) * 8, reverse, decay),
      sing(sung[1]!, sr, s, mulberry(hash(seed, 2)), late, 6 + (s.take - 0.5) * 8, reverse, decay),
    ];
    const gain = level / Math.max(1e-6, (rms[0]! + rms[1]!) / 2);
    const L = new Float32Array(size), R = new Float32Array(size);
    const near = 0.84, far = 0.36;   // each take panned half way to its side
    for (let i = 0; i < size; i++) {
      const a = sung[0]![i]! * gain, b = sung[1]![i]! * gain;
      L[i] = a * near + b * far;
      R[i] = b * near + a * far;
    }
    channels = [L, R];
  }
  if (s.gesture === CHOP_GATE && s.amount > 0 && s.beat > 0) {
    // Gated: open for the first two thirds of each step, a few milliseconds' edges.
    const stepLen = s.beat / s.amount, edge = 0.003;
    for (let i = 0; i < size; i++) {
      const t = i / sr, inStep = t % stepLen;
      const g = Math.min(1, inStep / edge, Math.max(0, (stepLen * 0.66 - inStep) / edge));
      for (const ch of channels) ch[i] = ch[i]! * g;
    }
  }
  if (reverse) {
    // The echo it dies into, a little different on each side, then all of it backwards.
    const echoes: ReadonlyArray<readonly number[]> = [[0.031, 0.067, 0.113], [0.043, 0.079, 0.127]];
    for (const [c, ch] of channels.entries()) {
      const taps = echoes[c]!;
      const dry = Float32Array.from(ch);
      for (const [k, d] of taps.entries()) {
        const off = Math.round(d * sr), g = 0.5 * 0.7 ** k;
        for (let i = off; i < size; i++) ch[i] = ch[i]! + dry[i - off]! * g;
      }
      // The echo is cut where the buffer ends: fade it out there, so the swell starts from silence.
      const fade = Math.min(size, Math.round(0.02 * sr));
      for (let i = 0; i < fade; i++) ch[size - 1 - i] = ch[size - 1 - i]! * (i / fade);
      ch.reverse();
    }
  }
  return [channels[0]!, channels[channels.length - 1]!];
}

// ── played ──────────────────────────────────────────────────────────────────

/** The slices sung so far, per context, and how many samples they hold. */
const SLICES = new WeakMap<BaseAudioContext, { buffers: Map<string, AudioBuffer>; samples: number }>();
/** The most samples kept per context (about 48 MB) before the slices are sung afresh. */
const SLICE_BUDGET = 12e6;

/**
 * A vocal chop at `t`: `mod` is the chopper's (see chopMod); a note it never saw (the chop
 * doubling another lead) sings the slice its pitch maps to, plainly. `beat` is the tune's
 * beat (s), `seed` the tune's, which draws the vocal, and `take` tells this note from the
 * tune's others, so each is sung a little differently. `singer` is who sings it
 * (engine/src/lofi-chop-cast.ts), its octave already in `midi`; without one, the chop voice
 * as it was before the voices were measured.
 */
export function chop(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod: number, beat: number, seed: number, take: number, singer?: ChopSinger): void {
  const { ctx } = k;
  const vocal = singer ? chopVocal(seed, undefined, singer.voice, singer.speed) : chopVocal(seed);
  const takes = singer?.takes ?? 2;
  const how = readChop(mod) ?? { syllable: vocal.slices[vocal.byPitch[pitchClass(midi)]!]!, gesture: CHOP_PLAIN, amount: 0, only: false };
  // Takes come in four kinds, and every note's length and strength are rounded, so repeats share a slice.
  const variant = hash(seed, take) % 4;
  const slice: ChopSlice = {
    syllable: how.syllable, midi: Math.round(midi * 2) / 2, dur: Math.round(Math.max(0.03, dur) * 100) / 100, vel: Math.round(Math.min(1.4, vel) * 20) / 20,
    gesture: how.gesture, amount: how.amount, beat, vocal, take: (variant + 0.5) / 4,
  };
  let cache = SLICES.get(ctx);
  if (!cache) { cache = { buffers: new Map(), samples: 0 }; SLICES.set(ctx, cache); }
  const who = singer ? `${singer.voice}:${singer.speed.toFixed(3)}:${takes}` : '';
  const key = `${who}|${seed}|${slice.syllable}|${slice.midi}|${slice.dur}|${slice.vel}|${slice.gesture}|${slice.amount}|${variant}|${slice.gesture === CHOP_GATE ? beat.toFixed(3) : ''}`;
  let buf = cache.buffers.get(key);
  if (!buf) {
    if (cache.samples > SLICE_BUDGET) { cache.buffers.clear(); cache.samples = 0; }
    const [left, right] = singChop(ctx.sampleRate, slice, hash(seed, slice.syllable, slice.midi, variant, slice.gesture), takes);
    buf = ctx.createBuffer(takes, left.length, ctx.sampleRate);
    buf.getChannelData(0).set(left);
    if (takes === 2) buf.getChannelData(1).set(right);
    cache.buffers.set(key, buf);
    cache.samples += left.length * takes;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(out);
  src.start(Math.max(t, ctx.currentTime));
}
