#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the Whisper-base speech-recognition ONNX model (timestamped export,
 * q8 quantised) into shells/web/public/models/whisper/ - the same-origin
 * location the transcription worker
 * (shells/web/src/lib/speech-whisper-worker.ts) loads it from at runtime via
 * transformers.js (`env.localModelPath = '/models/'`, remote models disabled).
 *
 * ANDY-RUN ONLY. Like scripts/fetch-kokoro-models.ts, this needs network
 * access and is never invoked by `npm install`/`postinstall`/CI - the model is
 * ~77 MB, not something every clone/deploy should pay for, and
 * host.speech.transcribe loads it lazily, once, only when someone actually
 * asks for a transcript.
 *
 * Usage:
 *   node scripts/fetch-whisper-models.ts                 # model + configs + tokenizer
 *   node scripts/fetch-whisper-models.ts --refresh-pins  # deliberate model upgrade: skip
 *                                                        # verification, print new pin lines
 *
 * ── Source ────────────────────────────────────────────────────────────────
 * https://huggingface.co/onnx-community/whisper-base_timestamped
 * (derived from openai/whisper-base, MIT; the _timestamped repo itself carries
 * no license tag - recorded in the licensing audit, plans/41-tts-stt-programme.md
 * section 9). The TIMESTAMPED export is the point: it keeps the cross-attention
 * outputs transformers.js needs for `return_timestamps: 'word'`, which is what
 * lets host.speech.transcribe report per-word spans for captions. q8 quantised
 * (*_quantized.onnx) - the dtype the speech worker requests, same tier as
 * Kokoro. Known trap on this export: transformers.js's own 30 s chunking
 * (`chunk_length_s`) yields invalid timestamps (transformers.js #1358), so the
 * worker chunks manually - nothing here depends on that, but it is why the
 * plain whisper-base export is NOT a drop-in substitute.
 *
 * Integrity: every file is pinned to a SHA-256 hash (computed from the
 * downloaded-and-verified 2026-08-02 set) and verified BEFORE it is written - 
 * a mismatch exits non-zero with nothing written, so a tampered or re-exported
 * release can never land silently. A file already on disk whose hash matches
 * its pin is skipped without touching the network. For a deliberate model
 * upgrade, run with --refresh-pins and paste the printed lines over PINS.
 *
 * ── ALSO REQUIRED: transformers.js's pinned onnxruntime-web runtime ───────
 * Same as Kokoro: after `npm install`, `npm run build:ort` (or
 * `node scripts/copy-transformers-ort.ts`) stages the pinned onnxruntime-web
 * build at shells/web/public/ort-hf/<version>/.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/whisper');

const BASE = 'https://huggingface.co/onnx-community/whisper-base_timestamped/resolve/main/';

// Repo-relative paths transformers.js expects under localModelPath/whisper/:
// the processor + tokenizer configs, the generation config (Whisper's decoding
// needs its forced/suppressed token tables), and the q8 encoder + merged
// decoder the 'q8' dtype resolves to.
const MODEL_FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

// Per-file SHA-256 + byte-length pins (2026-08-02, from the verified-working
// set). Verified BEFORE writing; refresh with --refresh-pins on a deliberate
// upgrade. The onnx byte counts are mirrored in WHISPER_MODEL_BYTES
// (shells/web/src/lib/speech-whisper.ts) - keep the two in sync.
const PINS: Record<string, { sha256: string; bytes: number }> = {
  'config.json': { sha256: 'f4d0608f7d918166da7edb3e188de5ef1bfe70d9802e785d271fd88111e9cf4b', bytes: 2_243 },
  'generation_config.json': { sha256: '61070cf8de25b1e9256e8e102ded49d8d24a8369ed36ef84fdf21549e68125a0', bytes: 3_832 },
  'preprocessor_config.json': { sha256: 'a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d', bytes: 339 },
  'tokenizer.json': { sha256: '27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566', bytes: 2_480_466 },
  'tokenizer_config.json': { sha256: '2e036e4dbacfdeb7242c7d4ec4149f4a16e86026048f94d1637e3a8ee9c6a573', bytes: 282_682 },
  'onnx/encoder_model_quantized.onnx': { sha256: '2714484ebe1bae7c1646e8eadb768bb9d415cf11763466d21f23039a29c62e6f', bytes: 23_159_167 },
  'onnx/decoder_model_merged_quantized.onnx': { sha256: 'cf9a8d5bcddc0917a0078135b484cedcaf44f28909cd91910abd29dced9171db', bytes: 53_712_708 },
};

const args = process.argv.slice(2);
const refreshPins = args.includes('--refresh-pins');

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Verify bytes against the pin. Throws (nothing written by the caller) on any
 *  mismatch - the byte-length is reported alongside as the secondary signal. */
function verify(relPath: string, bytes: Uint8Array, source: string): void {
  const pin = PINS[relPath];
  if (!pin) throw new Error(`no integrity pin for ${relPath} — add it to PINS (or run --refresh-pins for an upgrade)`);
  const actual = sha256(bytes);
  if (actual !== pin.sha256) {
    const sizeNote = bytes.byteLength === pin.bytes
      ? `byte-length matches the pin (${pin.bytes})`
      : `byte-length ALSO differs: expected ${pin.bytes}, got ${bytes.byteLength}`;
    throw new Error(
      `SHA-256 mismatch for ${relPath} (${source}):\n` +
      `  pinned ${pin.sha256}\n  actual ${actual}\n  ${sizeNote}\n` +
      `If this is a deliberate model upgrade, re-run with --refresh-pins and update PINS.`,
    );
  }
}

async function fetchFile(relPath: string): Promise<void> {
  const outPath = join(OUT_DIR, relPath);

  // Already on disk and matching its pin → nothing to do (network-free re-run).
  if (!refreshPins && existsSync(outPath)) {
    const held = readFileSync(outPath);
    if (PINS[relPath] && sha256(held) === PINS[relPath].sha256) {
      process.stdout.write(`  ${relPath}: cached, hash verified (${held.byteLength} bytes)\n`);
      return;
    }
  }

  const url = BASE + relPath;
  process.stdout.write(`Fetching ${relPath} from ${url} ...\n`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download failed (${resp.status} ${resp.statusText}) for ${url}`);
  }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  if (refreshPins) {
    process.stdout.write(`  '${relPath}': { sha256: '${sha256(bytes)}', bytes: ${bytes.byteLength} },\n`);
  } else {
    verify(relPath, bytes, 'downloaded'); // BEFORE the write - a bad file never lands
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
  process.stdout.write(`  saved ${outPath} (${bytes.byteLength} bytes, ${mb} MB${refreshPins ? '' : ', hash verified'})\n`);
}

async function main(): Promise<void> {
  if (refreshPins) {
    process.stdout.write('--refresh-pins: downloading fresh copies and printing new pin lines — paste them over PINS.\n');
  }
  for (const f of MODEL_FILES) await fetchFile(f);
  process.stdout.write(
    '\nDone. These files are gitignored (shells/web/.gitignore) — never commit them.\n' +
    'Next: `npm run build:ort` to stage the pinned onnxruntime-web runtime at /ort-hf/<version>/,\n' +
    'then a tool calling host.speech.transcribe() will load the model from /models/whisper/.\n',
  );
}

main().catch((err) => {
  console.error(`\nfetch-whisper-models failed: ${(err as Error).message}`);
  console.error('If huggingface.co is unreachable or a path changed, check the file list at');
  console.error('https://huggingface.co/onnx-community/whisper-base_timestamped/tree/main');
  process.exit(1);
});
