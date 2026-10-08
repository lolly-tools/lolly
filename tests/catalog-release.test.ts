// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { verifyCatalogEnvelope } from '../engine/src/catalog-integrity.ts';

import {
  parseReleaseFrontend,
  validateReleaseEnvironment,
} from '../scripts/build-release-web.ts';
import { REQUIRED_WEBGPU_TARGETS } from '../scripts/webgpu-release-gate.ts';

const PUBLIC_JWK = JSON.stringify({
  kty: 'EC',
  crv: 'P-256',
  x: 'test-public-x',
  y: 'test-public-y',
});

test('signed frontend entrypoints refuse before signing when WebGPU qualification is missing', (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-frontend-gate-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'shells', 'web', 'src'), { recursive: true });
  mkdirSync(join(dir, 'docs'), { recursive: true });
  for (const file of ['build-release-web.ts', 'webgpu-release-gate.ts', 'webgpu-qualification.ts']) {
    writeFileSync(join(dir, 'scripts', file), readFileSync(new URL(`../scripts/${file}`, import.meta.url)));
  }
  writeFileSync(join(dir, 'shells', 'web', 'src', 'main.ts'),
    "import { startWebGpuCheck } from './lib/webgpu/device.ts';\nvoid startWebGpuCheck();\n");
  const marker = join(dir, 'signing-reached');
  writeFileSync(join(dir, 'scripts', 'sign-catalog.ts'),
    "import { writeFileSync } from 'node:fs'; writeFileSync('signing-reached', 'yes'); process.exit(77);\n");
  const run = (target: string) => spawnSync(process.execPath, [join(dir, 'scripts', 'build-release-web.ts'), target], {
    cwd: dir, encoding: 'utf8', timeout: 10_000,
    env: { PATH: process.env.PATH, LOLLY_CATALOG_SIGNING_KEY: 'test-only', VITE_CATALOG_PUBLIC_KEY_JWK: PUBLIC_JWK },
  });
  for (const target of ['web', 'tauri-desktop', 'tauri-mobile']) {
    const result = run(target);
    assert.equal(result.status, 1, target);
    assert.match(result.stderr, /Release refused[\s\S]*supported-environments\.md/, target);
    assert.equal(existsSync(marker), false, `${target} must refuse before signing`);
  }
  const rows = REQUIRED_WEBGPU_TARGETS.map(({ name }) => `| ${name} | Not supported | none | fixture |`);
  writeFileSync(join(dir, 'docs', 'supported-environments.md'), rows.slice(1).join('\n'));
  const partial = run('web');
  assert.equal(partial.status, 1);
  assert.match(partial.stderr, /no row for Chrome and Edge/);
  assert.equal(existsSync(marker), false, 'partial qualification still refuses before signing');
  writeFileSync(join(dir, 'docs', 'supported-environments.md'), rows.join('\n'));
  assert.equal(run('web').status, 77, 'published results allow the signing stage to run');
  assert.equal(existsSync(marker), true);
});

test('release web builds require both catalog signing and verification keys', () => {
  assert.throws(() => validateReleaseEnvironment({}), /LOLLY_CATALOG_SIGNING_KEY/);
  assert.throws(
    () => validateReleaseEnvironment({ LOLLY_CATALOG_SIGNING_KEY: 'private' }),
    /VITE_CATALOG_PUBLIC_KEY_JWK/,
  );
  assert.doesNotThrow(() => validateReleaseEnvironment({
    LOLLY_CATALOG_SIGNING_KEY: 'private',
    VITE_CATALOG_PUBLIC_KEY_JWK: PUBLIC_JWK,
  }));
});

test('release public key pin must be public EC P-256 JWK material', () => {
  const base = { LOLLY_CATALOG_SIGNING_KEY: 'private' };
  assert.throws(
    () => validateReleaseEnvironment({ ...base, VITE_CATALOG_PUBLIC_KEY_JWK: '{' }),
    /valid JWK JSON/,
  );
  assert.throws(
    () => validateReleaseEnvironment({
      ...base,
      VITE_CATALOG_PUBLIC_KEY_JWK: JSON.stringify({ ...JSON.parse(PUBLIC_JWK), d: 'private' }),
    }),
    /must not contain private key material/,
  );
});

test('release frontend selection is explicit and closed', () => {
  assert.equal(parseReleaseFrontend(undefined), 'web');
  assert.equal(parseReleaseFrontend('web'), 'web');
  assert.equal(parseReleaseFrontend('tauri-desktop'), 'tauri-desktop');
  assert.equal(parseReleaseFrontend('tauri-mobile'), 'tauri-mobile');
  assert.throws(() => parseReleaseFrontend('other'), /unknown release frontend/);
});

test('managed AI release setting refuses ambiguous build values', () => {
  const env = { LOLLY_CATALOG_SIGNING_KEY: 'private', VITE_CATALOG_PUBLIC_KEY_JWK: PUBLIC_JWK };
  assert.doesNotThrow(() => validateReleaseEnvironment({ ...env, VITE_REQUIRE_AI_POLICY: 'true' }));
  for (const value of ['', 'TRUE', 'yes', '0']) {
    assert.throws(() => validateReleaseEnvironment({ ...env, VITE_REQUIRE_AI_POLICY: value }), /VITE_REQUIRE_AI_POLICY/);
  }
});

test('normal Tauri package builds use the signed release frontend hook', () => {
  for (const shell of ['tauri-desktop', 'tauri-mobile']) {
    const conf = JSON.parse(readFileSync(new URL(`../shells/${shell}/src-tauri/tauri.conf.json`, import.meta.url), 'utf8')) as {
      build: { beforeBuildCommand: string };
    };
    assert.match(conf.build.beforeBuildCommand, /build:frontend:release/);
  }
});

test('native builds refuse a missing or incomplete MilkDrop artist pack', async t => {
  const { assertDistState } = await import(new URL('../shells/tauri-shared/vite-embed.mjs', import.meta.url).href);
  const dir = mkdtempSync(join(tmpdir(), 'lolly-native-viz-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'catalog/tools'), { recursive: true });
  mkdirSync(join(dir, 'tools/qr-code'), { recursive: true });
  writeFileSync(join(dir, 'catalog/tools/index.json'), '{}');
  writeFileSync(join(dir, 'tools/qr-code/tool.json'), '{}');
  const check = assertDistState({ outDirDefault: dir, mode: 'profile' });
  assert.throws(() => check.writeBundle({}), /viz-presets\/index\.json missing/);
  mkdirSync(join(dir, 'viz-presets'));
  writeFileSync(join(dir, 'viz-presets/index.json'), '[]');
  assert.throws(() => check.writeBundle({}), /must list the bundled MilkDrop/);
  writeFileSync(join(dir, 'viz-presets/index.json'), JSON.stringify([{ id: 'geiss-collide' }]));
  assert.throws(() => check.writeBundle({}), /geiss-collide\.json missing/);
  writeFileSync(join(dir, 'viz-presets/geiss-collide.json'), '{}');
  assert.doesNotThrow(() => check.writeBundle({}));
});

test('hosted Tauri release workflows provide signing material to the build hook', () => {
  for (const workflow of ['flatpak.yml', 'linux-arm64.yml', 'ios-release.yml']) {
    const source = readFileSync(new URL(`../.github/workflows/${workflow}`, import.meta.url), 'utf8');
    assert.match(source, /LOLLY_CATALOG_SIGNING_KEY:\s*\$\{\{ secrets\.LOLLY_CATALOG_SIGNING_KEY \}\}/);
    assert.match(source, /VITE_CATALOG_PUBLIC_KEY_JWK:\s*\$\{\{ vars\.VITE_CATALOG_PUBLIC_KEY_JWK \}\}/);
  }
});

test('web container requires signed release inputs without baking keys into image configuration', () => {
  const source = readFileSync(new URL('../deploy/docker/web.Dockerfile', import.meta.url), 'utf8');
  const instructions = source.replace(/^\s*#.*$/gm, '').replace(/\\\n\s*/g, ' ');
  const release = instructions.split('\n').find(line => /^RUN .*pnpm run build:web:release\s*$/.test(line));
  assert.ok(release, 'the deployed image must use the signed release command');
  for (const key of ['LOLLY_CATALOG_SIGNING_KEY', 'VITE_CATALOG_PUBLIC_KEY_JWK']) {
    assert.ok(release.includes(`--mount=type=secret,id=${key},env=${key},required=true`));
    assert.doesNotMatch(instructions, new RegExp(`^(?:ARG|ENV)\\s+${key}\\b`, 'm'));
  }
  assert.doesNotMatch(instructions, /^RUN\b.*pnpm run build:web\s*$/m);
});

test('release signing accepts the matching public pin and refuses a different deployment key', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-release-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const tools = join(dir, 'tools');
  mkdirSync(join(tools, 'demo'), { recursive: true });
  writeFileSync(join(tools, 'demo', 'tool.json'), JSON.stringify({ id: 'demo' }));
  writeFileSync(join(tools, 'demo', 'template.html'), '<svg></svg>');
  const index = join(dir, 'index.json');
  writeFileSync(index, JSON.stringify({ tools: [{ id: 'demo' }] }));
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privateMaterial = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey));
  const sign = async (publicKey: CryptoKey, out: string) => spawnSync(process.execPath, [
    fileURLToPath(new URL('../scripts/sign-catalog.ts', import.meta.url)),
    '--tools', tools, '--index', index, '--out', out,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      LOLLY_CATALOG_SIGNING_KEY: privateMaterial,
      VITE_CATALOG_PUBLIC_KEY_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', publicKey)),
    },
  });
  const accepted = join(dir, 'accepted.sig.json');
  const good = await sign(pair.publicKey, accepted);
  assert.equal(good.status, 0, good.stderr);
  assert.equal((await verifyCatalogEnvelope(JSON.parse(readFileSync(accepted, 'utf8')), readFileSync(index), pair.publicKey)).ok, true);
  const rejected = join(dir, 'rejected.sig.json');
  const bad = await sign(other.publicKey, rejected);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /does not match VITE_CATALOG_PUBLIC_KEY_JWK/);
  assert.equal(existsSync(rejected), false, 'a mismatched deployment pin must produce no release envelope');
});
