// SPDX-License-Identifier: MPL-2.0
/**
 * Speech synthesis text machinery — the PURE half of Kokoro TTS. Everything
 * here is plain math and string work with no transformers.js, no phonemizer
 * wasm and no DOM, so the SAME logic runs in the web worker
 * (shells/web/src/lib/speech-kokoro-worker.ts), in Node scripts
 * (scripts/build-docs-audio.ts) and under test. Same split as analysePcm: the
 * heavy runtime is injectable, the bookkeeping lives in the engine — the
 * roadmap's one-synthesis-layer rule (plans/39-inclusive-audio-roadmap.md §4).
 *
 * The text→phoneme pipeline (normalizeText / splitPunctuation /
 * postProcessPhonemes) is a TypeScript port of hexgrad/kokoro's
 * kokoro.js/src/phonemize.js (Apache-2.0) — ported rather than depended on
 * because kokoro-js's generate() discards the timestamped model's extra
 * `durations` output, which is the entire reason host.speech can caption
 * itself. Word alignment strategy: each word is phonemized SEPARATELY and the
 * per-word phoneme strings joined with single spaces to form the model input,
 * so every word's token span is known by construction (the Kokoro tokenizer is
 * character-level over phonemes — one token per phoneme char, space included —
 * which `input_ids.length === phonemes.length + 2` verifies at runtime).
 */

import type { SpeechVoiceInfo, SpeechWordTiming } from './bridge/host-v1.ts';

export const KOKORO_SAMPLE_RATE = 24000;
/** transformers.js model id under env.localModelPath ('/models/' in the web shell) — /models/kokoro/. */
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
 * so it decides nothing on its own — see the same call, with the same reasoning,
 * on the docs corpus in scripts/build-docs-audio.ts. Do not "fix" this back to a
 * higher-graded voice from the table without listening to both.
 */
export const KOKORO_DEFAULT_VOICE = 'bf_lily';

/** Silence inserted between sentence clips when concatenating, in seconds. */
export const SENTENCE_GAP_S = 0.35;

/**
 * Sentences longer than this are wrapped on whitespace before synthesis — the
 * model truncates at 510 tokens (~1 phoneme char each), and a run-on sentence
 * must degrade to an extra split, never to silently dropped words.
 */
const MAX_SENTENCE_CHARS = 400;

/**
 * Hard cap on `synthesize()` input, enforced in bridge/speech.ts before the
 * text is posted to the worker AND in the worker itself (defence in depth).
 * Well above the UI's soft ~5000-char nudge — this is the "someone pasted a
 * novel" guard, not a product limit: at seconds per sentence the model would
 * grind for hours, and the caller should chunk deliberately instead.
 */
export const MAX_INPUT_CHARS = 100_000;

/**
 * The model consumes the space-joined PHONEME string, hard-capped at 510
 * tokens (one per char, plus BOS/EOS). The raw-char wrap in wrapLong is only a
 * cheap pre-pass: normalization can expand text severalfold ('$45' → '45
 * dollars' → yet more phoneme chars), so the real budget check happens on the
 * phonemes the model actually sees — see chunkByPhonemeLength.
 */
export const MAX_PHONEME_CHARS = 508; // 510 tokens minus BOS/EOS

// ─── Sentence and word splitting ──────────────────────────────────────────────

/**
 * Split text into sentences on terminal punctuation (., !, ?, …), keeping the
 * punctuation — and any closing quotes/brackets riding it — attached to the
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
      // wrap on whitespace — force-split it at the boundary rather than letting
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
 * Char→token spans for per-word phoneme strings joined with single spaces.
 * The Kokoro tokenizer is character-level, and the tokenizer wraps the
 * sequence in BOS/EOS zeros — so word i's tokens are exactly its char range in
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
 * word) rather than being dropped — pathological, but never silent word loss
 * across the rest of the sentence.
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
 * Per-word times from the timestamped model's `durations` output — one frame
 * count per input token (BOS/EOS included). Rather than trusting a fixed frame
 * rate the divisor is DERIVED from the clip itself: total frames over actual
 * audio seconds, which by definition lands every word inside the waveform.
 * (Measured on the q8 export: ~40 frames/s — sum(durations) 112.96 over a
 * 2.80 s clip — NOT the 80 some community posts quote; deriving it makes the
 * constant irrelevant either way.) Returns
 * null when the shapes disagree (durations not one-per-token) — the caller
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
}

/**
 * Concatenate per-sentence clips into one mono buffer with `gapS` of silence
 * between sentences (none after the last), offsetting each clip's word timings
 * into the combined timeline.
 */
export function concatClips(
  clips: SentenceClip[],
  gapS: number,
  sampleRate: number,
): { pcm: Float32Array; duration: number; words: SpeechWordTiming[] } {
  const gap = Math.round(gapS * sampleRate);
  let total = 0;
  for (const [i, clip] of clips.entries()) total += clip.pcm.length + (i > 0 ? gap : 0);

  const pcm = new Float32Array(total);
  const words: SpeechWordTiming[] = [];
  let offset = 0;
  for (const [i, clip] of clips.entries()) {
    if (i > 0) offset += gap;
    pcm.set(clip.pcm, offset);
    const t0 = offset / sampleRate;
    for (const w of clip.words) words.push({ text: w.text, start: t0 + w.start, end: t0 + w.end });
    offset += clip.pcm.length;
  }
  return { pcm, duration: total / sampleRate, words };
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

const PUNCTUATION = ';:,.!?¡¿—…"«»“”(){}[]';
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
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z');
  if (language === 'a') processed = processed.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  return processed.trim();
}

/** The eSpeak call, injectable so the pipeline is testable without the wasm. */
export type EspeakFn = (text: string, lang: string) => Promise<string[]>;

/**
 * Full phonemize pipeline for one chunk of (already normalized) text —
 * kokoro.js's phonemize() with `norm` hoisted to the caller: the worker runs
 * normalizeText once over the WHOLE input before sentence splitting (kokoro.js
 * order — abbreviation/number rules need cross-word context like '(?= [A-Z])'),
 * so by the time a word reaches here it is already normalized.
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
  return postProcessPhonemes(ps, language);
}
