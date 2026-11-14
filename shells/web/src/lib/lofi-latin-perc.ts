// SPDX-License-Identifier: MPL-2.0
/**
 * The Latin percussion section, rendered in code: congas (quinto, conga and tumba), bongos,
 * timbales (the heads, the shell and the rimshot), the bongo bell and the mambo bell, the
 * clave, the güiro and the maracas. Salsa writes them (engine/src/lofi-salsa.ts); any style can play
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
export const LATIN_PERCUSSION = ['congas', 'bongos', 'timbales', 'bongoBell', 'mamboBell', 'clave', 'guiro', 'maracas'] as const;
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
    2: { f0: f, modes: [[1, -3, 0.5], [1.62, -6, 0.45], [2.3, -4, 0.38], [2.55, -2, 0.33], [3.1, -8, 0.25], [3.6, -10, 0.2], [4.4, -12, 0.14]], glide: 0.02, settle: 0.015, contact: 0.0008, noise: [[1500, 0.6, 6, 0.0002, 0.018], [3500, 0.6, 5, 0.0002, 0.02], [7500, 0.7, 1, 0.0002, 0.016]], level: 1, seconds: 0.8 },
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
  const rim = (head: StrokeSpec): StrokeSpec => ({ ...head, noise: [[1200, 0.7, 8, 0.0001, 0.012], [3200, 0.7, 10, 0.0001, 0.016], [7000, 0.8, 4, 0.0001, 0.012]], level: 3 });
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
 * The güiro, measured on recorded gourds scraped both ways (Iowa MIS, VSCO 2 CE): the stick
 * drops off a ridge about every 6 ms at the scrape's quickest, but unevenly (the gaps vary by
 * 30 to 45 per cent), each drop a short burst of grit rather than a click, and the stick
 * rubbing between the ridges keeps the sound going, so the level swings only 10 to 20 dB
 * between the ridges. The gourd shapes all of the sound with a broad ring near 1.85 kHz (10
 * to 20 dB over the spectrum around the ring), with weaker rings at 1.15 and 2.7 kHz and a little body
 * under 1 kHz, and little survives above 8 kHz.
 */
const GUIRO_RIDGES_PER_SECOND = 160;
/** How uneven the ridges' spacing is (one deviation, as a share of the mean gap). */
const GUIRO_SPACING = 0.4;
/** The rubbing between the ridges against a ridge's drop (a share of its peak). */
const GUIRO_RUB = 0.09;
/** The gourd's resonances: [Hz, Q, level]; and the share of the stick's own grit heard direct. */
const GOURD: ReadonlyArray<readonly [number, number, number]> = [[1850, 8, 1], [2700, 6, 0.45], [1150, 4, 0.35], [650, 1.6, 0.25]];
const GOURD_DIRECT = 0.12;

/** A gamma-distributed draw with mean 1 and deviation `cv` (a sum of exponentials, `k` = 1 / cv²). */
function gammaDraw(rand: Rand, cv: number): number {
  const k = Math.max(1, Math.round(1 / (cv * cv)));
  let s = 0;
  for (let i = 0; i < k; i++) s -= Math.log(1 - rand() * 0.999999);
  return s / k;
}

/**
 * A scrape `seconds` long, down (away from the player: the stick catching the ridges' steep
 * faces, sharper, and speeding up through the stroke) or up (back: softer, quickest in its
 * middle). Each ridge the stick drops off is a burst of grit a millisecond long, louder the
 * faster the stick, never two alike; between them the stick rubs; the gourd rings it all.
 */
export function guiroStroke(sr: number, up: boolean, seconds: number, vel: number, rand: Rand): Float32Array {
  const len = Math.ceil((seconds + 0.03) * sr);
  const grit = new Float32Array(len);
  const n = Math.ceil(seconds * sr);
  // The stick's speed across the stroke: a quick start, then held (down) or a rise and fall (up).
  const speedAt = (x: number): number => (up
    ? Math.sin(Math.PI * Math.min(1, x)) ** 0.6
    : Math.min(1, x / 0.25) ** 0.7 * (x > 0.85 ? Math.max(0, (1 - x) / 0.15) ** 0.5 : 1));
  let pos = 0;
  let next = 0.3 + rand() * 0.5;
  const burst = Math.round(sr * (up ? 0.0014 : 0.0009));
  const fall = Math.exp(-1 / (sr * (up ? 0.0005 : 0.00032)));
  for (let i = 0; i < n; i++) {
    const v = speedAt(i / n);
    pos += (v * GUIRO_RIDGES_PER_SECOND) / sr;
    // The rub between the ridges, following the stick's speed.
    grit[i] = grit[i]! + (rand() * 2 - 1) * GUIRO_RUB * v;
    if (pos >= next) {
      // A drop off the ridge: its own strength (log-normal), louder the faster the stick moves.
      const a = (0.3 + 0.7 * v) * Math.exp(0.35 * (rand() + rand() + rand() - 1.5)) * (up ? 0.7 : 1);
      let e = a;
      for (let j = 0; j < burst && i + j < len; j++) { grit[i + j] = grit[i + j]! + (rand() * 2 - 1) * e; e *= fall; }
      next += gammaDraw(rand, GUIRO_SPACING);
    }
  }
  // The gourd: its resonances, and a little of the grit direct through a gentle low-pass.
  const out = new Float32Array(len);
  for (const [hz, q, level] of GOURD) {
    const w = (2 * Math.PI * hz) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const x = grit[i]!;
      const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = out[i]! + y * level;
    }
  }
  const k = 1 - Math.exp((-2 * Math.PI * (up ? 3500 : 4500)) / sr);
  let l1 = 0, l2 = 0;
  const direct = GOURD_DIRECT * (0.6 + 0.6 * vel);
  for (let i = 0; i < len; i++) {
    l1 += k * (grit[i]! - l1);
    l2 += k * (l1 - l2);
    out[i] = out[i]! + l2 * direct;
  }
  // Little survives above 8 kHz (recorded: the 16 kHz octave 27 to 45 dB down).
  const top = 1 - Math.exp((-2 * Math.PI * 7000) / sr);
  let t1 = 0, t2 = 0;
  for (let i = 0; i < len; i++) { t1 += top * (out[i]! - t1); t2 += top * (t1 - t2); out[i] = t2; }
  // The stroke's last few milliseconds fade, as the stick leaves the gourd.
  const tail = Math.min(len, Math.round(0.004 * sr));
  for (let i = 0; i < tail; i++) out[n - 1 - i] = (out[n - 1 - i] ?? 0) * (i / tail);
  return normalise(out, 0.95);
}

/**
 * The maracas, measured on recorded pairs (a big pair shaken both ways, a Meinl pair played
 * at 220 beats a minute, a single maraca; Freesound CC0): a shake is hundreds of seeds hitting
 * the shell, so its sound is a burst of grains, not a tone. It rises to its peak in 15 to 35 ms
 * as the seeds fly across, falls 20 dB in about 40 ms, and lives almost all above 5 kHz: the
 * 8 kHz octave leads, 16 kHz is 4 to 9 dB under it, 4 kHz 10 to 20 dB and 2 kHz about 30 dB
 * under, the shells ringing broadly between 6.5 and 12 kHz. The grains make the level jump
 * about 14 dB from millisecond to millisecond. A forward flick throws the seeds hard against
 * the far wall, sharper and louder than the back stroke; the two maracas of a pair differ a
 * little in size.
 */
const MARACA_SHELL: ReadonlyArray<readonly [number, number, number]> = [[7800, 1.6, 1], [10800, 2, 0.8], [4300, 3, 0.06]];
/** The seeds' impacts at a shake's busiest (per second), and how the burst rises and falls (s). */
const MARACA_GRAINS = 7000;
const MARACA_RISE = { forward: 0.005, back: 0.009 } as const;
const MARACA_FALL = { forward: 0.02, back: 0.025 } as const;

/**
 * One shake: `midi` 1 the right maraca forward, 2 the left forward, 3 the right back, 4 the
 * left back. A burst of seed impacts arriving at random, each a tiny click, their rate rising
 * and falling through the shake, rung through the shell.
 */
export function maracaStroke(sr: number, midi: number, vel: number, rand: Rand): Float32Array {
  const back = midi >= 3;
  const left = midi % 2 === 0;
  const rise = back ? MARACA_RISE.back : MARACA_RISE.forward;
  const fall = back ? MARACA_FALL.back : MARACA_FALL.forward;
  const len = Math.ceil(0.16 * sr);
  const grains = new Float32Array(len);
  // The rate's shape, (1 - e^-t/rise) e^-t/fall, normalised to peak at 1.
  const tp = rise * Math.log(1 + fall / rise);
  const peak = (1 - Math.exp(-tp / rise)) * Math.exp(-tp / fall);
  const click = Math.exp(-1 / (sr * 0.00008));
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const busy = ((1 - Math.exp(-t / rise)) * Math.exp(-t / fall)) / peak;
    const rate = MARACA_GRAINS * (0.6 + 0.4 * vel) * busy;
    if (rand() < rate / sr) {
      // A seed hits the shell: its own strength (most are light, a few hard; the seeds hit
      // harder once they are flying), a click 0.1 ms long.
      let a = -Math.log(1 - rand() * 0.999) * (back ? 0.7 : 1) * (0.3 + 0.7 * busy);
      for (let j = 0; j < 12 && i + j < len; j++) { grains[i + j] = grains[i + j]! + (rand() * 2 - 1) * a; a *= click; }
    }
  }
  // The shell: broad resonances high up (the left maraca a little bigger, so a little lower).
  const out = new Float32Array(len);
  const size = left ? 0.9 : 1;
  for (const [hz, q, level] of MARACA_SHELL) {
    const w = (2 * Math.PI * Math.min(hz * size, sr * 0.45)) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const x = grains[i]!;
      const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = out[i]! + y * level;
    }
  }
  // Little of a shake is under 5 kHz: two high-passes at 4 kHz.
  const h = Math.exp((-2 * Math.PI * 4000) / sr);
  let p1 = 0, p2 = 0, q1 = 0, q2 = 0;
  for (let i = 0; i < len; i++) {
    const x = out[i]!;
    q1 = h * (q1 + x - p1); p1 = x;
    q2 = h * (q2 + q1 - p2); p2 = q1;
    out[i] = q2;
  }
  return normalise(out, 0.95);
}

// ── the player ────────────────────────────────────────────────────────────────

/** Each instrument's place across the speakers, from the band's side: congas right, bongos and güiro left, timbales right of centre. */
const PAN: Record<LatinKind, number> = { congas: 0.38, bongos: -0.3, timbales: 0.2, bongoBell: -0.3, mamboBell: 0.24, clave: 0.04, guiro: -0.46, maracas: -0.12 };
/**
 * Each instrument's level (a full stroke of its loudest stroke), set against four recorded
 * salsa bands: the percussion stem about 3 dB under the whole mix, and the mix's octave bands
 * from 125 Hz to 2 kHz within about 2 dB of the recordings' average.
 */
const LEVEL: Record<LatinKind, number> = { congas: 0.5, bongos: 0.45, timbales: 0.62, bongoBell: 0.32, mamboBell: 0.36, clave: 0.3, guiro: 0.3, maracas: 0.5 };

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
    case 'maracas': return { data: maracaStroke(sr, midi, vel, rand), level: midi >= 3 ? -3 : 0 };
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
  if (kind === 'maracas') return midi >= 3 ? -3 : 0;
  return 0;
}
