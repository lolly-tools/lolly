// SPDX-License-Identifier: MPL-2.0
/**
 * Audio analysis — decoded PCM in, a per-frame reactivity track out.
 *
 * This is the engine half of `host.audio` (v1.71). It is deliberately the ONLY
 * place the maths lives: every shell decodes bytes its own way (the web shell has
 * `decodeAudioData`, the CLI has a WAV reader and the ZzFXM renderer) and then
 * calls `analysePcm` with plain Float32 channel data, so an audiogram drawn in the
 * browser and the same audiogram rendered headlessly read the SAME numbers.
 *
 * Why frames at all: a waveform reduced to N static peak buckets can only ever be
 * scrubbed, not reacted to. A tool that wants bars that move with the bass, a ring
 * that pulses on the beat, or a MilkDrop field that breathes needs per-instant
 * energy split by frequency — which means a short-time Fourier transform, one
 * window per output frame.
 *
 * Two shape decisions worth knowing before reading the types:
 *
 *  1. **Struct-of-arrays, not array-of-objects.** A minute at 60fps is 3,600
 *     frames; as objects that is 3,600 allocations a draw loop then chases through
 *     pointers. `AudioFrames` is a handful of Float32Arrays indexed by frame, which
 *     is both one allocation each and the layout a canvas loop actually wants.
 *  2. **Raw time-domain windows are opt-in** (`opts.samples`). They exist for one
 *     caller — butterchurn's `render({ audioLevels })`, which takes Uint8 time-domain
 *     arrays — and they are big (2,048 bytes × 3 channels × every frame). Nothing
 *     that only draws bars should pay for them.
 *
 * The result types are the CONTRACT's (host.audio, v1.71) rather than this module's
 * own, so there is exactly one definition of what a frame holds and a shell can't
 * drift from it.
 */
import type { AudioAnalyseOpts, AudioAnalysis, AudioFrames } from './bridge/host-v1.ts';

export type { AudioAnalyseOpts, AudioAnalysis, AudioFrames };

/** Frequency split points in Hz. Matches butterchurn's own bass/mid/treb division so
 *  a MilkDrop preset driven from these numbers behaves as its author intended. */
const BASS_HZ = 320;
const MID_HZ = 2800;

/** FFT window length in samples. 2048 at 44.1kHz ≈ 46ms — long enough to resolve
 *  bass (a 40Hz period is 25ms), short enough that a transient stays a transient.
 *  Also exactly butterchurn's `fftSize`, which the `wave` windows feed. */
const FFT_SIZE = 2048;

/** Beat search range in BPM. Below 60 the autocorrelation starts locking onto bars
 *  rather than beats; above 180 it locks onto eighth notes. */
const MIN_BPM = 60;
const MAX_BPM = 180;

/** How well a half/third-length lag must correlate, relative to the winning lag,
 *  before it is preferred as the real beat. 0.8 is loose enough to catch the
 *  sub-harmonic on a real recording (where alternate beats differ in weight) and
 *  tight enough not to promote an unrelated faster lag that merely scores well. */
const OCTAVE_TOLERANCE = 0.8;

/** Loudness floor. Amplitudes below this are treated as silence rather than
 *  normalised up into noise — an all-but-silent track should read as quiet, not as
 *  a full-scale rendering of its own noise floor. */
const SILENCE = 1e-5;

/**
 * Dynamic range in dB for the spectrum and the band split: the loudest bin in the
 * window reads 1.0, one this many dB quieter reads 0.
 *
 * These are reported in DECIBELS, not linear amplitude, and that is not a detail —
 * it is the difference between a usable visual and an unusable one. Linear FFT
 * magnitude is dominated by whatever is loudest by such a margin that everything
 * else rounds to nothing: plotted as bars, real music renders as one or two spikes
 * over a flat line, and a `treb` bar sits at zero forever because cymbals carry a
 * tiny fraction of a kick drum's amplitude. Hearing is roughly logarithmic, which
 * is why every meter in audio is a dB meter.
 *
 * 60 dB is the range a bar meter conventionally shows. Wider and quiet detail
 * crowds the floor; narrower and ordinary dynamics clip against the ceiling.
 */
const DB_RANGE = 60;

/**
 * Analyse decoded PCM. `channels` is one Float32Array per channel, all the same
 * length, samples nominally in −1..1 (values outside are kept — a clipped source
 * should read as clipped, not be silently rescaled).
 *
 * Pure and synchronous: no DOM, no timers, no I/O. Cost is dominated by one
 * `bands`-independent FFT per frame, so it is linear in `fps × window`.
 */
export function analysePcm(
  channels: Float32Array[],
  sampleRate: number,
  opts: AudioAnalyseOpts = {},
): AudioAnalysis {
  if (!channels.length || !channels[0]!.length) throw new Error('analysePcm: no samples');
  if (!(sampleRate > 0)) throw new Error('analysePcm: sampleRate must be positive');

  const total = channels[0]!.length;
  const duration = total / sampleRate;
  const fps = clampInt(opts.fps ?? 30, 1, 120);
  const bands = clampInt(opts.bands ?? 64, 4, 512);
  const buckets = clampInt(opts.buckets ?? 128, 4, 4096);
  // A power-of-two window is required by the radix-2 transform; round UP so a
  // caller asking for 2048 never silently gets 1024.
  const waveLen = opts.samples ? Math.min(4096, nextPow2(clampInt(opts.samples, 16, 4096))) : 0;

  const start = clamp(opts.start ?? 0, 0, duration);
  const window = clamp(opts.window ?? duration - start, 0, duration - start);

  const s0 = Math.floor(start * sampleRate);
  const s1 = Math.min(total, Math.max(s0 + 1, Math.floor((start + window) * sampleRate)));
  const span = s1 - s0;

  // Mono mix once, up front. Every measurement below is on the mono sum (a stereo
  // track's bass is its bass whichever speaker carries it); the L/R `wave` windows
  // are the only place the split survives, because butterchurn draws with both.
  const mono = downmix(channels, s0, s1);
  const left = channels[0]!;
  const right = channels[1] ?? channels[0]!;

  const count = Math.max(1, Math.round((span / sampleRate) * fps));

  const frames: AudioFrames = {
    count,
    bands,
    samples: waveLen,
    t: new Float32Array(count),
    rms: new Float32Array(count),
    peak: new Float32Array(count),
    bass: new Float32Array(count),
    mid: new Float32Array(count),
    treb: new Float32Array(count),
    centroid: new Float32Array(count),
    flux: new Float32Array(count),
    magnitude: new Float32Array(count * bands),
    wave: waveLen ? new Uint8Array(count * waveLen) : new Uint8Array(0),
    waveL: waveLen ? new Uint8Array(count * waveLen) : new Uint8Array(0),
    waveR: waveLen ? new Uint8Array(count * waveLen) : new Uint8Array(0),
  };

  const half = FFT_SIZE / 2;
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const mag = new Float64Array(half);
  const prevMag = new Float64Array(half);
  const hann = hannWindow(FFT_SIZE);
  const binHz = sampleRate / FFT_SIZE;
  const bassEnd = Math.min(half, Math.max(1, Math.round(BASS_HZ / binHz)));
  const midEnd = Math.min(half, Math.max(bassEnd + 1, Math.round(MID_HZ / binHz)));
  const edges = logBandEdges(bands, half);

  for (let f = 0; f < count; f++) {
    // Centre each window on its frame time so a transient reads at the moment it
    // happens rather than a window-length late.
    const centre = s0 + Math.round(((f + 0.5) / count) * span);
    frames.t[f] = (centre - s0) / sampleRate;

    let sum = 0;
    let pk = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = centre - half + i;
      const v = idx >= 0 && idx < total ? mono[idx - s0] ?? sampleAt(channels, idx) : 0;
      const a = v < 0 ? -v : v;
      if (a > pk) pk = a;
      sum += v * v;
      re[i] = v * hann[i]!;
      im[i] = 0;
    }
    frames.rms[f] = Math.sqrt(sum / FFT_SIZE);
    frames.peak[f] = Math.min(1, pk);

    fftInPlace(re, im);

    let bassSum = 0;
    let midSum = 0;
    let trebSum = 0;
    let magSum = 0;
    let centroidSum = 0;
    let flux = 0;
    for (let k = 0; k < half; k++) {
      const m = Math.hypot(re[k]!, im[k]!);
      mag[k] = m;
      magSum += m;
      centroidSum += m * k;
      // Frame 0 has no predecessor, and `prevMag` starts zeroed — so measuring it
      // would report the whole window's magnitude as a rise and fabricate a
      // full-spectrum onset at t=0. That is not cosmetic: flux is normalised to its
      // own maximum, so the phantom would take the 1.0 and squash every genuine
      // attack (measured on a 120 BPM click train: flux[0] = 1.000 against 0.403 for
      // the loudest real hit), and the beat grid is anchored on the strongest onset,
      // so it would key the whole rhythm to the first frame.
      if (f > 0) {
        const d = m - prevMag[k]!;
        if (d > 0) flux += d;
      }
      if (k < bassEnd) bassSum += m;
      else if (k < midEnd) midSum += m;
      else trebSum += m;
    }
    // MEAN magnitude per bin, not the sum. The three bands span wildly different
    // numbers of FFT bins — bass is ~15 of them, treble ~900 — so summing makes
    // treble structurally the largest for any broadband source no matter how dull
    // it actually sounds. A three-bar meter is read as "how much is down here vs up
    // there", which is a density, so divide by the width.
    frames.bass[f] = bassSum / bassEnd;
    frames.mid[f] = midSum / Math.max(1, midEnd - bassEnd);
    frames.treb[f] = trebSum / Math.max(1, half - midEnd);
    frames.flux[f] = flux;
    frames.centroid[f] = magSum > 0 ? centroidSum / magSum / half : 0;

    // Log-spaced bins: linear FFT bins put five sixths of their resolution above
    // 2kHz, where almost nothing a listener reads as "the music" lives. Each output
    // band is the MAX over its source bins, not the mean — a mean smears a narrow
    // peak into its neighbours and the bars stop looking like the sound.
    const row = f * bands;
    for (let b = 0; b < bands; b++) {
      const lo = edges[b]!;
      const hi = Math.max(lo + 1, edges[b + 1]!);
      let m = 0;
      for (let k = lo; k < hi; k++) if (mag[k]! > m) m = mag[k]!;
      frames.magnitude[row + b] = m;
    }

    prevMag.set(mag);

    if (waveLen) {
      const wRow = f * waveLen;
      const wStart = centre - (waveLen >> 1);
      for (let i = 0; i < waveLen; i++) {
        const idx = wStart + i;
        const inRange = idx >= 0 && idx < total;
        frames.wave[wRow + i] = toByte(inRange ? mono[idx - s0] ?? sampleAt(channels, idx) : 0);
        frames.waveL[wRow + i] = toByte(inRange ? left[idx]! : 0);
        frames.waveR[wRow + i] = toByte(inRange ? right[idx]! : 0);
      }
    }
  }

  // Normalise the reactive tracks to the window's own maxima. This is what makes a
  // quiet voice memo and a mastered track both fill the frame — the alternative
  // (absolute scale) renders half the world's audio as a flat line. `peak` is
  // deliberately left absolute so a tool can still tell that a source clipped.
  //
  // bass/mid/treb share ONE scale, and that matters: normalised independently, a
  // bass-only clip divides its own near-zero treble by itself and reports treble
  // pinned at 1.0 — a treble bar at full height for a sine wave at 80Hz. The split
  // is a BALANCE between the three, so the loudest band in the window reads 1 and
  // the other two read their true share of it.
  //
  // The two SPECTRAL tracks go to dB (see DB_RANGE); the envelope tracks stay
  // linear. That split is deliberate: `rms` and `flux` drive motion where linear
  // amplitude is what a viewer reads as "how hard it hit", while the spectrum and
  // the band split are being drawn as bar HEIGHTS, where linear magnitude collapses
  // everything but the loudest bin to zero.
  normalise(frames.rms);
  normaliseDb([frames.bass, frames.mid, frames.treb]);
  normalise(frames.flux);
  normaliseDb([frames.magnitude]);

  const peaks = overviewPeaks(mono, buckets);
  const { bpm, beats } = detectBeats(frames.flux, fps);

  return {
    duration,
    sampleRate,
    channels: channels.length,
    start: s0 / sampleRate,
    window: span / sampleRate,
    fps,
    peaks,
    frames,
    bpm,
    beats,
  };
}

/**
 * Tempo + beat times from an onset track.
 *
 * Autocorrelate the flux over the plausible beat-period range, take the strongest
 * lag as the period, then walk the track picking the largest onset inside each
 * period-wide window. This is a pragmatic estimator, not a beat-tracking research
 * result: it is good on anything with a steady pulse and it REFUSES rather than
 * guesses on speech or ambient material, which is the behaviour a visual needs
 * (a wrong beat grid looks far worse than none).
 */
function detectBeats(flux: Float32Array, fps: number): { bpm: number | null; beats: Float32Array } {
  const n = flux.length;
  const minLag = Math.max(2, Math.floor((60 / MAX_BPM) * fps));
  const maxLag = Math.floor((60 / MIN_BPM) * fps);
  if (n < maxLag * 2 || maxLag <= minLag) return { bpm: null, beats: new Float32Array(0) };

  // Mean-remove first: a DC offset makes every lag correlate well and the peak
  // stops meaning anything.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += flux[i]!;
  mean /= n;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = flux[i]! - mean;

  let energy = 0;
  for (let i = 0; i < n; i++) energy += x[i]! * x[i]!;
  if (energy <= 0) return { bpm: null, beats: new Float32Array(0) };

  const score = (lag: number): number => {
    let acc = 0;
    for (let i = lag; i < n; i++) acc += x[i]! * x[i - lag]!;
    return acc / (n - lag);
  };

  let bestLag = 0;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = score(lag);
    if (s > bestScore) {
      bestScore = s;
      bestLag = lag;
    }
  }
  // The correlation has to beat a share of the track's own variance before we call
  // it a tempo. Speech and pads land well under this; anything with a drum does not.
  const variance = energy / n;
  if (!bestLag || bestScore < variance * 0.12) return { bpm: null, beats: new Float32Array(0) };

  // OCTAVE CORRECTION. A perfectly periodic pulse correlates just as well at two
  // beats' distance as at one, and dividing by `n - lag` gives the longer lag fewer,
  // noisier terms to average — so the raw maximum lands on a sub-harmonic often
  // enough to matter. Measured: a 120 BPM kick over a sustained tone reported 60.
  // So if half (or a third) of the winning lag correlates nearly as well, take the
  // FASTER reading — which is also the one a listener would tap.
  for (const div of [2, 3]) {
    const lag = Math.round(bestLag / div);
    if (lag < minLag) continue;
    if (score(lag) >= bestScore * OCTAVE_TOLERANCE) {
      bestLag = lag;
      bestScore = score(lag);
      break;
    }
  }

  // PHASE, then grid. Walking fixed windows from frame 0 and taking each window's
  // strongest onset looks equivalent but is not: the window boundaries land wherever
  // the clip happens to start, so a window that falls entirely between two hits has
  // no onset in it at all and gets skipped — emitting a beat list with occasional
  // double-length gaps on a metronome-steady source. So anchor the grid on the
  // loudest onset in the whole window and step outward from there, snapping each grid
  // position to the nearest real onset within a quarter beat.
  let anchor = 0;
  for (let i = 1; i < n; i++) if (flux[i]! > flux[anchor]!) anchor = i;

  const snap = Math.max(1, Math.round(bestLag / 4));
  const beats: number[] = [];
  const first = anchor - Math.floor(anchor / bestLag) * bestLag;
  for (let grid = first; grid < n; grid += bestLag) {
    let at = grid;
    let best = flux[grid]!;
    for (let i = Math.max(0, grid - snap); i < Math.min(n, grid + snap + 1); i++) {
      if (flux[i]! > best) {
        best = flux[i]!;
        at = i;
      }
    }
    beats.push(at / fps);
  }
  return { bpm: (60 * fps) / bestLag, beats: new Float32Array(beats) };
}

/** `buckets` normalised peak amplitudes over a mono window — the static overview. */
function overviewPeaks(mono: Float32Array, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  const per = mono.length / buckets;
  let max = 0;
  for (let b = 0; b < buckets; b++) {
    const lo = Math.floor(b * per);
    const hi = Math.min(mono.length, Math.max(lo + 1, Math.floor((b + 1) * per)));
    let pk = 0;
    // Stride the scan: a peak that only one sample in 16 reaches is inaudible, and
    // a full scan of a 3-minute track for a 128-column overview is pure waste.
    const step = Math.max(1, Math.floor((hi - lo) / 512));
    for (let i = lo; i < hi; i += step) {
      const a = mono[i]! < 0 ? -mono[i]! : mono[i]!;
      if (a > pk) pk = a;
    }
    out[b] = pk;
    if (pk > max) max = pk;
  }
  if (max > SILENCE) for (let b = 0; b < buckets; b++) out[b] = out[b]! / max;
  return out;
}

/** Mono sum of `[from, to)`, averaged across channels. */
function downmix(channels: Float32Array[], from: number, to: number): Float32Array {
  const out = new Float32Array(Math.max(0, to - from));
  const n = channels.length;
  for (const ch of channels) {
    for (let i = from; i < to; i++) out[i - from] = out[i - from]! + (ch[i] ?? 0) / n;
  }
  return out;
}

/** Mono sample at an absolute index — the slow path for windows that reach outside
 *  the analysed span (the first and last frames of a trimmed window). */
function sampleAt(channels: Float32Array[], idx: number): number {
  let v = 0;
  for (const ch of channels) v += ch[idx] ?? 0;
  return v / channels.length;
}

/** −1..1 float → butterchurn's 0..255 time-domain byte (128 = silence). */
function toByte(v: number): number {
  const b = Math.round(v * 128 + 128);
  return b < 0 ? 0 : b > 255 ? 255 : b;
}

function normalise(a: Float32Array): void {
  normaliseTogether([a]);
}

/**
 * Scale several tracks onto a shared DECIBEL scale: the common maximum reads 1.0,
 * a value `DB_RANGE` dB below it reads 0, and anything quieter clamps to 0.
 *
 * Silence stays exactly 0 rather than becoming the floor of the range, so a silent
 * passage reads as empty instead of as a uniform low hum across every bar.
 */
function normaliseDb(tracks: Float32Array[]): void {
  let max = 0;
  for (const a of tracks) for (let i = 0; i < a.length; i++) if (a[i]! > max) max = a[i]!;
  if (max <= SILENCE) {
    for (const a of tracks) a.fill(0);
    return;
  }
  for (const a of tracks) {
    for (let i = 0; i < a.length; i++) {
      const v = a[i]!;
      if (v <= 0) { a[i] = 0; continue; }
      // 20·log10 — these are amplitudes, not powers.
      const db = 20 * Math.log10(v / max);
      a[i] = db <= -DB_RANGE ? 0 : 1 + db / DB_RANGE;
    }
  }
}

/** Scale several tracks by their COMMON maximum, preserving the ratios between them. */
function normaliseTogether(tracks: Float32Array[]): void {
  let max = 0;
  for (const a of tracks) for (let i = 0; i < a.length; i++) if (a[i]! > max) max = a[i]!;
  if (max <= SILENCE) {
    for (const a of tracks) a.fill(0);
    return;
  }
  for (const a of tracks) for (let i = 0; i < a.length; i++) a[i] = a[i]! / max;
}

/** Band edges as FFT bin indices, log-spaced from bin 1 to Nyquist. Length `bands + 1`. */
function logBandEdges(bands: number, half: number): Int32Array {
  const out = new Int32Array(bands + 1);
  const lo = Math.log(1);
  const hi = Math.log(half);
  for (let b = 0; b <= bands; b++) {
    out[b] = Math.min(half, Math.max(1, Math.round(Math.exp(lo + ((hi - lo) * b) / bands))));
  }
  // Log spacing collides at the bottom (bins 1,1,1,2…); nudge each edge past its
  // predecessor so no band ends up empty and the low bars stay distinct.
  for (let b = 1; b <= bands; b++) {
    if (out[b]! <= out[b - 1]!) out[b] = Math.min(half, out[b - 1]! + 1);
  }
  return out;
}

/** Periodic Hann window — cheap, and its sidelobes are low enough that one loud
 *  band doesn't leak across the whole spectrum and flatten the bars. */
function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

/**
 * Iterative radix-2 Cooley-Tukey FFT, in place. `re.length` must be a power of two.
 * Written out rather than pulled in: it is 30 lines, the engine takes no
 * dependencies for maths it can state exactly, and this one is pinned by a test
 * against an analytically-known spectrum.
 */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n < 2 || (n & (n - 1)) !== 0) throw new Error('fftInPlace: length must be a power of two');

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len >> 1; k++) {
        const ar = re[i + k]!;
        const ai = im[i + k]!;
        const br = re[i + k + (len >> 1)]!;
        const bi = im[i + k + (len >> 1)]!;
        const tr = br * cr - bi * ci;
        const ti = br * ci + bi * cr;
        re[i + k] = ar + tr;
        im[i + k] = ai + ti;
        re[i + k + (len >> 1)] = ar - tr;
        im[i + k + (len >> 1)] = ai - ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.round(clamp(Number.isFinite(v) ? v : lo, lo, hi));
}

function nextPow2(v: number): number {
  let n = 1;
  while (n < v) n <<= 1;
  return n;
}
