// SPDX-License-Identifier: MPL-2.0
/**
 * sfx-voices - the SYNTHESIS half of the interface-sound layer, split out of sfx.ts so it
 * stays OFF the boot path. Holds the tone primitives, the VOICES / THEME_VOICES tables, and
 * the per-view arrival renderers, all pure Web-Audio math over an injected (ctx, out). The one
 * piece of module state is the material a render pass is drawn in (below), set and reset
 * around each pass by renderShaped. sfx.ts owns mute/volume/shape/dispatch and dynamic-imports
 * this module on demand (warmed at installGlobalSfx), so a cue never blocks first paint.
 * Everything here plays only when sfx.ts hands it a live, gesture-resumed AudioContext.
 */

import type { SfxName } from './sfx.ts';

// ── materials: Bouba, chimes, Kiki ────────────────────────────────────────────────
// The listener's sound shape (sfx.ts getSfxShape, 0 Bouba … 0.5 chimes … 1 Kiki) picks the
// MATERIAL every primitive below is made of. The cues never change: their rhythm, pitch contour
// and length stay put, so a cue that rises for "leaving" still rises. What the notes are made of
// moves:
//
//   bouba  round and wet. Notes become sine drops that scoop up into a pitch a fifth lower,
//          clicks become droplets, airy sweeps slosh, and the weighty moments get a bass "bwah"
//          under them (BOUBA_BASS). Nothing starts with a hard edge.
//   chime  Lolly's own chimes and notes, exactly as they were before the slider existed.
//   kiki   dry and bright. Notes become short metal pings a fifth higher, glides become
//          ratchets, breathy bursts become scratches. No glides, no bloops, no bass.
//
// Some listeners find wet bloops hard to bear and some find ticks and scratches hard to bear,
// so each end leaves out what the other end is made of. renderShaped draws a cue once per
// material in the mix (at most two, the centre and one end), each pass through its own gain,
// so the slider crossfades between neighbours at equal power.

export type Material = 'bouba' | 'chime' | 'kiki';
/** A cue renderer: schedules its nodes on `ctx`, into `out`, starting now. */
export type Render = (ctx: AudioContext, out: AudioNode) => void;

/** The material the current render pass is drawn in. Only renderShaped changes this. */
let material: Material = 'chime';

/** Below this a material's share of the mix is inaudible under the other, so it is skipped. */
const MIN_WEIGHT = 0.05;
/** Per-material level, so the three ends sound equally loud (measured, see sfx-voices.test.ts). */
const MATERIAL_TRIM: Record<Material, number> = { bouba: 0.85, chime: 1, kiki: 1.25 };

/**
 * How much of each material a sound shape plays, as [material, gain] pairs. The centre is
 * pure chimes, either end is purely its own material, and between them the two neighbours
 * share an equal-power crossfade.
 */
export function materialMix(shape: number): Array<[Material, number]> {
  const x = Number.isFinite(shape) ? Math.min(1, Math.max(0, shape)) : 0.5;
  const reach = Math.abs(x - 0.5) * 2;               // 0 at the centre, 1 at either end
  const end: Material = x < 0.5 ? 'bouba' : 'kiki';
  const mix: Array<[Material, number]> = [
    ['chime', Math.cos(reach * Math.PI / 2)],
    [end, Math.sin(reach * Math.PI / 2)],
  ];
  return mix.filter(([, w]) => w >= MIN_WEIGHT);
}

/**
 * Draw `render` in the materials `shape` mixes, each pass through its own gain into `out`.
 * `bass` is drawn in the Bouba pass only: the "bwah" a weighty cue gets at the round end.
 */
export function renderShaped(render: Render | undefined, ctx: AudioContext, out: AudioNode, shape: number, bass?: Render): void {
  if (!render) return;
  for (const [m, w] of materialMix(shape)) {
    const level = w * MATERIAL_TRIM[m];
    let dest: AudioNode = out;
    if (level !== 1) {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(out);
      dest = g;
    }
    material = m;
    try {
      render(ctx, dest);
      if (m === 'bouba') bass?.(ctx, dest);
    } finally {
      material = 'chime';
    }
  }
}

/** Play the interface cue `name` in the listener's sound shape. */
export function playCue(name: SfxName, ctx: AudioContext, out: AudioNode, shape: number): void {
  renderShaped(VOICES[name], ctx, out, shape, BOUBA_BASS[name]);
}

/** Play the theme-change chime for `theme` (the light one for a theme without its own). */
export function playThemeCue(theme: string, ctx: AudioContext, out: AudioNode, shape: number): void {
  renderShaped(THEME_VOICES[theme] ?? THEME_VOICES.light, ctx, out, shape);
}

/** Bouba sits a fifth lower than the chimes, rounder, but never pushes a note under 110 Hz. */
function lower(f: number): number {
  return f <= 110 ? f : Math.max(110, f * 2 / 3);
}
/** Kiki sits a fifth higher, brighter. A low note is lifted two octaves first (Kiki has no bass). */
function higher(f: number): number {
  return Math.min((f < 160 ? f * 4 : f) * 1.5, 9000);
}
const EPS = 0.0001;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// One second each of white noise and crackle per context, read from a random offset, so the
// new materials don't build a fresh noise buffer for every grain of a ratchet or a scratch.
// Crackle is sparse sharp grains (about 900 a second): the raw stuff of a scratch.
const NOISE = new WeakMap<BaseAudioContext, { white: AudioBuffer; crackle: AudioBuffer }>();
function noiseBuffers(ctx: BaseAudioContext): { white: AudioBuffer; crackle: AudioBuffer } {
  let bufs = NOISE.get(ctx);
  if (!bufs) {
    const n = ctx.sampleRate;
    const white = ctx.createBuffer(1, n, ctx.sampleRate);
    const crackle = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = white.getChannelData(0);
    const c = crackle.getChannelData(0);
    const density = 900 / ctx.sampleRate;
    for (let i = 0; i < n; i++) {
      w[i] = Math.random() * 2 - 1;                    // shell code - Math.random is fine
      if (Math.random() < density && i + 2 < n) {
        const a = (0.4 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1);
        c[i] = a; c[i + 1] = -a * 0.6; c[i + 2] = a * 0.25;
      }
    }
    bufs = { white, crackle };
    NOISE.set(ctx, bufs);
  }
  return bufs;
}
/** A looping noise source that starts at `t0` and stops after `dur`. */
function noiseSource(ctx: AudioContext, kind: 'white' | 'crackle', t0: number, dur: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffers(ctx)[kind];
  src.loop = true;
  src.start(t0, Math.random() * 0.9);
  src.stop(t0 + dur + 0.03);
  return src;
}

// ── voice primitives ───────────────────────────────────────────────────────────

interface BlipOpts {
  type?: OscillatorType;
  /** Start frequency (Hz). */ from: number;
  /** End frequency (Hz); glides from→to across dur. Omit for a flat tone. */ to?: number;
  /** Duration in seconds. */ dur: number;
  /** Peak gain (0–1, relative to master). */ peak?: number;
  /** Start offset in seconds from "now". */ delay?: number;
}

/** A single enveloped oscillator tone: fast attack, exponential decay to silence. */
function blip(ctx: AudioContext, out: AudioNode, opts: BlipOpts): void {
  if (material === 'bouba') { drop(ctx, out, opts); return; }
  if (material === 'kiki') { strike(ctx, out, opts); return; }
  const { type = 'sine', from, to, dur, peak = 0.5, delay = 0 } = opts;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  // A touch of random detune keeps repeated cues from sounding mechanically identical.
  const detune = (Math.random() * 2 - 1) * 6;
  osc.frequency.setValueAtTime(from, t0);
  osc.detune.setValueAtTime(detune, t0);
  if (to !== undefined && to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  // exponentialRamp can't touch 0, so bracket the envelope with a tiny epsilon.
  const eps = 0.0001;
  g.gain.setValueAtTime(eps, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.008, dur * 0.35)); // ~8ms attack
  g.gain.exponentialRampToValueAtTime(eps, t0 + dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

interface SweepOpts {
  dur: number;
  peak?: number;
  cutoffFrom: number;
  cutoffTo: number;
  /** Start offset in seconds from "now" - lets a sweep land AFTER earlier hits (e.g. a vacuum after the shutter's 'ssh's). */ delay?: number;
}

/** A short filtered-noise sweep - the "away" texture under the delete cue. */
function sweep(ctx: AudioContext, out: AudioNode, opts: SweepOpts): void {
  if (material === 'bouba') { slosh(ctx, out, opts); return; }
  if (material === 'kiki') { swish(ctx, out, opts); return; }
  const { dur, peak = 0.4, cutoffFrom, cutoffTo, delay = 0 } = opts;
  const t0 = ctx.currentTime + delay;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1; // white noise (shell code - Math.random is fine)
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(cutoffFrom, t0);
  lp.frequency.exponentialRampToValueAtTime(Math.max(1, cutoffTo), t0 + dur);
  const g = ctx.createGain();
  const eps = 0.0001;
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(eps, t0 + dur);
  src.connect(lp).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

interface TickOpts {
  /** Duration in seconds. */ dur: number;
  /** Peak gain (0–1, relative to master). */ peak?: number;
  /** Band-pass centre frequency (Hz) - the transient's timbre. */ freq: number;
  /** Filter Q (resonance). Lower = softer/woodier, higher = tighter/brighter. */ q?: number;
  /** Start offset in seconds from "now" - for layering two hits (e.g. a shutter's ka-chunk). */ delay?: number;
}

/**
 * A very short band-passed noise burst - the crisp, PHYSICAL part of a click (a tap,
 * not a pitched beep). Instant attack, fast exponential decay. Layered under a tonal
 * body it gives a UI tap its tactile edge without sounding electronic.
 */
function tick(ctx: AudioContext, out: AudioNode, opts: TickOpts): void {
  if (material === 'bouba') { softTick(ctx, out, opts); return; }
  if (material === 'kiki') { sharpTick(ctx, out, opts); return; }
  const { dur, peak = 0.4, freq, q = 0.8, delay = 0 } = opts;
  const t0 = ctx.currentTime + delay;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1; // white noise (shell code - Math.random is fine)
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  // A touch of centre-frequency jitter keeps repeated clicks from sounding identical.
  bp.frequency.setValueAtTime(freq * (1 + (Math.random() * 2 - 1) * 0.06), t0);
  bp.Q.setValueAtTime(q, t0);
  const g = ctx.createGain();
  const eps = 0.0001;
  g.gain.setValueAtTime(peak, t0);                    // instant transient, no attack ramp
  g.gain.exponentialRampToValueAtTime(eps, t0 + dur); // fast decay
  src.connect(bp).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

interface SurgeOpts {
  type?: OscillatorType;
  /** Start frequency (Hz). */ from: number;
  /** End frequency (Hz); glides from→to across dur. */ to?: number;
  /** Duration in seconds. */ dur: number;
  /** Peak gain (0–1, relative to master). */ peak?: number;
  /** Seconds to SWELL in to peak (the "takeoff / arrival" onset - unlike blip's ~8ms attack). */ attack?: number;
  /** Start offset in seconds from "now". */ delay?: number;
  /** Fixed detune (cents) for ensemble width when layering. */ detune?: number;
}

/**
 * A swelling glide TONE: pitch glides from→to while the gain SWELLS in over `attack`,
 * holds, then eases out. Where `blip` snaps on and decays (a tap), `surge` arrives, like
 * the envelope of an EV pulling away or a maglev gliding in. The core of a "takeoff" cue.
 */
function surge(ctx: AudioContext, out: AudioNode, { type = 'triangle', from, to, dur, peak = 0.2, attack = 0.12, delay = 0, detune = 0 }: SurgeOpts): void {
  // Kiki: the swell becomes a ratchet that grows over the same attack. Bouba: a pure sine, lower.
  if (material === 'kiki') { ratchet(ctx, out, { from, to: to ?? from, dur, peak: peak * 3, delay, swell: attack }); return; }
  const bouba = material === 'bouba';
  const f0 = bouba ? lower(from) : from;
  const f1 = to === undefined ? undefined : bouba ? lower(to) : to;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const eps = 0.0001;
  osc.type = bouba ? 'sine' : type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.detune.setValueAtTime(detune, t0);
  if (f1 !== undefined && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(eps, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);              // swell in
  g.gain.exponentialRampToValueAtTime(peak * 0.72, t0 + dur * 0.72);   // hold-ish
  g.gain.exponentialRampToValueAtTime(eps, t0 + dur);                  // ease out
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

interface BrassOpts {
  /** Fundamental (Hz). */ from: number;
  /** Total duration (s) - this voice is allowed to ring long. */ dur: number;
  /** Peak gain (0–1, relative to master). */ peak?: number;
  /** Amp attack (s) - fast punch-in, not a swell. */ attack?: number;
  /** Lowpass cutoff at onset (Hz) - dark/muffled. */ cutoffFrom?: number;
  /** Lowpass cutoff at full bloom (Hz) - open/bright, the "…aaah" vowel. */ cutoffTo?: number;
  /** Seconds for the filter to open (the bloom). */ bloom?: number;
  /** Ensemble detune spread (cents) across the two saws - the brass "grit". */ detune?: number;
  /** Start offset (s). */ delay?: number;
}

/**
 * A brass "braaam" voice: a pair of detuned sawtooths through a lowpass whose cutoff
 * BLOOMS open just after a fast attack (that opening is the vowel, the "…aaah"), then
 * darkens again as the long tail decays. Each osc bends up into pitch over the first
 * roughly 70ms, the way a brass player's attack does. Where `surge` swells and `blip` taps, `brass`
 * PUNCHES then blooms and rings. It is the core of a deep cinematic hit. Layer a few at octaves.
 */
function brass(ctx: AudioContext, out: AudioNode, { from, dur, peak = 0.2, attack = 0.03, cutoffFrom = 180, cutoffTo = 2000, bloom = 0.22, detune = 10, delay = 0 }: BrassOpts): void {
  // Bouba: the brass hit is a big round "bwah". Kiki: a struck steel plate, high and dry.
  if (material === 'bouba') { bwah(ctx, out, { freq: from, dur, peak: peak * 1.3, delay }); return; }
  if (material === 'kiki') { clash(ctx, out, { freq: Math.min(from * 8, 1600), dur: 0.6, peak: peak * 1.8, delay }); return; }
  const t0 = ctx.currentTime + delay;
  const eps = 0.0001;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.setValueAtTime(1.1, t0);                                                  // a touch of vocal resonance
  lp.frequency.setValueAtTime(Math.max(1, cutoffFrom), t0);
  lp.frequency.exponentialRampToValueAtTime(Math.max(1, cutoffTo), t0 + bloom);  // open - the "…aaah"
  lp.frequency.exponentialRampToValueAtTime(Math.max(1, cutoffTo * 0.32), t0 + dur); // darken into the tail
  const g = ctx.createGain();
  g.gain.setValueAtTime(eps, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);        // fast punch in
  g.gain.exponentialRampToValueAtTime(peak * 0.62, t0 + dur * 0.6); // sustain sag
  g.gain.exponentialRampToValueAtTime(eps, t0 + dur);            // long ring-out
  lp.connect(g).connect(out);
  // Two saws, detuned apart, beating against each other for ensemble width.
  for (const cents of [-detune / 2, detune / 2]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.setValueAtTime(cents + (Math.random() * 2 - 1) * 3, t0);
    osc.frequency.setValueAtTime(from * 0.972, t0);                     // start a hair flat…
    osc.frequency.exponentialRampToValueAtTime(from, t0 + 0.07);        // …and bend up into pitch (brass attack)
    osc.connect(lp);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }
}

// ── Bouba: drops, droplets, sloshes and the bwah ──────────────────────────────────
// A sine carries about three times the energy of a band of noise at the same peak, and a
// sawtooth more again than a sine, so each Bouba voice scales its peak to sit level with
// the chime it replaces.
const BOUBA_TYPE_LEVEL: Partial<Record<OscillatorType, number>> = { sawtooth: 1.3, square: 1.2, triangle: 1.05 };

/** Bouba's note: a sine a fifth lower that scoops up into its pitch like a drop of water,
 *  with a soft onset and a slightly longer, rounder tail. Follows the cue's own glide. */
function drop(ctx: AudioContext, out: AudioNode, { type = 'sine', from, to, dur, peak = 0.5, delay = 0 }: BlipOpts): void {
  const t0 = ctx.currentTime + delay;
  const d = dur * 1.25 + 0.015;
  const f = lower(from);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.detune.setValueAtTime((Math.random() * 2 - 1) * 6, t0);
  osc.frequency.setValueAtTime(f * 0.74, t0);
  osc.frequency.exponentialRampToValueAtTime(f, t0 + Math.min(0.045, d * 0.35));   // the scoop
  if (to !== undefined && to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, lower(to)), t0 + d);
  g.gain.setValueAtTime(EPS, t0);
  g.gain.exponentialRampToValueAtTime(peak * (BOUBA_TYPE_LEVEL[type] ?? 1), t0 + Math.min(0.02, d * 0.4));
  g.gain.exponentialRampToValueAtTime(EPS, t0 + d);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + d + 0.02);
}

/** Bouba's click: a droplet. A short sine that chirps upward the way a drop does as it
 *  meets the water, so a press reads as a soft "plip" with no edge. */
function droplet(ctx: AudioContext, out: AudioNode, { freq, peak, dur, delay }: { freq: number; peak: number; dur: number; delay: number }): void {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 0.8, t0);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.6, t0 + dur * 0.7);
  g.gain.setValueAtTime(EPS, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(EPS, t0 + dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Bouba's tick: a droplet for a click, or a soft low puff of air for a breathy burst. */
function softTick(ctx: AudioContext, out: AudioNode, { dur, peak = 0.4, freq, q = 0.8, delay = 0 }: TickOpts): void {
  if (dur >= 0.03 && q < 0.6) {
    const t0 = ctx.currentTime + delay;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(clamp(freq * 0.3, 500, 1800), t0);
    lp.Q.setValueAtTime(0.5, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t0);
    g.gain.exponentialRampToValueAtTime(peak * 0.8, t0 + Math.min(0.015, dur * 0.35));
    g.gain.exponentialRampToValueAtTime(EPS, t0 + dur * 1.4);
    noiseSource(ctx, 'white', t0, dur * 1.4).connect(lp).connect(g).connect(out);
    return;
  }
  droplet(ctx, out, { freq: clamp(freq * 0.22, 220, 1100), peak: peak * 0.4, dur: clamp(dur * 3, 0.035, 0.09), delay });
}

/** Bouba's sweep: a slosh. A resonant band of noise follows the sweep's direction an octave
 *  lower, wobbling like water in a glass, with a round tone gliding along underneath. */
function slosh(ctx: AudioContext, out: AudioNode, { dur, peak = 0.4, cutoffFrom, cutoffTo, delay = 0 }: SweepOpts): void {
  const t0 = ctx.currentTime + delay;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.setValueAtTime(3.5, t0);
  bp.frequency.setValueAtTime(clamp(cutoffFrom * 0.45, 180, 2600), t0);
  bp.frequency.exponentialRampToValueAtTime(clamp(cutoffTo * 0.45, 180, 2600), t0 + dur);
  const wobble = ctx.createOscillator();
  const depth = ctx.createGain();
  wobble.frequency.setValueAtTime(7, t0);
  depth.gain.setValueAtTime(clamp(Math.min(cutoffFrom, cutoffTo) * 0.08, 20, 160), t0);
  wobble.connect(depth).connect(bp.frequency);
  wobble.start(t0);
  wobble.stop(t0 + dur + 0.03);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t0);
  // A short slosh never reaches full swell under its soft onset, so it starts a little louder.
  const level = peak * (1.1 + 4 * Math.max(0, 0.25 - dur));
  g.gain.exponentialRampToValueAtTime(level, t0 + Math.min(0.05, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(EPS, t0 + dur);
  noiseSource(ctx, 'white', t0, dur).connect(bp).connect(g).connect(out);
  drop(ctx, out, { from: clamp(cutoffFrom * 0.3, 160, 1000), to: clamp(cutoffTo * 0.3, 160, 1000), dur: dur * 0.8, peak: peak * 0.3, delay });
}

interface BwahOpts {
  /** The bass note (Hz). */ freq: number;
  /** Duration (s). */ dur?: number;
  /** Peak gain (0–1, relative to master). */ peak?: number;
  /** Start offset (s). */ delay?: number;
  /** Where the pitch ends, as a ratio of `freq`: under 1 sags (a sad trombone), 1 holds. */ bend?: number;
}

/**
 * Bouba's bass: "bwah". A low note scoops up into pitch while a resonant low-pass opens fast
 * (the "bw-", lips parting) and closes slowly (the "-aah"). Two detuned saws give the filter
 * something to sing through; a sine underneath carries the weight on speakers that have bass.
 */
function bwah(ctx: AudioContext, out: AudioNode, { freq, dur = 0.45, peak = 0.2, delay = 0, bend = 1 }: BwahOpts): void {
  const t0 = ctx.currentTime + delay;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.setValueAtTime(4, t0);
  lp.frequency.setValueAtTime(freq * 1.2, t0);
  lp.frequency.exponentialRampToValueAtTime(freq * 8, t0 + Math.min(0.09, dur * 0.3));   // "bw-"
  lp.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + dur);                       // "-aah"
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.025);
  g.gain.exponentialRampToValueAtTime(peak * 0.55, t0 + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(EPS, t0 + dur);
  lp.connect(g).connect(out);
  const layers: ReadonlyArray<readonly [OscillatorType, number, number]> = [['sawtooth', 0.45, -7], ['sawtooth', 0.45, 7], ['sine', 1, 0]];
  for (const [type, level, cents] of layers) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.setValueAtTime(cents, t0);
    osc.frequency.setValueAtTime(freq * 0.84, t0);
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.06);                          // scoop up into pitch
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq * bend, t0 + dur);
    const og = ctx.createGain();
    og.gain.value = level;
    osc.connect(og).connect(lp);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }
}

// ── Kiki: pings, ratchets, scratches and swishes ─────────────────────────────────

/** A struck bar of metal: four inharmonic partials, higher ones softer and shorter. */
const METAL: ReadonlyArray<readonly [ratio: number, length: number, level: number]> = [
  [1, 1, 1], [1.483, 0.8, 0.5], [2.137, 0.6, 0.3], [3.731, 0.4, 0.16],
];

/** The pick of a Kiki strike: a few milliseconds of bright, narrow noise. */
function pick(ctx: AudioContext, out: AudioNode, freq: number, peak: number, t0: number): void {
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq * (1 + (Math.random() * 2 - 1) * 0.06), t0);
  bp.Q.setValueAtTime(1.4, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(EPS, t0 + 0.005);
  noiseSource(ctx, 'white', t0, 0.006).connect(bp).connect(g).connect(out);
}

/** Kiki's note: a short metal ping a fifth higher. A long note rings a little longer, but
 *  never for more than 0.4 s, and never glides more than a hair. */
function ping(ctx: AudioContext, out: AudioNode, { freq, dur, peak, delay }: { freq: number; dur: number; peak: number; delay: number }): void {
  const t0 = ctx.currentTime + delay;
  const f = higher(freq);
  const ring = Math.min(dur, 0.035 + dur * 0.3, 0.4);
  const level0 = peak * 0.55 * (1 + 0.8 * (1 - ring / dur));   // a note cut short keeps its weight
  for (const [ratio, length, level] of METAL) {
    const pf = f * ratio;
    if (pf > 12000) continue;
    const end = t0 + Math.max(0.012, ring * length);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pf, t0);
    osc.frequency.exponentialRampToValueAtTime(pf * 0.99, end);
    g.gain.setValueAtTime(EPS, t0);
    g.gain.linearRampToValueAtTime(level0 * level, t0 + 0.0015);
    g.gain.exponentialRampToValueAtTime(EPS, end);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(end + 0.02);
  }
  pick(ctx, out, Math.min(f * 3, 9500), peak * 0.45, t0);
}

/** One tooth of a ratchet: a tiny two-partial metal tick. */
function tooth(ctx: AudioContext, out: AudioNode, freq: number, peak: number, delay: number): void {
  const t0 = ctx.currentTime + delay;
  const f = higher(freq);
  for (const [ratio, level] of [[1, 0.75], [2.137, 0.3]] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.min(f * ratio, 12000), t0);
    g.gain.setValueAtTime(EPS, t0);
    g.gain.linearRampToValueAtTime(peak * level, t0 + 0.001);
    g.gain.exponentialRampToValueAtTime(EPS, t0 + 0.022);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.04);
  }
  pick(ctx, out, Math.min(f * 2.5, 9500), peak * 0.7, t0);
}

/** Kiki's glide: a ratchet. Teeth about 30 ms apart step along the glide's pitch path, fading
 *  as they go, or growing over `swell` seconds when the glide swelled in. */
function ratchet(ctx: AudioContext, out: AudioNode, { from, to, dur, peak = 0.3, delay = 0, swell = 0 }: { from: number; to: number; dur: number; peak?: number; delay?: number; swell?: number }): void {
  const n = Math.max(3, Math.min(20, Math.round(dur / 0.032)));
  const ratio = to / from;
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    const at = p * dur * 0.92;
    const env = swell > 0 ? Math.min(1, (at + 0.03) / swell) * (1 - 0.35 * p) : 1 - 0.5 * p;
    tooth(ctx, out, from * ratio ** p, peak * env, delay + at);
  }
}

/** Kiki's blip: a glide of three semitones or more becomes a ratchet, anything else a ping. */
function strike(ctx: AudioContext, out: AudioNode, { from, to, dur, peak = 0.5, delay = 0 }: BlipOpts): void {
  const glide = to !== undefined && to !== from ? to / from : 1;
  if (dur >= 0.08 && (glide > 1.2 || glide < 1 / 1.2)) { ratchet(ctx, out, { from, to: from * glide, dur, peak, delay }); return; }
  ping(ctx, out, { freq: from, dur, peak, delay });
}

/** Kiki's tick: tighter and brighter than the chime's, or a scratch for a breathy burst. */
function sharpTick(ctx: AudioContext, out: AudioNode, { dur, peak = 0.4, freq, q = 0.8, delay = 0 }: TickOpts): void {
  const t0 = ctx.currentTime + delay;
  if (dur >= 0.03 && q < 0.6) { scratch(ctx, out, { dur, peak, freq, t0 }); return; }
  const d = Math.max(0.004, dur * 0.6);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(Math.min(freq * 1.4, 10000) * (1 + (Math.random() * 2 - 1) * 0.06), t0);
  bp.Q.setValueAtTime(Math.max(1.6, q * 2), t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak * 1.1, t0);
  g.gain.exponentialRampToValueAtTime(EPS, t0 + d);
  noiseSource(ctx, 'white', t0, d).connect(bp).connect(g).connect(out);
}

/** A pen scratching paper: crackle through a bright band, swelling and falling over `dur`. */
function scratch(ctx: AudioContext, out: AudioNode, { dur, peak, freq, t0 }: { dur: number; peak: number; freq: number; t0: number }): void {
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(clamp(freq * 1.2, 1500, 9000), t0);
  bp.Q.setValueAtTime(1.2, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t0);
  g.gain.exponentialRampToValueAtTime(peak * 3.7, t0 + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(EPS, t0 + dur * 1.2);
  noiseSource(ctx, 'crackle', t0, dur * 1.2).connect(bp).connect(g).connect(out);
}

/** Kiki's sweep: a blade swish. A bright band of noise follows the sweep's direction higher
 *  up, with a scratch of crackle in it and a small metal tick as it ends. */
function swish(ctx: AudioContext, out: AudioNode, { dur, peak = 0.4, cutoffFrom, cutoffTo, delay = 0 }: SweepOpts): void {
  const t0 = ctx.currentTime + delay;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.setValueAtTime(2.2, t0);
  bp.frequency.setValueAtTime(clamp(cutoffFrom * 1.6, 1200, 9500), t0);
  bp.frequency.exponentialRampToValueAtTime(clamp(cutoffTo * 1.6, 1200, 9500), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.025, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(EPS, t0 + dur);
  noiseSource(ctx, 'white', t0, dur).connect(bp).connect(g).connect(out);
  scratch(ctx, out, { dur: dur * 0.8, peak: peak * 0.5, freq: Math.max(cutoffFrom, cutoffTo), t0 });
  tooth(ctx, out, Math.max(cutoffFrom, cutoffTo) * 0.4, peak * 0.4, delay + dur * 0.85);
}

// ── the sound grammar ───────────────────────────────────────────────────────────
// One small vocabulary, deliberately consistent: rising = "leaving", falling = "settling",
// receding + noise = "gone". Kept quiet and short so it reads as feedback, not decoration.
/** A sweet glassy bell - sine fundamental + a shimmer octave + one inharmonic partial + a
 *  soft mallet strike. Used by the session cues below. */
function bell(ctx: AudioContext, out: AudioNode, { freq, dur = 0.4, peak = 0.2, delay = 0 }: { freq: number; dur?: number; peak?: number; delay?: number }): void {
  blip(ctx, out, { type: 'sine', from: freq, dur, peak, delay });
  blip(ctx, out, { type: 'sine', from: freq * 2.007, dur: dur * 0.6, peak: peak * 0.34, delay });
  blip(ctx, out, { type: 'sine', from: freq * 3.83, dur: dur * 0.28, peak: peak * 0.11, delay });
  tick(ctx, out, { dur: 0.005, peak: peak * 0.45, freq: freq * 3.5, q: 1.1, delay });
}

/** A metallic "ching", a sword-cross clang. A bright band-passed noise scrape (the
 *  steel-on-steel impact) plays under a cluster of INHARMONIC partials: non-integer frequency
 *  ratios, which make struck metal SING like steel rather than ring like a pure
 *  bell. Each partial glides down slightly and decays as it rings; higher partials are softer and
 *  shorter, so the sound flashes bright on the strike then mellows. It has a fast attack and a medium ring. Two
 *  staggered instances (slightly apart in pitch) read as "ching-ching", two blades crossing. */
function clash(ctx: AudioContext, out: AudioNode, { freq = 2600, dur = 0.5, peak = 0.22, delay = 0 }: { freq?: number; dur?: number; peak?: number; delay?: number }): void {
  // The impact: a sharp initial "chink" over a broader bright scrape - metal on metal.
  tick(ctx, out, { dur: 0.012, peak: peak * 0.9, freq: freq * 2.6, q: 1.4, delay });
  tick(ctx, out, { dur: 0.045, peak: peak * 0.65, freq: freq * 2.0, q: 0.8, delay });
  // The ringing steel: inharmonic partials, higher = softer + shorter, each easing down.
  const partials: Array<[number, number, number]> = [
    [1.00, dur,        1.00],
    [1.49, dur * 0.80, 0.55],
    [2.03, dur * 0.60, 0.34],
    [2.66, dur * 0.42, 0.20],
    [3.42, dur * 0.28, 0.11],
  ];
  for (const [ratio, d, amp] of partials) {
    const f = freq * ratio;
    blip(ctx, out, { type: 'sine', from: f, to: f * 0.985, dur: d, peak: peak * amp, delay });
  }
}

export const VOICES: Record<SfxName, (ctx: AudioContext, out: AudioNode) => void> = {
  // Making a NEW session from a tool: "Twinkle bloom" (sound audition #8). A soft shimmer
  // opens out and floats down. Light and quietly celebratory, for a fresh canvas
  // appearing. Played by views/tool.js when a tool mounts with no resume slot.
  newSession(ctx, out) {
    sweep(ctx, out, { dur: 0.5, peak: 0.1, cutoffFrom: 2200, cutoffTo: 7200 });
    bell(ctx, out, { freq: 2093, dur: 0.6, peak: 0.1, delay: 0.08 });  // C7
    bell(ctx, out, { freq: 2637, dur: 0.5, peak: 0.07, delay: 0.22 }); // E7
  },
  // Leaving an editing session: a sugary three-step cheer with a trailing sparkle spray
  // (auditions #10 and #7). Three small notes, each lilting upward, climb to a happy top, a
  // bell rings, then sugar sparkles spray out. A sweet reward for stepping away from something
  // you made. (It used to sing "yum-yum-YUM" in a synthesised voice; spoken sounds are gone.)
  leaveSession(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 560, to: 650, dur: 0.15, peak: 0.24 });
    blip(ctx, out, { type: 'triangle', from: 660, to: 766, dur: 0.15, peak: 0.25, delay: 0.16 });
    blip(ctx, out, { type: 'triangle', from: 800, to: 976, dur: 0.2, peak: 0.26, delay: 0.32 });
    bell(ctx, out, { freq: 2093, dur: 0.4, peak: 0.14, delay: 0.5 }); // C7, the top
    [0.5, 0.58, 0.66].forEach((d, i) => tick(ctx, out, { dur: 0.007, peak: 0.06, freq: 6000 + i * 900, q: 1, delay: d }));
  },
  // Flipping past one featured tile or cover: a soft, dry paper flick. A single very short
  // band-passed noise tick, quiet and pitch-jittered, so a fast riffle through the strip flutters
  // like thumbing a stack of cards rather than repeating one mechanical click. The caller
  // rate-limits it (see featured-row.ts) so a quick flick stays a riffle, not a buzz.
  flick(ctx, out) {
    tick(ctx, out, { dur: 0.012, peak: 0.09 + Math.random() * 0.03, freq: 2200 + Math.random() * 900, q: 1.1 });
  },
  // A light, high tap: a crisp high band-passed noise transient (the "click") over a
  // quick high sine that settles slightly downward. Deliberately high in pitch, soft,
  // and very short: a barely-there tick that reads as a press, never a bleep.
  click(ctx, out) {
    tick(ctx, out, { dur: 0.007, peak: 0.16, freq: 3600, q: 1.0 });
    blip(ctx, out, { type: 'sine', from: 940, to: 780, dur: 0.024, peak: 0.13 });
  },
  // "Bing & blades", Andy's pick for VISITING the Verify page (Sound Lab, 2026-07-07). A
  // bright bell BING rings out while two metallic sword crosses ("ching-ching") slash over
  // the top of it, overlapping: the first clash lands WITH the bing, and the second crosses a
  // beat later and slightly higher (the answering blade). Bell under, steel over: a crisp
  // "checked & cleared" flourish. Played on the "Verify" nav link (the page visit), not the
  // in-page file action.
  verify(ctx, out) {
    bell(ctx, out, { freq: 1047, dur: 0.58, peak: 0.20 });                 // C6 bing - rings out underneath
    clash(ctx, out, { freq: 2600, dur: 0.50, peak: 0.19 });                // ching - with the bing
    clash(ctx, out, { freq: 3100, dur: 0.46, peak: 0.20, delay: 0.13 });   // ching - the cross, higher, over the ring
  },
  // A card lifts out of the grid - a short upward glide.
  pickup(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 560, to: 860, dur: 0.09, peak: 0.5 });
  },
  // A card settles into place - a soft downward tone with a low body under it.
  drop(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 520, to: 300, dur: 0.12, peak: 0.6 });
    blip(ctx, out, { type: 'sine', from: 200, to: 150, dur: 0.14, peak: 0.32, delay: 0.02 });
  },
  // Something is removed - a receding whoosh plus a low tone dropping away.
  delete(ctx, out) {
    sweep(ctx, out, { dur: 0.28, peak: 0.5, cutoffFrom: 1400, cutoffTo: 220 });
    blip(ctx, out, { type: 'sine', from: 320, to: 90, dur: 0.26, peak: 0.4 });
  },
  // A two-step chirp so switching sound back ON gives immediate audible confirmation.
  toggle(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 700, dur: 0.05, peak: 0.45 });
    blip(ctx, out, { type: 'triangle', from: 1040, dur: 0.06, peak: 0.45, delay: 0.06 });
  },
  // Shifting top-level view (Tools ↔ Projects ↔ Catalog): a soft airy "swish"
  // forward. A filtered-noise glide opens UPWARD (arriving, the opposite of
  // delete's receding sweep) under a gently rising tone. Distinct from the tap.
  navigate(ctx, out) {
    sweep(ctx, out, { dur: 0.19, peak: 0.22, cutoffFrom: 700, cutoffTo: 3400 });
    blip(ctx, out, { type: 'sine', from: 440, to: 590, dur: 0.13, peak: 0.2 });
  },
  // Capture (render / save / copy), Andy's brief (2026-07-06): a staggering of soft 'ssh's
  // that then LIFTS, bright and sunny (no crush). Five breathy, broad low-Q noise 'ssh' bursts
  // fan out (each slightly higher, softly staggered, like leaf-shutter blades or soft air), THEN a
  // rising, sunny lift: a climb G5-C6-D6 up to a WARM top that bends UP (E6 to F6) and rings out
  // with an airy shimmer and a sparkle. The moment does not close abruptly; it opens up. This is THE
  // download / capture sound. About 1.5s, with room to breathe (it fires once, on the capture).
  shutter(ctx, out) {
    tick(ctx, out, { dur: 0.060, peak: 0.10, freq: 4600, q: 0.35 });               // 'ssh' 1
    tick(ctx, out, { dur: 0.060, peak: 0.11, freq: 5100, q: 0.35, delay: 0.09 });  // 'ssh' 2
    tick(ctx, out, { dur: 0.055, peak: 0.11, freq: 5600, q: 0.35, delay: 0.18 });  // 'ssh' 3
    tick(ctx, out, { dur: 0.050, peak: 0.10, freq: 6200, q: 0.35, delay: 0.27 });  // 'ssh' 4
    tick(ctx, out, { dur: 0.050, peak: 0.09, freq: 6800, q: 0.35, delay: 0.35 });  // 'ssh' 5 - softest, trailing into the lift
    // …then the bright, sunny LIFT: a rising figure that climbs and inflects UP, ringing out.
    blip(ctx, out, { type: 'sine',     from: 784,  dur: 0.16, peak: 0.20, delay: 0.44 });             // G5
    blip(ctx, out, { type: 'sine',     from: 1047, dur: 0.18, peak: 0.20, delay: 0.60 });             // C6
    blip(ctx, out, { type: 'sine',     from: 1175, dur: 0.20, peak: 0.19, delay: 0.78 });             // D6
    blip(ctx, out, { type: 'triangle', from: 1319, to: 1397, dur: 0.60, peak: 0.19, delay: 0.96 });   // E6 → F6, warm top bending UP - the lift
    blip(ctx, out, { type: 'sine',     from: 1397, dur: 0.50, peak: 0.11, delay: 1.05 });             // F6 pure shine at the peak
    blip(ctx, out, { type: 'triangle', from: 1760, to: 2093, dur: 0.42, peak: 0.06, delay: 0.98 });   // airy high shimmer above, quiet
    tick(ctx, out, { dur: 0.012, peak: 0.08, freq: 7200, q: 1.0, delay: 0.96 });                       // sparkle at the peak
  },
  // A super-soft, quick riffle for a section opening its contents: a few faint papery
  // ticks in fast succession, like a stack of cards fanning open. Sits UNDER the reveal
  // animation, never over it: quiet (peak about 0.1) and broad (low Q, airy not tonal).
  shuffle(ctx, out) {
    for (let i = 0; i < 5; i++) {
      tick(ctx, out, {
        dur: 0.02,
        peak: 0.09 + Math.random() * 0.03,
        freq: 2600 + Math.random() * 1500, // papery mid-high, varied so it flutters
        q: 0.4,
        delay: i * 0.028 + Math.random() * 0.006,
      });
    }
  },
  // Switching the featured strip to COVER FLOW: cool and futuristic, WITHOUT the buzz. The
  // old twin sawtooth glissandi sounded like a raspberry ("fart"); replaced with an airy filtered
  // sweep, a clean ascending arpeggio in pure SINE tones (a major triad up an octave), and a
  // sparkle on top. Still says "holographic 3D mode powering up", but smooth, not buzzy.
  coverflow(ctx, out) {
    sweep(ctx, out, { dur: 0.34, peak: 0.13, cutoffFrom: 600, cutoffTo: 5200 });
    [523, 784, 1047].forEach((f, i) =>
      blip(ctx, out, { type: 'sine', from: f, dur: 0.3 - i * 0.03, peak: 0.24 - i * 0.03, delay: i * 0.05 }));
    tick(ctx, out, { dur: 0.02, peak: 0.16, freq: 6000, q: 0.9, delay: 0.16 });
    blip(ctx, out, { type: 'triangle', from: 2093, to: 2637, dur: 0.3, peak: 0.09, delay: 0.2 });
  },
  // Switching the featured strip to GALLERY: modern and refined. A clean, warm
  // two-note lift (a perfect fifth) with a whisper of high for clarity. No noise, no
  // flash: understated and polished.
  gallery(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 660, dur: 0.24, peak: 0.26 });
    blip(ctx, out, { type: 'sine', from: 990, dur: 0.3, peak: 0.19, delay: 0.045 });
    tick(ctx, out, { dur: 0.009, peak: 0.11, freq: 3400, q: 1.0, delay: 0.045 });
  },
  // A quick, bright "ready" lift played the instant before the export shutter fires on a
  // tool SAVE: a short two-note rise (a perfect fifth) so the save feels deliberate and
  // upbeat, then the camera's ka-chunk lands a beat later. Kept snappy (about 0.1s) so it clearly
  // PRECEDES the shutter rather than muddying it.
  save(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 680,  dur: 0.06,  peak: 0.34 });
    blip(ctx, out, { type: 'triangle', from: 1020, dur: 0.075, peak: 0.3, delay: 0.045 });
    tick(ctx, out, { dur: 0.008, peak: 0.1, freq: 3600, q: 1.0, delay: 0.045 });
  },
  // Saving the PROFILE is a small "you're all set" moment, so it earns a warmer,
  // fuller cue than a tool save: a clean ascending arpeggio (pure sine, no reedy saw)
  // that RISES the whole way and lands on its highest, brightest note last, a light
  // upward inflection that shines and rings out, the sound of arrival.
  saveProfile(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 523,  dur: 0.16, peak: 0.24 });                // C5
    blip(ctx, out, { type: 'sine', from: 659,  dur: 0.16, peak: 0.23, delay: 0.09 });   // E5
    blip(ctx, out, { type: 'sine', from: 784,  dur: 0.18, peak: 0.22, delay: 0.18 });   // G5
    blip(ctx, out, { type: 'sine', from: 1047, dur: 0.24, peak: 0.22, delay: 0.28 });   // C6
    // The arrival - highest and brightest LAST, inflecting UP (E6→A6): a light, shining
    // top that bends upward and rings out a touch longer than the notes below it.
    blip(ctx, out, { type: 'triangle', from: 1319, to: 1760, dur: 0.5,  peak: 0.2,  delay: 0.42 }); // E6→A6 bright rising top
    blip(ctx, out, { type: 'sine',     from: 1760,            dur: 0.42, peak: 0.11, delay: 0.5 });  // A6 pure shine at the peak
    tick(ctx, out, { dur: 0.01, peak: 0.09, freq: 6200, q: 1.0, delay: 0.44 });                      // sparkle on the peak
  },
  // Export my data: the bundle flies out to a file. A full, airy whoosh, filtered noise
  // opening UPWARD and outward with a light doppler tone riding over it. Reads as "sent".
  whoosh(ctx, out) {
    sweep(ctx, out, { dur: 0.5, peak: 0.34, cutoffFrom: 320, cutoffTo: 4600 });
    blip(ctx, out, { type: 'sine', from: 300, to: 760, dur: 0.42, peak: 0.14 });
    tick(ctx, out, { dur: 0.03, peak: 0.1, freq: 5200, q: 0.5, delay: 0.34 });
  },
  // Import data: the opposite gesture, a vacuum suck pulling everything IN. Filtered noise
  // closes DOWN and in over a descending tone, then a soft low "thunk" as the data lands
  // here. The mirror image of whoosh, so out vs in read as clearly opposite.
  vacuum(ctx, out) {
    sweep(ctx, out, { dur: 0.5, peak: 0.34, cutoffFrom: 4600, cutoffTo: 300 });
    blip(ctx, out, { type: 'triangle', from: 660, to: 150, dur: 0.46, peak: 0.16 });
    blip(ctx, out, { type: 'sine', from: 180, to: 120, dur: 0.16, peak: 0.32, delay: 0.47 }); // landing thunk
  },
  // Export EVERYTHING and render it all: the big one. A long, victorious brass fanfare.
  // Discrete sawtooth NOTES (glides read as a raspberry, so no portamento) give a trumpet
  // timbre. An ascending "ta-ta-ta-TAA" lands on a long, sustained C-major chord doubled an
  // octave down for brass-section body, with a low root for weight and a bright confetti
  // shimmer over the top. Deliberately the longest, grandest cue in the app (about 1.6s).
  fanfare(ctx, out) {
    // A trumpet-ish voice: a sawtooth note doubled an octave below with a sine to round the
    // reedy edge - three layers per note so it reads as a brass section, not a lone beep.
    const brass = (from: number, dur: number, peak: number, delay: number): void => {
      blip(ctx, out, { type: 'sawtooth', from,            dur, peak,             delay });
      blip(ctx, out, { type: 'sawtooth', from: from / 2,  dur, peak: peak * 0.5, delay });
      blip(ctx, out, { type: 'sine',     from,            dur, peak: peak * 0.4, delay });
    };
    brass(523,  0.16, 0.26, 0.0);   // C5 - ta
    brass(659,  0.16, 0.26, 0.15);  // E5 - ta
    brass(784,  0.2,  0.28, 0.3);   // G5 - ta
    brass(1047, 0.95, 0.3,  0.48);  // C6 - TAAA (held, the arrival)
    blip(ctx, out, { type: 'sawtooth', from: 1319, dur: 0.9,  peak: 0.14, delay: 0.52 }); // E6
    blip(ctx, out, { type: 'sawtooth', from: 1568, dur: 0.9,  peak: 0.12, delay: 0.56 }); // G6
    blip(ctx, out, { type: 'sine',     from: 262,  dur: 0.98, peak: 0.2,  delay: 0.48 }); // C4 low root - weight
    blip(ctx, out, { type: 'triangle', from: 2093, to: 2637, dur: 0.7, peak: 0.09, delay: 0.62 }); // shimmer
    tick(ctx, out, { dur: 0.012, peak: 0.12, freq: 6200, q: 1.0, delay: 0.62 });
  },
  // Favouriting: a little star lights up. Two high bell tones leap up a fourth with
  // airy high sparkles either side. Bright and quick, the literal sound of a
  // twinkle. Kept quiet so it delights rather than startles.
  twinkle(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 1568, dur: 0.13, peak: 0.2 });                // G6
    blip(ctx, out, { type: 'sine', from: 2093, dur: 0.16, peak: 0.17, delay: 0.06 });  // C7
    tick(ctx, out, { dur: 0.01,  peak: 0.12, freq: 7200, q: 1.2 });
    tick(ctx, out, { dur: 0.012, peak: 0.1,  freq: 8400, q: 1.2, delay: 0.085 });
    blip(ctx, out, { type: 'triangle', from: 2637, to: 3136, dur: 0.14, peak: 0.06, delay: 0.05 }); // shimmer up
  },
  // Changing an icon's colour theme: a very airy wash of colour. A soft, breathy
  // filtered-noise sweep opens upward under a gentle high tone gliding up. Light and
  // diffuse (airy, not tonal) so it feels like a new hue washing across the icons.
  shimmer(ctx, out) {
    sweep(ctx, out, { dur: 0.34, peak: 0.16, cutoffFrom: 900, cutoffTo: 6000 });
    blip(ctx, out, { type: 'sine', from: 1318, to: 1760, dur: 0.28, peak: 0.1 });      // E6→A6 gentle glide
    tick(ctx, out, { dur: 0.02, peak: 0.06, freq: 7000, q: 0.4, delay: 0.14 });
  },
  // One item in a bulk-render queue just finished: a soft, satisfying bell "ding". A clean
  // bell tone with a quiet higher partial for shimmer and a whisper of a mallet strike.
  // Deliberately quiet: it repeats once per rendered item, so it must reassure, never nag.
  ding(ctx, out) {
    tick(ctx, out, { dur: 0.006, peak: 0.07, freq: 5000, q: 1.1 });                     // soft mallet strike
    blip(ctx, out, { type: 'sine', from: 1568, dur: 0.3,  peak: 0.17 });                // G6 bell body
    blip(ctx, out, { type: 'sine', from: 2349, dur: 0.24, peak: 0.05, delay: 0.004 });  // D7 partial - bell shimmer
  },
  // A single render finished: a modest, bright "ta-da". A quick rising major arpeggio
  // (G5-C6-E6-G6) capped by a light sparkle. Celebratory but compact (about 0.5s), the subtle
  // sibling of the batch fanfare, so ONE render feels rewarding without the full trumpet.
  victory(ctx, out) {
    blip(ctx, out, { type: 'sine',     from: 784,  dur: 0.12, peak: 0.24 });                // G5
    blip(ctx, out, { type: 'sine',     from: 1047, dur: 0.14, peak: 0.24, delay: 0.08 });   // C6
    blip(ctx, out, { type: 'triangle', from: 1319, dur: 0.34, peak: 0.22, delay: 0.16 });   // E6 - the "-da", rings out
    blip(ctx, out, { type: 'sine',     from: 1568, dur: 0.3,  peak: 0.12, delay: 0.18 });   // G6 shine on top
    tick(ctx, out, { dur: 0.01, peak: 0.09, freq: 6000, q: 1.0, delay: 0.16 });             // sparkle
  },
  // The "braaam": a deep cinematic brass hit for the Verify verdict when a credential is
  // intact (the moment the green medallion lights up). It is SOFT (lowpass-tamed saws, never a
  // buzzer), FAST (about a 30ms punch, firing the instant it's triggered), and DEEP (an A1 root
  // plus fifth plus octave over a pure sub). It is allowed to RING LONGER than any other cue
  // (about a 2s tail). Open fifths keep it triumphant, not ominous. A whisper of high shimmer tips
  // it toward "authentic!" rather than "doom". The single most impressive sound in the app.
  braaam(ctx, out) {
    const D = 2.0;
    tick(ctx, out, { dur: 0.05, peak: 0.05, freq: 480, q: 0.5 });                                            // soft brass "chiff" on the attack
    brass(ctx, out, { from: 55.00, dur: D,        peak: 0.24, attack: 0.028, cutoffFrom: 150, cutoffTo: 1500, bloom: 0.24, detune: 13 });          // A1 - the weight
    brass(ctx, out, { from: 82.41, dur: D * 0.94, peak: 0.15, attack: 0.032, cutoffFrom: 190, cutoffTo: 1900, bloom: 0.22, detune: 11, delay: 0.006 }); // E2 - the fifth
    brass(ctx, out, { from: 110.0, dur: D * 0.86, peak: 0.11, attack: 0.036, cutoffFrom: 240, cutoffTo: 2300, bloom: 0.2,  detune: 9,  delay: 0.012 }); // A2 - presence
    blip(ctx, out, { type: 'sine', from: 55.00, to: 51, dur: D, peak: 0.20 });                               // pure sub - chest weight, no buzz
    blip(ctx, out, { type: 'triangle', from: 880, dur: 0.6, peak: 0.045, delay: 0.05 });                     // a whisper of shimmer - triumphant, not grim
    blip(ctx, out, { type: 'sine', from: 1760, dur: 0.4, peak: 0.02, delay: 0.06 });                         // faint top glint
  },
  // The "signing" flourish for a VALID Lolly credential (the green medallion moment on the
  // Verify page). Andy's brief (2026-07-07): a bright, long, almost-CHIRPING signature. Quick
  // up-gliding chirps run UP a scale then back DOWN, ending on a final RISE and a bell DING.
  // Where the old "braaam" was a deep brass hit, this is high, sparkly and playful: the sound of
  // a document being signed off and cleared. It is pentatonic so every chirp lands consonant.
  sign(ctx, out) {
    // Each note is a quick UPWARD glide, the "chirp", stepping through a pentatonic run.
    const chirp = (from: number, delay: number, peak = 0.2): void =>
      blip(ctx, out, { type: 'sine', from, to: from * 1.06, dur: 0.1, peak, delay });
    const up   = [1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00]; // C6 D6 E6 G6 A6 C7 - up the scale
    const down = [1760.00, 1567.98, 1318.51, 1174.66];                    // A6 G6 E6 D6 - …and back down
    const step = 0.072;
    up.forEach((f, i)   => chirp(f, i * step, 0.2));
    down.forEach((f, i) => chirp(f, (up.length + i) * step, 0.17));
    // A few airy sparkles riding the run so it glints like a nib catching the light.
    [0, 3, 6].forEach((i) => tick(ctx, out, { dur: 0.008, peak: 0.05, freq: 7000 + i * 400, q: 1.2, delay: i * step }));
    // …then END ON A RISE: a bright chirp sweeping up high, capped by a bell DING at the top.
    const end = (up.length + down.length) * step;                                                       // after the up-and-down run
    blip(ctx, out, { type: 'triangle', from: 1318.51, to: 2637.02, dur: 0.42, peak: 0.2, delay: end });  // the final rise, E6 → E7
    bell(ctx, out, { freq: 2637.02, dur: 0.6, peak: 0.2, delay: end + 0.18 });                            // the DING at the top
    tick(ctx, out, { dur: 0.012, peak: 0.09, freq: 8000, q: 1.0, delay: end + 0.18 });                    // sparkle on the ding
  },
  // The gentle inverse of victory: a soft, low, DESCENDING two-note "uh-oh" with a
  // little low body. It signals "didn't pass" (a broken or missing credential) without a
  // harsh buzzer. Deliberately quiet and cautionary, never alarming.
  warn(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 392, dur: 0.14, peak: 0.16 });                 // G4
    blip(ctx, out, { type: 'triangle', from: 294, to: 262, dur: 0.26, peak: 0.15, delay: 0.13 }); // D4→C4 - falls
    blip(ctx, out, { type: 'sine',     from: 130, to: 98,  dur: 0.28, peak: 0.09, delay: 0.13 }); // low body
  },
  // A spooky ghost "hoooo", played on the Verify page when a credential DECLARES
  // AI-generated content (layered under the verdict cue, as the purple AI banner
  // appears). A wavering "oo" wail: a low carrier swells in breathy, rises then
  // droops, with a widening vibrato for the ghostly waver and a hollow partner a
  // fifth up tuned slightly flat so the two beat against each other (the eerie
  // shimmer). "oo" vowel formants shape the "hooo"; a drift of airy breath haunts
  // underneath. Quiet and long-tailed: it haunts, never jump-scares.
  ghost(ctx, out) {
    if (material === 'kiki') { creak(ctx, out); return; }   // a wail is all bloop: Kiki creaks a door instead
    const t0 = ctx.currentTime;
    const eps = 0.0001;
    const D = 1.6;
    // Vibrato LFO - the waver. Widens toward the peak of the wail, then eases off.
    const vib = ctx.createOscillator(); vib.type = 'sine';
    vib.frequency.setValueAtTime(5.2, t0);
    const vibg = ctx.createGain();
    vibg.gain.setValueAtTime(6, t0);
    vibg.gain.linearRampToValueAtTime(15, t0 + D * 0.5);   // waver widens into the "…OOO…"
    vibg.gain.linearRampToValueAtTime(7, t0 + D);          // settles as it drifts away
    vib.connect(vibg);
    // Shared "oo" formant sum + breathy amp envelope.
    const sum = ctx.createGain();
    const g = ctx.createGain();
    g.gain.setValueAtTime(eps, t0);
    g.gain.exponentialRampToValueAtTime(0.24, t0 + 0.4);   // breathy swell - "hoo…"
    g.gain.exponentialRampToValueAtTime(0.17, t0 + D * 0.7);
    g.gain.exponentialRampToValueAtTime(eps, t0 + D);      // …drifts away
    sum.connect(g).connect(out);
    const formant = (freq: number, q: number, gain: number, src: AudioNode): void => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq, t0); bp.Q.setValueAtTime(q, t0);
      const fg = ctx.createGain(); fg.gain.value = gain;
      src.connect(bp).connect(fg).connect(sum);
    };
    // Two wailing voices: a low carrier that rises then droops, and a hollow fifth
    // over it tuned slightly flat, so the pair beat against each other for the eerie moan.
    const voice = (base: number, level: number, flat: number): void => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base, t0);
      o.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + D * 0.42); // rise - "hoo-OOO"
      o.frequency.exponentialRampToValueAtTime(base * 0.9, t0 + D);        // droop - "…ooo"
      o.detune.setValueAtTime(flat, t0);
      vibg.connect(o.frequency);                                            // share the waver
      const lvl = ctx.createGain(); lvl.gain.value = level; o.connect(lvl);
      formant(360, 6, 1.0, lvl);   // F1 of "oo"
      formant(860, 8, 0.45, lvl);  // F2 of "oo"
      o.start(t0); o.stop(t0 + D + 0.06);
    };
    voice(196, 0.5, 0);    // G3 carrier - the body of the moan
    voice(294, 0.3, -22);  // D4, ~22 cents flat - hollow, beating, eerie
    vib.start(t0); vib.stop(t0 + D + 0.06);
    // A drift of airy breath under the wail - spectral hiss, quiet.
    sweep(ctx, out, { dur: D * 0.85, peak: 0.05, cutoffFrom: 900, cutoffTo: 400, delay: 0.15 });
  },
  // A quick, quiet "shoo" for dismissing a modal/overlay: a short airy hush that
  // falls away fast (filtered noise sweeping high to low). Barely there, never a whoosh.
  shoo(ctx, out) {
    sweep(ctx, out, { dur: 0.11, peak: 0.12, cutoffFrom: 5600, cutoffTo: 1500 });
  },
  // MOTION filter: a film reel spinning up. Dry ticks ACCELERATE and fade, then
  // blur into a smooth, quiet whir at running speed.
  reel(ctx, out) {
    let t = 0, gap = 0.085;
    for (let i = 0; i < 16; i++) {
      const p = i / 15;                                     // 0 → 1 across the spin-up
      tick(ctx, out, { dur: 0.012, peak: 0.03 + 0.12 * (1 - p), freq: 2300 + p * 1400, q: 1.1, delay: t });
      t += gap; gap *= 0.82;                                // each interval shorter → accelerando
    }
    blip(ctx, out, { type: 'sawtooth', from: 68, dur: 0.5, peak: 0.045, delay: t * 0.55 }); // smooth running whir
  },
  // IMAGE filter: a quick camera iris/shutter "snick". A crisp mechanical click with a
  // light body and a soft airy tail. Lighter than the capture shutter.
  aperture(ctx, out) {
    tick(ctx, out, { dur: 0.008, peak: 0.26, freq: 5200, q: 1.0 });
    tick(ctx, out, { dur: 0.016, peak: 0.32, freq: 3200, q: 0.8 });
    blip(ctx, out, { type: 'sine', from: 260, to: 150, dur: 0.04, peak: 0.2 });
    tick(ctx, out, { dur: 0.09, peak: 0.09, freq: 4800, q: 0.4, delay: 0.02 });
  },
  // VECTOR filter: a quick pencil scribble. A fast burst of dry, scratchy filtered-noise
  // ticks, pitch- and timing-jittered so it scratches on paper rather than repeats.
  scribble(ctx, out) {
    let t = 0;
    for (let i = 0; i < 9; i++) {
      tick(ctx, out, { dur: 0.02, peak: 0.08 + Math.random() * 0.04, freq: 1900 + Math.random() * 2300, q: 0.5, delay: t });
      t += 0.02 + Math.random() * 0.022;
    }
  },
  // AUDIO filter: a bright synth pulse that lights up like a waveform. A soft low
  // "kick" thump plays under a rising two-note chime (the beat catching light), with a
  // few quick high ticks scattered across it like an EQ meter flickering.
  waveform(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 110, to: 90, dur: 0.16, peak: 0.28 });
    blip(ctx, out, { type: 'triangle', from: 587.33, dur: 0.30, peak: 0.20, delay: 0.03 });
    blip(ctx, out, { type: 'triangle', from: 880.00, dur: 0.26, peak: 0.14, delay: 0.06 });
    tick(ctx, out, { dur: 0.012, peak: 0.08, freq: 6200, q: 1.0, delay: 0.02 });
    tick(ctx, out, { dur: 0.012, peak: 0.07, freq: 4200, q: 1.0, delay: 0.09 });
    tick(ctx, out, { dur: 0.012, peak: 0.06, freq: 8000, q: 1.0, delay: 0.15 });
  },
  // Opting IN to using your details: the most magical moment in the app. A shimmering bell
  // CASCADE rises then gently falls back (a pentatonic run, so every note is consonant), with
  // sparkles on the climb, a bright shimmer glide over the peak, and a warm low root for body.
  // The sound of everything lighting up and personalising itself for you.
  optIn(ctx, out) {
    const up = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1318.51]; // C D E G A C E (penta)
    const step = 0.058;
    up.forEach((f, i) => {
      blip(ctx, out, { type: 'sine', from: f, dur: 0.36 - i * 0.02, peak: 0.2, delay: i * step });
      if (i % 2 === 0) tick(ctx, out, { dur: 0.008, peak: 0.05, freq: Math.min(f * 4, 11000), q: 1.2, delay: i * step });
    });
    const peak = up.length * step;
    [1046.50, 880.00, 783.99, 659.25, 587.33, 523.25].forEach((f, i) => // …and gently back down
      blip(ctx, out, { type: 'sine', from: f, dur: 0.34 + i * 0.02, peak: 0.17 - i * 0.012, delay: peak + i * step }));
    blip(ctx, out, { type: 'triangle', from: 1318.51, to: 2637.02, dur: 0.5, peak: 0.07, delay: peak - 0.12 }); // shimmer glide over the top
    tick(ctx, out, { dur: 0.012, peak: 0.09, freq: 8000, q: 1.0, delay: peak - 0.02 });                          // sparkle at the peak
    blip(ctx, out, { type: 'sine', from: 261.63, dur: 1.0, peak: 0.12, delay: 0.02 });                           // warm low root - magic with weight
    blip(ctx, out, { type: 'sine', from: 392.00, dur: 0.9, peak: 0.08, delay: 0.05 });                           // a fifth over the root
  },
  // Opting OUT: very sad. A slow DESCENDING minor sigh that droops at the end. Falling steps,
  // then a long downward bend that keeps sinking (the "aww"), over a hollow low body also sinking.
  optOut(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 440.00, to: 415.30, dur: 0.36, peak: 0.24 });                // A4, already sagging
    blip(ctx, out, { type: 'triangle', from: 392.00, to: 369.99, dur: 0.40, peak: 0.24, delay: 0.32 });   // G4
    blip(ctx, out, { type: 'triangle', from: 349.23, to: 311.13, dur: 0.46, peak: 0.24, delay: 0.68 });   // F4 → E♭
    blip(ctx, out, { type: 'sawtooth', from: 311.13, to: 174.61, dur: 0.85, peak: 0.20, delay: 1.08 });   // the long final droop, E♭4 → F3
    blip(ctx, out, { type: 'sine',     from: 174.61, to: 116.54, dur: 0.95, peak: 0.15, delay: 1.06 });   // hollow low body, F3 → B♭2
  },
  // Clearing ALL data: the "bye-bye song". A fond sing-song wave goodbye, NOT the sombre
  // optOut sigh above (the slate is being wiped clean for a fresh hello, so it should smile).
  // Two drooping notes play the classic falling sing-song third, then a gentle farewell
  // walk-down settles on a warm low root, while a soft receding whoosh underneath carries the
  // data away, and a tiny click sounds as the door closes. (The two notes used to be
  // a synthesised voice singing "bye~"; spoken sounds are gone.)
  byebye(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 784, to: 627, dur: 0.22, peak: 0.24 });              // G5 drooping down
    blip(ctx, out, { type: 'triangle', from: 622, to: 473, dur: 0.28, peak: 0.22, delay: 0.30 }); // a third lower, drooping further
    // …a little farewell walk-down, each step softer: G5 E5 D5 C5.
    [783.99, 659.25, 587.33, 523.25].forEach((f, i) =>
      blip(ctx, out, { type: 'sine', from: f, dur: 0.24 + i * 0.05, peak: 0.16 - i * 0.02, delay: 0.68 + i * 0.14 }));
    blip(ctx, out, { type: 'sine', from: 261.63, dur: 0.8, peak: 0.12, delay: 1.1 });        // C4 warm root - settled, at peace
    sweep(ctx, out, { dur: 0.7, peak: 0.15, cutoffFrom: 2400, cutoffTo: 220, delay: 0.8 });  // the data receding away
    tick(ctx, out, { dur: 0.02, peak: 0.09, freq: 1700, q: 0.8, delay: 1.55 });              // the door closes softly behind it
  },
  // A single keystroke in a text field: a soft mechanical "clack". A low woody
  // band-passed tick with a whisper of a low body under it. Deliberately quiet and very
  // short (about 14ms) and pitch-jittered, so a fast run of typing reads like a keyboard, not
  // a buzz. Lower and woodier than the bright UI `click`, so typing does not sound like pressing a button.
  key(ctx, out) {
    tick(ctx, out, { dur: 0.014, peak: 0.10, freq: 1500 + Math.random() * 500, q: 0.7 });
    blip(ctx, out, { type: 'sine', from: 190 + Math.random() * 40, to: 150, dur: 0.03, peak: 0.06 }); // tiny "thock"
  },
  // Dragging a slider: a tiny detent tick as a notched fader passes a step. The SAME
  // paper-flick family as the gallery/coverflow card riffle (`flick`), but deliberately
  // SOFTER: quieter (about half the peak) and woodier (lower centre and lower Q, so it's a
  // muted "tock", not a bright "tick"). The caller ticks it per step and rate-limits it, so a
  // fast drag flutters like a ratchet rather than a solid tone.
  slider(ctx, out) {
    tick(ctx, out, { dur: 0.011, peak: 0.05, freq: 2000 + Math.random() * 700, q: 0.85 });
  },
  // An item joining or leaving a selection (Assets, Projects, the gallery): a very short,
  // bright tap with a hint of pitch, so a marquee sweeping across a grid ticks once per
  // tile like beads on an abacus. Kept under 20 ms so a fast sweep never smears.
  tick(ctx, out) {
    tick(ctx, out, { dur: 0.014, peak: 0.12, freq: 3200 + Math.random() * 400, q: 1.4 });
    blip(ctx, out, { type: 'sine', from: 1850, to: 1700, dur: 0.018, peak: 0.05 });
  },
  // Dragging a Figma-style number scrub (the export width/height fields, vector scrubs):
  // the "better", more mechanical sibling of the slider tick. A crisp detent tick with a
  // tiny low tonal "notch" under it, so a precision drag clicks through calibrated stops
  // like a milled dial. A touch more present than the ambient slider, but still quiet.
  scrub(ctx, out) {
    tick(ctx, out, { dur: 0.009, peak: 0.07, freq: 2500 + Math.random() * 300, q: 1.1 });
    blip(ctx, out, { type: 'sine', from: 430, to: 360, dur: 0.022, peak: 0.05 });
  },
  // Changing a <select>: a soft two-part detent. A tight tick plus a tiny upward tonal
  // "notch", so choosing an option feels like a dial clicking into a slot.
  select(ctx, out) {
    tick(ctx, out, { dur: 0.010, peak: 0.11, freq: 2100, q: 1.1 });
    blip(ctx, out, { type: 'sine', from: 640, to: 760, dur: 0.04, peak: 0.11 });
  },
  // Opening the Export panel: "Radar Bloom" (Andy, Sound Lab 2026-07-06). The scope coming
  // alive. A deep tone SWELLS up resonantly (fundamental plus a fifth over it) with an airy scan
  // sweeping over the top and a soft glint at the peak. Calm, deep, blooming open. (Name kept
  // for the wiring: render-fab data-sfx. The old hydraulic door is retired.)
  hydraulicOpen(ctx, out) {
    surge(ctx, out, { type: 'sine', from: 174, to: 262, dur: 1.0, peak: 0.24, attack: 0.30 });          // deep swell rising - blooms in
    surge(ctx, out, { type: 'sine', from: 262, to: 392, dur: 1.0, peak: 0.12, attack: 0.34, detune: 5 });// a fifth over it - warmth
    sweep(ctx, out, { dur: 0.70, peak: 0.08, cutoffFrom: 400, cutoffTo: 2600 });                         // airy scan over the top
    blip(ctx, out, { type: 'triangle', from: 784, dur: 0.5, peak: 0.06, delay: 0.5 });                   // soft glint at the top
  },
  // Closing the Export panel: the FLIPPED bloom plus a soft crashing hiss fading out (Andy's brief).
  // The deep tone drops instead of rising (a settling-down mirror of the open), under a broad,
  // soft noise 'crash' that washes in bright then bleeds away, a wave receding, sealing low.
  hydraulicClose(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 262, to: 174, dur: 0.70, peak: 0.20 });            // deep tone dropping - flipped bloom
    blip(ctx, out, { type: 'sine', from: 392, to: 262, dur: 0.60, peak: 0.10, delay: 0.01 }); // fifth dropping
    sweep(ctx, out, { dur: 0.85, peak: 0.24, cutoffFrom: 4200, cutoffTo: 420 });             // soft crashing hiss, closing + fading out
    blip(ctx, out, { type: 'sine', from: 150, to: 110, dur: 0.22, peak: 0.13, delay: 0.55 });// a low settle at the bottom
  },
  // Launching the Dashboard (#/d): "Deep Sonar" (Andy, Dashboard Lab 2026-07-06). A warm, deep
  // sonar ping sounding into the deep, a low fundamental with a fifth over a sub octave, and a
  // faint high glint, all ringing out with a long, spacious tail. Pleasant but DEEP. Played on
  // the Dashboard nav buttons (the launch).
  dashboard(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 196, dur: 1.4, peak: 0.30 });                 // G3 deep ping, long ring
    blip(ctx, out, { type: 'sine', from: 294, dur: 1.1, peak: 0.12, delay: 0.02 });    // D4 fifth
    blip(ctx, out, { type: 'sine', from: 98,  dur: 1.2, peak: 0.16 });                 // G2 sub octave - real depth
    blip(ctx, out, { type: 'triangle', from: 784, dur: 0.5, peak: 0.04, delay: 0.03 });// a faint high glint
  },
  // Opening TOOL DETAILS (the gallery info modal) or an ASSET's details (the catalog):
  // "Whisper" (Andy's pick, Sound Lab 2026-07-07). An airy light elevation, almost all air. A
  // breathy filtered sweep opens upward and outward with just a faint tone rising under it,
  // like wind and tyres, barely a pitch. The panel lifting into view, not a click. Sibling of the
  // "Land" dismiss below (same elevation family).
  whisper(ctx, out) {
    sweep(ctx, out, { dur: 0.52, peak: 0.20, cutoffFrom: 400, cutoffTo: 4800 });
    surge(ctx, out, { type: 'sine', from: 300, to: 820, dur: 0.44, peak: 0.09, attack: 0.14 });
    tick(ctx, out, { dur: 0.03, peak: 0.06, freq: 5600, q: 0.4, delay: 0.34 });
  },
  // The unsaved-changes / "save before leaving?" dialog APPEARING: "Crystal" (Andy's pick).
  // A glass-elevator lift. A clean two-note rise (a perfect fifth) with an airy glide over the
  // top and a pinch of sparkle, elegant and light, the decision rising up to meet you.
  crystal(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 660, dur: 0.26, peak: 0.22 });
    blip(ctx, out, { type: 'sine', from: 990, dur: 0.34, peak: 0.18, delay: 0.06 });
    surge(ctx, out, { type: 'sine', from: 1320, to: 1980, dur: 0.4, peak: 0.06, attack: 0.14, delay: 0.05 });
    sweep(ctx, out, { dur: 0.34, peak: 0.09, cutoffFrom: 1400, cutoffTo: 6000 });
    tick(ctx, out, { dur: 0.009, peak: 0.07, freq: 8000, q: 1.2, delay: 0.12 });
  },
  // Dismissing that dialog with Cancel (or Escape): "Land", the takeoff run in REVERSE. The
  // same voices as the "Liftoff" audition, time-flipped: the pitch glides DOWN, the airy sweep
  // CLOSES instead of opening, and the little tick lands early as the release. The panel settles
  // back down, nothing changed, the mirror of the elevation cues above.
  land(ctx, out) {
    surge(ctx, out, { type: 'triangle', from: 720, to: 200, dur: 0.5, peak: 0.22, attack: 0.10 });
    surge(ctx, out, { type: 'sine', from: 1080, to: 300, dur: 0.5, peak: 0.09, attack: 0.12, detune: 6 });
    sweep(ctx, out, { dur: 0.42, peak: 0.10, cutoffFrom: 3600, cutoffTo: 600 });
    tick(ctx, out, { dur: 0.012, peak: 0.06, freq: 6800, q: 1.0, delay: 0.12 });
  },
  // A section opening (a <details> summary, or a button that shows what it controls): a quick
  // two-note rise, D5 up to A5, with a pinch of air on the second note. Quiet, because a
  // settings page opens and closes a lot of these.
  expand(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 587, dur: 0.09, peak: 0.15 });
    blip(ctx, out, { type: 'sine', from: 880, dur: 0.16, peak: 0.13, delay: 0.055 });
    tick(ctx, out, { dur: 0.008, peak: 0.05, freq: 4200, q: 1.0, delay: 0.055 });
  },
  // …and closing again: the same two notes falling, settling onto a soft low body.
  collapse(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 880, dur: 0.08, peak: 0.13 });
    blip(ctx, out, { type: 'sine', from: 587, to: 554, dur: 0.16, peak: 0.14, delay: 0.05 });
    blip(ctx, out, { type: 'sine', from: 196, to: 165, dur: 0.12, peak: 0.07, delay: 0.05 });
  },
  // A switch or checkbox turning on: the sound-on chirp, softer, since a page of switches
  // flips often. The pair steps up.
  switchOn(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 700, dur: 0.045, peak: 0.26 });
    blip(ctx, out, { type: 'triangle', from: 1040, dur: 0.06, peak: 0.26, delay: 0.055 });
  },
  // …and turning off: the same pair stepping down.
  switchOff(ctx, out) {
    blip(ctx, out, { type: 'triangle', from: 1040, dur: 0.045, peak: 0.24 });
    blip(ctx, out, { type: 'triangle', from: 700, dur: 0.07, peak: 0.24, delay: 0.055 });
  },
  // Letting go of the sound shape slider: one short phrase holding every ingredient (a tap,
  // a two-note lift and a breath of air) so the listener hears what the new position changed.
  preview(ctx, out) {
    tick(ctx, out, { dur: 0.007, peak: 0.14, freq: 3600, q: 1.0 });
    blip(ctx, out, { type: 'sine', from: 940, to: 780, dur: 0.024, peak: 0.12 });
    blip(ctx, out, { type: 'sine', from: 660, dur: 0.22, peak: 0.22, delay: 0.12 });
    blip(ctx, out, { type: 'sine', from: 990, dur: 0.3, peak: 0.17, delay: 0.18 });
    tick(ctx, out, { dur: 0.009, peak: 0.08, freq: 3400, q: 1.0, delay: 0.18 });
    sweep(ctx, out, { dur: 0.22, peak: 0.14, cutoffFrom: 900, cutoffTo: 3600, delay: 0.14 });
  },
};

// ── Bouba's bass ────────────────────────────────────────────────────────────────
// The "bwah" layer the round end adds under the weighty moments: things settling, saving,
// finishing, arriving or going. Drawn in the Bouba pass only (renderShaped), so it fades in
// as the slider moves toward Bouba and is never heard at the chimes or at Kiki. Pitches sit
// on the cue's own key so the bass agrees with the notes above.
const C2 = 65.41, D2 = 73.42, F2 = 87.31, G2 = 98.0, A2 = 110.0;
/** One bwah at `freq` for `dur` seconds, `delay` in; `bend` sags the pitch. Peaks are kept low:
 *  most of a bwah's energy is under 200 Hz, where headphones are loud and laptops are not. */
const bass = (freq: number, dur: number, peak: number, delay = 0, bend = 1): Render =>
  (ctx, out) => bwah(ctx, out, { freq, dur, peak, delay, bend });
export const BOUBA_BASS: Partial<Record<SfxName, Render>> = {
  drop: bass(G2, 0.3, 0.11, 0.02),
  delete: bass(D2, 0.42, 0.11, 0, 0.8),
  save: bass(G2, 0.24, 0.055),
  saveProfile: bass(C2, 0.62, 0.11, 0.4),
  victory: bass(C2, 0.5, 0.1, 0.16),
  fanfare: bass(C2, 1.0, 0.12, 0.48),
  sign: bass(C2, 0.6, 0.09, 0.72 + 0.18),
  verify: bass(C2, 0.5, 0.1),
  shutter: bass(F2, 0.6, 0.08, 0.96),
  vacuum: bass(D2, 0.3, 0.1, 0.47),
  dashboard: bass(G2, 1.0, 0.11),
  hydraulicOpen: bass(F2, 0.9, 0.07, 0.1),
  newSession: bass(C2, 0.5, 0.07, 0.08),
  leaveSession: bass(C2, 0.5, 0.09, 0.5),
  optIn: bass(C2, 0.9, 0.1, 0.02),
  // The sad trombone: optOut's long final droop gets a sagging bwah underneath.
  optOut: bass(F2, 0.9, 0.07, 1.08, 0.67),
  warn: bass(D2, 0.3, 0.06, 0.13, 0.89),
  byebye: bass(C2, 0.8, 0.09, 1.1),
  land: bass(D2, 0.36, 0.09, 0.3),
  preview: bass(A2, 0.3, 0.07, 0.12),
};

// ── theme chimes ────────────────────────────────────────────────────────────────
// Changing theme is a small moment of magic, so it gets its own longer, shimmering
// cue, and a DIFFERENT one per theme: light rises (sunrise), dark descends (dusk),
// suse is a warm playful lift. Kept off the SfxName grammar (parameterised by theme
// string) and played via playThemeSfx() at the user-initiated switch sites only.
export const THEME_VOICES: Record<string, (ctx: AudioContext, out: AudioNode) => void> = {
  // Sunrise: a bright ascending sparkle (C E G C) with a high shimmer tail.
  light(ctx, out) {
    [523, 659, 784, 1047].forEach((f, i) =>
      blip(ctx, out, { type: 'sine', from: f, dur: 0.5 - i * 0.05, peak: 0.26, delay: i * 0.075 }));
    blip(ctx, out, { type: 'triangle', from: 1568, to: 2093, dur: 0.42, peak: 0.09, delay: 0.28 });
  },
  // Dusk: a soft descending shimmer (A F D A) over a warm low pad.
  dark(ctx, out) {
    [880, 698, 587, 440].forEach((f, i) =>
      blip(ctx, out, { type: 'sine', from: f, dur: 0.55 - i * 0.04, peak: 0.24, delay: i * 0.085 }));
    blip(ctx, out, { type: 'sine', from: 174, dur: 0.62, peak: 0.18, delay: 0.1 });
  },
  // SUSE: a warm, playful lift with a wink of sparkle, then a gentle settle.
  suse(ctx, out) {
    blip(ctx, out, { type: 'sine', from: 587, dur: 0.42, peak: 0.27 });
    blip(ctx, out, { type: 'sine', from: 880, dur: 0.5, peak: 0.27, delay: 0.09 });
    blip(ctx, out, { type: 'triangle', from: 1318, to: 1760, dur: 0.34, peak: 0.12, delay: 0.19 });
    blip(ctx, out, { type: 'sine', from: 784, dur: 0.46, peak: 0.2, delay: 0.27 });
  },
};

// ── public API ───────────────────────────────────────────────────────────────


// The gallery arrival: faint, high FAIRY BELLS. A quick, sparkly "ding-a-ring-ding"
// of tiny high bells (a C-major sparkle up to a shimmering top and a soft echo),
// each a bright sine with an octave shimmer and a fast decay. High-pitched but quiet,
// delicate, and under a second. Never a chime.
export function renderGalleryBell(ctx: AudioContext, out: AudioNode): void {
  // [freq, peak, ring seconds, delay]: "ding, a, ring, DING, (echo)".
  const notes: readonly (readonly [number, number, number, number])[] = [
    [1046.50, 0.075, 0.34, 0.00],  // C6 - ding
    [1318.51, 0.05,  0.24, 0.10],  // E6 - a
    [1567.98, 0.055, 0.26, 0.18],  // G6 - ring
    [2093.00, 0.07,  0.40, 0.30],  // C7 - DING (the sparkling top)
    [1567.98, 0.038, 0.30, 0.44],  // G6 - a soft echo tail
  ];
  for (const [f, peak, dur, delay] of notes) {
    blip(ctx, out, { type: 'sine', from: f, dur, peak, delay });
    blip(ctx, out, { type: 'sine', from: f * 2, dur: dur * 0.6, peak: peak * 0.4, delay }); // octave shimmer
  }
  tick(ctx, out, { dur: 0.006, peak: 0.05, freq: 7200, q: 1.0, delay: 0.30 }); // a pinch of sparkle on the top ding
}

// Projects arrival: the four rising "stacking" clicks (kept), then a soft, quick puff
// of wind. Band-passed noise fades IN then OUT (a gentle gust); the filter opens
// as it swells and closes as it eases away. Airy, calm and quiet.
export function renderProjectsWind(ctx: AudioContext, out: AudioNode): void {
  const eps = 0.0001;
  for (let i = 0; i < 4; i++) { // the same rising stack the catalog used to lead with
    tick(ctx, out, { dur: 0.02, peak: 0.14 + i * 0.02, freq: 1500 * 1.16 ** i, q: 1.3, delay: i * 0.06 });
  }
  const s = ctx.currentTime + 4 * 0.06; // the gust starts once the stack is done
  const dur = 0.55;
  if (material === 'kiki') {           // Kiki: a gust of blown sand, crackle through a bright band
    scratch(ctx, out, { dur, peak: 0.16, freq: 2600, t0: s });
    return;
  }
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1; // white noise (shell code - Math.random is fine)
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.6;
  bp.frequency.setValueAtTime(500, s);
  bp.frequency.linearRampToValueAtTime(1400, s + dur * 0.5); // opens as it swells
  bp.frequency.linearRampToValueAtTime(700, s + dur);        // closes as it eases off
  const g = ctx.createGain();
  g.gain.setValueAtTime(eps, s);
  g.gain.exponentialRampToValueAtTime(0.11, s + dur * 0.4);  // fade in - the swell
  g.gain.exponentialRampToValueAtTime(eps, s + dur);         // fade out
  src.connect(bp).connect(g).connect(out);
  src.start(s);
  src.stop(s + dur + 0.02);
}

// A reedy, low, breathy FOGHORN: the Catalog arrival's voice. A beating pair of detuned
// sawtooths, a triangle body, and an octave (which carries the low fundamental on small
// speakers), through a dark low-pass, swelling in slowly. `sag` bends the pitch DOWN over
// the tail for the mournful harbour droop. `air` sends a little low-passed breath through it.
function foghorn(ctx: AudioContext, out: AudioNode, opts: {
  freq: number; dur: number; peak?: number; delay?: number; sag?: number; bright?: number; attack?: number; air?: number;
}): void {
  const { freq, dur, peak = 0.34, delay = 0, sag = 0, bright = 640, attack = 0.18, air = 0.1 } = opts;
  const t = ctx.currentTime + delay;
  const eps = 0.0001;
  const env = ctx.createGain();
  env.gain.setValueAtTime(eps, t);
  env.gain.exponentialRampToValueAtTime(peak, t + attack);                    // slow swell in
  env.gain.setValueAtTime(peak, t + Math.min(dur * 0.6, attack + 0.22));      // hold at the peak
  env.gain.exponentialRampToValueAtTime(eps, t + dur);                        // long fade out
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = 0.6;
  lp.connect(env).connect(out);
  const voices: readonly { m: number; det: number; g: number; type: OscillatorType }[] = [
    { m: 1, det: -7, g: 0.5,  type: 'sawtooth' },
    { m: 1, det:  7, g: 0.5,  type: 'sawtooth' }, // the pair beats = the wavering horn
    { m: 1, det:  0, g: 0.55, type: 'triangle' }, // rounder body
    { m: 2, det:  0, g: 0.16, type: 'sawtooth' }, // octave - carries on small speakers
  ];
  for (const v of voices) {
    const o = ctx.createOscillator();
    o.type = v.type;
    o.frequency.setValueAtTime(freq * v.m, t);
    o.detune.setValueAtTime(v.det, t);
    if (sag) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq * v.m * (1 - sag)), t + dur);
    const g = ctx.createGain(); g.gain.value = v.g;
    o.connect(g).connect(lp);
    o.start(t); o.stop(t + dur + 0.05);
  }
  if (air > 0) {                                                              // breath through the horn
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; // shell code - Math.random is fine
    const src = ctx.createBufferSource(); src.buffer = buf;
    const nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(eps, t);
    ng.gain.exponentialRampToValueAtTime(air, t + attack * 0.7);
    ng.gain.exponentialRampToValueAtTime(eps, t + dur * 0.75);
    src.connect(nlp).connect(ng).connect(out);
    src.start(t); src.stop(t + dur + 0.05);
  }
}

// The Catalog arrival: a deep, fast-hitting harbour foghorn (Andy, Sound Lab 2026-07-07,
// LOCKED). Three octaves below the original "Deep Harbor" pitch, a near-instant onset (no
// slow swell), and no book stacking, just the horn, with a mournful downward sag on the tail.
// The roughly 7.25 Hz fundamental is infrasound (felt, not heard); its dense sawtooth harmonics
// (passed up to about 620 Hz) carry the pitch as a low growl on small speakers.
export function renderCatalogHorn(ctx: AudioContext, out: AudioNode): void {
  // Bouba: the horn as one long, low, sagging bwah. Kiki: a struck steel plate, no growl.
  if (material === 'bouba') { bwah(ctx, out, { freq: 55, dur: 1.6, peak: 0.15, bend: 0.93 }); return; }
  if (material === 'kiki') { clash(ctx, out, { freq: 880, dur: 0.8, peak: 0.28 }); return; }
  foghorn(ctx, out, { freq: 7.25, dur: 1.85, peak: 0.5, attack: 0.03, sag: 0.07, bright: 620, air: 0.12 });
}

/** Kiki's ghost: a door creaking open. Irregular grains ring through a narrow resonance that
 *  climbs and falls back, bunching up and spreading out the way a slow hinge does. */
function creak(ctx: AudioContext, out: AudioNode): void {
  const D = 1.4;
  let t = 0;
  let gap = 0.06;
  while (t < D) {
    const p = t / D;
    const t0 = ctx.currentTime + t;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(700 + 900 * Math.sin(p * Math.PI), t0);
    bp.Q.setValueAtTime(18, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(3.5 * (1 - 0.4 * p), t0);
    g.gain.exponentialRampToValueAtTime(EPS, t0 + 0.03);
    noiseSource(ctx, 'white', t0, 0.004).connect(bp).connect(g).connect(out);
    t += gap * (0.6 + Math.random() * 0.8);
    gap = 0.018 + 0.05 * Math.abs(Math.cos(p * Math.PI * 1.5));
  }
}

