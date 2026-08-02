#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the Kokoro-82M speech-synthesis ONNX model (timestamped export) and
 * the full English set of voice style vectors into shells/web/public/models/kokoro/ —
 * the same-origin location the speech worker
 * (shells/web/src/lib/speech-kokoro-worker.ts) loads them from at runtime via
 * transformers.js (`env.localModelPath = '/models/'`, remote models disabled).
 *
 * ANDY-RUN ONLY. Like scripts/fetch-trustmark-models.ts, this needs network
 * access and is never invoked by `npm install`/`postinstall`/CI — the model is
 * ~92 MB, not something every clone/deploy should pay for, and host.speech
 * loads it lazily, once, only when a tool actually asks to speak.
 *
 * Usage:
 *   node scripts/fetch-kokoro-models.ts                 # model + config + tokenizer + 28 voices
 *   node scripts/fetch-kokoro-models.ts --voices-only   # just the voice .bin files
 *   node scripts/fetch-kokoro-models.ts --refresh-pins  # deliberate model upgrade: skip
 *                                                       # verification, print new pin lines
 *
 * ── Source ────────────────────────────────────────────────────────────────
 * https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped
 * (Apache-2.0). The TIMESTAMPED export is the point: alongside `waveform` it
 * returns a per-token `durations` output, which is what lets host.speech report
 * word timings for captions — the plain onnx-community/Kokoro-82M-v1.0-ONNX
 * export produces identical audio but discards the alignment. q8 quantised
 * (model_quantized.onnx) — the dtype kokoro-js itself defaults to on wasm.
 *
 * Voices are 510x256 float32 style matrices (522,240 bytes each), one row per
 * input-token count. All 28 English voices from the model's own VOICES table
 * (kokoro.js/src/voices.js) are staged — 20 en-US (af_ and am_ prefixes) and
 * 8 en-GB (bf_ and bm_). The list is mirrored in shells/web/src/lib/speech-kokoro.ts
 * (KOKORO_VOICES, ordered for display) — keep the two in sync.
 *
 * Integrity: every file is pinned to a SHA-256 hash (computed from the
 * downloaded-and-verified 2026-08-02 set) and verified BEFORE it is written —
 * a mismatch exits non-zero with nothing written, so a tampered or re-exported
 * release can never land silently. A file already on disk whose hash matches
 * its pin is skipped without touching the network. For a deliberate model
 * upgrade, run with --refresh-pins and paste the printed lines over PINS.
 *
 * ── ALSO REQUIRED: transformers.js's pinned onnxruntime-web runtime ───────
 * The model runs on the onnxruntime-web build @huggingface/transformers pins
 * (NOT the 1.27 already at /ort/ — the two are not interchangeable). After
 * `npm install`, `npm run build:ort` (or `node scripts/copy-transformers-ort.ts`)
 * stages it at shells/web/public/ort-hf/<version>/.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/kokoro');

const BASE = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped/resolve/main/';

// Repo-relative paths transformers.js expects under localModelPath/kokoro/.
const MODEL_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx'];

// Keep in sync with KOKORO_VOICES in shells/web/src/lib/speech-kokoro.ts —
// the full English set: 20 en-US (af_*/am_*) + 8 en-GB (bf_*/bm_*).
const VOICES = [
  'af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jessica', 'af_kore',
  'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
  'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael',
  'am_onyx', 'am_puck', 'am_santa',
  'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily',
  'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis',
];

// Per-file SHA-256 + byte-length pins (2026-08-02, from the verified-working
// set). Verified BEFORE writing; refresh with --refresh-pins on a deliberate
// upgrade. Every voice matrix is the same fixed 510x256 float32 = 522,240 bytes.
const PINS: Record<string, { sha256: string; bytes: number }> = {
  'config.json': { sha256: 'df34b4f930b23447cd4dc410fabfb42eb3f24e803e6c3f97d618fb359380a36f', bytes: 44 },
  'tokenizer.json': { sha256: '77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34', bytes: 3_497 },
  'tokenizer_config.json': { sha256: 'be1cb066d6ef6b074b3f15e6a6dd21ac88ff3cdaedf325f0aaed686c70f75d20', bytes: 113 },
  'onnx/model_quantized.onnx': { sha256: 'c0c02b3299fd97c34ea92a98e6d41eaa1a739c8f77bf685aac34bd7b34c1132c', bytes: 92_361_055 },
  'voices/af_alloy.bin': { sha256: 'c4a6b876047fd7fb472edf4ebd63cfac7c3b958a7cae7c106e8f038ca6308c45', bytes: 522_240 },
  'voices/af_aoede.bin': { sha256: '4a004c33430762e2461eedb2013fad808ef4ab3121f5300f554476caf58d8361', bytes: 522_240 },
  'voices/af_bella.bin': { sha256: 'f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b', bytes: 522_240 },
  'voices/af_heart.bin': { sha256: 'd583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b', bytes: 522_240 },
  'voices/af_jessica.bin': { sha256: 'a240a5e3c15b43563d6e923bdca8ef5613a23471d9b77653694012435df23bd8', bytes: 522_240 },
  'voices/af_kore.bin': { sha256: '9be5221b6a941c04b561959b8ff0b06e809444dcc4ab7e75a7b23606f691819e', bytes: 522_240 },
  'voices/af_nicole.bin': { sha256: 'cd2191ab31b914ed7b318416b0e4440fdf392ddad9106a060819aa600a64f59a', bytes: 522_240 },
  'voices/af_nova.bin': { sha256: '18778272caa0d0eebaea251c35fd635f038434f9eee5e691d02a174bd328414f', bytes: 522_240 },
  'voices/af_river.bin': { sha256: '00a2bcf82b1d86e8f19902ede58c65ccf6c0e43b44b7d74fad54e5d8933c9c30', bytes: 522_240 },
  'voices/af_sarah.bin': { sha256: '4409fbc125afabacc615d94db5398d847006a737b0247d6892b7a9a0007a2f0a', bytes: 522_240 },
  'voices/af_sky.bin': { sha256: '4435255c9744f3f31659e0d714ab7689bf65d9e77ec1cce060f083912614f0b9', bytes: 522_240 },
  'voices/am_adam.bin': { sha256: '162b035ed91cfc48b6046982184c645f72edcdd1b82843347f605d7bf7b15716', bytes: 522_240 },
  'voices/am_echo.bin': { sha256: '3968b92c3c4cd1c4416dbded36c13eaa388a90d5788d02a13e4d781f5f8cf3c3', bytes: 522_240 },
  'voices/am_eric.bin': { sha256: 'e8b5be17edd1e3636901ce7598baafe2dc8dd8ff707a0c23bf9e461add7e2832', bytes: 522_240 },
  'voices/am_fenrir.bin': { sha256: 'c27989f741f7ee34d273a39d8a595cc0837d35f5ced9a29b7cc162614616df43', bytes: 522_240 },
  'voices/am_liam.bin': { sha256: '52403be32fd047c6a44517cb0bcd6b134f2a18baa73e70ef41651e0eab921ade', bytes: 522_240 },
  'voices/am_michael.bin': { sha256: '1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1', bytes: 522_240 },
  'voices/am_onyx.bin': { sha256: 'da5d135b424164916d75a68ffb4c2abce3d7d5ccc82dd1ee6cf447ce286145e6', bytes: 522_240 },
  'voices/am_puck.bin': { sha256: 'fcf73c989033e9233e0b98713eca600c8c74dcc1614b37009d5450ff4a2274a0', bytes: 522_240 },
  'voices/am_santa.bin': { sha256: '61150cf726ab6c5ed7a99f90a304f91f5a72c00c592e89ec94e5df11c319227a', bytes: 522_240 },
  'voices/bf_alice.bin': { sha256: '08afa6ba24da61ea5e8efa139e5aadc938d83f0a6da5a900adaf763ac1da5573', bytes: 522_240 },
  'voices/bf_emma.bin': { sha256: '669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73', bytes: 522_240 },
  'voices/bf_isabella.bin': { sha256: '3754352c4aaa46d17f27654ab7518d65b62ad6163a0f55a5f4330c2da2c4e94f', bytes: 522_240 },
  'voices/bf_lily.bin': { sha256: '5e0ee32ebe64a467124976b14e69590746f1c4ce41a12b587a50c862edfea335', bytes: 522_240 },
  'voices/bm_daniel.bin': { sha256: '6b3194bbceffb746733cbc22c8f593dd44e401a71d53895a2dca891bc595a1e8', bytes: 522_240 },
  'voices/bm_fable.bin': { sha256: 'f889083196807b4adb15e9204252165f503b8d33d3982e681c52443c49d798f1', bytes: 522_240 },
  'voices/bm_george.bin': { sha256: 'c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc', bytes: 522_240 },
  'voices/bm_lewis.bin': { sha256: 'b8f671cef828c30e66fdf0b0756a76bba58f6bb3398cbbf27058642acbcedb97', bytes: 522_240 },
};

const args = process.argv.slice(2);
const voicesOnly = args.includes('--voices-only');
const refreshPins = args.includes('--refresh-pins');

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Verify bytes against the pin. Throws (nothing written by the caller) on any
 *  mismatch — the byte-length is reported alongside as the secondary signal. */
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
    verify(relPath, bytes, 'downloaded'); // BEFORE the write — a bad file never lands
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
  process.stdout.write(`  saved ${outPath} (${bytes.byteLength} bytes, ${mb} MB${refreshPins ? '' : ', hash verified'})\n`);
}

async function main(): Promise<void> {
  const files = [
    ...(voicesOnly ? [] : MODEL_FILES),
    ...VOICES.map((v) => `voices/${v}.bin`),
  ];
  if (refreshPins) {
    process.stdout.write('--refresh-pins: downloading fresh copies and printing new pin lines — paste them over PINS.\n');
  }
  for (const f of files) await fetchFile(f);
  process.stdout.write(
    '\nDone. These files are gitignored (shells/web/.gitignore) — never commit them.\n' +
    'Next: `npm run build:ort` to stage the pinned onnxruntime-web runtime at /ort-hf/<version>/,\n' +
    'then a tool calling host.speech.synthesize() will load the model from /models/kokoro/.\n',
  );
}

main().catch((err) => {
  console.error(`\nfetch-kokoro-models failed: ${(err as Error).message}`);
  console.error('If huggingface.co is unreachable or a path changed, check the file list at');
  console.error('https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped/tree/main');
  process.exit(1);
});
