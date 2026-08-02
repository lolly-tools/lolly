#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Renders the /info docs narration artefacts (plans/docs-audio-listen.md §4) —
 * per page: audio.opus + captions.vtt + cues.json + viz.bin + meta.json under
 * docs/audio/<lang>/<slug>/, committed like docs/shots and only *linked* by
 * docs/build.ts, which never runs TTS.
 *
 * ANDY-RUN ONLY. Like scripts/fetch-trustmark-models.ts and
 * scripts/fetch-kokoro-models.ts, this script needs things CI must never have —
 * the LOCAL Kokoro model staged at shells/web/public/models/kokoro/ (the ~92 MB
 * timestamped q8 ONNX + tokenizer + voice matrices scripts/fetch-kokoro-models.ts
 * downloads and sha256-pins), and ffmpeg on PATH — and it is never invoked by
 * `npm install`/`postinstall`/CI. CI's whole involvement is
 * tests/docs-audio-stale.test.ts, which only verifies COMMITTED artefacts
 * against the current docs source (plan §10). When any prerequisite is absent
 * this script prints the exact install/run steps and exits 0 without writing a
 * byte, so an accidental invocation on a clean clone is a no-op, not a
 * half-written artefact directory.
 *
 * Usage:
 *   node scripts/build-docs-audio.ts             # re-render stale/missing LAUNCH pages
 *   node scripts/build-docs-audio.ts --check     # list stale/missing, write NOTHING, exit 1 if any
 *   node scripts/build-docs-audio.ts --force creators   # re-render one slug regardless
 *
 * ── The staleness contract (plan §5) ──────────────────────────────────────
 * meta.json.textHash is `spokenTextHash(extractSpokenText(source))` — sha256 of
 * the whitespace-normalised spoken-text document from
 * scripts/lib/docs-spoken-text.ts. Chrome/CSS/shot-recipe/translation churn
 * never touches it; only edits to the words a listener would hear do. `--check`
 * compares committed hashes against the current source; the default run
 * re-renders only pages whose hash moved (or which are missing entirely).
 * Voice/model upgrades are a deliberate `--force`, never automatic.
 *
 * ── Synthesis (plan §4.2, roadmap §4's one-synthesis-layer rule) ──────────
 * The SAME stack as host.speech's worker
 * (shells/web/src/lib/speech-kokoro-worker.ts): @huggingface/transformers +
 * phonemizer directly (both resolve from the shells/web workspace, hoisted to
 * the root node_modules), loading the timestamped Kokoro q8 model from
 * shells/web/public/models/kokoro with remote models disabled — the worker's
 * privacy posture, no huggingface.co fetch ever — and the engine's shared pure
 * logic (engine/src/speech-text.ts) for normalize/split/chunk/span/timing
 * maths, so the docs narration speaks words exactly the way every shell does.
 * One voice for the whole corpus (VOICE below — voice churn re-renders
 * everything, so it changes only with a corpus-wide --force pass). Synthesised
 * PER BLOCK and concatenated with authored gaps (700 ms before a heading,
 * 350 ms before a paragraph/list item), which keeps each chunk inside Kokoro's
 * input budget and yields block start-times for free — those are the launch
 * cues. The timestamped model's `durations` output gives WORD timings too:
 * cues.json is `{ blocks: [{ blockId, start, end }], words: [{ text, start,
 * end }] }` — the reader-compat shape blocks-only launch promised. Loudness is
 * normalised in the encode step (ffmpeg loudnorm, I=-19 — the plan's ≈ −19
 * LUFS mono target) and the encode is Opus-in-Ogg at 24 kbps voice profile
 * (~180 KB/min).
 *
 * ── viz.bin (plan §4.4) ───────────────────────────────────────────────────
 * The FINISHED opus is decoded back to PCM (ffmpeg → raw f32le mono 48 kHz)
 * and run through the engine's own analysePcm (engine/src/audio-analyse.ts —
 * the same maths every shell reads) with `samples` opted in, then packed per
 * the audiogram's vizWave/vizMeta contract (tools/audiogram/hooks.js ~line
 * 199): byte-quantised scalar tracks in the audiogram's section order, then
 * the raw Uint8 time-domain windows butterchurn's driven mode eats. Speech has
 * no beat grid — `bpm` comes back null and stays out of the file; the player
 * drives visuals from rms/flux, never a tempo. Layout:
 *
 *   bytes 0..3   'LVIZ' magic
 *   bytes 4..7   uint32 LE header length
 *   header       JSON { count, samples, fps, poster, tracks }
 *   payload      tracks.length × count bytes (0..255-quantised, track-major,
 *                audiogram order: rms, peak, bass, mid, treb, flux),
 *                then count × samples raw wave bytes (already 0..255,
 *                centred on 128 — copied, never re-quantised)
 *
 * ── Captions ──────────────────────────────────────────────────────────────
 * captions.vtt comes from the engine's own caption maths — groupWordsToCues
 * over the word timings, serialised by cuesToVtt (engine/src/captions.ts) —
 * so a docs caption breaks lines at the same words a host.speech caption
 * does. When a block degrades to sentence granularity (durations shape
 * mismatch), the grouper passes sentence spans through mostly unchanged, the
 * documented fallback.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractSpokenText, spokenTextHash, type SpokenBlock } from './lib/docs-spoken-text.ts';
import { analysePcm } from '../engine/src/audio-analyse.ts';
import { groupWordsToCues, cuesToVtt } from '../engine/src/captions.ts';
import {
  KOKORO_SAMPLE_RATE, KOKORO_STYLE_DIM, KOKORO_MODEL_ID, KOKORO_VOICE_BYTES,
  SENTENCE_GAP_S, splitSentences, splitWords, phonemeTokenSpans,
  wordTimingsFromDurations, concatClips, normalizeText, phonemizeChunk,
  chunkByPhonemeLength,
} from '../engine/src/speech-text.ts';
import type { EspeakFn, SentenceClip } from '../engine/src/speech-text.ts';
import type { SpeechWordTiming } from '../packages/core/src/host-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const AUDIO_ROOT = join(DOCS, 'audio');

/** Launch language. The layout is audio/<lang>/<slug>/ from day one (plan §9)
 *  but only English renders today — locale audio waits on per-locale Kokoro
 *  voice coverage and the storage curve. */
export const LANG = 'en';

/** One voice for the whole corpus (plan §4.2) — af_heart, the top-graded en-US
 *  voice in Kokoro's own table (KOKORO_VOICES in engine/src/speech-text.ts).
 *  Changing it stales EVERY page: that is a --force-everything day, chosen
 *  deliberately, not a hash-driven re-render. */
export const VOICE = 'af_heart';

/** The upstream model this local copy was fetched from (see
 *  scripts/fetch-kokoro-models.ts). Recorded in meta.json as modelVersion so a
 *  model upgrade is visible per artefact. */
export const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** The locally staged model directory (scripts/fetch-kokoro-models.ts) — the
 *  same files the web worker loads from /models/kokoro/. */
const MODEL_DIR = join(ROOT, 'shells', 'web', 'public', 'models', 'kokoro');

/**
 * The launch set (plan §1/§11): the landing page plus the three pathway hubs —
 * the guided entry points ("For Creators / Builders / Operators" in
 * docs/build.ts's NAV). Quickstart and Trust are hubs in the sidebar sense too,
 * but the launch gate is storage (§7's budget maths), so the list stays this
 * small until real feedback argues for more. Expansion is editing this array.
 */
export const LAUNCH_PAGES: string[] = ['index', 'creators', 'builders', 'operators'];

/** Every file a finished artefact directory carries (plan §4.5). */
export const ARTEFACT_FILES = ['audio.opus', 'captions.vtt', 'cues.json', 'viz.bin', 'meta.json'] as const;

/** Inter-block gaps in ms, keyed by the kind of the block BEING INTRODUCED
 *  (plan §4.2: heading 700 ms, paragraph 350 ms). No gap before the first. */
const GAP_MS: Record<SpokenBlock['kind'], number> = { heading: 700, para: 350, listItem: 350 };

/** analysePcm settings for viz.bin — the audiogram's own numbers
 *  (tools/audiogram/hooks.js: FPS/BANDS/BUCKETS/VIZ_SAMPLES) so the docs
 *  player and the audiogram read frames of identical shape. */
const VIZ = { fps: 30, bands: 48, buckets: 160, samples: 1024 } as const;
/** Decode rate for the viz analysis pass — Opus's native output rate. */
const VIZ_DECODE_HZ = 48_000;

/** The scalar tracks packed into viz.bin, in the audiogram's section order. */
const VIZ_TRACKS = ['rms', 'peak', 'bass', 'mid', 'treb', 'flux'] as const;

export interface AudioMeta {
  slug: string;
  lang: string;
  voice: string;
  modelVersion: string;
  textHash: string;
  duration: number;
  bytes: number;
  generated: string;
}

/**
 * slug → markdown source file, read from docs/build.ts's own pages[] array.
 * build.ts deliberately has no exports (the spoken-text module documents the
 * same constraint for headingId), so this parses the literal — the same move
 * as tests/docs-spoken-text.test.ts's parity tripwire. Returns null for a slug
 * build.ts no longer lists, which is how a retired page's artefacts surface.
 */
export function pageSource(slug: string): string | null {
  const src = readFileSync(join(DOCS, 'build.ts'), 'utf8');
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`\\{\\s*slug:\\s*'${escaped}'\\s*,[^}]*?src:\\s*'([^']+)'`).exec(src);
  return m ? m[1]! : null;
}

/** The current spoken-text document + staleness hash for a slug's source. */
export function currentSpoken(slug: string): { blocks: SpokenBlock[]; hash: string } | null {
  const src = pageSource(slug);
  if (!src || !existsSync(join(DOCS, src))) return null;
  const blocks = extractSpokenText(readFileSync(join(DOCS, src), 'utf8'));
  return { blocks, hash: spokenTextHash(blocks) };
}

/** Committed artefact slugs for one language (empty when nothing has shipped). */
export function committedSlugs(lang: string): string[] {
  const dir = join(AUDIO_ROOT, lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'meta.json')))
    .map((d) => d.name)
    .sort();
}

type Status = 'fresh' | 'stale' | 'missing' | 'unlisted';

/** One page's staleness verdict against its committed meta.json. */
export function pageStatus(slug: string): { status: Status; committed?: AudioMeta; currentHash?: string } {
  const metaPath = join(AUDIO_ROOT, LANG, slug, 'meta.json');
  const committed = existsSync(metaPath)
    ? (JSON.parse(readFileSync(metaPath, 'utf8')) as AudioMeta)
    : undefined;
  const spoken = currentSpoken(slug);
  if (!spoken) return { status: 'unlisted', committed };
  if (!committed) return { status: 'missing', currentHash: spoken.hash };
  return {
    status: committed.textHash === spoken.hash ? 'fresh' : 'stale',
    committed,
    currentHash: spoken.hash,
  };
}

// ── Synthesis + packing ─────────────────────────────────────────────────────

/** 0..1 → one byte, clamped — audiogram hooks.js's byte(), same rounding. */
function toByte(v: number): number {
  const n = Math.round((Number.isFinite(v) ? v : 0) * 255);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

/** The audiogram's `loudest()` — the poster frame is the peak-RMS instant,
 *  searched away from the fade-prone first/last 10%. */
function posterFrame(rms: Float32Array, count: number): number {
  const lo = Math.floor(count * 0.1);
  const hi = Math.ceil(count * 0.9);
  let best = lo;
  let bv = -1;
  for (let i = lo; i < hi && i < count; i++) if (rms[i]! > bv) { bv = rms[i]!; best = i; }
  return best;
}

function ffmpegAvailable(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
}

function runFfmpeg(args: string[], what: string): Buffer {
  const r = spawnSync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) {
    const tail = (r.stderr?.toString() ?? '').split('\n').slice(-6).join('\n');
    throw new Error(`ffmpeg failed while ${what}:\n${tail}\n(If the opus encode failed, check \`ffmpeg -encoders | grep libopus\`.)`);
  }
  return r.stdout;
}

interface Cue { blockId: string; start: number; end: number }

/** Everything one page's artefact directory holds, built in memory first so a
 *  failure anywhere leaves the committed directory untouched. */
interface Rendered {
  opus: Buffer;
  vtt: string;
  cues: Cue[];
  words: SpeechWordTiming[];
  viz: Buffer;
  meta: AudioMeta;
}

// Minimal shapes for the transformers.js pieces we touch — the same four
// operations (and the same rationale) as the web worker's KokoroRuntime:
// the package's own typings are bundler-hostile generics.
interface TensorLike { data: ArrayLike<number | bigint>; dims: number[] }
type TensorCtor = new (type: string, data: Float32Array | number[], dims: number[]) => unknown;
interface KokoroRuntime {
  model: (inputs: Record<string, unknown>) => Promise<{ waveform: TensorLike; durations?: TensorLike }>;
  tokenizer: (text: string, opts: { truncation: boolean }) => { input_ids: TensorLike };
  Tensor: TensorCtor;
  espeak: EspeakFn;
  voiceData: Float32Array;
}

/**
 * Synthesize one spoken block — the web worker's per-sentence loop
 * (shells/web/src/lib/speech-kokoro-worker.ts synthesize()), minus the
 * progress/abort machinery: normalize the whole block, split into sentences,
 * phonemize per WORD so each word's token span is known by construction, chunk
 * by the model's real phoneme budget, and read word timings off the
 * timestamped model's `durations` output. Returns mono PCM at
 * KOKORO_SAMPLE_RATE plus word timings relative to the block start (sentence
 * spans when any chunk's alignment invariant fails — uniform granularity, like
 * the worker).
 */
async function synthesizeBlock(rt: KokoroRuntime, text: string): Promise<{ pcm: Float32Array; words: SpeechWordTiming[] }> {
  // af_/am_ voices are en-US — 'a' in Kokoro's accent scheme (b* = en-GB).
  const language = VOICE.startsWith('b') ? 'b' as const : 'a' as const;
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
      // Style row is indexed by token count (rows 0..509) — the model was
      // trained with a per-length style lookup.
      const numTokens = Math.min(Math.max(seqLen - 2, 0), 509);
      const style = rt.voiceData.slice(numTokens * KOKORO_STYLE_DIM, (numTokens + 1) * KOKORO_STYLE_DIM);
      const outputs = await rt.model({
        input_ids,
        style: new rt.Tensor('float32', style, [1, KOKORO_STYLE_DIM]),
        speed: new rt.Tensor('float32', [1], [1]),
      });
      const wave = outputs.waveform.data as Float32Array;

      // Word alignment holds only when the char-level tokenizer invariant does
      // (one token per phoneme char + BOS/EOS, nothing truncated) AND the
      // durations output is present and one-per-token.
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
  const { pcm, words } = concatClips(clips, SENTENCE_GAP_S, KOKORO_SAMPLE_RATE);
  return { pcm, words };
}

async function renderPage(slug: string, tts: KokoroRuntime, tmp: string): Promise<Rendered> {
  const spoken = currentSpoken(slug);
  if (!spoken) throw new Error(`${slug}: not listed in docs/build.ts pages[] — nothing to narrate`);

  // Per-block synthesis, concatenated with the authored gaps. Cue times come
  // from sample positions — exact by construction — and each block's word
  // timings (from the timestamped model's durations output) are offset by its
  // start into the page timeline.
  const sr = KOKORO_SAMPLE_RATE;
  const pieces: Float32Array[] = [];
  const cues: Cue[] = [];
  const words: SpeechWordTiming[] = [];
  let cursor = 0; // samples
  for (const block of spoken.blocks) {
    const out = await synthesizeBlock(tts, block.text);
    if (cursor > 0) {
      const gap = new Float32Array(Math.round((GAP_MS[block.kind] / 1000) * sr));
      pieces.push(gap);
      cursor += gap.length;
    }
    const t0 = cursor / sr;
    cues.push({ blockId: block.blockId, start: t0, end: t0 + out.pcm.length / sr });
    for (const w of out.words) words.push({ text: w.text, start: t0 + w.start, end: t0 + w.end });
    pieces.push(out.pcm);
    cursor += out.pcm.length;
    process.stdout.write(`  ${slug}: ${cues.length}/${spoken.blocks.length} blocks\r`);
  }
  process.stdout.write('\n');
  if (!cursor) throw new Error(`${slug}: synthesis produced no audio`);

  const pcm = new Float32Array(cursor);
  let at = 0;
  for (const p of pieces) { pcm.set(p, at); at += p.length; }

  // Master + encode in one ffmpeg pass: mono, loudnorm to the plan's ≈ −19
  // LUFS, Opus-in-Ogg 24 kbps voice profile. Loudness moves cue times not at
  // all (loudnorm in linear mode is gain, and even dynamic mode preserves
  // timing), so the sample-derived cues stay honest against the encode.
  const rawPath = join(tmp, `${slug}.f32`);
  writeFileSync(rawPath, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  const opusPath = join(tmp, `${slug}.opus`);
  runFfmpeg([
    '-y', '-f', 'f32le', '-ar', String(sr), '-ac', '1', '-i', rawPath,
    '-af', 'loudnorm=I=-19:TP=-1.5:LRA=11',
    '-c:a', 'libopus', '-b:a', '24k', '-application', 'voip',
    opusPath,
  ], `encoding ${slug}`);
  const opus = readFileSync(opusPath);

  // Subtitles: the engine's own caption maths over the word timings, so a
  // docs caption breaks lines at the same words a host.speech caption does.
  // Sentence-granular fallback words pass through the grouper mostly unchanged.
  const vtt = cuesToVtt(groupWordsToCues(words));

  // viz.bin: decode the FINISHED opus (what listeners actually hear, loudnorm
  // included) and run the engine's shared analysis maths.
  const decoded = runFfmpeg(
    ['-i', opusPath, '-f', 'f32le', '-ac', '1', '-ar', String(VIZ_DECODE_HZ), '-'],
    `decoding ${slug} for analysis`,
  );
  const aligned = decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.length - (decoded.length % 4));
  const analysis = analysePcm([new Float32Array(aligned)], VIZ_DECODE_HZ, VIZ);
  const f = analysis.frames;
  const header = Buffer.from(JSON.stringify({
    count: f.count,
    samples: f.samples,
    fps: VIZ.fps,
    poster: posterFrame(f.rms, f.count),
    tracks: VIZ_TRACKS,
  }));
  const viz = Buffer.alloc(8 + header.length + VIZ_TRACKS.length * f.count + f.count * f.samples);
  viz.write('LVIZ', 0, 'ascii');
  viz.writeUInt32LE(header.length, 4);
  header.copy(viz, 8);
  let vAt = 8 + header.length;
  for (const track of VIZ_TRACKS) {
    const src = f[track];
    for (let i = 0; i < f.count; i++) viz[vAt++] = toByte(src[i]!);
  }
  // Wave windows are already 0..255 centred on 128 — copy, do not re-quantise.
  viz.set(f.wave.subarray(0, f.count * f.samples), vAt);

  const meta: AudioMeta = {
    slug,
    lang: LANG,
    voice: VOICE,
    modelVersion: MODEL_ID,
    textHash: spoken.hash,
    duration: Math.round((cursor / sr) * 1000) / 1000,
    bytes: opus.length,
    generated: new Date().toISOString(),
  };

  return { opus, vtt, cues, words, viz, meta };
}

function writeArtefacts(slug: string, r: Rendered): void {
  const dir = join(AUDIO_ROOT, LANG, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'audio.opus'), r.opus);
  writeFileSync(join(dir, 'captions.vtt'), r.vtt);
  // The reader-compat shape the header promises: `words` beside `blocks`. The
  // launch player only consumes blocks; word timings feed the captions and any
  // future karaoke-style highlight without a reader change.
  writeFileSync(join(dir, 'cues.json'), `${JSON.stringify({ blocks: r.cues, words: r.words }, null, 2)}\n`);
  writeFileSync(join(dir, 'viz.bin'), r.viz);
  writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(r.meta, null, 2)}\n`);
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  process.stdout.write(
    `  wrote docs/audio/${LANG}/${slug}/ — ${r.meta.duration.toFixed(1)}s, `
    + `opus ${kb(r.opus.length)}, viz ${kb(r.viz.length)}, ${r.cues.length} cues, ${r.words.length} words\n`,
  );
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function bail(lines: string[]): never {
  process.stdout.write(`${lines.join('\n')}\nNothing was written.\n`);
  process.exit(0);
}

async function loadKokoro(): Promise<KokoroRuntime> {
  // Prereq: the locally staged model. Everything loads from MODEL_DIR with
  // remote models disabled — the worker's privacy posture, never a
  // huggingface.co fetch — so an absent stage is a printed recipe, not a
  // download.
  const voicePath = join(MODEL_DIR, 'voices', `${VOICE}.bin`);
  if (!existsSync(join(MODEL_DIR, 'onnx', 'model_quantized.onnx')) || !existsSync(voicePath)) {
    bail([
      `The local Kokoro model is not staged (${MODEL_DIR}).`,
      'Fetch it once (sha256-pinned, ~92 MB + voices):',
      '',
      '  node scripts/fetch-kokoro-models.ts',
      '',
      'then re-run. Synthesis is fully offline from there.',
    ]);
  }
  try {
    const { env, AutoTokenizer, StyleTextToSpeech2Model, Tensor } = await import('@huggingface/transformers');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = dirname(MODEL_DIR); // model id KOKORO_MODEL_ID resolves to MODEL_DIR
    const [model, tokenizer] = await Promise.all([
      StyleTextToSpeech2Model.from_pretrained(KOKORO_MODEL_ID, { dtype: 'q8' }),
      AutoTokenizer.from_pretrained(KOKORO_MODEL_ID),
    ]);
    const { phonemize } = await import('phonemizer');
    // Buffer views are not guaranteed 4-byte aligned — copy before casting.
    const raw = readFileSync(voicePath);
    const voiceData = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    if (voiceData.byteLength !== KOKORO_VOICE_BYTES) {
      throw new Error(`voice ${VOICE} is ${voiceData.byteLength} bytes, expected ${KOKORO_VOICE_BYTES} — re-run scripts/fetch-kokoro-models.ts`);
    }
    return {
      model: model as unknown as KokoroRuntime['model'],
      tokenizer: tokenizer as unknown as KokoroRuntime['tokenizer'],
      Tensor: Tensor as unknown as TensorCtor,
      espeak: phonemize as EspeakFn,
      voiceData,
    };
  } catch (err) {
    bail([
      `Could not load the Kokoro model from ${MODEL_DIR}: ${(err as Error).message}`,
      '(@huggingface/transformers and phonemizer resolve from the shells/web',
      'workspace — run `npm install` at the repo root if node_modules is bare,',
      'and re-stage the model with `node scripts/fetch-kokoro-models.ts` if its',
      'files are damaged.)',
    ]);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const forceSlug = (() => {
    const i = args.indexOf('--force');
    if (i < 0) return undefined;
    const slug = args[i + 1];
    // A bare --force must not quietly degrade to a normal stale-only run —
    // the operator asked for a specific re-render and should say which.
    if (!slug || slug.startsWith('--')) {
      console.error('--force needs a slug (e.g. --force creators)');
      process.exit(1);
    }
    return slug;
  })();

  // The audit set: every launch page, plus anything already committed (a page
  // that later left the launch list still has artefacts to keep honest).
  const audit = [...new Set([...LAUNCH_PAGES, ...committedSlugs(LANG)])];
  const verdicts = audit.map((slug) => ({ slug, ...pageStatus(slug) }));

  if (check) {
    let bad = 0;
    for (const v of verdicts) {
      if (v.status === 'fresh') { process.stdout.write(`  fresh    ${v.slug}\n`); continue; }
      bad++;
      if (v.status === 'unlisted') process.stdout.write(`  UNLISTED ${v.slug} — artefacts committed but docs/build.ts no longer lists the page\n`);
      else if (v.status === 'missing') process.stdout.write(`  MISSING  ${v.slug} — launch page with no committed narration\n`);
      else process.stdout.write(`  STALE    ${v.slug} — committed ${v.committed!.textHash.slice(0, 12)}… vs current ${v.currentHash!.slice(0, 12)}…\n`);
    }
    process.stdout.write(bad ? `\n${bad} page(s) need attention. --check writes nothing; run without it to re-render.\n` : '\nAll narration is current.\n');
    process.exit(bad ? 1 : 0);
  }

  // A launch page pageSource() cannot find is a broken lookup (a pages[] edit
  // in docs/build.ts, or a renamed source file), never a page that is fine —
  // dropping it from targets would print "all current" over a lie.
  const unlisted = verdicts.filter((v) => LAUNCH_PAGES.includes(v.slug) && v.status === 'unlisted');
  if (unlisted.length) {
    throw new Error(
      `launch page(s) not found in docs/build.ts pages[] (or their source file is missing): `
      + `${unlisted.map((v) => v.slug).join(', ')} — fix LAUNCH_PAGES or pageSource()'s literal parse`,
    );
  }

  const targets = forceSlug
    ? [forceSlug]
    : LAUNCH_PAGES.filter((slug) => {
        const v = verdicts.find((x) => x.slug === slug)!;
        return v.status === 'stale' || v.status === 'missing';
      });
  if (!targets.length) {
    process.stdout.write('All launch-page narration is current. Use --force <slug> to re-render anyway.\n');
    return;
  }
  for (const slug of targets) {
    if (!currentSpoken(slug)) {
      throw new Error(`${slug}: not listed in docs/build.ts pages[] (or its source file is missing)`);
    }
  }

  if (!ffmpegAvailable()) {
    bail([
      'ffmpeg is not on PATH — it does the Opus encode, the loudness pass, and',
      'the PCM decode for viz.bin. Install it (macOS: `brew install ffmpeg`,',
      'needs libopus, which the default build includes) and re-run.',
    ]);
  }
  const tts = await loadKokoro();

  const tmp = mkdtempSync(join(tmpdir(), 'lolly-docs-audio-'));
  try {
    for (const slug of targets) {
      process.stdout.write(`Rendering ${slug} (voice ${VOICE})…\n`);
      const rendered = await renderPage(slug, tts, tmp);
      writeArtefacts(slug, rendered);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  process.stdout.write(
    '\nDone. Commit docs/audio/ like docs/shots — tests/docs-audio-stale.test.ts\n'
    + 'holds the artefacts to the staleness contract from here on.\n',
  );
}

// Import-safe: tests/docs-audio-stale.test.ts imports the staleness helpers
// above, and importing a module must never start a render.
const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`\nbuild-docs-audio failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
