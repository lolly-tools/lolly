#!/usr/bin/env node
/**
 * onnxruntime-web runtime copier.
 *
 * Run as: npm run build:ort  (part of build:web; also runs standalone).
 *
 * `shells/web/public/ort/` holds onnxruntime-web's WASM + loader files (~93 MB),
 * served same-origin to the browser for the client-side ONNX paths (TrustMark
 * watermark read, steganalysis). Those bytes are an EXACT copy of every `*.wasm`
 * and `*.mjs` file in the installed `onnxruntime-web` package's `dist/` — nothing
 * hand-authored. So they're gitignored and NOT shipped in the `loldev ship`
 * archive (see `.vercelignore`); instead this script regenerates them at build
 * time from the dependency, which Vercel installs anyway. That keeps ~93 MB out
 * of every deploy upload for zero fidelity cost — the served files are byte-identical.
 *
 * Idempotent: locally the files usually already exist (gitignored working copy),
 * and copying over them is harmless. Resolves the package via `require.resolve`
 * so it works whether npm hoisted onnxruntime-web to the root `node_modules` or
 * kept it under `shells/web/node_modules`.
 */

import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'shells/web/public/ort');

// The package's `exports` map blocks resolving its package.json, so probe the
// standard install locations directly — robust to whether npm hoisted the dep to
// the root node_modules or kept it under the shells/web workspace.
const CANDIDATES = [
  join(ROOT, 'node_modules/onnxruntime-web/dist'),
  join(ROOT, 'shells/web/node_modules/onnxruntime-web/dist'),
];
const DIST = CANDIDATES.find(existsSync);

if (!DIST) {
  console.error(
    `[copy-ort] onnxruntime-web dist not found in any of:\n  ${CANDIDATES.join('\n  ')}\n  is it installed?`,
  );
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });

let n = 0;
for (const f of readdirSync(DIST)) {
  if (f.endsWith('.wasm') || f.endsWith('.mjs')) {
    copyFileSync(join(DIST, f), join(DEST, f));
    n++;
  }
}

console.log(`[copy-ort] copied ${n} onnxruntime-web runtime files → ${DEST.replace(`${ROOT}/`, '')}`);
