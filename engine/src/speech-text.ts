// SPDX-License-Identifier: MPL-2.0
/**
 * Speech synthesis text machinery - the PURE half of Kokoro TTS. Everything
 * here is plain math and string work with no transformers.js, no phonemizer
 * wasm and no DOM, so the SAME logic runs in the web worker
 * (shells/web/src/lib/speech-kokoro-worker.ts), in Node scripts
 * (scripts/build-docs-audio.ts) and under test. Same split as analysePcm: the
 * heavy runtime is injectable, the bookkeeping lives in the engine. This
 * follows the roadmap's one-synthesis-layer rule (plans/39-inclusive-audio-roadmap.md section 4).
 *
 * The text-to-phoneme pipeline (normalizeText / splitPunctuation /
 * postProcessPhonemes) is a TypeScript port of hexgrad/kokoro's
 * kokoro.js/src/phonemize.js (Apache-2.0). It is ported rather than depended on
 * because kokoro-js's generate() discards the timestamped model's extra
 * `durations` output, which is the entire reason host.speech can caption
 * itself. Word alignment strategy: each word is phonemized SEPARATELY and the
 * per-word phoneme strings joined with single spaces to form the model input,
 * so every word's token span is known by construction (the Kokoro tokenizer is
 * character-level over phonemes - one token per phoneme char, space included -
 * which `input_ids.length === phonemes.length + 2` verifies at runtime).
 */

import type { SpeechVoiceInfo, SpeechWordTiming } from './bridge/host-v1.ts';

export const KOKORO_SAMPLE_RATE = 24000;
/** transformers.js model id under env.localModelPath ('/models/' in the web shell): /models/kokoro/. */
export const KOKORO_MODEL_ID = 'kokoro';

// The download-size constants (KOKORO_STYLE_DIM / KOKORO_VOICE_BYTES /
// KOKORO_MODEL_BYTES) live in the dependency-free leaf ./speech-model-bytes.ts so the
// web shell's boot-path bridge can read KOKORO_MODEL_BYTES without pulling this whole
// module in. Re-exported here so every existing importer of speech-text keeps working.
export { KOKORO_STYLE_DIM, KOKORO_VOICE_BYTES, KOKORO_MODEL_BYTES } from './speech-model-bytes.ts';

/**
 * The full English voice set staged by scripts/fetch-kokoro-models.ts (keep
 * the two lists in sync). Names/langs/grades are the model's own VOICES table
 * (kokoro.js/src/voices.js, `overallGrade`, verified 2026-08-02). Ordered for
 * a select: en-US then en-GB, highest grade first within each accent, name
 * order within a grade.
 */
export const KOKORO_VOICES: SpeechVoiceInfo[] = [
  { id: 'af_heart', name: 'Heart', lang: 'en-US', gender: 'female', grade: 'A' },
  { id: 'af_bella', name: 'Bella', lang: 'en-US', gender: 'female', grade: 'A-' },
  { id: 'af_nicole', name: 'Nicole', lang: 'en-US', gender: 'female', grade: 'B-' },
  { id: 'af_aoede', name: 'Aoede', lang: 'en-US', gender: 'female', grade: 'C+' },
  { id: 'am_fenrir', name: 'Fenrir', lang: 'en-US', gender: 'male', grade: 'C+' },
  { id: 'af_kore', name: 'Kore', lang: 'en-US', gender: 'female', grade: 'C+' },
  { id: 'am_michael', name: 'Michael', lang: 'en-US', gender: 'male', grade: 'C+' },
  { id: 'am_puck', name: 'Puck', lang: 'en-US', gender: 'male', grade: 'C+' },
  { id: 'af_sarah', name: 'Sarah', lang: 'en-US', gender: 'female', grade: 'C+' },
  { id: 'af_alloy', name: 'Alloy', lang: 'en-US', gender: 'female', grade: 'C' },
  { id: 'af_nova', name: 'Nova', lang: 'en-US', gender: 'female', grade: 'C' },
  { id: 'af_sky', name: 'Sky', lang: 'en-US', gender: 'female', grade: 'C-' },
  { id: 'am_echo', name: 'Echo', lang: 'en-US', gender: 'male', grade: 'D' },
  { id: 'am_eric', name: 'Eric', lang: 'en-US', gender: 'male', grade: 'D' },
  { id: 'af_jessica', name: 'Jessica', lang: 'en-US', gender: 'female', grade: 'D' },
  { id: 'am_liam', name: 'Liam', lang: 'en-US', gender: 'male', grade: 'D' },
  { id: 'am_onyx', name: 'Onyx', lang: 'en-US', gender: 'male', grade: 'D' },
  { id: 'af_river', name: 'River', lang: 'en-US', gender: 'female', grade: 'D' },
  { id: 'am_santa', name: 'Santa', lang: 'en-US', gender: 'male', grade: 'D-' },
  { id: 'am_adam', name: 'Adam', lang: 'en-US', gender: 'male', grade: 'F+' },
  { id: 'bf_emma', name: 'Emma', lang: 'en-GB', gender: 'female', grade: 'B-' },
  { id: 'bm_fable', name: 'Fable', lang: 'en-GB', gender: 'male', grade: 'C' },
  { id: 'bm_george', name: 'George', lang: 'en-GB', gender: 'male', grade: 'C' },
  { id: 'bf_isabella', name: 'Isabella', lang: 'en-GB', gender: 'female', grade: 'C' },
  { id: 'bm_lewis', name: 'Lewis', lang: 'en-GB', gender: 'male', grade: 'D+' },
  { id: 'bf_alice', name: 'Alice', lang: 'en-GB', gender: 'female', grade: 'D' },
  { id: 'bm_daniel', name: 'Daniel', lang: 'en-GB', gender: 'male', grade: 'D' },
  { id: 'bf_lily', name: 'Lily', lang: 'en-GB', gender: 'female', grade: 'D' },
];

/**
 * The default voice everywhere a caller does not name one.
 *
 * `bf_lily` (en-GB) is a BRAND decision, taken 2026-08-02: "lolly" is a
 * British/Australian word, so Lolly's own voice should sound it. Kokoro ships no
 * Australian voice, so en-GB is the closest available reading.
 *
 * Lily is graded D in the table above and Emma B-, and Emma was tried first on
 * exactly that reasoning. It was rejected AFTER LISTENING: Emma reads as robotic
 * at length, Lily sounds on brand. The grade measures acoustic fidelity, not fit,
 * so it decides nothing on its own. See the same call, with the same reasoning,
 * on the docs corpus in scripts/build-docs-audio.ts. Do not "fix" this back to a
 * higher-graded voice from the table without listening to both.
 */
export const KOKORO_DEFAULT_VOICE = 'bf_lily';

/** Silence inserted between sentence clips when concatenating, in seconds. */
export const SENTENCE_GAP_S = 0.35;

/**
 * Sentences longer than this are wrapped on whitespace before synthesis. The
 * model truncates at 510 tokens (~1 phoneme char each), and a run-on sentence
 * must degrade to an extra split, never to silently dropped words.
 */
const MAX_SENTENCE_CHARS = 400;

/**
 * Hard cap on `synthesize()` input, enforced in bridge/speech.ts before the
 * text is posted to the worker AND in the worker itself (defence in depth).
 * Well above the UI's soft ~5000-char nudge. This is the "someone pasted a
 * novel" guard, not a product limit: at seconds per sentence the model would
 * grind for hours, and the caller should chunk deliberately instead.
 */
export const MAX_INPUT_CHARS = 100_000;

/**
 * The model consumes the space-joined PHONEME string, hard-capped at 510
 * tokens (one per char, plus BOS/EOS). The raw-char wrap in wrapLong is only a
 * cheap pre-pass: normalization can expand text severalfold ('$45' → '45
 * dollars' → yet more phoneme chars), so the real budget check happens on the
 * phonemes the model actually sees. See chunkByPhonemeLength.
 */
export const MAX_PHONEME_CHARS = 508; // 510 tokens minus BOS/EOS

// ─── Sentence and word splitting ──────────────────────────────────────────────

/**
 * Split text into sentences on terminal punctuation (., !, ?, …), keeping the
 * punctuation - and any closing quotes/brackets riding it - attached to the
 * sentence it ends. Newlines also terminate a sentence: a heading or a list
 * line is spoken as its own breath group even without a full stop.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    // Sentence body, terminator run, then trailing closers ("  ”  »  )  ]  ').
    const re = /[^.!?…]+(?:[.!?…]+["”»)\]']*|$)/g;
    for (const m of line.match(re) ?? []) {
      const s = m.trim();
      if (s) out.push(...wrapLong(s));
    }
  }
  return out;
}

/** Wrap an over-long sentence on whitespace into chunks under MAX_SENTENCE_CHARS. */
function wrapLong(sentence: string): string[] {
  if (sentence.length <= MAX_SENTENCE_CHARS) return [sentence];
  const words = sentence.split(/\s+/);
  const chunks: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > MAX_SENTENCE_CHARS) {
      // A single word longer than the limit (a URL, a hash, key-mash) cannot
      // wrap on whitespace. Force-split it at the boundary rather than letting
      // the model silently truncate it downstream.
      if (cur) { chunks.push(cur); cur = ''; }
      let rest = w;
      while (rest.length > MAX_SENTENCE_CHARS) {
        chunks.push(rest.slice(0, MAX_SENTENCE_CHARS));
        rest = rest.slice(MAX_SENTENCE_CHARS);
      }
      cur = rest;
      continue;
    }
    if (cur && cur.length + 1 + w.length > MAX_SENTENCE_CHARS) { chunks.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Split a sentence into words on whitespace, punctuation kept attached. */
export function splitWords(sentence: string): string[] {
  return sentence.split(/\s+/).filter((w) => w.length > 0);
}

// ─── Word-span bookkeeping ────────────────────────────────────────────────────

/** A word's token span [start, end) in the model's input_ids (BOS at index 0). */
export interface TokenSpan { start: number; end: number }

/**
 * Char-to-token spans for per-word phoneme strings joined with single spaces.
 * The Kokoro tokenizer is character-level, and the tokenizer wraps the
 * sequence in BOS/EOS zeros, so word i's tokens are exactly its char range in
 * the joined string, shifted +1 for BOS. A word that phonemized to '' gets a
 * zero-width span (start === end) rather than being dropped, so the caller's
 * words array stays parallel.
 */
export function phonemeTokenSpans(wordPhonemes: string[]): TokenSpan[] {
  const spans: TokenSpan[] = [];
  let pos = 0;
  for (const [i, ph] of wordPhonemes.entries()) {
    if (i > 0) pos += 1; // the joining space
    spans.push({ start: 1 + pos, end: 1 + pos + ph.length });
    pos += ph.length;
  }
  return spans;
}

/** A run of words plus their per-word phoneme strings, parallel by construction. */
export interface PhonemeChunk { words: string[]; phonemes: string[] }

/**
 * Split a sentence's word list into chunks whose space-joined phoneme strings
 * fit the model's token budget. Chunk boundaries are word boundaries, so each
 * chunk's spans/timings hold by construction and every input word lands in
 * exactly one chunk, in order. Greedy fill; a single word whose phonemes alone
 * exceed the budget still gets its own chunk (the tokenizer truncates that one
 * word) rather than being dropped. This is pathological, but it never causes
 * silent word loss across the rest of the sentence.
 */
export function chunkByPhonemeLength(
  words: string[],
  wordPhonemes: string[],
  maxChars: number = MAX_PHONEME_CHARS,
): PhonemeChunk[] {
  const chunks: PhonemeChunk[] = [];
  let curWords: string[] = [];
  let curPhonemes: string[] = [];
  let curLen = 0;
  for (let i = 0; i < words.length; i++) {
    const ph = wordPhonemes[i] ?? '';
    if (curWords.length > 0 && curLen + 1 + ph.length > maxChars) {
      chunks.push({ words: curWords, phonemes: curPhonemes });
      curWords = []; curPhonemes = []; curLen = 0;
    }
    curWords.push(words[i] as string);
    curPhonemes.push(ph);
    curLen += (curWords.length > 1 ? 1 : 0) + ph.length;
  }
  if (curWords.length > 0) chunks.push({ words: curWords, phonemes: curPhonemes });
  return chunks;
}

/**
 * Per-word times from the timestamped model's `durations` output - one frame
 * count per input token (BOS/EOS included). Rather than trusting a fixed frame
 * rate the divisor is DERIVED from the clip itself: total frames over actual
 * audio seconds, which by definition lands every word inside the waveform.
 * (Measured on the q8 export: ~40 frames/s - sum(durations) 112.96 over a
 * 2.80 s clip, NOT the 80 some community posts quote; deriving it makes the
 * constant irrelevant either way.) Returns
 * null when the shapes disagree (durations not one-per-token). The caller
 * falls back to sentence granularity rather than shipping wrong captions.
 */
export function wordTimingsFromDurations(
  durations: ArrayLike<number | bigint>,
  spans: TokenSpan[],
  waveformLength: number,
  sampleRate: number,
): Array<{ start: number; end: number }> | null {
  const n = durations.length;
  const last = spans.at(-1);
  const expected = last ? last.end + 1 : 2;
  if (n !== expected || waveformLength <= 0) return null;

  // Prefix sums: pre[k] = frames before token k. Every index below is in
  // [0, n] by construction, so the non-null assertions are shape facts.
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i]! + Number(durations[i]!);
  const totalFrames = pre[n]!;
  if (!(totalFrames > 0)) return null;

  const framesPerSecond = totalFrames / (waveformLength / sampleRate);
  return spans.map((s) => ({
    start: pre[s.start]! / framesPerSecond,
    end: pre[s.end]! / framesPerSecond,
  }));
}

// ─── Clip concatenation ───────────────────────────────────────────────────────

export interface SentenceClip {
  pcm: Float32Array;
  words: SpeechWordTiming[];
  /**
   * Silence in seconds before THIS clip, overriding concatClips' default
   * `gapS` at that one join (plans/181 section 3, the `[pause N]` mark).
   * Ignored on the first clip, because nothing precedes it. A parsed
   * `[pause N]` is the silence the user asked to HEAR, so pass it through
   * pauseGapS() before setting this.
   */
  gapBefore?: number;
}

/**
 * One script line's place in a finished clip (plans/181 section 5.1). The
 * ranges TILE the clip: `samples[1]` of one entry is `samples[0]` of the next,
 * so a segment's span covers its own audio plus the silence that follows it,
 * and `gapAfter` says how many of those trailing samples are that silence.
 * `words` is a half-open index range into the clip's `words[]`.
 *
 * That tiling is what makes one sentence replaceable: copy [0, samples[0]),
 * drop the new audio in, copy from samples[1] on, and every untouched sample
 * is unchanged.
 */
export interface TtsSegment {
  /** Half-open word index range [i0, i1) into the clip's words array. */
  words: [number, number];
  /** Half-open sample range [s0, s1) of this line plus its trailing silence. */
  samples: [number, number];
  /** How many of the trailing samples in `samples` are inserted silence. */
  gapAfter: number;
}

/**
 * Concatenate per-sentence clips into one mono buffer with `gapS` of silence
 * between sentences (none after the last), offsetting each clip's word timings
 * into the combined timeline. A clip carrying `gapBefore` replaces `gapS` at
 * its own join. Also reports the per-clip TtsSegment tiling, which the caller
 * merges per script line when one line synthesized as several chunks.
 */
export function concatClips(
  clips: SentenceClip[],
  gapS: number,
  sampleRate: number,
): { pcm: Float32Array; duration: number; words: SpeechWordTiming[]; segments: TtsSegment[] } {
  const gaps = clips.map((c, i) =>
    i === 0 ? 0 : Math.round(Math.max(0, c.gapBefore ?? gapS) * sampleRate));
  let total = 0;
  for (const [i, clip] of clips.entries()) total += clip.pcm.length + (gaps[i] as number);

  const pcm = new Float32Array(total);
  const words: SpeechWordTiming[] = [];
  const audioStarts: number[] = [];
  const wordStarts: number[] = [];
  let offset = 0;
  for (const [i, clip] of clips.entries()) {
    offset += gaps[i] as number;
    audioStarts.push(offset);
    wordStarts.push(words.length);
    pcm.set(clip.pcm, offset);
    const t0 = offset / sampleRate;
    for (const w of clip.words) words.push({ text: w.text, start: t0 + w.start, end: t0 + w.end });
    offset += clip.pcm.length;
  }
  const segments: TtsSegment[] = clips.map((_, i) => ({
    words: [wordStarts[i] as number, (wordStarts[i + 1] ?? words.length) as number],
    samples: [audioStarts[i] as number, (audioStarts[i + 1] ?? total) as number],
    gapAfter: (gaps[i + 1] ?? 0) as number,
  }));
  return { pcm, duration: total / sampleRate, words, segments };
}

/** Silence a boundary must already carry for a legacy clip's seam to sit in it. */
export const MIN_SEAM_GAP_S = 0.2;

/**
 * True when a word carries terminal punctuation, closing quotes and brackets
 * included, so it is the last word of its sentence. Same terminator set as
 * splitSentences, applied to one word.
 */
export function endsSentence(word: string): boolean {
  return /[.!?…]["”»)\]']*$/.test(word);
}

/**
 * Segments for a clip saved before the pipeline recorded them (plans/181
 * section 5.1 and ruling 10): a sentence ends at a word carrying terminal
 * punctuation, and the seam goes at the MIDPOINT of the silence that follows,
 * which is the deepest point of a gap the pipeline itself synthesized.
 *
 * Returns null when any boundary has less than `minGapS` of silence, because
 * there is then no safe place to cut and the caller must re-synthesize the
 * whole clip once. Also null for an empty word list.
 *
 * `gapAfter` is 0 on every derived segment: the ranges tile, so the silence
 * sits INSIDE them and its exact width is not recoverable from word times
 * alone. `totalSamples` extends the last segment to the end of the clip; left
 * out, it ends at the last word.
 */
export function deriveSegmentsFromWords(
  words: SpeechWordTiming[],
  sampleRate: number,
  minGapS: number = MIN_SEAM_GAP_S,
  totalSamples?: number,
): TtsSegment[] | null {
  if (words.length === 0 || !(sampleRate > 0)) return null;
  const ends: number[] = [];
  const seams: number[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const here = words[i] as SpeechWordTiming;
    const next = words[i + 1] as SpeechWordTiming;
    if (!endsSentence(here.text)) continue;
    if (!(next.start - here.end >= minGapS)) return null;
    ends.push(i);
    seams.push(Math.round(((here.end + next.start) / 2) * sampleRate));
  }
  const lastEnd = Math.max(0, Math.round((words.at(-1) as SpeechWordTiming).end * sampleRate));
  const total = totalSamples != null && totalSamples > lastEnd ? totalSamples : lastEnd;
  const out: TtsSegment[] = [];
  let w0 = 0;
  let s0 = 0;
  for (const [k, end] of ends.entries()) {
    const seam = Math.max(s0, Math.min(total, seams[k] as number));
    out.push({ words: [w0, end + 1], samples: [s0, seam], gapAfter: 0 });
    w0 = end + 1;
    s0 = seam;
  }
  out.push({ words: [w0, words.length], samples: [s0, Math.max(s0, total)], gapAfter: 0 });
  return out;
}

// ─── Text→phoneme pipeline (port of kokoro.js/src/phonemize.js) ───────────────

function splitNum(match: string): string {
  if (match.includes('.')) return match;
  if (match.includes(':')) {
    const [h = 0, m = 0] = match.split(':').map(Number);
    if (m === 0) return `${h} o'clock`;
    if (m < 10) return `${h} oh ${m}`;
    return `${h} ${m}`;
  }
  const year = parseInt(match.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return match;
  const left = match.slice(0, 2);
  const right = parseInt(match.slice(2, 4), 10);
  const suffix = match.endsWith('s') ? 's' : '';
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${suffix}`;
    if (right < 10) return `${left} oh ${right}${suffix}`;
  }
  return `${left} ${right}${suffix}`;
}

function flipMoney(match: string): string {
  const bill = match[0] === '$' ? 'dollar' : 'pound';
  if (Number.isNaN(Number(match.slice(1)))) return `${match.slice(1)} ${bill}s`;
  if (!match.includes('.')) {
    const suffix = match.slice(1) === '1' ? '' : 's';
    return `${match.slice(1)} ${bill}${suffix}`;
  }
  const [b = '', c = ''] = match.slice(1).split('.');
  const d = parseInt(c.padEnd(2, '0'), 10);
  const coins = match[0] === '$' ? (d === 1 ? 'cent' : 'cents') : d === 1 ? 'penny' : 'pence';
  return `${b} ${bill}${b === '1' ? '' : 's'} and ${d} ${coins}`;
}

function pointNum(match: string): string {
  const [a = '', b = ''] = match.split('.');
  return `${a} point ${b.split('').join(' ')}`;
}

/** Verbatim port of kokoro.js's normalize_text (quotes, abbreviations, numbers, currency). */
export function normalizeText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/«/g, '“')
    .replace(/»/g, '”')
    .replace(/[“”]/g, '"')
    .replace(/\(/g, '«')
    .replace(/\)/g, '»')
    .replace(/、/g, ', ')
    .replace(/。/g, '. ')
    .replace(/！/g, '! ')
    .replace(/，/g, ', ')
    .replace(/：/g, ': ')
    .replace(/；/g, '; ')
    .replace(/？/g, '? ')
    .replace(/[^\S \n]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/(?<=\n) +(?=\n)/g, '')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor')
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister')
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss')
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc')
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitNum)
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, flipMoney)
    .replace(/\d*\.\d+/g, pointNum)
    .replace(/(?<=\d)-(?=\d)/g, ' to ')
    .replace(/(?<=\d)S/g, ' S')
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, 's')
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, '-'))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, '-')
    .trim();
}

/**
 * The Kokoro tokenizer's 115 symbols, in its own vocab order. Mirrored here
 * rather than imported: tokenizer.json is a web-shell asset and the engine
 * stays platform free. tests/speech-text.test.ts re-reads
 * shells/web/public/models/kokoro/tokenizer.json and fails if the two disagree.
 *
 * The tokenizer's Replace normalizer DELETES every character outside this set,
 * silently, before tokenizing. One deleted character breaks
 * `input_ids.length === phonemes.length + 2`, the word-span invariant fails,
 * and the whole clip falls back to sentence-granular timings. Measured
 * 2026-09-03: every one of the 48 matrix cells containing a parenthesis broke
 * exactly this way (plans/181 section 11). The combining tilde is written as an
 * escape because it is invisible on its own.
 */
export const KOKORO_VOCAB =
  '$;:,.!?—…"()“” ̃ʣʥʦʨᵝꭧAIOQSTWYᵊabcdefhijklmnopqrstuvwxyz' +
  'ɑɐɒæβɔɕçɖðʤəɚɛɜɟɡɥɨɪʝɯɰŋɳɲɴøɸθœɹɾɻʁɽʂʃʈʧʊʋʌɣɤχʎʒʔˈˌːʰʲ↓→↗↘ᵻ';

const VOCAB_SET = new Set([...KOKORO_VOCAB]);

/**
 * Drop every character the tokenizer would delete, so what we count is what it
 * tokenizes (plans/181 section 7). Applied per word inside phonemizeChunk,
 * before chunkByPhonemeLength counts anything, and to a hand-written
 * pronunciation override.
 */
export function filterToVocab(phonemes: string): string {
  let out = '';
  for (const ch of phonemes) if (VOCAB_SET.has(ch)) out += ch;
  return out;
}

/**
 * normalizeText plus the one correction the port needs. kokoro.js maps `(` to
 * the left guillemet and `)` to the right one, and neither guillemet is in
 * KOKORO_VOCAB, so both are deleted at tokenize time and take the word
 * alignment with them. The brackets themselves ARE in the vocabulary (tokens
 * 12 and 13), so putting them back is safe and closer to what the model was
 * trained on. The port stays verbatim; this is our own step after it.
 *
 * The reversal is exact: every guillemet in normalizeText's output came from a
 * bracket in the input, because an input guillemet is folded to a straight
 * quote earlier in the same chain. Use this, not normalizeText, anywhere text
 * is on its way to the model.
 */
export function normalizeForSpeech(text: string): string {
  return normalizeText(text).replace(/«/g, '(').replace(/»/g, ')');
}

const PUNCTUATION = ';:,.!?¡¿\u2014…"«»“”(){}[]';
const PUNCTUATION_PATTERN = new RegExp(
  `(\\s*[${PUNCTUATION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+\\s*)+`,
  'g',
);

/** Split on punctuation runs KEEPING them, so they pass through phonemization verbatim. */
export function splitPunctuation(text: string): Array<{ match: boolean; text: string }> {
  const result: Array<{ match: boolean; text: string }> = [];
  let prev = 0;
  for (const m of text.matchAll(PUNCTUATION_PATTERN)) {
    if (prev < m.index) result.push({ match: false, text: text.slice(prev, m.index) });
    if (m[0].length > 0) result.push({ match: true, text: m[0] });
    prev = m.index + m[0].length;
  }
  if (prev < text.length) result.push({ match: false, text: text.slice(prev) });
  return result;
}

/** Kokoro's post-phonemization fixups (pronunciation corrections, IPA normalization). */
export function postProcessPhonemes(ps: string, language: 'a' | 'b'): string {
  let processed = ps
    .replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ')
    .replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ')
    .replace(/ʲ/g, 'j')
    .replace(/r/g, 'ɹ')
    .replace(/x/g, 'k')
    .replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
    .replace(/ z(?=[;:,.!?¡¿\u2014…"«»“” ]|$)/g, 'z');
  if (language === 'a') processed = processed.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  return processed.trim();
}

/** The eSpeak call, injectable so the pipeline is testable without the wasm. */
export type EspeakFn = (text: string, lang: string) => Promise<string[]>;

/**
 * Full phonemize pipeline for one chunk of (already normalized) text:
 * kokoro.js's phonemize() with `norm` hoisted to the caller. The worker runs
 * normalizeText once over the WHOLE input before sentence splitting (kokoro.js
 * order, because abbreviation/number rules need cross-word context like
 * '(?= [A-Z])'), so by the time a word reaches here it is already normalized.
 *
 * The result is filtered to KOKORO_VOCAB last (plans/181 section 7). Both
 * halves of the join can carry a symbol the tokenizer would delete: eSpeak may
 * emit an IPA character outside the model's set, and a punctuation run passes
 * through verbatim, brackets and inverted marks included. Dropping them HERE,
 * per word, is what keeps `input_ids.length === phonemes.length + 2` true and
 * the clip word-aligned.
 */
export async function phonemizeChunk(
  espeak: EspeakFn,
  text: string,
  language: 'a' | 'b',
): Promise<string> {
  const sections = splitPunctuation(text);
  const lang = language === 'a' ? 'en-us' : 'en';
  const ps = (await Promise.all(
    sections.map(async ({ match, text: t }) => (match ? t : (await espeak(t, lang)).join(' '))),
  )).join('');
  return filterToVocab(postProcessPhonemes(ps, language)).trim();
}

// ─── Script marks: pause, speed, pronunciation (plans/181 sections 3 and 8) ────

/**
 * `[pause]` with no number, in seconds.
 *
 * A `[pause N]` mark SETS the silence at a join, it does not add to it, and a
 * plain join already sounds like CLIP_EDGE_PAD_S + SENTENCE_GAP_S - about
 * 0.95 s. So the unqualified default has to sit above that number. At the
 * 0.6 s the plan first guessed, pauseGapS(0.6) came out 0 and the chip
 * labelled "Silence before the next sentence" made the join SHORTER than
 * typing nothing at all, which is the opposite of what it says on the button.
 * 1.2 s is a beat the listener can hear against the 0.95 s a plain join has.
 */
export const PAUSE_DEFAULT_S = 1.2;
/** The rate `[slow]` sets. Phase 0 rendered exactly this and measured 1.13-1.17x. */
export const SLOW_SPEED = 0.85;
/** The rate `[fast]` sets. Phase 0 rendered exactly this and measured 0.90-0.92x. */
export const FAST_SPEED = 1.15;
/** Below half pace the model slurs, above double it chirps. */
export const MIN_SPEECH_SPEED = 0.5;
export const MAX_SPEECH_SPEED = 2;

/**
 * How much silence a join already has before concatClips adds any, in seconds:
 * the leading clip's lead-out plus the following clip's lead-in.
 *
 * Measured 2026-09-03 (plans/181 section 11 item 5): asking for a 1.0 s pause
 * produced 1.51 to 1.66 s of audible silence on bf_lily, the default voice,
 * and up to 2.02 s on am_michael. 0.6 is the middle of the default voice's
 * band. Padding is a property of the voice, so this cannot be exact for all
 * 28; it turns a mark that overshot by two thirds into one that is close.
 */
export const CLIP_EDGE_PAD_S = 0.6;

/**
 * The concatClips gap that makes `[pause N]` sound like N seconds: the request
 * minus the padding the two clips already contribute, never below zero. A
 * request under CLIP_EDGE_PAD_S cannot be honoured, because the padding is
 * already longer than the pause asked for.
 *
 * The mark SETS the silence at that join rather than adding to it, so an N
 * below CLIP_EDGE_PAD_S + SENTENCE_GAP_S deliberately makes the join tighter
 * than an unmarked one - that is how two sentences are run together. It is
 * also why PAUSE_DEFAULT_S has to sit above that sum.
 */
export function pauseGapS(requestedS: number): number {
  if (!Number.isFinite(requestedS) || requestedS <= 0) return 0;
  return Math.max(0, requestedS - CLIP_EDGE_PAD_S);
}

/** One sentence of a parsed script, ready to synthesize. */
export interface ScriptSentence {
  /** Normalized, mark-free text: exactly what gets phonemized and spoken. */
  text: string;
  /** The same sentence with its marks back in place: one line of `tts.script`. */
  line: string;
  /** Rate for this sentence, when a speed mark set one. Clamped 0.5 to 2. */
  speed?: number;
  /**
   * Silence the user asked to hear before this sentence, in seconds, from a
   * `[pause]` mark. Pass it through pauseGapS() before handing it to
   * concatClips. Present but inert on the first sentence: nothing precedes it.
   */
  gapBefore?: number;
  /**
   * Pronunciation overrides for this sentence, keyed by word index into
   * `tokens` (which is splitWords(text) unless the sentence says otherwise).
   * The value is a bare phoneme string, already filtered to KOKORO_VOCAB, to
   * use INSTEAD of calling eSpeak for that word.
   */
  pronunciations?: Record<number, string>;
  /**
   * The spoken tokens exactly as the parser split them, present only when that
   * differs from splitWords(text). A multi-word pronunciation phrase is ONE
   * token here - `[New York](/nuːjɔːk/)` gives the whole phrase the IPA it
   * asked for, where re-splitting on whitespace would put it on "York" alone
   * and let eSpeak read "New" on its own. A caller that phonemizes per word
   * must read this in preference to splitting `text` again.
   */
  tokens?: string[];
}

export interface ParsedScript {
  sentences: ScriptSentence[];
  /** The input with every mark removed and horizontal whitespace tidied. */
  stripped: string;
}

export interface ParseScriptOpts {
  /**
   * Skip normalizeForSpeech, because the text already went through it. Set it
   * when re-parsing a stored `tts.script`: normalizeText is NOT idempotent
   * (a second pass turns '2,024' into '20 24'), so normalizing twice changes
   * the words. tests/speech-text.test.ts pins both facts.
   */
  prenormalized?: boolean;
}

type ScriptMark =
  | { kind: 'pause'; seconds: number }
  | { kind: 'speed'; speed: number }
  | { kind: 'say'; ipa: string };

/**
 * The grammar, in one alternation. The pronunciation form comes first so that
 * `[pause](/pɔːz/)` reads as a pronunciation rather than a pause mark.
 * Anything that does not match is ordinary text and gets spoken.
 */
const MARK_RE =
  /\[([^\][\n]+)\]\(\s*\/([^/)\n]*)\/\s*\)|\[\s*pause(?:\s+([0-9]*\.?[0-9]+))?\s*\]|\[\s*(slow|fast)\s*\]|\[\s*speed\s+([0-9]*\.?[0-9]+)\s*\]/gi;

// Marks are lifted out of the text and replaced by one private-use character
// each, which then rides through normalizeForSpeech and splitSentences
// untouched (no rule matches a private-use code point, and none of them ends a
// sentence) and is read back off the sentence it ended up in. That is how a
// mark written between two sentences reliably attaches to the one that
// follows. A private-use character already in the input is treated as a mark
// reference and dropped, which is the price of the scheme.
const SENTINEL_BASE = 0xe000;
const SENTINEL_TOP = 0xe7ff;
const SENTINEL_RE = /[\uE000-\uE7FF]/g;
const HAS_SENTINEL = /[\uE000-\uE7FF]/;
const MAX_MARKS = SENTINEL_TOP - SENTINEL_BASE + 1;

// The space INSIDE a multi-word pronunciation phrase, one code point above the
// mark sentinels. `[New York](/.../)` has to survive sentence splitting
// and word splitting as a single token, or the IPA attaches to the last word
// only and eSpeak reads the rest of the phrase on its own. A private-use character is not whitespace,
// so nothing splits on it; it is put back as an ordinary space the moment the
// token is read off, and the sentence reports its tokens so a caller that
// phonemizes per word sees the phrase whole. Same trade as the sentinels: a
// U+E800 the input itself carried becomes a plain space.
const PHRASE_SPACE = '\uE800';
const PHRASE_SPACE_RE = /\uE800/g;

/** The canonical text of a mark, so a re-serialised script is stable. */
function markSource(m: ScriptMark, word = ''): string {
  if (m.kind === 'pause') return m.seconds === PAUSE_DEFAULT_S ? '[pause]' : `[pause ${m.seconds}]`;
  if (m.kind === 'speed') {
    if (m.speed === SLOW_SPEED) return '[slow]';
    if (m.speed === FAST_SPEED) return '[fast]';
    return `[speed ${m.speed}]`;
  }
  return `[${word}](/${m.ipa}/)`;
}

const clampSpeed = (n: number): number =>
  Math.min(MAX_SPEECH_SPEED, Math.max(MIN_SPEECH_SPEED, n));

/**
 * Parse a script's bracket marks and split it into synthesizable sentences
 * (plans/181 sections 3 and 8): `[pause]` / `[pause N]` at a sentence
 * boundary, `[slow]` / `[fast]` / `[speed N]` scoped to the sentence they sit
 * in, and `[word](/ipa/)` scoped to the one word it wraps.
 *
 * A mark is never spoken and never reaches `words[]` or a caption. A mark
 * written between two sentences belongs to the sentence that FOLLOWS it; a
 * trailing mark with no sentence after it has no effect.
 *
 * Sentences come back normalized and split in kokoro.js order (normalize the
 * whole text, THEN split), because the abbreviation and number rules need
 * cross-word context that per-sentence normalizing would lose.
 */
export function parseScriptMarks(text: string, opts: ParseScriptOpts = {}): ParsedScript {
  const marks: ScriptMark[] = [];
  const words: string[] = [];
  /** Marks whose word text is a phrase, so its token carries a phrase space. */
  const phrases = new Set<number>();
  let stripped = '';
  let seeded = '';
  let prev = 0;

  for (const m of text.matchAll(MARK_RE)) {
    const literal = (): void => { stripped += m[0]; seeded += m[0]; };
    const before = text.slice(prev, m.index);
    stripped += before;
    seeded += before;
    prev = m.index + m[0].length;
    if (marks.length >= MAX_MARKS) { literal(); continue; }

    let mark: ScriptMark;
    let word = '';
    if (m[1] !== undefined) { word = m[1]; mark = { kind: 'say', ipa: filterToVocab(m[2] ?? '') }; }
    else if (m[4] !== undefined) {
      mark = { kind: 'speed', speed: m[4].toLowerCase() === 'slow' ? SLOW_SPEED : FAST_SPEED };
    } else if (m[5] !== undefined) mark = { kind: 'speed', speed: clampSpeed(Number(m[5])) };
    else mark = { kind: 'pause', seconds: m[3] === undefined ? PAUSE_DEFAULT_S : Number(m[3]) };

    const sentinel = String.fromCodePoint(SENTINEL_BASE + marks.length);
    if (/\s/.test(word)) phrases.add(marks.length);
    marks.push(mark);
    words.push(word);
    stripped += word;
    // A pronunciation over several words stays ONE token all the way to the
    // model, so its IPA covers the phrase it wraps instead of the last word.
    seeded += word.replace(/\s+/g, PHRASE_SPACE) + sentinel;
  }
  stripped += text.slice(prev);
  seeded += text.slice(prev);
  // Tidy what removing a mark left behind: a doubled space, a space hugging a
  // newline, or a line that held nothing but the mark. Blank lines carry no
  // speech (splitSentences already treats a run of newlines as one break), so
  // collapsing them costs nothing.
  stripped = stripped
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

  const body = opts.prenormalized ? seeded : normalizeForSpeech(seeded);
  const out: ScriptSentence[] = [];
  let carried: number[] = [];

  for (const raw of splitSentences(body)) {
    const spoken: string[] = [];
    const lineParts: string[] = carried.map((id) => markSource(marks[id] as ScriptMark));
    const here: Array<{ id: number; wordIndex: number }> = carried.map((id) => ({ id, wordIndex: 0 }));
    carried = [];
    /** True once a token spoke several words as one, so `tokens` has to be reported. */
    let phrased = false;

    for (const token of raw.split(/\s+/)) {
      if (token.length === 0) continue;
      if (!HAS_SENTINEL.test(token)) { spoken.push(token); lineParts.push(token); continue; }
      // A private-use character the input itself carried maps to no mark; drop
      // it rather than reading past the end of the list.
      const ids = [...token.matchAll(SENTINEL_RE)]
        .map((s) => (s[0] as string).codePointAt(0)! - SENTINEL_BASE)
        .filter((id) => marks[id] !== undefined);
      // The phrase spaces come back as ordinary spaces here: the token stayed
      // whole through the splitting, which is all it was holding them for.
      const bare = token.replace(SENTINEL_RE, '').replace(PHRASE_SPACE_RE, ' ');
      for (const id of ids) here.push({ id, wordIndex: spoken.length });
      if (bare.length === 0) {
        for (const id of ids) lineParts.push(markSource(marks[id] as ScriptMark));
        continue;
      }
      if (ids.some((id) => phrases.has(id))) phrased = true;
      spoken.push(bare);
      lineParts.push(lineToken(token, marks, words));
    }

    if (spoken.length === 0) {
      // A line that was nothing but marks: hand them to the next sentence.
      // Only the sentence-scoped ones travel; a pronunciation with no word is
      // dropped, since there is nothing for it to change.
      carried = here.filter(({ id }) => (marks[id] as ScriptMark).kind !== 'say').map(({ id }) => id);
      continue;
    }

    const rec: ScriptSentence = { text: spoken.join(' '), line: lineParts.join(' ') };
    // Only a phrase makes `text` re-split differently from what was spoken, so
    // only a phrase pays for the extra array.
    if (phrased) rec.tokens = spoken.slice();
    for (const { id, wordIndex } of here) {
      const mark = marks[id] as ScriptMark;
      if (mark.kind === 'pause') rec.gapBefore = mark.seconds;
      else if (mark.kind === 'speed') rec.speed = mark.speed;
      else if (wordIndex < spoken.length) (rec.pronunciations ??= {})[wordIndex] = mark.ipa;
    }
    out.push(rec);
  }
  return { sentences: out, stripped };
}

/** Rebuild one token's `line` text, putting each mark back where it sat. A
 *  phrase space goes back to the plain space it stood in for. */
function lineToken(token: string, marks: ScriptMark[], words: string[]): string {
  let out = '';
  let buf = '';
  const flush = (): string => { const s = buf.replace(PHRASE_SPACE_RE, ' '); buf = ''; return s; };
  for (const ch of token) {
    const code = ch.codePointAt(0) as number;
    if (code >= SENTINEL_BASE && code <= SENTINEL_TOP) {
      const mark = marks[code - SENTINEL_BASE] as ScriptMark;
      if (mark.kind === 'say') { out += markSource(mark, flush()); }
      else { out += flush() + markSource(mark, words[code - SENTINEL_BASE]); }
      continue;
    }
    buf += ch;
  }
  return out + flush();
}

/**
 * The model-facing form of a script: one sentence per line, normalized, marks
 * kept in place (plans/181 section 5.1, `tts.script`). Joined with newlines it
 * is what a clip stores and what the transcript panel edits, so re-parsing it
 * with `{ prenormalized: true }` gives back the same sentences.
 */
export function scriptLinesOf(text: string, opts: ParseScriptOpts = {}): string[] {
  return parseScriptMarks(text, opts).sentences.map((s) => s.line);
}

// ─── Voice blending (plans/181 section 4) ─────────────────────────────────────

/** One voice in a blend, with its share of the style row. Shares sum to 1. */
export interface VoiceBlendComponent { id: string; w: number }

function unknownVoice(id: string): Error {
  return new Error(`unknown voice "${id}" - one of: ${KOKORO_VOICES.map((v) => v.id).join(', ')}`);
}

/**
 * Read a voice setting: either one `KOKORO_VOICES` id, or several joined by
 * `+` with optional `:weight` shares, e.g. 'af_heart+bf_lily:0.3'.
 *
 * Components without a weight split whatever the named ones leave, and every
 * share is then normalised to sum to 1, so a plain id gives one component of
 * weight 1 and every existing caller and stored recipe is unchanged. A weight
 * that is not a finite number at or above zero is read as absent rather than
 * rejected; only an unknown id or an empty setting throws, and it throws the
 * same message the worker has always thrown.
 *
 * A repeated id is kept as two components; the style-row math adds their
 * weights, so the result is the same as writing it once.
 */
export function parseVoiceBlend(voice: string): VoiceBlendComponent[] {
  const parts = String(voice ?? '').split('+').map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) throw unknownVoice(String(voice ?? ''));

  const raw = parts.map((part) => {
    const cut = part.lastIndexOf(':');
    const id = (cut >= 0 ? part.slice(0, cut) : part).trim();
    if (!KOKORO_VOICES.some((v) => v.id === id)) throw unknownVoice(id);
    const n = cut >= 0 ? Number(part.slice(cut + 1).trim()) : Number.NaN;
    return { id, w: Number.isFinite(n) && n >= 0 ? n : null };
  });

  const namedSum = raw.reduce((a, r) => a + (r.w ?? 0), 0);
  const unnamed = raw.filter((r) => r.w === null).length;
  const share = unnamed > 0 ? Math.max(0, 1 - namedSum) / unnamed : 0;
  const spread = raw.map((r) => ({ id: r.id, w: r.w ?? share }));
  const total = spread.reduce((a, c) => a + c.w, 0);
  if (!(total > 0)) return spread.map((c) => ({ id: c.id, w: 1 / spread.length }));
  return spread.map((c) => ({ id: c.id, w: c.w / total }));
}

/**
 * The eSpeak language for a blend: the heaviest component's id prefix, ties
 * going to the first listed (Andy, 2026-09-03 - a cross-accent blend takes the
 * heaviest voice's accent and nothing is refused). Empty blends read as en-US,
 * matching the single-voice rule for an id with no 'b' prefix.
 */
export function accentOfBlend(components: VoiceBlendComponent[]): 'a' | 'b' {
  let best: VoiceBlendComponent | undefined;
  for (const c of components) if (!best || c.w > best.w) best = c;
  return best?.id.startsWith('b') ? 'b' : 'a';
}
