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
 * late or early, by the amounts measured on recorded sections.
 */
import { bowString } from './lofi-bowed.ts';
import { blowLips, type Horn } from './lofi-brass.ts';
import { inhale, noteSpeed, type InhaleShape } from './lofi-breath.ts';
import { blowFlute, FLUTE_BREATH, FLUTE_DEEP, FLUTE_GHOST, FLUTE_KU, FLUTE_PLAYED, FLUTE_SCOOP, FLUTE_SOFT, FLUTE_STOP, FLUTE_SWELL, FLUTE_TAPER, type Pipe } from './lofi-flutes.ts';
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

/** A rendered note into the graph at `t`, at `level`, through `chain` (the last node is connected to `out`). */
function playBuffer(k: VoiceKit, data: Float32Array, out: AudioNode, t: number, level: number, chain: AudioNode[]): void {
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
  open: { level: 0.0366, raw: [25.2, 7.3, -0.48], vibrato: 1, vibratoGrow: 21, rate: 4.9 },
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
/** The breath's length short and deep (s), how long after the note it starts (s), and its level against the notes (dB). */
const FLUTE_BREATH_S = 0.2, FLUTE_DEEP_S = 0.34, FLUTE_BREATH_AFTER = 0.07, FLUTE_BREATH_DB = -28, FLUTE_DEEP_DB = -25;

function flautist(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from: number | undefined): void {
  const { ctx } = k;
  const p = FLUTES.open;
  const flags = art & FLUTE_PLAYED ? art : art === 1 ? FLUTE_SCOOP : 0;
  const ghost = (flags & FLUTE_GHOST) !== 0;
  const held = Math.max(0.05, dur);
  const strength = Math.min(1, Math.max(0, vel)) * (ghost ? FLUTE_GHOST_BLOW : 1);
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
    sr: ctx.sampleRate, f: mtof(midi), from: from === undefined ? undefined : mtof(from), vel: strength, dur: held, seconds: held + 0.3, pipe: 'open',
    vibrato: !ghost && held > FLUTE_VIBRATO_FROM ? depth : 0, rate, scoop: flags & FLUTE_SCOOP ? 1 : 0,
    tongue: ghost ? FLUTE_GHOST_TONGUE : flags & FLUTE_SOFT ? FLUTE_SOFT_TONGUE : 1,
    contour: swell && taper ? 0 : swell ? FLUTE_SWELL_DB : taper ? FLUTE_TAPER_DB : 0, arch: swell && taper ? FLUTE_ARCH_DB : 0,
    stop: (flags & FLUTE_STOP) !== 0, burst, unsettled,
  }, seeded(k));
  const expected = p.raw[0] + p.raw[1] * (strength - 0.5) + p.raw[2] * (midi - 72);
  const level = p.level * (0.55 + 0.45 * strength) * (ghost ? FLUTE_GHOST_LEVEL : 1);
  playBuffer(k, data, out, t, level * heldLevel(data, ctx.sampleRate, held, expected, NOTE_KEPT), []);
  if (flags & FLUTE_BREATH) {
    const deep = (flags & FLUTE_DEEP) !== 0;
    const air = inhale(ctx.sampleRate, deep ? FLUTE_DEEP_S : FLUTE_BREATH_S, FLUTE_INHALE, Math.floor(k.rng() * 4294967296));
    playBuffer(k, air, out, t + held + FLUTE_BREATH_AFTER, level * 10 ** ((deep ? FLUTE_DEEP_DB : FLUTE_BREATH_DB) / 20), []);
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
/** How far a soloist's held note sings (cents); a section plays straight. */
const SOLO_VIBRATO = 7;

function brass(horn: Horn, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, art: number, from: number | undefined, how: BrassPlay): void {
  const { ctx } = k;
  const held = Math.max(0.05, dur);
  const strength = Math.min(1, Math.max(0, vel));
  const fall = how.fall ?? 0;
  const data = blowLips({
    sr: ctx.sampleRate, f: mtof(midi) * 2 ** ((how.detune ?? 0) / 1200), from: from === undefined ? undefined : mtof(from),
    vel: strength, dur: held, seconds: held + (fall ? 0.4 : 0.15), horn,
    scoop: art === 1 ? 1 : 0, fall, vibrato: how.straight ? 0 : SOLO_VIBRATO, rate: 5 + k.rng() * 0.7,
  }, seeded(k));
  const at = horn === 'trumpet' ? 70 : 58;
  const level = BRASS_LEVEL[horn] * (0.55 + 0.45 * strength) * 10 ** ((-rawLevel(horn, strength, midi) + REGISTER_KEPT * 0.32 * (midi - at)) / 20);
  // The top past what a horn sends out, where the model's steepened wave would only alias.
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = 14000;
  top.Q.value = 0.5;
  playBuffer(k, data, out, t, level * (how.gain ?? 1), [top]);
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
