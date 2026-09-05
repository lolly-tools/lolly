// SPDX-License-Identifier: MPL-2.0
/**
 * `host.speech` in Node (packages/node-shell/src/speech.ts).
 *
 * Two halves, per plans/183 section 0.5. The PURE half never skips: models-dir
 * precedence, the refusal a missing model produces, the conditional attach when
 * the inference runtime is absent, the resampler, and a drift guard that reads
 * the pin tables out of scripts/fetch-{kokoro,whisper}-models.ts so the copy in
 * speech.ts cannot quietly diverge from the one the fetch scripts verify against.
 *
 * The GATED half runs the real Kokoro and the real Whisper - one short sentence
 * synthesized, then transcribed back out of the WAV it produced - and skips by
 * MODEL NAME when the files are not staged. That round trip is the only thing
 * that proves the port: everything else could pass with a model that never loads.
 *
 * Run with: node --test packages/node-shell/test/speech.test.ts
 * Stage the models with: node scripts/fetch-kokoro-models.ts (and fetch-whisper-models.ts),
 * or `lolly models fetch kokoro` / `lolly models fetch whisper`.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SPEECH_MODEL_FILES, createNodeSpeechAPI, familyBytes, familyStatus,
  isSpeechRuntimeAvailable, missingModelFiles, modelFilePath, resampleMono, resolveModelsDir,
} from '../src/speech.ts';
import { KOKORO_MODEL_BYTES, packWav, parseWav } from '@lolly/engine';

const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const EMPTY = mkdtempSync(join(tmpdir(), 'lolly-speech-empty-'));
process.on('exit', () => rmSync(EMPTY, { recursive: true, force: true }));

// The inference runtime this file loads (transformers.js over onnxruntime-node)
// has aborted at process exit under a full-suite run on macOS (see ml.test.ts).
// Give its native side a moment to finish before node tears the process down.
after(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });

/** A resolver that pretends one package is not installed. */
function resolverWithout(missing: string): (spec: string) => string {
  return (spec) => {
    if (spec === missing) throw new Error(`Cannot find module '${spec}'`);
    return spec;
  };
}

// ─── models directory ─────────────────────────────────────────────────────────

test('the models dir follows opts → $LOLLY_MODELS_DIR → repo staging → ~/.cache', () => {
  const seen: string[] = [];
  const exists = (p: string): boolean => { seen.push(p); return false; };

  assert.equal(
    resolveModelsDir({ modelsDir: '/explicit', env: { LOLLY_MODELS_DIR: '/from-env' }, repoRoot: '/repo', exists }),
    '/explicit',
    'an explicit directory beats everything',
  );
  assert.equal(
    resolveModelsDir({ env: { LOLLY_MODELS_DIR: '/from-env' }, repoRoot: '/repo', exists }),
    '/from-env',
  );
  assert.equal(
    resolveModelsDir({ env: {}, repoRoot: '/repo', exists: () => true }),
    join('/repo', 'shells', 'web', 'public', 'models'),
    'a dev checkout shares the copy the web shell is already serving',
  );
  assert.equal(
    resolveModelsDir({ env: {}, repoRoot: '/repo', exists }),
    join(homedir(), '.cache', 'lolly', 'models'),
    'with no staging anywhere, the user cache is where a fetch would write',
  );
  assert.deepEqual(
    seen,
    [join('/repo', 'shells', 'web', 'public', 'models')],
    'the repo staging is PROBED once, on the one call that reached it - never assumed, '
    + 'and never probed when an earlier rung answered',
  );
});

test('an empty directory reports every file missing, and cached() says so', async () => {
  assert.equal(missingModelFiles(EMPTY, 'kokoro').length, SPEECH_MODEL_FILES.kokoro.length);
  assert.equal(missingModelFiles(EMPTY, 'whisper').length, SPEECH_MODEL_FILES.whisper.length);
  const status = familyStatus(EMPTY, 'kokoro');
  assert.equal(status.present, 0);
  assert.equal(status.bytesOnDisk, 0);
  assert.equal(status.bytesTotal, familyBytes('kokoro'));
  assert.equal(status.dir, join(EMPTY, 'kokoro'));

  const api = createNodeSpeechAPI({ modelsDir: EMPTY });
  if (api) {
    assert.equal(await api.cached(), false);
    assert.equal(await api.transcribeCached(), false);
    assert.equal(api.modelBytes(), KOKORO_MODEL_BYTES);
    assert.ok(api.transcribeModelBytes() > 70_000_000);
    assert.equal((await api.voices()).length, 28);
  } else {
    assert.equal(isSpeechRuntimeAvailable(), false, 'a null API is only honest when the runtime really is absent');
  }
});

// ─── refusal ──────────────────────────────────────────────────────────────────

test('a missing model refuses by name, with the exact fetch command and the byte size', async () => {
  const api = createNodeSpeechAPI({ modelsDir: EMPTY });
  if (!api) {
    assert.equal(isSpeechRuntimeAvailable(), false);
    return;
  }
  await assert.rejects(
    () => api.synthesize('hello'),
    (err: Error) => {
      assert.match(err.message, /lolly models fetch kokoro/, 'the refusal names the command that fixes it');
      assert.match(err.message, /^speech: the kokoro model is not on this machine - missing onnx\/model_quantized\.onnx/,
        'and opens with the biggest file it could not find, not three config files');
      assert.ok(err.message.includes(String(KOKORO_MODEL_BYTES)), 'and modelBytes(), so a consent line can be written from it');
      assert.match(err.message, /MB/, 'in a size a person reads too');
      // The markers a shell classifies on, so no caller has to read the prose.
      assert.equal((err as { modelMissing?: string }).modelMissing, 'kokoro');
      assert.equal((err as { kind?: string }).kind, 'MODEL_NOT_STAGED');
      return true;
    },
  );

  // Silence never reaches the decoder, so a silent clip answers without needing
  // the model at all - the refusal must come from a clip with something in it.
  const noisy = new Float32Array(16_000);
  for (let i = 0; i < noisy.length; i++) noisy[i] = Math.sin(i / 8) * 0.4;
  const wav = packWav({ channels: [noisy], sampleRate: 16_000 });
  await assert.rejects(
    () => api.transcribe(wav),
    (err: Error) => {
      assert.match(err.message, /lolly models fetch whisper/);
      return true;
    },
  );
});

test('a silent clip is answered without any model, and an mp3 is refused by name', async () => {
  const api = createNodeSpeechAPI({ modelsDir: EMPTY });
  if (!api) return;
  const silence = packWav({ channels: [new Float32Array(8_000)], sampleRate: 16_000 });
  assert.deepEqual(await api.transcribe(silence), { text: '', words: [], lang: '', granularity: 'word' });
  await assert.rejects(
    () => api.transcribe('/tmp/nothing-here.mp3'),
    /mp3 needs a platform codec this shell does not have/,
  );
});

// ─── conditional attach ───────────────────────────────────────────────────────

test('the API is null when the inference runtime cannot be resolved', () => {
  assert.equal(createNodeSpeechAPI({ resolve: resolverWithout('@huggingface/transformers') }), null);
  assert.equal(createNodeSpeechAPI({ resolve: resolverWithout('onnxruntime-node') }), null);
  assert.equal(isSpeechRuntimeAvailable(resolverWithout('@huggingface/transformers')), false);
  assert.equal(isSpeechRuntimeAvailable((s) => s), true);
});

test('without the phonemizer, synthesis is unavailable but transcription is not', () => {
  const api = createNodeSpeechAPI({ modelsDir: EMPTY, resolve: resolverWithout('phonemizer') });
  assert.ok(api, 'the phonemizer is not part of the runtime resolve');
  assert.equal(api.isAvailable(), false);
  assert.equal(api.transcribeAvailable(), true);
});

// ─── the resampler ────────────────────────────────────────────────────────────

test('resampleMono box-averages on the way down and interpolates on the way up', () => {
  const src = Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(resampleMono(src, 16_000, 16_000), src, 'an equal rate is the identity, with no copy');
  const down = resampleMono(src, 24_000, 12_000);
  assert.equal(down.length, 4);
  assert.deepEqual([...down], [0.5, 2.5, 4.5, 6.5], 'each output sample is the mean of the two it covers');
  const up = resampleMono(Float32Array.from([0, 2]), 8_000, 16_000);
  assert.deepEqual([...up], [0, 1, 2, 2], 'linear between neighbours, holding the last sample past the end');
  assert.equal(resampleMono(new Float32Array(0), 24_000, 16_000).length, 0);
});

// ─── drift guard ──────────────────────────────────────────────────────────────

/** Pull the PINS table out of a fetch script without importing it (those scripts
 *  run main() at module scope - importing one would start a download). */
function pinsFromScript(rel: string): Map<string, { sha256: string; bytes: number }> {
  const src = readFileSync(join(REPO, rel), 'utf8');
  const out = new Map<string, { sha256: string; bytes: number }>();
  const re = /'([^']+)':\s*\{\s*sha256:\s*'([0-9a-f]{64})',\s*bytes:\s*([\d_]+)\s*\}/g;
  for (const m of src.matchAll(re)) {
    out.set(m[1] as string, { sha256: m[2] as string, bytes: Number((m[3] as string).replace(/_/g, '')) });
  }
  return out;
}

test('SPEECH_MODEL_FILES matches the pin tables the fetch scripts verify against', () => {
  for (const [family, script] of [
    ['kokoro', 'scripts/fetch-kokoro-models.ts'],
    ['whisper', 'scripts/fetch-whisper-models.ts'],
  ] as const) {
    const pins = pinsFromScript(script);
    const mine = SPEECH_MODEL_FILES[family];
    assert.equal(mine.length, pins.size, `${family}: file count`);
    for (const f of mine) {
      const pin = pins.get(f.path);
      assert.ok(pin, `${family}/${f.path} is not in ${script}`);
      assert.equal(f.sha256, pin.sha256, `${family}/${f.path} sha256`);
      assert.equal(f.bytes, pin.bytes, `${family}/${f.path} bytes`);
    }
  }
});

// ─── the real models ──────────────────────────────────────────────────────────

const STAGED = resolveModelsDir();
const kokoroReady = missingModelFiles(STAGED, 'kokoro').length === 0;
const whisperReady = missingModelFiles(STAGED, 'whisper').length === 0;
const runtimeReady = isSpeechRuntimeAvailable();
const gate = (family: string, ready: boolean): string | false =>
  !runtimeReady ? '@huggingface/transformers is not installed here'
    : ready ? false
      : `the ${family} model is not staged under ${STAGED} - run: lolly models fetch ${family}`;

/** Written by the synthesis case, read by the transcription case. */
let spokenWav: Uint8Array | null = null;

test('Kokoro speaks a sentence and times its words', { skip: gate('kokoro', kokoroReady), timeout: 60_000 }, async () => {
  const api = createNodeSpeechAPI({});
  assert.ok(api);
  const heard: string[] = [];
  const result = await api.synthesize('Hello from the terminal.', {
    voice: 'bf_lily',
    onProgress: (p) => heard.push(p.phase),
  });

  assert.equal(result.sampleRate, 24_000, 'Kokoro is a 24 kHz model');
  assert.ok(result.duration > 0.5 && result.duration < 10, `a four-word sentence, not ${result.duration}s`);
  assert.equal(result.pcm.length, Math.round(result.duration * result.sampleRate));
  assert.ok(result.pcm.every((v) => Number.isFinite(v)), 'no NaN reached the buffer');
  assert.ok(Math.max(...result.pcm) > 0.01, 'and it is not silence');

  assert.equal(result.granularity, 'word', 'the timestamped export aligns per word');
  assert.deepEqual(result.words.map((w) => w.text), ['Hello', 'from', 'the', 'terminal.']);
  let at = 0;
  for (const w of result.words) {
    assert.ok(w.start >= at, `word spans are non-decreasing (${w.text})`);
    assert.ok(w.end >= w.start, `${w.text} ends after it starts`);
    assert.ok(w.end <= result.duration + 1e-6, `${w.text} sits inside the clip`);
    at = w.start;
  }
  assert.deepEqual(result.script, ['Hello from the terminal.'], 'the script comes back as consumed');
  assert.equal(result.segments.length, 1);
  assert.ok(heard.includes('synthesis'), 'progress reached the caller');

  spokenWav = packWav({ channels: [result.pcm], sampleRate: result.sampleRate });
  const back = parseWav(spokenWav);
  assert.equal(back.sampleRate, 24_000);
});

test('Whisper reads the clip Kokoro just spoke', { skip: gate('whisper', whisperReady && kokoroReady), timeout: 60_000 }, async () => {
  assert.ok(spokenWav, 'the synthesis case must have run first');
  const api = createNodeSpeechAPI({});
  assert.ok(api);
  const transcript = await api.transcribe(spokenWav, { lang: 'en' });

  assert.match(transcript.text.toLowerCase(), /hello/, `heard: ${transcript.text}`);
  assert.match(transcript.text.toLowerCase(), /terminal/, `heard: ${transcript.text}`);
  assert.equal(transcript.lang, 'en', 'a hinted language is reported back, never guessed at');
  assert.equal(transcript.granularity, 'word');
  assert.ok(transcript.words.length >= 3, `word spans: ${JSON.stringify(transcript.words)}`);
  let at = 0;
  for (const w of transcript.words) {
    assert.ok(w.start >= at - 1e-9, `stitched spans are non-decreasing (${w.text})`);
    assert.ok(w.end >= w.start);
    at = w.start;
  }
});

test('a staged family reports complete, and its files are the size the pins claim', { skip: gate('kokoro', kokoroReady) }, () => {
  const status = familyStatus(STAGED, 'kokoro');
  assert.equal(status.missing.length, 0);
  assert.equal(status.bytesOnDisk, status.bytesTotal);
  assert.equal(readFileSync(modelFilePath(STAGED, 'kokoro', 'voices/bf_lily.bin')).byteLength, 522_240);
});
