// SPDX-License-Identifier: MPL-2.0
/**
 * A 16-bit console's sound chips, modelled in plain arithmetic so a sound effect can be
 * worked out sample by sample into a buffer (lib/lofi-console-fx.ts designs the effects).
 * No Web Audio here, so every behaviour below is checked in Node.
 *
 * The model follows the published behaviour of the two chips in the early 16-bit Sega
 * console, not any recording of a game:
 *
 *   FM     a four-operator FM chip (the YM2612's design). Each operator is a sine read
 *          from a 1024-step table, its level an attenuation in 0.75 dB steps (total level)
 *          plus an envelope in 0.09375 dB steps, its output rounded to 14 bits. An
 *          operator's output moves the next one's phase by up to four cycles, and the
 *          first operator can feed its own output back (feedback 0 to 7, from a sixteenth
 *          of a cycle doubling up to two cycles). Eight algorithms connect the four.
 *   pitch  the FM chip plays only the frequencies its 11-bit F-number and 3-bit block
 *          reach from its 7.67 MHz clock (a sample rate of clock / 144, about 53.3 kHz);
 *          the square-wave chip only clock / (32 n) from its 3.58 MHz clock, for a 10-bit
 *          n, so its high notes step in big jumps. A game's sound driver changes the
 *          registers once a video frame (60 times a second), so a sweep is a staircase.
 *   PSG    the square-wave chip (the SN76489's design): squares at those pitches, a level
 *          in 2 dB steps (sixteen of them, the last silent), and noise from a 16-bit shift
 *          register, white (taps 0 and 3) or periodic, shifting at one of three fixed rates
 *          or at the third square's rate.
 *   DAC    the FM chip's 9-bit output converter, with the gap at zero (the "ladder
 *          effect") that makes quiet FM sound gritty. Applied gently: a full hit is clean,
 *          an echo dying away grows rough, as the console's own fades did.
 *   filter the console's output stage: a first-order low-pass (about 3.5 kHz on the early
 *          models) and the coupling capacitors' high-pass.
 *
 * Everything is a pure function of its inputs: the same effect gives the same samples on
 * every run, so an offline render repeats exactly.
 */

/** The FM chip's master clock on an NTSC console (53.693175 MHz / 7). */
export const YM_CLOCK = 7670453;
/** The FM chip's own sample rate: one sample every 144 clocks. */
export const YM_RATE = YM_CLOCK / 144;
/** The square-wave chip's clock (53.693175 MHz / 15). */
export const PSG_CLOCK = 3579545;
/** A game's sound driver updates the chips once a video frame. */
export const FRAME_HZ = 60;
/** The output stage's first-order low-pass corner (Hz). */
export const OUTPUT_CORNER = 3500;
/** The square-wave chip's level in the console's mix, against the FM chip's full scale: the console mixed it well under the FM. */
export const PSG_MIX = 0.4;
/** The 9-bit converter's step, on a scale of -1 to 1. */
export const DAC_STEP = 1 / 256;
/** How far the converter's gap at zero pushes every non-zero sample out, in steps: kept to under a step, the gentle end of the console's own. */
export const LADDER = 0.75;

/** The sine the operators read, 1024 steps a cycle, each read at the middle of its step as the chip's table is. */
const SINE = Float32Array.from({ length: 1024 }, (_, i) => Math.sin((2 * Math.PI * (i + 0.5)) / 1024));

/** The envelope's levels, one per 0.09375 dB step of attenuation down to 96 dB. */
const EG = Float32Array.from({ length: 1025 }, (_, i) => 10 ** (-(i * 0.09375) / 20));

/** The top of the F-number range a driver's note table keeps to within one block (an octave, 644 up to here): low enough to leave the top of the 11 bits free for bends. */
const FNUM_HIGH = 1288;

/**
 * The frequency the FM chip plays nearest `hz`: the block (octave) whose F-number falls
 * in a note table's range, and the nearest 11-bit F-number in that block. In the chip,
 * f = fnum * 2^block * (clock / 144) / 2^21.
 */
export function ymHz(hz: number): number {
  if (!(hz > 0)) return 0;
  const unit = YM_RATE / 2 ** 21;
  let block = 0;
  while (block < 7 && hz / (unit * 2 ** block) >= FNUM_HIGH) block++;
  const fnum = Math.max(1, Math.min(2047, Math.round(hz / (unit * 2 ** block))));
  return fnum * 2 ** block * unit;
}

/** The F-number and block the chip uses for `hz` (for the tests and for the record). */
export function ymRegisters(hz: number): { fnum: number; block: number } {
  const unit = YM_RATE / 2 ** 21;
  const f = ymHz(hz);
  let block = 0;
  while (block < 7 && f / (unit * 2 ** block) > 2047) block++;
  while (block < 7 && f / (unit * 2 ** block) >= FNUM_HIGH) block++;
  return { fnum: Math.round(f / (unit * 2 ** block)), block };
}

/** The frequency the square-wave chip plays nearest `hz`: clock / (32 n) for a 10-bit n. */
export function psgHz(hz: number): number {
  if (!(hz > 0)) return 0;
  const n = Math.max(1, Math.min(1023, Math.round(PSG_CLOCK / (32 * hz))));
  return PSG_CLOCK / (32 * n);
}

/** A square-wave chip's level: 0 (loudest) to 15 (silent), 2 dB a step. */
export function psgLevel(att: number): number {
  const a = Math.max(0, Math.min(15, Math.round(att)));
  return a >= 15 ? 0 : 10 ** (-2 * a / 20);
}

/** The noise's three fixed shift rates (Hz): the clock over 512, 1024 and 2048. */
export const NOISE_RATES = [PSG_CLOCK / 512, PSG_CLOCK / 1024, PSG_CLOCK / 2048] as const;

/** A level (0 to 1) as the chip's total level can hold it: an attenuation in 0.75 dB steps, 127 of them. */
export function tlLevel(level: number): number {
  if (!(level > 0)) return 0;
  const steps = Math.min(127, Math.round(-20 * Math.log10(Math.min(1, level)) / 0.75));
  return 10 ** (-steps * 0.75 / 20);
}

/** The 9-bit converter: the sample truncated to its step, and every non-zero step pushed out by the gap at zero. */
export function dac9(x: number): number {
  const q = Math.max(-256, Math.min(255, Math.floor(x * 256)));
  if (q === 0) return 0;
  return (q + (q > 0 ? LADDER : -LADDER)) * DAC_STEP;
}

// ── FM ──────────────────────────────────────────────────────────────────────

/** One operator's settings. `mul` is the chip's frequency multiple (0.5, or 1 to 15); `level` its peak (0 to 1); the envelope in seconds and decibels. */
export interface FmOp {
  mul: number;
  level: number;
  /** Attack: seconds from key-on to full level. */
  a: number;
  /** Decay: decibels a second, down to the sustain. */
  d: number;
  /** Sustain: decibels under full. */
  s: number;
  /** Release: decibels a second after key-off. */
  r: number;
  /** A small detune, in cents (the chip's DT). */
  dt?: number;
}

/** A voice: which of the eight algorithms joins the operators, operator 1's feedback (0 to 7), and the four operators. */
export interface FmPatch { algo: number; fb: number; ops: readonly [FmOp, FmOp, FmOp, FmOp] }

/** What a sound driver writes in one frame: the pitch, each operator's level against its patch level, the feedback, and a key-on or key-off. */
export interface FmFrame {
  hz: number;
  levels?: readonly [number, number, number, number];
  fb?: number;
  key?: 'on' | 'off';
}

/** Which operators each operator hears in each algorithm (by index, 0 to 3), and which are heard. */
const ALGOS: ReadonlyArray<{ mods: readonly (readonly number[])[]; carriers: readonly number[] }> = [
  { mods: [[], [0], [1], [2]], carriers: [3] },          // 1 → 2 → 3 → 4
  { mods: [[], [], [0, 1], [2]], carriers: [3] },        // (1 + 2) → 3 → 4
  { mods: [[], [], [1], [0, 2]], carriers: [3] },        // (1 + (2 → 3)) → 4
  { mods: [[], [0], [], [1, 2]], carriers: [3] },        // ((1 → 2) + 3) → 4
  { mods: [[], [0], [], [2]], carriers: [1, 3] },        // 1 → 2, 3 → 4
  { mods: [[], [0], [0], [0]], carriers: [1, 2, 3] },    // 1 → 2, 3, 4
  { mods: [[], [0], [], []], carriers: [1, 2, 3] },      // 1 → 2, with 3 and 4
  { mods: [[], [], [], []], carriers: [0, 1, 2, 3] },    // all four heard
];

/** The stages of one operator's envelope: off, attack, decay (to the sustain) and release. */
const OFF = 0, ATTACK = 1, DECAY = 2, RELEASE = 3;
/** The envelope's floor: silence, 96 dB down. */
const FLOOR = 96;

/**
 * Work out one FM channel into `out` (added, on the chip's scale of -1 to 1), from sample
 * `from`, for `frames` frames of `control`. The channel's pitch and levels change only at
 * frame boundaries, as a sound driver changes them; the envelopes run every sample.
 * A `null` frame keys the channel off and ends the control (the release rings on, up to
 * `tail` seconds).
 */
export function renderFm(out: Float32Array, sr: number, from: number, patch: FmPatch, frames: number, control: (n: number) => FmFrame | null, tail = 0.4): void {
  const algo = ALGOS[patch.algo] ?? ALGOS[4]!;
  const ops = patch.ops;
  // The algorithm as weights: how far each operator's output moves each later one's phase (four cycles at full), and which are heard.
  const mw = new Float64Array(16);
  const heard = new Float64Array(4);
  for (let o = 0; o < 4; o++) for (const m of algo.mods[o]!) mw[o * 4 + m] = 4;
  for (const c of algo.carriers) heard[c] = 1;
  const dt = 1 / sr;
  const attackStep = Float64Array.from(ops, op => dt / Math.max(0.0005, op.a));
  const decayStep = Float64Array.from(ops, op => op.d * dt);
  const releaseStep = Float64Array.from(ops, op => op.r * dt);
  const sustain = Float64Array.from(ops, op => op.s);
  const phase = new Float64Array(4);
  const att = new Float64Array(4).fill(FLOOR);
  const stage = new Int8Array(4);
  const since = new Float64Array(4);
  const from0 = new Float64Array(4);
  const value = new Float64Array(4);
  const gains = new Float64Array(4).fill(1);
  const steps = new Float64Array(4);
  let fb1 = 0, fb2 = 0, fbScale = 0;
  const perFrame = sr / FRAME_HZ;
  let n = 0;
  let nextAt = 0;
  let ended = false;
  let endAt = Infinity;
  const total = Math.min(out.length - from, Math.ceil((frames / FRAME_HZ + tail) * sr));
  const fadeLen = Math.max(1, Math.round(0.012 * sr));
  const setFb = (fb: number): void => { fbScale = fb > 0 ? 2 ** (fb - 6) / 2 : 0; };
  setFb(patch.fb);
  for (let i = 0; i < total; i++) {
    // A new frame: the driver writes the registers.
    if (!ended && i >= nextAt) {
      const f = n < frames ? control(n) : null;
      if (!f) {
        ended = true;
        endAt = i + Math.round(tail * sr);
        for (let o = 0; o < 4; o++) if (stage[o] !== OFF) stage[o] = RELEASE;
      } else {
        const hz = ymHz(f.hz);
        if (f.fb !== undefined) setFb(f.fb);
        for (let o = 0; o < 4; o++) {
          const op = ops[o]!;
          gains[o] = tlLevel((f.levels?.[o] ?? 1) * op.level);
          steps[o] = (hz * (op.mul || 0.5) * 2 ** ((op.dt ?? 0) / 1200)) / sr;
          // A key-on restarts the attack from wherever the envelope is, as the chip's does.
          if (f.key === 'on') { stage[o] = ATTACK; since[o] = 0; from0[o] = att[o]!; }
          else if (f.key === 'off' && stage[o] !== OFF) stage[o] = RELEASE;
        }
        n++;
        nextAt = Math.round(n * perFrame);
      }
    }
    if (i >= endAt) break;
    // The last few milliseconds before the sound is cut (its tail's end, or the buffer's) fade out, so no cut clicks.
    const left = Math.min(endAt, total) - i;
    const fade = left < fadeLen ? left / fadeLen : 1;
    let sum = 0;
    for (let o = 0; o < 4; o++) {
      // The envelope, in decibels of attenuation, stepped to the chip's 0.09375 dB.
      const st = stage[o];
      let a = att[o]!;
      if (st === ATTACK) {
        const u = since[o]! + attackStep[o]!;
        since[o] = u;
        if (u >= 1) { a = 0; stage[o] = DECAY; } else { const w = 1 - u; a = from0[o]! * w * w * w; }
      } else if (st === DECAY) {
        a = Math.min(sustain[o]!, a + decayStep[o]!);
      } else if (st === RELEASE) {
        a = Math.min(FLOOR, a + releaseStep[o]!);
      } else a = FLOOR;
      att[o] = a;
      const amp = gains[o]! * EG[Math.min(1024, Math.round(a * (1 / 0.09375)))]!;
      // The phase this operator is moved by: the operators before it (by the algorithm), or
      // for operator 1 its own last two outputs fed back.
      const mod = o === 0 ? (fb1 + fb2) * fbScale : value[0]! * mw[o * 4]! + value[1]! * mw[o * 4 + 1]! + value[2]! * mw[o * 4 + 2]!;
      const v = Math.round(SINE[Math.floor((phase[o]! + mod) * 1024) & 1023]! * amp * 8191) / 8191;
      value[o] = v;
      sum += v * heard[o]!;
      let ph = phase[o]! + steps[o]!;
      if (ph >= 1) ph -= Math.floor(ph);
      phase[o] = ph;
    }
    fb2 = fb1;
    fb1 = value[0]!;
    out[from + i] = (out[from + i] ?? 0) + (sum > 1 ? 1 : sum < -1 ? -1 : sum) * fade;
  }
}

// ── the square-wave chip ────────────────────────────────────────────────────

/** What a driver writes to a square channel in one frame: its pitch and its attenuation (0 to 15), or null to stop. */
export interface PsgFrame { hz: number; att: number }

/** Work out a square channel into `out` (added), from sample `from`, a frame of `control` at a time, until it returns null. */
export function renderSquare(out: Float32Array, sr: number, from: number, frames: number, control: (n: number) => PsgFrame | null): void {
  const perFrame = sr / FRAME_HZ;
  let phase = 0;
  for (let n = 0; n < frames; n++) {
    const f = control(n);
    if (!f) return;
    const step = psgHz(f.hz) / sr;
    const level = psgLevel(f.att);
    const a = from + Math.round(n * perFrame);
    const b = Math.min(out.length, from + Math.round((n + 1) * perFrame));
    for (let i = a; i < b; i++) {
      out[i] = (out[i] ?? 0) + (phase < 0.5 ? level : -level);
      phase = (phase + step) % 1;
    }
  }
}

/** What a driver writes to the noise channel in one frame: how fast the register shifts (Hz), white or periodic, and its attenuation. */
export interface NoiseFrame { rate: number; white: boolean; att: number }

/**
 * Work out the noise channel into `out` (added): a 16-bit shift register, its first bit
 * the output. White noise feeds bits 0 and 3 back; periodic noise feeds bit 0 alone,
 * a buzz sixteen shifts long.
 */
export function renderNoise(out: Float32Array, sr: number, from: number, frames: number, control: (n: number) => NoiseFrame | null): void {
  const perFrame = sr / FRAME_HZ;
  let reg = 0x8000;
  let acc = 0;
  for (let n = 0; n < frames; n++) {
    const f = control(n);
    if (!f) return;
    const level = psgLevel(f.att);
    const step = f.rate / sr;
    const a = from + Math.round(n * perFrame);
    const b = Math.min(out.length, from + Math.round((n + 1) * perFrame));
    for (let i = a; i < b; i++) {
      acc += step;
      while (acc >= 1) {
        acc -= 1;
        const bit = f.white ? (reg ^ (reg >> 3)) & 1 : reg & 1;
        reg = (reg >> 1) | (bit << 15);
      }
      out[i] = (out[i] ?? 0) + ((reg & 1) ? level : -level);
    }
  }
}

// ── the console's output ────────────────────────────────────────────────────

/** How an effect's echo answers: the delay (s), how much comes back each time, the side the first answer comes from (-1 left, 1 right), and how many answers at most. */
export interface Echo { delay: number; feedback: number; first: -1 | 1; repeats: number }

/**
 * A mono effect into stereo, with its echoes: placed at `pan`, then answered from one
 * side and the other in turn (a console could pan a channel only hard left, hard right
 * or centre, so the answers sit nearly hard), each answer quieter and darker than the
 * last. The echo works before the converter, as a driver's echo did, replaying the
 * sound quieter on another channel: so the converter's grit grows as it dies away.
 */
export function withEcho(x: Float32Array, sr: number, pan: number, echo: Echo | null): [Float32Array, Float32Array] {
  const d = echo ? Math.max(1, Math.round(echo.delay * sr)) : 0;
  const n = x.length + (echo ? d * echo.repeats : 0);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const gl = Math.sqrt(0.5 * (1 - pan));
  const gr = Math.sqrt(0.5 * (1 + pan));
  for (let i = 0; i < x.length; i++) { L[i] = x[i]! * gl; R[i] = x[i]! * gr; }
  if (!echo) return [L, R];
  // Each answer: the sound again, `feedback` quieter, through one more pole of low-pass and
  // one of high-pass, so the tail goes darker and thinner and never piles up rumble.
  let src = x;
  const pole = Math.exp((-2 * Math.PI * 2600) / sr);
  const hpPole = Math.exp((-2 * Math.PI * 220) / sr);
  for (let k = 1; k <= echo.repeats; k++) {
    const next = new Float32Array(src.length);
    let s = 0, inPrev = 0, h = 0;
    for (let i = 0; i < src.length; i++) {
      s = src[i]! * echo.feedback * (1 - pole) + s * pole;
      h = hpPole * (h + s - inPrev);
      inPrev = s;
      next[i] = h;
    }
    const side = (k % 2 === 1 ? echo.first : -echo.first);
    const near = side < 0 ? L : R;
    const far = side < 0 ? R : L;
    const at = d * k;
    for (let i = 0; i < next.length && at + i < n; i++) { near[at + i] = (near[at + i] ?? 0) + next[i]! * 0.92; far[at + i] = (far[at + i] ?? 0) + next[i]! * 0.22; }
    src = next;
  }
  return [L, R];
}

/** The console's output stage, in place: the converter (on the FM part only, before it is mixed), then the low-pass and the coupling high-pass. */
export function consoleOut(fm: Float32Array, psg: Float32Array | null, sr: number): Float32Array {
  const out = new Float32Array(fm.length);
  const lp = Math.exp((-2 * Math.PI * OUTPUT_CORNER) / sr);
  const hp = Math.exp((-2 * Math.PI * 18) / sr);
  let y = 0, prevIn = 0, prevOut = 0;
  for (let i = 0; i < fm.length; i++) {
    const x = dac9(fm[i]!) + (psg?.[i] ?? 0) * PSG_MIX;
    y = x * (1 - lp) + y * lp;
    const h = hp * (prevOut + y - prevIn);
    prevIn = y;
    prevOut = h;
    out[i] = h;
  }
  return out;
}
