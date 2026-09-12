// SPDX-License-Identifier: MPL-2.0
/**
 * On-device MONOCULAR DEPTH - the PURE catalogue half (plans/160 WP-A), the
 * structural twin of lib/matte-models.ts and lib/upscale-models.ts.
 *
 * Constants only: the model list, its on-disk file name, the IndexedDB cache
 * coordinates, the tensor descriptor the runner needs, and the size/cache-key
 * helpers. NO onnxruntime, NO DOM, NO IndexedDB - safe to import from the main
 * thread (lib/depth-job.ts) or the worker (lib/depth-worker.ts) without dragging
 * the multi-MB runtime into the boot budget.
 *
 * DELIBERATELY NOT A HostV1 SURFACE. Spatial-photo is the only consumer, and it
 * reaches this the way the matte/upscale consumers do - a browser-realm lib, not
 * a bridge method. A `host.depth` API is only worth an engine minor once a second
 * consumer appears (darkroom relighting is the obvious candidate); until then a
 * bridge method would be contract surface with one caller. So DepthModelId and
 * DepthModelInfo live here rather than in packages/core.
 *
 * The file name and cache coordinates are a PINNED CONTRACT shared with whatever
 * publishes the weights to `${MODELS_BASE}/models/depth/<file>`: change a name
 * here and the cache miss goes silent.
 *
 * WHY IT LIVES IN packages/node-shell (moved 2026-09-03, plans/183 WS2):
 * monocular depth now runs on BOTH the web shell (onnxruntime-web in a Worker)
 * and the Node shells (onnxruntime-node, packages/node-shell/src/ml/). A
 * roster that existed twice would let `models()` and `modelBytes()` answer
 * differently on the two shells, which is exactly the drift the contract
 * forbids. This shared package is the only place both can import from (no shell
 * may import from another), so the constants live here and shells/web/src/lib/depth-models.ts re-exports them unchanged - the
 * same move net.ts and pptx.ts made.
 */

/** The depth models this build knows about. A permanent contract id, like a tool id. */
export type DepthModelId = 'depth-anything-v2-small';

/** Picker/consent metadata. The local twin of MatteModelInfo - see the header for
 *  why this is not a packages/core type. */
export interface DepthModelInfo {
  id: DepthModelId;
  name: string;
  tier: 'fast' | 'default' | 'pro';
  /** One-time download size, for the consent prompt + the offline manager. */
  approxBytes: number;
  /** SPDX id. Permissive only - the staging gate refuses anything else. */
  license: string;
  attribution: string;
  /** Copied verbatim into the consumer's C2PA edit-step description. */
  version: string;
  note?: string;
}

// ── The data types (here, not in the worker, so the main thread can name them
//    without a value-import that would drag onnxruntime into the boot chunk) ──

/** A decoded source image: tightly-packed straight-alpha RGBA, what getImageData
 *  yields. The same shape as MatteFrame/MediaFrame minus the timestamp. */
export interface DepthFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** A computed depth map at the WORK resolution. `data` is row-major, one float
 *  per pixel, NORMALISED to 0..1 where **1 is nearest** (see DepthModelSpec's
 *  `output`). Relative depth: the units are the picture's own, not metres. */
export interface DepthMap {
  width: number;
  height: number;
  data: Float32Array;
}

/** Progress from a run. Mirrors MatteProgress so the job driver's bytes→percent
 *  conversion is the same code shape. */
export interface DepthProgress {
  phase: 'download' | 'inference';
  loaded?: number;
  total?: number | null;
  fraction?: number;
}

export interface DepthOpts {
  model?: DepthModelId;
  /** Longest edge of the working image. Defaults to DEPTH_MAX_WORK_EDGE. */
  maxEdge?: number;
  signal?: AbortSignal;
  onProgress?: (p: DepthProgress) => void;
}

// ── Cache coordinates ────────────────────────────────────────────────────────

/** IndexedDB object store holding the cached model bytes (see bridge/db.ts). */
export const DEPTH_MODEL_STORE = 'depth-models';
/** URL directory under `/models/` the bytes are fetched from. */
export const DEPTH_MODEL_DIR = 'depth';
/** Bump to invalidate every cached entry (a requantised model, or a poisoned
 *  cache - the HTML-response guard in createModelFetcher). */
export const DEPTH_MODEL_CACHE_VERSION = 2;

/** The weights file for each model, under `/models/depth/`. */
export const DEPTH_MODEL_FILES: Record<DepthModelId, string> = {
  'depth-anything-v2-small': 'depth-anything-v2-small.onnx',
};

export const DEPTH_DEFAULT_MODEL: DepthModelId = 'depth-anything-v2-small';

// ── The catalogue ────────────────────────────────────────────────────────────
//
// Depth Anything V2 **Small** specifically: the Base and Large checkpoints are
// CC-BY-NC-4.0 (non-commercial), which disqualifies them here the same way BRIA
// RMBG is disqualified from the matte roster. Only the Small head is Apache-2.0.

export const DEPTH_MODELS: DepthModelInfo[] = [
  {
    id: 'depth-anything-v2-small',
    name: 'Depth Anything V2 small',
    tier: 'default',
    // Verified SHA-256 and exact byte length: model-pins.ts.
    approxBytes: 27_258_801,
    license: 'Apache-2.0',
    attribution: 'Depth Anything V2 © 2024 Lihe Yang et al. (Apache-2.0)',
    version: 'v2-small',
    note: 'Relative depth from a single photo, on device. Quantised for size; ~518px input.',
  },
];

/** Approximate one-time download per model. Derived from DEPTH_MODELS so the two
 *  can never drift. */
export const DEPTH_MODEL_BYTES: Record<DepthModelId, number> = DEPTH_MODELS.reduce(
  (acc, m) => { acc[m.id] = m.approxBytes; return acc; },
  {} as Record<DepthModelId, number>,
);

// ── The tensor descriptor (runner contract) ──────────────────────────────────
//
// As with MATTE_MODEL_SPEC, a wrong value here does NOT crash - it silently
// degrades the depth map, which then silently degrades the parallax. Every field
// must be confirmed against the published ONNX graph + its preprocessor config
// before DEPTH_STAGED flips.

export interface DepthModelSpec {
  /** Target model input [height, width]; aspect-preserving inputs are dynamic. */
  inputSize: [number, number];
  /** Per-channel mean subtracted after the /255 scale (RGB order). */
  mean: [number, number, number];
  /** Per-channel std divided after the mean subtraction (RGB order). */
  std: [number, number, number];
  /** Keep the source aspect, round to /14 patches, and avoid padding. */
  fit: 'aspect' | 'stretch';
  /**
   * What the single output channel means.
   *  'inverse' - relative INVERSE depth (disparity): larger = NEARER. Depth
   *    Anything's head. The runner min-max normalises it to 0..1 where 1 is
   *    nearest, which is also the sign the displacement render wants.
   */
  output: 'inverse';
}

const IMAGENET_MEAN: [number, number, number] = [0.485, 0.456, 0.406];
const IMAGENET_STD: [number, number, number] = [0.229, 0.224, 0.225];

export const DEPTH_MODEL_SPEC: Record<DepthModelId, DepthModelSpec> = {
  'depth-anything-v2-small': {
    // 518 = 37×14; the ViT-S/14 backbone needs a multiple of 14.
    inputSize: [518, 518],
    mean: IMAGENET_MEAN,
    std: IMAGENET_STD,
    fit: 'aspect',
    output: 'inverse',
  },
};

// ── Which weights are actually published for THIS build ──────────────────────
//
// A build fact, not a device fact (mirrors MATTE_STAGED): a model is offered only
// once its weights are published to the models host with a verified pin AND its
// licence has been re-confirmed from a primary source. Until then, offering it
// would promise a one-time download that can never complete.

/** Verified graph and weights included in this build's models-host manifest.
 * Deploy that manifest's files together with this build. */
export const DEPTH_STAGED: Record<DepthModelId, boolean> = {
  'depth-anything-v2-small': true,
};

/** The models actually runnable in this build - what a picker should OFFER.
 *  Availability of the bytes at runtime is still checked by the model fetcher. */
export function stagedDepthModels(): DepthModelInfo[] {
  return DEPTH_MODELS.filter((m) => DEPTH_STAGED[m.id]);
}

/** The catalogue entry for an id, or undefined. Looks up the FULL catalogue
 *  (incl. unstaged) so an id round-trips even for a withheld model. */
export function depthModel(id: DepthModelId): DepthModelInfo | undefined {
  return DEPTH_MODELS.find((m) => m.id === id);
}

/**
 * The depth files an "Available offline" download vendors - the same list the
 * picker would offer, so the size shown and the bytes fetched can never disagree
 * (matteOfflineFiles' rule). The web model-prefetch and offline-manager modules
 * consume this list; the depth map cache is separate in derived-media.
 */
export function depthOfflineFiles(): string[] {
  return stagedDepthModels().map((m) => DEPTH_MODEL_FILES[m.id]);
}

// ── Working size ─────────────────────────────────────────────────────────────

/**
 * Longest edge of the WORKING image, before inference and before the render.
 * iOS memory is the constraint that sets this, not quality: the model sees a
 * roughly 518px along the target edge, so anything above this buys nothing and a 48MP phone
 * photo decoded at full size is what actually kills the tab.
 */
export const DEPTH_MAX_WORK_EDGE = 2048;

/** Fit w×h inside a `maxEdge` box preserving aspect. Never upscales, never
 *  returns a zero dimension. */
export function planWorkSize(
  w: number, h: number, maxEdge: number = DEPTH_MAX_WORK_EDGE,
): { width: number; height: number } {
  const longEdge = Math.max(w, h);
  if (!(longEdge > maxEdge) || !(maxEdge > 0)) return { width: Math.max(1, w), height: Math.max(1, h) };
  const scale = maxEdge / longEdge;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

// ── Result cache key ─────────────────────────────────────────────────────────

/**
 * The cache key for one computed depth map: (image checksum, model id).
 *
 * The model id is IN the key on purpose - a requantised or replaced model must
 * re-infer rather than silently mix maps from two different models into one
 * shared link. `DEPTH_MODEL_CACHE_VERSION` rides along for the same reason.
 *
 * The `depth:` prefix namespaces it inside the shared 'derived-media' store,
 * which is where a derived, evictable, regenerable-from-a-user-asset artefact
 * belongs (bridge/db.ts). The DEPTH MAP ITSELF NEVER TRAVELS IN A URL - a shared
 * link carries the photo ref and the camera params, and the recipient either
 * hits this cache or re-infers.
 */
export function depthCacheKey(checksum: string, model: DepthModelId): string {
  return `depth:${DEPTH_MODEL_CACHE_VERSION}:${model}:${checksum}`;
}
