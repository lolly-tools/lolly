// SPDX-License-Identifier: MPL-2.0

// ─── Live media (optional) ─────────────────────────────────────────────────────

export interface MediaAPI {
  /**
   * Whether a camera is usable right now (a secure context exposing
   * getUserMedia). Sync + cheap - the shell uses it to decide whether to offer a
   * "live" affordance. A `true` here does not pre-grant permission; the prompt
   * happens on start().
   */
  isAvailable(): boolean;

  /**
   * Begin the camera and the frame loop (prompting for permission the first time).
   * Resolves once frames are flowing; rejects if the user denies or there's no
   * camera. Reference-counted + idempotent: concurrent callers share one stream,
   * and the camera stops only when the matching number of stop() calls arrive.
   * `opts.facingMode` (v1.21) prefers the front ('user', default) or rear ('environment')
   * camera; honoured only when this start() actually creates the stream (a shared stream
   * keeps its original camera, so a flip is stop() then start()).
   */
  start(opts?: { facingMode?: 'user' | 'environment' }): Promise<void>;

  /** Release one start() reference; the camera + loop stop when the last is released. */
  stop(): void;

  /**
   * Subscribe to camera frames. The callback receives a MediaFrame whose `data`
   * is valid only for the synchronous duration of the call (the shell may reuse or
   * release the buffer afterwards), so read the pixels synchronously. Returns an
   * unsubscribe function. Frames flow only while the camera is start()ed, are
   * throttled by the shell, and pause while the document is hidden.
   *
   * `opts.maxEdge` (added v1.4, optional) requests the working frame's longest edge
   * in pixels: the shell downscales the source camera frame to a small default that
   * suits a vector trace, but a raster-output tool (whose result is a bitmap, not
   * traced shapes) can ask for more for sharper output. The shell clamps the request
   * to the native camera frame (never upscales) and to its own ceiling, and - when
   * several tools are live - uses the largest requested edge. The runtime forwards a
   * tool's `render.liveMaxEdge` manifest hint here. A shell predating this opt simply
   * ignores it and keeps its default size.
   */
  subscribe(cb: (frame: MediaFrame) => void, opts?: { maxEdge?: number }): () => void;

  /** Trim or remux an uploaded media file using this shell's local codecs. */
  trim?(bytes: Uint8Array, opts: MediaTrimOpts): Promise<MediaTrimResult>;
}

export interface MediaTrimOpts {
  start?: number;
  end?: number;
  container?: 'keep' | 'mp4' | 'webm' | 'gif';
  mute?: boolean;
  audioOnly?: false | 'm4a' | 'opus' | 'wav';
  sourceName?: string;
  sourceMime?: string;
}

export interface MediaTrimResult {
  bytes: Uint8Array;
  mime: string;
  container: string;
  durationBefore: number;
  durationAfter: number;
  lossless: boolean;
  /** Present when the source exposes a count cheaply. */
  frameCount?: number;
  /** Present when the source exposes a decoded sample count cheaply. */
  audioSampleCount?: number;
}

/** One camera frame as raw RGBA pixels - DOM-free, so the engine can pass it to a hook. */
export interface MediaFrame {
  /** Frame width in pixels (the shell may downscale the source for performance). */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Tightly-packed RGBA bytes, length width*height*4 (as from CanvasRenderingContext2D.getImageData). */
  data: Uint8ClampedArray;
  /** Monotonic timestamp (ms) of the grab, for a tool that wants frame timing. */
  t: number;
}
