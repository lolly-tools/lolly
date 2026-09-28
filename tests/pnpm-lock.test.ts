// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { byCodepoint, readPnpmLock } from '../scripts/lib/pnpm-lock.ts';

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

// A tool that ships one native binary per platform, as @biomejs/biome does
// with its @biomejs/cli-* packages. pnpm installs only the binary that matches
// the machine, so macOS and Linux hold different node_modules for one lockfile.
const PLATFORM_LOCK = {
  lockfileVersion: '9.0',
  importers: {
    '.': {
      dependencies: { 'aa-lib': { version: '1.0.0' }, legacy: { version: '1.0.0' } },
      devDependencies: { tool: { version: '1.0.0' } },
    },
  },
  packages: {
    'aa-lib@1.0.0': { resolution: { integrity: 'sha512-AAAA' } },
    'legacy@1.0.0': { resolution: { integrity: 'sha512-BBBB' } },
    'tool@1.0.0': { resolution: { integrity: 'sha512-CCCC' } },
    'tool-darwin-arm64@1.0.0': { resolution: { integrity: 'sha512-DDDD' }, os: ['darwin'], cpu: ['arm64'] },
    'tool-linux-x64@1.0.0': { resolution: { integrity: 'sha512-EEEE' }, os: ['linux'], cpu: ['x64'], libc: ['glibc'] },
    'linux-helper@1.0.0': { resolution: { integrity: 'sha512-FFFF' } },
    'cached-binary@1.0.0': { resolution: { integrity: 'sha512-GGGG' }, os: ['win32'] },
  },
  snapshots: {
    'aa-lib@1.0.0': {},
    'legacy@1.0.0': {},
    'tool@1.0.0': { optionalDependencies: { 'tool-darwin-arm64': '1.0.0', 'tool-linux-x64': '1.0.0', 'cached-binary': '1.0.0' } },
    'tool-darwin-arm64@1.0.0': {},
    // Unrestricted itself, but installed only where its parent binary is.
    'tool-linux-x64@1.0.0': { dependencies: { 'linux-helper': '1.0.0' } },
    'linux-helper@1.0.0': {},
    'cached-binary@1.0.0': {},
  },
};
const PLATFORM_CACHE = { 'aa-lib@1.0.0': 'MIT', 'cached-binary@1.0.0': 'Apache-2.0' };
const FIXTURE_PACKAGES = ['aa-lib', 'legacy', 'tool', 'tool-darwin-arm64', 'tool-linux-x64', 'linux-helper', 'cached-binary'];
const COMMON_INSTALL = {
  'aa-lib': { license: 'MIT' },
  // The legacy array form, which npm documents as a choice between licences.
  legacy: { licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] },
  tool: { license: 'MIT' },
};
const INSTALLS: Record<'macos' | 'linux', Record<string, object>> = {
  macos: { ...COMMON_INSTALL, 'tool-darwin-arm64': { license: 'MIT' } },
  linux: { ...COMMON_INSTALL, 'tool-linux-x64': { license: 'MIT' }, 'linux-helper': { license: 'ISC' } },
};

function platformFixture(root: string): void {
  writeFileSync(join(root, 'pnpm-lock.yaml'), stringify(PLATFORM_LOCK));
  mkdirSync(join(root, 'security'), { recursive: true });
  writeFileSync(join(root, 'security/npm-licenses.json'), JSON.stringify(PLATFORM_CACHE));
}

function install(root: string, platform: 'macos' | 'linux'): void {
  for (const name of FIXTURE_PACKAGES) rmSync(join(root, 'node_modules', name), { recursive: true, force: true });
  for (const [name, manifest] of Object.entries(INSTALLS[platform])) {
    mkdirSync(join(root, 'node_modules', name), { recursive: true });
    writeFileSync(join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...manifest }));
  }
}

test('a platform binary gets the same licence whichever platform installed the tree', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-pnpm-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  platformFixture(root);
  install(root, 'macos');
  const macos = readPnpmLock(root);
  install(root, 'linux');
  const linux = readPnpmLock(root);
  assert.deepEqual(linux, macos);
  const license = (name: string) => macos.packages[`node_modules/${name}`]?.license;
  // Installed on every platform and missing from the cache: read from node_modules.
  assert.equal(license('tool'), 'MIT');
  assert.equal(license('legacy'), 'MIT OR Apache-2.0');
  // Installed only on some platforms: never read from node_modules, on any of them.
  assert.equal(license('tool-darwin-arm64'), undefined);
  assert.equal(license('tool-linux-x64'), undefined);
  assert.equal(license('linux-helper'), undefined);
  // The committed cache covers platform packages on every machine.
  assert.equal(license('cached-binary'), 'Apache-2.0');
  assert.deepEqual(macos.uncached, ['legacy@1.0.0', 'linux-helper@1.0.0', 'tool-darwin-arm64@1.0.0', 'tool-linux-x64@1.0.0', 'tool@1.0.0']);
});

test('a lockfile read without its install takes licences from the cache alone', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-pnpm-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  platformFixture(root);
  install(root, 'linux');
  const { packages } = readPnpmLock(root, 'pnpm-lock.yaml', { readInstalled: false });
  assert.equal(packages['node_modules/tool']?.license, undefined);
  assert.equal(packages['node_modules/aa-lib']?.license, 'MIT');
});

test('lock order is codepoint order, whatever the process locale', () => {
  // Collation puts `a` before `B`; codepoint order puts `B` first. Only the
  // second is the same on every machine.
  assert.deepEqual(['a', 'B', 'aa', 'z'].sort(byCodepoint), ['B', 'a', 'aa', 'z']);
  const root = mkdtempSync(join(tmpdir(), 'lolly-pnpm-'));
  try {
    writeFileSync(join(root, 'pnpm-lock.yaml'), stringify({
      lockfileVersion: '9.0',
      importers: { '.': { dependencies: { x: { version: '1.0.0-a' } } } },
      packages: { 'x@1.0.0-a': {}, 'x@1.0.0-B': {} },
      snapshots: { 'x@1.0.0-a': {}, 'x@1.0.0-B': {} },
    }));
    assert.equal(readPnpmLock(root).packages['node_modules/x']?.version, '1.0.0-B');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('build-sbom writes the same bytes on macOS and Linux installs, in any locale', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-sbom-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  platformFixture(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', license: 'MPL-2.0' }));
  // The generator finds the repository root from its own location, so run a copy.
  mkdirSync(join(root, 'scripts/lib'), { recursive: true });
  copyFileSync(fileURLToPath(new URL('../scripts/build-sbom.ts', import.meta.url)), join(root, 'scripts/build-sbom.ts'));
  copyFileSync(fileURLToPath(new URL('../scripts/lib/pnpm-lock.ts', import.meta.url)), join(root, 'scripts/lib/pnpm-lock.ts'));
  mkdirSync(join(root, 'node_modules'));
  symlinkSync(dirname(createRequire(import.meta.url).resolve('yaml/package.json')), join(root, 'node_modules/yaml'), 'dir');
  const generate = (locale: string): Buffer => {
    const run = spawnSync(process.execPath, ['scripts/build-sbom.ts'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, LANG: locale, LC_ALL: locale },
    });
    assert.equal(run.status, 0, run.stderr);
    return readFileSync(join(root, 'sbom.cdx.json'));
  };
  install(root, 'macos');
  const macos = generate('en_GB.UTF-8');
  // The second run sees the first file, so an unchanged component list keeps
  // its timestamp and any difference at all fails the byte comparison.
  install(root, 'linux');
  const linux = generate('da_DK.UTF-8');
  assert.equal(linux.toString('utf8'), macos.toString('utf8'));
  const sbom = JSON.parse(macos.toString('utf8')) as { components: { name: string; purl: string; licenses?: unknown }[] };
  // Danish collation sorts `aa` after `z`; the file keeps codepoint order.
  assert.equal(sbom.components.find(c => c.purl.startsWith('pkg:npm/'))?.name, 'aa-lib');
  assert.equal(sbom.components.find(c => c.name === 'tool-darwin-arm64')?.licenses, undefined);
  assert.deepEqual(sbom.components.find(c => c.name === 'cached-binary')?.licenses, [{ license: { id: 'Apache-2.0' } }]);
});

test('unsupported lockfile formats fail instead of generating an incomplete SBOM', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-pnpm-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\nimporters: {}\n');
  assert.throws(() => readPnpmLock(root), /Unsupported pnpm lockfile/);
});
