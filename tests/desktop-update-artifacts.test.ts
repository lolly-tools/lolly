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

// The approved production updater identity (minisign key id F7E564892921B278, created 2026-11-04).
// Every installed app trusts only this key, so a change here is a key migration, never a casual edit.
const APPROVED_UPDATER_KEY_ID = 'F7E564892921B278';

test('ordinary desktop builds pin the approved updater key and leave artifact signing to release builds', () => {
  const config = JSON.parse(readFileSync(new URL('../shells/tauri-desktop/src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.equal(config.bundle.createUpdaterArtifacts, false);
  const decoded = Buffer.from(config.plugins.updater.pubkey, 'base64').toString('utf8');
  assert.match(decoded.split('\n')[0] ?? '', new RegExp(`minisign public key: ${APPROVED_UPDATER_KEY_ID}$`));
  assert.doesNotThrow(() => updaterPublicKey(config.plugins.updater.pubkey));
  assert.deepEqual(config.plugins.updater.endpoints, ['https://lolli.li/updates/{{target}}/{{arch}}/latest.json']);
});
