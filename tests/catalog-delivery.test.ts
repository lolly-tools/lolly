// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { catalogToolFiles, materializeCatalogDelivery, publishCatalogIndexes, retainCatalogDelivery } from '../scripts/materialize-catalog-delivery.ts';
import { verifyReleaseCatalog } from '../scripts/verify-release-catalog.ts';
import { catalogFreshness, catalogIndexPath, CATALOG_SIG_ALG, sha256Hex, signCatalogEnvelope, toolDirectoryHash } from '../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope } from '../engine/src/catalog-integrity.ts';

const digest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function tamper(path: string, text: string): void { chmodSync(path, 0o644); writeFileSync(path, text); }
function file(root: string, path: string, text: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}
function fixture(root: string, picture = 'picture one', library = 'library one'): void {
  file(root, 'tools/demo/tool.json', '{"id":"demo"}');
  file(root, 'tools/demo/template.html', '<main>Demo</main>');
  file(root, 'tools/demo/lib/component.js', library);
  file(root, 'tools/demo/i18n/README.txt', 'not a language sidecar');
  file(root, 'catalog/tools/index.json', '{"tools":[{"id":"demo"}]}');
  file(root, 'catalog/tools/index.slim.json', '{"tools":[{"id":"demo","name":"Demo"}]}');
  file(root, 'catalog/assets/picture.png', picture);
  file(root, 'catalog/assets/index.json', JSON.stringify({ assets: [{ id: 'demo/picture', formats: [{ format: 'png', url: '/catalog/assets/picture.png', checksum: 'sha256-' + Buffer.from(digest(picture), 'hex').toString('base64') }] }] }));
}
async function signed(root: string, seq = 1): Promise<CatalogSignatureEnvelope> {
  const materialized = await materializeCatalogDelivery(root);
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const files = catalogToolFiles(join(root, 'tools'));
  const envelope = await signCatalogEnvelope({ alg: CATALOG_SIG_ALG, keyId: 'fixture', signedAt: '2026-10-11T00:00:00.000Z', seq, files,
    indexHash: digest(readFileSync(join(root, 'catalog/tools/index.json'))),
    assetIndexHash: digest(readFileSync(join(root, 'catalog/assets/index.json'))),
    slimHash: digest(readFileSync(join(root, 'catalog/tools/index.slim.json'))), toolDirs: materialized.toolDirs }, pair.privateKey);
  publishCatalogIndexes(root, envelope, materialized.files);
  file(root, 'catalog/tools/index.sig.json', JSON.stringify(envelope));
  return envelope;
}

test('identical extracted builds materialize identical addresses and bytes', async () => {
  const base = mkdtempSync(join(tmpdir(), 'lolly-catalog-two-build-'));
  try {
    const a = join(base, 'a'), b = join(base, 'b'); fixture(a); fixture(b);
    const one = await signed(a), two = await signed(b);
    assert.equal(one.assetIndexHash, two.assetIndexHash);
    assert.deepEqual(one.toolDirs, two.toolDirs);
    assert.equal(readFileSync(join(a, 'catalog/delivery-manifest.json'), 'utf8'), readFileSync(join(b, 'catalog/delivery-manifest.json'), 'utf8'));
    assert.equal(readFileSync(join(a, 'catalog/assets/picture.png'), 'utf8'), 'picture one');
    assert.equal(one.files['demo/i18n/README.txt'], undefined);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('changed asset and library get new identities while retained old bytes survive', async () => {
  const base = mkdtempSync(join(tmpdir(), 'lolly-catalog-retain-'));
  try {
    const old = join(base, 'old'), next = join(base, 'next'); fixture(old); fixture(next, 'picture two', 'library two');
    const before = await signed(old), after = await signed(next, 2);
    assert.notEqual(before.assetIndexHash, after.assetIndexHash);
    assert.notEqual(before.toolDirs!.demo, after.toolDirs!.demo);
    const retained = retainCatalogDelivery(next, old);
    assert.ok(retained.length > 0);
    for (const item of retained) assert.equal(digest(readFileSync(join(next, item.path))), item.sha256);
    assert.equal(readFileSync(join(next, `tools/demo@${before.toolDirs!.demo!.slice(0, 16)}/lib/component.js`), 'utf8'), 'library one');
    assert.equal(readFileSync(join(next, 'tools/demo/lib/component.js'), 'utf8'), 'library two');
    publishCatalogIndexes(next, after, [...retained, ...JSON.parse(readFileSync(join(next, 'catalog/delivery-manifest.json'), 'utf8')).files]);
    assert.ok(JSON.parse(readFileSync(join(next, 'catalog/delivery-manifest.json'), 'utf8')).files.some((item: { path: string }) => item.path === catalogIndexPath(before.assetIndexHash!, 'assets').slice(1)));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('preview, OG and docshot hash copies preserve exact bytes and final references', async () => {
  const base = mkdtempSync(join(tmpdir(), 'lolly-public-image-delivery-'));
  try {
    fixture(base);
    const image = '<svg><metadata>credential bytes untouched</metadata></svg>';
    file(base, 'catalog/previews/demo.svg', image);
    file(base, 'catalog/og/demo.png', 'social card');
    file(base, 'info/shots/demo.svg', image);
    file(base, 'tools/demo/card.html', '<img src="/catalog/previews/demo.svg"><img src="/tools/demo/look0.svg">');
    file(base, 'tools/demo/look0.svg', image);
    file(base, 'catalog/tools/index.json', JSON.stringify({ tools: [{ id: 'demo', preview: '/tools/demo/card.html' }] }));
    file(base, 'catalog/tools/index.slim.json', JSON.stringify({ tools: [{ id: 'demo', preview: '/catalog/previews/demo.svg' }] }));
    file(base, 'catalog/previews/bundle.json', JSON.stringify({ 'demo:0': { src: '/tools/demo/look0.svg' }, 'demo:1': { src: '/catalog/previews/demo.svg' } }));
    file(base, 'tool/demo.html', '<meta property="og:image" content="https://example.test/catalog/og/demo.png">');
    file(base, 'info/intro.html', '<img src="/info/shots/demo.svg?fit=cover">');
    const first = await signed(base);
    const imageHash = digest(image).slice(0, 16), toolHash = first.toolDirs!.demo!.slice(0, 16);
    assert.equal(readFileSync(join(base, `catalog/previews/demo.${imageHash}.svg`), 'utf8'), image);
    assert.equal(readFileSync(join(base, 'catalog/previews/demo.svg'), 'utf8'), image);
    assert.equal(readFileSync(join(base, 'info/shots/demo.svg'), 'utf8'), image);
    assert.match(readFileSync(join(base, 'info/intro.html'), 'utf8'), new RegExp(`/info/shots/demo\\.${imageHash}\\.svg\\?fit=cover`));
    assert.match(readFileSync(join(base, 'tool/demo.html'), 'utf8'), /https:\/\/example.test\/catalog\/og\/demo\.[0-9a-f]{16}\.png/);
    assert.equal(JSON.parse(readFileSync(join(base, 'catalog/tools/index.json'), 'utf8')).tools[0].preview, `/tools/demo@${toolHash}/card.html`);
    assert.equal(JSON.parse(readFileSync(join(base, 'catalog/previews/bundle.json'), 'utf8'))['demo:0'].src, `/tools/demo@${toolHash}/look0.svg`);
    assert.match(readFileSync(join(base, `tools/demo@${toolHash}/card.html`), 'utf8'), new RegExp(`/catalog/previews/demo\\.${imageHash}\\.svg`));
    assert.ok(readFileSync(join(base, `tools/demo@${toolHash}/card.html`), 'utf8').includes('src="./look0.svg"'));
    assert.deepEqual((await materializeCatalogDelivery(base)).toolDirs, first.toolDirs, 'repeating the pass preserves directory identities');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('materialization refuses rewritten immutable URLs, corrupt originals and symlinks', async () => {
  const base = mkdtempSync(join(tmpdir(), 'lolly-catalog-refuse-'));
  try {
    const root = join(base, 'build'); fixture(root);
    const out = await materializeCatalogDelivery(root);
    tamper(join(root, out.files.find(item => item.path.endsWith('.png'))!.path), 'tampered');
    await assert.rejects(materializeCatalogDelivery(root), /Immutable catalog URL|checksum/);
    const links = join(base, 'links'); fixture(links);
    symlinkSync(join(base, 'build/tools/demo/lib'), join(links, 'tools/demo/external'));
    await assert.rejects(materializeCatalogDelivery(links), /symbolic link/);
    const corrupt = join(base, 'corrupt'); fixture(corrupt); writeFileSync(join(corrupt, 'catalog/assets/picture.png'), 'changed');
    await assert.rejects(materializeCatalogDelivery(corrupt), /checksum/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('retention rejects altered prior artifacts, traversal and nested releases', async () => {
  const base = mkdtempSync(join(tmpdir(), 'lolly-catalog-retain-refuse-'));
  try {
    const old = join(base, 'old'), next = join(base, 'next'); fixture(old); fixture(next);
    await signed(old);
    const inventory = JSON.parse(readFileSync(join(old, 'catalog/delivery-manifest.json'), 'utf8'));
    tamper(join(old, inventory.files[0].path), 'tampered');
    assert.throws(() => retainCatalogDelivery(next, old), /differ from inventory/);
    inventory.files = [{ path: 'catalog/../escape.0000000000000000.png', size: 0, sha256: '0'.repeat(64) }];
    file(old, 'catalog/delivery-manifest.json', JSON.stringify(inventory));
    assert.throws(() => retainCatalogDelivery(next, old), /Unsafe catalog delivery path/);
    assert.throws(() => retainCatalogDelivery(old, old), /separate from output/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('signer increments a verified floor and release verification checks addressed originals', async () => {
  const base = mkdtempSync(join(tmpdir(), 'lolly-catalog-signed-build-'));
  try {
    const root = join(base, 'build'); fixture(root);
    file(root, 'catalog/previews/demo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const privateKey = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey));
    const publicKey = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey));
    file(base, 'fixture.key.json', privateKey);
    const args = ['scripts/sign-catalog.ts', '--tools', join(root, 'tools'), '--index', join(root, 'catalog/tools/index.json'), '--keyfile', join(base, 'fixture.key.json'), '--materialize'];
    const env = { ...process.env, VITE_CATALOG_PUBLIC_KEY_JWK: publicKey };
    execFileSync(process.execPath, args, { env, stdio: 'pipe' });
    const first = JSON.parse(readFileSync(join(root, 'catalog/tools/index.sig.json'), 'utf8')) as CatalogSignatureEnvelope;
    file(base, 'previous.sig.json', JSON.stringify(first));
    execFileSync(process.execPath, [...args, '--previous-envelope', join(base, 'previous.sig.json')], { env, stdio: 'pipe' });
    const second = JSON.parse(readFileSync(join(root, 'catalog/tools/index.sig.json'), 'utf8')) as CatalogSignatureEnvelope;
    assert.equal(second.seq, first.seq! + 1);
    assert.equal((await verifyReleaseCatalog(root, publicKey)).verified, true);
    const previewPath = Object.keys(second.resources ?? {}).find(path => path.startsWith('/catalog/previews/') && path.endsWith('.svg'))!;
    assert.ok(previewPath);
    const previewBytes = readFileSync(join(root, previewPath.slice(1)), 'utf8');
    assert.equal(second.resources![previewPath], await sha256Hex(new TextEncoder().encode(previewBytes)));
    tamper(join(root, previewPath.slice(1)), 'changed preview fixture');
    await assert.rejects(verifyReleaseCatalog(root, publicKey), /public resource did not verify/);
    tamper(join(root, previewPath.slice(1)), previewBytes);
    const assets = JSON.parse(readFileSync(join(root, 'catalog/assets/index.json'), 'utf8'));
    tamper(join(root, assets.assets[0].formats[0].url.slice(1)), 'altered original');
    await assert.rejects(verifyReleaseCatalog(root, publicKey), /asset does not match/);
    tamper(join(root, assets.assets[0].formats[0].url.slice(1)), 'picture one');
    file(base, 'previous.sig.json', JSON.stringify({ ...second, seq: 900 }));
    assert.throws(() => execFileSync(process.execPath, [...args, '--previous-envelope', join(base, 'previous.sig.json')], { env, stdio: 'pipe' }));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('freshness protects legacy floors, sequence adoption and explicit expiry', async () => {
  const indexHash = await sha256Hex(new TextEncoder().encode('{}'));
  const offered: CatalogSignatureEnvelope = { alg: CATALOG_SIG_ALG, keyId: 'fixture', files: {}, indexHash, signedAt: '2026-10-11T00:00:00.000Z', signature: '' };
  assert.equal(catalogFreshness(offered, null).ok, true);
  assert.equal(catalogFreshness(offered, { signedAt: '2026-10-12T00:00:00.000Z' }).ok, false);
  assert.equal(catalogFreshness(offered, { seq: 1, signedAt: offered.signedAt }).ok, false);
  assert.equal(catalogFreshness({ ...offered, seq: 2 }, { seq: 3, signedAt: offered.signedAt }).ok, false);
  assert.equal(catalogFreshness({ ...offered, seq: 4 }, { seq: 3, signedAt: offered.signedAt }).ok, true);
  assert.equal(catalogFreshness({ ...offered, expiresAt: '2026-10-12T00:00:00.000Z' }, null, Date.parse('2026-10-12T00:00:00.000Z')).ok, false);
  assert.equal(catalogFreshness({ ...offered, seq: NaN }, null).ok, false);
  assert.equal(catalogFreshness({ ...offered, toolDirs: { demo: '../unsafe' } }, null).ok, false);
  await assert.rejects(toolDirectoryHash({ 'demo/../unsafe': 'a'.repeat(64) }, 'demo'), /invalid signed tool path/);
});

test('signer minimum sequence only raises the normal sequence and verifies unchanged', async t => {
  const base = mkdtempSync(join(tmpdir(), 'lolly-catalog-min-seq-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'build'); fixture(root);
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  file(base, 'fixture.key.json', JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)));
  const publicKey = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey));
  const out = join(root, 'catalog/tools/index.sig.json');
  const args = ['scripts/sign-catalog.ts', '--tools', join(root, 'tools'), '--index', join(root, 'catalog/tools/index.json'), '--keyfile', join(base, 'fixture.key.json')];
  const run = (extra: string[] = [], env: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [...args, ...extra], {
    encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, VITE_CATALOG_PUBLIC_KEY_JWK: publicKey, LOLLY_CATALOG_MIN_SEQ: undefined, ...env },
  });
  const sign = async (expected: number, extra: string[] = [], env: NodeJS.ProcessEnv = {}) => {
    const result = run(extra, env);
    assert.equal(result.status, 0, result.stderr);
    const envelope = JSON.parse(readFileSync(out, 'utf8')) as CatalogSignatureEnvelope;
    assert.equal(envelope.seq, expected);
    assert.equal((await verifyReleaseCatalog(root, publicKey)).verified, true);
    assert.equal(catalogFreshness(envelope, { seq: expected, signedAt: envelope.signedAt }).ok, true);
    return envelope;
  };

  const first = await sign(1);
  file(base, 'previous.sig.json', JSON.stringify(first));
  const previous = ['--previous-envelope', join(base, 'previous.sig.json')];
  await sign(2);
  await sign(2, [...previous, '--min-seq', '0']);
  await sign(2, [...previous, '--min-seq', '1']);
  await sign(2, [...previous, '--min-seq', '2']);
  await sign(50, [...previous, '--min-seq', '50']);
  await sign(51, ['--min-seq', '1']);
  await sign(100, previous, { LOLLY_CATALOG_MIN_SEQ: '100' });
  await sign(2, previous, { LOLLY_CATALOG_MIN_SEQ: '0' });
  await sign(7, [...previous, '--min-seq', '7'], { LOLLY_CATALOG_MIN_SEQ: '100' });
  await sign(7, [...previous, '--min-seq', '7'], { LOLLY_CATALOG_MIN_SEQ: 'invalid' });

  rmSync(out);
  await sign(500, ['--min-seq', '500']);
  await sign(Number.MAX_SAFE_INTEGER, [...previous, '--min-seq', String(Number.MAX_SAFE_INTEGER)]);
  const exhausted = run(['--min-seq', '0']);
  assert.notEqual(exhausted.status, 0);
  assert.match(exhausted.stderr, /Catalog sequence exhausted/);
  file(base, 'previous.sig.json', JSON.stringify({ ...first, seq: 900 }));
  const forged = run([...previous, '--min-seq', '1000']);
  assert.notEqual(forged.status, 0);
  assert.match(forged.stderr, /Previous catalog envelope did not verify/);

  rmSync(out);
  for (const value of ['-1', '1.5', 'NaN', 'Infinity', 'abc', '', ' ', '1e3', '0x10', '9007199254740992', '9007199254740993', '9007199254740991.1']) {
    for (const source of ['flag', 'env']) {
      const result = source === 'flag' ? run(['--min-seq', value]) : run([], { LOLLY_CATALOG_MIN_SEQ: value });
      assert.notEqual(result.status, 0, `${source}: ${JSON.stringify(value)}`);
      assert.match(result.stderr, /--min-seq (?:needs a value|\/ LOLLY_CATALOG_MIN_SEQ must be an integer between 0 and 9007199254740991)/);
      assert.equal(existsSync(out), false);
    }
  }
  const missing = run(['--min-seq']);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /--min-seq needs a value/);
});
