// SPDX-License-Identifier: MPL-2.0
/**
 * A real drum kit, rendered in code: the cymbals, the hats, the snare, the toms and an
 * acoustic bass drum, each as the physics of the instrument has it, computed once per tune
 * into a few short recordings (a soft and a hard stroke, and two of each so no two strokes
 * are alike) that every hit then plays back. A hit costs one buffer, where a Web Audio
 * voice built from oscillators and filters cost ten or fifteen nodes and could not come
 * close to a cymbal's sound.
 *
 * Every piece is measured against a recorded acoustic kit (one-shots of each piece and
 * stroke, studied for their numbers only; no recording is in this repository): the level of
 * each octave band over the first 20 ms, to 100 ms, to half a second and to two seconds, the
 * time each band takes to fall 20 and 40 dB, the modes of each drum and how long each rings,
 * and how many separate lines a cymbal's spectrum holds.
 *
 * - A cymbal (ride, crash, splash, china, the hats) is a few hundred inharmonic partials,
 *   each a damped ring at its own frequency, about as many in every kilohertz from a few
 *   hundred hertz to the top of hearing (a recorded ride and crash show 25 to 30 separate
 *   lines per kilohertz). Their lives spread widely, so the sound falls fast for its first
 *   few tenths of a second and then rings on. A ride and a crash are loudest at the stick,
 *   with no bloom; a hat's two plates clash and rattle, so a hat grows for its first tens of
 *   milliseconds, and a closed hat's ring is choked almost at once.
 * - A drumhead (snare, toms, bass drum) rings at its modes. The membrane's ratios are the
 *   zeros of the Bessel functions (1, 1.59, 2.14, 2.30, 2.65, 2.92 ...), and a real drum's
 *   modes move off them where the air inside and the other head pull them. Struck harder,
 *   the head's tension rises, so its pitch starts sharp and settles. A snare's wires buzz
 *   against the bottom head and drain its fundamental fast.
 * - Struck harder is brighter: more of the high partials and modes, and more stick.
 *
 * Each recording is brought to the same peak: it carries the stroke's tone, and the player
 * sets its loudness from the velocity.
 *
 * Pure: no DOM and no Web Audio; the shells wrap the samples into buffers. Deterministic:
 * every random choice comes from the seeded source handed in, so a tune's kit is the same
 * on every render. The cost is a few tens of milliseconds per piece, paid once per tune.
 */

/** A seeded random source in 0..1. */
export type Rand = () => number;

/** One damped partial: frequency (Hz), level, the time it takes to fall by e (s), how long its energy takes to arrive (s), and its starting phase if it is not drawn. */
export interface Partial { f: number; a: number; tau: number; bloom: number; phase?: number }

/** A normally distributed draw from a seeded source (mean 0, deviation 1), cut at 3. */
function gauss(rand: Rand): number {
  const v = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  return Math.max(-3, Math.min(3, v));
}

/** One partial ready to run: the recursion's two constants, its first two values and how many samples it lasts. */
interface Running { c: number; r2: number; y1: number; y2: number; len: number }

/**
 * Add `partials` into `out` (from sample `at`), each a damped sine with its own phase,
 * worked out until it is `floor` under the strongest partial's start (so a quiet, short
 * partial costs little). A damped sine is a recursion, y[n] = 2r cos(w) y[n-1] - r^2 y[n-2];
 * partials of about the same length run four at a time, so the output is read and written
 * once for every four of them.
 */
function ring(out: Float32Array, sr: number, partials: readonly Partial[], rand: Rand, at = 0, floor = 1e-3): void {
  let top = 0;
  for (const p of partials) top = Math.max(top, p.a);
  const least = top * floor;
  const run: Running[] = [];
  for (const p of partials) {
    if (p.f >= sr * 0.48 || p.a <= least) continue;
    const len = Math.min(out.length - at, Math.ceil(Math.max(p.bloom * 4, p.tau * Math.log(p.a / least)) * sr));
    const w = (2 * Math.PI * p.f) / sr;
    const r = Math.exp(-1 / (p.tau * sr));
    const drawn = rand() * Math.PI * 2;
    const phase = p.phase ?? drawn;
    if (p.bloom > 0) { bloomRing(out, at, len, w, r, p.a, phase, Math.exp(-1 / (p.bloom * sr))); continue; }
    run.push({ c: 2 * r * Math.cos(w), r2: r * r, y1: p.a * Math.sin(phase), y2: (p.a * Math.sin(phase - w)) / r, len });
  }
  run.sort((x, y) => y.len - x.len);
  let i = 0;
  for (; i + 3 < run.length; i += 4) {
    const a = run[i]!, b = run[i + 1]!, c = run[i + 2]!, d = run[i + 3]!;
    // Together for as long as the shortest of the four, then each alone.
    let a1 = a.y1, a2 = a.y2, b1 = b.y1, b2 = b.y2, c1 = c.y1, c2 = c.y2, d1 = d.y1, d2 = d.y2;
    for (let n = 0; n < d.len; n++) {
      const ya = a.c * a1 - a.r2 * a2, yb = b.c * b1 - b.r2 * b2, yc = c.c * c1 - c.r2 * c2, yd = d.c * d1 - d.r2 * d2;
      out[at + n] = out[at + n]! + a1 + b1 + c1 + d1;
      a2 = a1; a1 = ya; b2 = b1; b1 = yb; c2 = c1; c1 = yc; d2 = d1; d1 = yd;
    }
    for (const [p, y1, y2] of [[a, a1, a2], [b, b1, b2], [c, c1, c2]] as const) tail(out, at, d.len, p.len, p.c, p.r2, y1, y2);
  }
  for (; i < run.length; i++) tail(out, at, 0, run[i]!.len, run[i]!.c, run[i]!.r2, run[i]!.y1, run[i]!.y2);
}

/** One partial's recursion from sample `from` to `to`, its last two values `y1` and `y2`. */
function tail(out: Float32Array, at: number, from: number, to: number, c: number, r2: number, y1: number, y2: number): void {
  for (let n = from; n < to; n++) {
    const y = c * y1 - r2 * y2;
    out[at + n] = out[at + n]! + y1;
    y2 = y1;
    y1 = y;
  }
}

/** A partial whose energy arrives over a while (`grow` per sample): the hats' plates clashing. */
function bloomRing(out: Float32Array, at: number, len: number, w: number, r: number, a: number, phase: number, grow: number): void {
  const c = 2 * r * Math.cos(w), r2 = r * r;
  let y1 = a * Math.sin(phase), y2 = (a * Math.sin(phase - w)) / r, g = 1;
  for (let n = 0; n < len; n++) {
    const y = c * y1 - r2 * y2;
    out[at + n] = out[at + n]! + y1 * (1 - g);
    y2 = y1;
    y1 = y;
    g *= grow;
  }
}

/** White noise through a two-pole band-pass at `hz`, under an envelope rising in `attack` and falling by e in `tau`. */
function noiseBand(out: Float32Array, sr: number, rand: Rand, hz: number, q: number, level: number, attack: number, tau: number, at = 0): void {
  const len = Math.min(out.length - at, Math.ceil((attack + tau * 6) * sr));
  const w = (2 * Math.PI * Math.min(hz, sr * 0.45)) / sr;
  const alpha = Math.sin(w) / (2 * q);
  const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const up = Math.max(1, attack * sr);
  const fall = Math.exp(-1 / (tau * sr));
  let env = 1;
  for (let n = 0; n < len; n++) {
    const x = rand() * 2 - 1;
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    if (n >= up) env *= fall;
    const e = n < up ? n / up : env;
    out[at + n] = (out[at + n] ?? 0) + y * level * e;
  }
}

/** Normalise to a peak of `to`. */
function normalise(x: Float32Array, to: number): Float32Array {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / peak) * to;
  return x;
}

// ── cymbals ───────────────────────────────────────────────────────────────────

/** The octave bands a cymbal is described in (centres, Hz). */
export const OCTAVES = [125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

/** A value at `f` Hz from one value per octave (OCTAVES), straight between them in log-frequency and held beyond. */
function perOctave(values: readonly number[], f: number): number {
  const x = Math.log2(f / OCTAVES[0]);
  const i = Math.max(0, Math.min(values.length - 2, Math.floor(x)));
  const u = Math.max(0, Math.min(1, x - i));
  return values[i]! + (values[i + 1]! - values[i]!) * u;
}

export interface CymbalSpec {
  /** The struck sound, one value per octave band (OCTAVES): its level (dB) at a medium stroke. */
  level: readonly number[];
  /** And how long the band's partials ring: the middle of their lives (s, the time to fall by e). */
  life: readonly number[];
  /** How widely the partials' lives spread, as a deviation in log: a wide spread falls fast and then rings on. */
  spread: number;
  /** Partials per kilohertz (the top octave has a third as many). */
  density: number;
  /** How unevenly they are struck (LINES unless given): a closed hat's are more even. */
  lines?: number;
  /** All the cymbal's frequencies scaled: a smaller or thinner cymbal rings higher. */
  scale?: number;
  /** All the lives scaled: a cymbal's wash lasting longer or shorter. */
  lives?: number;
  /** How long the partials take to reach full strength (s): 0 for a stick on a ride, tens of ms for hats' plates clashing. */
  bloom: number;
  /** The plates' rattle (hats) or the metal's trash (china): noise against the partials' energy (0 none, 1 as strong). */
  rattle: number;
  /** A choke (hats): the whole ring cut off by e in this long (s). */
  choke?: number;
  /** The stick's tick: its centre (Hz), and how far it stands over the ring's start (dB): a stick on a ride or a crash is a spike 15 dB over the ring for a few milliseconds. */
  tick: number; tickLevel: number;
  /** The bell, for a ride: its loudest partial (Hz; the others are BELL's ratios to it), and how strongly a stroke sets it going (0 to 1: a stroke on the bow barely does, one on the bell fully). */
  bell?: number; bellLevel?: number;
  /** Seconds to render. */
  seconds: number;
}

/*
 * The cymbals as measured. Levels are each octave band's energy over the 20 to 100 ms after
 * the stroke, against the whole stroke's; lives were fitted until the rendered bands fall
 * 20 and 40 dB when the recordings' do. A recorded ride falls 20 dB in about 0.4 s at 4 and
 * 8 kHz and 40 dB in 1.3 to 1.6 s, its bands under 2 kHz ringing three to four times as
 * long; a crash is the same shape with more of its low partials (one near 380 Hz rings for
 * seconds). The splash and the china have no recording here: they are the crash made
 * smaller (higher and shorter) and trashier (lower, with the rattle of a turned-up edge).
 */
export const RIDE: CymbalSpec = { level: [-52, -40, -40, -27.5, -33, -10, -8.3, -21], life: [0.8, 0.8, 0.9, 0.8, 0.5, 0.28, 0.24, 0.1], spread: 0.45, density: 26, bloom: 0, rattle: 0, tick: 6000, tickLevel: 19.5, bell: 2795, bellLevel: 0.1, seconds: 2.4 };
export const CRASH: CymbalSpec = { level: [-44, -38.6, -21, -41, -26.5, -13.4, -7.8, -41], life: [0.9, 0.9, 0.6, 1.0, 0.85, 0.28, 0.22, 0.17], spread: 0.45, density: 28, bloom: 0, rattle: 0, tick: 6000, tickLevel: 18, seconds: 2.6 };
export const SPLASH: CymbalSpec = { ...CRASH, scale: 1.35, lives: 0.45, seconds: 1.2 };
export const CHINA: CymbalSpec = { ...CRASH, level: [-40, -30, -16, -24, -15, -10, -9, -26], scale: 0.8, lives: 0.8, rattle: 0.35, seconds: 2.2 };
export const HAT_CLOSED: CymbalSpec = { level: [-24, -19, -22, -30.1, -40, -8, -6.1, -37], life: [0.12, 0.12, 0.1, 0.07, 0.06, 0.06, 0.055, 0.05], spread: 0.4, density: 6, lines: 0.5, bloom: 0.008, rattle: 1.6, choke: 0.055, tick: 0, tickLevel: 0, seconds: 0.3 };
export const HAT_OPEN: CymbalSpec = { level: [-44, -38.3, -19.3, -23.8, -21.9, -10.1, -9.4, -30], life: [1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.1, 1.0], spread: 0.3, density: 18, lines: 0.9, bloom: 0.012, rattle: 0.35, choke: 0.5, tick: 0, tickLevel: 0, seconds: 1.4 };

/**
 * How unevenly a cymbal's partials are struck: each partial's level is drawn log-normally
 * with this deviation, so a few lines stand 25 to 30 dB over the spectrum's median, as a
 * recorded ride's and crash's do.
 */
const LINES = 1.1;

/** A cymbal's fixed partials, from its own seed: the same cymbal for every stroke. */
export function cymbalBase(spec: CymbalSpec, rand: Rand): Partial[] {
  const out: Partial[] = [];
  const scale = spec.scale ?? 1;
  const lives = spec.lives ?? 1;
  const lines = spec.lines ?? LINES;
  // A jittered grid: one partial in each step of the spectrum, wherever in it it falls, the
  // top octave in steps three times as wide. Each partial's share of its octave's energy is set
  // so the octave's level holds whatever the density, and the octave is brought to that
  // level after the draw, so a band of a few partials is not left loud or quiet by chance.
  const step = 1000 / spec.density;
  const want = OCTAVES.map(() => 0), got = OCTAVES.map(() => 0);
  const band = (f: number): number => Math.max(0, Math.min(OCTAVES.length - 1, Math.round(Math.log2(f / OCTAVES[0]))));
  for (let lo = 90; lo < 17500;) {
    const wide = lo >= 8000 ? 3 : 1;
    const at = lo + step * wide * rand();
    lo += step * wide;
    const even = 10 ** (perOctave(spec.level, at) / 20) * Math.sqrt((step * wide) / (Math.SQRT1_2 * at));   // an octave centred on f is f / sqrt(2) wide
    const a = even * Math.exp(lines * gauss(rand) - lines * lines);
    want[band(at)]! += even * even;
    got[band(at)]! += a * a;
    out.push({ f: at * scale, a, tau: perOctave(spec.life, at) * lives * Math.exp(spec.spread * gauss(rand)), bloom: spec.bloom });
  }
  for (const p of out) {
    const b = band(p.f / scale);
    p.a *= Math.sqrt(want[b]! / Math.max(1e-30, got[b]!));
  }
  return out;
}

/** How a stroke of `vel` lights a partial at `f` against a medium one: a soft stroke reaches fewer of the high ones. */
function brightness(f: number, vel: number): number {
  return Math.exp(-f / (2500 + 14000 * vel * vel) + f / (2500 + 14000 * 0.65 * 0.65));
}

/** One cymbal stroke: `vel` 0..1 (soft strokes darker), the cymbal's own partials (`base`) so every stroke is the same cymbal. */
export function cymbal(sr: number, spec: CymbalSpec, base: readonly Partial[], vel: number, rand: Rand, hq = false): Float32Array {
  const out = new Float32Array(Math.ceil(spec.seconds * (spec.lives ?? 1) ** 0.5 * sr));
  const onBell = (spec.bellLevel ?? 0) >= 0.5;
  // A stroke on the bell moves the bow's partials less, and its highest hardly at all.
  const bow = (f: number): number => (onBell ? 0.6 * Math.exp(-Math.max(0, f - 8000) / 2500) : 1);
  const struck = base.map(p => ({ ...p, a: p.a * bow(p.f) * brightness(p.f, vel) * (0.85 + rand() * 0.3) }));
  // The partials' combined start, which the stick, the rattle and the bell are set against.
  const energy = Math.sqrt(base.reduce((s, p) => s + p.a * p.a * brightness(p.f, vel) ** 2, 0) / 2);
  const bellAt = spec.bell && spec.bellLevel ? spec.bellLevel * energy * 0.55 : 0;
  if (bellAt) struck.push(...bellPartials(spec.bell! * (spec.scale ?? 1), bellAt, rand));
  ring(out, sr, struck, rand, 0, hq ? 3e-4 : 1e-3);
  if (bellAt) heldRing(out, sr, spec.bell! * (spec.scale ?? 1), bellAt, rand);
  if (spec.rattle > 0) washBank(out, sr, rand, spec, vel, spec.rattle * energy, hq ? WASH_BANDS_HQ : WASH_BANDS);
  // The stick: a narrow band of noise (it passes about a seventh of white noise's RMS, so
  // its level is set from that), darkened above 10 kHz, as a stick's ping on a cymbal is.
  if (spec.tick) thud(out, sr, rand, [[spec.tick * (spec.scale ?? 1), 3.5, 10 ** (spec.tickLevel / 20) * energy / 0.14 * (0.4 + 0.6 * vel), 0.0002, 0.0015]], 10000, 0.02);
  if (spec.choke) {
    const k = Math.exp(-1 / (spec.choke * sr));
    let e = 1;
    for (let i = 0; i < out.length; i++) { out[i] = out[i]! * e; e *= k; }
  }
  // The recording ends in a fade over its last seventh, so a long ring is never cut off.
  const fadeFrom = Math.floor(out.length * 0.86);
  for (let i = fadeFrom; i < out.length; i++) out[i] = out[i]! * ((out.length - i) / (out.length - fadeFrom));
  return normalise(out, 0.9);
}

/**
 * A ride's bell, as recorded: its partials as ratios to the loudest (2.8 kHz on the recorded
 * ride), their levels (dB) and the time each takes to fall 60 dB (s). The loudest holds its
 * level for a quarter of a second and then falls away fast (BELL_HOLD), which is the bell's
 * "ding", rung separately by heldRing.
 */
const BELL: ReadonlyArray<readonly [number, number, number]> = [[1.307, -8, 1.3], [1.4, -3.5, 1.2], [1.635, -2, 0.9], [0.642, -16, 3.5], [0.872, -19, 4], [1.48, -18, 2.2], [0.314, -18, 3]];

/** The bell's loudest partial, as recorded: how long it holds its level (s), how fast it then falls (s, by e), and what is left after (dB, and its life in s). */
const BELL_HOLD = 0.27, BELL_FALL = 0.11, BELL_LEFT = -32, BELL_LEFT_LIFE = 1;

/** The bell's partials other than its loudest at `f`, `level` high. */
function bellPartials(f: number, level: number, rand: Rand): Partial[] {
  return BELL.map(([ratio, db, t60]) => ({ f: f * ratio * (1 + (rand() - 0.5) * 0.002), a: level * 10 ** (db / 20), tau: t60 / 6.91, bloom: 0 }));
}

/** The bell's loudest partial at `f`, `level` high: level for BELL_HOLD, then falling by e in BELL_FALL, over a quiet remainder. */
function heldRing(out: Float32Array, sr: number, f: number, level: number, rand: Rand): void {
  const w = (2 * Math.PI * f) / sr;
  const hold = Math.round(BELL_HOLD * sr), fall = Math.exp(-1 / (BELL_FALL * sr)), left = Math.exp(-1 / (BELL_LEFT_LIFE * sr));
  const rest = 10 ** (BELL_LEFT / 20);
  let phase = rand() * Math.PI * 2, env = 1, under = rest;
  for (let n = 0; n < out.length; n++) {
    out[n] = out[n]! + level * (env + under) * Math.sin(phase);
    phase += w;
    if (n >= hold) env *= fall;
    under *= left;
  }
}

/**
 * A stroke on the ride's bell (its cup): the stick on thick metal near the middle, so the
 * bell rings out over the bow, the bow's own partials 8 to 15 dB under it, and the ping is
 * harder. As recorded: 20 dB down in a third of a second, 40 dB in just over one.
 */
export function rideBell(sr: number, spec: CymbalSpec, base: readonly Partial[], vel: number, rand: Rand, hq = false): Float32Array {
  return cymbal(sr, { ...spec, bellLevel: 1, tickLevel: spec.tickLevel - 4 }, base, vel, rand, hq);
}

/** How many narrow bands of noise make a hat's rattle. */
const WASH_BANDS = 16;
/** And in a render worked out ahead of playing, where time is not short: denser still. */
const WASH_BANDS_HQ = 32;

/**
 * The plates' rattle as clusters of noise: white noise through `count` resonant band-passes
 * placed as the partials are (louder where the cymbal is), each under its own envelope
 * rising over the cymbal's bloom, the whole at `level` in RMS. A soft stroke reaches fewer
 * of the high clusters.
 */
function washBank(out: Float32Array, sr: number, rand: Rand, spec: CymbalSpec, vel: number, level: number, count: number): void {
  const n = out.length;
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rand() * 2 - 1;
  const scale = spec.scale ?? 1;
  const bands: Array<{ f: number; q: number; a: number; tau: number }> = [];
  let total = 0;
  for (let b = 0; b < count; b++) {
    const f = 300 * (16000 / 300) ** ((b + rand()) / count);
    const a = 10 ** (perOctave(spec.level, f) / 20) * Math.sqrt(f / 1000) * brightness(f, vel) * (0.6 + rand() * 0.4);
    const tau = Math.min(spec.choke ?? Infinity, perOctave(spec.life, f) * (spec.lives ?? 1) * (0.7 + rand() * 0.6));
    bands.push({ f: Math.min(sr * 0.45, f * scale), q: 3 + rand() * 4, a, tau });
    total += a * a;
  }
  // A band of white noise at Q passes about sqrt(pi f / (2 Q sr)) of its RMS; scale each so the bank's RMS is `level`.
  const norm = level / Math.sqrt(Math.max(1e-9, total));
  const attack = Math.max(1, (spec.bloom * 2 + 0.001) * sr);
  for (const { f, q, a, tau } of bands) {
    const w = (2 * Math.PI * f) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha;
    const gain = (a * norm) / Math.sqrt((Math.PI * f) / (2 * q * sr) + 1e-9) / Math.sqrt(3) * 1.7;
    const fall = Math.exp(-1 / (tau * sr));
    const len = Math.min(n, Math.ceil((tau * 7 + attack / sr) * sr));
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, env = 1;
    for (let i = 0; i < len; i++) {
      const x = noise[i]!;
      const y = (alpha * x - alpha * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      if (i >= attack) env *= fall;
      out[i] = out[i]! + y * gain * (i < attack ? i / attack : env);
    }
  }
}

// ── drumheads ─────────────────────────────────────────────────────────────────

/**
 * Add one of a head's modes into `out`: a sine at `f` (Hz) starting from rest, `level`
 * high, falling by e in `tau` (s), its first `fast` share falling by e in `fastTau` (s)
 * instead. Its pitch starts `glide` sharp (a share: 0.4 is 40 per cent) and settles by e in
 * `settle` (s). It swells in over `rise` (s): the stick's contact for the batter head,
 * longer for the resonant head, which the air inside sets going. The phase turns at the
 * pitch of the moment, worked out once every 16 samples (the pitch moves far more slowly)
 * as a rotating phasor, so there is no sine to work out for every sample.
 */
function headMode(out: Float32Array, sr: number, f: number, level: number, tau: number, glide: number, settle: number, rise: number, fast = 0, fastTau = 1): void {
  const size = Math.abs(level);
  if (f * (1 + glide) >= sr * 0.45 || size < 0.003) return;
  // Rendered until it is 74 dB under the fundamental's start (a level of 1), and no longer.
  const slowFor = size * (1 - fast) > 2e-4 ? tau * Math.log((size * (1 - fast)) / 2e-4) : 0;
  const fastFor = size * fast > 2e-4 ? fastTau * Math.log((size * fast) / 2e-4) : 0;
  const len = Math.min(out.length, Math.ceil(Math.max(slowFor, fastFor, rise) * sr));
  const fall = Math.exp(-1 / (tau * sr));
  const fastFall = Math.exp(-1 / (fastTau * sr));
  const up = Math.max(1, rise * sr);
  let slowEnv = level * (1 - fast), fastEnv = level * fast;
  let re = 1, im = 0;
  for (let b = 0; b < len; b += 16) {
    const step = (2 * Math.PI * f * (1 + glide * Math.exp(-(b + 8) / sr / settle))) / sr;
    const c = Math.cos(step), s = Math.sin(step);
    const end = Math.min(len, b + 16);
    for (let n = b; n < end; n++) {
      const swell = n < up ? 0.5 - 0.5 * Math.cos((Math.PI * n) / up) : 1;
      out[n] = out[n]! + (slowEnv + fastEnv) * swell * im;
      const turned = re * c - im * s;
      im = re * s + im * c;
      re = turned;
      slowEnv *= fall;
      fastEnv *= fastFall;
    }
    const norm = 1 / Math.hypot(re, im);
    re *= norm;
    im *= norm;
  }
}

/**
 * How strongly a stick's push, on the head for `contact` seconds, sets going a mode at `f`
 * Hz: the spectrum of a half-sine push, about even up to 1 / (2 * contact) and falling as
 * the square of the frequency above, smoothed over its notches. A hard stroke's short
 * contact reaches far up the head's modes; a soft one's long contact does not.
 */
function pushAt(f: number, contact: number): number {
  const u = 2 * f * contact;
  return 1 / Math.sqrt(1 + 0.45 * u ** 4);
}

/** Noise, shaped by `shape` (band-passes: centre Hz, Q, level, rise s, fall s), then darkened above `dark` Hz by two one-poles (and, given `light`, thinned below it by two more), added into `out`. */
function thud(out: Float32Array, sr: number, rand: Rand, shape: ReadonlyArray<readonly [number, number, number, number, number]>, dark: number, len: number, light = 0): void {
  const buf = new Float32Array(Math.min(out.length, Math.ceil(len * sr)));
  for (const [hz, q, level, rise, fall] of shape) noiseBand(buf, sr, rand, hz, q, level, rise, fall);
  const k = 1 - Math.exp((-2 * Math.PI * dark) / sr);
  const h = light > 0 ? Math.exp((-2 * Math.PI * light) / sr) : 0;
  let lp1 = 0, lp2 = 0, hp1 = 0, hp2 = 0, x1 = 0, x2 = 0;
  for (let n = 0; n < buf.length; n++) {
    lp1 += k * (buf[n]! - lp1);
    lp2 += k * (lp1 - lp2);
    if (light > 0) {
      hp1 = h * (hp1 + lp2 - x1); x1 = lp2;
      hp2 = h * (hp2 + hp1 - x2); x2 = hp1;
      out[n] = out[n]! + hp2;
    } else out[n] = out[n]! + lp2;
  }
}

/**
 * A snare stroke on a head tuned to `f0`, as a recorded snare rings:
 * - The batter head's fundamental is the loudest thing for 20 ms and gone 30 dB by 60 ms:
 *   it moves the air in the shell, the air moves the snare head, and the wires slapping the
 *   snare head drain the fundamental. The (1,1) mode, with a line through the middle that pushes no
 *   air, is the ring that lasts: it starts 14 dB down and falls 60 dB in about 0.4 s, at
 *   about 1.52 times the fundamental (the air pulls it under the ideal 1.59). The modes
 *   above (2.18, 2.91, 3.6 and 4.5 times) start 16 to 25 dB down and are gone in 0.2 s.
 * - The wires: a band of buzz centred near 6 kHz, rising for 20 ms after the hit (they
 *   take a moment to start slapping), 20 dB down in about 90 ms and 40 dB in 160 ms;
 *   about 19 dB under the head over the first 20 ms and 11 dB under it to 100 ms.
 * - The stick on the head: a short crack, darker than a cymbal's.
 * `wires` and `ring` are the kit's leans (about 1): more or less wire, a longer or shorter ring.
 */
export function snareStroke(sr: number, f0: number, vel: number, wires: number, ring: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.ceil(0.5 * sr));
  const hard = vel * vel;
  const contact = 0.0016 - 0.0009 * vel;
  const glide = 0.025 * hard;
  // The batter head: the fundamental, drained by the wires, and the higher modes.
  headMode(out, sr, f0, 1, 0.016 * ring, glide, 0.02, 0.004);
  for (const [ratio, db, t60] of SNARE_MODES) {
    const level = 10 ** (db / 20) * (0.8 + rand() * 0.4) * pushAt(f0 * ratio, contact) / pushAt(f0, contact);
    headMode(out, sr, f0 * ratio * (1 + (rand() - 0.5) * 0.01), level, (t60 / 6.91) * ring * (0.9 + rand() * 0.2), glide, 0.02, ratio < 2 ? 0.004 : contact);
  }
  // The snare head under it, a little lower, ringing quietly on.
  headMode(out, sr, f0 * 0.94, 0.03, 0.06 * ring, 0, 1, 0.004);
  // The wires, starting a moment after the hit, louder the harder; and the stick.
  const buzz = wires * (0.25 + 0.75 * vel ** 1.5);
  thud(out, sr, rand, [
    [6000, 0.7, 0.28 * buzz, 0.012, 0.034 * (0.7 + 0.3 * wires)],
    [3000, 0.9, 0.11 * buzz, 0.008, 0.025],
  ], 9000, 0.4, 1500);
  // The stick, and the head's countless higher modes heard as a short burst around 1 kHz.
  thud(out, sr, rand, [[2000 + 1500 * vel, 0.9, 0.5 * hard, 0.0003, 0.0025], [1200, 0.7, 0.2 * vel, 0.001, 0.025]], 9000, 0.12);
  return normalise(out, 0.95);
}

/** A snare's head modes above the fundamental, as recorded: ratio, level (dB under the fundamental's start) and the time to fall 60 dB (s). */
const SNARE_MODES: ReadonlyArray<readonly [number, number, number]> = [[1.52, -14, 0.36], [2.18, -16.5, 0.18], [2.91, -18.5, 0.17], [3.62, -20.5, 0.17], [4.48, -24.5, 0.1], [1.33, -28, 0.22]];

/**
 * A tom's measured character (the FW kit's recorded toms, against the model rendered at their
 * tunings: high 129 Hz, mid 98 Hz, floor 70 Hz). Times are T60s (s, 60 dB down); levels are
 * against the fundamental's at the strike.
 * - t60, t60Low: the fundamental's ring, longer by t60Low a hertz under 130 Hz (recorded
 *   0.8 to 1.6 s; the old model rang 2.5 s).
 * - glide, glideExp, settle: how far sharp a stroke starts (glide times vel to glideExp: a
 *   medium stroke 12 per cent, as recorded, a hard one about 30) and how fast it settles (s).
 * - swell, bigSwell: how long the fundamental takes to swell in, longer on a bigger drum.
 * - second, secondRatio, secondT60: the mode near twice the fundamental on a rack tom;
 *   bigSecond, bigSecondT60 the same on a bigger one, where it leads the strike.
 * - cluster, clusterT60: a bigger tom's modes at 2.25 and 2.43 times; long18, long18T60 its
 *   quiet, long mode at 1.81 times; mids, midsT60 its modes at 2.65, 3.0 and 3.6 times.
 * - floorFund, floor15, floor15T60, floorThud: a floor tom's weaker fundamental, its long
 *   mode at 1.53 times, and its brighter strike.
 * - third, thirdT60, highs, highT60: the mode near 2.85 times, and the shell's and head's
 *   higher modes (TOM_HIGH).
 * - reso: the resonant head's fundamental, faintly; thud and bigThud: the strike's noise;
 *   wires, wiresFall: the snare's wires and the shell answering in sympathy.
 */
const TOM = { floorFund: 0.7, floor15: 0.35, floor15T60: 2.5, floorThud: 1.5, swell: 0.004, bigSwell: 0.008, mids: 0.12, midsT60: 0.45, bigSecond: 1.1, bigSecondT60: 0.3, cluster: 0.5, clusterT60: 0.42, long18: 0.2, long18T60: 2.5, bigThud: 1, t60: 1.35, t60Low: 0.004, glide: 0.32, glideExp: 1.6, settle: 0.08, second: 0.2, secondRatio: 2.08, secondT60: 0.9, third: 0.056, thirdT60: 0.66, highs: 0.06, highT60: 0.6, reso: 0.06, thud: 0.5, wires: 0.04, wiresFall: 0.25 } as const;

/** A tom's shell and head modes high above the fundamental, as ratios to it: heard faintly and briefly after the strike. */
const TOM_HIGH = [4.6, 5.5, 5.8, 6.6, 7.2] as const;

/**
 * A tom stroke at `f0`, measured against two acoustic kits' recorded toms (the FW kit's high,
 * mid and floor toms at 129, 98 and 105 Hz; earlier the Muldjord kit's four, 62 to 116 Hz).
 * - The pitch: struck harder, the head swings further and its tension, and so every mode's
 *   pitch, rises: a medium stroke starts about 12 per cent sharp (the FW toms: 146 to 129 Hz,
 *   113 to 98 Hz), a hard one up to 25 to 40, a soft one a few, and comes down over about a
 *   tenth of a second. That falling "doom" is most of what makes a tom sound like one.
 * - The ring: the fundamental is 60 dB down in 0.8 to 1.6 s (the FW toms; a lower tom a
 *   little longer). The resonant head underneath rings its own fundamental faintly.
 * - One upper mode stands out: near twice the fundamental (2.0 on the FW high tom, 2.2 on
 *   the mid), 13 to 16 dB under it at the strike and 60 dB down in 0.7 to 0.95 s. A mode near
 *   2.85 sits 25 dB down; the shell's and head's higher modes (4.6 to 7.2 times) 17 to 30 dB
 *   down, gone in about half a second.
 * - The attack: the stick's push, a short thud of the head's countless higher modes, and the
 *   stick's click; then the snare's wires and the shell answer in sympathy, a faint top end
 *   that lasts a quarter of a second (the recorded toms keep 1 to 8 kHz well into their ring).
 */
export function tomStroke(sr: number, f0: number, vel: number, rand: Rand): Float32Array {
  const t60 = TOM.t60 + Math.max(0, 130 - f0) * TOM.t60Low;
  const tau = t60 / 6.91;
  const out = new Float32Array(Math.ceil(Math.min(2.5, t60 * 1.2) * sr));
  const contact = 0.002 - 0.0013 * vel;
  const glide = TOM.glide * vel ** TOM.glideExp;
  const settle = TOM.settle + Math.max(0, 110 - f0) * 0.0006;
  // How big the drum is, from its tuning: 0 for a rack tom near 130 Hz, 1 for a bigger one
  // near 100 Hz and below. A bigger drum struck throws much more of its energy into the modes
  // near twice the fundamental (the recorded mid tom's mode at 2.0 times is 11 dB OVER its
  // fundamental at 30 ms, gone in a quarter of a second; the high tom's 13 dB under it), and
  // its fundamental takes longer to swell in, moving the air inside.
  const big = Math.max(0, Math.min(1, (130 - f0) / 30));
  const lerp = (a: number, b: number): number => a + (b - a) * big;
  // A floor tom (100 Hz down to 70): its fundamental is weak where the stick's side hears it
  // (the recorded floor tom's, at 69 Hz, is 27 dB under its loudest mode at 30 ms); a mode
  // at 1.53 times rings longest, and the strike is brighter.
  const floor = Math.max(0, Math.min(1, (100 - f0) / 30));
  // The batter head's fundamental, swelling in over a few milliseconds, and the resonant head underneath, faintly.
  headMode(out, sr, f0, 1 - TOM.floorFund * floor, tau, glide, settle, TOM.swell + big * TOM.bigSwell, 0.35, 0.05);
  if (floor > 0) headMode(out, sr, f0 * 1.53, floor * TOM.floor15, TOM.floor15T60 / 6.91, glide * 0.5, settle, TOM.swell + big * TOM.bigSwell);
  headMode(out, sr, f0 * (1.2 + rand() * 0.14), TOM.reso * (0.7 + rand() * 0.6), tau * 0.8, glide * 0.35, settle, 0.006);
  // The mode that stands out, near twice the fundamental, and a weaker one near 2.85.
  const second = f0 * (TOM.secondRatio + (rand() - 0.5) * 0.16);
  headMode(out, sr, second, lerp(TOM.second, TOM.bigSecond) * (0.8 + rand() * 0.4) * pushAt(second, contact) / pushAt(f0, contact), lerp(TOM.secondT60, TOM.bigSecondT60) / 6.91, glide, settle, contact);
  // A bigger tom's cluster around it (2.25 and 2.43 times, short) and a quiet mode at 1.8 times that rings long.
  if (big > 0) {
    for (const [ratio, share] of [[2.25, 1], [2.43, 0.9]] as const) headMode(out, sr, f0 * ratio * (1 + (rand() - 0.5) * 0.02), big * TOM.cluster * share * pushAt(f0 * ratio, contact) / pushAt(f0, contact), (TOM.clusterT60 / 6.91) * (1 + floor * 0.8) * (0.8 + rand() * 0.4), glide, settle, contact);
    headMode(out, sr, f0 * 1.81, big * TOM.long18, TOM.long18T60 / 6.91, glide * 0.5, settle, contact);
    for (const ratio of [2.65, 3.0, 3.6]) headMode(out, sr, f0 * ratio * (1 + (rand() - 0.5) * 0.02), big * TOM.mids * (0.6 + rand() * 0.8) * pushAt(f0 * ratio, contact) / pushAt(f0, contact), (TOM.midsT60 / 6.91) * (1 + floor * 0.8) * (0.8 + rand() * 0.4), glide, settle, contact);
  }
  headMode(out, sr, f0 * (2.85 + (rand() - 0.5) * 0.1), TOM.third * pushAt(f0 * 2.85, contact) / pushAt(f0, contact), TOM.thirdT60 / 6.91, glide, settle, contact);
  // The higher modes of the shell and the head, faint and soon gone.
  for (const ratio of TOM_HIGH) {
    const f = f0 * ratio * (1 + (rand() - 0.5) * 0.02);
    headMode(out, sr, f, TOM.highs * (0.5 + rand()) * pushAt(f, contact) / pushAt(f0, contact), (TOM.highT60 / 6.91) * (0.7 + rand() * 0.6), glide * 0.5, settle, contact);
  }
  // The head's countless higher modes as a short thud, and the stick's click, darker above
  // 5 kHz as the head and the stick are (a bigger tom's darker still).
  const size = Math.min(1.3, Math.max(0.6, Math.sqrt(f0 / 110)));
  thud(out, sr, rand, [
    [700, 0.5, 1.5 * TOM.thud * vel * pushAt(700, contact), contact, 0.03],
    [1800, 0.7, 2.3 * TOM.thud * (1 + big * TOM.bigThud + floor * TOM.floorThud) * vel * size, contact, 0.022],
    [3300, 1.2, 0.8 * (1 + big * TOM.bigThud + floor * TOM.floorThud) * vel * size, contact, 0.012],
    [3000 + 1000 * vel, 1.4, 2.2 * vel ** 1.2 * size, 0.0002, 0.0018],
  ], 5000, 0.25);
  // The snare's wires and the shell answering: a faint top end through the first quarter second.
  thud(out, sr, rand, [[5200, 0.6, TOM.wires * vel, 0.004, TOM.wiresFall], [2400, 0.8, TOM.wires * 0.6 * vel, 0.004, TOM.wiresFall * 0.8]], 9000, Math.min(out.length / sr, TOM.wiresFall * 5), 800);
  return normalise(out, 0.9);
}

/**
 * A bass drum stroke at `f0`, as a recorded kick rings: its fundamental, a small fall in
 * pitch with the strike, and a cluster of modes from twice to nearly four times the
 * fundamental (the two heads and the air between them), the one near 2.2 times the
 * loudest thing for the first 30 ms and then falling back. Every mode is 60 dB down in
 * about half a second, scaled by `life` (the tune's kick length, about 0.39 s as recorded).
 * Over it, the beater's click (`click` 0 for a felt beater played softly, 1 for a hard one)
 * and the shell's thump.
 */
export function kickStroke(sr: number, f0: number, vel: number, click: number, life: number, rand: Rand): Float32Array {
  const lives = life / 0.39;
  const out = new Float32Array(Math.ceil((0.55 * lives + 0.1) * sr));
  const glide = 0.5 * vel ** 1.5;
  const settle = 0.03;
  // A beater stays on the head longer than a stick: 3 to 5 ms.
  const contact = 0.006 - 0.003 * vel;
  for (const [ratio, level, t60, fast, fastT60] of KICK_MODES) {
    const lv = level * (0.85 + rand() * 0.3) * pushAt(f0 * ratio, contact) / pushAt(f0, contact);
    headMode(out, sr, f0 * ratio * (1 + (rand() - 0.5) * 0.01), lv, (t60 / 6.91) * lives, glide * (ratio > 1.5 ? 0.3 : 1), settle, contact, fast, fastT60 / 6.91);
  }
  // The head's higher modes, from 300 Hz to 1 kHz, gone in a fifth of a second.
  for (const ratio of [6.5, 8.1, 9.7, 11.2, 13.4, 15.9, 18.7, 22.3]) headMode(out, sr, f0 * ratio * (1 + (rand() - 0.5) * 0.02), 0.03 * (0.6 + rand() * 0.8) * (0.4 + 0.6 * vel), (0.2 / 6.91) * (0.8 + rand() * 0.4), 0, 1, contact);
  // The beater on the head: a click from 1 to 4 kHz, rolled off above, harder the harder;
  // the shell's thump under it; and the snare's wires answering in sympathy.
  thud(out, sr, rand, [
    [2200, 0.6, 0.6 * click * vel * vel, 0.0012, 0.006],
    [1000, 0.7, 0.2 * click * vel * vel, 0.0012, 0.008],
    [260, 0.7, 0.1 * vel, 0.001, 0.015],
  ], 5000, 0.08);
  noiseBand(out, sr, rand, 6000, 0.6, 0.012 * vel, 0.006, 0.05);
  return normalise(out, 0.95);
}

/**
 * A kick's modes, as recorded: ratio to the fundamental, level, the time to fall 60 dB (s),
 * and the share that falls first, with its own (s). The modes at 2, 2.2 and 2.7 times move
 * against the fundamental where the microphone hears them: the recorded kick's first peak,
 * at 6.6 ms, is the fundamental's and theirs together, and the two near 2 and 2.2 times
 * beat, at their loudest together at the start and cancelling about 50 ms later.
 */
const KICK_MODES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [1, 1, 0.5, 0.6, 0.06], [1.99, -0.62, 0.42, 0.5, 0.06], [2.23, -0.85, 0.48, 0.8, 0.06], [2.45, 0.2, 0.5, 0, 1],
  [2.66, -0.5, 0.42, 0.4, 0.06], [3.08, 0.1, 0.52, 0, 1], [3.26, 0.13, 0.54, 0, 1], [3.6, 0.07, 0.56, 0, 1], [4.17, 0.03, 0.6, 0, 1], [4.72, 0.03, 0.6, 0, 1], [5.4, 0.03, 0.4, 0, 1],
];

// ── articulations ─────────────────────────────────────────────────────────────

/**
 * The cross-stick's resonances, as recorded: the stick laid across the snare, its shaft
 * striking the rim, rings the wood and the rim at a few hundred hertz (Hz, level in dB, the
 * time to fall 60 dB in s). None of them is the head's.
 */
const CROSS_STICK: ReadonlyArray<readonly [number, number, number]> = [[409, 0, 0.12], [304, -1.6, 0.135], [603, -4.9, 0.123], [874, -8.8, 0.108], [699, -9.3, 0.145], [986, -11.6, 0.104], [1227, -11, 0.1]];

/**
 * A cross-stick (side-stick) on a snare tuned to `f0`: the wood and the rim's knock (CROSS_STICK),
 * the head ringing under it, a short low thump of the stick's body, the click of the shaft
 * on the rim and the wires answering. As recorded, it is gone 20 dB in 50 ms and 40 dB in
 * 100 ms. A soft one is thinner and brighter: struck lightly, the knock and the thump fall
 * away faster than the click and the wires (the recorded soft cross-stick's lowest octaves
 * sit 9 to 13 dB further down, its top 5 to 7 dB further up).
 */
export function crossStick(sr: number, f0: number, vel: number, wires: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.ceil(0.3 * sr));
  const wood = vel, low = vel ** 1.5;
  for (const [hz, db, t60] of CROSS_STICK) headMode(out, sr, hz * (1 + (rand() - 0.5) * 0.03), 10 ** (db / 20) * wood, (t60 / 6.91) * (0.9 + rand() * 0.2), 0, 1, 0.0006);
  headMode(out, sr, f0 * 1.08, 0.15 * low, 0.3 / 6.91, 0, 1, 0.002);
  thud(out, sr, rand, [
    [140, 0.7, 16 * low, 0.0006, 0.008],
    [2600, 0.6, 2.5, 0.0001, 0.003],
    [6500, 0.8, 0.6, 0.0001, 0.001],
    [5000, 0.5, 1.4 * wires, 0.005, 0.022],
  ], 9000, 0.25);
  return normalise(out, 0.95);
}

/**
 * The hi-hat's foot: the pedal brings the plates together with no stick. As recorded, a
 * quiet touch for the first 10 ms as they meet, the "chick" peaking at about 30 ms, bright
 * (most of it at 4 to 8 kHz) and gone 20 dB by 65 ms, over a low puff of the pedal and the
 * air pressed out from between the plates. `spec` and `base` are the closed hat's.
 */
export function pedalChick(sr: number, spec: CymbalSpec, base: readonly Partial[], vel: number, rand: Rand, hq = false): Float32Array {
  // Pressed together without a stick, the plates' top octave is quieter than a struck hat's.
  const plates = cymbal(sr, { ...spec, level: spec.level.map((l, i) => (i === spec.level.length - 1 ? l - 8 : l)), bloom: 0.01, choke: 0.03, tick: 0, seconds: 0.3 }, base, vel, rand, hq);
  const out = new Float32Array(Math.ceil(0.32 * sr));
  const meet = Math.round(0.019 * sr);
  for (let i = 0; i + meet < out.length && i < plates.length; i++) out[i + meet] = plates[i]!;
  thud(out, sr, rand, [[120, 1.2, 1.5, 0.008, 0.03], [230, 0.7, 0.3, 0.008, 0.014], [520, 0.8, 0.06, 0.01, 0.012]], 3000, 0.15);
  return normalise(out, 0.9);
}

/**
 * A buzz (press) stroke on the snare: the stick pressed into the head bounces. As recorded
 * (a fast and a slow press roll, their onsets read above 1.5 kHz):
 * - the second contact comes 86 to 108 ms after the first (a firmer press sooner) and is as
 *   loud as it: the hand pressing in;
 * - the bounces after it come steadily, about 0.72 of that first gap apart on a firm press
 *   (60 to 66 ms), each about 6.4 dB under the last (a light press loses more);
 * - the stick held on the head damps its lowest motion: under 90 Hz a press roll is some
 *   18 dB quieter, against the stroke's whole sound, than a single stroke, so it is
 *   high-passed (PRESS_LOW), and the wires carry more of the sound.
 */
export function buzzStroke(sr: number, f0: number, vel: number, wires: number, ring: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.ceil(0.9 * sr));
  const first = 0.116 - 0.03 * vel;
  const step = 10 ** (-(6 + 5 * (1 - vel)) / 20);
  let at = 0, level = 1, v = vel;
  for (let b = 0; b < 7 && at < 0.75; b++) {
    const hit = snareStroke(sr, f0, v, wires * 2.5, ring * 0.8, rand);
    const from = Math.round(at * sr);
    for (let i = 0; i < hit.length && from + i < out.length; i++) out[from + i] = out[from + i]! + hit[i]! * level;
    at += (b === 0 ? first : first * (0.72 + 0.4 * (1 - vel))) * (0.95 + rand() * 0.1);
    if (b > 0) level *= step;
    v *= 0.85;
  }
  highpass4(out, sr, PRESS_LOW);
  return normalise(out, 0.95);
}

/** Where a press roll's low end is taken out (Hz): the stick held on the head damps the drum's lowest motion. */
const PRESS_LOW = 110;

/** A fourth-order Butterworth high-pass at `hz`, in place: two biquads (Q 0.541 and 1.307). */
function highpass4(x: Float32Array, sr: number, hz: number): void {
  for (const q of [0.5412, 1.3066]) {
    const w = (2 * Math.PI * hz) / sr, cw = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha, b0 = (1 + cw) / 2 / a0, b1 = -(1 + cw) / a0, a1 = (-2 * cw) / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let n = 0; n < x.length; n++) {
      const v = x[n]!;
      const y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = y;
      x[n] = y;
    }
  }
}
