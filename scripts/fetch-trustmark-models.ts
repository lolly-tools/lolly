#!/usr/bin/env node
/**
 * Downloads Adobe's official TrustMark ONNX watermark models into
 * shells/web/public/models/trustmark/ — the same-origin location
 * shells/web/src/lib/trustmark.ts fetches them from at runtime (see that
 * file's header for the full "Deep scan for watermarks" feature, and
 * plans/watermark-detectors.md for the plan behind it).
 *
 * ANDY-RUN ONLY. This script needs network access and is never invoked by
 * `npm install`/`postinstall`/CI — the decoder models are ~45 MB each, not
 * something every clone/deploy should pay for, and the whole point of the
 * feature is that they load lazily, once, only if someone clicks
 * "Deep scan for watermarks". Nothing in this repo's automated pipeline
 * calls this file.
 *
 * Usage:
 *   node scripts/fetch-trustmark-models.ts              # both decoders + resizer
 *   node scripts/fetch-trustmark-models.ts --variant Q  # just the Q decoder (+ resizer)
 *   node scripts/fetch-trustmark-models.ts --no-resizer # decoders only (canvas resize fallback)
 *
 * ── Source: verified live 2026-07-17 ─────────────────────────────────────
 * The URLs and filenames below are the exact constants in Adobe's own
 * published example — github.com/adobe/trustmark, js/tm_watermark.js's
 * `MODEL_BASE_URL` and `modelConfigs` (MIT-licensed; see
 * engine/src/trustmark.ts's header for the full licence notice). This is the
 * authoritative distribution channel — there is NO more-canonical HuggingFace
 * repo, npm package, or git-lfs path: Adobe's JS demo AND its Python pip
 * package both resolve models from this same host (the pip package downloads
 * .ckpt weights from it on first use; it does not bundle them). The April
 * 2026 Netlify→S3 migration kept the identical hostname (now Fastly-fronted),
 * so these strings are unaffected. All three files returned HTTP 200 with
 * `access-control-allow-origin: *` when this comment was written (2026-07-17):
 *
 *   https://cai-watermark.adobe.net/watermarking/trustmark-models/decoder_Q.onnx   47,401,222 bytes (~45.2 MiB)
 *   https://cai-watermark.adobe.net/watermarking/trustmark-models/decoder_P.onnx   47,400,467 bytes (~45.2 MiB)
 *   https://cai-watermark.adobe.net/watermarking/trustmark-models/resizer.onnx            454 bytes (a Resize(antialias,cubic,half_pixel)+Clip graph — NOT a neural net)
 *
 * Integrity note: Adobe publishes md5 checksums only for the PyTorch *.ckpt
 * files, NOT for these *.onnx files, so there is no upstream hash to verify
 * against. As a lightweight guard this script pins the observed byte-lengths
 * above (EXPECTED_BYTES) and WARNS on a mismatch — it does not fail, since a
 * retrained release could legitimately change them; if you replace the models,
 * bump MODEL_CACHE_VERSION in shells/web/src/lib/trustmark.ts too.
 *
 * ── resizer.onnx: now USED (previously skipped) ──────────────────────────
 * Adobe's decoders were trained against an antialiased Resize, and
 * shells/web/src/lib/trustmark.ts now runs resizer.onnx when it is present
 * (falling back to a high-quality canvas resize when it is not). Install it
 * for training-distribution parity — it is tiny (454 bytes).
 *
 * ── ALSO REQUIRED: onnxruntime-web's own WASM runtime ────────────────────
 * This script only fetches the TrustMark models. onnxruntime-web (in
 * shells/web/package.json's dependencies — run `npm install` first) ships its
 * own WASM binaries that shells/web/src/lib/trustmark.ts points at via
 * `ort.env.wasm.wasmPaths = '/ort/'` (same-origin, never a CDN — see that
 * file). After `npm install`, copy them into place once:
 *
 *   mkdir -p shells/web/public/ort
 *   cp node_modules/onnxruntime-web/dist/*.wasm shells/web/public/ort/
 *   cp node_modules/onnxruntime-web/dist/*.mjs  shells/web/public/ort/
 *
 * This copy step was NOT verified against a real onnxruntime-web install or a
 * Vite build (no npm install was run in the environment that wrote this) — the
 * exact file set onnxruntime-web 1.27.x ships under dist/ (and whether Vite
 * wants a `vite-plugin-static-copy` entry instead of a manual public/ copy)
 * needs confirming against whatever actually lands in node_modules.
 *
 * ── Browser verification checklist (still UNVERIFIED — no browser here) ───
 *   1. npm install; run the two /ort/ copy steps above; run this script.
 *   2. npm run dev:web, open /#/valid, drop a real TrustMark-watermarked image
 *      (github.com/adobe/trustmark's images/ directory has samples) and click
 *      "Deep scan for watermarks". Turn on diagnostics first in DevTools:
 *      `localStorage.setItem('lolly:trustmark:debug','1')` — you'll see the
 *      fetch/session/inference/decode trace from lib/trustmark.ts.
 *   3. Confirm a green "TrustMark" pip + payload note on a watermarked image,
 *      and that an ORDINARY (unwatermarked) photo does NOT produce one (the
 *      BCH math is tested in tests/trustmark.test.ts; the neural half feeding
 *      it real pixels has never been run in this repo).
 *   4. Reload offline (devtools "Offline") and re-scan the same image — should
 *      still work from the IndexedDB cache without re-fetching the models.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(ROOT, 'shells/web/public/models/trustmark');

// From js/tm_watermark.js's `MODEL_BASE_URL` + `modelConfigs` (see header).
const MODEL_BASE_URL = 'https://cai-watermark.adobe.net/watermarking/trustmark-models/';
const DECODERS: Record<'Q' | 'P', string> = {
  Q: 'decoder_Q.onnx',
  P: 'decoder_P.onnx',
};
const RESIZER_FILE = 'resizer.onnx';

// Observed byte-lengths (2026-07-17) — a soft integrity guard (see header).
const EXPECTED_BYTES: Record<string, number> = {
  'decoder_Q.onnx': 47_401_222,
  'decoder_P.onnx': 47_400_467,
  'resizer.onnx': 454,
};

const args = process.argv.slice(2);
const noResizer = args.includes('--no-resizer');
const variantArg = (() => {
  const i = args.indexOf('--variant');
  return i >= 0 ? (args[i + 1]?.toUpperCase() as 'Q' | 'P' | undefined) : undefined;
})();
const wantedDecoders: Array<'Q' | 'P'> = variantArg ? [variantArg] : ['Q', 'P'];

async function fetchFile(label: string, fileName: string): Promise<void> {
  const url = MODEL_BASE_URL + fileName;
  const outPath = join(OUT_DIR, fileName);
  process.stdout.write(`Fetching ${label} from ${url} ...\n`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download failed (${resp.status} ${resp.statusText}) for ${url}`);
  }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
  const expected = EXPECTED_BYTES[fileName];
  const warn = expected != null && bytes.byteLength !== expected
    ? ` — WARNING: expected ${expected} bytes (2026-07-17), got ${bytes.byteLength}; verify the release and bump MODEL_CACHE_VERSION`
    : '';
  process.stdout.write(`  saved ${outPath} (${bytes.byteLength} bytes, ${mb} MB)${warn}\n`);
}

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  for (const variant of wantedDecoders) {
    await fetchFile(`${variant} decoder`, DECODERS[variant]);
  }
  if (!noResizer) {
    await fetchFile('resizer (antialiased Resize graph)', RESIZER_FILE);
  }
  process.stdout.write(
    '\nDone. These files are gitignored (shells/web/.gitignore) — never commit them.\n' +
    'Next: complete the onnxruntime-web /ort/ copy steps in this script\'s header, then\n' +
    'npm run dev:web and test /#/valid\'s "Deep scan for watermarks" against a real\n' +
    'TrustMark-watermarked image (enable localStorage lolly:trustmark:debug=1 to trace).\n',
  );
}

main().catch((err) => {
  console.error(`\nfetch-trustmark-models failed: ${(err as Error).message}`);
  console.error('If cai-watermark.adobe.net is unreachable or a path has changed, check the');
  console.error('current js/tm_watermark.js at github.com/adobe/trustmark for the live URLs.');
  process.exit(1);
});
