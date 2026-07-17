#!/usr/bin/env node
/**
 * Downloads Adobe's official TrustMark ONNX watermark-decoder models into
 * shells/web/public/models/trustmark/ — the same-origin location
 * shells/web/src/lib/trustmark.ts fetches them from at runtime (see that
 * file's header for the full "Deep scan for watermarks" feature, and
 * plans/watermark-detectors.md for the plan behind it).
 *
 * ANDY-RUN ONLY. This script needs network access and is never invoked by
 * `npm install`/`postinstall`/CI — the models are tens of MB each, not
 * something every clone/deploy should pay for, and the whole point of the
 * feature is that they load lazily, once, only if someone clicks
 * "Deep scan for watermarks". Nothing in this repo's automated pipeline
 * calls this file.
 *
 * Usage:
 *   node scripts/fetch-trustmark-models.ts             # both Q and P decoders
 *   node scripts/fetch-trustmark-models.ts --variant Q  # just the Q decoder (smaller footprint)
 *
 * Source: the URLs and filenames below are copied VERBATIM from Adobe's own
 * published example — github.com/adobe/trustmark, js/tm_watermark.js's
 * `MODEL_BASE_URL` constant and `modelConfigs` array (MIT-licensed; see
 * engine/src/trustmark.ts's header for the full licence notice). This script
 * does not invent an endpoint — it fetches the exact files Adobe's own
 * browser demo (js/index.html) loads.
 *
 *   https://cai-watermark.adobe.net/watermarking/trustmark-models/decoder_Q.onnx
 *   https://cai-watermark.adobe.net/watermarking/trustmark-models/decoder_P.onnx
 *
 * Sizes were NOT verified by the agent that wrote this script (no download
 * was attempted — see the task constraints in the commit/PR this shipped
 * with). Run with --variant Q first and record what actually downloads:
 *
 *   node scripts/fetch-trustmark-models.ts --variant Q
 *   ls -lh shells/web/public/models/trustmark/
 *
 * then update this comment with the real sizes once known.
 *
 * ── ALSO REQUIRED: onnxruntime-web's own WASM runtime ────────────────────
 * This script only fetches the TrustMark decoder models. onnxruntime-web
 * (added to shells/web/package.json's dependencies — run `npm install`
 * first) ships its own WASM binaries that shells/web/src/lib/trustmark.ts
 * points at via `ort.env.wasm.wasmPaths = '/ort/'` (same-origin, never a
 * CDN — see that file). After `npm install`, copy them into place once:
 *
 *   mkdir -p shells/web/public/ort
 *   cp node_modules/onnxruntime-web/dist/*.wasm shells/web/public/ort/
 *   cp node_modules/onnxruntime-web/dist/*.mjs  shells/web/public/ort/
 *
 * This step was NOT verified against a real onnxruntime-web install or a
 * Vite build in the environment that wrote this script (no npm install was
 * run — see constraints above) — the exact file set onnxruntime-web 1.27.x
 * ships under dist/ (and whether Vite needs anything else, e.g. a
 * `vite-plugin-static-copy` entry instead of a manual public/ copy) needs
 * confirming against whatever actually lands in node_modules once installed.
 *
 * ── Browser verification checklist (also unverified — see the PR description) ──
 *   1. npm install; run the two copy steps above; run this script.
 *   2. npm run dev:web, open /#/valid, drop a real TrustMark-watermarked
 *      image (github.com/adobe/trustmark's images/ directory has samples)
 *      and click "Deep scan for watermarks".
 *   3. Confirm a green "TrustMark" pip + the payload note appear, and that
 *      an ORDINARY (unwatermarked) photo does NOT produce one (false-positive
 *      check — the BCH math is tested in tests/trustmark.test.ts, but the
 *      neural half feeding it real pixels has never been run).
 *   4. Reload offline (devtools "Offline" throttling) and re-run the scan on
 *      the same image — should still work from the IndexedDB cache without
 *      re-fetching the models.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/trustmark');

// Copied from js/tm_watermark.js's `modelConfigs` (see the header above) — do
// not add a `resizer.onnx` entry here: this feature deliberately uses a plain
// <canvas> resize instead of porting Adobe's second (resizer) ONNX model —
// see shells/web/src/lib/trustmark.ts's header for that decision.
const MODEL_BASE_URL = 'https://cai-watermark.adobe.net/watermarking/trustmark-models/';
const VARIANTS: Record<'Q' | 'P', string> = {
  Q: 'decoder_Q.onnx',
  P: 'decoder_P.onnx',
};

const args = process.argv.slice(2);
const variantArg = (() => {
  const i = args.indexOf('--variant');
  return i >= 0 ? (args[i + 1]?.toUpperCase() as 'Q' | 'P' | undefined) : undefined;
})();
const wanted: Array<'Q' | 'P'> = variantArg ? [variantArg] : ['Q', 'P'];

async function fetchModel(variant: 'Q' | 'P'): Promise<void> {
  const fileName = VARIANTS[variant];
  const url = MODEL_BASE_URL + fileName;
  const outPath = join(OUT_DIR, fileName);
  process.stdout.write(`Fetching ${variant} decoder from ${url} ...\n`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download failed (${resp.status} ${resp.statusText}) for ${url}`);
  }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
  process.stdout.write(`  saved ${outPath} (${mb} MB)\n`);
}

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  for (const variant of wanted) {
    await fetchModel(variant);
  }
  process.stdout.write(
    '\nDone. These files are gitignored (shells/web/.gitignore) — never commit them.\n' +
    'Next: complete the onnxruntime-web /ort/ copy steps in this script\'s header, then\n' +
    'npm run dev:web and test /#/valid\'s "Deep scan for watermarks" against a real\n' +
    'TrustMark-watermarked image.\n',
  );
}

main().catch((err) => {
  console.error(`\nfetch-trustmark-models failed: ${(err as Error).message}`);
  console.error('If cai-watermark.adobe.net is unreachable or the path has changed, check');
  console.error('the current js/tm_watermark.js at github.com/adobe/trustmark for the live URL.');
  process.exit(1);
});
