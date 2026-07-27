// SPDX-License-Identifier: MPL-2.0
/**
 * The IN-PAGE half of the phase-3 sequence-export browser tier.
 *
 * This file never runs in Node. `tests/helpers/sequence-browser.ts` bundles it with
 * esbuild and serves it to a real Chromium; everything here executes in the page and
 * is reached from the test through `page.evaluate` against `window.SEQ`.
 *
 * It deliberately imports the REAL modules under test — `bridge/sequence-render.ts`,
 * `bridge/sequence-providers.ts`, `bridge/sequence-plan.ts`, `bridge/export.ts` and
 * `views/sequence-clock.ts`. Nothing about the pipeline is re-implemented here; the
 * only things this file owns are (a) synthesising self-identifying media, (b) building
 * a DOM stage that obeys the phase-1/2 attribute contract, and (c) decoding an export
 * back into numbers a `node:test` assertion can read.
 *
 * SELF-IDENTIFYING FRAMES. Every synthesised source frame paints its own index as a
 * row of 10 black/white blocks (a plain binary code) across the top sixth of the
 * picture, plus the number in text for a human looking at a dumped frame. Blocks
 * survive VP8/VP9/H.264 quantisation, rescaling and re-encoding in a way that a flat
 * "rgb(n,…)" fill does not, so "which source frame is this?" is answerable from the
 * exported file with a threshold, not a tolerance.
 */

import { renderSequence, _setSequenceWorkerFactory } from '../../shells/web/src/bridge/sequence-render.ts';
import { createVideoProvider } from '../../shells/web/src/bridge/sequence-providers.ts';
import { parseSequenceStage, frameTimestamps, activeSpanTimestamps, toCodedError } from '../../shells/web/src/bridge/sequence-plan.ts';
import { HIGH_WATER } from '../../shells/web/src/bridge/video-encode-core.ts';
import { MAX_LIVE_PROVIDERS } from '../../shells/web/src/bridge/sequence-render.ts';
import { createExportAPI } from '../../shells/web/src/bridge/export.ts';
import { applyTimeToElements, createAuthoredStore, OFF_CLASS } from '../../shells/web/src/views/sequence-clock.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const CODE_BITS = 10;

// ── registries (blobs and byte payloads live in the page, keyed by string) ────

const blobs = new Map<string, Blob>();
const urls = new Map<string, string>();
let nextKey = 0;
const put = (blob: Blob): string => {
  const key = `k${nextKey++}`;
  blobs.set(key, blob);
  urls.set(key, URL.createObjectURL(blob));
  return key;
};

// ── the binary frame code ────────────────────────────────────────────────────

function paintCode(ctx: Any, w: number, h: number, n: number, tint: string): void {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  const bw = w / CODE_BITS;
  const bh = Math.max(4, Math.round(h / 6));
  for (let b = 0; b < CODE_BITS; b++) {
    ctx.fillStyle = (n >> b) & 1 ? '#ffffff' : '#000000';
    ctx.fillRect(Math.round(b * bw), 0, Math.ceil(bw), bh);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(h / 5)}px monospace`;
  ctx.fillText(`#${n}`, 8, Math.round(h * 0.55));
}

/**
 * Read the code back out of already-drawn pixels.
 *
 * `rect` is where the source picture landed in the image being read, so the same
 * decoder works on a raw source frame and on a composited export frame. Each bit is
 * the mean luma of the middle half of its block: mid-grey (a block that got blurred
 * away, or a frame that is not one of ours) reads as `null` rather than a wrong number.
 */
function readCode(data: Uint8ClampedArray, imgW: number, rect: { x: number; y: number; w: number; h: number }): number | null {
  const bw = rect.w / CODE_BITS;
  const bh = Math.max(2, rect.h / 6);
  let n = 0;
  for (let b = 0; b < CODE_BITS; b++) {
    const x0 = Math.round(rect.x + b * bw + bw * 0.3);
    const x1 = Math.round(rect.x + b * bw + bw * 0.7);
    const y0 = Math.round(rect.y + bh * 0.25);
    const y1 = Math.round(rect.y + bh * 0.75);
    let sum = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * imgW + x) * 4;
        sum += 0.299 * (data[i] as number) + 0.587 * (data[i + 1] as number) + 0.114 * (data[i + 2] as number);
        count++;
      }
    }
    if (!count) return null;
    const luma = sum / count;
    if (luma > 96 && luma < 160) return null;         // neither black nor white: unreadable
    if (luma >= 160) n |= 1 << b;
  }
  return n;
}

// ── synthesising a clip ──────────────────────────────────────────────────────

export interface ClipSpec {
  w?: number;
  h?: number;
  frames?: number;
  fps?: number;
  container?: 'webm' | 'mp4';
  tint?: string;
  /** Audio track: a tone that runs only inside [fromSec, toSec) of the source. */
  tone?: { hz: number; gain: number; fromSec?: number; toSec?: number } | null;
  /** Emit an audio track that is all zeros (a real track carrying silence). */
  silentTrack?: boolean;
}

async function makeClip(spec: ClipSpec = {}): Promise<Any> {
  const w = spec.w ?? 320;
  const h = spec.h ?? 240;
  const frames = spec.frames ?? 90;
  const fps = spec.fps ?? 30;
  const container = spec.container ?? 'webm';
  const wantAudio = Boolean(spec.tone || spec.silentTrack);
  const rate = 48_000;

  const mux: Any = container === 'mp4'
    ? await import('mp4-muxer')
    : await import('webm-muxer');
  const muxer = new mux.Muxer({
    target: new mux.ArrayBufferTarget(),
    video: container === 'mp4'
      ? { codec: 'avc', width: w, height: h }
      : { codec: 'V_VP8', width: w, height: h, frameRate: fps },
    ...(wantAudio
      ? {
        audio: container === 'mp4'
          ? { codec: 'aac', numberOfChannels: 1, sampleRate: rate }
          : { codec: 'A_OPUS', numberOfChannels: 1, sampleRate: rate },
      }
      : {}),
    ...(container === 'mp4' ? { fastStart: 'in-memory' } : {}),
  });

  const venc = new (globalThis as Any).VideoEncoder({
    output: (c: Any, m: Any) => muxer.addVideoChunk(c, m),
    error: (e: Any) => { throw e; },
  });
  venc.configure({
    codec: container === 'mp4' ? 'avc1.42001f' : 'vp8',
    width: w, height: h, bitrate: 4_000_000, framerate: fps,
    ...(container === 'mp4' ? { avc: { format: 'avc' } } : {}),
  });

  const cvs = new OffscreenCanvas(w, h);
  const ctx = cvs.getContext('2d') as Any;
  for (let n = 0; n < frames; n++) {
    paintCode(ctx, w, h, n, spec.tint ?? '#1f6feb');
    const vf = new (globalThis as Any).VideoFrame(cvs, {
      timestamp: Math.round((n * 1e6) / fps),
      duration: Math.round(1e6 / fps),
    });
    venc.encode(vf, { keyFrame: n % 30 === 0 });
    vf.close();
    while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
  }
  await venc.flush();
  venc.close();

  if (wantAudio) {
    const total = Math.round((frames / fps) * rate);
    const pcm = new Float32Array(total);
    if (spec.tone) {
      const from = Math.round((spec.tone.fromSec ?? 0) * rate);
      const to = Math.round((spec.tone.toSec ?? frames / fps) * rate);
      for (let i = from; i < Math.min(to, total); i++) {
        pcm[i] = spec.tone.gain * Math.sin((2 * Math.PI * spec.tone.hz * i) / rate);
      }
    }
    const aenc = new (globalThis as Any).AudioEncoder({
      output: (c: Any, m: Any) => muxer.addAudioChunk(c, m),
      error: (e: Any) => { throw e; },
    });
    aenc.configure({
      codec: container === 'mp4' ? 'mp4a.40.2' : 'opus',
      sampleRate: rate, numberOfChannels: 1, bitrate: 96_000,
    });
    const CHUNK = 4800;
    for (let off = 0; off < total; off += CHUNK) {
      const n = Math.min(CHUNK, total - off);
      const ad = new (globalThis as Any).AudioData({
        format: 'f32-planar', sampleRate: rate, numberOfFrames: n, numberOfChannels: 1,
        timestamp: Math.round((off / rate) * 1e6),
        data: pcm.subarray(off, off + n),
      });
      aenc.encode(ad);
      ad.close();
      if (aenc.encodeQueueSize > 20) await new Promise((r) => setTimeout(r, 0));
    }
    await aenc.flush();
    aenc.close();
  }

  muxer.finalize();
  const bytes = new Uint8Array(muxer.target.buffer as ArrayBuffer);
  const blob = new Blob([bytes as BlobPart], { type: container === 'mp4' ? 'video/mp4' : 'video/webm' });
  const key = put(blob);
  return { key, url: urls.get(key), w, h, frames, fps, size: blob.size, container };
}

/** A copy of `key` cut to `frac` of its length — the silent-truncation fixture. */
function truncate(key: string, frac: number): Promise<Any> {
  const blob = blobs.get(key) as Blob;
  return blob.arrayBuffer().then((buf) => {
    const cut = new Uint8Array(buf).slice(0, Math.floor(buf.byteLength * frac));
    const k = put(new Blob([cut as BlobPart], { type: blob.type }));
    return { key: k, url: urls.get(k), size: cut.length };
  });
}

/** A WAV blob of a constant tone — the music-bed fixture (`opts.audio.url`). */
function makeBed(sec: number, hz: number, gain: number): Any {
  const rate = 48_000;
  const n = Math.round(sec * rate);
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const ascii = (off: number, s: string): void => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  ascii(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ascii(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ascii(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.round(gain * 32767 * Math.sin((2 * Math.PI * hz * i) / rate)), true);
  const key = put(new Blob([buf], { type: 'audio/wav' }));
  return { key, url: urls.get(key) };
}

// ── the stage ────────────────────────────────────────────────────────────────

export interface BoxSpec {
  x?: number; y?: number; w?: number; h?: number;
  bg?: string;
  rot?: number;
  opacity?: number;
  blend?: string;
  radius?: string;
  text?: string;
  /** A clip key from makeClip: the box hosts a <video> pointing at it. */
  clip?: string | null;
  /** An audio-only box: the marker div the tool emits. */
  audioSrc?: string | null;
  start?: number | null;
  dur?: number | null;
  clipIn?: number;
  speed?: number;
  mute?: boolean;
  enter?: string | null;
  enterMs?: number;
  exit?: string | null;
  exitMs?: number;
  lane?: 'seq' | '';
}

export interface StageSpec {
  w?: number; h?: number; seqMs?: number; bg?: string;
  boxes: BoxSpec[];
  /** Omit the [data-sequence] marker entirely (the "not a sequence" case). */
  untimed?: boolean;
}

function buildStage(spec: StageSpec): HTMLElement {
  document.body.querySelectorAll('.seq-test-target').forEach((n) => n.remove());
  if (!document.getElementById('seq-test-css')) {
    const st = document.createElement('style');
    st.id = 'seq-test-css';
    // The panel's own stylesheet owns what seq-off means; the export tier only needs
    // the one rule so an off-playhead box is genuinely absent from a still capture.
    st.textContent = `.seq-off{display:none!important}.lolly-box{position:absolute;box-sizing:border-box;overflow:hidden}
      .artboard{position:relative;overflow:hidden}
      body{margin:0}`;
    document.head.append(st);
  }
  const target = document.createElement('div');
  target.className = 'seq-test-target';
  const art = document.createElement('div');
  art.className = 'artboard';
  art.style.width = `${spec.w ?? 640}px`;
  art.style.height = `${spec.h ?? 360}px`;
  art.style.background = spec.bg ?? '#0b1220';
  if (!spec.untimed) {
    art.setAttribute('data-sequence', '');
    art.setAttribute('data-seq-ms', String(spec.seqMs ?? 2000));
  }
  for (const b of spec.boxes) {
    const el = document.createElement('div');
    el.className = 'lolly-box';
    el.style.left = `${b.x ?? 0}px`;
    el.style.top = `${b.y ?? 0}px`;
    el.style.width = `${b.w ?? spec.w ?? 640}px`;
    el.style.height = `${b.h ?? spec.h ?? 360}px`;
    el.style.background = b.bg ?? 'transparent';
    if (b.rot) el.style.transform = `rotate(${b.rot}deg)`;
    if (b.opacity != null) el.style.opacity = String(b.opacity);
    if (b.blend) el.style.mixBlendMode = b.blend;
    if (b.radius) el.style.borderRadius = b.radius;
    if (b.text) {
      el.style.color = '#ffffff';
      el.style.font = 'bold 40px monospace';
      el.textContent = b.text;
    }
    if (b.clip) {
      const v = document.createElement('video');
      v.className = 'lolly-box-video';
      v.src = urls.get(b.clip) as string;
      v.muted = true;
      v.playsInline = true;
      v.style.width = '100%';
      v.style.height = '100%';
      v.style.objectFit = 'fill';
      el.append(v);
    }
    if (b.audioSrc) {
      const m = document.createElement('div');
      m.className = 'lolly-box-audio';
      m.setAttribute('data-audio-src', urls.get(b.audioSrc) as string);
      el.append(m);
    }
    if (b.start != null) el.setAttribute('data-t-start', String(b.start));
    if (b.dur != null) el.setAttribute('data-t-dur', String(b.dur));
    if (b.clipIn) el.setAttribute('data-clip-in', String(b.clipIn));
    if (b.speed && b.speed !== 1) el.setAttribute('data-t-speed', String(b.speed));
    if (b.mute) el.setAttribute('data-t-mute', '1');
    if (b.enter) { el.setAttribute('data-t-enter', b.enter); el.setAttribute('data-t-enter-ms', String(b.enterMs ?? 400)); }
    if (b.exit) { el.setAttribute('data-t-exit', b.exit); el.setAttribute('data-t-exit-ms', String(b.exitMs ?? 400)); }
    if (b.lane) el.setAttribute('data-t-lane', b.lane);
    art.append(el);
  }
  target.append(art);
  document.body.append(target);
  return target;
}

// ── instrumentation (memory + resource policy, observed from outside) ────────

interface Counters {
  videoFramesLive: number;
  videoFramesPeak: number;
  videoFramesMade: number;
  imageBitmapsMade: number;
  /** Live VideoDecoders — one per open provider, so this IS the live-provider count. */
  decodersLive: number;
  decodersPeak: number;
}

const zeroCounters = (): Counters => ({
  videoFramesLive: 0, videoFramesPeak: 0, videoFramesMade: 0, imageBitmapsMade: 0,
  decodersLive: 0, decodersPeak: 0,
});

let counters: Counters = zeroCounters();
let instrumented = false;

/**
 * Wrap `VideoFrame` and `createImageBitmap` so the streaming path's two memory
 * claims are measurable from the test rather than asserted in a comment:
 *   • at most HIGH_WATER + 1 VideoFrames alive at once (video-encode-core), and
 *   • ZERO ImageBitmaps created — an accumulating frame array is the old buffered
 *     path, and `createImageBitmap` is the only way onto it.
 * createStreamingMux resolves `VideoFrame` off globalThis when the session opens, so
 * the patch has to be in place before the export starts (it is installed once, and
 * `resetCounters` is what a test calls per case).
 */
function instrument(): void {
  if (instrumented) return;
  instrumented = true;
  const g = globalThis as Any;
  const RealVF = g.VideoFrame;
  if (RealVF) {
    // A Proxy with a `construct` trap, NOT a subclass: mediabunny's VideoSample
    // constructor branches on `data instanceof VideoFrame`, and a subclass on the
    // global makes every decoder-produced frame fail that test (it is an instance of
    // the REAL class, not of ours) — which shows up as a bogus "Invalid data type"
    // decode failure. A proxy leaves the identity of both class and instances alone.
    const tagged = new WeakSet<object>();
    const realClose = RealVF.prototype.close;
    RealVF.prototype.close = function close(this: object, ...args: Any[]): Any {
      if (tagged.has(this)) { tagged.delete(this); counters.videoFramesLive--; }
      return realClose.apply(this, args);
    };
    g.VideoFrame = new Proxy(RealVF, {
      construct(target: Any, args: Any[], newTarget: Any) {
        const frame = Reflect.construct(target, args, newTarget) as object;
        tagged.add(frame);
        counters.videoFramesMade++;
        counters.videoFramesLive++;
        counters.videoFramesPeak = Math.max(counters.videoFramesPeak, counters.videoFramesLive);
        return frame;
      },
    });
  }
  const RealVD = g.VideoDecoder;
  if (RealVD) {
    // mediabunny opens exactly one VideoDecoder per sink, i.e. one per live provider,
    // so counting decoders is how MAX_LIVE_PROVIDERS is observed from outside. Same
    // proxy-not-subclass reasoning as VideoFrame.
    const realClose = RealVD.prototype.close;
    const seen = new WeakSet<object>();
    RealVD.prototype.close = function close(this: object, ...args: Any[]): Any {
      if (seen.has(this)) { seen.delete(this); counters.decodersLive--; }
      return realClose.apply(this, args);
    };
    g.VideoDecoder = new Proxy(RealVD, {
      construct(target: Any, args: Any[], newTarget: Any) {
        const dec = Reflect.construct(target, args, newTarget) as object;
        seen.add(dec);
        counters.decodersLive++;
        counters.decodersPeak = Math.max(counters.decodersPeak, counters.decodersLive);
        return dec;
      },
    });
  }
  const realCIB = g.createImageBitmap.bind(g);
  g.createImageBitmap = (...args: Any[]): Any => { counters.imageBitmapsMade++; return realCIB(...args); };
}

function resetCounters(): void {
  counters = zeroCounters();
}

// ── running an export ────────────────────────────────────────────────────────

export interface ExportRun {
  key: string | null;
  type: string;
  size: number;
  ms: number;
  logs: string[];
  error: { code: string; message: string } | null;
  /** Raw stack of the failure, so a broken run is debuggable from the Node side. */
  stack?: string;
  counters: Counters;
  /** rAF heartbeat during the render (opts.heartbeat): frames painted, and the
   *  longest gap between them — the main-thread responsiveness number. */
  beat: { beats: number; maxGap: number };
  frames: number;
  fps: number;
}

/**
 * Run one export against a freshly built stage.
 *
 * Two options are the HARNESS's, not the renderer's, and are stripped before the
 * opts reach `renderSequence`. Both reproduce state the LIVE artboard is genuinely
 * in when a user hits export, and which a stage built from scratch never has:
 *
 *   applyClockAtMs  run the real phase-2 clock over the boxes first, exactly as
 *                   scrubbing does — which leaves `.seq-off` (display:none) on every
 *                   box outside the playhead window.
 *   deviceMemory    fake navigator.deviceMemory, which is what maxVideoFrames() —
                   the buffered-path frame cap — is derived from.
 *   freezeVideos    insert the frozen <img data-motion-still> sibling that
 *                   export.ts's snapshotMotion leaves behind, which is what a ZIP
 *                   bundle's mp4 sub-render actually sees (the guard there keys on
 *                   the outer 'zip' format, so the freeze has already happened).
 */
async function exportSeq(spec: StageSpec, format: 'mp4' | 'webm' | 'gif' | 'apng', opts: Any = {}): Promise<ExportRun> {
  instrument();
  resetCounters();
  const target = buildStage(spec);
  const { applyClockAtMs, freezeVideos, deviceMemory, worker, breakWorker, heartbeat, ...renderOpts } = opts as Any;
  const undo: (() => void)[] = [];
  if (worker != null) {
    // Phase 4 Track B: the composite+encode Worker offload is opt-in behind the
    // `lolly.workerEncode` flag, so the SAME sequence can be exported down both
    // paths in one page and the two outputs compared.
    const prev = localStorage.getItem('lolly.workerEncode');
    if (worker) localStorage.setItem('lolly.workerEncode', '1');
    else localStorage.removeItem('lolly.workerEncode');
    undo.push(() => {
      if (prev == null) localStorage.removeItem('lolly.workerEncode');
      else localStorage.setItem('lolly.workerEncode', prev);
    });
  }
  if (breakWorker) {
    // The offload-unavailable fallback, forced: a factory that cannot produce a
    // worker at all. The client must report a PLAIN (non-coded) failure and the
    // render must complete in-thread.
    _setSequenceWorkerFactory(() => { throw new Error('no worker here'); });
    undo.push(() => _setSequenceWorkerFactory(null));
  }
  if (deviceMemory != null) {
    // maxVideoFrames() reads navigator.deviceMemory, and the frame cap is what a
    // buffered (gif/apng/MediaRecorder) export is clamped to. Faking a small device
    // makes the cap reachable in a test without rendering 600 real frames.
    const had = Object.prototype.hasOwnProperty.call(navigator, 'deviceMemory');
    const prev = (navigator as Any).deviceMemory;
    Object.defineProperty(navigator, 'deviceMemory', { value: deviceMemory, configurable: true });
    undo.push(() => {
      if (had) Object.defineProperty(navigator, 'deviceMemory', { value: prev, configurable: true });
      else delete (navigator as Any).deviceMemory;
    });
  }
  if (applyClockAtMs != null) {
    const boxes = [...target.querySelectorAll<HTMLElement>('.lolly-box')];
    const store = createAuthoredStore();
    applyTimeToElements(boxes, Number(applyClockAtMs), { seqMs: Number(spec.seqMs ?? 2000), store });
    undo.push(() => { for (const b of boxes) b.classList.remove(OFF_CLASS); store.restoreAll(); });
  }
  if (freezeVideos) {
    // A flat magenta plate: if it ever survives into a composited frame it swamps
    // the frame code, so "the code is still readable" IS the assertion.
    const cvs = document.createElement('canvas');
    cvs.width = 16; cvs.height = 16;
    const c = cvs.getContext('2d') as Any;
    c.fillStyle = '#ff00ff';
    c.fillRect(0, 0, 16, 16);
    const src = cvs.toDataURL('image/png');
    for (const v of [...target.querySelectorAll('video')]) {
      const still = document.createElement('img');
      still.src = src;
      still.setAttribute('data-motion-still', '1');
      still.className = v.className;
      still.setAttribute('style', v.getAttribute('style') ?? '');
      still.style.objectFit = 'fill';
      v.parentNode?.insertBefore(still, v);
      const prev = v.style.display;
      v.style.display = 'none';
      undo.push(() => { still.remove(); v.style.display = prev; });
    }
  }
  const logs: string[] = [];
  const host = { log: (l: string, m: string): void => { logs.push(`${l}: ${m}`); } };
  const stage = parseSequenceStage(target);
  const fps = format === 'gif' ? 15 : Math.max(1, Math.round(opts.fps ?? 30));
  // MAIN-THREAD RESPONSIVENESS. A rAF heartbeat during the render: `beatMaxGap`
  // is the longest the main thread went without painting, which is the number
  // the worker offload exists to move. Reported, never asserted — the absolute
  // value is machine- and headless-dependent.
  const beat = { beats: 0, maxGap: 0 };
  let last = performance.now();
  let raf = 0;
  if (heartbeat) {
    const tick = (): void => {
      const now = performance.now();
      beat.maxGap = Math.max(beat.maxGap, now - last);
      last = now;
      beat.beats++;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    undo.push(() => cancelAnimationFrame(raf));
  }
  const t0 = performance.now();
  try {
    const blob = await renderSequence(target, format, renderOpts, host);
    const ms = performance.now() - t0;
    const key = put(blob);
    for (const u of undo.reverse()) u();
    return {
      key, type: blob.type, size: blob.size, ms, logs, error: null,
      beat: { ...beat },
      counters: { ...counters },
      frames: stage ? frameTimestamps(stage.totalMs, fps).length : 0, fps,
    };
  } catch (err) {
    for (const u of undo.reverse()) u();
    return {
      key: null, type: '', size: 0, ms: performance.now() - t0, logs,
      error: toCodedError(err), stack: (err as Error)?.stack ?? '', beat: { ...beat }, counters: { ...counters },
      frames: stage ? frameTimestamps(stage.totalMs, fps).length : 0, fps,
    };
  }
}

// ── decoding an export back into numbers ─────────────────────────────────────

const MB_FORMATS = async (): Promise<Any> => {
  const mb: Any = await import('mediabunny');
  return { mb, formats: [mb.MP4, mb.QTFF, mb.WEBM, mb.MATROSKA] };
};

/**
 * Decode the exported container at the given output-frame indices and read the
 * painted code out of each.
 *
 * Sampled at `(n + 0.5) / fps` so the request lands unambiguously INSIDE output
 * frame n rather than on the boundary between n-1 and n.
 */
async function decodeCodes(key: string, frameIdx: number[], fps: number, rect?: Any): Promise<(number | null)[]> {
  const { mb, formats } = await MB_FORMATS();
  const blob = blobs.get(key) as Blob;
  const input = new mb.Input({ formats, source: new mb.BlobSource(blob) });
  const out: (number | null)[] = [];
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return frameIdx.map(() => null);
    const w = await track.getDisplayWidth();
    const h = await track.getDisplayHeight();
    const cvs = new OffscreenCanvas(w, h);
    const ctx = cvs.getContext('2d', { willReadFrequently: true }) as Any;
    const sink = new mb.VideoSampleSink(track);
    const times = frameIdx.map((n) => (n + 0.5) / fps);
    for (const t of times) {
      const s = await sink.getSample(t);
      if (!s) { out.push(null); continue; }
      ctx.clearRect(0, 0, w, h);
      s.draw(ctx, 0, 0, w, h);
      s.close();
      const px = ctx.getImageData(0, 0, w, h).data;
      out.push(readCode(px, w, rect ?? { x: 0, y: 0, w, h }));
    }
  } finally {
    input.dispose();
  }
  return out;
}

/** SHA-256 (hex) of a stored blob's whole byte stream. */
async function blobSha(key: string): Promise<string> {
  const bytes = await (blobs.get(key) as Blob).arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 (hex) of N spread output frames' raw pixels — the determinism probe. */
async function frameHashes(key: string, frameIdx: number[], fps: number): Promise<string[]> {
  const { mb, formats } = await MB_FORMATS();
  const blob = blobs.get(key) as Blob;
  const input = new mb.Input({ formats, source: new mb.BlobSource(blob) });
  const out: string[] = [];
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return [];
    const w = await track.getDisplayWidth();
    const h = await track.getDisplayHeight();
    const cvs = new OffscreenCanvas(w, h);
    const ctx = cvs.getContext('2d', { willReadFrequently: true }) as Any;
    const sink = new mb.VideoSampleSink(track);
    for (const n of frameIdx) {
      const s = await sink.getSample((n + 0.5) / fps);
      if (!s) { out.push('(none)'); continue; }
      ctx.clearRect(0, 0, w, h);
      s.draw(ctx, 0, 0, w, h);
      s.close();
      const px = ctx.getImageData(0, 0, w, h).data;
      const digest = await crypto.subtle.digest('SHA-256', px.buffer as ArrayBuffer);
      out.push([...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join(''));
    }
  } finally {
    input.dispose();
  }
  return out;
}

/** Mean |luma difference| between the same output frame of two exports, 0..255. */
async function frameDelta(keyA: string, keyB: string, frameIdx: number, fps: number): Promise<number> {
  const a = await framePixels(keyA, frameIdx, fps);
  const b = await framePixels(keyB, frameIdx, fps);
  if (!a || !b || a.w !== b.w || a.h !== b.h) return Number.NaN;
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const la = 0.299 * (a.data[i] as number) + 0.587 * (a.data[i + 1] as number) + 0.114 * (a.data[i + 2] as number);
    const lb = 0.299 * (b.data[i] as number) + 0.587 * (b.data[i + 1] as number) + 0.114 * (b.data[i + 2] as number);
    sum += Math.abs(la - lb);
  }
  return sum / (a.data.length / 4);
}

async function framePixels(key: string, frameIdx: number, fps: number): Promise<{ w: number; h: number; data: Uint8ClampedArray } | null> {
  const { mb, formats } = await MB_FORMATS();
  const blob = blobs.get(key) as Blob;
  const input = new mb.Input({ formats, source: new mb.BlobSource(blob) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const w = await track.getDisplayWidth();
    const h = await track.getDisplayHeight();
    const cvs = new OffscreenCanvas(w, h);
    const ctx = cvs.getContext('2d', { willReadFrequently: true }) as Any;
    const s = await sinkSample(mb, track, (frameIdx + 0.5) / fps);
    if (!s) return null;
    ctx.clearRect(0, 0, w, h);
    s.draw(ctx, 0, 0, w, h);
    s.close();
    return { w, h, data: ctx.getImageData(0, 0, w, h).data };
  } finally {
    input.dispose();
  }
}

async function sinkSample(mb: Any, track: Any, t: number): Promise<Any> {
  const sink = new mb.VideoSampleSink(track);
  return await sink.getSample(t);
}

/** RMS of the exported container's audio inside each [from, to) window, seconds. */
async function audioRms(key: string, windows: [number, number][]): Promise<number[]> {
  const blob = blobs.get(key) as Blob;
  const bytes = await blob.arrayBuffer();
  const actx = new (globalThis as Any).AudioContext({ sampleRate: 48_000 });
  try {
    const buf: AudioBuffer = await actx.decodeAudioData(bytes);
    const ch = buf.getChannelData(0);
    return windows.map(([from, to]) => {
      const a = Math.max(0, Math.round(from * buf.sampleRate));
      const b = Math.min(ch.length, Math.round(to * buf.sampleRate));
      if (b <= a) return 0;
      let sum = 0;
      for (let i = a; i < b; i++) sum += (ch[i] as number) * (ch[i] as number);
      return Math.sqrt(sum / (b - a));
    });
  } finally {
    await actx.close();
  }
}

async function hasAudioTrack(key: string): Promise<boolean> {
  const { mb, formats } = await MB_FORMATS();
  const input = new mb.Input({ formats, source: new mb.BlobSource(blobs.get(key) as Blob) });
  try {
    return Boolean(await input.getPrimaryAudioTrack());
  } finally {
    input.dispose();
  }
}

// ── provider-level resource discipline ───────────────────────────────────────

/**
 * Drive ONE provider exactly the way the compositor does — prime the whole output
 * grid, then ask for every source time in order — and report its own ledger.
 */
async function driveProvider(clipKey: string, fps: number, durMs: number): Promise<Any> {
  const url = urls.get(clipKey) as string;
  const provider = await createVideoProvider(url, {});
  const cvs = new OffscreenCanvas(provider.w, provider.h);
  const ctx = cvs.getContext('2d') as Any;
  const layer = { kind: 'video', startMs: 0, durMs, clipInMs: 0, speed: 1 } as Any;
  const span = activeSpanTimestamps(layer, fps, durMs, 0);
  provider.prime?.(span);
  let drawn = 0;
  for (const t of span) {
    if (await provider.drawAt(ctx, t, { dx: 0, dy: 0, dw: provider.w, dh: provider.h })) drawn++;
  }
  const stats = provider.stats();
  await provider.dispose();
  return { asked: span.length, drawn, stats, durationSec: provider.durationSec() };
}

/** A provider whose source never answers: the watchdog/timeout path, not a hang. */
async function stalledProvider(): Promise<Any> {
  const t0 = performance.now();
  try {
    // A URL the page will keep waiting on: served by the harness server as an
    // endless slow trickle, so `open` genuinely stalls rather than 404ing.
    await createVideoProvider('/stall', { timeoutMs: 1200 });
    return { ms: performance.now() - t0, error: null };
  } catch (err) {
    return { ms: performance.now() - t0, error: toCodedError(err) };
  }
}

// ── the still contract (Andy's rule) ─────────────────────────────────────────

/**
 * Photograph the live DOM at `tMs` through the REAL export funnel
 * (`createExportAPI(host).render(node, 'png')`) and report what landed.
 *
 * Two things are being proven at once: the off-playhead box is genuinely absent
 * (phase 2's seq-off, which the still capture merely photographs), and the video
 * box is NOT blank — a live <video> serialises empty, so a painted frame there is
 * evidence `snapshotMotion` still ran for a still format on a sequence stage.
 */
async function stillAt(spec: StageSpec, tMs: number, probes: { x: number; y: number }[], seekSec = 0): Promise<Any> {
  const target = buildStage(spec);
  const art = target.querySelector('.artboard') as HTMLElement;
  const boxes = [...art.querySelectorAll<HTMLElement>('.lolly-box')];

  // Park every <video> on the playhead's frame, the way the phase-2 clock's `media`
  // callback does, and wait for the seek to land — otherwise "the still shows the
  // playhead frame" would be trivially true at frame 0 for any implementation.
  await Promise.all(boxes.map((b) => {
    const v = b.querySelector('video');
    if (!v) return Promise.resolve();
    return new Promise<void>((res) => {
      const ready = (): void => {
        v.addEventListener('seeked', () => res(), { once: true });
        v.currentTime = seekSec;
      };
      if (v.readyState >= 2) ready();
      else v.addEventListener('loadeddata', ready, { once: true });
      v.load();
    });
  }));

  const store = createAuthoredStore();
  const seqMs = Number(art.getAttribute('data-seq-ms') ?? 0);
  applyTimeToElements(boxes, tMs, { seqMs, store });
  const offCount = boxes.filter((b) => b.classList.contains(OFF_CLASS)).length;

  const api = createExportAPI({ log: (): void => {} } as Any);
  const blob = await api.render(art, 'png', {});
  const bmp = await createImageBitmap(blob);
  const cvs = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = cvs.getContext('2d', { willReadFrequently: true }) as Any;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const px = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
  // Probes are authored in CSS px; the capture is at the device pixel ratio.
  const k = cvs.width / Math.max(1, art.offsetWidth);
  const at = probes.map(({ x, y }) => {
    const i = (Math.round(y * k) * cvs.width + Math.round(x * k)) * 4;
    return [px[i], px[i + 1], px[i + 2], px[i + 3]];
  });
  const code = readCode(px, cvs.width, { x: 0, y: 0, w: cvs.width, h: cvs.height });
  store.restoreAll();
  return { w: cvs.width, h: cvs.height, type: blob.type, size: blob.size, offCount, at, code };
}

// ── the contact sheet (phase 2.5, cuts=N) ────────────────────────────────────

/**
 * Export the stage as a CONTACT SHEET through the real funnel and report what came
 * back: the archive's member names plus a pixel probe per member (png/svg), or the
 * page count (pdf).
 *
 * Only a browser can answer the questions that matter here — the members are real
 * rasters and the pdf is real jsPDF output — so the headless suite
 * (shells/web/src/bridge/sequence-cuts.test.ts) stops at the loop and the naming,
 * and this is where "cut 3 shows the clip that is live at its midpoint" is decided.
 */
async function cutsAt(spec: StageSpec, cuts: number, format: string, probes: { x: number; y: number }[]): Promise<Any> {
  const target = buildStage(spec);
  const art = target.querySelector('.artboard') as HTMLElement;
  const boxes = [...art.querySelectorAll<HTMLElement>('.lolly-box')];
  const before = art.innerHTML;

  const api = createExportAPI({ log: (): void => {} } as Any);
  const progress: number[][] = [];
  const blob = await api.render(art, format, {
    filename: `sheet.${format}`, cuts,
    onProgress: (done: number, total: number) => { progress.push([done, total]); },
  } as Any);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Restored? Nothing may be left hidden, and the markup must be as it was found.
  const leftOff = boxes.filter((b) => b.classList.contains(OFF_CLASS)).length;
  const restored = leftOff === 0 && art.innerHTML === before;

  if (format === 'pdf') {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes);
    return { type: blob.type, size: blob.size, pages: doc.getPageCount(), restored, progress };
  }

  const { unzipSync } = await import('fflate');
  // A non-archive here means the dispatch never took the contact-sheet branch; say
  // so with the evidence rather than dying inside fflate.
  if (blob.type !== 'application/zip') {
    return { type: blob.type, size: blob.size, names: [], at: [], restored, progress, head: [...bytes.slice(0, 8)] };
  }
  const files = unzipSync(bytes);
  const names = Object.keys(files).sort();
  const at: Any[] = [];
  for (const name of names) {
    const member = new Blob([files[name] as Any], { type: format === 'svg' ? 'image/svg+xml' : `image/${format}` });
    const bmp = await createImageBitmap(member);
    const cvs = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = cvs.getContext('2d', { willReadFrequently: true }) as Any;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const px = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
    const k = cvs.width / Math.max(1, art.offsetWidth);
    at.push(probes.map(({ x, y }) => {
      const i = (Math.round(y * k) * cvs.width + Math.round(x * k)) * 4;
      return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    }));
  }
  return { type: blob.type, size: blob.size, names, at, restored, progress };
}

// ── compositor vs preview (the drift guard) ──────────────────────────────────

/**
 * Render a ONE-FRAME sequence through the compositor (APNG — lossless, and a
 * single-frame APNG is a plain PNG to any decoder) and, separately, photograph the
 * same live DOM with dom-to-image, then diff them.
 *
 * One frame is enough because the four properties under test (rotation, blend,
 * radius, opacity) are static box styles; transition-time parity is already pinned
 * headlessly in tests/sequence-plan.test.ts against the real sequence-clock.
 */
async function fidelity(spec: StageSpec): Promise<Any> {
  const run = await exportSeq(spec, 'apng', { fps: 30 });
  if (!run.key) return { error: run.error, logs: run.logs };
  const composed = await pngPixels(blobs.get(run.key) as Blob);

  const target = document.querySelector('.seq-test-target') as HTMLElement;
  const art = target.querySelector('.artboard') as HTMLElement;
  const lib: Any = (await import('dom-to-image-more')).default ?? (await import('dom-to-image-more'));
  const shot: HTMLCanvasElement = await lib.toCanvas(art, { width: composed.w, height: composed.h });
  const sctx = shot.getContext('2d', { willReadFrequently: true }) as Any;
  const preview = { w: shot.width, h: shot.height, data: sctx.getImageData(0, 0, shot.width, shot.height).data };

  if (preview.w !== composed.w || preview.h !== composed.h) {
    return { error: { code: 'SIZE', message: `${composed.w}x${composed.h} vs ${preview.w}x${preview.h}` } };
  }
  let sum = 0;
  let over = 0;
  const n = composed.data.length / 4;
  for (let i = 0; i < composed.data.length; i += 4) {
    // Compare over an opaque backdrop so a transparent pixel and a black pixel are
    // not reported as identical (both would read 0,0,0 otherwise).
    let d = 0;
    for (let c = 0; c < 3; c++) {
      const av = ((composed.data[i + c] as number) * (composed.data[i + 3] as number)) / 255;
      const bv = ((preview.data[i + c] as number) * (preview.data[i + 3] as number)) / 255;
      d = Math.max(d, Math.abs(av - bv));
    }
    sum += d;
    if (d > 24) over++;
  }
  return { w: composed.w, h: composed.h, mae: sum / n, overFrac: over / n, logs: run.logs };
}

async function pngPixels(blob: Blob): Promise<{ w: number; h: number; data: Uint8ClampedArray }> {
  const bmp = await createImageBitmap(blob);
  const cvs = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = cvs.getContext('2d', { willReadFrequently: true }) as Any;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return { w: cvs.width, h: cvs.height, data: ctx.getImageData(0, 0, cvs.width, cvs.height).data };
}

/**
 * Sample the FIRST frame of an exported still-image sequence (apng/gif) at CSS-px
 * probes. `createImageBitmap` on an APNG yields its default image, i.e. frame 0.
 */
async function firstFramePixels(key: string, probes: { x: number; y: number }[], stageW: number): Promise<number[][]> {
  const img = await pngPixels(blobs.get(key) as Blob);
  const k = img.w / Math.max(1, stageW);
  return probes.map(({ x, y }) => {
    const i = (Math.round(y * k) * img.w + Math.round(x * k)) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]] as number[];
  });
}

// ── capability probe (what this browser build can actually do) ───────────────

async function probe(): Promise<Any> {
  const g = globalThis as Any;
  const cfgV = async (codec: string): Promise<boolean> => {
    try { return Boolean((await g.VideoDecoder.isConfigSupported({ codec, codedWidth: 320, codedHeight: 240 }))?.supported); } catch { return false; }
  };
  const encV = async (codec: string): Promise<boolean> => {
    try { return Boolean((await g.VideoEncoder.isConfigSupported({ codec, width: 320, height: 240, bitrate: 1e6, framerate: 30 }))?.supported); } catch { return false; }
  };
  const encA = async (codec: string): Promise<boolean> => {
    try { return Boolean((await g.AudioEncoder.isConfigSupported({ codec, sampleRate: 48000, numberOfChannels: 1, bitrate: 96000 }))?.supported); } catch { return false; }
  };
  return {
    webcodecs: typeof g.VideoEncoder !== 'undefined',
    avcDecode: await cfgV('avc1.42001f'),
    avcEncode: await encV('avc1.42001f'),
    vp8: await encV('vp8'),
    vp9: await encV('vp09.00.10.08'),
    opus: await encA('opus'),
    aac: await encA('mp4a.40.2'),
    ua: navigator.userAgent,
    deviceMemory: (navigator as Any).deviceMemory ?? null,
  };
}

(globalThis as Any).SEQ = {
  probe, makeClip, truncate, makeBed, exportSeq, buildStage,
  decodeCodes, frameHashes, blobSha, frameDelta, audioRms, hasAudioTrack,
  driveProvider, stalledProvider, stillAt, cutsAt, fidelity, resetCounters, firstFramePixels,
  constants: { HIGH_WATER, MAX_LIVE_PROVIDERS, CODE_BITS },
};
(globalThis as Any).__SEQ_READY = true;
