// SPDX-License-Identifier: MPL-2.0
/**
 * Kokoro speech-synthesis worker. An 82M-parameter model spending seconds per
 * sentence is real work - it would otherwise freeze the tool being typed into
 * - and everything it needs (transformers.js, the eSpeak phonemizer wasm, the
 * ~92 MB q8 ONNX model) loads HERE, dynamically, so none of it can reach the
 * boot chunk. Same id-keyed pending-map protocol as lib/audio-analyse-worker.ts,
 * plus per-request progress messages and a cooperative abort (checked between
 * sentences - a sentence mid-inference cannot be preempted in-wasm).
 *
 * SELF-HOSTED ONLY: the model is served same-origin from /models/kokoro/
 * (staged by scripts/fetch-kokoro-models.ts) and runs on the onnxruntime-web
 * build transformers.js pins, served from /ort-hf/ (scripts/
 * copy-transformers-ort.ts) - never the /ort/ 1.27 runtime, which is a
 * different, incompatible build. Remote models are disabled outright, so no
 * text or bytes can ever leave the device. transformers.js caches the model
 * fetches in the Cache API bucket 'transformers-cache' (verified in its
 * utils/hub.js - local-path fetches are cached under their path key), which is
 * what makes synthesis offline after first use and what bridge/speech.ts's
 * cached() probes; the voice matrices we fetch ourselves get the same
 * treatment in a 'lolly-speech' bucket.
 *
 * Synthesis is per SENTENCE, sequentially (a sentence whose PHONEMES overrun
 * the model's 510-token budget synthesizes as several word-aligned chunks - 
 * chunkByPhonemeLength): it bounds model input length, gives honest progress,
 * and lets abort land between sentences. Word
 * timings come from the TIMESTAMPED model export's extra `durations` output
 * (one frame count per input token) - see lib/speech-kokoro.ts for the span
 * bookkeeping and why each word is phonemized separately.
 *
 * The script's own marks reach the model through the same per-sentence shape
 * (plans/181): `[slow]`/`[fast]`/`[speed N]` set that sentence's speed tensor,
 * `[pause N]` sets the silence at that one join, and `[word](/ipa/)` replaces
 * what eSpeak would have said for one word. A `+`-joined voice setting mixes
 * the style rows and takes the heaviest component's accent. The reply carries
 * per-LINE sample and word ranges, which is what lets a later edit
 * re-synthesize one sentence and splice it in (lib/tts-splice.ts) instead of
 * re-rendering a two-minute narration to fix a comma.
 */

import type { SpeechProgress, SpeechResult, SpeechWordTiming } from '@lolly-tools/core/host-v1';
import {
  KOKORO_MODEL_ID, KOKORO_SAMPLE_RATE, KOKORO_STYLE_DIM, KOKORO_MODEL_BYTES,
  KOKORO_VOICE_BYTES, KOKORO_DEFAULT_VOICE, SENTENCE_GAP_S,
  MAX_INPUT_CHARS, MIN_SPEECH_SPEED, MAX_SPEECH_SPEED, splitWords, phonemeTokenSpans,
  wordTimingsFromDurations, concatClips, phonemizeChunk, chunkByPhonemeLength,
  parseScriptMarks, parseVoiceBlend, accentOfBlend, pauseGapS,
} from './speech-kokoro.ts';
import type { EspeakFn, ScriptSentence, SentenceClip, TtsSegment } from './speech-kokoro.ts';
import { blendStyleRow, phonemesForWord } from './tts-blend.ts';
import { ORT_HF_BASE } from './ort-hf-base.ts';
import { MODELS_BASE } from './models-base.ts';

export interface SpeechWorkerRequest {
  id: number;
  type: 'synthesize' | 'abort';
  /** The whole script. Mutually exclusive with `lines`. */
  text?: string;
  /**
   * Synthesize these script lines and hand each back on its own, for the
   * regenerate path that re-renders only the sentences that changed
   * (plans/181 section 5.2). Mutually exclusive with `text`.
   */
  lines?: string[];
  /** One voice id, or a `+`-joined weighted blend of them. */
  voice?: string;
  speed?: number;
  /** The text already went through the speech normalizer - skip it. */
  prenormalized?: boolean;
}

/** What one synthesized script line hands back to the splice (plans/181 5.2). */
export interface SpeechLineResult {
  /** This line's samples alone, with no leading or trailing silence. */
  pcm: Float32Array;
  /** Word spans relative to THIS line's start. */
  words: SpeechWordTiming[];
  granularity: SpeechResult['granularity'];
  /**
   * Silence in seconds this line's own `[pause N]` mark asks to have before
   * it, already through pauseGapS, so it is a concatClips gap and not the
   * user's raw request. ABSENT when the line carries no pause mark, which is
   * what tells the splice to leave the silence in front of it exactly as the
   * clip already had it: a line with no mark must not overwrite a `[pause]`
   * the line before it authored.
   */
  gapBefore?: number;
}

/** A whole-script result: SpeechResult plus what makes a line replaceable. */
export interface SpeechScriptResult extends SpeechResult {
  /** One entry per script line, tiling the clip (plans/181 section 5.1). */
  segments: TtsSegment[];
  /** The script as consumed: normalized, one sentence per line, marks kept. */
  script: string[];
}

export interface SpeechWorkerReply {
  id: number;
  progress?: SpeechProgress;
  result?: SpeechScriptResult;
  /** The reply to a `lines` request, parallel to the lines asked for. */
  lines?: SpeechLineResult[];
  error?: string;
}

// Worker scope: `postMessage` here is the DedicatedWorkerGlobalScope overload
// (message, transfer), not Window's (message, targetOrigin, transfer).
const post = postMessage as (message: unknown, transfer?: Transferable[]) => void;

/** Requests aborted from the main thread; the synthesis loop checks between sentences. */
const aborted = new Set<number>();

// Minimal shapes for the transformers.js pieces we touch - its own typings are
// bundler-hostile generics, and the four operations below are the whole surface.
interface TensorLike { data: ArrayLike<number | bigint>; dims: number[] }
type TensorCtor = new (type: string, data: Float32Array | number[], dims: number[]) => unknown;
interface KokoroRuntime {
  model: (inputs: Record<string, unknown>) => Promise<{ waveform: TensorLike; durations?: TensorLike }>;
  tokenizer: (text: string, opts: { truncation: boolean }) => { input_ids: TensorLike };
  Tensor: TensorCtor;
  espeak: EspeakFn;
}

let runtime: Promise<KokoroRuntime> | null = null;

/**
 * Load transformers.js + the model + tokenizer + phonemizer, once. Download
 * progress is attributed to the request that triggered the load (`id`) - later
 * requests find everything resident and skip straight to synthesis.
 */
function ensureRuntime(id: number): Promise<KokoroRuntime> {
  if (runtime) return runtime;
  runtime = (async (): Promise<KokoroRuntime> => {
    const { env, AutoTokenizer, StyleTextToSpeech2Model, Tensor } = await import('@huggingface/transformers');

    // Model weights load from `${MODELS_BASE}/models/`. On the web build MODELS_BASE
    // is '' → '/models/' (same-origin, byte-identical to before); the desktop shell
    // bakes VITE_MODELS_BASE=https://lolli.li so it pulls the weights from there
    // once, caches them (transformers.js Cache API), then runs offline. The privacy
    // story is unchanged: allowRemoteModels stays false, so nothing hits the HF hub
    // and no audio ever leaves the device - the only fetch is the static model file,
    // exactly as in the same-origin case.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = `${MODELS_BASE}/models/`;
    if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = ORT_HF_BASE;

    // One aggregate download meter across the model + tokenizer files. The
    // voice matrix is fetched separately by getVoiceData and never reports
    // here, so its bytes come OFF the denominator - counting them would leave
    // the bar stuck short of 100% forever. modelBytes() keeps the full sum:
    // the consent size stays honest, only the meter's total shrinks.
    const meterTotal = KOKORO_MODEL_BYTES - KOKORO_VOICE_BYTES;
    const loadedByFile = new Map<string, number>();
    const progressCallback = (p: { status?: string; file?: string; loaded?: number; total?: number }): void => {
      if (p.status !== 'progress' || !p.file || typeof p.loaded !== 'number') return;
      loadedByFile.set(p.file, p.loaded);
      let loaded = 0;
      for (const v of loadedByFile.values()) loaded += v;
      post({ id, progress: { phase: 'download', loaded, total: meterTotal, fraction: Math.min(1, loaded / meterTotal) } } satisfies SpeechWorkerReply);
    };

    const [model, tokenizer] = await Promise.all([
      StyleTextToSpeech2Model.from_pretrained(KOKORO_MODEL_ID, { dtype: 'q8', device: 'wasm', progress_callback: progressCallback }),
      AutoTokenizer.from_pretrained(KOKORO_MODEL_ID, { progress_callback: progressCallback }),
    ]);
    const { phonemize } = await import('phonemizer');
    return {
      model: model as unknown as KokoroRuntime['model'],
      tokenizer: tokenizer as unknown as KokoroRuntime['tokenizer'],
      Tensor: Tensor as unknown as TensorCtor,
      espeak: phonemize as EspeakFn,
    };
  })().catch((e) => { runtime = null; throw e; });
  return runtime;
}

/** Voice style matrices (510x256 f32), fetched once and kept - in memory and in the Cache API. */
const voiceCache = new Map<string, Float32Array>();

async function getVoiceData(voice: string): Promise<Float32Array> {
  const hit = voiceCache.get(voice);
  if (hit) return hit;
  const url = `${MODELS_BASE}/models/kokoro/voices/${voice}.bin`;
  let resp: Response | undefined;
  try {
    const c = await caches.open('lolly-speech');
    resp = await c.match(url);
    if (!resp) {
      resp = await fetch(url);
      if (resp.ok) await c.put(url, resp.clone());
    }
  } catch {
    // Cache API unavailable (e.g. some incognito iframes) - plain fetch below.
  }
  if (!resp) resp = await fetch(url);
  if (!resp.ok) throw new Error(`voice fetch failed: ${resp.status} for ${url} - run scripts/fetch-kokoro-models.ts`);
  const data = new Float32Array(await resp.arrayBuffer());
  if (data.byteLength !== KOKORO_VOICE_BYTES) {
    console.warn(`[speech] voice ${voice} is ${data.byteLength} bytes, expected ${KOKORO_VOICE_BYTES}`);
  }
  voiceCache.set(voice, data);
  return data;
}

/** One model call's output, tagged with the script line it belongs to. */
interface Piece {
  pcm: Float32Array;
  sentence: string;
  wordEntries: SpeechWordTiming[] | null;
  /** Index into the script's lines - several chunks can share one. */
  line: number;
}

/** One sentence to synthesize, and which script line it came from. */
interface PlannedSentence { sentence: ScriptSentence; line: number }

/**
 * Synthesize a planned run of sentences, one model call per phoneme chunk.
 *
 * The voice setting is read as a blend (a plain id parses to one component of
 * weight 1, so an unblended voice takes the same path it always did): every
 * component's matrix is fetched once up front, the style row is mixed per
 * chunk, and the eSpeak accent comes from the heaviest component rather than
 * the setting's first letter (plans/181 section 4).
 */
async function synthesizePieces(
  id: number, plan: PlannedSentence[], voiceId: string, speed: number,
): Promise<Piece[]> {
  // Throws the same "unknown voice" error the worker always threw, and does it
  // BEFORE the model loads, so a typo costs nothing.
  const components = parseVoiceBlend(voiceId);
  const language = accentOfBlend(components);
  const { model, tokenizer, Tensor, espeak } = await ensureRuntime(id);
  const matrices: Float32Array[] = [];
  for (const c of components) matrices.push(await getVoiceData(c.id));
  const weights = components.map((c) => c.w);
  const pieces: Piece[] = [];

  for (let i = 0; i < plan.length; i++) {
    if (aborted.has(id)) throw new Error('speech synthesis aborted');
    const { sentence, line } = plan[i] as PlannedSentence;
    // A sentence-scoped [slow]/[fast]/[speed N] mark wins over the clip's rate;
    // both land inside the range the model stays intelligible in.
    const rate = Math.min(MAX_SPEECH_SPEED, Math.max(MIN_SPEECH_SPEED, sentence.speed ?? speed));

    // Phonemize per WORD (already normalized upstream), then join with single
    // spaces - that joined string IS the model input, so each word's token
    // span is known by construction. Sequential on purpose: one eSpeak wasm
    // instance, and reentrancy buys nothing against a model that dwarfs it. A
    // word the script gave a pronunciation for skips eSpeak entirely.
    // `tokens` when the parser has one: a multi-word pronunciation phrase is a
    // single token there, and its pronunciation index counts in those tokens.
    const words = sentence.tokens ?? splitWords(sentence.text);
    const wordPhonemes: string[] = [];
    for (const [w, word] of words.entries()) {
      const say = sentence.pronunciations?.[w];
      wordPhonemes.push(say ? phonemesForWord(word, say) : await phonemizeChunk(espeak, word, language));
    }

    // The raw 400-char wrap in splitSentences is only a cheap pre-pass;
    // normalization can expand text severalfold, so the binding budget check
    // is HERE, on the phonemes the model consumes. Each chunk synthesizes as
    // its own piece - spans/timings hold per chunk by construction - instead
    // of letting the tokenizer truncate silently and drop trailing words.
    for (const chunk of chunkByPhonemeLength(words, wordPhonemes)) {
      if (aborted.has(id)) throw new Error('speech synthesis aborted');
      const phonemes = chunk.phonemes.join(' ');

      const { input_ids } = tokenizer(phonemes, { truncation: true });
      const seqLen = input_ids.dims[input_ids.dims.length - 1] ?? 0;
      // Style row is indexed by token count - the model was trained with a
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
      // (one token per phoneme char + BOS/EOS, nothing truncated) AND the
      // timestamped export's durations output is present and one-per-token.
      let wordEntries: SpeechWordTiming[] | null = null;
      if (outputs.durations && seqLen === phonemes.length + 2) {
        const spans = phonemeTokenSpans(chunk.phonemes);
        const times = wordTimingsFromDurations(outputs.durations.data, spans, wave.length, KOKORO_SAMPLE_RATE);
        // times is span-parallel by construction, so times[j] always exists here.
        if (times) wordEntries = chunk.words.map((t, j) => ({ text: t, start: times[j]!.start, end: times[j]!.end }));
      }
      pieces.push({ pcm: wave, sentence: chunk.words.join(' '), wordEntries, line });
    }
    post({ id, progress: { phase: 'synthesis', fraction: (i + 1) / plan.length } } satisfies SpeechWorkerReply);
  }
  return pieces;
}

/**
 * Uniform granularity, per the contract: word-level only when EVERY piece
 * aligned; one misaligned sentence degrades the whole clip to sentence spans
 * rather than shipping a mixed array a caption grouper would misread.
 */
function clipsOf(pieces: Piece[], gaps: Map<number, number>): { clips: SentenceClip[]; aligned: boolean } {
  const aligned = pieces.length > 0 && pieces.every((p) => p.wordEntries !== null);
  const clips = pieces.map((p, i) => {
    // A line's leading pause belongs to its FIRST chunk; the chunks a long
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

/**
 * Merge concatClips' per-CHUNK segments into one per script LINE. The ranges
 * tile, so a line's span runs from its first chunk's start to its last chunk's
 * end and carries that last chunk's trailing silence. A line that synthesized
 * nothing (it held only marks) still gets a zero-width entry, so `segments`
 * stays one-to-one with the script's lines.
 */
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

/** The concatClips gap a line asks for: its `[pause N]`, or the default. */
function gapsOf(sentences: ScriptSentence[]): Map<number, number> {
  const gaps = new Map<number, number>();
  for (const [i, s] of sentences.entries()) {
    if (s.gapBefore !== undefined) gaps.set(i, pauseGapS(s.gapBefore));
  }
  return gaps;
}

function tooLong(chars: number): Error {
  return new Error(`speech input too long: ${chars} chars (max ${MAX_INPUT_CHARS}) - split the text and synthesize in parts`);
}

async function synthesize(
  id: number, text: string, voiceId: string, speed: number, prenormalized: boolean,
): Promise<SpeechScriptResult> {
  // Defence in depth - bridge/speech.ts already rejects before posting.
  if (text.length > MAX_INPUT_CHARS) throw tooLong(text.length);

  // parseScriptMarks lifts the marks out, normalizes the WHOLE input and only
  // then splits - kokoro.js's order, and it matters both ways: 'Dr.(?= [A-Z])'
  // needs the following word to expand, and '3.5' must become '3 point 5'
  // before the splitter can mistake its dot for a sentence terminator.
  const { sentences } = parseScriptMarks(text, { prenormalized });
  const pieces = await synthesizePieces(
    id, sentences.map((sentence, line) => ({ sentence, line })), voiceId, speed,
  );
  const { clips, aligned } = clipsOf(pieces, gapsOf(sentences));
  const { pcm, duration, words, segments } = concatClips(clips, SENTENCE_GAP_S, KOKORO_SAMPLE_RATE);
  return {
    pcm, sampleRate: KOKORO_SAMPLE_RATE, duration, words,
    granularity: words.length === 0 ? 'none' : aligned ? 'word' : 'sentence',
    segments: segmentsByLine(segments, pieces, sentences.length),
    script: sentences.map((s) => s.line),
  };
}

/**
 * Synthesize each script line on its own, for the regenerate path: only the
 * sentences the user edited are re-rendered, and the splice drops them back
 * into the clip (plans/181 section 5.2). Each line comes back with its own
 * samples, its own word timings from zero, and the silence it asks to have in
 * front of it - everything the splice needs and nothing it has to guess.
 */
async function synthesizeLines(
  id: number, lines: string[], voiceId: string, speed: number, prenormalized: boolean,
): Promise<SpeechLineResult[]> {
  const chars = lines.reduce((n, l) => n + l.length, 0);
  if (chars > MAX_INPUT_CHARS) throw tooLong(chars);

  const plan: PlannedSentence[] = [];
  const gapBefore: Array<number | undefined> = [];
  for (const [line, raw] of lines.entries()) {
    const { sentences } = parseScriptMarks(raw, { prenormalized });
    const first = sentences[0];
    gapBefore.push(first?.gapBefore === undefined ? undefined : pauseGapS(first.gapBefore));
    for (const sentence of sentences) plan.push({ sentence, line });
  }
  const pieces = await synthesizePieces(id, plan, voiceId, speed);

  const out: SpeechLineResult[] = [];
  for (let line = 0; line < lines.length; line++) {
    const mine = pieces.filter((p) => p.line === line);
    // A line asked for is one sentence, so its pieces are chunks of that one
    // sentence and join with the ordinary gap. Should the caller hand over a
    // line that split into two, they join the same way.
    const { clips, aligned } = clipsOf(mine, new Map());
    const { pcm, words } = concatClips(clips, SENTENCE_GAP_S, KOKORO_SAMPLE_RATE);
    const gap = gapBefore[line];
    out.push({
      pcm, words,
      granularity: words.length === 0 ? 'none' : aligned ? 'word' : 'sentence',
      ...(gap === undefined ? {} : { gapBefore: gap }),
    });
  }
  return out;
}

/** Requests currently synthesizing - an abort for an id not in here is stale
 *  (the request already finished) and must not park in `aborted` forever. */
const inFlight = new Set<number>();

addEventListener('message', (e: MessageEvent<SpeechWorkerRequest>) => {
  const { id, type } = e.data;
  if (type === 'abort') { if (inFlight.has(id)) aborted.add(id); return; }
  const voice = e.data.voice ?? KOKORO_DEFAULT_VOICE;
  // Clamp like a UI would: below half pace the model slurs, above double it chirps.
  const speed = Math.min(MAX_SPEECH_SPEED, Math.max(MIN_SPEECH_SPEED, e.data.speed ?? 1));
  const prenormalized = e.data.prenormalized === true;
  const lines = e.data.lines;
  inFlight.add(id);
  const run = lines
    ? synthesizeLines(id, lines, voice, speed, prenormalized)
      .then((results) => post(
        { id, lines: results } satisfies SpeechWorkerReply,
        results.map((r) => r.pcm.buffer),
      ))
    : synthesize(id, e.data.text ?? '', voice, speed, prenormalized)
      .then((result) => post({ id, result } satisfies SpeechWorkerReply, [result.pcm.buffer]));
  run
    .catch((err) => post({ id, error: err instanceof Error ? err.message : String(err) } satisfies SpeechWorkerReply))
    .finally(() => { inFlight.delete(id); aborted.delete(id); });
});
