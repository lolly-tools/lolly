// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { signedFixture } from './fixtures/desktop-update.ts';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { updaterPublicKey, verifyUpdaterArtifact } from '../shells/tauri-desktop/release/update-artifacts.ts';

test('independent verification accepts signed bytes and rejects mutations, wrong pins and version replay', () => {
  const f = signedFixture();
  assert.doesNotThrow(() => verifyUpdaterArtifact(f.bytes, f.signature, f.publicKey, f.version));
  for (const [bytes, sig, key, version] of [
    [Buffer.from('changed'), f.signature, f.publicKey, f.version],
    [f.bytes, f.signature, signedFixture().publicKey, f.version],
    [f.bytes, f.signature, f.publicKey, '1.1.5'],
    [f.bytes, '', f.publicKey, f.version],
  ] as const) assert.throws(() => verifyUpdaterArtifact(bytes, sig, key, version));
});

test('public pins reject placeholders, empty, truncated and arbitrary base64 values', () => {
  for (const key of ['', 'PLACEHOLDER-RUN-TAURI-SIGNER-GENERATE', 'AAAA', signedFixture().publicKey.slice(0, -12)]) {
    assert.throws(() => updaterPublicKey(key));
  }
});

test('ordinary desktop builds keep signing disabled until a release key is approved', () => {
  const config = JSON.parse(readFileSync(new URL('../shells/tauri-desktop/src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.equal(config.bundle.createUpdaterArtifacts, false);
  assert.equal(config.plugins.updater.pubkey, 'PLACEHOLDER-RUN-TAURI-SIGNER-GENERATE');
  assert.deepEqual(config.plugins.updater.endpoints, ['https://lolli.li/updates/{{target}}/{{arch}}/latest.json']);
});
