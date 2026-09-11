// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const PUBLIC_JWK = JSON.stringify({
  kty: 'EC',
  crv: 'P-256',
  x: 'test-public-x',
  y: 'test-public-y',
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
