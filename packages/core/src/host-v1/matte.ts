// SPDX-License-Identifier: MPL-2.0

// ─── On-device background removal / matting (optional, v1.103) ─────────────────

/**
 * A plain 8-bit RGBA pixel frame handed to / returned from `host.matte` - the
 * same shape a canvas `getImageData` gives and `putImageData` takes, so a tool
 * never touches a tensor. On the way IN alpha is ignored (the model sees RGB); on
 * the way OUT the RGB is BYTE-FOR-BYTE the input's and the alpha is the computed
 * matte (straight, un-premultiplied) - a cutout you can composite directly.
 */
export interface MatteFrame {
  width: number;
  height: number;
  /** RGBA interleaved, 8-bit, straight alpha, length = width * height * 4. */
  data: Uint8ClampedArray;
}

/**
 * A `host.matte` model an id can select - see `MatteAPI.models`. A small
 * general-purpose saliency net (`u2netp`, the default) and a portrait specialist
 * (`modnet`). All ship under permissive licences (Apache-2.0 / MIT); the roster is
 * deliberately free of the popular non-commercial models (BRIA RMBG et al.).
 *
 * The roster NARROWS over time (`isnet-general` retired 2026-08-05, the BiRefNet
 * pair 2026-08-26), so an id is not a promise: read `models()` rather than
 * hard-coding one, and expect a shell to fall back to its default for an id it no
 * longer carries rather than fail the run.
 */
export type MatteModelId = 'u2netp' | 'modnet';

/**
 * One entry in the on-device matte catalogue. `license` + `attribution` carry the
 * model's real obligation (permissive-licence notice, surfaced in credits);
 * `version` appears verbatim in the C2PA edit step ("Background removed with <name>
 * <version>"). `tier` orders the picker: fast preview → general → pro edges.
 */
export interface MatteModelInfo {
  id: MatteModelId;
  /** Human name for the picker, e.g. "U²-Net lite". */
  name: string;
  /** Ordering + intent for the picker. */
  tier: 'fast' | 'default' | 'pro';
  /** Approximate one-time download in bytes, for the consent UI + offline manager. */
  approxBytes: number;
  /** SPDX id, e.g. 'Apache-2.0' | 'MIT'. Surfaced in credits + the edit step. */
  license: string;
  /** Copyright / notice line to carry in the app's credits (the licence obligation). */
  attribution: string;
  /** Model release string; copied verbatim into the C2PA edit step. */
  version: string;
  /** One-line quality/latency note the picker shows beside the option. */
  note?: string;
}

export interface MatteProgress {
  phase: 'download' | 'inference';
  /** Bytes so far (download phase). */
  loaded?: number;
  /** Total bytes, or null when the transport doesn't say. */
  total?: number | null;
  /** 0..1 where a fraction is knowable. */
  fraction?: number;
}

export interface MatteOpts {
  /** A `MatteModelId`; defaults to the general model. */
  model?: MatteModelId;
  /**
   * Hard cap on the OUTPUT's longest edge in pixels - the device/user lever. The
   * matte net runs at its own fixed input size regardless, so this only bounds the
   * full-resolution alpha buffer the mask is scaled back into (a phone need not
   * allocate a 8000px cutout). Absent ⇒ the source's own size.
   */
  maxEdge?: number;
  /**
   * Abort a long run: the promise rejects promptly (AbortError). Aborting during
   * the first-use download rejects promptly but the download completes in the
   * background and is cached (like `upscale`/`speech`).
   */
  signal?: AbortSignal;
  onProgress?: (p: MatteProgress) => void;
}

/**
 * The honest answer to "can THIS device do THIS job?" before any bytes move (see
 * `MatteAPI.canRun`). When `ok` is false the shell says so plainly and offers the
 * concrete lever rather than attempting the run and crashing.
 */
export interface MatteFeasibility {
  ok: boolean;
  reason?: 'memory' | 'no-backend' | 'too-large';
  /** Plain, non-blaming copy the shell can show as-is. */
  message?: string;
  /** A longest-edge that WOULD fit, when the ask was too big. */
  suggestedMaxEdge?: number;
  /** A lighter model that would fit, when the chosen one won't. */
  suggestedModel?: MatteModelId;
}

/**
 * On-device background removal (see `HostV1.matte`). A plain RGBA frame in, the
 * same frame with a model-computed alpha matte out - the shell owns the ONNX
 * runtime, the WebGPU→WASM backend, the one-time (consented - see `modelBytes`)
 * download and the memory bound; the tool only ever sees pixels. The output's RGB
 * is the input's, untouched; only the alpha is new. All async methods reject
 * rather than half-produce; failures degrade to an honest message, never a stuck
 * spinner.
 */
export interface MatteAPI {
  /** Whether this shell can matte at all (a backend + Worker exist). Sync. */
  isAvailable(): boolean;
  /** The resolved execution backend, or null before one is probed / when none. */
  backend(): 'webgpu' | 'wasm' | null;
  /** The model catalogue - ids, tiers, sizes, licences. Sync + static. */
  models(): MatteModelInfo[];
  /** Approximate one-time download for a model, for a consent UI. Sync. */
  modelBytes(id: MatteModelId): number;
  /** Are a model's bytes already on-device? Never downloads. */
  cached(id: MatteModelId): Promise<boolean>;
  /** Honest feasibility of a job on this device, before any bytes move. */
  canRun(src: { width: number; height: number }, opts?: MatteOpts): Promise<MatteFeasibility>;
  /** Cut out the subject. Rejects (AbortError) on `opts.signal`; never half-produces. */
  run(frame: MatteFrame, opts?: MatteOpts): Promise<MatteFrame>;
}
