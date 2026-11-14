// SPDX-License-Identifier: MPL-2.0
/**
 * The Latin percussion section, rendered in code: congas (quinto, conga and tumba), bongos,
 * timbales (the heads, the shell and the rimshot), the bongo bell and the mambo bell, the
 * clave and the güiro. Salsa writes them (engine/src/lofi-salsa.ts); any style can play
 * them through the composer's percussion notes (LOFI_PERCUSSION, from 'congas' on).
 *
 * Each stroke is the instrument's physics, worked out once per tune into a short recording
 * (a soft, a medium and a hard stroke, two takes of each) that every hit plays back, as the
 * drum kit is (lib/lofi-kit.ts, whose ringing and noise pieces these share):
 *
 * - A hand drum's head rings at its modes, each a damped sine at its own ratio of the
 *   lowest, with its own level and life. The hand decides which: an open tone (the fingers
 *   bounce off near the rim) rings the head's low modes; a slap (cupped fingertips snapped
 *   onto the head, the hand staying) puts its energy in a crack of noise a few kilohertz up
 *   and in the head's high modes, and chokes the low ones; a muffled stroke and the heel and
 *   toe leave the hand on the head, so every mode dies in tens of milliseconds. Struck
 *   harder, the head's tension rises with the strike, so the pitch starts sharp and settles,
 *   and the shorter contact reaches higher modes.
 * - A metal shell (the timbales') rings on long after the head, in a cluster of inharmonic
 *   partials a few kilohertz up: the cáscara is the stick on that shell, the rimshot the
 *   stick on head and rim at once.
 * - A bell (a cowbell is a folded sheet of iron) rings at a handful of inharmonic modes; at
 *   the mouth the low ones ring longest, at the neck the high ones lead and the hand chokes the ring.
 * - The clave is two hardwood bars: a free bar's first bending mode, its next at 2.76 times,
 *   and the click of the strike.
 * - The güiro is a gourd with ridges cut across it: a stick scraped over them drops off one
 *   ridge after another, each drop a click through the gourd's resonances. The scrape's
 *   speed rises and falls across the stroke, so the clicks come faster in its middle; a
 *   down-stroke catches the ridges' steep faces and is sharper than an up-stroke.
 *
 * Every number was set against recorded instruments (one-shots of each drum and stroke,
 * studied for their numbers only; no recording is in this repository): the modes and their
 * decay times by matrix pencil and peak tracking, the level of each octave band over the
 * first 20 ms, 100 ms and 300 ms, the pitch glide over the first 80 ms, and for the güiro the
 * click rate across the scrape and the gourd's resonances.
 *
 * Pure rendering below the player: no DOM and no Web Audio in the stroke functions, and
 * deterministic (every random choice from the seeded source handed in).
 */
import { headMode, noiseBand, normalise, pushAt, type Rand } from './lofi-kit.ts';
import { EPS, type VoiceKit } from './lofi-voices.ts';

/** The percussion kinds this module plays, as the composer lists them (its LOFI_PERCUSSION, from 'congas' on). */
export const LATIN_PERCUSSION = ['congas', 'bongos', 'timbales', 'bongoBell', 'mamboBell', 'clave', 'guiro'] as const;
export type LatinKind = typeof LATIN_PERCUSSION[number];

/** A mode: [ratio of the stroke's pitch, level (dB under the loudest mode), time to fall 60 dB (s)]. */
type Mode = readonly [number, number, number];
/** A noise band: [centre Hz, Q, level (dB against the modes' loudest), rise (s), fall by e (s)]. */
type Band = readonly [number, number, number, number, number];

/** One stroke on a head: its pitch, modes, glide, the hand's contact and noise, and how loud it is against the drum's open tone. */
export interface StrokeSpec {
  f0: number;
  modes: readonly Mode[];
  /** How sharp the pitch starts at a full stroke (a share), and how fast it settles (s). */
  glide: number; settle: number;
  /** The hand's (or stick's) contact on the head at a medium stroke (s). */
  contact: number;
  noise: readonly Band[];
  /** The stroke's own loudness against the drum's open tone at the same strength (dB). */
  level: number;
  seconds: number;
}

// ── the drums ─────────────────────────────────────────────────────────────────

/**
 * A conga's strokes, at its open tone's pitch `f`. Measured on recorded LP and Natal congas:
 * the open tone's fundamental rings 0.7 to 1.2 s (to 60 dB down), with modes near 1.6 and
 * 2.3 to 2.6 times it 10 to 20 dB down and dying faster, and the hand's contact 25 to 35 dB
 * under the drum from 1 to 8 kHz for its first 20 ms. A slap keeps the head ringing (an
 * open slap) but puts a crack 10 to 14 dB under the drum across 1 to 8 kHz, its 2.3 to 2.6
 * times modes as loud as the fundamental. The muffled stroke, the heel and the toe are gone
 * 20 dB in 15 to 30 ms.
 */
function congaSpecs(f: number): Record<number, StrokeSpec> {
  return {
    // Open: the fingers bounce off near the rim; the head's lowest modes ring.
    1: { f0: f, modes: [[1, 0, 0.95], [1.62, -16, 0.8], [2.3, -15, 0.5], [2.55, -11, 0.45], [3.1, -22, 0.3], [3.6, -26, 0.2]], glide: 0.03, settle: 0.02, contact: 0.003, noise: [[1200, 0.7, 1, 0.0003, 0.005], [3500, 0.7, -1, 0.0002, 0.004], [7000, 0.8, -4, 0.0002, 0.003], [2400, 0.6, -14, 0.0005, 0.025]], level: 0, seconds: 1.4 },
    // Slap: the cupped fingers snap onto the head; a crack across the top, the head's upper modes as loud as the fundamental.
    2: { f0: f, modes: [[1, -3, 0.5], [1.62, -6, 0.45], [2.3, -4, 0.38], [2.55, -2, 0.33], [3.1, -8, 0.25], [3.6, -10, 0.2], [4.4, -12, 0.14]], glide: 0.02, settle: 0.015, contact: 0.0008, noise: [[1500, 0.6, 6, 0.0002, 0.012], [3500, 0.6, 5, 0.0002, 0.012], [7500, 0.7, 1, 0.0002, 0.01]], level: 1, seconds: 0.8 },
    // Muffled: the hand stays on the head; a short, damped tone.
    3: { f0: f * 1.04, modes: [[1, 0, 0.1], [1.62, -10, 0.07], [2.4, -12, 0.06]], glide: 0.02, settle: 0.015, contact: 0.004, noise: [[120, 0.8, 26, 0.001, 0.014], [600, 0.8, 8, 0.0005, 0.008], [2000, 0.8, 3, 0.0003, 0.006]], level: -6, seconds: 0.25 },
    // Heel: the heel of the hand drops onto the head: a dull, broad thump.
    4: { f0: f, modes: [[1, 0, 0.08], [1.62, -6, 0.05]], glide: 0.01, settle: 0.02, contact: 0.006, noise: [[150, 0.7, 30, 0.002, 0.014], [500, 0.8, 24, 0.001, 0.012], [1500, 0.8, 8, 0.0005, 0.008], [3500, 0.8, -2, 0.0003, 0.006]], level: -11, seconds: 0.25 },
    // Toe: the fingertips rock down after the heel: a light tap.
    5: { f0: f, modes: [[1, -8, 0.12], [1.62, -4, 0.1], [2.4, -6, 0.08]], glide: 0.01, settle: 0.015, contact: 0.0025, noise: [[160, 0.8, 8, 0.001, 0.01], [600, 0.8, 10, 0.0005, 0.008], [1100, 0.9, 8, 0.0003, 0.006], [2200, 0.9, 0, 0.0002, 0.004]], level: -12, seconds: 0.25 },
    // Bass: the palm in the middle of the head; the drum's deep tone, the air in the shell.
    6: { f0: f * 0.55, modes: [[1, 0, 0.3], [1.85, -10, 0.18], [2.7, -18, 0.1]], glide: 0.03, settle: 0.03, contact: 0.006, noise: [[180, 0.8, -10, 0.002, 0.02]], level: -2, seconds: 0.6 },
  };
}
/** The three congas' open tones (Hz), as a recorded set was tuned: the quinto (C), the conga (A), the tumba (D). */
const CONGA_PITCH = [263, 217, 152] as const;
const CONGAS = CONGA_PITCH.map(congaSpecs);

/**
 * The bongos: the macho (small) and the hembra (big), measured on a recorded LP pair. The
 * macho's open tone speaks most at about twice its lowest mode (340 and 654 Hz), the
 * hembra's at its lowest (264 Hz) with a long-ringing mode at twice it; both are gone 20 dB
 * in 65 to 130 ms, with the fingers' contact 10 to 30 dB down from 2 to 8 kHz. A slap is
 * gone 20 dB in 20 ms, brightest around 1 kHz.
 */
function bongoSpecs(): Record<number, StrokeSpec> {
  const macho: StrokeSpec = { f0: 340, modes: [[1, -9, 0.23], [1.27, -18, 0.3], [1.81, -17, 0.27], [1.93, 0, 0.3], [2.9, -14, 0.2], [3.9, -20, 0.12]], glide: 0.04, settle: 0.02, contact: 0.0012, noise: [[1100, 0.8, 4, 0.0003, 0.006], [2500, 0.8, 4, 0.0002, 0.006], [5000, 0.9, 0, 0.0002, 0.005]], level: 0, seconds: 0.6 };
  const hembra: StrokeSpec = { f0: 264, modes: [[1, 0, 0.38], [1.54, -9, 0.11], [2.03, -6, 0.9], [2.86, -10, 0.9], [3.05, -11, 0.85]], glide: 0.04, settle: 0.02, contact: 0.0015, noise: [[1000, 0.8, -4, 0.0003, 0.006], [2400, 0.8, -8, 0.0002, 0.005], [5000, 0.9, -12, 0.0002, 0.004]], level: 0, seconds: 1 };
  const slap = (f: StrokeSpec): StrokeSpec => ({ ...f, modes: f.modes.map(([r, d]) => [r, d, 0.06] as Mode), contact: 0.0006, noise: [[1100, 0.8, 4, 0.0002, 0.007], [2600, 0.8, 0, 0.0002, 0.006], [6000, 0.9, -6, 0.0002, 0.004]], level: 1, seconds: 0.3 });
  return {
    1: macho,
    2: slap(macho),
    // The martillo's fingertip: the index finger near the rim, a short ringing tap.
    3: { ...macho, modes: macho.modes.map(([r, d, t]) => [r, d, t * 0.6] as Mode), contact: 0.0011, level: -3 },
    // The thumb: softer and duller, the thumb's flesh on the head.
    4: { ...macho, modes: [[1, 0, 0.12], [1.93, -8, 0.07]], contact: 0.004, noise: [[700, 0.9, -2, 0.0005, 0.006]], level: -10, seconds: 0.3 },
    5: hembra,
    6: slap(hembra),
  };
}
const BONGOS = bongoSpecs();

/**
 * The timbales, measured on a recorded LP pair: thin heads (the macho's lowest mode about
 * 181 Hz, the hembra's 130) on metal shells. The heads' upper modes and the shell ring on
 * for a second and more between 0.5 and 1.5 kHz, which is what a rimshot sets going
 * hardest, with the stick bright to 8 kHz. `TIMBAL_SHELL` is that ring: [Hz, level dB, T60].
 */
const TIMBAL_SHELL: readonly Mode[] = [[520, 0, 1.2], [683, -1, 1.6], [1122, -4, 0.6], [1312, -4, 0.45], [1980, -4, 0.4], [2650, -5, 0.35], [3500, -7, 0.3], [4600, -10, 0.2], [6100, -16, 0.15]];
function timbalSpecs(): Record<number, StrokeSpec> {
  const macho: StrokeSpec = { f0: 181, modes: [[1, 0, 0.27], [1.98, -7.5, 0.82], [2.55, -9.5, 0.4], [2.85, -11, 0.9], [3.1, -15.7, 0.9]], glide: 0.03, settle: 0.02, contact: 0.0006, noise: [[1500, 0.7, -4, 0.0002, 0.005], [3500, 0.8, -8, 0.0002, 0.004], [7000, 0.9, -14, 0.0001, 0.003]], level: 0, seconds: 1.4 };
  const hembra: StrokeSpec = { f0: 130, modes: [[1, 0, 0.82], [1.96, -17, 1.5], [2.69, -19, 0.45], [3.35, -12.7, 0.66], [3.88, -9.2, 1]], glide: 0.03, settle: 0.02, contact: 0.0006, noise: [[1500, 0.7, -4, 0.0002, 0.005], [3500, 0.8, -8, 0.0002, 0.004], [7000, 0.9, -14, 0.0001, 0.003]], level: 0, seconds: 1.6 };
  const rim = (head: StrokeSpec): StrokeSpec => ({ ...head, noise: [[1200, 0.7, 8, 0.0001, 0.008], [3200, 0.7, 10, 0.0001, 0.008], [7000, 0.8, 4, 0.0001, 0.006]], level: 3 });
  return {
    1: macho,
    2: hembra,
    // The shell: the head barely moves; the stick's click and the metal.
    3: { f0: 130, modes: [[1, -30, 0.3], [3.88, -24, 0.5]], glide: 0, settle: 0.02, contact: 0.0004, noise: [[4200, 1.1, -4, 0.0001, 0.002], [1800, 1, -8, 0.0002, 0.003]], level: -3, seconds: 0.9 },
    // Rimshot: head, rim and shell at once, the loudest stroke.
    4: rim(hembra),
    5: rim(macho),
    // The hand muffling the hembra: a dull, short knock.
    6: { f0: 130, modes: [[1, 0, 0.07], [3.88, -12, 0.05]], glide: 0.01, settle: 0.02, contact: 0.004, noise: [[600, 0.9, -2, 0.0008, 0.008]], level: -9, seconds: 0.2 },
    // A roll's soft stroke on the hembra.
    7: { ...hembra, level: -6, seconds: 0.8 },
  };
}
const TIMBALES = timbalSpecs();
/** How much each timbal stroke rings its shell (dB against the head's loudest mode). */
const SHELL_RING: Record<number, number> = { 1: -14, 2: -14, 3: 0, 4: -2, 5: -2, 6: -99, 7: -20 };

/**
 * One stroke on a head into a new recording: its modes (each pitched by the stroke's glide,
 * set going by the hand's contact), and the hand's or stick's noise, at strength `vel`.
 */
export function headStroke(sr: number, spec: StrokeSpec, vel: number, rand: Rand, shell = -Infinity): Float32Array {
  const out = new Float32Array(Math.ceil(spec.seconds * sr));
  const contact = spec.contact * (1.35 - 0.7 * vel);
  const glide = spec.glide * vel * vel * 1.6;
  const top = Math.max(...spec.modes.map(m => m[1]));
  for (const [ratio, db, t60] of spec.modes) {
    const f = spec.f0 * ratio * (1 + (rand() - 0.5) * 0.006);
    const level = 10 ** ((db - top) / 20) * pushAt(f, contact) / pushAt(spec.f0, contact) * (0.9 + rand() * 0.2);
    headMode(out, sr, f, level, (t60 / 6.91) * (0.92 + rand() * 0.16), glide, spec.settle, Math.max(0.0004, contact * 0.6));
  }
  // The hand on the head: harder strokes bring more of the hand's noise.
  for (const [hz, q, db, rise, tau] of spec.noise) noiseBand(out, sr, rand, hz, q, 10 ** ((db + 6 * (vel - 0.65)) / 20) * 0.6, rise, tau);
  // A metal shell ringing on.
  if (shell > -60) {
    for (const [hz, db, t60] of TIMBAL_SHELL) headMode(out, sr, hz * (1 + (rand() - 0.5) * 0.004), 10 ** ((db + shell) / 20) * (0.5 + 0.5 * vel), t60 / 6.91, 0, 1, 0.0003);
  }
  return normalise(out, 0.95);
}

// ── the bells, the clave and the güiro ────────────────────────────────────────

/**
 * A bell's modes: [Hz, level dB, T60 s], at the mouth and at the neck, and its stick's
 * click (Hz, dB). Measured on a recorded Toca mambo bell (mouth and neck) and LP's large
 * hand-held bell: both lead with a pair of modes near 450 to 490 Hz that ring about a third
 * of a second; the mambo bell has more above (750, 970 and 1160 Hz) and a brighter click,
 * and its neck stroke puts the upper modes and the click forward.
 */
const BELLS: Record<'bongoBell' | 'mamboBell', { mouth: readonly Mode[]; neck: readonly Mode[]; click: readonly [number, number] }> = {
  // The bongo bell: big, held in the hand, one strong low ring and little higher up.
  bongoBell: {
    mouth: [[485, 0, 0.33], [445, -13, 0.33], [529, -18, 0.35], [1021, -24, 0.25], [1530, -27, 0.2]],
    neck: [[485, -6, 0.18], [445, -16, 0.18], [1021, 0, 0.15], [1530, -4, 0.12], [2200, -8, 0.1]],
    click: [3000, -4],
  },
  // The mambo bell: mounted on the timbales, brighter, with more modes above.
  mamboBell: {
    mouth: [[474, 0, 0.33], [434, -4, 0.3], [752, -2, 0.13], [968, -12, 0.24], [1162, -6, 0.2], [1560, -12, 0.15]],
    neck: [[474, -3, 0.3], [433, -9, 0.3], [967, 0, 0.3], [1160, -2, 0.15], [1201, -12, 0.14], [2100, -10, 0.12]],
    click: [7500, 12],
  },
};

/** A bell stroke: its modes, the stick's click, and (at the neck) the hand's choke. */
export function bellStroke(sr: number, bell: 'bongoBell' | 'mamboBell', neck: boolean, vel: number, rand: Rand): Float32Array {
  const spec = BELLS[bell];
  const modes = neck ? spec.neck : spec.mouth;
  const out = new Float32Array(Math.ceil((neck ? 0.35 : 0.8) * sr));
  const contact = 0.0006 * (1.35 - 0.7 * vel);
  for (const [hz, db, t60] of modes) {
    const level = 10 ** (db / 20) * pushAt(hz, contact) / pushAt(modes[0]![0], contact) * (0.9 + rand() * 0.2);
    headMode(out, sr, hz * (1 + (rand() - 0.5) * 0.003), level, (t60 / 6.91) * (0.92 + rand() * 0.16), 0, 1, 0.0003);
  }
  const [hz, db] = spec.click;
  noiseBand(out, sr, rand, hz, 0.9, 10 ** ((db + (neck ? 4 : 0)) / 20) * (0.6 + 0.6 * vel), 0.0001, 0.002);
  return normalise(out, 0.95);
}

/**
 * The clave's bars: the first bending mode (Hz) and the next, and how long each rings,
 * measured on recorded claves (rosewood and synthetic pairs: the first mode at 1.6 to 2.6 kHz
 * ringing 0.1 to 0.4 s, the next about 2.2 times higher, the cupped hand under the held bar
 * pulling it from a free bar's 2.76).
 */
const CLAVE_F = 2380;
const CLAVE_MODES: readonly Mode[] = [[1, 0, 0.22], [2.22, -12, 0.25], [4.3, -24, 0.08]];

/** A clave stroke: the two bars' ring (the struck one and the held one, a little apart) and the click. */
export function claveStroke(sr: number, vel: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.ceil(0.3 * sr));
  for (const [bar, level] of [[1, 1], [1.07, 0.45]] as const) {
    for (const [ratio, db, t60] of CLAVE_MODES) headMode(out, sr, CLAVE_F * bar * ratio * (1 + (rand() - 0.5) * 0.004), level * 10 ** (db / 20), (t60 / 6.91) * (0.9 + rand() * 0.2), 0, 1, 0.0002);
  }
  noiseBand(out, sr, rand, 4200, 1.2, 0.25 * (0.6 + 0.6 * vel), 0.0001, 0.0009);
  return normalise(out, 0.95);
}

/**
 * The güiro, measured on recorded gourds scraped both ways: the clicks come about 6 ms apart
 * at the scrape's quickest (160 a second), and the gourd rings most near 1.76 kHz, with
 * 1.16 and 2.7 kHz quieter. `GUIRO_RIDGES_PER_SECOND` sets the rate at the stick's top speed.
 */
const GUIRO_RIDGES_PER_SECOND = 128;
const GOURD: ReadonlyArray<readonly [number, number, number]> = [[1760, 6, 1], [1160, 5, 0.6], [2720, 5, 0.6], [4100, 3, 0.15], [600, 2, 0.15]];

/**
 * A scrape `seconds` long, down (the stick catching the ridges' steep faces: sharp) or up
 * (softer). The stick's speed rises and falls across the stroke (it peaks early on a
 * down-stroke's flick, later on an up-stroke's), so the ridges are crossed fastest in the
 * middle; each crossing is a click, a little uneven, rung through the gourd.
 */
export function guiroStroke(sr: number, up: boolean, seconds: number, vel: number, rand: Rand): Float32Array {
  const len = Math.ceil((seconds + 0.04) * sr);
  const clicks = new Float32Array(len);
  const n = Math.ceil(seconds * sr);
  const peak = up ? 0.6 : 0.4;
  // The stick's position, in ridges: the integral of its speed.
  let pos = 0;
  let nextRidge = 0.5 + rand() * 0.5;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const speed = Math.sin(Math.PI * Math.min(1, x < peak ? (x / peak) * 0.5 : 0.5 + ((x - peak) / (1 - peak)) * 0.5)) ** 0.7;
    pos += (speed * GUIRO_RIDGES_PER_SECOND * 1.25) / sr;
    if (pos >= nextRidge) {
      // A click as the stick drops off a ridge, louder the faster it moves; now and then
      // the stick skips a ridge or chatters.
      const a = (0.35 + 0.65 * speed) * (0.75 + rand() * 0.5) * (up ? 0.65 : 1);
      const width = Math.max(2, Math.round(sr * (up ? 0.0005 : 0.00025)));
      for (let j = 0; j < width && i + j < len; j++) clicks[i + j] = clicks[i + j]! + a * (1 - j / width) * (rand() < 0.5 ? 1 : -1) * (0.6 + 0.4 * rand());
      nextRidge += 0.8 + rand() * 0.4 + (rand() < 0.05 ? 1 : 0);
    }
  }
  // The gourd: each click through its resonances, and a little of the click itself.
  const out = new Float32Array(len);
  for (const [hz, q, level] of GOURD) {
    const w = (2 * Math.PI * hz) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const x = clicks[i]!;
      const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = out[i]! + y * level * (up ? 0.9 : 1);
    }
  }
  for (let i = 0; i < len; i++) out[i] = out[i]! + clicks[i]! * 0.03 * (0.5 + vel);
  return normalise(out, 0.95);
}

// ── the player ────────────────────────────────────────────────────────────────

/** Each instrument's place across the speakers, from the band's side: congas right, bongos and güiro left, timbales right of centre. */
const PAN: Record<LatinKind, number> = { congas: 0.38, bongos: -0.3, timbales: 0.2, bongoBell: -0.3, mamboBell: 0.24, clave: 0.04, guiro: -0.46 };
/** Each instrument's level (a full stroke of its loudest stroke), set against recorded salsa (K-weighted, see the module's note). */
const LEVEL: Record<LatinKind, number> = { congas: 0.5, bongos: 0.34, timbales: 0.36, bongoBell: 0.24, mamboBell: 0.2, clave: 0.2, guiro: 0.16 };

/** The strengths each stroke is rendered at, and how many takes of each. */
const LAYERS = [0.35, 0.65, 0.95] as const;
const TAKES = 2;

/** The rendered strokes, per audio context: rendered at a stroke's first hit and kept. */
const BANKS = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
/** A seeded source for one rendered stroke, from its name, so it renders the same every time. */
function strokeRandom(name: string): Rand {
  let a = 2166136261;
  for (let i = 0; i < name.length; i++) a = Math.imul(a ^ name.charCodeAt(i), 16777619) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function stroke(k: VoiceKit, name: string, make: (sr: number, rand: Rand) => Float32Array): AudioBuffer {
  let bank = BANKS.get(k.ctx);
  if (!bank) { bank = new Map(); BANKS.set(k.ctx, bank); }
  let buf = bank.get(name);
  if (!buf) {
    if (bank.size > 400) bank.clear();
    const sr = k.ctx.sampleRate;
    const data = make(sr, strokeRandom(name));
    buf = k.ctx.createBuffer(1, data.length, sr);
    buf.getChannelData(0).set(data);
    bank.set(name, buf);
  }
  return buf;
}
/** The channel strips: one panner per place and output, made once. */
const STRIPS = new WeakMap<AudioNode, Map<number, StereoPannerNode>>();
function stripOf(k: VoiceKit, out: AudioNode, pan: number): StereoPannerNode {
  let byPan = STRIPS.get(out);
  if (!byPan) { byPan = new Map(); STRIPS.set(out, byPan); }
  const key = Math.round(pan * 100);
  let strip = byPan.get(key);
  if (!strip) {
    strip = k.ctx.createStereoPanner();
    strip.pan.value = key / 100;
    strip.connect(out);
    byPan.set(key, strip);
  }
  return strip;
}

/** How loud a stroke is, by its strength: in step above 0.4, falling away faster below (a ghost note). */
export function strength(vel: number): number {
  return Math.min(1.25, vel >= 0.4 ? vel / 0.95 : (0.4 / 0.95) * (vel / 0.4) ** 2);
}

/** The recording for one note: the instrument, its stroke (`midi`, see engine/src/lofi-salsa.ts) and its strength. */
export function latinStroke(sr: number, kind: LatinKind, midi: number, vel: number, rand: Rand, seconds = 0.2): { data: Float32Array; level: number } {
  switch (kind) {
    case 'congas': {
      const drum = Math.max(0, Math.min(2, Math.floor(midi / 8)));
      const spec = CONGAS[drum]![midi % 8] ?? CONGAS[drum]![1]!;
      return { data: headStroke(sr, spec, vel, rand), level: spec.level };
    }
    case 'bongos': {
      const spec = BONGOS[midi] ?? BONGOS[1]!;
      return { data: headStroke(sr, spec, vel, rand), level: spec.level };
    }
    case 'timbales': {
      const spec = TIMBALES[midi] ?? TIMBALES[2]!;
      return { data: headStroke(sr, spec, vel, rand, SHELL_RING[midi] ?? -16), level: spec.level };
    }
    case 'bongoBell': case 'mamboBell': return { data: bellStroke(sr, kind, midi === 2, vel, rand), level: midi === 2 ? -2 : 0 };
    case 'clave': return { data: claveStroke(sr, vel, rand), level: 0 };
    case 'guiro': return { data: guiroStroke(sr, midi === 2, seconds, vel, rand), level: seconds < 0.15 ? -2 : 0 };
  }
}

/**
 * Play a Latin percussion note: `kind` the instrument, `midi` its stroke, `vel` its
 * strength and `len` (s) a güiro scrape's length. The stroke is rendered on first use at
 * the nearest of its strengths and kept; its loudness follows the strength.
 */
export function perc(k: VoiceKit, out: AudioNode, t: number, midi: number, vel: number, kind: LatinKind, len = 0.2): void {
  const at = vel < 0.5 ? LAYERS[0] : vel < 0.8 ? LAYERS[1] : LAYERS[2];
  const scrape = kind === 'guiro' ? Math.max(0.05, Math.min(0.6, Math.round(len * 50) / 50)) : 0;
  const take = Math.floor(k.rng() * TAKES);
  const name = `${kind}:${midi}:${at}:${take}:${scrape}`;
  const buf = stroke(k, name, (sr, rand) => latinStroke(sr, kind, midi, at, rand, scrape).data);
  const level = strokeLevelOf(kind, midi, scrape);
  const src = k.ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 + (k.rng() - 0.5) * 0.01;
  const g = k.ctx.createGain();
  g.gain.value = LEVEL[kind] * 10 ** (level / 20) * strength(vel) * (0.94 + k.rng() * 0.12);
  g.gain.setTargetAtTime(EPS, t + buf.length / k.ctx.sampleRate, 0.01);
  src.connect(g).connect(stripOf(k, out, PAN[kind]));
  src.start(t);
}

/** A stroke's own loudness against its instrument's loudest (dB), without rendering the stroke. */
function strokeLevelOf(kind: LatinKind, midi: number, seconds: number): number {
  if (kind === 'congas') { const d = CONGAS[Math.max(0, Math.min(2, Math.floor(midi / 8)))]!; return (d[midi % 8] ?? d[1]!).level; }
  if (kind === 'bongos') return (BONGOS[midi] ?? BONGOS[1]!).level;
  if (kind === 'timbales') return (TIMBALES[midi] ?? TIMBALES[2]!).level;
  if (kind === 'bongoBell' || kind === 'mamboBell') return midi === 2 ? -2 : 0;
  if (kind === 'guiro') return seconds < 0.15 ? -2 : 0;
  return 0;
}
