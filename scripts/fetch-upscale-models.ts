#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the ONNX upscale/restore models into
 * shells/web/public/models/upscale/ — the same-origin location the (planned)
 * upscale worker loads them from at runtime by exact filename. Mirrors
 * scripts/fetch-kokoro-models.ts and scripts/fetch-trustmark-models.ts in
 * shape: a PINS table of per-file url + sha256 + byte-length, verified BEFORE
 * a byte is written, plus --refresh-pins for a deliberate upgrade.
 *
 * ANDY-RUN ONLY. This script needs network access and is never invoked by
 * `npm install`/`postinstall`/CI — these are tens to hundreds of MB each, not
 * something every clone/deploy should pay for. Nothing in this repo's
 * automated pipeline calls this file.
 *
 * Usage:
 *   node scripts/fetch-upscale-models.ts                  # every REQUIRED file + the optional face detector
 *   node scripts/fetch-upscale-models.ts --no-face-detect  # skip the optional face-alignment detector
 *   node scripts/fetch-upscale-models.ts --only realesr-general-x4v3.onnx,gfpgan-v1.4.onnx
 *   node scripts/fetch-upscale-models.ts --refresh-pins    # deliberate model upgrade: download,
 *                                                          # print new pin lines, skip verification
 *
 * ── Files ─────────────────────────────────────────────────────────────────
 *   realesr-general-x4v3.onnx      Real-ESRGAN general v3 (SRVGGNetCompact),   BSD-3-Clause, xinntao/Real-ESRGAN
 *   realesr-general-wdn-x4v3.onnx  paired WDN denoise-strength model,          BSD-3-Clause, xinntao/Real-ESRGAN
 *   realesrgan-x4plus.onnx         Real-ESRGAN x4plus (RRDBNet),               BSD-3-Clause, xinntao/Real-ESRGAN
 *   gfpgan-v1.4.onnx                GFPGANv1.4 face restoration,                Apache-2.0, TencentARC/GFPGAN
 *   face-detect.onnx (OPTIONAL)     BlazeFace face detector for GFPGAN align,   Apache-2.0, Google Research (MediaPipe)
 *
 * face-detect.onnx is best-effort: if it is absent (fetch failed, skipped
 * with --no-face-detect, or never vendored) the runtime falls back to a
 * center crop instead of a detected face box for GFPGAN alignment.
 *
 * NOT fetched here: realesrgan-x4plus-anime.onnx (the illustration/line-art
 * intent's engine). Its upstream RealESRGAN_x4plus_anime_6B ships only as a
 * .pth with no license-clean ONNX mirror, so it is CONVERSION-SOURCED — produced
 * on-device from the BSD-3 .pth by scripts/convert-anime-upscale-onnx.py, which
 * writes it straight into this same /models/upscale/ tree. Run that script (not
 * this one) to vendor it.
 *
 * ── HuggingFace community-upload caveat ──────────────────────────────────
 * None of these five models are published as ONNX by their own upstream
 * authors — xinntao's Real-ESRGAN releases and TencentARC's GFPGAN releases
 * are PyTorch .pth checkpoints; the .onnx files below are THIRD-PARTY
 * conversions re-hosted on community HuggingFace repos. The `license` field
 * on every PINS entry records the UPSTREAM project's license (verified
 * against the original GitHub repos, not the mirror), because a community
 * uploader's own repo card can — and sometimes does — attach a different,
 * more restrictive license than the code it was converted from. On
 * --refresh-pins, RE-CHECK the mirror's repo card against the upstream
 * license before trusting a new pin; do not assume it still matches.
 *
 * On success, this script writes shells/web/public/models/upscale/CREDITS.txt
 * with one entry per vendored file — license, source URL, and copyright —
 * so the app can carry the required attribution for an MPL-2.0 build that
 * ships these weights.
 *
 * ── Integrity ─────────────────────────────────────────────────────────────
 * Every file with a real pin is SHA-256 + byte-length verified BEFORE it is
 * written — a mismatch exits non-zero with nothing written. A file already
 * on disk whose hash matches its pin is skipped without touching the
 * network. realesr-general-wdn-x4v3.onnx below is a PLACEHOLDER pin (see the
 * TODO(andy) comment) — no unauthenticated, single-file ONNX export of the WDN
 * denoise partner could be found/verified (realesrgan-x4plus.onnx WAS a
 * placeholder too but is a real, verified pin as of 2026-08-05). A normal run
 * (no --refresh-pins) SKIPS a
 * placeholder entry with a loud warning rather than downloading it
 * unverified — nothing is trusted on a fake-looking hash. Run
 * --refresh-pins to fetch a candidate, inspect it, and hand-verify before
 * pasting a real pin over the placeholder.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/upscale');

const PLACEHOLDER = 'PLACEHOLDER';

interface Pin {
  /** Direct, resolvable download URL for the file. */
  url: string;
  /** SHA-256 of the verified bytes, or the literal 'PLACEHOLDER' string. */
  sha256: string;
  /** Byte length of the verified download, or null while sha256 is a placeholder. */
  bytes: number | null;
  /** SPDX id of the UPSTREAM project's license (see header caveat). */
  license: string;
  /** Where the license/attribution was verified — the upstream repo, not just the mirror. */
  source: string;
  /** Copyright line to carry into CREDITS.txt. */
  copyright: string;
  /** Best-effort file — a fetch failure or --no-face-detect skips it, not an abort. */
  optional?: boolean;
  /** Free-text note surfaced in CREDITS.txt and in --refresh-pins output. */
  note?: string;
}

// Per-file pins. Verified BEFORE writing (real entries); refresh with
// --refresh-pins on a deliberate upgrade — see header for the placeholder
// caveat on the two files that don't have one yet.
const PINS: Record<string, Pin> = {
  'realesr-general-x4v3.onnx': {
    url: 'https://huggingface.co/OwlMaster/AllFilesRope/resolve/main/realesr-general-x4v3.onnx',
    sha256: '09b757accd747d7e423c1d352b3e8f23e77cc5742d04bae958d4eb8082b76fa4',
    bytes: 4_871_181,
    license: 'BSD-3-Clause',
    source: 'https://github.com/xinntao/Real-ESRGAN (upstream .pth); ONNX conversion re-hosted at https://huggingface.co/OwlMaster/AllFilesRope',
    copyright: 'Copyright (c) 2021, Xintao Wang and contributors (xinntao/Real-ESRGAN)',
  },
  'realesr-general-wdn-x4v3.onnx': {
    // TODO(andy): PLACEHOLDER — no unauthenticated single-file ONNX mirror of
    // the WDN (denoise-strength-blend) variant was found as of 2026-08-04.
    // The .pth checkpoint exists (e.g. hlky/RealESRGAN_x4plus and the
    // cgfgui/upscale dataset both carry realesr-general-wdn-x4v3.pth) but
    // needs converting to ONNX yourself, or a mirror needs to surface. Run
    // --refresh-pins once a candidate URL is in hand — this entry will still
    // refuse to verify (sha256 is 'PLACEHOLDER') until you paste a hand-
    // checked pin over it.
    url: 'https://huggingface.co/hlky/RealESRGAN_x4plus/resolve/main/realesr-general-wdn-x4v3.pth', // NOTE: .pth, not .onnx — placeholder target only, not fetchable as-is
    sha256: PLACEHOLDER,
    bytes: null,
    license: 'BSD-3-Clause',
    source: 'https://github.com/xinntao/Real-ESRGAN — no verified ONNX export located yet',
    copyright: 'Copyright (c) 2021, Xintao Wang and contributors (xinntao/Real-ESRGAN)',
    note: 'TODO(andy): needs a real ONNX conversion + hand-verified pin before this can ship.',
  },
  'realesrgan-x4plus.onnx': {
    // Verified 2026-08-05: a SINGLE-FILE fp32 ONNX of the canonical RealESRGAN_x4plus
    // (RRDBNet 23-block), dynamic H×W, opset 17, input `input`/output `output`, x4,
    // [0,1] RGB. Ran in onnxruntime (64²→256², output clamps to [0,1] like the general
    // net) → drop-in for the existing runModel contract. BSD-3-Clause (follows upstream).
    url: 'https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/real_esrgan_x4.onnx',
    sha256: '5c586662929cbc686c1a5c38d9c060dbdb4ea5863a1f7672b8c0761e6b89c033',
    bytes: 67051616,
    license: 'BSD-3-Clause',
    source: 'https://github.com/xinntao/Real-ESRGAN (upstream x4plus .pth); single-file ONNX re-hosted at https://huggingface.co/SceneWorks/real-esrgan-onnx',
    copyright: 'Copyright (c) 2021, Xintao Wang and contributors (xinntao/Real-ESRGAN)',
  },
  'gfpgan-v1.4.onnx': {
    url: 'https://huggingface.co/facefusion/models-3.0.0/resolve/main/gfpgan_1.4.onnx',
    sha256: 'accc4757b26bdb89b32b4d3500d4f79c9dff97c1dd7c7104bf9dcb95e3311385',
    bytes: 340_299_087,
    license: 'Apache-2.0',
    source: 'https://github.com/TencentARC/GFPGAN (upstream .pth); ONNX conversion re-hosted at https://huggingface.co/facefusion/models-3.0.0',
    copyright: 'Copyright (c) 2021, Tencent ARC Lab and contributors (TencentARC/GFPGAN)',
  },
  'face-detect.onnx': {
    url: 'https://huggingface.co/garavv/blazeface-onnx/resolve/main/blaze.onnx',
    sha256: '564740c5146673c840257402cee8309161848e48e64d277a862ab4d501adf8a5',
    bytes: 535_842,
    license: 'Apache-2.0',
    source: 'https://github.com/google/mediapipe (BlazeFace, upstream TFLite); ONNX conversion re-hosted at https://huggingface.co/garavv/blazeface-onnx',
    copyright: 'Copyright 2020 Google LLC (MediaPipe / BlazeFace)',
    optional: true,
    note: 'Best-effort — GFPGAN alignment falls back to a center crop when this file is absent.',
  },
};

const args = process.argv.slice(2);
const refreshPins = args.includes('--refresh-pins');
const noFaceDetect = args.includes('--no-face-detect');
const onlyArg = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? args[i + 1] : undefined;
})();
const onlyFiles = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Verify bytes against the pin. Throws (nothing written by the caller) on any
 *  mismatch — the byte-length is reported alongside as the secondary signal. */
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

async function fetchFile(relPath: string): Promise<'saved' | 'cached' | 'skipped'> {
  const pin = PINS[relPath];
  if (!pin) throw new Error(`No PINS entry for ${relPath}`);
  const outPath = join(OUT_DIR, relPath);

  if (!refreshPins && pin.sha256 === PLACEHOLDER) {
    process.stdout.write(
      `  ${relPath}: SKIPPED — no verified pin yet (${pin.note ?? 'placeholder'}). ` +
      `Run --refresh-pins to fetch a candidate, then hand-verify before pasting a real pin over PINS.\n`,
    );
    return 'skipped';
  }

  // Already on disk and matching its pin → nothing to do (network-free re-run).
  if (!refreshPins && existsSync(outPath)) {
    const held = readFileSync(outPath);
    if (sha256(held) === pin.sha256) {
      process.stdout.write(`  ${relPath}: cached, hash verified (${held.byteLength} bytes)\n`);
      return 'cached';
    }
  }

  process.stdout.write(`Fetching ${relPath} from ${pin.url} ...\n`);
  const resp = await fetch(pin.url);
  if (!resp.ok) {
    throw new Error(`Download failed (${resp.status} ${resp.statusText}) for ${pin.url}`);
  }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
  if (refreshPins) {
    // NEVER write an unverified candidate to the live runtime path: a placeholder
    // URL may be a .pth checkpoint or a .zip (ONNX external-data), and the runtime
    // + its IndexedDB cache would happily serve/cache a poisoned `.onnx` that then
    // fails confusingly at InferenceSession.create. Stage it OUT of the served tree,
    // print the computed pin, and let a human paste it into PINS + re-run a normal
    // (verified) fetch to land the real file.
    const stagePath = join(OUT_DIR, '.candidates', relPath);
    mkdirSync(dirname(stagePath), { recursive: true });
    writeFileSync(stagePath, bytes);
    const looksOnnx = sniffOnnx(bytes);
    process.stdout.write(
      `  '${relPath}': { url: '${pin.url}', sha256: '${sha256(bytes)}', bytes: ${bytes.byteLength}, ` +
      `license: '${pin.license}', source: '${pin.source}', copyright: '${pin.copyright}' },\n` +
      `  staged candidate → ${stagePath} (${bytes.byteLength} bytes, ${mb} MB) — NOT written to the live ${relPath}\n` +
      (looksOnnx ? '' : `  ⚠ these bytes do NOT look like a single-file ONNX (magic bytes suggest a .pth/.zip) — convert before pinning\n`) +
      `  ⚠ RE-VERIFY the mirror's repo card against the upstream license before trusting this pin ` +
      `(see the HuggingFace community-upload caveat in this script's header).\n`,
    );
    return 'saved';
  }
  verify(relPath, pin, bytes, 'downloaded'); // BEFORE the write — a bad file never lands
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  process.stdout.write(`  saved ${outPath} (${bytes.byteLength} bytes, ${mb} MB, hash verified)\n`);
  return 'saved';
}

// A cheap "is this a single-file ONNX?" sniff for the refresh path — enough to stop
// a .pth/.zip being staged under an `.onnx` name, not a full validator. Rejects the
// obvious non-ONNX containers; accepts a protobuf-looking head (ONNX ModelProto
// opens with field tag 0x08 = ir_version, or 0x0a = a length-delimited field 1).
function sniffOnnx(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  const b0 = bytes[0], b1 = bytes[1];
  if (b0 === 0x50 && b1 === 0x4b) return false; // 'PK' — zip / PyTorch .pth
  if (b0 === 0x1f && b1 === 0x8b) return false; // gzip
  if (b0 === 0x3c) return false;                // '<' — an HTML error page
  return b0 === 0x08 || b0 === 0x0a;
}

function writeCredits(vendored: string[]): void {
  const lines: string[] = [
    'Lolly — vendored upscale/restore ONNX models',
    '==============================================',
    '',
    'These model files are not source code and are not covered by this repo\'s',
    'own MPL-2.0 licensing — each carries the license of its own upstream',
    'project, recorded below. See scripts/fetch-upscale-models.ts for the full',
    'HuggingFace community-upload caveat: the license below is the UPSTREAM',
    'project\'s license, verified against its own repo, not necessarily the',
    'license attached to the (third-party) mirror this file was fetched from.',
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
  const wanted = Object.keys(PINS).filter((relPath) => {
    if (onlyFiles && !onlyFiles.has(relPath)) return false;
    if (noFaceDetect && PINS[relPath]?.optional) return false;
    return true;
  });

  if (refreshPins) {
    process.stdout.write('--refresh-pins: downloading fresh copies and printing new pin lines — paste them over PINS.\n');
  }

  const vendored: string[] = [];
  const skipped: string[] = [];
  for (const relPath of wanted) {
    try {
      const result = await fetchFile(relPath);
      if (result === 'saved' || result === 'cached') vendored.push(relPath);
      else skipped.push(relPath);
    } catch (err) {
      if (PINS[relPath]?.optional) {
        process.stdout.write(`  ${relPath}: OPTIONAL fetch failed (${(err as Error).message}) — continuing without it.\n`);
        skipped.push(relPath);
        continue;
      }
      throw err;
    }
  }

  if (vendored.length > 0 && !refreshPins) {
    writeCredits(vendored);
  }

  if (skipped.length > 0) {
    process.stdout.write(
      `\n${skipped.length} file(s) not vendored: ${skipped.join(', ')}.\n` +
      'Placeholder pins need --refresh-pins + hand verification before they can ship; ' +
      'face-detect.onnx is optional and the runtime falls back to a center crop without it.\n',
    );
  }

  process.stdout.write(
    '\nDone. These files are gitignored (shells/web/.gitignore) — never commit them.\n' +
    (refreshPins
      ? 'Paste the printed pin lines over PINS after hand-verifying each against its upstream license.\n'
      : 'The upscale worker loads them from /models/upscale/ by the exact filenames above.\n'),
  );
}

main().catch((err) => {
  console.error(`\nfetch-upscale-models failed: ${(err as Error).message}`);
  console.error('If a mirror is unreachable or a path changed, see the TODO(andy) comments in');
  console.error('scripts/fetch-upscale-models.ts for the alternates that were already tried.');
  process.exit(1);
});
