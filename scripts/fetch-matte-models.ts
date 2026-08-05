#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the ONNX background-removal (matting) models into
 * shells/web/public/models/matte/ — the same-origin location the matte worker
 * loads them from at runtime by exact filename. Twin of
 * scripts/fetch-upscale-models.ts; same PINS-table + sha256/byte-length verify +
 * --refresh-pins shape.
 *
 * ANDY-RUN ONLY. Network access, tens-to-hundreds of MB per file; never invoked
 * by npm install / postinstall / CI.
 *
 * Usage:
 *   node scripts/fetch-matte-models.ts                 # every file with a real pin
 *   node scripts/fetch-matte-models.ts --only u2netp.onnx
 *   node scripts/fetch-matte-models.ts --refresh-pins  # download candidates, print pin lines, verify nothing
 *
 * ── Files (the staged roster — real verified pins below) ────────────────────
 *   u2netp.onnx        U²-Net lite,   Apache-2.0, xuebinqin/U-2-Net    (FAST preview)
 *   birefnet-lite.onnx BiRefNet lite, MIT,        ZhengPeng7/BiRefNet  (DEFAULT — dark/detail)
 *   modnet.onnx        MODNet,        Apache-2.0, ZHKKKe/MODNet        (PORTRAITS)
 * (IS-Net was staged then retired 2026-08-05 — strictly dominated by BiRefNet-lite.)
 *
 * ── THE LICENCE + ARTIFACT GATES (work these before staging a NEW model) ─────
 * Model licensing ships to every user's device, so nothing is trusted on web
 * research. Before flipping a model's pin (and its MATTE_STAGED flag in
 * shells/web/src/lib/matte-models.ts, in the SAME change), a human MUST:
 *   1. Re-read the UPSTREAM LICENSE at a pinned commit and confirm it covers the
 *      WEIGHTS, not just the code — U-2-Net (Apache-2.0), BiRefNet (MIT), MODNet
 *      (Apache-2.0, covers code + models).
 *   2. Confirm the ONNX file's own provenance: u2netp from a COMMUNITY conversion
 *      (rembg), birefnet-lite/modnet from onnx-community / Xenova — verify each
 *      mirror's repo card licence matches the upstream, exactly as the upscale
 *      script's HuggingFace caveat warns.
 *   3. Download and record the REAL byte size + sha256.
 *   4. Load the ONNX in onnxruntime on the WASM/CPU path (matte is WASM-ONLY — the
 *      roster's MaxPool ceil_mode isn't supported by ort-web's WebGPU kernels) at
 *      its input size, and confirm it RUNS.
 *   5. Confirm from the ACTUAL ONNX graph: input tensor name/shape/dtype, and the
 *      preprocessing mean/std — MODNet's [-1,1] (0.5 / 0.5) differs from the
 *      ImageNet default u2netp/BiRefNet use.
 *   6. Confirm the output activation empirically (min-max for the bounded heads
 *      u2netp/modnet, sigmoid for birefnet-lite's logit head) by inspecting a real
 *      mask — a wrong choice degrades quality with no crash.
 * Reconcile the real sizes into MATTE_MODELS.approxBytes once known.
 *
 * ── WHY NOT THE POPULAR ONE (RMBG) ──────────────────────────────────────────
 * BRIA's RMBG-1.4 (proprietary non-commercial licence) and RMBG-2.0
 * (CC BY-NC 4.0) are the popular, high-quality removers — and both forbid
 * commercial use without a separate BRIA agreement. Lolly ships its model to
 * every device, so a non-commercial licence is disqualifying. We use the
 * MIT/Apache saliency nets instead. Do not add RMBG here.
 *
 * ── Integrity ────────────────────────────────────────────────────────────────
 * Every real pin is SHA-256 + byte-length verified BEFORE it is written; a
 * mismatch exits non-zero with nothing written. An on-disk file matching its pin
 * is skipped network-free. A PLACEHOLDER pin is SKIPPED on a normal run with a
 * loud warning — nothing unverified is served or cached. --refresh-pins stages a
 * candidate OUT of the served tree (.candidates/) and prints a pin line to
 * hand-verify.
 *
 * On success (real pins only) writes shells/web/public/models/matte/CREDITS.txt.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/matte');

const PLACEHOLDER = 'PLACEHOLDER';

interface Pin {
  url: string;
  sha256: string;
  bytes: number | null;
  license: string;
  source: string;
  copyright: string;
  note?: string;
}

// All three are PLACEHOLDER: the pins below are the research-sourced CANDIDATE
// URLs, not verified. Run --refresh-pins to fetch each, then work the gate list
// in the header before pasting a real pin over the placeholder.
const PINS: Record<string, Pin> = {
  'u2netp.onnx': {
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
    sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    bytes: 4574861,
    license: 'Apache-2.0',
    source: 'https://github.com/xuebinqin/U-2-Net (upstream weights, Apache-2.0); ONNX re-hosted by rembg (danielgatis/rembg)',
    copyright: 'Copyright (c) 2020, Xuebin Qin et al. (U-2-Net)',
    note: 'FAST tier. Community ONNX — verify the rembg conversion derives from the Apache-2.0 weights before pinning.',
  },
  'modnet.onnx': {
    url: 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx',
    sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9',
    bytes: 25888640,
    license: 'Apache-2.0',
    source: 'https://github.com/ZHKKKe/MODNet (upstream, Apache-2.0 covers code + models); ONNX by Xenova/modnet',
    copyright: 'Copyright (c) 2020, Zhanghan Ke et al. (MODNet)',
    note: 'PORTRAIT specialist, ~25 MB. Dynamic H×W (run at 512²). Normalization [-1,1] (mean 0.5 / std 0.5); bounded alpha head → minmax.',
  },
  'birefnet-lite.onnx': {
    url: 'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model_fp16.onnx',
    sha256: 'd39b897ceb16ae654c1731f3dba0cf9b368d9cae74b5a57459b455cc8bfec402',
    bytes: 114538221,
    license: 'MIT',
    source: 'https://github.com/ZhengPeng7/BiRefNet (upstream, MIT); ONNX by onnx-community/BiRefNet_lite-ONNX',
    copyright: 'Copyright (c) 2024, Peng Zheng et al. (BiRefNet)',
    note: 'PRO tier, ~115 MB fp16. Validate against onnxruntime #21968 (BiRefNet WebGPU op failure) on BOTH WebGPU and WASM. Output head is a LOGIT → sigmoid.',
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
      `If this is a deliberate model upgrade, re-run with --refresh-pins and update PINS.`,
    );
  }
}

/** A cheap "is this a single-file ONNX?" sniff for the refresh path. */
function sniffOnnx(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  const b0 = bytes[0], b1 = bytes[1];
  if (b0 === 0x50 && b1 === 0x4b) return false; // 'PK' — zip / .pth
  if (b0 === 0x1f && b1 === 0x8b) return false; // gzip
  if (b0 === 0x3c) return false;                // '<' — HTML error page
  return b0 === 0x08 || b0 === 0x0a;            // protobuf ModelProto head
}

async function fetchFile(relPath: string): Promise<'saved' | 'cached' | 'skipped'> {
  const pin = PINS[relPath];
  if (!pin) throw new Error(`No PINS entry for ${relPath}`);
  const outPath = join(OUT_DIR, relPath);

  if (!refreshPins && pin.sha256 === PLACEHOLDER) {
    process.stdout.write(
      `  ${relPath}: SKIPPED — no verified pin yet (${pin.note ?? 'placeholder'}). ` +
      `Run --refresh-pins to fetch a candidate, then work the header gate list before pasting a real pin.\n`,
    );
    return 'skipped';
  }

  if (!refreshPins && existsSync(outPath)) {
    const held = readFileSync(outPath);
    if (sha256(held) === pin.sha256) {
      process.stdout.write(`  ${relPath}: cached, hash verified (${held.byteLength} bytes)\n`);
      return 'cached';
    }
  }

  process.stdout.write(`Fetching ${relPath} from ${pin.url} ...\n`);
  const resp = await fetch(pin.url);
  if (!resp.ok) throw new Error(`Download failed (${resp.status} ${resp.statusText}) for ${pin.url}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);

  if (refreshPins) {
    const stagePath = join(OUT_DIR, '.candidates', relPath);
    mkdirSync(dirname(stagePath), { recursive: true });
    writeFileSync(stagePath, bytes);
    const looksOnnx = sniffOnnx(bytes);
    process.stdout.write(
      `  '${relPath}': { url: '${pin.url}', sha256: '${sha256(bytes)}', bytes: ${bytes.byteLength}, ` +
      `license: '${pin.license}', source: '${pin.source}', copyright: '${pin.copyright}' },\n` +
      `  staged candidate → ${stagePath} (${bytes.byteLength} bytes, ${mb} MB) — NOT written to the live ${relPath}\n` +
      (looksOnnx ? '' : `  ⚠ these bytes do NOT look like a single-file ONNX (magic suggests .pth/.zip/HTML) — convert/inspect before pinning\n`) +
      `  ⚠ Work the licence + runtime gates in this script's header before trusting this pin.\n`,
    );
    return 'saved';
  }

  verify(relPath, pin, bytes, 'downloaded');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  process.stdout.write(`  saved ${outPath} (${bytes.byteLength} bytes, ${mb} MB, hash verified)\n`);
  return 'saved';
}

function writeCredits(vendored: string[]): void {
  const lines: string[] = [
    'Lolly — vendored background-removal (matting) ONNX models',
    '=========================================================',
    '',
    'These model files are not source code and are not covered by this repo\'s',
    'own MPL-2.0 licensing — each carries the license of its own upstream',
    'project, recorded below (verified against the upstream repo, not merely the',
    'mirror the file was fetched from).',
    '',
  ];
  for (const relPath of vendored) {
    const pin = PINS[relPath];
    if (!pin) continue;
    lines.push(
      `${relPath}`,
      `  License:    ${pin.license}`,
      `  Source:     ${pin.source}`,
      `  Copyright:  ${pin.copyright}`,
      `  Mirror URL: ${pin.url}`,
      ...(pin.note ? [`  Note:       ${pin.note}`] : []),
      '',
    );
  }
  writeFileSync(join(OUT_DIR, 'CREDITS.txt'), lines.join('\n'));
  process.stdout.write(`\nWrote ${join(OUT_DIR, 'CREDITS.txt')}\n`);
}

async function main(): Promise<void> {
  const wanted = Object.keys(PINS).filter((relPath) => !onlyFiles || onlyFiles.has(relPath));
  if (refreshPins) {
    process.stdout.write('--refresh-pins: downloading fresh copies and printing new pin lines — paste them over PINS after working the gate list.\n');
  }

  const vendored: string[] = [];
  const skipped: string[] = [];
  for (const relPath of wanted) {
    try {
      const result = await fetchFile(relPath);
      if (result === 'saved' || result === 'cached') vendored.push(relPath);
      else skipped.push(relPath);
    } catch (err) {
      throw new Error(`${relPath}: ${(err as Error).message}`);
    }
  }

  if (vendored.length > 0 && !refreshPins) writeCredits(vendored);

  if (skipped.length > 0) {
    process.stdout.write(
      `\n${skipped.length} file(s) not vendored: ${skipped.join(', ')}.\n` +
      'Every matte model is a PLACEHOLDER until its licence + ONNX are verified — see this script\'s header gate list.\n',
    );
  }

  process.stdout.write(
    '\nDone. These files are gitignored — never commit them.\n' +
    (refreshPins
      ? 'Paste the printed pin lines over PINS after working the gate list, then flip MATTE_STAGED in matte-models.ts in the same change.\n'
      : 'The matte worker loads them from /models/matte/ by the exact filenames above.\n'),
  );
}

main().catch((err) => {
  console.error(`\nfetch-matte-models failed: ${(err as Error).message}`);
  process.exit(1);
});
