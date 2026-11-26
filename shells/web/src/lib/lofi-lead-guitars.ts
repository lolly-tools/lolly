// SPDX-License-Identifier: MPL-2.0
/**
 * The lead guitars, all played on the measured electric string (lib/lofi-electric.ts) and
 * fingered where the lead guitarist's hand is (lib/lofi-perform.ts):
 * - guitar: the single-coil electric on its neck and middle pickups through the small
 *   valve amp at the edge of breakup, as measured, played as a lead: single notes, bends,
 *   slides and a finger vibrato on the held notes;
 * - twang: the same guitar an octave down on its bridge pickup, through the amp's tremolo;
 * - chorus: the guitar on its neck and middle pickups through a chorus pedal into the clean
 *   twin amp (lib/lofi-surf.ts), yacht rock's clean guitar, which plays its fills too;
 * - overdrive, riff and metal: the bridge pickup into a valve amp turned up, three settings
 *   of one amp (below): a cranked amp for the overdrive solo, a mid-forward crunch an
 *   octave down for the riff, and a high-gain lead for metal, which is double-tracked: the
 *   part played twice, one take on each side, the second through another amp (doubleTrack).
 *   The overdrive's solo stays a single take, as every recorded solo measured here was one.
 *
 * The high-gain amp is built as one is: gain stages in a row, each a triode's curve (the
 * top of the swing clipping before the bottom, its even harmonics) with a coupling
 * capacitor's high-pass and the valve's own treble roll-off after it, then the tone stack
 * (bass, a mid cut, treble), a push-pull power stage with its presence and resonance, and a
 * closed-back 4x12 cabinet. Before the amp, the pickup's own resonance with the cable: in a
 * clean amp it is part of the tone after the fact, but a high-gain amp clips what reaches
 * it, so how much of the string's top gets there sets how clean the clipped note is.
 *
 * Everything is fitted to recordings, used for measurement only (nothing recorded is in
 * this repository, only numbers):
 * - the cabinet to a measured one, a plywood 4x12 loaded with Vintage 30s and a dynamic
 *   microphone at the grille: within a decibel rms of its response from 60 Hz to 6 kHz (a
 *   sixth of an octave smoothed), its thump near 160 Hz, its presence at 2.5 kHz and its
 *   fall above 6 kHz;
 * - metal's setting to distorted single notes (the open string and the twelfth fret of each
 *   string) and to a high-gain lick, together, as the two disagree by 10 dB above 4 kHz:
 *   a held note's octave bands from 125 Hz to 4 kHz within about 2 dB of the notes' (the
 *   median over the notes), and a held note as flat as theirs (within a decibel on average
 *   from a fifth of a second to two seconds, where the bare string falls about 10 dB);
 * - the overdrive's to a lick played on a humbucking guitar through a 50 W valve amp, and
 *   the riff's to a melody played through an overdriven valve amp (each lick's spectrum by
 *   third octaves, the model playing the same notes).
 */
import { chorusInput, electricNote, valveInput } from './lofi-guitars.ts';
import { twinInput } from './lofi-surf.ts';
import type { VoiceKit } from './lofi-voices.ts';
import type { SectionPart } from './lofi-winds.ts';
import { fretFor, LEAD_BEND, LEAD_SLIDE, TUNING } from './lofi-perform.ts';
import { ELECTRIC_FRET } from '../../../../engine/src/lofi-compose.ts';

export const LEAD_GUITARS = new Set<string>(['guitar', 'overdrive', 'metal', 'riff', 'twang', 'chorus']);

// ── the high-gain valve amp ─────────────────────────────────────────────────────

/** One triode gain stage: its gain, how much later the bottom of the swing clips than the top, and the coupling high-pass and the treble roll-off after it (Hz). */
export interface Stage { gain: number; lean: number; hp: number; lp: number }
/** A setting of the amp. */
export interface Voicing {
  /** The input's low cut (Hz), and the first stage's bright lift ([Hz, dB]). */
  input: number; bright: readonly [number, number];
  /** The pickup's own resonance with the cable's capacitance, a low-pass before the amp ([Hz, Q in dB]). */
  pickup: readonly [number, number];
  stages: readonly Stage[];
  /** The tone stack: the bass (a low shelf), the mid cut ([Hz, dB, Q]) and the treble (a high shelf). */
  bass: readonly [number, number]; mid: readonly [number, number, number]; treble: readonly [number, number];
  /** The power stage: how hard it is driven, its presence (a high shelf) and resonance (a low peak). */
  power: number; presence: readonly [number, number]; resonance: readonly [number, number];
  /** The amp's level out. */
  level: number;
}

/** A Web Audio biquad: type, frequency (Hz), Q (dB for a low- or high-pass) and gain (dB). */
type Biquad = readonly [BiquadFilterType, number, number, number?];
/**
 * The 4x12 cabinet and its microphone, fitted to the measured cabinet's response with Web
 * Audio's own filter formulas: 10 dB down at 63 Hz and 7 at 80 against 600 Hz to 2 kHz, 4 dB
 * up from 125 to 200 Hz, level through the mids, 2 dB up at 2.5 kHz, 10 dB down at 6.3 kHz
 * and 23 at 8 kHz (the measured cabinet 29). Its one miss is a narrow dip near 630 Hz.
 */
export const CAB_4X12: readonly Biquad[] = [
  ['highpass', 121, 5.44], ['highpass', 43, 6],
  ['peaking', 289, 0.42, 11], ['peaking', 801, 2.5, 1.3], ['peaking', 1132, 2.5, 5.9],
  ['peaking', 2228, 2.5, 8.9], ['peaking', 5737, 2.5, 9.5],
  ['lowpass', 4383, 6], ['lowpass', 4464, -1.17], ['lowpass', 12211, 6], ['lowpass', 12291, 6],
];
/** The cabinet's fitted sections sum to this much gain through the mids (dB): taken back out, so the voicing's level is the level. */
export const CAB_GAIN = 9.2;

/** The curves' input range: beyond it a stage is flat. */
const RANGE = 8;
/**
 * A triode's curve over -RANGE to RANGE: the top of the swing (grid current) clipping like
 * tanh, the bottom (cut-off) `1 + lean` times further down and softer, exactly zero at
 * silence and of slope one there.
 */
export function triodeCurve(lean: number, n = 4097): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  const low = 1 + lean;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * RANGE;
    c[i] = x >= 0 ? Math.tanh(x) : low * Math.tanh(x / low);
  }
  return c;
}
const CURVES = new Map<number, Float32Array<ArrayBuffer>>();
function curveOf(lean: number): Float32Array<ArrayBuffer> {
  let c = CURVES.get(lean);
  if (!c) { c = triodeCurve(lean); CURVES.set(lean, c); }
  return c;
}

/** Each output's amps, by voicing, built once and left running: every note goes through the one amp, so a slide or a held note under the next distorts as one. */
const AMPS = new WeakMap<AudioNode, Map<Voicing, GainNode>>();
export function driveInput(k: VoiceKit, out: AudioNode, v: Voicing): GainNode {
  let byVoicing = AMPS.get(out);
  if (!byVoicing) { byVoicing = new Map(); AMPS.set(out, byVoicing); }
  const ready = byVoicing.get(v);
  if (ready) return ready;
  const { ctx } = k;
  const filter = ([type, hz, q, db]: Biquad): BiquadFilterNode => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = hz;
    b.Q.value = q;
    if (db !== undefined) b.gain.value = db;
    return b;
  };
  const gain = (g: number): GainNode => { const n = ctx.createGain(); n.gain.value = g; return n; };
  const shaper = (curve: Float32Array<ArrayBuffer>): WaveShaperNode => {
    const ws = ctx.createWaveShaper();
    ws.curve = curve;
    ws.oversample = k.hq ? '4x' : '2x';
    return ws;
  };
  const input = gain(1);
  const nodes: AudioNode[] = [filter(['lowpass', v.pickup[0], v.pickup[1]]), filter(['highpass', v.input, 0]), filter(['peaking', v.bright[0], 0.7, v.bright[1]])];
  for (const s of v.stages) nodes.push(gain(s.gain / RANGE), shaper(curveOf(s.lean)), filter(['highpass', s.hp, -3]), filter(['lowpass', s.lp, -3]));
  nodes.push(filter(['lowshelf', v.bass[0], 0, v.bass[1]]), filter(['peaking', v.mid[0], v.mid[2], v.mid[1]]), filter(['highshelf', v.treble[0], 0, v.treble[1]]));
  nodes.push(gain(v.power / RANGE), shaper(curveOf(0)), filter(['highshelf', v.presence[0], 0, v.presence[1]]), filter(['peaking', v.resonance[0], 1.2, v.resonance[1]]));
  for (const b of CAB_4X12) nodes.push(filter(b));
  nodes.push(gain(v.level * 10 ** (-CAB_GAIN / 20)));
  nodes.reduce<AudioNode>((from, n) => from.connect(n), input).connect(out);
  byVoicing.set(v, input);
  return input;
}

/** Metal's lead: three stages driven hard, the lows tightened before the second, the mids scooped deep. */
export const METAL: Voicing = {
  input: 80, bright: [2500, 3], pickup: [3200, 3],
  stages: [{ gain: 4.6, lean: 0.4, hp: 237, lp: 9000 }, { gain: 30, lean: 0.6, hp: 86, lp: 7000 }, { gain: 4, lean: 0.3, hp: 60, lp: 5400 }],
  bass: [120, 0], mid: [1150, -15, 0.6], treble: [3000, 1],
  power: 0.5, presence: [3500, 2], resonance: [110, 3],
  level: 0.1,
};
/** The overdrive solo: a cranked amp, two stages, the lows left in, a dip high in the mids. */
export const CRANKED: Voicing = {
  input: 70, bright: [2500, 2], pickup: [3200, 3],
  stages: [{ gain: 10, lean: 0.4, hp: 64, lp: 9000 }, { gain: 20, lean: 0.5, hp: 46, lp: 5400 }],
  bass: [150, -1], mid: [1875, -10, 1.05], treble: [3000, -4],
  power: 0.8, presence: [3500, 4], resonance: [110, 2],
  level: 0.1,
};
/** The riff: a crunch, less gain, thick in the low mids. */
export const CRUNCH: Voicing = {
  input: 70, bright: [2500, 2], pickup: [3200, 3],
  stages: [{ gain: 2, lean: 0.4, hp: 41, lp: 9000 }, { gain: 7, lean: 0.5, hp: 46, lp: 11800 }],
  bass: [150, 10], mid: [352, 8, 0.8], treble: [2000, -6],
  power: 2, presence: [3500, 8], resonance: [110, 2],
  level: 0.1,
};

/**
 * Metal's second take goes through another amp, as a doubled part is tracked: the same
 * family of high-gain amp, set a little differently (less of the second stage, the scoop
 * lower and shallower, more presence), so the two sides differ in tone as well as in
 * playing.
 */
export const METAL_B: Voicing = {
  input: 80, bright: [2500, 3], pickup: [3200, 3],
  stages: [{ gain: 5.5, lean: 0.4, hp: 180, lp: 9000 }, { gain: 24, lean: 0.6, hp: 86, lp: 7000 }, { gain: 4, lean: 0.3, hp: 60, lp: 5400 }],
  bass: [120, 0], mid: [900, -12, 0.7], treble: [3000, 2],
  power: 0.5, presence: [3500, 3], resonance: [110, 3],
  level: 0.069,
};

// ── the lead guitarist's voices ────────────────────────────────────────────────

/** How each lead guitar is played. */
interface LeadStyle {
  /** Semitones the part sounds from the written line (riff and twang an octave down). */
  shift: number;
  pickup: 'neck-middle' | 'bridge';
  /** How hard the player digs in: the note's velocity scaled into the stroke's strength. */
  dig: number;
  /** The vibrato on a held note: how wide (cents, upward) and the shortest note held long enough for one (s). */
  vibrato: number; vibratoFrom: number;
  /** The note stopped by the picking hand as it ends (choked), or the finger lifted and the string let go. */
  choke: boolean;
  /** The amp: the small valve amp (`null`) or a voicing of the high-gain one. */
  amp: Voicing | null;
  /**
   * The voice's level out of its amp: each lead guitar is as loud as the voice it replaced
   * (soloed in three tunes of the styles that draw it, K-weighted over the loud passages),
   * so the genres' seats for the lead hold.
   */
  level: number;
}
export const LEADS: Record<string, LeadStyle> = {
  guitar: { shift: 0, pickup: 'neck-middle', dig: 1.15, vibrato: 35, vibratoFrom: 0.45, choke: false, amp: null, level: 0.43 },
  twang: { shift: -12, pickup: 'bridge', dig: 1.2, vibrato: 0, vibratoFrom: 9, choke: false, amp: null, level: 0.61 },
  overdrive: { shift: 0, pickup: 'bridge', dig: 1.25, vibrato: 50, vibratoFrom: 0.35, choke: true, amp: CRANKED, level: 0.45 },
  riff: { shift: -12, pickup: 'bridge', dig: 1.25, vibrato: 30, vibratoFrom: 0.45, choke: true, amp: CRUNCH, level: 0.25 },
  metal: { shift: 0, pickup: 'bridge', dig: 1.3, vibrato: 55, vibratoFrom: 0.3, choke: true, amp: METAL, level: 2.36 },
  chorus: { shift: 0, pickup: 'neck-middle', dig: 1.1, vibrato: 30, vibratoFrom: 0.45, choke: false, amp: null, level: 0.125 },
};

// ── double-tracking ──────────────────────────────────────────────────────────

/** The lead guitars played twice, one take on each side. */
export const DOUBLED = new Set<string>(['metal']);
/** How a take is played, from the station (the shape lib/lofi-winds.ts's section players take): its tuning (cents), its level and whether it is the second take, through the second amp. */
export interface TakeHow { detune?: number; gain?: number; second?: boolean }
/** One take of a double-tracked part: a section part with how hard it is picked (against the line's velocity) and whether it is the second. */
export interface GuitarTake extends SectionPart { strength: number; second: boolean }

/**
 * Double-tracking, measured on a heavy rhythm part recorded twice, once for each side (two
 * takes, not a copy: the sides' correlation 0.07 over a minute, though each frame matches
 * the other side to 0.69 at its best lag). The right take came in 17 ms after the left on
 * average, wandering 2 to 3 ms either way note to note, and sat 6 cents from it (the median;
 * 11 cents flat to 14 sharp from one fifth of a second to the next). A copy delayed by a
 * fixed time correlates to 0.95 at that delay and combs, which is why each take here is
 * played, not copied: each its own pick, timing, tuning, vibrato and amp.
 */
export const TAKES = {
  /** Where the takes sit, either side (a stereo panner's place). */
  pan: 0.9,
  /** The second take's lateness against the first (s, its mean and its spread note to note), and the first's own small spread. */
  late: 0.015, lateSpread: 0.003, firstLate: 0.002,
  /** Each guitar's tuning from the note (cents): the two a few cents either side, and each note's own wander. */
  tuning: 1.5, wander: 2,
  /** How much each take's picking strength varies (a share of the velocity). */
  strength: 0.06,
  /**
   * Each take's level, set so the pair measures as loud as the single take did (soloed in
   * four metal tunes, K-weighted, both channels summed: within 0.15 dB in each), and the
   * genres' seats for the lead hold. Two takes add their power, but a single take in the
   * middle reaches both speakers whole, where a panned take shares its power between them:
   * the two nearly balance, and each take sits only a quarter of a decibel down.
   */
  level: 0.97,
};

/** The two takes of a doubled part's note, drawn for every note from the station's seeded source. */
export function doubleTrack(style: string, k: VoiceKit): GuitarTake[] {
  const g = (): number => Math.sqrt(-2 * Math.log(1 - k.rng())) * Math.cos(2 * Math.PI * k.rng());
  const T = TAKES;
  const first = T.firstLate * Math.abs(g());
  const second = first + Math.max(0.004, T.late + T.lateSpread * g());
  const take = (late: number, pan: number, tuning: number, isSecond: boolean): GuitarTake => ({
    voice: style, level: T.level, shift: 0, late, pan, detune: tuning + T.wander * g(),
    strength: 1 + T.strength * g(), second: isSecond,
  });
  // The first take on the left; the second, through the other amp, on the right.
  return [take(first, -T.pan, -T.tuning, false), take(second, T.pan, T.tuning, true)];
}

/** A tremolo per output (twang's): the amp's level swaying at 6.5 Hz, a quarter either way. */
const TREMOLOS = new WeakMap<AudioNode, GainNode>();
function tremoloOut(k: VoiceKit, out: AudioNode): GainNode {
  const ready = TREMOLOS.get(out);
  if (ready) return ready;
  const { ctx } = k;
  const trem = ctx.createGain();
  trem.gain.value = 0.75;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 6.5;
  const depth = ctx.createGain();
  depth.gain.value = 0.25;
  lfo.connect(depth).connect(trem.gain);
  lfo.start(ctx.currentTime);
  trem.connect(out);
  TREMOLOS.set(out, trem);
  return trem;
}
/** Each voice's level out of its amp, per output. */
const LEVELS = new WeakMap<AudioNode, Map<string, GainNode>>();
function levelOut(k: VoiceKit, out: AudioNode, style: string, level: number): GainNode {
  let byStyle = LEVELS.get(out);
  if (!byStyle) { byStyle = new Map(); LEVELS.set(out, byStyle); }
  const key = `${style}:${level}`;
  let g = byStyle.get(key);
  if (!g) { g = k.ctx.createGain(); g.gain.value = level; g.connect(out); byStyle.set(key, g); }
  return g;
}

/** A slide's time a fret (s): the finger crosses a fret in a few hundredths of a second. */
const SLIDE_FRET = 0.03;
/** How long a bend takes to arrive (s): a tone's 200 to 250 ms in the recorded leads, a semitone's a little less. */
const BEND_TIME = 0.22;

/**
 * One note of a lead guitar. `mod` is the performer's (lib/lofi-perform.ts): the
 * articulation (bent, slid or picked), plus the fret times ELECTRIC_FRET. `from` is the
 * note before when this one follows straight on from it: a slide starts there. `how` is a
 * take's, when the part is double-tracked (doubleTrack).
 */
export function lead(style: string, k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod = 0, from?: number, how: TakeHow = {}): void {
  const s = LEADS[style];
  if (!s) return;
  const art = mod % ELECTRIC_FRET;
  const pitch = midi + s.shift;
  // The fret the performer chose, if the note can be played there; otherwise the nearest the middle of the neck.
  const marked = Math.floor(mod / ELECTRIC_FRET);
  const fret = (TUNING as readonly number[]).includes(Math.round(pitch) - marked) ? marked : fretFor(Math.round(pitch), 7);
  let into = levelOut(k, out, style, s.level * (how.gain ?? 1));
  if (style === 'twang') into = tremoloOut(k, into);
  const voicing = how.second && s.amp === METAL ? METAL_B : s.amp;
  // The chorused guitar goes through its pedal into the clean twin.
  const amp = voicing ? driveInput(k, into, voicing) : style === 'chorus' ? chorusInput(k, twinInput(k, into)) : valveInput(k, into);
  // A slide comes from the note before (or two frets below), fret by fret; a bend pushes up a tone.
  const slide = art === LEAD_SLIDE ? Math.max(-5, Math.min(5, from === undefined || from === midi ? 2 : midi - from)) : 0;
  const bend = art === LEAD_BEND && fret >= 2 ? 2 : 0;
  electricNote(k, out, t, pitch, Math.min(1, vel * s.dig), dur, {
    fret,
    pickup: s.pickup,
    choke: s.choke,
    into: amp,
    detune: how.detune ?? 0,
    ...(bend ? { bend, bendTime: BEND_TIME, how: 'bend' as const } : slide ? { bend: slide, bendTime: SLIDE_FRET * Math.abs(slide), how: 'slide' as const } : {}),
    ...(s.vibrato && dur >= s.vibratoFrom ? { vibrato: s.vibrato * (0.8 + k.rng() * 0.4), vibratoAt: bend ? BEND_TIME + 0.05 : Math.min(0.3, dur * 0.35) } : {}),
  });
}
