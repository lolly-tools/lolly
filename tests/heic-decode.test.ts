// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the HEIC sniff (shells/web/src/bridge/heic-decode.ts).
 *
 * Only looksLikeHeic() is covered — it's the pure, dependency-free part. The actual
 * decode (decodeHeicBitmap) lazy-loads a ~3 MB WASM and needs a real canvas/browser,
 * so it's verified by driving the app. Importing the module here does NOT load the
 * WASM (heic-to is imported lazily inside decodeHeicBitmap only).
 *
 * Run with: node --test tests/heic-decode.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { looksLikeHeic } from '../shells/web/src/bridge/heic-decode.ts';

// looksLikeHeic accepts a Blob, but the extension/MIME branch only reads .name/.type,
// so tests also pass plain fixtures. Cast at the call boundary keeps the sniff honest.
type HeicInput = Parameters<typeof looksLikeHeic>[0];

// A 16-byte ISOBMFF header: [size][ftyp][brand]. Enough for the sniff.
function ftypBlob(brand: string): Blob {
  const b = new Uint8Array(16);
  b.set([0x00, 0x00, 0x00, 0x18], 0);        // box size (cosmetic here)
  b.set([0x66, 0x74, 0x79, 0x70], 4);        // 'ftyp'
  for (let i = 0; i < 4; i++) b[8 + i] = brand.charCodeAt(i);
  return new Blob([b]);
}

test('looksLikeHeic: true for HEIF-family ftyp brands in the header bytes', async () => {
  assert.equal(await looksLikeHeic(ftypBlob('heic')), true);
  assert.equal(await looksLikeHeic(ftypBlob('heix')), true);
  assert.equal(await looksLikeHeic(ftypBlob('mif1')), true);
});

test('looksLikeHeic: false for a non-HEIF ftyp brand and for junk bytes', async () => {
  assert.equal(await looksLikeHeic(ftypBlob('mp42')), false);   // an MP4, not HEIF
  assert.equal(await looksLikeHeic(ftypBlob('jpeg')), false);
  assert.equal(await looksLikeHeic(new Blob([new Uint8Array(16)])), false); // no 'ftyp'
});

test('looksLikeHeic: true by extension or MIME without reading bytes', async () => {
  assert.equal(await looksLikeHeic({ name: 'IMG_0001.HEIC', type: '' } as unknown as HeicInput), true);
  assert.equal(await looksLikeHeic({ name: 'photo.heif', type: '' } as unknown as HeicInput), true);
  assert.equal(await looksLikeHeic({ name: 'x', type: 'image/heic' } as unknown as HeicInput), true);
});

test('looksLikeHeic: false and non-throwing for a plain non-image object', async () => {
  assert.equal(await looksLikeHeic({ name: 'notes.txt', type: 'text/plain' } as unknown as HeicInput), false);
  assert.equal(await looksLikeHeic(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])])), false); // PNG magic
});
