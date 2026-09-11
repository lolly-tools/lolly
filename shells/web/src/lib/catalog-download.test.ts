// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  audioBitrateValue,
  imageDownloadFormat,
  imageQualityValue,
  transcodeCatalogImage,
  videoBitrateValue,
} from './catalog-download.ts';
import { signDerived } from './derived-asset.ts';

test('image format normalisation follows the encoded MIME, not the requested extension', () => {
  assert.equal(imageDownloadFormat('image/jpeg'), 'jpg');
  assert.equal(imageDownloadFormat('.JPG'), 'jpg');
  assert.equal(imageDownloadFormat('image/webp'), 'webp');
  assert.equal(imageDownloadFormat('image/avif'), null);
});

test('image conversion rejects a browser fallback instead of naming PNG bytes WebP', async () => {
  const images = {
    encode: async () => ({
      bytes: new Uint8Array([137, 80, 78, 71]),
      mime: 'image/png',
      width: 8,
      height: 6,
    }),
    resize: async () => ({ bytes: new Uint8Array(), mime: 'image/png', width: 8, height: 6 }),
    decode: async () => ({ mime: 'image/png', width: 8, height: 6 }),
  };
  await assert.rejects(
    () =>
      transcodeCatalogImage(images as never, new Blob(['source']), {
        format: 'webp',
        quality: 0.85,
      }),
    /produced image\/png instead of image\/webp/
  );
});

test('image conversion uses the result container and carries descriptive metadata without GPS by default', async () => {
  let seen: Record<string, unknown> | undefined;
  const images = {
    encode: async (_source: Blob, opts: Record<string, unknown>) => {
      seen = opts;
      return {
        bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
        mime: 'image/webp',
        width: 640,
        height: 480,
      };
    },
    resize: async () => {
      throw new Error('not used');
    },
    decode: async () => ({ mime: 'image/png', width: 640, height: 480 }),
  };
  const out = await transcodeCatalogImage(images as never, new Blob(['source']), {
    format: 'webp',
    quality: 0.85,
  });
  assert.equal(out.format, 'webp');
  assert.equal(out.blob.type, 'image/webp');
  assert.deepEqual(seen, { format: 'webp', quality: 0.85, carryMetadata: true });
});

test('professional quality controls have safe presets and bounded exact overrides', () => {
  assert.equal(imageQualityValue('balanced'), 0.85);
  assert.equal(imageQualityValue('best', 110), 1);
  assert.equal(audioBitrateValue('balanced'), 192_000);
  assert.equal(audioBitrateValue('smaller', 8), 32_000);
  assert.equal(videoBitrateValue(1920, 1080, 30, 'balanced', 30), 24_000_000);
});

test('a provenance-promising conversion refuses an unstampable container', async () => {
  await assert.rejects(
    () =>
      signDerived(
        { assets: { get: async () => ({}) as never } },
        {
          source: 'library',
          id: 'brand/source',
          type: 'data',
          format: 'bin',
          url: 'data:,x',
        },
        new Blob(['derived']),
        'bin',
        { edits: [], requireCredential: true }
      ),
    /Content Credentials are not supported for BIN/
  );
});
