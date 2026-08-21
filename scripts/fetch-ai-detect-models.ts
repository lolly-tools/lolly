#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the on-device AI-text detector models (plans/126 WP-A) into
 * shells/web/public/models/ai-detect/<id>/ - the same-origin location the
 * ai-detect worker (shells/web/src/lib/ai-detect-worker.ts) loads them from
 * via transformers.js (`env.localModelPath = '/models/'`, remote models
 * disabled). Roster + staging gate: shells/web/src/lib/ai-detect-models.ts.
 *
 * ANDY-RUN ONLY. Like the other fetch-*-models scripts, this needs network
 * access and is never invoked by npm install / postinstall / CI - the primary
 * model is ~150 MB, and the check UI loads it lazily only after an explicit
 * in-app consent click.
 *
 * Usage:
 *   node scripts/fetch-ai-detect-models.ts                 # every pinned file
 *   node scripts/fetch-ai-detect-models.ts --refresh-pins  # fetch candidates, print pin lines
 *   node scripts/fetch-ai-detect-models.ts --only <relPath[,relPath]>
 *
 * ── Models (plans/126 WP-A, RAID-leaderboard-sourced) ────────────────────────
 *   modernbert-raid-mage/     GeorgeDrayson/modernbert-ai-detection-raid-mage
 *                             (Apache-2.0) - the primary classifier.
 *   e5-small-ai-detector/     MayZhou/e5-small-lora-ai-generated-detector
 *                             (MIT) - the light tier; already ships ONNX.
 *
 * If a repo carries no onnx/ export, produce one at a PINNED revision with
 * optimum (`optimum-cli export onnx --model <repo> --task text-classification`,
 * then quantize to int8) and pin the artifacts you host - record the exact
 * command + revision in the pin's `note`. A conversion does not change the
 * licence, but the pin must name the true upstream.
 *
 * ── THE LICENCE + ARTIFACT GATES (work these before staging) ─────────────────
 * Model licensing ships to every user's device, so nothing is trusted on web
 * research. Before pasting real pins (and flipping AI_DETECT_STAGED in
 * ai-detect-models.ts, in the SAME change), a human MUST:
 *   1. Re-read the UPSTREAM LICENSE at a pinned revision and confirm it covers
 *      the WEIGHTS (fine-tunes inherit their base model's terms - ModernBERT
 *      base is Apache-2.0, e5-small is MIT; confirm the fine-tune's card
 *      matches). Record source + copyright verbatim in CREDITS.
 *   2. Confirm the ONNX artifact's provenance: an official export, or a
 *      conversion you produced yourself at a pinned revision (see above) - a
 *      community mirror must not have relicensed.
 *   3. Download and record the REAL byte size + sha256 of every file; update
 *      `bytes` in AI_DETECT_MODELS to the measured total.
 *   4. Load the graph in onnxruntime on the WASM/CPU path and confirm it RUNS:
 *      tokenizer applies, a forward pass returns [1, num_labels] logits.
 *   5. Verify the LABELS from config.json's id2label against the roster's
 *      `aiLabel` regex - a flipped label map silently inverts every verdict.
 *      Log which label the worker resolves as the AI side.
 *   6. CALIBRATE the operating threshold: run the model over the
 *      tests/text-signals-corpus.test.ts human samples (plus real human docs to
 *      hand) and pin `threshold` in the roster so the false-positive rate is
 *      ~1% - the plan's operating point. The shipped 0.98 is PROVISIONAL and
 *      must be replaced by the measured value in the same change.
 *
 * ── Integrity ────────────────────────────────────────────────────────────────
 * Every file is pinned to a SHA-256 and verified BEFORE it is written - a
 * mismatch exits non-zero with nothing written. A file already on disk whose
 * hash matches its pin is skipped without touching the network.
 *
 * ── ALSO REQUIRED ────────────────────────────────────────────────────────────
 * transformers.js's pinned onnxruntime-web runtime must be staged at
 * /ort-hf/ (`npm run build:ort`) - the reword/speech features share it.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_BASE = join(ROOT, 'shells/web/public/models/ai-detect');

const PLACEHOLDER = 'PLACEHOLDER';
/** A pin whose artifact was CONVERTED locally (no upstream URL exists): the
 *  script verifies the on-disk file against the pin instead of downloading.
 *  Regeneration = the conversion recipe in the pin's `note`. */
const CONVERTED = 'converted-locally';

interface Pin {
  url: string;
  sha256: string;
  bytes?: number;
  license: string;
  source: string;
  copyright: string;
  note?: string;
}

// Every pin is a PLACEHOLDER until a human works the header gate list. Paste a
// CANDIDATE url with sha256: PLACEHOLDER, run --refresh-pins to fetch + print
// the real line, work the gates, then paste the real pin over the placeholder
// in the SAME change that flips AI_DETECT_STAGED in ai-detect-models.ts.
const HF = 'https://huggingface.co';
const MB_BASE = `${HF}/GeorgeDrayson/modernbert-ai-detection-raid-mage/resolve/main/`;
const E5_BASE = `${HF}/MayZhou/e5-small-lora-ai-generated-detector/resolve/main/`;

const mbPin = (file: string, note?: string): Pin => ({
  url: `${MB_BASE}${file}`,
  sha256: PLACEHOLDER,
  license: 'Apache-2.0',
  source: 'GeorgeDrayson/modernbert-ai-detection-raid-mage (ModernBERT-base fine-tune, RAID+MAGE)',
  copyright: '© George Drayson',
  ...(note ? { note } : {}),
});
const e5Pin = (file: string, note?: string): Pin => ({
  url: `${E5_BASE}${file}`,
  sha256: PLACEHOLDER,
  license: 'MIT',
  source: 'MayZhou/e5-small-lora-ai-generated-detector',
  copyright: '© May Zhou',
  ...(note ? { note } : {}),
});

// Keys are OUT_BASE-relative: <roster dir>/<roster file>. Keep in step with
// AI_DETECT_MODELS[].files in shells/web/src/lib/ai-detect-models.ts.
const PINS: Record<string, Pin> = {
  'modernbert-raid-mage/config.json': mbPin('config.json', 'Gate 5: verify id2label names the AI side.'),
  'modernbert-raid-mage/tokenizer.json': mbPin('tokenizer.json'),
  'modernbert-raid-mage/tokenizer_config.json': mbPin('tokenizer_config.json'),
  'modernbert-raid-mage/special_tokens_map.json': mbPin('special_tokens_map.json'),
  'modernbert-raid-mage/onnx/model_quantized.onnx': mbPin(
    'onnx/model_quantized.onnx',
    'If the repo ships no onnx/, export + int8-quantize with optimum at a pinned revision (see header) and pin your hosted artifact.',
  ),
  // e5: STAGED 2026-08-21. The upstream repo ships safetensors only, so these
  // are LOCAL conversions at revision main/2024-11 of
  // MayZhou/e5-small-lora-ai-generated-detector (MIT):
  //   optimum-cli export onnx -m MayZhou/e5-small-lora-ai-generated-detector \
  //     --task text-classification <dir>
  //   quantize_dynamic(model.onnx, model_quantized.onnx, QInt8)   # ort 1.29
  // config.json additionally carries id2label {0: human, 1: machine-generated}
  // written from the model card (which is why its hash differs from upstream).
  // Gate evidence: graph runs (node + browser wasm), AI-shaped corpus fixtures
  // + real SmolLM2 generations score 0.78-0.93 on index 1, human fixtures
  // <= 0.4574 - the 0.75 roster threshold sits in that gap.
  'e5-small-ai-detector/config.json': {
    url: CONVERTED, sha256: 'a9f7b8cd66a10a5e34cdd676d208c2d0df021b666ba130b407894cddc76a0b07', bytes: 728,
    license: 'MIT', source: 'MayZhou/e5-small-lora-ai-generated-detector (+ id2label from the card)', copyright: '© May Zhou',
  },
  'e5-small-ai-detector/tokenizer.json': {
    url: CONVERTED, sha256: 'd241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66', bytes: 711396,
    license: 'MIT', source: 'MayZhou/e5-small-lora-ai-generated-detector', copyright: '© May Zhou',
  },
  'e5-small-ai-detector/tokenizer_config.json': {
    url: CONVERTED, sha256: 'f3d4f87daa8290a5145f49a61c0623f29730e6aecd4583200d1ddc8e2c3aebe7', bytes: 1301,
    license: 'MIT', source: 'MayZhou/e5-small-lora-ai-generated-detector', copyright: '© May Zhou',
  },
  'e5-small-ai-detector/special_tokens_map.json': {
    url: CONVERTED, sha256: '5d5b662e421ea9fac075174bb0688ee0d9431699900b90662acd44b2a350503a', bytes: 695,
    license: 'MIT', source: 'MayZhou/e5-small-lora-ai-generated-detector', copyright: '© May Zhou',
  },
  'e5-small-ai-detector/onnx/model_quantized.onnx': {
    url: CONVERTED, sha256: '6bdfbf199a48a3d57426f830353f7d58d4e86f79bd069405c7ca54dd1d83695d', bytes: 33934808,
    license: 'MIT', source: 'MayZhou/e5-small-lora-ai-generated-detector (optimum export + int8 dynamic quant)', copyright: '© May Zhou',
    note: 'Regenerate with the conversion recipe above; a fresh export will not be byte-identical - re-run the gate and refresh the pin deliberately.',
  },
};

const args = process.argv.slice(2);
const refreshPins = args.includes('--refresh-pins');
const onlyArg = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? args[i + 1] : undefined;
})();
const onlyFiles = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function verify(relPath: string, pin: Pin, bytes: Uint8Array, source: string): void {
  const actual = sha256(bytes);
  if (actual !== pin.sha256) {
    const sizeNote = pin.bytes != null && bytes.byteLength === pin.bytes
      ? `byte-length matches the pin (${pin.bytes})`
      : `byte-length ALSO differs: expected ${pin.bytes ?? 'unknown'}, got ${bytes.byteLength}`;
    throw new Error(
      `SHA-256 mismatch for ${relPath} (${source}):\n` +
      `  pinned ${pin.sha256}\n  actual ${actual}\n  ${sizeNote}\n` +
      'If this is a deliberate model upgrade, re-run with --refresh-pins and update PINS.',
    );
  }
}

/** A cheap shape sniff: json files must parse, onnx must look like protobuf. */
function sniff(relPath: string, bytes: Uint8Array): boolean {
  if (relPath.endsWith('.json')) {
    try { JSON.parse(new TextDecoder().decode(bytes)); return true; } catch { return false; }
  }
  if (bytes.length < 8) return false;
  const b0 = bytes[0]!, b1 = bytes[1]!;
  if (b0 === 0x50 && b1 === 0x4b) return false; // 'PK' zip
  if (b0 === 0x1f && b1 === 0x8b) return false; // gzip
  if (b0 === 0x3c) return false;                // '<' HTML error page
  return b0 === 0x08 || b0 === 0x0a;            // protobuf ModelProto head
}

async function fetchFile(relPath: string): Promise<'saved' | 'cached' | 'skipped'> {
  const pin = PINS[relPath];
  if (!pin) throw new Error(`No PINS entry for ${relPath}`);
  const outPath = join(OUT_BASE, relPath);

  if (!refreshPins && (pin.sha256 === PLACEHOLDER || pin.url === PLACEHOLDER)) {
    process.stdout.write(
      `  ${relPath}: SKIPPED - no verified pin yet (${pin.note ?? 'placeholder'}). ` +
      'Run --refresh-pins to fetch a candidate, then work the header gate list before pasting a real pin.\n',
    );
    return 'skipped';
  }

  // A locally-converted artifact has no upstream URL: verify what is on disk
  // against the pin, or point at the conversion recipe when it is absent.
  if (pin.url === CONVERTED) {
    if (!existsSync(outPath)) {
      process.stdout.write(`  ${relPath}: MISSING - a locally-converted artifact. Regenerate it with the conversion recipe in this script's PINS comment, then re-run.\n`);
      return 'skipped';
    }
    const onDisk = new Uint8Array(readFileSync(outPath));
    verify(relPath, pin, onDisk, 'on disk (converted)');
    process.stdout.write(`  ${relPath}: verified against pin (converted artifact, ${onDisk.byteLength.toLocaleString()} B)\n`);
    return 'cached';
  }

  if (!refreshPins && existsSync(outPath)) {
    const onDisk = new Uint8Array(readFileSync(outPath));
    if (sha256(onDisk) === pin.sha256) {
      process.stdout.write(`  ${relPath}: already staged (hash matches pin)\n`);
      return 'cached';
    }
  }

  process.stdout.write(`  ${relPath}: downloading ${pin.url}\n`);
  const res = await fetch(pin.url);
  if (!res.ok) throw new Error(`${pin.url}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!sniff(relPath, bytes)) throw new Error(`${relPath}: does not look like the expected file type - refused`);

  if (refreshPins) {
    process.stdout.write(
      `    candidate pin: sha256: '${sha256(bytes)}', bytes: ${bytes.byteLength},\n` +
      "    ⚠ Work the licence + calibration gates in this script's header before trusting this pin.\n",
    );
  } else {
    verify(relPath, pin, bytes, 'downloaded');
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  process.stdout.write(`    saved ${bytes.byteLength.toLocaleString()} B\n`);
  return 'saved';
}

process.stdout.write(
  'AI-text detector model staging (plans/126 WP-A)\n' +
  'Every file is a PLACEHOLDER until its licence + labels + threshold are verified - see this script\'s header gate list.\n',
);
let skipped = 0;
for (const relPath of Object.keys(PINS)) {
  if (onlyFiles && !onlyFiles.has(relPath)) continue;
  if ((await fetchFile(relPath)) === 'skipped') skipped++;
}
process.stdout.write(
  skipped > 0
    ? 'Paste candidate urls + run --refresh-pins, work the gate list, then flip AI_DETECT_STAGED in ai-detect-models.ts in the same change.\n'
    : 'All pinned files staged. Flip AI_DETECT_STAGED (and the measured threshold + bytes) in ai-detect-models.ts in the same change.\n',
);
