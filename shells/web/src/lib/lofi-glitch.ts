// SPDX-License-Identifier: MPL-2.0
/**
 * Botanica's glitches (engine/src/lofi-botanica.ts): the digital, weathered edge laid over
 * its organic sounds. Each works on the tune's own material, a note of one of Lolly's
 * instruments or a bird's phrase, rendered as lib/lofi-grains.ts renders a pad's source:
 *
 * - bitcrush: fewer levels per sample, the quantising noise of an old sampler or console;
 * - downsample: a lower sample rate, each sample held until the next (its images alias
 *   back down as a metallic edge);
 * - stutter: a slice repeated, each repeat stepping in pitch, as a sampler retriggered;
 * - freeze: one moment's spectrum held still, every frame its magnitudes with new phases,
 *   so a chord hangs and shimmers;
 * - reverse, crushed a little; and a tape stop, the note slowing to nothing.
 *
 * And a repeat of the whole mix (BeatRepeat): the last slice caught in a delay line and
 * looped for the note's length, as a beat repeater does, the live mix gated off meanwhile.
 *
 * The console's sounds (the sparkle and the bleeps) are lib/lofi-voices.ts's own, written
 * by the composer as their own notes. Pure, apart from the players at the end.
 */
import { BOTANICA_MATERIAL_BIRD, BOTANICA_REPEAT_DIVISIONS, BOTANICA_SOURCES, readGlitch, type BotanicaGlitch } from '../../../../engine/src/lofi-botanica.ts';
import { birdPhrase, mix, seeded } from './lofi-nature.ts';
import { padRate, sourceOf } from './lofi-grains.ts';

// ── the processes ────────────────────────────────────────────────────────────

/** `x` quantised to `bits` bits: 2^bits levels across -1 to 1. */
export function bitcrush(x: Float32Array, bits: number): Float32Array {
  const q = 2 ** (Math.max(1, bits) - 1);
  return x.map(v => Math.round(v * q) / q);
}

/** `x` at a rate `factor` times lower: each sample held until the next is taken (a fractional factor holds unevenly, as cheap converters did). */
export function downsample(x: Float32Array, factor: number): Float32Array {
  const out = new Float32Array(x.length);
  let held = 0, acc = factor - 1;
  for (let i = 0; i < x.length; i++) {
    acc += 1;
    if (acc >= factor) { acc -= factor; held = x[i]!; }
    out[i] = held;
  }
  return out;
}

/** `x` read backwards. */
export function reversed(x: Float32Array): Float32Array { return x.slice().reverse(); }

/** Read `x` at a changing rate (`rate(i)` samples of `x` for each output sample), `n` samples long, by linear interpolation. */
function resample(x: Float32Array, n: number, rate: (i: number) => number, from = 0): Float32Array {
  const out = new Float32Array(n);
  let pos = from;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(pos), u = pos - k;
    if (k + 1 >= x.length) break;
    out[i] = x[k]! * (1 - u) + x[k + 1]! * u;
    pos += rate(i);
  }
  return out;
}

/**
 * A stutter: the slice of `x` from `from` (samples), `slice` samples long, played
 * `repeats` times back to back, each repeat `step` semitones from the last and with a
 * short fade at its ends so the cuts click no more than a sampler's do.
 */
export function stutter(x: Float32Array, sr: number, from: number, slice: number, repeats: number, step = 0): Float32Array {
  const out = new Float32Array(slice * repeats);
  const edge = Math.min(Math.round(0.002 * sr), Math.floor(slice / 4));
  for (let k = 0; k < repeats; k++) {
    const rate = 2 ** ((step * k) / 12);
    const piece = resample(x, slice, () => rate, from);
    for (let i = 0; i < slice; i++) {
      const g = Math.min(1, i / Math.max(1, edge), (slice - 1 - i) / Math.max(1, edge));
      out[k * slice + i] = piece[i]! * g;
    }
  }
  return out;
}

/** A tape stop: `x` slowing from its own speed to nothing over `n` samples, the pitch falling with it. */
export function tapeStop(x: Float32Array, n: number): Float32Array {
  return resample(x, n, i => Math.max(0, 1 - i / n) ** 1.5);
}

/** An in-place radix-2 FFT (re and im of length a power of two); `inverse` for the inverse, unscaled. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci, ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr; im[b] = im[a]! - ti;
        re[a] = re[a]! + tr; im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/**
 * A spectral freeze: the magnitudes of the `size`-sample frame of `x` at `at` (samples),
 * held for `n` samples. Every quarter frame a new frame is made from those magnitudes with
 * random phases (from `seed`) and overlapped under a Hann window, so the moment hangs
 * without repeating. Its loudness matches the frame's. At most `loop` samples are made
 * this way; a longer freeze repeats them, crossfaded, which a still spectrum hides.
 */
export function spectralFreeze(x: Float32Array, at: number, n: number, seed: number, size = 4096, loop = 1 << 16): Float32Array {
  if (n > loop + size) {
    const piece = spectralFreeze(x, at, loop + size, seed, size, Infinity);
    const out = new Float32Array(n);
    const fade = size;
    for (let i = 0; i < n; i++) {
      const k = i % loop;
      // Each pass starts by fading from the last one's tail into the head, a frame long.
      out[i] = i >= loop && k < fade ? piece[k]! * (k / fade) + piece[loop + k]! * (1 - k / fade) : piece[k]!;
    }
    const edge = Math.min(Math.round(n / 4), 4096);
    for (let i = 0; i < edge; i++) out[n - 1 - i] = out[n - 1 - i]! * (i / edge);
    return out;
  }
  const r = seeded(mix(seed, 0xf2e));
  const re = new Float64Array(size), im = new Float64Array(size);
  const hann = (i: number): number => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  let frameEnergy = 0;
  for (let i = 0; i < size; i++) {
    const v = (x[at + i] ?? 0) * hann(i);
    re[i] = v;
    frameEnergy += v * v;
  }
  fft(re, im);
  const mag = new Float64Array(size / 2 + 1);
  for (let k = 0; k <= size / 2; k++) mag[k] = Math.hypot(re[k]!, im[k]!);
  const hop = size / 4;
  const out = new Float32Array(n + size);
  for (let start = 0; start < n; start += hop) {
    re.fill(0); im.fill(0);
    for (let k = 1; k < size / 2; k++) {
      const ph = r() * 2 * Math.PI;
      re[k] = mag[k]! * Math.cos(ph); im[k] = mag[k]! * Math.sin(ph);
      re[size - k] = re[k]!; im[size - k] = -im[k]!;
    }
    fft(re, im, true);
    for (let i = 0; i < size; i++) out[start + i] = out[start + i]! + (re[i]! / size) * hann(i);
  }
  const result = out.subarray(size / 2, size / 2 + n).slice();
  // Bring it to the frame's loudness (a Hann-windowed frame loses three eighths of the energy).
  let e = 0;
  for (const v of result) e += v * v;
  const want = Math.sqrt(frameEnergy / (size * 0.375));
  const got = Math.sqrt(e / Math.max(1, result.length));
  const g = got > 1e-9 ? want / got : 0;
  for (let i = 0; i < result.length; i++) result[i] = result[i]! * g;
  const fade = Math.min(Math.round(n / 4), 4096);
  for (let i = 0; i < fade; i++) { const u = i / fade; result[i] = result[i]! * u; result[n - 1 - i] = result[n - 1 - i]! * u; }
  return result;
}

/** A glitch of `kind` made from `material`, `n` samples long, its choices from `seed`. */
export function glitch(kind: Exclude<BotanicaGlitch, 'repeat'>, material: Float32Array, sr: number, n: number, seed: number): Float32Array {
  const r = seeded(mix(seed, 0x611));
  const onset = Math.round(0.01 * sr);
  switch (kind) {
    case 'stutter': {
      const repeats = [4, 6, 8][Math.floor(r() * 3)]!;
      const slice = Math.max(Math.round(0.02 * sr), Math.floor(n / repeats));
      return stutter(material, sr, onset, slice, repeats, r() < 0.5 ? 0 : r() < 0.5 ? -1 : 2);
    }
    case 'crush': return bitcrush(downsample(material.subarray(0, n), 3 + Math.floor(r() * 6)), 4 + Math.floor(r() * 3));
    case 'freeze': return spectralFreeze(material, Math.round(0.18 * sr), n, seed);
    case 'reverse': {
      const piece = material.slice(0, n);
      const fade = Math.min(n, Math.round(0.03 * sr));
      for (let i = 0; i < fade; i++) piece[n - 1 - i] = piece[n - 1 - i]! * (i / fade);
      return bitcrush(reversed(piece), 8);
    }
    default: return tapeStop(material, n);
  }
}

// ── played ───────────────────────────────────────────────────────────────────

const GLITCHES = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
/** Each glitch's level against the pads. */
const GLITCH_LEVEL: Record<Exclude<BotanicaGlitch, 'repeat'>, number> = { stutter: 0.8, crush: 0.6, freeze: 0.7, reverse: 0.75, tape: 0.8 };

/**
 * Play a `glitch` note that works on material: the tune's source note (or a bird's phrase)
 * at `midi`, processed and played for `seconds`. A repeat is the station's (see BeatRepeat).
 */
export function playGlitch(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel: number, seconds: number, mod: number, tune: number, take: number): void {
  const { kind, material } = readGlitch(mod);
  if (kind === 'repeat') return;
  const sr = padRate(ctx);
  let cache = GLITCHES.get(ctx);
  if (!cache) { cache = new Map(); GLITCHES.set(ctx, cache); }
  const length = Math.round(seconds * 20) / 20;
  const variant = take % 3;
  const key = `${kind}|${material}|${midi}|${length}|${tune}|${variant}`;
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 80) cache.clear();
    const n = Math.max(1, Math.round(length * sr));
    const source = material === BOTANICA_MATERIAL_BIRD
      ? birdPhrase(sr, 'robin', Math.max(1, length + 0.3), mix(tune, variant))
      : sourceOf(ctx, BOTANICA_SOURCES[material] ?? 'piano', midi, tune).data;
    const made = glitch(kind, source, sr, n, mix(tune, midi, variant, kind.length));
    buf = ctx.createBuffer(1, made.length, sr);
    buf.getChannelData(0).set(made);
    cache.set(key, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = GLITCH_LEVEL[kind] * vel;
  const pan = ctx.createStereoPanner();
  pan.pan.value = ((take * 0.37) % 1) * 1.2 - 0.6;
  src.connect(gain).connect(pan).connect(out);
  src.start(t);
}

/**
 * A beat repeater on the whole mix, between `from` and `to`: the mix runs through a gate,
 * and a delay line hears it too. A repeat closes the gate and turns the delay's output
 * back into its input, so its last slice loops; at the end the gate opens again. Built
 * only when a tune first repeats, so a station that never does is wired as before.
 */
export class BeatRepeat {
  private readonly gate: GainNode;
  private readonly feed: GainNode;
  private readonly loop: GainNode;
  private readonly wet: GainNode;
  private readonly delay: DelayNode;
  constructor(ctx: BaseAudioContext, from: AudioNode, to: AudioNode) {
    from.disconnect(to);
    this.gate = ctx.createGain();
    this.feed = ctx.createGain();
    this.loop = ctx.createGain();
    this.wet = ctx.createGain();
    this.delay = ctx.createDelay(2);
    this.loop.gain.value = 0;
    this.wet.gain.value = 0;
    from.connect(this.gate).connect(to);
    from.connect(this.feed).connect(this.delay);
    this.delay.connect(this.wet).connect(to);
    this.delay.connect(this.loop).connect(this.delay);
  }

  /** Loop the mix's last `slice` seconds from `t` for `seconds`. */
  repeat(t: number, slice: number, seconds: number): void {
    const edge = 0.003;
    const end = t + seconds;
    this.delay.delayTime.setValueAtTime(Math.min(1.9, slice), Math.max(0, t - slice - 0.02));
    const cut = (p: AudioParam, at: number, to: number): void => { p.setValueAtTime(1 - to, at - edge); p.linearRampToValueAtTime(to, at); };
    cut(this.gate.gain, t, 0);
    cut(this.wet.gain, t, 1);
    this.feed.gain.setValueAtTime(1, t - edge);
    this.feed.gain.linearRampToValueAtTime(0, t);
    this.loop.gain.setValueAtTime(0, t - edge);
    this.loop.gain.linearRampToValueAtTime(1, t);
    cut(this.gate.gain, end, 1);
    cut(this.wet.gain, end, 0);
    this.feed.gain.setValueAtTime(0, end - edge);
    this.feed.gain.linearRampToValueAtTime(1, end);
    this.loop.gain.setValueAtTime(1, end - edge);
    this.loop.gain.linearRampToValueAtTime(0, end);
  }
}

/** A repeat note's slice (s): a beat divided by its division. */
export function repeatSlice(mod: number, spb: number): number {
  const { material } = readGlitch(mod);
  return spb / (BOTANICA_REPEAT_DIVISIONS[material] ?? 4);
}
