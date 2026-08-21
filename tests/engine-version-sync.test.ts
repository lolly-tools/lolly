// SPDX-License-Identifier: MPL-2.0
/**
 * Guard: engine/package.json `version` must equal `ENGINE_VERSION` in
 * engine/src/version.ts.
 *
 * The published package version IS the engine version (see engine/package.json's
 * `//version` note), and scripts/pack-engine.ts REFUSES to pack when they differ.
 * That guard only fires at pack time, which is downstream and rare - so the two
 * silently drifted (package.json sat at 1.61.0 while ENGINE_VERSION advanced past
 * 1.100), and every attempt to re-pin a vendored consumer (e.g. the lolly-work
 * control plane) was blocked with no signal in normal CI. This test moves that
 * check into the everyday suite so a version bump that touches only one of the two
 * files fails fast, right next to the change.
 *
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(HERE, '..', 'engine');

function engineVersionTs(): string {
  const src = readFileSync(resolve(ENGINE, 'src', 'version.ts'), 'utf8');
  const m = src.match(/ENGINE_VERSION\s*=\s*'([^']+)'/);
  assert.ok(m, 'ENGINE_VERSION not found in engine/src/version.ts');
  return m![1]!;
}

function enginePackageVersion(): string {
  return JSON.parse(readFileSync(resolve(ENGINE, 'package.json'), 'utf8')).version as string;
}

test('engine/package.json version tracks ENGINE_VERSION', () => {
  const pkg = enginePackageVersion();
  const src = engineVersionTs();
  assert.equal(
    pkg,
    src,
    `engine/package.json version (${pkg}) != ENGINE_VERSION (${src}) - bump both together. ` +
      'The published package version IS the engine version; pack-engine.ts refuses to pack when they differ.',
  );
});
