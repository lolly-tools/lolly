// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-audio.ts - a design timeline's soundtrack, mixed in Node.
 *
 * The web shell mixes a sequence by opening an OfflineAudioContext, but only as a
 * DECODER: no graph is rendered. Every placed clip is read as PCM and summed by a
 * closed form (`mixWindow`, plans/156 section 1), the master pass is the engine's own
 * -1 dBTP limiter, and the loudness target is the engine's BS.1770 meter. None of
 * that needs a browser. What needed one was the decode, and the Node host already
 * answers that for the two formats it can read honestly (WAV and our procedural
 * ZzFXM songs - see `audio.ts`).
 *
 * So this is the mix, minus the decoder: hand it a PLAN (clip placements, volumes,
 * pans, fades, ducking, fx chains, the bed) and the DECODED PCM per clip, and it
 * returns the same stereo pair the browser would have muxed into the mp4.
 *
 * WHERE THE NUMBERS COME FROM. Everything that shapes a sample is engine code
 * imported here, not re-derived:
 *   • the true-peak limiter        `createTruePeakLimiter` (audio-dynamics.ts)
 *   • BS.1770 integrated loudness  `createLoudnessMeter` + `normalizeGain`
 *   • signal-derived duck windows  `activitySpans`
 *   • the per-clip effect kernels  `parseFxChain` + `processFxPcm` (audio-fx.ts)
 * The two pieces the engine does not own yet are the gain-envelope evaluator and the
 * mix's closed form. Those live in the web shell (`bridge/audio-envelope.ts`,
 * `bridge/mix-window.ts`) and are already DOM-free, so they are MIRRORED below rather
 * than reinvented: same names, same order of operations, same constants. Two copies
 * of a number is a drift risk, so `test/sequence-audio.test.ts` pins this mix against
 * a golden produced by the web modules themselves and fails if either side moves.
 * When the web shell is free to be edited, both files should re-export from here and
 * the mirror can go.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. A clip with `speed !== 1` or a pitch offset is
 * left OUT of the mix and named in `warnings`, because the time-stretch that makes
 * those correct is a browser-side model chunk (`lib/audio-stretch-core.ts`). Mixing
 * such a clip unstretched would put it at the wrong length and the wrong pitch, which
 * is worse than saying it was left out. `clean()` fx entries are skipped for the same
 * reason the engine skips them (the GTCRN model is the shell's), which is the token's
 * documented behaviour, not a new rule.
 */
import {
  createTruePeakLimiter, createLoudnessMeter, normalizeGain, activitySpans,
  parseFxChain, processFxPcm, packWav,
} from '@lolly/engine';

/** Everything mixes at 48 kHz stereo - the rate both AAC and Opus want, and the one
 *  rate the BS.1770 coefficients are published for. Mirrors MIX_RATE/MIX_CHANNELS in
 *  shells/web/src/bridge/sequence-render.ts. */
export const MIX_RATE = 48_000;
export const MIX_CHANNELS = 2;

/** Boundary ramp length, seconds - the bed glides between full and centre.
 *  (MIX_RAMP_SEC in bridge/audio-envelope.ts.) */
const MIX_RAMP_SEC = 0.8;

/** The ceiling one clip fade may run, seconds (MAX_CLIP_FADE_SEC). */
const MAX_CLIP_FADE_SEC = 15;

/** How finely a region where two gain factors ramp together is subdivided: their
 *  product is quadratic and a linear ramp can only approximate it. */
const GAIN_SUBDIVIDE_SEC = 0.05;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── the gain envelope (mirror of shells/web/src/bridge/audio-envelope.ts) ─────

/** One automation event, seconds from envelope t0. ramp=false is a hold from this
 *  value; ramp=true interpolates linearly from the previous event to this one. */
export interface GainEvent { t: number; v: number; ramp: boolean }

/** A window (seconds) over which some other audio is playing. */
export interface DuckSpan { from: number; to: number }

/** Drop to `level` while any of the clip-local `spans` plays. level 1 = no duck. */
export interface ClipDuck { level: number; spans: readonly DuckSpan[] }

/** A volume keyframe in CLIP-LOCAL seconds (the kf grammar's `v` channel). */
export interface VolumeKey { tSec: number; value: number }

/**
 * Evaluate an envelope at time t exactly as Web Audio would (a set holds, a ramp
 * interpolates linearly from the previous event).
 */
export function envelopeGainAt(events: GainEvent[], t: number): number {
  let curV = events.length && !events[0]!.ramp ? events[0]!.v : 1;
  let curT = 0;
  for (const e of events) {
    if (t < e.t) {
      if (!e.ramp) return curV;
      const span = e.t - curT;
      return span > 0 ? curV + (e.v - curV) * ((t - curT) / span) : e.v;
    }
    curV = e.v;
    curT = e.t;
  }
  return curV;
}

/** Is this envelope the do-nothing one (a single set at gain 1)? */
export function isTrivialGain(events: GainEvent[] | null | undefined): boolean {
  return !events || events.length === 0 || (events.length === 1 && !events[0]!.ramp && events[0]!.v === 1);
}

/** Sanitise + sort a caller's volume keys once. */
function cleanVolumeKeys(keys: readonly VolumeKey[] | undefined): VolumeKey[] | null {
  if (!keys || keys.length === 0) return null;
  const out = keys
    .filter((k) => Number.isFinite(k.tSec) && Number.isFinite(k.value))
    .map((k) => ({ tSec: Math.max(0, k.tSec), value: Math.min(2, Math.max(0, k.value)) }))
    .sort((a, b) => a.tSec - b.tSec);
  return out.length ? out : null;
}

/** The v-track value at t: hold before the first key, linear between, hold after. */
function volumeKeyValueAt(keys: readonly VolumeKey[], t: number): number {
  const first = keys[0]!;
  if (t <= first.tSec) return first.value;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t <= k.tSec) {
      const prev = keys[i - 1]!;
      const span = k.tSec - prev.tSec;
      return span > 0 ? prev.value + (k.value - prev.value) * ((t - prev.tSec) / span) : k.value;
    }
  }
  return keys[keys.length - 1]!.value;
}

interface ClipGainShape {
  span: number; g: number; fi: number; fo: number;
  keys: VolumeKey[] | null;
  dl: number;
  dspans: { from: number; to: number; r: number }[] | null;
}

function clipGainShape(o: {
  spanSec: number; gain?: number; fadeInSec?: number; fadeOutSec?: number;
  volumeKeys?: readonly VolumeKey[]; duck?: ClipDuck;
}): ClipGainShape {
  const span = Math.max(0, o.spanSec);
  const g = Math.min(2, Math.max(0, Number.isFinite(o.gain as number) ? (o.gain as number) : 1));
  let fi = Math.max(0, Math.min(o.fadeInSec ?? 0, MAX_CLIP_FADE_SEC));
  let fo = Math.max(0, Math.min(o.fadeOutSec ?? 0, MAX_CLIP_FADE_SEC));
  // Fades that together outrun the clip shrink proportionally and meet in the middle.
  if (span > 0 && fi + fo > span) {
    const k = span / (fi + fo);
    fi *= k;
    fo *= k;
  }
  let dl = 1;
  let dspans: { from: number; to: number; r: number }[] | null = null;
  const duckLevel = clamp01(o.duck?.level ?? 1);
  if (duckLevel < 1 && o.duck?.spans?.length && span > 0) {
    const sorted = o.duck.spans
      .map((s) => ({ from: Math.min(Math.max(0, s.from), span), to: Math.min(Math.max(0, s.to), span) }))
      .filter((s) => s.to - s.from > 0.05)
      .sort((x, y) => x.from - y.from);
    const merged: DuckSpan[] = [];
    for (const s of sorted) {
      const last = merged[merged.length - 1];
      if (last && s.from - last.to < MIX_RAMP_SEC * 2) last.to = Math.max(last.to, s.to);
      else merged.push({ ...s });
    }
    const rs = merged
      .filter((s) => s.to - s.from > 0.1)
      .map((s) => ({ from: s.from, to: s.to, r: Math.min(MIX_RAMP_SEC, (s.to - s.from) / 2) }));
    if (rs.length) { dl = duckLevel; dspans = rs; }
  }
  return { span, g, fi, fo, keys: cleanVolumeKeys(o.volumeKeys), dl, dspans };
}

/** The 0..1 fade factor at t for a resolved shape. */
function fadeFactorAt(sh: ClipGainShape, t: number): number {
  let f = 1;
  if (sh.fi > 0.001 && t < sh.fi) f = Math.min(f, t / sh.fi);
  if (sh.fo > 0.001 && sh.span > 0 && t > sh.span - sh.fo) f = Math.min(f, (sh.span - t) / sh.fo);
  return Math.min(1, Math.max(0, f));
}

/** The 0..1 duck factor at t: 1 outside every span, `dl` inside, linear edge ramps. */
function duckFactorAt(sh: ClipGainShape, t: number): number {
  if (!sh.dspans) return 1;
  let f = 1;
  for (const s of sh.dspans) {
    if (t <= s.from || t >= s.to) continue;
    if (t < s.from + s.r) f = Math.min(f, 1 - (1 - sh.dl) * ((t - s.from) / s.r));
    else if (t > s.to - s.r) f = Math.min(f, 1 - (1 - sh.dl) * ((s.to - t) / s.r));
    else f = Math.min(f, sh.dl);
  }
  return f;
}

/** The full clip-gain value at t: flat gain × fade factor × keyed multiplier × duck. */
function shapeValueAt(sh: ClipGainShape, t: number): number {
  const v = sh.keys ? volumeKeyValueAt(sh.keys, t) : 1;
  return sh.g * fadeFactorAt(sh, t) * v * duckFactorAt(sh, t);
}

function fadeRampsIn(sh: ClipGainShape, a: number, b: number): boolean {
  return (sh.fi > 0.001 && a < sh.fi) || (sh.fo > 0.001 && b > sh.span - sh.fo);
}

function keysRampIn(sh: ClipGainShape, a: number, b: number): boolean {
  if (!sh.keys || sh.keys.length < 2) return false;
  for (let i = 1; i < sh.keys.length; i++) {
    const p = sh.keys[i - 1]!;
    const k = sh.keys[i]!;
    if (p.value !== k.value && k.tSec > a && p.tSec < b) return true;
  }
  return false;
}

function duckRampsIn(sh: ClipGainShape, a: number, b: number): boolean {
  if (!sh.dspans) return false;
  for (const s of sh.dspans) {
    if (a < s.from + s.r && b > s.from) return true;
    if (a < s.to && b > s.to - s.r) return true;
  }
  return false;
}

/**
 * One placed clip's whole gain timeline, in CLIP-LOCAL seconds: a flat volume shaped
 * by fades, volume keyframes and a duck factor. Mirror of `clipGainEvents`.
 */
export function clipGainEvents(o: {
  spanSec: number; gain?: number; fadeInSec?: number; fadeOutSec?: number;
  volumeKeys?: readonly VolumeKey[]; duck?: ClipDuck;
}): GainEvent[] {
  const sh = clipGainShape(o);
  // The classic shapes stay exact and small: no keys and no duck means every segment
  // is a pure linear ramp of a single factor.
  if (!sh.keys && !sh.dspans) {
    const events: GainEvent[] = [];
    if (sh.fi > 0.001) events.push({ t: 0, v: 0, ramp: false }, { t: sh.fi, v: sh.g, ramp: true });
    else events.push({ t: 0, v: sh.g, ramp: false });
    if (sh.fo > 0.001 && sh.span > 0) events.push({ t: sh.span - sh.fo, v: sh.g, ramp: false }, { t: sh.span, v: 0, ramp: true });
    return events;
  }
  const marks = new Set<number>([0, sh.span]);
  if (sh.fi > 0.001) marks.add(Math.min(sh.fi, sh.span));
  if (sh.fo > 0.001 && sh.span > 0) marks.add(Math.max(0, sh.span - sh.fo));
  for (const k of sh.keys ?? []) if (k.tSec > 0 && k.tSec < sh.span) marks.add(k.tSec);
  for (const s of sh.dspans ?? []) {
    for (const t of [s.from, s.from + s.r, s.to - s.r, s.to]) if (t > 0 && t < sh.span) marks.add(t);
  }
  const sorted = [...marks].sort((a, b) => a - b);
  const events: GainEvent[] = [{ t: 0, v: shapeValueAt(sh, 0), ramp: false }];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    const ramping = (fadeRampsIn(sh, a, b) ? 1 : 0) + (keysRampIn(sh, a, b) ? 1 : 0) + (duckRampsIn(sh, a, b) ? 1 : 0);
    if (ramping >= 2) {
      const steps = Math.max(1, Math.ceil((b - a) / GAIN_SUBDIVIDE_SEC));
      for (let n = 1; n <= steps; n++) {
        const t = a + ((b - a) * n) / steps;
        events.push({ t, v: shapeValueAt(sh, t), ramp: true });
      }
    } else {
      events.push({ t: b, v: shapeValueAt(sh, b), ramp: true });
    }
  }
  return events;
}

/**
 * The bed's whole gain timeline: fade in → full → (per span) ramp down to
 * volume·centre, hold, ramp back to full → fade out. Mirror of `bedDuckEnvelope`.
 */
export function bedDuckEnvelope(o: {
  clipSec: number; volume?: number; centre?: number;
  spans?: DuckSpan[]; fadeIn?: number; fadeOut?: number; rampSec?: number;
}): GainEvent[] {
  const vol = clamp01(o.volume ?? 1);
  const centre = clamp01(o.centre ?? 1);
  const ramp = Math.max(0.05, o.rampSec ?? MIX_RAMP_SEC);
  const fadeIn = Math.max(0, o.fadeIn ?? 0);
  const fadeOut = Math.max(0, o.fadeOut ?? 0);
  const clip = Math.max(0, o.clipSec);

  const events: GainEvent[] = [];
  if (fadeIn > 0) { events.push({ t: 0, v: 0, ramp: false }, { t: fadeIn, v: vol, ramp: true }); }
  else events.push({ t: 0, v: vol, ramp: false });

  const wantFadeOut = fadeOut > 0 && clip > fadeIn;
  const fs = wantFadeOut ? Math.max(fadeIn, clip - fadeOut) : clip;

  if (centre < 1) {
    const spans = (o.spans ?? [])
      .map(s => ({ from: Math.min(Math.max(0, s.from), fs), to: Math.min(Math.max(0, s.to), fs) }))
      .filter(s => s.to - s.from > 0.05)
      .sort((a, b) => a.from - b.from);
    const merged: DuckSpan[] = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s.from - last.to < ramp * 2) last.to = Math.max(last.to, s.to);
      else merged.push({ ...s });
    }
    const low = vol * centre;
    for (const s of merged) {
      const a = Math.max(s.from, fadeIn);
      if (s.to - a <= 0.1) continue;
      const r = Math.min(ramp, (s.to - a) / 2);
      events.push(
        { t: a, v: vol, ramp: false },
        { t: a + r, v: low, ramp: true },
        { t: s.to - r, v: low, ramp: false },
        { t: s.to, v: vol, ramp: true },
      );
    }
  }

  if (wantFadeOut) events.push({ t: fs, v: vol, ramp: false }, { t: clip, v: 0, ramp: true });
  return events;
}

// ── the mix's closed form (mirror of shells/web/src/bridge/mix-window.ts) ─────

/** One placed clip - a unity-gain buffer read at an absolute start. */
export interface MixClip {
  pcm: Float32Array[];
  startMs: number;
  events?: GainEvent[];
  /** Stereo pan -1..1, the equal-power law StereoPannerNode implements. */
  pan?: number;
}

/** One looping music bed through its gain envelope. */
export interface MixBed {
  pcm: Float32Array[];
  events: GainEvent[];
  offsetSample?: number;
  startSample?: number;
  loopEndSample?: number;
}

/** The whole mix, as a set of placed clips plus looping beds. */
export interface MixSpec {
  clips: MixClip[];
  beds: MixBed[];
  rate?: number;
}

/**
 * Evaluate the closed form over the half-open window `[w0, w1)`, returning a fresh
 * stereo pair of length `w1 - w0`. Every output sample is an independent accumulator
 * and the envelope/loop phase are read at the ABSOLUTE sample index, so any chunking
 * of the same range concatenates to identical samples.
 */
export function mixWindow(spec: MixSpec, w0: number, w1: number): [Float32Array, Float32Array] {
  const rate = spec.rate ?? MIX_RATE;
  const len = Math.max(0, w1 - w0);
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  if (len === 0) return [left, right];

  for (const clip of spec.clips) {
    const chans = clip.pcm;
    const srcL = chans[0];
    const clipLen = srcL?.length ?? 0;
    if (!srcL || clipLen === 0) continue;
    const srcR = chans[1] ?? srcL;
    const start = Math.round((clip.startMs * rate) / 1000);
    const lo = Math.max(w0, start);
    const hi = Math.min(w1, start + clipLen);
    const ev = !isTrivialGain(clip.events) ? (clip.events as GainEvent[]) : null;
    const pan = Math.max(-1, Math.min(1, clip.pan ?? 0));
    if (pan === 0) {
      // The un-panned loop, kept verbatim so a centred clip stays byte-identical (a
      // 2x2 identity matrix would still flip -0 samples).
      for (let n = lo; n < hi; n++) {
        const i = n - start;
        const o = n - w0;
        const g = ev ? envelopeGainAt(ev, i / rate) : 1;
        left[o] = (left[o] as number) + (srcL[i] as number) * g;
        right[o] = (right[o] as number) + (srcR[i] as number) * g;
      }
    } else {
      // Equal-power pan as a 2x2 sample matrix, coefficients exactly the
      // StereoPannerNode spec: the mono law when the source has one channel,
      // attenuate-and-cross-mix toward the near side for stereo.
      let a = 1, b = 0, c = 1, d = 0;
      if (!chans[1]) {
        const x = ((pan + 1) / 2) * (Math.PI / 2);
        a = Math.cos(x); c = Math.sin(x);
      } else if (pan < 0) {
        const x = (pan + 1) * (Math.PI / 2);
        b = Math.cos(x); c = Math.sin(x);
      } else {
        const x = pan * (Math.PI / 2);
        a = Math.cos(x); d = Math.sin(x);
      }
      for (let n = lo; n < hi; n++) {
        const i = n - start;
        const o = n - w0;
        const g = ev ? envelopeGainAt(ev, i / rate) : 1;
        left[o] = (left[o] as number) + (a * (srcL[i] as number) + b * (srcR[i] as number)) * g;
        right[o] = (right[o] as number) + (c * (srcR[i] as number) + d * (srcL[i] as number)) * g;
      }
    }
  }

  for (const bed of spec.beds) {
    const chans = bed.pcm;
    const srcL = chans[0];
    const bedLen = srcL?.length ?? 0;
    if (!srcL || bedLen === 0) continue;
    const srcR = chans[1] ?? srcL;
    const startSample = bed.startSample ?? 0;
    const offsetSample = Math.max(0, Math.min(bed.offsetSample ?? 0, bedLen - 1));
    const loopEnd = Math.max(offsetSample + 1, Math.min(bed.loopEndSample ?? bedLen, bedLen));
    const loopLen = loopEnd - offsetSample;
    const lo = Math.max(w0, startSample);
    for (let n = lo; n < w1; n++) {
      const phase = offsetSample + ((n - startSample) % loopLen);
      const g = envelopeGainAt(bed.events, n / rate);
      const o = n - w0;
      left[o] = (left[o] as number) + (srcL[phase] as number) * g;
      right[o] = (right[o] as number) + (srcR[phase] as number) * g;
    }
  }

  return [left, right];
}

/** Multiply both planes in place - the normalize master gain. */
function scalePlanes(planes: [Float32Array, Float32Array], g: number): void {
  for (const ch of planes) for (let i = 0; i < ch.length; i++) ch[i] = (ch[i] as number) * g;
}

/**
 * The master pass: optional BS.1770 normalisation to a target, then the always-on
 * -1 dBTP true-peak limiter. The limiter is chunk-invariant, so this whole-range call
 * and a windowed feeder produce identical streams from the same spec.
 */
export function limitPlanes(
  planes: [Float32Array, Float32Array], normalizeTarget?: number,
): [Float32Array, Float32Array] {
  if (Number.isFinite(normalizeTarget as number)) {
    const meter = createLoudnessMeter(MIX_RATE);
    meter.push(planes[0], planes[1]);
    const lkfs = meter.integrated();
    if (lkfs != null) scalePlanes(planes, normalizeGain(lkfs, normalizeTarget as number));
  }
  const lim = createTruePeakLimiter({ rate: MIX_RATE });
  const [aL, aR] = lim.process(planes[0], planes[1]);
  const [bL, bR] = lim.flush();
  const left = new Float32Array(planes[0].length);
  const right = new Float32Array(planes[1].length);
  left.set(aL, 0);
  left.set(bL, aL.length);
  right.set(aR, 0);
  right.set(bR, aR.length);
  return [left, right];
}

// ── the plan → mix ───────────────────────────────────────────────────────────

/** One sound on the timeline, as data: no DOM node, no decoder, no URL fetch. */
export interface SeqAudioClip {
  /** The key `mixSequenceAudio` looks this clip's decoded PCM up by. */
  id: string;
  /** 'audio' is a placed audio box; 'video' is a video clip's soundtrack. The kind
   *  decides whether a non-`fade` transition fades the SOUND (an audio box always
   *  fades on any authored in/out; a video clip's sound fades only under `fade`). */
  kind?: 'audio' | 'video';
  /** Placement on the timeline, ms. */
  startMs: number;
  /** Placed length on the timeline, ms (before any junction tail). */
  durMs: number;
  /** In-point into the source, ms. */
  clipInMs?: number;
  /** Flat clip volume 0..2, stereo pan -1..1, duck-to level 0..1. */
  gain?: number; pan?: number; duck?: number;
  mute?: boolean;
  /** Struck through in the transcript editor: dropped from the mix (plans/174). */
  ignored?: boolean;
  /** Transition kinds + lengths, as the wire carries them. */
  enter?: string; exit?: string; enterMs?: number; exitMs?: number;
  /** The fx chain in the wire grammar (`eq(240-260-240).rv(20-50)`). */
  fx?: string;
  volumeKeys?: VolumeKey[];
  /** The junction crossfade this clip's head/tail is part of, seconds (plans/165
   *  WP-4). A junction side overrides its own authored fade with the handover's. */
  xfadeHeadSec?: number; xfadeTailSec?: number;
  /** Playback rate and pitch offset. Anything but 1 / 0 leaves the clip OUT of the
   *  mix with a warning: the stretch that makes it correct is a browser module. */
  speed?: number; pitch?: number;
}

/** The export bar's music bed, ducked under the clips. */
export interface SeqAudioBed {
  /** The key its decoded PCM is looked up by. */
  id: string;
  volume?: number; fadeIn?: number; fadeOut?: number;
  /** Bed gain while a clip plays; 1 = no duck. */
  duck?: number;
  /** In-point into the source, seconds (the loop's start). */
  start?: number;
}

/** A whole timeline's sound, as data. */
export interface SeqAudioPlan {
  /** The mix's length, seconds - the same number the frame grid gives the video. */
  totalSec: number;
  clips: SeqAudioClip[];
  bed?: SeqAudioBed | null;
  /** A loudness target in LKFS (-14 / -16 / -23), or undefined for no normalisation. */
  normalize?: number;
}

/** Decoded PCM for one source. Resampled here when the rate is not the mix rate. */
export interface SeqPcm { channels: Float32Array[]; sampleRate: number }

export interface SeqMixResult {
  /** The finished stereo pair, after normalisation and the true-peak limiter. */
  channels: [Float32Array, Float32Array];
  sampleRate: number;
  /** Length in sample frames - ceil(totalSec · MIX_RATE). */
  totalSamples: number;
  /** True when at least one clip contributed sound. */
  hasClipAudio: boolean;
  hasBed: boolean;
  /** Everything left out, and why, in the order it was decided. Never thrown: a
   *  timeline with one unreadable box still mixes the rest, and says so. */
  warnings: string[];
}

/**
 * Linear resample of one channel, only when a source's rate is not the mix rate.
 * Deliberately linear and not windowed-sinc, matching the web provider's own choice
 * (`resampleLinear` in bridge/sequence-providers.ts) so the two agree.
 */
function resampleLinear(src: Float32Array, srcRate: number, dstRate: number, dstLength: number): Float32Array {
  const out = new Float32Array(dstLength);
  if (src.length === 0 || !(srcRate > 0) || !(dstRate > 0)) return out;
  const ratio = srcRate / dstRate;
  for (let i = 0; i < dstLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    if (i0 >= src.length - 1) { out[i] = src[src.length - 1] as number; continue; }
    const frac = pos - i0;
    const a = src[i0] as number;
    const b = src[i0 + 1] as number;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** The source window [fromSec, toSec) of one decoded clip, at the mix rate. */
function windowAt(pcm: SeqPcm, fromSec: number, toSec: number): Float32Array[] {
  const srcRate = pcm.sampleRate > 0 ? pcm.sampleRate : MIX_RATE;
  const from = Math.max(0, Math.round(fromSec * srcRate));
  const to = Math.max(from, Math.round(toSec * srcRate));
  const out: Float32Array[] = [];
  for (const ch of pcm.channels.slice(0, MIX_CHANNELS)) {
    const end = Math.min(to, ch.length);
    const slice = ch.subarray(Math.min(from, ch.length), end);
    if (srcRate === MIX_RATE) {
      out.push(slice.slice());
    } else {
      out.push(resampleLinear(slice, srcRate, MIX_RATE, Math.round((slice.length / srcRate) * MIX_RATE)));
    }
  }
  return out;
}

/** Does this clip's authored transition fade its SOUND? */
function fadesSound(clip: SeqAudioClip, side: 'enter' | 'exit'): boolean {
  const kind = side === 'enter' ? clip.enter : clip.exit;
  if (clip.kind === 'video') return kind === 'fade';
  return Boolean(kind);
}

/**
 * Mix a timeline's sound from a plan plus decoded PCM.
 *
 * The order of operations mirrors the web shell's `mixSequenceAudio`, because the
 * order is what the numbers depend on: window the source, apply the fx chain, place
 * the clip with its gain envelope and pan, then a second pass that derives each
 * ducking clip's windows from where the OTHER clips actually make sound, then the bed
 * under the union of those windows, then one whole-range `mixWindow`, then the master
 * pass (normalise, limit).
 */
export function mixSequenceAudio(
  plan: SeqAudioPlan, pcmById: Map<string, SeqPcm> | Record<string, SeqPcm>,
): SeqMixResult {
  const warnings: string[] = [];
  const lookup = (id: string): SeqPcm | undefined => (
    pcmById instanceof Map ? pcmById.get(id) : pcmById[id]
  );
  const totalSec = Math.max(0, plan.totalSec);
  const totalSamples = Math.max(1, Math.ceil(totalSec * MIX_RATE));
  const clips: MixClip[] = [];
  const spans: DuckSpan[] = [];
  const placed: { c: SeqAudioClip; mixClip: MixClip; placedSec: number; fadeInSec: number; fadeOutSec: number }[] = [];

  for (const c of plan.clips) {
    if (c.mute || c.ignored) continue;
    if (!(c.durMs > 0)) continue;
    const speed = c.speed ?? 1;
    const pitch = c.pitch ?? 0;
    if (speed !== 1 || pitch !== 0) {
      warnings.push(`clip "${c.id}" is left out: a speed or pitch change needs the browser's time-stretch, so mixing it here would be the wrong length and the wrong pitch.`);
      continue;
    }
    const pcm = lookup(c.id);
    if (!pcm || !pcm.channels[0]?.length) {
      warnings.push(`clip "${c.id}" is left out: no decoded audio was supplied for it.`);
      continue;
    }
    const from = (c.clipInMs ?? 0) / 1000;
    // Never ask for audio past the end of the mix.
    const room = Math.max(0, totalSec - c.startMs / 1000);
    const span = Math.min(c.durMs / 1000 + (c.xfadeTailSec ?? 0), room);
    if (!(span > 0)) continue;
    let channels = windowAt(pcm, from, from + span);
    if (!channels[0]?.length) continue;
    // The fx chain, applied to the windowed copy. `clean()` is the shell's entry and
    // is skipped by processFxPcm itself, exactly as a browser without the model does.
    if (c.fx) {
      const parsed = parseFxChain(c.fx);
      if (parsed.skipped.length) {
        warnings.push(`clip "${c.id}": unknown fx ${parsed.skipped.join(', ')} skipped.`);
      }
      if (parsed.entries.some((e) => e.name === 'clean')) {
        warnings.push(`clip "${c.id}": the voice cleanup effect needs the on-device model, which this shell does not load - the rest of the chain was applied.`);
      }
      if (parsed.entries.length) processFxPcm(channels, MIX_RATE, parsed.entries);
    }
    const frames = channels[0]?.length ?? 0;
    if (!frames) continue;
    const placedSec = frames / MIX_RATE;
    // A junction side overrides its own authored fade with the handover's, so the two
    // gains cross at the cut's midpoint like the two alphas do.
    const fadeInSec = c.xfadeHeadSec ?? (fadesSound(c, 'enter') ? (c.enterMs ?? 0) / 1000 : 0);
    const fadeOutSec = c.xfadeTailSec ?? (fadesSound(c, 'exit') ? (c.exitMs ?? 0) / 1000 : 0);
    const events = clipGainEvents({
      spanSec: placedSec, gain: c.gain, fadeInSec, fadeOutSec,
      volumeKeys: c.volumeKeys,
    });
    const pan = Math.max(-1, Math.min(1, c.pan ?? 0));
    const mixClip: MixClip = {
      pcm: channels, startMs: Math.max(0, c.startMs),
      ...(isTrivialGain(events) ? {} : { events }),
      ...(pan !== 0 ? { pan } : {}),
    };
    clips.push(mixClip);
    placed.push({ c, mixClip, placedSec, fadeInSec, fadeOutSec });
    spans.push({ from: c.startMs / 1000, to: c.startMs / 1000 + placedSec });
  }

  // Signal-derived ducking: a box asked to sit under other audio ducks where the other
  // clips actually MAKE SOUND (activitySpans over the PCM already in the mix), not
  // across their whole windows. A clip that was left out is silent in the file, so it
  // correctly ducks nothing.
  for (const p of placed) {
    const level = p.c.duck ?? 1;
    if (p.c.kind === 'video' || !(level < 1)) continue;
    const duckSpans: DuckSpan[] = [];
    for (const o of placed) {
      if (o === p) continue;
      const offSec = (o.mixClip.startMs - p.mixClip.startMs) / 1000;
      for (const s of activitySpans(o.mixClip.pcm, { rate: MIX_RATE })) {
        duckSpans.push({ from: s.from + offSec, to: s.to + offSec });
      }
    }
    const events = clipGainEvents({
      spanSec: p.placedSec, gain: p.c.gain, fadeInSec: p.fadeInSec, fadeOutSec: p.fadeOutSec,
      volumeKeys: p.c.volumeKeys,
      duck: duckSpans.length ? { level, spans: duckSpans } : undefined,
    });
    if (isTrivialGain(events)) delete p.mixClip.events;
    else p.mixClip.events = events;
  }

  const beds: MixBed[] = [];
  let hasBed = false;
  if (plan.bed) {
    const bedPcm = lookup(plan.bed.id);
    if (!bedPcm || !bedPcm.channels[0]?.length) {
      warnings.push(`the music bed "${plan.bed.id}" is left out: no decoded audio was supplied for it.`);
    } else {
      const chans = bedPcm.sampleRate === MIX_RATE
        ? bedPcm.channels.slice(0, MIX_CHANNELS).map(ch => ch.slice())
        : windowAt(bedPcm, 0, bedPcm.channels[0].length / bedPcm.sampleRate);
      const duckLevel = clamp01(plan.bed.duck ?? 1);
      const events = bedDuckEnvelope({
        clipSec: totalSec, volume: plan.bed.volume,
        fadeIn: plan.bed.fadeIn, fadeOut: plan.bed.fadeOut,
        ...(spans.length && duckLevel < 1 ? { centre: duckLevel, spans } : {}),
      });
      beds.push({ pcm: chans, events, offsetSample: Math.round((plan.bed.start ?? 0) * MIX_RATE) });
      hasBed = true;
    }
  }

  const spec: MixSpec = { clips, beds, rate: MIX_RATE };
  const [left, right] = limitPlanes(mixWindow(spec, 0, totalSamples), plan.normalize);
  return {
    channels: [left, right], sampleRate: MIX_RATE, totalSamples,
    hasClipAudio: clips.length > 0, hasBed, warnings,
  };
}

// ── reading a plan off a hydrated design stage ────────────────────────────────

/** The bare shape the reader needs from a DOM node. Declared here rather than typed
 *  as `Element` so this module stays free of the DOM lib, and so a jsdom node, a real
 *  browser node and a test double all satisfy it. */
export interface SeqElementLike {
  getAttribute(name: string): string | null;
  querySelector(sel: string): SeqElementLike | null;
  querySelectorAll(sel: string): ArrayLike<SeqElementLike>;
  matches?(sel: string): boolean;
  classList?: { contains(c: string): boolean };
  tagName?: string;
}

/** Clamps mirroring shells/web/src/bridge/sequence-plan.ts, so the two readers cannot
 *  disagree about what an authored value means. */
const MAX_TIME_MS = 3_600_000;
const MIN_SPEED = 0.25;
const MAX_SPEED = 4;
const MIN_TRANSITION_MS = 100;
const MAX_TRANSITION_MS = 3000;
const DEFAULT_TRANSITION_MS = 400;

const num = (v: string | null, dflt: number): number => {
  const n = v == null || v === '' ? Number.NaN : parseFloat(v);
  return Number.isFinite(n) ? n : dflt;
};
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** What `readSeqAudioPlan` found: the plan, the source each clip needs decoding from,
 *  and whatever it had to leave out. */
export interface SeqPlanRead {
  plan: SeqAudioPlan;
  /** clip id → the source URL/path its PCM must be decoded from. */
  sources: Map<string, string>;
  warnings: string[];
}

/**
 * Read a mix plan off a HYDRATED design stage - the markup a tool's template produced,
 * as it exists in the CLI's jsdom before export.
 *
 * It reads the same `data-t-*` attributes `parseSequenceStage` reads, with the same
 * clamps, because those attributes ARE the timeline's wire form: the alternative is
 * re-implementing the design tool's block grammar here, which would be a second
 * private contract to keep in step.
 *
 * KNOWN GAP, stated rather than guessed: volume keyframes (`data-t-kf`'s `v` channel)
 * are not read. Parsing the keyframe grammar is its own job; a clip that carries one
 * is mixed at its flat volume and named in `warnings`, so a quieter-than-expected mix
 * is never a silent surprise.
 */
export function readSeqAudioPlan(root: SeqElementLike, opts: { totalSec?: number } = {}): SeqPlanRead {
  const warnings: string[] = [];
  const sources = new Map<string, string>();
  const clips: SeqAudioClip[] = [];

  const stage = root.matches?.('[data-sequence]') ? root : root.querySelector('[data-sequence]');
  const msEl = (stage ?? root).matches?.('[data-seq-ms]')
    ? (stage ?? root)
    : ((stage ?? root).querySelector('[data-seq-ms]') ?? root.querySelector('[data-seq-ms]'));
  const rawMs = num(msEl?.getAttribute('data-seq-ms') ?? null, 0);
  const totalMs = rawMs > 0 ? Math.min(rawMs, MAX_TIME_MS) : 0;
  const totalSec = opts.totalSec ?? totalMs / 1000;

  const boxes = Array.from((stage ?? root).querySelectorAll('[data-t-start]'));
  let n = 0;
  for (const el of boxes) {
    const audioMarker = el.querySelector('[data-audio-src]');
    const isAudioBox = Boolean(el.classList?.contains('lolly-box-audio')) || Boolean(audioMarker)
      || el.matches?.('[data-audio-src]') === true;
    const videoEl = el.matches?.('video') ? el : el.querySelector('video');
    if (!isAudioBox && !videoEl) continue;
    const src = isAudioBox
      ? (el.matches?.('[data-audio-src]') ? el : audioMarker)?.getAttribute('data-audio-src') ?? ''
      : videoEl?.getAttribute('src') ?? '';
    const id = el.getAttribute('data-id') || el.getAttribute('id') || `clip${n}`;
    n += 1;
    const startMs = clamp(num(el.getAttribute('data-t-start'), 0), 0, MAX_TIME_MS);
    const durRaw = el.getAttribute('data-t-dur');
    const durNum = durRaw == null || durRaw === '' ? Number.NaN : parseFloat(durRaw);
    // An open-ended box runs to the end of the sequence, as sequence-clock's endOf reads it.
    const durMs = Number.isFinite(durNum)
      ? clamp(durNum, 0, MAX_TIME_MS)
      : Math.max(0, totalMs - startMs);
    if (el.getAttribute('data-t-kf')?.includes('v')) {
      warnings.push(`clip "${id}" carries volume keyframes, which this reader does not parse - it was mixed at its flat volume.`);
    }
    if (!src) {
      warnings.push(`clip "${id}" has no source and was left out.`);
      continue;
    }
    sources.set(id, src);
    clips.push({
      id,
      kind: isAudioBox ? 'audio' : 'video',
      startMs,
      durMs,
      clipInMs: clamp(num(el.getAttribute('data-clip-in'), 0), 0, MAX_TIME_MS),
      gain: clamp(num(el.getAttribute('data-t-gain'), 1), 0, 2),
      pan: clamp(num(el.getAttribute('data-t-pan'), 0), -1, 1),
      duck: clamp(num(el.getAttribute('data-t-duck'), 1), 0, 1),
      pitch: clamp(num(el.getAttribute('data-t-pitch'), 0), -12, 12),
      speed: clamp(num(el.getAttribute('data-t-speed'), 1), MIN_SPEED, MAX_SPEED),
      mute: el.getAttribute('data-t-mute') === '1',
      ignored: el.getAttribute('data-t-ignored') === '1',
      enter: el.getAttribute('data-t-enter') ?? '',
      exit: el.getAttribute('data-t-exit') ?? '',
      enterMs: clamp(num(el.getAttribute('data-t-enter-ms'), DEFAULT_TRANSITION_MS), MIN_TRANSITION_MS, MAX_TRANSITION_MS),
      exitMs: clamp(num(el.getAttribute('data-t-exit-ms'), DEFAULT_TRANSITION_MS), MIN_TRANSITION_MS, MAX_TRANSITION_MS),
      fx: (el.getAttribute('data-t-fx') ?? '').slice(0, 200),
    });
  }

  return { plan: { totalSec, clips }, sources, warnings };
}

/** The finished mix as a 16-bit WAV, through the engine's own writer. */
export function sequenceMixToWav(mix: { channels: [Float32Array, Float32Array]; sampleRate: number }): Uint8Array {
  return packWav({ channels: [mix.channels[0], mix.channels[1]], sampleRate: mix.sampleRate });
}
