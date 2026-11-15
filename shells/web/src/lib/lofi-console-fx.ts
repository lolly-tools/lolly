// SPDX-License-Identifier: MPL-2.0
/**
 * The 16-bit console's FM effects (engine/src/lofi-console.ts says which and where):
 * spins, long shots and the moments before a drop, each worked out on the console's chips
 * (./lofi-console-chip.ts) into one buffer, echo and all, the first time it is heard, and
 * played from that buffer after. One buffer source and one gain a sound, so a shot with a
 * two-bar tail costs the audio thread almost nothing.
 *
 * Each effect is written as a sound driver writes it: a list of what to change on the
 * chips, once a video frame. These are Lolly's own designs in the idiom of the early
 * 16-bit consoles, pitched to the tune's key and its chords and timed to its tempo.
 * None follows a game's effect: the spin's gears, the shots' contours and the fanfare's
 * figures were drawn up here, and checked against the effects people know best so that
 * none shares one's pitch sequence or contour.
 */
import { readFm, type LofiFm } from '../../../../engine/src/lofi-console.ts';
import { consoleOut, FRAME_HZ, NOISE_RATES, psgHz, renderFm, renderNoise, renderSquare, withEcho, type Echo, type FmFrame, type FmPatch } from './lofi-console-chip.ts';
import type { VoiceKit } from './lofi-voices.ts';

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
const frames = (seconds: number): number => Math.max(1, Math.round(seconds * FRAME_HZ));

/**
 * How loud each effect plays. Measured K-weighted (the loudest 400 ms) against the hook,
 * the lead's loudness through Sugar's drops: the moments and the spins about 3 dB under
 * it, the shots 4 (a shot is short, so it reads louder than that window says), a launch
 * 2.5, and a rewind's chord 8, since the tape stopping is the sound there. Accents, never
 * over the tune.
 */
const LEVEL: Record<LofiFm['kind'], number> = { spin: 0.064, pew: 0.129, beam: 0.079, charged: 0.11, climb: 0.071, dive: 0.062, launch: 0.058, fanfare: 0.068, rewind: 0.05 };

// ── the patches ─────────────────────────────────────────────────────────────

/** The motor: operator 1 fed back for a saw's edge into its carrier, and a seventh-harmonic pair a few cents off for the whine that pulses with the wheel. */
const MOTOR: FmPatch = { algo: 4, fb: 6, ops: [
  { mul: 1, level: 0.16, a: 0.002, d: 0, s: 0, r: 70 },
  { mul: 1, level: 0.6, a: 0.004, d: 0, s: 0, r: 50 },
  { mul: 7, level: 0.12, a: 0.002, d: 0, s: 0, r: 70, dt: 9 },
  { mul: 2, level: 0.34, a: 0.004, d: 0, s: 0, r: 50 },
] };
/** A shot: a carrier struck by its own fed-back pair and by a modulator an octave under it (the zap), both bright for an instant. */
const ZAP: FmPatch = { algo: 4, fb: 5, ops: [
  { mul: 1, level: 0.2, a: 0.001, d: 40, s: 30, r: 90 },
  { mul: 1, level: 0.62, a: 0.001, d: 16, s: 30, r: 70 },
  { mul: 0.5, level: 0.3, a: 0.001, d: 70, s: 40, r: 90 },
  { mul: 1, level: 0.36, a: 0.001, d: 24, s: 30, r: 70, dt: 7 },
] };
/** The beam: a buzzing, fed-back carrier, and a second one 14 cents sharp, so the two beat against each other. */
const BEAM: FmPatch = { algo: 4, fb: 6, ops: [
  { mul: 1, level: 0.12, a: 0.002, d: 0, s: 0, r: 50 },
  { mul: 1, level: 0.5, a: 0.004, d: 2, s: 6, r: 40 },
  { mul: 3, level: 0.1, a: 0.002, d: 0, s: 0, r: 50 },
  { mul: 1, level: 0.42, a: 0.004, d: 2, s: 6, r: 40, dt: 14 },
] };
/** The charged shot: operator 1, fed back as hard as the chip allows, drives three carriers, one an octave under for the thump. */
const CHARGE: FmPatch = { algo: 5, fb: 7, ops: [
  { mul: 1, level: 0.24, a: 0.001, d: 30, s: 18, r: 60 },
  { mul: 1, level: 0.45, a: 0.001, d: 12, s: 24, r: 50 },
  { mul: 0.5, level: 0.32, a: 0.001, d: 22, s: 30, r: 60 },
  { mul: 2, level: 0.26, a: 0.001, d: 30, s: 30, r: 60 },
] };
/** A struck, bell-like lead for the climb: a soft fed-back pair and a quick shimmer at four times the pitch. */
const BELL: FmPatch = { algo: 4, fb: 3, ops: [
  { mul: 1, level: 0.1, a: 0.001, d: 20, s: 10, r: 80 },
  { mul: 1, level: 0.55, a: 0.001, d: 22, s: 8, r: 70 },
  { mul: 4, level: 0.16, a: 0.001, d: 70, s: 30, r: 90 },
  { mul: 2, level: 0.24, a: 0.001, d: 30, s: 14, r: 80 },
] };
/** The warp: four operators in a row, so the sound thickens as the first one is opened. */
const WARP: FmPatch = { algo: 0, fb: 4, ops: [
  { mul: 1, level: 0.14, a: 0.002, d: 0, s: 0, r: 60 },
  { mul: 1, level: 0.16, a: 0.002, d: 0, s: 0, r: 60 },
  { mul: 2, level: 0.2, a: 0.002, d: 0, s: 0, r: 60 },
  { mul: 1, level: 0.7, a: 0.004, d: 0, s: 0, r: 40 },
] };
/** The fanfare's horn: its modulator opens more slowly than the carrier sounds, as a brass note's brightness blooms. */
const HORN: FmPatch = { algo: 4, fb: 4, ops: [
  { mul: 1, level: 0.15, a: 0.035, d: 6, s: 4, r: 70 },
  { mul: 1, level: 0.4, a: 0.008, d: 4, s: 3, r: 55 },
  { mul: 1, level: 0.08, a: 0.03, d: 6, s: 6, r: 70 },
  { mul: 2, level: 0.13, a: 0.01, d: 6, s: 6, r: 55, dt: 6 },
] };

// ── the effects ─────────────────────────────────────────────────────────────

/** What an effect is worked out from. */
interface Spec { fm: LofiFm; midi: number; len: number; spb: number; sr: number }
/** An effect before its echo: its FM part and its square-wave part, its place across the speakers, and how its echo answers. */
interface Made { fm: Float32Array; psg: Float32Array; pan: number; echo: Echo | null; sweep?: readonly [number, number] }

const buffers = (seconds: number, sr: number): { fm: Float32Array; psg: Float32Array } => ({ fm: new Float32Array(Math.ceil(seconds * sr)), psg: new Float32Array(Math.ceil(seconds * sr)) });
/** A tempo's echo: a dotted eighth, `feedback` back each time, as many answers as stay above about -45 dB, at most `most`. */
function echoOf(spb: number, feedback: number, first: -1 | 1, most: number): Echo {
  return { delay: Math.min(1.2, 0.75 * spb), feedback, first, repeats: Math.min(most, Math.ceil(Math.log(0.006) / Math.log(feedback))) };
}

/**
 * The spin: a motor revving through `gears`, each gear starting a fourth above the last
 * and climbing a sixth within it, so each change of gear dips a little before it climbs
 * on; the whine pulses with the wheel, every seven frames at first and every two by the
 * end. Let go in a whoosh, it shoots up an octave and the noise rushes out.
 */
function spinInto(out: Float32Array, psg: Float32Array, sr: number, from: number, midi: number, seconds: number, gears: number, whoosh: boolean): void {
  const n = frames(seconds);
  const per = n / gears;
  const base = midi - 12;
  const at = (f: number): number => {
    const g = Math.min(gears - 1, Math.floor(f / per));
    const u = (f - g * per) / per;
    return base + 5 * g + 9 * u ** 1.5;
  };
  const top = at(n - 1);
  const release = whoosh ? frames(0.3) : 0;
  renderFm(out, sr, from, MOTOR, n + release, (f) => {
    if (f >= n) {
      // The whoosh: the motor flung up two octaves as it fades, the noise rushing out under the tone.
      const k = f - n;
      const fade = Math.max(0, 1 - k / (release * 0.6)) ** 2;
      return { hz: mtof(top + 24 * (1 - Math.exp(-k / 4))), levels: [1.4, fade, 0.6 * fade, fade], key: k === release - 1 ? 'off' : undefined };
    }
    const period = Math.max(2, Math.round(7 - 5 * (f / n)));
    const q = (f % period) / period;
    return { hz: mtof(at(f)), levels: [1, 0.78 + 0.22 * (1 - q), (1 - q) ** 2, 0.62 + 0.38 * (1 - q)], key: f === 0 ? 'on' : undefined };
  }, 0.25);
  if (!whoosh) return;
  const start = from + Math.round((n / FRAME_HZ) * sr);
  const swell = [6, 3, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  renderNoise(psg, sr, start, swell.length, (f) => ({ rate: 2 * psgHz(3000 * 0.88 ** f), white: true, att: swell[f]! }));
}

/** A shot's fall, from `high` semitones over `midi` to `low`, as the frames pass: fast at first, then settling. */
function shotInto(out: Float32Array, psg: Float32Array, sr: number, from: number, midi: number, high: number, low: number, seconds: number): void {
  const n = frames(seconds);
  renderFm(out, sr, from, ZAP, n, (f) => ({
    hz: mtof(midi + low + (high - low) * Math.exp(-f / 3.2)),
    // A burst of feedback for the first two frames, then the driver eases it back.
    fb: f < 2 ? 7 : f < 6 ? 5 : 3,
    levels: [1, Math.max(0.05, 1 - f / (n + 2)), 1, Math.max(0.05, 1 - f / (n + 2))],
    key: f === 0 ? 'on' : f === n - 1 ? 'off' : undefined,
  }), 0.2);
  // The noise's crack: three frames of the fastest white noise, falling away.
  renderNoise(psg, sr, from, 3, (f) => ({ rate: NOISE_RATES[0], white: true, att: [1, 4, 8][f]! }));
}

function pew({ fm, midi, spb, sr }: Spec): Made {
  const b = buffers(0.3 + (fm.count > 1 ? spb * 0.5 : 0) + 0.3, sr);
  shotInto(b.fm, b.psg, sr, 0, midi, 31, -17, 0.2);
  // The second shot of a pair, an eighth later and a tone lower.
  if (fm.count > 1) shotInto(b.fm, b.psg, sr, Math.round(spb * 0.5 * sr), midi - 2, 31, -17, 0.2);
  return { ...b, pan: fm.side * -0.25, echo: echoOf(spb, 0.45, fm.side, 7) };
}

function beam({ fm, midi, spb, sr }: Spec): Made {
  const seconds = 0.6;
  const n = frames(seconds);
  const b = buffers(seconds + 0.4, sr);
  // Sliding down a ninth, the pitch flicking either side of its line every frame: the buzz of the beam.
  renderFm(b.fm, sr, 0, BEAM, n, (f) => ({
    hz: mtof(midi + 26 - 14 * (f / n) + (f % 2 ? 0.8 : -0.8)),
    levels: [1, f > n - 6 ? (n - f) / 6 : 1, 1, f > n - 6 ? (n - f) / 6 : 1],
    key: f === 0 ? 'on' : f === n - 1 ? 'off' : undefined,
  }), 0.15);
  renderNoise(b.psg, sr, 0, 2, (f) => ({ rate: NOISE_RATES[0], white: true, att: [2, 6][f]! }));
  return { ...b, pan: fm.side * -0.2, echo: echoOf(spb, 0.52, fm.side, 8) };
}

/** The charged shot into `out` at `from`: two frames of the fed-back burst high up, then a deep fall with the thump under it and the noise rumbling down. */
function chargedInto(out: Float32Array, psg: Float32Array, sr: number, from: number, midi: number): void {
  const n = frames(0.42);
  renderFm(out, sr, from, CHARGE, n, (f) => ({
    hz: mtof(f < 2 ? midi + 36 : midi - 3 + 35 * Math.exp(-(f - 2) / 5)),
    fb: f < 2 ? 7 : 5,
    levels: [f < 2 ? 1 : 0.7, Math.max(0.05, 1 - f / (n + 3)), Math.max(0.05, 1 - f / (n + 6)), Math.max(0.05, 1 - f / n)],
    key: f === 0 ? 'on' : f === n - 1 ? 'off' : undefined,
  }), 0.25);
  const rumble = frames(0.36);
  renderNoise(psg, sr, from, rumble, (f) => ({ rate: 2 * psgHz(2600 * 0.84 ** f + 160), white: true, att: Math.min(15, 1 + f * 0.7) }));
}

function charged({ fm, midi, spb, sr }: Spec): Made {
  const b = buffers(0.8, sr);
  chargedInto(b.fm, b.psg, sr, 0, midi);
  return { ...b, pan: fm.side * -0.2, echo: echoOf(spb, 0.5, fm.side, 8) };
}

function spin({ fm, midi, len, sr }: Spec): Made {
  const b = buffers(len + 0.65, sr);
  spinInto(b.fm, b.psg, sr, 0, midi, len, fm.count, fm.whoosh);
  return { ...b, pan: 0, echo: null };
}

/** The chord's tones as semitones over its root, climbing octave by octave: root, third, fifth, root an octave up... */
function chordRun(fm: LofiFm, count: number): number[] {
  const tones = [0, fm.third, fm.fifth];
  return Array.from({ length: count }, (_, i) => tones[i % 3]! + 12 * Math.floor(i / 3));
}

function climb({ fm, midi, spb, sr, len }: Spec): Made {
  const step = Math.max(2, Math.round((spb / 8) * FRAME_HZ));   // thirty-second notes, to the nearest frame
  const run = chordRun(fm, 7);
  const hold = Math.max(4, frames(len - (run.length * step) / FRAME_HZ));
  const n = run.length * step + hold;
  const b = buffers(n / FRAME_HZ + 0.6, sr);
  const note = (f: number): number => (f < run.length * step ? run[Math.floor(f / step)]! : run.at(-1)! + ((Math.floor(f / 3) % 2) ? 0.3 : -0.3));
  renderFm(b.fm, sr, 0, BELL, n, (f) => ({ hz: mtof(midi + note(f)), key: f < run.length * step && f % step === 0 ? 'on' : f === n - 1 ? 'off' : undefined }), 0.55);
  // The square-wave chip doubles it an octave up, a frame behind, much quieter: a driver's layering.
  renderSquare(b.psg, sr, Math.round(sr / FRAME_HZ), n, (f) => ({ hz: mtof(midi + 12 + note(f)), att: f < run.length * step ? 6 + (f % step) : 8 + Math.min(7, Math.floor((f - run.length * step) / 3)) }));
  return { ...b, pan: 0, echo: { delay: spb * 0.5, feedback: 0.3, first: fm.side, repeats: 3 } };
}

function dive({ fm, midi, len, sr }: Spec): Made {
  const n = frames(len);
  const b = buffers(len + 0.4, sr);
  renderFm(b.fm, sr, 0, WARP, n, (f) => {
    const u = f / n;
    return {
      hz: mtof(midi + 30 - 42 * u ** 1.4),
      fb: u < 0.5 ? 4 : 6,
      levels: [0.3 + 0.7 * u, 0.5 + 0.5 * u, 1, u > 0.6 ? Math.max(0.05, (1 - u) * 2.5) : 1],
      key: f === 0 ? 'on' : f === n - 1 ? 'off' : undefined,
    };
  }, 0.2);
  // The rush of the warp: the noise shifting with the third square as it falls, swelling and fading.
  renderNoise(b.psg, sr, 0, n, (f) => {
    const u = f / n;
    return { rate: 2 * psgHz(mtof(midi + 24 - 18 * u)), white: true, att: Math.round(u < 0.3 ? 11 - u * 15 : 6.5 + u * 9) };
  });
  return { ...b, pan: 0, echo: null, sweep: [fm.side * 0.7, -fm.side * 0.7] };
}

function launch({ fm, midi, len, spb, sr }: Spec): Made {
  const b = buffers(len + 1, sr);
  spinInto(b.fm, b.psg, sr, 0, midi, len, Math.max(1, fm.count), false);
  chargedInto(b.fm, b.psg, sr, Math.round(len * sr), midi);
  // The spin plays dry; only the shot echoes, so the echo is the shot's own (see make).
  return { ...b, pan: 0, echo: echoOf(spb, 0.5, fm.side, 7) };
}

/** The fanfare's figures: [semitones over the root, sixteenths], a rest where the pitch is null. Lolly's own, on the next chord's tones. */
const FIGURES: ReadonlyArray<ReadonlyArray<readonly [number | null, number]>> = [
  [[0, 1], [7, 1], [12, 1], [null, 1], [16, 2]],
  [[12, 1], [7, 1], [12, 1], [19, 1], [24, 2]],
  [[7, 1], [12, 1], [16, 1], [19, 3]],
];

function fanfare({ fm, midi, spb, sr }: Spec): Made {
  const figure = FIGURES[fm.figure % FIGURES.length]!;
  // The figure's major third and perfect fifth become the chord's own.
  const tone = (st: number): number => st % 12 === 4 ? st - 4 + fm.third : st % 12 === 7 ? st - 7 + fm.fifth : st;
  const sixteenth = (spb / 4) * FRAME_HZ;
  const steps: Array<{ from: number; to: number; st: number | null }> = [];
  let at = 0;
  for (const [st, len] of figure) { steps.push({ from: Math.round(at), to: Math.round(at + len * sixteenth), st: st === null ? null : tone(st) }); at += len * sixteenth; }
  const n = Math.round(at) + frames(0.25);
  const b = buffers(n / FRAME_HZ + 0.6, sr);
  const stepAt = (f: number) => steps.find(s => f >= s.from && f < s.to) ?? null;
  const lead = (below: boolean) => (f: number): FmFrame => {
    const s = stepAt(f) ?? steps.at(-1)!;
    const st = s.st ?? 0;
    // The second voice takes the chord tone under the tune's, as a second horn would.
    const pitch = below ? (st % 12 === 0 ? st - 12 + fm.fifth : st % 12 === fm.fifth ? st - fm.fifth + fm.third : st - fm.third) : st;
    // Each note keys on as it starts; a rest keys off, and so does the figure's end, its last note ringing on into the drop.
    const end = Math.round(at);
    const key = f === end ? 'off' : f < end && f === s.from ? (s.st === null ? 'off' : 'on') : undefined;
    return { hz: mtof(midi + pitch), levels: below ? [0.8, 0.55, 0.8, 0.55] : undefined, key };
  };
  renderFm(b.fm, sr, 0, HORN, n, lead(false), 0.6);
  renderFm(b.fm, sr, 0, HORN, n, lead(true), 0.6);
  renderSquare(b.psg, sr, 0, Math.round(at), (f) => { const s = stepAt(f); return { hz: mtof(midi + 12 + (s?.st ?? 0)), att: s?.st === null ? 15 : 8 }; });
  return { ...b, pan: 0, echo: { delay: spb * 0.5, feedback: 0.3, first: fm.side, repeats: 3 } };
}

function rewind({ fm, midi, len, sr }: Spec): Made {
  const n = frames(len);
  const b = buffers(len + 0.1, sr);
  const tones = [0, fm.third, fm.fifth];
  // The chord on one channel, a tone each frame, swelling as the tape winds down, then cut.
  renderFm(b.fm, sr, 0, WARP, n, (f) => {
    const u = f / n;
    return { hz: mtof(midi + tones[f % 3]! - 2 * u), fb: 5, levels: [0.4 + 0.6 * u, 0.6, 0.8, 0.12 + 0.88 * u ** 1.5], key: f === 0 ? 'on' : f === n - 1 ? 'off' : undefined };
  }, 0.02);
  return { ...b, pan: 0, echo: null };
}

const MAKERS: Record<LofiFm['kind'], (s: Spec) => Made> = { spin, pew, beam, charged, climb, dive, launch, fanfare, rewind };

/** A mono sound moved across the speakers from `from` to `to` (-1 left, 1 right). */
function swept(x: Float32Array, [from, to]: readonly [number, number]): [Float32Array, Float32Array] {
  const L = new Float32Array(x.length);
  const R = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const pan = from + (to - from) * (i / x.length);
    L[i] = x[i]! * Math.sqrt(0.5 * (1 - pan));
    R[i] = x[i]! * Math.sqrt(0.5 * (1 + pan));
  }
  return [L, R];
}

/**
 * Work out one effect, as the console would sound it: the FM part echoed before the
 * converter and the square-wave part beside it, then the console's output stage on each
 * side. Pure: the same note at the same tempo and rate gives the same samples.
 */
export function renderConsoleFx(mod: number, midi: number, len: number, spb: number, sr: number): [Float32Array, Float32Array] {
  const fm = readFm(mod);
  const made = MAKERS[fm.kind]({ fm, midi, len: Math.max(0.1, len), spb, sr });
  if (fm.kind === 'launch' && made.echo) {
    // The spin stays dry; the shot from the end of the spin echoes.
    const cut = Math.round(len * sr);
    const dry = { fm: made.fm.slice(0, cut), psg: made.psg.slice(0, cut) };
    const shot = { fm: made.fm.slice(cut), psg: made.psg.slice(cut) };
    const sides = mix(withEcho(dry.fm, sr, 0, null), withEcho(dry.psg, sr, 0, null), sr);
    const tail = mix(withEcho(shot.fm, sr, made.pan, made.echo), withEcho(shot.psg, sr, made.pan, made.echo), sr);
    return [join(sides[0], tail[0], cut), join(sides[1], tail[1], cut)];
  }
  const fmSides = made.sweep ? swept(made.fm, made.sweep) : withEcho(made.fm, sr, made.pan, made.echo);
  const psgSides = made.sweep ? swept(made.psg, made.sweep) : withEcho(made.psg, sr, made.pan, made.echo);
  return mix(fmSides, psgSides, sr);
}

/**
 * The FM sides and the square-wave sides through the console's output stage, then a
 * gentle high-pass of the mix's own (one pole at 90 Hz), so an effect leaves the kick and
 * the bass their low end.
 */
function mix(fm: [Float32Array, Float32Array], psg: [Float32Array, Float32Array], sr: number): [Float32Array, Float32Array] {
  return [clearLows(consoleOut(fm[0], psg[0], sr), sr), clearLows(consoleOut(fm[1], psg[1], sr), sr)];
}

/** The mix's high-pass, and the buffer's last 30 ms faded out, so whatever is left of a tail ends without a click. */
function clearLows(x: Float32Array, sr: number): Float32Array {
  const p = Math.exp((-2 * Math.PI * 90) / sr);
  let h = 0, prev = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]!; h = p * (h + v - prev); prev = v; x[i] = h; }
  const fade = Math.min(x.length, Math.round(0.03 * sr));
  for (let i = 0; i < fade; i++) x[x.length - 1 - i] = x[x.length - 1 - i]! * (i / fade);
  return x;
}

/** `b` laid over `a` from sample `at`, in a buffer long enough for both. */
function join(a: Float32Array, b: Float32Array, at: number): Float32Array {
  const out = new Float32Array(Math.max(a.length, at + b.length));
  out.set(a);
  for (let i = 0; i < b.length; i++) out[at + i] = (out[at + i] ?? 0) + b[i]!;
  return out;
}

/** The buffers already worked out, by context: a tune plays the same few again and again. */
const MADE = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
/** How many sounds a context keeps before it starts again. */
const KEEP = 48;

/** One effect's buffer, worked out the first time it is asked for. */
export function consoleBuffer(ctx: BaseAudioContext, mod: number, midi: number, len: number, spb: number): AudioBuffer {
  let cache = MADE.get(ctx);
  if (!cache) { cache = new Map(); MADE.set(ctx, cache); }
  const key = `${mod}|${midi}|${Math.round(len * 100)}|${Math.round(spb * 1000)}`;
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size >= KEEP) cache.clear();
    const [L, R] = renderConsoleFx(mod, midi, len, spb, ctx.sampleRate);
    buf = ctx.createBuffer(2, L.length, ctx.sampleRate);
    buf.getChannelData(0).set(L);
    buf.getChannelData(1).set(R);
    cache.set(key, buf);
  }
  return buf;
}

/** Whether an `fm` note's effect also stops the tape under the music (the rewind). */
export function stopsTape(mod: number): boolean {
  return readFm(mod).kind === 'rewind';
}

/** Play an `fm` note: its effect at `t`, `len` seconds as written, at `spb` seconds a beat. */
export function playConsoleFx(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, mod: number, len: number, spb: number): void {
  const src = k.ctx.createBufferSource();
  src.buffer = consoleBuffer(k.ctx, mod, midi, len, spb);
  const g = k.ctx.createGain();
  g.gain.value = LEVEL[readFm(mod).kind] * vel;
  src.connect(g).connect(out);
  src.start(t);
}

/**
 * The tape-stop curve for the music's delay line: over `seconds`, the delay grows so the
 * music slows from full speed to a stop, its speed falling as the 1.6th power of the time
 * (slow to start, quick at the end, as a tape machine's motor runs down). A delay growing
 * at a rate r plays the music at 1 - r, so the delay is the integral of the slowing.
 */
export function tapeStopCurve(base: number, seconds: number, points = 64): Float32Array {
  const p = 1.6;
  return Float32Array.from({ length: points }, (_, i) => {
    const u = i / (points - 1);
    return base + (seconds / (p + 1)) * u ** (p + 1);
  });
}
