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
 * forbids. The parent repo is the only place both can import from (shells/web
 * and shells/cli are separately versioned submodules), so the constants live
 * here and shells/web/src/lib/depth-models.ts re-exports them unchanged - the
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
export const DEPTH_MODEL_CACHE_VERSION = 1;

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
    // RESEARCH-SOURCED AND UNVERIFIED - nobody has weighed the published file yet.
    // Reconcile with the real byte length in the SAME change that flips DEPTH_STAGED.
    approxBytes: 25_000_000,
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
  /** Fixed model input [height, width]. */
  inputSize: [number, number];
  /** Per-channel mean subtracted after the /255 scale (RGB order). */
  mean: [number, number, number];
  /** Per-channel std divided after the mean subtraction (RGB order). */
  std: [number, number, number];
  /**
   * How the source is fitted to inputSize.
   *  'stretch' - resized to the square ignoring aspect (what the DPT image
   *    processor does by default), so no padding enters the field. Padding would
   *    be worse than the distortion: a black border becomes fake far-depth and
   *    drags the min-max normalisation with it.
   */
  fit: 'stretch';
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
    fit: 'stretch',
    output: 'inverse',
  },
};

// ── Which weights are actually published for THIS build ──────────────────────
//
// A build fact, not a device fact (mirrors MATTE_STAGED): a model is offered only
// once its weights are published to the models host with a verified pin AND its
// licence has been re-confirmed from a primary source. Until then, offering it
// would promise a one-time download that can never complete.

/** True where the model's weights are published + licence-verified. FALSE today:
 *  publishing the quantised Depth Anything V2 Small ONNX to the models host is a
 *  human step (plans/160 section 7) and has not happened, so the capability
 *  honestly reports itself unavailable rather than offering a dead download. Flip
 *  this in the SAME change that adds the verified pin, the real `approxBytes`,
 *  and the DEPTH_MODEL_SPEC confirmed against the real graph. */
export const DEPTH_STAGED: Record<DepthModelId, boolean> = {
  'depth-anything-v2-small': false,
};

/** The models actually runnable in this build - what a picker should OFFER.
 *  Empty until the weights are published, which is the honest answer. */
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
 * (matteOfflineFiles' rule). EMPTY until DEPTH_STAGED flips, so the offline part
 * is honestly a no-op rather than a download that cannot complete.
 *
 * OUTSTANDING WIRING (plans/160 WP-A, deliberately not applied here - it edits
 * four files outside this triple):
 *   1. bridge/db.ts - bump DB_VERSION and `db.createObjectStore('depth-models')`,
 *      the same way 'matte-models' was added at v12. WITHOUT IT the fetcher's
 *      IndexedDB read/write throw, are swallowed, and every run re-downloads the
 *      weights. (The depth-MAP cache needs nothing: it lives in 'derived-media',
 *      which already exists.)
 *   2. lib/model-prefetch.ts - a `depthFetch = createModelFetcher({ store:
 *      DEPTH_MODEL_STORE, dir: DEPTH_MODEL_DIR, version: DEPTH_MODEL_CACHE_VERSION,
 *      dbg })`, plus `prefetchDepthModels()` / `depthCacheBytes()` over this list.
 *   3. lib/offline-manager.ts - `'depth'` in OfflinePartId, a `downloadDepth()`
 *      beside downloadMatte, and 'depth' in removePart's model-store clear.
 *   4. views/profile.ts - the PartDef row, the download dispatcher branch, and the
 *      two TOTAL `Record<OfflinePartId, …>` maps (plannedBytes, partAvailable),
 *      which is what makes step 3 a compile error until this one is done too.
 */
export function depthOfflineFiles(): string[] {
  return stagedDepthModels().map((m) => DEPTH_MODEL_FILES[m.id]);
}

// ── Working size ─────────────────────────────────────────────────────────────

/**
 * Longest edge of the WORKING image, before inference and before the render.
 * iOS memory is the constraint that sets this, not quality: the model sees a
 * 518px square either way, so anything above this buys nothing and a 48MP phone
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
