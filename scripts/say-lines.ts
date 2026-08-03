#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Narrate an arbitrary text file, one authored line at a time, on device.
 *
 * The docs corpus renderer (scripts/build-docs-audio.ts) narrates PAGES: it reads
 * docs/build.ts, speaks blocks, and pins one corpus voice. This speaks a FILE, at a
 * voice and pace you choose, with a gap after every line — the shape verse needs,
 * where the line break IS the pacing and a sentence splitter would flatten it.
 *
 * It is a second CALLER of the shared speech maths (engine/src/speech-text.ts), not a
 * second implementation: normalize/phonemize/chunk/timing and the caption grouper are
 * the same functions the web worker and the docs corpus run, so a word lands at the
 * same millisecond in all three.
 *
 *   node scripts/say-lines.ts --in poem.txt --out ./out --voice bf_emma --speed 0.85 --gap 600
 *
 * Writes <out>/{audio.wav, cues.json, captions.vtt, meta.json}. WAV because this is a
 * master for further work (an audiogram, an mp4); transcode downstream.
 *
 * Fully offline: the locally staged Kokoro model with remote models disabled, the same
 * privacy posture as the worker. Nothing is uploaded, ever.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { groupWordsToCues, cuesToVtt } from '../engine/src/captions.ts';
import { packWav } from '../engine/src/wav.ts';
import {
  KOKORO_SAMPLE_RATE, KOKORO_STYLE_DIM, KOKORO_MODEL_ID, KOKORO_VOICE_BYTES,
  SENTENCE_GAP_S, splitSentences, splitWords, phonemeTokenSpans,
  wordTimingsFromDurations, concatClips, normalizeText, phonemizeChunk,
  chunkByPhonemeLength,
} from '../engine/src/speech-text.ts';
import type { EspeakFn, SentenceClip } from '../engine/src/speech-text.ts';
import type { SpeechWordTiming } from '../packages/core/src/host-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_DIR = join(ROOT, 'shells', 'web', 'public', 'models', 'kokoro');

interface TensorLike { data: ArrayLike<number | bigint>; dims: number[] }
type TensorCtor = new (type: string, data: Float32Array | number[], dims: number[]) => unknown;
interface KokoroRuntime {
  model: (inputs: Record<string, unknown>) => Promise<{ waveform: TensorLike; durations?: TensorLike }>;
  tokenizer: (text: string, opts: { truncation: boolean }) => { input_ids: TensorLike };
  Tensor: TensorCtor;
  espeak: EspeakFn;
  voiceData: Float32Array;
}

function bail(lines: string[]): never {
  process.stdout.write(`${lines.join('\n')}\nNothing was written.\n`);
  process.exit(1);
}

async function loadKokoro(voice: string): Promise<KokoroRuntime> {
  const voicePath = join(MODEL_DIR, 'voices', `${voice}.bin`);
  if (!existsSync(join(MODEL_DIR, 'onnx', 'model_quantized.onnx'))) {
    bail([`The local Kokoro model is not staged (${MODEL_DIR}).`, '', '  node scripts/fetch-kokoro-models.ts', '']);
  }
  if (!existsSync(voicePath)) bail([`No such voice: ${voice} (looked in ${join(MODEL_DIR, 'voices')})`]);

  const { env, AutoTokenizer, StyleTextToSpeech2Model, Tensor } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = dirname(MODEL_DIR);
  const [model, tokenizer] = await Promise.all([
    StyleTextToSpeech2Model.from_pretrained(KOKORO_MODEL_ID, { dtype: 'q8' }),
    AutoTokenizer.from_pretrained(KOKORO_MODEL_ID),
  ]);
  const { phonemize } = await import('phonemizer');
  const raw = readFileSync(voicePath);
  const voiceData = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  if (voiceData.byteLength !== KOKORO_VOICE_BYTES) {
    throw new Error(`voice ${voice} is ${voiceData.byteLength} bytes, expected ${KOKORO_VOICE_BYTES}`);
  }
  return {
    model: model as unknown as KokoroRuntime['model'],
    tokenizer: tokenizer as unknown as KokoroRuntime['tokenizer'],
    Tensor: Tensor as unknown as TensorCtor,
    espeak: phonemize as EspeakFn,
    voiceData,
  };
}

/** Synthesize one line. Mirrors the worker's per-sentence loop; a verse line is
 *  usually one sentence, but a line with internal punctuation still splits the way
 *  every other caller splits it. */
async function synthesizeLine(
  rt: KokoroRuntime, text: string, voice: string, speed: number,
): Promise<{ pcm: Float32Array; words: SpeechWordTiming[] }> {
  const language = voice.startsWith('b') ? 'b' as const : 'a' as const;
  const sentences = splitSentences(normalizeText(text));
  interface Piece { pcm: Float32Array; sentence: string; wordEntries: SpeechWordTiming[] | null }
  const pieces: Piece[] = [];

  for (const sentence of sentences) {
    const words = splitWords(sentence);
    const wordPhonemes: string[] = [];
    for (const w of words) wordPhonemes.push(await phonemizeChunk(rt.espeak, w, language));

    for (const chunk of chunkByPhonemeLength(words, wordPhonemes)) {
      const phonemes = chunk.phonemes.join(' ');
      const { input_ids } = rt.tokenizer(phonemes, { truncation: true });
      const seqLen = input_ids.dims[input_ids.dims.length - 1] ?? 0;
      const numTokens = Math.min(Math.max(seqLen - 2, 0), 509);
      const style = rt.voiceData.slice(numTokens * KOKORO_STYLE_DIM, (numTokens + 1) * KOKORO_STYLE_DIM);
      const outputs = await rt.model({
        input_ids,
        style: new rt.Tensor('float32', style, [1, KOKORO_STYLE_DIM]),
        speed: new rt.Tensor('float32', [speed], [1]),
      });
      const wave = outputs.waveform.data as Float32Array;

      let wordEntries: SpeechWordTiming[] | null = null;
      if (outputs.durations && seqLen === phonemes.length + 2) {
        const spans = phonemeTokenSpans(chunk.phonemes);
        const times = wordTimingsFromDurations(outputs.durations.data, spans, wave.length, KOKORO_SAMPLE_RATE);
        if (times) wordEntries = chunk.words.map((t, j) => ({ text: t, start: times[j]!.start, end: times[j]!.end }));
      }
      pieces.push({ pcm: wave, sentence: chunk.words.join(' '), wordEntries });
    }
  }

  const allAligned = pieces.length > 0 && pieces.every((p) => p.wordEntries !== null);
  const clips: SentenceClip[] = pieces.map((p) => ({
    pcm: p.pcm,
    words: allAligned
      ? (p.wordEntries as SpeechWordTiming[])
      : [{ text: p.sentence, start: 0, end: p.pcm.length / KOKORO_SAMPLE_RATE }],
  }));
  return concatClips(clips, SENTENCE_GAP_S, KOKORO_SAMPLE_RATE);
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  if (fallback !== undefined) return fallback;
  bail([`Missing --${name}`]);
}

async function main(): Promise<void> {
  const inPath = resolve(arg('in'));
  const outDir = resolve(arg('out'));
  const voice = arg('voice', 'bf_emma');
  const speed = Number(arg('speed', '0.85'));
  const gapMs = Number(arg('gap', '500'));
  // A blank line in the source is a longer rest — the stanza break, if the text has one.
  const stanzaMs = Number(arg('stanza-gap', String(gapMs * 2)));

  const raw = readFileSync(inPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const lines = raw.map((l) => l.trim());
  if (!lines.some((l) => l)) bail([`${inPath} has no spoken lines.`]);

  process.stdout.write(`Narrating ${lines.filter(Boolean).length} lines as ${voice} at ${speed}× (gap ${gapMs}ms)…\n`);
  const rt = await loadKokoro(voice);

  const sr = KOKORO_SAMPLE_RATE;
  const pieces: Float32Array[] = [];
  const words: SpeechWordTiming[] = [];
  const lineCues: Array<{ line: string; start: number; end: number }> = [];
  let cursor = 0;      // samples
  let pendingGapMs = 0;

  for (const line of lines) {
    if (!line) { pendingGapMs = stanzaMs; continue; }   // blank line = a longer rest
    if (cursor > 0) {
      const ms = pendingGapMs || gapMs;
      const gap = new Float32Array(Math.round((ms / 1000) * sr));
      pieces.push(gap);
      cursor += gap.length;
    }
    pendingGapMs = 0;

    const out = await synthesizeLine(rt, line, voice, speed);
    const offset = cursor / sr;
    for (const w of out.words) words.push({ text: w.text, start: w.start + offset, end: w.end + offset });
    lineCues.push({ line, start: offset, end: offset + out.pcm.length / sr });
    pieces.push(out.pcm);
    cursor += out.pcm.length;
    process.stdout.write(`  ${offset.toFixed(2)}s  ${line}\n`);
  }

  const pcm = new Float32Array(cursor);
  let at = 0;
  for (const p of pieces) { pcm.set(p, at); at += p.length; }

  mkdirSync(outDir, { recursive: true });
  const wav = packWav({ sampleRate: sr, channels: [pcm] }, { format: 'int16' });
  writeFileSync(join(outDir, 'audio.wav'), wav);
  writeFileSync(join(outDir, 'cues.json'), JSON.stringify({ lines: lineCues, words }, null, 2));
  writeFileSync(join(outDir, 'captions.vtt'), cuesToVtt(groupWordsToCues(words)));
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify({
    voice, speed, gapMs, stanzaMs, sampleRate: sr,
    durationSec: Number((cursor / sr).toFixed(3)),
    model: KOKORO_MODEL_ID,
    synthetic: true,
    note: 'Generated audio, not a human reader.',
  }, null, 2));

  process.stdout.write(`\n${(cursor / sr).toFixed(2)}s → ${outDir}/audio.wav\n`);
}

await main();
