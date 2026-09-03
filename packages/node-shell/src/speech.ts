// SPDX-License-Identifier: MPL-2.0
/**
 * `host.speech` for the Node shells (CLI, TUI): on-device Kokoro text-to-speech
 * with word timings, and on-device Whisper transcription.
 *
 * SAME MATHS, DIFFERENT PLUMBING (plans/183 section 0.1). Every number comes from
 * code the web shell already runs: the engine's speech-text module owns the
 * normalize / sentence-split / phoneme-chunk / word-span / concat maths, and the
 * web shell's DOM-free lib/speech-whisper.ts owns chunk planning, timestamp
 * repair and the silence gate. So a clip synthesized in the terminal says the
 * same words at the same times as one synthesized in a browser tab. What differs
 * is only the plumbing: the browser posts to two Workers because a 92 MB model
 * must not freeze the tool being typed into; a headless render has no such
 * thread to protect, so this file calls transformers.js directly, which in Node
 * runs on the onnxruntime-node backend.
 *
 * MODELS ARE READ, NEVER FETCHED (plans/183 section 0.2). The model directory is
 * `opts.modelsDir`, else $LOLLY_MODELS_DIR, else the repo's staged
 * `shells/web/public/models` when that exists, else `~/.cache/lolly/models` -
 * the rungs every Node caller shares, resolved by ./models-dir.ts.
 * `env.allowRemoteModels` is false, so nothing here can reach huggingface.co and
 * no text or audio ever leaves the machine. A model that is not on disk is a
 * REFUSAL naming the exact `lolly models fetch <family>` command and the byte
 * size, never a silent download.
 *
 * HONEST AVAILABILITY (plans/183 section 0.3). `isAvailable()` answers whether the
 * runtime can run at all; `cached()` answers the filesystem; a missing model
 * refuses by name. The three are different questions and this file keeps them
 * different.
 *
 * CONDITIONAL ATTACH. `createNodeSpeechAPI()` returns null when
 * `@huggingface/transformers` or `onnxruntime-node` cannot be resolved (a lean
 * install, or the esbuild-bundled Vercel MCP function where bare specifiers stay
 * external). The shell then leaves `host.speech` undefined, which is the state
 * the contract defines - strictly better than an API present that throws on
 * every call. Same stance as images.ts and sharp.
 *
 * The two pure imports below come from `shells/web/src/lib/` rather than the
 * engine. Both are DOM-free by construction (lib/speech-whisper.ts is the pure
 * half its own header describes; lib/tts-blend.ts sits outside the engine only
 * because it consumes the 510x256 voice matrices a shell fetches), so importing
 * them keeps ONE implementation of the numbers, which is the rule that matters.
 */

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KOKORO_DEFAULT_VOICE, KOKORO_MODEL_BYTES, KOKORO_MODEL_ID, KOKORO_SAMPLE_RATE,
  KOKORO_STYLE_DIM, KOKORO_VOICE_BYTES, KOKORO_VOICES, MAX_INPUT_CHARS,
  MAX_SPEECH_SPEED, MIN_SPEECH_SPEED, SENTENCE_GAP_S,
  accentOfBlend, chunkByPhonemeLength, concatClips, isZzfxmRef, parseScriptMarks,
  parseVoiceBlend, parseWav, pauseGapS, phonemeTokenSpans, phonemizeChunk, splitWords,
  wordTimingsFromDurations,
} from '@lolly/engine';
import type { EspeakFn, ScriptSentence, SentenceClip, TtsSegment } from '@lolly/engine';
import type {
  AssetRef, AudioSource, SpeechAPI, SpeechProgress, SpeechResult,
  SpeechSynthesizeOpts, SpeechTranscribeOpts, SpeechTranscript, SpeechVoiceInfo,
  SpeechWordTiming,
} from '@lolly-tools/core/host-v1';
import { blendStyleRow, phonemesForWord } from '../../../shells/web/src/lib/tts-blend.ts';
import {
  WHISPER_MODEL_BYTES, WHISPER_MODEL_ID, WHISPER_SAMPLE_RATE,
  cleanWordTimings, isSilentPcm, joinChunkTexts, planChunks, stitchChunks, whisperLang,
} from '../../../shells/web/src/lib/speech-whisper.ts';
import type { RawWord } from '../../../shells/web/src/lib/speech-whisper.ts';
import { missingPinnedFiles, pinnedBytes, resolveModelsDir } from './models-dir.ts';
import type { ModelFilePin, ModelsDirOptions } from './models-dir.ts';
import { repoRoot } from './repo-root.ts';

/** The two model families this module reads. */
export type SpeechFamily = 'kokoro' | 'whisper';

// The models-directory rungs and the pinned-file presence check are shared with
// the ML runners and with `lolly models`, so they live in one module rather than
// once per family (packages/node-shell/src/models-dir.ts). Re-exported here
// because every existing caller reaches them through this path.
export { resolveModelsDir };
export type { ModelFilePin };

/**
 * The files each family is made of, mirrored from the PINS tables in
 * scripts/fetch-kokoro-models.ts and scripts/fetch-whisper-models.ts (the same
 * bytes, the same hashes, verified against the 2026-08-02 set). Two copies is
 * one copy too many, so packages/node-shell/test/speech.test.ts parses those
 * scripts and fails when the tables drift apart.
 *
 * Both the presence checks here and `lolly models fetch` read this list, so
 * "what a family is" is answered in exactly one place.
 */
export const SPEECH_MODEL_FILES: Record<SpeechFamily, ModelFilePin[]> = {
  kokoro: [
    { path: 'config.json', bytes: 44, sha256: 'df34b4f930b23447cd4dc410fabfb42eb3f24e803e6c3f97d618fb359380a36f' },
    { path: 'tokenizer.json', bytes: 3_497, sha256: '77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34' },
    { path: 'tokenizer_config.json', bytes: 113, sha256: 'be1cb066d6ef6b074b3f15e6a6dd21ac88ff3cdaedf325f0aaed686c70f75d20' },
    { path: 'onnx/model_quantized.onnx', bytes: 92_361_055, sha256: 'c0c02b3299fd97c34ea92a98e6d41eaa1a739c8f77bf685aac34bd7b34c1132c' },
    { path: 'voices/af_alloy.bin', bytes: 522_240, sha256: 'c4a6b876047fd7fb472edf4ebd63cfac7c3b958a7cae7c106e8f038ca6308c45' },
    { path: 'voices/af_aoede.bin', bytes: 522_240, sha256: '4a004c33430762e2461eedb2013fad808ef4ab3121f5300f554476caf58d8361' },
    { path: 'voices/af_bella.bin', bytes: 522_240, sha256: 'f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b' },
    { path: 'voices/af_heart.bin', bytes: 522_240, sha256: 'd583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b' },
    { path: 'voices/af_jessica.bin', bytes: 522_240, sha256: 'a240a5e3c15b43563d6e923bdca8ef5613a23471d9b77653694012435df23bd8' },
    { path: 'voices/af_kore.bin', bytes: 522_240, sha256: '9be5221b6a941c04b561959b8ff0b06e809444dcc4ab7e75a7b23606f691819e' },
    { path: 'voices/af_nicole.bin', bytes: 522_240, sha256: 'cd2191ab31b914ed7b318416b0e4440fdf392ddad9106a060819aa600a64f59a' },
    { path: 'voices/af_nova.bin', bytes: 522_240, sha256: '18778272caa0d0eebaea251c35fd635f038434f9eee5e691d02a174bd328414f' },
    { path: 'voices/af_river.bin', bytes: 522_240, sha256: '00a2bcf82b1d86e8f19902ede58c65ccf6c0e43b44b7d74fad54e5d8933c9c30' },
    { path: 'voices/af_sarah.bin', bytes: 522_240, sha256: '4409fbc125afabacc615d94db5398d847006a737b0247d6892b7a9a0007a2f0a' },
    { path: 'voices/af_sky.bin', bytes: 522_240, sha256: '4435255c9744f3f31659e0d714ab7689bf65d9e77ec1cce060f083912614f0b9' },
    { path: 'voices/am_adam.bin', bytes: 522_240, sha256: '162b035ed91cfc48b6046982184c645f72edcdd1b82843347f605d7bf7b15716' },
    { path: 'voices/am_echo.bin', bytes: 522_240, sha256: '3968b92c3c4cd1c4416dbded36c13eaa388a90d5788d02a13e4d781f5f8cf3c3' },
    { path: 'voices/am_eric.bin', bytes: 522_240, sha256: 'e8b5be17edd1e3636901ce7598baafe2dc8dd8ff707a0c23bf9e461add7e2832' },
    { path: 'voices/am_fenrir.bin', bytes: 522_240, sha256: 'c27989f741f7ee34d273a39d8a595cc0837d35f5ced9a29b7cc162614616df43' },
    { path: 'voices/am_liam.bin', bytes: 522_240, sha256: '52403be32fd047c6a44517cb0bcd6b134f2a18baa73e70ef41651e0eab921ade' },
    { path: 'voices/am_michael.bin', bytes: 522_240, sha256: '1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1' },
    { path: 'voices/am_onyx.bin', bytes: 522_240, sha256: 'da5d135b424164916d75a68ffb4c2abce3d7d5ccc82dd1ee6cf447ce286145e6' },
    { path: 'voices/am_puck.bin', bytes: 522_240, sha256: 'fcf73c989033e9233e0b98713eca600c8c74dcc1614b37009d5450ff4a2274a0' },
    { path: 'voices/am_santa.bin', bytes: 522_240, sha256: '61150cf726ab6c5ed7a99f90a304f91f5a72c00c592e89ec94e5df11c319227a' },
    { path: 'voices/bf_alice.bin', bytes: 522_240, sha256: '08afa6ba24da61ea5e8efa139e5aadc938d83f0a6da5a900adaf763ac1da5573' },
    { path: 'voices/bf_emma.bin', bytes: 522_240, sha256: '669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73' },
    { path: 'voices/bf_isabella.bin', bytes: 522_240, sha256: '3754352c4aaa46d17f27654ab7518d65b62ad6163a0f55a5f4330c2da2c4e94f' },
    { path: 'voices/bf_lily.bin', bytes: 522_240, sha256: '5e0ee32ebe64a467124976b14e69590746f1c4ce41a12b587a50c862edfea335' },
    { path: 'voices/bm_daniel.bin', bytes: 522_240, sha256: '6b3194bbceffb746733cbc22c8f593dd44e401a71d53895a2dca891bc595a1e8' },
    { path: 'voices/bm_fable.bin', bytes: 522_240, sha256: 'f889083196807b4adb15e9204252165f503b8d33d3982e681c52443c49d798f1' },
    { path: 'voices/bm_george.bin', bytes: 522_240, sha256: 'c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc' },
    { path: 'voices/bm_lewis.bin', bytes: 522_240, sha256: 'b8f671cef828c30e66fdf0b0756a76bba58f6bb3398cbbf27058642acbcedb97' },
  ],
  whisper: [
    { path: 'config.json', bytes: 2_243, sha256: 'f4d0608f7d918166da7edb3e188de5ef1bfe70d9802e785d271fd88111e9cf4b' },
    { path: 'generation_config.json', bytes: 3_832, sha256: '61070cf8de25b1e9256e8e102ded49d8d24a8369ed36ef84fdf21549e68125a0' },
    { path: 'preprocessor_config.json', bytes: 339, sha256: 'a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d' },
    { path: 'tokenizer.json', bytes: 2_480_466, sha256: '27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566' },
    { path: 'tokenizer_config.json', bytes: 282_682, sha256: '2e036e4dbacfdeb7242c7d4ec4149f4a16e86026048f94d1637e3a8ee9c6a573' },
    { path: 'onnx/encoder_model_quantized.onnx', bytes: 23_159_167, sha256: '2714484ebe1bae7c1646e8eadb768bb9d415cf11763466d21f23039a29c62e6f' },
    { path: 'onnx/decoder_model_merged_quantized.onnx', bytes: 53_712_708, sha256: 'cf9a8d5bcddc0917a0078135b484cedcaf44f28909cd91910abd29dced9171db' },
  ],
};

/** The directory name each family sits in, which is also its transformers.js model id. */
export const FAMILY_DIR: Record<SpeechFamily, string> = {
  kokoro: KOKORO_MODEL_ID,
  whisper: WHISPER_MODEL_ID,
};

/** Every byte `lolly models fetch <family>` would download. Larger than
 *  `modelBytes()` for kokoro, which reports the ONE-voice consent number the
 *  contract asks for while the fetch stages all 28. */
export function familyBytes(family: SpeechFamily): number {
  return pinnedBytes(SPEECH_MODEL_FILES[family]);
}

/** How this shell resolves the models directory (the rungs and the write policy
 *  are documented on `ModelsDirOptions` in models-dir.ts), plus the one seam
 *  that is speech's own. */
export interface NodeSpeechOptions extends ModelsDirOptions {
  /** Defaults to a `createRequire(import.meta.url).resolve`. Throwing means absent. */
  resolve?: (specifier: string) => string;
}

/** Absolute path of one staged file. */
export function modelFilePath(modelsDir: string, family: SpeechFamily, rel: string): string {
  return join(modelsDir, FAMILY_DIR[family], rel);
}

/** Which of a family's files are not on disk (or are the wrong size, which is
 *  the same thing for a model). The rule itself is `missingPinnedFiles`. */
export function missingModelFiles(
  modelsDir: string,
  family: SpeechFamily,
  only?: (pin: ModelFilePin) => boolean,
): string[] {
  return missingPinnedFiles(join(modelsDir, FAMILY_DIR[family]), SPEECH_MODEL_FILES[family], only);
}

/** What `lolly models ls` reports for one family. */
export interface FamilyStatus {
  family: SpeechFamily;
  dir: string;
  files: number;
  present: number;
  missing: string[];
  bytesOnDisk: number;
  bytesTotal: number;
}

export function familyStatus(modelsDir: string, family: SpeechFamily): FamilyStatus {
  const missing = missingModelFiles(modelsDir, family);
  const pins = SPEECH_MODEL_FILES[family];
  const missingSet = new Set(missing);
  const bytesOnDisk = pins.filter((p) => !missingSet.has(p.path)).reduce((n, p) => n + p.bytes, 0);
  return {
    family,
    dir: join(modelsDir, FAMILY_DIR[family]),
    files: pins.length,
    present: pins.length - missing.length,
    missing,
    bytesOnDisk,
    bytesTotal: familyBytes(family),
  };
}

/** Bytes as the size a person reads in a consent line. */
function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The refusal a missing model produces. It names the files, the directory, the
 * download size and the EXACT command, because "model not found" with none of
 * those is a dead end for whoever hits it in a script.
 */
function missingModelError(
  family: SpeechFamily, modelsDir: string, missing: string[], consentBytes: number,
): Error {
  // Name the BIGGEST missing files first. A list that opens with three config
  // files while the 92 MB weights are the real absence reads as a puzzle; one
  // that opens with model_quantized.onnx says what happened.
  const size = new Map(SPEECH_MODEL_FILES[family].map((p) => [p.path, p.bytes]));
  const bySize = [...missing].sort((a, b) => (size.get(b) ?? 0) - (size.get(a) ?? 0));
  const head = bySize.slice(0, 3).join(', ');
  const more = bySize.length > 3 ? `, and ${bySize.length - 3} more` : '';
  const err = new Error(
    `speech: the ${family} model is not on this machine - missing ${head}${more} under `
    + `${join(modelsDir, FAMILY_DIR[family])}. It is a one-time ${mb(consentBytes)} `
    + `(${consentBytes} bytes) download: run  lolly models fetch ${family}`,
  );
  // The neutral marker a shell reads to classify this: not a failure of the
  // request, a thing this installation does not have yet. The CLI turns it into
  // exit 3 (UNAVAILABLE_HERE) the same way it does a missing browser, and does it
  // off this field rather than off the prose (shells/cli/src/exit-codes.ts).
  // `kind` is the stable machine handle a JSON envelope reports, so a script can
  // branch on MODEL_NOT_STAGED instead of on a sentence we reserve the right to
  // reword (shells/cli/src/exit-codes.ts errorKind).
  return Object.assign(err, { modelMissing: family, kind: 'MODEL_NOT_STAGED' });
}

// ─── the transformers.js runtime, loaded once per models directory ────────────

// Minimal shapes for the transformers.js pieces this file touches - the same four
// operations, and the same rationale, as the web worker's KokoroRuntime: the
// package's own typings are bundler-hostile generics.
interface TensorLike { data: ArrayLike<number | bigint>; dims: number[] }
type TensorCtor = new (type: string, data: Float32Array | number[], dims: number[]) => unknown;
interface KokoroRuntime {
  model: (inputs: Record<string, unknown>) => Promise<{ waveform: TensorLike; durations?: TensorLike }>;
  tokenizer: (text: string, opts: { truncation: boolean }) => { input_ids: TensorLike };
  Tensor: TensorCtor;
  espeak: EspeakFn;
}

interface AsrOutput {
  text: string;
  chunks?: Array<{ text: string; timestamp: [number | null, number | null] }>;
}
type AsrPipeline = (pcm: Float32Array, opts: Record<string, unknown>) => Promise<AsrOutput>;

/** Sessions are keyed by directory so two API instances in one process share the
 *  ~92 MB and ~77 MB loads instead of paying for them twice. */
const kokoroRuntimes = new Map<string, Promise<KokoroRuntime>>();
const whisperRuntimes = new Map<string, Promise<AsrPipeline>>();
/** Voice matrices, keyed `<dir>|<voice>`. 510x256 float32 each. */
const voiceMatrices = new Map<string, Float32Array>();

type ProgressCb = (p: SpeechProgress) => void;

/** transformers.js reports per-file byte progress; sum it into one meter. */
function downloadMeter(total: number, onProgress?: ProgressCb): (p: {
  status?: string; file?: string; loaded?: number; total?: number;
}) => void {
  const loadedByFile = new Map<string, number>();
  return (p): void => {
    if (!onProgress || p.status !== 'progress' || !p.file || typeof p.loaded !== 'number') return;
    loadedByFile.set(p.file, p.loaded);
    let loaded = 0;
    for (const v of loadedByFile.values()) loaded += v;
    onProgress({ phase: 'download', loaded, total, fraction: Math.min(1, loaded / total) });
  };
}

/**
 * Point transformers.js at the local directory, with remote models off. Set
 * immediately before each `from_pretrained`, because `env` is module-global: two
 * API instances on different directories must each stake their claim at the
 * moment they load, not once at import.
 */
function pointAtLocal(env: {
  allowRemoteModels: boolean; allowLocalModels: boolean; localModelPath: string;
}, modelsDir: string): void {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  // A trailing separator, matching the web shell's '/models/': transformers.js
  // joins the model id onto this path.
  env.localModelPath = modelsDir.endsWith('/') ? modelsDir : `${modelsDir}/`;
}

function loadKokoro(modelsDir: string, onProgress?: ProgressCb): Promise<KokoroRuntime> {
  const held = kokoroRuntimes.get(modelsDir);
  if (held) return held;
  const loading = (async (): Promise<KokoroRuntime> => {
    const { env, AutoTokenizer, StyleTextToSpeech2Model, Tensor } = await import('@huggingface/transformers');
    pointAtLocal(env, modelsDir);
    // The voice matrix is read straight off disk by this file, so its bytes come
    // OFF the meter's denominator - counting them would leave the bar short of
    // 100% forever. modelBytes() keeps the full consent sum.
    const progress_callback = downloadMeter(KOKORO_MODEL_BYTES - KOKORO_VOICE_BYTES, onProgress);
    const [model, tokenizer] = await Promise.all([
      // No `device` here on purpose: in Node transformers.js resolves to the
      // onnxruntime-node CPU backend, which is the point of this port. The web
      // worker asks for 'wasm' because that is all a browser has.
      StyleTextToSpeech2Model.from_pretrained(KOKORO_MODEL_ID, { dtype: 'q8', progress_callback }),
      AutoTokenizer.from_pretrained(KOKORO_MODEL_ID, { progress_callback }),
    ]);
    const { phonemize } = await import('phonemizer');
    return {
      model: model as unknown as KokoroRuntime['model'],
      tokenizer: tokenizer as unknown as KokoroRuntime['tokenizer'],
      Tensor: Tensor as unknown as TensorCtor,
      espeak: phonemize as EspeakFn,
    };
  })().catch((e: unknown) => { kokoroRuntimes.delete(modelsDir); throw e; });
  kokoroRuntimes.set(modelsDir, loading);
  return loading;
}

function loadWhisper(modelsDir: string, onProgress?: ProgressCb): Promise<AsrPipeline> {
  const held = whisperRuntimes.get(modelsDir);
  if (held) return held;
  const loading = (async (): Promise<AsrPipeline> => {
    const { env, pipeline } = await import('@huggingface/transformers');
    pointAtLocal(env, modelsDir);
    const progress_callback = downloadMeter(WHISPER_MODEL_BYTES, onProgress);
    const asr = await pipeline('automatic-speech-recognition', WHISPER_MODEL_ID, {
      dtype: 'q8', progress_callback,
    });
    return asr as unknown as AsrPipeline;
  })().catch((e: unknown) => { whisperRuntimes.delete(modelsDir); throw e; });
  whisperRuntimes.set(modelsDir, loading);
  return loading;
}

/** One voice's 510x256 style matrix, read once. */
function voiceMatrix(modelsDir: string, voice: string): Float32Array {
  const key = `${modelsDir}|${voice}`;
  const held = voiceMatrices.get(key);
  if (held) return held;
  const path = modelFilePath(modelsDir, 'kokoro', `voices/${voice}.bin`);
  const raw = readFileSync(path);
  // A Buffer's view is not guaranteed 4-byte aligned, so copy before casting.
  const data = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  if (data.byteLength !== KOKORO_VOICE_BYTES) {
    throw new Error(
      `speech: voice ${voice} is ${data.byteLength} bytes, expected ${KOKORO_VOICE_BYTES} - `
      + 're-stage it with  lolly models fetch kokoro',
    );
  }
  voiceMatrices.set(key, data);
  return data;
}

// ─── abort ────────────────────────────────────────────────────────────────────

function abortError(message: string): Error {
  // DOMException where the platform has one (Node has had it as a global since
  // 17), so `err.name === 'AbortError'` reads the same as an aborted fetch.
  return typeof DOMException !== 'undefined'
    ? new DOMException(message, 'AbortError')
    : Object.assign(new Error(message), { name: 'AbortError' });
}

/**
 * Run `work` and reject PROMPTLY on abort, per the contract: the loop itself
 * stops at the next sentence or chunk boundary (a sentence mid-inference cannot
 * be preempted), but the caller's promise does not wait for that.
 */
function withAbort<T>(
  signal: AbortSignal | undefined,
  message: string,
  work: (aborted: () => boolean) => Promise<T>,
): Promise<T> {
  if (!signal) return work(() => false);
  if (signal.aborted) return Promise.reject(abortError(message));
  let stop = false;
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => { stop = true; reject(abortError(message)); };
    signal.addEventListener('abort', onAbort, { once: true });
    work(() => stop || signal.aborted)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}

// ─── audio in (transcription) ─────────────────────────────────────────────────

/** Formats this shell can name but not decode - the same narrow, honest set
 *  packages/node-shell/src/audio.ts refuses, and for the same reason: Node has
 *  no MP3/AAC/Opus codec, and shelling out to whatever ffmpeg is on PATH would
 *  make a headless transcript depend on a binary nobody declared. */
const NEEDS_PLATFORM_CODEC = /\.(mp3|m4a|aac|ogg|oga|opus|flac|weba|webm|mp4|mov)$/i;

function isRef(src: AudioSource): src is AssetRef {
  return typeof src === 'object' && src !== null && 'url' in src && typeof (src as AssetRef).url === 'string';
}

async function bytesOf(src: AudioSource, root: string): Promise<Uint8Array> {
  if (src instanceof Uint8Array) return src;
  if (src instanceof ArrayBuffer) return new Uint8Array(src);
  const url = isRef(src) ? src.url : src;
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma < 0) throw new Error('speech: malformed data URL');
    const head = url.slice(0, comma);
    const body = url.slice(comma + 1);
    return head.includes(';base64')
      ? new Uint8Array(Buffer.from(body, 'base64'))
      : new Uint8Array(Buffer.from(decodeURIComponent(body), 'binary'));
  }
  if (/^https?:/.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`speech: audio fetch failed (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  if (url.startsWith('file:')) return new Uint8Array(await readFile(fileURLToPath(url)));
  const path = isAbsolute(url) && !url.startsWith('/catalog/') && !url.startsWith('/community/')
    ? url
    : join(root, url.replace(/^\//, ''));
  return new Uint8Array(await readFile(path));
}

/**
 * Resample mono samples. Downsampling averages the source window each output
 * sample covers (a box filter) rather than point-sampling it: 24 kHz speech
 * carries energy above Whisper's 8 kHz Nyquist, and point-sampling would fold
 * that back into the band the mel front end reads. Upsampling interpolates
 * linearly. The browser gets both for free from decodeAudioData at a 16 kHz
 * context; Node has to say what it does.
 */
export function resampleMono(pcm: Float32Array, from: number, to: number): Float32Array {
  if (from === to || pcm.length === 0) return pcm;
  const ratio = from / to;
  const outLen = Math.max(1, Math.floor(pcm.length / ratio));
  const out = new Float32Array(outLen);
  if (ratio > 1) {
    for (let i = 0; i < outLen; i++) {
      const a = i * ratio;
      const b = Math.min(pcm.length, Math.ceil(a + ratio));
      let sum = 0;
      let n = 0;
      for (let j = Math.floor(a); j < b; j++) { sum += pcm[j] as number; n++; }
      out[i] = n ? sum / n : 0;
    }
    return out;
  }
  for (let i = 0; i < outLen; i++) {
    const at = i * ratio;
    const k = Math.floor(at);
    const f = at - k;
    const a = pcm[k] ?? 0;
    const b = pcm[k + 1] ?? a;
    out[i] = a + (b - a) * f;
  }
  return out;
}

/** Average the channels. For speech that is the right downmix, and it is what
 *  the web bridge's decode does. */
function downmix(channels: Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first;
  const mono = new Float32Array(first.length);
  for (const ch of channels) {
    for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] as number) + (ch[i] ?? 0);
  }
  for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] as number) / channels.length;
  return mono;
}

// ─── the API ──────────────────────────────────────────────────────────────────

const RUNTIME_SPECIFIERS = ['@huggingface/transformers', 'onnxruntime-node'];

/** True when the inference runtime resolves here. Sync and cheap - a resolve,
 *  not a load. */
export function isSpeechRuntimeAvailable(resolve?: (specifier: string) => string): boolean {
  const r = resolve ?? createRequire(import.meta.url).resolve;
  try {
    for (const spec of RUNTIME_SPECIFIERS) r(spec);
    return true;
  } catch {
    return false;
  }
}

/** True when the eSpeak phonemizer resolves too. Synthesis needs it;
 *  transcription does not. */
function isPhonemizerAvailable(resolve?: (specifier: string) => string): boolean {
  const r = resolve ?? createRequire(import.meta.url).resolve;
  try {
    r('phonemizer');
    return true;
  } catch {
    return false;
  }
}

/** One model call's output, tagged with the script line it belongs to. */
interface Piece {
  pcm: Float32Array;
  sentence: string;
  wordEntries: SpeechWordTiming[] | null;
  line: number;
}

/**
 * Uniform granularity, per the contract: word-level only when EVERY piece
 * aligned. One misaligned sentence degrades the whole clip to sentence spans
 * rather than handing a caption grouper a mixed array to misread.
 */
function clipsOf(pieces: Piece[], gaps: Map<number, number>): { clips: SentenceClip[]; aligned: boolean } {
  const aligned = pieces.length > 0 && pieces.every((p) => p.wordEntries !== null);
  const clips = pieces.map((p, i) => {
    // A line's leading pause belongs to its FIRST chunk; the chunks one long
    // sentence was split into join with the ordinary sentence gap.
    const gap = i > 0 && (pieces[i - 1] as Piece).line !== p.line ? gaps.get(p.line) : undefined;
    return {
      pcm: p.pcm,
      words: aligned
        ? (p.wordEntries as SpeechWordTiming[])
        : [{ text: p.sentence, start: 0, end: p.pcm.length / KOKORO_SAMPLE_RATE }],
      ...(gap === undefined ? {} : { gapBefore: gap }),
    } satisfies SentenceClip;
  });
  return { clips, aligned };
}

/** Merge concatClips' per-CHUNK segments into one per script LINE, so `segments`
 *  stays one-to-one with the script even when a sentence needed several model
 *  calls. A line that synthesized nothing keeps a zero-width entry. */
function segmentsByLine(segments: TtsSegment[], pieces: Piece[], lines: number): TtsSegment[] {
  const out: TtsSegment[] = [];
  let i = 0;
  for (let line = 0; line < lines; line++) {
    const start = i;
    while (i < segments.length && (pieces[i] as Piece).line === line) i++;
    if (i === start) {
      const at = out.at(-1)?.samples[1] ?? 0;
      const w = out.at(-1)?.words[1] ?? 0;
      out.push({ words: [w, w], samples: [at, at], gapAfter: 0 });
      continue;
    }
    const first = segments[start] as TtsSegment;
    const last = segments[i - 1] as TtsSegment;
    out.push({
      words: [first.words[0], last.words[1]],
      samples: [first.samples[0], last.samples[1]],
      gapAfter: last.gapAfter,
    });
  }
  return out;
}

/** The concatClips gap a line asks for through its own `[pause N]` mark. */
function gapsOf(sentences: ScriptSentence[]): Map<number, number> {
  const gaps = new Map<number, number>();
  for (const [i, s] of sentences.entries()) {
    if (s.gapBefore !== undefined) gaps.set(i, pauseGapS(s.gapBefore));
  }
  return gaps;
}

/** What Node's synthesize hands back: the contract's SpeechResult plus the two
 *  members the web shell's own script paths read (plans/181 section 5.1), so a
 *  headless narration render reads the same object a browser one does. */
export interface NodeSpeechResult extends SpeechResult {
  segments: TtsSegment[];
  script: string[];
}

export interface NodeSpeechAPI extends SpeechAPI {
  synthesize(text: string, opts?: SpeechSynthesizeOpts): Promise<NodeSpeechResult>;
}

/**
 * Build the API, or null when the inference runtime is not installed here (see
 * the module header: the caller then leaves `host.speech` undefined rather than
 * attaching a stub that throws).
 */
export function createNodeSpeechAPI(opts: NodeSpeechOptions = {}): NodeSpeechAPI | null {
  if (!isSpeechRuntimeAvailable(opts.resolve)) return null;
  const modelsDir = resolveModelsDir(opts);
  const root = opts.repoRoot ?? repoRoot();

  /** Refuse before any model loads when the files a request needs are absent. */
  function requireKokoro(voices: string[]): void {
    const wanted = new Set(voices.map((v) => `voices/${v}.bin`));
    const missing = missingModelFiles(modelsDir, 'kokoro', (p) => !p.path.startsWith('voices/') || wanted.has(p.path));
    if (missing.length) throw missingModelError('kokoro', modelsDir, missing, KOKORO_MODEL_BYTES);
  }

  function requireWhisper(): void {
    const missing = missingModelFiles(modelsDir, 'whisper');
    if (missing.length) throw missingModelError('whisper', modelsDir, missing, WHISPER_MODEL_BYTES);
  }

  /** Synthesize a planned run of sentences, one model call per phoneme chunk -
   *  the web worker's synthesizePieces, with postMessage replaced by a callback. */
  async function synthesizePieces(
    plan: Array<{ sentence: ScriptSentence; line: number }>,
    voiceId: string,
    speed: number,
    isAborted: () => boolean,
    onProgress?: ProgressCb,
  ): Promise<Piece[]> {
    // Throws the same "unknown voice" error the worker throws, and does it
    // BEFORE the model loads, so a typo costs nothing.
    const components = parseVoiceBlend(voiceId);
    const language = accentOfBlend(components);
    requireKokoro(components.map((c) => c.id));
    const { model, tokenizer, Tensor, espeak } = await loadKokoro(modelsDir, onProgress);
    const matrices = components.map((c) => voiceMatrix(modelsDir, c.id));
    const weights = components.map((c) => c.w);
    const pieces: Piece[] = [];

    for (let i = 0; i < plan.length; i++) {
      if (isAborted()) throw abortError('speech synthesis aborted');
      const { sentence, line } = plan[i] as { sentence: ScriptSentence; line: number };
      // A sentence-scoped [slow]/[fast]/[speed N] mark beats the clip's rate;
      // both stay inside the range the model remains intelligible in.
      const rate = Math.min(MAX_SPEECH_SPEED, Math.max(MIN_SPEECH_SPEED, sentence.speed ?? speed));

      // Phonemize per WORD, then join with single spaces - that joined string IS
      // the model input, so every word's token span is known by construction. A
      // word the script gave a pronunciation for skips eSpeak entirely.
      const words = sentence.tokens ?? splitWords(sentence.text);
      const wordPhonemes: string[] = [];
      for (const [w, word] of words.entries()) {
        const say = sentence.pronunciations?.[w];
        wordPhonemes.push(say ? phonemesForWord(word, say) : await phonemizeChunk(espeak, word, language));
      }

      for (const chunk of chunkByPhonemeLength(words, wordPhonemes)) {
        if (isAborted()) throw abortError('speech synthesis aborted');
        const phonemes = chunk.phonemes.join(' ');
        const { input_ids } = tokenizer(phonemes, { truncation: true });
        const seqLen = input_ids.dims[input_ids.dims.length - 1] ?? 0;
        // The style row is indexed by token count: the model was trained with a
        // per-length style lookup (rows 0..509).
        const numTokens = Math.min(Math.max(seqLen - 2, 0), 509);
        const style = blendStyleRow(matrices, weights, numTokens);

        const outputs = await model({
          input_ids,
          style: new Tensor('float32', style, [1, KOKORO_STYLE_DIM]),
          speed: new Tensor('float32', [rate], [1]),
        });
        const wave = outputs.waveform.data as Float32Array;

        // Word alignment holds only when the char-level tokenizer invariant does
        // (one token per phoneme char plus BOS/EOS, nothing truncated) AND the
        // timestamped export's durations output is present and one-per-token.
        let wordEntries: SpeechWordTiming[] | null = null;
        if (outputs.durations && seqLen === phonemes.length + 2) {
          const spans = phonemeTokenSpans(chunk.phonemes);
          const times = wordTimingsFromDurations(outputs.durations.data, spans, wave.length, KOKORO_SAMPLE_RATE);
          if (times) wordEntries = chunk.words.map((t, j) => ({ text: t, start: times[j]!.start, end: times[j]!.end }));
        }
        pieces.push({ pcm: wave, sentence: chunk.words.join(' '), wordEntries, line });
      }
      onProgress?.({ phase: 'synthesis', fraction: (i + 1) / plan.length });
    }
    return pieces;
  }

  /** Decode any AudioSource to the 16 kHz mono float PCM Whisper consumes. */
  async function decodePcm16k(src: AudioSource): Promise<Float32Array> {
    const url = isRef(src) ? src.url : typeof src === 'string' ? src : '';
    if (isZzfxmRef(url) || /\.zzfxm\.json$/i.test(url)) {
      throw new Error('speech: a generated ZzFXM song carries no speech to quote back.');
    }
    if (NEEDS_PLATFORM_CODEC.test(url)) {
      throw new Error(
        `speech: ${url.split('.').pop()} needs a platform codec this shell does not have - `
        + 'hand it a WAV, or run it in a browser shell',
      );
    }
    const { channels, sampleRate } = parseWav(await bytesOf(src, root));
    return resampleMono(downmix(channels), sampleRate, WHISPER_SAMPLE_RATE);
  }

  return {
    /** Synthesis needs the inference runtime AND the eSpeak phonemizer. The
     *  factory already proved the first; this adds the second. */
    isAvailable(): boolean {
      return isPhonemizerAvailable(opts.resolve);
    },

    async cached(): Promise<boolean> {
      // Every file the family is made of, which is exactly the set
      // `lolly models fetch kokoro` stages - so cached() true means that command
      // would do nothing. A request for a voice that IS present still succeeds
      // when another voice is missing; synthesize checks per request.
      return missingModelFiles(modelsDir, 'kokoro').length === 0;
    },

    modelBytes(): number {
      return KOKORO_MODEL_BYTES;
    },

    async voices(): Promise<SpeechVoiceInfo[]> {
      // The model's own curation, copied so a caller mutating the list cannot
      // corrupt the source of truth. Which of them are staged is cached()'s
      // question, not this one.
      return KOKORO_VOICES.map((v) => ({ ...v }));
    },

    async synthesize(text: string, synthOpts: SpeechSynthesizeOpts = {}): Promise<NodeSpeechResult> {
      if (text.length > MAX_INPUT_CHARS) {
        throw new Error(
          `speech input too long: ${text.length} chars (max ${MAX_INPUT_CHARS}) - split the text and synthesize in parts`,
        );
      }
      const voiceId = synthOpts.voice ?? KOKORO_DEFAULT_VOICE;
      // Clamp like a UI would: below half pace the model slurs, above double it chirps.
      const speed = Math.min(MAX_SPEECH_SPEED, Math.max(MIN_SPEECH_SPEED, synthOpts.speed ?? 1));
      return withAbort(synthOpts.signal, 'speech synthesis aborted', async (isAborted) => {
        // parseScriptMarks lifts the marks out, normalizes the WHOLE input and
        // only then splits - kokoro.js's order, and it matters both ways.
        const { sentences } = parseScriptMarks(text, { prenormalized: synthOpts.prenormalized === true });
        const pieces = await synthesizePieces(
          sentences.map((sentence, line) => ({ sentence, line })),
          voiceId, speed, isAborted, synthOpts.onProgress,
        );
        const { clips, aligned } = clipsOf(pieces, gapsOf(sentences));
        const { pcm, duration, words, segments } = concatClips(clips, SENTENCE_GAP_S, KOKORO_SAMPLE_RATE);
        return {
          pcm, sampleRate: KOKORO_SAMPLE_RATE, duration, words,
          granularity: words.length === 0 ? 'none' : aligned ? 'word' : 'sentence',
          segments: segmentsByLine(segments, pieces, sentences.length),
          script: sentences.map((s) => s.line),
        };
      });
    },

    /** Transcription needs no phonemizer, so it can be available when synthesis
     *  is not. */
    transcribeAvailable(): boolean {
      return true;
    },

    async transcribeCached(): Promise<boolean> {
      return missingModelFiles(modelsDir, 'whisper').length === 0;
    },

    transcribeModelBytes(): number {
      return WHISPER_MODEL_BYTES;
    },

    async transcribe(src: AudioSource, txOpts: SpeechTranscribeOpts = {}): Promise<SpeechTranscript> {
      if (txOpts.signal?.aborted) throw abortError('speech transcription aborted');
      // Decode first, outside the abort plumbing: a decode failure (bad bytes, a
      // format with no Node codec) should reject with ITS error.
      const pcm = await decodePcm16k(src);
      // Nothing in the clip: answer "nothing" HERE rather than letting a
      // generative decoder invent a line over silence. The empty transcript is
      // the real answer, and it costs no inference.
      if (isSilentPcm(pcm)) return { text: '', words: [], lang: txOpts.lang ?? '', granularity: 'word' };
      requireWhisper();
      return withAbort(txOpts.signal, 'speech transcription aborted', async (isAborted) => {
        const asr = await loadWhisper(modelsDir, txOpts.onProgress);
        const sr = WHISPER_SAMPLE_RATE;
        const chunks = planChunks(pcm, sr);
        const texts: string[] = [];
        const perChunk: SpeechWordTiming[][] = [];
        const offsets: number[] = [];
        // Word granularity holds only when EVERY chunk yielded word spans.
        let allWordAligned = true;

        for (let i = 0; i < chunks.length; i++) {
          if (isAborted()) throw abortError('speech transcription aborted');
          const c = chunks[i]!;
          const chunkDuration = (c.end - c.start) / sr;
          // NO chunk_length_s, ever: each planned chunk already fits Whisper's
          // native 30 s window, so transformers.js's broken-timestamp long-form
          // path (#1358 on this export) is never entered.
          const out = await asr(pcm.slice(c.start, c.end), {
            return_timestamps: 'word',
            ...(txOpts.lang ? { language: whisperLang(txOpts.lang), task: 'transcribe' } : {}),
          });
          texts.push(out.text);
          offsets.push(c.start / sr);
          if (out.chunks && out.chunks.length > 0) {
            const raw: RawWord[] = out.chunks.map((w) => ({ text: w.text, start: w.timestamp[0], end: w.timestamp[1] }));
            perChunk.push(cleanWordTimings(raw, chunkDuration));
          } else {
            allWordAligned = false;
            const text = out.text.trim();
            perChunk.push(text ? [{ text, start: 0, end: chunkDuration }] : []);
          }
          // The synthesis phase name is reused, as in the web worker:
          // SpeechProgress is shared between the two directions.
          txOpts.onProgress?.({ phase: 'synthesis', fraction: (i + 1) / chunks.length });
        }

        return {
          text: joinChunkTexts(texts),
          words: stitchChunks(perChunk, offsets),
          // The pipeline does not surface its auto-detected language, so the
          // honest answer without a hint is 'und' (BCP 47 undetermined).
          lang: txOpts.lang ?? 'und',
          granularity: allWordAligned ? 'word' : 'segment',
        };
      });
    },
  };
}
