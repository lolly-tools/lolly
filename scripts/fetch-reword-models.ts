#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the SmolLM2-360M-Instruct q4 ONNX model set into
 * shells/web/public/models/reword/smollm2-360m-instruct/ - the same-origin
 * location the reword worker (shells/web/src/lib/reword-worker.ts) loads it
 * from at runtime via transformers.js (`env.localModelPath = '/models/'`,
 * remote models disabled). See plans/127-reword-on-device.md.
 *
 * ANDY-RUN ONLY. Like the other fetch-*-models scripts, this needs network
 * access and is never invoked by `npm install`/`postinstall`/CI - the model is
 * ~370 MB, not something every clone/deploy should pay for, and the reword UI
 * loads it lazily, once, only after an explicit in-app consent.
 *
 * Usage:
 *   node scripts/fetch-reword-models.ts                 # the full model set
 *   node scripts/fetch-reword-models.ts --refresh-pins  # deliberate model upgrade:
 *                                                       # skip verification, print new pin lines
 *
 * ── Source ────────────────────────────────────────────────────────────────
 * https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct (Apache-2.0) -
 * the official SmolLM release, whose onnx/ folder carries the transformers.js
 * exports. `model_q4.onnx` is the one dtype that runs on BOTH wasm and WebGPU
 * (the ~260 MB q4f16 export is WebGPU-only - the named future optimisation).
 *
 * The file list is the PINNED CONTRACT in shells/web/src/lib/reword-models.ts
 * (REWORD_MODEL_FILES / REWORD_MODEL_BYTES) - change one, change both.
 *
 * Integrity: every file is pinned to a SHA-256 hash and verified BEFORE it is
 * written - a mismatch exits non-zero with nothing written. A file already on
 * disk whose hash matches its pin is skipped without touching the network.
 *
 * ── ALSO REQUIRED: transformers.js's pinned onnxruntime-web runtime ───────
 * The model runs on the onnxruntime-web build @huggingface/transformers pins
 * (NOT the 1.27 already at /ort/). After `npm install`, `npm run build:ort`
 * (or `node scripts/copy-transformers-ort.ts`) stages it at
 * shells/web/public/ort-hf/<version>/. The speech features share it.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/reword/smollm2-360m-instruct');

const BASE = 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/resolve/main/';

// Keep in sync with REWORD_MODEL_FILES in shells/web/src/lib/reword-models.ts.
const MODEL_FILES = [
  'config.json',
  'generation_config.json',
  'special_tokens_map.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_q4.onnx',
];

// Per-file SHA-256 + byte-length pins (2026-08-19, from the first verified
// staging run). Verified BEFORE writing; refresh with --refresh-pins on a
// deliberate upgrade.
const PINS: Record<string, { sha256: string; bytes: number }> = {
  'config.json': { sha256: '224f72354f10d617a359cc82ad15a3c96e866b9b2ffadb81997eeea9e88e22ee', bytes: 846 },
  'generation_config.json': { sha256: '87b916edaaab66b3899b9d0dd0752727dff6666686da0504d89ae0a6e055a013', bytes: 132 },
  'special_tokens_map.json': { sha256: '2b7379f3ae813529281a5c602bc5a11c1d4e0a99107aaa597fe936c1e813ca52', bytes: 655 },
  'tokenizer.json': { sha256: '9ca9acddb6525a194ec8ac7a87f24fbba7232a9a15ffa1af0c1224fcd888e47c', bytes: 2_104_556 },
  'tokenizer_config.json': { sha256: '4ec77d44f62efeb38d7e044a1db318f6a939438425312dfa333b8382dbad98df', bytes: 3_764 },
  'onnx/model_q4.onnx': { sha256: 'a4ffda96e65beafc6f6cef0cbcf9fdc1cbdd79c230906bf3897d190547c7a596', bytes: 387_943_246 },
};

const refreshPins = process.argv.slice(2).includes('--refresh-pins');

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Verify bytes against the pin. Throws (nothing written by the caller) on any
 *  mismatch - the byte-length is reported alongside as the secondary signal. */
function verify(relPath: string, bytes: Uint8Array, source: string): void {
  const pin = PINS[relPath];
  if (!pin || !pin.sha256) {
    throw new Error(`no integrity pin for ${relPath} — run --refresh-pins once and paste the printed lines over PINS`);
  }
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
    if (PINS[relPath]?.sha256 && sha256(held) === PINS[relPath].sha256) {
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
    process.stdout.write(`  '${relPath}': { sha256: '${sha256(bytes)}', bytes: ${bytes.byteLength.toLocaleString('en-US').replace(/,/g, '_')} },\n`);
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
    'Next: `npm run build:ort` if /ort-hf/ is not staged yet, then flip REWORD_STAGED in\n' +
    'shells/web/src/lib/reword-models.ts once the end-to-end check has run (plans/127 WP4).\n',
  );
}

main().catch((err) => {
  console.error(`\nfetch-reword-models failed: ${(err as Error).message}`);
  console.error('If huggingface.co is unreachable or a path changed, check the file list at');
  console.error('https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/tree/main');
  process.exit(1);
});
