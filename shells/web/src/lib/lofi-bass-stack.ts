// SPDX-License-Identifier: MPL-2.0
/**
 * The bass stack: how the electronic styles play a bass note the way produced bass music
 * does, as layers rather than one instrument (Andy, 2026-11-13: "we want duplication and
 * mixed layers of bass building together like modern d&b dubstep etc"). A note in a
 * stacked style is:
 * - the sub: a clean sine, the note folded below 100 Hz, through a one-channel gain so it
 *   can never spread, and ducked under the kick harder than the rest of the music;
 * - the character (the wobble, growl, reese, screech, electro bass, or the one the person
 *   chose), high-passed above the sub by a pair of filters every note of the tune shares
 *   and, in a drop and through a build, played twice: one take panned left and one right,
 *   each with its own detune, the second's filter swing a quarter to half a cycle out of
 *   step and its start up to a few milliseconds late, drawn for every note. Never one
 *   take copied through a fixed delay, which combs;
 * - the top: a distortion of each take above about 1.8 kHz, alongside it on its side, for
 *   the harmonics that carry a bass on small speakers, open only in a drop.
 * The layered basses join the stack: the travelling line's two saws are a pair of takes,
 * one each side; the harmony bass (soar) splits its four saws across the sides; a stab or
 * a bass shot keeps its middle in the centre and puts its weight on the sub; drum and
 * bass's stabs become neuro stabs, a formant growl in two takes.
 *
 * The croak is laid over the bass, never on its own (LofiBar voices.over): one take, its
 * calls answering from alternate sides, high-passed so it adds bite and nothing under the
 * bass.
 *
 * By section: an intro or a verse is the sub and one soft, darker take in the centre; a
 * build widens bar by bar; a drop is the whole stack.
 *
 * Measured against produced drops in these styles (docs/generated-music.md): their low end
 * is one channel (correlation 0.998 to 1 below 120 Hz), their bass mids wide (0.6 to 0.8
 * from 150 Hz to 2 kHz in dubstep and drum and bass, about 0.9 to 0.97 in house and
 * garage), where every bass here was one channel throughout.
 */
import type { LofiBar, LofiMood, LofiNote, LofiSection } from '../../../../engine/src/lofi-compose.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';
import { EPS, drivenBy, mtof, noiseAt, osc, type Tone, type VoiceKit } from './lofi-voices.ts';

/** How one style stacks its bass. */
export interface StackPlan {
  /** Where the sub hands over to the character (Hz). */
  xover: number;
  /** Below this the takes are summed to one channel (Hz): produced drops stay mono to about 200 Hz and spread above. */
  mono: number;
  /** How far each take is panned in a drop (0 to 1). */
  width: number;
  /** The detune between the two takes (cents). */
  cents: number;
  /** The second take starts up to this late (seconds). */
  late: number;
  /** Levels against the note's: the sub, each take in a drop or a build, the one take of a quieter section, and the top. */
  sub: number;
  take: number;
  soft: number;
  top: number;
}

/**
 * The stacked styles. The house styles' mids stay narrower (the house and garage
 * references measure 0.91 to 0.97 where dubstep's measure 0.6 to 0.8) and carry no top.
 * Acid, synthwave, Sherbert and Sugar keep one bass: a 303's squelch is one resonant
 * filter that a second take smears, synthwave's octave bass and Sherbert's 808 are mono in
 * their records, and Sugar's slap is a played bass guitar.
 */
export const STACKS: Partial<Record<LofiMood, StackPlan>> = {
  dubstep: { xover: 110, mono: 200, width: 0.9, cents: 10, late: 0.006, sub: 1, take: 1.05, soft: 0.8, top: 0.5 },
  brostep: { xover: 120, mono: 200, width: 0.9, cents: 12, late: 0.006, sub: 0.75, take: 0.98, soft: 0.75, top: 0.8 },
  dnb: { xover: 120, mono: 180, width: 0.7, cents: 8, late: 0.005, sub: 1.2, take: 0.92, soft: 0.8, top: 0.4 },
  electro: { xover: 120, mono: 180, width: 0.6, cents: 8, late: 0.004, sub: 0.9, take: 0.55, soft: 0.55, top: 0.25 },
  lofiHouse: { xover: 140, mono: 200, width: 0.3, cents: 5, late: 0.004, sub: 0.85, take: 0.82, soft: 0.8, top: 0 },
  nudisco: { xover: 130, mono: 200, width: 0.35, cents: 6, late: 0.004, sub: 0.45, take: 0.52, soft: 0.5, top: 0 },
  // The club genres (engine/src/lofi-club.ts). Breakbeat's rolling reese is as wide as drum
  // and bass's; funky house and UK garage keep the house styles' narrow middle, garage with a
  // little top for the warp; private school's log drum crosses over low (its slide is in
  // its own fundamental) and barely spreads.
  breakbeat: { xover: 120, mono: 180, width: 0.7, cents: 8, late: 0.005, sub: 1, take: 0.9, soft: 0.8, top: 0.35 },
  funkyHouse: { xover: 130, mono: 200, width: 0.35, cents: 6, late: 0.004, sub: 0.5, take: 0.55, soft: 0.5, top: 0 },
  ukGarage: { xover: 130, mono: 200, width: 0.6, cents: 7, late: 0.004, sub: 0.9, take: 0.7, soft: 0.75, top: 0.15 },
  privateSchool: { xover: 70, mono: 220, width: 0.2, cents: 3, late: 0.003, sub: 0.35, take: 0.85, soft: 0.85, top: 0 },
};

/** Whether a style stacks its bass. */
export const stacked = (mood: LofiMood): boolean => STACKS[mood] !== undefined;

/** The sections a stack plays in two takes; the others play one soft take in the centre. */
const WIDE = new Set<LofiSection>(['drop', 'build']);
/** The sub: a sine at this share of a note's level, the note folded under SUB_TOP. */
const SUB_LEVEL = 0.42;
const SUB_TOP = 100;
/**
 * The croak laid over the bass, against a bass note's level. It was 0.7, which Andy heard
 * as a little loud against the other calls (2026-11-14), so it sits about 3 dB lower.
 */
const OVER_LEVEL = 0.5;
/** The croak's place when the style has no stack: high-passed at OVER_HP, and panned OVER_PAN off centre. */
const OVER_HP = 160;
const OVER_PAN = 0.35;

/** One tune's stack: its shared filters, panners and sends, on the tune's bass lane. */
interface Bus {
  plan: StackPlan;
  /** The sub's input (one channel) and its duck under the kick. */
  sub: GainNode;
  duck: GainNode;
  /** The character's inputs, high-passed: a take each side, and a quieter section's one take. */
  left: GainNode;
  right: GainNode;
  centre: GainNode;
  panL: StereoPannerNode;
  panR: StereoPannerNode;
  /** The top's level (both sides), opened in a drop. */
  top: GainNode;
  /** The second take's own draws, so the first take keeps the voice kit's. */
  rng: () => number;
}
const BUSES = new WeakMap<AudioNode, Map<LofiMood, Bus>>();
/** The croak's place on a lane of a style with no stack. */
const OVERS = new WeakMap<AudioNode, AudioNode>();

/** A Linkwitz-Riley high-pass: two Butterworth sections, so the sub and the character sum flat at the crossover. */
function highpass(ctx: BaseAudioContext, hz: number, into: AudioNode): AudioNode {
  const a = ctx.createBiquadFilter();
  const b = ctx.createBiquadFilter();
  for (const f of [a, b]) { f.type = 'highpass'; f.frequency.value = hz; f.Q.value = Math.SQRT1_2; }
  a.connect(b).connect(into);
  return a;
}

/** The matching low-pass, for the mono part under the crossover. */
function lowpass(ctx: BaseAudioContext, hz: number, into: AudioNode): AudioNode {
  const a = ctx.createBiquadFilter();
  const b = ctx.createBiquadFilter();
  for (const f of [a, b]) { f.type = 'lowpass'; f.frequency.value = hz; f.Q.value = Math.SQRT1_2; }
  a.connect(b).connect(into);
  return a;
}

/** The stack on `lane` for `mood`, made for the first note that needs a stack. */
function busOf(k: VoiceKit, lane: AudioNode, mood: LofiMood, seed: number): Bus | null {
  const plan = STACKS[mood];
  if (!plan) return null;
  let byMood = BUSES.get(lane);
  if (!byMood) { byMood = new Map(); BUSES.set(lane, byMood); }
  const had = byMood.get(mood);
  if (had) return had;
  const { ctx } = k;
  const sub = ctx.createGain();
  sub.channelCount = 1;
  sub.channelCountMode = 'explicit';
  sub.gain.value = plan.sub;
  const duck = ctx.createGain();
  sub.connect(duck).connect(lane);
  // The top: each take above 1.8 kHz, driven and smoothed, on the take's own side. Its
  // level (`top`, shared by both sides) opens in a drop.
  const top = ctx.createGain();
  top.gain.value = 0;
  const topOf = (into: AudioNode): AudioNode | null => {
    if (plan.top <= 0) return null;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    hp.Q.value = Math.SQRT1_2;
    // Oversampled only in a render worked out ahead (k.hq): the top runs for the whole tune.
    const [push, ws] = drivenBy(ctx, 2.4, k.hq === true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    hp.connect(push);
    ws.connect(lp).connect(top).connect(into);
    return hp;
  };
  // The takes' bus, one channel below `mono` and wide over that frequency, through a crossover that
  // sums flat: the produced drops measured stay mono to about 200 Hz (side 25 to 40 dB
  // under the middle up to 160 Hz) and spread from about 220 Hz up.
  const wide = ctx.createGain();
  const mono = ctx.createGain();
  mono.channelCount = 1;
  mono.channelCountMode = 'explicit';
  wide.connect(lowpass(ctx, plan.mono, mono));
  mono.connect(lane);
  wide.connect(highpass(ctx, plan.mono, lane));
  const side = (pan: number): [GainNode, StereoPannerNode] => {
    const input = ctx.createGain();
    const place = ctx.createStereoPanner();
    place.pan.value = pan;
    input.connect(highpass(ctx, plan.xover, place));
    place.connect(wide);
    const fizz = topOf(place);
    if (fizz) input.connect(fizz);
    return [input, place];
  };
  const [left, panL] = side(-plan.width);
  const [right, panR] = side(plan.width);
  const centre = ctx.createGain();
  centre.connect(highpass(ctx, plan.xover, lane));
  const bus: Bus = { plan, sub, duck, left, right, centre, panL, panR, top, rng: mulberry32((seed ^ 0x57ac0b) >>> 0) };
  byMood.set(mood, bus);
  return bus;
}

/** The sub under a note: a clean sine at the note, folded under SUB_TOP. */
function subNote(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, len: number): void {
  let f = mtof(midi);
  while (f > SUB_TOP) f /= 2;
  const hold = Math.max(0.03, len);
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(SUB_LEVEL * vel, t + 0.005);
  g.gain.setTargetAtTime(EPS, t + hold, 0.025);
  osc(k, 'sine', f, t, t + hold + 0.2).connect(g).connect(out);
}

/** A voice played into one take: at `t`, pitch `midi` (fractional for a detuned take), at `level`, with `tone`. */
export type Take = (k: VoiceKit, out: AudioNode, t: number, midi: number, level: number, tone: Tone) => void;

/**
 * Play a bass note of a stacked style: the sub, then the character as two takes (a drop or
 * a build) or one soft, darker take in the centre (any other section).
 */
export function bassNote(k: VoiceKit, lane: AudioNode, bar: LofiBar, t: number, midi: number, level: number, len: number, tone: Tone, take: Take): void {
  const bus = busOf(k, lane, bar.tune.mood, bar.tune.seed);
  if (!bus) return;
  const { plan } = bus;
  subNote(k, bus.sub, t, midi, level * plan.sub, len);
  if (!WIDE.has(bar.section)) {
    take(k, bus.centre, t, midi, level * plan.soft, { ...tone, sub: false, bright: tone.bright * 0.75 });
    return;
  }
  const spread = plan.cents / 200;
  take(k, bus.left, t, midi - spread, level * plan.take, { ...tone, sub: false, phase: 0, take: 0 });
  const second: VoiceKit = { ...k, rng: bus.rng };
  take(second, bus.right, t + bus.rng() * plan.late, midi + spread, level * plan.take, { ...tone, sub: false, phase: 0.25 + bus.rng() * 0.25, take: 1 });
}

/** The travelling line's two takes (lib/lofi-bass-layers.ts), and in a build, where the bass itself is out, a sub under the line. */
export function travelOuts(k: VoiceKit, lane: AudioNode, bar: LofiBar, t: number, midi: number, vel: number, len: number): readonly [AudioNode, AudioNode] | null {
  const bus = busOf(k, lane, bar.tune.mood, bar.tune.seed);
  if (!bus) return null;
  if (bar.section === 'build') subNote(k, bus.sub, t, midi - 12, vel * 0.6, len);
  return [bus.left, bus.right];
}

/**
 * A percussive stab in a stack: its middle in the centre (`play`), its weight a short sine
 * on the sub. Drum and bass's are neuro stabs instead: a saw and a square an octave up,
 * through a vowel band that closes as the stab falls, driven, one take each side.
 */
export function stab(k: VoiceKit, lane: AudioNode, bar: LofiBar, t: number, midi: number, vel: number, play: (out: AudioNode) => void): void {
  const bus = busOf(k, lane, bar.tune.mood, bar.tune.seed);
  if (!bus) return;
  const blip = k.ctx.createGain();
  blip.gain.setValueAtTime(EPS, t);
  blip.gain.exponentialRampToValueAtTime(SUB_LEVEL * 2.2 * vel, t + 0.003);
  blip.gain.exponentialRampToValueAtTime(EPS, t + 0.14);
  let f = mtof(midi);
  while (f > SUB_TOP) f /= 2;
  osc(k, 'sine', f, t, t + 0.16).connect(blip).connect(bus.sub);
  if (bar.tune.mood !== 'dnb') { play(bus.centre); return; }
  for (const [out, kit, cents] of [[bus.left, k, -9], [bus.right, { ...k, rng: bus.rng }, 9]] as const) neuro(kit, out, t, midi + 12, vel, cents);
}

/** One take of a neuro stab. */
function neuro(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, cents: number): void {
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + 0.2;
  const vowel = ctx.createBiquadFilter();
  vowel.type = 'bandpass';
  vowel.Q.value = 5;
  vowel.frequency.setValueAtTime(1500 + k.rng() * 400, t);
  vowel.frequency.exponentialRampToValueAtTime(480, t + 0.13);
  const [push, ws] = drivenBy(ctx, 3.2, k.hq === true);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(NEURO_LEVEL * vel, t + 0.002);
  amp.gain.exponentialRampToValueAtTime(EPS, t + 0.16);
  vowel.connect(push);
  ws.connect(amp).connect(out);
  const saw = osc(k, 'sawtooth', f, t, end);
  saw.detune.value = cents;
  saw.connect(vowel);
  const sq = osc(k, 'square', f * 0.5, t, end);
  sq.detune.value = -cents;
  const sg = ctx.createGain();
  sg.gain.value = 0.5;
  sq.connect(sg).connect(vowel);
  // The bite: a breath of noise through the same vowel at the start.
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.4, t);
  ng.gain.exponentialRampToValueAtTime(EPS, t + 0.02);
  noiseAt(k, t, 0.025).connect(ng).connect(vowel);
}
/** A neuro stab take's level, against the knock it replaces. */
const NEURO_LEVEL = 0.5;

/** A bass shot in a stack: its middle in the centre (`play`, told to leave out its own sine), its weight on the sub. */
export function shot(k: VoiceKit, lane: AudioNode, bar: LofiBar, t: number, midi: number, vel: number, len: number, play: (out: AudioNode) => void): void {
  const bus = busOf(k, lane, bar.tune.mood, bar.tune.seed);
  if (!bus) return;
  subNote(k, bus.sub, t, midi, vel * 0.8, len);
  play(bus.centre);
}

/**
 * The harmony bass (soar) in a stack: four saws gliding into the note, two each side, each
 * pair through its own filter opening as the note holds (slowly and far in a build).
 */
export function soar(k: VoiceKit, lane: AudioNode, bar: LofiBar, t: number, midi: number, vel: number, dur: number, climbing: boolean): void {
  const bus = busOf(k, lane, bar.tune.mood, bar.tune.seed);
  if (!bus) return;
  const { ctx } = k;
  const f = mtof(midi);
  const end = t + dur + 0.3;
  for (const [out, pair] of [[bus.left, [-14, -5]], [bus.right, [6, 15]]] as const) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = climbing ? 3 : 1.2;
    lp.frequency.setValueAtTime(climbing ? 250 : 500, t);
    lp.frequency.exponentialRampToValueAtTime(climbing ? 3200 : 1700, t + (climbing ? dur : 0.4));
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(EPS, t);
    amp.gain.exponentialRampToValueAtTime(SOAR_LEVEL * vel, t + (climbing ? dur * 0.6 : 0.08));
    amp.gain.setTargetAtTime(EPS, t + dur, 0.12);
    lp.connect(amp).connect(out);
    for (const cents of pair) {
      const o = osc(k, 'sawtooth', f * 2 ** (-2 / 12), t, end);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
      o.detune.value = cents;
      o.connect(lp);
    }
  }
}
/** Each side's pair of saws, at the level the four of them had in the centre. */
const SOAR_LEVEL = 0.055;

/**
 * The bass laid over the bar's (`over`, the croak): one take, on the side this bar's calls
 * come from, high-passed in the stack (or, in a style with no stack, above OVER_HP and a
 * little off centre), told to leave out its own weight.
 */
export function overNote(k: VoiceKit, lane: AudioNode, bar: LofiBar, note: LofiNote, tone: Tone, play: (out: AudioNode, level: number, how: number, tone: Tone) => void): void {
  const how = Math.floor((note.mod ?? 0) / 8);
  const right = bar.index % 2 === 1;
  const bus = busOf(k, lane, bar.tune.mood, bar.tune.seed);
  let out: AudioNode;
  if (bus) out = right ? bus.right : bus.left;
  else {
    let place = OVERS.get(lane);
    if (!place) {
      const pan = k.ctx.createStereoPanner();
      pan.pan.value = OVER_PAN;
      pan.connect(lane);
      place = highpass(k.ctx, OVER_HP, pan);
      OVERS.set(lane, place);
    }
    out = place;
  }
  play(out, note.vel * OVER_LEVEL, how, { ...tone, sub: false });
}

/** Dip the sub under a kick, deeper than the music's duck: the kick owns the low end for its first moment. */
export function duck(lane: AudioNode, at: number, depth: number): void {
  const byMood = BUSES.get(lane);
  if (!byMood) return;
  for (const bus of byMood.values()) {
    const g = bus.duck.gain;
    g.setTargetAtTime(1 - Math.min(0.9, SUB_DUCK * depth), at, 0.004);
    g.setTargetAtTime(1, at + 0.04, 0.09);
  }
}
/** How far the sub dips under a kick, per unit of the style's duck. */
const SUB_DUCK = 0.45;

/** A bar's start: the stack's width and top for its section. A build widens bar by bar (`buildBars` is how many bars into the build). */
export function mark(k: VoiceKit, lane: AudioNode, bar: LofiBar, at: number, buildBars: number): void {
  const bus = busOf(k, lane, bar.tune.mood, bar.tune.seed);
  if (!bus) return;
  const { plan } = bus;
  const w = bar.section === 'drop' ? plan.width : bar.section === 'build' ? plan.width * Math.min(1, 0.3 + 0.15 * buildBars) : plan.width * 0.3;
  bus.panL.pan.setTargetAtTime(-w, at, 0.08);
  bus.panR.pan.setTargetAtTime(w, at, 0.08);
  bus.top.gain.setTargetAtTime(bar.section === 'drop' ? plan.top : 0, at, 0.05);
}
