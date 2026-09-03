// SPDX-License-Identifier: MPL-2.0
/**
 * On-device background remover - the PURE catalogue half of `host.matte`
 * (v1.103), the structural twin of lib/upscale-models.ts.
 *
 * Constants only: the model list surfaced to the picker/consent UI, their
 * on-disk file names, the IndexedDB cache coordinates, the per-model TENSOR
 * DESCRIPTOR the runner needs, and a couple of lookup helpers. NO onnxruntime,
 * NO DOM, NO IndexedDB - safe to import from either the main thread
 * (bridge/matte.ts, for the synchronous models()/modelBytes()/isAvailable()
 * answers) or the worker (lib/matte-worker.ts → lib/matter.ts) without dragging
 * the multi-MB runtime into the boot budget.
 *
 * The file NAMES and cache coordinates below are a PINNED CONTRACT shared
 * verbatim with the model fetch script (scripts/fetch-matte-models.ts, Andy-run
 * - this repo never vendors the weights): the runner reads whatever that script
 * writes to `/models/matte/<file>` and caches in the 'matte-models' IndexedDB
 * store. Change a name here and you must change it there too, or a cache miss
 * goes silent.
 *
 * The tensor descriptors (MATTE_MODEL_SPEC) are NOT decoration: normalization
 * genuinely DIFFERS per model (MODNet uses mean 0.5 / std 0.5; u2netp uses
 * ImageNet), and the output activation differs too (min-max for a bounded head,
 * sigmoid for a logit head). A wrong mean/std or activation does not crash - it
 * silently degrades the matte. Every value here MUST be confirmed against the real
 * ONNX graph before a model is staged (see the human-verification gates in the
 * fetch script header).
 *
 * WHY IT LIVES IN packages/node-shell (moved 2026-09-03, plans/183 WS2): the
 * background remover now runs on BOTH the web shell (onnxruntime-web in a
 * Worker) and the Node shells (onnxruntime-node, packages/node-shell/src/ml/).
 * A roster that existed twice would let `models()` and `modelBytes()` answer
 * differently on the two shells, which is exactly the drift the contract
 * forbids. The parent repo is the only place both can import from (shells/web
 * and shells/cli are separately versioned submodules), so the constants live
 * here and shells/web/src/lib/matte-models.ts re-exports them unchanged - the
 * same move net.ts and pptx.ts made.
 */

import type { MatteModelId, MatteModelInfo } from '@lolly-tools/core/host-v1';

// ── Cache coordinates (shared with scripts/fetch-matte-models.ts) ────────────

/** IndexedDB object store holding the cached model bytes (see bridge/db.ts). */
export const MATTE_MODEL_STORE = 'matte-models';
/** URL directory under `/models/` the bytes are fetched from. */
export const MATTE_MODEL_DIR = 'matte';
/** Bump to invalidate every cached entry (a reconverted model, or a poisoned
 *  cache - the HTML-response guard in createModelFetcher). */
export const MATTE_MODEL_CACHE_VERSION = 1;

// ── Model files on disk (`/models/matte/<file>`) ─────────────────────────────

/** The weights file for each selectable model. */
export const MATTE_MODEL_FILES: Record<MatteModelId, string> = {
  'u2netp': 'u2netp.onnx',
  'modnet': 'modnet.onnx',
};

/** The default when `opts.model` is omitted: U²-Net lite - the only GENERAL-subject
 *  net left on the roster. MODNet is portrait-tuned (its own note: "weaker on
 *  non-portrait subjects"), so defaulting every logo, product shot and pet photo to
 *  it would be wrong. The trade is honest and worth saying out loud: u2netp is a
 *  4.5 MB saliency net at 320², so first use costs ~4.5 MB instead of the retired
 *  BiRefNet-lite's 114.5 MB and runs in a fraction of the time, but its edges are
 *  softer and it is weaker on dark / low-contrast backgrounds. */
export const MATTE_DEFAULT_MODEL: MatteModelId = 'u2netp';

/** Coerce a caller-supplied id to one this build actually carries. The roster
 *  NARROWS (isnet-general 2026-08-05, the BiRefNet pair 2026-08-26) while ids
 *  outlive it in saved projects, `?model=` URLs and the dialog's remembered
 *  localStorage choice - and an id with no MATTE_MODEL_FILES/MATTE_MODEL_SPEC entry
 *  crashes the runner on `spec.inputSize` or silently fetches
 *  `/models/matte/undefined`. So every entry point normalizes first: a retired id
 *  degrades to the default with one console line, never a throw and never a hang. */
export function resolveMatteModel(id: string | null | undefined): MatteModelId {
  if (id && Object.hasOwn(MATTE_MODEL_FILES, id)) return id as MatteModelId;
  if (id) console.warn(`[matte] unknown model "${id}" - using ${MATTE_DEFAULT_MODEL}`);
  return MATTE_DEFAULT_MODEL;
}

// ── The catalogue ────────────────────────────────────────────────────────────
//
// `approxBytes` is the one-time consent size the picker + offline manager show.
// The licence + attribution lines are a real obligation, not decoration - the
// shell carries them in its credits (a "Larger Work" under Apache-2.0 / MIT), and
// `version` is copied verbatim into the C2PA edit step. Every size below is
// RESEARCH-SOURCED and LOW CONFIDENCE - the fetch script records the real byte
// length from the downloaded file and this must be reconciled before staging.

// Order here IS the picker order (models() filters to the staged set, preserving it):
// the general default → the portrait specialist.
export const MATTE_MODELS: MatteModelInfo[] = [
  {
    id: 'u2netp',
    name: 'U²-Net lite',
    // Retiered 'fast' → 'default' when the BiRefNet pair was removed (2026-08-26):
    // this is the only general-subject net left, so it IS the default rather than a
    // preview step below one. The name loses "(fast)" for the same reason - it is
    // no longer the quick option, it is the option.
    tier: 'default',
    approxBytes: 4_574_861,   // exact vendored size (verified 2026-08-05)
    license: 'Apache-2.0',
    attribution: 'U²-Net © 2020 Xuebin Qin et al. (Apache-2.0)',
    version: 'u2netp',
    note: 'Works on any subject and downloads in seconds. Edges are soft, and busy or low-contrast backgrounds can confuse it.',
  },
  {
    id: 'modnet',
    name: 'MODNet (portraits)',
    tier: 'pro',
    approxBytes: 25_888_640,   // exact vendored size (verified 2026-08-05)
    license: 'Apache-2.0',
    attribution: 'MODNet © 2020 Zhanghan Ke et al. (Apache-2.0)',
    version: 'modnet',
    note: 'Tuned for people - soft hair and edges. Small and fast; weaker on non-portrait subjects.',
  },
];

/** Approximate one-time download per model, for the consent UI. Derived from
 *  MATTE_MODELS so the two never drift. */
export const MATTE_MODEL_BYTES: Record<MatteModelId, number> = MATTE_MODELS.reduce(
  (acc, m) => { acc[m.id] = m.approxBytes; return acc; },
  {} as Record<MatteModelId, number>,
);

// ── The per-model tensor descriptor (runner contract) ────────────────────────
//
// The runner is per-model parameterized on purpose: normalization + activation
// differ. All models: pixel/255 → (x − mean)/std, RGB, NCHW, single-channel mask
// out. `activation` decides how the mask is turned into 0..1 alpha:
//   'minmax' - the head is already bounded (rembg saliency nets): (x−min)/(max−min).
//   'sigmoid' - the head is a logit: 1/(1+e^-x), used directly.
// Getting these backwards (sigmoid on a bounded head, min-max on a logit) washes
// or over-contrasts the matte with NO crash - verify empirically before staging.
// Both models on today's roster are minmax; 'sigmoid' is KEPT (activateMask still
// implements it, matter.test.ts still covers it) because dropping it would make the
// next logit-head model silently minmax - exactly the no-crash degradation above.
// It was BiRefNet's activation before that pair was retired 2026-08-26.

export interface MatteModelSpec {
  /** Fixed model input [height, width]; the source is letterbox-padded to it. */
  inputSize: [number, number];
  /** Per-channel mean subtracted after the /255 scale (RGB order). */
  mean: [number, number, number];
  /** Per-channel std divided after the mean subtraction (RGB order). */
  std: [number, number, number];
  /** How the single-channel output becomes 0..1 alpha. */
  activation: 'minmax' | 'sigmoid';
}

const IMAGENET_MEAN: [number, number, number] = [0.485, 0.456, 0.406];
const IMAGENET_STD: [number, number, number] = [0.229, 0.224, 0.225];

export const MATTE_MODEL_SPEC: Record<MatteModelId, MatteModelSpec> = {
  'u2netp': {
    inputSize: [320, 320],
    mean: IMAGENET_MEAN,
    std: IMAGENET_STD,
    activation: 'minmax',
  },
  'modnet': {
    // MODNet: [-1,1] normalization (mean 0.5 / std 0.5), a bounded alpha head → minmax.
    // The ONNX takes a DYNAMIC H×W; 512² is its training resolution (a multiple of 32).
    // All confirmed against the real graph (onnxruntime, 2026-08-05).
    inputSize: [512, 512],
    mean: [0.5, 0.5, 0.5],
    std: [0.5, 0.5, 0.5],
    activation: 'minmax',
  },
};

// ── Which weights are actually vendored in THIS build ────────────────────────
//
// A build fact, not a device fact (mirrors UPSCALE_STAGED): a model is offered
// only once scripts/fetch-matte-models.ts carries a REAL, verified pin for its
// weights AND the licence has been re-confirmed from a primary source. Until then
// offering it would promise a one-time download that can never complete. Model
// licensing is high-stakes and ships to every device, so the default is WITHHELD:
// flip a flag here in the SAME change that adds the verified pin.

/** True where the model's weights have a real, licence-verified pin. Every staged
 *  model below has: a real sha256+byte-verified pin (fetch-matte-models.ts), its ONNX
 *  graph inspected in onnxruntime (input/output shape+dtype, and the per-model
 *  normalization + activation in MATTE_MODEL_SPEC CONFIRMED against the real graph),
 *  a permissive licence (Apache-2.0/MIT, MPL-compatible), and a clean run on the
 *  CPU/WASM path - matte is WASM-only, so no WebGPU gate applies. */
export const MATTE_STAGED: Record<MatteModelId, boolean> = {
  'u2netp': true,   // DEFAULT - general saliency net (ImageNet norm, bounded head → minmax)
  'modnet': true,   // portrait specialist - soft hair ([-1,1] norm, bounded alpha → minmax)
};

/** The models actually runnable in this build - what the picker should OFFER.
 *  Unstaged models are withheld rather than shown as a download that can never
 *  complete (an honest-availability gate). CAN be empty today: no matte model is
 *  staged until its licence + pin are verified - the picker then reports the
 *  capability as unavailable, which is honest. */
export function stagedMatteModels(): MatteModelInfo[] {
  return MATTE_MODELS.filter((m) => MATTE_STAGED[m.id]);
}

// ── Which staged models need a NATIVE ORT backend ────────────────────────────
//
// Staging (MATTE_STAGED) is a WEIGHTS-verified fact; this is a separate BACKEND
// fact: a model whose fp32-upcast weights plus activations blow past the ~4 GB
// ceiling of the single-thread wasm32 heap (ort.ts numThreads=1) aborts with
// std::bad_alloc on EFFECTIVELY ANY DEVICE, because that is an ADDRESS-SPACE limit
// and not a RAM one. Such a model is offered only where a native ORT backend exists
// (Tauri desktop, via bridge-overrides/matte.ts).
//
// EVERY entry is false as of 2026-08-26: the full BiRefNet (Swin-L @1024²) was the
// only model that ever needed the gate, and it has been removed. The table and the
// matteModelsFor() gate stay because they are the mechanism, not the model - the
// picker and the offline pre-download share this one answer, and a future
// heavyweight must not have to re-invent it.
export const MATTE_NATIVE_ONLY: Record<MatteModelId, boolean> = {
  'u2netp': false,
  'modnet': false,
};

/** The staged models a shell should OFFER given whether it has a native ORT
 *  backend. Web/CLI pass `false` and never see the native-only heavyweights (they
 *  would download hundreds of MB only to OOM at run); the desktop shell passes
 *  `true` and offers the full set. Preserves MATTE_MODELS order. */
export function matteModelsFor(hasNativeBackend: boolean): MatteModelInfo[] {
  return stagedMatteModels().filter((m) => hasNativeBackend || !MATTE_NATIVE_ONLY[m.id]);
}

/** The catalogue entry for an id, or undefined for an unknown one. Looks up the
 *  FULL catalogue (incl. unstaged) so an id round-trips even for a withheld model. */
export function matteModel(id: MatteModelId): MatteModelInfo | undefined {
  return MATTE_MODELS.find((m) => m.id === id);
}
