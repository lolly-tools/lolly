// SPDX-License-Identifier: MPL-2.0
/**
 * vendor-models - one command to vendor every on-device ONNX model into
 * shells/web/public/models (gitignored, ~1.2 GB).
 *
 * The model bytes are deliberately NOT in git and are excluded from the app
 * deploys (.vercelignore); production serves them from the static model host
 * (deploy/models-host, proxied at /models/**). This script is the developer's
 * opt-in way to fetch them for a self-contained build. It runs each family's
 * fetch-*-models.ts, which each:
 *   - download from the pinned upstream (HuggingFace / Adobe / ...),
 *   - verify SHA-256 (or byte-length, where the upstream publishes no hash)
 *     BEFORE writing, so a tampered or re-exported release can't land, and
 *   - skip any file already on disk whose hash matches - so re-running only
 *     fetches what's missing.
 *
 * OPT-IN, never automatic: not in npm install / postinstall / CI / the build.
 * Fetching ~1.2 GB is a choice, and the build works WITHOUT the files (runtime
 * fetches them from the model host). Run this first only when you want the
 * models bundled into your own dist.
 *
 * Usage:
 *   node scripts/vendor-models.ts                  # every family, skip what's present
 *   node scripts/vendor-models.ts --only=kokoro,matte
 *   node scripts/vendor-models.ts --list           # show families + scripts, fetch nothing
 *
 * Per-family flags (e.g. upscale --no-face-detect) aren't exposed here - run
 * that one fetch-*-models.ts directly when you need them.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const MODELS_DIR = join(ROOT, 'shells/web/public/models');
const MANIFEST = join(ROOT, 'shells/web/models-manifest.json');

// family -> its fetch script. Explicit (not `fetch-${fam}-models.ts`) because
// embed is the odd one out (singular "model"); an explicit map also documents
// the full set and fails loudly if a script is renamed.
const FAMILIES: Record<string, string> = {
  'ai-detect': 'fetch-ai-detect-models.ts',
  depth: 'fetch-depth-models.ts',
  embed: 'fetch-embed-model.ts',
  kokoro: 'fetch-kokoro-models.ts',
  matte: 'fetch-matte-models.ts',
  ocr: 'fetch-ocr-models.ts',
  reword: 'fetch-reword-models.ts',
  trustmark: 'fetch-trustmark-models.ts',
  upscale: 'fetch-upscale-models.ts',
  whisper: 'fetch-whisper-models.ts',
};

export function resolveScripts(only?: string[]): { fam: string; script: string }[] {
  const fams = only && only.length ? only : Object.keys(FAMILIES);
  return fams.map((f) => {
    const script = FAMILIES[f];
    if (!script) throw new Error(`unknown model family "${f}" - known: ${Object.keys(FAMILIES).join(', ')}`);
    return { fam: f, script };
  });
}

/** Manifest files (url "/models/<rel>") with no file yet at <modelsDir>/<rel>. */
export function missingFromManifest(modelsDir: string, manifest: { url: string }[]): string[] {
  return manifest
    .map((e) => e.url.replace(/^\/models\//, ''))
    .filter((rel) => rel && !existsSync(join(modelsDir, rel)));
}

function dirBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    n += e.isDirectory() ? dirBytes(full) : statSync(full).size;
  }
  return n;
}

const gb = (bytes: number): string => `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;

function main(): void {
  const argv = process.argv.slice(2);
  const list = argv.includes('--list');
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  let scripts: { fam: string; script: string }[];
  try {
    scripts = resolveScripts(only);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    process.exitCode = 2;
    return;
  }

  if (list) {
    for (const { fam, script } of scripts) process.stdout.write(`  ${fam.padEnd(10)} scripts/${script}\n`);
    return;
  }

  process.stderr.write(`Vendoring ${scripts.length} model families into shells/web/public/models (skip what's present)\n`);
  const failed: string[] = [];
  for (const { fam, script } of scripts) {
    process.stderr.write(`\n── ${fam} ──\n`);
    const r = spawnSync('node', [join(ROOT, 'scripts', script)], { stdio: 'inherit', cwd: ROOT });
    if (r.status !== 0) failed.push(fam);
  }

  // Completeness against the committed listing (depth isn't in the manifest, so
  // it's reported per-family above but doesn't count as "missing" here).
  let missing: string[] = [];
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { url: string }[];
    missing = missingFromManifest(MODELS_DIR, manifest);
  } catch { /* no manifest - skip the cross-check */ }

  process.stderr.write(`\n${'─'.repeat(40)}\n`);
  process.stderr.write(`On disk: ${gb(dirBytes(MODELS_DIR))} in shells/web/public/models\n`);
  if (failed.length) process.stderr.write(`FAILED families: ${failed.join(', ')} (re-run to resume - fetched files are skipped)\n`);
  if (missing.length) process.stderr.write(`Manifest files still missing: ${missing.length} (e.g. ${missing[0]})\n`);
  if (!failed.length && !missing.length) process.stderr.write('Complete: every manifest file is present.\n');
  process.exitCode = failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
