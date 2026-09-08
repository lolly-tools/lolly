// SPDX-License-Identifier: MPL-2.0
/**
 * Web implementation of the `recorder` capability - device A/V capture + a live
 * audio-level meter (engine bridge v1.17). The runtime drives a tool's `onLevel`
 * hook from these levels (a mic recorder's VU meter + coaching) and orchestrates a
 * recording session (runtime.startRecording → RecordSession).
 *
 * Like `media`, the whole MediaStream / MediaRecorder / AnalyserNode lives HERE, in
 * the shell - the engine only ever sees plain numbers (AudioLevel) and finished
 * Blobs, so it stays DOM-free. Audio is analysed + recorded on the device and never
 * leaves it.
 *
 * Two consumers share the design:
 *   - `meter` - a pre-record "sound check": ref-counted getUserMedia({audio}) +
 *                AnalyserNode on a rAF loop, mirroring media.ts. Paused while hidden.
 *   - `record` - a full capture session (mic, optionally camera) via MediaRecorder;
 *                it taps its own AnalyserNode so levels keep flowing during the take.
 */

import { coverCrop, validFrame } from './frame-crop.ts';
import type {
  RecorderAPI, MeterAPI, RecordOpts, RecordSession, AudioLevel, StillOpts,
} from '@lolly-tools/core/host-v1';
// Import the tiny mime-candidate list directly (NOT videoMimeType from export.ts) - 
// recorder.ts is wired into the bridge at boot, and pulling in export.ts (the whole
// rasteriser) would drag it into the preload bundle. video-mime.ts is dependency-free.
import { videoMimeCandidates, audioMimeCandidates, videoBitrate, LIVE_BITS_PER_PIXEL } from './video-mime.ts';
// Tiny dependency-free shell side channel - safe to import on the boot path.
import { claimRecordPreview } from '../lib/record-preview.ts';
import { recorderAvailable } from './capture-support.ts';

/** Best supported recorder mime for a video capture (audio+video), or null. Local
 *  copy of export.ts's videoMimeType so the boot path never imports the rasteriser. */
function videoMimeType(preferred?: 'webm' | 'mp4', { audio = false }: { audio?: boolean } = {}): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return videoMimeCandidates(preferred as string, { audio }).find(t => MediaRecorder.isTypeSupported?.(t)) ?? null;
}

type LevelCallback = (level: AudioLevel) => void;

const MAX_FPS = 30;
const MIN_INTERVAL = 1000 / MAX_FPS;
const CLIP_THRESHOLD = 0.99;      // peak at/above this = clipping
const FFT_SIZE = 2048;            // analyser window
// Light smoothing so the loudness bar reads like a real VU meter (fast attack,
// slower release) rather than jittering frame-to-frame. Peak uses a hold+decay.
const RMS_ATTACK = 0.5;
const RMS_RELEASE = 0.12;
// Peak marker: jump to a new peak, HANG at it briefly, then fall off with a gentle
// per-frame decay - a classic peak-hold whose visible slide back down reads the recent
// loudness history. The dB read-out (peak-derived) is separately EMA-eased so the number
// doesn't jitter frame-to-frame.
const PEAK_DECAY = 0.94;    // gentler per-frame fall (was 0.9) so the fall-off is a readable slide
const PEAK_HANG_MS = 700;   // hold the peak at its max this long BEFORE it starts falling off
const DB_SMOOTH_MS = 260;   // EMA time-constant for the dB READOUT so the number eases, not jitters
// Noise-floor tracker: snap down to any new quiet minimum instantly, release UP very
// slowly (~0.5 dB/s at 30fps) so the floor sits at the level in the gaps between
// speech, not the speech itself.
const FLOOR_RELEASE_DB = 0.5 / MAX_FPS;
// Mains-hum bands (50/60 Hz + first harmonics) - tonal electrical hum / ground loop.
const HUM_HZ = [50, 60, 100, 120, 150, 180];
// Spectral-flatness (hiss) is measured over a mid band, skipping low rumble + the
// very top where mic response rolls off.
const HISS_LO_HZ = 400, HISS_HI_HZ = 8000;
// Loudness-envelope steadiness: a fan / AC / hiss holds a near-CONSTANT rms, while speech
// MODULATES it (syllabic peaks + gaps). We track the raw rms mean + mean-abs-deviation
// over ~1.5s and map the coefficient of variation to 0..1 (steady drone → 1, speech → 0),
// so coaching can tell background noise from speech independent of level.
const STEADY_TAU_MS = 1500;    // envelope-stats time constant
const STEADY_MIN_RMS = 0.008;  // below this there's too little signal to judge
const STEADY_COV = 0.4;        // rms CoV at/above which the envelope reads as fully modulated (speech)

/** Bins (± a neighbour) covering the mains-hum frequencies, for a given bin width.
 *  Precomputed once per stream (binHz is fixed) to avoid per-frame allocation. */
function humBinsFor(binHz: number): Set<number> {
  const bins = new Set<number>();
  for (const f of HUM_HZ) { const b = Math.round(f / binHz); bins.add(b - 1); bins.add(b); bins.add(b + 1); }
  return bins;
}
/** Frequency-domain cues from an analyser's magnitude spectrum (dB per bin). Returns
 *  hum (0..1 mains-band share) and hiss (0..1 spectral flatness of the mid band).
 *  `humBins` + band edges are precomputed by the caller (constant for the stream). */
function spectralCues(freqDb: Float32Array, humBins: Set<number>, loBin: number, hiBin: number): { hum: number; hiss: number } {
  let total = 0, mains = 0;             // linear-amplitude sums for the hum ratio
  let logSum = 0, linSum = 0, n = 0;    // for flatness over the mid band
  for (let i = 1; i < freqDb.length; i++) {
    const amp = 10 ** (freqDb[i]! / 20);   // dB → linear amplitude
    total += amp;
    if (humBins.has(i)) mains += amp;
    if (i >= loBin && i <= hiBin) {
      linSum += amp;
      logSum += Math.log(amp + 1e-12);
      n++;
    }
  }
  const hum = total > 1e-9 ? Math.min(1, mains / total) : 0;
  const geo = n ? Math.exp(logSum / n) : 0;
  const arith = n ? linSum / n : 0;
  const hiss = arith > 1e-9 ? Math.min(1, geo / arith) : 0;
  return { hum, hiss };
}

type AudioContextCtor = typeof AudioContext;
function audioContextCtor(): AudioContextCtor | null {
  return (globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext) ?? null;
}

/**
 * Analyse a live MediaStream's audio into AudioLevel samples pushed to `emit` on a
 * rAF loop (throttled, paused while hidden). Returns a stop() that tears the graph
 * down. Shared by the meter and each record session.
 */
function analyseStream(stream: MediaStream, emit: (l: AudioLevel) => void): () => void {
  const AC = audioContextCtor();
  if (!AC || !stream.getAudioTracks().length) return () => {};
  const ctx = new AC();
  const srcNode = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  srcNode.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const freqBuf = new Float32Array(analyser.frequencyBinCount); // dB per bin
  const binHz = ctx.sampleRate / analyser.fftSize;
  // Precompute the mains-hum bins + flatness band edges ONCE - binHz is fixed for the
  // life of the AudioContext, so recomputing them every frame would just churn the GC.
  const humBins = humBinsFor(binHz);
  const loBin = Math.max(1, Math.floor(HISS_LO_HZ / binHz));
  const hiBin = Math.min(freqBuf.length - 1, Math.ceil(HISS_HI_HZ / binHz));
  let rafId = 0;
  let last = 0;
  let rmsSmoothed = 0;
  let peakHold = 0;
  let peakHangUntil = 0;       // peakHold stays put until now passes this, then it falls off
  let dbfsSmoothed = -Infinity; // eased dB read-out (separate from the raw peak dbfs)
  // Loudness-envelope stats for the `steady` (noise-vs-speech) metric.
  let rmsEnvMean = 0;   // slow mean of the RAW rms
  let rmsEnvDev = 0;    // slow mean-abs-deviation of the raw rms about that mean
  // dBFS min-hold of the loudness (the quiet-gap level). Starts HIGH so the first real
  // sample snaps it down; then it tracks the minimum with a slow upward release.
  let noiseFloor = Infinity;
  let stopped = false;

  const tick = (now: number): void => {
    if (stopped) return;
    rafId = requestAnimationFrame(tick);
    if (now - last < MIN_INTERVAL) return;
    const dt = last ? now - last : MIN_INTERVAL;   // ms since the last PROCESSED frame (for time-based EMAs)
    last = now;
    if (typeof document !== 'undefined' && document.hidden) return; // don't meter a backgrounded tab
    analyser.getFloatTimeDomainData(buf);
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i]!;
      sumSq += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    // Envelope steadiness: track the RAW rms mean + mean-abs-deviation over ~1.5s; their
    // ratio (coefficient of variation) is high for speech (peaks/gaps), low for a drone.
    const envA = Math.min(1, dt / STEADY_TAU_MS);
    rmsEnvMean += (rms - rmsEnvMean) * envA;
    rmsEnvDev += (Math.abs(rms - rmsEnvMean) - rmsEnvDev) * envA;
    const cov = rmsEnvMean > STEADY_MIN_RMS ? rmsEnvDev / rmsEnvMean : 0;
    const steady = rmsEnvMean > STEADY_MIN_RMS ? Math.max(0, 1 - cov / STEADY_COV) : 0;
    // Attack fast (sound arriving), release slow (bar falls smoothly).
    const k = rms > rmsSmoothed ? RMS_ATTACK : RMS_RELEASE;
    rmsSmoothed = rmsSmoothed + (rms - rmsSmoothed) * k;
    // Peak-hold with hang-then-fall-off: snap up to any new peak and hold it for
    // PEAK_HANG_MS, then decay so the marker slides back down (a visible fall-off).
    if (peak >= peakHold) { peakHold = peak; peakHangUntil = now + PEAK_HANG_MS; }
    else if (now >= peakHangUntil) { peakHold *= PEAK_DECAY; }
    const clampedPeak = Math.min(1, peakHold);
    // Noise floor: track the RMS in dBFS, snapping down to any new minimum and
    // releasing up slowly so it settles at the level between words (the room floor).
    const rmsDb = rms > 1e-7 ? 20 * Math.log10(rms) : -140;
    noiseFloor = rmsDb < noiseFloor ? rmsDb : noiseFloor + FLOOR_RELEASE_DB;
    // dB read-out: EMA-ease the peak dBFS so the number slides rather than flickering
    // its last digit every frame (the marker's own hold/fall-off drives the raw value).
    const dbfsRaw = clampedPeak > 0 ? 20 * Math.log10(clampedPeak) : -Infinity;
    if (!isFinite(dbfsRaw)) dbfsSmoothed = -Infinity;
    else dbfsSmoothed = isFinite(dbfsSmoothed) ? dbfsSmoothed + (dbfsRaw - dbfsSmoothed) * Math.min(1, dt / DB_SMOOTH_MS) : dbfsRaw;
    const dbfs = dbfsSmoothed;
    analyser.getFloatFrequencyData(freqBuf);
    const { hum, hiss } = spectralCues(freqBuf, humBins, loBin, hiBin);
    // SNR compares like with like - the RMS signal against the RMS-tracked floor (NOT
    // the peak dbfs, which would overstate it by the crest factor).
    const snr = isFinite(noiseFloor) ? Math.round((rmsDb - noiseFloor) * 10) / 10 : undefined;
    emit({
      rms: Math.min(1, rmsSmoothed),
      peak: clampedPeak,
      dbfs,
      clipping: peak >= CLIP_THRESHOLD,
      noiseFloor: isFinite(noiseFloor) ? Math.round(noiseFloor * 10) / 10 : -Infinity,
      snr,
      hum: Math.round(hum * 100) / 100,
      hiss: Math.round(hiss * 100) / 100,
      steady: Math.round(steady * 100) / 100,
      t: now,
    });
  };
  rafId = requestAnimationFrame(tick);
  ctx.resume?.().catch(() => {});

  return () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    try { srcNode.disconnect(); } catch { /* ignore */ }
    ctx.close().catch(() => {});
  };
}

// Audio-only recorder mime, honouring the preferred container (mp4 → aac, else
// opus/webm), filtered to what THIS browser can actually record. The candidate
// strings live in video-mime.ts beside the video ones - DOM-free, so the guard
// that every one of them maps to a signable container can run under node
// (bridge/capture-clip-c2pa.test.ts).
function audioMimeType(preferred?: 'webm' | 'mp4'): string {
  return audioMimeCandidates(preferred).find(t => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

function createMeter(): MeterAPI {
  let stream: MediaStream | null = null;
  let stopAnalyse: (() => void) | null = null;
  let refcount = 0;
  let starting: Promise<void> | null = null;
  const subscribers = new Set<LevelCallback>();

  const emit = (level: AudioLevel): void => {
    for (const cb of [...subscribers]) {
      try { cb(level); } catch { /* one bad subscriber must not kill the loop */ }
    }
  };

  function teardown(): void {
    if (stopAnalyse) { stopAnalyse(); stopAnalyse = null; }
    if (stream) { stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } }); stream = null; }
  }

  async function start(opts?: { deviceId?: string }): Promise<void> {
    refcount++;
    if (stream) return;
    if (starting) {
      // Follower on a shared in-flight start: if that start rejects, drop the
      // refcount we just took so the leader's teardown isn't blocked and the mic
      // doesn't stay lit.
      return starting.catch((e) => { refcount = Math.max(0, refcount - 1); throw e; });
    }
    starting = (async () => {
      // The meter is a pre-record SOUND CHECK, so open the mic RAW - no echo
      // cancellation, no noise suppression, no auto-gain. It never plays audio back,
      // so raw is safe, and it's the only way to honestly measure the room's true
      // level + background noise (a recording session keeps suppression ON for a
      // clean file - see openSession). autoGainControl:false already kept levels true.
      // A chosen mic (device picker) opens that exact device - it MUST be the same
      // one the take records, or these numbers describe a different mic (v1.154).
      const audio: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
      if (opts?.deviceId) audio.deviceId = { exact: opts.deviceId };
      const s = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      stream = s;
      stopAnalyse = analyseStream(s, emit);
    })();
    try {
      await starting;
    } catch (e) {
      refcount = Math.max(0, refcount - 1);
      teardown();
      throw e;
    } finally {
      starting = null;
    }
  }

  function stop(): void {
    refcount = Math.max(0, refcount - 1);
    if (refcount === 0) teardown();
  }

  function subscribe(cb: LevelCallback): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  return { start, stop, subscribe };
}

/**
 * One capture source, opened and ready to record: the stream handed to MediaRecorder
 * plus the teardown for EVERYTHING behind it. A mixed screen+mic stream's tracks are
 * new objects, so stopping them would leave the real mic and the display share live - 
 * hence release() rather than the caller stopping stream.getTracks() itself.
 */
interface OpenSource {
  stream: MediaStream;
  release: () => void;
  /** Whether a microphone track was actually acquired (a granted mic, not a
   *  requested-but-denied one). Surfaced on the RecordSession so provenance + UX
   *  reflect what was recorded, never what was asked for. */
  micActive: boolean;
  /** Fires when the SOURCE ends on its own - the user hitting the browser's own
   *  "Stop sharing" bar. Undefined for device capture, which has no such control. */
  onSourceEnded?: (cb: () => void) => void;
}

/**
 * Mix N audio streams down to a single track (screen/tab audio + the mic narration).
 * MediaRecorder takes one audio track, and two separate tracks would leave the mic
 * silently dropped - the failure users report as "my voiceover didn't record".
 */
function mixAudioTracks(streams: MediaStream[]): { track: MediaStreamTrack | null; close: () => void } {
  const withAudio = streams.filter(s => s.getAudioTracks().length > 0);
  if (!withAudio.length) return { track: null, close: () => {} };
  // One source needs no mixing graph - hand its track straight through (cheaper, and
  // it keeps the original track's own constraints/processing intact).
  if (withAudio.length === 1) return { track: withAudio[0]!.getAudioTracks()[0]!, close: () => {} };
  const AC = audioContextCtor();
  if (!AC) return { track: withAudio[0]!.getAudioTracks()[0]!, close: () => {} };
  const ctx = new AC();
  const dest = ctx.createMediaStreamDestination();
  for (const s of withAudio) {
    try { ctx.createMediaStreamSource(s).connect(dest); } catch { /* a source with no live track - skip it */ }
  }
  ctx.resume?.().catch(() => {});
  return { track: dest.stream.getAudioTracks()[0] ?? null, close: () => { ctx.close().catch(() => {}); } };
}

/**
 * Display capture (v1.54). The browser's picker IS the selection UI - we pass no
 * hint about what to share and cannot enumerate the user's screens, so what comes
 * back is exactly what they chose to hand over, nothing more.
 *
 * System audio is requested in the SAME picker as the video (there's no second
 * prompt), and the user can withhold it, so `systemAudio: true` is a request, never a
 * guarantee - we mix whatever actually arrives.
 */
async function openDisplaySource(opts: RecordOpts): Promise<OpenSource> {
  const wantMic = opts.audio !== false;
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    // Asking for audio here is what puts the "Also share tab audio" checkbox in the
    // picker. Chromium-on-Windows/ChromeOS can grant true system audio; elsewhere this
    // yields tab audio or simply nothing - either way the video still records.
    audio: opts.systemAudio === true,
  });
  // The mic is a SEPARATE prompt, and it must come after the picker: asking first
  // would make the user grant a microphone before they've agreed to share anything.
  let mic: MediaStream | null = null;
  if (wantMic) {
    try {
      const micAudio: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      if (opts.audioDeviceId) micAudio.deviceId = { exact: opts.audioDeviceId };
      mic = await navigator.mediaDevices.getUserMedia({ audio: micAudio, video: false });
    } catch {
      // Mic denied/missing: record the screen anyway rather than losing the whole take.
      // The control surfaces this; a silent recording beats no recording.
      mic = null;
    }
  }
  const { track: audioTrack, close: closeMix } = mixAudioTracks([...(mic ? [mic] : []), display]);
  const stream = new MediaStream([...display.getVideoTracks(), ...(audioTrack ? [audioTrack] : [])]);
  return {
    stream,
    // Only true when a mic stream was genuinely acquired - a denied/absent mic left it null.
    micActive: mic !== null,
    release: () => {
      closeMix();
      // Stop the SOURCE streams, not `stream` - its audio track may be the mix's
      // output, whose stop() would leave the real mic and the share running.
      display.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
      mic?.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
      stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
    },
    onSourceEnded: (cb) => {
      // The browser's floating "Stop sharing" bar ends the track without telling us
      // otherwise. Without this the recorder keeps running against a dead track and
      // the take is only finished when the user thinks to press Stop in the page.
      const v = display.getVideoTracks()[0];
      if (v) v.addEventListener('ended', cb, { once: true });
    },
  };
}

/** Camera/mic capture - the pre-1.54 path, unchanged. */
async function openDeviceSource(opts: RecordOpts): Promise<OpenSource> {
  const wantAudio = opts.audio !== false;
  const wantVideo = opts.video === true;
  const edge = opts.maxEdge && opts.maxEdge > 0 ? Math.round(opts.maxEdge) : 1280;
  // A chosen mic (device picker, v1.154) records from that exact device - the same
  // one the sound-check meter opened (MeterAPI.start({deviceId})).
  const audio: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (opts.audioDeviceId) audio.deviceId = { exact: opts.audioDeviceId };
  // A target FRAME (v1.165): ask the camera for that size and aspect so the crop below
  // stays small, then record a canvas of exactly that size (see frameStream).
  const frame = wantVideo ? validFrame(opts.frame) : null;
  const constraints: MediaStreamConstraints = {
    audio: wantAudio ? audio : false,
    video: wantVideo
      ? (frame
        ? { facingMode: opts.facingMode ?? 'user', width: { ideal: frame.width }, height: { ideal: frame.height }, aspectRatio: { ideal: frame.width / frame.height } }
        : { facingMode: opts.facingMode ?? 'user', width: { ideal: edge }, height: { ideal: edge } })
      : false,
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  // getUserMedia is all-or-nothing: a denied mic rejects the whole call, so a resolved
  // stream that asked for audio genuinely has a mic track.
  if (frame) {
    const framed = frameStream(stream, frame);
    return {
      stream: framed.stream, micActive: wantAudio,
      release: () => {
        framed.release();
        stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
      },
    };
  }
  return {
    stream, micActive: wantAudio,
    release: () => stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } }),
  };
}

/**
 * The camera, cover-cropped into a canvas of exactly `frame` and re-captured as a
 * stream (v1.165 RecordOpts.frame). The camera's own track keeps its native size and
 * aspect; every frame is drawn through coverCrop() into the canvas, whose
 * captureStream() track is what the encoder (and the self-view) sees, so the file is
 * the frame the caller asked for - a 4:3 webcam into a 9:16 story, cropped, never
 * stretched. Audio tracks pass through untouched. requestVideoFrameCallback paces the
 * draw to the camera where the browser has it; a rAF loop elsewhere.
 */
function frameStream(source: MediaStream, frame: { width: number; height: number }): { stream: MediaStream; release(): void } {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = source;
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  const fps = Math.round(source.getVideoTracks()[0]?.getSettings?.().frameRate ?? 30) || 30;
  let live = true;
  let raf = 0;
  type RVFC = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
  const rvfc = (video as RVFC).requestVideoFrameCallback?.bind(video);
  const draw = (): void => {
    if (!live) return;
    const sw = video.videoWidth, sh = video.videoHeight;
    if (ctx && sw > 0 && sh > 0) {
      const c = coverCrop(sw, sh, frame.width, frame.height);
      ctx.drawImage(video, c.sx, c.sy, c.sw, c.sh, 0, 0, frame.width, frame.height);
    }
    if (rvfc) rvfc(draw); else raf = requestAnimationFrame(draw);
  };
  void video.play().catch(() => { /* a muted inline video should always play */ });
  draw();
  const out = canvas.captureStream(fps);
  const merged = new MediaStream([...out.getVideoTracks(), ...source.getAudioTracks()]);
  return {
    stream: merged,
    release: () => {
      live = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      out.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
      try { video.pause(); } catch { /* ignore */ }
      video.srcObject = null;
    },
  };
}

/**
 * OWNER SIGN-OFF SWITCH (plans/153 WP-I, provenance-gated). Turning this on makes the
 * controlled WebCodecs path (bridge/recorder-webcodecs.ts) the PREFERRED recorder wherever
 * its Chromium-first gate passes, which makes AV1-in-mp4 (av01.0.08M.08) the DEFAULT capture
 * codec for the first time. The bytes are the same container the EXPORT path already stamps
 * AV1-in-mp4 through - a confirmation, not new placer work - but it is a provenance-relevant
 * default change, so it stays OFF until the owner signs off. MediaRecorder is untouched while
 * this is false. Owner sign-off given 2026-08-26 (Andy): AV1-in-mp4 as the default
 * capture codec is accepted; any WebCodecs failure still falls back to MediaRecorder. */
const WEBCODECS_RECORDER = true;

/**
 * The encode+mux engine behind one take. Hides from openSession whether it is MediaRecorder
 * (stop is EVENT-driven: ondataavailable buffers, onstop settles) or WebCodecs+mediabunny
 * (PROMISE-driven: output.finalize() resolves the bytes). openSession drives both through the
 * same produceBlob()/abort()/type seam. `type` is the container mime the finished Blob carries -
 * read off the recorder for MediaRecorder, known up front for WebCodecs.
 */
interface RecordEngine {
  readonly type: string;
  /** Stop capture and resolve the finished container. Called at most once. */
  produceBlob(): Promise<Blob>;
  /** Discard the take, releasing the encoder. No usable Blob. */
  abort(): void;
}

/**
 * The universal MediaRecorder engine - the browser picks codec/bitrate/GOP within our mime +
 * bitrate hints, writes an Infinity-duration WebM or an mp4, Opus/AAC audio only. Throws if
 * even the browser-default recorder can't encode the stream, OR if start() throws (a codec
 * surfacing only at start, a track ending between construct and start); the caller releases
 * the source and rethrows.
 */
function mediaRecorderEngine(stream: MediaStream, wantVideo: boolean, haveAudio: boolean, opts: RecordOpts): RecordEngine {
  const mimeType = wantVideo
    ? (videoMimeType(opts.format ?? 'mp4', { audio: haveAudio }) ?? videoMimeType(opts.format ?? 'mp4') ?? '')
    : audioMimeType(opts.format);
  // Explicit video bitrate: left to its default, MediaRecorder encodes ~2.5 Mbps flat
  // regardless of resolution - visibly blocky for a 1080p+ screen or camera take, and
  // a live take gets no second chance. Scale with the track's actual size × frame rate
  // at the live bits-per-pixel tier. Settings can be sparse right after acquisition,
  // so fall back to 720p30 rather than a degenerate request. Browsers clamp (never
  // reject) bitrate values, so only the mime hint can make construction throw.
  const encOpts: MediaRecorderOptions = {};
  if (wantVideo) {
    const s = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
    encOpts.videoBitsPerSecond = videoBitrate(s.width ?? 1280, s.height ?? 720, s.frameRate ?? 30, LIVE_BITS_PER_PIXEL);
  }
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { ...encOpts, mimeType } : encOpts);
  } catch {
    recorder = new MediaRecorder(stream, encOpts); // drop the rejected mime hint, keep the bitrate
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  let settle: ((b: Blob) => void) | null = null;
  const finished = new Promise<Blob>((resolve) => { settle = resolve; });
  // Normalise the container label (drop the codecs= tail) for the Blob type so downstream
  // extension/derivation sees a clean 'audio/webm' / 'video/mp4'.
  const cleanType = (): string => {
    const type = recorder.mimeType || mimeType || (wantVideo ? 'video/webm' : 'audio/webm');
    return type.split(';')[0] || type;
  };
  recorder.onstop = () => { settle?.(new Blob(chunks, { type: cleanType() })); };
  recorder.start();   // may throw synchronously - caller releases the source and rethrows
  return {
    type: cleanType(),
    produceBlob(): Promise<Blob> {
      try { recorder.stop(); } catch { settle?.(new Blob(chunks, { type: cleanType() })); }
      return finished;
    },
    abort(): void { try { recorder.stop(); } catch { /* already stopped */ } },
  };
}

async function openSession(opts: RecordOpts): Promise<RecordSession> {
  const isScreen = opts.source === 'screen' && opts.video === true;
  const wantAudio = opts.audio !== false;
  // A screen take always has a video track; a device take only when asked.
  const wantVideo = isScreen || opts.video === true;
  const publishPreview = wantVideo ? claimRecordPreview() : () => {};
  const source = isScreen ? await openDisplaySource(opts) : await openDeviceSource(opts);
  const { stream } = source;
  // A screen recording's audio is opportunistic - the picker's system-audio checkbox
  // and the mic prompt can both come back empty. Record what actually arrived, so the
  // mime hint never claims a track the stream doesn't have.
  const haveAudio = isScreen ? stream.getAudioTracks().length > 0 : wantAudio;

  // Preview + live levels are engine-agnostic, and set up BEFORE the encoder so a failed
  // construction tears them down too (releaseDevices covers all three). Video take: expose
  // the live capture stream to the shell for a self-view during the take (the framing
  // viewfinder is torn down once we open this). Shell-internal side channel; the DOM-free
  // engine stays out of it.
  publishPreview(stream);
  const subscribers = new Set<LevelCallback>();
  const stopAnalyse = haveAudio
    ? analyseStream(stream, (l) => { for (const cb of [...subscribers]) { try { cb(l); } catch { /* ignore */ } } })
    : () => {};

  let maxTimer = 0;
  let released = false;
  const releaseDevices = (): void => {
    if (released) return;
    released = true;
    if (maxTimer) { clearTimeout(maxTimer); maxTimer = 0; }
    stopAnalyse();
    publishPreview(null);
    source.release();
  };

  // The controlled WebCodecs path (chosen bitrate/GOP/contentHint, container known up front)
  // when its Chromium-first gate passes AND the owner sign-off switch is on; MediaRecorder is
  // the universal fallback. LAZY-imported so recorder-webcodecs (→ video-shared, mediabunny-mux)
  // never enters the boot bundle recorder.ts rides. A WebCodecs failure (unavailable, no codec,
  // start() reject) falls through to MediaRecorder on the still-live stream.
  let engine: RecordEngine | null = null;
  if (WEBCODECS_RECORDER) {
    try {
      const wc = await import('./recorder-webcodecs.ts');
      if (wc.webCodecsRecorderAvailable({ wantVideo, wantAudio: haveAudio })) {
        engine = await wc.createWebCodecsRecorder(stream, { wantVideo, haveAudio, format: opts.format, screen: isScreen });
      }
    } catch { engine = null; /* fall through to MediaRecorder */ }
  }
  if (!engine) {
    try {
      engine = mediaRecorderEngine(stream, wantVideo, haveAudio, opts);
    } catch (e) {
      // No encodable format at all, or start() threw: release the camera/mic/display we
      // acquired so the hardware indicator (or the "sharing your screen" bar) never stays
      // lit with no recording running, then surface the failure.
      releaseDevices();
      throw e;
    }
  }
  const activeEngine = engine;   // non-null past here; captured so the closures don't re-widen

  let settle: ((b: Blob) => void) | null = null;
  const finished = new Promise<Blob>((resolve) => { settle = resolve; });
  let finishing = false;
  // One finish path for stop(), maxMs and the "Stop sharing" bar: produce the blob, THEN
  // release devices (the WebCodecs sources must stay live until finalize() reads them). A
  // rejected produceBlob still releases and settles - empty, so a pending stop() never hangs.
  const finish = (): void => {
    if (finishing) return;
    finishing = true;
    activeEngine.produceBlob().then(
      (blob) => { releaseDevices(); settle?.(blob); },
      () => { releaseDevices(); settle?.(new Blob([], { type: activeEngine.type })); },
    );
  };

  if (opts.maxMs && opts.maxMs > 0) {
    maxTimer = window.setTimeout(finish, opts.maxMs);
  }
  // Ending the share from the browser's own "Stop sharing" bar must finish the take, not
  // strand it: the track dies either way, so the only question is whether the user gets the
  // footage they already recorded. finish() runs the normal path, so they do.
  source.onSourceEnded?.(finish);

  return {
    micActive: source.micActive,
    subscribe(cb: LevelCallback): () => void {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    stop(): Promise<Blob> {
      finish();
      return finished;
    },
    cancel(): void {
      finishing = true;         // block any later finish()/stop()
      activeEngine.abort();
      releaseDevices();
      settle?.(new Blob([]));   // resolve any pending stop() with nothing
    },
  };
}

/**
 * One still frame from a live stream, encoded (v1.54). Waits for a frame to actually
 * arrive before drawing: a display stream's first frames can be blank while the
 * compositor warms up, and a screenshot of nothing looks like a broken tool.
 */
async function grabFrame(stream: MediaStream, opts: StillOpts): Promise<Blob> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play().catch(() => { /* a muted inline video should always play */ });
    // Wait for real dimensions + a decoded frame. requestVideoFrameCallback is exact
    // where it exists; elsewhere loadeddata + a rAF is close enough for a static screen.
    await new Promise<void>((resolve) => {
      const done = (): void => { clearTimeout(to); resolve(); };
      const to = setTimeout(done, 3000);   // never hang the UI on a source that won't paint
      type RVFC = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
      const v = video as RVFC;
      if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(done);
      else if (video.readyState >= 2) requestAnimationFrame(() => done());
      else video.addEventListener('loadeddata', () => requestAnimationFrame(() => done()), { once: true });
    });
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) throw new Error('no frame available from the capture source');
    // Native resolution by default - a screenshot is read, not glanced at, so downscaling
    // it by default would blur the very text the user is capturing.
    const scale = opts.maxEdge && opts.maxEdge > 0 ? Math.min(1, opts.maxEdge / Math.max(vw, vh)) : 1;
    const w = Math.max(1, Math.round(vw * scale)), h = Math.max(1, Math.round(vh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context for the still');
    ctx.drawImage(video, 0, 0, w, h);
    const type = opts.type ?? 'image/png';
    const quality = opts.quality ?? 0.97;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
    // toBlob nulls on an unsupported type - fall back to PNG rather than failing the grab.
    if (!blob) {
      const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!png) throw new Error('could not encode the still');
      return png;
    }
    return blob;
  } finally {
    video.srcObject = null;
    try { video.remove(); } catch { /* never mounted */ }
  }
}

export function createRecorderAPI(): RecorderAPI {
  const meter = createMeter();
  return {
    // The same probe bridge/index.ts's lazy facade answers from (capture-support.ts),
    // called rather than re-typed so the two can never disagree about what this
    // browser can do.
    isAvailable: recorderAvailable,
    meter,
    record(opts: RecordOpts = {}): Promise<RecordSession> {
      return openSession(opts);
    },
    async still(opts: StillOpts = {}): Promise<Blob> {
      const source = opts.source ?? 'screen';
      const stream = source === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        : await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      try {
        return await grabFrame(stream, opts);
      } finally {
        // A screenshot is one frame: release the share immediately, so the "sharing your
        // screen" bar never lingers over a capture that already finished.
        stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
      }
    },
  };
}
