// SPDX-License-Identifier: MPL-2.0
/**
 * On-device OCR - the PURE catalogue half of `host.ocr` (plans/125), the
 * structural twin of lib/matte-models.ts.
 *
 * Constants only: the model list surfaced to a picker/consent UI, the on-disk
 * file names (a logical model is THREE files - a detector, a recogniser and its
 * character dictionary), the IndexedDB cache coordinates, the per-model tensor
 * DESCRIPTOR the runner needs, and a couple of lookup helpers. NO onnxruntime, NO
 * DOM, NO IndexedDB - safe to import from the main thread (the bridge's sync
 * isAvailable()/models()/modelBytes()) or the worker (lib/ocr-worker.ts → ocr.ts).
 *
 * The file NAMES and cache coordinates are a PINNED CONTRACT shared verbatim with
 * scripts/fetch-ocr-models.ts (Andy-run - this repo never vendors the weights):
 * the runner reads whatever that script writes to `/models/ocr/<file>` and caches
 * in the 'ocr-models' store. Change a name here and you must change it there too.
 *
 * The tensor descriptors (OCR_MODEL_SPEC) are NOT decoration: the detector's
 * normalization (ImageNet) differs from the recogniser's ([-1,1]), and a wrong
 * mean/std, input name, or CTC dictionary silently degrades the read rather than
 * crashing. Every value MUST be confirmed against the real ONNX graph before a
 * model is staged (see the human-verification gates in the fetch-script header).
 *
 * WHY IT LIVES IN packages/node-shell (moved 2026-09-03, plans/183 WS2): OCR
 * now runs on BOTH the web shell (onnxruntime-web in a Worker) and the Node
 * shells (onnxruntime-node, packages/node-shell/src/ml/). A roster that
 * existed twice would let `models()` and `modelBytes()` answer differently on
 * the two shells, which is exactly the drift the contract forbids. The parent
 * repo is the only place both can import from (shells/web and shells/cli are
 * separately versioned submodules), so the constants live here and
 * shells/web/src/lib/ocr-models.ts re-exports them unchanged - the same move
 * net.ts and pptx.ts made.
 */

import type { OcrModelId, OcrModelInfo } from '@lolly-tools/core/host-v1';

// ── Cache coordinates (shared with scripts/fetch-ocr-models.ts) ──────────────

/** IndexedDB object store holding the cached model bytes (see bridge/db.ts). */
export const OCR_MODEL_STORE = 'ocr-models';
/** URL directory under `/models/` the bytes are fetched from. */
export const OCR_MODEL_DIR = 'ocr';
/** Bump to invalidate every cached entry (a reconverted model, or a poisoned
 *  cache - the HTML-response guard in createModelFetcher). */
export const OCR_MODEL_CACHE_VERSION = 1;

// ── Model files on disk (`/models/ocr/<file>`) ───────────────────────────────

/** The three files each logical model needs: a DBNet detector, a CRNN/SVTR
 *  recogniser, and the recogniser's CTC character dictionary (one glyph a line). */
export interface OcrModelFiles {
  det: string;
  rec: string;
  dict: string;
}

export const OCR_MODEL_FILES: Record<OcrModelId, OcrModelFiles> = {
  'ppocr-v5-mobile': {
    det: 'ppocrv5-mobile-det.onnx',
    rec: 'ppocrv5-mobile-rec.onnx',
    dict: 'ppocrv5-dict.txt',
  },
};

/** The default when `opts.model` is omitted. */
export const OCR_DEFAULT_MODEL: OcrModelId = 'ppocr-v5-mobile';

// ── The tensor descriptor the runner needs ───────────────────────────────────

export interface OcrModelSpec {
  /** DBNet text detector. */
  det: {
    /** ONNX input tensor name (confirm against the graph at staging). */
    inputName: string;
    /** Long-side cap; the image is resized to fit, then padded to a /32 multiple. */
    limitSide: number;
    /** Per-channel ImageNet mean / std (RGB), applied after a 1/255 scale. */
    mean: [number, number, number];
    std: [number, number, number];
    /** Probability-map threshold that turns the heat-map into a binary mask. */
    binThresh: number;
    /** A detected box is kept only when its mean probability clears this. */
    boxThresh: number;
    /** Boxes smaller than this many pixels of area are dropped as noise. */
    minBoxArea: number;
    /** DB "unclip" expansion - text sits inside the shrunk region the net emits. */
    unclipRatio: number;
  };
  /** CRNN / SVTR recogniser (CTC). */
  rec: {
    inputName: string;
    /** The fixed input height each cropped line is resized to. */
    height: number;
    /** Cap on the resized width (very long lines are split by the detector). */
    maxWidth: number;
    /** Per-channel mean / std (RGB) after a 1/255 scale - PP-OCR uses 0.5 → [-1,1]. */
    mean: [number, number, number];
    std: [number, number, number];
  };
}

export const OCR_MODEL_SPEC: Record<OcrModelId, OcrModelSpec> = {
  'ppocr-v5-mobile': {
    det: {
      inputName: 'x',
      limitSide: 960,
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
      binThresh: 0.3,
      boxThresh: 0.5,
      minBoxArea: 24,
      unclipRatio: 1.6,
    },
    rec: {
      inputName: 'x',
      height: 48,
      maxWidth: 480,
      mean: [0.5, 0.5, 0.5],
      std: [0.5, 0.5, 0.5],
    },
  },
};

// ── The catalogue ────────────────────────────────────────────────────────────
//
// `approxBytes` is the one-time consent size a picker + the offline manager show
// (det + rec + dict together, since they download as a set). The licence line is
// a real obligation the shell carries in its credits (Apache-2.0), never decoration.

export const OCR_MODELS: OcrModelInfo[] = [
  {
    id: 'ppocr-v5-mobile',
    name: 'PP-OCRv5 (mobile)',
    tier: 'default',
    // det 4,826,518 + rec 16,562,373 + dict 74,012 (verified 2026-08-18).
    approxBytes: 21_462_903,
    license: 'Apache-2.0',
    attribution: 'PaddleOCR PP-OCRv5 mobile, © PaddlePaddle authors (Apache-2.0)',
    version: 'v5-mobile',
    // The multilingual mobile recogniser: an 18,383-glyph dictionary spanning Latin,
    // CJK and more. A representative subset is listed; the model reads well beyond it.
    languages: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'it'],
    note: 'Reads printed and on-screen text - Latin, CJK and many more scripts.',
  },
];

/** One-time download bytes per model, for the consent UI. */
export const OCR_MODEL_BYTES: Record<OcrModelId, number> = Object.fromEntries(
  OCR_MODELS.map((m) => [m.id, m.approxBytes]),
);

// ── Staging gate ─────────────────────────────────────────────────────────────
//
// A model is `false` here until scripts/fetch-ocr-models.ts has vendored its
// weights AND its spec above has been confirmed against the real ONNX graph - the
// same two-part human gate matte uses. Until then models() is empty, the capability
// honestly reports itself unavailable-in-practice, and no fetch is ever attempted.

export const OCR_STAGED: Record<OcrModelId, boolean> = {
  // Staged 2026-08-18: files vendored via scripts/fetch-ocr-models.ts, licence
  // Apache-2.0 (official PaddleOCR via paddle2onnx), both graphs loaded + run on
  // CPU, and the CTC dict alignment confirmed (rec output 18,385 classes = dict
  // 18,383 + blank + space, exactly the charset ocr.ts builds). The one check left
  // is a real-image eyeball IN THE BROWSER (the WASM target), which decides accuracy.
  'ppocr-v5-mobile': true,
};

/** The staged (licence-verified, spec-confirmed) models only. */
export function stagedOcrModels(): OcrModelInfo[] {
  return OCR_MODELS.filter((m) => OCR_STAGED[m.id]);
}

/** The models this shell offers. OCR has no native-only tier (the models are
 *  small), so the argument is accepted for parity with matteModelsFor and ignored. */
export function ocrModelsFor(_hasNative: boolean): OcrModelInfo[] {
  return stagedOcrModels();
}
