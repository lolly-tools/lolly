#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the sentence-embedding model the Ask help surface uses for semantic
 * retrieval (plans/103 M1) into shells/web/public/models/embed/ - the
 * same-origin location transformers.js loads it from at runtime under the model
 * id `embed` (`env.localModelPath = '/models/'`, remote models disabled), the
 * same convention scripts/fetch-kokoro-models.ts uses for the speech worker.
 *
 * Mirrors scripts/fetch-upscale-models.ts and scripts/fetch-kokoro-models.ts in
 * shape: a PINS table of per-file sha256 + byte-length, verified BEFORE a byte
 * is written, plus --refresh-pins for a deliberate model upgrade, plus a
 * CREDITS.txt carrying the upstream licence.
 *
 * ANDY-RUN ONLY. This needs network access and is never invoked by
 * `npm install`/`postinstall`/CI. The set is ~23 MB, the app fetches it once at
 * runtime behind a consent chip, and the COMMITTED vectors
 * (public/info/ask-vectors.bin) mean neither CI nor Vercel ever needs the model
 * to build or to serve Tier 0 answers.
 *
 * Usage:
 *   node scripts/fetch-embed-model.ts                 # every file, hash verified
 *   node scripts/fetch-embed-model.ts --only config.json,tokenizer.json
 *   node scripts/fetch-embed-model.ts --refresh-pins  # deliberate upgrade: download,
 *                                                     # stage out of the served tree,
 *                                                     # print new pin lines
 *
 * ── The file set ──────────────────────────────────────────────────────────
 * Exactly the four files transformers.js 3.8.1 reads for
 * `pipeline('feature-extraction', 'embed', { dtype: 'q8' })`:
 *
 *   config.json                 model config (BERT, 384 hidden, 6 layers)
 *   tokenizer.json              the WordPiece tokenizer
 *   tokenizer_config.json       tokenizer settings + special tokens
 *   onnx/model_quantized.onnx   the q8 weights
 *
 * The `_quantized` suffix is not a guess: transformers.js maps dtype `q8` to it
 * in src/utils/dtypes.js (DEFAULT_DTYPE_SUFFIX_MAPPING), and AutoTokenizer reads
 * only tokenizer.json + tokenizer_config.json (src/tokenizers.js, from_pretrained).
 * special_tokens_map.json exists upstream but nothing in this runtime opens it, so
 * it is deliberately NOT staged. Resolved and pinned on the first real run
 * (2026-08-19), which is plans/103 risk item 5 closed.
 *
 * ── Model ─────────────────────────────────────────────────────────────────
 * Xenova/all-MiniLM-L6-v2, the ONNX re-export of
 * sentence-transformers/all-MiniLM-L6-v2. 384 dimensions, symmetric (a query and
 * a passage are embedded the same way, with no instruction prefix), and the most
 * exercised embedder in transformers.js. Apache-2.0 both upstream and at the
 * mirror. Chosen over bge-small in plans/103 section 3: 11 MB smaller for a
 * consent ask that the user reads before agreeing to it.
 *
 * ── Integrity ─────────────────────────────────────────────────────────────
 * Every file is SHA-256 + byte-length verified BEFORE it is written, so a
 * tampered or silently re-exported release can never land. A file already on
 * disk whose hash matches its pin is skipped without touching the network. On
 * --refresh-pins the candidate is staged under .candidates/ instead of the live
 * path and the computed pin line is printed for a human to paste, so an
 * unverified byte is never served or cached by the app.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/embed');

/** The HuggingFace repo the ONNX export lives in. scripts/build-ask-vectors.ts
 *  carries the same string as its own const (it writes it into ask-vectors.json's
 *  `upstream` field) rather than importing it from here, because this module runs
 *  main() on import. Keep the two in step on a model change. */
const EMBED_UPSTREAM = 'Xenova/all-MiniLM-L6-v2';
const BASE = `https://huggingface.co/${EMBED_UPSTREAM}/resolve/main/`;

const LICENSE = 'Apache-2.0';
const SOURCE =
  'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 (upstream PyTorch/sentence-transformers); ' +
  `ONNX export re-hosted at https://huggingface.co/${EMBED_UPSTREAM}`;
const COPYRIGHT = 'Copyright (c) 2019 Nils Reimers, Iryna Gurevych and contributors (UKPLab/sentence-transformers)';

interface Pin {
  /** SHA-256 of the verified bytes. */
  sha256: string;
  /** Byte length of the verified download. */
  bytes: number;
  /** What the runtime reads this file for. Surfaced in CREDITS.txt. */
  role: string;
}

// Repo-relative paths under localModelPath/embed/. Verified 2026-08-19 against
// the live Xenova/all-MiniLM-L6-v2 main branch; refresh with --refresh-pins on a
// deliberate upgrade and re-check the mirror's licence before trusting the new pin.
const PINS: Record<string, Pin> = {
  'config.json': {
    sha256: '7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7',
    bytes: 650,
    role: 'BERT model config (384 hidden, 6 layers, 512 max positions)',
  },
  'tokenizer.json': {
    sha256: 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0',
    bytes: 711_661,
    role: 'WordPiece tokenizer (30522 vocab)',
  },
  'tokenizer_config.json': {
    sha256: '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3',
    bytes: 366,
    role: 'tokenizer settings and special tokens',
  },
  'onnx/model_quantized.onnx': {
    sha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
    bytes: 22_972_370,
    role: 'q8 quantised weights (the dtype q8 resolves to)',
  },
};

/** Total staged bytes (22,684,047 as pinned), which is the number the consent
 *  copy and the offline part size quote. */
const EMBED_MODEL_BYTES = Object.values(PINS).reduce((n, p) => n + p.bytes, 0);

const args = process.argv.slice(2);
const refreshPins = args.includes('--refresh-pins');
const onlyArg = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? args[i + 1] : undefined;
})();
const onlyFiles = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Verify bytes against the pin. Throws (nothing written by the caller) on any
 *  mismatch, reporting the byte-length as the secondary signal. */
function verify(relPath: string, pin: Pin, bytes: Uint8Array): void {
  const actual = sha256(bytes);
  if (actual !== pin.sha256) {
    const sizeNote = bytes.byteLength === pin.bytes
      ? `byte-length matches the pin (${pin.bytes})`
      : `byte-length ALSO differs: expected ${pin.bytes}, got ${bytes.byteLength}`;
    throw new Error(
      `SHA-256 mismatch for ${relPath}:\n` +
      `  pinned ${pin.sha256}\n  actual ${actual}\n  ${sizeNote}\n` +
      'If this is a deliberate model upgrade, re-run with --refresh-pins and update PINS.',
    );
  }
}

async function fetchFile(relPath: string): Promise<'saved' | 'cached'> {
  const pin = PINS[relPath];
  if (!pin) throw new Error(`No PINS entry for ${relPath}`);
  const outPath = join(OUT_DIR, relPath);

  // Already on disk and matching its pin, so a re-run costs no network.
  if (!refreshPins && existsSync(outPath)) {
    const held = readFileSync(outPath);
    if (sha256(held) === pin.sha256) {
      process.stdout.write(`  ${relPath}: cached, hash verified (${held.byteLength} bytes)\n`);
      return 'cached';
    }
  }

  const url = BASE + relPath;
  process.stdout.write(`Fetching ${relPath} from ${url} ...\n`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed (${resp.status} ${resp.statusText}) for ${url}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const mb = (bytes.byteLength / (1024 * 1024)).toFixed(2);

  if (refreshPins) {
    // Never write an unverified candidate into the served tree: the app caches
    // /models/ bytes and would happily keep a poisoned model that then fails
    // confusingly inside InferenceSession.create. Stage it out of the way, print
    // the computed pin, let a human paste it and re-run a normal verified fetch.
    const stagePath = join(OUT_DIR, '.candidates', relPath);
    mkdirSync(dirname(stagePath), { recursive: true });
    writeFileSync(stagePath, bytes);
    process.stdout.write(
      `  '${relPath}': { sha256: '${sha256(bytes)}', bytes: ${bytes.byteLength}, role: '${pin.role}' },\n` +
      `  staged candidate to ${stagePath} (${bytes.byteLength} bytes, ${mb} MB), NOT written to the live ${relPath}\n` +
      "  Re-check the mirror's licence against the upstream repo before trusting this pin.\n",
    );
    return 'saved';
  }

  verify(relPath, pin, bytes); // before the write, so a bad file never lands
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  process.stdout.write(`  saved ${outPath} (${bytes.byteLength} bytes, ${mb} MB, hash verified)\n`);
  return 'saved';
}

function writeCredits(vendored: string[]): void {
  const lines: string[] = [
    'Lolly - vendored sentence-embedding model (Ask, plans/103 M1)',
    '=============================================================',
    '',
    "These model files are not source code and are not covered by this repo's own",
    'MPL-2.0 licensing. They carry their own upstream licence, recorded below.',
    'See scripts/fetch-embed-model.ts for the pinned hashes and the file-set',
    'reasoning; the licence below is the UPSTREAM project\'s, verified against its',
    'own repo, not only the licence attached to the ONNX mirror.',
    '',
    `Model:      ${EMBED_UPSTREAM} (384-dim sentence embeddings, q8)`,
    `License:    ${LICENSE}`,
    `Source:     ${SOURCE}`,
    `Copyright:  ${COPYRIGHT}`,
    `Mirror URL: ${BASE}`,
    '',
    'Files:',
    '',
  ];
  for (const relPath of vendored) {
    const pin = PINS[relPath];
    if (!pin) continue;
    lines.push(
      `${relPath}`,
      `  Role:    ${pin.role}`,
      `  Bytes:   ${pin.bytes}`,
      `  SHA-256: ${pin.sha256}`,
      '',
    );
  }
  writeFileSync(join(OUT_DIR, 'CREDITS.txt'), lines.join('\n'));
  process.stdout.write(`\nWrote ${join(OUT_DIR, 'CREDITS.txt')}\n`);
}

async function main(): Promise<void> {
  const wanted = Object.keys(PINS).filter((relPath) => !onlyFiles || onlyFiles.has(relPath));

  if (refreshPins) {
    process.stdout.write('--refresh-pins: downloading fresh copies and printing new pin lines, paste them over PINS.\n');
  }

  const vendored: string[] = [];
  for (const relPath of wanted) {
    const result = await fetchFile(relPath);
    if (result === 'saved' || result === 'cached') vendored.push(relPath);
  }

  if (vendored.length > 0 && !refreshPins) writeCredits(vendored);

  const mb = (EMBED_MODEL_BYTES / (1024 * 1024)).toFixed(1);
  process.stdout.write(
    `\nDone. ${vendored.length}/${Object.keys(PINS).length} files staged in ${OUT_DIR} (${mb} MB total).\n` +
    'These files are gitignored (shells/web/.gitignore public/models/), never commit them.\n' +
    (refreshPins
      ? 'Paste the printed pin lines over PINS after re-checking the upstream licence, then re-run without the flag.\n'
      : 'Next: node scripts/build-ask-vectors.ts to embed the docs corpus into public/info/ask-vectors.bin.\n'),
  );
}

main().catch((err) => {
  console.error(`\nfetch-embed-model failed: ${(err as Error).message}`);
  console.error('If the mirror moved or a filename changed, run with --refresh-pins to stage a candidate');
  console.error('and print a fresh pin line, then hand-verify it before pasting it into PINS.');
  process.exit(1);
});
