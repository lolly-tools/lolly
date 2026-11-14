// SPDX-License-Identifier: MPL-2.0
/**
 * The winds played, and the fiddle, which is worked out the same way. The saxophone and the
 * clarinet are blown in their waveguides (lib/lofi-reeds.ts) and then through the
 * instrument's body: the sax's bell, which rolls off its top and warms its middle, and the
 * clarinet's darker wood. The trumpet and the trombone are blown through their lips and
 * bores (lib/lofi-brass.ts), whose bells are part of the model. The flute and the pan flute
 * are a jet of breath across an edge driving an open and a stopped pipe (lib/lofi-flutes.ts),
 * and the fiddle is a string under a bow, heard through a violin's body (lib/lofi-bowed.ts).
 * Each note is worked out whole as it comes. A note slurred from the one before glides
 * there inside the bore (or under the same bow), so it has no new attack, and a bent note
 * (the composer's art 1) is scooped or slid up from below.
 *
 * Brass also plays as a section here: a horn line doubled by a second player and a
 * trombone an octave under (hornSection), and the swing band's chords, one player to a
 * chord tone (keys). Every player is a little out of tune with the others and a little
 * late or early, by the amounts measured on recorded sections. A trumpet soloist plays
 * one note at a time and chooses how to play each (soloist): which notes to lip up into,
 * a vibrato that grows on some held notes, and a taper, as recorded soloists do; and
 * breathes (lib/lofi-breath.ts): air before a note out of a rest, air in every tongued
 * onset, and a breath drawn in some rests.
 */
import { bowString } from './lofi-bowed.ts';
import { blowLips, darken, heardSolo, type Horn } from './lofi-brass.ts';
import { airBurst, inhale, noteSpeed, preAttack, type BurstShape, type InhaleShape, type PreAttackShape } from './lofi-breath.ts';
import { blowFlute, FLUTE_BREATH, FLUTE_DEEP, FLUTE_GHOST, FLUTE_KU, FLUTE_PLAYED, FLUTE_SCOOP, FLUTE_SNATCH, FLUTE_SOFT, FLUTE_STOP, FLUTE_SWELL, FLUTE_TAPER, lungsOf, type Pipe } from './lofi-flutes.ts';
import { blowReed } from './lofi-reeds.ts';
import { EPS, mtof, type VoiceKit } from './lofi-voices.ts';

/** The leads this module plays. */
export const WIND_LEADS = new Set<string>(['sax', 'clarinet', 'trumpet', 'trombone', 'flute', 'panflute', 'fiddle']);

/** A small seeded source, from the station's own, so a tune's notes are the same each time. */
function seeded(k: VoiceKit): () => number {
  let a = Math.floor(k.rng() * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rendered note into the graph at `t`, at `level`, through `chain` (the last node is connected to `out`); its level's gain. */
function playBuffer(k: VoiceKit, data: Float32Array, out: AudioNode, t: number, level: number, chain: AudioNode[]): GainNode {
  const { ctx } = k;
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = level;
  let node: AudioNode = src;
  for (const c of chain) { node.connect(c); node = c; }
  node.connect(g).connect(out);
  src.start(t);
  return g;
}

/** How a brass note is played: a section player's straight tone, or a soloist's, which may sing a little. */
export interface BrassPlay {
  /** The player's own tuning against the note (cents). */
  detune?: number;
  /** Semitones the note falls off at its end (negative rises, a doit). */
  fall?: number;
  /** A section player: no vibrato. */
  straight?: boolean;
  /** The part's level in the section (1 the line's own): a section's players blow as hard as each other, only some sit further back. */
  gain?: number;
}

export function lead(style: string, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art = 0, from?: number, how: BrassPlay = {}): void {
  if (style === 'trumpet' || style === 'trombone') { brass(style, k, out, t, midi, vel, dur, art, from, how); return; }
  if (style === 'flute' || style === 'panflute') { flute(style === 'flute' ? 'open' : 'stopped', k, out, t, midi, vel, dur, art, from); return; }
  if (style === 'fiddle') { fiddle(k, out, t, midi, vel, dur, art, from); return; }
  const { ctx } = k;
  const sax = style === 'sax';
  const held = Math.max(0.06, dur);
  const data = blowReed({
    sr: ctx.sampleRate, f: mtof(midi), from: from === undefined ? undefined : mtof(from), vel, dur: held, seconds: held + 0.12,
    bore: sax ? 'cone' : 'cylinder', vibrato: sax ? 22 : 6, rate: 5.1 + k.rng() * 0.6, scoop: art === 1 ? 1 : 0, attack: sax ? 0.012 : 0.045,
  }, seeded(k));
  // The body: a sax's bell warms the middle and rolls the top off; a clarinet's wood is darker still.
  const warm = ctx.createBiquadFilter();
  warm.type = 'peaking';
  warm.frequency.value = sax ? 650 : 1500;
  warm.Q.value = 1;
  warm.gain.value = sax ? 3 : 2;
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = sax ? 5200 : 4200;
  top.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(1, t);
  g.gain.setTargetAtTime(EPS, t + held + 0.08, 0.02);
  playBuffer(k, data, out, t, (sax ? SAX_LEVEL : CLARINET_LEVEL) * (how.gain ?? 1), [warm, top, g]);
}
/** The blown reeds' levels against the voices they replaced. */
const SAX_LEVEL = 0.044;
const CLARINET_LEVEL = 0.065;

/**
 * How loud a brass note comes out of the model at a strength and pitch (dB), measured: it
 * climbs about 33 dB from the softest breath to the hardest and a third of a dB a semitone
 * up the range. The station sets its own dynamics (the note's level follows its velocity
 * gently, as every voice's does), so a note is brought to that level and the strength is
 * left to do what it does on a real horn: change the tone.
 */
function rawLevel(horn: Horn, vel: number, midi: number): number {
  const at = horn === 'trumpet' ? 70 : 58;
  return -21.4 + 33 * (vel - 0.5) + 0.32 * (midi - at);
}
/**
 * A modelled note brought to a steady level: how loud it is held (RMS over the part after
 * its attack), with `kept` of its own difference from `expected` (dB) left in, so the notes
 * a body or a pipe favours still stand out a little, as they do on the instrument.
 */
function heldLevel(data: Float32Array, sr: number, held: number, expected: number, kept: number): number {
  const a = Math.floor(Math.min(0.06, held / 3) * sr), b = Math.max(a + 32, Math.floor(Math.min(held, 0.6) * sr));
  let s = 0;
  for (let i = a; i < b && i < data.length; i++) s += data[i]! * data[i]!;
  const own = 10 * Math.log10(s / (b - a) + 1e-20);
  return 10 ** (-((1 - kept) * own + kept * expected) / 20);
}

/**
 * The flutes' level against the voices they replaced, how loud each comes out of the model
 * (dB: a, plus b a unit of strength over a half, plus c a semitone over C5, measured), and
 * the breath vibrato's depth (cents) at no strength and how much it deepens to full.
 */
const FLUTES: Record<Pipe, { level: number; raw: readonly [number, number, number]; vibrato: number; vibratoGrow: number; rate: number }> = {
  open: { level: 0.0411, raw: [26.1, 6.7, -0.52], vibrato: 1, vibratoGrow: 21, rate: 4.9 },
  stopped: { level: 0.037, raw: [24.6, 5.6, -0.39], vibrato: 3, vibratoGrow: 4, rate: 5.4 },
};
/** How much of a note's own loudness against the measured trend a player keeps. */
const NOTE_KEPT = 0.3;
/** A flute's vibrato comes in on notes held longer than this (s). */
const FLUTE_VIBRATO_FROM = 0.35;

/**
 * A flute (open) or a pan flute (stopped). The breath vibrato deepens as the player blows
 * harder (measured on recorded flutes: about 6 cents softly, 12 at mezzo-forte, 18 loud, at
 * 4.6 to 5.4 a second); the pan flute's is slight. `art` 1 scoops up into the note.
 */
function flute(pipe: Pipe, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from: number | undefined): void {
  if (pipe === 'open') { flautist(k, out, t, midi, vel, dur, art, from); return; }
  const { ctx } = k;
  const p = FLUTES[pipe];
  const held = Math.max(0.05, dur);
  const strength = Math.min(1, Math.max(0, vel));
  const data = blowFlute({
    sr: ctx.sampleRate, f: mtof(midi), from: from === undefined ? undefined : mtof(from), vel: strength, dur: held, seconds: held + 0.3, pipe,
    vibrato: held > FLUTE_VIBRATO_FROM ? p.vibrato + p.vibratoGrow * strength : 0, rate: p.rate + k.rng() * 0.6, scoop: art === 1 ? 1 : 0,
  }, seeded(k));
  const expected = p.raw[0] + p.raw[1] * (strength - 0.5) + p.raw[2] * (midi - 72);
  playBuffer(k, data, out, t, p.level * (0.55 + 0.45 * strength) * heldLevel(data, ctx.sampleRate, held, expected, NOTE_KEPT), []);
}

/**
 * How a flautist's choices sound (lib/lofi-perform.ts makes them): a half-tongued "du" lets
 * less of the chiff and the push through; a ghosted note is barely blown, breathy, with no
 * vibrato; a swell rises 3 dB over the note, a taper falls 4, and a messa di voce rises 3 in
 * the middle; each held note's vibrato is its own, a little deeper or shallower; and a
 * breath after a phrase's last note is drawn in the rest, as a recorded player's is (19 to
 * 29 dB under the notes).
 */
const FLUTE_SOFT_TONGUE = 0.4, FLUTE_GHOST_TONGUE = 0.3, FLUTE_GHOST_BLOW = 0.75, FLUTE_GHOST_LEVEL = 0.6;
const FLUTE_SWELL_DB = 3, FLUTE_TAPER_DB = -4, FLUTE_ARCH_DB = 3;
/**
 * The tongue's burst of air on each articulated note (lib/lofi-flutes.ts FLUTE_BURST, the
 * shape measured on recorded players), by how it is tongued (dB): a firm "tu" puffs most; a
 * "du", the "ku" of a double-tongued run (a little darker, its centre 0.8 of the "tu"'s) and
 * a ghosted note less. Quick notes puff harder and stay airy (the jet never settles: recorded
 * quick notes carry 4 to 8 dB more air against the tone than slow ones); a louder note puffs
 * harder. A slur has no burst.
 */
const FLUTE_PUFF = { tu: 0, du: -2.5, ku: -2.8, ghost: -6 }, FLUTE_KU_CENTRE = 0.8;
/** A note this short (s) is as quick as a run gets; this long, it has time to settle. */
const FLUTE_FAST = 0.1, FLUTE_SLOW = 0.3;
/** The quickest note's extra, unsettled air (a share of its held air). */
const FLUTE_UNSETTLED = 2.5;
/** The flautist's breath in a rest: drawn across the lips and through the mouth, a broad band round 1.4 kHz and a weaker one round 3.5 kHz. */
const FLUTE_INHALE: InhaleShape = { bands: [{ centre: 1400, width: 1.53 }, { centre: 3500, width: 1.01, level: -6.9 }], rise: 0.25, fall: 0.45 };
/** How far the flautist's vibrato rate spreads note to note (Hz, over FLUTES.open's): recorded players 4.6 to 6.6. */
const FLUTE_RATE_SPREAD = 1;
/** The breath's length short and deep (s), how long after the note it starts (s), and its level against the notes (dB); a snatched one's length (s), at once. */
const FLUTE_BREATH_S = 0.2, FLUTE_DEEP_S = 0.34, FLUTE_BREATH_AFTER = 0.07, FLUTE_BREATH_DB = -28, FLUTE_DEEP_DB = -25, FLUTE_SNATCH_S = 0.12;
/**
 * The breath running down (lib/lofi-perform.ts keeps how much is used), as recorded players'
 * does. Over phrases of 6 to 8 s on one breath (72 of them, each note against the same pitch
 * elsewhere) the level holds within a dB to the end and the pitch sags about 5 cents from the
 * middle on; held to the very end of a breath (11 s forte, 40 s pianissimo) the level falls
 * 2 to 4 dB in the last fifth, the air rises 3 to 5 dB against the tone, the tone darkens a
 * little and wobbles more (the level 40 to 90% more, the pitch about half as much again), and
 * the pitch is 5 to 10 cents flat. So: the pitch sags FLUTE_SAG cents at none left, early
 * (the used share to FLUTE_SAG_POW); the level falls FLUTE_SPENT_DB[0] over the breath and
 * FLUTE_SPENT_DB[1] more over its last quarter, the air rises FLUTE_SPENT_AIR dB over its
 * last 40%, and over its last quarter the strength falls by FLUTE_SPENT_DARK and the wobble
 * grows by FLUTE_SPENT_SHAKE.
 */
const FLUTE_SAG = 10, FLUTE_SAG_POW = 0.7, FLUTE_SPENT_DB = [-1.5, -2.5] as const, FLUTE_SPENT_AIR = 4, FLUTE_SPENT_DARK = 0.15, FLUTE_SPENT_SHAKE = 0.7;
/** A smooth rise from 0 to 1 as `u` goes from `from` to 1. */
function lateIn(u: number, from: number): number {
  const x = Math.min(1, Math.max(0, (u - from) / (1 - from)));
  return x * x * (3 - 2 * x);
}
const spentDb = (u: number): number => FLUTE_SPENT_DB[0] * u + FLUTE_SPENT_DB[1] * lateIn(u, 0.75);
/**
 * The flute's own level by register, as recorded ones are at mezzo-forte (an anechoic
 * flute's notes and a studio player's phrases, each pitch against C5): level from A4 to C6,
 * softer below A4 (D4 6 and 11 dB under, C4 6 and 13), and louder over C6 (G6 to A6 4 to 13
 * dB over). So the level falls FLUTE_REGISTER[0] dB a semitone under A4 and rises
 * FLUTE_REGISTER[1] a semitone over C6, at most FLUTE_REGISTER_MAX either way.
 */
const FLUTE_REGISTER = [0.8, 0.6] as const, FLUTE_REGISTER_MAX = 9;

function flautist(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from: number | undefined): void {
  const { ctx } = k;
  const p = FLUTES.open;
  const flags = art & FLUTE_PLAYED ? art : art === 1 ? FLUTE_SCOOP : 0;
  const ghost = (flags & FLUTE_GHOST) !== 0;
  const held = Math.max(0.05, dur);
  const blown = Math.min(1, Math.max(0, vel)) * (ghost ? FLUTE_GHOST_BLOW : 1);
  // How much of the breath is used through the note: the pitch sags, the level falls, the air rises and the tone darkens and wobbles as it runs out.
  const [u0, u1] = lungsOf(flags);
  const um = (u0 + u1) / 2;
  const strength = blown * (1 - FLUTE_SPENT_DARK * lateIn(um, 0.75));
  const sag = 2 ** (-FLUTE_SAG * um ** FLUTE_SAG_POW / 1200);
  const swell = (flags & FLUTE_SWELL) !== 0, taper = (flags & FLUTE_TAPER) !== 0;
  const rate = p.rate + k.rng() * FLUTE_RATE_SPREAD;
  const depth = (p.vibrato + p.vibratoGrow * strength) * (0.7 + 0.6 * k.rng());
  // The burst and the unsettled jet: by the tongue, the note's speed and its strength (the model draws each note's own).
  const ku = (flags & FLUTE_KU) !== 0;
  const speed = noteSpeed(held, FLUTE_FAST, FLUTE_SLOW);
  const tongue = ghost ? FLUTE_PUFF.ghost : ku ? FLUTE_PUFF.ku : flags & FLUTE_SOFT ? FLUTE_PUFF.du : FLUTE_PUFF.tu;
  const burst = from === undefined ? { db: tongue, centre: ku ? FLUTE_KU_CENTRE : 1, speed } : null;
  const unsettled = from === undefined ? FLUTE_UNSETTLED * speed : 0;
  const data = blowFlute({
    sr: ctx.sampleRate, f: mtof(midi) * sag, from: from === undefined ? undefined : mtof(from) * sag, vel: strength, dur: held, seconds: held + 0.3, pipe: 'open',
    vibrato: !ghost && held > FLUTE_VIBRATO_FROM ? depth : 0, rate, scoop: flags & FLUTE_SCOOP ? 1 : 0,
    tongue: ghost ? FLUTE_GHOST_TONGUE : flags & FLUTE_SOFT ? FLUTE_SOFT_TONGUE : 1,
    contour: (swell && taper ? 0 : swell ? FLUTE_SWELL_DB : taper ? FLUTE_TAPER_DB : 0) + spentDb(u1) - spentDb(u0), arch: swell && taper ? FLUTE_ARCH_DB : 0,
    stop: (flags & FLUTE_STOP) !== 0, burst, unsettled,
    airDb: FLUTE_SPENT_AIR * lateIn(um, 0.6), shake: FLUTE_SPENT_SHAKE * lateIn(um, 0.75),
  }, seeded(k));
  const expected = p.raw[0] + p.raw[1] * (strength - 0.5) + p.raw[2] * (midi - 72);
  const register = Math.max(-FLUTE_REGISTER_MAX, Math.min(FLUTE_REGISTER_MAX, FLUTE_REGISTER[0] * Math.min(0, midi - 69) + FLUTE_REGISTER[1] * Math.max(0, midi - 84)));
  const level = p.level * (0.55 + 0.45 * blown) * (ghost ? FLUTE_GHOST_LEVEL : 1);
  playBuffer(k, data, out, t, level * 10 ** ((register + spentDb(u0)) / 20) * heldLevel(data, ctx.sampleRate, held, expected, NOTE_KEPT), []);
  if (flags & FLUTE_BREATH) {
    const deep = (flags & FLUTE_DEEP) !== 0, snatched = (flags & FLUTE_SNATCH) !== 0;
    const air = inhale(ctx.sampleRate, snatched ? FLUTE_SNATCH_S : deep ? FLUTE_DEEP_S : FLUTE_BREATH_S, FLUTE_INHALE, Math.floor(k.rng() * 4294967296));
    playBuffer(k, air, out, t + held + (snatched ? 0.01 : FLUTE_BREATH_AFTER), level * 10 ** ((deep ? FLUTE_DEEP_DB : FLUTE_BREATH_DB) / 20), []);
  }
}

/** The fiddle's level against the voice it replaced, and how loud it comes out of the model (as FLUTES' raw). */
const FIDDLE_LEVEL = 0.0325;
const FIDDLE_RAW: readonly [number, number, number] = [-18.4, 15.5, -0.31];
/** A fiddler's vibrato (cents, half its swing; recorded violinists 8 to 16) and its rate (Hz, 5.4 to 6), on notes held longer than FIDDLE_VIBRATO_FROM s. */
const FIDDLE_VIBRATO = 13;
const FIDDLE_RATE = 5.4;
const FIDDLE_VIBRATO_FROM = 0.3;

/** A fiddle: a bowed string through a violin's body; `art` slides up into the note from a semitone below, a slur changes note under the same bow. */
function fiddle(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from: number | undefined): void {
  const { ctx } = k;
  const held = Math.max(0.05, dur);
  const strength = Math.min(1, Math.max(0, vel));
  const data = bowString({
    sr: ctx.sampleRate, f: mtof(midi), from: from === undefined ? undefined : mtof(from), vel: strength, dur: held, seconds: held + 0.3,
    vibrato: held > FIDDLE_VIBRATO_FROM ? FIDDLE_VIBRATO : 0, rate: FIDDLE_RATE + k.rng() * 0.6, slide: art ? 1 : 0,
  }, seeded(k));
  const expected = FIDDLE_RAW[0] + FIDDLE_RAW[1] * (strength - 0.5) + FIDDLE_RAW[2] * (midi - 72);
  playBuffer(k, data, out, t, FIDDLE_LEVEL * (0.55 + 0.45 * strength) * heldLevel(data, ctx.sampleRate, held, expected, NOTE_KEPT), []);
}

/** How much of the register's own rise in loudness a player keeps (the top of a horn is louder). */
const REGISTER_KEPT = 0.35;
/** The brass leads' levels against the voices they replaced. */
const BRASS_LEVEL: Record<Horn, number> = { trumpet: 0.019, trombone: 0.019 };
/** A soloist's level against a section player's at the same strength (dB): what keeps the solo trumpet as loud as before it was heard darker (K-weighted). */
const SOLO_LEVEL = 2.86;

/**
 * A soloist's choices, measured note by note on recorded solo trumpet phrases (a blues
 * player and a jazz improviser, CC0 recordings from Freesound). About a quarter of the
 * notes they tongue start 25 cents or more under the note and lip up into it, more often
 * on the notes a phrase leans on (the composer's art 1): those start a median 45 cents
 * flat and settle within about 55 ms. The rest start within a few cents of it, a little
 * under more often than over, in every register. A section scoops a whole semitone,
 * together, which a soloist does not do on every long note.
 */
const SCOOP_MARKED = 0.4;
const SCOOP_OTHER = 0.22;
/** Where a soloist aims a note's start, 10 to 20 ms in (cents against the note, the least and the most): a lifted note well under, the rest near. */
const LIFT_AIM: readonly [number, number] = [-60, -32];
const PLAIN_AIM: readonly [number, number] = [-22, 22];
/**
 * The model's lips, left to themselves, start a tongued note sharp for its first 20 ms or
 * so: about ONSET_SHARP cents at E4 and ONSET_SHARP_FALL less each semitone up, none by
 * C6. The player hears that and aims under by as much more. A lift rises over SCOOP_TIME
 * s and the plainer lip-in over LIP_TIME s, and the loop lags both: 10 to 20 ms in, it has
 * moved by LIFT_SHOWS and LIP_SHOWS of the lift's depth.
 */
const ONSET_SHARP = 36;
const ONSET_SHARP_FALL = 1.75;
const SCOOP_TIME = 0.09;
const LIP_TIME = 0.05;
const LIFT_SHOWS = 0.82;
const LIP_SHOWS = 0.57;
/**
 * The vibrato on a held note: recorded soloists hold the first part of a long note nearly
 * straight (2 to 3 cents of wander) and let a vibrato grow towards its end, to about 8
 * cents in its last fifth of a second, at about 4 to 4.8 a second, on about half their long
 * notes. It comes in at SOLO_VIBRATO_FROM s and reaches SOLO_VIBRATO cents as the breath
 * stops, on notes held at least SOLO_VIBRATO_HELD s.
 */
const SOLO_VIBRATO = 9;
const SOLO_VIBRATO_FROM = 0.35;
const SOLO_VIBRATO_HELD = 0.5;
const SOLO_VIBRATO_CHANCE = 0.55;
const SOLO_RATE = 4.2;
/**
 * A held note tapers: recorded soloists' notes of 0.4 s or more end 2.5 dB (the blues
 * player) to 7 dB (the jazz improviser) under their middle; a share of the breath eased
 * by the end, the least and the most, gives about 2.5.
 */
const TAPER_HELD = 0.4;
const TAPER_LEAST = 0.25;
const TAPER_MOST = 0.55;
/**
 * A trumpet plays one note at a time: the tongue stops the note before as it starts the
 * next, and on a slur the old pitch dies away as the new one comes in (a time constant,
 * s). Recorded slurs dip 4.5 to 10 dB as the pitch moves, over 25 to 50 ms; with the old
 * note stopped this way the model's slurs dip 5 dB over 35 ms, where its two notes used to
 * sound together through the change.
 */
const NOTE_STOP = 0.004;
/** The soloist's note still sounding on each seat: its gain, when it started, when the breath stopped and when its sound ends (s). */
const SOUNDING = new WeakMap<AudioNode, { gate: GainNode; from: number; end: number; until: number }>();

/**
 * A soloist's breath (lib/lofi-breath.ts makes the air), measured on the recorded solo
 * phrases. A note out of a rest of ENTRY_REST s or more is preceded by air through the
 * lips: nothing 15 to 80 ms before the tone, then 15 to 25 ms of it reaching 28 dB (the
 * blues player) to 43 dB (the jazz improviser) under the held note, centred near 1 kHz.
 * Every tongued note starts with air in the buzz: in its first 20 ms the noise between the
 * harmonics sits 15 dB under the held note (the model alone gave 21), and neither pitch
 * holds for 12 to 16 ms of a tongued change (the model alone gave 5). With ENTRY_AIR and
 * TONGUE_AIR (against the note's own held level, before the bell): the air before an entry
 * reaches 38 dB under the note in its last 15 ms, the first 20 ms of a tongued note 18,
 * and a tongued change goes 10 to 13 ms without a pitch.
 */
const ENTRY_REST = 0.3;
const ENTRY_AIR: PreAttackShape = { centre: 1100, width: 2, level: -26, perStrength: 6, length: 0.022, curve: 2, spread: 4, lengthSpread: 0.35 };
const TONGUE_AIR: BurstShape = { centre: 1100, width: 2, level: -9, length: 0.008, rise: 0.001, perStrength: 4, perSpeed: 2, spread: 2, lengthSpread: 0.3, centreSpread: 0.2 };
/**
 * A breath drawn in a rest: recorded soloists breathe in about half their rests of 0.4 s
 * or more (the blues player in every one, the improviser in 13 to 45 %), 80 to 260 ms of
 * it, 28 to 46 dB under the next note, ending 0.2 to 0.7 s before it, a broad rush from
 * 500 Hz to 4 kHz falling away above 5 kHz (12 to 24 dB down by 10 kHz; dark above
 * BREATH_TOP Hz). It is the mouth's, so it is heard as it is, not through the horn. The
 * player takes it once the note before has gone (BREATH_AFTER s after it), to end
 * BREATH_BEFORE s before the next; played live, the next note arrives only a moment
 * ahead, so the breath then ends as close to it as BREATH_GAP s, shorter, or is not
 * taken.
 */
const BREATH_REST = 0.4;
const BREATH_CHANCE = 0.55;
const BREATH_LONGEST = 0.2;
const BREATH_SHORTEST = 0.08;
const BREATH_DB = -36;
const BREATH_BEFORE = 0.3;
const BREATH_AFTER = 0.08;
const BREATH_GAP = 0.03;
const TRUMPET_BREATH: InhaleShape = { bands: [{ centre: 1200, width: 2.6 }, { centre: 3500, width: 0.8, level: -6 }], rise: 0.3, fall: 0.4 };
const BREATH_TOP = 4000;

/** The RMS of a rendered note over its held part (from 60 ms, or a third of a short note, to 0.6 s or its end). */
function heldRms(data: Float32Array, sr: number, held: number): number {
  const a = Math.floor(Math.min(0.06, held / 3) * sr), b = Math.max(a + 32, Math.floor(Math.min(held, 0.6) * sr));
  let e = 0;
  for (let i = a; i < b && i < data.length; i++) e += data[i]! * data[i]!;
  return Math.sqrt(e / (b - a)) || 1e-9;
}

/** How a soloist plays a note: the lift into it (semitones, and over how long), the vibrato (cents by the end, and when it comes in) and the taper. */
export interface SoloNote { scoop: number; scoopTime: number; vibrato: number; vibratoFrom: number; taper: number }

/** A soloist's choices for one note (see SCOOP_MARKED and the vibrato and taper above), drawn from the note's own seeded source. */
export function soloist(midi: number, held: number, art: number, slurred: boolean, rand: () => number): SoloNote {
  const lifts = rand() < (art === 1 ? SCOOP_MARKED : SCOOP_OTHER);
  const [least, most] = lifts ? LIFT_AIM : PLAIN_AIM;
  const aim = least + rand() * (most - least);
  const sharp = Math.max(0, ONSET_SHARP - ONSET_SHARP_FALL * (midi - 64));
  const scoop = slurred ? 0 : Math.max(0, sharp - aim) / (lifts ? LIFT_SHOWS : LIP_SHOWS) / 100;
  const sings = held >= SOLO_VIBRATO_HELD && rand() < SOLO_VIBRATO_CHANCE;
  const taper = held >= TAPER_HELD ? TAPER_LEAST + rand() * (TAPER_MOST - TAPER_LEAST) : 0;
  return { scoop, scoopTime: lifts ? SCOOP_TIME : LIP_TIME, vibrato: sings ? SOLO_VIBRATO : 0, vibratoFrom: Math.min(SOLO_VIBRATO_FROM, held * 0.45), taper };
}

function brass(horn: Horn, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from: number | undefined, how: BrassPlay): void {
  const { ctx } = k;
  const held = Math.max(0.05, dur);
  const strength = Math.min(1, Math.max(0, vel));
  const fall = how.fall ?? 0;
  const solo = !how.straight;
  const rate = solo ? SOLO_RATE + k.rng() * 0.6 : 5 + k.rng() * 0.7;
  const rand = seeded(k);
  const play: Partial<SoloNote> = solo ? soloist(midi, held, art, from !== undefined, rand) : { scoop: art === 1 ? 1 : 0, vibrato: 0 };
  const data = blowLips({
    sr: ctx.sampleRate, f: mtof(midi) * 2 ** ((how.detune ?? 0) / 1200), from: from === undefined ? undefined : mtof(from),
    vel: strength, dur: held, seconds: held + (fall ? 0.4 : 0.15), horn,
    scoop: play.scoop ?? 0, scoopTime: play.scoopTime, fall, vibrato: play.vibrato ?? 0, rate, vibratoFrom: play.vibratoFrom, taper: play.taper, grain: solo ? 1 : 0,
  }, rand);
  // A soloist's breath around the note: air into a note out of a rest, air at every tongued onset.
  const last = solo ? SOUNDING.get(out) : undefined;
  const sr = ctx.sampleRate;
  let sound = data, lead = 0;
  if (solo) {
    const ref = heldRms(data, sr, held);
    const note = { strength, speed: noteSpeed(held), seed: Math.floor(rand() * 4294967296) };
    if (from === undefined) {
      const burst = airBurst(sr, TONGUE_AIR, note, Math.min(held, 0.08));
      for (let i = 0; i < burst.length; i++) data[i]! += burst[i]! * ref;
    }
    if (from === undefined && (!last || t - last.end >= ENTRY_REST)) {
      const pre = preAttack(sr, ENTRY_AIR, { ...note, seed: note.seed ^ 0x5bd1e995 });
      lead = pre.length / sr;
      sound = new Float32Array(pre.length + data.length);
      for (let i = 0; i < pre.length; i++) sound[i] = pre[i]! * ref;
      sound.set(data, pre.length);
    }
    heardSolo(sound, sr, strength);
  }
  const heard = heldRms(lead ? sound.subarray(Math.round(lead * sr)) : sound, sr, held);
  const at = horn === 'trumpet' ? 70 : 58;
  const level = BRASS_LEVEL[horn] * (0.55 + 0.45 * strength) * 10 ** ((-rawLevel(horn, strength, midi) + REGISTER_KEPT * 0.32 * (midi - at) + (solo ? SOLO_LEVEL : 0)) / 20);
  // The top past what a horn sends out, where the model's steepened wave would only alias.
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = 14000;
  top.Q.value = 0.5;
  const gate = playBuffer(k, sound, out, t - lead, level * (how.gain ?? 1), [top]);
  if (!solo) return;
  // One note at a time: the note before stops as this one starts.
  if (last && t > last.from + 0.02 && t < last.until) last.gate.gain.setTargetAtTime(0, t, NOTE_STOP);
  SOUNDING.set(out, { gate, from: t, end: t + held, until: t + data.length / sr });
  // A breath in the rest before the note, if it had one.
  const before = last ? t - last.end : Infinity;
  if (from === undefined && before >= BREATH_REST && rand() < BREATH_CHANCE) {
    const want = Math.min(BREATH_LONGEST, Math.max(BREATH_SHORTEST, before - BREATH_BEFORE - BREATH_AFTER)) * (0.75 + 0.25 * rand());
    const earliest = Math.max(ctx.currentTime + 0.005, (last?.end ?? -Infinity) + BREATH_AFTER);
    const latest = t - lead - BREATH_GAP;
    const length = Math.min(want, latest - earliest);
    if (length >= BREATH_SHORTEST) {
      const end = Math.min(latest, Math.max(t - BREATH_BEFORE, earliest + length));
      const air = inhale(sr, length, TRUMPET_BREATH, Math.floor(rand() * 4294967296));
      darken(air, sr, BREATH_TOP);
      playBuffer(k, air, out, end - air.length / sr, level * heard * 10 ** (BREATH_DB / 20), []);
    }
  }
}

/** A player in a horn section: what they play against the line, how loud, how late (s) and where they sit (pan). */
export interface SectionPart { voice: string; level: number; shift: number; late: number; pan: number; detune: number }

/**
 * A recorded section's unison spreads every harmonic by about 4 to 5 cents (standard
 * deviation, the same in cents from the 2nd harmonic to the 12th: players out of tune
 * with each other, not vibrato). Two players give that spread when they sit about 8 cents
 * apart, so the second horn is drawn that far from the lead, sharp or flat, and every
 * player is a little out from the note (SECTION_SPREAD, cents). They come in within about
 * 10 to 20 ms of each other (SECTION_LATE, s).
 */
const SECTION_PAIR = 8;
const SECTION_SPREAD = 4.5;
const SECTION_LATE = 0.012;
/** Each part's level against the line's (the lead's own is the station's). */
const SECTION_LEVELS = { lead: 1.1, unison: 0.85, octave: 0.55 };

/**
 * A horn section playing a line: the lead, a second horn in unison (a trumpet, or with a
 * trumpet leading, a second trumpet) and a trombone an octave under, placed across the
 * stage. Each part has its own tuning and its own small lateness, drawn for every note.
 */
export function hornSection(lead0: string, k: VoiceKit): SectionPart[] {
  const late = (): number => Math.max(0, SECTION_LATE * (0.6 + gauss(k)));
  const lead = SECTION_SPREAD * 0.4 * gauss(k);
  const apart = (k.rng() < 0.5 ? -1 : 1) * Math.max(3, SECTION_PAIR + 2 * gauss(k));
  return [
    { voice: lead0, level: SECTION_LEVELS.lead, shift: 0, late: 0, pan: -0.15, detune: lead },
    { voice: 'trumpet', level: SECTION_LEVELS.unison, shift: 0, late: late(), pan: 0.45, detune: lead + apart },
    { voice: 'trombone', level: SECTION_LEVELS.octave, shift: -12, late: late(), pan: -0.4, detune: SECTION_SPREAD * gauss(k) },
  ];
}
/** A standard normal draw (Box-Muller), from the station's seeded source. */
function gauss(k: VoiceKit): number {
  return Math.sqrt(-2 * Math.log(1 - k.rng())) * Math.cos(2 * Math.PI * k.rng());
}

/** Below this a chord tone is the trombones'; from here up, the trumpets'. */
const TROMBONE_TOP = 60;
/** The brass section's chords' level, and how far apart its players sit (pan, trombones left, trumpets right). */
const CHORD_LEVEL = 1.6;
const CHORD_PAN = 0.25;

/**
 * The swing band's brass (the keys' 'brass'): each chord tone played by its own player,
 * the trombones under middle C and the trumpets from middle C up, each a little out of tune and
 * a little late, short stabs and long chords alike.
 */
export function keys(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, gain = 1): void {
  const horn: Horn = midi < TROMBONE_TOP ? 'trombone' : 'trumpet';
  const pan = k.ctx.createStereoPanner();
  pan.pan.value = (horn === 'trombone' ? -1 : 1) * CHORD_PAN * (0.5 + 0.5 * k.rng());
  pan.connect(out);
  const g = k.ctx.createGain();
  g.gain.value = CHORD_LEVEL * gain;
  g.connect(pan);
  const late = Math.max(0, SECTION_LATE * (0.6 + gauss(k)));
  brass(horn, k, g, t + late, midi, vel, dur, 0, undefined, { detune: SECTION_SPREAD * gauss(k), straight: true });
}
