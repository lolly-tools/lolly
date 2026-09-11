// SPDX-License-Identifier: MPL-2.0
import { aiAllowed, assertAiAllowed, guardAiWorker } from '../lib/ai-policy.ts';
import { abortError as makeAbortError } from '../lib/util/abort.ts';
import { audioSourceBytes } from '../lib/util/bytes.ts';
/**
 * Web implementation of `host.speech` (v1.96; transcription v1.99) - on-device
 * Kokoro text-to-speech with word timings for captions, and on-device Whisper
 * transcription for audio we didn't synthesise.
 *
 * The division of labour mirrors `host.audio`: this file is only the worker
 * plumbing (id-keyed pending map, progress fan-out, abort) plus, for
 * transcription, the decode-to-PCM (a worker has no OfflineAudioContext, so
 * the decode happens HERE on the main thread, the bridge/audio.ts pattern,
 * and the samples TRANSFER to the worker). The costly work - transformers.js,
 * the eSpeak phonemizer, the ~92 MB Kokoro and ~77 MB Whisper q8 ONNX models -
 * lives entirely inside lib/speech-kokoro-worker.ts and
 * lib/speech-whisper-worker.ts so none of it can block the thread a tool is
 * being typed into, and the pure bookkeeping (sentence split, word spans, PCM
 * concat; chunk planning, timestamp repair) is lib/speech-kokoro.ts and
 * lib/speech-whisper.ts, tested in Node. The two workers are deliberately
 * separate AND separately lazy: the models have different lifetimes, and a
 * session that only narrates should never pay Whisper's session (or vice
 * versa).
 *
 * Everything is same-origin and on-device: the models are served from
 * /models/kokoro/ and /models/whisper/ (staged once by Andy via
 * scripts/fetch-kokoro-models.ts / fetch-whisper-models.ts) with remote models
 * disabled, so neither the text nor the audio ever leaves the machine.
 * `cached()`/`transcribeCached()` probe the Cache API bucket transformers.js
 * writes ('transformers-cache', keyed by the local model path) WITHOUT
 * fetching - that is the essential part of the consent story: a tool can
 * tell "instant" from "one-time download" before any bytes move.
 *
 * One method here is NOT part of the v1 contract: `synthesizeLines` renders
 * named script lines on their own so an edited sentence can be spliced into a
 * saved clip (plans/181 section 5.2). It rides the same worker, the same
 * pending map and the same abort; see {@link WebSpeechAPI}.
 */
import type {
  AudioSource, SpeechAPI, SpeechProgress, SpeechSynthesizeOpts,
  SpeechTranscribeOpts, SpeechTranscript, SpeechVoiceInfo,
} from '@lolly-tools/core/host-v1';
import { KOKORO_MODEL_BYTES, KOKORO_MODEL_ID, KOKORO_VOICES, MAX_INPUT_CHARS } from '../lib/speech-kokoro.ts';
import type {
  SpeechLineResult, SpeechScriptResult, SpeechWorkerReply, SpeechWorkerRequest,
} from '../lib/speech-kokoro-worker.ts';
import { isSilentPcm, WHISPER_MODEL_BYTES, WHISPER_MODEL_ID, WHISPER_SAMPLE_RATE } from '../lib/speech-whisper.ts';
import type { TranscribeWorkerReply, TranscribeWorkerRequest } from '../lib/speech-whisper-worker.ts';
import { MODELS_BASE } from '../lib/models-base.ts';

/** The cache key transformers.js stores the model under (utils/hub.js: the
 *  resolved local path, relative to origin). Probed by cached(), never fetched. */
const MODEL_CACHE_URL = `${MODELS_BASE}/models/${KOKORO_MODEL_ID}/onnx/model_quantized.onnx`;

/** Whisper's q8 pair, same probe. BOTH files - transformers.js caches per file,
 *  and an interrupted first download can leave the encoder cached without the
 *  (much larger) decoder; reporting that as warm would break the consent UI. */
const WHISPER_CACHE_URLS = [
  `${MODELS_BASE}/models/${WHISPER_MODEL_ID}/onnx/encoder_model_quantized.onnx`,
  `${MODELS_BASE}/models/${WHISPER_MODEL_ID}/onnx/decoder_model_merged_quantized.onnx`,
];

/**
 * The web shell's speech bridge: the v1 contract plus the one shell-only
 * method the transcript panel's Regenerate needs. It is NOT on `SpeechAPI`,
 * because a tool has no business re-rendering half a clip; reach it by casting
 * `host.speech`, and check the method is there (the lazy facade in
 * bridge/index.ts forwards it, an older shell would not).
 */
export interface WebSpeechAPI extends SpeechAPI {
  synthesize(text: string, opts?: SpeechSynthesizeOpts): Promise<SpeechScriptResult>;
  /**
   * Synthesize these script lines and hand each back on its own - the
   * regenerate path, which re-renders only the sentences that changed and
   * splices them into the stored clip (plans/181 section 5.2). The lines come
   * from a clip's `tts.script`, so they are already in the model-facing form
   * and `prenormalized` defaults to true here; pass it false only for lines
   * that never went through the normalizer.
   */
  synthesizeLines(lines: string[], opts?: SpeechSynthesizeOpts): Promise<SpeechLineResult[]>;
}

interface Pending {
  resolve: (r: SpeechWorkerReply) => void;
  reject: (e: unknown) => void;
  onProgress?: (p: SpeechProgress) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function ensureWorker(): Worker {
  assertAiAllowed('speech');
  if (worker) return worker;
  worker = guardAiWorker('speech', () => new Worker(new URL('../lib/speech-kokoro-worker.ts', import.meta.url), { type: 'module' }));
  worker.onmessage = (e: MessageEvent<SpeechWorkerReply>): void => {
    const { id, progress, result, lines, error } = e.data;
    const p = pending.get(id);
    if (!p) return; // late reply for an aborted request - already rejected
    if (progress) { p.onProgress?.(progress); return; }
    pending.delete(id);
    if (error || (!result && !lines)) p.reject(new Error(error ?? 'speech synthesis failed'));
    else p.resolve(e.data);
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('speech worker error'));
    pending.clear();
    // Terminate, then drop, the dead worker so the next synthesize() spawns a
    // fresh one - detaching alone would leak the broken thread (and whatever
    // slice of the ~92 MB session it managed to load).
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
    worker = null;
  };
  return worker;
}

interface PendingTranscribe {
  resolve: (r: SpeechTranscript) => void;
  reject: (e: unknown) => void;
  onProgress?: (p: SpeechProgress) => void;
}

let whisperWorker: Worker | null = null;
let whisperSeq = 0;
const pendingTranscribe = new Map<number, PendingTranscribe>();

function ensureWhisperWorker(): Worker {
  assertAiAllowed('transcription');
  if (whisperWorker) return whisperWorker;
  whisperWorker = guardAiWorker('transcription', () => new Worker(new URL('../lib/speech-whisper-worker.ts', import.meta.url), { type: 'module' }));
  whisperWorker.onmessage = (e: MessageEvent<TranscribeWorkerReply>): void => {
    const { id, progress, result, error } = e.data;
    const p = pendingTranscribe.get(id);
    if (!p) return; // late reply for an aborted request - already rejected
    if (progress) { p.onProgress?.(progress); return; }
    pendingTranscribe.delete(id);
    if (error || !result) p.reject(new Error(error ?? 'speech transcription failed'));
    else p.resolve(result);
  };
  whisperWorker.onerror = (): void => {
    for (const p of pendingTranscribe.values()) p.reject(new Error('speech transcription worker error'));
    pendingTranscribe.clear();
    // Terminate-then-drop, like the synthesis worker above: a detached broken
    // thread would leak whatever slice of the ~77 MB session it loaded.
    if (whisperWorker) { whisperWorker.onmessage = null; whisperWorker.onerror = null; whisperWorker.terminate(); }
    whisperWorker = null;
  };
  return whisperWorker;
}

/**
 * Decode any AudioSource to the 16 kHz mono Float32 PCM Whisper consumes.
 * Main thread by necessity (no OfflineAudioContext in a worker); the 16 kHz
 * context makes decodeAudioData itself do the resample (the spec resamples the
 * decode to the context's rate) - one pass, no second render graph - and the
 * downmix is a plain channel average, which is right for speech.
 */
async function decodePcm16k(src: AudioSource): Promise<Float32Array> {
  const bytes = await audioSourceBytes(src);
  const OAC = window.OfflineAudioContext ?? (window as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OAC) throw new Error('no audio decoder in this browser');
  const buf = await new OAC(1, 1, WHISPER_SAMPLE_RATE).decodeAudioData(bytes);
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const mono = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i]! += ch[i]!;
  }
  for (let i = 0; i < mono.length; i++) mono[i]! /= buf.numberOfChannels;
  return mono;
}

/**
 * Post one request to the synthesis worker and wait for its reply, with the
 * abort plumbing both entry points share: reject NOW and tell the worker,
 * which stops at the next sentence boundary (a sentence mid-inference cannot
 * be preempted in-wasm) - its late reply then finds no pending entry and is
 * dropped.
 */
function ask(
  req: Omit<SpeechWorkerRequest, 'id' | 'type'>, opts: SpeechSynthesizeOpts,
): Promise<SpeechWorkerReply> {
  assertAiAllowed('transcription');
      const { signal } = opts;
  const w = ensureWorker();
  const id = ++seq;
  return new Promise<SpeechWorkerReply>((resolve, reject) => {
    const onAbort = (): void => {
      if (!pending.has(id)) return;
      pending.delete(id);
      w.postMessage({ id, type: 'abort' } satisfies SpeechWorkerRequest);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    pending.set(id, {
      resolve: (r) => { signal?.removeEventListener('abort', onAbort); resolve(r); },
      reject: (e) => { signal?.removeEventListener('abort', onAbort); reject(e); },
      onProgress: opts.onProgress,
    });
    w.postMessage({ id, type: 'synthesize', ...req } satisfies SpeechWorkerRequest);
  });
}

export function createSpeechAPI(): WebSpeechAPI {
  return {
    isAvailable(): boolean {
      // Wasm for the model + a worker to run it off-thread. The Worker check is
      // also what answers `false` under jsdom (the CLI omits host.speech for now).
      return aiAllowed('speech') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function';
    },

    async cached(): Promise<boolean> {
      if (typeof caches === 'undefined') return false;
      try {
        const c = await caches.open('transformers-cache');
        return (await c.match(MODEL_CACHE_URL)) !== undefined;
      } catch {
        return false; // Cache API visible but sealed (incognito iframe) - treat as cold
      }
    },

    modelBytes(): number {
      return KOKORO_MODEL_BYTES;
    },

    async voices(): Promise<SpeechVoiceInfo[]> {
      // Static curation (scripts/fetch-kokoro-models.ts stages exactly these);
      // copies so a caller mutating the list cannot corrupt the source of truth.
      return KOKORO_VOICES.map((v) => ({ ...v }));
    },

    async synthesize(text: string, opts: SpeechSynthesizeOpts = {}): Promise<SpeechScriptResult> {
      if (opts.signal?.aborted) throw abortError();
      // Hard bound (well above the UI's soft nudge) - reject BEFORE the text
      // crosses to the worker; the worker re-checks as defence in depth.
      if (text.length > MAX_INPUT_CHARS) {
        throw new Error(
          `speech input too long: ${text.length} chars (max ${MAX_INPUT_CHARS}) - split the text and synthesize in parts`,
        );
      }
      const reply = await ask(
        { text, voice: opts.voice, speed: opts.speed, prenormalized: opts.prenormalized },
        opts,
      );
      return reply.result as SpeechScriptResult;
    },

    async synthesizeLines(lines: string[], opts: SpeechSynthesizeOpts = {}): Promise<SpeechLineResult[]> {
      if (opts.signal?.aborted) throw abortError();
      const chars = lines.reduce((n, l) => n + l.length, 0);
      if (chars > MAX_INPUT_CHARS) {
        throw new Error(
          `speech input too long: ${chars} chars (max ${MAX_INPUT_CHARS}) - split the text and synthesize in parts`,
        );
      }
      if (lines.length === 0) return [];
      // A script line is by definition already normalized (it came out of the
      // normalizer as one line of `tts.script`), and normalizing twice is not
      // the same as normalizing once - '2,024' collapses to '2024' and then
      // reads as the year '20 24'. So the default is the opposite of
      // synthesize()'s, and a caller with raw prose says so.
      const reply = await ask(
        { lines, voice: opts.voice, speed: opts.speed, prenormalized: opts.prenormalized ?? true },
        opts,
      );
      return reply.lines as SpeechLineResult[];
    },

    transcribeAvailable(): boolean {
      // Synthesis's checks plus a decoder: the PCM is decoded on this thread
      // before anything crosses to the Whisper worker.
      return aiAllowed('transcription') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function'
        && (typeof window.OfflineAudioContext === 'function'
          || typeof (window as { webkitOfflineAudioContext?: unknown }).webkitOfflineAudioContext === 'function');
    },

    async transcribeCached(): Promise<boolean> {
      if (typeof caches === 'undefined') return false;
      try {
        const c = await caches.open('transformers-cache');
        for (const url of WHISPER_CACHE_URLS) {
          if ((await c.match(url)) === undefined) return false;
        }
        return true;
      } catch {
        return false; // Cache API visible but sealed (incognito iframe) - treat as cold
      }
    },

    transcribeModelBytes(): number {
      return WHISPER_MODEL_BYTES;
    },

    async transcribe(src: AudioSource, opts: SpeechTranscribeOpts = {}): Promise<SpeechTranscript> {
      const { signal } = opts;
      if (signal?.aborted) throw abortError('speech transcription aborted');
      // Decode first, outside the promise plumbing: a decode failure (bad
      // bytes, dead URL) should reject with ITS error, and an abort during the
      // decode is caught by the re-check before the worker is even spawned.
      const pcm = await decodePcm16k(src);
      if (signal?.aborted) throw abortError('speech transcription aborted');
      // Nothing in the clip: answer "nothing" HERE rather than letting a
      // generative decoder invent a line over silence (see isSilentPcm). The
      // empty transcript is a real answer, the same one an all-silence
      // inference should have given, and it costs no model download.
      if (isSilentPcm(pcm)) return { text: '', words: [], lang: opts.lang ?? '', granularity: 'word' };
      const w = ensureWhisperWorker();
      const id = ++whisperSeq;
      return new Promise<SpeechTranscript>((resolve, reject) => {
        const onAbort = (): void => {
          // Reject NOW and tell the worker, which stops at the next chunk
          // boundary (a chunk mid-inference cannot be preempted in-wasm) - 
          // its late reply then finds no pending entry and is dropped.
          if (!pendingTranscribe.has(id)) return;
          pendingTranscribe.delete(id);
          w.postMessage({ id, type: 'abort' } satisfies TranscribeWorkerRequest);
          reject(abortError('speech transcription aborted'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        pendingTranscribe.set(id, {
          resolve: (r) => { signal?.removeEventListener('abort', onAbort); resolve(r); },
          reject: (e) => { signal?.removeEventListener('abort', onAbort); reject(e); },
          onProgress: opts.onProgress,
        });
        // TRANSFER the samples - minutes of 16 kHz PCM is real memory, and
        // this side never reads them again.
        w.postMessage({ id, type: 'transcribe', pcm, lang: opts.lang } satisfies TranscribeWorkerRequest, [pcm.buffer]);
      });
    },
  };
}

/** This path's AbortError - the shared constructor with the speech message. */
const abortError = (message = 'speech synthesis aborted'): Error => makeAbortError(message);
