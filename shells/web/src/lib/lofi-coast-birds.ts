// SPDX-License-Identifier: MPL-2.0
/**
 * Two birds of the east coast's forests and gardens (engine/src/lofi-coast-birds.ts says what a
 * note holds): the eastern whipbird and the rainbow lorikeet, for Noosacore, for any style with
 * the Aussie birds turned on, and for any composer that wants them. Lolly ships no recordings,
 * so each is a model of how the bird makes the sound, driven by a seed: the same seed always
 * gives the same bytes. This module is separate from the magpie and the kookaburra
 * (lib/lofi-bush-birds.ts) and shares nothing with them.
 *
 * The whipbird pair calls as one bird. The male holds a pure whistle, a second or so near
 * 2 kHz with barely any harmonic, swelling and wavering a little; then a sweep from low under
 * it, slow at first and then near vertical, cracks into a burst of broadband noise up to about
 * 8 kHz that dies in a fifth of a second: the whip. A few hundredths of a second after the crack
 * the female answers with one or two quick "choo" notes, each a noisy whistle falling from about
 * 4.5 kHz to 1.5 kHz. The pair sits a little apart in the trees, and the forest rings after the
 * crack.
 *
 * A rainbow lorikeet's call is buzzy and shrill: a voice near 2 kHz rich in harmonics, its pitch
 * jumping and wobbling fast within the call, rough with noise, its energy between 2 and 8 kHz.
 * One bird screeches in calls of a few tenths of a second; a feeding flock in a tree tumbles over
 * itself in short chattering calls, several birds at once from different places in the tree; and
 * a flock flying over screeches as it comes, getting louder and brighter as it nears, crossing
 * the stereo field, and fading as it goes.
 *
 * Fitted against field recordings from Freesound and Wikimedia Commons (measured only; no
 * recording is in this repository), each measured with the same code as the model: for the
 * whipbird a male calling and a pair duetting at Terrey Hills (Freesound 361428, CC0), on the
 * Central Coast (486732, CC0) and in a forest (410519, CC0), at Mount Tamborine (Commons, CC BY
 * 4.0) and a public-domain recording on Commons; for the lorikeets a flock in a tree (593156,
 * CC0), birds at a feeder (75267, CC BY 4.0), a flock feeding on lilly pilly (385952, CC BY 3.0),
 * an aviary flock (401190, CC BY 4.0), and, for how a flock flying over comes and goes, corellas flying
 * past (388730, CC0). The numbers are in docs/generated-music.md.
 *
 * Pure until the player at the end, the only part that touches an audio context.
 */
import { readLorikeet, readWhipbird } from '../../../../engine/src/lofi-coast-birds.ts';
import { Biquad, mix, seeded, type Stereo } from './lofi-nature.ts';

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;
/** Samples between filter retunings. */
const BLOCK = 32;

/** A normal draw (Box-Muller). */
function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(TAU * r());
}

/**
 * A small room for a bird: the ring of a forest or a garden (a Schroeder reverberator, four
 * combs and two all-passes, each ear its own), darkened as leaves darken a room outdoors. Returns the wet
 * signal only; `seconds` is its time to fall 60 dB.
 */
function ring(input: Float32Array, sr: number, seconds: number, seed: number, top: number): Stereo {
  const r = seeded(mix(seed, 0x7149));
  const out: Stereo = [new Float32Array(input.length), new Float32Array(input.length)];
  for (let ch = 0; ch < 2; ch++) {
    const combs = [0.0297, 0.0371, 0.0411, 0.0437].map(base => {
      const n = Math.max(8, Math.round((base * (1 + (r() - 0.5) * 0.12)) * sr));
      return { buf: new Float32Array(n), at: 0, g: 10 ** ((-3 * n) / (sr * seconds)), lp: 0 };
    });
    const alls = [0.005, 0.0017].map(base => ({ buf: new Float32Array(Math.max(4, Math.round(base * (1 + r() * 0.2) * sr))), at: 0 }));
    const dark = new Biquad(sr).set('lp', top, 0.7);
    const o = out[ch]!;
    for (let i = 0; i < input.length; i++) {
      const x = input[i]!;
      let y = 0;
      for (const c of combs) {
        const d = c.buf[c.at]!;
        c.lp = d * 0.7 + c.lp * 0.3;
        c.buf[c.at] = x + c.lp * c.g;
        c.at = (c.at + 1) % c.buf.length;
        y += d;
      }
      for (const a of alls) {
        const d = a.buf[a.at]!;
        const v = y + d * 0.5;
        a.buf[a.at] = v;
        a.at = (a.at + 1) % a.buf.length;
        y = d - v * 0.5;
      }
      o[i] = dark.run(y * 0.25);
    }
  }
  return out;
}

/** Equal-power gains for a place across the field (-1 left, 1 right). */
const panGains = (pan: number): [number, number] => [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)];

// ── the whipbird ────────────────────────────────────────────────────────────

/** By distance (just inside the edge, in the trees, deep in the gully): level, the leaves' top cut (Hz), the forest's ring (s to fall 60 dB) and how much of the ring is heard. */
const WHIP_DISTANCE = { level: [1, 0.62, 0.36], top: [13000, 9000, 5500], ring: [0.4, 0.55, 0.8], wet: [0.2, 0.32, 0.5] } as const;

/** How long a whipbird pair's call is rendered for (s). */
export const WHIPBIRD_BUFFER = 4.6;

/**
 * One whipbird pair calling: the male's whistle near `midi`'s pitch cracking into the whip and,
 * when `answered`, the female's one or two falling "choo" notes. The crack comes at about
 * 0.3 s plus the whistle's length; returns the stereo call with the forest's ring.
 */
export function whipbird(sr: number, midi: number, seed: number, answered = true, distance = 1): Stereo {
  const d = Math.max(0, Math.min(2, Math.floor(distance)));
  const r = seeded(mix(seed, 0xa11b));
  const n = Math.ceil(WHIPBIRD_BUFFER * sr);
  const male = new Float32Array(n), female = new Float32Array(n);
  // The whistle: pure, swelling, wavering a little, its pitch drifting up to a semitone.
  const fw = mtof(midi) * (1 + (r() - 0.5) * 0.03);
  const whistle = 0.7 + r() * 0.9;
  const drift = (r() - 0.5) * 170;   // cents over the whistle
  const start = 0.3;
  const intro = r() < 0.3;
  const trem = 7 + r() * 5;
  let ph = r() * TAU;
  const at = (s: number): number => Math.round(s * sr);
  if (intro) {
    // A short note before some whistles, the same pitch.
    const a = at(start - 0.28), len = at(0.08 + r() * 0.06);
    for (let i = 0; i < len; i++) {
      ph += (TAU * fw) / sr;
      male[a + i] = Math.sin(ph) * Math.sin((Math.PI * i) / len) * 0.35;
    }
  }
  const w0 = at(start), wn = at(whistle);
  for (let i = 0; i < wn; i++) {
    const u = i / wn;
    const f = fw * 2 ** ((drift * u) / 1200);
    ph += (TAU * f) / sr;
    const swell = Math.min(1, i / (0.06 * sr)) * (0.55 + 0.45 * u ** 0.7) * (1 + 0.12 * Math.sin((TAU * trem * i) / sr) + 0.05 * gauss(r) * 0.2);
    const end = Math.min(1, (wn - i) / (0.012 * sr));
    male[w0 + i] = (Math.sin(ph) + 0.011 * Math.sin(2 * ph) + 0.003 * Math.sin(3 * ph)) * swell * end * 0.5;
  }
  // The crack: a sweep from under the whistle, slow then near vertical, into a burst of broadband noise.
  const sweepLen = 0.04 + r() * 0.03;
  const fLow = 700 + r() * 500, fTop = 6900 + r() * 1100;
  const c0 = w0 + wn + at(0.01);
  const sn = at(sweepLen);
  let sp = 0;
  for (let i = 0; i < sn; i++) {
    const u = i / sn;
    const f = fLow * (fTop / fLow) ** (u ** 3);
    sp += (TAU * f) / sr;
    male[c0 + i] = male[c0 + i]! + Math.sin(sp) * (0.25 + 0.75 * u) * 0.3;
  }
  const b0 = c0 + sn;
  const crack = 0.085 + r() * 0.07;   // the burst's fall (s, a time constant)
  const crackLen = at(0.45);
  // The burst's top edge is sharp: an eighth-order cut at the sweep's top (a Butterworth's four stages).
  const hp = new Biquad(sr).set('hp', 420, 0.7), body = new Biquad(sr);
  const tops = [0.51, 0.6, 0.9, 2.56].map(q => new Biquad(sr).set('lp', fTop, q));
  // The click at the top of the sweep: a millisecond of everything.
  for (let i = 0; i < at(0.0015); i++) male[b0 + i] = male[b0 + i]! + (r() * 2 - 1) * 0.3 * (1 - i / at(0.0015));
  // The burst: broadband, but with a body that falls from the top of the sweep, the sweep's own note ringing down inside the burst.
  let bp = sp;
  for (let i = 0; i < crackLen && b0 + i < n; i++) {
    const u = i / sr;
    const fall = fTop * (0.45 + 0.55 * Math.exp(-u / 0.05));
    if (i % BLOCK === 0) body.set('bp', fall * 0.6, 1.4);
    bp += (TAU * fall * 0.6) / sr;
    const env = Math.min(1, u / 0.004) * Math.exp(-u / crack);
    const x = r() * 2 - 1;
    let y = hp.run(x) * 0.75 + body.run(x) * 1.6;
    for (const f of tops) y = f.run(y);
    male[b0 + i] = male[b0 + i]! + y * env * 1.1 + Math.sin(bp) * 0.25 * Math.exp(-u / 0.03) * env;
  }
  // The female's answer: one or two notes, each a broad band of noise falling from about 5 kHz to
  // under 2 kHz with a sharp top edge, the first a few tenths of a second after the crack.
  if (answered) {
    const notes = r() < 0.5 ? 1 : r() < 0.9 ? 2 : 3;
    let t = (b0 - at(0.01)) / sr + 0.22 + r() * 0.24;
    for (let k = 0; k < notes; k++) {
      const len = 0.2 + r() * 0.12;
      const fa = 4300 + r() * 1000, fb = 1800 + r() * 600;
      const a = at(t), m = at(len);
      const band = new Biquad(sr), edges = [0.54, 1.31].map(() => new Biquad(sr)), floor = new Biquad(sr).set('hp', 900, 0.7);
      let p = r() * TAU;
      for (let i = 0; i < m && a + i < n; i++) {
        const u = i / m;
        const f = fa * (fb / fa) ** (u ** 0.7);
        if (i % BLOCK === 0) { band.set('bp', f, 0.5); edges[0]!.set('lp', f * 1.6, 0.54); edges[1]!.set('lp', f * 1.6, 1.31); }
        p += (TAU * f) / sr;
        const env = Math.min(1, (u * len) / 0.012) * (u < 0.55 ? 1 : (1 - (u - 0.55) / 0.45) ** 1.5);
        female[a + i] = female[a + i]! + (edges[1]!.run(edges[0]!.run(floor.run(band.run(r() * 2 - 1)))) * 2.4 + Math.sin(p) * 0.12) * env * 0.6;
      }
      t += len + 0.15 + r() * 0.2;
    }
  }
  // The pair a little apart in the trees, and the forest ringing after them.
  const pm = (r() - 0.5) * 0.7, pf = Math.max(-0.9, Math.min(0.9, pm + (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.35)));
  const [ml, mr] = panGains(pm), [fl, frr] = panGains(pf);
  const dry = new Float32Array(n);
  for (let i = 0; i < n; i++) dry[i] = male[i]! + female[i]!;
  const [wl, wr] = ring(dry, sr, WHIP_DISTANCE.ring[d]!, seed, WHIP_DISTANCE.top[d]! * 0.6);
  const top = [new Biquad(sr).set('lp', WHIP_DISTANCE.top[d]!, 0.7), new Biquad(sr).set('lp', WHIP_DISTANCE.top[d]!, 0.7)];
  const wet = WHIP_DISTANCE.wet[d]!, level = WHIP_DISTANCE.level[d]! * 0.55;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = top[0]!.run((male[i]! * ml + female[i]! * fl) * (1 - wet) + wl[i]! * wet * 1.4) * level;
    R[i] = top[1]!.run((male[i]! * mr + female[i]! * frr) * (1 - wet) + wr[i]! * wet * 1.4) * level;
  }
  return [L, R];
}

// ── the rainbow lorikeet ───────────────────────────────────────────────────

/** One call's shape: a screech (a few tenths of a second, the pitch jumping up at its start) or a chatter (a quick syllable, its pitch sweeping up or down). */
type Call = 'screech' | 'chatter';

/**
 * One lorikeet call into `out` from sample `at`: a buzzy voice near `f0`, its harmonics shaped
 * by the bird's throat (most energy between 2 and 8 kHz), its pitch wobbling fast and rough with
 * jitter, mixed with noise that pulses at the voice's own rate. `gain` scales the whole call.
 */
function call(out: Float32Array, at: number, sr: number, f0: number, len: number, kind: Call, r: () => number, gain: number): void {
  const n = Math.min(out.length - at, Math.round(len * sr));
  if (n <= 0) return;
  // The pitch's path: a screech jumps up into its note and holds, wobbling; a chatter sweeps.
  const jump = kind === 'screech' ? 0.7 + r() * 0.15 : 0;
  const sweep = kind === 'chatter' ? (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.5) : (r() - 0.5) * 0.25;
  const wobble = 25 + r() * 25, wobbleDepth = kind === 'screech' ? 0.05 + r() * 0.05 : 0.03 + r() * 0.04;
  const rough = kind === 'screech' ? 0.1 + r() * 0.22 : 0.02 + r() * 0.07;
  const harmonics = Math.max(1, Math.min(8, Math.floor(Math.min(11000, sr * 0.45) / f0)));
  // The throat's resonances: one near 3 kHz, one near 5 kHz, and little above 8 kHz.
  const r1 = 2700 + r() * 900, r2 = 4700 + r() * 1100;
  const amp = Array.from({ length: harmonics }, (_, k) => {
    const f = f0 * (k + 1);
    return (k === 0 ? 0.5 : 1) * (0.25 + Math.exp(-(((f - r1) / 1100) ** 2)) + 0.7 * Math.exp(-(((f - r2) / 1300) ** 2))) * Math.exp(-((f / 8500) ** 2)) / (k + 1) ** 0.3;
  });
  const noiseBand = new Biquad(sr).set('bp', (r1 + r2) / 2, 0.9);
  const noiseHp = new Biquad(sr).set('hp', 1800, 0.7);
  let ph = r() * TAU, jit = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const t = i / sr;
    const env = Math.min(1, t / 0.008) * Math.min(1, (n - i) / (0.012 * sr)) * (kind === 'screech' ? 1 - 0.25 * u : 1);
    const onset = jump ? jump + (1 - jump) * Math.min(1, t / 0.035) : 1;
    jit = jit * 0.995 + gauss(r) * 0.0035;
    const f = f0 * onset * 2 ** (sweep * u) * (1 + wobbleDepth * Math.sin(TAU * wobble * t) + jit);
    ph += (TAU * f) / sr;
    let v = 0;
    for (let k = 0; k < harmonics; k++) v += Math.sin((k + 1) * ph) * amp[k]!;
    // Noise pulsing at the voice's rate: the buzz.
    const buzz = noiseHp.run(noiseBand.run(r() * 2 - 1)) * (0.5 + 0.5 * Math.sin(ph) ** 2);
    out[at + i] = out[at + i]! + (v * 0.22 * (1 - rough * 0.5) + buzz * rough * 2.2) * env * gain;
  }
}

/**
 * Rainbow lorikeets for `seconds`: `kind` and `birds` as a `lorikeet` note's, round `midi`'s
 * pitch. Screeching birds call a few times a second; a feeding flock chatters, several birds at
 * once from places through the tree; a flock flying over crosses the field from one side to the
 * other, nearing and going.
 */
export function lorikeets(sr: number, seconds: number, kind: 'screech' | 'chatter' | 'flypast', birds: number, midi: number, seed: number): Stereo {
  const r = seeded(mix(seed, 0x10c1));
  const n = Math.ceil(seconds * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const f0 = mtof(midi);
  const flock = Math.max(1, Math.min(8, birds));
  const fly = kind === 'flypast';
  // A flypast: the flock comes from one side and goes to the other, nearest about halfway.
  const dir = r() < 0.5 ? -1 : 1, nearest = seconds * (0.42 + r() * 0.16), speed = 2.6 / seconds;
  const place = (t: number): { pan: number; gain: number; top: number } => {
    if (!fly) return { pan: 0, gain: 1, top: 12000 };
    const x = (t - nearest) * speed;
    const dist = Math.sqrt(0.12 + x * x);
    return { pan: Math.max(-0.95, Math.min(0.95, dir * Math.tanh(x * 1.6))), gain: 0.35 / dist, top: 3500 + 9000 * Math.min(1, 0.35 / dist) };
  };
  for (let b = 0; b < flock; b++) {
    const br = seeded(mix(seed, b, 0x10c2));
    const voice = f0 * 2 ** ((br() - 0.5) * 0.6);
    const pan0 = (br() - 0.5) * 1.6;
    const mine = new Float32Array(n);
    // Each bird calls in runs of one to four, a few hundredths of a second apart, then pauses a
    // second or more: a feeding flock of six makes one or two calls a second between them.
    const pause = kind === 'chatter' ? 4.5 : kind === 'screech' ? 1.6 : 4;
    let t = br() * pause, run = 0;
    while (t < seconds - 0.1) {
      const which: Call = kind === 'chatter' ? (br() < 0.82 ? 'chatter' : 'screech') : (br() < 0.75 ? 'screech' : 'chatter');
      const len = which === 'chatter' ? 0.04 + br() ** 1.5 * 0.16 : 0.16 + br() * 0.45;
      const p = place(t);
      call(mine, Math.round(t * sr), sr, voice * 2 ** ((br() - 0.5) * 0.4), len, which, br, (0.6 + br() * 0.4) * p.gain);
      if (run === 0) run = 1 + Math.floor(br() * 4);
      run--;
      t += len + (run > 0 ? 0.05 + br() * 0.1 : -Math.log(1 - br()) * pause);
    }
    // Each bird from its own place: in a flypast all move together across the field. The air
    // and the leaves take the top off every call.
    const top = new Biquad(sr).set('lp', 9000, 0.7);
    for (let i = 0; i < n; i++) {
      const tt = i / sr;
      if (fly && i % 256 === 0) top.set('lp', place(tt).top, 0.7);
      const pan = fly ? Math.max(-0.95, Math.min(0.95, place(tt).pan + pan0 * 0.15)) : pan0;
      const [gl, gr] = panGains(pan);
      const v = top.run(mine[i]!);
      L[i] = L[i]! + v * gl; R[i] = R[i]! + v * gr;
    }
  }
  // A little of the garden's ring.
  const sum = new Float32Array(n);
  for (let i = 0; i < n; i++) sum[i] = (L[i]! + R[i]!) * 0.5;
  const [wl, wr] = ring(sum, sr, 0.4, seed, 7000);
  const level = 0.35 / Math.sqrt(flock);
  for (let i = 0; i < n; i++) { L[i] = (L[i]! + wl[i]! * 0.15) * level; R[i] = (R[i]! + wr[i]! * 0.15) * level; }
  return [L, R];
}

// ── played ──────────────────────────────────────────────────────────────────

/** Each bird's level against the station's other effects. */
const WHIPBIRD_LEVEL = 0.9;
const LORIKEET_LEVEL = 0.75;

const MADE = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
function made(ctx: BaseAudioContext, key: string, make: () => Stereo): AudioBuffer {
  let cache = MADE.get(ctx);
  if (!cache) { cache = new Map(); MADE.set(ctx, cache); }
  let buf = cache.get(key);
  if (!buf) {
    if (cache.size > 24) cache.clear();
    const [l, r] = make();
    buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
    buf.getChannelData(0).set(l);
    buf.getChannelData(1).set(r);
    cache.set(key, buf);
  }
  return buf;
}

/** Play a `whipbird` note from `t`: the pair's call, the same each time for the same tune and take. */
export function playWhipbird(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel: number, mod: number, tune: number): void {
  const w = readWhipbird(mod);
  const src = ctx.createBufferSource();
  src.buffer = made(ctx, `whip|${tune}|${w.take}|${midi}|${w.answered}|${w.distance}`, () => whipbird(ctx.sampleRate, midi, mix(tune, w.take), w.answered, w.distance));
  const g = ctx.createGain();
  g.gain.value = WHIPBIRD_LEVEL * vel;
  src.connect(g).connect(out);
  src.start(t);
}

/** Play a `lorikeet` note from `t` for `seconds`: the birds the note says, faded at its ends. */
export function playLorikeets(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel: number, seconds: number, mod: number, tune: number): void {
  const k = readLorikeet(mod);
  const len = Math.max(0.5, Math.min(12, seconds));
  const src = ctx.createBufferSource();
  src.buffer = made(ctx, `lori|${tune}|${k.take}|${k.kind}|${k.birds}|${midi}|${Math.round(len * 10)}`, () => lorikeets(ctx.sampleRate, len, k.kind, k.birds, midi, mix(tune, k.take)));
  const g = ctx.createGain();
  g.gain.value = LORIKEET_LEVEL * vel;
  src.connect(g).connect(out);
  src.start(t);
}
