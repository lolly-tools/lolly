// SPDX-License-Identifier: MPL-2.0
/**
 * Ocean waves on a sandy shore (engine/src/lofi-waves-notes.ts says what a `wave` note
 * holds): Noosacore's texture, and any style's when a person turns the waves on. Lolly ships
 * no recordings, so this is a model of how the sound is made, driven by a seed: the same
 * seed always gives the same bytes, and no two waves of a tune are alike.
 *
 * A wave breaking is several things heard at once, each modelled on its own:
 * - The swell: the wave's rumble as it steepens and starts to spill, low and rising for the
 *   last seconds before it breaks (noise under a few hundred hertz, growing).
 * - The break: the crest falling over. A turbulent mass of water (pink noise darkened above
 *   a kilohertz, brighter while it is loudest) and the air it traps, which rings as bubbles.
 *   A plunging wave hits the water with a thump; a spilling one rolls in more softly.
 * - The foam: the white water running up the sand, a hiss of bubbles bursting (each a
 *   decaying whistle at its own Minnaert frequency, after van den Doel, 2005), thinning as it
 *   spreads and slows.
 * - The backwash: the water draining back through the sand, a quieter, brighter fizz that
 *   rises as the uprush stops and fades as the beach drains.
 * - The front: a wave does not break all at once. It breaks at one end and the break runs
 *   along the beach, so the model sums several stretches of the front, each breaking a little
 *   after the last and placed across the stereo field, which gives the left-to-right sweep
 *   and the low correlation between the channels that a spaced pair of microphones hears.
 * - Distance: a wave further off is quieter, duller (the air takes its top), slower to rise,
 *   narrower and more alike in both ears.
 *
 * The shore itself is a sound of its own: the roar of the waves breaking further along the
 * beach, low and steady, rising and falling a few decibels as distant sets come in. The
 * composers play it as a short swell, never a bed under the tune.
 *
 * Fitted against field recordings from Freesound (CC0, measured only; no recording is in
 * this repository): Gulf Shores, Alabama, medium surf (852736); an Australian beach at night
 * (790720); Gylly Beach, Falmouth, from the wash (470647, 470648); South Wollongong beach
 * (110123); Heceta Beach, Oregon, the shore's roar from the dunes (792315). Each model render
 * and each recording was measured with the same code: the waves' period and how irregular it
 * is, how far each wave rises over the trough, how fast it breaks and fades, the spectrum at
 * the break and in the trough, and the correlation and balance between the channels. The
 * numbers are in docs/generated-music.md.
 *
 * Pure until the player at the end, the only part that touches an audio context.
 */
import { readWave, WAVE_SWELL } from '../../../../engine/src/lofi-waves-notes.ts';
import { bedLoop, Biquad, mix, seamless, seeded, swellGain, type Stereo } from './lofi-nature.ts';
import { sheOaks } from './lofi-sheoaks.ts';

// ── sources ─────────────────────────────────────────────────────────────────

/** Pink-ish noise (Paul Kellet's economy filter over white), about unit level. */
class Pink {
  private p0 = 0; private p1 = 0; private p2 = 0;
  private readonly r: () => number;
  constructor(r: () => number) { this.r = r; }
  next(): number {
    const w = this.r() * 2 - 1;
    this.p0 = 0.99765 * this.p0 + w * 0.099;
    this.p1 = 0.963 * this.p1 + w * 0.2965;
    this.p2 = 0.57 * this.p2 + w * 1.0526;
    return (this.p0 + this.p1 + this.p2 + w * 0.1848) * 0.25;
  }
}

/** Samples between envelope and filter updates. */
const BLOCK = 32;

/**
 * Bubbles into `out`: each a whistle at its Minnaert frequency that dies away in a few
 * milliseconds, rung as a two-pole resonator so a bubble costs two multiplies a sample.
 * `rate(t)` is how many a second start at time t (s), `band` the range of their pitches
 * (Hz, drawn evenly in log frequency, so small bubbles are as common as big ones in the band).
 */
function bubbles(out: Float32Array, sr: number, r: () => number, rate: (block: number) => number, band: readonly [number, number], gain: number): void {
  const step = BLOCK / sr;
  const lo = Math.log(band[0]), hi = Math.log(band[1]);
  for (let b = 0; b * BLOCK < out.length; b++) {
    let expect = rate(b) * step;
    while (expect > 0) {
      if (r() >= expect) break;
      expect -= 1;
      const f0 = Math.exp(lo + r() * (hi - lo));
      // A smaller bubble rings higher, dies sooner and is quieter.
      const tau = Math.min(0.01, 2 / f0 + 0.0006);
      const w = (2 * Math.PI * f0) / sr;
      const fall = Math.exp(-1 / (tau * sr));
      const c1 = 2 * fall * Math.cos(w), c2 = -fall * fall;
      let y1 = gain * (0.35 + r() * 0.65) * Math.sqrt(1000 / f0) * Math.sin(w), y2 = 0;
      const start = b * BLOCK + Math.floor(r() * BLOCK);
      const n = Math.min(out.length - start, Math.ceil(tau * 4.6 * sr));
      for (let i = 0; i < n; i++) {
        out[start + i] = out[start + i]! + y1;
        const y = c1 * y1 + c2 * y2;
        y2 = y1; y1 = y;
      }
    }
  }
}

// ── one wave ────────────────────────────────────────────────────────────────

/** By size (small, medium, big, the set's biggest): how long the break takes to rise, how long the crest spills before it, the body's and the foam's fall (s), the uprush, the backwash, and the level. */
const SIZES = {
  attack: [0.08, 0.11, 0.15, 0.2],
  spill: [0.9, 1.1, 1.3, 1.5],
  body: [0.7, 0.95, 1.2, 1.45],
  foam: [0.8, 1, 1.2, 1.4],
  uprush: [1.3, 1.7, 2.1, 2.5],
  backwash: [1.5, 2, 2.5, 2.9],
  level: [0.7, 0.84, 1, 1.12],
} as const;
/** By distance (edge, near, bank, far): level, the air's top cut (Hz), how wide the front spreads, how alike the ears are, how many bubbles carry, how much foam against the body, and how fast the foam goes. */
const DISTANCES = {
  level: [1, 0.72, 0.48, 0.3],
  top: [15000, 10000, 3600, 1900],
  width: [0.95, 0.82, 0.6, 0.42],
  common: [0, 0.12, 0.3, 0.45],
  bubbles: [1, 0.6, 0.28, 0.1],
  foam: [1.5, 1, 0.75, 0.55],
  quick: [0.65, 1, 1.1, 1.2],
} as const;

/** How long a wave's buffer is (s): the swell, the break running along the front, the uprush and the backwash, and a little ring. */
export function waveSeconds(size: number): number {
  const s = Math.max(0, Math.min(3, size));
  return WAVE_SWELL[s]! + 0.9 + SIZES.uprush[s]! * 1.15 + SIZES.backwash[s]! * 1.15 + 0.6;
}

/** One stretch of a wave's front: when it breaks (s), and how much of it each channel hears. */
interface Stretch { tb: number; left: number; right: number }

/**
 * One wave breaking: `size` and `distance` as a wave note's (0 to 3 each), `seed` the take.
 * The wave breaks WAVE_SWELL[size] seconds in. Stereo, the loudest about 0.5 for a big wave
 * at the water's edge.
 */
export function waveBreak(sr: number, size: number, distance: number, seed: number): Stereo {
  const s = Math.max(0, Math.min(3, Math.floor(size)));
  const d = Math.max(0, Math.min(3, Math.floor(distance)));
  const r = seeded(mix(seed, s, d, 0x3a7e));
  const vary = (x: number, by = 0.15): number => x * (1 + (r() * 2 - 1) * by);
  const n = Math.ceil(waveSeconds(s) * sr);
  const plunge = r() < [0.15, 0.3, 0.45, 0.6][s]!;
  const far = 1 + d * 0.25;
  const swell = WAVE_SWELL[s]!;
  const attack = vary(SIZES.attack[s]!) * (1 + d * 0.15) * (plunge ? 0.65 : 1);
  const spill = Math.min(swell - 0.2, vary(SIZES.spill[s]!) * far * (plunge ? 0.8 : 1));
  const bodyFall = vary(SIZES.body[s]!) * far;
  const foamFall = vary(SIZES.foam[s]!) * DISTANCES.quick[d]!;
  const uprush = vary(SIZES.uprush[s]!);
  const backLen = vary(SIZES.backwash[s]!);
  const backLevel = 0.34 + r() * 0.2;
  const bright = vary(1, 0.2);
  // The front: three to five stretches, breaking one after another along the beach.
  const count = 3 + (r() < 0.5 ? 1 : 0) + (s >= 2 ? 1 : 0);
  const gap = vary(0.05 + s * 0.03, 0.4) * far;
  const width = DISTANCES.width[d]! * (0.75 + r() * 0.25);
  const leftFirst = r() < 0.5;
  const stretches: Stretch[] = [];
  for (let p = 0; p < count; p++) {
    const k = count > 1 ? p / (count - 1) : 0.5;
    const pan = Math.max(-1, Math.min(1, (leftFirst ? k * 2 - 1 : 1 - k * 2) * width + (r() * 2 - 1) * 0.08));
    const gain = vary(1 - Math.abs(k - 0.5) * 0.5, 0.2) / Math.sqrt(count);
    stretches.push({ tb: swell + p * gap * vary(1, 0.3), left: gain * Math.cos(((pan + 1) * Math.PI) / 4), right: gain * Math.sin(((pan + 1) * Math.PI) / 4) });
  }
  /** A stretch's envelopes at time t: the body's roar, the foam's hiss and the backwash's fizz. */
  const at = (t: number, tb: number): [number, number, number] => {
    if (t < tb) {
      // The swell's rumble grows; then the crest starts to spill and the wave builds into the break.
      const from = tb - spill;
      if (t < from) return [0.2 * Math.max(0, t / from) ** 2, 0, 0];
      const v = (t - from) / spill;
      let body = 0.2 + 0.35 * v ** 1.8, foam = 0.4 * v ** 2.5;
      if (t > tb - attack) {
        const w = (t - (tb - attack)) / attack;
        const shape = w * w * (3 - 2 * w);
        body += (1 - body) * shape;
        foam += (0.85 - foam) * shape;
      }
      return [body, foam, 0];
    }
    // The body falls away and the foam runs on; the uprush slows and stops, and the backwash drains.
    const since = t - tb;
    let body = 0.05 + 0.95 * Math.exp(-since / bodyFall);
    const foam = Math.exp(-since / foamFall) * Math.min(1, 0.85 + since * 1.9);
    if (since > uprush) body *= Math.exp(-(since - uprush) / 0.6);
    const bw = since - uprush * 0.8;
    const back = bw > 0 ? backLevel * Math.min(1, bw / 0.5) * Math.max(0, 1 - bw / backLen) ** 1.4 : 0;
    return [body, foam, back];
  };
  // Each channel's envelopes, block by block: the sum of the stretches it hears.
  const steps = Math.ceil(n / BLOCK) + 1;
  const env = [0, 1].map(() => ({ body: new Float32Array(steps), foam: new Float32Array(steps), back: new Float32Array(steps) }));
  for (let b = 0; b < steps; b++) {
    const t = (b * BLOCK) / sr;
    for (const st of stretches) {
      const [body, foam, back] = at(t, st.tb);
      env[0]!.body[b] = env[0]!.body[b]! + body * st.left; env[1]!.body[b] = env[1]!.body[b]! + body * st.right;
      env[0]!.foam[b] = env[0]!.foam[b]! + foam * st.left; env[1]!.foam[b] = env[1]!.foam[b]! + foam * st.right;
      env[0]!.back[b] = env[0]!.back[b]! + back * st.left; env[1]!.back[b] = env[1]!.back[b]! + back * st.right;
    }
  }
  // The channels' noise: mostly their own, part shared (the nearest water, heard by both).
  const shared = new Pink(seeded(mix(seed, s, d, 0x5a3e)));
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const sh = new Float32Array(n);
  for (let i = 0; i < n; i++) sh[i] = shared.next();
  const foamGain = DISTANCES.foam[d]!;
  let peakEnv = 1e-6;
  for (const e of env) for (const v of e.body) if (v > peakEnv) peakEnv = v;
  for (let ch = 0; ch < 2; ch++) {
    const pr = seeded(mix(seed, s, d, ch, 0xf00a));
    const pinkA = new Pink(pr), pinkB = new Pink(pr);
    const lowHp = new Biquad(sr).set('hp', 60, 0.6), lowLp = new Biquad(sr);
    const hissHp = new Biquad(sr), hissLp = new Biquad(sr).set('lp', 9000 * bright, 0.6);
    const backHp = new Biquad(sr).set('hp', 1800, 0.7);
    const e = env[ch]!, o = out[ch]!;
    for (let b = 0; b * BLOCK < n; b++) {
      const tone = Math.min(1, Math.max(e.body[b]!, e.foam[b]!) / peakEnv);
      lowLp.set('lp', (300 + 900 * tone ** 0.8) * bright, 0.62);
      const hpF = 900 + 700 * (1 - Math.min(1, e.foam[b]! / peakEnv));
      hissHp.set('hp', hpF, 0.9);
      const b0 = e.body[b]!, b1 = e.body[b + 1]!, f0 = e.foam[b]!, f1 = e.foam[b + 1]!, k0 = e.back[b]!, k1 = e.back[b + 1]!;
      const end = Math.min(n, (b + 1) * BLOCK);
      for (let i = b * BLOCK; i < end; i++) {
        const u = (i % BLOCK) / BLOCK;
        const x = pinkA.next() * 0.85 + sh[i]! * 0.5;
        const w = pinkB.next() * 0.85 + sh[i]! * 0.5;
        const body = lowLp.run(lowHp.run(x)) * (b0 + (b1 - b0) * u) * 1.6;
        const hiss = hissLp.run(hissHp.run(w)) * (f0 + (f1 - f0) * u) * 0.68 * foamGain;
        const back = backHp.run(w) * (k0 + (k1 - k0) * u) * 0.9;
        o[i] = body + hiss + back;
      }
    }
    // The foam's bubbles and the backwash's fizz, denser on a nearer wave.
    const bub = DISTANCES.bubbles[d]! * (0.6 + (0.4 * s) / 3);
    bubbles(o, sr, pr, (b) => bub * (520 * e.foam[b]! + 800 * e.back[b]!), [700, 7500], 0.0065);
  }
  // A plunging wave hits the water: a low thump as the lip hits the water, where the front first breaks.
  if (plunge && d <= 1) {
    const first = stretches[0]!;
    const start = Math.floor(first.tb * sr);
    const tr = seeded(mix(seed, s, d, 0x7a3b));
    const f = 42 + tr() * 26;
    const amp = 0.5 * (0.6 + s * 0.2) * (d ? 0.6 : 1) / Math.sqrt(count);
    const thumpLp = new Biquad(sr).set('lp', 180, 0.7);
    const noise = new Pink(tr);
    for (let i = 0; i < 0.6 * sr && start + i < n; i++) {
      const u = i / sr;
      const v = amp * (Math.sin(2 * Math.PI * f * u) * Math.exp(-u / 0.13) * 0.6 + thumpLp.run(noise.next()) * Math.exp(-u / 0.09) * 2.4);
      out[0][start + i] = out[0][start + i]! + v * first.left;
      out[1][start + i] = out[1][start + i]! + v * first.right;
    }
  }
  return finish(out, sr, d, SIZES.level[s]! * DISTANCES.level[d]! * 0.27);
}

/** Distance's last touches: the air's top cut, the ears made a little alike, and the level; the start and end eased. */
function finish([L, R]: Stereo, sr: number, d: number, level: number): Stereo {
  const c = DISTANCES.common[d]!;
  const top = DISTANCES.top[d]!;
  const fl = [new Biquad(sr).set('lp', top, 0.7), new Biquad(sr).set('lp', top, 0.7)];
  const n = L.length;
  const edge = Math.min(n >> 2, Math.round(0.05 * sr));
  for (let i = 0; i < n; i++) {
    const m = (L[i]! + R[i]!) * 0.5;
    const ease = Math.min(1, i / edge, (n - 1 - i) / edge);
    L[i] = fl[0]!.run(L[i]! * (1 - c) + m * c) * level * ease;
    R[i] = fl[1]!.run(R[i]! * (1 - c) + m * c) * level * ease;
  }
  return [L, R];
}

// ── the shore ───────────────────────────────────────────────────────────────

/**
 * The shore's roar for `seconds`: the waves breaking further along the beach, too many and
 * too far to hear apart. Pink noise darkened above a kilohertz and a half and thinned below
 * two hundred hertz, with a faint hiss of distant foam, rising and falling a few decibels as the sets
 * come in along the beach, each set from its own place across the field. Fitted to the roar
 * heard from the dunes (Heceta Beach, 792315) and at dawn (826440): a broad hump from 250 Hz to
 * 1 kHz, falling about 6 dB an octave above 1 kHz.
 */
export function shoreBed(sr: number, seconds: number, seed: number): Stereo {
  const r = seeded(mix(seed, 0x5407e));
  const n = Math.ceil(seconds * sr);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  // The swells of the distant sets: soft bumps at irregular gaps, each panned.
  const steps = Math.ceil(n / BLOCK) + 1;
  const swellL = new Float32Array(steps).fill(0.5), swellR = new Float32Array(steps).fill(0.5);
  for (let set = 0; set < 4; set++) {
    const pan = r() * 2 - 1;
    let t = -r() * 8;
    while (t < seconds + 6) {
      const rise = 1.4 + r() * 1.4, fall = 2.6 + r() * 2.6, height = 0.3 + r() * 0.5;
      for (let b = 0; b < steps; b++) {
        const u = (b * BLOCK) / sr - t;
        if (u < -rise || u > fall * 4) continue;
        const e = u < 0 ? (1 + u / rise) ** 2 : Math.exp(-u / fall);
        swellL[b] = swellL[b]! + height * e * (1 - pan) * 0.5;
        swellR[b] = swellR[b]! + height * e * (1 + pan) * 0.5;
      }
      t += 5 + r() * 9;
    }
  }
  const shared = new Pink(seeded(mix(seed, 0x5407f)));
  const common = new Float32Array(n);
  for (let i = 0; i < n; i++) common[i] = shared.next();
  for (let ch = 0; ch < 2; ch++) {
    const own = new Pink(seeded(mix(seed, 0x54080 + ch)));
    const hp = new Biquad(sr).set('hp', 190, 0.5);
    const lp = new Biquad(sr).set('lp', 1600, 0.6);
    const hissHp = new Biquad(sr).set('hp', 2200, 0.7), hissLp = new Biquad(sr).set('lp', 4800, 0.7);
    const sw = ch ? swellR : swellL;
    const o = out[ch]!;
    for (let i = 0; i < n; i++) {
      const b = Math.floor(i / BLOCK), u = (i % BLOCK) / BLOCK;
      const level = sw[b]! + (sw[b + 1]! - sw[b]!) * u;
      const x = own.next() * 0.75 + common[i]! * 0.5;
      o[i] = (lp.run(hp.run(x)) + hissLp.run(hissHp.run(x)) * 0.32) * level * 1.5;
    }
  }
  return out;
}

// ── played ──────────────────────────────────────────────────────────────────

/**
 * A wave's level against the place's other sounds, and the shore's (the shore sits about 10 dB
 * under a wave's peak, as on the recordings). Brought down 4 dB (Andy, 2026-11-15: the waves
 * were "too strong"), so a wave sits behind the groove and its distance does more of the work.
 */
const WAVE_LEVEL = 1;
const SHORE_LEVEL = 0.067;
/** The she-oaks' breeze against the waves (lib/lofi-sheoaks.ts): in front in the quiet sections, soft beside the sea. */
const DUNES_LEVEL = 0.5;
/** The cicadas' level at the top of their swell: botanica's insects bed level (lib/lofi-nature.ts). */
const CICADA_LEVEL = 0.45;
/** The share of the context's rate a wave is made at: its sound lies below about 15 kHz, and three quarters of 44.1 kHz holds that for a quarter less work. */
export const WAVE_RATE = 0.75;
/** How long the shore's loop is (s), and the share of the context's rate it is made at (the roar lies below about 7 kHz). */
export const SHORE_LOOP = 20;
const SHORE_RATE = 0.5;

/** The waves rendered so far, per context: a tune's are kept while it plays, then dropped. */
const MADE = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
function made(ctx: BaseAudioContext, key: string, make: () => Stereo, rate = ctx.sampleRate): AudioBuffer {
  let cache = MADE.get(ctx);
  if (!cache) { cache = new Map(); MADE.set(ctx, cache); }
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 48) cache.clear();
    const [l, r] = make();
    buf = ctx.createBuffer(2, l.length, rate);
    buf.getChannelData(0).set(l);
    buf.getChannelData(1).set(r);
    cache.set(key, buf);
  }
  return buf;
}

/**
 * Play a `wave` note: a wave breaking WAVE_SWELL[size] seconds after `t`, or a swell over the
 * note's `seconds` of the shore's roar, the she-oaks' breeze or cicadas (botanica's cicada,
 * lib/lofi-nature.ts): rising slowly, held a moment and falling away to nothing. `tune` is the tune's seed and `take`
 * tells the note from the tune's others.
 */
export function playWave(ctx: BaseAudioContext, out: AudioNode, t: number, vel: number, seconds: number, mod: number, tune: number, take: number): void {
  const w = readWave(mod);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  if (w.kind === 'break') {
    const rate = Math.round(ctx.sampleRate * WAVE_RATE);
    src.buffer = made(ctx, `wave|${tune}|${w.take}|${w.size}|${w.distance}`, () => waveBreak(rate, w.size, w.distance, mix(tune, w.take)), rate);
    gain.gain.value = WAVE_LEVEL * vel;
    src.connect(gain).connect(out);
    src.start(t);
    return;
  }
  if (w.kind === 'cicadas') {
    src.buffer = bedLoop(ctx, 'insects', tune, w.take, 'cicada');
    src.loop = true;
    swellGain(gain.gain, t, seconds, CICADA_LEVEL * vel);
    src.connect(gain).connect(out);
    src.start(t, ((take * 3571) % 1000) / 1000 * 9.5);
    src.stop(t + Math.max(0.5, seconds) + 0.05);
    return;
  }
  const rate = Math.round(ctx.sampleRate * SHORE_RATE);
  const dunes = w.kind === 'dunes';
  src.buffer = dunes
    ? made(ctx, `dunes|${tune}|${w.take % 2}`, () => seamless(sheOaks(rate, SHORE_LOOP + 1, mix(tune, w.take % 2, 0x5e)), rate, 1), rate)
    : made(ctx, `shore|${tune}|${w.take % 2}`, () => seamless(shoreBed(rate, SHORE_LOOP + 1, mix(tune, w.take % 2, 0x54)), rate, 1), rate);
  src.loop = true;
  // A moment, not a bed: the roar or the breeze swells in slowly, holds a moment and falls away.
  swellGain(gain.gain, t, seconds, (dunes ? DUNES_LEVEL : SHORE_LEVEL) * vel);
  src.connect(gain).connect(out);
  src.start(t, (((take * 7919) % 1000) / 1000) * (SHORE_LOOP - 0.1));
  src.stop(t + seconds + 0.05);
}
