import { lolly } from './host'
import type { LollySingRefusal } from './host'
import { SING_MODELS_BASE, SUPERTONIC_BASE } from '../sing/config'

/* ------------------------------------------------------------------------- *
 * Lolly: where sing() gets its model bytes.
 *
 * Upstream fetches its singing models from models.rondocode.com and
 * HuggingFace, caches them in the Cache API, and loads ONNX Runtime's wasm
 * from a CDN. This frame has an opaque origin: no Cache API, no IndexedDB, no
 * network of its own. So every byte the pipeline needs is asked of Lolly by a
 * stable file id, through ONE call (lolly.singModels). Lolly decides whether
 * the person has the models, offers them in place, and transfers the bytes.
 *
 * The file ids are paths in Lolly's `sing` model family, and the hosting
 * matches them exactly:
 *   rondocode/phoneme-int8.onnx, rondocode/phoneme.onnx   (phoneme aligner)
 *   rondocode/tts_vector_estimator-int8.onnx, rondocode/tts_vocoder-int8.onnx
 *   rondocode/vec-768.onnx                                (ContentVec encoder)
 *   rondocode/gen_kizuna.onnx, gen_barbara.onnx, gen_rise.onnx (RVC voices;
 *     only the voice a song names is asked for)
 *   supertonic/onnx/{duration_predictor,text_encoder,vector_estimator,
 *     vocoder}.onnx, supertonic/onnx/{tts,unicode_indexer}.json,
 *   supertonic/voice_styles/<voice>.json                  (F1..F5, M1..M5)
 *   wav2vec2/vocab.json                                   (aligner vocabulary)
 *   runtime/ort-wasm-simd-threaded.jsep.wasm              (ONNX Runtime 1.30)
 * The int8 builds are asked for first on every device, with upstream's fp32
 * builds as the fallback upstream already codes (sing/config.ts).
 * ------------------------------------------------------------------------- */

export const VOCAB_URL = 'https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft/resolve/main/vocab.json'
export const VOCAB_FILE = 'wav2vec2/vocab.json'
/** The runtime this build bundles is onnxruntime-web's `ort.bundle` (WebGPU
 *  with a wasm fallback), whose binary is the jsep build. */
export const ORT_WASM_FILE = 'runtime/ort-wasm-simd-threaded.jsep.wasm'

/** The file id for one of upstream's model URLs. */
export function singFileOf(url: string): string {
  if (url === VOCAB_URL) return VOCAB_FILE
  if (url.startsWith(`${SUPERTONIC_BASE}/`)) return `supertonic/${url.slice(SUPERTONIC_BASE.length + 1)}`
  if (url.startsWith(`${SING_MODELS_BASE}/`)) return `rondocode/${url.slice(SING_MODELS_BASE.length + 1)}`
  return url
}

/** A decline (or no connection) ends the clip's whole load: the next file would
 *  only be refused again, or ask the person a second time. An 'error' is about
 *  one file, so the fp32 fallback still gets its turn. Cleared per clip. */
let refused: LollySingRefusal | null = null

/** Start a clip's model loading afresh (singMgr calls this per render). */
export function beginSingLoad(): void {
  refused = null
}

/** True for the error a Lolly refusal produces. */
export function isSingRefusal(e: unknown): e is LollySingRefusal {
  return e instanceof Error && typeof (e as Partial<LollySingRefusal>).lollyReason === 'string'
}

/** The bytes of one model file, by upstream URL or file id. */
export async function singBytes(
  urlOrFile: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  if (lolly === null) throw new Error('singBytes needs the Lolly host')
  if (refused !== null) throw refused
  const file = singFileOf(urlOrFile)
  try {
    const got = await lolly.singModels([file], (p) => onProgress?.(p.done, p.total))
    const bytes = got[file]
    if (!(bytes instanceof ArrayBuffer)) throw new Error(`Lolly sent no bytes for ${file}`)
    return bytes
  } catch (e) {
    if (isSingRefusal(e) && e.lollyReason !== 'error') refused = e
    throw e
  }
}

/** ONNX Runtime set up for this frame: one thread (the frame is not
 *  cross-origin isolated), no proxy worker, and the wasm binary handed over by
 *  Lolly instead of fetched from a CDN. */
export async function prepareOrt(ort: { env: { wasm: { numThreads?: number; proxy?: boolean; wasmBinary?: ArrayBufferLike | Uint8Array } } }): Promise<void> {
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  if (ort.env.wasm.wasmBinary === undefined) ort.env.wasm.wasmBinary = await singBytes(ORT_WASM_FILE)
}
