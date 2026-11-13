// SPDX-License-Identifier: MPL-2.0
/**
 * The guitars of grunge, stoner rock and shoegaze, built on the modelled strings and the
 * amp model in lofi-voices.ts:
 * - clean: a clean electric heard at the neck pickup through a chorus pedal, two short
 *   delays swaying a few milliseconds either side of the dry string, one each side, the
 *   watery, shimmering tone of a grunge verse;
 * - fuzz: a power chord through a fuzz pedal into a big valve amp, looser in the low end
 *   than metal's and less scooped, double-tracked, the wall of a grunge chorus;
 * - wall: shoegaze's full chords swelling in through a softer fuzz, each string swaying
 *   with the tremolo arm, so the chord blurs into one wash that the room then smears.
 */
import { ampInput, pluckLevel, strings, stringBuffer, mtof, EPS, type Amp, type VoiceKit } from './lofi-voices.ts';
import { electricString, ENDS, leadOf, type ElectricSpec } from './lofi-electric.ts';
import { ELECTRIC_CHOKE, ELECTRIC_DEAD, ELECTRIC_FRET, ELECTRIC_PALM } from '../../../../engine/src/lofi-compose.ts';

export const GUITAR_KEYS = new Set<string>(['clean', 'fuzz', 'wall', 'electric']);

/** A fuzz pedal into a big valve amp: a great deal of gain, the low end left loose and big, the mids only a little scooped. */
const FUZZ_AMP: Amp = { gain: 22, tight: 75, push: [600, 3], low: [100, 6], mids: [750, -4], presence: [2400, 2], cab: 4400, level: 0.065 };
/** Shoegaze's fuzz: softer, the mids left in and the top rolled off, so a chord is a wash rather than a bite. */
const WALL_AMP: Amp = { gain: 9, tight: 90, push: [700, 2], low: [140, 3], mids: [1200, 2], presence: [2600, -2], cab: 3600, level: 0.05 };

export function keys(style: string, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod = 0): void {
  if (style === 'electric') electricKeys(k, out, t, midi, vel, dur, mod);
  else if (style === 'clean') clean(k, out, t, midi, vel, dur);
  else if (style === 'fuzz') fuzz(k, out, t, midi, vel, dur);
  else wall(k, out, t, midi, vel, dur);
}

/** A power chord an octave below the note (root, fifth, the octave on held chords) through the fuzz, double-tracked; a short note is palm-muted. */
function fuzz(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const root = mtof(midi - 12);
  const chug = dur < 0.18;
  strings(k, ampInput(k, out, FUZZ_AMP, true), t, chug ? [root, root * 1.5] : [root, root * 1.5, root * 2], vel, dur, chug, false);
}

/** One string of a shoegaze chord: it swells in over a tenth of a second and sways with the tremolo arm, through the soft fuzz. */
function wall(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const swell = k.ctx.createGain();
  swell.gain.setValueAtTime(EPS, t);
  swell.gain.exponentialRampToValueAtTime(1, t + 0.1);
  swell.connect(ampInput(k, out, WALL_AMP, true));
  strings(k, swell, t, [mtof(midi)], vel, Math.max(dur, 0.6), false, true);
}

/** A chorus pedal per output: the dry signal, and two short delays swaying either side of it, one each side. */
const CHORUSES = new WeakMap<AudioNode, GainNode>();
function chorusInput(k: VoiceKit, out: AudioNode): GainNode {
  const ready = CHORUSES.get(out);
  if (ready) return ready;
  const { ctx } = k;
  const input = ctx.createGain();
  input.connect(out);
  for (const [pan, rate, base] of [[-0.7, 0.62, 0.007], [0.7, 0.83, 0.0095]] as const) {
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = base;
    const sway = ctx.createOscillator();
    sway.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = 0.0028;
    sway.connect(depth).connect(delay.delayTime);
    sway.start(ctx.currentTime);
    const side = ctx.createStereoPanner();
    side.pan.value = pan;
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    input.connect(delay).connect(wet).connect(side).connect(out);
  }
  CHORUSES.set(out, input);
  return input;
}

/** A clean electric string at the neck pickup, through the chorus: the note rings until the hand lets go. */
function clean(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number): void {
  const { ctx } = k;
  const hard = vel >= 0.6;
  const src = ctx.createBufferSource();
  src.buffer = stringBuffer(ctx, { f: mtof(midi), seconds: 2.4, pickAt: 0.15, bright: hard ? 16 : 10, decay: 3.5, mellow: 10, pickup: 0.25, noise: 0.15, top: 5500 }, k.rng() < 0.5 ? 0 : 1);
  src.detune.value = (k.rng() - 0.5) * 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(CLEAN_LEVEL * pluckLevel(vel), t);
  g.gain.setTargetAtTime(EPS, t + Math.max(0.1, dur), 0.08);
  src.connect(g).connect(chorusInput(k, out));
  src.start(t);
  src.stop(t + Math.max(0.1, dur) + 0.6);
}
/** The clean guitar's level against the other plucked keys. */
const CLEAN_LEVEL = 0.4;

// ── the single-coil electric through a small valve amp (measured, see lib/lofi-electric.ts) ──

/** The recorded strengths: gently, firmly, hard. */
function layerOf(vel: number): 0 | 1 | 2 {
  return vel < 0.55 ? 0 : vel < 0.78 ? 1 : 2;
}

/** The strokes rendered so far, per context: one recording per note, fret, strength, damping and length, played back by every stroke. */
const ELECTRIC = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
/** A stroke's recording from the string model, made on first use. Two variants of each, so repeats differ. */
export function electricBuffer(ctx: BaseAudioContext, spec: Omit<ElectricSpec, 'sr'>, variant: number): AudioBuffer {
  let cache = ELECTRIC.get(ctx);
  if (!cache) { cache = new Map(); ELECTRIC.set(ctx, cache); }
  const key = `${spec.f.toFixed(2)}|${spec.fret}|${spec.pick}|${spec.layer}|${spec.damp ?? "ring"}|${spec.seconds}|${spec.lead ?? 0}|${spec.end ?? "-"}|${spec.endDamp ?? "-"}|${variant}`;
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 400) cache.clear();
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    let a = h;
    const rand = (): number => {
      a = (a + 0x6d2b79f5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const data = electricString({ ...spec, sr: ctx.sampleRate }, rand);
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    cache.set(key, buf);
  }
  return buf;
}

/** Render lengths (s): a stroke takes the shortest that holds it, so a short note costs little and shares its recording. */
const LENGTHS = [0.5, 1.2, 2.5, 5] as const;

/**
 * The valve amp's curve: a valve's soft knee, leaning to one side (its even harmonics),
 * exactly zero at silence. Driven at the edge of breakup, one note stays nearly clean and
 * a chord or a hard stroke squashes and grows its harmonics, as the measured hard strokes
 * did: their partials read nearer to exact multiples than the soft strokes' (distortion
 * adds exact multiples), and they kept 5 to 8 dB more of their level a few seconds in.
 */
/** The shaper's input range: inputs beyond it clip flat. */
const VALVE_RANGE = 4;
const VALVE_CURVE = ((): Float32Array<ArrayBuffer> => {
  const n = 4097;
  const c = new Float32Array(n);
  const lean = 0.18;
  const raw = (x: number): number => Math.tanh(x + lean) - Math.tanh(lean);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * VALVE_RANGE;
    c[i] = raw(x);
  }
  return c;
})();
/** One of the amp's filters: a Web Audio biquad's type, frequency (Hz), Q and gain (dB). */
interface Biquad { type: BiquadFilterType; hz: number; q: number; db?: number }
/** The amp's mids pushed a little before the valve, so a chord's body breaks up first. */
const PRE: readonly Biquad[] = [{ type: 'peaking', hz: 550, q: 1, db: 2 }];
/**
 * The amp's tone and the cabinet after the valve, fitted to the recorded notes partial by
 * partial (with the strings and pickups above): against 600 Hz, 18 dB down at 70 Hz and 6
 * at 110 (an open-backed 1x12 gives little under its speaker's resonance), level from 200
 * to 600 Hz, a shallow dip near 850 Hz, the speaker's presence 6 dB up from 1.7 to 2.6 kHz,
 * then its fall: 6 dB down by 4.5 kHz, 15 by 5.6 kHz and 37 by 8 kHz.
 */
const CAB: readonly Biquad[] = [
  { type: 'highpass', hz: 120, q: 0.7 },
  { type: 'highpass', hz: 120, q: 0.75 },
  { type: 'peaking', hz: 850, q: 1.3, db: -4 },
  { type: 'peaking', hz: 2600, q: 0.7, db: 9 },
  { type: 'lowpass', hz: 5488, q: 0.8 },
  { type: 'lowpass', hz: 5936, q: 0.6 },
  { type: 'lowpass', hz: 6496, q: 0.55 },
  { type: 'lowpass', hz: 7280, q: 0.52 },
  { type: 'peaking', hz: 7600, q: 0.9, db: -10 },
];
/**
 * How hard a note's strings drive the amp, and the amp's level out, set against the drive
 * so a quiet note comes out as loud whatever the drive. Fitted on chords as well as single
 * notes: driven harder (6), a three-string skank carried 9 to 11 dB more under 200 Hz than
 * the recorded notes playing the same part (the strings' difference tones), and at 3.5 the
 * chord's low end matched while the single notes matched better than before.
 * The level puts the electric's part with the keys it shares its styles with, measured
 * soloed and K-weighted over the loudest fifth of a tune: a skank within a decibel or two
 * of the organ and the jazz guitar, funk's scratch of the Rhodes. It is set here, not as
 * the keys' VARIANT, because this guitar's velocity chooses how hard it is picked.
 */
const VALVE_DRIVE = 3.5, VALVE_LEVEL = 0.67 / VALVE_DRIVE;
/** How a stroke's velocity sets its level into the amp: pluckLevel to this power (fitted to the three recorded strengths' spread). */
const VEL_CURVE = 1.9;
/** Where the pick strikes (mm from the bridge): PICK_AT, or PICK_STEP or twice it further along, a little different each stroke. */
const PICK_AT = 75, PICK_STEP = 10;

/** The amp and cabinet, built once per output and left running: every stroke's strings go in together, so a chord breaks up as one. */
const VALVES = new WeakMap<AudioNode, GainNode>();
export function valveInput(k: VoiceKit, out: AudioNode): GainNode {
  const ready = VALVES.get(out);
  if (ready) return ready;
  const { ctx } = k;
  const input = ctx.createGain();
  input.gain.value = VALVE_DRIVE / VALVE_RANGE;
  const ws = ctx.createWaveShaper();
  ws.curve = VALVE_CURVE;
  ws.oversample = k.hq ? '4x' : '2x';
  const chain = (from: AudioNode, filters: readonly Biquad[]): AudioNode => filters.reduce<AudioNode>((node, f) => {
    const b = ctx.createBiquadFilter();
    b.type = f.type;
    b.frequency.value = f.hz;
    b.Q.value = f.q;
    if (f.db !== undefined) b.gain.value = f.db;
    return node.connect(b);
  }, from);
  const node = chain(chain(input, PRE).connect(ws), CAB);
  const level = ctx.createGain();
  level.gain.value = VALVE_LEVEL;
  node.connect(level).connect(out);
  VALVES.set(out, input);
  return input;
}

/** How one electric stroke is played. */
export interface ElectricStroke {
  /** The fret it is fingered at (0 an open string). */
  fret: number;
  /** Where the pick strikes, as a fraction of the sounding length from the bridge. */
  pick?: number;
  damp?: 'ring' | 'palm' | 'dead';
  /** The fretting hand lets go as the note ends: the strings stop in a few hundredths of a second, the top first. */
  choke?: boolean;
  /** Bend up into the note from this many semitones below over `bendTime` (s), and a vibrato of this many cents once it is held. */
  bend?: number; bendTime?: number; vibrato?: number;
}

/** How long a scratch sounds before the fretting hand stops it (s): as the recorded notes stopped this soon sound crisp. */
const SCRATCH = 0.03;

/** One stroke of a single-coil electric into the valve amp. */
export function electricNote(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, o: ElectricStroke): void {
  const { ctx } = k;
  const damp = o.damp ?? 'ring';
  const layer = layerOf(vel);
  const variant = k.rng() < 0.5 ? 0 : 1;
  // The pick's contact before the string sounds at `t`, a little different in the two variants; a scratch has none.
  const lead = damp === 'dead' ? 0 : leadOf(layer, variant);
  // How the note is stopped, and when (to 5 ms, so strokes of one length share a recording):
  // a scratch sounds for a moment and the fretting hand kills it, a choked chord as the
  // fingers let go, a ringing note lifted off when its time is up.
  const hold = damp === 'dead' ? SCRATCH : Math.max(0.03, dur);
  const endDamp = damp === 'dead' ? 'mute' as const : o.choke ? 'choke' as const : 'lift' as const;
  const end = Math.round(hold / 0.005) * 0.005;
  const tail = 60 / ENDS[endDamp][0];
  const seconds = LENGTHS.find(s => s >= lead + end + tail) ?? LENGTHS[LENGTHS.length - 1]!;
  const fret = Math.max(0, Math.min(20, Math.round(o.fret)));
  const pick = o.pick ?? (PICK_AT + Math.round(k.rng() * 2) * PICK_STEP) / (648 * 2 ** (-fret / 12));
  const src = ctx.createBufferSource();
  src.buffer = electricBuffer(ctx, { f: mtof(midi), seconds, fret, pick: Math.round(pick * 200) / 200, layer, damp: damp === 'dead' ? 'ring' : damp, lead, end, endDamp }, variant);
  src.detune.value = (k.rng() - 0.5) * 4;
  if (o.bend) {
    const from = 2 ** (-o.bend / 12);
    src.playbackRate.setValueAtTime(from, t);
    src.playbackRate.setValueAtTime(from, t + 0.02);
    src.playbackRate.exponentialRampToValueAtTime(1, t + 0.02 + (o.bendTime ?? 0.15));
  }
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4 + k.rng() * 0.8;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + Math.min(0.25, hold * 0.4));
    depth.gain.linearRampToValueAtTime(o.vibrato, t + Math.min(0.6, hold * 0.8));
    lfo.connect(depth).connect(src.detune);
    lfo.start(t);
    lfo.stop(t + hold + tail + 0.05);
  }
  const g = ctx.createGain();
  g.gain.value = ELECTRIC_LEVEL * pluckLevel(vel) ** VEL_CURVE;
  src.connect(g).connect(valveInput(k, out));
  // The pick touches the string `lead` before it sounds; a stroke due sooner than that starts part way in.
  const at = t - lead, now = ctx.currentTime;
  if (at >= now) src.start(at);
  else src.start(now, now - at);
  src.stop(Math.max(at, now) + Math.min(seconds, lead + end + tail));
}
/** The electric's level into its amp. */
const ELECTRIC_LEVEL = 1;

/** The electric as the keys: a chord's note, played as the composer and the performer marked it in `mod`. */
function electricKeys(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod: number): void {
  const flags = mod % ELECTRIC_FRET;
  const fret = Math.floor(mod / ELECTRIC_FRET);
  electricNote(k, out, t, midi, vel, dur, {
    fret,
    damp: flags & ELECTRIC_DEAD ? 'dead' : flags & ELECTRIC_PALM ? 'palm' : 'ring',
    choke: (flags & ELECTRIC_CHOKE) !== 0,
  });
}
