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
  /** v1.262. `clip` (the default) writes media. `poster` writes the frame at `start` as
   *  an image. `contact-sheet` writes one image of frames spread across the range. */
  output?: 'clip' | 'poster' | 'contact-sheet';
  /** v1.262. Image format for a poster or contact sheet; `jpeg` when absent. */
  image?: 'jpeg' | 'png';
  /** v1.262. Frames on a contact sheet, clamped to 4..36; 12 when absent. */
  sheetFrames?: number;
  /** v1.262. Turn the picture clockwise by this many degrees, on top of the source's
   *  own orientation. */
  rotate?: 0 | 90 | 180 | 270;
  /** v1.262. `exact` (the default) re-encodes the picture when `start` falls between key
   *  frames. `keyframe` copies from the key frame at or before `start` instead, so the
   *  clip can begin earlier than asked. */
  cut?: 'exact' | 'keyframe';
  /** v1.262. Largest shorter edge, in pixels, for a sharing copy. Never enlarges; 0 or
   *  absent keeps the source size. */
  maxShortEdge?: number;
  /** v1.262. Aim for a file of at most this many bytes by re-encoding at a computed
   *  bitrate. Applies to a clip that keeps its picture; the result reports whether the
   *  written file met the target. */
  targetBytes?: number;
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
  /** v1.262. What the shell did to each track and what it checked on the written
   *  bytes. Older shells leave the report out. */
  report?: MediaTrimReport;
}

/** Why a track was re-encoded or left out. Stable codes; a tool words them. */
export type MediaTrimReason =
  | 'cut-between-key-frames'
  | 'codec-not-in-container'
  | 'format-requested'
  | 'rotation-needs-pixels'
  | 'resize'
  | 'target-size'
  | 'container-timing'
  | 'removed-by-request'
  | 'not-primary';

/** One source track and the action taken on the track. */
export interface MediaTrimTrackReport {
  kind: 'video' | 'audio' | 'other';
  /** The source codec, or null when the container does not say. */
  codec: string | null;
  /** The written codec, or null when the track was left out. */
  outputCodec: string | null;
  /** `copy` means the written packets are byte-identical to the source's. */
  action: 'copy' | 're-encode' | 'drop';
  reasons: MediaTrimReason[];
}

/** Sound against picture, measured on the written file and on the source range. Skews
 *  are seconds the sound starts or ends after the picture; negative means before. */
export interface MediaSyncCheck {
  startSkew: number;
  expectedStartSkew: number;
  endSkew: number;
  expectedEndSkew: number;
  /** One video frame or one audio packet, whichever is longer. */
  tolerance: number;
  /** `packets` when both tracks were copied and matched packet for packet; `ranges`
   *  when a re-encoded track was compared by its start and end times. */
  method: 'packets' | 'ranges';
  ok: boolean;
}

/** Which way up the written picture is, against what was asked for. */
export interface MediaOrientationCheck {
  requested: 0 | 90 | 180 | 270;
  sourceRotation: number;
  outputRotation: number;
  /** `flag`: the container's orientation value was set and the pixels were not touched.
   *  `pixels`: the turn was drawn into the picture. `none`: nothing was asked for. */
  method: 'flag' | 'pixels' | 'none';
  width: number;
  height: number;
  expectedWidth: number;
  expectedHeight: number;
  ok: boolean;
}

/** The declared colour information of the picture before and after. */
export interface MediaColorCheck {
  /** A short label such as `bt709` or `bt2020 pq`, or null when nothing is declared. */
  source: string | null;
  output: string | null;
  kept: boolean;
}

export interface MediaTrimReport {
  /** `frames` for a poster, contact sheet or GIF drawn from decoded frames. */
  method: 'copy' | 're-encode' | 'mixed' | 'frames';
  requestedStart: number;
  /** Where the written media begins in source time. Earlier than `requestedStart` after
   *  a key frame cut, or by less than a frame when the start was snapped to its key
   *  frame. */
  actualStart: number;
  /** Seconds from the key frame at or before `requestedStart` to `requestedStart`. */
  keyFrameGap: number;
  tracks: MediaTrimTrackReport[];
  sync?: MediaSyncCheck;
  orientation?: MediaOrientationCheck;
  color?: MediaColorCheck;
  /** Displayed size of the written picture or image. */
  size?: { width: number; height: number };
  target?: { bytes: number; met: boolean; attempts: number };
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
