// SPDX-License-Identifier: MPL-2.0

// ─── On-device AI upscaling (optional, v1.101) ────────────────────────────────

/**
 * A plain 8-bit RGBA pixel frame handed to / returned from `host.upscale` -
 * straight (un-premultiplied) alpha, exactly what a canvas `getImageData` gives
 * and `putImageData` takes, so a tool never has to touch a tensor. DOM-free: the
 * shell owns the model runtime; the contract only ever sees typed arrays.
 */
export interface UpscaleFrame {
  width: number;
  height: number;
  /** RGBA interleaved, 8-bit, straight alpha, length = width * height * 4. */
  data: Uint8ClampedArray;
}

/** A `host.upscale` model an id can select - see `UpscaleAPI.models`. Two general
 *  Real-ESRGAN nets (fast + quality), an illustration/line-art net
 *  (`realesrgan-x4plus-anime`, the 6-block anime model) and a face restorer. */
export type UpscaleModelId =
  | 'realesr-general-x4v3'
  | 'realesrgan-x4plus'
  | 'realesrgan-x4plus-anime'
  | 'gfpgan-v1.4';

/**
 * One entry in the on-device model catalogue. `license` + `attribution` are not
 * decoration: the models ship under permissive licences (BSD-3-Clause,
 * Apache-2.0) whose one real obligation is carrying their copyright/notice, so a
 * shell surfaces them in its credits (a "Larger Work" under those terms).
 * `version` is the model release string and appears verbatim in the C2PA
 * disclosure ("AI-upscaled with <name> <version>").
 */
export interface UpscaleModelInfo {
  id: UpscaleModelId;
  /** Human name for the picker, e.g. "Real-ESRGAN general (fast)". */
  name: string;
  /** Native output multiple. */
  scale: 2 | 4;
  /** Approximate one-time download in bytes, for the consent UI + offline manager. */
  approxBytes: number;
  /** SPDX id, e.g. 'BSD-3-Clause' | 'Apache-2.0'. Surfaced in credits + disclosure. */
  license: string;
  /** Copyright / notice line to carry in the app's credits (the licence obligation). */
  attribution: string;
  /** Model release string; copied verbatim into the C2PA disclosure. */
  version: string;
  /**
   * A face RESTORER (GFPGAN) rather than a plain resolution enhancer - it can
   * synthesise facial detail that was never in the source. The shell shows this
   * string beside the option; for GFPGAN it reads exactly
   * "warning can invent face details".
   */
  warning?: string;
  /** True when the model only restores aligned face crops (needs the face path). */
  facesOnly?: boolean;
}

export interface UpscaleProgress {
  phase: 'download' | 'inference';
  /** Bytes so far (download phase). */
  loaded?: number;
  /** Total bytes, or null when the transport doesn't say. */
  total?: number | null;
  /** Tile index / count (inference phase) - the run is tiled to bound memory. */
  tile?: number;
  tiles?: number;
  /** 0..1 where a fraction is knowable. */
  fraction?: number;
}

export interface UpscaleOpts {
  /** A `UpscaleModelId`; defaults to the general fast model. */
  model?: UpscaleModelId;
  /** Target output multiple; clamped to what the model + device allow. */
  scale?: 2 | 4;
  /** 0..1 denoise strength (general model only - blends its WDN pair). */
  denoise?: number;
  /**
   * Hard cap on the output's longest edge in pixels - the device/user lever. The
   * run trims its plan to honour it, so a phone never attempts a 6000px master.
   */
  targetMaxEdge?: number;
  /**
   * Abort a long run: the promise rejects promptly (AbortError) at the next tile
   * boundary. Aborting during the first-use download rejects promptly but the
   * download completes in the background and is cached (like `speech`).
   */
  signal?: AbortSignal;
  onProgress?: (p: UpscaleProgress) => void;
}

/**
 * The honest answer to "can THIS device do THIS job?" - computed before any bytes
 * move (see `UpscaleAPI.canRun`). When `ok` is false the shell tells the user
 * plainly and offers the concrete lever (`suggestedMaxEdge` / `suggestedModel`)
 * rather than attempting the run and crashing.
 */
export interface UpscaleFeasibility {
  ok: boolean;
  /** Why not, when `ok` is false. */
  reason?: 'memory' | 'no-backend' | 'too-large';
  /** Plain, non-blaming copy the shell can show as-is. */
  message?: string;
  /** A longest-edge that WOULD fit, when the ask was too big. */
  suggestedMaxEdge?: number;
  /** A lighter model that would fit, when the chosen one won't. */
  suggestedModel?: UpscaleModelId;
}

/**
 * On-device AI image upscaling (see `HostV1.upscale`). A plain RGBA frame in, a
 * larger RGBA frame out - the shell owns the ONNX runtime, the WebGPU→WASM
 * backend choice, the one-time (consented - see `modelBytes`) model download, and
 * the memory-bounded tiling; the engine/tool only ever sees pixels.
 *
 * The heavy run is NOT driven from a tool hook (hooks are time-boxed and their
 * late results discarded): a shell surfaces this through an explicit,
 * progress-bearing, cancellable affordance whose result becomes an asset. All
 * async methods reject rather than half-produce; failures degrade to an honest
 * message, never a stuck spinner.
 */
export interface UpscaleAPI {
  /** Whether this shell can upscale at all (a backend + Worker exist). Sync. */
  isAvailable(): boolean;
  /** The resolved execution backend, or null before one is probed / when none. */
  backend(): 'webgpu' | 'wasm' | null;
  /** The model catalogue - ids, sizes, licences, warnings. Sync + static. */
  models(): UpscaleModelInfo[];
  /** Approximate one-time download for a model, for a consent UI. Sync. */
  modelBytes(id: UpscaleModelId): number;
  /** Are a model's bytes already on-device? Never downloads. */
  cached(id: UpscaleModelId): Promise<boolean>;
  /** Honest feasibility of a job on this device, before any bytes move. */
  canRun(src: { width: number; height: number }, opts?: UpscaleOpts): Promise<UpscaleFeasibility>;
  /** Upscale a frame. Rejects (AbortError) on `opts.signal`; never half-produces. */
  run(frame: UpscaleFrame, opts?: UpscaleOpts): Promise<UpscaleFrame>;
}
