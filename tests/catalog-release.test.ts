// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
