// SPDX-License-Identifier: MPL-2.0
/**
 * A combo organ: the transistor organ of early-sixties surf, garage and beat bands, built as
 * one is. Twelve top-octave oscillators feed chains of dividers, so every key sounds a
 * square wave locked to the octave above it, and a tab mixes the squares of several
 * footages (8', 4', 2' and on up) and sends them through a fixed filter. Summed an octave
 * apart at halving levels, the squares make a staircase that is nearly a sawtooth: the
 * buzzy, reedy tone of the "violin" and "strings" tabs. One vibrato oscillator swings every
 * key's pitch together. A key is a switch: it sounds at once, its contacts bounce as they
 * close, and it stops as soon as it is let go.
 *
 * The tab's harmonics, the vibrato and the keying are fitted to recordings, used for
 * measurement only (no recording is in this repository, only numbers):
 * - a combo organ's "violin" tab, recorded direct (Freesound pack 22529, twelve notes from
 *   B2 to C7, CC0): its harmonics are the divider staircase's (the 4' square 5.9 dB under
 *   the 8', the 2' 9.5, the 1' 13.7, the half-foot 18, each divider stage's square a little
 *   quieter the higher it sounds, 12 dB from 100 Hz to 12.8 kHz) with a flute under the 8'
 *   lifting its fundamental 3.3 dB, through a filter that cuts 14.8 dB at 100 Hz and 6.4 at
 *   200, is level from 560 Hz to 1.1 kHz and falls 1.2 dB by 3.2 kHz and 2.2 by 12.8 kHz:
 *   within 0.63 dB rms over 225 harmonics (each the power within a quarter of the note
 *   either side, so the vibrato does not blur it; 0.51 weighted by their amplitude). Its
 *   notes rise 0.15 dB a semitone up the keyboard beyond that (within 0.7 dB on every note).
 *   Its vibrato is the same on
 *   every key: 6.25 Hz, 5.8 cents on the beat and 3.4 cents on twice the beat, so the pitch
 *   swings 4.6 cents sharp and 9.2 flat. Its twelve pitches sit within a cent of each other
 *   in every octave (C 0.8 cents flat of the mean, D sharp on it, B 0.8 sharp);
 * - a Junost 75 transistor organ with all four registers out (Freesound 504950, CC0): pure
 *   squares an octave apart (the 16' 0 dB, the 8' +3.9, the 4' +2.5, the 2' -1.2) under a
 *   filter level to 1 kHz and falling 2.8 dB by 2.3 kHz, 6.3 by 4.5 and 14 by 9 (1.5 dB
 *   rms); a key rising from 40 dB down to 1 dB under its level in 0 to 5 ms, and falling 20
 *   dB in 3.5 to 8.5 ms (median 5) once let go.
 *
 * The station plays the violin tab; the full registration is here for a part that wants
 * a rounder organ.
 */
import { mtof, type VoiceKit } from './lofi-voices.ts';

/**
 * A tab: its footages' levels (dB), the lowest first, an octave apart; how many octaves the
 * lowest sounds from the key (0 at 8', -1 at 16'); its filter as [Hz, dB] points; and how
 * loud each divider stage's square is by the pitch it sounds ([Hz, dB] points, level if
 * left out), since the 4' of one key is the 8' of the key an octave up; and a flute (a near
 * sine on the lowest footage) mixed under it, as a share of that footage's fundamental;
 * and the tab's level against the violin tab's (dB), so every tab plays a chord as loud.
 */
export interface Tab { footages: readonly number[]; shift: number; filter: ReadonlyArray<readonly [number, number]>; stage?: ReadonlyArray<readonly [number, number]>; flute?: number; level?: number }

/** The filter's points, half an octave apart from 100 Hz to 12.8 kHz. */
const NODES = [100, 141, 200, 283, 400, 566, 800, 1131, 1600, 2263, 3200, 4525, 6400, 9051, 12800] as const;
const at = (db: readonly number[]): ReadonlyArray<readonly [number, number]> => NODES.map((hz, i) => [hz, db[i]!] as const);

/** The violin tab: the 8' divider staircase through its fitted filter. */
export const VIOLIN: Tab = {
  shift: 0, footages: [0, -5.9, -9.5, -13.7, -18],
  filter: at([-14.8, -10.4, -6.4, -3.1, -0.9, -0.1, 0.2, -0.1, -0.6, -1.1, -1.2, -1.4, -1.6, -1.9, -2.2]),
  stage: at([4.2, 3.7, 3, 2, 0.8, -0.4, -1.2, -1.9, -2.7, -3.6, -4.3, -5.1, -5.9, -6.8, -7.7]),
  flute: 10 ** (3.3 / 20) - 1,
};
/** Every register out: squares from 16' to 2', the top rolled off. */
export const FULL: Tab = { shift: -1, footages: [0, 3.9, 2.5, -1.2], filter: at([0, 0.2, 0.4, 0.5, 0.6, 0.5, 0.3, -0.1, -1.1, -2.8, -4.3, -6.3, -9.5, -14.3, -22.3]), level: -6.6 };

/** How much louder the violin tab's notes are a semitone up the keyboard (dB), about C5. */
const KEY_SLOPE = 0.15;
/** The twelve top-octave oscillators' tuning against equal temperament (cents, C to B): every octave of a key shares its oscillator's. */
const TOP_OCTAVE = [-0.8, 0.4, -0.3, 0, 0.7, -0.5, 0.2, 0.9, -0.6, 0.3, -0.2, 0.8] as const;
/** The vibrato: its rate (Hz), and its swing on the beat and on twice the beat (cents; the second against the first's, opposed). */
const VIBRATO_HZ = 6.25, VIBRATO_1 = 5.77, VIBRATO_2 = 3.43;
/** The key's contacts bouncing as they close: open and closed again within this long (s). */
const BOUNCE = [0.0004, 0.0009] as const;
/** A key let go: the time constant of the fall (s), 20 dB in under 4 ms. */
const RELEASE = 0.0016;
/** The highest harmonic worth sending (Hz): past this the filters are well down. */
const TOP = 15000;
/** The organ's level against the voices it plays beside: one held chord as loud, K-weighted, as the tonewheel organ's. */
const LEVEL = 0.0231;

/** A piecewise-linear table on a log scale of frequency, flat past its ends. */
function tableAt(table: ReadonlyArray<readonly [number, number]>, hz: number): number {
  if (hz <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [h1, v1] = table[i]!;
    if (hz <= h1) {
      const [h0, v0] = table[i - 1]!;
      return v0 + ((v1 - v0) * Math.log(hz / h0)) / Math.log(h1 / h0);
    }
  }
  return table[table.length - 1]![1];
}

/**
 * The amplitude of each harmonic of the tab's lowest footage, for a key of `f` Hz: harmonic n
 * (2^k times an odd m) is the k-th footage's square's m-th harmonic, 1 / m of that square's
 * level (its footage's and its divider stage's), through the tab's filter. Index 0 is the
 * steady push (none); `top` limits the band.
 */
export function tabHarmonics(tab: Tab, f: number, top = TOP): Float32Array<ArrayBuffer> {
  const f0 = f * 2 ** tab.shift;
  const count = Math.max(1, Math.floor(top / f0));
  const out = new Float32Array(count + 1);
  for (let n = 1; n <= count; n++) {
    let m = n, k = 0;
    while (m % 2 === 0) { m /= 2; k++; }
    const foot = tab.footages[k];
    if (foot === undefined) continue;
    const stage = tab.stage ? tableAt(tab.stage, f0 * 2 ** k) : 0;
    out[n] = ((4 / Math.PI) * 10 ** ((foot + stage + tableAt(tab.filter, n * f0)) / 20) / m) * (n === 1 ? 1 + (tab.flute ?? 0) : 1);
  }
  return out;
}

/** A key's loudness on the violin tab against C5 (dB). */
export const keyLevel = (midi: number): number => KEY_SLOPE * (midi - 72);

/** Each context's waves, by tab and key: made on first use. */
const WAVES = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function waveOf(ctx: BaseAudioContext, tab: Tab, midi: number): PeriodicWave {
  let byKey = WAVES.get(ctx);
  if (!byKey) { byKey = new Map(); WAVES.set(ctx, byKey); }
  const key = `${tab === VIOLIN ? 'v' : tab === FULL ? 'f' : tab.footages.join(',')}|${midi}`;
  let wave = byKey.get(key);
  if (!wave) {
    const imag = tabHarmonics(tab, mtof(midi), Math.min(TOP, ctx.sampleRate * 0.45));
    wave = ctx.createPeriodicWave(new Float32Array(imag.length), imag, { disableNormalization: true });
    byKey.set(key, wave);
  }
  return wave;
}

/** The organ's vibrato at `t` seconds on the audio clock (cents): one oscillator for every key, swinging further flat than sharp. */
export function vibratoCents(t: number): number {
  const theta = 2 * Math.PI * VIBRATO_HZ * t;
  return VIBRATO_1 * Math.cos(theta) - VIBRATO_2 * Math.cos(2 * theta);
}

/** The vibrato's phase steps: each key's vibrato starts at the organ's phase at its start, to the nearest of these. */
const PHASES = 64;
/** Each context's vibrato waves, by phase step. */
const VIBRATOS = new WeakMap<BaseAudioContext, PeriodicWave[]>();
/**
 * The vibrato for a key starting at `t`: in cents, at the organ's phase then, so every key
 * swings with every other, as one oscillator swings a whole organ. Rotating the wave by the
 * phase is what lets each key carry its own oscillator and stop with the key.
 */
function vibratoAt(ctx: BaseAudioContext, t: number): PeriodicWave {
  let waves = VIBRATOS.get(ctx);
  if (!waves) { waves = []; VIBRATOS.set(ctx, waves); }
  const step = Math.round((((t * VIBRATO_HZ) % 1) + 1) % 1 * PHASES) % PHASES;
  let wave = waves[step];
  if (!wave) {
    const p = (2 * Math.PI * step) / PHASES;
    // vibratoCents from phase p on: A1 cos(theta + p) - A2 cos(2 theta + 2 p), as cosine and sine parts.
    const real = new Float32Array([0, VIBRATO_1 * Math.cos(p), -VIBRATO_2 * Math.cos(2 * p)]);
    const imag = new Float32Array([0, -VIBRATO_1 * Math.sin(p), VIBRATO_2 * Math.sin(2 * p)]);
    wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    waves[step] = wave;
  }
  return wave;
}

/** One key of a chord on the violin tab, held `dur` seconds. `vel` scales its level only: a combo organ's key is a switch. */
export function keys(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, dur: number, tab: Tab = VIOLIN): void {
  const { ctx } = k;
  const key = Math.round(midi);
  const o = ctx.createOscillator();
  o.setPeriodicWave(waveOf(ctx, tab, key));
  o.frequency.value = mtof(key) * 2 ** tab.shift;
  o.detune.value = TOP_OCTAVE[((key % 12) + 12) % 12]!;
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = VIBRATO_HZ;
  vibrato.setPeriodicWave(vibratoAt(ctx, t));
  vibrato.connect(o.detune);
  const g = ctx.createGain();
  const level = LEVEL * vel * 10 ** (((tab === VIOLIN ? keyLevel(key) : 0) + (tab.level ?? 0)) / 20);
  const end = t + Math.max(0.02, dur);
  // Closed, bounced open, closed again; let go at the end, and gone in a few milliseconds.
  g.gain.setValueAtTime(0, Math.max(ctx.currentTime, t - 0.001));
  g.gain.setValueAtTime(level, t);
  g.gain.setValueAtTime(0, t + BOUNCE[0]);
  g.gain.setValueAtTime(level, t + BOUNCE[1]);
  g.gain.setTargetAtTime(0, end, RELEASE);
  o.connect(g).connect(out);
  o.start(t);
  vibrato.start(t);
  o.stop(end + RELEASE * 12);
  vibrato.stop(end + RELEASE * 12);
}
