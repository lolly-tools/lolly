// SPDX-License-Identifier: MPL-2.0
/**
 * WebGPU qualification builds (plan 295 P0b, scripts/webgpu-qualification.ts). The
 * release gate refuses every packaged build until the supported-environment table is
 * published, and the table needs packaged builds to fill it in. A qualification build
 * is the explicit way past the gate: asked for by name, logged, never signed, marked,
 * refused on a tag and refused by every tool that publishes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MARKER_FILE, QUALIFICATION_ENV, assertNoMarkedBuild, assertNotQualificationBuild, assertQualificationAllowed,
  isQualificationBuild, markedBuilds, writeMarker,
} from '../scripts/webgpu-qualification.ts';

const PUBLIC_JWK = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'test-public-x', y: 'test-public-y' });

test('the switch is explicit: 1 or nothing, and anything else is refused rather than guessed', () => {
  assert.equal(isQualificationBuild({}), false);
  assert.equal(isQualificationBuild({ [QUALIFICATION_ENV]: '' }), false);
  assert.equal(isQualificationBuild({ [QUALIFICATION_ENV]: '0' }), false);
  assert.equal(isQualificationBuild({ [QUALIFICATION_ENV]: '1' }), true);
  assert.throws(() => isQualificationBuild({ [QUALIFICATION_ENV]: 'true' }), /must be 1/);
});

test('a tag is a release, so a qualification build is refused on one', () => {
  assert.doesNotThrow(() => assertQualificationAllowed({ GITHUB_REF: 'refs/heads/main', GITHUB_REF_TYPE: 'branch' }));
  assert.throws(() => assertQualificationAllowed({ GITHUB_REF_TYPE: 'tag', GITHUB_REF: 'refs/tags/v1.2.0' }), /tag run/);
  assert.throws(() => assertQualificationAllowed({ GITHUB_REF: 'refs/tags/v1.2.0' }), /tag run/);
});

test('a marked build is found where release tools look for it, and refused', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-qualification-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(markedBuilds(dir), []);
  assert.doesNotThrow(() => assertNoMarkedBuild(dir, 'publishing'));
  const path = writeMarker(join(dir, 'lolly-deb'), ['no row for Firefox'], { GITHUB_SHA: 'abc123', GITHUB_RUN_ID: '42', GITHUB_REPOSITORY: 'lolly-tools/lolly' });
  const text = readFileSync(path, 'utf8');
  assert.match(text, /^WebGPU qualification build\. Not for release\./);
  assert.match(text, /no row for Firefox/);
  assert.match(text, /Commit: abc123/);
  assert.match(text, /actions\/runs\/42/);
  assert.deepEqual(markedBuilds(dir), [join(dir, 'lolly-deb')]);
  assert.throws(() => assertNoMarkedBuild(dir, 'writing updater manifests'), new RegExp(`Refused: writing updater manifests[\\s\\S]*${MARKER_FILE}`));
  assert.throws(() => assertNotQualificationBuild({ [QUALIFICATION_ENV]: '1' }, 'the YunoHost release'), /Refused: the YunoHost release/);
  assert.doesNotThrow(() => assertNotQualificationBuild({}, 'the YunoHost release'));
});

test('the marker command line marks and refuses', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-qualification-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cli = (...args: string[]) => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/webgpu-qualification.ts', import.meta.url)), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(cli('refuse', dir).status, 0);
  assert.equal(cli('mark', join(dir, 'out')).status, 0);
  assert.equal(existsSync(join(dir, 'out', MARKER_FILE)), true);
  const refused = cli('refuse', dir);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Refused/);
  assert.equal(cli('nonsense', dir).status, 2);
});

/**
 * A scratch tree with the release wrapper, the gate (WebGPU required, no table), a
 * signing script that records being reached, and a fake pnpm that records its
 * arguments and the signing environment it was given.
 */
function releaseTree(): { dir: string; run(target: string, env?: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> } {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-qualification-build-')));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'shells', 'web', 'src'), { recursive: true });
  mkdirSync(join(dir, 'bin'), { recursive: true });
  for (const file of ['build-release-web.ts', 'webgpu-release-gate.ts', 'webgpu-qualification.ts']) {
    writeFileSync(join(dir, 'scripts', file), readFileSync(new URL(`../scripts/${file}`, import.meta.url)));
  }
  writeFileSync(join(dir, 'shells', 'web', 'src', 'main.ts'), "import { startWebGpuCheck } from './lib/webgpu/device.ts';\nvoid startWebGpuCheck();\n");
  writeFileSync(join(dir, 'scripts', 'sign-catalog.ts'), "import { writeFileSync } from 'node:fs'; writeFileSync('signing-reached', 'yes'); process.exit(77);\n");
  const pnpm = join(dir, 'bin', 'pnpm');
  writeFileSync(pnpm, [
    '#!/bin/sh',
    'printf "%s\\n" "$*" >> pnpm-calls.txt',
    'printf "key=%s pin=%s release=%s trust=%s\\n" "$LOLLY_CATALOG_SIGNING_KEY" "$VITE_CATALOG_PUBLIC_KEY_JWK" "$LOLLY_RELEASE_BUILD" "$VITE_CATALOG_TRUST_MODE" >> pnpm-env.txt',
    '',
  ].join('\n'));
  chmodSync(pnpm, 0o755);
  return {
    dir,
    run: (target, env = {}) => spawnSync(process.execPath, [join(dir, 'scripts', 'build-release-web.ts'), target], {
      cwd: dir, encoding: 'utf8', timeout: 10_000,
      env: { PATH: `${join(dir, 'bin')}:${process.env.PATH}`, LOLLY_CATALOG_SIGNING_KEY: 'test-only', VITE_CATALOG_PUBLIC_KEY_JWK: PUBLIC_JWK, LOLLY_RELEASE_BUILD: '1', ...env },
    }),
  };
}

const posix = process.platform === 'win32' ? 'the fake pnpm is a POSIX shell script' : false;

test('a qualification build skips the gate, signs nothing, builds unsigned and marks the frontend', { skip: posix }, (t) => {
  const tree = releaseTree();
  t.after(() => rmSync(tree.dir, { recursive: true, force: true }));
  const result = tree.run('tauri-desktop', { [QUALIFICATION_ENV]: '1', GITHUB_ACTIONS: 'true' });
  assert.equal(result.status, 0, String(result.stderr));
  assert.match(String(result.stderr), /WebGPU qualification build[\s\S]*release gate is skipped[\s\S]*supported-environments\.md does not exist/);
  assert.match(String(result.stdout), /::warning title=WebGPU qualification build::/);
  assert.equal(existsSync(join(tree.dir, 'signing-reached')), false, 'nothing is signed');
  assert.equal(readFileSync(join(tree.dir, 'pnpm-calls.txt'), 'utf8'), '-C shells/tauri-desktop run build:frontend\n', 'the ordinary unsigned frontend build');
  assert.equal(readFileSync(join(tree.dir, 'pnpm-env.txt'), 'utf8'), 'key= pin= release= trust=\n', 'no signing key, pin or release mode reaches the build');
  const marker = readFileSync(join(tree.dir, 'shells', 'tauri-desktop', 'dist', MARKER_FILE), 'utf8');
  assert.match(marker, /Not for release/);
});

test('a qualification build is refused on a tag, for the web frontend, and for an unclear switch', { skip: posix }, (t) => {
  const tree = releaseTree();
  t.after(() => rmSync(tree.dir, { recursive: true, force: true }));
  const cases: Array<[string, NodeJS.ProcessEnv, RegExp]> = [
    ['tauri-desktop', { [QUALIFICATION_ENV]: '1', GITHUB_REF_TYPE: 'tag', GITHUB_REF: 'refs/tags/v1.2.0' }, /Refused: .*tag run/],
    ['web', { [QUALIFICATION_ENV]: '1' }, /Refused: a WebGPU qualification build is for the packaged apps/],
    ['tauri-mobile', { [QUALIFICATION_ENV]: 'yes' }, /must be 1/],
  ];
  for (const [target, env, message] of cases) {
    const result = tree.run(target, env);
    assert.equal(result.status, 1, `${target} ${JSON.stringify(env)}`);
    assert.match(String(result.stderr), message);
  }
  assert.equal(existsSync(join(tree.dir, 'pnpm-calls.txt')), false, 'nothing was built');
  assert.equal(existsSync(join(tree.dir, 'signing-reached')), false, 'nothing was signed');
});

test('the YunoHost release refuses a qualification build', async () => {
  const { main } = await import('../scripts/yunohost-release.ts');
  const previous = process.env[QUALIFICATION_ENV];
  process.env[QUALIFICATION_ENV] = '1';
  try {
    await assert.rejects(main(['--version', '9.9.9']), /Refused: the YunoHost release/);
  } finally {
    if (previous === undefined) delete process.env[QUALIFICATION_ENV]; else process.env[QUALIFICATION_ENV] = previous;
  }
});

const PACKAGING = ['flatpak.yml', 'linux-arm64.yml', 'linux-rpm.yml', 'desktop-extra.yml', 'macos-intel.yml'];
const workflow = (name: string) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

test('each packaging workflow offers a qualification build only on a dispatch that asks, and marks its packages', () => {
  for (const name of PACKAGING) {
    const source = workflow(name);
    assert.match(source, /workflow_dispatch:\n(?:.*\n)*?\s+webgpu_qualification:\n\s+description: .+\n\s+required: false\n\s+type: boolean\n\s+default: false/, `${name}: the input`);
    assert.match(source, /LOLLY_WEBGPU_QUALIFICATION_BUILD: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.webgpu_qualification && '1' \|\| '' \}\}\n/, `${name}: the switch comes only from that input`);
    assert.match(source, /if: env\.LOLLY_WEBGPU_QUALIFICATION_BUILD == '1'\n\s+run: (?:\|\n\s+)?node scripts\/webgpu-qualification\.ts mark /, `${name}: the packages are marked`);
    assert.doesNotMatch(source, /A manual dispatch, such as a qualification build, is not refused/, `${name}: the old comment said the opposite of what the build does`);
  }
});

test('the release repackagers refuse a marked build', () => {
  for (const name of ['arch-repackage.yml', 'flatpak-repackage.yml']) {
    const source = workflow(name);
    assert.ok(source.includes(MARKER_FILE), `${name} looks for the marker`);
    assert.match(source, /qualification build: unsigned and not for release\."\n\s+exit 1/, `${name} stops on it`);
  }
});
