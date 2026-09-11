// SPDX-License-Identifier: MPL-2.0
/**
 * mix-window.ts - the PURE analytic audio-mix-window evaluator (plans/156, Phase B
 * Step B1).
 *
 * The whole reason this file can exist is the essential fact from plans/156 section 0:
 * the sequence audio graph has NO stateful DSP. Its only two node types are
 * `createBufferSource` (a unity-gain buffer read placed at an absolute start) and
 * `createGain` (a precomputed *linear* automation, i.e. a pure analytic function of
 * absolute time - see audio-envelope.ts). Resampling happens inside the provider
 * (`clip.pcm(from,to,48000)`), so buffer sources play at rate 1. There is therefore
 * no attack/release/reverb tail, no resampler state, nothing to carry across a
 * window boundary. The whole-timeline destination signal is a closed form in the
 * output sample index `n` (plans/156 section 1):
 *
 *   out[n] = Σ_clips  clipPCM_c[n − start_c]                    (when n∈clip range, unity)
 *          + Σ_beds   bed_b[phase_b(n)] · envelopeGainAt(events_b, n / rate)
 *
 * with `start_c = round(startMs_c · 48)` and `phase_b(n)` the deterministic loop
 * position from a fixed in-point. **Nothing at sample `n` depends on any earlier
 * sample**, so a windowed mix is provably an identity on concatenation: this module
 * evaluates exactly that closed form over an arbitrary half-open window `[w0, w1)`,
 * and `mix-window.test.ts` pins concat-over-the-4800-grid == one whole-range call,
 * bit-for-bit (plans/156 section 5 STOP-5).
 *
 * This is Step B1: the evaluator + its NODE proof, with NO wiring into the
 * production render path. B2/B3 route `mixSequenceAudio` / `sequenceAudioPcm`
 * through it.
 */

import { envelopeGainAt, isTrivialGain, type GainEvent } from './audio-envelope.ts';

/** Everything mixes at 48 kHz stereo (MIX_RATE / MIX_CHANNELS in sequence-render.ts). */
export const MIX_WINDOW_RATE = 48_000;

/**
 * One placed clip - a unity-gain buffer read at an absolute start.
 *
 * `pcm` is the SAME shape `mixSequenceAudio` feeds `octx.createBuffer` today: one
 * Float32Array per channel, already resampled to the mix rate by the provider
 * (`clip.pcm(from,to,48000)` → `assemblePcmWindow`). A mono source (one channel)
 * is duplicated into both output channels, exactly as `copyToChannel`'s
 * `Math.min(ch, channels.length - 1)` fan-out does in the current graph.
 */
export interface MixClip {
  /** Per-channel PCM at the mix rate. `channels[0].length` is the placed length. */
  pcm: Float32Array[];
  /**
   * Placement, milliseconds. The sample start is `round(startMs · rate / 1000)` -
   * i.e. `round(startMs · 48)` at 48 kHz - matching `node.start(startMs/1000)` in
   * the OAC graph (plans/156 section 1: `start_c = round(startMs_c · 48)`).
   */
  startMs: number;
  /**
   * The clip's gain timeline in CLIP-LOCAL seconds (clipGainEvents: flat volume,
   * fades, volume keyframes), evaluated per sample exactly as the beds' envelope
   * is. Absent or trivial = the historical unity-gain read, byte-identical.
   */
  events?: GainEvent[];
  /**
   * Stereo pan -1..1 (plans/165 WP-5), the SAME equal-power law StereoPannerNode
   * implements so preview and file agree: a mono source takes the mono law, a
   * stereo source attenuates and cross-mixes the far channel. Absent or 0 keeps
   * the historical fan-out path multiply-free and byte-identical.
   */
  pan?: number;
}

/**
 * One looping music bed through its gain envelope.
 *
 * `events` is exactly what `bedDuckEnvelope(...)` produces (fade in → full →
 * per-span duck → fade out); `envelopeGainAt` evaluates the same analytic curve
 * WebAudio's linear ramps implement, so the duck is reproduced sample-exactly at
 * any absolute time. The bed is a looped buffer read: it begins at output sample
 * `startSample` reading from `offsetSample`, and wraps within the loop region
 * `[offsetSample, loopEnd)` - `loopEnd` defaults to the buffer length, which is
 * how `connectBed` sets `loopStart = offset`, `loopEnd = buffer.duration`.
 */
export interface MixBed {
  /** Per-channel bed PCM at the mix rate. */
  pcm: Float32Array[];
  /** The gain automation, from `bedDuckEnvelope` (t in seconds from bed start). */
  events: GainEvent[];
  /** Loop in-point, samples (`round(fade.start · rate)`). 0 = whole-buffer loop. */
  offsetSample?: number;
  /** Output sample the bed begins at. 0 in the current graph (`src.start(0, …)`). */
  startSample?: number;
  /** One past the last looped sample. Defaults to the buffer length. */
  loopEndSample?: number;
}

/** The whole mix, as a set of placed clips plus looping beds. */
export interface MixSpec {
  clips: MixClip[];
  beds: MixBed[];
  /** Output sample rate. Default MIX_WINDOW_RATE (48 kHz). */
  rate?: number;
}

/**
 * Evaluate the closed form over the half-open window `[w0, w1)`, returning a fresh
 * stereo pair `[left, right]` of length `w1 - w0`.
 *
 * BIT-EXACT CONCATENATION (plans/156 section 5 STOP-5). Every output sample is an
 * independent accumulator starting at 0, and the per-sample summation order (all
 * clips in `spec.clips` order, then all beds in `spec.beds` order) does not depend
 * on the window bounds. So the value written at any absolute `n` is identical
 * whether `n` is reached as part of one whole-range call or a small window - the
 * window seam introduces no state. Envelope and loop phase are evaluated at the
 * ABSOLUTE sample `n` (via `n / rate` and `n - startSample`), never window-relative,
 * which is the other half of why the seam is invisible.
 */
export function mixWindow(spec: MixSpec, w0: number, w1: number): [Float32Array, Float32Array] {
  const rate = spec.rate ?? MIX_WINDOW_RATE;
  const len = Math.max(0, w1 - w0);
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  if (len === 0) return [left, right];

  // ── clips: Σ clipPCM_c[n − start_c], unity, over the placed range ───────────
  for (const clip of spec.clips) {
    const chans = clip.pcm;
    const srcL = chans[0];
    const clipLen = srcL?.length ?? 0;
    if (!srcL || clipLen === 0) continue;
    // Mono source fans out into both output channels (copyToChannel's fan-out).
    const srcR = chans[1] ?? srcL;
    // start_c = round(startMs · rate / 1000). At 48 kHz this is round(startMs · 48).
    const start = Math.round((clip.startMs * rate) / 1000);
    // Intersect the placed range [start, start + clipLen) with the window [w0, w1).
    const lo = Math.max(w0, start);
    const hi = Math.min(w1, start + clipLen);
    // The clip's own gain timeline (volume, fades, volume keyframes) - evaluated
    // per sample like the beds' envelope below, skipped entirely for the plain
    // unity clip so the historical path stays multiply-free.
    const ev = !isTrivialGain(clip.events) ? (clip.events as GainEvent[]) : null;
    const pan = Math.max(-1, Math.min(1, clip.pan ?? 0));
    if (pan === 0) {
      // The historical un-panned loop, kept verbatim so a centred clip stays
      // byte-identical (a 2x2 identity matrix would still flip -0 samples).
      for (let n = lo; n < hi; n++) {
        const i = n - start;
        const o = n - w0;
        const g = ev ? envelopeGainAt(ev, i / rate) : 1;
        left[o] = (left[o] as number) + (srcL[i] as number) * g;
        right[o] = (right[o] as number) + (srcR[i] as number) * g;
      }
    } else {
      // Equal-power pan (plans/165 WP-5) as a 2x2 sample matrix, coefficients
      // exactly the StereoPannerNode spec: the mono law when the source has one
      // channel (the fan-out above made srcR === srcL), attenuate-and-cross-mix
      // toward the near side for stereo.
      //   left  += (a·srcL + b·srcR) · g
      //   right += (c·srcR + d·srcL) · g
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

  // ── beds: Σ bed_b[phase_b(n)] · envelopeGainAt(events_b, n / rate) ───────────
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
      // phase_b(n): begin at offsetSample, wrap within [offsetSample, loopEnd).
      // Evaluated from the ABSOLUTE sample n so the window seam is invisible.
      const phase = offsetSample + ((n - startSample) % loopLen);
      const g = envelopeGainAt(bed.events, n / rate);
      const o = n - w0;
      left[o] = (left[o] as number) + (srcL[phase] as number) * g;
      right[o] = (right[o] as number) + (srcR[phase] as number) * g;
    }
  }

  return [left, right];
}
