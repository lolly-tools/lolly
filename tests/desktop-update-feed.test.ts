// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { prepareUpdates, type FeedOptions } from '../shells/tauri-desktop/release/build-latest-json.ts';
import { signedFixture } from './fixtures/desktop-update.ts';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'lolly-update-feed-'));
  const signed = signedFixture();
  const files = ['Lolly.app.tar.gz', 'Lolly.AppImage', 'Lolly.deb', 'Lolly.rpm'];
  const targets = ['darwin-aarch64', 'linux-x86_64-appimage', 'linux-aarch64-deb', 'linux-x86_64-rpm'];
  for (const file of files) {
    writeFileSync(join(root, file), signed.bytes);
    writeFileSync(join(root, `${file}.sig`), signed.signature);
  }
  const opts: FeedOptions = { root, config: { version: signed.version, bundle: { createUpdaterArtifacts: true }, plugins: { updater: { pubkey: signed.publicKey } } },
    receipt: { version: signed.version, source: 'a'.repeat(40), artifacts: files.map((file, i) => ({ file, target: targets[i]!, sha256: createHash('sha256').update(signed.bytes).digest('hex') })) },
    artifacts: root, targets, notes: '<script>alert(1)</script>', date: '2026-11-04T12:00:00Z', env: {} };
  return { opts, root, clean: () => rmSync(root, { recursive: true, force: true }) };
}

test('feed groups per-installer entries, uses immutable HTTPS paths and preserves complete signatures', () => {
  const f = fixture();
  try {
    const result = prepareUpdates(f.opts);
    assert.equal(result.artifacts.length, 4);
    assert.equal(Object.keys(result.manifests).length, 3);
    for (const row of result.artifacts) {
      assert.match(row.url, /^https:\/\/lolli\.li\/releases\/1\.1\.4\//);
      assert.equal(row.signature, readFileSync(join(f.root, `${row.file}.sig`), 'utf8'));
      assert.ok(result.manifests[row.endpoint]?.platforms[row.target]);
    }
  } finally { f.clean(); }
});

test('feed refuses unsafe inputs before returning a manifest', () => {
  const changes: ((o: FeedOptions) => void)[] = [
    o => { o.config.plugins.updater.pubkey = 'PLACEHOLDER-RUN-TAURI-SIGNER-GENERATE'; },
    o => { o.config.bundle.createUpdaterArtifacts = false; },
    o => { o.receipt.version = '../bad'; }, o => { o.receipt.source = ''; },
    o => { o.targets = ['windows-x86_64']; }, o => { o.targets.push(o.targets[0]!); },
    o => { o.receipt.artifacts[0]!.sha256 = '0'.repeat(64); },
    o => { o.receipt.artifacts[0]!.file = '../Lolly.app.tar.gz'; },
    o => { o.date = 'not a date'; }, o => { o.env = { LOLLY_WEBGPU_QUALIFICATION_BUILD: '1' }; },
    o => { rmSync(join(o.artifacts, 'Lolly.app.tar.gz.sig')); },
    o => { writeFileSync(join(o.artifacts, 'Lolly.app.tar.gz.sig'), ''); },
    o => { rmSync(join(o.artifacts, 'Lolly.app.tar.gz')); },
    o => { writeFileSync(join(o.artifacts, 'WEBGPU-QUALIFICATION-BUILD-NOT-FOR-RELEASE.txt'), 'not for release'); },
  ];
  for (const change of changes) {
    const f = fixture();
    try { change(f.opts); assert.throws(() => prepareUpdates(f.opts)); } finally { f.clean(); }
  }
});

test('Linux publishing remains refused by the actual WebGPU release gate', () => {
  const f = fixture();
  try {
    delete f.opts.root;
    assert.throws(() => prepareUpdates(f.opts), /WebGPU[\s\S]*linux[\s\S]*Linux app/);
  } finally { f.clean(); }
});
