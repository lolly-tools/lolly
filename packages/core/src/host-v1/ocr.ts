// SPDX-License-Identifier: MPL-2.0

// ─── On-device text recognition / OCR (optional, v1.127) ──────────────────────

/**
 * A plain 8-bit RGBA pixel frame handed to `host.ocr` - the same shape a canvas
 * `getImageData` gives, so a caller never touches a tensor. Only RGB is read
 * (alpha ignored); the frame is never mutated.
 */
export interface OcrFrame {
  width: number;
  height: number;
  /** RGBA interleaved, 8-bit, length = width * height * 4. */
  data: Uint8ClampedArray;
}

/** An axis-aligned box in SOURCE-image pixel coordinates (origin top-left). */
export interface OcrBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One recognised line of text: what it says, its position, and how sure the
 * model is. `confidence` is the model's own 0..1 recognition score for THIS
 * line's characters - not a claim about correctness, and never surfaced as a
 * verdict. `box` is axis-aligned in v1 (the detector's rotated quad reduced to
 * its bounding box); a later minor may add an optional 4-point `quad`.
 */
export interface OcrLine {
  text: string;
  confidence: number;
  box: OcrBox;
}

/**
 * What `host.ocr.run` read out of an image. `text` is every line joined in
 * reading order (top→bottom, left→right) with newlines - ready to drop into a
 * clipboard or a text field; `lines` keeps the per-line boxes and confidences for
 * a caller that wants to draw, filter, or re-read them. A best-effort READ, never
 * authoritative: a shell presents `text` as a correctable draft.
 */
export interface OcrResult {
  text: string;
  lines: OcrLine[];
  /** BCP 47 tag of the script/language the active model recognises. */
  lang: string;
}

/**
 * A `host.ocr` model an id selects (see `OcrAPI.models`). Kept a plain string
 * rather than a fixed union because the live roster grows by language pack - the
 * authoritative set is whatever `models()` returns on this shell.
 */
export type OcrModelId = string;

/**
 * One entry in the on-device OCR catalogue. `license` + `attribution` carry the
 * model's real obligation (permissive-licence notice, surfaced in credits).
 * `approxBytes` covers the whole logical model - detector + recogniser + the
 * charset dictionary - since all of them download together.
 */
export interface OcrModelInfo {
  id: OcrModelId;
  /** Human name for a picker, e.g. "PP-OCRv5 (English)". */
  name: string;
  /** Ordering + intent for a picker: fast preview → general → accurate. */
  tier: 'fast' | 'default' | 'accurate';
  /** Approximate one-time download in bytes (det + rec + charset), for consent + the offline manager. */
  approxBytes: number;
  /** SPDX id, e.g. 'Apache-2.0'. Surfaced in credits. */
  license: string;
  /** Copyright / notice line to carry in the app credits (the licence obligation). */
  attribution: string;
  /** Model release string. */
  version: string;
  /** BCP 47 tags the model recognises, e.g. ['en'] or ['en','fr','de']. */
  languages: string[];
  /** One-line quality/latency note a picker shows beside the option. */
  note?: string;
}

export interface OcrProgress {
  phase: 'download' | 'detect' | 'recognize';
  /** Bytes so far (download phase). */
  loaded?: number;
  /** Total bytes, or null when the transport doesn't say. */
  total?: number | null;
  /** 0..1 where a fraction is knowable. */
  fraction?: number;
}

export interface OcrOpts {
  /** An `OcrModelId`; defaults to the shell's default model. */
  model?: OcrModelId;
  /**
   * Skip detection and recognise the WHOLE frame as one line - for a caller that
   * has already cropped to a single text line (e.g. re-reading one box). Absent ⇒
   * detect boxes, then recognise each.
   */
  singleLine?: boolean;
  /** Drop lines whose confidence is below this 0..1 floor. Absent ⇒ keep all. */
  minConfidence?: number;
  /**
   * Abort a long run: the promise rejects promptly (AbortError). Aborting during
   * the first-use download rejects promptly but the download completes in the
   * background and is cached (like `matte` / `speech`).
   */
  signal?: AbortSignal;
  onProgress?: (p: OcrProgress) => void;
}

/**
 * The honest answer to "can THIS device read THIS image?" before any bytes move
 * (see `OcrAPI.canRun`). When `ok` is false the shell says so plainly and offers
 * the concrete lever rather than attempting the run and crashing.
 */
export interface OcrFeasibility {
  ok: boolean;
  reason?: 'memory' | 'no-backend' | 'too-large';
  /** Plain, non-blaming copy the shell can show as-is. */
  message?: string;
  /** A longest-edge that WOULD fit, when the ask was too big. */
  suggestedMaxEdge?: number;
  /** A lighter model that would fit, when the chosen one won't. */
  suggestedModel?: OcrModelId;
}

/**
 * On-device text recognition (see `HostV1.ocr`). A plain RGBA frame in, the text
 * the image contains out - the shell owns the ONNX runtime, the WASM backend, the
 * one-time (consented - see `modelBytes`) model download and the memory bound; the
 * caller only ever sees pixels and plain text. Produces no pixels, no asset and no
 * provenance. All async methods reject rather than half-produce; failures degrade
 * to an honest message, never a stuck spinner.
 */
export interface OcrAPI {
  /** Whether this shell can OCR at all (a WASM backend + Worker exist). Sync. */
  isAvailable(): boolean;
  /** The resolved backend, or null before one is probed / when none. Never 'webgpu'. */
  backend(): 'wasm' | null;
  /** The model catalogue - ids, tiers, sizes, licences, languages. Sync + static. */
  models(): OcrModelInfo[];
  /** Approximate one-time download for a model, for a consent UI. Sync. */
  modelBytes(id: OcrModelId): number;
  /** Are a model's bytes already on-device? Never downloads. */
  cached(id: OcrModelId): Promise<boolean>;
  /** Honest feasibility of a read on this device, before any bytes move. */
  canRun(src: { width: number; height: number }, opts?: OcrOpts): Promise<OcrFeasibility>;
  /** Read the text. Rejects (AbortError) on `opts.signal`; never half-produces. */
  run(frame: OcrFrame, opts?: OcrOpts): Promise<OcrResult>;
}
