// SPDX-License-Identifier: MPL-2.0
/**
 * Lazy filmstrips + waveforms + stills + node rasters for timeline clip bars
 * (phase 2, section 4 of plans/53-fable-timeline-phase-2.md).
 *
 * A timeline shows one bar per clip, and each bar wants a picture painted into a
 * <canvas>: a strip of frames (video), a peak envelope (audio), or ONE tile-able
 * still (`stillFrames` - an image box, a Lottie's mounted <svg>, or a tool clip's
 * compose render, which all reach the DOM as something an <img> can hold). Doing
 * the video case naively (one <video> per bar, seeks fired in parallel) melts a
 * browser: every element holds its own decoder, and Safari/iOS silently CANCEL a
 * seek that is issued while another is in flight, so the frames you get back are random.
 *
 * The contract this module enforces instead:
 *
 *   • ONE pooled probe <video>, module-level, reused across every capture run
 *     and every bar. Runs are serialised behind a single lock, so the probe is
 *     never re-`src`ed underneath a run in progress. It is removed from the DOM
 *     after an idle period (and by `releaseClipThumbs()`) so a parked editor
 *     holds no decoder.
 *   • ONE pooled decode context for peaks (OfflineAudioContext where available,
 *     plain AudioContext otherwise) - never one per call.
 *   • Seeks go through a queue that never has two in flight. Each landed frame
 *     is confirmed with requestVideoFrameCallback where it exists (its metadata
 *     `mediaTime` is the authoritative presented-frame time, unlike
 *     `video.currentTime` which is the *requested* time), with the `seeked`
 *     event as a parallel fallback and a hard per-seek timeout so a stalled
 *     decoder can never wedge the queue.
 *   • Every await point is abort-aware. Aborting settles the caller's promise
 *     promptly and, once the last caller of a shared run has aborted, tears the
 *     run down and frees anything it had produced.
 *   • ONE dom-to-image shot at a time for `nodeStill` - the photograph a bar with
 *     NO media of its own (a frame, a card, a pen shape) paints. That library keeps
 *     module-global state and clears it on every teardown, so overlapping shots
 *     corrupt each other; exports bracket themselves with `suspendNodeRasters()`
 *     for the same reason.
 *   • An LRU of ~48 decoded results, shared by every entry point. Evicted
 *     filmstrips have their ImageBitmaps `close()`d so GPU memory stays bounded.
 *
 * FAILURE POLICY: never throw into the caller. An undecodable/missing/CORS-blocked
 * asset, an aborted run, a headless (no-DOM) environment, or an oversized audio
 * file all resolve EMPTY (`[]` / a zero-length Float32Array) and the bar just
 * renders its plain fill. Callers therefore need no try/catch around an idle
 * callback.
 *
 * OWNERSHIP: returned ImageBitmaps and Float32Arrays are owned by the cache.
 * Callers must NOT `close()` or mutate them - the same instances are handed to
 * the next caller for the same key. `clearClipThumbCache()` / `releaseClipThumbs()`
 * are the only things that close them.
 *
 * AUDIO DECODE (WP-C): the primary peaks path (computePeaksSink) decodes the original
 * through mediabunny's AudioBufferSink one buffer at a time and accumulates the peak
 * envelope incrementally, so it holds no whole-file PCM and has no size ceiling. It
 * reads a video container's soundtrack as readily as a pure-audio file. Where WebCodecs
 * audio is unavailable (or the codec is not decodable) it falls back to the older
 * `decodeAudioData` path, and only that fallback keeps the ceiling below.
 *
 * AUDIO SIZE CEILING (the fallback only): `decodeAudioData` expands to raw f32 PCM,
 * about 97x for opus (a 30 MB opus file becomes about 2.9 GB of PCM), about 11x for mp3. There is no
 * streaming decode in that platform API, so the only defence is refusing to start.
 * Anything whose Content-Length exceeds `MAX_AUDIO_DECODE_BYTES` is refused before
 * the body is read. A response that declares no length is read through a bounded
 * reader that abandons it at the same ceiling: the fetch is never allowed to buffer
 * an unlabelled 500 MB asset just to refuse it afterwards. 6 MiB covers a
 * roughly 6-minute 128 kbps mp3, with a worst case around 0.5 GB of transient PCM.
 *
 * SCHEDULING: this module never schedules itself. Callers own *when* - the panel
 * is expected to call `onIdle()` (exported here) to defer capture until the main
 * thread is free, and to abort in-flight work the moment a drag/zoom starts.
 *
 * DECODE PATH (WP-C): the filmstrip decodes the original asset directly through
 * mediabunny's CanvasSink (captureFilmstripSink) - the monotonic frame grid, each
 * packet at most once, no `<video>` seeking and no scrub proxy. Where WebCodecs or the
 * codec is unavailable it falls back to the pooled-`<video>` element-seek path
 * (captureFilmstripElement). This is PREVIEW-ONLY: nothing here is on an export path.
 */

// ── tunables ────────────────────────────────────────────────────────────────

/**
 * Decoded results kept alive (filmstrips, stills, peak arrays and node rasters all
 * share ONE budget - a second cache would be a second thing to forget to free).
 *
 * Raised from 32 when node rasters landed, deliberately: a 20-frame sequence with a
 * couple of video clips now wants ~22 entries of its own, and at 32 the frames
 * evicted each other on every pass, so the same dom-to-image shot was retaken over
 * and over - the exact cost the cache exists to remove.
 */
export const CACHE_LIMIT = 48;
/** Compressed bytes above which `peaks()` refuses to decode. See the header. */
export const MAX_AUDIO_DECODE_BYTES = 6 * 1024 * 1024;
/** Frames per filmstrip is clamped to this - a bar is a few hundred px wide. */
export const MAX_FRAMES = 48;
/** Per-seek confirmation budget. Longer than a healthy seek, shorter than a stall. */
export const SEEK_TIMEOUT_MS = 700;
/** Budget for the probe to report metadata after a fresh `src`. */
export const METADATA_TIMEOUT_MS = 8000;
/** Probe <video> is detached this long after the last capture run. */
export const PROBE_IDLE_MS = 15000;
/** Tallest still bitmap ever produced. A clip bar is tens of px; 2× dpr covers it. */
export const MAX_STILL_H = 480;
/** Widest still bitmap. A panorama is tiled at its own aspect but never unbounded. */
export const MAX_STILL_W = 1024;
/** Budget for a still's <img> to load/decode before the bar gives up on it. */
export const STILL_TIMEOUT_MS = 4000;
/**
 * Serialised-SVG ceiling. A Lottie's live <svg> is rasterised by round-tripping its
 * markup through a data: URL, and a complex animation's DOM can be megabytes - past
 * this we decline rather than build the string, because the string itself is the cost.
 */
export const MAX_SVG_MARKUP = 512 * 1024;
/**
 * Subtree element ceiling for a NODE raster (see the node-raster section). Past this
 * the caller is told to decline: dom-to-image reads getComputedStyle three times per
 * element, so the cost is linear in the subtree and a pathological box would spend
 * the whole idle budget producing one bar's picture.
 */
export const MAX_NODE_RASTER_NODES = 400;
/** Budget for ONE dom-to-image shot. Longer than a card, shorter than a stall. */
export const NODE_RASTER_TIMEOUT_MS = 1500;
/** Tallest node-raster bitmap. A clip bar is tens of px; this is 2× dpr on a tall one. */
export const MAX_NODE_H = 120;

const EMPTY_PEAKS = new Float32Array(0);

// ── pure helpers (DOM-free - these are what the unit tests can reach) ────────

const clampInt = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));

export interface FilmstripOpts {
  /** How many frames to capture (clamped 1..MAX_FRAMES). */
  count: number;
  /** Target bitmap height in px (clamped 8..240); width follows the video aspect. */
  h: number;
  /** Clip in-point in seconds (source time, not timeline time). */
  clipInSec: number;
  /** Clip out-point in seconds; non-finite/<= in means "to the end of the media". */
  clipOutSec: number;
}

/**
 * Cache key for a filmstrip. `h` is part of the key on purpose (the spec's key
 * lists url|in|out|count): two bars of different heights want different bitmap
 * resolutions, and returning the shorter one would render blurry.
 */
export function filmstripKey(url: string, opts: FilmstripOpts): string {
  const count = clampInt(opts.count, 1, MAX_FRAMES);
  const h = clampInt(opts.h, 8, 240);
  const inS = Number.isFinite(opts.clipInSec) ? Math.max(0, opts.clipInSec) : 0;
  const outS = Number.isFinite(opts.clipOutSec) ? Math.max(0, opts.clipOutSec) : -1;
  return `f|${url}|${inS.toFixed(3)}|${outS.toFixed(3)}|${count}|${h}`;
}

/**
 * Cache key for a STILL picture (the one bitmap an image/lottie/tool bar tiles).
 *
 * `h` is the bar's DEVICE-pixel height, not its CSS height: the bar canvas is
 * scaled by devicePixelRatio, so a 2× display wants a 2× bitmap and must not be
 * handed the 1× one that a previous display drew. Width is deliberately absent - 
 * a still is captured at its own aspect ratio and TILED across the bar, so the
 * same bitmap serves a 40px bar and a 4000px one, and re-keying on width would
 * re-decode the same picture on every zoom step.
 */
export function stillKey(url: string, h: number): string {
  return `s|${url}|${clampInt(h, 8, MAX_STILL_H)}`;
}

/**
 * FNV-1a, 32 bit, hex. Not a checksum and not security - an appearance signature is a
 * few hundred characters of `key=value` pairs, hashed once per bar per pass, so what
 * is wanted is "cheap and well spread". `Math.imul` keeps the multiply exact in 32
 * bits (a plain `*` loses the low word to float rounding well before the loop ends).
 */
function hash32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * Cache key for a NODE raster (the photograph of a box that has no media of its own).
 *
 * `sig` is the box's APPEARANCE signature, which the CALLER derives from the model row
 * (see `appearanceSig` in views/timeline-panel.ts) - deliberately not derived from the
 * DOM here: hashing `outerHTML` would cost an O(subtree) serialise per bar per pass,
 * which is precisely the work this cache exists to avoid, and it would also change on
 * every drag (the bar's inline left/width live on a different element, but the box's
 * own transform does not).
 *
 * `h` is the bar's DEVICE-pixel height, following stillKey's convention and for the
 * same reason: the bitmap is TILED across the bar, so width must stay out of the key
 * or every zoom step would retake the same photograph.
 */
export function nodeKey(sig: string, h: number): string {
  return `n|${hash32(String(sig ?? ''))}|${clampInt(h, 8, MAX_NODE_H)}`;
}

/** Cache key for a peak envelope. */
/** One decode per URL. The bucket count and the trim window are applied to the
 *  cached master envelope afterwards, so neither belongs in the key. */
export function peaksKey(url: string): string {
  return `p|${url}`;
}

/** How finely a track is sampled ONCE. A waveform bar is a few hundred pixels, so
 *  4096 buckets (~24 ms on a 97 s loop) is well past what any bar can show - which
 *  is what lets an arbitrary trim window be re-derived from it for free. */
export const MASTER_BUCKETS = 4096;

/**
 * Re-window a master envelope: take `[fromSec, toSec)` of the track and resample it
 * into `buckets`.
 *
 * This is the fix for a real bug: the waveform used to be computed over the WHOLE
 * file and then stretched across the bar, so trimming a clip squeezed the same
 * picture instead of showing the part that actually plays - and two halves of a
 * split clip drew identical waveforms.
 *
 * Pure and total: a nonsensical window, a zero-length track or an empty master all
 * return a correctly-sized array of silence rather than throwing.
 */
export function windowPeaks(
  master: Float32Array, durationSec: number, fromSec: number, toSec: number, buckets: number,
): Float32Array {
  const n = clampInt(buckets, 1, 4096);
  const out = new Float32Array(n);
  if (!master.length || !(durationSec > 0)) return out;
  const lo = Math.max(0, Math.min(fromSec, durationSec));
  const hi = Math.max(lo, Math.min(toSec, durationSec));
  if (!(hi > lo)) return out;
  const per = master.length / durationSec;          // master buckets per second
  const a = lo * per;
  const b = hi * per;
  const step = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const s = a + i * step;
    const e = i === n - 1 ? b : s + step;
    let peak = 0;
    // Always read at least the bucket the slice starts in, so a window narrower
    // than one master bucket still shows that bucket's level instead of silence.
    for (let j = Math.floor(s); j <= Math.min(master.length - 1, Math.max(Math.floor(s), Math.ceil(e) - 1)); j++) {
      const v = master[j] ?? 0;
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}

/**
 * Sample times (seconds, source time) for a filmstrip.
 *
 * Frames are taken at the MIDPOINT of each of `count` equal slices, not at the
 * slice edges: sampling exactly at the in-point very often yields the black or
 * blank leader frame, and sampling exactly at the out-point can land past the
 * last decodable frame. Times are clamped inside the media when its duration
 * is known.
 */
export function frameTimes(
  clipInSec: number,
  clipOutSec: number,
  count: number,
  durationSec: number = Number.POSITIVE_INFINITY,
): number[] {
  const n = clampInt(count, 1, MAX_FRAMES);
  const dur = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : Number.POSITIVE_INFINITY;
  const last = Number.isFinite(dur) ? Math.max(0, dur - 1 / 60) : Number.POSITIVE_INFINITY;

  let inS = Number.isFinite(clipInSec) ? Math.max(0, clipInSec) : 0;
  if (Number.isFinite(last)) inS = Math.min(inS, last);
  let outS = Number.isFinite(clipOutSec) && clipOutSec > inS ? clipOutSec : dur;
  if (!Number.isFinite(outS)) outS = inS; // unknown duration and no out-point: degenerate to a single point
  if (Number.isFinite(last)) outS = Math.min(outS, dur);

  const span = Math.max(0, outS - inS);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let t = inS + ((i + 0.5) * span) / n;
    if (Number.isFinite(last)) t = Math.min(t, last);
    out.push(Math.max(0, t));
  }
  return out;
}

/**
 * Peak envelope for decoded PCM - the audiogram tool's computation, deliberately
 * unchanged (community/audiogram/template.html): bucket the samples, take the
 * max |sample| of a stride-32 sparse scan per bucket, normalise so the loudest
 * bucket is 1.0 with a 0.04 visual floor so quiet passages still draw a sliver.
 *
 * Channels are mixed to mono as (L+R)/2 using at most the first two channels.
 * Digital silence returns all zeros (the caller draws its plain fill rather than
 * a synthetic placeholder - that is the one deliberate difference from the tool,
 * which fabricates `synthPeaks` because it must always show something).
 */
export function bucketPeaks(channels: Float32Array[], buckets: number): Float32Array {
  const n = clampInt(buckets, 1, 4096);
  const ch0 = channels[0];
  if (!ch0 || ch0.length === 0) return new Float32Array(n);
  const ch1 = channels.length > 1 ? channels[1] : null;

  const out = new Float32Array(n);
  const per = Math.max(1, Math.floor(ch0.length / n));
  let max = 0;
  for (let i = 0; i < n; i++) {
    let peak = 0;
    const start = i * per;
    const end = Math.min(ch0.length, start + per);
    for (let j = start; j < end; j += 32) {
      const l = ch0[j] ?? 0;
      const r = ch1 ? (ch1[j] ?? 0) : null;
      const v = Math.abs(r === null ? l : (l + r) / 2);
      if (v > peak) peak = v;
    }
    out[i] = peak;
    if (peak > max) max = peak;
  }
  if (max > 0) for (let k = 0; k < n; k++) out[k] = Math.max(0.04, (out[k] ?? 0) / max);
  else out.fill(0);
  return out;
}

/** True when a byte length is small enough to risk `decodeAudioData` on. */
export function withinDecodeBudget(bytes: number | null | undefined): boolean {
  if (bytes == null || !Number.isFinite(bytes)) return true; // unknown: the post-fetch check catches it
  return bytes >= 0 && bytes <= MAX_AUDIO_DECODE_BYTES;
}

// ── LRU ─────────────────────────────────────────────────────────────────────

export interface Lru<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  has(key: string): boolean;
  clear(): void;
  size(): number;
  keys(): string[];
}

/**
 * Insertion-ordered LRU over a Map. `dispose` runs for every value that leaves
 * the cache (eviction, overwrite, or `clear()`) - that is where ImageBitmaps get
 * closed, so GPU memory is bounded by CACHE_LIMIT rather than by session length.
 */
export function createLru<T>(limit: number, dispose?: (value: T) => void): Lru<T> {
  const cap = Math.max(1, Math.floor(limit));
  const map = new Map<string, T>();
  const drop = (value: T): void => {
    try { dispose?.(value); } catch { /* a disposer must never break the cache */ }
  };
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const value = map.get(key) as T;
      map.delete(key);
      map.set(key, value); // refresh recency
      return value;
    },
    set(key, value) {
      const prev = map.get(key);
      if (map.has(key)) {
        map.delete(key);
        if (prev !== value && prev !== undefined) drop(prev);
      }
      map.set(key, value);
      while (map.size > cap) {
        const oldest = map.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        const victim = map.get(oldest) as T;
        map.delete(oldest);
        drop(victim);
      }
    },
    has: (key) => map.has(key),
    clear() {
      for (const value of map.values()) drop(value);
      map.clear();
    },
    size: () => map.size,
    keys: () => [...map.keys()],
  };
}

/** A decoded track's full-length peak envelope plus the duration it spans, so any
 *  trim window can be re-derived without decoding the file again. */
export interface MasterPeaks { peaks: Float32Array; durationSec: number }

type CacheEntry = ImageBitmap[] | Float32Array | MasterPeaks;

const closeBitmaps = (value: CacheEntry): void => {
  if (!Array.isArray(value)) return;
  for (const bmp of value) {
    try { (bmp as { close?: () => void }).close?.(); } catch { /* already gone */ }
  }
};

const cache: Lru<CacheEntry> = createLru<CacheEntry>(CACHE_LIMIT, closeBitmaps);

/** Drop every cached result, closing any ImageBitmaps (and every remembered failure). */
export function clearClipThumbCache(): void {
  cache.clear();
  nodeFailed.clear();
}

// ── shared-run dedup (ref-counted, abort-aware) ─────────────────────────────

interface Job<T> {
  promise: Promise<T>;
  refs: number;
  ctrl: AbortController;
}

const inflight = new Map<string, Job<unknown>>();

/**
 * Run at most one capture per key even when several bars ask at once, while
 * still honouring each caller's own signal: a caller that aborts detaches and
 * settles empty immediately, and only when the LAST caller has detached is the
 * underlying run aborted (so one bar scrolling out of view can't cancel the
 * capture another bar is still waiting on).
 */
function share<T>(key: string, run: (signal: AbortSignal) => Promise<T>, signal: AbortSignal | undefined, empty: T): Promise<T> {
  let job = inflight.get(key) as Job<T> | undefined;
  // A job whose last subscriber just left is already aborted but may not have
  // reached its `finally` yet. Never join a dead job; start a fresh run instead.
  if (job?.ctrl.signal.aborted) job = undefined;
  if (!job) {
    const ctrl = new AbortController();
    const created: Job<T> = { refs: 0, ctrl, promise: Promise.resolve(empty) };
    // Deferred by a MICROTASK, deliberately. Every capture's first act is a
    // `signal.aborted` bail, and that check is worthless if the run body has already
    // executed synchronously inside this call. Subscribing below is what can abort it:
    // a caller whose signal is already aborted (the prescribed abort-on-drag/zoom
    // pattern) detaches before the run starts, so the probe <video>, the <img>, and the
    // media request they would have fired never happen at all.
    created.promise = Promise.resolve().then(() => run(ctrl.signal)).finally(() => {
      if ((inflight.get(key) as Job<T> | undefined) === created) inflight.delete(key);
    });
    inflight.set(key, created as Job<unknown>);
    job = created;
  }
  const owner = job;
  owner.refs++;
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    owner.refs--;
    if (owner.refs <= 0) owner.ctrl.abort();
  };

  return new Promise<T>((resolve) => {
    let settled = false;
    const finish = (value: T): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    function onAbort(): void {
      release();
      finish(empty);
    }
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    owner.promise.then(
      (value) => { release(); finish(value); },
      () => { release(); finish(empty); },
    );
  });
}

// ── seek queue ──────────────────────────────────────────────────────────────

/** The slice of HTMLVideoElement the queue needs - duck-typed so it is testable. */
export interface SeekableEl {
  currentTime: number;
}

export interface SeekQueue {
  /**
   * Queue a seek. Resolves with the landed presentation time, or null if the
   * seek failed, timed out, was aborted, or was superseded.
   * `supersede: true` is latest-wins scrub behaviour - any earlier *queued*
   * supersede request is dropped (resolving null). A seek already in flight is
   * never interrupted; that is the whole point.
   */
  seek(t: number, opts?: { supersede?: boolean; signal?: AbortSignal }): Promise<number | null>;
  /** True while a seek is awaiting confirmation. Never true for two at once. */
  inFlight(): boolean;
  /** Queued-but-not-started count. */
  pending(): number;
  /** Drop everything queued (resolving null); an in-flight seek still settles. */
  clear(): void;
}

/**
 * Strictly serialised seek pump. `waitFrame` is injected so the real
 * rVFC/`seeked` confirmation can be swapped for a fake in tests.
 */
export function createSeekQueue(
  el: SeekableEl,
  waitFrame: (el: SeekableEl, signal?: AbortSignal) => Promise<number | null>,
): SeekQueue {
  interface Entry { t: number; supersede: boolean; signal?: AbortSignal; resolve(v: number | null): void }
  const queue: Entry[] = [];
  let running = false;
  let busy = false;

  async function pump(): Promise<void> {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        const job = queue.shift() as Entry;
        if (job.signal?.aborted) { job.resolve(null); continue; }
        busy = true;
        let landed: number | null = null;
        try {
          el.currentTime = job.t;
          landed = await waitFrame(el, job.signal);
        } catch {
          landed = null;
        }
        busy = false;
        job.resolve(landed);
      }
    } finally {
      running = false;
    }
  }

  return {
    seek(t, opts) {
      return new Promise<number | null>((resolve) => {
        if (opts?.supersede) {
          for (let i = queue.length - 1; i >= 0; i--) {
            const entry = queue[i];
            if (entry?.supersede) {
              queue.splice(i, 1);
              entry.resolve(null);
            }
          }
        }
        queue.push({ t, supersede: !!opts?.supersede, signal: opts?.signal, resolve });
        void pump();
      });
    },
    inFlight: () => busy,
    pending: () => queue.length,
    clear() {
      while (queue.length) (queue.shift() as Entry).resolve(null);
    },
  };
}

// ── idle scheduling (callers own *when*) ────────────────────────────────────

type IdleWindow = typeof globalThis & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Run `fn` when the main thread is free, or after `timeout` ms at the latest.
 * Returns a canceller. Falls back to setTimeout where requestIdleCallback is
 * missing (Safari < 17, and any headless test run).
 */
export function onIdle(fn: () => void, timeout = 200): () => void {
  const g = globalThis as IdleWindow;
  if (typeof g.requestIdleCallback === 'function') {
    const handle = g.requestIdleCallback(fn, { timeout });
    return () => { try { g.cancelIdleCallback?.(handle); } catch { /* already ran */ } };
  }
  const handle = setTimeout(fn, Math.min(timeout, 50));
  return () => clearTimeout(handle);
}

// ── the pooled probe <video> ────────────────────────────────────────────────

type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime?: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

let probe: HTMLVideoElement | null = null;
let probeUrl = '';
let probeQueue: SeekQueue | null = null;
let probeIdleTimer: ReturnType<typeof setTimeout> | null = null;
let scratch: HTMLCanvasElement | null = null;

const hasDom = (): boolean => typeof document !== 'undefined' && !!document.createElement;

function getProbe(): HTMLVideoElement {
  if (probe) return probe;
  const v = document.createElement('video');
  v.preload = 'auto';
  v.muted = true;
  v.defaultMuted = true;
  v.autoplay = false;
  v.setAttribute('playsinline', '');
  v.setAttribute('aria-hidden', 'true');
  // Off-screen but attached: a detached <video> is allowed to skip decoding
  // entirely in some engines, which makes seeks never present a frame.
  v.style.cssText = 'position:absolute;left:-99999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(v);
  probe = v;
  probeQueue = createSeekQueue(v, (el, signal) => waitSeekLanded(el as HTMLVideoElement, signal));
  return v;
}

function touchProbeIdle(): void {
  if (probeIdleTimer) clearTimeout(probeIdleTimer);
  probeIdleTimer = setTimeout(() => { probeIdleTimer = null; teardownProbe(); }, PROBE_IDLE_MS);
}

function teardownProbe(): void {
  if (probeIdleTimer) { clearTimeout(probeIdleTimer); probeIdleTimer = null; }
  probeQueue?.clear();
  probeQueue = null;
  if (probe) {
    try {
      probe.pause?.();
      probe.removeAttribute('src');
      probe.load?.();
      probe.remove();
    } catch { /* already detached */ }
  }
  probe = null;
  probeUrl = '';
  scratch = null;
}

/**
 * Release every pooled resource: the probe <video>, the scratch canvas, the
 * decode AudioContext, and the whole result cache. Call from a view's destroy().
 */
export function releaseClipThumbs(): void {
  teardownProbe();
  clearClipThumbCache();
  if (audioCtx) {
    try { (audioCtx as { close?: () => Promise<void> }).close?.(); } catch { /* offline ctxs have no close */ }
    audioCtx = null;
  }
}

/**
 * Await confirmation that a seek actually presented a frame.
 * rVFC is authoritative (`meta.mediaTime` is the time of the frame on screen - 
 * `video.currentTime` only reflects what we *asked* for), but not every engine
 * fires it for a paused seek, so `seeked` races alongside it and a timeout
 * guarantees the queue drains.
 */
function waitSeekLanded(v: HTMLVideoElement, signal?: AbortSignal, timeoutMs = SEEK_TIMEOUT_MS): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    let handle = 0;
    const rv = v as RvfcVideo;
    const cleanup = (): void => {
      clearTimeout(timer);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('error', onFail);
      signal?.removeEventListener('abort', onFail);
      if (handle) { try { rv.cancelVideoFrameCallback?.(handle); } catch { /* gone */ } }
    };
    const finish = (value: number | null): void => {
      if (done) return;
      done = true;
      cleanup();
      resolve(value);
    };
    const onSeeked = (): void => finish(v.currentTime);
    const onFail = (): void => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);

    if (typeof rv.requestVideoFrameCallback === 'function') {
      try {
        handle = rv.requestVideoFrameCallback((_now, meta) => {
          finish(typeof meta?.mediaTime === 'number' ? meta.mediaTime : v.currentTime);
        });
      } catch { handle = 0; }
    }
    v.addEventListener('seeked', onSeeked, { once: true });
    v.addEventListener('error', onFail, { once: true });
    if (signal?.aborted) { finish(null); return; }
    signal?.addEventListener('abort', onFail, { once: true });
  });
}

function waitMetadata(v: HTMLVideoElement, signal?: AbortSignal): Promise<boolean> {
  if (v.readyState >= 1 /* HAVE_METADATA */) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const cleanup = (): void => {
      clearTimeout(timer);
      v.removeEventListener('loadedmetadata', onOk);
      v.removeEventListener('error', onFail);
      signal?.removeEventListener('abort', onFail);
    };
    const finish = (ok: boolean): void => { if (done) return; done = true; cleanup(); resolve(ok); };
    const onOk = (): void => finish(true);
    const onFail = (): void => finish(false);
    const timer = setTimeout(() => finish(false), METADATA_TIMEOUT_MS);
    v.addEventListener('loadedmetadata', onOk, { once: true });
    v.addEventListener('error', onFail, { once: true });
    if (signal?.aborted) { finish(false); return; }
    signal?.addEventListener('abort', onFail, { once: true });
  });
}

// One capture run at a time: the probe is a single element, so overlapping runs
// would re-`src` it out from under each other.
let videoLock: Promise<unknown> = Promise.resolve();
function withProbe<T>(fn: () => Promise<T>): Promise<T> {
  const next = videoLock.then(fn, fn);
  videoLock = next.then(() => undefined, () => undefined);
  return next;
}

const isCrossOrigin = (url: string): boolean => {
  if (typeof location === 'undefined') return false;
  if (!/^https?:/i.test(url)) return false;
  try { return new URL(url, location.href).origin !== location.origin; } catch { return false; }
};

/** Explicit container singletons for the filmstrip decode - never ALL_FORMATS (the
 *  mediabunny source guard), mirroring bridge/sequence-providers' VIDEO_CONTAINERS. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filmstripContainers(m: any): unknown[] {
  return [m.MP4, m.QTFF, m.WEBM, m.MATROSKA];
}

/**
 * Filmstrip via mediabunny's CanvasSink: decode the monotonic frame grid directly (each
 * packet at most once), no hidden-`<video>` seeking and no scrub proxy - the sink pattern
 * bridge/sequence-providers already ships for export. Returns null when WebCodecs or the
 * codec is unavailable here, so captureFilmstrip falls back to the element-seek path;
 * returns [] (not null) on abort so the caller does not then retry the fallback.
 *
 * mediabunny is loaded lazily and typed loosely here (the decode surface has no ambient
 * types in this module; the strongly-typed provider lives in bridge/sequence-providers).
 */
async function captureFilmstripSink(url: string, opts: FilmstripOpts, signal: AbortSignal): Promise<ImageBitmap[] | null> {
  if (!hasDom() || typeof createImageBitmap !== 'function') return null;
  if (typeof (globalThis as { VideoDecoder?: unknown }).VideoDecoder === 'undefined') return null;   // no WebCodecs
  if (signal.aborted) return [];
  const count = clampInt(opts.count, 1, MAX_FRAMES);
  const targetH = clampInt(opts.h, 8, 240);
  const made: ImageBitmap[] = [];
  const bail = (): ImageBitmap[] => { for (const b of made) { try { b.close?.(); } catch { /* gone */ } } return []; };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let input: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mb: any = await import('mediabunny');
    input = new mb.Input({ formats: filmstripContainers(mb), source: new mb.UrlSource(url) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) { input.dispose?.(); return null; }
    let decodable = false;
    try { decodable = await track.canDecode(); } catch { decodable = false; }
    if (!decodable) { input.dispose?.(); return null; }        // codec not decodable here -> fallback
    const dur = await input.computeDuration();
    if (!Number.isFinite(dur) || dur <= 0) { input.dispose?.(); return null; }
    if (signal.aborted) { input.dispose?.(); return bail(); }
    // Only height is set, so mediabunny derives width from the display aspect ratio -
    // an aspect-correct canvas exactly like the old scratch (targetH×auto), no letterbox.
    const times = frameTimes(opts.clipInSec, opts.clipOutSec, count, dur);
    const sink = new mb.CanvasSink(track, { height: targetH, poolSize: 0 });
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      if (signal.aborted) { input.dispose?.(); return bail(); }
      if (wrapped?.canvas) {
        try { made.push(await createImageBitmap(wrapped.canvas)); }
        catch { input.dispose?.(); return bail(); }           // tainted / decoder hiccup: whole strip
      }
    }
    // An index-poor container (a MediaRecorder capture writes no Cues) answers
    // timestamp addressing only inside its first cluster, so the grid comes back
    // partial while the file itself is fine - the same failure the export provider
    // rescues with a straight cluster walk (sequence-providers, sampleSequential).
    // Walk here too: one pass, nearest frame at-or-after each target, the last frame
    // covering any tail the walk ends before. Only entered when the grid fell short.
    if (made.length < times.length) {
      const walked: ImageBitmap[] = [];
      let ti = 0;
      try {
        const wsink = new mb.CanvasSink(track, { height: targetH, poolSize: 0 });
        let lastCanvas: unknown = null;
        for await (const wrapped of wsink.canvases(0, dur)) {
          if (signal.aborted) { for (const b of walked) { try { b.close?.(); } catch { /* gone */ } } input.dispose?.(); return bail(); }
          if (!wrapped?.canvas) continue;
          lastCanvas = wrapped.canvas;
          while (ti < times.length && wrapped.timestamp >= (times[ti] as number)) {
            walked.push(await createImageBitmap(wrapped.canvas));
            ti++;
          }
          if (ti >= times.length) break;
        }
        while (ti < times.length && lastCanvas) {   // targets past the last frame hold it
          walked.push(await createImageBitmap(lastCanvas as HTMLCanvasElement));
          ti++;
        }
      } catch { /* the walk is best-effort: keep whatever the grid managed */ }
      if (walked.length > made.length) {
        for (const b of made) { try { b.close?.(); } catch { /* gone */ } }
        input.dispose?.();
        return walked;
      }
      for (const b of walked) { try { b.close?.(); } catch { /* gone */ } }
    }
    input.dispose?.();
    return made;
  } catch {
    input?.dispose?.();
    return null;   // undecodable / mediabunny error -> element-seek fallback
  }
}

/**
 * One filmstrip run: the CanvasSink path first (direct decode, no proxy, no shared probe
 * so it runs concurrently), falling back to the pooled-`<video>` element-seek path (under
 * the probe lock) where WebCodecs or the codec is unavailable.
 */
async function captureFilmstrip(assetUrl: string, opts: FilmstripOpts, signal: AbortSignal): Promise<ImageBitmap[]> {
  const viaSink = await captureFilmstripSink(assetUrl, opts, signal);
  if (viaSink !== null) return viaSink;
  return withProbe(() => captureFilmstripElement(assetUrl, opts, signal));
}

async function captureFilmstripElement(assetUrl: string, opts: FilmstripOpts, signal: AbortSignal): Promise<ImageBitmap[]> {
  if (!hasDom() || typeof createImageBitmap !== 'function') return [];
  // Check the signal BEFORE touching the probe. `share()` defers this run by a
  // microtask, so a caller that aborted in the same tick (the prescribed
  // abort-on-drag/zoom pattern) would otherwise still create the <video>, attach it,
  // and fire a real media request that nothing will ever consume.
  if (signal.aborted) return [];
  // No scrub proxy any more: the primary CanvasSink path decodes the original, and this
  // element-seek fallback (rare - only where WebCodecs is unavailable) seeks the original
  // directly too.
  const url = assetUrl;
  const count = clampInt(opts.count, 1, MAX_FRAMES);
  const targetH = clampInt(opts.h, 8, 240);
  const made: ImageBitmap[] = [];

  const bail = (): ImageBitmap[] => {
    for (const b of made) { try { b.close?.(); } catch { /* gone */ } }
    return [];
  };

  const v = getProbe();
  touchProbeIdle();
  if (probeUrl !== url) {
    probeUrl = url;
    if (isCrossOrigin(url)) v.crossOrigin = 'anonymous';
    else v.removeAttribute('crossorigin');
    v.src = url;
    try { v.load(); } catch { /* some engines auto-load */ }
    const ok = await waitMetadata(v, signal);
    if (!ok || signal.aborted) { probeUrl = ''; return bail(); }
  }

  const dur = v.duration;
  const vw = v.videoWidth;
  const vh = v.videoHeight;
  if (!Number.isFinite(dur) || dur <= 0 || !vw || !vh) return bail();

  const w = Math.max(1, Math.round((targetH * vw) / vh));
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== targetH) { scratch.width = w; scratch.height = targetH; }
  const ctx = scratch.getContext('2d', { willReadFrequently: false });
  if (!ctx) return bail();

  const times = frameTimes(opts.clipInSec, opts.clipOutSec, count, dur);
  const queue = probeQueue;
  if (!queue) return bail();

  for (const t of times) {
    if (signal.aborted) return bail();
    // Re-arm the idle reaper on every frame, not just at the two ends of the run: a
    // 24-frame strip on a stalling asset can spend longer than PROBE_IDLE_MS inside
    // this loop, and a teardown mid-run strips the probe's src underneath us - every
    // remaining seek then times out and the whole strip is discarded.
    touchProbeIdle();
    const landed = await queue.seek(t, { signal });
    if (signal.aborted) return bail();
    if (landed === null && v.readyState < 2 /* HAVE_CURRENT_DATA */) return bail();
    try {
      ctx.clearRect(0, 0, w, targetH);
      ctx.drawImage(v, 0, 0, w, targetH);
      made.push(await createImageBitmap(scratch));
    } catch {
      // Tainted canvas (no CORS headers) or a decoder hiccup: give up on this
      // asset entirely rather than returning a half strip.
      return bail();
    }
    if (signal.aborted) return bail();
  }
  touchProbeIdle();
  return made;
}

/**
 * Frames from a video (or any seekable media) asset, for a clip bar's filmstrip.
 *
 * Resolves an EMPTY array - never throws - when the asset can't be decoded, the
 * signal aborts, CORS taints the canvas, or there is no DOM (headless).
 * The returned bitmaps are owned by this module's cache: do not close them.
 */
export function filmstrip(assetUrl: string, opts: FilmstripOpts, signal?: AbortSignal): Promise<ImageBitmap[]> {
  if (!assetUrl || !hasDom()) return Promise.resolve([]);
  // Key + capture on the ORIGINAL asset: the CanvasSink path decodes it directly, and the
  // proxy is now internal to the element-seek fallback (captureFilmstripElement). The
  // dispatcher (captureFilmstrip) owns the probe lock, so we no longer wrap in withProbe.
  const key = filmstripKey(assetUrl, opts);
  const hit = cache.get(key);
  if (Array.isArray(hit)) return Promise.resolve(hit);
  return share<ImageBitmap[]>(
    key,
    async (runSignal) => {
      const frames = await captureFilmstrip(assetUrl, opts, runSignal);
      if (frames.length) cache.set(key, frames);
      return frames;
    },
    signal,
    [],
  );
}

/**
 * A SINGLE frame decoded from a clip's ORIGINAL asset, at the media's own native
 * resolution - the read path behind the sequence editor's "Export frame" action.
 *
 * Deliberately NOT built on `filmstrip()`: filmstrip caps its canvas at a bar-sized
 * target height, exactly right for a scrubbing filmstrip and exactly wrong for an
 * export. `frameAt` reads `assetUrl` EXACTLY as given - no
 * proxy swap of any kind - and draws at the decoded video's own `videoWidth`/
 * `videoHeight`. It also skips the shared filmstrip probe/cache entirely: an export
 * is a rare, deliberate action rather than a scrub-time hot path, so a dedicated
 * throwaway `<video>` costs nothing and can't be starved by (or starve) a
 * concurrent filmstrip capture on the pooled one.
 *
 * Resolves null - never throws - on any decode failure, an aborted signal, a
 * CORS-tainted canvas, or no DOM. The returned bitmap is caller-owned: close it
 * once drawn/encoded.
 */
async function decodeFrameAt(assetUrl: string, tSec: number, signal?: AbortSignal): Promise<ImageBitmap | null> {
  if (!assetUrl || !hasDom() || typeof createImageBitmap !== 'function') return null;
  if (signal?.aborted) return null;
  const v = document.createElement('video');
  v.preload = 'auto';
  v.muted = true;
  v.defaultMuted = true;
  v.autoplay = false;
  v.setAttribute('playsinline', '');
  v.setAttribute('aria-hidden', 'true');
  v.style.cssText = 'position:absolute;left:-99999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(v);
  try {
    if (isCrossOrigin(assetUrl)) v.crossOrigin = 'anonymous';
    v.src = assetUrl;
    try { v.load(); } catch { /* some engines auto-load */ }
    const ok = await waitMetadata(v, signal);
    if (!ok || signal?.aborted) return null;
    const dur = v.duration;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!Number.isFinite(dur) || dur <= 0 || !vw || !vh) return null;
    const at = Math.max(0, Math.min(Number.isFinite(tSec) ? tSec : 0, Math.max(0, dur - 0.01)));
    // A fresh queue rather than the shared `probeQueue`: this video is our own, so a
    // single-shot seek pump is all it ever has to serialise.
    const queue = createSeekQueue(v, (el, sig) => waitSeekLanded(el as HTMLVideoElement, sig));
    const landed = await queue.seek(at, { signal });
    if (signal?.aborted) return null;
    if (landed === null && v.readyState < 2 /* HAVE_CURRENT_DATA */) return null;
    const canvas = document.createElement('canvas');
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, vw, vh);
    return await createImageBitmap(canvas);
  } catch {
    return null;
  } finally {
    try { v.pause?.(); v.removeAttribute('src'); v.load?.(); v.remove(); } catch { /* already detached */ }
  }
}

let frameAtImpl: typeof decodeFrameAt = decodeFrameAt;

/**
 * Test seam: swap the video-decode implementation for a fake. Node has no real
 * video decode - exactly the reason `nodeStill`'s dom-to-image shot needs
 * `_setNodeRasterer` - so a behavioural test of a caller (e.g. the sequence
 * editor's "Export frame" action) installs a fake here rather than trying to make
 * jsdom present a real frame. Pass null to restore the real implementation.
 */
export function _setFrameAtImpl(fn: typeof decodeFrameAt | null): void {
  frameAtImpl = fn ?? decodeFrameAt;
}

export function frameAt(assetUrl: string, tSec: number, signal?: AbortSignal): Promise<ImageBitmap | null> {
  return frameAtImpl(assetUrl, tSec, signal);
}

// ── stills (image / lottie / tool-render bars) ──────────────────────────────
//
// Everything that is not video and not audio still has A PICTURE - an uploaded
// image, a Lottie's live <svg>, or a tool clip whose compose render lands in the
// DOM as an ordinary <img>. One bitmap is enough for all of them: the bar TILES
// it, so a long bar reads as a strip rather than one stretched frame.
//
// This is the cheap path on purpose. The picture is already decoded and painted
// on the canvas, so the live element is drawn directly and no second network
// request is made; the URL is only used as cache identity, and as the fallback
// source when the element is not usable (an <img> still loading, a Lottie that
// has not mounted). Nothing here touches the pooled probe <video> or its lock.

/** The live node a still can be read from without a re-fetch, when there is one. */
export type StillSource = Element | null | undefined;

export interface StillOpts {
  /** Target bitmap height in DEVICE px (clamped 8..MAX_STILL_H); width follows aspect. */
  h: number;
}

/** An <img> that has actually decoded, and can therefore be drawn this instant. */
function readyImage(el: StillSource): HTMLImageElement | null {
  const img = el as HTMLImageElement | null | undefined;
  if (!img || typeof img !== 'object') return null;
  if (String((img as Element).tagName || '').toLowerCase() !== 'img') return null;
  return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null;
}

/** The `<svg>` of a live element: the node itself, or the one a marker div holds. */
function liveSvg(el: StillSource): Element | null {
  if (!el || typeof (el as Element).tagName !== 'string') return null;
  if ((el as Element).tagName.toLowerCase() === 'svg') return el as Element;
  return (el as Element).querySelector?.('svg') ?? null;
}

/**
 * A live `<svg>` as a standalone SVG document's markup.
 *
 * The subtree is cloned and given the explicit pixel size a standalone SVG document
 * needs (a Lottie's root carries `width:100%`, which is meaningless with no containing
 * block). Kept separate from the data: URL encoding because callers that want to INLINE
 * the vector - an SVG export embedding it as an element rather than an <img> - need the
 * markup itself, and must get it under exactly the same size/serialiser rules.
 *
 * Returns null - never throws - when there is no serialiser, no usable size, or the
 * markup is past MAX_SVG_MARKUP.
 */
export function svgMarkup(svg: Element): string | null {
  const g = globalThis as { XMLSerializer?: new () => { serializeToString(n: Node): string } };
  if (typeof g.XMLSerializer !== 'function') return null;
  try {
    const clone = svg.cloneNode(true) as Element;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // A percentage width/height in `style` beats the width/height attributes and
    // resolves to zero in a standalone document - drop it, keep everything else.
    clone.removeAttribute('style');
    const vb = (clone.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const vw = vb.length === 4 && Number.isFinite(vb[2]) && (vb[2] as number) > 0 ? (vb[2] as number) : 0;
    const vh = vb.length === 4 && Number.isFinite(vb[3]) && (vb[3] as number) > 0 ? (vb[3] as number) : 0;
    const attrW = Number.parseFloat(clone.getAttribute('width') || '');
    const attrH = Number.parseFloat(clone.getAttribute('height') || '');
    const w = vw || (Number.isFinite(attrW) && attrW > 0 ? attrW : 0);
    const h = vh || (Number.isFinite(attrH) && attrH > 0 ? attrH : 0);
    if (!w || !h) return null;
    clone.setAttribute('width', String(Math.round(w)));
    clone.setAttribute('height', String(Math.round(h)));
    const markup = new g.XMLSerializer().serializeToString(clone);
    if (!markup || markup.length > MAX_SVG_MARKUP) return null;
    return markup;
  } catch {
    return null;
  }
}

/**
 * A live `<svg>` as something an `<img>` can load.
 *
 * Canvas cannot draw an SVG *element* - only an image - so the serialised document is
 * inlined as a data: URL. A data URL rather than a blob: URL because there is no revoke
 * to forget, and a data: SVG taints no canvas.
 */
export function svgDataUrl(svg: Element): string | null {
  const markup = svgMarkup(svg);
  return markup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}` : null;
}

/** Load an `<img>`, abort-aware and time-boxed. Resolves null instead of throwing. */
function loadImage(src: string, signal: AbortSignal, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let img: HTMLImageElement;
    try { img = document.createElement('img'); } catch { resolve(null); return; }
    let done = false;
    const finish = (value: HTMLImageElement | null): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onFail);
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };
    const onFail = (): void => finish(null);
    const timer = setTimeout(onFail, STILL_TIMEOUT_MS);
    img.onload = (): void => finish(img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
    img.onerror = onFail;
    img.decoding = 'async';
    if (cors) img.crossOrigin = 'anonymous';
    if (signal.aborted) { finish(null); return; }
    signal.addEventListener('abort', onFail, { once: true });
    try { img.src = src; } catch { onFail(); }
  });
}

async function captureStill(url: string, opts: StillOpts, signal: AbortSignal, live: StillSource): Promise<ImageBitmap[]> {
  if (!hasDom() || typeof createImageBitmap !== 'function') return [];
  // Same rule as captureFilmstrip: `share()` defers the run by a microtask, so a
  // caller that aborted in the same tick must cost nothing at all - no <img>, no
  // request, no serialisation.
  if (signal.aborted) return [];

  let src = readyImage(live);
  if (!src) {
    const svg = liveSvg(live);
    const href = svg ? svgDataUrl(svg) : url;
    if (!href) return [];
    src = await loadImage(href, signal, !svg && isCrossOrigin(href));
  }
  if (!src || signal.aborted) return [];

  const targetH = clampInt(opts.h, 8, MAX_STILL_H);
  const sw = src.naturalWidth;
  const sh = src.naturalHeight;
  if (!sw || !sh) return [];
  const w = clampInt((targetH * sw) / sh, 1, MAX_STILL_W);

  // A canvas of its own, not the shared `scratch`: still runs are NOT serialised
  // behind the probe lock, so two overlapping captures sharing one canvas could
  // resize it under each other between the draw and the createImageBitmap.
  let bmp: ImageBitmap | null = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = targetH;
    const ctx = cv.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(src, 0, 0, w, targetH);
    bmp = await createImageBitmap(cv);
  } catch {
    // Tainted canvas (a cross-origin image with no CORS headers), an SVG with an
    // external reference, or a decoder hiccup: the bar keeps its plain fill.
    return [];
  }
  if (signal.aborted) {
    // Not cached, so nobody else owns it - this is the one place a caller closes.
    try { (bmp as { close?: () => void }).close?.(); } catch { /* already gone */ }
    return [];
  }
  return [bmp];
}

/**
 * The single tile-able bitmap for a non-video, non-audio clip bar.
 *
 * Resolves an array of 0 or 1 bitmaps - never throws - and an EMPTY array when the
 * picture is undecodable, cross-origin-tainted, aborted, or there is no DOM. Pass
 * `live` (the `<img>` already on the canvas, or a Lottie's mounted `<svg>`) to skip
 * the network entirely; `assetUrl` is always the cache identity regardless.
 *
 * The returned bitmap is owned by this module's cache: draw it synchronously and
 * do not close, retain, or hand it across a repaint.
 */
export function stillFrames(assetUrl: string, opts: StillOpts, signal?: AbortSignal, live?: StillSource): Promise<ImageBitmap[]> {
  if (!assetUrl || !hasDom()) return Promise.resolve([]);
  const key = stillKey(assetUrl, opts.h);
  const hit = cache.get(key);
  if (Array.isArray(hit)) return Promise.resolve(hit);
  return share<ImageBitmap[]>(
    key,
    async (runSignal) => {
      const frames = await captureStill(assetUrl, opts, runSignal, live);
      if (frames.length) cache.set(key, frames);
      return frames;
    },
    signal,
    [],
  );
}

// ── node rasters (a box with NO media of its own: a frame, a card, a shape) ──
//
// The gap this closes: `stillFrames` needs something an <img> can hold, and a text
// card, a pen shape, a coloured frame or a composed group has nothing of the sort.
// Those bars fell back to one flat fillRect of the box's own background - and a
// TRANSPARENT one (a plain text box, and every `kind:'path'` box, whose fill the tool
// hook forces to transparent) painted literally nothing. A timeline of frames was
// therefore a row of near-identical rectangles, or of blanks.
//
// So photograph the box. That is a dom-to-image shot, an order of magnitude dearer
// than every other producer in this module, and it is fenced on four sides:
//
//   • the CALLER declines cheap: `MAX_NODE_RASTER_NODES` subtree elements, and only
//     boxes that would actually show something (see canRasterBox in timeline-panel);
//   • the caller also enforces a per-PASS budget, so twenty frames cannot queue
//     twenty shots in one idle callback;
//   • at most ONE shot is in flight process-wide (see `nodeLock`) - dom-to-image-more
//     keeps MODULE-GLOBAL mutable state (its options, its url cache, its sandbox
//     iframe) and the teardown at the end of ANY call clears it, including out from
//     under a call still running. The lock is held until the library call REALLY
//     settles, not until the caller stops waiting for it (see below);
//   • every shot is time-boxed by `NODE_RASTER_TIMEOUT_MS`. The library call itself is
//     uncancellable, so the race is the containment: a late result is abandoned by the
//     CALLER while the LOCK stays held - releasing it on the timeout would let the next
//     shot run concurrently with the one that timed out, which is exactly the overlap
//     the lock exists to prevent;
//   • a shot that produced nothing is REMEMBERED (`nodeFailed`), so a box that cannot
//     be photographed - tainted image, pathological cost, a timeout - costs one attempt
//     rather than one attempt per pass forever, starving every bar behind it.
//
// And because those globals are shared with the EXPORT path, `suspendNodeRasters()`
// brackets any export that rasterises: a thumbnail shot overlapping an export would
// corrupt both pictures. Suspending only stops NEW shots, so an export must also
// `await drainNodeRasters()` - a shot already inside the library cannot be cancelled,
// only waited out.
//
// The result is ONE bitmap, tiled by the bar exactly like a still. A node-mode box
// cannot animate by construction - the moment it contains a <video>, an <img>, a
// Lottie marker or an audio marker the caller classifies it as media and takes one of
// the branches above - so N distinct rasters would cost N times as much to produce N
// identical pictures.

/**
 * The `.seq-off` class sequence-dom.ts puts on every box outside the playhead window,
 * which timeline.css turns into `display:none !important`.
 *
 * Copied rather than imported ON PURPOSE: `bridge/sequence-dom.ts` drags
 * sequence-plan + transitions with it, and this module is also imported by picker.ts
 * for `onIdle` alone. One string is not worth pulling that graph into that chunk.
 * If the class is ever renamed, `bridge/sequence-dom.ts` is the source of truth.
 */
const OFF_CLASS = 'seq-off';

/**
 * Parked offscreen for the duration of a shot. See `defaultNodeRasterer`: photographing
 * an off-playhead box means un-hiding it on the LIVE stage, and without this the canvas
 * strobes through every frame of the sequence after every drag. timeline.css owns the
 * rule; the clone's own transform is overridden by the shot's `style` option, so the
 * picture is unaffected.
 *
 * Copied for the same reason as OFF_CLASS above; `bridge/sequence-dom.ts` is the source
 * of truth for both, and clip-thumbs.test.ts pins the copies against it.
 */
const SHOT_CLASS = 'tl-shot';

/**
 * The lease a shot stamps on every element whose `seq-off` it borrowed (see
 * `borrowVisibility`) - `bridge/sequence-dom.ts`'s `BORROW_ATTR`. Its applier reads the
 * attribute to decide whether it may leave a mid-shot box hidden, and CLEARS it to take
 * a box the playhead has moved onto back off us.
 */
const BORROW_ATTR = 'data-tl-borrowed';

/** Tells one borrow from the next, so a late restore can see that it lost the lease. */
let borrowToken = 0;

/**
 * Called after a shot has put the classes it borrowed back.
 *
 * The rasterer's restore only re-hides what still holds its lease (see
 * `borrowVisibility`), so a box the clock claimed mid-shot is left alone - but the shot
 * spent up to NODE_RASTER_TIMEOUT_MS on a live stage, and every OTHER box's state has
 * moved on too. So the panel registers the clock's `reapply()` here and the
 * authoritative state is re-asserted wholesale, one tick later.
 */
type ShotSettled = () => void;
const shotSettled = new Set<ShotSettled>();

/** Register a post-shot reconciler (the sequence clock's `reapply`). Returns a remover. */
export function onNodeShotSettled(fn: ShotSettled): () => void {
  shotSettled.add(fn);
  return () => { shotSettled.delete(fn); };
}

function announceShotSettled(): void {
  for (const fn of [...shotSettled]) {
    try { fn(); } catch { /* a reconciler must never break the next shot */ }
  }
}

export interface NodeOpts {
  /** Target bitmap height in DEVICE px (clamped 8..MAX_NODE_H); width follows the box. */
  h: number;
}

/** The shot itself, injectable so the panel's behaviour is testable without a browser. */
export type NodeRasterer = (el: HTMLElement, targetH: number, signal: AbortSignal) => Promise<HTMLCanvasElement | null>;

let nodeRasterer: NodeRasterer | null = null;

/**
 * Test-only: swap the dom-to-image shot for a fake (mirrors the injected `waitFrame`
 * of `createSeekQueue`). Without this seam there is no way to exercise node mode in
 * node - jsdom has no rasteriser - and the whole branch would be untestable above the
 * key level. Pass null to restore the real one.
 */
export function _setNodeRasterer(f: NodeRasterer | null): void {
  nodeRasterer = f;
}

let nodeSuspend = 0;

/**
 * Bracket any dom-to-image EXPORT with this. While suspended, `nodeStill` resolves
 * empty immediately and caches NOTHING (so the bar retries once the export is done
 * rather than remembering a blank). Re-entrant: the release is idempotent and the
 * counter only reaches zero when every holder has let go.
 */
export function suspendNodeRasters(): () => void {
  nodeSuspend++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    nodeSuspend = Math.max(0, nodeSuspend - 1);
  };
}

/** True while an export holds the dom-to-image globals. Exported for tests only. */
export function nodeRastersSuspended(): boolean {
  return nodeSuspend > 0;
}

/**
 * Wait for the shot already inside dom-to-image to finish, if there is one.
 *
 * `suspendNodeRasters()` is a gate, not a barrier: it stops the NEXT shot, and can do
 * nothing about the uncancellable library call already running. An export that starts
 * mid-pass would otherwise overwrite that call's module-global options and clear its
 * url cache + sandbox iframe out from under it - corrupting the EXPORT, which is the
 * expensive half. So every suspend site follows with `await drainNodeRasters()`.
 *
 * Bounded, and deliberately so: a wedged library call must delay an export by a beat,
 * never hold it hostage. Resolves - never rejects.
 */
export function drainNodeRasters(timeoutMs: number = NODE_RASTER_TIMEOUT_MS + 500): Promise<void> {
  const settled = nodeChain.then(() => undefined, () => undefined);
  if (!(timeoutMs > 0)) return settled;
  return Promise.race([
    settled,
    new Promise<void>((resolve) => { setTimeout(resolve, timeoutMs); }),
  ]);
}

/**
 * Keys whose shot produced no picture, so no pass ever spends its budget on them again.
 *
 * Without this a box that CANNOT be photographed - a cross-origin image with no CORS
 * headers taints the canvas, a subtree under the element ceiling but past the time
 * budget times out - is retried by every pass of every scheduling, forever, and because
 * the budget is spent in bar order the bars behind it are never reached at all. Bounded
 * FIFO: the set is a hint, and forgetting the oldest hint only costs one more attempt.
 *
 * Only DEFINITIVE non-results are recorded. An abort, a suspended export and a detached
 * box are all "ask again later" and leave no mark - see `NodeShot.retry`.
 */
const MAX_NODE_FAILURES = 64;
const nodeFailed = new Set<string>();

function markNodeFailed(key: string): void {
  nodeFailed.add(key);
  while (nodeFailed.size > MAX_NODE_FAILURES) {
    const oldest = nodeFailed.values().next().value as string | undefined;
    if (oldest === undefined) break;
    nodeFailed.delete(oldest);
  }
}

/** Has this exact picture already been tried and failed? Callers skip those bars. */
export function nodeRasterFailed(key: string): boolean {
  return nodeFailed.has(key);
}

/**
 * Is a shot for this key already running (or already queued behind the lock)?
 *
 * The budget is per PASS but the shots are serialised, so a continuation pass fires
 * long before its predecessor's six shots have landed in the cache. Without this the
 * retry pass spends its whole budget re-requesting bars that are already in flight - 
 * `share()` dedups them into no new work - and the bars it was queued to reach are
 * skipped again. A pending bar still calls through: it JOINS the running shot and
 * paints when it lands. It simply must not cost a budget slot to do so.
 */
export function nodeRasterPending(key: string): boolean {
  const job = inflight.get(key);
  return !!job && !job.ctrl.signal.aborted;
}

/**
 * Is this raster already decoded and in the cache?
 *
 * Lets the caller spend its per-pass budget on MISSES only - a hit paints
 * synchronously and costs nothing, so a scrolled-back-into-view frame must not
 * consume one of the six shots a pass is allowed. `cache.get` bumps recency, which is
 * exactly right: a bar still on screen is still hot.
 */
export function peekNodeRaster(key: string): ImageBitmap[] | null {
  const hit = cache.get(key);
  return Array.isArray(hit) ? hit : null;
}

// The one dom-to-image import in this module. Its own lazy handle rather than a
// re-export from bridge/export.ts (which sequence-render.ts also avoids, for the same
// reason): importing it from there would drag that module's whole graph into this
// lazy chunk. Rollup dedupes the three `import('dom-to-image-more')` sites into one.
interface DomToImageLib { toCanvas(node: Element, opts?: unknown): Promise<HTMLCanvasElement> }
let domToImageMore: DomToImageLib | null = null;
async function getDomToImage(): Promise<DomToImageLib | null> {
  if (!domToImageMore) {
    try {
      const mod = await import('dom-to-image-more') as { default?: DomToImageLib } & DomToImageLib;
      domToImageMore = mod.default ?? mod;
    } catch {
      return null; // no bundler resolution (a node test run) - the bar keeps its fill
    }
  }
  return domToImageMore;
}

// ── the authored-pose seam (plans/104 section 6.5) ────────────────────────────────
//
// A thumbnail always shows the box's AUTHORED pose. It is a picture of the clip, not a
// picture of the frame the playhead happens to be parked on - and once keyframes are in
// play "the frame the playhead is parked on" can be a box lifted, scaled, faded and
// blurred half way through a move, which is a bar that changes every time the user
// scrubs past it.
//
// The authored values live in the applier's AuthoredStore (bridge/sequence-dom.ts), and
// they arrive here INJECTED rather than imported for exactly the reason OFF_CLASS is
// copied above: `bridge/sequence-dom.ts` drags sequence-plan → @lolly/engine behind it,
// and this module is imported by picker.ts for `onIdle` alone. The timeline panel - the
// one module that already owns both - wires the seam; with nothing wired every path
// below behaves exactly as it did before plans/104.

/** One element's authored inline styles. `''` means "no declaration", not "neutral". */
export interface AuthoredPose {
  transform: string;
  opacity: string;
  filter: string;
  zIndex: string;
  /**
   * The AUTHORED inline `width`/`height` - '' when the box sizes itself.
   *
   * The applier writes these per frame for a `w`/`h` keyframe tween (plans/104 section 5.2,
   * P1 - the one deliberate layout write), so a shot taken mid-tween would otherwise be
   * framed at the stretched size and re-wrap its text. Optional so a seam wired by an
   * older caller still type-checks; absent falls back to the live inline value.
   */
  width?: string;
  height?: string;
}

export interface AuthoredPoseSeam {
  /**
   * The authored styles a live writer is composing over `el`, or null when nobody is
   * writing on it - in which case the DOM already IS authored and nothing may change.
   */
  read(el: HTMLElement): AuthoredPose | null;
  /**
   * Put `el` back to its authored pose IN PLACE, returning the undo (which re-asserts
   * the writer at its own current time). For a reader that walks the live subtree and
   * has no clone to neutralise on.
   */
  borrow(el: HTMLElement): () => void;
}

let poseSeam: AuthoredPoseSeam | null = null;

/** Wire the authored-pose seam. Returns the removal, restoring whatever was there. */
export function setAuthoredPoseSeam(seam: AuthoredPoseSeam | null): () => void {
  const prev = poseSeam;
  poseSeam = seam;
  return () => { if (poseSeam === seam) poseSeam = prev; };
}

/**
 * The inline style a node shot puts on dom-to-image's CLONE.
 *
 * Pure and exported because it is the whole of the authored-pose contract for the
 * raster path, and node has no rasteriser to prove it through (`defaultNodeRasterer`
 * resolves null here). Two properties are asserted by it: a shot taken mid-keyframe
 * carries the same style as a shot taken at rest, and a box nothing is composing over
 * gets byte-for-byte the five declarations this has always emitted.
 *
 * `transform` is the fit scale, never the box's own: a thumbnail is the clip
 * unrotated, at bar height. `opacity`/`filter` appear only when a live writer is
 * composing over this box, and then they carry its AUTHORED values - an empty string
 * would REMOVE the clone's declaration and drop it back onto the composed value
 * dom-to-image copied out of getComputedStyle, which is the opposite of the point.
 */
export function nodeShotStyle(
  el: HTMLElement, bw: number, bh: number, S: number,
): Record<string, string> {
  const authored = poseSeam?.read(el) ?? null;
  return {
    transform: `scale(${S})`, transformOrigin: 'top left',
    width: `${bw}px`, height: `${bh}px`, left: '0', top: '0', margin: '0',
    ...(authored ? { opacity: authored.opacity || '1', filter: authored.filter || 'none' } : {}),
  };
}

/**
 * The real shot. Modelled line for line on `rasterBox` in bridge/sequence-render.ts,
 * which is already hardened against this exact live stage - deliberately NOT on
 * export.ts's `rasterizeNodeToDataUrl`, which returns null for any `display:none`
 * node (i.e. most bars most of the time), sizes off getBoundingClientRect (so a zoomed
 * stage re-wraps text into the capture), rewrites live <img> srcs per call, and
 * round-trips a PNG we do not need.
 */
const defaultNodeRasterer: NodeRasterer = async (el, targetH, signal) => {
  const lib = await getDomToImage();
  if (!lib || signal.aborted) return null;
  // LAYOUT size, not the rendered rect: the stage carries the editor's zoom
  // transform, and sizing off the rect would photograph the box at whatever
  // magnification the user happens to be at - re-wrapping its text every time.
  // AUTHORED size first (plans/104 section 5.2): the applier writes `width`/`height` per frame
  // for a size tween, and a thumbnail must be the clip at rest. Falls back to the live
  // inline value, then to layout - which is what it always was, and what a box with no
  // inline size still resolves to. (A box with NO authored width that is mid-tween is
  // the one case this cannot recover; design boxes always carry one.)
  const authored = poseSeam?.read(el) ?? null;
  const bw = Math.max(1, parseFloat(authored?.width ?? '') || parseFloat(el.style.width) || el.offsetWidth || 1);
  const bh = Math.max(1, parseFloat(authored?.height ?? '') || parseFloat(el.style.height) || el.offsetHeight || 1);
  // FIT, don't crop. Height alone used to set the scale and the width was then clamped
  // to MAX_STILL_W independently - so a 1600×100 divider was photographed as its left
  // 84%, and the bar tiled that crop at an aspect the bitmap no longer had. Both limits
  // choose the scale together; the bitmap is then exactly bw:bh, whatever its size.
  const S = Math.min(clampInt(targetH, 8, MAX_NODE_H) / bh, MAX_STILL_W / bw);
  // NOTE: the `.seq-off` borrow that makes an off-playhead box photographable at all
  // does NOT live here - `captureNode` owns it, so it brackets any rasterer (including
  // an injected one) and, more importantly, so it is released when the library call
  // REALLY settles rather than when the caller stops waiting for it.
  //
  // The AUTHORED pose (plans/104 section 6.5) is neutralised on the CLONE - see
  // `nodeShotStyle` - because the library's `style` option is applied to the clone
  // after its computed styles are copied across, which is how the fit transform
  // already beats both the editor's zoom and the `tl-shot` park. Nothing on the live
  // stage moves, so a shot of the box the user is currently looking at cannot flicker
  // it. A bar photographed mid-fade used to come out faded; mid-keyframe it would come
  // out blurred and lifted as well.
  try {
    return await lib.toCanvas(el, {
      width: clampInt(bw * S, 1, MAX_STILL_W),
      height: clampInt(bh * S, 1, MAX_NODE_H),
      // Font inlining is the largest per-call cost, and the library wipes its own url
      // cache on every teardown - so it re-fetches and re-base64s every face on EVERY
      // call. At a 34px bar the substituted platform face is indistinguishable.
      // Image inlining stays ON: that is the picture.
      disableEmbedFonts: true,
      style: nodeShotStyle(el, bw, bh, S),
    });
  } catch {
    return null;
  }
};

/**
 * Make a box photographable, and hand back the undo.
 *
 * THE STAGE IS LIVE, AND THE CLOCK HAS BEEN ON IT. Every box outside the playhead
 * window carries `.seq-off` → `display:none !important`, and dom-to-image copies the
 * computed cssText wholesale into its clone, so a box that is merely "not under the
 * playhead" photographs BLANK - which is most of the timeline, most of the time. The
 * class comes off for the duration of the shot and goes back on every path, including
 * a thrown serialisation. That line is borrowed from `rasterBox` in sequence-render.
 *
 * What is NOT borrowed, because that stage is an export's and this one is the user's:
 *
 *   • the box is PARKED OFFSCREEN (SHOT_CLASS) for as long as it is un-hidden. Without
 *     it the artboard strobes through every off-playhead frame it photographs - six
 *     shots of ~100-300ms each after every drag, zoom and fit.
 *   • the borrow is a LEASE, not a swap. The restore lands up to NODE_RASTER_TIMEOUT_MS
 *     later and the user may have scrubbed onto this box meanwhile - and then the park is
 *     the damage, not the class: the applier removed `.seq-off`, believed the scene live,
 *     and `translate(-200vw,-200vw)` held the ACTIVE frame off the viewport until the shot
 *     settled, at which point it popped in. So every borrowed element is stamped with
 *     BORROW_ATTR and the applier owns the handover: it clears the stamp AND the park the
 *     moment it wants the box on screen, and the restore below re-hides only what still
 *     carries its own token. `announceShotSettled` stays as the belt to that braces - 
 *     the clock re-asserting everything else it believes, one tick later.
 */
function borrowVisibility(el: HTMLElement): () => void {
  const offs = [
    ...(el.classList?.contains?.(OFF_CLASS) ? [el as Element] : []),
    ...(el.querySelectorAll?.(`.${OFF_CLASS}`) ?? []),
  ];
  if (!offs.length) return () => { /* the box is on screen: nothing borrowed */ };
  const token = String(++borrowToken);
  el.classList.add(SHOT_CLASS);
  for (const off of offs) {
    off.classList.remove(OFF_CLASS);
    off.setAttribute?.(BORROW_ATTR, token);
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const off of offs) {
      // Lost the lease: the clock has since made this box live (or torn its own
      // visibility contract down entirely). Re-hiding it here is the black stage.
      if (off.getAttribute?.(BORROW_ATTR) !== token) continue;
      off.removeAttribute?.(BORROW_ATTR);
      off.classList.add(OFF_CLASS);
    }
    el.classList.remove(SHOT_CLASS);
    announceShotSettled();
  };
}

/**
 * `borrowVisibility` as a scope: run `fn` with the box photographable, restore on every
 * path including a throw. For callers that own the whole read - the vector twin walks the
 * live subtree synchronously-ish and returns markup, with no separate "the shot REALLY
 * ended" moment to hand the lease to, unlike `captureNode`'s raster which restores when
 * the library settles rather than when its own caller stops waiting.
 */
export async function withBorrowedVisibility<T>(el: HTMLElement, fn: () => Promise<T>): Promise<T> {
  const restore = borrowVisibility(el);
  // The vector twin reads the LIVE subtree - there is no clone to neutralise the
  // applier's pose on, the way `defaultNodeRasterer` does - so the authored values go
  // back on the element itself for the walk (plans/104 section 6.5). A no-op, closure and all,
  // when nothing was composed on this box; and while the box is parked by
  // `borrowVisibility` the park's `!important` transform still wins, so what this
  // actually rescues is the box's opacity and blur.
  const pose = poseSeam?.borrow(el) ?? null;
  try {
    return await fn();
  } finally {
    pose?.();
    restore();
  }
}

// One shot at a time, process-wide (see the section header: the library's globals are
// module-level and its teardown clears them). Same shape as the probe <video>'s
// `withProbe` lock - one uncancellable device operation at a time.
//
// The lock is acquired and released EXPLICITLY rather than by chaining on the caller's
// promise, because the caller gives up at NODE_RASTER_TIMEOUT_MS and the library call
// does not: chaining on the timed-out promise opened the lock while the shot was still
// inside `toCanvas`, so the next shot ran concurrently and the first one's teardown
// cleared the shared globals out from under it. The hold is on the SHOT.
let nodeChain: Promise<unknown> = Promise.resolve();

/**
 * Wait for the lock, then keep it until the promise handed to the returned `hold` has
 * settled. `nodeChain` is re-pointed SYNCHRONOUSLY, before the await, so two acquirers
 * in the same tick queue behind each other instead of both seeing the old chain.
 */
async function nodeLock(): Promise<(held: Promise<unknown>) => void> {
  const prev = nodeChain;
  let done!: () => void;
  const mine = new Promise<void>((resolve) => { done = resolve; });
  nodeChain = prev.then(() => mine, () => mine);
  await prev.then(() => undefined, () => undefined);
  return (held: Promise<unknown>): void => { void Promise.resolve(held).then(done, done); };
}

/** A shot's outcome. `retry` distinguishes "ask again later" from "this cannot work". */
interface NodeShot {
  frames: ImageBitmap[];
  /** True when nothing was learned (aborted / suspended / detached / no DOM). */
  retry: boolean;
}

const RETRY: NodeShot = { frames: [], retry: true };
const FAILED: NodeShot = { frames: [], retry: false };

async function captureNode(el: HTMLElement, opts: NodeOpts, signal: AbortSignal): Promise<NodeShot> {
  if (!hasDom() || typeof createImageBitmap !== 'function') return RETRY;
  // Same rule as captureFilmstrip/captureStill, and it matters MORE here: `share()`
  // defers this run by a microtask and the lock may defer it much further, so an
  // aborted caller (drag/zoom started) or an export that began in the meantime must
  // cost nothing at all - no shot, no font fetch, no clone.
  if (signal.aborted || nodeSuspend > 0) return RETRY;

  const targetH = clampInt(opts.h, 8, MAX_NODE_H);
  const shoot = nodeRasterer ?? defaultNodeRasterer;
  const release = await nodeLock();
  let held: Promise<unknown> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    // Re-checked AFTER the lock: a shot can wait a long time behind five others, and
    // by the time its turn comes the pass may be gone, an export may have started, or
    // the runtime may have re-rendered the box out of the tree. Photographing a
    // detached node yields an unstyled blank that would then be CACHED as its picture.
    if (signal.aborted || nodeSuspend > 0) return RETRY;
    if (el.isConnected === false) return RETRY;
    // Un-hidden for the shot, put back when the shot REALLY ends - not when this
    // caller stops waiting for it. A restore on the timeout would re-hide the box
    // while the library is still reading its computed styles, i.e. photograph the
    // blank it exists to prevent.
    const unhide = borrowVisibility(el);
    const shot = Promise.resolve().then(() => shoot(el, targetH, signal))
      .catch(() => null)
      .then((c) => { unhide(); return c; });
    held = shot;                        // the lock is held until this REALLY settles
    canvas = await Promise.race([
      shot,
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), NODE_RASTER_TIMEOUT_MS); }),
    ]);
  } catch {
    canvas = null;                      // a rasterer must never throw into the caller
  } finally {
    if (timer) clearTimeout(timer);
    release(held);
  }
  if (signal.aborted) return RETRY;
  if (!canvas) return FAILED;           // declined, threw, or ran past its budget
  if (!(canvas.width > 0) || !(canvas.height > 0)) return FAILED;

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(canvas);
  } catch {
    return FAILED;                      // a tainted canvas - it will taint next time too
  }
  if (signal.aborted) {
    // Not cached, so nobody else owns it - this is the one place a caller closes.
    try { (bmp as { close?: () => void }).close?.(); } catch { /* already gone */ }
    return RETRY;
  }
  return { frames: [bmp], retry: false };
}

/**
 * The single tile-able bitmap for a box with no media: a photograph of the box itself.
 *
 * `sig` is the APPEARANCE signature that identifies the picture (see `nodeKey`) - two
 * boxes that look identical legitimately share one raster, and `share()` then collapses
 * them into a single shot as well. `el` is the live `.lolly-box`.
 *
 * Resolves an array of 0 or 1 bitmaps and NEVER throws: an aborted pass, a suspended
 * export, a headless run, a serialisation failure and a timeout all resolve empty, and
 * the bar simply keeps whatever underlay it already painted. A DEFINITIVE non-result
 * (as opposed to an abort or a suspended export) is remembered - see `nodeFailed` - 
 * so the same hopeless box is not re-shot on every pass for the rest of the session.
 *
 * The returned bitmap is owned by this module's cache: draw it synchronously and do not
 * close, retain, or hand it across a repaint.
 */
export function nodeStill(sig: string, el: HTMLElement | null | undefined, opts: NodeOpts, signal?: AbortSignal): Promise<ImageBitmap[]> {
  if (!sig || !el || !hasDom()) return Promise.resolve([]);
  const key = nodeKey(sig, opts.h);
  const hit = cache.get(key);
  if (Array.isArray(hit)) return Promise.resolve(hit);
  // Checked before `share()` as well as inside the capture: while an export holds the
  // library's globals there is nothing useful to start, and a suspended run must not
  // leave an inflight entry that a later caller would join and inherit the empty from.
  if (nodeSuspend > 0) return Promise.resolve([]);
  // Already tried, already came back with nothing. Retrying costs a full uncancellable
  // shot to learn the same thing, and - because the caller's budget is spent in bar
  // order - it costs every bar behind this one their turn. The bar keeps its underlay.
  if (nodeFailed.has(key)) return Promise.resolve([]);
  return share<ImageBitmap[]>(
    key,
    async (runSignal) => {
      const shot = await captureNode(el, opts, runSignal);
      if (shot.frames.length) cache.set(key, shot.frames);
      else if (!shot.retry) markNodeFailed(key);
      return shot.frames;
    },
    signal,
    [],
  );
}

// ── peaks ───────────────────────────────────────────────────────────────────

interface DecodeCtx {
  decodeAudioData(
    buffer: ArrayBuffer,
    ok?: (b: AudioBuffer) => void,
    fail?: (e: unknown) => void,
  ): Promise<AudioBuffer> | void;
}

let audioCtx: DecodeCtx | null = null;

/**
 * One pooled decode context. OfflineAudioContext is preferred: it needs no
 * output device, is never suspended by autoplay policy, and holds no hardware.
 */
function getDecodeCtx(): DecodeCtx | null {
  if (audioCtx) return audioCtx;
  const g = globalThis as unknown as {
    OfflineAudioContext?: new (ch: number, len: number, rate: number) => DecodeCtx;
    webkitOfflineAudioContext?: new (ch: number, len: number, rate: number) => DecodeCtx;
    AudioContext?: new () => DecodeCtx;
    webkitAudioContext?: new () => DecodeCtx;
  };
  const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
  const AC = g.AudioContext || g.webkitAudioContext;
  try {
    if (OAC) audioCtx = new OAC(1, 1, 44100);
    else if (AC) audioCtx = new AC();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function decode(ctx: DecodeCtx, buf: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    // Callback form as well as the promise form - old Safari only has the former.
    const maybe = ctx.decodeAudioData(
      buf,
      (b) => { if (!settled) { settled = true; resolve(b); } },
      (e) => { if (!settled) { settled = true; reject(e); } },
    );
    if (maybe && typeof (maybe as Promise<AudioBuffer>).then === 'function') {
      (maybe as Promise<AudioBuffer>).then(
        (b) => { if (!settled) { settled = true; resolve(b); } },
        (e) => { if (!settled) { settled = true; reject(e); } },
      );
    }
  });
}

/**
 * Read a response body into memory, abandoning it the instant it exceeds `max`
 * bytes. `arrayBuffer()` cannot do this - it buffers the WHOLE body first, so a
 * chunked/CDN response with no Content-Length would allocate a 500 MB asset in full
 * before the size check downstream could refuse it, which is the larger allocation of
 * the two this module is defending against. Returns null when the body is oversized,
 * aborted, or unreadable. Falls back to `arrayBuffer()` only where streams are
 * unavailable (no `body` - e.g. a polyfilled/test fetch).
 */
export interface BoundedBody {
  body?: { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } | null;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function readBounded(res: BoundedBody, max: number, signal?: { aborted: boolean }): Promise<ArrayBuffer | null> {
  const reader = res.body?.getReader?.();
  if (!reader) {
    const whole = await res.arrayBuffer();
    return whole.byteLength <= max ? whole : null;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const giveUp = async (): Promise<null> => {
    try { await reader.cancel(); } catch { /* already closed */ }
    return null;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > max || signal?.aborted) return await giveUp();
      chunks.push(value);
    }
  } catch {
    return await giveUp();
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength; }
  return out.buffer as ArrayBuffer;
}

/**
 * Explicit container singletons for the audio decode, mirroring
 * sequence-providers' AUDIO_CONTAINERS - never ALL_FORMATS (the mediabunny source
 * guard). The four AV containers are here as well as the audio-only ones, because a
 * VIDEO's soundtrack lives inside its own container and getPrimaryAudioTrack reads it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function audioSinkContainers(m: any): unknown[] {
  return [m.MP4, m.QTFF, m.WEBM, m.MATROSKA, m.OGG, m.MP3, m.WAVE, m.ADTS, m.FLAC];
}

/**
 * Peak envelope via mediabunny's AudioBufferSink: the primary peaks path, and the one
 * that removes the MAX_AUDIO_DECODE_BYTES ceiling. decodeAudioData expands the WHOLE
 * file to raw f32 PCM before anything can bucket it, so the file must fit in memory.
 * The sink hands back one decoded buffer at a time, and this accumulates the peak
 * envelope INCREMENTALLY: a sample's bucket is derived from its position in the whole
 * track, so no decoded PCM is retained past the buffer it came in. Memory is
 * O(MASTER_BUCKETS), not O(duration), and an arbitrarily long file waveforms fine.
 *
 * Because getPrimaryAudioTrack reads a video container's soundtrack too, a plain video
 * asset now waveforms through here as well, not just a pure-audio file.
 *
 * Returns null (never throws) when WebCodecs audio is unavailable, the container has no
 * audio track, the codec cannot be decoded here, or mediabunny errors - computePeaks
 * then falls back to the decodeAudioData path. Returns the SAME { peaks, durationSec }
 * shape bucketPeaks/computePeaks produce, so peaks()/windowPeaks downstream is unchanged.
 *
 * mediabunny is loaded lazily and typed loosely here, matching captureFilmstripSink;
 * the strongly-typed provider lives in bridge/sequence-providers.
 */
export async function computePeaksSink(url: string, signal: AbortSignal): Promise<MasterPeaks | null> {
  // WebCodecs is how mediabunny decodes a compressed audio track. A PCM WAV needs no
  // AudioDecoder, but everything else does, so gate the same way the filmstrip sink
  // gates on VideoDecoder and let computePeaks fall back where it is missing.
  if (typeof (globalThis as { AudioDecoder?: unknown }).AudioDecoder === 'undefined') return null;
  if (signal.aborted) return null;
  const n = MASTER_BUCKETS;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let input: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mb: any = await import('mediabunny');
    input = new mb.Input({ formats: audioSinkContainers(mb), source: new mb.UrlSource(url) });
    const track = await input.getPrimaryAudioTrack();
    if (!track) { input.dispose?.(); return null; }          // no soundtrack -> fallback returns null too
    let decodable = false;
    try { decodable = await track.canDecode(); } catch { decodable = false; }
    if (!decodable) { input.dispose?.(); return null; }       // codec not decodable here -> fallback
    const durationSec = await input.computeDuration();
    if (!Number.isFinite(durationSec) || durationSec <= 0) { input.dispose?.(); return null; }
    if (signal.aborted) { input.dispose?.(); return null; }

    // The running peak envelope, filled as buffers arrive. `pos` counts samples seen so
    // far across every buffer; `total` is how many the whole track is expected to hold,
    // fixed once from the duration and the first buffer's sample rate. A bucket index is
    // (pos + j) / total, so a sample maps to a bucket without any whole-file PCM in hand.
    const out = new Float32Array(n);
    let max = 0;
    let pos = 0;
    let total = 0;
    let sawAny = false;

    const sink = new mb.AudioBufferSink(track);
    for await (const wrapped of sink.buffers()) {
      if (signal.aborted) { input.dispose?.(); return null; }
      const buf = wrapped?.buffer;
      if (!buf || !buf.length) continue;
      if (total <= 0) total = Math.max(1, Math.round(durationSec * buf.sampleRate));
      const ch0 = buf.getChannelData(0);
      const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
      const len = ch0.length;
      // Stride-32 sparse scan and (L+R)/2 downmix of at most the first two channels,
      // exactly as bucketPeaks does: a waveform bar shows a peak envelope, so reading
      // every 32nd frame is indistinguishable from reading all of them and far cheaper.
      // A track with more than two channels is read as its first two, which is what
      // bucketPeaks does as well, so no separate downmix is needed here.
      for (let j = 0; j < len; j += 32) {
        const l = ch0[j] ?? 0;
        const r = ch1 ? (ch1[j] ?? 0) : null;
        const v = Math.abs(r === null ? l : (l + r) / 2);
        let bi = Math.floor(((pos + j) / total) * n);
        if (bi < 0) bi = 0; else if (bi >= n) bi = n - 1;   // a slightly-off total only nudges a neighbour
        if (v > (out[bi] as number)) out[bi] = v;
        if (v > max) max = v;
      }
      pos += len;
      sawAny = true;
    }
    input.dispose?.();
    input = null;
    if (!sawAny) return null;                                 // decoded to nothing -> let the caller decide
    // Normalise exactly as bucketPeaks does: the loudest bucket becomes 1.0, a 0.04
    // visual floor keeps a quiet passage drawing a sliver, all-silence stays all-zero.
    if (max > 0) for (let k = 0; k < n; k++) out[k] = Math.max(0.04, (out[k] as number) / max);
    else out.fill(0);
    return { peaks: out, durationSec };
  } catch {
    input?.dispose?.();
    return null;                                              // undecodable / mediabunny error -> fallback
  }
}

/** The procedural-bed scheme (engine/src/zzfxm-ref.ts ZZFXM_SCHEME - a string test
 *  here so this module keeps its zero static imports). */
const isZzfxmUrl = (url: string): boolean => url.startsWith('zzfxm:');

/**
 * Peaks for a PROCEDURAL BED (`zzfxm:<seed>[:<style>]`). Not a file: handing the
 * scheme to UrlSource/fetch produced two console errors per mount and a permanently
 * plain bar - for the one audio source the Video template ships by default. The song
 * is composed and rendered exactly as the export mix and the preview clock do it
 * (same seed→spec draw, same length quantiser), so the waveform drawn is the
 * waveform that plays. Composer + renderer stay behind dynamic imports, keeping this
 * module's zero-static-import discipline and the first-paint graph clean.
 *
 * `durationSec` is the RENDERED length, not the asked-for target - windowPeaks maps
 * window seconds to buckets with it, so it must be the length the samples actually
 * span.
 */
async function computePeaksZzfxm(url: string, wantedSec: number | undefined, signal: AbortSignal): Promise<MasterPeaks | null> {
  try {
    const [{ parseZzfxmRef }, { composeSong, generatedSongSpec }, { zzfxmTargetSec }, { renderSong }] = await Promise.all([
      import('../../../../engine/src/zzfxm-ref.ts'),
      import('../../../../engine/src/zzfx-compose.ts'),
      import('../bridge/sequence-providers.ts'),
      import('./zzfxm-render.ts'),
    ]);
    const ref = parseZzfxmRef(url);
    if (!ref) return null;
    const target = zzfxmTargetSec(wantedSec ?? 0);   // clamps up to the composer's minimum
    const { left, right, sampleRate } = await renderSong(composeSong(generatedSongSpec(ref.seed, target, ref.style)));
    if (signal.aborted || !left.length || !sampleRate) return null;
    return { peaks: bucketPeaks([left, right], MASTER_BUCKETS), durationSec: left.length / sampleRate };
  } catch {
    return null;   // a failed compose degrades to the plain bar, like any undecodable file
  }
}

async function computePeaks(url: string, signal: AbortSignal, wantedSec?: number): Promise<MasterPeaks | null> {
  // Composed, not fetched - see computePeaksZzfxm.
  if (isZzfxmUrl(url)) return computePeaksZzfxm(url, wantedSec, signal);
  // The AudioBufferSink path first: it decodes incrementally, so it has no size ceiling
  // and it reads a video's soundtrack. Only when it declines (no WebCodecs audio, no
  // audio track, an undecodable codec, or a mediabunny error) do we fall back to the
  // decodeAudioData path below, which is bounded by MAX_AUDIO_DECODE_BYTES.
  const viaSink = await computePeaksSink(url, signal);
  if (viaSink) return viaSink;
  if (signal.aborted) return null;
  const ctx = getDecodeCtx();
  if (!ctx || typeof fetch !== 'function') return null;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok || signal.aborted) return null;
    // Refuse before reading the body when the server tells us it is too big.
    const declared = Number(res.headers?.get?.('content-length') ?? Number.NaN);
    if (!withinDecodeBudget(Number.isFinite(declared) ? declared : null)) return null;
    // And bound the read itself, so a chunked/unlabelled response is abandoned at the
    // ceiling instead of being buffered whole and refused afterwards.
    const buf = await readBounded(res, MAX_AUDIO_DECODE_BYTES, signal);
    if (!buf || signal.aborted) return null;
    if (!withinDecodeBudget(buf.byteLength)) return null;
    const audio = await decode(ctx, buf);
    if (signal.aborted) return null;
    const channels: Float32Array[] = [audio.getChannelData(0)];
    if (audio.numberOfChannels > 1) channels.push(audio.getChannelData(1));
    return { peaks: bucketPeaks(channels, MASTER_BUCKETS), durationSec: audio.duration };
  } catch {
    return null; // undecodable / offline / aborted - the bar keeps its plain fill
  }
}

/**
 * Peak envelope (0..1 per bucket) for a waveform bar.
 *
 * Works on a pure-audio asset AND on a video's soundtrack: the primary path
 * (computePeaksSink) reads whichever the container's primary audio track is. It decodes
 * incrementally through mediabunny's AudioBufferSink, so there is no size ceiling on the
 * asset it can waveform. Only the decodeAudioData fallback (taken where WebCodecs audio
 * is unavailable) is still bounded by MAX_AUDIO_DECODE_BYTES.
 *
 * Resolves an EMPTY Float32Array - never throws - when the asset is undecodable,
 * aborted, or neither decode path is available. The returned array is owned by this
 * module's cache: do not mutate it.
 */
export function peaks(
  audioUrl: string,
  buckets: number,
  signal?: AbortSignal,
  win?: { fromSec?: number; toSec?: number },
): Promise<Float32Array> {
  if (!audioUrl) return Promise.resolve(EMPTY_PEAKS);
  // Read the original directly. The AudioBufferSink path (computePeaksSink) decodes it,
  // which lifts the MAX_AUDIO_DECODE_BYTES ceiling and waveforms a video's soundtrack
  // too; the decodeAudioData fallback reads the same url. No scrub proxy is involved.
  const url = audioUrl;
  const key = peaksKey(url);
  const shape = (m: MasterPeaks): Float32Array =>
    windowPeaks(m.peaks, m.durationSec, win?.fromSec ?? 0, win?.toSec ?? m.durationSec, buckets);

  const hit = cache.get(key);
  if (hit && !Array.isArray(hit) && !(hit instanceof Float32Array)) {
    // A procedural bed is COMPOSED to a length rather than decoded from a file, so a
    // cached master can genuinely be shorter than the window now asked for (the box
    // was dragged longer). Fall through and re-compose; files keep the plain hit.
    if (!isZzfxmUrl(url) || hit.durationSec >= (win?.toSec ?? 0)) return Promise.resolve(shape(hit));
  }

  return share<Float32Array>(
    key,
    async (runSignal) => {
      const master = await computePeaks(url, runSignal, win?.toSec);
      if (!master || !master.peaks.length) return EMPTY_PEAKS;
      cache.set(key, master);
      return shape(master);
    },
    signal,
    EMPTY_PEAKS,
  );
}
