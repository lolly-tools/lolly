// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { prepareC2paIngredient, extractC2paStore, collectIngredientRecords, collectActionChain } from '../engine/src/c2pa-extract.ts';
import { signedRendition, encodeRendition } from '../scripts/catalog-renditions.ts';

test('rendition write approval is checked before any cache or signature is written', async () => {
  await assert.rejects(signedRendition({ source: new Uint8Array(), sourceUrl: 'https://example.invalid/original.png', sourceFormat: 'png', spec: { w: 64, fit: 'inside', format: 'webp' }, credits: { title: 'Fixture' }, signerVersion: 'fixture-v1', cache: '/unusable', approveSigning: false }), /owner approval/);
});
test('signed rendition preserves the original parent, credits and exact cached bytes', async () => {
  const cache = mkdtempSync(join(tmpdir(), 'lolly-rendition-'));
  try {
    const raw = await sharp({ create: { width: 256, height: 128, channels: 4, background: { r: 30, g: 120, b: 50, alpha: 1 } } }).withExif({ IFD0: { Artist: 'Fixture photographer', Copyright: 'Fixture copyright' } }).png().toBuffer();
    const source = await embedC2pa(new Uint8Array(raw), 'png', { title: 'Fixture original', author: { name: 'Fixture photographer' } });
    const opts = { source, sourceUrl: 'https://example.invalid/original.png', sourceFormat: 'png', spec: { w: 128, fit: 'inside', format: 'webp', q: 80 } as const, credits: { title: 'Fixture original', attribution: 'Fixture photographer', license: 'cc-by-4.0' }, signerVersion: 'fixture-only-v1', cache, approveSigning: true };
    const first = await signedRendition(opts), second = await signedRendition(opts);
    assert.equal(first.cached, false); assert.equal(second.cached, true);
    assert.deepEqual(first.bytes, second.bytes);
    assert.equal(first.width, 128); assert.equal(first.height, 64);
    assert.equal((await verifyC2pa(first.bytes)).state, 'valid');
    assert.ok(prepareC2paIngredient(first.bytes));
    const ingredients = collectIngredientRecords(extractC2paStore(first.bytes)!.store);
    assert.ok(ingredients.some(i => i.relationship === 'parentOf'));
    const metadata = await sharp(first.bytes).metadata();
    assert.ok(metadata.exif, 'native EXIF credits survive the conversion');
    assert.match(metadata.exif!.toString(), /Fixture photographer/);
    assert.match(metadata.exif!.toString(), /Fixture copyright/);
    const verdict = await verifyC2pa(first.bytes);
    assert.deepEqual(JSON.parse(verdict.environment!.creditsJson as string), opts.credits);
    const actions = collectActionChain(extractC2paStore(first.bytes)!.store).map(a => a.action);
    assert.ok(actions.includes('c2pa.resized')); assert.ok(actions.includes('c2pa.transcoded'));
    writeFileSync(join(cache, first.sourceSha256), 'unrelated');
    await assert.rejects(signedRendition({ ...opts, sourceUrl: 'https://example.invalid/original.png?dt=secret' }), /persistent/);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});
test('renditions refuse upscaling and animated flattening', async () => {
  const raw = new Uint8Array(await sharp({ create: { width: 32, height: 32, channels: 3, background: 'red' } }).png().toBuffer());
  await assert.rejects(encodeRendition(raw, { w: 640, fit: 'inside', format: 'webp' }), /never upscale/);
  // A two-page raw image avoids relying on a remote animation fixture.
  const pages = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), { raw: { width: 1, height: 2, channels: 3, pageHeight: 1 } }).gif({ delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(pages, { animated: true }).metadata()).pages, 2);
  await assert.rejects(encodeRendition(new Uint8Array(pages), { w: 1, fit: 'inside', format: 'webp' }), /Animated sources/);
});
