#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the ONNX monocular-depth model into
 * shells/web/public/models/depth/ - the same-origin location the depth worker
 * loads it from at runtime by exact filename (lib/depth-models.ts
 * DEPTH_MODEL_FILES). Twin of scripts/fetch-matte-models.ts; same PINS-table +
 * sha256/byte-length verify + --refresh-pins shape.
 *
 * ANDY-RUN ONLY. Network access, tens of MB per file; never invoked by
 * npm install / postinstall / CI.
 *
 * Usage:
 *   node scripts/fetch-depth-models.ts                 # every file with a real pin
 *   node scripts/fetch-depth-models.ts --refresh-pins  # download candidates, print pin lines, verify nothing
 *
 * ── Files ────────────────────────────────────────────────────────────────────
 *   depth-anything-v2-small.onnx   Depth Anything V2 Small, Apache-2.0,
 *                                  DepthAnything/Depth-Anything-V2 (the SMALL
 *                                  checkpoint only - Base/Large are CC-BY-NC and
 *                                  disqualified, see lib/depth-models.ts)
 *
 * ── THE LICENCE + ARTIFACT GATES (worked 2026-08-26; re-work for any change) ─
 * As fetch-matte-models.ts's header, verbatim: (1) upstream licence covers the
 * WEIGHTS - Depth-Anything-V2 publishes the Small checkpoint under Apache-2.0
 * (Base/Large CC-BY-NC-4.0); (2) the mirror's provenance - onnx-community's
 * transformers.js export, repo card licensed apache-2.0; (3) real byte size +
 * sha256 recorded below; (4) loaded and RUN in onnxruntime (wasm-class CPU
 * path); (5) graph inspected: input `pixel_values` f32 dynamic [1,3,H,W] run at
 * 518x518, one output [1,H,W]; (6) output confirmed empirically as relative
 * INVERSE depth (near = larger), min-max normalised by the worker.
 *
 * ── Integrity ────────────────────────────────────────────────────────────────
 * Every real pin is SHA-256 + byte-length verified BEFORE it is written; a
 * mismatch exits non-zero with nothing written. An on-disk file matching its pin
 * is skipped network-free. A PLACEHOLDER pin is SKIPPED on a normal run with a
 * loud warning. --refresh-pins stages a candidate OUT of the served tree
 * (.candidates/) and prints a pin line to hand-verify.
 *
 * On success (real pins only) writes shells/web/public/models/depth/CREDITS.txt.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/depth');

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

const PINS: Record<string, Pin> = {
  'depth-anything-v2-small.onnx': {
    url: 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx',
    sha256: PLACEHOLDER,
    bytes: null,
    license: 'Apache-2.0',
    source: 'https://github.com/DepthAnything/Depth-Anything-V2 (upstream; the Small checkpoint is Apache-2.0); ONNX by onnx-community/depth-anything-v2-small',
    copyright: 'Copyright (c) 2024, Lihe Yang et al. (Depth Anything V2)',
    note: 'Relative inverse depth (disparity), ViT-S/14 head run at 518x518, ImageNet norm. Quantised export for the ~25 MB one-time download.',
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
  if (b0 === 0x50 && b1 === 0x4b) return false; // 'PK' - zip / .pth
  if (b0 === 0x1f && b1 === 0x8b) return false; // gzip
  if (b0 === 0x3c) return false;                // '<' - HTML error page
  return b0 === 0x08 || b0 === 0x0a;            // protobuf ModelProto head
}

async function fetchFile(relPath: string): Promise<'saved' | 'cached' | 'skipped'> {
  const pin = PINS[relPath];
  if (!pin) throw new Error(`No PINS entry for ${relPath}`);
  const outPath = join(OUT_DIR, relPath);

  if (!refreshPins && pin.sha256 === PLACEHOLDER) {
    process.stdout.write(
      `  ${relPath}: SKIPPED - no verified pin yet (${pin.note ?? 'placeholder'}). ` +
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
      `  staged candidate → ${stagePath} (${bytes.byteLength} bytes, ${mb} MB) - NOT written to the live ${relPath}\n` +
      (looksOnnx ? '' : `  ⚠ these bytes do NOT look like a single-file ONNX (magic suggests .pth/.zip/HTML) - convert/inspect before pinning\n`) +
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
    'Lolly - vendored monocular-depth ONNX models',
    '============================================',
    '',
    'These model files are not source code and are not covered by this repo\'s',
    'own MPL-2.0 licensing - each carries the license of its own upstream',
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
      'A depth model is a PLACEHOLDER until its licence + ONNX are verified - see this script\'s header gate list.\n',
    );
  }

  process.stdout.write(
    '\nDone. These files are gitignored - never commit them.\n' +
    (refreshPins
      ? 'Paste the printed pin lines over PINS after working the gate list, then flip DEPTH_STAGED in depth-models.ts in the same change.\n'
      : 'The depth worker loads them from /models/depth/ by the exact filenames above.\n'),
  );
}

main().catch((err) => {
  console.error(`\nfetch-depth-models failed: ${(err as Error).message}`);
  process.exit(1);
});
