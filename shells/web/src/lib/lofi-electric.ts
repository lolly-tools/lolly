// SPDX-License-Identifier: MPL-2.0
/**
 * A single-coil electric guitar's string, heard by its neck and middle pickups together,
 * built from measurements of a recorded instrument: a solid-body guitar with three
 * single-coil pickups, on the neck and middle pair, played into a one-watt valve amp at
 * the edge of breakup and a 1x12 cabinet. Forty-eight sustained notes were measured
 * (four notes in each of four octaves, three picking strengths), for measurement only:
 * no recording is in this repository and nothing here is taken from one sample by sample.
 * What is kept is numbers, and they are noted where they are used.
 *
 * The string is modal: a sum of its partials, each with its own frequency, level and
 * decay, which is how the measurements describe the string.
 * - Frequencies: a stiff string's, n f sqrt(1 + B n^2). B was measured at about 2.9e-4
 *   near 98 Hz and 1.6e-4 near 165 Hz, and under 1e-4 above 300 Hz (the stiffness grows
 *   as the sounding length shortens, against a thinner string).
 * - Levels: a pick's triangle at its point along the string (thinning the partials with a
 *   node there, but never quite taking them out: the pick has a width), seen by the two
 *   pickups at their places along the sounding length (a fretted note moves both), the
 *   pick's own roll-off (softer for a gentle stroke), and the strike's small burst of noise.
 * - Decay: each partial loses 3.5 + 0.6 log2(f0 / 110) + 4.8 f decibels a second (f in
 *   kHz), fitted to 458 partials over one to five seconds into the measured notes (a low
 *   partial rings for about fifteen seconds, one at 4 kHz for under three).
 * - Two planes: each low partial has a second component, a fraction of a hertz to three
 *   hertz apart, that grows in over the first tenth of a second as the string's motion
 *   turns toward the pickups. The measured beats run 0.4 to 2.9 Hz (median 0.74) and 1 to
 *   14 dB deep (median 5.7), and a note's peak comes 15 to 190 ms after the strike.
 * - Pitch: a hard stroke starts sharp and settles in about a tenth of a second (measured
 *   2 to 15 cents sharp 50 ms in, from the hardest strokes).
 * - Damping: left to ring, palm-muted (the heel of the hand on the strings at the bridge,
 *   the top gone in a few hundredths of a second and the body in a third of one), or dead
 *   (the fretting hand resting on the strings: a scratch, the pick's click and a thud).
 *
 * The amplifier and the cabinet are not here: the sound of several strings goes through
 * them together (lib/lofi-guitars.ts), as a guitar's does. Pure: no DOM, no Web Audio;
 * deterministic for the same spec and seed.
 */

export interface ElectricSpec {
  /** Sample rate and fundamental (Hz). */
  sr: number; f: number;
  /** Seconds to render. */
  seconds: number;
  /** The fret the note is played at (0 an open string): with the scale length it sets where the pick and the pickups sit along the sounding string. */
  fret: number;
  /** Where the pick strikes, as a fraction of the sounding length from the bridge. */
  pick: number;
  /** How hard it is picked: 0 gently, 1 firmly, 2 hard (the three recorded strengths). */
  layer: 0 | 1 | 2;
  /** How the string is damped: left to ring, palm-muted at the bridge, or deadened by the fretting hand (a scratch). */
  damp?: 'ring' | 'palm' | 'dead';
}

/** The scale length and the two pickups' places, mm from the bridge (the instrument's published geometry). */
const SCALE = 648, NECK = 160, MIDDLE = 99;
/**
 * The middle pickup's level against the neck's, the two wired in parallel. They are
 * added as powers, not as signed amplitudes: two point pickups' sum would cut notches the
 * recorded notes do not show, since a real pickup hears some 20 mm of string, not a point.
 */
const MIDDLE_GAIN = 0.9;
/** The stiffness: B near 107 Hz, and how fast it falls with pitch (as f to the -1.25). */
const STIFF = 3.0e-4, STIFF_EXP = 1.25;
/** The highest partial worth rendering: the cabinet's speaker is 30 dB down by 6.5 kHz. */
const TOP = 6500;
/**
 * The pick's roll-off (Hz) by stroke, gentle to hard, on a string whose wave runs at
 * PICK_SPEED m/s. The pick rounds the string's corner over its width, so the roll-off
 * sits at a harmonic number rather than a frequency: it scales with the wave's speed,
 * higher on a thin, high string than a slow, low one. Fitted to the recorded notes.
 */
const PICK_TOP = [2500, 4500, 9000] as const;
const PICK_SPEED = 214;
/** How much of a partial with a node at the pick is left (the pick's width). */
const PICK_FILL = 0.3;
/** How far sharp (cents) a stroke starts, by strength, and how fast it settles (s). */
const GLIDE = [3, 6, 11] as const;
const GLIDE_TAU = 0.045;
/** The pick's click against the string's sound, by strength (dB). */
const CLICK = [-26, -22, -18] as const;
/** The partials that get a second plane. */
const PLANES = 16;
/**
 * The bloom: the share of each low partial that grows in rather than sounding at once, by
 * octave up from the low E, and how long it takes (BLOOM_MIN plus up to BLOOM_SPAN more, s).
 */
const BLOOM_SHARE = [0.3, 0.4, 0.35, 0.3] as const;
const BLOOM_MIN = 0.015, BLOOM_SPAN = 0.05;
/** The second plane's level against the first: log-uniform from PLANE_MIN to PLANE_MIN times PLANE_SPAN (beats 1 to 14 dB deep). */
const PLANE_MIN = 0.08, PLANE_SPAN = 8;
/** The level the note is brought to: the root-mean-square of its partials, as plucked() brings its strings. */
const LEVEL = 0.2;

/** Decibels a second a partial at `hz` loses on a string whose fundamental is `f0`, by how it is damped. */
export function decayRate(f0: number, hz: number, damp: 'ring' | 'palm' | 'dead' = 'ring'): number {
  const kHz = hz / 1000;
  if (damp === 'palm') return 150 + 400 * kHz;
  if (damp === 'dead') return 600 + 900 * kHz;
  return 3.5 + 0.6 * Math.log2(f0 / 110) + 4.8 * kHz;
}

/** One partial: its amplitude (signed), frequency (Hz), decay (nepers a second) and second plane. */
interface Partial { amp: number; hz: number; alpha: number; plane: number; beat: number; bloom: number; phase: number; share: number }

/** The partials of one stroke. */
export function partialsOf(spec: ElectricSpec, rand: () => number): Partial[] {
  const { f, sr } = spec;
  const length = SCALE * 2 ** (-spec.fret / 12);
  const q = Math.min(0.45, Math.max(0.02, spec.pick));
  const pn = NECK / length, pm = MIDDLE / length;
  const B = STIFF * (107 / f) ** STIFF_EXP;
  const top = Math.min(TOP, sr * 0.45);
  // The wave's speed along the string (m/s) sets where the pick's roll-off falls.
  const speed = (2 * length * f) / 1000;
  const pickTop = PICK_TOP[spec.layer] * (speed / PICK_SPEED);
  const reg = Math.max(0, Math.min(3, Math.floor(Math.log2(f / 82.4))));
  const share = BLOOM_SHARE[reg]!;
  const out: Partial[] = [];
  for (let n = 1; ; n++) {
    const hz = n * f * Math.sqrt(1 + B * n * n);
    if (hz > top) break;
    const sq = Math.sin(n * Math.PI * q);
    const shape = Math.sqrt(sq * sq + PICK_FILL * PICK_FILL) / n;
    const sn = Math.sin(n * Math.PI * pn), sm = MIDDLE_GAIN * Math.sin(n * Math.PI * pm);
    const pickups = Math.sqrt(sn * sn + sm * sm);
    const amp = (shape * pickups) / Math.sqrt(1 + (hz / pickTop) ** 2);
    const alpha = (decayRate(f, hz, spec.damp) * Math.LN10) / 20;
    // The second plane: log-uniform 0.05 to 0.65 of the first (beats 1 to 14 dB deep), 0.4 to 2.5 Hz apart, growing in over 30 to 150 ms.
    const second = n <= PLANES && spec.damp !== 'dead';
    out.push({
      amp, hz, alpha,
      plane: second ? PLANE_MIN * PLANE_SPAN ** rand() : 0,
      beat: second ? 0.4 * 6.25 ** rand() * (rand() < 0.5 ? -1 : 1) : 0,
      bloom: BLOOM_MIN + BLOOM_SPAN * rand(),
      phase: rand() * 2 * Math.PI,
      share: second ? share : 0,
    });
  }
  return out;
}

/**
 * Render one stroke. `rand` seeds the second planes and the click, so two strokes of one
 * note differ a little, as a player's do.
 */
export function electricString(spec: ElectricSpec, rand: () => number): Float32Array {
  const { sr } = spec;
  const len = Math.ceil(spec.seconds * sr);
  const out = new Float32Array(len);
  const parts = partialsOf(spec, rand);
  let power = 0;
  for (const p of parts) power += (p.amp * p.amp) / 2;
  const scale = power > 0 ? LEVEL / Math.sqrt(power) : 0;
  // The glide: every partial starts sharp by the same ratio and settles; the phase is
  // worked out per block of 32 samples while it moves, then the rotation is fixed.
  const sharp = 2 ** (GLIDE[spec.layer] / 1200) - 1;
  const glideEnd = Math.min(len, Math.ceil(GLIDE_TAU * 7 * sr));
  const BLOCK = 32;
  for (const p of parts) {
    const a = p.amp * scale;
    if (a === 0) continue;
    // A partial stops being worth adding 90 dB down.
    const life = Math.min(len, Math.ceil((90 / ((p.alpha * 20) / Math.LN10)) * sr));
    // Three rotations: the sensed plane at full strength (sin from zero, as a plucked
    // string's velocity starts), less a part of it that dies at once (so that part grows
    // in: the bloom), and the second plane a little off, beating against both.
    const d1 = Math.exp(-p.alpha / sr);
    const dg = Math.exp((-p.alpha - 1 / p.bloom) / sr);
    const dp = Math.exp((-p.alpha * 0.8) / sr);
    const a1 = a, ag = -a * p.share, ap = a * p.plane;
    let re = 1, im = 0, reg = 1, img = 0, rep = Math.cos(p.phase), imp = Math.sin(p.phase);
    for (let s = 0; s < life; s += BLOCK) {
      const end = Math.min(life, s + BLOCK);
      const m = s < glideEnd ? 1 + sharp * Math.exp(-s / sr / GLIDE_TAU) : 1;
      const w1 = (2 * Math.PI * p.hz * m) / sr;
      const c1 = Math.cos(w1), s1 = Math.sin(w1);
      if (ap !== 0 || ag !== 0) {
        const wp = (2 * Math.PI * (p.hz + p.beat) * m) / sr;
        const cp = Math.cos(wp) * dp, sp = Math.sin(wp) * dp;
        const cm = c1 * d1, sm = s1 * d1, cg = c1 * dg, sg = s1 * dg;
        for (let i = s; i < end; i++) {
          out[i] = out[i]! + a1 * im + ag * img + ap * imp;
          const r1 = re * cm - im * sm; im = re * sm + im * cm; re = r1;
          const r2 = reg * cg - img * sg; img = reg * sg + img * cg; reg = r2;
          const r3 = rep * cp - imp * sp; imp = rep * sp + imp * cp; rep = r3;
        }
      } else {
        const cm = c1 * d1, sm = s1 * d1;
        for (let i = s; i < end; i++) {
          out[i] = out[i]! + a1 * im;
          const r1 = re * cm - im * sm; im = re * sm + im * cm; re = r1;
        }
      }
    }
  }
  // The pick's click: a burst of noise a couple of milliseconds long, its lows taken out.
  const click = 10 ** (CLICK[spec.layer] / 20) * LEVEL * (spec.damp === 'dead' ? 2.5 : 1) * 3;
  const clickLen = Math.min(len, Math.round(0.012 * sr));
  let hp = 0, prev = 0;
  const hpK = Math.exp((-2 * Math.PI * 1200) / sr);
  for (let i = 0; i < clickLen; i++) {
    const v = (rand() * 2 - 1) * Math.exp(-i / (0.0015 * sr));
    hp = hpK * (hp + v - prev);
    prev = v;
    out[i] = out[i]! + click * hp;
  }
  // The pick lets go over about a millisecond: no click from the partials starting at full tilt.
  const ramp = Math.min(len, Math.round(0.0008 * sr));
  for (let i = 0; i < ramp; i++) out[i] = out[i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / ramp));
  return out;
}
