// SPDX-License-Identifier: MPL-2.0
/**
 * Web implementation of the `media` capability — a live camera frame source
 * (engine bridge v1.4). The runtime drives a tool's `onFrame` hook from these
 * frames so a tool (e.g. a filter) can react to motion.
 *
 * The whole MediaStream / <video> / grab-loop lives HERE, in the shell — the engine
 * only ever sees plain RGBA pixel frames, so it stays DOM-free (mirrors how capture
 * keeps its browser engine in the shell). Pixels are read on the device and never
 * leave it; the only consumer is the in-page filter.
 *
 * Performance + privacy:
 *   - Frames are downscaled to a working size (a halftone/scanline trace doesn't
 *     need 720p) and throttled to ~MAX_FPS so the per-frame vector trace keeps up.
 *   - The grab loop pauses while the document is hidden (don't read the camera in a
 *     backgrounded tab), and the camera is fully released when the last start() is
 *     balanced by a stop().
 */

// Default cap for the working frame's longest edge — plenty for a dot/line vector
// trace, and keeps getImageData + the downstream trace cheap. A subscriber can ask
// for more (subscribe opts.maxEdge) when its output is a bitmap rather than a vector
// trace — e.g. filter-pixel-stretch — and the grab loop produces frames at the
// largest size any live subscriber requested (clamped to the native frame).
const DEFAULT_MAX_EDGE = 480;
const MAX_EDGE_CAP = 1920; // ceiling so a tool can't request an absurd working frame
const MAX_FPS = 30;
const MIN_INTERVAL = 1000 / MAX_FPS;

import type { MediaAPI, MediaFrame } from '../../../../engine/src/bridge/host-v1.ts';

type FrameCallback = (frame: MediaFrame) => void;

export function createMediaAPI(): MediaAPI {
  let stream: MediaStream | null = null;
  let videoEl: HTMLVideoElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let rafId = 0;
  let refcount = 0;
  let starting: Promise<void> | null = null; // in-flight start() promise (so concurrent starts share one stream)
  let lastGrab = 0;
  const subscribers = new Map<FrameCallback, number>(); // cb → requested maxEdge

  const isAvailable = (): boolean =>
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  function teardown(): void {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (videoEl) { try { videoEl.pause(); } catch { /* ignore */ } videoEl.srcObject = null; videoEl = null; }
    if (stream) { stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } }); stream = null; }
    canvas = null; ctx = null;
    lastGrab = 0;
  }

  function grab(now: number): void {
    if (!videoEl || !stream || !canvas || !ctx || subscribers.size === 0) return;
    // Don't read the camera while backgrounded (privacy + perf).
    if (typeof document !== 'undefined' && document.hidden) return;
    const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
    if (!vw || !vh) return; // stream not yet producing frames
    // Working size = the largest edge any live subscriber asked for (a raster tool
    // wants more than a vector trace), clamped to the native frame so we never upscale.
    let want = DEFAULT_MAX_EDGE;
    for (const e of subscribers.values()) if (e > want) want = e;
    const scale = Math.min(1, want / Math.max(vw, vh));
    const cw = Math.max(1, Math.round(vw * scale));
    const ch = Math.max(1, Math.round(vh * scale));
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    try {
      ctx.drawImage(videoEl, 0, 0, cw, ch);
      const img = ctx.getImageData(0, 0, cw, ch);
      const frame: MediaFrame = { width: cw, height: ch, data: img.data, t: now };
      // Snapshot the keys so a subscriber that unsubscribes mid-iteration is safe.
      for (const cb of [...subscribers.keys()]) {
        try { cb(frame); } catch { /* one bad subscriber must not kill the loop */ }
      }
    } catch { /* tainted canvas etc. — skip this frame */ }
  }

  function loop(now: number): void {
    if (!stream) return; // torn down
    const t = now ?? 0;
    if (t - lastGrab >= MIN_INTERVAL) { lastGrab = t; grab(t); }
    rafId = requestAnimationFrame(loop);
  }

  async function start(): Promise<void> {
    refcount++;
    if (stream) return;            // already running
    if (starting) return starting; // a concurrent start is bringing the camera up
    starting = (async () => {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stream = s;
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.srcObject = s;
      // Kick playback but DON'T await it: a detached <video> (and autoplay policies)
      // can leave play() pending indefinitely, and the grab loop already waits for the
      // first frame (it no-ops until videoWidth is set). So start() resolves as soon as
      // the stream + loop are wired, not when the first frame decodes.
      videoEl.play().catch(() => { /* autoplay blocked — frames still arrive via the loop */ });
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      rafId = requestAnimationFrame(loop);
    })();
    try {
      await starting;
    } catch (e) {
      // Failed to come up — undo this reference and surface the error to the caller.
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

  function subscribe(cb: FrameCallback, opts?: { maxEdge?: number }): () => void {
    const want = Math.max(1, Math.min(MAX_EDGE_CAP, Math.round(Number(opts?.maxEdge) || DEFAULT_MAX_EDGE)));
    subscribers.set(cb, want);
    return () => { subscribers.delete(cb); };
  }

  return { isAvailable, start, stop, subscribe };
}
