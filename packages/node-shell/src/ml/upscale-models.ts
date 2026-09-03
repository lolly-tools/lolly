// SPDX-License-Identifier: MPL-2.0
/**
 * On-device AI upscaler - the PURE catalogue half of `host.upscale` (v1.101).
 *
 * Constants only: the model list surfaced to the picker/consent UI, their
 * on-disk file names, the IndexedDB cache coordinates, and a couple of lookup
 * helpers. NO onnxruntime, NO DOM, NO IndexedDB - this is the one part of the
 * feature safe to import from either the main thread (bridge/upscale.ts, for
 * the synchronous `models()`/`modelBytes()`/`isAvailable()` answers) or the
 * worker (lib/upscale-worker.ts → lib/upscaler.ts) without dragging the
 * multi-MB runtime into the boot budget.
 *
 * The file NAMES and cache coordinates below are a PINNED CONTRACT shared
 * verbatim with the model fetch/convert script (scripts/fetch-upscale-models.ts,
 * Andy-run - this repo never vendors the weights): the runner reads whatever
 * that script writes to `/models/upscale/<file>` and caches in the
 * 'upscale-models' IndexedDB store. Change a name here and you must change it
 * there too, or a cache/miss goes silent.
 *
 * WHY IT LIVES IN packages/node-shell (moved 2026-09-03, plans/183 WS2): the
 * on-device AI upscaler now runs on BOTH the web shell (onnxruntime-web in a
 * Worker) and the Node shells (onnxruntime-node, packages/node-shell/src/ml/).
 * A roster that existed twice would let `models()` and `modelBytes()` answer
 * differently on the two shells, which is exactly the drift the contract
 * forbids. The parent repo is the only place both can import from (shells/web
 * and shells/cli are separately versioned submodules), so the constants live
 * here and shells/web/src/lib/upscale-models.ts re-exports them unchanged -
 * the same move net.ts and pptx.ts made.
 */

import type { UpscaleModelId, UpscaleModelInfo } from '@lolly-tools/core/host-v1';

// ── Cache coordinates (shared with scripts/fetch-upscale-models.ts) ──────────

/** IndexedDB object store holding the cached model bytes (see bridge/db.ts). */
export const UPSCALE_MODEL_STORE = 'upscale-models';
/** URL directory under `/models/` the bytes are fetched from. */
export const UPSCALE_MODEL_DIR = 'upscale';
/** Bump to invalidate every cached entry (a reconverted model, or a poisoned
 *  cache - the HTML-response guard in createModelFetcher). */
export const UPSCALE_MODEL_CACHE_VERSION = 1;

// ── Model files on disk (`/models/upscale/<file>`) ───────────────────────────

/** The primary weights for each selectable model. */
export const UPSCALE_MODEL_FILES: Record<UpscaleModelId, string> = {
  'realesr-general-x4v3': 'realesr-general-x4v3.onnx',
  'realesrgan-x4plus': 'realesrgan-x4plus.onnx',
  'realesrgan-x4plus-anime': 'realesrgan-x4plus-anime.onnx',
  'gfpgan-v1.4': 'gfpgan-v1.4.onnx',
};

/** The general model's denoise partner. Real-ESRGAN's `dni` blends the general
 *  net with this "with-denoise" net; we blend their float OUTPUTS per-pixel
 *  (weights can't be blended at runtime) - see lib/upscaler.ts. Optional: a run
 *  with denoise simply skips the blend when this file isn't cached. */
export const UPSCALE_WDN_FILE = 'realesr-general-wdn-x4v3.onnx';

/** A small, best-effort face detector for the GFPGAN path. Absent (or finding
 *  nothing) → a centre-square crop fallback (headshots are centred). */
export const UPSCALE_FACE_DETECT_FILE = 'face-detect.onnx';

/** GFPGAN's aligned-face crop is a fixed 512². */
export const GFPGAN_FACE_SIZE = 512;

/** The general fast model is the default when `opts.model` is omitted. */
export const UPSCALE_DEFAULT_MODEL: UpscaleModelId = 'realesr-general-x4v3';

// ── The catalogue ────────────────────────────────────────────────────────────
//
// `approxBytes` is the one-time consent size the picker + offline manager show;
// it is the primary weights only (the general model's optional WDN partner adds
// a similar ~4 MB when denoise is used, surfaced separately if at all). The
// licence + attribution lines are a real obligation, not decoration - the shell
// carries them in its credits (a "Larger Work" under BSD-3-Clause / Apache-2.0).

const RE_ATTRIBUTION = 'Real-ESRGAN © 2021 Xintao Wang et al. (BSD-3-Clause)';

export const UPSCALE_MODELS: UpscaleModelInfo[] = [
  {
    id: 'realesr-general-x4v3',
    name: 'Real-ESRGAN general (fast)',
    scale: 4,
    approxBytes: 4 * 1024 * 1024,
    license: 'BSD-3-Clause',
    attribution: RE_ATTRIBUTION,
    version: 'v3',
  },
  {
    id: 'realesrgan-x4plus',
    name: 'Real-ESRGAN x4plus (quality)',
    scale: 4,
    approxBytes: 67_051_616,   // exact vendored size (verified 2026-08-05)
    license: 'BSD-3-Clause',
    attribution: RE_ATTRIBUTION,
    version: 'x4plus',
  },
  {
    id: 'realesrgan-x4plus-anime',
    name: 'Real-ESRGAN anime (illustration)',
    scale: 4,
    approxBytes: 17_939_969,   // exact converted size (RRDBNet 6-block fp32, verified 2026-08-06)
    license: 'BSD-3-Clause',
    attribution: RE_ATTRIBUTION,
    version: 'x4plus-anime-6B',
  },
  {
    id: 'gfpgan-v1.4',
    name: 'GFPGAN face restore',
    scale: 4,
    approxBytes: 340 * 1024 * 1024,
    license: 'Apache-2.0',
    attribution: 'GFPGAN © 2021 Tencent ARC (Apache-2.0)',
    version: 'v1.4',
    warning: 'warning can invent face details',
    facesOnly: true,
  },
];

/** Approximate one-time download per model, for the consent UI. Derived from
 *  UPSCALE_MODELS so the two never drift. */
export const UPSCALE_MODEL_BYTES: Record<UpscaleModelId, number> = UPSCALE_MODELS.reduce(
  (acc, m) => { acc[m.id] = m.approxBytes; return acc; },
  {} as Record<UpscaleModelId, number>,
);

// ── Which weights are actually vendored in THIS build ────────────────────────
//
// A build fact, not a device fact: scripts/fetch-upscale-models.ts pins some
// models with a PLACEHOLDER sha (no self-contained single-file ONNX source found
// yet), so their weights are never staged on the server - offering them would
// promise a one-time download that can never complete. Withhold them until a real
// pin arrives, and flip the flag HERE in the same change. The general + x4plus +
// GFPGAN weights (and the GFPGAN face detector) have real, verified fetch-script
// pins today; the anime/illustration model has no published ONNX mirror, so it is
// CONVERSION-SOURCED - reproduced on-device from the upstream BSD-3 .pth by
// scripts/convert-anime-upscale-onnx.py (RRDBNet 6-block, verified to run + scale
// x4 in onnxruntime), which writes it straight into the served /models/upscale/ tree.

/** True where the model's primary weights have a real pin in the fetch script. */
export const UPSCALE_STAGED: Record<UpscaleModelId, boolean> = {
  'realesr-general-x4v3': true,        // real pin
  'realesrgan-x4plus': true,           // real pin (SceneWorks single-file fp32 ONNX, verified 2026-08-05)
  'realesrgan-x4plus-anime': true,     // converted on-device from the BSD-3 .pth (scripts/convert-anime-upscale-onnx.py); ran + scaled x4 in onnxruntime 2026-08-06
  'gfpgan-v1.4': true,                 // real pin
};

/** Whether the general model's denoise partner (WDN) is vendored. Placeholder pin
 *  today → denoise is unavailable and the slider stays hidden until a real WDN ONNX
 *  is pinned (flip alongside the pin, beside UPSCALE_STAGED). */
export const UPSCALE_DENOISE_STAGED = false;

/** The models actually runnable in this build - what the picker should OFFER.
 *  Unstaged models (placeholder pins) are withheld rather than shown as a download
 *  that can never complete (an honest-availability gate). Never empty: the default
 *  general model always has a real pin. */
export function stagedUpscaleModels(): UpscaleModelInfo[] {
  return UPSCALE_MODELS.filter((m) => UPSCALE_STAGED[m.id]);
}

/** The catalogue entry for an id, or undefined for an unknown one. Looks up the
 *  FULL catalogue (incl. unstaged) so an id round-trips even for a withheld model. */
export function upscaleModel(id: UpscaleModelId): UpscaleModelInfo | undefined {
  return UPSCALE_MODELS.find((m) => m.id === id);
}
