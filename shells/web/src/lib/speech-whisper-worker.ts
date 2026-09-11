// SPDX-License-Identifier: MPL-2.0
/**
 * Whisper speech-recognition worker - the STT sibling of
 * lib/speech-kokoro-worker.ts, and deliberately its own worker: the two models
 * have different lifetimes (a session that narrates all day may never
 * transcribe, and vice versa), so neither should pay the other's ~80-90 MB
 * session. Same id-keyed pending-map protocol, per-request progress and
 * cooperative abort (checked between chunks - a chunk mid-inference cannot be
 * preempted in-wasm). Everything heavy (transformers.js, the ~77 MB q8 ONNX
 * pair) loads HERE, dynamically, so none of it can reach the boot chunk.
 *
 * SELF-HOSTED ONLY: the model is served same-origin from /models/whisper/
 * (staged by scripts/fetch-whisper-models.ts) and runs on the onnxruntime-web
 * build transformers.js pins, served from /ort-hf/ (scripts/
 * copy-transformers-ort.ts). Remote models are disabled outright, so no audio
 * or bytes can ever leave the device - the privacy posture the Kokoro worker
 * set, pinned for BOTH workers by lib/speech-kokoro-privacy.test.ts.
 * transformers.js caches the model fetches in the Cache API bucket
 * 'transformers-cache', which is what makes transcription offline after first
 * use and what bridge/speech.ts's transcribeCached() probes.
 *
 * The input is already 16 kHz mono Float32 PCM: a worker has no
 * OfflineAudioContext, so bridge/speech.ts decodes on the main thread (the
 * bridge/audio.ts pattern) and TRANSFERS the samples here. Transcription is
 * per CHUNK, sequentially - planChunks splits at silence near 25 s boundaries
 * because transformers.js's own `chunk_length_s: 30` long-form path yields
 * invalid timestamps on this timestamped export (transformers.js #1358); each
 * manual chunk sits inside Whisper's native 30 s window, so that path is never
 * entered. Word timings come back chunk-relative, get repaired
 * (cleanWordTimings) and offset into the clip timeline (stitchChunks) - see
 * lib/speech-whisper.ts for the maths.
 */

import type { SpeechProgress, SpeechTranscript, SpeechWordTiming } from '@lolly-tools/core/host-v1';
import {
  WHISPER_MODEL_ID, WHISPER_MODEL_BYTES, WHISPER_SAMPLE_RATE,
  planChunks, cleanWordTimings, stitchChunks, joinChunkTexts, whisperLang,
} from './speech-whisper.ts';
import type { RawWord } from './speech-whisper.ts';
import { ORT_HF_BASE } from './ort-hf-base.ts';
import { MODELS_BASE } from './models-base.ts';

export interface TranscribeWorkerRequest {
  id: number;
  type: 'transcribe' | 'abort';
  /** 16 kHz mono samples, transferred from the bridge's decode. */
  pcm?: Float32Array;
  /** BCP 47 hint, or undefined for auto-detect. */
  lang?: string;
}

export interface TranscribeWorkerReply {
  id: number;
  progress?: SpeechProgress;
  result?: SpeechTranscript;
  error?: string;
}

// Worker scope: `postMessage` here is the DedicatedWorkerGlobalScope overload
// (message, transfer), not Window's (message, targetOrigin, transfer).
const post = postMessage as (message: unknown, transfer?: Transferable[]) => void;

/** Requests aborted from the main thread; the transcription loop checks between chunks. */
const aborted = new Set<number>();

// Minimal shape for the one transformers.js piece we touch - its own pipeline
// typings are bundler-hostile generics, and this call is the whole surface.
// `chunks` is the word-level detail `return_timestamps: 'word'` adds; a
// timestamp bound can come back null (model output, repaired downstream).
interface AsrOutput {
  text: string;
  chunks?: Array<{ text: string; timestamp: [number | null, number | null] }>;
}
type AsrPipeline = (pcm: Float32Array, opts: Record<string, unknown>) => Promise<AsrOutput>;

let runtime: Promise<AsrPipeline> | null = null;

/**
 * Load transformers.js + the pipeline, once. Download progress is attributed
 * to the request that triggered the load (`id`) - later requests find the
 * session resident and skip straight to transcription. Unlike Kokoro there is
 * no separately-fetched voice file, so the meter total IS the full model sum.
 */
function ensureRuntime(id: number): Promise<AsrPipeline> {
  if (runtime) return runtime;
  runtime = (async (): Promise<AsrPipeline> => {
    const { env, pipeline } = await import('@huggingface/transformers');

    // Model weights load from `${MODELS_BASE}/models/`. On the web build MODELS_BASE
    // is '' → '/models/' (same-origin, byte-identical to before); the desktop shell
    // bakes VITE_MODELS_BASE=https://lolli.li so it pulls the weights from there
    // once, caches them, then runs offline. The privacy story is unchanged:
    // allowRemoteModels stays false (nothing hits the HF hub), and no audio ever
    // leaves the device - the only fetch is the static model file. The privacy
    // drift-guard test scans for these lines.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = `${MODELS_BASE}/models/`;
    if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = ORT_HF_BASE;

    const loadedByFile = new Map<string, number>();
    const progressCallback = (p: { status?: string; file?: string; loaded?: number; total?: number }): void => {
      if (p.status !== 'progress' || !p.file || typeof p.loaded !== 'number') return;
      loadedByFile.set(p.file, p.loaded);
      let loaded = 0;
      for (const v of loadedByFile.values()) loaded += v;
      post({ id, progress: { phase: 'download', loaded, total: WHISPER_MODEL_BYTES, fraction: Math.min(1, loaded / WHISPER_MODEL_BYTES) } } satisfies TranscribeWorkerReply);
    };

    const asr = await pipeline('automatic-speech-recognition', WHISPER_MODEL_ID, {
      dtype: 'q8', device: 'wasm', progress_callback: progressCallback,
    });
    return asr as unknown as AsrPipeline;
  })().catch((e) => { runtime = null; throw e; });
  return runtime;
}

async function transcribe(id: number, pcm: Float32Array, lang?: string): Promise<SpeechTranscript> {
  const asr = await ensureRuntime(id);
  const sr = WHISPER_SAMPLE_RATE;
  const chunks = planChunks(pcm, sr);

  const texts: string[] = [];
  const perChunk: SpeechWordTiming[][] = [];
  const offsets: number[] = [];
  // Degrade tracking: word granularity holds only when EVERY chunk yielded
  // word spans - one chunk without them degrades the whole clip to segment
  // spans (one per chunk), never a mixed array a caption grouper would misread.
  let allWordAligned = true;

  for (let i = 0; i < chunks.length; i++) {
    if (aborted.has(id)) throw new Error('speech transcription aborted');
    const c = chunks[i]!;
    const chunkDuration = (c.end - c.start) / sr;

    // NO chunk_length_s here, ever - each manual chunk fits Whisper's native
    // 30 s window, so transformers.js's broken-timestamp long-form path
    // (#1358 on this export) is never entered.
    const out = await asr(pcm.slice(c.start, c.end), {
      return_timestamps: 'word',
      ...(lang ? { language: whisperLang(lang), task: 'transcribe' } : {}),
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
    // Reuses the synthesis phase name - SpeechProgress is shared between the
    // two directions, and 'download' vs not-download is all a consent UI keys on.
    post({ id, progress: { phase: 'synthesis', fraction: (i + 1) / chunks.length } } satisfies TranscribeWorkerReply);
  }

  const words = stitchChunks(perChunk, offsets);
  return {
    text: joinChunkTexts(texts),
    words,
    // The pipeline does not surface its auto-detected language, so the honest
    // answer without a hint is 'und' (BCP 47 undetermined), not a guess.
    lang: lang ?? 'und',
    granularity: allWordAligned ? 'word' : 'segment',
  };
}

/** Requests currently transcribing - an abort for an id not in here is stale
 *  (the request already finished) and must not park in `aborted` forever. */
const inFlight = new Set<number>();

addEventListener('message', (e: MessageEvent<TranscribeWorkerRequest>) => {
  const { id, type } = e.data;
  if (type === 'abort') { if (inFlight.has(id)) aborted.add(id); return; }
  const pcm = e.data.pcm ?? new Float32Array(0);
  inFlight.add(id);
  transcribe(id, pcm, e.data.lang)
    .then((result) => post({ id, result } satisfies TranscribeWorkerReply))
    .catch((err) => post({ id, error: err instanceof Error ? err.message : String(err) } satisfies TranscribeWorkerReply))
    .finally(() => { inFlight.delete(id); aborted.delete(id); });
});
