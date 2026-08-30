// SPDX-License-Identifier: MPL-2.0
/**
 * The @lolly-tools/core npm package is BUILDABLE and USABLE.
 *
 * `scripts/pack-core.ts` compiles the package, packs it, installs the tarball
 * into a scratch project and asserts it both runs and type-checks there - the
 * whole point being that the checked-in `exports` (raw `./src/*.ts`, which the
 * workspace consumes with no build step) can never be published as-is, because
 * Node refuses type-stripping under node_modules.
 *
 * GATED: the script runs `tsc` twice and two `npm install`s (~1 min, network on
 * a cold cache), so a bare `npm test` skips it. Set `CORE_PACK=1` to run.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO, 'dist', 'core-pack');

test('pack-core builds an installable, usable @lolly-tools/core', { skip: process.env.CORE_PACK !== '1' && 'set CORE_PACK=1 to run (runs tsc + npm install)' }, () => {
  // Throws on any failure, INCLUDING the runtime + types smoke inside it.
  execFileSync('node', [join(REPO, 'scripts', 'pack-core.ts')], { cwd: REPO, stdio: 'inherit' });

  const version = JSON.parse(readFileSync(join(REPO, 'packages', 'core', 'package.json'), 'utf8')).version;
  assert.ok(existsSync(join(OUT, `lolly-tools-core-${version}.tgz`)), 'tarball for the current version');

  const staged = JSON.parse(readFileSync(join(OUT, 'pkg', 'package.json'), 'utf8'));
  // The published exports must point at the COMPILED files, not the source.
  for (const [subpath, target] of Object.entries(staged.exports as Record<string, unknown>)) {
    if (subpath.startsWith('./schema/')) continue;
    const t = target as { types: string; default: string };
    assert.match(t.types, /\.d\.ts$/, `${subpath} types`);
    assert.match(t.default, /\.js$/, `${subpath} default`);
    assert.ok(existsSync(join(OUT, 'pkg', t.default)), `${subpath} default file exists`);
  }
  // Every subpath the workspace declares stays published.
  const declared = Object.keys(JSON.parse(readFileSync(join(REPO, 'packages', 'core', 'package.json'), 'utf8')).exports);
  assert.deepEqual(Object.keys(staged.exports), declared);
});
