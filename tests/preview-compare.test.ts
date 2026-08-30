// SPDX-License-Identifier: MPL-2.0
/**
 * scripts/lib/preview-compare.ts - the compare-before-write gate for catalog previews.
 * The raster half needs sharp (optional devDependency) and skips cleanly without it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgPreviewUnchanged, rasterPreviewUnchanged, previewUnchanged, sharpDecoder } from '../scripts/lib/preview-compare.ts';
import { stampVector } from '../scripts/lib/stamp-media.ts';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="#0c322c"/></svg>';
const SVG2 = SVG.replace('#0c322c', '#30ba78');

test('svg: the same document under a C2PA stamp counts as unchanged, a changed one does not', async () => {
  const stamped = await stampVector(SVG, { id: 't', name: 'T' });
  assert.notEqual(Buffer.from(stamped).toString(), SVG, 'stamp added a credential block');
  assert.equal(svgPreviewUnchanged(stamped, SVG), true);                   // committed (stamped) vs fresh (unstamped)
  assert.equal(svgPreviewUnchanged(stamped, await stampVector(SVG, { id: 't', name: 'T' })), true);
  assert.equal(svgPreviewUnchanged(stamped, SVG2), false);
  assert.equal(await previewUnchanged('svg', stamped, Buffer.from(SVG2), null), false);
});

test('raster: no decoder means always write', async () => {
  assert.equal(await previewUnchanged('webp', new Uint8Array([1]), new Uint8Array([2]), null), false);
});

const decode = await sharpDecoder();
const skip = decode ? false : 'sharp not available';

test('raster: re-encodes of the same picture are unchanged; a different picture or size is not', { skip }, async () => {
  const sharp = (await import('sharp')).default;
  const solid = (rgb: [number, number, number], size = 64) =>
    sharp({ create: { width: size, height: size, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } });
  const a80 = new Uint8Array(await solid([12, 50, 44]).webp({ quality: 80 }).toBuffer());
  const a60 = new Uint8Array(await solid([12, 50, 44]).webp({ quality: 60 }).toBuffer());
  const b80 = new Uint8Array(await solid([48, 186, 120]).webp({ quality: 80 }).toBuffer());
  const small = new Uint8Array(await solid([12, 50, 44], 32).webp({ quality: 80 }).toBuffer());
  assert.equal(await rasterPreviewUnchanged(a80, a60, decode!), true);
  assert.equal(await rasterPreviewUnchanged(a80, b80, decode!), false);
  assert.equal(await rasterPreviewUnchanged(a80, small, decode!), false, 'size change is a change');
  assert.equal(await rasterPreviewUnchanged(a80, new Uint8Array([0, 1, 2]), decode!), false, 'undecodable answers changed');
  assert.equal(await previewUnchanged('webp', a80, a60, decode), true);
});
