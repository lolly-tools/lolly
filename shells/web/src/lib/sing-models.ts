// SPDX-License-Identifier: MPL-2.0
/**
 * The singing models behind rondocode's sing() (plan 301 phase F): one source of
 * truth for their file names, sizes and cache identity, the way matte-models.ts
 * and durable-model.ts are for their families.
 *
 * Four modules have to agree on these values or the bytes go missing:
 *   lib/model-prefetch.ts   downloads the part and measures it for the storage meter
 *   lib/offline-manager.ts  records and removes the "Singing voices" part
 *   lib/model-parts.ts      sizes the part from the model listing and checks it is here
 *   bridge/models.ts        hands the bytes to the Rondocode editor frame (host.models)
 *
 * PURE DATA: no IndexedDB, no fetch, no ORT. That keeps the boot-graph modules
 * that import it light.
 *
 * WHAT THE PART HOLDS
 * Everything one song needs to sing on the int8 path, with all three voices: the
 * small phoneme aligner, the two int8 Supertonic builds in place of the fp32
 * vector estimator and vocoder, the other Supertonic files, the ContentVec
 * encoder, the three RVC voices, the aligner vocabulary, and the licence and
 * credits that travel with them. The three voices ride together because a song
 * picks its voice by one word of code, and a second offer sheet every time that
 * word changes would cost more than the 336 MB the voices add to an 880 MB core.
 *
 * The fp32 aligner and the fp32 Supertonic vector estimator and vocoder are NOT in
 * the part. Upstream asks for them only when an int8 build fails to load, so they
 * are fetched on demand behind their own consent line (bridge/models.ts), never as
 * part of the Profile download.
 *
 * NEVER IN A SWEEP (Andy, 2026-10-07): the part is a named row of its own in
 * Profile, Available offline, and an in-place offer when a song sings. It is not in
 * "Download everything", not in "Include all the AI models", and not in the
 * desktop first-run sheet. views/profile/offline.ts keeps its sweep list without
 * it; profile-offline-rows.test.ts pins that.
 */

/** IndexedDB object store the bytes live in (bridge/db.ts, version 25). */
export const SING_MODEL_STORE = 'sing-models';

/** Directory under `/models/` the bytes are served from: same-origin on the web
 *  build (lolly.tools rewrites it to the model host), under MODELS_BASE where one
 *  is set (the Tauri shells). */
export const SING_MODEL_DIR = 'sing';

/** Bump when a hosted file is replaced: it invalidates the cached bytes. */
export const SING_MODEL_CACHE_VERSION = 1;

/** The family name host.models answers to. */
export const SING_FAMILY = 'sing';

/** Every hosted file, by its path under `/models/sing/`, with its exact size
 *  (scripts/fetch-sing-models.ts pins the bytes; sing-models.test.ts checks these
 *  sizes against shells/web/models-manifest.json). */
export const SING_FILE_BYTES: Readonly<Record<string, number>> = Object.freeze({
  'CREDITS.txt': 1_527,
  'rondocode/gen_barbara.onnx': 112_110_094,
  'rondocode/gen_kizuna.onnx': 112_110_094,
  'rondocode/gen_rise.onnx': 112_110_094,
  'rondocode/phoneme-int8.onnx': 356_662_870,
  'rondocode/phoneme.onnx': 1_264_009_987,
  'rondocode/tts_vector_estimator-int8.onnx': 65_580_309,
  'rondocode/tts_vocoder-int8.onnx': 38_569_499,
  'rondocode/vec-768.onnx': 377_655_729,
  'supertonic/LICENSE.txt': 15_007,
  'supertonic/onnx/duration_predictor.onnx': 3_700_147,
  'supertonic/onnx/text_encoder.onnx': 36_416_150,
  'supertonic/onnx/tts.json': 8_253,
  'supertonic/onnx/unicode_indexer.json': 277_676,
  'supertonic/onnx/vector_estimator.onnx': 256_534_781,
  'supertonic/onnx/vocoder.onnx': 101_424_195,
  'supertonic/voice_styles/F1.json': 292_046,
  'supertonic/voice_styles/F2.json': 292_423,
  'supertonic/voice_styles/F3.json': 290_794,
  'supertonic/voice_styles/F4.json': 291_808,
  'supertonic/voice_styles/F5.json': 291_479,
  'supertonic/voice_styles/M1.json': 291_748,
  'supertonic/voice_styles/M2.json': 292_055,
  'supertonic/voice_styles/M3.json': 290_198,
  'supertonic/voice_styles/M4.json': 291_522,
  'supertonic/voice_styles/M5.json': 291_469,
  'wav2vec2/vocab.json': 4_637,
});

/** The fp32 builds upstream falls back to when an int8 build will not load.
 *  Fetched on demand with their own consent, never part of the download. */
export const SING_FALLBACK_FILES: readonly string[] = Object.freeze([
  'rondocode/phoneme.onnx',
  'supertonic/onnx/vector_estimator.onnx',
  'supertonic/onnx/vocoder.onnx',
]);

/** The three RVC voices, by the name a song uses. */
export const SING_VOICES: readonly string[] = Object.freeze(['kizuna', 'barbara', 'rise']);

const FALLBACK = new Set(SING_FALLBACK_FILES);

/** What the "Singing voices" part downloads: every hosted file but the fp32
 *  fallbacks, in a stable order (the big files first, so a cancelled run has the
 *  most expensive bytes already). */
export const SING_PART_FILES: readonly string[] = Object.freeze(
  Object.keys(SING_FILE_BYTES)
    .filter(f => !FALLBACK.has(f))
    .sort((a, b) => (SING_FILE_BYTES[b]! - SING_FILE_BYTES[a]!) || a.localeCompare(b)),
);

/** The part's size in bytes: 1,218,137,628, which Profile shows as 1.1 GB. */
export const SING_PART_BYTES: number = SING_PART_FILES.reduce((n, f) => n + SING_FILE_BYTES[f]!, 0);

/** Is this a hosted model file of the family (by its path under /models/sing/)? */
export function isSingModelFile(path: string): boolean {
  return Object.hasOwn(SING_FILE_BYTES, path);
}

/** Is this file part of the Profile download (not an fp32 fallback)? */
export function isSingPartFile(path: string): boolean {
  return isSingModelFile(path) && !FALLBACK.has(path);
}

/** The prefix under which host.models serves the shell's own onnxruntime-web
 *  binaries: the editor frame has an opaque origin, so it cannot load /ort/. */
export const SING_RUNTIME_PREFIX = 'runtime/';

/** The onnxruntime-web WebAssembly builds a caller may ask for, by name. They
 *  are the files the shell itself serves at /ort/ (scripts/copy-ort.ts copies
 *  them from the onnxruntime-web version shells/web/package.json pins), so a
 *  caller whose bundled ORT glue is that same version gets a matching binary. */
const RUNTIME_FILE = /^runtime\/(ort-wasm-simd-threaded(?:\.(?:jsep|asyncify|jspi))?\.wasm)$/;

/** The same-origin URL of a `runtime/<file>` path, or null when the path is not
 *  one of the runtime files. */
export function singRuntimeUrl(path: string): string | null {
  const m = RUNTIME_FILE.exec(path);
  return m ? `/ort/${m[1]}` : null;
}
