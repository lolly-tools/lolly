// SPDX-License-Identifier: MPL-2.0
/**
 * Whisper transcription - the PURE half: constants and the chunk-planning /
 * timestamp-repair maths, tested in Node with no transformers.js or wasm
 * anywhere near them. In the web shell the worker
 * (lib/speech-whisper-worker.ts) does the model I/O and bridge/speech.ts does
 * the decode-to-PCM and worker plumbing; in Node ./speech.ts does both.
 *
 * MOVED here from `shells/web/src/lib/speech-whisper.ts` (plans/202 WP1.1).
 * ./speech.ts reads the constants and all four helpers, so the Node
 * transcription path had been importing them across the submodule boundary.
 * The web file stays as a re-export shim, so the worker, bridge/speech.ts,
 * bridge/index.ts and speech-whisper.test.ts are unchanged - and a clip
 * transcribed in the terminal still splits at the same points as one in a tab.
 *
 * Why manual chunking exists at all: transformers.js's own long-form path
 * (`chunk_length_s: 30`) yields invalid timestamps on the
 * whisper-base_timestamped export (transformers.js #1358), so the caller must
 * split the clip itself, transcribe each piece inside Whisper's native 30 s
 * window, then offset and stitch the word timings. `planChunks` picks the
 * split points - at the quietest moment near each 25 s boundary, so a word is
 * never cut mid-utterance when any silence exists to cut in - and
 * `stitchChunks` does the offsetting plus the timestamp repair Whisper needs
 * (null ends, occasional non-monotonic spans).
 */
import type { SpeechWordTiming } from '@lolly-tools/core/host-v1';

/** Whisper consumes 16 kHz mono - the bridge decodes/resamples to this. */
export const WHISPER_SAMPLE_RATE = 16000;

/** Directory under localModelPath ('/models/') - see scripts/fetch-whisper-models.ts. */
export const WHISPER_MODEL_ID = 'whisper';

/**
 * One-time download total for the consent UI (host.speech.transcribeModelBytes):
 * the q8 encoder + merged decoder + tokenizer/configs, byte counts mirrored
 * from the PINS table in scripts/fetch-whisper-models.ts - keep in sync.
 */
export const WHISPER_MODEL_BYTES = 23_159_167 + 53_712_708 + 2_480_466 + 282_682 + 2_243 + 3_832 + 339;

/**
 * Silence floors for the pre-inference gate (plans/147 T1a). Whisper is a
 * generative decoder: handed a clip with nothing in it, it does not answer
 * "nothing" - it emits whatever its training data put after silence ("Thank
 * you.", a subtitling credit). That is fabricated text with real timestamps on
 * it, which is the one thing a caption path must never produce, so a clip this
 * quiet is answered as an empty transcript without the model ever seeing it.
 *
 * Both floors must be under-run before a clip counts as silent. RMS alone would
 * mis-gate the pathological case (a few spoken seconds inside a very long
 * recording averages down), and peak alone would be tripped by a single click.
 * Deliberately conservative - roughly -60 dBFS mean and -40 dBFS peak - because
 * a false "silent" throws away real speech, while a false "not silent" only
 * costs the inference we would have run anyway.
 */
export const SILENCE_RMS = 0.001;
export const SILENCE_PEAK = 0.01;

/** Whether a decoded clip holds nothing worth transcribing. One pass, no
 *  allocation - it runs on every clip before the model is even spawned. */
export function isSilentPcm(pcm: Float32Array, rmsFloor = SILENCE_RMS, peakFloor = SILENCE_PEAK): boolean {
  if (!pcm.length) return true;
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i]!;
    sum += v * v;
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  return Math.sqrt(sum / pcm.length) < rmsFloor && peak < peakFloor;
}

/** Aim to split here - comfortably inside the 30 s window. Seconds. */
export const CHUNK_TARGET_S = 25;
/** Whisper's hard window. A chunk must never exceed this. Seconds. */
export const CHUNK_MAX_S = 30;

/** One planned chunk, in SAMPLES relative to the clip start. */
export interface ChunkSpan { start: number; end: number }

/**
 * Split a clip into transcription chunks at the quietest point near each 25 s
 * boundary. A clip that already fits the window comes back as one chunk. The
 * scan is a plain RMS floor over short frames inside the search window
 * [target - back, target + fwd] - no VAD, no model: the quietest 25 ms frame
 * is where speech is least likely to be mid-word, and when the window holds
 * genuine silence the cut lands inside it. Deterministic, so a re-run plans
 * the same cuts.
 */
export function planChunks(
  pcm: Float32Array,
  sampleRate: number,
  targetS: number = CHUNK_TARGET_S,
  maxS: number = CHUNK_MAX_S,
): ChunkSpan[] {
  const maxLen = Math.floor(maxS * sampleRate);
  const chunks: ChunkSpan[] = [];
  let cursor = 0;
  while (pcm.length - cursor > maxLen) {
    // Search the quietest frame between 5 s before and (maxS - targetS) after
    // the target boundary - the upper bound keeps the chunk inside the window.
    const from = cursor + Math.floor((targetS - 5) * sampleRate);
    const to = cursor + maxLen;
    const cut = quietestFrame(pcm, from, to, Math.max(1, Math.floor(0.025 * sampleRate)));
    chunks.push({ start: cursor, end: cut });
    cursor = cut;
  }
  if (pcm.length > cursor) chunks.push({ start: cursor, end: pcm.length });
  return chunks;
}

/** Centre of the minimum-RMS frame of `frameLen` samples in [from, to). */
function quietestFrame(pcm: Float32Array, from: number, to: number, frameLen: number): number {
  let bestAt = from;
  let bestRms = Infinity;
  for (let at = from; at + frameLen <= to; at += frameLen) {
    let sum = 0;
    for (let i = at; i < at + frameLen; i++) sum += pcm[i]! * pcm[i]!;
    const rms = sum / frameLen; // monotonic in true RMS - no sqrt needed to compare
    if (rms < bestRms) { bestRms = rms; bestAt = at; }
  }
  return Math.min(to, bestAt + (frameLen >> 1));
}

/** What one transcribed chunk contributes before stitching. Times are seconds
 *  relative to the CHUNK start; `start`/`end` may be null or out of order - 
 *  Whisper's word timestamps are model output, not bookkeeping, and the
 *  occasional span comes back broken. */
export interface RawWord { text: string; start: number | null; end: number | null }

/**
 * Repair one chunk's word timings: drop empty tokens, fill missing starts from
 * the previous end (0 for the first), fill missing ends from the next start
 * (the chunk length for the last), then clamp everything monotonic and inside
 * [0, chunkDuration]. The result satisfies the contract a caption grouper
 * assumes: start ≤ end, non-decreasing starts, no nulls.
 */
export function cleanWordTimings(raw: RawWord[], chunkDuration: number): SpeechWordTiming[] {
  const kept = raw.map((w) => ({ ...w, text: w.text.trim() })).filter((w) => w.text.length > 0);
  const out: SpeechWordTiming[] = [];
  for (let i = 0; i < kept.length; i++) {
    const w = kept[i]!;
    const prevEnd = out.length > 0 ? out[out.length - 1]!.end : 0;
    let start = isFiniteTime(w.start) ? w.start : prevEnd;
    start = Math.min(chunkDuration, Math.max(start, prevEnd)); // monotonic, in range
    const nextStart = kept.slice(i + 1).find((n) => isFiniteTime(n.start))?.start;
    let end = isFiniteTime(w.end) ? w.end : nextStart ?? chunkDuration;
    end = Math.min(chunkDuration, Math.max(end, start));
    out.push({ text: w.text, start, end });
  }
  return out;
}

function isFiniteTime(t: number | null | undefined): t is number {
  return typeof t === 'number' && Number.isFinite(t) && t >= 0;
}

/**
 * Stitch per-chunk word timings into one clip-relative array: offset each
 * chunk's (already cleaned) words by its start time, and clamp across the
 * seams so a chunk whose last span overshoots its own length cannot make the
 * merged array non-monotonic. Chunks must arrive in clip order.
 */
export function stitchChunks(perChunk: SpeechWordTiming[][], offsetsS: number[]): SpeechWordTiming[] {
  const out: SpeechWordTiming[] = [];
  for (let c = 0; c < perChunk.length; c++) {
    const offset = offsetsS[c] ?? 0;
    for (const w of perChunk[c]!) {
      const prevEnd = out.length > 0 ? out[out.length - 1]!.end : 0;
      const start = Math.max(w.start + offset, prevEnd);
      out.push({ text: w.text, start, end: Math.max(w.end + offset, start) });
    }
  }
  return out;
}

/** Chunk texts → one transcript string, single-spaced. Whisper pads its output
 *  with leading spaces per token; the trim per chunk keeps seams clean. */
export function joinChunkTexts(texts: string[]): string {
  return texts.map((t) => t.trim()).filter((t) => t.length > 0).join(' ');
}

/**
 * A BCP 47 tag reduced to the primary subtag Whisper's language option takes
 * ('en-US' → 'en'). Whisper knows nothing of regions; transformers.js maps
 * the two-letter code to the model's language tokens.
 */
export function whisperLang(lang: string): string {
  return lang.split('-')[0]!.toLowerCase();
}
