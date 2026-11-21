// SPDX-License-Identifier: MPL-2.0
/**
 * The preview writer's rule (plan 373), the parts that run without a canvas: SVG
 * kept as SVG up to the limit, the tile fit, the fidelity measure that decides
 * between lossy and lossless WebP, and SVG never handed out as a blob: URL. The
 * encoder itself runs in the browser test (tests/preview-store.browser.test.ts).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/preview-writer.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const writer = await import('./preview-writer.ts');
const urls = await import('./preview-urls.ts');
const { PREVIEW_MAX_BYTES } = await import('../../../../engine/src/session-preview.ts');

const svgOf = (bytes: number): string => {
  const head = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><desc>';
  return head + 'x'.repeat(Math.max(0, bytes - head.length - 13)) + '</desc></svg>';
};

test('SVG first: an SVG at or below 256 KiB is kept as SVG, with its route; a larger one is not', async () => {
  const small = await writer.svgPicture(svgOf(10_000));
  assert.equal(small?.ref.type, 'image/svg+xml');
  assert.equal(small?.ref.route, 'export-svg');
  assert.deepEqual([small?.ref.width, small?.ref.height], [640, 480]);
  const edge = await writer.svgPicture(svgOf(PREVIEW_MAX_BYTES));
  assert.ok(edge, 'exactly at the limit is kept');
  assert.equal(await writer.svgPicture(svgOf(PREVIEW_MAX_BYTES + 1)), null, 'one byte over goes to the raster fallback');
  assert.equal(await writer.svgPicture('<html>not a picture</html>'), null);
});

test('one raster size class: fitted inside 720 x 560, never enlarged unless the source is vector', () => {
  assert.deepEqual(writer.fitTile(1440, 1120), { width: 720, height: 560 });
  assert.deepEqual(writer.fitTile(2000, 500), { width: 720, height: 180 });
  assert.deepEqual(writer.fitTile(300, 200), { width: 300, height: 200 }, 'a small raster stays its size');
  assert.deepEqual(writer.fitTile(300, 200, undefined, true), { width: 720, height: 480 }, 'a vector source fills the tile');
});

test('the fidelity measure: identical pixels are 0, alpha weights colour, the 99.9th percentile decides', () => {
  const a = new Uint8ClampedArray(4 * 10_000).fill(200);
  assert.equal(writer.pictureDifference(a, a.slice()), 0);
  // One pixel in a thousand off by 255 does not move the 99.9th percentile.
  const sparse = a.slice();
  for (let i = 0; i < 10; i++) sparse[i * 4000] = 0;
  assert.equal(writer.pictureDifference(a, sparse), 0);
  // A thin line, 1 % of the pixels, dulled by 40 levels: past the bound.
  const line = a.slice();
  for (let i = 0; i < 100; i++) line[i * 400 + 1] = 160;
  assert.ok(writer.pictureDifference(a, line) > writer.DIFFERENCE_BOUND);
  // The same colour change on fully transparent pixels counts for nothing.
  const clear = new Uint8ClampedArray(4 * 10_000);
  const clearChanged = clear.slice();
  for (let i = 0; i < 10_000; i++) clearChanged[i * 4] = 255;
  assert.equal(writer.pictureDifference(clear, clearChanged), 0);
  assert.equal(writer.WEBP_QUALITY, 0.9);
});

test('an SVG picture is never handed out as a blob: URL; a raster is, and the map stays bounded', async () => {
  urls.revokeAllObjectUrls();
  const svg = await urls.srcForBlob('a'.repeat(32), new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }));
  assert.match(svg, /^data:image\/svg\+xml,/);
  assert.throws(() => urls.objectUrlFor('b'.repeat(32), new Blob(['<svg/>'], { type: 'image/svg+xml' })), /never handed out/);
  const raster = await urls.srcForBlob('c'.repeat(32), new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }));
  assert.match(raster, /^blob:/);
  assert.equal(await urls.srcForBlob('c'.repeat(32), new Blob([])), raster, 'one URL per content key');
  for (let i = 0; i < 400; i++) urls.objectUrlFor(i.toString(16).padStart(32, '0'), new Blob([new Uint8Array([i & 255])], { type: 'image/png' }));
  assert.ok(urls.objectUrlCount() <= 400 + 2, 'live and leaving together stay bounded');
  assert.equal(urls.srcStillLive(raster), true, 'an evicted URL is revoked only after its grace period');
  urls.revokeAllObjectUrls();
  assert.equal(urls.objectUrlCount(), 0);
});
