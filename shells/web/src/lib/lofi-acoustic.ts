// SPDX-License-Identifier: MPL-2.0
/**
 * A steel-string flat-top acoustic guitar, built from measurements of recorded ones: a
 * modal string (a sum of its partials, each with its own frequency, level and decay, as in
 * ./lofi-electric.ts) heard through the guitar's body, with the noises a player makes.
 * Measured for measurement only, from public-domain (CC0) recordings: open low E strings
 * on two guitars (one through a large-diaphragm condenser), an open high E, single notes
 * from E2 to D5 and strummed chords from a dynamic-microphone one-shot set, a dreadnought
 * arpeggio and a strummed C chord on a handheld recorder. No recording is in this
 * repository and nothing here is taken from one sample by sample: what is kept is numbers,
 * noted where they are used.
 *
 * - The string: a stiff string's partials, n f sqrt(1 + B n^2), plucked at a point (the
 *   partials with a node there thinned), the pick's roll-off, and two planes beating, as
 *   the electric's. Measured B: about 1e-5 on the open low E, 4e-5 on the open high E, up
 *   to 1.6e-4 on fretted notes (B grows as the square of the shortening).
 * - Decay: each partial loses 1 + 14 f + 6 f^2 dB a second up to 1.5 kHz (f in kHz), then
 *   more (see acousticDecay), fitted to the open low E (1.8 to 3.5 dB/s at 82 Hz, 9 to 12 at
 *   490, 19 to 22 at 820, 31 to 37 at 1.55 kHz) and the open high E. An acoustic's top
 *   dies far sooner than an electric's: the body takes the string's energy and radiates
 *   that energy as sound. A partial on one of the body's strong modes gives its energy up faster still.
 * - The body: the resonances of the top, the back and the air in the box ("the struts":
 *   the braced top's modes), measured from the attack of seventeen notes with every
 *   harmonic taken out, so what is left is the body ringing. The air resonance near 109
 *   Hz, the top's and back's modes from 150 to 300 Hz, then modes every hundred hertz or
 *   so up to 5 kHz, the whole falling about 27 dB from 250 Hz to 2 kHz. Every partial is
 *   heard through them, and every pluck sets them ringing for a moment (a knock under the
 *   note: a low mode rings for about a quarter of a second).
 * - Playing it: the pick's contact before the string goes, its click, the unsettled first
 *   milliseconds; the open strings ringing in sympathy where a partial of the note meets
 *   one of theirs; a finger squeaking along a wound string on a slide; now and then a fret
 *   buzz on a hard stroke; and a raked string muted under the fretting hand (a dead note).
 *
 * Pure but for the player at the end: the strokes are rendered into buffers, each once
 * per context, and played back.
 */
/** What the player needs of a voice kit (lib/lofi-voices.ts's VoiceKit has these). */
interface Kit { ctx: BaseAudioContext; rng: () => number }

// ── the guitar ───────────────────────────────────────────────────────────────

/** Standard tuning (Hz), low E to high E. */
const OPEN = [82.41, 110, 146.83, 196, 246.94, 329.63] as const;
/** The scale length (mm) of a dreadnought. */
const SCALE = 645;
/** Each open string's stiffness (B), low E to high E: the wound strings' low, the plain strings' measured 4e-5 on the high E. */
const STIFF = [1.2e-5, 2.5e-5, 5e-5, 6e-5, 6e-5, 4e-5] as const;
/** The wound strings (low E to G), whose windings squeak under a sliding finger. */
const WOUND = 4;

/**
 * The body's modes, measured (Hz, dB re. the strongest, Q): the attack of seventeen notes
 * with their harmonics taken out, averaged and smoothed in twenty-fourths of an octave.
 * Below 300 Hz the averaged peaks are broad (several guitars, smeared), so their Q is set
 * to a single guitar's (10 to 20, as the cleanest of them measured).
 */
const BODY: ReadonlyArray<readonly [number, number, number]> = [
  [109, -2.4, 10], [149, -1.8, 12], [178, -4.1, 10], [205, -3.8, 14], [222, -4.4, 14], [248, 0, 20],
  [277, -3.9, 14], [296, -3.2, 14], [393, -6.7, 19], [563, -14, 25], [599, -14.8, 13], [786, -15.9, 21],
  [899, -16.2, 20], [974, -13, 25], [1055, -16.3, 12], [1132, -18.4, 18], [1295, -20.9, 16], [1397, -24.1, 12],
  [1480, -23, 12], [1552, -26.2, 12], [1676, -22.1, 14], [1783, -22.6, 14], [1942, -23.3, 24], [2109, -22.8, 28],
  [2264, -28.2, 28], [2384, -26.4, 18], [2510, -28.1, 14], [2704, -29.4, 14], [2892, -28.6, 16], [3020, -29.2, 16],
  [3132, -29, 26], [3417, -28.6, 30], [3701, -25.3, 30], [4100, -33, 26], [4530, -29.5, 30], [4720, -28.5, 30],
];
/** Between the measured modes above 500 Hz a real top has many more, too close to tell apart in an average: a fixed set of them, under the measured level by this much. */
const FILL_DB = -5, FILL_FROM = 500, FILL_TO = 5200, FILL_COUNT = 30;
/** How much of the body's response is not one resonance but the many it is too dense to tell apart: the measured envelope at this share of the strongest mode. */
const BODY_SMOOTH = 0.35;

/** A level by frequency, read off a few (Hz, dB) points on a log scale. */
function curve(pts: ReadonlyArray<readonly [number, number]>, f: number): number {
  if (f <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [f1, d1] = pts[i]!, [f0, d0] = pts[i - 1]!;
    if (f <= f1) return d0 + ((d1 - d0) * Math.log(f / f0)) / Math.log(f1 / f0);
  }
  return pts[pts.length - 1]![1];
}
/**
 * What the averaged attack leaves out: it is the body answering the pick's push and
 * click, whose own spectrum falls with frequency, so the body itself is that much
 * brighter (dB). Set so the open strings' partials, through the body, come out at the
 * recorded notes' levels: a high E's 1 to 4 kHz about 18 dB under its fundamental 50 ms
 * in, a low E's 1 to 2 kHz 15 to 24 dB under its loudest partial.
 */
function liftDb(f: number): number {
  return curve([[300, 0], [600, 6], [1000, 9], [2000, 13], [4000, 15]], f);
}
/** The measured body's level falling with frequency (dB re. 250 Hz), from the same average. */
function envelopeDb(f: number): number {
  return curve(ENVELOPE, f);
}
/**
 * Below the air resonance the top and the sound hole move against each other and the body
 * hardly radiates: the low end is set from the open low E's fundamental (15 to 20 dB under
 * its third partial in both recordings), not from the attack average, which held handling
 * noise down there.
 */
const ENVELOPE: ReadonlyArray<readonly [number, number]> = [[70, -26], [85, -19], [100, -7], [112, -3], [150, -2], [250, 0], [400, -10], [600, -15], [800, -18], [1000, -16], [1400, -23], [2000, -27], [3000, -30], [4200, -35], [6000, -40]];

/** One body mode: frequency, gain (linear) and Q. */
interface Mode { f: number; g: number; q: number }
/** The modes, measured and filled in: the same set every time (a fixed seed). */
const MODES: readonly Mode[] = (() => {
  const out: Mode[] = BODY.map(([f, db, q]) => ({ f, g: 10 ** ((db + liftDb(f)) / 20), q }));
  let a = 0x5eed1e;
  const r = (): number => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return a / 4294967296; };
  for (let i = 0; i < FILL_COUNT; i++) {
    const f = FILL_FROM * (FILL_TO / FILL_FROM) ** ((i + r()) / FILL_COUNT);
    out.push({ f, g: 10 ** ((envelopeDb(f) + liftDb(f) + FILL_DB + (r() - 0.5) * 6) / 20), q: 14 + r() * 18 });
  }
  return out.sort((x, y) => x.f - y.f);
})();


/** One mode's response at `f` (1 at its own frequency). */
function resonance(m: Mode, f: number): number {
  const x = m.q * (f / m.f - m.f / f);
  return 1 / Math.sqrt(1 + x * x);
}
/** The body's response at `f` (the strongest mode's peak is about 1): the modes added as powers, over the measured envelope. */
export function bodyAt(f: number): number {
  const smooth = BODY_SMOOTH * 10 ** ((envelopeDb(f) + liftDb(f)) / 20);
  let p = smooth * smooth;
  for (const m of MODES) { const r = m.g * resonance(m, f); p += r * r; }
  return Math.sqrt(p);
}
/** How strongly a partial at `f` drives the body (0 to about 1): the share of the strongest mode's. */
function coupling(f: number): number {
  let best = 0;
  for (const m of MODES) best = Math.max(best, m.g * resonance(m, f));
  return best;
}

/**
 * Decibels a second a partial at `hz` loses on string `string` (see the header): 1 + 14 f
 * + 6 f^2 up to 1.5 kHz (f in kHz), then 8 a kHz more on a plain string (the high E's 2 to 4 kHz
 * measured 26 to 40 dB/s, its 4 to 8 kHz about 60) or 20 on a wound one (the low E's 2 to
 * 4 kHz about 75). A muted string's far more.
 */
export function acousticDecay(hz: number, string = 5, dead = false): number {
  const kHz = hz / 1000;
  if (dead) return 500 + 900 * kHz;
  const low = Math.min(kHz, 1.5);
  return 1 + 14 * low + 6 * low * low + (string < WOUND ? 20 : 8) * Math.max(0, kHz - 1.5) + COUPLED_DB * coupling(hz);
}
/** The extra decay (dB/s) of a partial sitting on the strongest body mode. */
const COUPLED_DB = 2;
/** How fast a stopped note dies (dB/s at 0 Hz and more per kHz): the fretting hand lifting off, damping the string. */
const LIFT = [60, 300] as const;

// ── a stroke ─────────────────────────────────────────────────────────────────

export interface AcousticSpec {
  sr: number; f: number;
  /** Seconds to render. */
  seconds: number;
  /** The string (0 low E to 5 high E) and fret it is played on. */
  string: number; fret: number;
  /** Where the pick strikes, mm from the bridge saddle. */
  pickMm: number;
  /** How hard: 0 gently, 1 firmly, 2 hard. */
  layer: 0 | 1 | 2;
  /** When the fretting hand lifts off and damps the note (s); absent, it rings. */
  end?: number;
  /** A raked string muted under the fretting hand: a thud and the pick's click, no note. */
  dead?: boolean;
  /** A finger sliding into the note along the string (the squeak on a wound string). */
  slide?: boolean;
  /** The string touching a fret as it swings: a buzz in the first moments of a hard stroke. */
  buzz?: boolean;
}

/** The highest partial worth rendering (Hz): the measured body is 40 dB down by 6 kHz. */
const TOP = 6500;
/** The pick's roll-off (Hz), by stroke, and how much of a partial with a node at the pick is left (its width). */
const PICK_TOP = [2400, 4200, 7500] as const, PICK_FILL = 0.25;
/** How far sharp a stroke starts (cents) and how fast it settles (s). */
const GLIDE = [3, 6, 10] as const, GLIDE_TAU = 0.045;
/** The partials that get a second plane, its level against the first and how far apart they beat (Hz). */
const PLANES = 14, PLANE_MIN = 0.06, PLANE_SPAN = 6;
/** The level a stroke is brought to: the root-mean-square of its partials. */
const LEVEL = 0.2;
/** The body's own ring under each pluck (a knock), against the string, by stroke. */
const KNOCK = [0.06, 0.09, 0.14] as const;
/** The open strings' sympathy: how much of a meeting partial they take up, how fast it grows in (s), and how close counts as meeting (a fraction). */
const SYMPATHY = 0.07, SYMPATHY_TAU = 0.09, SYMPATHY_NEAR = 0.006;
/** A finger's squeak along a wound string and along a plain one, against the note's level: about 15 dB under the note on a wound string, a whisper on a plain one. */
const SQUEAK = [1.6, 0.25] as const;
/** A fret buzz's rattle against the note's level (about 20 dB under it, in its first 70 ms). */
const BUZZ = 2.2;
/** The pick's contact before it lets the string go (s), the click's level against the note (dB), by stroke. */
const LEAD = [0.009, 0.006, 0.005] as const, CLICK_DB = [-28, -24, -19] as const;

/** A seeded 0..1. */
function mulberry(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One decaying partial added into `out` from `at`: amplitude, Hz, decay before and after `end` (nepers a second), a second plane and its beat, and a share that grows in over `grow` s. */
function addPartial(out: Float32Array, sr: number, at: number, amp: number, hz: number, alpha: number, endAlpha: number, endAt: number, plane: number, beat: number, phase: number, grow: number, sharp: number): void {
  const len = out.length - at;
  const dbPer = (a: number): number => (a * 20) / Math.LN10 / sr;
  const ringFor = Math.ceil(80 / dbPer(alpha));
  const life = Math.min(len, ringFor <= endAt ? ringFor : endAt + Math.ceil(Math.max(0, 80 - dbPer(alpha) * endAt) / dbPer(endAlpha)));
  const glideEnd = Math.ceil(GLIDE_TAU * 6 * sr);
  const BLOCK = 32;
  let re = 1, im = 0, rg = 1, ig = 0, rp = Math.cos(phase), ip = Math.sin(phase);
  const g = grow > 0 ? -amp : 0, ap = amp * plane;
  for (let s = 0; s < life; s += BLOCK) {
    const e = Math.min(life, s + BLOCK);
    const a = s >= endAt ? endAlpha : alpha;
    const m = s < glideEnd ? 1 + sharp * Math.exp(-s / sr / GLIDE_TAU) : 1;
    const w = (2 * Math.PI * hz * m) / sr, wp = (2 * Math.PI * (hz + beat) * m) / sr;
    const d1 = Math.exp(-a / sr), dg = grow > 0 ? Math.exp((-a - 1 / grow) / sr) : 0, dp = Math.exp((-a * 0.85) / sr);
    const c1 = Math.cos(w) * d1, s1 = Math.sin(w) * d1, cg = Math.cos(w) * dg, sg = Math.sin(w) * dg, cp = Math.cos(wp) * dp, sp = Math.sin(wp) * dp;
    for (let i = s; i < e; i++) {
      out[at + i] = out[at + i]! + amp * im + g * ig + ap * ip;
      const r1 = re * c1 - im * s1; im = re * s1 + im * c1; re = r1;
      if (g !== 0) { const r2 = rg * cg - ig * sg; ig = rg * sg + ig * cg; rg = r2; }
      if (ap !== 0) { const r3 = rp * cp - ip * sp; ip = rp * sp + ip * cp; rp = r3; }
    }
  }
}

/** A two-pole band-pass (constant peak gain) run over `x` from `from` to `to`, in place. */
function bandPass(x: Float32Array, from: number, to: number, sr: number, hz: number, q: number): void {
  const w = (2 * Math.PI * Math.min(hz, sr * 0.45)) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = from; i < Math.min(to, x.length); i++) {
    const v = x[i]!, y = b0 * v - b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
  }
}

/** The partials of a stroke: frequency, amplitude (signed by the pick's side), decay. */
export function acousticPartials(spec: AcousticSpec): Array<{ hz: number; amp: number; db: number }> {
  const { f, sr } = spec;
  const length = SCALE * 2 ** (-spec.fret / 12);
  const q = Math.min(0.45, Math.max(0.03, spec.pickMm / length));
  const B = (STIFF[spec.string] ?? 4e-5) * 2 ** ((2 * spec.fret) / 12);
  const speed = (2 * length * f) / 1000;
  const pickTop = PICK_TOP[spec.layer] * (speed / 214);
  const top = Math.min(TOP, sr * 0.45);
  const out: Array<{ hz: number; amp: number; db: number }> = [];
  for (let n = 1; ; n++) {
    const hz = n * f * Math.sqrt(1 + B * n * n);
    if (hz > top) break;
    const sq = Math.sin(n * Math.PI * q);
    const amp = (Math.sqrt(sq * sq + PICK_FILL * PICK_FILL) / n / Math.sqrt(1 + (hz / pickTop) ** 2)) * bodyAt(hz);
    out.push({ hz, amp, db: acousticDecay(hz, spec.string, spec.dead) });
  }
  return out;
}

/** Render one stroke. `rand` seeds its small differences (the planes, the click, the noises). */
export function acousticString(spec: AcousticSpec, rand: () => number): Float32Array {
  const { sr, f } = spec;
  const len = Math.ceil(spec.seconds * sr);
  const out = new Float32Array(len);
  const lead = spec.dead ? 0 : Math.min(len >> 3, Math.round(LEAD[spec.layer] * (0.75 + rand() * 0.5) * sr));
  const endAt = spec.end !== undefined ? Math.max(0, Math.round(spec.end * sr)) : Infinity;
  const parts = acousticPartials(spec);
  let power = 0;
  for (const p of parts) power += (p.amp * p.amp) / 2;
  const scale = power > 0 ? LEVEL / Math.sqrt(power) : 0;
  const sharp = 2 ** (GLIDE[spec.layer] / 1200) - 1;
  const nep = (db: number): number => (db * Math.LN10) / 20;
  const liftAlpha = (hz: number): number => nep(LIFT[0] + LIFT[1] * (hz / 1000));
  // The string, from the pick's release.
  for (const [n, p] of parts.entries()) {
    const second = n < PLANES && !spec.dead;
    const alpha = nep(p.db);
    addPartial(out, sr, lead, p.amp * scale, p.hz, alpha, Math.max(alpha, liftAlpha(p.hz)), endAt, second ? PLANE_MIN * PLANE_SPAN ** rand() : 0,
      second ? 0.4 * 6 ** rand() * (rand() < 0.5 ? -1 : 1) : 0, rand() * 2 * Math.PI, 0, sharp);
  }
  // The open strings in sympathy: where one of the note's partials meets one of an open
  // string's (not the string it is played on), that open string takes a little up, grows
  // in and rings on after the note is let go.
  if (!spec.dead) {
    for (const [s, open] of OPEN.entries()) {
      if (s === spec.string && spec.fret === 0) continue;
      for (let j = 1; j <= 8; j++) {
        const hz = j * open * Math.sqrt(1 + STIFF[s]! * j * j);
        const near = parts.find(p => Math.abs(p.hz / hz - 1) < SYMPATHY_NEAR);
        if (!near) continue;
        const alpha = nep(acousticDecay(hz, s));
        addPartial(out, sr, lead, near.amp * scale * SYMPATHY, hz, alpha, alpha, Infinity, 0, 0, rand() * 2 * Math.PI, SYMPATHY_TAU, 0);
      }
    }
  }
  // The body's own ring: the pluck knocks every mode, each dying at its own rate (a low
  // mode in about a quarter of a second); stronger the harder the stroke.
  const knock = KNOCK[spec.layer] * LEVEL * (spec.dead ? 2.2 : 1);
  for (const m of MODES) {
    if (m.f > sr * 0.45) continue;
    const alpha = (Math.PI * m.f) / m.q;
    // The string's force at the bridge falls with frequency, so the low modes take most of the knock.
    const amp = knock * m.g * Math.min(1, 150 / m.f) * (0.8 + rand() * 0.4);
    addPartial(out, sr, lead, amp, m.f, alpha, alpha, Infinity, 0, 0, rand() * 2 * Math.PI, 0, 0);
  }
  // The pick lets go over about a millisecond: no click from the partials starting at full tilt.
  const ramp = Math.min(len - lead, Math.round(0.0008 * sr));
  for (let i = 0; i < ramp; i++) out[lead + i] = out[lead + i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / ramp));
  // The pick's click as it lets go, its lows taken out, and the contact before it: the string pushed aside and the pick scraping.
  const click = 10 ** (CLICK_DB[spec.layer] / 20) * LEVEL * 3 * (spec.dead ? 2 : 1);
  const clickLen = Math.min(len - lead, Math.round(0.01 * sr));
  const noise = new Float32Array(len);
  for (let i = 0; i < clickLen; i++) noise[lead + i] = (rand() * 2 - 1) * Math.exp(-i / (0.0012 * sr)) * click;
  for (let i = 0; i < lead; i++) noise[i] = (rand() * 2 - 1) * (i / lead) ** 1.5 * click * 0.5;
  bandPass(noise, 0, lead + clickLen, sr, 2600, 0.6);
  for (let i = 0; i < lead + clickLen; i++) out[i] = out[i]! + noise[i]!;
  // A finger sliding along a wound string: the windings squeak, the squeak rising as the hand speeds up.
  if (spec.slide) {
    const level = (spec.string < WOUND ? SQUEAK[0] : SQUEAK[1]) * LEVEL;
    const n = Math.min(len, Math.round((0.05 + rand() * 0.04) * sr));
    const sq = new Float32Array(n);
    for (let i = 0; i < n; i++) sq[i] = (rand() * 2 - 1) * Math.sin((Math.PI * i) / n);
    const parts2 = 4;
    for (let k = 0; k < parts2; k++) bandPass(sq, Math.floor((k * n) / parts2), Math.floor(((k + 1) * n) / parts2), sr, 1400 + 1300 * (k / parts2), 5);
    for (let i = 0; i < n; i++) out[i] = out[i]! + sq[i]! * level;
  }
  // A fret buzz: the string slapping a fret once a swing, for the first few hundredths of a second.
  if (spec.buzz && !spec.dead) {
    const n = Math.min(len - lead, Math.round(0.07 * sr));
    const bz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const contact = Math.sin(Math.PI * f * (i / sr)) ** 8;
      bz[i] = (rand() * 2 - 1) * contact * Math.exp(-i / (0.025 * sr));
    }
    bandPass(bz, 0, n, sr, 3800, 1.1);
    for (let i = 0; i < n; i++) out[lead + i] = out[lead + i]! + bz[i]! * LEVEL * BUZZ;
  }
  return out;
}

// ── played ───────────────────────────────────────────────────────────────────

/** The string and fret a melody note is played on: the highest string that reaches it within twelve frets, else the high E. */
export function stringFor(midi: number): { string: number; fret: number } {
  const m = Math.round(midi);
  const opens = [40, 45, 50, 55, 59, 64];
  for (let s = 5; s >= 0; s--) {
    const fret = m - opens[s]!;
    if (fret >= 0 && fret <= 12) return { string: s, fret };
  }
  return m < 40 ? { string: 0, fret: 0 } : { string: 5, fret: m - 64 };
}

/** How hard a note is picked, from its level. */
function layerOf(vel: number): 0 | 1 | 2 {
  return vel < 0.5 ? 0 : vel < 0.75 ? 1 : 2;
}

/** The strokes rendered so far, per context. */
const STROKES = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
/** Render lengths (s) a stroke takes the shortest of, so a short note costs little and is shared. */
const LENGTHS = [0.6, 1.4, 2.6, 4] as const;

/** A stroke's buffer, rendered on first use; two variants of each, so repeats differ. */
export function acousticBuffer(ctx: BaseAudioContext, spec: Omit<AcousticSpec, 'sr'>, variant: number): AudioBuffer {
  let cache = STROKES.get(ctx);
  if (!cache) { cache = new Map(); STROKES.set(ctx, cache); }
  const key = `${spec.f.toFixed(2)}|${spec.string}|${spec.fret}|${spec.pickMm}|${spec.layer}|${spec.seconds}|${spec.end ?? '-'}|${spec.dead ? 1 : 0}|${spec.slide ? 1 : 0}|${spec.buzz ? 1 : 0}|${variant}`;
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 400) cache.clear();
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    const data = acousticString({ ...spec, sr: ctx.sampleRate }, mulberry(h));
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    cache.set(key, buf);
  }
  return buf;
}

/** How a note is played: 2 slid into from a tone below, 3 hammered on from a tone below, 4 a muted rake (a dead string). */
export interface AcousticPlay { art?: number; keys?: boolean }

/**
 * An acoustic guitar note at `t`: the stroke's buffer, the fretting hand lifting off at
 * the note's end (inside the buffer, so the open strings' sympathy rings on), a slide or a
 * hammer-on moving the pitch, and a light vibrato on a held lead note. `level` is the
 * voice's level for a note of strength `vel`.
 */
export function acousticNote(k: Kit, out: AudioNode, t: number, midi: number, vel: number, dur: number, level: number, o: AcousticPlay = {}): void {
  const { ctx } = k;
  const art = o.art ?? 0;
  const where = stringFor(midi);
  const layer = layerOf(vel);
  const dead = art === 4;
  // The fretting hand lets go at the note's end; rounded so notes of a tune share their strokes.
  const end = dead ? undefined : Math.min(3.5, Math.max(0.08, Math.round(dur * 20) / 20));
  const need = dead ? 0.3 : (end ?? 0) + 1.2;
  const seconds = LENGTHS.find(l => l >= need) ?? LENGTHS[LENGTHS.length - 1]!;
  const spec: Omit<AcousticSpec, 'sr'> = {
    f: 440 * 2 ** ((midi - 69) / 12), seconds, ...where, pickMm: o.keys ? 160 : 140, layer,
    ...(end === undefined ? {} : { end }), ...(dead ? { dead } : {}), ...(art === 2 ? { slide: true } : {}),
    ...(!dead && layer === 2 && k.rng() < 0.12 ? { buzz: true } : {}),
  };
  const buf = acousticBuffer(ctx, spec, k.rng() < 0.5 ? 0 : 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.detune.value = (k.rng() - 0.5) * 4;
  if (art === 2 || art === 3) {
    const from = 2 ** (-2 / 12);
    const hold = art === 3 ? Math.min(0.07, dur * 0.3) : 0.02;
    src.playbackRate.setValueAtTime(from, t);
    src.playbackRate.setValueAtTime(from, t + hold);
    src.playbackRate.exponentialRampToValueAtTime(1, t + hold + (art === 3 ? 0.012 : 0.06));
  }
  if (!o.keys && !dead && dur > 0.6) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(7, t + 0.3);
    lfo.connect(depth).connect(src.detune);
    lfo.start(t);
    lfo.stop(t + seconds);
  }
  const g = ctx.createGain();
  g.gain.value = level;
  src.connect(g).connect(out);
  src.start(t);
  src.stop(t + seconds);
}
