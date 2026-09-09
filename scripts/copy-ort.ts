#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * onnxruntime-web runtime copier.
 *
 * Run as: pnpm run build:ort  (part of build:web; also runs standalone).
 *
 * `shells/web/public/ort/` holds onnxruntime-web's WASM + loader files (~93 MB),
 * served same-origin to the browser for the client-side ONNX paths (TrustMark
 * watermark read, steganalysis). Those bytes are an EXACT copy of every `*.wasm`
 * and `*.mjs` file in the installed `onnxruntime-web` package's `dist/` - nothing
 * hand-authored. So they're gitignored and NOT shipped in the `loldev ship`
 * archive (see `.vercelignore`); instead this script regenerates them at build
 * time from the dependency, which Vercel installs anyway. That keeps ~93 MB out
 * of every deploy upload for zero fidelity cost - the served files are byte-identical.
 *
 * Idempotent: locally the files usually already exist (gitignored working copy),
 * and copying over them is harmless. Resolves the package via `require.resolve`
 * so it works whether pnpm hoisted onnxruntime-web to the root `node_modules` or
 * kept it under `shells/web/node_modules`.
 */

import { readdirSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'shells/web/public/ort');

// Resolve from the web workspace: another consumer can hoist an incompatible
// onnxruntime-web version to the root. The exported entry lives in dist/.
const webRequire = createRequire(join(ROOT, 'shells/web/package.json'));
const DIST = dirname(webRequire.resolve('onnxruntime-web'));

mkdirSync(DEST, { recursive: true });

let n = 0;
for (const f of readdirSync(DIST)) {
  if (f.endsWith('.wasm') || f.endsWith('.mjs')) {
    copyFileSync(join(DIST, f), join(DEST, f));
    n++;
  }
}

console.log(`[copy-ort] copied ${n} onnxruntime-web runtime files → ${DEST.replace(`${ROOT}/`, '')}`);
