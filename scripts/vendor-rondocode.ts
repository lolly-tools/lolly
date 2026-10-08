#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Re-vendor rondocode into packages/rondo/upstream at a given commit, then
 * re-apply Lolly's patch series.
 *
 *   node scripts/vendor-rondocode.ts --commit=<sha> [--from=<local clone>]
 *
 * Without --from it clones github.com/vijaypemmaraju/rondocode into a temporary
 * directory. The copy set is fixed here and recorded in packages/rondo/UPSTREAM.md;
 * tests, training data, the desktop shell and the Rust crate stay out. Patches in
 * packages/rondo/patches/ apply in file-name order with `git apply`, and a patch
 * that no longer applies stops the run with the tree left as upstream wrote it,
 * so the failing patch can be refreshed against the new source.
 *
 * Afterwards: `node scripts/build-rondo.ts --golden`, then
 * `LOLLY_RONDO_FULL=1 node --test packages/rondo/test/rondo.test.ts`.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = path.join(repo, 'packages/rondo');
const dest = path.join(pkg, 'upstream');
const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const commit = arg('commit');
if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
  console.error('usage: node scripts/vendor-rondocode.ts --commit=<40-character sha> [--from=<local clone>]');
  process.exit(2);
}

const git = (cwd: string, ...a: string[]): string => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

let src = arg('from');
let temp: string | null = null;
if (!src) {
  temp = mkdtempSync(path.join(tmpdir(), 'rondocode-'));
  src = path.join(temp, 'rondocode');
  git(temp, 'clone', '--quiet', 'https://github.com/vijaypemmaraju/rondocode.git', src);
}
try {
  git(src, 'checkout', '--quiet', commit);
  const date = git(src, 'log', '-1', '--format=%cs', commit);

  /** [from, to] pairs relative to the upstream root; directories copy whole minus tests. */
  const COPY: [string, string][] = [
    ['LICENSE', 'LICENSE'],
    ['NOTICE.md', 'NOTICE.md'],
    ['README.md', 'README.md'],
    ['tsconfig.base.json', 'tsconfig.base.json'],
    ['packages/engine/src', 'packages/engine/src'],
    ['packages/engine/package.json', 'packages/engine/package.json'],
    ['packages/pattern/src', 'packages/pattern/src'],
    ['packages/pattern/package.json', 'packages/pattern/package.json'],
    ['packages/rondo/src', 'packages/rondo/src'],
    ['packages/rondo/examples', 'packages/rondo/examples'],
    ['packages/rondo/package.json', 'packages/rondo/package.json'],
    ['packages/app', 'packages/app'],
    ['packages/server/src/render-runner.ts', 'packages/server/src/render-runner.ts'],
  ];
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const [from, to] of COPY) {
    const abs = path.join(src, from);
    if (!existsSync(abs)) throw new Error(`upstream no longer has ${from}; update the copy set`);
    cpSync(abs, path.join(dest, to), {
      recursive: true,
      filter: (p) => !/[\\/](?:test|node_modules|dist)(?:[\\/]|$)/.test(path.relative(src as string, p)),
    });
  }

  const patchDir = path.join(pkg, 'patches');
  const patches = existsSync(patchDir) ? readdirSync(patchDir).filter((f) => f.endsWith('.patch')).sort() : [];
  for (const p of patches) {
    execFileSync('git', ['apply', '--whitespace=nowarn', `--directory=${path.relative(repo, dest)}`, path.join(patchDir, p)], { cwd: repo, stdio: 'inherit' });
    console.log(`applied ${p}`);
  }

  const ext = path.join(pkg, 'src/extension.ts');
  writeFileSync(ext, readFileSync(ext, 'utf8').replace(/export const UPSTREAM_COMMIT = '[0-9a-f]{40}';/, `export const UPSTREAM_COMMIT = '${commit}';`));
  const up = path.join(pkg, 'UPSTREAM.md');
  writeFileSync(
    up,
    readFileSync(up, 'utf8')
      .replace(/^\*\*Commit:\*\* `[0-9a-f]{40}`.*$/m, `**Commit:** \`${commit}\` (${date})`),
  );
  console.log(`vendored rondocode ${commit.slice(0, 12)} (${date}) with ${patches.length} patch(es).`);
  console.log('Next: node scripts/build-rondo.ts --golden, then LOLLY_RONDO_FULL=1 node --test packages/rondo/test/rondo.test.ts');
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true });
}
