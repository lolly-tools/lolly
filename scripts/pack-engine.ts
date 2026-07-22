#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * pack-engine — produce the distributable, checksummed engine bundle that
 * downstream consumers pin against (see plans/commercial-build.md §3.4: the
 * engine is consumed as a pinned, UNMODIFIED dependency; this script is the
 * publish half, the consumer's verify step is the compliance half).
 *
 * It emits, under dist/engine-pack/:
 *   - lolly-tools-core-<v>.tgz  (npm pack of packages/core)
 *   - lolly-engine-<v>.tgz      (npm pack of engine)
 *   - schemas/                  (repo-root JSON schemas the engine imports via
 *                                `../../schemas/*` — they live outside the engine
 *                                package, so they travel alongside it)
 *   - manifest.json             (versions, git commit, and a CONTENT hash per
 *                                package/file — the pin the consumer verifies)
 *
 * The content hash is over the packed FILES (not the .tgz, which gzip makes
 * non-reproducible), so a consumer that vendors the extracted source can detect
 * any modification byte-for-byte.
 *
 * Pure packaging — no knowledge of any consumer. The engine stays native TS
 * here; a consumer that runs .ts (Node type-stripping) vendors the source via a
 * symlinked `file:` dep so the realpath sits outside node_modules. A future
 * npm-registry publish of compiled JS is a separate evolution (needs a bundler,
 * which the no-build engine deliberately omits) — tracked, not blocking.
 *
 *   node scripts/pack-engine.ts
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO, 'dist', 'engine-pack');

/** ENGINE_VERSION is the single source of truth; the package version must track it. */
function engineVersion(): string {
  const src = readFileSync(join(REPO, 'engine', 'src', 'version.ts'), 'utf8');
  const m = src.match(/ENGINE_VERSION\s*=\s*'([^']+)'/);
  if (!m) throw new Error('could not read ENGINE_VERSION from engine/src/version.ts');
  return m[1] as string;
}

function pkgVersion(pkgDir: string): string {
  return JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version as string;
}

/** Every file under `dir` (sorted), hashing "<relpath>\0<content>" — deterministic
 *  and modification-sensitive; excludes nothing (a pin covers the whole tree). */
function contentHash(dir: string): string {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const h = createHash('sha256');
  for (const f of files.sort()) {
    h.update(relative(dir, f).split('\\').join('/'));
    h.update('\0');
    h.update(readFileSync(f));
    h.update('\0');
  }
  return h.digest('hex');
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function pack(pkgDir: string): string {
  // npm pack prints the produced filename on its last stdout line.
  const out = execFileSync('npm', ['pack', '--pack-destination', OUT], { cwd: pkgDir, encoding: 'utf8' });
  const file = out.trim().split('\n').pop() as string;
  return join(OUT, file);
}

/** Hash the tarball's EXTRACTED content — exactly what a consumer vendors, so
 *  the pin and the verify step compare identical trees (not the fuller source
 *  dir, which carries test/ + tsconfig the tarball omits). */
function extractedContentHash(tgz: string): string {
  const tmp = join(OUT, `.x-${Math.abs(hashStr(tgz))}`);
  mkdirSync(tmp, { recursive: true });
  execFileSync('tar', ['xzf', tgz, '-C', tmp, '--strip-components=1']);
  const hash = contentHash(tmp);
  rmSync(tmp, { recursive: true, force: true });
  return hash;
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function gitCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
const ENGINE_V = engineVersion();
const enginePkgV = pkgVersion(join(REPO, 'engine'));
if (enginePkgV !== ENGINE_V) {
  throw new Error(`engine/package.json version ${enginePkgV} != ENGINE_VERSION ${ENGINE_V} — sync them before packing`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'schemas'), { recursive: true });

const coreDir = join(REPO, 'packages', 'core');
const engineDir = join(REPO, 'engine');
const coreV = pkgVersion(coreDir);

const coreTgz = pack(coreDir);
const engineTgz = pack(engineDir);

// The repo-root schemas the engine imports at `../../schemas/*` — copy them so
// the bundle is self-contained (a consumer vendors them beside the engine).
const schemaHashes: Record<string, string> = {};
for (const name of readdirSync(join(REPO, 'schemas')).filter((n) => n.endsWith('.json'))) {
  copyFileSync(join(REPO, 'schemas', name), join(OUT, 'schemas', name));
  schemaHashes[name] = sha256File(join(OUT, 'schemas', name));
}

const manifest = {
  generatedFrom: gitCommit(),
  note: 'Pin manifest — a consumer verifies vendored content against contentHash. tarballSha256 is informational (gzip is not reproducible).',
  core: { version: coreV, tarball: coreTgz.split('/').pop(), tarballSha256: sha256File(coreTgz), contentHash: extractedContentHash(coreTgz) },
  engine: { version: ENGINE_V, tarball: engineTgz.split('/').pop(), tarballSha256: sha256File(engineTgz), contentHash: extractedContentHash(engineTgz) },
  schemas: schemaHashes,
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`packed → ${relative(REPO, OUT)}`);
console.log(`  @lolly-tools/core@${coreV}  content ${manifest.core.contentHash.slice(0, 12)}…`);
console.log(`  @lolly/engine@${ENGINE_V}    content ${manifest.engine.contentHash.slice(0, 12)}…`);
console.log(`  schemas: ${Object.keys(schemaHashes).join(', ')}`);
