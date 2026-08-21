#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the ONNX OCR models (PP-OCRv5 mobile) into
 * shells/web/public/models/ocr/ - the same-origin location the OCR worker loads
 * them from at runtime by exact filename. Twin of scripts/fetch-matte-models.ts;
 * same PINS-table + sha256/byte-length verify + --refresh-pins shape.
 *
 * ANDY-RUN ONLY. Network access; never invoked by npm install / postinstall / CI.
 *
 * Usage:
 *   node scripts/fetch-ocr-models.ts                 # every file with a real pin
 *   node scripts/fetch-ocr-models.ts --only ppocrv5-mobile-det.onnx
 *   node scripts/fetch-ocr-models.ts --refresh-pins  # download candidates, print pin lines, verify nothing
 *
 * ── Files (a logical model is THREE files) ───────────────────────────────────
 *   ppocrv5-mobile-det.onnx     DBNet detector,   Apache-2.0, PaddleOCR PP-OCRv5
 *   ppocrv5-mobile-rec-en.onnx  CRNN/SVTR recog.,  Apache-2.0, PaddleOCR PP-OCRv5
 *   ppocrv5-en-dict.txt         CTC char dictionary (one glyph a line)
 *
 * ── THE LICENCE + ARTIFACT GATES (work these before staging) ─────────────────
 * Model licensing ships to every user's device, so nothing is trusted on web
 * research. Before flipping the pins (and OCR_STAGED['ppocr-v5-en'] in
 * shells/web/src/lib/ocr-models.ts, in the SAME change), a human MUST:
 *   1. Re-read the UPSTREAM LICENSE at a pinned commit and confirm it covers the
 *      WEIGHTS, not just the code - PaddleOCR is Apache-2.0 (toolkit AND the
 *      official PP-OCRv5 model weights). Do NOT pin an EasyOCR/community mirror of
 *      unclear terms - that is the OCR equivalent of the RMBG trap.
 *   2. Confirm the ONNX conversion's provenance: the official PaddlePaddle release
 *      or a conversion whose repo card licence matches upstream - a mirror must not
 *      have relicensed. Record which one, verbatim, in CREDITS.
 *   3. Download and record the REAL byte size + sha256 of all three files.
 *   4. Load BOTH graphs in onnxruntime on the WASM/CPU path (OCR is WASM-ONLY) and
 *      confirm each RUNS at its expected input shape.
 *   5. Confirm from the ACTUAL graphs and write into OCR_MODEL_SPEC: the detector's
 *      input NAME/shape/dtype + ImageNet mean/std; the recogniser's input name,
 *      fixed HEIGHT and [-1,1] (0.5/0.5) normalization.
 *   6. Confirm the CTC DICTIONARY alignment: PP-OCR CTCLabelDecode is
 *      [blank] + dictionary + [space] with blank at index 0 (ocr.ts's charset build
 *      already assumes this). Read a real image end-to-end and eyeball the text - a
 *      misaligned dict or a wrong blank index yields plausible-looking garbage with
 *      no crash.
 * Reconcile the real sizes into OCR_MODELS.approxBytes (det + rec + dict) once known.
 *
 * ── Integrity ────────────────────────────────────────────────────────────────
 * Every real pin is SHA-256 + byte-length verified BEFORE it is written; a mismatch
 * exits non-zero with nothing written. A PLACEHOLDER pin is SKIPPED on a normal run
 * with a loud warning - nothing unverified is served. --refresh-pins stages a
 * candidate OUT of the served tree (.candidates/) and prints a pin line to verify.
 *
 * On success (real pins only) writes shells/web/public/models/ocr/CREDITS.txt.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/ocr');

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

// All THREE pins are PLACEHOLDER until a human works the header gate list. Paste a
// CANDIDATE url with sha256: PLACEHOLDER, run --refresh-pins to fetch + print the
// real line, work the gates, then paste the real pin over the placeholder in the
// SAME change that flips OCR_STAGED in shells/web/src/lib/ocr-models.ts.
// REAL pins, verified 2026-08-18: downloaded, sha256 + byte-length checked, BOTH
// graphs loaded + run on CPU (onnxruntime-node), and the CTC dict alignment
// confirmed (rec output 18,385 classes = dict 18,383 + blank + space). Licence
// Apache-2.0: the ilaylow ONNX is a paddle2onnx conversion of the OFFICIAL
// PaddlePaddle PP-OCRv5_mobile det/rec (both Apache-2.0); the dict is PaddleOCR
// upstream. This is the MULTILINGUAL mobile recogniser (Latin + CJK + more).
const PINS: Record<string, Pin> = {
  'ppocrv5-mobile-det.onnx': {
    url: 'https://huggingface.co/ilaylow/PP_OCRv5_mobile_onnx/resolve/main/ppocrv5_det.onnx',
    sha256: '1eb7b4f7ab657ebd1c66d5f79bca7497f29768a2e3c15e52daecbba1a8e4a039',
    bytes: 4826518,
    license: 'Apache-2.0',
    source: 'ilaylow/PP_OCRv5_mobile_onnx (paddle2onnx of PaddlePaddle/PP-OCRv5_mobile_det)',
    copyright: '© PaddlePaddle Authors',
    note: 'DBNet detector. Confirmed graph: input "x", output [1,1,H,W] single-channel prob map.',
  },
  'ppocrv5-mobile-rec.onnx': {
    url: 'https://huggingface.co/ilaylow/PP_OCRv5_mobile_onnx/resolve/main/ppocrv5_rec.onnx',
    sha256: '243a0f06d826761323e9045e9b113ab2c191c3aa50565585e628300b8eda0224',
    bytes: 16562373,
    license: 'Apache-2.0',
    source: 'ilaylow/PP_OCRv5_mobile_onnx (paddle2onnx of PaddlePaddle/PP-OCRv5_mobile_rec)',
    copyright: '© PaddlePaddle Authors',
    note: 'CRNN/SVTR recogniser. Confirmed graph: input "x", output [1,T,18385]; height 48, [-1,1] norm.',
  },
  'ppocrv5-dict.txt': {
    url: 'https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/ppocr/utils/dict/ppocrv5_dict.txt',
    sha256: 'd1979e9f794c464c0d2e0b70a7fe14dd978e9dc644c0e71f14158cdf8342af1b',
    bytes: 74012,
    license: 'Apache-2.0',
    source: 'PaddleOCR PP-OCRv5 multilingual character dictionary',
    copyright: '© PaddlePaddle Authors',
    note: '18,383 glyphs, one a line. ocr.ts builds charset = [blank] + these + [space] = 18,385, matching the rec output.',
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

/** A cheap "is this a single-file ONNX?" sniff (skipped for the .txt dictionary). */
function sniffOnnx(relPath: string, bytes: Uint8Array): boolean {
  if (relPath.endsWith('.txt')) return bytes.length > 0; // a dictionary is plain text
  if (bytes.length < 8) return false;
  const b0 = bytes[0], b1 = bytes[1];
  if (b0 === 0x50 && b1 === 0x4b) return false; // 'PK' - zip / .pdmodel bundle
  if (b0 === 0x1f && b1 === 0x8b) return false; // gzip
  if (b0 === 0x3c) return false;                // '<' - HTML error page
  return b0 === 0x08 || b0 === 0x0a;            // protobuf ModelProto head
}

async function fetchFile(relPath: string): Promise<'saved' | 'cached' | 'skipped'> {
  const pin = PINS[relPath];
  if (!pin) throw new Error(`No PINS entry for ${relPath}`);
  const outPath = join(OUT_DIR, relPath);

  if (!refreshPins && (pin.sha256 === PLACEHOLDER || pin.url === PLACEHOLDER)) {
    process.stdout.write(
      `  ${relPath}: SKIPPED - no verified pin yet (${pin.note ?? 'placeholder'}). ` +
      `Run --refresh-pins with a candidate url to fetch, then work the header gate list before pasting a real pin.\n`,
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

  if (pin.url === PLACEHOLDER) {
    process.stdout.write(`  ${relPath}: no candidate url set - paste one into PINS first.\n`);
    return 'skipped';
  }

  process.stdout.write(`Fetching ${relPath} from ${pin.url} ...\n`);
  const resp = await fetch(pin.url);
  if (!resp.ok) throw new Error(`Download failed (${resp.status} ${resp.statusText}) for ${pin.url}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const kb = (bytes.byteLength / 1024).toFixed(1);

  if (refreshPins) {
    const stagePath = join(OUT_DIR, '.candidates', relPath);
    mkdirSync(dirname(stagePath), { recursive: true });
    writeFileSync(stagePath, bytes);
    const looksRight = sniffOnnx(relPath, bytes);
    process.stdout.write(
      `  '${relPath}': { url: '${pin.url}', sha256: '${sha256(bytes)}', bytes: ${bytes.byteLength}, ` +
      `license: '${pin.license}', source: '${pin.source}', copyright: '${pin.copyright}' },\n` +
      `  staged candidate → ${stagePath} (${bytes.byteLength} bytes, ${kb} KB) - NOT written to the live ${relPath}\n` +
      (looksRight ? '' : `  ⚠ these bytes do NOT look like the expected file type - inspect before pinning\n`) +
      `  ⚠ Work the licence + runtime gates in this script's header before trusting this pin.\n`,
    );
    return 'saved';
  }

  verify(relPath, pin, bytes, 'downloaded');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  process.stdout.write(`  saved ${outPath} (${bytes.byteLength} bytes, ${kb} KB, hash verified)\n`);
  return 'saved';
}

function writeCredits(vendored: string[]): void {
  const lines: string[] = [
    'Lolly - vendored OCR (PP-OCRv5) ONNX models',
    '===========================================',
    '',
    'These model files are not source code and are not covered by this repo\'s own',
    'MPL-2.0 licensing - each carries the license of its own upstream project,',
    'recorded below (verified against the upstream repo, not merely the mirror the',
    'file was fetched from).',
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
    process.stdout.write('--refresh-pins: downloading fresh copies and printing new pin lines - paste them over PINS after working the gate list.\n');
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
      'Every OCR file is a PLACEHOLDER until its licence + graph are verified - see this script\'s header gate list.\n',
    );
  }

  process.stdout.write(
    '\nDone. These files are gitignored - never commit them.\n' +
    (refreshPins
      ? 'Paste the printed pin lines over PINS after working the gate list, then flip OCR_STAGED in ocr-models.ts in the same change.\n'
      : 'The OCR worker loads them from /models/ocr/ by the exact filenames above.\n'),
  );
}

main().catch((err) => {
  console.error(`\nfetch-ocr-models failed: ${(err as Error).message}`);
  process.exit(1);
});
