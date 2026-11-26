// SPDX-License-Identifier: MPL-2.0
/**
 * Surf rock's guitars: the measured single-coil electric (lib/lofi-electric.ts) through a
 * spring reverb unit (lib/lofi-spring.ts) into a big clean amp, as a surf guitarist set up:
 * the guitar into the reverb unit's dwell, the unit's return mixed back with the dry guitar,
 * and both into the amp.
 *
 * - The amp: a clean twin-speaker combo with its headroom, its tone stack's scooped mids and
 *   bright treble, and an open-backed 2x12 that keeps its presence out to 5 kHz before
 *   falling away. Fitted to a single-coil guitar (bridge and middle pickups) recorded through
 *   such an amp with a dynamic microphone (Freesound 55711, 55720, 55696 and 56141, CC0), by
 *   third octaves against 1 kHz on the same chords played by the model.
 * - The lead (`lead`): the bridge pickup, drenched in the spring. A held note is tremolo-
 *   picked, the pick alternating down and up on a sixteenth at the surf tempos (at the
 *   slower ones a sixteenth triplet), which put the picks 10 to 12 a second, where eleven
 *   recorded surf instrumentals' fastest-modulated stretches sat (their medians 8.5 to 14
 *   Hz, a SurfGuitar101.com compilation, CC BY-NC-ND 3.0, measured only). A glissando
 *   keeps picking while the hand slides down the neck, fret by fret, and the long note
 *   that ends a phrase is shaken with the tremolo arm, which only ever lowers the pitch.
 * - The rhythm guitar (`keys`): the neck and middle pickups through the same amp, the
 *   reverb lower in the mix, playing the composer's strokes as the performer fingers them.
 */
import { electricBuffer } from './lofi-guitars.ts';
import { ENDS, leadOf } from './lofi-electric.ts';
import { springInput, type ReverbUnit } from './lofi-spring.ts';
import { mtof, pluckLevel, type VoiceKit } from './lofi-voices.ts';
import { ELECTRIC_CHOKE, ELECTRIC_DEAD, ELECTRIC_FRET, ELECTRIC_PALM, ELECTRIC_SLIDE, SURF_ARM, SURF_GLISS, SURF_TREMOLO } from '../../../../engine/src/lofi-compose.ts';
import { fretFor } from './lofi-perform.ts';

/** The amp's settings: how hard the valves are driven, the tone stack and the cabinet, as Web Audio biquads ([type, Hz, Q, dB]), and its level out. */
export interface TwinAmp { drive: number; filters: Array<[BiquadFilterType, number, number, number]>; level: number }

/**
 * The clean twin: driven gently (a chord's peaks only just round off), the bass a little up,
 * the mids scooped at 1.1 kHz with a small lift at 1.65, the bright treble and the speakers'
 * presence lifting 4 kHz, the open-backed 2x12's low end falling under 90 Hz and its top
 * steeply above 5.6 kHz. Fitted on the model's chords chopped as the recorded skanks were:
 * within 2.0 dB rms of the recordings by third octaves from 315 Hz to 6.3 kHz (each against
 * its 1 kHz band; below 315 Hz the voicings differ too much to compare).
 */
export const TWIN: TwinAmp = {
  drive: 1.4,
  filters: [
    ['highpass', 90, 0.7, 0], ['lowshelf', 250, 0, 1], ['peaking', 1100, 1, -4], ['peaking', 1650, 1.5, 3], ['peaking', 4000, 1.2, 10],
    ['lowpass', 5600, 0.9, 0], ['lowpass', 7200, 0.7, 0], ['peaking', 9000, 1, -12],
  ],
  level: 0.5,
};

/** The amp's curve: a valve's soft knee, leaning a little to one side, zero at silence and slope one there. */
const AMP_RANGE = 4;
const AMP_CURVE = ((): Float32Array<ArrayBuffer> => {
  const c = new Float32Array(4097);
  const lean = 0.12;
  for (let i = 0; i < c.length; i++) {
    const x = ((i / (c.length - 1)) * 2 - 1) * AMP_RANGE;
    c[i] = (Math.tanh(x + lean) - Math.tanh(lean)) / (1 - Math.tanh(lean) ** 2);
  }
  return c;
})();

/** Each output's amp, built once and left running: every string goes through it together. */
const AMPS = new WeakMap<AudioNode, Map<TwinAmp, GainNode>>();
export function twinInput(k: VoiceKit, out: AudioNode, amp: TwinAmp = TWIN): GainNode {
  let byAmp = AMPS.get(out);
  if (!byAmp) { byAmp = new Map(); AMPS.set(out, byAmp); }
  const ready = byAmp.get(amp);
  if (ready) return ready;
  const { ctx } = k;
  const input = ctx.createGain();
  input.gain.value = amp.drive / AMP_RANGE;
  const ws = ctx.createWaveShaper();
  ws.curve = AMP_CURVE;
  ws.oversample = k.hq ? '4x' : '2x';
  let node: AudioNode = input.connect(ws);
  for (const [type, hz, q, db] of amp.filters) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = hz;
    b.Q.value = q;
    b.gain.value = db;
    node = node.connect(b);
  }
  const level = ctx.createGain();
  level.gain.value = (amp.level * AMP_RANGE) / amp.drive;
  node.connect(level).connect(out);
  byAmp.set(amp, input);
  return input;
}

/** The reverb unit's settings: the lead drenched (the dwell up, the tank as loud as the dry guitar), the rhythm guitar's lower. */
export const LEAD_REVERB: ReverbUnit = { dwell: 1.3, mix: 1.0, tone: -2 };
export const RHYTHM_REVERB: ReverbUnit = { dwell: 0.9, mix: 0.5, tone: -3 };

/**
 * Each guitar's level out of its amp, so it stands where the instruments of the other band
 * styles do (measured soloed over a chorus, K-weighted): the rhythm guitar with the electric
 * guitar's skank and the rock guitars, the lead about where the band's lead guitars sit
 * before the genre's seat (lib/lofi-station.ts) places the lead.
 */
export const LEAD_LEVEL = 0.043, RHYTHM_LEVEL = 0.055;

/** Each output's level, per part: a gain after the amp. */
const LEVELS = new WeakMap<AudioNode, Map<number, GainNode>>();
function levelOut(k: VoiceKit, out: AudioNode, level: number): GainNode {
  let byLevel = LEVELS.get(out);
  if (!byLevel) { byLevel = new Map(); LEVELS.set(out, byLevel); }
  let g = byLevel.get(level);
  if (!g) { g = k.ctx.createGain(); g.gain.value = level; g.connect(out); byLevel.set(level, g); }
  return g;
}

/** Render lengths (s): a stroke takes the shortest that holds it, so strokes of one length share a recording. */
const LENGTHS = [0.25, 0.5, 1.2, 2.5, 5] as const;

/** The recorded strengths: gently, firmly, hard. */
const layerOf = (vel: number): 0 | 1 | 2 => (vel < 0.55 ? 0 : vel < 0.78 ? 1 : 2);

/** How one stroke is played. */
interface Stroke {
  fret: number; pickup: 'neck-middle' | 'bridge';
  damp?: 'ring' | 'palm' | 'dead'; choke?: boolean;
  /** The pitch's path from the stroke on: playback rates over `rateTime` seconds from `t` (a slide). */
  rates?: Float32Array<ArrayBuffer>; rateTime?: number;
  /** The tremolo arm shaking the note (one arm for every pick of a tremolo-picked note). */
  arm?: Arm;
  /** A quick slide up from the fret below (the keys' slide). */
  slideUp?: boolean;
}

/** The tremolo arm's shake (Hz) and how much one player's varies. */
const ARM_HZ = 5.2, ARM_SPREAD = 0.6;

/** The tremolo arm on one note: its shake (in cents, to add to each pick's detune), when it starts and when it is fully under way, and half its depth (cents). */
interface Arm { depth: GainNode; begin: number; full: number; half: number }

/** The arm shaking from `begin` to `end`, `cents` deep at its lowest: it only lowers the pitch and lets it back. */
function armOf(k: VoiceKit, begin: number, end: number, cents: number): Arm {
  const { ctx } = k;
  const now = ctx.currentTime;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = ARM_HZ + (k.rng() - 0.5) * ARM_SPREAD;
  const depth = ctx.createGain();
  const half = cents / 2, full = begin + 0.15;
  depth.gain.setValueAtTime(0, Math.max(now, begin - 0.01));
  depth.gain.setValueAtTime(0, Math.max(now, begin));
  depth.gain.linearRampToValueAtTime(half, Math.max(now, full));
  lfo.connect(depth);
  lfo.start(Math.max(now, begin));
  lfo.stop(end + 0.05);
  return { depth, begin, full, half };
}

/** One stroke of the electric into `into`, held `hold` seconds and then let go (or choked, or damped as it rings). */
function stroke(k: VoiceKit, into: AudioNode, t: number, midi: number, vel: number, hold: number, s: Stroke, level: number): void {
  const { ctx } = k;
  const damp = s.damp ?? 'ring';
  const layer = layerOf(vel);
  const variant = k.rng() < 0.5 ? 0 : 1;
  const lead = damp === 'dead' ? 0 : leadOf(layer, variant);
  const held = damp === 'dead' ? 0.03 : Math.max(0.03, hold);
  const endDamp = damp === 'dead' ? 'mute' as const : s.choke ? 'choke' as const : 'lift' as const;
  const end = Math.round(held / 0.005) * 0.005;
  const tail = 60 / ENDS[endDamp][0];
  const seconds = LENGTHS.find(x => x >= lead + end + tail) ?? LENGTHS[LENGTHS.length - 1]!;
  const fret = Math.max(0, Math.min(20, Math.round(s.fret)));
  const pick = (75 + Math.round(k.rng() * 2) * 10) / (648 * 2 ** (-fret / 12));
  const src = ctx.createBufferSource();
  src.buffer = electricBuffer(ctx, { f: mtof(midi), seconds, fret, pick: Math.round(pick * 200) / 200, layer, damp: damp === 'dead' ? 'ring' : damp, lead, end, endDamp, ...(s.pickup === 'bridge' ? { pickup: 'bridge' as const } : {}) }, variant);
  src.detune.value = (k.rng() - 0.5) * 4;
  const at = t - lead, now = ctx.currentTime;
  if (s.rates && t > now) {
    src.playbackRate.setValueAtTime(s.rates[0]!, Math.max(at, now));
    src.playbackRate.setValueCurveAtTime(s.rates, Math.max(t, Math.max(at, now) + 0.002), s.rateTime ?? hold);
  } else if (s.slideUp && t > now) {
    src.playbackRate.setValueAtTime(2 ** (-1 / 12), Math.max(at, now));
    src.playbackRate.setValueAtTime(2 ** (-1 / 12), t + 0.005);
    src.playbackRate.exponentialRampToValueAtTime(1, t + 0.04);
  }
  if (s.arm) {
    // The note's centre moves down by half the arm's depth as the shake comes in, so the pitch swings from the note down and back.
    const { begin, full, half } = s.arm, base = src.detune.value, from = Math.max(now, at);
    if (from >= full) src.detune.setValueAtTime(base - half, from);
    else {
      src.detune.setValueAtTime(base, from);
      if (begin > from) src.detune.setValueAtTime(base, begin);
      src.detune.linearRampToValueAtTime(base - half, full);
    }
    s.arm.depth.connect(src.detune);
  }
  const g = ctx.createGain();
  g.gain.value = level * pluckLevel(vel) ** 1.9;
  src.connect(g).connect(into);
  if (at >= now) src.start(at);
  else src.start(now, now - at);
  src.stop(Math.max(at, now) + Math.min(seconds, lead + end + tail));
}

/** The rhythm guitar: a stroke of the composer's chord, through the reverb unit into the amp. */
export function keys(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod = 0): void {
  const flags = mod % ELECTRIC_FRET;
  const into = springInput(k, twinInput(k, levelOut(k, out, RHYTHM_LEVEL)), RHYTHM_REVERB);
  stroke(k, into, t, midi, vel, dur, {
    fret: Math.floor(mod / ELECTRIC_FRET), pickup: 'neck-middle',
    damp: flags & ELECTRIC_DEAD ? 'dead' : flags & ELECTRIC_PALM ? 'palm' : 'ring',
    choke: (flags & ELECTRIC_CHOKE) !== 0, slideUp: (flags & ELECTRIC_SLIDE) !== 0,
  }, 1);
}

/** Tremolo picking's pace (s a pick): a sixteenth at the surf tempos, a sixteenth triplet where a sixteenth would be slower than 9.5 a second. */
export function pickStep(spb: number): number {
  return 4 / spb >= 9.5 ? spb / 4 : spb / 6;
}

/** How far a glissando slides down the neck (semitones), and how it falls: slow off the note, faster as it goes. */
const GLISS = 17, GLISS_CURVE = 1.6;
/** How deep the arm shakes a phrase's last note (cents, at its lowest), and how far into the note it starts (a share). */
const ARM_DEPTH = 60, ARM_AT = 0.3;

/** A slide down `semitones` over a stroke's life, fret by fret, as playback rates against the stroke's own pitch (from `from` semitones already down). */
export function slideRates(from: number, semitones: number, points = 48): Float32Array<ArrayBuffer> {
  const c = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const down = from + (semitones * i) / (points - 1);
    // Each fret is held a moment and crossed quickly, as a finger slides.
    const whole = Math.floor(down), part = down - whole;
    const cross = part > 0.75 ? ((part - 0.75) / 0.25) ** 2 : 0;
    c[i] = 2 ** (-(whole + cross) / 12);
  }
  return c;
}

/**
 * The lead: one note of the tune, as the composer marked it (SURF_TREMOLO, SURF_GLISS,
 * SURF_ARM) and the performer fingered it (the fret, times ELECTRIC_FRET). `spb` is the
 * tune's seconds a beat, which the picking keeps to.
 */
export function lead(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, mod: number, spb: number): void {
  const art = mod % ELECTRIC_FRET;
  const marked = Math.floor(mod / ELECTRIC_FRET);
  const fret = marked > 0 ? marked : fretFor(Math.round(midi), 7);
  const into = springInput(k, twinInput(k, levelOut(k, out, LEAD_LEVEL)), LEAD_REVERB);
  const s: Stroke = { fret, pickup: 'bridge' };
  const arm = art & SURF_ARM && !(art & SURF_GLISS) ? armOf(k, t + dur * ARM_AT, t + dur + 0.5, ARM_DEPTH) : undefined;
  if (!(art & (SURF_TREMOLO | SURF_GLISS))) {
    stroke(k, into, t, midi, vel, dur, { ...s, ...(arm ? { arm } : {}) }, 1);
    return;
  }
  const step = pickStep(spb);
  const picks = Math.max(1, Math.round(dur / step));
  for (let n = 0; n < picks; n++) {
    const at = t + n * step;
    const last = n === picks - 1;
    const hold = last ? Math.max(step, dur - n * step) : step + 0.012;
    // Down strokes on the beat's picks a little stronger than the up strokes between.
    const v = Math.min(1, vel * (n % 2 === 0 ? 1 : 0.86) * (0.95 + k.rng() * 0.1));
    if (art & SURF_GLISS) {
      // The hand slides down the neck as the pick keeps going, slowly off the note and faster as it falls.
      const pos = (u: number): number => GLISS * Math.min(1, u) ** GLISS_CURVE;
      const from = pos((n * step) / dur), to = pos(((n * step) + hold) / dur);
      stroke(k, into, at, midi, v, hold, { ...s, rates: slideRates(from, Math.max(0.01, to - from)), rateTime: hold }, 1);
    } else {
      stroke(k, into, at, midi, v, hold, { ...s, ...(arm ? { arm } : {}) }, 1);
    }
  }
}
