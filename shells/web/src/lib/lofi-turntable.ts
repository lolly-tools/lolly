// SPDX-License-Identifier: MPL-2.0
/**
 * A turntable, modelled: a DJ's hand on a record and a mixer's crossfader, working on a
 * buffer of Lolly's own audio (lib/lofi-scratches.ts makes the sources: a vowel sung by
 * the chop voice, a horn stab, a slice of the tune's chopped break, a bass note). Nothing
 * recorded is used: a scratch is the motion, not the sound on the record.
 *
 * THE RECORD. The hand moves the record; the needle reads the groove at whatever speed it
 * passes, so the sound's pitch and its whole spectrum move with the speed, backwards when
 * the record goes back, silent when it stops. The groove's own surface noise is on the
 * record, so it whooshes and stops with the motion too. The platter and slipmat under the
 * hand are not quite weightless: the speed reaches the hand's a few milliseconds late. At
 * slow speeds the needle and the cartridge add a soft, hollow resonance, as a record
 * nudged by hand has.
 *
 * THE HAND. Each scratch is a run of strokes, `stroke` seconds each: a stroke's speed
 * rises from rest, peaks and falls back (motionShape), forwards on one stroke, backwards on
 * the next. The peak speeds, the stroke lengths and where in a stroke the speed peaks were
 * fitted to recorded scratching (docs/generated-music.md).
 *
 * THE CROSSFADER is a fast gate with its own short curve: it cuts in over about two
 * milliseconds, with a click as the fader's contact closes, and out a little slower. The scratches
 * are the hand and the fader together (handMotion): the baby (fader open), the chirp (each
 * stroke cut short), the transformer (slow strokes, the fader tapped in time), the flare
 * (the fader clicked shut inside each stroke), the tear (a stroke in steps), the crab (a
 * run of fast taps, four fingers on the fader), the scribble (the record shaken small and
 * fast), the stab (one short hard push), the rewind and the backspin.
 *
 * Pure: no DOM and no Web Audio; deterministic for a given random source.
 */
import type { ScratchKind } from '../../../../engine/src/lofi-scratch.ts';

/** The record's motion and the fader, one value a sample: speed (1 the record's own, negative backwards) and the gate (0 to 1). */
export interface Motion { speed: Float32Array; gate: Float32Array }

/**
 * The hand's numbers, fitted to recordings: a stroke's peak speed (times the record's own)
 * by scratch; where in a stroke its speed peaks (a share of the stroke) and how full the
 * stroke is around its peak (the power on the sine: 2 is a narrow peak, 1 a broad one);
 * how long the fader takes to cut in and to cut out (s), and how much sound leaks past it
 * shut; the share of each stroke a chirp leaves open and of each tap a transformer does;
 * how long a flare's click shuts the fader (s), the crab's taps (s apart), the scribble's
 * shake (Hz) and the platter's lag (s). A
 * backspin's flick reaches its peak in `flick` seconds and slows with a time constant of
 * `spinDecay` seconds against `friction` (times the record's own speed, a second).
 */
export const HAND = {
  peak: { baby: 1.9, chirp: 2.1, transformer: 1.6, flare: 1.9, tear: 1.9, crab: 1.8, scribble: 1.6, stab: 3, rewind: 3, backspin: 8 } as Record<ScratchKind, number>,
  peakAt: 0.42,
  fullness: 1.3,
  edgeIn: 0.003,
  edgeOut: 0.004,
  leak: 0.004,
  chirpOpen: 0.65,
  tapOpen: 0.7,
  flareShut: 0.02,
  crabTap: 0.028,
  scribbleHz: 19,
  lag: 0.003,
  flick: 0.18,
  spinDecay: 0.4,
  friction: 2,
};

/** A stroke's speed at `u` through it (0 to 1): rising from rest to its peak at HAND.peakAt and back to rest. */
export function motionShape(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  const a = HAND.peakAt;
  const w = u < a ? u / a : 1 + (u - a) / (1 - a);
  return Math.sin((Math.PI / 2) * w) ** HAND.fullness;
}

/**
 * The hand and the fader for one scratch, `seconds` long at `sr`, its strokes `stroke`
 * seconds each, from `rand` for the small differences between strokes. The record starts
 * forwards from where the sound starts and comes back over it, so a baby scratch works
 * the sound's attack, as scratching usually does.
 */
export function handMotion(kind: ScratchKind, seconds: number, stroke: number, sr: number, rand: () => number): Motion {
  const n = Math.max(1, Math.round(seconds * sr));
  const speed = new Float32Array(n);
  const gate = new Float32Array(n);
  const peak = HAND.peak[kind];
  const strokeN = Math.max(8, Math.round(stroke * sr));
  if (kind === 'rewind') {
    // Playing, caught by the hand, then pulled back: the pull gathers over a third of the
    // rewind and slows as the hand lets the record drag.
    const play = Math.round(0.03 * sr), grab = Math.round(0.05 * sr), pull = Math.max(1, Math.round(seconds * 0.33 * sr)), tau = Math.max(0.05, seconds * 0.5) * sr;
    for (let i = 0; i < n; i++) {
      const j = i - play - grab;
      speed[i] = i < play ? 1 : j < 0 ? 1 - (i - play) / grab : j < pull ? -peak * Math.sin((Math.PI / 2) * (j / pull)) ** 2 : -peak * Math.exp(-(j - pull) / tau);
      gate[i] = i > n - 0.15 * sr ? Math.max(0, (n - i) / (0.15 * sr)) : 1;
    }
  } else if (kind === 'backspin') {
    // Flicked backwards and let go: the platter slows against the slipmat's drag, and once it
    // stops the motor starts it forwards again.
    const flick = Math.max(1, Math.round(HAND.flick * sr)), decay = Math.exp(-1 / (HAND.spinDecay * sr)), drag = HAND.friction / sr, motor = 0.22 * sr;
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (i < flick) v = -peak * Math.sin((Math.PI / 2) * (i / flick)) ** 2;
      else if (v < 0) v = Math.min(0, v * decay + drag);
      else v += (1 - v) / motor;
      speed[i] = v;
      gate[i] = i > n - 0.12 * sr ? Math.max(0, (n - i) / (0.12 * sr)) : 1;
    }
  } else if (kind === 'scribble') {
    // Shaken small and fast, drifting forwards.
    const w = (2 * Math.PI * HAND.scribbleHz * (0.9 + rand() * 0.2)) / sr;
    for (let i = 0; i < n; i++) { speed[i] = 0.35 + peak * Math.sin(w * i); gate[i] = 1; }
  } else if (kind === 'stab') {
    // One short, hard push forwards, the fader open only for the push.
    const push = Math.min(n, Math.round(Math.min(stroke, 0.085) * sr));
    for (let i = 0; i < push; i++) { speed[i] = peak * motionShape(i / push); gate[i] = 1; }
  } else {
    const slow = kind === 'transformer' ? 2 : 1;
    const len = strokeN * slow;
    for (let s = 0, at = 0; at < n; s++, at += len) {
      const dir = s % 2 === 0 ? 1 : -1;
      const p = peak * (0.9 + rand() * 0.2);
      for (let i = 0; i < len && at + i < n; i++) {
        const u = i / len;
        // A tear: the forward stroke in two steps, the hand catching in between.
        const shape = kind === 'tear' && dir > 0 ? motionShape(u < 0.5 ? u * 2 : (u - 0.5) * 2) * 0.85 : motionShape(u);
        speed[at + i] = dir * p * shape;
        let g = 1;
        if (kind === 'chirp') g = u < HAND.chirpOpen ? 1 : 0;
        else if (kind === 'transformer') g = ((i / sr) % stroke) < stroke * HAND.tapOpen ? 1 : 0;
        else if (kind === 'flare') g = Math.abs(u - 0.5) * len < (HAND.flareShut * sr) / 2 ? 0 : 1;
        else if (kind === 'crab') g = u < 0.62 ? (Math.floor(i / (HAND.crabTap * sr / 2)) % 2 === 0 ? 1 : 0) : 1;
        gate[at + i] = g;
      }
    }
  }
  // The platter's lag under the hand, and the fader's short edges.
  const k = 1 - Math.exp(-1 / (HAND.lag * sr));
  let v = speed[0]!;
  for (let i = 0; i < n; i++) { v += k * (speed[i]! - v); speed[i] = v; }
  const up = 1 / Math.max(1, HAND.edgeIn * sr), down = 1 / Math.max(1, HAND.edgeOut * sr);
  let g = gate[0]!;
  for (let i = 0; i < n; i++) { g += Math.max(-down, Math.min(up, gate[i]! - g)); gate[i] = HAND.leak + (1 - HAND.leak) * g; }
  return { speed, gate };
}

/**
 * The fader's click as it cuts in, against the sound's level; the needle's resonance at
 * slow speeds; and the cartridge's top, a gentle low-pass, so a bright source scratched up
 * an octave still has a record's top end (fitted to recorded scratches' spectra).
 */
const CLICK = 0.05, RESONANCE = { hz: 1100, q: 2.2, level: 0.35, below: 0.4 }, CARTRIDGE = { hz: 6500, q: 0.6 };

/**
 * A scratch: the record `src` (at `srcSr`) read from `from` seconds by the hand's motion,
 * its speed times `base` (the source played at a pitch: 2 is an octave up), through the
 * fader, at `sr`. Cubic reads between samples; the fader clicks as it cuts in; at slow
 * speeds the needle's resonance colours what little sound there is; the cartridge rounds
 * off the top.
 */
export function turntable(src: Float32Array, srcSr: number, from: number, motion: Motion, base: number, sr: number): Float32Array {
  const n = motion.speed.length;
  const out = new Float32Array(n);
  const last = src.length - 3;
  let pos = from * srcSr;
  const ratio = (base * srcSr) / sr;
  let rms = 0;
  for (let i = 0; i < Math.min(src.length, Math.round(srcSr * 0.3)); i++) rms += src[Math.min(last, Math.max(0, Math.round(from * srcSr) + i))]! ** 2;
  rms = Math.sqrt(rms / Math.max(1, Math.round(srcSr * 0.3)));
  // The resonance: a band-pass whose share grows as the record slows.
  const w = (2 * Math.PI * RESONANCE.hz) / sr, al = Math.sin(w) / (2 * RESONANCE.q), a0 = 1 + al;
  const b0 = al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
  const cw = (2 * Math.PI * Math.min(CARTRIDGE.hz, 0.45 * sr)) / sr, cal = Math.sin(cw) / (2 * CARTRIDGE.q), c0 = 1 + cal;
  const cb0 = (1 - Math.cos(cw)) / 2 / c0, cb1 = (1 - Math.cos(cw)) / c0, ca1 = (-2 * Math.cos(cw)) / c0, ca2 = (1 - cal) / c0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, prevGate = 0, click = 0, u1 = 0, u2 = 0, z1 = 0, z2 = 0;
  for (let i = 0; i < n; i++) {
    const v = motion.speed[i]!;
    pos += v * ratio;
    if (pos < 1) pos = 1;
    if (pos > last) pos = last;
    const j = Math.floor(pos), f = pos - j;
    const p0 = src[j - 1]!, p1 = src[j]!, p2 = src[j + 1]!, p3 = src[j + 2]!;
    const x = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
    // The needle's resonance: most when the record barely moves.
    const slow = Math.max(0, 1 - Math.abs(v) / RESONANCE.below);
    const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    const g = motion.gate[i]!;
    if (g > 0.5 && prevGate <= 0.5) click = CLICK * rms * 4;
    prevGate = g;
    const needle = x + y * RESONANCE.level * slow;
    const top = cb0 * needle + cb1 * u1 + cb0 * u2 - ca1 * z1 - ca2 * z2;
    u2 = u1; u1 = needle; z2 = z1; z1 = top;
    out[i] = top * g + click;
    click *= Math.exp(-1 / (0.0004 * sr));
  }
  return out;
}
