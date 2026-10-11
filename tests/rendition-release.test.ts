// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { generateRenditions, applyRenditions } from '../scripts/build-catalog-renditions.ts';
import { createAssetsAPI } from '../shells/web/src/bridge/assets.ts';

test('approved release products reuse signatures, retain originals and refuse changed credits or bytes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rendition-release-'));
  try {
    const dir = join(root, 'catalog/assets'); mkdirSync(dir, { recursive: true });
    const original = await sharp({ create: { width: 700, height: 350, channels: 3, background: 'green' } }).jpeg().toBuffer();
    writeFileSync(join(dir, 'original.jpg'), original);
    const asset = { id: 'fixture/photo', name: 'Fixture', type: 'raster', attribution: 'Fixture author', license: 'CC0-1.0', formats: [{ format: 'jpg', url: '/catalog/assets/original.jpg', width: 700, height: 350, checksum: 'sha256-' + createHash('sha256').update(original).digest('base64') }] };
    const index = join(dir, 'index.json'); writeFileSync(index, JSON.stringify({ assets: [asset] }));
    const opts = { root, output: join(root, 'catalog/renditions'), cache: join(root, 'cache'), sourceBase: 'https://example.invalid', approveSigning: true, signerVersion: 'fixture-v1', signing: {} };
    assert.deepEqual(await generateRenditions(opts), { assets: 1, products: 2, reused: 0 });
    const manifest = readFileSync(join(opts.output, 'index.json'));
    assert.deepEqual(await generateRenditions(opts), { assets: 1, products: 2, reused: 2 });
    assert.deepEqual(readFileSync(join(opts.output, 'index.json')), manifest);
    assert.equal(await applyRenditions(root), 2);
    assert.deepEqual(readFileSync(join(dir, 'original.jpg')), original);
    const current = JSON.parse(readFileSync(index, 'utf8')).assets[0];
    const [ref] = await createAssetsAPI({ getAll: async () => [current] } as never)._queryMetadata();
    assert.equal(ref!.format, 'jpg'); assert.equal(ref!.url, asset.formats[0]!.url);
    assert.deepEqual(ref!.meta?.formats, ['jpg']); assert.ok(ref!.meta); assert.equal((ref!.meta.renditions as unknown[]).length, 2);
    current.attribution = 'Changed author'; writeFileSync(index, JSON.stringify({ assets: [current] }));
    await assert.rejects(applyRenditions(root), /credits changed/);
    writeFileSync(index, JSON.stringify({ assets: [asset] }));
    const product = JSON.parse(manifest.toString()).assets[0].products[0];
    writeFileSync(join(opts.output, product.file), 'corrupt');
    await assert.rejects(applyRenditions(root), /checksum mismatch/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
