// SPDX-License-Identifier: MPL-2.0
/**
 * The oompa band as it plays (engine/src/lofi-oompa.ts writes its parts): every player a
 * person, heard as one. The brass are blown through their lips and bores (lib/lofi-brass.ts:
 * the tuba, the tenor horns, the baritone, the trombones, the flugelhorns and the trumpets),
 * the clarinets through their reeds (lib/lofi-reeds.ts), and each player breathes
 * (lib/lofi-breath.ts):
 *
 * - Every player sits a little sharp or flat of the others and a little ahead of or behind
 *   the beat, by their own amount for the whole tune and a little more note by note, by the
 *   amounts measured on recorded bands (SPREAD, LATE).
 * - Every tongued note starts with the air the tongue lets go, every entry out of a rest is
 *   led by air through the lips, and a player who has played a while takes a breath in the
 *   next rest that has room for one: the tuba's big, quick gulp between its ooms, the
 *   melody's at the end of a phrase.
 * - The lips are never steady (lib/lofi-brass.ts's grain), so each note is the player's own.
 *
 * The after-beats (the keys' `horns`) are one player to a chord tone: the trombone on the
 * lowest, the baritone in the middle, the tenor horn on top. The tuba (the bass) plays the
 * oom and its runs. The band's lines (lead notes, their part in `mod`) go each to its own
 * player: the melody on the tune's lead, the second player a third under it, the clarinet,
 * the trombones' countermelody and the fanfare's trumpets.
 *
 * The drums are the band's own when no kit is chosen: a big bass drum struck with a felt
 * beater, a cymbal on the after-beats (one mounted on the bass drum, or a pair clashed and
 * choked against the chest), a pair clashed open where a strain opens, the snare's strokes
 * and rolls and the woodblock.
 */
import type { LofiBar, LofiNote } from '../../../../engine/src/lofi-compose.ts';
import { OOMPA_ACCENT, OOMPA_RUN, OOMPA_SLUR, oompaPart, type OompaPart } from '../../../../engine/src/lofi-oompa.ts';
import { blowLips, darken, type Horn } from './lofi-brass.ts';
import { airBurst, inhale, noteSpeed, preAttack, seededRandom, type BurstShape, type InhaleShape, type PreAttackShape } from './lofi-breath.ts';
import { blowReed } from './lofi-reeds.ts';
import * as D from './lofi-drums.ts';
import * as K from './lofi-kit.ts';
import * as W from './lofi-world-voices.ts';
import { mtof, type VoiceKit } from './lofi-voices.ts';

/** The band's instruments: its brass, and the clarinet. */
export type BandHorn = Horn | 'clarinet';

/** How each instrument breathes and speaks (lib/lofi-breath.ts shapes), and how it is heard in the room. */
interface Voice {
  /** The air the tongue lets go into the buzz (against the note's held level), and the air before an entry out of a rest. */
  tongue: BurstShape; entry: PreAttackShape;
  /** A breath drawn in a rest: its shape, its level against the player's notes (dB), its least and most length (s). */
  breath: InhaleShape; breathDb: number; breathShortest: number; breathLongest: number;
  /** How much playing (s) before the player wants a breath, and the least rest that takes one (s). */
  lungs: number; rest: number;
  /** The bell's top as a listener in the room hears the horn: a gentle low-pass (Hz) at full strength, and octaves lower per unit of strength under 0.6. */
  heard: number; heardSoft: number;
  /** Its level against the band's other players (a share). */
  level: number;
  /** A held melody note's vibrato (cents) and its rate (Hz); 0 plays straight. */
  vibrato: number; rate: number;
  /** How long a tongued note takes to speak (s), blown softly and at full strength (lib/lofi-brass.ts LipNote.speak). */
  speak?: readonly [number, number];
  /**
   * How unsteady the lips are, against a trumpeter's (lib/lofi-brass.ts LipNote.grain; 1 if
   * left out). A recorded tuba's held notes keep their harmonics 25 to 30 dB over the noise
   * between them, with 0.09 to 0.16 % jitter: at a third of the trumpeter's unsteadiness the
   * model gives 22 to 25 dB and 0.1 %, where the trumpeter's full grain gave 13 to 20 dB.
   */
  grain?: number;
}

/** The trumpet soloist's breath (lib/lofi-winds.ts), the shapes the others are scaled from. */
const LIP_TONGUE: BurstShape = { centre: 1100, width: 2, level: -9, length: 0.008, rise: 0.001, perStrength: 4, perSpeed: 2, spread: 2, lengthSpread: 0.3, centreSpread: 0.2 };
const LIP_ENTRY: PreAttackShape = { centre: 1100, width: 2, level: -26, perStrength: 6, length: 0.022, curve: 2, spread: 4, lengthSpread: 0.35 };
const MOUTH_BREATH: InhaleShape = { bands: [{ centre: 1200, width: 2.6 }, { centre: 3500, width: 0.8, level: -6 }], rise: 0.3, fall: 0.4 };
/** A big player's breath: the tuba's deep gulp through a wide mouthpiece, its rush lower. */
const BIG_BREATH: InhaleShape = { bands: [{ centre: 700, width: 2.4 }, { centre: 2200, width: 1, level: -7 }], rise: 0.22, fall: 0.35 };

const VOICES: Record<BandHorn, Voice> = {
  trumpet: { tongue: LIP_TONGUE, entry: LIP_ENTRY, breath: MOUTH_BREATH, breathDb: -34, breathShortest: 0.08, breathLongest: 0.22, lungs: 5, rest: 0.25, heard: 4200, heardSoft: 2.5, level: 1, vibrato: 0, rate: 5, speak: [0.07, 0.015] },
  flugelhorn: { tongue: { ...LIP_TONGUE, centre: 900, level: -14 }, entry: { ...LIP_ENTRY, centre: 900 }, breath: MOUTH_BREATH, breathDb: -33, breathShortest: 0.08, breathLongest: 0.24, lungs: 5, rest: 0.25, heard: 5000, heardSoft: 2.5, level: 1, vibrato: 7, rate: 5.2, speak: [0.08, 0.02] },
  tenorhorn: { tongue: { ...LIP_TONGUE, centre: 750, level: -13 }, entry: { ...LIP_ENTRY, centre: 750 }, breath: MOUTH_BREATH, breathDb: -32, breathShortest: 0.1, breathLongest: 0.26, lungs: 5, rest: 0.22, heard: 3500, heardSoft: 2, level: 1, vibrato: 6, rate: 5, speak: [0.1, 0.022] },
  baritone: { tongue: { ...LIP_TONGUE, centre: 650, level: -13 }, entry: { ...LIP_ENTRY, centre: 650 }, breath: MOUTH_BREATH, breathDb: -31, breathShortest: 0.1, breathLongest: 0.28, lungs: 4.5, rest: 0.22, heard: 3500, heardSoft: 2, level: 1, vibrato: 5, rate: 5, speak: [0.1, 0.022] },
  trombone: { tongue: { ...LIP_TONGUE, centre: 800, level: -9 }, entry: { ...LIP_ENTRY, centre: 800 }, breath: MOUTH_BREATH, breathDb: -32, breathShortest: 0.1, breathLongest: 0.28, lungs: 4.5, rest: 0.22, heard: 3600, heardSoft: 2.2, level: 1, vibrato: 0, rate: 5, speak: [0.09, 0.02] },
  tuba: { tongue: { ...LIP_TONGUE, centre: 450, width: 2.2, level: -13 }, entry: { ...LIP_ENTRY, centre: 450, level: -24 }, breath: BIG_BREATH, breathDb: -26, breathShortest: 0.1, breathLongest: 0.4, lungs: 3, rest: 0.16, heard: 3000, heardSoft: 1.5, level: 1, vibrato: 0, rate: 5, speak: [0.18, 0.03], grain: 0.35 },
  clarinet: { tongue: { ...LIP_TONGUE, centre: 2200, level: -16 }, entry: { ...LIP_ENTRY, centre: 2400, level: -32 }, breath: MOUTH_BREATH, breathDb: -36, breathShortest: 0.08, breathLongest: 0.2, lungs: 6, rest: 0.25, heard: 9000, heardSoft: 1, level: 1, vibrato: 0, rate: 5 },
};

/**
 * How far apart a band's players sit: each player's own tuning against the band (cents,
 * one deviation) and how far each note strays from that (cents); each player's own place
 * against the beat (s, one deviation) and how far each note strays from it (s). Recorded
 * Bavarian and Alpine bands (a held chord's partials, their spread past what a steady tone
 * shows) sit 3 to 14 cents apart, 11 in the middle of them.
 */
const SPREAD = 8;
const NOTE_TUNE = 3;
const LATE = 0.006;
const NOTE_LATE = 0.004;
/**
 * The band's own time: a band plays together, but not to a clock, its beat drifting a little
 * ahead and behind as one (recorded bands' beats vary 20 to 24 ms, one deviation, beat to
 * beat). Three slow swings with periods of PULSE_PERIODS s and the depths PULSE_DEPTHS (s),
 * their phases the tune's own, move every player and the drums alike.
 */
const PULSE_PERIODS = [1.3, 2.9, 6.1] as const;
const PULSE_DEPTHS = [0.01, 0.012, 0.01] as const;
/** How far the band's beat has drifted at `t` (s) in a tune. */
export function pulse(seed: number, t: number): number {
  let v = 0;
  for (let i = 0; i < PULSE_PERIODS.length; i++) {
    const phase = (((Math.imul(seed ^ (0x9e37 * (i + 1)), 0x85ebca6b) >>> 0) % 6283) / 1000);
    v += PULSE_DEPTHS[i]! * Math.sin((2 * Math.PI * t) / PULSE_PERIODS[i]! + phase);
  }
  return v;
}
/** Each player's place across the stage (pan). */
const PAN: Record<string, number> = { melody: -0.28, second: -0.12, clarinet: -0.5, counter: 0.42, fanfare: 0.3, tuba: 0.06, pahLow: 0.38, pahMid: 0.2, pahTop: 0.02 };
/** Each part's level in the band (a share of the lane's), set against recorded bands. */
const PART_LEVEL: Record<string, number> = { melody: 0.11, second: 0.085, clarinet: 0.05, counter: 0.08, fanfare: 0.09, tuba: 1, pah: 0.55 };
/** How the after-beats' players are chosen: under this note the trombone, from it to PAH_TOP the baritone, over it the tenor horn. */
const PAH_LOW = 59, PAH_TOP = 64;
/** The after-beats' players start a little ahead, as the tuba does, for the time a tongued note takes to speak: recorded bands' after-beats sound 40 to 55 ms after the straight half-beat. */
const PAH_AHEAD = 0.01;

/** A small seeded source from the station's own, so a tune's notes are the same each time. */
function seeded(k: VoiceKit): () => number {
  return seededRandom(Math.floor(k.rng() * 4294967296) >>> 0);
}
/** A standard normal draw, cut at 2.5. */
function gauss(rand: () => number): number {
  return Math.max(-2.5, Math.min(2.5, Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())));
}
/** A player's own tuning (cents) and lateness (s) for a tune: drawn from the tune's seed and the player's seat, the same all tune. A soloist out front (a `solo:` seat) plays to the note. */
function seatOf(seed: number, seat: string): { tune: number; late: number } {
  if (seat.startsWith('solo:')) return { tune: 0, late: 0 };
  let h = 2166136261 ^ seed;
  for (let i = 0; i < seat.length; i++) h = Math.imul(h ^ seat.charCodeAt(i), 16777619) >>> 0;
  const r = seededRandom(h);
  return { tune: SPREAD * gauss(r), late: LATE * gauss(r) };
}

/** What each player last did on a lane: when their last note stopped, its pitch, and how much they have played since a breath (s). */
interface Breath { end: number; midi: number; used: number }
const PLAYERS = new WeakMap<AudioNode, Map<string, Breath>>();
function stateOf(out: AudioNode, seat: string): Breath {
  let m = PLAYERS.get(out);
  if (!m) { m = new Map(); PLAYERS.set(out, m); }
  let s = m.get(seat);
  if (!s) { s = { end: -Infinity, midi: 0, used: 0 }; m.set(seat, s); }
  return s;
}

/** Each player's chair across the stage: a panner per lane and place, made once. */
const CHAIRS = new WeakMap<AudioNode, Map<number, StereoPannerNode>>();
function chairOf(k: VoiceKit, out: AudioNode, pan: number): AudioNode {
  let m = CHAIRS.get(out);
  if (!m) { m = new Map(); CHAIRS.set(out, m); }
  const key = Math.round(pan * 100);
  let p = m.get(key);
  if (!p) { p = k.ctx.createStereoPanner(); p.pan.value = key / 100; p.connect(out); m.set(key, p); }
  return p;
}

/** A rendered buffer into the graph at `t`, at `level`. */
function play(k: VoiceKit, data: Float32Array, out: AudioNode, t: number, level: number): void {
  const { ctx } = k;
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = level;
  src.connect(g).connect(out);
  src.start(Math.max(ctx.currentTime, t));
}

/** A note's RMS over its held part (from 60 ms, or a third of a short note, to 0.6 s or its end). */
function heldRms(data: Float32Array, sr: number, held: number, from = 0): number {
  const a = from + Math.floor(Math.min(0.06, held / 3) * sr), b = Math.max(a + 32, from + Math.floor(Math.min(held, 0.6) * sr));
  let e = 0;
  for (let i = a; i < b && i < data.length; i++) e += data[i]! * data[i]!;
  return Math.sqrt(e / (b - a)) || 1e-9;
}

/** How loud a note is played at a strength: the band follows the tune's dynamics, gently. */
const loudness = (strength: number): number => 0.3 + 0.7 * strength;

/** How a band note is played. */
interface How { slur?: boolean; accent?: boolean; run?: boolean; vibrato?: boolean }

/**
 * One player's note: blown (lips or reed), with the tongue's air, the air before an entry,
 * the player's own tuning and timing, heard from the room, brought to its level; and a
 * breath in the rest before it when the player wants one and the rest has room.
 */
function blow(k: VoiceKit, out: AudioNode, seed: number, seat: string, horn: BandHorn, pan: number, t: number, midi: number, vel: number, dur: number, gain: number, how: How = {}): void {
  const { ctx } = k;
  const sr = ctx.sampleRate;
  const v = VOICES[horn];
  const rand = seeded(k);
  const me = seatOf(seed, seat);
  const st = stateOf(out, seat);
  const at = t + pulse(seed, t) + me.late + NOTE_LATE * gauss(rand);
  const cents = me.tune + NOTE_TUNE * gauss(rand);
  const held = Math.max(0.05, dur);
  const strength = Math.min(1, Math.max(0.05, vel * (how.accent ? 1.08 : 1)));
  const from = how.slur && at - st.end < 0.06 && st.midi && st.midi !== midi ? st.midi : undefined;
  const rest = at - st.end;
  const vibrato = how.vibrato && v.vibrato && held >= 0.45 ? v.vibrato : 0;
  const heardAt = v.heard * 2 ** (v.heardSoft * Math.min(0, strength - 0.6));
  const noteSeed = Math.floor(rand() * 4294967296);
  const note = { strength, speed: noteSpeed(held), seed: noteSeed };
  // The note itself, with the tongue's air in its buzz (none on a slur), heard from the room.
  // A short note played straight is one of a few takes kept for its pitch, strength and
  // length, the player's tuning laid on as it plays: the after-beats and the ooms come
  // round again and again, and working each out afresh would cost the music its time.
  const make = (r: () => number): Note => {
    const data = horn === 'clarinet'
      ? blowReed({ sr, f: mtof(midi), from: from === undefined ? undefined : mtof(from), vel: strength, dur: held, seconds: held + 0.14, bore: 'cylinder', vibrato: 0, rate: 5, scoop: 0, attack: 0.02 }, r)
      : blowLips({
        sr, f: mtof(midi), from: from === undefined ? undefined : mtof(from), slurTime: how.run ? 0.03 : undefined,
        vel: strength, dur: held, seconds: held + 0.18, horn, scoop: 0, fall: 0, vibrato, rate: v.rate + r() * 0.5, vibratoFrom: Math.min(0.3, held * 0.45), taper: held >= 0.4 ? 0.2 : 0, grain: v.grain ?? 1,
        // A short note is tongued harder: it speaks sooner (STACCATO of the time).
        speak: v.speak ? v.speak[0] * (v.speak[1] / v.speak[0]) ** Math.min(1, Math.max(0, (strength - 0.12) / 0.76)) * (held <= 0.25 ? STACCATO : 1) : undefined,
      }, r);
    const ref = heldRms(data, sr, held);
    if (from === undefined) {
      const burst = airBurst(sr, v.tongue, { ...note, seed: Math.floor(r() * 4294967296) }, Math.min(held, 0.08));
      for (let i = 0; i < burst.length && i < data.length; i++) data[i]! += burst[i]! * ref;
    }
    darken(data, sr, heardAt);
    const buf = ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    return { buf, ref, heard: heldRms(data, sr, held) };
  };
  const reuse = held <= SHORT && from === undefined && !vibrato;
  const n = reuse ? takeOf(ctx, `${horn}|${midi}|${Math.round(strength * 20)}|${Math.round(held * 20)}|${Math.floor(rand() * TAKES)}`, make) : make(rand);
  const level = gain * v.level * loudness(strength) / n.heard * 0.1;
  const chair = chairOf(k, out, pan);
  const tune = 2 ** (cents / 1200);
  playBuf(k, n.buf, chair, at, level, tune);
  // The air through the lips before an entry out of a rest.
  let lead = 0;
  if (from === undefined && rest >= ENTRY_REST) {
    const pre = preAttack(sr, v.entry, { ...note, seed: noteSeed ^ 0x5bd1e995 });
    darken(pre, sr, heardAt);
    lead = pre.length / sr;
    play(k, pre, chair, at - lead, level * n.ref);
  }
  // A breath in the rest before the note, when the player has played a while and the rest has
  // room: as loud whatever the strength of the note, as a player's breath is.
  if (rest >= v.rest && rest < 8 && (st.used >= v.lungs || rest >= 0.6)) {
    const room = rest - 0.06 - 0.04 - lead;
    const length = Math.min(v.breathLongest, room) * (0.8 + 0.2 * rand());
    const earliest = Math.max(ctx.currentTime + 0.005, st.end + 0.04);
    const end = at - lead - 0.04;
    if (length >= v.breathShortest && end - length >= earliest) {
      const air = inhale(sr, length, v.breath, Math.floor(rand() * 4294967296));
      play(k, air, chair, end - length, gain * v.level * 0.1 * loudness(0.6) * 10 ** (v.breathDb / 20) * (0.8 + 0.4 * rand()));
      st.used = 0;
    }
  }
  st.used += held;
  st.end = at + held;
  st.midi = midi;
}

/** How much sooner a short, tongued note speaks than a held one (a share of its time). */
const STACCATO = 0.5;
/** A rest this long (s) or longer makes the next note an entry, led by air through the lips: a rest a player breathes in, not the gap between after-beats. */
const ENTRY_REST = 0.6;
/** A rendered note: its buffer, its held level before it was heard from the room, and after. */
interface Note { buf: AudioBuffer; ref: number; heard: number }
/** Notes this long or shorter (s) are kept as takes; how many takes of each. */
const SHORT = 0.7;
const TAKES = 3;
const KEPT = new WeakMap<BaseAudioContext, Map<string, Note>>();
/** A kept take, or a new one rendered from its own seed and kept. */
function takeOf(ctx: BaseAudioContext, key: string, make: (r: () => number) => Note): Note {
  let m = KEPT.get(ctx);
  if (!m) { m = new Map(); KEPT.set(ctx, m); }
  let n = m.get(key);
  if (!n) {
    if (m.size > 600) m.clear();
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    n = make(seededRandom(h));
    m.set(key, n);
  }
  return n;
}
/** A kept buffer into the graph at `t`, at `level`, its pitch moved by `rate`. */
function playBuf(k: VoiceKit, buf: AudioBuffer, out: AudioNode, t: number, level: number, rate: number): void {
  const src = k.ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = k.ctx.createGain();
  g.gain.value = level;
  src.connect(g).connect(out);
  src.start(Math.max(k.ctx.currentTime, t));
}

/** The instrument a band line's part plays: the melody on the bar's lead, the others on the band's. */
function hornFor(part: OompaPart, lead: string): { horn: BandHorn; seat: string } | null {
  const leadHorn: BandHorn | null = lead === 'flugelhorn' || lead === 'trumpet' || lead === 'tenorhorn' || lead === 'clarinet' ? lead : null;
  switch (part) {
    case 'melody': return leadHorn ? { horn: leadHorn, seat: 'melody' } : null;
    case 'second': return { horn: lead === 'tenorhorn' ? 'baritone' : leadHorn ?? 'flugelhorn', seat: 'second' };
    case 'clarinet': return { horn: 'clarinet', seat: 'clarinet' };
    case 'counter': return { horn: 'trombone', seat: 'counter' };
    case 'fanfare': return { horn: 'trumpet', seat: 'fanfare' };
  }
}

/** The leads the band plays itself (a melody on any other lead is the station's to play). */
export const BAND_LEADS = new Set<string>(['flugelhorn', 'tenorhorn', 'trumpet', 'clarinet']);
/** The band's own horns, which only it plays: a lead on one of them in any style is the band's player. */
export const BAND_SOLOS = new Set<string>(['flugelhorn', 'tenorhorn']);

/**
 * A band line's note (a lead note of an oompa tune): its part from `mod`, played by that
 * part's player. Returns false for a melody note on a lead the band does not play (a
 * person chose a kalimba), which the station plays as it plays any lead.
 */
export function line(k: VoiceKit, out: AudioNode, bar: LofiBar, t: number, midi: number, vel: number, dur: number, mod: number, lead: string): boolean {
  const part = oompaPart(mod);
  const who = hornFor(part, lead);
  if (!who) return false;
  blow(k, out, bar.tune.seed, `${who.seat}:${who.horn}`, who.horn, PAN[part] ?? 0, t, midi, vel, dur, PART_LEVEL[part] ?? 1,
    { slur: (mod & OOMPA_SLUR) !== 0, accent: (mod & OOMPA_ACCENT) !== 0, vibrato: part === 'melody' || part === 'second' });
  return true;
}

/**
 * The tuba's note: an oom, or a note of a run (slurred, quick). Plays in any style a person
 * gives it to. A tuba speaks slowly, so its player starts a little ahead (TUBA_AHEAD, s): in
 * recorded bands the oom sounds 19 to 26 ms after the beat and the after-beat 0.53 to 0.65 of
 * a beat after the oom.
 */
export function tuba(k: VoiceKit, out: AudioNode, seed: number, t: number, midi: number, vel: number, dur: number, mod: number, gain = 1): void {
  // Below its range the tuba plays the octave up.
  const m = midi < 26 ? midi + 12 : midi;
  blow(k, out, seed, 'tuba', 'tuba', PAN.tuba!, t - TUBA_AHEAD, m, vel, dur, PART_LEVEL.tuba! * gain, { slur: mod === OOMPA_RUN, run: mod === OOMPA_RUN });
}
const TUBA_AHEAD = 0.008;

/** One note on one of the band's instruments, as its player plays it, in the middle of the stage. */
export function bandNote(k: VoiceKit, out: AudioNode, seed: number, horn: BandHorn, t: number, midi: number, vel: number, dur: number): void {
  blow(k, out, seed, `solo:${horn}`, horn, 0, t, midi, vel, dur, 1);
}

/** An after-beat chord's note, played by the player whose part it is (by register): the band's horns, the keys' `horns`. */
export function horns(k: VoiceKit, out: AudioNode, seed: number, t: number, midi: number, vel: number, dur: number): void {
  const [horn, seat, pan] = midi < PAH_LOW ? ['trombone', 'pahLow', PAN.pahLow] as const : midi < PAH_TOP ? ['baritone', 'pahMid', PAN.pahMid] as const : ['tenorhorn', 'pahTop', PAN.pahTop] as const;
  blow(k, out, seed, seat, horn, pan!, t - PAH_AHEAD, midi, vel, dur, PART_LEVEL.pah!);
}

// ── the drums ─────────────────────────────────────────────────────────────────

/** The band's cymbals: a pair clashed and choked against the chest on an after-beat, the mounted one struck with the beater's metal end, and a pair clashed open. */
const CLASH_CHOKED: K.CymbalSpec = { ...K.CRASH, scale: 0.7, lives: 0.6, bloom: 0.006, rattle: 0.25, choke: 0.11, tick: 0, tickLevel: 0, seconds: 0.6 };
const MOUNTED: K.CymbalSpec = { ...K.CRASH, scale: 0.8, lives: 0.5, choke: 0.09, tickLevel: 10, seconds: 0.5 };
const CLASH_OPEN: K.CymbalSpec = { ...K.CRASH, scale: 0.65, lives: 1.3, bloom: 0.008, rattle: 0.2, tick: 0, tickLevel: 0, seconds: 3 };
/** The bass drum: a big drum (Hz), struck with a felt beater, ringing a while. */
const BASS_DRUM = { hz: 52, click: 0.3, life: 0.8 };
/** The pieces' levels against the station's kit (lib/lofi-drums.ts's), and their places. */
const DRUM_LEVEL = { bass: 0.056, choked: 0.035, mounted: 0.028, open: 0.12, wood: 0.32 };
const DRUM_PAN = { bass: 0.08, cymbal: 0.15, snare: 0.1 };

/** Rendered strokes per audio context: a piece at a strength in one of its takes, made at first use. */
const STROKES = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const CYMBALS = new Map<string, K.Partial[]>();
function stroke(k: VoiceKit, key: string, vel: number, make: (sr: number, v: number, rand: () => number) => Float32Array): AudioBuffer {
  let m = STROKES.get(k.ctx);
  if (!m) { m = new Map(); STROKES.set(k.ctx, m); }
  const layer = vel < 0.5 ? 0.4 : vel < 0.8 ? 0.65 : 0.92;
  const take = Math.floor(k.rng() * 3);
  const id = `${key}:${layer}:${take}`;
  let buf = m.get(id);
  if (!buf) {
    if (m.size > 64) m.clear();
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
    const data = make(k.ctx.sampleRate, layer, seededRandom(h));
    buf = k.ctx.createBuffer(1, data.length, k.ctx.sampleRate);
    buf.getChannelData(0).set(data);
    m.set(id, buf);
  }
  return buf;
}
function strike(k: VoiceKit, out: AudioNode, t: number, buf: AudioBuffer, level: number, pan: number): void {
  const src = k.ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 + (k.rng() - 0.5) * 0.01;
  const g = k.ctx.createGain();
  g.gain.value = level * (0.94 + k.rng() * 0.12);
  src.connect(g).connect(chairOf(k, out, pan));
  src.start(Math.max(k.ctx.currentTime, t));
}
function cymbal(k: VoiceKit, out: AudioNode, t: number, vel: number, name: string, spec: K.CymbalSpec, level: number): void {
  let base = CYMBALS.get(name);
  if (!base) { base = K.cymbalBase(spec, seededRandom(name.length * 7919 + 17)); CYMBALS.set(name, base); }
  const b = base;
  strike(k, out, t, stroke(k, name, vel, (sr, v, r) => K.cymbal(sr, spec, b, v, r, k.hq)), level * D.strokeLevel(vel), DRUM_PAN.cymbal);
}

/**
 * The band's drums for a drum note of an oompa tune (when no kit is chosen): the bass drum,
 * the cymbal on the after-beats (`mod` 1 a pair clashed and choked, 0 the mounted one), a
 * pair clashed open, the snare and its rolls, and the woodblock. False for a note it does
 * not play.
 */
export function drum(k: VoiceKit, out: AudioNode, note: LofiNote, t0: number, vel: number, bar: LofiBar, kit: D.DrumKit): boolean {
  const t = t0 + pulse(bar.tune.seed, t0);
  const style = bar.tune.style;
  switch (note.voice) {
    case 'kick': {
      const buf = stroke(k, 'bassDrum', vel, (sr, v, r) => K.kickStroke(sr, BASS_DRUM.hz, v, BASS_DRUM.click, BASS_DRUM.life, r));
      strike(k, out, t, buf, DRUM_LEVEL.bass * D.strokeLevel(vel), DRUM_PAN.bass);
      return true;
    }
    case 'hat':
      if (note.mod === 1) cymbal(k, out, t, vel, 'clash', CLASH_CHOKED, DRUM_LEVEL.choked);
      else cymbal(k, out, t, vel, 'mounted', MOUNTED, DRUM_LEVEL.mounted);
      return true;
    case 'crash': cymbal(k, out, t, vel, 'open', CLASH_OPEN, DRUM_LEVEL.open); return true;
    case 'snare':
      if (note.dur > 0) D.press(k, out, t, vel, style.snareTone, kit);
      else D.snare('snare', k, out, t, vel, style.snareTone, kit);
      return true;
    case 'perc': W.perc(k, out, t, note.midi, vel * DRUM_LEVEL.wood, note.mod ?? 0); return true;
    default: return false;
  }
}

/** Whether a bar's drums are the band's own: an oompa tune with no kit chosen. */
export function bandDrums(bar: LofiBar, chosenKit: unknown): boolean {
  return bar.tune.mood === 'oompa' && !chosenKit;
}

// ── the hall ──────────────────────────────────────────────────────────────────

/**
 * The room a band plays in: a beer tent or a band hall, every part in it, the tuba and the
 * bass drum too (the station's own room takes only the keys, the lead and the effects). Its
 * walls answer within the first tens of milliseconds (EARLY: ms and level, by side), then its
 * sound builds and dies away, the low octaves ringing longest (HALL_RT: the time to fall 60 dB
 * at each octave, s), as a recorded band's rehearsal room does where the band stops: its
 * early decay 0.85 to 0.9 s from 125 Hz to 1 kHz, 0.65 s at 2 kHz and 0.47 s at 4 kHz.
 */
const HALL_OCTAVES = [125, 250, 500, 1000, 2000, 4000, 8000] as const;
const HALL_RT = [0.95, 0.72, 0.68, 0.72, 0.44, 0.19, 0.13] as const;
const EARLY: ReadonlyArray<readonly [number, number, number]> = [[9, 0.55, 0.35], [14, 0.3, 0.6], [19, 0.45, 0.25], [26, 0.3, 0.42], [31, 0.22, 0.38], [38, 0.3, 0.2], [47, 0.18, 0.28], [58, 0.16, 0.2], [69, 0.12, 0.15]];
/** When the diffuse sound has built up (s), and how loud it is against the early answers. */
const HALL_BUILD = 0.03;
const HALL_DIFFUSE = 0.55;
/** How much of the band goes to the hall at the middle of the room control. */
export const HALL_SEND = 0.3;

export interface Hall { input: GainNode; send: GainNode }

/** A band's hall: what the lanes feed (`input`), how much reaches the room (`send`), into `to`. */
export function hall(ctx: BaseAudioContext, seed: number, to: AudioNode): Hall {
  const input = ctx.createGain();
  const send = ctx.createGain();
  send.gain.value = 0;
  const low = ctx.createBiquadFilter();
  low.type = 'highpass';
  low.frequency.value = 50;
  const conv = ctx.createConvolver();
  conv.buffer = hallImpulse(ctx, seed);
  input.connect(low).connect(send).connect(conv).connect(to);
  return { input, send };
}

/** The hall's impulse: its early answers, then a diffuse tail decaying octave by octave. */
export function hallImpulse(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.ceil((Math.max(...HALL_RT) * 1.05 + HALL_BUILD) * sr);
  const b = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    const rand = seededRandom((seed ^ (0x4a11 + ch * 0x9e37)) >>> 0);
    // The early answers: a reflection off each nearby surface, its top a little dulled.
    for (const [ms, left, right] of EARLY) {
      const at = Math.round(((ms + (rand() - 0.5) * 2) / 1000) * sr);
      if (at < n) d[at] = d[at]! + (ch ? right : left) * (rand() < 0.5 ? -1 : 1);
    }
    let lp = 0;
    for (let i = 0; i < n; i++) { lp = 0.8 * lp + 0.2 * d[i]!; d[i] = lp; }
    // The diffuse tail: noise in octaves, each dying away at its own rate, building up over HALL_BUILD.
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) noise[i] = rand() * 2 - 1;
    HALL_OCTAVES.forEach((f, o) => {
      const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr, q = 1 / (2 * Math.sinh(Math.LN2 / 2));
      const al = Math.sin(w) / (2 * q), a0 = 1 + al;
      const b0 = al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      const k = -6.91 / (HALL_RT[o]! * sr);
      for (let i = 0; i < n; i++) {
        const x = noise[i]!;
        const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        const build = Math.min(1, i / (HALL_BUILD * sr));
        d[i] = d[i]! + y * Math.exp(k * i) * build * build * HALL_DIFFUSE;
      }
    });
  }
  return b;
}
