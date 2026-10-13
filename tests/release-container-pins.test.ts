// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = path.join(root, 'shells/tauri-desktop/release');
const pinnedReference = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/;
const localImage = `sha256:${'a'.repeat(64)}`;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

test('release builder defaults use immutable image references', async () => {
  for (const name of ['deb', 'deb-portable', 'rpm']) {
    const source = await readFile(path.join(release, `containers/Dockerfile.${name}`), 'utf8');
    const defaults = new Map(
      [...source.matchAll(/^ARG ([A-Z_]+)=(\S+)$/gm)].map((match) => [match[1], match[2]]),
    );
    const bases = [...source.matchAll(/^FROM (\S+)/gm)].map((match) => {
      const variable = match[1]?.match(/^\$\{([A-Z_]+)\}$/)?.[1];
      return variable ? defaults.get(variable) : match[1];
    });
    assert.ok(bases.length > 0, name);
    for (const base of bases) assert.match(base ?? '', pinnedReference, name);
    if (name === 'rpm') assert.match(defaults.get('LEAP_BASE') ?? '', pinnedReference);
  }
});

test('Flatpak builds share a pinned container matching the GNOME runtime', async () => {
  const images: string[] = [];
  for (const name of ['flatpak', 'flatpak-repackage']) {
    const source = await readFile(path.join(root, `.github/workflows/${name}.yml`), 'utf8');
    const image = source.match(/^\s+image:\s*(\S+)/m)?.[1];
    assert.match(image ?? '', pinnedReference);
    assert.match(image ?? '', /^ghcr\.io\/flathub-infra\/flatpak-github-actions:gnome-50@/);
    images.push(image ?? '');
  }
  assert.equal(images[0], images[1]);
  const manifest = await readFile(path.join(root, 'shells/tauri-desktop/flatpak/tools.lolly.Desktop.yml'), 'utf8');
  assert.match(manifest, /^runtime-version: '50'$/m);
});

type Fixture = {
  directory: string;
  run: (name: 'deb' | 'rpm', args?: string[], env?: Record<string, string>) => {
    status: number | null;
    output: string;
    calls: string[][];
  };
};

async function withFixture(work: (fixture: Fixture) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lolly-release-pins-'));
  try {
    const fixtureRelease = path.join(directory, 'shells/tauri-desktop/release');
    await Promise.all([
      mkdir(path.join(fixtureRelease, 'containers'), { recursive: true }),
      mkdir(path.join(directory, 'shells/tauri-desktop/src-tauri'), { recursive: true }),
      mkdir(path.join(directory, 'shells/tauri-desktop/rpm/out'), { recursive: true }),
      mkdir(path.join(directory, 'scripts'), { recursive: true }),
      mkdir(path.join(directory, 'bin'), { recursive: true }),
    ]);
    await Promise.all([
      ...['common.sh', 'build-deb.sh', 'build-rpm.sh', 'containers/Dockerfile.deb', 'containers/Dockerfile.rpm']
        .map((name) => copyFile(path.join(release, name), path.join(fixtureRelease, name))),
      writeFile(path.join(directory, 'shells/tauri-desktop/src-tauri/tauri.conf.json'), '{"version":"1.0.0"}'),
      writeFile(path.join(directory, 'shells/tauri-desktop/rpm/out/lolly-desktop-1.0.0.tar.zst'), ''),
      writeFile(path.join(directory, 'scripts/profile.ts'), "console.log('profile lolly-start');\n"),
    ]);
    const docker = path.join(directory, 'bin/docker');
    const pnpm = path.join(directory, 'bin/pnpm');
    await writeFile(docker, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.RELEASE_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'image' && args[1] === 'inspect') {
  if (args.includes('--format')) { console.log(${JSON.stringify(localImage)}); process.exit(0); }
  process.exit(process.env.RELEASE_TEST_CACHED === '1' ? 0 : 1);
}
process.exit(args[0] === 'build' && process.env.RELEASE_TEST_BUILD_OK === '1' ? 0 : 17);
`);
    await writeFile(pnpm, '#!/usr/bin/env bash\nexit 17\n');
    await Promise.all([chmod(docker, 0o755), chmod(pnpm, 0o755)]);
    let invocation = 0;
    await work({
      directory,
      run(name, args = [], env = {}) {
        const log = path.join(directory, `calls-${invocation++}.jsonl`);
        const result = spawnSync('bash', [path.join(fixtureRelease, `build-${name}.sh`), ...args], {
          encoding: 'utf8',
          timeout: 15_000,
          env: {
            ...process.env,
            LOLLY_DEB_IMAGE: '',
            LOLLY_RPM_BASE: '',
            LOLLY_BUILD_CACHE: path.join(directory, 'cache'),
            LOLLY_RELEASE_OUT: path.join(directory, 'out'),
            RELEASE_TEST_LOG: log,
            PATH: `${path.join(directory, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
            ...env,
          },
        });
        assert.ifError(result.error);
        const calls = (existsSync(log) ? readFileSync(log, 'utf8') : '')
          .trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as string[]);
        return { status: result.status, output: result.stdout + result.stderr, calls };
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('RPM targets select their pinned bases and run the resolved builder image', async () => {
  await withFixture(async ({ directory, run }) => {
    const recipe = await readFile(path.join(release, 'containers/Dockerfile.rpm'), 'utf8');
    for (const [target, argument] of [['tumbleweed', 'BASE'], ['leap16', 'LEAP_BASE']]) {
      const base = recipe.match(new RegExp(`^ARG ${argument}=(\\S+)$`, 'm'))?.[1];
      assert.ok(base);
      const result = run('rpm', [target ?? ''], { RELEASE_TEST_BUILD_OK: '1' });
      assert.equal(result.status, 17, result.output);
      const build = result.calls.find((call) => call[0] === 'build');
      assert.ok(build);
      assert.ok(build.includes(`BASE=${base}`));
      const expected = `lolly-rpm-${target}-${sha256(`${base}:${sha256(recipe)}`)}`;
      assert.equal(build[build.indexOf('-t') + 1], expected);
      assert.ok(result.calls.find((call) => call[0] === 'run')?.includes(localImage));
    }
    await writeFile(path.join(directory, 'shells/tauri-desktop/release/containers/Dockerfile.rpm'), `${recipe}\n# New recipe\n`);
    const changed = run('rpm', ['tumbleweed']);
    const changedBuild = changed.calls.find((call) => call[0] === 'build');
    assert.ok(changedBuild);
    assert.notEqual(changedBuild[changedBuild.indexOf('-t') + 1], `lolly-rpm-tumbleweed-${sha256(`${recipe.match(/^ARG BASE=(\S+)$/m)?.[1]}:${sha256(recipe)}`)}`);
  });
});

test('RPM accepts a digest override and refuses mutable overrides before Docker', async () => {
  await withFixture(async ({ run }) => {
    for (const base of ['opensuse/leap:16.0', `opensuse/leap@sha256:${'b'.repeat(63)}`, `opensuse/leap@sha256:${'B'.repeat(64)}`]) {
      const result = run('rpm', ['leap16'], { LOLLY_RPM_BASE: base });
      assert.equal(result.status, 1);
      assert.match(result.output, /RPM base must/);
      assert.deepEqual(result.calls, []);
    }
    const base = `registry.example:5000/reviewed/base@sha256:${'b'.repeat(64)}`;
    const result = run('rpm', ['leap16'], { LOLLY_RPM_BASE: base });
    assert.equal(result.status, 17, result.output);
    assert.ok(result.calls.find((call) => call[0] === 'build')?.includes(`BASE=${base}`));
  });
});

test('DEB refuses mutable custom builders before Docker', async () => {
  await withFixture(async ({ run }) => {
    for (const image of ['lolly-deb-builder', 'node:22-bookworm', `sha256:${'c'.repeat(63)}`, `node@sha256:${'C'.repeat(64)}`]) {
      const result = run('deb', [], { LOLLY_DEB_IMAGE: image });
      assert.equal(result.status, 1);
      assert.match(result.output, /DEB builder must/);
      assert.deepEqual(result.calls, []);
    }
  });
});

test('DEB custom builders use immutable pulls or existing local IDs', async () => {
  await withFixture(async ({ run }) => {
    const remote = `registry.example:5000/reviewed/portable@sha256:${'d'.repeat(64)}`;
    const pulled = run('deb', [], { LOLLY_DEB_IMAGE: remote });
    assert.equal(pulled.status, 17, pulled.output);
    assert.deepEqual(pulled.calls.find((call) => call[0] === 'pull'), ['pull', remote]);
    assert.ok(!pulled.calls.some((call) => call[0] === 'build'));
    const missing = run('deb', [], { LOLLY_DEB_IMAGE: localImage });
    assert.equal(missing.status, 1, missing.output);
    assert.match(missing.output, /local DEB builder image ID is unavailable/);
    assert.equal(missing.calls.length, 1);
    const cached = run('deb', [], { LOLLY_DEB_IMAGE: localImage, RELEASE_TEST_CACHED: '1' });
    assert.equal(cached.status, 17, cached.output);
    assert.ok(cached.calls.some((call) => call.includes('--format')));
    assert.ok(!cached.calls.some((call) => ['build', 'pull', 'run'].includes(call[0] ?? '')));
  });
});

test('DEB default builder cache changes with the pinned recipe', async () => {
  await withFixture(async ({ directory, run }) => {
    const recipe = await readFile(path.join(release, 'containers/Dockerfile.deb'), 'utf8');
    const initial = run('deb');
    assert.equal(initial.status, 17, initial.output);
    const build = initial.calls.find((call) => call[0] === 'build');
    assert.ok(build);
    assert.equal(build[build.indexOf('-t') + 1], `lolly-deb-builder-${sha256(recipe)}`);
    await writeFile(path.join(directory, 'shells/tauri-desktop/release/containers/Dockerfile.deb'), `${recipe}\n# New recipe\n`);
    const changed = run('deb');
    const changedBuild = changed.calls.find((call) => call[0] === 'build');
    assert.ok(changedBuild);
    assert.notEqual(changedBuild[changedBuild.indexOf('-t') + 1], build[build.indexOf('-t') + 1]);
  });
});
