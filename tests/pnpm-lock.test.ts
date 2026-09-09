// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { stringify } from 'yaml';
import { readPnpmLock } from '../scripts/lib/pnpm-lock.ts';

test('SBOM graph follows workspace links, aliases, peers and optional dependencies', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-pnpm-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'pnpm-lock.yaml'), stringify({
    lockfileVersion: '9.0',
    importers: {
      '.': { dependencies: { local: { version: 'link:packages/local' }, alias: { version: 'actual@1.0.0' } }, devDependencies: { dev: { version: '1.0.0' } } },
      'packages/local': { dependencies: { app: { version: '1.0.0(peer@2.0.0)' } } },
    },
    packages: { 'actual@1.0.0': {}, 'app@1.0.0': { resolution: { integrity: 'sha512-example' } }, 'peer@2.0.0': {}, 'optional@3.0.0': {}, 'dev@1.0.0': {}, 'app@2.0.0': {} },
    snapshots: {
      'actual@1.0.0': {},
      'app@1.0.0(peer@2.0.0)': { dependencies: { peer: '2.0.0' }, optionalDependencies: { optional: '3.0.0' } },
      'peer@2.0.0': {}, 'optional@3.0.0': {}, 'dev@1.0.0': { dependencies: { app: '2.0.0' } }, 'app@2.0.0': {},
    },
  }));
  mkdirSync(join(root, 'security'));
  writeFileSync(join(root, 'security/npm-licenses.json'), JSON.stringify({ 'optional@3.0.0': 'MIT' }));
  // Installed metadata for a different version must not contaminate the SBOM.
  mkdirSync(join(root, 'node_modules/dev'), { recursive: true });
  writeFileSync(join(root, 'node_modules/dev/package.json'), JSON.stringify({ version: '2.0.0', license: 'MIT' }));
  const { packages } = readPnpmLock(root);
  for (const name of ['actual', 'app', 'peer', 'optional']) assert.equal(packages[`node_modules/${name}`]?.dev, false, name);
  assert.equal(packages['node_modules/dev']?.dev, true);
  assert.equal(packages['node_modules/dev']?.license, undefined);
  assert.equal(packages['node_modules/optional']?.license, 'MIT');
  assert.equal(packages['node_modules/app']?.integrity, 'sha512-example');
  assert.equal(Object.values(packages).filter(pkg => pkg.version === '2.0.0' && pkg.dev).length, 1);
});

test('unsupported lockfile formats fail instead of generating an incomplete SBOM', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-pnpm-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\nimporters: {}\n');
  assert.throws(() => readPnpmLock(root), /Unsupported pnpm lockfile/);
});
