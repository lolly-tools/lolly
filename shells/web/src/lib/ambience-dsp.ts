// SPDX-License-Identifier: MPL-2.0
/**
 * Ambience synthesis - the background-noise beds behind the player's Atmosphere
 * section. Pure DSP: numbers in, PCM out. No Web Audio, no DOM, so it is testable
 * and could move to a worker (or the engine) unchanged. lib/atmosphere.ts owns the
 * graph that plays what this bakes.
 *
 * WHY SYNTHESISE rather than ship recordings. Generated ambience is CC0 by
 * construction (no licence to audit, and none handed on to a user who exports a
 * video), weighs nothing in the bundle, works offline on first run, and loops
 * with no audible seam by construction - the same argument that made ZzFXM right for music.
 * Rain, wind, fire, waves and the three noise colours are all filtered/enveloped
 * noise, so they land close. The harder scenes need actual structure rather than
 * shaped hiss, which is the lesson every one of them taught the hard way:
 *
 *   - Filtered noise with an envelope on it sounds like WIND, whatever you name it.
 *     Chimes and voices need formants over a glottal buzz; a street needs engine
 *     harmonics with a Doppler drop; a stream needs bubbles that chirp upward.
 *   - Struck things ring on INHARMONIC partials. A sine is a beep, not a teacup.
 *   - Events must sit in FRONT of the bed. RMS normalisation sets the level from
 *     whatever is loudest on average - so a bed mixed too hot doesn't just mask the
 *     crockery/clacks/blops, it turns the gain down on them too. `ambience-dsp.test.ts`
 *     pins the foreground-to-background ratio for exactly this reason.
 *
 * Gapless looping rests on two rules, and every generator obeys both:
 *   1. All modulation is periodic in the loop - sines with an INTEGER number of
 *      cycles per buffer, never a free-running random walk that would jump at the
 *      wrap.
 *   2. Filter state is not periodic (a filter starts cold and settles), so each
 *      generator renders an extra tail and `foldLoop` crossfades it back over the
 *      head: the last sample runs straight into the first with the settled tail,
 *      and the fade returns to the cold head where it has warmed up. Uncorrelated
 *      noise needs an equal-POWER fade or the seam dips in level.
 */

export type AmbienceKind =
  | 'rain' | 'thunder' | 'waves' | 'stream' | 'wind' | 'birds' | 'night'
  | 'chimes' | 'city' | 'train' | 'keyboard' | 'fire'
  | 'white' | 'pink' | 'brown';

export const AMBIENCE_KINDS: readonly AmbienceKind[] = [
  'rain', 'thunder', 'waves', 'stream', 'wind', 'birds', 'night',
  'chimes', 'city', 'train', 'keyboard', 'fire',
  'white', 'pink', 'brown',
];

/**
 * Loop length per kind. Long enough that the ear can't hear the repeat, short
 * enough to keep the decoded buffer small: a 16 s stereo loop at 48 kHz is ~6 MB,
 * and buffers are only baked for layers the user actually turns on (and dropped
 * again when they turn them off). Modulated kinds run longer than flat noise
 * because their swells are what a listener would otherwise recognise looping.
 */
export const AMBIENCE_SECONDS: Record<AmbienceKind, number> = {
  rain: 8, thunder: 20, waves: 16, stream: 8, wind: 12, birds: 16, night: 12,
  chimes: 12, city: 16, train: 24, keyboard: 12, fire: 10,
  white: 4, pink: 4, brown: 8,
};

/** Per-kind loudness trim, applied after RMS normalisation so one slider position
 *  sounds roughly as loud whichever bed it drives. Equal RMS is not equal
 *  loudness: brown noise's energy sits where the ear is least sensitive, white's
 *  where it is most. */
const TRIM: Record<AmbienceKind, number> = {
  rain: 1, thunder: 1.1, waves: 1, stream: 0.95, wind: 0.95, birds: 0.9, night: 0.9,
  chimes: 1, city: 1.05, train: 1, keyboard: 0.9, fire: 1,
  white: 0.55, pink: 0.8, brown: 1.2,
};

/** Target RMS before trim - quiet enough that layering all seven never clips. */
const TARGET_RMS = 0.15;

// ── helpers ──────────────────────────────────────────────────────────────────

/** mulberry32 - small, fast, and seeded, so a bake is reproducible (tests pin it). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One-pole lowpass. `coef` is recomputed per sample by the modulated callers, so
 *  cutoff is a parameter of process(), not the constructor. */
function lpCoef(hz: number, sampleRate: number): number {
  return 1 - Math.exp((-2 * Math.PI * hz) / sampleRate);
}

/** Paul Kellett's economical pink-noise filter (-3 dB/octave to within ±0.05 dB). */
function pinkShaper(): (w: number) => number {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return (w: number): number => {
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
    return out;
  };
}

/** Brown (red) noise: a leaky integrator over white, so it can't wander off to DC. */
function brownShaper(): (w: number) => number {
  let last = 0;
  return (w: number): number => {
    last = (last + 0.02 * w) / 1.02;
    return last * 3.5;
  };
}

/** The Chamberlin tuning coefficient for a centre frequency. Split out because it
 *  carries a `Math.sin`, and a filter bank that recomputes one per filter per
 *  sample is the single most expensive thing in this file (see genCafe). */
function svCoef(hz: number, sampleRate: number): number {
  return 2 * Math.sin((Math.PI * Math.min(hz, sampleRate / 6)) / sampleRate);
}

/** A state-variable bandpass taking a PRE-TUNED coefficient - for callers that
 *  update tuning at block rate rather than per sample. */
function svBandpassTuned(q: number): (x: number, f: number) => number {
  let low = 0, band = 0;
  const damp = 1 / q;
  return (x: number, f: number): number => {
    low += f * band;
    const high = x - low - damp * band;
    band += f * high;
    return band;
  };
}

/** A state-variable bandpass whose centre frequency is set per sample (wind gusts,
 *  the droplet/crackle pings). Chamberlin form - stable while f < ~sampleRate/6. */
function svBandpass(sampleRate: number, q: number): (x: number, hz: number) => number {
  const filter = svBandpassTuned(q);
  return (x: number, hz: number): number => filter(x, svCoef(hz, sampleRate));
}

/** A periodic modulator: `cycles` whole cycles across the loop, so it meets itself
 *  at the wrap. Returns 0…1. */
function osc(i: number, n: number, cycles: number, phase = 0): number {
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * ((cycles * i) / n) + phase);
}

/**
 * Fold a rendered `n + tail` buffer down to a gapless `n`-sample loop by
 * crossfading the tail back over the head (equal power - see the module header).
 */
function foldLoop(buf: Float32Array, n: number, tail: number): Float32Array {
  const out = buf.subarray(0, n);
  for (let i = 0; i < tail; i++) {
    const t = (i / tail) * (Math.PI / 2);
    out[i] = out[i]! * Math.sin(t) + buf[n + i]! * Math.cos(t);
  }
  return out;
}

/** Scale to a known RMS (then trim), and back off if that would clip. */
function normalise(chans: Float32Array[], kind: AmbienceKind): void {
  let sum = 0, count = 0;
  for (const c of chans) { for (let i = 0; i < c.length; i++) { sum += c[i]! * c[i]!; } count += c.length; }
  const rms = Math.sqrt(sum / Math.max(1, count));
  if (!(rms > 0)) return;
  let gain = (TARGET_RMS / rms) * TRIM[kind];
  let peak = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]!));
  if (peak * gain > 0.99) gain = 0.99 / peak;
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] = c[i]! * gain;
}

// ── generators (one channel each; the caller reseeds per channel for stereo) ──

/**
 * Where a shared event sits between the ears: a sub-millisecond arrival difference
 * and a small level difference. Drawn from the PER-CHANNEL stream, so each channel
 * independently picks its own - which is exactly what puts one source somewhere in
 * the room instead of pinning it dead centre in both ears.
 */
function earPlacement(rnd: () => number, sampleRate: number): { delay: number; gain: number } {
  return {
    delay: Math.round((rnd() - 0.5) * 0.0009 * sampleRate),   // ±0.45 ms, the interaural range
    gain: 0.82 + rnd() * 0.18,
  };
}

/** Add an exponentially-decaying resonant ping - a rain droplet, a fire crackle. */
function ping(buf: Float32Array, at: number, hz: number, decaySec: number, amp: number, sampleRate: number, rnd: () => number): void {
  const len = Math.min(buf.length - at, Math.ceil(decaySec * 5 * sampleRate));
  if (len <= 0) return;
  const bp = svBandpass(sampleRate, 6);
  const k = 1 / (decaySec * sampleRate);
  for (let i = 0; i < len; i++) {
    const env = Math.exp(-i * k);
    buf[at + i] = buf[at + i]! + bp(rnd() * 2 - 1, hz) * env * amp;
  }
}

function genRain(n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // Bed: white noise with the low end rolled off twice and a gentle top cut - the
  // broadband hiss of rain, without the rumble that would fight a brown-noise layer.
  let hp1 = 0, hp2 = 0, lp = 0;
  const aHp = lpCoef(500, sampleRate);
  const aHp2 = lpCoef(900, sampleRate);
  const aLp = lpCoef(7000, sampleRate);
  for (let i = 0; i < total; i++) {
    const w = rnd() * 2 - 1;
    hp1 += aHp * (w - hp1);
    let x = w - hp1;
    hp2 += aHp2 * (x - hp2);
    x = x - hp2 * 0.6;
    lp += aLp * (x - lp);
    // Two slow, periodic swells: rain that never breathes reads as static.
    out[i] = lp * (0.8 + 0.2 * osc(i, n, 1) + 0.1 * osc(i, n, 3, 1.1));
  }
  // Droplets - sparse, closer pings over the bed so it has a foreground.
  const drops = Math.round((total / sampleRate) * 13);
  for (let d = 0; d < drops; d++) {
    ping(out, Math.floor(rnd() * total), 1500 + rnd() * 3200, 0.008 + rnd() * 0.018, 0.10 + rnd() * 0.16, sampleRate, rnd);
  }
  return out;
}

function genWaves(n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  const brown = brownShaper();
  // One swell every 8 s (the loop length is a whole multiple, so the swells wrap).
  const swells = Math.max(1, Math.round(n / sampleRate / 8));
  let lp = 0, spray = 0;
  for (let i = 0; i < total; i++) {
    // Asymmetric envelope: a wave builds slowly and breaks quickly.
    const s = osc(i, n, swells, -Math.PI / 2) ** 1.7;
    const cutoff = 180 + 760 * s;
    lp += lpCoef(cutoff, sampleRate) * (brown(rnd() * 2 - 1) - lp);
    // Crest spray: bright hiss that only shows up at the top of the swell.
    spray += lpCoef(2400, sampleRate) * ((rnd() * 2 - 1) - spray);
    out[i] = lp * (0.35 + 0.65 * s) + spray * s * s * 0.35;
  }
  return out;
}

function genWind(n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  const pink = pinkShaper();
  const brown = brownShaper();
  const bp = svBandpass(sampleRate, 3);
  let rumble = 0;
  const aRumble = lpCoef(200, sampleRate);
  for (let i = 0; i < total; i++) {
    // Centre frequency wanders on two coprime periodic oscillators - enough to
    // sound unrepeating over the loop without ever jumping at the wrap.
    const hz = 250 + 850 * (0.6 * osc(i, n, 3) + 0.4 * osc(i, n, 7, 2.3));
    const gust = 0.35 + 0.65 * osc(i, n, 2, 0.7) * (0.6 + 0.4 * osc(i, n, 5, 1.9));
    rumble += aRumble * (brown(rnd() * 2 - 1) - rumble);
    out[i] = bp(pink(rnd() * 2 - 1), hz) * gust * 2.2 + rumble * 0.25;
  }
  return out;
}

function genFire(n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  const brown = brownShaper();
  const pink = pinkShaper();
  let lowBed = 0, midBed = 0;
  const aLow = lpCoef(400, sampleRate);
  const aMid = lpCoef(1200, sampleRate);
  for (let i = 0; i < total; i++) {
    lowBed += aLow * (brown(rnd() * 2 - 1) - lowBed);
    midBed += aMid * (pink(rnd() * 2 - 1) - midBed);
    const breathe = 0.75 + 0.25 * osc(i, n, 2, 0.4) * osc(i, n, 5, 2.1);
    out[i] = (lowBed * 0.6 + midBed * 0.19) * breathe;
  }
  // Crackles: mostly small ticks, occasionally a real pop. The irregularity is the
  // whole character - an evenly spaced crackle reads as a machine.
  const ticks = Math.round((total / sampleRate) * 7);
  for (let c = 0; c < ticks; c++) {
    const big = rnd() < 0.08;
    ping(out, Math.floor(rnd() * total), big ? 700 + rnd() * 900 : 1400 + rnd() * 3600,
      big ? 0.02 + rnd() * 0.03 : 0.002 + rnd() * 0.008,
      big ? 1.0 + rnd() * 0.8 : 0.22 + rnd() * 0.4, sampleRate, rnd);
  }
  return out;
}

/**
 * Add a pitched event - a bird's syllable, a cricket pulse, a car horn, a bubble.
 * `sweep` is the end/start frequency ratio (a chirp glides), `vibrato` a fast
 * warble depth. Sine rather than noise: this is the difference between a creature
 * and a hiss, and the ear is unforgiving about it.
 */
function tone(
  buf: Float32Array, at: number, hz: number, decaySec: number, amp: number, sampleRate: number,
  opts: { sweep?: number; vibrato?: number; attackSec?: number } = {},
): void {
  const { sweep = 1, vibrato = 0, attackSec = 0.002 } = opts;
  const len = Math.min(buf.length - at, Math.ceil(decaySec * 4 * sampleRate));
  if (len <= 0) return;
  const k = 1 / (decaySec * sampleRate);
  const atk = Math.max(1, attackSec * sampleRate);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const f = hz * (1 + (sweep - 1) * t) * (1 + vibrato * Math.sin((2 * Math.PI * 22 * i) / sampleRate));
    phase += (2 * Math.PI * f) / sampleRate;
    const env = Math.exp(-i * k) * Math.min(1, i / atk);
    buf[at + i] = buf[at + i]! + Math.sin(phase) * env * amp;
  }
}

/**
 * A SUSTAINED pitched event built from harmonics - a car horn, a steam whistle, a
 * passing engine. Distinct from `tone` (one sine, struck-and-decaying): these need
 * a body that holds, several partials to have any timbre at all, and smooth edges.
 *
 * `endHz` sweeps the pitch across the event, which is what makes an engine pass
 * rather than idle (Doppler). `breath` mixes in noise - a steam whistle without it
 * is an organ pipe.
 */
function pitched(
  buf: Float32Array, at: number, durSec: number, hz: number, amps: readonly number[], amp: number,
  sampleRate: number,
  opts: { attackSec?: number; releaseSec?: number; endHz?: number; vibratoHz?: number; vibratoDepth?: number; breath?: number; rnd?: () => number } = {},
): void {
  const { attackSec = 0.03, releaseSec = 0.08, endHz = hz, vibratoHz = 0, vibratoDepth = 0, breath = 0, rnd } = opts;
  const len = Math.min(buf.length - at, Math.ceil(durSec * sampleRate));
  if (len <= 0) return;
  const atk = Math.max(1, attackSec * sampleRate);
  const rel = Math.max(1, releaseSec * sampleRate);
  const phases = new Float64Array(amps.length);
  let breathState = 0;
  const aBreath = lpCoef(2600, sampleRate);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const f = hz + (endHz - hz) * t;
    const vib = vibratoHz ? 1 + vibratoDepth * Math.sin((2 * Math.PI * vibratoHz * i) / sampleRate) : 1;
    let s = 0;
    for (let k = 0; k < amps.length; k++) {
      phases[k]! += (2 * Math.PI * f * (k + 1) * vib) / sampleRate;
      s += Math.sin(phases[k]!) * amps[k]!;
    }
    if (breath && rnd) {
      breathState += aBreath * ((rnd() * 2 - 1) - breathState);
      s += breathState * breath;
    }
    // Raised-cosine attack and release, flat in between - no edges to click on.
    const env = Math.min(1, 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, i / atk)))
      * Math.min(1, 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, (len - i) / rel)));
    buf[at + i] = buf[at + i]! + s * env * amp;
  }
}

/** Add a band-limited noise swell - a passing car, a roll of thunder, a train's
 *  wheel hiss. `hzFrom → hzTo` sweeps the band, which is what sells a car as
 *  passing rather than idling. */
function swell(
  buf: Float32Array, at: number, lenSec: number, hzFrom: number, hzTo: number, amp: number,
  sampleRate: number, rnd: () => number, q = 1.2,
): void {
  const len = Math.min(buf.length - at, Math.ceil(lenSec * sampleRate));
  if (len <= 0) return;
  const bp = svBandpass(sampleRate, q);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    // A raised-cosine bell: no edges, so a swell can't click at either end.
    const env = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
    buf[at + i] = buf[at + i]! + bp(rnd() * 2 - 1, hzFrom + (hzTo - hzFrom) * t) * env * amp;
  }
}

function genThunder(n: number, total: number, sampleRate: number, rnd: () => number, srnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // NO rain under it. This is a mixer: Rain is its own slider, and baking a rain
  // curtain in here would double it for anyone who wants both and force it on
  // anyone who doesn't. All that sits under the rolls is a very low, slow air
  // pressure - felt more than heard, and impossible to mistake for hiss.
  const airBrown = brownShaper();
  let air = 0;
  const aAir = lpCoef(55, sampleRate);
  for (let i = 0; i < total; i++) {
    air += aAir * (airBrown(rnd() * 2 - 1) - air);
    out[i] = air * 0.5 * (0.7 + 0.3 * osc(i, n, 1));
  }
  // Two or three rolls per loop, each a long low rumble that arrives, peaks and
  // decays over seconds, with a flutter so it rolls rather than fades flat.
  // Shared placement: a roll of thunder is one event in the sky, not one per ear.
  const rolls = 2 + (srnd() < 0.5 ? 1 : 0);
  for (let r = 0; r < rolls; r++) {
    const ear = earPlacement(rnd, sampleRate);
    const at = Math.floor(srnd() * total) + ear.delay;
    const lenSec = 2.5 + srnd() * 2.5;
    const len = Math.min(total - at, Math.ceil(lenSec * sampleRate));
    const brown = brownShaper();
    let lpr = 0;
    const cut = 110 + rnd() * 160;
    const a = lpCoef(cut, sampleRate);
    const attack = Math.max(1, (0.05 + rnd() * 0.35) * sampleRate);
    const amp = (1.6 + srnd() * 1.4) * ear.gain;
    for (let i = 0; i < len; i++) {
      lpr += a * (brown(rnd() * 2 - 1) - lpr);
      const t = i / len;
      const env = Math.min(1, i / attack) * Math.exp(-3.2 * t);
      // The roll: a couple of slow flutters inside the decay.
      const roll = 0.65 + 0.35 * Math.sin(2 * Math.PI * (1.5 + rnd() * 0.01) * t * 3);
      out[at + i] = out[at + i]! + lpr * env * roll * amp;
    }
  }
  return out;
}

/**
 * A bubble "blop". A collapsing bubble's resonance RISES as it shrinks, so the
 * pitch sweeps up - that upward chirp is the entire difference between water and
 * a click. Big bubbles start low and ring longer; small ones are quick ticks.
 */
function blop(buf: Float32Array, at: number, hz: number, decaySec: number, amp: number, sampleRate: number): void {
  // The rise has to be SLIGHT. A big upward sweep is a cartoon boing, not water - 
  // and a high starting pitch is a droplet on glass rather than a bubble in a pool.
  // Low and barely-rising is the whole character.
  tone(buf, at, hz, decaySec, amp, sampleRate, { sweep: 1.12 + (hz < 260 ? 0.14 : 0.06), attackSec: 0.0012 });
  // A trace of the second mode for body - enough to not be a pure sine, quiet
  // enough not to ring.
  tone(buf, at, hz * 1.9, decaySec * 0.35, amp * 0.16, sampleRate, { sweep: 1.08, attackSec: 0.001 });
}

function genStream(n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // The bed is deliberately QUIET and restless: water over stones is a fast,
  // uneven flutter, not a steady band of hiss. A smooth broadband bed at any
  // useful level just reads as wind - the moving water has to come from the
  // blops and trickles layered on top, so the bed only fills the gaps between them.
  const bp = svBandpass(sampleRate, 1.6);
  let lp = 0, flutter = 0;
  const aLp = lpCoef(4200, sampleRate);
  const aFlut = lpCoef(38, sampleRate);   // ~25 ms wobble: the churn of a shallow run
  for (let i = 0; i < total; i++) {
    flutter += aFlut * ((rnd() * 2 - 1) - flutter);
    const hz = 700 + 380 * osc(i, n, 3, 0.4);
    lp += aLp * (bp(rnd() * 2 - 1, hz) - lp);
    out[i] = lp * (0.55 + 0.45 * Math.abs(flutter * 3)) * 0.36;
  }
  // Blops: the foreground. A wide size range - the big slow ones give it depth,
  // the small fast ones give it detail.
  const bubbles = Math.round((total / sampleRate) * 15);
  for (let b = 0; b < bubbles; b++) {
    const big = rnd() < 0.28;
    blop(out, Math.floor(rnd() * total),
      big ? 105 + rnd() * 135 : 280 + rnd() * 520,
      big ? 0.05 + rnd() * 0.07 : 0.01 + rnd() * 0.022,
      big ? 1.5 + rnd() * 0.9 : 0.55 + rnd() * 0.45, sampleRate);
  }
  // Trickles: a rivulet running over a stone - a quick descending run of small
  // blops, which is how water reads as GOING somewhere rather than just sitting.
  const trickles = Math.round((total / sampleRate) * 1.6);
  for (let t = 0; t < trickles; t++) {
    let at = Math.floor(rnd() * total);
    let hz = 340 + rnd() * 460;
    const drops = 5 + Math.floor(rnd() * 9);
    for (let d = 0; d < drops && at < total; d++) {
      blop(out, at, hz, 0.01 + rnd() * 0.018, 0.4 + rnd() * 0.3, sampleRate);
      hz *= 0.9 + rnd() * 0.16;
      at += Math.floor((0.02 + rnd() * 0.05) * sampleRate);
    }
  }
  // …and the odd little pour: a short burst of fast, dense droplets.
  const pours = Math.max(1, Math.round((total / sampleRate) * 0.3));
  for (let p = 0; p < pours; p++) {
    const start = Math.floor(rnd() * total);
    const len = Math.floor((0.4 + rnd() * 0.8) * sampleRate);
    for (let at = start; at < start + len && at < total; at += Math.floor((0.006 + rnd() * 0.014) * sampleRate)) {
      blop(out, at, 260 + rnd() * 620, 0.007 + rnd() * 0.013, 0.26 + rnd() * 0.2, sampleRate);
    }
  }
  return out;
}

function genBirds(n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // A quiet clearing: distant leaves, nothing more. The birds are the content.
  const pink = pinkShaper();
  let lp = 0;
  const a = lpCoef(1400, sampleRate);
  for (let i = 0; i < total; i++) {
    lp += a * (pink(rnd() * 2 - 1) - lp);
    out[i] = lp * 0.32 * (0.7 + 0.3 * osc(i, n, 2, 0.9));
  }
  // Calls, in phrases of a few syllables - a bird that emits evenly spaced single
  // beeps is a smoke alarm.
  const calls = Math.round((total / sampleRate) * 1.1);
  for (let c = 0; c < calls; c++) {
    let at = Math.floor(rnd() * total);
    const base = 2200 + rnd() * 3000;   // this bird's voice, kept across the phrase
    const syllables = 1 + Math.floor(rnd() * 4);
    for (let s = 0; s < syllables; s++) {
      tone(out, at, base * (0.9 + rnd() * 0.25), 0.03 + rnd() * 0.09, 0.22 + rnd() * 0.3, sampleRate,
        { sweep: rnd() < 0.5 ? 0.55 + rnd() * 0.3 : 1.3 + rnd() * 0.7, vibrato: rnd() * 0.06 });
      at += Math.floor((0.06 + rnd() * 0.13) * sampleRate);
      if (at >= total) break;
    }
  }
  return out;
}

function genNight(n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // Warm air: a low hum with almost nothing in it.
  const brown = brownShaper();
  let lp = 0;
  const a = lpCoef(320, sampleRate);
  for (let i = 0; i < total; i++) {
    lp += a * (brown(rnd() * 2 - 1) - lp);
    out[i] = lp * 0.45 * (0.8 + 0.2 * osc(i, n, 1));
  }
  // Crickets: several individuals, each with its OWN steady rate and pitch, drifting
  // in and out of phase with each other. That interference is the whole texture - 
  // one cricket is a metronome, five are a summer night.
  const individuals = 4 + Math.floor(rnd() * 3);
  for (let k = 0; k < individuals; k++) {
    const period = (0.42 + rnd() * 0.45) * sampleRate;      // chirp every ~0.4–0.9 s
    const pitch = 3800 + rnd() * 1600;
    const pulses = 3 + Math.floor(rnd() * 3);
    const amp = 0.38 + rnd() * 0.4;
    const gap = Math.floor((0.012 + rnd() * 0.01) * sampleRate);
    for (let at = Math.floor(rnd() * period); at < total; at += Math.floor(period)) {
      for (let p = 0; p < pulses; p++) {
        tone(out, at + p * gap * 2, pitch, 0.006, amp, sampleRate, { sweep: 1.05, attackSec: 0.001 });
      }
    }
  }
  return out;
}

/**
 * A struck body - a chime tube, a cup set down. Struck objects ring on
 * INHARMONIC partials (the bar/bell series, not 2f/3f), which is exactly what
 * separates a clink from a beep - a sine at 3 kHz is a smoke alarm. Higher
 * partials also die faster than low ones, so the strike is bright and the tail
 * isn't.
 */
function clink(buf: Float32Array, at: number, hz: number, amp: number, sampleRate: number, rnd: () => number): void {
  const RATIOS = [1, 2.76, 5.4, 8.93];
  for (let p = 0; p < RATIOS.length; p++) {
    tone(buf, at, hz * RATIOS[p]!, (0.16 + rnd() * 0.16) / (1 + p * 1.4), amp / (1 + p * 1.5), sampleRate,
      { attackSec: 0.0006 });
  }
  // The contact transient - without it the ring has no strike in front of it.
  ping(buf, at, hz * 4, 0.002, amp * 0.7, sampleRate, rnd);
}

function genChimes(n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // WINDCHIMES - with an honest note on how it got here: this was built as café
  // babble (a glottal buzz through three FORMANT resonances per voice, formants
  // being what make a sound read as a voice rather than as wind). It did not land
  // as a café. It landed as chimes on a porch, so that is what it is called now.
  // The formant bank stays, because it is what gives the moving air its body; the
  // struck partials below are the chimes. No words, nothing for a reader's language
  // centre to snag on - which is what keeps it usable for focus.
  const speakers = 6;
  const vs = Array.from({ length: speakers }, () => {
    const low = rnd() < 0.5;                       // two rough voice ranges, mixed
    return {
      f0: low ? 88 + rnd() * 42 : 165 + rnd() * 80,
      // F1/F2/F3. Q high enough to ring as a vowel, not so high it whistles.
      f: [
        { bp: svBandpassTuned(9), hz: (low ? 430 : 560) + rnd() * 260, g: 1, coef: 0 },
        { bp: svBandpassTuned(7), hz: (low ? 1050 : 1400) + rnd() * 620, g: 0.55, coef: 0 },
        { bp: svBandpassTuned(5), hz: 2350 + rnd() * 900, g: 0.22, coef: 0 },
      ],
      syl: 40 + Math.floor(rnd() * 34),            // whole cycles/loop → 3.3–6.2 Hz syllables
      phrase: 2 + Math.floor(rnd() * 4),           // …grouped into phrases, with gaps
      phase: rnd() * 6.28,
      amp: (0.55 + rnd() * 0.5) / (low ? 1 : 1.25),
      acc: rnd(),
    };
  });
  const brown = brownShaper();
  let room = 0;
  const aRoom = lpCoef(300, sampleRate);
  // Formant tuning is refreshed every BLOCK, not every sample: each retune costs a
  // Math.sin, and 8 speakers x 3 formants x 2 channels of them was over a second of
  // bake time on its own. A vowel that moves in 1.3 ms steps is indistinguishable
  // from one that moves continuously.
  const BLOCK = 64;
  for (let i = 0; i < total; i++) {
    const retune = i % BLOCK === 0;
    let mix = 0;
    for (const v of vs) {
      const drift = 1 + 0.05 * (osc(i, n, v.phrase, v.phase) - 0.5);
      v.acc += (v.f0 * drift) / sampleRate;
      if (v.acc >= 1) v.acc -= 1;
      // Glottal source: sawtooth + a little breath. The vowel comes from the filters.
      const src = (2 * v.acc - 1) * 0.75 + (rnd() * 2 - 1) * 0.2;
      // Vowels move - sweep the formants a little at the syllable rate.
      if (retune) {
        const vowel = 1 + 0.1 * (osc(i, n, v.syl, v.phase * 1.3) - 0.5);
        for (const fo of v.f) fo.coef = svCoef(fo.hz * vowel, sampleRate);
      }
      let f = 0;
      for (const fo of v.f) f += fo.bp(src, fo.coef) * fo.g;
      // Syllables inside phrases, both smooth (a hard gate would click).
      const syl = 0.3 + 0.7 * osc(i, n, v.syl, v.phase);
      const phrase = 0.12 + 0.88 / (1 + Math.exp(-9 * (osc(i, n, v.phrase, v.phase * 2) - 0.42)));
      mix += f * syl * phrase * v.amp;
    }
    // A little room, well under the voices - the old version leaned on this and it
    // is a big part of why the bed read as wind.
    room += aRoom * (brown(rnd() * 2 - 1) - room);
    // The air is a BACKGROUND: it sits low enough that a struck tube reads as an
    // event, not as a bump in a wash.
    out[i] = mix * 0.3 + room * 0.14;
  }
  // The chimes themselves, at a rate you actually notice.
  const clinks = Math.round((total / sampleRate) * 1.5);
  for (let c = 0; c < clinks; c++) {
    const at = Math.floor(rnd() * total);
    clink(out, at, 900 + rnd() * 1700, 1.05 + rnd() * 0.9, sampleRate, rnd);
    // One tube swinging into its neighbour: a second, softer strike just after.
    if (rnd() < 0.45) clink(out, at + Math.floor((0.05 + rnd() * 0.09) * sampleRate), 1200 + rnd() * 1800, 0.45, sampleRate, rnd);
  }
  // A gust: a quick run of strikes as the whole set swings through itself.
  const stirs = Math.max(1, Math.round((total / sampleRate) * 0.18));
  for (let s = 0; s < stirs; s++) {
    let at = Math.floor(rnd() * total);
    const hz = 1800 + rnd() * 1400;
    const taps = 4 + Math.floor(rnd() * 5);
    for (let t = 0; t < taps && at < total; t++) {
      clink(out, at, hz * (0.94 + rnd() * 0.12), 0.32 + rnd() * 0.2, sampleRate, rnd);
      at += Math.floor((0.075 + rnd() * 0.05) * sampleRate);
    }
  }
  return out;
}

function genCity(n: number, total: number, sampleRate: number, rnd: () => number, srnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // Weighted toward RUMBLE, not swoosh. The old bed was mostly a mid-band hiss,
  // which is indistinguishable from wind: a street's constant is the low drone of
  // engines through buildings. Two brown layers carry it, and the tyre wash is
  // pushed well down and darkened so it sits under the drone rather than over it.
  const deep = brownShaper();
  const mid = brownShaper();
  const tyres = svBandpass(sampleRate, 0.7);
  let lpDeep = 0, lpMid = 0;
  const aDeep = lpCoef(85, sampleRate);
  const aMid = lpCoef(240, sampleRate);
  for (let i = 0; i < total; i++) {
    lpDeep += aDeep * (deep(rnd() * 2 - 1) - lpDeep);
    lpMid += aMid * (mid(rnd() * 2 - 1) - lpMid);
    const wash = tyres(rnd() * 2 - 1, 950 + 320 * osc(i, n, 3, 0.6));
    out[i] = lpDeep * 1.0 + lpMid * 0.34 * (0.8 + 0.2 * osc(i, n, 2))
      + wash * 0.1 * (0.7 + 0.3 * osc(i, n, 2, 2.2));
  }
  // Vehicles passing. An engine is a HARMONIC stack, and its pitch drops as it goes
  // by - a swept noise band alone was the other half of why this read as a windstorm.
  // The tyre swell rides along with it at a fraction of the level.
  // Fewer passes than before: at ~0.7/s they overlapped into a continuous motorway
  // wall, which is the same 'windstorm' failure in another costume. A street
  // breathes - you hear individual vehicles arrive and go.
  const cars = Math.round((total / sampleRate) * 0.42);
  for (let c = 0; c < cars; c++) {
    const at = Math.floor(rnd() * total);
    const dur = 1.3 + rnd() * 1.7;
    const f0 = 52 + rnd() * 46;                       // engine order, idling-to-cruising
    pitched(out, at, dur, f0, [1, 0.75, 0.5, 0.32, 0.2, 0.12], 0.5 + rnd() * 0.45, sampleRate, {
      endHz: f0 * (0.78 + rnd() * 0.08),              // Doppler drop as it passes
      attackSec: dur * 0.45, releaseSec: dur * 0.5,   // → a bell: approaches, passes, gone
      breath: 0.25, rnd,
    });
    swell(out, at, dur, 520 + rnd() * 380, 230 + rnd() * 130, 0.28 + rnd() * 0.2, sampleRate, rnd, 0.9);
  }
  // Horns - they were there before, at a level the bed swallowed whole. Now they
  // are proper two-tone harmonic blasts (the minor-third interval a real horn uses)
  // and loud enough to be the event they are meant to be.
  const horns = 2 + Math.floor(srnd() * 2);
  for (let h = 0; h < horns; h++) {
    const ear = earPlacement(rnd, sampleRate);
    const at = Math.floor(srnd() * total) + ear.delay;
    const hz = 330 + srnd() * 150;
    // The FIRST horn of every loop is close by. Leaving it to a coin flip meant a
    // bake could come out with every horn a street away and effectively inaudible - 
    // and the horns are the thing that says "street" rather than "weather".
    const near = h === 0 || srnd() < 0.4;
    const amp = near ? 1.5 + srnd() * 0.6 : 0.7 + srnd() * 0.35;
    const dur = near ? 0.22 + srnd() * 0.4 : 0.4 + srnd() * 0.5;
    // Distance eats the top: a far horn keeps only its lower partials.
    const stack = near ? [1, 0.55, 0.34, 0.2, 0.1] : [1, 0.4, 0.14];
    pitched(out, at, dur, hz, stack, amp * ear.gain, sampleRate, { attackSec: 0.025, releaseSec: 0.06 });
    pitched(out, at, dur, hz * 1.19, stack, amp * 0.8 * ear.gain, sampleRate, { attackSec: 0.03, releaseSec: 0.06 });
    // A double-tap on some of them - one long blast reads as a stuck horn.
    if (srnd() < 0.4) {
      const at2 = at + Math.floor((dur + 0.12 + srnd() * 0.1) * sampleRate);
      pitched(out, at2, dur * 0.7, hz, stack, amp * 0.9 * ear.gain, sampleRate, { attackSec: 0.025, releaseSec: 0.06 });
      pitched(out, at2, dur * 0.7, hz * 1.19, stack, amp * 0.7 * ear.gain, sampleRate, { attackSec: 0.03, releaseSec: 0.06 });
    }
  }
  return out;
}

/**
 * Push a signal into the DISTANCE. Turning the level down is not distance: air
 * absorbs the top end over a few hundred metres, and the ground and whatever is
 * between you and the source send back a smeared tail a few tens of milliseconds
 * later. Rendered into a scratch buffer, then folded back in - cheap, and far more
 * convincing than attenuation alone.
 *
 * Different sources need different distance, and not only in degree: a KNOCK lives
 * in its attack, so smoothing it at the same cutoff that suits a sustained horn
 * throws away the only part the ear uses to hear it as an impact. Callers pass their
 * own cutoff and reflection pattern for that reason.
 */
function distant(
  src: Float32Array, dst: Float32Array, lpHz: number, gain: number, sampleRate: number,
  taps: readonly (readonly [number, number])[] = [[0, 1], [0.037, 0.42], [0.083, 0.26], [0.151, 0.15], [0.24, 0.08]],
): void {
  const a = lpCoef(lpHz, sampleRate);
  let lp = 0;
  for (let i = 0; i < src.length; i++) {
    lp += a * (src[i]! - lp);
    for (const [delaySec, level] of taps) {
      const j = i + Math.round(delaySec * sampleRate);
      if (j < dst.length) dst[j] = dst[j]! + lp * level * gain;
    }
  }
}

/**
 * A rail joint, heard from across a field: a KNOCK, not a note.
 *
 * The previous version rang two tuned sines (an axle "thud" and a rail "ring") and
 * the result was a tuneless glockenspiel - which is exactly what a pitched partial
 * with a 20 ms decay is. Steel struck through a loaded bogie is broadband and dead:
 * a short noise burst through a low resonance, a tighter mid knock for the body,
 * and nothing that holds a pitch long enough for the ear to hear one.
 */
function clack(buf: Float32Array, at: number, amp: number, sampleRate: number, rnd: () => number): void {
  ping(buf, at, 78 + rnd() * 52, 0.035 + rnd() * 0.02, amp * 1.15, sampleRate, rnd);   // the weight
  ping(buf, at, 250 + rnd() * 220, 0.014 + rnd() * 0.01, amp * 0.6, sampleRate, rnd);  // the knock
  ping(buf, at, 900 + rnd() * 700, 0.0022, amp * 0.3, sampleRate, rnd);                // the contact edge
}

function genTrain(n: number, total: number, sampleRate: number, rnd: () => number, srnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // Carriage rumble, and MUCH less hiss than before - a broadband wash at the old
  // level was the "windy" part, and it was also masking the joints.
  const brown = brownShaper();
  const hiss = svBandpass(sampleRate, 0.8);
  let lp = 0;
  const a = lpCoef(170, sampleRate);
  // Wheel rotation: at speed a wheel turns a few times a second, and you hear it as
  // a rhythmic pulse through the floor. Whole cycles per loop, so it survives the
  // wrap; deliberately a little slower than the joint rhythm it rides under.
  const rev = Math.round((total / sampleRate) * 4.6);
  for (let i = 0; i < total; i++) {
    lp += a * (brown(rnd() * 2 - 1) - lp);
    // The wheel pulse: sharpened so it thumps rather than sways.
    const wheel = 0.72 + 0.28 * osc(i, n, rev) ** 2.2;
    out[i] = lp * 0.6 * wheel * (0.88 + 0.12 * osc(i, n, 2))
      + hiss(rnd() * 2 - 1, 1500 + 400 * osc(i, n, 5, 1.3)) * 0.05;
  }
  // Everything that is heard ACROSS A DISTANCE - the joints and the horn - is
  // rendered dry into a scratch buffer and then pushed back through `distant`.
  // Mixing them straight into the bed put them in the cab with you.
  // Two scratch buffers, because the knocks and the horn want different distance
  // treatment (see `distant`): a knock that has lost its attack is inaudible.
  const rail = new Float32Array(total);
  const horn = new Float32Array(total);
  // Rail joints. A bogie has two axles, so a joint gives a PAIR of knocks close
  // together, and a carriage has two bogies - "da-dum … da-dum", then the gap to
  // the next carriage. The cycle is exactly periodic so the rhythm carries across
  // the loop point; the few milliseconds of jitter on each knock are what keep it
  // from sounding like a drum machine.
  //
  // The cycle is derived from the LOOP length rather than fixed in seconds, so a
  // whole number of them fits: at a fixed 1.25 s the last cycle before the wrap was
  // a partial one and the rhythm stumbled every time round.
  const cycles = Math.max(1, Math.round(n / (0.95 * sampleRate)));
  const cycle = n / cycles;
  for (let c = 0; c * cycle < total; c++) {
    const base = c * cycle;
    for (const [off, amp] of [[0, 1.5], [0.085, 1.2], [0.42, 1.4], [0.505, 1.1]] as const) {
      const at = Math.round(base + (off + (rnd() - 0.5) * 0.01) * sampleRate);
      if (at >= 0 && at < total) clack(rail, at, amp * (0.85 + rnd() * 0.3), sampleRate, rnd);
    }
  }
  // A horn in the distance: a HUM, not a honk. The old one stacked a fifth on top
  // (1.5x) with a bright partial set and a fast attack, which is a chime - a chord
  // is the one thing a distant horn is not. This is a single low note, slightly
  // detuned against itself so it beats slowly, with almost nothing above the third
  // harmonic, and a slow swell in and out.
  // Rare on purpose. A horn is an EVENT - on a loop this length, at most one per
  // pass and often none, so it lands maybe once every half-minute or so rather than
  // becoming part of the rhythm. Placed from the SHARED stream (see Generator) so
  // both ears hear the one horn at the one moment.
  if (srnd() < 0.55) {
    const ear = earPlacement(rnd, sampleRate);
    const at = Math.floor(srnd() * total) + ear.delay;
    const hz = 105 + srnd() * 55;
    const dur = 1.6 + srnd() * 1.4;
    for (const [mult, amp] of [[1, 0.85], [1.004, 0.6]] as const) {
      pitched(horn, at, dur, hz * mult, [1, 0.34, 0.12, 0.04], amp * ear.gain, sampleRate,
        { attackSec: 0.35, releaseSec: 0.65, vibratoHz: 3.2, vibratoDepth: 0.002, breath: 0.12, rnd });
    }
    // A second, softer call after a gap - the shape people know, without the toot.
    if (srnd() < 0.5) {
      const at2 = at + Math.round((dur + 0.5 + srnd() * 0.4) * sampleRate);
      for (const [mult, amp] of [[1, 0.6], [1.004, 0.42]] as const) {
        pitched(horn, at2, dur * 0.75, hz * mult, [1, 0.34, 0.12, 0.04], amp * ear.gain, sampleRate,
          { attackSec: 0.3, releaseSec: 0.6, vibratoHz: 3.2, vibratoDepth: 0.002, breath: 0.12, rnd });
      }
    }
  }
  // The track: bright enough to keep the strike, with only a short tail - a knock
  // across a field still arrives as a knock.
  distant(rail, out, 3200, 2.1, sampleRate, [[0, 1], [0.029, 0.3], [0.068, 0.15], [0.125, 0.07]]);
  // The horn: dark and smeared, which is what a kilometre of air does to a long note.
  distant(horn, out, 900, 0.9, sampleRate);
  return out;
}

function genKeyboard(_n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // A very quiet room under it, so the keys aren't hanging in a vacuum.
  let lp = 0;
  const a = lpCoef(500, sampleRate);
  for (let i = 0; i < total; i++) { lp += a * ((rnd() * 2 - 1) - lp); out[i] = lp * 0.12; }
  // Typing has a shape: bursts of keys in a word, then a pause to think. Even
  // spacing is the tell that gives away a fake, so the rhythm is built in runs.
  let at = Math.floor(rnd() * 0.4 * sampleRate);
  while (at < total) {
    const keys = 3 + Math.floor(rnd() * 8);
    for (let k = 0; k < keys && at < total; k++) {
      const space = rnd() < 0.16;          // the spacebar is deeper and louder
      const amp = (space ? 0.55 : 0.32) + rnd() * 0.2;
      // Two components per press: the low thock of the key bottoming out, and the
      // bright click of the switch. One without the other sounds like a toy.
      ping(out, at, space ? 130 + rnd() * 60 : 190 + rnd() * 130, 0.022 + rnd() * 0.02, amp, sampleRate, rnd);
      ping(out, at + Math.round(0.002 * sampleRate), 2400 + rnd() * 2600, 0.004 + rnd() * 0.004, amp * 0.8, sampleRate, rnd);
      // The release, a moment later and softer - the other half of a keystroke.
      const up = at + Math.round((0.035 + rnd() * 0.03) * sampleRate);
      if (up < total) ping(out, up, 1800 + rnd() * 1800, 0.004, amp * 0.28, sampleRate, rnd);
      at += Math.round((0.055 + rnd() * 0.11) * sampleRate);
    }
    at += Math.round((0.25 + rnd() * 1.1) * sampleRate);   // the pause between words
  }
  return out;
}

function genWhite(_n: number, total: number, sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  // Not raw white: a gentle top cut takes off the fizz that makes flat white
  // fatiguing over an afternoon, and long listening is what this generator is for.
  let lp = 0;
  const a = lpCoef(12000, sampleRate);
  for (let i = 0; i < total; i++) { lp += a * ((rnd() * 2 - 1) - lp); out[i] = lp; }
  return out;
}

function genPink(_n: number, total: number, _sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  const pink = pinkShaper();
  for (let i = 0; i < total; i++) out[i] = pink(rnd() * 2 - 1);
  return out;
}

function genBrown(_n: number, total: number, _sampleRate: number, rnd: () => number): Float32Array {
  const out = new Float32Array(total);
  const brown = brownShaper();
  for (let i = 0; i < total; i++) out[i] = brown(rnd() * 2 - 1);
  return out;
}

/**
 * A generator gets TWO random streams. `rnd` is per-channel - it draws the noise
 * and the dense textures, and having it differ between left and right is what
 * makes a bed stereo. `srnd` is SHARED between the channels: rare, singular events
 * (a train's horn, a roll of thunder, a car sounding off) must happen at the same
 * moment in both ears, or one horn is heard as two smeared across the stereo field.
 *
 * A shared event still gets its POSITION from `rnd`: a few tenths of a millisecond
 * of arrival difference and a little level difference between the ears is how a real
 * source sits somewhere rather than dead centre. Same event, placed in the room.
 */
type Generator = (n: number, total: number, sampleRate: number, rnd: () => number, srnd: () => number) => Float32Array;

const GENERATORS: Record<AmbienceKind, Generator> = {
  rain: genRain, thunder: genThunder, waves: genWaves, stream: genStream, wind: genWind,
  birds: genBirds, night: genNight, chimes: genChimes, city: genCity, train: genTrain,
  keyboard: genKeyboard, fire: genFire, white: genWhite, pink: genPink, brown: genBrown,
};

/**
 * Bake one ambience bed: two decorrelated channels (same modulation, independent
 * noise - so it opens up in stereo without the swells drifting apart), already
 * folded into a gapless loop and normalised.
 *
 * `seed` is exposed so a test can pin a bake; callers otherwise take the default.
 */
export function bakeAmbience(kind: AmbienceKind, sampleRate: number, seed = 0x10117): Float32Array[] {
  const seconds = AMBIENCE_SECONDS[kind];
  const n = Math.round(seconds * sampleRate);
  const tail = Math.round(Math.min(0.35, seconds * 0.05) * sampleRate);
  const gen = GENERATORS[kind];
  const chans = [0, 1].map((ch) =>
    foldLoop(gen(n, n + tail, sampleRate, mulberry32(seed + ch * 7919), mulberry32(seed ^ 0x5bf03635)), n, tail));
  normalise(chans, kind);
  return chans;
}

/** Rough byte cost of a baked bed - the Atmosphere panel uses it to keep an eye on
 *  how much PCM the enabled layers are holding. */
export function ambienceBytes(kind: AmbienceKind, sampleRate: number): number {
  return Math.round(AMBIENCE_SECONDS[kind] * sampleRate) * 2 * 4;
}
