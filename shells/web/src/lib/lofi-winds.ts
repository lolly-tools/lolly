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
 * a vibrato that grows on some held notes, and a taper, as recorded soloists do.
 */
import { bowString } from './lofi-bowed.ts';
import { blowLips, heardSolo, type Horn } from './lofi-brass.ts';
import { blowFlute, type Pipe } from './lofi-flutes.ts';
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
  open: { level: 0.037, raw: [25.2, 7.3, -0.48], vibrato: 1, vibratoGrow: 21, rate: 4.6 },
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
/** The soloist's note still sounding on each seat: its gain, when it started and when its sound ends (s). */
const SOUNDING = new WeakMap<AudioNode, { gate: GainNode; from: number; until: number }>();

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
    scoop: play.scoop ?? 0, scoopTime: play.scoopTime, fall, vibrato: play.vibrato ?? 0, rate, vibratoFrom: play.vibratoFrom, taper: play.taper,
  }, rand);
  if (solo) heardSolo(data, ctx.sampleRate, strength);
  const at = horn === 'trumpet' ? 70 : 58;
  const level = BRASS_LEVEL[horn] * (0.55 + 0.45 * strength) * 10 ** ((-rawLevel(horn, strength, midi) + REGISTER_KEPT * 0.32 * (midi - at) + (solo ? SOLO_LEVEL : 0)) / 20);
  // The top past what a horn sends out, where the model's steepened wave would only alias.
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = 14000;
  top.Q.value = 0.5;
  const gate = playBuffer(k, data, out, t, level * (how.gain ?? 1), [top]);
  if (!solo) return;
  // One note at a time: the note before stops as this one starts.
  const last = SOUNDING.get(out);
  if (last && t > last.from + 0.02 && t < last.until) last.gate.gain.setTargetAtTime(0, t, NOTE_STOP);
  SOUNDING.set(out, { gate, from: t, until: t + data.length / ctx.sampleRate });
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
