#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * pack-core - build the PUBLISHABLE @lolly-tools/core npm package.
 *
 * The checked-in packages/core/package.json points `exports` at ./src/*.ts,
 * because every in-repo consumer (engine, packages/node-shell, shells/*) imports
 * the SOURCE - Node type-strips it, Vite bundles it, and editing a src file is
 * visible to `npm test` with no build step. That layout cannot be published:
 * Node refuses type-stripping for anything under node_modules, so a raw-.ts
 * tarball installs but will not run.
 *
 * So the published artifact is built here instead, and the workspace keeps its
 * no-build dev loop untouched. Under dist/core-pack/:
 *   - pkg/                          the staged package: compiled ESM + .d.ts,
 *                                   schema/*.json, a GENERATED package.json
 *                                   whose exports point at the compiled files,
 *                                   README.md, LICENSE
 *   - lolly-tools-core-<v>.tgz      npm pack of pkg/
 *   - manifest.json                 version, git commit, content hash (same
 *                                   shape/hashing as pack-engine.ts)
 *   - smoke/                        a throwaway consumer that installs the
 *                                   tarball and proves it RUNS and TYPES
 *
 * The smoke test is the point of the script: it fails loudly if the tarball is
 * not actually usable from a plain `npm i`.
 *
 *   node scripts/pack-core.ts
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO, 'dist', 'core-pack');
const PKG = join(OUT, 'pkg');
const SMOKE = join(OUT, 'smoke');
const CORE = join(REPO, 'packages', 'core');
const TSC = join(REPO, 'node_modules', '.bin', 'tsc');

const run = (cmd: string, args: string[], cwd: string): string =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

/** Every file under `dir` (sorted), hashing "<relpath>\0<content>" - deterministic
 *  and modification-sensitive. Mirrors pack-engine.ts so the two bundles read alike. */
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

const sha256File = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

function gitCommit(): string {
  try {
    return run('git', ['rev-parse', 'HEAD'], REPO).trim();
  } catch {
    return 'unknown';
  }
}

/** Walk `dir`, applying `fn` to every file whose name ends with `ext`. */
function forEachFile(dir: string, ext: string, fn: (path: string) => void): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) forEachFile(full, ext, fn);
    else if (name.endsWith(ext)) fn(full);
  }
}

// ── 1. compile ───────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
run(TSC, ['-p', join(CORE, 'tsconfig.build.json')], REPO);

// `rewriteRelativeImportExtensions` rewrites the source's explicit `.ts`
// specifiers in the emitted .js but NOT in the emitted .d.ts (TS 5.9), which
// would leave a consumer's `tsc` resolving files that do not ship. Rewrite the
// declarations here: relative specifiers only, `.ts` only.
const TS_SPEC = /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\.ts\2/g;
const leftover: string[] = [];
forEachFile(PKG, '.d.ts', (f) => {
  const src = readFileSync(f, 'utf8');
  const out = src.replace(TS_SPEC, (_m, kw, q, spec) => `${kw}${q}${spec}.js${q}`);
  if (out !== src) writeFileSync(f, out);
  // The type smoke below runs with --skipLibCheck (the repo's own node_modules
  // leaks @types into a scratch dir nested under it), and skipLibCheck also
  // suppresses "cannot find module" INSIDE a .d.ts - i.e. exactly this failure.
  // So assert the invariant here instead of hoping tsc reports it.
  if (TS_SPEC.test(out)) leftover.push(relative(PKG, f));
  TS_SPEC.lastIndex = 0;
});
if (leftover.length) throw new Error(`.d.ts still importing .ts specifiers: ${leftover.join(', ')}`);

// ── 2. stage the generated package.json + docs ───────────────────────────────
const srcPkg = JSON.parse(readFileSync(join(CORE, 'package.json'), 'utf8'));
const VERSION: string = srcPkg.version;

/** Each code subpath as `{ types, default }`, types first (Node/TS pick the
 *  first matching condition). Derived from the checked-in exports map so a new
 *  subpath there is published automatically. */
const exportsMap: Record<string, unknown> = {};
for (const [subpath, target] of Object.entries(srcPkg.exports as Record<string, string>)) {
  if (target.endsWith('.json')) {
    exportsMap[subpath] = target;
  } else {
    const base = target.replace(/\.ts$/, '');
    exportsMap[subpath] = { types: `${base}.d.ts`, default: `${base}.js` };
  }
}

writeFileSync(
  join(PKG, 'package.json'),
  `${JSON.stringify(
    {
      name: srcPkg.name,
      version: VERSION,
      description: srcPkg.description,
      license: srcPkg.license,
      keywords: srcPkg.keywords,
      repository: { type: 'git', url: 'git+https://github.com/lolly-tools/lolly.git', directory: 'packages/core' },
      homepage: 'https://lolly.tools',
      bugs: 'https://github.com/lolly-tools/lolly/issues',
      type: 'module',
      sideEffects: false,
      main: './src/index.js',
      types: './src/index.d.ts',
      exports: exportsMap,
      files: ['src', 'schema', 'README.md', 'LICENSE'],
      dependencies: srcPkg.dependencies,
      publishConfig: { access: 'public', provenance: true },
    },
    null,
    2,
  )}\n`,
);
copyFileSync(join(CORE, 'README.md'), join(PKG, 'README.md'));
copyFileSync(join(REPO, 'LICENSE'), join(PKG, 'LICENSE'));

// ── 3. pack ──────────────────────────────────────────────────────────────────
// npm pack prints the produced filename on its last stdout line.
const tgzName = run('npm', ['pack', '--pack-destination', OUT], PKG).trim().split('\n').pop() as string;
const tgz = join(OUT, tgzName);

writeFileSync(
  join(OUT, 'manifest.json'),
  `${JSON.stringify(
    {
      generatedFrom: gitCommit(),
      note: 'Publish bundle for @lolly-tools/core (compiled ESM + .d.ts). contentHash is over the staged files; tarballSha256 is informational (gzip is not reproducible).',
      core: { version: VERSION, tarball: tgzName, tarballSha256: sha256File(tgz), contentHash: contentHash(PKG) },
    },
    null,
    2,
  )}\n`,
);

// ── 4. smoke: install the tarball into a bare project and use it ─────────────
// Types-first: `type: module` so nodenext resolves the ESM-only package from the
// check file (a CJS-mode .ts would fail with TS1479 before it ever resolved).
mkdirSync(SMOKE, { recursive: true });
run('npm', ['init', '-y'], SMOKE);
writeFileSync(join(SMOKE, 'package.json'), '{ "name": "core-smoke", "private": true, "type": "module" }\n');
run('npm', ['i', '--no-audit', '--no-fund', tgz], SMOKE);

const example = readFileSync(join(CORE, 'examples', 'hello-badge', 'tool.json'), 'utf8');
writeFileSync(
  join(SMOKE, 'smoke.mjs'),
  `import assert from 'node:assert/strict';
import { createMockHost, validateTool, CONTRACT_VERSION } from '@lolly-tools/core';
import { KNOWN_FINISH_KINDS } from '@lolly-tools/core/host-v1';
import toolSchema from '@lolly-tools/core/schema/tool.schema.json' with { type: 'json' };

assert.equal(typeof createMockHost, 'function');
assert.equal(typeof createMockHost().log, 'function');
assert.equal(CONTRACT_VERSION, '1');
assert.ok(Array.isArray(KNOWN_FINISH_KINDS) && KNOWN_FINISH_KINDS.length > 0);
assert.equal(typeof toolSchema.$schema, 'string');
assert.equal(validateTool({}).valid, false);
assert.equal(validateTool(${example.trim()}).valid, true);
console.log('smoke: runtime ok');
`,
);
run('node', ['smoke.mjs'], SMOKE);

writeFileSync(
  join(SMOKE, 'check.ts'),
  // Every code subpath, so a broken exports entry or an unresolvable .d.ts is
  // a compile error here rather than a consumer's problem.
  `import { createMockHost, validateTool, defineTool } from '@lolly-tools/core';
import type { HostV1, ToolManifest } from '@lolly-tools/core';
import type { HostV1 as ContractHost } from '@lolly-tools/core/contract';
import type { Capability } from '@lolly-tools/core/host-v1';
import type { CanvasOp } from '@lolly-tools/core/canvas-op-v1';
import { mulberry32 } from '@lolly-tools/core/canvas-op-testkit';
import type { Finding } from '@lolly-tools/core/preflight';
import type { Extension } from '@lolly-tools/core/extension-v1';

const host: HostV1 = createMockHost();
const manifest: ToolManifest = defineTool({
  id: 'hello-badge', name: 'Hello Badge', version: '1.0.0', engineVersion: '1.0.0',
  status: 'community', render: { width: 600, height: 400, formats: ['svg'] },
  inputs: [{ id: 'name', type: 'text', label: 'Name' }],
});
export const ok: boolean = validateTool(manifest).valid && typeof host.log === 'function';
export type Used = Capability | CanvasOp | Finding | Extension;
`,
);
run(
  TSC,
  [
    '--noEmit',
    '--module', 'nodenext',
    '--moduleResolution', 'nodenext',
    '--target', 'es2023',
    '--lib', 'es2023,dom,dom.iterable',
    '--strict',
    '--skipLibCheck', // the package's OWN .d.ts graph still has to RESOLVE; this
    // only suppresses type errors inside ajv/node declarations the bare smoke
    // project does not install.
    'check.ts',
  ],
  SMOKE,
);

const unpacked = readdirSync(PKG, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .reduce((n, d) => n + statSync(join(d.parentPath, d.name)).size, 0);

console.log(`smoke: types ok`);
console.log(`packed → ${relative(REPO, OUT)}`);
console.log(`  ${srcPkg.name}@${VERSION}  ${tgzName}`);
console.log(`  tarball ${(statSync(tgz).size / 1024).toFixed(1)} kB · unpacked ${(unpacked / 1024).toFixed(1)} kB`);
// publishConfig.provenance is true, which only works where npm can get an OIDC
// token (GitHub Actions). A local publish must opt out explicitly or npm errors.
console.log(`\nto publish: git tag core-v${VERSION} && git push origin core-v${VERSION}   (runs .github/workflows/publish-core.yml)`);
console.log(`  or locally: npm publish --access public --provenance=false ${relative(REPO, PKG)}`);
