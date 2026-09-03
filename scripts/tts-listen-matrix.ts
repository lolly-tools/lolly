#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Phase 0 of plans/181-tts-prosody-regenerate-and-voice-blend.md - the LISTEN harness.
 *
 * ANDY-RUN ONLY, exactly like scripts/build-docs-audio.ts, and for the same
 * reason: it needs the LOCAL Kokoro model staged at
 * shells/web/public/models/kokoro/ (scripts/fetch-kokoro-models.ts). It is
 * never invoked by npm install / postinstall / CI, writes nothing into the
 * repo, and exits 0 with a printed recipe when the model is absent.
 *
 * It renders a fixed matrix - 10 short lines x 10 prosody variants x 8 voice
 * configurations (3 atomic voices, 4 blends, 1 pronunciation override) - through
 * the SAME stack as the web worker (@huggingface/transformers + phonemizer
 * against the local model with remote models disabled) and the SAME pure engine
 * functions (engine/src/speech-text.ts). One WAV per cell plus a JSON and a
 * markdown table of measurements. Nothing here judges emotion; it reports
 * duration, whether word alignment survived, level, and a crude
 * energy/pitch contour, and flags the cells that broke.
 *
 * Usage:
 *   node scripts/tts-listen-matrix.ts --out <dir>
 *   node scripts/tts-listen-matrix.ts --out <dir> --smoke     # 4 cells, to time the rig
 *   node scripts/tts-listen-matrix.ts --out <dir> --configs bf_lily,af_heart
 *   node scripts/tts-listen-matrix.ts --out <dir> --budget 1500   # seconds, stop cleanly
 *
 * Results stream to results.jsonl as they are measured, so an interrupted or
 * budget-stopped run still yields a table over what it did render.
 *
 * TWO THINGS THIS HARNESS FAKES, because the grammar does not exist yet and
 * Phase 0 writes no product code (engine/src is untouched by this file):
 *   - per-clip gap: concatClips() takes ONE gapS today, so `[pause 1]` is
 *     modelled by concatGapped() below - a local copy of concatClips's maths
 *     that takes a gaps[] array. That is the shape section 5.1 wants
 *     concatClips to grow.
 *   - voice blend: there is no blend grammar, so blendRow() sums the component
 *     matrices' rows at the same token count with normalised weights, which is
 *     section 4's proposed math, computed here per chunk.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KOKORO_SAMPLE_RATE, KOKORO_STYLE_DIM, KOKORO_MODEL_ID, KOKORO_VOICE_BYTES,
  SENTENCE_GAP_S, splitSentences, splitWords, phonemeTokenSpans,
  wordTimingsFromDurations, normalizeText, phonemizeChunk, chunkByPhonemeLength,
} from '../engine/src/speech-text.ts';
import type { EspeakFn } from '../engine/src/speech-text.ts';
import type { SpeechWordTiming } from '../packages/core/src/host-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_DIR = join(ROOT, 'shells', 'web', 'public', 'models', 'kokoro');
const SR = KOKORO_SAMPLE_RATE;

// ── The matrix ───────────────────────────────────────────────────────────────

interface Line {
  id: string;
  /** Stem WITHOUT a terminal mark - variants supply their own. */
  stem: string;
  /** What `plain` ends with. '.' everywhere except the question. */
  plainEnd: string;
  /** Control lines render `plain` only; they exist to give a matrix line a baseline. */
  control?: boolean;
  note: string;
}

const LINES: Line[] = [
  { id: 'statement', stem: 'The render finished in four seconds', plainEnd: '.', note: 'plain statement' },
  { id: 'question', stem: 'Do you want to hear that again', plainEnd: '?', note: 'question' },
  { id: 'exclaim', stem: 'That is exactly what I wanted', plainEnd: '.', note: 'exclamatory content' },
  { id: 'brand', stem: 'SUSE Rancher ships today', plainEnd: '.', note: 'brand name' },
  { id: 'number', stem: 'That is $45 on 3.5 days', plainEnd: '.', note: 'money + decimal' },
  {
    id: 'long',
    stem: 'Every tool in the gallery runs the same render path on the web on the desktop and on the command line so the output never drifts between them',
    plainEnd: '.',
    note: '25-word sentence',
  },
  { id: 'twoword', stem: 'No way', plainEnd: '.', note: 'two words' },
  { id: 'paren', stem: '(quietly) fine', plainEnd: '.', note: 'parenthetical' },
  { id: 'caps', stem: 'URGENT update', plainEnd: '.', note: 'ALL CAPS word' },
  { id: 'dash', stem: 'The build is green — ship it', plainEnd: '.', note: 'em dash already in the line' },
  // Controls: same words, no shouting / no brand spelling, plain variant only.
  { id: 'caps-ctrl', stem: 'Urgent update', plainEnd: '.', control: true, note: 'control for caps' },
  { id: 'brand-ctrl', stem: 'Suse Rancher ships today', plainEnd: '.', control: true, note: 'control for brand' },
];

type VariantId =
  | 'plain' | 'bang' | 'bangbang' | 'bangq' | 'ellipsis'
  | 'emdash' | 'pause' | 'slow' | 'fast' | 'rise' | 'riseTok';

const VARIANTS: Array<{ id: VariantId; label: string }> = [
  { id: 'plain', label: 'plain' },
  { id: 'bang', label: '!' },
  { id: 'bangbang', label: '!!' },
  { id: 'bangq', label: '!?' },
  { id: 'ellipsis', label: '…' },
  { id: 'emdash', label: '— mid' },
  { id: 'pause', label: '[pause 1]' },
  { id: 'slow', label: '[slow] 0.85' },
  { id: 'fast', label: '[fast] 1.15' },
  { id: 'rise', label: '↗' },
  // The naive typed `…seconds.↗` and the same arrow injected as a real TOKEN.
  // eSpeak VERBALISES ↗ ("up right arrow"), so the vocab symbol never reaches
  // the model on the typed path - riseTok forces it in at the phoneme boundary,
  // which is the only way the plan's "prosodic marks from the training set"
  // hypothesis can actually be tested.
  { id: 'riseTok', label: '↗ as token' },
];

/** The second line of the `[pause 1]` cell - the gap is between these two. */
const PAUSE_TAIL = 'Then we begin.';

/** Insert an em dash at the middle word boundary of the stem. */
function midDash(stem: string): string {
  const w = stem.split(' ');
  if (w.length < 2) return stem;
  const at = Math.floor(w.length / 2);
  return `${w.slice(0, at).join(' ')} — ${w.slice(at).join(' ')}`;
}

interface Cell {
  text: string;
  /** Gap in seconds AFTER each sentence except the last (length = sentences-1 once split). */
  gapS: number;
  speed: number;
}

function buildCell(line: Line, variant: VariantId): Cell {
  const base = { gapS: SENTENCE_GAP_S, speed: 1 };
  switch (variant) {
    case 'plain': return { ...base, text: `${line.stem}${line.plainEnd}` };
    case 'bang': return { ...base, text: `${line.stem}!` };
    case 'bangbang': return { ...base, text: `${line.stem}!!` };
    case 'bangq': return { ...base, text: `${line.stem}!?` };
    case 'ellipsis': return { ...base, text: `${line.stem}…` };
    case 'emdash': return { ...base, text: `${midDash(line.stem)}${line.plainEnd}` };
    case 'pause': return { ...base, gapS: 1, text: `${line.stem}${line.plainEnd} ${PAUSE_TAIL}` };
    case 'slow': return { ...base, speed: 0.85, text: `${line.stem}${line.plainEnd}` };
    case 'fast': return { ...base, speed: 1.15, text: `${line.stem}${line.plainEnd}` };
    // ↗ is a vocab symbol from the model's own training set, appended after the
    // terminal mark exactly as a user would type it. Listen-test only.
    case 'rise': return { ...base, text: `${line.stem}${line.plainEnd}↗` };
    // The arrow rides INSIDE the last word, so arrowToken's eSpeak wrapper can
    // swap it for the literal vocab symbol before the tokenizer sees it.
    case 'riseTok': return { ...base, text: `${line.stem}↗${line.plainEnd}` };
  }
}

// ── Voice configurations ─────────────────────────────────────────────────────

interface VoiceConfig {
  id: string;
  label: string;
  /** Component voices with weights that sum to 1 (one component = an atomic voice). */
  mix: Array<{ voice: string; w: number }>;
  /** Hand-written IPA for one word, fed through a fake eSpeak. */
  override?: { word: string; ipa: string };
  /** Keep a trailing ↗ as the literal vocab token instead of letting eSpeak say it. */
  arrowToken?: boolean;
  /** Default run scope (see BUDGET note). --full ignores both. */
  scopeLines?: string[];
  scopeVariants?: VariantId[];
}

/**
 * BUDGET. Synthesis measured at ~1.2x realtime on this machine, so the FULL
 * 8 x 102 matrix is ~1 hour. The default run is scoped so the whole sweep finishes
 * inside ~25 minutes, spending the budget where the question is:
 *   - bf_lily (the shipped default voice) gets the complete 10x10 - punctuation
 *     is the primary question and Lily is the narrator every doc is read in.
 *   - af_heart / am_michael get all 10 variants minus the 25-word line (the
 *     single most expensive cell, and the one least about punctuation).
 *   - the 4 blends get a small cross-section: the blend question is timbre and
 *     whether `durations` survives a summed style row, not punctuation.
 *   - the pronunciation override only has anything to say about the brand line.
 * `--full` runs everything.
 */
const BLEND_LINES = ['statement', 'question', 'twoword', 'brand', 'paren'];
const BLEND_VARIANTS: VariantId[] = ['plain', 'bang', 'ellipsis', 'pause'];
const NO_LONG = ['statement', 'question', 'exclaim', 'brand', 'number', 'twoword', 'paren', 'caps', 'dash', 'caps-ctrl', 'brand-ctrl'];
/** Everything except riseTok, which only means anything with arrowToken's eSpeak wrapper. */
const TYPED_VARIANTS: VariantId[] = ['plain', 'bang', 'bangbang', 'bangq', 'ellipsis', 'emdash', 'pause', 'slow', 'fast', 'rise'];

const CONFIGS: VoiceConfig[] = [
  { id: 'bf_lily', label: 'bf_lily', mix: [{ voice: 'bf_lily', w: 1 }], scopeVariants: TYPED_VARIANTS },
  { id: 'af_heart', label: 'af_heart', mix: [{ voice: 'af_heart', w: 1 }], scopeLines: NO_LONG, scopeVariants: TYPED_VARIANTS },
  { id: 'am_michael', label: 'am_michael', mix: [{ voice: 'am_michael', w: 1 }], scopeLines: NO_LONG, scopeVariants: TYPED_VARIANTS },
  { id: 'blend_heart_lily_50', label: 'heart+lily 50/50', mix: [{ voice: 'af_heart', w: 0.5 }, { voice: 'bf_lily', w: 0.5 }], scopeLines: BLEND_LINES, scopeVariants: BLEND_VARIANTS },
  { id: 'blend_heart_lily_70', label: 'heart+lily 70/30', mix: [{ voice: 'af_heart', w: 0.7 }, { voice: 'bf_lily', w: 0.3 }], scopeLines: BLEND_LINES, scopeVariants: BLEND_VARIANTS },
  { id: 'blend_michael_heart_50', label: 'michael+heart 50/50', mix: [{ voice: 'am_michael', w: 0.5 }, { voice: 'af_heart', w: 0.5 }], scopeLines: BLEND_LINES, scopeVariants: BLEND_VARIANTS },
  { id: 'blend_lily_michael_70', label: 'lily+michael 70/30', mix: [{ voice: 'bf_lily', w: 0.7 }, { voice: 'am_michael', w: 0.3 }], scopeLines: BLEND_LINES, scopeVariants: BLEND_VARIANTS },
  {
    id: 'ipa_suse',
    label: 'bf_lily + /ˈsuːsə/',
    mix: [{ voice: 'bf_lily', w: 1 }],
    override: { word: 'SUSE', ipa: 'ˈsuːsə' },
    scopeLines: ['brand', 'brand-ctrl'],
    scopeVariants: ['plain', 'bang', 'bangbang', 'bangq', 'ellipsis', 'emdash', 'pause', 'slow', 'fast', 'rise'],
  },
  {
    id: 'arrow_token',
    label: 'bf_lily + ↗ token',
    mix: [{ voice: 'bf_lily', w: 1 }],
    arrowToken: true,
    scopeVariants: ['plain', 'riseTok'],
  },
];

/** Section 4's rule: the eSpeak accent is the heaviest component's prefix, ties to first listed. */
function accentOf(cfg: VoiceConfig): 'a' | 'b' {
  let best = cfg.mix[0]!;
  for (const c of cfg.mix) if (c.w > best.w) best = c;
  return best.voice.startsWith('b') ? 'b' : 'a';
}

// ── Runtime ──────────────────────────────────────────────────────────────────

interface TensorLike { data: ArrayLike<number | bigint>; dims: number[] }
type TensorCtor = new (type: string, data: Float32Array | number[], dims: number[]) => unknown;
interface Runtime {
  model: (inputs: Record<string, unknown>) => Promise<{ waveform: TensorLike; durations?: TensorLike }>;
  tokenizer: (text: string, opts: { truncation: boolean }) => { input_ids: TensorLike };
  Tensor: TensorCtor;
  espeak: EspeakFn;
  voices: Map<string, Float32Array>;
}

function bail(lines: string[]): never {
  process.stdout.write(`${lines.join('\n')}\nNothing was written.\n`);
  process.exit(0);
}

function loadVoice(id: string): Float32Array {
  const p = join(MODEL_DIR, 'voices', `${id}.bin`);
  const raw = readFileSync(p);
  const data = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  if (data.byteLength !== KOKORO_VOICE_BYTES) {
    throw new Error(`voice ${id} is ${data.byteLength} bytes, expected ${KOKORO_VOICE_BYTES} - re-run scripts/fetch-kokoro-models.ts`);
  }
  return data;
}

async function loadRuntime(needed: string[]): Promise<Runtime> {
  if (!existsSync(join(MODEL_DIR, 'onnx', 'model_quantized.onnx'))) {
    bail([
      `The local Kokoro model is not staged (${MODEL_DIR}).`,
      'Fetch it once (sha256-pinned, ~92 MB + voices):',
      '',
      '  node scripts/fetch-kokoro-models.ts',
      '',
      'then re-run. Synthesis is fully offline from there.',
    ]);
  }
  for (const v of needed) {
    if (!existsSync(join(MODEL_DIR, 'voices', `${v}.bin`))) {
      bail([`Voice matrix ${v}.bin is missing from ${MODEL_DIR}/voices - run scripts/fetch-kokoro-models.ts.`]);
    }
  }
  const { env, AutoTokenizer, StyleTextToSpeech2Model, Tensor } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = dirname(MODEL_DIR);
  // Same model + dtype as the worker. The thread count is a HARNESS-ONLY knob
  // (the browser worker has no say in it) that keeps a 800-cell sweep inside a
  // coffee break; it changes throughput, never the samples.
  const threads = Number(process.env.LOLLY_TTS_THREADS ?? '0');
  const opts: Record<string, unknown> = { dtype: 'q8' };
  if (threads > 0) opts.session_options = { intraOpNumThreads: threads, interOpNumThreads: 1 };
  const [model, tokenizer] = await Promise.all([
    StyleTextToSpeech2Model.from_pretrained(KOKORO_MODEL_ID, opts),
    AutoTokenizer.from_pretrained(KOKORO_MODEL_ID),
  ]);
  const { phonemize } = await import('phonemizer');
  const voices = new Map<string, Float32Array>();
  for (const v of needed) voices.set(v, loadVoice(v));
  return {
    model: model as unknown as Runtime['model'],
    tokenizer: tokenizer as unknown as Runtime['tokenizer'],
    Tensor: Tensor as unknown as TensorCtor,
    espeak: phonemize as EspeakFn,
    voices,
  };
}

/** Section 4's blend math: the weighted sum of the component rows at ONE token count. */
function blendRow(rt: Runtime, cfg: VoiceConfig, numTokens: number): Float32Array {
  const out = new Float32Array(KOKORO_STYLE_DIM);
  let wsum = 0;
  for (const c of cfg.mix) wsum += c.w;
  for (const c of cfg.mix) {
    const m = rt.voices.get(c.voice)!;
    const off = numTokens * KOKORO_STYLE_DIM;
    const w = c.w / wsum;
    for (let i = 0; i < KOKORO_STYLE_DIM; i++) out[i]! += w * m[off + i]!;
  }
  return out;
}

/** The `[SUSE](/ˈsuːsə/)` form, faked at the eSpeak boundary for Phase 0. */
function espeakWithOverride(base: EspeakFn, ov: { word: string; ipa: string }): EspeakFn {
  const want = ov.word.toLowerCase();
  return async (text, lang) => {
    if (text.trim().toLowerCase() === want) return [ov.ipa];
    return base(text, lang);
  };
}

/** Phonemize the word without its trailing ↗, then append the vocab symbol itself. */
function espeakKeepingArrow(base: EspeakFn): EspeakFn {
  return async (text, lang) => {
    const m = /^(.*?)([↗↘→↓]+)$/.exec(text.trim());
    if (!m) return base(text, lang);
    const head = m[1] ? (await base(m[1]!, lang)).join(' ') : '';
    return [`${head}${m[2]}`];
  };
}

/** concatClips() with a per-JOIN gap - the shape section 5.1 wants it to grow. */
function concatGapped(
  clips: Array<{ pcm: Float32Array; words: SpeechWordTiming[] }>,
  gapsS: number[],
  sampleRate: number,
): { pcm: Float32Array; duration: number; words: SpeechWordTiming[] } {
  const gaps = clips.map((_, i) => (i === 0 ? 0 : Math.round((gapsS[i - 1] ?? SENTENCE_GAP_S) * sampleRate)));
  let total = 0;
  for (const [i, c] of clips.entries()) total += c.pcm.length + gaps[i]!;
  const pcm = new Float32Array(total);
  const words: SpeechWordTiming[] = [];
  let offset = 0;
  for (const [i, c] of clips.entries()) {
    offset += gaps[i]!;
    pcm.set(c.pcm, offset);
    const t0 = offset / sampleRate;
    for (const w of c.words) words.push({ text: w.text, start: t0 + w.start, end: t0 + w.end });
    offset += c.pcm.length;
  }
  return { pcm, duration: total / sampleRate, words };
}

// ── Synthesis of one cell ────────────────────────────────────────────────────

interface ChunkReport {
  sentence: string;
  seqLen: number;
  phonemeChars: number;
  aligned: boolean;
  hasDurations: boolean;
}

interface Synth {
  pcm: Float32Array;
  words: SpeechWordTiming[];
  granularity: 'word' | 'sentence';
  chunks: ChunkReport[];
  normalized: string;
}

async function synthCell(rt: Runtime, cfg: VoiceConfig, cell: Cell): Promise<Synth> {
  const language = accentOf(cfg);
  let espeak = cfg.override ? espeakWithOverride(rt.espeak, cfg.override) : rt.espeak;
  if (cfg.arrowToken) espeak = espeakKeepingArrow(espeak);
  const normalized = normalizeText(cell.text);
  const sentences = splitSentences(normalized);
  const pieces: Array<{ pcm: Float32Array; sentence: string; wordEntries: SpeechWordTiming[] | null }> = [];
  const chunks: ChunkReport[] = [];

  for (const sentence of sentences) {
    const words = splitWords(sentence);
    const wordPhonemes: string[] = [];
    for (const w of words) wordPhonemes.push(await phonemizeChunk(espeak, w, language));

    for (const chunk of chunkByPhonemeLength(words, wordPhonemes)) {
      const phonemes = chunk.phonemes.join(' ');
      const { input_ids } = rt.tokenizer(phonemes, { truncation: true });
      const seqLen = input_ids.dims[input_ids.dims.length - 1] ?? 0;
      const numTokens = Math.min(Math.max(seqLen - 2, 0), 509);
      const style = blendRow(rt, cfg, numTokens);
      const outputs = await rt.model({
        input_ids,
        style: new rt.Tensor('float32', style, [1, KOKORO_STYLE_DIM]),
        speed: new rt.Tensor('float32', [cell.speed], [1]),
      });
      const wave = outputs.waveform.data as Float32Array;
      const aligned = seqLen === phonemes.length + 2;
      let wordEntries: SpeechWordTiming[] | null = null;
      if (outputs.durations && aligned) {
        const spans = phonemeTokenSpans(chunk.phonemes);
        const times = wordTimingsFromDurations(outputs.durations.data, spans, wave.length, SR);
        if (times) wordEntries = chunk.words.map((t, j) => ({ text: t, start: times[j]!.start, end: times[j]!.end }));
      }
      chunks.push({
        sentence: chunk.words.join(' '),
        seqLen,
        phonemeChars: phonemes.length,
        aligned,
        hasDurations: Boolean(outputs.durations),
      });
      pieces.push({ pcm: wave, sentence: chunk.words.join(' '), wordEntries });
    }
  }

  const allAligned = pieces.length > 0 && pieces.every((p) => p.wordEntries !== null);
  const clips = pieces.map((p) => ({
    pcm: p.pcm,
    words: allAligned
      ? (p.wordEntries as SpeechWordTiming[])
      : [{ text: p.sentence, start: 0, end: p.pcm.length / SR }],
  }));
  const gaps = clips.slice(1).map(() => cell.gapS);
  const { pcm, words } = concatGapped(clips, gaps, SR);
  return { pcm, words, granularity: allAligned ? 'word' : 'sentence', chunks, normalized };
}

// ── Measurement ──────────────────────────────────────────────────────────────

const db = (x: number) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -Infinity);

/** Crude f0 by normalised autocorrelation on a 3x-decimated frame (8 kHz, 80-350 Hz). */
function crudeF0(frame: Float32Array): number | null {
  const n = Math.floor(frame.length / 3);
  if (n < 200) return null;
  const d = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) { d[i] = (frame[3 * i]! + frame[3 * i + 1]! + frame[3 * i + 2]!) / 3; mean += d[i]!; }
  mean /= n;
  let e0 = 0;
  for (let i = 0; i < n; i++) { d[i]! -= mean; e0 += d[i]! * d[i]!; }
  if (e0 <= 1e-9) return null;
  const sr = SR / 3;
  const lagMin = Math.floor(sr / 350);
  const lagMax = Math.min(Math.floor(sr / 80), n - 64);
  let bestLag = -1; let bestR = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let num = 0; let e1 = 0;
    for (let i = 0; i + lag < n; i++) { num += d[i]! * d[i + lag]!; e1 += d[i + lag]! * d[i + lag]!; }
    const r = num / Math.sqrt(e0 * e1 + 1e-12);
    if (r > bestR) { bestR = r; bestLag = lag; }
  }
  if (bestLag < 0 || bestR < 0.35) return null;
  return Math.round(sr / bestLag);
}

interface Measure {
  durationMs: number;
  voicedMs: number;
  peakDb: number;
  rmsDb: number;
  windowsRms: number[];
  termRatio: number | null;
  f0: Array<number | null>;
  f0Mean: number | null;
  f0Last: number | null;
  f0Ratio: number | null;
  nonFinite: number;
  silent: boolean;
}

function measure(pcm: Float32Array): Measure {
  let peak = 0; let sq = 0; let nonFinite = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i]!;
    if (!Number.isFinite(v)) { nonFinite++; continue; }
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sq += v * v;
  }
  const rms = pcm.length ? Math.sqrt(sq / pcm.length) : 0;
  // Trim leading/trailing near-silence before the contour, so the tail window
  // measures the last spoken thing, not the model's trailing pad.
  const thr = Math.max(peak * 0.02, 1e-4);
  let a = 0; let b = pcm.length - 1;
  while (a < pcm.length && Math.abs(pcm[a] ?? 0) < thr) a++;
  while (b > a && Math.abs(pcm[b] ?? 0) < thr) b--;
  const voiced = pcm.subarray(a, Math.max(a, b + 1));
  const windows: number[] = [];
  const f0: Array<number | null> = [];
  const W = 10;
  for (let w = 0; w < W; w++) {
    const s = Math.floor((voiced.length * w) / W);
    const e = Math.floor((voiced.length * (w + 1)) / W);
    let q = 0;
    for (let i = s; i < e; i++) { const v = voiced[i]!; if (Number.isFinite(v)) q += v * v; }
    windows.push(e > s ? Math.sqrt(q / (e - s)) : 0);
    const frame = voiced.subarray(s, Math.min(e, s + 3072));
    f0.push(frame.length > 600 ? crudeF0(frame) : null);
  }
  const wMean = windows.reduce((x, y) => x + y, 0) / (windows.length || 1);
  const voicedF0 = f0.filter((x): x is number => x !== null);
  const f0Mean = voicedF0.length ? Math.round(voicedF0.reduce((x, y) => x + y, 0) / voicedF0.length) : null;
  const f0Last = [...f0].reverse().find((x): x is number => x !== null) ?? null;
  return {
    durationMs: Math.round((pcm.length / SR) * 1000),
    voicedMs: Math.round((voiced.length / SR) * 1000),
    peakDb: db(peak),
    rmsDb: db(rms),
    windowsRms: windows.map((x) => Math.round(x * 1e4) / 1e4),
    termRatio: wMean > 0 ? Math.round((windows[W - 1]! / wMean) * 100) / 100 : null,
    f0,
    f0Mean,
    f0Last,
    f0Ratio: f0Mean && f0Last ? Math.round((f0Last / f0Mean) * 100) / 100 : null,
    nonFinite,
    silent: peak < 1e-4,
  };
}

// ── WAV ──────────────────────────────────────────────────────────────────────

function wav16(pcm: Float32Array): Buffer {
  const n = pcm.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Number.isFinite(pcm[i]!) ? Math.max(-1, Math.min(1, pcm[i]!)) : 0;
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

// ── Results ──────────────────────────────────────────────────────────────────

interface Row {
  config: string;
  configLabel: string;
  line: string;
  variant: VariantId;
  variantLabel: string;
  text: string;
  normalized?: string;
  speed: number;
  gapS: number;
  wav?: string;
  wordCount?: number;
  granularity?: 'word' | 'sentence';
  chunks?: ChunkReport[];
  m?: Measure;
  error?: string;
  ms: number;
}

function fmtTable(rows: Row[], configs: VoiceConfig[]): string {
  const byKey = new Map<string, Row>();
  for (const r of rows) byKey.set(`${r.config}|${r.line}|${r.variant}`, r);
  const out: string[] = [];
  const cols = configs.filter((c) => rows.some((r) => r.config === c.id));
  out.push('');
  out.push('Cell = duration ms / alignment (w = word, S = SENTENCE fallback) / terminal-energy ratio / flags.');
  out.push('Flags: A align broke, X exception, 0 silent, N non-finite, L >25% longer than plain, S >25% shorter.');
  out.push('');
  for (const line of LINES) {
    const variants = line.control ? VARIANTS.filter((v) => v.id === 'plain') : VARIANTS;
    if (!rows.some((r) => r.line === line.id)) continue;
    out.push(`### ${line.id} — "${line.stem}" (${line.note})`);
    out.push('');
    out.push(`| variant | ${cols.map((c) => c.label).join(' | ')} |`);
    out.push(`|---|${cols.map(() => '---').join('|')}|`);
    for (const v of variants) {
      const cells = cols.map((c) => {
        const r = byKey.get(`${c.id}|${line.id}|${v.id}`);
        if (!r) return '–';
        if (r.error) return `X ${r.error.slice(0, 28)}`;
        const m = r.m!;
        const flags: string[] = [];
        if (r.granularity !== 'word') flags.push('A');
        if (m.silent) flags.push('0');
        if (m.nonFinite) flags.push('N');
        const plain = byKey.get(`${c.id}|${line.id}|plain`);
        if (plain?.m && v.id !== 'plain' && v.id !== 'pause' && v.id !== 'slow' && v.id !== 'fast') {
          const ratio = m.durationMs / plain.m.durationMs;
          if (ratio > 1.25) flags.push('L');
          if (ratio < 0.75) flags.push('S');
        }
        return `${m.durationMs} / ${r.granularity === 'word' ? 'w' : 'S'} / ${m.termRatio ?? '–'}${flags.length ? ` / ${flags.join('')}` : ''}`;
      });
      out.push(`| ${v.label} | ${cells.join(' | ')} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

const med = (xs: number[]): number | null => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return Math.round((s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) * 100) / 100;
};

/** Per-variant aggregate: what each mark measurably DOES, pooled over lines and voices. */
function fmtSummary(rows: Row[]): string {
  const byKey = new Map<string, Row>();
  for (const r of rows) byKey.set(`${r.config}|${r.line}|${r.variant}`, r);
  const out: string[] = ['## Per-variant summary (pooled over every line and voice rendered)', ''];
  out.push('| variant | n | align fail | median dur / plain | median term-energy ratio | median f0(last)/f0(mean) | median peak dB |');
  out.push('|---|---|---|---|---|---|---|');
  for (const v of VARIANTS) {
    const rs = rows.filter((r) => r.variant === v.id && r.m);
    if (!rs.length) continue;
    const ratios: number[] = [];
    for (const r of rs) {
      const p = byKey.get(`${r.config}|${r.line}|plain`);
      if (p?.m) ratios.push(r.m!.durationMs / p.m.durationMs);
    }
    const fails = rows.filter((r) => r.variant === v.id && r.granularity !== 'word').length;
    out.push(`| ${v.label} | ${rs.length} | ${fails} | ${med(ratios) ?? '–'} | ${med(rs.map((r) => r.m!.termRatio ?? NaN)) ?? '–'} | ${med(rs.map((r) => r.m!.f0Ratio ?? NaN)) ?? '–'} | ${med(rs.map((r) => r.m!.peakDb)) ?? '–'} |`);
  }
  out.push('');
  out.push('## Controls (spelled-out-letters check)');
  out.push('');
  out.push('| config | caps "URGENT update" | control "Urgent update" | ratio | brand "SUSE Rancher…" | control "Suse Rancher…" | ratio |');
  out.push('|---|---|---|---|---|---|---|');
  const cfgIds = [...new Set(rows.map((r) => r.config))];
  for (const c of cfgIds) {
    const g = (l: string) => byKey.get(`${c}|${l}|plain`)?.m?.durationMs;
    const caps = g('caps'); const capsC = g('caps-ctrl'); const br = g('brand'); const brC = g('brand-ctrl');
    if (!caps && !br) continue;
    const r1 = caps && capsC ? (caps / capsC).toFixed(2) : '–';
    const r2 = br && brC ? (br / brC).toFixed(2) : '–';
    out.push(`| ${c} | ${caps ?? '–'} | ${capsC ?? '–'} | ${r1} | ${br ?? '–'} | ${brC ?? '–'} | ${r2} |`);
  }
  out.push('');
  const broken = rows.filter((r) => r.granularity !== 'word' || r.error || r.m?.silent || r.m?.nonFinite);
  out.push(`## Cells that broke (${broken.length})`);
  out.push('');
  if (broken.length) {
    out.push('| config | line | variant | what |');
    out.push('|---|---|---|---|');
    for (const r of broken) {
      const what = r.error
        ? `exception: ${r.error}`
        : r.m?.silent ? 'SILENT'
          : r.m?.nonFinite ? `${r.m.nonFinite} non-finite samples`
            : `alignment fell back to sentence spans (${(r.chunks ?? []).filter((c) => !c.aligned).map((c) => `seqLen ${c.seqLen} vs phonemes+2 ${c.phonemeChars + 2}`).join('; ')})`;
      out.push(`| ${r.config} | ${r.line} | ${r.variant} | ${what} |`);
    }
  } else out.push('None.');
  out.push('');
  return out.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--')) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return dflt;
}

async function main(): Promise<void> {
  const outDir = arg('out') ?? join(ROOT, '.tts-listen');
  const smoke = process.argv.includes('--smoke');
  const budgetS = Number(arg('budget', '1500'));
  const only = arg('configs');
  let configs = only ? CONFIGS.filter((c) => only.split(',').includes(c.id)) : CONFIGS;
  let lines = LINES;
  let variants = VARIANTS;
  if (smoke) {
    configs = configs.slice(0, 1);
    lines = LINES.filter((l) => l.id === 'statement' || l.id === 'long' || l.id === 'paren');
    variants = VARIANTS.filter((v) => v.id === 'plain' || v.id === 'pause');
  }

  const wavDir = join(outDir, 'wav');
  mkdirSync(wavDir, { recursive: true });
  const jsonl = join(outDir, 'results.jsonl');

  // Rebuild the table from a streamed (possibly interrupted) run without re-rendering.
  if (process.argv.includes('--table-only')) {
    const rows = readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row);
    writeFileSync(join(outDir, 'table.md'), `${[
      '# Kokoro prosody listen matrix (plan 181, Phase 0)',
      '', `${rows.length} cells (rebuilt from results.jsonl).`, '',
      fmtSummary(rows), fmtTable(rows, CONFIGS),
    ].join('\n')}\n`);
    process.stdout.write(`Rebuilt ${join(outDir, 'table.md')} from ${rows.length} rows.\n`);
    return;
  }
  if (!process.argv.includes('--append')) rmSync(jsonl, { force: true });

  const needed = [...new Set(configs.flatMap((c) => c.mix.map((m) => m.voice)))];
  const t0 = Date.now();
  process.stdout.write(`Loading Kokoro (${needed.length} voice matrices)…\n`);
  const rt = await loadRuntime(needed);
  process.stdout.write(`Model ready in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  const full = process.argv.includes('--full');
  const scopeOf = (cfg: VoiceConfig) => {
    const ls = lines.filter((l) => full || !cfg.scopeLines || cfg.scopeLines.includes(l.id));
    const vsFor = (l: Line) => (l.control
      ? variants.filter((v) => v.id === 'plain')
      : variants.filter((v) => full || !cfg.scopeVariants || cfg.scopeVariants.includes(v.id)));
    return { ls, vsFor };
  };

  const rows: Row[] = [];
  let done = 0;
  const total = configs.reduce((n, c) => {
    const { ls, vsFor } = scopeOf(c);
    return n + ls.reduce((k, l) => k + vsFor(l).length, 0);
  }, 0);
  let stopped = false;

  outer:
  for (const cfg of configs) {
    mkdirSync(join(wavDir, cfg.id), { recursive: true });
    const { ls, vsFor } = scopeOf(cfg);
    for (const line of ls) {
      for (const v of vsFor(line)) {
        if ((Date.now() - t0) / 1000 > budgetS) {
          process.stdout.write(`\nBudget of ${budgetS}s reached - stopping cleanly after ${done} cells.\n`);
          stopped = true;
          break outer;
        }
        const cell = buildCell(line, v.id);
        const started = Date.now();
        const row: Row = {
          config: cfg.id, configLabel: cfg.label, line: line.id, variant: v.id, variantLabel: v.label,
          text: cell.text, speed: cell.speed, gapS: cell.gapS, ms: 0,
        };
        try {
          const s = await synthCell(rt, cfg, cell);
          const rel = join('wav', cfg.id, `${line.id}__${v.id}.wav`);
          writeFileSync(join(outDir, rel), wav16(s.pcm));
          row.wav = rel;
          row.normalized = s.normalized;
          row.granularity = s.granularity;
          row.chunks = s.chunks;
          row.wordCount = s.words.length;
          row.m = measure(s.pcm);
        } catch (err) {
          row.error = (err as Error).message;
        }
        row.ms = Date.now() - started;
        rows.push(row);
        appendFileSync(jsonl, `${JSON.stringify(row)}\n`);
        done++;
        process.stdout.write(`  ${done}/${total} ${cfg.id} ${line.id} ${v.id} ${row.error ? `ERR ${row.error}` : `${row.m!.durationMs}ms ${row.granularity}`} (${row.ms}ms)\n`);
      }
    }
  }

  writeFileSync(join(outDir, 'results.json'), `${JSON.stringify({
    generated: new Date().toISOString(),
    model: KOKORO_MODEL_ID,
    sampleRate: SR,
    sentenceGapS: SENTENCE_GAP_S,
    stopped,
    elapsedS: Math.round((Date.now() - t0) / 1000),
    configs, lines, variants, rows,
  }, null, 2)}\n`);
  const md = [
    '# Kokoro prosody listen matrix (plan 181, Phase 0)',
    '',
    `Rendered ${rows.length} cells in ${Math.round((Date.now() - t0) / 1000)}s. Sample rate ${SR}, default sentence gap ${SENTENCE_GAP_S}s.`,
    `WAVs: \`wav/<config>/<line>__<variant>.wav\``,
    '',
    fmtSummary(rows),
    fmtTable(rows, configs),
  ].join('\n');
  writeFileSync(join(outDir, 'table.md'), `${md}\n`);
  process.stdout.write(`\nWrote ${join(outDir, 'table.md')} and results.json (${rows.length} cells, ${Math.round((Date.now() - t0) / 1000)}s).\n`);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`\ntts-listen-matrix failed: ${(err as Error).message}\n${(err as Error).stack ?? ''}`);
    process.exit(1);
  });
}
