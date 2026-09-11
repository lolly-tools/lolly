// SPDX-License-Identifier: MPL-2.0
/**
 * The durable-credential ENCODER's cache identity - one source of truth, the way
 * upscale-models.ts / matte-models.ts / ocr-models.ts are for their families.
 *
 * Four modules have to agree on these five values or the bytes go missing:
 *   lib/trustmark-embed.ts   fetches + runs the encoder (lazy, ORT-heavy)
 *   lib/model-prefetch.ts    measures what is on device for the storage meter
 *   lib/offline-manager.ts   downloads + removes the "Durable credential" part
 *   bridge/format-support.ts probes whether a route to the model exists at all
 *
 * PURE DATA - no IndexedDB, no fetch, no engine import. That is what lets the
 * boot-graph modules (model-prefetch, offline-manager, format-support) share the
 * file names with trustmark-embed.ts, which must stay dynamic-import-only: it
 * pulls in onnxruntime-web's loader and the engine payload builder, and a static
 * import of it from any of those three would put both on the boot path.
 *
 * The store is SHARED with the deep-scan decoders (lib/trustmark.ts writes
 * decoder_Q/decoder_P/resizer + a readiness marker into the same object store),
 * so neither part may clear the whole store - each deletes its own keys. See
 * offline-manager's verifyModelKeys.
 */

/** IndexedDB object store the bytes live in (bridge/db.ts), shared with the
 *  deep-scan decoders. */
export const DURABLE_MODEL_STORE = 'trustmark-models';

/** Directory under `/models/` the bytes are served from - same-origin on the
 *  web build, under MODELS_BASE where one is set (the Tauri shells). */
export const DURABLE_MODEL_DIR = 'trustmark';

/** The encoder variant the embed uses (Q, 256px - it reads back on the decoder
 *  the deep scan tries first). Produced by the Andy-run
 *  scripts/convert-trustmark-encoder-onnx.py; Adobe ships ONNX for decode only. */
export const DURABLE_ENCODER_FILE = 'encoder_Q.onnx';

/** Bump when the encoder model is replaced (a retrained release) - invalidates
 *  the cached bytes. Independent of the decoders' MODEL_CACHE_VERSION. */
export const DURABLE_ENCODER_CACHE_VERSION = 1;

/** Size of the served encoder, for the consent line and the storage meter when
 *  no manifest is readable. Pinned to the shipped file
 *  (shells/web/models-manifest.json); the precache manifest wins wherever it can
 *  be read, so this is the honest fallback, never the primary number. */
export const DURABLE_ENCODER_BYTES = 34_603_555;

/** The manifest / URL path of the encoder, the key precache.json lists it under
 *  and the path a fetch appends to the models base. */
export const DURABLE_ENCODER_PATH = `/models/${DURABLE_MODEL_DIR}/${DURABLE_ENCODER_FILE}`;
